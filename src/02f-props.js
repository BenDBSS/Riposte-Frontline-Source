/* ==========================================================================
   ACCESSOIRES : prefabs réutilisables (construits une fois, estampillés partout). Chacun est modélisé en
   coordonnées locales, posé sur y = 0, face principale vers +z ; ses collisions éventuelles sont décrites
   dans le prefab. Les prefabs « teintables » reçoivent la couleur de l'instance (option tint de M.put).
   Mobilier urbain, objets de chantier et d'entrepôt, équipements de toit.
   ========================================================================== */
const PF = {};
const _pm = new THREE.Matrix4();
/* Repère de base : colonnes (ex, ey, ez), utile pour extruder un profil dans un autre plan */
function basis(ex, ey, ez) { return _pm.clone().makeBasis(new V3(...ex), new V3(...ey), new V3(...ez)); }

/* ---------- Caisses, palettes, fûts ---------- */
/* Caisse en planches : panneaux, tasseaux sur les arêtes, écharpes en diagonale */
PF.crate = (s = 1.1) => prefab('crate' + s.toFixed(2), (M, P) => {
  P.tintable = ['crate'];
  const h = s / 2, b = Math.min(0.08, s * 0.08), t = 0.022;
  M.local(1); M.uvS = s / TEXSCALE.crate;
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0, 0.35, y));
  M.save().move(0, t, 0); M.box('crate', s - t * 2, s - t * 2, s - t * 2); M.restore();
  M.uvS = 1;
  // montants d'angle chanfreinés (ils portent l'ombre) ; traverses et écharpes sans ombre portée
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('crate', sx > 0 ? h - b : -h, sx > 0 ? h : -h + b, 0, s, sz > 0 ? h - b : -h, sz > 0 ? h : -h + b, { bevel: 0.01 });
  M.cls = 1;
  for (const y of [0, s - b]) for (const sz of [-1, 1]) { M.boxB('crate', -h + b, h - b, y, y + b, sz > 0 ? h - b : -h, sz > 0 ? h : -h + b, { skip: 'yY' }); M.boxB('crate', sz > 0 ? h - b : -h, sz > 0 ? h : -h + b, y, y + b, -h + b, h - b, { skip: 'yY' }); }
  // écharpes sur les quatre côtés
  const L = hyp(s - 2 * b, s - 2 * b), ang = Math.atan2(s - 2 * b, s - 2 * b);
  for (const [ry, off] of [[0, h], [Math.PI, h], [Math.PI / 2, h], [-Math.PI / 2, h]]) {
    M.save().rotY(ry).move(0, h, off - t / 2).rotZ(ang).move(0, -b * 0.4, 0); M.box('crate', L - 0.05, b * 0.8, t * 1.4, { skip: 'z' }); M.restore();
  }
  M.cls = 0;
  M.col(-h, h, 0, s, -h, h, 'wood');
});
/* Palette en bois (1,2 x 0,8) */
PF.pallet = () => prefab('pallet', (M) => {
  M.color([0.85, 0.75, 0.6]).local(1);
  for (const x of [-0.55, 0, 0.55]) M.boxB('crate', x - 0.05, x + 0.05, 0, 0.1, -0.4, 0.4);
  for (let i = 0; i < 7; i++) { const z = -0.4 + 0.06 + (i * (0.8 - 0.12)) / 6; M.boxB('crate', -0.6, 0.6, 0.1, 0.122, z - 0.05, z + 0.05); }
  for (const z of [-0.36, 0, 0.36]) M.boxB('crate', -0.6, 0.6, 0.0, 0.022, z - 0.05, z + 0.05); // planches du dessous posées sur le sol, pas dedans (leur dessus scintillait avec lui)
});
/* Fût métallique de 200 L : cerclages de roulement, bondes */
PF.barrel = () => prefab('barrel', (M, P) => {
  P.tintable = ['paint'];
  M.local(1);
  const pr = [[0, 0.005], [0.27, 0.005], [0.287, 0.012], [0.287, 0.035], [0.279, 0.045], [0.279, 0.285], [0.29, 0.295], [0.29, 0.315], [0.279, 0.325], [0.279, 0.555], [0.29, 0.565], [0.29, 0.585], [0.279, 0.595], [0.279, 0.835], [0.287, 0.845], [0.287, 0.875], [0.272, 0.882], [0.262, 0.866], [0, 0.866]];
  M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 0.3, y));
  M.lathe('paint', pr, 18, { sharp: 0.9, uR: 0.29 });
  M.aoFn = null; M.color([0.5, 0.5, 0.48]);
  for (const [x, r] of [[0.16, 0.035], [-0.14, 0.025]]) { M.save().move(x, 0.866, 0.05); M.cyl('steel', r, 0.018, 8); M.restore(); }
  M.col(-0.3, 0.3, 0, 0.9, -0.3, 0.3, 'metal');
});
/* Jerrican (20 L, modèle militaire d'après photos) : caisse à bords arrondis, X emboutis sur les flancs, cordon de soudure tout autour,
   trois poignées en travers du dessus, bec et bouchon à levier sur l'avant */
PF.jerrycan = () => prefab('jerrycan', (M, P) => {
  P.tintable = ['paint'];
  M.local(1);
  M.boxB('paint', -0.08, 0.08, 0, 0.44, -0.17, 0.17, { bevel: 0.025 });
  M.boxB('paint', -0.007, 0.007, -0.002, 0.446, -0.176, 0.176, { bevel: 0.004 }); // cordon de soudure
  const a = Math.atan2(0.13, 0.17); // diagonales du flanc, à 4 cm des bords
  for (const sd of [-1, 1]) for (const r of [a, -a]) { M.save().move(sd * 0.08, 0.22, 0).rotX(r); M.boxB('paint', -0.005, 0.005, -0.19, 0.19, -0.016, 0.016, { bevel: 0.004 }); M.restore(); }
  M.color([0.82, 0.82, 0.8]);
  for (const z of [-0.075, 0, 0.075]) M.tube('paint', 0.009, [[-0.055, 0.438, z], [-0.05, 0.488, z], [0.05, 0.488, z], [0.055, 0.438, z]], 5);
  M.save().move(0, 0.43, 0.135).rotX(0.35); M.cyl('paint', 0.024, 0.045, 10); M.color([0.3, 0.3, 0.28]); M.save().move(0, 0.045, 0); M.cyl('steel', 0.028, 0.02, 10); M.restore(); M.boxB('steel', -0.008, 0.008, 0.02, 0.07, -0.06, -0.02); M.restore();
});
/* Bouteille de gaz butane (bleue ou orange) */
PF.gasBottle = () => prefab('gasBottle', (M, P) => {
  P.tintable = ['paint'];
  M.local(1);
  M.lathe('paint', [[0, 0], [0.12, 0], [0.145, 0.03], [0.15, 0.08], [0.15, 0.42], [0.13, 0.5], [0.07, 0.55], [0, 0.56]], 14, { uR: 0.15 });
  M.color([0.55, 0.55, 0.52]);
  M.lathe('steel', [[0.035, 0.55], [0.035, 0.62], [0.09, 0.64], [0.09, 0.66], [0.03, 0.66], [0.03, 0.64]], 10, { sharp: 0.3 });
});
/* Carton de déménagement */
PF.cardboard = (w = 0.5, h = 0.4, d = 0.4) => prefab(`card${w}${h}${d}`, (M) => {
  M.color([1, 1, 1]).local(1);
  M.boxB('cardboard', -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.008 });
  M.color([0.85, 0.75, 0.55]); M.boxB('plastic', -0.035, 0.035, h, h + 0.002, -d / 2 - 0.002, d / 2 + 0.002);
});
/* Sac-poubelle */
PF.trashBag = () => prefab('trashBag', (M) => {
  M.color([0.05, 0.05, 0.055]);
  M.surf('plastic', 10, 7, (u, v) => {
    const a = u * TAU, ph = (v - 0.5) * Math.PI, r = Math.cos(ph) * (0.24 + 0.03 * Math.sin(a * 3 + v * 5)), y = (Math.sin(ph) * 0.5 + 0.5) * 0.5;
    const pinch = v > 0.85 ? 1 - (v - 0.85) * 4 : 1;
    return [Math.cos(a) * r * pinch, y + (v > 0.9 ? (v - 0.9) * 0.8 : 0), Math.sin(a) * r * pinch * 0.85];
  }, { closeU: true, flipN: true });
});
/* Parpaings empilés */
PF.blocks = () => prefab('blocks', (M) => {
  M.color([0.82, 0.8, 0.76]).local(1);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - (r === 2 ? 1 : 0); i++) {
    const x = -0.42 + i * 0.42 + (r % 2) * 0.21 * 0; M.boxB('concrete', x - 0.2, x + 0.2, r * 0.2, r * 0.2 + 0.195, -0.1, 0.1, { bevel: 0.006 });
  }
  M.col(-0.62, 0.62, 0, 0.6, -0.1, 0.1, 'concrete');
});
/* Touret de câble : deux flasques de planches serrées par des tiges filetées, moyeu percé, câble enroulé en spires, bout libre */
PF.reel = () => prefab('reel', (M) => {
  M.color([0.8, 0.66, 0.46]).local(1);
  for (const x of [-0.35, 0.35]) {
    M.save().move(x, 0.55, 0).rotZ(Math.PI / 2).move(0, -0.035, 0); M.cyl('crate', 0.55, 0.07, 28, { uR: 0.5 }); M.restore();
    M.color([0.25, 0.22, 0.2]); M.save().move(x + Math.sign(x) * 0.036, 0.55, 0).rotZ(Math.PI / 2).move(0, -0.004, 0); M.cyl('steel', 0.09, 0.008, 16); M.restore();
    M.color([0.05, 0.05, 0.05]); M.save().move(x + Math.sign(x) * 0.041, 0.55, 0).rotZ(Math.PI / 2).move(0, -0.002, 0); M.cyl('dark', 0.04, 0.004, 12); M.restore();
    M.color([0.8, 0.66, 0.46]);
  }
  M.color([0.3, 0.28, 0.25]); M.cls = 2;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU, y = 0.55 + Math.sin(a) * 0.2, z = Math.cos(a) * 0.2; M.tube('steel', 0.012, [[-0.4, y, z], [0.4, y, z]], 5); }
  M.cls = 0; M.color([0.12, 0.12, 0.12]);
  // spires : profil ondulé tourné autour de l'axe
  const prof = []; for (let i = 0; i <= 20; i++) { const y = lerp(-0.31, 0.31, i / 20); prof.push([0.36 + 0.012 * Math.abs(Math.sin((i / 20) * Math.PI * 10)), y]); }
  M.save().move(0, 0.55, 0).rotZ(-Math.PI / 2); M.lathe('rubber', prof, 24, { uR: 0.36 }); M.restore();
  M.tube('rubber', 0.022, [[0.2, 0.55 + 0.37, 0.05], [0.25, 0.72, 0.42], [0.3, 0.12, 0.62], [0.4, 0.02, 0.9]], 6);
  M.col(-0.4, 0.4, 0, 1.1, -0.55, 0.55, 'wood');
});

/* ---------- Défenses : sacs de sable, murets jersey ---------- */
/* Sac de sable : coussin de jute rempli, dessous aplati par le poids, dessus bombé, flancs gonflés ; le bout ouvert (+x) est replié et
   noué (la toile se resserre, deux oreilles, le lien), l'autre bout cousu se pince à peine. Il tient dans sa boîte de collision
   (2L x 2H x 2W) : le corps s'arrête 2,5 cm avant le bout, que le nœud occupe. nu x nv : finesse de la toile (un mur en compte des
   centaines, et chacun est dessiné aussi dans les ombres) */
