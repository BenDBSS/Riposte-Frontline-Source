/* ==========================================================================
   GIVRE : gare frontière d'un col de montagne, coupée du monde par les avalanches. 48 x 96 m, tout en longueur,
   en miroir nord-sud (équipe Alpha au sud, +z ; Bravo au nord, -z). Plus resserrée que Khamsin : trois routes
   étroites, beaucoup de pièces et de couverts, des lignes de vue franches mais coupées à mi-carte.
   OUEST « Voies »   : deux voies le long de la falaise, wagons immobilisés (couvert, citerne, grumes) ; au centre la
                       Galerie pare-avalanche où dort le chasse-neige rotatif. Le Poste d'aiguillage (étage, grandes
                       vitres) surveille les voies de chaque côté ; à son pied, la cour du poste-frontière (A, C), que le
                       bureau de la douane sépare de la base. Le Quai longe la Gare sous sa marquise.
   CENTRE « Grand-Rue » : rue enneigée qui bute sur la Gare ; on traverse le centre par le hall (B : portes nord et sud,
                       deux sur le quai, guichet au milieu) ou on bascule par la Halle aux marchandises, l'Hôtel du Col ou les ruelles.
   EST « Village »   : ruelles de chalets, Placette et son sapin illuminé, Grange à fenil (poste surélevé), Scierie
                       ouverte au centre (grumes, chariot de scie), reliée à la Grand-Rue par la Cour de la gare.
   Les tirages sont reproductibles (graine fixe) : chaque pair d'un salon construit la même carte.
   ========================================================================== */
const ATMO_GIVRE = Object.assign({}, ATMO_DEFAULT, {
  // nuit de neige (chantier des ambiances, octobre 2026) : lune haute au sud-est, lumière bleue sur la neige, village allumé (réverbères,
  // appliques, sept fenêtres sur dix, guirlandes) ; la neige tombe. Lumière d'ambiance et plancher assez hauts pour voir un soldat dans l'ombre
  sun: [0.35, 0.55, -0.45], sunColor: 0x8fa8ff, sunI: 0.42, vmSun: 0x8fa8ff,
  fog: [0.1, 0.13, 0.22], fogD: 0.009,
  hemi: [0x4a6cb0, 0x8090b0, 0.3], vmHemi: [0x4a6cb0, 0x8090b0],
  sky: {
    zen: [0.005, 0.012, 0.04], mid: [0.02, 0.04, 0.1], hor: [0.08, 0.12, 0.22], gnd: [0.06, 0.07, 0.1],
    glow: [0.25, 0.3, 0.45], halo: [0.5, 0.55, 0.7], disk: [3, 3.2, 4], cloudLo: [0.68, 0.73, 0.82], cloudHi: [1.25, 1.2, 1.12], cloud: [0.55, 0.86, 0.75],
    ridge: [0.075, 0.07, 0.55], ridgeSnow: [0.35, 0.4, 0.55], ridgeRock: [0.08, 0.09, 0.12],
  },
  envGround: 0x2a3040, hdri: null, lit: true, lamps: 1.8, winLit: 0.7,
  bounce: [0.1, 0.13, 0.2], dust: [0.9, 0.92, 0.95], motes: null,
  grade: { lo: [0.88, 0.96, 1.14], hi: [1.08, 1.0, 0.9], exp: 1.3, con: 1.04, lift: 0.08 }, rays: [0.3, 0.35, 0.5],
  impact: [0.88, 0.9, 0.94], snow: { top: 1, foot: 0.85, color: [0.88, 0.9, 0.95] }, snowfall: 0.6, wind: [640, 0.075],
  bloom: [0.6, 0.6, 0.85], aoFloor: 0.4, raysThr: 2.5, raysCap: 1, satExp: 0.55,
});
const GROUND_GIVRE = { base: 'snow', l1: 'snowpack', l2: 'cobble', l3: 'asphalt', pom: [0, 0, 0.035, 0], dirt: [0.6, 0.58, 0.55], mul: 0, env: 0.45 };
const GV = { tracks: [-19.6, -15.0], bed: [-22.4, -12.9], quai: [-12.3, -9.0] };

/* ---------- Wagons (collisions : caisse, châssis et bogies ; on voit et on tire sous la caisse entre les bogies) ---------- */
/* Formes de collision des wagons (repère du wagon, hauteurs au-dessus du ballast) : jusqu'en 2.32, une boîte pleine par wagon, dont les angles
   vides arrêtaient les tirs (citerne ronde, pile de rondins) et sous le haut du toit cintré du wagon couvert, que les tirs traversaient */
const GV_SHAPES = {
  boxcar: [[-1.43, 1.43, 0.95, 3.72, -6.1, 6.1], [-1.48, 1.48, 3.72, 3.86, -6.16, 6.16], [-0.95, 0.95, 3.86, 4.04, -6.16, 6.16]],
  tankcar: [[-1.35, 1.35, 0.95, 1.2, -5.1, 5.1], [-0.95, 0.95, 1.2, 1.62, -4.65, 4.65], [-1.32, 1.32, 1.62, 3.48, -4.65, 4.65], [-0.95, 0.95, 3.48, 3.87, -4.65, 4.65],
    [-0.95, 0.95, 1.62, 3.48, -5.0, -4.65], [-0.95, 0.95, 1.62, 3.48, 4.65, 5.0], [-0.48, 0.48, 3.82, 4.35, -0.48, 0.48]],
  flatcar: [[-1.35, 1.35, 0.95, 1.25, -6.0, 6.0], [-1.3, 1.3, 1.25, 1.89, -5.45, 5.45], [-0.92, 0.92, 1.89, 2.4, -5.45, 5.45], [-0.57, 0.57, 2.4, 2.85, -5.45, 5.45]],
};
function gvWagon(pf, x, zc, rot, tint, b) {
  DECOR.place(pf, x, RAIL.bed, zc, rot, { tint, nocol: true });
  const y = RAIL.bed;
  // b.shape : forme du wagon en boîtes [x0, x1, y0, y1, z0, z1] (toit cintré, citerne ronde, pile de rondins), sinon une boîte pleine
  if (b.shape) colShape(x, y, zc, rot || 0, b.shape);
  else WORLD.col({ x0: x - b.hw, x1: x + b.hw, y0: y + b.y0, y1: y + b.y1, z0: zc - b.hl, z1: zc + b.hl }, 'metal');
  for (const bz of b.bogies || []) WORLD.col({ x0: x - 1.1, x1: x + 1.1, y0: y, y1: y + 0.85, z0: zc + bz - 1.35, z1: zc + bz + 1.35 }, 'metal');
}

/* Soubassement de pierre (x0..x1, hauteur h) le long d'un mur de zA à zB, interrompu par les portes (gaps : [z0, z1] triés) :
   jamais de rebord en travers d'une entrée, où l'on marche sans rien rencontrer */
function gvPlinth(x0, x1, h, zA, zB, gaps) {
  let cur = zA;
  for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g0 - cur > 0.02) DECOR.boxB('stone', x0, x1, 0, h, cur, g0); cur = g1; }
  if (zB - cur > 0.02) DECOR.boxB('stone', x0, x1, 0, h, cur, zB);
}

/* ---------- Plan ---------- */
function givreLevel() {
  SR.rng = rngOf(1847); // accessoires partagés avec Khamsin (sacs de sable...) : mêmes tirages chez tous
  givreRail();
  givreStation();
  for (const s of [1, -1]) givreHalf(s);
  givreCenter();
  givrePerimeter();
  givreBackdrop();
  givreGround(); // après les bâtiments : congères au pied des murs
}

/* ---------- Voies, galerie pare-avalanche, quai, marquise ---------- */
function givreRail() {
  const [xa, xb] = GV.tracks;
  trackBed(GV.bed[0], GV.bed[1], -58, 58);
  railTrack(xa, -62, 62); railTrack(xb, -62, 62);
  // Galerie : dalle sur piliers côté quai, adossée à la falaise ; fond sombre, lampes grillagées, suintements gelés
  const T = [0.76, 0.77, 0.79];
  box('concrete', -24, -12.2, 5.4, 6.15, -9.6, 9.6, { tint: T, bevel: 0.03 });
  box('concrete', -12.95, -12.2, 4.55, 5.4, -9.6, 9.6, { tint: T });
  for (const z of [-9.2, -4.6, 0, 4.6, 9.2]) {
    box('concrete', -12.95, -12.25, 0, 4.55, z - 0.4, z + 0.4, { tint: T, bevel: 0.02 });
    // goussets en haut des piliers
    for (const s of [-1, 1]) if (Math.abs(z + s * 0.4) < 9.6) { DECOR.save().color(T).world(1).move(-12.95, 4.55, z + s * 0.4).mul(basis([0, 0, s], [0, 1, 0], [1, 0, 0]).clone()); DECOR.extrude('concrete', [[0, 0], [0, -0.7], [0.6, 0]], 0.7); DECOR.restore(); }
  }
  box('concrete', -24, -23.55, 0, 5.4, -9.6, 9.6, { tint: [0.7, 0.71, 0.73] });
  snowCap(-24.6, -12.0, -9.85, 9.85, 6.15, 0.6, 3);
  // stalactites de suintement sous la poutre de rive
  DECOR.save().color([1, 1, 1]); DECOR.cls = 2;
  const RI = rngOf(4549);
  for (let z = -9.3; z < 9.3; z += RI.range(0.13, 0.33)) { const L = 0.05 + Math.pow(RI(), 3) * 0.55; DECOR.save().move(RI.range(-12.8, -12.35), 4.55, z).rotX(Math.PI); DECOR.cyl('ice', 0.012 + L * 0.03, L, 5, { r1: 0.002, caps: '' }); DECOR.restore(); }
  DECOR.restore();
  for (const z of [-6.9, 0, 6.9]) {
    DECOR.save().local(1).color([0.25, 0.25, 0.24]); DECOR.boxB('steel', -23.55, -23.35, 3.95, 4.45, z - 0.18, z + 0.18); DECOR.cls = 1; DECOR.color([1, 1, 1]); DECOR.boxB('lamp', -23.38, -23.3, 4.0, 4.4, z - 0.12, z + 0.12); DECOR.restore();
  }
  DECOR.save().move(-23.551, 0, 0).rotY(Math.PI / 2); wallDecal2(DECOR, DEC2.avalanche, 3.6, 1.6, 1.1, 1.1); wallDecal2(DECOR, DEC2.soot, -2.5, 2.4, 3.0, 2.0); DECOR.restore();
  // chasse-neige rotatif dans la galerie (voie ouest), pile de traverses entre les voies, armoires
  gvWagon(PF.snowplow(), xa, 0.35, 0, null, { hw: 1.5, y0: 0, y1: 4.0, hl: 6.8 });
  DECOR.place(PF.sleeperStack(5, 11), (xa + xb) / 2, RAIL.bed, 0, 0);
  // Quai : dalles enneigées, bordure de pierre, ligne de sécurité
  const [q0, q1] = GV.quai;
  box('pavers', q0, q1, 0, 0.4, -30, 30, { tint: [0.82, 0.82, 0.84], m: 'snow' });
  DECOR.save().color([0.86, 0.85, 0.83]).local(1);
  DECOR.boxB('ashlar', q0 - 0.06, q0 + 0.4, 0.3, 0.42, -30, 30, { bevel: 0.02 });
  DECOR.color([0.92, 0.9, 0.84]); DECOR.cls = 1; DECOR.boxB('paint', q0 + 0.62, q0 + 0.7, 0.4, 0.408, -30, 30); // 8 mm au-dessus du dallage (2 mm scintillaient de loin)
  DECOR.restore();
  // Marquise : colonnes de fonte, verrière sur fermes, lambrequin de bois découpé côté voies
  const mq = { y: 3.55, z: 14.5 };
  for (const z of [-13, -6.5, 0, 6.5, 13]) DECOR.place(PF.castColumn(mq.y), -11.55, 0.4, z, 0);
  WORLD.col({ x0: q0 + 0.1, x1: q1, y0: mq.y + 0.4, y1: mq.y + 0.62, z0: -mq.z, z1: mq.z }, 'metal');
  {
    const M = DECOR;
    M.save().color([0.14, 0.2, 0.17]).local(1);
    M.boxB('steel', q0 + 0.1, q1, mq.y + 0.4, mq.y + 0.52, -mq.z, mq.z);
    for (let z = -mq.z; z <= mq.z + 0.01; z += 1.45) M.boxB('steel', q0 + 0.1, q1, mq.y + 0.52, mq.y + 0.6, z - 0.04, z + 0.04);
    M.color([0.9, 0.95, 1]); M.cls = 1;
    M.boxB('glass', q0 + 0.12, q1 - 0.02, mq.y + 0.58, mq.y + 0.6, -mq.z, mq.z);
    // lambrequin : planches à pointe
    M.cls = 0; M.color([0.82, 0.78, 0.7]);
    for (let z = -mq.z + 0.06; z < mq.z; z += 0.13) { M.save().move(q0 + 0.08, mq.y + 0.52, z).mul(basis([0, 0, 1], [0, 1, 0], [1, 0, 0]).clone()); M.extrude('paintwood', [[-0.055, 0], [0.055, 0], [0.055, -0.42], [0, -0.52], [-0.055, -0.42]], 0.03); M.restore(); }
    M.restore();
    snowCap(q0 - 0.05, q1 + 0.05, -mq.z - 0.1, mq.z + 0.1, mq.y + 0.6, 0.18, 9);
    M.occ(q0, q1, mq.y + 0.3, mq.y + 0.6, -mq.z, mq.z, 0.9);
  }
  // au centre du quai : chariot à bagages, malles et sacs postaux (coupe la ligne de vue le long du quai)
  DECOR.place(PF.luggageCart(), -10.7, 0.4, 0, 0.08);
  // malles contre la colonne de la marquise, côté voies (5 cm de jeu avec la colonne et le chariot : elles l'enveloppaient)
  crate(-12.0, 0.4, -0.75, 0.6, 0.04); crate(-12.0, 0.4, 0.75, 0.6, -0.04); crate(-12.0, 1.0, 0.72, 0.5, 0.3);
  WORLD.col({ x0: -11.4, x1: -10.0, y0: 0.4, y1: 1.6, z0: -1.1, z1: 1.1 }, 'wood');
  for (const s of [1, -1]) {
    // banc contre la halle aux marchandises, entre les colonnes : à 2,6 m de sa porte (z = 12), qu'il ne frôle plus
    DECOR.place(PF.platformBench(), -9.55, 0.4, s * 8.4, -Math.PI / 2); WORLD.col({ x0: -9.9, x1: -9.0, y0: 0.4, y1: 0.9, z0: s * 8.4 - 1, z1: s * 8.4 + 1 }, 'wood');
    DECOR.save().move(-11.55, 0.4 + mq.y - 0.2, s * 6.5).rotY(Math.PI / 2); DECOR.put(PF.stationClock(), { cls: 1 }); DECOR.restore();
    for (const z of [21, 28.5]) DECOR.place(PF.lampPost(), -9.35, 0.4, s * z, -Math.PI); // sur le dallage du quai (0,4 m), pas dedans
    DECOR.place(PF.railSignal(), (xa + xb) / 2, RAIL.bed, s * 10.6, s > 0 ? 0 : Math.PI);
  }
}

