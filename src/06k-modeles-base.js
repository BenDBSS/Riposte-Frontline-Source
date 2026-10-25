/* ==========================================================================
   MODÈLES D'ARMES, PREMIÈRE SÉRIE : M4A1, MP5, L96A1, M1014, M9
   Chaque modèle reçoit le contexte c de buildGunModel : g (groupe), M (matières, éventuellement camouflées), info (voir
   06j-modeles.js), A (accessoires par emplacement), bl (rallonge du canon, négative pour un canon court), stock
   (variante de crosse : null, 'heavy' ou 'none') et optic (une optique remplace les organes de visée métalliques).
   Les organes de visée (positions inchangées pour l'alignement) ne sont construits qu'en l'absence d'optique ; le
   viseur point rouge, l'ancien accessoire du M4A1, est désormais l'accessoire « red » (06p-accessoires.js).
   ========================================================================== */

/* ---------- M4A1 (carabine courte, garde-mains ronds) : construite d'après une vue de profil (P : 0,9 mm par pixel, calée sur la
   longueur réelle de 684 mm, crosse rentrée). La main droite du jeu tient la poignée avec la détente 10,8 cm devant elle (la vraie
   arme : 5 cm) : comme sur l'AK-47 et le SCAR-H, poignée et détente restent à leur place et l'arrière de l'arme (boîtier derrière la
   fenêtre d'éjection, poignée, tube et crosse : Q) recule de D = 5,5 cm, le creux du pontet s'allonge d'autant.
   - Canon court à cache-flamme A2, guidon triangulaire (bloc de gaz, fenêtre, oreilles du guidon, tenon de baïonnette, grenadière),
     chapeau et bague du garde-mains ; garde-mains ronds à nervures.
   - Boîtier supérieur à rail (hausse repliable relevée), levier d'armement, fenêtre d'éjection et assistance à la fermeture à
     droite ; boîtier inférieur à puits de chargeur évasé, arrêtoir de culasse et sélecteur à gauche, goupilles, pontet ; poignée A2
     (renflement, flancs quadrillés) ; tube de crosse et sa bague, crosse télescopique à lumières, levier et grenadière.
   - Rails d'accessoires sous le garde-mains et sur son flanc gauche seulement quand un accessoire s'y pose ; avec une optique, un
     bloc de gaz bas remplace le guidon.
   Contrôle : node tools/dev/visual/contour.js --arme m4 --photo <profil gauche, 800 x 490> --mmpx 0.9 --ancre 483,197,-0.038,0.037
   (avant de l'arme ; l'arrière est décalé de D). ---------- */