function sandbagShape(M, L, Wd, H, nu = 10, nv = 6) {
  const Lb = L - 0.025;
  M.surf('burlap', nu, nv, (u, v) => {
    const th = u * TAU, ph = (v - 0.5) * Math.PI, c = Math.cos(ph), sp = Math.sin(ph), cx = Math.cos(th) * c, cz = Math.sin(th) * c;
    const x = Math.sign(cx) * Math.pow(Math.abs(cx), 0.3) * Lb, ex = Math.abs(x) / Lb, tied = x > 0;
    const pinch = 1 - (tied ? 0.5 : 0.22) * Math.pow(ex, 4);
    const y = H + (sp >= 0 ? Math.pow(sp, 0.55) * H * pinch : -Math.pow(-sp, 0.22) * H * (1 - 0.1 * Math.pow(ex, 4)));
    const z = Math.sign(cz) * Math.pow(Math.abs(cz), 0.38) * Wd * (0.9 + 0.1 * pinch) * (tied ? 1 - 0.3 * Math.pow(ex, 6) : 1) * (1 - 0.06 * (1 - Math.abs(sp)) * ex);
    return [x, y, z];
  }, { closeU: true, flipN: true, uL: 2.8, vL: 1.5, pole: (v) => [0, v < 0.5 ? -1 : 1, 0], ao: (u, v) => (v < 0.28 ? 0.62 : 1) });
  // bout replié et noué : le col de toile, deux oreilles, le lien
  M.save().move(Lb - 0.02, H * 1.05, 0).rotZ(-Math.PI / 2); M.cyl('burlap', H * 0.38, 0.045, 5, { r1: H * 0.22, caps: 't' }); M.restore();
  for (const sd of [-1, 1]) { M.save().move(Lb - 0.03, H * 1.02, sd * Wd * 0.55).rotY(sd * 0.5).rotZ(-1.2); M.cyl('burlap', 0.022, 0.06, 3, { r1: 0.006, caps: '' }); M.restore(); }
  M.color([0.42, 0.34, 0.24]); M.save().move(Lb + 0.008, H * 1.05, 0).rotZ(Math.PI / 2); M.cyl('burlap', H * 0.27, 0.014, 5, { caps: '' }); M.restore();
}
/* Sac de sable bas du décor (58 x 15 x 33 cm) */
PF.sandbag = () => prefab('sandbag', (M, P) => { P.tintable = ['burlap']; M.local(1); sandbagShape(M, 0.29, 0.165, 0.075); });
/* Sac de sable des murs (physique) : plus épais que celui du décor (22 x 60 x 40 cm), pour que les rangs se touchent ; sa collision
   est la boîte qu'il occupe et suit le sac quand il tombe */
PF.sandbagFat = () => prefab('sandbagFat', (M, P) => {
  P.tintable = ['burlap']; M.local(1); sandbagShape(M, 0.3, 0.2, 0.11);
  M.col(-0.29, 0.29, 0, 0.22, -0.19, 0.19, 'dirt');
});
/* Demi-sac (30 x 22 x 40 cm) : sac à moitié rempli, replié, qui ferme le bout d'un rang décalé */
PF.sandbagHalf = () => prefab('sandbagHalf', (M, P) => {
  P.tintable = ['burlap']; M.local(1); sandbagShape(M, 0.15, 0.2, 0.11, 8, 5);
  M.col(-0.14, 0.14, 0, 0.22, -0.19, 0.19, 'dirt');
});
/* ---------- Murs de sacs de sable : un prop physique par sac (voir « Props physiques » du README) ----------
   Appareil à joints décalés : chaque sac repose à cheval sur deux sacs du rang du dessous. Un rang sur deux est décalé d'un demi-sac ; ses deux
   bouts sont fermés par un demi-sac (sandbagHalves), sinon le sac au bout du rang du dessus dépasserait d'un demi-sac dans le vide et ne
   tiendrait pas. Variante en pyramide (taper) : chaque rang est en retrait d'un demi-sac à chaque bout sur celui du dessous. */
/* Teintes de base (sRGB) : jute naturelle, jute claire du désert, toile kaki et olive, polypropylène blanc ; chaque sac s'en écarte un peu */
const SANDBAG_TINT = { jute: [0.88, 0.82, 0.72], sable: [0.9, 0.82, 0.68], kaki: [0.58, 0.58, 0.44], olive: [0.45, 0.48, 0.35], blanc: [0.92, 0.92, 0.9] };
function sandbagTint(c, R) { const k = 0.92 + R() * 0.1; return [c[0] * k * (0.97 + R() * 0.05), c[1] * k, c[2] * k * (0.96 + R() * 0.06)]; }
/* Les deux demi-sacs qui ferment un rang décalé d'un mur droit : centre (cx, cz), longueur len, sens (dx, dz) (le bout 0 est du côté -, comme
   le premier sac plein), sol y(x, z), échelle k, bout noué vers l'extérieur. skip : [bout 0, bout 1] à ne pas poser (usure), gone(x, z, type)
   est appelé pour chacun. Teinte tirée de R, un tirage propre au mur, pour ne pas décaler la suite du décor */
function sandbagHalves(cx, cz, len, dx, dz, y, k, c, R, skip, gone) {
  for (const e of [0, 1]) {
    const sd = e ? 1 : -1, a = sd * (len / 2 - 0.15 * k), x = cx + dx * a, z = cz + dz * a, tint = sandbagTint(c, R);
    if (skip && skip[e]) { if (gone) gone(x, z, 'sandbagHalf'); continue; }
    DECOR.dyn('sandbagHalf', x, y(x, z), z, Math.atan2(-sd * dz, sd * dx), { s: k, tint });
  }
}
/* Usure d'un mur : le rang du haut n'est jamais complet. Ce sont surtout ses bouts qui partent (un coin, ou les deux) ; parfois aussi un sac du
   milieu d'un long mur, jamais à côté d'un sac déjà parti. Sous un bout parti, le demi-sac du rang décalé du dessous part parfois (coin écorné en
   escalier). Rien ne reposait sur ce qui manque : le reste du mur tient. cnt : sacs pleins du rang du haut ; topOdd : rang du haut décalé
   (ses bouts sont des demi-sacs) ; lowOdd : rang du dessous décalé ; W : tirage propre au mur. Rend { gone : sacs pleins du haut partis
   (Set), half : demi-sacs du haut partis [bout 0, bout 1], low : demi-sacs du rang du dessous partis } */
function sandbagWear(cnt, topOdd, lowOdd, W) {
  const gone = new Set(), half = [false, false], low = [false, false], ends = [W() < 0.65, W() < 0.65];
  if (!ends[0] && !ends[1]) ends[W() < 0.5 ? 0 : 1] = true;
  for (const e of [0, 1]) {
    if (!ends[e]) continue;
    if (topOdd) { half[e] = true; if (cnt > 2 && W() < 0.45) gone.add(e ? cnt - 1 : 0); }
    else { gone.add(e ? cnt - 1 : 0); if (lowOdd && W() < 0.4) low[e] = true; }
  }
  if (cnt >= 6 && W() < 0.3) { const i = 1 + Math.floor(W() * (cnt - 2)); if (![i - 1, i, i + 1].some((q) => gone.has(q))) gone.add(i); }
  return { gone, half, low };
}
/* Sac tombé du haut d'un mur : couché à plat au pied du mur, devant ou derrière (dx, dz : sens du mur, e : demi-épaisseur), un peu de travers,
   là où le sol est libre (aucune boîte à hauteur de sac, aucun autre sac tombé) ; une fois sur quatre, ou sans place libre, il n'est pas posé
   (il a roulé plus loin). type : 'sandbag' ou 'sandbagHalf' */
function sandbagFallen(x, z, dx, dz, e, rot, ground, k, c, W, list, type = 'sandbag') {
  const s0 = W() < 0.5 ? -1 : 1, nx = -dz, nz = dx;
  if (W() < 0.25) return;
  for (const sd of [s0, -s0]) {
    const d = e + 0.42 + W() * 0.2, t = (W() - 0.5) * 0.4, px = x + nx * sd * d + dx * t, pz = z + nz * sd * d + dz * t, y = ground(px, pz);
    if (list.some(([qx, qz]) => hyp(qx - px, qz - pz) < 0.8)) continue;
    if (COL.some((b) => !b.ray && b.y1 > y + 0.03 && b.y0 < y + 0.25 && px + 0.34 > b.x0 && px - 0.34 < b.x1 && pz + 0.34 > b.z0 && pz - 0.34 < b.z1)) continue;
    list.push([px, pz]);
    DECOR.dyn(type, px, y, pz, rot + (W() - 0.5) * 1.4, { s: k, tint: sandbagTint(c, W) });
    return;
  }
}
/* Mur droit centré en (cx, cz), long de len, orienté selon rot (comme DECOR.place : à rot = 0 le mur suit x). o : rows (rangs, 4), deep (1 ou
   2 sacs d'épaisseur ; à 2, le rang du haut n'en a qu'un, au milieu, posé sur les deux), taper (pyramide), color (clé de SANDBAG_TINT ou
   [r, g, b]), y (sol, ou ground(x, z) pour un relief), R (tirage ; par défaut SR.rng), wear (faux : rang du haut complet, sans sac tombé) */
function sandbagWall(cx, cz, len, rot = 0, o = {}) {
  const R = o.R || SR.rng, c = Array.isArray(o.color) ? o.color : SANDBAG_TINT[o.color || 'jute'], rows = o.rows || 4, deep = o.deep || 1;
  const n = Math.max(1, Math.round(len / 0.6)), step = len / n, k = step / 0.6, dx = Math.cos(rot), dz = -Math.sin(rot), ground = o.ground || (() => o.y || 0);
  const W = rngOf(Math.round(cx * 131 + cz * 17 + len * 7 + 77)), fallen = [], top = rows - 1, wear = o.wear !== false && !o.taper && rows > 1;
  // une usure par ligne (deux lignes côte à côte quand le mur est double) : celle du rang du haut et, sous lui, du rang décalé
  const wears = new Map(), wearOf = (t) => { if (!wears.has(t)) wears.set(t, sandbagWear(n - (top % 2), top % 2 === 1, (top - 1) % 2 === 1, W)); return wears.get(t); };
  const fall = (x, z, type) => sandbagFallen(x, z, dx, dz, deep > 1 ? 0.4 * k : 0.2 * k, rot, ground, k, c, W, fallen, type);
  for (let r = 0; r < rows; r++) {
    const odd = r % 2, inset = o.taper ? r * 0.5 : odd * 0.5, cnt = n - (o.taper ? r : odd), lines = deep > 1 && !(r === top && rows > 2) ? [-0.2 * k, 0.2 * k] : [0];
    if (cnt < 1) break;
    for (const t of lines) {
      const wr = wear && (r === top || r === top - 1) ? wearOf(r === top ? t : deep > 1 && rows > 2 ? 0 : t) : null;
      for (let i = 0; i < cnt; i++) {
        const a = -len / 2 + step * (i + 0.5 + inset), x = cx + dx * a - dz * t, z = cz + dz * a + dx * t, ry = rot + (R() - 0.5) * 0.06, tint = sandbagTint(c, R);
        if (wr && r === top && wr.gone.has(i)) { fall(x, z); continue; }
        DECOR.dyn('sandbag', x, ground(x, z) + r * 0.22 * k, z, ry, { s: k, tint });
      }
      if (odd && !o.taper) sandbagHalves(cx - dz * t, cz + dx * t, len, dx, dz, (x, z) => ground(x, z) + r * 0.22 * k, k, c, R, wr ? (r === top ? wr.half : wr.low) : null, fall);
    }
  }
}
/* Mur en arc de cercle : centre (cx, cz), rayon r (ligne médiane du mur), de l'angle a0 à a1 (point (cx + r cos a, cz + r sin a)) ; les sacs
   suivent la courbe, un rang sur deux décalé d'un demi-sac et fermé par deux demi-sacs. Leur longueur est réglée sur le bord intérieur de la
   courbe, où ils se touchent sans s'entrer (au bord extérieur, les joints s'ouvrent un peu). o : rows, color, ground, R, wear */
