// Весь доступ к данным идёт напрямую в Supabase (без Python-бэкенда).
// Права разграничены через RLS-политики в базе (см. supabase/schema.sql).
import { supabase } from "../supabaseClient";
import { compileTargets } from "./mindCompiler";

const BUCKETS = { photos: "photos", videos: "videos", targets: "targets" };

function publicUrl(bucket, path) {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const photoUrl = (path) => publicUrl(BUCKETS.photos, path);
export const videoUrl = (path) => publicUrl(BUCKETS.videos, path);
export const targetUrl = (path) => publicUrl(BUCKETS.targets, path);

export async function myProfile() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (error) return null;
  return data;
}

function serializePairs(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    title: row.title,
    photo_url: photoUrl(row.photo_path),
    video_url: videoUrl(row.video_path),
    client_id: row.client_id,
  }));
}

export async function fetchMyGallery() {
  const profile = await myProfile();
  if (!profile) throw new Error("Не удалось определить ваш профиль");

  let query = supabase.from("pairs").select("*");
  if (profile.role === "admin") {
    // удобство для тестирования: админ видит и свои тестовые
    // загрузки без клиента, и явно привязанные ему самому
    query = query.or(`client_id.is.null,client_id.eq.${profile.id}`);
  } else {
    query = query.eq("client_id", profile.id);
  }
  const { data, error } = await query;
  if (error) throw new Error("Не удалось загрузить галерею: " + error.message);
  return serializePairs(data);
}

export async function fetchGalleryByToken(token) {
  const { data, error } = await supabase.rpc("get_gallery_by_token", { p_token: token });
  if (error) throw new Error("Ссылка недействительна: " + error.message);
  return (data || []).map((row) => ({
    id: row.pair_id,
    title: row.title,
    photo_url: photoUrl(row.photo_path),
    video_url: videoUrl(row.video_path),
  }));
}

// Возвращает данные, нужные AR-сканеру: ссылку на .mind-файл и список
// ссылок на видео в том же порядке, в котором фото были скомпилированы
// (индекс в pairOrder = targetIndex, который даёт MindAR).
export async function fetchClientTargets(token) {
  let clientId = null;
  let targetsRow = null;

  if (token) {
    const { data, error } = await supabase.rpc("get_targets_by_token", { p_token: token });
    if (error) throw new Error("Ссылка недействительна: " + error.message);
    targetsRow = data && data[0];
  } else {
    const profile = await myProfile();
    if (!profile) throw new Error("Не удалось определить ваш профиль");
    clientId = profile.id;
    const { data, error } = await supabase
      .from("client_targets")
      .select("target_path, pair_order")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) throw new Error("Ошибка загрузки целей распознавания: " + error.message);
    targetsRow = data;
  }

  if (!targetsRow) {
    return { targetUrl: null, pairOrder: [], videoUrls: [] };
  }

  const pairOrder = targetsRow.pair_order || [];
  const { data: pairsData, error: pairsErr } = await supabase
    .from("pairs")
    .select("id, video_path")
    .in("id", pairOrder);
  if (pairsErr) throw new Error("Ошибка загрузки видео: " + pairsErr.message);

  const videoByPairId = {};
  (pairsData || []).forEach((p) => { videoByPairId[p.id] = videoUrl(p.video_path); });
  const videoUrls = pairOrder.map((id) => videoByPairId[id] || null);

  return {
    targetUrl: targetUrl(targetsRow.target_path),
    pairOrder,
    videoUrls,
  };
}

export async function listAllPairsAdmin() {
  const { data, error } = await supabase.from("pairs").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Ошибка загрузки списка: " + error.message);
  return serializePairs(data);
}

export async function createClientAdmin(displayName) {
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("profiles")
    .insert({ role: "client", display_name: displayName, access_token: token })
    .select()
    .single();
  if (error) throw new Error("Не удалось создать клиента: " + error.message);
  return { client_id: data.id, access_token: token, gallery_link: `/gallery/${token}` };
}

