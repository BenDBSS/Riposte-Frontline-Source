/* ==========================================================================
   TEPHRA : station de recherche volcanologique et centrale géothermique, au pied d'un volcan en éveil. 64 x 124 m, tout en
   longueur, en miroir nord-sud (équipe Alpha au sud, +z ; Bravo au nord, -z). Le volcan fume à l'ouest, au-delà du champ de lave.
   OUEST « Conduites »   : la ligne de vapeur qui longe le champ de lave, ses têtes de puits et leurs silencieux ; le couloir long
                           des tireurs, coupé au milieu par la station de pompage où entrent les conduites.
   CENTRE « Campus »     : parking (points A et C), allée entre les laboratoires et la salle de contrôle, puis l'observatoire et son
                           radôme, repère du centre ; à l'ouest de l'observatoire, l'esplanade et ses fumerolles (point B).
   EST « Centrale »      : la centrale géothermique, combat rapproché : tuyauteries, séparateurs, salle des turbines et sa mezzanine.
   Liaisons : le dépôt (conduites ↔ parking) près de chaque base, les laboratoires (traversants, toit tenu par un escalier extérieur),
   la salle de contrôle (allée ↔ centrale), la galerie entre l'observatoire et la salle des turbines. Chaque base a trois sorties.
   Les deux moitiés se distinguent : orange et derrick de forage au sud (Alpha), bleu canard et mât de télécommunication au nord (Bravo).
   Les tirages sont reproductibles (graine fixe) : chaque pair d'un salon construit la même carte.
   ========================================================================== */
const TPH = {
  T: 0.3,                       // épaisseur des murs
  pipeX: [-31.0, -29.95],       // les deux conduites de l'ouest (axe), rayon 0,45, à 1,45 m du sol
  pipeR: 0.45, pipeY: 1.45, pipeEdge: -29.45, // bord est de l'emprise des conduites (collision)
  east: 31.6,                   // mur d'enceinte de la centrale (face ouest)
  end: 61.6,                    // fond des bases (face intérieure de la clôture)
  labH: 4.0, ctlH: 4.5, obsH: 5.0, hallH: 8.5, mezY: 3.6,
};

/* ---------- Plan ---------- */
function tephraLevel() {
  TPR.rng = rngOf(7117); SR.rng = rngOf(7118); TPH.vents = []; TPH.noise = makeNoise(7121); // (SR : tirage des caisses et des voitures de Khamsin, reprises ici)
  tephraPerimeter();
  for (const s of [1, -1]) { tephraBase(s); tephraWest(s); tephraLab(s); tephraDepot(s); tephraParking(s); tephraControl(s); tephraYard(s); tephraBridge(s); }
  tephraPumpHouse(); tephraEsplanade(); tephraObservatory(); tephraGallery(); tephraHall();
  tephraBackdrop(); tephraVolcano(); tephraLavaRocks(); tephraLavaFlows();
  tephraGround();
}
const TPR = { rng: null };

/* ---------- Outils ---------- */
/* Mur de la station, percé (ops en coordonnées du monde le long de l'axe), parements de panneaux teintés */
function tpWall(axis, fixed, a0, a1, h, ops, tint, key = 'panel') { wallOpen(key, axis, fixed, TPH.T, a0, a1, 0, h, ops, { tint, frames: false, m: 'concrete' }); }
/* Vitrage d'une baie (sans collision pour les tirs, mais les soldats ne passent pas : glassWall) */
function tpGlass(axis, fixed, a0, a1, y0, y1, n, lit) {
  const M = DECOR; M.save().color([0.6, 0.68, 0.72]); M.cls = 1;
  const k = lit ? 'glassLit' : 'glass';
  if (axis === 'x') M.quad(k, [a0, y0, fixed], [a1, y0, fixed], [a1, y1, fixed], [a0, y1, fixed], [0, 0, n]);
  else M.quad(k, [fixed, y0, a0], [fixed, y0, a1], [fixed, y1, a1], [fixed, y1, a0], [n, 0, 0]);
  M.restore();
  if (axis === 'x') glassWall(a0, a1, y0, y1, fixed - 0.06, fixed + 0.06); else glassWall(fixed - 0.06, fixed + 0.06, y0, y1, a0, a1);
}
/* Toit plat praticable ou non : dalle (collision), acrotère de 0,9 m (collision) percé de gaps [[côté, a0, a1]] pour un escalier */
/* Dalle de toit : rentrée de 2 cm dans les murs et 1 cm plus haute que leur arase, pour ne se confondre ni avec leurs parements
   ni avec leur dessus (deux surfaces dans le même plan scintillent) */
function tpSlab(x0, x1, z0, z1, y) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0];
  box('concrete', x0 + 0.02, x1 - 0.02, y - 0.3, y + 0.01, z0 + 0.02, z1 - 0.02, { tint: [0.62, 0.62, 0.6] });
}
function tpRoof(x0, x1, z0, z1, y, tint, gaps = []) {
  const ph = 0.9, t = 0.25, gap = (side) => gaps.filter((g) => g[0] === side).map((g) => [g[1], g[2]]).sort((p, q) => p[0] - q[0]);
  tpSlab(x0, x1, z0, z1, y);
  const run = (side, a0, a1, mk) => { let cur = a0; for (const [g0, g1] of gap(side)) { if (g0 > cur) mk(cur, g0); cur = g1; } if (a1 > cur) mk(cur, a1); };
  run('n', x0, x1, (a, b) => box('panel', a, b, y, y + ph, z0, z0 + t, { tint }));
  run('s', x0, x1, (a, b) => box('panel', a, b, y, y + ph, z1 - t, z1, { tint }));
  run('w', z0 + t, z1 - t, (a, b) => box('panel', x0, x0 + t, y, y + ph, a, b, { tint }));
  run('e', z0 + t, z1 - t, (a, b) => box('panel', x1 - t, x1, y, y + ph, a, b, { tint }));
  // couvertine métallique
  const M = DECOR; M.save().color([0.55, 0.56, 0.57]).local(1); M.cls = 1;
  run('n', x0, x1, (a, b) => M.boxB('steel', a - 0.02, b + 0.02, y + ph, y + ph + 0.04, z0 - 0.03, z0 + t + 0.03));
  run('s', x0, x1, (a, b) => M.boxB('steel', a - 0.02, b + 0.02, y + ph, y + ph + 0.04, z1 - t - 0.03, z1 + 0.03));
  run('w', z0 + t, z1 - t, (a, b) => M.boxB('steel', x0 - 0.03, x0 + t + 0.03, y + ph, y + ph + 0.04, a, b));
  run('e', z0 + t, z1 - t, (a, b) => M.boxB('steel', x1 - t - 0.03, x1 + 0.03, y + ph, y + ph + 0.04, a, b));
  M.restore();
}
/* Sol intérieur (sans collision : le sol de la carte porte) */
function tpFloor(x0, x1, z0, z1, mat = 'vinyl', tint = [0.8, 0.82, 0.8]) { box(mat, x0, x1, 0, 0.02, z0, z1, { collide: false, ao: false, tint }); }
/* Plafond d'une pièce (k : 'ceil' faux plafond, 'ceilc' béton des locaux techniques) juste sous la dalle du toit, et ses luminaires tous les
   3 m environ (dalles lumineuses, ou réglettes dans un local technique) ; sans collision */
function tpCeiling(x0, x1, z0, z1, y, k = 'ceil') {
  const M = DECOR; M.save().color([1, 1, 1]).world(1); M.cls = 1;
  M.quad(k, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0]);
  const nx = Math.max(1, Math.round((x1 - x0) / 3.2)), nz = Math.max(1, Math.round((z1 - z0) / 3.2)), lw = k === 'ceil' ? 0.3 : 0.06, ll = k === 'ceil' ? 0.6 : 0.7;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / nx, cz = z0 + ((z1 - z0) * (j + 0.5)) / nz, ly = y - (k === 'ceil' ? 0.008 : 0.06);
    M.quad('lampTp', [cx - lw, ly, cz - ll], [cx + lw, ly, cz - ll], [cx + lw, ly, cz + ll], [cx - lw, ly, cz + ll], [0, -1, 0]);
    if (k !== 'ceil') { M.color([0.55, 0.56, 0.57]); M.boxB('steel', cx - lw - 0.03, cx + lw + 0.03, ly + 0.002, y, cz - ll - 0.05, cz + ll + 0.05); M.color([1, 1, 1]); }
  }
  M.restore();
}
/* Repère posé en (x, z), tourné de ry (la face avant, +z local, regarde (sin ry, 0, cos ry)) : enseignes, écrans, décalques muraux */
function tpAt(x, y, z, ry, fn) { const M = DECOR; M.save().move(x, y, z).rotY(ry); try { fn(M); } finally { M.restore(); } }
/* Repère d'une face de la boîte x0..x1, z0..z1 (z = 0 : le parement, +z vers l'extérieur) ; at(w) : abscisse locale d'un point du monde */
function tpFace(face, x0, x1, z0, z1, fn) { const at = (w) => (face === 's' ? w - x0 : face === 'n' ? x1 - w : face === 'e' ? z1 - w : w - z0); inFrame(facadeFrame(face, x0, x1, z0, z1), (M) => fn(M, at)); }
/* Boîte pleine de décor (couvert) : collision et parement */
function tpBlock(mat, x0, x1, y0, y1, z0, z1, tint, m = 'metal') { box(mat, x0, x1, y0, y1, z0, z1, { tint, m }); }

/* ---------- Enceinte : conduites de l'ouest, mur de la centrale à l'est, clôtures au fond des bases ---------- */
function tephraPerimeter() {
  const P = TPH;
  // les deux conduites courent tout du long (au-delà des bornes pour le décor) ; elles traversent la station de pompage (z de -3,5 à 3,5)
  for (const x of P.pipeX) tpPipeRun(x, P.pipeY, -110, 110, P.pipeR);
  for (let z = -108; z <= 108; z += 6) if (Math.abs(z) > 4.5) tpPipeSupport(-30.48, z);
  DECOR.col(-34, P.pipeEdge, 0, 1.95, -62, -3.5, 'metal'); DECOR.col(-34, P.pipeEdge, 0, 1.95, 3.5, 62, 'metal'); // (dans la station de pompage : voir tephraPumpHouse)
  // mur d'enceinte de la centrale (est) et clôtures du fond des bases
  box('concrete', P.east, P.east + 0.4, 0, 3.0, -62, 62, { tint: TP.concrete });
  for (const s of [1, -1]) { const [a, b] = [s * P.end, s * (P.end + 0.4)].sort((p, q) => p - q); box('concrete', -34, P.east + 0.4, 0, 2.6, a, b, { tint: TP.concrete }); }
}
/* Conduite le long de z en x, centre à y, gaine d'aluminium, colliers tous les 6 m. (M.cyl part de sa base : la conduite part de z0. Posée
   au milieu, elle allait de 0 à 220 m, et toute la moitié nord n'avait que ses colliers et ses supports.) */
function tpPipeRun(x, y, z0, z1, r) {
  const M = DECOR; M.save().move(x, y, z0).rotX(Math.PI / 2).color([0.92, 0.92, 0.9]).local(1);
  M.cyl('jacket', r, z1 - z0, 14, { caps: '' }); M.restore();
  M.save().color([0.5, 0.52, 0.53]).local(1); M.cls = 1;
  for (let z = Math.ceil(z0 / 6) * 6 + 3; z < z1; z += 6) { M.save().move(x, y, z).rotX(Math.PI / 2); M.cyl('steel', r + 0.035, 0.12, 14); M.restore(); }
  M.restore();
}
/* Support des deux conduites : semelle de béton, portique d'acier, selles */
function tpPipeSupport(x, z) {
  const M = DECOR, P = TPH;
  M.save().move(x, 0, z).color(TP.concrete).world(1); M.boxB('concrete', -1.0, 1.0, 0, 0.45, -0.35, 0.35, { bevel: 0.03 }); M.restore();
  M.save().move(x, 0, z).color(TP.steel).local(1); M.cls = 1;
  M.boxB('steel', -1.05, -0.95, 0.45, P.pipeY - P.pipeR, -0.08, 0.08); M.boxB('steel', 0.95, 1.05, 0.45, P.pipeY - P.pipeR, -0.08, 0.08);
  M.boxB('steel', -1.1, 1.1, P.pipeY - P.pipeR - 0.12, P.pipeY - P.pipeR, -0.1, 0.1);
  M.restore();
}

