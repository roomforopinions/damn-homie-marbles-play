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
import { initTown } from './ad_town.js'; // AD critic pass 1 (11-14): living town, water shader, crowd loops, tram, drones (see ad_town.js)

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
  ['sumo_gyoji_kurenai', 'Gyoji Kurenai', 0], ['sumo_gyoji_midori', 'Gyoji Midori', 0], ['sumo_kesho', 'Kesho-mawashi', 0], ['sumo_mini_dohyoiri', 'Mini Dohyo-iri', 0],
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
const adTown = initTown({ THREE, scene, world3d, isMobile }); // AD critic pass 1: vignettes, crowd loops, water, koi + canal fish, tram, drones

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
const PHYS = { g: +(Q.get('g') || 613), drag: +(Q.get('drag') || 0.006), dragVar: 0.3, liftV: +(Q.get('lift') || 16), railF: +(Q.get('railf') ?? 0.04), liftLead: 9, flick: +(Q.get('flick') || 2.6), flZone: 3.0, flUp: +(Q.get('flup') ?? 0.35), minV: +(Q.get('minv') ?? 0), assist: 60, ts: +(Q.get('ts') || 1), pitch: 3.2 };
if (X.dh_lift_lead != null) PHYS.liftLead = +X.dh_lift_lead; // Claude T-031: the track says where its paddles start rising
const world = new RAPIER.World({ x: 0, y: -PHYS.g, z: 0 });
world.timestep = DT;
world.integrationParameters.numSolverIterations = 4;
const CMIN = RAPIER.CoefficientCombineRule ? RAPIER.CoefficientCombineRule.Min : null;
let triCount = 0;
const SMOOTH = Q.get('smooth') !== '0'; // v4: physics floor rebuilt smooth from the centerline (see SMOOTH COLLISION FLOOR); ?smooth=0 = raw glb trimesh
const COLLIDE = ['TRACK_floor', 'TRACK_rail_inner_cyan', 'TRACK_rail_outer_pink']; world3d.traverse((o) => { if (/^TRACK_collide_/.test(o.name) && !COLLIDE.includes(o.name)) COLLIDE.push(o.name); }); // Claude T-032: set-piece colliders (pins, deflectors, walls)
for (const nm of COLLIDE) {
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
    const solid = /^TRACK_collide_pin/.test(nm); // Claude T-032: pins/bumpers are solid convex bodies (a fast marble can't tunnel into a thin shell)
    const desc = solid ? RAPIER.ColliderDesc.convexHull(v) : flags !== undefined ? RAPIER.ColliderDesc.trimesh(v, idx, flags) : RAPIER.ColliderDesc.trimesh(v, idx);
    const isFloor = nm === 'TRACK_floor';
    desc.setFriction(isFloor ? 0.7 : PHYS.railF).setRestitution(isFloor ? 0.08 : 0.4); if (isFloor && CMIN != null) desc.setRestitutionCombineRule(CMIN); if (!isFloor && CMIN != null) desc.setFrictionCombineRule(CMIN); // v4: rails were averaging to mu 0.27 with the marble and braking every marble that touched them // glass on plastic deck: dead; rails: a real rattle
    world.createCollider(desc);
  }
}
const NM = Math.min(RACERS.length, Math.max(1, spawns.length));
const sphereGeo = new THREE.SphereGeometry(R, 32, 20);
// ---------- AD T-030b SUMO v2 (Grok Bot / Art Director, 11-14): own block, called from skin() + one line in the render loop ----------
// Sumo marbles carry a tangent normal map (_n) and an ORM map (_orm: G = roughness, B = metalness) next to the albedo, plus silk sheen.
// The two "Mini" marbles are a clear glass shell with a small stylised rikishi inside (marbles/sumo_rikishi.glb, v5 T-030e: voxel-sculpted,
// feet, thumbs, full belt + tate-mitsu, baked AO/SSS vertex colours, 130 KB, KHR_mesh_quantization, no Draco/meshopt: the vendor folder has no decoders). The figure is a child of the ball and is counter-rotated every frame so it stays upright and turns to face the camera.
const SUMO2 = {
  sumo_gunbai: { glass: 'rikishi_gunbai', sc: 0.5, center: 1 }, // T-030g: a real 3D gunbai (Jarod ref j1/j2: butterfly blade, spine, sun/moon, 天下泰平, gold rim, cord + tassel) floating in clear glass
  sumo_mawashi_kuro: { sheen: 0x2c2c38, sheenR: 0.35, env: 0.9 }, sumo_mawashi_murasaki: { sheen: 0x9a70c0, sheenR: 0.35 },
  sumo_mawashi_kin: { sheen: 0xffd890, sheenR: 0.3, env: 1.3 },
  sumo_gyoji_kurenai: { sheen: 0x7a2418, sheenR: 0.5, coat: 0 }, sumo_gyoji_midori: { sheen: 0x1f5a3a, sheenR: 0.5, coat: 0 }, // T-030g r2: flat woven crests + cream sash + fluffy kikutoji (j3/j4); no clear-coat (it made the crests read as enamel badges)
  sumo_yokozuna: { sheen: 0x9a78c8, sheenR: 0.45 }, sumo_kesho: { sheen: 0x9a78c8, sheenR: 0.45 },
  sumo_mini_shiko: { glass: 'rikishi_shiko', sc: 0.385 }, sumo_mini_dohyoiri: { glass: 'rikishi_dohyoiri', sc: 0.385 }, // T-030g: rebuilt to j6-j8 proportions, fitted inside r 0.465
};
const adSumoTex = {}, adSumoT = (f) => adSumoTex[f] || (adSumoTex[f] = (() => { const t = texLoader.load(`./marbles/${f}.jpg`); t.anisotropy = 4; return t; })());
let adSumoFigs = null; // Promise -> { name: Object3D }
const SUMO2_CENTER = new Set(Object.values(SUMO2).filter((L) => L.center).map((L) => L.glass)); // T-030g
function adSumoFig(name, sc) {
  adSumoFigs ??= new Promise((ok) => new GLTFLoader().load('./marbles/sumo_rikishi.glb', (g) => { const o = {}; g.scene.traverse((n) => { if (n.name.startsWith('rikishi_')) o[n.name] = n; if (n.material && n.material.name === 'dh_skin') { n.material.color.setHex(0xb4704f); n.material.roughness = 0.48; /* T-030g r3: warm tan skin (j7 chest/cheek), soft sheen from the glb */ } if (n.material && n.material.name === 'dh_paper') n.material.side = THREE.DoubleSide; }); ok(o); }, undefined, () => ok({})));
  const holder = new THREE.Group(); holder.name = 'AD_sumo_fig';
  adSumoFigs.then((o) => {
    if (!o[name]) return;
    const cen = SUMO2_CENTER.has(name); // T-030g: the gunbai floats centred (no floor disc)
    const w = new THREE.Group(), c = o[name].clone(); w.add(c); w.scale.setScalar(sc); w.position.y = cen ? 0 : -0.33 * (R / 0.5); holder.add(w);
    w.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(c), ctr = bb.getCenter(new THREE.Vector3()).divideScalar(sc);
    c.position.x -= ctr.x; c.position.z -= ctr.z; c.position.y -= cen ? ctr.y : (bb.min.y - w.position.y) / sc;
    holder.scale.setScalar(R / 0.5);
  });
  return holder;
}
function adSumoSkin(m, file) {
  const L = SUMO2[file], t = m.mat;
  if (m.adFig) m.adFig.visible = !!(L && L.glass && m.adFigName === L.glass);
  if (m.adRim) m.adRim.visible = !!(L && L.glass);
  if (!L) {
    if (m.adSumo) { t.normalMap = t.roughnessMap = t.metalnessMap = t.clearcoatRoughnessMap = null; t.sheen = 0; t.transparent = false; t.opacity = 1; t.depthWrite = true; t.color.set(0xffffff); m.adSumo = 0; t.needsUpdate = true; }
    return;
  }
  m.adSumo = 1;
  if (L.glass) {
    t.normalMap = t.roughnessMap = t.metalnessMap = t.clearcoatRoughnessMap = null; t.sheen = 0;
    t.map = null; t.color.set(0xcfe9f7); t.transparent = true; t.opacity = 0.1; t.depthWrite = false; t.roughness = 0.02; t.metalness = 0; t.clearcoat = 1; t.clearcoatRoughness = 0.0; t.envMapIntensity = 2.4; t.specularIntensity = 1;
    if (!m.adRim) { m.adRim = new THREE.Mesh(sphereGeo, adRimMat); m.adRim.scale.setScalar(1.003); m.adRim.renderOrder = 3; m.mesh.add(m.adRim); }
    m.adRim.visible = true;
    if (!m.adFig || m.adFigName !== L.glass) { if (m.adFig) m.mesh.remove(m.adFig); m.adFig = adSumoFig(L.glass, L.sc); m.adFigName = L.glass; m.mesh.add(m.adFig); }
    m.adFig.visible = true;
  } else {
    t.transparent = false; t.opacity = 1; t.depthWrite = true; t.color.set(0xffffff);
    t.normalMap = adSumoT(file + '_n'); t.normalScale.set(1, 1); t.roughnessMap = t.metalnessMap = adSumoT(file + '_orm'); t.roughness = 1; t.metalness = 1;
    t.clearcoat = L.coat ?? 0; t.clearcoatRoughnessMap = L.ccMap ? t.roughnessMap : null; t.clearcoatRoughness = L.ccMap ? 1 : 0.06; t.envMapIntensity = L.env ?? 1.1;
    t.sheen = L.sheen ? 1 : 0; t.sheenRoughness = L.sheenR ?? 0.4; t.sheenColor.set(L.sheen || 0);
  }
  t.needsUpdate = true;
}
const adRimMat = new THREE.ShaderMaterial({ // glass read: crisp fresnel rim + a fixed specular glint, additive, no milk
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { rim: { value: new THREE.Color(0xbfe6ff) } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 rim; varying vec3 vN; varying vec3 vV; void main(){ vec3 n = normalize(vN), v = normalize(vV); float ndv = clamp(dot(n, v), 0.0, 1.0); float fr = pow(1.0 - ndv, 3.0); vec3 h1 = normalize(vec3(-0.62, 0.62, 0.48)), h2 = normalize(normalize(vec3(0.6, -0.2, 0.75)) + v); float sp = pow(max(dot(n, h1), 0.0), 900.0) * 1.6 + pow(max(dot(n, h2), 0.0), 60.0) * 0.18; gl_FragColor = vec4(rim * (fr * 0.85 + 0.015) + vec3(sp), 1.0); }',
});
function adFieldDedupe() { // never two of the same marble on the grid (players keep theirs, a CPU duplicate gets an unused design)
  const own = new Set(session.players.map((p) => p.k)), seen = new Set(), used = new Set(FIELD.slice(0, NM));
  const order = [...Array(NM).keys()].sort((a, b) => own.has(b) - own.has(a));
  for (const k of order) { if (seen.has(FIELD[k])) { const r = [...ROSTER.keys()].find((x) => !used.has(x)); FIELD[k] = r; used.add(r); } seen.add(FIELD[k]); }
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
  const want = (typeof adBlimpWant === 'function' && adBlimpWant(focus)) || focus.clone().addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), 10).add(new THREE.Vector3(0, BL.H, 0)); // AD TV r4 hook: high hover (block at the end) // v4: rides just ahead of the pack, low enough to be in the chase shot
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
    adFieldDedupe(); // AD T-030b guard
    marbles.forEach((_, k) => skin(k));
  }
  const slots = [...Array(NM).keys()].sort(() => rnd() - 0.5);
  marbles.forEach((m, k) => {
    const sp = spawns[slots[k] % spawns.length];
    m.body.setTranslation({ x: sp.x, y: sp.y + 0.02, z: sp.z }, true);
    m.body.setLinvel({ x: 0, y: 0, z: 0 }, true); m.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    m.hint = project(sp, FIN, true).i;
    const pr = project(sp, m.hint); m.prog = wrap(pr.s - SFIN); m.lastS = pr.s; m.pr = pr;
    m.drag = PHYS.drag * (1 - PHYS.dragVar + 2 * PHYS.dragVar * rnd()); m.body.setLinearDamping(m.drag); m.slowed = false; // per-marble rolling drag = the "form" that spreads the field
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
      if (m.finished && !m.slowed) { m.slowed = true; m.body.setLinearDamping(0.6); } // Claude T-031: finished marbles coast down smoothly (the old per-step x/z brake fought the lift paddles and flung them off the crest)
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
const PIECES = X.dh_pieces ? JSON.parse(X.dh_pieces) : rawPts.length === 383 ? [ // Claude T-032: named set pieces come from the glb (dh_pieces) when present
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
  // Claude T-031: lanes under the rails (|lat| > HW) miss the deck mesh; extend the deck plane out to them instead of dropping
  // them 0.5 u (that made a gutter along both rails where the rising lift paddles pinched marbles against the rail: 100-480 u/s kicks)
  for (let a = 0; a < nS; a++) { const r = H[a], o = ok[a]; for (const [e, i1, i2] of [[0, 1, 2], [nX - 1, nX - 2, nX - 3]]) if (!o[e] && o[i1] && o[i2]) { r[e] = 2 * r[i1] - r[i2]; o[e] = true; } }
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
  const uA = LIFT.s0 - PHYS.liftLead, uB = LIFT.s1, Lf = uB - uA, RISE = +(Q.get('rise') || 1.0), DEPTH = 1.4, FL = PHYS.flZone, FK = PHYS.flick, LfP = Lf - FL + FL / FK;
  const nP = Math.max(4, Math.floor((LfP + Lf + 2 * DEPTH) / PHYS.pitch)), loop = nP * PHYS.pitch;
  // sample deck frame along the lift every 0.25 u
  const fr = []; for (let u = uA - 1; u <= uB + 1.01; u += 0.25) { const { p, i } = pointAtS(u); const y = deckY(p); const w = HW[i] * 0.8, a = p.clone().addScaledVector(NRM[i], w), b = p.clone().addScaledVector(NRM[i], -w); const ya = deckY(a), yb = deckY(b); const x = ya != null && yb != null ? a.setY(ya).sub(b.setY(yb)).normalize() : NRM[i].clone(); fr.push({ u, p: new THREE.Vector3(p.x, y ?? p.y - 0.5, p.z), i, x }); } // Claude T-031: x axis = the deck's real cross-slope
  const at = (u) => { const k = THREE.MathUtils.clamp((u - (uA - 1)) / 0.25, 0, fr.length - 1.001); const k0 = Math.floor(k), f = k - k0; const a = fr[k0], b = fr[k0 + 1]; return { p: a.p.clone().lerp(b.p, f), i: a.i, t: a.t.clone().lerp(b.t, f).normalize(), x: a.x.clone().lerp(b.x, f).normalize() }; };
  for (let k = 0; k < fr.length; k++) { const a = fr[Math.max(0, k - 3)], b = fr[Math.min(fr.length - 1, k + 3)]; fr[k].t = b.p.clone().sub(a.p).normalize(); } // Claude T-031: tangent smoothed over 1.5 u and interpolated, so a paddle never snaps 5-25 degrees in one step at the lift foot/top (its 3.3 u ends were whipping marbles at 100-600 u/s)
  const hwMin = (() => { let m = 99; for (const f of fr) m = Math.min(m, HW[f.i]); return m; })();
  const half = { x: hwMin - 0.2, y: 0.42, z: 0.12 };
  const ease = (x) => x * x * (3 - 2 * x);
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _qq = new THREE.Quaternion();
  function pose(ph, out) { // ph in [0, loop): forward run on top, then the return run below the deck
    let u, h, z; out.ghost = false;
    if (ph < Lf - FL) { u = uA + ph; z = 1; h = ease(Math.min(1, (u - uA) / RISE)); }
    else if (ph < LfP) { const x = (ph - (Lf - FL)) / (FL / FK); u = uB - FL + x * FL; z = 1; // FLING: the paddle whips forward at FK x belt speed and flips up, tossing the marble over the crest
      h = x < 0.55 ? 1 + PHYS.flUp * Math.sin(Math.PI * x / 0.55) : ease(Math.max(0, 1 - (x - 0.55) / 0.45)); out.ghost = x >= 0.55; }
    else { u = uB - (ph - LfP) * (Lf / (loop - LfP)); z = -1; h = 0; out.ghost = true; }
    const f = at(u); _z.copy(f.t); _x.copy(f.x).addScaledVector(_z, -f.x.dot(_z)).normalize(); _y.crossVectors(_z, _x).normalize(); if (_y.y < 0) { _y.negate(); _x.negate(); }
    const lift = z > 0 ? -DEPTH + h * (DEPTH + half.y - 0.02) : -DEPTH; // continuous all the way round: no kinematic teleports
    out.pos.copy(f.p).addScaledVector(_y, lift); _m.makeBasis(_x, _y, _z); out.q.setFromRotationMatrix(_m); out.up = h; return out;
  }
  const blackM = new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.55, metalness: 0.2 }), redM = new THREE.MeshStandardMaterial({ color: 0xd7192d, roughness: 0.4, emissive: 0x3a0006 });
  const steelM = new THREE.MeshStandardMaterial({ color: 0x8d8a96, roughness: 0.35, metalness: 0.7 });
  const padGeo = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), capGeo = new THREE.BoxGeometry(half.x * 2, 0.08, half.z * 2 + 0.06);
  const pads = [];
  for (let k = 0; k < nP; k++) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const col = world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setFriction(0.3).setRestitution(0.05), body);
    const g = new THREE.Group(); const box = new THREE.Mesh(padGeo, blackM); const cap = new THREE.Mesh(capGeo, redM); cap.position.y = half.y; g.add(box, cap); scene.add(g);
    pads.push({ body, g, col, ghost: false, o: { pos: new THREE.Vector3(), q: new THREE.Quaternion() } });
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
      for (let k = 0; k < nP; k++) { const o = pose((((t * PHYS.liftV + k * PHYS.pitch) % loop) + loop) % loop, pads[k].o); pads[k].body.setNextKinematicTranslation(o.pos); pads[k].body.setNextKinematicRotation(o.q);
        if (pads[k].ghost !== o.ghost) { pads[k].col.setSensor(o.ghost); pads[k].ghost = o.ghost; } } // Claude T-031: after the toss the sinking paddle is a ghost, so it can't pinch a marble against the crest deck (200-300 u/s kicks)
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
  if (typeof TV5 !== 'undefined' && TV5.on && view.mode === 'live') return tv5Shot(dt, now, fk); // AD TV cam v5 hook (block at the end of the file)
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
  if (typeof adBlimpShot === 'function') return adBlimpShot(dt, now, fk); // AD TV r4: one long-lens blimp shot for the Blimp button, the TV director and the replay
  const f = BL.focus.clone(); if (fk >= 0) f.lerp(marbles[fk].mesh.position, 0.6);
  const wp = blimp ? gondolaMount.getWorldPosition(new THREE.Vector3()) : BL.pos.clone();
  const dist = wp.distanceTo(f), spread = packSpread(BL.focus);
  const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((spread + 8) / dist)), 40, 70);
  shotName = 'BLIMP · GONDOLA CAM';
  return { gondola: !!blimp, pos: wp, look: f, fov, kPos: 99, kLook: 2, kFov: 0.8 };
}
function shotChase(k) {
  if (typeof tv6Close === 'function' && TV6.on) return tv6Close(k, 'chase'); // AD TV r6 hook (block at the end)
  const S0 = subject(k), d = new THREE.Vector3(S0.pr.tan.x, 0, S0.pr.tan.z).normalize(); shotName = 'CHASE · ' + S0.m.name.toUpperCase();
  return { pos: S0.p.clone().addScaledVector(d, -7.5).add(new THREE.Vector3(0, 3.6, 0)), look: S0.p.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 0.2, 0)), fov: 60, kPos: 6, kLook: 9.6 };
}
function shotFront(k) {
  if (typeof tv6Close === 'function' && TV6.on) return tv6Close(k, 'front'); // AD TV r6 hook
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
  if (typeof tv6Watch === 'function') tv6Watch(); // AD TV r6 hook: follow retargets every camera
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
  view.mode = 'replay'; view.segs = typeof adCelebrateSegs === 'function' ? adCelebrateSegs(buildReplay()) : buildReplay(); /* AD celebration hook */ view.si = -1; nextSeg(); sfx.replaySting();
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
  adPodiumStart(top); // AD celebration hook
}
function podiumFrame(dt, now) {
  if (adPodiumFrame(dt, now)) return; // AD celebration hook
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
  adTown.setCamera(camera); adTown.update(dt, now / 1000); // AD critic pass 1
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
  camera, standings, PCOLORS, sfx, LAPS, // Claude T-034: used by net.js (phone controllers)
  cutLog: () => cutLog.slice(), forceTV: (piece, k) => { const m = marbles[k]; const c = stations.filter((st) => st.piece === piece).sort((x, y) => Math.abs(wrap(x.s - m.pr.s) - 4) - Math.abs(wrap(y.s - m.pr.s) - 4))[0]; if (!c) return null; camMode = 0; follow = k; dir.shot = { st: c, t0: performance.now() / 1000, dur: 1e9, k, k2: -1, zoom: 1, lostT: 0 }; lastCutTs = performance.now() / 1000; camSnap = true; return c.type; },
  stationList: () => stations.map((st) => [st.type, st.piece, st.pos.toArray().map((x) => +x.toFixed(1))]),
  setPlayers: (ps) => { session.players = ps; session.save(); buildPicker(); },
};
if (Q.get('auto')) startRace();

