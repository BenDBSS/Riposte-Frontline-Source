/* ==========================================================================
   STRATUS : un archipel d'îles flottantes au-dessus d'une mer de nuages, reliées par des ponts suspendus (à la manière du dessin animé
   Skyland). 76 x 116 m, en miroir nord-sud (équipe Alpha au nord, +z ; Bravo au sud, -z). Aucun mur au bord des îles : on tombe dans le
   vide (VOID, 02-map.js : mort sous 14 m, crédit au dernier adversaire qui a touché) ; seuls les ponts ont des rambardes qui retiennent.
   OUEST « Vigie et Phare » : la Vigie et sa tour de guet, le pont du Phare, le Phare au milieu ; les longues vues des tireurs.
   CENTRE « Rotonde et Sanctuaire » : la Rotonde en ruine (points A et C), puis le Sanctuaire (point B) sous son grand cristal
   flottant, repère de toute la carte.
   EST « Ruines et Bosquet » : les Ruines et leur terrasse, le Bosquet et ses arbres au milieu ; le combat rapproché.
   Liaisons : un pont de la Rotonde vers la Vigie et vers les Ruines, deux ponts du Sanctuaire vers le Phare et le Bosquet. Chaque base a
   trois ponts. Les deux moitiés se distinguent : azur, cerisiers en fleur et dirigeable bleu au nord (Alpha) ; garance, érables roux et
   dirigeable rouge au sud (Bravo).
   Lignes de vue : des îles alignées se voient d'un bout à l'autre de la carte par-dessus le vide. Des rochers flottants dans les couloirs de
   vide et des stèles aux têtes de pont (on les contourne) coupent ces lignes ; la Roche de chaque base cache les points A et B aux
   apparitions.
   Les tirages sont reproductibles (graines fixes) : chaque pair d'un salon construit la même carte.
   ========================================================================== */
const STL = {
  // îles de la moitié Alpha (z > 0), rectangles [x0, x1, z0, z1] dont le dessus est à y = 0 ; Bravo en est le miroir en z
  half: {
    base: { rects: [[-16, 16, 42, 56], [-22, -10, 38, 46], [10, 30, 38, 48], [-10, 0, 37, 42]], depth: 36, tip: [2, 3], seed: 11 }, // aile est large : deux sorties distinctes vers les Ruines
    vigie: { rects: [[-34, -16, 21, 30], [-30, -20, 17, 21]], depth: 28, tip: [-1, 0], seed: 21 },
    rotonde: { rects: [[-7, 7, 18, 31]], depth: 24, seed: 31 },
    ruines: { rects: [[16, 36, 18, 30], [19, 35, 16, 18]], depth: 30, tip: [1, 1], seed: 41 },
  },
  // îles du milieu, symétriques
  mid: {
    phare: { rects: [[-38, -20, -9, 9]], depth: 32, tip: [-1, 0], seed: 51 },
    sanctuaire: { rects: [[-11, 11, -6, 6], [-8, 8, -9, 9]], depth: 44, seed: 61 },
    bosquet: { rects: [[20, 38, -9, 9]], depth: 30, tip: [1, 0], seed: 71 },
  },
  // ponts de la moitié Alpha : [axe, coordonnée de l'axe, début, fin (bords des îles), largeur entre les rambardes]
  // (l'est a deux ponts parallèles de la base aux Ruines et des Ruines au Bosquet : quatre routes distinctes d'un camp à l'autre ; celui de la
  // base à la Rotonde est décalé à l'ouest du point A : de sa tête, on ne voit ni le point ni le Sanctuaire, et la stèle qui les cache se tient
  // à côté de la sortie, pas devant)
  bridges: [['z', -18.5, 30, 38, 3], ['z', -4.5, 31, 37, 3], ['z', 18.5, 30, 38, 3], ['z', 27.5, 30, 38, 3], ['x', 24.5, -16, -7, 3], ['x', 24.5, 7, 16, 3], ['z', -26.5, 9, 17, 3], ['z', 0, 9, 18, 4], ['z', 22.5, 9, 16, 3], ['z', 32.5, 9, 16, 3]],
  midBridges: [['x', 0, -20, -11, 4], ['x', 0, 11, 20, 4]],
  seaDepth: 120, // la mer de nuages, sous le dessus des îles (m)
  crystal: { y: 16 }, // grand cristal flottant au-dessus du Sanctuaire
  A: 24.5, // points A et C : (0,5 ; ± A)
};
/* Rectangle et pont de la moitié Bravo (s = -1) : miroir en z */
const stMirR = (q, s) => (s > 0 ? q : [q[0], q[1], -q[3], -q[2]]);
const stMirB = (b, s) => (s > 0 ? b : b[0] === 'z' ? ['z', b[1], -b[3], -b[2], b[4]] : ['x', -b[1], b[2], b[3], b[4]]);
/* Tous les ponts, dans les deux moitiés (pour la répartition du sol et les pas sur les planches) */
function stAllBridges() { return [1, -1].flatMap((s) => STL.bridges.map((b) => stMirB(b, s))).concat(STL.midBridges); }

/* ---------- Plan ---------- */
function stratusLevel() {
  ST_CUTS.length = 0;
  STR.rng = rngOf(9101); STR.anim = [];
  for (const s of [1, -1]) {
    for (const k of Object.keys(STL.half)) { const I = STL.half[k]; stIsland({ ...I, rects: I.rects.map((q) => stMirR(q, s)), seed: I.seed + (s < 0 ? 5 : 0), tip: I.tip ? [I.tip[0], I.tip[1] * s] : null }); }
    for (const b of STL.bridges) { const q = stMirB(b, s); stBridge(q[0], q[1], q[2], q[3], q[4]); }
    stratusBase(s); stratusVigie(s); stratusRotonde(s); stratusRuines(s);
  }
  for (const k of Object.keys(STL.mid)) stIsland(STL.mid[k]);
  for (const b of STL.midBridges) stBridge(b[0], b[1], b[2], b[3], b[4]);
  stratusPhare(); stratusSanctuaire(); stratusBosquet();
  stratusFloats();
  stratusBackdrop();
  stratusGround();
}
const STR = { rng: null, anim: [] };
/* Prefab posé au sol (y = 0) en (x, z), tourné de ry */
function stPut(pf, x, z, ry = 0, o) { DECOR.place(pf, x, 0, z, ry, o); }
/* Caisses et tonneaux des marchands du ciel (props physiques : ils roulent et tombent dans le vide) */
function stCrates(x, z, ry, n = 2) {
  const R = STR.rng;
  for (let i = 0; i < n; i++) { const a = ry + (i - (n - 1) / 2) * 0.4; stPut(PF.crate(R.range(0.95, 1.15)), x + Math.cos(ry) * (i - (n - 1) / 2) * 1.5, z - Math.sin(ry) * (i - (n - 1) / 2) * 1.5, a + R.range(-0.15, 0.15)); } // côte à côte sans s'entrer (1,5 m, peu tournées)
}