defineGun('m4', 'rifle', (c) => {
  const { g, M, info, bl } = c, K = M.rubber, sx2 = [-1, 1];
  const S = 0.0009, D = 0.0549, P = (x, y, r) => { const q = [-0.038 + (x - 483) * S, 0.037 - (y - 197) * S]; if (r !== undefined) q.push(r); return q; };
  const Q = (x, y, r) => { const q = P(x, y, r); q[0] += D; return q; }, Pz = (x) => P(x, 0)[0], Qz = (x) => Pz(x) + D, Py = (y) => P(0, y)[1];
  const by = 0.037, rH = 0.0328;

  // ----- boîtier supérieur : corps, rail (dents sur toute la longueur), levier d'armement ; à droite, fenêtre d'éjection, volet,
  // déflecteur, assistance à la fermeture -----
  prof(g, M.metal, [P(349, 168, 0.002), Q(565, 166, 0.003), Q(569, 172, 0.003), Q(569, 214, 0.002), P(352, 216, 0.002), P(349, 210, 0.002)], 0.032, 0, 0.003, 0.003);
  rail(g, M, 0, 0.066, (Pz(352) + Qz(548)) / 2, Qz(548) - Pz(352));
  rb(g, M.metal, 0, Py(163), Qz(556), 0.03, 0.007, 0.022, 0.002);
  rb(g, M.metal, -0.018, Py(163), Qz(560), 0.008, 0.006, 0.012, 0.002);
  rb(g, K, 0.0161, Py(184), (Pz(395) + Pz(465)) / 2, 0.0012, Py(172) - Py(196), Pz(465) - Pz(395), 0.0006);
  rb(g, M.dark, 0.0168, Py(196), (Pz(395) + Pz(465)) / 2, 0.0014, 0.0028, Pz(465) - Pz(395) + 0.004, 0.0006);
  rb(g, M.metal, 0.0172, Py(176), Pz(472) + 0.004, 0.006, 0.012, 0.012, 0.003);
  cy(g, M.metal, 0.0185, Py(185), Qz(538), 0.0072, 0.03);
  part(g, new THREE.SphereGeometry(1, 10, 8), M.dark, 0.0185, Py(185), Qz(538) + 0.015, 0.008, 0.008, 0.008);

  // ----- boîtier inférieur : puits de chargeur évasé, creux du pontet, arrière sous le tube ; pontet ; arrêtoir, sélecteur, goupilles,
  // bouton du chargeur (droite) -----
  prof(g, M.metal, [P(352, 216, 0.002), Q(578, 216, 0.002), Q(587, 220, 0.002), Q(587, 232, 0.002), Q(578, 236, 0.004), Q(559, 240, 0.006), Q(549, 250, 0.004), Q(500, 250, 0.002),
    P(449, 250, 0.002), P(447, 262, 0.002), P(445, 284, 0.003), P(441, 293, 0.003), P(368, 289, 0.003), P(358, 284, 0.003), P(366, 276, 0.002), P(366, 240, 0.004), P(356, 230, 0.002)], 0.03, 0, 0.0025, 0.002);
  prof(g, M.metal, [P(444, 283, 0.002), Q(507, 283, 0.003), Q(516, 291, 0.002), P(441, 292, 0.003)], 0.009, 0, 0.0016, 0.002);
  rb(g, M.dark, 0, Py(266), Pz(486), 0.006, Py(250) - Py(282) + 0.006, 0.005, 0.002, 0.25); // détente
  { const a = P(425, 206), b = P(429, 238); rb(g, M.dark, -0.0157, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, 0.0028, a[1] - b[1], 0.009, 0.0015, 0.05); }
  { const q = Q(527, 231); cy(g, M.dark, -0.0155, q[1], q[0], 0.0045, 0.002, 0, 0, Math.PI / 2); rb(g, M.dark, -0.017, q[1] + 0.0045, q[0] - 0.001, 0.0022, 0.009, 0.004, 0.001, -0.5); }
  for (const z of [Pz(357), Qz(568)]) cy(g, M.dark, 0, Py(232), z, 0.003, 0.0312, 0, 0, Math.PI / 2);
  cy(g, M.dark, 0.016, Py(228), Pz(440), 0.0042, 0.003, 0, 0, Math.PI / 2);
  // poignée A2 (place et angle de la main du jeu : axe incliné de 0,33 rad, GA(d, b) : d le long de l'axe vers le bas depuis le dessous
  // du boîtier, b vers l'arrière) : devant presque droit sous l'index et le majeur, ergot entre le majeur et l'annulaire (aux deux tiers), bas évasé
  // et talon qui recule, dos bombé qui rejoint le boîtier ; plaquettes quadrillées en léger relief sur les flancs
  const ga = 0.33, GA = (d, b, r) => { const q = [0.0506 + Math.sin(ga) * d + Math.cos(ga) * b, -0.0107 - Math.cos(ga) * d + Math.sin(ga) * b]; if (r !== undefined) q.push(r); return q; };
  prof(g, M.poly, [GA(-0.006, -0.019, 0.002), GA(0.004, -0.0215, 0.006), GA(0.03, -0.0222, 0.012), GA(0.049, -0.0236, 0.006), GA(0.057, -0.0285, 0.004), GA(0.064, -0.0262, 0.004),
    GA(0.072, -0.0215, 0.008), GA(0.09, -0.0212, 0.01), GA(0.1, -0.0232, 0.004), GA(0.106, -0.022, 0.004), GA(0.108, 0.0, 0.006), GA(0.105, 0.0262, 0.004), GA(0.096, 0.0262, 0.006),
    GA(0.07, 0.0226, 0.012), GA(0.035, 0.0222, 0.012), GA(0.012, 0.023, 0.008), GA(0.001, 0.027, 0.004), GA(-0.006, 0.03, 0.002)], 0.031, 0, 0.0045, 0.003);
  for (const sx of sx2) {
    const pl = prof(g, M.grip, [GA(0.012, -0.0168, 0.004), GA(0.036, -0.0182, 0.006), GA(0.058, -0.0172, 0.006), GA(0.094, -0.0168, 0.004), GA(0.097, 0.0, 0.004), GA(0.093, 0.0185, 0.004),
      GA(0.012, 0.018, 0.004), GA(0.008, 0.0, 0.004)], 0.0012, sx * 0.0152, 0.0004, 0.004);
    pl.geometry = pl.geometry.clone(); const uv = pl.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 2.5); // quadrillage fin
  }
  // ----- avant : bague et chapeau des garde-mains, garde-mains ronds à nervures, canon, guidon triangulaire, cache-flamme -----
  cz(g, M.dark, 0, by, (Pz(326) + Pz(349)) / 2, 0.0234, Pz(349) - Pz(326));
  cz(g, M.dark, 0, by, Pz(330), 0.0262, 0.004);
  cz(g, M.poly, 0, by, (Pz(149) + Pz(324)) / 2, rH, Pz(324) - Pz(149), new THREE.CylinderGeometry(1, 1, 1, 18));
  for (const z of [Pz(152), Pz(321)]) cz(g, M.poly, 0, by, z, rH + 0.0012, 0.006); // rebords des deux bouts
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * TAU / 8; bx(g, M.poly, Math.sin(a) * rH, by + Math.cos(a) * rH, (Pz(158) + Pz(316)) / 2, 0.0035, 0.0035, Pz(316) - Pz(158), 0, 0, -a); }
  for (let k = 0; k < 9; k++) cz(g, K, 0, by, Pz(168 + k * 19), rH + 0.0003, 0.0028, G_CYL_O); // rainures entre les nervures
  cz(g, M.dark, 0, by, (Pz(138) + Pz(148)) / 2, 0.0216, Pz(148) - Pz(138));
  const bv = bl < 0 ? bl * 0.45 : bl, tip = Pz(16) - bv;
  cz(g, M.metal, 0, by, (tip + Pz(352)) / 2, 0.0075, Pz(352) - tip);
  if (!c.optic) {
    // bloc de gaz et guidon triangulaire : jambe avant, rampe arrière, fenêtre ; au-dessus, deux oreilles et, entre elles, la lame du
    // guidon, dont la pointe est sur la ligne de mire (vue de derrière : la lame fine dans un U, comme sur la vraie arme) ; tenon de
    // baïonnette
    prof(g, M.dark, [P(86, 214, 0.003), P(86, 184, 0.002), P(88, 146, 0.002), P(116, 146, 0.002), P(140, 180, 0.003), P(141, 214, 0.003)], 0.018, 0, 0.002, 0.002,
      [[P(99, 154, 0.002), P(125, 181, 0.002), P(95, 181, 0.002)]]);
    for (const sx of sx2) prof(g, M.dark, [P(88, 147), P(88, 118, 0.001), P(101, 118, 0.001), P(116, 147)], 0.0018, sx * 0.0065, 0.0005, 0.001);
    prof(g, M.dark, [P(91, 147), P(92, 123, 0.0005), P(97, 123, 0.0005), P(99, 147)], 0.0024, 0, 0.0004, 0.0006);
    prof(g, M.dark, [P(80, 207), P(98, 207), P(98, 222, 0.002), P(82, 222, 0.002)], 0.008, 0, 0.0014, 0.002);
    part(g, G_TOR, M.metal, 0, Py(232), Pz(134), 0.011, 0.011, 0.011, 0, Math.PI / 2, 0);
  } else cz(g, M.dark, 0, by + 0.002, Pz(114), 0.0135, Pz(140) - Pz(88)); // bloc de gaz bas : le guidon ne gêne pas l'optique
  if (!c.A.muzzle) {
    cz(g, M.dark, 0, by, tip + 0.0155, 0.0099, 0.031);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 2 + (k - 1.5) * 0.75; bx(g, K, Math.sin(a) * 0.0097, by + Math.cos(a) * 0.0097, tip + 0.012, 0.0028, 0.0012, 0.017, 0, 0, -a); }
    cz(g, K, 0, by, tip - 0.0001, 0.0062, 0.0006);
  }

  // ----- tube de crosse, bague, crosse télescopique (variantes : sans crosse, embout ; renforcée, joue) -----
  cz(g, M.dark, 0, by, Qz(573), 0.0172, Qz(578) - Qz(568));
  let butt;
  if (c.stock === 'none') {
    cz(g, M.metal, 0, by, (Qz(578) + 0.235) / 2, 0.0149, 0.235 - Qz(578));
    rb(g, K, 0, by, 0.24, 0.034, 0.034, 0.012, 0.008);
    butt = 0.246;
  } else {
    cz(g, M.metal, 0, by, (Qz(578) + Qz(740)) / 2, 0.0149, Qz(740) - Qz(578));
    prof(g, M.poly, [Q(592, 173, 0.003), Q(760, 174, 0.004), Q(776, 170, 0.002), Q(772, 250, 0.004), Q(766, 280, 0.004), Q(762, 312, 0.004), Q(758, 320, 0.002), Q(742, 316, 0.003),
      Q(740, 292, 0.004), Q(732, 280, 0.004), Q(713, 274, 0.004), Q(696, 262, 0.004), Q(687, 256, 0.004), Q(635, 250, 0.004), Q(627, 244, 0.003), Q(627, 226, 0.003), Q(592, 226, 0.003)],
    0.04, 0, 0.004, 0.004, [[Q(717, 262, 0.002), Q(722, 262, 0.002), Q(730, 279, 0.002), Q(719, 279, 0.002)]]);
    for (let k = 0; k < 5; k++) for (const y of [201, 209, 217]) for (const sx of sx2) rb(g, K, sx * 0.0202, Py(y), Qz(622 + k * 33), 0.0012, 0.0036, 0.025, 0.0014);
    rb(g, M.dark, 0, Py(258), Qz(656), 0.012, 0.012, 0.012, 0.003);
    rb(g, K, 0, Py(245), Qz(773), 0.042, Py(172) - Py(318), 0.008, 0.003);
    part(g, G_TOR, M.metal, 0, Py(322), Qz(748), 0.01, 0.01, 0.01, 0, Math.PI / 2, 0);
    if (c.stock === 'heavy') rb(g, M.poly, 0, Py(166), Qz(690), 0.034, 0.016, 0.1, 0.006);
    butt = Qz(776) + 0.004;
  }
  info.butt = [0, 0.01, butt];

  // ----- organes de visée : hausse repliable relevée, sur l'arrière du rail : semelle, montant, œilleton fin et deux oreilles de
  // protection (fines : la visée reste dégagée ; traits en fraction de l'écran, 06jb-formes.js) ; rien si une optique les remplace -----
  const sy = Py(123), zr = Qz(528);
  info.sightY = sy; info.adsZ = zr + 0.19; // ligne de mire : centre de l'œilleton et pointe de la lame du guidon
  if (!c.optic) {
    rb(g, M.dark, 0, 0.0765, zr, 0.03, 0.008, 0.03, 0.002);
    ironFoot(c, M.dark, zr, 0.0795, ironRing(c, zr, IRON.hole.rifle), 0.02);
    for (const sx of sx2) bx(g, M.dark, sx * 0.0102, (0.0795 + sy - 0.001) / 2, zr, ironW(c, zr, IRON.wing), sy - 0.001 - 0.0795, 0.006);
  }

  // ----- chargeur : courbe, en aluminium gris -----
  info.magHome.set(0, -0.021, -0.11);
  info.buildMag = (parent, ext) => curvedMag(parent, M, 5, 0.112 * ext, 0.026, 0.062, 0.28, M.gray);
  info.magAxis = new V3(0, -0.99, -0.12); info.magGrip = new V3(0, -0.07, -0.012);

  // ----- mains, visée, montages -----
  info.gripR.set(0, -0.0282, 0.062); info.gripL.set(0, by, -0.235);
  info.mount.optic = { y: 0.071, z: (Pz(352) + Qz(548)) / 2 - 0.01, len: Qz(548) - Pz(352) - 0.02, D: 0.2675 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0075 };
  // rails d'accessoires : sous les garde-mains et sur leur flanc gauche, posés seulement si un accessoire les occupe
  if (c.A.under) rail(g, M, 0, by - rH + 0.0006, -0.27, 0.13);
  info.mount.under = { y: by - rH - 0.0034, z: -0.27, len: 0.13 };
  if (c.A.side) rail(g, M, -(rH + 0.0016), by, -0.3, 0.07, true);
  info.mount.side = { x: -(rH + 0.0056), y: by, z: -0.3 };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(0.02, Py(184), (Pz(395) + Pz(465)) / 2);
  info.gripDef = {
    R: [{ c: [0, -0.0382, 0.06], h: [0.0155, 0.0525, 0.022], r: 0.01, rx: -0.33 }, { c: [0, 0.006, -0.04], h: [0.015, 0.017, 0.12], r: 0.006 }],
    L: [{ c: [0, by, -0.26], h: [rH, rH, 0.088], r: rH - 0.002 }, { c: [0, by, (Pz(326) + Pz(349)) / 2], h: [0.0234, 0.0234, 0.012], r: 0.01 }],
  };
  info.trigDef = { at: [0.004, -0.0242, -0.046], xTip: -0.004, guard: [{ c: [0, Py(287), (Pz(444) + Qz(507)) / 2], h: [0.0045, 0.0045, (Qz(507) - Pz(444)) / 2], r: 0.002 },
    { c: [0, Py(268), Pz(446)], h: [0.004, 0.017, 0.003], r: 0.002 }, { c: [0, Py(268), Pz(405)], h: [0.015, 0.024, 0.036], r: 0.006 }, { c: [0, Py(266), Pz(486)], h: [0.003, 0.015, 0.003], r: 0.002, rx: 0.25 }] };
});