// ======================================================================================================
// ---------- AD TV CAM v5 "broadcast director" (Art Director, 11-14, Jarod: "the TV cameras need to be impressive") ----------
// Self-contained block (functions + one hook line at the top of shotTV). Shots hold 5-8 s, never flicker, and MOVE inside the
// shot: tracking dollies on a virtual rail beside the deck, rail-level cams, cranes, a lift-top cam for the fling, an orbit
// around the corkscrew, long-lens stations, and an automatic side-on finish cam on the last lap with a short live slow-mo.
// Shot choice follows the drama (battle for the lead > player battles > leader; set pieces coming up next get the cut).
// Camera shake and an FOV punch on drops are smooth (sine noise, no per-frame random). Lower-thirds + letterbox in DH colours,
// text only (official wordmark text "DAMN HOMIE" as already used by the wipe; no new logos). ?tv5=0 = old v4 director.
// ======================================================================================================
const TV5 = { on: Q.get('tv5') !== '0', shot: null, cp: new THREE.Vector3(), cl: new THREE.Vector3(), snap: true, log: [], lastCut: -1e9, shake: 0, punch: 0, slowUntil: 0, slowDone: false, finishLocked: false, lastType: '', lastTypes: [], ui: null };
const tv5PieceS = (name) => { const p = PIECES.find((x) => x[0] === name); return p ? { s0: sOfRawIdx(p[1]), s1: sOfRawIdx(p[2]) } : null; };
const TV5P = { lift: tv5PieceS('CHAIN LIFT'), cork: tv5PieceS('CORKSCREW'), drop: tv5PieceS('THE DROP'), narrow: tv5PieceS('THE NARROW'), sweeper: tv5PieceS('SWEEPER'), dohyo: tv5PieceS('DOHYO HAIRPIN') };
const tv5HelixR = (() => { if (rawPts.length !== 383) return 0; let r = 0, n = 0; for (let k = 192; k <= 262; k++) { r += Math.hypot(rawPts[k].x - helixC.x, rawPts[k].z - helixC.z); n++; } return r / n; })();
const tv5Y = new THREE.Vector3(0, 1, 0);
function tv5Frame(s) { const { p, i } = pointAtS(s); return { p, i, t: T[i], n: NRM[i], hw: HW[i] }; }
function tv5Speed(k) { const v = marbles[k].body.linvel(); return Math.hypot(v.x, v.y, v.z); }
function tv5Ahead(s0, s1) { return ((s1 - s0) % L + L) % L; } // distance from s0 forward to s1
function tv5OK(pos, target) { return !insideAny(pos) && visibleT(pos, target); }
function tv5ClearOfDeck(pos) { for (let j = 0; j < N; j += 2) { const q = P[j]; if (Math.hypot(q.x - pos.x, q.z - pos.z) < HW[j] + 0.5 && Math.abs(q.y - pos.y) < 2.2) return false; } return true; }
function tv5Subject(fk) { // drama-driven subject, locked for the whole shot
  if (fk >= 0) return { k: fk, k2: race.battle && (race.battle.a === fk || race.battle.b === fk) ? (race.battle.a === fk ? race.battle.b : race.battle.a) : -1, why: 'follow' };
  const st = standings(), lead = st[0], moving = (k) => tv5Speed(k) > 8;
  if (lead.finished) { const un = st.filter((x) => !x.finished); if (un.length) return { k: un[0].k, k2: un[1] && gapSec(un[0], un[1]) < 0.8 ? un[1].k : -1, why: 'chasers' }; } // AD TV r3: after the flag, cover the chasers
  const finalLap = !lead.finished && lead.lap >= LAPS - 1;
  if (st[1] && !lead.finished && gapSec(lead, st[1]) < 0.35) return { k: st[1].k, k2: lead.k, why: 'lead' };
  if (race.battle && race.battle.posn <= 1) return { k: race.battle.b, k2: race.battle.a, why: 'lead' };
  if (finalLap) return { k: lead.k, k2: st[1] && gapSec(lead, st[1]) < 0.8 ? st[1].k : -1, why: 'leader' };
  if (race.battle && (session.byMarble(race.battle.a) || session.byMarble(race.battle.b)) && moving(race.battle.a)) return { k: race.battle.b, k2: race.battle.a, why: 'player' };
  if (race.battle && race.battle.posn <= 4 && moving(race.battle.a) && Math.random() < 0.5) return { k: race.battle.b, k2: race.battle.a, why: 'battle' };
  return { k: lead.k, k2: -1, why: 'leader' };
}
function tv5EstToFlag(k) { // seconds until the leader takes the flag (final lap only)
  const m = marbles[k]; const rem = LAPS * L - m.prog; const avg = m.lapTimes.length ? L / m.lapTimes[m.lapTimes.length - 1] : 30;
  return rem / Math.max(8, 0.5 * avg + 0.5 * tv5Speed(k));
}
// ---- shot builders: each returns { type, name, dur, ... } or null when no clean angle exists ----
function tv5BuildTracking(sub) { // camera rides a virtual dolly rail beside the deck at pack speed
  const s = marbles[sub.k].pr.s, v = Math.max(10, tv5Speed(sub.k));
  for (const side of [1, -1]) for (const [off, h] of (TV6.on ? [[6, 3.8], [8, 5.2], [4.5, 3.0]] : [[3.2, 2.0], [4.5, 3.2], [2.4, 1.3]])) { // AD TV r6: wider, higher
    let ok = true;
    for (let u = 0; u <= 1.001 && ok; u += 0.2) { const f = tv5Frame(s + v * 6.5 * u - 2), pos = f.p.clone().addScaledVector(f.n, side * (f.hw + off)).addScaledVector(tv5Y, h); if (!tv5OK(pos, f.p.clone().addScaledVector(f.t, 2).add(new THREE.Vector3(0, 0.5, 0))) || !tv5ClearOfDeck(pos)) ok = false; }
    if (ok) return { type: 'track', name: 'TV · TRACKING DOLLY', side, off, h, sc: s - 2, dur: 5.5 + Math.random() * 2.5 };
  }
  return null;
}
function tv5BuildRail(sub, sFixed) { // rail-level cam: lens 0.5 u above the deck just outside the rail, pack rushes past
  const v = Math.max(10, tv5Speed(sub.k)), s = sFixed ?? marbles[sub.k].pr.s + v * 2.8;
  for (const side of [-1, 1]) { const f = tv5Frame(s), pos = f.p.clone().addScaledVector(f.n, side * (f.hw + (TV6.on ? 3.2 : 0.9))).addScaledVector(tv5Y, TV6.on ? 1.8 : 0.55); /* AD TV r6: off the rail */
    const back = tv5Frame(s - 10).p.add(new THREE.Vector3(0, 0.4, 0)); if (tv5OK(pos, back) && tv5OK(pos, f.p.clone().add(new THREE.Vector3(0, 0.4, 0)))) return { type: 'rail', name: 'TV · RAIL CAM', pos, f, side, dur: 5 + Math.random() * 2 }; }
  return null;
}
function tv5BuildCrane(sub) { // crane: starts at deck level, rises 10 u while pulling out
  const v = Math.max(10, tv5Speed(sub.k)), s = marbles[sub.k].pr.s + v * 1.8;
  for (const side of [1, -1]) { const f = tv5Frame(s); const a = f.p.clone().addScaledVector(f.n, side * (f.hw + 4)).addScaledVector(tv5Y, 2.6), b = f.p.clone().addScaledVector(f.n, side * (f.hw + 8)).addScaledVector(tv5Y, 11);
    const tgt = f.p.clone().add(new THREE.Vector3(0, 0.4, 0)), sp = marbles[sub.k].mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)); if (tv5OK(a, tgt) && tv5OK(b, tgt) && tv5OK(a.clone().lerp(b, 0.5), tgt) && tv5ClearOfDeck(a) && visibleAll(a, tgt) && visibleAll(a, sp) && visibleAll(a.clone().lerp(b, 0.3), tgt)) return { type: 'crane', name: 'TV · CRANE', a, b, dur: 6 + Math.random() * 2 }; }
  return null;
}
function tv5BuildLiftTop(sub) { // beside the head drum, looking down the lift; follows the fling and the landing
  if (!LIFT) return null;
  for (const side of [1, -1]) for (const [ds, off, h] of [[3, 3.5, 3.5], [6, 4.5, 5], [0, 5, 6]]) { const f = tv5Frame(LIFT.s1 + ds); const pos = f.p.clone().addScaledVector(f.n, side * (f.hw + off)).addScaledVector(tv5Y, h);
    if (tv5OK(pos, tv5Frame(LIFT.s1 - 14).p.add(new THREE.Vector3(0, 0.5, 0))) && tv5OK(pos, tv5Frame(LIFT.s1 + 10).p.add(new THREE.Vector3(0, 0.5, 0))) && visibleAll(pos.clone(), marbles[sub.k].mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)))) return { type: 'lift', name: 'TV · LIFT TOP · THE FLING', pos, dur: 7 + Math.random() };
  }
  return null;
}
function tv5BuildOrbit(sub) { // slow orbit outside the corkscrew helix, tracking the subject's height
  if (!tv5HelixR) return null; const m = marbles[sub.k]; const a0 = Math.atan2(m.mesh.position.z - helixC.z, m.mesh.position.x - helixC.x);
  for (const [dr, dir] of [[9, 1], [11, 1], [9, -1], [7, 1]]) { const r = tv5HelixR + dr; let ok = true;
    for (let u = 0; u <= 1.001 && ok; u += 0.25) { const a = a0 - 0.7 * dir + dir * u * 1.3; const pos = new THREE.Vector3(helixC.x + Math.cos(a) * r, m.mesh.position.y + 4 - u * 3, helixC.z + Math.sin(a) * r); if (!tv5ClearOfDeck(pos) || insideAny(pos) || !visibleT(pos, helixC.clone().setY(pos.y - 1))) ok = false; }
    if (ok) return { type: 'orbit', name: 'TV · CORKSCREW ORBIT', a0: a0 - 0.7 * dir, dir, r, y: m.mesh.position.y + 4, dur: 7 + Math.random() };
  }
  return null;
}
function tv5BuildStation(sub) { // long-lens / pan / overhead stations of the v4 rig, with a slow zoom drift
  const n = cutTV(sub, performance.now() / 1000); if (!n) return null;
  { const sp = marbles[sub.k].mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), ah = tv5Frame(marbles[sub.k].pr.s + Math.max(10, tv5Speed(sub.k)) * 1.5).p.add(new THREE.Vector3(0, 0.4, 0)); if (!TV5.relax && (!visibleAll(n.st.pos.clone(), sp) || !visibleAll(n.st.pos.clone(), ah))) return null; if (TV6.on && !TV5.relax && (n.st.type === 'low' || n.st.type === 'mast')) return null; } /* AD TV r6: rail-level + mast whip pans only as a last resort */ // subject must be in clear sight now and 1.5 s on
  return { type: 'station', name: '', st: n.st, zoom: n.zoom, dur: n.st.type === 'gantry' ? 5.2 : 5.5 + Math.random() * 2.5 };
}
const tv5FinCam = (() => { // live finish cam: inside the rail corridor 8 u past the line, 2.4 u up over the outer rail, looking back at the line
  // (F1-style finish-line angle: the pack runs at the lens and across the line). Inside the corridor nothing stands between lens and line:
  // the gantry legs, pennant poles and trees are all outside the rails (raycasts against the glb miss thin poles, so no guessing).
  const { p, i } = pointAtS(SFIN + 8); const side = Q.get('fincamside') === 'l' ? -1 : 1;
  const c = p.clone().addScaledVector(NRM[i], side * (HW[i] - 0.2)).add(new THREE.Vector3(0, 2.4, 0));
  console.log('[tv5 fincam]', c.toArray().map((x) => +x.toFixed(1))); return c;
})();
function tv5FinishArmed(ld, ts) { // final lap: arm on the time estimate, or always once the leader is inside the last 12 u (overrides a stall block)
  if (race.phase !== 'race' || ld.finished || ld.lap < LAPS - 1) return false; const rem = LAPS * L - ld.prog;
  const est = tv5EstToFlag(ld.k); // AD TV r3: arm on time-to-flag too (the v4 track runs a lap in ~12 s, so 'last quarter' came too late)
  return rem < 12 ? rem > 0 : (rem < 0.25 * L || (est < 9 && rem < 0.45 * L)) && est < 10.5 && !(TV5.finishBlock > ts);
}
function tv5BuildFinish(sub) { return { type: 'finish', name: 'TV · PHOTO-FINISH CAM', pos: tv5FinCam.clone(), dur: 8 }; }
// ---- AD TV r3 (11-14): BLIMP AERIAL in the live director. Lens = the real gondola cam (camera parented to the gondola mount
// on the moving blimp), only on calm stretches (leader alone, no set piece next, not the final lap), max once per 35 s, 6-7.5 s hold.
function tv5BlimpOK(sub, ts) {
  if (!blimp || (sub.why !== 'leader' && sub.why !== 'battle') || race.t < 6 || ts - (TV5.lastBlimp ?? -1e9) < 30) return false;
  const ld = standings()[0]; if (LAPS > 1 && ld.lap >= LAPS - 1) return false; // the final lap belongs to the battles + the finish cam
  const wp = gondolaMount.getWorldPosition(new THREE.Vector3()), tp = marbles[sub.k].mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0));
  const d = wp.distanceTo(tp); return d > 8 && d < 85 && wp.y - tp.y > 6 && visibleT(wp, tp); // must look DOWN on the pack (r4: high blimp, ~46-70 u)
}
function tv5BuildBlimp(sub) { return { type: 'blimp', name: 'BLIMP \u00b7 GONDOLA CAM', dur: 6 + Math.random() * 1.5 }; }
function tv5Pick(sub, ts) {
  const m = marbles[sub.k], s = m.pr.s, v = Math.max(10, tv5Speed(sub.k));
  const ld = standings()[0];
  if (tv5FinishArmed(ld, ts)) { TV5.finishLocked = true; const st = standings(); sub.k = ld.k; sub.k2 = st[1] && gapSec(ld, st[1]) < 1 ? st[1].k : -1; sub.why = 'finish'; return tv5BuildFinish(sub); }
  if (tv5BlimpDue(sub, ts)) return tv5BuildBlimp(sub); // AD TV r4: at least one aerial per race
  const soon = (pc, sec) => pc && tv5Ahead(s, pc.s0) < v * sec;
  const inside = (pc) => pc && tv5Ahead(pc.s0, s) < pc.s1 - pc.s0;
  const tries = [];
  if (inside(TV5P.lift) && LIFT && tv5Ahead(s, LIFT.s1) > 6 && tv5Ahead(s, LIFT.s1) < 16 * 7) tries.push(tv5BuildLiftTop); // ~5-7 s of climb left at belt speed
  if (soon(TV5P.cork, 3) || (inside(TV5P.cork) && tv5Ahead(s, TV5P.cork.s1) > v * 4)) tries.push(tv5BuildOrbit);
  if (soon(TV5P.drop, 3.5)) tries.push((x) => tv5BuildRail(x, TV5P.drop.s1 - 4));
  if (soon(TV5P.narrow, 3)) tries.push((x) => tv5BuildRail(x, (TV5P.narrow.s0 + TV5P.narrow.s1) / 2));
  if (tv5BlimpOK(sub, ts)) tries.push(tv5BuildBlimp); // AD TV r3: calm stretch -> blimp aerial
  const rot = sub.why === 'lead' || sub.why === 'battle' ? [tv5BuildTracking, tv5BuildStation, tv5BuildRail, tv5BuildCrane] : [tv5BuildTracking, tv5BuildCrane, tv5BuildStation, tv5BuildRail, tv5BuildStation];
  rot.sort(() => Math.random() - 0.5);
  for (const f of rot) tries.push(f);
  for (const f of tries) { const sh = f(sub); if (sh && (sh.type !== TV5.lastType || tries.length < 2) && !(TV5.lastTypes.slice(-2).filter((t) => t === sh.type).length >= 2)) return sh; }
  for (const f of tries) { const sh = f(sub); if (sh) return sh; }
  return null;
}
function tv5Cut(fk, ts) {
  const sub = tv5Subject(fk); let sh = tv5Pick(sub, ts);
  if (!sh && TV5.shot && ts - TV5.shot.t0 > TV5.shot.dur + 0.5) { TV5.relax = true; sh = tv5Pick(sub, ts); TV5.relax = false; } // never overstay 8 s: relax the sight-line gate
  if (!sh && TV5.shot && ts - TV5.shot.t0 > TV5.shot.dur + 1 && blimp) { sh = tv5BuildBlimp(sub); sh.dur = 6.5; } // AD TV r3: still nothing clean -> blimp aerial (helicopter-style), never a frozen shot
  if (!sh) return null;
  if (sh.type !== 'finish') { const ld = standings()[0]; if (race.phase === 'race' && !ld.finished && ld.lap >= LAPS - 1) { const est = tv5EstToFlag(ld.k); if (est < sh.dur + 2.5) sh.dur = Math.max(TV_MIN_HOLD, est - 2.5); } } // AD TV r3: end this shot ~2.5 s before the flag so the finish cam gets the line
  Object.assign(sh, { k: sub.k, k2: sub.k2, why: sub.why, t0: ts });
  if (sh.type === 'blimp') { TV5.lastBlimp = ts; TV5.blimpDone = true; } // AD TV r3/r4
  TV5.shot = sh; TV5.lastCut = ts; TV5.snap = true; TV5.lastType = sh.type; TV5.lastTypes.push(sh.type); if (TV5.lastTypes.length > 6) TV5.lastTypes.shift();
  cutLog.push(+ts.toFixed(2)); if (cutLog.length > 400) cutLog.shift();
  TV5.log.push({ t: +ts.toFixed(2), rt: +race.t.toFixed(2), type: sh.type, dur: +sh.dur.toFixed(2), k: sub.k, why: sub.why, lap: marbles[sub.k].lap + 1, piece: pieceAt(marbles[sub.k].pr.s) }); if (TV5.log.length > 400) TV5.log.shift();
  tv5LowerThird(sh); return sh;
}
function tv5Shot(dt, now, fk = follow) {
  if (race.t + 0.5 < (TV5.raceT ?? 0)) tv5Reset(); TV5.raceT = race.t; // new race
  const ts = now / 1000; let sh = TV5.shot;
  const held = sh ? ts - sh.t0 : 1e9;
  if (sh && sh.type === 'finish' && held >= sh.dur - 0.05) { // hold the finish cam while the leader is on the run-in or just crossed; otherwise release it
    const ld = standings()[0], w = race.finishOrder[0];
    if (!sh.pt || ts - sh.pt > 3) { sh.adv = sh.pt ? ld.prog - sh.pp : 99; sh.pp = ld.prog; sh.pt = ts; } // leader progress over the last ~3 s
    if ((race.phase === 'race' && !w && LAPS * L - ld.prog < 45 && sh.adv > 2.5) || (race.phase === 'race' && !w && LAPS * L - ld.prog < 30 && sh.dur < 14) || (w && race.t - w.finishTime < 5)) sh.dur += 1; // AD TV r3: leader stuck < 30 u from the flag = stay on the line (max 14 s)
    else if (race.phase === 'race') { TV5.finishLocked = false; TV5.finishBlock = ts + 6; } /* AD TV r3: block re-arm for one shot only (was 600 s, which missed the real finish after a stall) */ // stalled on the run-in: go cover the struggle, re-arm only inside the last 12 u
  }
  if (sh && sh.type !== 'finish') { const m = marbles[sh.k]; const lead = standings()[0]; // early end only after 5 s: subject gone, or the last-lap finish window opened
    const lastLap = !TV5.finishLocked && tv5FinishArmed(lead, ts);
    sh.occT = (sh.occT || 0) + dt; if (sh.occT > 0.4) { sh.occT = 0; sh.blocked = sh.type !== 'rail' && sh.type !== 'blimp' && (!visibleAll(camera.position.clone(), m.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0))) || (camera.position.distanceTo(TV5.cl) > 3 && !visibleAll(camera.position.clone(), TV5.cl.clone()))) ? (sh.blocked || 0) + 0.4 : 0; } /* subject or the aim point hidden behind scenery */ // subject hidden behind scenery
    const lost = (sh.type === 'blimp' ? camera.getWorldPosition(new THREE.Vector3()) : camera.position).distanceTo(m.mesh.position) > 75 || (sh.blocked || 0) > 0.8;
    sh.lostT = lost ? (sh.lostT || 0) + dt : 0;
    const atLine = !TV5.finishLocked && race.phase === 'race' && !lead.finished && lead.lap >= LAPS - 1 && LAPS * L - lead.prog < 14 && LAPS * L - lead.prog > 0; // AD TV r3: leader ~1 s from the flag
    if ((held >= TV_MIN_HOLD && (sh.lostT > 0.6 || lastLap)) || (atLine && held >= (TV6.on ? 4 : 3))) { /* AD TV r6: min 4 s before the finish cut */ sh = null; if (atLine) TV5.finishNow = true; } // the one allowed early cut per race: never miss the line
  }
  if (!sh || held >= sh.dur) { if (!TV5.shot || ts - TV5.lastCut >= TV_MIN_HOLD || TV5.finishNow) { TV5.finishNow = false; sh = tv5Cut(fk, ts) || TV5.shot; } else sh = TV5.shot; }
  if (!sh) return null;
  const u = THREE.MathUtils.clamp((ts - sh.t0) / sh.dur, 0, 1), e = u * u * (3 - 2 * u);
  const look = lookTarget(sh.k, sh.k2), m = marbles[sh.k];
  if (sh.type === 'blimp') { /* AD TV r4: high blimp, long lens, gondola-edge reveal */ if (ts - sh.t0 < 0.05) camSnap = true; const r = adBlimpShot(dt, now, sh.k, ts - sh.t0); const pc = pieceAt(m.pr.s); shotName = 'BLIMP \u00b7 AERIAL' + (pc ? ' \u00b7 ' + pc : ''); TV5.snap = true; tv5UI(true); return r; }
  let pos, fov = 45, kp = 3, kl = 4.5;
  if (sh.type === 'track') { const lv = m.body.linvel(), va = lv.x * m.pr.tan.x + lv.y * m.pr.tan.y + lv.z * m.pr.tan.z; sh.sc += Math.max(0, va) * dt + wrap(m.pr.s - 2.2 - sh.sc) * Math.min(1, dt * 1.5); // dolly runs at pack speed + gentle correction (no lag)
    const f = tv5Frame(sh.sc); pos = f.p.clone().addScaledVector(f.n, sh.side * (f.hw + sh.off)).addScaledVector(tv5Y, sh.h + Math.sin(u * Math.PI) * 0.6); fov = TV6.on ? 38 - e * 5 : 46 - e * 8; kp = 5; } /* AD TV r6: longer lens */
  else if (sh.type === 'rail') { pos = sh.pos.clone().addScaledVector(sh.f.t, e * 1.4); fov = TV6.on ? 44 - e * 6 : 54 - e * 8; kp = 99; }
  else if (sh.type === 'crane') { pos = sh.a.clone().lerp(sh.b, e); fov = THREE.MathUtils.clamp(420 / (pos.distanceTo(look) + 5), 24, 46); kp = 99; }
  else if (sh.type === 'lift') { pos = sh.pos.clone().add(new THREE.Vector3(0, e * 2.5, 0)); fov = THREE.MathUtils.clamp(520 / (pos.distanceTo(look) + 6), 30, 55); kp = 99; kl = 3.2; }
  else if (sh.type === 'orbit') { const a = sh.a0 + sh.dir * e * 1.3; const y = THREE.MathUtils.lerp(sh.y, m.mesh.position.y + 3.5, 0.5) - e * 1.5; pos = new THREE.Vector3(helixC.x + Math.cos(a) * sh.r, y, helixC.z + Math.sin(a) * sh.r); fov = THREE.MathUtils.clamp(560 / (pos.distanceTo(look) + 6), 30, 52); kp = 3; }
  else if (sh.type === 'finish') { pos = sh.pos.clone(); const fp = P[FIN].clone().add(new THREE.Vector3(0, 0.4, 0)); const d = m.mesh.position.distanceTo(fp); const w = THREE.MathUtils.clamp(1 - d / 30, 0, 1); if (m.finished) { const nx = standings().find((x) => !x.finished); if (nx) look.copy(lookTarget(nx.k, -1)); look.lerp(fp, 0.55); } else look.lerp(fp, 0.3 + 0.4 * w); /* after the flag: hold the line for the chasers, like F1 TV does */ const dc = pos.distanceTo(look); fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((2.5 + Math.min(d, 40) * 0.35) / dc)), m.finished ? 40 : 22, 55); kl = 4; tv5FinishSlowMo(m); }
  else { const st = sh.st, dist = st.pos.distanceTo(look); pos = st.pos.clone(); fov = st.type === 'tele' ? THREE.MathUtils.clamp(700 / (dist + 4) * sh.zoom, 12, 34) * (1 - 0.08 * e) : st.type === 'jib' ? 42 - e * 8 : THREE.MathUtils.clamp(560 / (dist + 6), 20, 55) * (1 - 0.06 * e);
    if (st.type === 'jib') { pos.y = P[st.i].y + 1.5 + e * 8; pos.addScaledVector(T[st.i], (e - 0.5) * 5); } if (st.type === 'over') pos.addScaledVector(T[st.i], (u - 0.5) * 4); kp = 99; sh.name = 'TV · ' + ({ tele: 'LONG LENS', low: 'LOW', jib: 'JIB', pan: 'PAN', gantry: 'GANTRY', mast: 'MAST CAM', over: 'OVERHEAD' }[st.type] || st.type.toUpperCase()); }
  // drama FX: smooth shake + FOV punch while the subject drops or slams a bank (sine noise, never per-frame random)
  const vy = m.body.linvel().y; const want = THREE.MathUtils.clamp((-vy - 18) / 50, 0, 1) * (sh.type === 'finish' ? 0.3 : 1);
  TV5.shake += (want - TV5.shake) * Math.min(1, dt * (want > TV5.shake ? 6 : 1.5)); TV5.punch += (want * 7 - TV5.punch) * Math.min(1, dt * (want * 7 > TV5.punch ? 5 : 1.2));
  const amp = TV5.shake * Math.min(0.18, 0.012 * pos.distanceTo(look)) * (TV6.on ? 0.5 : 1), tt = now * 0.001; // AD TV r6: half shake
  const shk = new THREE.Vector3(Math.sin(tt * 23.1) + 0.5 * Math.sin(tt * 37.7), Math.sin(tt * 19.3 + 1) + 0.5 * Math.sin(tt * 41.3), Math.sin(tt * 29.9 + 2)).multiplyScalar(amp);
  const piece = pieceAt(m.pr.s); shotName = (sh.name || 'TV') + (piece && !/FINISH CAM|FLING|CORKSCREW/.test(sh.name) ? ' · ' + piece : '') + (TV5.slowUntil > now ? ' · SLOW-MO' : '');
  // lead-compensate the look target by the smoothing lag (v / k), so 60 u/s marbles stay in frame on long lenses
  { const lv = m.body.linvel(); const lead = sh.type === 'orbit' || sh.type === 'finish' ? 0 : Math.min(1 / kl, 0.4); /* no chord lead inside the helix */ look.x += lv.x * lead; look.y += lv.y * lead * 0.5; look.z += lv.z * lead; }
  if (sh.type === 'station' && sh.st.type === 'tele') kl = 6; if (sh.type === 'orbit') kl = 7;
  // own smoothing so shake reaches the lens (applyShot gets kPos/kLook 99)
  if (TV5.snap) { TV5.cp.copy(pos); TV5.cl.copy(look); TV5.snap = false; }
  else { TV5.cp.lerp(pos, kp >= 99 ? 1 : 1 - Math.exp(-dt * kp)); TV5.cl.lerp(look, 1 - Math.exp(-dt * kl)); }
  if (TV6.on && sh.type !== 'finish') { const g = tv6Guard(TV5.cp, m.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), sh); if (g) { TV5.cp.copy(g); } } // AD TV r6: lens never inside / under geometry
  tv5UI(true);
  return { pos: TV5.cp.clone(), look: TV5.cl.clone().add(shk), fov: fov + TV5.punch, kPos: 99, kLook: 99, kFov: sh.type === 'finish' ? 2 : 1.4 };
}
function tv5FinishSlowMo(m) { // live slow-mo as the leader takes the flag, only when it's close (P2 within ~0.6 s)
  const now = performance.now();
  if (TV5.slowUntil && now > TV5.slowUntil) { PHYS.ts = TV5.tsBase ?? 1; TV5.slowUntil = 0; tv5Tag(''); }
  if (TV5.slowDone || race.phase !== 'race') return;
  const st = standings(), a = st[0], b = st[1]; if (!b) return;
  const toLine = LAPS * L - a.prog;
  if (toLine < 9 && toLine > 0 && gapSec(a, b) < 0.6) { TV5.slowDone = true; TV5.tsBase = PHYS.ts; PHYS.ts = 0.3 * TV5.tsBase; TV5.slowUntil = now + 2200; tv5Tag('PHOTO FINISH'); sfx.roar?.(0.16, 2.5); }
}
// ---- broadcast UI: letterbox + lower-third (DH red / black / white, text only) ----
function tv5UIInit() {
  if (TV5.ui) return TV5.ui;
  const css = document.createElement('style'); css.id = 'tv5css';
  css.textContent = `#tv5lb{position:absolute;inset:0;pointer-events:none;z-index:0}#tv5lb i{position:absolute;left:0;right:0;height:0;background:#07040c;transition:height .6s ease}#tv5lb i:first-child{top:0}#tv5lb i:last-child{bottom:0}
#tv5lb.on i{height:6.5vh}@media (orientation:portrait){#tv5lb.on i{height:3vh}}
#tv5lt{position:absolute;left:max(10px,env(safe-area-inset-left));bottom:calc(max(12px,env(safe-area-inset-bottom)) + 150px);display:flex;align-items:stretch;transform:translateX(-120%);transition:transform .45s cubic-bezier(.2,.9,.2,1);pointer-events:none;font-style:italic;text-transform:uppercase}
#tv5lt.on{transform:none}#tv5lt .pos{background:#fff;color:#e0102f;font-weight:900;font-size:22px;padding:4px 10px;display:flex;align-items:center}#tv5lt .bd{background:linear-gradient(90deg,#111 0,#1d1424 100%);border-left:4px solid #e0102f;padding:4px 14px 5px}
#tv5lt .nm{font-weight:900;font-size:18px;letter-spacing:.5px;color:#fff;line-height:1.1}#tv5lt .sub{font-weight:800;font-size:11px;letter-spacing:1.5px;color:#ffb300}#tv5lt .ball{width:30px;height:30px;border-radius:50%;background-size:cover;margin:auto 8px auto 0;box-shadow:0 0 0 2px #fff}
#tv5lt .wm{align-self:flex-end;background:#e0102f;color:#fff;font-weight:900;font-size:9px;letter-spacing:2px;padding:2px 6px}
#tv5tag{position:absolute;left:50%;top:calc(max(8px,env(safe-area-inset-top)) + 8vh);transform:translateX(-50%);background:#e0102f;color:#fff;font-weight:900;font-style:italic;letter-spacing:3px;padding:4px 14px;font-size:15px;pointer-events:none;box-shadow:3px 3px 0 #000}
#tv5tag:empty{display:none}@media (max-width:600px){#tv5lt{bottom:calc(max(12px,env(safe-area-inset-bottom)) + 170px)}#tv5lt .nm{font-size:14px}#tv5lt .pos{font-size:17px}}`;
  document.head.appendChild(css);
  const lb = document.createElement('div'); lb.id = 'tv5lb'; lb.innerHTML = '<i></i><i></i>';
  const lt = document.createElement('div'); lt.id = 'tv5lt'; lt.innerHTML = '<div class="pos"></div><div class="bd"><div class="nm"></div><div class="sub"></div></div><div class="wm">DAMN HOMIE · OSAKA GP</div>';
  const tag = document.createElement('div'); tag.id = 'tv5tag';
  const hud = $('hud'); hud.prepend(lb); hud.appendChild(lt); hud.appendChild(tag);
  TV5.ui = { lb, lt, tag }; return TV5.ui;
}
function tv5Tag(t) { tv5UIInit().tag.textContent = t; }
function tv5UI(on) { const u = tv5UIInit(); u.lb.classList.toggle('on', !!on); if (!on) u.lt.classList.remove('on'); }
function tv5LowerThird(sh) {
  const u = tv5UIInit(), st = standings(), m = marbles[sh.k], pos = st.indexOf(m) + 1, p = session.byMarble(m.k);
  let nm = m.name + (p ? ' · ' + p.name : ''), sub = ($('lap').textContent || '').trim() || `LAP ${Math.min(LAPS, Math.max(1, Math.floor(st[0].prog / L) + 1))}/${LAPS}`; // AD TV r4: the HUD's own lap text verbatim (kept in sync by a MutationObserver), so they can never disagree
  if (sh.k2 >= 0) { const o = marbles[sh.k2], po = st.indexOf(o) + 1; nm = `${o.name} vs ${m.name}`; sub = `BATTLE FOR P${Math.min(po, pos)} · GAP ${gapSec(st[Math.min(po, pos) - 1], st[Math.max(po, pos) - 1]).toFixed(2)}s · ` + sub; }
  else if (pos === 1 && st[1]) sub = `LEADS BY ${gapSec(st[0], st[1]).toFixed(2)}s · ` + sub;
  if (sh.type === 'blimp') sub = 'AERIAL \u00b7 DH BLIMP \u00b7 ' + sub; // AD TV r3
  if (sh.type === 'lift') sub = 'UP THE LIFT · INTO THE FLING · ' + sub;
  if (sh.type === 'finish') { nm = 'RUN TO THE FLAG'; sub = `FINAL LAP · ${st[0].name} LEADS`; }
  u.lt.querySelector('.pos').textContent = sh.k2 >= 0 ? 'P' + Math.min(pos, st.indexOf(marbles[sh.k2]) + 1) : 'P' + pos;
  u.lt.querySelector('.nm').textContent = nm; u.lt.querySelector('.sub').textContent = sub;
  if (sh.ltRefresh) return; // AD TV r4: live refresh keeps the slide-in timing
  u.lt.classList.add('on'); clearTimeout(tv5LowerThird.t); tv5LowerThird.t = setTimeout(() => u.lt.classList.remove('on'), 3800);
}
function tv5Reset() { TV5.blimpDone = false; TV5.lastBlimp = -1e9; /* AD TV r4 */ TV5.shot = null; TV5.snap = true; TV5.lastCut = -1e9; TV5.slowDone = false; TV5.finishLocked = false; TV5.finishBlock = 0; if (TV5.slowUntil) { PHYS.ts = TV5.tsBase ?? 1; TV5.slowUntil = 0; } if (TV5.ui) { tv5UI(false); tv5Tag(''); } }
function tv5Tick() { // per frame (via the shotTV hook state): hide broadcast UI when TV is not the live camera
  if (!TV5.ui) return; const live = view.mode === 'live' && camMode === 0 && (race.phase === 'race' || race.phase === 'done');
  if (!live && TV5.slowUntil) { PHYS.ts = TV5.tsBase ?? 1; TV5.slowUntil = 0; }
  if (!live) { TV5.ui.lb.classList.remove('on'); TV5.ui.lt.classList.remove('on'); if (view.mode !== 'live') TV5.ui.tag.textContent = ''; }
}
setInterval(tv5Tick, 250);
if (window.__dh) Object.assign(window.__dh, { tv5Log: () => TV5.log.slice(), tv5: TV5, tv5Reset, tv5FinCam: () => tv5FinCam.toArray(), finLine: () => P[FIN].toArray(), camInfo: () => ({ p: camera.position.toArray().map((x) => +x.toFixed(2)), fov: +camera.fov.toFixed(1), near: camera.near, shot: TV5.shot && TV5.shot.type, cl: TV5.cl.toArray().map((x) => +x.toFixed(2)) }) });

