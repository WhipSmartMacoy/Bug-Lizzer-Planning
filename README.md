# Bug-Lizzer Planning

Household hub. It starts with the **Kitchen** and will grow to cover tasks, bills and more.

## Kitchen
- **Plan & shop:** pick the week's recipes and get one combined shopping list with Fairway prices. Tick what's already at home, then share the list by link.
- **Use it up:** tap what's in the fridge to see the recipes that use it.
- **Recipes:** every recipe links to its original page. Nothing is copied here except the name and plain ingredient names, which are used for tracking.
- **What we use most:** ingredients ranked by how often the household actually cooks with them.
- **Discover:** recipes we haven't made yet that reuse ingredients we already buy.

### Rules
- No made-up recipes. Recipes come only from the household's NYT Cooking box or from sites like Serious Eats, and every one is a link to the source.
- Prices come from Fairway Market (store 4000) and are refreshed by hand.

### Data
- `data/recipes.json`: recipe links, the lists each one is on (saved, cooked, "Ham did", to try), and ingredient names
- `data/prices.json`: Fairway product, price and search link for each ingredient
- `data/cook-log.json`: record of what was made
