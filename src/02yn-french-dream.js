/* ==========================================================================
   FRENCH DREAM : un lotissement pavillonnaire de province, toutes les maisons pareilles, la voiture garée devant, les volets roulants
   baissés. Petite carte de combat rapproché (dans l'esprit de Nuketown), 72 x 83 m, en miroir nord-sud : Alpha au nord (+z), Bravo au sud.
   Plan validé par le propriétaire (tools/dev/visual/esquisses/french-dream-a.js) :
   - au milieu, la rue des Mésanges, d'ouest en est, qui finit en raquette de retournement ; le camion de déménagement au centre (point B)
     coupe la vue d'une maison témoin à l'autre ;
   - de part et d'autre, une rangée de lots identiques : jardin de devant, pavillon et garage accolé, jardin de derrière fermé de thuyas ;
     derrière, la coulée verte où l'on apparaît ;
   - OUEST « Chantier » : le lot 12, une maison en construction (murs de parpaings, plancher de l'étage coulé, escalier brut), le poste en
     hauteur de l'ouest ;
   - CENTRE « Maison témoin » : le seul pavillon ouvert de chaque rangée, meublé, éclairé : garage ouvert, porte d'entrée, baie vitrée sur
     le jardin, et à l'étage la chambre sur la rue ;
   - EST « Raquette » : le rond de retournement, son îlot et son érable, les conteneurs de tri, le transformateur, la sente piétonne.
   Construite, la carte a été resserrée pour tenir les seuils du combat rapproché (README, « Règles de conception d'une carte ») : thuyas
   entre les jardins de devant, écluses et voitures à cheval sur le trottoir dans la rue, massifs et touffes d'arbustes dans la coulée verte ;
   les garages du n° 10, du n° 6 et de la maison témoin portent un toit-terrasse (escaliers extérieurs pour les deux premiers), le plancher
   du chantier couvre toute la maison : les postes en hauteur font 5 % du réseau.
   Points A et C dans le jardin du n° 10, à côté de la piscine hors-sol (rapprochés des bases à la demande du propriétaire), B devant le
   camion.
   Les deux moitiés se distinguent : ardoise et crépi crème au nord (Alpha), tuiles mécaniques et crépi saumon au sud (Bravo) ; au loin, la
   ligne à haute tension au nord, le château d'eau au sud. Les tirages sont reproductibles (graines fixes).
   ========================================================================== */
const FDL = { splat: null, R: null };
const FD_H = 5.3, FD_F1 = 2.6; // égout des pavillons, plancher de l'étage de la maison témoin

/* ---------- Plan ---------- */
function frenchDreamLevel() {
  FDL.R = rngOf(5101);
  fdStreet();
  for (const s of [1, -1]) { fdChantier(s); fdNo10(s); fdTemoin(s); fdNo6(s); fdSente(s); fdGardens(s); fdCoulee(s); }
  fdPerimeter();
  fdBackdrop();
  fdGround();
}
/* Repères d'une moitié : z de la moitié Alpha recopié au sud ; intervalle trié ; façade sur la rue et façade sur le jardin */
const fdZ = (s) => (z) => z * s;
const fdZr = (s) => (a, b) => [a * s, b * s].sort((p, q) => p - q);
const fdFront = (s) => (s > 0 ? 'n' : 's');

/* ---------- La rue et la raquette ---------- */
function fdStreet() {
  const M = DECOR, R = FDL.R;
  // le camion de déménagement au milieu de la rue (cabine à l'ouest, hayon à l'est) ; le canapé et les cartons déchargés derrière lui
  vehicle(PF.truck('box'), 2, 0, 0, Math.PI / 2, { tint: [0.95, 0.95, 0.94] }); glassWall(-1.84, 5.64, 2.76, 10, -1.22, 1.22); // on ne tient pas sur le camion (du toit d'un monospace, on s'y hissait)
  M.place(PF.fdSofa([0.46, 0.45, 0.44]), 7.3, 0, 0, Math.PI / 2);
  for (const [x, z, y, w, h, d, r] of [[6.0, 1.35, 0, 0.6, 0.45, 0.45, 0.1], [6.05, 1.3, 0.45, 0.5, 0.4, 0.4, -0.2], [6.0, -1.35, 0, 0.6, 0.45, 0.45, -0.1], [8.4, 1.0, 0, 0.5, 0.4, 0.4, 0.4], [8.5, -1.1, 0, 0.5, 0.4, 0.4, -0.3]]) M.dyn('cardboard', x, y, z, r, { a: [w, h, d] });
  // voitures garées à cheval sur le trottoir, comme partout dans le lotissement ; jardinières de chicane (écluses) qui ralentissent la rue et
  // coupent sa longueur
  car(-15.5, 2.9, Math.PI / 2, FDP.cars[7], false, 'mpv'); // (aucune voiture de la rue devant une allée de garage : elle bloquerait celle qui y dort)
  car(13, -2.9, -Math.PI / 2, FDP.cars[10], false, 'cross'); car(18.6, 2.5, -Math.PI / 2 + 0.06, FDP.cars[6], false, 'suv');
  car(10.8, 0.0, Math.PI / 2 + 0.62, FDP.cars[11], false, 'mpv'); // à l'est du camion, une voiture garée en travers de la rue
  for (const s of [1, -1]) car(30.0, s * 6.0, -s * 0.785, FDP.cars[s > 0 ? 9 : 3], false, s > 0 ? 'suv' : 'hatch'); // garées le long de la raquette
  // ralentisseur (plateau d'enrobé, triangles blancs)
  M.save().color([0.26, 0.26, 0.26]).world(1); M.boxB('asphalt', -24.6, -23.4, 0, 0.08, -3, 3, { bevel: 0.04 }); M.restore();
  M.save().color([0.95, 0.95, 0.92]).local(1); M.cls = 1; for (const z of [-2.2, -0.75, 0.75, 2.2]) M.tri3('paint', [-24.55, 0.091, z - 0.3], [-24.55, 0.091, z + 0.3], [-23.95, 0.091, z], [0, 1, 0]); M.restore();
  DECOR.col(-24.6, -23.4, 0, 0.08, -3, 3, 'concrete');
  // bordures de granit le long de la chaussée et de la raquette (affleurantes), îlot planté et son érable
  M.save().color([0.58, 0.57, 0.55]).local(1); M.cls = 1;
  for (const sz of [-1, 1]) M.boxB('concrete', -36, 15.6, 0, 0.05, sz * 3 - 0.08, sz * 3 + 0.08);
  const ring = (r, a0, a1, n) => { for (let i = 0; i < n; i++) { const a = lerp(a0, a1, (i + 0.5) / n), L = r * (a1 - a0) / n + 0.02; M.save().move(24 + Math.cos(a) * r, 0, Math.sin(a) * r).rotY(-a); M.boxB('concrete', -0.08, 0.08, 0, 0.05, -L / 2, L / 2); M.restore(); } };
  ring(9.5, -Math.PI + 0.33, Math.PI - 0.33, 40);
  M.cls = 0; M.color([0.8, 0.79, 0.76]); M.save().move(24, 0, 0); M.lathe('concrete', [[2.75, 0], [3.05, 0], [3.05, 0.13], [2.95, 0.16], [2.75, 0.16]], 32, { sharp: 0.4 }); M.restore();
  M.restore();
  M.place(PF.tree('maple', 7.5, 2.8, 4, { shape: 'round' }), 24, 0, 0, 0.4, { nocol: true }); // (dans la couronne d'arbustes : leur collision le couvre)
  // l'îlot planté d'arbustes taillés en couronne autour de l'érable (1,7 m) : la vue ne traverse plus la raquette
  M.save().move(24, 0, 0).color([0.6, 0.76, 0.48]).local(1); M.lathe('hedge', [[1.0, 0.1], [2.62, 0.12], [2.78, 0.5], [2.72, 1.45], [2.4, 1.72], [1.1, 1.75], [0.9, 1.4]], 24, { sharp: 0.9, uR: 1.2 }); M.restore();
  fdDiscCols(24, 0, 2.7, 1.6, 'leaf');
  // sucettes publicitaires aux deux bouts des trottoirs (le lotissement vante ses derniers lots)
  for (const s of [1, -1]) for (const x of [-27.5, 15.8]) M.place(PF.fdMupi(), x, 0, s * 4.0, Math.PI / 2);
  // lampadaires, plaques d'égout, avaloirs
  for (const s of [1, -1]) { for (const x of [-24, -6, 12]) M.place(PF.fdLamp(), x, 0, s * 3.9, s > 0 ? Math.PI : 0); M.place(PF.fdLamp(), 32.6, 0, s * 6.4, s > 0 ? Math.PI + 0.9 : -0.9); }
  for (const [x, z] of [[-12, 0.6], [8.6, -0.4], [20, 0.4]]) M.place(PF.manhole(), x, 0.002, z, R() * TAU);
  for (const [x, z] of [[-30, 2.75], [-30, -2.75], [-4, 2.75], [-4, -2.75], [16.5, 2.75], [16.5, -2.75]]) M.place(PF.drain(), x, 0.002, z, 0);
  // plaque de rue et panneau de la résidence à l'entrée, côté ouest ; route barrée au-delà (fin de la carte)
  M.save().move(-20.6, 0, 4.25).rotY(-Math.PI / 2).color([0.4, 0.4, 0.4]).local(1); M.boxB('steel', -0.03, 0.03, 0, 2.3, -0.03, 0.03); fdSign(M, 0, 2.3, 0.8, 0.4, FDS.rue, [0.95, 0.95, 0.95], { both: true }); M.restore();
  DECOR.col(-20.64, -20.56, 0, 2.3, 4.21, 4.29, 'metal');
  for (const s of [1, -1]) {
    M.save().move(-34.2, 0, s * 5.6).rotY(Math.PI / 2).color([0.35, 0.3, 0.25]).local(1);
    for (const x of [-1.0, 1.0]) M.boxB('wood', x - 0.06, x + 0.06, 0, 1.9, -0.06, 0.06);
    fdSign(M, 0, 0.8, 2.2, 1.1, FDS.residence, [0.3, 0.26, 0.22], { both: true }); M.restore();
    DECOR.col(-34.3, -34.1, 0, 1.9, s * 5.6 - 1.1, s * 5.6 + 1.1, 'wood');
  }
  M.save().color([0.85, 0.2, 0.15]).local(1);
  for (const z of [-2.2, 0, 2.2]) { M.save().move(-35.5, 0, z); M.boxB('paint', -0.1, 0.1, 0, 1.0, -0.9, 0.9, { bevel: 0.03 }); M.color([0.95, 0.95, 0.95]); M.boxB('paint', -0.11, 0.11, 0.55, 0.75, -0.91, 0.91); M.color([0.85, 0.2, 0.15]); M.restore(); }
  M.restore();
  DECOR.col(-35.6, -35.4, 0, 1.0, -3.1, 3.1, 'metal');
}

