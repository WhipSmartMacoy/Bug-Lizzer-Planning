// Supabase Edge Function: find-recipes
// "Use it up": searches recipe sites for what's At Home and returns LINKS ONLY (title, photo, site,
// which of our ingredients each recipe uses and what else it needs). No steps or text are copied.
// Only approved household members can call it.
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
  ["rotisserie chicken","rotisserie chicken"],["chicken breast","chicken breast"],["chicken thigh","chicken thighs"],["chicken thig","chicken thighs"],["chicken leg","chicken legs"],["chicken quarter","chicken legs"],["chicken wing","chicken wings"],["chicken drumstick","chicken drumsticks"],["drumstick","chicken drumsticks"],["chicken tender","chicken tenders"],["whole chicken","whole chicken"],["spatchcock","whole chicken"],
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
  ["all-purpose flour","flour"],["flour","flour"],["cornstarch","cornstarch"],["red curry paste","red curry paste"],["green curry paste","green curry paste"],["curry paste","red curry paste"],["chili flakes","red pepper flakes"],["chile flakes","red pepper flakes"],["pepper flakes","red pepper flakes"],["pepperoncini","pepperoncini"],["peperoncini","pepperoncini"],["cornmeal","cornmeal"],["polenta","cornmeal"],["grits","cornmeal"],["baking soda","baking soda"],["baking powder","baking powder"],
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