// ======================================================================================================
// ---------- AD WINNER CELEBRATION v1 (Art Director, 11-14, Jarod: "a big winner celebration") ----------
// (a) podium scene at the red DH gantry: risers (existing), winner wears a gold crown with a trophy hovering beside it,
//     bounce + spin, confetti, big fireworks over the castle, crowd swell (sfx.roar -> crowd_finish), one continuous crane/orbit
//     camera move (no cuts). (b) replay: the decisive move from 3 angles in slow-mo + multi-angle finish, with a broadcast banner.
// (c) bragging rights: only the winning player gets a 60-char box (light profanity filter); the message shows big for everyone.
//     Network hook: DHBrag.onSend(payload) (lobby sends it) and DHBrag.receive(payload) (lobby delivers it).
// (d) "Shop Damn Homie" button on the podium/results screens; hidden while SHOP_URL is empty.
// Hooks into existing code: startReplay (segments), startPodium (end), podiumFrame (top). Everything else lives here.
// ======================================================================================================
const SHOP_URL = ''; // Jarod: put the Damn Homie store link here; empty string hides the button
const CELEB = { on: Q.get('celeb') !== '0', t: 0, dur: 16, top: null, ui: null, brag: null, holdForBrag: false, castle: null, camA: 0 };
const celebGold = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.22, emissive: 0x3a2400 });
const celebRed = new THREE.MeshStandardMaterial({ color: 0xe0102f, metalness: 0.2, roughness: 0.15, emissive: 0x400008 });
const celebWhite = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.3 });
function celebMakeCrown() { // stylized: gold band, 5 points with ball tips, red gems; sized to a 1 u marble
  const g = new THREE.Group(); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.18, 24, 1, true), celebGold); band.material.side = THREE.DoubleSide; g.add(band);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 8), celebGold); sp.position.set(Math.cos(a) * 0.32, 0.2, Math.sin(a) * 0.32); g.add(sp);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), celebGold); tip.position.set(Math.cos(a) * 0.32, 0.33, Math.sin(a) * 0.32); g.add(tip);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), celebRed); gem.position.set(Math.cos(a + 0.63) * 0.335, 0, Math.sin(a + 0.63) * 0.335); g.add(gem); }
  g.visible = false; scene.add(g); return g;
}
function celebMakeTrophy() { // stylized cup on a two-step plinth (no marks, no brands)
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0], [0.26, 0.04], [0.33, 0.25], [0.34, 0.48], [0.3, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 24), celebGold); cup.material.side = THREE.DoubleSide; cup.position.y = 0.55; g.add(cup);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 16, Math.PI), celebGold); h.position.set(s * 0.34, 0.86, 0); h.rotation.z = -s * Math.PI / 2; g.add(h); }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 12), celebGold); stem.position.y = 0.4; g.add(stem);
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 16), celebGold); b1.position.y = 0.22; g.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0x111014, roughness: 0.4 })); b2.position.y = 0.09; g.add(b2);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.04, 0.51), celebRed); strip.position.y = 0.12; g.add(strip);
  g.visible = false; scene.add(g); return g;
}
const celebCrown = celebMakeCrown(), celebTrophy = celebMakeTrophy(); celebTrophy.scale.setScalar(0.8);
// big fireworks: a second, larger points system so shells read from the podium ~60-90 u away (cheap: one draw call)
const CFN = 900, cfGeo = new THREE.BufferGeometry(), cfPos = new Float32Array(CFN * 3).fill(-999), cfCol = new Float32Array(CFN * 3), cfVel = new Float32Array(CFN * 3), cfLife = new Float32Array(CFN);
cfGeo.setAttribute('position', new THREE.BufferAttribute(cfPos, 3)); cfGeo.setAttribute('color', new THREE.BufferAttribute(cfCol, 3));
const cfPts = new THREE.Points(cfGeo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); cfPts.frustumCulled = false; scene.add(cfPts);
let cfHead = 0;
function celebShell(pos) { const c = BRAND[(Math.random() * BRAND.length) | 0], sp = 7 + Math.random() * 5; for (let j = 0; j < 110; j++) { const i = cfHead; cfHead = (cfHead + 1) % CFN; const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = Math.sqrt(1 - u * u), s = sp * (0.85 + Math.random() * 0.15); cfPos.set([pos.x, pos.y, pos.z], i * 3); cfVel.set([r * Math.cos(th) * s, u * s, r * Math.sin(th) * s], i * 3); cfCol.set([c.r, c.g, c.b], i * 3); cfLife[i] = 1.6 + Math.random() * 0.8; } sfx.pop?.(); }
function celebParticles(dt) { for (let i = 0; i < CFN; i++) { if (cfLife[i] <= 0) continue; cfLife[i] -= dt; if (cfLife[i] <= 0) { cfPos[i * 3 + 1] = -999; continue; } const d = Math.exp(-1.3 * dt); cfVel[i * 3] *= d; cfVel[i * 3 + 1] = cfVel[i * 3 + 1] * d - 4 * dt; cfVel[i * 3 + 2] *= d; cfPos[i * 3] += cfVel[i * 3] * dt; cfPos[i * 3 + 1] += cfVel[i * 3 + 1] * dt; cfPos[i * 3 + 2] += cfVel[i * 3 + 2] * dt; } cfGeo.attributes.position.needsUpdate = true; cfGeo.attributes.color.needsUpdate = true; }
function celebCastleTop() {
  if (CELEB.castle) return CELEB.castle; let best = null;
  world3d.traverse((o) => { if (!best && /castle/i.test(o.name) && !/sign|board|ad_/i.test(o.name)) best = o; });
  const b = best ? new THREE.Box3().setFromObject(best) : null;
  CELEB.castle = b && isFinite(b.max.y) ? new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 8, (b.min.z + b.max.z) / 2) : center.clone().add(new THREE.Vector3(0, 30, 0)); return CELEB.castle;
}
// camera: one continuous move. Starts low and close on the crown, cranes up and swings out so the castle fireworks sit behind the podium.
function celebCamPos(a0, t) { const e = Math.min(1, t / 9), ee = e * e * (3 - 2 * e); const a = a0 + 0.55 - ee * 0.75 + Math.max(0, t - 9) * 0.03, r = 3.0 + ee * 4.4, h = 0.35 + ee * 2.0; return podC.clone().add(new THREE.Vector3(Math.cos(a) * r, h + podTops[0].y - podC.y, Math.sin(a) * r)); }
function celebCamPlan() { // the podium stands on the deck 5 u past the line: shoot from further down the straight, back toward the red DH gantry.
  // Inside the rail corridor nothing stands in front of the lens; the three risers read side by side; the gantry is the backdrop.
  if (CELEB.planned) return; CELEB.planned = true;
  const t = T[podIdx]; CELEB.camA = Math.atan2(t.z, t.x);
  const dir = podTops[0].clone().sub(celebCamPos(CELEB.camA, 9)).setY(0).normalize(); CELEB.trophyOff = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.95).add(dir.clone().multiplyScalar(-0.45)); // beside the winner, a touch toward the lens
  console.log('[celeb] cam angle', CELEB.camA.toFixed(2));
}
function celebCam(dt, t) {
  const c = podTops[0].clone(), e = Math.min(1, t / 9), ee = e * e * (3 - 2 * e);
  const pos = celebCamPos(CELEB.camA, t);
  const look = c.clone().add(new THREE.Vector3(0, 0.25 + ee * 1.1, 0)); // tilt up late so the castle fireworks fill the sky above the podium
  applyShot({ pos, look, fov: 38 + ee * 14, kPos: 99, kLook: 99 }, dt); $('shotTag').textContent = 'PODIUM · CROWN CAM';
}
function adPodiumStart(top) { // called at the end of startPodium
  if (!CELEB.on) return; CELEB.t = 0; CELEB.top = top; CELEB.brag = null; celebCamPlan(); celebCastleTop();
  celebCrown.visible = celebTrophy.visible = true; sfx.roar?.(0.25, 7);
  for (let i = 0; i < 5; i++) setTimeout(() => view.mode === 'podium' && celebShell(celebCastleTop().clone().add(new THREE.Vector3((Math.random() - 0.5) * 22, Math.random() * 8, (Math.random() - 0.5) * 22))), 300 + i * 260);
  celebUI().pod.classList.remove('hidden');
  const p = session.byMarble(top[0].k); const ui = celebUI();
  ui.podName.textContent = top[0].name.toUpperCase(); ui.podSub.textContent = p ? `${p.name.toUpperCase()} TAKES THE OSAKA GP` : 'WINS THE OSAKA GRAND PRIX';
  ui.podList.innerHTML = top.map((m, i) => `<span class="p${i + 1}">${i + 1}. ${m.name}</span>`).join('');
  CELEB.holdForBrag = !!p || CELEB.forceBrag === true; ui.brag.classList.toggle('hidden', !CELEB.holdForBrag); ui.bragShow.classList.add('hidden');
  if (CELEB.holdForBrag) { ui.bragWho.textContent = `${(p ? p.name : top[0].name).toUpperCase()}, YOU WON. SAY SOMETHING:`; ui.bragIn.value = ''; }
  ui.shop.classList.toggle('hidden', !SHOP_URL);
  $('winTitle').classList.add('hidden');
}
function adPodiumFrame(dt, now) { // called at the top of podiumFrame; returns true when it drove the frame
  if (!CELEB.on || !CELEB.top) return false;
  detachCam(); CELEB.t += dt; view.podT = CELEB.t; const t = CELEB.t, top = CELEB.top;
  top.forEach((m, i) => { m.mesh.position.copy(podTops[i]); if (i === 0) { const b = Math.abs(Math.sin(t * 4.2)); m.mesh.position.y += b * 0.55; m.mesh.scale.set(1 + (1 - b) * 0.06, 1 - (1 - b) * 0.08, 1 + (1 - b) * 0.06); m.mesh.rotateY(dt * 3.2); } else m.mesh.rotateY(dt); });
  const w = top[0].mesh; celebCrown.position.copy(w.position).add(new THREE.Vector3(0, 0.8 * R * w.scale.y + 0.07, 0)); /* AD r4: band rim seated on the sphere (ring r 0.3 meets R 0.5 at 0.4) */ celebCrown.rotation.set(0.12 * Math.sin(t * 2), t * 1.2, 0.1);
  celebTrophy.position.copy(podTops[0]).add(adTrophyOff()).add(new THREE.Vector3(0, -R + 0.005, 0)); celebTrophy.scale.setScalar(1.0); /* AD r4: stands ON the P1 riser (front corner, away from P2), no float, bigger for phones */ celebTrophy.rotation.y = t * 0.8;
  top[0].mat.emissive.setScalar(0.22 + 0.12 * Math.sin(now * 0.006));
  beamMat.opacity = 0.13 + 0.05 * Math.sin(now * 0.004);
  if (t < 12 && Math.random() < dt * 3) celebShell(celebCastleTop().clone().add(new THREE.Vector3((Math.random() - 0.5) * 26, Math.random() * 10, (Math.random() - 0.5) * 26)));
  if (Math.random() < dt * 1.2) firework(gantryTop(Math.random()).add(new THREE.Vector3(0, 4 + Math.random() * 6, 0)));
  if (t > 3 && t < 14 && Math.random() < dt * 0.9) celebShell(gantryTop(Math.random()).add(new THREE.Vector3(0, 9 + Math.random() * 6, 0))); // big shells over the gantry backdrop too
  if (Math.random() < dt * 2) confetti(podTops[0].clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 8, (Math.random() - 0.5) * 4)), 70);
  celebParticles(dt); celebCam(dt, t);
  const hold = CELEB.holdForBrag && !CELEB.brag && t < 40; // the winner gets time to type (max 40 s)
  if (t > CELEB.dur + (CELEB.brag ? 4 : 0) && !hold) adPodiumEnd();
  return true;
}
function adPodiumEnd() { CELEB.top[0]?.mesh.scale.set(1, 1, 1); celebCrown.visible = celebTrophy.visible = false; CELEB.top = null; celebUI().pod.classList.add('hidden'); endShow(); celebResultsExtras(); }
// ---- bragging rights ----
const BRAG_MAX = 60;
const BRAG_BAD = ['fuck', 'fuk', 'fck', 'fack', 'phuk', 'phuck', 'biatch', 'btch', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'cock', 'fag', 'nigg', 'retard', 'whore', 'slut', 'twat', 'wank', 'kike', 'spic', 'chink', 'tranny', 'rape'];
function bragFilter(s) {
  s = String(s || '').replace(/<[^>]{0,40}>/g, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, BRAG_MAX);
  const norm = (x) => x.toLowerCase().replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't');
  return s.split(' ').map((w) => (BRAG_BAD.some((b) => norm(w).replace(/[^a-z]/g, '').includes(b)) ? '★'.repeat(Math.min(6, w.length)) : w)).join(' ');
}
const DHBrag = { // network hook for the lobby/controller layer (T-025 / phone controllers): set onSend, call receive()
  onSend: null,
  submit(text) { const msg = bragFilter(text); if (!msg) return null; const w = CELEB.top?.[0] || race.finishOrder[0]; const p = w && session.byMarble(w.k); const payload = { type: 'brag', msg, by: p ? p.name : w?.name || '', marble: w?.name || '', t: Date.now() }; this.receive(payload); try { this.onSend?.(payload); } catch (e) { console.warn('brag send', e); } return payload; },
  receive(payload) { if (!payload || payload.type !== 'brag') return; const msg = bragFilter(payload.msg); CELEB.brag = { ...payload, msg }; const ui = celebUI(); ui.brag.classList.add('hidden'); ui.bragText.textContent = `“${msg}”`; ui.bragBy.textContent = `— ${String(payload.by || '').toUpperCase().slice(0, 16)}`; ui.bragShow.classList.remove('hidden'); CELEB.t = Math.min(CELEB.t, CELEB.dur - 2); sfx.roar?.(0.14, 2); },
};
window.DHBrag = DHBrag;
function celebUI() {
  if (CELEB.ui) return CELEB.ui;
  const css = document.createElement('style'); css.id = 'celebcss';
  css.textContent = `#celebPod{position:fixed;inset:0;z-index:7;pointer-events:none;font-style:italic;text-transform:uppercase}
#celebPod .top{position:absolute;left:0;right:0;top:calc(max(14px,env(safe-area-inset-top)) + 34px);text-align:center}
#celebPod .ribbon{display:inline-block;background:#e0102f;color:#fff;font-weight:900;letter-spacing:4px;font-size:13px;padding:4px 14px;box-shadow:3px 3px 0 #000}
#celebPod .nm{font-weight:900;font-size:clamp(34px,9vw,72px);line-height:1;margin-top:8px;color:#fff;text-shadow:0 0 24px #ffb300,4px 4px 0 #000}
#celebPod .sub{font-weight:900;font-size:clamp(12px,3.2vw,18px);letter-spacing:2px;color:#ffb300;text-shadow:2px 2px 0 #000;margin-top:6px}
#celebPod .clist{margin-top:8px;display:flex;gap:10px;justify-content:center;font-weight:900;font-size:13px}#celebPod .clist span{background:rgba(10,6,18,.8);padding:3px 9px}#celebPod .p1{color:#ffb300}#celebPod .p2{color:#d6dbe6}#celebPod .p3{color:#e0915a}
#celebBrag{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:calc(max(16px,env(safe-area-inset-bottom)) + 62px);width:min(400px,92vw);background:rgba(10,6,18,.92);border:3px solid #ffb300;padding:12px;pointer-events:auto;font-style:normal;text-transform:none}
#celebBrag .who{font-weight:900;font-size:13px;letter-spacing:1px;color:#ffb300;margin-bottom:8px;font-style:italic}
#celebBrag .row{display:flex;gap:8px}#celebBrag input{flex:1;font-size:18px;padding:10px;border:0;border-radius:4px;background:#fff;color:#111;min-width:0}
#celebBrag button{font-weight:900;font-size:16px;padding:10px 16px;border:0;border-radius:4px;background:#e0102f;color:#fff}#celebBrag .cnt{font-size:11px;color:#aaa;text-align:right;margin-top:4px}
@media (max-width:700px){#celebBrag{right:50%;transform:translateX(50%)}#celebBragShow{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 100px)}}
#celebBragShow{position:absolute;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 58px);transform:translate(-50%,0);width:min(980px,96vw);text-align:center;padding:10px 18px 12px;background:linear-gradient(90deg,transparent,rgba(10,6,18,.82) 12%,rgba(10,6,18,.82) 88%,transparent);border-top:3px solid #e0102f;animation:bragIn .5s cubic-bezier(.2,1.4,.4,1)}
#celebBragShow .tx{font-weight:900;font-size:clamp(22px,5.6vw,46px);line-height:1.1;color:#fff;text-shadow:0 0 18px #ff2d95,4px 4px 0 #000;text-transform:none;word-break:break-word}
#celebBragShow .by{margin-top:8px;font-weight:900;color:#ffb300;letter-spacing:3px;text-shadow:2px 2px 0 #000}
@keyframes bragIn{from{transform:translate(-50%,0) scale(.3);opacity:0}to{transform:translate(-50%,0) scale(1);opacity:1}}
.celebShop{pointer-events:auto;position:absolute;right:max(12px,env(safe-area-inset-right));bottom:calc(max(14px,env(safe-area-inset-bottom)) + 12px);background:#111;color:#fff;border:2px solid #fff;font-weight:900;font-style:italic;letter-spacing:2px;font-size:13px;padding:9px 14px;border-radius:4px;text-decoration:none}
.celebShop:hover{background:#e0102f;border-color:#e0102f}#celebResBrag{font-weight:900;font-size:18px;margin:4px 0 10px;color:#fff;text-shadow:0 0 12px #ff2d95}#celebResBrag small{display:block;color:#ffb300;font-size:11px;letter-spacing:2px}
#celebBanner{position:fixed;left:0;right:0;top:calc(max(10px,env(safe-area-inset-top)) + 6vh);z-index:8;pointer-events:none;text-align:center;font-style:italic;text-transform:uppercase}
#celebBanner .b1{display:inline-block;background:#fff;color:#e0102f;font-weight:900;letter-spacing:3px;font-size:clamp(14px,3.6vw,24px);padding:5px 18px;box-shadow:4px 4px 0 #e0102f}
#celebBanner .b2{display:block;margin:6px auto 0;width:max-content;max-width:92vw;background:#111;color:#ffb300;font-weight:900;letter-spacing:2px;font-size:clamp(10px,2.6vw,14px);padding:3px 12px}
#celebBanner.hidden{display:none}`;
  document.head.appendChild(css);
  const pod = document.createElement('div'); pod.id = 'celebPod'; pod.className = 'hidden';
  pod.innerHTML = `<div class="top"><div class="ribbon">OSAKA GP · CHAMPION</div><div class="nm"></div><div class="sub"></div><div class="clist"></div></div>
<div id="celebBrag" class="hidden"><div class="who"></div><div class="row"><input id="celebBragIn" maxlength="${BRAG_MAX}" placeholder="Bragging rights… (60 max)" autocomplete="off"><button id="celebBragGo">SEND</button></div><div class="cnt"><span id="celebBragCnt">0</span>/${BRAG_MAX} · <a href="#" id="celebBragSkip" style="color:#aaa">skip</a></div></div>
<div id="celebBragShow" class="hidden"><div class="tx"></div><div class="by"></div></div><a class="celebShop hidden" target="_blank" rel="noopener">SHOP DAMN HOMIE ↗</a>`;
  document.body.appendChild(pod);
  const ban = document.createElement('div'); ban.id = 'celebBanner'; ban.className = 'hidden'; ban.innerHTML = '<span class="b1"></span><span class="b2"></span>'; document.body.appendChild(ban);
  const q = (s) => pod.querySelector(s);
  const ui = CELEB.ui = { pod, ban, podName: q('.nm'), podSub: q('.sub'), podList: q('.clist'), brag: q('#celebBrag'), bragWho: q('.who'), bragIn: q('#celebBragIn'), bragShow: q('#celebBragShow'), bragText: q('#celebBragShow .tx'), bragBy: q('#celebBragShow .by'), shop: q('.celebShop') };
  if (SHOP_URL) ui.shop.href = SHOP_URL;
  ui.bragIn.addEventListener('input', () => { $('celebBragCnt').textContent = ui.bragIn.value.length; });
  ui.bragIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') DHBrag.submit(ui.bragIn.value); });
  q('#celebBragGo').onclick = (e) => { e.stopPropagation(); DHBrag.submit(ui.bragIn.value); };
  q('#celebBragSkip').onclick = (e) => { e.preventDefault(); CELEB.holdForBrag = false; ui.brag.classList.add('hidden'); };
  return ui;
}
function celebResultsExtras() { // results screen: the brag stays up top, plus the shop button
  const res = $('results'); if (!res) return; let rb = $('celebResBrag'); if (!rb) { rb = document.createElement('div'); rb.id = 'celebResBrag'; $('resTitle').after(rb); }
  rb.innerHTML = CELEB.brag ? `“${CELEB.brag.msg.replace(/[&<>]/g, '')}”<small>— ${String(CELEB.brag.by).toUpperCase().replace(/[&<>]/g, '')}</small>` : '';
  let sb = res.querySelector('.celebShop'); if (!sb && SHOP_URL) { sb = document.createElement('a'); sb.className = 'celebShop'; sb.target = '_blank'; sb.rel = 'noopener'; sb.href = SHOP_URL; sb.textContent = 'SHOP DAMN HOMIE ↗'; sb.style.position = 'static'; sb.style.display = 'inline-block'; sb.style.marginTop = '10px'; res.appendChild(sb); }
}
// ---- (b) replay: the decisive move from three angles in slow-mo, the finish from three angles, broadcast banners ----
function adCelebrateSegs(segs) {
  if (!CELEB.on) return segs;
  const w = race.finishOrder[0] || standings()[0]; const tw = w.finished ? w.finishTime : race.t; const [a] = rec.range();
  let lead = race.keyMoments.filter((x) => x.type === 'lead' && x.k === w.k && x.t < tw - 3 && x.t - 3 > a).pop() || race.keyMoments.filter((x) => x.t < tw - 3 && x.t - 3 > a).pop(); // the pass that won it (else the last big moment)
  const out = [];
  let lateMove = false; if (lead && lead.t + 1.5 > tw - 8.5) { lead = null; lateMove = true; } // the move happened in the run to the flag: the finish angles already show it
  if (lead) {
    const cap = `${marbles[lead.k].name.toUpperCase()} TAKES P1 · LAP ${lead.lap}${lead.at ? ' · ' + lead.at : ''}`;
    out.push({ t0: lead.t - 2.5, t1: lead.t + 1.5, speed: 0.5, cam: 'tvreplay', k: lead.k, cap, banner: ['THE DECISIVE MOVE', 'ANGLE 1 / 3 · TRACKSIDE'] });
    out.push({ t0: lead.t - 1.6, t1: lead.t + 1.0, speed: 0.35, cam: 'chase', k: lead.k, cap, banner: ['THE DECISIVE MOVE', 'ANGLE 2 / 3 · ON BOARD'] });
    out.push({ t0: lead.t - 2.0, t1: lead.t + 1.5, speed: 0.5, cam: 'blimp', k: lead.k, cap, banner: ['THE DECISIVE MOVE', 'ANGLE 3 / 3 · BLIMP'] });
  }
  const finish = segs.filter((s) => s.t0 >= tw - 8.01); const early = segs.filter((s) => s.t0 < tw - 8.01 && (!lead || Math.abs(s.t0 - (lead.t - 2.5)) > 3));
  const tagF = { blimp: ['THE RUN TO THE FLAG', 'BLIMP CAM'], chase: ['THE FINISH', 'SLOW-MO · ON BOARD'], gantry: ['THE FINISH', 'HEAD ON'], photo: ['PHOTO FINISH', 'SIDE ON · 0.15×'], orbit: ['CHAMPION', marbles[w.k].name.toUpperCase()] };
  if (lateMove) tagF.blimp = ['THE DECISIVE MOVE', 'IN THE RUN TO THE FLAG · BLIMP'];
  for (const s of finish) s.banner = tagF[s.cam] || null;
  for (const s of early) if (!s.banner) s.banner = s.cam === 'tvreplay' ? ['LEAD CHANGE', 'SLOW-MO · TRACKSIDE'] : ['REPLAY', String(s.cap || '').toUpperCase()];
  early.sort((x, y) => x.t0 - y.t0); const at = out.length ? early.filter((s) => s.t0 < out[0].t0).length : early.length;
  const res = [...early.slice(0, at), ...out, ...early.slice(at)].concat(finish); // the three angles stay in order 1-2-3
  adBlimpSegCheck(res); // AD TV r3: drop blimp angles that can't see the subject
  return res.filter((s) => s.t1 > s.t0);
}
function celebBannerTick() { if (view.mode !== 'podium' && celebCrown.visible) { celebCrown.visible = celebTrophy.visible = false; if (CELEB.top) { CELEB.top[0]?.mesh.scale.set(1, 1, 1); CELEB.top = null; } CELEB.ui?.pod.classList.add('hidden'); celebResultsExtras(); } const ui = CELEB.ui || (view.mode === 'replay' ? celebUI() : null); if (!ui) return; const s = view.mode === 'replay' ? view.segs[view.si] : null; if (s && s.banner) { ui.ban.querySelector('.b1').textContent = s.banner[0]; ui.ban.querySelector('.b2').textContent = s.banner[1]; ui.ban.classList.remove('hidden'); } else ui.ban.classList.add('hidden'); }
setInterval(celebBannerTick, 120);
if (window.__dh) Object.assign(window.__dh, { celeb: CELEB, DHBrag, bragFilter, podiumNow: (forceBrag) => { CELEB.forceBrag = !!forceBrag; if (!race.finishOrder.length) for (const m of standings().slice(0, 3)) { m.finished = true; m.finishTime = race.t; race.finishOrder.push(m); } race.phase = 'over'; $('rp').classList.remove('hidden'); $('hud').classList.add('hidden'); startPodium(); }, replaySegs: () => view.segs.map((s) => [s.cam, +s.t0.toFixed(2), +s.t1.toFixed(2), s.speed, s.banner?.[0] || '']) });

