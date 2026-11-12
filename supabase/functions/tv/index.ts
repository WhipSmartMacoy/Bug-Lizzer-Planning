// Supabase Edge Function: tv
// A small queue between the app and the bridge program running on the home PC.
//  · Household members (signed in): {action:'send', cmd, args} and {action:'status'}.
//  · The home PC bridge (x-device-token header = app_settings 'tv_device_token'):
//      {action:'poll', info?} → pending commands;  {action:'done', id, result}.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";
const CMDS = new Set(["on", "off", "disney", "jeopardy", "rest", "volume_up", "volume_down", "mute", "home", "test"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  try {
    const dev = req.headers.get("x-device-token");
    if (dev) {
      const { data: t } = await db.from("app_settings").select("value").eq("key", "tv_device_token").maybeSingle();
      if (!t?.value || t.value !== dev) return json({ error: "Unknown device." }, 403);
      if (body.action === "done" && body.id) {
        await db.from("tv_commands").update({ done_at: now, result: String(body.result ?? "ok").slice(0, 300) }).eq("id", body.id);
        return json({ ok: true });
      }
      await db.from("app_settings").upsert({ key: "tv_bridge_seen", value: JSON.stringify({ at: now, info: body.info ?? null }), updated_at: now });
      // Commands older than 2 minutes are stale (e.g. the PC was asleep): skip them.
      const since = new Date(Date.now() - 120000).toISOString();
      const { data: cmds } = await db.from("tv_commands").select("id,cmd,args").is("taken_at", null).gte("created_at", since).order("id");
      if (cmds?.length) await db.from("tv_commands").update({ taken_at: now }).in("id", cmds.map((c) => c.id));
      return json({ commands: cmds || [] });
    }
    const user = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: ok } = await user.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can use the TV." }, 403);
    const { data: { user: u } } = await user.auth.getUser();
    if (body.action === "send") {
      if (!CMDS.has(body.cmd)) return json({ error: "Unknown TV command." }, 400);
      const { data, error } = await db.from("tv_commands").insert({ cmd: body.cmd, args: body.args ?? null, created_by: u?.id }).select("id").single();
      if (error) return json({ error: error.message });
      return json({ id: data.id });
    }
    if (body.action === "result" && body.id) {
      const { data } = await db.from("tv_commands").select("taken_at,done_at,result").eq("id", body.id).maybeSingle();
      return json(data || {});
    }
    const { data: seen } = await db.from("app_settings").select("value").eq("key", "tv_bridge_seen").maybeSingle();
    let s: any = null; try { s = seen?.value ? JSON.parse(seen.value) : null; } catch { /* */ }
    return json({ bridge_seen: s?.at || null, info: s?.info || null, online: !!s && Date.now() - new Date(s.at).getTime() < 30000 });
  } catch (e) {
    return json({ error: (e as Error).message });
  }
});
