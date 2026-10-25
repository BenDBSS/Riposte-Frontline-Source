/* ==========================================================================
   MODÈLES D'ARMES, FUSILS À POMPE : Remington 870, AA-12
   Même contexte que 06k-modeles-base.js. Le 870 est un fusil à pompe : son garde-main coulissant (info.pump) recule à chaque
   coup (06-weapons.js, action « pump »). L'AA-12 est une arme automatique à chargeur boîte, ou à tambour avec le chargeur
   étendu.
   ========================================================================== */

/* ---------- Remington 870 (Express, tube à sept cartouches) : construit d'après une vue de profil, côté droit (P : 1,15 mm par pixel,
   longueur réelle 978 mm ; la bouche est à droite de la photo, z croît vers la gauche). Boîtier plat noir (fenêtre d'éjection, culasse
   visible, goupilles), canon nu à bille sur une bague de bouche, tube magasin prolongé jusqu'à la bouche (collier, bouchon, anneau de
   grenadière), garde-main coulissant à nervures et ses barres d'armement, pontet et détente ; crosse droite en polymère (poignée à
   plaquette grenue, busc, plaque de couche, grenadière), plus large au talon qu'au poignet. La poignée de la crosse est assez loin de
   la détente pour la main du jeu : la crosse reste à sa place. Le garde-main recule de Df = 2,2 cm (le bras d'appui serait sinon
   presque tendu) et garde sa course de pompe devant le boîtier. Avec un silencieux, la bille monte sur une rehausse pour le dominer.
   Contrôle : node tools/dev/visual/contour.js --arme rem870 --photo <profil droit, 1024 x 768> --mmpx 1.15 --cote droite
   --ancre 393,361,-0.0315,0.04 ---------- */
