/* ==========================================================================
   KIT CYCLADIQUE (4/4) : le décor. Arbres méditerranéens (olivier, cyprès, tamaris, figuier, platane), plantes en cartes
   découpées (agave, figuier de Barbarie, géraniums, lavande, vigne, jasmin, bougainvillée), pots, tonnelles à toit de
   roseaux, caïques (à flot ou à terre sur leur ber), étendage de poulpes, kiosque, puits, drapeau, chats.
   Les feuillages sont des cartes de l'atlas de la carte (matière cyfol, voir 02yb).
   ========================================================================== */
const _cyA = [0, 0, 0], _cyB = [0, 0, 0];
/* Carte de feuillage orientée au hasard autour du point c : côté s, région reg de l'atlas, inclinaison de 0 (à plat) à tau (debout) */
function cyPatch(M, c, s, reg, R, tint, o = {}) {
  const psi0 = R() * TAU, psi = o.psi !== undefined ? o.psi : psi0, tau = o.tilt !== undefined ? o.tilt : R() * 1.1, h = s / 2, sp = Math.sin(psi), cp = Math.cos(psi), st = Math.sin(tau), ct = Math.cos(tau);
  const a = _cyA, b = _cyB; a[0] = cp; a[1] = 0; a[2] = sp; b[0] = -sp * st; b[1] = ct; b[2] = cp * st;
  const P = (u, v) => [c[0] + (a[0] * u + b[0] * v) * h, c[1] + (a[1] * u + b[1] * v) * h, c[2] + (a[2] * u + b[2] * v) * h];
  M.color(tint || [1, 1, 1]);
  foliageQuad(M, P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), reg, o.up !== undefined ? o.up : 0.7, 'cyfol');
}
/* Touffe de cartes croisées (n plans verticaux autour de l'axe) : largeur w, hauteur h, base y0 */
function cyCard(M, reg, w, h, y0 = 0, n = 3, flare = 0.1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI + 0.3, c = Math.cos(a) * w / 2, s = Math.sin(a) * w / 2, fc = Math.cos(a) * flare, fs = Math.sin(a) * flare;
    foliageQuad(M, [-c, y0, -s], [c, y0, s], [c + fc, y0 + h, s + fs], [-c - fc, y0 + h, -s - fs], reg, 0.6, 'cyfol');
  }
}
/* Nuage de cartes dans un ellipsoïde (cx, cy, cz, rx, ry, rz) : n cartes de côté s */
function cyCanopy(M, cx, cy, cz, rx, ry, rz, n, s, reg, R, tints, o = {}) {
  for (let i = 0; i < n; i++) {
    let x, y, z; do { x = R.range(-1, 1); y = R.range(-1, 1); z = R.range(-1, 1); } while (x * x + y * y + z * z > 1);
    cyPatch(M, [cx + x * rx, cy + y * ry, cz + z * rz], s * R.range(0.85, 1.2), reg, R, R.pick(tints), o);
  }
}
const CY_GREENS = { olive: [[0.92, 0.98, 0.9], [0.86, 0.95, 0.84], [1, 1, 0.96]], dark: [[0.8, 0.92, 0.8], [0.7, 0.85, 0.72], [0.88, 0.98, 0.86]], fig: [[0.95, 1, 0.85], [0.85, 0.98, 0.78], [1, 1, 0.9]] };

