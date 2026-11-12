-- Bug-Lizzer Planning · 016: estimated nutrition for meals out
-- note = what was had ("chicken burrito"); nutrition = estimate from USDA FoodData Central typical portions.
alter table public.meal_plan add column if not exists nutrition jsonb;
