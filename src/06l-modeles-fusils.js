/* ==========================================================================
   MODÈLES D'ARMES, FUSILS D'ASSAUT : AK-47, SCAR-H, FAMAS
   Même contexte que 06k-modeles-base.js. L'AK-47 porte son bois (garde-mains, crosse tombante et poignée), sa hausse à
   planchette et son chargeur très courbe ; le SCAR-H, long boîtier sable à rail continu, chargeur droit et crosse repliable à busc ; le FAMAS, un bullpup noir à poignée
   de transport basse à rail, levier d'armement à tige cintrée et chargeur derrière la poignée.
   ========================================================================== */

/* ---------- AK-47 : boîtier embouti à couvercle nervuré, rail de lunette latéral et rivets, hausse à planchette sur son bloc,
   tube et bloc de gaz, guidon à oreilles, baguette sous le canon, garde-mains haut et bas en bois et leur bague, frein de bouche
   biseauté, chargeur très courbe, poignée et crosse en bois (crosse tombante à busc, plaque métallique, grenadière). Cotes
   relevées sur une vue de profil (1,06 mm par pixel, calée sur la détente) ; poignée aux cotes d'avant pour la main du jeu,
   détente et pontet descendus de 1,5 cm. ---------- */
defineGun('ak47', 'rifle', (c) => {
  const { g, M, info, bl } = c;
  // boîtier embouti, couvercle nervuré et son bouton, rail de lunette latéral (gauche), rivets, levier d'armement et sûreté (droite)
  prof(g, M.metal, [[-0.198, 0.064, 0.003], [0.056, 0.064, 0.004], [0.066, 0.05, 0.006], [0.066, 0.0, 0.004], [0.05, -0.005, 0.003], [-0.198, -0.005, 0.003]], 0.04, 0, 0.003, 0.003);
  prof(g, M.metal, [[-0.196, 0.069, 0.003], [-0.17, 0.0715, 0.006], [0.04, 0.068, 0.008], [0.058, 0.064, 0.003], [0.058, 0.06, 0.002], [-0.196, 0.06, 0.002]], 0.038, 0, 0.004, 0.004);
  rb(g, M.dark, 0, 0.0712, -0.07, 0.01, 0.003, 0.2, 0.0012, 0.017);
  cy(g, M.dark, 0, 0.066, 0.061, 0.004, 0.008);
  rb(g, M.dark, -0.0208, 0.02, -0.044, 0.003, 0.02, 0.11, 0.001);
  for (const [z, y] of [[-0.135, 0.006], [-0.115, 0.006], [-0.03, 0.006], [-0.008, 0.012], [0.03, 0.006]]) cy(g, M.dark, 0, y, z, 0.0026, 0.0424, 0, 0, Math.PI / 2);
  cy(g, M.metal, 0.028, 0.044, -0.03, 0.0045, 0.02, 0, 0, Math.PI / 2);
  part(g, new THREE.SphereGeometry(1, 8, 6), M.metal, 0.039, 0.044, -0.03, 0.007, 0.007, 0.007);
  rb(g, M.metal, 0.0212, 0.036, -0.02, 0.003, 0.012, 0.1, 0.001);
  // bloc de hausse devant le boîtier, planchette couchée et cran de mire (rien si une optique les remplace)
  prof(g, M.metal, [[-0.256, 0.06, 0.003], [-0.196, 0.066, 0.003], [-0.196, 0.038, 0.003], [-0.256, 0.04, 0.003]], 0.032, 0, 0.003, 0.003);
  // pontet, détente, poignée en bois et son embase
  guard(g, M.metal, -0.072, 0.03, -0.002, -0.054, 0.005, 0.004, 0.009);
  rb(g, M.dark, 0, -0.026, -0.034, 0.006, 0.042, 0.006, 0.002, 0.18);
  rb(g, M.dark, 0, -0.012, -0.086, 0.008, 0.016, 0.006, 0.002, -0.2);
  gripProf(g, M.woodR, 0.0351, -0.0019, 0.078, -0.1193, 0.046, 0.034);
  rb(g, M.dark, 0, -0.1215, 0.0795, 0.033, 0.006, 0.047, 0.002, -0.35);
  // garde-main bas (et sa bague), garde-main haut sur le tube à gaz, tube et bloc de gaz, guidon, baguette
  prof(g, M.woodR, [[-0.358, 0.042, 0.004], [-0.203, 0.044, 0.004], [-0.197, 0.035, 0.003], [-0.197, -0.002, 0.006], [-0.25, -0.004, 0.012], [-0.352, -0.001, 0.01], [-0.358, 0.008, 0.006]], 0.048, 0, 0.006, 0.006);
  rb(g, M.metal, 0, 0.021, -0.36, 0.05, 0.05, 0.008, 0.004);
  prof(g, M.woodR, [[-0.354, 0.06, 0.006], [-0.262, 0.071, 0.006], [-0.25, 0.07, 0.003], [-0.25, 0.04, 0.003], [-0.354, 0.04, 0.003]], 0.034, 0, 0.004, 0.005);
  cy(g, M.metal, 0, 0.05, -0.42, 0.0085, 0.136);
  prof(g, M.metal, [[-0.492, 0.06, 0.003], [-0.47, 0.06, 0.003], [-0.47, 0.024, 0.003], [-0.492, 0.024, 0.003]], 0.024, 0, 0.003, 0.003);
  prof(g, M.metal, [[-0.574, 0.058, 0.003], [-0.548, 0.058, 0.003], [-0.548, 0.02, 0.003], [-0.574, 0.02, 0.003]], 0.026, 0, 0.003, 0.003);
  cy(g, M.metal, 0, 0.019, -0.46, 0.0025, 0.22);
  // canon et frein de bouche biseauté (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.582 - bl;
  cy(g, M.metal, 0, 0.032, (-0.205 + tip) / 2, 0.0085, Math.abs(tip + 0.205));
  if (!c.A.muzzle) { cy(g, M.dark, 0, 0.032, tip + 0.012, 0.0098, 0.024); bx(g, M.metal, 0, 0.0415, tip + 0.012, 0.012, 0.004, 0.02, -0.3); }
  // organes de visée : cran de mire sur la planchette, guidon à oreilles (rien si une optique les remplace) ; rail surélevé sinon
  info.sightY = 0.088; info.adsZ = 0.012;
  if (!c.optic) {
    // planchette couchée, cran de mire en U large (lisible en visée au-dessus du couvercle), guidon haut entre ses oreilles. Le haut
    // des épaules du cran suit la ligne de mire (il la dépassait de 6,5 mm) : la pointe du guidon se pose au ras, au milieu du cran.
    // Guidon et oreilles fins (traits en fraction de l'écran, 06jb-formes.js), la pointe seule sur la ligne de mire
    const y = info.sightY, nw = ironW(c, -0.198, 0.05), sw = 0.011 - nw / 2; // cran : 5 % de l'écran
    rb(g, M.dark, 0, 0.068, -0.222, 0.018, 0.011, 0.05, 0.0015);
    rb(g, M.dark, 0, 0.0785, -0.198, 0.022, 0.009, 0.008, 0.0015);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * (nw / 2 + sw / 2), (0.0825 + y) / 2, -0.198, sw, y - 0.0825, 0.008);
    bx(g, M.sight, 0, (0.0585 + y) / 2, -0.561, ironW(c, -0.561, IRON.post), y - 0.0585, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.007, (0.059 + y - 0.001) / 2, -0.561, ironW(c, -0.561, IRON.ear), y - 0.001 - 0.059, 0.012);
  } else {
    rb(g, M.dark, 0, 0.0745, -0.07, 0.026, 0.006, 0.17, 0.0015);
    for (let i = 0; i < 13; i++) bx(g, M.dark, 0, 0.0795, -0.142 + i * 0.012, 0.026, 0.004, 0.006);
  }
  // crosse en bois, tombante, à busc ; plaque de couche métallique, grenadière (variantes : sans crosse, embout ; renforcée, joue)
  let butt;
  if (c.stock === 'none') {
    rb(g, M.metal, 0, 0.026, 0.075, 0.022, 0.04, 0.02, 0.004);
    rb(g, M.rubber, 0, 0.026, 0.088, 0.034, 0.06, 0.008, 0.003);
    butt = 0.092;
  } else {
    prof(g, M.woodR, [[0.05, 0.034, 0.004], [0.12, 0.034, 0.01], [0.142, 0.039, 0.01], [0.168, 0.036, 0.01], [0.292, 0.013, 0.004], [0.292, -0.079, 0.004], [0.065, -0.014, 0.008], [0.05, -0.008, 0.004]], 0.036, 0, 0.005, 0.005);
    if (c.stock === 'heavy') rb(g, M.woodR, 0, 0.038, 0.225, 0.03, 0.02, 0.12, 0.008, -0.17);
    rb(g, M.metal, 0, -0.033, 0.294, 0.038, 0.096, 0.006, 0.003);
    part(g, G_TOR, M.metal, 0, -0.066, 0.23, 0.0065, 0.0065, 0.0065, 0, Math.PI / 2, 0);
    butt = 0.297;
  }
  info.butt = [0, -0.02, butt];
  info.magHome.set(0, -0.01, -0.139);
  info.buildMag = (parent, ext) => curvedMag(parent, M, 6, 0.185 * ext, 0.03, 0.068, 0.72, M.metal);
  info.magAxis = new V3(0, -0.98, -0.2); info.magGrip = new V3(0, -0.08, -0.03);
  info.gripR.set(0, -0.05, 0.062); info.gripL.set(0, 0.02, -0.305);
  info.mount.optic = { y: 0.078, z: -0.07, len: 0.17, D: 0.24 };
  info.mount.muzzle = { x: 0, y: 0.032, z: tip, r: 0.0085 };
  info.mount.under = { y: -0.002, z: -0.29, len: 0.13 };
  info.mount.side = { x: -0.024, y: 0.02, z: -0.31 };
  info.muzzle.position.set(0, 0.032, tip - 0.01); info.eject.position.set(0.021, 0.05, -0.03);
  info.gripDef = {
    R: [{ c: [0, -0.07, 0.06], h: [0.017, 0.0525, 0.023], r: 0.01, rx: -0.35 }, { c: [0, 0.03, -0.03], h: [0.02, 0.034, 0.12], r: 0.006 }],
    L: [{ c: [0, 0.02, -0.283], h: [0.024, 0.024, 0.076], r: 0.012 }, { c: [0, 0.055, -0.3], h: [0.017, 0.016, 0.053], r: 0.01 }, { c: [0, 0.021, -0.36], h: [0.025, 0.025, 0.004], r: 0.004 }],
  };
  info.trigDef = { at: [0.004, -0.04, -0.046], xTip: -0.004, guard: [{ c: [0, -0.0515, -0.02], h: [0.0045, 0.0025, 0.05], r: 0.002 }, { c: [0, -0.028, -0.0695], h: [0.0045, 0.025, 0.0025], r: 0.002 },
    { c: [0, -0.03, -0.139], h: [0.018, 0.025, 0.036], r: 0.006 }, { c: [0, -0.026, -0.034], h: [0.003, 0.021, 0.003], r: 0.002, rx: 0.18 }] };
});