/* ---------- Lot 12, le Chantier (x -34 à -21) : dalle, murs de parpaings, plancher de l'étage sur la moitié arrière ---------- */
function fdChantier(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR, gy = 0.15, top = 2.55, F1 = 2.75, pk = (x0, x1, z0, z1, y0, y1) => box('parpaing', x0, x1, y0, y1, ...zr(z0, z1), { tint: [0.68, 0.68, 0.66], m: 'concrete' });
  box('concrete', -32, -23, 0, gy, ...zr(10, 18), { tint: [0.7, 0.69, 0.66] });
  // murs du rez : la baie du séjour (3 m) où monte l'escalier, la porte du garage à venir (1,4 m), la porte-fenêtre (1,4 m, décalée de la
  // baie : la vue ne traverse pas la maison d'un jardin à l'autre) ; allèges basses
  pk(-32, -29.0, 10, 10.2, gy, top); pk(-26.0, -23, 10, 10.2, gy, gy + 1.2); pk(-26.0, -23, 10, 10.2, top - 0.2, top); pk(-27.8, -26.0, 10, 10.2, top - 0.2, top);
  pk(-32, -31.8, 10.2, 18, gy, top);
  pk(-23.2, -23, 10.2, 12.8, gy, top); pk(-23.2, -23, 12.8, 14.2, top - 0.2, top); pk(-23.2, -23, 14.2, 18, gy, gy + 1.0); pk(-23.2, -23, 14.2, 18, top - 0.2, top);
  pk(-31.8, -28.2, 17.8, 18, gy, gy + 1.2); pk(-31.8, -28.2, 17.8, 18, top - 0.2, top); pk(-28.2, -25.2, 17.8, 18, gy, top); pk(-25.2, -23.8, 17.8, 18, top - 0.2, top); pk(-23.8, -23.2, 17.8, 18, gy, top);
  pk(-31.8, -29.6, 14.0, 14.2, gy, top); // refend de la cuisine
  // plancher de l'étage (hourdis) sur toute la maison, trémie de l'escalier ; murs de l'étage commencés tout autour (1,1 m : on ne s'y hisse
  // pas d'un saut)
  box('concrete', -32, -29.0, top, F1, ...zr(10, 18), { tint: [0.74, 0.73, 0.7] }); box('concrete', -27.8, -23, top, F1, ...zr(10, 18), { tint: [0.74, 0.73, 0.7] });
  box('concrete', -29.0, -27.8, top, F1, ...zr(14, 18), { tint: [0.74, 0.73, 0.7] });
  pk(-32, -29.0, 10, 10.2, F1, F1 + 1.1); pk(-27.8, -23, 10, 10.2, F1, F1 + 1.1);
  pk(-32, -31.8, 10.2, 18, F1, F1 + 1.1); pk(-31.8, -23.2, 17.8, 18, F1, F1 + 1.1); pk(-23.2, -23, 10.2, 18, F1, F1 + 1.1);
  // au-dessus, une paroi invisible (ni tirs ni vue arrêtés) : on ne tient pas debout sur ces murs commencés
  for (const [x0, x1, z0, z1] of [[-32, -29.0, 10, 10.2], [-27.8, -23, 10, 10.2], [-32, -31.8, 10.2, 18], [-31.8, -23.2, 17.8, 18], [-23.2, -23, 10.2, 18]]) glassWall(x0, x1, F1 + 1.1, 10, ...zr(z0, z1));
  // escalier de béton brut, dans la baie, du jardin de devant au plancher (pente de 0,57 : les bots ne montent pas plus raide que 0,62)
  { const [a, b] = zr(9.2, 14.0); ramp(-29.0, -27.8, a, b, 'z', s > 0 ? 0 : F1, s > 0 ? F1 : 0, 'concrete', [0.72, 0.71, 0.68], { mat: 'concrete' }); }
  // fers en attente au sommet des murs, sacs de ciment, parpaings épars ; bétonnière, palettes, tas de sable, benne
  M.save().color([0.42, 0.26, 0.18]).local(1); M.cls = 1;
  for (const [x, z] of [[-31.9, 10.1], [-23.1, 10.1], [-31.9, 17.9], [-23.1, 17.9]]) for (let k = 0; k < 2; k++) { M.save().move(x + (k - 0.5) * 0.08, F1 + 1.1, Z(z)); M.cyl('steel', 0.008, 0.9, 4); M.restore(); }
  M.restore();
  M.place(PF.blocks(), -30.6, gy, Z(12.0), 0.2); M.place(PF.blocks(), -24.4, gy, Z(16.6), 1.4);
  M.dyn('fdMixer', -29.9, 0, Z(6.1), s > 0 ? 0.6 : Math.PI - 0.6); // (bétonnière et brouette : props physiques, on les bouscule)
  M.place(PF.fdBlockPallet(), -33.0, 0, Z(8.6), Math.PI / 2); M.place(PF.fdBlockPallet(), -33.0, 0, Z(7.2), Math.PI / 2);
  M.dyn('fdBrouette', -24.2, 0, Z(8.4), s > 0 ? 2.2 : Math.PI - 2.2);
  for (let k = 0; k < 3; k++) M.dyn('sandbagLow', -26.0 + (k === 2 ? 0.15 : 0), gy + (k === 2 ? 0.15 : 0), Z(17.2 - (k === 1 ? 0.36 : 0)), 0.05 * k, { tint: [0.85, 0.82, 0.74] }); // sacs de ciment
  M.dyn('jerrycan', -24.0, gy, Z(11.0), 0.6, { tint: [0.75, 0.15, 0.1] });
  M.place(PF.fdSkip(), -27.5, 0, Z(23), 0);
  // panneau « lot 12 disponible » fixé sur la façade de parpaings, tourné vers la rue
  M.save().move(-30.5, 0, Z(10) - s * 0.01).rotY(s > 0 ? Math.PI : 0); fdSign(M, 0, 1.0, 1.8, 0.9, FDS.lot, [0.9, 0.9, 0.88]); M.restore();
  // barrières de chantier au fond du lot et à l'ouest
  fdHeras(-25.2, Z(27.5), -21.4, Z(27.5)); // (à l'ouest de la benne, le fond du lot reste ouvert sur la coulée verte)
  fdHeras(-35.5, Z(4.6), -35.5, Z(27.75)); // jusqu'à la haie de la coulée verte (elle entre dedans)
}

