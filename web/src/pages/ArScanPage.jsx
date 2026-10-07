import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { MindARThree } from "mind-ar-image-three";
import { fetchClientTargets } from "../lib/api";

function loadImageSize(url) {
  return new Promise((resolve) => {
    if (!url) { resolve({ width: 1, height: 1.4 }); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1.4 });
    img.onerror = () => resolve({ width: 1, height: 1.4 });
    img.src = url;
  });
}

export default function ArScanPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Загрузка...");
  const [error, setError] = useState(null);

  useEffect(() => {
    let stopped = false;
    let mindarThree;
    const videoEls = [];

    async function start() {
      try {
        setStatus("Загружаем данные для распознавания...");
        const { targetUrl, pairOrder, videoUrls, photoUrls } = await fetchClientTargets(token);

        if (!targetUrl || !pairOrder || pairOrder.length === 0) {
          setError("Для этого аккаунта пока нет фото, готовых для AR-сканера.");
          return;
        }
        if (stopped) return;

        // Узнаём реальные пропорции каждого фото, чтобы плоскость с видео
        // покрывала фото целиком, а не кусок посередине (раньше размер
        // плоскости был захардкожен как 1 × 1.4 для всех фото).
        const sizes = await Promise.all((photoUrls || []).map(loadImageSize));
        if (stopped) return;

        mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: targetUrl,
          // Сглаживаем дрожание трекинга (стандартные настройки mind-ar
          // слишком резко реагируют на мелкий шум камеры).
          filterMinCF: 0.0001,
          filterBeta: 10,
          missTolerance: 5,
          warmupTolerance: 2,
        });
        const { renderer, scene, camera } = mindarThree;

        pairOrder.forEach((_, index) => {
          const url = videoUrls[index];
          if (!url) return;

          const videoEl = document.createElement("video");
          videoEl.src = url;
          videoEl.crossOrigin = "anonymous";
          videoEl.loop = true;
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEls.push(videoEl);

          const { width, height } = sizes[index] || { width: 1, height: 1.4 };
          const texture = new THREE.VideoTexture(videoEl);
          // Плоскость всегда шириной в 1 условную единицу (так работает
          // система координат mind-ar), высота — по реальным пропорциям фото.
          const geometry = new THREE.PlaneGeometry(1, height / width);
          const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
          const plane = new THREE.Mesh(geometry, material);

          const anchor = mindarThree.addAnchor(index);
          anchor.group.add(plane);

          anchor.onTargetFound = () => {
            videoEl.play().catch(() => {});
            setStatus("Фото узнано!");
          };
          anchor.onTargetLost = () => {
            videoEl.pause();
            setStatus("Наведите камеру на фото...");
          };
        });

        setStatus("Наведите камеру на фото...");
        await mindarThree.start();
        if (stopped) return;

        renderer.setAnimationLoop(() => {
          renderer.render(scene, camera);
        });
      } catch (e) {
        setError(e?.message || String(e));
      }
    }

    start();

    return () => {
      stopped = true;
      videoEls.forEach((v) => v.pause());
      if (mindarThree) {
        try {
          mindarThree.renderer.setAnimationLoop(null);
          mindarThree.stop();
        } catch {
          // игнорируем ошибки остановки при размонтировании
        }
      }
    };
  }, [token]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1000,
      }}
    >
      <div ref={containerRef} style={{ position: "relative", zIndex: 0, width: "100%", height: "100%" }} />

      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1001,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "none",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 22,
          lineHeight: "44px",
          textAlign: "center",
          padding: 0,
        }}
        aria-label="Закрыть сканер"
      >
        ✕
      </button>

      <p style={{ position: "absolute", bottom: 16, left: 0, right: 0, zIndex: 1001, textAlign: "center", color: "#fff" }}>
        {status}
      </p>
      {error && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 70,
            zIndex: 1001,
            color: "#fff",
            background: "rgba(200,0,0,0.7)",
            padding: 8,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
