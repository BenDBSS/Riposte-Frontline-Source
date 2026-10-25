/* ==========================================================================
   MELTEM : une île des Cyclades, village chaulé au bord de la mer. 72 x 96 m, en miroir nord-sud (équipe Alpha au sud,
   +z ; Bravo au nord, -z). La mer longe tout le côté ouest ; le vent d'été qui lui donne son nom fait tourner les moulins.
   Le plan est une grille de 2 m (MELTEM_ROWS : la moitié sud, la moitié nord est son miroir) que le kit cycladique
   (02yb à 02ye) transforme en maisons ; on y pose à la main ce que la grille ne dit pas (église, café, chapelle, escaliers).
   OUEST « Marine »  : le quai de pierre, les caïques à flot et ceux qu'on a tirés au sec sur leurs bers, la taverne à toit-terrasse
                       (on y monte par l'intérieur), le kiosque, les tamaris. Longues lignes de vue au ras de la mer ; au milieu, la
                       jetée et la chapelle bleue du bout.
   CENTRE « Place »  : la place du Platane (le Kafeneio, l'arbre, les tables), l'église de la Panagia qui la ferme à l'est : on en fait
                       le tour (anneau), et deux îlots de maisons à arches entre la place et les placettes des bases (points A et C).
   EST « Chora »     : le village haut, ruelles de 2 m en baïonnette (jamais une ligne de vue de plus de 30 m), arches, escaliers,
                       toits-terrasses (les Terrasses), la ruelle de l'Abside le long de l'église ; au bout, l'aire à battre.
   Un camp apparaît dans sa cour (chantier naval à l'ouest, cour du puits au centre, aire à battre à l'est), à l'abri du feu
   des placettes. Derrière chaque base, un moulin sur le toit d'une maison domine le pourtour : de presque partout on voit celui
   de son camp ou celui d'en face, et l'on sait de quel côté on va. Les tirages sont reproductibles (graine fixe) : chaque pair d'un salon construit la même carte.
   ========================================================================== */
/* Moitié sud : une rangée de 2 m par ligne (z de 0 à 48), 30 colonnes (x de -30 à 30). Colonnes : Marine 0-4 | façade 5-6 | 7-13 | 14-18 | ruelle de l'abside | est
   Petits édifices (k) : seulement ceux qui sont isolés (Marine, bout de la ruelle de l'Abside). Ceux qui étaient collés à une maison
   (fontaines des ruelles de l'Arche et de l'Abside, fours de la placette du puits, cabanons de la rue du Port et de la ruelle de
   l'Abside) mordaient sur la rue, gênaient le passage et laissaient voir à travers le mur voisin (une maison ne dessine pas son mur
   derrière un petit édifice) : retirés, retour du propriétaire. */
const MELTEM_ROWS = [
  '.....|..|XX....X|XXXXX|..|.......22',
  '.....|..|XX....X|XXXXX|..|222.22.22',
  '..k..|..|.......|.....|..|222.22.22',
  '.....|..|.......|.....|..|222.22.22',
  '.....|..|.......|.2222|..|222.22.22',
  '.....|..|.......|.2222|..|222.22.22',
  'k....|..|..2222.|.2222|..|........2',
  '....X|XX|..2222.|.2222|..|2222.22.2',
  '....X|XX|..2222.|.2222|..|2222.22.2',
  '....X|XX|..2222.|.2222|..|2222.22.2',
  '....X|XX|...aa..|.2222|..|........2',
  '....X|XX|..tttt.|..aa.|..|2222.22.2',
  '.k...|22|..tttt.|.2222|..|2222.22.2',
  '.....|22|..tttt.|.2222|..|2222.22.2',
  '....k|..|.......|22222|..|........2',
  '.....|..|.......|22222|..|tttttt..2',
  '.....|22|.......|22222|..|tttttt..2',
  '.....|22|.......|22222|..|tttttt..2',
  '.....|22|.......|22222|..|tttttt..2',
  '.....|..|.......|.....|.k|.........',
  '.....|..|.......|.....|..|.........',
  '.....|..|..11111|.....|..|.........',
  '.....|..|..11111|.....|..|.........',
  '.....|..|.......|.....|..|.........',
].map((r) => r.replace(/\|/g, ''));

