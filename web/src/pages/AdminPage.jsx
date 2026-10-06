import { useEffect, useState } from "react";
import { listAllPairsAdmin, createClientAdmin, uploadPairAdmin, deletePairAdmin } from "../lib/api";
import { supabase } from "../supabaseClient";

export default function AdminPage() {
  const [pairs, setPairs] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [whoami, setWhoami] = useState(null);

  // ВРЕМЕННАЯ диагностика: показывает, что база данных видит про текущую
  // сессию (ваш auth id, роль, и результат проверки is_admin()). Уберём
  // после того, как разберёмся с ошибкой доступа к бакету targets.
  const checkAccess = async () => {
    const { data, error } = await supabase.rpc("whoami");
    if (error) {
      setWhoami("Ошибка проверки: " + error.message);
    } else {
      setWhoami(JSON.stringify(data));
    }
  };

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
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2>Админ-панель</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <section style={{ marginBottom: 24, padding: 12, border: "1px dashed #999", borderRadius: 8 }}>
        <button onClick={checkAccess}>Проверить права доступа (диагностика)</button>
        {whoami && <p style={{ fontSize: 13, wordBreak: "break-all" }}>{whoami}</p>}
      </section>

      <section style={{ marginBottom: 24, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <h3>Создать клиента</h3>
        <form onSubmit={handleCreateClient} style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Имя клиента"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
          />
          <button type="submit">Создать и получить ссылку</button>
        </form>
        {newClientLink && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <p>Ссылка на галерею клиента: <code>{window.location.origin}{newClientLink.gallery_link}</code></p>
            <p>ID клиента (уже вставлен в форму загрузки ниже):</p>
            <code style={{ userSelect: "all", display: "block", padding: 4, background: "#f5f5f5" }}>
              {newClientLink.client_id}
            </code>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <h3>Загрузить фото + видео</h3>
        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Фото:{" "}
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          </label>
          <label>
            Видео:{" "}
            <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
          </label>
          <input
            placeholder="Название (необязательно)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            placeholder="ID клиента (необязательно — оставьте пустым для тестовой загрузки без привязки)"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <button type="submit" disabled={busy}>{busy ? "Загрузка..." : "Загрузить"}</button>
          {status && <p style={{ fontSize: 13, color: "#555" }}>{status}</p>}
        </form>
      </section>

      <section>
        <h3>Все пары ({pairs.length})</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {pairs.map((p) => (
            <div key={p.id} style={{ width: 200, border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
              <img src={p.photo_url} alt={p.title || ""} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 4 }} />
              <p style={{ fontSize: 12, margin: "6px 0" }}>{p.title || "(без названия)"}</p>
              <p style={{ fontSize: 11, color: "#888" }}>{p.client_id ? "Клиент: " + p.client_id.slice(0, 8) + "…" : "Без клиента"}</p>
              <button onClick={() => handleDelete(p.id)} style={{ color: "red", width: "100%" }}>Удалить</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
