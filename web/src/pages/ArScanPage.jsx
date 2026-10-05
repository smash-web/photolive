import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchGalleryFeatures } from "../lib/api";

/**
 * НАСТОЯЩИЙ AR-режим: видео "приклеивается" к найденному физическому
 * фото и двигается вместе с камерой в реальном времени. Распознавание
 * и отслеживание идут прямо в браузере через OpenCV.js (WASM).
 *
 * Это прототип, не протестированный на реальном устройстве (у меня
 * нет браузера с камерой в этой среде) — пороги ниже почти наверняка
 * потребуют подстройки под реальные условия съёмки.
 */

const OPENCV_URL = "https://docs.opencv.org/4.9.0/opencv.js";
const MIN_GOOD_MATCHES = 12;
const MIN_INLIERS = 10;
const LOST_FRAMES_BEFORE_UNLOCK = 12;
const DETECT_INTERVAL_MS = 180;

function loadOpenCv() {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) return resolve(window.cv);
    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = () => {
      window.cv["onRuntimeInitialized"] = () => resolve(window.cv);
    };
    script.onerror = () => reject(new Error("Не удалось загрузить OpenCV.js"));
    document.body.appendChild(script);
  });
}

export default function ArScanPage() {
  const { token } = useParams();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const workCanvasRef = useRef(null);
  const overlayVideosRef = useRef({});
  const candidatesRef = useRef([]);
  const lockedRef = useRef(null);
  const [status, setStatus] = useState("Загрузка...");
  const [error, setError] = useState(null);

  useEffect(() => {
    let stopped = false;

    async function init() {
      try {
        setStatus("Загружаем модуль распознавания (может занять пару секунд)...");
        const cv = await loadOpenCv();

        setStatus("Загружаем ваши фото...");
        const features = await fetchGalleryFeatures(token);
        if (!features.length) {
          setError("Пока нет фото, привязанных к вашему аккаунту.");
          return;
        }

        candidatesRef.current = features.map((f) => {
          const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
          const descMat = cv.matFromArray(f.shape[0], f.shape[1], cv.CV_8U, Array.from(bytes));
          return { pair_id: f.pair_id, video_url: f.video_url, pts: f.pts, imgSize: f.img_size, descMat };
        });

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setStatus("Наведите камеру на фото...");
        if (!stopped) startLoops(cv);
      } catch (e) {
        setError(e.message);
      }
    }

    function startLoops(cv) {
      const orb = new cv.ORB(500);
      const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
      const emptyMask = new cv.Mat();

      function getOverlayVideoEl(pairId, url) {
        if (!overlayVideosRef.current[pairId]) {
          const v = document.createElement("video");
          v.src = url;
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          v.play().catch(() => {});
          overlayVideosRef.current[pairId] = v;
        }
        return overlayVideosRef.current[pairId];
      }

      function drawWarpedVideo(overlayVideo, locked, canvas) {
        const [w, h] = locked.imgSize;
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d").drawImage(overlayVideo, 0, 0, w, h);

        const srcMat = cv.imread(tmp);
        const dstSize = new cv.Size(canvas.width, canvas.height);
        const warped = new cv.Mat();
        cv.warpPerspective(srcMat, warped, locked.H, dstSize);

        const whiteRef = new cv.Mat(h, w, cv.CV_8UC1, new cv.Scalar(255));
        const maskWarped = new cv.Mat();
        cv.warpPerspective(whiteRef, maskWarped, locked.H, dstSize);

        const ctx = canvas.getContext("2d");
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < maskWarped.data.length; i++) {
          if (maskWarped.data[i] > 10) {
            frameData.data[i * 4] = warped.data[i * 4];
            frameData.data[i * 4 + 1] = warped.data[i * 4 + 1];
            frameData.data[i * 4 + 2] = warped.data[i * 4 + 2];
          }
        }
        ctx.putImageData(frameData, 0, 0);

        srcMat.delete();
        warped.delete();
        whiteRef.delete();
        maskWarped.delete();
      }

      async function detectTick() {
        try {
          const video = videoRef.current;
          const work = workCanvasRef.current;
          if (video && work && video.readyState >= 2) {
            work.width = video.videoWidth;
            work.height = video.videoHeight;
            work.getContext("2d").drawImage(video, 0, 0);

            const frameMat = cv.imread(work);
            const gray = new cv.Mat();
            cv.cvtColor(frameMat, gray, cv.COLOR_RGBA2GRAY);

            const keypoints = new cv.KeyPointVector();
            const descriptors = new cv.Mat();
            orb.detectAndCompute(gray, emptyMask, keypoints, descriptors);

            if (descriptors.rows > 0) {
              const pool = lockedRef.current
                ? candidatesRef.current.filter((c) => c.pair_id === lockedRef.current.pair_id)
                : candidatesRef.current;

              let found = null;
              for (const cand of pool) {
                const matches = new cv.DMatchVectorVector();
                matcher.knnMatch(descriptors, cand.descMat, matches, 2);

                const good = [];
                for (let i = 0; i < matches.size(); i++) {
                  const pair = matches.get(i);
                  if (pair.size() < 2) continue;
                  const m = pair.get(0);
                  const n = pair.get(1);
                  if (m.distance < 0.75 * n.distance) good.push(m);
                }
                matches.delete();
                if (good.length < MIN_GOOD_MATCHES) continue;

                const srcArr = [];
                const dstArr = [];
                for (const m of good) {
                  const kp = keypoints.get(m.queryIdx);
                  const refPt = cand.pts[m.trainIdx];
                  srcArr.push(refPt[0], refPt[1]);
                  dstArr.push(kp.pt.x, kp.pt.y);
                }
                const srcMat = cv.matFromArray(good.length, 1, cv.CV_32FC2, srcArr);
                const dstMat = cv.matFromArray(good.length, 1, cv.CV_32FC2, dstArr);
                const ransacMask = new cv.Mat();
                const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5, ransacMask);

                let inliers = 0;
                for (let i = 0; i < ransacMask.rows; i++) if (ransacMask.data[i]) inliers++;

                if (inliers >= MIN_INLIERS && !H.empty()) {
                  found = { pair_id: cand.pair_id, H, imgSize: cand.imgSize, video_url: cand.video_url };
                } else {
                  H.delete();
                }
                srcMat.delete();
                dstMat.delete();
                ransacMask.delete();
                if (found) break;
              }

              if (found) {
                if (lockedRef.current?.H) lockedRef.current.H.delete();
                lockedRef.current = { ...found, lostFrames: 0 };
                setStatus("Фото узнано!");
              } else if (lockedRef.current) {
                lockedRef.current.lostFrames += 1;
                if (lockedRef.current.lostFrames > LOST_FRAMES_BEFORE_UNLOCK) {
                  lockedRef.current.H.delete();
                  lockedRef.current = null;
                  setStatus("Наведите камеру на фото...");
                }
              }
            }

            keypoints.delete();
            descriptors.delete();
            gray.delete();
            frameMat.delete();
          }
        } catch (e) {
          // не роняем цикл из-за единичной ошибки кадра
        }
        if (!stopped) setTimeout(detectTick, DETECT_INTERVAL_MS);
      }

      function drawTick() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);

          const locked = lockedRef.current;
          if (locked) {
            const overlayVideo = getOverlayVideoEl(locked.pair_id, locked.video_url);
            if (overlayVideo.readyState >= 2) drawWarpedVideo(overlayVideo, locked, canvas);
          }
        }
        if (!stopped) requestAnimationFrame(drawTick);
      }

      detectTick();
      requestAnimationFrame(drawTick);
    }

    init();

    return () => {
      stopped = true;
      const stream = videoRef.current?.srcObject;
      stream?.getTracks().forEach((t) => t.stop());
      candidatesRef.current.forEach((c) => c.descMat?.delete());
      if (lockedRef.current?.H) lockedRef.current.H.delete();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#000" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={workCanvasRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      <p style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#fff" }}>{status}</p>
      {error && <p style={{ position: "absolute", top: 16, left: 16, right: 16, color: "#fff", background: "rgba(200,0,0,0.7)", padding: 8, borderRadius: 8 }}>{error}</p>}
    </div>
  );
}
