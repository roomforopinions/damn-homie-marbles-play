// Damn Homie Party: phone controllers, host side (Claude Morty, T-034). Game-agnostic lobby layer + the Osaka GP adapter.
// The browser running the race is the host. Phones open controller/?room=CODE (QR on screen), pick a marble, tap Ready and
// send emotes / hype / a 40-char bubble; the winner's phone can send the bragging line. Phones never run the race.
// Transport: a WebSocket relay (MQTT over wss on free public brokers, no account); see the transport section. Messages are small
// JSON objects; see controller/index.html for the phone side.
const D = window.__dh;
const MQTT_URLS = ['https://esm.sh/mqtt@5.10.1?bundle', 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.esm.js'];
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const TOPIC = 'dhmarbles/v1/';
const QR_URLS = ['https://esm.sh/qrcode-generator@1.4.4', 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm'];
const MAX_PHONES = 8, EMOTE_GAP = 1200, BUBBLE_GAP = 2500;
const EMO = { heart: '❤️', kiss: '😘', laugh: '😂', fire: '🔥', finger: '🖕', cry: '😭', shock: '😱', crown: '👑', cheer: '📣' };
const BAD = ['fuck', 'fuk', 'fck', 'fack', 'phuk', 'phuck', 'biatch', 'btch', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'cock', 'fag', 'nigg', 'retard', 'whore', 'slut', 'twat', 'wank', 'kike', 'spic', 'chink', 'tranny', 'rape'];
const norm = (x) => x.toLowerCase().replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't');
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).split(' ').map((w) => (BAD.some((b) => norm(w).replace(/[^a-z]/g, '').includes(b)) ? '★'.repeat(Math.min(6, w.length)) : w)).join(' ');
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, no digits: easy to read off a TV
const newCode = () => Array.from({ length: 5 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
async function firstImport(urls) { let err; for (const u of urls) { try { return await import(u); } catch (e) { err = e; } } throw err; }

const party = {
  clients: null, code: '', open: false, phones: new Map(), // phone id -> { id, name, conn, k, ready, online, lastEmo, lastBub, color }
  status: 'off', lastPhase: '', lastSent: 0,
  joinUrl() { const u = new URL('controller/', location.href); u.search = '?room=' + this.code; return u.href; },
};
window.DHParty = party;

// ---------- UI ----------
const css = document.createElement('style');
css.textContent = `#dhpBtn{position:fixed;left:12px;bottom:12px;z-index:30;font:700 15px/1 system-ui,sans-serif;padding:10px 14px;border-radius:12px;border:0;background:#ff2d95;color:#fff;box-shadow:0 4px 16px #0008;cursor:pointer}
#dhpPanel{position:fixed;inset:0;z-index:31;display:none;align-items:center;justify-content:center;background:#05040acc;backdrop-filter:blur(4px);font-family:system-ui,sans-serif;color:#fff}
#dhpPanel.on{display:flex}#dhpBox{background:#16131f;border-radius:20px;padding:22px 26px;width:min(820px,94vw);display:grid;grid-template-columns:auto 1fr;gap:22px;box-shadow:0 10px 40px #000a}
#dhpQR{width:220px;height:220px;background:#fff;border-radius:12px;display:grid;place-items:center;color:#000;font-size:13px;overflow:hidden}#dhpQR img,#dhpQR svg{width:100%;height:100%}
#dhpCode{font:900 64px/1 system-ui;letter-spacing:.12em;color:#ffb300}#dhpUrl{font-size:13px;opacity:.75;word-break:break-all;margin:6px 0 12px}
#dhpList{display:grid;gap:8px;margin:8px 0 14px}.dhpP{display:flex;align-items:center;gap:10px;background:#221d2e;border-radius:12px;padding:8px 10px;font-weight:700}
.dhpP .b{width:34px;height:34px;border-radius:50%;background:#333 center/cover}.dhpP .s{margin-left:auto;font-size:12px;padding:3px 8px;border-radius:8px;background:#444}.dhpP .s.r{background:#2bd46a;color:#000}.dhpP.off{opacity:.45}
#dhpBox button{font:800 16px system-ui;border:0;border-radius:12px;padding:12px 18px;cursor:pointer}#dhpStart{background:#2bd46a;color:#000}#dhpStart:disabled{background:#444;color:#999;cursor:default}#dhpClose{background:#333;color:#fff;margin-left:8px}
#dhpStat{font-size:12px;opacity:.7;margin-top:10px}
#dhpFx{position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden}.dhpE{position:absolute;transform:translate(-50%,-100%);font-size:44px;text-shadow:0 2px 8px #000;transition:opacity .4s}
.dhpB{position:absolute;transform:translate(-50%,-100%);background:#fff;color:#111;font:800 18px system-ui;padding:6px 12px;border-radius:14px;white-space:nowrap;box-shadow:0 3px 12px #0008}.dhpB:after{content:'';position:absolute;left:50%;bottom:-8px;border:8px solid transparent;border-top-color:#fff;border-bottom:0;transform:translateX(-50%)}
.dhpTag{position:absolute;transform:translate(-50%,-100%);font:900 13px system-ui;padding:2px 7px;border-radius:7px;color:#000;white-space:nowrap}`;
css.textContent += `#dhpToast{position:fixed;top:14px;left:50%;transform:translateX(-50%) translateY(-120%);z-index:32;background:#16131f;color:#fff;font:800 22px system-ui;padding:12px 22px;border-radius:14px;box-shadow:0 6px 24px #000a;border:2px solid #2bd46a;transition:transform .25s}#dhpToast.on{transform:translateX(-50%) translateY(0)}
#dhpStrip{position:fixed;left:12px;bottom:60px;z-index:30;display:flex;flex-direction:column;gap:6px;pointer-events:none}.dhpS{display:flex;align-items:center;gap:7px;background:#16131fd9;color:#fff;font:800 14px system-ui;padding:5px 10px 5px 6px;border-radius:999px}.dhpS i{width:10px;height:10px;border-radius:50%;background:#2bd46a;box-shadow:0 0 8px #2bd46a}.dhpS.off i{background:#777;box-shadow:none}.dhpS .b{width:22px;height:22px;border-radius:50%;background:#333 center/cover}.dhpS small{opacity:.7;font-weight:700}`;
document.head.appendChild(css);
const btn = Object.assign(document.createElement('button'), { id: 'dhpBtn', textContent: '📱 Party (phones)' });
const panel = Object.assign(document.createElement('div'), { id: 'dhpPanel' });
panel.innerHTML = `<div id="dhpBox"><div><div id="dhpQR">loading…</div></div><div>
  <div style="font-weight:800;opacity:.8">DAMN HOMIE PARTY · Game #1 · Osaka Grand Prix</div><div id="dhpCode">·····</div>
  <div id="dhpUrl"></div><div style="font-weight:700">Scan with your phone camera, pick a marble, tap Ready.</div>
  <div id="dhpList"></div><button id="dhpStart" disabled>Start race</button><button id="dhpClose">Close</button><div id="dhpStat"></div></div></div>`;
const fx = Object.assign(document.createElement('div'), { id: 'dhpFx' });
const hostToast = Object.assign(document.createElement('div'), { id: 'dhpToast' }); const strip = Object.assign(document.createElement('div'), { id: 'dhpStrip' });
document.body.append(btn, panel, fx, hostToast, strip);
function toastHost(t) { hostToast.textContent = t; hostToast.classList.add('on'); clearTimeout(toastHost.t); toastHost.t = setTimeout(() => hostToast.classList.remove('on'), 2600); }
const $ = (id) => document.getElementById(id);
btn.onclick = () => { party.open = true; panel.classList.add('on'); if (!party.clients) startHost(); renderLobby(); };
$('dhpClose').onclick = () => { party.open = false; panel.classList.remove('on'); };
$('dhpStart').onclick = () => { panel.classList.remove('on'); party.open = false; D.start(); };
for (const ev of ['keydown', 'keyup', 'pointerdown', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation());

const thumb = (k) => { const r = D.ROSTER[D.FIELD[k]]; return r ? `marbles/thumbs/${r[0]}.jpg` : ''; };
function renderStrip() { strip.innerHTML = [...party.phones.values()].map((p) => `<div class="dhpS${p.online ? '' : ' off'}"><div class="b" style="background-image:url(${thumb(p.k)})"></div><i></i><span style="color:${p.color}">${esc(p.name)}</span><small>${!p.online ? 'offline' : p.ready ? 'ready' : 'paired'}</small></div>`).join(''); btn.textContent = party.phones.size ? `📱 Party · ${[...party.phones.values()].filter((p) => p.online).length} paired` : '📱 Party (phones)'; }
function renderLobby() {
  renderStrip();
  $('dhpCode').textContent = party.code || '·····';
  $('dhpUrl').textContent = party.code ? party.joinUrl() : '';
  const ps = [...party.phones.values()];
  $('dhpList').innerHTML = ps.length ? ps.map((p) => `<div class="dhpP${p.online ? '' : ' off'}"><div class="b" style="background-image:url(${thumb(p.k)})"></div><span style="color:${p.color}">${esc(p.name)}</span> · ${esc(D.ROSTER[D.FIELD[p.k]]?.[1] || '')}<span class="s${p.ready ? ' r' : ''}">${!p.online ? 'OFFLINE' : p.ready ? 'READY' : p.picked ? 'PICKED' : 'PICKING'}</span></div>`).join('') : '<div style="opacity:.6">Waiting for phones…</div>';
  const on = ps.filter((p) => p.online);
  $('dhpStart').disabled = !on.length || on.some((p) => !p.ready);
  $('dhpStat').textContent = { off: '', connecting: 'connecting to the matchmaker…', live: `room live · ${on.length} phone${on.length === 1 ? '' : 's'}`, error: 'could not reach the matchmaker; check the internet and reopen' }[party.status] || party.status;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function drawQR() {
  try { const m = await firstImport(QR_URLS); const qrf = m.default || m; const q = qrf(0, 'M'); q.addData(party.joinUrl()); q.make(); $('dhpQR').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
  catch (e) { $('dhpQR').textContent = 'QR unavailable: type the code at ' + new URL('controller/', location.href).href; }
}

// ---------- transport: WebSocket relay (MQTT over wss on free public brokers) ----------
// Every phone and the host keep one live WebSocket to a public MQTT broker; messages are pushed (no polling) on topics under
// dhmarbles/v1/<CODE>. Works through any home router or phone network (no peer-to-peer hole punching). The host listens on two
// brokers at once; a phone uses the first one it reaches. Heartbeats every 2 s drive the "paired" indicators on both ends.
async function startHost() {
  party.status = 'connecting'; renderLobby();
  let mqtt; try { const m = await firstImport(MQTT_URLS); mqtt = m.default?.connect ? m.default : m.connect ? m : m.default; } catch (e) { party.status = 'error'; renderLobby(); console.warn('[party] MQTT load failed', e); return; }
  party.code = newCode(); const base = TOPIC + party.code;
  party.clients = BROKERS.map((url) => {
    const c = mqtt.connect(url, { clientId: 'dhh_' + party.code + '_' + Math.random().toString(36).slice(2, 7), clean: true, reconnectPeriod: 2000, connectTimeout: 8000, keepalive: 20 });
    c.on('connect', () => { c.subscribe(base + '/up'); if (party.status !== 'live') { party.status = 'live'; renderLobby(); drawQR(); console.log('[party] room', party.code, party.joinUrl(), 'via', url); } });
    c.on('message', (topic, buf) => { try { const msg = JSON.parse(buf.toString()); onPhone(connFor(msg.from), msg); } catch (e) { console.warn('[party] bad msg', e); } });
    c.on('error', (e) => console.warn('[party]', url, e?.message || e));
    return c;
  });
  setTimeout(() => { if (party.status !== 'live') { party.status = 'error'; renderLobby(); } }, 15000);
  setInterval(() => { // heartbeat to every phone + offline detection
    pub(base + '/all', { type: 'hb', code: party.code, n: party.phones.size });
    const now = Date.now(); let changed = false;
    for (const p of party.phones.values()) { const on = now - (p.seen || 0) < 7000; if (on !== p.online) { p.online = on; changed = true; if (!on) toastHost(`📴 ${p.name} dropped`); } }
    if (changed) pushLobby();
  }, 2000);
}
function pub(topic, msg) { const data = JSON.stringify(msg); for (const c of party.clients || []) if (c.connected) c.publish(topic, data); }
function connFor(id) { id = String(id || '').slice(0, 16); return { send: (msg) => pub(TOPIC + party.code + '/down/' + id, msg), open: true }; }
const send = (p, msg) => { try { if (p.online) p.conn.send(msg); } catch (e) {} };
const sendAll = (msg) => { for (const p of party.phones.values()) send(p, msg); };

// ---------- Osaka GP adapter: phones map to session.players and marble slots ----------
function freeSlot() { const used = new Set([...party.phones.values()].map((p) => p.k)); for (const sp of D.session.players) if (!sp.phone) used.add(sp.k); for (let k = 0; k < D.FIELD.length; k++) if (!used.has(k)) return k; return -1; }
function syncSession() { // phones become the game's players (names on the HUD, TV-cam player battles, podium); local players are kept
  const local = D.session.players.filter((sp) => !sp.phone);
  const phones = [...party.phones.values()].map((p, i) => ({ id: 'ph_' + p.id, name: p.name, color: p.color, k: p.k, phone: true }));
  D.setPlayers([...local.slice(0, Math.max(0, 6 - phones.length)), ...phones]);
}
function rosterMsg() { const takenBy = {}; for (const p of party.phones.values()) takenBy[D.ROSTER[D.FIELD[p.k]][0]] = p.name; return { type: 'roster', marbles: D.ROSTER.map(([f, n, c]) => [f, n, c]), taken: takenBy }; }
function lobbyMsg() { return { type: 'lobby', code: party.code, players: [...party.phones.values()].map((p) => ({ id: p.id, name: p.name, marble: D.ROSTER[D.FIELD[p.k]][0], ready: p.ready, online: p.online })) }; }
function pushLobby() { renderLobby(); sendAll(lobbyMsg()); sendAll(rosterMsg()); }

function onPhone(conn, msg) {
  const id = String(msg.from || '').slice(0, 16); if (!id) return;
  let p = party.phones.get(id);
  if (msg.type === 'join') {
    const name = clean(msg.name, 12) || 'Homie';
    if (!p) {
      if (party.phones.size >= MAX_PHONES) { conn.send({ type: 'full' }); return; }
      const k = freeSlot(); if (k < 0) { conn.send({ type: 'full' }); return; }
      p = { id, name, conn, k, ready: false, picked: false, online: true, lastEmo: 0, lastBub: 0, color: D.PCOLORS[party.phones.size % D.PCOLORS.length] };
      party.phones.set(id, p);
      toastHost(`📱 ${name} joined`);
    } else { if (!p.online) toastHost(`📱 ${name} is back`); Object.assign(p, { conn, online: true, name }); } // rejoin after a dropped connection keeps the same marble
    p.seen = Date.now();
    send(p, { type: 'welcome', you: id, name: p.name, color: p.color, marble: D.ROSTER[D.FIELD[p.k]][0], phase: phaseNow() });
    syncSession(); pushLobby(); return;
  }
  if (!p) { if (msg.type !== 'ping') conn.send({ type: 'rejoin' }); return; } p.conn = conn; p.seen = Date.now(); if (!p.online) { p.online = true; pushLobby(); }
  if (msg.type === 'ping') return;
  const now = Date.now();
  switch (msg.type) {
    case 'pick': {
      const r = D.ROSTER.findIndex((x) => x[0] === msg.marble); if (r < 0 || racing()) return;
      const j = D.FIELD.indexOf(r);
      if (j >= 0 && j !== p.k) { if ([...party.phones.values()].some((o) => o !== p && o.k === j) || D.session.players.some((sp) => !sp.phone && sp.k === j)) { send(p, rosterMsg()); return; } D.FIELD[j] = D.FIELD[p.k]; D.skin(j); }
      D.FIELD[p.k] = r; D.skin(p.k); p.picked = true; p.ready = false;
      try { localStorage.setItem('dh_osaka_field2', JSON.stringify(D.FIELD)); } catch (e) {}
      syncSession(); pushLobby(); break;
    }
    case 'ready': p.ready = !!msg.ready; if (p.ready) toastHost(`✅ ${p.name} is ready`); pushLobby(); break;
    case 'emote': case 'cheer': { if (now - p.lastEmo < EMOTE_GAP) return; p.lastEmo = now; const e = EMO[msg.type === 'cheer' ? 'cheer' : msg.emote]; if (e) floatOver(p, e, 'emote'); if (msg.type === 'cheer') D.sfx?.roar?.(0.08, 1.5); break; }
    case 'bubble': { if (now - p.lastBub < BUBBLE_GAP) return; p.lastBub = now; const t = clean(msg.text, 40); if (t) floatOver(p, t, 'bubble'); break; }
    case 'brag': { const w = D.race.finishOrder[0]; if (w && w.k === p.k && window.DHBrag) window.DHBrag.receive({ type: 'brag', msg: clean(msg.msg, 60), by: p.name, marble: w.name, t: now }); break; }
    case 'tilt': break; // reserved for party modes (T-026); the gravity circuit ignores it
  }
}
const racing = () => D.race.phase === 'race' || D.race.phase === 'grid';
const phaseNow = () => (racing() ? 'race' : D.race.phase === 'done' || D.race.phase === 'over' ? 'result' : 'lobby');

// ---------- emotes / bubbles over the player's marble ----------
const live = []; // { el, p, t0, dur, kind }
function floatOver(p, text, kind) {
  const el = document.createElement('div'); el.className = kind === 'bubble' ? 'dhpB' : 'dhpE'; el.textContent = text;
  if (kind === 'bubble') el.style.border = `3px solid ${p.color}`;
  fx.appendChild(el); live.push({ el, p, t0: performance.now(), dur: kind === 'bubble' ? 3200 : 1700, kind });
  if (live.length > 40) live.shift().el.remove();
}
function project(m, lift) {
  const cam = D.camera; if (!cam || !m) return null; const v = m.mesh.position.clone(); v.y += lift; v.project(cam);
  if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null; return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
}
function tick() {
  const now = performance.now();
  for (let i = live.length - 1; i >= 0; i--) {
    const f = live[i], u = (now - f.t0) / f.dur; if (u >= 1) { f.el.remove(); live.splice(i, 1); continue; }
    const xy = project(D.marbles[f.p.k], f.kind === 'bubble' ? 1.6 : 1.2 + u * 2.5);
    if (!xy) { f.el.style.opacity = 0; continue; }
    f.el.style.left = xy[0] + 'px'; f.el.style.top = (xy[1] - (f.kind === 'bubble' ? 0 : u * 40)) + 'px'; f.el.style.opacity = u > 0.75 ? (1 - u) * 4 : 1;
  }
  requestAnimationFrame(tick);
}
function netTick() { // timer, not rAF: keeps phones updated even if the host tab is in the background
  // race state to phones, ~3 Hz; phase changes immediately
  const now = performance.now(), ph = phaseNow();
  if (party.phones.size && (ph !== party.lastPhase || now - party.lastSent > 330)) {
    if (ph !== party.lastPhase) { party.lastPhase = ph; sendAll({ type: 'phase', phase: ph }); if (ph === 'lobby') { for (const p of party.phones.values()) p.ready = false; pushLobby(); } }
    party.lastSent = now;
    if (ph === 'race') {
      const st = D.standings(), lead = st[0];
      for (const p of party.phones.values()) { const m = D.marbles[p.k], pos = st.indexOf(m) + 1; send(p, { type: 'race', pos, lap: Math.min(D.LAPS || 99, Math.max(1, Math.floor(m.prog / D.L) + 1)), gap: pos === 1 ? 'leader' : '+' + Math.max(0, (lead.prog - m.prog) / 60).toFixed(1) + 's' }); }
    } else if (ph === 'result' && D.race.finishOrder?.length && !party.resultSent) {
      party.resultSent = true; const w = D.race.finishOrder[0]; const wp = [...party.phones.values()].find((p) => p.k === w.k);
      const st = D.standings();
      for (const p of party.phones.values()) send(p, { type: 'result', winner: wp ? wp.id : '', winnerName: wp ? wp.name : w.name, marble: w.name, pos: st.indexOf(D.marbles[p.k]) + 1 });
    }
    if (ph !== 'result') party.resultSent = false;
  }
}
setInterval(netTick, 250);
requestAnimationFrame(tick);
if (new URLSearchParams(location.search).get('party') === '1') btn.click();
console.log('[party] ready: press 📱 Party to open a room');