/* ---------- Les pavillons fermés : n° 10 (x -19 à -7,3) et n° 6 (x 10,5 à 22,2) ---------- */
function fdHalfLook(s, k) { return { roof: s > 0 ? 'slate' : 'rooftiles', tint: (s > 0 ? FDP.crepi : FDP.crepiS)[k] }; }
function fdNo10(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR;
  fdHouse(-19, -10.5, ...zr(10, 18), FD_H, fdFront(s), { ...fdHalfLook(s, 0), R: rngOf(s > 0 ? 101 : 102), doorX: -12.4, garage: { x0: -10.5, x1: -7.3, z0: zr(10, 16)[0], z1: zr(10, 16)[1], flat: true } });
  // toit-terrasse du garage et son escalier extérieur dans l'allée : on monte depuis le jardin vers la rue (pente de 0,54) jusqu'à un palier
  // au-dessus de l'entrée de l'allée, qui s'ouvre sur la terrasse ; en face, la terrasse du garage de la maison témoin
  { const tint = fdHalfLook(s, 0).tint, F2 = 2.9;
    box('concrete', -10.5, -7.3, 2.7, F2, ...zr(10, 16), { tint: [0.8, 0.79, 0.76] });
    box('concrete', -7.3, -5.2, 2.7, F2, ...zr(10.2, 12.0), { tint: [0.8, 0.79, 0.76] }); // palier
    for (const [x0, x1, z0, z1] of [[-10.5, -7.3, 10, 10.2], [-10.5, -10.3, 10.2, 16], [-10.3, -7.3, 15.8, 16], [-7.5, -7.3, 12.0, 15.8]]) { box('crepi', x0, x1, F2, F2 + 1.1, ...zr(z0, z1), { tint, m: 'concrete' }); glassWall(x0, x1, F2 + 1.1, 10, ...zr(z0, z1)); }
    M.save().color([0.8, 0.8, 0.78]).local(1); for (const [x0, x1, z0, z1] of [[-10.55, -7.25, 9.95, 10.25], [-10.55, -10.25, 10.25, 16.05], [-10.25, -7.25, 15.75, 16.05], [-7.55, -7.25, 12.0, 15.75]]) M.boxB('concrete', x0, x1, F2 + 1.1, F2 + 1.15, ...zr(z0, z1), { bevel: 0.01 }); M.restore();
    M.save().color([0.55, 0.55, 0.53]).world(1); M.cls = 1; { const [a, b] = zr(10.2, 15.8); M.quad('concrete', [-10.3, F2 + 0.012, a], [-7.3, F2 + 0.012, a], [-7.3, F2 + 0.012, b], [-10.3, F2 + 0.012, b], [0, 1, 0]); } M.restore();
    { const [a, b] = zr(12.0, 17.4); ramp(-7.25, -5.2, a, b, 'z', s > 0 ? F2 : 0, s > 0 ? 0 : F2, 'concrete', [0.74, 0.73, 0.7], { mat: 'concrete' }); }
    railing(-5.23, -5.23, F2, ...zr(10.25, 12.0), 'z'); railing(Z(10.23), Z(10.23), F2, -7.3, -5.23, 'x');
    { const [a, b] = zr(12.0, 17.4); railing(-5.23, -5.23, 0, a, b, 'z', s > 0 ? [F2, 0] : [0, F2]); }
    // parois invisibles au-dessus des garde-corps : on ne s'en sert pas de marchepied
    glassWall(-5.3, -5.16, 0, 10, ...zr(10.2, 17.4)); glassWall(-7.3, -5.16, F2, 10, ...zr(10.16, 10.3));
    for (const z of [10.3, 11.9]) box('concrete', -5.45, -5.25, 0, 2.7, ...zr(z - 0.1, z + 0.1), { tint: [0.8, 0.79, 0.76] });
  }
  car(-8.9, Z(6.2), s > 0 ? Math.PI : 0, FDP.cars[s > 0 ? 10 : 8], false, s > 0 ? 'suv' : 'cross'); // les voitures de famille des pavillons
  hedge(-19, -13.4, ...zr(4.6, 5.2), 0.9, { tint: [0.7, 0.88, 0.62] }); // s'arrête au chemin de la porte : on entre sans l'enjamber
  M.place(PF.fdMailbox(), -10.5, 0, Z(4.9), s > 0 ? Math.PI : 0);
  M.dyn('fdBin', -7.3, 0, Z(5.0), s > 0 ? Math.PI : 0, { a: [0.98, 0.78, 0.12] }); M.dyn('fdBin', -6.6, 0, Z(5.0), s > 0 ? Math.PI : 0, { a: [0.25, 0.27, 0.28] }); // poubelles (props physiques)
  M.dyn('fdNain', -17.6, 0, Z(7.4), s > 0 ? Math.PI + 0.3 : -0.3); M.dyn('fdNain', -16.9, 0, Z(8.1), s > 0 ? Math.PI - 0.4 : 0.4); // nains de jardin de la pelouse de devant
  M.dyn('bicycle', -19.7, 0, Z(22.6), 0.06, { tint: [0.2, 0.4, 0.7] }); // le vélo du gamin, au fond du jardin, le long de la haie
}
function fdNo6(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR;
  fdHouse(10.5, 19, ...zr(11, 19), FD_H, fdFront(s), { ...fdHalfLook(s, 2), R: rngOf(s > 0 ? 301 : 302), doorX: 16.6, garage: { x0: 19, x1: 22.2, z0: zr(11, 19)[0], z1: zr(11, 19)[1], flat: true } });
  // toit-terrasse du garage (dalle à 2,9 m, acrotère crépi de 1,1 m : on ne s'y hisse pas d'un saut) ; escalier extérieur de béton le long du
  // garage, côté sente, de la raquette à un palier (pente de 0,56) ; on passe du palier à la terrasse par une ouverture de l'acrotère
  const tint = fdHalfLook(s, 2).tint, F2 = 2.9;
  box('concrete', 19, 22.2, 2.7, F2, ...zr(11, 19), { tint: [0.8, 0.79, 0.76] });
  box('concrete', 22.2, 24.25, 2.7, F2, ...zr(16.1, 17.5), { tint: [0.8, 0.79, 0.76] }); // palier
  for (const [x0, x1, z0, z1] of [[19, 22.2, 11, 11.2], [19, 22.2, 18.8, 19], [22.0, 22.2, 11.2, 16.1], [22.0, 22.2, 17.5, 18.8]]) { box('crepi', x0, x1, F2, F2 + 1.1, ...zr(z0, z1), { tint, m: 'concrete' }); glassWall(x0, x1, F2 + 1.1, 10, ...zr(z0, z1)); }
  M.save().color([0.8, 0.8, 0.78]).local(1); for (const [x0, x1, z0, z1] of [[18.95, 22.25, 10.95, 11.25], [18.95, 22.25, 18.75, 19.05], [21.95, 22.25, 11.25, 16.1], [21.95, 22.25, 17.5, 18.75]]) M.boxB('concrete', x0, x1, F2 + 1.1, F2 + 1.15, ...zr(z0, z1), { bevel: 0.01 }); M.restore();
  M.save().color([0.55, 0.55, 0.53]).world(1); M.cls = 1; { const [a, b] = zr(11.2, 18.8); M.quad('concrete', [19.0, F2 + 0.012, a], [22.0, F2 + 0.012, a], [22.0, F2 + 0.012, b], [19.0, F2 + 0.012, b], [0, 1, 0]); } M.restore();
  { const [a, b] = zr(10.9, 16.1); ramp(22.25, 24.25, a, b, 'z', s > 0 ? 0 : F2, s > 0 ? F2 : 0, 'concrete', [0.74, 0.73, 0.7], { mat: 'concrete' }); }
  // garde-corps du palier et de l'escalier (côté sente), poteaux du palier
  railing(24.22, 24.22, F2, ...zr(16.1, 17.45), 'z'); railing(Z(17.47), Z(17.47), F2, 22.25, 24.22, 'x');
  { const [a, b] = zr(10.9, 16.1); railing(24.22, 24.22, 0, a, b, 'z', s > 0 ? [0, F2] : [F2, 0]); }
  glassWall(24.15, 24.29, 0, 10, ...zr(10.9, 17.5)); glassWall(22.25, 24.29, F2, 10, ...zr(17.4, 17.54)); // au-dessus des garde-corps
  for (const z of [16.2, 17.4]) box('concrete', 24.05, 24.25, 0, 2.7, ...zr(z - 0.1, z + 0.1), { tint: [0.8, 0.79, 0.76] });
  M.dyn('fdBin', 20.2, 0, Z(9.7), s > 0 ? Math.PI : 0, { a: [0.98, 0.78, 0.12] }); M.dyn('fdBin', 21.0, 0, Z(9.7), s > 0 ? Math.PI : 0, { a: [0.25, 0.27, 0.28] });
  M.dyn('trashBag', 21.75, 0, Z(9.6), 0.4); M.dyn('fdNain', 17.8, 0, Z(7.3), s > 0 ? Math.PI : 0);
  M.place(PF.fdMailbox(), 10.4, 0, Z(4.3), s > 0 ? Math.PI : 0);
  M.place(PF.fdCaravan(), 12.8, 0, Z(7.4), Math.PI / 2); fdCap(10.0, 15.6, ...zr(6.3, 8.5), 2.55); // la caravane remisée devant la maison, à l'ouest du chemin de la porte (on ne tient pas sur son toit)
}

/* ---------- N° 8, la Maison témoin (x -3,5 à 8,2) : garage ouvert à l'ouest, séjour et cuisine au rez, deux chambres à l'étage ----------
   Murs traversants (wallOpen) de 25 cm, plancher de l'étage à 2,6 m, escalier le long du pignon est (de la façade vers le jardin), trémie
   ouverte jusqu'à la façade (double hauteur sur l'entrée). Fenêtres vitrées : le verre arrête les soldats, ni les tirs ni la vue. */
