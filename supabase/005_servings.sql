-- Bug-Lizzer Planning: servings as listed on the recipe's own page (e.g. "4 servings", "6 to 8").
alter table public.recipes add column if not exists servings text;