// Пересобирает ВЕСЬ .mind-файл клиента из всех его текущих фото —
// MindAR хранит несколько целей распознавания в одном файле, поэтому
// при любом изменении набора (добавили/удалили фото) файл нужно
// пересчитать целиком. Это может быть небыстро (компиляция идёт
// в браузере через tensorflow.js).
async function recompileClientTargets(clientId, onProgress) {
  if (!clientId) return;

  const { data: pairs, error } = await supabase
    .from("pairs")
    .select("id, photo_path")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Не удалось получить фото клиента: " + error.message);

  if (!pairs || pairs.length === 0) {
    await supabase.from("client_targets").delete().eq("client_id", clientId);
    return;
  }

  if (onProgress) onProgress("Готовим распознавание для AR (может занять время)...");
  const photoUrls = pairs.map((p) => photoUrl(p.photo_path));
  const buffer = await compileTargets(photoUrls, (progress) => {
    if (onProgress) onProgress(`Компилируем AR-цели: ${Math.round(progress)}%`);
  });

  const targetPath = `${clientId}/targets.mind`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKETS.targets)
    .upload(targetPath, new Blob([buffer]), { upsert: true, contentType: "application/octet-stream" });
  if (uploadErr) throw new Error("Не удалось загрузить .mind файл: " + uploadErr.message);

  const pairOrder = pairs.map((p) => p.id);
  const { error: upsertErr } = await supabase
    .from("client_targets")
    .upsert({ client_id: clientId, target_path: targetPath, pair_order: pairOrder, updated_at: new Date().toISOString() });
  if (upsertErr) throw new Error("Не удалось сохранить данные распознавания: " + upsertErr.message);
}

export async function uploadPairAdmin({ photoFile, videoFile, clientId, title, onProgress }) {
  if (onProgress) onProgress("Загружаем файлы...");

  // Если клиент не указан — привязываем пару к самому админу. Это нужно,
  // чтобы AR-файл распознавания (.mind) вообще пересчитывался: он
  // пересобирается только для пар, у которых ЕСТЬ client_id. Без этого
  // тестовые загрузки "без клиента" сохранялись, но никогда не попадали
  // в сканер — в сканере было бы пусто.
  let resolvedClientId = clientId || null;
  if (!resolvedClientId) {
    const profile = await myProfile();
    if (profile) resolvedClientId = profile.id;
  }

  const pairId = crypto.randomUUID();
  const photoPath = `${pairId}/${photoFile.name}`;
  const videoPath = `${pairId}/${videoFile.name}`;

  const { error: photoErr } = await supabase.storage.from(BUCKETS.photos).upload(photoPath, photoFile);
  if (photoErr) throw new Error("Не удалось загрузить фото: " + photoErr.message);

  const { error: videoErr } = await supabase.storage.from(BUCKETS.videos).upload(videoPath, videoFile);
  if (videoErr) throw new Error("Не удалось загрузить видео: " + videoErr.message);

  const { error: insertErr } = await supabase.from("pairs").insert({
    id: pairId,
    client_id: resolvedClientId,
    title: title || null,
    photo_path: photoPath,
    video_path: videoPath,
  });
  if (insertErr) throw new Error("Не удалось сохранить запись: " + insertErr.message);

  if (resolvedClientId) {
    await recompileClientTargets(resolvedClientId, onProgress);
  }

  if (onProgress) onProgress("Готово!");
  return { pair_id: pairId };
}

export async function deletePairAdmin(pairId) {
  const { data: row, error: fetchErr } = await supabase
    .from("pairs")
    .select("photo_path, video_path, client_id")
    .eq("id", pairId)
    .single();
  if (fetchErr) throw new Error("Пара не найдена: " + fetchErr.message);

  await supabase.storage.from(BUCKETS.photos).remove([row.photo_path]);
  await supabase.storage.from(BUCKETS.videos).remove([row.video_path]);
  const { error: deleteErr } = await supabase.from("pairs").delete().eq("id", pairId);
  if (deleteErr) throw new Error("Не удалось удалить: " + deleteErr.message);

  if (row.client_id) {
    await recompileClientTargets(row.client_id);
  }

  return { deleted: pairId };
}