function fdTemoin(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR, t = 0.25, F1 = FD_F1, H = FD_H, look = fdHalfLook(s, 1), tint = look.tint, R = rngOf(s > 0 ? 201 : 202);
  const X0 = -0.3, X1 = 8.2, zc = Z(14), wo = { tint, frameTint: FDP.pvc, m: 'concrete' };
  // repère d'un parement de wallOpen (même convention) : fn(M) dans le repère de la face side
  const face = (axis, fixed, a0, a1, side, fn) => {
    M.save();
    if (axis === 'x') { if (side > 0) M.move(a0, 0, fixed + t / 2); else M.move(a1, 0, fixed - t / 2).rotY(Math.PI); }
    else { if (side > 0) M.move(fixed + t / 2, 0, a1).rotY(Math.PI / 2); else M.move(fixed - t / 2, 0, a0).rotY(-Math.PI / 2); }
    fn(M); M.restore();
  };
  const loc = (axis, a0, a1, side, a) => (axis === 'x' ? (side > 0 ? a - a0 : a1 - a) : (side > 0 ? a1 - a : a - a0)); // abscisse dans le repère du parement
  // un mur extérieur : ses ouvertures (a0, a1 dans le monde, b0, b1 en hauteur), fenêtres vitrées (verre), habillage côté rue ou jardin
  // (le rez et l'étage sont deux murs posés l'un sur l'autre : wallOpen ne sait pas percer deux ouvertures l'une au-dessus de l'autre)
  const outer = (axis, fixed, a0, a1, ops, plain = false) => {
    const ext = axis === 'x' ? (fixed > zc ? 1 : -1) : (fixed > (X0 + X1) / 2 ? 1 : -1);
    for (const [y0, h] of [[0, F1], [F1, H - F1]]) {
      wallOpen('peinture', axis, fixed, t, a0, a1, y0, h, ops.filter((p) => !p.panneau && p.b0 >= y0 && p.b1 <= y0 + h).map((p) => ({ a0: p.a0, a1: p.a1, b0: p.b0 - y0, b1: p.b1 - y0 })), {
        ...wo, frames: plain, top: y0 > 0,
        dress: (MM, L, lops, side) => {
          if (side !== ext || plain) return;
          if (!y0) { let cur = 0; for (const p of lops.filter((q) => q.y0 < 0.3).sort((a, b) => a.x0 - b.x0)) { if (p.x0 - cur > 0.05) plinthSeg(MM, cur, p.x0, { mat: 'concrete', h: 0.32, tint: FDP.socle }); cur = p.x1; } if (L - cur > 0.05) plinthSeg(MM, cur, L, { mat: 'concrete', h: 0.32, tint: FDP.socle }); }
          for (const p of lops) if (p.y0 > 0.5) { sill(MM, p, 'concrete', [0.78, 0.77, 0.74]); MM.save().color(FDP.pvc).local(1); MM.boxB('paintwood', p.x0, p.x1, p.y1 - 0.18, p.y1, -0.09, -0.005); MM.restore(); } // coffre du volet roulant relevé
        },
      });
    }
    for (const p of ops) {
      if (p.open) continue;
      const u0 = loc(axis, a0, a1, ext, p.a0), u1 = loc(axis, a0, a1, ext, p.a1), lo = { x0: Math.min(u0, u1), x1: Math.max(u0, u1), y0: p.b0, y1: p.b1 };
      // une fenêtre laisse en haut la place du coffre de son volet roulant ; une porte-fenêtre monte jusqu'au linteau
      face(axis, fixed, a0, a1, ext, (MM) => windowJoinery(MM, { ...lo, y1: lo.y1 - (p.b0 > 0.5 ? 0.18 : 0) }, t / 2, FDP.pvc, { glass: 'glassT', door: p.b0 < 0.1 }));
      if (axis === 'x') glassWall(p.a0, p.a1, p.b0, p.b1, fixed - 0.04, fixed + 0.04); else glassWall(fixed - 0.04, fixed + 0.04, p.b0, p.b1, p.a0, p.a1);
    }
  };
  // façades : la rue (porte d'entrée, baie du séjour, jour de l'entrée ; à l'étage, les deux fenêtres de la chambre sur la rue), le jardin
  // (baie vitrée à moitié ouverte, fenêtre sous le palier ; deux fenêtres à l'étage), le pignon est (jour du palier)
  outer('x', Z(10) + s * t / 2, X0, X1, [{ a0: 0.4, a1: 2.4, b0: 0.9, b1: 2.25 }, { a0: 2.9, a1: 4.1, b0: 0, b1: 2.15, open: true }, { a0: 6.5, a1: 7.6, b0: 1.1, b1: 2.2 },
    { a0: 0.7, a1: 2.1, b0: F1 + 0.95, b1: F1 + 2.15 }, { a0: 3.0, a1: 4.4, b0: F1 + 0.95, b1: F1 + 2.15 }]);
  outer('x', Z(18) - s * t / 2, X0, X1, [{ a0: 1.8, a1: 4.6, b0: 0, b1: 2.2, open: true }, { a0: 3.2, a1: 4.6, b0: 0, b1: 2.2, panneau: true }, { a0: 6.4, a1: 7.6, b0: 1.0, b1: 2.1 },
    { a0: 0.6, a1: 2.0, b0: F1 + 0.95, b1: F1 + 2.15 }, { a0: 3.2, a1: 4.6, b0: F1 + 0.95, b1: F1 + 2.15 }]);
  { const [a, b] = zr(10.25, 17.75), [ga, gb] = zr(10.9, 12.1), [la, lb] = zr(16.3, 17.2);
    // pignon ouest : porte du cellier au rez (vers le garage), porte-fenêtre de la terrasse du garage à l'étage (seuil à 30 cm)
    outer('z', X0 + t / 2, a, b, [{ a0: ga, a1: gb, b0: 0, b1: 2.1, open: true }, { a0: ga, a1: gb, b0: F1 + 0.3, b1: F1 + 2.3, open: true }], true);
    outer('z', X1 - t / 2, a, b, [{ a0: la, a1: lb, b0: F1 + 1.0, b1: F1 + 1.9 }]); }
  // porte d'entrée de PVC ouverte vers l'intérieur (gonds à l'est), la poignée et sa serrure
  M.save().move(4.05, 0, Z(10.27)).rotY(s * 1.4).color(FDP.pvc).local(1); M.cls = 1;
  M.boxB('paintwood', -1.15, 0, 0.02, 2.12, 0, s * 0.05); M.color([0.3, 0.33, 0.36]); M.boxB('glass', -0.85, -0.3, 1.3, 1.9, s * 0.05, s * 0.055);
  M.color([0.7, 0.7, 0.7]); M.boxB('steel', -1.08, -1.0, 1.0, 1.04, -s * 0.06, s * 0.11); M.restore();
  // cloison de l'escalier (rez et étage) et cloison des chambres (porte de 1,2 m)
  { const [a, b] = zr(12.4, 16.0); wallOpen('peinture', 'z', 6.15, 0.15, a, b, 0, F1 - 0.2, [], { tint: [0.95, 0.94, 0.9], frames: false, top: false }); }
  { const [a, b] = zr(10.25, 16.0); wallOpen('peinture', 'z', 6.15, 0.15, a, b, F1, H - F1 - 0.15, [], { tint: [0.95, 0.94, 0.9], frames: false, top: false }); }
  wallOpen('peinture', 'x', Z(14), 0.15, -0.05, 6.075, F1, H - F1 - 0.15, [{ a0: 3.9, a1: 5.1, b0: 0, b1: 2.05 }], { tint: [0.95, 0.94, 0.9], frameTint: FDP.pvc, floorY: F1, top: false });
  // plancher de l'étage (parquet dessus, plâtre dessous), trémie de l'escalier ouverte jusqu'à la façade ; plafond de l'étage sous le comble
  box('peinture', -0.05, 6.225, F1 - 0.2, F1, ...zr(10.25, 17.75), { tint: [0.95, 0.95, 0.93], m: 'wood' });
  box('peinture', 6.225, 7.95, F1 - 0.2, F1, ...zr(16.1, 17.75), { tint: [0.95, 0.95, 0.93], m: 'wood' });
  M.save().color([0.86, 0.72, 0.56]).world(1); M.cls = 1;
  for (const [x0, x1, z0, z1] of [[-0.05, 6.075, 10.25, 17.75], [6.225, 7.95, 16.1, 17.75]]) { const [a, b] = zr(z0, z1); M.quad('wood', [x0, F1 + 0.012, a], [x1, F1 + 0.012, a], [x1, F1 + 0.012, b], [x0, F1 + 0.012, b], [0, 1, 0]); }
  M.restore();
  box('peinture', -0.05, 7.95, H - 0.15, H, ...zr(10.25, 17.75), { tint: [0.95, 0.95, 0.93] });
  // escalier de bois, de la façade vers le jardin, le long du pignon est
  { const [a, b] = zr(11.75, 16.1); ramp(6.25, 7.95, a, b, 'z', s > 0 ? 0 : F1, s > 0 ? F1 : 0, 'wood', [0.7, 0.55, 0.4], { mat: 'wood' }); }
  // sols du rez : carrelage clair
  M.save().color([0.9, 0.88, 0.84]).world(1); M.cls = 1;
  { const [a, b] = zr(10.25, 17.75); M.quad('concrete', [-0.05, 0.012, a], [7.95, 0.012, a], [7.95, 0.012, b], [-0.05, 0.012, b], [0, 1, 0]); }
  M.restore();
  // mobilier de maison témoin : séjour (canapé, table basse, meuble télé), cuisine (plans de travail), salle à manger ; à l'étage, le lit de
  // la chambre du jardin, l'armoire et le coffre à jouets de la chambre sur la rue ; plafonniers allumés
  fdFurniture(s);
  // garage ouvert (x -3,5 à -0,3) : mur ouest, mur du fond et sa porte (1,2 m), linteau de la porte relevée ; toit-terrasse
  { const [a, b] = zr(10, 16); wallOpen('peinture', 'z', -3.5 + t / 2, t, a, b, 0, 2.7, [], { ...wo, frames: false }); }
  wallOpen('peinture', 'x', Z(16) - s * t / 2, t, -3.25, -0.3, 0, 2.7, [{ a0: -2.1, a1: -0.9, b0: 0, b1: 2.1 }], { ...wo, frameTint: FDP.pvc });
  wallOpen('peinture', 'x', Z(10) + s * t / 2, t, -3.25, -0.3, 0, 2.7, [{ a0: -2.7, a1: -0.3, b0: 0, b1: 2.15 }], { ...wo, frames: false });
  // dalle du garage (plafond dessous, terrasse dessus) et son acrotère crépi de 1,1 m (on ne s'y hisse pas d'un saut)
  box('peinture', -3.5, -0.3, 2.55, 2.9, ...zr(10, 16), { tint: [0.9, 0.9, 0.88] });
  M.save().color([0.55, 0.55, 0.53]).world(1); M.cls = 1; { const [a, b] = zr(10.2, 15.8); M.quad('concrete', [-3.3, 2.912, a], [-0.3, 2.912, a], [-0.3, 2.912, b], [-3.3, 2.912, b], [0, 1, 0]); } M.restore();
  for (const [x0, x1, z0, z1] of [[-3.5, -3.3, 10, 16], [-3.3, -0.3, 10, 10.2], [-3.3, -0.3, 15.8, 16]]) { box('peinture', x0, x1, 2.9, 4.0, ...zr(z0, z1), { tint, m: 'concrete' }); glassWall(x0, x1, 4.0, 10, ...zr(z0, z1)); }
  M.save().color([0.8, 0.8, 0.78]).local(1); for (const [x0, x1, z0, z1] of [[-3.55, -3.25, 9.95, 16.05], [-3.55, -0.3, 9.95, 10.25], [-3.55, -0.3, 15.75, 16.05]]) M.boxB('concrete', x0, x1, 4.0, 4.05, ...zr(z0, z1), { bevel: 0.01 }); M.restore(); // couvertine
  M.save().color([0.62, 0.62, 0.6]).world(1); M.cls = 1;
  { const [a, b] = zr(10.25, 15.75); M.quad('concrete', [-3.25, 0.012, a], [-0.3, 0.012, a], [-0.3, 0.012, b], [-3.25, 0.012, b], [0, 1, 0]); }
  M.restore();
  face('x', Z(10) + s * t / 2, -3.25, -0.3, -s, (MM) => fdGarageDoor(MM, { x0: s > 0 ? 0 : 0.55, x1: s > 0 ? 2.4 : 2.95, y0: 0, y1: 2.15 }, t / 2, FDP.pvc, true));
  // armoire de rangement, cartons, congélateur, vélo dans le garage
  box('paintwood', -3.25, -2.8, 0, 1.9, ...zr(11.0, 14.2), { tint: [0.86, 0.84, 0.8], m: 'wood' });
  for (const [x, z, y, k] of [[-2.45, 11.3, 0, 0], [-2.45, 11.85, 0, 1], [-2.42, 11.55, 0.42, 2]]) M.dyn('cardboard', x, y, Z(z), (R() - 0.5) * 0.3 + k * 0.01, { a: [0.5, 0.42, 0.45] });
  box('plastic', -3.2, -2.45, 0, 0.85, ...zr(14.6, 15.6), { tint: [0.92, 0.92, 0.9], m: 'metal' });
  // pneus d'hiver empilés, bidon, bouteille de gaz du barbecue (props physiques)
  for (let k = 0; k < 3; k++) M.dyn('tire', -0.75, k * 0.2, Z(13.3), k * 0.4); // le long du mur, entre la porte du cellier et celle du jardin
  M.dyn('jerrycan', -0.5, 0, Z(14.25), 0.3, { tint: [0.75, 0.15, 0.1] }); M.dyn('gasBottle', -0.52, 0, Z(14.75), 0, { tint: [0.2, 0.35, 0.65] });
  // entrée : le panneau de la maison témoin, les drapeaux « à vendre » ; voiture devant le garage, haie basse, boîte aux lettres
  M.save().move(6.2, 0, Z(7.4)).rotY(s > 0 ? Math.PI : 0).color([0.3, 0.3, 0.3]).local(1);
  for (const x of [-0.7, 0.7]) M.boxB('steel', x - 0.03, x + 0.03, 0, 1.9, -0.03, 0.03);
  fdSign(M, 0, 1.0, 1.7, 0.85, FDS.temoin, [0.9, 0.9, 0.9], { both: true }); M.restore();
  DECOR.col(5.45, 6.95, 0, 1.9, ...zr(7.36, 7.44), 'metal');
  for (const x of [7.6, 8.3]) { M.save().move(x, 0, Z(6.0)).color([0.8, 0.8, 0.8]); M.cyl('steel', 0.03, 4.0, 6); M.restore(); DECOR.col(x - 0.04, x + 0.04, 0, 4.0, Z(6.0) - 0.04, Z(6.0) + 0.04, 'metal'); }
  M.save().move(7.6, 2.9, Z(6.0)).color([0.85, 0.12, 0.1]).local(1); clothPiece(M, [0.05, 0.1, 0], [0.55, 0.0, 0], [0.55, 1.0, 0], [0.05, 1.05, 0], [0, 0, 1], { hoist: true, genre: 'drapeau', grp: 'fdflag' + s }); M.restore();
  M.save().move(8.3, 2.9, Z(6.0)).color([0.95, 0.95, 0.95]).local(1); clothPiece(M, [0.05, 0.1, 0], [0.55, 0.0, 0], [0.55, 1.0, 0], [0.05, 1.05, 0], [0, 0, 1], { hoist: true, genre: 'drapeau', grp: 'fdflag2' + s }); M.restore();
  car(-1.9, Z(6.2), s > 0 ? Math.PI : 0, FDP.cars[s > 0 ? 10 : 2], false, s > 0 ? 'cross' : 'mpv'); // (1,6 m devant le garage, le point B dégagé)
  hedge(5.0, 8.2, ...zr(4.6, 5.2), 0.9, { tint: [0.7, 0.88, 0.62] });
  M.place(PF.fdMailbox(), 2.4, 0, Z(4.9), s > 0 ? Math.PI : 0);
  M.dyn('fdBin', 1.5, 0, Z(5.0), s > 0 ? Math.PI : 0, { a: [0.98, 0.78, 0.12] });
  // toit de la maison témoin
  fdRoof(X0, X1, ...zr(10, 18), H, { mat: look.roof, gable: tint, pitch: look.roof === 'slate' ? 0.72 : 0.6, chimney: 1.6, velux: [[s, 2.0], [s, 6.0]], wallMat: 'peinture' });
}
/* Mobilier de la maison témoin (moitié s) */
function fdFurniture(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR, F1 = FD_F1;
  const piece = (mat, x0, x1, y0, y1, z0, z1, tint, col = true) => box(mat, x0, x1, y0, y1, ...zr(z0, z1), { tint, collide: col, m: 'wood' });
  // séjour : canapé tourné vers le meuble télé (contre le pignon ouest), table basse, tapis
  M.place(PF.fdSofa([0.72, 0.7, 0.66]), 2.3, 0, Z(13.6), -Math.PI / 2);
  piece('paintwood', -0.05, 0.4, 0, 0.5, 12.6, 14.6, [0.3, 0.26, 0.22]);
  M.save().color([0.04, 0.04, 0.05]).local(1); M.boxB('dark', 0.05, 0.1, 0.55, 1.25, ...zr(13.0, 14.2)); M.restore();
  piece('wood', 0.8, 1.4, 0, 0.42, 13.1, 14.1, [0.5, 0.38, 0.26]);
  M.save().color([0.62, 0.55, 0.48]).local(1); M.cls = 1; { const [a, b] = zr(12.3, 14.9); M.quad('rug', [0.5, 0.02, a], [3.0, 0.02, a], [3.0, 0.02, b], [0.5, 0.02, b], [0, 1, 0]); } M.restore();
  // cuisine contre le pignon ouest et le mur du jardin, salle à manger
  piece('paintwood', -0.05, 0.6, 0, 0.92, 14.9, 17.75, [0.95, 0.95, 0.94]); piece('paintwood', 0.6, 1.6, 0, 0.92, 17.15, 17.75, [0.95, 0.95, 0.94]);
  M.save().color([0.3, 0.3, 0.3]).local(1); M.boxB('concrete', -0.05, 0.62, 0.92, 0.96, ...zr(14.9, 17.75)); M.boxB('concrete', 0.6, 1.62, 0.92, 0.96, ...zr(17.13, 17.75)); M.restore();
  M.save().color([0.95, 0.95, 0.94]).local(1); M.cls = 1; M.boxB('paintwood', -0.05, 0.35, 1.5, 2.2, ...zr(15.0, 17.7)); M.restore();
  M.dyn('table', 4.2, 0, Z(15.1), Math.PI / 2, { tint: [0.6, 0.45, 0.3] });
  for (const [x, z, r] of [[3.4, 14.6, Math.PI / 2], [3.4, 15.6, Math.PI / 2], [5.0, 14.6, -Math.PI / 2], [5.0, 15.6, -Math.PI / 2]]) M.dyn('chair', x, 0, Z(z), r);
  // étage : lit bas de la chambre du jardin et ses chevets, armoire et coffre à jouets de la chambre sur la rue (tous à hauteur de marche), cartons « à déballer »
  piece('canvas', 0.0, 1.6, F1, F1 + 0.42, 15.6, 17.75, [0.86, 0.84, 0.8]); piece('wood', 0.03, 1.57, F1, F1 + 1.0, 17.55, 17.75, [0.45, 0.33, 0.22]); // (lit contre le pignon : pas de poche étroite où l'on resterait coincé)
  M.save().color([0.55, 0.62, 0.72]).local(1); M.cls = 1; M.boxB('canvas', 0.02, 1.58, F1 + 0.42, F1 + 0.47, ...zr(15.6, 16.6)); M.restore();
  piece('wood', 1.7, 2.15, F1, F1 + 0.42, 17.2, 17.75, [0.45, 0.33, 0.22]);
  piece('paintwood', 5.3, 6.075, F1, F1 + 2.1, 10.25, 11.7, [0.9, 0.9, 0.88]);
  piece('wood', -0.05, 0.5, F1, F1 + 0.42, 12.4, 13.6, [0.6, 0.48, 0.34]); // coffre à jouets
  for (const [x, z, k] of [[4.6, 12.6, 0], [4.9, 13.2, 1]]) M.dyn('cardboard', x, F1, Z(z), k * 0.4, { a: [0.55, 0.42, 0.45] });
  // ce qui donne de la vie (props physiques) : bouteilles sur le plan de travail, plantes en pot, ballon dans la chambre
  for (const [x, z, h] of [[0.2, 15.25, 0.3], [0.32, 15.45, 0.26], [0.18, 15.6, 0.22]]) M.dyn('bottle', x, 0.96, Z(z), 0, { a: [h] });
  for (const [x, y, z] of [[0.2, 0, 12.15], [5.75, 0, 17.4], [1.92, F1 + 0.42, 17.48], [0.3, 0.96, 17.35]]) M.dyn('pot', x, y, Z(z), x);
  M.dyn('fdBallon', 1.2, F1, Z(12.0), 0, { a: [0.9, 0.2, 0.15] });
  // plafonniers allumés (la maison témoin se visite)
  for (const [x, y, z] of [[1.8, F1 - 0.25, 13.4], [3.6, F1 - 0.25, 16.2], [2.8, FD_H - 0.4, 12.0], [2.8, FD_H - 0.4, 16.0], [-1.8, 2.4, 13.0]]) {
    M.save().move(x, y, Z(z)).color([1, 1, 1]); M.cls = 1; M.cyl('lamp', 0.16, 0.08, 10); M.restore();
    M.lamp(x, y - 0.1, Z(z), [1.0, 0.8, 0.55], 1.6, 6, 0.6);
  }
}