/* ---------- Gare (centre) : hall traversant, étage enduit, toit d'ardoise, horloges, enseignes ---------- */
function givreStation() {
  const X0 = -9, X1 = 5, Z0 = -7, Z1 = 7, t = 0.45, G = 4.4, H = 8.3, stone = [0.86, 0.86, 0.88], pl = [0.94, 0.9, 0.82], frame = [0.28, 0.22, 0.16];
  // rez-de-chaussée : murs traversants (portes cintrées, hautes fenêtres)
  for (const s of [1, -1]) {
    wallOpen('ashlar', 'x', s * (Z1 - t / 2), t, X0, X1, 0, G, [
      { a0: 0.0, a1: 2.4, b0: 0, b1: 3.3, arch: 0.7 }, { a0: -2.3, a1: -1.2, b0: 2.2, b1: 3.8, arch: 0.4 }, { a0: 3.4, a1: 4.4, b0: 2.2, b1: 3.8, arch: 0.4 },
    ], { tint: stone, frameTint: frame });
  }
  wallOpen('ashlar', 'z', X0 + t / 2, t, Z0 + t, Z1 - t, 0, G, [
    { a0: -4.5, a1: -2.5, b0: 0, b1: 2.9, arch: 0.45 }, { a0: 2.5, a1: 4.5, b0: 0, b1: 2.9, arch: 0.45 }, { a0: -0.55, a1: 0.55, b0: 2.3, b1: 3.8, arch: 0.4 },
    { a0: -6.3, a1: -5.4, b0: 2.3, b1: 3.8, arch: 0.4 }, { a0: 5.4, a1: 6.3, b0: 2.3, b1: 3.8, arch: 0.4 },
  ], { tint: stone, frameTint: frame });
  // façade est (cour de la gare) : plus de porte depuis le chantier des cartes (octobre 2026). Le hall en avait cinq ; il en garde quatre
  // (nord et sud dans l'axe de la Grand-Rue, deux sur le quai), qu'un défenseur de B peut surveiller ; la cour entre par le nord ou le sud
  wallOpen('ashlar', 'z', X1 - t / 2, t, Z0 + t, Z1 - t, 0, G, [
    { a0: -2.2, a1: -1.3, b0: 2.2, b1: 3.8, arch: 0.4 }, { a0: 1.3, a1: 2.2, b0: 2.2, b1: 3.8, arch: 0.4 }, { a0: -4.8, a1: -3.6, b0: 2.2, b1: 3.8, arch: 0.4 }, { a0: 3.6, a1: 4.8, b0: 2.2, b1: 3.8, arch: 0.4 },
  ], { tint: stone, frameTint: frame });
  // sol de carreaux, plafond à solives, dalle de l'étage
  box('tiles', X0 + t, X1 - t, 0, 0.03, Z0 + t, Z1 - t, { collide: false, ao: false, tint: [0.78, 0.8, 0.84] });
  box('plaster', X0 + 0.01, X1 - 0.01, G, G + 0.4, Z0 + 0.01, Z1 - 0.01, { tint: [0.94, 0.92, 0.88] }); // 1 cm derrière les murs de l'étage (dans leur plan, il scintillait)
  ceilingJoists(X0 + t, X1 - t, Z0 + t, Z1 - t, G);
  // étage (plein) : façades enduites à fenêtres, bandeau de pierre, chaînes d'angle
  DECOR.col(X0, X1, G + 0.4, H, Z0, Z1, 'concrete');
  const R = rngOf(1847);
  for (const f of 'nsew') {
    const F = facadeFrame(f, X0, X1, Z0, Z1), len = F.len, n = Math.max(2, Math.round(len / 2.8)), ops = [];
    for (let i = 0; i < n; i++) { const a = (len * (i + 0.5)) / n; ops.push({ x0: a - 0.5, x1: a + 0.5, y0: G + 1.0, y1: G + 2.75, depth: 0.25, lit: R() < 0.45 }); }
    inFrame(F, (M) => {
      M.save().color(pl).world(1); M.aoFn = null;
      wallPierced(M, 'plaster', len, G, H - G, ops, { depth: 0.25 });
      M.restore();
      molding(M, 'ashlar', 0, len, G - 0.05, PROF.band, [0.84, 0.82, 0.8]);
      molding(M, 'ashlar', 0, len, H - 0.27, PROF.cornice, [0.86, 0.84, 0.8]);
      for (const op of ops) { windowJoinery(M, op, 0.25, [0.9, 0.88, 0.82], { glass: op.lit ? 'glassLit' : 'glass', curtain: R() < 0.5 ? [0.62, 0.2, 0.15] : null }); sill(M, op, 'ashlar', [0.86, 0.84, 0.8]); lintel(M, op, 'ashlar', [0.86, 0.84, 0.8]); if (f === 'n' || f === 's') shutters(M, op, [0.2, 0.34, 0.26], R() < 0.3 ? 'closed' : 'open', R); }
      for (const x of [0, len]) for (let y = 0.2, k = 0; y < H - 0.5; y += 0.45, k++) {
        const w = k % 2 ? 0.3 : 0.5;
        M.save().color([0.88, 0.87, 0.86]).world(1); lbox(M, 'ashlar', x === 0 ? 0 : len - w, x === 0 ? w : len, y, y + 0.41, 0, 0.04); M.restore();
      }
      // enseignes : GIVRE sur les pignons et côté quai, DOUANE côté cour, BUFFET sur le quai
      if (f === 'n' || f === 's') { sign2Board(M, len / 2, G + 2.8, 3.2, 0.8, SIGNS2.gare, [0.85, 0.83, 0.8]); } // sous la corniche (8,03 m), pas dedans
      if (f === 'w') { sign2Board(M, len / 2, 3.0, 3.6, 0.9, SIGNS2.gare, [0.12, 0.18, 0.15]); sign2Board(M, len / 2 + 4.6, 2.95, 2.6, 0.65, SIGNS2.buffet, null); sign2Board(M, len / 2 - 4.6, 2.95, 2.6, 0.65, SIGNS2.voies, null); wallDecal2(M, DEC2.departs, len / 2, 0.8, 1.3, 1.3, 0.012); }
      if (f === 'e') { sign2Board(M, len / 2, 3.3, 2.0, 0.55, SIGNS2.douane, [0.12, 0.18, 0.15]); }
      // affiches au milieu de chaque pilier du rez-de-chaussée (l'arche est à x de 0 à 2,4 : piliers de -9 à 0 et de 2,4 à 5) ; le repère du côté sud va dans le sens de x, celui du nord à l'envers
      if (f === 'n' || f === 's') { const u = (x) => (f === 's' ? x - X0 : X1 - x); wallDecal2(M, DEC2.poster, u(-4.5), 0.9, 0.9, 1.1); wallDecal2(M, DEC2.poster2, u(3.7), 0.95, 0.9, 1.1); }
    });
  }
  const roof = alpineRoof(X0, X1, Z0, Z1, H, { alongX: false, pitch: 0.62, mat: 'slate', tint: [0.62, 0.64, 0.7], chimney: true, gable: 'plaster', wood: pl, ovE: 0.7, ovG: 0.6, R });
  // horloges des pignons
  for (const s of [1, -1]) {
    const y = H + roof.rise * 0.38, z = s * (Z1 + 0.02);
    DECOR.save().move(-2, y, z).rotY(s > 0 ? 0 : Math.PI);
    DECOR.color([0.86, 0.84, 0.8]); DECOR.save().rotX(Math.PI / 2); DECOR.cyl('ashlar', 0.78, 0.12, 24); DECOR.restore();
    decal2Quad(DECOR, DEC2.clock, [-0.62, -0.62, 0.13], [0.62, -0.62, 0.13], [0.62, 0.62, 0.13], [-0.62, 0.62, 0.13], [0, 0, 1]);
    DECOR.restore();
  }
  // clocheton sur le faîtage : cloche, abat-son, toit pointu enneigé, girouette
  {
    const M = DECOR, yb = H + roof.rise + 0.05;
    M.save().move(-2, yb - 0.6, 0).color([0.9, 0.88, 0.84]).world(1);
    M.boxB('plaster', -0.8, 0.8, 0, 1.2, -0.8, 0.8);
    M.local(1); M.color([0.42, 0.32, 0.24]);
    for (const s of [-1, 1]) { M.boxB('wood', -0.72, 0.72, 1.2, 2.5, s * 0.72 - 0.06, s * 0.72 + 0.06); M.boxB('wood', s * 0.72 - 0.06, s * 0.72 + 0.06, 1.2, 2.5, -0.72, 0.72); }
    M.color([0.06, 0.06, 0.06]); M.boxB('dark', -0.6, 0.6, 1.3, 2.4, -0.6, 0.6);
    M.color([0.62, 0.48, 0.2]); M.save().move(0, 1.5, 0); M.lathe('steel', [[0, 0.75], [0.12, 0.72], [0.22, 0.5], [0.3, 0.12], [0.36, 0], [0, 0]], 12); M.restore();
    M.color([0.6, 0.62, 0.68]); M.save().move(0, 2.5, 0); M.lathe('slate', [[0, 1.7], [0.95, 0.05], [1.0, 0], [0, 0]], 4, { sharp: 0.2 }); M.restore();
    M.color([1, 1, 1]); M.save().move(0, 2.55, 0); M.lathe('snowmat', [[0, 1.45], [0.25, 1.2], [0.88, 0.12], [0.98, 0.0], [0.9, -0.05]], 4, { sharp: 0.3 }); M.restore();
    M.color([0.2, 0.2, 0.2]); M.save().move(0, 4.2, 0); M.cyl('steel', 0.02, 0.9, 5); M.restore();
    M.save().move(0.12, 4.85, 0); M.boxB('steel', -0.3, 0.3, 0, 0.18, -0.01, 0.01); M.restore();
    M.restore();
  }
  // intérieur : guichet au centre, bancs doubles, poêle, consignes, colonnes, horaires, lanternes
  {
    const M = DECOR;
    // guichet : 2,6 x 2,1 m (le point B, au milieu du hall, reste praticable aux trois quarts autour)
    const g0 = 0.0, g1 = 2.6, gz = 1.05, gm = (g0 + g1) / 2;
    M.save().local(1);
    M.color([0.2, 0.32, 0.25]); M.boxB('paintwood', g0, g1, 0, 1.1, -gz, gz);
    M.color([0.42, 0.3, 0.2]); M.boxB('wood', g0 - 0.1, g1 + 0.1, 1.1, 1.18, -gz - 0.1, gz + 0.1, { bevel: 0.015 });
    M.color([0.2, 0.32, 0.25]);
    for (const [x, z] of [[g0, -gz], [g1, -gz], [g0, gz], [g1, gz], [gm, -gz], [gm, gz], [g0, 0], [g1, 0]]) M.boxB('paintwood', x - 0.06, x + 0.06, 1.18, 2.3, z - 0.06, z + 0.06);
    M.cls = 1; M.color([1, 1, 1]);
    for (const s of [-1, 1]) { M.quad('glass', [g0 + 0.05, 1.25, s * gz], [g1 - 0.05, 1.25, s * gz], [g1 - 0.05, 2.25, s * gz], [g0 + 0.05, 2.25, s * gz], [0, 0, s]); M.quad('glass', [s > 0 ? g1 : g0, 1.25, -gz + 0.05], [s > 0 ? g1 : g0, 1.25, gz - 0.05], [s > 0 ? g1 : g0, 2.25, gz - 0.05], [s > 0 ? g1 : g0, 2.25, -gz + 0.05], [s, 0, 0]); }
    M.cls = 0; M.color([0.18, 0.28, 0.22]); M.boxB('paintwood', g0 - 0.15, g1 + 0.15, 2.3, 2.62, -gz - 0.15, gz + 0.15, { bevel: 0.03 });
    M.color([0.06, 0.06, 0.06]); M.boxB('dark', g0 + 0.1, g1 - 0.1, 1.2, 2.28, -gz + 0.1, gz - 0.1);
    M.restore();
    WORLD.col({ x0: g0, x1: g1, y0: 0, y1: 2.62, z0: -gz, z1: gz }, 'wood');
    // tableau des départs : un panneau mince à deux faces, posé sur le toit du guichet (le tableau flottait au-dessus, sans rien derrière)
    M.color([0.2, 0.32, 0.25]); M.boxB('paintwood', gm - 0.62, gm + 0.62, 2.62, 3.96, -0.05, 0.05, { bevel: 0.01 });
    WORLD.col({ x0: gm - 0.62, x1: gm + 0.62, y0: 2.62, y1: 3.96, z0: -0.05, z1: 0.05 }, 'wood');
    for (const s of [1, -1]) {
      M.save().color([1, 1, 1]).move(gm, 2.75, s * 0.056).rotY(s > 0 ? 0 : Math.PI); wallDecal2(M, DEC2.departs, 0, 0, 1.1, 1.1, 0); M.restore(); // teinte blanche : celle du panneau verdissait le tableau
    }
    // bancs doubles (dossier commun) côté quai
    for (const s of [-1, 1]) M.place(PF.platformBench(), -6.8 + s * 0.42, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    WORLD.col({ x0: -7.45, x1: -6.15, y0: 0, y1: 1.0, z0: -1.1, z1: 1.1 }, 'wood');
    // poêle en fonte et son tuyau
    M.save().color([0.12, 0.12, 0.12]).local(1).move(-3.4, 0, 0);
    M.lathe('steel', [[0, 0], [0.32, 0], [0.34, 0.12], [0.3, 0.2], [0.3, 0.85], [0.34, 0.92], [0.22, 1.02], [0.08, 1.06], [0, 1.06]], 14, { sharp: 0.5 });
    M.cyl('steel', 0.08, G - 0.1, 8); M.color([2.4, 0.9, 0.3]); M.cls = 1; M.boxB('bulb', -0.14, 0.14, 0.32, 0.5, 0.29, 0.31);
    M.restore();
    WORLD.col({ x0: -3.75, x1: -3.05, y0: 0, y1: 1.06, z0: -0.35, z1: 0.35 }, 'metal');
    // consignes à bagages le long du mur est
    for (const s of [1, -1]) {
      const [a, b] = [s * 2.5, s * 6.3].sort((p, q) => p - q);
      M.save().color([0.42, 0.3, 0.2]).local(1);
      M.boxB('wood', 3.75, 4.55, 0, 1.05, a, b); M.boxB('wood', 3.6, 4.6, 1.05, 1.12, a - 0.05, b + 0.05, { bevel: 0.01 });
      M.color([0.35, 0.25, 0.17]); for (const y of [1.6, 2.3, 3.0]) M.boxB('wood', 4.15, 4.55, y, y + 0.04, a, b);
      M.restore();
      WORLD.col({ x0: 3.6, x1: 4.55, y0: 0, y1: 1.12, z0: a, z1: b }, 'wood');
      for (const y of [1.6, 2.3, 3.0]) M.pcol(4.15, 4.55, y, y + 0.04, a, b); // les étagères retiennent les cartons
      for (let k = 0; k < 5; k++) { const z = a + 0.4 + k * 0.7; M.dyn('cardboard', 4.35, 1.64, z, 0.1 * k, { a: [0.4, 0.3, 0.32] }); if (k % 2) M.dyn('cardboard', 4.35, 2.34, z + 0.1, 0.3, { a: [0.36, 0.34, 0.3] }); }
      M.place(PF.castColumn(G), -5.2, 0, s * 3.6, 0, {}); M.place(PF.castColumn(G), 3.0, 0, s * 4.6, 0, {});
      M.place(PF.lantern(), -5.2, G - 0.1, s * 1.4, 0, { nocol: true }); M.place(PF.lantern(), 1.2, G - 0.1, s * 4.2, 0, { nocol: true });
      M.save().move(-3.4, 0, s * 6.55).rotY(s > 0 ? Math.PI : 0); wallDecal2(M, s > 0 ? DEC2.poster : DEC2.poster2, 0, 1.0, 0.9, 1.1); M.restore();
    }
  }
}

/* ---------- Une moitié de la carte (miroir en z) ---------- */
function givreHalf(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  const zop = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  const fN = s > 0 ? 'n' : 's', fS = s > 0 ? 's' : 'n'; // face tournée vers le centre / vers la base
  const R = rngOf(s > 0 ? 501 : 502);
  const [xa, xb] = GV.tracks;

  /* ----- Voies : wagons, cabane de cantonnier, couverts ----- */
  gvWagon(PF.boxcar(), xb, Z(18.5), s > 0 ? 0 : Math.PI, s > 0 ? [0.46, 0.27, 0.21] : [0.36, 0.41, 0.47], { shape: GV_SHAPES.boxcar, bogies: [-4.5, 4.5] });
  gvWagon(PF.tankcar(), xa, Z(29.7), s > 0 ? 0 : Math.PI, s > 0 ? [0.16, 0.16, 0.17] : [0.86, 0.86, 0.83], { shape: GV_SHAPES.tankcar, bogies: [-3.6, 3.6] });
  gvWagon(PF.flatcar(), xa, Z(41.0), s > 0 ? 0 : Math.PI, null, { shape: GV_SHAPES.flatcar, bogies: [-4.3, 4.3] }); // accolé à la citerne, 1,4 m de passage au mur du fond (la bande derrière lui finissait en impasse)
  DECOR.place(PF.sleeperStack(5, 6), (xa + xb) / 2, RAIL.bed, Z(30.3), 0);
  {
    // cabane de cantonnier sur le chemin de la falaise
    const [a, b] = zr(10.6, 13.6);
    chalet(-23.9, -21.7, a, b, { h: 2.5, g0: 2.5, ridge: 'z', faces: 'e', stone: false, lit: 0.6, balcony: false, chimney: true, tint: [0.62, 0.46, 0.34], wood: [0.6, 0.5, 0.42], roofTint: [0.5, 0.45, 0.42], pitch: 0.5, ovE: 0.5, ovG: 0.4 });
  }
  for (const [z, w, d, h] of [[21, 2.6, 1.6, 0.9], [35.5, 3.2, 1.8, 1.1]]) { DECOR.place(PF.snowMound(w, d, h, 2 + Math.round(z), 'ground'), -23.0, 0, Z(z), 0.2 * s); snowHeap(-23.0, Z(z), w * 0.75, d * 0.75, 0.2 * s); }
  WORLD.col({ x0: -23.9, x1: -22.3, y0: 0, y1: 0.85, z0: Z(35.5) - 1.3, z1: Z(35.5) + 1.3 }, 'snow');
  for (const z of [16, 28, 40]) DECOR.place(PF.pole(), -23.45, 0, Z(z), Math.PI / 2);

  /* ----- Halle aux marchandises (x -9..-3, z 7..20) : traversante, quai ↔ Grand-Rue ----- */
  {
    const X0 = -9, X1 = -3, t = 0.3, H = 4.7, [zA, zB] = zr(7, 20), tint = [0.88, 0.76, 0.64];
    // porte du quai (z 12 à 15) et fenêtre est relevée à 2,75 m : la mezzanine (z 7 à 11,6) passe au-dessus de la porte d'avant (10,5 à 13,5)
    // mur du quai 1 cm en avant de la façade de la gare : la chaîne d'angle de la gare (z 7 à 7,07) affleurait dans son plan
    wallOpen('boards', 'z', X0 + t / 2 - 0.01, t, zA, zB, 0, H, [{ ...zop(12.0, 15.0), b0: 0, b1: 3.2 }, { ...zop(16.5, 18.0), b0: 2.0, b1: 3.4 }], { tint, m: 'wood', frames: false });
    wallOpen('boards', 'z', X1 - t / 2, t, zA, zB, 0, H, [{ ...zop(15.0, 18.0), b0: 0, b1: 3.2 }, { ...zop(9.5, 11.0), b0: 2.75, b1: 3.95 }], { tint, m: 'wood', frames: false });
    wallOpen('boards', 'x', Z(20) - s * t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: -7.0, a1: -5.2, b0: 2.2, b1: 3.4 }], { tint, m: 'wood', frames: false });
    box('wood', X0 + t, X1 - t, 0, 0.04, ...zr(7, 20 - t), { collide: false, ao: false, tint: [0.6, 0.5, 0.4] }); // jusqu'au pignon (son bout scintillait dans sa face)
    // soubassement de pierre, portes coulissantes ouvertes, auvent côté quai
    DECOR.save().color([0.82, 0.8, 0.77]).world(1);
    gvPlinth(X0 - 0.06, X0, 0.6, zA, zB, [zr(12.0, 15.0)]); gvPlinth(X1, X1 + 0.06, 0.6, zA, zB, [zr(15.0, 18.0)]);
    DECOR.restore();
    DECOR.save().color([0.5, 0.26, 0.18]).local(1);
    { const [a, b] = zr(8.9, 11.9); DECOR.boxB('paintwood', X0 - 0.12, X0 - 0.05, 0.05, 3.3, a, b); }
    { const [a, b] = zr(11.8, 14.8); DECOR.boxB('paintwood', X1 + 0.05, X1 + 0.12, 0.05, 3.3, a, b); }
    DECOR.color([0.2, 0.2, 0.2]); DECOR.boxB('steel', X0 - 0.16, X0 - 0.04, 3.35, 3.45, zA + 0.3, zB - 0.3); DECOR.boxB('steel', X1 + 0.04, X1 + 0.16, 3.35, 3.45, zA + 0.3, zB - 0.3);
    DECOR.restore();
    alpineRoof(X0, X1, zA, zB, H, { alongX: false, pitch: 0.42, mat: 'slate', tint: [0.55, 0.52, 0.5], chimney: false, wood: [0.62, 0.52, 0.42], ovE: 0.9, ovG: 0.5, R });
    // mezzanine de stockage contre le mur de la gare (chantier des cartes, octobre 2026 ; esquisse val-blanc-refonte-b.js) : plancher à 2,5 m,
    // poutre de rive sur deux poteaux contre les murs, garde-corps ; rampe le long du mur est (1,75 m de large : la case x = -4,5 garde ses
    // 42 cm de chaque côté, mur invisible du garde-corps compris) ; par la fenêtre est, la Grand-Rue et la porte nord du hall
    {
      const [ma, mb] = zr(7.02, 11.6), zf = Z(11.6), [ea, eb] = zr(11.4, 11.6), wt = [0.58, 0.46, 0.34];
      box('wood', X0 + t + 0.01, X1 - t - 0.01, 2.35, 2.5, ma, mb, { tint: wt });
      DECOR.save().color([0.45, 0.36, 0.28]).local(1);
      DECOR.boxB('wood', X0 + t, X1 - t, 2.1, 2.35, ea, eb);
      for (const [p0, p1] of [[X0 + t, X0 + t + 0.18], [X1 - t - 0.18, X1 - t]]) DECOR.boxB('wood', p0, p1, 0, 2.1, ea, eb);
      DECOR.restore();
      WORLD.col({ x0: X0 + t, x1: X1 - t, y0: 2.1, y1: 2.35, z0: ea, z1: eb }, 'wood');
      for (const [p0, p1] of [[X0 + t, X0 + t + 0.18], [X1 - t - 0.18, X1 - t]]) WORLD.col({ x0: p0, x1: p1, y0: 0, y1: 2.1, z0: ea, z1: eb }, 'wood');
      railing(zf, 0, 2.5, X0 + t, -5.05, 'x');
      const [ra, rb] = zr(11.6, 15.8);
      ramp(-5.05, X1 - t - 0.01, ra, rb, 'z', s > 0 ? 2.5 : 0, s > 0 ? 0 : 2.5, 'wood', [0.55, 0.45, 0.36], { mat: 'wood' });
      railing(-5.07, 0, 0, ra, rb, 'z', s > 0 ? [2.5, 0] : [0, 2.5]);
    }
    // intérieur : caisses (sous la mezzanine), sacs sur palettes, bascule, diable
    // une seule pile, dans l'angle ouest : une rangée le long du mur de la gare fermait, avec la tête de la rampe et le mur est, une poche (impasse)
    crate(-8.05, 0, Z(7.75), 1.1, 0.1); crate(-8.05, 0, Z(9.05), 1.0, -0.2); crate(-8.0, 1.1, Z(7.8), 0.9, 0.2);
    DECOR.place(PF.pallet(), -7.4, 0, Z(17.8), 0.1); for (let k = 0; k < 3; k++) { DECOR.save().move(-7.4 + (k - 1) * 0.32, 0.12, Z(17.8)).rotY(Math.PI / 2); DECOR.dyn('sandbagLow', 0, 0, 0, 0, { tint: [0.9, 0.86, 0.74] }); DECOR.restore(); }
    WORLD.col({ x0: -8.0, x1: -6.8, y0: 0, y1: 0.5, z0: Z(17.8) - 0.5, z1: Z(17.8) + 0.5 }, 'dirt');
    barrel(-4.0, Z(19.2), [0.3, 0.42, 0.55]); barrel(-4.75, Z(19.4), [0.55, 0.2, 0.15]);
    DECOR.place(PF.lantern(), -6, H - 0.1, Z(13.5), 0, { nocol: true });
  }
  /* ----- Poste d'aiguillage (x -9..-4.5, z 24..29.5) : étage vitré sur les voies, escalier côté base ----- */
  {
    const X0 = -9, X1 = -4.5, [zA, zB] = zr(24, 29.5), F = 3.4, h2 = 2.45, t = 0.2;
    box('stone', X0, X1, 0, F, zA, zB, { tint: [0.84, 0.82, 0.8] });
    box('wood', X0 + t, X1 - t, F, F + 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.55, 0.42, 0.32] });
    const up = { tint: [0.72, 0.58, 0.46], floorY: F, m: 'wood', frames: false };
    wallOpen('boards', 'z', X0 + t / 2, t, zA, zB, F, h2, [{ ...zop(24.5, 29.0), b0: 0.95, b1: 2.15 }], up);
    wallOpen('boards', 'z', X1 - t / 2, t, zA, zB, F, h2, [{ ...zop(25.0, 28.5), b0: 0.95, b1: 2.15 }], up);
    wallOpen('boards', 'x', Z(24) + s * t / 2, t, X0 + t, X1 - t, F, h2, [{ a0: -8.5, a1: -5.0, b0: 0.95, b1: 2.15 }], up);
    wallOpen('boards', 'x', Z(29.5) - s * t / 2, t, X0 + t, X1 - t, F, h2, [{ a0: -8.05, a1: -6.95, b0: 0, b1: 2.1 }, { a0: -6.1, a1: -5.0, b0: 0.95, b1: 2.15 }], up);
    box('wood', X0, X1, F + h2, F + h2 + 0.2, zA, zB, { tint: [0.55, 0.42, 0.32] });
    alpineRoof(X0, X1, zA, zB, F + h2 + 0.2, { alongX: false, pitch: 0.5, mat: 'slate', tint: [0.5, 0.48, 0.48], chimney: true, wood: [0.68, 0.56, 0.44], ovE: 0.8, ovG: 0.6, R });
    // galerie de bois devant la porte, côté base, et escalier qui y monte le long de la façade (de l'est vers l'ouest, jusqu'à la porte :
    // on ne monte plus face au mur). Pente douce : les bots l'empruntent, la grille de navigation n'accepte pas plus de 0,62 m de montée
    // par mètre. L'escalier arrive sur un palier de 1,5 m au bout de la galerie, au-dessus du bout du quai, d'où l'on entre dans la galerie
    // sur toute sa profondeur (retour du propriétaire, octobre 2026 : en haut, on passait sur la galerie par un jour de 0,8 m, et rien ne
    // retenait du vide au bout de l'escalier). Garde-corps sur tout le tour de la galerie et du palier.
    {
      const [a, b] = zr(29.3, 31.0), [c, d] = zr(31.0, 32.3), [pa, pb] = zr(29.3, 32.3), XG = -4.0, XL = X0 - 1.5, wt = [0.55, 0.45, 0.36];
      box('wood', X0, XG, F - 0.15, F, a, b, { tint: wt });
      box('wood', XL, X0, F - 0.15, F, pa, pb, { tint: wt }); // palier
      railing(Z(30.97), 0, F, X0, XG, 'x'); DECOR.col(X0, XG, F, F + 1.0, Math.min(Z(30.92), Z(31.0)), Math.max(Z(30.92), Z(31.0)), 'wood');
      railing(XG - 0.02, 0, F, a, b, 'z'); DECOR.col(XG - 0.07, XG + 0.03, F, F + 1.0, a, b, 'wood');
      // garde-corps du palier : bord ouest (au-dessus du quai), bords nord et sud
      railing(XL + 0.05, 0, F, pa, pb, 'z'); DECOR.col(XL, XL + 0.1, F, F + 1.0, pa, pb, 'wood');
      for (const zz of [29.33, 32.27]) { railing(Z(zz), 0, F, XL, X0, 'x'); DECOR.col(XL, X0, F, F + 1.0, Z(zz) - 0.05, Z(zz) + 0.05, 'wood'); }
      ramp(X0, -3.1, c, d, 'x', F, 0, 'wood', wt, { mat: 'wood' });
      railing(Z(32.28), 0, 0, X0, -3.1, 'x', [F, 0]);
      // poteaux du palier (au sol, au nord du bout du quai) et jambes de force qui portent son bord sud, au-dessus du quai
      DECOR.save().color([0.45, 0.36, 0.28]).local(1);
      for (const zz of [30.45, 32.15]) { DECOR.boxB('wood', XL + 0.03, XL + 0.17, 0, F - 0.15, Z(zz) - 0.07, Z(zz) + 0.07); DECOR.col(XL + 0.03, XL + 0.17, 0, F - 0.15, Z(zz) - 0.07, Z(zz) + 0.07, 'wood'); }
      DECOR.save().move(XL + 0.1, F - 0.15, Z(30.45)).rotX(-s * Math.atan2(1.0, 0.9)); DECOR.boxB('wood', -0.05, 0.05, -1.3, 0, -0.05, 0.05); DECOR.restore();
      DECOR.restore();
    }
    DECOR.save().color([0.45, 0.36, 0.28]).local(1); for (const x of [-8.9, -6.6, -4.1]) DECOR.boxB('wood', x - 0.07, x + 0.07, 0, F - 0.15, Z(30.88) - 0.07, Z(30.88) + 0.07); DECOR.restore();
    // intérieur : rangée de leviers d'aiguillage, pupitre, poêle
    const M = DECOR;
    M.save().local(1);
    for (let k = 0; k < 10; k++) {
      const z = Z(24.9 + k * 0.42), c = [[0.7, 0.12, 0.1], [0.15, 0.3, 0.6], [0.1, 0.1, 0.1], [0.85, 0.7, 0.15]][k % 4];
      M.color(c); M.save().move(-8.1, F + 0.25, z).rotZ(k % 3 ? 0.25 : -0.3); M.boxB('steel', -0.025, 0.025, 0, 1.25, -0.02, 0.02); M.restore();
    }
    M.color([0.3, 0.3, 0.28]); M.boxB('steel', -8.5, -7.7, F, F + 0.3, Z(24.6), Z(29.1) + 0.0001);
    M.color([0.45, 0.33, 0.23]); M.boxB('wood', -5.5, -4.8, F, F + 0.95, ...zr(25.2, 27.4)); M.boxB('wood', -5.6, -4.75, F + 0.95, F + 1.0, ...zr(25.1, 27.5), { bevel: 0.01 });
    M.restore();
    WORLD.col({ x0: -5.5, x1: -4.8, y0: F, y1: F + 1.0, z0: Math.min(Z(25.2), Z(27.4)), z1: Math.max(Z(25.2), Z(27.4)) }, 'wood');
    M.place(PF.lantern(), -6.7, F + h2 - 0.05, Z(26.8), 0, { nocol: true });
  }
  /* ----- Cour de base ouest : bûcher, barrière ----- */
  // bûcher contre la façade sud de la guérite de la douane, à l'est du passage sous la barrière (dont il fermait la sortie)
  DECOR.place(PF.woodpile(2.0, 1.3, 0.6), -6.2, 0, Z(37.2), s > 0 ? 0 : Math.PI);
  /* ----- Poste-frontière (chantier des cartes, octobre 2026 ; esquisse : tools/dev/visual/esquisses/val-blanc-refonte-a.js) : la cour du point
     A n'avait pas de poste, et 10 des 12 apparitions de la base voyaient le point (celui qui le prenait tirait dans la base). Le bureau de la
     douane et sa guérite ferment la vue entre la base et la cour ; on passe entre les deux sous la barrière levée (1,4 m, une entrée de plus
     pour A). Une pile de grumes fait écran à l'est, face à la Grand-Rue ; un chariot à bagages et des caisses couvrent l'arrivée du centre. */
  {
    const [zA, zB] = zr(37.6, 40.1), yard = s > 0 ? 'n' : 's';
    const douane = { h: 3.2, g0: 3.2, ridge: 'x', faces: 'nsew', stone: true, lit: 0.5, balcony: false, tint: [0.86, 0.84, 0.8], wood: [0.55, 0.42, 0.3], roofTint: [0.5, 0.48, 0.48], pitch: 0.5, ovE: 0.35, ovG: 0.3 };
    chalet(-13.5, -9.0, zA, zB, { ...douane, chimney: true });
    chalet(-7.6, -5.0, zA, zB, { ...douane, chimney: false });
    inFrame(facadeFrame(yard, -13.5, -9.0, zA, zB), (M) => sign2Board(M, 2.25, 2.35, 2.0, 0.55, SIGNS2.douane, [0.12, 0.18, 0.15]));
    // barrière levée entre les deux : poteau rayé contre la guérite, lisse relevée (sans collision au-dessus du passage)
    const M = DECOR, zc = Z(38.85);
    M.save().local(1).color([0.92, 0.9, 0.86]); M.boxB('paintwood', -7.85, -7.65, 0, 1.1, zc - 0.1, zc + 0.1); M.restore();
    M.save().move(-7.75, 1.05, zc).rotZ(1.35).local(1);
    for (let i = 0; i < 6; i++) { M.color(i % 2 ? [0.92, 0.92, 0.9] : [0.72, 0.1, 0.08]); M.boxB('paintwood', i * 0.5, i * 0.5 + 0.5, -0.04, 0.04, -0.04, 0.04); }
    M.restore();
    WORLD.col({ x0: -7.85, x1: -7.65, y0: 0, y1: 1.1, z0: zc - 0.1, z1: zc + 0.1 }, 'wood');
    logPile(-2.0, Z(37.2), 1.6, 5, 0.33, 7 + s);
    DECOR.place(PF.luggageCart(), -12.8, 0, Z(29.4), 0);
    crate(-6.2, 0, Z(34.3), 1.0, 0.15); crate(-5.2, 0, Z(34.4), 0.8, 0.5);
  }

  /* ----- Grand-Rue (x -3..5) : camion militaire, 4x4, bourrelets, lampadaires, guirlandes ----- */
  truck(2.0, Z(22), 'z'); // militaire bâché, capot vers la gare (la cabine avancée du porteur, haute de 2,9 m, bouchait la vue du menu)
  car(1.0, Z(34.6), -0.25 * s, [0.55, 0.12, 0.1], false, 'offroad');
  snowBank(-3.0, -2.15, ...zr(8.6, 12.2), 0.75, 11 + s); // arrêté avant le lampadaire (z 13)
  snowBank(-3.0, -2.15, ...zr(21.0, 28.4), 0.85, 13 + s);
  snowBank(4.15, 5.0, ...zr(9.4, 14.6), 0.8, 15 + s);
  snowBank(4.15, 5.0, ...zr(18.0, 20.6), 0.7, 17 + s);
  lampPost(-2.6, Z(13), 0); lampPost(4.6, Z(27), Math.PI);
  stringLights([-3.0, 4.3, Z(10.5)], [5.0, 5.6, Z(12.5)], 0.5, 3 + s);
  stringLights([-3.0, 4.3, Z(18.5)], [5.0, 5.8, Z(20.0)], 0.6, 5 + s);
  stringLights([-4.45, 5.5, Z(28.4)], [5.0, 5.4, Z(31.0)], 0.6, 7 + s); // du mur du poste d'aiguillage à l'Hôtel
  // fontaine-abreuvoir gelée
  {
    const M = DECOR, z = Z(31.6);
    M.save().color([0.8, 0.79, 0.77]).local(1).move(3.7, 0, z);
    M.boxB('stone', -0.5, 0.5, 0, 0.75, -1.1, 1.1, { bevel: 0.04 });
    M.color([0.78, 0.86, 0.95]); M.boxB('ice', -0.4, 0.4, 0.62, 0.66, -1.0, 1.0);
    M.color([0.75, 0.74, 0.72]); M.boxB('stone', 0.32, 0.52, 0, 1.5, -0.2, 0.2); M.color([0.3, 0.3, 0.3]); M.tube('steel', 0.03, [[0.32, 1.3, 0], [0.05, 1.25, 0], [0, 1.1, 0]], 5);
    M.color([1, 1, 1]); M.save().move(0, 1.1, 0).rotX(Math.PI); M.cyl('ice', 0.05, 0.5, 6, { r1: 0.006, caps: '' }); M.restore();
    M.restore();
    WORLD.col({ x0: 3.2, x1: 4.22, y0: 0, y1: 0.75, z0: z - 1.1, z1: z + 1.1 }, 'concrete');
  }

  /* ----- Hôtel du Col (x 5..11, z 9..21) : bar traversant, trois niveaux de chalet ----- */
  {
    const X0 = 5, X1 = 11, [zA, zB] = zr(9, 21), t = 0.35, G = 3.4, stone = [0.88, 0.86, 0.84];
    wallOpen('stone', 'z', X0 + t / 2, t, zA + t, zB - t, 0, G, [{ ...zop(15.4, 16.9), b0: 0, b1: 2.4 }, { ...zop(11.0, 12.3), b0: 1.15, b1: 2.15 }], { tint: stone, frameTint: [0.32, 0.24, 0.17] });
    wallOpen('stone', 'z', X1 - t / 2, t, zA + t, zB - t, 0, G, [{ ...zop(11.6, 13.1), b0: 0, b1: 2.4 }, { ...zop(17.2, 18.5), b0: 1.15, b1: 2.15 }], { tint: stone, frameTint: [0.32, 0.24, 0.17] });
    wallOpen('stone', 'x', Z(9) + s * t / 2, t, X0, X1, 0, G, [{ a0: 7.3, a1: 8.7, b0: 1.15, b1: 2.15 }], { tint: stone });
    wallOpen('stone', 'x', Z(21) - s * t / 2, t, X0, X1, 0, G, [{ a0: 7.6, a1: 9.0, b0: 1.15, b1: 2.15 }], { tint: stone });
    box('wood', X0 + t, X1 - t, 0, 0.04, zA + t, zB - t, { collide: false, ao: false, tint: [0.56, 0.42, 0.3] });
    // dalle rentrée de 2 cm dans les murs et 1 cm au-dessus de leur arase : dans leur plan, elle scintillait avec la pierre
    box('plaster', X0 + 0.02, X1 - 0.02, G - 0.25, G + 0.01, zA + 0.02, zB - 0.02, { tint: [0.92, 0.9, 0.86] });
    ceilingJoists(X0 + t, X1 - t, zA + t, zB - t, G - 0.25);
    chalet(X0, X1, zA, zB, { hollow: true, g0: G, h: 9.0, ridge: 'z', faces: 'nsew', lit: 0.55, balcony: true, chimney: true, tint: [0.95, 0.92, 0.86], wood: [0.78, 0.64, 0.5], shutter: [0.6, 0.16, 0.12], roofTint: [0.55, 0.5, 0.48] });
    inFrame(facadeFrame('w', X0, X1, zA, zB), (M) => { sign2Board(M, 6, G + 0.15, 3.4, 0.85, SIGNS2.hotel, [0.3, 0.22, 0.15]); });
    // bar : comptoir et étagères, tables, cheminée allumée, lanternes
    const M = DECOR, [ca, cb] = zr(14.0, 19.2);
    M.save().local(1).color([0.45, 0.3, 0.2]);
    M.boxB('wood', 9.4, 10.0, 0, 1.08, ca, cb); M.boxB('wood', 9.3, 10.1, 1.08, 1.14, ca - 0.05, cb + 0.05, { bevel: 0.015 });
    // étagères sur le pan de mur plein entre la porte et la fenêtre (z 13,1 à 17,2) : de 14 à 19,2, elles passaient devant la fenêtre
    const [sa, sb] = zr(13.3, 17.0), sz = (z) => lerp(sa + 0.08, sb - 0.08, (z - ca - 0.15) / (cb - ca - 0.25)); // sz : place d'une bouteille (mêmes tirages qu'avant)
    M.color([0.38, 0.26, 0.18]); for (const y of [1.4, 1.9, 2.4]) M.boxB('wood', 10.35, 10.62, y, y + 0.04, sa, sb);
    // bouteilles : des corps physiques, qui reposent sur les étagères (collision réservée aux props) et éclatent sous une balle
    const RB = rngOf(77 + s);
    for (const y of [1.4, 1.9, 2.4]) M.pcol(10.35, 10.62, y, y + 0.04, sa, sb);
    for (const y of [1.44, 1.94, 2.44]) for (let z = ca + 0.15; z < cb - 0.1; z += 0.13 + RB() * 0.08) { const tint = RB.pick([[0.12, 0.3, 0.12], [0.4, 0.2, 0.1], [0.8, 0.75, 0.6], [0.1, 0.12, 0.2]]); M.dyn('bottle', 10.48, y, sz(z), 0, { a: [Math.round((0.24 + RB() * 0.06) * 50) / 50], tint }); }
    M.restore();
    WORLD.col({ x0: 9.3, x1: 10.1, y0: 0, y1: 1.14, z0: ca, z1: cb }, 'wood');
    tableSet(M, 7.0, Z(12.6), 0.1 * s, [[-0.5, 0.74], [0.45, -0.74], [-0.45, -0.74]], [0.55, 0.4, 0.28]);
    tableSet(M, 7.1, Z(18.9), -0.15 * s, [[0.5, 0.74], [-0.45, -0.74], [0.45, -0.74]], [0.55, 0.4, 0.28]);
    {
      const z = Z(9) + s * 0.55;
      M.save().color([0.8, 0.78, 0.75]).local(1).move(8.0, 0, z);
      M.boxB('stone', -1.0, 1.0, 0, 1.45, -0.35, 0.35); M.boxB('stone', -0.8, 0.8, 1.45, G - 0.25, -0.3, 0.3);
      M.color([0.05, 0.05, 0.05]); M.boxB('dark', -0.6, 0.6, 0.15, 1.0, -0.36, -0.1);
      M.cls = 1; M.color([2.6, 1.1, 0.35]); M.boxB('bulb', -0.4, 0.4, 0.18, 0.42, -0.3, -0.12);
      M.restore();
      WORLD.col({ x0: 7.0, x1: 9.0, y0: 0, y1: G - 0.25, z0: z - 0.35, z1: z + 0.35 }, 'concrete');
    }
    M.place(PF.lantern(), 7.0, G - 0.3, Z(15), 0, { nocol: true }); M.place(PF.lantern(), 9.0, G - 0.3, Z(11.4), 0, { nocol: true });
    M.place(PF.rugFloor(), 7.2, 0.045, Z(15.3), Math.PI / 2);
  }
  /* ----- Boulangerie (x 5..11, z 25..33) ----- */
  {
    const [a, b] = zr(25, 33);
    chalet(5, 11, a, b, { h: 6.4, g0: 3.0, ridge: 'x', faces: 'w' + fN + fS, door: 'w', lit: 0.5, stone: false, tint: [0.96, 0.9, 0.8], shutter: [0.2, 0.36, 0.26], pile: fN, pileCol: true });
    inFrame(facadeFrame('w', 5, 11, a, b), (M) => { sign2Board(M, 4.0, 2.75, 2.6, 0.65, SIGNS2.boulangerie, [0.3, 0.22, 0.15]); });
  }
  DECOR.place(PF.woodpile(2.6, 1.2, 0.55), 8.2, 0, Z(21.35), s > 0 ? 0 : Math.PI);
  DECOR.dyn('sled', 5.3, 0, Z(23.0), 0.4);

  /* ----- Village : chalet de la Placette, Placette et son sapin, Grange, chemins ----- */
  {
    const [a, b] = zr(10, 18);
    chalet(15, 24, a, b, { h: 6.9, g0: 3.0, ridge: 'x', faces: 'w' + fN + fS, door: fS, lit: 0.45, balcony: true }); // sans pile de bûches côté Scierie : la ruelle finissait en impasse derrière elle
  }
  {
    // Placette : sapin illuminé, abreuvoir, banc, lampadaire
    const zc = Z(20.6);
    // sapin de place taillé (premières branches à 2,4 m, leurs bouts à 1,9 m au plus bas) dans un bac de bois de 1,3 m : on passe sous ses
    // branches et des deux côtés du bac. Jusque-là, branché jusqu'au sol et cerné d'un bourrelet de neige de 4 m, il barrait la placette
    // (retour du propriétaire, octobre 2026 : il gênait toute la navigation)
    const xt = 22.0; // au bout est de la placette, sa couronne loin des portes de la Grange et du chalet
    DECOR.place(PF.xmasTree(6, 2.4), xt, 0, zc, 0, { nocol: true });
    DECOR.save().color([0.5, 0.38, 0.28]).local(1);
    DECOR.boxB('wood', xt - 0.65, xt + 0.65, 0, 0.5, zc - 0.65, zc + 0.65, { bevel: 0.02 });
    DECOR.color([0.4, 0.3, 0.22]); DECOR.boxB('wood', xt - 0.7, xt + 0.7, 0.44, 0.52, zc - 0.7, zc + 0.7, { bevel: 0.015 });
    DECOR.color([1, 1, 1]); DECOR.boxB('snowmat', xt - 0.58, xt + 0.58, 0.52, 0.56, zc - 0.58, zc + 0.58, { bevel: 0.03 });
    DECOR.restore();
    WORLD.col({ x0: xt - 0.7, x1: xt + 0.7, y0: 0, y1: 0.52, z0: zc - 0.7, z1: zc + 0.7 }, 'wood');
    WORLD.col({ x0: xt - 0.15, x1: xt + 0.15, y0: 0.52, y1: 4.5, z0: zc - 0.15, z1: zc + 0.15 }, 'wood');
    DECOR.place(PF.platformBench(), 23.4, 0, Z(19.6), -Math.PI / 2);
    lampPost(14.2, Z(22.6), s > 0 ? 0 : Math.PI); // contre le mur de la Grange, à l'écart de sa porte (x 17,4 à 20)
  }
  /* ----- Grange (x 13..21, z 23..32) : traversante nord-sud, fenil à l'ouest (rampe), fenêtre sur la Placette. Agencement repris
     (retour du propriétaire, octobre 2026 : l'escalier dépassait sur l'entrée, les bottes de foin barraient le milieu) : les deux portes
     (x 17,4 à 20) se font face dans l'axe d'un couloir droit, à 30 cm du garde-corps de la rampe (x 15,6 à 17,1, le long du fenil) ; le
     foin est rangé contre le mur est, au nord de sa porte, à l'écart des couloirs des portes ----- */
  {
    const X0 = 13, X1 = 21, [zA, zB] = zr(23, 32), t = 0.25, H = 5.0, tint = [0.56, 0.44, 0.36], L = 2.8;
    const o = { tint, m: 'wood', frames: false };
    wallOpen('boards', 'x', Z(23) + s * t / 2, t, X0, X1, 0, H, [{ a0: 17.4, a1: 20.0, b0: 0, b1: 3.0 }, { a0: 13.5, a1: 15.0, b0: L + 0.25, b1: 4.4 }], o);
    wallOpen('boards', 'x', Z(32) - s * t / 2, t, X0, X1, 0, H, [{ a0: 17.4, a1: 20.0, b0: 0, b1: 3.0 }], o);
    wallOpen('boards', 'z', X0 + t / 2, t, zA + t, zB - t, 0, H, [], o);
    wallOpen('boards', 'z', X1 - t / 2, t, zA + t, zB - t, 0, H, [{ ...zop(26.0, 27.3), b0: 0, b1: 2.2 }], o);
    DECOR.save().color([0.8, 0.78, 0.76]).world(1);
    gvPlinth(X0 - 0.06, X0, 0.5, zA, zB, []); gvPlinth(X1, X1 + 0.06, 0.5, zA, zB, [zr(26.0, 27.3)]);
    DECOR.restore();
    alpineRoof(X0, X1, zA, zB, H, { alongX: false, pitch: 0.5, mat: 'slate', tint: [0.45, 0.4, 0.36], chimney: false, wood: [0.5, 0.4, 0.33], ovE: 1.3, ovG: 1.0, R });
    box('dirt', X0 + t, X1 - t, 0, 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.66, 0.6, 0.52] });
    // fenil : plancher, poteaux, garde-corps ; rampe d'accès
    { const [a, b] = zr(23.25, 31.75); box('wood', X0 + t, 15.6, L - 0.15, L, a, b, { tint: [0.58, 0.46, 0.34] }); }
    DECOR.save().color([0.45, 0.36, 0.28]).local(1); for (const z of [24.5, 28, 31.4]) DECOR.boxB('wood', 15.45, 15.6, 0, L - 0.15, Z(z) - 0.08, Z(z) + 0.08); DECOR.restore();
    // palier d'arrivée de la rampe (contre le mur nord) : il prolonge le fenil jusqu'à la rampe, on tourne vers l'ouest au lieu de buter sur le vide.
    // Rampe et palier de 1,5 m (x 15,6 à 17,1), centrés sur la case x = 16,5 : à 1,1 m de large, aucun centre de case n'y gardait 42 cm de
    // chaque côté, le réseau n'y passait pas et le fenil restait hors d'atteinte des bots
    // Rampe et palier reculés de 0,8 m vers le nord (chantier des cartes) : le pied de la rampe et son garde-corps sont sortis du couloir de la porte
    // sud (x 16,4 à 19), et le dessous du fenil garde sa sortie par cette porte
    { const [a, b] = zr(23.25, 25.2); box('wood', 15.6, 17.1, L - 0.15, L, a, b, { tint: [0.58, 0.46, 0.34] }); railing(17.12, 0, L, a, b, 'z'); DECOR.col(17.1, 17.2, L, L + 1.0, a, b, 'wood');
      DECOR.save().color([0.45, 0.36, 0.28]).local(1); DECOR.boxB('wood', 16.95, 17.09, 0, L - 0.15, Z(24.6) - 0.07, Z(24.6) + 0.07); DECOR.restore(); }
    { const [a, b] = zr(25.2, 30.2); ramp(15.6, 17.1, a, b, 'z', s > 0 ? L : 0, s > 0 ? 0 : L, 'wood', [0.55, 0.45, 0.36], { mat: 'wood' }); railing(17.12, 0, 0, a, b, 'z', s > 0 ? [L, 0] : [0, L]); }
    // foin : bottes empilées (couvert bas), foin sur le fenil, charrette
    for (const [x, z, y, r] of [[20.35, 28.6, 0, Math.PI / 2], [20.35, 29.6, 0, Math.PI / 2 + 0.05], [20.35, 29.1, 0.45, Math.PI / 2 - 0.1], [14.3, 30.5, L, 0.3], [14.4, 29.6, L, -0.2], [14.3, 30.0, L + 0.45, 0.1]]) DECOR.dyn('hayBale', x, y, Z(z), r);
    DECOR.place(PF.snowMound(1.8, 1.1, 0.35, 12), 14.2, L, Z(25.0), 0, { tint: [0.9, 0.78, 0.5] });
    DECOR.place(PF.lantern(), 17.6, H - 0.15, Z(27.5), 0, { nocol: true });
  }
  // chemins : bûchers, barrière, luge, skis, bonhomme de neige
  DECOR.place(PF.woodpile(3.2, 1.4, 0.55), 23.65, 0, Z(31.0), -Math.PI / 2);
  DECOR.dyn('snowman', 15.2, 0, Z(35.4), s > 0 ? Math.PI : 0); // à côté de l'axe de la porte de la Grange (x 17,4 à 20), pas dedans
  skiRackAt(DECOR, 14.75, Z(32) + s * 0.56, s > 0 ? 0 : Math.PI, [[0.75, 0.15, 0.12], [0.2, 0.35, 0.6], [0.9, 0.7, 0.15], [0.15, 0.15, 0.17]]); // râtelier contre le mur de la Grange

  /* ----- Base (z 38..48) : tente, camion, caisses, sacs de sable, bourrelets ----- */
  { const tz = Z(45.5); DECOR.place(PF.tent(), -4.0, 0, tz, 0, { nocol: true }); box('canvas', -7.5, -0.5, 0, 2.1, tz - 2.2, tz + 2.2, { m: 'dirt', skip: 'xXyYzZ' }); }
  truck(9.0, Z(44.5), 'x', 'cargo', { load: 'tarp' }, [0.36, 0.42, 0.3]); // porteur bâché à cabine avancée
  crate(16.5, 0, Z(41.2), 1.2, 0.2); crate(17.95, 0, Z(41.0), 1.1, 0.5); crate(17.2, 1.2, Z(41.1), 1.0, 0.1);
  sandbags(13.0, Z(39.0), 2.4, 'x', 4, 0, 'kaki');
  snowBank(19.5, 24.0, ...zr(38.4, 39.4), 0.8, 31 + s);
  snowBank(-3.0, 1.0, ...zr(38.2, 39.2), 0.7, 33 + s);
  DECOR.place(PF.generator(), 1.5, 0, Z(47.2), 0, { tint: [0.4, 0.44, 0.3] });
  // pas de sapin dans les coins de la base : ses branches basses (3 m d'envergure) y fermaient le passage
}

