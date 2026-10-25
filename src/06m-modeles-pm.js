/* ==========================================================================
   MODÈLES D'ARMES, PISTOLETS-MITRAILLEURS : MP7, UMP-45, Vector
   Même contexte que 06k-modeles-base.js. Le MP7 est un compact en polymère au chargeur logé dans la poignée, l'UMP-45 un long boîtier d'un
   bloc à rails et chargeur incliné devant le pontet, le Vector un boîtier noir et sable coupé en biais, à canon bas et poignée verticale.
   ========================================================================== */

/* ---------- MP7 : boîtier compact en polymère, rail de dessus, rails latéraux et rail cranté sous l'avant, fentes d'aération,
   chargeur logé dans la poignée (le chargeur long dépasse dessous), pontet anguleux, crosse coulissante à talon plongeant et
   lumière. Cotes relevées sur une vue de profil (0,7 mm par pixel, calée sur la détente) ; la poignée est reculée de 3 cm et le
   pontet agrandi pour la main du jeu, la crosse raccourcie pour garder la portée du bras gauche des soldats. ---------- */
const MP7_MAG = { u: [0.0948, -0.9955], n: [0.9955, 0.0948] }; // axe de la poignée et du chargeur [z, y] (le bas part vers l'arrière, 5°)
defineGun('mp7', 'smg', (c) => {
  const { g, M, info, bl } = c;
  // boîtier d'un bloc, rail de dessus ; avant : rails latéraux, rail cranté dessous (dents apparentes), fentes d'aération
  prof(g, M.poly, [[-0.22, 0.08, 0.004], [0.151, 0.08, 0.004], [0.155, 0.075, 0.004], [0.155, 0.006, 0.004], [-0.218, 0.01, 0.004]], 0.04, 0, 0.004, 0.004);
  rail(g, M, 0, 0.084, -0.03, 0.36);
  for (const sx of [-1, 1]) rail(g, M, sx * 0.021, 0.033, -0.153, 0.105, true);
  rb(g, M.dark, 0, 0.006, -0.153, 0.022, 0.008, 0.105, 0.002);
  for (let i = 0; i < 8; i++) bx(g, M.dark, 0, 0.001, -0.2 + i * 0.013, 0.022, 0.004, 0.006);
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [[-0.195, -0.14], [-0.133, -0.069]]) rb(g, M.rubber, sx * 0.0208, 0.069, (z0 + z1) / 2, 0.0016, 0.005, z1 - z0, 0.002);
    rb(g, M.rubber, sx * 0.0208, 0.064, 0.055, 0.0016, 0.002, 0.16, 0.0008); // joint du boîtier arrière
    rb(g, M.rubber, sx * 0.0208, 0.054, 0.107, 0.0016, 0.008, 0.058, 0.003); // fente du levier d'armement
  }
  // levier d'armement en T à l'arrière, sélecteur, fenêtre d'éjection, goupilles
  rb(g, M.metal, 0, 0.07, 0.158, 0.044, 0.012, 0.01, 0.003);
  rb(g, M.metal, -0.0215, 0.018, -0.005, 0.003, 0.007, 0.02, 0.001, 0.3);
  rb(g, M.rubber, 0.0208, 0.05, 0.03, 0.0016, 0.016, 0.045, 0.002);
  for (const [z, y] of [[0.002, 0.024], [0.043, 0.016], [0.142, 0.016]]) cy(g, M.dark, 0, y, z, 0.003, 0.0424, 0, 0, Math.PI / 2);
  // pontet anguleux (bloc plein au-dessus de l'ouverture), détente, poignée qui loge le chargeur, plaques grenues, bouton de chargeur
  prof(g, M.poly, [[-0.094, 0.008, 0], [-0.094, -0.04, 0.008], [-0.082, -0.048, 0.008], [0.004, -0.048, 0.006], [0.012, -0.036, 0.004], [0.012, 0.008, 0]], 0.014, 0, 0.003, 0.004,
    [[[-0.084, -0.004, 0.003], [-0.084, -0.04, 0.006], [0.004, -0.04, 0.006], [0.004, -0.004, 0.003]]]);
  rb(g, M.metal, 0, -0.012, -0.046, 0.006, 0.034, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.033, 0.022, 0.045, -0.104, 0.058, 0.034, 0.002);
  for (const sx of [-1, 1]) rb(g, M.grip, sx * 0.0175, -0.06, 0.042, 0.002, 0.07, 0.03, 0.004, -0.095);
  for (const sx of [-1, 1]) cy(g, M.dark, sx * 0.017, -0.014, 0.018, 0.0045, 0.004, 0, 0, Math.PI / 2);
  // canon court, écrou de la face avant, cache-flamme (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.265 - Math.max(bl, -0.02), mz = !!c.A.muzzle;
  cy(g, M.dark, 0, 0.034, -0.222, 0.01, 0.006);
  cy(g, M.metal, 0, 0.034, (-0.22 + (mz ? tip : tip + 0.03)) / 2, 0.0055, Math.abs((mz ? tip : tip + 0.03) + 0.22));
  if (!mz) { cy(g, M.dark, 0, 0.034, tip + 0.017, 0.0088, 0.034); for (const sx of [-1, 1]) rb(g, M.rubber, sx * 0.0084, 0.034, tip + 0.012, 0.0016, 0.004, 0.018, 0.0008); }
  // organes de visée relevables sur le rail (rien si une optique les remplace) ; traits en fraction de l'écran (06jb-formes.js)
  info.sightY = 0.108; info.adsZ = 0.216;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.091, -0.174, 0.02, 0.01, 0.018, 0.002);
    bx(g, M.sight, 0, 0.099, -0.174, ironW(c, -0.174, IRON.post), 0.018, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.097, -0.174, ironW(c, -0.174, IRON.ear), 0.016, 0.012);
    rb(g, M.dark, 0, 0.092, 0.086, 0.022, 0.012, 0.022, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0102, 0.1, 0.086, ironW(c, 0.086, IRON.wing), 0.016, 0.006);
    ironFoot(c, M.dark, 0.086, 0.0975, ironRing(c, 0.086, IRON.hole.smg), 0.01);
  }
  // charnière et verrou de crosse, puis crosse coulissante : bras, corps à talon plongeant percé d'une lumière, bouton, plaque
  // de couche (variantes : sans crosse, embout court ; renforcée, talon épais et busc)
  prof(g, M.poly, [[0.148, 0.07, 0.004], [0.19, 0.066, 0.004], [0.19, 0.01, 0.004], [0.148, 0.005, 0.004]], 0.036, 0, 0.004, 0.004);
  for (const sx of [-1, 1]) for (const y of [0.03, 0.055]) cy(g, M.metal, sx * 0.0185, y, 0.17, 0.0055, 0.004, 0, 0, Math.PI / 2);
  let butt;
  if (c.stock === 'none') {
    rb(g, M.rubber, 0, 0.038, 0.193, 0.038, 0.06, 0.008, 0.003);
    butt = 0.197;
  } else {
    const hv = c.stock === 'heavy', w = hv ? 0.044 : 0.04;
    rb(g, M.poly, 0, 0.0435, 0.2, 0.026, 0.03, 0.026, 0.004);
    prof(g, M.poly, [[0.21, 0.066, 0.004], [0.307, 0.066, 0.006], [0.31, 0.06, 0.004], [0.31, -0.044, 0.006], [0.27, -0.044, 0.006], [0.262, -0.03, 0.006], [0.262, 0.018, 0.006], [0.21, 0.018, 0.004]], w, 0, 0.004, 0.004,
      [[[0.272, 0.008, 0.003], [0.29, 0.008, 0.003], [0.29, -0.034, 0.003], [0.272, -0.034, 0.003]]]);
    rb(g, M.dark, -w / 2 - 0.0005, 0.05, 0.232, 0.002, 0.012, 0.018, 0.0008);
    if (hv) rb(g, M.poly, 0, 0.072, 0.255, 0.03, 0.014, 0.08, 0.004);
    const pd = hv ? 0.014 : 0.008;
    rb(g, M.rubber, 0, 0.011, 0.31 + pd / 2, w, 0.11, pd, 0.003);
    butt = 0.31 + pd;
  }
  info.butt = [0, 0.02, butt];
  // chargeur dans la poignée : le haut monte dans la poignée, le reste dépasse dessous, plaque de talon débordante
  info.magHome.set(0, -0.104, 0.045);
  info.buildMag = (parent, ext) => {
    const { u, n } = MP7_MAG, h = 0.022, s0 = -0.1, s1 = 0.088 + (ext - 1) * 0.1, P = (s, k) => [u[0] * s + n[0] * k, u[1] * s + n[1] * k];
    prof(parent, M.poly, [P(s0, -h), P(s0, h), P(s1, h), P(s1, -h)], 0.026, 0, 0.003, 0.003);
    const b = P(s1 + 0.005, 0);
    rb(parent, M.dark, 0, b[1], b[0], 0.032, 0.012, 0.052, 0.003, -0.095);
  };
  info.magAxis = new V3(0, MP7_MAG.u[1], MP7_MAG.u[0]); info.magGrip = new V3(0, -0.0299, 0.0028);
  info.gripR.set(0, -0.045, 0.04); info.gripL.set(0, 0.034, -0.16);
  info.mount.optic = { y: 0.089, z: 0.0, len: 0.36, D: 0.21 };
  info.mount.muzzle = { x: 0, y: 0.034, z: tip, r: 0.0055 };
  info.mount.under = { y: 0.002, z: -0.16, len: 0.1 };
  info.mount.side = { x: -0.025, y: 0.033, z: -0.16 };
  info.muzzle.position.set(0, 0.034, tip - 0.01); info.eject.position.set(0.021, 0.05, 0.03);
  info.gripDef = {
    R: [{ c: [0, -0.045, 0.04], h: [0.017, 0.055, 0.029], r: 0.01, rx: -0.095 }, { c: [0, 0.03, 0.0], h: [0.02, 0.025, 0.09], r: 0.008 }],
    L: [{ c: [0, 0.034, -0.16], h: [0.02, 0.032, 0.06], r: 0.008 }, { c: [0, 0.006, -0.153], h: [0.011, 0.004, 0.053], r: 0.002 },
      { c: [-0.021, 0.033, -0.153], h: [0.005, 0.012, 0.053], r: 0.002 }, { c: [0.021, 0.033, -0.153], h: [0.005, 0.012, 0.053], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.03, -0.058], xTip: -0.004, guard: [{ c: [0, -0.044, -0.04], h: [0.007, 0.004, 0.045], r: 0.002 }, { c: [0, -0.02, -0.089], h: [0.007, 0.028, 0.005], r: 0.002 },
    { c: [0, -0.012, -0.046], h: [0.003, 0.017, 0.003], r: 0.002, rx: 0.18 }] };
});

