/* ==========================================================================
   MODÈLES D'ARMES, PISTOLETS : USP .45, Glock 18, Desert Eagle
   Chaque pistolet a son propre modèle, construit d'après une vue de profil de la vraie arme (voir tools/dev/visual/contour.js).
   ========================================================================== */
/* ---------- USP .45 : construite d'un seul tenant d'après une vue de profil, aux vraies proportions. Les cotes sont celles de la
   photo, en pixels (P : 0,129 mm par pixel, longueur réelle 200 mm), placées de sorte que la poignée tombe sur celle des autres
   pistolets (centre de la prise en (z 0,012, y -0,05)) : la main droite est à la même place, l'index se replie sur la détente (plus
   proche que celle de l'ancien modèle, comme sur la vraie arme).
   - Glissière : pans coupés sur le dessus (section en trapèze), méplat avant à la base biseautée, fenêtre d'éjection sur le dessus à
     droite (canon visible), huit cannelures arrière inclinées, arrière fuyant, hausse à cran et guidon à trois points.
   - Carcasse polymère d'un seul tenant (cache-poussière à deux rainures, queue de castor, poignée inclinée à dos et devant crantés),
     pontet carré mince à devant strié, détente incurvée, palette de déverrouillage du chargeur ; à gauche, long arrêtoir de
     glissière sur son axe et grand levier de sûreté-désarmeur (repère rouge) ; chien à ergot.
   - Poignée : plaquette grenue (grain fin) sur chaque flanc, cartouche lisse « HK USP », trou de dragonne ; chargeur à talon.
   Contrôle : node tools/dev/visual/contour.js --arme usp --photo <profil gauche, 1920 x 1280> --mmpx 0.129 --ancre 1406,560,0.012,-0.008
   (recouvrement 96 %). ---------- */
