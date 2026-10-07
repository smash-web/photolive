import { useEffect, useState } from "react";
import { listAllPairsAdmin, createClientAdmin, uploadPairAdmin, deletePairAdmin } from "../lib/api";

export default function AdminPage() {
  const [pairs, setPairs] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const [newClientName, setNewClientName] = useState("");
  const [newClientLink, setNewClientLink] = useState(null);

  async function reload() {
    try {
      const data = await listAllPairsAdmin();
      setPairs(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { reload(); }, []);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await createClientAdmin(newClientName);
      setNewClientLink(res);
      setClientId(res.client_id);
      setNewClientName("");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!photoFile || !videoFile) {
      setError("Выберите и фото, и видео");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await uploadPairAdmin({
        photoFile,
        videoFile,
        clientId: clientId || null,
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
      await deletePairAdmin(pairId);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Админка</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-grid">
          <div className="admin-card">
            <h2>Создать клиента</h2>
            <form onSubmit={handleCreateClient} className="inline-form">
              <input
                className="input"
                placeholder="Имя клиента"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Создать</button>
            </form>
            {newClientLink && (
              <div className="link-result">
                <div>Ссылка на галерею клиента:</div>
                <code className="code-chip">{window.location.origin}{newClientLink.gallery_link}</code>
                <div style={{ marginTop: 10 }}>ID клиента (уже подставлен ниже в форму загрузки):</div>
                <code className="code-chip">{newClientLink.client_id}</code>
              </div>
            )}
          </div>

          <div className="admin-card">
            <h2>Загрузить фото + видео</h2>
            <form onSubmit={handleUpload}>
              <div className="field">
                <label>Фото</label>
                <input className="file-input" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </div>
              <div className="field">
                <label>Видео</label>
                <input className="file-input" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
              </div>
              <div className="field">
                <label>Название (необязательно)</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 20 }}>
                <label>ID клиента</label>
                <input
                  className="input"
                  placeholder="оставьте пустым для тестовой загрузки"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? "Загрузка…" : "Загрузить"}
              </button>
              {status && <p className="status-line">{status}</p>}
            </form>
          </div>

          <div className="admin-card admin-card-wide">
            <h2>Все пары ({pairs.length})</h2>
            <div className="admin-pairs-grid">
              {pairs.map((p) => (
                <div key={p.id} className="admin-pair-card">
                  <img className="admin-pair-thumb" src={p.photo_url} alt={p.title || ""} />
                  <div className="admin-pair-meta">
                    <div className="admin-pair-title">{p.title || "Без названия"}</div>
                    <div className="admin-pair-client">
                      {p.client_id ? "Клиент: " + p.client_id.slice(0, 8) + "…" : "Без клиента"}
                    </div>
                    <button className="btn-danger-text" onClick={() => handleDelete(p.id)}>Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