defineGun('rem870', 'shotgun', (c) => {
  const { g, M, info } = c, B = M.polyM, D0 = M.dark, K = M.rubber, sx2 = [-1, 1], ext = c.A.mag === 'xmag' ? 0.05 : 0; // tube prolongé par le chargeur étendu
  const S = 0.00115, P = (x, y, r) => { const q = [-0.0315 - (x - 393) * S, 0.04 - (y - 361) * S]; if (r !== undefined) q.push(r); return q; };
  const Pz = (x) => P(x, 0)[0], Py = (y) => P(0, y)[1], mid = (a, b) => (Pz(a) + Pz(b)) / 2, len = (a, b) => Math.abs(Pz(a) - Pz(b));
  const by = Py(361.5), ty = Py(389.5), RT = Py(348.5);
  const Df = 0.022, F = (x, y, r) => { const q = P(x, y, r); q[0] += Df; return q; }, Fz = (x) => Pz(x) + Df; // garde-main reculé (bras d'appui moins tendu)
  const fine = (m, k = 2.5) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };
  // crosse plus étroite vers le poignet : largeur multipliée par k1 de z0 (talon) à z1 (boîtier)
  const taper = (m, z0, z1, k1) => {
    m.geometry = m.geometry.clone(); const p = m.geometry.attributes.position, n = m.geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const t = Math.min(1, Math.max(0, (p.getZ(i) - z0) / (z1 - z0))), s = 1 + (k1 - 1) * t;
      p.setX(i, p.getX(i) * s); const nx = n.getX(i) / s, ny = n.getY(i), nz = n.getZ(i), l = hyp3(nx, ny, nz); n.setXYZ(i, nx / l, ny / l, nz / l);
    }
    return m;
  };

  // ----- boîtier : dessus plat, arrière arrondi vers la crosse ; fenêtre d'éjection (culasse), goupilles, port de chargement dessous -----
  fine(prof(g, D0, [P(370, 401, 0.001), P(368, 362, 0.004), P(380, 353, 0.01), P(398, 348.5, 0.006), P(540, 348.5, 0.002), P(541, 401, 0.001)], 0.031, 0, 0.003, 0.003), 6); // grain fin : le dessus est sous l'œil en visée
  prof(g, K, [P(461, 352), P(528, 352), P(528, 374), P(461, 374)], 0.0012, 0.0157, 0.0004, 0.0126);
  prof(g, M.metal, [P(464, 355), P(525, 355), P(525, 371), P(464, 371)], 0.0012, 0.0162, 0.0004, 0.009);
  cy(g, M.steel, 0.0166, Py(363), Pz(521), 0.0012, 0.0012, 0, 0, Math.PI / 2);
  for (const x of [383, 430]) cy(g, M.metal, 0, Py(387.5), Pz(x), 0.0026, 0.0322, 0, 0, Math.PI / 2);
  rb(g, K, 0, Py(401) + 0.0003, mid(455, 536), 0.021, 0.0012, len(455, 536), 0.0005);

  // ----- canon (léger cône), bague de bouche et âme ; bille sur sa rampe (rehaussée avec le silencieux) -----
  const tip = Pz(936);
  cone(g, M.metal, 0, by, mid(540, 914), 0.0106, 0.0115, len(540, 914));
  cz(g, M.metal, 0, by, mid(914, 936), 0.0121, len(914, 936));
  cz(g, K, 0, by, tip - 0.0001, 0.0092, 0.0006);
  const riser = c.A.muzzle === 'sil', BY = riser ? by + 0.025 : RT + 0.0024; // centre de la bille : 2,4 mm au-dessus du boîtier, ou au-dessus du silencieux
  if (!c.optic) {
    const bt = by + 0.0115, bb = BY - 0.0022;
    prof(g, D0, [[Pz(916), bt - 0.001], [Pz(920), bb, 0.001], [Pz(928), bb, 0.001], [Pz(933), bt - 0.001]], 0.004, 0, 0.0006, 0.0008);
    part(g, new THREE.SphereGeometry(1, 10, 8), M.dotW, 0, BY, Pz(924), 0.003, 0.003, 0.003); // bille blanche de 6 mm
  } else rail(g, M, 0, RT + 0.003, mid(400, 535), len(400, 535));

  // ----- tube magasin jusqu'à la bouche : collier sous le canon, bouchon, anneau de grenadière -----
  const tz = Pz(873) - ext;
  cz(g, M.metal, 0, ty, (Pz(540) + tz) / 2, 0.0118, Pz(540) - tz);
  prof(g, D0, [[tz + 0.0005, Py(369)], [tz - len(872, 889), Py(369)], [tz - len(872, 889), Py(402)], [tz + 0.0005, Py(402)]], 0.026, 0, 0.004, 0.004);
  cz(g, D0, 0, ty, tz - len(872, 896) + len(889, 896) / 2, 0.0122, len(889, 896));
  cone(g, D0, 0, ty, tz - len(872, 898.5), 0.0075, 0.0122, len(896, 901));
  part(g, G_TOR, M.metal, 0, ty, tz - len(872, 906), 0.0053, 0.0053, 0.0053, 0, Math.PI / 2, 0);

  // ----- garde-main coulissant (info.pump : recule à chaque coup) : polymère à nervures, barres d'armement jusque dans le boîtier -----
  const pg = new THREE.Group(); g.add(pg); info.pump = pg;
  fine(prof(pg, B, [F(629, 369.5, 0.002), F(776, 369.5, 0.004), F(781.5, 378, 0.006), F(781.5, 402, 0.006), F(776, 408.5, 0.004), F(634, 408.5, 0.004), F(629, 402, 0.003)], 0.046, 0, 0.006, 0.004));
  for (let x = 651; x < 763; x += 4.6) for (const sx of sx2) bx(pg, K, sx * 0.0232, Py(396), Fz(x), 0.0012, Py(385) - Py(407), 0.0016);
  for (const sx of sx2) bx(pg, M.metal, sx * 0.0105, Py(376), mid(529, 640) + Df, 0.0025, 0.005, len(529, 640));

  // ----- pontet et plaque de détente, sûreté transversale, détente -----
  // pontet : arrière arrondi, ouverture ronde, avant plein qui remonte en biais jusqu'au port de chargement
  prof(g, D0, [P(367, 399.5), P(462, 399.5), P(462, 402), P(367, 402)], 0.024, 0, 0.002, 0.002);
  prof(g, D0, [P(367, 400, 0.001), P(372, 406, 0.003), P(374, 414, 0.004), P(379, 420.5, 0.004), P(387, 425.5, 0.005), P(410, 426, 0.005), P(421, 423, 0.004), P(443, 412, 0.004), P(452, 405, 0.004),
    P(461, 400, 0.001)], 0.009, 0, 0.002, 0.002, [[P(385, 401.5, 0.002), P(385, 417, 0.004), P(390, 421, 0.004), P(411, 421.5, 0.004), P(418, 419, 0.003), P(421.5, 413, 0.003), P(421.5, 401.5, 0.002)]]);
  cy(g, D0, 0, Py(405), Pz(378), 0.0028, 0.027, 0, 0, Math.PI / 2);
  prof(g, M.metal, [P(390.5, 401), P(394.5, 401), P(394, 406, 0.003), P(392, 412, 0.003), P(389.5, 417.5, 0.002), P(387.5, 419.5, 0.001), P(386.5, 418, 0.001), P(388, 412, 0.003), P(390, 406, 0.003)], 0.006, 0, 0.0012, 0.0015);

  // ----- crosse : busc, poignée à plaquette grenue, talon ; plaque de couche, grenadière -----
  const z0 = Pz(250), z1 = Pz(365), kw = 0.79;
  taper(fine(prof(g, B, [P(374, 401, 0.002), P(360, 402, 0.006), P(350, 404, 0.008), P(340, 409, 0.01), P(330, 415, 0.01), P(320, 425, 0.01), P(310, 440, 0.008), P(304, 452, 0.004), P(300, 455.5, 0.004),
    P(290, 454, 0.006), P(275, 450, 0.006), P(262, 443.5, 0.004), P(240, 448, 0.01), P(200, 464, 0.02), P(150, 486, 0.02), P(109, 502.5, 0.002), P(100, 389.5, 0.002), P(150, 387, 0.03),
    P(270, 377, 0.008), P(282, 378.5, 0.006), P(295, 383, 0.008), P(310, 382, 0.01), P(330, 373, 0.02), P(350, 364, 0.01), P(371, 357.5, 0.003)], 0.042, 0, 0.006, 0.004), 6), z0, z1, kw);
  taper(prof(g, M.grip, [P(247, 430), P(265, 401), P(300, 389), P(345, 384), P(352, 389), P(340, 402), P(312, 427), P(300, 445), P(290, 445), P(270, 440), P(255, 435)], 0.0432, 0, 0.0004, 0.006), z0, z1, kw);
  prof(g, K, [P(82, 391, 0.003), P(101, 389.5, 0), P(110, 502.5, 0), P(91, 507.5, 0.003)], 0.044, 0, 0.005, 0.003);
  cy(g, M.metal, 0, Py(488.5), Pz(152), 0.0026, 0.007, 0);

  // ----- cartouche (celle que la main gauche apporte au port de chargement) -----
  info.magHome.set(0, Py(400), Pz(500));
  info.buildMag = (parent) => { part(parent, G_CYL, SHELL_RED, 0, -0.012, 0, 0.011, 0.05, 0.011); part(parent, G_CYL, M.brass, 0, -0.045, 0, 0.0115, 0.02, 0.0115); };
  info.magGrip = new V3(0, -0.03, 0);
  info.tubeFed = true; info.mag.visible = false;

  // ----- mains, visée, montages -----
  const at = [0.004, Py(411), Pz(392.5) - 0.0085];
  info.butt = [0, Py(449), Pz(86)];
  info.gripR.set(0, at[1] - 0.0005, at[2] + 0.1155); info.gripL.set(0, Py(389), Fz(660));
  info.sightY = BY; info.adsZ = 0.125; // la joue sur le busc, l'œil au ras du boîtier vers la bille
  info.mount.optic = { y: RT + 0.007, z: mid(400, 535), len: len(400, 535), D: 0.2 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0106 };
  info.mount.side = { x: -0.0138, y: ty, z: Pz(830) };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(0.02, Py(363), mid(461, 528));
  info.gripDef = {
    R: [{ c: [0, Py(418), Pz(318)], h: [0.017, 0.036, 0.019], r: 0.012, rx: -0.9 }, { c: [0, Py(375), Pz(440)], h: [0.0155, 0.026, 0.07], r: 0.006 }],
    L: [{ c: [0, Py(389), mid(629, 781.5) + Df], h: [0.023, (408.5 - 369.5) / 2 * S, len(629, 781.5) / 2], r: 0.012 }],
  };
  info.trigDef = { at, xTip: -0.004, guard: [] };
});