// ======================================================================================================
// ---------- AD TV r3 (Art Director, 11-14): blimp-ride cleanup + replay angle checks (own block) ----------
// (a) While the camera rides the gondola (live Blimp cam, TV blimp aerial, replay blimp angle) the two red boom struts that pass
//     0.4 u beside the lens are hidden; they read as giant red slabs across the frame. Everything else on the blimp stays.
// (b) Replay: a blimp angle is kept only if the recorded gondola is above the subject and has a clear line to it at 3 sample
//     times; otherwise it becomes a trackside long-lens angle (no "decisive move" shot that shows no marble).
// (c) Replay on-board (chase) angles cut the near plane to 2.8 u so a gantry post between the lens and the marble vanishes.
function adBlimpSegCheck(segs) {
  if (!blimp || !segs) return;
  for (const s of segs) {
    if (s.cam !== 'blimp') continue; let ok = 0;
    for (const f of [0.15, 0.5, 0.85]) {
      rec.apply(s.t0 + (s.t1 - s.t0) * f); blimp.updateMatrixWorld(true);
      const wp = gondolaMount.getWorldPosition(new THREE.Vector3()), tp = marbles[s.k].mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0));
      const hz = Math.hypot(wp.x - tp.x, wp.z - tp.z);
      if (wp.distanceTo(tp) < 85 && wp.y - tp.y > 6 && (wp.y - tp.y) / Math.max(1, hz) > 0.2 && visibleAll(wp, tp)) ok++;
    }
    if (ok < 3) { s.cam = 'tvreplay'; if (s.banner) s.banner = [s.banner[0], String(s.banner[1]).replace(/BLIMP( CAM)?/, 'LONG LENS')]; }
  }
}
{
  const struts = gondola.children.filter((o) => o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 2.4 && o.geometry.parameters.height === 0.09);
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) {
    if (prev) prev.apply(this, a);
    const ride = camera.parent === gondolaMount; for (const o of struts) o.visible = !ride;
    if (typeof adRideFrame === 'function') adRideFrame(ride); // AD TV r4: long-lens FOV + gondola edge
    if (view.mode === 'replay') { const sg = view.segs && view.segs[view.si]; if (sg && sg.cam === 'chase' && camera.near < 2.8) setNear(2.8); if (sg && sg.cam === 'gantry' && marbles[sg.k]) { const d = camera.position.distanceTo(marbles[sg.k].mesh.position); setNear(Math.max(0.2, Math.min(8, d - 3))); } } // gantry head-on: posts between lens and marble vanish
  };
}