/* ---------- Bases : les apparitions de part et d'autre de la Roche, le quai des dirigeables au fond, tentes et fanions à la couleur du
   camp ----------
   Le point A est caché aux apparitions par la stèle du nord de la Rotonde, le Sanctuaire par ses pierres levées (sans elles, la base campe
   son point). Règle de toute l'île : rien de haut à la tête d'un pont (5 m dans son prolongement, tools/dev/visual/decor.js) */
function stratusBase(s) {
  const col = stAccent(s), k = s < 0 ? 1 : 0;
  stRoche(s);
  stPut(PF.stTent(col), -12.4, s * 50.5, 0); stPut(PF.stTent(col), 12.4, s * 50.5, 0);
  // couverts aux sorties, qui cachent aussi le centre de la carte aux apparitions des côtés
  stPut(PF.stSpire(4.2, 1.3, 14 + k), -12.6, s * 39.8, s * 0.4);
  stPut(PF.stSpire(4.2, 1.3, 15 + k), 23.2, s * 39.8, s * -0.4);
  stPut(PF.stCrateStack(1 + k), -20.0, s * 44.0, s * 0.2); stCrates(23.0, s * 43.4, s * 0.1, 2); // entre les têtes des deux ponts des Ruines
  stDock(s);
  for (const x of [-14.5, 14.5]) stBanner(x, s * 54.0, col);
}
/* La Roche : bloc de roche stratifiée au milieu de la base, entre les deux groupes d'apparitions (il les abrite de l'axe central), deux
   blocs soudés, une seule collision ; devant elle, un passage de 3,4 m jusqu'au bord de la base (vers le pont de la Rotonde) */
function stRoche(s) {
  const M = DECOR, R = rngOf(s > 0 ? 4401 : 4402), zc = s * 46.2;
  M.save().local(1); M.cls = 0;
  for (const [x, rx, ry, rz] of [[-1.3, 1.65, 2.6, 1.05], [1.6, 1.6, 2.3, 1.05]]) {
    M.save().move(x, 0, zc + R.range(-0.12, 0.12)).rotY(R.range(-0.25, 0.25));
    M.color([R.range(0.88, 1), R.range(0.84, 0.95), R.range(0.78, 0.88)]);
    rockMesh(M, R, rx, ry, rz, 3, 10, 7, 'strata'); M.restore();
  }
  M.restore();
  const z0 = s > 0 ? 45.4 : -47.0, z1 = s > 0 ? 47.0 : -45.4;
  DECOR.col(-2.8, 3.0, 0, 3.4, z0, z1, 'concrete'); DECOR.col(-2.2, 2.4, 3.4, 4.2, z0 + 0.2, z1 - 0.2, 'concrete');
}
/* Quai des dirigeables : plate-forme de planches au bord du fond de la base (praticable, au ras du sol), bornes d'amarrage, et le dirigeable
   du camp qui flotte au-delà, retenu par deux amarres */
function stDock(s) {
  const M = DECOR, z0 = s * 56, col = stAccent(s);
  M.save().local(1).color(ST.wood); M.cls = 0;
  for (let x = -6; x < 6; x += 0.26) M.boxB('wood', x, x + 0.22, -0.05, 0.02, Math.min(z0 - s * 3.5, z0 - s * 0.05), Math.max(z0 - s * 3.5, z0 - s * 0.05)); // pas au-delà du bord : on verrait un sol qui ne porte pas
  M.restore();
  for (const x of [-5.5, 5.5]) { stPut(PF.bitt(), x, z0 - s * 0.4, 0); }
  const ship = { x: 0, y: 7.5, z: z0 + s * 15, s, col };
  stAirship(ship);
  M.save().local(1).color(ST.rope); M.cls = 1;
  for (const x of [-5.5, 5.5]) { const a = [x, 0.55, z0 - s * 0.4], b = [x * 0.45, ship.y - 1.2, ship.z - s * 3.2]; M.tube('rope', 0.03, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.6, (a[2] + b[2]) / 2], b], 5); LINES.push({ k: 'amarre', a, b }); }
  M.restore();
}
/* Fanion à la couleur du camp sur un mât de bois ; il flotte au vent (drapeau simulé) */
function stBanner(x, z, col) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.55, 0.45, 0.34]); M.cls = 0; M.cyl('wood', 0.07, 4.6, 8, { r1: 0.05 }); M.restore();
  DECOR.col(x - 0.08, x + 0.08, 0, 4.6, z - 0.08, z + 0.08, 'wood');
  M.save().move(x, 3.2, z).color(col).local(1); M.cls = 1;
  clothPiece(M, [0.06, 0.15, 0], [1.6, 0.0, 0], [1.6, 1.15, 0], [0.06, 1.3, 0], [0, 0, 1], { hoist: true, genre: 'drapeau', grp: 'fanion' + x + ',' + z }); // flotte (tissu simulé, 02mc-tissus.js)
  M.restore();
}
/* Dirigeable : ballon fuselé à la couleur du camp, nacelle de bois, empennage, hélices ; flotte et tangue doucement (stAnimate) */
function stAirship(o) {
  const g = new THREE.Group(), MK = new Maker({ parts: new Map(), buf(mat, cls) { const k = mat + '|' + cls; let p = this.parts.get(k); if (!p) this.parts.set(k, p = { mat, cls, g: new GeoBuf(256, 512, false) }); return p.g; }, col() {}, occ() {}, pcol() {}, dynAdd() {} });
  MK.color(o.col).local(1);
  const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16, r = 3.1 * Math.pow(Math.sin(Math.PI * t), 0.75); prof.push([Math.max(r, 0.01), (t - 0.5) * 17]); }
  MK.save().rotX(Math.PI / 2); MK.lathe('canvas', prof, 20); MK.restore();
  MK.color([0.92, 0.9, 0.84]);
  for (const k of [0, 1, 2, 3]) { MK.save().move(0, 0, -7.4).rotZ((k * Math.PI) / 2); MK.quad('canvas', [0, 0.5, 0], [0, 3.0, -1.6], [0, 3.0, 0.4], [0, 0.6, 1.4], [1, 0, 0]); MK.quad('canvas', [0, 0.5, 0], [0, 0.6, 1.4], [0, 3.0, 0.4], [0, 3.0, -1.6], [-1, 0, 0]); MK.restore(); }
  MK.color([0.58, 0.45, 0.32]); MK.boxB('wood', -0.9, 0.9, -4.4, -3.3, -2.6, 2.6, { bevel: 0.05 });
  MK.color([0.3, 0.28, 0.26]); for (const sd of [-1, 1]) { MK.save().move(sd * 1.3, -3.85, -2.7); MK.cyl('steel', 0.08, 0.5, 6); MK.restore(); }
  MK.color(ST.rope); for (const sd of [-1, 1]) for (const zz of [-2.2, 2.2]) MK.tube('rope', 0.02, [[sd * 0.8, -3.35, zz], [sd * 1.9, -2.1, zz * 1.3]], 4);
  for (const p of MK.T.parts.values()) { if (!p.g.ni) continue; const m = new THREE.Mesh(p.g.geometry(), MAT[p.mat]); m.castShadow = false; g.add(m); }
  g.position.set(o.x, o.y, o.z); if (o.s < 0) g.rotation.y = Math.PI;
  mapAdd(g); STR.anim.push({ k: 'ship', g, y: o.y, ph: o.s > 0 ? 0 : 1.7 });
  WORLD.col && DECOR.col(o.x - 3, o.x + 3, o.y - 4.4, o.y + 3.2, o.z - 8.5, o.z + 8.5, 'dirt', true); // il arrête les balles
}