/* ---------- Centre : cour de la gare, scierie ---------- */
function givreCenter() {
  // Cour : voiture enneigée au milieu, bûchers contre l'hôtel, tonneaux, lampadaire
  car(9.0, 0, Math.PI / 2 + 0.12, [0.25, 0.34, 0.48]); // à 2 m de la porte est de la gare (x = 5) : à 8,4, son coffre en fermait presque le passage
  for (const s of [1, -1]) {
    DECOR.place(PF.woodpile(3.0, 1.3, 0.55), 8.0, 0, s * 8.35, s > 0 ? Math.PI : 0);
    barrel(5.7, s * 5.6, [0.3, 0.32, 0.28]);
  }
  lampPost(11.4, -3.6, Math.PI / 2);
  // Scierie : grand appentis ouvert, grumes, chariot de scie, piles de planches, sciure
  const X0 = 12.3, X1 = 24, Z0 = -8.5, Z1 = 8.5, H = 5.0;
  for (const x of [12.6, 18.2, 23.6]) for (const z of [-8.1, -2.7, 2.7, 8.1]) {
    if (x === 18.2 && Math.abs(z) < 3) continue;
    box('wood', x - 0.16, x + 0.16, 0, H, z - 0.16, z + 0.16, { tint: [0.55, 0.42, 0.32], m: 'wood' });
  }
  DECOR.save().color([0.5, 0.38, 0.28]).local(1);
  for (const x of [12.6, 18.2, 23.6]) DECOR.boxB('wood', x - 0.15, x + 0.15, H - 0.3, H, Z0, Z1);
  DECOR.restore();
  box('dirt', 12.6, 23.6, 0, 0.02, -8.1, 8.1, { collide: false, ao: false, tint: [0.78, 0.66, 0.5] }); // sol de terre battue et de sciure
  wallOpen('boards', 'z', 23.85, 0.3, Z0, Z1, 0, 4.2, [{ a0: -1.2, a1: 1.2, b0: 1.4, b1: 2.6 }], { tint: [0.52, 0.42, 0.34], m: 'wood', frames: false });
  alpineRoof(X0, X1, Z0, Z1, H, { alongX: false, pitch: 0.3, mat: 'corrugated', tint: [0.7, 0.68, 0.64], chimney: false, wood: [0.5, 0.4, 0.33], ovE: 0.7, ovG: 0.6, snowT: 0.38 });
  inFrame(facadeFrame('w', X0, X1, Z0, Z1), (M) => sign2Board(M, 8.5, H - 0.95, 3.4, 0.85, SIGNS2.scierie, [0.28, 0.2, 0.14]));
  // grumes : pile au centre (coupe la ligne de vue de la ruelle) et deux grandes piles
  logPile(12.0, 0, 2.7, 3, 0.33, 1);
  for (const s of [1, -1]) logPile(14.5, s * 5.0, 5.4, 4, 0.33, 2 + s);
  // chariot de scie : bâti en acier sur rails, grume, cadre de scie
  {
    const M = DECOR;
    M.save().local(1).color([0.25, 0.25, 0.25]);
    for (const x of [19.4, 21.4]) M.boxB('rust', x - 0.06, x + 0.06, 0, 0.12, -6.5, 6.5);
    M.boxB('rust', 19.2, 21.6, 0.35, 0.7, -4.8, 4.8, { bevel: 0.03 });
    for (const z of [-4, 0, 4]) for (const x of [19.4, 21.4]) M.boxB('rust', x - 0.1, x + 0.1, 0, 0.35, z - 0.2, z + 0.2);
    M.color([0.62, 0.62, 0.6]); M.boxB('steel', 19.05, 21.75, 0, 3.4, -0.35, -0.2); M.boxB('steel', 19.05, 21.75, 0, 3.4, 0.2, 0.35);
    M.boxB('steel', 19.0, 21.8, 3.2, 3.5, -0.4, 0.4, { bevel: 0.03 });
    M.color([0.85, 0.85, 0.86]); for (let x = 19.3; x < 21.6; x += 0.18) M.boxB('steel', x - 0.006, x + 0.006, 0.7, 3.2, -0.04, 0.04);
    M.color([0.9, 0.72, 0.1]); M.boxB('paint', 19.0, 21.8, 2.9, 3.0, -0.42, -0.36);
    M.restore();
    M.save().color([0.95, 0.95, 0.95]).local(1).move(20.4, 1.05, -4.6).rotX(Math.PI / 2); M.cyl('bark', 0.36, 9.2, 12, { caps: '' }); M.restore();
    for (const s of [1, -1]) { M.save().move(20.4, 1.05, s * 4.6).rotX(s * Math.PI / 2); M.cyl('logend', 0.36, 0.0005, 12, { caps: 't', side: false }); M.restore(); }
    WORLD.col({ x0: 19.2, x1: 21.6, y0: 0, y1: 1.4, z0: -4.8, z1: 4.8 }, 'metal');
    WORLD.col({ x0: 19.05, x1: 21.75, y0: 0, y1: 3.5, z0: -0.4, z1: 0.4 }, 'metal');
  }
  for (const s of [1, -1]) {
    DECOR.place(PF.snowMound(2.2, 1.6, 0.7, 7 + s), 17.0, 0, s * 1.6, 0, { tint: [0.82, 0.66, 0.44] });
    WORLD.col({ x0: 16.3, x1: 17.7, y0: 0, y1: 0.5, z0: s * 1.6 - 0.5, z1: s * 1.6 + 0.5 }, 'dirt');
    DECOR.place(PF.lantern(), 16.0, H - 0.3, s * 5.4, 0, { nocol: true });
  }
}

