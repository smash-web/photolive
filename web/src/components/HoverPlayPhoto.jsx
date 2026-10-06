import { useRef, useState } from "react";

// Десктоп: видео играет при наведении курсора.
// Мобильные: видео играет при тапе (пока палец/клик удерживается — через onClick).
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
      onMouseEnter={play}
      onMouseLeave={stop}
      onClick={() => (playing ? stop() : play())}
      style={{ position: "relative", width: 240, height: 320, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#111" }}
    >
      <img
        src={photoUrl}
        alt={title || ""}
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: playing ? 0 : 1, transition: "opacity .2s" }}
      />
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: playing ? 1 : 0, transition: "opacity .2s" }}
      />
      {title && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 6, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 12 }}>
          {title}
        </div>
      )}
    </div>
  );
}
