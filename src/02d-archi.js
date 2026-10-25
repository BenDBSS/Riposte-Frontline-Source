/* ==========================================================================
   KIT D'ARCHITECTURE : bâtiments méditerranéens et maghrébins, réutilisables sur toutes les cartes.
   Une façade est construite dans son propre repère (facadeFrame) : origine au pied du mur, à gauche vu de
   l'extérieur ; x le long du mur, y vers le haut, z vers l'extérieur. Les ouvertures sont de vrais trous dans
   le mur, avec leurs embrasures (profondeur), puis la menuiserie au fond : vitrage et châssis, volets
   persiennés, grilles, portes à panneaux ou cintrées, rideaux métalliques de boutique. Les collisions des
   bâtiments restent des boîtes pleines : le gameplay ne dépend pas du décor.
   ========================================================================== */
const PAL = {
  plaster: [[0.95, 0.88, 0.74], [0.9, 0.76, 0.58], [0.97, 0.93, 0.85], [0.84, 0.7, 0.55], [0.86, 0.66, 0.54], [0.78, 0.82, 0.76], [0.76, 0.8, 0.86], [0.92, 0.82, 0.66], [0.93, 0.8, 0.7]],
  shutter: [[0.3, 0.45, 0.38], [0.28, 0.38, 0.52], [0.55, 0.36, 0.22], [0.42, 0.42, 0.38], [0.2, 0.42, 0.55], [0.62, 0.55, 0.4]],
  frame: [[0.92, 0.9, 0.84], [0.35, 0.26, 0.18], [0.28, 0.4, 0.34], [0.86, 0.84, 0.78], [0.45, 0.4, 0.34]],
  door: [[0.12, 0.3, 0.55], [0.18, 0.4, 0.3], [0.42, 0.26, 0.16], [0.55, 0.18, 0.12], [0.16, 0.42, 0.46], [0.75, 0.6, 0.3]],
  awning: [[0.72, 0.24, 0.18], [0.2, 0.42, 0.34], [0.82, 0.7, 0.4], [0.3, 0.36, 0.55], [0.85, 0.85, 0.8], [0.62, 0.3, 0.12]],
  shop: [[0.62, 0.62, 0.6], [0.5, 0.55, 0.5], [0.62, 0.5, 0.42], [0.35, 0.45, 0.55], [0.7, 0.66, 0.55]],
  stone: [0.95, 0.9, 0.82],
};
/* Repère d'une façade tournée vers face ('n', 's', 'e', 'w') d'un bloc [x0, x1] x [z0, z1] */
function facadeFrame(face, x0, x1, z0, z1) {
  if (face === 's') return { ox: x0, oz: z1, rot: 0, len: x1 - x0 };
  if (face === 'n') return { ox: x1, oz: z0, rot: Math.PI, len: x1 - x0 };
  if (face === 'e') return { ox: x1, oz: z1, rot: Math.PI / 2, len: z1 - z0 };
  return { ox: x0, oz: z0, rot: -Math.PI / 2, len: z1 - z0 };
}
function inFrame(F, fn) { const M = DECOR; M.save().move(F.ox, 0, F.oz).rotY(F.rot); try { fn(M); } finally { M.restore(); } }
/* Petite boîte locale par bornes, sans collision */
function lbox(M, mat, x0, x1, y0, y1, z0, z1, o) { M.boxB(mat, x0, x1, y0, y1, z0, z1, o); }

/* ---------- Mur percé et embrasures ---------- */
/* Découpage des arcs, commun aux écoinçons, à l'intrados et au vantail cintré : des segments différents laissaient
   entre eux de minces jours, par lesquels on voyait le vide derrière la façade. Doit être pair (clé au milieu). */
const ARCH_SEG = 20;
/* Arc d'une ouverture cintrée : cercle passant par les naissances (y1 - rise) et la clé (y1) */
function archGeom(op) {
  const w = op.x1 - op.x0, rise = Math.min(op.rise, w / 2), ys = op.y1 - rise, xc = (op.x0 + op.x1) / 2;
  const R = (w * w / 4 + rise * rise) / (2 * rise), cy = op.y1 - R, a0 = Math.asin(clamp((ys - cy) / R, -1, 1));
  return { R, xc, cy, ys, a0, a1: Math.PI - a0 };
}
/* Mur plan (z = 0, face +z) de x = 0 à len, y de y0 à y0 + h, percé des ouvertures ops (repère de façade).
   o.depth : profondeur des embrasures (épaisseur pour un mur traversant) ; o.back : embrasure fermée au fond ;
   o.round : rayon des angles du bloc aux deux bouts (wallRound) */
function wallPierced(M, mat, len, y0, h, ops, o = {}) {
  M.save().move(0, y0, 0);
  const holes = ops.map((p) => ({ x0: p.x0, x1: p.x1, y0: p.y0 - y0, y1: p.y1 - y0 }));
  if (o.aoFn !== undefined) M.aoFn = o.aoFn;
  M.wall(mat, len, h, holes, { aoBottom: o.aoBottom, trim: o.round });
  if (o.round) wallRound(M, mat, len, h, holes, o.round, o.aoBottom);
  M.restore();
  for (const op of ops) {
    const d = op.depth !== undefined ? op.depth : (o.depth || 0.2);
    if (op.rise) archFill(M, mat, op, d);
    // une porte au pied du mur n'a pas d'appui : il se confondait avec le sol ou le plancher (scintillement)
    reveal(M, mat, op, d, o.floorY !== undefined ? o : { ...o, floorY: y0 });
  }
}
/* Angles arrondis d'un bloc : le mur d'une façade (repère de wallPierced, longueur len, hauteur h) s'arrête à r de chaque bout
   (M.wall, trim) et la façade pose à ses deux bouts un huitième de cylindre de rayon r, tangent au mur ; avec celui de la façade
   voisine, l'angle devient un quart de rond. Ses normales tournent d'une façade à l'autre : l'angle accroche la lumière sur
   quelques centimètres au lieu d'une arête vive, la teinte s'y éclaircit un peu (enduit usé, moins de crasse sur l'arête).
   Mêmes rangées que le mur (bords des ouvertures) : l'occlusion des sommets se raccorde. */
