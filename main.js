// Damn Homie Marbles · Osaka GP · prototype v2 "broadcast" (Grok Bot / Art Director, 2026-11-13)
// three.js r170 + Rapier 0.14. Track-agnostic: see TRACK-CONTRACT.txt for the glb node names this relies on.
// v2: watch party (1-4 local players), broadcast TV director, true blimp + blimp cam, timing tower,
//     race-drama callouts, finish replay (ring-buffer recording), podium + fireworks.
// v3 (track v2 from Claude Morty): reads TRACK_centerline LINES + extras (dh_widths, dh_finish_index, dh_lift),
//     chain lift between dh_lift samples, gravity racing elsewhere, boost removed, set-piece TV cams, floor lane lines.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/jsm/RoomEnvironment.js';
import RAPIER from './vendor/rapier.mjs';

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const CFG = {
  laps: +(Q.get('laps') || 3),
  replay: Q.get('replay') !== '0',
  sound: Q.get('sound') !== '0',
};
const LAPS = CFG.laps;
const R = 0.5, DT = 1 / 480, SPEED_REF = 60; // v4 real scale: 480 Hz substeps so 60-140 u/s marbles never tunnel the trimesh // SPEED_REF: avg cruise speed, used for gap-in-seconds
$('lapsTxt').textContent = LAPS;

// Art Director marble audit (11-13): clean albedo maps re-baked from the marbles-pro catalog recipes (no baked studio
// highlights/reflections, one mark per ball as on the sheets), a material per design (metal, mirror tiles, gem, lava glow,
// glossy coat) and a roster of 18: six new official-DH marbles rotate into the CPU slots of the 12-marble grid each race.
// AD T-030 (11-14, Jarod): roster of 70 in 7 categories (~60 masculine / 10 feminine). DH designs are the official brand-kit
// marbles; every other design is an original non-logo pattern (catalog recipes from marbles-pro). Sumo set v2 (T-030b): see the
// AD T-030b block (gunbai, 3 mawashi, 2 gyoji brocades, yokozuna tsuna, kesho-mawashi, 2 glass marbles with a mini rikishi inside).
// Textures: 512x256 jpg for the 52 new ones, loaded only when a marble is on the grid; picker uses 96px thumbs, lazy.
const CATS = ['Sumo', 'Streetwear/DH', 'Gems & Metals', 'Elements', 'Animals', 'Night Osaka', 'Femme'];
const ROSTER = [
  ['sumo_yokozuna', 'Yokozuna Tsuna', 0], ['sumo_mawashi_kuro', 'Kuro Mawashi', 0], ['sumo_mawashi_murasaki', 'Murasaki Mawashi', 0], // AD T-030b sumo v2
  ['sumo_mini_shiko', 'Mini Rikishi', 0], ['sumo_mawashi_kin', 'Kin Mawashi', 0], ['sumo_gunbai', 'Gunbai', 0],
  ['sumo_gyoji_kurenai', 'Gyoji Kurenai', 0], ['sumo_gyoji_midori', 'Gyoji Midori', 0], ['sumo_kesho', 'Kesho-mawashi', 0], ['sumo_mini_dohyoiri', 'Mini Yokozuna', 0],
  ['dh08_blackletter_dh', 'Blackletter', 1], ['dh03_i_heart_dh', 'I♥DH', 1], ['dh01_ski_mask', 'Ski Mask', 1],
  ['dhm_white_on_black', 'DH Mono', 1], ['dhm_black_on_white', 'DH Mono W', 1], ['dh05_gold_bull_skull', 'Bull Skull', 1],
  ['dh13_rugby_stripe', 'Rugby', 1], ['dh04_guard_dog', 'Guard Dog', 1], ['dh10_homie_crest', 'Homie Crest', 1],
  ['dh11_bandana_skull', 'Bandana Skull', 1], ['dh06_greek_god', 'Greek God', 1], ['dh02_flex_bones', 'Flex Bones', 1],
  ['dh07_starry_homie', 'Starry Homie', 1], ['army_camo', 'Camo', 1], ['hunter_camo', 'Hunter Camo', 1], ['denim', 'Denim', 1],
  ['gold', 'Gold', 2], ['silver', 'Silver', 2], ['bronze', 'Bronze', 2], ['copper', 'Copper', 2], ['brass', 'Brass', 2],
  ['emerald', 'Emerald', 2], ['ruby', 'Ruby', 2], ['sapphire', 'Sapphire', 2], ['diamond', 'Diamond', 2], ['disco_ball', 'Disco', 2],
  ['lava', 'Lava', 3], ['earth_planet', 'Earth', 3], ['mars', 'Mars', 3], ['blood_moon', 'Blood Moon', 3],
  ['rusted_iron', 'Rust', 3], ['cannonball', 'Cannonball', 3], ['snowflake', 'Frost', 3], ['obsidian', 'Obsidian', 3],
  ['tiger_print', 'Tiger', 4], ['zebra', 'Zebra', 4], ['cheetah', 'Cheetah', 4], ['snakeskin', 'Snake', 4],
  ['crocodile', 'Croc', 4], ['eye_cat', 'Cat Eye', 4], ['wolf_fur', 'Wolf', 4], ['raven', 'Raven', 4],
  ['seigaiha', 'Seigaiha', 5], ['magic_8_ball', 'Magic 8', 5], ['lucha_red_gold', 'Lucha Rojo', 5], ['lucha_black_silver', 'Lucha Negro', 5],
  ['vinyl_record', 'Vinyl', 5], ['poker_chip', 'DH Chip', 5], ['celadon', 'Celadon', 5], ['fireworks', 'Hanabi', 5],
  ['dh09_pink_bear', 'Pink Bear', 6], ['pearl', 'Pearl', 6], ['rose_gold', 'Rose Gold', 6], ['pink_chrome', 'Pink Chrome', 6],
  ['opal', 'Opal', 6], ['moonstone', 'Moonstone', 6], ['lace_black', 'Black Lace', 6], ['plumeria', 'Plumeria', 6],
  ['hibiscus', 'Hibiscus', 6], ['lucha_pink_white', 'Lucha Rosa', 6],
  ['dh12_dare', 'DARE', 1], // AD T-030b: official DH Nation/DARE brand-kit design restored (appended so saved grids keep their indices)
];
const NEWM = new Set(ROSTER.filter((r) => r[2] === 0).map((r) => r[0]));
const MLOOK = { // per-design material, matched to the studio sheets (default: glossy clear-coated core)
  gold: { metal: 1, rough: 0.24, coat: 0, env: 1.6 }, disco_ball: { metal: 1, rough: 0.1, coat: 0, env: 1.8 },
  silver: { metal: 1, rough: 0.18, coat: 0, env: 1.7 }, bronze: { metal: 1, rough: 0.3, coat: 0, env: 1.5 }, copper: { metal: 1, rough: 0.26, coat: 0, env: 1.5 },
  brass: { metal: 1, rough: 0.28, coat: 0, env: 1.5 }, rose_gold: { metal: 1, rough: 0.2, coat: 0, env: 1.6 }, pink_chrome: { metal: 1, rough: 0.12, coat: 0, env: 1.8 },
  emerald: { rough: 0.02, coat: 1, env: 2.6, em: 0x041d0e, gem: true }, ruby: { rough: 0.02, coat: 1, env: 2.6, em: 0x1d0406, gem: true },
  sapphire: { rough: 0.02, coat: 1, env: 2.6, em: 0x040a1d, gem: true }, diamond: { rough: 0.01, coat: 1, env: 3, gem: true },
  lava: { rough: 0.55, coat: 0.25, emit: true }, cannonball: { metal: 0.8, rough: 0.45, coat: 0 }, rusted_iron: { metal: 0.3, rough: 0.8, coat: 0 },
  obsidian: { rough: 0.04, env: 1.8 }, pearl: { rough: 0.25, coat: 0.7, env: 1.6 }, wolf_fur: { rough: 0.5, coat: 0.4 },
  denim: { rough: 0.4, coat: 0.5 }, army_camo: { rough: 0.4, coat: 0.5 }, hunter_camo: { rough: 0.4, coat: 0.5 },
  lucha_red_gold: { rough: 0.18, coat: 0.75 }, dh05_gold_bull_skull: { rough: 0.1 }, magic_8_ball: { rough: 0.05 },
};
const FIELD0 = ['dh08_blackletter_dh', 'sumo_yokozuna', 'gold', 'dh03_i_heart_dh', 'lava', 'tiger_print', 'sumo_mawashi_murasaki', 'emerald', 'dh01_ski_mask', 'sumo_mini_shiko', 'disco_ball', 'dh09_pink_bear'].map((f) => ROSTER.findIndex((r) => r[0] === f));
let FIELD = (() => { try { const f = JSON.parse(localStorage.getItem('dh_osaka_field2')); if (Array.isArray(f) && f.length === 12 && new Set(f).size === 12 && f.every((r) => r >= 0 && r < ROSTER.length)) return f; } catch {} return FIELD0.slice(); })();
const RACERS = FIELD.map((r) => ROSTER[r]); // the 12 on the grid this race (slot k -> ROSTER[FIELD[k]])
const PCOLORS = ['#ffb300', '#00e5ff', '#ff2d95', '#7dff3a', '#b04cff', '#ffffff'];

// ---------- session (local watch party; shaped so an online transport can slot in later) ----------
// A Session owns the player list. Today `transport` is local; an online version would sync
// session.players + race seed + "start" from a host and stream nothing else (the sim is seeded),
// or have the host stream the replay-buffer frames (see Recorder) to spectators.
const session = {
  transport: 'local',
  players: (() => { try { const p = JSON.parse(localStorage.getItem('dh_osaka_players2')); if (Array.isArray(p) && p.length) return p.slice(0, 4); } catch {} return [{ id: 1, name: 'Jarod', color: PCOLORS[0], k: +(localStorage.getItem('dh_osaka_pick') ?? 0) || 0 }]; })(),
  save() { localStorage.setItem('dh_osaka_players2', JSON.stringify(this.players)); },
  byMarble(k) { return this.players.find((p) => p.k === k); },
  seed: +(Q.get('seed') || (Date.now() % 100000)),
};
let editP = 0;

