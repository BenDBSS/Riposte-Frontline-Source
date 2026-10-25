/* ==========================================================================
   JARDIN : outils de paysagiste pour Hortus (et les cartes de plein air à venir).
   - Splat : peintre de la carte de répartition du sol (pelouse, gravier, dalles, humus) avec des formes (rectangle, disque,
     capsule, chemin, polygone) à bords irréguliers.
   - Sol : plan de la carte et trous des plans d'eau (triangulés avec leurs contours).
   ========================================================================== */
class Splat {
  constructor() {
    const S = SPLAT; this.S = S; this.W = S.w * S.ppm; this.H = S.d * S.ppm; this.px = new Float32Array(this.W * this.H * 4); this.N = makeNoise(2917);
  }
  /* d(x, z) : distance signée au bord (positive dedans) ; boîte englobante [x0, x1, z0, z1] ; soft : largeur du fondu ; k : force */
  paint(ch, box, d, soft = 0.6, k = 1, wob = 1.1) {
    const S = this.S, W = this.W, H = this.H, N = this.N, ppm = S.ppm;
    const i0 = Math.max(0, Math.floor((box[0] - soft - 1 - S.x0) * ppm)), i1 = Math.min(W - 1, Math.ceil((box[1] + soft + 1 - S.x0) * ppm));
    const j0 = Math.max(0, Math.floor((box[2] - soft - 1 - S.z0) * ppm)), j1 = Math.min(H - 1, Math.ceil((box[3] + soft + 1 - S.z0) * ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = S.x0 + (i + 0.5) / ppm, z = S.z0 + (j + 0.5) / ppm;
      const dd = d(x, z) + (N.fbm(x * 0.09, z * 0.09, 32, 32, 3) - 0.5) * wob, w = smoothstep(-soft, soft, dd) * k, o = (j * W + i) * 4;
      if (w > this.px[o + ch]) this.px[o + ch] = w;
    }
  }
  rect(ch, x0, x1, z0, z1, soft, k, wob) { this.paint(ch, [x0, x1, z0, z1], (x, z) => Math.min(x - x0, x1 - x, z - z0, z1 - z), soft, k, wob); }
  disc(ch, cx, cz, r, soft, k, wob) { this.paint(ch, [cx - r, cx + r, cz - r, cz + r], (x, z) => r - hyp(x - cx, z - cz), soft, k, wob); }
  /* ellipse tournée de rot */
  ellipse(ch, cx, cz, rx, rz, rot, soft, k, wob) {
    const c = Math.cos(rot), s = Math.sin(rot), m = Math.max(rx, rz);
    this.paint(ch, [cx - m, cx + m, cz - m, cz + m], (x, z) => { const dx = x - cx, dz = z - cz, a = (dx * c + dz * s) / rx, b = (-dx * s + dz * c) / rz; return (1 - hyp(a, b)) * Math.min(rx, rz); }, soft, k, wob);
  }
  capsule(ch, ax, az, bx, bz, r, soft, k, wob) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    this.paint(ch, [Math.min(ax, bx) - r, Math.max(ax, bx) + r, Math.min(az, bz) - r, Math.max(az, bz) + r], (x, z) => { const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1); return r - hyp(x - ax - dx * t, z - az - dz * t); }, soft, k, wob);
  }
  /* chemin : suite de segments de demi-largeur r (pts [[x, z], ...]) */
  path(ch, pts, r, soft, k, wob) { for (let i = 0; i < pts.length - 1; i++) this.capsule(ch, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, soft, k, wob); }
  /* polygone [[x, z], ...] : distance signée au contour */
  poly(ch, pts, soft, k, wob) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    this.paint(ch, [x0, x1, z0, z1], (x, z) => polyDist(pts, x, z), soft, k, wob);
  }
  /* Part de la couche ch (0 à 3) au point (x, z) */
  at(ch, x, z) { const S = this.S, i = Math.floor((x - S.x0) * S.ppm), j = Math.floor((z - S.z0) * S.ppm); return i < 0 || j < 0 || i >= this.W || j >= this.H ? 0 : this.px[(j * this.W + i) * 4 + ch]; }
  /* Texture de répartition : r, g, b = couches 1 à 3, a = salissure (terre battue sur la pelouse) */
  finish(dirt = 0.15) {
    const { W, H, px, N, S } = this, out = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const o = (j * W + i) * 4, x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, n2 = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
      let r = px[o], g = px[o + 1], b = px[o + 2]; const k = Math.max(r, g); b *= 1 - k; const tot = r + g + b; if (tot > 1) { r /= tot; g /= tot; b /= tot; }
      out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255);
      out[o + 3] = Math.round(clamp(dirt * (0.4 + n2 * 0.9) + px[o + 3] * (0.35 + n2 * 0.5), 0, 1) * 255);
    }
    const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  }
}
/* Distance signée d'un point à un polygone (positive à l'intérieur) */
function polyDist(P, x, z) {
  let inside = false, dm = 1e9;
  for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
    const ax = P[a][0], az = P[a][1], bx = P[b][0], bz = P[b][1];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), d = hyp(x - ax - dx * t, z - az - dz * t);
    if (d < dm) dm = d;
  }
  return inside ? dm : -dm;
}
/* Point du contour le plus proche de (x, z) */
function polyNearest(P, x, z) {
  let best = null, dm = 1e9;
  for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
    const ax = P[a][0], az = P[a][1], bx = P[b][0], bz = P[b][1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const qx = ax + dx * t, qz = az + dz * t, d = hyp(x - qx, z - qz); if (d < dm) { dm = d; best = [qx, qz]; }
  }
  return best;
}
/* Sol de la carte : un plan couvrant la zone, percé des contours de plans d'eau (holes : [[[x, z], ...], ...]) */
function floralGroundMesh(splat, holes = []) {
  MAT.ground = groundMat(splat, [SPLAT.x0, SPLAT.z0, SPLAT.w, SPLAT.d], GROUND_FLOREAL);
  const M = DECOR; WORLD.force = 'g'; M.save().color([0.52, 0.52, 0.52]).local(1); M.aoFn = null;
  const X = 330;
  if (!holes.length) { M.plane('ground', 2 * X, 2 * X, 1, 1); }
  else {
    const outer = [[-X, -X], [X, -X], [X, X], [-X, X]], pts = outer.concat(...holes);
    const tri = THREE.ShapeUtils.triangulateShape(outer.map((p) => new THREE.Vector2(p[0], p[1])), holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1]))));
    const B = M.buf('ground', 0, 0, 0), ids = pts.map((p) => M.v(B, p[0], 0, p[1], 0, 1, 0, p[0], -p[1]));
    for (const t of tri) {
      const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cr > 0) M.tri(B, ids[t[0]], ids[t[2]], ids[t[1]]); else M.tri(B, ids[t[0]], ids[t[1]], ids[t[2]]); // face vers le haut : sens horaire dans le plan (x, z)
    }
  }
  M.restore(); WORLD.force = null;
}

