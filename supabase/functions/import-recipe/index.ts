// Supabase Edge Function: import-recipe
// Given a recipe URL, returns { title, image, site, ingredients[] } where ingredients are
// plain ingredient NAMES only (no quantities or steps are copied). Only approved household
// members can call it.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Longest names first so "chicken broth" wins over "chicken", etc.
const KW: [string, string][] = ([
  ["rotisserie chicken","rotisserie chicken"],["chicken breast","chicken breast"],["chicken thigh","chicken"],
  ["ground chicken","ground chicken"],["ground turkey","ground turkey"],["ground beef","ground beef"],["ground pork","ground pork"],
  ["chicken broth","broth"],["chicken stock","broth"],["vegetable broth","broth"],["vegetable stock","broth"],["beef broth","broth"],
  ["broth","broth"],["stock","broth"],["chicken","chicken"],["pork","pork"],["bacon","bacon"],["sausage","sausage"],["prosciutto","prosciutto"],
  ["flank steak","flank steak"],["skirt steak","flank steak"],["steak","steak"],["beef","beef"],["lamb","lamb"],
  ["salmon","salmon"],["tuna","tuna"],["shrimp","shrimp"],["cod","cod"],["crab","crab"],["anchov","anchovies"],["scallop","scallops"],["mussel","mussels"],
  ["tofu","tofu"],["tempeh","tempeh"],["egg","eggs"],
  ["halloumi","halloumi"],["feta","feta"],["parmigiano","parmesan"],["parmesan","parmesan"],["pecorino","pecorino"],["mozzarella","mozzarella"],
  ["gruyère","gruyere"],["gruyere","gruyere"],["cheddar","cheddar"],["cottage cheese","cottage cheese"],["ricotta","ricotta"],["cream cheese","cream cheese"],
  ["goat cheese","goat cheese"],["cotija","cotija"],["monterey jack","monterey jack"],["fontina","fontina"],
  ["greek yogurt","yogurt"],["yogurt","yogurt"],["heavy cream","heavy cream"],["sour cream","sour cream"],["coconut milk","coconut milk"],
  ["buttermilk","buttermilk"],["milk","milk"],["butter","butter"],
  ["gnocchi","gnocchi"],["orzo","orzo"],["couscous","couscous"],["farro","farro"],["quinoa","quinoa"],["rice vinegar","rice vinegar"],["rice noodle","rice noodles"],
  ["rice","rice"],["spaghetti","spaghetti"],["linguine","linguine"],["bucatini","bucatini"],["rigatoni","short pasta"],["penne","short pasta"],["orecchiette","short pasta"],
  ["pastina","pastina"],["noodle","noodles"],["ramen","noodles"],["udon","noodles"],["pasta","pasta"],["tortilla","tortillas"],["pita","pita"],
  ["puff pastry","puff pastry"],["dumpling","dumplings"],["panko","panko"],["breadcrumb","breadcrumbs"],["bread","bread"],["baguette","bread"],
  ["all-purpose flour","flour"],["flour","flour"],["cornstarch","cornstarch"],["baking soda","baking soda"],["baking powder","baking powder"],
  ["chickpea","chickpeas"],["garbanzo","chickpeas"],["cannellini","white beans"],["white bean","white beans"],["black bean","black beans"],
  ["kidney bean","kidney beans"],["lentil","lentils"],["edamame","edamame"],["snap pea","sugar snap peas"],["snow pea","snow peas"],["peas","peas"],
  ["zucchini","zucchini"],["asparagus","asparagus"],["green bean","green beans"],["broccoli rabe","broccoli rabe"],["broccolini","broccolini"],["broccoli","broccoli"],
  ["cauliflower","cauliflower"],["brussels sprout","brussels sprouts"],["cabbage","cabbage"],["bok choy","bok choy"],["kale","kale"],["spinach","spinach"],
  ["arugula","arugula"],["lettuce","lettuce"],["romaine","lettuce"],["cucumber","cucumber"],["tomato paste","tomato paste"],["cherry tomato","cherry tomatoes"],
  ["grape tomato","cherry tomatoes"],["crushed tomato","canned tomatoes"],["whole peeled tomato","canned tomatoes"],["canned tomato","canned tomatoes"],["tomato","tomatoes"],
  ["sweet potato","sweet potatoes"],["potato","potatoes"],["shiitake","shiitake mushrooms"],["mushroom","mushrooms"],["eggplant","eggplant"],["squash","squash"],
  ["corn","corn"],["avocado","avocados"],["shallot","shallots"],["scallion","scallions"],["green onion","scallions"],["leek","leeks"],["red onion","red onion"],
  ["onion","onion"],["garlic","garlic"],["ginger","ginger"],["celery","celery"],["carrot","carrots"],["fennel","fennel"],["radish","radishes"],
  ["bell pepper","bell peppers"],["jalapeño","jalapeño"],["jalapeno","jalapeño"],["serrano","serrano peppers"],["poblano","poblano peppers"],["chipotle","chipotle"],
  ["chile crisp","chile crisp"],["chili crisp","chile crisp"],["red pepper flakes","red pepper flakes"],["chile flakes","red pepper flakes"],["chile","fresh chiles"],["chili","fresh chiles"],
  ["lemon","lemons"],["lime","limes"],["orange","oranges"],["apple","apples"],["melon","melon"],["cantaloupe","melon"],["peach","peaches"],["berr","berries"],["banana","bananas"],
  ["basil","basil"],["parsley","parsley"],["cilantro","cilantro"],["dill","dill"],["mint","mint"],["thyme","thyme"],["oregano","oregano"],["rosemary","rosemary"],
  ["chive","chives"],["tarragon","tarragon"],["sage","sage"],["bay lea","bay leaves"],
  ["capers","capers"],["olive oil","olive oil"],["olive","olives"],["toasted sesame oil","sesame oil"],["sesame oil","sesame oil"],["vegetable oil","neutral oil"],
  ["canola oil","neutral oil"],["neutral oil","neutral oil"],["peanut oil","neutral oil"],["soy sauce","soy sauce"],["tamari","soy sauce"],["fish sauce","fish sauce"],
  ["oyster sauce","oyster sauce"],["hoisin","hoisin"],["miso","miso"],["gochujang","gochujang"],["sriracha","sriracha"],["hot sauce","hot sauce"],
  ["red wine vinegar","red wine vinegar"],["white wine vinegar","white wine vinegar"],["sherry vinegar","sherry vinegar"],["apple cider vinegar","cider vinegar"],
  ["balsamic","balsamic vinegar"],["dijon","mustard"],["mustard","mustard"],["mayonnaise","mayonnaise"],["mayo","mayonnaise"],["worcestershire","worcestershire"],
  ["honey","honey"],["maple","maple syrup"],["brown sugar","brown sugar"],["sugar","sugar"],["peanut butter","peanut butter"],["tahini","tahini"],
  ["peanut","peanuts"],["cashew","cashews"],["walnut","walnuts"],["pecan","pecans"],["almond","almonds"],["pine nut","pine nuts"],["pistachio","pistachios"],
  ["sesame seed","sesame seeds"],["nori","nori"],["white wine","white wine"],["red wine","red wine"],["shaoxing","shaoxing wine"],["mirin","mirin"],
  ["old bay","old bay"],["cumin","cumin"],["coriander","coriander"],["turmeric","turmeric"],["garam masala","garam masala"],["smoked paprika","paprika"],
  ["paprika","paprika"],["cayenne","cayenne"],["cinnamon","cinnamon"],["nutmeg","nutmeg"],["vanilla","vanilla"],["chocolate","chocolate"],["cocoa","cocoa"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

function names(lines: string[]): string[] {
  const out = new Set<string>();
  for (const raw of lines) {
    let l = " " + raw.toLowerCase().replace(/\(.*?\)/g, " ") + " ";
    for (const [k, v] of KW) {
      if (l.includes(k)) { out.add(v); l = l.split(k).join(" "); }
    }
  }
  return [...out].sort();
}

function findRecipe(node: any): any {
  if (!node) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  if (typeof node === "object") {
    const t = node["@type"]; if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
    if (node["@graph"]) return findRecipe(node["@graph"]);
  }
  return null;
}
const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ||
  html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
const decode = (s = "") => s.replace(/&amp;/g, "&").replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: ok } = await sb.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can add recipes." }, 403);

    const { url } = await req.json();
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return json({ error: "That doesn't look like a web link." }, 400);
    const res = await fetch(u.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return json({ error: `The site answered ${res.status}. You can still add it by hand.` }, 200);
    const html = await res.text();

    let recipe: any = null;
    for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch { /* skip bad block */ }
      if (recipe) break;
    }
    let image = recipe?.image;
    if (Array.isArray(image)) image = image[0];
    if (image && typeof image === "object") image = image.url || image.contentUrl;
    const title = decode(recipe?.name || meta(html, "og:title") || html.match(/<title>([^<]+)/i)?.[1] || "");
    const lines: string[] = Array.isArray(recipe?.recipeIngredient) ? recipe.recipeIngredient.map(String) : [];
    return json({
      title,
      image: image || meta(html, "og:image") || null,
      site: (meta(html, "og:site_name") ? decode(meta(html, "og:site_name")) : u.hostname.replace(/^www\./, "")),
      ingredients: names(lines),
      found_ingredients: lines.length > 0,
    });
  } catch (e) {
    return json({ error: "Couldn't read that page: " + (e as Error).message }, 200);
  }
});