/* ---------- Arbres ---------- */
/* Olivier : tronc noueux qui se divise en trois charpentières, couronne argentée en trois masses */
PF.cyOlive = (h = 4.4, seed = 1) => prefab(`cyOlive${h}_${seed}`, (M) => {
  const R = rngOf(seed * 13 + 5), n = 3;
  M.color([0.5, 0.45, 0.4]).local(1); M.aoFn = (x, y) => lerp(0.65, 1, smoothstep(0, 1.2, y));
  const tips = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.8, lean = R.range(0.5, 1.1), path = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; path.push([Math.cos(a) * lean * t * t * 1.4 + Math.sin(t * 6 + i) * 0.12, t * h * 0.82, Math.sin(a) * lean * t * t * 1.4 + Math.cos(t * 5 + i) * 0.12]); }
    M.sweep('wood', circleShape(1, 7), path, { scale: (t) => lerp(0.3, 0.09, t) * (1 + 0.1 * Math.sin(t * 11 + i)), uAround: 0.6 });
    tips.push(path[8]);
  }
  M.aoFn = null; M.swFn = swCrown(0, 0, h * 0.5, h + 0.8, 2.8, 0.75);
  M.save().move(0, -0.05, 0); M.cyl('wood', 0.36, 0.5, 9, { r1: 0.3 }); M.restore();
  for (const t of tips) cyCanopy(M, t[0], t[1] + 0.3, t[2], 1.5, 0.95, 1.5, 34, 1.15, CYF.olive, R, CY_GREENS.olive);
  cyCanopy(M, 0, h * 0.78, 0, 1.4, 0.8, 1.4, 20, 1.1, CYF.olive, R, CY_GREENS.olive);
  M.col(-0.3, 0.3, 0, h * 0.6, -0.3, 0.3, 'wood');
  M.occ(-2.4, 2.4, h * 0.6, h + 0.8, -2.4, 2.4, 0.35);
});
/* Cyprès : flamme sombre et serrée */
PF.cyCypress = (h = 8, seed = 1) => prefab(`cyCypress${h}_${seed}`, (M) => {
  const R = rngOf(seed * 7 + 3), rmax = h * 0.1;
  M.swFn = swHeight(0.5, h, 1.8, 0.9); // la flamme plie par la cime
  M.color([0.34, 0.3, 0.26]).local(1); M.save().move(0, 0, 0); M.cyl('wood', 0.22, 1.2, 7, { r1: 0.12 }); M.restore();
  for (let i = 0; i < Math.round(h * 15); i++) {
    const y = R.range(0.5, h * 0.98), t = y / h, r = rmax * Math.sin(Math.PI * Math.pow(t, 0.8)) * Math.sqrt(R()), a = R() * TAU;
    cyPatch(M, [Math.cos(a) * r, y, Math.sin(a) * r], R.range(0.85, 1.3), CYF.cypress, R, R.pick(CY_GREENS.dark), { tilt: R.range(0.5, 1.4) });
  }
  M.col(-0.28, 0.28, 0, h * 0.5, -0.28, 0.28, 'wood');
  M.occ(-rmax, rmax, 0.5, h, -rmax, rmax, 0.4);
});
/* Tamaris : tronc clair et tordu, longs plumeaux bleu-vert retombants */
PF.cyTamarisk = (h = 3.8, seed = 1) => prefab(`cyTamarisk${h}_${seed}`, (M) => {
  const R = rngOf(seed * 11 + 1), path = [];
  for (let k = 0; k <= 7; k++) { const t = k / 7; path.push([Math.sin(t * 4 + seed) * 0.28 * t, t * h * 0.7, Math.cos(t * 3 + seed) * 0.22 * t]); }
  M.color([0.66, 0.58, 0.5]).local(1); M.sweep('wood', circleShape(1, 7), path, { scale: (t) => lerp(0.2, 0.07, t), uAround: 0.6 });
  // trois branches maîtresses qui portent des touffes de plumeaux
  const top = path[path.length - 1], tufts = [];
  M.swFn = swCrown(top[0], top[2], h * 0.45, h, h * 0.45, 1); // plumeaux légers : ils battent plus que les autres feuillages
  for (let b = 0; b < 3; b++) {
    const a = b * 2.1 + seed, P2 = [], reach = h * 0.34;
    for (let k = 0; k <= 4; k++) { const t = k / 4; P2.push([top[0] * (1 - t * 0.2) + Math.cos(a) * reach * t, top[1] - h * 0.12 + t * h * 0.16, top[2] * (1 - t * 0.2) + Math.sin(a) * reach * t]); }
    M.sweep('wood', circleShape(1, 6), P2, { scale: (t) => lerp(0.07, 0.025, t), uAround: 0.6 });
    tufts.push(P2[4], P2[3]);
  }
  for (let i = 0; i < Math.round(h * 11); i++) {
    const c = tufts[Math.floor(R() * tufts.length)], a = R() * TAU, r = R() * h * 0.2;
    cyPatch(M, [c[0] + Math.cos(a) * r, c[1] + R.range(-0.1, 0.3), c[2] + Math.sin(a) * r], R.range(0.8, 1.2), CYF.tamarisk, R, R.pick([[0.9, 1, 0.95], [1, 1, 1], [0.85, 0.96, 0.95]]), { tilt: R.range(0.8, 1.2), up: 0.3 });
  }
  M.col(-0.2, 0.2, 0, h * 0.5, -0.2, 0.2, 'wood');
  M.occ(-h * 0.4, h * 0.4, h * 0.5, h, -h * 0.4, h * 0.4, 0.3);
});
/* Figuier : tronc court, large dôme de grandes feuilles lobées */
PF.cyFig = (h = 4.4, seed = 1) => prefab(`cyFig${h}_${seed}`, (M) => {
  const R = rngOf(seed * 17 + 9);
  M.color([0.62, 0.56, 0.5]).local(1); M.swFn = swCrown(0, 0, h * 0.45, h, h * 0.7, 0.65);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU, path = []; for (let k = 0; k <= 5; k++) { const t = k / 5; path.push([Math.cos(a) * t * 1.1, t * h * 0.55, Math.sin(a) * t * 1.1]); } M.sweep('wood', circleShape(1, 7), path, { scale: (t) => lerp(0.22, 0.08, t), uAround: 0.6 }); }
  cyCanopy(M, 0, h * 0.7, 0, h * 0.62, h * 0.32, h * 0.62, Math.round(h * 24), 1.05, CYF.fig, R, CY_GREENS.fig);
  M.col(-0.3, 0.3, 0, h * 0.5, -0.3, 0.3, 'wood');
  M.occ(-h * 0.6, h * 0.6, h * 0.45, h, -h * 0.6, h * 0.6, 0.45);
});
/* Platane de la place : tronc clair et massif, vaste couronne ; son ombre est cuite dans l'éclairage */
PF.cyPlane = (h = 10.5, seed = 1) => prefab(`cyPlane${h}_${seed}`, (M) => {
  const R = rngOf(seed * 19 + 4);
  M.color([0.74, 0.7, 0.62]).local(1); M.aoFn = (x, y) => lerp(0.7, 1, smoothstep(0, 1.5, y));
  M.save().move(0, -0.1, 0); M.cyl('wood', 0.62, h * 0.55, 12, { r1: 0.42, caps: '' }); M.restore();
  M.aoFn = null;
  const crown = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.4, path = []; for (let k = 0; k <= 6; k++) { const t = k / 6; path.push([Math.cos(a) * t * 3.2, h * 0.5 + t * h * 0.32, Math.sin(a) * t * 3.2]); } M.sweep('wood', circleShape(1, 7), path, { scale: (t) => lerp(0.3, 0.1, t), uAround: 0.6 }); crown.push(path[6]); }
  M.swFn = swCrown(0, 0, h * 0.5, h + 1, 4.6, 0.6);
  for (const c of crown) cyCanopy(M, c[0], c[1] + 0.6, c[2], 2.6, 1.7, 2.6, 52, 1.7, CYF.fig, R, CY_GREENS.fig);
  cyCanopy(M, 0, h * 0.9, 0, 3.2, 1.5, 3.2, 40, 1.8, CYF.fig, R, CY_GREENS.fig);
  M.col(-0.62, 0.62, 0, h * 0.5, -0.62, 0.62, 'wood');
  M.occ(-6.2, 6.2, h * 0.62, h + 0.8, -6.2, 6.2, 0.5);
});

