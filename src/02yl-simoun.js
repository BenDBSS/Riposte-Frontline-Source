/* ==========================================================================
   SIMOUN : une arène ronde au milieu des dunes, la plus grande carte du jeu (70 m de rayon), et le désert à perte de vue tout autour. En miroir
   nord-sud : Alpha au nord (+z), Bravo au sud.
   - Le relief (smH) : un erg (smErg), des cordons de dunes à peu près est-ouest, sinueux, recoupés de dunes nord-sud et coupés de cols, qu'on
     franchit pour avancer et dont les creux couvrent ; leurs crêtes tombent entre l'oasis, le camp et la base, les camps et les bases sont
     dans les creux (plates-formes aplanies, SM_PADS, où l'erg s'efface en pente douce). S'y ajoutent une grande dune posée à la main au bout
     de la sebkha et une autre entre le camp et la base (SM_DUNES), la sebkha plate de l'ouest (SM_PAN), des congères qui montent sur le
     flanc arrière de l'avion jusqu'à son toit et jusqu'au dessus des rochers (SM_DRIFTS), la cuvette de l'oasis ; au-delà du cercle, des
     dunes de plus en plus hautes jusqu'à l'horizon. Pentes : au plus 0,6 m par mètre presque partout (les bots y passent), plus raides par endroits au bord
     des plates-formes, comme un flanc sous le vent. Le moteur l'échantillonne (02-relief.js) ;
   - L'Oasis, au centre (B) : un grand bassin où l'on patauge, une île plate plantée de palmiers au milieu (le point B), la palmeraie autour,
     les murs ruinés de deux maisons de pisé de chaque côté, des puits ;
   - Les Camps, à mi-chemin (A et C) : camps de fortune pour le corps à corps (cabanes de tôle, conteneur ouvert, tente, mirador, sacs de sable) ;
   - La Mer de dunes, à l'ouest : la sebkha, un lac asséché plat où un avion de ligne s'est échoué (fuselage cassé, cabine où l'on entre,
     toit en hauteur par la dune qui le recouvre), bordée des plus hautes dunes et de deux garas (tables de grès au dessus praticable), pour
     les tireurs d'élite ;
   - Les Rochers, à l'est : un rocher de grès au dessus praticable (on y monte par une congère), le Campement bédouin de chaque camp et son
     rocher, praticable lui aussi ;
   - Les bases : un convoi à l'arrêt (camions, tentes, sacs de sable) ;
   - Hors du cercle, l'écran s'assombrit et l'on a 10 s pour revenir (RING, 02-relief.js) ; les bots n'y vont pas.
   ========================================================================== */
const SM_R = 70; // rayon de la zone de jeu
const SM_OASIS = { wl: 0.95, bed: 0.6, isl: 1.25, rim: 2.2, rx: 15, rz: 12, plaza: 6.2 }; // eau, fond (on y patauge), dessus de l'île,
// bord de la cuvette ; demi-axes du bassin ; rayon de l'île plate du point B
const SM_PALM = { lite: true }; // palmiers de la carte (PF.palm) : version allégée
const SMP = { life: null, devilTex: null, veilTex: null, plane: null };

/* ---------- Le relief ---------- */
/* L'erg : des cordons de dunes à peu près est-ouest (on les franchit pour avancer, on se cache dans les creux), sinueux, recoupés de dunes
   nord-sud, coupés de cols, de hauteur variable. Période lam le long de z : les crêtes tombent à |z| = 14 et 42 m (entre l'oasis, le camp
   et la base), les creux à 28 et 56 m (le camp, la base) ; xlam le long de x. Dans l'allée du milieu, des dunes plus basses (lane). */
const SM_ERG = { lam: 28, xlam: 36, amp: 4.4, warp: 3, cross: 0.8, gap: -0.5, fade: 7, lane: 0.5 };
/* Plates-formes aplanies (moitié Alpha ou sur l'axe, lues en |z|) : [x, z, rayon en x, rayon en z, fondu (m), hauteur] */
const SM_PADS = [
  [0, 57, 17, 6, 5, 2.6], // base
  [0, 29.5, 12.5, 8.5, 5, 2.3], // camp (A)
  [36.5, 43, 9, 7.5, 5, 2.9], // le campement bédouin
  [-29.5, 27.5, 6, 5, 4, 2.3], // le poste de guet de l'ouest
  [25.5, 24.5, 6, 4.5, 4, 2.4], // la casse de l'est
];
/* Autour des rochers : l'erg s'efface (le sable ne les ensevelit pas) sans aplanir le sol : [x, z (lu en |z|), rayon en x, rayon en z] */
const SM_CALM = [
  [55, 0, 10, 13], // le grand rocher de l'est
  [44, 27, 6.5, 6.5], // le rocher du campement
  [-57.5, 24, 6.5, 6.5], // la gara
];
/* La sebkha, à l'ouest : un lac asséché, plat, où l'avion s'est échoué (le terrain des tireurs d'élite) : [x, rayon en x, rayon en z, fondu, hauteur] */
const SM_PAN = [-44, 9, 26, 10, 2.0];
/* Grandes dunes posées à la main (moitié Alpha, la moitié Bravo en miroir) : [cx, cz, demi-longueur de la crête, flanc au vent (côté -u),
   flanc sous le vent (côté +u), hauteur, angle de la crête (rad, depuis +x), croissant (les cornes avancent sous le vent)] */
