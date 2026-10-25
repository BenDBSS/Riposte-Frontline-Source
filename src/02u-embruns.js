/* ==========================================================================
   EMBRUNS : un port de pêche breton au soleil couchant. 72 x 96 m, en miroir nord-sud (équipe Alpha au sud, +z ;
   Bravo au nord, -z). La mer longe tout le côté ouest ; le soleil se couche sur elle.
   OUEST « Quais »    : les terre-pleins de granit et leurs chalutiers à quai (on monte à bord par la coupée) ; au centre,
                        la Darse entaille le quai, et le chalutier qui y est amarré bout à bout sert de passerelle entre les
                        deux quais. Lignes de vue longues au ras de l'eau, coupées par les superstructures et les filets.
   CENTRE « Criée »   : le grand hall de vente, ouvert sur la Darse : étals de poisson en rangées, tapis de vente entre ses
                        gradins, chambres froides, et la mezzanine des mareyeurs qui domine tout. Au nord et au sud, les
                        ateliers de Mareyage, traversants, mènent des bases à la Criée.
   EST « Rue du Port » : la rue, le Café de la Marine, la Venelle derrière les maisons ; au centre, la Fabrique de glace,
                        dont la galerie du convoyeur passe au-dessus de la rue jusqu'à la mezzanine de la Criée : la seule
                        route en hauteur de la carte.
   Les tirages sont reproductibles (graine fixe) : chaque pair d'un salon construit la même carte.
   ========================================================================== */
