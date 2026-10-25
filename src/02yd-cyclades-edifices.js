/* ==========================================================================
   KIT CYCLADIQUE (3/4) : les édifices posés à la main. L'église de la Panagia (nef voûtée, porche et clocheton à cloches,
   dôme bleu sur son tambour, abside), la chapelle du bout de la jetée, le café traversant de la place (Kafeneio), le moulin à
   vent (ses ailes tournent), les petits édifices du plan (four à pain, fontaine, cabanon), les escaliers extérieurs et les
   passerelles entre toits.
   ========================================================================== */
const CYC = { P: null, mill: null, doors: null, noDoor: null, noWin: null, paintAt: null, holes: null }; // plan courant, moulins dont les ailes tournent, portes du village (cyDoorMark), palette des menuiseries selon z, trous du sol (cyWell)
const CY_WHITE = [0.97, 0.96, 0.93], CY_BLUE = [0.08, 0.3, 0.64], CY_DOME = [0.1, 0.34, 0.7];

/* Contour d'une ouverture cintrée (rectangle surmonté d'un demi-cercle), pour des recoins sombres ou des vantaux : [x, y] de bas en haut */
function cyArchShape(w, h, n = 10) {
  const s = [[-w / 2, 0], [w / 2, 0], [w / 2, h - w / 2]];
  for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; s.push([Math.cos(a) * w / 2, h - w / 2 + Math.sin(a) * w / 2]); }
  s.push([-w / 2, h - w / 2]);
  return s;
}
/* Voûte en berceau le long de x : de x0 sur len, posée à y0, demi-largeur hw, flèche rise (extrusion du profil lenticulaire) */
function cyVault(x0, len, y0, hw, rise, tint, mat = 'chaux') {
  const M = DECOR, shape = [], n = 18;
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI; shape.push([-hw * Math.cos(t), rise * Math.sin(t)]); }
  M.save().move(x0, y0, 0).rotY(Math.PI / 2).color(tint).world(1); M.extrude(mat, shape, len, { sharp: 0.6 }); M.restore();
}
/* ---------- L'église de la Panagia : nef de 8 m x 8 m, porche à l'ouest (le côté de la mer), abside à l'est, centrée en z = 0 ---------- */
function cyChurch() {
  const M = DECOR, WH = 4.4, VR = 1.8, X0 = -4, XP = -2, XN = 6, Z = 4;
  // nef : murs nord et sud, trois hautes fenêtres cintrées dans un encadrement de chaux
  for (const face of ['s', 'n']) inFrame(facadeFrame(face, XP, XN, -Z, Z), (MM) => {
    const ops = [1.4, 4.0, 6.6].map((a) => ({ x0: a - 0.45, x1: a + 0.45, y0: 1.5, y1: 3.8, depth: 0.45, rise: 0.45, back: true }));
    MM.save().color(CY_WHITE).world(1); wallPierced(MM, 'chaux', 8, 0, WH, ops, { depth: 0.45 }); MM.restore();
    for (const op of ops) { windowJoinery(MM, op, 0.45, CY_BLUE, { glass: 'glass', glassTint: [0.55, 0.7, 0.95] }); casing(MM, op, CY_WHITE, 'chaux', 0.12); sill(MM, op, 'chaux', CY_WHITE); }
    // contreforts à fruit entre les fenêtres, liseré bleu sous l'égout
    MM.save().color(CY_WHITE).local(1); for (const a of [0.2, 2.7, 5.3, 7.8]) MM.boxB('chaux', a - 0.18, a + 0.18, 0, 2.6, 0, 0.4, { bevel: 0.05 }); MM.restore();
    MM.save().color(CY_BLUE).local(1); MM.boxB('chaux', 0, 8, WH - 0.36, WH - 0.04, 0, 0.07, { bevel: 0.015 }); MM.restore();
  });
  M.save().color(CY_WHITE).world(1);
  M.quad('chaux', [XP, 3.4, -Z], [XP, 3.4, Z], [XP, WH, Z], [XP, WH, -Z], [-1, 0, 0]);   // façade de la nef au-dessus du porche
  M.quad('chaux', [XN, 0, -Z], [XN, 0, Z], [XN, WH, Z], [XN, WH, -Z], [1, 0, 0]);          // mur de fond, derrière l'abside
  M.restore();
  cyVault(XP, XN - XP, WH, Z, VR, CY_WHITE);
  DECOR.col(XP, XN, 0, WH + VR, -Z, Z, 'concrete');
  // porche : vestibule fermé, portail cintré à double vantail, deux petites baies, plaque, marches
  cyDoorMark(X0, 0, -1, 0, 1.7, 'eglise');
  inFrame(facadeFrame('w', X0, XP, -Z, Z), (MM) => {
    const door = { x0: 4 - 0.85, x1: 4 + 0.85, y0: 0, y1: 2.7, depth: 0.5, rise: 0.85, back: true }, wins = [1.2, 6.8].map((a) => ({ x0: a - 0.4, x1: a + 0.4, y0: 1.4, y1: 2.6, depth: 0.4, rise: 0.4, back: true }));
    MM.save().color(CY_WHITE).world(1); wallPierced(MM, 'chaux', 8, 0, 3.4, [door, ...wins], { depth: 0.5 }); MM.restore();
    panelDoor(MM, door, 0.5, CY_BLUE, {}); casing(MM, door, CY_WHITE, 'chaux', 0.16);
    for (const op of wins) { windowJoinery(MM, op, 0.4, CY_BLUE, {}); casing(MM, op, CY_WHITE, 'chaux', 0.1); }
    cySignBoard(MM, 6.9, 2.9, 1.1, 0.5, CYS.naos, [0.35, 0.28, 0.2], 0.115); // devant le bandeau bleu (7 cm), pas dans son plan
    MM.save().color([0.85, 0.84, 0.8]).local(1); for (let k = 0; k < 3; k++) MM.boxB('slab', 2.5 - 0.12 * (3 - k), 5.5 + 0.12 * (3 - k), 0, 0.1 * (k + 1), 0, 0.3 * (3 - k), { bevel: 0.015 }); MM.restore();
    MM.save().color(CY_BLUE).local(1); MM.boxB('chaux', 0, 8, 3.02, 3.34, 0, 0.07, { bevel: 0.015 }); MM.restore();
  });
  for (const face of ['n', 's']) inFrame(facadeFrame(face, X0, XP, -Z, Z), (MM) => { MM.save().color(CY_WHITE).world(1); MM.wall('chaux', 2, 3.4, []); MM.restore(); });
  DECOR.col(X0, XP, 0, 3.4, -Z, Z, 'concrete');
  DECOR.col(X0 - 0.9, X0, 0, 0.3, -1.9, 1.9, 'concrete');
  M.save().color(CY_WHITE).world(1); M.quad('chaux', [X0, 3.4, -Z], [XP, 3.4, -Z], [XP, 3.4, Z], [X0, 3.4, Z], [0, 1, 0]); M.restore();
  M.save().color(CY_WHITE).local(1);
  M.boxB('chaux', X0 - 0.02, XP + 0.02, 3.4, 3.8, -Z - 0.02, -Z + 0.3, { bevel: 0.03 }); M.boxB('chaux', X0 - 0.02, XP + 0.02, 3.4, 3.8, Z - 0.3, Z + 0.02, { bevel: 0.03 }); M.boxB('chaux', X0 - 0.02, X0 + 0.3, 3.4, 3.8, -Z + 0.3, Z - 0.3, { bevel: 0.03 });
  M.restore();
  // clocheton : mur-pignon mince à deux baies, cloches de bronze, croix
  {
    const shape = [[-1.6, 0], [1.6, 0], [1.6, 2.2], [1.25, 2.45], [1.25, 2.7], [0.7, 3.1], [0.2, 3.5], [0, 3.9], [-0.2, 3.5], [-0.7, 3.1], [-1.25, 2.7], [-1.25, 2.45], [-1.6, 2.2]], xb = -3.65, th = 0.45;
    M.save().move(xb, 3.4, 0).rotY(Math.PI / 2).color(CY_WHITE).world(1); M.extrude('chaux', shape, th, { sharp: 0.6 }); M.restore();
    for (const sd of [-1, 1]) for (const zc of [-0.62, 0.62]) {
      M.save().move(sd > 0 ? xb + th : xb, 3.4 + 0.9, zc).rotY(sd > 0 ? Math.PI / 2 : -Math.PI / 2).move(0, 0, -0.0).color([0.03, 0.03, 0.04]).local(1); M.extrude('dark', cyArchShape(0.62, 1.3), 0.012); M.restore();
    }
    for (const zc of [-0.62, 0.62]) { M.save().move(xb + th / 2, 3.4 + 1.35, zc).color([0.55, 0.38, 0.15]).local(1); M.lathe('steel', [[0, 0.0], [0.07, -0.02], [0.14, -0.2], [0.2, -0.4], [0.17, -0.42], [0, -0.42]], 10); M.restore(); }
    M.save().color(CY_WHITE).local(1); M.boxB('chaux', xb + th / 2 - 0.035, xb + th / 2 + 0.035, 3.4 + 3.9, 3.4 + 4.6, -0.035, 0.035); M.boxB('chaux', xb + th / 2 - 0.035, xb + th / 2 + 0.035, 3.4 + 4.25, 3.4 + 4.32, -0.2, 0.2); M.restore();
    DECOR.col(xb - 0.05, xb + th + 0.05, 3.4, 7.2, -1.6, 1.6, 'concrete', true);
    DECOR.occ(xb - 0.3, xb + th + 0.3, 3.4, 7.2, -1.7, 1.7, 0.3);
  }
  // dôme : tambour à six baies sur la voûte, calotte bleue légèrement bombée, lanterne et croix
  {
    const cx = 2.2, y0 = 5.6, R = 2.5;
    M.save().move(cx, y0, 0).color(CY_WHITE).local(1); M.cyl('chaux', R, 1.7, 24, { caps: '' }); M.restore();
    M.save().move(cx, y0 + 1.7, 0).color([0.95, 0.94, 0.9]).local(1); M.cyl('chaux', R + 0.14, 0.14, 24, {}); M.restore();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.26;
      M.save().move(cx, y0 + 0.4, 0).rotY(-a + Math.PI / 2).color([0.03, 0.04, 0.06]).local(1).move(0, 0, R + 0.008); M.extrude('dark', cyArchShape(0.5, 0.95), 0.01); M.restore(); // devant l'encadrement (6 mm), pas dans son plan
      M.save().move(cx, y0 + 0.4, 0).rotY(-a + Math.PI / 2).color(CY_BLUE).local(1).move(0, 0, R); M.extrude('chaux', cyArchShape(0.66, 1.1), 0.006); M.restore();
    }
    M.save().move(cx, y0 + 1.84, 0).color(CY_DOME).world(1);
    M.lathe('chaux', [[R + 0.1, 0], [R + 0.16, 0.08], [R + 0.05, 0.4], [R - 0.3, 1.0], [R - 0.95, 1.6], [R - 1.65, 2.0], [R - 2.2, 2.28], [0.2, 2.5], [0, 2.52]], 24, { sharp: 0.9 }); M.restore();
    M.save().move(cx, y0 + 4.36, 0).color(CY_WHITE).local(1); M.cyl('chaux', 0.22, 0.3, 10, { r1: 0.18 }); M.restore();
    M.save().color(CY_WHITE).local(1);
    M.boxB('chaux', cx - 0.04, cx + 0.04, y0 + 4.66, y0 + 5.5, -0.04, 0.04); M.boxB('chaux', cx - 0.04, cx + 0.04, y0 + 5.05, y0 + 5.12, -0.26, 0.26); M.restore();
    M.occ(cx - R, cx + R, y0, y0 + 4.4, -R, R, 1);
  }
  // abside : demi-cylindre et demi-calotte à l'est, une baie
  {
    M.save().move(XN, 0, 0).color(CY_WHITE).world(1);
    M.cyl('chaux', 2.4, 4.0, 18, { a0: -Math.PI / 2, a1: Math.PI / 2, caps: '' });
    M.lathe('chaux', [[2.5, 4.0], [2.46, 4.14], [2.0, 4.9], [1.2, 5.5], [0.4, 5.85], [0, 5.95]], 18, { a0: -Math.PI / 2, a1: Math.PI / 2, sharp: 0.9 });
    M.restore();
    M.save().move(XN + 2.42, 1.4, 0).rotY(Math.PI / 2).color([0.03, 0.04, 0.06]).local(1); M.extrude('dark', cyArchShape(0.5, 1.2), 0.01); M.restore();
    DECOR.col(XN, XN + 2.4, 0, 4.2, -1.0, 1.0, 'concrete'); DECOR.col(XN, XN + 2.0, 0, 4.2, 1.0, 1.9, 'concrete'); DECOR.col(XN, XN + 2.0, 0, 4.2, -1.9, -1.0, 'concrete');
    DECOR.col(XN, XN + 1.3, 0, 4.2, 1.9, 2.4, 'concrete'); DECOR.col(XN, XN + 1.3, 0, 4.2, -2.4, -1.9, 'concrete');
  }
}

