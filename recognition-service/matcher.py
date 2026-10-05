"""
Распознавание распечатанного фото по кадру с камеры.

Почему не perceptual hash (pHash): pHash сравнивает фото "в целом" и
ломается от угла съёмки, обрезки, бликов на глянце, освещения.
ORB + RANSAC ищет устойчивые локальные особенности (углы, текстуры)
и проверяет, что их взаимное расположение геометрически согласовано
(гомография) — это работает даже когда фото снято под углом с телефона.
"""

import base64
import cv2
import numpy as np

ORB = cv2.ORB_create(nfeatures=800)
BF_MATCHER = cv2.BFMatcher(cv2.NORM_HAMMING)

MIN_GOOD_MATCHES = 15
MIN_INLIERS = 12


def compute_descriptors(image_bytes: bytes):
    """Извлекает ORB keypoints+descriptors. Возвращает (pts, descriptors, (w,h)) или (None, None, None)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None, None, None
    h, w = img.shape
    scale = 800 / max(h, w) if max(h, w) > 800 else 1.0
    if scale != 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    keypoints, descriptors = ORB.detectAndCompute(img, None)
    if descriptors is None:
        return None, None, None
    pts = [kp.pt for kp in keypoints]
    img_h, img_w = img.shape
    return pts, descriptors, (img_w, img_h)


def serialize_descriptors(pts, descriptors, img_size) -> dict:
    return {
        "pts": pts,
        "shape": list(descriptors.shape),
        "data": base64.b64encode(descriptors.tobytes()).decode("ascii"),
        "img_size": list(img_size),
    }


def deserialize_descriptors(payload: dict):
    pts = payload["pts"]
    shape = tuple(payload["shape"])
    data = base64.b64decode(payload["data"])
    descriptors = np.frombuffer(data, dtype=np.uint8).reshape(shape)
    return pts, descriptors


def match_against_candidates(query_pts, query_desc, candidates: list[dict]):
    """candidates: [{"pair_id":..., "pts":[...], "descriptors": np.ndarray}, ...]"""
    query_pts_np = np.float32(query_pts)
    best_pair_id = None
    best_inliers = 0

    for cand in candidates:
        cand_desc = cand["descriptors"]
        if cand_desc is None or len(cand_desc) < 2:
            continue

        matches = BF_MATCHER.knnMatch(query_desc, cand_desc, k=2)
        good = [m for m, n in matches if m.distance < 0.75 * n.distance]
        if len(good) < MIN_GOOD_MATCHES:
            continue

        src_pts = query_pts_np[[m.queryIdx for m in good]].reshape(-1, 1, 2)
        cand_pts_np = np.float32(cand["pts"])
        dst_pts = cand_pts_np[[m.trainIdx for m in good]].reshape(-1, 1, 2)

        _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
        if mask is None:
            continue
        inliers = int(mask.sum())

        if inliers >= MIN_INLIERS and inliers > best_inliers:
            best_inliers = inliers
            best_pair_id = cand["pair_id"]

    return best_pair_id