const ATMO_EMBRUNS = Object.assign({}, ATMO_DEFAULT, {
  // fin d'une brume de mer du matin (chantier des ambiances, octobre 2026) : le brouillard reste au ras de l'eau et des quais (fogH), le
  // soleil bas à l'est perce et dore les façades, sa lueur traverse la brume ; quelques lampes et fenêtres encore allumées
  sun: [0.8, 0.3, -0.3], sunColor: 0xffe0b0, sunI: 2.8, vmSun: 0xffe0b0,
  fog: [0.6, 0.64, 0.68], fogD: 0.006, fogH: [10, 0], fogSun: 2.0,
  hemi: [0xb8c4d0, 0x6a6a66, 0.65], vmHemi: [0xb8c4d0, 0x6a6a66],
  sky: {
    zen: [0.35, 0.45, 0.6], mid: [0.58, 0.62, 0.68], hor: [0.72, 0.72, 0.7], gnd: [0.4, 0.42, 0.44],
    glow: [1.2, 1.0, 0.75], halo: [1.3, 1.1, 0.85], disk: [18, 15, 11], cloudLo: [0.46, 0.42, 0.46], cloudHi: [1.45, 0.95, 0.6], cloud: [0.46, 0.82, 0.82],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0x4b5258, hdri: null, lit: true, lamps: 1.2, winLit: 0.3,
  bounce: [1.0, 0.95, 0.85], dust: [0.7, 0.69, 0.66], motes: [1.15, 1.0, 0.82],
  grade: { lo: [0.92, 0.98, 1.1], hi: [1.1, 1.02, 0.9], exp: 1.0, sat: 0.95 }, rays: [1.3, 1.1, 0.85],
  impact: [0.56, 0.54, 0.5], wind: [320, 0.07],
  bloom: [0.45, 0.6, 0.9], aoFloor: 0.32, raysThr: 1.5, raysCap: 6, satExp: 0.9,
  volOpen: true, // hors du volume d'éclairage cuit (ville et collines lointaines, vues d'en haut) : ciel ouvert
});
/* Sol : béton des terre-pieds, dalles de granit des quais, pavés de la rue, enrobé des parkings */
const GROUND_EMBRUNS = { base: 'concrete', l1: 'pavers', l2: 'cobble', l3: 'asphalt', pom: [0, 0, 0.04, 0], dirt: [0.62, 0.6, 0.57], mul: 0, env: 0.4 };
/* Plan : niveau de l'eau, front de mer (x), darse (x0, x1, demi-largeur en z) */
const EM = { wl: -1.5, coast: -30, darse: [-30, -18, 11], coupee: [22, 24] };

/* ---------- Plan ---------- */
/* Portes des maisons derrière les bases gênées (decor.js, chantier des cartes, octobre 2026) : les camions frigorifiques et le conteneur de
   la base devant, ou la dernière maison de la Venelle qui couvre toute la façade (x 28 à 36). Murs pleins (NO_DOOR), aux mêmes tirages. */
const EMBRUNS_NO_DOOR = [[7.6, 48], [21.7, 48], [28.9, 48], [34.3, 48], [13.1, -48], [20.3, -48], [27.7, -48], [34.9, -48]];
function embrunsLevel() {
  SR.rng = rngOf(2911); // accessoires partagés avec Khamsin (caisses, fûts) : mêmes tirages chez tous
  NO_DOOR.length = 0; for (const [x, z] of EMBRUNS_NO_DOOR) NO_DOOR.push([x - 0.4, x + 0.4, z - 0.4, z + 0.4]);
  embrunsWater();
  embrunsQuays();
  embrunsBoats();
  embrunsCriee();
  embrunsGlace();
  for (const s of [1, -1]) { embrunsQuayHalf(s); embrunsMareyage(s); embrunsEast(s); embrunsBase(s); }
  embrunsDarse();
  embrunsPerimeter();
  embrunsBackdrop();
  embrunsGround();
  NO_DOOR.length = 0;
}

/* ---------- Eau : terre ferme, obstacles, bords ---------- */
function embrunsWater() {
  const [dx0, dx1, dz] = EM.darse, c = EM.coast;
  waterSetup({ y: EM.wl, box: [-2000, -15, -2000, 2000], open: [-150, -112], east: -16 });
  waterLand(c, 1e4, dz, 1e4); waterLand(c, 1e4, -1e4, -dz); waterLand(dx1, 1e4, -dz, dz);
  // quais : granit mouillé, une hauteur de quai au-dessus de l'eau
  const H = -EM.wl, gran = [0.36, 0.37, 0.33];
  waterObstacle([c, -10, dz, 140], H, gran, 0.55); waterObstacle([c, -10, -140, -dz], H, gran, 0.55); waterObstacle([dx1, -10, -dz, dz], H, gran, 0.5);
  // bords : on ne tombe pas à l'eau (sauf par les coupées)
  for (const s of [1, -1]) {
    const zr = (a, b) => [s * a, s * b].sort((p, q) => p - q);
    edgeRun('z', c - 0.4, c, ...zr(dz, 48), [zr(...EM.coupee), zr(42, 45)]);
    edgeRun('x', ...zr(dz - 0.4, dz), dx0, dx1, [[-25, -23]]);
  }
  waterEdge(dx1 - 0.4, dx1, -dz, dz);
}
/* Mur invisible le long d'un axis ('z' : x0..x1 fixe, de a0 à a1 en z ; 'x' : z0..z1 fixe, de a0 à a1 en x), percé des ouvertures holes */
function edgeRun(axis, f0, f1, a0, a1, holes = []) {
  let cur = a0;
  for (const [h0, h1] of holes.slice().sort((p, q) => p[0] - q[0])) { if (h0 > cur) put(cur, h0); cur = Math.max(cur, h1); }
  if (a1 > cur) put(cur, a1);
  function put(a, b) { if (axis === 'z') waterEdge(f0, f1, a, b); else waterEdge(a, b, f0, f1); }
}

/* ---------- Bateaux à quai ---------- */
function embrunsBoats() {
  const wl = EM.wl;
  // Darse : chalutier amarré bout à bout, étrave au nord ; on passe d'un quai à l'autre par son pont (coupées à l'arrière
  // et à l'étrave, enrouleur perché sur le portique pour laisser le pont libre)
  // timonerie étroite (2 m) : de chaque côté, un passavant de 1,6 m où l'on se croise
  const D = { L: 19.5, B: 5.6, name: 0, hull: [0.11, 0.2, 0.38], boot: [0.72, 0.14, 0.1], house: [0.42, 0.62], houseW: 1.0, winchW: 0.9, drum: 'haut', bins: [],
    gaps: [[-1, 0.93, 1], [1, 0.93, 1], [0, -1.05, 1.05]], seed: 3, gantry: [0.92, 0.45, 0.12] };
  DECOR.place(PF.trawler(D), -24, wl, 0, Math.PI);
  gangway(-25, -23, 9.3, 11.05, 'z', 0.4, 0);
  gangway(-25, -23, -11.05, -8.6, 'z', 0, 0.4);
  waterObstacle(hullOutline(HULL_TRAWLER, D.L, D.B, -24, 0, Math.PI), 2.9, [0.16, 0.24, 0.4], 0.3);
  // murs autour de la coque (la plage avant et ses abords n'ont pas de pavois)
  waterEdge(-27.2, -26.82, -11, 11); waterEdge(-21.18, -20.8, -11, 11);
  waterEdge(-26.82, -25, 9.75, 10.6); waterEdge(-23, -21.18, 9.75, 10.6);
  waterEdge(-26.82, -25.6, -10.6, -8.2); waterEdge(-22.4, -21.18, -10.6, -8.2); waterEdge(-25.6, -25, -10.6, -9.4); waterEdge(-23, -22.4, -10.6, -9.4);
  // chalutiers à quai, nord et sud : coupée côté quai, à mi-longueur du pont de travail
  for (const s of [1, -1]) {
    const o = { L: 22, B: 6, name: s > 0 ? 1 : 2, hull: s > 0 ? [0.62, 0.12, 0.1] : [0.16, 0.42, 0.36], stripe: s > 0 ? [0.95, 0.95, 0.92] : [0.95, 0.85, 0.3], house: [0.55, 0.78], gaps: [[s > 0 ? 1 : -1, 0.29, 0.392]], seed: s > 0 ? 7 : 8, gantry: s > 0 ? [0.9, 0.9, 0.86] : [0.92, 0.45, 0.12], netColor: s > 0 ? [0.2, 0.36, 0.6] : [0.3, 0.55, 0.32] };
    const zc = s * 26.5, xc = -33.45;
    DECOR.place(PF.trawler(o), xc, wl, zc, s > 0 ? 0 : Math.PI);
    gangway(-30.56, -29.0, ...[s * EM.coupee[0], s * EM.coupee[1]].sort((p, q) => p - q), 'x', 0.4, 0);
    waterObstacle(hullOutline(HULL_TRAWLER, o.L, o.B, xc, zc, s > 0 ? 0 : Math.PI), 2.9, s > 0 ? [0.55, 0.14, 0.12] : [0.18, 0.4, 0.35], 0.3);
    waterEdge(-36.85, -36.45, zc - 11.4, zc + 11.4);
    waterEdge(-36.85, -30.4, zc - 11.4, zc - 11); waterEdge(-36.85, -30.4, zc + 11, zc + 11.4);
  }
}

/* ---------- Quais : murs de granit, algues, bordure, échelles ---------- */
function quayWall(x0, x1, z0, z1, face) {
  // bloc de maçonnerie sous le niveau du quai (il arrête les tirs qui plongent), parement côté eau
  const wl = EM.wl, M = DECOR;
  box('ashlar', x0, x1, wl - 2.5, 0, z0, z1, { tint: [0.56, 0.56, 0.54], skip: 'yY', ao: false, m: 'concrete' });
  // ceinture d'algues et de pierre mouillée au niveau de l'eau, légèrement en saillie
  const o = 0.012, [ax0, ax1, az0, az1] = face === 'w' ? [x0 - o, x0, z0, z1] : face === 'e' ? [x1, x1 + o, z0, z1] : face === 'n' ? [x0, x1, z0 - o, z0] : [x0, x1, z1, z1 + o];
  M.save().color([0.16, 0.2, 0.12]).world(1); M.boxB('wetstone', ax0, ax1, wl - 0.7, wl + 0.55, az0, az1, { skip: 'yY' }); M.restore();
  M.save().color([0.36, 0.36, 0.32]).world(1); M.boxB('wetstone', ax0 - (face === 'w' ? o : 0) + (face === 'e' ? o : 0), ax1 - (face === 'w' ? o : 0) + (face === 'e' ? o : 0), wl + 0.55, wl + 0.95,
    az0 - (face === 'n' ? o : 0) + (face === 's' ? o : 0), az1 - (face === 'n' ? o : 0) + (face === 's' ? o : 0), { skip: 'yY' }); M.restore();
  // bordure de granit chanfreinée qui déborde d'un rien au-dessus de l'eau
  const b = 0.38, [bx0, bx1, bz0, bz1] = face === 'w' ? [x0 - 0.06, x0 + b, z0, z1] : face === 'e' ? [x1 - b, x1 + 0.06, z0, z1] : face === 'n' ? [x0, x1, z0 - 0.06, z0 + b] : [x0, x1, z1 - b, z1 + 0.06];
  M.save().color([0.66, 0.66, 0.63]).world(1); M.boxB('ashlar', bx0, bx1, -0.12, 0.09, bz0, bz1, { bevel: 0.03 }); M.restore();
}
function embrunsQuays() {
  const [dx0, dx1, dz] = EM.darse, c = EM.coast;
  for (const s of [1, -1]) {
    const [a, b] = [s * dz, s * 140].sort((p, q) => p - q);
    quayWall(c, c + 1.2, a, b, 'w');
    const [e, f] = s > 0 ? [dz, dz + 1.2] : [-dz - 1.2, -dz];
    quayWall(dx0, dx1, e, f, s > 0 ? 'n' : 's');
  }
  quayWall(dx1, dx1 + 1.2, -dz, dz, 'w');
}

/* ---------- Criée (x -15..9, z -15..15) : le grand hall de vente ---------- */
/* Suspension industrielle (abat-jour émaillé, ampoule) au bout de son câble ; y : hauteur de l'abat-jour */
function pendantLamp(x, y, z, top) {
  const M = DECOR;
  M.save().move(x, y, z).local(1); M.cls = 1;
  M.color([0.12, 0.12, 0.12]); M.cyl('steel', 0.008, top - y, 3);
  M.color([0.2, 0.32, 0.3]); M.lathe('paint', [[0.03, 0.02], [0.08, 0.0], [0.32, -0.22], [0.34, -0.26], [0.3, -0.26], [0.06, -0.04], [0.03, 0.02]], 12);
  M.color([1, 1, 1]); M.save().move(0, -0.2, 0); M.cyl('lamp', 0.07, 0.08, 8); M.restore();
  M.restore();
}
function embrunsCriee() {
  const X0 = -15, X1 = 9, Z0 = -15, Z1 = 15, t = 0.4, H = 7.0, M = DECOR, wall = [0.88, 0.87, 0.83], R = rngOf(4471);
  const conc = { tint: wall, frames: false, m: 'concrete' };
  // murs : grandes portes de déchargement sur la darse, portes des acheteurs sur la rue, porte de la galerie de la glace
  wallOpen('concrete', 'z', X0 + t / 2, t, Z0, Z1, 0, H, [
    { a0: -9.5, a1: -4.5, b0: 0, b1: 4.2 }, { a0: 4.5, a1: 9.5, b0: 0, b1: 4.2 },
    { a0: -13.6, a1: -10.4, b0: 4.9, b1: 6.4 }, { a0: -2.6, a1: 2.6, b0: 4.9, b1: 6.4 }, { a0: 10.4, a1: 13.6, b0: 4.9, b1: 6.4 }], conc);
  wallOpen('concrete', 'z', X1 - t / 2, t, Z0, Z1, 0, H, [
    { a0: -12.4, a1: -9.6, b0: 0, b1: 2.7 }, { a0: 9.6, a1: 12.4, b0: 0, b1: 2.7 }, { a0: -1.1, a1: 1.1, b0: 3.8, b1: 6.0 },
    { a0: -7.2, a1: -3.8, b0: 4.9, b1: 6.4 }, { a0: 3.8, a1: 7.2, b0: 4.9, b1: 6.4 }], conc);
  for (const s of [1, -1]) wallOpen('concrete', 'x', s * (Z1 - t / 2), t, X0 + t, X1 - t, 0, H, [
    { a0: -11, a1: -6.5, b0: 0, b1: 4.2 }, { a0: 1.0, a1: 3.0, b0: 0, b1: 2.6 }, { a0: -4.6, a1: -0.6, b0: 4.9, b1: 6.4 }, { a0: 4.6, a1: 7.6, b0: 4.9, b1: 6.4 }], conc);
  // vitrages des baies hautes (sans collision : on tire au travers)
  M.save().color([0.7, 0.76, 0.8]); M.cls = 1;
  for (const [z0, z1] of [[-13.6, -10.4], [-2.6, 2.6], [10.4, 13.6]]) M.quad('glass', [X0 + 0.2, 4.9, z0], [X0 + 0.2, 4.9, z1], [X0 + 0.2, 6.4, z1], [X0 + 0.2, 6.4, z0], [-1, 0, 0]);
  for (const [z0, z1] of [[-7.2, -3.8], [3.8, 7.2]]) M.quad('glass', [X1 - 0.2, 4.9, z0], [X1 - 0.2, 4.9, z1], [X1 - 0.2, 6.4, z1], [X1 - 0.2, 6.4, z0], [1, 0, 0]);
  for (const s of [1, -1]) for (const [x0, x1] of [[-4.6, -0.6], [4.6, 7.6]]) M.quad('glass', [x0, 4.9, s * (Z1 - 0.2)], [x1, 4.9, s * (Z1 - 0.2)], [x1, 6.4, s * (Z1 - 0.2)], [x0, 6.4, s * (Z1 - 0.2)], [0, 0, s]);
  M.restore();
  // soubassement de granit, rideaux métalliques relevés au-dessus des grandes portes, bandeau de rive
  // (interrompu par les portes de plain-pied, repère de façade : la bande de pierre traversait les ouvertures)
  const SILL_GAPS = { w: [[5.5, 10.5], [19.5, 24.5]], e: [[2.6, 5.4], [24.6, 27.4]], s: [[4, 8.5], [16, 18]], n: [[6, 8], [15.5, 20]] };
  for (const f of 'nsew') inFrame(facadeFrame(f, X0, X1, Z0, Z1), (MM) => {
    const len = (f === 'n' || f === 's') ? X1 - X0 : Z1 - Z0;
    MM.save().color([0.68, 0.67, 0.64]).world(1);
    let cur = 0; for (const [g0, g1] of SILL_GAPS[f]) { MM.boxB('stone', cur, g0, 0, 0.5, 0, 0.04, { skip: 'z' }); cur = g1; }
    MM.boxB('stone', cur, len, 0, 0.5, 0, 0.04, { skip: 'z' }); MM.restore();
    MM.save().color([0.3, 0.42, 0.55]).local(1); MM.boxB('paint', -0.1, ((f === 'n' || f === 's') ? X1 - X0 : Z1 - Z0) + 0.1, H - 0.35, H, 0, 0.12); MM.restore();
  });
  for (const [z0, z1] of [[-9.5, -4.5], [4.5, 9.5]]) { M.save().color([0.55, 0.57, 0.58]).local(1); M.boxB('steel', X0 - 0.3, X0, 4.2, 4.65, z0 - 0.1, z1 + 0.1, { bevel: 0.03 }); M.restore(); }
  for (const s of [1, -1]) { M.save().color([0.55, 0.57, 0.58]).local(1); M.boxB('steel', -11.1, -6.4, 4.2, 4.65, s > 0 ? Z1 : Z0 - 0.3, s > 0 ? Z1 + 0.3 : Z0, { bevel: 0.03 }); M.restore(); }
  // (z = -15 + L : panneaux sur le mur plein au-delà de chaque grande porte, marées en z = 11, sens interdit au bord de la porte en z = -10,3 ;
  // posés au milieu des portes, ils flottaient dans le vide)
  inFrame(facadeFrame('w', X0, X1, Z0, Z1), (MM) => { sign3Board(MM, 15, 2.3, 5.2, 1.3, SIGNS3.criee, [0.85, 0.85, 0.82]); wallDecal3(MM, DEC3.marees, 26.0, 1.3, 0.8, 0.8); wallDecal3(MM, DEC3.interdit, 4.7, 1.2, 0.6, 0.6); });
  for (const f of 'ns') inFrame(facadeFrame(f, X0, X1, Z0, Z1), (MM) => { sign3Board(MM, f === 's' ? 7.5 : 16.5, 4.35, 3.6, 0.5, SIGNS3.criee, [0.85, 0.85, 0.82]); wallDecal3(MM, R() < 0.5 ? DEC3.poster : DEC3.poster2, f === 's' ? 15.5 : 8.5, 1.0, 0.9, 1.1); });
  inFrame(facadeFrame('e', X0, X1, Z0, Z1), (MM) => { for (const zc of [4, 26]) sign3Board(MM, zc, 3.0, 2.6, 0.65, SIGNS3.ventes, [0.25, 0.25, 0.25]); });
  // toiture : fermes en acier tous les 5 m, pans de fibrociment, lanterneau vitré le long du faîtage (x = -3)
  const xr = -3, half = 12, rise = 3.0, lan = [-5.5, -0.5], yAt = (x) => H + rise * (1 - Math.abs(x - xr) / half), yl = yAt(lan[0]);
  M.save().color([0.64, 0.64, 0.62]).world(1);
  M.quad('corrugated', [X0 - 0.3, H - 0.08, Z0 - 0.3], [X0 - 0.3, H - 0.08, Z1 + 0.3], [lan[0], yl, Z1 + 0.3], [lan[0], yl, Z0 - 0.3], [-rise, half, 0]);
  M.quad('corrugated', [lan[1], yl, Z0 - 0.3], [lan[1], yl, Z1 + 0.3], [X1 + 0.3, H - 0.08, Z1 + 0.3], [X1 + 0.3, H - 0.08, Z0 - 0.3], [rise, half, 0]);
  M.color([0.42, 0.44, 0.46]);
  M.quad('corrugated', [X0 - 0.3, H - 0.14, Z0 - 0.3], [X0 - 0.3, H - 0.14, Z1 + 0.3], [lan[0], yl - 0.06, Z1 + 0.3], [lan[0], yl - 0.06, Z0 - 0.3], [rise, -half, 0]);
  M.quad('corrugated', [lan[1], yl - 0.06, Z0 - 0.3], [lan[1], yl - 0.06, Z1 + 0.3], [X1 + 0.3, H - 0.14, Z1 + 0.3], [X1 + 0.3, H - 0.14, Z0 - 0.3], [-rise, -half, 0]);
  // lanterneau : joues vitrées, petit toit
  const ylt = yl + 1.3; M.color([0.72, 0.78, 0.82]); M.cls = 1;
  for (const x of lan) M.quad('glass', [x, yl - 0.05, Z0 - 0.3], [x, yl - 0.05, Z1 + 0.3], [x, ylt, Z1 + 0.3], [x, ylt, Z0 - 0.3], [x < xr ? -1 : 1, 0, 0]);
  M.cls = 0; M.color([0.6, 0.6, 0.58]);
  M.quad('corrugated', [lan[0] - 0.3, ylt, Z0 - 0.3], [lan[0] - 0.3, ylt, Z1 + 0.3], [xr, ylt + 0.45, Z1 + 0.3], [xr, ylt + 0.45, Z0 - 0.3], [-0.45, 2.5, 0]);
  M.quad('corrugated', [xr, ylt + 0.45, Z0 - 0.3], [xr, ylt + 0.45, Z1 + 0.3], [lan[1] + 0.3, ylt, Z1 + 0.3], [lan[1] + 0.3, ylt, Z0 - 0.3], [0.45, 2.5, 0]);
  M.color([0.25, 0.28, 0.3]); M.local(1);
  for (const x of lan) for (let z = Z0; z <= Z1 + 0.01; z += 2.5) M.boxB('steel', x - 0.05, x + 0.05, yl - 0.05, ylt, z - 0.04, z + 0.04);
  // pignons au-dessus des murs nord et sud (éventail depuis le milieu de l'arase)
  M.color(wall).world(1);
  const gab = [[X0, H], [lan[0], yl], [lan[0], ylt], [xr, ylt + 0.45], [lan[1], ylt], [lan[1], yl], [X1, H]];
  for (const s of [1, -1]) { const zz = s * Z1; for (let i = 0; i < gab.length - 1; i++) M.tri3('concrete', [xr, H, zz], [gab[i][0], gab[i][1], zz], [gab[i + 1][0], gab[i + 1][1], zz], [0, 0, s]); }
  M.restore();
  // fermes : arbalétriers, entrait, montants et diagonales, poteaux le long des murs
  M.save().color([0.3, 0.42, 0.5]).local(1);
  for (let z = -12.5; z <= 12.6; z += 5) {
    for (const [xa, xb] of [[X0 + t, lan[0]], [lan[1], X1 - t]]) { const ya = yAt(xa) - 0.25, yb = yAt(xb) - 0.25; M.tube('steel', 0.09, [[xa, ya, z], [xb, yb, z]], 6); }
    M.tube('steel', 0.06, [[X0 + t, H - 0.25, z], [X1 - t, H - 0.25, z]], 6);
    for (let x = X0 + 2.4; x < X1 - 1; x += 2.4) { const yt = yAt(Math.min(Math.max(x, X0), X1)) - 0.3; if (x > lan[0] && x < lan[1]) continue; M.tube('steel', 0.04, [[x, H - 0.25, z], [x, yt, z]], 4); M.tube('steel', 0.035, [[x, H - 0.25, z], [x + (x < xr ? 2.4 : -2.4), yAt(x + (x < xr ? 2.4 : -2.4)) - 0.3, z]], 4); }
    for (const x of [X0 + t + 0.15, X1 - t - 0.15]) M.boxB('steel', x - 0.15, x + 0.15, 0, H - 0.1, z - 0.12, z + 0.12);
  }
  for (const x of [X0 + t + 2, xr, X1 - t - 2]) M.boxB('steel', x - 0.06, x + 0.06, yAt(x) - 0.45, yAt(x) - 0.3, Z0 + t, Z1 - t);
  M.restore();
  // collisions de la toiture (tirs vers le haut), occlusion du ciel sauf au lanterneau
  for (const [xa, xb] of [[X0, lan[0]], [lan[1], X1]]) for (let k = 0; k < 4; k++) { const a = lerp(xa, xb, k / 4), b = lerp(xa, xb, (k + 1) / 4), y = Math.min(yAt(a), yAt(b)); WORLD.col({ x0: Math.min(a, b), x1: Math.max(a, b), y0: y - 0.1, y1: y + 0.2, z0: Z0, z1: Z1 }, 'metal'); }
  M.occ(X0, lan[0], H, yl, Z0, Z1, 1); M.occ(lan[1], X1, H, yl, Z0, Z1, 1); M.occ(lan[0], lan[1], ylt, ylt + 0.4, Z0, Z1, 0.6);
  // sol de résine mouillée, rigoles, taches
  box('resin', X0 + t, X1 - t, 0, 0.02, Z0 + t, Z1 - t, { collide: false, ao: false, tint: [0.6, 0.64, 0.63] });
  M.save().color([0.2, 0.22, 0.22]).local(1); M.cls = 1; for (const x of [-12.2, 3.6]) M.boxB('steel', x - 0.15, x + 0.15, 0.02, 0.03, Z0 + 1, Z1 - 1); M.restore();
  for (let i = 0; i < 18; i++) { const x = R.range(-13, 3), z = R.range(-13.5, 13.5), pu = R() < 0.55, w = R.range(1.2, 2.6), d = R.range(1.0, 2.2), rot = R() * TAU; if (pu) puddleAdd(x, z, w, d, rot, i + 1, 0.04); else groundDecal3(DEC3.scales, x, z, w, d, rot, 0.035); }

  /* ----- Vente : tapis au centre, gradins des acheteurs de part et d'autre, cadran suspendu ----- */
  // tapis en deux tronçons et gradins coupés par une allée de 1,4 m (x -7,2 à -5,8, entre deux colonnes d'étals) : on traverse la vente à pied
  // d'un côté à l'autre (retour du propriétaire, octobre 2026 : la salle ne se traversait qu'en sautant le tapis de 0,9 m ou le gradin de 0,8 m)
  const AIS = [-7.2, -5.8];
  M.place(PF.conveyor(3.8), -9.1, 0, 0, 0); M.place(PF.conveyor(6.8), -2.4, 0, 0, 0);
  for (const s of [1, -1]) {
    // deux gradins de 0,9 m, sans mur de dossier : B se tient sur eux (avec trois gradins de 0,8 m et le mur, le point n'était praticable qu'à 42 %)
    for (let k = 1; k <= 2; k++) { const [a, b] = [s * (1.2 + 0.9 * (k - 1)), s * 3.0].sort((p, q) => p - q); for (const [x0, x1] of [[-10, AIS[0]], [AIS[1], 0]]) box('concrete', x0, x1, 0, 0.4 * k, a, b, { tint: [0.72, 0.72, 0.7], bevel: 0.02 }); }
    // sièges coque en plastique sur chaque gradin
    M.save().local(1); M.cls = 2;
    for (let k = 1; k <= 2; k++) for (let x = -9.5; x < -0.3; x += 0.62) {
      if (x > AIS[0] - 0.25 && x < AIS[1] + 0.25) continue; // l'allée ; sièges tournés vers le tapis et le cadran (ils regardaient le fond des gradins)
      const zz = s * (1.2 + 0.9 * (k - 1) + 0.5), y = 0.4 * k;
      M.color(k === 2 ? [0.2, 0.36, 0.62] : [0.82, 0.3, 0.15]);
      M.save().move(x, y, zz).rotY(s > 0 ? 0 : Math.PI); M.boxB('plastic', -0.22, 0.22, 0.32, 0.38, -0.2, 0.2, { bevel: 0.03 }); M.boxB('plastic', -0.22, 0.22, 0.38, 0.75, 0.16, 0.22, { bevel: 0.03 }); M.color([0.3, 0.3, 0.3]); M.boxB('steel', -0.03, 0.03, 0, 0.32, -0.03, 0.03); M.restore();
    }
    M.restore();
    // l'enseigne des ventes pend de la charpente au-dessus du dernier gradin
    M.save().move(-5, 0, s * 3.1).rotY(s > 0 ? 0 : Math.PI); sign3Board(M, 0, 3.0, 3.2, 0.8, SIGNS3.ventes, [0.2, 0.2, 0.2]); M.restore();
    M.save().color([0.3, 0.3, 0.3]).local(1); for (const x of [-6.4, -3.6]) M.tube('steel', 0.012, [[x, 3.84, s * 3.13], [x, yAt(x) - 0.3, s * 3.13]], 3); M.restore();
  }
  M.place(PF.cadran(), -5, 5.0, 0, 0);
  /* ----- Étals de poisson : trois rangées de chaque côté de la vente ----- */
  for (const s of [1, -1]) for (const [ri, rz] of [[0, 6.0], [1, 9.0], [2, 12.0]]) {
    for (const [ci, x] of [[0, -10.8], [1, -8.4], [2, -4.6], [3, -2.2], [4, 1.6]]) {
      if (s < 0 && ri === 1 && ci === 0) continue; // la place du chariot élévateur (il entrait dans cet étal)
      M.place(PF.etal(1 + ((ri * 5 + ci) % 7)), x, 0, s * rz, (ri + (s > 0 ? 0 : 1)) % 2 ? Math.PI : 0);
    }
    for (const x of [-9.6, -3.4]) pendantLamp(x, 3.2, s * (rz - 1.5), yAt(x) - 0.3);
  }
  /* ----- Déchargement (ouest) : chambre froide au milieu, palettes, glace, chariot élévateur ----- */
  M.place(PF.coldRoom(7, 3, 3.2), -13.0, 0, 0, Math.PI / 2);
  for (const s of [1, -1]) {
    M.place(PF.icePallet(), -13.6, 0, s * 11.6, 0.1 * s); M.place(PF.icePallet(), -13.6, 0.9, s * 11.6, -0.05 * s);
    M.place(PF.fishBinStackDyn(4, 1 + (s > 0 ? 0 : 2)), -14.1, 0, s * 13.9, 0.1); M.place(PF.fishBinStackDyn(3, 2), -13.2, 0, s * 13.95, -0.1);
    M.place(PF.pallet(), -12.6, 0.02, s * 4.6, Math.PI / 2); M.place(PF.fishBinStackDyn(2, 3), -12.6, 0.14, s * 4.6, 0.05); // sur le sol de résine (2 cm), pas dedans
    pendantLamp(-12, 3.6, s * 8, yAt(-12) - 0.3);
  }
  M.place(PF.forklift(), -11.6, 0, -8.2, 0.4, { tint: [0.95, 0.75, 0.15] }); WORLD.col({ x0: -12.4, x1: -10.8, y0: 0, y1: 2.2, z0: -10.2, z1: -7.0 }, 'metal');
  WORLD.col({ x0: -14.6, x1: -14.5, y0: 0, y1: 3.2, z0: -3.5, z1: 3.5 }, 'metal'); // jour de 10 cm entre le mur ouest et la chambre froide : les balles y passaient
  /* ----- Mezzanine des mareyeurs (est), bureaux vitrés en dessous et dessus, escaliers aux deux bouts ----- */
  const mx0 = 4.6, mx1 = X1 - t, my = 3.8;
  box('concrete', mx0, mx1, my - 0.25, my, -6, 6, { tint: [0.76, 0.76, 0.74] });
  box('plaster', mx0 + 0.1, mx1, 0, my - 0.25, -6, 6, { tint: [0.9, 0.9, 0.88] });
  M.save().color([0.22, 0.32, 0.4]).local(1); M.cls = 1;
  for (let z = -5.5; z < 5.6; z += 1.5) M.boxB('steel', mx0 + 0.04, mx0 + 0.12, 0.05, my - 0.3, z - 0.04, z + 0.04);
  M.color([0.5, 0.56, 0.6]); M.quad('glass', [mx0 + 0.08, 0.9, -6], [mx0 + 0.08, 0.9, 6], [mx0 + 0.08, my - 0.35, 6], [mx0 + 0.08, my - 0.35, -6], [-1, 0, 0]);
  M.color([0.86, 0.86, 0.84]); M.boxB('plaster', mx0 + 0.02, mx0 + 0.1, 0, 0.9, -6, 6);
  M.restore();
  railing(mx0 - 0.02, mx0, my, -6, 6, 'z'); DECOR.col(mx0 - 0.1, mx0 + 0.05, my, my + 1.0, -6, 6, 'metal');
  for (const s of [1, -1]) {
    const [a, b] = [s * 6, s * 12.5].sort((p, q) => p - q);
    ramp(mx0 + 0.2, mx0 + 2.0, a, b, 'z', s > 0 ? my : 0, s > 0 ? 0 : my, 'pavers', [0.72, 0.72, 0.7], { mat: 'concrete' });
    railing(mx0 + 0.18, mx0 + 0.18, 0, a, b, 'z', s > 0 ? [my, 0] : [0, my]);
    { const [c, d] = [s * 5.9, s * 6.05].sort((p, q) => p - q); railing(c, c, my, mx0 + 2.0, mx1, 'x'); DECOR.col(mx0 + 2.0, mx1, my, my + 1.0, c, d, 'metal'); }
    // bureaux vitrés des mareyeurs sur la mezzanine
    const [o0, o1] = [s * 2.6, s * 5.0].sort((p, q) => p - q), ox0 = 6.6;
    box('plaster', ox0, mx1, my, my + 2.5, o0, o1, { tint: [0.9, 0.9, 0.88] });
    M.save().color([0.35, 0.42, 0.48]).local(1); M.cls = 1; M.quad('glass', [ox0 - 0.01, my + 0.9, o0 + 0.2], [ox0 - 0.01, my + 0.9, o1 - 0.2], [ox0 - 0.01, my + 2.2, o1 - 0.2], [ox0 - 0.01, my + 2.2, o0 + 0.2], [-1, 0, 0]); M.restore();
    M.save().color([0.6, 0.6, 0.58]).local(1); M.boxB('steel', ox0 - 0.05, mx1, my + 2.5, my + 2.6, o0 - 0.05, o1 + 0.05); M.restore();
    pendantLamp(6.0, my + 2.2, s * 1.6, yAt(6) - 0.3);
    // un étal contre le mur est, au pied de l'escalier : le fond de la bande de 2 m entre lui et le mur était une impasse (au-delà, la porte de z = 11)
    M.place(PF.etal(27 + (s > 0 ? 0 : 7)), 7.6, 0, s * 7.5, Math.PI / 2);
  }
  for (const z of [-11, 0, 11]) pendantLamp(1.5, 3.4, z, yAt(1.5) - 0.3);
}

/* ---------- Fabrique de glace (x 15..28, z -9..9) et galerie du convoyeur au-dessus de la rue ---------- */
function embrunsGlace() {
  const X0 = 15, X1 = 28, Z0 = -9, Z1 = 9, t = 0.35, G = 3.8, H = 8.0, M = DECOR, R = rngOf(7781), tint = [0.84, 0.86, 0.86];
  const o = { tint, frames: false, m: 'concrete' }, up = { tint, frames: false, m: 'concrete', floorY: G };
  // rez : portes sur la rue et sur la venelle, fenêtres
  wallOpen('concrete', 'z', X0 + t / 2, t, Z0, Z1, 0, G, [{ a0: 3.4, a1: 6.2, b0: 0, b1: 2.8 }, { a0: -6.2, a1: -3.4, b0: 0, b1: 2.8 }, { a0: -1.4, a1: 1.4, b0: 1.0, b1: 2.4 }], o);
  wallOpen('concrete', 'z', X1 - t / 2, t, Z0, Z1, 0, G, [], o);
  // porte du fond en face du pied de l'escalier (x 24,4 à 27) : on descend et l'on sort tout droit sur la venelle
  for (const s of [1, -1]) wallOpen('concrete', 'x', s * (Z1 - t / 2), t, X0 + t, X1 - t, 0, G, [{ a0: 24.4, a1: 27.0, b0: 0, b1: 2.8 }, { a0: 16.8, a1: 19.4, b0: 1.0, b1: 2.4 }, { a0: 21.0, a1: 23.6, b0: 1.0, b1: 2.4 }], o);
  // étage : porte de la galerie (ouest), fenêtres
  wallOpen('concrete', 'z', X0 + t / 2, t, Z0, Z1, G, H - G, [{ a0: -1.1, a1: 1.1, b0: 0, b1: 2.2 }, { a0: 3.8, a1: 6.8, b0: 1.0, b1: 2.4 }, { a0: -6.8, a1: -3.8, b0: 1.0, b1: 2.4 }], up);
  wallOpen('concrete', 'z', X1 - t / 2, t, Z0, Z1, G, H - G, [], up);
  for (const s of [1, -1]) wallOpen('concrete', 'x', s * (Z1 - t / 2), t, X0 + t, X1 - t, G, H - G, [{ a0: 16.8, a1: 19.8, b0: 1.0, b1: 2.4 }, { a0: 21.2, a1: 23.8, b0: 1.0, b1: 2.4 }], up);
  // vitrages des fenêtres (sans collision)
  M.save().color([0.62, 0.7, 0.74]); M.cls = 1;
  M.quad('glass', [X0 + t / 2, 1.0, -1.4], [X0 + t / 2, 1.0, 1.4], [X0 + t / 2, 2.4, 1.4], [X0 + t / 2, 2.4, -1.4], [-1, 0, 0]);
  for (const [a, b] of [[3.8, 6.8], [-6.8, -3.8]]) M.quad('glass', [X0 + t / 2, G + 1.0, a], [X0 + t / 2, G + 1.0, b], [X0 + t / 2, G + 2.4, b], [X0 + t / 2, G + 2.4, a], [-1, 0, 0]);
  for (const s of [1, -1]) for (const [a, b, y] of [[16.8, 19.4, 0], [21.0, 23.6, 0], [16.8, 19.8, G], [21.2, 23.8, G]]) M.quad('glass', [a, y + 1.0, s * (Z1 - t / 2)], [b, y + 1.0, s * (Z1 - t / 2)], [b, y + 2.4, s * (Z1 - t / 2)], [a, y + 2.4, s * (Z1 - t / 2)], [0, 0, s]);
  M.restore();
  // planchers, trémies des escaliers, toit terrasse
  box('resin', X0 + t, X1 - t, 0, 0.02, Z0 + t, Z1 - t, { collide: false, ao: false, tint: [0.62, 0.66, 0.68] });
  const sx0 = 24.6, sx1 = 26.6;
  box('concrete', X0 + t, sx0, G - 0.25, G, Z0 + t, Z1 - t, { tint: [0.8, 0.8, 0.78] });
  // les deux volées montent vers le milieu, où leurs têtes se rejoignent sur une passerelle de 1,2 m (z -0,6 à 0,6) ; leur pied laisse 1,6 m
  // de sol libre jusqu'à la porte du fond, en face, qu'une dalle couvre à l'étage (esquisses/kervenec-escaliers-glace.js ; jusqu'en octobre 2026, elles
  // descendaient jusqu'au mur et l'on en sortait de côté)
  const zH = 0.6, zF = 7.05;
  box('concrete', sx0, sx1, G - 0.25, G, -zH, zH, { tint: [0.8, 0.8, 0.78] });
  for (const s of [1, -1]) { const [a, b] = [s * zF, s * (Z1 - t)].sort((p, q) => p - q); box('concrete', sx0, sx1, G - 0.25, G, a, b, { tint: [0.8, 0.8, 0.78] }); }
  box('concrete', sx1, X1 - t, G - 0.25, G, Z0 + t, Z1 - t, { tint: [0.8, 0.8, 0.78] });
  box('concrete', X0, X1, H, H + 0.3, Z0, Z1, { tint });
  flatRoof(X0, X1, Z0, Z1, H + 0.3, tint, R);
  for (const s of [1, -1]) {
    const [a, b] = [s * zH, s * zF].sort((p, q) => p - q);
    ramp(sx0, sx1, a, b, 'z', s > 0 ? G : 0, s > 0 ? 0 : G, 'pavers', [0.74, 0.74, 0.72], { mat: 'concrete' });
    for (const x of [sx0 - 0.02, sx1 + 0.02]) { railing(x, x, G, a, b, 'z'); DECOR.col(x - 0.06, x + 0.06, G, G + 1.0, a, b, 'metal'); }
    railing(s * (zF + 0.02), 0, G, sx0, sx1, 'x'); DECOR.col(sx0, sx1, G, G + 1.0, s * zF - 0.06 + s * 0.02, s * zF + 0.06 + s * 0.02, 'metal'); // bord de la dalle du fond, au-dessus du pied
  }
  // façade : enseigne, conduites, glace qui suinte
  inFrame(facadeFrame('w', X0, X1, Z0, Z1), (MM) => { sign3Board(MM, 9, G + 2.75, 4.2, 1.05, SIGNS3.glace, [0.85, 0.85, 0.82]); drainPipe(MM, 0.4, H); drainPipe(MM, 17.6, H); wallDecal3(MM, DEC3.rust, 11.4, 1.2, 1.0, 2.0); }); // (rouille entre la fenêtre et la porte)
  // sens interdit à côté de la porte du rez (x 24), rouille sur le trumeau de l'étage (x 20,5) : x = 28 - L au nord, 15 + L au sud
  for (const f of 'ns') inFrame(facadeFrame(f, X0, X1, Z0, Z1), (MM) => { wallDecal3(MM, DEC3.interdit, f === 'n' ? 4.0 : 9.0, 1.2, 0.55, 0.55); wallDecal3(MM, DEC3.rust, f === 'n' ? 7.5 : 5.5, 4.5, 1.2, 2.5); });
  // rez : silo de glace au milieu, machines, palettes de sacs, blocs de glace
  M.save().move(19.2, 0, 0).local(1); M.color([0.75, 0.78, 0.8]); M.cyl('steel', 1.3, 3.4, 18); M.color([0.6, 0.62, 0.64]); M.save().move(0, 3.4, 0); M.cyl('steel', 1.35, 0.15, 18); M.restore();
  M.color([0.5, 0.52, 0.54]); M.save().move(0, 3.55, 0); M.cyl('steel', 0.3, G - 3.6, 8); M.restore(); M.restore();
  WORLD.col({ x0: 17.9, x1: 20.5, y0: 0, y1: G - 0.25, z0: -1.3, z1: 1.3 }, 'metal');
  for (const s of [1, -1]) { M.place(PF.iceMachine(), 22.0, 0, s * 3.0, Math.PI / 2); M.place(PF.icePallet(), 17.0, 0, s * 7.7, 0.1); M.place(PF.icePallet(), 27.0, 0, s * 1.2, Math.PI / 2); }
  // étage : départ du convoyeur, bureau de pointage, sacs de glace
  M.place(PF.conveyor(5), 18.2, G, 0.8, 0); M.place(PF.icePallet(), 22.5, G, -5.6, 0.2); M.place(PF.icePallet(), 22.6, G, 5.8, -0.1);
  M.save().color([0.45, 0.35, 0.25]).local(1); M.boxB('wood', 26.9, 27.6, G, G + 0.9, -1.5, 1.5); M.restore(); WORLD.col({ x0: 26.9, x1: 27.6, y0: G, y1: G + 0.9, z0: -1.5, z1: 1.5 }, 'wood');
  for (const [x, z] of [[18, -5], [18, 5], [22, 0]]) pendantLamp(x, G + 3.0, z, H - 0.05);
  for (const [x, z] of [[17.5, -4], [17.5, 4], [24, 0]]) pendantLamp(x, 2.9, z, G - 0.3);
  /* ----- Galerie du convoyeur (x 9..15) : le passage en hauteur entre la Fabrique et la mezzanine de la Criée ----- */
  const gx0 = 9, gx1 = 15, gz = 1.45, gt = 0.15, gc = [0.6, 0.72, 0.8];
  box('concrete', gx0, gx1, G - 0.25, G, -gz, gz, { tint: [0.6, 0.62, 0.62] });
  for (const s of [1, -1]) wallOpen('corrugated', 'x', s * (gz - gt / 2), gt, gx0, gx1, G, 2.5, [{ a0: 9.7, a1: 11.7, b0: 1.0, b1: 1.9 }, { a0: 12.3, a1: 14.3, b0: 1.0, b1: 1.9 }], { tint: gc, frames: false, m: 'metal', floorY: G });
  box('corrugated', gx0, gx1, G + 2.5, G + 2.65, -gz - 0.1, gz + 0.1, { tint: gc });
  M.save().color([0.25, 0.3, 0.34]).local(1);
  for (const s of [1, -1]) M.boxB('steel', gx0, gx1, G - 0.75, G - 0.25, s * gz - 0.1, s * gz + 0.1);
  for (let x = gx0 + 0.5; x < gx1; x += 1.0) M.tube('steel', 0.04, [[x, G - 0.7, -gz], [x + 0.5, G - 0.3, gz]], 4);
  M.restore();
  M.place(PF.conveyor(6), 12, G, 0.8, 0);
  inFrame({ ox: gx0, oz: gz + 0.01, rot: 0, len: 6 }, (MM) => { MM.save().move(0, G, 0); wallDecal3(MM, DEC3.tag, 3.0, 0.35, 1.0, 0.7); MM.restore(); });
}

/* ---------- Quais (une moitié, miroir en z) ---------- */
function embrunsQuayHalf(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 611 : 612), rot = (a) => (s > 0 ? a : Math.PI - a);
  // bittes d'amarrage le long du quai et aux coins de la darse, amarres vers le chalutier
  // (les pieds du portique de la darse tiennent les coins, z 11,4 à 13,6 : les bittes d'angle y entraient)
  for (const z of [14.4, 19.5, 25, 30.5, 36.2]) M.place(PF.bitt(), -29.4, 0, Z(z), 0);
  const bz = 26.5, yb = 0.55;
  // amarres : du quai au plat-bord côté quai (hullRail) ; l'aussière arrière tombait sur l'axe du bateau et traversait le pont
  const rail = (t) => hullRail(HULL_TRAWLER, 22, 6, -33.45, EM.wl, Z(bz), s > 0 ? 0 : Math.PI, s, t); // (le miroir et le demi-tour gardent l'arrière vers le centre)
  mooringLine([-29.4, yb, Z(13.6)], rail(0.06), 0.5); mooringLine([-29.4, yb, Z(36.2)], rail(0.96), 0.5);
  mooringLine([-29.4, yb, Z(19.5)], rail(0.45), 0.25); mooringLine([-29.4, yb, Z(30.5)], rail(0.41), 0.25);
  // grue de déchargement au-dessus du chalutier, filets, casiers, bacs, chariot élévateur, palettes de glace
  M.place(PF.quayCrane(9), -27.4, 0, Z(31.6), Math.PI / 2);
  M.place(PF.netPile(1 + (s > 0 ? 0 : 3), 2.4, 1.7, 0.95), -25.6, 0, Z(15.2), 0.3 * s);
  M.place(PF.netPile(2 + (s > 0 ? 0 : 3), 2.0, 1.5, 0.8), -27.6, 0, Z(38.6), -0.2 * s);
  M.place(PF.lobsterPots(3, 2, 2, s > 0 ? 3 : 4), -23.6, 0, Z(21.6), 0.1 * s);
  M.place(PF.lobsterPots(2, 3, 1, s > 0 ? 5 : 6), -17.3, 0, Z(37.5), Math.PI / 2);
  for (const [x, z, n, k] of [[-20.2, 15.4, 3, 0], [-19.4, 15.6, 2, 1], [-16.6, 20.2, 4, 2], [-24.4, 28.0, 2, 3], [-23.6, 28.2, 3, 0], [-26.0, 24.5, 1, 1]]) M.place(PF.fishBinStackDyn(n, k), x, 0, Z(z), R() * 0.4 - 0.2);
  M.place(PF.forklift(), -21.0, 0, Z(25.0), rot(-Math.PI / 2), { tint: [0.95, 0.75, 0.15] }); WORLD.col({ x0: -22.3, x1: -19.3, y0: 0, y1: 2.2, z0: Z(25) - 0.7, z1: Z(25) + 0.7 }, 'metal');
  M.place(PF.icePallet(), -16.6, 0, Z(16.9), 0.1);
  for (const [x, z] of [[-24.6, 15.0], [-26.8, 16.5], [-28.2, 37.0]]) { const c = R() < 0.5 ? [0.95, 0.42, 0.1] : [0.92, 0.92, 0.88]; M.dyn('buoy', x, 0, Z(z), R() * TAU, { a: [0.28, ...c] }); }
  M.place(PF.lifeRingStand(), -29.1, 0, Z(28.0), -Math.PI / 2);
  for (const z of [17.0, 33.6]) M.place(PF.quayLadder(2.4), -30.0, 0, Z(z), -Math.PI / 2);
  lampPost(-16.0, Z(17.5), Math.PI); lampPost(-16.0, Z(34.5), Math.PI);
  // Coopérative maritime : boutique d'accastillage au milieu du terre-plein (couvert haut sur le quai)
  { const [a, b] = zr(27.5, 33.5); portHouse(-21.5, -15.5, a, b, { h: 6.0, faces: 'nsw', door: 'w', shop: SIGNS3.coop, stone: true, alongX: false, chimneys: 1, R: rngOf(s > 0 ? 91 : 92) }); }
  M.dyn('jerrycan', -21.7, 0, Z(26.8), 0.3, { tint: [0.85, 0.2, 0.1] }); M.dyn('gasBottle', -21.75, 0, Z(34.1), 0.2, { tint: [0.2, 0.35, 0.65] });
  // marquages et taches au sol
  groundDecal3(DEC3.oil, -22.5, Z(18.5), 2.4, 1.8, 0.3); puddleAdd(-27, Z(22), 3, 2.2, 1.1, 21); groundDecal3(DEC3.scales, -24.5, Z(26), 2.2, 2, 0.5); puddleAdd(-18.5, Z(31), 2.6, 2, 2.0, 22);
}