/* ---------- Bases : cour de la station, hangar et magasin de part et d'autre de la sortie centrale ---------- */
function tephraBase(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), ac = tpAccent(Z(1));
  // atelier (ouest) et magasin (est) : blocs pleins entre les trois sorties
  { const [a, b] = zr(37, 44); tpShed(-20, -8, a, b, 5.0, ac, s > 0 ? 's' : 'n'); tpShed(8, 20, a, b, 5.0, ac, s > 0 ? 's' : 'n'); }
  // poste de garde de la sortie centrale
  { const [a, b] = zr(40, 43); box('panel', 5.4, 7.6, 0, 2.8, a, b, { tint: TP.white }); tpRoofCap(5.2, 7.8, a - 0.2, b + 0.2, 2.8, ac); }
  // fond de la cour : hébergement (ouest) et local des groupes électrogènes (est)
  tpBackRoom(TPH.pipeEdge, -13, s, ac, 'bunk'); tpBackRoom(13, TPH.east, s, ac, 'gen');
  // muret de protection derrière la sortie centrale (la cour ne voit pas le point du parking)
  { const [a, b] = zr(46.6, 47.0); box('concrete', -3.5, 3.5, 0, 2.2, a, b, { tint: TP.concrete }); }
  // obstacles de la cour, derrière lesquels s'abritent les apparitions : citerne, conteneur, groupe électrogène
  tpTank(-17, Z(48.5), 0.9, 3.4); container(16.5, 0, Z(48.6), 'x', ac);
  DECOR.place(PF.generator(), -6.5, 0, Z(57.5), 0);
  // hélicoptère de la station sur son aire, au fond de la cour
  tpHeli(0.5, Z(53.0), s > 0 ? Math.PI / 2 : -Math.PI / 2, ac); tpGroundDecal(TPD.heli, 0.5, Z(53.0), 7.5, 7.5);
  // enseigne de la station sur l'atelier, face au parking ; panneau H2S sur le magasin
  { const [a, b] = zr(37, 44); tpFace(s > 0 ? 'n' : 's', -20, -8, a, b, (M, at) => tpSignBoard(M, at(-14), 2.3, 3.2, 1.6, TPS.station));
    tpFace(s > 0 ? 'n' : 's', 8, 20, a, b, (M, at) => tpWallDecal(M, TPD.h2s, at(17.2), 1.4, 1.1, 1.1)); }
}
/* Bâtiment plein (atelier, magasin, hébergement, sous-station) : volume de collision, façades de panneaux, bandeau de couleur, porte
   sectionnelle sur la face door ('n' : z0, 's' : z1, sinon aucune), couvertine */
function tpShed(x0, x1, z0, z1, h, ac, door) {
  DECOR.col(x0, x1, 0, h, z0, z1, 'concrete');
  const M = DECOR;
  for (const f of 'nsew') inFrame(facadeFrame(f, x0, x1, z0, z1), (MM) => {
    const F = facadeFrame(f, x0, x1, z0, z1);
    MM.save().color(TP.white).world(1); MM.wall('panel', F.len, h, []); MM.restore();
    MM.save().color(ac).local(1); MM.boxB('paint', 0, F.len, h - 0.45, h - 0.2, 0, 0.03); MM.restore(); // bandeau de couleur
  });
  if (door === 'n' || door === 's') {
    const zf = door === 's' ? z1 : z0, c = (x0 + x1) / 2;
    M.save().color([0.7, 0.71, 0.7]).local(1); M.cls = 1;
    M.boxB('rollshutter', c - 2, c + 2, 0, 3.6, door === 's' ? zf : zf - 0.04, door === 's' ? zf + 0.04 : zf);
    M.restore();
  }
  tpRoofCap(x0, x1, z0, z1, h, ac);
}
/* Bâtiment du fond de la base (de z 55,5 à la clôture) : hébergement (lits superposés, casiers) ou local des groupes électrogènes ;
   deux portes sur la cour, une cloison percée, fenêtres hautes ; on y entre de la cour seulement (ce n'est pas une sortie) */
function tpBackRoom(x0, x1, s, ac, kind) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), [zA, zB] = zr(55.5, TPH.end), H = 4.2, T = TPH.T, tint = TP.white, w = x1 - x0;
  const d1 = x0 + w * 0.22, d2 = x0 + w * 0.72;
  tpWall('x', Z(55.5) + s * T / 2, x0, x1, H, [{ a0: d1 - 1, a1: d1 + 1, b0: 0, b1: 2.3 }, { a0: d2 - 1, a1: d2 + 1, b0: 0, b1: 2.3 }, { a0: x0 + w * 0.42, a1: x0 + w * 0.56, b0: 1.4, b1: 2.3 }], tint);
  tpGlass('x', Z(55.5), x0 + w * 0.42, x0 + w * 0.56, 1.4, 2.3, -s);
  for (const x of [x0, x1]) tpWall('z', x + (x === x0 ? T / 2 : -T / 2), zA, zB, H, [], tint);
  tpFloor(x0 + T, x1 - T, zA + (s > 0 ? T : 0), zB - (s > 0 ? 0 : T), kind === 'gen' ? 'concrete' : 'vinyl', kind === 'gen' ? [0.55, 0.56, 0.55] : [0.66, 0.64, 0.6]); // s'arrête au parement du mur de la cour, comme le plafond (sous le seuil des portes, il se battait avec lui)
  tpSlab(x0, x1, zA, zB, H); tpRoofCap(x0, x1, zA, zB, H, ac);
  tpCeiling(x0 + T, x1 - T, zA + (s > 0 ? T : 0), zB - (s > 0 ? 0 : T), H - 0.32, kind === 'gen' ? 'ceilc' : 'ceil');
  // cloison percée au milieu
  const xm = x0 + w * 0.47; { const [a, b] = zr(55.5, 59.0); box('panel', xm - 0.06, xm + 0.06, 0, H - 0.3, a, b, { tint: [0.84, 0.85, 0.84] }); }
  if (kind === 'gen') {
    // un groupe électrogène au milieu de chaque moitié, sur son socle : on en fait le tour (pas de recoin entre un groupe et les murs)
    for (const c of [(x0 + T + xm) / 2, (xm + x1 - T) / 2]) { const [a, b] = zr(58.2, 59.6); box('paint', c - 1.5, c + 1.5, 0, 1.6, a, b, { tint: [0.86, 0.62, 0.12], m: 'metal' }); }
  } else {
    // lits superposés contre le fond, casiers entre eux
    for (const x of [x0 + w * 0.15, x0 + w * 0.62]) { const [a, b] = zr(60.5, 61.5); DECOR.col(x - 1.0, x + 1.0, 0, 1.75, a, b, 'metal'); DECOR.place(PF.tpBunk(), x, 0, Z(61.0), s > 0 ? 0 : Math.PI); }
    for (const x of [x0 + w * 0.36, x0 + w * 0.85]) { const [a, b] = zr(60.9, 61.5); box('steel', x - 0.5, x + 0.5, 0, 1.9, a, b, { tint: [0.42, 0.5, 0.56], m: 'metal' }); }
  }
}
/* Couvertine simple d'un toit non praticable (sans collision au-dessus du volume) */
function tpRoofCap(x0, x1, z0, z1, y, tint) {
  const M = DECOR; M.save().color([0.5, 0.5, 0.5]).world(1); M.boxB('concrete', x0, x1, y, y + 0.06, z0, z1, { skip: 'y' }); M.restore();
  M.save().color(tint).local(1); M.cls = 1; M.boxB('paint', x0 - 0.03, x1 + 0.03, y + 0.06, y + 0.22, z0 - 0.03, z1 + 0.03); M.restore();
}
/* Hélicoptère de la station (posé, sans rotor qui tourne) : collisions du fuselage et de la poutre de queue */
function tpHeli(x, z, ry, ac) {
  DECOR.place(PF.tpHeli(), x, 0, z, ry, { tint: { paint: ac } });
  colShape(x, 0, z, ry, [[-1.05, 1.05, 0.35, 2.6, -2.4, 2.2], [-0.35, 0.35, 0.9, 1.7, 2.2, 6.6]]);
}

/* ---------- Ouest : les Conduites (tête de puits, escalier du toit des laboratoires) ---------- */
function tephraWest(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  // tête de puits : dalle, arbre de vannes, silencieux de vapeur (grand couvert), conduite de raccord vers la ligne
  { const [a, b] = zr(27, 33); box('concrete', -28.6, -21.2, 0, 0.08, a, b, { collide: false, tint: TP.concrete }); }
  tpSilencer(-23.6, Z(30), 1.3, 5.2);
  tpWellhead(-26.8, Z(30), s); tpGroundDecal(s > 0 ? TPD.well7 : TPD.well12, -26.2, Z(27.9), 1.5, 1.5, s > 0 ? 0 : Math.PI, 0.094);
  { const z = Z(33.6); DECOR.col(-21.85, -21.75, 0, 2.4, z - 0.05, z + 0.05, 'metal');
    tpAt(-21.8, 0, z, s > 0 ? 0 : Math.PI, (M) => { M.save().color([0.5, 0.52, 0.53]).local(1); M.boxB('steel', -0.04, 0.04, 0, 2.3, -0.06, -0.02); M.restore(); M.save().color([1, 1, 1]); tpAtlasQuad(M, 'signs5', -0.6, 0.6, 1.5, 2.1, -0.015, tpSignUV(TPS.steam)); M.restore(); }); }
  { const [a, b] = zr(29.6, 30.4); DECOR.col(TPH.pipeEdge, -27.25, 0, 1.25, a, b, 'metal'); tpPipeX(TPH.pipeEdge - 0.2, -27.2, 0.95, Z(30), 0.22); }
  // blocs de lave au milieu du couloir, à hauteur de l'esplanade : ils coupent la grande ligne des Conduites
  tpBoulder(-21.9, Z(8.4), 1.25, 2.1, s > 0 ? 11 : 12);
}
/* Bloc de lave (basalte) : rocher bosselé de rayon r et de hauteur h, collision carrée un peu rentrée */
function tpBoulder(x, z, r, h, seed) {
  const M = DECOR, R = rngOf(seed);
  const prof = [[0, -0.1], [r * 0.95, 0], [r * 1.02, h * 0.25], [r * 0.9, h * 0.55], [r * 0.6, h * 0.85], [r * 0.25, h], [0, h * 1.02]];
  M.save().move(x, 0, z).rotY(R() * TAU).scl(1, 1, 0.8 + R() * 0.3).color([0.95, 0.92, 0.9]).local(1); M.lathe('basalt', prof, 9, { sharp: 1.0 }); M.restore();
  DECOR.col(x - r * 0.8, x + r * 0.8, 0, h * 0.9, z - r * 0.7, z + r * 0.7, 'concrete');
}
/* Conduite le long de x (raccords, passerelles de tuyaux) : de x1 vers x0 (le cylindre tourné de π/2 autour de z part vers -x ; posé au
   milieu, il était décalé de la moitié de sa longueur vers l'ouest, et les portiques de l'est restaient vides) */
function tpPipeX(x0, x1, y, z, r) {
  const M = DECOR; M.save().move(x1, y, z).rotZ(Math.PI / 2).color([0.92, 0.92, 0.9]).local(1); M.cyl('jacket', r, x1 - x0, 12, { caps: '' }); M.restore();
}
/* Silencieux de vapeur d'une tête de puits : grand fût ouvert en haut, cerclé, sur sa semelle */
function tpSilencer(x, z, r, h) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.62, 0.6, 0.56]).local(1); M.cyl('rust', r, h, 18); M.restore();
  M.save().move(x, 0, z).color([0.4, 0.38, 0.36]).local(1); M.cls = 1;
  for (let y = 0.8; y < h; y += 1.2) { M.save().move(0, y, 0); M.cyl('steel', r + 0.05, 0.1, 18, { caps: '' }); M.restore(); }
  M.restore();
  DECOR.col(x - r, x + r, 0, h, z - r, z + r, 'metal');
  TPH.vents = TPH.vents || []; TPH.vents.push({ x, y: h, z, r: r * 0.8, k: 1.6 }); // la vapeur qui s'en échappe (tephraSteam)
}
/* Tête de puits : cave de béton, empilement de vannes à volants, manomètre */
function tpWellhead(x, z, s) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.36, 0.38, 0.4]).local(1);
  M.cyl('steel', 0.22, 2.2, 10); for (const y of [0.5, 1.15, 1.8]) { M.save().move(0, y, 0); M.cyl('steel', 0.34, 0.16, 12); M.restore(); }
  M.color(TP.red); M.cls = 1;
  for (const y of [0.75, 1.4]) { M.save().move(0.42, y, 0).rotZ(Math.PI / 2); M.cyl('steel', 0.03, 0.2, 6); M.restore(); M.save().move(0.55, y, 0).rotZ(Math.PI / 2); M.lathe('steel', [[0.2, -0.02], [0.22, 0], [0.2, 0.02], [0.18, 0]], 12); M.restore(); }
  M.restore();
  DECOR.col(x - 0.45, x + 0.45, 0, 2.3, z - 0.45, z + 0.45, 'metal'); void s;
}