/* ---------- Jardins : thuyas, portillons, piscine, trampoline, balançoire, abris ---------- */
function fdGardens(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR, T = [0.5, 0.66, 0.46], thuya = (x0, x1, z0, z1) => { hedge(x0, x1, ...zr(z0, z1), 2.0, { tint: T, bevel: 0.2, uv: 0.7 }); fdCap(x0, x1, ...zr(z0, z1), 2.0); };
  // thuyas entre les lots et au fond des jardins (portillons de 1,4 m), trou des gamins entre le n° 10 et la maison témoin ; le jardin du
  // n° 6 s'ouvre sur l'allée qui le sépare de la maison témoin (la haie ne commence qu'à 1,5 m derrière la maison)
  thuya(-21.4, -20.6, 20, 26.9); thuya(-5.8, -5.0, 19.0, 21.8); thuya(-5.8, -5.0, 23.2, 26.9); thuya(8.95, 9.75, 20.5, 26.9); thuya(22.2, 23.0, 17.6, 26.9);
  thuya(-21.4, -15.2, 26.9, 27.7); thuya(-13.8, 0.8, 26.9, 27.7); thuya(2.2, 23.0, 26.9, 27.7);
  // devant, les lots se séparent aussi par des thuyas (on passe d'un jardin de devant à l'autre par le trottoir) : ils coupent les vues le
  // long des façades
  thuya(-21.4, -20.6, 4.4, 10); thuya(-5.8, -5.0, 4.4, 10); thuya(8.95, 9.75, 4.4, 8.8); // (devant l'allée de la maison témoin, la haie s'arrête à 1,2 m de la façade)
  for (const [x0, x1] of [[-15.2, -13.8], [0.8, 2.2]]) {
    M.save().color([0.22, 0.38, 0.26]).local(1);
    for (const x of [x0, x1]) M.boxB('steel', x - 0.04, x + 0.04, 0, 1.25, ...zr(27.26, 27.34));
    M.save().move(x0 + 0.05, 0, Z(27.3)).rotY(s > 0 ? -1.2 : Math.PI + 1.2); M.cls = 1; M.boxB('lattice', 0, 1.25, 0.08, 1.15, -0.015, 0.015); M.restore();
    M.restore();
  }
  // n° 10 : terrasse, piscine hors-sol (points A et C), abri de jardin contre le fond
  M.place(PF.fdPool(1.8), -15.5, 0, Z(23.2), 0); fdRingCols(-15.5, Z(23.2), 1.8, 0.1, 1.22, 20); // la paroi seule arrête : on enjambe le bord et on entre dans l'eau
  pondAdd({ shape: 'poly', poly: fdCirclePoly(-15.5, Z(23.2), 1.74, 28), wade: 0.03, x: -15.5, y: 1.06, z: Z(23.2), bed: 1.0, slope: 6, vis: 2.2, deep: [0.02, 0.12, 0.16], shallow: [0.05, 0.24, 0.3], scatter: [0.03, 0.15, 0.2], calm: 0.5, probe: false });
  M.place(PF.fdShed(2.2, 2.0, s > 0 ? [0.62, 0.52, 0.4] : [0.86, 0.84, 0.78]), -19.4, 0, Z(25.85), s > 0 ? Math.PI : 0); fdCap(-20.5, -18.3, ...zr(24.85, 26.85), 2.15); // (on n'y saute pas depuis le bord de la piscine)
  // maison témoin : salon de jardin sur la terrasse, barbecue, trampoline, séchoir
  fdGardenSetAt(0.6, Z(20.4), 0); M.dyn('fdBbq', -1.6, 0, Z(19.2), 0); // (salon de jardin et barbecue : props physiques)
  M.place(PF.fdTrampoline(1.8), 5.2, 0, Z(23.2), 0); fdNetCols(5.2, Z(23.2), 1.8, 2.55);
  M.place(PF.fdDryer(), -1.5, 0, Z(24.6), 0.5);
  fdDryerLinge(-1.5, Z(24.6), 0.5, [[0, 2, 0, 0.55, 0.75, [0.85, 0.3, 0.35]], [0, 1, -0.1, 0.45, 0.55, [0.95, 0.95, 0.92]], [2, 2, 0.1, 0.6, 0.8, [0.3, 0.5, 0.8]], [2, 0, 0, 0.35, 0.45, [0.95, 0.8, 0.3]], [1, 2, -0.15, 0.4, 0.6, [0.4, 0.7, 0.5]], [3, 1, 0.1, 0.5, 0.5, [0.95, 0.95, 0.92]]], 'fdsechoir' + s);
  M.dyn('fdBallon', 3.0, 0, Z(21.6), 0, { a: [0.2, 0.45, 0.9] }); M.dyn('fdBallon', 17.4, 0, Z(21.9), 0, { a: [0.95, 0.8, 0.15] });
  // cordes à linge du n° 10 (sur le point de domination, à l'est de la piscine) et du n° 6 (derrière la maison)
  fdCorde(-12.0, Z(19.8), -12.0, Z(25.4), 401 + (s > 0 ? 0 : 1)); fdCorde(11.3, Z(21.0), 16.3, Z(21.0), 411 + (s > 0 ? 0 : 1));
  // n° 6 : balançoire, cabanon dans l'angle, potager surélevé
  M.place(PF.fdSwing(), 15, 0, Z(23.6), 0);
  M.place(PF.fdShed(2.2, 2.2, [0.86, 0.84, 0.78]), 21.1, 0, Z(25.8), s > 0 ? Math.PI : 0); fdCap(20.0, 22.2, ...zr(24.7, 26.9), 2.15);
  box('wood', 11.4, 13.6, 0, 0.3, ...zr(24.6, 25.8), { tint: [0.55, 0.42, 0.3] });
  M.save().color([0.3, 0.22, 0.16]).world(1); M.cls = 1; { const [a, b] = zr(24.7, 25.7); M.quad('dirt', [11.5, 0.305, a], [13.5, 0.305, a], [13.5, 0.305, b], [11.5, 0.305, b], [0, 1, 0]); } M.restore();
}

