import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ProfilePage({ profile }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (!profile) return null;

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Профиль</h1>
        </div>

        <div className="admin-card" style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 4 }}>Вы вошли как</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>
            {profile.display_name || "Без имени"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>
            {profile.role === "admin" ? "Администратор" : "Клиент"}
          </div>

          {profile.role === "admin" && (
            <button className="btn btn-ghost btn-block" style={{ marginBottom: 10 }} onClick={() => navigate("/admin/users")}>
              Пользователи и ссылки
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
