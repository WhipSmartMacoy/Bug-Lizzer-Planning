-- Bug-Lizzer Planning · 009: your usual Fairway items
-- A copy of the household's Fairway "Past Purchases" list (loyalty card), ranked by how often it's bought.
-- Used to read receipt abbreviations and for one-tap "add to At Home". No dates or quantities are kept.
create table if not exists public.fairway_usuals (
  name     text primary key,
  price    text,
  rank     int,
  added_at timestamptz not null default now()
);
alter table public.fairway_usuals enable row level security;
drop policy if exists "members read usuals" on public.fairway_usuals;
drop policy if exists "members write usuals" on public.fairway_usuals;
create policy "members read usuals"  on public.fairway_usuals for select using (public.is_member());
create policy "members write usuals" on public.fairway_usuals for all    using (public.is_member()) with check (public.is_member());