/* ---------- Plantes ---------- */
PF.cyAgave = (s = 1) => prefab('cyAgave' + s, (M) => { M.swFn = swHeight(0, 1.35 * s, 1.5, 0.18); cyCard(M, CYF.agave, 1.7 * s, 1.35 * s, -0.04, 3, 0.1); }); // feuilles raides : à peine
PF.cyOpuntia = (s = 1) => prefab('cyOpuntia' + s, (M) => { M.swFn = swHeight(0, 1.5 * s, 1.5, 0.1); cyCard(M, CYF.opuntia, 1.5 * s, 1.5 * s, -0.04, 3, 0.1); });
/* Touffe : variété choisie par la graine (géranium, romarin, laurier-rose, lavande) */
PF.cyBush = (s = 1, seed = 1) => prefab(`cyBush${s}_${seed}`, (M) => {
  const kinds = [CYF.geranium, CYF.rosemary, CYF.oleander, CYF.jasmine], reg = kinds[((seed % 4) + 4) % 4];
  M.swFn = swHeight(0, 0.9 * s, 1.2, 0.55);
  cyCard(M, reg, 1.1 * s, 0.9 * s, 0, 3, 0.12);
});
PF.cyGrass = (s = 1) => prefab('cyGrass' + s, (M) => { M.swFn = swHeight(0, 0.6 * s, 1.3, 0.75); cyCard(M, CYF.grass, 0.8 * s, 0.6 * s, 0, 3, 0.1); });
/* Plante grimpante sur un mur (repère de façade) : bougainvillée, jasmin, vigne ou lierre */
PF.cyClimber = (kind, w = 2.2, h = 2.6) => prefab(`cyClimber${kind}${w}${h}`, (M) => {
  const R = rngOf(Math.round(w * 10 + h) + kind.length * 7), reg = CYF[kind] || CYF.bougain;
  const n = Math.round(w * h * 3.2);
  M.swFn = () => -0.6; // plaquée au mur : les feuilles frémissent, la plante ne s'incline pas
  for (let i = 0; i < n; i++) {
    const x = R.range(-w / 2, w / 2), y = R.range(0.1, h) * (0.55 + 0.45 * (1 - Math.abs(x) / (w / 2))), s = R.range(0.55, 0.9);
    cyPatch(M, [x, y, 0.06 + R() * 0.16], s, reg, R, kind === 'bougain' ? [1, 1, 1] : R.pick([[0.95, 1, 0.9], [1, 1, 1]]), { psi: 0, tilt: R.range(0.05, 0.35), up: 0.3 });
  }
  M.color([0.35, 0.26, 0.18]).local(1); M.cls = 2;
  M.tube('wood', 0.025, [[-w * 0.3, 0, 0.05], [-w * 0.2, h * 0.4, 0.07], [0.05 * w, h * 0.75, 0.06], [w * 0.3, h * 0.95, 0.05]], 5);
});
PF.cyJasmine = (w = 1.8, h = 2.4) => PF.cyClimber('jasmine', w, h);

