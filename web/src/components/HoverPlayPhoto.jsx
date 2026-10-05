import { useRef, useState } from "react";

export default function HoverPlayPhoto({ photoUrl, videoUrl, title }) {
  const [active, setActive] = useState(false);
  const videoRef = useRef(null);

  const start = () => {
    setActive(true);
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
  };

  const stop = () => {
    setActive(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      style={{ position: "relative", width: 260, height: 260, borderRadius: 12, overflow: "hidden", cursor: "pointer" }}
      onMouseEnter={start}
      onMouseLeave={stop}
      onClick={() => (active ? stop() : start())}
    >
      <img
        src={photoUrl}
        alt={title || "photo"}
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          position: "absolute", inset: 0,
          opacity: active ? 0 : 1, transition: "opacity 300ms ease",
        }}
      />
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          position: "absolute", inset: 0,
          opacity: active ? 1 : 0, transition: "opacity 300ms ease",
        }}
      />
      {title && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 6, background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 12 }}>
          {title}
        </div>
      )}
    </div>
  );
}