/* ---------- La sente piétonne et l'aire de jeux (x 23 à 36), conteneurs de tri, transformateur ---------- */
function fdSente(s) {
  const Z = fdZ(s), zr = fdZr(s), M = DECOR;
  M.place(PF.fdTransfo(), 34.4, 0, Z(18.5), -Math.PI / 2); // contre la haie de l'est : coupe la vue le long de la sente
  for (const [x, c, k] of [[28.1, [0.2, 0.5, 0.25], FDS.verre], [29.8, [0.95, 0.75, 0.15], FDS.papiers], [31.5, [0.2, 0.5, 0.25], FDS.verre]]) M.place(PF.fdTri(c, k), x, 0, Z(11.6), s > 0 ? Math.PI : 0);
  M.place(PF.fdSlide(), 28, 0, Z(22.8), s > 0 ? 0 : Math.PI);
  benchAt(34, Z(13.5), 30, Z(13.5));
  for (const [x, z, k] of [[26, 16, 1], [34.5, 22, 2], [26.4, 26.5, 3]]) M.place(PF.tree('linden', 5, 1.7, k + (s > 0 ? 0 : 7), { shape: 'tall' }), x, 0, Z(z), k);
  M.place(PF.fdLamp(), 29.2, 0, Z(27.6), -Math.PI / 2);
  void zr;
}

/* ---------- La coulée verte (bases) : chemin, bancs, lampadaires, jeunes arbres, massifs arbustifs, noue ---------- */
function fdCoulee(s) {
  const Z = fdZ(s), M = DECOR;
  for (const x of [-6.5, 10.5, 20.5]) M.place(PF.fdLamp(), x, 0, Z(29.6), s > 0 ? 0 : Math.PI);
  benchAt(2, Z(39.6), 2, Z(34)); benchAt(10, Z(39.6), 10, Z(34));
  // touffes d'arbustes en quinconce entre les apparitions (à 2 m au moins de chacune) : la coulée devient une suite de petites clairières
  for (const x of [-10.5, -2.5, 6, 14.5]) for (const z of [29.2, 35, 39.2]) fdBush(x, Z(z), 1.15, Math.round(x * 7 + z) + (s > 0 ? 0 : 50));
  // massifs arbustifs en quinconce aux deux bouts de la coulée : on passe entre eux (2 m au moins), la vue ne file plus d'un bout à l'autre
  for (const [x0, x1, z0, z1, k] of [[-34, -29, 28, 32.5, 1], [-27, -23, 31, 35.8, 2], [-33, -29, 35.5, 39.5, 3], [-27, -23, 37.5, 41, 4], [29, 33, 28, 32.5, 5], [23, 27, 31, 35.8, 6], [29, 33, 35.5, 39.5, 7], [23, 27, 37.5, 41, 8]]) fdShrubs(x0, x1, ...fdZr(s)(z0, z1), k + (s > 0 ? 0 : 10));
  for (const [x, k] of [[-18, 2], [20, 5]]) M.place(PF.tree('linden', 5.5, 1.8, k + (s > 0 ? 10 : 20), { shape: 'tall' }), x, 0, Z(39.4), k * 0.7);
  // clôture rigide (panneaux de grillage vert) au bout de la carte
  const zf = Z(41.3);
  M.save().color([0.22, 0.38, 0.26]); M.cls = 1;
  for (let x = -36; x < 36; x += 2.5) { M.quad('lattice', [x, 0.05, zf], [x + 2.5, 0.05, zf], [x + 2.5, 1.8, zf], [x, 1.8, zf], [0, 0, -s]); M.local(1); M.boxB('steel', x - 0.03, x + 0.03, 0, 1.85, zf - 0.03, zf + 0.03); }
  M.restore();
  DECOR.col(-36, 36, 0, 1.8, zf - 0.05, zf + 0.05, 'metal');
}

/* Massif arbustif (laurier, photinia, troène) : un bloc de feuillage de 2 m aux angles très arrondis, des touffes qui en débordent ; les
   collisions sont celles du bloc */
function fdShrubs(x0, x1, z0, z1, seed) {
  const M = DECOR, R = rngOf(seed * 31 + 7);
  box('hedge', x0 + 0.1, x1 - 0.1, 0, 2.0, z0 + 0.1, z1 - 0.1, { tint: R.pick([[0.58, 0.74, 0.48], [0.66, 0.78, 0.5], [0.7, 0.62, 0.5]]), bevel: 0.6, m: 'leaf', uv: 0.9 }); fdCap(x0 + 0.1, x1 - 0.1, z0 + 0.1, z1 - 0.1, 2.0);
  M.save().local(1);
  for (let i = 0; i < 5; i++) { const x = R.range(x0 + 0.6, x1 - 0.6), z = R.range(z0 + 0.6, z1 - 0.6); M.save().move(x, 1.6 + R() * 0.3, z).color(R.pick([[0.6, 0.76, 0.48], [0.82, 0.5, 0.42], [0.7, 0.8, 0.52]])); M.scl(R.range(0.7, 1.1), R.range(0.5, 0.8), R.range(0.7, 1.1)); M.lathe('hedge', [[0, -0.6], [0.6, -0.4], [0.75, 0], [0.55, 0.4], [0, 0.55]], 10, { sharp: 0.9 }); M.restore(); }
  M.restore();
}

/* Touffe d'arbustes ronde (rayon r, 2 m de haut) */
function fdBush(x, z, r, seed) {
  const M = DECOR, R = rngOf(seed * 13 + 5);
  M.save().move(x, 0, z).rotY(R() * TAU).color(R.pick([[0.6, 0.76, 0.48], [0.66, 0.8, 0.52], [0.56, 0.7, 0.44]])).local(1);
  M.lathe('hedge', [[0, 0], [r * 0.98, 0.03], [r * 1.04, 0.5], [r * 1.04, 1.55], [r * 0.88, 1.88], [r * 0.45, 2.02], [0, 2.06]], 14, { sharp: 0.9, uR: 1.2 });
  M.restore();
  fdDiscCols(x, z, r, 1.9, 'leaf'); fdCap(x - r * 0.75, x + r * 0.75, z - r * 0.75, z + r * 0.75, 1.9);
}

/* Corde à linge de jardin entre deux poteaux en T (1,9 m) : draps, serviettes, t-shirts pendus (tissus simulés : ils flottent au vent et
   s'écartent au passage d'un soldat) */
