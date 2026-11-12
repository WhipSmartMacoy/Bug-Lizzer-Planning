-- Bug-Lizzer Planning · 019: household settings (e.g. the shared iCloud calendar link)
-- Values here are readable only by approved household members — never put them in the code.
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "members read settings" on public.app_settings;
drop policy if exists "members write settings" on public.app_settings;
create policy "members read settings"  on public.app_settings for select using (public.is_member());
create policy "members write settings" on public.app_settings for all using (public.is_member()) with check (public.is_member());
-- The calendar link itself is added from the app (Settings), not in this file.