/* ---------- Vigie (ouest, côté de chaque camp) : tour de guet (poste en hauteur), aiguille, rochers, cristaux ---------- */
function stratusVigie(s) {
  const k = s < 0 ? 2 : 0;
  stTower(-31.3, s * 26.5, s);
  stPut(PF.stSpire(4.6, 1.5, 21 + k), -23.0, s * 28.8, s * 0.3);
  stPut(PF.stBlock(1.4, 0.95, 0.8, 21), -25.0, s * 23.0, s * 0.6); stPut(PF.stBlock(1.2, 0.9, 1.0, 22), -31.0, s * 22.2, s * 0.3);
  stPut(PF.stCrystals(1.7, 21 + (s < 0 ? 1 : 0)), -26.6, s * 29.2, 0);
}
/* Tour de guet en bois : plate-forme de 5 x 5 m à 4 m (praticable, sans garde-corps : on en tombe sur l'île), quatre poteaux, escalier
   le long de x depuis l'est */
function stTower(cx, cz, s) {
  const M = DECOR, H = 4, half = 2.5;
  M.save().local(1).color([0.7, 0.58, 0.44]); M.cls = 0;
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) { M.boxB('wood', cx + dx * (half - 0.12) - 0.12, cx + dx * (half - 0.12) + 0.12, 0, H - 0.08, cz + dz * (half - 0.12) - 0.12, cz + dz * (half - 0.12) + 0.12); DECOR.col(cx + dx * (half - 0.12) - 0.12, cx + dx * (half - 0.12) + 0.12, 0, H, cz + dz * (half - 0.12) - 0.12, cz + dz * (half - 0.12) + 0.12, 'wood'); }
  for (let x = cx - half; x < cx + half; x += 0.27) M.boxB('wood', x, x + 0.24, H - 0.08, H, cz - half, cz + half);
  M.boxB('wood', cx - half + 0.01, cx + half - 0.01, H - 0.32, H - 0.08, cz - half + 0.01, cz - half + 0.15); M.boxB('wood', cx - half + 0.01, cx + half - 0.01, H - 0.32, H - 0.08, cz + half - 0.15, cz + half - 0.01); // ceintures à 1 cm en retrait des poteaux
  // croix de Saint-André sur deux faces
  M.color([0.62, 0.5, 0.38]);
  for (const dz of [-1, 1]) M.tube('wood', 0.05, [[cx - half + 0.1, 0.3, cz + dz * (half - 0.12)], [cx + half - 0.1, H - 0.4, cz + dz * (half - 0.12)]], 4);
  // toit de toile
  M.color(stAccent(s)); M.quad('canvas', [cx - half - 0.3, H + 2.3, cz - half - 0.3], [cx + half + 0.3, H + 2.3, cz - half - 0.3], [cx + half + 0.3, H + 2.3, cz + half + 0.3], [cx - half - 0.3, H + 2.3, cz + half + 0.3], [0, 1, 0]);
  M.quad('canvas', [cx - half - 0.3, H + 2.3, cz - half - 0.3], [cx - half - 0.3, H + 2.3, cz + half + 0.3], [cx + half + 0.3, H + 2.3, cz + half + 0.3], [cx + half + 0.3, H + 2.3, cz - half - 0.3], [0, -1, 0]);
  M.color([0.62, 0.5, 0.38]); for (const dx of [-1, 1]) for (const dz of [-1, 1]) M.boxB('wood', cx + dx * (half - 0.1) - 0.06, cx + dx * (half - 0.1) + 0.06, H, H + 2.3, cz + dz * (half - 0.1) - 0.06, cz + dz * (half - 0.1) + 0.06);
  M.restore();
  DECOR.col(cx - half, cx + half, H - 0.32, H, cz - half, cz + half, 'wood');
  // socle de pierre sous la plate-forme : pas de recoin sans issue entre les poteaux
  box('stone', cx - half + 0.05, cx + half - 0.05, 0, 1.1, cz - half + 0.05, cz + half - 0.05, { tint: ST.stone });
  // escalier : de l'est (x = cx + half + 6) jusqu'au bord de la plate-forme
  ramp(cx + half, cx + half + 7.2, cz - 0.7, cz + 0.7, 'x', H, 0, 'wood', ST.wood, { mat: 'wood' }); // pente sous NAV_DH par mètre : les bots y montent
}

/* ---------- Rotonde (points A et C) : colonnes autour du point, stèle, aiguilles aux coins ; ses quatre têtes de pont (le pont de la base
   arrive au nord-ouest, ceux de la Vigie, des Ruines et du Sanctuaire sur les axes du point) dessinent une croix dégagée ---------- */
function stratusRotonde(s) {
  const cx = 0.5, cz = s * STL.A, R = 5.0, k = s < 0 ? 7 : 0;
  // trois colonnes sur les diagonales (au nord-ouest, la tête du pont de la base) : elles encadrent les sorties sans les gêner
  [40, 220, 320].forEach((deg, i) => { const a = (deg * Math.PI) / 180; stPut(PF.stColumn(4.2, i % 2 === 1, 31 + i + k), cx + Math.cos(a) * R, cz + s * Math.sin(a) * R, s * a); });
  // stèle au bord nord, à côté de la tête du pont de la base : elle cache le point aux apparitions et ferme le couloir des ponts du Sanctuaire
  stPut(PF.stStele(4.6, 3.6, 0.9, 37 + k), 0.1, s * 28.75, 0);
  // aiguilles aux coins
  stPut(PF.stSpire(4.4, 1.3, 34 + k), 6.0, s * 28.6, s * 1.1);
  stPut(PF.stSpire(4.0, 1.2, 35 + k), -5.6, s * 19.8, s * 2.1); stPut(PF.stSpire(4.0, 1.2, 36 + k), 6.0, s * 19.8, s * 0.7);
}

