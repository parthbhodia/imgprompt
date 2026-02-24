-- ============================================================
-- AI Image Chat – Supabase schema extension
-- Run in Supabase SQL Editor after schema.sql and likes-migration.sql.
-- ============================================================

-- Credits on profiles (existing table) – add column if not present
alter table public.profiles
  add column if not exists credits integer not null default 5;

comment on column public.profiles.credits is 'Credits for AI image generation; 1 per generation.';

-- Chat sessions (one per user "conversation" or continuous session)
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Chat messages (user prompt + assistant image response)
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null default '',
  image_url   text,
  created_at  timestamptz not null default now()
);

-- Image generations (audit + link to message)
create table if not exists public.image_generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid references public.chat_sessions(id) on delete set null,
  message_id    uuid references public.chat_messages(id) on delete set null,
  prompt        text not null,
  image_url     text not null,
  model         text not null default 'black-forest-labs/flux-schnell',
  credits_used  integer not null default 1,
  created_at    timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_chat_sessions_user_id on public.chat_sessions(user_id);
create index if not exists idx_chat_sessions_updated_at on public.chat_sessions(updated_at desc);
create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id);
create index if not exists idx_image_generations_user_id on public.image_generations(user_id);

-- RLS
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.image_generations enable row level security;

-- Sessions: users see only their own
create policy "Users can read own chat_sessions"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own chat_sessions"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chat_sessions"
  on public.chat_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own chat_sessions"
  on public.chat_sessions for delete
  using (auth.uid() = user_id);

-- Messages: via session ownership
create policy "Users can read messages of own sessions"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert messages into own sessions"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can delete messages of own sessions"
  on public.chat_messages for delete
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Image generations: users see only their own (backend also inserts with service role)
create policy "Users can read own image_generations"
  on public.image_generations for select
  using (auth.uid() = user_id);

-- Backend (service role) will insert/update; no user insert policy for image_generations from client
-- So we allow insert only from service role or via backend. For RLS, allow authenticated insert for user_id = auth.uid()
create policy "Users can insert own image_generations"
  on public.image_generations for insert
  with check (auth.uid() = user_id);

-- Allow backend to update profiles.credits via service role; for anon/authenticated we don't expose update on credits from client
-- (Credits are updated only by the FastAPI backend using service role.)

-- Optional: function to refresh session updated_at when a message is added
create or replace function public.chat_session_touch()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.chat_sessions
  set updated_at = now()
  where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists on_chat_message_insert on public.chat_messages;
create trigger on_chat_message_insert
  after insert on public.chat_messages
  for each row execute function public.chat_session_touch();