function wallRound(M, mat, len, h, holes, r, aoBottom, seg = 3) {
  const B = M.buf(mat, len / 2, h / 2, 0), t0 = M.tint;
  const ys = [...new Set([0, h, ...holes.flatMap((q) => [clamp(q.y0, 0, h), clamp(q.y1, 0, h)])].map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  const ao = aoBottom ? (y) => lerp(aoBottom, 1, smoothstep(0, 0.8, y)) : () => 1;
  // du point tangent au mur (90°) vers la diagonale de l'angle (135° au début, 45° à la fin) ; centre à r dans le bloc
  for (const [cx, a0, a1] of [[r, Math.PI / 2, Math.PI * 0.75], [len - r, Math.PI / 2, Math.PI * 0.25]]) {
    const col = [];
    for (let i = 0; i <= seg; i++) {
      const a = lerp(a0, a1, i / seg), c = Math.cos(a), s = Math.sin(a), k = 1 + 0.06 * (i / seg);
      M.tint = [t0[0] * k, t0[1] * k, t0[2] * k];
      col.push({ a, ids: ys.map((y) => M.v(B, cx + c * r, y, -r + s * r, c, 0, s, 0, y, ao(y))) });
    }
    M.tint = t0;
    // faces vers l'extérieur : de l'angle le plus grand au plus petit (de gauche à droite vu de dehors)
    for (let i = 0; i < seg; i++) {
      const [L, R] = col[i].a > col[i + 1].a ? [col[i], col[i + 1]] : [col[i + 1], col[i]];
      for (let j = 0; j < ys.length - 1; j++) if (ys[j + 1] - ys[j] > 1e-4) M.quadI(B, L.ids[j], R.ids[j], R.ids[j + 1], L.ids[j + 1]);
    }
  }
}
/* Écoinçons d'une ouverture cintrée (entre l'arc et le rectangle) et intrados de l'arc */
function archFill(M, mat, op, d) {
  const A = archGeom(op), n = ARCH_SEG / 2, B = M.buf(mat, A.xc, op.y1, 0);
  for (const [side, cx] of [[-1, op.x0], [1, op.x1]]) {
    const c = M.v(B, cx, op.y1, 0, 0, 0, 1, cx, op.y1);
    let prev = -1;
    for (let i = 0; i <= n; i++) {
      const a = side < 0 ? lerp(A.a1, Math.PI / 2, i / n) : lerp(A.a0, Math.PI / 2, i / n);
      const x = A.xc + Math.cos(a) * A.R, y = A.cy + Math.sin(a) * A.R, id = M.v(B, x, y, 0, 0, 0, 1, x, y);
      if (prev >= 0) { if (side < 0) M.tri(B, c, prev, id); else M.tri(B, c, id, prev); }
      prev = id;
    }
  }
  // intrados : bande le long de l'arc, de la façade au fond de l'embrasure
  const B2 = M.buf(mat, A.xc, op.y1, -d / 2), m = ARCH_SEG; // mêmes angles que les écoinçons : arête commune, sans jour
  let p0 = -1, p1 = -1;
  for (let i = 0; i <= m; i++) {
    const a = lerp(A.a0, A.a1, i / m), c = Math.cos(a), s = Math.sin(a), x = A.xc + c * A.R, y = A.cy + s * A.R;
    const q0 = M.v(B2, x, y, 0, -c, -s, 0, a * A.R, 0, 1), q1 = M.v(B2, x, y, -d, -c, -s, 0, a * A.R, d, 0.7);
    // face visible vers le centre de l'arc (vers le bas à la clé) : dans l'autre sens, l'intrados était éliminé vu d'en
    // dessous et l'on voyait le ciel par-dessus la porte
    if (p0 >= 0) M.quadI(B2, p0, q0, q1, p1);
    p0 = q0; p1 = q1;
  }
}
/* Embrasure : joues, linteau (sauf ouverture cintrée) et appui intérieur, de z = 0 à z = -d */
function reveal(M, mat, op, d, o = {}) {
  const top = op.rise ? archGeom(op).ys : op.y1, ao = [1, 1, 0.72, 0.72];
  M.quad(mat, [op.x0, op.y0, 0], [op.x0, top, 0], [op.x0, top, -d], [op.x0, op.y0, -d], [1, 0, 0], { ao });
  M.quad(mat, [op.x1, op.y0, 0], [op.x1, top, 0], [op.x1, top, -d], [op.x1, op.y0, -d], [-1, 0, 0], { ao });
  if (!op.rise) M.quad(mat, [op.x0, op.y1, 0], [op.x1, op.y1, 0], [op.x1, op.y1, -d], [op.x0, op.y1, -d], [0, -1, 0], { ao: [0.9, 0.9, 0.65, 0.65] });
  if (op.y0 > (o.floorY !== undefined ? o.floorY : -1) + 0.01) M.quad(mat, [op.x0, op.y0, 0], [op.x1, op.y0, 0], [op.x1, op.y0, -d], [op.x0, op.y0, -d], [0, 1, 0], { ao });
  // fond sombre : les bâtiments sont creux (en bordure de carte, seule la façade côté jeu existe) ; sans lui, une fenêtre
  // sans vitrage (cintrée aux volets clos, grillagée) laissait voir à travers le bâtiment jusqu'au vide hors de la carte
  if (o.back || op.back) M.quad('dark', [op.x0, op.y0, -d], [op.x1, op.y0, -d], [op.x1, op.y1, -d], [op.x0, op.y1, -d], [0, 0, 1]);
}

/* ---------- Menuiseries ---------- */
/* Fenêtre au fond d'une embrasure de profondeur d : châssis, meneau, traverse, vitrage (o.glass : matière du vitrage,
   glassLit pour une pièce éclairée) */
function windowJoinery(M, op, d, tint, o = {}) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0, t = 0.065, z0 = -d + 0.02, z1 = z0 + 0.07;
  M.save().color(tint).local(1); M.cls = 1; // au fond de l'embrasure, l'ombre du tableau suffit
  lbox(M, 'paintwood', op.x0, op.x0 + t, op.y0, op.y1, z0, z1); lbox(M, 'paintwood', op.x1 - t, op.x1, op.y0, op.y1, z0, z1);
  lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y1 - t, op.y1, z0, z1); lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y0, op.y0 + t, z0, z1);
  if (w > 0.75) lbox(M, 'paintwood', (op.x0 + op.x1) / 2 - 0.03, (op.x0 + op.x1) / 2 + 0.03, op.y0 + t, op.y1 - t, z0 + 0.005, z1 - 0.005);
  if (h > 1.3 && !o.door) lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y1 - h * 0.28 - 0.025, op.y1 - h * 0.28 + 0.025, z0 + 0.005, z1 - 0.005);
  M.restore();
  M.save().color(o.glassTint || [1, 1, 1]); M.cls = 1;
  const gp = [[op.x0 + t, op.y0 + t, z0 + 0.035], [op.x1 - t, op.y0 + t, z0 + 0.035], [op.x1 - t, op.y1 - t, z0 + 0.035], [op.x0 + t, op.y1 - t, z0 + 0.035]];
  if (!o.glass || o.glass === 'glass' || o.glass === 'glassLit') {
    // vitre d'une pièce (matière window, 02c-materials.js) : la pièce se dessine derrière. Les sommets portent ses données au lieu d'une
    // teinte : graine (tirée de la position de la fenêtre dans le monde), lampe allumée, rapport hauteur sur largeur et porte-fenêtre
    const e = M.m.elements, cx = (op.x0 + op.x1) / 2, cy = (op.y0 + op.y1) / 2, gw = op.x1 - op.x0 - 2 * t, gh = op.y1 - op.y0 - 2 * t;
    const wx = e[0] * cx + e[4] * cy + e[12], wy = e[1] * cx + e[5] * cy + e[13], wz = e[2] * cx + e[6] * cy + e[14];
    const fr = (v) => v - Math.floor(v), seed = fr(Math.sin(wx * 12.9898 + wz * 78.233 + wy * 3.17) * 43758.5453);
    const lit = o.glass === 'glassLit' || (o.glass !== 'glass' && fr(seed * 7.13) < ((CURMAP.def && CURMAP.def.atmo.winLit) || 0)) ? 1 : 0;
    M.tint = [seed, lit, Math.min(gh / Math.max(gw, 0.1), 3.9) / 8 + (o.door ? 0.5 : 0)];
    M.quad('window', ...gp, [0, 0, 1], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
  } else M.quad(o.glass, ...gp, [0, 0, 1]);
  // rideau intérieur, parfois
  if (o.curtain) { M.color(o.curtain); M.quad('canvas', [op.x0 + t, op.y0 + h * 0.35, z0 - 0.05], [op.x1 - t, op.y0 + h * 0.35, z0 - 0.05], [op.x1 - t, op.y1 - t, z0 - 0.05], [op.x0 + t, op.y1 - t, z0 - 0.05], [0, 0, 1]); }
  M.restore();
}
/* Moucharabieh : oriel en bois ajouré posé devant une fenêtre d'étage (treillis sur trois côtés, auvent, console) */
function mashrabiya(M, op, tint) {
  const w = op.x1 - op.x0 + 0.5, x0 = (op.x0 + op.x1) / 2 - w / 2, x1 = x0 + w, y0 = op.y0 - 0.25, y1 = op.y1 + 0.2, dp = 0.55;
  M.save().color([0.05, 0.05, 0.05]); M.quad('dark', [op.x0, op.y0, -0.2], [op.x1, op.y0, -0.2], [op.x1, op.y1, -0.2], [op.x0, op.y1, -0.2], [0, 0, 1]); M.restore();
  M.save().color([0.45, 0.3, 0.2]).local(1);
  M.boxB('wood', x0 - 0.05, x1 + 0.05, y0 - 0.1, y0, 0, dp + 0.05, { bevel: 0.015 });
  M.boxB('wood', x0 - 0.08, x1 + 0.08, y1, y1 + 0.08, 0, dp + 0.12, { bevel: 0.015 });
  for (const x of [x0, x1]) for (const z of [dp]) M.boxB('wood', x - 0.03, x + 0.03, y0, y1, z - 0.03, z + 0.03);
  for (const x of [x0, x1]) M.boxB('wood', x - 0.03, x + 0.03, y0, y1, 0, 0.05);
  M.boxB('wood', x0, x1, y0 + (y1 - y0) * 0.35, y0 + (y1 - y0) * 0.35 + 0.05, dp - 0.03, dp + 0.03);
  M.color([1, 1, 1]); M.cls = 1; M.uvS = 1;
  const B = M.buf('lattice', (x0 + x1) / 2, (y0 + y1) / 2, dp);
  const face = (p0, p1, p2, p3, n, uw, uh) => { const ids = [[p0, 0, 0], [p1, uw, 0], [p2, uw, uh], [p3, 0, uh]].map(([p, u, v]) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], u, v)); M.quadI(B, ids[0], ids[1], ids[2], ids[3]); M.quadI(B, ids[0], ids[3], ids[2], ids[1]); };
  face([x0, y0, dp], [x1, y0, dp], [x1, y1, dp], [x0, y1, dp], [0, 0, 1], w, y1 - y0);
  face([x0, y0, 0.03], [x0, y0, dp], [x0, y1, dp], [x0, y1, 0.03], [-1, 0, 0], dp, y1 - y0);
  face([x1, y0, dp], [x1, y0, 0.03], [x1, y1, 0.03], [x1, y1, dp], [1, 0, 0], dp, y1 - y0);
  M.cls = 0; M.color([0.4, 0.28, 0.18]);
  const cons = [[0, 0], [0.4, 0], [0.4, -0.08], [0.1, -0.4], [0, -0.45]];
  for (const x of [x0 + 0.1, x1 - 0.1]) { M.save().move(x + 0.05, y0 - 0.1, 0).rotY(-Math.PI / 2); M.extrude('wood', cons, 0.1); M.restore(); }
  M.restore();
  M.occ(x0, x1, y0, y1, 0, dp, 0.5);
}
/* Fenêtre condamnée : planches clouées en travers, pièce sombre derrière */
function boardedWindow(M, op, d, R) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0;
  M.save().color([0.05, 0.05, 0.05]); M.quad('dark', [op.x0, op.y0, -d + 0.02], [op.x1, op.y0, -d + 0.02], [op.x1, op.y1, -d + 0.02], [op.x0, op.y1, -d + 0.02], [0, 0, 1]); M.restore();
  M.save().local(1);
  const n = 3 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const y = op.y0 + ((i + 0.5) / n) * h + (R() - 0.5) * 0.08, ang = (R() - 0.5) * 0.35;
    M.color([0.75 + R() * 0.2, 0.62 + R() * 0.15, 0.48]);
    M.save().move((op.x0 + op.x1) / 2, y, 0.025).rotZ(ang); M.box('crate', w + 0.3, 0.16, 0.025, { bevel: 0.004 }); M.restore();
  }
  M.restore();
}
/* Fenêtre brisée : châssis, éclats de verre dans les angles, pièce sombre */
function brokenWindow(M, op, d, tint, R) {
  const z = -d + 0.055, t = 0.065;
  M.save().color([0.05, 0.05, 0.05]); M.quad('dark', [op.x0, op.y0, -d + 0.005], [op.x1, op.y0, -d + 0.005], [op.x1, op.y1, -d + 0.005], [op.x0, op.y1, -d + 0.005], [0, 0, 1]); M.restore();
  M.save().color(tint).local(1); M.cls = 1;
  lbox(M, 'paintwood', op.x0, op.x0 + t, op.y0, op.y1, -d + 0.02, -d + 0.09); lbox(M, 'paintwood', op.x1 - t, op.x1, op.y0, op.y1, -d + 0.02, -d + 0.09);
  lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y1 - t, op.y1, -d + 0.02, -d + 0.09); lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y0, op.y0 + t, -d + 0.02, -d + 0.09);
  M.color([1, 1, 1]);
  for (const [cx, cy, sx, sy] of [[op.x0 + t, op.y0 + t, 1, 1], [op.x1 - t, op.y1 - t, -1, -1], [op.x1 - t, op.y0 + t, -1, 1]]) {
    const a = 0.15 + R() * 0.25, b = 0.2 + R() * 0.35;
    M.tri3('glass', [cx, cy, z], [cx + sx * a, cy, z], [cx, cy + sy * b, z], [0, 0, 1]);
  }
  M.restore();
}
/* Appui de fenêtre saillant (pierre ou béton), légèrement plus large que l'ouverture */
function sill(M, op, mat = 'concrete', tint = PAL.stone) {
  M.save().color(tint).local(1);
  M.boxB(mat, op.x0 - 0.09, op.x1 + 0.09, op.y0 - 0.06, op.y0 + 0.005, -0.04, 0.09, { bevel: 0.012 });
  M.restore();
}
function lintel(M, op, mat = 'ashlar', tint = PAL.stone) {
  M.save().color(tint).world(1);
  M.boxB(mat, op.x0 - 0.12, op.x1 + 0.12, op.y1, op.y1 + 0.2, -0.01, 0.025, { bevel: 0.01 });
  M.restore();
}
/* Volets persiennés. state : 'open' (rabattus contre le mur), 'ajar' (entrouverts), 'closed' */
function shutters(M, op, tint, state, rngF) {
  const w = op.x1 - op.x0, lw = w / 2 + 0.015, h = op.y1 - op.y0, t = 0.035;
  M.save().color(tint).local(1);
  M.uvS = 1.3 / TEXSCALE.shutter;
  if (state === 'closed') {
    for (const [x, s] of [[op.x0, 1], [op.x1, -1]]) { M.save().move(x + (s * lw) / 2, op.y0, s < 0 ? -0.055 : -0.06); M.box('shutter', lw - 0.01, h, t); M.restore(); } // le vantail droit recouvre le gauche de 2 cm, 5 mm devant (pas dans son plan)
  } else {
    for (const [x, s] of [[op.x0, -1], [op.x1, 1]]) {
      const ang = state === 'open' ? rngF() * 0.12 : 0.6 + rngF() * 0.9;
      M.save().move(x + s * 0.01, op.y0, 0.02).rotY(s < 0 ? ang : -ang).move((s * lw) / 2, 0, t / 2); M.box('shutter', lw, h, t); M.restore();
      // gonds
      M.save().color([0.2, 0.2, 0.2]); M.cls = 2;
      for (const yy of [0.2, h - 0.25]) lbox(M, 'steel', x + s * 0.01 - 0.02, x + s * 0.01 + 0.02, op.y0 + yy, op.y0 + yy + 0.05, 0, 0.04);
      M.restore();
    }
  }
  M.restore();
}
/* Grille de défense en fer (fenêtres du rez-de-chaussée) */
function grille(M, op) {
  const w = op.x1 - op.x0, n = Math.max(3, Math.round(w / 0.12)), z = 0.03;
  M.save().color([0.16, 0.15, 0.14]); M.cls = 1;
  for (let i = 1; i < n; i++) { const x = op.x0 + (w * i) / n; M.save().move(x, op.y0 - 0.02, z); M.cyl('steel', 0.009, op.y1 - op.y0 + 0.04, 5, { caps: '' }); M.restore(); }
  for (const y of [op.y0 + 0.12, op.y1 - 0.12, (op.y0 + op.y1) / 2]) lbox(M, 'steel', op.x0 - 0.03, op.x1 + 0.03, y - 0.015, y + 0.015, z - 0.01, z + 0.01);
  M.restore();
}
/* Porte à panneaux (bois peint) au fond de l'embrasure, avec chambranle, poignée et seuil */
function panelDoor(M, op, d, tint, o = {}) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0, z0 = -d + 0.02, cols = w > 1.3 ? 2 : 1, dbl = w > 1.3;
  M.save().color(tint).local(1);
  if (op.rise) {
    // porte cintrée : vantail découpé selon l'arc
    // (contour élargi de 3 cm : il passe derrière l'intrados et les tableaux, aucun jour entre la porte et l'arc)
    const A = archGeom(op), sh = [[op.x0 - 0.03, op.y0], [op.x1 + 0.03, op.y0]], r = A.R + 0.03;
    for (let i = 0; i <= ARCH_SEG; i++) { const a = lerp(A.a0, A.a1, i / ARCH_SEG); sh.push([A.xc + Math.cos(a) * r, A.cy + Math.sin(a) * r]); }
    M.save().move(0, 0, z0); M.extrude('paintwood', sh, 0.05); M.restore();
    // clous décoratifs
    M.save().color([0.15, 0.14, 0.13]); M.cls = 2;
    for (let yy = op.y0 + 0.3; yy < A.ys - 0.1; yy += 0.36) for (let xx = op.x0 + 0.15; xx < op.x1 - 0.1; xx += 0.2) lbox(M, 'steel', xx - 0.012, xx + 0.012, yy - 0.012, yy + 0.012, z0 + 0.05, z0 + 0.065);
    M.restore();
  } else {
    if (o.open) {
      // entrée : pièce sombre derrière, vantail tourné vers l'intérieur autour de ses gonds
      const D = 1.4;
      M.save().color([0.62, 0.56, 0.48]).world(1); M.ao = 0.45;
      M.quad('plaster', [op.x0 - 0.4, op.y0, z0 - D], [op.x1 + 0.4, op.y0, z0 - D], [op.x1 + 0.4, op.y1 + 0.3, z0 - D], [op.x0 - 0.4, op.y1 + 0.3, z0 - D], [0, 0, 1]);
      M.quad('plaster', [op.x0, op.y0, z0], [op.x0, op.y1, z0], [op.x0 - 0.4, op.y1 + 0.3, z0 - D], [op.x0 - 0.4, op.y0, z0 - D], [1, 0, 0]);
      M.quad('plaster', [op.x1, op.y0, z0], [op.x1 + 0.4, op.y0, z0 - D], [op.x1 + 0.4, op.y1 + 0.3, z0 - D], [op.x1, op.y1, z0], [-1, 0, 0]);
      M.quad('plaster', [op.x0, op.y1, z0], [op.x1, op.y1, z0], [op.x1 + 0.4, op.y1 + 0.3, z0 - D], [op.x0 - 0.4, op.y1 + 0.3, z0 - D], [0, -1, 0]);
      M.color([0.7, 0.66, 0.6]); M.quad('tiles', [op.x0, op.y0 + 0.005, z0], [op.x1, op.y0 + 0.005, z0], [op.x1 + 0.4, op.y0 + 0.005, z0 - D], [op.x0 - 0.4, op.y0 + 0.005, z0 - D], [0, 1, 0]);
      M.restore();
      M.save().color(tint).local(1).move(op.x0 + 0.02, 0, z0).rotY(1.0); // ouvert vers l'intérieur
      lbox(M, 'paintwood', 0, w * (dbl ? 0.5 : 1) - 0.02, op.y0, op.y1, -0.05, 0);
      M.restore();
      M.restore();
      return;
    }
    lbox(M, 'paintwood', op.x0, op.x1, op.y0, op.y1, z0, z0 + 0.05);
    const rows = h > 2 ? 3 : 2, pw = (w - 0.12 * (cols + 1)) / cols, ph = (h - 0.14 * (rows + 1)) / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = op.x0 + 0.12 + c * (pw + 0.12), y = op.y0 + 0.14 + r * (ph + 0.14);
      if (o.glazed && r === rows - 1) { M.save(); M.cls = 1; M.quad('glass', [x, y, z0 + 0.052], [x + pw, y, z0 + 0.052], [x + pw, y + ph, z0 + 0.052], [x, y + ph, z0 + 0.052], [0, 0, 1]); M.restore(); continue; }
      M.boxB('paintwood', x, x + pw, y, y + ph, z0 + 0.05, z0 + 0.068, { bevel: 0.012 });
    }
    if (dbl) lbox(M, 'paintwood', (op.x0 + op.x1) / 2 - 0.012, (op.x0 + op.x1) / 2 + 0.012, op.y0, op.y1, z0 + 0.05, z0 + 0.06);
  }
  M.restore();
  // poignée, heurtoir
  M.save().color([0.55, 0.45, 0.25]); M.cls = 2;
  const hx = dbl ? (op.x0 + op.x1) / 2 + 0.1 : op.x1 - 0.12;
  lbox(M, 'steel', hx - 0.015, hx + 0.015, op.y0 + 1.0, op.y0 + 1.12, z0 + 0.05, z0 + 0.1);
  M.restore();
  // seuil en pierre
  M.save().color(PAL.stone).local(1);
  M.boxB('ashlar', op.x0 - 0.06, op.x1 + 0.06, op.y0 - 0.02, op.y0 + 0.05, z0, 0.14, { bevel: 0.015 });
  M.restore();
}
/* Chambranle saillant autour d'une ouverture rectangulaire (ou bandeau de pierre autour d'un arc) */
function casing(M, op, tint, mat = 'ashlar', wd = 0.14) {
  M.save().color(tint).world(1);
  if (op.rise) {
    const A = archGeom(op), n = 14, B = M.buf(mat, A.xc, op.y1, 0.03);
    let p = null;
    for (let i = 0; i <= n; i++) {
      const a = lerp(A.a0, A.a1, i / n), c = Math.cos(a), s = Math.sin(a);
      const ids = [M.v(B, A.xc + c * A.R, A.cy + s * A.R, 0.03, 0, 0, 1, 0, 0), M.v(B, A.xc + c * (A.R + wd), A.cy + s * (A.R + wd), 0.03, 0, 0, 1, 0, 0),
        M.v(B, A.xc + c * (A.R + wd), A.cy + s * (A.R + wd), 0.03, c, s, 0, 0, 0), M.v(B, A.xc + c * (A.R + wd), A.cy + s * (A.R + wd), 0, c, s, 0, 0, 0)];
      if (p) { M.quadI(B, p[0], p[1], ids[1], ids[0]); M.quadI(B, p[3], p[2], ids[2], ids[3]); }
      p = ids;
    }
    lbox(M, mat, op.x0 - wd, op.x0, op.y0, A.ys, 0, 0.03); lbox(M, mat, op.x1, op.x1 + wd, op.y0, A.ys, 0, 0.03);
  } else {
    lbox(M, mat, op.x0 - wd, op.x0, op.y0, op.y1 + wd, 0, 0.03); lbox(M, mat, op.x1, op.x1 + wd, op.y0, op.y1 + wd, 0, 0.03);
    lbox(M, mat, op.x0, op.x1, op.y1, op.y1 + wd, 0, 0.03);
  }
  M.restore();
}
/* Rideau métallique de boutique : lames, coffre, coulisses ; open = part relevée (0 à 1), boutique sombre derrière */
function rollShutter(M, op, d, tint, open) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0, bottom = op.y0 + h * open;
  M.save().color(tint).local(1); M.uvS = 1.5 / TEXSCALE.rollshutter;
  if (bottom < op.y1 - 0.05) M.boxB('rollshutter', op.x0 + 0.02, op.x1 - 0.02, bottom, op.y1, -0.1, -0.07);
  M.restore();
  // coffre et coulisses
  M.save().color([0.55, 0.55, 0.52]).local(1);
  M.boxB('steel', op.x0 - 0.06, op.x1 + 0.06, op.y1, op.y1 + 0.32, -0.02, 0.26, { bevel: 0.02 });
  lbox(M, 'steel', op.x0, op.x0 + 0.05, op.y0, op.y1, -0.12, -0.04); lbox(M, 'steel', op.x1 - 0.05, op.x1, op.y0, op.y1, -0.12, -0.04);
  M.restore();
  if (open > 0.05) {
    // boutique : pièce sombre peu profonde, étagères devinées
    const D = 1.6;
    M.save().color([0.72, 0.66, 0.58]).world(1); M.ao = 0.55;
    M.quad('plaster', [op.x0, op.y0, -D], [op.x1, op.y0, -D], [op.x1, op.y1, -D], [op.x0, op.y1, -D], [0, 0, 1]);
    M.quad('plaster', [op.x0, op.y0, -0.1], [op.x0, op.y1, -0.1], [op.x0, op.y1, -D], [op.x0, op.y0, -D], [1, 0, 0]);
    M.quad('plaster', [op.x1, op.y0, -0.1], [op.x1, op.y1, -0.1], [op.x1, op.y1, -D], [op.x1, op.y0, -D], [-1, 0, 0]);
    M.quad('plaster', [op.x0, op.y1, -0.1], [op.x1, op.y1, -0.1], [op.x1, op.y1, -D], [op.x0, op.y1, -D], [0, -1, 0]);
    M.color([0.6, 0.55, 0.5]); M.quad('tiles', [op.x0, op.y0 + 0.01, -0.1], [op.x1, op.y0 + 0.01, -0.1], [op.x1, op.y0 + 0.01, -D], [op.x0, op.y0 + 0.01, -D], [0, 1, 0]);
    M.color([0.5, 0.4, 0.3]); M.local(1);
    const R = rngOf(Math.round(op.x0 * 100 + op.y1 * 7));
    for (const y of [0.9, 1.5, 2.1]) if (op.y0 + y < op.y1 - 0.1) {
      M.color([0.5, 0.4, 0.3]); lbox(M, 'crate', op.x0 + 0.1, op.x1 - 0.1, op.y0 + y, op.y0 + y + 0.04, -D + 0.02, -D + 0.4);
      // marchandises sur l'étagère : boîtes, bocaux, paquets de couleurs
      M.cls = 2;
      for (let x = op.x0 + 0.18; x < op.x1 - 0.25; x += 0.14 + R() * 0.18) {
        const h = 0.12 + R() * 0.22, w = 0.08 + R() * 0.1;
        M.color(R.pick([[0.8, 0.2, 0.15], [0.9, 0.8, 0.3], [0.2, 0.4, 0.7], [0.9, 0.9, 0.85], [0.3, 0.6, 0.3], [0.6, 0.4, 0.2]]));
        lbox(M, R() < 0.6 ? 'cardboard' : 'plastic', x, x + w, op.y0 + y + 0.04, op.y0 + y + 0.04 + h, -D + 0.08, -D + 0.3);
      }
      M.cls = 0;
    }
    M.restore();
  }
}
/* Store banne rayé, incliné, avec lambrequin et bras en acier (repère de façade). Chaque bande est une toile simulée (Maker.toile) tenue au
   mur, à la barre de charge et à ses voisines : son milieu respire ; le lambrequin festonné pend de la barre et bat au vent */