/* ---------- Ruines (est, côté de chaque camp) : terrasse de pierre (poste en hauteur), aiguilles, colonne, bloc, un arbre ---------- */
function stratusRuines(s) {
  // terrasse : dalle à 2,6 m sur un massif de pierre contre le bord est, escalier vers l'ouest (les deux routes de l'est passent à côté) ;
  // son pied sud reste à 6 m du bord : on sort du pont du Bosquet sur un palier, pas face à un mur
  const x0 = 29.8, x1 = 36, z0 = s > 0 ? 22 : -30, z1 = s > 0 ? 30 : -22, H = 2.6, k = s < 0 ? 3 : 0; // jusqu'aux bords est et nord
  box('stone', x0, x1, 0, H, z0, z1, { tint: ST.stone });
  ramp(x0 - 4.8, x0, s * 24 - 0.8, s * 24 + 0.8, 'x', 0, H, 'stone', ST.stone, { mat: 'stone' });
  stPut(PF.stSpire(4.8, 1.6, 41 + k), 17.6, s * 19.4, s * 0.6);
  stPut(PF.stSpire(4.2, 1.4, 42 + k), 23.0, s * 28.4, s * 1.7);
  stPut(PF.stColumn(3.2, true, 43 + k), 20.6, s * 21.7, 0); // à côté des têtes des ponts de la base et du Bosquet : coupe la vue le long du pont de la base
  DECOR.place(PF.stColumn(4.2, false, 42 + k), 34.4, H, s * 28.6, 0); // debout sur la terrasse
  stPut(PF.stBlock(1.2, 0.9, 1.2, 42), 26.8, s * 19.0, s * 0.7);
  stPut(PF.tree(s > 0 ? 'cherry' : 'maple', 7, 2.8, 41), 24.6, s * 26.6, 0);
}
/* ---------- Phare (ouest, au milieu) : tour de pierre et sa lanterne de cristal, échafaudage (poste en hauteur), caisses ---------- */
function stratusPhare() {
  const cx = -31.5, cz = 0.5, M = DECOR;
  M.save().move(cx, 0, cz).color(ST.stone).local(1); M.cls = 0;
  M.cyl('stone', 2.2, 9.5, 20, { r1: 1.7 });
  M.save().move(0, 9.5, 0); M.cyl('stone', 2.0, 0.35, 20); M.restore();
  M.color([0.9, 1, 1]); M.save().move(0, 9.85, 0); M.cyl('crystalSt', 0.9, 1.8, 6, { r1: 0.6 }); M.restore();
  M.color(ST.stone); M.save().move(0, 11.65, 0); M.cyl('stone', 1.4, 0.4, 12, { r1: 0.2 }); M.restore();
  M.restore();
  DECOR.col(cx - 2.0, cx + 2.0, 0, 9.85, cz - 2.0, cz + 2.0, 'concrete');
  // échafaudage à l'ouest de la tour : plate-forme à 3 m (poste en hauteur qui voit le Sanctuaire), une rampe vers chaque camp, loin du
  // passage nord-sud des ponts
  stDeck(-37.6, -33.6, -1.4, 2.4, -36.4, -35.0); // un passage d'1,5 m entre les rampes et la tour
  stPut(PF.stSpire(4.4, 1.5, 51), -22.6, 5.6, 0.3); stPut(PF.stSpire(4.4, 1.5, 52), -22.6, -4.6, -0.3);
  stCrates(-30.4, 6.8, 0, 2); stCrates(-30.4, -6.8, 0, 2); // à côté de la tête du pont de la Vigie
}

/* Plate-forme de planches à 3 m sur quatre poteaux (on passe dessous), une rampe vers chaque camp le long de z, de rx0 à rx1 ;
   hole : [x, z, r], trémie carrée de demi-côté r autour du tronc d'un arbre qui traverse la plate-forme (planches coupées, cadre autour) */
function stDeck(px0, px1, pz0, pz1, rx0, rx1, hole) {
  const M = DECOR, H = 3;
  M.save().local(1).color([0.68, 0.56, 0.42]); M.cls = 0;
  for (const x of [px0 + 0.12, px1 - 0.12]) for (const z of [pz0 + 0.12, pz1 - 0.12]) { M.boxB('wood', x - 0.12, x + 0.12, 0, H - 0.08, z - 0.12, z + 0.12); DECOR.col(x - 0.12, x + 0.12, 0, H, z - 0.12, z + 0.12, 'wood'); }
  for (let x = px0; x < px1; x += 0.27) {
    if (hole && x + 0.24 > hole[0] - hole[2] && x < hole[0] + hole[2]) { M.boxB('wood', x, x + 0.24, H - 0.08, H, pz0, hole[1] - hole[2]); M.boxB('wood', x, x + 0.24, H - 0.08, H, hole[1] + hole[2], pz1); }
    else M.boxB('wood', x, x + 0.24, H - 0.08, H, pz0, pz1);
  }
  if (hole) { // cadre de la trémie : quatre chevêtres un peu plus épais que les planches
    const [hx, hz, r] = hole; M.color([0.6, 0.48, 0.36]);
    for (const sd of [-1, 1]) { M.boxB('wood', hx - r - 0.08, hx + r + 0.08, H - 0.16, H + 0.02, hz + sd * r - (sd < 0 ? 0.08 : 0.01), hz + sd * r + (sd > 0 ? 0.08 : 0.01)); M.boxB('wood', hx + sd * r - (sd < 0 ? 0.08 : 0), hx + sd * r + (sd > 0 ? 0.08 : 0), H - 0.16, H + 0.02, hz - r + 0.01, hz + r - 0.01); } // 1 cm dans la trémie : pas dans le plan du bout des planches
  }
  M.restore();
  if (!hole) DECOR.col(px0, px1, H - 0.3, H, pz0, pz1, 'wood');
  else { // le plancher sans la trémie (sa collision entière traversait le tronc)
    const [hx, hz, r] = hole;
    DECOR.col(px0, hx - r, H - 0.3, H, pz0, pz1, 'wood'); DECOR.col(hx + r, px1, H - 0.3, H, pz0, pz1, 'wood');
    DECOR.col(hx - r, hx + r, H - 0.3, H, pz0, hz - r, 'wood'); DECOR.col(hx - r, hx + r, H - 0.3, H, hz + r, pz1, 'wood');
  }
  ramp(rx0, rx1, pz1, pz1 + 5.4, 'z', H, 0, 'wood', ST.wood, { mat: 'wood' }); // pente de 0,56 : sous NAV_DH, les bots y montent
  ramp(rx0, rx1, pz0 - 5.4, pz0, 'z', 0, H, 'wood', ST.wood, { mat: 'wood' });
}

/* ---------- Sanctuaire (point B) : dallage circulaire, colonnes en couronne, blocs, grand cristal flottant ---------- */
function stratusSanctuaire() {
  // quatre trilithes sur les diagonales ; deux pierres levées au nord et au sud du point, à plus de 5 m des têtes de pont (elles le cachent aux
  // apparitions des deux camps), deux blocs bas à l'ouest et à l'est ; les coins restent dégagés (carte de tireur d'élite : les longues vues
  // d'une île à l'autre sont voulues)
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; stPut(PF.stTrilithon(61), 0.5 + Math.cos(a) * 6.6, Math.sin(a) * 6.4, -a + Math.PI / 2); }
  stPut(PF.stMenhir(3.8, 1.6, 65), 0.5, 3.3, 0.04); stPut(PF.stMenhir(3.8, 1.6, 66), 0.5, -3.3, -0.04);
  stPut(PF.stBlock(1.5, 1.0, 0.85, 61), -2.7, 0.5, Math.PI / 2 + 0.1); stPut(PF.stBlock(1.5, 1.0, 0.85, 62), 3.7, 0.5, Math.PI / 2 - 0.1);
  for (const [x, z] of [[-10.0, 3.8], [10.4, -3.8], [-10.0, -3.8], [10.4, 3.8]]) stPut(PF.stCrystals(1.5, 61 + Math.round(x + z)), x, z, 0);
  stCrystal();
}
/* Grand cristal flottant au-dessus du Sanctuaire : bipyramide hexagonale lumineuse qui tourne lentement, et des éclats qui gravitent
   autour (stAnimate) ; sans collision (au-dessus de tout) */