/* ---------- Laboratoires (entre les Conduites et l'allée) : traversants, toit tenu par l'escalier extérieur de l'ouest ---------- */
function tephraLab(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), zo = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  const X0 = -20, X1 = -7, [zA, zB] = zr(12, 26), H = TPH.labH, T = TPH.T, tint = TP.white;
  // ouest : porte au nord du mur (z 12,75 à 14,25), fenêtres ; l'escalier longe le reste du mur
  tpWall('z', X0 + T / 2, zA, zB, H, [{ ...zo(12.75, 14.25), b0: 0, b1: 2.3 }, { ...zo(15, 17.5), b0: 1.0, b1: 2.3 }], tint);
  // est (allée) : porte en face de la salle de contrôle, fenêtres
  tpWall('z', X1 - T / 2, zA, zB, H, [{ ...zo(13, 17.5), b0: 1.0, b1: 2.3 }, { ...zo(18.75, 20.25), b0: 0, b1: 2.3 }, { ...zo(21.5, 25), b0: 1.0, b1: 2.3 }], tint);
  // nord (esplanade) : porte double, fenêtres ; sud : bandeau vitré
  tpWall('x', Z(12) + s * T / 2, X0 + T, X1 - T, H, [{ a0: -18, a1: -15.5, b0: 1.0, b1: 2.3 }, { a0: -12.5, a1: -10.5, b0: 0, b1: 2.3 }, { a0: -9.5, a1: -8, b0: 1.0, b1: 2.3 }], tint);
  tpWall('x', Z(26) - s * T / 2, X0 + T, X1 - T, H, [{ a0: -18.5, a1: -8.5, b0: 1.0, b1: 2.3 }], tint);
  for (const [a, b] of [zr(15, 17.5)]) tpGlass('z', X0, a, b, 1.0, 2.3, -1);
  for (const [a, b] of [zr(13, 17.5), zr(21.5, 25)]) tpGlass('z', X1, a, b, 1.0, 2.3, 1);
  for (const [a, b] of [[-18, -15.5], [-9.5, -8]]) tpGlass('x', Z(12), a, b, 1.0, 2.3, -s);
  tpGlass('x', Z(26), -18.5, -8.5, 1.0, 2.3, s);
  tpFloor(X0 + T, X1 - T, zA + T, zB - T); tpCeiling(X0 + T, X1 - T, zA + T, zB - T, H - 0.32);
  // cloisons : deux bureaux au nord (porte de l'ouest, portes de l'allée et de l'esplanade), le grand laboratoire au sud
  { const zc = Z(20.5), pt = [0.84, 0.85, 0.84]; box('panel', X0 + T, -15.5, 0, H - 0.3, zc - 0.06, zc + 0.06, { tint: pt }); box('panel', -13.5, X1 - T, 0, H - 0.3, zc - 0.06, zc + 0.06, { tint: pt });
    // cloison nord-sud : du mur extérieur (Z(12), son épaisseur T) à la cloison est-ouest (Z(20.5), demi-épaisseur 6 cm), porte de Z(15.25) à
    // Z(16.75) ; les bouts se comptent du côté de la moitié (s), sinon la moitié sud gardait 24 cm de jour contre la cloison
    const seg = (p, q) => box('panel', -13.56, -13.44, 0, H - 0.3, Math.min(p, q), Math.max(p, q), { tint: pt });
    seg(Z(12) + s * T, Z(15.25)); seg(Z(16.75), Z(20.5) - s * 0.06); }
  // paillasses centrales (couverts) du grand laboratoire ; affiches sur la cloison ; enseigne au-dessus de la porte de l'allée
  for (const x of [-16.2, -10.8]) { const [a, b] = zr(22.6, 24.0); DECOR.col(x - 1.4, x + 1.4, 0, 0.93, a, b, 'wood'); DECOR.place(PF.tpBench(), x, 0, Z(23.3), 0); }
  tpAt(-17.6, 0, Z(20.5) + s * 0.06, s > 0 ? 0 : Math.PI, (M) => tpWallDecal(M, TPD.seismo, 0, 1.25, 1.0, 1.0));
  tpAt(-10.2, 0, Z(20.5) + s * 0.06, s > 0 ? 0 : Math.PI, (M) => tpWallDecal(M, TPD.geomap, 0, 1.25, 1.1, 1.1));
  tpFace('e', X0, X1, zA, zB, (M, at) => tpSignBoard(M, at(Z(19.5)), 2.62, 2.6, 0.82, TPS.lab));
  // toit praticable : l'escalier arrive par l'ouest (trouée de l'acrotère de z 16,75 à 18,25)
  tpRoof(X0, X1, zA, zB, H, tpAccent(Z(1)), [['w', ...zr(16.75, 18.25)]]);
  // escalier extérieur le long du mur ouest, palier au niveau du toit
  if (s > 0) ramp(-21.5, -20.0, 18.25, 26.25, 'z', H, 0, 'steel', [0.5, 0.52, 0.53], { mat: 'steel' });
  else ramp(-21.5, -20.0, -26.25, -18.25, 'z', 0, H, 'steel', [0.5, 0.52, 0.53], { mat: 'steel' });
  { const [a, b] = zr(16.75, 18.25); box('grating', -21.5, -20.0, H - 0.12, H, a, b, { tint: [0.6, 0.62, 0.62] }); railing(-21.5, -21.5, H, a, b, 'z'); const zn = s > 0 ? a : b; railing(zn, zn, H, -21.5, -20.0, 'x'); }
  { const [a, b] = zr(18.25, 26.25); rampGuard(-21.5, -20.0, a, b, 'z', s > 0 ? H : 0, s > 0 ? 0 : H, [0]); }
}

/* ---------- Dépôt (Conduites ↔ parking, près de la base) ---------- */
function tephraDepot(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), zo = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  // carothèque : on y range les carottes de forage ; traversante (portes décalées), rayonnages hauts
  const X0 = -19, X1 = -11, [zA, zB] = zr(28, 34), H = 4.0, T = TPH.T, tint = [0.78, 0.8, 0.78];
  tpWall('z', X0 + T / 2, zA, zB, H, [{ ...zo(30.5, 32.5), b0: 0, b1: 2.3 }], tint);
  tpWall('z', X1 - T / 2, zA, zB, H, [{ ...zo(29.0, 31.0), b0: 0, b1: 2.3 }], tint);
  tpWall('x', Z(28) + s * T / 2, X0 + T, X1 - T, H, [{ a0: -17.5, a1: -15, b0: 1.2, b1: 2.3 }], tint);
  tpWall('x', Z(34) - s * T / 2, X0 + T, X1 - T, H, [{ a0: -15, a1: -12.5, b0: 1.2, b1: 2.3 }], tint);
  tpGlass('x', Z(28), -17.5, -15, 1.2, 2.3, -s); tpGlass('x', Z(34), -15, -12.5, 1.2, 2.3, s);
  tpFloor(X0 + T, X1 - T, zA + T, zB - T, 'concrete', [0.6, 0.6, 0.58]);
  tpSlab(X0, X1, zA, zB, H); tpRoofCap(X0, X1, zA, zB, H, tpAccent(Z(1))); tpCeiling(X0 + T, X1 - T, zA + T, zB - T, H - 0.32, 'ceilc');
  for (const x of [-16.6, -13.6]) { const [a, b] = zr(28.6, 30.0); box('steel', x - 0.5, x + 0.5, 0, 2.4, a, b, { tint: [0.4, 0.44, 0.48], m: 'metal' }); }
  { const [a, b] = zr(32.0, 33.4); box('steel', -16.4, -14.0, 0, 2.4, a, b, { tint: [0.4, 0.44, 0.48], m: 'metal' }); }
  tpTank(-9.6, Z(36.0), 0.75, 2.6);
  tpFace('e', X0, X1, zA, zB, (M, at) => tpSignBoard(M, at(Z(30)), 2.5, 2.0, 0.62, TPS.cores));
  DECOR.place(PF.tpGps(), -17.5, H + 0.06, Z(29.2), s > 0 ? 0.3 : 2.8);
}
/* Citerne horizontale (fioul) sur berceaux, le long de x */
function tpTank(x, z, r, L) {
  const M = DECOR;
  M.save().move(x + L / 2, r + 0.35, z).rotZ(Math.PI / 2).color([0.86, 0.86, 0.82]).local(1); M.cyl('paint', r, L, 16); M.restore(); // (le cylindre part de x + L/2 vers -x : centré sur ses berceaux et sa collision)
  M.save().move(x, 0, z).color(TP.concrete).world(1); for (const dx of [-L / 3, L / 3]) M.boxB('concrete', dx - 0.2, dx + 0.2, 0, 0.5, -r * 0.8, r * 0.8); M.restore();
  DECOR.col(x - L / 2, x + L / 2, 0, r * 2 + 0.35, z - r, z + r, 'metal');
}

/* ---------- Parking (couloir central, devant chaque base : points A et C) ---------- */
function tephraParking(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  car(5.0, Z(36.0), Math.PI / 2, [0.9, 0.9, 0.88], false, 'offroad'); car(-5.0, Z(23.4), -Math.PI / 2, tpAccent(Z(1)));
  // couverts fixes autour du point (murets jersey, armoires, groupe électrogène), hors de son disque
  jersey(-3.0, Z(36.3), 3.2, 'x'); jersey(3.4, Z(24.0), 3.2, 'x'); jersey(-6.2, Z(27.8), 2.4, 'z');
  DECOR.place(PF.generator(), 6.0, 0, Z(29.5), Math.PI / 2);
  { const [a, b] = zr(31.6, 32.4); box('paint', -6.6, -5.6, 0, 1.5, a, b, { tint: [0.46, 0.5, 0.44], m: 'metal' }); }
  { const [a, b] = zr(25.6, 26.4); box('concrete', 0.2, 1.8, 0, 0.95, a, b, { tint: TP.concrete }); }
  lampPost(-7.2, Z(33.5), -Math.PI / 2); lampPost(7.2, Z(26.5), Math.PI / 2);
}

