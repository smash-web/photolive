import { useEffect, useState } from "react";
import { listAllPairsAdmin, uploadPairAdmin, createClientAdmin } from "../lib/api";

export default function AdminPage() {
  const [pairs, setPairs] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [lastClient, setLastClient] = useState(null);
  const [status, setStatus] = useState(null);

  const refresh = () => listAllPairsAdmin().then(setPairs).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setStatus("Загрузка и анализ фото...");
    try {
      await uploadPairAdmin({ photoFile, videoFile, clientId: clientId || null, title });
      setStatus("Готово!");
      setPhotoFile(null);
      setVideoFile(null);
      setTitle("");
      refresh();
    } catch (err) {
      setStatus(`Ошибка: ${err.message}`);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    const res = await createClientAdmin(newClientName);
    setLastClient({
      id: res.client_id,
      link: `${window.location.origin}${res.gallery_link}`,
    });
    setClientId(res.client_id);
    setNewClientName("");
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 32, maxWidth: 700 }}>
      <section>
        <h2>Создать клиента и получить ссылку</h2>
        <form onSubmit={handleCreateClient} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Имя клиента" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
          <button type="submit">Сгенерировать ссылку</button>
        </form>
        {lastClient && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <p>
              Ссылка для клиента: <a href={lastClient.link}>{lastClient.link}</a>
            </p>
            <p>
              ID клиента (уже подставлен в поле "ID клиента" ниже):<br />
              <code style={{ userSelect: "all", background: "#f0f0f0", padding: 4 }}>{lastClient.id}</code>
            </p>
          </div>
        )}
      </section>

      <section>
        <h2>Загрузить фото + видео</h2>
        <form onSubmit={handleUpload} style={{ display: "grid", gap: 8 }}>
          <label>Фото: <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} required /></label>
          <label>Видео: <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} required /></label>
          <input placeholder="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="ID клиента (необязательно — можно привязать позже)" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <button type="submit">Загрузить</button>
        </form>
        {status && <p>{status}</p>}
      </section>

      <section>
        <h2>Все загруженные пары</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {pairs.map((p) => (
            <div key={p.id} style={{ width: 140 }}>
              <img src={p.photo_url} alt={p.title} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />
              <p style={{ fontSize: 12 }}>{p.title || "(без названия)"}</p>
              <p style={{ fontSize: 10, color: "#888", wordBreak: "break-all" }}>
                {p.client_id ? <span style={{ userSelect: "all" }}>{p.client_id}</span> : "не привязано"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