function sandbagArc(cx, cz, r, a0, a1, o = {}) {
  const R = o.R || SR.rng, c = Array.isArray(o.color) ? o.color : SANDBAG_TINT[o.color || 'jute'], rows = o.rows || 4, ground = o.ground || (() => o.y || 0);
  const n = Math.max(1, Math.round(Math.abs(a1 - a0) * r / 0.6)), da = (a1 - a0) / n, k = Math.abs(da) * (r - 0.2) / 0.6;
  const put = (t, a, y, half) => {
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, ry = Math.atan2(-Math.cos(a), -Math.sin(a));
    DECOR.dyn(half ? 'sandbagHalf' : 'sandbag', x, ground(x, z) + y, z, ry + (half ? ((t < 0) === (da > 0) ? Math.PI : 0) : (R() - 0.5) * 0.04), { s: k, tint: sandbagTint(c, R) }); // demi-sac : bout noué vers l'extérieur
  };
  const W = rngOf(Math.round(cx * 131 + cz * 17 + r * 7 + 91)), fallen = [], top = rows - 1;
  const wr = o.wear !== false && rows > 1 ? sandbagWear(n - (top % 2), top % 2 === 1, (top - 1) % 2 === 1, W) : null;
  const fall = (a, type) => sandbagFallen(cx + Math.cos(a) * r, cz + Math.sin(a) * r, -Math.sin(a), Math.cos(a), 0.2 * k, Math.atan2(-Math.cos(a), -Math.sin(a)), ground, k, c, W, fallen, type);
  for (let row = 0; row < rows; row++) {
    const odd = row % 2, y = row * 0.22 * k, skip = wr && row === top ? wr.half : wr && row === top - 1 ? wr.low : null;
    for (let i = 0; i < n - odd; i++) {
      const a = a0 + da * (i + 0.5 + odd * 0.5);
      if (wr && row === top && wr.gone.has(i)) { R(); sandbagTint(c, R); fall(a); continue; }
      put(0, a, y, false);
    }
    if (odd) for (const [e, a] of [[0, a0 + da * 0.25], [1, a1 - da * 0.25]]) { if (skip && skip[e]) fall(a, 'sandbagHalf'); else put(e ? 1 : -1, a, y, true); }
  }
}
/* Nid en fer à cheval : un mur de face (largeur w) et deux retours vers l'arrière (profondeur d), le tout tourné de rot autour de (cx, cz) ;
   l'abri est du côté +z local. o : rows (les retours ont un rang de moins), color, ground, R */
function sandbagU(cx, cz, w, d, rot = 0, o = {}) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const [fx, fz] = P(0, 0); sandbagWall(fx, fz, w, rot, o);
  for (const sd of [-1, 1]) { const [x, z] = P(sd * (w / 2 - 0.2), 0.2 + d / 2 + 0.02); sandbagWall(x, z, d - 0.04, rot + Math.PI / 2, Object.assign({}, o, { rows: Math.max(1, (o.rows || 4) - 1) })); }
}
/* Tas de sacs déchargés : trois rangs en pyramide sur len, et quelques sacs jetés autour, à plat sur le sol, chacun à l'écart des autres
   (deux sacs ne s'entrent pas). o : color, ground, R, seed */
function sandbagPile(cx, cz, len, rot = 0, o = {}) {
  const R = o.R || (o.seed ? rngOf(o.seed) : SR.rng), c = Array.isArray(o.color) ? o.color : SANDBAG_TINT[o.color || 'jute'], ground = o.ground || (() => o.y || 0);
  sandbagWall(cx, cz, len, rot, Object.assign({}, o, { R, rows: 3, taper: true, wear: false }));
  const cs = Math.cos(rot), sn = Math.sin(rot), put = [];
  for (let tries = 0; tries < 24 && put.length < 3; tries++) {
    const lx = (R() - 0.5) * len * 1.1, lz = (R() < 0.5 ? -1 : 1) * (0.62 + R() * 0.4), ry = R() * TAU;
    if (put.some(([px, pz]) => hyp(px - lx, pz - lz) < 0.75)) continue;
    put.push([lx, lz]);
    const x = cx + lx * cs + lz * sn, z = cz - lx * sn + lz * cs;
    DECOR.dyn('sandbag', x, ground(x, z), z, ry, { tint: sandbagTint(c, R) });
  }
}
/* Muret jersey en béton (profil en F), longueur len le long de z */
PF.jersey = (len) => prefab('jersey' + len.toFixed(2), (M) => {
  M.color([0.86, 0.84, 0.8]).local(1);
  const pr = [[-0.31, 0], [0.31, 0], [0.31, 0.075], [0.2, 0.3], [0.085, 0.8], [0.06, 0.87], [-0.06, 0.87], [-0.085, 0.8], [-0.2, 0.3], [-0.31, 0.075]];
  M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 0.25, y));
  M.save().move(0, 0, -len / 2 + 0.03); M.extrude('concrete', pr, len - 0.06, { sharp: 0.3 }); M.restore();
  // chanfreins d'extrémité et encoches de levage
  M.color([0.2, 0.2, 0.2]); M.aoFn = null;
  for (const z of [-len / 2 + 0.5, len / 2 - 0.5]) M.boxB('dark', -0.315, 0.315, 0, 0.1, z - 0.12, z + 0.12, { skip: 'y' });
});

/* ---------- Conteneurs maritimes ---------- */
/* Tôle nervurée trapézoïdale : profil ouvert le long de x (de 0 à L), creux vers -y */
function corrugProfile(L, pitch = 0.21, depth = 0.035) {
  const pts = [], n = Math.max(1, Math.round(L / pitch)), p = L / n;
  for (let i = 0; i < n; i++) { const x = i * p; pts.push([x, 0], [x + p * 0.3, 0], [x + p * 0.45, -depth], [x + p * 0.85, -depth]); }
  pts.push([L, 0]);
  return pts.reverse(); // parcours de droite à gauche : normales vers +y
}
/* Conteneur 20 pieds (6,06 x 2,44 x 2,6), longueur le long de z, portes en +z. open : sans portes ni fond */
PF.container = (open = false) => prefab(open ? 'containerOpen' : 'container', (M, P) => {
  P.tintable = ['paint'];
  const L = 6.06, W = 2.44, H = 2.6, hl = L / 2, hw = W / 2, post = 0.16;
  M.local(1);
  M.aoFn = (x, y) => lerp(0.65, 1, smoothstep(0, 0.4, y));
  const prof = corrugProfile(L - post * 2);
  for (const s of [1, -1]) {
    // bardage nervuré : profil (le long de z, vers l'extérieur) extrudé vers le haut
    M.save().move(s * (hw - 0.02), 0.16, -s * (hl - post)).mul(basis([0, 0, s], [s, 0, 0], [0, 1, 0]));
    M.extrude('paint', prof, H - 0.32, { closed: false, sharp: 0.3 });
    if (open) { M.color([0.8, 0.8, 0.8]); M.move(0, -0.004, 0); M.extrude('paint', prof.slice().reverse(), H - 0.32, { closed: false, sharp: 0.3 }); }
    M.restore();
  }
  // toit, plancher
  M.boxB('paint', -hw + 0.02, hw - 0.02, H - 0.06, H - 0.02, -hl + post, hl - post);
  if (open) { M.color([0.7, 0.6, 0.45]); M.uvS = 1; M.boxB('crate', -hw + 0.05, hw - 0.05, 0.1, 0.16, -hl + 0.01, hl - 0.01); /* plancher rentré de 1 cm : ses bouts tombaient dans le plan des abouts */ M.color([1, 1, 1]); M.boxB('paint', -hw + 0.02, hw - 0.02, H - 0.1, H - 0.06, -hl + post, hl - post, { skip: 'Y' }); }
  // cadre : montants d'angle, longerons, traverses, pièces de coin
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    M.boxB('paint', sx * hw - (sx > 0 ? post : 0), sx * hw + (sx < 0 ? post : 0), 0.12, H - 0.12, sz * hl - (sz > 0 ? post : 0), sz * hl + (sz < 0 ? post : 0), { bevel: 0.01 }); // entre les pièces de coin
    M.save().color([0.25, 0.24, 0.22]);
    for (const y of [0, H - 0.12]) M.boxB('steel', sx * hw - (sx > 0 ? 0.18 : 0.006), sx * hw + (sx < 0 ? 0.18 : 0.006), y, y + 0.12, sz * hl - (sz > 0 ? 0.18 : 0.006), sz * hl + (sz < 0 ? 0.18 : 0.006), { bevel: 0.01 }); // pièces de coin en saillie de 6 mm (dans le plan des montants, elles scintillaient)
    M.restore();
  }
  for (const sx of [-1, 1]) for (const y of [0, H - 0.16]) M.boxB('paint', sx * hw - (sx > 0 ? 0.12 : 0), sx * hw + (sx < 0 ? 0.12 : 0), y, y + 0.16, -hl + post, hl - post);
  for (const sz of [-1, 1]) for (const y of [0, H - 0.2]) M.boxB('paint', -hw + post, hw - post, y, y + 0.2, sz * hl - (sz > 0 ? 0.12 : 0), sz * hl + (sz < 0 ? 0.12 : 0));
  if (!open) {
    // fond nervuré
    M.save().move(hw - post, 0.2, -hl + 0.04).mul(basis([-1, 0, 0], [0, 0, -1], [0, 1, 0])); M.extrude('paint', corrugProfile(W - post * 2, 0.24, 0.03), H - 0.4, { closed: false }); M.restore();
    // portes : deux vantaux, nervures embouties, barres de fermeture, charnières, joint
    const zf = hl - 0.06;
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -hw + post : 0.006, x1 = s < 0 ? -0.006 : hw - post;
      M.boxB('paint', x0, x1, 0.2, H - 0.2, zf - 0.04, zf);
      for (let k = 0; k < 4; k++) { const y = 0.45 + k * 0.52; M.boxB('paint', x0 + 0.06, x1 - 0.06, y, y + 0.28, zf, zf + 0.015, { bevel: 0.006 }); }
      M.save().color([0.35, 0.34, 0.32]);
      for (const bx of [x0 + (x1 - x0) * 0.28, x0 + (x1 - x0) * 0.72]) {
        M.save().move(bx, 0.1, zf + 0.05); M.cyl('steel', 0.017, H - 0.2, 6); M.restore();
        for (const y of [0.35, H - 0.4]) M.boxB('steel', bx - 0.04, bx + 0.04, y, y + 0.08, zf, zf + 0.06);
        M.boxB('steel', bx - 0.012, bx + 0.012, 1.0, 1.35, zf + 0.05, zf + 0.09);
      }
      for (const y of [0.4, 1.3, 2.2]) M.boxB('steel', s < 0 ? -hw + 0.1 : hw - 0.2, s < 0 ? -hw + 0.2 : hw - 0.1, y, y + 0.14, zf, zf + 0.05);
      M.restore();
    }
    M.color([0.05, 0.05, 0.05]); M.boxB('dark', -0.008, 0.008, 0.2, H - 0.2, zf - 0.03, zf + 0.004);
  }
});

/* ---------- Mobilier urbain ---------- */
/* Éclairage public allumé (crépuscule, nuit) : atmo.lit de la carte en construction (lampadaires, lanternes de parc, réverbères, appliques) */
const litOn = () => !!(CURMAP.def && CURMAP.def.atmo && CURMAP.def.atmo.lit);
/* Lampadaire : socle, fût conique, crosse, lanterne ; allumé (lit, par défaut selon l'ambiance) : verre lumineux et lumière cuite sous la
   lanterne, rabattue vers le sol */
