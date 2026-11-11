// Supabase Edge Function: refresh-prices
// Re-checks each ingredient's linked Fairway product page (shop.fairwaymarket.com) and updates
// the stored price. Body: {} to refresh everything, or { ingredient: "lemons" } for one.
// Only approved household members can call it. Only shop.fairwaymarket.com product pages are fetched.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const FAIRWAY = /^https:\/\/shop\.fairwaymarket\.com\/store\/fairway\/products\/[\w-]+/;

function product(node: any): any {
  if (!node) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = product(n); if (r) return r; } return null; }
  if (typeof node === "object") {
    const t = node["@type"]; if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return node;
    if (node["@graph"]) return product(node["@graph"]);
  }
  return null;
}

async function readProduct(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
      "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Fairway answered ${res.status}`);
  const html = await res.text();
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const p = product(JSON.parse(m[1].trim()));
      if (p) {
        const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
        return {
          name: String(p.name || ""),
          size: p.size ? String(p.size) : "",
          price: offer?.price != null ? Number(offer.price) : null,
          available: !/OutOfStock|Discontinued/i.test(String(offer?.availability || "")),
        };
      }
    } catch {
      // Some pages have characters that break strict JSON parsing; read the fields directly instead.
      const block = m[1];
      if (/"@type"\s*:\s*"Product"/.test(block)) {
        const price = block.match(/"price"\s*:\s*"?([\d.]+)/)?.[1];
        const name = block.match(/"name"\s*:\s*"([^"]+)"/)?.[1] || "";
        const size = block.match(/"size"\s*:\s*"([^"]+)"/)?.[1] || "";
        const avail = block.match(/"availability"\s*:\s*"([^"]+)"/)?.[1] || "";
        if (price) return { name, size, price: Number(price), available: !/OutOfStock|Discontinued/i.test(avail) };
        return { name, size, price: null, available: false };
      }
    }
  }
  throw new Error("No price found on that page");
}

function label(amount: number, size: string, old: string | null) {
  const p = `$${amount.toFixed(2)}`;
  if (/per lb/i.test(size)) return `${p}/lb`;
  if (old && /each \(est\.\)/.test(old)) return `${p} each (est.)`;
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ok } = await user.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can refresh prices." }, 403);
    const { data: { user: me } } = await user.auth.getUser();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    let q = admin.from("prices").select("*");
    if (body?.ingredient) q = q.eq("ingredient", body.ingredient);
    const { data: rows, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const linked = (rows || []).filter((r) => r.link && FAIRWAY.test(r.link));
    const changed: any[] = [], failed: any[] = [], unavailable: string[] = [];
    const now = new Date().toISOString();

    // A few at a time so we stay polite to the store's site.
    for (let i = 0; i < linked.length; i += 6) {
      await Promise.all(linked.slice(i, i + 6).map(async (r) => {
        try {
          const p = await readProduct(r.link);
          if (p.price == null) {
            // Product page exists but lists no price: most likely discontinued. Keep the old price, flag it.
            unavailable.push(r.ingredient);
            await admin.from("prices").update({ available: false, checked_at: now }).eq("ingredient", r.ingredient);
            failed.push({ ingredient: r.ingredient, reason: "No price listed (may be discontinued)" });
            return;
          }
          const price = label(p.price, p.size, r.price);
          const size = /per lb/i.test(p.size) ? "" : (r.size || p.size);
          if (price !== r.price) changed.push({ ingredient: r.ingredient, from: r.price, to: price });
          if (!p.available) unavailable.push(r.ingredient);
          await admin.from("prices").update({
            price, size, item: r.item || p.name, available: p.available, checked_at: now,
            updated_at: price !== r.price ? now : r.updated_at, source: "Fairway",
          }).eq("ingredient", r.ingredient);
        } catch (e) {
          failed.push({ ingredient: r.ingredient, reason: (e as Error).message });
          await admin.from("prices").update({ checked_at: now }).eq("ingredient", r.ingredient);
        }
      }));
    }

    // Ingredients in the recipe box with no Fairway product linked yet.
    const { data: recipes } = await admin.from("recipes").select("ingredients");
    const all = new Set((recipes || []).flatMap((r: any) => r.ingredients as string[]));
    const { data: allPrices } = await admin.from("prices").select("ingredient,link,price");
    const linkedSet = new Set((allPrices || []).filter((p) => p.link && FAIRWAY.test(p.link)).map((p) => p.ingredient));
    const pricedSet = new Set((allPrices || []).filter((p) => p.price).map((p) => p.ingredient));
    const needs_link = [...all].filter((i) => !linkedSet.has(i)).sort();
    const needs_price = needs_link.filter((i) => !pricedSet.has(i));

    if (!body?.ingredient) {
      await admin.from("activity").insert({
        user_id: me?.id ?? null, action: "refreshed Fairway prices",
        item: `${linked.length} checked, ${changed.length} changed${failed.length ? `, ${failed.length} couldn't be read` : ""}`,
      });
    }
    return json({ checked: linked.length, changed, failed, unavailable, needs_link, needs_price, checked_at: now });
  } catch (e) {
    return json({ error: "Refresh failed: " + (e as Error).message }, 500);
  }
});
