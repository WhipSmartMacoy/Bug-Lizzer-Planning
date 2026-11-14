-- Bug-Lizzer Planning · 029: remember the unit someone picked for an At Home item (e.g. "ml"), so
-- 300 ml shows as 300 ml rather than being converted to cups or packages.
alter table public.pantry add column if not exists unit_label text;
