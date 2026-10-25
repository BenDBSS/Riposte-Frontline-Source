/* ==========================================================================
   MODÈLES D'ARMES, FUSILS DE PRÉCISION SEMI-AUTOMATIQUES : Dragunov SVD, Barrett M82
   Même contexte que 06k-modeles-base.js. Pas de culasse à manœuvrer (le tir éjecte seul) : le rechargement à vide passe par
   la poignée d'armement (def.rig = 'rifle'). La lunette est fixe et centrée, comme celle du L96A1.
   ========================================================================== */
/* Bout ouvert d'une lunette : tube creux (paroi extérieure wall, intérieur sombre vu des deux côtés), bord rond rim à l'ouverture,
   lentille au fond, en retrait de depth, tenue par sa bague, et son reflet peint (en haut à gauche). z : plan de l'ouverture, r : rayon
   à l'ouverture, r0 : au fond ; dir : -1 côté objectif (ouvert vers la bouche), 1 côté oculaire (ouvert vers l'œil) */
function scopeEnd(g, M, y, z, r, r0, dir, depth, wall = M.dark, rim = M.dark) {
  const zc = z - (dir * depth) / 2, zl = z - dir * depth, rf = dir < 0 ? r : r0, rr = dir < 0 ? r0 : r;
  cone(g, wall, 0, y, zc, rf, rr, depth, 20, true);
  cone(g, M.tube, 0, y, zc, rf * 0.93, rr * 0.93, depth, 20, true);
  part(g, G_TOR, rim, 0, y, z, r * 0.96, r * 0.96, r * 0.6);
  cy(g, M.glass, 0, y, zl + dir * 0.0008, r0 * 0.93, 0.0016);
  part(g, G_CYL12, M.glint, -r0 * 0.38, y + r0 * 0.38, zl + dir * 0.0019, r0 * 0.2, 0.0002, r0 * 0.11, Math.PI / 2, 0.8, 0);
  part(g, G_TOR, M.dark, 0, y, zl + dir * 0.0018, r0 * 0.86, r0 * 0.86, r0 * 0.35);
}

/* ---------- Dragunov SVD : boîtier embouti à couvercle et rail latéral de lunette, hausse sur la bague arrière, longs garde-mains
   ronds en bois percés de deux rangées de lumières et leurs bagues, bloc de gaz, canon mince, guidon sur son embase à tenon de
   baïonnette, cache-flamme à fentes, chargeur droit à nervures embouties, crosse squelette en bois (trou de pouce, ajour arrière,
   joue rapportée, plaque de couche métallique), lunette PSO-1 (pare-soleil, tourelles, oculaire renflé, œilleton en caoutchouc) sur
   son support à plaque latérale, centrée sur l'arme. Cotes relevées sur une vue de profil (1,48 mm par pixel, longueur réelle de
   1,225 m) ; poignée et détente aux cotes de l'AK-47 pour la main du jeu, crosse reculée d'autant (2,2 cm). ---------- */