/* ---------- MP5 (A3) : boîtier embouti noir surmonté du tube d'armement, levier d'armement à l'avant gauche, guidon sous tunnel
   et dioptre à tambour, garde-main fin percé de trous ronds, cache-flamme à trois ergots et patte avant, carcasse en polymère
   (sélecteur, pontet arrondi, poignée inclinée), chargeur courbe et palette de déverrouillage, crosse rétractable à deux tiges et
   plaque de couche recourbée. Cotes relevées sur une vue de profil (0,4 mm par pixel, calée sur la détente) ; la poignée est
   reculée de 2 cm pour la main du jeu, les tiges de crosse à demi rentrées (portée du bras gauche des soldats). ---------- */
defineGun('mp5', 'smg', (c) => {
  const { g, M, info } = c, bl = Math.max(c.bl, -0.03);
  // boîtier embouti, tube d'armement, rainure des flancs, fenêtre d'éjection, levier d'armement et sa fente
  prof(g, M.dark, [[-0.216, 0.056, 0.003], [0.04, 0.056, 0.003], [0.04, 0.006, 0.003], [-0.216, 0.006, 0.003]], 0.042, 0, 0.003, 0.003);
  cy(g, M.dark, 0, 0.065, -0.139, 0.0095, 0.358);
  for (const sx of [-1, 1]) rb(g, M.rubber, sx * 0.0213, 0.034, -0.074, 0.0016, 0.012, 0.2, 0.004);
  rb(g, M.rubber, 0.0213, 0.046, -0.09, 0.0016, 0.016, 0.05, 0.002);
  rb(g, M.rubber, -0.0096, 0.064, -0.272, 0.0016, 0.004, 0.08, 0.0008);
  rb(g, M.metal, -0.014, 0.068, -0.3, 0.012, 0.004, 0.006, 0.0015);
  cy(g, M.dark, -0.025, 0.07, -0.3, 0.0068, 0.012, 0, 0, Math.PI / 2);
  // garde-main fin et ses trous ronds, patte avant sous le canon
  prof(g, M.poly, [[-0.33, 0.054, 0.008], [-0.214, 0.056, 0.004], [-0.214, 0.006, 0.004], [-0.33, 0.01, 0.008]], 0.05, 0, 0.006, 0.006);
  for (const sx of [-1, 1]) for (const [z, y] of [[-0.282, 0.044], [-0.242, 0.044], [-0.302, 0.026], [-0.262, 0.026]]) cy(g, M.rubber, sx * 0.0252, y, z, 0.0078, 0.002, 0, 0, Math.PI / 2);
  prof(g, M.dark, [[-0.347, 0.03, 0.002], [-0.329, 0.03, 0.002], [-0.329, -0.012, 0.003], [-0.335, -0.017, 0.003], [-0.347, -0.014, 0.003]], 0.012, 0, 0.002, 0.002);
  // embase du guidon (tient le tube et le canon), canon, cache-flamme à trois ergots (remplacé par le dispositif de bouche)
  prof(g, M.dark, [[-0.347, 0.074, 0.003], [-0.31, 0.074, 0.003], [-0.31, 0.04, 0.003], [-0.347, 0.024, 0.003]], 0.022, 0, 0.003, 0.003);
  const tip = -0.386 - bl;
  cy(g, M.metal, 0, 0.03, (-0.346 + tip) / 2, 0.0065, Math.abs(tip + 0.346));
  if (!c.A.muzzle) {
    cy(g, M.dark, 0, 0.03, tip + 0.012, 0.0098, 0.024);
    for (let i = 0; i < 3; i++) bx(g, M.metal, Math.cos(i * 2.1) * 0.0105, 0.03 + Math.sin(i * 2.1) * 0.0105, tip + 0.018, 0.004, 0.004, 0.01);
  }
  // guidon sous tunnel et dioptre à tambour ; rail à griffes posé sur le tube s'il y a une optique. L'œil est à 10,5 cm du dioptre :
  // son anneau, petit et fin, entoure le tunnel du guidon (deux cercles concentriques, la pointe au centre) ; ses ailes, minces et
  // peu profondes, ne montrent plus leur flanc
  info.sightY = 0.088; info.adsZ = 0.105;
  if (!c.optic) {
    bx(g, M.dark, 0, 0.078, -0.331, 0.006, 0.01, 0.012);
    cz(g, M.dark, 0, 0.088, -0.331, 0.013, 0.016, G_CYL_O).material = M.tube;
    bx(g, M.sight, 0, 0.081, -0.331, ironW(c, -0.331, IRON.post), 0.014, 0.004);
    bx(g, M.dark, 0, 0.0765, 0.0, 0.018, 0.006, 0.024);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.087, 0.0, ironW(c, 0, IRON.wing), 0.022, 0.006); // ailes, sur l'embase
    ironFoot(c, M.dark, 0, 0.079, ironRing(c, 0, IRON.hole.smg), 0.008);
  } else {
    rb(g, M.dark, 0, 0.0775, -0.07, 0.026, 0.008, 0.18, 0.002);
    for (let i = 0; i < 14; i++) bx(g, M.dark, 0, 0.0825, -0.15 + i * 0.012, 0.026, 0.004, 0.006);
  }
  // embout arrière du boîtier (porte la crosse), anneau de bretelle
  prof(g, M.dark, [[0.036, 0.074, 0.003], [0.082, 0.074, 0.006], [0.086, 0.062, 0.004], [0.086, 0.004, 0.004], [0.036, 0.002, 0.003]], 0.04, 0, 0.003, 0.004);
  part(g, G_TOR, M.metal, -0.021, 0.004, 0.08, 0.008, 0.008, 0.008, 0, Math.PI / 2, 0);
  // carcasse en polymère : puits de chargeur, palette, pontet arrondi, détente, sélecteur, goupilles, poignée inclinée
  prof(g, M.dark, [[-0.182, 0.008, 0.002], [-0.124, 0.008, 0.002], [-0.124, -0.044, 0.004], [-0.182, -0.044, 0.004]], 0.034, 0, 0.003, 0.003);
  rb(g, M.metal, 0, -0.042, -0.122, 0.012, 0.032, 0.004, 0.0015, -0.2);
  prof(g, M.poly, [[-0.128, 0.008, 0.002], [0.044, 0.008, 0.004], [0.044, -0.03, 0.006], [0.02, -0.056, 0.004], [-0.104, -0.048, 0.006], [-0.128, -0.04, 0.004]], 0.036, 0, 0.003, 0.004);
  prof(g, M.poly, [[-0.112, -0.044, 0.004], [-0.09, -0.084, 0.012], [-0.016, -0.084, 0.01], [0.004, -0.06, 0.004], [0.006, -0.044, 0]], 0.012, 0, 0.002, 0.004,
    [[[-0.1, -0.046, 0.002], [-0.084, -0.076, 0.008], [-0.02, -0.076, 0.007], [-0.006, -0.058, 0.003], [-0.006, -0.046, 0]]]);
  rb(g, M.metal, 0, -0.06, -0.058, 0.006, 0.024, 0.006, 0.002, 0.18);
  cy(g, M.metal, -0.0185, -0.012, -0.034, 0.007, 0.004, 0, 0, Math.PI / 2);
  rb(g, M.metal, -0.0195, -0.026, -0.031, 0.003, 0.026, 0.006, 0.001, -0.2);
  for (const [z, y] of [[0.05, 0.005], [-0.12, -0.02]]) cy(g, M.metal, 0, y, z, 0.0048, 0.0392, 0, 0, Math.PI / 2);
  gripProf(g, M.poly, 0.025, -0.02, 0.066, -0.144, 0.048, 0.034, 0.004);
  // crosse rétractable : deux tiges et plaque de couche recourbée (variantes : sans crosse, embout ; renforcée, crosse fixe)
  let butt;
  if (c.stock === 'none') {
    rb(g, M.rubber, 0, 0.038, 0.089, 0.04, 0.06, 0.006, 0.003);
    butt = 0.092;
  } else if (c.stock === 'heavy') {
    prof(g, M.poly, [[0.084, 0.07, 0.004], [0.13, 0.072, 0.01], [0.262, 0.074, 0.006], [0.262, -0.05, 0.006], [0.19, -0.03, 0.012], [0.1, -0.006, 0.006], [0.084, 0.0, 0.004]], 0.044, 0, 0.004, 0.004);
    rb(g, M.rubber, 0, 0.012, 0.266, 0.046, 0.12, 0.008, 0.004);
    butt = 0.27;
  } else {
    for (const sx of [-1, 1]) cy(g, M.metal, sx * 0.0155, 0.031, 0.161, 0.0055, 0.154);
    prof(g, M.dark, [[0.226, 0.05, 0.004], [0.262, 0.052, 0.006], [0.264, 0.035, 0.004], [0.258, -0.07, 0.006], [0.252, -0.078, 0.004], [0.238, -0.075, 0.006], [0.238, 0.02, 0.006], [0.226, 0.03, 0.004]], 0.044, 0, 0.004, 0.005);
    rb(g, M.rubber, 0, -0.015, 0.2625, 0.042, 0.095, 0.006, 0.003, 0.05);
    butt = 0.266;
  }
  info.butt = [0, 0.0, butt];
  // chargeur courbe : haut dans le puits, l'arc penche vers l'avant
  info.magHome.set(0, -0.036, -0.153);
  info.buildMag = (parent, ext) => curvedMag(parent, M, 6, 0.165 * ext, 0.024, 0.036, 0.5, M.dark);
  info.magAxis = new V3(0, -0.99, -0.14); info.magGrip = new V3(0, -0.06, -0.011);
  info.gripR.set(0, -0.07, 0.047); info.gripL.set(0, 0.03, -0.262);
  info.mount.optic = { y: 0.083, z: -0.07, len: 0.18, D: 0.22 };
  info.mount.muzzle = { x: 0, y: 0.03, z: tip, r: 0.0075 };
  info.mount.under = { y: 0.0075, z: -0.272, len: 0.1 };
  info.mount.side = { x: -0.025, y: 0.03, z: -0.3 };
  info.muzzle.position.set(0, 0.03, tip - 0.01); info.eject.position.set(0.022, 0.046, -0.09);
  info.gripDef = {
    R: [{ c: [0, -0.075, 0.046], h: [0.017, 0.055, 0.024], r: 0.01, rx: -0.32 }, { c: [0, -0.02, -0.04], h: [0.018, 0.03, 0.085], r: 0.008 }],
    // garde-main (trous compris), tube d'armement, patte avant sous le canon (le pouce tendu vers la bouche s'y arrête)
    L: [{ c: [0, 0.031, -0.272], h: [0.0265, 0.025, 0.058], r: 0.006 }, { c: [0, 0.065, -0.27], h: [0.0095, 0.0095, 0.05], r: 0.009 }, { c: [0, 0.007, -0.338], h: [0.006, 0.024, 0.009], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.064, -0.07], xTip: -0.004, guard: [{ c: [0, -0.08, -0.05], h: [0.006, 0.004, 0.04], r: 0.002 }, { c: [0, -0.062, -0.1], h: [0.006, 0.018, 0.006], r: 0.002 },
    { c: [0, -0.06, -0.058], h: [0.003, 0.012, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.02, -0.153], h: [0.017, 0.024, 0.029], r: 0.004 }] };
});

