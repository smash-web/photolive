import { useRef, useState } from "react";

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4" />
    <path d="M7.5 8.5L12 4l4.5 4.5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

async function sharePhoto(photoUrl, title) {
  const shareTitle = title || "Живое Фото";
  try {
    if (navigator.share) {
      if (navigator.canShare) {
        try {
          const resp = await fetch(photoUrl);
          const blob = await resp.blob();
          const file = new File([blob], `${shareTitle}.jpg`, { type: blob.type || "image/jpeg" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: shareTitle });
            return;
          }
        } catch {
          // не вышло скачать файл для шаринга — просто поделимся ссылкой
        }
      }
      await navigator.share({ title: shareTitle, url: photoUrl });
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(photoUrl);
      window.alert("Ссылка на фото скопирована");
    }
  } catch {
    // пользователь закрыл системное окно "поделиться" — ничего не делаем
  }
}

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
        <button
          className="photo-card-share"
          aria-label="Поделиться"
          onClick={(e) => {
            e.stopPropagation();
            sharePhoto(photoUrl, title);
          }}
        >
          <ShareIcon />
        </button>
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
