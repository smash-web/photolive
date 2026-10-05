import { supabase } from "../supabaseClient";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchMyGallery() {
  const res = await fetch(`${API_BASE}/gallery/me`, { headers: await authHeader() });
  if (!res.ok) throw new Error("Не удалось загрузить галерею");
  return res.json();
}

export async function fetchGalleryByToken(token) {
  const res = await fetch(`${API_BASE}/gallery/token/${token}`);
  if (!res.ok) throw new Error("Ссылка недействительна");
  return res.json();
}

export async function fetchGalleryFeatures(token) {
  const url = token ? `${API_BASE}/gallery/features?token=${token}` : `${API_BASE}/gallery/features`;
  const res = await fetch(url, { headers: token ? {} : await authHeader() });
  if (!res.ok) throw new Error("Не удалось загрузить данные для распознавания");
  return res.json();
}

export async function listAllPairsAdmin() {
  const res = await fetch(`${API_BASE}/admin/pairs`, { headers: await authHeader() });
  if (!res.ok) throw new Error("Ошибка загрузки списка");
  return res.json();
}

export async function createClientAdmin(displayName) {
  const form = new FormData();
  form.append("display_name", displayName);
  const res = await fetch(`${API_BASE}/admin/clients`, {
    method: "POST",
    headers: await authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error("Не удалось создать клиента");
  return res.json();
}

export async function uploadPairAdmin({ photoFile, videoFile, clientId, title }) {
  const form = new FormData();
  form.append("photo", photoFile);
  form.append("video", videoFile);
  if (clientId) form.append("client_id", clientId);
  if (title) form.append("title", title);
  const res = await fetch(`${API_BASE}/admin/pairs`, {
    method: "POST",
    headers: await authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error("Не удалось загрузить пару фото+видео");
  return res.json();
}

export async function recognizeFrame({ blob, token }) {
  const form = new FormData();
  form.append("frame", blob, "frame.jpg");
  if (token) form.append("token", token);
  const res = await fetch(`${API_BASE}/recognize`, {
    method: "POST",
    headers: token ? {} : await authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error("Ошибка распознавания");
  return res.json();
}
