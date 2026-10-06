import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as THREE from "three";
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
import { fetchClientTargets } from "../lib/api";

/**
 * AR-сканер на MindAR: видео "приклеено" к найденному физическому
 * фото и двигается вместе с камерой в реальном времени, пока камера
 * видит фото (а не разово, как было в старом варианте).
 *
 * MindAR сам определяет, какое из нескольких фото клиента (targetIndex)
 * сейчас в кадре — все фото клиента скомпилированы в один .mind-файл
 * заранее (при загрузке в Админке).
 *
 * Это прототип: я не могу протестировать его в реальном браузере с
 * камерой из этой среды. Основные вещи, которые могут потребовать
 * подстройки на реальном устройстве: соотношение сторон плоскости
 * (PlaneGeometry) под реальные фото (сейчас общее приближение),
 * и точный путь импорта mind-ar в вашей версии сборки (если Vite
 * ругнётся на импорт "mind-ar/dist/mindar-image-three.prod.js" —
 * напишите мне текст ошибки, поправим).
 */
export default function ArScanPage() {
  const { token } = useParams();
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
        const { targetUrl, pairOrder, videoUrls } = await fetchClientTargets(token);

        if (!targetUrl || pairOrder.length === 0) {
          setError("Для этого аккаунта пока нет фото, готовых для AR-сканера.");
          return;
        }
        if (stopped) return;

        mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: targetUrl,
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

          const texture = new THREE.VideoTexture(videoEl);
          const geometry = new THREE.PlaneGeometry(1, 1.4);
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
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#000" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <p style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        {status}
      </p>
      {error && (
        <p style={{ position: "absolute", top: 16, left: 16, right: 16, color: "#fff", background: "rgba(200,0,0,0.7)", padding: 8, borderRadius: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}

