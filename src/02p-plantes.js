/* ==========================================================================
   PLANTES : la bibliothèque de végétation de Hortus (prefabs de PF), construite avec les primitives de 02n-flore.js et
   les sprites de 02o-herbier.js. Chaque plante est un prefab estampillé autant de fois que voulu (DECOR.place) ; les
   graines changent la silhouette, M.color la teinte. Tout ce qui bouge porte des poids de souplesse (feuilles et pointes :
   1, pieds : 0). Les petites plantes sont en classe 2 (masquées au loin), les couronnes d'arbres en classe 0 (elles
   projettent leur ombre découpée). Les troncs ont une collision étroite et un volume d'occlusion sous la couronne.
   ========================================================================== */
const _va = new V3(), _vb = new V3(), _vc = new V3();
/* Base orthonormée (u, v) perpendiculaire à la direction n ([x, y, z] unitaire) */
function leafBasis(n) {
  _va.set(...n); _vb.set(Math.abs(n[1]) < 0.9 ? 0 : 1, Math.abs(n[1]) < 0.9 ? 1 : 0, 0); _vc.crossVectors(_va, _vb).normalize();
  const u = [_vc.x, _vc.y, _vc.z]; _vb.crossVectors(_va, _vc).normalize(); return [u, [_vb.x, _vb.y, _vb.z]];
}
const HX = (name) => HERB[name];
/* Carte carrée de côté s centrée en c, normale n, tournée de rot, dans la région reg. o : voir leafQuadUV */
function leafPatch(M, mat, reg, c, n, s, rot, o = {}) {
  const [u, v] = leafBasis(n), cs = Math.cos(rot), sn = Math.sin(rot), h = s / 2, w = o.aspect ? s * o.aspect : s;
  const a = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn], b = [-u[0] * sn + v[0] * cs, -u[1] * sn + v[1] * cs, -u[2] * sn + v[2] * cs];
  const P = (x, y) => [c[0] + a[0] * x * w / 2 + b[0] * y * h, c[1] + a[1] * x * w / 2 + b[1] * y * h, c[2] + a[2] * x * w / 2 + b[2] * y * h];
  leafQuad(M, mat, [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], reg, o);
}
/* Courbe d'une fronde : n segments, élévation de départ e0 (rad au-dessus de l'horizontale) qui retombe de drop en bout, longueur L, cap az */
function frondPath(L, e0, drop, az, n = 4, base = [0, 0, 0]) {
  const pts = [base.slice()]; let x = 0, y = 0;
  for (let i = 1; i <= n; i++) { const t = (i - 0.5) / n, e = e0 - (e0 + drop) * Math.pow(t, 1.7), dl = L / n; x += Math.cos(e) * dl; y += Math.sin(e) * dl; pts.push([base[0] + Math.cos(az) * x, base[1] + y, base[2] + Math.sin(az) * x]); }
  return pts;
}

/* ---------- Arbres feuillus ---------- */
/* kind : région de feuillage dans l'atlas B ; sz : taille des cartes (partie fixe, partie par m de rayon) ; tint : variantes de teinte */
const TREE_KINDS = {
  oak: { reg: 'oak', mat: 'leafB', tints: [[0.92, 1, 0.86], [1, 1, 0.92], [0.82, 0.96, 0.78]] },
  linden: { reg: 'linden', mat: 'leafB', tints: [[1, 1, 0.9], [0.92, 1, 0.8], [1, 0.98, 0.86]] },
  maple: { reg: 'maple', mat: 'leafB', tints: [[1, 0.92, 0.86], [1, 0.78, 0.7], [0.95, 0.85, 0.8]] },
  ginkgo: { reg: 'ginkgo', mat: 'leafB', tints: [[1, 1, 0.9], [1, 0.94, 0.8]] },
  cherry: { reg: 'cherry', mat: 'leafB', tints: [[1, 1, 1], [1, 0.95, 0.96]] },
  cherryW: { reg: 'cherryW', mat: 'leafB', tints: [[1, 1, 1]] },
  ficus: { reg: 'ficus', mat: 'leafA', tints: [[0.9, 1, 0.88], [1, 1, 0.9], [0.8, 0.94, 0.8]] },
};
/* Arbre : kind, h (hauteur totale), r (rayon de couronne), seed ; o : shape ('round', 'spread', 'tall'), th (hauteur du tronc nu), lean,
   n (cartes), trunk ('bark'), sz (taille des cartes) */