PF.lampPost = (lit = litOn()) => prefab('lampPost' + (lit ? 'L' : ''), (M) => {
  M.color([0.3, 0.31, 0.3]).local(1);
  M.lathe('steel', [[0, 0], [0.16, 0], [0.16, 0.08], [0.12, 0.12], [0.1, 0.5], [0.075, 0.56], [0.07, 5.6], [0.06, 5.85], [0, 5.9]], 10, { uR: 0.1 });
  M.tube('steel', 0.04, [[0, 5.7, 0], [0.1, 5.95, 0], [0.45, 6.05, 0], [0.95, 5.98, 0], [1.2, 5.85, 0]], 6);
  M.save().move(1.2, 5.62, 0);
  M.lathe('steel', [[0, 0.02], [0.2, 0.05], [0.26, 0.14], [0.18, 0.22], [0.05, 0.28], [0, 0.29]], 10);
  M.cls = 1; M.cyl(lit ? 'lamp' : 'lampOff', 0.16, 0.03, 10); M.restore();
  if (lit) M.lamp(1.2, 5.45, 0, [1.0, 0.74, 0.46], 3.2, 12, 0.7);
  M.col(-0.1, 0.1, 0, 6, -0.1, 0.1, 'metal');
});
/* Bouche d'égout (plaque en fonte) et grille d'avaloir, affleurantes */
PF.manhole = () => prefab('manhole', (M) => {
  M.color([0.22, 0.2, 0.18]).local(1); M.cls = 1;
  M.cyl('steel', 0.34, 0.012, 16);
  M.color([0.14, 0.13, 0.12]); M.cls = 2;
  for (let i = -3; i <= 3; i++) M.boxB('steel', i * 0.08 - 0.012, i * 0.08 + 0.012, 0.012, 0.018, -Math.sqrt(0.09 - i * i * 0.0064), Math.sqrt(0.09 - i * i * 0.0064));
});
PF.drain = () => prefab('drain', (M) => {
  M.color([0.05, 0.05, 0.05]).local(1); M.cls = 1;
  M.boxB('dark', -0.3, 0.3, 0, 0.004, -0.2, 0.2);
  M.color([0.2, 0.19, 0.17]); M.cls = 2;
  for (let i = -5; i <= 5; i++) M.boxB('steel', i * 0.05 - 0.01, i * 0.05 + 0.01, 0.004, 0.014, -0.2, 0.2);
  M.boxB('steel', -0.32, 0.32, 0, 0.014, -0.22, -0.2); M.boxB('steel', -0.32, 0.32, 0, 0.014, 0.2, 0.22);
});
/* Gravillons et petits débris épars (menus détails) */
PF.pebbles = (seed = 1) => prefab('pebbles' + seed, (M) => {
  const R = rngOf(seed * 17 + 1); M.cls = 2; M.local(1);
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 0.9, s = R.range(0.03, 0.09);
    M.color(R.pick([[0.8, 0.74, 0.66], [0.6, 0.55, 0.5], [0.72, 0.45, 0.32]]));
    M.save().move(Math.cos(a) * d, -s * 0.3, Math.sin(a) * d).rotY(R() * TAU).rotX(R() - 0.5); M.box('concrete', s * 1.3, s * 0.8, s, { bevel: s * 0.2 }); M.restore();
  }
});
/* Borne anti-stationnement */
PF.bollard = () => prefab('bollard', (M) => {
  M.color([0.25, 0.25, 0.24]).local(1);
  M.lathe('steel', [[0, 0], [0.08, 0], [0.08, 0.7], [0.1, 0.72], [0.1, 0.78], [0.06, 0.84], [0, 0.85]], 10);
  M.col(-0.08, 0.08, 0, 0.85, -0.08, 0.08, 'metal');
});
/* Benne à ordures à chargement frontal (d'après photos) : cuve à face avant inclinée et dos droit, rebord, nervures verticales, fourreaux de
   levage sur les bouts, deux couvercles de plastique noir articulés au dos (un entrouvert), roulettes pivotantes */
PF.dumpster = () => prefab('dumpster', (M, P) => {
  P.tintable = ['paint'];
  M.local(1);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0.1, 0.5, y));
  // cuve : profil (z, y) extrudé sur la longueur ; dos droit en -z, face avant inclinée vers +z
  const pr = [[-0.62, 0.2], [0.42, 0.2], [0.6, 1.3], [-0.62, 1.3]];
  M.save().move(1.0, 0, 0).rotY(-Math.PI / 2); M.extrude('paint', pr, 2.0, { sharp: 0.2 }); M.restore();
  M.aoFn = null;
  M.boxB('paint', -1.04, 1.04, 1.28, 1.36, -0.66, 0.64, { bevel: 0.015 }); // rebord
  M.cls = 1;
  for (const x of [-0.6, 0, 0.6]) { M.boxB('paint', x - 0.04, x + 0.04, 0.22, 1.28, -0.66, -0.62); M.save().move(x, 0.2, 0.42).rotX(-Math.atan2(0.18, 1.1)); M.boxB('paint', -0.04, 0.04, 0.02, 1.1, -0.01, 0.035); M.restore(); }
  M.cls = 0;
  for (const sd of [-1, 1]) { M.boxB('paint', sd * 1.0 - (sd > 0 ? 0 : 0.1), sd * 1.0 + (sd > 0 ? 0.1 : 0), 0.85, 1.05, -0.32, 0.32, { bevel: 0.01 }); M.color([0.06, 0.06, 0.06]); M.boxB('dark', sd * 1.101 - 0.002, sd * 1.101 + 0.002, 0.88, 1.02, -0.28, 0.28); M.color([1, 1, 1]); }
  M.color([0.08, 0.08, 0.09]);
  for (const [sd, ang] of [[-1, 0.03], [1, -0.55]]) { M.save().move(sd * 0.51, 1.36, -0.66).rotX(ang); M.boxB('plastic', -0.5, 0.5, 0, 0.06, 0, 1.34, { bevel: 0.02 }); M.cls = 1; for (const z of [0.3, 0.7, 1.05]) M.boxB('plastic', -0.48, 0.48, 0.06, 0.08, z - 0.03, z + 0.03); M.cls = 0; M.restore(); }
  M.color([0.25, 0.25, 0.25]);
  for (const x of [-0.82, 0.82]) for (const z of [-0.45, 0.3]) { M.boxB('steel', x - 0.06, x + 0.06, 0.16, 0.2, z - 0.06, z + 0.06); M.save().move(x, 0, z + 0.03); M.boxB('steel', -0.04, 0.04, 0.08, 0.16, -0.03, 0.03); M.save().move(-0.025, 0, 0).rotY(Math.PI / 2); wheel(M, 0.075, 0.04, { side: 1, rim: [0.6, 0.6, 0.6] }); M.restore(); M.restore(); }
});
/* Pile de pneus */
PF.tire = () => prefab('tire', (M) => {
  M.color([1, 1, 1]).local(1);
  M.lathe('rubber', [[0.22, 0.0], [0.33, 0.0], [0.38, 0.03], [0.4, 0.1], [0.38, 0.17], [0.33, 0.2], [0.22, 0.2], [0.2, 0.17], [0.2, 0.03], [0.22, 0.0]], 16, { sharp: 0.9, uR: 0.35 });
  M.col(-0.4, 0.4, 0, 0.2, -0.4, 0.4, 'dirt');
});
/* Poteau électrique en bois avec traverse et isolateurs */
PF.pole = () => prefab('pole', (M) => {
  M.color([0.5, 0.4, 0.3]).local(1);
  M.cyl('wood', 0.13, 8.5, 8, { r1: 0.1 });
  M.boxB('wood', -0.9, 0.9, 7.6, 7.72, -0.06, 0.06);
  M.color([0.85, 0.85, 0.8]);
  for (const x of [-0.75, -0.25, 0.25, 0.75]) { M.save().move(x, 7.72, 0); M.cyl('plastic', 0.04, 0.14, 6, { r1: 0.025 }); M.restore(); }
  M.col(-0.13, 0.13, 0, 8.5, -0.13, 0.13, 'wood');
});

/* ---------- Façades et toits ---------- */
/* Climatiseur (unité extérieure) avec ventilateur, grille et équerres ; dos contre le mur (z = 0) */
PF.acUnit = () => prefab('acUnit', (M) => {
  M.color([0.86, 0.85, 0.8]).local(1);
  M.boxB('plastic', -0.4, 0.4, 0, 0.56, 0.04, 0.34, { bevel: 0.02 });
  M.color([0.12, 0.12, 0.12]);
  M.save().move(-0.1, 0.28, 0.341).rotX(Math.PI / 2); M.cyl('dark', 0.2, 0.004, 16); M.restore();
  M.color([0.35, 0.35, 0.34]); M.cls = 2;
  for (let i = -3; i <= 3; i++) M.boxB('steel', -0.1 - 0.2, -0.1 + 0.2, 0.28 + i * 0.05 - 0.004, 0.28 + i * 0.05 + 0.004, 0.34, 0.352);
  for (let i = 0; i < 6; i++) M.boxB('steel', 0.2, 0.36, 0.1 + i * 0.07, 0.1 + i * 0.07 + 0.012, 0.34, 0.345);
  M.color([0.4, 0.4, 0.38]); M.cls = 1;
  for (const x of [-0.3, 0.3]) M.boxB('steel', x - 0.02, x + 0.02, -0.03, 0.0, 0, 0.4);
  M.color([0.9, 0.9, 0.9]); M.tube('plastic', 0.008, [[0.35, 0.05, 0.08], [0.35, -0.3, 0.06], [0.33, -0.5, 0.04]], 4);
});
/* Réservoir d'eau en polyéthylène sur son support (typique des toits du Maghreb) */
PF.waterTank = () => prefab('waterTank', (M, P) => {
  P.tintable = ['plastic'];
  M.color([0.45, 0.45, 0.43]).local(1);
  for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) M.boxB('steel', x - 0.025, x + 0.025, 0, 0.5, z - 0.025, z + 0.025);
  M.boxB('steel', -0.55, 0.55, 0.47, 0.52, -0.55, 0.55);
  M.color([1, 1, 1]);
  const pr = [[0, 0.52], [0.52, 0.52], [0.55, 0.56], [0.55, 0.7], [0.53, 0.72], [0.55, 0.74], [0.55, 0.95], [0.53, 0.97], [0.55, 0.99], [0.55, 1.2], [0.5, 1.3], [0.2, 1.36], [0.2, 1.42], [0, 1.42]];
  M.lathe('plastic', pr, 18, { sharp: 0.7, uR: 0.55 });
  M.color([0.5, 0.5, 0.5]); M.tube('steel', 0.02, [[0.5, 0.65, 0], [0.7, 0.62, 0], [0.75, 0.2, 0], [0.75, 0.06, 0]], 5);
});
/* Antenne parabolique sur pied */
PF.dish = () => prefab('dish', (M) => {
  M.color([0.9, 0.9, 0.88]).local(1);
  M.boxB('steel', -0.25, 0.25, 0, 0.05, -0.25, 0.25);
  M.save().move(0, 0.05, 0); M.cyl('steel', 0.03, 0.75, 6); M.restore();
  M.save().move(0, 0.85, 0).rotX(-0.95);
  M.lathe('steel', [[0, -0.02], [0.2, 0.0], [0.34, 0.06], [0.42, 0.13], [0.43, 0.14]], 14, { sharp: 1.2 });
  M.lathe('steel', [[0.43, 0.14], [0.42, 0.125], [0.33, 0.045], [0.2, -0.015], [0, -0.035]], 14, { sharp: 1.2 });
  M.tube('steel', 0.012, [[0, -0.02, -0.35], [0, 0.25, -0.15], [0, 0.45, 0.0]], 4);
  M.save().move(0, 0.45, 0); M.cyl('plastic', 0.035, 0.1, 6); M.restore();
  M.restore();
});
/* Chauffe-eau solaire : capteur incliné, ballon horizontal, piétement */
PF.solarHeater = () => prefab('solarHeater', (M) => {
  M.color([0.55, 0.55, 0.52]).local(1);
  for (const x of [-0.9, 0.9]) { M.tube('steel', 0.02, [[x, 0, -0.6], [x, 0.3, -0.6], [x, 1.25, 0.1]], 4); M.tube('steel', 0.02, [[x, 0, 0.3], [x, 1.25, 0.3]], 4); }
  M.save().move(0, 0.2, -0.65).rotX(-0.95);
  M.boxB('steel', -1.0, 1.0, 0, 0.06, 0, 1.7, { bevel: 0.01 });
  M.cls = 1; M.color([0.8, 0.85, 0.95]); M.boxB('glass', -0.96, 0.96, 0.06, 0.065, 0.04, 1.66); M.restore();
  M.color([0.85, 0.85, 0.82]);
  M.save().move(-1.05, 1.35, 0.25).rotZ(-Math.PI / 2); M.lathe('steel', [[0, 0], [0.24, 0.0], [0.25, 0.03], [0.25, 2.07], [0.24, 2.1], [0, 2.1]], 12); M.restore();
});
/* Antenne râteau */
PF.antenna = () => prefab('antenna', (M) => {
  M.color([0.55, 0.55, 0.52]).local(1);
  M.cyl('steel', 0.02, 3.2, 5);
  M.boxB('steel', -0.02, 0.02, 2.9, 2.93, -0.7, 0.7);
  for (let i = 0; i < 7; i++) { const z = -0.6 + i * 0.2, w = 0.5 - i * 0.04; M.boxB('steel', -w, w, 2.9, 2.915, z - 0.008, z + 0.008); }
  for (const [x, z] of [[0.8, 0.8], [-0.8, 0.5], [0.3, -0.9]]) M.tube('steel', 0.004, [[0, 2.6, 0], [x, 0, z]], 3);
});
/* Édicule d'accès au toit : cage d'escalier avec porte */
PF.roofHut = () => prefab('roofHut', (M) => {
  M.color([0.92, 0.88, 0.8]).world(1);
  M.boxB('plaster', -1.1, 1.1, 0, 2.5, -0.9, 0.9);
  M.local(1); M.color([0.85, 0.83, 0.78]); M.boxB('concrete', -1.18, 1.18, 2.5, 2.6, -0.98, 0.98, { bevel: 0.015 });
  M.color(PAL.door[0]); M.boxB('paintwood', -0.4, 0.4, 0.02, 2.0, 0.9, 0.93);
  M.color([0.5, 0.45, 0.3]); M.boxB('steel', 0.25, 0.3, 1.0, 1.08, 0.93, 0.97);
});
/* Pot de fleurs en terre cuite (garni d'une touffe) */
PF.pot = () => prefab('pot', (M) => {
  M.color([0.72, 0.4, 0.26]).local(1);
  M.lathe('concrete', [[0, 0], [0.1, 0], [0.13, 0.2], [0.15, 0.22], [0.15, 0.25], [0.125, 0.25], [0.11, 0.05], [0, 0.05]], 10, { sharp: 0.6 });
  M.color([0.9, 0.95, 0.85]); M.swFn = swHeight(0.34, 0.76, 1.2, 0.5);
  foliageCard(M, FOL.bush, 0.24, 0.42, 0.34, 2, 0.18);
});

