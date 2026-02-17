-- ============================================================
-- ImgPrompt – Supabase Database Schema
-- Run this entire script in the Supabase SQL Editor (one shot).
-- ============================================================

-- 1. PROFILES (linked to auth.users) ---------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'viewer' check (role in ('admin','editor','viewer')),
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. CATEGORIES -------------------------------------------
create table if not exists public.categories (
  id         serial primary key,
  name       text not null unique,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- 3. PLATFORMS --------------------------------------------
create table if not exists public.platforms (
  id         serial primary key,
  name       text not null unique,
  url        text,
  created_at timestamptz not null default now()
);

-- 4. PROMPTS ----------------------------------------------
create table if not exists public.prompts (
  id          serial primary key,
  title       text not null,
  slug        text not null unique,
  featured    boolean not null default false,
  category_id integer references public.categories(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 5. PROMPT ↔ PLATFORM junction --------------------------
create table if not exists public.prompt_platforms (
  prompt_id   integer not null references public.prompts(id) on delete cascade,
  platform_id integer not null references public.platforms(id) on delete cascade,
  primary key (prompt_id, platform_id)
);

-- 6. SLIDES -----------------------------------------------
create table if not exists public.slides (
  id          serial primary key,
  prompt_id   integer not null references public.prompts(id) on delete cascade,
  prompt_text text not null default '',
  image_url   text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Helper: get current user's role
-- ============================================================
create or replace function public.get_my_role()
returns text
language sql
stable
security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles ------------------------------------------------
alter table public.profiles enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile (non-role fields)"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.get_my_role() = 'admin');

-- categories ----------------------------------------------
alter table public.categories enable row level security;

create policy "Public read categories"
  on public.categories for select using (true);

create policy "Editors+ insert categories"
  on public.categories for insert
  with check (public.get_my_role() in ('admin','editor'));

create policy "Editors+ update categories"
  on public.categories for update
  using (public.get_my_role() in ('admin','editor'));

create policy "Editors+ delete categories"
  on public.categories for delete
  using (public.get_my_role() in ('admin','editor'));

-- platforms ------------------------------------------------
alter table public.platforms enable row level security;

create policy "Public read platforms"
  on public.platforms for select using (true);

create policy "Editors+ insert platforms"
  on public.platforms for insert
  with check (public.get_my_role() in ('admin','editor'));

create policy "Editors+ update platforms"
  on public.platforms for update
  using (public.get_my_role() in ('admin','editor'));

create policy "Editors+ delete platforms"
  on public.platforms for delete
  using (public.get_my_role() in ('admin','editor'));

-- prompts -------------------------------------------------
alter table public.prompts enable row level security;

create policy "Public read prompts"
  on public.prompts for select using (true);

create policy "Editors+ insert prompts"
  on public.prompts for insert
  with check (public.get_my_role() in ('admin','editor'));

create policy "Editors+ update prompts"
  on public.prompts for update
  using (public.get_my_role() in ('admin','editor'));

create policy "Editors+ delete prompts"
  on public.prompts for delete
  using (public.get_my_role() in ('admin','editor'));

-- prompt_platforms ----------------------------------------
alter table public.prompt_platforms enable row level security;

create policy "Public read prompt_platforms"
  on public.prompt_platforms for select using (true);

create policy "Editors+ insert prompt_platforms"
  on public.prompt_platforms for insert
  with check (public.get_my_role() in ('admin','editor'));

create policy "Editors+ delete prompt_platforms"
  on public.prompt_platforms for delete
  using (public.get_my_role() in ('admin','editor'));

-- slides --------------------------------------------------
alter table public.slides enable row level security;

create policy "Public read slides"
  on public.slides for select using (true);

create policy "Editors+ insert slides"
  on public.slides for insert
  with check (public.get_my_role() in ('admin','editor'));

create policy "Editors+ update slides"
  on public.slides for update
  using (public.get_my_role() in ('admin','editor'));

create policy "Editors+ delete slides"
  on public.slides for delete
  using (public.get_my_role() in ('admin','editor'));

-- ============================================================
-- STORAGE – prompt-images bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('prompt-images', 'prompt-images', true)
on conflict (id) do nothing;

-- Anyone can view images
create policy "Public read prompt images"
  on storage.objects for select
  using (bucket_id = 'prompt-images');

-- Authenticated users (editor+) can upload
create policy "Auth users upload prompt images"
  on storage.objects for insert
  with check (
    bucket_id = 'prompt-images'
    and auth.role() = 'authenticated'
  );

-- Authenticated users (editor+) can delete their uploads
create policy "Auth users delete prompt images"
  on storage.objects for delete
  using (
    bucket_id = 'prompt-images'
    and auth.role() = 'authenticated'
  );