defineGun('usp', 'pistol', (c) => {
  const { g, M, info } = c, B = M.blued, F = M.polyM, K = M.rubber, sx2 = [-1, 1], dotG = new THREE.SphereGeometry(1, 6, 4);
  const S = 0.000129, P = (x, y, r) => { const q = [0.012 + (x - 1406) * S, -0.008 - (y - 560) * S]; if (r !== undefined) q.push(r); return q; };
  const Pz = (x) => P(x, 0)[0], Py = (y) => P(0, y)[1];
  // grain fin (carcasse, plaquettes) : coordonnées de texture resserrées (la géométrie, partagée, est copiée)
  const fine = (m, k) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };
  const by = Py(232), yT = Py(147), yB = Py(335), yS = Py(200), w = 0.031;

  // ----- glissière (recule au tir) -----
  const sl = new THREE.Group(); g.add(sl); info.slide = sl; info.slideTravel = 0.034;
  // flancs (de la base des pans coupés au bas), nez biseauté en bas, arrière fuyant ; méplat avant plus étroit en bas
  prof(sl, B, [P(188, 200, 0.001), P(1588, 200, 0.001), P(1615, 335, 0.0015), P(985, 335, 0.001), P(985, 300, 0.001), P(203, 300, 0.002), P(188, 285, 0.001)], w, 0, 0.0012, 0.001);
  prof(sl, B, [P(203, 300, 0.001), P(985, 300, 0.001), P(985, 335, 0.001), P(212, 335, 0.002), P(203, 326, 0.001)], w - 0.003, 0, 0.001, 0.001);
  prof(sl, B, [P(975, 205, 0.001), P(985, 225, 0.001), P(985, 278, 0.001), P(975, 296, 0.001)], w + 0.0004, 0, 0.0003, 0.001); // bout biseauté du méplat
  // dessus à pans coupés (section en trapèze), de l'avant à l'arrière
  zSection(sl, B, [[-w / 2, yS], [w / 2, yS], [w / 2 - 0.0068, yT], [-w / 2 + 0.0068, yT]], Pz(196), Pz(1578), 0.0008);
  // fenêtre d'éjection sur le dessus, à droite : creux sombre et canon (son dessus) dans l'ouverture
  bx(sl, K, 0.0045, yT - 0.0021, Pz(868), 0.015, 0.0045, Pz(965) - Pz(770));
  cz(sl, M.metal, 0, by, Pz(868), 0.0102, Pz(960) - Pz(776));
  // cannelures arrière inclinées (le haut vers l'avant), sur les deux flancs
  for (let k = 0; k < 8; k++) { const q = P(1290 + k * 40, 272); for (const sx of sx2) bx(sl, K, sx * (w / 2 + 0.0002), q[1], q[0], 0.0012, 0.0158, 0.0018, -0.38); }
  // hausse à cran (deux points blancs) et guidon (point blanc), rien si une optique les remplace
  if (!c.optic) {
    prof(sl, B, [P(1424, 149), P(1434, 120, 0.0008), P(1478, 120, 0.0008), P(1500, 149)], 0.02, 0, 0.0006, 0.001);
    bx(sl, K, 0, Py(127), Pz(1456), 0.0032, 0.0034, 0.0062); // cran
    for (const sx of sx2) part(sl, dotG, M.dotW, sx * 0.0058, Py(130), Pz(1478) + 0.0001, 0.0011, 0.0011, 0.0004);
    prof(sl, B, [P(262, 149), P(266, 118, 0.0008), P(299, 118, 0.0008), P(320, 149)], 0.0036, 0, 0.0005, 0.001);
    part(sl, dotG, M.dotW, 0, Py(126), Pz(299) + 0.0001, 0.0011, 0.0011, 0.0004);
  }

  // ----- canon fixe : couronne et âme au ras du nez -----
  cz(g, M.metal, 0, by, Pz(188) + 0.006, 0.0068, 0.012);
  cz(g, K, 0, by, Pz(188) - 0.0001, 0.0046, 0.0006);

  // ----- carcasse polymère -----
  // cache-poussière, corps, queue de castor, poignée inclinée (dos et devant), bas de la poignée ; le haut du pontet est un creux
  fine(prof(g, F, [P(205, 336, 0.002), P(1612, 345, 0.001), P(1645, 372, 0.004), P(1658, 430, 0.006), P(1652, 478, 0.004), P(1600, 500, 0.006), P(1530, 535, 0.008), P(1512, 585, 0.008),
    P(1532, 660, 0.006), P(1573, 750, 0.01), P(1617, 870, 0.01), P(1650, 990, 0.008), P(1666, 1100, 0.004), P(1662, 1146, 0.002), P(1595, 1150, 0.002), P(1590, 1102, 0.001),
    P(1242, 1102, 0.002), P(1219, 990, 0.006), P(1188, 870, 0.008), P(1153, 750, 0.008), P(1130, 690, 0.006), P(1100, 676, 0.004), P(1060, 667, 0.004), P(1000, 660, 0.002),
    P(1023, 650, 0.004), P(1046, 635, 0.006), P(1061, 620, 0.006), P(1070, 605, 0.006), P(1076, 580, 0.008), P(1076, 545, 0.008), P(1069, 515, 0.006), P(1057, 485, 0.006), P(1038, 470, 0.004),
    P(1018, 462, 0.002), P(702, 462, 0.002), P(600, 442, 0.002), P(212, 441, 0.004), P(204, 428, 0.002)], 0.03, 0, 0.0025, 0.002), 2.5);
  // rainures d'accessoires du cache-poussière, sur les deux flancs
  for (const sx of sx2) {
    bx(g, K, sx * 0.0151, Py(374), (Pz(250) + Pz(700)) / 2, 0.0012, 0.0006, Pz(700) - Pz(250));
    rb(g, K, sx * 0.0151, Py(394), (Pz(256) + Pz(700)) / 2, 0.0012, 0.0024, Pz(700) - Pz(256), 0.0005);
  }
  // pontet mince : devant incliné (strié), dessous, rejoint la carcasse derrière
  fine(prof(g, F, [P(598, 441, 0.001), P(611, 470, 0.003), P(631, 530, 0.004), P(642, 590, 0.004), P(662, 650, 0.006), P(676, 674, 0.006), P(705, 688, 0.004), P(840, 691, 0.004),
    P(980, 685, 0.004), P(1040, 676, 0.002), P(1040, 662, 0.001), P(980, 660, 0.003), P(732, 659, 0.004), P(714, 647, 0.004), P(698, 605, 0.004), P(684, 560, 0.004), P(674, 505, 0.004),
    P(682, 480, 0.004), P(702, 462, 0.002), P(705, 441, 0.001)], 0.0095, 0, 0.0018, 0.002), 2.5);
  for (let k = 0; k < 8; k++) { const q = P(634 + k * 2.2, 552 + k * 12.5); bx(g, K, 0, q[1], q[0] - 0.0004, 0.009, 0.0007, 0.0012, -0.2); }
  // détente incurvée, palette de déverrouillage du chargeur derrière le pontet
  prof(g, B, [P(916, 456), P(918, 470, 0.002), P(944, 500, 0.006), P(967, 530, 0.006), P(977, 560, 0.006), P(977, 590, 0.006), P(966, 620, 0.006), P(944, 650, 0.004), P(938, 659, 0.001),
    P(952, 659, 0.002), P(971, 650, 0.004), P(1000, 620, 0.006), P(1013, 590, 0.006), P(1016, 560, 0.006), P(1009, 530, 0.006), P(993, 500, 0.006), P(978, 470, 0.002), P(977, 456)], 0.0062, 0, 0.0012, 0.0015);
  prof(g, F, [P(1040, 640, 0.002), P(1088, 646, 0.003), P(1094, 676, 0.003), P(1046, 678, 0.002)], 0.016, 0, 0.002, 0.002);
  // arrêtoir de glissière (gauche) : axe et long levier jusqu'à sa palette
  prof(g, B, [P(822, 372, 0.008), P(860, 356, 0.006), P(985, 362, 0.004), P(1000, 356, 0.003), P(1090, 352, 0.006), P(1146, 362, 0.008), P(1150, 405, 0.008), P(1100, 418, 0.006),
    P(1000, 410, 0.004), P(880, 412, 0.006), P(828, 402, 0.008)], 0.0024, -0.0161, 0.0007, 0.002);
  cy(g, M.metal, -0.0175, Py(385), Pz(850), 0.0027, 0.0012, 0, 0, Math.PI / 2);
  // levier de sûreté-désarmeur (gauche), repère rouge derrière
  prof(g, B, [P(1300, 368, 0.008), P(1380, 357, 0.008), P(1462, 362, 0.006), P(1504, 374, 0.004), P(1508, 390, 0.004), P(1490, 404, 0.006), P(1420, 416, 0.008), P(1330, 424, 0.008), P(1302, 410, 0.008)],
    0.0034, -0.0167, 0.0012, 0.003);
  { const q = P(1497, 405); part(g, dotG, M.dot, -0.0152, q[1], q[0], 0.0003, 0.0011, 0.0011); }
  // chien à ergot, derrière la glissière
  prof(g, B, [P(1614, 346), P(1622, 328, 0.002), P(1640, 300, 0.004), P(1664, 290, 0.004), P(1692, 296, 0.004), P(1726, 318, 0.003), P(1746, 340, 0.002), P(1748, 352, 0.001),
    P(1734, 356, 0.002), P(1700, 346, 0.004), P(1664, 360, 0.004), P(1642, 378, 0.002), P(1618, 372)], 0.0085, 0, 0.0012, 0.002);
  // poignée : plaquette grenue sur chaque flanc (grain fin), cartouche lisse, crans du devant et du dos, trou de dragonne
  fine(prof(g, M.grip, [P(1138, 520, 0.006), P(1162, 492, 0.006), P(1390, 494, 0.008), P(1446, 522, 0.008), P(1498, 700, 0.01), P(1542, 900, 0.01), P(1575, 1030, 0.006),
    P(1540, 1052, 0.006), P(1300, 1046, 0.01), P(1256, 1012, 0.006), P(1238, 900, 0.008), P(1190, 700, 0.008)], 0.0316, 0, 0.0012, 0.003), 3);
  fine(prof(g, F, [P(1290, 905, 0.005), P(1520, 905, 0.005), P(1522, 990, 0.005), P(1292, 990, 0.005)], 0.0322, 0, 0.0008, 0.005), 2.5);
  for (let k = 0; k < 22; k++) {
    const t = k / 21, yf = 722 + t * 288, xf = 1142 + (yf - 720) * 0.27, q = P(xf - 2, yf);
    bx(g, K, 0, q[1], q[0], 0.0262, 0.0018, 0.0018, -0.3 + Math.PI / 4);
  }
  for (let k = 0; k < 26; k++) {
    const t = k / 25, yb = 688 + t * 362, xb = 1546 + (yb - 690) * 0.322, q = P(xb + 2, yb);
    bx(g, K, 0, q[1], q[0], 0.0262, 0.0018, 0.0018, -0.3 + Math.PI / 4);
  }
  { const q = P(1601, 1076); cy(g, K, 0, q[1], q[0], 0.0022, 0.0305, 0, 0, Math.PI / 2); }

  // ----- chargeur : corps dans la poignée (incliné comme elle), talon plat à lèvre avant ; étendu : plus long -----
  const ma = 0.291, mc = P(1392, 800);
  info.magHome.set(0, 0, 0);
  info.buildMag = (parent, ext) => {
    const ex = (ext - 1) * 0.1, t = new THREE.Group(); t.position.set(0, mc[1], mc[0]); t.rotation.x = -ma; parent.add(t);
    rb(t, M.metal, 0, -ex / 2, 0, 0.0245, 0.08 + ex, 0.039, 0.003);
    for (let k = 0; k < 4; k++) part(t, dotG, M.dotW, 0, -0.006 - k * 0.011 - ex / 2, 0.0198, 0.0012, 0.0012, 0.0004);
    const b = P(1407, 1126), lp = P(1232, 1112);
    rb(parent, F, 0, b[1] - ex * Math.cos(ma), b[0] + ex * Math.sin(ma), 0.0292, 0.0062, Pz(1590) - Pz(1226), 0.002);
    rb(parent, F, 0, lp[1] - ex * Math.cos(ma), lp[0] + ex * Math.sin(ma), 0.027, 0.004, 0.0035, 0.0012);
  };
  info.magAxis = new V3(0, -Math.cos(ma), Math.sin(ma)); info.magGrip = new V3(0, Py(1126), Pz(1407));
  info.gripR.set(0, -0.05, 0.015); info.gripL.set(-0.02, -0.06, 0.005);

  // ----- visée, montages, bouche, éjection -----
  info.sightY = Py(120); info.adsZ = 0.41 + Pz(1478); // ligne de mire au sommet du guidon et des oreilles de la hausse, l'œil à 41 cm d'elle
  info.mount.optic = { y: yT, z: Pz(1250), len: 0.07, D: 0.4, slide: sl }; // sur le dessus, derrière la fenêtre d'éjection
  info.mount.muzzle = { x: 0, y: by, z: Pz(188), r: 0.0068 };
  info.mount.side = { x: 0, y: Py(441) + 0.0018, z: Pz(460), under: true }; // pointeur laser sous le cache-poussière (son dessus 2 mm sous y)
  info.muzzle.position.set(0, by, Pz(188) - 0.001); info.eject.position.set(0.012, yT, Pz(868));
  // formes de prise des mains : poignée (son angle), carcasse, glissière, pontet ; détente pour l'index (replié, comme sur la vraie arme)
  const gc = P(1406, 900);
  info.gripDef = {
    R: [{ c: [0, gc[1], gc[0]], h: [0.0158, 0.052, 0.0265], r: 0.008, rx: -ma }, { c: [0, Py(400), (Pz(205) + Pz(600)) / 2], h: [0.015, 0.0055, (Pz(600) - Pz(205)) / 2], r: 0.003 },
      { c: [0, Py(400), Pz(1300)], h: [0.015, 0.0075, 0.03], r: 0.004 }, { c: [0, (yT + yB) / 2, (Pz(188) + Pz(1615)) / 2], h: [w / 2, (yT - yB) / 2, (Pz(1615) - Pz(188)) / 2], r: 0.003 },
      { c: [0, Py(686), Pz(850)], h: [0.0048, 0.0028, 0.017], r: 0.002 }, { c: [0, Py(560), Pz(650)], h: [0.0048, 0.0125, 0.0025], r: 0.002, rx: -0.24 }],
  };
  info.gripDef.L = info.gripDef.R;
  // face avant de la détente à x 977 : l'axe du doigt (rayon du gant 8 mm) juste devant. La lame elle-même n'est pas une forme de
  // prise : la phalange du milieu, qui la contourne par le flanc, s'y heurtait et le doigt restait 4 mm devant
  info.trigDef = { at: [0.004, -0.008, Pz(977) - 0.0085], xTip: -0.003, guard: [] };
});