/* ---------- L96A1 : crosse taupe d'un seul tenant (avant-bras à rail latéral cranté, fente de grenadière, embase de bretelle,
   berceau du boîtier, puits de chargeur, trou de pouce derrière une poignée plus étroite, rehausse de joue à vis, entretoises et
   plaque de couche), boîtier rond et culasse à boule, canon lourd à bagues, guidon rabattable, frein de bouche à deux évents sur
   sa bague, chargeur droit, lunette à objectif évasé (tourelles, colliers à molettes sur leur embase, oculaire à bague de
   grossissement, lentilles visibles aux deux bouts). Cotes relevées sur une vue de profil (0,73 mm par pixel, longueur 1,18 m) ;
   détente, poignée et culasse aux cotes de l'ancien modèle pour la main du jeu et l'animation de la culasse, crosse reculée
   d'autant (4,5 cm). ---------- */
defineGun('l96', 'sniper', (c) => {
  const { g, M, info } = c, S = M.taupe, heavy = c.stock === 'heavy';
  // crosse : avant-bras au nez fuyant, berceau du boîtier (plus bas au-dessus de l'éjection), puits de chargeur, poignet au-dessus
  // du trou de pouce, rehausse de joue, talon ; la poignée, plus étroite, ferme le trou de pouce par l'avant
  prof(g, S, [[-0.437, 0.0425, 0.005], [-0.1, 0.0425, 0.002], [-0.096, 0.035, 0.002], [0.086, 0.035, 0.004], [0.094, 0.028, 0.004], [0.315, 0.03, 0.002],
    [0.318, 0.033, 0.002], [0.361, 0.033, 0.004], [0.361, -0.1, 0.004], [0.125, -0.101, 0.006], [0.125, -0.066, 0.004], [0.135, -0.062, 0.008], [0.15, -0.05, 0.006],
    [0.15, -0.0074, 0.008], [0.09, -0.0074, 0.004], [-0.058, -0.0074, 0.003], [-0.062, -0.0206, 0.003], [-0.148, -0.0206, 0.004], [-0.186, -0.0074, 0.008],
    [-0.403, -0.0074, 0.01]], 0.05, 0, 0.004, 0.004);
  prof(g, S, [[0.042, 0.0, 0.002], [0.05, -0.012, 0.004], [0.073, -0.104, 0.006], [0.128, -0.104, 0.004], [0.128, -0.07, 0.002], [0.118, -0.058, 0.006],
    [0.094, -0.0074, 0.004], [0.094, 0.0, 0.002]], 0.04, 0, 0.006, 0.004);
  cy(g, M.dark, 0, -0.07, 0.098, 0.003, 0.0412, 0, 0, Math.PI / 2);
  // rail latéral de l'avant-bras (dépasse de 2 mm), crans sous le rail, vis ; fente de grenadière ; embase de bretelle (ôtée sous
  // un accessoire)
  prof(g, S, [[-0.402, 0.0198, 0.012], [-0.15, 0.0198, 0.01], [-0.144, 0.012, 0.004], [-0.144, -0.0074, 0.002], [-0.402, -0.0074, 0.004]], 0.054, 0, 0.0015, 0.004);
  for (let i = 0; i < 6; i++) rb(g, M.dark, 0, -0.0035, -0.308 + i * 0.018, 0.0546, 0.009, 0.0055, 0.001);
  cy(g, M.dark, 0, 0.0095, -0.392, 0.003, 0.0556, 0, 0, Math.PI / 2);
  for (const z of [-0.047, -0.159]) cy(g, M.dark, 0, z < -0.1 ? 0.002 : 0.014, z, 0.003, 0.0506, 0, 0, Math.PI / 2);
  prof(g, M.rubber, [[-0.007, 0.0033], [0.007, 0.0033], [0.007, -0.0033], [-0.007, -0.0033]], 0.0506, 0, 0, 0.0033).position.set(0, 0.024, -0.415);
  if (!c.A.under) {
    cy(g, M.metal, 0, -0.012, -0.362, 0.008, 0.01, 0);
    bx(g, M.metal, 0, -0.021, -0.362, 0.003, 0.01, 0.004);
    part(g, G_TOR, M.metal, 0, -0.031, -0.362, 0.0075, 0.009, 0.0075, 0, Math.PI / 2, 0);
  }
  // rehausse de joue (plus haute avec la crosse renforcée) sur sa platine à vis, entretoises, plaque de couche, embase arrière
  rb(g, S, 0, heavy ? 0.04 : 0.0355, 0.25, 0.046, heavy ? 0.026 : 0.017, 0.13, 0.006);
  rb(g, S, 0, 0.006, 0.258, 0.052, 0.044, 0.12, 0.004);
  for (const [y, z, w] of [[0.0124, 0.2164, 0.0532], [0.0124, 0.2458, 0.0532], [-0.0338, 0.1995, 0.0512], [-0.0338, 0.3029, 0.0512]]) cy(g, M.dark, 0, y, z, 0.0028, w, 0, 0, Math.PI / 2);
  for (const z of [0.3155, 0.3495]) rb(g, M.dark, 0, -0.0335, z, 0.0505, 0.133, 0.0015, 0.001);
  rb(g, M.rubber, 0, -0.0335, 0.373, 0.052, 0.137, 0.024, 0.006);
  cy(g, M.metal, 0, -0.106, 0.3, 0.0085, 0.01, 0);
  part(g, G_TOR, M.metal, 0, -0.119, 0.3, 0.007, 0.0085, 0.007, 0, Math.PI / 2, 0);
  info.butt = [0, -0.02, 0.38];
  // boîtier rond, manchon de culasse et témoin d'armement, fenêtre d'éjection (droite), arrêtoir de culasse (gauche)
  cy(g, M.metal, 0, 0.044, -0.0625, 0.017, 0.295);
  cy(g, M.dark, 0, 0.044, 0.1, 0.0145, 0.03);
  cy(g, M.metal, 0, 0.044, 0.117, 0.006, 0.006);
  rb(g, M.dark, 0.0162, 0.05, -0.035, 0.002, 0.013, 0.065, 0.001);
  rb(g, M.dark, -0.0172, 0.04, -0.045, 0.003, 0.006, 0.03, 0.001);
  // culasse : levier coudé à boule (la main droite le saisit, l'animation le fait tourner et reculer)
  info.bolt = new THREE.Group(); info.bolt.position.set(0.02, 0.045, 0.07); g.add(info.bolt);
  part(info.bolt, G_CYL, M.metal, -0.004, 0.008, 0, 0.007, 0.018, 0.007, 0, 0, Math.PI / 2);
  part(info.bolt, G_CYL, M.metal, 0.03, 0, 0, 0.006, 0.06, 0.006, 0, 0, Math.PI / 2 - 0.4);
  part(info.bolt, new THREE.SphereGeometry(1, 12, 10), M.dark, 0.058, -0.012, 0, 0.012, 0.012, 0.012);
  // canon lourd et sa portée, bagues, guidon rabattable (embase, ailettes, guidon, capot replié), frein de bouche à deux évents sur
  // sa bague (remplacé par le dispositif de bouche s'il y en a un)
  const tip = -0.767;
  cy(g, M.metal, 0, 0.044, -0.2275, 0.0128, 0.025);
  cy(g, M.metal, 0, 0.044, (tip - 0.215) / 2, 0.011, -0.215 - tip);
  for (const z of [-0.6505, -0.5968]) cy(g, M.dark, 0, 0.044, z, 0.0113, 0.0095);
  rb(g, M.dark, 0, 0.0445, -0.7337, 0.026, 0.028, 0.025, 0.004);
  for (const sx of [-1, 1]) rb(g, M.dark, sx * 0.0075, 0.069, -0.7357, 0.003, 0.022, 0.02, 0.001);
  bx(g, M.dark, 0, 0.0665, -0.7357, 0.002, 0.016, 0.003);
  rb(g, M.dark, 0, 0.067, -0.7115, 0.016, 0.01, 0.033, 0.004);
  if (!c.A.muzzle) {
    cy(g, M.metal, 0, 0.044, -0.7795, 0.0147, 0.0257);
    cy(g, M.dark, 0, 0.0285, -0.78, 0.003, 0.004, 0);
    cy(g, M.metal, 0, 0.044, -0.8147, 0.0128, 0.0446);
    cone(g, M.metal, 0, 0.044, -0.8386, 0.0106, 0.0128, 0.0031);
    cy(g, M.rubber, 0, 0.044, -0.8402, 0.004, 0.0004);
    for (const z of [-0.8218, -0.802]) bx(g, M.rubber, 0, 0.046, z, 0.0262, 0.016, 0.0147);
  }
  // lunette : objectif évasé (lentille au fond), tube, selle et tourelles (dessus, droite) et sa plaque gauche, oculaire à bague de
  // grossissement (lentille visible) ; deux colliers sur leur embase, molettes de serrage à gauche, niveau
  const sy = 0.0946;
  rb(g, M.dark, 0, 0.065, -0.102, 0.026, 0.012, 0.154, 0.002);
  rb(g, M.dark, -0.004, 0.0715, -0.0555, 0.018, 0.009, 0.027, 0.002);
  for (const z of [-0.1697, -0.0838]) {
    cy(g, M.dark, 0, sy, z, 0.0148, 0.017);
    rb(g, M.dark, 0, 0.0755, z, 0.024, 0.011, 0.017, 0.002);
    cy(g, M.metal, -0.016, 0.066, z, 0.0095, 0.008, 0, 0, Math.PI / 2);
    cy(g, M.dark, -0.0205, 0.066, z, 0.004, 0.002, 0, 0, Math.PI / 2);
  }
  scopeEnd(g, M, sy, -0.2798, 0.0262, 0.0262, -1, 0.0147, M.dark, M.metal);
  cone(g, M.dark, 0, sy, -0.23315, 0.025, 0.0125, 0.0639);
  cy(g, M.dark, 0, sy, -0.1223, 0.0125, 0.1578);
  rb(g, M.dark, 0, sy, -0.1285, 0.029, 0.029, 0.042, 0.009);
  rb(g, M.metal, -0.0148, sy, -0.1285, 0.002, 0.012, 0.04, 0.005);
  cy(g, M.dark, 0, sy + 0.0211, -0.1304, 0.0115, 0.014, 0);
  cy(g, M.metal, 0, sy + 0.0262, -0.1304, 0.0118, 0.005, 0);
  cy(g, M.dark, 0, sy + 0.0294, -0.1304, 0.009, 0.0022, 0);
  cy(g, M.dark, 0.0211, sy, -0.1304, 0.0105, 0.014, 0, 0, Math.PI / 2);
  cy(g, M.metal, 0.0262, sy, -0.1304, 0.0108, 0.005, 0, 0, Math.PI / 2);
  cone(g, M.dark, 0, sy, -0.0374, 0.0125, 0.0185, 0.012);
  cy(g, M.dark, 0, sy, -0.0274, 0.0188, 0.008);
  for (const z of [-0.0302, -0.0274, -0.0246]) cy(g, M.rubber, 0, sy, z, 0.0191, 0.0012);
  cy(g, M.dark, 0, sy, 0.0037, 0.0205, 0.0542);
  scopeEnd(g, M, sy, 0.0388, 0.022, 0.0205, 1, 0.008);
  // chargeur droit, plaque de fond inclinée
  info.magHome.set(0, -0.0206, -0.1047);
  info.buildMag = (parent, ext) => {
    const yb = -0.033 - (ext - 1) * 0.06;
    prof(parent, M.dark, [[-0.0404, 0.012, 0.001], [-0.0404, yb, 0.004], [0.0404, yb - 0.0035, 0.004], [0.0404, 0.012, 0.001]], 0.03, 0, 0.003, 0.003);
    rb(parent, M.metal, 0, yb - 0.0012, 0, 0.032, 0.005, 0.084, 0.002, 0.043);
  };
  info.magAxis = new V3(0, -1, 0); info.magGrip = new V3(0, -0.02, 0);
  // pontet et détente, entre le chargeur et la poignée
  guard(g, M.dark, -0.052, 0.024, -0.005, -0.062, 0.005, 0.004, 0.01);
  rb(g, M.metal, 0, -0.028, -0.021, 0.006, 0.046, 0.006, 0.002, 0.18);
  info.gripR.set(0, -0.055, 0.075); info.gripL.set(0, 0.018, -0.25);
  info.sightY = sy; info.adsZ = 0.13;
  info.mount.muzzle = { x: 0, y: 0.044, z: tip, r: 0.011 };
  info.mount.under = { y: -0.0074, z: -0.345, len: 0.12 };
  info.muzzle.position.set(0, 0.044, c.A.muzzle ? tip - 0.01 : -0.845); info.eject.position.set(0.02, 0.05, -0.035);
  info.gripDef = {
    R: [{ c: [0, -0.058, 0.088], h: [0.02, 0.046, 0.027], r: 0.01, rx: -0.23 }, { c: [0, 0.01, 0.12], h: [0.025, 0.018, 0.035], r: 0.006 }, { c: [0, 0.03, -0.06], h: [0.025, 0.035, 0.15], r: 0.01 }],
    L: [{ c: [0, 0.0175, -0.29], h: [0.027, 0.025, 0.11], r: 0.005 }],
  };
  info.trigDef = { at: [0.004, -0.044, -0.033], xTip: -0.004, guard: [{ c: [0, -0.0595, -0.014], h: [0.005, 0.0025, 0.038], r: 0.002 }, { c: [0, -0.033, -0.0495], h: [0.0045, 0.028, 0.0025], r: 0.002 },
    { c: [0, -0.028, -0.021], h: [0.003, 0.023, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.038, -0.1047], h: [0.016, 0.018, 0.041], r: 0.004 }] };
});