/* ---------- Pourtour : falaise, tunnels, chalets de l'est et des bouts de la vallée ---------- */
function givrePerimeter() {
  // falaise ouest (pas de sapin au pied des tours repères du replat)
  rockWall(-24, -64, 64, 15.5, 1, 1913, { clear: (x, z) => Math.abs(Math.abs(z) - GV_TOWER.z) < 3.5 && x > GV_TOWER.x - 4 });
  givreTowers();
  // portails des tunnels (voies) aux deux bouts, dans la masse rocheuse
  for (const s of [1, -1]) {
    const M = DECOR, zf = s * 48, x0 = -24, x1 = -10, cx = -17.3, w = 10.4, hA = 6.6;
    WORLD.col({ x0: x0 - 12, x1, y0: 0, y1: 16, z0: s > 0 ? zf + 0.4 : zf - 14, z1: s > 0 ? zf + 14 : zf - 0.4 }, 'concrete');
    // parement de pierre de taille percé de l'arc, dans le repère du portail (x local de -7 à 7, façade vers la carte)
    M.save().move(cx, 0, zf).rotY(s > 0 ? Math.PI : 0).move(-7, 0, -0.4);
    M.color([0.8, 0.79, 0.78]).world(1);
    wallPierced(M, 'ashlar', 14, 0, 10, [{ x0: 7 - w / 2, x1: 7 + w / 2, y0: 0, y1: hA, rise: 2.4, depth: 1.2, ferme: true }], { depth: 1.2 }); // fermé : portes au sud, avalanche au nord
    M.local(1); M.color([0.72, 0.71, 0.7]); lbox(M, 'ashlar', -0.2, 14.2, 10, 10.5, -0.1, 0.25);
    M.color([0.03, 0.03, 0.03]); M.quad('dark', [7 - w / 2, 0, -8], [7 + w / 2, 0, -8], [7 + w / 2, hA, -8], [7 - w / 2, hA, -8], [0, 0, 1]);
    M.boxB('dark', 7 - w / 2, 7 - w / 2 + 0.01, 0, hA, -8, -1.2); M.boxB('dark', 7 + w / 2 - 0.01, 7 + w / 2, 0, hA, -8, -1.2); M.boxB('dark', 7 - w / 2, 7 + w / 2, hA - 0.01, hA + 2.4, -8, -1.2);
    M.restore();
    // sud : portes du tunnel fermées ; nord : coulée d'avalanche qui obstrue l'entrée
    if (s > 0) {
      M.save().move(cx, 0, zf + 1.4).color([0.42, 0.28, 0.2]).local(1);
      for (const side of [-1, 1]) { M.boxB('paintwood', side < 0 ? -w / 2 : 0.02, side < 0 ? -0.02 : w / 2, 0, hA + 0.6, -0.1, 0.1); M.color([0.18, 0.18, 0.18]); for (const y of [0.8, 3.2, 5.6]) M.boxB('rust', side < 0 ? -w / 2 : 0.1, side < 0 ? -0.1 : w / 2, y, y + 0.16, 0.1, 0.16); M.color([0.42, 0.28, 0.2]); }
      M.restore();
    } else {
      for (const [x, z, w2, d2, h2, k] of [[-17.3, -49.5, 9.0, 6.0, 4.2, 1], [-14.2, -48.8, 4.5, 3.0, 1.6, 2], [-20.5, -48.6, 4.0, 2.8, 1.4, 3]]) { M.place(PF.snowMound(w2, d2, h2, k, 'ground'), x, 0, z, 0.3, { cls: 0 }); snowHeap(x, z, w2 * 0.75, d2 * 0.75, 0.3); }
      for (const [x, z, r] of [[-15.4, -48.7, 0.4], [-19.6, -48.9, 1.6]]) { M.save().move(x, 0.35, z).rotY(r).rotZ(Math.PI / 2 - 0.25); M.color([0.95, 0.95, 0.95]); M.cyl('bark', 0.18, 3.2, 7, { caps: '' }); M.restore(); }
    }
    // masse rocheuse au-dessus et à côté du portail, neige, sapins
    const R = rngOf(s > 0 ? 71 : 72);
    for (let x = -23; x < -10.5; x += R.range(2.5, 3.6)) {
      const rx = Math.round(R.range(1.5, 2.4) * 4) / 4, ry = Math.round(R.range(1.4, 2.0) * 4) / 4, rz = Math.round(R.range(1.6, 2.4) * 4) / 4;
      M.place(PF.boulder(1 + Math.floor(R() * 12), rx, ry, rz), x, 9.6, zf + s * (Math.max(rx, rz) + 0.9 + R() * 1.5), R() * TAU, { nocol: true });
    }
    M.save().color([1, 1, 1]).world(1);
    M.boxB('snowmat', -26, -9.5, 14.2, 15.2, s > 0 ? zf + 1 : zf - 22, s > 0 ? zf + 22 : zf - 1, { bevel: 0.4 });
    M.restore();
    for (let k = 0; k < 6; k++) M.place(PF.spruce(Math.round(R.range(8, 12)), 1 + Math.floor(R() * 6)), R.range(-23, -11), 15.0, zf + s * R.range(4, 16), R() * TAU, { nocol: true });
  }
  // chalets de l'est (façades vers la carte) et des bouts de la vallée (façades vers les bases)
  const R = rngOf(4747);
  for (let z = -60, k = 0; z < 60; k++) {
    const w = R.range(7.5, 11), h = R.range(6.4, 9.2) + (k % 2) * 0.06, d = R.range(8, 10); // deux voisins jamais à la même hauteur : les dessous de leurs toits se croisaient dans le même plan
    // le fond de la scierie (x = 23,85, de z = -8,5 à 8,5, haut de 4,2 m) cache le rez-de-chaussée des chalets qui lui font face : pas d'affiche derrière
    chalet(24, 24 + d, z, Math.min(60, z + w), { h, ridge: R() < 0.5 ? 'x' : 'z', faces: 'w', lit: 0.35, balcony: true, noPoster: z < 8.5 && z + w > -8.5 });
    z += w;
  }
  for (const s of [1, -1]) {
    for (let x = -10; x < 24;) {
      const w = Math.min(24 - x, R.range(7, 10)), h = R.range(6.6, 9.0), z0 = s > 0 ? 48 : -48 - 9, z1 = s > 0 ? 48 + 9 : -48;
      chalet(x, x + w, z0, z1, { h, ridge: R() < 0.5 ? 'x' : 'z', faces: s > 0 ? 'n' : 's', lit: 0.35, balcony: true });
      x += w;
    }
  }
}