// ======================================================================================================
// ---------- AD TV r4 (Art Director, 11-14): a blimp that reads as a BLIMP + podium title panel (own block) ----------
// A real blimp does not chase the pack; it parks high and far and the long lens pans. At each new aerial the blimp is placed (while
// the camera is on it, so the move is never seen) at a station ~64 u from where the pack will be mid-shot, ~47 deg down, on the side
// with a clear line of sight. It then hovers and drifts slowly (2.5 u/s) while the gondola camera pans with the pack.
// Lens: opens at 40 deg with the gondola window frame (sill + mullion, real children of the camera) in the bottom-right corner, then
// zooms to a long lens (12-24 deg) framed on the lead group; the frame leaves shot naturally as the lens tightens. Between aerials
// the blimp idles high over the infield. At least one aerial per race, never in the final 10 s. Podium: solid title panel.
var AD4 = { frameMode: (Q.get('blimpframe') || 'a').toLowerCase(), subK: -1, aim: null, aimV: null, aimInit: true, tgt: null, tgtV: null, lostT: 0, subLast: null, gond: null, env: null, blimpT0: 0, lastShotAt: -1e9, fovWant: 0, fovAt: -1e9, lastNow: 0, housing: null, lead: new THREE.Vector3(), station: null, drift: new THREE.Vector3(), stT: 0, idle: null, trophyOff: null, ltLap: 0, badT: 0 };
const AD4_D = 80, AD4_EL = 0.76;
function adBlimpWant(focus) {
  if (typeof AD4 === 'undefined' || !AD4) return null;
  const now = performance.now();
  if (AD4.station && now - AD4.lastShotAt < 1500) { const dt = Math.min(0.1, (now - AD4.stT) / 1000); AD4.stT = now; AD4.station.addScaledVector(AD4.drift, dt); return AD4.station.clone(); }
  AD4.station = null; // idle: high over the infield, leaning toward the pack (seen from the ground cams as a blimp in the sky)
  const w = center.clone().lerp(focus, 0.35); w.y = trackBox.max.y + 20;
  if (!AD4.idle) AD4.idle = w.clone(); else AD4.idle.lerp(w, 0.01); return AD4.idle.clone();
}
function adGroup(k) { // lead group around the subject (unfinished marbles within 14 u, same lap); always returns a non-empty array
  const sm = marbles[k] || marbles[0]; if (!sm) return [];
  const g = marbles.filter((m) => m && !m.finished && m.mesh.position.distanceTo(sm.mesh.position) < 14 && Math.abs((m.prog || 0) - (sm.prog || 0)) < 16);
  return g.length ? g : [sm];
}
function adBlimpPlan(k, dur = 6.5) {
  const m = marbles[k], v = m.body.linvel(), sp = THREE.MathUtils.clamp(Math.hypot(v.x, v.y, v.z), 6, 30);
  const W = [1.6, 1.4, 1.2, 1, 0.7, 0.5], pts = [0, 0.12, 0.25, 0.4, 0.6, 0.8].map((f) => pointAtS(m.pr.s + sp * dur * 0.85 * f).p.add(new THREE.Vector3(0, 0.3, 0)));
  pts[0].copy(m.mesh.position).add(new THREE.Vector3(0, 0.3, 0));
  const C = pts.slice(0, 4).reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(4); // the first ~3 s matter most
  const base = new THREE.Vector3(center.x - C.x, 0, center.z - C.z); if (base.lengthSq() < 1) base.set(1, 0, 0); base.normalize();
  let best = null; const cands = [];
  for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6, Math.PI]) for (const hz0 of [50, 60, 72]) {
    const d = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a), st = C.clone().addScaledVector(d, hz0);
    st.y = Math.max(C.y + hz0 * Math.tan(AD4_EL + 0.05), trackBox.max.y + 15);
    let sc = -Math.abs(a) * 0.3;
    pts.forEach((p, i) => { const w = W[i], hz = Math.hypot(st.x - p.x, st.z - p.z), el = Math.atan2(st.y - p.y, hz) * 57.3, dd = st.distanceTo(p);
      sc += w * (el >= 35 && el <= 55 ? 2 : el >= 30 && el <= 60 ? 0.8 : -2); if (dd > 115) sc -= w; });
    cands.push({ st, sc });
  }
  // sight lines are raycasts against the whole track (slow): test only the best-scored stations, 3 samples each, stop at the first clear one
  cands.sort((x, y) => y.sc - x.sc); best = cands[0].st;
  for (const c of cands.slice(0, 6)) if (visibleT(c.st, pts[0]) && visibleT(c.st, pts[2]) && visibleT(c.st, pts[4])) { best = c.st; break; }
  AD4.station = best; AD4.stT = performance.now();
  const ch = pts[pts.length - 1].clone().sub(pts[0]).setY(0); AD4.drift.copy(ch.lengthSq() > 1 ? ch.normalize().multiplyScalar(2.5) : ch.set(0, 0, 0));
  BL.pos.copy(best); BL.vel.set(0, 0, 0); if (blimp) { blimp.position.copy(best); blimp.updateMatrixWorld(true); }
}
// ---- AD TV r5 (11-14): the aerial HOLDS the lead group. Aim = critically damped spring on the group centroid with velocity
// feed-forward (no lag, no jitter), set every frame on the gondola camera. Lens sized so the group fills ~20% of the frame width
// (P2/P3 only join the group inside 1.5 s). If the subject is lost (respawn jump, or outside 80% of the frame for 0.25 s) the
// shot re-targets the best-placed marble still on screen; if none, it cuts (TV, after the 5 s floor) or re-parks the blimp.
// Gondola framing A/B (?blimpframe=a|b): A = soft rounded window corner overlay (bezel, livery stripe, vignette, slight blur);
// B = a sliver of the blimp envelope across the top of the opening frame. Both leave as the lens tightens.
function adBlimpGroup(k) {
  const st = standings(), sm = marbles[k] || st[0], g = [sm]; if (!sm || sm.finished) return g; const i = st.indexOf(sm);
  for (const dir of [-1, 1]) for (let d = 1; d <= 2; d++) { const o = st[i + dir * d]; if (!o || o.finished) break;
    const gs = dir < 0 ? gapSec(o, sm) : gapSec(sm, o); if (!(gs < 1.5) || Math.abs(o.prog - sm.prog) > 40 || o.mesh.position.distanceTo(sm.mesh.position) > 25) break; g.push(o); } // AD TV r5o: back to 40 / 25 u (r5n's 12 / 10 u left 1.5 s chasers outside the frame)
  return g;
}
function adBlimpShot(dt, now, fk = -1, age = null) { AD4.age = age; AD4.ageAt = now; // AD TV r5: TV shot age, for the late drift cut
  const st0 = standings(), lead = st0.find((m) => !m.finished) || st0[0];
  const fresh = camera.parent !== gondolaMount || now - AD4.lastShotAt > 1500; // 1.5 s: slow phones (4-10 fps) must not re-open the shot every frame
  if (fresh) { AD4.blimpT0 = now; AD4.badT = 0; AD4.lostT = 0; AD4.subK = fk >= 0 && marbles[fk] ? fk : lead.k; AD4.subLast = null; AD4.aimInit = true; if (view.mode === 'live') { adBlimpPlan(AD4.subK); camSnap = true; } }
  if (!marbles[AD4.subK]) AD4.subK = lead.k;
  AD4.lastShotAt = now; if (age == null) age = (now - AD4.blimpT0) / 1000;
  const wp = blimp ? (gondolaMount.updateWorldMatrix(true, false), gondolaMount.getWorldPosition(new THREE.Vector3())) : BL.pos.clone();
  let grp = adBlimpGroup(AD4.subK); if (!Array.isArray(grp) || !grp.length) grp = [marbles[AD4.subK] || lead];
  const c = new THREE.Vector3(), pv = new THREE.Vector3();
  for (const m of grp) { c.add(m.mesh.position); const v = m.body.linvel(); pv.add(new THREE.Vector3(v.x, v.y, v.z)); }
  c.divideScalar(grp.length); pv.divideScalar(grp.length); if (pv.length() > 45) pv.setLength(45);
  const smk = marbles[AD4.subK], sv = smk.body.linvel(); AD4.tgt = c.lerp(smk.mesh.position, 0.7).add(new THREE.Vector3(0, 0.3, 0)); AD4.tgtV = pv.lerp(new THREE.Vector3(sv.x, sv.y, sv.z), 0.7); if (AD4.tgtV.length() > 45) AD4.tgtV.setLength(45); // subject-weighted
  let ext = 0; for (const a of grp) for (const b of grp) ext = Math.max(ext, a.mesh.position.distanceTo(b.mesh.position));
  ext = Math.max(4, Math.min(14, ext + 1)); // group extent incl. one marble diameter; 3.5 u floor so a lone marble + its tag still reads
  const dist = Math.max(1, wp.distanceTo(AD4.tgt));
  if (AD4.station && view.mode === 'live') { // pilot holds ~45 deg down (<= 14 u/s)
    const away = new THREE.Vector3(wp.x - AD4.tgt.x, 0, wp.z - AD4.tgt.z), hz = away.length(); if (hz > 0.1) away.divideScalar(hz); else away.set(1, 0, 0);
    const want = (wp.y - AD4.tgt.y) / Math.tan(0.785), sp = THREE.MathUtils.clamp((want - hz) * 0.9, -14, 14);
    AD4.drift.lerp(away.multiplyScalar(sp), Math.min(1, dt * 2));
  }
  const asp = Math.max(0.3, camera.aspect), hTight = 2 * Math.atan(ext / 0.23 / 2 / dist); // group ~ 20% of the frame width (measured incl. spacing)
  const vTight = THREE.MathUtils.clamp(Math.max(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hTight / 2) / asp)), THREE.MathUtils.radToDeg(2 * Math.atan(ext / 0.4 / 2 / dist))), 7, 40); // and <= 40% of the frame height; never under 7 deg (tracking margin)
  const vOpen = asp >= 1 ? 40 : Math.min(72, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) / asp)));
  AD4.fovWant = THREE.MathUtils.lerp(vOpen, Math.min(vOpen, vTight), THREE.MathUtils.smoothstep(age, 1.2, 3.6)); AD4.openFov = vOpen; AD4.fovAt = now;
  if (view.mode === 'live' && camMode === 1 && age > 7) { // Blimp button: re-park (a cut) only when the pack leaves the blimp's good view
    const hz = Math.hypot(wp.x - AD4.tgt.x, wp.z - AD4.tgt.z), el = Math.atan2(wp.y - AD4.tgt.y, hz) * 57.3;
    AD4.badT = (el < 30 || el > 66 || dist > 110) ? AD4.badT + dt : 0;
    if (AD4.badT > 0.6) { adBlimpPlan(AD4.subK); AD4.blimpT0 = now; AD4.badT = 0; AD4.aimInit = true; camSnap = true; }
  }
  shotName = 'BLIMP \u00b7 AERIAL';
  return { gondola: !!blimp, pos: wp, look: AD4.aim ? AD4.aim.clone() : AD4.tgt.clone(), fov: AD4.fovWant };
}
const _ad5M = new THREE.Matrix4(), _ad5Q = new THREE.Quaternion(), _ad5P = new THREE.Quaternion(), _ad5Up = new THREE.Vector3(0, 1, 0);
function adSoftRetarget() { if (typeof tv6Lock === 'function' && tv6Lock()) return false; // AD TV r6: a followed marble keeps the shot
  // subject drifting off-centre: hand the shot to the marble nearest the centre (inside the middle 45%), at most every 1.5 s
  const now = performance.now(); if (now - (AD4.softAt || 0) < 1500) return false; let pick = null, bd = 0.35;
  for (const m of marbles) { if (m.finished || m.k === AD4.subK) continue; const n = m.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)).project(camera); const d = Math.max(Math.abs(n.x), Math.abs(n.y)); if (n.z < 1 && d < bd) { bd = d; pick = m; } }
  if (!pick) return false; AD4.softAt = now; AD4.subK = pick.k; AD4.subLast = null; AD4.retargets = (AD4.retargets || 0) + 1;
  const sh = view.mode === 'live' && camMode === 0 && TV5.shot && TV5.shot.type === 'blimp' ? TV5.shot : null;
  if (sh) { sh.k = pick.k; sh.k2 = -1; sh.ltRefresh = true; try { tv5LowerThird(sh); } catch (e) {} finally { sh.ltRefresh = false; } } return true;
}
function adRetarget(why) { if (typeof tv6Lock === 'function' && tv6Lock()) return tv6Replan(); // AD TV r6: re-park on the followed marble
 
  const live = view.mode === 'live', sh = live && camMode === 0 && TV5.shot && TV5.shot.type === 'blimp' ? TV5.shot : null;
  const st = standings(); let pick = null;
  for (const m of st) { if (m.finished || m.k === AD4.subK) continue; const n = m.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)).project(camera); if (n.z < 1 && Math.abs(n.x) < 0.7 && Math.abs(n.y) < 0.7) { pick = m; break; } }
  if (pick) { AD4.subK = pick.k; AD4.subLast = null; } // smooth pan onto the next group already in frame
  else if (sh && performance.now() / 1000 - sh.t0 >= TV_MIN_HOLD) { sh.dur = 0; return; } // nothing left in frame: let the director cut (never hold empty track)
  else { const ld = st.find((m) => !m.finished) || st[0]; AD4.subK = ld.k; AD4.subLast = null; if (live) { adBlimpPlan(ld.k); AD4.aimInit = true; camSnap = true; } }
  AD4.retargets = (AD4.retargets || 0) + 1;
  if (sh) { sh.k = AD4.subK; sh.k2 = -1; sh.ltRefresh = true; try { tv5LowerThird(sh); } catch (e) {} finally { sh.ltRefresh = false; } }
}
function adAim(dt) { // critically damped spring (omega 12) on the subject-weighted group centre, + velocity feed-forward 2v/omega = zero steady-state lag (small lead, so hairpins stay framed)
  if (!AD4.tgt) return; const W = 12;
  if (AD4.aimInit || !AD4.aim) { AD4.aim = AD4.tgt.clone(); AD4.aimV = AD4.tgtV.clone(); AD4.aimInit = false; }
  const goal = AD4.tgt.clone().addScaledVector(AD4.tgtV, 2 / W + dt), /* + one frame of travel: on 10 fps phones the marble moves ~3 u between aim and render */ n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
  for (let k = 0; k < n; k++) { const a = goal.clone().sub(AD4.aim).multiplyScalar(W * W).addScaledVector(AD4.aimV, -2 * W); AD4.aimV.addScaledVector(a, h); AD4.aim.addScaledVector(AD4.aimV, h); }
  adAimApply();
}
function adAimApply() { // AD TV r5: point the gondola camera at AD4.aim
  gondolaMount.updateWorldMatrix(true, false); const wp = gondolaMount.getWorldPosition(new THREE.Vector3());
  _ad5M.lookAt(wp, AD4.aim, _ad5Up); _ad5Q.setFromRotationMatrix(_ad5M); gondolaMount.getWorldQuaternion(_ad5P);
  camera.quaternion.copy(_ad5P.invert().multiply(_ad5Q)); camera.updateMatrixWorld(true);
}
function adRideFrame(ride) {
  const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - AD4.lastNow) / 1000)); AD4.lastNow = now;
  const live = ride && now - AD4.fovAt < 1500;
  if (live) {
    const first = now - AD4.blimpT0 < 40; const f = first ? AD4.fovWant : camera.fov + (AD4.fovWant - camera.fov) * Math.min(1, dt * 2); if (Math.abs(f - camera.fov) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
    adAim(dt);
    const sm = marbles[AD4.subK];
    if (sm) { const p = sm.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), jump = AD4.subLast && p.distanceTo(AD4.subLast) > 6; AD4.subLast = p.clone();
      const n = p.project(camera), off = n.z > 1 || Math.abs(n.x) > 0.8 || Math.abs(n.y) > 0.8 || sm.finished;
      const soft = !off && (Math.abs(n.x) > 0.45 || Math.abs(n.y) > 0.45);
      const ex = Math.max(Math.abs(n.x), Math.abs(n.y)) - 0.35; if (!off && ex > 0 && AD4.aim) { AD4.aim.lerp(sm.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), Math.min(0.5, ex * 20 * dt)); adAimApply(); } // AD TV r5: proportional catch-up when the subject drifts past 0.35 NDC (continuous, so no jitter)
      { const sh5 = TV5.shot; if (sh5 && ex > 0.15 && AD4.age != null && AD4.age + (now - AD4.ageAt) / 1000 >= TV_MIN_HOLD) sh5.dur = 0; } // AD TV r5: late in the hold and drifting toward the 60% edge: let the director cut rather than lose the frame
      AD4.softT = soft ? (AD4.softT || 0) + dt : 0; if (AD4.softT > 0.06) { AD4.softT = 0; adSoftRetarget(); }
      AD4.lostT = off ? (AD4.lostT || 0) + dt : 0;
      if (jump || AD4.lostT > 0.05) { AD4.lostT = 0; adRetarget(jump ? 'respawn' : 'off'); } }
  }
  adFrameFX(live);
  { const f = live ? THREE.MathUtils.clamp(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(20)), 0.25, 1) : 1; // AD TV r5p: player tags are sizeAttenuation:false, so they grow 5x on the long lens; hold them near normal size
    for (const t of tags) if (Math.abs(t.sp.scale.x - 0.13 * f) > 1e-4) t.sp.scale.set(0.13 * f, 0.037 * f, 1); }
}
function adFrameFX(live) { // gondola framing A/B
  const of = AD4.openFov || 40, s = live ? Math.tan(THREE.MathUtils.degToRad(of / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) : 9;
  if (AD4.frameMode === 'b') {
    if (!AD4.env && blimp) { let best = null, br = 0; blimp.traverse((o) => { if (!o.isMesh || gondola === o || gondola.getObjectById(o.id)) return; o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius; if (r > br) { br = r; best = o; } });
      const mat = best ? best.material : new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.5 });
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), Array.isArray(mat) ? mat[0] : mat); e.name = 'FX_dh_blimp_envelope_sliver'; e.visible = false; camera.add(e); AD4.env = e; }
    const e = AD4.env; if (!e) return; e.visible = live && s < 1.6;
    if (e.visible) { const z = 7, top = z * Math.tan(THREE.MathUtils.degToRad(of / 2)), R = 3.2; e.scale.set(R * 2.8, R, R); e.position.set(0.15 * top * camera.aspect, top + R - 0.13 * 2 * top, -z); e.rotation.set(0.12, 0, 0.04); }
    return;
  }
  if (!AD4.gond) { const d = document.createElement('div'); d.id = 'adGondola'; d.innerHTML = '<div class="win"></div><div class="rim"></div><div class="vig"></div>'; renderer.domElement.after(d); AD4.gond = d; }
  const on = live && s < 1.8; AD4.gond.classList.toggle('on', on);
  if (on) AD4.gond.style.transform = 'scale(' + Math.max(1, s).toFixed(3) + ')';
}
function tv5BlimpDue(sub, ts) { // at least one aerial per race; the whole shot (<= 7.5 s) ends before the final 10 s
  if (!blimp || TV5.blimpDone || race.phase !== 'race' || race.t < 5) return false;
  const ld = standings()[0]; if (ld.finished) return false;
  return tv5EstToFlag(ld.k) > 18; // the blimp re-parks for its shot (adBlimpPlan), so its idle position does not matter
}
function adTrophyOff() {
  if (AD4.trophyOff) return AD4.trophyOff;
  const t = T[podIdx].clone().setY(0).normalize(), n = NRM[podIdx].clone().setY(0).normalize();
  const toCam = celebCamPos(CELEB.camA ?? 0, 9).sub(podTops[0]).setY(0); const fs = Math.sign(toCam.dot(t)) || 1;
  const side = podTops[1] ? (-Math.sign(podTops[1].clone().sub(podTops[0]).dot(n)) || 1) : 1;
  AD4.trophyOff = t.multiplyScalar(-0.36 * fs).add(n.multiplyScalar(0.72 * side)); return AD4.trophyOff; // beside the winner and a touch behind, so it never covers the crowned marble
}
new MutationObserver(() => { // lower-third lap re-written in the same task the HUD lap text changes (microtask), so the two can never disagree
  if (!TV5.ui || !TV5.shot || view.mode !== 'live') return; TV5.shot.ltRefresh = true; try { tv5LowerThird(TV5.shot); } catch (e) {} finally { TV5.shot.ltRefresh = false; }
}).observe($('lap'), { childList: true, characterData: true, subtree: true });
setInterval(() => { // live lower-third: gaps and the lap refresh while it is on screen (no re-slide)
  if (!TV5.ui || !TV5.shot || view.mode !== 'live' || !TV5.ui.lt.classList.contains('on')) return;
  TV5.shot.ltRefresh = true; try { tv5LowerThird(TV5.shot); } finally { TV5.shot.ltRefresh = false; }
}, 250);
{ // AD TV r5 (11-14): calm the painted far-ground ring (LP3_bg_far_ground). Seen from the high blimp through a long lens its fine purple
  // speckle shimmered as the camera moved. Trilinear mips + anisotropy and a +1.5 mip bias on that one map: the speckle blurs out,
  // the soft city-light glow stays. Only this mesh; the horizon silhouette ring is untouched.
  const calm = []; world3d.traverse((o) => { if (o.isMesh && /^LP3_bg_far_ground/.test(o.name)) calm.push(o); });
  for (const o of calm) { const m = o.material; if (!m || !m.map) continue;
    m.map.generateMipmaps = true; m.map.minFilter = THREE.LinearMipmapLinearFilter; m.map.magFilter = THREE.LinearFilter; m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); m.map.needsUpdate = true;
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', 'vec2 adTs = 1.25 / vec2( textureSize( map, 0 ) ); vec4 sampledDiffuseColor = vec4( 0.0 ); for ( int ax = -1; ax <= 1; ax ++ ) for ( int ay = -1; ay <= 1; ay ++ ) { float w = ( ax == 0 ? 2.0 : 1.0 ) * ( ay == 0 ? 2.0 : 1.0 ); sampledDiffuseColor += w * texture2D( map, vMapUv + vec2( float( ax ), float( ay ) ) * adTs, 1.0 ); } sampledDiffuseColor /= 16.0;')); }; // 3x3 gaussian texel-space blur + mip bias: kills the speckle at any lens, keeps the soft glow
    m.customProgramCacheKey = () => 'ad5calm3'; m.needsUpdate = true; }
}
{ const css = document.createElement('style'); css.id = 'ad4css';
  css.textContent = '#adGondola{position:absolute;inset:0;pointer-events:none;overflow:hidden;display:none;transform-origin:42% 40%;will-change:transform}#adGondola.on{display:block;animation:adGIn .3s ease-out}@keyframes adGIn{from{opacity:0}to{opacity:1}}'
    + '#adGondola .win{position:absolute;left:-14%;top:-14%;right:4.5%;bottom:12%;border-radius:0 0 8vmin 0;box-shadow:0 0 5px 100vmax #18121f,inset -1vmin -1vmin 3.5vmin rgba(0,0,0,.55)}'
    + '#adGondola .win:after{content:"";position:absolute;left:-2vmin;right:7vmin;bottom:-2.6vmin;height:.8vmin;background:#d7192d;border-radius:.4vmin;box-shadow:0 0 3px #d7192d}'
    + '#adGondola .rim{position:absolute;left:-14%;top:-14%;right:4.5%;bottom:12%;border-radius:0 0 8vmin 0;border-right:.45vmin solid rgba(255,255,255,.14);border-bottom:.45vmin solid rgba(255,255,255,.12);box-shadow:inset -2px -2px 4px rgba(255,255,255,.06)}'
    + '#adGondola .vig{position:absolute;inset:0;background:radial-gradient(ellipse 80% 78% at 42% 40%,transparent 58%,rgba(10,5,16,.5) 100%)}'
    + 'body #tv5lt{left:max(5vw,env(safe-area-inset-left));max-width:90vw;transform:translateX(-14px);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.2,1),opacity .3s}body #tv5lt.on{transform:none;opacity:1}'
    + 'body #tv5lt .bd{min-width:0;flex:0 1 auto}body #tv5lt .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body #tv5lt .wm{flex:0 0 auto}@media (max-width:600px){body #tv5lt .wm{display:none}body #tv5lt .sub{font-size:10px;letter-spacing:1px}}'
    + 'body #tv5tag{max-width:90vw;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + 'body #celebPod .top{left:50%;right:auto;transform:translateX(-50%);width:min(760px,90vw);box-sizing:border-box;padding:10px 14px 12px;background:linear-gradient(180deg,rgba(12,7,20,.97),rgba(24,12,36,.95));border-top:4px solid #e0102f;border-bottom:4px solid #e0102f;box-shadow:0 12px 34px rgba(0,0,0,.55),4px 4px 0 #000}'
    + 'body #celebPod .top .ribbon{box-shadow:none}body #celebPod .top .nm{text-shadow:0 0 12px rgba(255,179,0,.5),3px 3px 0 #000}body #celebPod .top .clist span{background:rgba(255,255,255,.08)}';
  document.head.appendChild(css); }