/* ---------- M1014 (Benelli M4) : construit d'après une vue de profil, côté droit (P : 1,322 mm par pixel, longueur réelle 1010 mm ;
   la bouche est à droite de la photo, z croît vers la gauche). Boîtier noir à rail et fenêtre d'éjection (culasse et levier visibles),
   hausse « ghost ring » sur ses oreilles à l'arrière du rail, canon et tube magasin réunis par un collier à grenadière, guidon à
   oreilles, garde-mains à nervures autour du tube, crosse fixe à poignée pistolet (plaquettes rainurées), fente de bretelle, plaque
   de couche. La main droite du jeu tient la détente 10,8 cm devant sa prise (la vraie arme : 6,4 cm) : la crosse et la poignée (Q)
   reculent de D = 3,6 cm, le pontet s'allonge d'autant.
   Contrôle : node tools/dev/visual/contour.js --arme m1014 --photo <profil droit, 800 x 600> --mmpx 1.322 --cote droite
   --ancre 297,268,-0.0285,0.037 (avant ; l'arrière est décalé de D). ---------- */
defineGun('m1014', 'shotgun', (c) => {
  const { g, M, info } = c, B = M.polyM, D0 = M.dark, K = M.rubber, sx2 = [-1, 1], ext = c.A.mag === 'xmag' ? 0.04 : 0; // polymère à grain fin (la crosse est sous l'œil en visée) ; tube prolongé par le chargeur étendu
  const S = 0.001322, D = 0.0364, P = (x, y, r) => { const q = [-0.0285 - (x - 297) * S, 0.037 - (y - 268) * S]; if (r !== undefined) q.push(r); return q; };
  const Q = (x, y, r) => { const q = P(x, y, r); q[0] += D; return q; }, R = (x, y, r) => (x < 282 ? Q(x, y, r) : P(x, y, r));
  const Pz = (x) => P(x, 0)[0], Qz = (x) => Pz(x) + D, Py = (y) => P(0, y)[1];
  const by = Py(268), ty = Py(289.5), fine = (m, k = 2.5) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };

  // ----- boîtier : dessus qui descend vers la crosse, rail, fenêtre d'éjection (culasse chromée, levier) à droite -----
  fine(prof(g, D0, [P(425, 257, 0.003), P(425, 300, 0.002), P(320, 300, 0.002), P(282, 302, 0.002), Q(281, 302, 0.002), Q(262, 296, 0.004), Q(262, 262, 0.004), Q(280, 254, 0.004), P(300, 253, 0.004),
    P(330, 253, 0.002)], 0.032, 0, 0.003, 0.003), 6); // grain fin : le dessus est sous l'œil en visée
  rb(g, D0, 0, Py(251), (Pz(330) + Pz(423)) / 2, 0.02, 0.005, Pz(330) - Pz(423), 0.001);
  for (let x = 333; x < 420; x += 7.4) bx(g, D0, 0, Py(248), Pz(x + 1.8), 0.022, 0.003, 0.0045);
  rb(g, K, 0.0161, Py(271), (Pz(333) + Pz(420)) / 2, 0.0012, Py(262) - Py(281), Pz(333) - Pz(420), 0.0006);
  rb(g, M.steel, 0.0158, Py(271), (Pz(340) + Pz(410)) / 2, 0.002, Py(264) - Py(279), Pz(340) - Pz(410), 0.0008);
  { const q = P(398, 272); cy(g, M.steel, 0.024, q[1], q[0], 0.0028, 0.014, 0, 0, Math.PI / 2); part(g, new THREE.SphereGeometry(1, 8, 6), M.steel, 0.031, q[1], q[0], 0.0042, 0.0042, 0.0042); }
  // boîte de culasse vue de dessous : port de chargement (devant le pontet), bouton d'arrêtoir
  rb(g, K, 0, Py(300) - 0.0003, (Pz(330) + Pz(415)) / 2, 0.016, 0.0012, Pz(330) - Pz(415), 0.0005);
  cy(g, M.metal, 0.0164, Py(291), Pz(334), 0.0028, 0.002, 0, 0, Math.PI / 2);

  // ----- canon, tube magasin, collier à grenadière, garde-mains à nervures -----
  const tip = Pz(778);
  cz(g, M.metal, 0, by, (tip + Pz(420)) / 2, 0.0106, Pz(420) - tip);
  cz(g, K, 0, by, tip - 0.0001, 0.0076, 0.0006);
  const tEnd = Pz(742) - ext;
  cz(g, M.metal, 0, ty, (tEnd + Pz(420)) / 2, 0.0126, Pz(420) - tEnd);
  cz(g, D0, 0, ty, tEnd - 0.012, 0.0142, 0.024); cone(g, D0, 0, ty, tEnd - 0.0285, 0.0105, 0.0142, 0.009);
  if (ext) part(g, G_TOR, D0, 0, ty, Pz(742) + 0.002, 0.0131, 0.0131, 0.025); // raccord de la rallonge
  prof(g, D0, [P(616, 262, 0.004), P(650, 262, 0.004), P(650, 303, 0.004), P(616, 303, 0.004)], 0.03, 0, 0.003, 0.003);
  part(g, G_TOR, M.metal, 0, Py(312), Pz(628), 0.0085, 0.0095, 0.0085, 0, Math.PI / 2, 0);
  fine(prof(g, B, [P(487, 271, 0.006), P(606, 271, 0.006), P(613, 282, 0.004), P(612, 306, 0.006), P(600, 310, 0.004), P(495, 310, 0.004), P(486, 300, 0.006)], 0.046, 0, 0.008, 0.004));
  for (let x = 498; x < 600; x += 5.2) for (const sx of sx2) bx(g, K, sx * 0.0232, Py(298), Pz(x), 0.0012, Py(287) - Py(308), 0.0016);

  // ----- organes de visée (rien si une optique les remplace) : guidon à oreilles sur son collier, ghost ring sur ses oreilles -----
  // ligne de mire au sommet de la lame du guidon (y 243 sur la photo, 4 mm au-dessus de la cote relevée : à 1,2 mm du rail du boîtier,
  // la lame n'en dépassait que de 3 mm en visée, et ses oreilles, plus hautes, se lisaient à sa place ; elles s'arrêtent maintenant
  // sous sa pointe). L'œil est à 10,5 cm de l'anneau : trait fin et large ouverture (12 % de l'écran), sur un montant ; ailes minces
  // et peu profondes (leur flanc ne se voit plus)
  const SY = Py(243);
  info.sightY = SY; info.adsZ = Pz(289) + 0.105; // ghost ring : l'œil tout près de l'anneau
  if (!c.optic) {
    rb(g, D0, 0, Py(258), Pz(748), 0.016, 0.008, 0.02, 0.002);
    prof(g, M.sight, [P(744, 256), [Pz(745), SY, 0.0005], [Pz(751), SY, 0.0005], P(753, 256)], 0.0026, 0, 0.0004, 0.0006);
    for (const sx of sx2) prof(g, D0, [P(738, 258), P(741, 244.5, 0.001), P(752, 244.5, 0.001), P(758, 258)], 0.002, sx * 0.0068, 0.0005, 0.001);
    rb(g, D0, 0, Py(251.5), Pz(289), 0.026, 0.004, 0.02, 0.0015);
    ironFoot(c, D0, Pz(289), Py(250.5), ironRing(c, Pz(289), 0.12), 0.008);
    for (const sx of sx2) bx(g, D0, sx * 0.0125, (Py(253) + SY + 0.003) / 2, Pz(289), ironW(c, Pz(289), IRON.wing), SY + 0.003 - Py(253), 0.006);
  }

  // ----- pontet (allongé jusqu'à la poignée), détente -----
  prof(g, D0, [P(322, 300, 0.001), P(322, 316, 0.004), P(316, 322, 0.004), Q(285, 323, 0.004), Q(279, 318, 0.003), Q(279, 300, 0.001)], 0.008, 0, 0.0015, 0.002,
    [[P(318, 301, 0.001), P(318, 315, 0.003), P(314, 319, 0.003), Q(286, 320, 0.003), Q(282, 316, 0.002), Q(282, 301, 0.001)]]);
  prof(g, M.metal, [P(304, 300), P(302, 306, 0.003), P(296, 312, 0.004), P(290, 318, 0.002), P(293, 319, 0.001), P(299, 314, 0.004), P(305, 307, 0.003), P(308, 300)], 0.006, 0, 0.0012, 0.0015);

  // ----- crosse fixe et poignée pistolet (Q) -----
  fine(prof(g, B, [Q(281, 254, 0.002), Q(262, 262, 0.004), Q(240, 271, 0.01), Q(210, 280, 0.01), Q(150, 288, 0.01), Q(90, 296, 0.008), Q(40, 302, 0.006), Q(30, 304, 0.003), Q(30, 394, 0.003),
    Q(40, 395, 0.006), Q(100, 368, 0.01), Q(160, 340, 0.01), Q(200, 321, 0.008), Q(212, 316, 0.006), Q(232, 318, 0.006), Q(272, 303, 0.004), Q(281, 302, 0.002)], 0.042, 0, 0.005, 0.004), 6);
  fine(prof(g, B, [Q(272, 302, 0.002), Q(271, 324, 0.004), Q(267, 334, 0.008), Q(263, 344, 0.01), Q(258, 356, 0.01), Q(254, 370, 0.006), Q(256, 378, 0.004), Q(262, 384, 0.004),
    Q(258, 390, 0.003), Q(238, 389, 0.006), Q(214, 380, 0.004), Q(212, 372, 0.006), Q(218, 360, 0.01), Q(223, 348, 0.01), Q(228, 336, 0.008), Q(231, 324, 0.004), Q(226, 316, 0.002)], 0.031, 0, 0.004, 0.003));
  for (let k = 0; k < 10; k++) { const y = 334 + k * 5, xm = 244 - (y - 334) * 0.33, a = Q(xm - 10, y), b = Q(xm + 10, y); for (const sx of sx2) bx(g, K, sx * 0.0158, a[1], (a[0] + b[0]) / 2, 0.0012, 0.0014, Math.abs(b[0] - a[0])); }
  prof(g, K, [Q(14, 312, 0.004), Q(30, 304, 0.002), Q(30, 394, 0.002), Q(26, 398, 0.003), Q(14, 360, 0.006)], 0.044, 0, 0.004, 0.003);
  for (const sx of sx2) rb(g, K, sx * 0.0212, Py(331), (Qz(75) + Qz(100)) / 2, 0.0012, Py(318) - Py(345), Qz(75) - Qz(100), 0.002);

  // ----- cartouche (celle que la main gauche apporte au port de chargement) -----
  info.magHome.set(0, Py(300), Pz(372));
  info.buildMag = (parent) => { part(parent, G_CYL, SHELL_RED, 0, -0.012, 0, 0.011, 0.05, 0.011); part(parent, G_CYL, M.brass, 0, -0.045, 0, 0.0115, 0.02, 0.0115); };
  info.magGrip = new V3(0, -0.03, 0);
  info.tubeFed = true; info.mag.visible = false;

  // ----- mains, visée, montages -----
  info.butt = [0, Py(350), Qz(16)];
  info.gripR.set(0, Py(316), Qz(250)); info.gripL.set(0, ty, Pz(491));
  info.mount.optic = { y: Py(250), z: (Pz(333) + Pz(420)) / 2, len: Pz(333) - Pz(420), D: 0.2 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0106 };
  info.mount.side = { x: -0.0146, y: ty, z: Pz(690) };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(0.02, Py(271), (Pz(333) + Pz(420)) / 2);
  info.gripDef = {
    R: [{ c: [0, Py(350), Qz(242)], h: [0.0155, 0.048, 0.024], r: 0.01, rx: -0.33 }, { c: [0, Py(285), Pz(360)], h: [0.016, 0.022, 0.06], r: 0.006 }],
    L: [{ c: [0, Py(290.5), Pz(550)], h: [0.023, (310 - 271) / 2 * S, (Pz(487) - Pz(612)) / 2], r: 0.012 }],
  };
  info.trigDef = { at: [0.004, Py(314), Pz(305) - 0.0085], xTip: -0.004, guard: [] };
});