/* ---------- Salle de contrôle de la centrale (allée ↔ centrale) ---------- */
function tephraControl(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), zo = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  const X0 = 7, X1 = 20, [zA, zB] = zr(12, 26), H = TPH.ctlH, T = TPH.T, tint = [0.82, 0.84, 0.84];
  tpWall('z', X0 + T / 2, zA, zB, H, [{ ...zo(13, 17.5), b0: 0.9, b1: 2.6 }, { ...zo(18.75, 20.25), b0: 0, b1: 2.3 }, { ...zo(21.5, 25), b0: 0.9, b1: 2.6 }], tint);
  tpWall('z', X1 - T / 2, zA, zB, H, [{ ...zo(14.75, 16.25), b0: 0, b1: 2.3 }, { ...zo(18, 24), b0: 0.9, b1: 2.6 }], tint);
  // nord : seulement de x 7 à 14 (au-delà, le mur sud de la salle des turbines, percé de la porte entre les deux)
  tpWall('x', Z(12) + s * T / 2, X0 + T, 14, H, [{ a0: 8.5, a1: 12.5, b0: 0.9, b1: 2.6 }], tint);
  tpWall('x', Z(26) - s * T / 2, X0 + T, X1 - T, H, [{ a0: 9, a1: 18, b0: 0.9, b1: 2.6 }], tint);
  for (const [a, b] of [zr(13, 17.5), zr(21.5, 25)]) tpGlass('z', X0, a, b, 0.9, 2.6, -1, true);
  tpGlass('z', X1, ...zr(18, 24), 0.9, 2.6, 1, true);
  tpGlass('x', Z(12), 8.5, 12.5, 0.9, 2.6, -s, true); tpGlass('x', Z(26), 9, 18, 0.9, 2.6, s, true);
  tpFloor(X0 + T, X1 - T, zA + T, zB - T, 'vinyl', [0.5, 0.52, 0.56]);
  tpSlab(X0, X1, zA, zB, H); tpCeiling(X0 + T, X1 - T, zA + T, zB - T, H - 0.32);
  tpRoofCap(X0, X1, zA, zB, H, tpAccent(Z(1)));
  // pupitres de conduite (couverts bas), écrans tournés vers l'ouest : les opérateurs regardent vers le mur d'images
  { const [a, b] = zr(14.4, 17.6); DECOR.col(9.0, 10.0, 0, 1.0, a, b, 'metal'); DECOR.place(PF.tpConsole(3.2), 9.5, 0, Z(16.0), -Math.PI / 2); }
  { const [a, b] = zr(15.5, 19.5); DECOR.col(15.2, 16.2, 0, 1.0, a, b, 'metal'); DECOR.place(PF.tpConsole(4.0), 15.7, 0, Z(17.5), -Math.PI / 2); }
  // mur d'images sur la cloison du bureau du chef de quart (face ouest)
  tpAt(15.93, 0, Z(23.2), -Math.PI / 2, (M) => {
    M.save().color([0.1, 0.1, 0.11]).local(1); M.boxB('plastic', -2.3, 2.3, 1.25, 3.25, 0, 0.04); M.restore();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x0 = -2.25 + i * 1.5; M.save().color([1, 1, 1]); tpAtlasQuad(M, 'screenTp', x0 + 0.02, x0 + 1.48, 1.3 + j * 0.98, 2.24 + j * 0.98, 0.045, tpSignUV((i + j) % 2 ? TPS.map : TPS.seismo)); M.restore(); }
  });
  tpFace('w', X0, X1, zA, zB, (M, at) => tpSignBoard(M, at(Z(19.5)), 2.72, 2.6, 0.82, TPS.control));
  // bureau du chef de quart au sud-est (porte sur la salle)
  { const pt = [0.84, 0.85, 0.84], [a, b] = zr(20.5, 26); box('panel', 15.94, 16.06, 0, H - 0.3, a + (s > 0 ? 0 : T), b - (s > 0 ? T : 0), { tint: pt });
    const zc = Z(20.5); box('panel', 16.0, 17.0, 0, H - 0.3, zc - 0.06, zc + 0.06, { tint: pt }); box('panel', 18.5, X1 - T, 0, H - 0.3, zc - 0.06, zc + 0.06, { tint: pt });
    const [c, d] = zr(23.2, 24.6); box('paint', 17.0, 19.2, 0, 0.8, c, d, { tint: [0.5, 0.4, 0.3], m: 'wood' }); }
  // salle des serveurs, vitrée, au sud-ouest : baies de serveurs (couverts hauts)
  { const zc = Z(22), pt = [0.7, 0.72, 0.74]; box('panel', X0 + T, 9.5, 0, H - 0.3, zc - 0.06, zc + 0.06, { tint: pt }); box('panel', 11.0, 12.0, 0, H - 0.3, zc - 0.06, zc + 0.06, { tint: pt });
    { const [a, b] = [Z(22), Z(26) - s * T].sort((p, q) => p - q); box('panel', 11.94, 12.06, 0, H - 0.3, a, b, { tint: pt }); } // jusqu'au mur extérieur, des deux côtés
    for (const x of [8.4, 10.2]) { const [c, d] = zr(23.4, 25.3); DECOR.col(x - 0.35, x + 0.35, 0, 2.1, c, d, 'metal'); for (const z of [23.75, 24.35, 24.95]) DECOR.place(PF.tpRack(), x, 0, Z(z), x < 9 ? Math.PI / 2 : -Math.PI / 2); } }
}

/* ---------- Centrale : tuyauteries et séparateurs (couloir est, de la base à la salle des turbines) ---------- */
function tephraYard(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  tpSeparator(25.2, Z(21.0), 1.7, 7.5); tpSeparator(28.6, Z(16.2), 1.3, 6.0);
  { const [a, b] = zr(29.4, 31.2); tpBlock('paint', 21.4, 24.2, 0, 1.25, a, b, [0.24, 0.42, 0.62]); } // groupe de pompage
  { const [a, b] = zr(31.0, 34.4); tpBlock('panel', 27.0, 30.6, 0, 2.6, a, b, [0.78, 0.8, 0.8]); } // aéroréfrigérant
  { const [a, b] = zr(16.0, 18.8); tpBlock('steel', 22.0, 23.7, 0, 1.35, a, b, TP.steel); } // nourrice de vannes (hors du passage de la porte de la salle de contrôle)
  for (const z of [26.5, 35.5]) tpRack(20.6, TPH.east - 0.4, Z(z));
  // sous-station électrique (cour entre la base et la salle de contrôle) : bloc plein, transformateurs
  { const [a, b] = zr(28.5, 34.5); tpShed(9.5, 16.5, a, b, 3.5, tpAccent(Z(1)), null); }
  DECOR.place(PF.reel(), 18.2, 0, Z(36.2), 0.3);
}
/* Séparateur de vapeur : colonne verticale, fonds bombés, échelle à crinoline ; collision carrée */
function tpSeparator(x, z, r, h) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.88, 0.88, 0.86]).local(1);
  M.lathe('jacket', [[0, 0.8], [r * 0.7, 0.85], [r, 1.2], [r, h - 0.6], [r * 0.7, h - 0.2], [0, h]], 18);
  M.color(TP.steel); for (const a of [0, 2.1, 4.2]) { M.save().move(Math.cos(a) * r * 0.85, 0, Math.sin(a) * r * 0.85); M.cyl('steel', 0.09, 1.1, 6); M.restore(); }
  M.restore();
  DECOR.col(x - r, x + r, 0, h, z - r, z + r, 'metal');
}
/* Rack de tuyauterie au-dessus du couloir : deux poteaux, traverse, trois conduites (les tirs s'y arrêtent) */
function tpRack(x0, x1, z) {
  const M = DECOR, y = 4.8;
  M.save().color(TP.steel).local(1);
  for (const x of [x0, x1]) { M.boxB('steel', x - 0.15, x + 0.15, 0, y + 0.3, z - 0.15, z + 0.15); }
  M.boxB('steel', x0, x1, y, y + 0.3, z - 0.18, z + 0.18);
  M.restore();
  for (const x of [x0, x1]) DECOR.col(x - 0.15, x + 0.15, 0, y + 0.3, z - 0.15, z + 0.15, 'metal');
  for (const [dz, r] of [[-0.35, 0.22], [0, 0.16], [0.32, 0.26]]) { tpPipeX(x0 - 0.5, x1 + 0.5, y + 0.3 + r, z + dz, r); }
  DECOR.col(x0, x1, y + 0.3, y + 0.85, z - 0.6, z + 0.6, 'metal', true);
}

/* ---------- Passerelle de tuyauterie : la vapeur des puits traverse la carte jusqu'à la centrale (z = ±10, à 5,6 m) ---------- */
function tephraBridge(s) {
  const z = 10 * s, y = 5.6, M = DECOR;
  for (const x of [-28.2, -19.5, -8.0, 8.0, 13.4]) {
    M.save().move(x, 0, z).color(TP.steel).local(1);
    for (const dz of [-0.7, 0.7]) M.boxB('steel', -0.13, 0.13, 0, y - 0.35, dz - 0.13, dz + 0.13);
    M.boxB('steel', -0.16, 0.16, y - 0.45, y - 0.25, -0.95, 0.95);
    M.restore();
    for (const dz of [-0.7, 0.7]) DECOR.col(x - 0.13, x + 0.13, 0, y - 0.35, z + dz - 0.13, z + dz + 0.13, 'metal');
  }
  for (const dz of [-0.4, 0.4]) tpPipeX(-29.4, 14, y, z + dz, 0.32);
  DECOR.col(-29.4, 14, y - 0.35, y + 0.35, z - 0.75, z + 0.75, 'metal', true);
}

/* ---------- Station de pompage (au milieu des Conduites) : les conduites y entrent et en ressortent ---------- */
function tephraPumpHouse() {
  const X0 = -32, X1 = -22, Z0 = -3.5, Z1 = 3.5, H = 4.2, T = TPH.T, tint = [0.8, 0.8, 0.77];
  // les conduites la traversent le long du mur ouest ; on la traverse du nord au sud (portes de 2 m), l'esplanade se voit par les baies de l'est
  for (const z of [Z0, Z1]) tpWall('x', z + (z < 0 ? T / 2 : -T / 2), X0, X1, H, [{ a0: -26.5, a1: -24.5, b0: 0, b1: 2.3 }], tint, 'concrete');
  tpWall('z', X1 - T / 2, Z0 + T, Z1 - T, H, [{ a0: -2.6, a1: -0.8, b0: 1.2, b1: 2.3 }, { a0: 0.8, a1: 2.6, b0: 1.2, b1: 2.3 }], tint, 'concrete');
  for (const [a, b] of [[-2.6, -0.8], [0.8, 2.6]]) tpGlass('z', X1, a, b, 1.2, 2.3, 1);
  DECOR.col(X0, TPH.pipeEdge, 0, 1.95, Z0, Z1, 'metal');
  tpFloor(TPH.pipeEdge, X1 - T, Z0 + T, Z1 - T, 'concrete', [0.55, 0.56, 0.55]);
  tpSlab(X0, X1, Z0, Z1, H); tpRoofCap(X0, X1, Z0, Z1, H, [0.55, 0.56, 0.57]); tpCeiling(X0, X1 - T, Z0 + T, Z1 - T, H - 0.32, 'ceilc');
  // deux pompes de réinjection et leur moteur, armoire de commande
  for (const z of [-1.4, 1.4]) {
    const M = DECOR; M.save().move(-28.4, 0, z).color([0.24, 0.42, 0.62]).local(1);
    M.boxB('steel', -1.0, 1.0, 0, 0.35, -1.25, 1.25); M.save().move(0.9, 0.95, 0).rotZ(Math.PI / 2); M.cyl('paint', 0.55, 1.8, 14); M.restore(); // (centré sur son socle)
    M.restore();
  }
  DECOR.col(TPH.pipeEdge, -27.4, 0, 1.5, -2.65, 2.65, 'metal');
  tpBlock('paint', -23.0, -22.3, 0, 1.9, -0.7, 0.7, [0.5, 0.52, 0.54]);
  tpFace('e', X0, X1, Z0, Z1, (M, at) => tpSignBoard(M, at(0), 2.55, 2.4, 0.75, TPS.pump));
}
/* ---------- Esplanade (à l'ouest de l'observatoire : point B), fumerolles ---------- */
function tephraEsplanade() {
  const M = DECOR;
  // bacs de mousse et bancs (couverts bas), en dehors du disque du point B ; celui de l'ouest dans l'axe du point (en travers, il coupait en
  // deux l'accès du nord-ouest et celui du nord : cinq entrées pour B)
  for (const s of [1, -1]) {
    for (const [x, z, w, d] of [[-18.5, 7.6, 1.1, 3.2], [-10.8, 7.2, 3.2, 1.1], [-25.5, 9.0, 1.1, 2.6]]) {
      const [a, b] = [s * (z - d / 2), s * (z + d / 2)].sort((p, q) => p - q);
      box('concrete', x - w / 2, x + w / 2, 0, 0.85, a, b, { tint: TP.concrete });
      M.save().color([0.9, 0.92, 0.85]).world(1); M.boxB('moss', x - w / 2 + 0.12, x + w / 2 - 0.12, 0.85, 0.9, a + 0.12, b - 0.12, { skip: 'y' }); M.restore();
    }
  }
  // fumerolles au bord de l'esplanade (hors du disque du point B) : croûte de soufre, petit cône de cendre jaunie, vapeur (tephraSteam)
  for (const [x, z, r] of [[-18.2, 4.9, 1.0], [-11.0, -5.0, 0.8], [-24.6, -5.6, 1.1], [-8.8, 6.2, 0.7]]) {
    tpGroundDecal(TPD.sulfur, x, z, r * 3.2, r * 3.2, x * 1.7);
    M.save().move(x, 0, z).color([0.95, 0.92, 0.8]).local(1); M.lathe('sulfur', [[0.85 * r, -0.02], [0.7 * r, 0.03], [0.35 * r, 0.1 * r], [0.15 * r, 0.14 * r], [0.07 * r, 0.09 * r], [0, 0.07 * r]], 10); M.restore();
    TPH.vents.push({ x, y: 0.14 * r, z, r: 0.18 * r, k: r * 0.7, low: true });
  }
  DECOR.place(PF.tpGas(), -21.6, 0, -4.4, 0.6); DECOR.col(-21.66, -21.54, 0, 2.2, -4.46, -4.34, 'metal');
  // bombe volcanique sur son socle, à l'entrée de l'esplanade
  box('concrete', -21.2, -19.8, 0, 0.6, -0.7, 0.7, { tint: TP.concrete });
  M.save().move(-20.5, 0.6, 0).color([0.95, 0.9, 0.86]).local(1); M.lathe('basalt', [[0, 0], [0.5, 0.05], [0.62, 0.35], [0.5, 0.75], [0.22, 0.95], [0, 1.0]], 12, { sharp: 1.0 }); M.restore();
  DECOR.col(-21.2, -19.8, 0.6, 1.6, -0.6, 0.6, 'concrete');
}