/* ---------- La chapelle de la jetée (Agios Nikolaos) : un cube blanc de 4,4 m, dôme bleu, petite porte tournée vers la terre ---------- */
function cyChapel(xc, zc) {
  const M = DECOR, W = 4.4, H = 3.0, t = 0.38, x0 = xc - W / 2, x1 = xc + W / 2, z0 = zc - W / 2, z1 = zc + W / 2, o = { tint: CY_WHITE, frames: false, m: 'concrete' };
  // plancher de planches
  box('boards', x0 - 0.2, x1 + 0.2, -0.3, 0, z0 - 0.2, z1 + 0.2, { tint: [0.62, 0.55, 0.48], m: 'wood' });
  wallOpen('chaux', 'z', x1 - t / 2, t, z0, z1, 0, H, [{ a0: zc - 1.0, a1: zc + 1.0, b0: 0, b1: 2.5, arch: 0.5 }], o); cyDoorMark(x1, zc, 1, 0, 2.0, 'chapelle');
  wallOpen('chaux', 'z', x0 + t / 2, t, z0, z1, 0, H, [{ a0: zc - 0.4, a1: zc + 0.4, b0: 1.0, b1: 2.3, arch: 0.4 }], o);
  for (const s of [-1, 1]) wallOpen('chaux', 'x', s > 0 ? z1 - t / 2 : z0 + t / 2, t, x0 + t, x1 - t, 0, H, [{ a0: xc - 0.4, a1: xc + 0.4, b0: 1.0, b1: 2.3, arch: 0.4 }], o);
  box('chaux', x0, x1, H, H + 0.25, z0, z1, { tint: CY_WHITE, bevel: 0.04 });
  // vitrages bleutés des baies, vantail de la porte
  M.save().color([0.5, 0.65, 0.9]); M.cls = 1;
  M.quad('glass', [x0 + t / 2, 1.0, zc - 0.4], [x0 + t / 2, 1.0, zc + 0.4], [x0 + t / 2, 2.3, zc + 0.4], [x0 + t / 2, 2.3, zc - 0.4], [-1, 0, 0]);
  for (const s of [-1, 1]) M.quad('glass', [xc - 0.4, 1.0, s > 0 ? z1 - t / 2 : z0 + t / 2], [xc + 0.4, 1.0, s > 0 ? z1 - t / 2 : z0 + t / 2], [xc + 0.4, 2.3, s > 0 ? z1 - t / 2 : z0 + t / 2], [xc - 0.4, 2.3, s > 0 ? z1 - t / 2 : z0 + t / 2], [0, 0, s]);
  M.restore();
  inFrame(facadeFrame('e', x0, x1, z0, z1), (MM) => {
    const door = { x0: W / 2 - 1.0, x1: W / 2 + 1.0, y0: 0, y1: 2.5, rise: 0.5 };
    casing(MM, door, CY_WHITE, 'chaux', 0.12);
    cyBand0(MM, W);
  });
  // dôme bleu sur un tambour bas, clocheton, croix
  M.save().move(xc, H + 0.25, zc).color(CY_WHITE).local(1); M.cyl('chaux', 1.55, 0.5, 18, { caps: '' }); M.restore();
  M.save().move(xc, H + 0.75, zc).color(CY_DOME).world(1); M.lathe('chaux', [[1.62, 0], [1.66, 0.08], [1.5, 0.5], [1.1, 1.0], [0.55, 1.35], [0.15, 1.5], [0, 1.52]], 18, { sharp: 0.9 }); M.restore();
  M.save().color(CY_WHITE).local(1); M.boxB('chaux', xc - 0.035, xc + 0.035, H + 2.27, H + 2.9, zc - 0.035, zc + 0.035); M.boxB('chaux', xc - 0.2, xc + 0.2, H + 2.6, H + 2.67, zc - 0.035, zc + 0.035); M.restore();
  M.save().move(x1 - 0.25, H + 0.25, zc).color(CY_WHITE).world(1); M.boxB('chaux', -0.2, 0.2, 0, 1.3, -0.7, 0.7, { bevel: 0.03 }); M.restore();
  M.save().move(x1 - 0.05, H + 0.7, zc).rotY(Math.PI / 2).color([0.03, 0.04, 0.06]).local(1); M.extrude('dark', cyArchShape(0.5, 0.8), 0.012); M.restore();
  M.save().move(x1 - 0.25, H + 1.0, zc).color([0.55, 0.38, 0.15]).local(1); M.lathe('steel', [[0, 0.0], [0.06, -0.02], [0.12, -0.18], [0.17, -0.36], [0.15, -0.38], [0, -0.38]], 10); M.restore();
  M.occ(x0, x1, H, H + 2.2, z0, z1, 1);
  // l'intérieur : sol de planches, iconostase de bois et d'or, candélabre, nappe sur l'autel
  box('boards', x0 + t, x1 - t, 0, 0.02, z0 + t, z1 - t, { tint: [0.55, 0.44, 0.34], collide: false, ao: false });
  M.save().local(1);
  // iconostase contre le mur ouest (2 cm d'écart laissaient passer les balles), icônes sur sa face
  M.color([0.35, 0.22, 0.12]); M.boxB('wood', x0 + t, x0 + t + 0.23, 0, 2.5, zc - 1.5, zc + 1.5, { bevel: 0.02 });
  M.color([0.85, 0.66, 0.2]); for (const dz of [-1.0, 0, 1.0]) M.boxB('paint', x0 + t + 0.23, x0 + t + 0.26, 0.6, 1.9, zc + dz - 0.35, zc + dz + 0.35);
  M.color([0.9, 0.88, 0.8]); M.boxB('chaux', xc - 0.45, xc + 0.45, 0, 0.95, zc - 0.5, zc + 0.5, { bevel: 0.03 });
  M.color([0.9, 0.75, 0.3]); M.boxB('steel', x1 - t - 0.4, x1 - t - 0.34, 0, 1.2, zc + 1.0, zc + 1.06); M.boxB('lamp', x1 - t - 0.42, x1 - t - 0.32, 1.2, 1.3, zc + 0.98, zc + 1.08);
  M.restore();
  DECOR.col(x0 + t, x0 + t + 0.23, 0, 2.5, zc - 1.5, zc + 1.5, 'wood');
  DECOR.col(xc - 0.45, xc + 0.45, 0, 0.95, zc - 0.5, zc + 0.5, 'wood');
}
function cyBand0(M, W) { M.save().color(CY_BLUE).local(1); M.boxB('chaux', 0, W, 2.78, 3.0, 0, 0.07, { bevel: 0.015 }); M.restore(); }