defineGun('svd', 'sniper', (c) => {
  const { g, M, info } = c, heavy = c.stock === 'heavy';
  // boîtier embouti (bas plus haut au-dessus du puits, arrière fuyant sous la crosse), couvercle et son bouton, rail latéral gauche
  prof(g, M.metal, [[-0.2533, 0.061, 0.002], [0.019, 0.061, 0.006], [0.056, 0.049, 0.008], [0.066, 0.038, 0.004], [0.066, 0.03, 0.002], [0.016, 0.004, 0.004],
    [0.012, -0.005, 0.002], [-0.137, -0.005, 0.003], [-0.139, 0.0084, 0.002], [-0.2533, 0.0084, 0.002]], 0.038, 0, 0.003, 0.003);
  prof(g, M.metal, [[-0.205, 0.0635, 0.002], [0.04, 0.0635, 0.006], [0.054, 0.058, 0.004], [0.054, 0.05, 0.002], [-0.205, 0.05, 0.002]], 0.0395, 0, 0.004, 0.003);
  cy(g, M.dark, 0, 0.0555, 0.057, 0.0035, 0.008);
  rb(g, M.dark, -0.0195, 0.037, -0.115, 0.003, 0.01, 0.15, 0.001);
  // à droite : poignée d'armement, fenêtre d'éjection, long levier de sûreté ; dessous : arrêtoir du chargeur
  cy(g, M.metal, 0.025, 0.04, -0.12, 0.0045, 0.016, 0, 0, Math.PI / 2);
  part(g, new THREE.SphereGeometry(1, 8, 6), M.metal, 0.035, 0.04, -0.12, 0.0065, 0.0065, 0.0065);
  rb(g, M.dark, 0.0192, 0.044, -0.088, 0.0012, 0.014, 0.05, 0.0005);
  rb(g, M.dark, 0.0205, 0.022, -0.06, 0.003, 0.02, 0.1, 0.001);
  rb(g, M.dark, 0, -0.012, -0.124, 0.008, 0.016, 0.007, 0.002, -0.2);
  // hausse : bloc et planchette sur la bague arrière du garde-main
  rb(g, M.dark, 0, 0.0665, -0.258, 0.02, 0.012, 0.024, 0.002);
  rb(g, M.dark, 0, 0.0738, -0.255, 0.014, 0.0035, 0.034, 0.001, 0.06);
  // pontet, détente, poignée (prise de l'AK-47)
  guard(g, M.metal, -0.074, 0.03, -0.002, -0.054, 0.005, 0.004, 0.009);
  rb(g, M.dark, 0, -0.026, -0.034, 0.006, 0.042, 0.006, 0.002, 0.18);
  gripProf(g, M.woodB, 0.0351, -0.0019, 0.0732, -0.106, 0.046, 0.034);
  // crosse squelette d'un seul tenant : poutre haute, poutre basse, trou de pouce derrière la poignée, ajour arrière ; joue rapportée
  // (plus haute avec la crosse renforcée), plaque de couche métallique
  prof(g, M.woodB, [[0.064, 0.0342, 0.002], [0.296, 0.0342, 0.004], [0.296, -0.086, 0.004], [0.112, -0.068, 0.012], [0.08, -0.082, 0.01], [0.032, -0.05, 0.004],
    [0.014, -0.004, 0.003], [0.016, 0.006, 0.002]], 0.036, 0, 0.005, 0.005,
  [[[0.06, 0.0143, 0.008], [0.1855, 0.0143, 0.012], [0.1855, -0.0396, 0.012], [0.1265, -0.0475, 0.01], [0.072, -0.052, 0.01]],
    [[0.218, 0.0143, 0.008], [0.271, 0.0143, 0.008], [0.271, -0.046, 0.008], [0.218, -0.046, 0.008]]]);
  rb(g, M.poly, 0, heavy ? 0.0505 : 0.046, 0.178, 0.03, heavy ? 0.034 : 0.025, 0.11, 0.008);
  rb(g, M.metal, 0, -0.026, 0.299, 0.037, 0.122, 0.006, 0.003);
  info.butt = [0, -0.02, 0.302];
  // garde-mains ronds entre leurs deux bagues, deux rangées de trois lumières
  rb(g, M.metal, 0, 0.0345, -0.259, 0.047, 0.06, 0.012, 0.006);
  prof(g, M.woodB, [[-0.536, 0.0625, 0.006], [-0.262, 0.0635, 0.004], [-0.262, 0.007, 0.004], [-0.536, 0.0172, 0.006]], 0.044, 0, 0.012, 0.006);
  rb(g, M.metal, 0, 0.04, -0.54, 0.047, 0.05, 0.009, 0.008);
  for (const [y, zs] of [[0.0453, [-0.512, -0.4572, -0.404]], [0.031, [-0.4853, -0.4307, -0.376]]]) for (const z of zs) {
    prof(g, M.rubber, [[-0.0118, 0.0033], [0.0118, 0.0033], [0.0118, -0.0033], [-0.0118, -0.0033]], 0.0446, 0, 0, 0.0033).position.set(0, y, z);
  }
  // bloc de gaz (chambre à l'avant fuselé, bague de réglage, collier sur le canon), canon mince, guidon à oreilles sur son embase à
  // tenon de baïonnette, cache-flamme à cinq fentes (remplacé par le dispositif de bouche s'il y en a un)
  cy(g, M.metal, 0, 0.0495, -0.585, 0.0105, 0.086);
  cone(g, M.metal, 0, 0.0495, -0.6345, 0.0045, 0.0105, 0.013);
  cy(g, M.dark, 0, 0.0495, -0.61, 0.0108, 0.003);
  rb(g, M.metal, 0, 0.038, -0.584, 0.016, 0.02, 0.072, 0.003);
  cy(g, M.metal, 0, 0.032, -0.564, 0.0128, 0.04);
  const tip = -0.866;
  cy(g, M.metal, 0, 0.032, -0.4465, 0.009, 0.387);
  cone(g, M.metal, 0, 0.032, (tip - 0.64) / 2, 0.0068, 0.0078, -0.64 - tip);
  const fz = -0.84;
  rb(g, M.dark, 0, 0.032, fz, 0.018, 0.022, 0.018, 0.004);
  rb(g, M.dark, 0, 0.0545, fz, 0.012, 0.026, 0.013, 0.002);
  for (const sx of [-1, 1]) rb(g, M.dark, sx * 0.0058, 0.0705, fz, 0.0024, 0.012, 0.012, 0.0008);
  bx(g, M.dark, 0, 0.0695, fz, 0.002, 0.01, 0.003);
  rb(g, M.dark, 0, 0.0175, fz + 0.004, 0.007, 0.012, 0.024, 0.002);
  if (!c.A.muzzle) {
    cy(g, M.dark, 0, 0.032, tip - 0.035, 0.0085, 0.07);
    cone(g, M.dark, 0, 0.032, tip - 0.075, 0.0062, 0.0085, 0.01);
    for (let i = 0; i < 5; i++) { const a = ((i + 0.5) * TAU) / 5; bx(g, M.rubber, Math.sin(a) * 0.0084, 0.032 + Math.cos(a) * 0.0084, tip - 0.038, 0.0028, 0.0014, 0.046, 0, 0, -a); }
  }
  // lunette PSO-1 : pare-soleil creux et sa lentille, bague, corps et son boîtier à tourelles (dessus et flanc gauche), oculaire renflé
  // à bagues, œilleton creux et lentille au fond ; deux colliers sur un pont relié au rail latéral par la plaque du support et son
  // levier de serrage
  const sy = 0.103;
  cy(g, M.dark, 0, sy, -0.1967, 0.0148, 0.084);
  scopeEnd(g, M, sy, -0.2507, 0.0148, 0.0148, -1, 0.012, M.dark, M.metal);
  cy(g, M.metal, 0, sy, -0.155, 0.0156, 0.006);
  cy(g, M.dark, 0, sy, -0.106, 0.0148, 0.098);
  rb(g, M.dark, 0, sy + 0.004, -0.1, 0.031, 0.034, 0.056, 0.005);
  cy(g, M.metal, 0, 0.1305, -0.099, 0.0095, 0.014, 0);
  cy(g, M.dark, 0, 0.1395, -0.099, 0.0075, 0.006, 0);
  cy(g, M.metal, -0.021, sy + 0.002, -0.118, 0.0085, 0.012, 0, 0, Math.PI / 2);
  cy(g, M.dark, -0.029, sy + 0.002, -0.118, 0.007, 0.005, 0, 0, Math.PI / 2);
  cy(g, M.metal, 0.019, sy + 0.006, -0.085, 0.006, 0.01, 0, 0, Math.PI / 2);
  cy(g, M.dark, 0, sy, -0.04, 0.0148, 0.034);
  cone(g, M.dark, 0, sy, -0.017, 0.0148, 0.0198, 0.012);
  cy(g, M.dark, 0, sy, 0.0095, 0.0198, 0.041);
  for (const z of [0, 0.008, 0.016]) cy(g, M.rubber, 0, sy, z, 0.0201, 0.002);
  cone(g, M.dark, 0, sy, 0.035, 0.0198, 0.016, 0.01);
  scopeEnd(g, M, sy, 0.07, 0.0205, 0.0185, 1, 0.014, M.rubber, M.rubber);
  cone(g, M.rubber, 0, sy, 0.048, 0.016, 0.0185, 0.016);
  for (const z of [-0.142, -0.039]) cy(g, M.metal, 0, sy, z, 0.0168, 0.012);
  rb(g, M.metal, -0.004, 0.0805, -0.09, 0.034, 0.012, 0.124, 0.003);
  rb(g, M.metal, -0.0215, 0.056, -0.09, 0.006, 0.046, 0.1, 0.003);
  cy(g, M.dark, -0.027, 0.046, -0.06, 0.0055, 0.006, 0, 0, Math.PI / 2);
  rb(g, M.dark, -0.0285, 0.052, -0.078, 0.003, 0.006, 0.04, 0.002, 0.35);
  // chargeur droit de dix, plus long derrière, à nervures embouties et plaque de fond inclinée
  info.magHome.set(0, 0.0084, -0.177);
  info.buildMag = (parent, ext) => {
    const yf = -0.093 * ext, yr = -0.11 * ext, zr = 0.0375 + 0.0089 * ext, a = Math.atan2(yf - yr, zr + 0.0378);
    prof(parent, M.metal, [[-0.0378, 0.012, 0.001], [-0.0378, yf, 0.005], [zr, yr, 0.005], [0.0375, 0.012, 0.001]], 0.028, 0, 0.003, 0.003);
    for (const z of [-0.022, -0.009, 0.009, 0.022]) rb(parent, M.metal, 0, -0.045, z, 0.0296, 0.05, 0.0035, 0.0012);
    rb(parent, M.metal, 0, (yf + yr) / 2 + 0.012, (zr - 0.0378) / 2, 0.0296, 0.0035, 0.07, 0.0012, a);
    rb(parent, M.dark, 0, (yf + yr) / 2 - 0.002, (zr - 0.0378) / 2, 0.031, 0.007, 0.088, 0.003, a);
  };
  info.magAxis = new V3(0, -0.993, -0.12); info.magGrip = new V3(0, -0.06, 0);
  info.gripR.set(0, -0.05, 0.062); info.gripL.set(0, 0.035, -0.29);
  info.sightY = sy; info.adsZ = 0.21;
  info.mount.muzzle = { x: 0, y: 0.032, z: tip, r: 0.0068 };
  info.mount.under = { y: 0.014, z: -0.42, len: 0.16 };
  info.muzzle.position.set(0, 0.032, c.A.muzzle ? tip - 0.01 : tip - 0.085); info.eject.position.set(0.021, 0.045, -0.088);
  info.gripDef = {
    R: [{ c: [0, -0.064, 0.058], h: [0.017, 0.047, 0.023], r: 0.01, rx: -0.35 }, { c: [0, 0.028, -0.03], h: [0.019, 0.033, 0.12], r: 0.006 }],
    L: [{ c: [0, 0.035, -0.4], h: [0.022, 0.028, 0.136], r: 0.012 }, { c: [0, 0.0345, -0.259], h: [0.0235, 0.03, 0.006], r: 0.004 }],
  };
  info.trigDef = { at: [0.004, -0.04, -0.046], xTip: -0.004, guard: [{ c: [0, -0.0515, -0.02], h: [0.0045, 0.0025, 0.05], r: 0.002 }, { c: [0, -0.028, -0.0715], h: [0.0045, 0.025, 0.0025], r: 0.002 },
    { c: [0, -0.045, -0.177], h: [0.015, 0.05, 0.042], r: 0.006 }, { c: [0, -0.026, -0.034], h: [0.003, 0.021, 0.003], r: 0.002, rx: 0.18 }] };
});

