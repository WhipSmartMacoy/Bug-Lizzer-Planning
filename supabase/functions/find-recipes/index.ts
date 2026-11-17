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
  ["peppercorn",""],["butter lettuce","butter lettuce"],["romaine lettuce","romaine"],["bibb lettuce","butter lettuce"],["butterhead lettuce","butter lettuce"],["little gem lettuce","little gem"],["iceberg lettuce","iceberg lettuce"],["bibb","butter lettuce"],["boston lettuce","butter lettuce"],["butterhead","butter lettuce"],["romaine","romaine"],["little gem","little gem"],["iceberg","iceberg lettuce"],["red leaf lettuce","red leaf lettuce"],["green leaf lettuce","green leaf lettuce"],["mixed greens","mixed greens"],["spring mix","mixed greens"],["dried basil","dried basil"],["ground basil","dried basil"],["dried parsley","dried parsley"],["ground parsley","dried parsley"],["dried cilantro","dried cilantro"],["ground cilantro","dried cilantro"],["dried dill","dried dill"],["ground dill","dried dill"],["dried mint","dried mint"],["ground mint","dried mint"],["dried thyme","dried thyme"],["ground thyme","dried thyme"],["dried oregano","dried oregano"],["ground oregano","dried oregano"],["dried rosemary","dried rosemary"],["ground rosemary","dried rosemary"],["dried sage","dried sage"],["ground sage","dried sage"],["dried tarragon","dried tarragon"],["ground tarragon","dried tarragon"],["dried marjoram","dried marjoram"],["ground marjoram","dried marjoram"],["dried chives","dried chives"],["ground chives","dried chives"],["dried chive","dried chives"],["ground chive","dried chives"],["dried lemongrass","dried lemongrass"],["ground lemongrass","dried lemongrass"],["ground ginger","ground ginger"],["dried ginger","ground ginger"],["ground bay","dried bay leaves"],["dried bay","dried bay leaves"],["granulated garlic","garlic"],["granulated onion","onion"],["butternut squash","butternut squash"],["butternut","butternut squash"],["butter bean","butter beans"],["cornish hen","cornish hens"],["beef stock","broth"],["bone broth","broth"],["turkey stock","broth"],["eggnog","eggnog"],["lemon juice","lemons"],["lemon zest","lemons"],["lime juice","limes"],["lime zest","limes"],["orange juice","oranges"],["orange zest","oranges"],["vanilla extract","vanilla"],["vanilla bean","vanilla"],["pure vanilla","vanilla"],["garlic clove","garlic"],["ginger root","ginger"],["egg white","eggs"],["chicken skin","chicken"],["black pepper",""],["kosher salt",""],["sea salt",""],["corn tortilla","tortillas"],["flour tortilla","tortillas"],
  ["bread crumb","breadcrumbs"],["paneer","paneer"],["lasagna noodle","lasagna noodles"],["lasagna","lasagna noodles"],["juniper berr","juniper berries"],
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
  ["all-purpose flour","flour"],["flour","flour"],["cornstarch","cornstarch"],["potato roll","potato rolls"],["potato bun","potato buns"],["potato bread","potato bread"],["potato chip","potato chips"],["potato starch","potato starch"],["potato flake","potato flakes"],["hamburger bun","buns"],["hot dog bun","buns"],["brioche bun","buns"],["dinner roll","rolls"],["apple juice","apple juice"],["applesauce","applesauce"],["apple sauce","applesauce"],["apple cider vinegar","apple cider vinegar"],["apple cider","apple cider"],["tortilla chip","tortilla chips"],["red curry paste","red curry paste"],["green curry paste","green curry paste"],["curry paste","red curry paste"],["chili flakes","red pepper flakes"],["chile flakes","red pepper flakes"],["pepper flakes","red pepper flakes"],["pepperoncini","pepperoncini"],["peperoncini","pepperoncini"],["cornmeal","cornmeal"],["polenta","cornmeal"],["grits","cornmeal"],["baking soda","baking soda"],["baking powder","baking powder"],
  ["chickpea","chickpeas"],["garbanzo","chickpeas"],["cannellini","white beans"],["white bean","white beans"],["black bean","black beans"],
  ["kidney bean","kidney beans"],["lentil","lentils"],["edamame","edamame"],["snap pea","sugar snap peas"],["snow pea","snow peas"],["peas","peas"],
  ["zucchini","zucchini"],["asparagus","asparagus"],["green bean","green beans"],["broccoli rabe","broccoli rabe"],["broccolini","broccolini"],["broccoli","broccoli"],
  ["cauliflower","cauliflower"],["brussels sprout","brussels sprouts"],["cabbage","cabbage"],["bok choy","bok choy"],["kale","kale"],["spinach","spinach"],
  ["arugula","arugula"],["lettuce","lettuce"],["cucumber","cucumber"],["tomato paste","tomato paste"],["cherry tomato","cherry tomatoes"],
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
// Words that, right after an ingredient's name, make it a different food.
const OTHER_FOOD = /^(greens|seeds?|powder|flour|milk|juice|oil|butter|paste|sauce|wrappers?|chips?|extract|liqueur|jam|jelly|preserves|syrup|wine|water|cream|rolls?|buns?|bread|starch|flakes|crumbs|cakes?|crackers?|cookies?|bars?|sausages?|meatballs?|nuggets?|jerky|rinds|ale|beer|soda|tea|paper|noodles?|chocolate|candy|curd|marmalade|vinegar|salsa|relish|dressing|soup|broth|stock|bouillon|seasoning|rub|mix|spread|sprouts|blossoms?|flowers?|shoots)$/;
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
      // A word right after the name that makes it a different food ("mustard greens", "almond milk",
      // "corn syrup", "chicken sausage") means it isn't that ingredient: keep the whole phrase as its
      // own name instead, so it only counts as on hand if that exact thing is At Home.
      const after = l.slice(at + m[0].length - m[1].length).match(/^\s*([a-zà-ÿ]+)/);
      if (v && after && OTHER_FOOD.test(after[1]) && !k.split(" ").includes(after[1]) && !v.split(" ").some((x) => x.replace(/s$/, "") === after[1].replace(/s$/, ""))) {
        const phrase = l.slice(at, at + m[0].length - m[1].length).trim() + " " + after[1];
        if (!found.some((f) => f.split("\u0000")[0] === phrase)) found.push(phrase + "\u0000" + at);
        l = l.slice(0, at) + " ".repeat(phrase.length) + l.slice(at + phrase.length);
        continue;
      }
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
  let l = raw.toLowerCase().replace(/\(.*?\)/g, " ").split(/,| for | to serve| plus | or /)[0];   // "chuck roast or round roast": the first choice
  l = l.replace(/[\d½⅓⅔¼¾⅛\/.\-–]+/g, " ").replace(new RegExp("\\b(" + UNITS + ")\\b", "g"), " ")
    .replace(/\b(of|about|fresh|freshly|finely|roughly|thinly|chopped|minced|diced|sliced|grated|peeled|trimmed|optional|or more|to taste|store-bought|homemade|a few|a|an)\b/g, " ")
    .replace(/[^a-zà-ÿ' ]/g, " ").replace(/\s+/g, " ").trim();
  if (l.length > 40) l = l.split(" ").slice(-4).join(" ");   // long names keep their last words (the food), never dropped
  // Wording that isn't a food: amounts and serving notes ("a few shakes", "kosher", "toppings and condiments").
  l = l.replace(/\b(few|shakes?|dash(es)?|pinch(es)?|splash(es)?|drizzle|generous|good|quality|your favorite|any|assorted|kosher)\b/g, " ").replace(/\s+/g, " ").trim();
  if (/^(toppings?|condiments?|garnish(es)?|toppings and condiments|condiments and toppings|accompaniments?|sides?|serving|and|or)$/.test(l)) return "";
  return l.length >= 3 && !/^(salt|pepper|water|ice)$/.test(l) ? l : "";
}

function names(lines: string[]): string[] {
  const out = new Set<string>();
  for (const raw of lines) {
    const found = lineNames(raw);
    if (found.length) { for (const n of found) out.add(n); continue; }
    // Not a name we know: still count it (as needed) rather than pretend the recipe doesn't use it.
    // Garnishes and optional extras are left out.
    // Salt, pepper and water are left out, but only those words: "chuck roast, seasoned with salt" is still a chuck roast.
    if (/\boptional\b|for (garnish|serving)|to serve/i.test(raw)) continue;
    const p = plainName(raw.replace(/\b((kosher|sea|flaky|coarse|coarsely|finely|table|fine|black|white|freshly|fresh|ground|cracked)\s+)*(salt|pepper|peppercorns?|water)\b/gi, " ").replace(/\s+(and|or|&)\s*$/i, ""));
    // What's left of a salt-and-pepper line ("ground", "freshly ground", "and") isn't an ingredient.
    if (p && !/^(and|or|to taste|as needed|seasoned with|season)( .*)?$/.test(p) && !/^((freshly|coarsely|finely|fresh|ground|cracked)\s*)+$/.test(p)) out.add(p);
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
// Each site's search page, and the pattern its recipe links follow. Allrecipes and Serious Eats answer
// this server with 403 (blocked; checked with the probe, Nov 2026), so only NYT Cooking is searched here.
const SITES = [
  { name: "NYT Cooking", search: (q: string) => { const [t, pg] = q.split("|"); return `https://cooking.nytimes.com/search?q=${encodeURIComponent(t)}${pg ? "&page=" + pg : ""}`; },
    link: /href="(\/recipes\/\d+-[a-z0-9-]+)"/g, base: "https://cooking.nytimes.com" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // The daily 7 am run (pg_cron, see supabase/031_daily_ideas.sql) sends the household's own job key
    // instead of a sign-in; it searches with what the app last saved and stores the results for both.
    // The Home Assistant laptop searches Allrecipes and Serious Eats from home (they block this server).
    // It signs in with its own Home Assistant token, checked by the database (ha_check, see 033).
    const ht = req.headers.get("x-ha-token");
    if (ht) {
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { "x-ha-token": ht } } });
      const { data: okHa } = await anon.rpc("ha_check");
      if (!okHa) return json({ error: "Not allowed." }, 403);
      const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const q = await req.json().catch(() => ({}));
      if (q.home === "plan") {   // what to search for: proteins first, the same plan as the 7 am search
        const { data: row } = await adm.from("app_settings").select("value").eq("key", "web_input").maybeSingle();
        if (!row?.value) return json({ queries: [] });
        const { plan } = await search({ ...JSON.parse(row.value), planOnly: true }, true) as any;
        return json({ queries: [...new Set((plan || []).flat())].slice(0, 60) });
      }
      if (q.home === "recipes") {   // recipes the laptop read: kept until the 7 am search judges them
        const items = (Array.isArray(q.items) ? q.items : []).slice(0, 300).map((r: any) => ({
          url: String(r.url || "").slice(0, 500), title: String(r.title || "").slice(0, 200), image: r.image ? String(r.image).slice(0, 500) : null,
          site: String(r.site || "").slice(0, 60), lines: (Array.isArray(r.lines) ? r.lines : []).slice(0, 60).map((l: any) => String(l).slice(0, 300)) }))
          .filter((r: any) => /^https:\/\/(www\.)?(allrecipes|seriouseats)\.com\//.test(r.url) && r.lines.length);
        let cur: any = { at: new Date().toISOString(), items: [] };
        if (!q.start) { const { data: b } = await adm.from("app_settings").select("value").eq("key", "home_recipes").maybeSingle(); if (b?.value) cur = JSON.parse(b.value); }
        const seenU = new Set(cur.items.map((r: any) => r.url));
        for (const r of items) if (!seenU.has(r.url) && cur.items.length < 2000) { cur.items.push(r); seenU.add(r.url); }
        cur.at = new Date().toISOString();
        await adm.from("app_settings").upsert({ key: "home_recipes", updated_at: cur.at, value: JSON.stringify(cur) });
        return json({ ok: true, stored: cur.items.length });
      }
      if (q.home === "judge") {   // after a Search now: add the laptop's finds to the list straight away
        const [{ data: inp }, { data: hr }, { data: wi }] = await Promise.all(["web_input", "home_recipes", "web_ideas"].map((k) =>
          adm.from("app_settings").select("value").eq("key", k).maybeSingle()));
        if (!inp?.value || !hr?.value) return json({ added: 0 });
        const out: any = await search(JSON.parse(inp.value), true, { queries: [], seen: [], home: JSON.parse(hr.value).items || [] });
        const cur = wi?.value ? JSON.parse(wi.value) : { results: [] };
        const urls = new Set((cur.results || []).map((r: any) => r.url));
        const add = (out.results || []).filter((r: any) => !urls.has(r.url));
        const results = [...(cur.results || []), ...add].sort((a: any, b: any) => a.need.length - b.need.length || (b.uses.length + b.fresh.length) - (a.uses.length + a.fresh.length));
        await adm.from("app_settings").upsert({ key: "web_ideas", updated_at: new Date().toISOString(),
          value: JSON.stringify({ ...cur, at: new Date().toISOString(), results, fromHome: (cur.fromHome || 0) + add.length }) });
        return json({ added: add.length, makeNow: add.filter((r: any) => !r.need.length).length });
      }
      return json({ error: "Unknown request." }, 400);
    }

    const dk = req.headers.get("x-daily-key");
    if (dk) {
      const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: k } = await adm.from("daily_job_key").select("key").limit(1).maybeSingle();
      if (!k || k.key !== dk) return json({ error: "Not allowed." }, 403);
      // Cron fires at 11:00 and 12:00 UTC; only the one that is 7 am in New York runs (daylight saving).
      const hr = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
      const q = await req.json().catch(() => ({}));
      // Check how a site answers this server (status, size, recipe links found) — for troubleshooting.
      if (q.probe) {
        const out: any[] = [];
        for (const u of [].concat(q.probe)) {
          try { const r = await fetch(u, { headers: UA, redirect: "follow" }); const t = await r.text();
            out.push({ u, status: r.status, bytes: t.length, title: (t.match(/<title>([^<]*)/) || [])[1] || "",
              links: SITES.map((s) => [s.name, [...t.matchAll(s.link)].length]) }); }
          catch (e) { out.push({ u, error: String(e) }); }
        }
        return json(out);
      }
      if (hr !== 7 && !q.now) return json({ skipped: "not 7 am in New York" });
      const { data: row } = await adm.from("app_settings").select("value").eq("key", "web_input").maybeSingle();
      if (!row?.value) return json({ skipped: "nothing saved from the app yet" });
      const input = JSON.parse(row.value);
      const now = () => new Date().toISOString();
      const save = (key: string, v: unknown) => adm.from("app_settings").upsert({ key, updated_at: now(), value: JSON.stringify(v) });
      const job = (async () => {
        // Round 0 plans the rounds; each round checks its searches, adds what fits to the build,
        // then starts the next round (a fresh run of this function). The last round publishes the list.
        let build: any;
        if (q.round === undefined) {
          const { plan } = await search({ ...input, planOnly: true }, true) as any;
          build = { started: now(), key: input.key || null, rounds: plan || [], done: 0, seen: [], results: [], searched: [] };
        } else {
          const { data: b } = await adm.from("app_settings").select("value").eq("key", "web_ideas_build").maybeSingle();
          build = b?.value ? JSON.parse(b.value) : null;
          if (!build || build.done !== q.round) return;   // stale or repeated call
        }
        const i = build.done;
        if (i < build.rounds.length) {
          const out: any = await search(input, true, { queries: build.rounds[i], seen: build.seen });
          const have = new Set(build.results.map((r: any) => r.url));
          for (const r of out.results || []) if (!have.has(r.url)) build.results.push(r);
          build.seen.push(...(out.picked || []));
          build.searched.push(...(out.searched || []));
          build.done = i + 1;
        }
        if (build.done < build.rounds.length) {
          await save("web_ideas_build", build);
          await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/find-recipes", { method: "POST",
            headers: { "Content-Type": "application/json", "x-daily-key": dk }, body: JSON.stringify({ now: true, round: build.done }) }).catch(() => {});
          return;
        }
        // Add what the laptop found on Allrecipes and Serious Eats this morning (sent within the last 12 hours).
        const { data: hr } = await adm.from("app_settings").select("value").eq("key", "home_recipes").maybeSingle();
        const home = hr?.value ? JSON.parse(hr.value) : null;
        if (home && Date.now() - new Date(home.at).getTime() < 12 * 3600e3 && home.items?.length) {
          const out: any = await search(input, true, { queries: [], seen: [], home: home.items });
          const have = new Set(build.results.map((r: any) => r.url));
          for (const r of out.results || []) if (!have.has(r.url)) build.results.push(r);
          build.home = home.items.length;
        }
        build.results.sort((a: any, b: any) => a.need.length - b.need.length || (b.uses.length + b.fresh.length) - (a.uses.length + a.fresh.length));
        await save("web_ideas", { at: now(), key: build.key, daily: true, results: build.results.slice(0, 250),
          searched: build.searched, checked: build.seen.length + (build.home || 0), fromHome: build.home || 0, rounds: build.rounds.length });
        await save("web_ideas_build", { ...build, seen: [], results: [], finished: now() });
      })();
      // Answer right away; the search keeps running after the reply.
      (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(job) : await job;
      return json({ started: true });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: ok } = await sb.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can search." }, 403);
    return json(await search(await req.json(), false));
  } catch (e) {
    return json({ error: "Search failed: " + (e as Error).message }, 200);
  }
});

