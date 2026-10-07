import { Link, useLocation } from "react-router-dom";

const icon = {
  gallery: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="M21 15l-5.5-5.5a2 2 0 0 0-2.8 0L3 19" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M15.8 14.2c2.4.3 4.2 2.4 4.2 5" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" />
    </svg>
  ),
};

function Item({ to, label, iconKey, active }) {
  return (
    <Link to={to} className={`bottom-nav-item${active ? " is-active" : ""}`}>
      {icon[iconKey]}
      <span>{label}</span>
    </Link>
  );
}

export default function BottomNav({ profile }) {
  const location = useLocation();
  const path = location.pathname;

  if (!profile) return null;

  return (
    <nav className="bottom-nav">
      <Item to="/gallery" label="Галерея" iconKey="gallery" active={path.startsWith("/gallery")} />
      <Item to="/scan" label="Сканер" iconKey="scan" active={path.startsWith("/scan")} />
      {profile.role === "admin" ? (
        <>
          <Item to="/admin" label="Админка" iconKey="upload" active={path === "/admin"} />
          <Item to="/admin/users" label="Люди" iconKey="people" active={path === "/admin/users"} />
        </>
      ) : (
        <Item to="/upload" label="Загрузить" iconKey="upload" active={path.startsWith("/upload")} />
      )}
      <Item to="/profile" label="Профиль" iconKey="profile" active={path.startsWith("/profile")} />
    </nav>
  );
}