function stCrystal() {
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 4.2, 6, 1, true), top = new THREE.ConeGeometry(1.6, 2.6, 6, 1, true), bot = new THREE.ConeGeometry(1.6, 3.4, 6, 1, true);
  const g = new THREE.Group(), mat = MAT.crystalSt, c = new THREE.Color(1, 1, 1);
  for (const [G, y, flip] of [[geo, 0, false], [top, 3.4, false], [bot, -3.8, true]]) {
    const col = new Float32Array(G.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) { col[i] = c.r * 0.85; col[i + 1] = c.g * 0.95; col[i + 2] = c.b; }
    G.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(G, mat); m.position.y = y; if (flip) m.rotation.x = Math.PI; g.add(m);
  }
  g.position.set(0, STL.crystal.y, 0); mapAdd(g); STR.anim.push({ k: 'crystal', g, y: STL.crystal.y });
  const R = rngOf(6161);
  for (let i = 0; i < 9; i++) {
    const s = R.range(0.35, 0.8), G = new THREE.OctahedronGeometry(s, 0), col = new Float32Array(G.attributes.position.count * 3).fill(0.9);
    G.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(G, mat); mapAdd(m);
    STR.anim.push({ k: 'shard', m, r: R.range(4.5, 7.5), a: R() * TAU, w: R.range(0.15, 0.35) * (R() < 0.5 ? -1 : 1), y: STL.crystal.y + R.range(-3, 3), ph: R() * TAU });
  }
}

/* ---------- Bosquet (est, au milieu) : arbres, rochers, tronc couché ---------- */
function stratusBosquet() {
  // arbres et rochers entre les têtes des ponts (deux au nord vers les Ruines, deux au sud, un à l'ouest vers le Sanctuaire), jamais devant
  const trees = [[25.9, 5.9, 'oak'], [30.6, 3.4, 'linden'], [35.0, 0.5, 'oak'], [25.9, -5.7, 'oak'], [30.6, -3.2, 'linden'], [29.8, 0.5, 'ginkgo']];
  // (le chêne de la Cabane, droit, ne fourche qu'au-dessus de la plate-forme : ses branches partaient du plancher)
  trees.forEach(([x, z, k], i) => stPut(PF.tree(k, 7.5 + (i % 3), 3.0, 71 + i, i === 2 ? { th: 4.4, lean: 0 } : {}), x, z, 0));
  // la Cabane : plate-forme perchée autour du chêne de l'est, poste en hauteur qui répond à l'échafaudage du Phare ; ses rampes côté est ;
  // le tronc passe par une trémie (les planches le traversaient)
  stDeck(31.4, 37.6, -1.6, 2.6, 35.4, 36.8, [35.0, 0.5, 0.36]);
  for (const [x, z, i] of [[27.6, 7.7, 4], [27.6, -7.5, 5]]) stPut(PF.stRock(1.7, 71 + i, 0.8), x, z, i);
  stPut(PF.stBlock(2.2, 0.8, 0.8, 71), 26.4, -3.1, 0.1);
  stPut(PF.stRock(1.4, 73, 0.7), 26.2, 3.6, 0.8);
  stPut(PF.stCrystals(1.4, 71), 38.4, -5.4, 0); // à côté de la rampe nord de la Cabane, plus devant : à 30 cm de la dernière marche, ils gênaient la sortie (octobre 2026)
}

/* ---------- Rochers flottants ----------
   Dans les couloirs de vide qui filent d'un bout à l'autre de la carte (entre les îles du milieu, entre la Vigie, la Rotonde et les
   Ruines, entre les Ruines et le Bosquet), des rochers dont le dessus est au-dessus des têtes : ils coupent les longues vues, arrêtent les
   balles, et l'on ne peut pas y prendre pied (à 1 m au moins des îles). Plus loin, hors de la zone de jeu ou très haut, de petits rochers
   sans collision peuplent le ciel. */
const STRATUS_FLOATS = [
  // [x0, x1, z0, z1] (moitié Alpha, Bravo en miroir), dessus, profondeur
  [[-19, -12, 3, 8], 5.8, 14], [[12, 19, 3, 8], 6.4, 15],
  [[-13.5, -8.5, 27.5, 31.5], 7.2, 13], [[8.5, 13.5, 27.5, 31.5], 6.6, 13],
  [[25.5, 29.5, 10.5, 14.5], 5.4, 12],
  // dans l'axe des ponts de la base à la Vigie et aux Ruines, au-delà de ces îles : on ne voit pas d'une base à l'autre le long de ces ponts
  [[-21.5, -16, 10.5, 14.5], 6.0, 12], [[15.5, 20, 10.5, 14.5], 5.6, 12],
];
function stratusFloats() {
  let seed = 8100;
  for (const s of [1, -1]) for (const [q, top, depth] of STRATUS_FLOATS) stFloatRock(stMirR(q, s), top + (s < 0 ? 0.4 : 0), depth, seed++);
  // décor du ciel : hors de la zone de jeu (|x| > 44 ou |z| > 62) ou à plus de 20 m, sans collision
  for (const [x, y, z, w, d, depth] of [
    [-50, 8, 30, 5, 4, 9], [-56, -6, -12, 6, 5, 10], [-48, 18, -40, 4, 4, 7], [-62, 4, 10, 4, 3, 7],
    [52, 10, -25, 5, 4, 9], [58, -4, 18, 6, 5, 10], [49, 20, 44, 4, 4, 7], [64, 6, -6, 4, 3, 7],
    [-14, 12, 68, 5, 4, 8], [20, -2, 74, 6, 5, 9], [14, 12, -68, 5, 4, 8], [-20, -2, -74, 6, 5, 9],
    [-10, 24, 12, 3, 3, 6], [16, 22, -14, 3, 3, 6],
  ]) stIsland({ rects: [[x - w / 2 + 0.5, x + w / 2 - 0.5, z - d / 2, z + d / 2], [x - w / 2, x + w / 2, z - d / 2 + 0.5, z + d / 2 - 0.5]], depth, seed: seed++, y, nocol: true });
}