function awningStriped(M, xc, y, w, depth, colors) {
  const n = Math.max(4, Math.round(w / 0.3)), drop = depth * 0.42, sag = 0.05;
  M.save();
  for (let i = 0; i < n; i++) {
    const xa = xc - w / 2 + (w * i) / n, xb = xa + w / n;
    M.color(colors[i % colors.length]);
    M.toile(1, 4, (u, t) => [lerp(xa, xb, u), y - t * drop - Math.sin(t * Math.PI) * sag, t * depth], { uL: xb - xa, vL: depth, play: 0.05, glow: 0.3, side: [0, 0.92, 0.38] });
    // lambrequin festonné : tenu à la barre, la pointe libre
    const yv = y - drop;
    M.toile(1, 2, (u, t) => [lerp(xa, xb, u), yv - t * (0.16 + 0.06 * Math.sin(u * Math.PI)), depth + 0.004], { uL: xb - xa, vL: 0.22, play: 0.16, glow: 0.3, side: [0, 0, 1], pin: (u, t) => t <= 0 });
  }
  M.color([0.25, 0.25, 0.24]); M.cls = 1;
  M.save().move(xc - w / 2, y + 0.02, 0.02); M.cyl('steel', 0.02, 0.02, 6); M.restore();
  lbox(M, 'steel', xc - w / 2, xc + w / 2, y - 0.03, y + 0.03, 0, 0.05);
  for (const x of [xc - w / 2 + 0.1, xc + w / 2 - 0.1]) M.tube('steel', 0.014, [[x, y - 0.6, 0.01], [x, y - drop * 0.6, depth * 0.6]], 5);
  M.restore();
  M.occ(xc - w / 2, xc + w / 2, y - drop, y, 0, depth, 0.6);
}
/* Enseigne peinte (atlas des enseignes), posée à plat sur la façade */
function signBoard(M, xc, y, w, h, idx) {
  const [u0, v0, du, dv] = signUV(idx), B = M.buf('signs', xc, y, 0.05), z = 0.06;
  M.save().color([1, 1, 1]);
  const a = M.v(B, xc - w / 2, y, z, 0, 0, 1, u0, v0 + dv), b = M.v(B, xc + w / 2, y, z, 0, 0, 1, u0 + du, v0 + dv);
  const c = M.v(B, xc + w / 2, y + h, z, 0, 0, 1, u0 + du, v0), d = M.v(B, xc - w / 2, y + h, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d);
  M.color([0.35, 0.3, 0.25]).local(1); lbox(M, 'paintwood', xc - w / 2 - 0.03, xc + w / 2 + 0.03, y - 0.03, y + h + 0.03, 0, z - 0.002);
  M.restore();
}
/* Balcon : dalle sur consoles, garde-corps en fer (repère de façade) */
function balcony(M, xc, y, w, dp, rngF) {
  M.save().color([0.9, 0.88, 0.84]).local(1);
  M.boxB('concrete', xc - w / 2, xc + w / 2, y - 0.16, y, 0, dp, { bevel: 0.02 });
  M.pcol(xc - w / 2, xc + w / 2, y - 0.16, y, 0, dp); // la dalle porte le pot de fleurs (un corps physique) : sans elle, il tombait au premier choc
  // consoles
  const cons = [[0, 0], [0.16, 0], [0.16, -0.08], [0.06, -0.34], [0, -0.38]];
  for (const x of [xc - w / 2 + 0.2, xc + w / 2 - 0.2]) { M.save().move(x + 0.06, y - 0.16, 0).rotY(-Math.PI / 2); M.extrude('concrete', cons, 0.12); M.restore(); }
  M.restore();
  // garde-corps
  M.save().color([0.14, 0.14, 0.13]); M.cls = 1;
  const x0 = xc - w / 2 + 0.04, x1 = xc + w / 2 - 0.04, z1 = dp - 0.04, top = y + 1.0;
  lbox(M, 'steel', x0, x1, top - 0.04, top, z1 - 0.025, z1 + 0.025);
  lbox(M, 'steel', x0, x1, y + 0.1, y + 0.13, z1 - 0.012, z1 + 0.012);
  for (const x of [x0, x1]) { lbox(M, 'steel', x - 0.025, x + 0.025, top - 0.04, top, 0, z1); lbox(M, 'steel', x - 0.012, x + 0.012, y + 0.1, y + 0.13, 0, z1); lbox(M, 'steel', x - 0.02, x + 0.02, y, top, z1 - 0.02, z1 + 0.02); }
  M.cls = 2;
  const nb = Math.round((x1 - x0) / 0.11);
  for (let i = 1; i < nb; i++) { const x = x0 + ((x1 - x0) * i) / nb; lbox(M, 'steel', x - 0.008, x + 0.008, y, top - 0.04, z1 - 0.008, z1 + 0.008, { skip: 'yY' }); }
  for (const x of [x0, x1]) for (let z = 0.12; z < z1 - 0.05; z += 0.11) lbox(M, 'steel', x - 0.008, x + 0.008, y, top - 0.04, z - 0.008, z + 0.008, { skip: 'yY' });
  M.restore();
  // pots de fleurs, linge
  if (rngF() < 0.5) M.dyn('pot', xc + (rngF() - 0.5) * (w - 0.6), y, dp * 0.55, rngF() * TAU);
  if (rngF() < 0.35) laundry(M, x0 + 0.1, x1 - 0.1, top - 0.02, z1, rngF);
}
/* Linge pendu sur une barre (repère local) */
function laundry(M, x0, x1, y, z, rngF) {
  M.save(); M.cls = 2;
  let x = x0;
  while (x < x1 - 0.3) {
    const w = 0.3 + rngF() * 0.35, h = 0.35 + rngF() * 0.4;
    M.color(PAL.awning[Math.floor(rngF() * PAL.awning.length)]);
    clothPiece(M, [x, y - h, z + 0.04], [x + w, y - h, z + 0.04], [x + w, y, z + 0.04], [x, y, z + 0.04], [0, 0, 1]); // tissu simulé (02mc-tissus.js), écarté de la barre
    x += w + 0.05 + rngF() * 0.2;
  }
  M.restore();
}
/* Descente d'eau pluviale (repère de façade) */
function drainPipe(M, x, y1, y0 = 0) {
  M.save().color([0.62, 0.6, 0.56]); M.cls = 1;
  M.save().move(x, y0 + 0.25, 0.1); M.cyl('steel', 0.05, y1 - y0 - 0.25, 8, { caps: '' }); M.restore();
  M.tube('steel', 0.05, [[x, y0 + 0.28, 0.1], [x, y0 + 0.14, 0.14], [x, y0 + 0.08, 0.26]], 8);
  M.cls = 2;
  for (let y = y0 + 1.2; y < y1 - 0.2; y += 1.8) lbox(M, 'steel', x - 0.06, x + 0.06, y, y + 0.03, 0, 0.16);
  M.restore();
}
/* Câble électrique courant sur la façade, boîtiers de raccordement */
function wallCable(M, x0, x1, y, rngF) {
  M.save().color([0.08, 0.08, 0.08]); M.cls = 2;
  const pts = []; for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 12) pts.push([x, y - Math.abs(Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 3)) * 0.05, 0.04]);
  M.tube('rubber', 0.012, pts, 4);
  M.color([0.7, 0.68, 0.62]);
  for (let x = x0 + 1 + rngF() * 2; x < x1 - 0.5; x += 3 + rngF() * 4) lbox(M, 'plastic', x - 0.08, x + 0.08, y - 0.12, y + 0.08, 0, 0.07);
  M.restore();
}
/* Applique de façade ; lit : allumée (ampoule et lumière chaude cuite dans le volume d'éclairage) ; toutes allumées quand l'éclairage public l'est */
function wallLamp(M, x, y, lit) {
  lit = lit || litOn();
  M.save().color([0.2, 0.2, 0.2]); M.cls = 1;
  M.tube('steel', 0.018, [[x, y, 0], [x, y + 0.12, 0.25], [x, y + 0.1, 0.5]], 5);
  M.save().move(x, y - 0.12, 0.5); M.cyl('steel', 0.14, 0.12, 10, { r1: 0.05 }); M.restore();
  M.cls = 1; M.save().move(x, y - 0.14, 0.5); M.cyl(lit ? 'lamp' : 'lampOff', 0.09, 0.03, 8); M.restore();
  if (lit) M.lamp(x, y - 0.3, 0.5, [1.0, 0.68, 0.38], 1.2, 6, 0.6);
  M.restore();
}
/* Moulure profilée le long de la façade (profil [sortie, hauteur], fermé contre le mur) */
function molding(M, mat, x0, x1, y, prof, tint) {
  M.save().color(tint).world(1).move(x1, y, 0).rotY(-Math.PI / 2);
  M.extrude(mat, prof, x1 - x0);
  M.restore();
}
const PROF = {
  cornice: [[0, 0], [0.06, 0], [0.06, 0.05], [0.1, 0.08], [0.15, 0.14], [0.24, 0.18], [0.24, 0.27], [0, 0.27]],
  band: [[0, 0], [0.05, 0], [0.07, 0.025], [0.07, 0.11], [0.045, 0.14], [0, 0.14]],
  plinth: [[0, 0], [0.06, 0], [0.06, 0.0], [0.06, 0.8], [0.03, 0.85], [0, 0.85]],
  coping: [[-0.04, 0], [0.04, 0], [0.04, 0.04], [0.0, 0.08], [-0.04, 0.04]],
};