const ATMO_MELTEM = Object.assign({}, ATMO_DEFAULT, {
  // fin de matinée d'été en mer Égée : soleil haut venu du large, ciel profond, air limpide, murs blancs qui renvoient la lumière
  sun: [-0.7, 0.66, 0.1], sunColor: 0xfff3dc, sunI: 2.35, vmSun: 0xfff3dc,
  fog: [0.62, 0.76, 0.9], fogD: 0.0021,
  hemi: [0xa8c8f4, 0xc9bfa8, 0.58], vmHemi: [0xbcd6ff, 0xb8ad98],
  sky: {
    zen: [0.025, 0.16, 0.56], mid: [0.18, 0.44, 0.84], hor: [0.74, 0.88, 0.99], gnd: [0.5, 0.58, 0.62],
    glow: [1.0, 0.92, 0.7], halo: [1.0, 0.95, 0.8], disk: [30, 26, 18], cloudLo: [0.86, 0.9, 0.96], cloudHi: [1.5, 1.48, 1.4], cloud: [0.4, 0.78, 0.75],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0xcfc6b2, hdri: 'sky',
  bounce: [1.05, 0.98, 0.86], dust: [0.78, 0.74, 0.66], motes: [1.2, 1.1, 0.9],
  grade: { lo: [0.94, 1.0, 1.06], hi: [1.06, 1.01, 0.93], exp: 0.84 }, rays: [1.0, 0.9, 0.7],
  impact: [0.7, 0.66, 0.6], wind: [420, 0.09],
  bloom: [0.2, 0.5, 1.5], aoFloor: 0.42, raysThr: 2.0, raysCap: 6, satExp: 0.88,
  volOpen: true,
});
/* Sol : terre battue des cours, dalles de schiste des ruelles, galets du quai, chaux des bordures et du parvis */
const GROUND_MELTEM = { base: 'sand', l1: 'slabs', l2: 'cobble', l3: 'chaux', pom: [0, 0, 0.04, 0], dirt: [0.74, 0.7, 0.62], mul: 0, env: 0.4 };
const MEL = {
  wl: -0.9, coast: -30,
  millX: -10, // le moulin de chaque base, sur sa maison derrière le pourtour
  murets: [[11.5, 17.0, 41.0, 41.4], [25.5, 29.6, 40.0, 40.4], [14.0, 14.4, 43.6, 47.8]], // murets de pierre sèche de l'aire à battre (moitié sud ; miroir au nord)
  // les deux moitiés se distinguent (on sait de quel côté on est) : menuiseries bleues au sud (Alpha), vertes, rouges et ocre au nord (Bravo),
  // ailes blanches au moulin du sud, de toile rouge à celui du nord ; le centre (église, Kafeneio) garde son bleu
  paint: [
    [[0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.05, 0.2, 0.45], [0.05, 0.2, 0.45], [0.05, 0.2, 0.45], [0.1, 0.55, 0.6], [0.1, 0.55, 0.6]],
    [[0.16, 0.42, 0.34], [0.16, 0.42, 0.34], [0.16, 0.42, 0.34], [0.16, 0.42, 0.34], [0.62, 0.17, 0.12], [0.62, 0.17, 0.12], [0.62, 0.17, 0.12], [0.85, 0.62, 0.2], [0.85, 0.62, 0.2], [0.1, 0.55, 0.6]],
  ],
  sail: [[0.97, 0.96, 0.92], [0.7, 0.22, 0.14]],
};

/* ---------- Plan ---------- */
function meltemLevel() {
  SR.rng = rngOf(2607); // accessoires partagés avec Khamsin (caisses, fûts) : mêmes tirages chez tous
  CYC.mill = null; CYC.doors = []; CYC.holes = []; CYC.paintAt = (z) => MEL.paint[z > 0 ? 0 : 1];
  const P = cyPlan(MELTEM_ROWS); CYC.P = P;
  P.xh = {};
  for (let k = 0; k < P.H; k++) for (let i = 0; i < P.W; i++) if (P.G[k][i] === 'X') P.xh[`${i},${k}`] = i >= 13 ? 6.2 : i >= 7 ? 3.6 : 3.5;
  meltemWater();
  meltemPier();
  meltemTown(P);
  cyChurch();
  cyKafeneio(-16, -12, -4, 4);
  for (const s of [1, -1]) { meltemTaverna(s); meltemMarine(s); meltemPlace(s); meltemChora(s); meltemBase(s); }
  // coin entre le grand toit des Terrasses et la maison du nord-ouest : les deux boîtes laissaient 5 cm de jour en diagonale, que les balles
  // traversaient sous un rendu plein (tools/dev/visual/fentes.js)
  for (const s of [1, -1]) DECOR.col(11.95, 12.0, 0, 2.9, Math.min(s * 37.95, s * 38.05), Math.max(s * 37.95, s * 38.05), 'concrete');
  meltemCenter();
  meltemBackdrop();
  meltemGround(P);
}

/* ---------- Eau : le quai, la jetée ---------- */
function meltemWater() {
  const c = MEL.coast, H = -MEL.wl;
  waterSetup({ y: MEL.wl, box: [-2000, -15, -2000, 2000], open: [-150, -112], east: -16 });
  waterLand(c, 1e4, -1e4, 1e4);
  waterObstacle([c, -10, -140, 140], H, [0.6, 0.58, 0.52], 0.45);
  waterObstacle([-37.4, c, -1.5, 1.5], 1.0, [0.45, 0.38, 0.3], 0.3);
  waterObstacle([-42, -37.4, -2.4, 2.4], 1.0, [0.82, 0.8, 0.76], 0.4);
  edgeRun('z', c - 0.4, c, -48, 48, [[-1.5, 1.5]]);
  waterEdge(-37.4, c - 0.4, 1.5, 1.9); waterEdge(-37.4, c - 0.4, -1.9, -1.5);
  // quai : mur de pierre calcaire sous le niveau du sol, bordure chaulée
  const M = DECOR;
  box('ashlar', c, c + 1.2, MEL.wl - 2.5, 0, -140, 140, { tint: [0.74, 0.72, 0.66], skip: 'yY', ao: false, m: 'concrete' });
  M.save().color([0.18, 0.22, 0.14]).world(1); M.boxB('wetstone', c - 0.012, c, MEL.wl - 0.7, MEL.wl + 0.5, -140, 140, { skip: 'yY' }); M.restore();
  M.save().color([0.9, 0.89, 0.85]).world(1); M.boxB('chaux', c - 0.06, c + 0.3, -0.12, 0.09, -140, 140, { bevel: 0.03 }); M.restore();
}
/* Jetée de planches sur pieux, du quai à la chapelle de saint Nicolas : 3 m de large, garde-corps de bois blanc, bittes et échelle */
function meltemPier() {
  const M = DECOR, c = MEL.coast, x0 = -37.4;
  box('boards', x0, c, -0.28, 0, -1.5, 1.5, { tint: [0.62, 0.55, 0.48], m: 'wood' });
  M.save().local(1).color([0.4, 0.33, 0.26]);
  for (let x = x0 + 0.3; x < c; x += 2.2) for (const z of [-1.3, 1.3]) { M.save().move(x, MEL.wl - 2.5, z); M.cyl('wood', 0.16, 2.3 - MEL.wl + 0.17, 8); M.restore(); } // têtes 3 cm sous le dessus du tablier
  M.restore();
  for (const z of [-1.42, 1.42]) { railing(z, z, 0, x0 + 0.2, c - 0.4, 'x', undefined, [0.95, 0.95, 0.93]); }
  for (const x of [-34.5, -32.5]) for (const z of [-1.2, 1.2]) M.place(PF.bitt(), x, 0, z, 0, { nocol: true });
  M.place(PF.lifeRingStand(), -33.4, 0, -1.2, Math.PI);
  cyChapel(-39.6, 0);
  // le drapeau flotte sur le toit de la chapelle, au coin nord-est près du clocheton, déployé au-dessus de l'eau (planté sur la jetée, il touchait
  // son garde-corps) : de la jetée et du village, on le voit à côté du dôme
  cyFlag(-37.75, 3.25, -1.85, Math.PI / 2, 2.4);
}

/* ---------- Le bourg ---------- */
function meltemTown(P) {
  const R = rngOf(2607), stairs = meltemStairs();
  // aucune porte à moins de 1,7 m d'un escalier ou de son palier (le couloir de 1,5 m devant une porte reste libre) : l'escalier longe
  // le mur sans masquer d'entrée ; ni dans le coin du quai (bittes d'amarre), ni derrière un muret de l'aire à battre
  const corner = [[-30, -26, 46, 48.5], [-30, -26, -48.5, -46]].concat(MEL.murets.flatMap(([x0, x1, z0, z1]) => [[x0 - 1.6, x1 + 1.6, z0 - 1.6, z1 + 1.6], [x0 - 1.6, x1 + 1.6, -z1 - 1.6, -z0 + 1.6]]));
  // aucune fenêtre du rez-de-chaussée derrière un escalier ni son palier : les volets s'ouvriraient dans les marches
  // (S.nz : emprise d'origine en x d'une volée raccourcie depuis : les mêmes portes et fenêtres, donc les mêmes tirages du décor)
  CYC.noWin = stairs.flatMap((S) => [[(S.nz ? S.nz[0] : S.x0) - 0.7, (S.nz ? S.nz[1] : S.x1) + 0.7, S.z0 - 0.7, S.z1 + 0.7]].concat(S.land ? [[S.land.x0 - 0.7, S.land.x1 + 0.7, S.land.z0 - 0.7, S.land.z1 + 0.7]] : []));
  CYC.noDoor = corner.concat(stairs.flatMap((S) => [[(S.nz ? S.nz[0] : S.x0) - 1.7, (S.nz ? S.nz[1] : S.x1) + 1.7, S.z0 - 1.7, S.z1 + 1.7]].concat(S.land ? [[S.land.x0 - 1.7, S.land.x1 + 1.7, S.land.z0 - 1.7, S.land.z1 + 1.7]] : [])));
  // escaliers extérieurs et leurs ouvertures de parapet
  for (const S of stairs) {
    let { z0, z1 } = S;
    // palier de plain-pied en haut d'une volée droite (axe z) : on sort de côté sur le toit sans ressaut. Sans lui, l'ouverture du parapet
    // tombait sur le haut de la volée, 52 cm sous le toit : il fallait sauter, et les bots restaient en bas
    if (S.palier) {
      const up = S.h1 > S.h0, hi = Math.max(S.h0, S.h1), [pa, pb] = up ? [z1 - S.palier, z1] : [z0, z0 + S.palier];
      if (up) z1 = pa; else z0 = pb;
      box('chaux', S.x0, S.x1, 0, hi, pa, pb, { tint: CY_WHITE, bevel: 0.03 });
      const zc = up ? pb : pa; railing(zc, zc, hi, S.x0, S.x1, 'x', undefined, CY_BLUE); // tête
      for (const sd of S.sides) { const xs = sd ? S.x1 : S.x0; railing(xs, xs, hi, pa, pb, 'z', undefined, CY_BLUE); } // côté du vide
    }
    cyStair(S.x0, S.x1, z0, z1, S.axis, S.h0, S.h1, { sides: S.sides });
    // garde-corps en travers de la tête des volées droites : plus de pas dans le vide, on monte sur le toit par l'ouverture du parapet
    if (S.axis === 'z' && !S.land && !S.palier) { const up = S.h1 > S.h0, zc = up ? S.z1 : S.z0; railing(zc, zc, up ? S.h1 : S.h0, S.x0, S.x1, 'x', undefined, CY_BLUE); }
    // palier plein en haut de la volée, de plain-pied avec le toit : on y entre par l'ouverture du parapet
    if (S.land) { const L = S.land; box('chaux', L.x0, L.x1, 0, L.h, L.z0, L.z1, { tint: CY_WHITE, bevel: 0.03 }); const zo = S.flip ? L.z0 : L.z1; railing(zo, zo, L.h, L.x0, L.x1, 'x', undefined, CY_BLUE); railing(L.x0, L.x0, L.h, L.z0, L.z1, 'z', undefined, CY_BLUE); }
  }
  cyBuildTown(P, {
    R,
    tint: (h, Rh) => (Math.abs(h.z0) < 15 && h.x0 > -14 && h.x1 < 10 ? Rh.pick(CYP.wash.slice(0, 6)) : Rh.pick(CYP.wash)),
    paintOf: (h, Rh) => Rh.pick(MEL.paint[h.z0 + h.z1 > 0 ? 0 : 1]),
    gaps: (h) => stairs.filter((S) => S.gap && cyGapHits(h, S.gap)).map((S) => S.gap),
    special: (h, f, F) => {
      // l'escalier du toit-terrasse longe tout le côté de l'îlot qui regarde la placette (|z| = 28) : mur aveugle, sans fenêtre à demi enterrée ni plante grimpante derrière les marches
      if (h.walk && Math.abs(f.fixed) === 28 && (f.face === 's' || f.face === 'n')) return { plain: true, climber: false };
      if (F.len < 3.4 || f.ya > 0.05 || h.walk) return null;
      const ax = Math.abs(f.fixed), mx = F.ox + F.len / 2 * Math.cos(F.rot), key = Math.abs(Math.round(h.x0 * 3 + Math.abs(h.z0 + h.z1) * 5));
      // sur la place (les façades de l'îlot qui regardent le Kafeneio) : boulangerie et épicerie
      if ((Math.abs(f.fixed) === 12) && h.x0 >= -12 && h.x1 <= -4) return { sign: { x: F.len / 2, y: 3.0, w: Math.min(F.len - 0.6, 3.2), h: 0.7, i: key % 2 ? CYS.artopoieio : CYS.bakaliko, frame: [0.1, 0.28, 0.55] }, door: Math.floor(Math.max(1, Math.round(F.len / 2.9)) / 2) };
      // sur la Marine : la ψαροταβέρνα et les chambres à louer
      if (f.face === 'w' && f.fixed === -20) return { sign: { x: F.len / 2, y: 2.75, w: Math.min(F.len - 0.6, 3.0), h: 0.7, i: key % 2 ? CYS.taverne : CYS.domatia, frame: [0.1, 0.28, 0.55] } };
      if (key % 5 === 0 && ax > 12 && F.len >= 4) return { sign: { x: F.len / 2 + 0.3, y: 2.9, w: 1.6, h: 0.45, i: CYS.domatia, frame: [0.1, 0.28, 0.55] } };
      void mx;
      return null;
    },
  });
}
/* L'ouverture de parapet g tombe-t-elle sur un côté de la maison h ? */
function cyGapHits(h, g) {
  const at = g.side === 'n' ? h.z0 : g.side === 's' ? h.z1 : g.side === 'w' ? h.x0 : h.x1;
  if (Math.abs(at - g.at) > 0.01) return false;
  return g.side === 'n' || g.side === 's' ? g.a0 >= h.x0 - 0.01 && g.a1 <= h.x1 + 0.01 : g.a0 >= h.z0 - 0.01 && g.a1 <= h.z1 + 0.01;
}
/* Escaliers extérieurs (moitié sud, puis leur miroir au nord) : x0..x1 par z0..z1, axis, hauteurs h0 (côté x0 ou z0) et h1, côtés à garde-corps, ouverture de parapet du toit */
function meltemStairs() {
  const S = [
    // îlot central, toit-terrasse : un escalier longe le côté sud (la placette du puits) et monte vers l'ouest jusqu'à un palier de plain-pied avec le toit
    // (pente de 0,58, palier de 2 m, ouverture du parapet de 1,6 m : la grille de navigation, au pas de 1 m et au rayon de 0,42, y passe). La première
    // marche est à 2 m de la maison d'en face (x = -2) : jusqu'en octobre 2026, la volée allait jusqu'à x = -3,4 (pente de 0,52) et l'on tournait à
    // 1,4 m du mur (retour du propriétaire : des premières marches trop proches du mur qu'elles regardent)
    { x0: -9.9, x1: -4.0, nz: [-9.9, -3.4], z0: 28.0, z1: 29.4, axis: 'x', h0: 3.4, h1: 0, sides: [1], gap: { side: 's', at: 28, a0: -11.4, a1: -9.8 }, land: { x0: -11.9, x1: -9.9, z0: 28.0, z1: 29.4, h: 3.4 } },
    // Terrasses : deux escaliers aux deux coins opposés du grand toit de l'est
    // (palier de 1 m en haut, face à l'ouverture du parapet : volée de 6,2 m, pente de 0,55, sous les 0,62 m d'une case à l'autre du réseau)
    { x0: 10.6, x1: 12.0, z0: 30.4, z1: 37.6, axis: 'z', h0: 0, h1: 3.4, sides: [0], palier: 1.0, gap: { side: 'w', at: 12, a0: 36.0, a1: 37.7 } },
    { x0: 24.0, x1: 25.4, z0: 30.4, z1: 37.6, axis: 'z', h0: 3.4, h1: 0, sides: [1], palier: 1.0, gap: { side: 'e', at: 24, a0: 30.2, a1: 31.8 } },
  ];
  const out = [];
  for (const s of S) {
    out.push(s);
    const m = { ...s, flip: true, land: s.land && { ...s.land, z0: -s.land.z1, z1: -s.land.z0 }, z0: -s.z1, z1: -s.z0, h0: s.axis === 'z' ? s.h1 : s.h0, h1: s.axis === 'z' ? s.h0 : s.h1, sides: s.axis === 'x' ? s.sides.map((q) => 1 - q) : s.sides };
    if (s.gap) m.gap = s.gap.side === 'n' || s.gap.side === 's' ? { side: s.gap.side === 's' ? 'n' : 's', at: -s.gap.at, a0: s.gap.a0, a1: s.gap.a1 } : { side: s.gap.side, at: s.gap.at, a0: -s.gap.a1, a1: -s.gap.a0 };
    out.push(m);
  }
  return out;
}

/* ---------- La taverne du port (Ψαροταβέρνα) : traversante, avec l'escalier du toit-terrasse à l'intérieur ---------- */
function meltemTaverna(s) {
  const M = DECOR, Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), R = rngOf(s > 0 ? 311 : 312);
  const X0 = -22, X1 = -16, [zA, zB] = zr(14, 24), t = 0.36, H = 3.4, o = { tint: CY_WHITE, frames: true, frameTint: CY_BLUE, m: 'concrete', top: false }; // top : le dallage du toit-terrasse couvre l'arase
  const za = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  cyDoorMark(X0, Z(19.5), -1, 0, 1.2, 'taverne'); cyDoorMark(X1, Z(22.5), 1, 0, 1.2, 'taverne');
  wallOpen('chaux', 'z', X0 + t / 2, t, zA, zB, 0, H, [{ ...za(18.9, 20.1), b0: 0, b1: 2.35, arch: 0.45 }, { ...za(15.4, 16.8), b0: 0.95, b1: 2.35 }, { ...za(21.4, 22.8), b0: 0.95, b1: 2.35 }], o);
  wallOpen('chaux', 'z', X1 - t / 2, t, zA, zB, 0, H, [{ ...za(21.9, 23.1), b0: 0, b1: 2.35, arch: 0.4 }, { ...za(16.8, 18.2), b0: 0.95, b1: 2.35 }], o);
  wallOpen('chaux', 'x', Z(14) + s * t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: -20.0, a1: -18.0, b0: 0.95, b1: 2.35 }], o);
  wallOpen('chaux', 'x', Z(24) - s * t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: -20.0, a1: -18.0, b0: 0.95, b1: 2.35 }], o);
  M.save().color([0.62, 0.7, 0.76]); M.cls = 1;
  for (const [a, b] of [zr(15.4, 16.8), zr(21.4, 22.8)]) M.quad('glass', [X0 + t / 2, 0.95, a], [X0 + t / 2, 0.95, b], [X0 + t / 2, 2.35, b], [X0 + t / 2, 2.35, a], [-1, 0, 0]);
  { const [a, b] = zr(16.8, 18.2); M.quad('glass', [X1 - t / 2, 0.95, a], [X1 - t / 2, 0.95, b], [X1 - t / 2, 2.35, b], [X1 - t / 2, 2.35, a], [1, 0, 0]); }
  for (const [z, nz] of [[Z(24) - s * t / 2, s], [Z(14) + s * t / 2, -s]]) M.quad('glass', [-20.0, 0.95, z], [-18.0, 0.95, z], [-18.0, 2.35, z], [-20.0, 2.35, z], [0, 0, nz]);
  M.restore();
  box('tiles', X0 + t, X1 - t, 0, 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.88, 0.86, 0.8] });
  // plafond de planches : percé au-dessus de la rampe, qui monte le long du mur est vers le nord (de z = 23,4 à z = 16 au sud, miroir au nord) et débouche de plain-pied sur le toit
  const hx0 = -18.4, hx1 = -16.36, hz = zr(16.0, 21.0);
  // (sans face du dessus : le dallage du toit-terrasse, posé par cyRoof au même niveau, la remplace ; les deux scintillaient)
  box('chaux', X0, hx0, H - 0.3, H, zA, zB, { tint: CY_WHITE, skip: 'Y' });
  box('chaux', hx0, X1, H - 0.3, H, hz[1], zB, { tint: CY_WHITE, skip: 'Y' });
  box('chaux', hx0, X1, H - 0.3, H, zA, hz[0], { tint: CY_WHITE, skip: 'Y' });
  if (s > 0) ramp(hx0 + 0.1, X1 - t, 16.0, 22.0, 'z', H, 0, 'chaux', [0.9, 0.88, 0.84], { mat: 'chaux' }); else ramp(hx0 + 0.1, X1 - t, -22.0, -16.0, 'z', 0, H, 'chaux', [0.9, 0.88, 0.84], { mat: 'chaux' }); // pente de 0,57 ; le palier plat devant la porte est (z 22 à 23,4) laisse le seuil libre
  railing(hx0, hx0, H, hz[0], hz[1], 'z', undefined, CY_BLUE);
  railing(hz[s > 0 ? 1 : 0], 0, H, hx0, hx1, 'x', undefined, CY_BLUE);
  // comptoir, tables, étagères et lampes
  M.save().local(1).color([0.4, 0.28, 0.18]); const [ca, cb] = zr(14.7, 17.6);
  M.boxB('wood', X0 + t + 0.3, X0 + t + 0.9, 0, 1.06, ca, cb); M.color([0.7, 0.72, 0.74]); M.boxB('steel', X0 + t + 0.25, X0 + t + 0.95, 1.06, 1.12, ca - 0.05, cb + 0.05, { bevel: 0.01 });
  M.restore();
  WORLD.col({ x0: X0 + t + 0.3, x1: X0 + t + 0.9, y0: 0, y1: 1.12, z0: ca, z1: cb }, 'wood');
  for (const [x, z] of [[-19.6, 15.4], [-19.6, 17.3]]) cafeSet(M, x, Z(z), [Math.PI * 0.5, -Math.PI * 0.5], [0.1, 0.3, 0.6]);
  for (const [x, z] of [[-19.6, 19.6], [-19.6, 16.4]]) pendantLamp(x, 2.5, Z(z), H - 0.3);
  // enseigne, store et tables à l'ombre d'une tonnelle de roseaux, côté mer
  // (ardoise du menu sur le trumeau entre la porte et la fenêtre, z = ±20,75 : à cheval sur la fenêtre, elle flottait à moitié dans le vide)
  inFrame(facadeFrame('w', X0, X1, zA, zB), (MM) => { cySignBoard(MM, s > 0 ? 4.6 : 5.4, 2.7, 3.4, 0.78, CYS.psaro); cyWallDecal(MM, CYD.menu, s > 0 ? 6.75 : 3.25, 1.1, 0.7, 0.7); });
  // tonnelle accrochée à la façade : ses poteaux est contre le mur (x -22,1) ; à x -22,6, ils laissaient avec lui un jour de 52 cm où l'on
  // restait coincé (accroches.js)
  cyPergola(-27.0, -22.1, ...zr(15.2, 23.0), 2.7, s > 0 ? 601 : 602, { vine: true });
  for (const z of [16.4, 22.2]) for (const [x, ang] of [[-25.2, 0], [-23.8, Math.PI]]) cafeSet(M, x, Z(z), [Math.PI * 0.5 + ang, -Math.PI * 0.5 + ang, ang], [0.1, 0.3, 0.6]);
  // toit-terrasse praticable : parapet, tables, bacs fleuris, vue sur la mer
  const house = { x0: X0, x1: X1, z0: zA, z1: zB, h: H, tint: CY_WHITE };
  cyRoof(house, { n: [[X0, X1]], s: [[X0, X1]], e: [[zA, zB]], w: [[zA, zB]] }, { R, walk: true, hole: [hx0, X1 - t, hz[0], hz[1]] });
  for (const [x, z, w, d] of [[-21.3, 17.6, 0.6, 2.0], [-21.3, 21.4, 0.6, 2.0]]) { const a = zr(z - d / 2, z + d / 2), bx = [x - w / 2, x + w / 2]; box('chaux', bx[0], bx[1], H, H + 0.85, a[0], a[1], { tint: CY_WHITE, bevel: 0.04 }); M.place(PF.cyBush(1.1, 2 + Math.round(x)), x, H + 0.85, Z(z), 0); }
}

