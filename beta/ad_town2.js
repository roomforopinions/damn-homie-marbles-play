// Art Director · living town ROUND 2 (critic pass 2, 11-14). Runtime-only, zero GLB bytes (osaka_world.glb is at the 5.5 MB cap).
// Called once from ad_town.js. Everything here is look-lane dressing: no colliders, no track, no physics, no raycast targets.
//  1. Osaka Castle tenshu rebuilt procedurally (ref: Osaka Castle photos, Wikimedia Commons): concave battered ishigaki with
//     big corner stones, 5 diminishing white tiers with barred windows, verdigris copper roofs with sori (upturned corners),
//     chidori-hafu gables with gold gegyo, dark top storey with gold tiger/crane panels, mawari-en balcony, irimoya top roof
//     carrying the existing gold shachihoko pair. The old 8-primitive low-poly castle is hidden (its moat water is kept).
//  2. Blimp polish: cruciform tail fins with real thickness and red rudders, blinking nav lights (red/green/white strobe).
//     Parented to FX_dh_blimp under an FX_dh_blimp* name (main.js occluder filters skip it); the gondola stays the TV-cam lane's.
//  3. Canal street rhythm: the 8 canal machiya stand on a perfect 12 u grid. Narrow infill buildings (kura storehouse,
//     sign tower with a vertical lit kanban, low tea/sweet shop) close every gap with different heights/setbacks, plus
//     chochin strings under the eaves (Shinsekai/Dotonbori density, generic words only, no brands).
//  4. Taiyaki yatai with a live seller and a small queue (fish-shaped cakes on a tray, iron mould plate, steam).
// Mobile: merged per material (~14 draw calls total), no shadows, fewer lanterns on phones.
export function initTown2({ THREE, scene, world3d, isMobile = false, onTick }) {
  const noRay = () => {};
  const byName = (n) => world3d.getObjectByName(n);
  const root = new THREE.Group(); root.name = 'AD2_town'; scene.add(root);
  const log = { castle: false, blimp: false, infill: [], skipped: [], lanterns: 0, taiyaki: null, clashes: [] };
  world3d.updateMatrixWorld(true);
  // ---------- tiny geometry kit: non-indexed triangles with position/normal/uv/color, merged per material ----------
  class GB {
    constructor() { this.P = []; this.U = []; this.C = []; }
    tri(a, b, c, ua, ub, uc, col) { this.P.push(...a, ...b, ...c); this.U.push(...ua, ...ub, ...uc); for (let i = 0; i < 3; i++) this.C.push(...(Array.isArray(col[0]) ? col[i] : col)); }
    quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col = [1, 1, 1]) { const cs = Array.isArray(col[0]) ? col : [col, col, col, col];
      this.tri(a, b, c, uv[0], uv[1], uv[2], [cs[0], cs[1], cs[2]]); this.tri(a, c, d, uv[0], uv[2], uv[3], [cs[0], cs[2], cs[3]]); }
    box(cx, cy, cz, sx, sy, sz, col = [1, 1, 1], uvs = 1) { const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
      const q = (a, b, c, d, w, h, k = 1) => this.quad(a, b, c, d, [[0, 0], [w * uvs, 0], [w * uvs, h * uvs], [0, h * uvs]], col.map((v) => v * k));
      q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], sx, sy); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], sx, sy, 0.92);
      q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], sz, sy, 0.96); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], sz, sy, 0.96);
      q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], sx, sz, 1.05); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], sx, sz, 0.6); }
    geo(M) { const g = new THREE.BufferGeometry(); const P = new Float32Array(this.P);
      if (M) { const v = new THREE.Vector3(); for (let i = 0; i < P.length; i += 3) { v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(M); P[i] = v.x; P[i + 1] = v.y; P[i + 2] = v.z; } }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.computeVertexNormals(); return g; }
  }
  const mesh = (gb, mat, name, M, parent = root) => { if (!gb.P.length) return null; const m = new THREE.Mesh(gb.geo(M), mat); m.name = name; m.raycast = noRay; m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); return m; };
  const canvasTex = (w, h, draw, rep = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = isMobile ? 2 : 4; return t; };
  const puffTex = (() => { let q = 913; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647); return canvasTex(128, 128, (g) => { // r4: lumpy soft puff instead of a round gradient
    for (let i = 0; i < 9; i++) { const x = 64 + (r() - 0.5) * 44, y = 64 + (r() - 0.5) * 40, rad = 16 + r() * 22, gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(64, 64, 20, 64, 64, 63); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, 128, 128); }, false); })();
  const puff = (base, k, n) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, fog: true })); s.raycast = noRay; root.add(s);
    actors.push({ kind: 'steam', o: s, ph: k / n + Math.random() * 0.08, base, rot: Math.random() * 6.283, spin: (Math.random() - 0.5) * 1.8, sz: 0.85 + Math.random() * 0.3 }); };
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }, o)); // double-sided: procedural winding never culls a face
  let seed = 20261114; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  // clearance test against existing scenery (ignores ground, water, track high above street level, our own group)
  const boxes = [];
  world3d.traverse((o) => { if (!o.isMesh || !o.visible || /^(GROUND_|SEA|CANAL_water|LP3_bg|TRACK_PATH|TRACK_centerline|SPAWN|FINISH)/.test(o.name)) return; const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty() || b.max.x - b.min.x > 40 || b.max.z - b.min.z > 40) return; boxes.push({ n: o.name, b, o }); });
  const clash = (b, ignore) => boxes.filter((e) => e.b.intersectsBox(b) && !(ignore && ignore.test(e.n))).map((e) => e.n);

  // =====================================================================================================================
  // 1. OSAKA CASTLE
  // =====================================================================================================================
  try {
    const C = byName('PROP_osaka_castle');
    if (C) {
      C.traverse((m) => { if (m.isMesh && !/water/i.test(m.material.name || '')) m.visible = false; });
      const O = C.getWorldPosition(new THREE.Vector3()); const M = new THREE.Matrix4().makeTranslation(O.x, O.y, O.z);
      // textures
      const stoneTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#3d3a36'; g.fillRect(0, 0, w, h); let y = 0;
        while (y < h) { const rh = 34 + rnd() * 30; let x = -rnd() * 60; while (x < w) { const rw = 50 + rnd() * 70; const l = 150 + rnd() * 50 | 0, t = rnd();
          g.fillStyle = `rgb(${l + 8 * t | 0},${l - 2 | 0},${l - 14 - 10 * t | 0})`; g.beginPath(); const j = () => (rnd() - 0.5) * 6;
          g.moveTo(x + 3 + j(), y + 3 + j()); g.lineTo(x + rw - 3 + j(), y + 3 + j()); g.lineTo(x + rw - 3 + j(), y + rh - 3 + j()); g.lineTo(x + 3 + j(), y + rh - 3 + j()); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 4, y + 4, rw - 8, 3); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 4, y + rh - 8, rw - 8, 4); x += rw; } y += rh; } });
      const wallTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, h, 0, h * 0.7); gr.addColorStop(0, 'rgba(90,85,75,0.22)'); gr.addColorStop(1, 'rgba(90,85,75,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#d9d5ca'; g.fillRect(34, 30, 60, 52); g.fillStyle = '#1b1f22'; g.fillRect(40, 35, 48, 42); g.fillStyle = '#8d9196'; for (let i = 0; i < 6; i++) g.fillRect(43 + i * 8, 35, 3, 42);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(34, 82, 60, 3); });
      const topTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#1d2422'; g.fillRect(0, 0, w, h); g.fillStyle = '#c99a2e'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 10, w, 10);
        g.strokeStyle = '#d8aa3a'; g.lineWidth = 4; g.strokeRect(14, 22, 92, 84); g.fillStyle = '#e1b847'; // stylised gold tiger: body, head, stripes
        g.beginPath(); g.ellipse(60, 70, 32, 14, -0.15, 0, 7); g.fill(); g.beginPath(); g.arc(92, 58, 11, 0, 7); g.fill(); g.fillRect(34, 76, 7, 22); g.fillRect(70, 76, 7, 22); g.beginPath(); g.moveTo(28, 66); g.quadraticCurveTo(10, 40, 24, 32); g.lineWidth = 5; g.stroke();
        g.fillStyle = '#1d2422'; for (let i = 0; i < 4; i++) g.fillRect(44 + i * 11, 58, 4, 14);
        g.fillStyle = '#141a19'; g.fillRect(150, 34, 60, 64); g.fillStyle = '#6c7174'; for (let i = 0; i < 6; i++) g.fillRect(153 + i * 10, 34, 3, 64); g.strokeStyle = '#c99a2e'; g.lineWidth = 3; g.strokeRect(147, 31, 66, 70); });
      let rs = 77; const rr = () => ((rs = (rs * 16807) % 2147483647) / 2147483647); // own rng: keeps the shared seed sequence of r1-r3 intact
      const roofTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#467f6c'; g.fillRect(0, 0, w, h); // r4: oxidised copper (#4f8f7a family), one step deeper, less mint
        for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const v = (rr() - 0.5) * 14; g.fillStyle = `rgb(${70 + v | 0},${127 + v | 0},${108 + v | 0})`; g.fillRect(x + 4, y, 12, 16); }
        for (let x = 0; x < w; x += 16) { g.fillStyle = '#2b5649'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(140,190,170,0.35)'; g.fillRect(x + 9, 0, 2, h); }
        for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(20,50,42,0.45)'; g.fillRect(0, y + 14, w, 2); } });
      const roofN = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), im = g.createImageData(64, 64);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const fx = x % 16, fy = y % 16; let nx = 0, ny = 0;
          if (fx >= 4) { const a = (fx - 4 + 0.5) / 12 * Math.PI; nx = -Math.cos(a) * 0.8; } else nx = 0; // round tile hump across, flat channel
          if (fy >= 13) ny = 0.7; else if (fy <= 1) ny = -0.35; // course step: lower lip of each tile
          const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)), o = (y * 64 + x) * 4; im.data[o] = (nx * 0.5 + 0.5) * 255; im.data[o + 1] = (ny * 0.5 + 0.5) * 255; im.data[o + 2] = nz * 255; im.data[o + 3] = 255; }
        g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = isMobile ? 2 : 4; return t; })();
      const gableTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8aa3a'; g.beginPath(); g.moveTo(64, 4); g.lineTo(52, 22); g.lineTo(64, 18); g.lineTo(76, 22); g.closePath(); g.fill();
        g.beginPath(); g.arc(64, 26, 7, 0, 7); g.fill(); g.strokeStyle = '#d8aa3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 62); g.lineTo(64, 2); g.lineTo(124, 62); g.stroke(); }, false);
      const mStone = std({ map: stoneTex, roughness: 0.95 }), mWall = std({ map: wallTex, roughness: 0.9 }), mTop = std({ map: topTex, roughness: 0.6, metalness: 0.15 }),
        mRoof = std({ map: roofTex, normalMap: roofN, normalScale: new THREE.Vector2(0.9, 0.9), color: 0xe4ebe8, roughness: 0.55, metalness: 0.12 }), mUnder = std({ roughness: 0.95 }), mGold = std({ color: 0xecc062, roughness: 0.32, metalness: 0.8, emissive: 0x2a1a00 }), // r4: richer gold (was reading cream at dusk)
        mGable = std({ map: gableTex, roughness: 0.8, side: THREE.DoubleSide });
      const S = new GB(), W = new GB(), T = new GB(), R = new GB(), U = new GB(), Au = new GB(), D = U, Gb = new GB(); // dark trim shares the underside material (vertex colour) = one draw call fewer
      // ---- ishigaki: concave (ogi-kobai) battered base, 9 u
      const BH = 9, b0 = { x0: -11.6, x1: 11.6, z0: -10.8, z1: 12.2 }, b1 = { x0: -9.4, x1: 9.4, z0: -8.8, z1: 10.0 }, NV = 8;
      const rectAt = (t) => { const k = (1 - t) * (1 - t); return { x0: b1.x0 + (b0.x0 - b1.x0) * k, x1: b1.x1 + (b0.x1 - b1.x1) * k, z0: b1.z0 + (b0.z0 - b1.z0) * k, z1: b1.z1 + (b0.z1 - b1.z1) * k }; };
      for (let i = 0; i < NV; i++) { const ta = i / NV, tb = (i + 1) / NV, A = rectAt(ta), B = rectAt(tb), ya = ta * BH, yb = tb * BH;
        const ao = (t) => { const v = 0.55 + 0.45 * Math.min(1, t * 3); return [v, v * 0.98, v * 0.95]; }; const ca = ao(ta), cb = ao(tb);
        const side = (p0, p1, q0, q1, len) => S.quad(p0, p1, q1, q0, [[0, ya / 4], [len / 4, ya / 4], [len / 4, yb / 4], [0, yb / 4]], [ca, ca, cb, cb]);
        side([A.x0, ya, A.z1], [A.x1, ya, A.z1], [B.x0, yb, B.z1], [B.x1, yb, B.z1], A.x1 - A.x0); side([A.x1, ya, A.z0], [A.x0, ya, A.z0], [B.x1, yb, B.z0], [B.x0, yb, B.z0], A.x1 - A.x0);
        side([A.x1, ya, A.z1], [A.x1, ya, A.z0], [B.x1, yb, B.z1], [B.x1, yb, B.z0], A.z1 - A.z0); side([A.x0, ya, A.z0], [A.x0, ya, A.z1], [B.x0, yb, B.z0], [B.x0, yb, B.z1], A.z1 - A.z0); }
      // sangi-zumi corner stones: long/short alternating blocks hugging each arris
      for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, r = rectAt(t), y = t * BH, l = i % 2 ? 1.0 : 1.8, s = i % 2 ? 1.8 : 1.0, c = [0.86 + rnd() * 0.08, 0.84, 0.8];
        for (const [x, z, sx, sz] of [[r.x0, r.z0, l, s], [r.x1, r.z0, s, l], [r.x0, r.z1, s, l], [r.x1, r.z1, l, s]]) S.box(x + (x < 0 ? sx / 2 - 0.12 : -sx / 2 + 0.12), y, z + (z < 0 ? sz / 2 - 0.12 : -sz / 2 + 0.12), sx, BH / 9 - 0.08, sz, c, 0.5); }
      S.quad([b1.x0, BH, b1.z1], [b1.x1, BH, b1.z1], [b1.x1, BH, b1.z0], [b1.x0, BH, b1.z0], [[0, 0], [5, 0], [5, 5], [0, 5]], [0.8, 0.78, 0.74]);
      // gate: dark recessed opening with a small tiled roof on the town face
      D.box(0, 1.6, b0.z1 - 0.2, 3.2, 3.2, 0.6, hex('#1a1412')); D.box(0, 3.35, b0.z1 + 0.05, 3.8, 0.3, 0.5, hex('#2a201a'));
      // ---- tenshu tiers (Osaka: 5 outer roofs; white walls, dark gold top storey)
      const tiers = [{ hw: 8.6, hd: 8.0, h: 4.5 }, { hw: 7.5, hd: 6.9, h: 3.9 }, { hw: 6.4, hd: 5.8, h: 3.7 }, { hw: 5.2, hd: 4.7, h: 3.5 }, { hw: 4.1, hd: 3.6, h: 4.0, top: true }];
      let y = BH; const cz = 0.4; tiers.forEach((t) => { t.y0 = y; t.y1 = y + t.h; y = t.y1; });
      for (const t of tiers) { const B = t.top ? T : W, x0 = -t.hw, x1 = t.hw, z0 = cz - t.hd, z1 = cz + t.hd, rw = t.top ? 4.0 : 2.4, v1 = t === tiers[0] ? 2 : 1; // r3: the tall first storey carries two window rows
        const sideW = (a, b, c, d, len) => B.quad(a, b, c, d, [[0, 0], [Math.max(1, Math.round(len / rw)), 0], [Math.max(1, Math.round(len / rw)), v1], [0, v1]]);
        sideW([x0, t.y0, z1], [x1, t.y0, z1], [x1, t.y1, z1], [x0, t.y1, z1], 2 * t.hw); sideW([x1, t.y0, z0], [x0, t.y0, z0], [x0, t.y1, z0], [x1, t.y1, z0], 2 * t.hw);
        sideW([x1, t.y0, z1], [x1, t.y0, z0], [x1, t.y1, z0], [x1, t.y1, z1], 2 * t.hd); sideW([x0, t.y0, z0], [x0, t.y0, z1], [x0, t.y1, z1], [x0, t.y1, z0], 2 * t.hd);
        // corner posts / plinth line: thin dark sill and white-washed corner pilasters give the walls real thickness at the arrises
        for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) (t.top ? D : U).box(px, (t.y0 + t.y1) / 2, pz, 0.36, t.h, 0.36, t.top ? hex('#20201c') : hex('#e9e5da'));
        D.box(0, t.y0 + 0.08, cz, 2 * t.hw + 0.3, 0.16, 2 * t.hd + 0.3, hex('#3b3530')); }
      // mawari-en balcony on the top storey
      { const t = tiers[4], yb = t.y0 + 0.15, o = 0.75, x0 = -t.hw - o, x1 = t.hw + o, z0 = cz - t.hd - o, z1 = cz + t.hd + o, dk = hex('#241c18'), gd = [1, 0.78, 0.3];
        D.box(0, yb, cz, x1 - x0, 0.16, z1 - z0, dk); for (const [z, len] of [[z0, x1 - x0], [z1, x1 - x0]]) { D.box(0, yb + 1.0, z, len, 0.1, 0.1, dk); Au.box(0, yb + 1.06, z, len, 0.04, 0.12, gd); for (let x = x0; x <= x1 + 1e-3; x += 0.9) D.box(x, yb + 0.5, z, 0.08, 1.0, 0.08, dk); }
        for (const [x, len] of [[x0, z1 - z0], [x1, z1 - z0]]) { D.box(x, yb + 1.0, cz, 0.1, 0.1, len, dk); Au.box(x, yb + 1.06, cz, 0.12, 0.04, len, gd); for (let z = z0; z <= z1 + 1e-3; z += 0.9) D.box(x, yb + 0.5, z, 0.08, 1.0, 0.08, dk); } }
      // ---- roofs: concave hip skirts with sori, eave band, white underside; gold onigawara at the hips
      const skirt = (i, inner, yIn, outer, yOut, lift, gold) => { const N = 10, Rr = 4; const sides = [[[outer.x0, outer.z1], [outer.x1, outer.z1], [inner.x0, inner.z1], [inner.x1, inner.z1]], [[outer.x1, outer.z1], [outer.x1, outer.z0], [inner.x1, inner.z1], [inner.x1, inner.z0]],
          [[outer.x1, outer.z0], [outer.x0, outer.z0], [inner.x1, inner.z0], [inner.x0, inner.z0]], [[outer.x0, outer.z0], [outer.x0, outer.z1], [inner.x0, inner.z0], [inner.x0, inner.z1]]];
        const corners = [];
        for (const [oa, ob, ia, ib] of sides) { const len = Math.hypot(ob[0] - oa[0], ob[1] - oa[1]); const pt = (a, r) => { const s = a / N, e = Math.pow(Math.abs(2 * s - 1), 3), o = [oa[0] + (ob[0] - oa[0]) * s, oa[1] + (ob[1] - oa[1]) * s], n = [ia[0] + (ib[0] - ia[0]) * s, ia[1] + (ib[1] - ia[1]) * s];
            const u = r / Rr, cx = (o[0] + n[0]) / 2, czz = (o[1] + n[1]) / 2; const dx = o[0] - cx, dz = o[1] - czz; const push = 1 + 0.06 * e * u; // corners swept out a touch
            return [n[0] + (o[0] - n[0]) * u + dx * (push - 1), yIn + (yOut - yIn) * u + lift * e * u * u - 0.35 * Math.sin(Math.PI * u) * (1 - e * 0.5), n[1] + (o[1] - n[1]) * u + dz * (push - 1)]; };
          corners.push(pt(0, Rr));
          for (let a = 0; a < N; a++) for (let r = 0; r < Rr; r++) { const p00 = pt(a, r), p10 = pt(a + 1, r), p01 = pt(a, r + 1), p11 = pt(a + 1, r + 1), u0 = a / N * len / 1.2, u1 = (a + 1) / N * len / 1.2;
            const sh = (rr) => { const v = 0.82 + 0.18 * (rr / Rr); return [v, v, v]; };
            R.quad(p01, p11, p10, p00, [[u0, (r + 1) * 0.6], [u1, (r + 1) * 0.6], [u1, r * 0.6], [u0, r * 0.6]], [sh(r + 1), sh(r + 1), sh(r), sh(r)]);
            if (r === Rr - 1) { const d = [0, -0.42, 0], q0 = p01.map((v, k) => v + d[k]), q1 = p11.map((v, k) => v + d[k]); (gold ? Au : U).quad(q0, q1, p11, p01, undefined, gold ? [1, 0.78, 0.3] : hex('#e8e4d8'));
              U.quad(q1, q0, [p00[0], p00[1] - 0.42, p00[2]], [p10[0], p10[1] - 0.42, p10[2]], undefined, hex('#d2cec2')); } } }
        for (const c of corners) Au.box(c[0], c[1] + 0.12, c[2], 0.34, 0.42, 0.34, [1, 0.8, 0.32]); }; // gold onigawara exactly on each swept hip end
      const OV = [1.7, 1.55, 1.45, 1.35, 1.4];
      for (let i = 0; i < 4; i++) { const t = tiers[i], n = tiers[i + 1], o = OV[i];
        skirt(i, { x0: -n.hw, x1: n.hw, z0: cz - n.hd, z1: cz + n.hd }, t.y1 + 1.35, { x0: -t.hw - o, x1: t.hw + o, z0: cz - t.hd - o, z1: cz + t.hd + o }, t.y1 - 0.35, 0.85, i >= 2);
        // chidori-hafu: alternating front/back and side gables (gold gegyo)
        const gw = (i % 2 ? n.hd : n.hw) * 0.42, axis = i % 2 ? 'x' : 'z';
        for (const sgn of [1, -1]) { const d = (axis === 'z' ? t.hd : t.hw) + o * 0.55, yb = t.y1 - 0.05, ya = yb + gw * 0.55, back = d - 3.2;
          const P = (u, yy, dd) => axis === 'z' ? [u, yy, cz + sgn * dd] : [sgn * dd, yy, cz + u];
          const flip = (axis === 'z') === (sgn > 0);
          const face = flip ? [P(-gw, yb, d), P(gw, yb, d), P(0, ya, d)] : [P(gw, yb, d), P(-gw, yb, d), P(0, ya, d)];
          Gb.tri(face[0], face[1], face[2], flip ? [0, 0] : [1, 0], flip ? [1, 0] : [0, 0], [0.5, 1], [1, 1, 1]);
          for (const s of [-1, 1]) { const e0 = P(s * (gw + 0.45), yb - 0.3, d + 0.35), e1 = P(0, ya + 0.12, d + 0.35), e2 = P(0, ya + 0.12, back), e3 = P(s * (gw + 0.45), yb - 0.3, back);
            const ok = (s > 0) === flip; R.quad(...(ok ? [e0, e1, e2, e3] : [e3, e2, e1, e0]), [[0, 0], [0, 2], [3, 2], [3, 0]], [0.95, 0.95, 0.95]); U.quad(...(ok ? [e3, e2, e1, e0] : [e0, e1, e2, e3]).map((p) => [p[0], p[1] - 0.12, p[2]]), undefined, hex('#d2cec2'));
            const b0 = P(s * (gw + 0.45), yb - 0.3, d + 0.36), b1 = P(0, ya + 0.12, d + 0.36), b2 = P(0, ya - 0.12, d + 0.36), b3 = P(s * (gw + 0.45), yb - 0.54, d + 0.36); Au.quad(...((s > 0) === flip ? [b3, b2, b1, b0] : [b0, b1, b2, b3]), undefined, [1, 0.8, 0.32]); }
          Au.box(...P(0, ya + 0.35, d + 0.3), 0.35, 0.5, 0.35, [1, 0.82, 0.34]); } }
      // r4: hashi-dashi window bay on the first storey (roof now seats flush: front edge on the bay top, back edge into the wall,
      //     side cheeks closed) + a SOLID karahafu on the 2nd roof: tiled cusped roof running back into the 3rd-storey wall,
      //     white gable face filling the area under the curve, white bargeboard with gold edges following the curve, gold gegyo.
      { const t = tiers[0], z1 = cz + t.hd, yb0 = t.y0 + 0.9, yt0 = t.y0 + 3.4, bw = 2.6, bd = 1.25, zfB = z1 + bd;
        W.box(0, (yb0 + yt0) / 2, z1 + bd / 2, 2 * bw, yt0 - yb0, bd, [1, 1, 1], 1 / 2.4); U.box(0, yb0 - 0.12, z1 + bd / 2 + 0.05, 2 * bw + 0.2, 0.24, bd + 0.15, hex('#3b3530'));
        const ya = yt0 + 0.6, ov = 0.5, zo = zfB + ov, kk = (ya - yt0) / bd, yo = yt0 - kk * ov, ex = bw + 0.45, zw = z1 - 0.06; // plane through (z1, ya) and (zfB, yt0)
        R.quad([-ex, yo, zo], [ex, yo, zo], [ex, ya + kk * 0.06, zw], [-ex, ya + kk * 0.06, zw], [[0, 0], [6, 0], [6, 2], [0, 2]]);
        U.quad([ex, yo - 0.1, zo], [-ex, yo - 0.1, zo], [-ex, ya - 0.1, zw], [ex, ya - 0.1, zw], undefined, hex('#d2cec2'));
        for (const sx of [-1, 1]) { const x = sx * bw; W.tri([x, yt0, z1 - 0.02], [x, yt0, zfB], [x, ya - 0.02, z1 - 0.02], [0, 0], [0.18, 0], [0, 0.15], [1, 1, 1]); // closed side cheeks
          U.quad([sx * ex, yo - 0.1, zo], [sx * ex, yo, zo], [sx * ex, ya, zw], [sx * ex, ya - 0.1, zw], undefined, hex('#d2cec2')); }
        Au.box(0, yo - 0.05, zo + 0.02, 2 * ex + 0.1, 0.12, 0.05, [1, 0.8, 0.32]); }
      { const t = tiers[1], n = tiers[2], o = OV[1], zIn = cz + n.hd, zOut = cz + t.hd + o, yIn = t.y1 + 1.35, yOut = t.y1 - 0.35;
        const roofY = (z) => { const u = (z - zIn) / (zOut - zIn); return yIn + (yOut - yIn) * u - 0.35 * Math.sin(Math.PI * u); };
        const zf = zIn + 0.74 * (zOut - zIn), yE = roofY(zf) + 0.32, w = 2.5, H = 1.95, N = 22, bh = 0.5, zb = zIn - 0.1, th = 0.3; // th: visible thickness of the tiled sheet above the board
        const yT = (s) => yE + H * Math.pow(Math.cos(Math.PI * Math.min(1, Math.abs(s)) / 2), 2) + 0.34 * Math.pow(Math.min(1.2, Math.abs(s)), 6);
        const xs = (s) => s * w; const S0 = -1.14, S1 = 1.14; let arc = 0;
        for (let k = 0; k < N; k++) { const s0 = S0 + (S1 - S0) * k / N, s1 = S0 + (S1 - S0) * (k + 1) / N, x0 = xs(s0), x1 = xs(s1), y0 = yT(s0), y1 = yT(s1), da = Math.hypot(x1 - x0, y1 - y0);
          // tiled roof sheet: front overhang -> straight back into the upper wall (tile courses run down the curve)
          R.quad([x0, y0 + 0.03, zf + bh + 0.1], [x1, y1 + 0.03, zf + bh + 0.1], [x1, y1 + 0.03 + th, zf + bh + 0.1], [x0, y0 + 0.03 + th, zf + bh + 0.1], [[0, 0], [0.35, 0], [0.35, 0.15], [0, 0.15]], [0.7, 0.7, 0.7]); // tiled edge (thickness)
          R.quad([x0, y0 + 0.03 + th, zf + bh + 0.1], [x1, y1 + 0.03 + th, zf + bh + 0.1], [x1, y1 + 0.03 + th, zb], [x0, y0 + 0.03 + th, zb], [[0, arc / 1.2 * 0.6], [0, (arc + da) / 1.2 * 0.6], [(zf + bh + 0.08 - zb) / 1.2, (arc + da) / 1.2 * 0.6], [(zf + bh + 0.08 - zb) / 1.2, arc / 1.2 * 0.6]]); arc += da;
          if (k % 2 === 0) Au.box((x0 + x1) / 2, (y0 + y1) / 2 + 0.03 + th * 0.5, zf + bh + 0.13, 0.13, 0.13, 0.04, [1, 0.82, 0.34]); // gold tile-end discs
          // bargeboard: white board on the curve, gold top + bottom edges, underside soffit back to the face
          const zB = zf + bh; U.quad([x0, y0 - bh, zB], [x1, y1 - bh, zB], [x1, y1, zB], [x0, y0, zB], undefined, hex('#efebe1'));
          Au.quad([x0, y0 - 0.07, zB + 0.012], [x1, y1 - 0.07, zB + 0.012], [x1, y1 + 0.03, zB + 0.012], [x0, y0 + 0.03, zB + 0.012], undefined, [1, 0.8, 0.32]);
          Au.quad([x0, y0 - bh, zB + 0.012], [x1, y1 - bh, zB + 0.012], [x1, y1 - bh + 0.06, zB + 0.012], [x0, y0 - bh + 0.06, zB + 0.012], undefined, [1, 0.8, 0.32]);
          U.quad([x1, y1 - bh, zB], [x0, y0 - bh, zB], [x0, y0 - bh, zf], [x1, y1 - bh, zf], undefined, hex('#cfcabd'));
          // gable face: fills everything under the curve down into the main roof (no see-through)
          if (Math.abs(s0) < 1.001 && Math.abs(s1) < 1.001) { const yb = Math.min(roofY(zf), roofY(zf)) - 0.35; U.quad([x0, yb, zf], [x1, yb, zf], [x1, y1 - bh + 0.01, zf], [x0, y0 - bh + 0.01, zf], undefined, [[0.93, 0.92, 0.88], [0.93, 0.92, 0.88], [0.66, 0.64, 0.6], [0.66, 0.64, 0.6]]); // baked shade under the board
            // side body under the sheet (seen from the flanks): face edge back into the roof
          } }
        for (const sx of [-1, 1]) { const x = sx * w, ytop = yT(1) - bh; const zs = []; for (let z = zf; z >= zb; z -= 0.25) zs.push(z);
          for (let i = 0; i < zs.length - 1; i++) { const za = zs[i], zc = zs[i + 1], ra = roofY(za) - 0.2, rc = roofY(zc) - 0.2; if (ra > ytop && rc > ytop) break; W.quad([x, ra, za], [x, rc, zc], [x, Math.max(ytop, rc), zc], [x, Math.max(ytop, ra), za], [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]], [1, 1, 1]); } }
        // gold tie beam + rosettes, kitsuregoshi lattice band, gegyo at the cusp, gold curls at the board ends
        const yBeam = yE + 0.32; Au.box(0, yBeam, zf + 0.04, 2 * w * 0.86, 0.16, 0.08, [1, 0.8, 0.32]); for (const sx of [-0.82, 0.82]) Au.box(sx * w, yBeam, zf + 0.09, 0.26, 0.26, 0.06, [1, 0.84, 0.36]);
        for (let i = -6; i <= 6; i++) D.box(i * 0.26, yBeam + 0.42, zf + 0.03, 0.04, 0.5, 0.03, hex('#2a2420')); D.box(0, yBeam + 0.42, zf + 0.02, 3.4, 0.5, 0.01, hex('#3a332c'));
        const yc = yT(0) - bh; Au.box(0, yc - 0.2, zf + bh + 0.05, 0.62, 0.38, 0.1, [1, 0.84, 0.36]); Au.box(0, yc - 0.48, zf + bh + 0.03, 0.34, 0.22, 0.08, [1, 0.8, 0.32]);
        for (const sx of [-1, 1]) { const x = xs(sx * S1), y = yT(S1); Au.box(x, y - 0.16, zf + bh + 0.04, 0.2, 0.34, 0.1, [1, 0.8, 0.32]); }
        log.karahafu = { zf: +zf.toFixed(2), yE: +yE.toFixed(2), peak: +(yT(0)).toFixed(2), back: +zb.toFixed(2) }; }
      // irimoya top roof: hip skirt + gable + ridge at y 32.9 carrying the existing gold shachihoko pair
      { const t = tiers[4], o = OV[4], RY = 32.9, rh = 2.0, yIn = t.y1 + 1.6; skirt(4, { x0: -rh, x1: rh, z0: cz - 2.0, z1: cz + 2.0 }, yIn, { x0: -t.hw - o, x1: t.hw + o, z0: cz - t.hd - o, z1: cz + t.hd + o }, t.y1 - 0.3, 0.9, true);
        const z0 = cz - 2.0, z1 = cz + 2.0, zr = 0; R.quad([-rh - 0.3, yIn - 0.1, z1 + 0.25], [rh + 0.3, yIn - 0.1, z1 + 0.25], [rh + 0.3, RY, zr], [-rh - 0.3, RY, zr], [[0, 0], [4, 0], [4, 3], [0, 3]]);
        R.quad([rh + 0.3, yIn - 0.1, z0 - 0.25], [-rh - 0.3, yIn - 0.1, z0 - 0.25], [-rh - 0.3, RY, zr], [rh + 0.3, RY, zr], [[0, 0], [4, 0], [4, 3], [0, 3]]);
        for (const sx of [-1, 1]) { const a = [sx * rh, yIn - 0.1, z1], b = [sx * rh, yIn - 0.1, z0], c = [sx * rh, RY - 0.1, zr]; if (sx > 0) Gb.tri(a, b, c, [0, 0], [1, 0], [0.5, 1], [1, 1, 1]); else Gb.tri(b, a, c, [0, 0], [1, 0], [0.5, 1], [1, 1, 1]); }
        D.box(0, RY + 0.05, zr, 2 * rh + 0.9, 0.35, 0.5, hex('#3a4a45')); Au.box(0, RY + 0.25, zr, 2 * rh + 0.9, 0.06, 0.52, [1, 0.8, 0.32]); }
      [[S, mStone, 'stone'], [W, mWall, 'walls'], [T, mTop, 'top'], [R, mRoof, 'roof'], [U, mUnder, 'under'], [Au, mGold, 'gold'], [Gb, mGable, 'gable']].forEach(([g, m, n]) => mesh(g, m, 'AD2_castle_' + n, M));
      log.castle = { tiers: tiers.length, top: +(tiers[4].y1).toFixed(1), ridge: 32.9 };
    }
  } catch (e) { log.castleErr = String(e && e.stack || e); }

  // =====================================================================================================================
  // 2. BLIMP (local space of FX_dh_blimp: hull along x, tail at -x, radius 4.3, hull half-length 12.5)
  // =====================================================================================================================
  const spin = [], blink = [];
  try {
    const BL = byName('FX_dh_blimp');
    if (BL) {
      BL.traverse((m) => { if (m.isMesh && /^dh_white$/.test(m.material?.name || '')) { m.geometry.computeBoundingBox(); if (m.geometry.boundingBox.max.x < -9) { m.visible = false; log.blimpMarkerHidden = true; } } }); // r3: old white marker box on the top fin
      const G = new THREE.Group(); G.name = 'FX_dh_blimp_ad2kit'; BL.add(G); // FX_dh_blimp* prefix: main.js occluder filters already skip it
      const blk = std({ color: 0x111114, roughness: 0.35, metalness: 0.2 });
      const F = new GB(), Rd = new GB();
      // 4 tail fins (cruciform) with red rudder/elevator strips and a thin white root fillet; thickness gives a real edge
      const fin = (ang) => { const ca = Math.cos(ang), sa = Math.sin(ang); const P = (x, r, t) => [x, r * ca - t * sa, r * sa + t * ca];
        const r0 = 1.6, r1 = 5.6, th = 0.13; const prof = [[-9.4, r0], [-12.2, r0], [-13.1, r1], [-11.6, r1]]; // leading edge root, trailing root, trailing tip, leading tip
        const rud = [[-12.2, r0 + 0.9], [-12.95, r1 - 0.1], [-13.1, r1], [-12.2 - 0.0, r0 + 0.6]];
        for (const t of [th, -th]) { const q = prof.map(([x, r]) => P(x, r, t)); if (t > 0) F.quad(q[0], q[1], q[2], q[3]); else F.quad(q[3], q[2], q[1], q[0]);
          const rr = rud.map(([x, r]) => P(x - 0.0, r, t * 1.6)); if (t > 0) Rd.quad(rr[0], rr[3], rr[2], rr[1]); else Rd.quad(rr[1], rr[2], rr[3], rr[0]); }
        for (let i = 0; i < 4; i++) { const a = prof[i], b = prof[(i + 1) % 4]; F.quad(P(a[0], a[1], th), P(a[0], a[1], -th), P(b[0], b[1], -th), P(b[0], b[1], th), undefined, [0.8, 0.8, 0.8]); }
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: ang === Math.PI / 2 ? 0x3dff6a : ang === -Math.PI / 2 ? 0xff3344 : 0xffffff, fog: true }));
        tip.position.set(...P(-11.9, r1 + 0.05, 0)); tip.name = 'FX_dh_blimp_ad2_nav'; tip.raycast = noRay; G.add(tip); blink.push({ m: tip, ph: ang }); };
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(fin);
      // (no gondola here: the TV-cam lane's FX_dh_blimp_gondola + camera mount is the real one)
      const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true })); strobe.position.set(-13.15, 0, 0); strobe.name = 'FX_dh_blimp_ad2_strobe'; strobe.raycast = noRay; G.add(strobe); blink.push({ m: strobe, ph: 0, strobe: true });
      mesh(F, blk, 'FX_dh_blimp_ad2_fins', null, G); mesh(Rd, std({ color: 0xd8102a, roughness: 0.45 }), 'FX_dh_blimp_ad2_rudders', null, G);
      G.traverse((o) => { o.raycast = noRay; });
      log.blimp = { kids: G.children.length };
    }
  } catch (e) { log.blimpErr = String(e && e.stack || e); }

  // =====================================================================================================================
  // 3. CANAL STREET: infill between the 12 u machiya grid + chochin strings
  // =====================================================================================================================
  const lanternTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 3, 32, 32, 31); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.4, 'rgba(255,170,90,0.55)'); gr.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
  const kanbanWords = ['串かつ', 'たこ焼', '酒処', 'お好み焼', 'たい焼', '甘味', 'うどん', '喫茶'];
  const kanbanTex = canvasTex(64 * kanbanWords.length, 256, (g, w, h) => { kanbanWords.forEach((s, i) => { const x = i * 64; const bg = ['#c8202c', '#f3e9d2', '#1d2b55', '#f6c431', '#c8202c', '#2b5a3a', '#f3e9d2', '#5a2a1f'][i];
      g.fillStyle = bg; g.fillRect(x, 0, 64, h); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.strokeRect(x + 4, 4, 56, h - 8);
      g.fillStyle = ['#fff', '#b3161f', '#fff', '#1c1c1c', '#fff', '#fff', '#1d2b55', '#f3e9d2'][i]; g.font = 'bold 44px "Yu Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif'; g.textAlign = 'center';
      const ch = [...s]; const step = Math.min(56, (h - 24) / ch.length); ch.forEach((c, k) => g.fillText(c, x + 32, 14 + step * (k + 0.85))); }); }, false);
  const wLights = []; // extra canal reflection sources (Dotonbori ref: the water carries every sign colour, not only lantern orange)
  world3d.traverse((o) => { if (o.isMesh && /neon_(pink|cyan)|holo_menu/.test(o.material?.name || '')) { const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); if (c.x > 60 && c.x < 76)
    wLights.push({ p: c, k: /holo/.test(o.material.name) ? 0.25 : 0.3, c: new THREE.Color(/pink/.test(o.material.name) ? '#ff4fb8' : '#3fe6ff') }); } });
  try {
    const kuraP = new GB(), solid = new GB(), plaster = solid, wood = solid, tile = solid, dark = solid, glow = new GB(), kan = new GB(), namako = new GB(); // one vertex-coloured material for all untextured infill parts
    const mKura = std({ roughness: 0.95, map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#eeeae0'; g.fillRect(0, 0, w, h); // lime plaster: soft mottling, trowel arcs, faint rain streaks
      for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 26, a = 0.025 + rnd() * 0.05; g.fillStyle = rnd() < 0.5 ? `rgba(160,150,130,${a})` : `rgba(255,255,250,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(150,140,120,0.08)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h; g.beginPath(); g.arc(x, y, 18 + rnd() * 30, 3.6, 5.4); g.stroke(); }
      for (let i = 0; i < 14; i++) { const x = rnd() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(120,112,100,0.10)'); gr.addColorStop(1, 'rgba(120,112,100,0)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + rnd() * 4, h * (0.3 + rnd() * 0.6)); } }) });
    const mP = std({ roughness: 0.92 }), mWd = std({ roughness: 0.8 }), mTl = std({ roughness: 0.7 }), mDk = std({ roughness: 0.9 }), mGl = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }),
      mKan = new THREE.MeshBasicMaterial({ map: kanbanTex, vertexColors: true, fog: true, side: THREE.DoubleSide }),
      mNam = std({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#e8e4dc'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke(); }), roughness: 0.8 });
    const shops = []; world3d.traverse((o) => { if (/^PROP_canal_shopfront_\d+$/.test(o.name)) shops.push(o); });
    const zs = shops.map((o) => o.getWorldPosition(new THREE.Vector3()).z).sort((a, b) => a - b);
    const xFront = 68.55; // shop fronts (local +z 3.0 rotated to -x) sit at x 68.5; stay behind it, keep clear of tram piers at x 75
    // tile roof helper: ribbed kawara slab (two slopes) along z
    const gableRoof = (x0, x1, z0, z1, y, rise, col) => { const xm = (x0 + x1) / 2; tile.quad([x0 - 0.5, y - 0.2, z1 + 0.25], [x0 - 0.5, y - 0.2, z0 - 0.25], [xm, y + rise, z0 - 0.25], [xm, y + rise, z1 + 0.25], [[0, 0], [6, 0], [6, 2], [0, 2]], col);
      tile.quad([x1 + 0.3, y - 0.2, z0 - 0.25], [x1 + 0.3, y - 0.2, z1 + 0.25], [xm, y + rise, z1 + 0.25], [xm, y + rise, z0 - 0.25], [[0, 0], [6, 0], [6, 2], [0, 2]], col.map((v) => v * 0.85));
      dark.box(xm, y + rise + 0.08, (z0 + z1) / 2, 0.3, 0.22, z1 - z0 + 0.6, hex('#2f3338'));
      for (let k = 0; k < Math.floor((z1 - z0 + 0.5) / 0.34); k++) { const z = z0 - 0.2 + k * 0.34; tile.box(x0 - 0.5, y - 0.18, z, 0.18, 0.16, 0.16, col.map((v) => v * 1.1)); } // nokigawara round tile ends on the eave
      plaster.tri([xm, y + rise, z0 + 0.02], [x0, y - 0.1, z0 + 0.02], [x1, y - 0.1, z0 + 0.02], [0, 0], [0, 0], [0, 0], hex('#d6cdb8')); plaster.tri([xm, y + rise, z1 - 0.02], [x1, y - 0.1, z1 - 0.02], [x0, y - 0.1, z1 - 0.02], [0, 0], [0, 0], [0, 0], hex('#d6cdb8')); };
    const types = ['kura', 'tower', 'low', 'tower', 'kura', 'low', 'tower'];
    for (let i = 0; i + 1 < zs.length; i++) {
      const za = zs[i] + 4.55, zb = zs[i + 1] - 4.55; if (zb - za < 1.6) continue; const zc = (za + zb) / 2, wz = zb - za - 0.1, ty = types[i % types.length], set = [0.35, 0.9, 0.15, 0.6][i % 4];
      const x0 = xFront + set, x1 = 73.9, h = ty === 'tower' ? 9.6 + rnd() * 1.2 : ty === 'kura' ? 6.3 : 3.6;
      const bb = new THREE.Box3(new THREE.Vector3(x0 - 0.6, 0.05, za + 0.05), new THREE.Vector3(x1, h + 1.5, zb - 0.05)); const hit = clash(bb, /^(PROP_canal_shopfront|GROUND_)/);
      if (hit.length) { log.skipped.push({ zc: +zc.toFixed(1), hit: hit.slice(0, 4) }); continue; }
      const z0 = zc - wz / 2, z1 = zc + wz / 2;
      if (ty === 'kura') { // dozo storehouse: thick white plaster, namako-kabe skirt, small barred window, heavy tiled roof
        namako.box((x0 + x1) / 2, 0.9, zc, x1 - x0, 1.8, wz, [1, 1, 1], 1.6); kuraP.box((x0 + x1) / 2, 1.8 + (h - 1.8) / 2, zc, x1 - x0, h - 1.8, wz, [1, 1, 1], 0.5);
        { const wy = h * 0.68, wh = 0.9, ww = Math.min(0.95, wz * 0.38), zw = zc - wz * 0.12; // r3: barred mado with thick plaster surround + an opened plaster shutter
          dark.box(x0 + 0.02, wy, zw, 0.06, wh, ww, hex('#141416'));
          kuraP.box(x0 - 0.12, wy + wh / 2 + 0.12, zw, 0.28, 0.24, ww + 0.48, [0.97, 0.96, 0.93], 0.5); kuraP.box(x0 - 0.12, wy - wh / 2 - 0.12, zw, 0.32, 0.24, ww + 0.56, [0.95, 0.94, 0.9], 0.5);
          for (const sz of [-1, 1]) kuraP.box(x0 - 0.12, wy, zw + sz * (ww / 2 + 0.12), 0.28, wh, 0.24, [0.97, 0.96, 0.93], 0.5);
          for (let k = 0; k < 4; k++) dark.box(x0 - 0.05, wy, zw - ww / 2 + (k + 0.5) * ww / 4, 0.07, wh, 0.07, hex('#7d8186'));
          kuraP.box(x0 - 0.1, wy, zw + ww / 2 + 0.24 + ww / 2, 0.16, wh + 0.1, ww, [0.93, 0.92, 0.88], 0.5); for (const hy of [-0.3, 0.3]) dark.box(x0 - 0.19, wy + hy * wh, zw + ww / 2 + 0.24 + ww * 0.3, 0.02, 0.05, ww * 0.6, hex('#2a2a2c')); // shutter hinges (face stays plaster)
          tile.box(x0 - 0.38, wy + wh / 2 + 0.36, zw + 0.25, 0.7, 0.09, ww + 1.4, hex('#585f69')); }
        dark.box(x0 - 0.1, h - 0.25, zc, 0.25, 0.35, wz + 0.1, hex('#2b2b2e')); gableRoof(x0, x1, z0, z1, h, 1.3, hex('#5f6670'));
      } else if (ty === 'tower') { // narrow 3-storey: timber, lit shoji band per floor, vertical kanban on the canal face, chochin column
        wood.box((x0 + x1) / 2, h / 2, zc, x1 - x0, h, wz, hex('#4a3226')); for (let f = 0; f < 3; f++) { const yf = 1.4 + f * 2.9; glow.box(x0 - 0.04, yf, zc, 0.08, 1.0, wz * 0.62, hex(f ? '#ffd9a0' : '#ffe8c2'));
          wood.box(x0 - 0.1, yf + 1.15, zc, 0.22, 0.18, wz + 0.2, hex('#2a1c15')); tile.box(x0 - 0.55, yf + 1.35, zc, 1.0, 0.12, wz + 0.4, hex('#565d66')); }
        const kw = Math.min(0.95, wz * 0.42), k = (i * 3) % kanbanWords.length, u0 = k / kanbanWords.length, u1 = (k + 1) / kanbanWords.length, kx = x0 - 0.55, ky0 = 2.2, ky1 = h - 0.8, kz = zc;
        kan.quad([kx, ky0, kz + kw], [kx, ky0, kz - kw], [kx, ky1, kz - kw], [kx, ky1, kz + kw], [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], [1.25, 1.25, 1.25]);
        wLights.push({ p: new THREE.Vector3(kx, (ky0 + ky1) / 2, kz), k: 0.35, c: new THREE.Color(['#ff4a4a', '#fff0d8', '#5b7cff', '#ffd23a', '#ff4a4a', '#5bdc8a', '#fff0d8', '#ff9a5a'][k]) });
        dark.box(kx + 0.25, (ky0 + ky1) / 2, kz + kw + 0.05, 0.5, ky1 - ky0, 0.07, hex('#1a1a1c')); dark.box(kx + 0.25, ky1 + 0.06, kz, 0.6, 0.12, 2 * kw + 0.2, hex('#1a1a1c'));
        gableRoof(x0, x1, z0, z1, h, 1.0, hex('#4e555e'));
      } else { // low tea / sweet shop with a cloth awning and a bench
        wood.box((x0 + x1) / 2, h / 2, zc, x1 - x0, h, wz, hex('#6b4a32')); glow.box(x0 - 0.04, 1.3, zc, 0.08, 1.6, wz * 0.7, hex('#ffe1b0'));
        dark.box(x0 - 0.9, 1.9, zc, 1.8, 0.06, wz + 0.1, hex('#7b1f27')); for (const s of [-1, 1]) wood.box(x0 - 1.75, 0.95, zc + s * (wz / 2 - 0.05), 0.07, 1.9, 0.07, hex('#3a281c'));
        wood.box(x0 - 0.9, 0.42, zc, 0.5, 0.08, wz * 0.8, hex('#8a5a2e')); gableRoof(x0, x1, z0, z1, h, 0.9, hex('#6a7079'));
      }
      log.infill.push({ zc: +zc.toFixed(1), ty, h: +h.toFixed(1) });
    }
    // chochin strings under the eaves of alternate machiya (instanced, 1 draw call + 1 for the glow sprites)
    const per = isMobile ? 5 : 8, rows = []; shops.forEach((o, i) => { const z = o.getWorldPosition(new THREE.Vector3()).z; if (i % 2 !== 0) return; const y = 3.55 + (i % 4 ? 0.15 : 0);
      const hit = clash(new THREE.Box3(new THREE.Vector3(67.55, y - 0.95, z - 3.85), new THREE.Vector3(68.65, y + 0.2, z + 3.85)), /^(PROP_canal_shopfront|ad_machiya_|GROUND_)/); // the brackets meeting the machiya eave are an intended join; signs/boards/trees are not
      if (hit.length) log.skipped.push({ chochinRow: +z.toFixed(1), hit: hit.slice(0, 3) }); else rows.push({ z, y }); });
    const lg = new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1.35, 1); const lm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    const N = rows.length * per, IM = new THREE.InstancedMesh(lg, lm, N); IM.name = 'AD2_chochin'; IM.raycast = noRay; const M4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0; const glowPts = [];
    for (const r of rows) for (let k = 0; k < per; k++) { const z = r.z - 3.6 + k * (7.2 / (per - 1)), sag = 0.18 * Math.sin(Math.PI * k / (per - 1)), x = 67.9, y = r.y - sag - 0.35;
      M4.makeTranslation(x, y, z); IM.setMatrixAt(n, M4); IM.setColorAt(n, col.set(k % 3 === 1 ? '#fff1d6' : '#ff3b30').multiplyScalar(1.15)); n++; glowPts.push([x - 0.05, y, z]);
      dark.box(x, r.y - sag + 0.02, z, 0.04, 0.3, 0.04, hex('#151515')); }
    for (const r of rows) { dark.box(67.9, r.y + 0.05, r.z, 0.03, 0.03, 7.4, hex('#151515')); for (const e of [-3.75, 3.75]) dark.box(68.25, r.y + 0.05, r.z + e, 0.75, 0.06, 0.06, hex('#151515')); } // wire + two brackets back to the eave
    IM.instanceMatrix.needsUpdate = true; root.add(IM); log.lanterns = n;
    { const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(glowPts.flat(), 3)); // all lantern glows in ONE draw call
      const pts = new THREE.Points(gp, new THREE.PointsMaterial({ map: lanternTex, size: 1.3, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, fog: true })); pts.name = 'AD2_chochin_glow'; pts.raycast = noRay; root.add(pts); }
    [[solid, mP, 'solid'], [kuraP, mKura, 'kura_plaster'], [glow, mGl, 'glow'], [kan, mKan, 'kanban'], [namako, mNam, 'namako']].forEach(([g, m, nm]) => mesh(g, m, 'AD2_infill_' + nm));
  } catch (e) { log.infillErr = String(e && e.stack || e); }

  const extraSteam = [];
  // =====================================================================================================================
  // ROUND 3 (11-14): paving, canal walls + mooring posts, paper bags, yatai dressing (aprons, props, menus, visible steam)
  // =====================================================================================================================
  const tl = new THREE.TextureLoader(), ANI = isMobile ? 4 : 8;
  const ldTex = (f, srgb) => { const t = tl.load('./tex/' + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANI; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const worldUV = (m, fn) => { // rebuild UVs from world position + face normal (non-indexed copy, so each face picks its own projection)
    m.updateMatrixWorld(true); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); const P = g.attributes.position, uv = new Float32Array(P.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < P.count; i += 3) { a.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(P, i + 1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(P, i + 2).applyMatrix4(m.matrixWorld);
      n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize(); for (let k = 0; k < 3; k++) { const v = [a, b, c][k]; const [u, w] = fn(v, n); uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = w; } }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.deleteAttribute('normal'); g.computeVertexNormals(); g.computeBoundingSphere(); m.geometry = g; };
  // --- 1. PAVING: ishidatami granite (tex/ad_paving_granite*.jpg, 1024 px = 8 u, slabs 1.4-2.4 u = 1.5-2.5 marbles), world UVs,
  //     normal map, anisotropy; a world-space macro tone + a second, rotated low-frequency sample break the repeat at TV distance
  try {
    const plaza = byName('GROUND_plaza');
    if (plaza) {
      const map = ldTex('ad_paving_granite.jpg', true), nmap = ldTex('ad_paving_granite_n.jpg', false), S = 6.4; // stones ~1.1-1.9 u = 1.5-2 marbles
      const mat = new THREE.MeshStandardMaterial({ map, normalMap: nmap, normalScale: new THREE.Vector2(0.85, 0.85), roughness: 0.86, metalness: 0, color: 0xfff7ee });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vPw;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vPw;\nfloat ph(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat pn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ph(i), ph(i + vec2(1, 0)), f.x), mix(ph(i + vec2(0, 1)), ph(i + vec2(1, 1)), f.x), f.y); }\n' +
          sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec2 q = vPw.xz; float m1 = pn(q * 0.045) * 0.6 + pn(q * 0.13 + 4.0) * 0.4; vec2 r = mat2(0.8, -0.6, 0.6, 0.8) * q / ${(S * 2.7).toFixed(1)};
    float l2 = dot(texture2D(map, r).rgb, vec3(0.333)); diffuseColor.rgb *= (0.9 + 0.2 * m1) * (0.94 + 0.12 * l2);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.04, 1.0, 0.95), smoothstep(0.55, 0.8, pn(q * 0.07 + 9.0)) * 0.6); }`);
      };
      plaza.traverse((m) => { if (!m.isMesh) return; worldUV(m, (v, n) => Math.abs(n.y) > 0.5 ? [v.x / S, -v.z / S] : [(v.x + v.z) / S, v.y / S]); m.material = mat; });
      log.paving = true;
    }
  } catch (e) { log.pavingErr = String(e && e.stack || e); }
  // --- 2. CANAL WALLS: fitted granite courses with a dark algae waterline (tex/ad_canal_wall*.jpg = 6.4 u x full wall height) + mooring posts
  try {
    const cw = byName('CANAL_walls');
    if (cw) {
      const bb = new THREE.Box3().setFromObject(cw), y0 = bb.min.y, H = bb.max.y - bb.min.y;
      const map = ldTex('ad_canal_wall.jpg', true), nmap = ldTex('ad_canal_wall_n.jpg', false); map.wrapT = nmap.wrapT = THREE.ClampToEdgeWrapping;
      const mat = new THREE.MeshStandardMaterial({ map, normalMap: nmap, normalScale: new THREE.Vector2(1, 1), roughness: 0.92, color: 0xf2eee8 });
      cw.traverse((m) => { if (!m.isMesh) return; worldUV(m, (v, n) => Math.abs(n.y) > 0.5 ? [v.z / 6.4, 0.6 + 0.38 * (((v.x % 1.6) + 1.6) % 1.6) / 1.6] : [(Math.abs(n.x) > Math.abs(n.z) ? v.z : v.x) / 6.4, (v.y - y0) / H]); m.material = mat; });
      // wooden mooring posts (kui) with a rope turn, on the wall copings, alternating sides; skipped where anything stands
      const prof = [[0, 0], [0.13, 0], [0.13, 0.55], [0.15, 0.58], [0.15, 0.66], [0.1, 0.74], [0, 0.76]].map(([r, y]) => new THREE.Vector2(r, y));
      const pg = new THREE.LatheGeometry(prof, 10), rg = new THREE.TorusGeometry(0.15, 0.025, 5, 14).rotateX(Math.PI / 2);
      const spots = []; for (let z = bb.min.z + 7; z < bb.max.z - 4; z += 9.5) { const side = spots.length % 2; spots.push([side ? bb.max.x - 0.42 : bb.min.x + 0.42, z]); }
      const ok = spots.filter(([x, z]) => !clash(new THREE.Box3(new THREE.Vector3(x - 0.4, bb.max.y + 0.02, z - 0.4), new THREE.Vector3(x + 0.4, bb.max.y + 1.2, z + 0.4)), /^(CANAL_|GROUND_)/).length);
      const PI = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.85 }), ok.length), RI = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 0.95 }), ok.length);
      const M4 = new THREE.Matrix4(); ok.forEach(([x, z], i) => { PI.setMatrixAt(i, M4.makeTranslation(x, bb.max.y, z)); RI.setMatrixAt(i, M4.makeTranslation(x, bb.max.y + 0.42, z)); });
      PI.name = 'AD2_mooring_posts'; RI.name = 'AD2_mooring_ropes'; PI.raycast = RI.raycast = noRay; root.add(PI, RI); log.canalWalls = { posts: ok.length, of: spots.length };
    }
  } catch (e) { log.canalErr = String(e && e.stack || e); }
  let mkBag = null;
  // --- 3. PAPER SHOPPING BAGS: the old bag was a white box + a flat dark plank floating at the marble's side. New: kraft bag with a
  //     folded rim, a plain two-tone printed band (no logo) and twisted paper handles, its inner face touching the marble.
  try {
    const bagG = (() => { const B = new GB(), kr = hex('#b98a5a'), krd = hex('#8c6440'), band = hex('#e9e1d0'), cx = 0.5, w = 0.15, d = 0.3, yb = -0.47, yt = -0.13;
      B.box(cx, (yb + yt) / 2, 0, w, yt - yb, d, kr); B.box(cx, -0.24, 0, w + 0.004, 0.07, d + 0.004, band); B.box(cx, -0.215, 0, w + 0.006, 0.012, d + 0.006, hex('#2c4a6e'));
      B.box(cx, yt + 0.008, 0, w + 0.01, 0.018, d + 0.01, krd);
      for (const hx of [cx - 0.045, cx + 0.045]) { const N = 7; for (let k = 0; k < N; k++) { const a0 = Math.PI * k / N, a1 = Math.PI * (k + 1) / N, p0 = [-Math.cos(a0) * 0.085, Math.sin(a0) * 0.1], p1 = [-Math.cos(a1) * 0.085, Math.sin(a1) * 0.1];
          const mz = (p0[0] + p1[0]) / 2, my = yt + (p0[1] + p1[1]) / 2, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.004; const seg = new GB(); seg.box(0, 0, 0, 0.014, 0.014, len, krd);
          const g = seg.geo(new THREE.Matrix4().makeTranslation(hx, my, mz).multiply(new THREE.Matrix4().makeRotationX(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0])))); const P = g.attributes.position.array, C = g.attributes.color.array, U = g.attributes.uv.array;
          for (let i = 0; i < P.length / 3; i++) { B.P.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); B.C.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]); B.U.push(U[i * 2], U[i * 2 + 1]); } } }
      return B.geo(); })();
    const bagM = std({ roughness: 0.9 }); let nb = 0; mkBag = () => { const b = new THREE.Mesh(bagG, bagM); b.raycast = noRay; return b; };
    const bagNodes = []; world3d.traverse((o) => { if (/^VIGA_.*_bag$/.test(o.name)) bagNodes.push(o); }); log.bagOff = [];
    for (const o of bagNodes) { o.updateMatrixWorld(true); const inv = o.matrixWorld.clone().invert(), lb = new THREE.Box3(); // old bag body (the white box) in the node frame -> put the new bag exactly there
      o.traverse((m) => { if (!m.isMesh) return; if (/paper_bag/.test(m.material && m.material.name || '')) { m.geometry.computeBoundingBox(); lb.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); } m.visible = false; });
      const bm = new THREE.Mesh(bagG, bagM); bm.name = o.name + '_ad2paper'; bm.raycast = noRay;
      { const pc = o.parent ? o.parent.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv) : new THREE.Vector3(); const c = lb.isEmpty() ? pc : lb.getCenter(new THREE.Vector3()); bm.position.set(pc.x + 0.065, pc.y + 0.3, c.z); } // carried at the marble's hip: inner face touches the sphere (r 0.5), handles tuck into it
      o.add(bm); nb++; o.updateMatrixWorld(true); if (log.bagOff.length < 2) log.bagOff.push([o.name, bm.position.toArray().map((v) => +v.toFixed(2))]); }
    log.bags = nb;
  } catch (e) { log.bagErr = String(e && e.stack || e); }
  // --- 4. YATAI DRESSING: printed cloth apron (noren skirt with slits) on every counter front, bevelled counter lip + plank seams,
  //     sauce / mayo bottles, paper boat trays, a chalk menu board; props only where the counter top is free (raycast)
  const STALLW = { takoyaki: ['たこ焼', '#b3202a'], yakitori: ['焼鳥', '#1f2f57'], sakana: ['鮮魚', '#1d4f7a'], dagashi: ['駄菓子', '#c8641c'], oden: ['おでん', '#5a3a24'], kushikatsu: ['串かつ', '#1f2f57'], okonomiyaki: ['お好み焼き', '#8a2a1c'], snacks: ['名物', '#2d5a3a'], taiyaki: ['たい焼', '#1f3a6b'], kakigori: ['かき氷', '#2a6a9a'] };
  const STALL_KEY = { PROP_food_stall_2: 'kushikatsu', PROP_food_stall_3: 'kakigori', PROP_food_stall_osaka_snacks: 'okonomiyaki' }; // r4: fixed, matches each stall's kanban / goods / steam
  const KEYS = Object.keys(STALLW);
  const apronTex = canvasTex(512, 128 * Math.ceil(KEYS.length / 2), (g, w, h) => { KEYS.forEach((k, i) => { const x = (i % 2) * 256, y = (i >> 1) * 128, [word, col] = STALLW[k];
      g.fillStyle = col; g.fillRect(x, y, 256, 128); g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 2; // seigaiha waves
      for (let yy = 0; yy < 140; yy += 14) for (let xx = (yy / 14) % 2 * 14; xx < 270; xx += 28) for (const r of [12, 8, 4]) { g.beginPath(); g.arc(x + xx, y + yy, r, Math.PI, 2 * Math.PI); g.stroke(); }
      g.fillStyle = '#f5efe0'; g.beginPath(); g.arc(x + 128, y + 52, 40, 0, 7); g.fill(); g.fillStyle = col; const two = word.length >= 5, fs = two ? 24 : word.length > 3 ? 22 : word.length > 2 ? 26 : 32; g.font = `bold ${fs}px "Yu Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; if (two) { g.fillText(word.slice(0, 3), x + 128, y + 40); g.fillText(word.slice(3), x + 128, y + 67); } else g.fillText(word, x + 128, y + 53);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x, y + 4, 256, 3); g.clearRect(x + 84, y + 98, 4, 30); g.clearRect(x + 170, y + 98, 4, 30); g.clearRect(x, y + 124, 256, 4); }); }, false);
  const menuTex = canvasTex(512, 160, (g) => { const items = [['たこ焼', '6こ ¥400', '8こ ¥500', 'ソース・しお'], ['やきとり', 'ねぎま ¥150', 'つくね ¥180', 'かわ ¥150'], ['おでん', 'だいこん ¥120', 'たまご ¥100', 'ちくわ ¥120'], ['お品書き', '本日のおすすめ', '並 ¥300', '大 ¥500']];
    items.forEach((L, i) => { const x = i * 128; g.fillStyle = '#20261f'; g.fillRect(x, 0, 128, 160); g.strokeStyle = '#7a5a3a'; g.lineWidth = 8; g.strokeRect(x + 4, 4, 120, 152); g.fillStyle = '#f2efe4'; g.textAlign = 'center';
      g.font = 'bold 22px "Yu Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif'; g.fillText(L[0], x + 64, 36); g.font = '16px "Yu Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif'; L.slice(1).forEach((s, k) => g.fillText(s, x + 64, 70 + k * 28));
      g.fillStyle = 'rgba(242,239,228,0.25)'; g.fillRect(x + 14, 46, 100, 2); }); }, false);
  const AP = new GB(), MN = new GB(), LIP = new GB(), TR = new GB(), bottles = [];
  const apronM = new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.95, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
  const dressCounter = ({ M, xL, xR, zBody, zTop, yTop, key, free }) => { // all in the stall's local frame (front = +z); M = local->world
    const T = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M).toArray();
    const i = KEYS.indexOf(key), u0 = (i % 2) * 0.5, rows = Math.ceil(KEYS.length / 2), v1 = 1 - (i >> 1) / rows, v0 = v1 - 1 / rows, ax0 = xL + 0.06, ax1 = xR - 0.06, ay0 = 0.1, ay1 = yTop - 0.07, az = zBody + 0.025;
    AP.quad(T(ax0, ay0, az), T(ax1, ay0, az), T(ax1, ay1, az), T(ax0, ay1, az), [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v1], [u0, v1]]);
    // bevelled lip along the counter front + two plank seams on the top
    const ly = yTop - 0.02; LIP.quad(T(xL, ly - 0.05, zTop + 0.012), T(xR, ly - 0.05, zTop + 0.012), T(xR, ly + 0.012, zTop - 0.03), T(xL, ly + 0.012, zTop - 0.03), undefined, hex('#c89a63'));
    for (const f of [0.33, 0.66]) { const z = zTop - (zTop - zBody + 0.6) * f; LIP.quad(T(xL + 0.02, yTop + 0.004, z + 0.006), T(xR - 0.02, yTop + 0.004, z + 0.006), T(xR - 0.02, yTop + 0.004, z - 0.006), T(xL + 0.02, yTop + 0.004, z - 0.006), undefined, hex('#5a3c22')); }
    const placed = [];
    const tryPut = (x, z, r) => free(x, z, r) && !placed.some(([a, b, rr]) => Math.hypot(a - x, b - z) < r + rr) && (placed.push([x, z, r]), true);
    const zr = zTop - 0.22, ends = [xR - 0.22, xL + 0.22, xR - 0.55, xL + 0.55, (xL + xR) / 2 + 0.6, (xL + xR) / 2 - 0.6];
    let got = { bottles: 0, trays: 0, menu: 0 };
    for (const x of ends) if (!got.bottles && tryPut(x, zr, 0.16)) { bottles.push({ p: T(x - 0.05, yTop, zr), k: 0 }, { p: T(x + 0.06, yTop, zr + 0.02), k: 1 }); got.bottles = 1; }
    for (const x of ends) if (!got.trays && tryPut(x, zr, 0.14)) { for (let k = 0; k < 4; k++) { const y = yTop + 0.012 + k * 0.022; TR.quad(T(x - 0.1, y, zr - 0.06), T(x + 0.1, y, zr - 0.06), T(x + 0.1, y, zr + 0.06), T(x - 0.1, y, zr + 0.06), undefined, k % 2 ? hex('#f0e8d6') : hex('#d9b98a'));
        TR.quad(T(x - 0.11, y - 0.012, zr + 0.065), T(x + 0.11, y - 0.012, zr + 0.065), T(x + 0.11, y + 0.01, zr + 0.07), T(x - 0.11, y + 0.01, zr + 0.07), undefined, hex('#c9a874')); } got.trays = 1; }
    for (const x of [xL + 0.75, xR - 0.75, xL + 1.05, xR - 1.05, xL + 0.2, xR - 0.2]) if (!got.menu && tryPut(x, zTop - 0.2, 0.12)) { const mi = { takoyaki: 0, yakitori: 1, oden: 2 }[key] ?? 3, mu0 = mi / 4, mu1 = (mi + 1) / 4, w = 0.17, yb = yTop + 0.02, yt = yTop + 0.45, zb = zTop - 0.06, zt = zTop - 0.18;
      MN.quad(T(x - w, yb, zb), T(x + w, yb, zb), T(x + w, yt, zt), T(x - w, yt, zt), [[mu0, 0], [mu1, 0], [mu1, 1], [mu0, 1]]); // easel leg behind
      LIP.quad(T(x - 0.02, yb, zt - 0.14), T(x + 0.02, yb, zt - 0.14), T(x + 0.02, yt - 0.05, zt - 0.005), T(x - 0.02, yt - 0.05, zt - 0.005), undefined, hex('#5a3c22')); got.menu = 1; }
    return got;
  };
  const stalls = [];
  try {
    const ray = new THREE.Raycaster(), dn = new THREE.Vector3(), tgt = [];
    const steamNames = []; world3d.traverse((o) => { if (/^VIGA_steam_/.test(o.name)) steamNames.push({ k: o.name.replace(/^VIGA_steam_/, '').replace(/_\d+$/, ''), p: o.getWorldPosition(new THREE.Vector3()) }); });
    const roots = []; world3d.traverse((o) => { const m = /^VIG_stall_\d+_(takoyaki|yakitori|sakana|dagashi|oden)$/.exec(o.name); if (m) roots.push([o, m[1]]); else if (/^PROP_food_stall_(\d+|osaka_snacks)$/.test(o.name)) roots.push([o, null]); });
    for (const [S, key0] of roots) {
      S.updateMatrixWorld(true); const M = S.matrixWorld.clone(), inv = M.clone().invert(), lb = new THREE.Box3();
      S.traverse((m) => { if (m.isMesh) { m.geometry.computeBoundingBox(); lb.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); } });
      const wb = new THREE.Box3().setFromObject(S).expandByScalar(0.3); const cand = boxes.filter((e) => e.b.intersectsBox(wb) && e.o.visible && !/^(VIGA_|CROWD_|VIG_seller_|PROP_.*lantern|VIG_.*chochin)/.test(e.n)).map((e) => e.o);
      const own = []; S.traverse((m) => { if (m.isMesh) own.push(m); }); const hitDown = (x, z, L = cand) => { const o = new THREE.Vector3(x, 1.95, z).applyMatrix4(M); dn.set(0, -1, 0).transformDirection(M); ray.set(o, dn); ray.far = 2.4; const h = ray.intersectObjects(L, false)[0]; return h ? h.point.clone().applyMatrix4(inv).y : null; };
      // counter: scan from the front inward at the centre line
      let zTop = null, yTop = null, xc = 0; for (const xs of [0, 0.6, -0.6, 1.2, -1.2]) { for (let z = lb.max.z; z > lb.min.z; z -= 0.05) { const y = hitDown(xs, z, own); if (y != null && y > 0.7 && y < 1.65) { zTop = z; yTop = y; xc = xs; break; } } if (zTop != null) break; }
      if (zTop == null) { log.skipped.push({ stall: S.name, why: 'no counter', lb: [lb.min.toArray().map((v) => +v.toFixed(2)), lb.max.toArray().map((v) => +v.toFixed(2))] }); continue; }
      let zBody = zTop; { const o = new THREE.Vector3(0, yTop - 0.35, lb.max.z + 0.5).applyMatrix4(M); dn.set(0, 0, -1).transformDirection(M); ray.set(o, dn); ray.far = 4; const h = ray.intersectObjects(cand, false)[0]; if (h) zBody = h.point.clone().applyMatrix4(inv).z; }
      let xL = xc, xR = xc; for (let x = xc; x > lb.min.x; x -= 0.05) { const y = hitDown(x, zTop - 0.05); if (y == null || y < yTop - 0.25 || y > yTop + 0.9) break; xL = x; } for (let x = xc; x < lb.max.x; x += 0.05) { const y = hitDown(x, zTop - 0.05); if (y == null || y < yTop - 0.25 || y > yTop + 0.9) break; xR = x; }
      let key = key0 || STALL_KEY[S.name]; if (!key) { const p = new THREE.Vector3().applyMatrix4(M); let best = 9; for (const s of steamNames) { const d = s.p.distanceTo(p); if (d < best && STALLW[s.k]) { best = d; key = s.k; } } key = key || 'snacks'; if (stalls.some((q) => q.key === key)) key = ['kushikatsu', 'okonomiyaki', 'snacks'].find((k) => !stalls.some((q) => q.key === k)) || key; }
      const free = (x, z, r) => [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r], [x, z]].every(([a, b]) => { const y = hitDown(a, b); return y != null && Math.abs(y - yTop) < 0.035; });
      const got = dressCounter({ M, xL, xR, zBody: Math.min(zBody, zTop), zTop, yTop, key, free });
      stalls.push({ n: S.name, key, w: +(xR - xL).toFixed(2), yTop: +yTop.toFixed(2), xc, zTop: +zTop.toFixed(2), zBody: +zBody.toFixed(2), sc: +new THREE.Vector3().setFromMatrixScale(M).x.toFixed(2), lb: [lb.min.toArray().map((v) => +v.toFixed(2)), lb.max.toArray().map((v) => +v.toFixed(2))], ...got });
      if (key === 'oden') { const g = byName(S.name + '_goods'); const c = g ? new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()) : new THREE.Vector3(0, yTop + 0.15, zTop - 0.5).applyMatrix4(M); extraSteam.push(c.setY(c.y + 0.15)); }
    }
  } catch (e) { log.stallErr = String(e && e.stack || e); }
  log.stalls = stalls;
  // =====================================================================================================================
  // 4. TAIYAKI YATAI with a live seller + queue
  // =====================================================================================================================
  const actors = [];
  try {
    const seller = (() => { let s = null; world3d.traverse((o) => { if (!s && /^VIGA_seller_\d+$/.test(o.name)) s = o; }); return s; })();
    const shopper = (() => { let s = []; world3d.traverse((o) => { if (/^VIGA_shopper_[a-z]\d*_?\d*$/.test(o.name) && !/bag/.test(o.name) && s.length < 2) s.push(o); }); return s; })();
    const cands = []; for (let x = -8; x <= 36; x += 1) for (let z = -54; z <= -30; z += 1) cands.push([x, z, Math.hypot(x - 10, (z + 43) * 1.6)]); cands.sort((p, q) => p[2] - q[2]);
    let spot = null, tried = 0; for (const [x, z] of cands) { tried++; const bb = new THREE.Box3(new THREE.Vector3(x - 1.9, 0.05, z - 1.6), new THREE.Vector3(x + 1.9, 3.2, z + 3.7)); const hit = clash(bb, /^(GROUND_)/); if (!hit.length) { spot = [x, z]; break; } }
    log.clashes.push({ tried });
    if (spot) {
      const [X, Z] = spot, Tw = new GB(), Tk = Tw, Tc = new GB(), Tf = Tw;
      const wd = hex('#7a5232'), wdk = hex('#3d2a1c');
      Tw.box(X, 0.5, Z, 2.4, 0.9, 1.2, wd); Tw.box(X, 0.98, Z + 0.05, 2.6, 0.07, 1.4, hex('#9a6a3e')); // counter
      for (const sx of [-1.15, 1.15]) for (const sz of [-0.55, 0.55]) Tw.box(X + sx, 1.7, Z + sz, 0.09, 1.5, 0.09, wdk);
      Tk.box(X, 2.48, Z, 2.8, 0.08, 1.7, hex('#b8242c')); Tk.box(X, 2.62, Z, 2.4, 0.2, 1.3, hex('#d23a2f')); // cloth roof
      // noren with たい焼 across the front (canvas strip), hanging from the roof edge
      const nt = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#1f3a6b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5efe0'; g.font = 'bold 40px "Yu Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif'; g.textAlign = 'center'; g.fillText('たい焼', w / 2, 46); g.fillStyle = '#16294d'; for (let k = 1; k < 4; k++) g.fillRect(k * 64 - 1, 0, 2, h); }, false);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.55), new THREE.MeshStandardMaterial({ map: nt, roughness: 0.9, side: THREE.DoubleSide })); nm.position.set(X, 2.16, Z + 0.86); nm.raycast = noRay; root.add(nm);
      // iron mould plate: dark slab with 2x6 fish-shaped hollows (raised rims), plus a tray of golden taiyaki
      Tc.box(X - 0.45, 1.08, Z - 0.05, 1.1, 0.1, 0.62, hex('#2a2a2c'));
      const fishS = new THREE.Shape(); fishS.moveTo(0.16, 0); fishS.bezierCurveTo(0.14, 0.08, -0.02, 0.09, -0.1, 0.04); fishS.lineTo(-0.17, 0.08); fishS.lineTo(-0.15, 0); fishS.lineTo(-0.17, -0.08); fishS.lineTo(-0.1, -0.04); fishS.bezierCurveTo(-0.02, -0.09, 0.14, -0.08, 0.16, 0);
      const fg = new THREE.ExtrudeGeometry(fishS, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 }).rotateX(-Math.PI / 2);
      const fmat = new THREE.MeshStandardMaterial({ color: 0xc8812f, roughness: 0.65 }), dmat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.5, metalness: 0.4 });
      const fishPos = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) fishPos.push([X - 0.8 + c * 0.34, 1.15, Z - 0.2 + r * 0.3, 0]);
      const trayPos = []; for (let k = 0; k < 7; k++) trayPos.push([X + 0.45 + (k % 4) * 0.17 - 0.1, 1.06 + (k > 3 ? 0.05 : 0), Z - 0.15 + (k > 3 ? 0.12 : 0) + (k % 2) * 0.05, 0.4 + k * 0.5]);
      const FI = new THREE.InstancedMesh(fg, fmat, fishPos.length + trayPos.length); FI.name = 'AD2_taiyaki'; FI.raycast = noRay; const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
      [...fishPos, ...trayPos].forEach((p, i) => { FI.setMatrixAt(i, M4.compose(new THREE.Vector3(p[0], p[1], p[2]), q.setFromEuler(e.set(0, p[3], 0)), one)); }); root.add(FI);
      Tf.box(X + 0.6, 1.02, Z - 0.05, 0.8, 0.03, 0.5, hex('#e9e2d0')); // paper-lined tray
      Tc.box(X - 0.45, 0.6, Z - 0.05, 0.9, 0.9, 0.5, hex('#3a3a3d')); // burner box
      stalls.push({ n: 'AD2_taiyaki', key: 'taiyaki', ...dressCounter({ M: new THREE.Matrix4(), xL: X - 1.2, xR: X + 1.2, zBody: Z + 0.6, zTop: Z + 0.75, yTop: 1.015, key: 'taiyaki', free: (x, z, r) => z - r > Z + 0.3 && Math.abs(x - X) + r < 1.25 }) });
      [[Tw, std({ roughness: 0.85 })], [Tc, std({ roughness: 0.5, metalness: 0.3 })]].forEach(([g, m], i) => mesh(g, m, 'AD2_taiyaki_' + i));
      // steam over the plate
      const st = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
      { const nP = isMobile ? 3 : 5; for (let k = 0; k < nP; k++) puff(new THREE.Vector3(X - 0.45, 1.2, Z - 0.05), k, nP); }
      // townsfolk: seller behind the counter flipping the iron, two customers queuing (one checks the tray, one waits)
      if (seller) { const s = seller.clone(true); s.name = 'AD2_taiyaki_seller'; s.position.set(X - 0.4, seller.getWorldPosition(new THREE.Vector3()).y, Z - 1.05); s.rotation.set(0, 0, 0); s.traverse((o) => { o.raycast = noRay; }); scene.add(s); actors.push({ kind: 'flip', o: s, p0: s.position.clone(), ph: 0.3 }); }
      shopper.forEach((sh, k) => { const s = sh.clone(true); s.name = 'AD2_taiyaki_customer_' + k; s.position.set(X + 0.3 + k * 0.85, sh.getWorldPosition(new THREE.Vector3()).y, Z + 1.35 + k * 0.75); s.rotation.set(0, Math.PI + (k ? 0.35 : -0.15), 0); s.traverse((o) => { o.raycast = noRay; o.matrixAutoUpdate = true; }); { const old = []; s.traverse((o) => { if (/_bag$/.test(o.name)) old.push(o); }); old.forEach((o) => o.parent.remove(o)); // r4: the cloned bag node kept rendering at the ORIGINAL shopper (2 bags there); drop it, give the clone its own
        if (old.length && mkBag) { const b = mkBag(); b.name = s.name + '_bag_ad2paper'; b.position.set(0.065, 0.3, 0); s.add(b); } } scene.add(s); actors.push({ kind: k ? 'wait' : 'point', o: s, p0: s.position.clone(), ph: 1.1 + k * 2.3 }); });
      log.taiyaki = { x: X, z: Z, seller: !!seller, customers: shopper.length };
    }
  } catch (e) { log.taiyakiErr = String(e && e.stack || e); }

  try {
    mesh(AP, apronM, 'AD2_yatai_aprons'); mesh(MN, new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.9, side: THREE.DoubleSide, vertexColors: true }), 'AD2_yatai_menus');
    mesh(LIP, std({ roughness: 0.8 }), 'AD2_yatai_lips'); mesh(TR, std({ roughness: 0.95 }), 'AD2_yatai_trays');
    if (bottles.length) { const bp = [[0, 0], [0.042, 0], [0.046, 0.02], [0.046, 0.13], [0.03, 0.17], [0.016, 0.19], [0.016, 0.205], [0, 0.205]].map(([r, y]) => new THREE.Vector2(r, y));
      const BI = new THREE.InstancedMesh(new THREE.LatheGeometry(bp, 10), new THREE.MeshStandardMaterial({ roughness: 0.35, color: 0xffffff }), bottles.length), CI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.035, 8), new THREE.MeshStandardMaterial({ color: 0xc8202c, roughness: 0.5 }), bottles.length);
      const M4 = new THREE.Matrix4(), col = new THREE.Color(); bottles.forEach((b, i) => { BI.setMatrixAt(i, M4.makeTranslation(...b.p)); BI.setColorAt(i, col.set(b.k ? '#efe6c8' : '#3a1e12')); CI.setMatrixAt(i, M4.makeTranslation(b.p[0], b.p[1] + 0.222, b.p[2])); });
      BI.name = 'AD2_yatai_bottles'; CI.name = 'AD2_yatai_caps'; BI.raycast = CI.raycast = noRay; root.add(BI, CI); }
    const st = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(250,250,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
    { const nP = isMobile ? 3 : 5; for (const c of extraSteam) for (let k = 0; k < nP; k++) puff(c.clone(), k, nP); }
    log.props = { bottles: bottles.length, extraSteam: extraSteam.length };
  } catch (e) { log.propsErr = String(e && e.stack || e); }
  // --- 5. r4 MARKET LANE COVER: slim near-future shotengai canopy over the yatai lane (Kuromon feel, open sky kept for the cams)
  //     Cantilevered from back posts behind the stalls (no posts in the walkway): curved steel ribs, translucent polycarbonate
  //     panels, a warm light strip + a thin cyan LED line on the leading edge, hanging vertical banners with generic words.
  //     7 draw calls (1 instanced). Sits at y 8.8-10.6, ~13 u under the crest deck that passes above (y ~24); TV-cam check: ?adcam.
  const canopy = [];
  try {
    const X0 = -0.8, X1 = 34.2, ZP = -52.15, ZF = -41.9, YP = 10.0, YF = 9.0, rib = [], NR = 12; // high arcade roof: the lane's sign boards (tops <= 8.5) and the cherry crowns (<= 7.7) stay underneath
    for (let i = 0; i <= NR; i++) { const u = i / NR, z = ZP + (ZF - ZP) * u, y = YP + (YF - YP) * u + 0.5 * Math.sin(Math.PI * u) * (1 - 0.35 * u); rib.push([z, y]); }
    const vol = new THREE.Box3(new THREE.Vector3(X0, 8.7, ZP - 0.2), new THREE.Vector3(X1, 10.8, ZF + 0.2)); const hb = boxes.filter((e) => e.b.intersectsBox(vol) && !/^(GROUND_|VIGA_|CROWD_)/.test(e.n)); const hits = hb.map((e) => e.n);
    let segs = [[X0, X1]]; for (const e of hb) { const a = e.b.min.x - 0.45, b = e.b.max.x + 0.45; segs = segs.flatMap(([p, q]) => (b <= p || a >= q) ? [[p, q]] : [[p, a], [b, q]].filter(([u, v]) => v - u > 0)); }
    log.canopyHB = hb.map((e) => [e.n.slice(0, 28), ...e.b.min.toArray().map((v) => +v.toFixed(1)), ...e.b.max.toArray().map((v) => +v.toFixed(1))]); segs = segs.filter(([p, q]) => q - p >= 4); log.canopySegs = segs.map(([p, q]) => [+p.toFixed(1), +q.toFixed(1)]);
    const postX = []; for (const [p, q] of segs) { const n = Math.max(2, Math.ceil((q - p - 0.4) / 6.5) + 1); for (let k = 0; k < n; k++) { const x = p + 0.2 + (q - p - 0.4) * k / (n - 1); const pb = new THREE.Box3(new THREE.Vector3(x - 0.2, 0.05, ZP - 0.2), new THREE.Vector3(x + 0.2, 8.7, ZP + 0.2)); const h = clash(pb, /^(GROUND_)/); if (h.length) { (log.canopySkip = log.canopySkip || []).push({ post: +x.toFixed(1), hit: h.slice(0, 3) }); continue; } postX.push(x); } }
    log.canopy = { hits: hits.slice(0, 12), nHits: hits.length };
    // posts + ribs: one instanced geometry (post, diagonal strut, curved rib, end cap)
    const PG = new GB(), st = hex('#3c4148'), st2 = hex('#5b626b');
    const addG = (dst, g) => { const P = g.attributes.position.array, C = g.attributes.color.array, U = g.attributes.uv.array; for (let v = 0; v < P.length / 3; v++) { dst.P.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); dst.C.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]); dst.U.push(U[v * 2], U[v * 2 + 1]); } };
    const bar = (dst, za, ya, zb, yb, w, h, c, dz = 0, dx = 0) => { const len = Math.hypot(zb - za, yb - ya); const sg = new GB(); sg.box(0, 0, 0, w, h, len + 0.02, c); addG(dst, sg.geo(new THREE.Matrix4().makeTranslation(dx, (ya + yb) / 2, (za + zb) / 2 + dz).multiply(new THREE.Matrix4().makeRotationX(-Math.atan2(yb - ya, zb - za))))); };
    PG.box(0, YP / 2, 0, 0.16, YP, 0.16, st); PG.box(0, 0.06, 0, 0.42, 0.12, 0.42, st2);
    for (let i = 0; i < NR; i++) bar(PG, rib[i][0] - ZP, rib[i][1], rib[i + 1][0] - ZP, rib[i + 1][1], 0.1, 0.16 - 0.05 * i / NR, st);
    bar(PG, 0, 7.4, rib[6][0] - ZP, rib[6][1] - 0.08, 0.06, 0.06, st2);
    const mSteel = std({ roughness: 0.45, metalness: 0.6 }); const PI = new THREE.InstancedMesh(PG.geo(), mSteel, Math.max(1, postX.length)); const M4 = new THREE.Matrix4(); PI.count = postX.length;
    postX.forEach((x, k) => PI.setMatrixAt(k, M4.makeTranslation(x, 0, ZP))); PI.name = 'AD2_canopy_frame'; PI.raycast = noRay; root.add(PI); canopy.push(PI);
    const PU = new GB(), PN = new GB(), LW = new GB(), LC = new GB(), BN = new GB(), BR = new GB(); let nbnr = 0;
    const WORDS = [['いらっしゃい', '#b3202a', '#fff4e6'], ['市場', '#f3ecdc', '#1f2f57'], ['旬の味', '#1f2f57', '#fff4e6'], ['食い倒れ', '#c8641c', '#fff4e6'], ['うまいもん', '#f3ecdc', '#b3202a'], ['朝どれ', '#2d5a3a', '#fff4e6']];
    let wi = 0;
    for (const [xa0, xb0] of segs) { const L = xb0 - xa0, cx = (xa0 + xb0) / 2;
      // purlins, leading-edge fascia, back gutter, end ribs closing each segment
      for (const i of [0, 3, 6, 9]) { const [z, y] = rib[i]; PU.box(cx, y + 0.07, z, L, 0.06, 0.06, st2); }
      PU.box(cx, YF - 0.02, ZF, L + 0.1, 0.2, 0.12, st); PU.box(cx, YP + 0.02, ZP - 0.05, L + 0.1, 0.14, 0.18, st);
      for (const x of [xa0, xb0]) for (let i = 0; i < NR; i++) bar(PU, rib[i][0], rib[i][1] + 0.02, rib[i + 1][0], rib[i + 1][1] + 0.02, 0.08, 0.12, st, 0, x);
      // translucent panels between ribs
      const nb = Math.max(1, Math.round(L / 1.55)); for (let b = 0; b < nb; b++) { const xa = xa0 + L * b / nb + 0.03, xb = xa0 + L * (b + 1) / nb - 0.03;
        for (let i = 0; i < NR; i++) { const [za, ya] = rib[i], [zb, yb] = rib[i + 1]; const tone = 0.92 + 0.08 * ((b * 7 + i) % 3) / 2; PN.quad([xa, ya + 0.09, za], [xb, ya + 0.09, za], [xb, yb + 0.09, zb], [xa, yb + 0.09, zb], undefined, [tone, tone, tone]); } }
      LW.box(cx, YF - 0.14, ZF - 0.12, L - 0.4, 0.04, 0.1, hex('#ffd9a0')); { const [z, y] = rib[5]; LW.box(cx, y - 0.04, z, L - 0.4, 0.04, 0.08, hex('#ffcf90')); }
      LC.box(cx, YF + 0.06, ZF + 0.065, L, 0.025, 0.01, hex('#59e8ff'));
      // banners: every ~6 u along the leading edge, only where nothing hangs already
      for (let x = xa0 + 1.4; x <= xb0 - 1.0; x += 6.2) { const z = ZF - 0.32, y1 = YF - 0.18, y0 = y1 - 2.2, hw = 0.36, bb = new THREE.Box3(new THREE.Vector3(x - hw, y0, z - 0.1), new THREE.Vector3(x + hw, y1, z + 0.1)); const h = clash(bb, /^(GROUND_)/);
        if (h.length || (x > 3.4 && x < 6.6)) { (log.canopySkip = log.canopySkip || []).push({ banner: +x.toFixed(1), hit: h.slice(0, 2) }); continue; } const i = wi++ % WORDS.length, u0 = i / WORDS.length, u1 = (i + 1) / WORDS.length, sk = (i % 2 ? 1 : -1) * 0.04;
        BN.quad([x - hw, y0, z + sk], [x + hw, y0, z + sk], [x + hw, y1, z], [x - hw, y1, z], [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]); BR.box(x, YF - 0.16, z, 0.84, 0.035, 0.035, st); nbnr++; }
      for (let x = xa0 + 4.5; x <= xb0 - 1.0; x += 6.2) { const [z, yr] = rib[5], y1 = yr - 0.1, y0 = y1 - 1.9, hw = 0.36, bb = new THREE.Box3(new THREE.Vector3(x - hw, y0, z - 0.1), new THREE.Vector3(x + hw, y1, z + 0.1)); // second row hung under the roof (Kuromon: signs under the arcade)
        if (clash(bb, /^(GROUND_)/).length) continue; const i = wi++ % WORDS.length, u0 = i / WORDS.length, u1 = (i + 1) / WORDS.length;
        BN.quad([x - hw, y0, z], [x + hw, y0, z], [x + hw, y1, z], [x - hw, y1, z], [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]); BR.box(x, y1 + 0.02, z, 0.84, 0.035, 0.035, st); nbnr++; } }
    mesh(PU, mSteel, 'AD2_canopy_purlins'); mesh(BR, mSteel, 'AD2_canopy_rods');
    canopy.push(mesh(PN, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xf4efe4, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }), 'AD2_canopy_panels'));
    mesh(LW, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: 0xffffff }), 'AD2_canopy_lightstrip'); mesh(LC, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 'AD2_canopy_led');
    const bTex = canvasTex(64 * WORDS.length, 256, (g) => { WORDS.forEach(([wd, bg, fg], i) => { const x = i * 64; g.fillStyle = bg; g.fillRect(x, 0, 64, 256); g.fillStyle = fg; g.fillRect(x, 0, 64, 10); g.fillRect(x + 4, 246, 56, 4);
      g.font = 'bold 34px "Yu Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const ch = [...wd], step = Math.min(44, 220 / ch.length); ch.forEach((c, k) => g.fillText(c, x + 32, 18 + step * (k + 0.5) + (220 - step * ch.length) / 2)); }); }, false);
    canopy.push(mesh(BN, new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.9, side: THREE.DoubleSide, vertexColors: true }), 'AD2_canopy_banners'));
    log.canopy.banners = nbnr; log.canopy.posts = postX.length;
  } catch (e) { log.canopyErr = String(e && e.stack || e); }
  // --- 6. r4 DUSK SEA + castle moat: the glb's sea material (an emissive sparkle texture tiled across 420 u) read as purple glitter /
  //     a starfield from the blimp. Replaced by a calm procedural water: 4 long low-frequency swells (analytic normal, no noise
  //     texture = no speckle at any distance), fresnel from deep teal-indigo to the dusk-sky reflection, one soft glint path toward
  //     the sun, horizon haze far out. One material, no textures.
  const seaU = { uT: { value: 0 }, uSun: { value: new THREE.Vector3(-0.6, 0.22, -0.77).normalize() }, uDeep: { value: new THREE.Color('#09252f') }, uMid: { value: new THREE.Color('#163f4a') },
    uSky: { value: new THREE.Color('#47396f') }, uHor: { value: new THREE.Color('#b06d8c') }, uGl: { value: new THREE.Color('#ffbf8c') }, uK: { value: 1 },
    uRing: { value: new THREE.Color().setRGB(84 / 255, 56 / 255, 97 / 255, THREE.SRGBColorSpace) } }; // r5: avg colour of main.js's painted LP3_bg_far_ground ring (r 100-192)
  try {
    scene.traverse((o) => { if (o.isDirectionalLight) { const d = o.position.clone().sub(o.target.position); if (d.lengthSq() > 1e-6 && !log.seaSun) { d.normalize(); d.y = Math.max(0.12, Math.min(0.45, d.y)); seaU.uSun.value.copy(d.normalize()); log.seaSun = d.toArray().map((v) => +v.toFixed(2)); } } });
    const mkSea = (k) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }); const U = Object.assign({}, seaU, { uK: { value: k } });
      m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
        sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform float uT; uniform float uK; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uSky; uniform vec3 uHor; uniform vec3 uGl; uniform vec3 uRing; varying vec3 vW;\n' +
          sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  vec2 p = vW.xz * uK; float dist = length(cameraPosition - vW); float fd = 1.0 - smoothstep(40.0, 170.0, dist); // r5: swells + glint die out well before the horizon
  vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.5, 0.866), d3 = vec2(0.28, -0.96), d4 = vec2(-0.94, -0.34);
  float a1 = dot(p, d1) * 0.09 + uT * 0.32, a2 = dot(p, d2) * 0.14 + uT * 0.41, a3 = dot(p, d3) * 0.23 - uT * 0.55, a4 = dot(p, d4) * 0.37 + uT * 0.7;
  vec2 g = d1 * cos(a1) * 0.085 + d2 * cos(a2) * 0.065 + d3 * cos(a3) * 0.045 + d4 * cos(a4) * 0.03 * fd;
  g *= fd * fd;
  float h = sin(a1) * 0.5 + sin(a2) * 0.35 + sin(a3) * 0.15;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y)); vec3 V = normalize(cameraPosition - vW);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 Rf = reflect(-V, N); vec3 sky = mix(uHor, uSky, sqrt(clamp(Rf.y, 0.0, 1.0)));
  vec3 body = mix(uDeep, uMid, 0.5 + 0.22 * h);
  vec3 col = mix(body, sky, clamp(fres * 0.95, 0.0, 0.82));
  float sd = max(dot(Rf, uSun), 0.0); col += uGl * (pow(sd, 70.0) * 0.5 + pow(sd, 9.0) * 0.07) * fd;
  col = mix(col, mix(uMid, uHor * 0.75 + uSky * 0.25, 0.6), smoothstep(90.0, 300.0, dist) * 0.8);
  col = mix(col, uRing, smoothstep(62.0, 99.0, length(vW.xz)) * step(uK, 1.5) * 0.9); // r5: meet the painted far ring without a hard teal/purple seam
  vec4 diffuseColor = vec4(col, 1.0);`); };
      m.customProgramCacheKey = () => 'ad2sea'; m.userData.seaU = U; return m; };
    const seaMats = [];
    const sea = byName('SEA'); if (sea) sea.traverse((c) => { if (c.isMesh) { c.material = mkSea(1); seaMats.push(c.material); } });
    const C2 = byName('PROP_osaka_castle'); if (C2) C2.traverse((c) => { if (c.isMesh && /water/i.test(c.material?.name || '')) { c.material = mkSea(2.2); seaMats.push(c.material); } });
    seaU.list = seaMats; log.sea = seaMats.length;
  } catch (e) { log.seaErr = String(e && e.stack || e); }
  // --- 7. r5 SAKURA: the glb cherry trees were faceted low-poly pink balls. Rebuilt at runtime on the same spot and inside the same
  //     footprint (positions came from the clash sweep): gnarled dark trunk splitting into 2-3 limbs, twig tips poking out between
  //     5-9 lumpy blossom clumps (smooth normals bent toward the crown centre = soft, facet-free shading; vertex tint dark-pink core
  //     -> pale edge + a fresnel rim), and a light drift of falling petals animated entirely in the vertex shader (no CPU per frame).
  //     Draw calls for ALL trees: trunks 1, clumps 1, petals 1.
  const sakuraU = { uT: { value: 0 } };
  try {
    let q = 4242; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
    const roots = [], isT = (o) => /^PROP_cherry_tree_(\d+|v\d+)$/.test(o.name); world3d.traverse((o) => { if (!isT(o)) return; let a = o.parent; while (a) { if (isT(a)) return; a = a.parent; } roots.push(o); });
    const TP = [], TN = [], TC = [], TI = []; // trunk arrays (indexed, analytic smooth normals)
    const tube = (pts, r0, r1, c0, c1) => { const S = 7, base = TP.length / 3, up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
      pts.forEach((p, i) => { const k = i / (pts.length - 1), rad = r0 + (r1 - r0) * k; t.copy(pts[Math.min(i + 1, pts.length - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize(); a.crossVectors(t, Math.abs(t.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up).normalize(); b.crossVectors(t, a);
        for (let s = 0; s < S; s++) { const ang = s / S * Math.PI * 2, gn = 1 + 0.12 * Math.sin(ang * 3 + i * 1.7); const n = a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)); TP.push(p.x + n.x * rad * gn, p.y + n.y * rad * gn, p.z + n.z * rad * gn); TN.push(n.x, n.y, n.z);
          const cc = c0.clone().lerp(c1, k).multiplyScalar(0.85 + 0.25 * ((s * 5 + i * 3) % 4) / 3); TC.push(cc.r, cc.g, cc.b); } });
      for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < S; s++) { const A = base + i * S + s, B = base + i * S + (s + 1) % S, C = A + S, D = B + S; TI.push(A, C, B, B, C, D); } };
    const bark0 = new THREE.Color('#2e211f'), bark1 = new THREE.Color('#4a3631');
    const clumps = [], petals = []; log.sakura = [];
    for (const R0 of roots) {
      R0.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(R0); if (bb.isEmpty()) continue; const pink = new THREE.Box3(); let nPink = 0;
      R0.traverse((m) => { if (!m.isMesh) return; const c = m.material?.color; const isPink = /blossom|sakura|pink|petal|flower/i.test(m.material?.name || '') || (c && c.r > c.g * 1.15 && c.r > 0.5); if (isPink) { pink.union(new THREE.Box3().setFromObject(m)); nPink++; } m.visible = false; });
      const H = bb.max.y - bb.min.y, cb = nPink ? pink : new THREE.Box3(new THREE.Vector3(bb.min.x, bb.min.y + H * 0.4, bb.min.z), bb.max.clone());
      const cc = cb.getCenter(new THREE.Vector3()), cs = cb.getSize(new THREE.Vector3()), base = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2);
      { const tb = new THREE.Vector3(); let nT = 0; R0.traverse((m) => { if (m.isMesh) { const b2 = new THREE.Box3().setFromObject(m); if (b2.min.y < bb.min.y + 0.2 && b2.max.x - b2.min.x < cs.x * 0.5) { tb.add(b2.getCenter(new THREE.Vector3())); nT++; } } }); if (nT) { tb.divideScalar(nT); base.x = tb.x; base.z = tb.z; } }
      const yS = Math.max(bb.min.y + H * 0.22, cb.min.y - cs.y * 0.05), rT = Math.min(0.32, Math.max(0.14, H * 0.045)), lean = new THREE.Vector3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5);
      const split = base.clone().add(new THREE.Vector3(lean.x, yS - base.y, lean.z));
      tube([base.clone().add(new THREE.Vector3(0, -0.05, 0)), base.clone().add(new THREE.Vector3(lean.x * 0.3 + 0.06, (yS - base.y) * 0.45, lean.z * 0.3 - 0.05)), split], rT * 1.25, rT * 0.85, bark0, bark1);
      // 5-9 clumps inside the original crown ellipsoid; limbs run from the split to the larger clumps
      const nC = 5 + Math.floor(r() * 5), crs = []; const rx = cs.x / 2, ry = cs.y / 2, rz = cs.z / 2;
      for (let k = 0; k < nC; k++) { const a = k / nC * Math.PI * 2 + r() * 0.5, rr = k === 0 ? 0.1 : 0.6 + r() * 0.3, yy = k === 0 ? 0.45 : (k % 2 ? -0.3 : 0.2) + (r() - 0.5) * 0.25; const s = (k === 0 ? 0.48 : 0.32 + r() * 0.14) * Math.min(rx, rz) * 1.05;
        const p = new THREE.Vector3(cc.x + Math.cos(a) * rr * (rx - s * 0.6), cc.y + yy * (ry - s * 0.5), cc.z + Math.sin(a) * rr * (rz - s * 0.6)); p.y = Math.min(p.y, cb.max.y - s * 0.85); p.y = Math.max(p.y, cb.min.y + s * 0.6); crs.push({ p, s }); const sv = new THREE.Vector3(s * (1.05 + r() * 0.25), s * (0.62 + r() * 0.16), s * (1.05 + r() * 0.25)); { // clash-safe: keep every clump (x1.16 lump margin) inside the ORIGINAL crown box
          const L = 1.16, ex = Math.max(sv.x, sv.z) * L, lim = Math.min(rx, rz); if (ex > lim * 0.95) sv.multiplyScalar(lim * 0.95 / ex);
          const dx = p.x - cc.x, dz = p.z - cc.z, dd = Math.hypot(dx, dz), e2 = Math.max(sv.x, sv.z) * L; if (dd + e2 > lim) { const k2 = Math.max(0, lim - e2) / Math.max(dd, 1e-3); p.x = cc.x + dx * k2; p.z = cc.z + dz * k2; }
          p.y = Math.min(p.y, cb.max.y - sv.y * L); p.y = Math.max(p.y, cb.min.y + sv.y * L * 0.8); }
        clumps.push({ p, s: sv, rot: r() * 6.28, c: cc.clone(), tone: r() }); }
      const nL = 2 + Math.floor(r() * 2); const sorted = crs.slice(1).sort((u, v) => v.s - u.s);
      for (let l = 0; l < nL && l < sorted.length; l++) { const e = sorted[l].p.clone().lerp(cc, 0.25); const mid = split.clone().lerp(e, 0.5).add(new THREE.Vector3((r() - 0.5) * 0.35, 0.15, (r() - 0.5) * 0.35)); tube([split.clone(), mid, e], rT * 0.7, rT * 0.28, bark1, bark0); }
      for (let k = 0; k < 7; k++) { const a = r() * 6.28, from = cc.clone().add(new THREE.Vector3(Math.cos(a) * rx * 0.45, (r() - 0.3) * ry * 0.6, Math.sin(a) * rz * 0.45)); const to = cc.clone().add(new THREE.Vector3(Math.cos(a) * rx * 1.02, (r() - 0.2) * ry * 0.9, Math.sin(a) * rz * 1.02)); to.y = Math.min(to.y, cb.max.y); tube([from, from.clone().lerp(to, 0.55).add(new THREE.Vector3(0, 0.08, 0)), to], 0.075, 0.025, bark0, bark0); }
      const nPt = isMobile ? 6 : 16; for (let k = 0; k < nPt; k++) { const a = r() * 6.28, d = Math.sqrt(r()); petals.push([cc.x + Math.cos(a) * rx * 1.1 * d, cb.min.y + cs.y * 0.3, cc.z + Math.sin(a) * rz * 1.1 * d, r(), 0.25 + r() * 0.2, cb.min.y + cs.y * 0.3 - bb.min.y]); }
      { const nb = new THREE.Box3(); for (const c of clumps.slice(-nC)) nb.union(new THREE.Box3().setFromCenterAndSize(c.p, new THREE.Vector3(Math.max(c.s.x, c.s.z) * 2.32, c.s.y * 2.32, Math.max(c.s.x, c.s.z) * 2.32))); nb.min.y = Math.max(nb.min.y, bb.min.y + 1);
        const h = clash(nb, /^PROP_cherry_tree_/); if (h.length) (log.sakuraClash = log.sakuraClash || []).push([R0.name, h.slice(0, 3)]); log.sakuraOver = Math.max(log.sakuraOver || 0, +Math.max(bb.min.x - nb.min.x, nb.max.x - bb.max.x, bb.min.z - nb.min.z, nb.max.z - bb.max.z, nb.max.y - bb.max.y).toFixed(2)); }
      log.sakura.push([R0.name, nPink, nC, +H.toFixed(1)]); }
    if (roots.length) {
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(TP, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(TN, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(TC, 3)); tg.setIndex(TI);
      const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); tm.name = 'AD2_sakura_trunks'; tm.raycast = noRay; root.add(tm);
      // clump geometry: lumpy sphere, smooth normals bent outward-up, vertex tint: dark core underneath -> pale tips on top
      const cg = new THREE.SphereGeometry(1, isMobile ? 14 : 20, isMobile ? 10 : 14); const P = cg.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const d = 1 + 0.1 * Math.sin(v.x * 4.1 + v.y * 2.3) * Math.cos(v.z * 3.7 - v.y * 1.9) + 0.06 * Math.sin(v.x * 9 + v.z * 7) * Math.sin(v.y * 8); v.multiplyScalar(d); P.setXYZ(i, v.x, v.y, v.z); }
      cg.computeVertexNormals(); const Nn = cg.attributes.normal, cols = [];
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).normalize(); const nx = Nn.getX(i) * 0.4 + v.x * 0.6, ny = Nn.getY(i) * 0.4 + v.y * 0.6 + 0.15, nz = Nn.getZ(i) * 0.4 + v.z * 0.6; const l = Math.hypot(nx, ny, nz); Nn.setXYZ(i, nx / l, ny / l, nz / l);
        const k = THREE.MathUtils.smoothstep(v.y, -0.7, 0.9); cols.push(0.74 + 0.24 * k, 0.24 + 0.38 * k, 0.44 + 0.34 * k); }
      cg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0x5a1a34, emissiveIntensity: 0.42 });
      cm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.8, 0.9), rim * 0.34); totalEmissiveRadiance += vec3(0.30, 0.14, 0.2) * rim * 0.35; }`); };
      cm.customProgramCacheKey = () => 'ad2sakura';
      const CI = new THREE.InstancedMesh(cg, cm, clumps.length), M4 = new THREE.Matrix4(), Qr = new THREE.Quaternion(), col = new THREE.Color();
      clumps.forEach((c, i) => { CI.setMatrixAt(i, M4.compose(c.p, Qr.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rot), c.s)); CI.setColorAt(i, col.setRGB(1, 0.9 + 0.1 * c.tone, 0.95 + 0.05 * c.tone)); });
      CI.name = 'AD2_sakura_clumps'; CI.raycast = noRay; root.add(CI);
      // falling petals: one tiny quad per instance, motion in the vertex shader (phase/speed/fall range per instance)
      const pg = new THREE.PlaneGeometry(0.13, 0.1); const PI = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: 0xffc9dc, side: THREE.DoubleSide, emissive: 0x401822 }), petals.length);
      const aP = new Float32Array(petals.length * 3); petals.forEach((p, i) => { PI.setMatrixAt(i, M4.makeTranslation(p[0], p[1], p[2])); aP[i * 3] = p[3]; aP[i * 3 + 1] = p[4]; aP[i * 3 + 2] = p[5]; });
      pg.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 3));
      PI.material.onBeforeCompile = (sh) => { sh.uniforms.uT = sakuraU.uT; sh.vertexShader = 'uniform float uT; attribute vec3 aP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { float f = fract(uT * aP.y / max(aP.z, 0.5) * 0.35 + aP.x); float a = uT * (2.0 + aP.x * 3.0) + aP.x * 40.0; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a)); transformed.xy = R * transformed.xy; transformed.yz = mat2(cos(a * 0.7), -sin(a * 0.7), sin(a * 0.7), cos(a * 0.7)) * transformed.yz;
    transformed *= smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.85, 1.0, f));
    transformed += vec3(sin(uT * 0.9 + aP.x * 17.0) * 0.45 + f * 0.9, -f * aP.z, cos(uT * 0.7 + aP.x * 11.0) * 0.4); }`); };
      PI.material.customProgramCacheKey = () => 'ad2petal'; PI.frustumCulled = false; PI.name = 'AD2_sakura_petals'; PI.raycast = noRay; root.add(PI);
      log.sakuraN = { trees: roots.length, clumps: clumps.length, petals: petals.length, trunkVerts: TP.length / 3 }; }
  } catch (e) { log.sakuraErr = String(e && e.stack || e); }
  // TV-cam clearance probe (debug only, ?adcam): counts marbles in the camera frustum whose sight line passes through the canopy volume
  if (/adcam/.test(location.search)) { const cb = new THREE.Box3(new THREE.Vector3(-1.0, 8.6, -52.4), new THREE.Vector3(34.4, 10.8, -41.6)), pr = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    pr.frustumCulled = false; pr.raycast = noRay; const R0 = new THREE.Ray(), v = new THREE.Vector3(), hp = new THREE.Vector3(), stt = window.__ad2cam = { frames: 0, vis: 0, blocked: 0, canopyInView: 0, samples: [] }; let fc = 0;
    const fr = new THREE.Frustum(), pm = new THREE.Matrix4();
    pr.onBeforeRender = (r, s, cam) => { if (!cam.isPerspectiveCamera || ++fc % 4) return; stt.frames++; pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm); const cp = cam.getWorldPosition(new THREE.Vector3());
      if (fr.intersectsBox(cb)) stt.canopyInView++; const ms = (window.__dh && window.__dh.marbles) || [];
      for (const m of ms) { const p = m.mesh && m.mesh.position; if (!p || !fr.containsPoint(p)) continue; stt.vis++; v.copy(p).sub(cp); const d = v.length(); R0.set(cp, v.normalize()); if (R0.intersectBox(cb, hp) && hp.distanceTo(cp) < d - 0.5) { stt.blocked++; if (stt.samples.length < 20) stt.samples.push([cp.toArray().map((x) => +x.toFixed(1)), p.toArray().map((x) => +x.toFixed(1))]); } } };
    root.add(pr); }
  // =====================================================================================================================
  // update
  // =====================================================================================================================
  const update = (dt, t) => {
    if (seaU.list) for (const m of seaU.list) m.userData.seaU.uT.value = t;
    sakuraU.uT.value = t;
    for (const p of spin) p.rotation.x += dt * 22;
    for (const b of blink) { const on = b.strobe ? ((t * 0.9) % 1) < 0.08 : (Math.sin(t * 2.4 + b.ph) > -0.2); b.m.visible = on; }
    for (const a of actors) {
      if (a.kind === 'steam') { const u = (t * 0.42 + a.ph) % 1; a.o.position.set(a.base.x + Math.sin(u * 5 + a.ph * 9) * 0.16 * u, a.base.y + u * 1.45, a.base.z + Math.cos(u * 4 + a.ph * 7) * 0.12 * u); const s = (0.3 + u * 1.2) * a.sz; a.o.scale.set(s, s, s); a.o.material.opacity = 0.62 * Math.min(1, u / 0.16) * Math.pow(1 - u, 1.4); a.o.material.rotation = a.rot + u * a.spin; continue; }
      const T = t + a.ph;
      if (a.kind === 'flip') { const k = (T * 0.8) % 1, f = k < 0.25 ? Math.sin(k / 0.25 * Math.PI) : 0; a.o.position.set(a.p0.x + Math.sin(T * 0.6) * 0.25, a.p0.y + f * 0.12, a.p0.z); a.o.rotation.set(-f * 0.35, Math.sin(T * 0.6) * 0.25, 0); }
      else if (a.kind === 'point') { a.o.position.set(a.p0.x + Math.sin(T * 0.5) * 0.12, a.p0.y + Math.abs(Math.sin(T * 1.7)) * 0.05, a.p0.z); a.o.rotation.y = Math.PI - 0.15 + Math.sin(T * 0.7) * 0.4; a.o.rotation.x = Math.sin(T * 1.7) * 0.08; }
      else if (a.kind === 'wait') { a.o.position.y = a.p0.y + Math.abs(Math.sin(T * 1.1)) * 0.04; a.o.rotation.y = Math.PI + 0.35 + Math.sin(T * 0.45) * 0.6; a.o.rotation.z = Math.sin(T * 1.1) * 0.05; }
    }
  };
  const bagsWorld = () => { const o = []; scene.traverse((m) => { if (/_ad2paper$/.test(m.name) && m.visible) o.push([m.name, m.parent?.parent?.name, m.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))]); }); return o; };
  const stats = () => Object.assign({}, log, { bagsWorld: bagsWorld(), waterLights: wLights.length, actors: actors.filter((a) => a.kind !== 'steam').length, spin: spin.length, blink: blink.length });
  const actorList = () => actors.filter((a) => a.kind !== 'steam').map((a) => ({ name: a.o.name, kind: 'ad2_' + a.kind, p: a.o.position.toArray(), q: a.o.quaternion.toArray() }));
  return { update, stats, actors: actorList, waterLights: () => wLights };
}