const SM_DUNES = [
  [-50, 46, 11, 10, 10, 4.5, 0.3, 0.2], // la grande crête au bout de la sebkha
  [0, 44.5, 16, 6.5, 6, 2.6, 0, 0], // entre le camp et la base : la base ne voit pas le point A
];
/* Congères en rampe (lues en |z|) : [x, z du haut (contre l'objet), z du pied, demi-largeur du dessus, hauteur du haut, pente des flancs] */
const SM_DRIFTS = [
  [-53.5, 0.5, 9, 1.2, 5.0, 2.0], // la dune qui monte sur le flanc arrière de l'avion, jusqu'à son toit (le sable entre dans le fuselage fermé)
  [53.5, 9.0, 24, 2.2, 8.95, 0.8], // jusqu'au dessus du rocher de l'est (le haut contre le bord du rocher, z = 9 : à 9,4, le sable retombait à 8,42 m au
  // pied du bord et il fallait sauter 58 cm pour monter, les bots restaient en bas)
  [44.0, 23.4, 15.5, 1.4, 6.5, 0.8], // jusqu'au dessus du rocher du campement
  [-57.0, 19.4, 11, 1.6, 6.0, 0.8], // jusqu'au dessus de la gara, au bord de la sebkha
];
const SMH = { base: 2.4, N: null };
function smDune(d, x, z) {
  const c = Math.cos(d[6]), s = Math.sin(d[6]), dx = x - d[0], dz = z - d[1], t = dx * c + dz * s;
  if (Math.abs(t) >= d[2]) return 0;
  const e = 1 - (t / d[2]) ** 2, u = -dx * s + dz * c - d[7] * (t / d[2]) ** 2 * d[3], q = u / (u < 0 ? d[3] : d[4]);
  if (Math.abs(q) >= 1) return 0;
  const k = 1 - q * q;
  return d[5] * e * e * k * k;
}
/* Bruit de taille f (m), périodique tous les 64 f mètres, et sa version symétrique en z (de -1 à 1, moyenne nulle) */
const smNz = (x, z, f, oct) => SMH.N.fbm(x / (f * 64) + 0.37, z / (f * 64) + 0.11, 64, 64, oct);
const smSym = (x, z, f, oct) => smNz(x, z, f, oct) + smNz(x, -z, f, oct) - 1;
/* Hauteur de l'erg (0 au creux) ; |z| adouci sur l'axe (sqrt(z² + 25)) : symétrique sans pli */
function smErg(x, z) {
  const E = SM_ERG, sa = Math.sqrt(z * z + 25), w = (smSym(x, z, 22, 2) + smSym(x, z, 70, 2)) * E.warp;
  const p = 0.5 - 0.5 * Math.cos(((sa + w) / E.lam) * TAU);
  const q = 0.5 - 0.5 * Math.cos(((x + smSym(x + 77, z, 26, 2) * E.warp) / E.xlam) * TAU);
  const lane = lerp(E.lane, 1, smoothstep(9, 22, Math.abs(x)));
  const a = E.amp * lane * (0.6 + 0.7 * (smSym(x + 200, z, 30, 2) * 0.5 + 0.5)), gap = smoothstep(E.gap, E.gap + 0.4, smSym(x + 500, z, 14, 2));
  return a * gap * lerp(p, Math.max(p, q * 0.85), E.cross);
}
/* Poids d'une plate-forme en (x, |z|) : 1 dessus, puis fondu sur f m */
function smPadW(p, x, az, f) { const q = hyp((x - p[0]) / p[2], (az - p[1]) / p[3]); return q <= 1 ? 1 : 1 - smoothstep(0, f, (q - 1) * Math.min(p[2], p[3])); }
/* Le bassin de l'oasis : 1 au rivage, moins dedans */
const smPondQ = (x, z) => hyp(x / SM_OASIS.rx, z / SM_OASIS.rz);
function smH(x, z) {
  if (!SMH.N) SMH.N = makeNoise(4242);
  const az = Math.abs(z), r = hyp(x, z), O = SM_OASIS, P = SM_PAN, F = SM_ERG.fade;
  // où l'erg s'efface : sebkha, cuvette de l'oasis, plates-formes (les dunes y descendent en pente douce)
  const qPan = hyp((x - P[0]) / P[1], z / P[2]), wPan = qPan <= 1 ? 1 : 1 - smoothstep(0, P[3], (qPan - 1) * Math.min(P[1], P[2]));
  const qo = smPondQ(x, z), qp = r / O.plaza;
  let m = (1 - wPan) * smoothstep(1.3, 2.3, qo);
  for (const p of SM_PADS) m *= 1 - smPadW(p, x, az, F);
  for (const p of SM_CALM) m *= 1 - smPadW(p, x, az, F);
  let h = SMH.base - 0.4 + smSym(x, z, 30, 3) * 0.5 + smSym(x, z, 9, 2) * 0.15 + smErg(x, z) * m;
  for (const d of SM_DUNES) h = Math.max(h, SMH.base - 0.4 + smDune(d, x, z) + smDune(d, x, -z));
  if (wPan > 0) h = lerp(h, P[4] + smSym(x, z, 12, 2) * 0.05, wPan);
  for (const p of SM_PADS) { const w = smPadW(p, x, az, 4); if (w > 0) h = lerp(h, p[5], w); }
  for (const d of SM_DRIFTS) {
    const L = d[2] - d[1], t = (az - d[1]) / L;
    if (t > 1.2) continue;
    let hd = t >= 0 ? lerp(d[4], SMH.base - 0.4, t) : d[4] - Math.abs(az - d[1]) * 1.2; // derrière le haut : sous l'objet
    hd -= Math.max(0, Math.abs(x - d[0]) - d[3]) * d[5];
    if (hd > h) h = hd;
  }
  // l'oasis : un grand bassin où l'on patauge, une île plate au milieu (le point B), berges douces jusqu'au bord de la cuvette
  if (qo < 2) {
    const q = qo * (1 + smSym(x * 2, z * 2, 6, 2) * 0.06); // rivage un peu irrégulier
    let o = q < 0.8 ? O.bed : q < 1 ? lerp(O.bed, O.wl + 0.06, smoothstep(0.8, 1, q)) : lerp(O.wl + 0.06, O.rim, smoothstep(1, 1.5, q));
    o = lerp(o, O.isl, smoothstep(1.3, 1.0, qp * (1 + smSym(x * 3, z * 3, 5, 2) * 0.04)));
    h = lerp(o, h, smoothstep(1.4, 2, q));
  }
  // au-delà du cercle : de grandes dunes jusqu'à l'horizon
  if (r > 76) {
    const k = smoothstep(76, 140, r) * lerp(1, 2.4, smoothstep(140, 420, r)), ridge = 1 - Math.abs(smSym(x, z, 60, 3));
    h += k * (ridge * ridge * 8 + (smSym(x + 900, z, 170, 3) + 1) * 3.5);
  }
  return h;
}

/* ---------- L'oasis ---------- */
/* Palmier varié (PF.palm, o.v) : hauteur, grosseur du tronc (g) et taille de la couronne (c) sont choisies pour une paire de palmiers en
   miroir (le couvert reste le même des deux côtés) ; le reste est tiré pour chacun (nombre de palmes, jupe de palmes sèches, courbure,
   dattes, rejets au pied, troncs de plus, couronne dressée ou ouverte, teinte). RP : le hasard des palmiers, à part de celui de l'oasis (rien
   d'autre ne bouge) */