/* ---------- Le Kafeneio de la place (traversant d'ouest en est) : trois fois quatre mètres, comptoir, tables, plafond de planches ---------- */
function cyKafeneio(x0, x1, z0, z1) {
  const M = DECOR, t = 0.36, H = 3.6, R = rngOf(877), zc = (z0 + z1) / 2, xc = (x0 + x1) / 2, o = { tint: CY_WHITE, frames: true, frameTint: CY_BLUE, m: 'concrete', top: false }; // top : le toit de cyRoof couvre l'arase
  // porte à deux battants ouverts, large de 2,2 m et centrée sur l'axe de la salle (les montants en prennent un peu) : les bots (grille de 1 m, rayon 0,42) la franchissent
  const door = { a0: zc - 1.1, a1: zc + 1.1, b0: 0, b1: 2.5, arch: 0.5 };
  cyDoorMark(x0, zc, -1, 0, 2.2, 'cafe'); cyDoorMark(x1, zc, 1, 0, 2.2, 'cafe');
  const win = (a) => ({ a0: a - 0.6, a1: a + 0.6, b0: 0.95, b1: 2.35 });
  wallOpen('chaux', 'z', x0 + t / 2, t, z0, z1, 0, H, [door, win(z0 + 1.2), win(z1 - 1.2)], o);
  wallOpen('chaux', 'z', x1 - t / 2, t, z0, z1, 0, H, [door, win(z0 + 1.2), win(z1 - 1.2)], o);
  // murs nord et sud pleins : une vitre sans collision y ouvrirait, à hauteur d'yeux, une ligne de tir de 95 m d'une base à l'autre le long de la rue du Port
  for (const s of [-1, 1]) wallOpen('chaux', 'x', s > 0 ? z1 - t / 2 : z0 + t / 2, t, x0 + t, x1 - t, 0, H, [], o);
  // vitrages (sans collision : on tire au travers)
  M.save().color([0.62, 0.7, 0.76]); M.cls = 1;
  for (const [x, nx] of [[x0 + t / 2, -1], [x1 - t / 2, 1]]) for (const a of [z0 + 1.2, z1 - 1.2]) M.quad('glass', [x, 0.95, a - 0.6], [x, 0.95, a + 0.6], [x, 2.35, a + 0.6], [x, 2.35, a - 0.6], [nx, 0, 0]);
  M.restore();
  box('tiles', x0 + t, x1 - t, 0, 0.03, z0 + t, z1 - t, { collide: false, ao: false, tint: [0.88, 0.86, 0.8] });
  box('chaux', x0 + 0.02, x1 - 0.02, H - 0.22, H, z0 + 0.02, z1 - 0.02, { tint: CY_WHITE, skip: 'Y' }); // rentrée dans les murs, sans dessus : le toit de cyRoof le couvre au même niveau
  ceilingJoists(x0 + t, x1 - t, z0 + t, z1 - t, H - 0.22);
  // enseignes et portes peintes
  inFrame(facadeFrame('w', x0, x1, z0, z1), (MM) => { cySignBoard(MM, (z1 - z0) / 2, 2.55, 3.4, 0.78, CYS.cafe); cyWallDecal(MM, CYD.menu, (z1 - z0) / 2 + 1.7, 1.1, 0.7, 0.7); });
  inFrame(facadeFrame('e', x0, x1, z0, z1), (MM) => { cySignBoard(MM, (z1 - z0) / 2, 2.55, 3.4, 0.78, CYS.cafe); });
  // le comptoir de zinc et ses tabourets, les étagères aux bouteilles, deux tables. Les étagères sont sur le mur nord, plein : contre le mur
  // ouest, elles passaient devant la fenêtre (on voyait les bouteilles posées devant le vide)
  const cx = x0 + t + 0.55, sz = z0 + t, sx = (z) => x0 + t + 0.15 + (z - (zc - 2.8)); // sx : la place d'une bouteille le long du mur nord (mêmes tirages qu'avant)
  M.save().local(1).color([0.4, 0.28, 0.18]); M.boxB('wood', cx - 0.3, cx + 0.3, 0, 1.06, zc - 3.0, zc - 1.4);
  M.color([0.7, 0.72, 0.74]); M.boxB('steel', cx - 0.36, cx + 0.36, 1.06, 1.12, zc - 3.05, zc - 1.35, { bevel: 0.01 });
  M.color([0.35, 0.24, 0.16]); for (const y of [1.45, 1.95, 2.45]) { M.boxB('wood', x0 + t + 0.05, x0 + t + 1.45, y, y + 0.04, sz, sz + 0.3); M.pcol(x0 + t + 0.05, x0 + t + 1.45, y, y + 0.04, sz, sz + 0.3); }
  M.restore();
  WORLD.col({ x0: cx - 0.3, x1: cx + 0.3, y0: 0, y1: 1.12, z0: zc - 3.0, z1: zc - 1.4 }, 'wood');
  for (const y of [1.49, 1.99, 2.49]) for (let z = zc - 2.8; z < zc - 0.4; z += 0.16 + R() * 0.1) { const tint = R.pick([[0.12, 0.3, 0.12], [0.4, 0.2, 0.1], [0.8, 0.75, 0.6], [0.1, 0.12, 0.2], [0.7, 0.6, 0.2]]); if (z < zc - 1.6) M.dyn('bottle', sx(z), y, sz + 0.15, 0, { a: [Math.round((0.22 + R() * 0.08) * 50) / 50], tint }); else R(); } // la rangée s'arrête à 1,2 m du coin (même nombre de tirages)
  for (const z of [zc - 2.2, zc + 2.7]) cafeSet(M, xc + 0.6, z, [Math.PI * 0.5, -Math.PI * 0.5, Math.PI], [0.1, 0.3, 0.6]);
  for (const z of [zc - 1.8, zc + 1.6]) pendantLamp(xc, 2.55, z, H - 0.22);
  // toit plat à parapet
  const top = { n: [[x0, x1]], s: [[x0, x1]], e: [[z0, z1]], w: [[z0, z1]] };
  cyRoof({ x0, x1, z0, z1, h: H, tint: CY_WHITE }, top, { R, walk: false });
}

