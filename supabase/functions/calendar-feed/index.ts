// Supabase Edge Function: calendar-feed
// Reads the household's published iCloud calendar (link kept in app_settings, members only),
// and returns upcoming events, with repeating events expanded. Read-only.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Ev = { uid: string; title: string; location?: string; allDay: boolean; start: string; end?: string; tz?: string; utc: boolean };

// "20261112T090000Z" / "20261112T090000" / "20261112" -> parts
function parseDT(v: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0, s: m[6] ? +m[6] : 0, date: !m[4], utc: !!m[7] };
}
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (p: any) => p.date ? `${p.y}-${pad(p.mo)}-${pad(p.d)}` : `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${p.utc ? "Z" : ""}`;
// Work in "wall clock" Date objects (UTC fields used as plain calendar fields)
const toD = (p: any) => new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s));
const fromD = (d: Date, like: any) => ({ ...like, y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() });
const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function unfold(ics: string) { return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, ""); }
const unesc = (s = "") => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

function events(ics: string, from: Date, to: Date): Ev[] {
  const out: Ev[] = [];
  const blocks = unfold(ics).split("BEGIN:VEVENT").slice(1).map((b) => b.split("END:VEVENT")[0]);
  const overrides = new Map<string, Set<string>>(); // uid -> RECURRENCE-ID starts that are replaced
  const parsed = blocks.map((b) => {
    const props: Record<string, { params: string; value: string }[]> = {};
    for (const line of b.split("\n")) {
      const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/); if (!m) continue;
      (props[m[1]] ||= []).push({ params: m[2] || "", value: m[3] });
    }
    return props;
  });
  for (const p of parsed) {
    const rid = p["RECURRENCE-ID"]?.[0]; const uid = p.UID?.[0]?.value || "";
    if (rid) { const r = parseDT(rid.value); if (r) (overrides.get(uid) || overrides.set(uid, new Set()).get(uid)!).add(fmt(r)); }
  }
  for (const p of parsed) {
    const ds = p.DTSTART?.[0]; if (!ds) continue;
    const st = parseDT(ds.value); if (!st) continue;
    const tz = ds.params.match(/TZID=([^;:]+)/)?.[1];
    const de = p.DTEND?.[0] ? parseDT(p.DTEND[0].value) : null;
    const dur = de ? toD(de).getTime() - toD(st).getTime() : (st.date ? 86400000 : 3600000);
    const uid = p.UID?.[0]?.value || Math.random().toString(36);
    const base = { uid, title: unesc(p.SUMMARY?.[0]?.value) || "(no title)", location: unesc(p.LOCATION?.[0]?.value) || undefined, allDay: st.date, tz, utc: st.utc };
    const add = (s: any) => {
      const sd = toD(s), ed = new Date(sd.getTime() + dur);
      if (ed < from || sd > to) return;
      out.push({ ...base, start: fmt(s), end: fmt(fromD(ed, s)) });
    };
    const rr = p.RRULE?.[0]?.value;
    if (!rr || p["RECURRENCE-ID"]) { add(st); continue; }
    const R: Record<string, string> = Object.fromEntries(rr.split(";").map((kv) => kv.split("=")));
    const freq = R.FREQ, interval = +(R.INTERVAL || 1), count = R.COUNT ? +R.COUNT : Infinity;
    const until = R.UNTIL ? toD(parseDT(R.UNTIL)!) : null;
    const byday = R.BYDAY ? R.BYDAY.split(",").map((x) => DAYS.indexOf(x.slice(-2))) : null;
    const ex = new Set<string>([...(p.EXDATE || []).flatMap((e) => e.value.split(",")).map((v) => { const x = parseDT(v); return x ? fmt({ ...x, utc: st.utc, date: st.date }) : ""; }), ...(overrides.get(uid) || [])]);
    let n = 0; let cur = toD(st); const limit = new Date(to.getTime() + 86400000);
    for (let guard = 0; guard < 3000 && cur <= limit && n < count; guard++) {
      const cands: Date[] = [];
      if (freq === "WEEKLY" && byday) {
        const wk = new Date(cur); wk.setUTCDate(wk.getUTCDate() - wk.getUTCDay());
        for (const d of byday) { const c = new Date(wk); c.setUTCDate(c.getUTCDate() + d); c.setUTCHours(cur.getUTCHours(), cur.getUTCMinutes(), cur.getUTCSeconds()); if (c >= toD(st)) cands.push(c); }
      } else cands.push(new Date(cur));
      for (const c of cands.sort((a, b) => +a - +b)) {
        if (until && c > until) { n = count; break; }
        if (n >= count) break;
        n++;
        const s = fromD(c, st);
        if (!ex.has(fmt(s))) add(s);
      }
      if (freq === "DAILY") cur.setUTCDate(cur.getUTCDate() + interval);
      else if (freq === "WEEKLY") cur.setUTCDate(cur.getUTCDate() + 7 * interval);
      else if (freq === "MONTHLY") cur.setUTCMonth(cur.getUTCMonth() + interval);
      else if (freq === "YEARLY") cur.setUTCFullYear(cur.getUTCFullYear() + interval);
      else break;
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: ok } = await sb.rpc("is_member");
    if (!ok) return json({ error: "Only approved household members can see the calendar." }, 403);
    const { data: row } = await sb.from("app_settings").select("value").eq("key", "ical_url").maybeSingle();
    if (!row?.value) return json({ error: "No calendar linked yet.", events: [] });
    const url = row.value.trim().replace(/^webcal:\/\//i, "https://");
    if (!/^https:\/\/[a-z0-9.-]*icloud\.com\//i.test(url) && !/^https:\/\//i.test(url)) return json({ error: "That calendar link doesn't look right." }, 400);
    const body = await req.json().catch(() => ({}));
    const days = Math.min(+(body.days || 60), 180);
    const from = new Date(Date.now() - 2 * 86400000), to = new Date(Date.now() + days * 86400000);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Bug-Lizzer-Planning" }, redirect: "follow" });
    if (!res.ok) return json({ error: `The calendar answered ${res.status}.`, events: [] });
    const ics = await res.text();
    const name = unesc(unfold(ics).match(/^X-WR-CALNAME:(.*)$/m)?.[1]) || "Calendar";
    const tz = unfold(ics).match(/^X-WR-TIMEZONE:(.*)$/m)?.[1]?.trim();
    return json({ name, tz, events: events(ics, from, to), fetched_at: new Date().toISOString() });
  } catch (e) {
    return json({ error: "Couldn't read the calendar: " + (e as Error).message, events: [] }, 200);
  }
});
