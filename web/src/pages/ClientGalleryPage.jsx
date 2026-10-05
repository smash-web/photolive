import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMyGallery, fetchGalleryByToken } from "../lib/api";
import HoverPlayPhoto from "../components/HoverPlayPhoto";

export default function ClientGalleryPage() {
  const { token } = useParams();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = token ? () => fetchGalleryByToken(token) : fetchMyGallery;
    load().then(setItems).catch((e) => setError(e.message));
  }, [token]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Ваши фото</h2>
      {!token && (
        <p style={{ fontSize: 13 }}>
          Хотите оживить фото прямо через камеру? <Link to="/scan">Открыть сканер</Link>
        </p>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {items.map((item) => (
          <HoverPlayPhoto key={item.id} photoUrl={item.photo_url} videoUrl={item.video_url} title={item.title} />
        ))}
      </div>
      {items.length === 0 && !error && <p>Пока нет загруженных фото.</p>}
    </div>
  );
}