/* Pot ou jarre au pied du mur le plus proche de (x, z) : jamais au milieu d'une ruelle ni devant une porte (on glisse le long du mur jusqu'à une place libre) */
function meltemPot(type, x, z, R, o = {}) {
  const w = cyWallSpot(x, z, 0.3, 1.6); if (!w) return false;
  const tx = Math.cos(w.ry), tz = -Math.sin(w.ry); // le long du mur
  for (const t of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const px = w.x + tx * t, pz = w.z + tz * t, q = cyWallSpot(px, pz, 0.3, 0.7);
    if (!q || hyp(q.x - px, q.z - pz) > 0.12 || !cyDoorClear(px, pz, 0.3)) continue;
    DECOR.dyn(type, px, 0, pz, R() * TAU, o); return true;
  }
  return false;
}
/* Plante, botte de paille ou arbre posé à la place libre la plus proche de (x, z) : hors du couloir devant les portes */
function meltemPlant(pf, x, y, z, ry, r = 0.6, reach = 3) {
  const D = MAP_DEFS.meltem, keep = (px, pz) => !D.spawns.some(([sx, sz]) => hyp(px - sx, pz - sz) < 1.5 || hyp(px - sx, pz + sz) < 1.5) && !D.poi.some((p) => p[1] < 1 && hyp(px - p[0], pz - p[2]) < 1.1); // ni sur une apparition ni sur un point d'intérêt
  const sp = cyClearSpot(x, z, r, reach, (px, pz) => Math.abs(pz) < 47.2 && px > -29.4 && px < 29.4 && !cyNearWall(px, pz, Math.min(r * 0.7, 0.7)) && keep(px, pz), r > 1 ? 3.2 : 2.0); // dans la zone de jeu, hors des murs, et la couronne ne couvre pas une entrée
  if (!sp) return false;
  DECOR.place(pf, sp[0], y, sp[1], ry); return true;
}

