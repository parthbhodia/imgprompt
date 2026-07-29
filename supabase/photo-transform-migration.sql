-- ImgPrompt photo-transform pivot:
-- packs, prompt previews, before images, premium flag.
-- Apply in Supabase SQL editor (or CLI) against the ImgPrompt project.

-- 1. Prompt premium flag -------------------------------------------------
alter table public.prompts
  add column if not exists is_premium boolean not null default true;

-- 2. Slide preview + before image ----------------------------------------
alter table public.slides
  add column if not exists prompt_preview text not null default '';

alter table public.slides
  add column if not exists before_image_url text not null default '';

-- Backfill previews from existing prompt text (first ~120 chars)
update public.slides
set prompt_preview = case
  when char_length(prompt_text) <= 120 then prompt_text
  else left(prompt_text, 117) || '...'
end
where prompt_preview = '' and prompt_text <> '';

-- 3. Packs ---------------------------------------------------------------
create table if not exists public.packs (
  id               serial primary key,
  name             text not null,
  slug             text not null unique,
  description      text not null default '',
  cover_image_url  text not null default '',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.prompt_packs (
  prompt_id integer not null references public.prompts(id) on delete cascade,
  pack_id   integer not null references public.packs(id) on delete cascade,
  primary key (prompt_id, pack_id)
);

alter table public.packs enable row level security;
alter table public.prompt_packs enable row level security;

drop policy if exists "Public read packs" on public.packs;
create policy "Public read packs"
  on public.packs for select using (true);

drop policy if exists "Editors+ insert packs" on public.packs;
create policy "Editors+ insert packs"
  on public.packs for insert
  with check (public.get_my_role() in ('admin','editor'));

drop policy if exists "Editors+ update packs" on public.packs;
create policy "Editors+ update packs"
  on public.packs for update
  using (public.get_my_role() in ('admin','editor'));

drop policy if exists "Editors+ delete packs" on public.packs;
create policy "Editors+ delete packs"
  on public.packs for delete
  using (public.get_my_role() in ('admin','editor'));

drop policy if exists "Public read prompt_packs" on public.prompt_packs;
create policy "Public read prompt_packs"
  on public.prompt_packs for select using (true);

drop policy if exists "Editors+ insert prompt_packs" on public.prompt_packs;
create policy "Editors+ insert prompt_packs"
  on public.prompt_packs for insert
  with check (public.get_my_role() in ('admin','editor'));

drop policy if exists "Editors+ update prompt_packs" on public.prompt_packs;
create policy "Editors+ update prompt_packs"
  on public.prompt_packs for update
  using (public.get_my_role() in ('admin','editor'));

drop policy if exists "Editors+ delete prompt_packs" on public.prompt_packs;
create policy "Editors+ delete prompt_packs"
  on public.prompt_packs for delete
  using (public.get_my_role() in ('admin','editor'));

-- 4. Seed packs from common niches ---------------------------------------
insert into public.packs (name, slug, description, sort_order)
values
  ('Portrait Looks', 'portrait', 'Headshots and portrait transforms for your photo', 1),
  ('IG Trends', 'ig-trends', 'Viral social-media photo transforms', 2),
  ('Wedding & Couples', 'wedding', 'Romantic looks for couple and wedding photos', 3),
  ('Product Shots', 'product', 'Premium product and ecom photo transforms', 4),
  ('Creative Styles', 'creative', 'Artistic style transfers for any photo', 5)
on conflict (slug) do nothing;

-- Attach prompts to packs by category name (best-effort)
insert into public.prompt_packs (prompt_id, pack_id)
select p.id, pk.id
from public.prompts p
join public.categories c on c.id = p.category_id
join public.packs pk on (
  (pk.slug = 'portrait' and c.slug ilike '%portrait%')
  or (pk.slug = 'ig-trends' and (c.slug ilike '%social%' or c.name ilike '%social%'))
  or (pk.slug = 'wedding' and (c.slug ilike '%wedding%' or c.name ilike '%wedding%'))
  or (pk.slug = 'product' and (c.slug ilike '%product%' or c.name ilike '%product%'))
  or (pk.slug = 'creative' and (
    c.slug ilike '%art%' or c.slug ilike '%style%' or c.slug ilike '%creative%'
    or c.name ilike '%art%' or c.name ilike '%style%' or c.name ilike '%creative%'
  ))
)
on conflict do nothing;