/* ---------- Haies, topiaires, mobilier ---------- */
/* Haie taillée : bloc de feuillage opaque. h : hauteur ; en dessous de 0,8 m elle n'a pas de collision (bordure de massif). o : tint, collide, bevel */
function hedge(x0, x1, z0, z1, h = 1.8, o = {}) {
  const solid = o.collide !== undefined ? o.collide : h >= 0.8;
  box('hedge', x0, x1, 0, h, z0, z1, { tint: o.tint || [0.86, 0.96, 0.78], collide: solid, bevel: o.bevel !== undefined ? o.bevel : 0.14, m: 'leaf', ao: o.ao, uv: o.uv });
}
/* Topiaire en pot de pierre : cône, boule, spirale ou cube de buis, h hauteur du feuillage */
PF.topiary = (kind = 'cone', s = 1) => prefab(`topiary_${kind}_${s}`, (M) => {
  const prof = {
    cone: [[0.52, 0], [0.5, 0.2], [0.44, 0.7], [0.3, 1.4], [0.14, 1.95], [0, 2.2]],
    ball: [[0.2, 0], [0.5, 0.18], [0.66, 0.5], [0.7, 0.8], [0.6, 1.15], [0.34, 1.4], [0, 1.5]],
    spiral: [[0.45, 0], [0.55, 0.25], [0.36, 0.55], [0.5, 0.85], [0.3, 1.2], [0.4, 1.5], [0.18, 1.85], [0.2, 2.1], [0, 2.3]],
    cube: [[0.5, 0], [0.62, 0.05], [0.62, 1.0], [0.5, 1.12], [0, 1.15]],
  }[kind];
  M.save().local(1); M.color([0.9, 0.86, 0.78]); M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0, 0.4, y));
  M.lathe('ashlar', [[0.42, 0], [0.46, 0.04], [0.4, 0.1], [0.36, 0.34], [0.46, 0.4], [0.46, 0.46], [0, 0.46]], 12, { sharp: 0.3 });
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0.4, 1.6, y)); M.color([0.84, 0.96, 0.76]);
  M.save().move(0, 0.44, 0); M.lathe('hedge', prof.map(([r, y]) => [r * s, y * s]), 14, { uR: 0.9, sharp: 0.7 }); M.restore();
  M.restore();
  M.col(-0.34 * s, 0.34 * s, 0, 0.44 + prof[prof.length - 1][1] * s * 0.85, -0.34 * s, 0.34 * s, 'leaf');
});
/* Banc de parc : lattes de bois sur flancs de fonte, dossier. Face vers +z */
PF.gbench = () => prefab('gbench', (M) => {
  M.save().local(1); M.cls = 1;
  M.color([0.18, 0.2, 0.18]); for (const x of [-0.75, 0.75]) { M.boxB('steel', x - 0.04, x + 0.04, 0, 0.46, -0.22, 0.2, { bevel: 0.01 }); M.boxB('steel', x - 0.04, x + 0.04, 0.46, 0.9, -0.24, -0.2, { bevel: 0.01 }); M.boxB('steel', x - 0.05, x + 0.05, 0.43, 0.468, -0.24, 0.24, { bevel: 0.01 }); } // traverse sous les lattes (pas à leur niveau)
  M.color([0.62, 0.42, 0.24]);
  for (let i = 0; i < 4; i++) M.boxB('wood', -0.85, 0.85, 0.47, 0.5, -0.2 + i * 0.1, -0.12 + i * 0.1, { bevel: 0.008 });
  for (let i = 0; i < 3; i++) M.boxB('wood', -0.85, 0.85, 0.58 + i * 0.12, 0.66 + i * 0.12, -0.25 - i * 0.015, -0.22 - i * 0.015, { bevel: 0.008 });
  M.restore(); M.col(-0.88, 0.88, 0, 0.5, -0.26, 0.22, 'wood');
});
/* Banc posé en (x, z), à la hauteur y, qui regarde le point (tx, tz) : la face avant du prefab est +z, donc rotation atan2(dx, dz). Tout banc se pose ainsi, jamais avec un angle écrit à la main (le miroir nord-sud de la carte les retournait) */
function benchAt(x, z, tx, tz, y = 0) { DECOR.place(PF.gbench(), x, y, z, Math.atan2(tx - x, tz - z)); }
/* Urne de pierre sur piédestal, avec sa plante (kind : sprite de PF.clump) */
PF.urn = (kind = 'roseP', atlas = 'leafB', s = 1) => prefab(`urn_${kind}_${s}`, (M) => {
  M.save().local(1).color([0.92, 0.88, 0.8]); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 0.5, y));
  M.lathe('ashlar', [[0.38, 0], [0.4, 0.06], [0.3, 0.12], [0.28, 0.5], [0.34, 0.56], [0.3, 0.64], [0.26, 0.74], [0.4, 0.9], [0.5, 1.02], [0.52, 1.1], [0.44, 1.12], [0.4, 1.0]], 14, { sharp: 0.4 });
  M.aoFn = null; M.color([0.3, 0.22, 0.14]); M.save().move(0, 1.0, 0); M.cyl('mulch', 0.43, 0.03, 12); M.restore(); M.restore();
  M.place(PF.clump(kind, atlas, 0.9 * s, 0.75 * s, 3, 3, { cls: 0 }), 0, 1.0, 0, 0);
  M.col(-0.4, 0.4, 0, 1.1, -0.4, 0.4, 'concrete');
});
/* Bassin circulaire de pierre à margelle, eau et jet central. o : tint, jet (0 à 1), pillar (vasque centrale) */
function basin(x, z, r = 2.4, o = {}) {
  const M = DECOR; M.save().move(x, 0, z).color(o.tint || [0.9, 0.86, 0.78]).local(1);
  M.aoFn = (px, py) => lerp(0.62, 1, smoothstep(0, 0.4, py));
  M.lathe('ashlar', [[r + 0.5, 0], [r + 0.5, 0.52], [r + 0.58, 0.55], [r + 0.58, 0.66], [r - 0.02, 0.66], [r - 0.02, 0.3], [0, 0.3]], 24, { sharp: 0.3, uR: 1.4 }); // fond du bassin, vu à travers l'eau
  M.aoFn = null;
  if (o.pillar !== false) {
    M.color([0.92, 0.88, 0.8]);
    M.lathe('ashlar', [[0, 0.3], [0.22, 0.3], [0.17, 0.5], [0.13, 1.3], [0.18, 1.38], [0.55, 1.45], [0.62, 1.55], [0.55, 1.58], [0.15, 1.56], [0.1, 1.8], [0.05, 1.85], [0, 1.86]], 14, { uR: 0.3 });
  }
  M.restore();
  pondAdd({ shape: 'disc', x, y: 0.5, z, r: r - 0.02, seg: 24, rings: 6, jet: o.jet !== undefined ? o.jet : 0.6, bed: 0.2, vis: 0.8, calm: 0.8, foam: 0.5, deep: [0.01, 0.045, 0.045], shallow: [0.04, 0.11, 0.1] });
  if (o.pillar !== false) pondAdd({ shape: 'disc', x, y: 1.56, z, r: 0.5, seg: 14, rings: 4, jet: 1, bed: 0.04, vis: 1, foam: 0.5 });
  const q = (r + 0.55) * 0.88; DECOR.col(x - q, x + q, 0, 0.66, z - q, z + q, 'concrete');
}
/* Mur de clôture de pierre claire, chaperon, pilastres tous les ~6 m et lierre. o : tint, ivy (densité), pil (écart des pilastres) */
function gardenWall(x0, x1, z0, z1, h = 3.2, o = {}) {
  const M = DECOR, along = x1 - x0 >= z1 - z0, tint = o.tint || [0.93, 0.88, 0.78];
  box('ashlar', x0, x1, 0, h, z0, z1, { tint, m: 'concrete', uv: 2.4 });
  box('ashlar', x0 - 0.12, x1 + 0.12, h, h + 0.16, z0 - 0.12, z1 + 0.12, { tint: [0.86, 0.82, 0.72], collide: false, bevel: 0.03 });
  const L = along ? x1 - x0 : z1 - z0, step = o.pil || 6, n = Math.max(1, Math.round(L / step));
  for (let i = 0; i <= n; i++) {
    const c = (along ? x0 : z0) + (L * i) / n, pa = 0.3;
    if (along) box('ashlar', c - pa, c + pa, 0, h + 0.5, z0 - 0.1, z1 + 0.1, { tint: [0.9, 0.85, 0.75], collide: false, bevel: 0.03 }); else box('ashlar', x0 - 0.1, x1 + 0.1, 0, h + 0.5, c - pa, c + pa, { tint: [0.9, 0.85, 0.75], collide: false, bevel: 0.03 });
    M.save().move(along ? c : (x0 + x1) / 2, h + 0.5, along ? (z0 + z1) / 2 : c).color([0.88, 0.84, 0.75]).local(1); M.lathe('ashlar', [[0.3, 0], [0.34, 0.04], [0.26, 0.1], [0.16, 0.12], [0.2, 0.22], [0.2, 0.34], [0.1, 0.46], [0, 0.48]], 10, { sharp: 0.3 }); M.restore();
  }
}

