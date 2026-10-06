-- ============================================================
-- PhotoLive — схема без Python-бэкенда: всё через Supabase напрямую
-- (Auth + Postgres + Storage), доступ контролируется через RLS.
-- ============================================================

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client')) default 'client',
  display_name text,
  access_token text unique,
  created_at timestamptz default now()
);

create table pairs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references profiles(id) on delete set null,
  photo_path text not null,
  video_path text not null,
  title text,
  created_at timestamptz default now()
);

-- Один .mind-файл на клиента, содержащий ВСЕ его фото как AR-цели.
-- pair_order — id пар в том же порядке, в котором их картинки были
-- переданы в компилятор; индекс в массиве = targetIndex в MindAR.
create table client_targets (
  client_id uuid primary key references profiles(id) on delete cascade,
  target_path text not null,
  pair_order jsonb not null,
  updated_at timestamptz default now()
);

create index idx_pairs_client_id on pairs(client_id);
create index idx_profiles_access_token on profiles(access_token);

alter table profiles enable row level security;
alter table pairs enable row level security;
alter table client_targets enable row level security;

create policy "user sees own profile"
  on profiles for select
  using (auth_user_id = auth.uid());

create policy "admin manages all profiles"
  on profiles for all
  using (exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

create policy "clients see own pairs"
  on pairs for select
  using (client_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "admin manages all pairs"
  on pairs for all
  using (exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

create policy "clients see own targets"
  on client_targets for select
  using (client_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "admin manages all targets"
  on client_targets for all
  using (exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (auth_user_id, role)
  values (new.id, 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.get_gallery_by_token(p_token text)
returns table (pair_id uuid, title text, photo_path text, video_path text)
language plpgsql security definer set search_path = public as $$
declare v_client_id uuid;
begin
  select id into v_client_id from profiles where access_token = p_token and role = 'client';
  if v_client_id is null then return; end if;
  return query select p.id, p.title, p.photo_path, p.video_path from pairs p where p.client_id = v_client_id;
end; $$;

create or replace function public.get_targets_by_token(p_token text)
returns table (target_path text, pair_order jsonb)
language plpgsql security definer set search_path = public as $$
declare v_client_id uuid;
begin
  select id into v_client_id from profiles where access_token = p_token and role = 'client';
  if v_client_id is null then return; end if;
  return query select ct.target_path, ct.pair_order from client_targets ct where ct.client_id = v_client_id;
end; $$;

-- Storage: buckets photos / videos / targets — создать как PUBLIC
-- в интерфейсе Storage, затем выполнить политики ниже.
create policy "admin uploads photos" on storage.objects for insert
  with check (bucket_id in ('photos', 'videos', 'targets')
    and exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

create policy "admin updates files" on storage.objects for update
  using (bucket_id in ('photos', 'videos', 'targets')
    and exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));

create policy "admin deletes files" on storage.objects for delete
  using (bucket_id in ('photos', 'videos', 'targets')
    and exists (select 1 from profiles p where p.auth_user_id = auth.uid() and p.role = 'admin'));
