import { useRef, useState } from "react";

// Десктоп: видео играет при наведении курсора.
// Мобильные: видео играет по тапу (повторный тап — остановить).
export default function HoverPlayPhoto({ photoUrl, videoUrl, title }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    setPlaying(true);
    videoRef.current?.play().catch(() => {});
  };
  const stop = () => {
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className={`photo-card${playing ? " is-playing" : ""}`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onClick={() => (playing ? stop() : play())}
    >
      <div className="photo-card-frame">
        <img src={photoUrl} alt={title || "Фото"} loading="lazy" />
        <video ref={videoRef} src={videoUrl} muted loop playsInline />
      </div>
      <div className="photo-card-caption">
        <span>{title || "Без названия"}</span>
        <span className="live-pill">
          <span className="live-dot" /> ожило
        </span>
      </div>
    </div>
  );
}