function fdCorde(xa, za, xb, zb, seed) {
  const M = DECOR, R = rngOf(seed), y = 1.85, dx = xb - xa, dz = zb - za, l = hyp(dx, dz), ux = dx / l, uz = dz / l;
  M.save().color([0.62, 0.63, 0.62]);
  for (const [x, z] of [[xa, za], [xb, zb]]) {
    M.save().move(x, 0, z); M.cyl('steel', 0.03, 1.95, 6); M.restore();
    M.tube('steel', 0.02, [[x + uz * 0.3, 1.92, z - ux * 0.3], [x - uz * 0.3, 1.92, z + ux * 0.3]], 4);
    DECOR.col(x - 0.04, x + 0.04, 0, 1.95, z - 0.04, z + 0.04, 'metal');
  }
  M.color([0.85, 0.85, 0.82]); M.cls = 2;
  const C = [[0.95, 0.95, 0.92], [0.85, 0.3, 0.35], [0.3, 0.5, 0.8], [0.95, 0.8, 0.3], [0.4, 0.7, 0.5], [0.9, 0.6, 0.75], [0.35, 0.35, 0.4]];
  for (let r = 0; r < 2; r++) {
    const off = (r - 0.5) * 0.4, ax = xa + uz * off, az = za - ux * off, bx = xb + uz * off, bz = zb - ux * off;
    M.color([0.85, 0.85, 0.82]); M.tube('plastic', 0.005, sagPath([ax, y, az], [bx, y, bz], 0.12, 10), 3);
    let t = 0.08 + R() * 0.06;
    while (t < 0.86) {
      const w = r === 0 && R() < 0.4 ? 1.1 + R() * 0.4 : 0.35 + R() * 0.3, h = w > 1 ? 0.95 + R() * 0.2 : 0.4 + R() * 0.35, tm = t + w / l / 2;
      if (tm + w / l / 2 > 0.95) break;
      const x = lerp(ax, bx, tm), z = lerp(az, bz, tm), yy = y - Math.sin(tm * Math.PI) * 0.12;
      M.color(w > 1 ? [0.96, 0.96, 0.93] : C[Math.floor(R() * C.length)]);
      clothPiece(M, [x - ux * w / 2, yy - h, z - uz * w / 2], [x + ux * w / 2, yy - h, z + uz * w / 2], [x + ux * w / 2, yy, z + uz * w / 2], [x - ux * w / 2, yy, z - uz * w / 2], [uz, 0, -ux], { grp: 'fdcorde' + seed + '-' + r });
      t += w / l + 0.03 + R() * 0.06;
    }
  }
  M.restore();
}

/* Paroi invisible au-dessus d'une haie (ni tirs ni vue arrêtés) : on n'en fait pas un chemin de crête en sautant */
function fdCap(x0, x1, z0, z1, y) { glassWall(x0, x1, y, 10, z0, z1); } // (jusqu'à 10 m : le haut d'une paroi ne sert pas de palier à son tour)

/* ---------- Pourtour : haie de l'est, haies de la coulée verte à l'ouest ---------- */
function fdPerimeter() {
  hedge(35.4, 36.2, -41.3, 41.3, 2.2, { tint: [0.5, 0.66, 0.46], bevel: 0.2 }); fdCap(35.4, 36.2, -41.3, 41.3, 2.2);
  for (const s of [1, -1]) { const [a, b] = fdZr(s)(27.7, 41.3); hedge(-36.2, -35.4, a, b, 2.2, { tint: [0.5, 0.66, 0.46], bevel: 0.2 }); fdCap(-36.2, -35.4, a, b, 2.2); }
}

/* ---------- Arrière-plan : la rue qui continue, d'autres lotissements derrière les champs, la ligne à haute tension, le château d'eau ---------- */
function fdBackdrop() {
  const M = DECOR, R = rngOf(5151);
  WORLD.force = 'far';
  // la rue des Mésanges continue à l'ouest, bordée des mêmes pavillons
  M.save().color([0.5, 0.5, 0.5]).world(1); M.quad('asphalt', [-150, 0.01, -3], [-36, 0.01, -3], [-36, 0.01, 3], [-150, 0.01, 3], [0, 1, 0]); M.restore();
  for (let x = -44; x > -150; x -= 15) for (const s of [1, -1]) fdFarHouse(x, s * 14, s, R, s > 0 ? 'slate' : 'rooftiles');
  // derrière les champs : d'autres rangées de pavillons, toutes pareilles
  for (const s of [1, -1]) for (let x = -120; x <= 120; x += 13) { if (R() < 0.12) continue; fdFarHouse(x + R.range(-1, 1), s * (88 + R.range(-1, 1)), -s, R, s > 0 ? 'slate' : 'rooftiles'); fdFarHouse(x + 6 + R.range(-1, 1), s * (108 + R.range(-1, 1)), s, R, s > 0 ? 'slate' : 'rooftiles'); }
  for (let z = -60; z <= 60; z += 14) { fdFarHouse(56 + R.range(-1, 1), z, 1, R, z > 0 ? 'slate' : 'rooftiles', true); fdFarHouse(76, z + 7, -1, R, z > 0 ? 'slate' : 'rooftiles', true); }
  // ligne à haute tension au nord, château d'eau au sud (un repère par moitié)
  for (const [x, z] of [[-140, 150], [-60, 128], [20, 106], [100, 84], [180, 62]]) fdPylon(x, z);
  fdWaterTower(-62, -96);
  WORLD.force = null;
}
/* Pavillon lointain : volume enduit, toit à deux pans, fenêtres sombres ; sans collision. front : +1 (façade vers +z) ou -1 ; alongZ : faîtage le long de z */
function fdFarHouse(cx, cz, front, R, roof, alongZ = false) {
  const M = DECOR, w = 8.5, d = 8, h = 5.2, rise = roof === 'slate' ? 3.4 : 2.7, tint = R.pick(roof === 'slate' ? FDP.crepi : FDP.crepiS);
  M.save().move(cx, 0, cz).rotY(alongZ ? Math.PI / 2 : 0).color(tint).world(1);
  M.boxB('crepi', -w / 2, w / 2, 0, h, -d / 2, d / 2, { skip: 'y' });
  M.boxB('crepi', w / 2, w / 2 + 3.2, 0, 2.7, -d / 2, d / 2 - 2, { skip: 'y' });
  M.local(1); M.color([0.08, 0.08, 0.09]);
  for (const sd of [-1, 1]) for (const x of [-2.4, 2.2]) for (const y of [1.0, 3.6]) M.quad('dark', [x - 0.6, y, sd * (d / 2 + 0.01)], [x + 0.6, y, sd * (d / 2 + 0.01)], [x + 0.6, y + 1.2, sd * (d / 2 + 0.01)], [x - 0.6, y + 1.2, sd * (d / 2 + 0.01)], [0, 0, sd]);
  M.color(roof === 'slate' ? FDP.slate : FDP.tiles).world(1);
  for (const sd of [-1, 1]) M.quad(roof, [-w / 2 - 0.3, h - 0.25, sd * (d / 2 + 0.4)], [w / 2 + 0.3, h - 0.25, sd * (d / 2 + 0.4)], [w / 2 + 0.3, h + rise, 0], [-w / 2 - 0.3, h + rise, 0], [0, 1, sd]);
  M.color(tint); for (const sd of [-1, 1]) M.tri3('crepi', [sd * w / 2, h, -d / 2], [sd * w / 2, h, d / 2], [sd * w / 2, h + rise, 0], [sd, 0, 0]);
  M.restore(); void front;
}
/* Pylône de la ligne à haute tension : treillis d'acier (silhouette), consoles, isolateurs */
function fdPylon(x, z) {
  const M = DECOR, H = 38;
  M.save().move(x, 0, z).color([0.55, 0.57, 0.6]).local(1); M.cls = 1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.tube('steel', 0.18, [[sx * 3.2, 0, sz * 3.2], [sx * 1.6, H * 0.55, sz * 1.6], [sx * 0.7, H, sz * 0.7]], 4);
  for (let y = 4; y < H; y += 4) { const k = lerp(3.2, 0.7, y / H) - (y > H * 0.55 ? 0 : 0); for (const [a, b] of [[[-k, -k], [k, -k]], [[k, -k], [k, k]], [[k, k], [-k, k]], [[-k, k], [-k, -k]]]) M.tube('steel', 0.08, [[a[0], y, a[1]], [b[0], y, b[1]]], 3); }
  for (const [y, L] of [[H * 0.62, 9], [H * 0.8, 7], [H * 0.95, 5]]) M.boxB('steel', -L, L, y, y + 0.6, -0.4, 0.4);
  M.restore();
}
/* Château d'eau : fût de béton, cuve évasée */
function fdWaterTower(x, z) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.82, 0.8, 0.76]).local(1);
  M.cyl('concrete', 3.2, 24, 20, { r1: 2.6 });
  M.save().move(0, 24, 0); M.lathe('concrete', [[2.6, 0], [9, 5], [9.4, 10], [9.2, 11], [0, 11.5]], 24); M.restore();
  M.restore();
}

/* ---------- Sol : enrobé de la rue et des allées de garage, trottoirs et terrasses en pavés, gravillons de la coulée verte, terre du chantier ---------- */
function fdGround() {
  const sp = new Splat();
  sp.rect(0, -64, 15.8, -3, 3, 0.15, 1, 0.2);
  sp.paint(0, [14, 34, -10, 10], (x, z) => { const d = hyp(x - 24, z); return Math.min(d - 3.0, 9.6 - d); }, 0.12, 1, 0.15); // la raquette, autour de son îlot planté
  for (const s of [1, -1]) {
    const zr = fdZr(s);
    sp.rect(1, -64, 15.6, ...zr(3, 4.5), 0.15, 1, 0.2);
    for (const [x0, x1, z0, z1] of [[-10.4, -7.4, 4.5, 10], [-3.4, -0.4, 4.5, 10]]) sp.rect(0, x0, x1, ...zr(z0, z1), 0.15, 1, 0.2); // allées de garage
    for (const [x0, x1, z0, z1] of [[-13.1, -11.7, 4.5, 10], [2.9, 4.1, 4.5, 10], [15.9, 17.2, 8, 11], [-19, -10.5, 18, 20.4], [-0.3, 8.2, 18, 20.8], [10.5, 19, 19, 21]]) sp.rect(1, x0, x1, ...zr(z0, z1), 0.12, 1, 0.15); // allées, terrasses
    sp.rect(2, -36, 36, ...zr(32.4, 34.6), 0.3, 1, 0.6); // chemin de la coulée verte
    sp.rect(2, 26, 31, ...zr(11, 33), 0.3, 1, 0.6); // la sente
    sp.rect(3, -34.5, -21.2, ...zr(4.6, 27.6), 0.6, 1, 0.8); // terre du chantier
    sp.ellipse(3, -31, s * 34, 3.5, 1.6, 0, 0.8, 0.45, 0.6); // fond terreux d'une noue, entre les massifs
    sp.disc(3, -15.5, s * 23.2, 1.9, 0.1, 1, 0); // sous la piscine : pas de brins d'herbe à travers son fond
  }
  // trottoir autour de la raquette : anneau de 9,5 à 11 m
  sp.paint(1, [12, 36, -12, 12], (x, z) => { const d = hyp(x - 24, z); return Math.min(d - 9.5, 11 - d); }, 0.12, 1, 0.15);
  FDL.splat = sp;
  MAT.ground = groundMat(sp.finish(0.12), [SPLAT.x0, SPLAT.z0, SPLAT.w, SPLAT.d], GROUND_FD);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([0.52, 0.52, 0.52]).local(1); M.aoFn = null; M.plane('ground', 660, 660, 1, 1); M.restore();
  WORLD.force = null;
}
const GROUND_FD = { base: 'lawn', l1: 'asphalt', l2: 'pavers', l3: 'pathgravel', pom: [0, 0.02, 0.02, 0], dirt: [0.48, 0.4, 0.31], mul: 0, env: 0.4 };
/* Pas : enrobé et pavés, gravillons, terre du chantier, herbe ; planchers de la maison témoin, dalles du chantier */
function fdSurface(p) {
  const S = FDL.splat; if (!S) return 'grass';
  if (p.x > -0.3 && p.x < 8.2 && Math.abs(p.z) > 10 && Math.abs(p.z) < 18) return 'wood';
  if (S.at(0, p.x, p.z) > 0.5 || S.at(1, p.x, p.z) > 0.5) return 'concrete';
  if (S.at(2, p.x, p.z) > 0.5) return 'gravel';
  if (p.x < -21 && p.x > -34.5 && Math.abs(p.z) > 4.6 && Math.abs(p.z) < 27.6) return 'dirt';
  return 'grass';
}

