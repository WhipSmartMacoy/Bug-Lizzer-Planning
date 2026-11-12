-- Bug-Lizzer Planning · 010: leftovers
-- We cook dinner for 2. A recipe that serves more leaves leftovers:
--   lunches      = how many lunches (2 servings each) were taken from this cooked meal
--   leftover_of  = this dinner is leftovers of another planned meal (nothing to shop for or cook)
alter table public.meal_plan add column if not exists lunches int not null default 0;
alter table public.meal_plan add column if not exists leftover_of bigint references public.meal_plan(id) on delete cascade;