/* ---------- SCAR-H (Mk 17) : long boîtier supérieur sable à rail continu, rails latéraux et rail cranté sous l'avant, levier
   d'armement à gauche dans sa rainure, guidon et hausse rabattables, boîtier inférieur à puits de chargeur, chargeur droit
   nervuré, poignée noire grenue, crosse repliable à busc noir, partie télescopique, talon plongeant et plaque de couche striée.
   D'après une vue de trois quarts et les proportions de l'arme (16 pouces de canon) ; poignée, détente et main droite aux cotes
   du M4. ---------- */
defineGun('scarh', 'rifle', (c) => {
  const { g, M, info, bl } = c, MS = Object.assign({}, M, { dark: M.tan }); // rails du boîtier sable (anodisés comme lui)
  // boîtier supérieur : chanfrein avant, rail de dessus continu, rails latéraux à l'avant, rail cranté dessous (dents apparentes)
  prof(g, M.tan, [[-0.43, 0.06, 0.004], [-0.42, 0.068, 0.004], [0.112, 0.068, 0.004], [0.116, 0.062, 0.003], [0.116, 0.01, 0.004], [-0.43, 0.004, 0.004]], 0.05, 0, 0.004, 0.004);
  rail(g, MS, 0, 0.072, -0.16, 0.54);
  for (const sx of [-1, 1]) rail(g, M, sx * 0.027, 0.036, -0.355, 0.09, true);
  rb(g, M.tan, 0, 0.004, -0.31, 0.024, 0.008, 0.2, 0.002);
  for (let i = 0; i < 15; i++) bx(g, M.tan, 0, -0.002, -0.4 + i * 0.013, 0.024, 0.004, 0.006);
  // allègements du haut, rainure du levier d'armement (flanc gauche), levier, port de bretelle, fenêtre d'éjection
  for (const sx of [-1, 1]) for (const z of [-0.395, -0.36, -0.325]) rb(g, M.rubber, sx * 0.0253, 0.058, z, 0.0016, 0.006, 0.026, 0.003);
  rb(g, M.rubber, -0.0253, 0.046, -0.215, 0.0016, 0.006, 0.2, 0.003);
  cy(g, M.dark, -0.03, 0.046, -0.3, 0.0035, 0.012, 0, 0, Math.PI / 2);
  cy(g, M.dark, -0.037, 0.046, -0.3, 0.0068, 0.008, 0, 0, Math.PI / 2);
  rb(g, M.dark, -0.0258, 0.022, -0.235, 0.003, 0.012, 0.034, 0.005);
  for (let i = 0; i < 3; i++) cy(g, M.metal, -0.0275, 0.022, -0.247 + i * 0.012, 0.0022, 0.002, 0, 0, Math.PI / 2);
  rb(g, M.rubber, 0.0258, 0.04, -0.03, 0.0016, 0.02, 0.07, 0.003);
  // boîtier inférieur : puits de chargeur, carcasse au-dessus du pontet, arrière qui remonte vers la charnière
  prof(g, M.tan, [[-0.194, 0.012, 0.003], [0.116, 0.012, 0.003], [0.116, -0.006, 0.006], [0.078, -0.03, 0.006], [0.03, -0.036, 0.004], [-0.064, -0.036, 0.004],
    [-0.07, -0.076, 0.006], [-0.188, -0.08, 0.006], [-0.194, -0.07, 0.004]], 0.048, 0, 0.004, 0.004);
  guard(g, M.tan, -0.066, 0.034, -0.034, -0.08, 0.0065, 0.006, 0.01);
  rb(g, M.dark, 0, -0.05, -0.034, 0.006, 0.034, 0.006, 0.002, 0.18);
  // arrêtoir de culasse et palette de chargeur (gauche), sélecteur des deux côtés, goupilles
  rb(g, M.dark, -0.0255, -0.004, -0.085, 0.003, 0.022, 0.008, 0.001, -0.15);
  rb(g, M.dark, -0.0255, -0.03, -0.1, 0.003, 0.008, 0.026, 0.002);
  for (const sx of [-1, 1]) { cy(g, M.dark, sx * 0.0255, -0.012, 0.01, 0.006, 0.003, 0, 0, Math.PI / 2); rb(g, M.dark, sx * 0.0268, -0.012, 0.022, 0.003, 0.006, 0.024, 0.001, 0.2); }
  for (const [z, y] of [[-0.02, 0.0], [0.07, -0.004]]) cy(g, M.metal, 0, y, z, 0.0032, 0.0504, 0, 0, Math.PI / 2);
  // poignée noire et ses plaques grenues
  gripProf(g, M.poly, 0.0365, -0.0015, 0.077, -0.12, 0.044, 0.032);
  for (const sx of [-1, 1]) rb(g, M.grip, sx * 0.0162, -0.068, 0.062, 0.002, 0.06, 0.026, 0.004, -0.33);
  // canon, écrou et bloc de gaz devant le boîtier, cache-flamme à bague (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.66 - bl;
  cy(g, M.dark, 0, 0.035, -0.442, 0.015, 0.026);
  cy(g, M.metal, 0, 0.035, (-0.455 + tip) / 2, 0.0105, Math.abs(tip + 0.455));
  if (!c.A.muzzle) {
    cy(g, M.metal, 0, 0.035, tip + 0.036, 0.0135, 0.072);
    cy(g, M.dark, 0, 0.035, tip + 0.076, 0.0158, 0.01);
    for (let i = 0; i < 4; i++) bx(g, M.rubber, Math.cos(i * 1.57) * 0.0136, 0.035 + Math.sin(i * 1.57) * 0.0136, tip + 0.022, 0.004, 0.004, 0.034);
  }
  // guidon rabattable à oreilles à l'avant du rail, hausse relevable à œilleton à l'arrière (rien si une optique les remplace) ; traits
  // en fraction de l'écran (06jb-formes.js), l'œilleton tenu par un montant
  info.sightY = 0.1045; info.adsZ = 0.285;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.0815, -0.412, 0.016, 0.012, 0.022, 0.002);
    bx(g, M.sight, 0, 0.0945, -0.412, ironW(c, -0.412, IRON.post), 0.02, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0068, 0.093, -0.412, 0.0018, 0.022, 0.006);
    rb(g, M.dark, 0, 0.0815, 0.075, 0.022, 0.012, 0.026, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0105, 0.0975, 0.075, ironW(c, 0.075, IRON.wing), 0.022, 0.006); // à côté de l'anneau
    ironFoot(c, M.dark, 0.075, 0.087, ironRing(c, 0.075, IRON.hole.rifle), 0.012);
  }
  // charnière, crosse repliable : partie fixe et busc noir, partie télescopique, talon plongeant percé d'un passant, plaque striée
  // (variantes : sans crosse, embout sur la charnière ; renforcée, busc haut et plaque épaisse)
  prof(g, M.tan, [[0.112, 0.07, 0.003], [0.152, 0.07, 0.004], [0.154, -0.01, 0.004], [0.112, -0.012, 0.003]], 0.052, 0, 0.004, 0.004);
  let butt;
  if (c.stock === 'none') {
    rb(g, M.rubber, 0, 0.03, 0.157, 0.046, 0.07, 0.008, 0.003);
    butt = 0.161;
  } else {
    const hv = c.stock === 'heavy';
    prof(g, M.tan, [[0.148, 0.062, 0.003], [0.272, 0.062, 0.003], [0.272, 0.0, 0.004], [0.148, -0.006, 0.003]], 0.046, 0, 0.004, 0.004);
    prof(g, M.poly, [[0.155, hv ? 0.088 : 0.078, 0.01], [0.262, hv ? 0.084 : 0.074, 0.008], [0.27, 0.06, 0.004], [0.27, 0.03, 0.004], [0.155, 0.03, 0.004]], 0.05, 0, 0.004, 0.005);
    rb(g, M.dark, -0.0258, 0.058, 0.172, 0.003, 0.016, 0.016, 0.003);
    prof(g, M.tan, [[0.266, 0.058, 0.003], [0.334, 0.058, 0.003], [0.334, 0.004, 0.003], [0.266, 0.004, 0.003]], 0.042, 0, 0.004, 0.004);
    for (let i = 0; i < 6; i++) bx(g, M.rubber, -0.0213, 0.012, 0.28 + i * 0.009, 0.0016, 0.006, 0.0025);
    prof(g, M.tan, [[0.29, 0.008, 0.003], [0.335, 0.008, 0.003], [0.335, -0.112, 0.006], [0.318, -0.118, 0.006], [0.304, -0.04, 0.01]], 0.04, 0, 0.004, 0.004);
    rb(g, M.dark, -0.0205, -0.022, 0.322, 0.003, 0.018, 0.02, 0.003);
    const pd = hv ? 0.02 : 0.014;
    rb(g, M.rubber, 0, -0.03, 0.335 + pd / 2, 0.046, 0.184, pd, 0.006);
    for (let i = 0; i < 12; i++) bx(g, M.rubber, 0, 0.05 - i * 0.014, 0.3355 + pd, 0.04, 0.005, 0.003);
    butt = 0.336 + pd;
  }
  info.butt = [0, 0.0, butt];
  // chargeur droit de 7,62 (à peine courbe), nervures sur la face avant
  info.magHome.set(0, -0.074, -0.131);
  info.buildMag = (parent, ext) => curvedMag(parent, M, 6, 0.155 * ext, 0.03, 0.08, 0.12, M.dark);
  info.magAxis = new V3(0, -0.99, -0.12); info.magGrip = new V3(0, -0.075, -0.012);
  info.gripR.set(0, -0.06, 0.062); info.gripL.set(0, 0.036, -0.27);
  info.mount.optic = { y: 0.077, z: -0.1, len: 0.5, D: 0.26 };
  info.mount.muzzle = { x: 0, y: 0.035, z: tip, r: 0.0105 };
  info.mount.under = { y: -0.004, z: -0.31, len: 0.18 };
  info.mount.side = { x: -0.031, y: 0.036, z: -0.355 };
  info.muzzle.position.set(0, 0.035, tip - 0.01); info.eject.position.set(0.026, 0.04, -0.03);
  info.gripDef = {
    R: [{ c: [0, -0.07, 0.06], h: [0.016, 0.0525, 0.022], r: 0.01, rx: -0.33 }, { c: [0, -0.012, -0.04], h: [0.024, 0.024, 0.12], r: 0.006 }],
    L: [{ c: [0, 0.036, -0.31], h: [0.025, 0.032, 0.12], r: 0.006 }, { c: [0, 0.074, -0.3], h: [0.011, 0.006, 0.12], r: 0.002 },
      { c: [0.029, 0.036, -0.355], h: [0.006, 0.012, 0.045], r: 0.002 }, { c: [-0.029, 0.036, -0.355], h: [0.006, 0.012, 0.045], r: 0.002 }, { c: [0, 0.001, -0.31], h: [0.012, 0.005, 0.1], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.056, -0.046], xTip: -0.004, guard: [{ c: [0, -0.077, -0.016], h: [0.005, 0.003, 0.05], r: 0.002 }, { c: [0, -0.057, -0.063], h: [0.004, 0.022, 0.003], r: 0.002 },
    { c: [0, -0.035, -0.131], h: [0.024, 0.045, 0.061], r: 0.006 }, { c: [0, -0.052, -0.034], h: [0.003, 0.015, 0.003], r: 0.002, rx: 0.18 }] };
});