/* ---------- La Marine (quai, tamaris, kiosque, barques) : moitié s ---------- */
function meltemMarine(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 701 : 702), c = MEL.coast, rot = (a) => (s > 0 ? a : Math.PI - a);
  // caïques amarrés à couple le long du quai, une rangée de plus au large
  const kaikis = [
    [7.5, [0.94, 0.94, 0.9], [0.1, 0.3, 0.62], 0, 1], [16.5, [0.15, 0.4, 0.62], [0.95, 0.95, 0.92], 1, 2], [25.5, [0.92, 0.9, 0.84], [0.62, 0.16, 0.12], 2, 3], [36, [0.94, 0.94, 0.9], [0.16, 0.42, 0.34], 3, 4], [44.5, [0.2, 0.38, 0.6], [0.92, 0.72, 0.2], 0, 5],
  ];
  for (const [z, hull, accent, name, seed] of kaikis) {
    floatAdd(PF.cyKaiki({ hull, accent, name, seed }), c - 1.9, Z(z), s > 0 ? 0.04 : Math.PI - 0.04, { L: 7.6, B: 2.7, draft: 0, roll: 0.03 });
    const bz = (q) => (Math.abs(q - 13.5) < 0.1 ? 15.2 : q); // la bitte de z = 13,5 tomberait dans le bloc de la fontaine collé à la bordure : de l'autre côté de l'échelle
    for (const dz of [-3, 3]) M.place(PF.bitt(), c + 0.65, 0, Z(bz(z + dz)), 0); // une bitte sous chaque amarre
    mooringLine([c + 0.65, 0.55, Z(bz(z - 3))], [c - 1.9, MEL.wl + 0.9, Z(z - 2.6)], 0.5); mooringLine([c + 0.65, 0.55, Z(bz(z + 3))], [c - 1.9, MEL.wl + 0.9, Z(z + 2.6)], 0.5);
  }
  for (const [z, hull, accent, name, seed] of [[13, [0.94, 0.94, 0.9], [0.16, 0.42, 0.34], 1, 6], [31, [0.9, 0.9, 0.86], [0.1, 0.3, 0.62], 2, 7]]) floatAdd(PF.cyKaiki({ hull, accent, name, seed }), c - 5.2, Z(z), s > 0 ? -0.1 : Math.PI + 0.1, { L: 7.6, B: 2.7, draft: 0, roll: 0.04 });
  // échelles de quai, bouées de sauvetage
  M.place(PF.quayLadder(2.4), c - 0.02, 0, Z(30.75), -Math.PI / 2); // une échelle, sur le parement, dans le trou de 2,9 m entre les caïques à couple
  M.place(PF.lifeRingStand(), c + 0.5, 0, Z(22), -Math.PI / 2);
  // tamaris du front de mer, avec un banc dessous et face à la mer (à z = 27, le banc se rapproche du tronc : à 1,6 m il entrait sous le caïque
  // tiré au sec à z = 32,6)
  // (pas à z = 13,5, devant la niche de la fontaine, ni à z = 21, dans la tonnelle de la taverne ; l'angle est tiré quand même)
  for (const z of [7, 13.5, 21, 27]) { const ry = R() * TAU; if (z === 13.5 || z === 21) continue; M.place(PF.cyTamarisk(3.6 + (Math.round(z) % 3) * 0.3, Math.round(z) + (s > 0 ? 0 : 20)), c + 3.2, 0, Z(z), ry); { const bz = Z(z + (z === 27 ? 1.0 : 1.6)); benchAt(c + 3.9, bz, c - 4, bz); } }
  // kiosque (periptero), poulpes qui sèchent, filets et casiers
  cyKiosk(-23.2, Z(9.0), -Math.PI / 2); // à x = -23,2 : il coupe, avec les quatre petits blocs du quai, toute ligne de tir le long de la Marine
  cyOctopusLine(c + 2.3, Z(30.7), Math.PI / 2, 3.2);
  // (pas de tas de filets sur la Marine : sur le quai, en x -27,5, z ±10,6, il fermait avec le tamaris et son banc l'allée le long de l'eau ;
  // entre les caïques tirés au sec, il couvrait un point d'intérêt, et au nord d'eux, les apparitions : traversee.js, audit.js)
  M.place(PF.lobsterPots(2, 2, 2, s > 0 ? 3 : 4), -20.7, 0, Z(26.6), Math.PI / 2);
  // chantier naval : caïques tirés au sec sur leurs bers, treuil et outils
  cyHauledBoat(-25.5, Z(32.6), s > 0 ? 0 : Math.PI, { hull: [0.9, 0.9, 0.86], accent: [0.1, 0.3, 0.62], name: 3, seed: 8 });
  cyHauledBoat(-26.2, Z(42.4), s > 0 ? Math.PI : 0, { hull: [0.62, 0.2, 0.14], accent: [0.94, 0.94, 0.9], name: 0, seed: 9 });
  cyHauledBoat(-20.6, Z(45.0), Math.PI / 2, { hull: [0.94, 0.94, 0.9], accent: [0.16, 0.42, 0.34], name: 1, seed: 10 });
  for (const [x, z, n, k] of [[-22.0, 37.6, 2, 0], [-22.9, 37.8, 3, 1]]) M.place(PF.fishBinStackDyn(n, k), x, 0, Z(z), R() * 0.3);
  M.dyn('jerrycan', -23.4, 0, Z(39.6), 0.3, { tint: [0.85, 0.2, 0.1] }); M.dyn('gasBottle', -23.1, 0, Z(39.9), 0.2, { tint: [0.2, 0.35, 0.65] });
  for (const [x, z] of [[-27.4, 37.4], [-28.2, 38.2]]) M.dyn('barrel', x, 0, Z(z), R() * TAU, { tint: [0.15, 0.32, 0.55] });
  lampPost(-22.0, Z(26), 0); lampPost(-21.2, Z(41), 0);
  // chats : au soleil sur le quai et sur les marches
  M.place(PF.cyCat(1 + (s > 0 ? 0 : 1)), -29.2, 0.1, Z(15.8), 0.6, { nocol: true }); M.place(PF.cyCat(3), -22.2, 0, Z(31.0), -0.8, { nocol: true });
}

