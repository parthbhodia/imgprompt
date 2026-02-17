-- ============================================================
-- Likes & Favorites migration
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Likes (thumbs up) – one per user per prompt
create table if not exists public.likes (
  user_id   uuid not null references auth.users(id) on delete cascade,
  prompt_id integer not null references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

-- Favorites (bookmarks) – one per user per prompt
create table if not exists public.favorites (
  user_id   uuid not null references auth.users(id) on delete cascade,
  prompt_id integer not null references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

-- Materialized like count on prompts for fast sorting
alter table public.prompts add column if not exists like_count integer not null default 0;

-- Function to recount likes for a prompt
create or replace function public.refresh_like_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (TG_OP = 'DELETE') then
    update public.prompts
      set like_count = (select count(*) from public.likes where prompt_id = OLD.prompt_id)
      where id = OLD.prompt_id;
    return OLD;
  else
    update public.prompts
      set like_count = (select count(*) from public.likes where prompt_id = NEW.prompt_id)
      where id = NEW.prompt_id;
    return NEW;
  end if;
end;
$$;

drop trigger if exists on_like_change on public.likes;
create trigger on_like_change
  after insert or delete on public.likes
  for each row execute function public.refresh_like_count();

-- RLS for likes
alter table public.likes enable row level security;

create policy "Anyone can read likes"
  on public.likes for select using (true);

create policy "Authenticated users can insert own likes"
  on public.likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on public.likes for delete
  using (auth.uid() = user_id);

-- RLS for favorites
alter table public.favorites enable row level security;

create policy "Users can read own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Authenticated users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);