/* ---------- Repères hauts sur le replat de la falaise ouest (chantier des cartes, octobre 2026 ; esquisse val-blanc-refonte-b.js) ----------
   Une tour par moitié, même gabarit (3,4 m de côté, sommet vers 29 m) : la paire se voit de 72 % du sol, repères déclarés compris (46,9 %
   avant). Au sud (Alpha), le clocher de la chapelle du col, horloge tournée vers la vallée, flèche d'ardoise ; au nord (Bravo), la tour de
   guet du vieux fort, créneaux et drapeau : on sait de quel côté on est en levant les yeux. Hors du jeu (le sommet de la roche est à
   15,5 m) ; des collisions arrêtent les tirs, ouvertes là où le clocher est ajouré. */
const GV_TOWER = { x: -30.5, z: 40, hw: 1.7, y0: 14.0 };
function givreTowers() {
  const M = DECOR, T = GV_TOWER;
  for (const s of [1, -1]) {
    const zc = s * T.z, x0 = T.x - T.hw, x1 = T.x + T.hw, z0 = zc - T.hw, z1 = zc + T.hw, bell = s > 0;
    const mat = bell ? 'ashlar' : 'stone', tint = bell ? [0.9, 0.87, 0.81] : [0.7, 0.7, 0.72], top = bell ? 24.8 : 25.6;
    M.save().color(tint).world(1);
    // socle (en glacis pour le fort), fût, bandeau
    M.boxB(mat, x0 - (bell ? 0.2 : 0.4), x1 + (bell ? 0.2 : 0.4), T.y0, T.y0 + 3.0, z0 - (bell ? 0.2 : 0.4), z1 + (bell ? 0.2 : 0.4), { skip: 'y' });
    M.boxB(mat, x0, x1, T.y0 + 3.0, top, z0, z1, { skip: 'y' });
    M.color(bell ? [0.84, 0.8, 0.74] : [0.62, 0.62, 0.64]);
    M.boxB(mat, x0 - 0.12, x1 + 0.12, 20.4, 20.7, z0 - 0.12, z1 + 0.12, { bevel: 0.03 });
    M.restore();
    // fentes (meurtrières du fort, jours du clocher) sur les faces tournées vers la carte
    M.save().color([0.05, 0.05, 0.05]).world(1);
    for (const y of bell ? [17.6] : [17.4, 22.4]) {
      M.quad('dark', [x1 + 0.01, y, zc - 0.12], [x1 + 0.01, y, zc + 0.12], [x1 + 0.01, y + 1.1, zc + 0.12], [x1 + 0.01, y + 1.1, zc - 0.12], [1, 0, 0]);
      const zf = s > 0 ? z0 - 0.01 : z1 + 0.01, n = s > 0 ? -1 : 1;
      M.quad('dark', [T.x - 0.12, y, zf], [T.x + 0.12, y, zf], [T.x + 0.12, y + 1.1, zf], [T.x - 0.12, y + 1.1, zf], [0, 0, n]);
    }
    M.restore();
    WORLD.col({ x0: x0, x1: x1, y0: T.y0, y1: top, z0: z0, z1: z1 }, 'concrete');
    if (bell) {
      // horloge sur la face est (vers la vallée), dans un cadre de pierre
      M.save().move(x1, 22.4, zc).rotY(Math.PI / 2).color([0.8, 0.76, 0.7]).local(1);
      M.boxB('ashlar', -0.95, 0.95, -0.95, 0.95, 0, 0.06);
      M.color([0.95, 0.94, 0.9]); M.save().move(0, 0, 0.06).rotX(Math.PI / 2); M.cyl('paint', 0.82, 0.02, 24); M.restore();
      wallDecal2(M, DEC2.clock, 0, -0.78, 1.56, 1.56, 0.09);
      M.restore();
      // chambre des cloches : corniche, quatre piles d'angle, linteau, cloche ; flèche d'ardoise et croix
      const b0 = top, b1 = top + 2.3, p = 0.7;
      M.save().color(tint).world(1);
      M.boxB('ashlar', x0 - 0.15, x1 + 0.15, b0, b0 + 0.3, z0 - 0.15, z1 + 0.15, { bevel: 0.03 });
      for (const [px, pz] of [[x0, z0], [x1 - p, z0], [x0, z1 - p], [x1 - p, z1 - p]]) { M.boxB('ashlar', px, px + p, b0 + 0.3, b1, pz, pz + p); WORLD.col({ x0: px, x1: px + p, y0: b0 + 0.3, y1: b1, z0: pz, z1: pz + p }, 'concrete'); }
      M.boxB('ashlar', x0 - 0.15, x1 + 0.15, b1, b1 + 0.4, z0 - 0.15, z1 + 0.15, { bevel: 0.03 });
      M.restore();
      WORLD.col({ x0: x0 - 0.15, x1: x1 + 0.15, y0: b0, y1: b0 + 0.3, z0: z0 - 0.15, z1: z1 + 0.15 }, 'concrete');
      WORLD.col({ x0: x0 - 0.15, x1: x1 + 0.15, y0: b1, y1: b1 + 0.4, z0: z0 - 0.15, z1: z1 + 0.15 }, 'concrete');
      M.save().move(T.x, b0 + 0.6, zc).color([0.5, 0.38, 0.18]).local(1);
      M.lathe('steel', [[0, 1.25], [0.16, 1.25], [0.3, 1.1], [0.36, 0.6], [0.5, 0.12], [0.56, 0], [0.5, 0.0], [0, 0.05]], 16, { sharp: 0.5 });
      M.color([0.2, 0.18, 0.16]); M.boxB('wood', -1.0, 1.0, 1.25, 1.45, -0.12, 0.12);
      M.restore();
      const sp = b1 + 0.4;
      M.save().move(T.x, sp, zc).rotY(Math.PI / 4).color([0.5, 0.52, 0.58]).local(1);
      M.lathe('slate', [[0, 0], [2.55, 0], [2.4, 0.25], [0.06, 4.9], [0, 5.0]], 4, { sharp: 1 });
      M.restore();
      WORLD.col({ x0: T.x - 0.8, x1: T.x + 0.8, y0: sp, y1: sp + 2.4, z0: zc - 0.8, z1: zc + 0.8 }, 'concrete');
      M.save().move(T.x, sp + 5.0, zc).color([0.2, 0.2, 0.2]).local(1);
      M.cyl('steel', 0.04, 1.3, 6); M.boxB('steel', -0.04, 0.04, 0.8, 0.88, -0.35, 0.35);
      M.restore();
    } else {
      // tour de guet : mâchicoulis sur consoles, parapet crénelé, mât et drapeau
      const c0 = top, c1 = top + 0.45, e = 0.3, q0 = x0 - e, q1 = x1 + e, r0 = z0 - e, r1 = z1 + e, w = 0.35;
      M.save().color([0.66, 0.66, 0.68]).world(1);
      for (let a = x0 + 0.2; a < x1 - 0.1; a += 0.62) for (const zz of [z0 - e, z1]) M.boxB('stone', a, a + 0.28, c0 - 0.5, c0, zz, zz + e);
      for (let a = z0 + 0.2; a < z1 - 0.1; a += 0.62) for (const xx of [x0 - e, x1]) M.boxB('stone', xx, xx + e, c0 - 0.5, c0, a, a + 0.28);
      M.boxB('stone', q0, q1, c0, c1, r0, r1, { bevel: 0.03 });
      const P = c1 + 0.8, mer = 0.55;
      for (const [a0, a1, b0, b1] of [[q0, q1, r0, r0 + w], [q0, q1, r1 - w, r1], [q0, q0 + w, r0 + w, r1 - w], [q1 - w, q1, r0 + w, r1 - w]]) {
        M.boxB('stone', a0, a1, c1, P, b0, b1);
        const alongX = a1 - a0 > b1 - b0, L = alongX ? a1 - a0 : b1 - b0, n = Math.max(2, Math.round(L / 1.0));
        for (let i = 0; i < n; i += 1) { if (i % 2) continue; const t0 = i / n, t1 = (i + 1) / n;
          if (alongX) M.boxB('stone', lerp(a0, a1, t0), lerp(a0, a1, t1), P, P + mer, b0, b1); else M.boxB('stone', a0, a1, P, P + mer, lerp(b0, b1, t0), lerp(b0, b1, t1)); }
      }
      M.restore();
      WORLD.col({ x0: q0, x1: q1, y0: c0, y1: P, z0: r0, z1: r1 }, 'concrete');
      M.save().move(T.x, c1, zc).color([0.22, 0.22, 0.22]).local(1);
      M.cyl('steel', 0.06, 5.2, 8);
      M.restore();
      // drapeau vert sombre, uni (ni les couleurs d'une équipe ni celles d'un pays)
      M.save().move(T.x + 0.06, c1 + 3.6, zc).color([0.1, 0.3, 0.2]).local(1);
      clothPiece(M, [0, 0, 0], [2.16, 0, 0], [2.16, 1.4, 0], [0, 1.4, 0], [0, 0, 1], { hoist: true, genre: 'drapeau', grp: 'drapeau' + T.x + ',' + zc }); // flotte (tissu simulé, 02mc-tissus.js)
      M.restore();
    }
  }
}