/* ---------- Observatoire (centre) : salle en anneau autour de la tour, radôme ---------- */
function tephraObservatory() {
  const X0 = -6.5, X1 = 6.5, Z0 = -7, Z1 = 7, H = TPH.obsH, T = TPH.T, tint = TP.white;
  tpWall('z', X0 + T / 2, Z0, Z1, H, [{ a0: -5.5, a1: -2.5, b0: 1.0, b1: 2.4 }, { a0: -1.5, a1: 1.5, b0: 0, b1: 2.6 }, { a0: 2.5, a1: 5.5, b0: 1.0, b1: 2.4 }], tint);
  tpWall('z', X1 - T / 2, Z0, Z1, H, [{ a0: -5.5, a1: -2.5, b0: 1.0, b1: 2.4 }, { a0: -1.5, a1: 1.5, b0: 0, b1: 2.6 }, { a0: 2.5, a1: 5.5, b0: 1.0, b1: 2.4 }], tint);
  for (const z of [Z0, Z1]) tpWall('x', z + (z < 0 ? T / 2 : -T / 2), X0 + T, X1 - T, H, [{ a0: -1.5, a1: 1.5, b0: 0, b1: 2.6 }], tint);
  for (const [a, b] of [[-5.5, -2.5], [2.5, 5.5]]) { tpGlass('z', X0, a, b, 1.0, 2.4, -1, true); tpGlass('z', X1, a, b, 1.0, 2.4, 1, true); }
  tpFloor(X0 + T, X1 - T, Z0 + T, Z1 - T, 'vinyl', [0.76, 0.75, 0.72]);
  tpSlab(X0, X1, Z0, Z1, H); tpCeiling(X0 + T, X1 - T, Z0 + T, Z1 - T, H - 0.32);
  tpRoofCap(X0, X1, Z0, Z1, H, [0.55, 0.56, 0.57]);
  // tour centrale (pleine) et radôme ; sur ses quatre faces, les écrans de la surveillance
  box('panel', -2.2, 2.2, 0, 11.0, -2.2, 2.2, { tint: TP.white, m: 'concrete' });
  for (let k = 0; k < 4; k++) tpAt(Math.sin((k * Math.PI) / 2) * 2.2, 0, Math.cos((k * Math.PI) / 2) * 2.2, (k * Math.PI) / 2, (M) => {
    M.save().color([0.1, 0.1, 0.11]).local(1); M.boxB('plastic', -1.7, 1.7, 1.3, 2.4, 0, 0.04); M.restore();
    for (let i = 0; i < 2; i++) { M.save().color([1, 1, 1]); tpAtlasQuad(M, 'screenTp', -1.66 + i * 1.68, -0.02 + i * 1.68, 1.34, 2.36, 0.045, tpSignUV((i + k) % 2 ? TPS.map : TPS.seismo)); M.restore(); }
  });
  // enregistreurs à tambour sous les baies de l'ouest et de l'est (couverts bas)
  for (const sx of [-1, 1]) for (const z of [-4, 4]) { DECOR.col(sx * 6.15 - (sx > 0 ? 0.7 : 0), sx * 6.15 + (sx > 0 ? 0 : 0.7), 0, 0.8, z - 0.9, z + 0.9, 'wood'); DECOR.place(PF.tpDrums(), sx * 5.8, 0, z, (-sx * Math.PI) / 2); }
  DECOR.place(PF.tpWeather(), 4.6, H + 0.06, 5.0, 0.4); DECOR.place(PF.tpGps(), -4.8, H + 0.06, -5.2, 2.0);
  const M = DECOR;
  M.save().move(0, 11.0, 0).color([0.95, 0.95, 0.93]).local(1); M.lathe('panel', [[0, -0.2], [2.4, -0.2], [3.1, 0.6], [3.3, 1.8], [3.1, 3.0], [2.4, 4.1], [1.3, 4.8], [0, 5.0]], 24); M.restore();
}

/* ---------- Galerie (entre l'observatoire et la salle des turbines) ---------- */
function tephraGallery() {
  // couloir technique couvert (x de 6,5 à 14) : portes au nord et au sud, l'observatoire et la salle des turbines s'y ouvrent
  const X0 = 6.5, X1 = 14, H = 4.2, T = TPH.T, tint = [0.78, 0.8, 0.8];
  for (const z of [-7, 7]) tpWall('x', z + (z < 0 ? T / 2 : -T / 2), X0, X1, H, [{ a0: 9.0, a1: 11.5, b0: 0, b1: 2.5 }], tint);
  tpFloor(X0, X1, -7 + T, 7 - T, 'concrete', [0.55, 0.56, 0.55]);
  tpSlab(X0, X1, -7, 7, H); tpRoofCap(X0, X1, -7, 7, H, [0.55, 0.56, 0.57]); tpCeiling(X0, X1, -7 + T, 7 - T, H - 0.32, 'ceilc');
  for (const s of [1, -1]) { const [a, b] = [s * 3.4, s * 4.8].sort((p, q) => p - q); box('paint', 6.8, 7.8, 0, 2.0, a, b, { tint: [0.5, 0.52, 0.54], m: 'metal' }); box('paint', 12.7, 13.7, 0, 2.0, -b, -a, { tint: [0.46, 0.5, 0.44], m: 'metal' }); } // armoires électriques
  DECOR.place(PF.tpGps(), 10.3, H + 0.06, 0.2, 1.2);
}

/* ---------- Salle des turbines (est, au centre) : deux groupes turbo-alternateurs, mezzanine le long du mur ouest ---------- */
function tephraHall() {
  const X0 = 14, X1 = TPH.east, Z0 = -12, Z1 = 12, H = TPH.hallH, T = TPH.T, tint = [0.82, 0.84, 0.84], Y = TPH.mezY;
  tpWall('z', X0 + T / 2, Z0, Z1, H, [{ a0: -1.5, a1: 1.5, b0: 0, b1: 2.6 }, { a0: -10, a1: -4, b0: 5.4, b1: 7.4 }, { a0: 4, a1: 10, b0: 5.4, b1: 7.4 }], tint);
  tpWall('z', X1 - T / 2, Z0, Z1, H, [{ a0: -10, a1: -2, b0: 5.4, b1: 7.4 }, { a0: 2, a1: 10, b0: 5.4, b1: 7.4 }], tint);
  for (const z of [Z0, Z1]) tpWall('x', z + (z < 0 ? T / 2 : -T / 2), X0 + T, X1 - T, H, [{ a0: 14.6, a1: 16.6, b0: 0, b1: 2.4 }, { a0: 23.5, a1: 29.5, b0: 0, b1: 5.2 }], tint);
  for (const [a, b] of [[-10, -4], [4, 10]]) tpGlass('z', X0, a, b, 5.4, 7.4, -1);
  for (const [a, b] of [[-10, -2], [2, 10]]) tpGlass('z', X1, a, b, 5.4, 7.4, 1);
  tpFloor(X0 + T, X1 - T, Z0 + T, Z1 - T, 'concrete', [0.6, 0.62, 0.62]);
  box('corrugated', X0 + 0.02, X1 - 0.02, H - 0.25, H + 0.01, Z0 + 0.02, Z1 - 0.02, { tint: [0.7, 0.72, 0.72] }); tpCeiling(X0 + T, X1 - T, Z0 + T, Z1 - T, H - 0.27, 'ceilc');
  // groupes turbo-alternateurs (couverts hauts) ; groupe de pompage du condenseur face à la porte ouest. Entre les deux grandes portes, l'allée
  // droite le long des turbines ne voit pas plus loin que les séparateurs des cours
  for (const s of [1, -1]) { const [a, b] = [s * 2.5, s * 9.5].sort((p, q) => p - q); tpTurbine(25, 29.6, a, b); }
  tpBlock('paint', 17.6, 21.4, 0, 1.9, -1.6, 1.6, [0.24, 0.42, 0.62]);
  // mezzanine le long du mur ouest ; escaliers droits le long des murs nord et sud, qui y arrivent de plain-pied
  box('grating', X0 + T, 16.8, Y - 0.15, Y, Z0 + T, Z1 - T, { tint: [0.62, 0.64, 0.64], m: 'metal' });
  for (const s of [1, -1]) {
    const [a, b] = [s * 9.9, s * 11.5].sort((p, q) => p - q);
    ramp(16.8, 23.2, a, b, 'x', Y, 0, 'steel', [0.5, 0.52, 0.53], { mat: 'steel' }); // 0,56 m par mètre : la grille des bots relie ses nœuds
    rampGuard(16.8, 23.2, a, b, 'x', Y, 0, [s > 0 ? 0 : 1]);
    // sous la mezzanine : armoires en quinconce (pas de vue de porte à porte le long du mur)
    { const [c, d] = [s * 3.5, s * 5.5].sort((p, q) => p - q); tpBlock('paint', 14.3, 15.4, 0, 2.1, c, d, [0.5, 0.52, 0.54]); }
    { const [c, d] = [s * 7.5, s * 8.5].sort((p, q) => p - q); tpBlock('paint', 15.7, 16.7, 0, 1.9, c, d, [0.46, 0.5, 0.44]); }
  }
  railing(16.8, 16.8, Y, -9.9, 9.9, 'z');
  for (const s of [1, -1]) tpGroundDecal(TPD.stripes, 26.5, s * 11.25, 6.0, 0.9, 0, 0.034);
}
/* Groupe turbo-alternateur : socle, turbine (carter à cannelures), alternateur ; collision en un bloc */
function tpTurbine(x0, x1, z0, z1) {
  const M = DECOR, cx = (x0 + x1) / 2, w = x1 - x0;
  M.save().color([0.5, 0.52, 0.5]).world(1); M.boxB('concrete', x0, x1, 0, 0.6, z0, z1, { bevel: 0.03 }); M.restore();
  M.save().move(cx, 0.6 + w * 0.32, z0 + 0.2).rotX(Math.PI / 2).color([0.3, 0.48, 0.42]).local(1); M.cyl('paint', w * 0.36, z1 - z0 - 0.4, 18); M.restore(); // (de z0 + 0,2 à z1 - 0,2, sur son socle)
  DECOR.col(x0, x1, 0, 0.6 + w * 0.68, z0, z1, 'metal');
}

/* ---------- Arrière-plan (provisoire : sol au-delà des bornes) ---------- */
function tephraBackdrop() {
  // repères des deux moitiés : derrick de forage au sud (Alpha), mât de télécommunication au nord (Bravo)
  tpDerrick(-10, 72); tpMast(10, -72);
}
/* Derrick de forage (repère du sud) : tour en treillis rouge et blanc sur son plancher, moufle au sommet ; sans collision (hors des bornes) */
function tpDerrick(x, z) {
  const M = DECOR, H = 30, b = 4.2, t = 1.0; WORLD.force = 'far';
  M.save().move(x, 0, z).local(1); M.cls = 1;
  M.color([0.55, 0.56, 0.57]); M.boxB('steel', -6, 6, 0, 5.5, -6, 6, { bevel: 0.05 });
  const leg = (sx, sz) => [[sx * b, 5.5, sz * b], [sx * t, 5.5 + H, sz * t]];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.tube('steel', 0.16, leg(sx, sz), 6);
  for (let k = 0; k < 10; k++) {
    const y = 5.5 + (k / 10) * H, w = lerp(b, t, k / 10), y2 = 5.5 + ((k + 1) / 10) * H, w2 = lerp(b, t, (k + 1) / 10);
    M.color(k % 2 ? [0.92, 0.92, 0.9] : [0.78, 0.14, 0.1]);
    for (const [a, c] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
      M.tube('steel', 0.07, [[a[0] * w, y, a[1] * w], [c[0] * w, y, c[1] * w]], 4);
      M.tube('steel', 0.05, [[a[0] * w, y, a[1] * w], [c[0] * w2, y2, c[1] * w2]], 4);
    }
  }
  M.color([0.78, 0.14, 0.1]); M.boxB('steel', -1.4, 1.4, 5.5 + H, 5.5 + H + 1.2, -1.4, 1.4);
  M.restore(); WORLD.force = null;
}
/* Mât de télécommunication (repère du nord) : treillis triangulaire, paraboles et panneaux, feux rouges ; sans collision */
function tpMast(x, z) {
  const M = DECOR, H = 36, r = 1.1; WORLD.force = 'far';
  M.save().move(x, 0, z).local(1); M.cls = 1;
  M.color(TP.concrete); M.boxB('concrete', -2, 2, 0, 0.6, -2, 2);
  const P = [0, 1, 2].map((k) => [Math.cos((k / 3) * TAU) * r, Math.sin((k / 3) * TAU) * r]);
  M.color([0.85, 0.86, 0.86]);
  for (const [px, pz] of P) M.tube('steel', 0.08, [[px, 0.6, pz], [px * 0.6, H, pz * 0.6]], 5);
  for (let k = 0; k < 18; k++) {
    const y = 0.6 + (k / 18) * (H - 0.6), f = lerp(1, 0.6, k / 18), y2 = 0.6 + ((k + 1) / 18) * (H - 0.6), f2 = lerp(1, 0.6, (k + 1) / 18);
    M.color(k % 4 < 2 ? [0.82, 0.16, 0.1] : [0.9, 0.9, 0.88]);
    for (let i = 0; i < 3; i++) { const a = P[i], c = P[(i + 1) % 3]; M.tube('steel', 0.04, [[a[0] * f, y, a[1] * f], [c[0] * f2, y2, c[1] * f2]], 4); }
  }
  M.color([0.9, 0.9, 0.88]);
  for (const [y, a] of [[24, 0.5], [27, 2.6], [30, 4.4]]) { M.save().move(Math.cos(a) * 1.2, y, Math.sin(a) * 1.2).rotY(-a + Math.PI / 2).rotX(-Math.PI / 2); M.lathe('steel', [[0, -0.1], [0.6, 0.0], [0.95, 0.18], [1.0, 0.22]], 14, { sharp: 1.2 }); M.restore(); }
  M.restore(); WORLD.force = null;
}