/* ---------- Plans d'eau à bord de pierre ---------- */
/* Trous du sol : contours des plans d'eau creusés (rempli par pondBasin, lu par la construction du sol) */
const FLO_HOLES = [];
/* Murs invisibles qui retiennent les soldats hors de l'eau : bandes de 0,5 m couvrant l'intérieur du contour (rétréci de inset) */
function waterWalls(poly, inset = 0.1, cell = 0.5, y0 = -2, y1 = 1.4, skip) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const runs = []; // par rangée : [début, fin] en x
  for (let z = Math.floor(z0 / cell) * cell; z < z1; z += cell) {
    let a = null; const row = [];
    for (let x = Math.floor(x0 / cell) * cell; x <= x1 + cell; x += cell) {
      const inside = polyDist(poly, x + cell / 2, z + cell / 2) > inset && !(skip && skip(x + cell / 2, z + cell / 2));
      if (inside && a === null) a = x; else if (!inside && a !== null) { row.push([a, x]); a = null; }
    }
    runs.push({ z, row });
  }
  // fusion verticale des rangées identiques
  const open = new Map();
  const flush = (key, o) => { COL.push({ x0: o.x0, x1: o.x1, y0, y1, z0: o.z0, z1: o.z1, m: 'concrete', ray: false, noRay: true, inv: true }); open.delete(key); };
  for (const { z, row } of runs) {
    const keys = new Set(row.map((r) => r[0] + ':' + r[1]));
    for (const [k, o] of [...open]) if (!keys.has(k)) flush(k, o);
    for (const [a, b] of row) { const k = a + ':' + b, o = open.get(k); if (o) o.z1 = z + cell; else open.set(k, { x0: a, x1: b, z0: z, z1: z + cell }); }
  }
  for (const [k, o] of [...open]) flush(k, o);
}
/* Bassin creusé de contour poly où l'on patauge : trou dans le sol, margelle de pierre qui descend jusqu'au fond (bed), fond de gravier visible à
   travers l'eau, eau (pondAdd, wade : le fond des pieds est à bed, voir POOLS dans 02m-water.js). Pas de mur invisible : on entre dans l'eau.
   o : wl (niveau de l'eau sous le sol, m), bed (fond), tint, shallow / deep (teintes de l'eau), alpha, jet, foam, flow, depth, mat (matière de la margelle), walls (murs invisibles autour, sinon aucun) */