function smPalmV(RP, g, c, kids = true) {
  const r2 = (v) => Math.round(v * 100) / 100, k = RP();
  return { g: r2(g), c: r2(c), n: 26 + Math.floor(RP() * 12), dry: 4 + Math.floor(RP() * 12), lean: r2(RP.range(0.05, 1.5)), dates: Math.floor(RP() * 5), kids: kids && k < 0.35 ? 1 + Math.floor(RP() * 2) : 0, trunks: kids && k > 0.88 ? 1 + Math.floor(RP() * 2) : 0, open: r2(RP.range(0.1, 0.9)), tint: RP.pick([[1.08, 0.95, 0.86], [1.14, 0.96, 0.78], [1.02, 0.92, 0.86], [1.2, 0.98, 0.74]]) }; // vert poussiéreux, olive à jauni (un vert franc criait sur le sable)
}
function smOasis(R) {
  const M = DECOR, O = SM_OASIS, RP = rngOf(5155);
  // le bassin : ellipse un peu plus grande que le rivage (le sable recouvre le bord) ; on patauge sur le fond
  const poly = []; for (let i = 0; i < 56; i++) { const a = (i / 56) * TAU; poly.push([Math.round(Math.cos(a) * O.rx * 1.1 * 100) / 100, Math.round(Math.sin(a) * O.rz * 1.1 * 100) / 100]); }
  pondAdd({ shape: 'poly', poly, y: O.wl, wade: O.bed, slope: 0.35, vis: 0.45, calm: 0.5, probeAt: [0, O.isl + 1.2, 0.5], depth: 0.7, deep: [0.02, 0.07, 0.07], shallow: [0.1, 0.16, 0.11], scatter: [0.03, 0.08, 0.07], tone: 0.45, cell: 0.5 });
  // l'île du point B : quatre palmiers dans le cercle (des troncs pour se couvrir, l'un gros, l'autre plus mince), des roseaux sur la rive
  for (const [x, z, h, g, c] of [[-3.6, 3.9, 9.2, 1.25, 1.05], [4.1, 3.4, 8.4, 0.95, 0.95]]) for (const sz of [1, -1]) M.place(PF.palm(h, Math.round(x * 7 + z * 3) + 40 + (sz > 0 ? 0 : 5), { ...SM_PALM, v: smPalmV(RP, g, c, false) }), x, smY(x, sz * z, 0.3), sz * z, R() * TAU);
  for (const a of [0.35, 1.2, 2.3, 2.9]) for (const sz of [1, -1]) { const r = O.plaza + R.range(0.5, 1.0), x = Math.cos(a) * r, z = sz * Math.sin(a) * r; M.place(PF.smReeds(R.range(0.7, 1.0)), x, smY(x, z) - 0.05, z, R() * TAU, { cls: 1 }); }
  // roseaux le long du rivage, en touffes, des deux côtés de la même façon
  for (let i = 0; i < 30; i++) {
    const a = R.range(0.12, Math.PI - 0.12), q = R.range(0.93, 1.05), s = R.range(0.8, 1.25);
    for (const sz of [1, -1]) { const x = Math.cos(a) * O.rx * q, z = sz * Math.sin(a) * O.rz * q; M.place(PF.smReeds(s), x, smY(x, z) - 0.05, z, R() * TAU, { cls: 1 }); }
  }
  // la palmeraie : autour du bassin, hors des ruines et du passage nord-sud
  const palms = [];
  for (let i = 0; i < 60 && palms.length < 16; i++) {
    const a = R.range(0.05, Math.PI - 0.05), q = R.range(1.12, 1.75), x = Math.cos(a) * O.rx * q, z = Math.sin(a) * O.rz * q;
    if (Math.abs(x) < 2.5) continue;
    if (palms.some((p) => hyp(p[0] - x, p[1] - z) < 3.4) || SM_RUINS.some((u) => Math.abs(x - u[0]) < u[2] / 2 + 1.5 && Math.abs(z - u[1]) < u[3] / 2 + 1.5)) continue;
    palms.push([x, z, R.range(7, 9.6)]);
  }
  // de jeunes palmiers (4 à 6 m, troncs trapus), des adultes (6,5 à 10 m), quelques vieux (10 à 12,5 m) ; troncs minces à gros
  for (const [x, z] of palms) {
    const k = RP(), h = Math.round((k < 0.2 ? RP.range(4.2, 5.6) : k < 0.82 ? RP.range(6.5, 9.8) : RP.range(10.2, 12.5)) * 10) / 10;
    const g = h < 6 ? RP.range(1.0, 1.3) : RP.range(0.75, 1.45), c = h < 6 ? RP.range(0.82, 0.95) : RP.range(0.9, 1.15);
    for (const sz of [1, -1]) M.place(PF.palm(h, Math.round(x * 5 + z) + 60 + (sz > 0 ? 0 : 7), { ...SM_PALM, v: smPalmV(RP, g, c) }), x, smY(x, sz * z, 0.3), sz * z, R() * TAU);
  }
  // les ruines : maisons de pisé sans toit, murs cassés, une ou deux portes
  for (const [cx, cz, w, d, gx, gz] of SM_RUINS) for (const sz of [1, -1]) {
    const z0 = sz * cz, y0 = smFlat(cx, z0, w / 2, d / 2, 0, 0.6) - 0.3, tint = R.pick(SM_MUD); // pied enterré de 30 cm dans le sable aplani
    const zS = z0 - sz * d / 2, zN = z0 + sz * d / 2;
    smRuin('x', zS, 0.5, cx - w / 2, cx + w / 2, y0, 1.0, 2.6, [[gx - 0.7, gx + 0.7]], R, tint); // face vers l'axe : la porte
    smRuin('x', zN, 0.5, cx - w / 2, cx + w / 2, y0, 1.4, 2.9, [], R, tint);
    smRuin('z', cx - w / 2, 0.5, Math.min(zS, zN) + 0.25, Math.max(zS, zN) - 0.25, y0, 1.2, 2.7, gz < 0 ? [[z0 - 0.7, z0 + 0.7]] : [], R, tint);
    smRuin('z', cx + w / 2, 0.5, Math.min(zS, zN) + 0.25, Math.max(zS, zN) - 0.25, y0, 1.2, 2.7, gz > 0 ? [[z0 - 0.7, z0 + 0.7]] : [], R, tint);
  }
  // puits au bord de l'eau, jarres
  for (const sz of [1, -1]) smWell(9.5, sz * 13.5);
  for (const [x, z] of [[-6.5, 13.8], [1.8, 5.2], [-21, 9.5]]) for (const sz of [1, -1]) smJar(x, sz * z, R.range(0.9, 1.15), R);
}
/* Terre crue des ruines, plus chaude que le pisé blanchi des villages */
const SM_MUD = [[0.92, 0.7, 0.52], [0.86, 0.64, 0.46], [0.95, 0.76, 0.58]];
/* Maisons ruinées de l'oasis (moitié Alpha) : [x, z, largeur (x), profondeur (z), x de la porte vers l'axe, côté de la porte latérale (-1, 0, 1)] */
const SM_RUINS = [[-18.5, 13.5, 6, 5, -17.5, 1], [19.5, 13.5, 5, 4.4, 18.5, -1]];

/* ---------- Les camps de fortune (A et C) ---------- */
function smCamp(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), acc = smAccent(sz);
  // cabanes de tôle, porte vers la cour (centres de case : la porte, de 1,2 m, est centrée sur une case)
  // une porte de derrière dans chacune : on traverse, pas de cul-de-sac
  smShack(-7.5, smFlat(-7.5, Z(34.5), 2.0, 1.7, Math.PI / 2, 1.2), Z(34.5), Math.PI / 2, 4.0, 3.4, 2.6, R, { win: 1, back: true });
  smShack(8.5, smFlat(8.5, Z(35.5), 2.2, 1.7, -Math.PI / 2, 1.2), Z(35.5), -Math.PI / 2, 4.4, 3.4, 2.7, R, { win: -1, back: true });
  smShack(-10.5, smFlat(-10.5, Z(25.5), 1.8, 1.6, 0, 1.2), Z(25.5), sz > 0 ? 0 : Math.PI, 3.6, 3.2, 2.5, R, { win: 1, back: true });
  // conteneur ouvert aux deux bouts : un passage couvert le long de x
  smPlace(PF.container(true), -4.5, Z(24.5), Math.PI / 2, { tint: { paint: sz > 0 ? [0.42, 0.5, 0.36] : [0.36, 0.44, 0.58] } });
  // tente de toile, mirador et son escalier (vers la base), citerne, groupe électrogène ; la tente à 1,5 m de l'escalier (on ne passe pas de
  // l'un à l'autre)
  smPlace(PF.tent(), 7.5, Z(24.5), 0);
  smTower(12.5, Z(30.5), R, -sz); // escalier vers la cour
  smPlace(PF.waterTank(), -12.5, Z(31.5), 0);
  smPlace(PF.generator(), -2.5, Z(38.5), sz > 0 ? 0 : Math.PI, { tint: { paint: [0.42, 0.46, 0.36] } });
  // bâche sur le nord de la cour, pick-up abandonné, sacs de sable
  smTarp(0.5, smFlat(0.5, Z(35.2), 2.7, 1.6, 0, 0.3), Z(35.2), 0, 5.4, 3.2, 2.6, 2.1, acc);
  // pick-up dans la cour, entre le point A et le mirador (au pied de la dune, le sable aplani sous lui y creusait une brèche : la base voyait le
  // point A ; en 4.6.0, il entrait dans la tente)
  smPlace(PF.car('offroad', { dust: 1 }), 7.5, Z(30.2), sz * 1.4, { tint: [0.72, 0.66, 0.56] });
  smSandbags(-0.5, Z(23.0), 3.6, 'x', 3, R); smSandbags(3.5, Z(31.2), 2.4, 'z', 3, R); smSandbags(-16.0, Z(29.5), 3.0, 'z', 3, R);
  smSandbags(-4.0, Z(30.5), 2.4, 'z', 3, R); smSandbags(1.5, Z(27.0), 2.4, 'x', 2, R);
  // fûts, bidons, caisses, pneus
  for (const [x, z] of [[-9.6, 30.2], [-9.0, 29.4], [3.3, 28.4], [-3.6, 33.6]]) M.dyn('barrel', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.36, 0.42, 0.3], [0.62, 0.2, 0.14], [0.3, 0.36, 0.48]]) });
  // (la caisse du nord au large du coin de la maison, en (-5, 39,6) : en (-5,2, 37,2), elle fermait le passage au coin, traversee.js)
  for (const [x, z] of [[3.2, 26.4], [-5.0, 39.6], [15.6, 33.8]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.4, 0.4), { a: [0.9] });
  for (const [x, z] of [[-0.9, 38.9], [6.4, 38.6], [-8.4, 28.2]]) M.dyn('jerrycan', x, Y(x, z, 0), Z(z), R() * TAU);
  for (const [x, z] of [[15.8, 25.4], [-14.2, 34.6]]) M.dyn('tire', x, Y(x, z, 0) + 0.02, Z(z), R() * TAU);
  smRugLine(4.6, Z(33.9), 5.8, Z(37.6), Y(5.2, 35.7, 0) + 1.9, R); // entre la bâche et la cabane de l'est
}