/* ---------- Darse : quai de débarquement devant la Criée, portique, amarres du chalutier ---------- */
function embrunsDarse() {
  const M = DECOR;
  M.place(PF.portique(10, 25, 10), -24, 0, 0, 0);
  for (const z of [-7.5, 0, 7.5]) M.place(PF.bitt(), -17.6, 0, z, 0);
  for (const s of [1, -1]) {
    // (sur le plat-bord du chalutier de la darse, tourné de π : son côté -x regarde l'est ; t au plus près des anciens points d'attache)
    const rail = (sd, z) => hullRail(HULL_TRAWLER, 19.5, 5.6, -24, EM.wl, 0, Math.PI, sd, 0.5 - z / 19.5);
    mooringLine([-17.6, 0.55, s * 7.5], rail(-1, s * 5.5), 0.35); mooringLine([-28.8, 0.55, s * 12.4], rail(1, s * 8.2), 0.4); mooringLine([-19.2, 0.55, s * 12.4], rail(-1, s * 8.6), 0.4);
    // de part et d'autre de la grande porte de la Criée (z de 4,5 à 9,5), sans empiéter sur elle
    M.place(PF.fishBinStackDyn(3, s > 0 ? 1 : 2), -16.2, 0, s * 2.9, 0.1); M.place(PF.fishBinStackDyn(2, 0), -16.0, 0, s * 3.8, -0.15);
    // tas de filets contre le mur de la Criée, juste après la porte : au bout du quai (x -16,4), il fermait le passage vers le pied du portique
    M.place(PF.netPile(7 + s, 1.6, 1.2, 0.7), -15.75, 0, s * 10.45, Math.PI / 2);
  }
  // deux barques de pêcheur à flot le long du quai de débarquement, entre le chalutier et l'échelle de quai
  for (const s of [1, -1]) {
    floatAdd(PF.barque(), -19.5, s * 3.2, s > 0 ? 0 : Math.PI, { L: 3.4, B: 1.24, draft: 0.18, roll: 0.03 });
    mooringLine([-17.6, 0.55, 0], [-19.3, EM.wl + 0.45, s * 1.7], 0.3); mooringLine([-17.6, 0.55, s * 7.5], [-19.4, EM.wl + 0.45, s * 4.7], 0.3);
  }
  M.place(PF.quayLadder(2.4), -18.0, 0, -4.0, -Math.PI / 2);
  M.place(PF.lifeRingStand(), -17.8, 0, 2.2, -Math.PI / 2);
  for (const [x, z, k] of [[-16.8, -6, 0], [-16.6, 6.5, 1]]) { if (k) groundDecal3(DEC3.scales, x, z, 2, 2, k); else puddleAdd(x, z, 2, 2, k, 23); }
}