/* ---------- La place du Platane, le parvis de l'église (moitié s) ---------- */
function meltemPlace(s) {
  const Z = (z) => z * s, M = DECOR, R = rngOf(s > 0 ? 811 : 812);
  // au Kafeneio : tables et parasols sur la place, devant la porte est (au nord et au sud de l'axe)
  cafeSet(M, -10.8, Z(4.6), [Math.PI, 0, -Math.PI / 2], [0.1, 0.3, 0.6]);
  M.place(PF.cyUmbrella(), -10.8, 0, Z(4.6), 0, { nocol: true });
  // jardinières basses de pierre chaulée aux quatre coins de la place : couverts et fleurs
  for (const [x, z, w, d, k] of [[-13.3, 6.2, 1.8, 0.8, 1], [-13.3, 10.2, 1.8, 0.8, 2], [-6.0, 8.8, 2.4, 0.8, 3]]) meltemPlanter(x, Z(z), w, d, k + (s > 0 ? 0 : 4));
  // cyprès de part et d'autre du parvis
  for (const dz of [5.2]) M.place(PF.cyCypress(8.2, 1 + (s > 0 ? 0 : 3)), -5.0, 0, Z(dz), 0);
  // lampadaires, bancs et pots le long des façades de l'îlot
  lampPost(-14.6, Z(10.8), 0); lampPost(-4.3, Z(11.4), 0);
  for (const x of [-11.2, -5.6]) benchAt(x, Z(11.4), x, Z(8.5));
  for (const [x, z] of [[-12.6, 11.6], [-3.6, 11.6]]) meltemPot('cyPot', x, Z(z), R, { a: [R() < 0.5 ? 0 : 2] });
  // le chat de la place, sur le rebord du platane
  M.place(PF.cyCat(2), -9.2, 0.45, Z(1.5), 0.5, { nocol: true });
}
/* Jardinière de pierre chaulée avec ses fleurs (collision basse : un couvert pour s'accroupir) */
function meltemPlanter(x, z, w, d, seed) {
  const M = DECOR;
  M.save().color(CY_WHITE).world(1); M.boxB('chaux', x - w / 2, x + w / 2, 0, 0.7, z - d / 2, z + d / 2, { bevel: 0.05 }); M.restore();
  DECOR.col(x - w / 2, x + w / 2, 0, 0.7, z - d / 2, z + d / 2, 'concrete');
  const n = Math.max(1, Math.round(Math.max(w, d) / 1.0));
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (Math.max(w, d) - 0.9); M.place(PF.cyBush(1.0, seed + i), w >= d ? x + t : x, 0.66, w >= d ? z : z + t, i * 1.3, { nocol: true }); }
}

/* ---------- Au centre : le platane, la couronne de pierre, les bancs (autour de z = 0) ---------- */
function meltemCenter() {
  const M = DECOR, x = -8.5;
  // le tronc tient sa collision au-dessus de la margelle (le prefab la posait dès le sol, dans celle de la margelle)
  M.place(PF.cyPlane(10.5, 1), x, 0, 0, 0.7, { nocol: true }); for (const [hx, hz] of [[0.58, 0.24], [0.24, 0.58], [0.45, 0.45]]) DECOR.col(x - hx, x + hx, 0.45, 10.5 * 0.5, -hz, hz, 'wood'); // octogone : en carré de 1,24 m, il fermait les cases de la margelle de part et d'autre de l'axe, et B (sur la margelle) n'était pas à égalité de marche des deux bases
  // margelle ronde de pierre sèche chaulée, remplie de terre, qui sert de banc : 45 cm, la hauteur d'un banc et de la marche automatique
  // (STEP) ; à 55 cm il fallait sauter, et les bots ne montaient pas sur le point B qu'elle occupe
  M.save().move(x, 0, 0).local(1).color([0.9, 0.88, 0.82]); M.lathe('drystone', [[2.15, 0], [2.15, 0.4], [2.0, 0.45], [1.82, 0.45], [1.8, 0.1]], 16, { sharp: 0.5, uR: 1.2 }); M.restore();
  M.save().move(x, 0, 0).local(1).color([0.4, 0.3, 0.22]); M.save().move(0, 0.38, 0); M.cyl('dirt', 1.84, 0.03, 16); M.restore(); M.restore();
  // collision : un octogone de trois boîtes croisées (comme le moulin) au lieu d'un carré dont les coins sortent de la margelle ronde
  for (const [hx, hz] of [[1.9, 0.8], [0.8, 1.9], [1.6, 1.6]]) DECOR.col(x - hx, x + hx, 0, 0.45, -hz, hz, 'concrete');
  // le drapeau du Kafeneio, sur sa façade
  cyFlag(-12.1, 3.3, 2.6, Math.PI / 2);
}

/* ---------- Le village haut : tonnelles, arbres, linge, pots, chats (moitié s) ---------- */
function meltemChora(s) {
  const Z = (z) => z * s, M = DECOR, R = rngOf(s > 0 ? 901 : 902);
  // linge tendu en travers des ruelles de 2 m, d'un mur de deux niveaux à l'autre
  for (const z of [3.6, 8.4]) clothesLine(17.97, Z(z), 20.03, Z(z), 4.9);
  for (const z of [3.6, 9.2]) clothesLine(23.97, Z(z), 26.03, Z(z), 4.9);
  clothesLine(19.97, Z(16.4), 22.03, Z(16.4), 4.7);
  // pots devant les portes, bougainvillées et jarres le long des murs
  for (const [x, z] of [[19.1, 5.4], [25.2, 6.0], [21.0, 18.2], [27.0, 17.0], [27.2, 24.6], [16.2, 13.0]]) meltemPot('cyPot', x, Z(z), R, { a: [Math.floor(R() * 4)] });
  meltemPot('jar', 26.9, Z(25.6), R); meltemPot('jar', 26.9, Z(26.2), R, { s: 0.8 });
  // arbres isolés : un olivier dans la ruelle de l'Abside, une treille sur les terrasses
  meltemPlant(PF.cyOlive(4.4, 1 + (s > 0 ? 0 : 2)), 9.8, 0, Z(19.0), 0.3, 1.5, 4);
  // des chats sur les marches
  M.place(PF.cyCat(4), 25.0, 0.1, Z(37.3), 0.4, { nocol: true }); M.place(PF.cyCat(1), 11.2, 0.2, Z(30.6), -0.5, { nocol: true });
}