/* ---------- Pots, mobilier de taverne ---------- */
/* Pot en terre cuite fleuri : kind 0 géranium, 1 romarin, 2 agave nain, 3 jasmin */
PF.cyPot = (kind = 0) => prefab('cyPot' + kind, (M) => {
  M.color([0.74, 0.4, 0.26]).local(1);
  M.lathe('concrete', [[0, 0], [0.1, 0], [0.13, 0.2], [0.15, 0.22], [0.15, 0.25], [0.125, 0.25], [0.11, 0.05], [0, 0.05]], 10, { sharp: 0.6 });
  M.color([1, 1, 1]); M.swFn = swHeight(0.24, 0.66, 1.2, 0.5);
  cyCard(M, [CYF.geranium, CYF.rosemary, CYF.agave, CYF.jasmine][kind % 4], 0.46, kind === 2 ? 0.4 : 0.42, 0.24, 2, 0.14);
});
propType('cyPot', (a) => ({ pf: () => PF.cyPot(a[0] || 0), shapes: [CYL(0, 0.125, 0, 0.14, 0.125)], mass: 6, mu: 0.7, e: 0.2, resp: 2.6, blast: 7, hp: 20, mat: 'dirt', snd: 'clay', brk: 'clay', debris: [['shard', 6]] }));

/* Tonnelle de taverne à toit de roseaux (le long de x ou de z) : poteaux peints, chevrons, nappe de roseaux, vigne grimpante.
   Les poteaux arrêtent les soldats, le toit n'arrête que les tirs. o : tint (poteaux), vine (vigne sur le toit) */
function cyPergola(x0, x1, z0, z1, h, seed, o = {}) {
  const M = DECOR, R = rngOf(seed), tint = o.tint || [0.95, 0.94, 0.9], nx = Math.max(1, Math.round((x1 - x0) / 2.4)), nz = Math.max(1, Math.round((z1 - z0) / 2.4));
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
    if ((i > 0 && i < nx) && (k > 0 && k < nz)) continue;
    const x = lerp(x0, x1, i / nx), z = lerp(z0, z1, k / nz);
    M.save().color(tint).local(1); M.boxB('paintwood', x - 0.07, x + 0.07, 0, h, z - 0.07, z + 0.07, { bevel: 0.01 }); M.restore();
    DECOR.col(x - 0.08, x + 0.08, 0, h, z - 0.08, z + 0.08, 'wood');
  }
  M.save().color(tint).local(1);
  for (let k = 0; k <= nz; k++) { const z = lerp(z0, z1, k / nz); M.boxB('paintwood', x0 - 0.25, x1 + 0.25, h, h + 0.12, z - 0.06, z + 0.06, { bevel: 0.01 }); }
  for (let x = x0 - 0.2; x <= x1 + 0.2; x += 0.45) M.boxB('wood', x - 0.025, x + 0.025, h + 0.12, h + 0.17, z0 - 0.25, z1 + 0.25);
  M.restore();
  // nappe de roseaux, à plat, qui laisse passer le soleil par plaques
  for (let x = x0 - 0.2; x < x1 + 0.2; x += 0.9) for (let z = z0 - 0.2; z < z1 + 0.2; z += 0.9) cyPatch(M, [x + 0.45, h + 0.22, z + 0.45], 1.05, CYF.reed, R, [0.92 + R() * 0.08, 0.92 + R() * 0.06, 0.8], { tilt: Math.PI / 2, up: 1 });
  if (o.vine) for (let q = 0; q < Math.round((x1 - x0) * (z1 - z0) * 0.5); q++) cyPatch(M, [R.range(x0, x1), h + 0.3, R.range(z0, z1)], 0.9, CYF.vine, R, [1, 1, 1], { tilt: Math.PI / 2 - 0.12, up: 1 });
  DECOR.col(x0 - 0.25, x1 + 0.25, h + 0.1, h + 0.25, z0 - 0.25, z1 + 0.25, 'wood', true);
  M.occ(x0 - 0.3, x1 + 0.3, h, h + 0.5, z0 - 0.3, z1 + 0.3, 0.55);
}
/* Parasol de taverne : mât, toile blanche et bleue ; sans collision (la toile est au-dessus des têtes). Chaque pan est une toile simulée
   (Maker.toile) tendue entre deux baleines : il se creuse un peu entre elles, son bord bat au vent et se soulève sous un souffle */
