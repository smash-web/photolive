import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ClientGalleryPage from "./pages/ClientGalleryPage";
import ArScanPage from "./pages/ArScanPage";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: "flex", gap: 16, padding: 16, borderBottom: "1px solid #eee" }}>
        <Link to="/login">Вход</Link>
        <Link to="/admin">Админка</Link>
        <Link to="/gallery">Моя галерея</Link>
        <Link to="/scan">Сканер (AR)</Link>
      </nav>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/gallery" element={<ClientGalleryPage />} />
        <Route path="/gallery/:token" element={<ClientGalleryPage />} />
        <Route path="/scan" element={<ArScanPage />} />
        <Route path="/scan/:token" element={<ArScanPage />} />
      </Routes>
    </BrowserRouter>
  );
}