function pondBasin(poly, o = {}) {
  const wl = o.wl !== undefined ? o.wl : -0.12, bed = o.bed !== undefined ? o.bed : wl - 0.38, M = DECOR, mat = o.mat || 'ashlar';
  FLO_HOLES.push(poly.map((p) => p.slice()));
  // margelle : face verticale qui descend du sol au fond, sombre et moussue (vue de l'intérieur comme de l'extérieur)
  M.save().color(o.tint || [0.55, 0.58, 0.5]).world(1); M.cls = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp(dx, dz) || 1;
    M.quad(mat, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], bed, b[1]], [a[0], bed, a[1]], [dz / L, 0, -dx / L]);
    M.quad(mat, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], bed, b[1]], [a[0], bed, a[1]], [-dz / L, 0, dx / L]);
  }
  M.restore();
  // fond : gravier clair, triangulé comme le trou du sol
  const tri = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
  M.save().color(o.bedTint || [0.36, 0.34, 0.3]).world(1); M.cls = 0; M.aoFn = null;
  const B = M.buf('gravelpath', 0, 0, 0), ids = poly.map((p) => M.v(B, p[0], bed, p[1], 0, 1, 0, p[0], -p[1]));
  for (const t of tri) {
    const a = poly[t[0]], b = poly[t[1]], c = poly[t[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cr > 0) M.tri(B, ids[t[0]], ids[t[2]], ids[t[1]]); else M.tri(B, ids[t[0]], ids[t[1]], ids[t[2]]);
  }
  M.restore();
  if (o.walls) waterWalls(poly, o.inset !== undefined ? o.inset : 0.1, 0.5, -2, 1.4, o.skip);
  return pondAdd(Object.assign({ shape: 'poly', poly, y: wl, wade: bed, alpha: o.alpha !== undefined ? o.alpha : 0.9, depth: o.depth || 1.2, foam: o.foam !== undefined ? o.foam : 0.5, deep: o.deep || [0.012, 0.06, 0.056], shallow: o.shallow || [0.04, 0.13, 0.11], scatter: o.scatter || [0.014, 0.07, 0.06], cell: o.cell || 0.45 }, o.pond || {}, o.jet !== undefined ? { jet: o.jet, jc: o.jc } : {}, o.flow ? { flow: o.flow } : {}));
}