/* Mirador (smWatchtower) sur le sable aplani sous sa plate-forme et son escalier, qui part du côté dir */
function smTower(x, z, R, dir) { smWatchtower(x, smFlat(x + 0.3, z + dir * 3.1, 2.2, 4.8, 0, 0.3), z, R, dir); }

/* ---------- Petits camps des flancs : le poste de guet de l'ouest, la casse de l'est (couverts au milieu des dunes) ---------- */
function smOutposts(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), rot = (a) => (sz > 0 ? a : Math.PI - a);
  // le poste de guet : un mirador (escalier vers l'oasis), une cabane traversante, des sacs de sable, une bâche, des fûts
  smTower(-27.5, Z(29.5), R, -sz);
  smShack(-32.5, smFlat(-32.5, Z(28.5), 1.7, 1.5, -Math.PI / 2, 1.2), Z(28.5), -Math.PI / 2, 3.4, 3.0, 2.5, R, { win: 1, back: true });
  smSandbags(-22.5, Z(25.5), 3.0, 'z', 3, R); smSandbags(-23.0, Z(30.0), 2.4, 'z', 3, R); smSandbags(-30.0, Z(32.6), 3.0, 'x', 2, R);
  smTarp(-31.0, smFlat(-31.0, Z(23.5), 1.8, 1.3, rot(0.2), 0.3), Z(23.5), rot(0.2), 3.6, 2.6, 2.4, 2.0, smAccent(sz));
  for (const [x, z] of [[-34.8, 24.2], [-35.3, 24.9], [-24.5, 22.5]]) M.dyn('barrel', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.36, 0.42, 0.3], [0.62, 0.2, 0.14]]) });
  M.dyn('crate', -30.4, Y(-30.4, 23.6, 0), Z(23.6), R.range(-0.4, 0.4), { a: [0.9] });
  // la casse : carcasses de voitures et d'un camion, pneus, tôles, caisses
  smPlace(PF.truck('army', { wreck: 1 }), 28.0, Z(27.0), rot(0.35));
  // les épaves à plus d'un mètre l'une de l'autre et de l'acacia (smDress) : on passe entre elles
  smPlace(PF.car('sedan', { wreck: 1 }), 21.5, Z(23.3), rot(-1.1));
  smPlace(PF.car('offroad', { wreck: 1 }), 30.5, Z(20.8), rot(2.6));
  for (const [x, z] of [[24.6, 26.8], [25.4, 28.2], [31.2, 24.0], [21.6, 26.4]]) M.dyn('tire', x, Y(x, z, 0) + 0.02, Z(z), R() * TAU);
  for (const [x, z] of [[22.6, 20.0], [31.2, 27.4]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.4, 0.4), { a: [0.9] });
  M.dyn('barrel', 26.2, Y(26.2, 20.4, 0), Z(20.4), R() * TAU, { tint: [0.62, 0.2, 0.14] });
}

/* ---------- Le campement bédouin (à l'est, de chaque côté) ---------- */
function smNomads(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), rot = (a) => (sz > 0 ? a : Math.PI - a);
  // les deux tentes ouvertes sur le foyer, leurs haubans à l'écart du foyer, de la charrette et de la bâche
  smPlace(PF.smBedouin(7.5, 4.6, 1), 32.0, Z(47.1), rot(2.5));
  smPlace(PF.smBedouin(6, 4.2, 2), 40.5, Z(38.5), rot(-0.79));
  smPlace(PF.smFire(), 36.5, Z(43.5), 0);
  // enclos de pierre sèche (muret de 0,9 m) au nord, ouvert vers le foyer
  for (const [axis, f, a0, a1] of [['x', 49.5, 38, 44], ['z', 44.0, 46, 49.5]]) {
    const ff = axis === 'x' ? Z(f) : f, aa = axis === 'x' ? [a0, a1] : [Z(a0), Z(a1)].sort((p, q) => p - q);
    const yw = axis === 'x' ? smFlat((a0 + a1) / 2, Z(f), (a1 - a0) / 2, 0.25, 0, 0.3) : smFlat(f, Z((a0 + a1) / 2), 0.25, (a1 - a0) / 2, 0, 0.3);
    wallOpen('stone', axis, ff, 0.5, aa[0], aa[1], yw - 0.2, 1.1, [], { tint: [0.86, 0.72, 0.6], frames: false });
  }
  smPlace(PF.smCart(), 29.6, Z(40.4), rot(-2.36));
  M.place(PF.smAcacia(5.2, 3), 42.6, smY(42.6, Z(46.6), 0.4), Z(46.6), R() * TAU); // dans l'enclos, à l'écart du muret
  for (const [x, z] of [[34.8, 40.2], [35.4, 39.6], [38.8, 46.2]]) smJar(x, Z(z), R.range(0.9, 1.15), R);
  for (const [x, z] of [[33.6, 41.0], [39.5, 45.0]]) M.dyn('spiceSack', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.75, 0.62, 0.42], [0.62, 0.5, 0.36]]) });
  smTarp(33.0, smFlat(33.0, Z(38.0), 2.0, 1.3, sz > 0 ? 0.25 : -0.25, 0.3), Z(38.0), sz > 0 ? 0.25 : -0.25, 4.0, 2.6, 2.3, 1.9, [0.72, 0.58, 0.42]);
  smRugLine(38.4, Z(48.6), 41.6, Z(48.6), Y(40.0, 48.6, 0) + 1.8, R); // le long du muret de l'enclos (elle traversait la grande tente)
}