/* ---------- Façade complète ---------- */
/* Zones sans porte ni boutique au rez-de-chaussée ([x0, x1, z0, z1], repère du monde), remplies par la carte en cours le temps de sa
   construction : là où un bâtiment voisin, un conteneur, une tente ou un mur de sacs se tient devant la façade, la travée reste un mur plein
   (decor.js relevait ces portes gênées). Les tirages au sort sont les mêmes : le reste de la façade et de la carte ne change pas. */
const NO_DOOR = [];
/* Façade d'un bloc : étages de 3,2 m, travées d'environ 3,1 m ; rez-de-chaussée commerçant ou habité.
   o : { mat, tint, style, skipGround, noGround, shutters, rng } */
function facadeKit(face, x0, x1, z0, z1, h, o) {
  const F = facadeFrame(face, x0, x1, z0, z1), len = F.len, R = o.rng, floorH = 3.2;
  const shade = Math.sin(F.rot) * SUN_DIR.x + Math.cos(F.rot) * SUN_DIR.z < 0; // façade à l'ombre : les appliques des portes y sont allumées
  const noDoor = (a) => { const x = F.ox + a * Math.cos(F.rot), z = F.oz - a * Math.sin(F.rot); return NO_DOOR.some((q) => x > q[0] && x < q[1] && z > q[2] && z < q[3]); };
  const ghost = []; // portes et boutiques retirées par NO_DOOR : les affiches les évitent comme avant (mêmes tirages)
  const bays = Math.max(1, Math.floor(len / (o.bay || 3.1))), bw = len / bays;
  const shut = o.shutters, frameT = o.frame, maghreb = o.style === 'maghreb';
  const ops = [], after = [];
  for (let f = o.skipGround ? 1 : 0; ; f++) {
    const fy = f * floorH; if (fy + 2.4 > h - 0.4) break;
    for (let i = 0; i < bays; i++) {
      const a = bw * (i + 0.5);
      if (f === 0) {
        if (o.noGround) continue;
        const r = R();
        if (r < 0.35) { // boutique
          const sw = Math.min(bw - 0.6, 2.6), op = { x0: a - sw / 2, x1: a + sw / 2, y0: 0, y1: 2.5, depth: 0.12, kind: 'shop' };
          const tint = R.pick(PAL.shop), open = R() < 0.3 ? 0.55 + R() * 0.3 : R() < 0.2 ? 0.2 : 0;
          if (noDoor(a)) { ghost.push(op); after.push(() => { if (R() < 0.6) R.pick(PAL.awning); else if (R() < 0.7) R(); }); continue; } // mur plein, mêmes tirages
          ops.push(op);
          after.push((M) => {
            rollShutter(M, op, 0.12, tint, open);
            if (R() < 0.6) awningStriped(M, a, 2.95, sw + 0.4, 1.25, [R.pick(PAL.awning), [0.9, 0.88, 0.82]]);
            else if (R() < 0.7) signBoard(M, a, 2.9, Math.min(sw + 0.2, 2.4), 0.55, Math.floor(R() * 8));
          });
        } else if (r < 0.55) { // porte
          const arch = maghreb || R() < 0.25, dw = arch ? 1.2 : 1.1;
          const op = { x0: a - dw / 2, x1: a + dw / 2, y0: 0, y1: arch ? 2.5 : 2.2, depth: 0.25, kind: 'door', rise: arch ? 0.6 : 0, back: arch };
          const tint = R.pick(PAL.door), glazed = R() < 0.3, open = !arch && R() < 0.18;
          if (noDoor(a)) { ghost.push(op); after.push(() => { R(); }); continue; } // mur plein, mêmes tirages
          ops.push(op);
          after.push((M) => { panelDoor(M, op, 0.25, tint, { glazed, open }); casing(M, op, arch ? PAL.stone : [0.86, 0.82, 0.74], 'ashlar', arch ? 0.16 : 0.12); if (R() < 0.3) wallLamp(M, a + dw / 2 + 0.35, 2.3, shade); });
        } else { // fenêtre basse
          const ww = Math.min(bw * 0.45, 1.2), op = { x0: a - ww / 2, x1: a + ww / 2, y0: 1.0, y1: 2.4, depth: 0.22, kind: 'win', rise: maghreb && R() < 0.5 ? 0.25 : 0, back: true };
          ops.push(op);
          const st = shut && R() < 0.8 ? (R() < 0.25 ? 'closed' : R() < 0.4 ? 'ajar' : 'open') : null, gr = R() < 0.6, board = !gr && R() < 0.2;
          after.push((M) => {
            if (board) boardedWindow(M, op, 0.22, R);
            else if (st !== 'closed') windowJoinery(M, op, 0.22, frameT, { curtain: R() < 0.3 ? R.pick(PAL.awning) : null });
            sill(M, op); if (st && !op.rise) shutters(M, op, shut, st, R);
            if (gr) grille(M, op);
          });
        }
      } else {
        const r = R(), bal = r < 0.14 && !maghreb, ac = r > 0.86;
        const ww = Math.min(bw * 0.42, 1.15);
        const op = bal ? { x0: a - ww / 2, x1: a + ww / 2, y0: fy + 0.05, y1: fy + 2.45, depth: 0.22, kind: 'french', back: true }
          : { x0: a - ww / 2, x1: a + ww / 2, y0: fy + 0.9, y1: fy + 2.45, depth: 0.22, kind: 'win', rise: maghreb && R() < 0.35 ? 0.22 : 0, back: true };
        ops.push(op);
        const st = shut && R() < 0.75 ? (R() < 0.3 ? 'closed' : R() < 0.35 ? 'ajar' : 'open') : null, dmg = bal ? 1 : R();
        after.push((M) => {
          if (maghreb && !bal && !op.rise && dmg > 0.8) { mashrabiya(M, op, frameT); return; }
          if (dmg < 0.06) boardedWindow(M, op, 0.22, R);
          else if (dmg < 0.11) brokenWindow(M, op, 0.22, frameT, R);
          else if (st !== 'closed') windowJoinery(M, op, 0.22, frameT, { door: bal, curtain: R() < 0.35 ? R.pick(PAL.awning) : null });
          if (!bal && R() < 0.3) wallDecal(M, 8, (op.x0 + op.x1) / 2, op.y0 - 1.3, op.x1 - op.x0 + 0.3, 1.25); // coulure sous l'appui
          if (!bal) sill(M, op);
          if (st && !op.rise) shutters(M, op, shut, st, R);
          if (!op.rise && o.lintels) lintel(M, op);
          if (bal) balcony(M, a, fy + 0.05, ww + 1.0, 0.85, R);
          if (ac) M.place(PF.acUnit(), a + ww / 2 + 0.55, fy + 0.35, 0, 0, { cls: 1 });
          if (!bal && R() < 0.12) M.dyn('pot', a + (R() - 0.5) * 0.4, op.y0 + 0.005, 0.03, R() * TAU);
        });
      }
    }
  }
  inFrame(F, (M) => {
    M.save().color(o.tint).world(1);
    M.aoFn = (x, y) => lerp(0.75, 1, smoothstep(0, 1.2, y));
    wallPierced(M, o.mat, len, 0, h, ops, { depth: 0.22, round: o.round });
    M.restore();
    // soubassement, bandeaux, corniche
    const pl = o.plinth;
    if (pl && !o.skipGround) {
      let cur = 0;
      const segs = ops.filter((p) => p.y0 < 0.5).map((p) => [p.x0, p.x1]).sort((p, q) => p[0] - q[0]);
      for (const [s0, s1] of segs) { if (s0 - cur > 0.05) plinthSeg(M, cur, s0, pl); cur = s1; }
      if (len - cur > 0.05) plinthSeg(M, cur, len, pl);
    }
    if (o.bands) for (let f = 1; f * floorH < h - 1.2; f++) molding(M, o.trimMat || 'plaster', 0, len, f * floorH - 0.14, PROF.band, o.trimTint || o.tint);
    if (o.cornice !== false) molding(M, o.trimMat || 'plaster', 0, len, h - 0.27, PROF.cornice, o.trimTint || o.tint);
    if (o.quoins) for (const x of [0, len]) for (let y = 0.9, k = 0; y < h - 0.6; y += 0.42, k++) {
      const w = k % 2 ? 0.28 : 0.45;
      M.save().color(PAL.stone).world(1); lbox(M, 'ashlar', x === 0 ? 0 : len - w, x === 0 ? w : len, y, y + 0.38, 0, 0.035); M.restore();
    }
    for (const fn of after) fn(M);
    // descente d'eau, câbles, compteur
    if (o.pipes !== false && len > 5) drainPipe(M, bw * Math.max(1, Math.floor(R() * bays)), h - 0.3);
    if (R() < 0.7 && !o.skipGround) wallCable(M, 0.2, len - 0.2, floorH - 0.22 + R() * 0.1, R);
    if (!o.skipGround && R() < 0.5) { M.save().color([0.8, 0.78, 0.72]); M.cls = 2; const x = 0.4 + R() * (len - 0.8); if (!ops.some((p) => x > p.x0 - 0.4 && x < p.x1 + 0.4)) lbox(M, 'plastic', x - 0.2, x + 0.2, 1.1, 1.6, 0, 0.16); M.restore(); }
    // affiches, pochoirs, graffitis entre les ouvertures du rez-de-chaussée
    if (!o.skipGround && !o.noGround) for (let k = 0; k < 3; k++) {
      if (R() > 0.55) continue;
      const kind = R(), w = kind < 0.5 ? 0.7 : kind < 0.75 ? 1.1 : 1.3, x = 0.3 + w / 2 + R() * (len - w - 0.6);
      if (ops.concat(ghost).some((p) => p.y0 < 2.6 && x + w / 2 > p.x0 - 0.15 && x - w / 2 < p.x1 + 0.15)) continue;
      const idx = kind < 0.5 ? Math.floor(R() * 4) : kind < 0.75 ? 4 + Math.floor(R() * 2) : 6 + Math.floor(R() * 2);
      wallDecal(M, idx, x, kind < 0.5 ? 1.25 + R() * 0.3 : 0.7 + R() * 0.6, w, kind < 0.5 ? w * 1.1 : w * 0.8);
    }
  });
}
function plinthSeg(M, a, b, pl) {
  M.save().color(pl.tint).world(1);
  M.boxB(pl.mat, a, b, 0, pl.h, -0.02, 0.05, { skip: 'z' });
  M.boxB(pl.mat, a, b, pl.h, pl.h + 0.05, -0.02, 0.07, { bevel: 0.015, skip: 'z' });
  M.restore();
}

