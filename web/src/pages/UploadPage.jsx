import { useEffect, useState } from "react";
import { fetchMyGallery, uploadPair, deletePair } from "../lib/api";

// Урезанная версия админки для обычных пользователей: каждый
// загружает и удаляет только свои собственные фото+видео.
export default function UploadPage() {
  const [pairs, setPairs] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      const data = await fetchMyGallery();
      setPairs(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { reload(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!photoFile || !videoFile) {
      setError("Выберите и фото, и видео");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await uploadPair({
        photoFile,
        videoFile,
        title,
        onProgress: (msg) => setStatus(msg),
      });
      setPhotoFile(null);
      setVideoFile(null);
      setTitle("");
      await reload();
    } catch (e) {
      setError(e.message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (pairId) => {
    if (!window.confirm("Удалить эту пару фото+видео?")) return;
    setError(null);
    try {
      await deletePair(pairId);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Загрузить</h1>
        </div>
        <p className="helper-text" style={{ marginTop: -16 }}>
          Добавьте пару фото+видео — она появится в вашей галерее и будет узнаваться AR-сканером.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-grid">
          <div className="admin-card admin-card-wide">
            <h2>Новая пара</h2>
            <form onSubmit={handleUpload}>
              <div className="field">
                <label>Фото</label>
                <input className="file-input" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </div>
              <div className="field">
                <label>Видео</label>
                <input className="file-input" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
              </div>
              <div className="field" style={{ marginBottom: 20 }}>
                <label>Название (необязательно)</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Загрузка…" : "Загрузить"}
              </button>
              {status && <p className="status-line">{status}</p>}
            </form>
          </div>

          <div className="admin-card admin-card-wide">
            <h2>Мои загрузки ({pairs.length})</h2>
            {pairs.length === 0 ? (
              <p className="helper-text" style={{ marginBottom: 0 }}>Пока ничего не загружено.</p>
            ) : (
              <div className="admin-pairs-grid">
                {pairs.map((p) => (
                  <div key={p.id} className="admin-pair-card">
                    <img className="admin-pair-thumb" src={p.photo_url} alt={p.title || ""} />
                    <div className="admin-pair-meta">
                      <div className="admin-pair-title">{p.title || "Без названия"}</div>
                      <button className="btn-danger-text" onClick={() => handleDelete(p.id)}>Удалить</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