/* ---------- Entrepôt ---------- */
/* Rayonnage à palettes : échelles bleues, lisses orange, charges */
PF.rack = (L) => prefab('rack' + L.toFixed(2), (M) => {
  const R = rngOf(Math.round(L * 100)), levels = [0.1, 1.16, 2.26], D = 1.0;
  M.local(1);
  const nb = Math.max(1, Math.round(L / 2.7)), bay = L / nb;
  for (let i = 0; i <= nb; i++) {
    const z = -L / 2 + i * bay;
    M.color([0.2, 0.3, 0.55]);
    for (const x of [-D / 2, D / 2]) M.boxB('paint', x - 0.04, x + 0.04, 0, 3.2, z - 0.04, z + 0.04);
    for (let y = 0.3; y < 3.1; y += 0.6) M.boxB('paint', -D / 2, D / 2, y, y + 0.03, z - 0.012, z + 0.012);
  }
  M.color([0.9, 0.5, 0.12]);
  for (const y of levels.slice(1)) for (const x of [-D / 2, D / 2]) M.boxB('paint', x - 0.03, x + 0.03, y - 0.12, y, -L / 2, L / 2);
  // charges : caisses, cartons, sacs sur palettes (des corps physiques, qui reposent sur les lisses)
  for (const y of levels) M.pcol(-D / 2, D / 2, y - 0.03, y, -L / 2, L / 2);
  for (const y of levels) for (let z = -L / 2 + 0.15; z < L / 2 - 0.7; z += 0.75 + R() * 0.25) {
    const r = R(); if (r < 0.18) continue;
    if (r < 0.55) { const s = 0.5 + R() * 0.25; M.save().move(0, y, z + s / 2).rotY((R() - 0.5) * 0.2); M.dyn('crate', 0, 0, 0, 0, { a: [Math.round(s * 20) / 20], tint: [0.9, 0.85, 0.72], nocol: true }); M.restore(); }
    else if (r < 0.85) { M.save().move((R() - 0.5) * 0.2, y, z + 0.3); M.dyn('cardboard', 0, 0, 0, 0, { a: [0.55, Math.round((0.4 + R() * 0.2) * 20) / 20, 0.5] }); M.restore(); }
    else { M.save().move(0, y, z + 0.35).rotY(R() * 0.3); for (let k = 0; k < 3; k++) { M.save().move((k - 1) * 0.3, 0, 0).rotY(Math.PI / 2); M.dyn('sandbagLow', 0, 0, 0, 0, { tint: [0.95, 0.9, 0.78] }); M.restore(); } M.restore(); }
  }
});
/* Groupe électrogène insonorisé (d'après photos de groupes de chantier) : châssis en U sur patins, capot à toit arrondi, grille de radiateur
   à persiennes en +x, sortie d'air chaud en -x, portes de visite sur les flancs (cadres, charnières, poignées), tableau de commande vitré,
   échappement à clapet, anneau de levage, bouchon de réservoir */
PF.generator = () => prefab('generator', (M, P) => {
  P.tintable = ['paint'];
  M.local(1);
  M.color([0.2, 0.2, 0.2]);
  for (const sd of [-1, 1]) M.boxB('steel', -0.95, 0.95, 0, 0.15, sd * 0.55 - (sd > 0 ? 0.08 : 0), sd * 0.55 + (sd > 0 ? 0 : 0.08));
  for (const x of [-0.8, 0.8]) M.boxB('steel', x - 0.06, x + 0.06, 0.1, 0.15, -0.5, 0.5);
  M.color([1, 1, 1]);
  M.boxB('paint', -0.9, 0.9, 0.15, 1.24, -0.5, 0.5, { bevel: 0.03 });
  M.save().move(0.9, 1.24, 0).rotY(-Math.PI / 2); M.extrude('paint', [[-0.5, 0], [0.5, 0], [0.5, 0.04], [0.42, 0.12], [-0.42, 0.12], [-0.5, 0.04]], 1.8, { sharp: 0.6 }); M.restore();
  // persiennes : radiateur (+x) et sortie d'air (-x)
  M.color([0.12, 0.12, 0.12]); M.boxB('dark', 0.9, 0.905, 0.3, 1.1, -0.38, 0.38); M.boxB('dark', -0.905, -0.9, 0.5, 1.0, -0.3, 0.3);
  M.color([1, 1, 1]); M.cls = 1;
  for (let k = 0; k < 9; k++) { const y = 0.34 + k * 0.088; M.save().move(0.91, y, 0).rotZ(-0.6); M.boxB('paint', -0.004, 0.004, 0, 0.07, -0.38, 0.38); M.restore(); }
  for (let k = 0; k < 6; k++) { const y = 0.53 + k * 0.08; M.save().move(-0.91, y, 0).rotZ(0.6); M.boxB('paint', -0.004, 0.004, 0, 0.065, -0.3, 0.3); M.restore(); }
  // portes de visite : deux par flanc, cadre en saillie, charnières, poignée
  for (const sd of [-1, 1]) for (const [x0, x1] of [[-0.78, -0.06], [0.06, 0.78]]) {
    const z = sd * 0.5;
    M.boxB('paint', x0, x1, 0.26, 0.29, z - 0.008, z + 0.008); M.boxB('paint', x0, x1, 1.1, 1.13, z - 0.008, z + 0.008);
    M.boxB('paint', x0, x0 + 0.03, 0.26, 1.13, z - 0.008, z + 0.008); M.boxB('paint', x1 - 0.03, x1, 0.26, 1.13, z - 0.008, z + 0.008);
    M.color([0.15, 0.15, 0.15]); for (const y of [0.4, 0.98]) M.boxB('steel', x0 - 0.01, x0 + 0.03, y - 0.04, y + 0.04, z - 0.014, z + 0.014);
    M.boxB('steel', x1 - 0.09, x1 - 0.05, 0.62, 0.76, z - (sd > 0 ? 0 : 0.03), z + (sd > 0 ? 0.03 : 0)); M.color([1, 1, 1]);
  }
  M.cls = 0;
  // tableau de commande (fenêtre sur le flanc +z, porte de droite), échappement, anneau de levage, bouchon de réservoir
  M.color([0.18, 0.22, 0.26]); M.boxB('glass', 0.18, 0.5, 0.82, 1.02, 0.508, 0.514);
  M.color([0.25, 0.25, 0.25]); M.save().move(-0.55, 1.34, 0.18); M.cyl('steel', 0.055, 0.3, 10); M.save().move(0, 0.3, 0).rotZ(0.4); M.cyl('steel', 0.06, 0.01, 10); M.restore(); M.restore();
  M.save().move(0, 1.36, 0).rotX(Math.PI / 2); M.tube('steel', 0.014, Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i / 8); return [Math.cos(a) * 0.06, 0, -Math.sin(a) * 0.06 - 0.02]; }), 5); M.restore();
  M.color([0.1, 0.1, 0.1]); M.save().move(0.62, 1.15, -0.5).rotX(-Math.PI / 2); M.cyl('steel', 0.04, 0.03, 10); M.restore();
  M.col(-0.95, 0.95, 0, 1.4, -0.55, 0.55, 'metal');
});

/* ---------- Café, marché ---------- */
/* Chaise de terrasse en plastique moulé d'une pièce (d'après photos) : assise à bord roulé, dossier galbé et incliné, accoudoirs qui se
   prolongent en pieds avant, pieds arrière écartés ; teinte de l'estampille */