/* ---------- Sol et relief : la station est une plate-forme taillée dans le flanc du volcan ---------- */
/* Bruit de taille f (m), périodique tous les 32 f mètres ; oct octaves */
function tpN(x, z, f, oct = 3, o = 0) { return TPH.noise.fbm(x / (f * 32) + o, z / (f * 32), 32, 32, oct); }
/* Le volcan : axe du cratère à 290 m à l'ouest, dans l'axe de la carte (les deux camps le voient pareil) ; lèvre à 150 m au-dessus de la
   station ; flancs concaves, pente de 48° sous la lèvre, 14° au niveau de la station, qui continue de descendre vers l'est ; cone : rayon
   couvert par le maillage fin du cône (tephraVolcano), au-delà l'anneau de terrain prend le relais */
const TP_V = { x: -290, z: 0, rc: 26, s0: 1.1, L: 175, cone: 205 };
/* Hauteur du volcan (m, par rapport à la station) à la distance r de l'axe du cratère ; dans le cratère, une cuvette de 34 m */
function tpVolcH(r) {
  const V = TP_V, f = (q) => -V.s0 * V.L * (1 - Math.exp(-(Math.max(q, V.rc) - V.rc) / V.L)), base = f(hyp(V.x, V.z));
  return r < V.rc ? -base - 34 * (1 - (r / V.rc) ** 2) : f(r) - base;
}
/* Hauteur du terrain : la station plate (talus de déblai à l'ouest, de remblai à l'est, sur 25 m), la tranchée des conduites au-delà des
   clôtures, les plates-formes du derrick et du mât ; ailleurs, le flanc du volcan et ses grandes ondulations, le champ de lave bosselé
   (tumulus, crêtes de coulées) ; smooth : sans les bosses. Sous les coulées, un chenal lissé où la lave se pose (tephraLavaFlows) */
function tpGroundH(x, z, smooth = false) {
  const dx = Math.max(-36 - x, x - 34, 0), dz = Math.max(Math.abs(z) - 66, 0), d = hyp(dx, dz);
  if (d <= 0) return 0;
  let flat = smoothstep(1.5, 26, d);
  if (Math.abs(z) > 60) flat *= smoothstep(4.5, 9, Math.abs(x + 30.5));
  flat *= smoothstep(11, 18, hyp(x + 10, z - 72)) * smoothstep(8, 14, hyp(x - 10, z + 72));
  const ra = hyp(x - TP_V.x, z - TP_V.z), big = tpN(x, z, 70, 3, 0.71);
  const base = flat * (tpVolcH(ra) + (big - 0.5) * 14 * smoothstep(30, 200, d) * smoothstep(140, 260, ra));
  if (smooth) return base;
  const tum = Math.pow(tpN(x, z, 7, 3), 1.7), crest = 1 - Math.abs(tpN(x, z, 22, 3, 0.37) * 2 - 1);
  const bumps = flat * (tum * 2.6 + crest * crest * 2.4 * smoothstep(15, 90, d)) * smoothstep(120, 220, ra), ch = 1 - smoothstep(6, 10, tpLavaDist(x, z));
  return base + bumps * (1 - ch) - 0.3 * ch;
}
/* Hauteur des anneaux de terrain : sous le cône (maillage fin), enfoncée de 4 m pour ne pas le percer */
function tpRingH(x, z) { return tpGroundH(x, z) - 4 * (1 - smoothstep(186, 196, hyp(x - TP_V.x, z - TP_V.z))); }
/* Part de mousse (champ de lave : sur les bosses, dans les creux abrités ailleurs) ; la cendre en recouvre une bonne part */
function tpMoss(x, z, y) {
  const r = hyp(x, z) + 1, west = smoothstep(0.15, 0.65, -x / r), n = tpN(x, z, 4, 3, 0.53), m = tpN(x, z, 26, 2, 0.19);
  return clamp(west * smoothstep(0.5, 0.7, n + y * 0.02 + (m - 0.5) * 0.5) + (1 - west) * smoothstep(0.66, 0.84, n + (m - 0.5) * 0.6), 0, 1) * 0.7;
}
/* Lueur de la lave sur le sol voisin : teinte (linéaire) c rougie près d'une coulée */
function tpLavaGlow(c, x, z) { const g = Math.exp(-Math.max(0, tpLavaDist(x, z) - 3) / 7); return [c[0] * lerp(1, 3.2, g), c[1] * lerp(1, 1.3, g), c[2] * lerp(1, 0.55, g)]; }
/* Carte de répartition (asphalte des cours et de l'allée, dalles de l'esplanade, mousse du champ de lave) ; le bord de la carte est de la
   cendre nue : au-delà, l'anneau de terrain lointain (même matière) en reprend la valeur et se teinte par sommet */
const GROUND_TEPHRA = { base: 'ash', l1: 'asphalt', l2: 'pavers', l3: 'moss', pom: [0, 0, 0, 0], dirt: [1.7, 1.62, 1.55], mul: 0, env: 0.3 };
function tephraGround() {
  const S = SPLAT, W = Math.round(S.w * S.ppm), H = Math.round(S.d * S.ppm), out = new Uint8Array(W * H * 4), N = TPH.noise;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4, az = Math.abs(z);
    const n1 = N.fbm(x * 0.08, z * 0.08, 32, 32, 3), n2 = N.fbm(x * 0.23 + 3.1, z * 0.23, 32, 32, 2);
    let r = 0, g = 0, b = 0, a = 0.1 + n2 * 0.35;
    const inside = x > TPH.pipeEdge && x < TPH.east && az < TPH.end;
    if (inside) {
      const road = (az > 40 && x > -29) || (x > -7 && x < 7 && az > 12 && az < 41) || (x > 7 && x < 20 && az > 26 && az < 41) || (x > 20 && az > 12);
      const plaza = x > -22 && x < 7 && az < 12;
      if (road) r = 1; else if (plaza) g = 1;
      if (road) a = 0.15 + n2 * 0.5 * smoothstep(0.4, 0.8, n1);
      // mousse en bordure des conduites et entre les têtes de puits
      if (!road && !plaza && x < -20) b = smoothstep(0.5, 0.72, tpN(x, z, 3, 3, 0.53) + (n1 - 0.5) * 0.3 + (x < -27.5 ? 0.2 : 0));
    } else {
      const y = tpGroundH(x, z, true), edge = Math.min(i, j, W - 1 - i, H - 1 - j);
      b = edge < 3 ? 0 : tpMoss(x, z, y) * (0.75 + n1 * 0.4) * smoothstep(3, 75, edge) * (1 - smoothstep(4, 22, y)); // fondue vers le bord de la carte et sur les pentes hautes
      a = edge < 3 ? 0.25 : 0.2 + n2 * 0.4;
    }
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(a, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_TEPHRA); tpHeightFog(MAT.ground);
  const M = DECOR; WORLD.force = 'g';
  // sol plat de la station (de x -36 à 34, z de -66 à 66), puis deux anneaux de relief : le proche jusqu'au bord de la carte de répartition,
  // le lointain jusqu'à 520 m ; le premier rang de l'anneau proche passe sous le sol plat (pas de fente entre les deux)
  M.save().move(-1, 0, 0).color([0.8, 0.8, 0.78]).local(1); M.aoFn = null; M.plane('ground', 70, 132, 1, 1); M.restore();
  const rect = (x0, x1, zh) => (a) => { const c = Math.cos(a), sn = Math.abs(Math.sin(a)); return Math.min(c < 0 ? -x0 / -c : x1 / Math.max(c, 1e-6), zh / Math.max(sn, 1e-6)); };
  const near = rect(-35.5, 33.5, 65.5), mid = rect(S.x0 + 1, S.x0 + S.w - 1, S.d / 2 - 1), ash = [sl(0.8), sl(0.8), sl(0.78)];
  tpTerrainRing(near, mid, 240, 18, (x, z) => tpLavaGlow(ash, x, z), -0.01);
  // au-delà de la carte de répartition : cendre nue, la même teinte que l'anneau proche (pas de raccord visible), scories rousses en altitude
  tpTerrainRing(mid, () => 520, 240, 22, (x, z, y) => { const k = smoothstep(30, 90, y); return tpLavaGlow([sl(lerp(0.8, 0.9, k)), sl(lerp(0.8, 0.78, k)), sl(lerp(0.78, 0.72, k))], x, z); });
  M.aoFn = null; WORLD.force = null;
}
/* Brouillard plus léger en hauteur, sur le relief : la brume de cendre colle au sol, le haut du volcan reste net (sans couture : il dépend
   de l'altitude seule) */
function tpHeightFog(m) {
  m.defines.TP_HFOG = ''; // programme à part (la clé de cache des programmes du décor ne voit pas la différence des correctifs)
  const p0 = m.userData.patch;
  m.userData.patch = m.onBeforeCompile = (s, r) => {
    p0(s, r);
    s.fragmentShader = s.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * exp( - max( vWPos.y, 0.0 ) / 55.0 ) );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint( fogColor ), fogFactor ); // lueur du soleil dans la brume (01-core.js)
      #endif`);
  };
}
/* Anneau de terrain entre deux contours vus de l'origine (rIn, rOut : distance le long de la direction a) : NU directions, NV rangs resserrés
   près du bord intérieur ; hauteur tpRingH, normale tirée de la pente, teinte (linéaire) par sommet ; y0 : abaissement du premier rang */
function tpTerrainRing(rIn, rOut, NU, NV, tint, y0 = 0) {
  const M = DECOR; M.save().local(1); M.cls = 1; M.aoFn = null;
  const B = M.buf('ground', 0, 0, 0), ids = [], e = 0.6;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const a = (i / NU) * TAU, v = Math.pow(j / NV, 1.5), r = lerp(rIn(a), rOut(a), v), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = tpRingH(x, z) + (j === 0 ? y0 : 0), gx = tpGroundH(x + e, z) - tpGroundH(x - e, z), gz = tpGroundH(x, z + e) - tpGroundH(x, z - e), l = hyp3(gx, 2 * e, gz);
    M.tint = tint(x, z, y);
    ids.push(M.v(B, x, y, z, -gx / l, (2 * e) / l, -gz / l, x, -z));
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = ids[j * (NU + 1) + i], b = ids[j * (NU + 1) + i + 1], c = ids[(j + 1) * (NU + 1) + i + 1], d = ids[(j + 1) * (NU + 1) + i];
    M.quadI(B, a, b, c, d);
  }
  M.restore();
}
/* Le cône du volcan, du cratère à TP_V.cone de son axe : grille polaire resserrée près de la lèvre, ravines qui rayonnent depuis le sommet,
   cuvette du cratère ; teinte : scories rouillées sous la lèvre, rougies par la fontaine, lueur des coulées ; matière du sol (la même cendre
   que le reste du relief). Son bord extérieur passe sous l'anneau de terrain */