// ---------- renderer / scene ----------
const isMobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
let pixelCap = isMobile ? 1.5 : 2;
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile || devicePixelRatio < 2, powerPreference: 'high-performance', preserveDrawingBuffer: !!Q.get('shots') });
renderer.setPixelRatio(Math.min(devicePixelRatio, pixelCap));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
$('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 900);
camera.position.set(-20, 14, 50);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
scene.fog = new THREE.Fog(0x4a2d5e, 120, 420);
scene.add(new THREE.HemisphereLight(0x9b8ce0, 0x2a1830, 1.1));
const moon = new THREE.DirectionalLight(0xffe6d1, 2.4); moon.position.set(-40, 60, 35); scene.add(moon);
const fill = new THREE.DirectionalLight(0x9e8cff, 0.8); fill.position.set(40, 30, -50); scene.add(fill);

// ---------- loading ----------
const texLoader = new THREE.TextureLoader();
const setBar = (f, t) => { $('barFill').style.width = Math.round(f * 100) + '%'; if (t) $('loadNote').textContent = t; };
{ const skyT = (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }; texLoader.load('./fx_sky_game.jpg', skyT, undefined, () => texLoader.load('./fx_dusk_sky.jpg', skyT)); } // look pass 3: painted game sky, old dusk sky as fallback
const rosterTex = [], rtex = (r) => rosterTex[r] || (rosterTex[r] = (() => { const t = texLoader.load(`./marbles/${ROSTER[r][0]}.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })()); // AD T-030: lazy, only grid marbles load
const lavaEmit = texLoader.load('./marbles/lava_emit.jpg'); lavaEmit.colorSpace = THREE.SRGBColorSpace;

await RAPIER.init();
setBar(0.1, 'Loading Osaka…');
const gltf = await new Promise((res, rej) => new GLTFLoader().load('./osaka_world.glb', res, (e) => e.total && setBar(0.1 + 0.8 * e.loaded / e.total), rej));
setBar(0.92, 'Building the track…');
const world3d = gltf.scene;
scene.add(world3d);
world3d.updateMatrixWorld(true);
world3d.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; o.matrixAutoUpdate = false; } });
// look pass 3: horizon ring + far ground are painted backdrops: unlit, unfogged (haze is painted in), cut-out alpha on the ring
world3d.traverse((o) => { if (o.isMesh && /^LP3_bg_/.test(o.name)) { const src = o.material; const map = src.map || src.emissiveMap; o.material = new THREE.MeshBasicMaterial({ map, transparent: false, alphaTest: /horizon/.test(o.name) ? 0.5 : 0, side: THREE.DoubleSide, fog: false, depthWrite: true }); o.renderOrder = -1; src.dispose(); } });
const node = (n) => world3d.getObjectByName(n);

// ---------- TRACK CONTRACT: racing line ----------
// Priority: TRACK_centerline (mesh/line polyline, edges chained) > TRACK_PATH.extras.dh_path_yup > derived from TRACK_floor.
const contract = { src: '', notes: [] };
function chainLine(o) {
  const a = o.geometry.attributes.position; const pts = [];
  const w = (i) => new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
  const idx = o.geometry.index ? o.geometry.index.array : null;
  if (idx && (o.isLineSegments || o.isMesh)) { // chain edge pairs
    const adj = new Map(); const add = (x, y) => { (adj.get(x) || adj.set(x, []).get(x)).push(y); };
    const step = o.isMesh ? 3 : 2;
    for (let i = 0; i < idx.length; i += step) { add(idx[i], idx[i + 1]); add(idx[i + 1], idx[i]); }
    let prev = -1, cur = idx[0]; const seen = new Set();
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); pts.push(w(cur)); const nx = (adj.get(cur) || []).find((v) => v !== prev && !seen.has(v)); prev = cur; cur = nx; }
  } else for (let i = 0; i < a.count; i++) pts.push(w(i));
  return pts;
}
function floorDerived() { // angular bins around the floor's centroid (works for loop-ish, star-shaped layouts)
  const f = node('TRACK_floor'); const vs = []; f.traverse((o) => { if (o.isMesh) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 1) vs.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld)); } });
  const c = vs.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(vs.length);
  const B = 180, acc = Array.from({ length: B }, () => [new THREE.Vector3(), 0]);
  for (const v of vs) { const b = Math.floor(((Math.atan2(v.z - c.z, v.x - c.x) + Math.PI) / (2 * Math.PI)) * B) % B; acc[b][0].add(v); acc[b][1]++; }
  return acc.filter((x) => x[1]).map((x) => x[0].divideScalar(x[1]));
}
let rawPts = null, widthU = 7, X = {};
const cl = node('TRACK_centerline');
function linePts(o) { // glTF LINES in race order: vertex order is the race order when edges are (k,k+1)
  const a = o.geometry.attributes.position, idx = o.geometry.index?.array;
  let seq = !idx; if (idx) { let ok = 0; for (let k = 0; k < idx.length; k += 2) if (idx[k + 1] === idx[k] + 1 || (idx[k + 1] === 0 && idx[k] === a.count - 1)) ok++; seq = ok >= idx.length / 2 - 2; }
  if (!seq) return chainLine(o);
  const pts = []; for (let i = 0; i < a.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld)); return pts;
}
if (cl) {
  let line = null; cl.traverse((o) => { if (!line && (o.isLine || o.isLineSegments) && o.geometry?.attributes?.position) line = o; });
  if (!line) cl.traverse((o) => { if (!line && o.geometry?.attributes?.position) line = o; });
  if (line) rawPts = line.isLine || line.isLineSegments ? linePts(line) : chainLine(line);
  if (rawPts && rawPts.length > 8) { contract.src = 'TRACK_centerline' + (line.isLineSegments ? ' (LINES)' : ''); X = { ...(line.userData || {}), ...cl.userData }; widthU = X.dh_width ?? widthU; } else rawPts = null;
}
if (cl) cl.traverse((o) => { if (o.isLine || o.isLineSegments) o.visible = false; }); // contract data, not art
const pathNode = node('TRACK_PATH');
if (!rawPts && pathNode?.userData?.dh_path_yup) { const r = pathNode.userData.dh_path_yup; rawPts = []; for (let i = 0; i < r.length; i += 3) rawPts.push(new THREE.Vector3(r[i], r[i + 1], r[i + 2])); contract.src = 'TRACK_PATH.dh_path_yup'; X = pathNode.userData; widthU = X.dh_width ?? widthU; }
if (rawPts && X.dh_path_yup && rawPts.length * 3 === X.dh_path_yup.length) { // sanity: line vertices should match the race-order path
  const r = X.dh_path_yup; if (rawPts[1].distanceTo(new THREE.Vector3(r[3], r[4], r[5])) > 0.5) { rawPts = []; for (let i = 0; i < r.length; i += 3) rawPts.push(new THREE.Vector3(r[i], r[i + 1], r[i + 2])); contract.notes.push('line order fixed from dh_path_yup'); }
}
if (!rawPts) { rawPts = floorDerived(); contract.src = 'derived from TRACK_floor'; }
// spawns (SPAWN_01 = pole). Used for count, grid and travel direction.
const spawns = []; for (let i = 1; i <= 24; i++) { const s = node('SPAWN_' + String(i).padStart(2, '0')); if (s) spawns.push(s.getWorldPosition(new THREE.Vector3())); }
// resample uniformly (~1.2 units)
function resample(pts) {
  const n = pts.length; let len = 0; const cum = [0];
  for (let i = 0; i < n; i++) { len += pts[i].distanceTo(pts[(i + 1) % n]); cum.push(len); }
  const M = Math.max(64, Math.round(len / 1.2)); const out = []; let j = 0;
  for (let k = 0; k < M; k++) { const s = (k / M) * len; while (cum[j + 1] < s) j++; const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]); out.push(pts[j].clone().lerp(pts[(j + 1) % n], f)); }
  return out;
}
const rawCum = [0]; for (let i = 0; i < rawPts.length; i++) rawCum.push(rawCum[i] + rawPts[i].distanceTo(rawPts[(i + 1) % rawPts.length]));
let P = resample(rawPts);
const N = P.length;
const T = [], NRM = [], S = [];
let L = 0;
function buildFrames() {
  T.length = NRM.length = S.length = 0; L = 0;
  for (let i = 0; i < N; i++) { S.push(L); L += P[i].distanceTo(P[(i + 1) % N]); const t = P[(i + 1) % N].clone().sub(P[(i - 1 + N) % N]).normalize(); T.push(t); NRM.push(new THREE.Vector3(-t.z, 0, t.x).normalize()); }
}
buildFrames();
const nearestIdx = (p) => { let b = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = P[i].distanceToSquared(p); if (d < bd) { bd = d; b = i; } } return b; };
const finNode = node('FINISH_LINE');
const raceOrdered = X.dh_finish_index != null; // centerline/path with extras is already in race order
let finPos = X.dh_finish_index != null ? rawPts[X.dh_finish_index].clone() : finNode ? finNode.getWorldPosition(new THREE.Vector3()) : P[0];
let FIN = nearestIdx(finPos);
if (spawns.length >= 2 && !raceOrdered) { // direction check: pole should be ahead of the back of the grid
  const d = spawns[0].clone().sub(spawns[spawns.length - 1]);
  if (d.dot(T[FIN]) < -0.3 * d.length()) { P = P.reverse(); buildFrames(); FIN = nearestIdx(finPos); contract.notes.push('reversed path to match SPAWN order'); }
}
const SFIN = S[FIN];
// per-sample half width (dh_widths) and chain-lift arc range (dh_lift), mapped from raw samples by arc length
const rawLen = rawCum[rawCum.length - 1], sOfRaw = (k) => (rawCum[k] / rawLen) * L;
const HW = new Float32Array(N).fill(widthU / 2);
if (Array.isArray(X.dh_widths) && X.dh_widths.length === rawPts.length) for (let i = 0; i < N; i++) { let k = 0; while (k < rawPts.length - 1 && rawCum[k + 1] / rawLen * L <= S[i]) k++; HW[i] = X.dh_widths[k] / 2; }
const LIFT = Array.isArray(X.dh_lift) ? { s0: sOfRaw(X.dh_lift[0]), s1: sOfRaw(X.dh_lift[1]) } : null;
let liftPos = null; // AD T-027: lift midpoint for positional whir/clack (set once pointAtS exists)
const HAIR = new Uint8Array(N); // set after PIECES exist
const inLift = (s) => LIFT && s >= LIFT.s0 - PHYS.liftLead && s <= LIFT.s1; // chain picks up a few units before the ramp
const sOfRawIdx = (k) => sOfRaw(((k % rawPts.length) + rawPts.length) % rawPts.length);
const wrap = (d) => { while (d > L / 2) d -= L; while (d < -L / 2) d += L; return d; };
const HALFW = widthU / 2;
const center = P.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(N);
const trackBox = new THREE.Box3().setFromPoints(P);
const trackRad = Math.max(trackBox.max.x - trackBox.min.x, trackBox.max.z - trackBox.min.z) / 2;
console.log('[contract]', contract.src, 'raw', rawPts.length, 'N', N, 'L', L.toFixed(1), 'FIN', FIN, 'lift', LIFT && [LIFT.s0.toFixed(1), LIFT.s1.toFixed(1)], 'narrowHW', Math.min(...HW), contract.notes);

const _v = new THREE.Vector3();
function project(p, hint, wide) {
  let best = 0, bd = 1e9;
  if (wide) { for (let i = 0; i < N; i++) { const dx = p.x - P[i].x, dy = (p.y - P[i].y) * 0.5, dz = p.z - P[i].z; const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = i; } } }
  else for (let k = -10; k <= 10; k++) { const i = ((hint + k) % N + N) % N; const dx = p.x - P[i].x, dy = (p.y - P[i].y) * 0.5, dz = p.z - P[i].z; const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = i; } }
  const a = best, b = (best + 1) % N, c = (best - 1 + N) % N;
  let i0 = a, i1 = b;
  if (_v.copy(p).sub(P[a]).dot(T[a]) < 0) { i0 = c; i1 = a; }
  const seg = P[i1].clone().sub(P[i0]); const len = seg.length(); seg.divideScalar(len);
  const t = THREE.MathUtils.clamp(_v.copy(p).sub(P[i0]).dot(seg), 0, len);
  const f = t / len;
  return { i: best, s: S[i0] + t, lat: _v.copy(p).sub(P[i0]).dot(NRM[i0]), cy: P[i0].y + (P[i1].y - P[i0].y) * f, tan: T[i0] };
}
const pointAtS = (s) => { s = ((s % L) + L) % L; let i = Math.min(N - 1, Math.floor((s / L) * N)); while (i > 0 && S[i] > s) i--; while (i < N - 1 && S[i + 1] <= s) i++; const j = (i + 1) % N; const seg = (j === 0 ? L : S[j]) - S[i]; return { p: P[i].clone().lerp(P[j], (s - S[i]) / seg), i }; };
if (LIFT) liftPos = pointAtS((LIFT.s0 + LIFT.s1) / 2).p.clone();

// ---------- physics (unchanged feel; Claude Morty owns balancing) ----------
// v4 REAL SCALE: 1 unit = one 16 mm marble, so Earth gravity = 9.81 / 0.016 = 613 u/s^2 (was 24: everything moved like boulders in slow motion).
// No min-speed assist (minv=0); the only aid left is the counted 'marshal' nudge for a marble truly stopped > 1 s.
const PHYS = { g: +(Q.get('g') || 613), drag: +(Q.get('drag') || 0.006), dragVar: 0.3, liftV: +(Q.get('lift') || 16), railF: +(Q.get('railf') ?? 0.04), liftLead: 9, flick: +(Q.get('flick') || 2.6), flZone: 3.0, flUp: +(Q.get('flup') ?? 0.9), minV: +(Q.get('minv') ?? 0), assist: 60, ts: +(Q.get('ts') || 1), pitch: 3.2 };
const world = new RAPIER.World({ x: 0, y: -PHYS.g, z: 0 });
world.timestep = DT;
world.integrationParameters.numSolverIterations = 4;
const CMIN = RAPIER.CoefficientCombineRule ? RAPIER.CoefficientCombineRule.Min : null;
let triCount = 0;
const SMOOTH = Q.get('smooth') !== '0'; // v4: physics floor rebuilt smooth from the centerline (see SMOOTH COLLISION FLOOR); ?smooth=0 = raw glb trimesh
for (const nm of ['TRACK_floor', 'TRACK_rail_inner_cyan', 'TRACK_rail_outer_pink']) {
  if (SMOOTH && nm === 'TRACK_floor') continue;
  const root = node(nm); if (!root) { console.warn('missing', nm); continue; }
  const meshes = []; root.traverse((o) => o.isMesh && meshes.push(o));
  for (const m of meshes) {
    const g = m.geometry; const pos = g.attributes.position;
    const v = new Float32Array(pos.count * 3); const w = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { w.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); v[i * 3] = w.x; v[i * 3 + 1] = w.y; v[i * 3 + 2] = w.z; }
    const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: pos.count }, (_, i) => i);
    triCount += idx.length / 3;
    const flags = RAPIER.TriMeshFlags ? (RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES) : undefined;
    const desc = flags !== undefined ? RAPIER.ColliderDesc.trimesh(v, idx, flags) : RAPIER.ColliderDesc.trimesh(v, idx);
    const isFloor = nm === 'TRACK_floor';
    desc.setFriction(isFloor ? 0.7 : PHYS.railF).setRestitution(isFloor ? 0.08 : 0.4); if (isFloor && CMIN != null) desc.setRestitutionCombineRule(CMIN); if (!isFloor && CMIN != null) desc.setFrictionCombineRule(CMIN); // v4: rails were averaging to mu 0.27 with the marble and braking every marble that touched them // glass on plastic deck: dead; rails: a real rattle
    world.createCollider(desc);
  }
}
const NM = Math.min(RACERS.length, Math.max(1, spawns.length));
const sphereGeo = new THREE.SphereGeometry(R, 32, 20);
// ---------- AD T-030b SUMO v2 (Grok Bot / Art Director, 11-14): own block, called from skin() + one line in the render loop ----------
// Sumo marbles carry a tangent normal map (_n) and an ORM map (_orm: G = roughness, B = metalness) next to the albedo, plus silk sheen.
// The two "Mini" marbles are a clear glass shell with a small stylised rikishi inside (marbles/sumo_rikishi.glb, 57 KB, quantized,
// no Draco). The figure is a child of the ball and is counter-rotated every frame so it stays upright and turns to face the camera.
const SUMO2 = {
  sumo_gunbai: { coat: 0.5, env: 1.2 },
  sumo_mawashi_kuro: { sheen: 0x2c2c38, sheenR: 0.35, env: 0.9 }, sumo_mawashi_murasaki: { sheen: 0x9a70c0, sheenR: 0.35 },
  sumo_mawashi_kin: { sheen: 0xffd890, sheenR: 0.3, env: 1.3 },
  sumo_gyoji_kurenai: { sheen: 0xff8a70, sheenR: 0.45, coat: 0.1 }, sumo_gyoji_midori: { sheen: 0x70d0a0, sheenR: 0.45, coat: 0.1 },
  sumo_yokozuna: { sheen: 0x9a78c8, sheenR: 0.45 }, sumo_kesho: { sheen: 0x9a78c8, sheenR: 0.45 },
  sumo_mini_shiko: { glass: 'rikishi_shiko', sc: 0.66 }, sumo_mini_dohyoiri: { glass: 'rikishi_dohyoiri', sc: 0.56 },
};
const adSumoTex = {}, adSumoT = (f) => adSumoTex[f] || (adSumoTex[f] = (() => { const t = texLoader.load(`./marbles/${f}.jpg`); t.anisotropy = 4; return t; })());
let adSumoFigs = null; // Promise -> { name: Object3D }
function adSumoFig(name, sc) {
  adSumoFigs ??= new Promise((ok) => new GLTFLoader().load('./marbles/sumo_rikishi.glb', (g) => { const o = {}; g.scene.traverse((n) => { if (n.name.startsWith('rikishi_')) o[n.name] = n; }); ok(o); }, undefined, () => ok({})));
  const holder = new THREE.Group(); holder.name = 'AD_sumo_fig';
  adSumoFigs.then((o) => {
    if (!o[name]) return;
    const w = new THREE.Group(), c = o[name].clone(); w.add(c); w.scale.setScalar(sc); w.position.y = -0.33 * (R / 0.5); holder.add(w);
    w.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(c), ctr = bb.getCenter(new THREE.Vector3()).divideScalar(sc);
    c.position.x -= ctr.x; c.position.z -= ctr.z; c.position.y -= (bb.min.y - w.position.y) / sc;
    holder.scale.setScalar(R / 0.5);
  });
  return holder;
}
function adSumoSkin(m, file) {
  const L = SUMO2[file], t = m.mat;
  if (m.adFig) m.adFig.visible = !!(L && L.glass && m.adFigName === L.glass);
  if (!L) {
    if (m.adSumo) { t.normalMap = t.roughnessMap = t.metalnessMap = null; t.sheen = 0; t.transparent = false; t.opacity = 1; t.depthWrite = true; t.color.set(0xffffff); m.adSumo = 0; t.needsUpdate = true; }
    return;
  }
  m.adSumo = 1;
  if (L.glass) {
    t.normalMap = t.roughnessMap = t.metalnessMap = null; t.sheen = 0;
    t.transparent = true; t.opacity = 0.3; t.depthWrite = false; t.roughness = 0.02; t.metalness = 0; t.clearcoat = 1; t.clearcoatRoughness = 0.0; t.envMapIntensity = 3.2; t.specularIntensity = 1;
    if (!m.adFig || m.adFigName !== L.glass) { if (m.adFig) m.mesh.remove(m.adFig); m.adFig = adSumoFig(L.glass, L.sc); m.adFigName = L.glass; m.mesh.add(m.adFig); }
    m.adFig.visible = true;
  } else {
    t.transparent = false; t.opacity = 1; t.depthWrite = true;
    t.normalMap = adSumoT(file + '_n'); t.normalScale.set(1, 1); t.roughnessMap = t.metalnessMap = adSumoT(file + '_orm'); t.roughness = 1; t.metalness = 1;
    t.clearcoat = L.coat ?? 0; t.clearcoatRoughness = 0.06; t.envMapIntensity = L.env ?? 1.1;
    t.sheen = L.sheen ? 1 : 0; t.sheenRoughness = L.sheenR ?? 0.4; t.sheenColor.set(L.sheen || 0);
  }
  t.needsUpdate = true;
}
const _adQ = new THREE.Quaternion(), _adQ2 = new THREE.Quaternion(), _adV = new THREE.Vector3(), _adC = new THREE.Vector3(), _adY = new THREE.Vector3(0, 1, 0);
function adSumoTick() { // keep the mini rikishi upright and turned toward the camera, whatever the ball is doing
  for (const m of marbles) {
    const f = m.adFig; if (!f || !f.visible) continue;
    m.mesh.getWorldPosition(_adV); camera.getWorldPosition(_adC);
    const v = _adC.sub(_adV); _adQ.setFromAxisAngle(_adY, Math.atan2(v.x, v.z));
    m.mesh.getWorldQuaternion(_adQ2); f.quaternion.copy(_adQ2.invert()).multiply(_adQ);
  }
}
// ---------- /AD T-030b ----------
const gemGeo = new THREE.IcosahedronGeometry(R * 1.01, 1); // AD: cut-gem facets (80 flat faces) for Emerald, cheap on phones; physics stays a ball
const marbles = RACERS.slice(0, NM).map(([file, name], k) => {
  const mat = new THREE.MeshPhysicalMaterial({ map: rtex(FIELD[k]), roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3, emissive: 0x000000, emissiveMap: rtex(FIELD[k]) });
  const mesh = new THREE.Mesh(sphereGeo, mat); scene.add(mesh);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, -50 - k * 2, 0).setCcdEnabled(true).setLinearDamping(0.05).setAngularDamping(+(Q.get("adamp") ?? 0.004)).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.ball(R).setDensity(1).setFriction(0.5).setRestitution(0.75), body); // glass on glass clicks off hard
  return { k, file, name, mesh, body, mat, vhint: 0, vpr: null, pos: 0, arrow: 0, arrowUntil: 0 };
});
function skin(k) { // AD: dress grid slot k in roster design FIELD[k]
  const m = marbles[k], r = FIELD[k], [file, name] = ROSTER[r], L = MLOOK[file] || {}, t = m.mat;
  RACERS[k] = ROSTER[r]; m.file = file; m.name = name; m.r = r;
  t.map = rtex(r); t.metalness = L.metal ?? 0; t.roughness = L.rough ?? 0.08; t.clearcoat = L.coat ?? 1; t.envMapIntensity = L.env ?? 1.3;
  t.emissiveMap = L.emit ? lavaEmit : rtex(r); t.emissiveIntensity = L.emit ? 1.8 : 1;
  m.mesh.geometry = L.gem ? gemGeo : sphereGeo; t.flatShading = !!L.gem; t.ior = L.gem ? 1.58 : 1.5;
  m.baseEm = new THREE.Color(L.emit ? 0xffffff : (L.em ?? 0x000000)); t.emissive.copy(m.baseEm); t.needsUpdate = true;
  adSumoSkin(m, file); // AD T-030b
}
marbles.forEach((_, k) => skin(k));

// player name tags (sprites)
function tagTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
  x.font = 'bold 34px system-ui,sans-serif'; const w = Math.min(240, x.measureText(text).width + 36);
  x.fillStyle = color; x.beginPath(); x.roundRect((256 - w) / 2, 4, w, 46, 14); x.fill();
  x.beginPath(); x.moveTo(116, 50); x.lineTo(140, 50); x.lineTo(128, 66); x.fill();
  x.fillStyle = '#111'; x.textAlign = 'center'; x.fillText(text, 128, 39);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let tags = [];
function buildTags() {
  for (const t of tags) { scene.remove(t.sp); t.sp.material.map.dispose(); t.sp.material.dispose(); }
  tags = session.players.map((p) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture(p.name.toUpperCase(), p.color), depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.set(0.13, 0.037, 1); sp.renderOrder = 10; scene.add(sp); return { p, sp }; });
}

// ---------- blimp: a real object that follows the race ----------
const blimp = node('FX_dh_blimp');
const blimpQ0 = blimp ? blimp.quaternion.clone() : null;
const blimpYaw0 = blimp ? (() => { const x = new THREE.Vector3(1, 0, 0).applyQuaternion(blimp.quaternion); return Math.atan2(-x.z, x.x); })() : 0;
const blimpBase = blimp ? blimp.position.clone() : new THREE.Vector3(30, 34, -14);
if (blimp) { blimp.matrixAutoUpdate = true; blimp.traverse((o) => { o.matrixAutoUpdate = true; }); }
const BL = { pos: blimpBase.clone(), vel: new THREE.Vector3(), yaw: blimpYaw0, focus: center.clone(), H: +(Q.get('blimph') || 13) };
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
// v4 GONDOLA: a real gondola mesh parented to the blimp node, and the blimp camera parented to the gondola (camera.parent === gondolaMount).
const gondola = new THREE.Group(); gondola.name = 'FX_dh_blimp_gondola'; const gondolaMount = new THREE.Object3D(); gondolaMount.name = 'FX_dh_blimp_cam_mount';
if (blimp) {
  const bb = new THREE.Box3(); blimp.updateMatrixWorld(true); blimp.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b2 = o.geometry.boundingBox.clone(); if (o !== blimp) b2.applyMatrix4(o.matrix); bb.union(b2); } });
  const gm = new THREE.MeshStandardMaterial({ color: 0x17161c, roughness: 0.5, metalness: 0.3 }), rm = new THREE.MeshStandardMaterial({ color: 0xd7192d, roughness: 0.45 }), wm = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.6, emissive: 0x1a3040 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.5), gm); const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.18, 1.52), rm); stripe.position.y = 0.2;
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 1.54), wm); win.position.y = -0.1;
  const pod = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), gm); pod.position.set(1.5, -0.75, 0);
  const strutG = new THREE.BoxGeometry(0.08, 0.08, 1.0);
  for (const sd of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.09), rm); st.position.set(2.2, -1.05, sd * 0.42); st.rotation.z = -0.45; gondola.add(st); }
  gondola.add(cab, stripe, win, pod); gondola.position.set(0.3, bb.min.y - 0.35, 0); blimp.add(gondola);
  gondolaMount.position.set(1.55, -0.85, 0); gondola.add(gondolaMount);
}
const _mq = new THREE.Quaternion(), _mm = new THREE.Matrix4(), _pq = new THREE.Quaternion();
function gondolaCam(dt, look, fov) { // camera is a true child of the gondola; we only aim it (local rotation), position comes from the parent chain
  if (camera.parent !== gondolaMount) { gondolaMount.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity(); setNear(0.05); }
  gondolaMount.updateWorldMatrix(true, false); const wp = gondolaMount.getWorldPosition(new THREE.Vector3());
  _mm.lookAt(wp, look, new THREE.Vector3(0, 1, 0)); _mq.setFromRotationMatrix(_mm); gondolaMount.getWorldQuaternion(_pq);
  const local = _pq.clone().invert().multiply(_mq); camera.quaternion.slerp(local, camSnap ? 1 : 1 - Math.exp(-dt * 2.0));
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (camSnap ? 1 : Math.min(1, dt * 0.8)); camera.updateProjectionMatrix(); }
  camSnap = false; camPos.copy(wp); camLook.copy(look); $('shotTag').textContent = shotName;
}
function detachCam() { if (camera.parent === gondolaMount) { gondolaMount.remove(camera); camera.quaternion.identity(); camera.up.set(0, 1, 0); setNear(0.2); } }
function updateBlimp(dt, now, focus, fwd) {
  if (!blimp) return;
  const want = focus.clone().addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), 10).add(new THREE.Vector3(0, BL.H, 0)); // v4: rides just ahead of the pack, low enough to be in the chase shot
  // critically-damped-ish spring with a speed limit: slow, floaty, never snaps
  const acc = want.sub(BL.pos).multiplyScalar(1.4).addScaledVector(BL.vel, -2.2);
  BL.vel.addScaledVector(acc, dt); if (BL.vel.length() > 55) BL.vel.setLength(55);
  BL.pos.addScaledVector(BL.vel, dt);
  if (BL.vel.lengthSq() > 0.5) { const yw = Math.atan2(-BL.vel.z, BL.vel.x); let d = yw - BL.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); BL.yaw += d * Math.min(1, dt * 1.2); }
  blimp.position.copy(BL.pos); blimp.position.y += Math.sin(now * 0.0005) * 0.6;
  _q.setFromAxisAngle(_up, BL.yaw - blimpYaw0); blimp.quaternion.copy(_q).multiply(blimpQ0);
  blimp.rotateX(Math.sin(now * 0.0004) * 0.03);
}

// ---------- particles: confetti + fireworks (one cheap Points system) ----------
const PN = 1400;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3).fill(-999), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pDrag = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
pts.frustumCulled = false; scene.add(pts);
let pHead = 0, pActive = 0;
const BRAND = ['#e0102f', '#ffb300', '#ffffff', '#ff2d95', '#00e5ff', '#7dff3a'].map((c) => new THREE.Color(c));
function emit(pos, n, speed, opts = {}) {
  const col = opts.color;
  for (let j = 0; j < n; j++) {
    const i = pHead; pHead = (pHead + 1) % PN;
    const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = Math.sqrt(1 - u * u);
    const sp = speed * (opts.shell ? 0.85 + Math.random() * 0.15 : Math.random());
    pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
    pVel[i * 3] = r * Math.cos(th) * sp + (opts.vx || 0); pVel[i * 3 + 1] = u * sp + (opts.up || 0); pVel[i * 3 + 2] = r * Math.sin(th) * sp + (opts.vz || 0);
    const c = col || BRAND[(Math.random() * BRAND.length) | 0]; pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pLife[i] = (opts.life || 2.5) * (0.7 + Math.random() * 0.6); pDrag[i] = opts.drag ?? 0.6;
  }
  pActive = 4;
}
function firework(pos) { emit(pos, 140, 9, { shell: true, color: BRAND[(Math.random() * BRAND.length) | 0], life: 1.8, drag: 1.4 }); sfx.pop(); }
function confetti(pos, n = 260) { emit(pos, n, 5, { up: 4, life: 5, drag: 2.2 }); }
function updateParticles(dt) {
  if (pActive <= 0) return; pActive -= dt;
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue; pLife[i] -= dt;
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; pActive = Math.max(pActive, 0.1); continue; }
    pActive = Math.max(pActive, 0.1);
    const d = Math.exp(-pDrag[i] * dt); pVel[i * 3] *= d; pVel[i * 3 + 1] = pVel[i * 3 + 1] * d - 6 * dt; pVel[i * 3 + 2] *= d;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
const gantry = node('FX_start_finish_gantry');
const gantryBox = gantry ? new THREE.Box3().setFromObject(gantry) : new THREE.Box3(finPos.clone().subScalar(4), finPos.clone().addScalar(4));
const gantryTop = (f) => new THREE.Vector3(THREE.MathUtils.lerp(gantryBox.min.x, gantryBox.max.x, f), gantryBox.max.y + 0.5, THREE.MathUtils.lerp(gantryBox.min.z, gantryBox.max.z, f));

// podium + fake spotlight (no real lights added: keeps every shader the same cost)
const podium = new THREE.Group(); podium.visible = false; scene.add(podium);
const podIdx = (FIN + Math.round(5 / (L / N))) % N;
const podC = P[podIdx].clone();
const podSlots = [[0, 1.3, '#ffb300', '1'], [-1.9, 0.9, '#c9d1e0', '2'], [1.9, 0.6, '#cd7f32', '3']];
const podTops = [];
for (const [x, h, c, lab] of podSlots) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 128, 128); g.fillStyle = '#111'; g.font = 'bold 84px system-ui'; g.textAlign = 'center'; g.fillText(lab, 64, 96);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, h, 1.7), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35, metalness: 0.3, emissive: new THREE.Color(c), emissiveIntensity: 0.25 }));
  const off = NRM[podIdx].clone().multiplyScalar(x);
  b.position.copy(podC).add(off).add(new THREE.Vector3(0, h / 2, 0));
  b.lookAt(b.position.clone().sub(T[podIdx])); podium.add(b);
  podTops.push(b.position.clone().add(new THREE.Vector3(0, h / 2 + R, 0)));
}
const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.6, 16, 20, 1, true), beamMat); beam.position.copy(podTops[0]).add(new THREE.Vector3(0, 7.5, 0)); podium.add(beam);

// ---------- sound (AD T-027): CC0 samples in ./audio (see AUDIO-CREDITS.txt) on plain WebAudio, synth fallback ----------
// iOS: the context is created/resumed on the first tap (pointerdown/touchend/click) and a silent buffer is played to unlock it.
// Listener = the game camera, so lift whir/clack, fling whoosh, clicks and rail hits are positional (equal-power panner, cheap).
const sfx = (() => {
  let ac = null, out = null, crowd = null, on = CFG.sound && localStorage.getItem('dhMute') !== '1', loading = null;
  const B = {}, FILES = ['roll', 'click1', 'click2', 'click3', 'rail1', 'rail2', 'lift_clack', 'lift_whir', 'whoosh', 'crowd_amb', 'crowd_swell', 'crowd_finish', 'beep', 'finish_stinger', 'replay_sting', 'ui_click', 'music'];
  const L = {}; // running loops: { src, g }
  let musicG = null, duckUntil = 0, swellAt = -99, unlocked = false;
  const load = () => loading || (loading = Promise.all(FILES.map((f) => fetch(`audio/${f}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((ab) => new Promise((res, rej) => ac.decodeAudioData(ab, res, rej))).then((b) => { B[f] = b; }).catch(() => {}))).then(startLoops));
  const init = () => {
    if (ac || !on) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = 0.9; out.connect(ac.destination);
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; sfx.noise = buf;
      crowd = ac.createGain(); crowd.gain.value = 0.0; crowd.connect(out); // ambience bus (sample or synth noise)
      load();
    } catch { ac = null; }
  };
  const unlock = () => { if (!on) return; init(); if (!ac) return; if (ac.state !== 'running') ac.resume(); if (!unlocked) { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); unlocked = true; } };
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
  function loop(name, bus, vol, rate = 1) {
    const b = B[name]; if (!b) return null; const src = ac.createBufferSource(); src.buffer = b; src.loop = true;
    src.loopStart = 0.03; src.loopEnd = b.duration - 0.03; // skip mp3 encoder padding: crossfaded loops stay seamless
    src.playbackRate.value = rate; const g = ac.createGain(); g.gain.value = vol; src.connect(g).connect(bus); src.start(0, 0.03); return (L[name] = { src, g });
  }
  function panner(pos, ref = 6) { const p = ac.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.2; p.maxDistance = 400; setPos(p, pos); p.connect(out); return p; }
  function setPos(p, v) { if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z); }
  function startLoops() {
    if (!ac) return;
    if (B.crowd_amb) loop('crowd_amb', crowd, 1); else { const s = ac.createBufferSource(); s.buffer = sfx.noise; s.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6; s.connect(bp).connect(crowd); s.start(); }
    loop('roll', out, 0); if (L.roll) L.roll.g.gain.value = 0;
    if (B.lift_whir && liftPos) { sfx.liftP = panner(liftPos, 5); loop('lift_whir', sfx.liftP, 0); }
    musicG = ac.createGain(); musicG.gain.value = 0.2; musicG.connect(out); loop('music', musicG, 1);
  }
  function play(name, { vol = 1, rate = 1, at = null, ref = 6, when = 0 } = {}) {
    if (!ac || !on || ac.state !== 'running') return false; const b = B[name]; if (!b) return false;
    const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = ac.createGain(); g.gain.value = vol;
    s.connect(g).connect(at ? panner(at, ref) : out); s.start(ac.currentTime + when); return true;
  }
  const beep = (f, d = 0.18, v = 0.12, type = 'square') => { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d); o.connect(g).connect(out); o.start(); o.stop(ac.currentTime + d); };
  const duck = (sec, to = 0.06) => { if (!musicG) return; const t = ac.currentTime, g = musicG.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + 0.15); duckUntil = t + sec; };
  // per-frame state: speeds from rendered marble positions, so it works live and in replay/slow-mo
  const prev = new Map(), cool = { click: 0, rail: 0, fling: 0 }, _v = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3();
  function update(dt, cam, marbles, mode) {
    if (!ac || ac.state !== 'running' || dt <= 0) return;
    const t = ac.currentTime, l = ac.listener; cam.getWorldPosition(_v); cam.getWorldDirection(_f); _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (l.positionX) { l.positionX.value = _v.x; l.positionY.value = _v.y; l.positionZ.value = _v.z; l.forwardX.value = _f.x; l.forwardY.value = _f.y; l.forwardZ.value = _f.z; l.upX.value = _u.x; l.upY.value = _u.y; l.upZ.value = _u.z; }
    else { l.setPosition(_v.x, _v.y, _v.z); l.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); }
    const active = mode === 'replay' || (mode === 'live' && (race.phase === 'race' || race.phase === 'done'));
    let rollW = 0, rollV = 0;
    for (const k in cool) cool[k] -= dt;
    const st = [];
    for (const m of marbles) {
      const p = m.mesh.position, q = prev.get(m); let vel; if (mode === 'live' && m.body) { const lv = m.body.linvel(); vel = new THREE.Vector3(lv.x, lv.y, lv.z); } else vel = q ? p.clone().sub(q.p).divideScalar(dt) : new THREE.Vector3(); // live: physics velocity (frame deltas jitter with the fixed-step accumulator)
      const sp = vel.length(), dist = p.distanceTo(_v), w = 1 / (1 + (dist / 7) ** 2);
      if (active && m.mesh.visible && sp < 60) { rollW += w * Math.min(1, sp / 10); rollV += w * sp; }
      // rail hit: sudden horizontal velocity change not explained by a marble neighbour
      if (active && q && q.v && cool.rail <= 0 && sp < 60) { const dv = Math.hypot(vel.x - q.v.x, vel.z - q.v.z); if (dv > 4 && w > 0.08 && !marbles.some((o) => o !== m && o.mesh.position.distanceTo(p) < 1.2)) { play(Math.random() < 0.5 ? 'rail1' : 'rail2', { vol: Math.min(1, dv / 9) * 0.7, rate: 0.9 + Math.random() * 0.25, at: p, ref: 4 }); cool.rail = 0.12; } }
      // fling whoosh: a marble that just left the lift
      if (mode === 'live' && q && q.onLift && !m.onLift && cool.fling <= 0) { play('whoosh', { vol: 0.8, rate: 0.9 + Math.random() * 0.2, at: p, ref: 6 }); cool.fling = 0.25; }
      st.push([m, vel]); prev.set(m, { p: p.clone(), v: vel, onLift: m.onLift });
    }
    // marble-marble clicks: closing pairs that touch (O(n^2) on <= 20 balls is nothing)
    if (active) for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
      if (cool.click > 0) break; const [a, va] = st[i], [b, vb] = st[j]; const d = a.mesh.position.distanceTo(b.mesh.position); if (d > 1.06 || !a.mesh.visible || !b.mesh.visible) continue;
      const n = b.mesh.position.clone().sub(a.mesh.position).normalize(), closing = va.clone().sub(vb).dot(n);
      if (closing > 0.6 && closing < 40) { const at = a.mesh.position.clone().lerp(b.mesh.position, 0.5); play('click' + (1 + ((Math.random() * 3) | 0)), { vol: Math.min(1, closing / 6), rate: 0.85 + Math.random() * 0.35, at, ref: 3 }); cool.click = 0.045; }
    }
    if (L.roll) { const g = Math.min(0.55, rollW * 0.35), r = THREE.MathUtils.clamp(0.7 + (rollW > 0 ? rollV / rollW : 0) / 22, 0.7, 1.6); L.roll.g.gain.setTargetAtTime(g, t, 0.08); L.roll.src.playbackRate.setTargetAtTime(r, t, 0.15); }
    if (L.lift_whir) L.lift_whir.g.gain.setTargetAtTime(race.phase === 'idle' ? 0 : mode === 'podium' ? 0 : 0.5, t, 0.3);
    if (musicG && t > duckUntil) musicG.gain.setTargetAtTime(mode === 'live' && race.phase === 'race' ? 0.16 : 0.24, t, 0.6);
  }
  return {
    init, beep, update, play,
    roar(level = 0.12, sec = 2) { // ambience swell; big moments also fire a crowd sample
      if (!ac || !crowd) return; const g = crowd.gain, t = ac.currentTime, base = B.crowd_amb ? 0.35 : 0.015, top = B.crowd_amb ? Math.min(1, 0.35 + level * 3) : level;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(top, t + 0.3); g.linearRampToValueAtTime(base, t + sec);
      if (level >= 0.2) play('crowd_finish', { vol: 0.9 }); else if (level >= 0.12 && t - swellAt > 4) { swellAt = t; play('crowd_swell', { vol: 0.75 }); }
    },
    light(n) { if (!play('beep', { vol: 0.7, rate: 1 })) beep(440, 0.18); },
    go() { if (!play('beep', { vol: 0.9, rate: 2 })) beep(880, 0.45, 0.14); },
    finish() { duck(2.4); if (!play('finish_stinger', { vol: 0.85 })) beep(988, 0.5, 0.1, 'triangle'); },
    replaySting() { duck(1.8); play('replay_sting', { vol: 0.7 }); },
    ui() { play('ui_click', { vol: 0.5 }); },
    pop() { if (!ac || !sfx.noise) return; const s = ac.createBufferSource(); s.buffer = sfx.noise; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = ac.createGain(); g.gain.setValueAtTime(0.18, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5); s.connect(f).connect(g).connect(out); s.start(); s.stop(ac.currentTime + 0.5); },
    whoosh() { if (!play('whoosh', { vol: 0.35, rate: 0.8 })) beep(220, 0.25, 0.05, 'sawtooth'); },
    clank(v = 0.06) { // lift paddle pitch: positional sample at the lift, synth fallback
      if (play('lift_clack', { vol: Math.min(1, v * 9), rate: 0.9 + Math.random() * 0.2, at: liftPos, ref: 5 })) return;
      if (!ac || !sfx.noise) return; const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = sfx.noise; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 600; f.Q.value = 4; const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.06); beep(95 + Math.random() * 20, 0.04, v * 0.6, 'square');
    },
    toggle() { on = !on; localStorage.setItem('dhMute', on ? '0' : '1'); if (on) unlock(); if (ac) on ? ac.resume() : ac.suspend(); return on; },
    get on() { return on; },
    get loaded() { return Object.keys(B); },
    get state() { return ac ? ac.state : 'none'; },
  };
})();