PF.tree = (kind, h = 9, r = 3.4, seed = 1, o = {}) => prefab(`tree_${kind}_${h}_${r}_${seed}_${o.shape || 'round'}_${o.th || 0}_${o.lod || 0}`, (M) => {
  const K = TREE_KINDS[kind], R = rngOf(seed * 977 + 13), reg = HERB[K.reg], shape = o.shape || 'round';
  const th = o.th || h * (shape === 'spread' ? 0.3 : 0.38), ry = (h - th) * (shape === 'spread' ? 0.42 : 0.5), rr = shape === 'tall' ? r * 0.72 : shape === 'spread' ? r * 1.2 : r;
  const lean = o.lean !== undefined ? o.lean : R.range(0.1, 0.5), ld = R() * TAU, lx = Math.cos(ld) * lean, lz = Math.sin(ld) * lean;
  const tr = 0.14 + h * 0.017, cx = lx, cy = th + ry, cz = lz;
  // tronc : patte élargie, légère courbe, fourche
  const lod = o.lod || 0, seg = lod ? 5 : 12, path = []; for (let i = 0; i <= seg; i++) { const t = i / seg; path.push([lx * t * t + Math.sin(t * 5 + seed) * 0.06, t * th, lz * t * t + Math.cos(t * 4 + seed) * 0.06]); }
  M.save().color(o.barkTint || [0.82, 0.76, 0.7]).local(1); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 1.6, y));
  M.sweep('bark', circleShape(1, lod ? 6 : 9), path, { scale: (t) => tr * (1 + 1.1 * Math.pow(1 - t, 7)) * (1 - 0.4 * t), uAround: 0.7 });
  M.aoFn = null;
  // charpente : branches maîtresses vers la périphérie de la couronne (arbre d'arrière-plan, lod : sans)
  const nb = lod ? 0 : 4 + Math.floor(R() * 3);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * TAU + R() * 0.7, d = rr * R.range(0.45, 0.8), y1 = th + ry * R.range(0.55, 1.15), y0 = th * R.range(0.78, 0.98);
    M.tube('bark', tr * 0.42, [[lx * 0.9, y0, lz * 0.9], [lx + Math.cos(a) * d * 0.5, (y0 + y1) / 2 + 0.3, lz + Math.sin(a) * d * 0.5], [lx + Math.cos(a) * d, y1, lz + Math.sin(a) * d]], 5, { scale: (t) => 1 - t * 0.75 });
  }
  M.restore();
  // couronne : rameaux feuillus qui rayonnent du cœur vers la coque de l'ellipsoïde (normales rayonnantes, cœur sombre)
  const n = o.n || Math.round((70 + rr * rr * 8) * (lod ? 0.45 : 0.95)), crown = [cx, cy, cz, rr / ry];
  M.save().cls = 0;
  for (let i = 0; i < n; i++) {
    let dx, dy, dz, d; do { dx = R.range(-1, 1); dy = R.range(-1, 1); dz = R.range(-1, 1); d = hyp3(dx, dy, dz); } while (d > 1 || d < 0.2);
    dx /= d; dy /= d; dz /= d; if (shape === 'spread') dy *= 0.6; if (dy < -0.35) dy = -0.35 + (dy + 0.35) * 0.3;
    const f0 = R.range(0.25, 0.65), sz = (o.sz || R.range(1.0, 1.4) * clamp(0.3 * rr + 0.7, 1.2, 2.2) * 0.88) * (kind === 'cherry' || kind === 'cherryW' ? 1.15 : 1) * (lod ? 1.3 : 1);
    // base du rameau à l'intérieur de la couronne, long axe vers l'extérieur et légèrement vers le bas
    const bx = cx + dx * rr * f0, by = cy + dy * ry * f0, bz = cz + dz * rr * f0;
    const ax = [dx * rr, dy * ry - 0.25 * ry * R(), dz * rr], al = Math.hypot(...ax) || 1, L = [ax[0] / al, ax[1] / al, ax[2] / al];
    const [u, v] = leafBasis(L), rot = R() * TAU, cs = Math.cos(rot), sn = Math.sin(rot), W = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn];
    const hw = sz * 0.5, P = (w, l) => [bx + W[0] * w * hw + L[0] * l * sz, by + W[1] * w * hw + L[1] * l * sz, bz + W[2] * w * hw + L[2] * l * sz];
    M.color(R.pick(K.tints));
    const tipD = clamp(d * 0.4 + f0 + 0.3, 0.3, 1), aoB = lerp(0.28, 0.55, f0), aoT = lerp(0.62, 1, tipD);
    leafQuad(M, K.mat, [P(-1, 0), P(1, 0), P(1, 1), P(-1, 1)], reg, { crown, w: [0.25, 0.25, 0.9, 0.9], ao: [aoB, aoB, aoT, aoT] });
  }
  M.restore();
  M.occ(cx - rr * 0.8, cx + rr * 0.8, th + ry * 0.3, th + ry * 1.9, cz - rr * 0.8, cz + rr * 0.8, 0.55);
  M.col(lx * 0.0 - tr * 0.8, tr * 0.8, 0, th + 0.6, -tr * 0.8, tr * 0.8, 'wood');
});
/* Saule pleureur : couronne claire et rideau de brins qui retombent jusqu'à l'eau */
PF.willow = (h = 8, r = 3.4, seed = 1) => prefab(`willow_${h}_${r}_${seed}`, (M) => {
  const R = rngOf(seed * 313 + 7), th = h * 0.36, tr = 0.2 + h * 0.02, lean = R.range(0.3, 0.9), ld = R() * TAU, lx = Math.cos(ld) * lean, lz = Math.sin(ld) * lean;
  const path = []; for (let i = 0; i <= 12; i++) { const t = i / 12; path.push([lx * t * t * 1.6, t * th, lz * t * t * 1.6]); }
  M.save().color([0.78, 0.74, 0.68]).local(1); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 1.6, y));
  M.sweep('bark', circleShape(1, 9), path, { scale: (t) => tr * (1 + 1.1 * Math.pow(1 - t, 7)) * (1 - 0.35 * t), uAround: 0.7 }); M.aoFn = null;
  const top = [lx * 1.6, th, lz * 1.6];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + R(), d = r * 0.6; M.tube('bark', tr * 0.45, [[top[0], th * 0.9, top[2]], [top[0] + Math.cos(a) * d * 0.5, th + 0.8, top[2] + Math.sin(a) * d * 0.5], [top[0] + Math.cos(a) * d, th + 1.1, top[2] + Math.sin(a) * d]], 5, { scale: (t) => 1 - t * 0.7 }); }
  M.restore();
  M.save().cls = 0;
  const crown = [top[0], th + 1.2, top[2], 1.2];
  for (let i = 0; i < 22; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r * 0.75; M.color(R.pick([[1, 1, 0.82], [0.92, 1, 0.78], [1, 0.98, 0.7]])); leafPatch(M, 'leafB', HERB.linden, [top[0] + Math.cos(a) * d, th + 0.5 + R() * 1.4, top[2] + Math.sin(a) * d], [R.range(-0.4, 0.4), 1, R.range(-0.4, 0.4)], R.range(1.5, 2.3), R() * TAU, { crown, w: [0.5, 0.5, 0.5, 0.5], ao: [0.9, 0.9, 0.9, 0.9] }); }
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + R() * 0.2, d = r * R.range(0.55, 1.1), y1 = th + R.range(0.2, 1.2), len = R.range(2.2, 3.4) + (h - 7) * 0.2, wd = R.range(1.0, 1.5);
    const c = [top[0] + Math.cos(a) * d, y1, top[2] + Math.sin(a) * d], tx = -Math.sin(a) * wd / 2, tz = Math.cos(a) * wd / 2;
    M.color(R.pick([[1, 1, 0.85], [0.9, 1, 0.8], [1, 0.97, 0.78]]));
    leafQuad(M, 'leafB', [[c[0] - tx, y1 - len, c[2] - tz], [c[0] + tx, y1 - len, c[2] + tz], [c[0] + tx, y1, c[2] + tz], [c[0] - tx, y1, c[2] - tz]], HERB.willow, { up: 0.75, w: [1, 1, 0, 0], ao: [1, 1, 0.55, 0.55] });
  }
  M.restore();
  M.occ(top[0] - r * 0.7, top[0] + r * 0.7, 1.2, th + 2, top[2] - r * 0.7, top[2] + r * 0.7, 0.5);
  M.col(-tr * 0.8, tr * 0.8, 0, th + 0.6, -tr * 0.8, tr * 0.8, 'wood');
});

