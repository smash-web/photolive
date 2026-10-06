"""
Распознавание распечатанного фото по кадру с камеры.

ВАЖНО про портреты людей: ORB ищет резкие "уголки" и текстуру, а не
понимает "это лицо" (в отличие от нейросетевых AR-масок вроде TikTok,
которые натренированы именно на лицах). Гладкая кожа и однотонная
одежда дают мало зацепок для классического поиска по точкам. Чтобы
компенсировать это для портретов:
- увеличено число искомых точек (nfeatures) в разы;
- добавлено выравнивание контраста (CLAHE) перед поиском точек — это
  "вытягивает" больше мелких деталей (поры, тени, складки ткани),
  не видимых алгоритму на плоском изображении;
- пороги уверенности снижены, т.к. для одного человека в базе риск
  спутать с чужим фото низкий, а гибкость важнее.
"""

import base64
import cv2
import numpy as np

ORB = cv2.ORB_create(nfeatures=2000)
BF_MATCHER = cv2.BFMatcher(cv2.NORM_HAMMING)
CLAHE = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

MIN_GOOD_MATCHES = 8
MIN_INLIERS = 6


def _preprocess(img_gray):
    """Выравнивание контраста — помогает находить точки на гладких лицах/коже."""
    return CLAHE.apply(img_gray)


def compute_descriptors(image_bytes: bytes):
    """Извлекает ORB keypoints+descriptors. Возвращает (pts, descriptors, (w,h)) или (None, None, None)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None, None, None
    h, w = img.shape
    scale = 1000 / max(h, w) if max(h, w) > 1000 else 1.0
    if scale != 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    img = _preprocess(img)
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
        good = [m for m, n in matches if m.distance < 0.8 * n.distance]
        if len(good) < MIN_GOOD_MATCHES:
            continue

        src_pts = query_pts_np[[m.queryIdx for m in good]].reshape(-1, 1, 2)
        cand_pts_np = np.float32(cand["pts"])
        dst_pts = cand_pts_np[[m.trainIdx for m in good]].reshape(-1, 1, 2)

        _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 8.0)
        if mask is None:
            continue
        inliers = int(mask.sum())

        if inliers >= MIN_INLIERS and inliers > best_inliers:
            best_inliers = inliers
            best_pair_id = cand["pair_id"]

    return best_pair_id