// ---------- race state ----------
const race = { phase: 'idle', t: 0, finishOrder: [], endAt: 0, fastest: null, leaderK: -1, keyMoments: [], finalLap: false, battle: null };
let rngSeed = session.seed;
const rnd = () => (rngSeed = (rngSeed * 16807) % 2147483647) / 2147483647;
function resetRace() {
  rngSeed = session.seed = (session.seed * 7919 + 13) % 100000 || 1;
  Object.assign(race, { phase: 'grid', t: 0, finishOrder: [], endAt: 0, fastest: null, leaderK: -1, keyMoments: [], finalLap: false, battle: null, lastCallout: -99, battleT: {}, lastLeadCall: -99, leadCand: -1, leadCandT: 0, stuckAt: {}, bump: { n: 0, spikes: 0, max: 0 } });
  { // AD: CPU slots draw fresh designs from the roster each race (players keep theirs), so all 18 marbles get raced
    const own = new Set(session.players.map((p) => p.k)), keep = new Set([...own].map((k) => FIELD[k]));
    const pool = [...ROSTER.keys()].filter((r) => !keep.has(r)).sort(() => rnd() - 0.5); let j = 0;
    for (let k = 0; k < NM; k++) if (!own.has(k)) FIELD[k] = pool[j++];
    marbles.forEach((_, k) => skin(k));
  }
  const slots = [...Array(NM).keys()].sort(() => rnd() - 0.5);
  marbles.forEach((m, k) => {
    const sp = spawns[slots[k] % spawns.length];
    m.body.setTranslation({ x: sp.x, y: sp.y + 0.02, z: sp.z }, true);
    m.body.setLinvel({ x: 0, y: 0, z: 0 }, true); m.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    m.hint = project(sp, FIN, true).i;
    const pr = project(sp, m.hint); m.prog = wrap(pr.s - SFIN); m.lastS = pr.s; m.pr = pr;
    m.drag = PHYS.drag * (1 - PHYS.dragVar + 2 * PHYS.dragVar * rnd()); m.body.setLinearDamping(m.drag); // per-marble rolling drag = the "form" that spreads the field
    Object.assign(m, { finished: false, finishTime: 0, falls: 0, stall: 0, stucks: 0, assistT: 0, onLift: false, passes: [], piece: '', lapTimes: [], lastLapAt: 0, lap: 0, pos: 0, arrow: 0, arrowUntil: 0 });
    m.vhint = m.hint; m.mesh.visible = true; m.mat.emissive.copy(m.baseEm);
  });
  rec.reset();
}