PF.chair = () => prefab('chair', (M, P) => {
  P.tintable = ['plastic'];
  M.local(1);
  M.boxB('plastic', -0.22, 0.22, 0.42, 0.45, -0.19, 0.21, { bevel: 0.02 });
  M.tube('plastic', 0.016, [[-0.21, 0.43, 0.215], [0.21, 0.43, 0.215]], 5); // bord roulé
  // dossier : coque galbée (creux de 4 cm), inclinée de 12°, des deux faces
  for (const f of [false, true]) M.surf('plastic', 6, 3, (u, v) => { const x = lerp(-0.22, 0.22, u), y = 0.45 + v * 0.42; return [x * (1 + v * 0.06), y, -0.19 - v * 0.09 + 0.04 * Math.cos(u * Math.PI - Math.PI / 2) ** 2 - 0.04]; }, { uL: 0.45, vL: 0.42, flipN: f });
  M.tube('plastic', 0.014, Array.from({ length: 7 }, (_, i) => { const u = i / 6; return [lerp(-0.22, 0.22, u) * 1.06, 0.87, -0.28 + 0.04 * Math.cos(u * Math.PI - Math.PI / 2) ** 2 - 0.04]; }), 4);
  M.color([0.55, 0.55, 0.55]); M.cls = 2; for (const x of [-0.08, 0, 0.08]) M.boxB('plastic', x - 0.012, x + 0.012, 0.58, 0.78, -0.255, -0.24); M.cls = 0; M.color([1, 1, 1]); // fentes du dossier (ombre)
  // accoudoirs et pieds avant d'un seul tenant, pieds arrière
  for (const sd of [-1, 1]) {
    M.tube('plastic', 0.019, [[sd * 0.23, 0.66, -0.24], [sd * 0.245, 0.64, -0.05], [sd * 0.25, 0.6, 0.14], [sd * 0.25, 0.42, 0.2], [sd * 0.27, 0, 0.25]], 6);
    M.tube('plastic', 0.019, [[sd * 0.2, 0.43, -0.17], [sd * 0.24, 0.2, -0.22], [sd * 0.26, 0, -0.27]], 6);
  }
});
PF.cafeTable = () => prefab('cafeTable', (M) => {
  M.color([0.35, 0.35, 0.33]).local(1);
  M.save().move(0, 0.7, 0); M.cyl('steel', 0.35, 0.03, 16); M.restore();
  M.cyl('steel', 0.03, 0.7, 6); M.cyl('steel', 0.22, 0.03, 10);
  M.col(-0.35, 0.35, 0, 0.73, -0.35, 0.35, 'metal');
});
/* Jarre en terre cuite (d'après photos de jarres à eau) : pied tourné, panse ronde, épaule, col étroit et lèvre roulée ; l'intérieur du col
   descend dans l'ombre */
PF.jar = (s = 1) => prefab('jar' + s, (M) => {
  M.color([0.74, 0.44, 0.3]).local(1);
  // panse : rayon lissé entre le pied (0,11 à 3 cm) et le col (0,105 à 59 cm), le plus large (0,26) à 31 cm ; 14 rangs pour une silhouette ronde
  const p = [[0, 0], [0.1, 0], [0.11, 0.02]];
  for (let i = 0; i <= 14; i++) { const y = lerp(0.03, 0.59, i / 14), t = y < 0.31 ? (y - 0.03) / 0.28 : (0.59 - y) / 0.28; p.push([y < 0.31 ? lerp(0.11, 0.26, Math.sin(t * Math.PI / 2)) : lerp(0.105, 0.26, Math.sin(t * Math.PI / 2) ** 0.8), y]); }
  p.push([0.115, 0.615], [0.135, 0.63], [0.14, 0.65], [0.125, 0.665], [0.1, 0.66], [0.09, 0.62], [0.08, 0.5]);
  M.lathe('concrete', p.map(([r, y]) => [r * s, y * s]), 24, { sharp: 0.6, uR: 0.3 });
  M.color([0.12, 0.08, 0.06]); M.save().move(0, 0.5 * s, 0); M.cyl('dark', 0.08 * s, 0.002, 12); M.restore();
});
/* Le cageot de fruits (corps physique, fruits, parois) est dans 02k-dynprops.js */
/* Sac d'épices ouvert, rebord roulé et monticule coloré */
PF.spiceSack = () => prefab('spiceSack', (M, P) => {
  P.tintable = ['sand'];
  M.color([0.85, 0.78, 0.62]).local(1);
  M.lathe('burlap', [[0.16, 0], [0.2, 0.05], [0.21, 0.3], [0.23, 0.33], [0.24, 0.36], [0.2, 0.35], [0.19, 0.3]], 10, { uR: 0.2 });
  M.color([1, 1, 1]);
  M.lathe('sand', [[0.2, 0.3], [0.12, 0.36], [0.03, 0.4], [0, 0.405]], 10);
});

/* ---------- Pièces uniques des cartes (réutilisables) ---------- */
/* Table en bois (2 x 1 m, d'après photos de tables de ferme) : plateau de quatre planches à joints, ceinture sous le plateau, pieds fuselés,
   entretoise ; ses chaises sont des props physiques posées face à elle (voir tableSet, 02k-dynprops.js) */
PF.table = () => prefab('table', (M) => {
  M.color([0.62, 0.46, 0.32]).local(1);
  M.boxB('wood', -1.0, 1.0, 0.75, 0.8, -0.5, 0.5, { bevel: 0.012 });
  M.color([0.3, 0.22, 0.15]); M.cls = 1; for (const z of [-0.25, 0, 0.25]) M.boxB('wood', -0.99, 0.99, 0.799, 0.802, z - 0.004, z + 0.004); M.cls = 0;
  M.color([0.58, 0.43, 0.3]);
  for (const sd of [-1, 1]) { M.boxB('wood', -0.86, 0.86, 0.63, 0.75, sd * 0.38 - 0.012, sd * 0.38 + 0.012); M.boxB('wood', sd * 0.88 - 0.012, sd * 0.88 + 0.012, 0.63, 0.75, -0.36, 0.36); }
  for (const x of [-0.88, 0.88]) for (const z of [-0.38, 0.38]) { M.save().move(x, 0, z); M.lathe('wood', [[0, 0], [0.028, 0], [0.032, 0.05], [0.042, 0.55], [0.045, 0.62], [0.045, 0.75], [0, 0.75]], 8, { sharp: 0.5, uR: 0.04 }); M.restore(); }
  M.boxB('wood', -0.86, 0.86, 0.14, 0.19, -0.02, 0.02); for (const x of [-0.88, 0.88]) M.boxB('wood', x - 0.02, x + 0.02, 0.14, 0.19, -0.36, 0.36);
  M.col(-1.0, 1.0, 0, 0.8, -0.5, 0.5, 'wood');
});
/* Tapis posé au sol (2,4 x 1,6 m) */
PF.rugFloor = () => prefab('rugFloor', (M) => {
  M.color([1, 1, 1]).local(1); M.uvS = 2.4 / TEXSCALE.rug; M.uvO = [0.5, 0.5]; M.cls = 1;
  M.boxB('rug', -1.2, 1.2, 0, 0.012, -0.8, 0.8);
});
/* Fontaine octogonale : bassin, margelle moulurée, eau, colonne et vasque */
PF.fountain = () => prefab('fountain', (M) => {
  M.color([0.95, 0.9, 0.82]).local(1);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0, 0.4, y));
  M.lathe('ashlar', [[1.18, 0], [1.3, 0], [1.3, 0.62], [1.36, 0.66], [1.36, 0.8], [1.12, 0.8], [1.12, 0.3], [0, 0.3]], 8, { sharp: 0.3, uR: 1.3 }); // fond du bassin : on le voit à travers l'eau
  M.aoFn = null; // l'eau du bassin et de la vasque est posée par fountainWater (pondAdd), pas dessinée ici
  M.color([0.92, 0.88, 0.8]);
  M.lathe('ashlar', [[0, 0.3], [0.2, 0.3], [0.16, 0.5], [0.12, 1.3], [0.16, 1.36], [0.5, 1.42], [0.56, 1.5], [0.5, 1.52], [0.14, 1.5], [0.1, 1.7], [0.06, 1.72], [0, 1.72]], 12, { uR: 0.3 });
});
/* Eau d'une fontaine posée en (x, z) : bassin octogonal et vasque (jet au centre : anneaux), avec le rendu de l'eau de la mer */
function fountainWater(x, z) {
  pondAdd({ shape: 'disc', x, y: 0.62, z, r: 1.13, seg: 8, rings: 5, rot: Math.PI / 8, jet: 0.6, bed: 0.32, vis: 0.55, calm: 0.8, foam: 0.6 });
  pondAdd({ shape: 'disc', x, y: 1.505, z, r: 0.47, seg: 16, rings: 4, jet: 1, bed: 0.04, vis: 1, foam: 0.5 });
}
/* Chariot élévateur jaune (frontal à contrepoids, classe 1,5 t, d'après des photos de chariots thermiques) : caisse au profil découpé
   sur les roues, contrepoids arrondi, capot et siège, colonne de direction, toit de protection sur quatre montants, mât à deux étages
   (montants en U, cylindre de levée, chaînes), tablier, dosseret grillagé, fourches en L sous une palette. Fourches vers -z, mêmes
   encombrements que l'ancien modèle (x ±0,62, z -2,2 à 1,07, 2,2 m de haut) : les collisions posées par les cartes restent justes. */
