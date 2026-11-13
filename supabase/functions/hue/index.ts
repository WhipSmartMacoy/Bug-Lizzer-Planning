// Supabase Edge Function: hue
// Controls the household's Philips Hue lights through Hue's cloud (Remote API, CLIP v2).
// Secrets (set in Supabase → Edge Functions → Secrets): HUE_CLIENT_ID, HUE_CLIENT_SECRET.
// Tokens live in public.hue_link, readable only with the service role (this function).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const APP_URL = "https://whipsmartmacoy.github.io/Bug-Lizzer-Planning/";
const API = "https://api.meethue.com";
const env = (k: string) => Deno.env.get(k) ?? "";
const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const basic = () => "Basic " + btoa(`${env("HUE_CLIENT_ID")}:${env("HUE_CLIENT_SECRET")}`);

async function saveTokens(db: any, t: any, extra: Record<string, unknown> = {}) {
  await db.from("hue_link").upsert({ id: 1, access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + (+t.expires_in || 3600) * 1000 - 60000).toISOString(), updated_at: new Date().toISOString(), ...extra });
}
async function token(db: any) {
  const { data: l } = await db.from("hue_link").select("*").eq("id", 1).maybeSingle();
  if (!l?.access_token || !l?.app_key) return null;
  if (new Date(l.expires_at) > new Date()) return l;
  const r = await fetch(`${API}/v2/oauth2/token`, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: l.refresh_token }) });
  if (!r.ok) return null;
  const t = await r.json(); await saveTokens(db, t);
  return { ...l, access_token: t.access_token };
}
async function clip(l: any, path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${API}/route/clip/v2/resource/${path}`, { method,
    headers: { Authorization: `Bearer ${l.access_token}`, "hue-application-key": l.app_key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.errors?.[0]?.description || `Hue answered ${r.status}`);
  return j.data || [];
}

// ---- Light show: chase a few colors around a room's lights, then put every light back how it was ----
const PALETTE = [
  { xy: { x: 0.1532, y: 0.0475 }, mirek: 153, bri: 100 },   // blue
  { xy: { x: 0.2148, y: 0.2535 }, mirek: 153, bri: 80 },    // light blue
  { xy: { x: 0.3227, y: 0.329 }, mirek: 250, bri: 100 },    // white
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function chase(l: any, lights: any[], seconds: number, stepMs = 1000) {
  const snap = lights.map((x) => ({ id: x.id, on: !!x.on?.on, bri: x.dimming?.brightness, xy: x.color?.xy,
    mirek: x.color_temperature?.mirek_valid ? x.color_temperature?.mirek : null }));
  const end = Date.now() + seconds * 1000;
  for (let step = 0; Date.now() < end; step++) {
    const t0 = Date.now();
    await Promise.all(lights.map((x, i) => {
      const c = PALETTE[(i + step) % PALETTE.length];
      const b: any = { on: { on: true }, dimming: { brightness: c.bri }, dynamics: { duration: Math.round(stepMs * 0.6) } };
      if (x.color) b.color = { xy: c.xy };                          // color bulbs: real colors
      else if (x.color_temperature) b.color_temperature = { mirek: c.mirek };   // white-only bulbs: cool/neutral pulse
      return clip(l, `light/${x.id}`, "PUT", b).catch(() => {});
    }));
    await wait(Math.max(0, stepMs - (Date.now() - t0)));
  }
  await Promise.all(snap.map((s) => {
    const b: any = { on: { on: s.on }, dynamics: { duration: 800 } };
    if (s.on) { if (s.bri != null) b.dimming = { brightness: s.bri }; if (s.mirek) b.color_temperature = { mirek: s.mirek }; else if (s.xy) b.color = { xy: s.xy }; }
    return clip(l, `light/${s.id}`, "PUT", b).catch(() => {});
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url), db = admin();
  try {
    // 1) Hue sends the browser back here after sign-in.
    if (req.method === "GET" && url.searchParams.get("code")) {
      const { data: l } = await db.from("hue_link").select("pending_state").eq("id", 1).maybeSingle();
      if (!l?.pending_state || l.pending_state !== url.searchParams.get("state")) return Response.redirect(APP_URL + "#hue=badstate", 302);
      const r = await fetch(`${API}/v2/oauth2/token`, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code")! }) });
      if (!r.ok) return Response.redirect(APP_URL + "#hue=tokenfail", 302);
      const t = await r.json();
      // Create this app's key on the bridge (remote "link button").
      const H = { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" };
      await fetch(`${API}/route/api/0/config`, { method: "PUT", headers: H, body: JSON.stringify({ linkbutton: true }) });
      const k = await fetch(`${API}/route/api`, { method: "POST", headers: H, body: JSON.stringify({ devicetype: "bug-lizzer-planning" }) }).then((x) => x.json());
      const app_key = k?.[0]?.success?.username;
      if (!app_key) return Response.redirect(APP_URL + "#hue=nokey", 302);
      await saveTokens(db, t, { app_key, pending_state: null });
      return Response.redirect(APP_URL + "#hue=ok", 302);
    }
    // Everything else: approved household members only.
    const user = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: ok } = await user.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can use the lights." }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.action === "start") {
      if (!env("HUE_CLIENT_ID") || !env("HUE_CLIENT_SECRET")) return json({ error: "Hue keys aren't set up in Supabase yet." });
      const state = crypto.randomUUID();
      await db.from("hue_link").upsert({ id: 1, pending_state: state, updated_at: new Date().toISOString() });
      return json({ url: `${API}/v2/oauth2/authorize?client_id=${encodeURIComponent(env("HUE_CLIENT_ID"))}&response_type=code&state=${state}` });
    }
    const l = await token(db);
    if (!l) return json({ connected: false, keys: !!env("HUE_CLIENT_ID") });
    if (body.action === "set" && body.grouped_light) {
      const b: any = {};
      if (body.on != null) b.on = { on: !!body.on };
      if (body.brightness != null) b.dimming = { brightness: Math.max(1, Math.min(100, +body.brightness)) };
      if (body.mirek != null) b.color_temperature = { mirek: +body.mirek };
      await clip(l, `grouped_light/${body.grouped_light}`, "PUT", b);
    }
    if (body.action === "scene" && body.scene) await clip(l, `scene/${body.scene}`, "PUT", { recall: { action: "active" } });
    if (body.action === "chase") {
      const [rooms, lights] = await Promise.all([clip(l, "room"), clip(l, "light")]);
      const want = String(body.room || "living");
      const room = rooms.find((r: any) => (r.metadata?.name || "").toLowerCase() === want.toLowerCase())
        || rooms.find((r: any) => (r.metadata?.name || "").toLowerCase().includes(want.toLowerCase()));
      if (!room) return json({ error: `No Hue room called "${want}". Rooms: ${rooms.map((r: any) => r.metadata?.name).join(", ")}` });
      const kids = new Set((room.children || []).map((c: any) => c.rid));
      const ls = lights.filter((x: any) => kids.has(x.id) || kids.has(x.owner?.rid));
      if (!ls.length) return json({ error: `No lights in ${room.metadata?.name}` });
      const secs = Math.max(5, Math.min(120, +body.seconds || 30));
      // Run the show in the background so the app gets an answer right away.
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(chase(l, ls, secs));
      return json({ ok: true, room: room.metadata?.name, lights: ls.length, seconds: secs });
    }
    // Rooms with their light group state and scenes.
    const [rooms, zones, groups, scenes] = await Promise.all([clip(l, "room"), clip(l, "zone"), clip(l, "grouped_light"), clip(l, "scene")]);
    const g = new Map(groups.map((x: any) => [x.id, x]));
    const out = [...rooms, ...zones].map((r: any) => {
      const gl = r.services?.find((s: any) => s.rtype === "grouped_light")?.rid; const st: any = g.get(gl) || {};
      return { id: r.id, name: r.metadata?.name, kind: r.type, archetype: r.metadata?.archetype, grouped_light: gl, on: !!st.on?.on, brightness: st.dimming?.brightness ?? null,
        scenes: scenes.filter((s: any) => s.group?.rid === r.id).map((s: any) => ({ id: s.id, name: s.metadata?.name, active: s.status?.active && s.status.active !== "inactive" })) };
    }).filter((r: any) => r.grouped_light);
    return json({ connected: true, rooms: out });
  } catch (e) {
    return json({ error: (e as Error).message });
  }
});