/* ---------- UMP-45 : long boîtier en polymère d'un seul bloc, rails latéraux et rail cranté sous l'avant, fentes d'allègement,
   puits de chargeur sous le boîtier et palette de déverrouillage, pontet intégré, poignée inclinée à talon, long chargeur droit
   incliné vers l'avant, crosse pliante à deux bras et grand évidement. Cotes relevées sur une vue de profil (0,68 mm par pixel,
   calée sur la détente ; crosse raccourcie de 15 % pour que le bras gauche des soldats atteigne le garde-main). ---------- */
const UMP_MAG = { u: [-0.181, -0.983], n: [0.983, -0.181] }; // axe du chargeur [z, y] (le bas part vers l'avant, 10°) et sa normale
defineGun('ump45', 'smg', (c) => {
  const { g, M, info, bl } = c;
  // boîtier : dessus droit, arrière chanfreiné ; rail de dessus sur toute la longueur
  prof(g, M.poly, [[-0.346, 0.073, 0.004], [0.026, 0.073, 0.004], [0.053, 0.06, 0.004], [0.058, 0.054, 0.004], [0.058, 0.004, 0.004], [-0.346, 0.002, 0.004]], 0.044, 0, 0.004, 0.004);
  rail(g, M, 0, 0.077, -0.17, 0.34);
  // garde-main : rails latéraux, rail cranté dessous (dents apparentes)
  for (const sx of [-1, 1]) rail(g, M, sx * 0.0225, 0.044, -0.283, 0.115, true);
  rb(g, M.dark, 0, 0.0, -0.284, 0.024, 0.008, 0.12, 0.002);
  for (let i = 0; i < 9; i++) bx(g, M.dark, 0, -0.005, -0.337 + i * 0.013, 0.024, 0.004, 0.006);
  // fentes d'allègement et joint du boîtier sur les deux flancs, levier d'armement à l'avant gauche, sélecteur, fenêtre d'éjection
  for (const sx of [-1, 1]) {
    for (const [zc, l] of [[-0.198, 0.04], [-0.125, 0.038], [-0.048, 0.04], [0.017, 0.036]]) rb(g, M.rubber, sx * 0.0228, 0.042, zc, 0.0016, 0.008, l, 0.003);
    rb(g, M.rubber, sx * 0.0228, 0.02, -0.028, 0.0016, 0.003, 0.11, 0.001);
  }
  rb(g, M.rubber, -0.0228, 0.064, -0.27, 0.0016, 0.005, 0.095, 0.002);
  rb(g, M.metal, -0.0255, 0.064, -0.31, 0.007, 0.009, 0.014, 0.002);
  rb(g, M.metal, -0.0232, 0.026, -0.01, 0.003, 0.007, 0.022, 0.001, 0.3);
  rb(g, M.rubber, 0.0228, 0.05, -0.06, 0.0016, 0.018, 0.05, 0.002);
  for (const [z, y] of [[-0.188, 0.013], [-0.094, 0.031], [-0.03, 0.009]]) cy(g, M.dark, 0, y, z, 0.003, 0.0464, 0, 0, Math.PI / 2);
  // puits de chargeur sous le boîtier, palette de déverrouillage derrière lui
  prof(g, M.poly, [[-0.2, 0.006, 0.002], [-0.181, -0.042, 0.004], [-0.116, -0.042, 0.004], [-0.104, -0.02, 0.004], [-0.094, 0.006, 0.002]], 0.046, 0, 0.003, 0.004);
  prof(g, M.poly, [[-0.114, -0.03, 0.002], [-0.098, -0.03, 0.002], [-0.096, -0.066, 0.004], [-0.108, -0.068, 0.004]], 0.03, 0, 0.003, 0.003);
  // pontet intégré (bloc de détente plein au-dessus de l'ouverture), détente, poignée inclinée et son talon, plaques grenues
  prof(g, M.poly, [[-0.095, 0.006, 0], [-0.095, -0.046, 0.008], [-0.082, -0.055, 0.008], [0.008, -0.055, 0.004], [0.016, -0.04, 0.004], [0.016, 0.006, 0]], 0.016, 0, 0.003, 0.004,
    [[[-0.083, -0.014, 0.004], [-0.083, -0.046, 0.007], [-0.006, -0.046, 0.006], [0.0, -0.014, 0.004]]]);
  rb(g, M.metal, 0, -0.028, -0.046, 0.006, 0.03, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.02, 0.0, 0.058, -0.132, 0.042, 0.032);
  prof(g, M.poly, [[0.03, 0.006, 0.002], [0.058, 0.006, 0.002], [0.06, -0.012, 0.004], [0.046, -0.03, 0.004]], 0.03, 0, 0.003, 0.003);
  for (const sx of [-1, 1]) rb(g, M.grip, sx * 0.0165, -0.078, 0.0425, 0.002, 0.05, 0.022, 0.003, -0.28);
  // canon court, écrou de la face avant, protège-filetage (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.378 - Math.max(bl, -0.02);
  cy(g, M.dark, 0, 0.037, -0.349, 0.012, 0.008);
  cy(g, M.metal, 0, 0.037, (-0.346 + tip) / 2, 0.0095, Math.abs(tip + 0.346));
  if (!c.A.muzzle) cy(g, M.dark, 0, 0.037, tip + 0.009, 0.011, 0.018);
  // organes de visée relevables sur le rail (rien si une optique les remplace) ; traits en fraction de l'écran (06jb-formes.js), pointe
  // du guidon sur la ligne de mire (elle la dépassait de 0,5 mm)
  info.sightY = 0.1015; info.adsZ = 0.136;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.083, -0.327, 0.02, 0.012, 0.018, 0.002);
    bx(g, M.sight, 0, (0.084 + 0.1015) / 2, -0.327, ironW(c, -0.327, IRON.post), 0.1015 - 0.084, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.091, -0.327, ironW(c, -0.327, IRON.ear), 0.016, 0.012);
    rb(g, M.dark, 0, 0.084, 0.006, 0.022, 0.014, 0.022, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0102, 0.094, 0.006, ironW(c, 0.006, IRON.wing), 0.016, 0.006);
    ironFoot(c, M.dark, 0.006, 0.0905, ironRing(c, 0.006, IRON.hole.smg), 0.01);
  }
  // charnière de crosse, puis crosse pliante : bras du dessus, bras en biais, talon et plaque de couche, grand évidement
  // (variantes : sans crosse, embout court ; renforcée, talon épais et busc)
  prof(g, M.poly, [[0.05, 0.062, 0.004], [0.082, 0.056, 0.004], [0.084, -0.006, 0.004], [0.05, -0.004, 0.004]], 0.036, 0, 0.004, 0.004);
  rb(g, M.rubber, -0.0185, 0.03, 0.068, 0.0016, 0.02, 0.008, 0.003);
  let butt;
  if (c.stock === 'none') {
    rb(g, M.poly, 0, 0.026, 0.09, 0.034, 0.06, 0.016, 0.006);
    rb(g, M.rubber, 0, 0.026, 0.101, 0.036, 0.064, 0.008, 0.003);
    butt = 0.105;
  } else {
    const hv = c.stock === 'heavy';
    prof(g, M.poly, [[0.078, 0.046, 0.004], [0.29, 0.046, 0.006], [0.29, -0.068, 0.006], [0.248, -0.068, 0.006], [0.084, -0.006, 0.004]], hv ? 0.036 : 0.03, 0, 0.004, 0.004,
      [[[0.108, 0.026, 0.006], [0.236, 0.026, 0.008], [0.236, -0.043, 0.006], [0.118, 0.004, 0.006]]]);
    rb(g, M.rubber, -0.0155, 0.035, 0.262, 0.0016, 0.006, 0.026, 0.002);
    if (hv) rb(g, M.poly, 0, 0.055, 0.19, 0.03, 0.014, 0.12, 0.004);
    const pd = hv ? 0.018 : 0.012;
    rb(g, M.rubber, 0, -0.011, 0.29 + pd / 2, hv ? 0.044 : 0.038, 0.116, pd, 0.005);
    butt = 0.29 + pd;
  }
  info.butt = [0, -0.01, butt];
  // long chargeur droit, incliné vers l'avant : le haut monte dans le puits, plaque de talon débordante
  info.magHome.set(0, -0.04, -0.15);
  info.buildMag = (parent, ext) => {
    const { u, n } = UMP_MAG, h = 0.022, s0 = -0.07, s1 = 0.19 + (ext - 1) * 0.15, P = (s, k) => [u[0] * s + n[0] * k, u[1] * s + n[1] * k];
    prof(parent, M.poly, [P(s0, -h), P(s0, h), P(s1, h), P(s1, -h)], 0.026, 0, 0.003, 0.003);
    for (const sx of [-1, 1]) { const a = P((s1 + 0.03) / 2, 0); rb(parent, M.rubber, sx * 0.0133, a[1], a[0], 0.0016, s1 - 0.09, 0.012, 0.004, 0.182); }
    const b = P(s1 + 0.005, 0);
    rb(parent, M.dark, 0, b[1], b[0], 0.032, 0.012, 0.05, 0.003, 0.182);
  };
  info.magAxis = new V3(0, UMP_MAG.u[1], UMP_MAG.u[0]); info.magGrip = new V3(0, -0.0344, -0.0063);
  info.gripR.set(0, -0.06, 0.043); info.gripL.set(0, 0.037, -0.285);
  info.mount.optic = { y: 0.082, z: -0.14, len: 0.34, D: 0.21 };
  info.mount.muzzle = { x: 0, y: 0.037, z: tip, r: 0.0095 };
  info.mount.under = { y: -0.007, z: -0.29, len: 0.12 };
  info.mount.side = { x: -0.0265, y: 0.044, z: -0.3 };
  info.muzzle.position.set(0, 0.037, tip - 0.01); info.eject.position.set(0.023, 0.05, -0.06);
  info.gripDef = {
    R: [{ c: [0, -0.068, 0.042], h: [0.016, 0.06, 0.021], r: 0.01, rx: -0.28 }, { c: [0, 0.03, -0.03], h: [0.022, 0.03, 0.1], r: 0.006 }],
    L: [{ c: [0, 0.037, -0.285], h: [0.022, 0.036, 0.06], r: 0.008 }, { c: [0, -0.003, -0.285], h: [0.012, 0.006, 0.06], r: 0.002 },
      { c: [-0.0225, 0.044, -0.283], h: [0.006, 0.012, 0.058], r: 0.002 }, { c: [0.0225, 0.044, -0.283], h: [0.006, 0.012, 0.058], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.036, -0.058], xTip: -0.004, guard: [{ c: [0, -0.0505, -0.04], h: [0.008, 0.0045, 0.045], r: 0.002 }, { c: [0, -0.025, -0.089], h: [0.008, 0.03, 0.006], r: 0.002 },
    { c: [0, -0.028, -0.046], h: [0.003, 0.015, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.018, -0.148], h: [0.023, 0.024, 0.032], r: 0.004 }] };
});

