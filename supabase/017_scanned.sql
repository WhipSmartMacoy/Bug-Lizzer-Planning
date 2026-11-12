-- Bug-Lizzer Planning · 017: scanned meals
-- A scanned package (barcode → Open Food Facts) logged for one person on a day.
-- meal = 'scan'; slot = breakfast / lunch / dinner / snack; note = product name; nutrition = for the amount eaten.
alter table public.meal_plan add column if not exists slot text;
alter table public.meal_plan drop constraint if exists meal_plan_meal_check;
alter table public.meal_plan add constraint meal_plan_meal_check check (meal in ('breakfast','lunch','dinner','scan'));
