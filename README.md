# Bug-Lizzer Planning

Household hub. It starts with the **Kitchen** and will grow to cover tasks, bills and more.

Live: https://whipsmartmacoy.github.io/Bug-Lizzer-Planning/ (sign in by email; an admin approves new members)

## Kitchen
- **Recipe box:** choose **New recipe** (not cooked yet) or **Past recipe** (cooked before), then paste a recipe link to add it. Cooking a new recipe moves it to Past. The box keeps only the title, a link to the photo, and plain ingredient names, and always links back to the original. No amounts or steps are copied.
- **Plan & shop:** plan one week at a time by putting recipes on days. The shopping list covers just that week, grouped by the day each ingredient is first needed, with Fairway prices.
- **What we use most:** ingredients counted only from meals that were planned or cooked.
- **Use it up / Discover:** recipes in the box that use what's in the fridge or what you already buy.
- **Who did what:** activity feed and members.

### Rules
- No made-up recipes, and nothing is preloaded. Recipes come only from links the household adds.
- Prices are kept per ingredient. They come from https://shop.fairwaymarket.com/store/fairway/storefront or are entered by a household member. The view `ingredients_needing_price` lists what still needs one; Claude fills those in when recipes are added.

### Setup (Supabase)
Run in order in the SQL editor: `supabase/setup.sql`, `supabase/002_weekly_plan.sql`, `supabase/003_recipe_box.sql`, `supabase/004_new_vs_past.sql`, `005_servings.sql`, `006_price_refresh.sql`.
Edge functions: `supabase/functions/import-recipe` and `supabase/functions/refresh-prices` (JWT verification off; the function checks membership itself).