// ---------- recorder: ring buffer of every marble + blimp transform at 30 Hz (deterministic replay) ----------
const REC_HZ = 30, REC_EVERY = Math.round(1 / (DT * REC_HZ)), REC_MAX = REC_HZ * 240, OBJ = NM + 1, STR = OBJ * 7;
const rec = {
  buf: new Float32Array(REC_MAX * STR), n: 0, t0: 0, step: 0,
  reset() { this.n = 0; this.step = 0; this.t0 = 0; },
  push() {
    const o = (this.n % REC_MAX) * STR; let j = o;
    for (const m of marbles) { const t = m.body.translation(), r = m.body.rotation(); this.buf.set([t.x, t.y, t.z, r.x, r.y, r.z, r.w], j); j += 7; }
    const bq = blimp ? blimp.quaternion : _q; this.buf.set([BL.pos.x, BL.pos.y, BL.pos.z, bq.x, bq.y, bq.z, bq.w], j);
    this.n++;
  },
  range() { const first = Math.max(0, this.n - REC_MAX); return [this.t0 + first / REC_HZ, this.t0 + (this.n - 1) / REC_HZ]; },
  apply(t) { // write interpolated transforms into meshes
    const [a, b] = this.range(); t = THREE.MathUtils.clamp(t, a, b);
    const f = (t - this.t0) * REC_HZ; const i0 = Math.floor(f), i1 = Math.min(this.n - 1, i0 + 1), u = f - i0;
    const o0 = (i0 % REC_MAX) * STR, o1 = (i1 % REC_MAX) * STR, B = this.buf;
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    for (let k = 0; k < OBJ; k++) {
      const j0 = o0 + k * 7, j1 = o1 + k * 7;
      const obj = k < NM ? marbles[k].mesh : blimp; if (!obj) continue;
      const x = B[j0] + (B[j1] - B[j0]) * u, y = B[j0 + 1] + (B[j1 + 1] - B[j0 + 1]) * u, z = B[j0 + 2] + (B[j1 + 2] - B[j0 + 2]) * u;
      qa.set(B[j0 + 3], B[j0 + 4], B[j0 + 5], B[j0 + 6]); qb.set(B[j1 + 3], B[j1 + 4], B[j1 + 5], B[j1 + 6]);
      obj.position.set(x, y, z); obj.quaternion.slerpQuaternions(qa, qb, u);
    }
  },
};

const _p = new THREE.Vector3();
let simT = 0, liftMech = null;
function physicsStep() {
  const racing = race.phase === 'race' || race.phase === 'done';
  if (racing) race.t += DT;
  race.leadProg = Math.max(...marbles.map((o) => o.prog ?? 0));
  for (const m of marbles) {
    const tr = m.body.translation(); _p.set(tr.x, tr.y, tr.z);
    const pr = project(_p, m.hint); m.hint = pr.i;
    const d = wrap(pr.s - m.lastS); m.lastS = pr.s;
    if (Math.abs(d) < 5) m.prog += d;
    m.pr = pr;
    if (tr.y < pr.cy - 3 || Math.abs(pr.lat) > HW[pr.i] + 2.5 || tr.y > pr.cy + 8) { respawn(m, pr); continue; }
    if (!racing) { const lv = m.body.linvel(); m.body.setLinvel({ x: lv.x * 0.9, y: lv.y, z: lv.z * 0.9 }, true); continue; }
    const lv = m.body.linvel(), mass = m.body.mass();
    if (m.vyPrev !== undefined && !m.onLift && race.t > 1) { const dvy = Math.abs(lv.y - m.vyPrev); const pc = pieceAt(pr.s); if (pc === 'FINISH STRAIGHT' || pc === 'THE NARROW' || pc === 'SWEEPER') { race.bump.n++; if (dvy > 3) race.bump.spikes++; race.bump.max = Math.max(race.bump.max, dvy); } } m.vyPrev = lv.y;
    const vAlong = lv.x * pr.tan.x + lv.y * pr.tan.y + lv.z * pr.tan.z;
    m.onLift = inLift(pr.s); { // v4: no invisible conveyor. The step elevator's kinematic paddles physically carry marbles (see liftMech)
      // gravity race. Only aid: a nudge if a marble is truly stuck (never happens on a clean run; counted)
      // v3 tune: flat track sections (0.5-1.7% in the sweeper, crest and dohyo exit) bleed marbles to a stop on the rail,
      // so below minV a small along-track pull (<= assist u/s^2, ~8% g) keeps them rolling. Above minV it's pure gravity.
      if (PHYS.minV > 0 && !m.onLift && race.t > 1 && vAlong < PHYS.minV) { const a = Math.min(PHYS.assist * (HAIR[pr.i] ? 1.5 : 1), (PHYS.minV - vAlong) * 1.5); m.body.applyImpulse({ x: pr.tan.x * a * mass * DT, y: 0, z: pr.tan.z * a * mass * DT }, true); m.assistT += DT; }
      if (!m.onLift && Math.hypot(lv.x, lv.z) < 0.8 && race.t > 3) { m.stall += DT; if (m.stall > 1.0) { const nr = NRM[pr.i], sl = -Math.sign(pr.lat) * 1.5; m.body.applyImpulse({ x: (pr.tan.x * 12 + nr.x * sl) * mass, y: mass * 4, z: (pr.tan.z * 12 + nr.z * sl) * mass }, true); m.stall = 0; m.stucks++; (race.stuckAt[pieceAt(pr.s) || '?'] = (race.stuckAt[pieceAt(pr.s) || '?'] || 0) + 1); } } else m.stall = 0;
      if (race.t < 0.4) m.body.applyImpulse({ x: pr.tan.x * mass * 30 * DT, y: 0, z: pr.tan.z * mass * 30 * DT }, true); // start gate push-off
      if (m.finished) m.body.setLinvel({ x: lv.x * 0.995, y: lv.y, z: lv.z * 0.995 }, true);
    }
    if (racing && !m.finished) { const pc = pieceAt(pr.s); if (pc && pc !== m.piece) m.passes.push({ t: race.t, piece: pc, lap: Math.floor(m.prog / L) }); m.piece = pc; }
    const lapNow = Math.floor(m.prog / L);
    if (lapNow > m.lap && m.prog > 0) { m.lap = lapNow; const lt = race.t - m.lastLapAt; m.lapTimes.push(lt); m.lastLapAt = race.t; onLap(m, lt); }
    if (!m.finished && m.prog >= LAPS * L) {
      m.finished = true; m.finishTime = race.t; race.finishOrder.push(m);
      if (race.finishOrder.length === 1) { race.phase = 'done'; race.endAt = race.t + Math.max(14, Math.min(30, 0.4 * race.t / LAPS)); onWinner(m); }
    }
  }
  simT += DT; if (liftMech) liftMech.step(simT);
  world.step();
  if (racing || race.phase === 'grid') { if (rec.step++ % REC_EVERY === 0) { if (rec.n === 0) rec.t0 = race.t; if (race.phase !== 'grid') rec.push(); else rec.t0 = race.t; } }
  if (race.phase === 'done' && (race.finishOrder.length === NM || race.t > race.endAt)) endRace();
}
function respawn(m, pr) {
  m.falls++;
  const i = ((pr.i - 2) % N + N) % N;
  m.body.setTranslation({ x: P[i].x, y: P[i].y + R + 0.3, z: P[i].z }, true);
  const v = race.phase === 'race' || race.phase === 'done' ? 5 : 0;
  m.body.setLinvel({ x: T[i].x * v, y: 0, z: T[i].z * v }, true); m.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  m.hint = i; m.lastS = S[i];
}
function standings() { return [...race.finishOrder, ...marbles.filter((m) => !m.finished).sort((a, b) => b.prog - a.prog)]; }
const gapSec = (a, b) => Math.max(0, (a.prog - b.prog) / SPEED_REF);