/* ---------- Palmiers, fougères arborescentes, bananiers, bambous ---------- */
/* Palmier vert : stipe annelé et courbe, couronne de palmes en V qui retombent. kind : 'palm' ou 'palm2' (sprite) */
PF.palmG = (h = 6, seed = 1, kind = 'palm') => prefab(`palmg_${h}_${seed}_${kind}`, (M) => {
  const R = rngOf(seed * 71 + 5), lean = R.range(0.25, 1.0), ld = R() * TAU, lx = Math.cos(ld) * lean, lz = Math.sin(ld) * lean, path = [], N = 20;
  for (let i = 0; i <= N; i++) { const t = i / N; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.7, 0.68, 0.58]).local(1); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 1.5, y));
  M.sweep('bark', circleShape(1, 8), path, { scale: (t) => (0.17 - 0.05 * t) * (1 + 0.09 * Math.abs(Math.sin(t * h * Math.PI / 0.3))), uAround: 0.6 });
  M.save().move(0, -0.05, 0); M.cyl('bark', 0.3, 0.3, 8, { r1: 0.18 }); M.restore(); M.aoFn = null;
  const top = [lx, h, lz]; M.save().move(top[0], h - 0.4, top[2]); M.color([0.5, 0.42, 0.28]); M.cyl('bark', 0.17, 0.5, 8, { r1: 0.2 }); M.restore();
  M.restore();
  const n = kind === 'palm2' ? 11 : 15;
  M.save().cls = 0;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU * 2.4 + R() * 0.4, tier = i % 3, e0 = tier === 0 ? R.range(1.0, 1.25) : tier === 1 ? R.range(0.45, 0.7) : R.range(0.05, 0.3), L = R.range(2.6, 3.4) - (tier === 0 ? 0.7 : 0);
    const pts = frondPath(L, e0, tier === 0 ? 0.5 : 1.1, az, 6, [top[0], top[1] - 0.05, top[2]]);
    M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
    palmStrip(M, 'leafA', HERB[kind], pts, (t) => (0.55 + 0.3 * Math.sin(Math.min(1, t * 1.2 + 0.1) * Math.PI)) * (kind === 'palm2' ? 1.1 : 1), 0.62);
  }
  M.restore();
  M.occ(top[0] - 2.4, top[0] + 2.4, h - 0.8, h + 0.7, top[2] - 2.4, top[2] + 2.4, 0.35);
  M.col(-0.2, 0.2, 0, h * 0.7, -0.2, 0.2, 'wood');
});
/* Fougère arborescente : stipe fibreux brun, couronne dense de grandes frondes */
PF.treeFern = (h = 2.4, seed = 1) => prefab(`treefern_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 53 + 9), path = [], N = 10, lx = R.range(-0.25, 0.25), lz = R.range(-0.25, 0.25);
  for (let i = 0; i <= N; i++) { const t = i / N; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.62, 0.46, 0.3]).local(1); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 1.2, y));
  M.sweep('bark', circleShape(1, 8), path, { scale: (t) => 0.13 * (1 + 0.5 * Math.pow(1 - t, 4)) * (1 + 0.06 * Math.sin(t * 40)), uAround: 0.6 }); M.aoFn = null;
  for (let i = 0; i < 16; i++) { const a = R() * TAU, y = R.range(0.25, h * 0.9); M.tube('bark', 0.012, [[lx * (y / h) ** 2, y, lz * (y / h) ** 2], [lx * (y / h) ** 2 + Math.cos(a) * 0.2, y - 0.1, lz * (y / h) ** 2 + Math.sin(a) * 0.2]], 4); }
  M.restore();
  const top = [lx, h, lz]; M.save().cls = 2;
  const n = 17;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + R() * 0.3, tier = i % 3, e0 = tier === 0 ? R.range(1.0, 1.3) : tier === 1 ? R.range(0.5, 0.8) : R.range(0.1, 0.35), L = R.range(1.7, 2.5) * (tier === 0 ? 0.8 : 1);
    M.color([R.range(0.8, 1), R.range(0.9, 1), R.range(0.75, 0.95)]);
    frondStrip(M, 'leafA', HERB.treefern, frondPath(L, e0, tier === 0 ? 0.6 : 1.0, az, 5, top), (t) => L * 0.26 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.1 + 0.2) * 3.14)), R.range(0.1, 0.6), { w0: 0.1, wp: 1.1 });
  }
  M.restore();
  M.col(-0.17, 0.17, 0, h, -0.17, 0.17, 'wood');
});
/* Bananier : faux tronc vert, grandes feuilles déchirées qui retombent */
PF.banana = (h = 3.2, seed = 1) => prefab(`banana_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 29 + 3), lx = R.range(-0.2, 0.2), lz = R.range(-0.2, 0.2), path = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.52, 0.62, 0.28]).local(1); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 1.2, y));
  M.sweep('bark', circleShape(1, 9), path, { scale: (t) => 0.13 * (1.15 - 0.4 * t), uAround: 0.5 }); M.aoFn = null; M.restore();
  const top = [lx, h, lz]; M.save().cls = 0;
  for (let i = 0; i < 9; i++) {
    const az = (i / 9) * TAU * 1.9 + R() * 0.4, e0 = R.range(0.55, 1.2), L = R.range(2.2, 3.0);
    M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
    frondStrip(M, 'leafA', HERB.banana, frondPath(L, e0, R.range(0.5, 1.4), az, 6, [top[0], top[1] - 0.1 - i * 0.04, top[2]]), (t) => L * 0.21 * (0.6 + 0.4 * Math.sin(Math.min(1, t * 1.15 + 0.1) * Math.PI)), R.range(0.0, 0.5), { w0: 0.1, wp: 1.0 });
  }
  M.restore();
  M.col(-0.14, 0.14, 0, h * 0.9, -0.14, 0.14, 'wood');
});
/* Touffe de bambous : chaumes lisses annelés, branches et feuilles retombantes. n chaumes, h hauteur */
PF.bamboo = (n = 7, h = 7.5, seed = 1) => prefab(`bamboo_${n}_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 43 + 11), cull = [];
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 0.55, ox = Math.cos(a) * d, oz = Math.sin(a) * d, hh = h * R.range(0.7, 1.1), lean = R.range(0.1, 0.5), la = R() * TAU, r = R.range(0.028, 0.048);
    const P = []; for (let k = 0; k <= 14; k++) { const t = k / 14; P.push([ox + Math.cos(la) * lean * t * t * hh * 0.18, t * hh, oz + Math.sin(la) * lean * t * t * hh * 0.18]); }
    M.save().color([R.range(0.78, 0.95), R.range(0.9, 1), R.range(0.5, 0.7)]).local(1); M.aoFn = (x, y) => lerp(0.7, 1, smoothstep(0, 1.2, y)); M.swFn = (x, y) => Math.pow(clamp((y - hh * 0.35) / (hh * 0.65), 0, 1), 2) * 0.55;
    M.tube('cane', r, P, 6, { scale: (t) => 1 - 0.35 * t + 0.14 * Math.pow(Math.abs(Math.sin(t * hh * 3.0)), 8), uAround: 0.5 });
    M.aoFn = null; M.swFn = null; M.restore();
    cull.push({ P, hh });
    // bouquets de feuilles le long du tiers supérieur
    M.save().cls = 0;
    for (let k = 0; k < 8; k++) {
      const t = R.range(0.5, 1.0), pk = P[Math.min(14, Math.round(t * 14))], s = R.range(1.0, 1.6) * (1.1 - t * 0.2), aa = R() * TAU;
      M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.78, 0.95)]);
      leafPatch(M, 'leafB', HERB.bamboo, [pk[0] + Math.cos(aa) * 0.3, pk[1] - 0.1, pk[2] + Math.sin(aa) * 0.3], [Math.cos(aa) * 0.4, 0.9, Math.sin(aa) * 0.4], s, R() * TAU, { up: 0.7, w: [0.6, 0.6, 0.6, 0.6], ao: [0.75, 0.75, 0.75, 0.75] });
    }
    M.restore();
  }
  M.occ(-1.8, 1.8, h * 0.5, h * 1.1, -1.8, 1.8, 0.4);
  M.col(-0.3, 0.3, 0, h * 0.8, -0.3, 0.3, 'wood');
});

/* ---------- Plantes de sous-bois et massifs ---------- */
/* Fougère au sol : une dizaine de frondes qui retombent. kind : 'fernA', 'fernB', 'fernC', 'treefern' (sprites A) */
PF.fern = (kind = 'fernA', s = 1, seed = 1, n = 9) => prefab(`fern_${kind}_${s}_${seed}_${n}`, (M) => {
  const R = rngOf(seed * 37 + 17); M.save().cls = 2;
  const base = { fernA: 0.95, fernB: 0.8, fernC: 0.9, treefern: 1.3 }[kind] || 1, lw = { fernA: 0.26, fernB: 0.28, fernC: 0.3, treefern: 0.27 }[kind] || 0.26;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + R() * 0.5, e0 = R.range(0.5, 1.15), L = base * s * R.range(0.65, 1.1);
    M.color([R.range(0.82, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
    frondStrip(M, 'leafA', HERB[kind], frondPath(L, e0, R.range(0.2, 1.0), az, 4), (t) => L * lw * (0.5 + 0.5 * Math.sin(Math.min(1, t * 1.1 + 0.2) * 3.14)), R.range(0.15, 0.85), { w0: 0.05, wp: 1.1 });
  }
  M.restore();
});
/* Rosette de grandes feuilles dressées (monstera, alocasia, philodendron, bananier nain, calathea, hosta...) : n cartes inclinées vers l'extérieur */
PF.rosette = (kind = 'monstera', atlas = 'leafA', size = 1, n = 6, seed = 1, o = {}) => prefab(`rosette_${kind}_${size}_${n}_${seed}_${o.lean || 0}_${o.aspect || 1}`, (M) => {
  const R = rngOf(seed * 41 + 19), reg = HERB[kind], asp = o.aspect || 1; M.save().cls = o.cls !== undefined ? o.cls : 2;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + R() * 0.6, lean = (o.lean || 0.5) * R.range(0.5, 1.3), sz = size * R.range(0.75, 1.15), d = R.range(0.0, o.spread || 0.15);
    const cx = Math.cos(az) * d, cz = Math.sin(az) * d, tx = -Math.sin(az), tz = Math.cos(az), hw = sz * asp / 2, out = [Math.cos(az), 0, Math.sin(az)];
    const topC = [cx + out[0] * Math.sin(lean) * sz, Math.cos(lean) * sz, cz + out[2] * Math.sin(lean) * sz];
    M.color(o.tint ? o.tint : [R.range(0.86, 1), R.range(0.92, 1), R.range(0.82, 0.96)]);
    leafQuad(M, atlas, [[cx - tx * hw, 0, cz - tz * hw], [cx + tx * hw, 0, cz + tz * hw], [topC[0] + tx * hw, topC[1], topC[2] + tz * hw], [topC[0] - tx * hw, topC[1], topC[2] - tz * hw]], reg, { up: 0.55, w: [0.0, 0.0, 1, 1], ao: [0.55, 0.55, 1, 1] });
  }
  M.restore();
});
/* Touffe de cartes croisées (fleurs, herbes, lavande, tulipes...) : n cartes verticales de largeur w et hauteur h autour de l'axe */
PF.clump = (kind = 'grass', atlas = 'leafB', w = 0.7, h = 0.6, n = 3, seed = 1, o = {}) => prefab(`clump_${kind}_${atlas}_${w}_${h}_${n}_${seed}_${o.cls === undefined ? 2 : o.cls}`, (M) => {
  const R = rngOf(seed * 47 + 23), reg = HERB[kind], a0 = R() * Math.PI; M.save().cls = o.cls !== undefined ? o.cls : 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI, c = Math.cos(a) * w / 2, s = Math.sin(a) * w / 2, fl = o.flare || 0.12 * h, fc = Math.cos(a) * fl, fs = Math.sin(a) * fl;
    M.color(o.tint || [R.range(0.88, 1), R.range(0.92, 1), R.range(0.86, 1)]);
    leafQuad(M, atlas, [[-c, -0.02, -s], [c, -0.02, s], [c + fc, h, s + fs], [-c - fc, h, -s - fs]], reg, { up: 0.55, w: [0, 0, 1, 1], ao: [0.6, 0.6, 1, 1] });
  }
  M.restore();
});
/* Liane qui pend (sprite A, accrochée en haut) : carte verticale de largeur w, hauteur h, du sol y = 0 au point d'accroche y = h */
PF.liana = (w = 1.4, h = 2.6, seed = 1) => prefab(`liana_${w}_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 61 + 29); M.save().cls = 2; M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
  leafQuad(M, 'leafA', [[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0]], HERB.liana, { up: 0.5, w: [1, 1, 0, 0], ao: [0.8, 0.8, 1, 1] });
  M.restore();
});
/* Lierre ou glycine plaqués : même principe, pendant d'un support horizontal (sprite B) */
PF.hanging = (kind = 'wisteria', w = 1.0, h = 2.4, seed = 1) => prefab(`hanging_${kind}_${w}_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 67 + 31); M.save().cls = 2; M.color([R.range(0.88, 1), R.range(0.92, 1), R.range(0.86, 1)]);
  leafQuad(M, 'leafB', [[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0]], HERB[kind], { up: 0.5, w: [1, 1, 0.05, 0.05], ao: [0.85, 0.85, 1, 1] });
  M.restore();
});
/* Roseaux, papyrus, quenouilles : cartes croisées hautes */
PF.reeds = (h = 2.0, seed = 1) => prefab(`reeds_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 59 + 37); M.save().cls = 2;
  for (let i = 0; i < 3; i++) {
    const a = i * 1.05 + R() * 0.4, w = h * 0.55, c = Math.cos(a) * w / 2, s = Math.sin(a) * w / 2, hh = h * R.range(0.85, 1.1);
    M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
    leafQuad(M, 'leafB', [[-c, 0, -s], [c, 0, s], [c, hh, s], [-c, hh, -s]], HERB.reed, { up: 0.5, w: [0, 0, 1, 1], ao: [0.6, 0.6, 1, 1] });
  }
  M.restore();
});
PF.papyrus = (h = 2.4, seed = 1) => prefab(`papyrus_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 73 + 41); M.save().cls = 2;
  for (let i = 0; i < 3; i++) {
    const a = i * 1.05 + R() * 0.4, w = h * 1.1, c = Math.cos(a) * w / 2, s = Math.sin(a) * w / 2, hh = h * R.range(0.85, 1.1);
    M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
    leafQuad(M, 'leafA', [[-c, 0, -s], [c, 0, s], [c, hh, s], [-c, hh, -s]], HERB.papyrus, { up: 0.5, w: [0, 0, 1, 1], ao: [0.6, 0.6, 1, 1] });
  }
  M.restore();
});
/* Nénuphars : feuilles à plat posées sur l'eau (sprite A, case 2 x 2 : grandes feuilles et fleurs), n cartes dans un rayon r */
PF.lilies = (r = 2, n = 9, seed = 1, flowers = 0.35) => prefab(`lilies_${r}_${n}_${seed}_${flowers}`, (M) => {
  const R = rngOf(seed * 83 + 43), L = HERB.lily; M.save().cls = 2;
  // quarts du sprite : en haut à gauche une feuille fleurie, en haut à droite une grande feuille, en bas à gauche une petite, en bas à droite un lotus sur sa feuille
  const sub = [[0.5, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0, 0, 0.5, 0.5]];
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * r, sz = R.range(0.55, 1.0), sb = sub[Math.floor(R() * sub.length)];
    M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]);
    leafPatch(M, 'leafA', [L[0] + sb[0] * L[2], L[1] + sb[1] * L[3], sb[2] * L[2], sb[3] * L[3]], [Math.cos(a) * d, 0.03 + (i % 3) * 0.004, Math.sin(a) * d], [0, 1, 0], sz, R() * TAU, { up: 1, w: [0.04, 0.04, 0.04, 0.04], ao: [1, 1, 1, 1] });
  }
  const nf = Math.round(n * flowers);
  for (let i = 0; i < nf; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * r * 0.9, sz = R.range(0.38, 0.55), k = R() < 0.5 ? [0.5, 0.5, 0.5, 0.5] : [0.4, 0.44, 0.17, 0.17];
    M.color([1, 1, 1]);
    leafPatch(M, 'leafA', [L[0] + k[0] * L[2], L[1] + k[1] * L[3], k[2] * L[2], k[3] * L[3]], [Math.cos(a) * d, 0.07, Math.sin(a) * d], [0, 1, 0], sz, R() * TAU, { up: 1, w: [0, 0, 0, 0], ao: [1, 1, 1, 1] });
  }
  M.restore();
});