PF.forklift = () => prefab('forklift', (M) => {
  const Y = [0.88, 0.66, 0.12], D = [0.14, 0.14, 0.15], St = [0.3, 0.3, 0.31];
  M.local(1); M.color(Y);
  M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0.1, 0.9, y));
  // caisse : profil latéral (z, y) extrudé sur 0,88 m, entre les roues
  const pts = [[-0.98, 0.22], [0.46, 0.22], [0.46, 0.95], [-0.42, 0.95], [-0.58, 1.12], [-0.86, 1.14], [-0.98, 0.98]];
  M.save().move(0.44, 0, 0).rotY(-Math.PI / 2); M.extrude('paint', pts, 0.88, { sharp: 0.4 }); M.restore();
  // ailes au-dessus des roues (elles débordent de la caisse jusqu'au flanc des pneus)
  for (const sd of [-1, 1]) {
    M.save().move(sd * 0.55, 0, -0.7); for (const f of [false, true]) M.surf('paint', 8, 1, (u, v) => { const a = Math.PI * (0.12 + 0.76 * u); return [lerp(-0.11, 0.11, v), 0.3 + 0.36 * Math.sin(a), -0.36 * Math.cos(a)]; }, { uL: 0.9, vL: 0.22, flipN: f }); M.restore();
  }
  // contrepoids : bloc de fonte arrondi à l'arrière, plus large que la caisse, passage de la roue arrière creusé dessous
  const cw = [[0.42, 0.5], [0.42, 1.28], [0.86, 1.28], [0.98, 1.22], [1.05, 1.08], [1.07, 0.6], [1.04, 0.36], [0.98, 0.3], [0.96, 0.5]];
  M.save().move(0.62, 0, 0).rotY(-Math.PI / 2); M.extrude('paint', cw, 1.24, { sharp: 0.35 }); M.restore();
  M.color(D); M.boxB('paint', -0.62, 0.62, 0.3, 0.5, 0.94, 1.06, { bevel: 0.03 }); // pare-chocs arrière
  // capot moteur (bombé) et siège
  M.color(Y); M.save().move(0, 0.95, 0); M.surf('paint', 6, 1, (u, v) => [lerp(-0.42, 0.42, u), 0.06 * Math.sin(u * Math.PI), lerp(-0.1, 0.44, v)], { uL: 0.9, vL: 0.5, flipN: true }); M.restore();
  M.color(D);
  M.boxB('plastic', -0.24, 0.24, 1.0, 1.1, 0.0, 0.42, { bevel: 0.04 });
  M.save().move(0, 1.08, 0.4).rotX(-0.18); M.boxB('plastic', -0.23, 0.23, 0, 0.46, -0.04, 0.05, { bevel: 0.04 }); M.restore();
  // tableau de bord et colonne de direction, volant incliné
  M.boxB('plastic', -0.3, 0.3, 1.12, 1.18, -0.86, -0.58, { bevel: 0.02 });
  M.tube('steel', 0.025, [[0, 1.14, -0.66], [0, 1.36, -0.5]], 6);
  M.save().move(0, 1.38, -0.48).rotX(0.9); M.tube('plastic', 0.016, Array.from({ length: 13 }, (_, i) => [Math.cos((i / 12) * TAU) * 0.16, 0, Math.sin((i / 12) * TAU) * 0.16]), 5); M.restore();
  for (const sd of [-1, 1]) M.tube('steel', 0.012, [[sd * 0.14, 1.33, -0.6], [sd * 0.14, 1.22, -0.72]], 4); // leviers de levée et d'inclinaison
  // roues : motrices à l'avant (pleines, larges), directrices à l'arrière
  for (const [z, r, w] of [[-0.7, 0.3, 0.22], [0.7, 0.24, 0.18]]) for (const sd of [-1, 1]) { M.save().move(sd * 0.55, 0, z); wheel(M, r, w, { side: sd, rim: [0.8, 0.6, 0.1], hub: 'steel' }); M.restore(); }
  // toit de protection : montants avant inclinés depuis le tablier de la caisse, arrière droits sur le contrepoids, cadre et lattes
  M.color(D);
  for (const sd of [-1, 1]) {
    M.tube('steel', 0.035, [[sd * 0.47, 0.98, -0.9], [sd * 0.47, 2.12, -0.72]], 6);
    M.tube('steel', 0.035, [[sd * 0.47, 1.28, 0.78], [sd * 0.47, 2.12, 0.66]], 6);
  }
  M.boxB('steel', -0.5, 0.5, 2.1, 2.16, -0.78, -0.7); M.boxB('steel', -0.5, 0.5, 2.1, 2.16, 0.62, 0.7);
  for (const sd of [-1, 1]) M.boxB('steel', sd * 0.5 - 0.035, sd * 0.5 + 0.035, 2.1, 2.16, -0.78, 0.7);
  M.cls = 1; for (let k = 0; k < 6; k++) { const z = lerp(-0.6, 0.52, k / 5); M.boxB('steel', -0.46, 0.46, 2.12, 2.15, z - 0.03, z + 0.03); } M.cls = 0;
  // gyrophare, phares sur les montants avant, échappement contre le montant arrière
  M.color([1.0, 0.55, 0.1]); M.save().move(0.32, 2.16, 0.58); M.cyl('plastic', 0.06, 0.1, 10); M.restore();
  M.color([0.85, 0.85, 0.8]); for (const sd of [-1, 1]) { M.save().move(sd * 0.47, 1.62, -0.88).rotX(Math.PI / 2); M.cyl('steel', 0.055, 0.08, 10); M.restore(); }
  M.color([0.2, 0.2, 0.2]); M.tube('steel', 0.03, [[-0.42, 1.25, 0.86], [-0.42, 1.9, 0.86], [-0.42, 1.98, 0.8]], 6);
  // mât à deux étages : montants extérieurs et intérieurs en U, traverses, cylindre de levée, chaînes
  M.color(D);
  for (const sd of [-1, 1]) {
    M.boxB('steel', sd * 0.4 - 0.05, sd * 0.4 + 0.05, 0.12, 2.02, -1.16, -1.04, { bevel: 0.01 });
    M.boxB('steel', sd * 0.3 - 0.04, sd * 0.3 + 0.04, 0.2, 2.08, -1.22, -1.12, { bevel: 0.01 });
    M.save().move(sd * 0.3, 2.04, -1.17).rotZ(Math.PI / 2); M.cyl('steel', 0.05, 0.06, 10); M.restore(); // poulie de chaîne
  }
  for (const y of [0.18, 1.0, 1.96]) M.boxB('steel', -0.4, 0.4, y, y + 0.08, -1.15, -1.06);
  M.boxB('steel', -0.3, 0.3, 2.0, 2.08, -1.21, -1.13);
  M.color(St); M.save().move(0, 0.26, -1.1); M.cyl('steel', 0.055, 1.2, 10); M.restore();
  M.color([0.78, 0.8, 0.82]); M.save().move(0, 1.46, -1.1); M.cyl('steel', 0.03, 0.55, 8); M.restore();
  M.color([0.12, 0.12, 0.12]); M.cls = 1; for (const sd of [-1, 1]) M.tube('steel', 0.012, [[sd * 0.3, 2.08, -1.2], [sd * 0.3, 0.62, -1.26]], 3); M.cls = 0;
  // tablier et dosseret grillagé, fourches en L (levées de 20 cm, sous la palette)
  M.color(D);
  M.boxB('steel', -0.46, 0.46, 0.22, 0.32, -1.3, -1.22); M.boxB('steel', -0.46, 0.46, 0.58, 0.68, -1.3, -1.22);
  M.boxB('steel', -0.46, 0.46, 1.36, 1.42, -1.29, -1.24);
  for (const sd of [-1, 1]) M.boxB('steel', sd * 0.44 - 0.025, sd * 0.44 + 0.025, 0.68, 1.42, -1.29, -1.24);
  M.cls = 1; for (let k = 1; k < 7; k++) { const x = lerp(-0.44, 0.44, k / 7); M.boxB('steel', x - 0.012, x + 0.012, 0.68, 1.36, -1.28, -1.25); } M.cls = 0;
  for (const sd of [-1, 1]) {
    M.boxB('steel', sd * 0.25 - 0.05, sd * 0.25 + 0.05, 0.22, 0.7, -1.36, -1.3);
    M.boxB('steel', sd * 0.25 - 0.05, sd * 0.25 + 0.05, 0.22, 0.27, -2.2, -1.3, { bevel: 0.01 });
  }
  // palette (longerons entre les fourches, planches dessus et dessous) et caisse dessus
  M.color([0.62, 0.5, 0.36]); M.cls = 1;
  for (const x of [-0.5, 0, 0.5]) M.boxB('crate', x - 0.05, x + 0.05, 0.27, 0.37, -2.15, -1.38);
  for (let k = 0; k < 5; k++) { const z = lerp(-2.1, -1.43, k / 4); M.boxB('crate', -0.58, 0.58, 0.37, 0.4, z - 0.05, z + 0.05); }
  for (const z of [-2.1, -1.43]) M.boxB('crate', -0.58, 0.58, 0.18, 0.21, z - 0.05, z + 0.05);
  M.cls = 0; M.color([0.72, 0.58, 0.4]); M.boxB('crate', -0.5, 0.5, 0.4, 1.02, -2.08, -1.45, { bevel: 0.02 });
  M.aoFn = null;
});
/* Tente militaire (7 x 4,4 m) : parois de toile, toit à deux pans, mâts, haubans, porte roulée. Parois et toit sont des toiles tendues
   simulées (Maker.toile) : lacées sur le cadre (mâts, sol, faîtage, avant-toit), elles respirent au vent et se creusent sous un souffle ;
   la toile autour de la porte reste tenue (le rabat roulé et l'ouverture sombre n'en bougent pas) */
PF.tent = () => prefab('tent', (M) => {
  M.color([0.5, 0.52, 0.38]);
  const hx = 3.5, hz = 2.2, wh = 2.1, ridge = 3.3, edge = (u, v) => u <= 0 || u >= 1 || v <= 0 || v >= 1;
  // parois légèrement creusées entre les mâts
  for (const s of [1, -1]) M.toile(8, 2, (u, v) => [lerp(-hx, hx, u), v * wh, s * (hz - 0.06 * Math.sin(u * Math.PI * 3) * Math.sin(v * Math.PI))], { uL: 7, vL: 2.1, flipN: s < 0, play: 0.1, pin: (u, v) => edge(u, v) || Math.abs(u - 0.5) < 0.03 || (s > 0 && Math.abs(lerp(-hx, hx, u)) < 0.95) });
  for (const s of [1, -1]) M.toile(4, 2, (u, v) => [s * (hx - 0.04 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI)), v * wh, lerp(-hz, hz, u)], { uL: 4.4, vL: 2.1, flipN: s > 0, play: 0.1 });
  // toit
  M.color([0.46, 0.48, 0.34]);
  for (const s of [1, -1]) M.toile(8, 3, (u, v) => [lerp(-hx - 0.2, hx + 0.2, u), lerp(wh - 0.12, ridge, v) - Math.sin(v * Math.PI) * 0.05 * (1 - Math.abs(Math.sin(u * Math.PI * 3))), s * lerp(hz + 0.3, 0, v)], { uL: 7.4, vL: 2.8, flipN: s < 0, play: 0.14, pin: (u, v) => v <= 0 || v >= 1 || Math.abs(lerp(-hx - 0.2, hx + 0.2, u)) > hx - 0.05 || Math.abs(u - 0.5) < 0.02 });
  for (const s of [1, -1]) M.quad('canvas', [s * hx, wh, -hz], [s * hx, wh, hz], [s * hx, ridge, 0.01], [s * hx, ridge, -0.01], [s, 0, 0]);
  // porte roulée (côté +z), mâts et haubans
  M.color([0.12, 0.1, 0.08]); M.quad('dark', [-0.7, 0, hz + 0.01], [0.7, 0, hz + 0.01], [0.7, 1.9, hz + 0.01], [-0.7, 1.9, hz + 0.01], [0, 0, 1]);
  M.color([0.45, 0.46, 0.33]); M.save().move(-0.8, 1.95, hz + 0.08).rotZ(-Math.PI / 2); M.cyl('canvas', 0.09, 1.6, 8); M.restore();
  M.color([0.3, 0.26, 0.2]);
  for (const x of [-hx, 0, hx]) { M.save().move(x, 0, 0); M.cyl('wood', 0.04, ridge + 0.1, 6); M.restore(); }
  M.color([0.7, 0.66, 0.55]); M.cls = 2;
  for (const x of [-hx + 0.3, -1.2, 1.2, hx - 0.3]) for (const s of [1, -1]) { M.tube('plastic', 0.008, [[x, wh - 0.1, s * (hz + 0.3)], [x, 0, s * (hz + 1.3)]], 3); M.save().move(x, 0, s * (hz + 1.3)); M.cyl('steel', 0.015, 0.2, 4); M.restore(); }
});
/* Vantail de portail : planches cloutées, pentures en fer (ouvert, plaqué contre le mur ; épaisseur en x) */
PF.gateLeaf = () => prefab('gateLeaf', (M) => {
  M.color([0.5, 0.36, 0.24]).local(1);
  for (let i = 0; i < 9; i++) { const z = -1.0 + i * 0.222; M.boxB('wood', -0.1, 0.1, 0, 3.5 - (i % 2) * 0.03, z + 0.004, z + 0.218, { bevel: 0.01 }); }
  // âme pleine entre les planches : leurs jours de 8 mm laissaient voir au travers d'un vantail qui arrête les balles (fentes.js)
  M.color([0.3, 0.21, 0.14]); M.boxB('wood', -0.03, 0.03, 0.02, 3.44, -0.99, 0.99);
  M.color([0.14, 0.13, 0.12]);
  for (const y of [0.45, 1.75, 3.05]) for (const s of [-1, 1]) M.boxB('steel', s * 0.1, s * 0.115, y, y + 0.1, -1.0, 0.9);
  M.cls = 2;
  for (const y of [0.5, 1.8, 3.1]) for (let z = -0.9; z < 0.9; z += 0.3) for (const s of [-1, 1]) M.boxB('steel', s * 0.114, s * 0.13, y + 0.02, y + 0.06, z, z + 0.04);
});
/* Poutre en I (poteau), hauteur h */
PF.iBeam = (h) => prefab('ibeam' + h, (M) => {
  M.color([0.3, 0.31, 0.3]).local(1);
  const I = [[-0.1, -0.1], [0.1, -0.1], [0.1, -0.085], [0.012, -0.085], [0.012, 0.085], [0.1, 0.085], [0.1, 0.1], [-0.1, 0.1], [-0.1, 0.085], [-0.012, 0.085], [-0.012, -0.085], [-0.1, -0.085]];
  M.save().mul(basis([1, 0, 0], [0, 0, -1], [0, 1, 0])); M.extrude('steel', I, h, { sharp: 0.3 }); M.restore();
  M.boxB('steel', -0.16, 0.16, 0, 0.02, -0.16, 0.16);
});
/* Ferme de toiture en treillis (le long de z, longueur L), en acier */
PF.truss = (L) => prefab('truss' + L.toFixed(1), (M) => {
  M.color([0.3, 0.31, 0.3]).local(1);
  const n = Math.max(2, Math.round(L / 1.4)), hl = L / 2;
  M.boxB('steel', -0.05, 0.05, 0.25, 0.3, -hl, hl); M.boxB('steel', -0.05, 0.05, -0.02, 0.03, -hl, hl);
  for (let i = 0; i <= n; i++) {
    const z = -hl + (L * i) / n; M.boxB('steel', -0.03, 0.03, 0, 0.28, z - 0.03, z + 0.03);
    if (i < n) { const z1 = -hl + (L * (i + 1)) / n, ang = Math.atan2(0.28, z1 - z) * (i % 2 ? 1 : -1); M.save().move(0, 0.14, (z + z1) / 2).rotX(ang).move(0, -0.02, 0); M.box('steel', 0.04, 0.04, hyp(0.28, z1 - z)); M.restore(); }
  }
});
/* Colonne du souk : base moulurée, fût, chapiteau, sur hauteur h (teintable) */
PF.column = (h) => prefab('column' + h, (M, P) => {
  P.tintable = ['plaster'];
  M.world(1);
  M.boxB('plaster', -0.3, 0.3, 0, h, -0.3, 0.3, { skip: 'yY' });
  M.local(1); M.color([0.95, 0.9, 0.82]);
  M.boxB('ashlar', -0.38, 0.38, 0, 0.3, -0.38, 0.38, { bevel: 0.03 });
  M.boxB('ashlar', -0.34, 0.34, 0.3, 0.38, -0.34, 0.34, { bevel: 0.02 });
  M.boxB('ashlar', -0.36, 0.36, h - 0.42, h - 0.3, -0.36, 0.36, { bevel: 0.02 });
  M.boxB('ashlar', -0.42, 0.42, h - 0.3, h, -0.42, 0.42, { bevel: 0.03 });
});
/* Comptoir de marchand (1,6 x 2,4 m) : caisson en planches verticales dans un cadre (montants d'angle, traverse haute), socle en retrait,
   plateau débordant, marchandises */