// ---------- race drama ----------
function lower(text, cls = '', ms = 2600) { const el = $('lower'); el.className = cls; el.textContent = text; void el.offsetWidth; el.classList.remove('hidden'); clearTimeout(lower.t); lower.t = setTimeout(() => el.classList.add('hidden'), ms); }
const pname = (m) => { const p = session.byMarble(m.k); return p ? `${m.name} (${p.name})` : m.name; };
function onLap(m, lt) {
  if (!race.fastest || lt < race.fastest.t) { const first = !race.fastest; race.fastest = { k: m.k, t: lt }; if (!first || m.lap >= 1) lower(`⏱ FASTEST LAP · ${pname(m)} · ${lt.toFixed(2)}`, 'purple'); }
  if (!race.finalLap && m.lap === LAPS - 1 && LAPS > 1) { race.finalLap = true; banner('FINAL LAP', 2600, 'final'); sfx.beep(988, 0.5, 0.1, 'triangle'); setTimeout(() => sfx.beep(988, 0.5, 0.1, 'triangle'), 300); sfx.roar(0.08, 3); }
}
function dramaTick() { // ~4 Hz while racing
  if (race.phase !== 'race') return;
  const st = standings(), now = performance.now();
  st.forEach((m, i) => { const p = i + 1; if (m.pos && p !== m.pos && race.t > 2) { m.arrow = p < m.pos ? 1 : -1; m.arrowUntil = now + 3000; } m.pos = p; });
  const lead = st[0];
  if (race.leaderK !== lead.k && (race.leadCand === lead.k ? (race.leadCandT += 0.25) >= 0.75 : ((race.leadCand = lead.k), (race.leadCandT = 0), race.leaderK < 0))) { if (race.leaderK >= 0 && race.t > 4 && race.t - (race.lastLeadCall || -99) > 6) { race.lastLeadCall = race.t; lower(`🔥 NEW LEADER · ${pname(lead)}`, 'gold'); race.keyMoments.push({ t: race.t, k: lead.k, type: 'lead', lap: Math.floor(lead.prog / L) + 1, at: lead.piece || '' }); sfx.roar(0.14, 2.5); race.lastCallout = race.t; } race.leaderK = lead.k; }
  // battles: adjacent within 0.25 s for > 1.2 s
  let best = null;
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1]; if (a.finished || b.finished) continue;
    const key = a.k + '-' + b.k, close = gapSec(a, b) < 0.25;
    race.battleT[key] = close ? (race.battleT[key] || 0) + 0.25 : 0;
    if (race.battleT[key] > 1.2) { const pri = (session.byMarble(a.k) || session.byMarble(b.k) ? 3 : 0) + (i < 3 ? 2 : 0) - i * 0.1; if (!best || pri > best.pri) best = { a: a.k, b: b.k, posn: i + 1, pri }; }
  }
  if (best) { race.battle = { ...best, until: race.t + 4 }; if (race.t - race.lastCallout > 7) { lower(`⚔ BATTLE FOR P${best.posn} · ${marbles[best.a].name} vs ${marbles[best.b].name}`); race.lastCallout = race.t; sfx.roar(0.07, 1.5); } }
  else if (race.battle && race.t > race.battle.until) race.battle = null;
}

// ---------- cameras ----------
const CAMS = ['TV', 'Blimp', 'Chase', 'Front'];
let camMode = 2, follow = session.players[0]?.k ?? 0; // follow: marble index, or -1 = race director (leader/battles)
const camPos = new THREE.Vector3(-20, 14, 50), camLook = new THREE.Vector3(0, 5, 37);
let camSnap = true, shotName = '';
function setCam(k) { camMode = (k + CAMS.length) % CAMS.length; camSnap = true; dir.shot = null; renderCamBtns(); }
// TV stations: generated around whatever loop the glb has. Each has a lens type.
const stations = [];
const occluders = []; const NOOCC = /^(TRACK_floor|TRACK_rail|TRACK_PATH|TRACK_centerline|FX_dh_blimp|FX_pennants|FINISH_LINE|SPAWN_)/;
world3d.traverse((o) => { if (o.isMesh && !NOOCC.test(o.name) && !NOOCC.test(o.parent?.name || '')) occluders.push(o); });
const ray = new THREE.Raycaster();
function visible(from, to, list = occluders) { // both directions, so a camera sitting inside a closed mesh (stands, boards) fails too
  const d = to.clone().sub(from); const len = d.length(); d.divideScalar(len); ray.set(from, d); ray.far = len - 1.5;
  if (list === occluders && insideAny(from)) return false;
  if (ray.intersectObjects(list, false).length) return false;
  ray.set(to.clone().addScaledVector(d, -1.2), d.clone().negate()); ray.far = len - 1.2; return ray.intersectObjects(list, false).length === 0;
}
const trackOcc = []; for (const nm of ['TRACK_floor', 'TRACK_rail_inner_cyan', 'TRACK_rail_outer_pink']) node(nm)?.traverse((o) => o.isMesh && trackOcc.push(o));
const allOcc = []; world3d.traverse((o) => { if (o.isMesh && !/^(TRACK_floor|TRACK_rail|TRACK_centerline|TRACK_PATH|FX_dh_blimp)/.test(o.name) && !/^(FX_dh_blimp)/.test(o.parent?.name || '')) allOcc.push(o); });
const visibleAll = (a, b) => visibleT(a, b) && visible(a, b, allOcc); // photo cam: pennants and flags count too
const visibleT = (a, b) => visible(a, b) && visible(a, b, trackOcc); // v3: stacked passes (corkscrew, lift over the canal) block cameras too
const occBoxes = occluders.map((o) => new THREE.Box3().setFromObject(o)).filter((b) => b.getSize(new THREE.Vector3()).length() < 60);
function insideAny(p) { for (const b of occBoxes) if (b.containsPoint(p)) return true; return false; }
// v3 set pieces (raw centerline sample ranges of track v2; fall back to evenly spread cams on other tracks)
const PIECES = rawPts.length === 383 ? [
  ['FINISH STRAIGHT', 0, 40], ['SWEEPER', 42, 68], ['CHAIN LIFT', 70, 112], ['CREST', 112, 128], ['THE DROP', 140, 190],
  ['CORKSCREW', 192, 262], ['THE NARROW', 274, 306], ['ZEN HAIRPIN', 306, 330], ['TORII S', 334, 360], ['DOHYO HAIRPIN', 360, 382],
] : Array.from({ length: 8 }, (_, k) => ['TRACK', Math.floor(k * rawPts.length / 8), Math.floor((k + 1) * rawPts.length / 8)]);
const pieceAt0 = 0;
const pieceAt = (s) => { for (const [nm, a, b] of PIECES) { const s0 = sOfRawIdx(a), s1 = sOfRawIdx(b); if (s >= s0 && s <= s1) return nm; } return ''; };
for (let i = 0; i < N; i++) HAIR[i] = /HAIRPIN|CREST|SWEEPER/.test(pieceAt(S[i])) ? 1 : 0;
const helixC = (() => { const c = new THREE.Vector3(); let n = 0; for (let k = 192; k <= 262 && k < rawPts.length; k++) { c.add(rawPts[k]); n++; } return n ? c.divideScalar(n) : center.clone(); })();
// [raw sample, lens, side (+1 left of travel / -1 right), offset from centerline, height above deck, bonus]
const SPOTS = rawPts.length === 383 ? [
  [6, 'tele', -1, 15, 6, 1], [14, 'low', 1, 0, 1.2, 1], [22, 'jib', -1, 0, 3, 1], [28, 'pan', 1, 12, 4, 0],
  [48, 'tele', 1, 18, 7, 0], [62, 'low', -1, 0, 1.2, 0],
  [72, 'low', 1, 0, 1.0, 2], [84, 'pan', -1, 9, 3, 2], [98, 'tele', 1, 16, 2, 2], [108, 'jib', -1, 0, 3, 2],
  [116, 'pan', 1, 10, 4, 1], [124, 'low', -1, 0, 1.2, 1],
  [146, 'tele', -1, 18, 9, 2], [158, 'low', 1, 0, 1.2, 2], [172, 'pan', -1, 11, 5, 2], [184, 'jib', 1, 0, 3, 2],
  [196, 'tele', 1, 20, 6, 3], [206, 'pan', 1, 12, 2, 3], [218, 'mast', 0, 0, 0, 3], [228, 'low', 1, 0, 1.2, 3], [240, 'tele', 1, 22, -2, 3], [252, 'over', 0, 0, 14, 3],
  [278, 'low', 1, 0, 1.0, 3], [286, 'tele', -1, 17, 3, 3], [294, 'pan', 1, 10, 2, 3], [302, 'jib', -1, 0, 3, 3],
  [312, 'tele', 1, 18, 8, 2], [320, 'low', -1, 0, 1.2, 2], [326, 'over', 0, 0, 13, 2],
  [340, 'pan', 1, 11, 4, 1], [350, 'low', -1, 0, 1.2, 1], [356, 'tele', -1, 16, 6, 1],
  [364, 'tele', 1, 17, 7, 2], [370, 'low', -1, 0, 1.2, 2], [376, 'over', 0, 0, 12, 2],
] : PIECES.flatMap(([, a, b], n) => [[a + 2, ['tele', 'low', 'jib', 'pan'][n % 4], n % 2 ? 1 : -1, 14, 5, 0], [(a + b) >> 1, 'low', n % 2 ? -1 : 1, 0, 1.2, 0]]);
for (const [ri, type, side0, off0, h0, bonus] of SPOTS) {
  const s = sOfRawIdx(ri), { i } = pointAtS(s); let placed = false;
  const tries = type === 'mast' ? [[0, 0], [0, 0.6]] : type === 'over' ? [[0, 0], [1, 2], [-1, 2], [0, 3]] : [[side0, 1], [side0, 1.35], [-side0, 1], [side0, 0.7], [side0, 1.7, 4], [-side0, 1.4, 4]];
  for (const [side, f, dh = 0] of tries) {
    if (placed) break;
    const out = NRM[i].clone().multiplyScalar(side || 1); let pos;
    if (type === 'mast') pos = helixC.clone().addScaledVector(P[i].clone().sub(helixC).setY(0).normalize(), 2.6 + f * 4).setY(P[i].y + 1.6);
    else if (type === 'over') pos = P[i].clone().addScaledVector(NRM[i], side * f * 3).add(new THREE.Vector3(0, h0, 0));
    else { const off = type === 'low' ? HW[i] + 1.6 : type === 'jib' ? HW[i] + 5 : off0 * f; pos = P[i].clone().addScaledVector(out, off).add(new THREE.Vector3(0, (type === 'low' ? 1.2 : h0) + dh, 0)); }
    let ok = !insideAny(pos);
    if (ok && type !== 'mast' && type !== 'over') for (let j = 0; j < N; j += 2) { const q = P[j]; if (Math.hypot(q.x - pos.x, q.z - pos.z) < HW[j] + 1.2 && Math.abs(q.y - pos.y) < 4) { ok = false; break; } }
    if (ok && !(visibleT(pos, P[i].clone().add(new THREE.Vector3(0, 0.6, 0))) && visibleT(pos, pointAtS(S[i] + 6).p.add(new THREE.Vector3(0, 0.6, 0))))) ok = false;
    if (ok) { stations.push({ i, s: S[i], pos, type, side: side || 1, out, h: h0, bonus, piece: pieceAt(S[i]) }); placed = true; }
  }
}
// ---------- v3 floor readability (critique #10): thin edge lines + dashed lane lines, inside the locked palette ----------
// Lines are a darker tone of the same gray-lavender deck (no new hues), so dark marbles read against a ruled surface.
const floorMeshes = []; node('TRACK_floor')?.traverse((o) => o.isMesh && floorMeshes.push(o));
const fray = new THREE.Raycaster();
const deckY = (p) => { fray.set(new THREE.Vector3(p.x, p.y + 1.6, p.z), new THREE.Vector3(0, -1, 0)); fray.far = 3.4; const h = fray.intersectObjects(floorMeshes, false)[0]; return h ? h.point.y : null; };
function ribbon(offs, w, color, opacity, dashed, sFrom = 0, sTo = L, tex = null) {
  const pos = [], uv = [], idx = []; let n = 0, prev = null;
  for (let k = 0; k <= Math.ceil((sTo - sFrom) / 0.6); k++) {
    const s = Math.min(sTo, sFrom + k * 0.6), { p, i } = pointAtS(s);
    const a = p.clone().addScaledVector(NRM[i], offs(i) - w / 2), b = p.clone().addScaledVector(NRM[i], offs(i) + w / 2);
    const ya = deckY(a), yb = deckY(b); if (ya == null || yb == null) { prev = null; continue; }
    a.y = ya + 0.025; b.y = yb + 0.025; pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(0, s / 1.2, 1, s / 1.2);
    if (prev !== null && (!dashed || Math.floor(s / 1.5) % 2 === 0)) idx.push(prev, prev + 1, n, prev + 1, n + 1, n);
    prev = n; n += 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, map: tex, fog: true });
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 2; scene.add(mesh); return mesh;
}
if (Q.get('lanes') !== '0' && floorMeshes.length) {
  ribbon((i) => HW[i] - 0.45, 0.09, 0x5d5670, 0.55, false); ribbon((i) => -(HW[i] - 0.45), 0.09, 0x5d5670, 0.55, false);
  ribbon((i) => HW[i] / 3, 0.07, 0x6f6884, 0.4, true); ribbon((i) => -HW[i] / 3, 0.07, 0x6f6884, 0.4, true);
}
// v4 SMOOTH COLLISION FLOOR: the glb deck is low-poly, so marbles hit facet bumps. Sample the visual deck height on a dense grid
// (0.4 u along the centerline x 9 lanes across, banking included), smooth it along the track (gaussian), use that as the physics floor.
if (SMOOTH && floorMeshes.length) {
  const ds = 0.4, nS = Math.ceil(L / ds), nX = 9, H = [], ok = [];
  for (let a = 0; a < nS; a++) { const { p, i } = pointAtS(a * ds); const row = [], okr = []; for (let b = 0; b < nX; b++) { const lat = (b / (nX - 1) * 2 - 1) * (HW[i] + 0.4); const q = p.clone().addScaledVector(NRM[i], lat); const y = deckY(q); row.push(y ?? p.y - 0.5); okr.push(y != null); } H.push(row); ok.push(okr); }
  for (let b = 0; b < nX; b++) for (let a = 0; a < nS; a++) if (!ok[a][b]) { let l = 1; while (l < 40 && !ok[(a - l + nS) % nS][b] && !ok[(a + l) % nS][b]) l++; const y1 = ok[(a - l + nS) % nS][b] ? H[(a - l + nS) % nS][b] : null, y2 = ok[(a + l) % nS][b] ? H[(a + l) % nS][b] : null; H[a][b] = y1 != null && y2 != null ? (y1 + y2) / 2 : (y1 ?? y2 ?? H[a][b]); }
  const W = 4, wts = []; for (let k = -W; k <= W; k++) wts.push(Math.exp(-(k * k) / (2 * 2.2 * 2.2)));
  const HS = H.map((row, a) => row.map((_, b) => { let sw = 0, sy = 0; for (let k = -W; k <= W; k++) { const r = (a + k + nS) % nS; const y = H[r][b]; if (Math.abs(y - H[a][b]) > 1.2) continue; sw += wts[k + W]; sy += wts[k + W] * y; } return sy / sw; }));
  // sag fill (physics only, ?sagfill=0 to disable): where a banked turn unwinds, the inner edge of the v2 deck dips then climbs
  // (e.g. crest s~126-136, -0.4 u), a pocket marbles settle into. Fill each lane so it never climbs outside the lift; cap 0.45 u.
  let sagMax = 0;
  if (Q.get('sagfill') !== '0' && LIFT) { const aL = Math.ceil((LIFT.s1 + 2) / ds); for (let b = 0; b < nX; b++) { let prev = HS[aL % nS][b]; for (let k = 1; k < nS; k++) { const a = (aL + k) % nS, sv = a * ds; if (sv >= LIFT.s0 - PHYS.liftLead - 1 && sv <= LIFT.s1 + 2) { prev = HS[a][b]; continue; } const y = HS[a][b]; if (y > prev && y - prev < 0.45) { sagMax = Math.max(sagMax, y - prev); HS[a][b] = prev; } prev = HS[a][b] - 0.0005; } } }
  const v = new Float32Array(nS * nX * 3), idx = [];
  for (let a = 0; a < nS; a++) { const { p, i } = pointAtS(a * ds); for (let b = 0; b < nX; b++) { const lat = (b / (nX - 1) * 2 - 1) * (HW[i] + 0.4); const q = p.clone().addScaledVector(NRM[i], lat); const o = (a * nX + b) * 3; v[o] = q.x; v[o + 1] = HS[a][b]; v[o + 2] = q.z; } }
  for (let a = 0; a < nS; a++) { const a2 = (a + 1) % nS; if (Math.abs(HS[a][4] - HS[a2][4]) > 1.5) continue; for (let b = 0; b < nX - 1; b++) { const i0 = a * nX + b, i1 = a2 * nX + b; const e1 = [v[i1 * 3] - v[i0 * 3], v[i1 * 3 + 1] - v[i0 * 3 + 1], v[i1 * 3 + 2] - v[i0 * 3 + 2]], e2 = [v[(i0 + 1) * 3] - v[i0 * 3], v[(i0 + 1) * 3 + 1] - v[i0 * 3 + 1], v[(i0 + 1) * 3 + 2] - v[i0 * 3 + 2]]; const ny = e1[2] * e2[0] - e1[0] * e2[2]; if (ny > 0) idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1); else idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1); } } // up-facing winding (FIX_INTERNAL_EDGES uses face normals)
  const fl = RAPIER.TriMeshFlags ? RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES : undefined;
  const d = fl !== undefined ? RAPIER.ColliderDesc.trimesh(v, Uint32Array.from(idx), fl) : RAPIER.ColliderDesc.trimesh(v, Uint32Array.from(idx));
  d.setFriction(0.7).setRestitution(0.08); if (CMIN != null) d.setRestitutionCombineRule(CMIN); world.createCollider(d);
  console.log('[smoothFloor] samples', nS, 'x', nX, 'tris', idx.length / 3, 'sagFillMax', sagMax.toFixed(2));
  if (Q.get('dbgfloor')) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.setIndex(idx); scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }))); }
}
// v4 STEP ELEVATOR (replaces the v3 conveyor + chevrons). Modeled on the hobby's motorized step/pickup belt elevators:
// a closed loop of black paddles with red caps rides up the lift ramp inside a dark housing between two drums.
// Each paddle is a KINEMATIC Rapier body, so marbles are physically carried in the pockets, at belt speed, no invisible push.
// At the top the paddle sinks back through the deck slot on a long, gentle ramp, so the marble is set down and rolls off at belt speed (no launch).
if (LIFT && floorMeshes.length) liftMech = (() => {
  const uA = LIFT.s0 - PHYS.liftLead, uB = LIFT.s1, Lf = uB - uA, RISE = 4.0, DEPTH = 1.4, FL = PHYS.flZone, FK = PHYS.flick, LfP = Lf - FL + FL / FK;
  const nP = Math.max(4, Math.floor((LfP + Lf + 2 * DEPTH) / PHYS.pitch)), loop = nP * PHYS.pitch;
  // sample deck frame along the lift every 0.25 u
  const fr = []; for (let u = uA - 1; u <= uB + 1.01; u += 0.25) { const { p, i } = pointAtS(u); const y = deckY(p); fr.push({ u, p: new THREE.Vector3(p.x, y ?? p.y - 0.5, p.z), i }); }
  const at = (u) => { const k = THREE.MathUtils.clamp((u - (uA - 1)) / 0.25, 0, fr.length - 1.001); const k0 = Math.floor(k), f = k - k0; const a = fr[k0], b = fr[k0 + 1]; return { p: a.p.clone().lerp(b.p, f), i: a.i, t: b.p.clone().sub(a.p).normalize() }; };
  const hwMin = (() => { let m = 99; for (const f of fr) m = Math.min(m, HW[f.i]); return m; })();
  const half = { x: hwMin - 0.2, y: 0.42, z: 0.12 };
  const ease = (x) => x * x * (3 - 2 * x);
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _qq = new THREE.Quaternion();
  function pose(ph, out) { // ph in [0, loop): forward run on top, then the return run below the deck
    let u, h, z;
    if (ph < Lf - FL) { u = uA + ph; z = 1; h = ease(Math.min(1, (u - uA) / RISE)); }
    else if (ph < LfP) { const x = (ph - (Lf - FL)) / (FL / FK); u = uB - FL + x * FL; z = 1; // FLING: the paddle whips forward at FK x belt speed and flips up, tossing the marble over the crest
      h = x < 0.55 ? 1 + PHYS.flUp * Math.sin(Math.PI * x / 0.55) : ease(Math.max(0, 1 - (x - 0.55) / 0.45)); }
    else { u = uB - (ph - LfP) * (Lf / (loop - LfP)); z = -1; h = 0; }
    const f = at(u); _z.copy(f.t); _x.copy(NRM[f.i]); _y.crossVectors(_z, _x).normalize(); if (_y.y < 0) { _y.negate(); _x.negate(); }
    const lift = z > 0 ? -DEPTH + h * (DEPTH + half.y - 0.02) : -DEPTH; // continuous all the way round: no kinematic teleports
    out.pos.copy(f.p).addScaledVector(_y, lift); _m.makeBasis(_x, _y, _z); out.q.setFromRotationMatrix(_m); out.up = h; return out;
  }
  const blackM = new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.55, metalness: 0.2 }), redM = new THREE.MeshStandardMaterial({ color: 0xd7192d, roughness: 0.4, emissive: 0x3a0006 });
  const steelM = new THREE.MeshStandardMaterial({ color: 0x8d8a96, roughness: 0.35, metalness: 0.7 });
  const padGeo = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), capGeo = new THREE.BoxGeometry(half.x * 2, 0.08, half.z * 2 + 0.06);
  const pads = [];
  for (let k = 0; k < nP; k++) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setFriction(0.3).setRestitution(0.05), body);
    const g = new THREE.Group(); const box = new THREE.Mesh(padGeo, blackM); const cap = new THREE.Mesh(capGeo, redM); cap.position.y = half.y; g.add(box, cap); scene.add(g);
    pads.push({ body, g, o: { pos: new THREE.Vector3(), q: new THREE.Quaternion() } });
  }
  // housing: dark side cheeks along the ramp + drums at both ends + under-belt band (visual only; rails stay the colliders)
  const cheekPts = []; for (let u = uA; u <= uB; u += 1) cheekPts.push(at(u));
  for (const side of [-1, 1]) for (let k = 0; k < cheekPts.length - 1; k++) {
    const a = cheekPts[k], b = cheekPts[k + 1]; const len = a.p.distanceTo(b.p);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, len + 0.02), blackM);
    const mid = a.p.clone().lerp(b.p, 0.5).addScaledVector(NRM[a.i], side * (HW[a.i] + 0.75)); mid.y -= 0.9;
    m.position.copy(mid); m.lookAt(mid.clone().add(b.p.clone().sub(a.p))); scene.add(m);
    if (k % 4 === 0) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10), redM); bolt.rotation.copy(m.rotation); bolt.rotateZ(Math.PI / 2); bolt.position.copy(mid).addScaledVector(NRM[a.i], side * 0.08); scene.add(bolt); }
  }
  const drums = [];
  for (const u of [uA + 0.2, uB - 0.2]) { const f = at(u); const d = new THREE.Mesh(new THREE.CylinderGeometry(DEPTH * 0.55, DEPTH * 0.55, half.x * 2 + 0.6, 20, 1), steelM); d.position.copy(f.p); d.position.y -= DEPTH * 0.55; d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), NRM[f.i].clone().normalize()); scene.add(d); drums.push(d); }
  let off = 0;
  return {
    pads, uA, uB, nP, Lf,
    step(t) {
      if (race.phase === 'race' || race.phase === 'done') off = t - race.t;
      for (let k = 0; k < nP; k++) { const o = pose((((t * PHYS.liftV + k * PHYS.pitch) % loop) + loop) % loop, pads[k].o); pads[k].body.setNextKinematicTranslation(o.pos); pads[k].body.setNextKinematicRotation(o.q); }
    },
    draw(t) {
      const tt = view.mode === 'replay' ? t + off : t;
      for (let k = 0; k < nP; k++) { const o = pose((((tt * PHYS.liftV + k * PHYS.pitch) % loop) + loop) % loop, pads[k].o); pads[k].g.position.copy(o.pos); pads[k].g.quaternion.copy(o.q); }
      for (const d of drums) d.rotateY(0); // drums read as static rollers; belt motion carries the mechanical read
    },
  };
})();
console.log('[stations]', stations.length, stations.map((s) => s.type[0]).join(''));
{ // finish-line gantry cam (head-on down the straight), first unobstructed candidate
  const back = pointAtS(SFIN - 12).p.add(new THREE.Vector3(0, 0.5, 0)); let g = null;
  for (const a of [9, 13, 6, 17]) for (const h of [2.2, 3.5, 5.5]) for (const l of [0, 1.5, -1.5]) { if (g) break; const c = pointAtS(SFIN + a).p.addScaledVector(NRM[FIN], l).add(new THREE.Vector3(0, h, 0)); if (visible(c, back)) g = c; }
  stations.push({ i: FIN, s: SFIN + 9, pos: g || pointAtS(SFIN + 9).p.add(new THREE.Vector3(0, 3.5, 0)), type: 'gantry', side: 0, out: T[FIN].clone(), h: 3.5 });
}
// photo-finish cam: side-on to the line, first unobstructed spot
// v3 photo cam: off the gantry-leg plane (|al| >= 1.8), long lens
const finCam = (() => { const fp = P[FIN].clone().add(new THREE.Vector3(0, 0.5, 0)); for (const d of [HALFW + 12, HALFW + 16, HALFW + 9]) for (const al of [2.5, -2.5, 3.5, -3.5, 1.8]) for (const h of [3.4, 4.6, 2.6]) for (const side of [-1, 1]) { const c = P[FIN].clone().addScaledVector(NRM[FIN], side * d).addScaledVector(T[FIN], al).add(new THREE.Vector3(0, h, 0)); if (visibleAll(c, fp) && visibleAll(c, fp.clone().addScaledVector(NRM[FIN], side * HALFW * 0.8)) && visibleAll(c, fp.clone().addScaledVector(NRM[FIN], -side * HALFW * 0.8)) && visibleAll(c, fp.clone().add(new THREE.Vector3(0, 1.2, 0)))) { console.log('[photocam]', d.toFixed(1), h, side); return { pos: c, d: Math.hypot(d, h) }; } } console.warn('[photocam] fallback'); return { pos: P[FIN].clone().addScaledVector(NRM[FIN], -(HALFW + 5)).add(new THREE.Vector3(0, 7, 0)), d: HALFW + 8 }; })();
const dir = { shot: null, last: '' };
function subject(k) { const m = marbles[k]; return { m, p: m.mesh.position, pr: m.vpr || project(m.mesh.position, m.vhint, true) }; }
function directorSubject(fk = follow) {
  const follow = fk;
  if (follow >= 0) return { k: follow, k2: race.battle && (race.battle.a === follow || race.battle.b === follow) ? (race.battle.a === follow ? race.battle.b : race.battle.a) : -1 };
  if (race.battle && view.mode === 'live') return { k: race.battle.b, k2: race.battle.a };
  const st = standings(); return { k: st[0].k, k2: -1 };
}
function cutTV(sub, ts) { // ts in SECONDS. Picks the station that will cover the subject longest; random only at cut time.
  const S0 = subject(sub.k); const v = Math.max(8, Math.hypot(S0.m.body.linvel().x, S0.m.body.linvel().z)), lead = THREE.MathUtils.clamp(v * 1.6, 6, 80);
  const cands = stations.map((st) => {
    const ahead = wrap(st.s - S0.pr.s); const d = st.pos.distanceTo(S0.p);
    let score;
    if (st.type === 'gantry') score = ahead > 4 && ahead < lead * 2 ? 9 : -99;
    else score = (ahead > -6 && ahead < lead * 2.5 ? 6 - Math.abs(ahead - lead) * (6 / lead) : -20) - Math.max(0, d - 40) * 0.1;
    if (st.type === dir.last) score -= 2;
    if (st === dir.shot?.st) score -= 4; // never re-cut to the same angle
    score += (st.bonus || 0) * 0.6;
    return { st, score: score + Math.random() * 1.2 };
  }).filter((c) => c.score > -50).sort((a, b) => b.score - a.score);
  for (const c of cands.slice(0, 8)) {
    if (visibleT(c.st.pos, S0.p.clone().add(new THREE.Vector3(0, 0.4, 0)))) {
      dir.last = c.st.type;
      const dist = c.st.pos.distanceTo(S0.p);
      return { st: c.st, t0: ts, dur: c.st.type === 'gantry' ? 5 : 5 + Math.random() * 3, k: sub.k, k2: sub.k2, zoom: 0.8 + Math.random() * 0.4, fov0: null, lostT: 0, dist0: dist };
    }
  }
  return cands[0] ? { st: cands[0].st, t0: ts, dur: 5, k: sub.k, k2: sub.k2, zoom: 1, lostT: 0 } : null;
}
function lookTarget(k, k2) { const a = marbles[k].mesh.position.clone(); if (k2 >= 0) a.lerp(marbles[k2].mesh.position, 0.5); return a.add(new THREE.Vector3(0, 0.3, 0)); }
function packFocus() { const st = standings().slice(0, 4); const c = new THREE.Vector3(); for (const m of st) c.add(m.mesh.position); return c.divideScalar(st.length); }
function packSpread(c) { let r = 0; for (const m of standings().slice(0, 6)) r = Math.max(r, m.mesh.position.distanceTo(c)); return r; }