// ---------- AD TV r6 (Art Director, 11-14, Jarod after playing on Klaude: "the close cams clip through the map on the conveyor, I'm
// staring at the bottom of the racetrack", "from everywhere but the blimp they go a million miles a minute", "when I tried to track the
// second player it only tracked me") ----------
// (a) Chase / Front are broadcast follow cams now: longer lens, ~13 u off the marble, heading eased (no whip pans at hairpins), the
//     framing offset rides a critically damped spring RELATIVE to the marble (smooth, no travel lag), the look leads the direction of
//     travel. On the chain lift both swing to a high side angle outside the lift housing.
// (b) Collision-aware placement, every frame, on the final lens position: never inside a scenery box, under/inside a deck, within 0.6 u
//     of a surface, or with scenery/deck/rails/lift housing between lens and marble (raycasts). On a fail: pull in along the sight line,
//     raise, swing side-high, overhead, then close-in; first clean candidate wins. TV shots get the same guard (inside / near / under-a-deck-
//     with-no-sight) on their smoothed lens.
// (c) Follow: player buttons, leaderboard rows and keys 1-4 (players), 0 (race director), [ / ] (prev / next marble by position) now retarget
//     every camera at once: a TV shot in progress re-cuts, the blimp aerial re-plans onto the marble and no longer hands off to whoever is in
//     frame while a marble is followed.
// (d) Readability (TV director): tracking dolly wider and higher with a longer lens, rail cam off the rail, no rail-level / mast stations
//     unless nothing else is clean, half the drop shake, no early cut before 4 s at the finish window.
// ?tv6=0 = r5 behaviour. Probe for the harness: __dh.tv6.
const TV6 = { on: Q.get('tv6') !== '0', last: 0, k: -1, mode: '', off: null, offV: new THREE.Vector3(), lo: null, loV: new THREE.Vector3(), ha: 0, prevP: null, vel: new THREE.Vector3(), liftW: 0, side: 0, follow: undefined, fixes: 0, guards: 0, planAt: 0 };
const tv6Occ = (() => { const a = occluders.concat(trackOcc); const lb = LIFT ? new THREE.Box3().setFromPoints(Array.from({ length: 24 }, (_, j) => pointAtS(LIFT.s0 - 4 + (LIFT.s1 - LIFT.s0 + 8) * j / 23).p)).expandByScalar(5) : null;
  if (lb) for (const o of scene.children) if (o.isMesh && /Box|Cylinder/.test(o.geometry?.type || '') && lb.containsPoint(o.position)) a.push(o); // lift housing cheeks + drums (scene-level, not in the glb lists)
  return a; })();