/* ---------- FAMAS : construit d'après une vue de profil (P : 0,4485 mm par pixel, longueur réelle 757 mm), noir. Bullpup : poignée
   devant le chargeur, pontet en fil, longue crosse ; poignée de transport à rail posée entre la tour du guidon et le bloc arrière (la
   hausse), levier d'armement : moyeu et bras sur le flanc gauche, prolongés d'une tige cintrée jusqu'au-dessus du chargeur.
   La main droite du jeu tient la détente 10,8 cm devant sa prise (la vraie arme : 8,9 cm) : l'arrière de l'arme (poignée, chargeur,
   crosse, bloc arrière : Q) recule de D = 1,9 cm. Contrôle : node tools/dev/visual/contour.js --arme famas --photo <profil gauche,
   1920 x 1080> --mmpx 0.4485 --ancre 875,431,-0.07,0.0371 (avant ; l'arrière est décalé de D). ---------- */
defineGun('famas', 'rifle', (c) => {
  const { g, M, info, bl } = c, B = M.poly, D0 = M.dark, K = M.rubber, sx2 = [-1, 1];
  const S = 0.0004485, D = 0.0186, P = (x, y, r) => { const q = [-0.07 + (x - 875) * S, 0.0371 - (y - 431) * S]; if (r !== undefined) q.push(r); return q; };
  const Q = (x, y, r) => { const q = P(x, y, r); q[0] += D; return q; }, R = (x, y, r) => (x < 985 ? P(x, y, r) : Q(x, y, r));
  const Pz = (x) => P(x, 0)[0], Qz = (x) => Pz(x) + D, Rz = (x) => R(x, 0)[0], Py = (y) => P(0, y)[1];
  const by = Py(431), w = 0.046;
  // grain fin sur les grandes faces (coordonnées de texture resserrées, sur une copie de la géométrie partagée)
  const fine = (m, k = 2.5) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };

  // ----- coque d'un seul tenant : garde-mains (lèvre avant), boîtier, crosse et sa joue ; bloc arrière (sous la hausse), plus étroit -----
  fine(prof(g, B, [P(418, 400, 0.004), P(440, 391, 0.004), P(478, 388, 0.002), P(568, 384, 0.002), R(1062, 380, 0.002), Q(1206, 377, 0.004), Q(1250, 375, 0.004), Q(1475, 375, 0.004), Q(1490, 390, 0.004), Q(1550, 390, 0.006), Q(1580, 351, 0.008), Q(1598, 342, 0.004),
    Q(1760, 342, 0.006), Q(1782, 352, 0.006), Q(1796, 390, 0.004), Q(1797, 505, 0.006), Q(1776, 578, 0.008), Q(1745, 621, 0.006), Q(1668, 623, 0.008), Q(1550, 582, 0.008),
    Q(1475, 561, 0.006), Q(1402, 552, 0.002), Q(1400, 562, 0.002), Q(1250, 562, 0.002), Q(1222, 550, 0.006), Q(1192, 518, 0.008), Q(1130, 501, 0.006), Q(1090, 504, 0.004),
    R(1000, 515, 0.002), P(850, 516, 0.002), P(845, 533, 0.003), P(828, 529, 0.003), P(815, 518, 0.002), P(470, 512, 0.006), P(452, 502, 0.006), P(436, 484, 0.006),
    P(420, 470, 0.004)], w, 0, 0.004, 0.003));
  fine(prof(g, B, [Q(1062, 384, 0.002), Q(1070, 330, 0.006), Q(1100, 317, 0.006), Q(1192, 314, 0.004), Q(1203, 328, 0.004), Q(1207, 384, 0.002)], 0.032, 0, 0.004, 0.003));
  // plaque de couche, échancrures du dessous du garde-mains, bouton du flanc gauche
  prof(g, K, [Q(1784, 352, 0.004), Q(1796, 390, 0.003), Q(1803, 430, 0.004), Q(1801, 500, 0.004), Q(1790, 540, 0.006), Q(1776, 578, 0.004), Q(1772, 560, 0.004), Q(1782, 470, 0.004)], w - 0.004, 0, 0.003, 0.002);
  for (let k = 0; k < 5; k++) { const x = 545 + k * 60; for (const sx of sx2) prof(g, K, [P(x - 16, 511), P(x, 480, 0.002), P(x + 16, 511)], 0.0012, sx * (w / 2 + 0.0003), 0, 0.002); }
  { const q = P(690, 468); cy(g, D0, -(w / 2 + 0.0008), q[1], q[0], 0.0055, 0.002, 0, 0, Math.PI / 2); }
  // petit rail sur l'avant du garde-mains
  rb(g, D0, 0, Py(385), (Pz(478) + Pz(560)) / 2, 0.018, 0.004, Pz(560) - Pz(478), 0.001);
  for (let k = 0; k < 4; k++) bx(g, D0, 0, Py(379), Pz(486 + k * 21), 0.02, 0.004, 0.0045);

  // ----- tour du guidon (dessus en pente vers la poignée de transport), poignée de transport à rail, hausse -----
  fine(prof(g, B, [P(568, 386, 0.002), P(568, 312, 0.004), P(576, 305, 0.003), P(712, 327, 0.004), P(726, 321, 0.002), P(726, 380, 0.002)], 0.03, 0, 0.003, 0.003));
  prof(g, B, [P(722, 326, 0.002), R(1074, 326, 0.002), Q(1074, 345, 0.003), P(735, 345, 0.006), P(722, 352, 0.002)], 0.024, 0, 0.003, 0.002);
  for (let x = 727; x < 1062; x += 22.4) { const a = R(x, 322), b = R(x + 12, 322); bx(g, D0, 0, a[1], (a[0] + b[0]) / 2, 0.024, 0.0036, b[0] - a[0]); }
  // levier d'armement (flanc gauche) : moyeu, bras vers la poignée de transport, tige cintrée jusqu'au-dessus du chargeur, crochet
  const lx = -(w / 2 + 0.003);
  { const q = P(616, 395); cy(g, D0, lx + 0.001, q[1], q[0], 0.0098, 0.006, 0, 0, Math.PI / 2); cy(g, M.metal, lx - 0.0025, q[1], q[0], 0.004, 0.003, 0, 0, Math.PI / 2); }
  prof(g, D0, [P(605, 384, 0.004), P(700, 352, 0.006), P(770, 357, 0.004), P(782, 372, 0.004), P(770, 392, 0.004), P(705, 380, 0.006), P(626, 410, 0.004)], 0.004, lx + 0.001, 0.001, 0.003);
  const rod = [P(770, 398), P(900, 398), R(1000, 399), Q(1060, 406), Q(1120, 424), Q(1180, 447), Q(1230, 464), Q(1262, 470)];
  for (let i = 0; i < rod.length - 1; i++) {
    const a = rod[i], b = rod[i + 1], L = hyp(b[0] - a[0], b[1] - a[1]);
    cy(g, M.metal, lx - 0.001, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, 0.0026, L + 0.003, Math.PI / 2 + Math.atan2(b[1] - a[1], a[0] - b[0]));
  }
  prof(g, D0, [Q(1255, 455, 0.002), Q(1272, 452, 0.002), Q(1280, 470, 0.003), Q(1272, 498, 0.003), Q(1262, 496, 0.002), Q(1264, 476, 0.002)], 0.005, lx, 0.001, 0.002);

  // ----- canon : bague au nez du garde-mains, canon à bagues lance-grenades, cache-flamme ouvert (remplacé par le dispositif de bouche) -----
  const tip = Pz(116) - bl;
  cz(g, D0, 0, by, (Pz(395) + Pz(420)) / 2, 0.0108, Pz(420) - Pz(395));
  cz(g, M.metal, 0, by, (tip + Pz(400)) / 2, 0.0076, Pz(400) - tip);
  for (let k = 0; k < 9; k++) part(g, G_TOR, M.metal, 0, by, Pz(286 + k * 12), 0.0074, 0.0074, 0.012);
  if (!c.A.muzzle) {
    cz(g, D0, 0, by, tip + (Pz(240) - Pz(116)) / 2, 0.011, Pz(240) - Pz(116));
    for (const s of [-1, 1]) bx(g, K, 0, by + s * 0.0045, tip + 0.022, 0.0224, 0.002, 0.03);
    cz(g, K, 0, by, tip - 0.0001, 0.0078, 0.0006);
  }

  // ----- pontet en fil, détente, poignée à reprises de doigts -----
  prof(g, M.metal, [P(830, 516, 0.002), P(833, 562, 0.008), P(846, 592, 0.008), P(870, 603, 0.006), P(932, 601, 0.008), P(962, 589, 0.008), P(975, 562, 0.006), P(978, 516, 0.002)], 0.005, 0, 0.0012, 0.002,
    [[P(838, 516, 0.001), P(841, 560, 0.008), P(851, 585, 0.008), P(871, 595, 0.006), P(930, 593, 0.008), P(955, 584, 0.008), P(967, 560, 0.006), P(970, 516, 0.001)]]);
  prof(g, D0, [P(864, 516), P(866, 532, 0.002), P(874, 560, 0.008), P(880, 586, 0.003), P(888, 586, 0.002), P(886, 558, 0.008), P(880, 532, 0.002), P(882, 516)], 0.006, 0, 0.0012, 0.0015);
  fine(prof(g, B, [P(976, 512, 0.002), R(985, 590, 0.006), Q(993, 612, 0.008), Q(1000, 628, 0.004), Q(1012, 642, 0.006), Q(1018, 662, 0.008), Q(1022, 682, 0.004), Q(1034, 694, 0.006),
    Q(1039, 712, 0.008), Q(1046, 731, 0.008), Q(1066, 739, 0.01), Q(1092, 732, 0.01), Q(1114, 721, 0.01), Q(1128, 708, 0.008), Q(1134, 686, 0.008), Q(1133, 655, 0.01),
    Q(1126, 622, 0.01), Q(1112, 592, 0.01), Q(1096, 570, 0.008), Q(1080, 548, 0.006), Q(1074, 520, 0.004), Q(1090, 503, 0.002)], 0.03, 0, 0.004, 0.003));
  // arrêtoir du chargeur
  prof(g, D0, [Q(1232, 556, 0.002), Q(1250, 556, 0.002), Q(1250, 598, 0.003), Q(1240, 622, 0.003), Q(1230, 620, 0.003), Q(1236, 592, 0.003)], 0.012, 0, 0.0015, 0.002);

  // ----- organes de visée fins (rien si une optique les remplace) : lame du guidon et ses oreilles sur la tour, œilleton sur le bloc
  // arrière, avec son montant et ses oreilles ; traits en fraction de l'écran (06jb-formes.js), pointe de la lame sur la ligne de
  // mire (elle était 0,5 mm dessous) -----
  const SY = Py(286), zr = Qz(1160), zf = Pz(593);
  info.sightY = SY; info.adsZ = zr + 0.19;
  if (!c.optic) {
    for (const sx of sx2) prof(g, D0, [P(583, 308), P(584, 290, 0.0008), P(600, 290, 0.0008), P(604, 309)], ironW(c, zf, IRON.ear), sx * 0.0062, 0.0004, 0.001);
    prof(g, M.sight, [P(588, 307), P(589, 286, 0.0005), P(596, 286, 0.0005), P(598, 308)], ironW(c, zf, IRON.post), 0, 0.0004, 0.0006);
    rb(g, D0, 0, Py(311), zr, 0.026, 0.006, 0.026, 0.002);
    ironFoot(c, D0, zr, Py(312), ironRing(c, zr, IRON.hole.rifle), 0.016);
    for (const sx of sx2) bx(g, D0, sx * 0.0102, (Py(312) + SY - 0.001) / 2, zr, ironW(c, zr, IRON.wing), SY - 0.001 - Py(312), 0.006);
  }

  // ----- chargeur droit (profond), à nervures, plaque de fond inclinée -----
  info.magHome.set(0, Py(560), Qz(1328));
  info.buildMag = (parent, ext) => {
    const e = (ext - 1) * 0.1, zf = Qz(1256) - Qz(1328), zb = Qz(1400) - Qz(1328), yf = (560 - 760) * S - e, yb = (560 - 795) * S - e;
    prof(parent, B, [[zf, 0.008, 0.002], [zf, yf, 0.005], [zb, yb, 0.004], [zb, 0.008, 0.002]], 0.028, 0, 0.003, 0.003);
    for (const z of [zf + 0.02, (zf + zb) / 2, zb - 0.02]) rb(parent, B, 0, (yf + yb) / 2 * 0.5, z, 0.0292, Math.abs(yf) * 0.8, 0.004, 0.0015);
  };
  info.magAxis = new V3(0, -1, 0); info.magGrip = new V3(0, (560 - 760) * S + 0.012, 0);
  info.magP = [0, Py(700), Qz(1328)];

  // ----- mains, visée, montages -----
  info.butt = [0, Py(470), Qz(1803)];
  info.gripR.set(0, Py(594), Qz(1052)); info.gripL.set(0, Py(452), Pz(610));
  info.mount.optic = { y: Py(320), z: (Pz(735) + Qz(1050)) / 2, len: Qz(1050) - Pz(735), D: 0.27 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0076 };
  info.mount.under = { y: Py(511), z: Pz(650), len: 0.1 };
  info.mount.side = { x: -(w / 2 + 0.0025), y: Py(440), z: Pz(510) };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(w / 2 + 0.002, Py(420), Qz(1150));
  info.gripDef = {
    R: [{ c: [0, Py(640), Qz(1062)], h: [0.015, 0.05, 0.024], r: 0.01, rx: -0.4 }, { c: [0, Py(470), Qz(1040)], h: [0.023, 0.02, 0.05], r: 0.006 }],
    L: [{ c: [0, Py(450), Pz(640)], h: [w / 2, (512 - 388) / 2 * S, (Pz(830) - Pz(440)) / 2], r: 0.008 }],
  };
  // index sur le bas de la détente (sa face avant à x 866) ; le pontet en fil n'est pas une forme de prise : le doigt s'y accrochait
  info.trigDef = { at: [0.004, Py(585), Pz(866) - 0.0085], xTip: -0.004, guard: [] };
});