const RE_CACHE = new Map<string, RegExp>();
function wordRe(k: string): RegExp {
  let r = RE_CACHE.get(k);
  if (!r) { r = new RegExp("(^|[^a-zà-ÿ])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[a-zà-ÿ]{0,3}(?![a-zà-ÿ]))"); RE_CACHE.set(k, r); }
  return r;
}
function lineNames(raw: string): string[] {
  const found: string[] = [];
  // "1 (4-pound) chicken" with no cut named is a whole bird.
  if (/^\s*(1|one|2|two)\s*\(\s*[\d½¼¾.\s–-]+(?:to\s*[\d½¼¾.]+\s*)?-?\s*(pound|lb)/i.test(raw) && /\bchicken\b/i.test(raw) && !/thigh|breast|wing|drumstick|leg|tender|ground|broth|stock/i.test(raw)) return ["whole chicken"];
  let l = " " + raw.toLowerCase().replace(/\(.*?\)/g, " ")
    .replace(/(chicken|vegetable|beef)( or (chicken|vegetable|beef))+ (broth|stock)/g, "broth") + " ";
  for (const [k, v] of KW) {
    // Whole words only: the name must start a word and may end with at most a short plural/stem
    // ending (chive→chives, anchov→anchovies), so "cornmeal" doesn't count as corn.
    const re = wordRe(k);
    const m = re.exec(l);
    if (m) {
      const at = m.index + m[1].length;
      // Remember where the word appeared so the first-mentioned ingredient is treated as the main one.
      if (v && !found.some((f) => f.split("\u0000")[0] === v)) found.push(v + "\u0000" + at);
      l = l.replace(new RegExp(re.source, "g"), (all, pre) => pre + " ".repeat(all.length - pre.length));
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
    if (found.length) { for (const n of found) out.add(n); continue; }
    // Not a name we know: still count it (as needed) rather than pretend the recipe doesn't use it.
    // Garnishes and optional extras are left out.
    if (/\boptional\b|for (garnish|serving)|to serve|\b(salt|pepper)\b|^\s*water\b/i.test(raw)) continue;
    const p = plainName(raw); if (p) out.add(p);
  }
  // A specific pasta shape makes the generic "pasta" redundant.
  if (["short pasta","spaghetti","linguine","bucatini","orzo","lasagna noodles","pastina"].some((x) => out.has(x))) out.delete("pasta");
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


const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" };
async function get(url: string, ms = 9000): Promise<string> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: UA, redirect: "follow", signal: c.signal }); return r.ok ? await r.text() : ""; }
  catch { return ""; } finally { clearTimeout(t); }
}
// Each site's search page, and the pattern its recipe links follow. (Serious Eats and Allrecipes
// refuse server requests, so NYT Cooking is the one searched.)
const SITES = [
  { name: "NYT Cooking", search: (q: string) => `https://cooking.nytimes.com/search?q=${encodeURIComponent(q)}`,
    link: /href="(\/recipes\/\d+-[a-z0-9-]+)"/g, base: "https://cooking.nytimes.com" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: ok } = await sb.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can search." }, 403);

    const body = await req.json();
    // At Home names can be product names ("certified organic tahini", "red kidney beans"): count each
    // as the plain ingredient recipes use too, so nothing in the house is missed.
    // Only the main name (tuna steak → tuna, not steak too); dried things don't stand in for fresh ones.
    // A processed form isn't the fresh thing (pickled carrots aren't carrots, sushi ginger isn't ginger):
    // such a word only passes if the plain name has it too (rice vinegar, red curry paste).
    const PROCESSED = /\b(pickled|pickle|dried|dehydrated|freeze dried|canned|tinned|jarred|powder|paste|flakes|jam|jelly|preserves|chutney|relish|sauce|salsa|seasoning|rub|flavored|flavour|bar|bars|chips|crisp|crisps|juice|syrup|extract|oil|vinegar|sushi|candied|crystallized|spread|butter|cookie|cookies|pie|drink|soda|tea|bites|mix|puree|purée|concentrate|zest)\b/g;
    // Things that only ever come pickled/canned (pepperoncini, chickpeas) still count.
    const OK_PROCESSED: Record<string, RegExp> = { pepperoncini: /pickled|pickle|jarred/, capers: /pickled|jarred/, olives: /pickled|jarred|canned/,
      chickpeas: /canned|tinned/, "kidney beans": /canned|tinned/, "black beans": /canned|tinned/, "cannellini beans": /canned|tinned/, beans: /canned|tinned/,
      lentils: /canned|tinned/, tuna: /canned|tinned/, "coconut milk": /canned|tinned/, chipotle: /canned|tinned/ };
    const main1 = (x: string) => {
      const ns = lineNames(x).filter((n) => n !== "steak" || lineNames(x).length === 1);
      if (ns.length !== 1) return null;                 // "apple cinnamon oats": two foods named, so it's only itself
      const n = ns[0], words = x.match(PROCESSED) || [];
      return words.some((w) => !new RegExp("\\b" + w + "\\b").test(n) && !(OK_PROCESSED[n] && OK_PROCESSED[n].test(w))) ? null : n; };
    const plain = (x: string) => [main1(x) || x];
    const both = (xs: string[]) => [...new Set(xs.flatMap((x) => [x, main1(x) || x]))];
    const raw = (k: string) => (body[k] || []).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean);
    const have: string[] = both(raw("have"));
    const main: string[] = [...new Set((body.main ? raw("main") : raw("have")).flatMap(plain))];
    const fresh: string[] = [...new Set(raw("fresh").flatMap(plain))].filter((s: string) => main.includes(s));
    const CHICKEN_CUTS = ["chicken thighs","chicken breast","chicken wings","chicken drumsticks","chicken legs","chicken tenders","whole chicken","rotisserie chicken"];
    const haveChicken = have.some((h) => CHICKEN_CUTS.includes(h) && h !== "whole chicken" || h === "whole chicken");
    const PASTA = new Set<string>(["pasta","spaghetti","linguine","bucatini","fettuccine","angel hair","capellini","penne","rigatoni","fusilli","farfalle","orecchiette","ditalini","orzo","macaroni","elbow macaroni","short pasta","pappardelle","tagliatelle","ziti","shells","conchiglie","gemelli","campanelle","cavatappi","radiatori","paccheri","lasagna noodles","pastina"]);
    const havePasta = have.some((h) => PASTA.has(h) || /\b(pasta|noodles?|spaghetti|linguine|penne|rigatoni|fusilli|orzo|ditalini|angel hair|capellini|macaroni|fettuccine|bucatini|farfalle|orecchiette|ziti|shells)\b/.test(h));
    const staples = new Set<string>((body.staples || []).map((s: string) => String(s).toLowerCase()));
    const skip = new Set<string>(body.exclude || []);
    if (!have.length) return json({ results: [], searched: [] });

    // Searches. With a focus ingredient (tapped in the app): that ingredient alone and paired with
    // others from home. Otherwise every item at home gets searched on its own (fridge items first,
    // they spoil first), plus a couple of fridge pairs; "Search again" rotates which items lead.
    const focus = String(body.focus || "").toLowerCase().trim();
    let lead = [...fresh, ...main.filter((h) => !fresh.includes(h))];
    const off = Math.max(0, Number(body.offset) || 0) * 6;
    if (off && lead.length) { const k = off % lead.length; lead = [...lead.slice(k), ...lead.slice(0, k)]; }
    const qs: string[] = [];
    if (focus) {
      qs.push(focus);
      for (const x of lead.filter((h) => h !== focus).slice(0, 6)) qs.push(`${focus} ${x}`);
    } else {
      // Every item at home gets its own search, plus a few fridge pairs.
      if (lead.length >= 2) qs.push(`${lead[0]} ${lead[1]}`);
      if (lead.length >= 3) qs.push(`${lead[0]} ${lead[2]}`, `${lead[1]} ${lead[2]}`);
      for (const x of lead) qs.push(x);
    }
    const queries = [...new Set(qs)].slice(0, 36);

    // Fetch in small batches so dozens of searches don't overwhelm the site or this function.
    const inBatches = async <T, R>(xs: T[], n: number, f: (x: T) => Promise<R>) => { const out: R[] = []; for (let i = 0; i < xs.length; i += n) out.push(...await Promise.all(xs.slice(i, i + n).map(f))); return out; };
    const pages = await inBatches(queries.flatMap((q) => SITES.map((s) => ({ s, q }))), 12, async ({ s, q }) => ({ s, html: await get(s.search(q)) }));
    const cand: string[] = [], seen = new Set<string>(), perSite: Record<string, number> = {};
    // Interleave sites so one site doesn't crowd out the others.
    const lists = pages.map(({ s, html }) => [...html.matchAll(s.link)].map((m) => ((s as any).base || "") + m[1].replace(/\/$/, "")));
    // Round-robin: every search contributes its best few before any contributes more.
    for (let k = 0; k < 15; k++) for (const l of lists) { const u = l[k]; if (u && !seen.has(u) && !skip.has(u)) { seen.add(u); cand.push(u); } }
    const pick = cand.slice(0, Math.max(60, Math.min(100, queries.length * 3)));

    const results = (await inBatches(pick, 15, async (url: string) => {
      const html = await get(url, 8000); if (!html) return null;
      let recipe: any = null;
      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch { /* skip */ }
        if (recipe) break;
      }
      const lines: string[] = Array.isArray(recipe?.recipeIngredient) ? recipe.recipeIngredient.map(String) : [];
      if (!lines.length) return null;
      const ings = names(lines).filter((i) => !staples.has(i));
      const uses = ings.filter((i) => main.includes(i));
      // Recipes that use something from home and need at most 3 other things (staples don't count).
      // Pasta shapes swap freely: any pasta at home covers a recipe's linguine, penne, etc.
      // A recipe's plain "chicken" is covered by any chicken pieces at home; a specific cut needs that cut.
      const need = ings.filter((i) => !have.includes(i) && !(PASTA.has(i) && havePasta) && !(i === "chicken" && haveChicken));
      if (focus && !ings.includes(focus)) return null;
      if (!uses.length || need.length > 3 || !focus && uses.length < Math.min(2, main.length) && need.length > 1) return null;
      let image = recipe.image; if (Array.isArray(image)) image = image[0]; if (image && typeof image === "object") image = image.url || image.contentUrl;
      const host = new URL(url).hostname.replace(/^www\./, "");
      perSite[host] = (perSite[host] || 0) + 1;
      return { url, title: decode(recipe.name || meta(html, "og:title") || ""), image: image || meta(html, "og:image") || null,
        site: meta(html, "og:site_name") ? decode(meta(html, "og:site_name")) : host,
        uses, fresh: uses.filter((i) => fresh.includes(i)), need };
    })).filter(Boolean) as any[];
    // Best first: needs the fewest extra things, then uses the most from home (fridge items count extra).
    results.sort((a, b) => a.need.length - b.need.length || (b.uses.length + b.fresh.length) - (a.uses.length + a.fresh.length));
    return json({ results: results.slice(0, 40), searched: queries, candidates: cand.length, perSite });
  } catch (e) {
    return json({ error: "Search failed: " + (e as Error).message }, 200);
  }
});
