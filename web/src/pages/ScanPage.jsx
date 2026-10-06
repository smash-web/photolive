import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { recognizeFrame } from "../lib/api";

export default function ScanPage() {
  const { token } = useParams();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [matchedVideo, setMatchedVideo] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState("Ещё не пробовал");
  const attempts = useRef(0);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => { videoRef.current.srcObject = stream; })
      .catch((e) => setError("Нет доступа к камере: " + e.message));
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        attempts.current += 1;
        try {
          const res = await recognizeFrame({ blob, token });
          if (res.match) {
            setMatchedVideo(res.match.video_url);
            setScanning(false);
            setDebug("Найдено совпадение!");
          } else {
            setDebug(`Попытка №${attempts.current}: сервер ответил, совпадений не найдено`);
          }
        } catch (e) {
          setDebug(`Попытка №${attempts.current}: ОШИБКА — ${e.message}`);
        }
      }, "image/jpeg", 0.85);
    }, 1500);
    return () => clearInterval(interval);
  }, [scanning, token]);

  const reset = () => { setMatchedVideo(null); setScanning(true); };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#000" }}>
      {error && <p style={{ color: "red", position: "absolute", top: 16, left: 16, zIndex: 2 }}>{error}</p>}
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {scanning && !matchedVideo && (
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
          <p>Наведите камеру на фото...</p>
          <p style={{ fontSize: 11, color: "#aaa", padding: "0 12px" }}>{debug}</p>
        </div>
      )}
      {matchedVideo && (
        <div style={{ position: "absolute", inset: 0, background: "#000" }}>
          <video src={matchedVideo} autoPlay loop playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <button onClick={reset} style={{ position: "absolute", top: 16, right: 16 }}>Сканировать снова</button>
        </div>
      )}
    </div>
  );
}