PF.cyUmbrella = (c = [0.95, 0.95, 0.92]) => prefab('cyUmbrella' + c.join(','), (M) => {
  M.color([0.3, 0.27, 0.24]).local(1); M.cyl('wood', 0.025, 2.3, 6);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
    M.color(i % 2 ? [0.1, 0.32, 0.62] : c);
    M.toile(3, 4, (u, v) => { const a = lerp(a0, a1, u), r = v * 1.35; return [Math.cos(a) * r, 2.62 - v * 0.42 - 0.04 * Math.sin(u * Math.PI) * v, Math.sin(a) * r]; }, { uL: 1.05, vL: 1.4, side: [0, 1, 0], play: 0.1, glow: 0.35, pin: (u, v) => u <= 0 || u >= 1 || v <= 0 });
  }
});

/* ---------- Barques et bord de mer ---------- */
const HULL_KAIKI = [
  [0.0, 0.72, 1.0, 0.25, -0.35, 4.5], [0.08, 0.86, 0.9, 0.2, -0.55, 3.6], [0.35, 1.0, 0.8, 0.18, -0.62, 3.0], [0.62, 0.94, 0.86, 0.22, -0.6, 2.6],
  [0.82, 0.7, 1.15, 0.35, -0.5, 2.1], [0.93, 0.4, 1.6, 0.7, -0.3, 1.8], [1.0, 0.04, 2.15, 1.3, 0.1, 1.5],
];
/* Nom peint de chaque côté de l'étrave (case i de l'atlas de la carte) : comme hullName du port, avec l'atlas grec */
function cyHullName(M, H, idx, y) { for (const sd of [-1, 1]) hullSideName(M, H, idx, sd, 0.78, 0.9, y, 0.3, 'decals4'); } // (en bandes qui suivent le bordé, voir hullSideName)
/* Caïque : coque de bois peinte à l'étrave haute, bande de flottaison, pont de planches, petite timonerie, mât de feu, filets. o : hull, boot, stripe, name (case des noms), seed */
PF.cyKaiki = (o = {}) => prefab('cyKaiki' + JSON.stringify(o), (M) => {
  const R = rngOf(o.seed || 3), hull = o.hull || [0.94, 0.94, 0.9], accent = o.accent || [0.1, 0.3, 0.62];
  const H = hullBody(M, HULL_KAIKI, { L: o.L || 7.6, B: o.B || 2.7, deck: 0.5, thick: 0.06, nv: 20, hull, boot: accent, stripe: o.stripe || accent, inner: o.inner || [0.9, 0.9, 0.86], deckTint: [0.6, 0.5, 0.38], noCol: true });
  const z = H.z;
  cyHullName(M, H, o.name !== undefined ? o.name : 0, 0.55);
  M.save().local(1);
  M.color(o.house || [0.94, 0.94, 0.9]); M.boxB('paint', -0.55, 0.55, 0.5, 1.7, z(0.18) - 0.6, z(0.18) + 0.5, { bevel: 0.05 });
  M.color(accent); M.boxB('paint', -0.58, 0.58, 1.7, 1.78, z(0.18) - 0.65, z(0.18) + 0.55, { bevel: 0.02 });
  M.color([0.1, 0.12, 0.14]); M.boxB('glass', -0.5, 0.5, 1.0, 1.5, z(0.18) + 0.5, z(0.18) + 0.52);
  M.color([0.45, 0.34, 0.24]); M.save().move(0, 0.5, z(0.52)); M.cyl('wood', 0.05, 2.9, 6); M.restore();
  M.color([0.9, 0.9, 0.86]); M.cls = 2; M.save().move(0, 3.2, z(0.52)); M.cyl('lamp', 0.07, 0.1, 8); M.restore(); M.cls = 0;
  M.color([0.35, 0.28, 0.2]); M.boxB('wood', -0.3, 0.3, 0.5, 0.6, z(0.7) - 0.3, z(0.7) + 0.3);
  if (R() < 0.8) { M.save().move(0.35, 0.5, z(0.38)); M.put(PF.netPile(1 + (o.seed || 3) % 5, 1.0, 0.8, 0.4)); M.restore(); }
  M.save().move(-0.3, 0.5, z(0.8)); M.put(PF.ropeCoil()); M.restore();
  M.restore();
});
/* Caïque tiré à terre sur son ber : la coque repose sur des cales et des chandelles ; collision pleine (un vrai couvert de 1,8 m) */
function cyHauledBoat(x, z, ry, o = {}) {
  const M = DECOR, L = o.L || 7.6, B = o.B || 2.7, alongX = Math.abs(Math.sin(ry)) > 0.5, hx = alongX ? L / 2 : B / 2, hz = alongX ? B / 2 : L / 2;
  M.place(PF.cyKaiki(o), x, 0.98, z, ry, { nocol: true });
  // ber : deux traverses de bois sur des cales, trois chandelles de chaque côté
  M.save().move(x, 0, z).rotY(ry).color([0.5, 0.4, 0.3]).local(1);
  for (const q of [-0.28, 0.1, 0.38]) M.boxB('wood', -0.95, 0.95, 0, 0.35, q * L - 0.16, q * L + 0.16);
  for (const q of [-0.3, 0.05, 0.35]) for (const sd of [-1, 1]) { M.save().move(sd * 1.1, 0.2, q * L).rotZ(sd * 0.35); M.boxB('wood', -0.05, 0.05, 0, 1.2, -0.05, 0.05); M.restore(); }
  M.restore();
  DECOR.col(x - hx * 0.95, x + hx * 0.95, 0, 1.8, z - hz * 0.9, z + hz * 0.9, 'wood');
}
/* Poulpes à sécher : une corde tendue entre deux poteaux, six poulpes pendus */
function cyOctopusLine(x, z, ry, len = 3.2) {
  const M = DECOR, R = rngOf(Math.round(x * 7 + z * 3) + 9);
  M.save().move(x, 0, z).rotY(ry).local(1);
  for (const sx of [-1, 1]) { M.save().move(sx * len / 2, 0, 0).color([0.5, 0.4, 0.3]); M.cyl('wood', 0.05, 2.2, 6); M.restore(); }
  M.color([0.8, 0.74, 0.6]); M.tube('canvas', 0.012, sagPath([-len / 2, 2.05, 0], [len / 2, 2.05, 0], 0.08, 10), 3);
  for (let i = 0; i < 6; i++) {
    const px = -len / 2 + (len * (i + 0.7)) / 6.4, tn = R.pick([[0.8, 0.52, 0.48], [0.7, 0.45, 0.42], [0.85, 0.6, 0.52]]);
    M.save().move(px, 1.5, 0).color(tn);
    M.save().scl(0.1, 0.13, 0.1).move(0, 0.9, 0); M.geo('plastic', G_SPH); M.restore();
    for (let q = 0; q < 8; q++) { const a = (q / 8) * TAU; M.tube('plastic', 0.012, [[Math.cos(a) * 0.04, 0.05, Math.sin(a) * 0.04], [Math.cos(a) * 0.07 + (R() - 0.5) * 0.03, -0.18, Math.sin(a) * 0.07], [Math.cos(a) * 0.05 + (R() - 0.5) * 0.06, -0.42 - R() * 0.1, Math.sin(a) * 0.05]], 3); }
    M.restore();
  }
  for (const sx of [-1, 1]) M.col(sx * len / 2 - 0.06, sx * len / 2 + 0.06, 0, 2.2, -0.06, 0.06, 'wood');
  M.restore();
}
/* Kiosque de rue (periptero) : cabine turquoise, comptoir coulissant, revues, glacier, store ; 2,2 x 1,6 m */
function cyKiosk(x, z, ry) {
  const M = DECOR;
  M.save().move(x, 0, z).rotY(ry).local(1);
  M.color([0.12, 0.52, 0.58]); M.boxB('paint', -1.1, 1.1, 0.1, 2.5, -0.8, 0.8, { bevel: 0.05 });
  M.color([0.95, 0.94, 0.9]); M.boxB('paint', -1.2, 1.2, 2.5, 2.62, -0.9, 0.9, { bevel: 0.03 }); M.boxB('paint', -1.15, 1.15, 0, 0.1, -0.85, 0.85);
  M.color([0.1, 0.12, 0.14]); M.boxB('glass', -0.8, 0.8, 1.05, 2.1, 0.8, 0.82);
  M.color([0.55, 0.35, 0.2]); M.boxB('wood', -0.85, 0.85, 0.95, 1.05, 0.8, 1.15);
  for (const [i, px] of [[0, -0.9], [1, 0.9]]) { M.save().move(px, 1.3, 0.815).color([1, 1, 1]); cyWallDecal(M, i === 0 ? CYD.glace : CYD.fete, 0, 0, 0.4, 0.4, 0, undefined); M.restore(); }
  M.save().move(0, 0, 0.9); cySignBoard(M, 0, 2.62 + 0.0, 1.6, 0.4, CYS.periptero, [0.95, 0.94, 0.9]); M.restore();
  M.col(-1.15, 1.15, 0, 2.6, -0.85, 0.85, 'metal');
  M.restore();
}
/* Puits de pierre à potence de bois et poulie. Il est creux : margelle de pierre sèche, conduit qui descend à 2,5 m sous la place, de plus en
   plus sombre, jusqu'à l'eau (pondAdd) ; le sol de la carte est percé au droit du conduit (CYC.holes, voir meltemGround). Le seau pend à sa
   corde sous la poulie et se balance (hangAdd, 04b-physprops.js) ; l'autre brin de la corde descend vers un taquet du montant nord.
   Collisions : la margelle en quatre boîtes (une balle ou une grenade entre par l'ouverture), et au-dessus de l'ouverture une colonne que
   seuls les soldats sentent (noRay : on ne marche pas sur le vide).
   o : y (hauteur du sol, 0 : le sol plat de Meltem ; sur le sable de Simoun, celle du sol aplani sous le puits), rw (rayon du conduit, 0,6 m ;
   0,5 m à Simoun, où la grille du relief est de 1 m : le trou du maillage est la case du puits, que le conduit remplit), relief (sol en relief :
   le trou se fait dans le maillage du relief, qui saute la case de chaque HOLES, voir reliefMesh, et non dans le mur percé de Meltem, CYC.holes). */
