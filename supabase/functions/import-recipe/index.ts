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
  ["peppercorn",""],["black pepper",""],["kosher salt",""],["sea salt",""],["corn tortilla","tortillas"],["flour tortilla","tortillas"],
  ["bread crumb","breadcrumbs"],["butter lettuce","lettuce"],["paneer","paneer"],["lasagna noodle","lasagna noodles"],["lasagna","lasagna noodles"],["juniper berr","juniper berries"],
  ["potato gnocchi","gnocchi"],["egg noodle","noodles"],["egg yolk","eggs"],["chicken bouillon","broth"],["bouillon","broth"],
  ["garlic powder","garlic"],["onion powder","onion"],["coconut cream","coconut milk"],["half-and-half","heavy cream"],
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
  ["gnocchi","gnocchi"],["orzo","orzo"],["couscous","couscous"],["farro","farro"],["quinoa","quinoa"],["rice wine vinegar","rice vinegar"],["rice vinegar","rice vinegar"],["pepperoncini","pepperoncini"],["coconut oil","neutral oil"],["avocado oil","neutral oil"],["rice noodle","rice noodles"],
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
  ["dried oregano","dried oregano"],["dried thyme","dried thyme"],["dried basil","dried basil"],["dried rosemary","dried rosemary"],["dried dill","dried dill"],["dried bay","dried bay leaves"],["italian seasoning","italian seasoning"],["chive","chives"],["tarragon","tarragon"],["sage","sage"],["bay lea","bay leaves"],
  ["capers","capers"],["olive oil","olive oil"],["olive","olives"],["toasted sesame oil","sesame oil"],["sesame oil","sesame oil"],["vegetable oil","neutral oil"],
  ["canola oil","neutral oil"],["neutral oil","neutral oil"],["peanut oil","neutral oil"],["soy sauce","soy sauce"],["tamari","soy sauce"],["fish sauce","fish sauce"],
  ["oyster sauce","oyster sauce"],["hoisin","hoisin"],["miso","miso"],["gochujang","gochujang"],["sriracha","sriracha"],["hot sauce","hot sauce"],
  ["red wine vinegar","red wine vinegar"],["white wine vinegar","white wine vinegar"],["sherry vinegar","sherry vinegar"],["apple cider vinegar","cider vinegar"],
  ["balsamic","balsamic vinegar"],["dijon","mustard"],["mustard","mustard"],["mayonnaise","mayonnaise"],["mayo","mayonnaise"],["worcestershire","worcestershire"],
  ["honey","honey"],["maple","maple syrup"],["brown sugar","brown sugar"],["sugar","sugar"],["peanut butter","peanut butter"],["tahini","tahini"],
  ["peanut","peanuts"],["cashew","cashews"],["walnut","walnuts"],["pecan","pecans"],["almond","almonds"],["pine nut","pine nuts"],["pistachio","pistachios"],
  ["sesame seed","sesame seeds"],["nori","nori"],["white wine","white wine"],["red wine","red wine"],["shaoxing","shaoxing wine"],["mirin","mirin"],
  ["old bay","old bay"],[" oil","neutral oil"],["cumin","cumin"],["coriander","coriander"],["turmeric","turmeric"],["garam masala","garam masala"],["smoked paprika","paprika"],
  ["paprika","paprika"],["cayenne","cayenne"],["cinnamon","cinnamon"],["nutmeg","nutmeg"],["vanilla","vanilla"],["chocolate","chocolate"],["cocoa","cocoa"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

function lineNames(raw: string): string[] {
  const found: string[] = [];
  let l = " " + raw.toLowerCase().replace(/\(.*?\)/g, " ")
    .replace(/(chicken|vegetable|beef)( or (chicken|vegetable|beef))+ (broth|stock)/g, "broth") + " ";
  for (const [k, v] of KW) {
    if (l.includes(k)) {
      // Remember where the word appeared so the first-mentioned ingredient is treated as the main one.
      if (v && !found.includes(v)) found.push(v + "\u0000" + l.indexOf(k));
      l = l.split(k).join(" ".repeat(k.length));
    }
  }
  return found.sort((a, b) => +a.split("\u0000")[1] - +b.split("\u0000")[1]).map((x) => x.split("\u0000")[0]);
}

// A line none of the names above match (e.g. "1 cup kimchi"): keep it as a plain name rather than
// dropping it, so it still reaches the shopping list. Amounts, sizes and prep notes are stripped.
const UNITS = "cups?|tablespoons?|tbsps?|teaspoons?|tsps?|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|ml|liters?|quarts?|pints?|cans?|jars?|packages?|pkgs?|bunch(?:es)?|heads?|cloves?|sprigs?|stalks?|slices?|pieces?|sheets?|pinch(?:es)?|dash(?:es)?|large|medium|small|whole|handful|knob";
function plainName(raw: string): string {
  let l = raw.toLowerCase().replace(/\(.*?\)/g, " ").split(/,| for | to serve| plus /)[0];
  l = l.replace(/[\d½⅓⅔¼¾⅛\/.\-–]+/g, " ").replace(new RegExp("\\b(" + UNITS + ")\\b", "g"), " ")
    .replace(/\b(of|about|fresh|freshly|finely|roughly|thinly|chopped|minced|diced|sliced|grated|peeled|trimmed|optional|or more|to taste|store-bought|homemade|a few|a|an)\b/g, " ")
    .replace(/[^a-zà-ÿ' ]/g, " ").replace(/\s+/g, " ").trim();
  return l.length >= 3 && l.length <= 40 && !/^(salt|pepper|water|ice)$/.test(l) ? l : "";
}

function names(lines: string[]): string[] {
  const out = new Set<string>();
  for (const raw of lines) {
    const found = lineNames(raw);
    if (found.length) for (const n of found) out.add(n);
    else if (!/\b(salt|pepper)\b/i.test(raw) && !/^\s*water\b/i.test(raw)) { const p = plainName(raw); if (p) out.add(p); }
  }
  // A specific pasta shape makes the generic "pasta" redundant.
  if (["short pasta","spaghetti","linguine","bucatini","orzo","lasagna noodles","pastina"].some((x) => out.has(x))) out.delete("pasta");
  return [...out].sort();
}

// ---- amounts: how much of each ingredient the recipe uses, in base units ----
// ml (volume), g (weight), each (whole items), pkg (a can/jar/package of unknown size)
const VOL: Record<string, number> = { teaspoon: 4.93, tsp: 4.93, tablespoon: 14.79, tbsp: 14.79, tbs: 14.79, cup: 236.6, "fluid ounce": 29.57, "fl oz": 29.57,
  pint: 473, quart: 946, qt: 946, gallon: 3785, milliliter: 1, ml: 1, liter: 1000, litre: 1000, l: 1000, pinch: 0.3, dash: 0.6 };
const WT: Record<string, number> = { ounce: 28.35, oz: 28.35, pound: 453.6, lb: 453.6, gram: 1, g: 1, kilogram: 1000, kg: 1000 };
const EACH_PART: Record<string, number> = { clove: 0.1, sprig: 0.1, stalk: 0.12, rib: 0.12, slice: 0.1, leaf: 0.05, leaves: 0.05, bunch: 1, head: 1 };
const PKG = ["can", "jar", "package", "pkg", "box", "bag", "bottle", "carton", "container", "sheet", "tube"];

function num(t: string): number {
  t = t.trim();
  const m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + +m[2] / +m[3];
  const f = t.match(/^(\d+)\/(\d+)$/); if (f) return +f[1] / +f[2];
  return parseFloat(t);
}
function amountOf(raw: string): { q: number; u: string } | null {
  let l = raw.toLowerCase()
    .replace(/½/g, " 1/2").replace(/⅓/g, " 1/3").replace(/⅔/g, " 2/3").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4")
    .replace(/⅛/g, " 1/8").replace(/(\d)\s+(\d\/\d)/g, "$1 $2").replace(/\s+/g, " ").trim();
  // "1 (15-ounce) can chickpeas" -> 15 oz
  const sized = l.match(/(\d+(?:\.\d+)?|\d+ \d\/\d|\d\/\d)?\s*\((\d+(?:\.\d+)?)[- ]?(ounce|oz|gram|g|pound|lb|fluid ounce|fl oz|ml)s?\b/);
  if (sized) {
    const n = sized[1] ? num(sized[1]) : 1, size = +sized[2], u = sized[3];
    if (VOL[u]) return { q: n * size * VOL[u], u: "ml" };
    return { q: n * size * WT[u], u: "g" };
  }
  const NUM = "(\\d+ \\d\\/\\d|\\d+\\/\\d|\\d*\\.?\\d+)";
  const m = l.match(new RegExp("^" + NUM + "(?:\\s*(?:to|-|–|or)\\s*" + NUM + ")?\\s*(.*)$"));
  let q: number, rest: string;
  if (m) { q = Math.max(num(m[1]), m[2] ? num(m[2]) : 0); rest = m[3]; }
  else {
    const any = l.match(/\b(?:of|from)\s+(\d+)\b/); // "juice of 1 lemon"
    if (!any) return null;
    q = +any[1]; rest = l.slice(l.indexOf(any[0]) + any[0].length);
  }
  if (!isFinite(q) || q <= 0) return null;
  rest = rest.replace(/^(heaping|scant|level|large|medium|small|generous|about|whole)\s+/g, "").replace(/^(heaping|scant|level|large|medium|small)\s+/g, "");
  const w = rest.match(/^([a-z]+(?: [a-z]+)?)/)?.[1] || "";
  for (const unit of Object.keys(VOL).sort((a, b) => b.length - a.length)) if (w === unit || w.startsWith(unit + "s") || w.split(" ")[0] === unit || w.split(" ")[0] === unit + "s" || w === unit + "s") return { q: q * VOL[unit], u: "ml" };
  for (const unit of Object.keys(WT).sort((a, b) => b.length - a.length)) if (w.split(" ")[0] === unit || w.split(" ")[0] === unit + "s") return { q: q * WT[unit], u: "g" };
  const first = w.split(" ")[0];
  const words = rest.split(/[\s,]+/).slice(0, 3);
  for (const [unit, f] of Object.entries(EACH_PART)) if (words.some((x) => x === unit || x === unit + "s" || x === unit + "es")) return { q: q * f, u: "each" };
  if (PKG.some((p) => first === p || first === p + "s")) return { q, u: "pkg" };
  return { q, u: "each" };
}
function amounts(lines: string[]): Record<string, { q: number; u: string }> {
  const out: Record<string, { q: number; u: string }> = {};
  for (const raw of lines) {
    const n = lineNames(raw)[0]; if (!n) continue;
    const a = amountOf(raw); if (!a) continue;
    const cur = out[n];
    if (!cur) out[n] = { q: a.q, u: a.u };
    else if (cur.u === a.u) cur.q += a.q;
    else if ((cur.u === "ml" && a.u === "g") || (cur.u === "g" && a.u === "ml")) cur.q += a.q; // ~1 g per ml
  }
  for (const k of Object.keys(out)) out[k].q = Math.round(out[k].q * 100) / 100;
  return out;
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
// Per-serving nutrition from the recipe's own schema.org data (facts only): numbers, no text.
function nutritionOf(recipe: any) {
  const n = recipe?.nutrition; if (!n || typeof n !== "object") return null;
  const v = (k: string) => { const m = String(n[k] ?? "").replace(/,/g, "").match(/[\d.]+/); return m ? Math.round(parseFloat(m[0]) * 10) / 10 : null; };
  const out = { calories: v("calories"), protein: v("proteinContent"), carbs: v("carbohydrateContent"), fat: v("fatContent"),
    fiber: v("fiberContent"), sugar: v("sugarContent"), sodium: v("sodiumContent") };
  return Object.values(out).some((x) => x != null) ? out : null;
}
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
    // Servings exactly as the recipe page lists them (recipeYield can be a string, number or list).
    const y = recipe?.recipeYield;
    const yields = (Array.isArray(y) ? y : y != null ? [y] : []).map((v: unknown) => decode(String(v))).filter(Boolean);
    const servings = yields.find((v: string) => /serv|people|portion/i.test(v)) || yields.find((v: string) => /\D/.test(v)) ||
      (yields[0] ? `${yields[0]} servings` : null);
    return json({
      title,
      image: image || meta(html, "og:image") || null,
      site: (meta(html, "og:site_name") ? decode(meta(html, "og:site_name")) : u.hostname.replace(/^www\./, "")),
      servings,
      ingredients: names(lines),
      amounts: amounts(lines),
      found_ingredients: lines.length > 0,
      nutrition: nutritionOf(recipe),
    });
  } catch (e) {
    return json({ error: "Couldn't read that page: " + (e as Error).message }, 200);
  }
});