// v4 TV DIRECTOR. Root cause of the v3 flicker: shot durations were in seconds but compared against requestAnimationFrame
// time in MILLISECONDS, so every shot "expired" after ~4 ms and the director re-cut (with a random pick) EVERY FRAME; it also
// re-cut whenever the battle subject swapped (4 Hz). Now: subject locked for the whole shot, hold 5-8 s, early cut only after
// TV_MIN_HOLD (5 s) when the subject has been out of the shot for 0.6 s, a hard floor of 5 s between cuts, damped pans and slow zoom.
const cutLog = []; let lastCutTs = -1e9;
const TV_MIN_HOLD = 5.0; // look pass 3 v2: hard floor between live TV cuts (was 3.2 s); shots run 5-8 s
function shotTV(dt, now, fk = follow) {
  const ts = now / 1000;
  let sh = dir.shot;
  if (sh) {
    const S0 = subject(sh.k); const ahead = wrap(sh.st.s - S0.pr.s);
    const lost = sh.st.pos.distanceTo(S0.p) > 70 || (sh.st.type !== 'gantry' && ahead < -30) || (sh.st.type === 'gantry' && ahead < 1);
    sh.lostT = lost ? sh.lostT + dt : 0;
  }
  const held = sh ? ts - sh.t0 : 1e9;
  const want = !sh || held >= sh.dur || (held >= TV_MIN_HOLD && sh.lostT > 0.6);
  if (want && (view.mode !== 'live' || ts - lastCutTs >= TV_MIN_HOLD)) { const sub = directorSubject(fk); const n = cutTV(sub, ts); if (n) { sh = dir.shot = n; lastCutTs = ts; camSnap = true; cutLog.push(+ts.toFixed(2)); if (cutLog.length > 400) cutLog.shift(); } }
  if (!sh) return null;
  const u = Math.min(1, (ts - sh.t0) / sh.dur), st = sh.st, look = lookTarget(sh.k, sh.k2), dist = st.pos.distanceTo(look);
  let pos = st.pos.clone(), fov = 45;
  if (st.type === 'tele') { fov = THREE.MathUtils.clamp(700 / (dist + 4) * sh.zoom, (st.bonus || 0) >= 3 ? 16 : 12, 34); shotName = 'TV · TELE'; }
  else if (st.type === 'low') { fov = 50; shotName = 'TV · LOW'; }
  else if (st.type === 'jib') { const e = u * u * (3 - 2 * u); pos.y = P[st.i].y + 1.5 + e * 8; pos.addScaledVector(T[st.i], (e - 0.5) * 5); fov = 42 - e * 8; shotName = 'TV · JIB'; }
  else if (st.type === 'pan') { fov = THREE.MathUtils.clamp(500 / (dist + 6), (st.bonus || 0) >= 2 ? 34 : 24, 58); shotName = 'TV · PAN'; }
  else if (st.type === 'gantry') { fov = THREE.MathUtils.clamp(600 / (dist + 4), 16, 40); shotName = 'TV · GANTRY'; }
  else if (st.type === 'mast') { fov = THREE.MathUtils.clamp(900 / (dist + 8), 30, 70); shotName = 'TV · MAST CAM'; }
  else if (st.type === 'over') { pos.addScaledVector(T[st.i], (u - 0.5) * 4); fov = THREE.MathUtils.clamp(650 / (dist + 4), 26, 50); shotName = 'TV · OVERHEAD'; }
  if (st.piece) shotName += ' · ' + st.piece;
  return { pos, look, fov, kPos: st.type === 'jib' || st.type === 'over' ? 99 : 99, kLook: 3.2, kFov: 0.9 };
}
function shotBlimp(dt, now, fk = follow) {
  const f = BL.focus.clone(); if (fk >= 0) f.lerp(marbles[fk].mesh.position, 0.6);
  const wp = blimp ? gondolaMount.getWorldPosition(new THREE.Vector3()) : BL.pos.clone();
  const dist = wp.distanceTo(f), spread = packSpread(BL.focus);
  const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((spread + 8) / dist)), 40, 70);
  shotName = 'BLIMP · GONDOLA CAM';
  return { gondola: !!blimp, pos: wp, look: f, fov, kPos: 99, kLook: 2, kFov: 0.8 };
}
function shotChase(k) {
  const S0 = subject(k), d = new THREE.Vector3(S0.pr.tan.x, 0, S0.pr.tan.z).normalize(); shotName = 'CHASE · ' + S0.m.name.toUpperCase();
  return { pos: S0.p.clone().addScaledVector(d, -7.5).add(new THREE.Vector3(0, 3.6, 0)), look: S0.p.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 0.2, 0)), fov: 60, kPos: 6, kLook: 9.6 };
}
function shotFront(k) {
  const S0 = subject(k), d = new THREE.Vector3(S0.pr.tan.x, 0, S0.pr.tan.z).normalize(); shotName = 'FRONT · ' + S0.m.name.toUpperCase();
  return { pos: S0.p.clone().addScaledVector(d, 7).add(new THREE.Vector3(0, 1.8, 0)), look: S0.p.clone().addScaledVector(d, -2), fov: 60, kPos: 6, kLook: 9.6 };
}
function shotGrid() {
  const c = spawns.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(spawns.length);
  shotName = 'GRID';
  return { pos: c.clone().addScaledVector(NRM[FIN], -(HALFW + 9)).addScaledVector(T[FIN], 7).add(new THREE.Vector3(0, 3.5, 0)), look: c.clone().add(new THREE.Vector3(0, 0.3, 0)), fov: 42, kPos: 2, kLook: 3 };
}
function applyShot(s, dt) {
  if (!s) return;
  if (s.gondola) return gondolaCam(dt, s.look, s.fov);
  detachCam();
  const kp = camSnap || s.kPos >= 99 ? 1 : 1 - Math.exp(-dt * s.kPos);
  const kl = camSnap ? 1 : 1 - Math.exp(-dt * s.kLook);
  camPos.lerp(s.pos, kp); camLook.lerp(s.look, kl);
  camera.position.copy(camPos); camera.up.set(Math.sin(s.roll || 0), 1, 0).normalize(); camera.lookAt(camLook);
  const kf = camSnap ? 1 : Math.min(1, dt * (s.kFov ?? 4));
  if (Math.abs(camera.fov - s.fov) > 0.05) { camera.fov += (s.fov - camera.fov) * kf; camera.updateProjectionMatrix(); }
  camSnap = false;
  $('shotTag').textContent = shotName;
}
function liveCamera(dt, now) {
  const fk = follow >= 0 ? follow : standings()[0].k;
  if (race.phase === 'grid') return applyShot(camMode === 1 ? shotBlimp(dt, now) : shotGrid(), dt);
  const s = camMode === 0 ? shotTV(dt, now) : camMode === 1 ? shotBlimp(dt, now) : camMode === 2 ? shotChase(fk) : shotFront(fk);
  applyShot(s, dt);
}

