# Bug-Lizzer Planning

Household hub. It starts with the **Kitchen** and will grow to cover tasks, bills and more.

Live: https://whipsmartmacoy.github.io/Bug-Lizzer-Planning/ (sign in by email; an admin approves new members)

## Kitchen
- **Recipe box:** choose **New recipe** (not cooked yet) or **Past recipe** (cooked before), then paste a recipe link to add it. Cooking a new recipe moves it to Past. The box keeps only the title, a link to the photo, servings, ingredient names and how much of each is used (for leftover tracking), and always links back to the original. No amounts or steps are copied.
- **At Home:** what's on hand, sorted into fridge, freezer and pantry. Buying adds to it and cooking takes away, so leftovers count toward the next recipe.
- **Scan a receipt / our usuals:** photograph a Fairway receipt (read on the phone, no upload) or pick from our most-bought Fairway items; review, then add to At Home. Marking a meal cooked subtracts its ingredients and says what it took.
- **Plan & shop:** plan one week at a time by putting recipes on days. The shopping list covers just that week, grouped by the day each ingredient is first needed, with Fairway prices.
- **What we use most:** ingredients counted only from meals that were planned or cooked.
- **Make it now:** recipes (from the box and NYT Cooking) whose main ingredients are all At Home. **Discover:** recipes that reuse what you already buy.
- **Nutrition:** per-person macros for Amy and Parker each week, from each recipe page's per-serving nutrition (dinner = one serving each, lunch = one serving for that person).
- **Who did what:** activity feed and members.

### Rules
- No made-up recipes, and nothing is preloaded. Recipes come only from links the household adds.
- Prices are kept per ingredient. They come from https://shop.fairwaymarket.com/store/fairway/storefront or are entered by a household member. The view `ingredients_needing_price` lists what still needs one; Claude fills those in when recipes are added.

### Setup (Supabase)
Run in order in the SQL editor: `supabase/setup.sql`, `supabase/002_weekly_plan.sql`, `supabase/003_recipe_box.sql`, `supabase/004_new_vs_past.sql`, `005_servings.sql`, `006_price_refresh.sql`, `007_amounts_pantry.sql`, `008_storage_location.sql`, `009_fairway_usuals.sql`, `010_leftovers.sql`, `011_lunch.sql`, `012_left_after.sql`, `013_nutrition.sql`.
Edge functions: `supabase/functions/import-recipe` and `supabase/functions/refresh-prices` (JWT verification off; the function checks membership itself).
