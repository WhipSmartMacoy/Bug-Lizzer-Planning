-- Bug-Lizzer Planning · 012: how many servings were actually left after a meal
-- Set by tapping "How much is left?" on a cooked meal (e.g. a "serves 4 to 6" recipe leaves 2, 3 or 4).
-- Empty = assume the low end of the recipe's servings.
alter table public.meal_plan add column if not exists left_after int;