function cyWell(x, z, o = {}) {
  const M = DECOR, Rw = o.rw || 0.6, deep = 2.5, n = 5, y = o.y || 0;
  M.save().move(x, y, z).local(1).color([0.82, 0.78, 0.7]);
  M.lathe('drystone', [[0.9, -0.05], [0.9, 0.85], [0.95, 0.9], [0.95, 0.98], [0.62, 0.98], [Rw, 0.7], [Rw, -0.02]], 14, { sharp: 0.5, uR: 1.1 });
  // conduit : anneaux de pierre de plus en plus sombres (la lumière du jour n'y descend pas)
  for (let i = 0; i < n; i++) {
    const y0 = -0.02 - (i * (deep - 0.02)) / n, y1 = -0.02 - ((i + 1) * (deep - 0.02)) / n, k = 0.04 + 0.78 * Math.pow(1 - (i + 0.5) / n, 2);
    M.color([k, k * 0.95, k * 0.86]); M.lathe('drystone', [[Rw, y0], [Rw, y1]], 14, { uR: 1.1 });
  }
  // potence : deux montants, la traverse et son chapeau
  M.color([0.42, 0.3, 0.2]);
  for (const sd of [-1, 1]) M.boxB('wood', -0.08, 0.08, 0.9, 2.7, sd * 0.85 - 0.06, sd * 0.85 + 0.06, { bevel: 0.01 });
  M.boxB('wood', -0.07, 0.07, 2.6, 2.74, -0.95, 0.95); M.boxB('wood', -0.08, 0.08, 2.75, 2.82, -1.0, 1.0);
  // poulie sous la traverse : chape de fer, réa (axe le long de x, la corde passe dans le plan y-z)
  M.color([0.3, 0.3, 0.3]);
  for (const sx of [-0.04, 0.04]) M.boxB('steel', sx - 0.008, sx + 0.008, 2.36, 2.6, -0.035, 0.035);
  M.save().move(-0.03, 2.42, 0).rotZ(-Math.PI / 2); M.cyl('steel', 0.09, 0.06, 12); M.restore();
  // brin libre : du haut du réa au taquet du montant nord, puis quelques tours
  M.color([0.55, 0.38, 0.22]); M.tube('canvas', 0.012, [[0, 2.5, -0.06], [0, 2.1, -0.4], [0, 1.45, -0.77]], 4);
  M.color([0.35, 0.33, 0.3]); M.boxB('steel', -0.03, 0.03, 1.4, 1.48, -0.8, -0.77);
  M.color([0.55, 0.38, 0.22]); M.save().move(0, 1.36, -0.79); M.cyl('canvas', 0.085, 0.08, 10, { caps: '' }); M.restore();
  M.restore();
  // l'eau au fond, et le trou du sol
  // (le ciel qu'elle reflète est vu par un trou de 1,2 m au bout de 2,5 m de conduit : reflet bien plus faible qu'en plein air)
  pondAdd({ shape: 'disc', r: Rw, seg: 14, rings: 2, x, y: y - deep + 0.1, z, tone: 0.4, depth: 0.3, murk: 1, caus: 0, deep: [0.004, 0.008, 0.008], shallow: [0.012, 0.022, 0.02], scatter: [0.002, 0.006, 0.006] }).material.envMapIntensity = 0.12;
  if (!o.relief) (CYC.holes || (CYC.holes = [])).push([x - 0.62, x + 0.62, z - 0.62, z + 0.62]);
  HOLES.push({ x, z, r: Rw, y: y - deep + 0.1, m: 'water', wall: 'concrete' });
  // collisions : margelle en quatre boîtes, colonne invisible pour les soldats au-dessus du trou
  for (const [a0, a1, b0, b1] of [[-0.9, -Rw, -0.9, 0.9], [Rw, 0.9, -0.9, 0.9], [-Rw, Rw, -0.9, -Rw], [-Rw, Rw, Rw, 0.9]]) DECOR.col(x + a0, x + a1, y, y + 1.0, z + b0, z + b1, 'concrete');
  COL.push({ x0: x - Rw, x1: x + Rw, y0: y, y1: y + 2.6, z0: z - Rw, z1: z + Rw, m: 'concrete', ray: false, noRay: true, inv: true });
  // le seau : corde, anse et seau cerclé, dans un groupe qui pend du bas du réa (côté +z)
  const L = 0.87, pf = prefab('cyWellBucket', (S) => {
    S.local(1);
    S.color([0.55, 0.38, 0.22]); S.tube('canvas', 0.012, [[0, 0, 0], [0, -L, 0]], 4);
    const arc = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; arc.push([Math.cos(a) * 0.125, -L - 0.12 + Math.sin(a) * 0.12, 0]); }
    S.color([0.32, 0.31, 0.3]); S.tube('steel', 0.007, arc, 4);
    S.save().move(0, -L - 0.42, 0).color([0.5, 0.36, 0.22]);
    S.lathe('wood', [[0, 0], [0.105, 0], [0.13, 0.3], [0.118, 0.3], [0.095, 0.03], [0, 0.03]], 12, { sharp: 0.5, uR: 0.6 });
    S.color([0.3, 0.3, 0.3]); for (const y of [0.05, 0.24]) { S.save().move(0, y, 0); S.cyl('steel', 0.109 + y * 0.083, 0.025, 12, { r1: 0.109 + (y + 0.025) * 0.083, caps: '' }); S.restore(); }
    S.restore();
  });
  const g = new THREE.Group(), body = cyPrefabGroup(pf, MAT);
  g.name = 'pendule:seau'; g.position.set(x, y + 2.42, z + 0.09); g.add(body); mapAdd(g);
  // butées : les montants (z = ±0,85) arrêtent le seau vers le nord et le sud
  hangAdd(g, body, L + 0.27, { r: 0.16, top: L, mat: 'wood', lim: [-0.72, 0.55, -1.0, 1.0] });
}
/* Drapeau grec (neuf bandes, canton bleu à croix blanche) sur sa hampe de hp mètres, déployé dans le vent vers ry */
function cyFlag(x, y, z, ry = 0, hp = 2.0) {
  const M = DECOR, w = 1.5, h = 1.0;
  M.save().move(x, y, z).rotY(ry).local(1);
  M.color([0.8, 0.8, 0.78]); M.cyl('steel', 0.03, hp, 6); M.save().move(0, hp + 0.04, 0).scl(0.045); M.geo('steel', G_SPH); M.restore();
  M.save().move(0.02, hp - h, 0);
  cyFlagCloth(M, w, h);
  M.restore();
  M.restore();
}
/* L'étoffe : six bandes verticales qui ondulent un peu (forme au repos ; le vent la fait flotter, 02mc-tissus.js), texture cyFlagTex de la hampe (u = 0) au bout flottant (u = 1) */
function cyFlagCloth(M, w, h) {
  const B = M.buf('cyflag', w / 2, h / 2, 0), n = 6, zAt = (u) => Math.sin(u * 5.2) * 0.07 * u + u * 0.08, P = [];
  M.save().color([1, 1, 1]);
  for (let k = 0; k <= n; k++) {
    const u = k / n, x = u * w, z = zAt(u), dz = (zAt(u + 0.01) - z) / (0.01 * w), l = hyp(1, dz);
    P.push([M.v(B, x, 0, z, -dz / l, 0, 1 / l, u, 1, 1, u), M.v(B, x, h, z, -dz / l, 0, 1 / l, u, 0, 1, u)]); // souplesse u : la vague court de la hampe au bout (02mc-tissus.js)
  }
  for (let k = 0; k < n; k++) M.quadI(B, P[k][0], P[k + 1][0], P[k + 1][1], P[k][1]);
  M.restore();
}
/* Chat assis (de dos, tourné vers ry) : pelage de la graine */
PF.cyCat = (seed = 1) => prefab('cyCat' + seed, (M) => {
  const fur = [[0.85, 0.5, 0.2], [0.35, 0.34, 0.33], [0.08, 0.08, 0.09], [0.9, 0.88, 0.82], [0.6, 0.45, 0.3]][seed % 5];
  M.color(fur).local(1);
  const sph = (x, y, z, a, b, c) => { M.save().move(x, y, z).scl(a, b, c); M.geo('burlap', G_SPH); M.restore(); };
  sph(0, 0.17, -0.02, 0.1, 0.17, 0.12); sph(0, 0.36, 0.05, 0.075, 0.07, 0.07);
  for (const s of [-1, 1]) { M.save().move(s * 0.045, 0.43, 0.05).rotZ(-s * 0.3); M.cyl('burlap', 0.025, 0.05, 4, { r1: 0.0 }); M.restore(); }
  M.tube('burlap', 0.018, [[0, 0.04, -0.12], [0.1, 0.03, -0.18], [0.16, 0.05, -0.1], [0.14, 0.14, 0.0]], 4);
  M.color([0.1, 0.1, 0.1]); M.cls = 2; sph(-0.03, 0.37, 0.115, 0.01, 0.01, 0.004); sph(0.03, 0.37, 0.115, 0.01, 0.01, 0.004);
});