const tv6R = new THREE.Raycaster(), tv6Dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => new THREE.Vector3(...d));
function tv6Under(p) { // lens under (or inside) any deck: a centerline sample within its half-width + 1 u horizontally, from 1 u below to 40 u above the lens
  for (let j = 0; j < N; j++) { const q = P[j], dy = q.y - p.y; if (dy < -1.0 || dy > 40) continue; const dx = q.x - p.x, dz = q.z - p.z, r = HW[j] + 1.0; if (dx * dx + dz * dz < r * r) return true; }
  return false;
}
function tv6Near(p, r = 0.6) { for (const d of tv6Dirs) { tv6R.set(p, d); tv6R.far = r; if (tv6R.intersectObjects(tv6Occ, false).length) return true; } return false; }
function tv6Sight(a, b) { const d = b.clone().sub(a), len = d.length(); if (len < 0.8) return true; d.divideScalar(len);
  tv6R.set(a, d); tv6R.far = len - 0.5; if (tv6R.intersectObjects(tv6Occ, false).length) return false;
  tv6R.set(b, d.clone().negate()); tv6R.far = len - 0.05; return tv6R.intersectObjects(tv6Occ, false).length === 0; }
function tv6Bad(pos, tgt, close = true) { // close cams: any of the four; TV: inside / near / under a deck with the marble hidden
  if (insideAny(pos) || tv6Near(pos)) return true;
  if (close) return tv6Under(pos) || !tv6Sight(pos, tgt);
  return tv6Under(pos) && !tv6Sight(pos, tgt);
}
function tv6Resolve(p, tgt, off, head, i) { // relative offsets, first clean wins
  const c = [], len = off.length(), d = off.clone().divideScalar(len || 1);
  tv6R.set(tgt, d); tv6R.far = len + 0.6; const h = tv6R.intersectObjects(tv6Occ, false)[0];
  if (h) c.push(d.clone().multiplyScalar(Math.max(2.2, h.distance - 1.0)).add(new THREE.Vector3(0, 0.3, 0)), d.clone().multiplyScalar(Math.max(2.2, h.distance - 1.0)).add(new THREE.Vector3(0, 2.2, 0)));
  c.push(off.clone().add(new THREE.Vector3(0, 3, 0)), off.clone().add(new THREE.Vector3(0, 6, 0)));
  for (const sd of [1, -1]) c.push(NRM[i].clone().multiplyScalar(sd * (HW[i] + 5)).addScaledVector(head, -2).add(new THREE.Vector3(0, 6, 0)));
  c.push(head.clone().multiplyScalar(-2).add(new THREE.Vector3(0, 9, 0)), head.clone().multiplyScalar(-6).add(new THREE.Vector3(0, 4, 0)), head.clone().multiplyScalar(-2.6).add(new THREE.Vector3(0, 1.7, 0)), off.clone().multiplyScalar(0.3));
  for (const o of c) if (!tv6Bad(p.clone().add(o), tgt)) return o;
  return c[c.length - 2];
}
function tv6Spring(x, v, goal, W, dt) { const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n; for (let k = 0; k < n; k++) { const a = goal.clone().sub(x).multiplyScalar(W * W).addScaledVector(v, -2 * W); v.addScaledVector(a, h); x.addScaledVector(v, h); } }
function tv6Close(k, kind) { // Chase ('chase') and Front ('front'), live and replay
  const now = performance.now(), dt = THREE.MathUtils.clamp((now - (TV6.last || now - 16)) / 1000, 0.001, 0.1); TV6.last = now;
  const m = marbles[k], S0 = subject(k), p = m.mesh.position, i = S0.pr.i, tgt = p.clone().add(new THREE.Vector3(0, 0.3, 0));
  const fresh = TV6.k !== k || TV6.mode !== kind || camSnap || !TV6.off; TV6.k = k; TV6.mode = kind;
  if (fresh || !TV6.prevP) { TV6.prevP = p.clone(); const lv = m.body.linvel(); TV6.vel.set(lv.x, lv.y, lv.z); }
  else { const v = p.clone().sub(TV6.prevP).divideScalar(dt); TV6.prevP.copy(p); if (v.length() < 300) TV6.vel.lerp(v, 1 - Math.exp(-dt * 6)); else TV6.vel.set(0, 0, 0); } // respawn jump: drop the lead
  const th = new THREE.Vector3(S0.pr.tan.x, 0, S0.pr.tan.z).normalize(), hv = new THREE.Vector3(TV6.vel.x, 0, TV6.vel.z);
  const wantA = Math.atan2(...(hv.length() > 4 && hv.clone().normalize().dot(th) > -0.2 ? [hv.z, hv.x] : [th.z, th.x]));
  if (fresh) TV6.ha = wantA; else { let dA = wantA - TV6.ha; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI; TV6.ha += dA * (1 - Math.exp(-dt * 2.0)); } // eased heading: hairpins become a pan, not a whip
  const head = new THREE.Vector3(Math.cos(TV6.ha), 0, Math.sin(TV6.ha));
  const onLift = LIFT && ((S0.pr.s - (LIFT.s0 - 6)) % L + L) % L < LIFT.s1 - LIFT.s0 + 9;
  TV6.liftW += ((onLift ? 1 : 0) - TV6.liftW) * (fresh ? 1 : 1 - Math.exp(-dt * 2.2)); const w = TV6.liftW * TV6.liftW * (3 - 2 * TV6.liftW);
  if (onLift && !TV6.side) { const toC = center.clone().sub(p).setY(0); TV6.side = NRM[i].dot(toC) > 0 ? -1 : 1; // outside of the loop first
    const lo = (sd) => NRM[i].clone().multiplyScalar(sd * (HW[i] + 6)).add(new THREE.Vector3(0, 6.5, 0)); if (tv6Bad(p.clone().add(lo(TV6.side)), tgt) && !tv6Bad(p.clone().add(lo(-TV6.side)), tgt)) TV6.side = -TV6.side; }
  if (!onLift && w < 0.02) TV6.side = 0;
  const sd = TV6.side || 1, chase = kind === 'chase';
  const nOff = chase ? head.clone().multiplyScalar(-13).add(new THREE.Vector3(0, 5.2, 0)) : head.clone().multiplyScalar(12).addScaledVector(NRM[i], 1.6).add(new THREE.Vector3(0, 3.8, 0));
  const lOff = NRM[i].clone().multiplyScalar(sd * (HW[i] + 6)).addScaledVector(th, chase ? -3 : 5).add(new THREE.Vector3(0, 6.5, 0));
  const goal = nOff.lerp(lOff, w);
  const lead = TV6.vel.clone(); if (lead.length() > 60) lead.setLength(60);
  const lGoal = chase ? head.clone().multiplyScalar(4).addScaledVector(lead, 0.1).add(new THREE.Vector3(0, 0.2, 0)) : head.clone().multiplyScalar(-1.5).addScaledVector(lead, 0.05).add(new THREE.Vector3(0, 0.3, 0));
  lGoal.lerp(th.clone().multiplyScalar(chase ? 3 : 1).addScaledVector(lead, 0.06).add(new THREE.Vector3(0, 0.3, 0)), w);
  if (fresh) { TV6.off = goal.clone(); TV6.offV.set(0, 0, 0); TV6.lo = lGoal.clone(); TV6.loV.set(0, 0, 0); }
  else { tv6Spring(TV6.off, TV6.offV, goal, 3.2, dt); tv6Spring(TV6.lo, TV6.loV, lGoal, 4.5, dt); }
  let pos = p.clone().add(TV6.off);
  if (tv6Bad(pos, tgt)) { const o = tv6Resolve(p, tgt, TV6.off, head, i); TV6.off.copy(o); TV6.offV.multiplyScalar(0); pos = p.clone().add(o); TV6.fixes++; }
  shotName = (chase ? 'CHASE · ' : 'FRONT · ') + m.name.toUpperCase() + (w > 0.5 ? ' · LIFT SIDE' : '');
  return { pos, look: p.clone().add(TV6.lo), fov: THREE.MathUtils.lerp(chase ? 40 : 42, 46, w), kPos: 99, kLook: 99, kFov: 2.5 };
}
function tv6Guard(cp, tgt, sh) { // TV safety net on the smoothed lens: returns a replacement or null
  if (!tv6Bad(cp, tgt, false)) return null;
  for (const o of [[0, 2, 0], [0, 4, 0], [0, 7, 0]]) { const q = cp.clone().add(new THREE.Vector3(...o)); if (!tv6Bad(q, tgt, false)) { TV6.guards++; return q; } }
  for (const f of [0.75, 0.5, 0.3]) { const q = tgt.clone().lerp(cp, f).add(new THREE.Vector3(0, 1, 0)); if (!tv6Bad(q, tgt, false)) { TV6.guards++; sh.blocked = 9; return q; } } // and let the director cut
  sh.blocked = 9; TV6.guards++; return tgt.clone().add(new THREE.Vector3(0, 8, 0));
}
const tv6Lock = () => TV6.on && view.mode === 'live' && follow >= 0 && marbles[follow] && !marbles[follow].finished;
function tv6Watch() { // per live frame (hook at the top of liveCamera)
  if (!TV6.on) return;
  if (TV6.follow !== follow) { const was = TV6.follow; TV6.follow = follow;
    if (was !== undefined) { camSnap = true; dir.shot = null;
      if (TV5.shot && !(TV5.shot.type === 'finish' && follow < 0)) { TV5.shot = null; TV5.lastCut = -1e9; TV5.snap = true; } // TV: re-cut now onto the new subject
      if (follow >= 0 && marbles[follow]) { AD4.subK = follow; AD4.subLast = null; if (camMode === 1 && camera.parent === gondolaMount) { adBlimpPlan(follow); AD4.aimInit = true; AD4.blimpT0 = performance.now(); } }
      try { renderBoard(); renderCamBtns(); } catch (e) {} } }
  if (tv6Lock() && AD4.subK !== follow) { AD4.subK = follow; AD4.subLast = null; const sh = TV5.shot; if (sh && sh.type === 'blimp' && camMode === 0) { sh.k = follow; sh.k2 = -1; } }
}
function tv6Replan() { const now = performance.now(); if (now - TV6.planAt > 1500 && view.mode === 'live') { TV6.planAt = now; adBlimpPlan(follow); AD4.aimInit = true; camSnap = true; } }
addEventListener('keydown', (e) => { // 1-4 = player 1-4, 0 = race director, [ / ] = previous / next marble by race position
  if (!TV6.on || /INPUT|TEXTAREA/.test(e.target?.tagName || '')) return; let k = null;
  if (/^[1-4]$/.test(e.key)) { const p = session.players[+e.key - 1]; if (p) k = p.k; } else if (e.key === '0') k = -1;
  else if (e.key === '[' || e.key === ']') { const st = standings(); const i = st.findIndex((m) => m.k === follow); k = st[((i < 0 ? 0 : i + (e.key === ']' ? 1 : -1)) + st.length) % st.length].k; }
  if (k === null) return; follow = k; dir.shot = null; camSnap = true; renderCamBtns(); renderBoard();
});
// ---- probe (harness only): on-screen speed per camera and a per-frame clip scan of the live lens ----
const TV6P = { on: false, vp: null, sub: null, cp: null, cut: 0, agg: {}, clip: {}, frames: 0 };
function tv6Label() { if (view.mode !== 'live') return 'REPLAY'; if (camMode === 1) return 'BLIMP'; if (camMode === 2) return 'CHASE'; if (camMode === 3) return 'FRONT'; const sh = TV5.shot; return sh ? 'TV:' + (sh.type === 'station' ? sh.st.type : sh.type) : 'TV'; }
function tv6SubK() { if (camMode === 0 && TV5.shot) return TV5.shot.k; if (camMode === 1) return AD4.subK ?? (follow >= 0 ? follow : standings()[0].k); return follow >= 0 ? follow : standings()[0].k; }
function tv6Probe() {
  if (!TV6P.on || race.phase !== 'race' || view.mode !== 'live') { TV6P.vp = null; return; }
  camera.updateMatrixWorld(true); const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), cw = camera.getWorldPosition(new THREE.Vector3());
  const k = tv6SubK(), m = marbles[k], lab = tv6Label(), now = performance.now(), asp = camera.aspect; TV6P.frames++;
  const ndc = (w, M) => { const v = new THREE.Vector4(w.x, w.y, w.z, 1).applyMatrix4(M); return v.w > 0.1 ? [v.x / v.w, v.y / v.w] : null; };
  const cutNow = TV6P.lastCut !== TV5.lastCut || TV6P.lab !== lab || TV6P.k !== k || (TV6P.cp && TV6P.cp.distanceTo(cw) > 10); TV6P.lastCut = TV5.lastCut; TV6P.lab = lab; TV6P.k = k;
  if (cutNow) TV6P.cut = now;
  if (TV6P.vp && now - TV6P.cut > 250 && TV6P.dt > 0) { const dt = (now - TV6P.t) / 1000;
    const flows = []; for (let ds = -10; ds <= 40; ds += 2.5) { const w = pointAtS(m.pr.s + ds).p.add(new THREE.Vector3(0, 0.2, 0)); const a = ndc(w, vp), b = ndc(w, TV6P.vp); if (a && b && Math.abs(a[0]) < 1 && Math.abs(a[1]) < 1 && Math.abs(b[0]) < 1 && Math.abs(b[1]) < 1) flows.push(Math.hypot((a[0] - b[0]) / 2, (a[1] - b[1]) / 2 / asp) / dt); }
    const a = ndc(m.mesh.position, vp), b = TV6P.sub ? ndc(TV6P.sub, TV6P.vp) : null;
    if (flows.length >= 3 && a && b && dt > 0.004 && dt < 0.1) { flows.sort((x, y) => x - y); const g = TV6P.agg[lab] || (TV6P.agg[lab] = { world: [], subj: [], ang: [] }); if (g.world.length < 20000) { g.world.push(flows[flows.length >> 1]); g.subj.push(Math.hypot((a[0] - b[0]) / 2, (a[1] - b[1]) / 2 / asp) / dt);
      const d0 = TV6P.dir, d1 = camera.getWorldDirection(new THREE.Vector3()); g.ang.push(d0 ? d0.angleTo(d1) * 57.3 / dt : 0); } }
  }
  TV6P.dir = camera.getWorldDirection(new THREE.Vector3());
  { const close = lab === 'CHASE' || lab === 'FRONT', tgt = m.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)); const c = TV6P.clip[lab] || (TV6P.clip[lab] = { n: 0, inside: 0, under: 0, near: 0, blocked: 0, underBlind: 0, bad: [] });
    c.n++; const ins = insideAny(cw), und = tv6Under(cw), nr = tv6Near(cw), sg = tv6Sight(cw, tgt); if (ins) c.inside++; if (und) c.under++; if (nr) c.near++; if (!sg) c.blocked++; if (und && !sg) c.underBlind++;
    if ((close && (ins || und || nr || !sg) || (!close && (ins || nr || (und && !sg)))) && c.bad.length < 40) c.bad.push({ t: +race.t.toFixed(2), piece: pieceAt(m.pr.s), ins, und, nr, sg, cam: cw.toArray().map((x) => +x.toFixed(1)) }); }
  TV6P.vp = vp; TV6P.sub = m.mesh.position.clone(); TV6P.cp = cw; TV6P.t = now; TV6P.dt = 1;
}
{ const prev = scene.onBeforeRender; scene.onBeforeRender = function (...a) { if (prev) prev.apply(this, a); try { tv6Probe(); } catch (e) { console.warn('[tv6 probe]', e.message); } }; }
window.__dh.tv6 = { probe: (on = true) => { TV6P.on = on; TV6P.vp = null; }, reset: () => { TV6P.agg = {}; TV6P.clip = {}; TV6P.frames = 0; }, raw: () => TV6P,
  report: () => { const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? +a[a.length >> 1].toFixed(3) : null; }, p90 = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length * 0.9)].toFixed(3) : null; };
    const speed = {}; for (const [k, g] of Object.entries(TV6P.agg)) speed[k] = { n: g.world.length, world: med(g.world), world90: p90(g.world), subj: med(g.subj), subj90: p90(g.subj), ang: med(g.ang), ang90: p90(g.ang) };
    return { speed, clip: TV6P.clip, frames: TV6P.frames, fixes: TV6.fixes, guards: TV6.guards, on: TV6.on }; },
  follow: () => ({ follow, camMode, tv: TV5.shot && TV5.shot.k, blimp: AD4.subK, tvType: TV5.shot && TV5.shot.type, shot: shotName }),
  ndcOf: (k) => { const v = marbles[k].mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)).project(camera); return [+v.x.toFixed(2), +v.y.toFixed(2), v.z < 1]; },
  centerK: () => { let b = -1, bd = 9; for (const m of marbles) { const v = m.mesh.position.clone().project(camera); const d = Math.hypot(v.x, v.y); if (v.z < 1 && d < bd) { bd = d; b = m.k; } } return b; },
  occCount: () => tv6Occ.length };
// ---------- /AD TV r6 ----------
import('./net.js').catch((e) => console.warn('[party] phone controllers unavailable', e)); // Claude T-034: phone controllers (host side)
