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

function names(lines: string[]): string[] {
  const out = new Set<string>();
  for (const raw of lines) for (const n of lineNames(raw)) out.add(n);
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
// Each site's search page, and the pattern its recipe links follow.
const SITES = [
  { name: "Serious Eats", search: (q: string) => `https://www.seriouseats.com/search?q=${encodeURIComponent(q)}`,
    link: /href="(https:\/\/www\.seriouseats\.com\/[a-z0-9-]+-recipe[a-z0-9-]*)"/g },
  { name: "NYT Cooking", search: (q: string) => `https://cooking.nytimes.com/search?q=${encodeURIComponent(q)}`,
    link: /href="(\/recipes\/\d+-[a-z0-9-]+)"/g, base: "https://cooking.nytimes.com" },
  { name: "Allrecipes", search: (q: string) => `https://www.allrecipes.com/search?q=${encodeURIComponent(q)}`,
    link: /href="(https:\/\/www\.allrecipes\.com\/recipe\/\d+\/[a-z0-9-]+\/?)"/g },
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
    const have: string[] = (body.have || []).map((s: string) => String(s).toLowerCase()).slice(0, 40);
    const fresh: string[] = (body.fresh || []).map((s: string) => String(s).toLowerCase()).filter((s: string) => have.includes(s));
    const staples = new Set<string>((body.staples || []).map((s: string) => String(s).toLowerCase()));
    const skip = new Set<string>(body.exclude || []);
    if (!have.length) return json({ results: [], searched: [] });

    // Searches: the fridge items (they spoil first) in pairs, then on their own, then the rest.
    const lead = [...fresh, ...have.filter((h) => !fresh.includes(h))];
    const qs: string[] = [];
    if (lead.length >= 2) qs.push(`${lead[0]} ${lead[1]}`);
    if (lead.length >= 3) qs.push(`${lead[0]} ${lead[2]}`, `${lead[1]} ${lead[2]}`);
    for (const x of lead.slice(0, 3)) qs.push(x);
    const queries = [...new Set(qs)].slice(0, 5);

    const pages = await Promise.all(queries.flatMap((q) => SITES.map(async (s) => ({ s, html: await get(s.search(q)) }))));
    const cand: string[] = [], seen = new Set<string>(), perSite: Record<string, number> = {};
    // Interleave sites so one site doesn't crowd out the others.
    const lists = pages.map(({ s, html }) => [...html.matchAll(s.link)].map((m) => ((s as any).base || "") + m[1].replace(/\/$/, "")));
    for (let k = 0; k < 12; k++) for (const l of lists) { const u = l[k]; if (u && !seen.has(u) && !skip.has(u)) { seen.add(u); cand.push(u); } }
    const pick = cand.slice(0, 24);

    const results = (await Promise.all(pick.map(async (url) => {
      const html = await get(url, 8000); if (!html) return null;
      let recipe: any = null;
      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch { /* skip */ }
        if (recipe) break;
      }
      const lines: string[] = Array.isArray(recipe?.recipeIngredient) ? recipe.recipeIngredient.map(String) : [];
      if (!lines.length) return null;
      const ings = names(lines).filter((i) => !staples.has(i));
      const uses = ings.filter((i) => have.includes(i));
      if (!uses.length) return null;
      let image = recipe.image; if (Array.isArray(image)) image = image[0]; if (image && typeof image === "object") image = image.url || image.contentUrl;
      const host = new URL(url).hostname.replace(/^www\./, "");
      perSite[host] = (perSite[host] || 0) + 1;
      return { url, title: decode(recipe.name || meta(html, "og:title") || ""), image: image || meta(html, "og:image") || null,
        site: meta(html, "og:site_name") ? decode(meta(html, "og:site_name")) : host,
        uses, fresh: uses.filter((i) => fresh.includes(i)), need: ings.filter((i) => !have.includes(i)) };
    }))).filter(Boolean) as any[];
    results.sort((a, b) => b.fresh.length - a.fresh.length || b.uses.length - a.uses.length || a.need.length - b.need.length);
    return json({ results: results.slice(0, 15), searched: queries, candidates: cand.length, perSite });
  } catch (e) {
    return json({ error: "Search failed: " + (e as Error).message }, 200);
  }
});