PF.counter = () => prefab('counter', (M) => {
  M.color([0.62, 0.46, 0.32]).local(1);
  M.uvS = 1;
  M.boxB('wood', -0.78, 0.78, 0.08, 0.94, -1.18, 1.18);
  M.color([0.32, 0.22, 0.14]); M.boxB('wood', -0.74, 0.74, 0, 0.08, -1.14, 1.14); // socle en retrait
  M.color([0.5, 0.36, 0.25]); M.cls = 1;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('wood', sx * 0.78 - 0.05, sx * 0.78 + 0.05, 0.08, 0.94, sz * 1.18 - 0.05, sz * 1.18 + 0.05); // montants d'angle
  for (const sx of [-1, 1]) M.boxB('wood', sx * 0.78 - 0.03, sx * 0.78 + 0.03, 0.8, 0.94, -1.18, 1.18); for (const sz of [-1, 1]) M.boxB('wood', -0.78, 0.78, 0.8, 0.94, sz * 1.18 - 0.03, sz * 1.18 + 0.03);
  M.color([0.42, 0.3, 0.2]);
  for (let z = -0.9; z < 0.95; z += 0.3) for (const sx of [-1, 1]) M.boxB('wood', sx * 0.781 - 0.003, sx * 0.781 + 0.003, 0.1, 0.8, z - 0.005, z + 0.005);
  for (let x = -0.45; x < 0.5; x += 0.3) for (const sz of [-1, 1]) M.boxB('wood', x - 0.005, x + 0.005, 0.1, 0.8, sz * 1.181 - 0.003, sz * 1.181 + 0.003);
  M.cls = 0;
  M.color([0.5, 0.36, 0.25]); M.boxB('wood', -0.82, 0.82, 0.94, 1.0, -1.22, 1.22, { bevel: 0.015 });
  M.save().move(0, 1.0, -0.6); M.put(PF.fruitCrate(), { tint: [0.95, 0.5, 0.1] }); M.restore();
  M.pcol(-0.82, 0.82, 0.94, 1.0, -1.22, 1.22); // le plateau porte les marchandises, qui sont des corps physiques
  M.save().move(0.1, 1.0, 0.35).rotY(0.4); M.dyn('spiceSack', 0, 0, 0, 0, { tint: [0.85, 0.3, 0.12] }); M.restore();
  M.save().move(-0.3, 1.0, 0.8); M.dyn('spiceSack', 0, 0, 0, 0, { tint: [0.9, 0.72, 0.2] }); M.restore();
  M.save().move(0.45, 1.0, 0.9); M.dyn('jar', 0, 0, 0, 0, { s: 0.5 }); M.restore();
});
/* Lanterne marocaine en laiton suspendue par une chaîne (d'après photos) : maillons, dôme en bulbe et sa flèche, corps à six pans vitrés
   entre des montants, coupelle et goutte en bas ; flamme cuite dans le volume d'éclairage */
PF.lantern = () => prefab('lantern', (M) => {
  M.color([0.55, 0.42, 0.2]); M.cls = 1;
  for (let k = 0; k < 12; k++) { const y = -0.04 - k * 0.07; M.save().move(0, y, 0).rotY(k % 2 ? Math.PI / 2 : 0); M.tube('steel', 0.005, Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * TAU; return [Math.cos(a) * 0.012, Math.sin(a) * 0.036, 0]; }), 3); M.restore(); }
  M.lathe('steel', [[0, -0.84], [0.012, -0.86], [0.03, -0.9], [0.09, -0.95], [0.135, -1.0], [0.14, -1.03], [0.12, -1.04]], 6, { sharp: 0.6 }); // dôme en bulbe
  M.save().move(0, -0.84, 0); M.cyl('steel', 0.008, 0.06, 4); M.restore();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; M.tube('steel', 0.007, [[Math.cos(a) * 0.12, -1.04, Math.sin(a) * 0.12], [Math.cos(a) * 0.105, -1.24, Math.sin(a) * 0.105]], 3); }
  M.color([1.0, 0.72, 0.38]); M.lathe('plastic', [[0.118, -1.04], [0.103, -1.24]], 6, { sharp: 0.2 }); // verre ambré (opaque : la flamme est dans le volume d'éclairage)
  M.color([0.55, 0.42, 0.2]); M.lathe('steel', [[0.11, -1.24], [0.115, -1.255], [0.08, -1.29], [0.03, -1.31], [0.012, -1.35], [0, -1.37]], 6, { sharp: 0.6 });
  M.lamp(0, -1.16, 0, [1.0, 0.6, 0.28], 2.6, 7); // flamme chaude, cuite dans le volume d'éclairage
});
/* Suspension sous un plafond (posée au plafond, pend de len m) : câble, abat-jour émaillé, ampoule ; sa lumière est cuite dans le volume
   d'éclairage. cool : néon d'atelier (abat-jour vert, lumière blanche froide, portée plus longue), sinon ampoule chaude de maison */
PF.hangLamp = (cool, len = 0.8) => prefab('hangLamp' + (cool ? 'C' : 'W') + len, (M) => {
  M.color([0.18, 0.18, 0.18]); M.cls = 1;
  M.save().move(0, -len, 0); M.cyl('steel', 0.006, len, 3, { caps: '' }); M.restore();
  const sh = [[0.27, -len - 0.24], [0.25, -len - 0.22], [0.1, -len - 0.07], [0.03, -len - 0.02], [0.03, -len]];
  M.color(cool ? [0.24, 0.36, 0.3] : [0.86, 0.82, 0.72]); M.lathe('paint', sh, 12, { sharp: 1.2 });
  M.color([0.92, 0.9, 0.84]); M.lathe('paint', sh.slice().reverse().map(([r, y]) => [r * 0.97, y - 0.004]), 12, { sharp: 1.2 }); // dedans de l'abat-jour
  M.save().move(0, -len - 0.2, 0); M.cyl(cool ? 'lampCool' : 'lamp', 0.05, 0.08, 8); M.restore();
  M.lamp(0, -len - 0.3, 0, cool ? [0.78, 0.9, 1.0] : [1.0, 0.66, 0.36], cool ? 7 : 1.6, cool ? 12 : 7, 0.8);
});
/* Étal de marché (2,4 x 1,2 m) : table, montants, toile tendue (simulée : Maker.toile, tenue aux bords avant et arrière et sur les montants,
   son lambrequin bat au vent), marchandises. couleur : toile */
PF.stall = (color) => prefab('stall' + color.join(','), (M) => {
  const w = 2.4, d = 1.2, R = rngOf(Math.round(color[0] * 100 + color[1] * 10));
  M.color([0.66, 0.52, 0.38]).local(1);
  M.boxB('wood', -w / 2, w / 2, 0.88, 0.95, -d / 2, d / 2, { bevel: 0.01 });
  M.boxB('wood', -w / 2 + 0.05, w / 2 - 0.05, 0, 0.88, -d / 2 + 0.05, d / 2 - 0.05, { skip: 'Y' });
  M.color([0.45, 0.35, 0.26]);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.boxB('wood', a * (w / 2 - 0.05) - 0.035, a * (w / 2 - 0.05) + 0.035, 0.95, 2.35 + (b > 0 ? 0 : 0.25), b * (d / 2 - 0.05) - 0.035, b * (d / 2 - 0.05) + 0.035);
  M.color(color);
  M.toile(6, 3, (u, v) => [lerp(-w / 2 - 0.2, w / 2 + 0.2, u), lerp(2.62, 2.33, v) - Math.sin(u * Math.PI) * 0.04, lerp(-d / 2 - 0.25, d / 2 + 0.3, v)], { uL: 2.8, vL: 1.7, flipN: true, play: 0.12, glow: 0.3, pin: (u, v) => v <= 0 || v >= 1 || Math.abs(Math.abs(lerp(-w / 2 - 0.2, w / 2 + 0.2, u)) - (w / 2 - 0.05)) < 0.12 });
  M.toile(6, 1, (u, v) => [lerp(-w / 2 - 0.2, w / 2 + 0.2, u), lerp(2.33, 2.1, v), d / 2 + 0.3], { uL: 2.8, vL: 0.25, play: 0.14, glow: 0.3, pin: (u, v) => v <= 0 });
  M.occ(-w / 2, w / 2, 2.2, 2.6, -d / 2, d / 2, 0.6);
  M.pcol(-w / 2, w / 2, 0.88, 0.95, -d / 2, d / 2); // le plateau porte les marchandises, qui sont des corps physiques
  for (let i = 0; i < 4; i++) {
    const x = -0.85 + i * 0.57 + (R() - 0.5) * 0.1, r = R();
    M.save().move(x, 0.95, (R() - 0.5) * 0.3).rotY((R() - 0.5) * 0.4);
    if (r < 0.5) M.put(PF.fruitCrate(), { tint: R.pick([[0.95, 0.5, 0.1], [0.8, 0.12, 0.08], [0.55, 0.75, 0.2], [0.95, 0.85, 0.3]]) });
    else if (r < 0.8) M.dyn('spiceSack', 0, 0, 0, 0, { tint: R.pick([[0.85, 0.3, 0.12], [0.9, 0.72, 0.2], [0.45, 0.3, 0.2], [0.6, 0.55, 0.2]]) });
    else M.dyn('jar', 0, 0, 0, 0, { s: 0.6 });
    M.restore();
  }
  M.save().move(0, 0.02, d / 2 + 0.25).rotY(0.1); M.dyn('jar', 0, 0, 0, 0, { s: 0.9 }); M.restore();
});