function tephraVolcano() {
  const M = DECOR, V = TP_V, N = TPH.noise, NU = 160, NV = 48, e = 0.8; WORLD.force = 'far';
  M.save().local(1); M.cls = 1; M.aoFn = null;
  const B = M.buf('ground', V.x, 0, V.z), ids = [];
  const H = (x, z) => {
    const ra = hyp(x - V.x, z - V.z), phi = Math.atan2(z - V.z, x - V.x) / TAU + 0.5;
    const rav = Math.pow(1 - Math.abs(N.fbm(phi, ra / 260, 40, 3, 3) * 2 - 1), 1.6), amp = 10 * smoothstep(V.rc + 2, V.rc + 30, ra) * (1 - smoothstep(150, 190, ra));
    return tpGroundH(x, z) + (rav - 0.45) * amp * smoothstep(4, 8, tpLavaDist(x, z)) - 0.8 * smoothstep(190, 200, ra);
  };
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const a = (i / NU) * TAU, r = V.cone * Math.pow(j / NV, 1.35), x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
    const y = H(x, z), gx = H(x + e, z) - H(x - e, z), gz = H(x, z + e) - H(x, z - e), l = hyp3(gx, 2 * e, gz), top = Math.exp(-Math.max(0, r - V.rc) / 30);
    M.tint = tpLavaGlow([sl(0.8) * lerp(1, 2.6, top), sl(0.8) * lerp(1, 1.1, top), sl(0.78) * lerp(1, 0.7, top)], x, z);
    ids.push(M.v(B, x, y, z, -gx / l, (2 * e) / l, -gz / l, x, -z));
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = ids[j * (NU + 1) + i], b = ids[j * (NU + 1) + i + 1], c = ids[(j + 1) * (NU + 1) + i + 1], d = ids[(j + 1) * (NU + 1) + i];
    M.quadI(B, a, b, c, d);
  }
  M.restore(); WORLD.force = null;
}
/* Coulées de lave descendues du cratère : axe [x, z] de la lèvre au front, largeur à la lèvre et au front. Deux viennent vers la station et
   s'arrêtent sur la pente, au-dessus des conduites ; une troisième descend le flanc nord */
const TP_LAVA = [
  { p: [[-266, -6], [-240, -14], [-208, -22], [-176, -30], [-146, -29], [-118, -35], [-94, -29], [-76, -22], [-62, -17]], w0: 4, w1: 8 },
  { p: [[-266, 8], [-238, 19], [-206, 31], [-178, 43], [-152, 47], [-128, 57], [-110, 54]], w0: 3.5, w1: 6.5 },
  { p: [[-282, -25], [-268, -56], [-250, -88], [-226, -112], [-200, -126], [-176, -132]], w0: 3, w1: 6 },
];
/* Distance (m) au plus proche axe de coulée */
function tpLavaDist(x, z) {
  let d = 1e9;
  for (const f of TP_LAVA) for (let i = 0; i < f.p.length - 1; i++) {
    const [ax, az] = f.p[i], [bx, bz] = f.p[i + 1], vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    d = Math.min(d, hyp(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}
/* Ruban de lave posé dans son chenal : bords irréguliers, front arrondi ; matière lavaTp, sans collision */
function tephraLavaFlows() {
  const M = DECOR; WORLD.force = 'far'; M.save().local(1).color([1, 1, 1]); M.cls = 1;
  for (const f of TP_LAVA) {
    const P = f.p, pts = [];
    for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], n = Math.ceil(hyp(bx - ax, bz - az) / 3); for (let k = 0; k < n; k++) pts.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]); }
    pts.push(P[P.length - 1]);
    const B = M.buf('lavaTp', P[0][0], 0, P[0][1]); let along = 0, prev = null;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], [nx0, nz0] = pts[Math.min(i + 1, pts.length - 1)], [px0, pz0] = pts[Math.max(i - 1, 0)], tx = nx0 - px0, tz = nz0 - pz0, tl = hyp(tx, tz) || 1;
      const t = i / (pts.length - 1), wid = lerp(f.w0, f.w1, t) * (0.85 + 0.3 * tpN(x, z, 9, 2, 0.4)) * (t > 0.97 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.03)) : 1);
      const ox = -tz / tl, oz = tx / tl;
      if (i) along += hyp(x - pts[i - 1][0], z - pts[i - 1][1]);
      const row = [];
      for (const a of [-1, -0.5, 0, 0.5, 1]) {
        const vx = x + ox * a * wid / 2, vz = z + oz * a * wid / 2, y = tpGroundH(vx, vz, true) + 0.35 - Math.abs(a) * 0.15;
        const k = (1.25 - Math.abs(a) * 0.75) * (0.75 + 0.25 * (1 - t)); M.tint = [k, k, k]; // cœur plus chaud que les bords croûtés, le front refroidi
        row.push(M.v(B, vx, y, vz, 0, 1, 0, (a * wid) / 8, along / 4));
      }
      if (prev) for (let k = 0; k < 4; k++) M.quadI(B, prev[k], prev[k + 1], row[k + 1], row[k]);
      prev = row;
    }
    // fumée lourde au front, là où la lave mord le champ de lave
    const [fx, fz] = P[P.length - 1]; TPH.vents.push({ x: fx, y: tpGroundH(fx, fz, true) + 0.6, z: fz, r: f.w1 * 0.4, k: 1.2, lava: true });
  }
  M.restore(); WORLD.force = null;
}
/* Blocs de lave épars sur le champ de lave (au-delà des conduites, au pied du cône) : basalte bosselé posé sur le relief, sans collision */
function tephraLavaRocks() {
  const M = DECOR, R = rngOf(7123); WORLD.force = 'far';
  for (let k = 0; k < 90; k++) {
    const x = -40 - Math.pow(R(), 1.6) * 100, z = R.range(-105, 105), sz = R.range(0.4, 1.0) * (1 + Math.max(0, -x - 60) / 60), h = sz * R.range(0.6, 1.3);
    if ((Math.abs(z) > 58 && x > -42) || tpLavaDist(x, z) < 10 || hyp(x - TP_V.x, z - TP_V.z) < 215) continue;
    const y = tpGroundH(x, z) - sz * 0.2, prof = [[0, -0.1], [sz * 0.95, 0], [sz * 1.02, h * 0.3], [sz * 0.8, h * 0.62], [sz * 0.45, h * 0.9], [0, h]];
    M.save().move(x, y, z).rotY(R() * TAU).scl(1, 1, R.range(0.7, 1.1)).color([0.95, 0.92, 0.9]).local(1); M.cls = Math.abs(x) < 70 ? 0 : 1;
    M.lathe('basalt', prof, 7, { sharp: 1.0 }); M.restore();
  }
  WORLD.force = null;
}
/* Le cratère vu de la caméra : azimut, rayon apparent, sinus de l'élévation de la lèvre (la colonne éruptive du ciel s'y accroche) */
function tephraSkyAnchor() {
  const U = SkyShader.uniforms.uVolc.value, c = camera.position, dx = TP_V.x - c.x, dz = TP_V.z - c.z, dy = tpVolcH(TP_V.rc) - c.y, dist = hyp3(dx, dy, dz);
  U.x = Math.atan2(dz, dx); U.y = TP_V.rc / dist; U.z = dy / dist;
}

/* ---------- Ambiance : le volcan en éruption, tout proche. La cendre éteint le ciel ; le soleil bas à l'est n'est plus qu'un disque rouge,
   il éclaire de face le flanc du volcan ; la lave rougit le dessous des choses ; brume brun rouge qui colle au sol, cendre déposée sur le
   dessus du décor (coat), braises dans l'air (motes) ---------- */
const ATMO_TEPHRA = Object.assign({}, ATMO_DEFAULT, {
  // nuit d'éruption (chantier des ambiances, octobre 2026) : sous un ciel de cendres, la seule vraie lumière est celle du cratère, rouge et rasante ;
  // la ville a gardé ses lampes et ses fenêtres allumées, le reste du décor tombe dans un noir brun ; ni HDRI de jour ni lumière renvoyée claire
  sun: [0.9, 0.38, 0.12], sunColor: 0xff3a14, sunI: 0.5, vmSun: 0xff4a20,
  fog: [0.12, 0.05, 0.04], fogD: 0.0062,
  hemi: [0x2a1010, 0x401008, 0.15], vmHemi: [0x2a1010, 0x401008],
  sky: {
    zen: [0.024, 0.014, 0.014], mid: [0.13, 0.036, 0.024], hor: [0.44, 0.11, 0.045], gnd: [0.24, 0.075, 0.045],
    glow: [0.9, 0.18, 0.05], halo: [0.3, 0.05, 0.015], disk: [0.62, 0.075, 0.02], cloudLo: [0.09, 0.035, 0.03], cloudHi: [0.55, 0.14, 0.06], cloud: [0.26, 0.7, 0.95],
    ridge: [0.05, 0.06, 0.62], ridgeSnow: [0.2, 0.08, 0.05], ridgeRock: [0.08, 0.036, 0.028],
    // colonne éruptive accrochée au cratère (tephraSkyAnchor recalcule volc à chaque image) : sommet à 76° d'élévation, fontaine, bombes
    volc: [Math.PI, 0.09, 0.45, 0], plume: [0.97, 0.15, 1.0, 1.7], erupt: [1, 1, 0, 0],
  },
  envGround: 0x3a160c, hdri: null, lit: true, lamps: 1.6, winLit: 0.6,
  bounce: [0.25, 0.08, 0.04], dust: [0.3, 0.29, 0.28], motes: [2.2, 0.75, 0.25],
  grade: { lo: [1.0, 0.92, 0.95], hi: [1.1, 0.92, 0.8], exp: 1.2 }, rays: [1.0, 0.35, 0.16],
  impact: [0.3, 0.28, 0.27], wind: [260, 0.1],
  fogH: [0, 0], // le relief a son propre brouillard en altitude (tpHeightFog) : le reste du décor garde un brouillard uniforme, sans couture avec lui
  coat: { top: 0.55, foot: 0.5, color: [0.34, 0.32, 0.31] },
  bloom: [0.6, 0.6, 0.85], aoFloor: 0.36, raysThr: 1.5, raysCap: 6, satExp: 0.85,
  volOpen: true,
});

/* ---------- Vapeur des silencieux et des fumerolles : seulement près de la caméra (la réserve de fumée est partagée avec les tirs), moitié
   moins en qualité Basse ; elle dérive vers le nord-est, comme le panache du volcan ---------- */
const TP_WIND = [0.55, -0.85];
function tephraSteam(dt) {
  if (!TPH.vents || !FX) return;
  const cam = camera.position, lean = RQ.q.lean ? 0.5 : 1;
  for (const v of TPH.vents) {
    const d = hyp(v.x - cam.x, v.z - cam.z); if (d > (v.low ? 38 : v.lava ? 80 : 60)) continue;
    v.acc = (v.acc || 0) + (v.low ? 5 : v.lava ? 3 : 7) * v.k * lean * (d > 30 ? 0.6 : 1) * dt;
    while (v.acc >= 1) {
      v.acc -= 1;
      const a = Math.random() * TAU, r = Math.random() * v.r, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      if (v.lava) FX.smoke.spawn(x, v.y, z, TP_WIND[0] * 0.8 + rand(-0.3, 0.3), rand(1.2, 2.2), TP_WIND[1] * 0.8 + rand(-0.3, 0.3), rand(6, 9), 2.0, rand(7, 10), 0.2, 0.16, 0.14, rand(0.3, 0.42), 0, -0.04, 0.2, rand(-0.2, 0.2));
      else if (v.low) FX.smoke.spawn(x, v.y, z, TP_WIND[0] * 0.3 + rand(-0.15, 0.15), rand(0.5, 1.1), TP_WIND[1] * 0.3 + rand(-0.15, 0.15), rand(2.2, 3.6), 0.25 * v.k + 0.15, rand(1.2, 2.0) * v.k, 0.9, 0.91, 0.92, rand(0.22, 0.32), 0, -0.02, 0.35, rand(-0.4, 0.4));
      else FX.smoke.spawn(x, v.y + 0.1, z, TP_WIND[0] * 0.6 + rand(-0.3, 0.3), rand(1.6, 2.6), TP_WIND[1] * 0.6 + rand(-0.3, 0.3), rand(4.0, 6.0), 1.0, rand(3.5, 5.0), 0.92, 0.93, 0.94, rand(0.18, 0.28), 0, -0.05, 0.25, rand(-0.3, 0.3));
    }
  }
}

/* ---------- Ambiance sonore : enregistrée (05c-ambiance.js, paquet amb_tephra, voir sound dans la définition) ; le volcan gronde : toutes
   les 18 à 40 s, une explosion du cratère qui roule (ponctuel a_boom) ; le tonnerre suit les éclairs de la colonne éruptive ---------- */