/* ---------- Le moulin à vent : tour chaulée, toit de chaume, quatre ailes de toile qui tournent au meltem ----------
   o.y : hauteur du pied (posé sur un toit) ; o.face : orientation de la tête (0 : les ailes à l'ouest ; -π/2 : au nord ; le moyeu est à 3,4 m
   du centre de la tour, de ce côté-là) ; o.roof : hors d'atteinte des joueurs (sa porte n'entre pas dans le registre des portes du village) ;
   o.sail : couleur de la toile des ailes (blanc cassé par défaut) */
function cyWindmill(x, z, door = 0, o = {}) {
  const M = DECOR, R = rngOf(Math.round(x * 17 + z * 5) + 71), y0 = o.y || 0, face = o.face || 0;
  // tour : cône tronqué chaulé sur un soubassement de pierre sèche, bandeau, portail cintré bleu, trois petites fenêtres (la porte regarde la cour)
  M.save().move(x, y0, z).rotY(door);
  M.color([0.62, 0.58, 0.5]).world(1); M.cyl('drystone', 3.2, 1.0, 22, { r1: 3.12, caps: '' });
  M.color(CY_WHITE).world(1); M.save().move(0, 1.0, 0); M.cyl('chaux', 3.1, 5.2, 22, { r1: 2.4, caps: '' }); M.restore();
  M.color([0.95, 0.94, 0.9]).local(1); M.save().move(0, 6.2, 0); M.cyl('chaux', 2.55, 0.18, 22); M.restore();
  M.save().move(0, 0, 2.9).color(CY_WHITE).world(1); M.extrude('chaux', cyArchShape(1.6, 2.6), 0.46); M.restore();
  if (!o.roof) cyDoorMark(x + Math.sin(door) * 3.1, z + Math.cos(door) * 3.1, Math.sin(door), Math.cos(door), 1.6, 'moulin');
  M.save().move(0, 0, 3.36).color(CY_BLUE).local(1); M.extrude('chaux', cyArchShape(1.1, 2.25), 0.03); M.restore();
  for (const [a, y] of [[0.95, 3.4], [-0.95, 3.4], [Math.PI, 4.2]]) { const r = 3.1 - ((y - 1.0) / 5.2) * 0.7 + 0.002; M.save().rotY(a).move(0, y, r).color([0.03, 0.04, 0.06]).local(1); M.extrude('dark', cyArchShape(0.5, 0.85), 0.01); M.restore(); }
  M.restore();
  // toit conique de chaume, bague de bois, arbre de la tête tournante (vers l'ouest, d'où vient le vent, sauf o.face)
  M.save().move(x, y0, z).rotY(face);
  M.color([0.74, 0.6, 0.34]).local(1); M.save().move(0, 6.38, 0); M.lathe('burlap', [[2.9, 0], [2.95, 0.1], [2.7, 0.3], [2.0, 1.0], [1.1, 1.9], [0.4, 2.45], [0, 2.7]], 22, { sharp: 0.9, uR: 0.6 }); M.restore();
  M.color([0.4, 0.28, 0.18]); M.save().move(0, 6.2, 0); M.cyl('wood', 2.95, 0.2, 22, {}); M.restore();
  M.color([0.35, 0.25, 0.16]); M.save().move(-1.8, 7.4, 0).rotZ(Math.PI / 2); M.cyl('wood', 0.22, 1.8, 10); M.restore();
  M.restore();
  // collisions : la tour en trois boîtes croisées (un octogone)
  const c = (x0, x1, z0, z1) => DECOR.col(x + x0, x + x1, y0, y0 + 6.5, z + z0, z + z1, 'concrete');
  c(-2.9, 2.9, -1.2, 1.2); c(-1.2, 1.2, -2.9, 2.9); c(-2.2, 2.2, -2.2, 2.2);
  DECOR.occ(x - 3.1, x + 3.1, y0, y0 + 9.0, z - 3.1, z + 3.1, 0.8);
  // les ailes : un groupe à part, qui tourne autour de l'axe de la tête (est-ouest, sauf o.face)
  const sail = o.sail || [0.97, 0.96, 0.92];
  const pf = prefab('windmillSails' + (o.sail ? '_' + sail.join('_') : ''), (S) => {
    S.local(1);
    for (let i = 0; i < 4; i++) {
      S.save().rotX((i * Math.PI) / 2);
      S.color([0.42, 0.3, 0.2]); S.boxB('wood', -0.07, 0.07, 0.2, 5.9, -0.07, 0.07, { bevel: 0.015 });
      S.color([0.5, 0.36, 0.24]); for (let k = 0; k < 7; k++) S.boxB('wood', -0.04, 0.04, 1.0 + k * 0.7, 1.04 + k * 0.7, -0.04, 1.0);
      S.boxB('wood', -0.04, 0.04, 0.9, 5.9, 0.96, 1.0);
      S.color(sail);
      for (let k = 0; k < 4; k++) { const y0 = 1.0 + k * 1.2, y1 = y0 + 1.1; S.quad('cloth', [0.02, y0, 0.02], [0.02, y1, 0.02], [0.02, y1, 0.96], [0.02, y0, 0.96], [1, 0, 0]); }
      S.restore();
    }
    S.color([0.3, 0.22, 0.15]); S.save().rotZ(Math.PI / 2); S.cyl('wood', 0.3, 0.5, 10); S.restore();
  });
  const g = cyPrefabGroup(pf, MAT);
  g.position.set(x - 3.4 * Math.cos(face), y0 + 7.4, z + 3.4 * Math.sin(face)); g.rotation.order = 'YXZ'; g.rotation.y = face;
  mapAdd(g); CYC.mill = CYC.mill || []; CYC.mill.push({ g, ph: R() * TAU, k: R.range(0.17, 0.24) });
}
/* Un prefab sorti du décor fusionné : groupe de maillages, un par matière, que la carte anime (ailes du moulin) */
function cyPrefabGroup(pf, mats) {
  const g = new THREE.Group(); g.name = 'anime:' + pf.name;
  for (const part of pf.parts.values()) {
    if (!part.g.nv || !mats[part.mat]) continue;
    const mesh = new THREE.Mesh(part.g.geometry(), mats[part.mat]);
    mesh.castShadow = !mats[part.mat].userData.noShadow; mesh.receiveShadow = true; mesh.userData.noPrepass = true; mesh.frustumCulled = false;
    g.add(mesh);
  }
  return g;
}
/* Anime les ailes : un tour en une trentaine de secondes, par une brise qui gonfle et retombe. L'angle est l'intégrale de la vitesse
   k (0,8 + 0,2 sin(0,21 t + ph)), toujours positive (de 0,6 k à k) quelle que soit l'heure. Écrit t k (0,8 + 0,2 sin(...)), la vitesse
   gagnait un terme en t cos(...) : au bout de quelques minutes de jeu, les ailes ralentissaient puis repartaient vite à l'envers. */