/* ---------- AA-12 (Atchisson Assault Shotgun d'origine) : construit d'après une vue de profil, côté gauche (P : 1,139 mm par pixel,
   longueur réelle 991 mm ; la bouche est à gauche de la photo). Corps noir d'une seule pièce, du boîtier à la crosse droite (plaquette
   grenue sur l'avant, plaque de couche à bec), canon nu sorti d'une plaque de front (écrou, anneau de grenadière), guidon en lame et
   hausse à œilleton repliables, très hauts, levier d'armement en aileron ; chargeur droit à une rangée (tambour avec le chargeur
   étendu, monté en travers), détente sous le corps dans un pontet plein (l'arceau en fil d'acier de l'original n'est pas repris). La main
   droite du jeu tient la détente 11,5 cm devant sa prise (la vraie arme : 5,6 cm) : la poignée, la crosse et la hausse (Q) reculent
   de D = 5,8 cm, le dessous du corps et le pontet s'allongent d'autant.
   Contrôle : node tools/dev/visual/contour.js --arme aa12 --photo <profil gauche, 1000 x 436> --mmpx 1.139 --ancre 598,189,-0.0375,0.02
   (avant ; l'arrière est décalé de D). ---------- */
defineGun('aa12', 'rifle', (c) => {
  const { g, M, info } = c, drum = c.A.mag === 'xmag', B = M.polyM, D0 = M.dark, K = M.rubber, ST = M.steel;
  const S = 0.001139, D = 0.058, P = (x, y, r) => { const q = [-0.0375 + (x - 598) * S, 0.02 - (y - 189) * S]; if (r !== undefined) q.push(r); return q; };
  const Q = (x, y, r) => { const q = P(x, y, r); q[0] += D; return q; };
  const Pz = (x) => P(x, 0)[0], Qz = (x) => Pz(x) + D, Py = (y) => P(0, y)[1], mid = (a, b) => (Pz(a) + Pz(b)) / 2, len = (a, b) => Math.abs(Pz(a) - Pz(b));
  const by = Py(189), W = 0.046;
  const fine = (m, k = 2.5) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };

  // ----- corps d'une pièce : boîtier, dessous de la détente (allongé de D), crosse à plaque de couche à bec -----
  fine(prof(g, B, [P(222, 142.5, 0.003), P(330, 141.5, 0.03), P(430, 137.5, 0.03), P(610, 137.5, 0), Q(612, 137.5, 0), Q(880, 138.5, 0.006), Q(892, 138.5, 0.002), Q(895, 131, 0.003),
    Q(903, 130, 0.003), Q(908, 138, 0.003), Q(915, 148, 0.006), Q(918, 258, 0.006), Q(912, 265.5, 0.004), Q(900, 264, 0.01), Q(800, 240, 0.02), Q(700, 216.5, 0.01), Q(688, 215.5, 0.008),
    Q(672, 219, 0.008), Q(664, 228, 0.006), Q(661, 240, 0.002), Q(612, 240, 0), P(610, 240, 0), P(556, 240, 0.002), P(552, 236, 0.001), P(552, 219, 0.001), P(490, 219, 0.001), P(480, 219.5, 0.004),
    P(400, 215, 0.03), P(300, 209.5, 0.02), P(222, 206.5, 0.004)], W, 0, 0.005, 0.004), 3);
  prof(g, M.grip, [P(270, 155), P(438, 155), P(438, 199), P(270, 199)], W + 0.0012, 0, 0.0004, 0.006); // plaquette grenue de la main d'appui
  // fenêtre d'éjection à droite, au-dessus du puits de chargeur (culasse)
  prof(g, K, [P(488, 150), P(545, 150), P(545, 172), P(488, 172)], 0.0012, W / 2 - 0.0002, 0.0004, 0.003);
  prof(g, M.metal, [P(491, 153), P(542, 153), P(542, 169), P(491, 169)], 0.0012, W / 2 + 0.0003, 0.0004, 0.002);
  // levier d'armement en aileron sur le dessus ; avec une optique, rabattu vers l'arrière (1,2 cm au lieu de 3) : debout, devant le rail, il
  // entrait dans la fenêtre de toutes les optiques
  prof(g, ST, c.optic ? [P(436, 138.5), P(437, 131, 0.002), P(441, 127.5, 0.002), P(446, 128.5, 0.002), P(470, 137, 0.002), P(470, 138.5)]
    : [P(436, 138.5), P(436, 118, 0.002), P(439, 111, 0.002), P(444, 113, 0.002), P(466, 136, 0.002), P(466, 138.5)], 0.004, 0, 0.0008, 0.002);

  // ----- plaque de front, écrou, anneau de grenadière ; canon nu -----
  prof(g, M.metal, [P(219, 143.5), P(223.5, 143.5), P(223.5, 206), P(219, 206)], W - 0.002, 0, 0.002, 0.002);
  cy(g, ST, 0, Py(173), Pz(232), 0.0065, W + 0.004, 0, 0, Math.PI / 2);
  cone(g, ST, 0, Py(160.5), mid(207, 220), 0.0008, 0.005, len(207, 220));
  const tip = Pz(48);
  cz(g, M.metal, 0, by, mid(48, 220), 0.0114, len(48, 220));
  cz(g, K, 0, by, tip - 0.0001, 0.0092, 0.0006);

  // ----- organes de visée (rien si une optique les remplace) : guidon en lame sur la plaque de front, hausse à œilleton à l'arrière
  // sur son montant et sa jambe de force, très hauts ; œilleton fin, montant et jambe de force minces, arrêtés au trait de l'anneau
  // (traits en fraction de l'écran, 06jb-formes.js) -----
  const SY = Py(87.5), zr = Qz(648); // ligne de mire à la pointe du guidon
  info.sightY = SY; info.adsZ = zr + 0.19;
  if (!c.optic) {
    const V = M.blued; // acier bruni lisse : sombre sur le ciel et sans grain, vu de près en visée
    prof(g, M.sight, [P(222, 143.5, 0), P(222.5, 92, 0.001), P(226, 87.5, 0.002), P(229.5, 89, 0.001), P(241, 143.5, 0)], 0.0026, 0, 0.0004, 0.001,
      [[P(226.5, 94, 0.001), P(229, 94, 0.001), P(229, 112, 0.001), P(226.5, 112, 0.001)]]);
    cy(g, V, 0, Py(124), Pz(236.5), 0.003, 0.006, 0, 0, Math.PI / 2);
    rb(g, V, 0, Py(136.5), (Qz(637) + Qz(690)) / 2, 0.012, 0.0045, len(637, 690), 0.0012);
    const yb = ironRing(c, zr, IRON.hole.rifle), w = ironW(c, zr, IRON.wing);
    prof(g, V, [Q(640, 138), [Qz(640), yb - 0.0008], [Qz(644), yb - 0.0008], Q(644, 138)], w, 0, w * 0.3, 0.001); // plus loin que l'anneau : un peu plus bas pour ne pas paraître dans son ouverture
    prof(g, V, [[Qz(648), yb], [Qz(652), yb], Q(684, 136), Q(678, 137)], w, 0, w * 0.3, 0.001);
  } else rail(g, M, 0, Py(137.5) + 0.003, mid(480, 610), len(480, 610));

  // ----- détente et pontet plein, de l'arrière du puits de chargeur à l'avant de la poignée (allongé de D) -----
  prof(g, ST, [P(600, 239), P(608, 239), P(604.5, 248, 0.003), P(605, 255, 0.003), P(608, 261, 0.001), P(606.5, 264, 0.001), P(601, 259, 0.003), P(597.5, 250, 0.003)], 0.006, 0, 0.0012, 0.0015);
  guard(g, D0, Pz(575), Qz(624), Py(238), Py(273), 0.006, 2 * S, 0.01);

  // ----- poignée pistolet (Q) et sa plaquette grenue -----
  prof(g, B, [Q(611, 236, 0.002), Q(661, 236, 0.002), Q(664, 250, 0.006), Q(670, 268, 0.01), Q(680, 290, 0.01), Q(690, 312, 0.008), Q(695, 330, 0.006), Q(692, 338, 0.004), Q(672, 342, 0.006),
    Q(652, 343.5, 0.004), Q(650, 333, 0.006), Q(645, 315, 0.01), Q(636, 293, 0.01), Q(626, 276, 0.008), Q(616, 262, 0.004), Q(612, 252, 0.002)], 0.03, 0, 0.004, 0.003);
  prof(g, M.grip, [Q(628, 266), Q(652, 262), Q(668, 282), Q(684, 312), Q(688, 333), Q(662, 336), Q(652, 316), Q(640, 290)], 0.0312, 0, 0.0004, 0.004);

  // ----- chargeur droit, un peu incliné vers l'avant (tambour avec le chargeur étendu) -----
  const tilt = 0.053;
  info.magHome.set(0, Py(214), mid(486, 552));
  info.buildMag = (parent, ext) => {
    if (ext > 1) {
      rb(parent, M.dark, 0, -0.008, 0, 0.034, 0.02, 0.06, 0.003);
      // tambour en travers : sa face ronde regarde vers l'avant et vers le tireur, son épaisseur dans l'axe du canon
      cy(parent, M.dark, 0, -0.08, 0, 0.075, 0.055); cy(parent, M.metal, 0, -0.08, 0, 0.05, 0.058);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; rb(parent, M.dark, Math.cos(a) * 0.072, -0.08 + Math.sin(a) * 0.072, 0, 0.01, 0.012, 0.058, 0.002, 0, 0, a); }
      return;
    }
    const t = new THREE.Group(); t.rotation.x = tilt; parent.add(t);
    const hm = (399 - 214) * S, dm = (552 - 488) * S;
    rb(t, M.metal, 0, -hm / 2, 0, 0.036, hm, dm, 0.003);
    for (const sx of [-1, 1]) rb(t, M.dark, sx * 0.018, -hm / 2 - 0.01, 0, 0.0012, hm - 0.05, dm - 0.024, 0.0005); // nervures des flancs
    rb(t, M.dark, 0, -hm - 0.002, -0.002, 0.039, 0.005, dm + 0.004, 0.0015);
  };
  info.magAxis = new V3(0, -Math.cos(tilt), -Math.sin(tilt)); info.magGrip = new V3(0, drum ? -0.08 : -0.1, drum ? 0 : -0.005);

  // ----- mains, visée, montages -----
  const at = [0.004, Py(252), Pz(597.8) - 0.0085];
  info.butt = [0, Py(201), Qz(915)];
  info.gripR.set(0, at[1] - 0.0005, at[2] + 0.1155); info.gripL.set(0, Py(190), Pz(390));
  info.mount.optic = { y: Py(137.5) + 0.007, z: mid(480, 610), len: len(480, 610), D: 0.22 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0114 };
  if (c.A.under) rail(g, M, 0, Py(214) + 0.0006, mid(330, 440), len(330, 440)); // assez près pour que le soldat vu de loin tienne la poignée
  info.mount.under = { y: Py(214) - 0.0034, z: mid(330, 440), len: len(330, 440) };
  if (c.A.side) rail(g, M, -(W / 2 + 0.0016), Py(176), Pz(300), 0.07, true);
  info.mount.side = { x: -(W / 2 + 0.0056), y: Py(176), z: Pz(300) };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(0.03, Py(161), mid(488, 545));
  info.gripDef = {
    R: [{ c: [0, Py(292), Qz(660)], h: [0.0155, 0.048, 0.022], r: 0.01, rx: -0.44 }, { c: [0, Py(215), Pz(590)], h: [0.023, 0.025, 0.06], r: 0.006 }],
    L: [{ c: [0, Py(176), mid(280, 440)], h: [W / 2, (212 - 140) / 2 * S, len(280, 440) / 2], r: 0.006 }],
  };
  info.trigDef = { at, xTip: -0.004, guard: [] };
});