/* ---------- Toits ---------- */
/* Toit terrasse : acrotère avec couvertine, étanchéité et gravier, gargouilles, équipements */
function flatRoof(x0, x1, z0, z1, y, tint, R) {
  const M = DECOR, t = 0.25, ph = 0.7;
  M.save().color([0.74, 0.72, 0.68]).world(1);
  M.boxB(R() < 0.5 ? 'gravel' : 'concrete', x0 + t, x1 - t, y, y + 0.06, z0 + t, z1 - t, { skip: 'y' });
  M.color(tint).world(1);
  M.boxB('plaster', x0, x1, y, y + ph, z0, z0 + t, { skip: 'y' }); M.boxB('plaster', x0, x1, y, y + ph, z1 - t, z1, { skip: 'y' });
  M.boxB('plaster', x0, x0 + t, y, y + ph, z0 + t, z1 - t, { skip: 'yzZ' }); M.boxB('plaster', x1 - t, x1, y, y + ph, z0 + t, z1 - t, { skip: 'yzZ' });
  // couvertine en béton, légèrement débordante
  M.color([0.86, 0.84, 0.8]).local(1);
  M.boxB('concrete', x0 - 0.03, x1 + 0.03, y + ph, y + ph + 0.06, z0 - 0.03, z0 + t + 0.03, { bevel: 0.012 });
  M.boxB('concrete', x0 - 0.03, x1 + 0.03, y + ph, y + ph + 0.06, z1 - t - 0.03, z1 + 0.03, { bevel: 0.012 });
  M.boxB('concrete', x0 - 0.03, x0 + t + 0.03, y + ph, y + ph + 0.06, z0 + t + 0.03, z1 - t - 0.03, { bevel: 0.012 });
  M.boxB('concrete', x1 - t - 0.03, x1 + 0.03, y + ph, y + ph + 0.06, z0 + t + 0.03, z1 - t - 0.03, { bevel: 0.012 });
  // gargouilles
  M.color([0.6, 0.58, 0.54]); M.cls = 1;
  for (const [x, z, dx, dz] of [[x0 + (x1 - x0) * 0.25, z0, 0, -1], [x1 - (x1 - x0) * 0.25, z1, 0, 1]]) {
    M.save().move(x, y + 0.1, z).rotY(dz > 0 ? 0 : Math.PI); M.boxB('steel', -0.06, 0.06, 0, 0.08, -0.05, 0.35); M.restore(); void dx;
  }
  M.restore();
  // équipements
  const w = x1 - x0, d = z1 - z0, n = Math.floor((w * d) / 55) + 1;
  for (let i = 0; i < n; i++) {
    const px = x0 + 1.2 + R() * (w - 2.4), pz = z0 + 1.2 + R() * (d - 2.4), r = R(), ry = Math.round(R() * 4) * (Math.PI / 2);
    if (r < 0.32) M.place(PF.waterTank(), px, y + 0.06, pz, R() * TAU, { tint: { plastic: R.pick([[0.9, 0.9, 0.86], [0.2, 0.2, 0.22], [0.25, 0.4, 0.6]]) }, nocol: true });
    else if (r < 0.5) M.place(PF.acUnit(), px, y + 0.06, pz, ry, { nocol: true });
    else if (r < 0.68) M.place(PF.dish(), px, y + 0.06, pz, R() * TAU, { nocol: true, cls: 1 });
    else if (r < 0.8) M.place(PF.solarHeater(), px, y + 0.06, pz, ry, { nocol: true });
    else if (r < 0.9) M.place(PF.antenna(), px, y + 0.06, pz, R() * TAU, { nocol: true, cls: 1 });
    else if (w * d > 60) M.place(PF.roofHut(), px, y + 0.06, pz, ry, { nocol: true });
  }
}
/* Toit à deux pans en tuiles : débords, rives, faîtage en tuiles rondes, gouttières, pignons enduits */
function pitchedRoof(x0, x1, z0, z1, y, tint, R) {
  const M = DECOR, alongX = x1 - x0 >= z1 - z0, span = alongX ? z1 - z0 : x1 - x0, len = alongX ? x1 - x0 : z1 - z0;
  const rise = Math.min(3.2, span * 0.24), ov = 0.4, drop = ov * (rise / (span / 2)), T = [0.92 + R() * 0.08, 0.85 + R() * 0.1, 0.82 + R() * 0.1];
  // repère local : x le long du faîtage (0..len), z en travers (-span/2..span/2)
  M.save();
  if (alongX) M.move(x0, y, (z0 + z1) / 2); else M.move((x0 + x1) / 2, y, z1).rotY(Math.PI / 2);
  const hs = span / 2 + ov, yr = rise;
  M.color(T).world(1);
  for (const s of [1, -1]) {
    const nl = hyp(hs, yr + drop);
    M.quad('rooftiles', [-ov, -drop, s * hs], [len + ov, -drop, s * hs], [len + ov, yr, 0], [-ov, yr, 0], [0, hs / nl, (s * (yr + drop)) / nl]);
    // sous-face et bandeau d'égout
    M.color([0.5, 0.44, 0.38]).local(1);
    M.quad('paintwood', [-ov, -drop - 0.06, s * hs], [len + ov, -drop - 0.06, s * hs], [len + ov, yr - 0.1, 0], [-ov, yr - 0.1, 0], [0, -1, 0]);
    M.color([0.4, 0.3, 0.22]);
    M.save().move(len / 2, -drop - 0.2, s * (hs + 0.01)); M.box('paintwood', len + ov * 2, 0.16, 0.03); M.restore();
    // gouttière demi-ronde
    M.color([0.55, 0.52, 0.48]); M.cls = 1;
    M.save().move(-ov, -drop - 0.12, s * (hs + 0.08)).rotZ(-Math.PI / 2); M.cyl('steel', 0.065, len + ov * 2, 8, { a0: -Math.PI / 2, a1: Math.PI / 2, caps: '' }); M.restore();
    M.cls = 0; M.color(T).world(1);
  }
  // pignons
  M.color(tint).world(1);
  for (const [xx, dir] of [[0, -1], [len, 1]]) {
    M.quad('plaster', [xx, 0, -span / 2], [xx, 0, span / 2], [xx, yr - 0.05, 0.001], [xx, yr - 0.05, -0.001], [dir, 0, 0]);
  }
  // rives (planches de bord)
  M.color([0.42, 0.32, 0.24]).local(1);
  for (const xx of [-ov, len + ov]) for (const s of [1, -1]) {
    const dy = yr + drop + 0.07, dz = -s * hs, L = hyp(dy, dz);
    M.save().move(xx, (yr - drop) / 2 - 0.12, (s * hs) / 2).rotX(Math.atan2(-dy, dz)); M.box('paintwood', 0.05, 0.18, L); M.restore();
  }
  // faîtage en tuiles rondes et rang de tuiles d'égout
  M.color([0.82, 0.55, 0.42]).local(1);
  M.save().move(-ov, yr - 0.05, 0).rotZ(-Math.PI / 2); M.cyl('rooftiles', 0.13, len + ov * 2, 8, { a0: Math.PI / 2, a1: Math.PI * 1.5 }); M.restore();
  // tuiles d'égout : demi-tuiles rondes posées sur le pan, en bas de pente
  const al = Math.atan2(yr + drop, hs);
  M.cls = 1;
  for (const s of [1, -1]) for (let x = -ov + 0.11; x < len + ov - 0.05; x += 0.22) {
    M.save().move(x, -drop, s * hs).rotX(s * al).move(0, 0.02, s > 0 ? -0.34 : 0).rotX(Math.PI / 2); M.cyl('rooftiles', 0.085, 0.34, 6, { a0: Math.PI, a1: TAU, caps: '' }); M.restore();
  }
  M.cls = 0;
  // cheminée
  if (R() < 0.35) {
    const cx = len * (0.2 + R() * 0.6), cz = (R() - 0.5) * span * 0.3;
    M.color(tint).world(1); M.boxB('plaster', cx - 0.3, cx + 0.3, rise * 0.5, yr + 0.9, cz - 0.3, cz + 0.3);
    M.color([0.7, 0.66, 0.6]).local(1); M.boxB('concrete', cx - 0.36, cx + 0.36, yr + 0.9, yr + 0.98, cz - 0.36, cz + 0.36, { bevel: 0.01 });
  }
  M.restore();
  DECOR.occ(x0 - ov, x1 + ov, y, y + rise * 0.6, z0 - ov, z1 + ov, 1);
}

