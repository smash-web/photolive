-- Профили: и админ, и зарегистрированные клиенты
create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client')) default 'client',
  display_name text,
  access_token text unique,
  created_at timestamptz default now()
);

-- Пары фото+видео
create table pairs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references profiles(id) on delete set null,
  photo_path text not null,
  video_path text not null,
  photo_descriptors jsonb,
  title text,
  created_at timestamptz default now()
);

create index idx_pairs_client_id on pairs(client_id);
create index idx_profiles_access_token on profiles(access_token);

alter table pairs enable row level security;
alter table profiles enable row level security;

create policy "clients see own pairs"
  on pairs for select
  using (
    client_id in (select id from profiles where auth_user_id = auth.uid())
  );

create policy "admin sees all pairs"
  on pairs for all
  using (
    exists (select 1 from profiles where auth_user_id = auth.uid() and role = 'admin')
  );

create policy "user sees own profile"
  on profiles for select
  using (auth_user_id = auth.uid());