/* ---------- Mareyage (x -12..5, z 20..33) : atelier traversant entre la base et la Criée ---------- */
function embrunsMareyage(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 821 : 822);
  const X0 = -12, X1 = 5, [zA, zB] = zr(20, 33), t = 0.3, H = 4.6, tint = [0.86, 0.84, 0.78], o = { tint, frames: false, m: 'concrete' };
  wallOpen('concrete', 'x', Z(20) + s * t / 2, t, X0, X1, 0, H, [{ a0: -6, a1: -2, b0: 0, b1: 3.6 }, { a0: 1.6, a1: 3.0, b0: 0, b1: 2.4 }], o);
  wallOpen('concrete', 'x', Z(33) - s * t / 2, t, X0, X1, 0, H, [{ a0: -3, a1: 1, b0: 0, b1: 3.6 }, { a0: -9.5, a1: -7.5, b0: 1.2, b1: 2.4 }], o);
  wallOpen('concrete', 'z', X0 + t / 2, t, zA + t, zB - t, 0, H, [{ ...((a, b) => ({ a0: a, a1: b }))(...zr(24, 27.5)), b0: 0, b1: 3.2 }, { ...((a, b) => ({ a0: a, a1: b }))(...zr(29.5, 31.5)), b0: 1.2, b1: 2.3 }], o);
  wallOpen('concrete', 'z', X1 - t / 2, t, zA + t, zB - t, 0, H, [{ ...((a, b) => ({ a0: a, a1: b }))(...zr(25.5, 28.5)), b0: 0, b1: 3.2 }, { ...((a, b) => ({ a0: a, a1: b }))(...zr(21.5, 23.5)), b0: 1.2, b1: 2.3 }], o);
  // rideaux métalliques à demi relevés sur les grandes portes
  // coffre des rideaux : son dessous 1,5 cm sous le linteau (dans son plan, il scintillait)
  for (const [x0, x1, z] of [[-6, -2, Z(20)], [-3, 1, Z(33)]]) { M.save().color([0.6, 0.62, 0.62]).local(1); M.boxB('rollshutter', x0, x1, 3.0, 3.6, z - 0.02, z + 0.02); M.boxB('steel', x0 - 0.1, x1 + 0.1, 3.585, 3.95, z - 0.2, z + 0.2, { bevel: 0.02 }); M.restore(); }
  box('resin', X0 + t, X1 - t, 0, 0.02, zA + t, zB - t, { collide: false, ao: false, tint: [0.64, 0.66, 0.64] });
  slateRoof(X0, X1, zA, zB, H, { alongX: true, pitch: 0.32, mat: 'corrugated', tint: [0.66, 0.66, 0.64], gable: tint, gableMat: 'concrete', rampants: false, chimneys: 0, R });
  ceilingJoists(X0 + t, X1 - t, zA + t, zB - t, H);
  // enseigne, affiches
  inFrame(facadeFrame(s > 0 ? 'n' : 's', X0, X1, zA, zB), (MM) => { sign3Board(MM, s > 0 ? 12.5 : 4.5, H - 1.0, 3.6, 0.9, SIGNS3.mareyage, [0.3, 0.3, 0.3]); });
  inFrame(facadeFrame('e', X0, X1, zA, zB), (MM) => { wallDecal3(MM, DEC3.poster2, s > 0 ? 2.4 : 10.6, 1.0, 0.9, 1.1); }); // (z = ±30,6, entre la grande porte et l'angle : au milieu de la porte, elle flottait)
  // intérieur : tables de parage, tapis, chambre froide, bacs, palettes
  // chambre froide à côté de la grande porte sud (x de -3 à 1), étals de part et d'autre de la porte ouest (z de 24 à 27,5), sans en barrer l'entrée
  M.place(PF.coldRoom(3.3, 3, 3.0), 2.95, 0, Z(31.0), s > 0 ? Math.PI : 0);
  for (const [x, z, r, k] of [[-9.0, 22.8, 0, 23.5], [-9.0, 28.4, 0, 27], [-5.5, 30.2, Math.PI / 2, 30.2]]) M.place(PF.etal(10 + Math.round(x + k)), x, 0, Z(z), r);
  M.place(PF.conveyor(6), -2.5, 0, Z(25.6), 0);
  // bacs et palettes hors des grandes portes (x de -6 à -2 au nord, de -3 à 1 au sud)
  for (const [x, z, n, k] of [[-11.2, 31.8, 4, 0], [-10.4, 31.9, 3, 2], [3.9, 21.2, 3, 1], [-7.0, 21.0, 2, 3], [1.2, 28.6, 2, 0]]) M.place(PF.fishBinStackDyn(n, k), x, 0, Z(z), R() * 0.3);
  for (const [x, z] of [[-8, 25], [-1, 25], [-4, 29.5]]) pendantLamp(x, 3.0, Z(z), H - 0.1);
}

