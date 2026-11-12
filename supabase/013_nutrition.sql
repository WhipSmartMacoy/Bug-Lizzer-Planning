-- Bug-Lizzer Planning · 013: nutrition per serving, taken from the recipe page's own data
-- { calories, protein, carbs, fat, fiber, sugar, sodium }  (g, except calories and sodium in mg)
alter table public.recipes add column if not exists nutrition jsonb;