/* ---------- M9 (Beretta 92) : glissière ouverte sur le dessus (le canon s'y voit), nez plein et guidon à point blanc, cannelures
   arrière, leviers de sûreté-désarmeur ambidextres, hausse à deux points ; carcasse à cache-poussière lisse, chien à ergot, queue de
   castor, levier de démontage et arrêtoir de glissière à gauche, pontet rond à crochet, détente incurvée ; poignée large à plaquettes
   noires (vis, médaillon), dragonne, chargeur d'acier à talon. Cotes relevées sur une vue de profil (0,2 mm par pixel, hauteur réelle
   140 mm) ; la poignée garde la place et l'angle de celle des autres pistolets (mains, chargeur, rechargement), l'arrière de l'arme
   reculé d'autant (1,1 cm). ---------- */
defineGun('m9', 'pistol', (c) => {
  const { g, M, info } = c, D = M.blued, K = M.rubber, by = 0.0375, sx2 = [-1, 1], dotG = new THREE.SphereGeometry(1, 6, 4);
  // repère de la poignée (le même que celui des autres pistolets) : b vers l'arrière, d vers le bas, depuis son centre
  const G = (b, d, r) => { const q = [0.012 + b * 0.976 + d * 0.218, -0.05 + b * 0.218 - d * 0.976]; if (r !== undefined) q.push(r); return q; };

  // ----- glissière (recule au tir) : nez plein, flancs ouverts sur le dessus jusqu'à l'arrière plein -----
  const sl = new THREE.Group(); g.add(sl); info.slide = sl; info.slideTravel = 0.034;
  prof(sl, M.blued, [[-0.177, 0.0214, 0.002], [-0.177, 0.0445, 0.003], [-0.1589, 0.0445, 0.002], [-0.1565, 0.0355, 0.002], [-0.0604, 0.0355, 0.001], [-0.0604, 0.0445, 0.001],
    [0.025, 0.0445, 0.006], [0.028, 0.04, 0.003], [0.028, 0.0214, 0.002]], 0.03, 0, 0.003, 0.002);
  // cannelures arrière, leviers de sûreté-désarmeur (axe, point rouge dessous)
  for (let k = 0; k < 18; k++) for (const sx of sx2) bx(sl, K, sx * 0.0151, 0.0275, -0.0565 + k * 0.0029, 0.0012, 0.012, 0.0013);
  for (const sx of sx2) {
    prof(sl, D, [[0.001, 0.034, 0.004], [0.004, 0.0395, 0.003], [0.0135, 0.0445, 0.002], [0.016, 0.042, 0.002], [0.0105, 0.033, 0.004], [0.0055, 0.0295, 0.004]], 0.0022, sx * 0.0158, 0.0007, 0.003);
    cy(sl, D, sx * 0.0168, 0.0345, 0.0059, 0.0032, 0.0016, 0, 0, Math.PI / 2);
    part(sl, dotG, M.dot, sx * 0.0151, 0.0244, 0.0039, 0.0003, 0.0011, 0.0011);
  }
  // hausse à cran et deux points, guidon à point blanc (rien si une optique les remplace)
  if (!c.optic) {
    prof(sl, D, [[-0.0001, 0.0445, 0], [0.0025, 0.0468, 0.001], [0.0069, 0.0468, 0.0005], [0.0069, 0.0445, 0]], 0.019, 0, 0.0006, 0.001);
    for (const sx of sx2) {
      prof(sl, D, [[0.0012, 0.0465, 0], [0.0032, 0.0496, 0.0006], [0.0069, 0.0496, 0.0005], [0.0069, 0.0465, 0]], 0.0072, sx * 0.0058, 0.0005, 0.0006);
      part(sl, dotG, M.dotW, sx * 0.0058, 0.0483, 0.007, 0.001, 0.001, 0.0004);
    }
    prof(sl, D, [[-0.1755, 0.0442, 0], [-0.172, 0.0496, 0.001], [-0.1665, 0.0496, 0.0005], [-0.1665, 0.0442, 0]], 0.0035, 0, 0.0005, 0.0008);
    part(sl, dotG, M.dotW, 0, 0.0483, -0.1663, 0.0011, 0.0011, 0.0005);
  }

  // ----- canon fixe : visible dans l'ouverture de la glissière, couronne et âme devant le nez -----
  cz(g, M.metal, 0, by, -0.1225, 0.0066, 0.125);
  cz(g, K, 0, by, -0.1852, 0.0045, 0.0006);

  // ----- carcasse -----
  // cache-poussière lisse, dessous du pontet, queue de castor
  prof(g, D, [[-0.1764, 0.0214, 0.002], [0.029, 0.0214, 0.002], [0.037, 0.0165, 0.004], [0.0435, 0.0095, 0.002], [0.0405, 0.0065, 0.002], [0.034, 0.0033, 0.004],
    [0.026, -0.004, 0], [-0.03, -0.004, 0], [-0.096, 0.0074, 0.002], [-0.1609, 0.0074, 0.001], [-0.1609, 0.0094, 0.001], [-0.1764, 0.0094, 0.002]], 0.027, 0, 0.002, 0.002);
  // chien à ergot (percé), derrière la glissière
  prof(g, D, [[0.024, 0.02, 0], [0.024, 0.0385, 0.002], [0.0275, 0.0435, 0.002], [0.0335, 0.0425, 0.002], [0.034, 0.039, 0.002], [0.0305, 0.035, 0.003], [0.0305, 0.02, 0]], 0.009, 0, 0.0012, 0.002);
  cy(g, K, 0, 0.0395, 0.0295, 0.0018, 0.0094, 0, 0, Math.PI / 2);
  // levier de démontage et son bouton, arrêtoir de glissière (à gauche), axe de détente, bouton d'arrêtoir du chargeur
  prof(g, D, [[-0.0895, 0.018, 0.002], [-0.077, 0.018, 0.002], [-0.0755, 0.012, 0.003], [-0.08, 0.0065, 0.003], [-0.089, 0.0065, 0.002]], 0.002, -0.0142, 0.0006, 0.002);
  cy(g, D, -0.0148, 0.0068, -0.0855, 0.0025, 0.0024, 0, 0, Math.PI / 2);
  prof(g, D, [[-0.0634, 0.0194, 0.002], [-0.0142, 0.0194, 0.002], [-0.0142, 0.0165, 0.001], [-0.051, 0.0165, 0.002], [-0.053, 0.0094, 0.003], [-0.0634, 0.0094, 0.003]], 0.002, -0.0145, 0.0006, 0.002);
  cy(g, D, 0, 0.0053, -0.0594, 0.0022, 0.0282, 0, 0, Math.PI / 2);
  cy(g, D, -0.0152, -0.0214, -0.0172, 0.0045, 0.004, 0, 0, Math.PI / 2);
  // pontet rond et son crochet strié, détente incurvée
  guard(g, D, -0.096, -0.024, 0.0074, -0.0312, 0.0048, 0.004, 0.008);
  rb(g, D, 0, -0.0215, -0.0972, 0.007, 0.013, 0.004, 0.0015, -0.2);
  for (let k = 0; k < 4; k++) { const ly = 0.004 - k * 0.003; bx(g, K, 0, -0.022 + 0.98 * ly, -0.09955 - 0.1987 * ly, 0.0072, 0.0008, 0.0012, -0.2); } // stries sur la face avant inclinée du crochet
  prof(g, D, [[-0.0625, 0.003], [-0.0605, -0.006, 0.006], [-0.0645, -0.017, 0.008], [-0.0715, -0.0245, 0.001], [-0.0705, -0.0255, 0.001], [-0.0655, -0.0215, 0.006],
    [-0.0575, -0.01, 0.006], [-0.0565, 0.003]], 0.0055, 0, 0.0012, 0.0015);
  // poignée : carcasse (devant droit, dos bombé), plaquettes noires qui dépassent des flancs, vis et médaillon, dragonne
  prof(g, D, [G(-0.032, -0.062), G(-0.03, 0.038, 0.003), G(0.025, 0.038, 0.004), G(0.028, 0.02, 0.008), G(0.029, 0.0, 0.01), G(0.027, -0.03, 0.008), G(0.022, -0.05, 0.004), G(0.02, -0.062)], 0.028, 0, 0.003, 0.003);
  prof(g, M.grip, [G(-0.012, -0.06, 0.003), G(-0.026, -0.052, 0.004), G(-0.024, 0.032, 0.004), G(0.02, 0.032, 0.004), G(0.022, 0.0, 0.006), G(0.018, -0.045, 0.006), G(0.012, -0.058, 0.004)], 0.036, 0, 0.003, 0.003);
  for (const [b, d] of [[-0.004, -0.05], [0.0, 0.022]]) { const q = G(b, d); cy(g, M.metal, 0, q[1], q[0], 0.0028, 0.0372, 0, 0, Math.PI / 2); }
  { const q = G(-0.002, -0.022); cy(g, D, 0, q[1], q[0], 0.0068, 0.0366, 0, 0, Math.PI / 2); }
  { const q = G(0.024, 0.04); part(g, RING_REAR, M.metal, 0, q[1], q[0], 0.7, 0.7, 0.7, 0, Math.PI / 2, 0); }

  // ----- chargeur : corps d'acier dans la poignée (trous témoins au dos), talon noir dessous ; étendu : plus long -----
  const mw = 0.024, mh = 0.098, md = 0.04, c0 = G(0, -0.008);
  info.magHome.set(0, 0, 0);
  info.buildMag = (parent, ext) => {
    const ex = (ext - 1) * 0.1, t = new THREE.Group(); t.position.set(0, c0[1], c0[0]); t.rotation.x = -0.22; parent.add(t);
    rb(t, M.metal, 0, -ex / 2, 0.0, mw, mh + ex, md, 0.003);
    for (let k = 0; k < 4; k++) part(t, dotG, M.dotW, 0.0, -0.01 - k * 0.011 - ex / 2, md / 2 + 0.0008, 0.0012, 0.0012, 0.0004);
    rb(t, D, 0, -mh / 2 - 0.006 - ex, -0.002, mw + 0.009, 0.012, md + 0.006, 0.003);
  };
  info.magAxis = new V3(0, -0.976, 0.218); info.magGrip = new V3(0, -0.092, 0.018);
  info.gripR.set(0, -0.05, 0.015); info.gripL.set(-0.02, -0.06, 0.005);

  // ----- visée, montages, bouche, éjection -----
  info.sightY = 0.0496; info.adsZ = 0.41 + 0.0069; // ligne de mire au sommet du guidon et des oreilles de la hausse, l'œil à 41 cm d'elle
  info.mount.optic = { y: 0.0445, z: -0.018, len: 0.08, D: 0.4, slide: sl }; // sur le dessus plein, derrière l'ouverture
  info.mount.muzzle = { x: 0, y: by, z: -0.185, r: 0.0066 };
  info.mount.side = { x: 0, y: 0.0092, z: -0.13, under: true }; // pointeur laser sous le cache-poussière (son dessus 2 mm sous y)
  info.muzzle.position.set(0, by, -0.1855); info.eject.position.set(0.012, 0.045, -0.04);
  // formes de prise des mains : poignée (son angle), carcasse, glissière, pontet
  const gc = G(-0.0025, -0.012);
  info.gripDef = {
    R: [{ c: [0, gc[1], gc[0]], h: [0.018, 0.05, 0.0295], r: 0.008, rx: -0.22 }, { c: [0, 0.0144, -0.13], h: [0.0135, 0.007, 0.047], r: 0.003 }, { c: [0, 0.01, 0.012], h: [0.0135, 0.012, 0.025], r: 0.005 },
      { c: [0, 0.033, -0.074], h: [0.015, 0.0116, 0.1025], r: 0.003 }, { c: [0, -0.0288, -0.06], h: [0.004, 0.0025, 0.036], r: 0.002 }, { c: [0, -0.012, -0.0935], h: [0.004, 0.019, 0.0025], r: 0.002 }],
  };
  info.gripDef.L = info.gripDef.R;
  info.trigDef = { at: [0.004, -0.011, -0.073], xTip: -0.003, guard: [{ c: [0, -0.011, -0.064], h: [0.00275, 0.013, 0.0025], r: 0.0015, rx: 0.4 }] };
});