/* ---------- Est : Café de la Marine, maisons, passages, Venelle ---------- */
function embrunsEast(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), zo = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; }, M = DECOR, R = rngOf(s > 0 ? 931 : 932);
  // Café de la Marine (x 15..23, z 12..19) : rez traversant (rue ↔ venelle), étage d'habitation
  {
    const X0 = 15, X1 = 23, [zA, zB] = zr(12, 19), t = 0.35, G = 3.2, h = 6.4, tint = [0.95, 0.93, 0.87], gran = [0.74, 0.72, 0.68];
    const o = { tint: gran, frames: true, frameTint: [0.16, 0.26, 0.42], m: 'concrete' };
    wallOpen('stone', 'z', X0 + t / 2, t, zA, zB, 0, G, [{ ...zo(14.6, 16.0), b0: 0, b1: 2.4 }, { ...zo(12.6, 14.0), b0: 0.6, b1: 2.5 }, { ...zo(16.6, 18.4), b0: 0.6, b1: 2.5 }], o);
    wallOpen('stone', 'z', X1 - t / 2, t, zA, zB, 0, G, [{ ...zo(16.0, 17.2), b0: 0, b1: 2.3 }, { ...zo(13.0, 14.4), b0: 1.0, b1: 2.2 }], o);
    wallOpen('stone', 'x', Z(12) + s * t / 2, t, X0 + t, X1 - t, 0, G, [{ a0: 18.2, a1: 19.6, b0: 1.0, b1: 2.2 }], o);
    wallOpen('stone', 'x', Z(19) - s * t / 2, t, X0 + t, X1 - t, 0, G, [{ a0: 18.4, a1: 19.8, b0: 1.0, b1: 2.2 }], o);
    // dalle rentrée de 2 cm dans les murs et 1 cm au-dessus de leur arase : dans leur plan, elle scintillait avec le granit
    box('plaster', X0 + 0.02, X1 - 0.02, G - 0.25, G + 0.01, zA + 0.02, zB - 0.02, { tint });
    ceilingJoists(X0 + t, X1 - t, zA + t, zB - t, G - 0.25);
    box('wood', X0 + t, X1 - t, 0, 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.5, 0.38, 0.28] });
    portHouse(X0, X1, zA, zB, { h, g0: G, faces: 'nsew', tint, alongX: false, chimneys: 2, R: rngOf(s > 0 ? 41 : 42), shutter: [0.16, 0.3, 0.5] });
    // vitrines (sans collision), enseigne, terrasse
    M.save().color([0.55, 0.6, 0.62]); M.cls = 1;
    for (const [a, b] of [zr(12.6, 14.0), zr(16.6, 18.4)]) M.quad('glass', [X0 + t / 2, 0.6, a], [X0 + t / 2, 0.6, b], [X0 + t / 2, 2.5, b], [X0 + t / 2, 2.5, a], [-1, 0, 0]);
    M.restore();
    inFrame(facadeFrame('w', X0, X1, zA, zB), (MM) => { sign3Board(MM, 3.5, G - 0.05, 5.2, 0.85, SIGNS3.marine, [0.16, 0.26, 0.42]); awningStriped(MM, s > 0 ? 1.6 : 5.4, G - 0.25, 2.4, 1.5, [[0.16, 0.3, 0.52], [0.95, 0.95, 0.92]]); });
    // bar : comptoir de zinc, étagères à bouteilles, tables
    const [ca, cb] = zr(12.8, 15.2);
    M.save().local(1).color([0.42, 0.28, 0.18]); M.boxB('wood', 20.6, 21.3, 0, 1.06, ca, cb);
    M.color([0.66, 0.68, 0.7]); M.boxB('steel', 20.5, 21.4, 1.06, 1.12, ca - 0.05, cb + 0.05, { bevel: 0.01 });
    // étagères sur le pan de mur plein entre la fenêtre et la porte (z 14,4 à 16) : de 12,8 à 15,2, elles passaient devant la fenêtre
    const [sa, sb] = zr(14.5, 15.9), sz = (z) => lerp(sa + 0.08, sb - 0.08, (z - ca - 0.15) / (cb - ca - 0.25)); // sz : place d'une bouteille (mêmes tirages qu'avant)
    M.color([0.35, 0.24, 0.16]); for (const y of [1.4, 1.9, 2.4]) M.boxB('wood', 22.3, 22.62, y, y + 0.04, sa, sb);
    // bouteilles : des corps physiques, qui reposent sur les étagères (collision réservée aux props) et éclatent sous une balle
    for (const y of [1.4, 1.9, 2.4]) M.pcol(22.3, 22.62, y, y + 0.04, sa, sb);
    for (const y of [1.44, 1.94, 2.44]) for (let z = ca + 0.15; z < cb - 0.1; z += 0.12 + R() * 0.08) { const tint = R.pick([[0.12, 0.3, 0.12], [0.4, 0.2, 0.1], [0.8, 0.75, 0.6], [0.1, 0.12, 0.2], [0.7, 0.6, 0.2]]); M.dyn('bottle', 22.46, y, sz(z), 0, { a: [Math.round((0.22 + R() * 0.08) * 50) / 50], tint }); }
    M.restore();
    WORLD.col({ x0: 20.5, x1: 21.4, y0: 0, y1: 1.12, z0: ca, z1: cb }, 'wood');
    for (const [x, z] of [[17.0, 13.6], [17.2, 17.4]]) { cafeSet(M, x, Z(z), [0.3 + R() * 0.2, Math.PI - 0.25 - R() * 0.2], [0.2, 0.3, 0.5]); } // (deux tirages par table : la suite du décor ne change pas)
    for (const z of [14.2, 16.8]) pendantLamp(18.5, 2.3, Z(z), G - 0.3);
    // terrasse sur la rue
    for (const z of [13.4, 17.6]) cafeSet(M, 14.1, Z(z), [s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI], [0.85, 0.85, 0.82]);
  }
  // passage entre la Fabrique et le café (z 9..12) et ruelle (z 19..21.5, linge tendu en travers), vélo
  clothesLine(19.0, Z(19.03), 19.0, Z(21.5), 4.9); // en travers de la ruelle, d'un mur à l'autre
  // vélo sur sa béquille le long du mur de la Fabrique, sous sa fenêtre, dans la longueur du passage (posé en travers, il entrait dans le mur et n'en
  // bougeait plus) ; à 60 cm du mur : un tir venu du passage le fait encore tomber contre le mur, au lieu de l'y plaquer sans qu'il bouge
  M.dyn('bicycle', 17.6, 0, Z(9.6), s > 0 ? Math.PI / 2 + 0.06 : Math.PI / 2 - 0.06, { tint: [0.6, 0.12, 0.1] });
  // maisons de pêcheur entre la rue et la Venelle
  { const [a, b] = zr(21.5, 29); portHouse(15, 23, a, b, { h: 6.6, faces: 'we' + (s > 0 ? 'n' : 's'), door: 'w', alongX: false, R: rngOf(s > 0 ? 51 : 52) }); }
  { const [a, b] = zr(29, 35); portHouse(15, 23, a, b, { h: 6.0, faces: 'we' + (s > 0 ? 's' : 'n'), door: 'e', alongX: false, R: rngOf(s > 0 ? 61 : 62) }); }
  // placette du calvaire (z 35..40) : croix de granit sur son socle, banc
  {
    const z = Z(37.6); M.save().move(19.5, 0, z).local(1).color([0.7, 0.68, 0.64]);
    M.boxB('stone', -0.9, 0.9, 0, 0.5, -0.9, 0.9, { bevel: 0.04 }); M.boxB('stone', -0.55, 0.55, 0.5, 0.95, -0.55, 0.55, { bevel: 0.03 });
    M.boxB('stone', -0.16, 0.16, 0.95, 3.9, -0.16, 0.16, { bevel: 0.02 }); M.boxB('stone', -0.7, 0.7, 3.0, 3.3, -0.14, 0.14, { bevel: 0.02 });
    M.restore();
    WORLD.col({ x0: 18.6, x1: 20.4, y0: 0, y1: 0.95, z0: z - 0.9, z1: z + 0.9 }, 'concrete'); WORLD.col({ x0: 19.3, x1: 19.7, y0: 0.95, y1: 3.9, z0: z - 0.2, z1: z + 0.2 }, 'concrete');
    M.place(PF.platformBench(), 16.2, 0, Z(38.2), Math.PI / 2);
  }
  // Venelle (x 23..28) : casiers, bouées, poubelles, filet qui sèche, mobylette
  // le long des maisons de l'est, entre leurs portes (z = 13,1 / 21,5 / 31,5 / 39,2 au nord, 12,6 / 19,5 / 26,3 / 36,2 au sud)
  M.place(PF.lobsterPots(2, 2, 1, s > 0 ? 8 : 9), 27.2, 0, Z(15.6), Math.PI / 2);
  M.place(PF.netPile(5 + (s > 0 ? 0 : 4), 1.8, 1.4, 0.7), 26.8, 0, Z(24.5), 0.6);
  M.dyn('buoy', 27.4, 0, Z(17.1), 0.3, { a: [0.3, 0.95, 0.42, 0.1] }); M.dyn('buoy', 27.5, 0, Z(17.8), 1.3, { a: [0.25, 0.95, 0.95, 0.9] });
  M.dyn('trashBag', 23.3, 0, Z(27.2), 0.4); M.dyn('trashBag', 23.35, 0, Z(27.8), 2.2);
  M.place(PF.moped(), 27.5, 0, Z(34.0), s > 0 ? Math.PI - 0.06 : 0.06, { tint: [0.15, 0.32, 0.6] });
  M.place(PF.dumpster(), 26.8, 0, Z(29.0), Math.PI / 2, { tint: [0.22, 0.4, 0.3] }); WORLD.col({ x0: 26.2, x1: 27.4, y0: 0.1, y1: 1.4, z0: Z(29.0) - 1.0, z1: Z(29.0) + 1.0 }, 'metal');
  clothesLine(23.19, Z(14.2), 28.0, Z(14.8), 3.6); // en travers de la venelle, d'un mur à l'autre
  // Rue du Port : fourgonnette, bornes, lampadaires
  car(11.8, Z(26.5), (s > 0 ? 0 : Math.PI) + 0.03, [0.9, 0.9, 0.88]);
  for (const z of [21.5, 31.5]) M.place(PF.bollard(), 14.6, 0, Z(z), 0);
  lampPost(14.6, Z(24), Math.PI); lampPost(9.4, Z(38), 0);
  groundDecal3(DEC3.oil, 12, Z(33), 2, 1.6, 0.4); puddleAdd(12.6, Z(20.5), 3, 2.4, 1.1, 24);
}