// ---------- replay director ----------
const view = { mode: 'live', segs: [], si: 0, rt: 0, freeze: 0, podT: 0, results: false };
function wipe() { const w = $('wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); sfx.whoosh(); }
function flash() { const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60); }
function buildReplay() {
  const w = race.finishOrder[0] || standings()[0]; const tw = w.finished ? w.finishTime : race.t;
  const [a] = rec.range(); const segs = [];
  const kms = race.keyMoments.filter((x) => x.type === 'lead' && x.t < tw - 12 && x.t - 2 > a).slice(-2);
  for (const km of kms) segs.push({ t0: km.t - 2.5, t1: km.t + 1.5, speed: 0.5, cam: 'tvreplay', k: km.k, cap: `LEAD CHANGE · LAP ${km.lap} · ${marbles[km.k].name.toUpperCase()} TAKES P1${km.at ? ' AT THE ' + km.at : ''}` });
  for (const [pc, cam, cap, dur, sp] of [['CORKSCREW', 'tvreplay', 'THE CORKSCREW · LAST LAP', 3.5, 0.5], ['THE NARROW', 'chase', 'THREADING THE NARROW', 2.5, 0.6]]) {
    const ps = w.passes.filter((x) => x.piece === pc && x.t < tw - 4 && x.t > a + 0.5).pop();
    if (ps && !kms.some((km) => Math.abs(km.t - ps.t) < 4)) segs.push({ t0: ps.t, t1: Math.min(ps.t + dur, tw - 8.5), speed: sp, cam, k: w.k, cap });
  }
  segs.sort((x, y) => x.t0 - y.t0);
  segs.push({ t0: Math.max(a, tw - 8), t1: tw - 4, speed: 1, cam: 'blimp', k: w.k, cap: 'THE RUN TO THE FLAG' });
  segs.push({ t0: tw - 4, t1: tw - 1.5, speed: 0.5, cam: 'chase', k: w.k, cap: 'SLOW-MO' });
  segs.push({ t0: tw - 1.5, t1: tw - 0.6, speed: 0.35, cam: 'gantry', k: w.k, cap: 'HEAD ON' });
  segs.push({ t0: tw - 0.6, t1: tw, speed: 0.15, cam: 'photo', k: w.k, cap: 'PHOTO FINISH', freeze: 2.2 });
  segs.push({ t0: tw, t1: tw + 1.8, speed: 0.3, cam: 'orbit', k: w.k, cap: 'WINNER CAM' });
  return segs.filter((s) => s.t1 > s.t0);
}
function startReplay() {
  if (rec.n < 10) return showResults();
  view.mode = 'replay'; view.segs = buildReplay(); view.si = -1; nextSeg(); sfx.replaySting();
  $('rp').classList.remove('hidden'); $('hud').classList.add('hidden'); $('results').classList.add('hidden');
  banner('', 0); $('banner').classList.add('hidden');
}
function setNear(n) { if (Math.abs(camera.near - n) > 0.01) { camera.near = n; camera.updateProjectionMatrix(); } }
function nextSeg() {
  setNear(0.2);
  view.si++; const s = view.segs[view.si];
  if (!s) return startPodium();
  view.rt = s.t0; view.freeze = 0; wipe(); camSnap = true; dir.shot = null; dir.last = '';
  $('rpCap').textContent = s.cap; $('rpSpeed').textContent = s.speed < 1 ? `SLOW-MO ${s.speed}×` : '';
  rec.apply(view.rt); for (const m of marbles) { m.vhint = project(m.mesh.position, 0, true).i; }
}
function replayCamera(dt, now) {
  const s = view.segs[view.si]; if (!s) return;
  const sub = subject(s.k);
  let sh;
  if (s.cam === 'blimp') sh = shotBlimp(dt, now, s.k);
  else if (s.cam === 'chase') sh = shotChase(s.k);
  else if (s.cam === 'tvreplay') sh = shotTV(dt, now, s.k);
  else if (s.cam === 'gantry') { const st = stations[stations.length - 1]; const look = sub.p.clone(); sh = { pos: st.pos, look, fov: THREE.MathUtils.clamp(500 / (st.pos.distanceTo(look) + 4), 12, 40), kPos: 99, kLook: 10 }; shotName = 'REPLAY · GANTRY'; setNear(Math.min(2.5, Math.max(0.2, st.pos.distanceTo(look) - 2))); }
  else if (s.cam === 'photo') { const fp = P[FIN].clone().add(new THREE.Vector3(0, 0.5, 0)); const f0 = THREE.MathUtils.radToDeg(2 * Math.atan(4.4 / finCam.d)); sh = { pos: finCam.pos, look: fp, fov: f0 * (1 - 0.25 * ((view.rt - s.t0) / (s.t1 - s.t0))), kPos: 99, kLook: 99, kFov: 3 }; shotName = 'REPLAY · PHOTO CAM'; setNear(Math.max(0.2, finCam.d - 4.2)); } // near-plane cut: flags/legs between lens and line vanish
  else if (s.cam === 'orbit') { const u = (view.rt - s.t0) / (s.t1 - s.t0); const a = u * 2.6 + 0.5; const c = sub.p.clone(); sh = { pos: c.clone().add(new THREE.Vector3(Math.cos(a) * (5 - u * 2), 1.4 + u, Math.sin(a) * (5 - u * 2))), look: c, fov: 40, kPos: 99, kLook: 99 }; shotName = 'REPLAY · WINNER CAM'; }
  applyShot(sh, dt);
}
function photoFreeze() {
  const st = race.finishOrder.length ? race.finishOrder : standings();
  const a = st[0], b = st[1] || standings()[1];
  const margin = b && b.finished ? b.finishTime - a.finishTime : null;
  $('pmargin').textContent = `${a.name.toUpperCase()} by ${margin != null ? margin.toFixed(3) + 's' : 'a mile'}${b ? ' over ' + b.name : ''}`;
  const sp = P[FIN].clone().project(camera); $('photo').style.setProperty('--fx', ((sp.x + 1) / 2 * 100).toFixed(1) + '%');
  $('photo').classList.remove('hidden'); document.body.classList.add('photoMode'); flash(); sfx.beep(1800, 0.08, 0.15, 'square');
}
function startPodium() {
  setNear(0.2);
  view.mode = 'podium'; view.podT = 0; wipe();
  $('photo').classList.add('hidden'); document.body.classList.remove('photoMode');
  const st = race.finishOrder.length >= 3 ? race.finishOrder : standings();
  const top = st.slice(0, 3);
  for (const m of marbles) m.mesh.visible = top.includes(m);
  top.forEach((m, i) => { m.mesh.position.copy(podTops[i]); });
  top[0].mat.emissive.setRGB(0.35, 0.3, 0.2);
  podium.visible = true;
  const p = session.byMarble(top[0].k);
  $('winTitle').innerHTML = `🏆 ${top[0].name.toUpperCase()} WINS<small>${p ? p.name.toUpperCase() + ' TAKES THE OSAKA GP' : 'OSAKA GRAND PRIX'}</small>`; $('winTitle').classList.remove('hidden');
  $('rpCap').textContent = 'PODIUM'; $('rpSpeed').textContent = ''; $('rpBadge').classList.add('hidden');
  sfx.roar(0.2, 6); confetti(podTops[0].clone().add(new THREE.Vector3(0, 9, 0)), 400);
  view.podTop = top;
}
function podiumFrame(dt, now) {
  detachCam();
  view.podT += dt;
  const top = view.podTop;
  top.forEach((m, i) => { m.mesh.position.copy(podTops[i]); m.mesh.rotateY(dt * (i === 0 ? 2 : 1)); });
  top[0].mat.emissive.setScalar(0.25 + 0.15 * Math.sin(now * 0.006));
  beamMat.opacity = 0.13 + 0.05 * Math.sin(now * 0.004);
  if (Math.random() < dt * 2.2) firework(gantryTop(Math.random()).add(new THREE.Vector3(0, 4 + Math.random() * 6, 0)));
  if (Math.random() < dt * 1.5) confetti(podTops[0].clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 8, (Math.random() - 0.5) * 4)), 80);
  const a = view.podT * 0.35 + 1, c = podC.clone().add(new THREE.Vector3(0, 1.4, 0));
  applyShot({ pos: c.clone().add(new THREE.Vector3(Math.cos(a) * 11, 3.4 + Math.sin(view.podT * 0.5) * 0.8, Math.sin(a) * 11)), look: c, fov: 46 - Math.min(8, view.podT), kPos: 99, kLook: 99 }, dt);
  $('shotTag').textContent = 'PODIUM';
  if (view.podT > 9) endShow();
}
function endShow() {
  setNear(0.2);
  view.mode = 'live'; podium.visible = false; for (const m of marbles) { m.mesh.visible = true; m.mat.emissive.copy(m.baseEm); }
  $('rp').classList.add('hidden'); $('rpBadge').classList.remove('hidden'); $('winTitle').classList.add('hidden'); $('photo').classList.add('hidden'); document.body.classList.remove('photoMode');
  if (race.phase !== 'over') endRace(true);
  showResults();
}
$('skipBtn').onclick = (e) => { e.stopPropagation(); endShow(); };