/* ---------- Glock 18C : construit d'un seul tenant d'après une vue de profil, aux vraies proportions, comme l'USP. Cotes en pixels de
   la photo (P : 0,196 mm par pixel, longueur réelle 186 mm), placées de sorte que la poignée tombe sur celle des autres pistolets ; la
   poignée garde sa forte inclinaison (22°), le chargeur la suit.
   - Glissière noire : bloc aux arêtes adoucies, lumières de compensateur sur le dessus (le canon s'y voit), cannelures arrière,
     sélecteur de tir à gauche (disque et levier), hausse et guidon à trois points ; canon au nez.
   - Carcasse polymère sable d'un seul tenant : cache-poussière à rail (rainure), queue de castor, poignée à gorges de doigts, dos et
     flancs à grain fin ; pontet carré, détente et sa sûreté, levier de démontage, arrêtoir de glissière, goupilles, bouton de
     chargeur strié ; chargeur noir à talon.
   Contrôle : node tools/dev/visual/contour.js --arme glock18 --photo <profil gauche, 1100 x 1100> --mmpx 0.196 --ancre 869,470,0.012,-0.008
   (recouvrement 98 %). ---------- */
defineGun('glock18', 'pistol', (c) => {
  const { g, M, info } = c, B = M.dark, N = M.poly, F = M.tan, K = M.rubber, sx2 = [-1, 1], dotG = new THREE.SphereGeometry(1, 6, 4);
  const S = 0.000196, P = (x, y, r) => { const q = [0.012 + (x - 869) * S, -0.008 - (y - 470) * S]; if (r !== undefined) q.push(r); return q; };
  const Pz = (x) => P(x, 0)[0], Py = (y) => P(0, y)[1];
  const fine = (m, k) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };
  const by = Py(267), yT = Py(205), yB = Py(313), w = 0.0255;

  // ----- glissière (recule au tir) -----
  const sl = new THREE.Group(); g.add(sl); info.slide = sl; info.slideTravel = 0.034;
  fine(prof(sl, B, [P(45, 222, 0.003), P(60, 205, 0.004), P(966, 205, 0.004), P(974, 214, 0.003), P(975, 300, 0.003), P(966, 313, 0.002), P(52, 313, 0.003), P(45, 300, 0.003)], w, 0, 0.0028, 0.002), 3);
  // lumières de compensateur sur le dessus (le canon et ses évents dessous), fenêtre d'éjection à droite
  bx(sl, K, 0, yT - 0.0018, Pz(150), 0.0085, 0.004, Pz(205) - Pz(95));
  for (const x of [120, 150, 180]) bx(sl, M.metal, 0, yT - 0.0035, Pz(x), 0.007, 0.001, 0.0035);
  rb(sl, K, w / 2 - 0.0035, yT - 0.0012, Pz(650), 0.0078, 0.003, Pz(740) - Pz(560), 0.001);
  bx(sl, M.metal, w / 2 - 0.004, yT - 0.0022, Pz(650), 0.0062, 0.002, Pz(735) - Pz(565));
  // cannelures arrière, sur les deux flancs
  for (let k = 0; k < 7; k++) for (const sx of sx2) bx(sl, K, sx * (w / 2 + 0.0002), Py(262), Pz(764 + k * 11), 0.0012, Py(222) - Py(302), 0.0011);
  // sélecteur de tir (flanc gauche, à l'arrière) : disque et levier
  cy(sl, K, -(w / 2 + 0.0008), Py(262), Pz(884), 0.0042, 0.0016, 0, 0, Math.PI / 2);
  { const a = P(856, 222), b = P(894, 280); rb(sl, B, -(w / 2 + 0.0016), (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, 0.0014, hyp(a[0] - b[0], a[1] - b[1]) + 0.004, 0.0034, 0.0012, -Math.atan2(b[0] - a[0], a[1] - b[1])); }
  // hausse (deux points blancs) et guidon (point blanc) ; rien si une optique les remplace
  if (!c.optic) {
    prof(sl, B, [P(889, 205), P(893, 185, 0.0008), P(921, 185, 0.0008), P(925, 205)], 0.0185, 0, 0.0006, 0.001);
    bx(sl, K, 0, Py(190), Pz(907), 0.0032, 0.0022, 0.0072);
    for (const sx of sx2) part(sl, dotG, M.dotW, sx * 0.0058, Py(191), Pz(925) + 0.0001, 0.0011, 0.0011, 0.0004);
    prof(sl, B, [P(74, 205), P(80, 195, 0.0006), P(95, 195, 0.0006), P(99, 205)], 0.0032, 0, 0.0005, 0.0008);
    part(sl, dotG, M.dotW, 0, Py(198), Pz(97) + 0.0001, 0.001, 0.001, 0.0004);
  }

  // ----- canon fixe : il dépasse du nez -----
  cz(g, M.metal, 0, by, Pz(46), 0.0072, Pz(56) - Pz(34));
  cz(g, K, 0, by, Pz(34) - 0.0001, 0.0047, 0.0006);

  // ----- carcasse polymère sable -----
  // cache-poussière, corps, queue de castor, poignée inclinée à gorges de doigts, bas de la poignée ; le haut du pontet est un creux
  fine(prof(g, F, [P(41, 314, 0.003), P(974, 313, 0.001), P(981, 320, 0.003), P(984, 334, 0.003), P(980, 350, 0.004), P(950, 364, 0.006), P(921, 380, 0.006), P(908, 404, 0.004),
    P(906, 440, 0.004), P(922, 500, 0.006), P(942, 548, 0.006), P(963, 596, 0.008), P(985, 632, 0.008), P(1009, 668, 0.008), P(1031, 704, 0.008), P(1052, 752, 0.008), P(1062, 788, 0.008),
    P(1066, 812, 0.006), P(1046, 836, 0.006), P(1032, 850, 0.003), P(780, 850, 0.003), P(767, 836, 0.004), P(766, 806, 0.006), P(752, 764, 0.006), P(744, 740, 0.004), P(729, 728, 0.004),
    P(721, 716, 0.006), P(725, 700, 0.006), P(718, 680, 0.006), P(707, 656, 0.004), P(694, 644, 0.004), P(685, 632, 0.006), P(690, 614, 0.006), P(685, 596, 0.006), P(675, 572, 0.006),
    P(661, 548, 0.006), P(640, 538, 0.004), P(612, 528, 0.003), P(590, 521, 0.002), P(608, 512, 0.003), P(617, 495, 0.003), P(617, 458, 0.003), P(600, 424, 0.003), P(445, 422, 0.003),
    P(375, 414, 0.003), P(300, 409, 0.002), P(171, 406, 0.003), P(60, 400, 0.004), P(46, 380, 0.004)], 0.03, 0, 0.0025, 0.002), 2.5);
  // rainure du rail du cache-poussière, encoche sous le rail, sur les deux flancs
  for (const sx of sx2) rb(g, K, sx * 0.0151, Py(357), Pz(175), 0.0012, Py(352) - Py(362), Pz(300) - Pz(50), 0.0005);
  bx(g, K, 0, Py(404), Pz(160), 0.024, 0.0018, Pz(171) - Pz(150));
  // pontet carré : devant droit, dessous ; la carcasse le ferme derrière
  fine(prof(g, F, [P(372, 412, 0.001), P(392, 430, 0.004), P(392, 500, 0.004), P(381, 530, 0.004), P(394, 550, 0.004), P(590, 554, 0.004), P(640, 540, 0.003), P(640, 528, 0.001),
    P(590, 521, 0.002), P(442, 520, 0.004), P(429, 500, 0.003), P(422, 470, 0.003), P(422, 452, 0.003), P(432, 424, 0.003), P(445, 422, 0.001)], 0.0082, 0, 0.0016, 0.002), 2.5);
  // détente en polymère noir et sa sûreté (lame au milieu)
  prof(g, N, [P(565, 424), P(575, 440, 0.003), P(570, 464, 0.004), P(563, 488, 0.004), P(557, 512, 0.003), P(560, 520, 0.001), P(578, 520, 0.002), P(594, 500, 0.004), P(606, 476, 0.004),
    P(610, 452, 0.004), P(600, 424)], 0.0065, 0, 0.0012, 0.0015);
  prof(g, K, [P(576, 452), P(582, 452, 0.001), P(574, 500, 0.001), P(568, 500)], 0.0068, 0, 0.0003, 0.0005);
  // levier de démontage, arrêtoir de glissière, goupilles, bouton de chargeur strié (incliné comme la poignée)
  for (const sx of sx2) { const a = P(452, 334), b = P(463, 368); rb(g, K, sx * 0.0153, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, 0.0012, Py(334) - Py(368), 0.0028, 0.0006, -0.3); }
  rb(g, B, -0.0157, Py(330), Pz(680), 0.0028, Py(313) - Py(348), Pz(715) - Pz(645), 0.0025);
  for (const [x, y] of [[555, 365], [875, 455], [500, 345]]) cy(g, B, 0, Py(y), Pz(x), 0.002, 0.0306, 0, 0, Math.PI / 2);
  { const q = P(705, 492); rb(g, F, -0.0155, q[1], q[0], 0.003, 0.0048, 0.0135, 0.0014, -0.39); for (let k = 0; k < 6; k++) { const t = (k - 2.5) * 0.002; bx(g, K, -0.0171, q[1] - t * 0.383, q[0] + t * 0.924, 0.0006, 0.0042, 0.0007, -0.39); } }
  // flancs de la poignée à grain plus marqué (pastilles du Gen4), en relief léger
  fine(prof(g, F, [P(728, 500, 0.008), P(925, 500, 0.008), P(1020, 760, 0.01), P(980, 800, 0.008), P(830, 800, 0.008), P(760, 600, 0.008)], 0.0306, 0, 0.0008, 0.004), 1.2);

  // ----- chargeur en polymère noir : corps dans la poignée (incliné comme elle), talon dessous ; étendu : plus long -----
  const ma = 0.394, mc = P(885, 690);
  info.magHome.set(0, 0, 0);
  info.buildMag = (parent, ext) => {
    const ex = (ext - 1) * 0.1, t = new THREE.Group(); t.position.set(0, mc[1], mc[0]); t.rotation.x = -ma; parent.add(t);
    rb(t, N, 0, -ex / 2, 0, 0.0225, 0.07 + ex, 0.037, 0.003);
    for (let k = 0; k < 4; k++) part(t, dotG, M.dotW, 0, -0.004 - k * 0.011 - ex / 2, 0.0187, 0.0011, 0.0011, 0.0004);
    const f = P(788, 856), r = P(1010, 856), dy = -ex * Math.cos(ma), dz = ex * Math.sin(ma);
    prof(parent, N, [[f[0] + dz, f[1] + dy], [r[0] + dz, r[1] + dy], [Pz(1012) + dz, Py(888) + dy], [Pz(801) + dz, Py(888) + dy]], 0.0275, 0, 0.002, 0.002);
  };
  info.magAxis = new V3(0, -Math.cos(ma), Math.sin(ma)); info.magGrip = new V3(0, Py(872), Pz(900));
  info.gripR.set(0, -0.05, 0.015); info.gripL.set(-0.02, -0.06, 0.005);

  // ----- visée, montages, bouche, éjection -----
  info.sightY = Py(195); info.adsZ = 0.41 + Pz(925); // ligne de mire au sommet du guidon et au fond du cran, l'œil à 41 cm de la hausse
  info.mount.optic = { y: yT, z: Pz(760), len: 0.07, D: 0.4, slide: sl }; // sur le dessus, derrière la fenêtre d'éjection
  info.mount.muzzle = { x: 0, y: by, z: Pz(34), r: 0.0072 };
  info.mount.side = { x: 0, y: Py(404) + 0.0018, z: Pz(175), under: true }; // pointeur laser sous le rail (son dessus 2 mm sous y)
  info.muzzle.position.set(0, by, Pz(34) - 0.001); info.eject.position.set(0.01, yT, Pz(650));
  // formes de prise des mains : poignée (son angle), carcasse, glissière, pontet ; index replié sur la détente
  const gc = P(877, 700);
  info.gripDef = {
    R: [{ c: [0, gc[1], gc[0]], h: [0.0153, 0.05, 0.0275], r: 0.008, rx: -ma }, { c: [0, Py(370), (Pz(45) + Pz(372)) / 2], h: [0.014, 0.0055, (Pz(372) - Pz(45)) / 2], r: 0.003 },
      { c: [0, Py(370), Pz(780)], h: [0.015, 0.0065, 0.025], r: 0.004 }, { c: [0, (yT + yB) / 2, (Pz(45) + Pz(975)) / 2], h: [w / 2, (yT - yB) / 2, (Pz(975) - Pz(45)) / 2], r: 0.003 },
      { c: [0, Py(552), Pz(495)], h: [0.004, 0.0022, 0.019], r: 0.002 }, { c: [0, Py(485), Pz(387)], h: [0.004, 0.0068, 0.002], r: 0.002 }],
  };
  info.gripDef.L = info.gripDef.R;
  info.trigDef = { at: [0.004, -0.008, Pz(568) - 0.0085], xTip: -0.003, guard: [] };
});