/* ---------- Arrière-plan : îles lointaines (falaise et dessus vert, sans collision), qui peuplent le ciel de tous côtés ---------- */
function stratusBackdrop() {
  const R = rngOf(9200); WORLD.force = 'far';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + R.range(-0.15, 0.15), d = R.range(130, 420), y = R.range(-40, 25), w = R.range(14, 46) * (d / 260), dd = w * R.range(0.6, 1.1);
    const x = Math.cos(a) * d, z = Math.sin(a) * d * 1.15;
    stFarIsland(x, y, z, w, dd, R.range(0.6, 1.2) * w, 9300 + i);
  }
  WORLD.force = null;
}
/* Île lointaine : dessus plat (herbe) et masse rocheuse, peu de sommets ; allure tirée au hasard comme celle des îles de la carte (stUnderShape) */
function stFarIsland(x, y, z, w, d, depth, seed) {
  const M = DECOR, N = makeNoise(seed), K = 18, rings = [0, -0.06, -0.15, -0.27, -0.4, -0.54, -0.68, -0.82, -0.92, -1], S = stUnderShape(rngOf(seed * 5 + 1), false);
  M.save().local(1); M.cls = 1; M.aoFn = null;
  const B = M.buf('strata', x, y - depth / 2, z), ids = [];
  const pt = (k, j) => { const a = (k / K) * TAU, t = -rings[j], f = j === rings.length - 1 ? 0.03 : t < 0.06 ? 1 : stUnderScale(S, (t - 0.06) / 0.94, a), r = 1 + (N.fbm(k / K, t, 6, 2, 2) - 0.5) * (0.3 + t * 0.5); return [x + Math.cos(a) * w * 0.5 * r * f, y + rings[j] * depth, z + Math.sin(a) * d * 0.5 * r * f]; };
  for (let j = 0; j < rings.length; j++) for (let k = 0; k <= K; k++) {
    const p = pt(k % K, j), a = (k / K) * TAU, top = smoothstep(-0.25, 0, rings[j]);
    M.tint = [sl(lerp(0.9, ST.moss[0], top)), sl(lerp(0.86, ST.moss[1], top)), sl(lerp(0.84, ST.moss[2], top))];
    ids.push(M.v(B, p[0], p[1], p[2], Math.cos(a), 0.15 - rings[j] * 0.2, Math.sin(a), (k / K) * w * 3, rings[j] * depth));
  }
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < K; k++) { const a = ids[j * (K + 1) + k], b = ids[j * (K + 1) + k + 1], c = ids[(j + 1) * (K + 1) + k + 1], dd = ids[(j + 1) * (K + 1) + k]; M.quadI(B, a, dd, c, b); }
  M.color([0.62, 0.74, 0.45]);
  const T = M.buf('ground', x, y, z), c0 = M.v(T, x, y + 0.05, z, 0, 1, 0, x, -z), rim = [];
  for (let k = 0; k <= K; k++) { const p = pt(k % K, 0); rim.push(M.v(T, p[0], p[1] + 0.05, p[2], 0, 1, 0, p[0], -p[2])); }
  for (let k = 0; k < K; k++) M.tri(T, c0, rim[k + 1], rim[k]);
  M.restore();
}