/* ---------- Fond de vallée : montagnes, forêts, hameaux, église à bulbe ---------- */
function givreBackdrop() {
  mountainRing(78, 235, 105, 2207, { k: 1.25, west: 26, trees: 520 });
  const R = rngOf(909), M = DECOR;
  WORLD.force = 'far';
  // forêt de la vallée (proche des maisons) et hameaux
  for (let i = 0; i < 220; i++) {
    const a = R() * TAU, d = R.range(52, 95), x = Math.cos(a) * d, z = Math.sin(a) * d * 1.25;
    if (x < -30 || (Math.abs(z) < 60 && x < 40)) continue;
    farTree(M, x, 0, z, R.range(8, 15), R() * TAU);
  }
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, d = R.range(50, 90), x = Math.cos(a) * d, z = Math.sin(a) * d * 1.3;
    if (x < -28 || (Math.abs(z) < 62 && x < 38)) continue;
    farChalet(x, z, R.range(7, 11), R.range(6, 9), R.range(5.5, 8), Math.round(R() * 4) * Math.PI / 2 + R.range(-0.2, 0.2), R);
  }
  // église à clocher à bulbe, à l'est de la vallée
  {
    const cx = 64, cz = 30;
    M.save().move(cx, 0, cz).color([0.95, 0.93, 0.88]).world(1);
    M.boxB('plaster', -5, 5, 0, 8, -9, 9, { skip: 'y' });
    M.boxB('plaster', -2.4, 2.4, 0, 19, -13.4, -8.6);
    M.local(1); M.color([0.06, 0.06, 0.06]);
    for (const z of [-5, 0, 5]) for (const s of [-1, 1]) M.quad('dark', [s * 5.01, 3, z - 0.6], [s * 5.01, 3, z + 0.6], [s * 5.01, 6.2, z + 0.6], [s * 5.01, 6.2, z - 0.6], [s, 0, 0]);
    M.color([0.25, 0.42, 0.36]); M.save().move(0, 19, -11); M.lathe('paint', [[0, 0], [2.6, 0], [2.7, 0.4], [2.2, 1.6], [2.9, 3.2], [2.0, 4.6], [0.6, 5.6], [0.25, 6.4], [0.25, 7.2], [0, 7.4]], 16, { sharp: 0.9 }); M.restore();
    M.color([0.85, 0.7, 0.3]); M.save().move(0, 26.4, -11); M.cyl('steel', 0.06, 1.6, 6); M.boxB('steel', -0.5, 0.5, 1.1, 1.2, -0.05, 0.05); M.restore();
    M.color([0.06, 0.06, 0.06]); M.save().move(0, 15, -13.41); M.cyl('dark', 0.9, 0.02, 16); M.restore();
    M.restore();
    M.save().move(cx - 5, 0, cz - 9); alpineRoofLocal(M, 10, 18, 8, R); M.restore();
  }
  WORLD.force = null;
}

