-- Bug-Lizzer Planning · 022: which device each person uses (set by the app when they open it)
alter table public.members add column if not exists device text;
alter table public.members add column if not exists device_seen_at timestamptz;