/* ---------- Bâtiment ---------- */
/* Bloc plein [x0,x1] x [z0,z1] de hauteur h. o : faces (côtés à façade détaillée), tint, key, style,
   skipGround, noGround, pitched */
function building(x0, x1, z0, z1, h, o = {}) {
  const R = rngOf(Math.round(x0 * 73 + z0 * 131 + h * 17) + 9001);
  const tint = o.tint || R.pick(PAL.plaster);
  let mat = o.key || 'plaster';
  if (mat === 'plaster' && R() < 0.3) mat = 'plaster2';
  const style = o.style || (R() < 0.45 ? 'maghreb' : 'colonial');
  DECOR.col(x0, x1, 0, h, z0, z1, 'concrete');
  const faces = o.faces || 'nsew';
  const kit = {
    mat, tint, style, rng: R, skipGround: o.skipGround, noGround: o.noGround,
    shutters: R() < 0.65 ? R.pick(PAL.shutter) : null, frame: R.pick(PAL.frame),
    plinth: { mat: R() < 0.6 ? 'ashlar' : 'stone', h: style === 'maghreb' ? 0.55 : 0.85, tint: PAL.stone },
    bands: style === 'colonial' && h > 5, cornice: true, quoins: style === 'colonial' && R() < 0.35, lintels: style === 'colonial' && R() < 0.5,
    round: /^plaster/.test(mat) ? 0.06 : 0, // angles arrondis de l'enduit (wallRound), la brique garde ses arêtes
  };
  for (const f of 'nsew') {
    if (faces.indexOf(f) >= 0) facadeKit(f, x0, x1, z0, z1, h, kit);
    else plainWall(f, x0, x1, z0, z1, h, mat, tint, kit.round);
  }
  const pitched = o.pitched !== undefined ? o.pitched : style === 'colonial' && R() < 0.6;
  if (pitched) pitchedRoof(x0, x1, z0, z1, h, tint, R); else flatRoof(x0, x1, z0, z1, h, tint, R);
}
function plainWall(face, x0, x1, z0, z1, h, mat, tint, round) {
  const F = facadeFrame(face, x0, x1, z0, z1);
  inFrame(F, (M) => { M.save().color(tint).world(1); M.aoFn = (x, y) => lerp(0.75, 1, smoothstep(0, 1.2, y)); wallPierced(M, mat, F.len, 0, h, [], { round }); M.restore(); });
}