/* ---------- Sol : neige fraîche, neige tassée dans les passages, chaussée déblayée, pavés de la cour ---------- */
function givreGround() {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, px = new Float32Array(W * H * 4), N = makeNoise(1847);
  const zone = (ch, x0, x1, z0, z1, soft = 0.8, k = 1) => {
    const i0 = Math.max(0, Math.floor((x0 - soft - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((x1 + soft - S.x0) * S.ppm));
    const j0 = Math.max(0, Math.floor((z0 - soft - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((z1 + soft - S.z0) * S.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm;
      const d = Math.min(x - x0, x1 - x, z - z0, z1 - z) + (N.fbm(x * 0.09, z * 0.09, 32, 32, 3) - 0.5) * 1.8;
      const w = smoothstep(-soft, soft, d) * k, o = (j * W + i) * 4;
      px[o + ch] = Math.max(px[o + ch], w);
    }
  };
  // neige tassée : chemins, ruelles, cours, bases ; chaussée déblayée au milieu de la Grand-Rue ; pavés de la cour
  zone(0, -24, 24, 37, 48, 1.5, 0.85); zone(0, -24, 24, -48, -37, 1.5, 0.85);
  zone(0, -24, -22.2, -48, 48, 0.6, 0.7);
  zone(0, -3.2, 5.2, -40, 40, 0.8, 0.9);
  zone(0, 11, 15.2, -38, 38, 0.8, 0.9); zone(0, 15, 24, 18, 23.3, 0.8, 0.85); zone(0, 15, 24, -23.3, -18, 0.8, 0.85); zone(0, 21, 24, 23, 38, 0.6, 0.8); zone(0, 21, 24, -38, -23, 0.6, 0.8);
  zone(0, -9, -3, 20, 24, 0.6, 0.85); zone(0, -9, -3, -24, -20, 0.6, 0.85); zone(0, -9, 5, 29, 38, 1, 0.8); zone(0, -9, 5, -38, -29, 1, 0.8);
  zone(0, 11, 24, -8.5, 8.5, 0.5, 1); zone(3, 12.3, 24, -8.5, 8.5, 0.4, 0.75);
  zone(2, -0.5, 2.5, -38, 38, 0.5, 0.75); zone(3, -0.8, 2.8, -38, 38, 1.0, 0.55);
  zone(1, 5, 12, -9, 9, 0.5, 0.9); zone(1, -3, 5, 7, 9.5, 0.5, 0.9); zone(1, -3, 5, -9.5, -7, 0.5, 0.9);
  // sous les toits de la galerie : sol gravillonné sombre
  zone(0, -24, -22.2, -9.6, 9.6, 0.3, 1); zone(3, -24, -22.2, -9.6, 9.6, 0.3, 0.9);
  // masque des murs puis distance au mur (congères)
  const wall = new Float32Array(W * H).fill(1e4);
  for (const c of COL) {
    if (c.ray || c.y0 > 0.3 || c.y1 < 1.0) continue;
    const i0 = Math.max(0, Math.floor((c.x0 - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((c.x1 - S.x0) * S.ppm) - 1);
    const j0 = Math.max(0, Math.floor((c.z0 - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((c.z1 - S.z0) * S.ppm) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) wall[j * W + i] = 0;
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; let v = wall[k]; if (i > 0) v = Math.min(v, wall[k - 1] + 3); if (j > 0) v = Math.min(v, wall[k - W] + 3); if (i > 0 && j > 0) v = Math.min(v, wall[k - W - 1] + 4); if (i < W - 1 && j > 0) v = Math.min(v, wall[k - W + 1] + 4); wall[k] = v; }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; let v = wall[k]; if (i < W - 1) v = Math.min(v, wall[k + 1] + 3); if (j < H - 1) v = Math.min(v, wall[k + W] + 3); if (i < W - 1 && j < H - 1) v = Math.min(v, wall[k + W + 1] + 4); if (i > 0 && j < H - 1) v = Math.min(v, wall[k + W - 1] + 4); wall[k] = v; }
  // masques fins (10 cm) des objets au sol et des toits, tirés des collisions (l'index des requêtes n'est construit
  // qu'après le plan) : pas de neige fraîche sous un toit, pas de congère sur un objet
  const F = { x0: -26, z0: -50, ppm: 10, w: 520, d: 1000 }, block = new Uint8Array(F.w * F.d), roof = new Uint8Array(F.w * F.d);
  const mark = (a, x0, x1, z0, z1) => {
    const i0 = Math.max(0, Math.floor((x0 - F.x0) * F.ppm)), i1 = Math.min(F.w - 1, Math.floor((x1 - F.x0) * F.ppm));
    const j0 = Math.max(0, Math.floor((z0 - F.z0) * F.ppm)), j1 = Math.min(F.d - 1, Math.floor((z1 - F.z0) * F.ppm));
    for (let j = j0; j <= j1; j++) a.fill(1, j * F.w + i0, j * F.w + i1 + 1);
  };
  for (const c of COL) {
    if (c.ray) continue;
    if (c.y0 < 0.3 && c.y1 > 0.02) mark(block, c.x0 - 0.06, c.x1 + 0.06, c.z0 - 0.06, c.z1 + 0.06);
    if (c.y0 >= 2.2 && c.y0 < 9) mark(roof, c.x0 - 0.5, c.x1 + 0.5, c.z0 - 0.5, c.z1 + 0.5);
  }
  for (const r of RAMPS) mark(block, r.x0 - 0.2, r.x1 + 0.2, r.z0 - 0.2, r.z1 + 0.2);
  const fine = (x, zz) => { const i = Math.floor((x - F.x0) * F.ppm), j = Math.floor((zz - F.z0) * F.ppm); return i < 0 || j < 0 || i >= F.w || j >= F.d ? -1 : j * F.w + i; };
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, o = k * 4, x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, dw = wall[k] / 3 / S.ppm;
    const n = N.fbm(x * 0.05 + 3.1, z * 0.05, 32, 32, 3), n2 = N.fbm(x * 0.21, z * 0.21 + 7.7, 32, 32, 2);
    // la neige fraîche reprend le dessus au pied des murs (congères) et par plaques
    const f = fine(x, z), under = f >= 0 && roof[f];
    let fresh = under ? 0 : Math.max((1 - smoothstep(0.15, 0.9 + n * 0.8, dw)) * 0.85, smoothstep(0.66, 0.8, n + (n2 - 0.5) * 0.3) * 0.7);
    if (!under) for (const hp of SNOW_HEAPS) { const dx = x - hp.x, dz = z - hp.z; if (Math.abs(dx) > hp.rx + hp.rz + 1 || Math.abs(dz) > hp.rx + hp.rz + 1) continue; const c = Math.cos(hp.rot), sn = Math.sin(hp.rot), lx = dx * c - dz * sn, lz = dx * sn + dz * c, q = hyp(lx / (hp.rx + 0.7), lz / (hp.rz + 0.7)); fresh = Math.max(fresh, 1 - smoothstep(0.55 + n2 * 0.2, 1.0, q)); } // tas de neige : neige fraîche dessous et autour
    let r = px[o], g = px[o + 1], b = px[o + 2], a = px[o + 3];
    if (under) { r = Math.max(r, 0.9); a = Math.max(a, 0.55); } // sous un toit : sol battu, sale
    b *= 1 - g; r *= 1 - b * 0.6;
    const keep = 1 - fresh;
    out[o] = Math.round(clamp(r * keep, 0, 1) * 255); out[o + 1] = Math.round(clamp(g * keep, 0, 1) * 255); out[o + 2] = Math.round(clamp(b * keep, 0, 1) * 255);
    out[o + 3] = Math.round(clamp(a * (0.35 + n2 * 0.6) * keep, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_GIVRE);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([1, 1, 1]).local(1); M.aoFn = null;
  M.plane('ground', 330, 330, 1, 1);
  M.restore(); WORLD.force = null;
  const cellAt = (x, zz) => { const i = Math.floor((x - S.x0) * S.ppm), j = Math.floor((zz - S.z0) * S.ppm); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
  const walls = COL.filter((c) => !c.ray && c.y0 <= 0.3 && c.y1 >= 1.0 && c.x1 > -25 && c.x0 < 25 && Math.abs(c.z0) < 49);
  // congères contre les murs, là où la neige est fraîche
  sandDrifts(walls, (x, zz) => {
    const k = cellAt(x, zz), f = fine(x, zz); if (k < 0 || f < 0 || roof[f]) return 0;
    const o = k * 4, fresh = 1 - (out[o] + out[o + 1] + out[o + 2]) / 255;
    return smoothstep(0.55, 0.9, fresh) * (0.12 + 0.3 * smoothstep(0.3, 0.8, N(x * 0.45 + 17, zz * 0.45, 256, 256)));
  }, (x, zz) => { const f = fine(x, zz); return f >= 0 && !block[f]; });
  WORLD.dressing = { drifts: true };
  SNOW_HEAPS.length = 0;
}

/* ---------- Définition de la carte (voir MAP_DEFS dans 02-map.js et 02z-load.js) ---------- */
MAP_DEFS.givre = {
  type: 'mid', // moyenne, serrée et sinueuse : README « Règles de conception d'une carte » ; règle le choix des armes des bots (botArmForMap)
  bounds: { x0: -24, x1: 24, z0: -48, z1: 48 },
  textures: ['plaster', 'stone', 'cobble', 'pavers', 'asphalt', 'wood', 'shutter', 'snow', 'snowpack', 'rock', 'boards', 'slate', 'barkw', 'ashlar', 'concrete', 'canvas', 'rust', 'steel', 'paintwood', 'burlap', 'timber'],
  surfaces: ['ripple'], // toute eau du décor (pondAdd) en a besoin
  // ambiance enregistrée (05c-ambiance.js) : vent froid de montagne et ses rafales, cloche de l'église de la vallée, corneilles, charpentes qui craquent au froid, neige qui glisse d'un toit
  sound: { pack: 'amb_givre', bed: 0.42, spots: [
    { id: 'a_gust', every: [9, 22], gain: 0.45, dist: [4, 12], y: [3, 8] },
    { id: 'a_bell', every: [70, 150], gain: 0.5, at: () => new V3(64, 20, 19), ref: 25, roll: 0.6 },
    { id: 'a_crow', every: [25, 60], gain: 0.3, dist: [40, 100], y: [8, 20] },
    { id: 'a_creak', every: [18, 45], gain: 0.25, dist: [8, 25], y: [1, 5] },
    { id: 'a_snowfall', every: [30, 70], gain: 0.3, dist: [8, 25], y: [3, 7] },
  ] },
  winter: true, // surfaces, atlas et matières du kit d'hiver (02i-hiver.js)
  // illustration des menus (tools/dev/illustrations.js) : la Grand-Rue sous la neige, au pied de la Gare et de son horloge
  art: { cam: [-0.6, 1.9, 20.5], look: [-0.1, 3.8, 4], fov: 60 },
  splat: { x0: -50, z0: -74, w: 100, d: 148, ppm: 4 },
  far: 330,
  build() { givreLevel(); },
  // apparitions de l'équipe Alpha (sud) ; celles de Bravo en sont le miroir
  spawns: [[-15.5, 43.5], [-15.5, 46], [-10.5, 42.5], [-11.5, 45.5], [-8.5, 44.5], [0.5, 41.8], // le premier rang à l'ouest reculé : 87,4 m de marche d'un camp à l'autre (90 au moins)
            [3.4, 45.4], [5.5, 41.2], [13.5, 41.8], [15.5, 46.5], [20.8, 42.2], [20.5, 46.2]],
  /* Points d'intérêt des bots : [x, y, z, route, tenue] ; route L (Voies, quai), M (Gare, Grand-Rue, halle, hôtel), E (Village, scierie) */
  poi: [
    [-15.2, 0.16, 30, 'L'], [-15.2, 0.16, -30, 'L'], [-22.9, 0, 18, 'L'], [-22.9, 0, -18, 'L'], [-15.4, 0.16, 4, 'L', 1], [-15.4, 0.16, -4, 'L', 1],
    [-6.8, 3.4, 26.8, 'L', 1], [-6.8, 3.4, -26.8, 'L', 1], [-10.6, 0.4, 14, 'L'], [-10.6, 0.4, -14, 'L'], [-10.4, 0.4, 4.2, 'L', 1], [-10.4, 0.4, -4.2, 'L', 1],
    [-6.0, 0, 13.8, 'M'], [-6.0, 0, -13.8, 'M'], [-0.8, 0, 16, 'M'], [-0.8, 0, -16, 'M'], [-5.6, 0, 4.6, 'M', 1], [-5.6, 0, -4.6, 'M', 1], [3.2, 0, 1.8, 'M', 1], [3.2, 0, -1.8, 'M', 1],
    [7.8, 0, 15.2, 'M'], [7.8, 0, -15.2, 'M'], [1.0, 0, 30, 'M'], [1.0, 0, -30, 'M'], [8.4, 0, 4.6, 'M', 1], [8.4, 0, -4.6, 'M', 1],
    [13.0, 0, 15, 'E'], [13.0, 0, -15, 'E'], [19.5, 0, 22.2, 'E'], [19.5, 0, -22.2, 'E'], [18.4, 0, 26.5, 'E'], [18.4, 0, -26.5, 'E'], [14.4, 2.8, 24.6, 'E', 1], [14.4, 2.8, -24.6, 'E', 1],
    [17.0, 0, 4.4, 'E', 1], [17.0, 0, -4.4, 'E', 1], [22.4, 0, 2.0, 'E', 1], [22.4, 0, -2.0, 'E', 1], [22.4, 0, 34, 'E'], [22.4, 0, -34, 'E'],
  ],
  // domination : A et C dans la cour du poste-frontière, au pied du poste d'aiguillage, à l'approche de chaque base (au centre d'une case de
  // la navigation, que A et C se mesurent pareil) ; B au milieu du hall de la Gare
  dom: [[9, 36.5], [-2, 0], [-11.5, -33.5]], // placés par le propriétaire avec l'outil des zones (?outil=zones, octobre 2026)
  mecha: [[-0.5, -16.5], [-0.5, 15.5], [-20.5, 15.5], [-20.5, -16.5]], // zones de largage du mecha (08f-mecha.js, mnavZones), placées de même
  lane: (x) => (x < -9 ? 'L' : x > 11 ? 'E' : 'M'),
  sniper: [-6.8, 3.4, 26.8], // cabine du poste d'aiguillage (z du côté de sa base)
  // repères pour s'orienter (mesurés par tools/dev/visual/leveldesign.js) : sur la falaise, le clocher (sud) et la tour du fort (nord) ; le
  // grand toit de la gare au centre, ses horloges, le faîte de l'Hôtel du Col et le sapin illuminé de la Placette, un de chaque par moitié
  landmarks: [[-30.5, 29, 40, 'clocher sud'], [-30.5, 29, -40, 'tour du fort nord'], [-2, 12.9, 0, 'toit de la gare'], [-2, 9.9, 7.02, 'horloge sud'], [-2, 9.9, -7.02, 'horloge nord'], [8, 12.4, 15, 'Hôtel du Col sud'], [8, 12.4, -15, 'Hôtel du Col nord'], [20.6, 5.0, 20.6, 'sapin sud'], [20.6, 5.0, -20.6, 'sapin nord']],
  coverZ: 40,
  heli: [21, 46],
  cam: 40,
  // pas dans la neige dehors ; sous un toit (hall, halle, hôtel, galerie, scierie), sol dur
  surface: (p) => (ceilingAbove(p.x, p.z, p.y + 0.1, 0.2) < p.y + 8 ? 'concrete' : 'snow'),
  zones: [
    [_t('Base Alpha'), -24, 24, 38, 48], [_t('Base Bravo'), -24, 24, -48, -38],
    [_t('Galerie'), -24, -12.2, -9.6, 9.6], ["Poste d'aiguillage", -9, -3, 24, 31], ["Poste d'aiguillage", -9, -3, -31, -24],
    [_t('Quai'), -12.3, -9, -38, 38], [_t('Voies'), -24, -12.3, -38, 38],
    [_t('Gare'), -9, 5, -7, 7], [_t('Halle'), -9, -3, 7, 20], [_t('Halle'), -9, -3, -20, -7],
    [_t('Hôtel du Col'), 5, 11, 9, 21], [_t('Hôtel du Col'), 5, 11, -21, -9], [_t('Cour de la gare'), 5, 12.3, -9, 9],
    [_t('Ruelle'), 5, 11, 21, 25], [_t('Ruelle'), 5, 11, -25, -21], [_t('Boulangerie'), 5, 11, 25, 38], [_t('Boulangerie'), 5, 11, -38, -25],
    [_t('Grand-Rue'), -3, 5, -38, 38], [_t('Scierie'), 12.3, 24, -8.5, 8.5],
    [_t('Grange'), 13, 21, 23, 32], [_t('Grange'), 13, 21, -32, -23], [_t('Placette'), 15, 24, 18, 23], [_t('Placette'), 15, 24, -23, -18],
    [_t('Passage'), -9, -3, 20, 24], [_t('Passage'), -9, -3, -24, -20], [_t('Cour du poste'), -9, -3, 31, 38], [_t('Cour du poste'), -9, -3, -38, -31],
    [_t('Village'), 11, 24, -38, 38],
  ],
  // ciel photographié (Poly Haven, kloppenheim_02) : ciel de nuit sous la lune, très assombri ; les crêtes restent devant
  skyPhoto: { key: 'kloppenheim_02', rot: 0.3, gain: 0.14 },
  atmo: ATMO_GIVRE,
};
