-- Bug-Lizzer Planning · 018: snackies (any number per person per day: leftovers, a recipe, out, or scanned)
alter table public.meal_plan drop constraint if exists meal_plan_meal_check;
alter table public.meal_plan add constraint meal_plan_meal_check check (meal in ('breakfast','lunch','dinner','snack','scan'));