/* ---------- Bases (z 40..48) : parking du port, estacade et canots, camions frigorifiques ---------- */
function embrunsBase(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 1041 : 1042);
  // estacade sur pieux (x -42..-30, z 42..45) : platelage au niveau du quai, garde-corps, canots amarrés de part et d'autre
  {
    const [a, b] = zr(42, 45), x0 = -42, x1 = -30;
    box('boards', x0, x1, -0.28, 0, a, b, { tint: [0.62, 0.55, 0.48], m: 'wood' });
    M.save().local(1).color([0.4, 0.33, 0.26]);
    for (let x = x0 + 0.3; x < x1; x += 2.4) for (const z of [a + 0.2, b - 0.2]) { M.save().move(x, EM.wl - 2.5, z); M.cyl('wood', 0.16, 2.3 - EM.wl + 0.2, 8); M.restore(); }
    for (const z of [a + 0.05, b - 0.05]) M.boxB('wood', x0, x1, -0.5, -0.28, z - 0.08, z + 0.08);
    M.restore();
    for (const z of [a + 0.08, b - 0.08]) railing(z, z, 0, x0 + 0.3, x1 - 1.2, 'x');
    for (const x of [x0 + 0.6, x0 + 6.6]) M.place(PF.bitt(), x, 0, Z(43.5) + (s > 0 ? 0.6 : -0.6) * 0, 0, { nocol: true });
    waterObstacle([x0, x1, a, b], 1.5, [0.36, 0.3, 0.24], 0.3);
    edgeRun('x', a - 0.4, a, x0 - 0.4, EM.coast, []); edgeRun('x', b, b + 0.4, x0 - 0.4, EM.coast, []); waterEdge(x0 - 0.4, x0, a, b);
    floatAdd(PF.canot([0.92, 0.9, 0.84], 1 + (s > 0 ? 0 : 2)), -36.5, Z(40.5), s > 0 ? -Math.PI / 2 + 0.05 : Math.PI / 2 + 0.05, { L: 5.6, B: 2.1, roll: 0.035 });
    floatAdd(PF.canot([0.2, 0.42, 0.62], 2 + (s > 0 ? 0 : 2)), -38.0, Z(46.6), s > 0 ? -Math.PI / 2 - 0.08 : Math.PI / 2 - 0.08, { L: 5.6, B: 2.1, roll: 0.04 });
    mooringLine([-35.4, 0.0, Z(42.1)], [-35.0, -0.6, Z(41.0)], 0.2); mooringLine([-37.0, 0.0, Z(44.9)], [-37.2, -0.6, Z(46.0)], 0.2);
  }
  // camions frigorifiques à quai, palettes, conteneur frigorifique
  vehicle(PF.truck('box', { reefer: 1 }), -7.0, 0, Z(44.6), s > 0 ? -Math.PI / 2 : Math.PI / 2, { tint: [0.92, 0.92, 0.9] });
  vehicle(PF.truck('box', { reefer: 1 }), 9.5, 0, Z(45.8), s > 0 ? Math.PI / 2 : -Math.PI / 2, { tint: [0.9, 0.3, 0.12] });
  container(21.5, 0, Z(45.6), 'x', s > 0 ? [0.85, 0.85, 0.82] : [0.3, 0.5, 0.62]);
  // le conteneur de la base : une rampe de chargement et un palier sur poteaux mènent sur son toit (2,6 m), vigie sur la rue du Port
  { const [a, b] = zr(42.95, 44.35); ramp(18.5, 23.4, a, b, 'x', 0, 2.6, 'concrete', [0.7, 0.7, 0.68], { mat: 'concrete' });
    const [c, d] = zr(42.0, 44.36); box('concrete', 23.4, 25.6, 2.4, 2.6, c, d, { tint: [0.7, 0.7, 0.68] });
    for (const [x, z] of [[25.5, 43.0], [25.5, 44.2], [23.5, 42.1]]) box('steel', x - 0.1, x + 0.1, 0, 2.4, ...zr(z - 0.1, z + 0.1), { tint: [0.4, 0.42, 0.44] }); }
  // pile de caisses en travers de la rue du Port, au nord de A : la base voyait le point de 11 apparitions sur 12
  for (const [x, y, z, k, r] of [[5.95, 0, 34.0, 1.1, 0.05], [7.05, 0, 34.05, 1.1, -0.06], [5.92, 1.1, 34.0, 1.0, 0.05], [7.1, 1.1, 34.05, 1.0, -0.04]]) M.dyn('crate', x, y, Z(z), r, { a: [k], tint: [0.62, 0.5, 0.36] });
  for (const [x, z] of [[-17.5, 42.4], [-16.2, 42.6], [2.4, 42.2]]) M.place(PF.icePallet(), x, 0, Z(z), R() * 0.3);
  for (const [x, z, n, k] of [[-21.5, 46.8, 4, 0], [-20.6, 46.9, 3, 1], [16.2, 41.6, 2, 2], [-26.4, 41.2, 2, 3]]) M.place(PF.fishBinStackDyn(n, k), x, 0, Z(z), R() * 0.3);
  M.place(PF.netPile(9 + (s > 0 ? 0 : 1), 2.2, 1.6, 0.9), 25.6, 0, Z(41.8), 0.5);
  lampPost(-14.5, Z(47.4), s > 0 ? -Math.PI / 2 : Math.PI / 2); lampPost(15.5, Z(47.4), s > 0 ? -Math.PI / 2 : Math.PI / 2);
  groundDecal(13, -7, Z(41.5), 2.0, 7, Math.PI / 2 + 0.03); groundDecal(12, 9.5, Z(42.5), 2.5, 1.8, 0.4);
}