function cyUpdateMills(t) { for (const m of CYC.mill || []) m.g.rotation.x = m.ph + m.k * (0.8 * t - (0.2 / 0.21) * Math.cos(t * 0.21 + m.ph)); }

/* ---------- Petits édifices du plan (caractère k) : four à pain, maison de la fontaine, cabanon ---------- */
function cyKindOfK(h) { return ['oven', 'fountain', 'cabin'][Math.abs(Math.round(h.x0 * 3 + Math.abs(h.z0 + h.z1) * 3.5)) % 3]; }
function cyFacing(h) {
  const P = CYC.P, open = (i, k) => P.at(i, k) === '.', mid = (h.z0 + h.z1) / 2;
  const order = ['w', 'e', mid > 0 ? 'n' : 's', mid > 0 ? 's' : 'n'], at = { w: [h.i0 - 1, h.k0], e: [h.i1, h.k0], n: [h.i0, h.k0 - 1], s: [h.i0, h.k1] };
  for (const f of order) if (open(...at[f])) return f;
  return 's';
}
function cySmall(h, R) {
  const kind = cyKindOfK(h);
  if (kind === 'cabin') return cyCabin(h, R);
  const M = DECOR, face = cyFacing(h), ang = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face], cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2, w = h.x1 - h.x0, d = h.z1 - h.z0;
  const hw = w / 2 - 0.05, hd = d / 2 - 0.05;
  if (kind === 'oven') {
    // le four : cube chaulé surmonté d'une calotte, gueule voûtée noircie de suie, cheminée
    M.save().move(cx, 0, cz).rotY(ang).color(CY_WHITE).world(1);
    M.boxB('chaux', -hw, hw, 0, 1.9, -hd, hd, { bevel: 0.12 });
    M.local(1); M.save().move(0, 1.9, 0); M.lathe('chaux', [[Math.min(hw, hd) * 1.04, 0], [Math.min(hw, hd) * 1.0, 0.25], [0.8, 0.75], [0.4, 1.0], [0, 1.05]], 18, { sharp: 0.9 }); M.restore();
    M.color([0.03, 0.03, 0.04]); M.save().move(0, 0.2, hd + 0.001); M.extrude('dark', cyArchShape(0.8, 1.1), 0.01); M.restore();
    M.color([0.9, 0.88, 0.84]); M.save().move(hw * 0.45, 2.2, -hd * 0.5); M.cyl('chaux', 0.17, 1.0, 8); M.restore();
    M.color(CY_BLUE); M.boxB('chaux', -0.55, 0.55, 0.0, 0.2, hd, hd + 0.18, { bevel: 0.03 });
    M.restore();
    DECOR.col(h.x0 + 0.05, h.x1 - 0.05, 0, 2.9, h.z0 + 0.05, h.z1 - 0.05, 'concrete');
    return;
  }
  // la fontaine : bloc de pierre sèche à niche cintrée, auge de pierre, filet d'eau
  M.save().move(cx, 0, cz).rotY(ang).color([0.92, 0.9, 0.84]).world(1);
  M.boxB('drystone', -hw, hw, 0, CY_H.k, -hd, hd, { bevel: 0.06 });
  M.save().move(0, 0, hd).color(CY_WHITE).local(1); M.boxB('chaux', -hw * 0.9, hw * 0.9, CY_H.k, CY_H.k + 0.12, -0.1, 0.1, { bevel: 0.03 }); M.restore();
  M.local(1); M.color([0.03, 0.04, 0.05]); M.save().move(0, 0.9, hd + 0.002); M.extrude('dark', cyArchShape(0.9, 1.3), 0.01); M.restore();
  M.color([0.85, 0.82, 0.74]); M.boxB('ashlar', -0.75, 0.75, 0, 0.55, hd + 0.0, hd + 0.55, { bevel: 0.03 });
  M.color([0.55, 0.55, 0.55]); M.tube('steel', 0.025, [[0, 1.4, hd + 0.02], [0, 1.3, hd + 0.2], [0, 1.0, hd + 0.3]], 5);
  M.restore();
  DECOR.col(h.x0 + 0.05, h.x1 - 0.05, 0, CY_H.k + 0.1, h.z0 + 0.05, h.z1 - 0.05, 'concrete');
  M.save().move(cx, 0, cz).rotY(ang); M.col(-0.75, 0.75, 0, 0.55, hd, hd + 0.55, 'concrete'); M.restore();
  const wx = cx + Math.sin(ang) * (hd + 0.28), wz = cz + Math.cos(ang) * (hd + 0.28);
  pondAdd({ shape: 'rect', x: wx, y: 0.5, z: wz, w: 1.35, d: 0.46, rot: ang, jet: 0, depth: 0.4, foam: 0 });
  // une jarre sur le bord et un filet d'eau dans l'auge
  const jx = face === 's' ? -0.9 : 0.9; // jarre côté ouest quand la fontaine ouvre au sud : le mur de la maison voisine ferme l'est
  M.dyn('jar', cx + Math.sin(ang) * (hd + 0.28) + Math.cos(ang) * jx, 0, cz + Math.cos(ang) * (hd + 0.28) - Math.sin(ang) * jx, 0.4, { s: 0.8 });
}
/* Cabanon : un cube chaulé de 2 m, porte bleue, parapet bas */
function cyCabin(h, R) {
  const P = CYC.P, H = h.h;
  DECOR.col(h.x0, h.x1, 0, H, h.z0, h.z1, 'concrete');
  const face = cyFacing(h), faces = [];
  const sides = { n: [P.at(h.i0, h.k0 - 1), cyHeightAt(P, h.i0, h.k0 - 1), h.z0, h.x0, h.x1], s: [P.at(h.i0, h.k1), cyHeightAt(P, h.i0, h.k1), h.z1, h.x0, h.x1], w: [P.at(h.i0 - 1, h.k0), cyHeightAt(P, h.i0 - 1, h.k0), h.x0, h.z0, h.z1], e: [P.at(h.i1, h.k0), cyHeightAt(P, h.i1, h.k0), h.x1, h.z0, h.z1] };
  for (const [f, [ch, hn, fixed, a0, a1]] of Object.entries(sides)) {
    const ex = cyExposure(H, ch === '~' ? H : hn, ch);
    for (const [ya, yb] of ex) faces.push({ f, fixed, a0, a1, ya, yb });
  }
  const tint = R.pick(CYP.wash);
  for (const f of faces) cyRun(cyRunFrame(f.f, f.fixed, f.a0, f.a1), f.ya, f.yb, H, { R, tint, paint: R.pick(CYC.paintAt ? CYC.paintAt((h.z0 + h.z1) / 2) : CYP.paint), frame: R.pick(CYP.frame), door: f.f === face && f.ya < 0.05 ? 0 : -1, climber: true });
  const top = { n: [[h.x0, h.x1]], s: [[h.x0, h.x1]], e: [[h.z0, h.z1]], w: [[h.z0, h.z1]] };
  cyRoof({ ...h, tint }, top, { R, walk: false });
}