/* ---------- Semis de plantes ---------- */
/* Sème n plantes dans le rectangle rect [x0, x1, z0, z1] : les tirages que free(x, z) refuse sont ignorés (les tirages sont toujours
   consommés : la suite ne dépend pas des refus). pick(R) renvoie [prefab, échelle, hauteur] ; y : hauteur du sol */
function plantBed(R, rect, n, pick, free = () => true, y = 0) {
  for (let i = 0; i < n; i++) {
    const x = R.range(rect[0], rect[1]), z = R.range(rect[2], rect[3]), ry = R() * TAU, sc = pick(R);
    if (!free(x, z) || !plantFits(sc[0], x, z, y, sc[1] || 1)) continue;
    DECOR.place(sc[0], x, y + (sc[2] || 0), z, ry, sc[1] ? { s: sc[1] } : undefined);
  }
}

/* Une plante qui a une collision (tronc, touffe de bambou) ne se pose pas dans une collision déjà là (un autre tronc, un banc, un mur) : son
   cercle (le plus grand rayon de ses boîtes, à l'échelle s) ne touche aucune boîte pleine entre 0,1 et 1,8 m au-dessus de son pied
   (decor.js relevait les troncs qui s'entraient). Sans collision (herbes, fleurs), elle se pose où on veut. */
