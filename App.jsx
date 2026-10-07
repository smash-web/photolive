import { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { myProfile } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import UploadPage from "./pages/UploadPage";
import ClientGalleryPage from "./pages/ClientGalleryPage";
import ArScanPage from "./pages/ArScanPage";

function useProfile() {
  const [profile, setProfile] = useState(undefined); // undefined = ещё грузится, null = не вошёл

  useEffect(() => {
    let active = true;
    const load = async () => {
      const p = await myProfile();
      if (active) setProfile(p);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return profile;
}

function RequireAdmin({ profile, children }) {
  if (profile === undefined) return null;
  if (!profile || profile.role !== "admin") return <Navigate to="/gallery" replace />;
  return children;
}

function RequireAuth({ profile, children }) {
  if (profile === undefined) return null;
  if (!profile) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const profile = useProfile();
  const location = useLocation();
  const isScanRoute = location.pathname.startsWith("/scan");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {!isScanRoute && (
        <header className="topnav">
          <div className="topnav-inner">
            <Link to="/" className="brand">
              Живое<span className="brand-dot">.</span>Фото
            </Link>
            <nav className="nav-links">
              {profile && (
                <>
                  <Link to="/gallery" className="nav-link">Моя галерея</Link>
                  <Link to="/scan" className="nav-link">Сканер (AR)</Link>
                  {profile.role === "admin" ? (
                    <>
                      <Link to="/admin" className="nav-link">Админка</Link>
                      <Link to="/admin/users" className="nav-link">Пользователи</Link>
                    </>
                  ) : (
                    <Link to="/upload" className="nav-link">Загрузить</Link>
                  )}
                </>
              )}
              {profile === null && (
                <Link to="/login" className="nav-link nav-cta">Войти</Link>
              )}
              {profile && (
                <button onClick={handleLogout} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer" }}>
                  Выйти
                </button>
              )}
            </nav>
          </div>
        </header>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin profile={profile}>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin profile={profile}>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/upload"
          element={
            <RequireAuth profile={profile}>
              <UploadPage />
            </RequireAuth>
          }
        />
        <Route path="/gallery" element={<ClientGalleryPage />} />
        <Route path="/gallery/:token" element={<ClientGalleryPage />} />
        <Route path="/scan" element={<ArScanPage />} />
        <Route path="/scan/:token" element={<ArScanPage />} />
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </>
  );
}