/* ---------- Pourtour : entrepôts et maisons au-delà des bases et de la Venelle, quais qui se prolongent ---------- */
function embrunsPerimeter() {
  const R = rngOf(5151), M = DECOR;
  for (const s of [1, -1]) {
    const z0 = s > 0 ? 48 : -58, z1 = s > 0 ? 58 : -48, face = s > 0 ? 'n' : 's';
    // entrepôts frigorifiques côté quai, maisons ensuite
    portWarehouse(-30, -14, z0, z1, 7.2, face, s > 0 ? 0 : 1);
    for (let x = -14; x < 36;) { const w = Math.min(36 - x, R.range(6.5, 9)); portHouse(x, x + w, z0, z1, { h: R.range(6.2, 8.4), faces: face, door: face, alongX: true, R: rngOf(Math.round(x * 13) + (s > 0 ? 7 : 9)), chimneys: R() < 0.7 ? 2 : 1 }); x += w; }
    // maisons de l'est, façades sur la Venelle (de la Fabrique de glace aux bases)
    for (let z = 9; z < 48;) { const w = Math.min(48 - z, R.range(6.5, 9.5)), [a, b] = [s * z, s * (z + w)].sort((p, q) => p - q); portHouse(28, 36, a, b, { h: R.range(6.0, 8.0), faces: 'w', door: 'w', alongX: false, R: rngOf(Math.round(z * 17) + (s > 0 ? 3 : 5)) }); z += w; }
    // quai qui se prolonge au-delà de la carte : hangars, chalutiers à quai
    for (let z = 58; z < 138;) { const w = R.range(12, 20), [a, b] = [s * z, s * Math.min(138, z + w)].sort((p, q) => p - q); portWarehouse(-24, -8, a, b, R.range(6.5, 9), 'w', Math.floor(R() * 2)); z += w + R.range(4, 10); }
    for (const z of [72, 98]) { const zc = s * z, o = { L: 22, B: 6, name: 3, hull: R.pick([[0.85, 0.42, 0.1], [0.14, 0.18, 0.2], [0.2, 0.42, 0.62]]), house: [0.55, 0.78], seed: 20 + z }; DECOR.place(PF.trawler(o), -33.45, EM.wl, zc, R() < 0.5 ? 0 : Math.PI); waterObstacle(hullOutline(HULL_TRAWLER, o.L, o.B, -33.45, zc, 0), 2.9, [0.3, 0.3, 0.3], 0.3); }
  }
  // l'est derrière la Fabrique de glace
  portHouse(28, 36, -9, 9, { h: 9.5, faces: 'w', alongX: false, R: rngOf(77), stone: true });
}
/* Entrepôt (frigorifique ou à filets) : murs enduits, rideaux métalliques fermés, toit de fibrociment ; face vers face */
function portWarehouse(x0, x1, z0, z1, h, face, kind = 0) {
  const R = rngOf(Math.round(x0 * 31 + z0 * 7) + 3), tint = kind ? [0.86, 0.84, 0.78] : [0.9, 0.9, 0.88], M = DECOR;
  DECOR.col(x0, x1, 0, h, z0, z1, 'concrete');
  for (const f of 'nsew') inFrame(facadeFrame(f, x0, x1, z0, z1), (MM) => {
    const len = (f === 'n' || f === 's') ? x1 - x0 : z1 - z0;
    if (f !== face) { MM.save().color(tint).world(1); MM.wall('plaster', len, h, []); MM.restore(); return; }
    const n = Math.max(1, Math.floor(len / 6)), ops = [];
    for (let i = 0; i < n; i++) { const a = (len * (i + 0.5)) / n; ops.push({ x0: a - 1.8, x1: a + 1.8, y0: 0, y1: 3.8, depth: 0.25 }); }
    MM.save().color(tint).world(1); wallPierced(MM, 'plaster', len, 0, h, ops, { depth: 0.25, back: true }); MM.restore();
    for (const op of ops) rollShutter(MM, op, 0.25, R.pick([[0.55, 0.57, 0.58], [0.3, 0.45, 0.6], [0.62, 0.3, 0.2]]), 0);
    MM.save().color([0.3, 0.42, 0.55]).local(1); MM.boxB('paint', -0.1, len + 0.1, h - 0.6, h - 0.2, 0, 0.1); MM.restore();
    if (len > 9) sign3Board(MM, len / 2, h - 1.65, 4.0, 0.9, kind ? SIGNS3.mareyage : SIGNS3.coop, [0.3, 0.3, 0.3]);
    wallDecal3(MM, DEC3.rust, len * 0.3, 3.9, 1.0, 2.0);
  });
  slateRoof(x0, x1, z0, z1, h, { alongX: (face === 'n' || face === 's'), pitch: 0.3, mat: 'corrugated', tint: [0.62, 0.62, 0.6], gable: tint, gableMat: 'plaster', rampants: false, chimneys: 0, R });
  void M;
}

/* ---------- Arrière-plan : digues et phares, côte lointaine, voiliers au mouillage ---------- */
function embrunsBackdrop() {
  const M = DECOR, R = rngOf(6262);
  WORLD.force = 'far';
  // digue nord (de la côte vers le large, puis vers le sud) et jetée sud : enrochements, mur de couronnement, phares
  const digue = (pts, w) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = hyp(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
      M.save().move(ax, 0, az).rotY(ang).color([0.66, 0.64, 0.6]).world(1);
      M.boxB('concrete', -1.2, 1.2, EM.wl - 1, 2.4, 0, L, { bevel: 0.05 });
      M.color([0.6, 0.6, 0.58]); M.boxB('concrete', -w / 2, w / 2, EM.wl - 1, 1.2, 0, L);
      M.restore();
      for (let d = 0; d < L; d += R.range(2.2, 3.2)) for (const side of [-1, 1]) {
        const t = d / L, x = lerp(ax, bx, t), z = lerp(az, bz, t), nx = Math.cos(ang) * side, nz = -Math.sin(ang) * side, off = w / 2 + R.range(0.5, 2.8);
        const rx = Math.round(R.range(1.4, 2.4) * 4) / 4;
        M.place(PF.boulder(1 + Math.floor(R() * 10), rx, Math.round(R.range(1.0, 1.8) * 4) / 4, Math.round(R.range(1.2, 2.2) * 4) / 4), x + nx * off, EM.wl - 0.9, z + nz * off, R() * TAU, { nocol: true });
      }
      waterObstacle([[ax - 6, az], [ax + 6, az], [bx + 6, bz], [bx - 6, bz]], 3, [0.42, 0.42, 0.4], 1);
    }
  };
  digue([[-30, -240], [-120, -205], [-128, -120], [-118, -30]], 6);
  // jetée sud en miroir de la digue nord (chantier des cartes, octobre 2026) : les deux feux de l'entrée du port, rouge au nord (Bravo),
  // vert au sud (Alpha), se voient de toute la carte (à 180 m, le phare vert ne se voyait de nulle part)
  digue([[-30, 240], [-120, 205], [-128, 120], [-118, 30]], 6);
  lighthouse(-118, -26, 15, [0.78, 0.12, 0.1], 2.4);
  lighthouse(-118, 26, 15, [0.12, 0.52, 0.22], 2.4);
  // côte lointaine : collines au nord et au sud, maisons blanches à toits d'ardoise sur les pentes
  for (const s of [1, -1]) {
    M.save().color([0.62, 0.66, 0.5]).local(1); M.cls = 1;
    const N = makeNoise(s > 0 ? 71 : 73);
    M.surf('rock', 40, 6, (u, v) => { const x = lerp(-420, 120, u), z = s * lerp(250, 420, v), n = N.fbm(u * 3, v, 32, 32, 4); return [x, -2 + smoothstep(0, 0.4, v) * (12 + n * 34) * (0.6 + 0.4 * Math.sin(u * 7)), z]; }, { uL: 540, vL: 170, flipN: s < 0 });
    M.restore();
    for (let i = 0; i < 40; i++) { const x = R.range(-260, 60), z = s * R.range(262, 300), w = R.range(7, 12); farBreton(x, z, w, R.range(6, 8), R.range(5, 7), R); }
  }
  // la ville vers l'est : toits d'ardoise et clocher
  for (let i = 0; i < 70; i++) { const x = R.range(44, 160), z = R.range(-150, 150); if (Math.abs(z) < 60 && x < 50) continue; farBreton(x, z, R.range(7, 12), R.range(6, 9), R.range(6, 9), R); }
  {
    const cx = 96, cz = -18;
    M.save().move(cx, 0, cz).color([0.7, 0.68, 0.64]).world(1); M.boxB('stone', -4, 4, 0, 22, -4, 4);
    M.local(1); M.color([0.62, 0.6, 0.56]); M.save().move(0, 22, 0); M.lathe('stone', [[0, 0], [4.2, 0], [3.2, 2], [0.6, 18], [0, 19]], 8); M.restore();
    M.restore();
  }
  WORLD.force = null;
  // voiliers et caseyeurs au mouillage dans l'avant-port
  for (const [x, z, k] of [[-62, -44, 1], [-78, 18, 2], [-66, 62, 3], [-92, -8, 4], [-84, 92, 5], [-58, 108, 6]]) floatAdd(PF.sailboat(k), x, z, R() * TAU, { L: 9, B: 3, draft: 0.05, roll: 0.05 });
  for (const [x, z] of [[-55, 30], [-70, -90]]) floatAdd(PF.canot(R.pick([[0.85, 0.85, 0.82], [0.2, 0.42, 0.62], [0.7, 0.18, 0.12]]), Math.round(x)), x, z, R() * TAU, { L: 5.6, B: 2.1, roll: 0.05 });
}
/* Maison lointaine : volume enduit blanc, toit d'ardoise, deux cheminées ; sans collision */
function farBreton(cx, cz, w, d, h, R) {
  const M = DECOR, rise = d * 0.45;
  M.save().move(cx, 0, cz).rotY(R() < 0.5 ? 0 : Math.PI / 2).color(R.pick(PAL_BZH.wash)).world(1);
  M.boxB('plaster', -w / 2, w / 2, 0, h, -d / 2, d / 2, { skip: 'y' });
  M.local(1); M.color([0.06, 0.06, 0.07]);
  for (const sd of [-1, 1]) for (let x = -w / 2 + 1.2; x < w / 2 - 0.8; x += 2.2) M.quad('dark', [x, h * 0.55, sd * (d / 2 + 0.01)], [x + 0.8, h * 0.55, sd * (d / 2 + 0.01)], [x + 0.8, h * 0.55 + 1.1, sd * (d / 2 + 0.01)], [x, h * 0.55 + 1.1, sd * (d / 2 + 0.01)], [0, 0, sd]);
  M.color([0.42, 0.44, 0.5]).world(1);
  for (const sd of [-1, 1]) M.quad('slate', [-w / 2 - 0.2, h, sd * (d / 2 + 0.25)], [w / 2 + 0.2, h, sd * (d / 2 + 0.25)], [w / 2 + 0.2, h + rise, 0], [-w / 2 - 0.2, h + rise, 0], [0, 1, sd]);
  M.color(R.pick(PAL_BZH.wash));
  for (const sd of [-1, 1]) M.tri3('plaster', [sd * w / 2, h, -d / 2], [sd * w / 2, h, d / 2], [sd * w / 2, h + rise, 0], [sd, 0, 0]);
  M.color([0.68, 0.66, 0.62]); for (const sd of [-1, 1]) M.boxB('stone', sd * (w / 2 - 0.5) - 0.4, sd * (w / 2 - 0.5) + 0.4, h + rise - 0.6, h + rise + 0.9, -0.45, 0.45);
  M.restore();
}