/* ---------- Barrett M82 : long boîtier supérieur en tôle grise (manchon avant percé de deux rangées de lumières, blocs du dessus,
   hausse rabattable), boîtier inférieur à puits incliné, gros chargeur boîte, pontet, poignée pistolet, cadre de monopode sous
   l'arrière et grosse plaque de couche inclinée, canon cannelé et frein de bouche à deux chambres, lunette tactique à objectif
   évasé (caches relevés, tourelle haute, molette de parallaxe à gauche, colliers sur une embase ajourée, lentilles visibles).
   Cotes relevées sur une vue de profil (0,96 mm par pixel, longueur réelle de 1,448 m) ; poignée et détente aux cotes de la main
   du jeu (relation de l'AK-47), arrière reculé d'autant (3 cm). ---------- */
defineGun('m82', 'sniper', (c) => {
  const { g, M, info } = c, heavy = c.stock === 'heavy';
  // boîtier supérieur, nez arrondi ; lumières du manchon (rangée haute ovale, rangée basse allongée) ; blocs du dessus, hausse,
  // poignée d'armement à droite
  prof(g, M.gray, [[-0.5455, 0.053, 0.008], [0.407, 0.053, 0.003], [0.407, -0.0066, 0.003], [-0.5455, -0.0066, 0.008]], 0.056, 0, 0.004, 0.004);
  const slot = [[-0.0105, 0.0048], [0.0105, 0.0048], [0.0105, -0.0048], [-0.0105, -0.0048]], slotL = [[-0.0115, 0.0045], [0.0115, 0.0045], [0.0115, -0.0045], [-0.0115, -0.0045]];
  for (const z of [-0.5051, -0.4738, -0.445, -0.4137, -0.3849, -0.356, -0.3247, -0.2959]) {
    prof(g, M.rubber, slot, 0.0565, 0, 0, 0.0048).position.set(0, 0.0338, z);
    prof(g, M.rubber, slotL, 0.0565, 0, 0, 0.0045).position.set(0, 0.004, z);
  }
  rb(g, M.dark, 0, 0.056, -0.504, 0.03, 0.008, 0.06, 0.002);
  rb(g, M.dark, 0, 0.057, -0.2475, 0.034, 0.01, 0.053, 0.002);
  rb(g, M.dark, 0, 0.058, 0.108, 0.016, 0.01, 0.02, 0.002);
  rb(g, M.dark, 0, 0.067, 0.104, 0.012, 0.014, 0.004, 0.001, 0.5);
  cy(g, M.metal, 0.034, 0.03, -0.05, 0.006, 0.014, 0, 0, Math.PI / 2);
  part(g, new THREE.SphereGeometry(1, 8, 6), M.dark, 0.044, 0.03, -0.05, 0.009, 0.009, 0.009);
  // boîtier inférieur : avant fuyant, puits de chargeur incliné, logement de détente, arrière sous la poignée
  prof(g, M.dark, [[-0.2069, 0.0, 0.004], [0.152, 0.0, 0.002], [0.15, -0.012, 0.006], [0.14, -0.03, 0.004], [0.083, -0.038, 0.002], [-0.005, -0.038, 0.002],
    [-0.005, -0.0624, 0.003], [-0.0222, -0.0604, 0.003], [-0.1636, -0.0354, 0.004], [-0.2069, 0.005, 0.006]], 0.05, 0, 0.003, 0.003);
  guard(g, M.dark, -0.006, 0.08, -0.036, -0.077, 0.005, 0.004, 0.009);
  rb(g, M.metal, 0, -0.052, 0.024, 0.006, 0.03, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.099, -0.03, 0.139, -0.139, 0.044, 0.032);
  // cadre de monopode sous l'arrière, plaque de couche inclinée (joue sur le boîtier avec la crosse renforcée)
  prof(g, M.dark, [[0.258, -0.004, 0.002], [0.274, -0.004, 0.002], [0.276, -0.048, 0.006], [0.39, -0.06, 0.004], [0.41, -0.06, 0.002], [0.41, -0.079, 0.002],
    [0.276, -0.079, 0.006], [0.262, -0.07, 0.004]], 0.036, 0, 0.003, 0.004);
  prof(g, M.rubber, [[0.405, 0.05, 0.003], [0.4455, 0.05, 0.006], [0.427, -0.079, 0.006], [0.405, -0.079, 0.003]], 0.06, 0, 0.004, 0.004);
  if (heavy) rb(g, M.poly, 0, 0.065, 0.33, 0.04, 0.026, 0.12, 0.008);
  info.butt = [0, -0.015, 0.44];
  // canon cannelé, frein de bouche à deux chambres (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.9284;
  cy(g, M.gray, 0, 0.03, (tip - 0.54) / 2, 0.015, -0.54 - tip);
  for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; bx(g, M.dark, Math.sin(a) * 0.0148, 0.03 + Math.cos(a) * 0.0148, -0.73, 0.004, 0.0012, 0.32, 0, 0, -a); }
  if (!c.A.muzzle) {
    prof(g, M.gray, [[-1.0323, 0.05, 0.012], [-0.9284, 0.055, 0.004], [-0.9284, 0.03, 0], [-0.91, 0.017, 0.004], [-0.93, 0.005, 0.006], [-1.0323, 0.006, 0.012]], 0.054, 0, 0.004, 0.006);
    for (const [z, d] of [[-0.9949, 0.027], [-0.9645, 0.024]]) bx(g, M.rubber, 0, 0.026, z, 0.055, 0.032, d);
    cy(g, M.rubber, 0, 0.03, -1.0325, 0.009, 0.0006);
  }
  // lunette : objectif évasé (cache relevé, lentille), tube, tourelle haute, molette de parallaxe à gauche, oculaire évasé (cache
  // relevé, lentille) ; deux colliers et leurs écrous sur une embase ajourée
  const sy = 0.118;
  prof(g, M.dark, [[-0.13, 0.082, 0.003], [0.017, 0.082, 0.003], [0.017, 0.053, 0.002], [-0.13, 0.053, 0.002]], 0.03, 0, 0.003, 0.003,
    [[[-0.125, 0.0665, 0.0045], [-0.0914, 0.0665, 0.0045], [-0.0914, 0.0575, 0.0045], [-0.125, 0.0575, 0.0045]], [[-0.0789, 0.0665, 0.0045], [-0.0453, 0.0665, 0.0045], [-0.0453, 0.0575, 0.0045], [-0.0789, 0.0575, 0.0045]],
      [[-0.0356, 0.0665, 0.0045], [-0.002, 0.0665, 0.0045], [-0.002, 0.0575, 0.0045], [-0.0356, 0.0575, 0.0045]]]);
  for (const z of [-0.1107, 0.0048]) {
    cy(g, M.dark, 0, sy, z, 0.0185, 0.016);
    rb(g, M.dark, 0, 0.091, z, 0.024, 0.018, 0.016, 0.002);
    cy(g, M.metal, -0.0155, 0.088, z, 0.007, 0.006, 0, 0, Math.PI / 2);
  }
  scopeEnd(g, M, sy, -0.2454, 0.0275, 0.0275, -1, 0.0192, M.dark, M.dark);
  cone(g, M.dark, 0, sy, -0.1733, 0.0272, 0.0168, 0.1050);
  cy(g, M.dark, 0, sy, -0.0457, 0.0168, 0.149);
  cy(g, M.dark, 0, sy + 0.025, -0.051, 0.0145, 0.018, 0);
  cy(g, M.metal, 0, sy + 0.04, -0.051, 0.0155, 0.012, 0);
  cy(g, M.dark, 0, sy + 0.0475, -0.051, 0.012, 0.003, 0);
  cy(g, M.dark, 0.022, sy, -0.051, 0.012, 0.012, 0, 0, Math.PI / 2);
  cy(g, M.dark, -0.024, sy - 0.009, -0.0491, 0.0145, 0.014, 0, 0, Math.PI / 2);
  cy(g, M.metal, -0.0315, sy - 0.009, -0.0491, 0.011, 0.002, 0, 0, Math.PI / 2);
  cone(g, M.dark, 0, sy, 0.0574, 0.0168, 0.0215, 0.0572);
  scopeEnd(g, M, sy, 0.101, 0.0226, 0.0215, 1, 0.0154);
  cy(g, M.dark, 0, 0.1537, -0.268, 0.027, 0.004, 0.347);
  cy(g, M.dark, 0, 0.1488, 0.0784, 0.024, 0.004, 0.347);
  // chargeur boîte de dix, haut incliné comme le puits, nervures, plaque de fond
  info.magHome.set(0, -0.0479, -0.0929);
  info.buildMag = (parent, ext) => {
    const e = (ext - 1) * 0.08, yf = -0.0933 - e, yr = -0.0962 - e;
    prof(parent, M.dark, [[-0.0707, 0.0245, 0.002], [-0.0707, yf, 0.004], [0.0707, yr, 0.004], [0.0707, -0.0005, 0.002]], 0.045, 0, 0.003, 0.003);
    for (const z of [-0.035, 0.035]) rb(parent, M.dark, 0, -0.045 - e / 2, z, 0.047, 0.07 + e, 0.006, 0.002);
    rb(parent, M.metal, 0, (yf + yr) / 2 - 0.002, 0, 0.048, 0.006, 0.146, 0.002, Math.atan2(yf - yr, 0.1414));
  };
  info.magAxis = new V3(0, -1, 0); info.magGrip = new V3(0, -0.05, 0);
  info.gripR.set(0, -0.06, 0.12); info.gripL.set(0, 0.023, -0.28); // main d'appui sous l'arrière du manchon avant
  info.gripLs = new V3(0, 0.0, -0.23); // soldat : sous l'avant du boîtier (son bras n'atteint pas le manchon)
  info.sightY = sy; info.adsZ = 0.19;
  info.mount.muzzle = { x: 0, y: 0.03, z: tip, r: 0.015 };
  info.mount.under = { y: -0.0066, z: -0.42, len: 0.2 };
  info.muzzle.position.set(0, 0.03, c.A.muzzle ? tip - 0.01 : -1.035); info.eject.position.set(0.03, 0.04, -0.06);
  info.gripDef = {
    R: [{ c: [0, -0.085, 0.119], h: [0.016, 0.055, 0.022], r: 0.01, rx: -0.35 }, { c: [0, 0.02, 0.05], h: [0.028, 0.035, 0.2], r: 0.01 }],
    L: [{ c: [0, 0.0232, -0.378], h: [0.028, 0.03, 0.168], r: 0.008 }],
  };
  info.trigDef = { at: [0.004, -0.05, 0.012], xTip: -0.004, guard: [{ c: [0, -0.0745, 0.037], h: [0.0045, 0.0025, 0.044], r: 0.002 }, { c: [0, -0.056, -0.0035], h: [0.0045, 0.02, 0.0025], r: 0.002 },
    { c: [0, -0.052, 0.024], h: [0.003, 0.015, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.09, -0.093], h: [0.023, 0.05, 0.071], r: 0.006 }] };
});