/* ---------- Les bases : cour du puits (centre), chantier (ouest, voir meltemMarine), aire à battre (est) ; le moulin derrière ---------- */
function meltemBase(s) {
  const Z = (z) => z * s, M = DECOR, R = rngOf(s > 0 ? 1001 : 1002), zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  // placette du puits (point A / C) : puits, trois figuiers, bancs, pots, ombres
  cyWell(-4.2, Z(38.8));
  for (const [x, z, h, sd] of [[-14.6, 31.2, 4.4, 1], [-14.8, 37.8, 4.2, 3]]) meltemPlant(PF.cyFig(h, sd + (s > 0 ? 0 : 3)), x, 0, Z(z), R() * TAU, 1.4, 3.5); // pas de figuier au pied de l'escalier du toit (-3,2 ; 31,6) : il pinçait la rue de la Source
  R();
  for (const [x, z] of [[-15.3, 33.0], [-15.3, 36.0]]) benchAt(x, Z(z), -9, Z(34)); // pas de banc à l'est de la placette : il touchait la porte de la maison (x = -2)
  for (const [x, z] of [[-15.7, 34.5]]) M.dyn('cyPot', x, 0, Z(z), R() * TAU, { a: [1] });
  R(); R();
  // citerne du centre : quatre bacs, jarres, outils
  M.dyn('jar', -12.6, 0, Z(41.6), 0.2); M.dyn('jar', -2.4, 0, Z(41.5), 1.0, { s: 0.9 });
  meltemPlant(PF.cyOlive(4.8, 5 + (s > 0 ? 0 : 1)), -0.4, 0, Z(44.0), 0.5, 1.5, 4);
  meltemMillHouse(s);
  // aire à battre : le dallage rond, murets de pierre sèche, bottes de paille, oliviers
  M.save().move(21.0, 0.0, Z(44.5)).color([0.82, 0.78, 0.7]).world(1); M.lathe('slab', [[4.4, 0.0], [4.4, 0.05], [3.8, 0.07], [0, 0.07]], 28, { sharp: 0.9, uR: 1 }); M.restore();
  for (const [x0, x1, z0, z1] of MEL.murets) { const a = zr(z0, z1); box('drystone', x0, x1, 0, 1.15, a[0], a[1], { tint: [0.9, 0.88, 0.82], m: 'concrete' }); }
  for (const [x, z] of [[28.0, 46.4], [10.4, 43.6]]) meltemPlant(PF.hayBale(), x, 0, Z(z), R() * TAU, 0.9);
  for (const [x, z, h] of [[8.4, 45.8, 4.2], [28.6, 43.0, 4.0]]) meltemPlant(PF.cyOlive(h, 7), x, 0, Z(z), R() * TAU, 1.5, 4);
  for (const [x, z] of [[6.6, 41.6], [24.4, 47.2], [9.8, 47.4]]) meltemPlant(PF.cyOpuntia(1.0 + R() * 0.3), x, 0, Z(z), R() * TAU, 0.7);
  for (const [x, z] of [[27.6, 41.2], [12.0, 47.2]]) meltemPlant(PF.cyAgave(1.1), x, 0, Z(z), R() * TAU, 0.7);
  for (const z of [47.6]) for (const x of [-4, 6, 29]) meltemPlant(PF.cyCypress(7 + R() * 1.5, Math.round(x) + 5), x, 0, Z(z), 0, 0.8); // aucun sur le dallage de l'aire (centre 21, rayon 4,4)
}

/* La maison du moulin, derrière la base et hors de la zone de jeu : un cube chaulé un peu plus haut que le pourtour, le moulin sur son toit,
   ailes tournées vers le village. Il remplace le moulin posé au sol dans le coin de la cour, que l'on ne voyait que de cette cour. */
function meltemMillHouse(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), H = 10.8, x0 = MEL.millX - 5, x1 = MEL.millX + 5, [z0, z1] = zr(50, 58);
  box('chaux', x0, x1, 0, H, z0, z1, { tint: CY_WHITE, m: 'concrete' });
  // parapet bas et sa couvertine, comme les toits du bourg
  for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0 + 0.22], [x0, x1, z1 - 0.22, z1], [x0, x0 + 0.22, z0, z1], [x1 - 0.22, x1, z0, z1]]) {
    box('chaux', a0, a1, H, H + 0.45, b0, b1, { tint: CY_WHITE, collide: false });
    box('chaux', a0 - 0.03, a1 + 0.03, H + 0.45, H + 0.52, b0 - 0.03, b1 + 0.03, { tint: [0.97, 0.96, 0.94], collide: false, bevel: 0.03 });
  }
  cyWindmill(MEL.millX, Z(54), s > 0 ? Math.PI : 0, { y: H, face: s > 0 ? -Math.PI / 2 : Math.PI / 2, roof: true, sail: s > 0 ? null : MEL.sail[1] });
}

/* Relief de la colline de l'est (x > 52) : même fonction pour la surface et pour les maisons posées dessus */
function meltemHillY(x, z) {
  MEL.hn = MEL.hn || makeNoise(75);
  const u = (z + 250) / 500, v = (x - 52) / 278, n = MEL.hn.fbm(u * 4, v * 2, 32, 32, 4);
  return -1 + Math.pow(smoothstep(0, 0.9, v), 1.4) * (30 + n * 58);
}
/* ---------- Arrière-plan : collines et village lointain, moulins sur la crête, îles, môle et phare ---------- */
function meltemBackdrop() {
  const M = DECOR, R = rngOf(6262);
  WORLD.force = 'far';
  // la colline de l'est : pentes sèches, maisons blanches qui montent, moulins, chapelle sur le sommet ; au nord et au sud, la mer jusqu'à l'horizon (des promontoires vus par la tranche ne donnaient que des éclats sombres)
  M.save().color([0.7, 0.67, 0.56]).local(1); M.cls = 1;
  M.surf('rock', 36, 6, (u, v) => { const z = lerp(-250, 250, u), x = lerp(52, 330, v); return [x, meltemHillY(x, z), z]; }, { uL: 520, vL: 300 });
  M.restore();
  // le village qui monte : cubes blancs en gradins, coupoles bleues, moulins sur la crête
  for (let i = 0; i < 110; i++) {
    const x = R.range(40, 150), z = R.range(-150, 150);
    if (x < 52 && Math.abs(z) < 62) continue;
    farCyclad(x, Math.max(0, meltemHillY(x, z) - 0.5), z, R.range(6, 11), R.range(5, 9), R.range(3.4, 7), R);
  }
  for (const [x, z] of [[100, -60], [112, -20], [96, 40], [118, 90], [120, -110]]) farWindmill(x, meltemHillY(x, z) + 1.5, z);
  for (const [x, z] of [[160, 10], [140, -80]]) farChapel(x, meltemHillY(x, z) + 1.5, z);
  // phare et môle de l'avant-port, île au large
  lighthouse(-120, -28, 13, CY_BLUE, 2.4);
  M.save().color([0.78, 0.76, 0.7]).world(1);
  for (const [ax, az, bx, bz] of [[-30, -170, -118, -60], [-30, 175, -140, 60]]) { const L = hyp(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az); M.save().move(ax, 0, az).rotY(ang); M.boxB('concrete', -2.4, 2.4, MEL.wl - 1, 2.0, 0, L, { bevel: 0.05 }); M.restore(); waterObstacle([[ax - 5, az], [ax + 5, az], [bx + 5, bz], [bx - 5, bz]], 3, [0.7, 0.68, 0.62], 1); }
  M.restore();
  for (const [x, z, r, h] of [[-330, -90, 70, 22], [-420, 120, 90, 30], [-260, 210, 50, 14]]) { M.save().move(x, 0, z).color([0.62, 0.58, 0.46]).local(1); M.lathe('rock', [[r, MEL.wl - 2], [r * 0.9, h * 0.2], [r * 0.6, h * 0.55], [r * 0.25, h * 0.9], [0, h]], 14, { sharp: 1.2 }); M.restore(); }
  WORLD.force = null;
  // voiliers et caïques au mouillage
  for (const [x, z, k] of [[-62, -44, 1], [-78, 18, 2], [-66, 62, 3], [-92, -8, 4], [-84, 92, 5]]) floatAdd(PF.sailboat(k), x, z, R() * TAU, { L: 9, B: 3, draft: 0.05, roll: 0.05 });
  for (const [x, z, k] of [[-50, 26, 1], [-60, -70, 2], [-46, -30, 3]]) floatAdd(PF.cyKaiki({ hull: R.pick([[0.94, 0.94, 0.9], [0.15, 0.4, 0.62], [0.9, 0.9, 0.84]]), accent: R.pick([[0.1, 0.3, 0.62], [0.62, 0.16, 0.12], [0.16, 0.42, 0.34]]), name: k % 4, seed: 20 + k }), x, z, R() * TAU, { L: 7.6, B: 2.7, draft: 0, roll: 0.05 });
}
/* Maison lointaine : cube blanc, fenêtres sombres, toit plat à rebord, coupole bleue parfois ; sans collision */
function farCyclad(cx, y0, cz, w, d, h, R) {
  const M = DECOR;
  M.save().move(cx, y0, cz).rotY(R() < 0.5 ? 0 : Math.PI / 2).color(R.pick(CYP.wash)).world(1);
  M.boxB('chaux', -w / 2, w / 2, -6, h, -d / 2, d / 2, { skip: 'y' });
  M.color([0.97, 0.96, 0.94]).local(1); M.boxB('chaux', -w / 2 - 0.1, w / 2 + 0.1, h, h + 0.35, -d / 2 - 0.1, d / 2 + 0.1);
  M.color([0.12, 0.2, 0.34]);
  for (const sd of [-1, 1]) for (let x = -w / 2 + 1.2; x < w / 2 - 0.8; x += 2.3) M.quad('dark', [x, h * 0.45, sd * (d / 2 + 0.01)], [x + 0.8, h * 0.45, sd * (d / 2 + 0.01)], [x + 0.8, h * 0.45 + 1.1, sd * (d / 2 + 0.01)], [x, h * 0.45 + 1.1, sd * (d / 2 + 0.01)], [0, 0, sd]);
  if (R() < 0.12) { M.color(CY_DOME); M.save().move(0, h + 0.35, 0); M.lathe('chaux', [[1.8, 0], [1.9, 0.2], [1.3, 1.1], [0.5, 1.7], [0, 1.8]], 10, { sharp: 0.9 }); M.restore(); }
  M.restore();
}
function farWindmill(x, y, z) {
  const M = DECOR;
  M.save().move(x, y, z).color(CY_WHITE).local(1); M.cyl('chaux', 3.6, 9, 12, { r1: 2.8, caps: '' }); M.save().move(0, 9, 0).color([0.7, 0.58, 0.34]); M.lathe('burlap', [[3.4, 0], [2.4, 1.4], [1, 2.6], [0, 3.2]], 12, { sharp: 0.9 }); M.restore();
  M.color([0.9, 0.9, 0.86]);
  for (let i = 0; i < 4; i++) { M.save().move(-3.2, 10.2, 0).rotX(i * Math.PI / 2 + 0.3); M.boxB('wood', -0.06, 0.06, 0.4, 7.0, -0.06, 0.06); M.boxB('cloth', -0.02, 0.02, 1.0, 6.8, 0, 1.4); M.restore(); }
  M.restore();
}
function farChapel(x, y, z) {
  const M = DECOR;
  M.save().move(x, y, z).color(CY_WHITE).world(1); M.boxB('chaux', -3, 3, -6, 4.2, -2.6, 2.6, { bevel: 0.1 });
  M.local(1); M.color(CY_DOME); M.save().move(0, 4.2, 0); M.lathe('chaux', [[2.3, 0], [2.4, 0.2], [1.7, 1.5], [0.7, 2.3], [0, 2.5]], 12, { sharp: 0.9 }); M.restore(); M.restore();
}