/* ---------- Murs traversants (intérieurs praticables) ---------- */
/* Mur d'épaisseur t. axis 'x' : mur le long de X à z = fixed ; 'z' : le long de Z à x = fixed.
   ops : ouvertures [{ a0, a1, b0, b1 }] relatives au pied du mur (b0, b1 : hauteurs). Collisions identiques à
   l'ancienne version (segments pleins), décor : deux parements percés, tableaux, chambranles, arase (o.top === false : sans arase,
   quand une dalle ou un dallage posé au même niveau la recouvre ; les deux faces dans le même plan scintillaient). Chambranles des
   portes : o.frameTint, o.frameMat (bois peint par défaut, 'ashlar' : encadrement de pierre), o.frameW (largeur). */
function wallOpen(key, axis, fixed, t, a0, a1, y0, h, ops, o = {}) {
  ops = ops.slice().sort((p, q) => p.a0 - q.a0);
  const k = LEGACY_KEY[key] || key, kind = matKind(key);
  const col = (s0, s1, yb, yt) => {
    if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
    if (axis === 'x') DECOR.col(s0, s1, yb, yt, fixed - t / 2, fixed + t / 2, o.m || kind);
    else DECOR.col(fixed - t / 2, fixed + t / 2, yb, yt, s0, s1, o.m || kind);
  };
  let cur = a0;
  for (const op of ops) {
    col(cur, op.a0, y0, y0 + h);
    if (op.b0 > 0) col(op.a0, op.a1, y0, y0 + op.b0);
    if (op.b1 < h) col(op.a0, op.a1, y0 + op.b1, y0 + h);
    cur = op.a1;
  }
  col(cur, a1, y0, y0 + h);
  // décor : deux parements dans leurs repères (x le long du mur vu de chaque côté)
  const tint = o.tint || [1, 1, 1];
  for (const side of [1, -1]) {
    const M = DECOR; M.save();
    // repère : origine au début du mur (vu de ce côté), z vers l'extérieur de ce parement
    if (axis === 'x') { if (side > 0) M.move(a0, 0, fixed + t / 2); else M.move(a1, 0, fixed - t / 2).rotY(Math.PI); }
    else { if (side > 0) M.move(fixed + t / 2, 0, a1).rotY(Math.PI / 2); else M.move(fixed - t / 2, 0, a0).rotY(-Math.PI / 2); }
    const L = a1 - a0, map = (a) => (axis === 'x' ? (side > 0 ? a - a0 : a1 - a) : (side > 0 ? a1 - a : a - a0));
    const lops = ops.map((p) => { const u0 = map(p.a0), u1 = map(p.a1); return { x0: Math.min(u0, u1), x1: Math.max(u0, u1), y0: y0 + p.b0, y1: y0 + Math.min(p.b1, h), rise: p.arch ? Math.min(p.arch, (p.a1 - p.a0) / 2) : 0 }; });
    M.color(tint).world(1);
    M.aoFn = (x, y) => lerp(0.72, 1, smoothstep(y0, y0 + 1.2, y));
    // embrasures sur la moitié de l'épaisseur de chaque côté (les deux moitiés se rejoignent au milieu)
    wallPierced(M, k, L, y0, h, lops.map((p) => ({ ...p, depth: t / 2 })), { floorY: o.floorY !== undefined ? o.floorY : y0, aoFn: M.aoFn });
    M.aoFn = null;
    if (o.frames !== false) for (const p of lops) if (p.y1 - p.y0 > 1.6 && p.y0 <= y0 + 0.05) casing(M, p, o.frameTint || [0.5, 0.42, 0.34], o.frameMat || 'paintwood', o.frameW || 0.09);
    // o.dress(M, L, lops, side) : habillage de chaque parement dans son repère (soubassement, corniche, appliques...), après les embrasures
    if (o.dress) { M.save(); o.dress(M, L, lops, side); M.restore(); }
    if (side > 0) { // arase du mur et extrémités
      M.color(tint).world(1);
      if (o.top !== false) M.quad(k, [0, y0 + h, 0], [L, y0 + h, 0], [L, y0 + h, -t], [0, y0 + h, -t], [0, 1, 0]);
      M.quad(k, [0, y0, 0], [0, y0 + h, 0], [0, y0 + h, -t], [0, y0, -t], [-1, 0, 0]);
      M.quad(k, [L, y0, 0], [L, y0 + h, 0], [L, y0 + h, -t], [L, y0, -t], [1, 0, 0]);
    }
    M.restore();
  }
}