// ---------- UI ----------
const sw = (k) => `background-image:url(./marbles/thumbs/${RACERS[k][0]}.jpg);background-size:cover`;
let pickCat = -1; // AD T-030: picker category tab (-1 = follow the editing player's marble)
function buildPicker() {
  const ps = session.players; editP = Math.min(editP, ps.length - 1);
  $('players').innerHTML = ps.map((p, i) => `<button class="pchip${i === editP ? ' on' : ''}" style="--pc:${p.color}" data-i="${i}"><span class="ball" style="${sw(p.k)}"></span>${p.name || 'P' + (i + 1)}</button>`).join('') + (ps.length < 4 ? `<button class="pchip add" data-add="1">+ Player</button>` : '');
  $('players').querySelectorAll('.pchip').forEach((b) => b.onclick = () => {
    if (b.dataset.add) { const used = ps.map((p) => p.k), cu = ps.map((p) => p.color); ps.push({ id: Date.now(), name: 'P' + (ps.length + 1), color: PCOLORS.find((c) => !cu.includes(c)), k: [...Array(NM).keys()].find((k) => !used.includes(k)) }); editP = ps.length - 1; }
    else editP = +b.dataset.i;
    pickCat = -1;
    session.save(); buildPicker();
  });
  const p = ps[editP];
  $('pname').value = p.name; $('pname').oninput = () => { p.name = $('pname').value.slice(0, 10) || 'P' + (editP + 1); session.save(); $('players').querySelectorAll('.pchip')[editP].lastChild.textContent = p.name; };
  $('pcolors').innerHTML = PCOLORS.map((c) => `<b style="background:${c}" class="${c === p.color ? 'on' : ''}" data-c="${c}"></b>`).join('');
  $('pcolors').querySelectorAll('b').forEach((b) => b.onclick = () => { p.color = b.dataset.c; session.save(); buildPicker(); });
  $('pdel').classList.toggle('hidden', ps.length < 2); $('pdel').onclick = () => { ps.splice(editP, 1); editP = 0; session.save(); buildPicker(); };
  $('pickHint').textContent = `Tap a marble for ${p.name}`;
  const cat = pickCat >= 0 ? pickCat : ROSTER[FIELD[p.k]][2];
  $('cats').innerHTML = CATS.map((c, i) => `<button class="${i === cat ? 'on' : ''}" data-c="${i}">${c}${i === 0 ? ' <i>NEW</i>' : ''}</button>`).join('');
  $('cats').querySelectorAll('button').forEach((b) => b.onclick = () => { pickCat = +b.dataset.c; buildPicker(); $('grid').scrollTop = 0; });
  const onTab = $('cats').querySelector('.on'); if (onTab && !buildPicker.keep) onTab.scrollIntoView({ block: 'nearest', inline: 'center' });
  $('grid').innerHTML = ROSTER.map(([f, n, c], r) => { if (c !== cat) return ''; const k = FIELD.indexOf(r), o = k >= 0 ? session.byMarble(k) : null; return `<button class="pick${o ? ' taken' : ''}${o === p ? ' on' : ''}" style="--pc:${o ? o.color : 'transparent'}" data-r="${r}"><img class="ball" loading="lazy" decoding="async" alt="" src="./marbles/thumbs/${f}.jpg"><span>${n}</span>${NEWM.has(f) && !o ? '<i class="tag new">NEW</i>' : ''}${o ? `<i class="tag" style="background:${o.color}">${o.name}</i>` : ''}</button>`; }).join('');
  $('grid').querySelectorAll('.pick').forEach((b) => b.onclick = () => { const r = +b.dataset.r, k = FIELD.indexOf(r); if (k >= 0) { const o = session.byMarble(k); if (o && o !== p) o.k = p.k; p.k = k; } else { FIELD[p.k] = r; skin(p.k); } localStorage.setItem('dh_osaka_field2', JSON.stringify(FIELD)); localStorage.setItem('dh_osaka_pick', p.k); session.save(); buildPicker(); });
}
function showScreen(id) { for (const s of ['loading', 'home', 'results']) $(s).classList.toggle('hidden', s !== id); $('hud').classList.toggle('hidden', id !== null); }
function renderCamBtns() {
  $('cams').innerHTML = CAMS.map((c, i) => `<button class="${i === camMode ? 'on' : ''}" data-i="${i}">${c}</button>`).join('');
  $('cams').querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); setCam(+b.dataset.i); });
  $('follow').innerHTML = session.players.map((p) => `<button class="${follow === p.k ? 'on' : ''}" style="--pc:${p.color}" data-k="${p.k}">${p.name}</button>`).join('') + `<button class="${follow === -1 ? 'on' : ''}" data-k="-1">🏁 Race</button>`;
  $('follow').querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); follow = +b.dataset.k; dir.shot = null; camSnap = true; renderCamBtns(); });
}
const fmt = (t) => t.toFixed(2);
let lastBoard = 0, boardFull = innerHeight > innerWidth * 1.2 ? false : true;
function renderBoard() {
  const st = standings(), lead = st[0], now = performance.now();
  const bt = race.battle;
  $('board').innerHTML = st.map((m, i) => {
    const p = session.byMarble(m.k);
    if (!boardFull && i >= 6 && !p && m.k !== follow) return '';
    let g = '';
    if (m.finished) g = i === 0 ? fmt(m.finishTime) : '+' + fmt(m.finishTime - lead.finishTime);
    else if (i === 0) g = race.phase === 'grid' ? '' : 'LEADER';
    else { const laps = Math.floor((lead.prog - m.prog) / L); g = laps >= 1 ? `+${laps} LAP` : '+' + gapSec(lead, m).toFixed(1); }
    const ar = m.arrowUntil > now ? (m.arrow > 0 ? '<span class="ar up">▲</span>' : '<span class="ar dn">▼</span>') : '<span class="ar"></span>';
    const inBatt = bt && (bt.a === m.k || bt.b === m.k);
    return `<div class="row${p ? ' pl' : ''}${m.k === follow ? ' cam' : ''}${inBatt ? ' batt' : ''}" style="${p ? '--pc:' + p.color : ''}" data-k="${m.k}"><span class="n">${i + 1}</span>${ar}<span class="c" style="${sw(m.k)}"></span><span class="nm">${m.name}</span>${p ? `<span class="pt">${p.name}</span>` : ''}${race.fastest?.k === m.k ? '<span class="fl"></span>' : ''}<span class="g">${g}</span></div>`;
  }).join('');
  const lp = Math.min(LAPS, Math.max(1, Math.floor(lead.prog / L) + 1));
  $('lap').textContent = race.phase === 'grid' ? `LAPS ${LAPS}` : `LAP ${lp}/${LAPS}`;
}
$('board').addEventListener('pointerdown', (e) => { const r = e.target.closest('.row'); if (r) { if (+r.dataset.k === follow) boardFull = !boardFull; follow = +r.dataset.k; dir.shot = null; renderBoard(); renderCamBtns(); e.stopPropagation(); } });
$('muteBtn').onclick = (e) => { e.stopPropagation(); $('muteBtn').textContent = sfx.toggle() ? '🔊' : '🔇'; };
$('muteBtn').textContent = sfx.on ? '🔊' : '🔇';
document.addEventListener('click', (e) => { if (e.target.closest('button') && e.target.id !== 'muteBtn') sfx.ui(); }, true); // AD T-027: UI clicks
let sx = 0, sy = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (view.mode === 'live' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) setCam(camMode + (dx < 0 ? 1 : -1)); });
addEventListener('keydown', (e) => { if (e.key === 'c') setCam(camMode + 1); if (e.key === 'Escape' && view.mode !== 'live') endShow(); });

function banner(text, ms, cls = '') { const b = $('banner'); b.className = cls; b.textContent = text; if (!text) return b.classList.add('hidden'); clearTimeout(banner.t); if (ms) banner.t = setTimeout(() => b.classList.add('hidden'), ms); }
function startRace() {
  sfx.init(); buildTags();
  follow = session.players[0]?.k ?? 0; camMode = 2; resetRace(); showScreen(null); renderCamBtns(); camSnap = true; view.mode = 'live'; view.results = false;
  const lights = $('lights'); lights.className = ''; const spans = lights.querySelectorAll('span'); spans.forEach((s) => s.className = '');
  let n = 0;
  const tick = setInterval(() => {
    if (n < 5) { spans[n].className = 'on'; n++; sfx.light(n); return; }
    clearInterval(tick);
    setTimeout(() => { lights.className = 'go'; race.phase = 'race'; race.t = 0; banner('GO!', 900); sfx.go(); sfx.roar(0.12, 3); setTimeout(() => lights.classList.add('hidden'), 900); }, 300 + Math.random() * 500);
  }, 600);
}
function onWinner(m) {
  const p = session.byMarble(m.k); banner(`${m.name}${p ? ' · ' + p.name : ''} WINS!`, 2500);
  sfx.finish(); sfx.roar(0.22, 4); for (let i = 0; i < 4; i++) setTimeout(() => firework(gantryTop(i / 3).add(new THREE.Vector3(0, 3 + Math.random() * 4, 0))), i * 220);
  confetti(gantryTop(0.5), 300);
  if (CFG.replay) setTimeout(() => { if (view.mode === 'live' && (race.phase === 'done' || race.phase === 'over')) startReplay(); }, 2300);
}
function endRace(silent) {
  race.phase = 'over';
  const st = standings(); const w = st[0]; const wp = session.byMarble(w.k);
  const best = session.players.map((p) => ({ p, pos: st.findIndex((m) => m.k === p.k) + 1 })).sort((a, b) => a.pos - b.pos);
  $('resTitle').innerHTML = `🏆 ${w.name}${wp ? ' · ' + wp.name : ''} wins` + (session.players.length > 1 || !wp ? `<div class="note" style="opacity:.85;font-size:13px">${best.map((b) => `${b.p.name} P${b.pos}`).join(' · ')}</div>` : '');
  $('resList').innerHTML = st.map((m, i) => {
    const bestLap = m.lapTimes.length ? Math.min(...m.lapTimes) : 0; const p = session.byMarble(m.k);
    const t = m.finished ? (i === 0 ? fmt(m.finishTime) + 's' : '+' + fmt(m.finishTime - st[0].finishTime)) : 'DNF';
    return `<div class="row${p ? ' me' : ''}"><span class="n">${i + 1}</span><span class="c" style="${sw(m.k)}"></span>${m.name}${p ? ` <b style="color:${p.color}">&nbsp;${p.name}</b>` : ''}<span class="g">${t}${bestLap ? ' · best ' + fmt(bestLap) : ''}${race.fastest?.k === m.k ? ' ⏱' : ''}</span></div>`;
  }).join('');
  if (!silent && view.mode === 'live' && !CFG.replay) showResults();
}
function showResults() { view.results = true; showScreen('results'); }
$('startBtn').onclick = startRace;
$('againBtn').onclick = startRace;
$('replayBtn').onclick = () => startReplay();
$('pickBtn').onclick = () => { race.phase = 'idle'; buildPicker(); showScreen('home'); };

// ---------- main loop ----------
resetRace(); race.phase = 'idle';
let acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 60, lowStreak = 0, lastDrama = 0;
let clankT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  acc += dt * PHYS.ts; let n = 0;
  while (acc >= DT && n < 60) { physicsStep(); acc -= DT; n++; }
  if (n === 60) acc = 0;
  if (view.mode === 'replay') {
    const s = view.segs[view.si];
    if (s) {
      if (view.rt >= s.t1 && s.freeze) { if (view.freeze === 0) photoFreeze(); view.freeze += dt; if (view.freeze > s.freeze) { $('photo').classList.add('hidden'); document.body.classList.remove('photoMode'); nextSeg(); } }
      else { view.rt = Math.min(s.t1, view.rt + dt * s.speed); rec.apply(view.rt); if (view.rt >= s.t1 && !s.freeze) nextSeg(); }
    }
  } else if (view.mode === 'live') {
    for (const m of marbles) { const t = m.body.translation(), r = m.body.rotation(); m.mesh.position.set(t.x, t.y, t.z); m.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
  }
  if (view.mode !== 'podium') for (const m of marbles) { m.vpr = project(m.mesh.position, m.vhint); m.vhint = m.vpr.i; }
  // blimp: live = follows the pack; replay = recorded path
  if (view.mode === 'live') {
    const racing = race.phase === 'race' || race.phase === 'done' || race.phase === 'grid';
    if (racing) { const f = packFocus(); BL.focus.lerp(f, 1 - Math.exp(-dt * 1.5)); const ld = standings()[0]; updateBlimp(dt, now, BL.focus, ld.vpr ? ld.vpr.tan : T[FIN]); }
    else { const a = now * 0.00004; updateBlimp(dt, now, center.clone().add(new THREE.Vector3(Math.cos(a) * trackRad * 0.6, 0, Math.sin(a) * trackRad * 0.6)), new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))); BL.focus.lerp(center, 0.02); }
  } else if (view.mode === 'replay') { BL.pos.copy(blimp ? blimp.position : BL.pos); const f = packFocus(); BL.focus.lerp(f, 1 - Math.exp(-dt * 2)); }
  for (const t of tags) { const m = marbles[t.p.k]; t.sp.position.copy(m.mesh.position).y += 1.15; t.sp.visible = race.phase !== 'idle' && m.mesh.visible && view.mode !== 'podium' || (view.mode === 'podium' && m.mesh.visible); }
  updateParticles(dt);
  if (liftMech) liftMech.draw(view.mode === 'replay' ? view.rt * 1 : simT);
  if (view.mode === 'live' && (race.phase === 'race' || race.phase === 'done')) { // chain clank: louder with more marbles on the lift and when the camera is near it
    clankT -= dt; const onLift = marbles.filter((m) => m.onLift).length;
    if (onLift && clankT <= 0) { clankT = PHYS.pitch / PHYS.liftV; const near = marbles.some((m) => m.onLift && m.mesh.position.distanceTo(camera.position) < 40); sfx.clank((near ? 0.09 : 0.03) * Math.min(1, 0.4 + onLift * 0.15)); }
  }
  if (race.phase === 'idle' && view.mode === 'live') { detachCam(); const a = now * 0.00008; camera.position.set(center.x + Math.cos(a) * trackRad * 1.3, center.y + 36, center.z + Math.sin(a) * trackRad * 1.3); camera.up.set(0, 1, 0); camera.lookAt(center); }
  else if (view.mode === 'live') liveCamera(dt, now);
  else if (view.mode === 'replay') replayCamera(dt, now);
  else if (view.mode === 'podium') podiumFrame(dt, now);
  if (view.mode === 'live' && race.phase !== 'idle') {
    if (race.phase === 'race' || race.phase === 'done') $('clock').textContent = fmt(race.t);
    if (now - lastDrama > 250) { dramaTick(); renderBoard(); lastDrama = now; }
  }
  if (window.__free) { detachCam(); const f = window.__free; camera.position.set(...f.pos); camera.up.set(0, 1, 0); camera.lookAt(new THREE.Vector3(...f.look)); if (camera.fov !== f.fov) { camera.fov = f.fov; camera.updateProjectionMatrix(); } }
  if (window.__camLog) { const w = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3()); window.__camLog.push([+(now / 1000).toFixed(3), w.x, w.y, w.z, d.x, d.y, d.z, camera.fov]); }
  adSumoTick(); // AD T-030b: mini rikishi stay upright
  sfx.update(dt, camera, marbles, view.mode); // AD T-027: roll loop, clicks, rail hits, fling whoosh, listener = camera
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 1) {
    fps = frames / fpsT; frames = 0; fpsT = 0; $('fps').textContent = `${Math.round(fps)} fps · ${renderer.getPixelRatio().toFixed(2)}x`;
    if (fps < 45 && race.phase !== 'idle') { if (++lowStreak >= 2 && pixelCap > 0.75) { pixelCap = Math.max(0.75, renderer.getPixelRatio() - 0.25); renderer.setPixelRatio(pixelCap); lowStreak = 0; } } else lowStreak = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setBar(1, 'Ready');
buildPicker(); showScreen('home');

// test hooks
window.__dh = {
  marbles, race, view, skin, FIELD, ROSTER, session, contract, stations, L, N, FIN, triCount,
  start: () => { startRace(); },
  go: () => { race.phase = 'race'; race.t = 0; $('lights').classList.add('hidden'); },
  steps: (n) => { for (let i = 0; i < n; i++) physicsStep(); },
  audio: () => ({ on: sfx.on, state: sfx.state, loaded: sfx.loaded }),
  stats: () => ({ phase: race.phase, view: view.mode, seg: view.si, t: +race.t.toFixed(2), L: +L.toFixed(1), src: contract.src, stations: stations.length, rec: rec.n, fps: Math.round(fps), shot: shotName, blimp: BL.pos.toArray().map((x) => +x.toFixed(1)), order: standings().map((m) => ({ n: m.name, laps: +(m.prog / L).toFixed(2), fin: m.finished ? +m.finishTime.toFixed(2) : null, falls: m.falls })) }),
  setCam, setFollow: (k) => { follow = k; dir.shot = null; renderCamBtns(); }, replay: startReplay, endShow,
  camParent: () => camera.parent?.name || null, gondolaWorld: () => gondolaMount.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)), blimpWorld: () => (blimp ? blimp.position.toArray().map((x) => +x.toFixed(2)) : null), liftInfo: () => liftMech && { nP: liftMech.nP, uA: +liftMech.uA.toFixed(1), uB: +liftMech.uB.toFixed(1) }, bump: () => race.bump,
  prof: (sv) => { const { p, i } = pointAtS(sv); const o = []; for (let l = -HW[i] - 0.6; l <= HW[i] + 0.61; l += 0.4) { const q = p.clone().addScaledVector(NRM[i], l); o.push([+l.toFixed(1), deckY(q) == null ? null : +(deckY(q) - p.y).toFixed(2)]); } return { hw: HW[i], py: +p.y.toFixed(2), o }; },
  objs: (re) => { const o = []; world3d.traverse((x) => { if (new RegExp(re).test(x.name)) o.push([x.name, x.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1))]); }); return o; },
  info: () => ({ ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
  pieceOf: (k) => pieceAt(marbles[k].pr?.s ?? 0), PIECES, PHYS,
  cutLog: () => cutLog.slice(), forceTV: (piece, k) => { const m = marbles[k]; const c = stations.filter((st) => st.piece === piece).sort((x, y) => Math.abs(wrap(x.s - m.pr.s) - 4) - Math.abs(wrap(y.s - m.pr.s) - 4))[0]; if (!c) return null; camMode = 0; follow = k; dir.shot = { st: c, t0: performance.now() / 1000, dur: 1e9, k, k2: -1, zoom: 1, lostT: 0 }; lastCutTs = performance.now() / 1000; camSnap = true; return c.type; },
  stationList: () => stations.map((st) => [st.type, st.piece, st.pos.toArray().map((x) => +x.toFixed(1))]),
  setPlayers: (ps) => { session.players = ps; session.save(); buildPicker(); },
};
if (Q.get('auto')) startRace();
