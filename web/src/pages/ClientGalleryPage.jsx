import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMyGallery, fetchGalleryByToken } from "../lib/api";
import HoverPlayPhoto from "../components/HoverPlayPhoto";

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
        {!loading && !error && pairs.length === 0 && (
          <div className="empty-state">
            <p style={{ margin: 0 }}>Здесь пока нет фотографий. Как только их добавят, они появятся в этой галерее.</p>
          </div>
        )}

        <div className="gallery-grid">
          {pairs.map((p) => (
            <HoverPlayPhoto key={p.id} photoUrl={p.photo_url} videoUrl={p.video_url} title={p.title} />
          ))}
        </div>
      </div>
    </div>
  );
}
