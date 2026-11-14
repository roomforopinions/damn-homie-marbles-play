// Art Director · AD pass 6 (11-14): DOHYO rebuilt as a real tsuriyane (hanging roof), ref: Ryogoku Kokugikan photos (Wikimedia Commons:
// "Ryogoku Kokugikan Dohyo suspended roof", "Ryogoku Kokugikan Tsuriyane 05212006", "Dohyo-matsuri 01", "Aki basho dohyo-iri 2014").
// Runtime only, zero GLB bytes. Called from ad_town.js BEFORE the static merge and the grass pass.
//  - glb PROP_sumo_tsuriyane / PROP_sumo_roof_rig (4 ground posts) / PROP_sumo_fusa are detached (never deleted from disk) and replaced by:
//    shinmei-zukuri gable roof (thick thatch slabs, dark cypress tone, cut-thatch eaves), crossed chigi rising from both gables,
//    6 gold-capped katsuogi on the ridge, hinoki gable pediments, keta frame + coffered ceiling, purple mizuhiki-maku with swags and
//    tassel ties, the 4 shi-ten fusa (green NE / red SE / white SW / black NW), and 4 thin cables fading up into the dusk. No posts.
//  - mound kept (glb clay, steps, shikiri-sen, tawara); adds 4 tokudawara (the circle gaps), 2 salt baskets, 2 chikara-mizu buckets.
//  - the randomly scattered CROWD_fan marbles + 13 glb masu around the ring are replaced by tiered masu-seki boxes (pipe rails, 4 red
//    zabuton each) with seated spectator marbles facing the ring (glb fan-atlas marbles, merged); a few bounce and cheer.
//  Footprint: roof stays inside the old tsuriyane box (x/z), chigi/cables only rise above it; every masu box is clash-tested.
export function initDohyo({ THREE, scene, world3d, isMobile = false, mergeGeometries }) {
  const log = { removed: 0, masu: 0, skipped: [], fans: 0, anim: 0, toku: 0 };
  const noRay = () => {};
  const root = new THREE.Group(); root.name = 'AD3_dohyo'; scene.add(root);
  world3d.updateMatrixWorld(true);
  const dohyo = world3d.getObjectByName('PROP_sumo_dohyo'); if (!dohyo) { log.err = 'no PROP_sumo_dohyo'; return { update() {}, stats: () => log, blockers: () => [] }; }
  const C = new THREE.Vector3(); { let top = null; dohyo.traverse((o) => { if (o.isMesh && /clay_top/.test(o.material?.name || '')) top = o; }); const b = new THREE.Box3().setFromObject(top || dohyo); b.getCenter(C); C.y = 0; }
  const Y0 = (() => { const b = new THREE.Box3(); dohyo.traverse((o) => { if (o.isMesh && /dohyo_clay$/.test(o.material?.name || '')) b.union(new THREE.Box3().setFromObject(o)); }); return b.isEmpty() ? 0.71 : b.max.y; })();
  let q = 6006; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647); // own RNG: never touches the other files' sequences
  const blockers = [];
  // ---- detach the old roof, rig, fusa, glb masu + nearby scattered fans (fans: keep their geometry for the new spectators)
  const oldRoof = new THREE.Box3(); const fanSrc = [];
  const kill = [];
  world3d.traverse((o) => {
    if (/^PROP_sumo_(tsuriyane|roof_rig|fusa)$/.test(o.name)) { if (/tsuriyane/.test(o.name)) oldRoof.union(new THREE.Box3().setFromObject(o)); kill.push(o); return; }
    if (/^(VIG_masu_seki_\d+|CROWD_fan_.*)$/.test(o.name)) { const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); const d = Math.hypot(p.x - C.x, p.z - C.z);
      if (/^CROWD_fan/.test(o.name)) { o.traverse((m) => { if (m.isMesh && fanSrc.length < 60) fanSrc.push(m); }); }
      if (d < 13.5) kill.push(o); }
  });
  const fanPool = fanSrc.map((m) => { const g = m.geometry.clone(); g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()), s = g.boundingBox.getSize(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z);
    const ws = new THREE.Vector3(); m.getWorldScale(ws); g.scale(ws.x, ws.y, ws.z); return { g, mat: m.material, rad: Math.max(s.x * ws.x, s.y * ws.y) / 2 }; });
  for (const o of kill) if (o.parent) { o.parent.remove(o); log.removed++; }
  if (oldRoof.isEmpty()) oldRoof.set(new THREE.Vector3(C.x - 4.9, 6.6, C.z - 4.75), new THREE.Vector3(C.x + 4.9, 12.14, C.z + 4.75));
  // ---- world clearance (small props only: the track floor/rails have whole-track boxes and run >= 4.8 u up here)
  const boxes = []; world3d.updateMatrixWorld(true);
  world3d.traverse((o) => { if (!o.isMesh || /^(GROUND_|SEA|LP3_bg|TRACK_PATH|TRACK_centerline|PROP_sumo_|VIGA_|VIG_shimpan)/.test(o.name) || /^(PROP_sumo_|VIGA_)/.test(o.parent?.name || '')) return; const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3()); if (s.x > 30 || s.z > 30) return; boxes.push({ b, n: o.name || o.parent?.name }); });
  const clash = (b) => boxes.filter((e) => e.b.intersectsBox(b)).map((e) => e.n);
  // ---- tiny geometry kit (non-indexed, vertex colours)
  class GB { constructor() { this.P = []; this.U = []; this.C = []; }
    tri(a, b, c, ua, ub, uc, col) { this.P.push(...a, ...b, ...c); this.U.push(...ua, ...ub, ...uc); for (let i = 0; i < 3; i++) this.C.push(...(Array.isArray(col[0]) ? col[i] : col)); }
    quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col = [1, 1, 1]) { const cs = Array.isArray(col[0]) ? col : [col, col, col, col]; this.tri(a, b, c, uv[0], uv[1], uv[2], [cs[0], cs[1], cs[2]]); this.tri(a, c, d, uv[0], uv[2], uv[3], [cs[0], cs[2], cs[3]]); }
    obox(c, u, v, w, col = [1, 1, 1]) { // oriented box: centre + 3 half-axis vectors
      const P = (i, j, k) => [c[0] + u[0] * i + v[0] * j + w[0] * k, c[1] + u[1] * i + v[1] * j + w[1] * k, c[2] + u[2] * i + v[2] * j + w[2] * k];
      const L = (a) => Math.hypot(...a), lu = L(u) * 2, lv = L(v) * 2, lw = L(w) * 2, s = (k) => col.map((x) => x * k);
      this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), [[0, 0], [lu, 0], [lu, lv], [0, lv]], s(1)); this.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), [[0, 0], [lu, 0], [lu, lv], [0, lv]], s(0.9));
      this.quad(P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), [[0, 0], [lw, 0], [lw, lu], [0, lu]], s(1.06)); this.quad(P(-1, -1, 1), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), [[0, 0], [lw, 0], [lw, lu], [0, lu]], s(0.7));
      this.quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), [[0, 0], [lw, 0], [lw, lv], [0, lv]], s(0.95)); this.quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), [[0, 0], [lw, 0], [lw, lv], [0, lv]], s(0.95)); }
    box(cx, cy, cz, sx, sy, sz, col) { this.obox([cx, cy, cz], [sx / 2, 0, 0], [0, sy / 2, 0], [0, 0, sz / 2], col); }
    geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.computeVertexNormals(); return g; } }
  const mesh = (gb, mat, name) => { if (!gb.P.length) return null; const m = new THREE.Mesh(gb.geo(), mat); m.name = name; m.raycast = noRay; m.matrixAutoUpdate = false; m.updateMatrix(); root.add(m); return m; };
  const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const tex = (w, h, draw, rep = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = isMobile ? 2 : 4; return t; };
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }, o));
  // ---- textures
  const thatchT = tex(256, 256, (g, w, h) => { let s = 77; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647); g.fillStyle = '#6b5039'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { const x = R() * w, y = R() * h, l = 10 + R() * 34; const d = R() < 0.55; g.strokeStyle = d ? `rgba(28,18,12,${0.22 + R() * 0.3})` : `rgba(${150 + R() * 50 | 0},${112 + R() * 36 | 0},${78 + R() * 24 | 0},${0.16 + R() * 0.22})`; g.lineWidth = 0.6 + R() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 2.5, y + l); g.stroke(); }
    for (let k = 0; k < 4; k++) { const y = k * 64 + 58, gr = g.createLinearGradient(0, y - 10, 0, y + 5); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,10,5,0.32)'); g.fillStyle = gr; g.fillRect(0, y - 10, w, 15); } });
  const cutT = tex(256, 64, (g, w, h) => { let s = 91; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647); g.fillStyle = '#5c4532'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { const v = R(); g.fillStyle = `rgb(${70 + v * 110 | 0},${52 + v * 80 | 0},${36 + v * 52 | 0})`; g.beginPath(); g.ellipse(R() * w, R() * h, 0.8 + R() * 1.6, 0.8 + R() * 1.4, 0, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(25,15,8,0.55)'; for (const y of [h * 0.34, h * 0.68]) g.fillRect(0, y, w, 2); });
  const makuT = tex(512, 128, (g, w, h) => { g.fillStyle = '#3d1a5c'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) { const k = 0.5 + 0.5 * Math.sin(x / w * Math.PI * 2 * 10); g.fillStyle = `rgba(${k > 0.5 ? '120,80,170' : '10,0,20'},${Math.abs(k - 0.5) * 0.32})`; g.fillRect(x, 0, 1, h); }
    g.fillStyle = '#c9a24a'; g.fillRect(0, 4, w, 5); g.fillStyle = 'rgba(255,240,210,0.7)'; g.fillRect(0, 12, w, 2);
    for (let i = 0; i < 2; i++) { const cx = w / 4 + i * w / 2, cy = 70; g.fillStyle = '#efe9f2'; g.beginPath(); g.arc(cx, cy, 30, 0, 6.3); g.fill(); g.fillStyle = '#3d1a5c'; g.beginPath(); g.arc(cx, cy, 25, 0, 6.3); g.fill();
      g.fillStyle = '#efe9f2'; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 7, 10, a + Math.PI / 2, 0, 6.3); g.fill(); } g.fillStyle = '#3d1a5c'; g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 10, w, 10); });
  const strandT = tex(64, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(0,0,0,${0.08 + 0.22 * ((x * 37) % 11) / 11})`; g.fillRect(x, 0, 1, h); } const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const ceilT = tex(128, 128, (g, w, h) => { g.fillStyle = '#2a1c14'; g.fillRect(0, 0, w, h); g.fillStyle = '#5e4330'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, h); g.fillStyle = 'rgba(201,162,74,0.6)'; g.fillRect(3, 3, 4, 4); });
  const mThatch = std({ map: thatchT, roughness: 0.95 }), mCut = std({ map: cutT, roughness: 0.95 }), mWood = std({ roughness: 0.7 }), mGold = std({ metalness: 0.75, roughness: 0.35 }),
    mMaku = std({ map: makuT, roughness: 0.75 }), mCeil = std({ map: ceilT, roughness: 0.9 });
  // ---- roof dimensions (inside the old roof's x/z box; eaves as low as the old maku band)
  // r7: real Kokugikan proportions - broad, ~27 deg main slope, wide eaves; footprint a bit beyond the mound (base +-4.85),
  //     centred on the ring centre C, eave hung 1.6x the mound-top width (7.7) above the mound top.
  const topW = 7.7, Hx = 6.0, Hz = 5.7, yE = +(Y0 + 0.8 * topW).toFixed(2), th = 0.45, kS = Math.tan(27 / 57.2958), yR = yE + th + Hz * kS; const yTop = (z) => yR - Math.abs(z) * kS, yBot = (z) => yTop(z) - th; const ax = 4.75, az = 4.75; // keta frame: corners right above the mound base corners (fusa hang straight down from them)
  const X = (x) => C.x + x, Z = (z) => C.z + z;
  const T = new GB(), Cu = new GB(), W = new GB(), G = new GB(), M = new GB(), Ce = new GB();
  const wDark = hex('#2b1d16'), wHino = hex('#a27448'), wMid = hex('#6e5038'), gold = hex('#d8ad52');
  // thatch slabs (two slopes): top + underside, rows so the course lines follow the slope
  for (const s of [-1, 1]) { const zs = [s * Hz, 0];
    T.quad([X(-Hx), yTop(zs[0]), Z(zs[0])], [X(Hx), yTop(zs[0]), Z(zs[0])], [X(Hx), yTop(0), Z(0)], [X(-Hx), yTop(0), Z(0)], [[0, 0], [2 * Hx / 1.7, 0], [2 * Hx / 1.7, Hz * 1.3 / 1.7], [0, Hz * 1.3 / 1.7]], [0.92, 0.92, 0.92]);
    Cu.quad([X(-Hx), yBot(zs[0]), Z(zs[0])], [X(Hx), yBot(zs[0]), Z(zs[0])], [X(Hx), yBot(0), Z(0)], [X(-Hx), yBot(0), Z(0)], [[0, 0], [2 * Hx / 2, 0], [2 * Hx / 2, 2], [0, 2]], [0.42, 0.36, 0.32]);
    // eave fascia (cut thatch ends) + a lighter lower lip
    Cu.quad([X(-Hx), yBot(s * Hz), Z(s * Hz)], [X(Hx), yBot(s * Hz), Z(s * Hz)], [X(Hx), yTop(s * Hz), Z(s * Hz)], [X(-Hx), yTop(s * Hz), Z(s * Hz)], [[0, 0], [2 * Hx / 1.6, 0], [2 * Hx / 1.6, 1], [0, 1]], [1.15, 1.1, 1.05]);
    // gable verge edges (slab thickness seen from the gable side)
    for (const e of [-1, 1]) Cu.quad([X(e * Hx), yBot(s * Hz), Z(s * Hz)], [X(e * Hx), yBot(0), Z(0)], [X(e * Hx), yTop(0), Z(0)], [X(e * Hx), yTop(s * Hz), Z(s * Hz)], [[0, 0], [Hz * 1.3 / 1.6, 0], [Hz * 1.3 / 1.6, 1], [0, 1]], [1.0, 0.95, 0.9]); }
  // ridge: munaoi block + gold-trimmed cap
  W.box(X(0), yR + 0.12, Z(0), 2 * Hx + 0.3, 0.42, 0.95, wDark); W.box(X(0), yR + 0.37, Z(0), 2 * Hx + 0.4, 0.1, 0.62, hex('#1a120d')); G.box(X(0), yR + 0.43, Z(0), 2 * Hx + 0.42, 0.03, 0.2, gold);
  for (const e of [-1, 1]) G.box(X(e * (Hx + 0.17)), yR + 0.13, Z(0), 0.06, 0.44, 0.97, gold);
  // katsuogi: 6 logs across the ridge, gold end caps (instanced cylinders below)
  const nK = 6, kat = []; for (let i = 0; i < nK; i++) kat.push(-Hx + 0.95 + (2 * Hx - 1.9) * i / (nK - 1));
  // chigi: verge boards on both gables continued past the ridge so they cross in an X
  for (const e of [-1, 1]) for (const s of [-1, 1]) { const x = X(e * (Hx + 0.08)); const z0 = s * (Hz + 0.12), y0 = yTop(z0) + 0.02, z1 = -s * 2.1, y1 = yR + 2.1 * kS; const dz = z1 - z0, dy = y1 - y0, L = Math.hypot(dz, dy);
    const u = [0, dy / 2, dz / 2], nv = [0, (-s) * 0 + Math.abs(dz) / L, -dy / L * Math.sign(dz) * -1]; const vh = [0, nv[1] * 0.2, nv[2] * 0.2];
    // centre lifted off the slope by half the board width (perpendicular, upward)
    const up = [0, Math.abs(dz) / L, (s > 0 ? 1 : -1) * Math.abs(dy) / L]; const cc = [x, (y0 + y1) / 2 + up[1] * 0.2, Z((z0 + z1) / 2) + up[2] * 0.2];
    W.obox(cc, u, [0, up[1] * 0.2, up[2] * 0.2], [0.07, 0, 0], wDark);
    G.obox([x, y1 + up[1] * 0.2 - dy / L * 0.06, Z(z1) + up[2] * 0.2 - dz / L * 0.06], [0, dy / L * 0.07, dz / L * 0.07], [0, up[1] * 0.21, up[2] * 0.21], [0.08, 0, 0], gold); }
  // gable pediments (hinoki) with dark framing, set back under the roof
  for (const e of [-1, 1]) { const x = X(e * (Hx - 0.45)); const zA = az + 0.05, yA = yBot(0) - 0.05;
    W.tri([x, yE, Z(-zA)], [x, yE, Z(zA)], [x, yA, Z(0)], [0, 0], [1, 0], [0.5, 1], wHino);
    W.box(x + e * 0.04, (yE + yA) / 2, Z(0), 0.06, yA - yE, 0.24, wDark); // munamochi-bashira
    for (const f of [0.38, 0.7]) { const y = yE + (yA - yE) * f, half = zA * (1 - f); W.box(x + e * 0.04, y, Z(0), 0.06, 0.16, 2 * half, wDark); }
    for (const zf of [-0.66, -0.33, 0.33, 0.66]) { const zq = zf * zA, yq = yE + (yA - yE) * (1 - Math.abs(zf)) - 0.08; W.box(x + e * 0.04, (yE + yq) / 2, Z(zq), 0.06, yq - yE, 0.1, wMid); }
    G.box(x + e * 0.08, yE + (yA - yE) * 0.38, Z(0), 0.04, 0.2, 0.2, gold); G.box(x + e * 0.08, yE + (yA - yE) * 0.7, Z(0), 0.04, 0.16, 0.16, gold);
    W.box(x + e * 0.05, yE + 0.08, Z(0), 0.08, 0.16, 2 * zA, wDark); }
  // keta frame + coffered ceiling
  for (const s of [-1, 1]) { W.box(X(0), yE - 0.15, Z(s * az), 2 * ax + 0.3, 0.3, 0.3, wDark); W.box(X(s * ax), yE - 0.15, Z(0), 0.3, 0.3, 2 * az + 0.3, wDark); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(X(sx * ax), yE - 0.15, Z(sz * az), 0.34, 0.12, 0.34, gold);
  Ce.quad([X(-ax), yE - 0.3, Z(-az)], [X(ax), yE - 0.3, Z(-az)], [X(ax), yE - 0.3, Z(az)], [X(-ax), yE - 0.3, Z(az)], [[0, 0], [2 * ax / 0.9, 0], [2 * ax / 0.9, 2 * az / 0.9], [0, 2 * az / 0.9]], [1, 1, 1]);
  // soffit rafters between frame and eave
  for (const s of [-1, 1]) for (let i = 0; i <= 12; i++) { const x = -Hx + 0.3 + (2 * Hx - 0.6) * i / 12, zA = s * (az + 0.15), zB = s * (Hz - 0.05); W.obox([X(x), (yBot(zA) + yBot(zB)) / 2 - 0.07, Z((zA + zB) / 2)], [0, (yBot(zB) - yBot(zA)) / 2, (zB - zA) / 2], [0, 0.07, 0], [0.06, 0, 0], wMid); }
  // mizuhiki-maku: purple band on the frame, gathered by 2 tassel ties per side (3 swags), slight outward belly
  const tieP = []; const mx = ax + 0.17, mz = az + 0.17, yT0 = yE - 0.02, dTie = 0.85, sag = 0.34;
  const side = (A, B, nrm) => { const N = 30, len = Math.hypot(B[0] - A[0], B[1] - A[1]); for (let i = 0; i < N; i++) { const f0 = i / N, f1 = (i + 1) / N; const P = (f, top) => { const sw = Math.sin(Math.PI * ((f * 3) % 1)); const x = A[0] + (B[0] - A[0]) * f + nrm[0] * 0.07 * sw, z = A[1] + (B[1] - A[1]) * f + nrm[1] * 0.07 * sw; return [X(x), top ? yT0 : yT0 - dTie - sag * sw, Z(z)]; };
      M.quad(P(f0, 0), P(f1, 0), P(f1, 1), P(f0, 1), [[f0 * len / 3, 0], [f1 * len / 3, 0], [f1 * len / 3, 1], [f0 * len / 3, 1]], [1, 1, 1]); }
    for (const f of [1 / 3, 2 / 3]) tieP.push(new THREE.Vector3(X(A[0] + (B[0] - A[0]) * f + nrm[0] * 0.03), yT0 - dTie + 0.02, Z(A[1] + (B[1] - A[1]) * f + nrm[1] * 0.03))); };
  side([-mx, -mz], [mx, -mz], [0, -1]); side([mx, -mz], [mx, mz], [1, 0]); side([mx, mz], [-mx, mz], [0, 1]); side([-mx, mz], [-mx, -mz], [-1, 0]);
  // cables: 4 thin lines from gold fittings on the slopes straight up into the dusk, alpha fading out
  const cab = { P: [], C: [] }; const cabTop = 64; const fit = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (Hx - 1.15), z = sz * 1.7, y = yTop(z); fit.push([x, y, z]); const w = 0.035;
    for (const [dx, dz] of [[w, 0], [0, w]]) { const a = [X(x - dx), y, Z(z - dz)], b = [X(x + dx), y, Z(z + dz)], c2 = [X(x + dx), cabTop, Z(z + dz)], d = [X(x - dx), cabTop, Z(z - dz)]; cab.P.push(...a, ...b, ...c2, ...a, ...c2, ...d);
      const lo = [0.08, 0.06, 0.1, 0.95], hi = [0.08, 0.06, 0.1, 0]; cab.C.push(...lo, ...lo, ...hi, ...lo, ...hi, ...hi); }
    G.box(X(x), y + 0.12, Z(z), 0.28, 0.24, 0.28, gold); }
  mesh(T, mThatch, 'AD3_tsuriyane_thatch'); mesh(Cu, mCut, 'AD3_tsuriyane_cut'); mesh(W, mWood, 'AD3_tsuriyane_wood'); mesh(G, mGold, 'AD3_tsuriyane_gold'); mesh(M, mMaku, 'AD3_mizuhiki_maku'); mesh(Ce, mCeil, 'AD3_tsuriyane_ceiling');
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(cab.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cab.C, 4));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.name = 'AD3_tsuriyane_cables'; m.raycast = noRay; m.frustumCulled = false; root.add(m); }
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), V1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  // katsuogi (instanced): logs + gold caps
  { const lg = new THREE.CylinderGeometry(0.16, 0.16, 1.5, 12); lg.rotateX(Math.PI / 2); const cg = new THREE.CylinderGeometry(0.175, 0.175, 0.12, 12); cg.rotateX(Math.PI / 2);
    const L = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0x2e2018, roughness: 0.7 }), nK), Cp = new THREE.InstancedMesh(cg, mGold.clone(), nK * 2); Cp.material.vertexColors = false; Cp.material.color.set(0xd8ad52);
    kat.forEach((x, i) => { L.setMatrixAt(i, M4.makeTranslation(X(x), yR + 0.62, Z(0))); for (const e of [-1, 1]) Cp.setMatrixAt(i * 2 + (e > 0 ? 1 : 0), M4.makeTranslation(X(x), yR + 0.62, Z(e * 0.75))); });
    L.name = 'AD3_katsuogi'; Cp.name = 'AD3_katsuogi_caps'; L.raycast = Cp.raycast = noRay; root.add(L, Cp); }
  // tassel ties + fusa share one lathe tassel (instanced, per-instance colour)
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const fusaGeo = (Lc) => mergeGeometries([lathe([[0, 0], [0.12, 0], [0.15, -0.08], [0.15, -0.22], [0.12, -0.28], [0.15, -0.38], [0.21, -0.9], [0.26, -1.45], [0.3, -1.9], [0.24, -1.97], [0, -1.99]], isMobile ? 10 : 16),
    new THREE.SphereGeometry(0.17, isMobile ? 10 : 14, 8).translate(0, 0.15, 0), new THREE.CylinderGeometry(0.028, 0.028, Lc, 5).translate(0, 0.3 + Lc / 2, 0), new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0.3 + Lc * 0.985, 0)].map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; }), false);
  const fusaBot = Y0 + 1.95, fusaTop = yE - 0.3, fusaLc = Math.max(1, fusaTop - (fusaBot + 1.99) - 0.3), fusaG = fusaGeo(fusaLc);
  const fusaM = new THREE.MeshStandardMaterial({ map: strandT, roughness: 0.8 }); const FU = [['NE', 1, -1, '#1f8a46'], ['SE', 1, 1, '#c3202c'], ['SW', -1, 1, '#f1ede4'], ['NW', -1, -1, '#17161a']];
  const fusa = new THREE.InstancedMesh(fusaG, fusaM, 4), fusaCap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0xd8ad52, metalness: 0.75, roughness: 0.35 }), 4);
  const fusaAt = FU.map(([n, sx, sz, c], i) => { const p = new THREE.Vector3(X(sx * ax), fusaBot + 1.99, Z(sz * az)); fusa.setColorAt(i, new THREE.Color(c)); return { n, p, ph: i * 1.7 }; });
  fusa.name = 'AD3_fusa'; fusaCap.name = 'AD3_fusa_caps'; fusa.raycast = fusaCap.raycast = noRay; root.add(fusa, fusaCap); log.fusa = FU.map((f) => f[0] + ':' + f[3]);
  const ties = new THREE.InstancedMesh(fusaGeo(1.0), new THREE.MeshStandardMaterial({ map: strandT, roughness: 0.8 }), tieP.length);
  tieP.forEach((p, i) => { ties.setMatrixAt(i, M4.compose(p.clone().add(new THREE.Vector3(0, -0.26, 0)), Qt.identity(), new THREE.Vector3(0.48, 0.3, 0.48))); ties.setColorAt(i, new THREE.Color(i % 2 ? '#d8ad52' : '#6a3a96')); });
  ties.name = 'AD3_maku_ties'; ties.raycast = noRay; root.add(ties);
  const swayFusa = (t) => { fusaAt.forEach((f, i) => { const a = Math.sin(t * 0.6 + f.ph) * 0.012, b = Math.cos(t * 0.5 + f.ph) * 0.01; Qt.setFromEuler(new THREE.Euler(a, 0, b)); const top = new THREE.Vector3(f.p.x, fusaTop, f.p.z);
    const off = new THREE.Vector3(0, f.p.y - top.y, 0).applyQuaternion(Qt); fusa.setMatrixAt(i, M4.compose(top.clone().add(off), Qt, V1)); fusaCap.setMatrixAt(i, M4.compose(top.clone().add(off.clone().add(new THREE.Vector3(0, -0.25, 0).applyQuaternion(Qt))), Qt, V1)); });
    fusa.instanceMatrix.needsUpdate = fusaCap.instanceMatrix.needsUpdate = true; };
  swayFusa(0);
  // ---- r7 tawara: the glb ring + square bales read chunky. Drop their triangles (centroid above the plateau; the low step bales stay)
  //     and rebuild slim, round, rope-bound bales half-buried in the clay: 16 ring bales + 4 tokudawara shifted out (the 4 gaps),
  //     8 kakudawara per side on the plateau edge. One instanced draw call.
  dohyo.traverse((o) => { if (!o.isMesh || !/straw_tawara/.test(o.material?.name || '')) return; const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); const P = g.attributes.position, keep = [], v = new THREE.Vector3(); let cy = 0;
    for (let t = 0; t < P.count; t += 3) { cy = 0; for (let k = 0; k < 3; k++) cy += v.fromBufferAttribute(P, t + k).applyMatrix4(o.matrixWorld).y; if (cy / 3 > Y0 - 0.08) continue; keep.push(t); }
    const ng = new THREE.BufferGeometry(); for (const [k, A] of Object.entries(g.attributes)) { const n = A.itemSize, src = A.array, dst = new src.constructor(Math.max(1, keep.length) * 3 * n); keep.forEach((t, i) => dst.set(src.subarray(t * n, (t + 3) * n), i * 3 * n)); ng.setAttribute(k, new THREE.BufferAttribute(dst, n, A.normalized)); }
    if (!keep.length) ng.setDrawRange(0, 0); log.tawaraCut = (P.count - keep.length * 3) / 3; o.geometry = ng; });
  { const baleT = tex(64, 128, (g, w, h) => { let s2 = 31; const R2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647); g.fillStyle = '#d4bd84'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { g.strokeStyle = R2() < 0.5 ? 'rgba(120,96,50,0.45)' : 'rgba(250,235,190,0.45)'; g.lineWidth = 0.7; const x = R2() * w, y = R2() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R2() - 0.5), y + 8 + R2() * 14); g.stroke(); }
      for (const y of [0.2, 0.4, 0.6, 0.8]) { g.fillStyle = '#6f5a32'; g.fillRect(0, y * h - 3, w, 5); g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(0, y * h - 3, w, 1); } });
    const bg = new THREE.CapsuleGeometry(0.105, 0.66, 4, isMobile ? 8 : 12); bg.rotateZ(Math.PI / 2); // long axis = x
    const bales = []; const rr0 = 2.88, by = Y0 - 0.005; // centre just above the clay: the lower half is buried
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, toku = i % 5 === 0, rr = toku ? rr0 + 0.24 : rr0; bales.push([Math.cos(a) * rr, Math.sin(a) * rr, -a + Math.PI / 2, toku ? 0.92 : 1.03]); }
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0; k < 8; k++) { const t = -3.32 + k * 0.95, e = 3.72; bales.push([nx ? nx * e : t, nz ? nz * e : t, nx ? Math.PI / 2 : 0, 1.09]); }
    const BI = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ map: baleT, roughness: 0.9 }), bales.length);
    bales.forEach(([x, z, ry, k], i) => { BI.setMatrixAt(i, M4.compose(new THREE.Vector3(X(x), by, Z(z)), Qt.setFromAxisAngle(up, ry), new THREE.Vector3(k, 1, 1))); BI.setColorAt(i, new THREE.Color().setHSL(0.125, 0.42, 0.68 + 0.07 * ((i * 7) % 5) / 4)); });
    BI.name = 'AD3_tawara'; BI.raycast = noRay; root.add(BI); log.bales = bales.length; log.toku = 4; }
  // ---- mound dressing: tokudawara (4 circle gaps), salt baskets, chikara-mizu buckets
  { const Dg = new GB(); const straw = hex('#cdb57a'), rope = hex('#8f7a48');
    for (const sx of [-1, 1]) { const x = X(sx * 3.3), z = Z(3.3); Dg.box(x, Y0 + 0.13, z, 0.5, 0.26, 0.5, hex('#a88353')); Dg.box(x, Y0 + 0.27, z, 0.54, 0.03, 0.54, hex('#6d5232'));
      for (let k = 0; k < 7; k++) Dg.box(x + (r() - 0.5) * 0.2, Y0 + 0.3 + k * 0.012, z + (r() - 0.5) * 0.2, 0.36 - k * 0.045, 0.03, 0.36 - k * 0.045, hex('#f4f2ec')); }
    for (const sx of [-1, 1]) { const x = X(sx * 5.45), z = Z(-3.2); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; Dg.obox([x + Math.cos(a) * 0.26, 0.24, z + Math.sin(a) * 0.26], [-Math.sin(a) * 0.105, 0, Math.cos(a) * 0.105], [0, 0.24, 0], [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03], hex('#9b7448')); }
      Dg.box(x, 0.47, z, 0.56, 0.02, 0.56, hex('#7fa8c8')); for (const y of [0.1, 0.38]) Dg.box(x, y, z, 0.6, 0.04, 0.6, hex('#2a2a2e')); Dg.obox([x + 0.18, 0.62, z], [0.22, 0.12, 0], [0, 0.015, 0], [0, 0, 0.015], hex('#c9a46a')); blockers.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 0.3, z), new THREE.Vector3(0.8, 0.6, 0.8))); }
    mesh(Dg, std({ roughness: 0.9 }), 'AD3_dohyo_dressing'); }
  // ---- masu-seki: tiered boxes on 4 sides (hanamichi aisles E/W), clash-tested; spectators sit facing the ring
  const Ms = new GB(), Rl = new GB(); const zab = [hex('#8c1f2c'), hex('#7a1a3a'), hex('#9a2a2a')]; const seats = [];
  const rows = [{ d: 7.0, h: 0.16 }, { d: 8.75, h: 0.42 }], BS = 1.6;
  for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const ew = nx !== 0; for (const row of rows) { const lim = ew ? row.d - BS : row.d, cnt = Math.floor(2 * lim / 1.75 + 1e-6) + 1; for (let ii = 0; ii < cnt; ii++) { const tt = -(cnt - 1) * 1.75 / 2 + ii * 1.75; if (ew && Math.abs(tt) < 1.0) continue;
      const tx = -nz, tz = nx; const cx = nx * row.d + tx * tt, cz = nz * row.d + tz * tt; const wb = new THREE.Box3(new THREE.Vector3(X(cx) - 0.85, 0, Z(cz) - 0.85), new THREE.Vector3(X(cx) + 0.85, 1.2, Z(cz) + 0.85));
      const hit = clash(wb); if (hit.length) { log.skipped.push([+cx.toFixed(1), +cz.toFixed(1), hit[0]]); continue; }
      const top = row.h; Ms.box(X(cx), top / 2, Z(cz), BS, top, BS, hex(row.h > 0.3 ? '#4a3a30' : '#5a4636')); blockers.push(wb);
      for (const s of [-1, 1]) { Rl.box(X(cx + s * BS / 2), top + 0.14, Z(cz), 0.05, 0.05, BS, [0.72, 0.73, 0.76]); Rl.box(X(cx), top + 0.14, Z(cz + s * BS / 2), BS, 0.05, 0.05, [0.72, 0.73, 0.76]); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) Rl.box(X(cx + sx * BS / 2), top + 0.07, Z(cz + sz * BS / 2), 0.06, 0.14, 0.06, [0.6, 0.6, 0.64]);
      const u0 = r(), n = u0 < 0.1 ? 0 : u0 < 0.33 ? 1 : u0 < 0.62 ? 2 : u0 < 0.86 ? 3 : 4, zc = zab[Math.floor(r() * 3)]; const sl = [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]];
      sl.forEach(([a, b], k) => { const sk = (r() - 0.5) * 0.35, ca = Math.cos(sk) * 0.33, sa = Math.sin(sk) * 0.33; Ms.obox([X(cx + a + (r() - 0.5) * 0.05), top + 0.04, Z(cz + b + (r() - 0.5) * 0.05)], [ca, 0, sa], [0, 0.04, 0], [-sa, 0, ca], zc.map((v) => v * (0.92 + 0.12 * ((k * 3) % 2)))); });
      // seat order: front pair (toward the ring) first
      const ord = sl.slice().sort((p0, p1) => (p0[0] * nx + p0[1] * nz) - (p1[0] * nx + p1[1] * nz)); const ordR = (r() < 0.5 ? ord : ord.map((v, k) => [v, r()]).sort((p0, p1) => p0[1] - p1[1]).map((v) => v[0])); for (let k = 0; k < n; k++) seats.push({ x: X(cx + ordR[k][0]), y: top + 0.08, z: Z(cz + ordR[k][1]) });
      log.masu++; } } }
  mesh(Ms, std({ roughness: 0.92 }), 'AD3_masu_seki'); mesh(Rl, std({ metalness: 0.6, roughness: 0.4 }), 'AD3_masu_rails');
  // spectators: glb fan-atlas marbles, r ~0.3, facing the ring; static ones merged, a few animated
  const anim = [];
  if (fanPool.length && seats.length) { const R0 = 0.3, nA = Math.min(isMobile ? 8 : 14, seats.length), pick = new Set(); while (pick.size < nA) pick.add(Math.floor(r() * seats.length));
    const groups = new Map(); seats.forEach((s, i) => { const f = fanPool[i % fanPool.length]; const sc = R0 / Math.max(0.05, f.rad); const ry = Math.atan2(C.x - s.x, C.z - s.z) + (r() - 0.5) * 0.4;
      const p = new THREE.Vector3(s.x, s.y + R0, s.z), qq = new THREE.Quaternion().setFromAxisAngle(up, ry), sv = new THREE.Vector3(sc, sc, sc);
      if (pick.has(i)) { const m = new THREE.Mesh(f.g, f.mat); m.position.copy(p); m.quaternion.copy(qq); m.scale.copy(sv); m.name = 'AD3_fan_cheer_' + anim.length; m.raycast = noRay; root.add(m); anim.push({ m, p0: p.clone(), q0: qq.clone(), ph: r() * 6.3, k: 0.6 + r() * 0.8 }); return; }
      const g = f.g.clone().applyMatrix4(M4.compose(p, qq, sv)); const key = f.mat.uuid; (groups.get(key) || groups.set(key, { mat: f.mat, gs: [] }).get(key)).gs.push(g); });
    for (const { mat, gs } of groups.values()) { const g = gs.length > 1 ? mergeGeometries(gs, false) : gs[0]; if (!g) continue; const m = new THREE.Mesh(g, mat); m.name = 'AD3_fans_seated'; m.raycast = noRay; m.matrixAutoUpdate = false; root.add(m); }
    log.fans = seats.length; log.anim = anim.length; }
  const update = (dt, t) => { swayFusa(t);
    for (const a of anim) { const cheer = Math.max(0, Math.sin(t * 0.55 + a.ph)); const hop = Math.abs(Math.sin(t * 6.5 * a.k + a.ph)) * 0.22 * cheer; a.m.position.set(a.p0.x, a.p0.y + hop, a.p0.z);
      a.m.quaternion.copy(a.q0); a.m.rotateZ(Math.sin(t * 3.1 + a.ph) * 0.18 * cheer); a.m.rotateX(-0.12 * cheer); } };
  { // r7 roof clearance: small props by box, track by its real vertices (floor/rails/posts) inside the roof hull + 0.4
    const hb = new THREE.Box3(new THREE.Vector3(X(-Hx - 0.4), yE - 1.3, Z(-Hz - 0.4)), new THREE.Vector3(X(Hx + 0.4), yR + 2.1 * kS + 0.7, Z(Hz + 0.4)));
    log.roofHits = clash(hb); let nT = 0; const v = new THREE.Vector3(); world3d.traverse((o) => { if (!o.isMesh || !/^TRACK_/.test(o.name)) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); if (hb.containsPoint(v)) nT++; } });
    log.roofTrackVerts = nT; log.roofBox = [hb.min.toArray().map((x) => +x.toFixed(2)), hb.max.toArray().map((x) => +x.toFixed(2))]; }
  { // r8: FX_heart_pole_0 + its pennant (art-lane decoration) lined up under the roof from every east view. 6 m north was not enough (the roof spans ~30 deg seen from the east cams); 18 m north + 3 m east (-z/+x) clears them all with a 4 deg margin. Nearer spots hit cherry trees v41/v11. Clash-checked
    const P0 = world3d.getObjectByName('FX_heart_pole_0'), P1 = world3d.getObjectByName('FX_heart_pennant_0'), objs = [P0, P1].filter(Boolean);
    if (objs.length) { const own = new Set(); objs.forEach((o) => o.traverse((m) => own.add(m.name))); const bb = () => { const b = new THREE.Box3(); objs.forEach((o) => b.expandByObject(o)); return b; };
      const from = bb().getCenter(new THREE.Vector3()); let used = null, hits = null;
      for (const [dx, dz] of [[3, -18], [3, -19], [4, -18], [3, -17.5], [4, -17], [2.5, -19]]) { const b = bb(); b.min.z += dz; b.max.z += dz; b.min.x += dx; b.max.x += dx; b.expandByScalar(0.3);
        const h = boxes.filter((e) => !own.has(e.n) && e.b.intersectsBox(b)).map((e) => e.n); let nT = 0; const v = new THREE.Vector3();
        world3d.traverse((o) => { if (!o.isMesh || !/^TRACK_/.test(o.name)) return; const PA = o.geometry.attributes.position; for (let i = 0; i < PA.count; i += 2) { v.fromBufferAttribute(PA, i).applyMatrix4(o.matrixWorld); if (b.containsPoint(v)) { nT++; break; } } });
        if (!h.length && !nT) { used = [dx, dz]; break; } if (!hits) hits = [dx, dz, h.slice(0, 3), nT]; }
      if (used !== null) { for (const o of objs) { const w = o.getWorldPosition(new THREE.Vector3()); w.x += used[0]; w.z += used[1]; o.parent.worldToLocal(w); o.position.copy(w); o.updateMatrixWorld(true); }
        for (const e of boxes) if (own.has(e.n)) { e.b.translate(new THREE.Vector3(used[0], 0, used[1])); } }
      log.pole = { from: [+from.x.toFixed(2), +from.z.toFixed(2)], to: used && [+(from.x + used[0]).toFixed(2), +(from.z + used[1]).toFixed(2)], moved: used, firstReject: hits, n: objs.length }; } else log.pole = { err: 'not found' }; }
  log.roof = { Hx, Hz, yE, yR: +yR.toFixed(2), pitchDeg: +(Math.atan(kS) * 57.3).toFixed(1), katsuogi: nK, chigiTop: +(yR + 2.1 * kS + 0.3).toFixed(2), ties: tieP.length, cables: 4, fusaCord: +fusaLc.toFixed(2), fusaTassel: 1.99, fusaBottom: +fusaBot.toFixed(2) };
  return { update, stats: () => log, blockers: () => blockers };
}
