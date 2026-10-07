import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMyGallery, fetchGalleryByToken } from "../lib/api";
import HoverPlayPhoto from "../components/HoverPlayPhoto";

const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="M21 15l-5.5-5.5a2 2 0 0 0-2.8 0L3 19" />
  </svg>
);
const ScanIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
    <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
    <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
    <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
  </svg>
);

function HowItWorks() {
  return (
    <div className="howto-card">
      <h2>Как это работает</h2>
      <p>Три шага — и ваше фото оживёт прямо на экране телефона.</p>
      <div className="howto-steps">
        <div className="howto-step">
          <div className="howto-step-icon"><PhotoIcon /></div>
          <div className="howto-step-title">1. Фото появится здесь</div>
          <p className="howto-step-text">Как только вам добавят пару фото + видео, она будет в этой галерее.</p>
        </div>
        <div className="howto-step">
          <div className="howto-step-icon"><ScanIcon /></div>
          <div className="howto-step-title">2. Откройте AR-сканер</div>
          <p className="howto-step-text">Нажмите "Сканер" внизу и разрешите доступ к камере.</p>
        </div>
        <div className="howto-step">
          <div className="howto-step-icon"><PlayIcon /></div>
          <div className="howto-step-title">3. Наведите камеру на фото</div>
          <p className="howto-step-text">На печатном или экранном фото прямо поверх него включится видео.</p>
        </div>
      </div>
    </div>
  );
}

export default function ClientGalleryPage() {
  const { token } = useParams();
  const [pairs, setPairs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = token ? await fetchGalleryByToken(token) : await fetchMyGallery();
        setPairs(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Моя галерея</h1>
          <Link to={token ? `/scan/${token}` : "/scan"} className="scan-cta">
            Открыть AR-сканер →
          </Link>
        </div>

        {!loading && !error && pairs.length > 0 && (
          <p className="helper-text" style={{ marginTop: -16 }}>
            Наведите курсор на фото (на телефоне — коснитесь), чтобы оно ожило.
          </p>
        )}

        {loading && <p>Загрузка…</p>}
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && pairs.length === 0 && <HowItWorks />}

        <div className="gallery-grid">
          {pairs.map((p) => (
            <HoverPlayPhoto key={p.id} photoUrl={p.photo_url} videoUrl={p.video_url} title={p.title} />
          ))}
        </div>
      </div>
    </div>
  );
}