/* ---------- Sol ---------- */
function embrunsGround() {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, px = new Float32Array(W * H * 4), N = makeNoise(2911);
  const zone = (ch, x0, x1, z0, z1, soft = 0.6, k = 1) => {
    const i0 = Math.max(0, Math.floor((x0 - soft - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((x1 + soft - S.x0) * S.ppm));
    const j0 = Math.max(0, Math.floor((z0 - soft - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((z1 + soft - S.z0) * S.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm;
      const d = Math.min(x - x0, x1 - x, z - z0, z1 - z) + (N.fbm(x * 0.09, z * 0.09, 32, 32, 3) - 0.5) * 1.2;
      const w = smoothstep(-soft, soft, d) * k, o = (j * W + i) * 4;
      px[o + ch] = Math.max(px[o + ch], w);
    }
  };
  // dalles de granit des quais, pavés de la rue et de la Venelle, enrobé des bases et de l'esplanade de la Criée
  zone(0, -30, -15, -60, 60, 0.3); zone(0, -18, -15, -11, 11, 0.2);
  zone(1, 5, 15, -60, 60, 0.4); zone(1, 23, 28, -60, 60, 0.4); zone(1, 15, 23, 9, 12, 0.3); zone(1, 15, 23, -12, -9, 0.3);
  zone(1, 15, 23, 19, 21.5, 0.3); zone(1, 15, 23, -21.5, -19, 0.3); zone(1, 15, 28, 35, 40, 0.5); zone(1, 15, 28, -40, -35, 0.5);
  zone(2, -30, 36, 40, 60, 1.0, 0.9); zone(2, -30, 36, -60, -40, 1.0, 0.9); zone(2, -15, 5, 15, 20, 0.6, 0.85); zone(2, -15, 5, -20, -15, 0.6, 0.85);
  // salissures : traînées sombres le long des quais et devant les portes de la Criée
  zone(3, -30, -26, -40, 40, 1.2, 0.8); zone(3, -18, -15, -11, 11, 0.8, 0.9); zone(3, -15, -8, 15, 20, 1.0, 0.6); zone(3, -15, -8, -20, -15, 1.0, 0.6);
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const o = (j * W + i) * 4, x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm;
    const n2 = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
    let r = px[o], g = px[o + 1], b = px[o + 2]; b *= 1 - Math.max(r, g);
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255);
    out[o + 3] = Math.round(clamp(0.15 + n2 * 0.35 + px[o + 3] * (0.25 + n2 * 0.5), 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_EMBRUNS);
  // terre ferme seulement : pas de sol au-dessus de la mer ni de la darse
  const M = DECOR, [dx0, dx1, dz] = EM.darse, c = EM.coast; void dx0; WORLD.force = 'g';
  M.save().color([0.52, 0.52, 0.52]).local(1); M.aoFn = null;
  const quad = (x0, x1, z0, z1) => { M.save().move((x0 + x1) / 2, 0, (z0 + z1) / 2); M.plane('ground', x1 - x0, z1 - z0, 1, 1); M.restore(); };
  quad(c, 330, dz, 330); quad(c, 330, -330, -dz); quad(dx1, 330, -dz, dz);
  M.restore(); WORLD.force = null;
}

/* ---------- Définition de la carte (voir MAP_DEFS dans 02-map.js et 02z-load.js) ---------- */
MAP_DEFS.embruns = {
  type: 'open', // grande et ouverte (quais en enfilade) : README « Règles de conception d'une carte » ; règle le choix des armes des bots (botArmForMap)
  bounds: { x0: -44, x1: 28, z0: -48, z1: 48 },
  textures: ['plaster', 'plaster2', 'stone', 'brick', 'cobble', 'pavers', 'asphalt', 'rooftiles', 'wood', 'shutter', 'concrete', 'rock', 'boards', 'slate', 'crate', 'canvas', 'linge', 'rust', 'rollshutter', 'steel', 'paintwood', 'timber'],
  surfaces: PORT_SURFACES,
  // ambiance enregistrée (05c-ambiance.js) : le port (mer, clapot, vent marin), ressac le long des quais et dans la Darse, goélands
  // au-dessus de l'eau, drisses et coques des chalutiers, cloche de bouée au large, corne de brume lointaine
  // le lit est surtout de l'eau (clapot des pontons et du quai, mer au large) : il suit la distance à la mer (x < EM.coast) et à la Darse
  // (retour du propriétaire : « l'eau s'entend très fort sur toute la carte »)
  sound: { pack: 'amb_embruns', bed: 0.45,
    water: (x, z) => Math.min(Math.max(0, x - EM.coast), hyp(Math.max(0, x - EM.darse[1]), Math.max(0, Math.abs(z) - EM.darse[2]))),
    loops: [[-31.5, -1, 38], [-31.5, -1, 14], [-31.5, -1, -14], [-31.5, -1, -38], [-24, -1.2, 0]].map((p) => ({ id: 'a_waves', p, gain: 0.45, ref: 5, roll: 1.3, max: 120 })),
    spots: [
      { id: 'a_gull', every: [6, 16], gain: 0.4, at: () => new V3(rand(-80, -20), rand(8, 22), rand(-55, 55)), ref: 10 },
      { id: 'a_rigging', every: [10, 25], gain: 0.3, at: () => new V3(rand(-37, -30), rand(3, 8), rand(-40, 40)), ref: 6 },
      { id: 'a_creak', every: [12, 30], gain: 0.3, at: () => new V3(rand(-37, -24), rand(-0.5, 1.5), rand(-40, 40)), ref: 5 },
      { id: 'a_buoybell', every: [25, 60], gain: 0.3, at: () => new V3(rand(-110, -70), 0, rand(-60, 60)), ref: 20, roll: 0.7 },
      { id: 'a_foghorn', every: [90, 200], gain: 0.4, at: () => new V3(-400, 5, rand(-200, 200)), ref: 80, roll: 0.5 },
    ] },
  kit: () => portKit(),
  materials: (M) => makePortMaterials(M),
  // illustration des menus (tools/dev/illustrations.js) : la Darse et son chalutier, la Criée, le soleil sur la mer
  art: { cam: [-45, 2.2, 40], look: [-31, 1.8, 24], fov: 62 },
  // repères pour s'orienter (mesurés par tools/dev/visual/leveldesign.js) : les feux de l'entrée du port, un par moitié, et le clocher
  landmarks: [[-118, 17, -26, 'phare rouge'], [-118, 17, 26, 'phare vert'], [96, 40, -18, 'clocher']],
  splat: { x0: -52, z0: -70, w: 104, d: 140, ppm: 4 },
  far: 460,
  build() { embrunsLevel(); },
  after() { waterBuild({ deep: [0.006, 0.02, 0.028], shallow: [0.012, 0.032, 0.03], scatter: [0.012, 0.042, 0.038], foam: [0.74, 0.77, 0.77], refl: 0.92, floor: [2.2, 7, 20], abs: [1.15, 0.8, 0.75], sand: [0.34, 0.32, 0.26], caus: 0.4 }); },
  ready() { waterReady(); },
  // apparitions de l'équipe Alpha (sud) ; celles de Bravo en sont le miroir
  spawns: [[-33, 43.5], [-27, 43.6], [-23.5, 46.5], [-18.5, 44.8], [-13.5, 42.8], [-1.0, 42.6], [0.5, 46.8], [4.2, 43.2], [15.2, 44.2], [17.0, 47.3], [26.4, 46.8], [26.2, 43.8]],
  /* Points d'intérêt des bots : [x, y, z, route, tenue] ; route L (Quais, chalutiers, darse), M (Criée, esplanade, Mareyage),
     E (Rue du Port, Fabrique de glace et sa galerie, café, Venelle) */
  poi: [
    [-24, 0, 35, 'L'], [-24, 0, -35, 'L'], [-26.5, 0, 22.8, 'L'], [-26.5, 0, -22.8, 'L'], [-33.5, 0.4, 21.5, 'L', 1], [-33.5, 0.4, -21.5, 'L', 1], // sur le pont du chalutier, à côté du rouf
    [-22.5, 0, 13.8, 'L', 1], [-22.5, 0, -13.8, 'L', 1], [-24, 0.4, 5.2, 'L', 1], [-24, 0.4, -5.2, 'L', 1], [-16.4, 0, 6.5, 'L', 1], [-16.4, 0, -6.5, 'L', 1],
    [-13.4, 0, 9.0, 'M', 1], [-13.4, 0, -9.0, 'M', 1], // hors du chariot élévateur [-6.2, 0, 8.0, 'M'], [-6.2, 0, -8.0, 'M'], [-4.5, 0.4, 1.5, 'M', 1], [-4.5, 0.4, -1.5, 'M', 1], [-6.5, 0.8, 2.5, 'M', 1], [-6.5, 0.8, -2.5, 'M', 1], // les deux gradins
    [2.6, 0, 11.0, 'M'], [2.6, 0, -11.0, 'M'], [7.2, 3.8, 2.4, 'M', 1], [7.2, 3.8, -2.4, 'M', 1], [-4.0, 0, 17.5, 'M'], [-4.0, 0, -17.5, 'M'],
    [-4.0, 0, 26.6, 'M'], [-4.0, 0, -26.6, 'M'], [1.0, 0, 36.5, 'M'], [1.0, 0, -36.5, 'M'],
    [12.0, 0, 20.0, 'E'], [12.0, 0, -20.0, 'E'], [12.0, 3.8, -0.5, 'E', 1], // sur la passerelle [21.0, 3.8, 5.0, 'E', 1], [21.0, 3.8, -5.0, 'E', 1], [20.5, 0, 4.4, 'E', 1], [20.5, 0, -4.4, 'E', 1],
    [18.4, 0, 15.6, 'E', 1], [18.4, 0, -15.6, 'E', 1], [25.5, 0, 20.0, 'E'], [25.5, 0, -20.0, 'E'], [19.0, 0, 36.0, 'E'], [19.0, 0, -36.0, 'E'], [11.0, 0, 33.0, 'E'], [11.0, 0, -33.0, 'E'],
  ],
  // domination : A et C sur la rue du Port, à l'approche de chaque base ; B dans la Criée, au centre
  dom: [[-2, 29], [11.5, 0], [-1.5, -29.5]], // placés par le propriétaire avec l'outil des zones (?outil=zones, octobre 2026)
  mecha: [[9.5, 19.5], [9.5, -20.5], [-22.5, 17.5], [-22.5, -18.5]], // zones de largage du mecha (08f-mecha.js, mnavZones), placées de même
  lane: (x) => (x < -15 ? 'L' : x > 9 ? 'E' : 'M'),
  sniper: [-26.6, 0, 37.6], // bout du quai, côté de sa base : toute la longueur des quais en enfilade
  coverZ: 40,
  heli: [32, 50],
  cam: 48,
  // pas sur le pont des bateaux, la planche des coupées et l'estacade : métal ou bois ; ailleurs, dalles et pavés
  surface: (p) => (p.y > 0.2 && p.x < -20 ? 'metal' : p.x < -30 ? 'wood' : 'concrete'),
  zones: [
    [_t('Base Alpha'), -30, 28, 40, 48], [_t('Base Bravo'), -30, 28, -48, -40], [_t('Estacade'), -44, -30, 40, 48], [_t('Estacade'), -44, -30, -48, -40],
    [_t('Chalutier'), -37, -30, 14, 39], [_t('Chalutier'), -37, -30, -39, -14], [_t('Darse'), -30, -18, -11, 11], [_t('Quai de débarquement'), -18, -15, -11, 11],
    [_t('Quais'), -30, -15, 11, 40], [_t('Quais'), -30, -15, -40, -11],
    [_t('Mezzanine'), 4.6, 9, -8, 8], [_t('Criée'), -15, 9, -15, 15], [_t('Esplanade'), -15, 5, 15, 20], [_t('Esplanade'), -15, 5, -20, -15],
    [_t('Mareyage'), -12, 5, 20, 33], [_t('Mareyage'), -12, 5, -33, -20], [_t('Quais'), -15, -12, 20, 40], [_t('Quais'), -15, -12, -40, -20], [_t('Fabrique de glace'), 15, 28, -9, 9],
    [_t('Café de la Marine'), 15, 23, 12, 19], [_t('Café de la Marine'), 15, 23, -19, -12], [_t('Calvaire'), 15, 28, 35, 40], [_t('Calvaire'), 15, 28, -40, -35],
    [_t('Venelle'), 23, 28, -40, 40], [_t('Ruelles'), 15, 23, -40, 40], [_t('Rue du Port'), 5, 15, -40, 40], [_t('Rue du Port'), -12, 5, -40, 40],
  ],
  // ciel photographié (Poly Haven, kloofendal_misty_morning) : matin dans la brume, sa lueur tournée sur le soleil de la carte
  skyPhoto: { key: 'kloofendal_misty_morning', rot: 0.0925, gain: 1.3 },
  atmo: ATMO_EMBRUNS,
};
