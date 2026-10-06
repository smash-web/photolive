-- ============================================================
-- Миграция для уже существующего проекта Supabase (с данными):
-- добавляет только то, что нужно для MindAR, ничего не удаляя.
-- Выполнить целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

create table if not exists client_targets (
  client_id uuid primary key references profiles(id) on delete cascade,
  target_path text not null,
  pair_order jsonb not null,
  updated_at timestamptz default now()
);

alter table client_targets enable row level security;

drop policy if exists "clients see own targets" on client_targets;
create policy "clients see own targets"
  on client_targets for select
  using (client_id in (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "admin manages all targets" on client_targets;
create policy "admin manages all targets"
  on client_targets for all
  using (exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

create or replace function public.get_targets_by_token(p_token text)
returns table (target_path text, pair_order jsonb)
language plpgsql security definer set search_path = public as $$
declare v_client_id uuid;
begin
  select id into v_client_id from profiles where access_token = p_token and role = 'client';
  if v_client_id is null then return; end if;
  return query select ct.target_path, ct.pair_order from client_targets ct where ct.client_id = v_client_id;
end; $$;

create or replace function public.get_gallery_by_token(p_token text)
returns table (pair_id uuid, title text, photo_path text, video_path text)
language plpgsql security definer set search_path = public as $$
declare v_client_id uuid;
begin
  select id into v_client_id from profiles where access_token = p_token and role = 'client';
  if v_client_id is null then return; end if;
  return query select p.id, p.title, p.photo_path, p.video_path from pairs p where p.client_id = v_client_id;
end; $$;

-- Политики для бакета "targets" (создайте его в Storage -> New bucket,
-- отметьте Public). Бакеты photos и videos тоже должны быть Public —
-- измените это в Storage -> (бакет) -> Edit bucket, если ещё Private.

drop policy if exists "admin uploads photos" on storage.objects;
create policy "admin uploads photos" on storage.objects for insert
  with check (bucket_id in ('photos', 'videos', 'targets')
    and exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin updates files" on storage.objects;
create policy "admin updates files" on storage.objects for update
  using (bucket_id in ('photos', 'videos', 'targets')
    and exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin deletes files" on storage.objects;
create policy "admin deletes files" on storage.objects for delete
  using (bucket_id in ('photos', 'videos', 'targets')
    and exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));