/* ---------- Les rochers de l'est ---------- */
function smRocks(R) {
  // le grand rocher, sur l'axe : dessus praticable à 8,2 m, une congère y monte de chaque côté
  smMassif({ rects: [[48, 61, -9, 9], [47, 48, -7, 7], [61, 62.5, -6, 6], [49, 51, 9, 10], [56.5, 59.5, 9, 10.5], [49, 51, -10, -9], [56.5, 59.5, -10.5, -9], [62.5, 63.5, -3, 3]], top: 9.0, walk: true, y0: 1.0, seed: 301, bulge: 1.12 });
  for (const [x, z, s, k] of [[59.5, 4.5, 1.4, 31], [59.5, -4.5, 1.4, 31], [50.5, 0, 1.1, 33]]) DECOR.place(PF.smRock(s, k), x, 8.95, z, 0);
  for (const sz of [1, -1]) {
    const Z = (z) => sz * z;
    // le rocher du campement : non praticable, un couvert haut
    const zz = (a, b) => [Math.min(Z(a), Z(b)), Math.max(Z(a), Z(b))];
    smMassif({ rects: [[41.5, 46.5, ...zz(24.5, 29.5)], [42, 46, ...zz(29.5, 30.5)], [40.5, 41.5, ...zz(25.5, 28.5)], [46.5, 47.5, ...zz(25, 28)], [43, 45.5, ...zz(23.5, 24.5)]], top: 6.5, walk: true, y0: 1.0, seed: 311 + (sz > 0 ? 0 : 1), bulge: 0.98 });
    // la gara : une table de grès au bord ouest de la sebkha, poste de tir des deux camps
    smMassif({ rects: [[-61, -53.5, ...zz(20, 26.5)], [-60, -54.5, ...zz(26.5, 28)], [-62, -61, ...zz(21.5, 25.5)], [-58.5, -55.5, ...zz(19.5, 20)]], top: 6.0, walk: true, y0: 1.0, seed: 321 + (sz > 0 ? 0 : 1), bulge: 0.98 });
    // (le rocher de (38,5, ±21,5) en 2 m : en 1,6 m, sur la pente, son dessus n'était qu'à 43 cm du sable côté amont, qu'on montait d'un pas,
    // et à 76 cm côté aval, où l'on restait coincé : accroches.js)
    for (const [x, z, s, k] of [[38.5, 21.5, 2.0, 1], [49.5, 19.5, 2.2, 2], [56.5, 25.5, 1.8, 3], [33.5, 9.5, 1.4, 4], [-33.5, 35.5, 1.5, 5], [-55.5, 41.5, 2.0, 6], [22.5, 60.5, 1.7, 7]]) DECOR.place(PF.smRock(s, k + (sz > 0 ? 0 : 20)), x, smY(x, Z(z), s * 0.5) - 0.15, Z(z), R() * TAU);
  }
}

/* ---------- Les bases : un convoi à l'arrêt ---------- */
function smBase(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), rot = (a) => (sz > 0 ? a : Math.PI - a);
  smPlace(PF.truck('army'), -9.5, Z(64.0), rot(0.25), { tint: [0.62, 0.56, 0.44] }); // à plus d'un mètre des haubans de la tente de l'ouest
  smPlace(PF.truck('cargo', { load: 'tarp' }), 11.0, Z(63.5), rot(-0.25), { tint: [0.62, 0.56, 0.44] });
  smPlace(PF.car('offroad', { dust: 1, rack: 1 }), 16.5, Z(53.5), rot(-0.9), { tint: [0.66, 0.6, 0.48] });
  smPlace(PF.tent(), -16.5, Z(57.5), Math.PI / 2);
  smPlace(PF.tent(), 0.5, Z(65.5), 0);
  smPlace(PF.antenna(), -4.5, Z(64.5), 0);
  smPlace(PF.generator(), 5.5, Z(65.5), rot(0.2), { tint: { paint: [0.42, 0.46, 0.36] } });
  smSandbags(-6.5, Z(51.0), 3.6, 'x', 3, R); smSandbags(7.0, Z(50.5), 3.6, 'x', 3, R); smSandbags(-15.5, Z(52.0), 3.0, 'z', 3, R); smSandbags(17.5, Z(59.5), 3.0, 'z', 3, R);
  for (const [x, z] of [[-13.4, 61.7], [-12.8, 62.4], [-13.7, 62.6], [15.8, 61.0], [16.4, 60.3]]) M.dyn('barrel', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.36, 0.42, 0.3], [0.32, 0.38, 0.28]]) });
  for (const [x, z] of [[-4.6, 60.4], [7.0, 61.8], [-18.6, 53.0]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.4, 0.4), { a: [1.0] });
  // la bâche le long du camion de l'ouest, côté cour (elle était tendue au travers du camion)
  smTarp(-6.0, smFlat(-6.0, Z(61.0), 2.2, 1.6, rot(0.25), 0.3), Z(61.0), rot(0.25), 4.4, 3.2, 2.7, 2.2, smAccent(sz));
  // le drapeau du camp, au vent
  const yf = Y(-1.5, 51.5, 0);
  M.save().color([0.4, 0.38, 0.34]); M.save().move(-1.5, yf, Z(51.5)); M.cyl('steel', 0.04, 5.2, 6); M.restore();
  M.color(smAccent(sz)); clothPiece(M, [-1.46, yf + 4.25, Z(51.5)], [-0.06, yf + 4.25, Z(51.5)], [-0.06, yf + 5.1, Z(51.5)], [-1.46, yf + 5.1, Z(51.5)], [0, 0, 1], { hoist: true, genre: 'drapeau', grp: 'drapeau' + sz }); M.restore(); // tenu par la hampe
}