function tephraThunder(delay) {
  if (!AMB.out || !sfxHas('a_thunder')) return;
  sfxAt('a_thunder', new V3(TP_V.x, 320, TP_V.z), 0.7, { delay, prop: false, ref: 240, roll: 0.3, verb: 0.3, rate: rand(0.92, 1.05) });
}
/* Éclairs dans la colonne éruptive : toutes les 3 à 11 s, un ou deux éclats ; la cendre s'illumine (ciel), le décor à peine (lumière
   d'ambiance) ; le tonnerre suit, assourdi par la distance */
const TP_BOLT = { next: 5, t: -1, dbl: false };
function tephraLightning(dt) {
  const U = SkyShader.uniforms.uErupt.value, B = TP_BOLT, base = ATMO_TEPHRA.hemi[2];
  B.next -= dt;
  if (B.next <= 0) { B.next = rand(3, 11); B.t = 0; B.dbl = Math.random() < 0.5; U.w = Math.random(); tephraThunder(rand(1.5, 4)); }
  if (B.t < 0) return;
  B.t += dt;
  const f = B.t < 0.07 ? 1 : B.dbl && B.t > 0.15 && B.t < 0.22 ? 0.85 : Math.max(0, 1 - (B.t - 0.07) * 6);
  U.z = f; hemi.intensity = base * (1 + 0.25 * f);
  if (B.t > 0.5) { B.t = -1; U.z = 0; hemi.intensity = base; }
}
/* Pluie de cendre et braises autour de la caméra : pas sous un toit (part de ciel à la verticale, d'après l'éclairage cuit) ; une particule
   sur quatorze est une braise qui monte en vacillant */
const TP_ASH = { obj: null, mat: null };
function tephraAshfall() {
  const n = RQ.q.lean ? 700 : 1400, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), sz = new Float32Array(n), em = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = rand(-18, 18); p[i * 3 + 1] = rand(-4, 12); p[i * 3 + 2] = rand(-18, 18); sz[i] = rand(0.6, 1.4); em[i] = i % 14 === 0 ? 1 : 0; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aE', new THREE.BufferAttribute(em, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 540 }, uT: { value: 0 }, tVol: WMU.tVol, uVolMin: WMU.uVolMin, uVolInv: WMU.uVolInv, uVolL: WMU.uVolL },
    vertexShader: `uniform float uScale, uT; uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv; uniform vec4 uVolL;
      ${VOL_Q}
      attribute float aS, aE; varying float vA, vE;
      void main() {
        vec3 q = clamp((position - uVolMin) * uVolInv, 0.0, 1.0);
        float sky = texture(tVol, VOL_Q(q)).b;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        vE = aE * (0.55 + 0.45 * sin(uT * 9.0 + aS * 40.0));
        vA = smoothstep(0.32, 0.6, sky) * smoothstep(0.7, 2.2, d) * (1.0 - smoothstep(13.0, 19.0, d));
        gl_PointSize = clamp((0.02 + aE * 0.008) * aS * uScale / max(d, 0.1), 1.0, 6.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA, vE; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.2, 1.0, r)) * vA;
      if (a < 0.01) discard; gl_FragColor = vE > 0.0 ? vec4(vec3(3.2, 1.1, 0.28) * vE, a) : vec4(0.2, 0.19, 0.185, a * 0.75); }`,
    transparent: true, depthWrite: false,
  });
  const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 4; o.userData.weather = true; o.userData.noAO = true;
  TP_ASH.obj = mapAdd(o); TP_ASH.mat = m;
}
function tephraAshUpdate(dt, t) {
  const o = TP_ASH.obj; if (!o) return;
  TP_ASH.mat.uniforms.uT.value = t; TP_ASH.mat.uniforms.uScale.value = pointScale();
  const p = o.geometry.attributes.position.array, e = o.geometry.attributes.aE.array, c = camera.position;
  for (let i = 0, j = 0; i < p.length; i += 3, j++) {
    const k = j * 0.618, up = e[j] > 0;
    p[i] += (TP_WIND[0] * (up ? 1.2 : 0.8) + Math.sin(t * 1.3 + k * 5.1) * 0.35) * dt;
    p[i + 1] += (up ? 0.25 + Math.sin(t * 2.1 + k * 3.7) * 0.3 : -(0.55 + (j % 7) * 0.06)) * dt;
    p[i + 2] += (TP_WIND[1] * (up ? 1.2 : 0.8) + Math.cos(t * 1.1 + k * 7.3) * 0.35) * dt;
    if (p[i] - c.x > 18) p[i] -= 36; else if (p[i] - c.x < -18) p[i] += 36;
    if (p[i + 2] - c.z > 18) p[i + 2] -= 36; else if (p[i + 2] - c.z < -18) p[i + 2] += 36;
    if (p[i + 1] - c.y < -4) p[i + 1] += 16; else if (p[i + 1] - c.y > 12) p[i + 1] -= 16;
  }
  o.geometry.attributes.position.needsUpdate = true;
}

/* ---------- Définition de la carte (voir MAP_DEFS dans 02-map.js et 02z-load.js) ---------- */
MAP_DEFS.tephra = {
  type: 'mid', // moyenne à trois couloirs, en longueur : README « Règles de conception d'une carte » ; règle le choix des armes des bots (botArmForMap)
  bounds: { x0: -32, x1: 32, z0: -62, z1: 62 },
  textures: ['asphalt', 'pavers', 'ash', 'steel', 'wood', 'timber'], // la cendre en photo (gravier volcanique) ; basalte, mousse et lave restent procéduraux, plus lisibles
  // ambiance enregistrée (05c-ambiance.js, paquet amb_tephra) : grondement continu du volcan, vent chargé de cendre ; en boucle, le souffle
  // de vapeur des deux silencieux, le bouillonnement des fumerolles, le bourdonnement de la salle des turbines ; de loin en loin, une explosion
  // du cratère qui roule (le tonnerre des éclairs : tephraThunder)
  sound: { pack: 'amb_tephra', bed: 0.5,
    loops: () => [1, -1].map((k) => ({ id: 'a_steam', p: [-23.6, 5.2, k * 30], gain: 0.4, ref: 6, roll: 1.4, max: 160 }))
      .concat((TPH.vents || []).filter((v) => v.low).map((v) => ({ id: 'a_bubble', p: [v.x, 0.3, v.z], gain: 0.3, ref: 3, roll: 1.5, max: 60 })))
      .concat([{ id: 'a_hum', p: [23, 2.5, 0], gain: 0.3, ref: 7, roll: 1.6, max: 90 }]),
    spots: [
      { id: 'a_boom', every: [18, 40], gain: 1.0, at: () => new V3(TP_V.x, 150, TP_V.z), ref: 220, roll: 0.25 },
      { id: 'a_gust', every: [9, 22], gain: 0.35, dist: [4, 12], y: [2, 7] },
    ] },
  surfaces: TEPHRA_SURFACES,
  kit: () => tephraKit(),
  materials: (M) => makeTephraMaterials(M),
  art: { cam: [32, 11, -48], look: [-80, 40, 8], fov: 64 },
  landmarks: [[0, 14.0, 0, 'radôme'], [-10, 26, 72, 'derrick'], [10, 28, -72, 'mât']],
  splat: { x0: -150, z0: -110, w: 220, d: 220, ppm: 2.5 },
  far: 560,
  build() { tephraLevel(); },
  after() { tephraAshfall(); tephraSkyAnchor(); },
  update(t, dt) { tephraSkyAnchor(); tephraSteam(dt); tephraLightning(dt); tephraAshUpdate(dt, t); if (MAT.lavaTp) MAT.lavaTp.map.offset.y = 1 - ((t * 0.012) % 1); },
  unload() { TPH.vents = null; TPH.noise = null; TP_ASH.obj = null; TP_ASH.mat = null; TP_BOLT.t = -1; SkyShader.uniforms.uErupt.value.z = 0; },
  spawns: [[-27.5, 45.5], [-24.5, 48.5], [-21.5, 45.5], [-27.5, 50.5], [-16.5, 45.5], [-9.5, 46.5], [-6.5, 48.5], [-3.5, 49.5], [4.5, 48.5], [7.5, 46.5], [17.5, 45.5], [21.5, 46.5], [24.5, 49.5], [28.5, 46.5], [27.5, 50.5]],
  poi: [
    [-25, 0, 40, 'L'], [-25, 0, -40, 'L'], [-24.5, 0, 24, 'L'], [-24.5, 0, -24, 'L'], [-24.5, 0, 8, 'L'], [-24.5, 0, -8, 'L'], [-14, TPH.labH, 20, 'L', 1], [-14, TPH.labH, -20, 'L', 1],
    [0, 0, 30, 'M'], [0, 0, -30, 'M'], [0, 0, 18, 'M'], [0, 0, -18, 'M'], [-14.5, 0, 0, 'M', 1], [-13.5, 0, 22, 'M'], [-13.5, 0, -22, 'M'],
    [25, 0, 32, 'E'], [25, 0, -32, 'E'], [22, 0, 6, 'E', 1], [22, 0, -6, 'E', 1], [15.5, TPH.mezY, 6, 'E', 1], [15.5, TPH.mezY, -6, 'E', 1], [13.5, 0, 19, 'E'], [13.5, 0, -19, 'E'],
  ],
  dom: [[0.5, 41.5], [-14.5, 0], [0, -41.5]], // placés par le propriétaire avec l'outil des zones (?outil=zones, octobre 2026)
  mecha: [[25.5, 39.5], [0, 15], [0.5, -15.5], [-25, -37.5]], // zones de largage du mecha (08f-mecha.js, mnavZones), placées de même
  lane: (x) => (x < -20 ? 'L' : x > 13 ? 'E' : 'M'),
  sniper: [-14, TPH.labH, 20],
  coverZ: 44,
  heli: [30, 60],
  cam: 58,
  // pas : tôle des passerelles en hauteur ; au sol, routes et place de la station (enrobé, dalles) et sols sous un toit (peu de ciel visible
  // d'après l'éclairage cuit) en dur, ailleurs la cendre et ses scories : le gravier
  surface: (p) => {
    if (p.y > 2.5) return 'metal';
    if (lightAt(p.x, p.y + 1, p.z)[0] < 0.45) return 'concrete';
    const az = Math.abs(p.z), inside = p.x > TPH.pipeEdge && p.x < TPH.east && az < TPH.end;
    const road = (az > 40 && p.x > -29) || (p.x > -7 && p.x < 7 && az > 12 && az < 41) || (p.x > 7 && p.x < 20 && az > 26 && az < 41) || (p.x > 20 && az > 12);
    return inside && (road || (p.x > -22 && p.x < 7 && az < 12)) ? 'concrete' : 'gravel';
  },
  zones: [
    [_t('Dortoirs'), -32, -13, 55.5, 62], [_t('Dortoirs'), -32, -13, -62, -55.5],
    [_t('Groupes électrogènes'), 13, 32, 55.5, 62], [_t('Groupes électrogènes'), 13, 32, -62, -55.5],
    [_t('Base Alpha'), -32, 32, 44, 62], [_t('Base Bravo'), -32, 32, -62, -44],
    [_t('Station de pompage'), -32, -22, -3.5, 3.5], [_t('Têtes de puits'), -30, -20, 26, 34], [_t('Têtes de puits'), -30, -20, -34, -26],
    [_t('Laboratoires'), -22, -7, 12, 26], [_t('Laboratoires'), -22, -7, -26, -12], [_t('Carothèque'), -20, -7, 26, 44], [_t('Carothèque'), -20, -7, -44, -26],
    [_t('Conduites'), -32, -20, -44, 44],
    [_t('Observatoire'), -6.5, 6.5, -7, 7], [_t('Galerie'), 6.5, 14, -7, 7], [_t('Salle des turbines'), 14, 32, -12, 12], [_t('Esplanade'), -20, -6.5, -12, 12],
    [_t('Salle de contrôle'), 7, 20, 12, 26], [_t('Salle de contrôle'), 7, 20, -26, -12], [_t('Séparateurs'), 20, 32, 12, 26], [_t('Séparateurs'), 20, 32, -26, -12],
    [_t('Sous-station'), 7, 20, 26, 44], [_t('Sous-station'), 7, 20, -44, -26], [_t('Centrale'), 20, 32, -44, 44],
    [_t('Parking'), -7, 7, 26, 44], [_t('Parking'), -7, 7, -44, -26], [_t('Allée'), -7, 14, -26, 26],
  ],
  // ciel photographié (Poly Haven, wasteland_clouds, nuages ramenés au rouge sombre et à l'orangé : assets/sky/wasteland_feu) : un ciel de
  // cendres éclairé par en dessous ; le cône, le panache et l'éruption restent dessinés devant (SKY_VOLC)
  skyPhoto: { key: 'wasteland_feu', rot: 0.0587, gain: 0.65 },
  atmo: ATMO_TEPHRA,
};
