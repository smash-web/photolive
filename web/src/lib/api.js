import { supabase } from "../supabaseClient";
import { compileTargets } from "./mindCompiler";

// ============================================================
// Больше нет отдельного Python/FastAPI бэкенда — все операции идут
// напрямую в Supabase (Postgres + Storage) из браузера, права
// ограничены через RLS-политики (см. supabase/schema.sql).
// ============================================================

function photoUrl(path) {
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
function videoUrl(path) {
  return supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
}
function targetUrl(path) {
  return supabase.storage.from("targets").getPublicUrl(path).data.publicUrl;
}

async function myProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Не авторизован");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", auth.user.id)
    .single();
  if (error) throw error;
  return data;
}

// ---------- галерея ----------

export async function fetchMyGallery() {
  const profile = await myProfile();
  let query = supabase.from("pairs").select("*");
  if (profile.role === "admin") {
    query = query.or(`client_id.is.null,client_id.eq.${profile.id}`);
  } else {
    query = query.eq("client_id", profile.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    title: p.title,
    photo_url: photoUrl(p.photo_path),
    video_url: videoUrl(p.video_path),
  }));
}

export async function fetchGalleryByToken(token) {
  const { data, error } = await supabase.rpc("get_gallery_by_token", { p_token: token });
  if (error) throw error;
  return data.map((p) => ({
    id: p.pair_id,
    title: p.title,
    photo_url: photoUrl(p.photo_path),
    video_url: videoUrl(p.video_path),
  }));
}

// ---------- AR-цели (.mind) ----------

export async function fetchClientTargets(token) {
  let targetRow, pairs;
  if (token) {
    const { data, error } = await supabase.rpc("get_targets_by_token", { p_token: token });
    if (error) throw error;
    targetRow = data?.[0];
    const { data: gallery } = await supabase.rpc("get_gallery_by_token", { p_token: token });
    pairs = gallery || [];
  } else {
    const profile = await myProfile();
    const { data, error } = await supabase
      .from("client_targets")
      .select("*")
      .eq("client_id", profile.id)
      .maybeSingle();
    if (error) throw error;
    targetRow = data;
    const { data: gallery } = await supabase.from("pairs").select("*").eq("client_id", profile.id);
    pairs = gallery || [];
  }

  if (!targetRow) return { targetUrl: null, pairOrder: [], videoUrls: [] };

  const pairsById = Object.fromEntries(pairs.map((p) => [p.pair_id || p.id, p]));
  const videoUrls = targetRow.pair_order.map((pairId) => {
    const p = pairsById[pairId];
    return p ? videoUrl(p.video_path) : null;
  });

  return {
    targetUrl: targetUrl(targetRow.target_path),
    pairOrder: targetRow.pair_order,
    videoUrls,
  };
}

// пересобирает общий .mind-файл клиента из ВСЕХ его текущих фото.
// вызывается после каждой загрузки/удаления пары, привязанной к клиенту.
async function recompileClientTargets(clientId) {
  if (!clientId) return; // пары без клиента не участвуют в AR-сканере

  const { data: pairs, error } = await supabase.from("pairs").select("*").eq("client_id", clientId);
  if (error) throw error;

  if (!pairs.length) {
    await supabase.from("client_targets").delete().eq("client_id", clientId);
    return;
  }

  const imageUrls = pairs.map((p) => photoUrl(p.photo_path));
  const buffer = await compileTargets(imageUrls);

  const path = `${clientId}/targets.mind`;
  await supabase.storage.from("targets").upload(path, new Blob([buffer]), { upsert: true });

  await supabase.from("client_targets").upsert({
    client_id: clientId,
    target_path: path,
    pair_order: pairs.map((p) => p.id),
    updated_at: new Date().toISOString(),
  });
}

// ---------- админка ----------

export async function listAllPairsAdmin() {
  const { data, error } = await supabase.from("pairs").select("*");
  if (error) throw error;
  return data.map((p) => ({ ...p, photo_url: photoUrl(p.photo_path) }));
}

export async function createClientAdmin(displayName) {
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("profiles")
    .insert({ role: "client", display_name: displayName, access_token: token })
    .select()
    .single();
  if (error) throw error;
  return { client_id: data.id, access_token: token, gallery_link: `/gallery/${token}` };
}

export async function uploadPairAdmin({ photoFile, videoFile, clientId, title, onProgress }) {
  const pairId = crypto.randomUUID();
  const photoPath = `${pairId}/${photoFile.name}`;
  const videoPath = `${pairId}/${videoFile.name}`;

  if (onProgress) onProgress("Загружаем файлы...");
  const { error: e1 } = await supabase.storage.from("photos").upload(photoPath, photoFile);
  if (e1) throw e1;
  const { error: e2 } = await supabase.storage.from("videos").upload(videoPath, videoFile);
  if (e2) throw e2;

  const { error: e3 } = await supabase.from("pairs").insert({
    id: pairId,
    client_id: clientId || null,
    title: title || null,
    photo_path: photoPath,
    video_path: videoPath,
  });
  if (e3) throw e3;

  if (clientId) {
    if (onProgress) onProgress("Готовим распознавание для AR (может занять время)...");
    await recompileClientTargets(clientId);
  }

  return { pair_id: pairId };
}

export async function deletePairAdmin(pairId) {
  const { data: row, error: e0 } = await supabase
    .from("pairs")
    .select("photo_path, video_path, client_id")
    .eq("id", pairId)
    .single();
  if (e0) throw e0;

  await supabase.storage.from("photos").remove([row.photo_path]);
  await supabase.storage.from("videos").remove([row.video_path]);
  await supabase.from("pairs").delete().eq("id", pairId);

  if (row.client_id) {
    await recompileClientTargets(row.client_id);
  }
}