/* ---------- Arrière-plan ---------- */
/* Immeuble lointain : volume enduit, façades à fenêtres en texture (farfacade, une travée par tuile), toit terrasse
   simplifié ; aucune collision. */
function farBuilding(cx, cz, w, d, h, tint, R) {
  const M = DECOR, bw = 3.1, fh = 3.2;
  M.save().move(cx, 0, cz).color(tint);
  for (const [face, x0, x1, z0, z1] of [['s', -w / 2, w / 2, -d / 2, d / 2], ['n', -w / 2, w / 2, -d / 2, d / 2], ['e', -w / 2, w / 2, -d / 2, d / 2], ['w', -w / 2, w / 2, -d / 2, d / 2]]) {
    const F = facadeFrame(face, x0, x1, z0, z1), nb = Math.max(1, Math.round(F.len / bw)), sx = F.len / nb, nf = Math.max(1, Math.floor(h / fh));
    M.save().move(F.ox, 0, F.oz).rotY(F.rot);
    const B = M.buf('farfacade', F.len / 2, h / 2, 0);
    const q = [M.v(B, 0, 0, 0, 0, 0, 1, 0, 0), M.v(B, F.len, 0, 0, 0, 0, 1, nb, 0), M.v(B, F.len, nf * fh, 0, 0, 0, 1, nb, nf), M.v(B, 0, nf * fh, 0, 0, 0, 1, 0, nf)];
    M.quadI(B, q[0], q[1], q[2], q[3]);
    if (h > nf * fh + 0.05) M.quad('plaster', [0, nf * fh, 0], [F.len, nf * fh, 0], [F.len, h, 0], [0, h, 0], [0, 0, 1]);
    M.restore(); void sx;
  }
  M.world(1); M.boxB('concrete', -w / 2, w / 2, h, h + 0.05, -d / 2, d / 2, { skip: 'y' });
  M.local(1); M.boxB('plaster', -w / 2, w / 2, h, h + 0.6, -d / 2, -d / 2 + 0.2); M.boxB('plaster', -w / 2, w / 2, h, h + 0.6, d / 2 - 0.2, d / 2);
  if (R() < 0.5) M.place(PF.waterTank(), (R() - 0.5) * w * 0.5, h + 0.05, (R() - 0.5) * d * 0.5, 0, { tint: { plastic: [0.9, 0.9, 0.86] }, nocol: true });
  M.restore();
}
/* Minaret : fût carré, balcon sur encorbellement, lanterne, dôme et croissant */
function minaret(x, z, h = 30, o = {}) {
  const M = DECOR;
  if (o.rond) { minaretRond(x, z, h); return; }
  if (o.col) { WORLD.col({ x0: x - 2.2, x1: x + 2.2, y0: 0, y1: h * 0.72 + 0.6, z0: z - 2.2, z1: z + 2.2 }, 'concrete'); WORLD.col({ x0: x - 1.6, x1: x + 1.6, y0: h * 0.72 + 0.6, y1: h * 0.88, z0: z - 1.6, z1: z + 1.6 }, 'concrete'); }
  M.save().move(x, 0, z).color([0.95, 0.9, 0.8]).world(1);
  M.boxB('plaster', -2.2, 2.2, 0, h * 0.72, -2.2, 2.2);
  M.local(1); M.color([0.85, 0.78, 0.66]);
  for (let y = 6; y < h * 0.7; y += 6) M.boxB('ashlar', -2.28, 2.28, y, y + 0.3, -2.28, 2.28);
  M.boxB('ashlar', -2.9, 2.9, h * 0.72, h * 0.72 + 0.6, -2.9, 2.9, { bevel: 0.1 });
  M.color([0.95, 0.9, 0.8]).world(1); M.boxB('plaster', -1.6, 1.6, h * 0.72 + 0.6, h * 0.88, -1.6, 1.6);
  M.local(1); M.color([0.3, 0.55, 0.5]);
  M.save().move(0, h * 0.88, 0); M.lathe('paint', [[0, 0], [1.7, 0], [1.75, 0.2], [1.6, 1.2], [1.1, 2.3], [0.4, 2.9], [0, 3.0]], 16); M.restore();
  M.color([0.85, 0.7, 0.3]); M.save().move(0, h * 0.88 + 3, 0); M.cyl('steel', 0.06, 1.4, 6); M.restore();
  M.restore();
}
/* Minaret rond « en crayon » : fût cylindrique à bagues, balcon sur consoles, lanterne, flèche conique de plomb (silhouette bien distincte
   du minaret carré à coupole verte). Collision du fût et de la lanterne : il arrête les tirs. */
function minaretRond(x, z, h) {
  const M = DECOR, r = 1.9, b = h * 0.68, l = h * 0.8;
  M.save().move(x, 0, z).color([0.96, 0.93, 0.86]).local(1);
  M.lathe('plaster', [[0, 0], [r + 0.3, 0], [r + 0.3, 2.4], [r, 2.6], [r * 0.92, b], [0, b]], 16, { sharp: 0.5 });
  M.color([0.85, 0.78, 0.66]);
  for (let y = 6; y < b - 1; y += 5) { M.save().move(0, y, 0); M.lathe('ashlar', [[r * 0.98 - 0.02, 0], [r * 0.98 + 0.08, 0], [r * 0.98 + 0.08, 0.3], [r * 0.98 - 0.02, 0.3]], 16); M.restore(); }
  M.save().move(0, b, 0); M.lathe('ashlar', [[0, -0.9], [r * 0.95, -0.9], [r + 0.7, 0], [r + 0.75, 0.2], [0, 0.2]], 16, { sharp: 0.5 }); M.restore();
  M.color([0.2, 0.2, 0.2]); M.save().move(0, b + 0.2, 0); M.lathe('steel', [[r + 0.66, 0], [r + 0.72, 0], [r + 0.72, 1.0], [r + 0.66, 1.0]], 24); M.restore();
  M.color([0.96, 0.93, 0.86]); M.save().move(0, b + 0.2, 0); M.lathe('plaster', [[0, 0], [r * 0.7, 0], [r * 0.7, l - b - 0.2], [0, l - b - 0.2]], 12); M.restore();
  M.color([0.05, 0.05, 0.05]); for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; M.save().move(Math.cos(a) * r * 0.7, b + 1.2, Math.sin(a) * r * 0.7).rotY(-a + Math.PI / 2); M.boxB('dark', -0.25, 0.25, 0, 1.4, -0.01, 0.01); M.restore(); }
  M.color([0.42, 0.44, 0.48]); M.save().move(0, l, 0); M.lathe('paint', [[0, 0], [r * 0.8, 0], [r * 0.75, 0.2], [0.05, h - l - 1.2], [0, h - l - 1.1]], 16, { sharp: 0.8 }); M.restore();
  M.color([0.85, 0.7, 0.3]); M.save().move(0, h - 1.15, 0); M.cyl('steel', 0.05, 1.3, 6); M.save().move(0, 0.6, 0); M.lathe('steel', [[0, -0.12], [0.12, 0], [0, 0.12]], 8); M.restore(); M.restore();
  M.restore();
  WORLD.col({ x0: x - r, x1: x + r, y0: 0, y1: b, z0: z - r, z1: z + r }, 'concrete');
  WORLD.col({ x0: x - r * 0.7, x1: x + r * 0.7, y0: b, y1: l, z0: z - r * 0.7, z1: z + r * 0.7 }, 'concrete');
}
/* Maison à coupole blanche */
function domeHouse(x, z, s = 1) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.96, 0.94, 0.9]).world(1);
  M.boxB('plaster', -7 * s, 7 * s, 0, 7 * s, -7 * s, 7 * s);
  M.local(1); M.save().move(0, 7 * s, 0); M.lathe('plaster', [[0, 0], [5.5 * s, 0], [5.5 * s, 0.8 * s], [5.2 * s, 2.5 * s], [4.2 * s, 4.4 * s], [2.4 * s, 5.8 * s], [0, 6.4 * s]], 20); M.restore();
  M.restore();
}
/* Dunes et collines au-delà de la ville (anneau de relief bruité, sable) */
function dunes(r0 = 150, r1 = 250) {
  const M = DECOR, N = makeNoise(99), nu = 72, nv = 10;
  WORLD.force = 'far';
  M.save().color([0.95, 0.85, 0.75]).local(1); M.cls = 1;
  M.surf('sand', nu, nv, (u, v) => {
    const a = u * TAU, r = lerp(r0, r1, v), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const n = N.fbm(u, v, 12, 4, 4), ridge = 1 - Math.abs(N.fbm(u + 0.37, v, 6, 4, 3) * 2 - 1);
    return [x, -1 + smoothstep(0, 0.35, v) * (n * 22 + ridge * 18) * (0.4 + v * 0.8), z];
  }, { closeU: true, uL: 300, vL: 30 });
  M.restore(); WORLD.force = null;
}
