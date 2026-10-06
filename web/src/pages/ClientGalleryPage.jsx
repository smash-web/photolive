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
    <div style={{ padding: 24 }}>
      <h2>Моя галерея</h2>
      <p>
        <Link to={token ? `/scan/${token}` : "/scan"}>Открыть AR-сканер →</Link>
      </p>
      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && !error && pairs.length === 0 && <p>Пока нет фото.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {pairs.map((p) => (
          <HoverPlayPhoto key={p.id} photoUrl={p.photo_url} videoUrl={p.video_url} title={p.title} />
        ))}
      </div>
    </div>
  );
}