/* ---------- Sol : pelouse, chemins de terre battue d'un pont à l'autre, dallages des ruines, humus sous les arbres ---------- */
const GROUND_STRATUS = { base: 'lawn', l1: 'dirt', l2: 'flagstone', l3: 'humus', pom: [0, 0, 0.03, 0], dirt: [0.62, 0.56, 0.44], mul: 0, env: 0.4 };
function stratusGround() {
  const S = SPLAT, W = Math.round(S.w * S.ppm), H = Math.round(S.d * S.ppm), out = new Uint8Array(W * H * 4), N = makeNoise(9301);
  // allées : d'une tête de pont à l'autre sur chaque île (segments), dallages : cercles de la Rotonde, du Sanctuaire, de la terrasse des Ruines
  const paths = [], link = (p, q) => paths.push([p[0], p[1], q[0], q[1]]);
  for (const s of [1, -1]) {
    // base : des apparitions, autour de la Roche, vers les quatre ponts
    link([-6.5, s * 47.5], [-4.5, s * 42.4]); link([-4.5, s * 42.4], [-4.5, s * 37.5]); link([7.0, s * 47.5], [2.6, s * 42.4]); link([-4.5, s * 42.4], [2.6, s * 42.4]);
    link([0.2, s * 48.4], [-6.5, s * 47.5]); link([0.2, s * 48.4], [7.0, s * 47.5]);
    link([-6.5, s * 47.5], [-18.5, s * 38.5]); link([7.0, s * 47.5], [18.5, s * 38.5]); link([7.0, s * 47.5], [27.5, s * 38.5]);
    // Vigie, Rotonde, Ruines : d'une tête de pont à l'autre
    link([-18.5, s * 29.5], [-17, s * 24.5]); link([-18.5, s * 29.5], [-26.5, s * 17.5]); link([-17, s * 24.5], [-26.5, s * 17.5]);
    link([-4.5, s * 30.5], [-2.6, s * 26.8]); link([-2.6, s * 26.8], [0.5, s * 24.5]); link([0.5, s * 24.5], [0, s * 18.5]); link([-6.5, s * 24.5], [6.5, s * 24.5]);
    link([18.5, s * 29.5], [17.8, s * 24.5]); link([17.8, s * 24.5], [20.6, s * 20.8]); link([20.6, s * 20.8], [22.5, s * 16.5]); link([16.5, s * 24.5], [17.8, s * 24.5]);
    link([27.5, s * 29.5], [28.4, s * 22.0]); link([28.4, s * 22.0], [30.2, s * 18.8]); link([30.2, s * 18.8], [32.5, s * 16.5]); link([20.6, s * 20.8], [28.4, s * 22.0]);
  }
  link([-26.5, 8.5], [-26.5, -8.5]); link([-26.5, 0], [-20.5, 0]); link([22.5, 8.5], [22.5, -8.5]); link([32.5, 8.5], [32.5, -8.5]); link([20.5, 0], [32.5, 0]);
  const plaza = [[0.5, 0, 8.6], [0.5, STL.A, 6.0], [0.5, -STL.A, 6.0]];
  const segD = (x, z, p) => { const dx = p[2] - p[0], dz = p[3] - p[1], t = clamp(((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1); return hyp(x - p[0] - dx * t, z - p[1] - dz * t); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4;
    const n1 = N.fbm(x * 0.07, z * 0.07, 32, 32, 3), n2 = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
    let pd = 99; for (const p of paths) pd = Math.min(pd, segD(x, z, p));
    let r = 1 - smoothstep(0.7, 1.5, pd + (n2 - 0.5) * 0.9), g = 0, b = 0;
    for (const [px, pz, pr] of plaza) { const d = hyp(x - px, z - pz); g = Math.max(g, 1 - smoothstep(pr - 0.8, pr + 0.4, d + (n1 - 0.5) * 1.2)); }
    if (x > 29.4 && x < 36.4 && Math.abs(z) > 21.6 && Math.abs(z) < 30.4) g = 1; // terrasse des Ruines
    if (x > 19 && x < 38 && Math.abs(z) < 9.5) b = smoothstep(0.42, 0.62, n1) * (1 - r) * 0.85; // humus du Bosquet
    r *= 1 - g;
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(0.25 + n2 * 0.45 + (r + g) * 0.25, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_STRATUS);
  STR.splat = { d: out, W, H, x0: S.x0, z0: S.z0, ppm: S.ppm }; // gardé pour le gazon (densité des brins)
}
/* Part d'une couche du sol en (x, z), de 0 à 1 : 0 allées, 1 dallages, 2 humus */
function stSplat(ch, x, z) {
  const S = STR.splat; if (!S) return 0;
  const i = Math.floor((x - S.x0) * S.ppm), j = Math.floor((z - S.z0) * S.ppm);
  return i < 0 || j < 0 || i >= S.W || j >= S.H ? 0 : S.d[(j * S.W + i) * 4 + ch] / 255;
}
/* Même chose, lue lissée (interpolation bilinéaire entre les texels, comme la carte graphique) : pour le gazon, sans marches de 33 cm */
function stSplatL(ch, x, z) {
  const S = STR.splat; if (!S) return 0;
  const fx = (x - S.x0) * S.ppm - 0.5, fz = (z - S.z0) * S.ppm - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, d = S.d;
  if (i >= 0 && j >= 0 && i + 1 < S.W && j + 1 < S.H) { const o = (j * S.W + i) * 4 + ch, p = o + S.W * 4; return lerp(lerp(d[o], d[o + 4], u), lerp(d[p], d[p + 4], u), v) / 255; }
  const at = (a, b) => (a < 0 || b < 0 || a >= S.W || b >= S.H ? 0 : d[(b * S.W + a) * 4 + ch] / 255); // bord de la répartition : 0 au-delà
  return lerp(lerp(at(i, j), at(i + 1, j), u), lerp(at(i, j + 1), at(i + 1, j + 1), u), v);
}
/* Matière des pas : planches sur les ponts, dalles sur les dallages, terre sur les chemins, herbe ailleurs */
function stSurface(p) {
  if (p.y < -0.05) return 'wood';
  for (const b of STR.bridgeRects || (STR.bridgeRects = stAllBridges().map(([ax, c, a0, a1, w]) => (ax === 'z' ? [c - w / 2, c + w / 2, a0 - 0.6, a1 + 0.6] : [a0 - 0.6, a1 + 0.6, c - w / 2, c + w / 2])))) if (p.x > b[0] && p.x < b[1] && p.z > b[2] && p.z < b[3]) return 'wood';
  if (hyp(p.x - 0.5, p.z) < 8.6 || hyp(p.x - 0.5, Math.abs(p.z) - STL.A) < 6.0 || p.y > 2) return 'concrete';
  return stSplat(0, p.x, p.z) > 0.5 ? 'dirt' : 'grass';
}

/* Un point sur un pont proche de la caméra (le grincement des cordes et des planches) ; à défaut, sur n'importe quel pont */
function stCreakAt() {
  const R = STR.bridgeRects || (stSurface(new V3(1e4, 0, 1e4)), STR.bridgeRects) || [], c = camera.position, near = R.filter((b) => hyp((b[0] + b[1]) / 2 - c.x, (b[2] + b[3]) / 2 - c.z) < 30);
  const b = (near.length ? near : R)[Math.floor(Math.random() * (near.length || R.length))];
  return b ? new V3(rand(b[0], b[1]), -0.3, rand(b[2], b[3])) : new V3(c.x, c.y - 1, c.z);
}

/* ---------- Mouvement : cristal qui tourne et respire, éclats qui gravitent, dirigeables qui tanguent ; mer de nuages accrochée à la caméra ---------- */
function stAnimate(t) {
  for (const A of STR.anim) {
    if (A.k === 'crystal') { A.g.rotation.y = t * 0.12; A.g.position.y = A.y + Math.sin(t * 0.6) * 0.35; }
    else if (A.k === 'shard') { const a = A.a + t * A.w; A.m.position.set(Math.cos(a) * A.r, A.y + Math.sin(t * 0.8 + A.ph) * 0.6, Math.sin(a) * A.r); A.m.rotation.set(t * 0.4 + A.ph, t * 0.3, 0); }
    else if (A.k === 'ship') { A.g.position.y = A.y + Math.sin(t * 0.35 + A.ph) * 0.4; A.g.rotation.z = Math.sin(t * 0.27 + A.ph) * 0.025; }
  }
}
function stratusSkyAnchor() { SkyShader.uniforms.uSea.value.set(camera.position.y + STL.seaDepth, camera.position.x, camera.position.z, ATMO_STRATUS.sky.sea[3]); }

/* ---------- Ambiance : grand soleil d'altitude, ciel profond, mer de nuages ---------- */
const ATMO_STRATUS = Object.assign({}, ATMO_DEFAULT, {
  // aube au-dessus des nuages (chantier des ambiances, octobre 2026) : soleil qui se lève à l'est (de côté pour les deux camps), lumière rose
  // et rasante, mer de nuages et brume rose-violet, air clair (peu de lueur dans la brume : l'image ne devient pas laiteuse), contraste marqué
  sun: [0.9, 0.08, -0.25], sunColor: 0xffb6a0, sunI: 2.4, vmSun: 0xffbca8,
  fog: [0.6, 0.5, 0.6], fogD: 0.0024, fogSun: 0.15,
  hemi: [0x9a9ac8, 0x8a7088, 0.42], vmHemi: [0x9a9ac8, 0x8a7088],
  sky: {
    zen: [0.12, 0.14, 0.32], mid: [0.4, 0.36, 0.5], hor: [0.95, 0.6, 0.55], gnd: [0.42, 0.34, 0.44],
    glow: [1.0, 0.62, 0.5], halo: [1.0, 0.8, 0.7], disk: [26, 18, 14], cloudLo: [0.28, 0.3, 0.38], cloudHi: [0.78, 0.72, 0.64], cloud: [0.54, 0.84, 0.7],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5], volc: [0, 0, 0, 0], plume: [0, 0, 0, 0], erupt: [0, 0, 0, 0],
    sea: [STL.seaDepth, 0, 0, 0.5],
  },
  envGround: 0xa8a4a0, hdri: 'sunset',
  bounce: [1.0, 0.7, 0.65], dust: [0.72, 0.7, 0.66], motes: [1.2, 1.05, 0.85],
  grade: { lo: [0.92, 0.94, 1.1], hi: [1.1, 0.98, 0.9], exp: 0.86, con: 1.14, sat: 1.08 }, rays: [1.0, 0.7, 0.65],
  impact: [0.5, 0.46, 0.38], wind: [520, 0.09],
  bloom: [0.3, 0.5, 1.2], aoFloor: 0.34, raysThr: 1.9, raysCap: 6, satExp: 0.9,
});

MAP_DEFS.stratus = {
  type: 'open', // grande et ouverte (des îles, de longues vues d'un pont à l'autre) : README « Règles de conception d'une carte »
  void: { kill: -14 }, // îles flottantes : pas de sol hors des îles, on meurt 14 m sous leur dessus (VOID, 02-map.js)
  bounds: { x0: -41, x1: 41, z0: -59, z1: 59 },
  // photos CC0 : en plus du bois et de la pierre, la roche des falaises et les couches du sol (elles remplacent les surfaces procédurales de même
  // nom pour Stratus seulement)
  textures: ['wood', 'stone', 'strata', 'lawn', 'dirt', 'flagstone', 'humus', 'canvas', 'burlap', 'timber', 'bark'],
  surfaces: STRATUS_SURFACES,
  // ambiance enregistrée (05c-ambiance.js, paquet amb_stratus) : vent de sommet, ses rafales ; les cordes et les planches des ponts qui
  // grincent (près d'un pont), des buses qui crient au loin dans le vide, une toile qui claque
  sound: { pack: 'amb_stratus', bed: 0.5, spots: [
    { id: 'a_gust', every: [7, 16], gain: 0.5, dist: [4, 12], y: [3, 8] },
    { id: 'a_creak', every: [8, 20], gain: 0.35, at: () => stCreakAt(), ref: 5 },
    { id: 'a_bird', every: [30, 70], gain: 0.25, dist: [60, 120], y: [-10, 30], ref: 20, roll: 0.8 },
    { id: 'a_flap', every: [14, 32], gain: 0.25, dist: [6, 20], y: [1, 4] },
  ] },
  kit: () => stratusKit(),
  materials: (M) => makeStratusMaterials(M),
  art: { cam: [-50, 20, 54], look: [0, 0, 6], fov: 50 }, // l'archipel vu d'en haut, au-dessus de la mer de nuages
  // brins d'herbe sur le dessus des îles (02nb-gazon.js) : pré sauvage et dense (120 brins par m²), plus haut loin des allées, couché par le vent
  // d'altitude ; rien sur le quai des dirigeables ni sous les tentes (leur toile descend plus loin que leur collision), et seulement là où la
  // pelouse s'affiche : le sol mélange ses couches d'après la hauteur de leurs textures, une allée (terre et cailloux) ou un dallage se montrent
  // dès qu'ils pèsent un quart du mélange, l'humus un tiers (groundMat) ; la répartition est lue lissée
  grass: {
    dens: 120,
    density: (x, z) => {
      if (stCut(x, z)) return 0; // angles arrondis des îles (stRoundLoop)
      if ((Math.abs(x) < 6.4 && Math.abs(z) > 52.2) || (Math.abs(Math.abs(x) - 12.4) < 1.9 && Math.abs(Math.abs(z) - 50.5) < 2.4)) return 0;
      const a = stSplatL(0, x, z); if (a >= 0.18) return 0;
      const b = stSplatL(1, x, z); if (b >= 0.14) return 0;
      const c = stSplatL(2, x, z); return c >= 0.12 ? 0 : (1 - smoothstep(0.05, 0.18, a)) * (1 - smoothstep(0.04, 0.14, b)) * (1 - smoothstep(0.03, 0.12, c));
    },
    height: (x, z, r) => (0.4 + 0.32 * r) * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(x * 0.23 + Math.sin(z * 0.19) * 2.1))) * (1 - 0.35 * smoothstep(0, 0.18, stSplatL(0, x, z))), // plus courte au bord des chemins (piétinée)
    colors: [[0.08, 0.17, 0.035], [0.3, 0.46, 0.1], [0.52, 0.5, 0.24]],
    wind: [0.82, -0.57, 0.55], width: 0.012, amb: 0.4, seed: 7171,
  },
  landmarks: [[0, STL.crystal.y, 0, 'cristal'], [-31.5, 10.5, 0.5, 'phare']],
  splat: { x0: -42, z0: -60, w: 84, d: 120, ppm: 3 },
  far: 700,
  build() { bendInit(MAP); stratusLevel(); }, // champ de souplesse : les soldats couchent l'herbe et les feuillages
  after() { stratusSkyAnchor(); },
  update(t, dt) { floraUpdate(t, dt); stAnimate(t); stratusSkyAnchor(); skyPhotoUpdate(t); },
  unload() { bendClear(); stCrystalTexFree(); STR.anim = []; STR.bridgeRects = null; STR.splat = null; SkyShader.uniforms.uSea.value.set(0, 0, 0, 0); },
  // de part et d'autre de la Roche : aucune ne voit le point A (stèle de la Rotonde) ni le Sanctuaire (pierres levées, aiguilles)
  spawns: [[-4.5, 45.5], [-7.5, 45.5], [-3.5, 47.5], [-6.5, 47.5], [-9.5, 47.5], [-4.5, 49.5], [-7.5, 49.5], [0.5, 47.5], [-1.5, 49.5], [2.5, 49.5], [4.5, 45.5], [7.5, 45.5], [5.5, 47.5], [8.5, 47.5], [6.5, 49.5]],
  poi: [
    [-24.5, 0, 23.5, 'L'], [-24.5, 0, -23.5, 'L'], [-31.5, 4, 26.5, 'L', 1], [-31.5, 4, -26.5, 'L', 1], [-26.5, 0, 5, 'L'], [-26.5, 0, -5, 'L'], [-35.5, 3, 0.5, 'L', 1], [-24, 0, 0.5, 'L'],
    [0.5, 0, STL.A, 'M'], [0.5, 0, -STL.A, 'M'], [-4.5, 0, 0.5, 'M', 1], [5.5, 0, 0.5, 'M', 1], [0.5, 0, 13.5, 'M'], [0.5, 0, -13.5, 'M'],
    [23.5, 0, 24.5, 'E'], [23.5, 0, -24.5, 'E'], [32.5, 2.6, 24.5, 'E', 1], [32.5, 2.6, -24.5, 'E', 1], [27, 0, 4, 'E'], [27, 0, -4, 'E'], [30.5, 0, 0.5, 'E'], [33.6, 3, 0.5, 'E', 1],
  ],
  dom: [[-14.5, 42.5], [0.5, 0], [23, -42.5]], // placés par le propriétaire avec l'outil des zones (?outil=zones, octobre 2026)
  mecha: [[-24.5, -23], [24, 23.5], [-23.5, 0.5], [27, 0]], // zones de largage du mecha (08f-mecha.js, mnavZones), placées de même
  lane: (x) => (x < -14 ? 'L' : x > 14 ? 'E' : 'M'),
  sniper: [-31.5, 4, 26.5],
  coverZ: 44,
  heli: [34, 50],
  cam: 58,
  surface: (p) => stSurface(p),
  zones: [
    [_t('Quai des dirigeables'), -8, 8, 52, 59], [_t('Quai des dirigeables'), -8, 8, -59, -52],
    [_t('Base Alpha'), -23, 31, 37.5, 59], [_t('Base Bravo'), -23, 31, -59, -37.5],
    [_t('Vigie'), -35, -15, 16, 31], [_t('Vigie'), -35, -15, -31, -16],
    [_t('Rotonde'), -8, 8, 17, 31], [_t('Rotonde'), -8, 8, -31, -17],
    [_t('Ruines'), 15, 37, 15, 31], [_t('Ruines'), 15, 37, -31, -15],
    [_t('Phare'), -39, -19, -10, 10], [_t('Sanctuaire'), -12, 12, -10, 10], [_t('Bosquet'), 19, 39, -10, 10],
    [_t('Pont suspendu'), -41, 41, -59, 59],
  ],
  atmo: ATMO_STRATUS,
  // ciel d'aube : « Qwantani Dawn (Pure Sky) » de Poly Haven (CC0), tourné pour que son soleil soit celui de la carte
  skyPhoto: { key: 'qwantani_dawn', rot: 0.143, gain: 0.9, drift: 3, period: 1500 }, // les nuages dérivent : ± 3° en 25 min
};