/* ---------- Sol ---------- */
function meltemGround(P) {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, out = new Uint8Array(W * H * 4), N = makeNoise(2607);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4;
    const ci = P.ix(x), ck = P.kz(z), n1 = N.fbm(x * 0.09, z * 0.09, 32, 32, 3), n2 = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
    let r = 0, g = 0, b = 0, a = 0.15 + n2 * 0.3;
    if (x < MEL.coast) { g = 1; } // le quai passe sous l'eau : sans importance
    else if (ci >= 0 && ci < P.W && ck >= 0 && ck < P.H) {
      const ch = P.G[ck][ci], base = Math.abs(z) > 40 && !(ci < 5);
      if (ch === '.' || ch === 'a') {
        if (ci < 5) g = 1;                                                       // quai : galets
        else if (Math.abs(z) > 40 || (Math.abs(z) > 38 && ci > 13)) { r = Math.abs(z) > 40 ? 0.15 + 0.35 * smoothstep(0.35, 0.65, n1) * 0 : 1; a = 0.35 + n2 * 0.4; r = Math.abs(z) > 41 ? 0.0 : r; }
        else r = 1;                                                              // ruelles et places : dalles
        if (base && ci >= 5 && Math.abs(z) > 40.5) { r = Math.min(r, 0.12 * (1 - smoothstep(0.3, 0.6, n1))); a = 0.4 + n2 * 0.4; }
        // bordure de chaux au pied des murs (0,3 m), parvis blanc devant l'église
        const fx = (x - P.cx(ci)) / P.c, fz = (z - P.cz(ck)) / P.c;
        const dw = Math.min(fx < 0.5 ? (P.at(ci - 1, ck) !== '.' && P.at(ci - 1, ck) !== '~' ? fx * P.c : 9) : (P.at(ci + 1, ck) !== '.' && P.at(ci + 1, ck) !== '~' ? (1 - fx) * P.c : 9),
          fz < 0.5 ? (P.at(ci, ck - 1) !== '.' && P.at(ci, ck - 1) !== '~' ? fz * P.c : 9) : (P.at(ci, ck + 1) !== '.' && P.at(ci, ck + 1) !== '~' ? (1 - fz) * P.c : 9));
        if (dw < 0.3 + n2 * 0.08 && ci >= 5 && r > 0.5) { b = 1; r = 0; }
        if (x > -9.4 && x < -3.6 && Math.abs(z) < 5.2) { b = Math.max(b, 0.9 * (1 - smoothstep(0.6, 0.9, n1))); r *= 1 - b; } // parvis
      } else { r = 0; }
    } else if (x >= MEL.coast) { r = 0; a = 0.3 + n2 * 0.4; }
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(a, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_MELTEM);
  // terre ferme seulement : pas de sol au-dessus de la mer
  // percée au droit du conduit des puits (CYC.holes, cyWell) : un mur couché (son y part vers -z), les trous en carrés que la margelle recouvre
  const M = DECOR; WORLD.force = 'g';
  M.save().color([0.8, 0.8, 0.76]).local(1); M.aoFn = null;
  M.save().move(MEL.coast, 0, 330).rotX(-Math.PI / 2);
  M.wall('ground', 330 - MEL.coast, 660, (CYC.holes || []).map(([x0, x1, z0, z1]) => ({ x0: x0 - MEL.coast, x1: x1 - MEL.coast, y0: 330 - z1, y1: 330 - z0 })));
  M.restore();
  M.restore(); WORLD.force = null;
}