/* ---------- Escaliers extérieurs et passerelles ---------- */
/* Escalier chaulé de (x0, z0) à (x1, z1) montant selon axis de h0 à h1 ; sides : côtés à garde-corps (0 : x0 ou z0, 1 : x1 ou z1) ; palier en haut si top */
function cyStair(x0, x1, z0, z1, axis, h0, h1, o = {}) {
  ramp(x0, x1, z0, z1, axis, h0, h1, 'chaux', o.tint || [0.96, 0.95, 0.92], { mat: 'chaux' });
  rampGuard(x0, x1, z0, z1, axis, h0, h1, o.sides || [0, 1], CY_BLUE);
}
/* Passerelle de pierre entre deux toits : dalle de x0..x1 par z0..z1 à la hauteur y, parapets sur les deux grands côtés, arche dessous */
function cyBridge(x0, x1, z0, z1, y, tint = CY_WHITE) {
  const M = DECOR, alongX = x1 - x0 >= z1 - z0;
  box('chaux', x0, x1, y - 0.35, y, z0, z1, { tint, bevel: 0.03 });
  for (const s of [0, 1]) {
    if (alongX) { const a = s ? z1 - 0.22 : z0, b = s ? z1 : z0 + 0.22; M.save().color(tint).world(1); M.boxB('chaux', x0, x1, y, y + 1.05, a, b, { skip: 'y' }); M.restore(); M.save().color(CY_WHITE).local(1); M.boxB('chaux', x0, x1, y + 1.05, y + 1.12, a - 0.03, b + 0.03, { bevel: 0.03 }); M.restore(); DECOR.col(x0, x1, y, y + 1.1, a, b, 'concrete'); }
    else { const a = s ? x1 - 0.22 : x0, b = s ? x1 : x0 + 0.22; M.save().color(tint).world(1); M.boxB('chaux', a, b, y, y + 1.05, z0, z1, { skip: 'y' }); M.restore(); M.save().color(CY_WHITE).local(1); M.boxB('chaux', a - 0.03, b + 0.03, y + 1.05, y + 1.12, z0, z1, { bevel: 0.03 }); M.restore(); DECOR.col(a, b, y, y + 1.1, z0, z1, 'concrete'); }
  }
}