function plantFits(pf, x, z, y = 0, s = 1) {
  if (!pf || !pf.cols || !pf.cols.length) return true;
  let r = 0; for (const c of pf.cols) r = Math.max(r, hyp(Math.max(-c.x0, c.x1), Math.max(-c.z0, c.z1)));
  r *= s;
  return !COL.some((c) => !c.ray && !c.inv && !c.prop && c.y1 > y + 0.1 && c.y0 < y + 1.8 && c.x0 < x + r && c.x1 > x - r && c.z0 < z + r && c.z1 > z - r);
}

/* Ruban d'eau : contour d'un cours d'eau le long de la ligne pts [[x, z], ...] de largeurs w (nombre ou tableau) */
function ribbonPoly(pts, w) {
  const L = [], Rr = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = hyp(dx, dz) || 1, hw = (Array.isArray(w) ? w[i] : w) / 2;
    L.push([pts[i][0] - dz / l * hw, pts[i][1] + dx / l * hw]); Rr.push([pts[i][0] + dz / l * hw, pts[i][1] - dx / l * hw]);
  }
  return L.concat(Rr.reverse());
}
/* Lanterne de pierre japonaise (tōrō) : socle, fût, chambre à feu, chapeau, boule */
PF.toro = (s = 1) => prefab(`toro_${s}`, (M) => {
  M.save().local(1).color([0.72, 0.72, 0.68]); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 0.5, y));
  M.boxB('ashlar', -0.3 * s, 0.3 * s, 0, 0.12 * s, -0.3 * s, 0.3 * s, { bevel: 0.02 }); M.save().move(0, 0.12 * s, 0); M.cyl('ashlar', 0.1 * s, 0.7 * s, 8); M.restore();
  M.boxB('ashlar', -0.24 * s, 0.24 * s, 0.82 * s, 0.9 * s, -0.24 * s, 0.24 * s, { bevel: 0.02 });
  M.color([0.78, 0.74, 0.62]); M.boxB('ashlar', -0.16 * s, 0.16 * s, 0.9 * s, 1.18 * s, -0.16 * s, 0.16 * s, { bevel: 0.01 });
  M.color([1, 0.8, 0.5]); M.boxB('lamp', -0.1 * s, 0.1 * s, 0.95 * s, 1.12 * s, -0.165 * s, 0.165 * s); M.boxB('lamp', -0.165 * s, 0.165 * s, 0.95 * s, 1.12 * s, -0.1 * s, 0.1 * s);
  M.color([0.7, 0.7, 0.66]); M.save().move(0, 1.18 * s, 0); M.lathe('ashlar', [[0.42 * s, 0], [0.4 * s, 0.05 * s], [0.12 * s, 0.22 * s], [0.06 * s, 0.28 * s], [0.1 * s, 0.32 * s], [0, 0.4 * s]], 4, { sharp: 0.3 }); M.restore();
  M.aoFn = null; M.restore(); M.col(-0.3 * s, 0.3 * s, 0, 1.55 * s, -0.3 * s, 0.3 * s, 'concrete');
});

