// Art Director · living town (critic pass 1, 11-14). Animates the VIGA_* vignettes baked into osaka_world.glb by
// blender/ad_critic_pass.py (fishers, sellers, shoppers, diners, rikishi, gyoji, yakitori smoke), swims koi in the
// shrine pond and small fish in the canal (kept inside the water with margins, under the surface, turning smoothly),
// and merges the static VIG_* dressing by material so the town costs a handful of draw calls on phones.
// Mobile-light: one InstancedMesh per fish kind, a few sprites, simple sin loops. No physics, no colliders.
import { mergeGeometries } from './vendor/jsm/utils/BufferGeometryUtils.js';
import { initDohyo } from './ad_dohyo.js'; // AD pass 6 (11-14): tsuriyane hanging roof, fusa, masu-seki spectators
import { initTown2 } from './ad_town2.js'; // AD critic pass 2 (11-14): castle, blimp kit, canal infill + chochin, taiyaki yatai

export function initTown({ THREE, scene, world3d, isMobile = false }) {
  const noRay = () => {};
  let facadeStats = null, grassStats = null;
  const byName = (n) => world3d.getObjectByName(n);
  // Round 2: no idle townsfolk left. Costume pieces move with their owner; no collider/racing object touched.
  world3d.updateMatrixWorld(true);
  const attach = (owner, prop) => { const o = byName(owner), p = byName(prop); if (o && p && p.parent !== o) { o.attach(p); p.matrixAutoUpdate = true; } };
  for (let k = 0; k < 2; k++) attach('CROWD_announcer_' + k, 'CROWD_announcer_headset_' + k);
  for (let k = 0; k < 4; k++) { attach('CROWD_marshal_' + k, 'CROWD_marshal_band_' + k); attach('CROWD_marshal_' + k, 'CROWD_marshal_cap_' + k); }
  attach('PROP_sushi_marble_dh10_homie_crest', 'PROP_sushi_chef_hachimaki');
  adUnsinkAnnouncers(); // the two commentators were 1u deep inside the booth floor slab (only their crowns showed): seat them on it
  function adUnsinkAnnouncers() {
    const fl = byName('CROWD_announcer_booth_2'); if (!fl) return; const top = new THREE.Box3().setFromObject(fl).max.y;
    for (let k = 0; k < 2; k++) { const o = byName('CROWD_announcer_' + k); if (!o) continue; const b = new THREE.Box3().setFromObject(o);
      if (b.min.y < top - 0.05) { o.position.y += top - b.min.y + 0.01; o.updateMatrixWorld(true); } }
  }
  let nSpecial = 0;
  world3d.traverse((o) => {
    let kind = null;
    if (/^VIG_shimpan_\d+$/.test(o.name)) kind = 'judge';
    else if (/^CROWD_announcer_\d+$/.test(o.name)) kind = 'commentator';
    else if (/^CROWD_marshal_\d+$/.test(o.name)) kind = 'marshal';
    else if (/^PROP_sushi_marble_/.test(o.name)) kind = /dh10_homie_crest$/.test(o.name) ? 'chef' : 'diner';
    if (kind) { o.userData.dh_anim = kind; o.userData.dh_phase = nSpecial++ * 1.72; }
  });
  let dohyo = null; try { dohyo = initDohyo({ THREE, scene, world3d, isMobile, mergeGeometries }); } catch (e) { console.warn('AD dohyo skipped:', e); } // AD pass 6: before grass (tuft blockers) + static merge
  adFacadeVariation(); // paint/text/awning variants, shared geometry, no GLB weight; never mirror Japanese text
  adGrass();           // replaces flat green cylinders with soft, varied stylised moss/grass
  let town2 = null; try { town2 = initTown2({ THREE, scene, world3d, isMobile }); } catch (e) { console.warn('AD town round 2 skipped:', e); } // AD critic pass 2 (before the static merge so its clash test sees every prop)
  const anim = [];
  const nodes = [];
  world3d.traverse((o) => { if (/^VIGA_/.test(o.name) || (o.userData && o.userData.dh_anim)) nodes.push(o); });
  for (const o of nodes) {
    o.traverse((c) => { c.matrixAutoUpdate = true; if (c.isMesh) c.raycast = noRay; });
    const ud = o.userData || {};
    if (!ud.dh_anim) continue;
    anim.push({ o, kind: ud.dh_anim, ph: +ud.dh_phase || Math.random() * 6, p0: o.position.clone(), q0: o.quaternion.clone(), ud, t: 0, st: 0 });
  }
  // ---- fishing: bobber, line and catch are linked by index
  const fishers = [];
  for (const a of anim) if (a.kind === 'bob') {
    const k = a.o.name.split('_').pop();
    const line = byName('VIGA_fishline_' + k), catchO = byName('VIGA_fishcatch_' + k);
    if (catchO) catchO.visible = false;
    fishers.push({ bob: a, line, catchO, tipY: line ? line.position.y : a.p0.y + 3, water: +(a.ud.dh_water ?? a.p0.y), next: 4 + Math.random() * 10, ev: null, et: 0 });
  }
  // ---- yakitori smoke: soft sprites from one canvas texture
  const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(235,230,225,0.9)'); gr.addColorStop(1, 'rgba(235,230,225,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const smokes = [];
  world3d.traverse((o) => { if (/^VIGA_smoke_/.test(o.name)) smokes.push(o); });
  const puffs = [];
  for (const s of smokes) {
    const base = s.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < (isMobile ? 4 : 6); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
      sp.raycast = noRay; scene.add(sp); puffs.push({ sp, base, ph: i / (isMobile ? 4 : 6) });
    }
  }
  // ---- static dressing merged by material (VIG_*, the new dohyo/roof/rig/fusa, lantern cords)
  const MERGE = /^(VIG_|PROP_sumo_|PROP_canal_cords_)/;
  const groups = new Map(); const kill = [];
  world3d.updateMatrixWorld(true);
  world3d.traverse((o) => {
    if (!o.isMesh || !MERGE.test(o.name) && !MERGE.test(o.parent?.name || '')) return;
    let p = o; while (p) { if (/^VIGA_/.test(p.name) || p.userData?.dh_anim) return; p = p.parent; }
    const g = o.geometry; const sig = o.material.uuid + '|' + Object.keys(g.attributes).sort().map((k) => k + ':' + g.attributes[k].array.constructor.name + (g.attributes[k].normalized ? 'n' : '')).join(',') + '|' + !!g.index;
    const c = g.clone().applyMatrix4(o.matrixWorld);
    (groups.get(sig) || groups.set(sig, { mat: o.material, gs: [] }).get(sig)).gs.push(c); kill.push(o);
  });
  for (const o of kill) o.parent && o.parent.remove(o);
  let merged = 0;
  for (const { mat, gs } of groups.values()) {
    const g = gs.length > 1 ? mergeGeometries(gs, false) : gs[0]; if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.name = 'VIGM_merged_' + merged++; m.matrixAutoUpdate = false; m.updateMatrix(); m.raycast = noRay; world3d.add(m);
  }
  // ---- steam off griddles / pots / fryers: whiter, quicker, smaller than the yakitori smoke
  const steamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(250,250,255,0.35)'); gr.addColorStop(1, 'rgba(250,250,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const puffTex = (() => { let q = 917; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647); const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) { const x = 64 + (r() - 0.5) * 44, y = 64 + (r() - 0.5) * 40, rad = 16 + r() * 22, gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(64, 64, 20, 64, 64, 63); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const steams = [];
  world3d.traverse((o) => { if (/^VIGA_steam_/.test(o.name)) steams.push(o); });
  for (const s of steams) {
    const base = s.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < (isMobile ? 3 : 5); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, fog: true })); // AD pass 4: lumpy rotating puffs
      sp.raycast = noRay; scene.add(sp); puffs.push({ sp, base, ph: i / (isMobile ? 3 : 5) + Math.random() * 0.1, steam: true, rot: Math.random() * 6.283, spin: (Math.random() - 0.5) * 1.8, sz: 0.85 + Math.random() * 0.3 });
    }
  }
  // ---- fish (schools)
  const fishGeo = (len, wid) => {
    const s = new THREE.Shape(); const L = len, W = wid;
    s.moveTo(L * 0.5, 0); s.bezierCurveTo(L * 0.45, W * 0.55, L * 0.05, W * 0.6, -L * 0.25, W * 0.25);
    s.lineTo(-L * 0.5, W * 0.55); s.lineTo(-L * 0.42, 0); s.lineTo(-L * 0.5, -W * 0.55); s.lineTo(-L * 0.25, -W * 0.25);
    s.bezierCurveTo(L * 0.05, -W * 0.6, L * 0.45, -W * 0.55, L * 0.5, 0);
    const g = new THREE.ShapeGeometry(s, 4); g.rotateX(-Math.PI / 2); return g; // flat in XZ, nose +X
  };
  const schools = [];
  const mkSchool = (opts) => {
    const { n, len, wid, colors, region, y, speed } = opts;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(fishGeo(len, wid), mat, n); im.name = 'AD_fish_' + opts.name; im.raycast = noRay; im.frustumCulled = false;
    const col = new THREE.Color();
    const fish = [];
    for (let i = 0; i < n; i++) {
      col.set(colors[i % colors.length]); im.setColorAt(i, col);
      const p = region.rand(); fish.push({ x: p[0], z: p[1], h: Math.random() * 6.28, v: speed * (0.7 + Math.random() * 0.6), w: 0, wt: Math.random() * 10, ph: Math.random() * 6 });
    }
    scene.add(im); const S = { im, fish, region, y, speed, len, maxOut: -1e9 }; schools.push(S); return S;
  };
  const ellipse = (cx, cz, a, b, m) => { const A = a - m, Bb = b - m; return {
    sdf: (x, z) => Math.hypot((x - cx) / A, (z - cz) / Bb) - 1, // <0 inside the safe ellipse
    inward: (x, z) => Math.atan2(cz - z, cx - x),
    clamp: (f) => { const d = Math.hypot((f.x - cx) / A, (f.z - cz) / Bb); if (d > 1) { f.x = cx + (f.x - cx) / d * 0.999; f.z = cz + (f.z - cz) / d * 0.999; } },
    rand: () => { const r = Math.sqrt(Math.random()) * 0.8, t = Math.random() * 6.28; return [cx + Math.cos(t) * A * r, cz + Math.sin(t) * Bb * r]; } }; };
  const rect = (x0, x1, z0, z1, m) => { const a = x0 + m, b = x1 - m, c = z0 + m, d = z1 - m, cx = (a + b) / 2; return {
    sdf: (x, z) => Math.max(a - x, x - b, c - z, z - d) / Math.max(0.5, Math.min(b - a, d - c) / 2),
    inward: (x, z, h) => { const fz = Math.sin(h) >= 0 ? 1 : -1; const tz = z + fz * 4; const ez = tz > d || tz < c ? -fz : fz; return Math.atan2(ez * 4, cx - x); },
    clamp: (f) => { f.x = Math.min(b, Math.max(a, f.x)); f.z = Math.min(d, Math.max(c, f.z)); },
    rand: () => [a + Math.random() * (b - a), c + Math.random() * (d - c)] }; };
  // shrine pond: transparent water over a dark bed so the koi read as UNDER the surface
  const pond = byName('PROP_shrine_pond_water');
  // stylised water: depth tint from the banks, scrolling ripple normals, sky/fresnel tint, animated edge foam where
  // it meets the walls, lantern reflection streaks (reflection points solved on the CPU each frame). No specular.
  const waterMats = [];
  const NL = isMobile ? 12 : 24;
  const waterShader = (mat, U) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `uniform float uT; uniform vec4 uBox; uniform int uShape; uniform vec3 uL[${NL}]; uniform vec3 uLC[${NL}]; uniform int uN;
uniform vec3 uDeep; uniform vec3 uShal; uniform vec3 uSky; uniform vec3 uHor; uniform float uOp; uniform float uFoam; varying vec3 vW;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
float wh(vec2 p){ return vn(p * 0.8 + vec2(uT * 0.11, uT * 0.05)) * 0.6 + vn(p * 2.1 - vec2(uT * 0.19, -uT * 0.12)) * 0.4; }
` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  vec2 p = vW.xz; float e = 0.06;
  vec2 g = vec2(wh(p + vec2(e, 0.0)) - wh(p - vec2(e, 0.0)), wh(p + vec2(0.0, e)) - wh(p - vec2(0.0, e))) / (2.0 * e);
  float dfa = 1.0 - smoothstep(25.0, 90.0, length(cameraPosition - vW)); // AD pass 4: ripples calm down with distance (no speckle from the blimp)
  vec3 N = normalize(vec3(-g.x * 0.3 * dfa, 1.0, -g.y * 0.3 * dfa));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float de;
  if (uShape == 0) { de = min(min(p.x - uBox.x, uBox.y - p.x), min(p.y - uBox.z, uBox.w - p.y)); }
  else { vec2 d = (p - uBox.xy) / uBox.zw; de = (1.0 - length(d)) * min(uBox.z, uBox.w); }
  vec3 col = mix(uShal, uDeep, smoothstep(0.0, 1.0, clamp(de / 2.0, 0.0, 1.0)));
  vec3 Rf = reflect(-V, N);
  col = mix(col, mix(uHor, uSky, sqrt(clamp(Rf.y, 0.0, 1.0))), 0.12 + 0.5 * fres);
  float fn = vn(p * 3.0 + vec2(uT * 0.35, 0.0)) * 0.5 + vn(p * 7.0 - vec2(0.0, uT * 0.5)) * 0.5;
  float foam = uFoam * (1.0 - smoothstep(0.0, 0.32, de - fn * 0.22 * dfa));
  col = mix(col, vec3(0.82, 0.84, 0.92), foam * 0.75);
  for (int i = 0; i < ${NL}; i++) { if (i >= uN) break;
    vec2 rp = uL[i].xy; vec2 dir = normalize(cameraPosition.xz - rp + vec2(1e-4)); vec2 dd = p - rp;
    float al = dot(dd, dir); float ac = dd.x * dir.y - dd.y * dir.x + (g.x - g.y) * 0.05;
    float gl = exp(-ac * ac / 0.025 - al * al / (0.35 + max(al, 0.0) * 1.6));
    col += uLC[i] * gl * uL[i].z; }
  vec4 diffuseColor = vec4(col, clamp(uOp + foam * 0.2, 0.0, 1.0));`);
    };
    mat.customProgramCacheKey = () => 'adwater' + NL;
  };
  const mkWater = (mesh, opts) => {
    const U = { uT: { value: 0 }, uBox: { value: new THREE.Vector4(...opts.box) }, uShape: { value: opts.shape }, uL: { value: Array.from({ length: NL }, () => new THREE.Vector3()) }, uLC: { value: Array.from({ length: NL }, () => new THREE.Vector3()) }, uN: { value: 0 },
      uDeep: { value: new THREE.Color(opts.deep) }, uShal: { value: new THREE.Color(opts.shal) }, uSky: { value: new THREE.Color('#5b3f86') }, uHor: { value: new THREE.Color('#e9849f') }, uOp: { value: opts.op }, uFoam: { value: opts.foam } };
    mesh.traverse((c) => { if (c.isMesh) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: true }); waterShader(m, U); c.material = m; c.renderOrder = 2; } });
    const W = { uniforms: U, lights: opts.lights, y: opts.y }; waterMats.push(W); return W;
  };
  const _cp = new THREE.Vector3();
  let camRef = null;
  function updateReflections() {
    const cam = camRef; if (!cam) return;
    const C = cam.getWorldPosition(_cp);
    for (const W of waterMats) {
      if (C.y <= W.y + 0.05) { W.uniforms.uN.value = 0; continue; }
      const cand = [];
      for (const L of W.lights) { const ly = 2 * W.y - L.p.y; const t = (W.y - C.y) / (ly - C.y); const rx = C.x + (L.p.x - C.x) * t, rz = C.z + (L.p.z - C.z) * t; cand.push([rx, rz, L, (rx - C.x) ** 2 + (rz - C.z) ** 2]); }
      cand.sort((a, b) => a[3] - b[3]);
      const n = Math.min(NL, cand.length);
      for (let i = 0; i < n; i++) { const [rx, rz, L] = cand[i]; W.uniforms.uL.value[i].set(rx, rz, L.k); W.uniforms.uLC.value[i].set(L.c.r, L.c.g, L.c.b); }
      W.uniforms.uN.value = n;
    }
  }
  const bed = (w, d, cx, cz, y, ell) => { const g = ell ? new THREE.CircleGeometry(0.5, 32) : new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x0b1a2c, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.scale.set(w, 1, d); m.position.set(cx, y, cz); m.raycast = noRay; scene.add(m); return m; };
  const lightsOf = (re, k, colA, colB) => { const out = []; world3d.updateMatrixWorld(true); world3d.traverse((o) => { if (re.test(o.name) && !re.test(o.parent?.name || '')) { const b = new THREE.Box3().setFromObject(o); const p = b.getCenter(new THREE.Vector3()); out.push({ p, k, c: new THREE.Color(out.length % 2 ? colB : colA) }); } }); return out; };
  if (pond) {
    const bb = new THREE.Box3().setFromObject(pond); const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const pl = lightsOf(/^PROP_stone_lantern_/, 0.55, '#ffb468', '#ffc98a').filter((L) => Math.hypot(L.p.x - c.x, L.p.z - c.z) < 12).map((L) => ({ ...L, p: L.p.clone().setY(bb.max.y + 1.4) }));
    mkWater(pond, { box: [c.x, c.z, s.x / 2, s.z / 2], shape: 1, deep: '#0a2a33', shal: '#2a5a5a', op: 0.74, foam: 0.25, lights: pl, y: bb.max.y }); bed(s.x * 0.995, s.z * 0.995, c.x, c.z, bb.min.y + 0.008, true);
    const yF = bb.min.y + (bb.max.y - bb.min.y) * 0.5;
    mkSchool({ name: 'koi', n: isMobile ? 6 : 8, len: 0.55, wid: 0.2, colors: ['#ff7a1a', '#f4f1ea', '#e8461c', '#ffb02e', '#f4f1ea', '#1d1d22', '#ff5a1f', '#ffd27a'], region: ellipse(c.x, c.z, s.x / 2, s.z / 2, 0.55), y: yF, speed: 0.45 });
  }
  const canal = byName('CANAL_water');
  if (canal) {
    const bb = new THREE.Box3().setFromObject(canal);
    const cl = lightsOf(/^PROP_canal_lantern_/, 0.35, '#ff6a3a', '#ffd9a0'); // AD critic pass 3: near lantern streaks toned down (was 0.9)
    if (town2 && town2.waterLights) cl.push(...town2.waterLights()); // AD critic pass 2: neon trims + vertical kanban also reflect
    mkWater(canal, { box: [bb.min.x, bb.max.x, bb.min.z, bb.max.z], shape: 0, deep: '#0d2742', shal: '#2c5a73', op: 0.86, foam: 1.0, lights: cl, y: bb.max.y });
    bed(bb.max.x - bb.min.x, bb.max.z - bb.min.z, (bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2, bb.min.y + 0.02, false);
    const yF = (bb.min.y + bb.max.y) / 2 + 0.02;
    const reg = rect(bb.min.x, bb.max.x, bb.min.z + 4, bb.max.z - 4, 0.7);
    mkSchool({ name: 'canal', n: isMobile ? 8 : 12, len: 0.34, wid: 0.1, colors: ['#5d6f84', '#7f8d99', '#4a5a6c', '#a6b0b8'], region: reg, y: yF, speed: 0.8 });
  }
  // ---- a few delivery drones drifting high over the town (near-future layer, steady lights, no flicker)
  const drones = [];
  const dGeo = new THREE.BoxGeometry(0.7, 0.16, 0.7), dMat = new THREE.MeshBasicMaterial({ color: 0x24212b, fog: true });
  const dot = (c) => new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  [[20, 27, -8, 9, 0.16], [-22, 29, 18, 12, 0.11], [48, 25, 28, 8, 0.14]].slice(0, isMobile ? 2 : 3).forEach(([x, y, z, r, sp], i) => {
    const g = new THREE.Group(); const b = new THREE.Mesh(dGeo, dMat); b.raycast = noRay; g.add(b);
    const l1 = dot(0xff3a5a), l2 = dot(0x4ff0ff); l1.scale.setScalar(0.8); l2.scale.setScalar(0.8); l1.position.set(0.4, -0.1, 0); l2.position.set(-0.4, -0.1, 0); g.add(l1, l2);
    scene.add(g); drones.push({ g, l1, l2, c: new THREE.Vector3(x, y, z), r, sp, ph: i * 2.1 });
  });
  const bobs = fishers.map((f) => f.bob.p0);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
  function swim(S, dt, t) {
    const R = S.region;
    S.fish.forEach((f, i) => {
      f.wt -= dt; if (f.wt <= 0) { f.w = (Math.random() - 0.5) * 1.4; f.wt = 1.5 + Math.random() * 3; }
      let turn = f.w;
      const look = 1.2 + f.v * 1.5, lx = f.x + Math.cos(f.h) * look, lz = f.z - Math.sin(f.h) * look;
      const sd = R.sdf(lx, lz);
      if (sd > -0.15) { // about to leave the safe water: turn toward the interior, harder the closer
        const want = R.inward(f.x, f.z, -f.h); let d = -want - f.h; d = Math.atan2(Math.sin(d), Math.cos(d));
        turn = Math.sign(d) * Math.min(2.2, 0.8 + (sd + 0.15) * 6);
      }
      if (sd <= -0.15) for (const b of bobs) { const dx = f.x - b.x, dz = f.z - b.z; if (dx * dx + dz * dz < 0.6) { const away = Math.atan2(dz, dx); let d = -away - f.h; d = Math.atan2(Math.sin(d), Math.cos(d)); turn = Math.sign(d) * 1.4; } }
      f.h += turn * dt;
      const sp = f.v * (sd > -0.15 ? 0.6 : 1) * (0.85 + 0.15 * Math.sin(t * 0.7 + f.ph));
      const nx = f.x + Math.cos(f.h) * sp * dt, nz = f.z - Math.sin(f.h) * sp * dt;
      const s0 = R.sdf(f.x, f.z), s1 = R.sdf(nx, nz);
      if (s1 > 0 && s1 >= s0) { // would leave the safe water: hold position and pivot inward (a real fish stalls and turns)
        const want = R.inward(f.x, f.z, -f.h); let d = -want - f.h; d = Math.atan2(Math.sin(d), Math.cos(d)); f.h += Math.sign(d) * Math.min(Math.abs(d), 3 * dt);
      } else { f.x = nx; f.z = nz; }
      S.maxOut = Math.max(S.maxOut, R.sdf(f.x, f.z)); R.clamp(f);
      const wig = Math.sin(t * (6 + sp * 6) + f.ph) * 0.14;
      _q.setFromAxisAngle(_up, f.h + wig); _p.set(f.x, S.y - 0.004 * (i % 3), f.z); _m.compose(_p, _q, _s); S.im.setMatrixAt(i, _m);
    });
    S.im.instanceMatrix.needsUpdate = true;
  }
  const _e = new THREE.Euler(), _qq = new THREE.Quaternion();
  function animate(a, dt, t) {
    const o = a.o, T = t + a.ph;
    const set = (dy, yaw = 0, rx = 0, rz = 0) => { o.position.copy(a.p0); o.position.y += dy; _e.set(rx, yaw, rz, 'YXZ'); o.quaternion.copy(a.q0).multiply(_qq.setFromEuler(_e)); };
    switch (a.kind) {
      case 'rikishi': { // shiko stomps, then crouch at the shikiri-sen
        const c = T % 7; if (c < 3) { const k = Math.floor(c / 1.5) ? -1 : 1, u = (c % 1.5) / 1.5; const lift = Math.sin(Math.min(1, u * 1.4) * Math.PI); set(0.02 * lift, 0, 0, k * 0.32 * lift); }
        else if (c < 6) set(0.006 * Math.sin(T * 3.1), 0.03 * Math.sin(T * 0.9), 0.18 * Math.min(1, (c - 3) * 2) + 0.012 * Math.sin(T * 2.6), 0); else set(0.06 * Math.sin((c - 6) * Math.PI), 0); break; }
      case 'gyoji': set(0, Math.sin(T * 0.6) * 0.35, 0, Math.sin(T * 1.2) * 0.05); break;
      case 'fisher': set(0, Math.sin(T * 0.25) * 0.12, Math.sin(T * 0.4) * 0.03, 0); break;
      case 'seller': { const c = T % 5; set(c > 4.4 ? 0.12 * Math.sin((c - 4.4) / 0.6 * Math.PI) : 0, Math.sin(T * 0.5) * 0.5); break; }
      case 'queue': set(0.02 * Math.abs(Math.sin(T * 1.1)), Math.sin(T * 0.3) * 0.25); break;
      case 'browse': { const c = T % 6; set(c > 5.5 ? 0.1 * Math.sin((c - 5.5) * 2 * Math.PI) : 0, Math.sin(T * 0.45) * 0.7); break; }
      case 'diner': set(0.006 * Math.sin(T * 1.7), Math.sin(T * 0.31) * 0.12, Math.max(0, Math.sin(T * 0.9)) * 0.22 + 0.02 * Math.sin(T * 2.3), 0); break;
      case 'judge': set(0.008 * Math.sin(T * 1.8), Math.sin(T * 0.27) * 0.22, 0.025 * Math.sin(T * 0.7)); break;
      case 'commentator': set(0.018 * Math.abs(Math.sin(T * 5.0)), Math.sin(T * 0.7) * 0.3, 0.07 * Math.sin(T * 2.4)); break;
      case 'chef': { const c = T % 5; set(0.012 * Math.sin(T * 4), Math.sin(T * 0.65) * 0.26, c < 3 ? 0.10 * Math.abs(Math.sin(T * 7)) : -0.04); break; }
      case 'marshal': set(0.012 * Math.sin(T * 2), Math.sin(T * 0.34) * 0.23, 0, Math.sin(T * 0.7) * 0.025); break;
      case 'steam': case 'smoke': break;
      case 'cheer': { const c = T % 6; const on = c < 3.6; set(on ? 0.16 * Math.abs(Math.sin(T * 4.4)) : 0.01 * Math.sin(T * 2), Math.sin(T * 0.4) * 0.3, 0, on ? Math.sin(T * 2.2) * 0.12 : 0); break; }
      case 'clap': set(0.035 * Math.abs(Math.sin(T * 8.5)) * (Math.sin(T * 0.5) > -0.3 ? 1 : 0), Math.sin(T * 0.35) * 0.25); break;
      case 'look': set(0, Math.sin(T * 0.28) * 0.7 + Math.sin(T * 0.11) * 0.3); break;
      case 'chat': { const c = (T % 5) / 5; const talk = c < 0.5; set(talk ? 0.04 * Math.abs(Math.sin(T * 7)) : 0, talk ? Math.sin(T * 1.3) * 0.12 : Math.sin(T * 0.4) * 0.05, talk ? 0.08 : 0.0, 0); break; }
      case 'tram': { // two-car tram on the guideway: glide between the island ends, ease in/out, dwell out in the haze
        const P = a.ud.dh_path; if (!P) break; const y0 = -P[1], y1 = -P[3], v = 7, dwell = 6, run = Math.abs(y1 - y0) / v, cyc = 2 * (run + dwell);
        const c = t % cyc; let u; if (c < run) u = c / run; else if (c < run + dwell) u = 1; else if (c < 2 * run + dwell) u = 1 - (c - run - dwell) / run; else u = 0;
        const e = u * u * (3 - 2 * u); o.position.copy(a.p0); o.position.z += y0 + (y1 - y0) * e; break; }
      case 'walk': { // ping-pong along the lane with a hop gait, turning around at the ends
        const P = a.ud.dh_path; if (!P) break; const ax = P[0], az = -P[1], bx = P[2], bz = -P[3]; const L = Math.hypot(bx - ax, bz - az) || 1;
        a.s = a.s ?? (a.p0.x - ax) / (bx - ax || 1) * L; a.dir = a.dir ?? (a.s > L / 2 ? -1 : 1); a.turn = a.turn || 0;
        if (a.turn > 0) { a.turn -= dt; } else { a.s += a.dir * 1.1 * dt; if (a.s > L || a.s < 0) { a.s = Math.min(L, Math.max(0, a.s)); a.dir *= -1; a.turn = 1.2; } }
        const u = a.s / L; o.position.set(ax + (bx - ax) * u, a.p0.y + (a.turn > 0 ? 0 : Math.abs(Math.sin(T * 7)) * 0.12), az + (bz - az) * u);
        const yawT = Math.atan2(-(bz - az) * a.dir, (bx - ax) * a.dir); a.yaw = a.yaw ?? yawT; let d = yawT - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); a.yaw += d * Math.min(1, dt * 4);
        _e.set(0, a.yaw, 0, 'YXZ'); o.quaternion.setFromEuler(_e); break; }
      default: break;
    }
  }
  function fishing(f, dt, t) {
    const b = f.bob.o; let y = f.water + 0.015 * Math.sin(t * 2 + f.bob.ph); let catchUp = 0;
    f.next -= dt;
    if (!f.ev && f.next <= 0) { f.ev = Math.random() < 0.35 ? 'catch' : 'bite'; f.et = 0; }
    if (f.ev) {
      f.et += dt;
      if (f.ev === 'bite') { y -= 0.1 * Math.max(0, Math.sin(f.et * 9)); if (f.et > 1.4) { f.ev = null; f.next = 6 + Math.random() * 10; } }
      else { const u = f.et < 1 ? f.et : f.et < 3.2 ? 1 : Math.max(0, 1 - (f.et - 3.2)); catchUp = u * u * (3 - 2 * u); if (f.et > 4.3) { f.ev = null; f.next = 10 + Math.random() * 14; } }
    }
    y += catchUp * 1.6; b.position.y = y;
    if (f.line) f.line.scale.y = Math.max(0.05, f.tipY - y); // line runs tip -> bobber, so it always touches the bobber
    if (f.catchO) { f.catchO.visible = catchUp > 0.05; if (f.catchO.visible) { f.catchO.position.set(b.position.x, y - 0.05, b.position.z); f.catchO.rotation.set(0, 0, Math.sin(t * 14) * 0.5); } }
  }
  function update(dt, t) {
    dt = Math.min(dt, 0.1);
    if (town2) town2.update(dt, t); // AD critic pass 2
    if (dohyo) dohyo.update(dt, t); // AD pass 6
    for (const a of anim) if (a.kind !== 'bob' && a.kind !== 'line' && a.kind !== 'catch' && a.kind !== 'rod') { animate(a, dt, t); a.o.updateMatrix(); }
    for (const f of fishers) fishing(f, dt, t);
    for (const S of schools) swim(S, dt, t);
    for (const p of puffs) {
      if (p.steam) { const u = (t * 0.42 + p.ph) % 1; p.sp.position.set(p.base.x + Math.sin(u * 5 + p.ph * 11) * 0.16 * u, p.base.y + u * 1.6, p.base.z + Math.cos(u * 4 + p.ph * 5) * 0.12 * u); const s = (0.35 + u * 1.25) * p.sz; p.sp.scale.set(s, s, s); p.sp.material.opacity = 0.66 * Math.min(1, u / 0.16) * Math.pow(1 - u, 1.4); p.sp.material.rotation = p.rot + u * p.spin; continue; } // AD pass 4: slow rise, quick fade-in, long fade-out, random roll
      const u = (t * 0.33 + p.ph) % 1; p.sp.position.set(p.base.x + Math.sin(u * 5 + p.ph * 9) * 0.25, p.base.y + u * 2.6, p.base.z); const s = 0.4 + u * 1.3; p.sp.scale.set(s, s, s); p.sp.material.opacity = 0.42 * Math.sin(u * Math.PI);
    }
    for (const L of waterMats) L.uniforms.uT.value = t;
    updateReflections();
    for (const d of drones) { const T = t * d.sp + d.ph; d.g.position.set(d.c.x + Math.sin(T) * d.r, d.c.y + Math.sin(T * 0.7) * 1.2, d.c.z + Math.sin(T * 0.5 + 1) * d.r * 0.7); d.g.rotation.y = -T; const k = 0.75 + 0.25 * Math.sin(t * 3.1 + d.ph); d.l1.material.opacity = k; d.l2.material.opacity = 1.0 - (k - 0.75); }
  }
  // ---- Round 2: facade variety without new GLB weight. The 12 shopfronts share 3 meshes; each one gets its own vertex-colour
  // copy re-painted per material class (plaster / timber / bengara lattice / roof tiles / indigo noren), plus its own
  // vertical shop board (hashira-kake kanban) on the left corner post, drawn into one canvas atlas (1 draw call).
  function adFacadeVariation() {
    const lin = (h) => new THREE.Color(h);
    const CLS = { plaster: ['#e6dcc8', '#d9cdb5', '#b9ab92'], wood: ['#6a4630', '#3e281d', '#6b3f22'], bengara: ['#7b3423'], tile: ['#68707e', '#3a4049', '#7d8592', '#4a505b'], noren: ['#203660'] };
    const KEEP = ['#8e8a84', '#625e59', '#241712', '#f1ece0', '#6d5a36'];
    const refs = [];
    for (const [k, hs] of Object.entries(CLS)) hs.forEach((h) => refs.push({ k, c: lin(h) }));
    KEEP.forEach((h) => refs.push({ k: null, c: lin(h) }));
    const PAL = {
      plaster: ['#e6dcc8', '#d8b98a', '#c7c4be', '#d9b4a0', '#efe6cf', '#cfc0a0'],   // lime, ochre tsuchikabe, grey, terracotta lime, cream, clay
      wood: ['#6a4630', '#2a211e', '#86603e', '#5e2f24', '#3e3530', '#74503a'],
      bengara: ['#7b3423', '#4b2a21', '#8d6c49', '#6a2622', '#7b3423', '#5d4030'],
      tile: ['#68707e', '#5b616b', '#6f6b67', '#757d8a', '#626a77', '#6b6f75'],
      noren: ['#203660', '#7a1f2a', '#e6e0cf', '#2f5a3a', '#5a3a1f', '#4a2a5a'],
    };
    const cache = new Map(), names = ['生蕎麦', '御茶', '酒', '甘味処', '古書', '呉服', '和菓子', '豆腐', '米', 'うなぎ', '雑貨', '薬'];
    const shops = []; world3d.traverse((o) => { if (/^PROP_(canal|alley)_shopfront_\d+$/.test(o.name)) shops.push(o); });
    shops.sort((a, b) => a.name.localeCompare(b.name));
    shops.forEach((o, i) => {
      const pick = (k) => lin(PAL[k][(i * 5 + { plaster: 0, wood: 2, bengara: 3, tile: 1, noren: 4 }[k] + (k === 'noren' ? i >> 2 : 0)) % PAL[k].length]); // 5 is coprime to 6: every palette entry is used
      const target = { plaster: pick('plaster'), wood: pick('wood'), bengara: pick('bengara'), tile: pick('tile'), noren: pick('noren') };
      const base = { plaster: lin(CLS.plaster[0]), wood: lin(CLS.wood[0]), bengara: lin(CLS.bengara[0]), tile: lin(CLS.tile[0]), noren: lin(CLS.noren[0]) };
      o.traverse((m) => {
        if (!m.isMesh || !m.geometry.attributes.color) return;
        const g = m.geometry, ca = g.attributes.color, n = ca.count;
        let cls = cache.get(g.uuid);
        if (!cls) { // classify each vertex once per shared geometry by chroma direction (AO only scales brightness)
          cls = new Int8Array(n).fill(-1); const keys = Object.keys(CLS);
          for (let v = 0; v < n; v++) {
            const r = ca.getX(v), gg = ca.getY(v), b = ca.getZ(v), L = Math.hypot(r, gg, b) || 1e-6; let best = 1e9, bk = null;
            for (const R of refs) { const s = (r * R.c.r + gg * R.c.g + b * R.c.b) / (R.c.r ** 2 + R.c.g ** 2 + R.c.b ** 2); if (s < 0.3 || s > 1.8) continue;
              const e = Math.hypot(r - s * R.c.r, gg - s * R.c.g, b - s * R.c.b) / L; if (e < best) { best = e; bk = R.k; } }
            if (bk && best < 0.12) cls[v] = keys.indexOf(bk);
          }
          cache.set(g.uuid, cls);
        }
        const keys = Object.keys(CLS);
        const arr = new ca.array.constructor(ca.array), nc = new THREE.BufferAttribute(arr, ca.itemSize, ca.normalized);
        for (let v = 0; v < n; v++) { const k = cls[v]; if (k < 0) continue; const K = keys[k], T = target[K], B = base[K];
          nc.setXYZ(v, Math.min(1, ca.getX(v) * T.r / B.r), Math.min(1, ca.getY(v) * T.g / B.g), Math.min(1, ca.getZ(v) * T.b / B.b)); }
        const g2 = new THREE.BufferGeometry();
        for (const [k, at] of Object.entries(g.attributes)) g2.setAttribute(k, k === 'color' ? nc : at);
        g2.setIndex(g.index); g2.groups = g.groups; g2.boundingBox = g.boundingBox; g2.boundingSphere = g.boundingSphere; m.geometry = g2;
      });
    });
    // kanban atlas: 12 vertical boards, 3 board styles (black lacquer + gold, natural wood + ink, dark wood + white)
    const SW = 64, SH = 256, cv = document.createElement('canvas'); cv.width = SW * 16; cv.height = SH; const x = cv.getContext('2d');
    const styles = [['#1b1512', '#d9b45a'], ['#b08a5a', '#1d140e'], ['#3a261b', '#f1e9d6']];
    names.forEach((t, i) => {
      const [bg, fg] = styles[i % 3]; const x0 = i * SW; x.fillStyle = bg; x.fillRect(x0, 0, SW, SH);
      x.strokeStyle = fg; x.globalAlpha = 0.6; x.lineWidth = 3; x.strokeRect(x0 + 5, 5, SW - 10, SH - 10); x.globalAlpha = 1;
      const ch = [...t], fs = Math.min(46, (SH - 34) / ch.length * 0.92); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `bold ${fs}px "Yu Mincho","Hiragino Mincho ProN","Noto Serif JP","Noto Serif CJK JP","MS Mincho","Noto Sans CJK JP",serif`;
      ch.forEach((c, j) => x.fillText(c, x0 + SW / 2, 17 + (j + 0.5) * (SH - 34) / ch.length));
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geos = [], back = [];
    shops.forEach((o, i) => {
      const hw = /alley/.test(o.name) ? 2.75 : 4.0, w = 0.26, h = 1.15, y0 = 1.12, xc = -hw + 0.16, z = 2.0 + 0.035;
      const pg = new THREE.PlaneGeometry(w, h); pg.translate(xc, y0 + h / 2, z + 0.001);
      const uv = pg.attributes.uv; for (let v = 0; v < uv.count; v++) uv.setX(v, (i + uv.getX(v)) / 16);
      const bg = new THREE.BoxGeometry(w + 0.04, h + 0.06, 0.03); bg.translate(xc, y0 + h / 2, z - 0.015);
      o.updateMatrixWorld(true); pg.applyMatrix4(o.matrixWorld); bg.applyMatrix4(o.matrixWorld); geos.push(pg); bg.deleteAttribute('uv'); back.push(bg);
    });
    if (geos.length) {
      const m1 = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })); m1.name = 'AD_kanban_boards';
      const m2 = new THREE.Mesh(mergeGeometries(back), new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 0.8 })); m2.name = 'AD_kanban_frames';
      for (const m of [m1, m2]) { m.raycast = noRay; m.matrixAutoUpdate = false; scene.add(m); }
    }
    facadeStats = { shops: shops.length, recoloured: cache.size };
  }
  // ---- Round 2: stylised grass on the GROUND_moss discs: three-green value noise, sun-bleached patches, clover/flower flecks,
  // darker tuft breakup, and a soft feathered edge that fades into the paving (no hard green cylinder rim). Plus instanced
  // low-poly tufts scattered on the discs (one draw call).
  function adGrass() {
    const discs = []; world3d.traverse((o) => { if (o.isMesh && /^GROUND_moss/.test(o.name)) discs.push(o); });
    if (!discs.length) return;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, transparent: true, depthWrite: false });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vWg; varying vec2 vLg;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWg = (modelMatrix * vec4(transformed, 1.0)).xyz; vLg = position.xz;');
      sh.fragmentShader = `varying vec3 vWg; varying vec2 vLg;
