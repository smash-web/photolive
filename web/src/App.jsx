import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ClientGalleryPage from "./pages/ClientGalleryPage";
import ScanPage from "./pages/ScanPage";
import ArScanPage from "./pages/ArScanPage";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: "flex", gap: 16, padding: 16, borderBottom: "1px solid #eee" }}>
        <Link to="/login">Вход</Link>
        <Link to="/admin">Админка</Link>
        <Link to="/gallery">Моя галерея</Link>
        <Link to="/scan">Сканер (простой)</Link>
        <Link to="/scan/ar">Сканер (AR)</Link>
      </nav>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/gallery" element={<ClientGalleryPage />} />
        <Route path="/gallery/:token" element={<ClientGalleryPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/scan/:token" element={<ScanPage />} />
        <Route path="/scan/ar" element={<ArScanPage />} />
        <Route path="/scan/ar/:token" element={<ArScanPage />} />
      </Routes>
    </BrowserRouter>
  );
}