/* ---------- Habillage : herbes sèches, acacias, arrière-plan ---------- */
function smDress(R) {
  const M = DECOR;
  // touffes d'herbe sèche et acacias isolés, hors des plates-formes et de l'eau
  for (let i = 0; i < 260; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * (SM_R + 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (smPondQ(x, z) < 1.15 || hyp((x - SM_PAN[0]) / SM_PAN[1], z / SM_PAN[2]) < 1 || SM_PADS.some((p) => hyp((x - p[0]) / (p[2] + 1), (Math.abs(z) - p[1]) / (p[3] + 1)) < 1)) continue;
    M.place(PF.cyGrass(R.range(0.5, 1.0)), x, smY(x, z) - 0.03, z, R() * TAU, { cls: 2, nocol: true });
  }
  for (const [x, z, h] of [[-20, 22, 4.4], [24, 21, 4.0], [-46, 50, 4.8], [55, 14, 3.8], [-61, 11, 4.2]]) for (const sz of [1, -1]) M.place(PF.smAcacia(h, Math.round(x + z) + (sz > 0 ? 0 : 9)), x, smY(x, sz * z, 0.3), sz * z, R() * TAU);
  // au loin, entre deux dunes : une autre oasis
  for (let i = 0; i < 26; i++) { const x = -250 + R.range(-30, 30), z = 205 + R.range(-18, 18); M.place(PF.smPalmFar(R.range(5, 12.5), 1 + (i % 12)), x, smH(x, z) - 0.3, z, R() * TAU, { nocol: true }); }
  // plaques de végétation sèche (hasard à part : le reste ne bouge pas) : herbes et buissons gris de romarin en touffes serrées, dans les creux
  // et au pied des rochers, hors des plates-formes, de l'eau et de la sebkha ; bas (moins de 0,9 m) et sans collision : le plan ne change pas
  const RV = rngOf(5160), off = (x, z) => smPondQ(x, z) < 1.2 || hyp((x - SM_PAN[0]) / SM_PAN[1], z / SM_PAN[2]) < 1.05 || SM_PADS.some((p) => hyp((x - p[0]) / (p[2] + 1.5), (Math.abs(z) - p[1]) / (p[3] + 1.5)) < 1);
  for (let c = 0; c < 90; c++) {
    const a = RV() * TAU, r = Math.sqrt(RV()) * (SM_R + 6), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    if (off(cx, cz)) continue;
    for (let k = 0, n = 3 + Math.floor(RV() * 6); k < n; k++) {
      const b = RV() * TAU, d = Math.sqrt(RV()) * 2.6, x = cx + Math.cos(b) * d, z = cz + Math.sin(b) * d; if (off(x, z)) continue;
      if (RV() < 0.28) M.place(PF.cyBush(Math.round(RV.range(0.55, 0.85) * 20) / 20, 1), x, smY(x, z) - 0.04, z, RV() * TAU, { cls: 2, nocol: true, tint: RV.pick([[0.9, 0.96, 0.6], [0.84, 0.86, 0.56], [0.96, 0.94, 0.62]]) }); // vert olive grisé (les fleurs du romarin viraient au lilas)
      else M.place(PF.cyGrass(Math.round(RV.range(0.45, 1.0) * 20) / 20), x, smY(x, z) - 0.03, z, RV() * TAU, { cls: 2, nocol: true, tint: RV.pick([[1, 0.94, 0.8], [0.94, 0.86, 0.7], [1.04, 0.98, 0.84]]) });
    }
  }
}

/* ---------- Plan ---------- */
function simounLevel() {
  const R = rngOf(5150);
  smGround();
  smOasis(rngOf(5151));
  SMP.plane = smPlane(-44, 2.0, rngOf(5152), 0.5); // axe du fuselage en z = 0,5 : l'allée de la cabine sur une rangée de centres de case
  smRocks(rngOf(5153));
  for (const sz of [1, -1]) { smCamp(sz, rngOf(sz > 0 ? 5161 : 5162)); smNomads(sz, rngOf(sz > 0 ? 5171 : 5172)); smBase(sz, rngOf(sz > 0 ? 5181 : 5182)); smOutposts(sz, rngOf(sz > 0 ? 5191 : 5192)); }
  smDress(R);
  // la vie : deux tourbillons de poussière (la Mer de dunes, les Rochers), quatre vautours
  SMP.devilTex = smDevilTex(); SMP.veilTex = smVeilTex();
  SMP.life = [
    smDustDevil({ cx: -44, cz: 0, rx: 6, rz: 22, T: 70, ph: 0 }, SMP.devilTex), smDustDevil({ cx: 44, cz: 0, rx: 8, rz: 26, T: 85, ph: 0.45 }, SMP.devilTex),
    smVulture({ cx: -20, cz: 10, r: 38, y: 46, w: 0.09, a0: 0 }), smVulture({ cx: -24, cz: 6, r: 30, y: 52, w: 0.08, a0: 2.1 }),
    smVulture({ cx: 30, cz: -20, r: 34, y: 44, w: -0.1, a0: 1 }), smVulture({ cx: 10, cz: 30, r: 50, y: 58, w: 0.07, a0: 4 }),
  ];
  { const v = smSandVeils(rngOf(5199), SMP.veilTex); if (v) SMP.life.push(v); } // voiles de sable sur les crêtes
  // le sable en dernier : le maillage lit la grille, aplanie sous les objets posés (reliefFlat)
  // teinte du sable par sommet : crêtes pâlies par le soleil, creux plus rouges, grandes plaques plus ou moins dorées
  reliefMesh(SM_R + 12, 760, { tint: [1, 0.97, 0.94], tintAt: (x, z, h) => {
    const n = smNz(x, z, 22, 3), k = 0.9 + n * 0.2, up = smoothstep(2.6, 8, h) * 0.08, low = smoothstep(2.0, 0.8, h);
    return [sl(clamp(k + up, 0, 1.2)), sl(clamp((k + up) * (1 - low * 0.06) * (0.98 + n * 0.04), 0, 1.2)), sl(clamp((k + up) * (1 - low * 0.12) * (0.95 + n * 0.08), 0, 1.2))];
  } });
}

/* ---------- Le sol : répartition des couches ---------- */
/* Rouge : galets (pied des rochers, creux entre les dunes) ; vert : vase craquelée (berges de l'oasis) ; bleu : reg, graviers et sable damé (camps,
   bases, pistes) ; alpha : poussière */
const GROUND_SIMOUN = { base: 'dune', l1: 'galets', l2: 'vase', l3: 'reg', pom: [0, 0.03, 0, 0], dirt: [0.86, 0.72, 0.58], mul: 0.6, env: 0.3 };
function smGround() {
  const S = SPLAT, W = Math.round(S.w * S.ppm), H = Math.round(S.d * S.ppm), out = new Uint8Array(W * H * 4), N = makeNoise(5501);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4, az = Math.abs(z);
    const n1 = smN(N, x, z, 4, 3), n2 = smN(N, x, z, 1.2, 2, 0.3), n3 = smN(N, x, z, 9, 3, 0.7);
    let r = 0, g = 0, b = 0;
    // galets : au pied des rochers de l'est et dans les creux (sous la hauteur moyenne)
    const foot = (cx, cz, rx, rz) => 1 - smoothstep(0.9, 1.35, hyp((x - cx) / rx, (az - cz) / rz) + (n1 - 0.5) * 0.4);
    r = Math.max(foot(54, 0, 9.5, 11.5), foot(44, 27.5, 4.5, 4.5)) * (1 - smoothstep(4.5, 6.5, smH(x, z))) * smoothstep(0.35, 0.6, n1) * 0.85;
    r = Math.max(r, smoothstep(0.66, 0.8, n3 + (n1 - 0.5) * 0.4) * 0.3 * smoothstep(40, 70, hyp(x, z)));
    // vase : les berges et le fond du bassin, la sebkha (argile craquelée)
    g = (1 - smoothstep(1.0, 1.4, smPondQ(x, z) + (n2 - 0.5) * 0.3)) * 0.95;
    g = Math.max(g, (1 - smoothstep(0.8, 1.15, hyp((x - SM_PAN[0]) / SM_PAN[1], z / SM_PAN[2]) + (n1 - 0.5) * 0.3)) * smoothstep(SM_PAN[4] + 0.6, SM_PAN[4] + 0.25, smH(x, z)) * 0.9); // pas sur les congères
    // terre battue : camps, bases, campement, pistes entre eux
    for (const p of SM_PADS) { const d = hyp((x - p[0]) / (p[2] + 2), (az - p[1]) / (p[3] + 2)); b = Math.max(b, (1 - smoothstep(0.55, 1.05, d + (n1 - 0.5) * 0.35)) * 0.8); }
    g *= smoothstep(0.85, 1.05, hyp(x, z) / SM_OASIS.plaza + (n2 - 0.5) * 0.2); // l'île : du sable
    let path = 0;
    for (const [ax, az0, bx, bz0] of [[0, 51, 0, 38], [0, 21, 0, 7], [12, 54, 31, 45]]) { const dx = bx - ax, dz = bz0 - az0, L2 = dx * dx + dz * dz, t = clamp(((x - ax) * dx + (az - az0) * dz) / L2, 0, 1), d = hyp(x - ax - dx * t, az - az0 - dz * t); path = Math.max(path, (1 - smoothstep(0.8, 2.2, d + (n2 - 0.5) * 1.2)) * 0.6); }
    b = Math.max(b, path);
    r *= 1 - b * 0.8; g *= 1 - b * 0.5;
    r = Math.max(r, path * smoothstep(0.35, 0.65, n1) * 0.75); // des galets par plaques sur les pistes (le reg seul les lissait)
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(0.1 + n2 * 0.3 + b * 0.2, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_SIMOUN);
}

/* ---------- Ambiance : fin d'après-midi dorée, soleil bas à l'ouest, les dunes en relief ---------- */
// (refonte d'octobre 2026, d'après les références du propriétaire : couleurs moins saturées, ombres plus profondes, contre-jour sans voile laiteux)
const ATMO_SIMOUN = Object.assign({}, ATMO_DEFAULT, {
  sun: [-0.78, 0.36, 0.18], sunColor: 0xffc58e, sunI: 3.1, vmSun: 0xffc896,
  fog: [0.78, 0.69, 0.6], fogD: 0.0026, fogSun: 0.12,
  hemi: [0xbccbe2, 0x8a5c3c, 0.46], vmHemi: [0xb8cbe8, 0x7a5236],
  bounce: [1.5, 1.08, 0.74], dust: [0.88, 0.7, 0.5], motes: [1.35, 1.0, 0.7],
  // moins saturé et plus contrasté, hautes lumières moins jaunes ; halo déclenché plus haut et plus léger, rayons du soleil plafonnés : le ciel
  // photographié, très lumineux autour du soleil, nourrissait le halo sans limite (un voile laiteux sur toute l'image à contre-jour)
  grade: { lo: [0.94, 0.98, 1.06], hi: [1.04, 1.0, 0.93], exp: 0.95, sat: 0.8, con: 1.11 }, rays: [1.0, 0.7, 0.42], raysThr: 2.2, raysCap: 3,
  bloom: [0.25, 0.5, 1.4],
  impact: [0.62, 0.46, 0.32], wind: [420, 0.07],
});
/* Tempête de sable (retour du propriétaire, chantier des ambiances, octobre 2026) : le grand soleil, puis toutes les 4 minutes une tempête
   orangée qui passe sur la carte (25 s pour monter, 50 s au plus fort, 25 s pour se dissiper). Le moment se tire du temps de partie, celui de
   l'hôte en ligne (MATCH.timeLeft) : tout le monde la voit en même temps. Rien ne se recompile, on mélange à chaque image l'ambiance claire
   (ATMO_SIMOUN) et celle de la tempête (SM_STORM) dans les mêmes uniformes qu'applyAtmosphere : brouillard, soleil et ombres, lumière
   d'ambiance et renvoyée, ciel (la photo s'efface devant le ciel calculé, uSkyP.z), étalonnage, grains en suspension, vent qu'on voit et
   qu'on entend. Au plus fort, on voit à 60 m environ ; les bots aussi (botSense tient compte du brouillard). */
const SM_STORM = {
  fog: [0.8, 0.56, 0.34], fogD: 0.012, fogSun: 1.0, sunI: 0.8, sunColor: 0xffc895, vmSun: 0xffc895,
  hemi: [0xe0b080, 0xa06a40, 0.8], vmHemi: [0xe0b080, 0xa06a40], bounce: [1.0, 0.8, 0.55],
  sky: { zen: [0.55, 0.4, 0.26], mid: [0.7, 0.5, 0.32], hor: [0.82, 0.58, 0.36], gnd: [0.5, 0.38, 0.26], glow: [1.0, 0.8, 0.55], halo: [1.0, 0.85, 0.6], disk: [8, 6, 4] },
  grade: { lo: [1.02, 0.96, 0.92], hi: [1.12, 0.98, 0.8], exp: 1.0, sat: 0.85, con: 1.06 },
  rays: [1.0, 0.8, 0.5], motes: [1.6, 1.2, 0.8], wind: [900, 0.12], vent: 1.8,
  period: 240, rise: [100, 125], fall: [175, 200], // cycle et fenêtres (s) : la première tempête arrive 1 min 40 après le départ
};
const SMS = { s: -1, force: null, c: new THREE.Color(), d: new THREE.Color(), vent: null }; // niveau appliqué ; force : niveau imposé (outils)
/* Niveau de la tempête (0 : grand soleil, 1 : au plus fort) au temps de partie écoulé ; hors partie, l'horloge t */
function smStormLevel(t) {
  if (SMS.force !== null) return SMS.force;
  const total = (MATCH.online ? NET.cfg.time : Settings.minutes) * 60, P = SM_STORM.period;
  const e = MATCH.state === 'playing' || MATCH.state === 'killcam' || MATCH.state === 'finish' ? Math.max(0, total - MATCH.timeLeft) : t;
  const p = e % P;
  return smoothstep(SM_STORM.rise[0], SM_STORM.rise[1], p) * (1 - smoothstep(SM_STORM.fall[0], SM_STORM.fall[1], p));
}
function smStorm(t) {
  if (!sky.visible) return; // vue aérienne d'une série (08b-killstreaks.js) : elle règle le brouillard elle-même
  const s = smStormLevel(t);
  if (Math.abs(s - SMS.s) < 0.002) return;
  SMS.s = s;
  const A = ATMO_SIMOUN, B = SM_STORM, L = (a, b) => a + (b - a) * s, LA = (a, b) => a.map((v, i) => v + (b[i] - v) * s);
  const hx = (a, b) => SMS.c.setHex(a).lerp(SMS.d.setHex(b), s);
  scene.fog.color.setRGB(...LA(A.fog, B.fog)); scene.fog.density = L(A.fogD, B.fogD) * (A.fogH && A.fogH[0] > 0 ? 1.3 : 1);
  hemi.color.copy(hx(A.hemi[0], B.hemi[0])); hemi.groundColor.copy(hx(A.hemi[1], B.hemi[1])); hemi.intensity = L(A.hemi[2], B.hemi[2]);
  vmHemi.color.copy(hx(A.vmHemi[0], B.vmHemi[0])); vmHemi.groundColor.copy(hx(A.vmHemi[1], B.vmHemi[1])); vmSun.color.copy(hx(A.vmSun, B.vmSun));
  const U = SkyShader.uniforms;
  for (const [k, u] of [['zen', 'uZen'], ['mid', 'uMid'], ['hor', 'uHor'], ['gnd', 'uGnd'], ['glow', 'uGlow'], ['halo', 'uHalo'], ['disk', 'uDisk']]) U[u].value.set(...LA(A.sky[k], B.sky[k]));
  U.uSkyP.value.z = s;
  const F = FinalShader.uniforms, G = Object.assign({}, GRADE_DEF, A.grade), H = Object.assign({}, GRADE_DEF, B.grade);
  F.uGradeLo.value.set(...LA(G.lo, H.lo)); F.uGradeHi.value.set(...LA(G.hi, H.hi)); F.uRayTint.value.set(...LA(A.rays, B.rays));
  F.uExposure.value = L(G.exp, H.exp) * G.gain; F.uSat.value = L(G.sat, H.sat); F.uCon.value = L(G.con, H.con);
  const sc = hx(A.sunColor, B.sunColor);
  FOG_U.fogSun.value[3] = L(A.fogSun, B.fogSun); FOG_U.fogSunCol.value.set([sc.r, sc.g, sc.b]);
  if (csm) for (const l of csm.lights) { l.color.copy(sc); l.intensity = L(A.sunI, B.sunI); }
  WMU.uBounce.value.setRGB(...LA(A.bounce, B.bounce));
  if (FX && FX.dust) FX.dust.material.uniforms.uColor.value.setRGB(...LA(A.motes, B.motes));
  if (SMS.vent === null) SMS.vent = WIND_U.uWnD.value.z; // force du vent de la carte sans tempête (windInit, au chargement)
  WIND_U.uWnD.value.z = SMS.vent * L(1, B.vent);
  if (AU.ambience && AU.windG) { // le vent qu'on entend : plus grave et plus fort, par-dessus l'ambiance enregistrée au plus fort
    AU.windF.frequency.value = L(A.wind[0], B.wind[0]); AU.windG.gain.value = L(A.wind[1], B.wind[1]);
    if (AMB.bed && AU.windOut) AU.windOut.gain.value = s;
  }
}
/* Points d'intérêt de la moitié Alpha : [x, z, route, à tenir, hauteur au-dessus du relief (ou absolue si abs)] ; la moitié Bravo en miroir,
   un point sur l'axe une seule fois */
function smPoi(list) {
  const out = [];
  for (const [x, z, lane, hold, dy, abs] of list) for (const s of z === 0 ? [1] : [1, -1]) out.push([x, abs ? dy : smH(x, s * z) + (dy || 0), s * z, lane, hold ? 1 : 0].slice(0, hold ? 5 : 4));
  return out;
}
const SM_SPAWNS = [[-12.5, 53.5], [-8.5, 54.5], [-4.5, 53.5], [-0.5, 54.5], [3.5, 53.5], [7.5, 54.5], [11.5, 53.5], [-11.5, 57.5], [-6.5, 57.5], [-2.5, 58.5], [1.5, 57.5], [5.5, 58.5], [9.5, 57.5], [13.5, 56.5], [-1.5, 61.5]];

MAP_DEFS.simoun = {
  type: 'open', // grande et ouverte (la Mer de dunes des tireurs d'élite, l'oasis et les camps à couvert) : README « Règles de conception d'une carte »
  bounds: { x0: -82, x1: 82, z0: -82, z1: 82 },
  near: { x: 84, z: 84 }, // tronçons du décor dans toute la zone de jeu (au-delà : l'arrière-plan)
  relief: { fn: smH, pad: 6 }, // sol en dunes (02-relief.js)
  ring: { r: SM_R, hard: SM_R + 10, t: 10 }, // zone ronde : 10 s pour revenir, pas plus loin que 80 m
  light: { d: 0.75 }, // éclairage cuit en cellules de 0,75 m (la carte est grande)
  textures: ['stone', 'wood', 'sand', 'dirt', 'pise', 'adobe', 'galets', 'vase', 'strata', 'reg', 'canvas', 'laine', 'steel', 'burlap', 'timber', 'palmbark'], // strata : la falaise stratifiée (photo) des massifs de grès ; reg : le sol des camps
  texRelief: ['strata'], // relief par parallaxe des bancs de la falaise
  surfaces: SIMOUN_SURFACES,
  kit: () => simounKit(),
  materials: (M) => makeSimounMaterials(M),
  // ambiance enregistrée (05c-ambiance.js) : celle de Khamsin, vent chaud et sec ; tourterelles à l'oasis, toiles qui claquent
  sound: { pack: 'amb_sable', bed: 0.5, fountain: 0.2, spots: [
    { id: 'a_gust', every: [7, 18], gain: 0.5, dist: [4, 12], y: [2, 7] },
    { id: 'a_dove', every: [16, 36], gain: 0.28, dist: [15, 40], y: [5, 10] },
    { id: 'a_cloth', every: [10, 26], gain: 0.28, dist: [6, 20], y: [2, 5] },
  ] },
  art: { cam: [-48, 21.5, 46], look: [2, 3.25, -2], fov: 52 }, // au-dessus des dunes de l'ouest : l'épave, le poste de guet, l'oasis, les camps
  landmarks: [[0, 11, 0, 'oasis'], [-62, 10, 0.5, 'avion'], [54, 10, 0, 'rocher']],
  splat: { x0: -100, z0: -100, w: 200, d: 200, ppm: 2 },
  far: 760,
  build() { simounLevel(); },
  update(t) { smStorm(t); smLife(SMP.life || [], t); },
  unload() { SMS.s = -1; SMS.vent = null; SMP.life = null; SMP.plane = null; for (const k of ['devilTex', 'veilTex']) if (SMP[k]) { SMP[k].dispose(); SMP[k] = null; } },
  spawns: SM_SPAWNS,
  poi: smPoi([
    [-50, 45, 'L', 1], [-60, 14, 'L', 1], [-35, 8, 'L'], [-50, 6, 'L'], [-30, 40, 'L'], [-27.5, 29.5, 'L', 1, 5.3, true],
    [0.5, 32.5, 'M', 1], [-8, 37, 'M'], [9, 27, 'M'], [0, 15, 'M'], [-18.5, 13.5, 'M', 1], [0, 45, 'M'], [12.5, 30.5, 'M', 1, 5.3, true],
    [36.5, 43.5, 'E', 1], [44, 21, 'E'], [53.5, 4.5, 'E', 1, 9.0, true], [38, 10, 'E'], [26, 36, 'E'],
  ]).concat([[-46.5, 4.95, 0.5, 'L', 1], [-37.5, 2.25, 0.5, 'L'], [-46.5, 2.25, 0.5, 'L']]), // l'avion : le toit, les deux cabines
  dom: [[37.5, 40.5], [0, 0], [-26, -42]], // placés par le propriétaire avec l'outil des zones (?outil=zones, octobre 2026)
  mecha: [[-34.5, -12.5], [-20, 37.5], [35, -26], [54, 0.5]], // zones de largage du mecha (08f-mecha.js, mnavZones), placées de même
  lane: (x) => (x < -24 ? 'L' : x > 24 ? 'E' : 'M'),
  sniper: [-57.5, 6.0, 23.5], // la gara de son camp, au bord de la sebkha
  coverZ: 52,
  heli: [50, 50],
  cam: 70,
  surface: () => 'dirt', // bruit des pas : le sable
  zones: [
    [_t('Base Alpha'), -70, 70, 48, 82], [_t('Base Bravo'), -70, 70, -82, -48],
    [_t('Oasis'), -26, 26, -16, 16],
    [_t('Camp nord'), -20, 20, 19, 46], [_t('Camp sud'), -20, 20, -46, -19],
    [_t('Épave'), -60, -28, -24, 24], [_t('Mer de dunes'), -82, -24, -48, 48],
    [_t('Campement'), 26, 50, 34, 52], [_t('Campement'), 26, 50, -52, -34],
    [_t('Rochers'), 24, 82, -46, 46],
  ],
  skyPhoto: { key: 'quarry_01', rot: 0.637, gain: 1.55 }, // ciel de Khamsin, tourné sur le soleil de Simoun
  atmo: ATMO_SIMOUN,
};