/* Un point de pelouse est-il libre (ni allée, ni dalles, ni plan d'eau, ni boîte de collision) ? Sert au semis d'herbes et de fleurs */
function lawnFree(sp, x, z, holes) {
  if (sp.at(0, x, z) > 0.12 || sp.at(1, x, z) > 0.12) return false;
  for (const h of holes) if (polyDist(h, x, z) > -0.6) return false;
  for (const c of COL) if (!c.inv && !c.noRay && c.y1 > 0.2 && x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3 && c.y0 < 1.2) return false;
  return true;
}
/* Touffes d'herbe, fleurs des prés et trèfles semés sur la pelouse libre de la zone rect [x0, x1, z0, z1] (n tirages) ; cls 3 : masquées au loin */
function lawnTufts(R, sp, rect, n, holes, skip = () => false) {
  const pick = (RR) => {
    const k = RR(), s = 1 + Math.floor(RR() * 4);
    if (k < 0.5) return [PF.clump('grass', 'leafB', 0.8, 0.7, 3, s, { cls: 3 }), RR.range(0.8, 1.5)];
    if (k < 0.72) return [PF.clump('meadow', 'leafB', 1.2, 0.6, 3, s, { cls: 3 }), RR.range(0.8, 1.4)];
    if (k < 0.86) return [PF.clump('clover', 'leafB', 0.8, 0.5, 3, s, { cls: 3 }), RR.range(0.8, 1.3)];
    return [PF.clump('grassT', 'leafB', 0.8, 1.0, 3, s, { cls: 3 }), RR.range(0.8, 1.3)];
  };
  plantBed(R, rect, n, pick, (x, z) => lawnFree(sp, x, z, holes) && !skip(x, z));
}
