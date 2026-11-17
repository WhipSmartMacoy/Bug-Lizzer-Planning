-- At Home gets a Spice rack: dried herbs and spices. Fresh herbs stay in the fridge.
alter table public.pantry drop constraint if exists pantry_location_check;
alter table public.pantry add constraint pantry_location_check check (location is null or location in ('pantry','fridge','freezer','spices'));