// The search itself. daily=true is the unhurried morning run: more searches and more recipes checked.
// The morning search runs in rounds so each stays within the function's limits: one round per protein
// At Home (its own search, pages 1–3, plus pairings with what it could be cooked with), then the rest.
function planRounds(qs: string[], proteins: string[]): string[][] {
  const all = [...new Set(qs)], rounds: string[][] = [], used = new Set<string>();
  for (const p of proteins) {
    const r = [p, `${p}|2`, `${p}|3`, ...all.filter((q) => q !== p && q.startsWith(p + " "))];
    r.forEach((q) => used.add(q)); rounds.push(r);
  }
  const rest = all.filter((q) => !used.has(q));
  for (let i = 0; i < rest.length; i += 25) rounds.push(rest.slice(i, i + 25));
  return rounds.slice(0, 12);
}

async function search(body: any, daily: boolean, round?: { queries: string[]; seen: string[]; home?: any[] }) {
    const t0 = Date.now(), budget = daily ? 125000 : 100000;   // stop starting new fetches before the function's time limit
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
    // A recipe that just says "lettuce" works with any lettuce At Home; romaine or butter lettuce needs that one.
    const LETTUCES = ["butter lettuce","romaine","little gem","iceberg lettuce","red leaf lettuce","green leaf lettuce","lettuce"];
    const haveLettuce = have.some((h) => LETTUCES.includes(h));
    const haveChicken = have.some((h) => CHICKEN_CUTS.includes(h) && h !== "whole chicken" || h === "whole chicken");
    const PASTA = new Set<string>(["pasta","spaghetti","linguine","bucatini","fettuccine","angel hair","capellini","penne","rigatoni","fusilli","farfalle","orecchiette","ditalini","orzo","macaroni","elbow macaroni","short pasta","pappardelle","tagliatelle","ziti","shells","conchiglie","gemelli","campanelle","cavatappi","radiatori","paccheri","lasagna noodles","pastina"]);
    const havePasta = have.some((h) => PASTA.has(h) || /\b(pasta|noodles?|spaghetti|linguine|penne|rigatoni|fusilli|orzo|ditalini|angel hair|capellini|macaroni|fettuccine|bucatini|farfalle|orecchiette|ziti|shells)\b/.test(h));
    const staples = new Set<string>((body.staples || []).map((s: string) => String(s).toLowerCase()));
    const skip = new Set<string>(body.exclude || []);
    if (!have.length) return { results: [], searched: [] };

    // Searches. With a focus ingredient (tapped in the app): that ingredient alone and paired with
    // others from home. Otherwise every item at home gets searched on its own (fridge items first,
    // they spoil first), plus a couple of fridge pairs; "Search again" rotates which items lead.
    const focus = String(body.focus || "").toLowerCase().trim();
    // What to search for. Only real cooking ingredients lead a search (not snacks, drinks, jams);
    // a meal is built around its protein, so every protein At Home gets its own searches first,
    // alone and paired with the fresh things it could be cooked with; then fresh produce; then the rest.
    const KNOWN = new Set(KW.map(([, v]) => v).filter(Boolean));
    const known = main.filter((x) => KNOWN.has(x));
    const PROTEIN = /^(ground (beef|turkey|pork|chicken)|chicken( .*)?|whole chicken|rotisserie chicken|beef|steak|flank steak|pork|sausage|bacon|prosciutto|lamb|salmon|tuna|shrimp|cod|crab|anchovies|scallops|mussels|tofu|tempeh|eggs|chickpeas|white beans|black beans|kidney beans|lentils|halloumi|paneer)$/;
    const CONDIMENT = /^(mustard|mayonnaise|sriracha|hot sauce|fish sauce|soy sauce|oyster sauce|hoisin|worcestershire|chile crisp|gochujang|miso|tahini|honey|maple syrup|ketchup|salsa|.*vinegar|.*oil|broth|capers|pepperoncini|olives)$/;
    const proteins = [...known.filter((x) => PROTEIN.test(x) && fresh.includes(x)), ...known.filter((x) => PROTEIN.test(x) && !fresh.includes(x))];
    const sides = [...known.filter((x) => fresh.includes(x) && !PROTEIN.test(x) && !CONDIMENT.test(x)), ...known.filter((x) => !fresh.includes(x) && !PROTEIN.test(x) && !CONDIMENT.test(x))];
    const starches = known.filter((x) => /^(pasta|rice|noodles|tortillas|potatoes|sweet potatoes|bread|gnocchi|orzo|couscous|quinoa|farro|polenta|cornmeal|pita)$/.test(x) || PASTA.has(x));
    let lead = [...proteins, ...sides, ...known.filter((x) => CONDIMENT.test(x))];
    const off = Math.max(0, Number(body.offset) || 0) * 6;
    if (off && lead.length) { const k = off % lead.length; lead = [...lead.slice(k), ...lead.slice(0, k)]; }
    const qs: string[] = [];
    if (focus) {
      qs.push(focus);
      for (const x of lead.filter((h) => h !== focus).slice(0, 6)) qs.push(`${focus} ${x}`);
    } else {
      const ps = off ? lead.filter((x) => proteins.includes(x)) : proteins;
      for (const p of ps) qs.push(p);
      for (const p of ps) {
        for (const x of sides.slice(0, daily ? 8 : 4)) qs.push(`${p} ${x}`);
        for (const x of starches.slice(0, 3)) qs.push(`${p} ${x}`);
      }
      for (const x of sides) qs.push(x);
      for (const x of lead) qs.push(x);
    }
    if (body.planOnly) return { plan: planRounds(qs, proteins) };
    const queries = round ? round.queries : [...new Set(qs)].slice(0, daily ? 90 : 40);

    // Fetch in small batches so dozens of searches don't overwhelm the site or this function.
    const inBatches = async <T, R>(xs: T[], n: number, f: (x: T) => Promise<R>) => { const out: R[] = []; for (let i = 0; i < xs.length && Date.now() - t0 < budget; i += n) out.push(...await Promise.all(xs.slice(i, i + n).map(f))); return out; };
    const pages = await inBatches(queries.flatMap((q) => SITES.map((s) => ({ s, q }))), daily ? 8 : 12, async ({ s, q }) => {
      // Keep only the recipe links, not the whole page: dozens of full pages would run out of memory.
      const html = await get(s.search(q));
      return { s, links: [...html.matchAll(s.link)].map((m) => ((s as any).base || "") + m[1].replace(/\/$/, "")) };
    });
    const cand: string[] = [], seen = new Set<string>(round?.seen || []), perSite: Record<string, number> = {};
    // Interleave sites so one site doesn't crowd out the others.
    const lists = pages.map((p) => p.links);
    // Round-robin so every search contributes, but searches built on fridge items go much deeper
    // (up to 12 recipes each) than the rest (3 each): those are the meals worth finding.
    // Searches built on a protein go deepest (those are the meals); fresh produce next; the rest skim the top.
    const deep = (q: string) => { const t = q.split("|")[0]; return proteins.includes(t) && round ? 48 : proteins.some((p) => t.startsWith(p)) ? (daily ? 24 : 12) : fresh.some((f) => t.includes(f)) ? (daily ? 8 : 5) : 3; };
    const qOf = pages.map((_, n) => queries[Math.floor(n / SITES.length)] || "");
    // Protein searches are checked first (all of their results), then fresh-produce searches, then the rest,
    // taking turns between searches within each group so no single search crowds out the others.
    for (const tier of [48, 24, 12, 8, 5, 3]) for (let k = 0; k < 48; k++) lists.forEach((l, n) => { if (deep(qOf[n]) !== tier || k >= tier) return; const u = l[k]; if (u && !seen.has(u) && !skip.has(u)) { seen.add(u); cand.push(u); } });
    const pick = cand.slice(0, round ? 240 : daily ? 220 : 150);

    const judgeAll = async (pick: string[]) => (await inBatches(pick, daily ? 8 : 15, async (url: string) => {
      let html = await get(url, 8000); if (!html) return null;
      let recipe: any = null;
      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch { /* skip */ }
        if (recipe) break;
      }
      return judge(url, recipe, html);
    })).filter(Boolean) as any[];
    // Recipes found by the Home Assistant laptop (Allrecipes, Serious Eats) arrive already read; judge them the same way.
    const judge = (url: string, recipe: any, html: string) => {
      const lines: string[] = Array.isArray(recipe?.recipeIngredient) ? recipe.recipeIngredient.map(String) : [];
      if (!lines.length) return null;
      const ings = names(lines).filter((i) => !staples.has(i));
      const uses = ings.filter((i) => main.includes(i));
      // Recipes that use something from home and need at most 3 other things (staples don't count).
      // Pasta shapes swap freely: any pasta at home covers a recipe's linguine, penne, etc.
      // A recipe's plain "chicken" is covered by any chicken pieces at home; a specific cut needs that cut.
      const need = ings.filter((i) => !have.includes(i) && !(PASTA.has(i) && havePasta) && !(i === "chicken" && haveChicken) && !(i === "lettuce" && haveLettuce));
      if (focus && !ings.includes(focus)) return null;
      if (!uses.length || need.length > 3 || !focus && uses.length < Math.min(2, main.length) && need.length > 1) return null;
      let image = recipe.image; if (Array.isArray(image)) image = image[0]; if (image && typeof image === "object") image = image.url || image.contentUrl;
      const host = new URL(url).hostname.replace(/^www\./, "");
      perSite[host] = (perSite[host] || 0) + 1;
      return { url, title: decode(recipe.name || (html && meta(html, "og:title")) || ""), image: image || (html && meta(html, "og:image")) || null,
        site: html && meta(html, "og:site_name") ? decode(meta(html, "og:site_name")) : host,
        uses, fresh: uses.filter((i) => fresh.includes(i)), need, all: ings };
    };
    const results = round?.home ? round.home.map((r: any) => { const j = judge(r.url, { name: r.title, image: r.image, recipeIngredient: r.lines }, ""); return j && { ...j, site: r.site || j.site }; }).filter(Boolean) as any[] : await judgeAll(pick);
    // Best first: needs the fewest extra things, then uses the most from home (fridge items count extra).
    results.sort((a, b) => a.need.length - b.need.length || (b.uses.length + b.fresh.length) - (a.uses.length + a.fresh.length));
    return { results: round ? results : results.slice(0, daily ? 60 : 40), searched: queries, candidates: cand.length, checked: results.length, picked: pick, perSite };
}