/* ---------- Ambiance : matinée grise de province, ciel couvert pâle, lumière douce, couleurs un peu éteintes ---------- */
const ATMO_FD = Object.assign({}, ATMO_DEFAULT, {
  sun: [0.42, 0.62, -0.38], sunColor: 0xfff0dc, sunI: 1.6, vmSun: 0xfff0dc,
  fog: [0.74, 0.76, 0.78], fogD: 0.006, fogH: [24, 0], fogSun: 0.3,
  hemi: [0xc9d1dc, 0x6e6c60, 0.78], vmHemi: [0xc9d1dc, 0x6e6c60],
  sky: {
    zen: [0.42, 0.5, 0.62], mid: [0.66, 0.7, 0.76], hor: [0.84, 0.85, 0.86], gnd: [0.42, 0.44, 0.4],
    glow: [0.9, 0.86, 0.78], halo: [1.0, 0.95, 0.86], disk: [12, 11, 9.5], cloudLo: [0.62, 0.64, 0.68], cloudHi: [1.05, 1.02, 0.98], cloud: [0.82, 0.92, 0.6],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0x5c6252, hdri: 'park',
  bounce: [1.0, 1.0, 0.95], dust: [0.72, 0.7, 0.66], motes: [1.0, 1.0, 0.95],
  grade: { lo: [0.95, 0.98, 1.04], hi: [1.03, 1.01, 0.97], exp: 1.0, sat: 0.9, con: 1.04 }, rays: [0.9, 0.88, 0.82],
  impact: [0.5, 0.48, 0.42], wind: [360, 0.05],
  bloom: [0.35, 0.55, 0.95], aoFloor: 0.32, raysThr: 2.2, raysCap: 6, satExp: 0.95, winLit: 0.12,
});

/* ---------- Définition de la carte (voir MAP_DEFS dans 02-map.js et 02z-load.js) ---------- */
/* Points d'intérêt des bots (moitié Alpha, recopiés au sud) : [x, y, z, route, tenue] ; L (Chantier), M (Maison témoin, jardins, rue), E (Raquette, sente) */
const FD_POI = [
  [-27.5, 0.15, 12.5, 'L', 1], [-30, 2.75, 16, 'L', 1], [-27.5, 0, 20.5, 'L'], [-28.5, 0, 6.5, 'L'], [-22, 0, 14.5, 'L'],
  [-12, 0, 21.5, 'M'], [-4.5, 0, 14.5, 'M'], [-9, 2.9, 13.5, 'M', 1], [-14, 0, 7.5, 'M', 1], [2.5, 0, 14.5, 'M', 1], [2.5, 2.6, 11.5, 'M', 1], [3.0, 2.6, 16.5, 'M', 1], [-1.5, 2.9, 11.5, 'M', 1], [2.5, 0, 22.5, 'M'], [-4.5, 0, 8, 'M', 1],
  [16, 0, 21.5, 'E'], [9.5, 0, 14.5, 'E'], [24, 0, 7, 'E'], [28.5, 0, 16, 'E', 1], [20.5, 2.9, 14.5, 'E', 1], [29.5, 0, 24.5, 'E'], [25.5, 0, 9.5, 'E', 1],
];
MAP_DEFS.lotissement = {
  type: 'close', // combat rapproché (jardins, maisons, rue courte) : README « Règles de conception d'une carte » ; règle le choix des armes des bots
  bounds: { x0: -36, x1: 36, z0: -41, z1: 41 }, // entiers (grille de navigation) ; la clôture du fond est juste au-delà (41,3 m)
  textures: ['plaster', 'slate', 'rooftiles', 'asphalt', 'concrete', 'pavers', 'lawn', 'pathgravel', 'wood', 'paintwood', 'rollshutter', 'steel', 'timber', 'bark', 'dirt', 'sand', 'canvas', 'cardboard'],
  surfaces: ['hedge', 'ripple', 'parpaing'],
  // ambiance enregistrée de Hortus (05c-ambiance.js) : brise et ville lointaine, chants d'oiseaux
  sound: { pack: 'amb_floreal', bed: 0.35, spots: [{ id: 'a_bird', every: [4, 10], gain: 0.3, dist: [10, 30], y: [4, 10] }] },
  kit: () => fdKit(),
  materials: (M) => makeFdMaterials(M),
  // illustration des menus (tools/dev/illustrations.js) : depuis l'entrée de la rue, les pavillons alignés, le camion et la raquette au fond
  art: { cam: [-26.8, 2.5, -1.2], look: [6, 2.4, 2.5], fov: 60 },
  // brins d'herbe des pelouses (02nb-gazon.js) : gazon tondu court ; rien sur l'enrobé, les pavés, les gravillons ni la terre du chantier
  grass: {
    dens: 70,
    density: (x, z) => { const S = FDL.splat; if (!S) return 0; const k = Math.max(S.at(0, x, z), S.at(1, x, z), S.at(2, x, z), S.at(3, x, z) * 1.4); return clamp((0.7 - k) * 2, 0, 1); },
    height: (x, z, r) => 0.1 + 0.1 * r,
    colors: [[0.09, 0.17, 0.04], [0.3, 0.45, 0.12], [0.5, 0.5, 0.26]],
    wind: [0.7, 0.7, 0.3], width: 0.011, amb: 0.4, seed: 7373,
  },
  // repères : l'érable de la raquette, la ligne à haute tension au nord, le château d'eau au sud
  landmarks: [[24, 6.5, 0, 'érable'], [20, 38, 106, 'pylône'], [-62, 35, -96, "château d'eau"]],
  splat: { x0: -64, z0: -64, w: 128, d: 128, ppm: 4 },
  far: 400,
  build() { bendInit(MAP); frenchDreamLevel(); },
  update(t, dt) { floraUpdate(t, dt); },
  unload() { bendClear(); FDL.splat = null; FDL.R = null; },
  // apparitions d'Alpha sur la coulée verte (Bravo : le miroir)
  spawns: [[-16.5, 31.5], [-12.5, 33.5], [-8.5, 31.5], [-4.5, 33.5], [-0.5, 31.5], [3.5, 33.5], [8.5, 31.5], [12.5, 33.5], [16.5, 31.5], [20.5, 33.5], [-14.5, 36.5], [-6.5, 36.5], [1.5, 36.5], [10.5, 36.5], [18.5, 36.5]],
  poi: FD_POI.flatMap((p) => [p, [p[0], p[1], -p[2], p[3], p[4]]]),
  // domination : A et C dans le jardin du n° 10, à côté de la piscine ; B devant la cabine du camion de déménagement
  dom: [[-11.5, 22.5], [-3.5, 0], [-11.5, -22.5]],
  mecha: [[-12, 0], [24, 6.5], [24, -6.5]], // zones de largage du mecha (08f-mecha.js, mnavZones)
  lane: (x) => (x < -20.5 ? 'L' : x > 9.5 ? 'E' : 'M'),
  sniper: [2.5, 2.6, 11.5], // la chambre sur la rue de la maison témoin
  coverZ: 28,
  heli: [30, 40],
  cam: 40,
  surface: (p) => fdSurface(p),
  zones: [
    [_t('Base Alpha'), -36, 36, 27.7, 41], [_t('Base Bravo'), -36, 36, -41, -27.7],
    [_t('Chantier'), -36, -21, 4.5, 27.7], [_t('Chantier'), -36, -21, -27.7, -4.5],
    [_t('Garage'), -3.5, -0.3, 10, 16], [_t('Garage'), -3.5, -0.3, -16, -10],
    [_t('Maison témoin'), -0.3, 8.2, 10, 18], [_t('Maison témoin'), -0.3, 8.2, -18, -10],
    [_t('Sente'), 23, 36, 11, 27.7], [_t('Sente'), 23, 36, -27.7, -11],
    [_t('Piscine'), -21, -5.4, 18, 27.7], [_t('Piscine'), -21, -5.4, -27.7, -18],
    [_t('Jardins'), -21, 23, 16, 27.7], [_t('Jardins'), -21, 23, -27.7, -16],
    [_t('Raquette'), 14, 36, -11, 11], [_t('Rue des Mésanges'), -36, 14, -4.5, 4.5],
    [_t('Pavillons'), -21, 23, 4.5, 16], [_t('Pavillons'), -21, 23, -16, -4.5],
  ],
  atmo: ATMO_FD,
  // ciel photographié (Poly Haven, kloofendal_misty_morning) : ciel gris et bas d'une matinée de province, soleil voilé
  skyPhoto: { key: 'kloofendal_48d', rot: 0.35, gain: 1.4 },
};
