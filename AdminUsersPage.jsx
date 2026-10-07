import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListProfiles, adminDeleteProfile } from "../lib/api";

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListProfiles();
      setProfiles(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const handleDelete = async (p) => {
    const label = p.email || p.display_name || "этого пользователя";
    if (!window.confirm(`Удалить ${label}? Будут удалены все его фото, видео и доступ по ссылке. Отменить это нельзя.`)) return;
    setBusyId(p.id);
    setError(null);
    try {
      await adminDeleteProfile(p.id);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Пользователи и ссылки</h1>
          <Link to="/admin" className="scan-cta">← Назад в админку</Link>
        </div>
        <p className="helper-text" style={{ marginTop: -16 }}>
          Здесь все, у кого есть доступ к приложению: кто зарегистрировался сам по email и кто получил доступ по сгенерированной ссылке.
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <p>Загрузка…</p>}

        {!loading && profiles.length === 0 && (
          <div className="empty-state"><p style={{ margin: 0 }}>Пока никого нет.</p></div>
        )}

        {!loading && profiles.length > 0 && (
          <div className="admin-card admin-card-wide" style={{ padding: 0, overflow: "hidden" }}>
            {profiles.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--mist)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {p.email || p.display_name || "Без имени"}
                    {p.role === "admin" && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--safelight)", fontWeight: 600 }}>админ</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                    {p.email ? "по email" : "по ссылке"} · {p.pair_count} фото
                    {p.access_token && !p.email && (
                      <>
                        {" · "}
                        <code className="code-chip" style={{ display: "inline", padding: "2px 6px" }}>
                          /gallery/{p.access_token}
                        </code>
                      </>
                    )}
                  </div>
                </div>
                {p.role !== "admin" && (
                  <button className="btn-danger-text" disabled={busyId === p.id} onClick={() => handleDelete(p)}>
                    {busyId === p.id ? "Удаление…" : "Удалить"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