/* ---------- Desert Eagle Mark XIX .50 AE, inox (d'après la photo du modèle à frein de bouche) ----------
   Un canon fixe et massif devant une glissière courte : seule la glissière recule au tir.
   - Canon : bloc de bouche percé de quatre fentes (frein de bouche) et guidon ; dessus en biseau sous un rail à dents ; flancs droits
     soulignés d'un trait ; rail d'accessoires sombre dessous ; le tube rond paraît entre le biseau et la glissière.
   - Glissière : cannelures obliques, sûreté ambidextre à point rouge, hausse à cran, fenêtre d'éjection sur le dessus à droite.
   - Carcasse : chien à ergot, queue de castor, pontet carré, détente et arrêtoir sombres, goupilles ; poignée enveloppée de caoutchouc
     noir (M.grip), dos inox. La poignée garde la place et l'angle de celle des autres pistolets (mains, chargeur, rechargement).
   Finition inox (M.steel), que le camouflage recouvre. Coordonnées relevées sur la photo (0,382 mm par pixel, 27 cm de long). */
defineGun('deagle', 'pistol', (c) => {
  const { g, M, info } = c, S = M.steel, D = M.dark, K = M.rubber, by = 0.0418, zM = -0.2213, sx2 = [-1, 1]; // K : noir mat des creux et des commandes
  const dotG = new THREE.SphereGeometry(1, 6, 4);
  // repère de la poignée (le même que celui des autres pistolets) : b vers l'arrière, d vers le bas, depuis son centre
  const G = (b, d, r) => { const q = [0.012 + b * 0.976 + d * 0.218, -0.05 + b * 0.218 - d * 0.976]; if (r !== undefined) q.push(r); return q; };

  // ----- canon fixe -----
  // corps bas à flancs droits, de la bouche à la glissière (coin avant arrondi), posé sur la carcasse derrière le rail
  prof(g, S, [[zM, 0.0089, 0.005], [zM, 0.0358, 0.002], [-0.0628, 0.0358, 0], [-0.0628, 0.0139, 0], [-0.0945, 0.0139, 0], [-0.0945, 0.0089, 0]], 0.029, 0, 0.0016, 0.0015);
  // dessus en biseau : section en trapèze, plus étroit en haut sous le rail
  zSection(g, S, [[-0.0145, 0.0345], [0.0145, 0.0345], [0.0085, 0.0516], [-0.0085, 0.0516]], -0.1975, -0.0945);
  for (const sx of sx2) bx(g, K, sx * 0.0149, 0.0359, -0.146, 0.0012, 0.0013, 0.1); // trait le long du flanc, à la jonction du biseau
  // bloc de bouche et frein : quatre fentes sur chaque flanc, âme de 12,7 mm
  rb(g, S, 0, 0.0452, -0.2094, 0.029, 0.0196, 0.0238, 0.0022);
  for (let k = 0; k < 4; k++) for (const sx of sx2) bx(g, K, sx * 0.0149, 0.0468, -0.2185 + k * 0.0056, 0.0012, 0.0128, 0.0033);
  cz(g, K, 0, by, zM - 0.0002, 0.0064, 0.0012);
  // rail à dents sur le canon (les optiques s'y posent) ; petites pièces en boîtes simples (une boîte arrondie compte 900 sommets)
  bx(g, S, 0, 0.0523, -0.147, 0.0132, 0.0022, 0.1);
  for (let k = 0; k < 9; k++) bx(g, S, 0, 0.0536, -0.1925 + k * 0.0108, 0.0146, 0.0032, 0.0074);
  // tube du canon, visible devant la glissière (il continue dessous : la glissière le découvre en reculant)
  cz(g, S, 0, by, -0.058, 0.0077, 0.076);
  // rail d'accessoires sous le canon
  rb(g, K, 0, 0.0074, -0.1506, 0.019, 0.0034, 0.103, 0.0008);
  for (let k = 0; k < 9; k++) bx(g, K, 0, 0.0047, -0.1975 + k * 0.0115, 0.021, 0.0028, 0.0074);
  // guidon sur le bloc de bouche (point blanc côté tireur) ; rien si une optique remplace les organes de visée
  if (!c.optic) {
    prof(g, K, [[-0.2170, 0.0546, 0], [-0.2132, 0.0612, 0.001], [-0.2068, 0.0612, 0.0005], [-0.2068, 0.0546, 0]], 0.0034, 0, 0.0005, 0.0008);
    part(g, dotG, M.dotW, 0, 0.0598, -0.2067, 0.0011, 0.0011, 0.0005);
  }

  // ----- glissière (recule au tir) -----
  const sl = new THREE.Group(); g.add(sl); info.slide = sl; info.slideTravel = 0.034;
  prof(sl, S, [[-0.0628, 0.0131, 0.001], [-0.0628, 0.0505, 0.002], [-0.0582, 0.0551, 0.002], [0.0222, 0.0551, 0.004], [0.0272, 0.0228, 0.003], [0.0266, 0.0131, 0.001]], 0.029, 0, 0.0042, 0.002);
  // cannelures obliques (le bas plus en arrière), plus courtes sous la sûreté. Les creux sont des pièces noires qui dépassent d'environ 1 mm :
  // plus près de la surface, elles disparaissent sous un camouflage (précision de la profondeur)
  for (let k = 0; k < 13; k++) {
    const zt = -0.0568 + k * 0.0059, yt = zt > -0.024 ? 0.031 : 0.0414, yb = 0.0152, yc = (yt + yb) / 2, zc = zt + (yt - yc) * 0.276, len = (yt - yb) / 0.964;
    for (const sx of sx2) bx(sl, K, sx * 0.0149, yc, zc, 0.0012, len, 0.0024, -0.27);
  }
  // sûreté ambidextre : levier, axe, point rouge (arme prête à tirer)
  for (const sx of sx2) {
    prof(sl, K, [[-0.0200, 0.0458, 0.002], [0.0040, 0.0463, 0.004], [0.0103, 0.0412, 0.004], [0.0093, 0.0342, 0.004], [0.0036, 0.0318, 0.004], [-0.0030, 0.0346, 0.003], [-0.0190, 0.0420, 0.002]], 0.0022, sx * 0.0156, 0.0007, 0.003);
    cy(sl, K, sx * 0.0168, 0.0387, 0.0029, 0.0047, 0.0016, 0, 0, Math.PI / 2);
    part(sl, dotG, M.dot, sx * 0.0146, 0.0305, -0.0098, 0.0003, 0.0009, 0.0009);
  }
  bx(sl, K, 0.0072, 0.0555, -0.031, 0.009, 0.0012, 0.026); // fenêtre d'éjection, sur le dessus à droite
  // hausse à cran (deux points blancs) ; rien sous une optique
  if (!c.optic) {
    prof(sl, K, [[-0.0095, 0.0549, 0], [-0.0052, 0.0575, 0.001], [0.0046, 0.0575, 0.0005], [0.0046, 0.0549, 0]], 0.021, 0, 0.0008, 0.001);
    for (const sx of sx2) {
      prof(sl, K, [[-0.0040, 0.0572, 0], [-0.0006, 0.0612, 0.0006], [0.0046, 0.0612, 0.0005], [0.0046, 0.0572, 0]], 0.0078, sx * 0.0064, 0.0005, 0.0006);
      part(sl, dotG, M.dotW, sx * 0.0064, 0.0598, 0.0047, 0.001, 0.001, 0.0004);
    }
  }

  // ----- carcasse -----
  // dessous de la glissière, queue de castor et départ du dos de la poignée
  prof(g, S, [[-0.0945, 0.0139, 0.001], [0.0266, 0.0139, 0], [0.0302, 0.0160, 0.003], [0.0526, 0.0124, 0.002], [0.0448, 0.0068, 0.004], [0.0342, 0.0010, 0.004], [0.0297, -0.0050, 0], [-0.0330, -0.0062, 0], [-0.0945, 0.0036, 0.002]], 0.026, 0, 0.002, 0.003);
  // chien à ergot, derrière la glissière
  prof(g, K, [[0.0245, 0.0150, 0], [0.0245, 0.0380, 0.002], [0.0285, 0.0452, 0.002], [0.0345, 0.0451, 0.0015], [0.0351, 0.0419, 0.0015], [0.0318, 0.0386, 0.003], [0.0305, 0.0150, 0]], 0.0085, 0, 0.0012, 0.002);
  // pontet carré, détente inclinée vers l'arrière, arrêtoir de glissière à gauche, goupilles
  guard(g, S, -0.0895, -0.030, 0.005, -0.0245, 0.0047, 0.0016, 0.008);
  prof(g, K, [[-0.0592, 0.003], [-0.0568, -0.0085, 0.006], [-0.0500, -0.0205, 0.001], [-0.0480, -0.0190, 0.001], [-0.0520, -0.0090, 0.006], [-0.0545, 0.003]], 0.0055, 0, 0.0012, 0.0015);
  prof(g, K, [[-0.0560, 0.0098, 0.001], [-0.0215, 0.0098, 0.002], [-0.0185, 0.0125, 0.001], [-0.0135, 0.0125, 0.001], [-0.0135, 0.0045, 0.001], [-0.0560, 0.0058, 0.001]], 0.0022, -0.0141, 0.0006, 0.001);
  for (const [y, z] of [[0.0108, -0.0857], [0.0013, -0.0857], [-0.0205, -0.0437]]) cy(g, K, 0, y, z, 0.0032, 0.0278, 0, 0, Math.PI / 2);
  // poignée : âme inox (devant, dessous, dos), plaquettes de caoutchouc qui l'enveloppent par l'avant, vis
  prof(g, S, [G(-0.035, -0.054), G(-0.035, 0.044), G(-0.031, 0.049, 0.004), G(0.025, 0.049, 0.004), G(0.027, 0.044), G(0.027, -0.040), G(0.015, -0.054)], 0.028, 0, 0.003, 0.002);
  prof(g, M.grip, [G(-0.0362, -0.044), G(-0.0362, 0.041, 0.004), G(-0.031, 0.0455, 0.004), G(0.020, 0.0455, 0.004), G(0.0215, 0.036), G(0.0215, -0.036, 0.006), G(0.010, -0.047, 0.006)], 0.0355, 0, 0.004, 0.003);
  const sc = G(0.012, 0.027); cy(g, K, 0, sc[1], sc[0], 0.0024, 0.0362, 0, 0, Math.PI / 2);

  // ----- chargeur : corps dans la poignée, talon sombre dessous ; étendu : plus long -----
  const mw = 0.026, mh = 0.092, md = 0.044;
  info.magHome.set(0, 0, 0);
  info.buildMag = (parent, ext) => {
    const ex = (ext - 1) * 0.1, t = new THREE.Group(); t.position.set(0, -0.05, 0.012); t.rotation.x = -0.22; parent.add(t);
    rb(t, D, 0, -ex / 2, 0.0, mw, mh + ex, md, 0.004);
    rb(t, M.metal, 0, -ex / 2, -md / 2 - 0.0002, mw - 0.0045, mh - 0.016 + ex, 0.0025, 0.001);
    rb(t, D, 0, -mh / 2 - 0.0055 - ex, 0.0, mw + 0.008, 0.012, md + 0.012, 0.003);
    rb(t, M.metal, 0, -mh / 2 - 0.0115 - ex, 0.0, mw + 0.005, 0.0018, md + 0.01, 0.0008);
  };
  info.magAxis = new V3(0, -0.976, 0.218); info.magGrip = new V3(0, -mh + 0.006, 0.024);
  info.gripR.set(0, -0.05, 0.015); info.gripL.set(-0.02, -0.06, 0.005);

  // ----- visée, montages, bouche, éjection -----
  info.sightY = 0.0612; info.adsZ = 0.41 - 0.0024; // ligne de mire au sommet du guidon et des oreilles de la hausse, l'œil à 41 cm d'elle
  info.mount.optic = { y: 0.0552, z: -0.123, len: 0.07, D: 0.4, slide: g }; // point rouge compact, sur le rail du canon (fixe)
  info.mount.muzzle = { x: 0, y: by, z: zM, r: 0.0064 };
  info.mount.side = { x: 0, y: 0.0056, z: -0.142, under: true }; // pointeur laser sous le rail du canon
  info.muzzle.position.set(0, by, zM - 0.002); info.eject.position.set(0.016, 0.054, -0.03);
  // formes de prise des mains : poignée (son angle), carcasse, glissière, canon, pontet
  const gc = G(-0.004, -0.0025);
  info.gripDef = {
    R: [{ c: [0, gc[1], gc[0]], h: [0.0178, 0.0515, 0.031], r: 0.008, rx: -0.22 }, { c: [0, 0.0088, -0.06], h: [0.013, 0.0052, 0.035], r: 0.003 }, { c: [0, 0.006, 0.014], h: [0.013, 0.008, 0.022], r: 0.004 },
      { c: [0, 0.0341, -0.018], h: [0.0145, 0.021, 0.045], r: 0.003 }, { c: [0, 0.032, -0.142], h: [0.0145, 0.0235, 0.08], r: 0.003 },
      { c: [0, -0.0222, -0.06], h: [0.00375, 0.0021, 0.0298], r: 0.002 }, { c: [0, -0.0096, -0.0874], h: [0.00375, 0.0147, 0.0021], r: 0.002 }],
  };
  info.gripDef.L = info.gripDef.R;
  info.trigDef = { at: [0.004, -0.011, -0.064], xTip: -0.003, guard: [{ c: [0, -0.0085, -0.0538], h: [0.00275, 0.0115, 0.0025], r: 0.0015, rx: 0.32 }] };
});
