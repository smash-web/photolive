"""
Backend API.

Роуты:
  POST /admin/pairs            — загрузить фото+видео (только админ)
  POST /admin/clients          — создать клиента + сгенерировать access_token (ссылку)
  GET  /admin/pairs            — список всех пар (только админ)
  GET  /gallery/me             — галерея зарегистрированного клиента (по JWT)
  GET  /gallery/token/{token}  — галерея по прямой ссылке, без логина
  POST /recognize              — кадр с камеры -> найти совпадающее фото -> вернуть видео (разовый режим)
  GET  /gallery/features       — дескрипторы фото клиента для live-трекинга в браузере (режим AR)

ВАЖНО про авторизацию: Supabase с 2025 года по умолчанию подписывает
токены асимметрично (ES256), а не старым способом с общим секретом
(HS256). Поэтому здесь проверка токена идёт через JWKS (публичный
набор ключей проекта) — это работает одинаково что для старых, что
для новых проектов, не нужно вручную копировать "JWT secret".
"""

import os
import secrets
import time
import uuid

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from supabase import create_client, Client

from matcher import (
    compute_descriptors,
    serialize_descriptors,
    deserialize_descriptors,
    match_against_candidates,
)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # только на сервере! никогда во фронтенд
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

app = FastAPI(title="PhotoLive API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # сузить до домена фронтенда в проде
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- проверка JWT через JWKS (поддерживает и ES256, и старые HS256-токены) ----------

_jwks_cache = {"data": None, "fetched_at": 0}
JWKS_TTL_SECONDS = 3600


def get_jwks() -> dict:
    now = time.time()
    if _jwks_cache["data"] is None or now - _jwks_cache["fetched_at"] > JWKS_TTL_SECONDS:
        resp = httpx.get(JWKS_URL, timeout=10)
        resp.raise_for_status()
        _jwks_cache["data"] = resp.json()
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["data"]


def get_profile_from_jwt(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Нет токена авторизации")
    token = authorization.removeprefix("Bearer ")

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "ES256")
        jwks = get_jwks()
        # jose сам найдёт подходящий ключ в наборе по kid из заголовка токена
        payload = jwt.decode(token, jwks, algorithms=[alg], audience="authenticated")
    except Exception:
        raise HTTPException(401, "Невалидный токен")

    auth_user_id = payload["sub"]
    res = supabase.table("profiles").select("*").eq("auth_user_id", auth_user_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Профиль не найден")
    return res.data


def require_admin(authorization: str | None) -> dict:
    profile = get_profile_from_jwt(authorization)
    if profile["role"] != "admin":
        raise HTTPException(403, "Только для админа")
    return profile


def signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    res = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    return res["signedURL"]


# ---------- админка ----------

@app.post("/admin/clients")
def create_client(display_name: str = Form(...), authorization: str | None = Header(None)):
    require_admin(authorization)
    token = secrets.token_urlsafe(16)
    res = supabase.table("profiles").insert({
        "role": "client",
        "display_name": display_name,
        "access_token": token,
    }).execute()
    client_id = res.data[0]["id"]
    return {"client_id": client_id, "access_token": token, "gallery_link": f"/gallery/{token}"}


@app.post("/admin/pairs")
async def upload_pair(
    client_id: str | None = Form(None),
    title: str | None = Form(None),
    photo: UploadFile = File(...),
    video: UploadFile = File(...),
    authorization: str | None = Header(None),
):
    require_admin(authorization)

    photo_bytes = await photo.read()
    video_bytes = await video.read()

    pts, descriptors, img_size = compute_descriptors(photo_bytes)
    if descriptors is None:
        raise HTTPException(400, "Не удалось найти особенности на фото — попробуйте другое изображение")

    pair_id = str(uuid.uuid4())
    photo_path = f"{pair_id}/{photo.filename}"
    video_path = f"{pair_id}/{video.filename}"

    supabase.storage.from_("photos").upload(photo_path, photo_bytes)
    supabase.storage.from_("videos").upload(video_path, video_bytes)

    supabase.table("pairs").insert({
        "id": pair_id,
        "client_id": client_id,
        "title": title,
        "photo_path": photo_path,
        "video_path": video_path,
        "photo_descriptors": serialize_descriptors(pts, descriptors, img_size),
    }).execute()

    return {"pair_id": pair_id}


@app.get("/admin/pairs")
def list_all_pairs(authorization: str | None = Header(None)):
    require_admin(authorization)
    res = supabase.table("pairs").select("id, title, client_id, photo_path, video_path, created_at").execute()
    for row in res.data:
        row["photo_url"] = signed_url("photos", row["photo_path"])
        row["video_url"] = signed_url("videos", row["video_path"])
    return res.data


# ---------- галерея клиента ----------

def _serialize_gallery(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        out.append({
            "id": row["id"],
            "title": row["title"],
            "photo_url": signed_url("photos", row["photo_path"]),
            "video_url": signed_url("videos", row["video_path"]),
        })
    return out


@app.get("/gallery/me")
def gallery_me(authorization: str | None = Header(None)):
    profile = get_profile_from_jwt(authorization)
    if profile["role"] == "admin":
        # удобство для тестирования: админ видит и свои тестовые
        # загрузки без клиента, и всё, что явно привязано ему самому
        res = supabase.table("pairs").select("*") \
            .or_(f"client_id.is.null,client_id.eq.{profile['id']}").execute()
    else:
        res = supabase.table("pairs").select("*").eq("client_id", profile["id"]).execute()
    return _serialize_gallery(res.data)


@app.get("/gallery/token/{token}")
def gallery_by_token(token: str):
    profile_res = supabase.table("profiles").select("id").eq("access_token", token).single().execute()
    if not profile_res.data:
        raise HTTPException(404, "Ссылка недействительна")
    client_id = profile_res.data["id"]
    res = supabase.table("pairs").select("*").eq("client_id", client_id).execute()
    return _serialize_gallery(res.data)


# ---------- дескрипторы для live-трекинга в браузере (режим AR) ----------

@app.get("/gallery/features")
def gallery_features(token: str | None = None, authorization: str | None = Header(None)):
    if token:
        profile_res = supabase.table("profiles").select("id").eq("access_token", token).single().execute()
        if not profile_res.data:
            raise HTTPException(404, "Ссылка недействительна")
        client_id = profile_res.data["id"]
    else:
        profile = get_profile_from_jwt(authorization)
        client_id = profile["id"]

    rows = supabase.table("pairs").select("id, video_path, photo_descriptors") \
        .eq("client_id", client_id).execute().data

    out = []
    for row in rows:
        desc = row["photo_descriptors"]
        if not desc:
            continue
        out.append({
            "pair_id": row["id"],
            "video_url": signed_url("videos", row["video_path"]),
            "pts": desc["pts"],
            "shape": desc["shape"],
            "data": desc["data"],
            "img_size": desc["img_size"],
        })
    return out


# ---------- распознавание с камеры (разовый режим) ----------

@app.post("/recognize")
async def recognize(
    frame: UploadFile = File(...),
    token: str | None = Form(None),
    authorization: str | None = Header(None),
):
    if token:
        profile_res = supabase.table("profiles").select("id").eq("access_token", token).single().execute()
        if not profile_res.data:
            raise HTTPException(404, "Ссылка недействительна")
        client_id = profile_res.data["id"]
    else:
        profile = get_profile_from_jwt(authorization)
        client_id = profile["id"]

    frame_bytes = await frame.read()
    query_pts, query_desc, _ = compute_descriptors(frame_bytes)
    if query_desc is None:
        return {"match": None}

    rows = supabase.table("pairs").select("id, video_path, photo_descriptors") \
        .eq("client_id", client_id).execute().data

    candidates = []
    for row in rows:
        if not row["photo_descriptors"]:
            continue
        pts, desc = deserialize_descriptors(row["photo_descriptors"])
        candidates.append({"pair_id": row["id"], "pts": pts, "descriptors": desc})

    match_id = match_against_candidates(query_pts, query_desc, candidates)
    if not match_id:
        return {"match": None}

    matched_row = next(r for r in rows if r["id"] == match_id)
    return {"match": {"pair_id": match_id, "video_url": signed_url("videos", matched_row["video_path"])}}

