-- Bug-Lizzer Planning: where each item at home is kept.
alter table public.pantry add column if not exists location text;
alter table public.pantry drop constraint if exists pantry_location_check;
alter table public.pantry add constraint pantry_location_check check (location is null or location in ('pantry','fridge','freezer'));
