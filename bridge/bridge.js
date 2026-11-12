// Bug-Lizzer TV bridge — runs on the home PC.
// Every 2 seconds it asks the app's server for TV commands and carries them out on the LG TV
// over the home network. Nothing connects in to this PC; it only reaches out.
const fs = require('fs'), path = require('path'), dgram = require('dgram');
const CFG_FILE = path.join(__dirname, 'config.json');
const KEY_FILE = path.join(__dirname, 'lgtv-key.txt');
const cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
const save = () => fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DISNEY = 'com.disney.disneyplus-prod';

// ---- find the TV on the network (SSDP) ----
function discover(ms = 4000) {
  return new Promise(resolve => {
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true }); let done = false;
    const finish = ip => { if (done) return; done = true; try { s.close(); } catch {} resolve(ip); };
    s.on('message', (msg, rinfo) => { if (/webos|lge/i.test(msg.toString())) finish(rinfo.address); });
    s.on('error', () => finish(null));
    s.bind(() => {
      const q = Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:lge-com:service:webos-second-screen:1\r\n\r\n');
      s.send(q, 1900, '239.255.255.250'); setTimeout(() => s.send(q, 1900, '239.255.255.250'), 800);
    });
    setTimeout(() => finish(null), ms);
  });
}

// ---- Wake-on-LAN (turning the TV on) ----
function wake(mac) {
  return new Promise(resolve => {
    if (!mac) return resolve(false);
    const hex = mac.replace(/[^0-9a-f]/gi, ''); if (hex.length !== 12) return resolve(false);
    const m = Buffer.from(hex, 'hex'), pkt = Buffer.alloc(102, 0xff);
    for (let i = 6; i < 102; i += 6) m.copy(pkt, i);
    const s = dgram.createSocket('udp4');
    s.bind(() => { s.setBroadcast(true); let n = 0;
      const fire = () => s.send(pkt, 9, '255.255.255.255', () => { if (++n < 3) setTimeout(fire, 300); else { s.close(); resolve(true); } });
      fire(); });
  });
}

// ---- TV connection (lgtv2) ----
let tv = null, tvUp = false, connecting = null;
function connect() {
  if (tvUp) return Promise.resolve(true);
  if (connecting) return connecting;
  connecting = new Promise(async resolve => {
    if (!cfg.tvIp) { const ip = await discover(); if (ip) { cfg.tvIp = ip; save(); log('Found the TV at', ip); } }
    if (!cfg.tvIp) { connecting = null; return resolve(false); }
    const tryUrl = url => new Promise(res => {
      const c = require('lgtv2')({ url, keyFile: KEY_FILE, timeout: 6000, reconnect: 0, wsconfig: { tlsOptions: { rejectUnauthorized: false } } });
      let settled = false; const end = v => { if (!settled) { settled = true; res(v ? c : null); } };
      c.on('prompt', () => log('>>> Look at the TV and accept the "Bug-Lizzer" connection request (first time only).'));
      c.on('connect', () => end(true));
      c.on('error', () => end(false));
      c.on('close', () => { if (tv === c) { tvUp = false; } end(false); });
      setTimeout(() => end(false), 30000);
    });
    const c = (await tryUrl(`wss://${cfg.tvIp}:3001`)) || (await tryUrl(`ws://${cfg.tvIp}:3000`));
    connecting = null;
    if (!c) return resolve(false);
    tv = c; tvUp = true; log('Connected to the TV.');
    if (!cfg.tvMac) tv.request('ssap://com.webos.service.connectionmanager/getinfo', (e, r) => {
      const mac = r?.wiredInfo?.macAddress || r?.wifiInfo?.macAddress; if (mac) { cfg.tvMac = mac; save(); log('Saved the TV\'s network address for turning it on:', mac); } });
    resolve(true);
  });
  return connecting;
}
const req = (uri, payload = {}) => new Promise((res, rej) => tv.request(uri, payload, (e, r) => e ? rej(e) : res(r)));

async function ensureOn() {
  if (await connect()) return true;
  log('TV seems off — sending wake signal.');
  await wake(cfg.tvMac);
  for (let i = 0; i < 12; i++) { await sleep(2500); if (await connect()) return true; }
  return false;
}

async function run(c) {
  switch (c.cmd) {
    case 'test': return (await connect()) ? 'TV reachable' : 'TV not found (is it on?)';
    case 'on': return (await ensureOn()) ? 'TV on' : 'Could not turn the TV on — check "Turn on via Wi-Fi" in the TV settings';
    case 'off': if (!(await connect())) return 'TV already off'; await req('ssap://system/turnOff'); tvUp = false; return 'TV off';
    case 'rest': if (!(await connect())) return 'TV already off'; await req('ssap://system/turnOff'); tvUp = false; return 'TV off';
    case 'disney': case 'jeopardy':
      if (!(await ensureOn())) return 'Could not reach the TV';
      await req('ssap://system.launcher/launch', { id: DISNEY });
      return c.cmd === 'jeopardy' ? 'Disney+ open — pick up JEOPARDY! from Continue Watching' : 'Disney+ open';
    case 'volume_up': if (!(await connect())) return 'TV off'; await req('ssap://audio/volumeUp'); return 'Volume up';
    case 'volume_down': if (!(await connect())) return 'TV off'; await req('ssap://audio/volumeDown'); return 'Volume down';
    case 'mute': if (!(await connect())) return 'TV off'; { const s = await req('ssap://audio/getStatus'); await req('ssap://audio/setMute', { mute: !s?.mute }); } return 'Mute toggled';
    case 'home': if (!(await connect())) return 'TV off'; await req('ssap://system.launcher/launch', { id: 'com.webos.app.home' }).catch(() => {}); return 'Home';
    default: return 'Unknown command';
  }
}

async function call(body) {
  const r = await fetch(`${cfg.supabaseUrl}/functions/v1/tv`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.publishableKey, 'x-device-token': cfg.deviceToken }, body: JSON.stringify(body) });
  return r.json();
}

(async () => {
  log('Bug-Lizzer TV bridge started. Leave this window open (you can minimize it).');
  connect().then(ok => log(ok ? 'TV is on and reachable.' : 'TV not reachable right now (it may be off). Commands will still work once it\'s on, or via wake-up.'));
  let failures = 0;
  for (;;) {
    try {
      const r = await call({ action: 'poll', info: { tv: tvUp, ip: cfg.tvIp || null, host: require('os').hostname() } });
      if (r.error) { log('Server:', r.error); await sleep(10000); continue; }
      failures = 0;
      for (const c of r.commands || []) {
        log('Command:', c.cmd);
        let result; try { result = await run(c); } catch (e) { result = 'Error: ' + (e.message || e); }
        log(' →', result);
        await call({ action: 'done', id: c.id, result }).catch(() => {});
      }
    } catch (e) { if (++failures % 15 === 1) log('Can\'t reach the server (internet down?). Retrying…'); }
    await sleep(2000);
  }
})();