float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  vec2 p = vWg.xz;
  float n1 = gn(p * 0.35) * 0.6 + gn(p * 1.1) * 0.4, n2 = gn(p * 3.3 + 7.0), n3 = gn(p * 9.0 + 3.0);
  vec3 g0 = vec3(0.075, 0.12, 0.055), g1 = vec3(0.12, 0.18, 0.075), g2 = vec3(0.2, 0.23, 0.11); // AD pass 5: deeper, less saturated
  vec3 col = mix(g0, g1, smoothstep(0.25, 0.75, n1));
  col = mix(col, g2, smoothstep(0.62, 0.9, n2) * 0.55);
  col *= 0.82 + 0.3 * n3;
  vec2 fc = p * 6.0; float fh = gh(floor(fc));
  float fl = step(0.993, fh) * step(0.45, n1) * (1.0 - smoothstep(0.12, 0.2, length(fract(fc) - 0.5)));
  col = mix(col, mix(vec3(0.85, 0.72, 0.25), vec3(0.8, 0.55, 0.62), step(0.9965, fh)), fl * 0.7);
  float r = length(vLg);
  float edge = 1.0 - smoothstep(0.5 + 0.14 * n2, 1.0, r + 0.12 * (n3 - 0.5)); // AD pass 5: wide ragged fade into the paving
  col = mix(col, vec3(0.16, 0.15, 0.12), smoothstep(0.6, 0.95, r) * 0.45); // damp soil / worn stone tone at the rim
  col *= 0.86 + 0.14 * smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.9, 1.0, r));
  vec4 diffuseColor = vec4(col, edge);`);
    };
    for (const d of discs) { d.material = mat; d.renderOrder = 1; }
    // tufts
    // blades: both windings with up-normals (so they shade exactly like the ground they grow from; DoubleSide would flip the
    // back-face normal down and render black), darker root -> sunlit tip via vertex colour
    const tg = new THREE.BufferGeometry(); const P = [], N = [], C = [];
    for (let k = 0; k < 5; k++) { const a = k * 1.2566 + Math.random() * 0.4, c = Math.cos(a) * 0.035, s = Math.sin(a) * 0.035, ox = Math.cos(a * 2.3) * 0.05, oz = Math.sin(a * 2.3) * 0.05, lx = ox + Math.cos(a + 1.2) * 0.06, lz = oz + Math.sin(a + 1.2) * 0.06, h = 0.13 + 0.07 * ((k * 7) % 3) / 2;
      const A = [ox - c, 0, oz - s], B = [ox + c, 0, oz + s], T = [lx, h, lz]; P.push(...A, ...B, ...T, ...B, ...A, ...T); for (let j = 0; j < 6; j++) N.push(0, 1, 0); C.push(0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1.12, 1.12, 1.05, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1.3, 1.3, 1.15); }
    tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const blockers = []; // anything standing on / covering the grass (pond water, dohyo, seats, marbles, lanterns): no tufts under it
    world3d.traverse((o) => { if (o.isMesh && !/^GROUND_/.test(o.name)) { const b = new THREE.Box3().setFromObject(o); if (b.max.x - b.min.x < 60 && b.max.z - b.min.z < 60) blockers.push(b); } });
    if (dohyo) blockers.push(...dohyo.blockers()); // AD pass 6: masu-seki boxes + buckets live in scene, not world3d
    const pts = [];
    for (const d of discs) {
      d.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(d), c = bb.getCenter(new THREE.Vector3()), sx = (bb.max.x - bb.min.x) / 2, sz = (bb.max.z - bb.min.z) / 2;
      const n = Math.min(isMobile ? 70 : 180, Math.round(sx * sz * (isMobile ? 2.4 : 5.0)));
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.66; const px = c.x + Math.cos(a) * rr * sx, pz = c.z + Math.sin(a) * rr * sz, py = bb.max.y;
        if (!blockers.some((b) => px > b.min.x - 0.15 && px < b.max.x + 0.15 && pz > b.min.z - 0.15 && pz < b.max.z + 0.15 && b.max.y > py - 0.02 && b.min.y < py + 1.5)) pts.push([px, py, pz]); }
    }
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), pts.length);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    pts.forEach((p, i) => { const s = 0.7 + Math.random() * 0.8; M4.compose(V.set(...p), Q.setFromAxisAngle(Y, Math.random() * 6.28), S.set(s, s * (0.8 + Math.random() * 0.6), s)); tm.setMatrixAt(i, M4); const u = Math.random(); tm.setColorAt(i, col.setRGB(0.1 + 0.07 * u, 0.15 + 0.06 * u, 0.07 + 0.03 * u)); });
    tm.name = 'AD_grass_tufts'; tm.raycast = noRay; scene.add(tm);
    grassStats = { discs: discs.length, tufts: pts.length };
  }
  const setCamera = (c) => { camRef = c; };
  const stats = () => ({ special: nSpecial, facade: facadeStats, grass: grassStats, water: waterMats.map((W) => W.lights.length), drones: drones.length, animated: anim.length, fishers: fishers.length, merged, mergedFrom: kill.length, puffs: puffs.length, schools: schools.map((S) => ({ n: S.fish.length, maxOut: +S.maxOut.toFixed(3) })), town2: town2 ? town2.stats() : null, dohyo: dohyo ? dohyo.stats() : null });
  // test hook: run the swim sim fast and report the worst excursion past the safe margin (must stay <= 0)
  const soak = (sec = 120, h = 1 / 30) => { for (let t = 0; t < sec; t += h) for (const S of schools) swim(S, h, t); return stats(); };
  window.__adTown = { stats, soak, where: (n) => { if (n === 'drone') return drones[0].g.position.toArray(); const o = scene.getObjectByName(n) || world3d.getObjectByName(n); if (!o) return null; const b = new THREE.Box3().setFromObject(o); return b.getCenter(new THREE.Vector3()).toArray(); }, actors: () => anim.filter(a => !['steam','smoke','bob','line','catch','rod'].includes(a.kind)).map(a => ({name:a.o.name,kind:a.kind,p:a.o.position.toArray(),q:a.o.quaternion.toArray()})).concat(town2 ? town2.actors() : []) };
  return { update, stats, setCamera };
}