/* ---------- Vector (KRISS Vector, deux tons) : boîtier supérieur noir à rail sur toute la longueur, partie avant sable coupée
   en biais, montant avant cranté qui file en diagonale jusqu'au puits de chargeur, canon bas dans l'axe de la main, poignée
   verticale sous l'avant, grand pontet anguleux, long chargeur incliné vers l'arrière, crosse squelette à gros talon.
   Cotes relevées sur une vue de profil (1,22 mm par pixel, calée sur la détente). ---------- */
const VEC_MAG = { u: [0.208, -0.978], n: [0.978, 0.208] }; // axe du chargeur [z, y] (le bas part vers l'arrière, 12°) et sa normale
defineGun('vector', 'smg', (c) => {
  const { g, M, info, bl } = c;
  // boîtier supérieur et rail, plaque avant
  prof(g, M.dark, [[-0.31, 0.058, 0.004], [0.086, 0.058, 0.006], [0.086, 0.016, 0.004], [-0.306, 0.016, 0.002], [-0.31, 0.022, 0.002]], 0.046, 0, 0.003, 0.004);
  rail(g, M, 0, 0.062, -0.135, 0.33);
  rb(g, M.poly, 0, 0.005, -0.3105, 0.046, 0.106, 0.008, 0.003);
  // partie avant sable : dessus droit, coupe en biais vers le pontet, puits de chargeur, bas qui remonte le long du montant
  prof(g, M.tan, [[-0.306, 0.02, 0.003], [-0.117, 0.02, 0.004], [-0.086, -0.012, 0.006], [-0.062, -0.055, 0.004], [-0.062, -0.112, 0.004],
    [-0.154, -0.118, 0.003], [-0.199, -0.022, 0.004], [-0.204, -0.014, 0.002], [-0.306, -0.014, 0.003]], 0.05, 0, 0.003, 0.004);
  // bloc avant sous le canon (rail court de la poignée), montant avant cranté, lèvre du puits
  prof(g, M.poly, [[-0.31, -0.008, 0.003], [-0.206, -0.008, 0.002], [-0.212, -0.048, 0.004], [-0.308, -0.048, 0.004]], 0.044, 0, 0.003, 0.004);
  rail(g, M, 0, -0.052, -0.27, 0.07);
  prof(g, M.poly, [[-0.219, -0.008, 0.002], [-0.204, -0.008, 0.002], [-0.151, -0.123, 0.003], [-0.167, -0.123, 0.003]], 0.052, 0, 0.002, 0.002);
  for (let i = 1; i <= 7; i++) { const t = i * 0.0155; bx(g, M.poly, 0, -0.008 - 0.911 * t - 0.0006, -0.219 + 0.412 * t - 0.0012, 0.05, 0.004, 0.003, -0.42); }
  rb(g, M.poly, 0, -0.118, -0.108, 0.052, 0.008, 0.094, 0.003);
  // goupilles, lumière en biais sur les flancs
  for (const [z, y] of [[-0.296, -0.002], [-0.228, -0.002], [-0.139, -0.038], [-0.12, -0.094], [-0.098, -0.05]]) cy(g, M.dark, 0, y, z, 0.0038, 0.0532, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) rb(g, M.rubber, sx * 0.0255, -0.062, -0.172, 0.0016, 0.064, 0.011, 0.005, -0.44);
  // arrière noir : carcasse au-dessus du pontet, pontet massif percé d'une ouverture (l'index y entre devant la détente), détente,
  // poignée et son talon
  prof(g, M.poly, [[-0.119, 0.019, 0.002], [0.086, 0.019, 0.004], [0.086, -0.006, 0.006], [0.03, -0.02, 0.004], [-0.052, -0.02, 0.003], [-0.058, -0.04, 0.003], [-0.064, -0.058, 0.002], [-0.088, -0.012, 0.002]], 0.042, 0, 0.003, 0.004);
  prof(g, M.poly, [[-0.066, -0.014, 0], [-0.066, -0.088, 0.006], [-0.056, -0.1, 0.008], [0.03, -0.1, 0.008], [0.046, -0.088, 0.006], [0.04, -0.014, 0]], 0.018, 0, 0.003, 0.004,
    [[[-0.056, -0.022, 0.002], [-0.056, -0.084, 0.005], [0.03, -0.084, 0.005], [0.02, -0.022, 0.002]]]);
  rb(g, M.metal, 0, -0.039, -0.04, 0.006, 0.034, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.036, -0.002, 0.078, -0.122, 0.044, 0.032);
  prof(g, M.poly, [[0.064, -0.004, 0.002], [0.092, -0.004, 0.004], [0.094, -0.02, 0.006], [0.074, -0.03, 0.004]], 0.03, 0, 0.003, 0.003);
  // levier d'armement à l'avant gauche et sa fente, sélecteur, fenêtre d'éjection à droite, plaque de bretelle
  rb(g, M.metal, -0.0245, 0.026, -0.262, 0.005, 0.008, 0.07, 0.002);
  rb(g, M.rubber, -0.0232, 0.026, -0.175, 0.0016, 0.004, 0.1, 0.0008);
  rb(g, M.metal, -0.0222, 0.002, -0.004, 0.003, 0.007, 0.022, 0.0012, 0.25);
  rb(g, M.rubber, 0.0237, 0.036, -0.035, 0.0016, 0.016, 0.056, 0.001);
  rb(g, M.metal, -0.0235, 0.036, 0.07, 0.004, 0.014, 0.02, 0.0015);
  // canon bas, écrou de la plaque avant, protège-filetage (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.37 - Math.max(bl, -0.04);
  cy(g, M.dark, 0, 0, -0.318, 0.011, 0.012);
  cy(g, M.metal, 0, 0, (-0.314 + tip) / 2, 0.0075, Math.abs(tip + 0.314));
  if (!c.A.muzzle) { cy(g, M.dark, 0, 0, tip + 0.011, 0.0092, 0.022); cy(g, M.metal, 0, 0, tip + 0.002, 0.0085, 0.004); }
  // organes de visée relevables sur le rail : guidon à oreilles, hausse à œilleton (rien si une optique les remplace) ; traits en
  // fraction de l'écran (06jb-formes.js)
  info.sightY = 0.0895; info.adsZ = 0.124;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.0715, -0.285, 0.02, 0.009, 0.02, 0.002);
    bx(g, M.sight, 0, 0.0805, -0.285, ironW(c, -0.285, IRON.post), 0.018, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.079, -0.285, ironW(c, -0.285, IRON.ear), 0.016, 0.012);
    rb(g, M.dark, 0, 0.0725, -0.006, 0.022, 0.011, 0.024, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0102, 0.0855, -0.006, ironW(c, -0.006, IRON.wing), 0.016, 0.006);
    ironFoot(c, M.dark, -0.006, 0.0775, ironRing(c, -0.006, IRON.hole.smg), 0.01);
  }
  // crosse squelette : bras dans le prolongement du boîtier, jambe en biais, talon épais et plaque de couche
  // (variantes : rentrée, simple embout ; renforcée, talon plus large et busc)
  let butt;
  if (c.stock === 'none') {
    rb(g, M.poly, 0, 0.026, 0.096, 0.034, 0.05, 0.024, 0.006);
    rb(g, M.rubber, 0, 0.026, 0.111, 0.036, 0.054, 0.008, 0.003);
    butt = 0.115;
  } else {
    const hv = c.stock === 'heavy';
    prof(g, M.poly, [[0.08, 0.054, 0.004], [0.205, 0.05, 0.006], [0.218, 0.036, 0.006], [0.218, 0.004, 0.006], [0.18, 0.002, 0.004], [0.11, 0.006, 0.006], [0.08, -0.004, 0.004]], 0.032, 0, 0.004, 0.004);
    prof(g, M.poly, [[0.168, 0.008, 0.002], [0.192, 0.008, 0.002], [0.226, -0.098, 0.003], [0.206, -0.104, 0.003]], 0.024, 0, 0.003, 0.003);
    prof(g, M.poly, [[0.208, 0.044, 0.008], [0.25, 0.048, 0.006], [0.25, -0.112, 0.006], [0.2, -0.11, 0.008]], hv ? 0.048 : 0.04, 0, 0.005, 0.006);
    const pd = hv ? 0.02 : 0.014;
    rb(g, M.rubber, 0, -0.032, 0.249 + pd / 2, hv ? 0.052 : 0.044, 0.164, pd, 0.006);
    if (hv) rb(g, M.poly, 0, 0.061, 0.15, 0.03, 0.014, 0.1, 0.004);
    butt = 0.249 + pd;
  }
  info.butt = [0, 0.0, butt];
  // chargeur droit, incliné : le haut monte dans le puits, la plaque de talon dépasse de tous les côtés
  info.magHome.set(0, -0.114, -0.12);
  info.buildMag = (parent, ext) => {
    const { u, n } = VEC_MAG, h = 0.021, s0 = -0.062, s1 = 0.128 + (ext - 1) * 0.13, P = (s, k) => [u[0] * s + n[0] * k, u[1] * s + n[1] * k];
    prof(parent, M.poly, [P(s0, -h), P(s0, h), P(s1, h), P(s1, -h)], 0.026, 0, 0.003, 0.003);
    const b = P(s1 + 0.005, 0);
    rb(parent, M.dark, 0, b[1], b[0], 0.032, 0.012, 0.05, 0.003, -0.21);
  };
  info.magAxis = new V3(0, VEC_MAG.u[1], VEC_MAG.u[0]); info.magGrip = new V3(0, -0.034, 0.0073);
  info.gripR.set(0, -0.06, 0.064); info.gripL.set(0, -0.02, -0.27);
  info.mount.optic = { y: 0.0665, z: -0.11, len: 0.3, D: 0.21 };
  info.mount.muzzle = { x: 0, y: 0, z: tip, r: 0.0075 };
  info.mount.under = { y: -0.056, z: -0.272, len: 0.07 };
  info.mount.side = { x: -0.0255, y: -0.002, z: -0.262 };
  info.muzzle.position.set(0, 0, tip - 0.01); info.eject.position.set(0.024, 0.036, -0.035);
  info.gripDef = {
    R: [{ c: [0, -0.068, 0.062], h: [0.016, 0.054, 0.022], r: 0.01, rx: -0.33 }, { c: [0, 0.0, -0.01], h: [0.021, 0.02, 0.095], r: 0.006 }],
    L: [{ c: [0, -0.028, -0.262], h: [0.022, 0.02, 0.048], r: 0.006 }, { c: [0, 0.003, -0.262], h: [0.025, 0.018, 0.048], r: 0.006 }],
  };
  info.trigDef = { at: [0.004, -0.05, -0.05], xTip: -0.004, guard: [{ c: [0, -0.092, -0.013], h: [0.009, 0.008, 0.05], r: 0.003 }, { c: [0, -0.055, -0.061], h: [0.009, 0.041, 0.005], r: 0.002 }, { c: [0, -0.039, -0.04], h: [0.003, 0.017, 0.003], r: 0.002, rx: 0.18 }] };
  // poignée verticale sous l'avant, empoignée par la main gauche ; un accessoire sous le canon la remplace
  if (!c.A.under) {
    rb(g, M.dark, 0, -0.061, -0.264, 0.03, 0.01, 0.04, 0.003);
    rb(g, M.poly, 0, -0.1, -0.264, 0.026, 0.072, 0.032, 0.009);
    for (let i = 0; i < 4; i++) rb(g, M.rubber, 0, -0.078 - i * 0.015, -0.264, 0.0275, 0.004, 0.0335, 0.002);
    rb(g, M.poly, 0, -0.138, -0.264, 0.03, 0.006, 0.036, 0.003);
    underGrip(c, { c: [0, -0.1, -0.264], h: [0.013, 0.036, 0.016], r: 0.009 }, 'Lv');
  }
});