/* ---------- Définition de la carte (voir MAP_DEFS dans 02-map.js et 02z-load.js) ---------- */
MAP_DEFS.meltem = {
  type: 'close', // combat rapproché (ruelles chaulées) : README « Règles de conception d'une carte » ; règle le choix des armes des bots (botArmForMap)
  bounds: { x0: -42, x1: 30, z0: -48, z1: 48 },
  textures: ['plaster', 'stone', 'cobble', 'pavers', 'wood', 'shutter', 'drystone', 'sand', 'canvas', 'linge', 'steel', 'paintwood', 'burlap', 'timber'], // murets et sol de base en photo (remplacent les procéduraux)
  // ambiance enregistrée (05c-ambiance.js, paquet amb_meltem) : vent de mer et ressac au loin, clapot contre le quai, cigales des collines,
  // grincement des moulins ; de loin en loin, mouettes au-dessus du port, cloche de la chapelle de la jetée, clochettes de chèvres sur la
  // colline, rafales de meltem. Le lit est surtout la mer (ressac, avec un peu de vent et de cigales) : il suit la distance à la côte (x < MEL.coast,
  // quai et jetée compris), comme à Kervénec (retour du propriétaire : « le son de l'eau s'entend sur toute la carte »)
  sound: { pack: 'amb_meltem', bed: 0.55,
    water: (x) => Math.max(0, x - MEL.coast),
    loops: () => [-36, -12, 12, 36].map((z) => ({ id: 'a_waves', p: [MEL.coast - 1.5, -0.4, z], gain: 0.4, ref: 5, roll: 1.3, max: 110 }))
      .concat([[40, -30], [40, 30], [-6, 70], [-6, -70]].map(([x, z]) => ({ id: 'a_cicadas', p: [x, 3, z], gain: 0.3, ref: 8, roll: 1.2, max: 140 })))
      .concat((CYC.mill || []).map((m) => { const p = m.g.getWorldPosition(new V3()); return { id: 'a_mill', p: [p.x, p.y, p.z], gain: 0.22, ref: 5, roll: 1.4, max: 70 }; })),
    spots: [
      { id: 'a_gull', every: [7, 18], gain: 0.4, at: () => new V3(rand(-70, -34), rand(10, 22), clamp(camera.position.z + rand(-25, 25), MAP.z0 - 10, MAP.z1 + 10)), ref: 10 },
      { id: 'a_bell', every: [70, 160], gain: 0.3, at: () => new V3(-39.6, 4, 0), ref: 14, roll: 0.8 },
      { id: 'a_goats', every: [35, 80], gain: 0.25, at: () => new V3(rand(50, 90), rand(4, 12), rand(-60, 60)), ref: 10, roll: 0.9 },
      { id: 'a_gust', every: [10, 24], gain: 0.35, dist: [4, 12], y: [2, 7] },
    ] },
  surfaces: MELTEM_SURFACES,
  kit: () => meltemKit(),
  materials: (M) => makeMeltemMaterials(M),
  // illustration des menus (tools/dev/illustrations.js) : vue plongeante du large, au nord-ouest ; la chapelle de la jetée et son drapeau à droite
  // (l'écran de chargement assombrit la gauche), les caïques, la Marine et le village, le moulin du sud et la montagne au fond
  art: { cam: [-52, 8.5, -12], look: [-8, 3.5, 6], fov: 54 },
  // repères pour s'orienter (mesurés par tools/dev/visual/leveldesign.js) : le dôme de la Panagia, la chapelle de la jetée, le moyeu des ailes des deux moulins
  landmarks: [[2.2, 8.6, 0, 'dôme'], [-39.6, 5.9, 0, 'chapelle'], [-10, 18.2, 50.6, 'moulin sud'], [-10, 18.2, -50.6, 'moulin nord']],
  splat: { x0: -52, z0: -70, w: 104, d: 140, ppm: 4 },
  far: 460,
  build() { meltemLevel(); },
  after() { waterBuild({ deep: [0.0, 0.035, 0.12], shallow: [0.0, 0.1, 0.17], scatter: [0.01, 0.08, 0.13], foam: [0.82, 0.86, 0.86], refl: 1.0, floor: [2.6, 9, 28], abs: [0.45, 0.12, 0.04], sand: [0.55, 0.56, 0.56], caus: 1, foamK: 0.4 }); },
  ready() { waterReady({ from: [-60, MEL.wl + 2.5, 0] }); },
  update(t) { cyUpdateMills(t); },
  unload() { CYC.mill = null; CYC.holes = null; CYC.P = null; CYC.doors = null; CYC.noDoor = null; CYC.noWin = null; CYC.paintAt = null; },
  // apparitions de l'équipe Alpha (sud) ; celles de Bravo en sont le miroir : chantier, cour du puits derrière la citerne, aire à battre
  spawns: [[-23.5, 42.5], [-20.5, 42.5], [-22.5, 40.5], [-16.5, 45.5], [-12.5, 46.5], [-9.5, 47.5], [-5.5, 46.5], [-1.5, 45.5], [1.5, 43.5], [6.5, 46.5], [13.5, 44.5], [17.6, 46.2], [19.5, 40.5], [26.5, 46.5], [26.5, 41.5]],
  /* Points d'intérêt des bots : [x, y, z, route, tenue] ; route L (Marine, taverne, chantier), M (place, îlot, placettes), E (ruelle de l'Abside, Chora, Terrasses) */
  poi: [
    [-25.5, 0, 37.5, 'L'], [-25.5, 0, -37.5, 'L'], [-23.5, 0, 28.5, 'L', 1], [-23.5, 0, -28.5, 'L', 1], [-25, 0, 19, 'L'], [-25, 0, -19, 'L'], [-19, 3.5, 19, 'L', 1], [-19, 3.5, -19, 'L', 1],
    [-19, 0, 19, 'L', 1], [-19, 0, -19, 'L', 1], [-24.5, 0, 10.5, 'L', 1], [-24.5, 0, -10.5, 'L', 1], [-28, 0, 7, 'L'], [-28, 0, -7, 'L'], [-33, 0, 0, 'L', 1], [-18, 0, 9, 'L'], [-18, 0, -9, 'L'],
    [-8, 0, 7.5, 'M'], [-8, 0, -7.5, 'M'], [-11.5, 0, 8.5, 'M'], [-11.5, 0, -8.5, 'M'], [-5.5, 0, 6.5, 'M', 1], [-5.5, 0, -6.5, 'M', 1], [-15, 0, 15, 'M'], [-15, 0, -15, 'M'],
    [-3, 0, 14, 'M'], [-3, 0, -14, 'M'], [-8, 0, 21, 'M', 1], [-8, 0, -21, 'M', 1], [-7.5, 3.5, 26.5, 'M', 1], [-7.5, 3.5, -26.5, 'M', 1], [-9, 0, 34, 'M'], [-9, 0, -34, 'M'],
    [-13, 0, 30, 'M'], [-13, 0, -30, 'M'], [-6.5, 0, 36.5, 'M'], [-6.5, 0, -36.5, 'M'], [-7, 0, 41, 'M'], [-7, 0, -41, 'M'], [-1, 0, 41, 'M'], [-1, 0, -41, 'M'], [-1.5, 0, 17.5, 'M'], [-1.5, 0, -17.5, 'M'],
    [10, 0, 14.5, 'E'], [10, 0, -14.5, 'E'], [10, 0, 22, 'E'], [10, 0, -22, 'E'], [9, 0, 30, 'E'], [9, 0, -30, 'E'], [8.5, 0, 38.5, 'E'], [8.5, 0, -38.5, 'E'],
    [16, 0, 13, 'E'], [16, 0, -13, 'E'], [20, 0, 13, 'E'], [20, 0, -13, 'E'], [26, 0, 13, 'E'], [26, 0, -13, 'E'], [16, 0, 21, 'E'], [16, 0, -21, 'E'], [26, 0, 29, 'E'], [26, 0, -29, 'E'],
    [18, 3.5, 34, 'E', 1], [18, 3.5, -34, 'E', 1], [15.5, 3.5, 33.5, 'E', 1], [15.5, 3.5, -33.5, 'E', 1], [22, 3.5, 36, 'E', 1], [22, 3.5, -36, 'E', 1],
    [20, 0, 1, 'E', 1], [25, 0, 0, 'E', 1], [15, 0, 1, 'E'], [19.5, 0, 40, 'E'], [19.5, 0, -40, 'E'], [14, 0, 39.5, 'E'], [14, 0, -39.5, 'E'], [26.5, 0, 41.5, 'E'], [26.5, 0, -41.5, 'E'],
  ],
  // domination : A et C sur les placettes du puits, devant chaque base ; B sur la place du Platane, au centre
  dom: [[-10, 36], [-20, 0], [-10.5, -36]], // placés par le propriétaire avec l'outil des zones (?outil=zones, octobre 2026)
  mecha: [[-8.5, -5.5], [10, 17.5], [9.5, -17.5]], // zones de largage du mecha (08f-mecha.js, mnavZones), placées de même
  lane: (x) => (x < -19.5 ? 'L' : x > 12.5 ? 'E' : 'M'),
  sniper: [-19, 3.5, 19], // le toit-terrasse de la taverne : toute la Marine et la place en enfilade
  coverZ: 42,
  heli: [34, 52],
  cam: 50,
  // pas sur les planches du ponton, des ponts et de la chapelle : bois ; dans les cours : terre ; ailleurs, dalles et galets
  surface: (p) => (p.x < -30 ? 'wood' : Math.abs(p.z) > 41 && p.x > -18 ? 'dirt' : 'concrete'),
  zones: [
    [_t('Base Alpha'), -30, 30, 40, 48], [_t('Base Bravo'), -30, 30, -48, -40],
    [_t('Chapelle de la jetée'), -42, -37.4, -2.4, 2.4], [_t('Jetée'), -42, -30, -3, 3],
    [_t('Chantier naval'), -30, -17, 39, 48], [_t('Chantier naval'), -30, -17, -48, -39],
    [_t('Taverne du port'), -22, -16, 14, 24], [_t('Taverne du port'), -22, -16, -24, -14],
    [_t('Kafeneio'), -16, -12, -4, 4], [_t('Église de la Panagia'), -4, 8.4, -4, 4],
    [_t('Place du Platane'), -16, -4, -12, 12], [_t('Placette du puits'), -16, -2, 28, 40], [_t('Placette du puits'), -16, -2, -40, -28],
    [_t('Ruelle de l\u0027Arche'), -12, 8, 20, 24], [_t('Ruelle de l\u0027Arche'), -12, 8, -24, -20],
    [_t('Toit de l\u0027îlot'), -12, -4, 22, 28], [_t('Toit de l\u0027îlot'), -12, -4, -28, -22],
    [_t('Rue du Port'), -16, -12, 12, 28], [_t('Rue du Port'), -16, -12, -28, -12], [_t('Rue de la Source'), -4, 0, 12, 28], [_t('Rue de la Source'), -4, 0, -28, -12],
    [_t('Ruelle de l\u0027Abside'), 8, 12, -40, 40],
    [_t('Terrasses'), 12, 24, 30, 38], [_t('Terrasses'), 12, 24, -38, -30],
    [_t('Aire à battre'), 8, 30, 40, 48], [_t('Aire à battre'), 8, 30, -48, -40],
    [_t('Marine'), -30, -20, -48, 48], [_t('Chora'), 12, 30, -40, 40], [_t('Ruelles'), -20, 12, -40, 40],
  ],
  // ciel photographié (Poly Haven, kloofendal_48d_partly_cloudy) : bleu profond et cumulus de beau temps, soleil à 47°, tourné sur celui de la carte
  skyPhoto: { key: 'kloofendal_48d', rot: 0.6223, gain: 1.8 },
  atmo: ATMO_MELTEM,
};
