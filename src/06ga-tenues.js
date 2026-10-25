/* ==========================================================================
   TENUES (skins) : quatre tenues de soldat, d'après les illustrations du propriétaire. Le joueur choisit la sienne, quelle
   que soit l'arme de sa classe (Settings.skin, menu Tenues et pause) ; un bot porte celle de la famille de son arme
   (fusil d'assaut et pistolet : Assaut ; pistolet-mitrailleur : Commando ; précision : Ghillie ; pompe : Brèche).
   - Assaut : camouflage anguleux sable et olive, gilet coyote, casque camouflé, demi-masque gris, verres ambrés, antenne.
   - Commando : camouflage nuit bleu marine, gilet noir à poches olive, cagoule, jumelles de vision nocturne relevées.
   - Ghillie : tenue de lanières feuillues vert et brun par-dessus une toile feuillue, capuche, voile de visage.
   - Brèche : camouflage désert, poncho à capuche rabattue, cartouches rouges sur la poitrine, masque sable.
   Même squelette, mêmes animations, mêmes zones de touche : seule la géométrie de la tenue change (une par tenue et par
   niveau de détail, partagée par tous les soldats qui la portent).

   Reconnaître un allié d'un ennemi, quelles que soient les couleurs de la tenue (la tenue ne dit plus le camp) :
   - chaque tenue existe en clair et en sombre, même modélisation : le joueur voit toujours ses alliés en clair et ses
     ennemis en sombre (relation au joueur, pas équipe Alpha ou Bravo : la règle ne s'inverse jamais, même en jouant
     Bravo en ligne ; en match à mort, tout le monde est un ennemi). Le contraste de valeur se lit de loin et ne dépend
     pas de la vision des couleurs. Une seule texture par tenue : la teinte claire ou sombre est la couleur de la matière.
   - des bandes de reconnaissance (brassards sur les deux bras, bande autour du casque ou de la capuche) aux couleurs de
     l'interface : vert pour un allié, rouge pour un ennemi (tuile « tag » de l'atlas, skinTagPatch dans 06e-gear.js).
   - le chevron vert au-dessus des alliés reste (09m-marqueurs.js).
   ========================================================================== */
const SKIN_IDS = ['assault', 'smg', 'sniper', 'shotgun'];
/* camo : palette du camouflage (couleurs sRGB, voir drawCamo) ; gear : couleurs sRGB de l'équipement (converties en linéaire
   par skinGear) ; parts : pièces propres ; tone : couleur de la matière vue par un allié [0] et par un ennemi [1] ;
   seed : tirage du motif ; sym : symbole de l'écusson d'épaule ; cloth : modèle de tissu simulé (06gb-tissu.js) ; les tenues de
   défi (06gc-tenues-defi.js) ont en plus model (leurs pièces), art (emblème), neon (intensité des néons) et lock (défis) */
const SKINS = {
  assault: {
    name: _t('Assaut'), role: _t('Ligne de front, polyvalent'), seed: 417, sym: 'L',
    camo: { style: 'poly', base: '#8a8462', soft: ['#9a9070', '#7a7652', '#86805c'], mid: ['#a8987a', '#5f5e4c', '#45453b'], n: [55, 45, 32], branch: ['#34342c'], hi: '#c4b89c' },
    gear: { vest: '#9a8865', pouch: '#a08d6a', helm: '#e6e2d8', glove: '#4f4f46', boot: '#8f7c5c', sole: '#3a3632', belt: '#76734f', poly: '#3a3a36', cup: '#4f4f46', knee: '#76734f', knit: '#5a5a52', mask: '#8a8b88', lens: '#b0601a', patch: '#3a3a36', symc: '#d8d3c8' },
    parts: { helmet: 'camo', mask: 'poly', antenna: true, pouches: 'ar', pack: true },
    tone: [[1.08, 1.07, 1.03], [0.46, 0.46, 0.49]],
  },
  smg: {
    name: _t('Commando'), role: _t('Courte portée, agressif'), seed: 911, sym: 'X',
    camo: { style: 'poly', base: '#4a4f58', soft: ['#555a63', '#40444b', '#4b525e'], mid: ['#5f6878', '#33363c', '#6e7480'], n: [50, 45, 22], branch: ['#24272b'], hi: '#a3a7ad' },
    gear: { vest: '#33363c', pouch: '#6f6e5c', helm: '#3c4148', glove: '#2c2e33', boot: '#3a3b3e', sole: '#1d1d1d', belt: '#40444b', poly: '#2a2c31', cup: '#3a3d44', knee: '#4a4f58', knit: '#3c3f45', lens: '#0c0e10', patch: '#2a2c31', symc: '#c3c7cc' },
    parts: { helmet: 'paint', nvg: true, pouches: 'smg', pack: true },
    tone: [[1.32, 1.31, 1.27], [0.6, 0.6, 0.64]],
  },
  sniper: {
    name: _t('Ghillie'), role: _t('Longue portée, précision'), seed: 263, sym: 'L',
    camo: { style: 'leaf', base: '#545641', soft: ['#5e6143', '#4a4c3b'], mid: ['#717550', '#857c5c', '#5d6842'], n: [260, 220, 200, 160, 110], branch: ['#3a3b33', '#958d68'], hi: '#bdb08e' },
    gear: { vest: '#3f403a', pouch: '#525348', glove: '#3a3b35', boot: '#5e5440', sole: '#2a2724', belt: '#525348', poly: '#34352d', cup: '#3a3b35', knee: '#525348', knit: '#33342e', mask: '#3a3b33', lens: '#0c0e10', patch: '#34352d', symc: '#c4b898',
      leaves: ['#5f6b38', '#717d40', '#7d7552', '#4f5a33', '#8c8660', '#686038', '#9a9468'] },
    parts: { hood: true, ghillie: true, mask: 'fab', glasses: false, pouches: 'sn' },
    tone: [[1.12, 1.14, 1.06], [0.5, 0.5, 0.5]],
  },
  shotgun: {
    name: _t('Brèche'), role: _t('Ouverture, combat rapproché'), seed: 577, sym: 'L',
    camo: { style: 'poly', base: '#7f6c50', soft: ['#8b7859', '#73624a', '#958264'], mid: ['#62533f', '#a6957a', '#54483a'], n: [45, 40, 35], branch: ['#403c35'], hi: '#bba98a' },
    gear: { vest: '#4a463e', pouch: '#7a6852', helm: '#e6e2d8', glove: '#4a463e', boot: '#7a6852', sole: '#2e2b27', belt: '#5a564d', poly: '#35322d', cup: '#5a564d', knee: '#7a6852', knit: '#5a564d', mask: '#b09c7c', lens: '#0c0e10', patch: '#4a463e', symc: '#d4c4a4', shell: '#a8261c', brass: '#c09a48' },
    parts: { helmet: 'camo', mask: 'fab', poncho: true, pouches: 'shells', cape: true }, cloth: () => ponchoClothTemplate(),
    tone: [[0.98, 0.97, 0.93], [0.46, 0.44, 0.43]],
  },
};
/* Couleurs (sRGB) des bandes de reconnaissance : celles de l'interface (--ally, --enemy dans shell.html) */
const SKIN_REL = [0x8fd16a, 0xe4473b];
/* Tenue des bots selon la famille de leur arme */
const SKIN_OF_CAT = { ar: 'assault', pistol: 'assault', smg: 'smg', sniper: 'sniper', shotgun: 'shotgun' };
const skinId = (v) => (hasKey(SKINS, v) ? v : 'assault'); // v peut venir du réseau (hasKey)
const skinOfWeapon = (def) => SKIN_OF_CAT[def && def.cat] || 'assault';
/* Tenue d'un soldat : la sienne (choisie, ou celle de son arme pour un bot) */
const skinOf = (e) => (e === PL.ent ? skinMine() : skinId(e.skin)); // (skinMine : une tenue de défi pas encore débloquée ne se porte pas, 06s-defis.js)
/* Relation au joueur : 0 allié (le joueur lui-même compris), 1 ennemi ; en match à mort, tout autre soldat est un ennemi */
const skinRel = (e) => (e === PL.ent || (PL.ent && allied(PL.ent, e)) ? 0 : 1);
/* Couleurs de l'équipement d'une tenue, converties en linéaire (couleurs de sommets) */
const SKIN_GEAR = {};
function skinGear(skin) {
  if (SKIN_GEAR[skin]) return SKIN_GEAR[skin];
  const G = SKINS[skin].gear, out = {};
  for (const k in G) out[k] = Array.isArray(G[k]) ? G[k].map((h) => new THREE.Color(h).convertSRGBToLinear()) : new THREE.Color(G[k]).convertSRGBToLinear();
  return (SKIN_GEAR[skin] = out);
}
/* Couleur de la matière d'une tenue selon la relation au joueur (clair : allié, sombre : ennemi) */
function skinTone(skin, rel, out) { const t = SKINS[skin].tone[rel ? 1 : 0]; return out.setRGB(t[0], t[1], t[2]); }
/* Couleur (linéaire) des bandes de reconnaissance */
const skinRelColor = (rel, out) => out.setHex(SKIN_REL[rel ? 1 : 0]).convertSRGBToLinear().multiplyScalar(0.8); // un peu moins vif que l'interface : une bande de tissu, pas une lampe
/* Tenue et relation de tous les soldats : début de partie (équipe du joueur connue), changement d'équipe d'un joueur en ligne,
   nouvelle tenue du joueur ; ne change que ce qui doit changer (soldierLook) */
function soldierLookAll() {
  for (const e of entities) if (e.model && !e.isPlayer) soldierLook(e.model, skinOf(e), skinRel(e));
  if (PL.ent && PL.ent.model) soldierLook(PL.ent.model, skinOf(PL.ent), 0);
  if (KC.body) soldierLook(KC.body, skinOf(PL.ent), 0);
}

/* ---------- Pièces propres aux tenues (construites dans le repère de repos, voir soldierGeometry) ---------- */
/* Demi-masque (assaut : polymère gris ; brèche et ghillie : tissu) sur le bas du visage, du nez au menton */
function skinMask(B, skin, hi) {
  const R = soldierRest(), hm = R.mats[SB.HEA], G = skinGear(skin), cloth = SKINS[skin].parts.mask === 'fab', v = new V3();
  const tile = GEAR_TILE[cloth ? 'fab' : 'poly'], MC = G.mask;
  skinSurf(B, hi ? 18 : 7, hi ? 6 : 2, (u, vv, o) => {
    const ph = (u - 0.5) * (cloth ? 3.4 : 2.7), th = lerp(1.62, cloth ? 2.75 : 2.55, vv);
    headPt(th, ph, v, (cloth ? 0.006 : 0.011) + (cloth ? 0 : 0.006 * Math.cos(ph) * Math.sin(vv * Math.PI))).applyMatrix4(hm);
    o.x = v.x; o.y = v.y; o.z = v.z; o.w = vv > 0.85 ? [[SB.HEA, 0.85], [SB.NEC, 0.15]] : SB.HEA;
    // évents du masque de polymère : deux rangées plus sombres de part et d'autre de la bouche
    o.col = !cloth && hi && Math.abs(Math.abs(ph) - 0.42) < 0.12 && vv > 0.35 && vv < 0.7 ? MC.clone().multiplyScalar(0.45) : MC;
    o.U = tile[0]; o.V = tile[1];
  }, { out: true });
}
/* Jumelles de vision nocturne relevées sur le support avant du casque (commando) */
function skinNvg(B, skin, hi) {
  const R = soldierRest(), hm = R.mats[SB.HEA], G = skinGear(skin), H = SB.HEA, D = G.poly, N = G.helm.clone().multiplyScalar(0.7), L = new THREE.Color(0.05, 0.09, 0.06);
  // support sur la coque (devant, en haut : sa normale y est (0 ; 0,58 ; -0,81)), boîtier contre le front du casque et deux tubes
  // relevés, objectifs vers l'avant et un peu vers le haut (axe (0 ; 0,32 ; -0,95))
  gBox(B, 0.028, 0.04, 0.018, 0.005, hm.clone().multiply(gMat(0, 0.118, -0.078, -0.62)), H, D, 'poly');
  gBox(B, 0.07, 0.032, 0.038, 0.008, hm.clone().multiply(gMat(0, 0.108, -0.106, -0.62)), H, N, 'poly');
  for (const s of [-1, 1]) {
    gCyl(B, 0.0165, 0.0175, 0.066, hi ? 12 : 6, hm.clone().multiply(gMat(s * 0.03, 0.112, -0.128, -1.25)), H, N, 'poly');
    if (hi) gCyl(B, 0.0135, 0.0135, 0.004, 10, hm.clone().multiply(gMat(s * 0.03, 0.123, -0.16, -1.25)), H, L, 'lens');
  }
  if (hi) gBox(B, 0.034, 0.024, 0.024, 0.006, hm.clone().multiply(gMat(0, 0.062, 0.138, 0.28)), H, D, 'poly'); // contrepoids (batterie) à l'arrière
}
/* Capuche de la tenue ghillie : du sommet du crâne au col, ouverte devant le visage, puis drapée sur les épaules.
   Anneaux { y, centre z, demi-largeur, avant, arrière, ouverture (demi-angle devant, rad) } dans le repère de repos ; une tenue peut
   avoir les siens (parts.hood.rings, mêmes anneaux du haut : la bande de reconnaissance s'y pose, hoodPt) un envers (parts.hood.inner) et un bas sans plis (parts.hood.tuck). */
const HOOD_RINGS = [[1.795, -0.02, 0.012, 0.012, 0.012, 0], [1.782, -0.02, 0.07, 0.074, 0.08, 0], [1.75, -0.02, 0.108, 0.113, 0.123, 0], [1.705, -0.02, 0.122, 0.125, 0.136, 0.32],
  [1.655, -0.022, 0.126, 0.124, 0.142, 0.78], [1.6, -0.022, 0.122, 0.118, 0.138, 0.82], [1.545, -0.018, 0.118, 0.11, 0.128, 0.7], [1.49, -0.008, 0.15, 0.124, 0.13, 0.42],
  [1.44, 0.0, 0.215, 0.15, 0.142, 0.26], [1.375, 0.004, 0.245, 0.16, 0.152, 0.2]];
/* Point de la capuche (forme de repos, sans les plis) à la hauteur y et à l'angle a (0 : devant) */
function hoodPt(y, a, o) {
  let k = 0; while (k < HOOD_RINGS.length - 2 && HOOD_RINGS[k + 1][0] > y) k++;
  const A = HOOD_RINGS[k], Bq = HOOD_RINGS[k + 1], t = clamp((A[0] - y) / (A[0] - Bq[0]), 0, 1), r = (i) => lerp(A[i], Bq[i], t), c = Math.cos(a), s = Math.sin(a), e = 2 / 2.3;
  return o.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r(2), y, r(1) - Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r(3) : r(4)));
}
function skinHood(B, skin, hi) {
  const hp = SKINS[skin].parts.hood, HOOD = hp.rings || HOOD_RINGS, tq = new V3(), nk = HOOD.length;
  // anneaux du haut : la tête ; ceux du bas : le corps (épaules, thorax), avec un passage par le cou
  const hoodW = (p) => { const t = smoothstep(1.47, 1.56, p.y); if (t >= 1) return SB.HEA; const w = torsoW(p).map((e) => [e[0], e[1] * (1 - t)]); if (t > 0) w.push([SB.HEA, t * 0.7], [SB.NEC, t * 0.3]); return w; };
  const ring = (k, a, o) => { const r = HOOD[k], c = Math.cos(a), s = Math.sin(a), e = 2 / 2.3; return o.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r[2], r[0], r[1] - Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r[3] : r[4])); };
  // inner : un envers, plus sombre, à 4 mm sous l'endroit (une capuche qui dépasse de la tête se voit par son ouverture : sans lui, le fond
  // paraissait à travers)
  for (const inner of hp.inner ? [false, true] : [false]) skinSurf(B, hi ? 30 : 12, (hi ? 2 : 1) * (nk - 1), (u, vv, o) => {
    const f = vv * (nk - 1), k = Math.min(nk - 2, Math.floor(f)), t = f - k, gap = lerp(HOOD[k][5], HOOD[k + 1][5], t);
    const a = gap + u * (TAU - 2 * gap); // angle depuis l'avant (-z), la couture ouverte devant
    const p0 = ring(k, a, new V3()), p1 = ring(k + 1, a, tq);
    p0.lerp(p1, t);
    // plis tombants et bord de l'ouverture épaissi
    // (hp.tuck : le bas, glissé sous un gilet, sans plis : leur zigzag se voyait là où la capuche passe dessous)
    const fold = (hi ? 0.006 : 0.003) * Math.sin(a * 7 + f * 1.3) * smoothstep(1.7, 1.45, p0.y) * (hp.tuck ? smoothstep(1.5, 1.56, p0.y) : 1);
    const nx = Math.sin(a), nz = -Math.cos(a), dn = fold - (inner ? 0.004 : 0); p0.x += nx * dn; p0.z += nz * dn;
    if (inner) p0.y -= 0.004 * smoothstep(1.7, 1.8, p0.y); // (le sommet aussi)
    o.x = p0.x; o.y = p0.y; o.z = p0.z; o.w = hoodW(p0);
    const edge = gap > 0 && (u < 0.03 || u > 0.97);
    o.col = inner ? new THREE.Color(0.4, 0.4, 0.4) : edge ? new THREE.Color(0.55, 0.55, 0.55) : null;
    const uv = camoUV(a / TAU * 0.9, (1.8 - p0.y) * 1.4, 0.7, 0.13, 0.41); o.U = uv[0]; o.V = uv[1];
  }, { out: !inner });
}
/* Lanières feuillues de la tenue ghillie : des feuilles pointues accrochées aux sommets de la toile camouflée (pantalon,
   veste, manches, capuche ; pas aux gants, aux bottes ni au gilet), chacune pendante, un peu décollée, poids du sommet
   d'accroche (elle suit le membre). Deux faces par feuille : pas de matière double face. */
function skinGhillie(B, skin, hi) {
  const G = skinGear(skin), P = B.p, Nn = B.n, C = B.c, n0 = B.count, RNG = mulberry32(331), cand = [], M = soldierRest().mats;
  const gp = SKINS[skin].parts.ghillie, minY = gp.minY || 0.32; // une tenue de défi n'en met que sur la capuche et les épaules (minY)
  const bands = [-1, 1].map((sx) => new V3(0, 0, -0.15).applyMatrix4(M[SIDE_B(sx).ua])); // brassards (skinTags) : laissés visibles
  for (let i = 0; i < n0; i++) {
    const r = C[i * 3], g = C[i * 3 + 1], b = C[i * 3 + 2];
    // toile camouflée : couleurs de sommets neutres (blanc ou gris des coutures, bord de capuche)
    if (Math.abs(r - g) > 0.02 || Math.abs(g - b) > 0.02 || r < 0.5 || P[i * 3 + 1] < minY) continue;
    if (bands.some((c) => (P[i * 3] - c.x) ** 2 + (P[i * 3 + 1] - c.y) ** 2 + (P[i * 3 + 2] - c.z) ** 2 < 0.085 ** 2)) continue;
    cand.push(i);
  }
  const nLeaf = Math.round((hi ? 620 : 150) * (gp.k || 1)), Ls = hi ? 1 : 1.7, t = new V3(), nn = new V3(), d = new V3(), sd = new V3(), col = new THREE.Color();
  const pts = [new V3(), new V3(), new V3(), new V3()], tile = GEAR_TILE.fab;
  for (let k = 0; k < nLeaf && cand.length; k++) {
    const i = cand[Math.floor(RNG() * cand.length)];
    t.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nn.set(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]).normalize();
    const w = []; for (let j = 0; j < 4; j++) if (B.sw[i * 4 + j] > 0) w.push([B.si[i * 4 + j], B.sw[i * 4 + j]]);
    // pendante : vers le bas, écartée de la surface, un peu de travers
    d.set((RNG() - 0.5) * 0.7, -1, (RNG() - 0.5) * 0.7).addScaledVector(nn, 0.55 + RNG() * 0.4).normalize();
    sd.crossVectors(d, nn); if (sd.lengthSq() < 1e-6) sd.set(1, 0, 0); sd.normalize();
    const L = (0.065 + RNG() * 0.06) * Ls, W = (0.018 + RNG() * 0.016) * Ls, lift = 0.012 + RNG() * 0.012;
    pts[0].copy(t).addScaledVector(nn, 0.003);
    pts[1].copy(pts[0]).addScaledVector(d, L * 0.42).addScaledVector(sd, W).addScaledVector(nn, lift);
    pts[2].copy(pts[0]).addScaledVector(d, L).addScaledVector(nn, lift * 1.6);
    pts[3].copy(pts[0]).addScaledVector(d, L * 0.42).addScaledVector(sd, -W).addScaledVector(nn, lift);
    col.copy(G.leaves[Math.floor(RNG() * G.leaves.length)]).multiplyScalar(0.8 + RNG() * 0.4);
    // normale de la feuille (côté extérieur) et ses deux faces
    const fn = new V3().subVectors(pts[2], pts[0]).cross(new V3().subVectors(pts[3], pts[1])).normalize();
    if (fn.dot(nn) < 0) fn.negate();
    for (const side of [1, -1]) {
      const v0 = B.count;
      for (let j = 0; j < 4; j++) {
        const q = pts[j]; B.vert(q.x - fn.x * 0.0008 * (side < 0), q.y - fn.y * 0.0008 * (side < 0), q.z - fn.z * 0.0008 * (side < 0), tile[0], tile[1], side > 0 ? col : col.clone().multiplyScalar(0.7), w.length ? w : SB.CHE);
        const o = (v0 + j) * 3; B.n[o] = fn.x * side; B.n[o + 1] = fn.y * side; B.n[o + 2] = fn.z * side;
      }
      // sens des faces : la normale géométrique doit suivre fn * side
      const e1 = new V3().subVectors(pts[1], pts[0]), e2 = new V3().subVectors(pts[2], pts[0]), same = e1.cross(e2).dot(fn) * side > 0;
      if (same) { B.tri(v0, v0 + 1, v0 + 2); B.tri(v0, v0 + 2, v0 + 3); } else { B.tri(v0, v0 + 2, v0 + 1); B.tri(v0, v0 + 3, v0 + 2); }
    }
  }
}
/* Poncho de la tenue brèche : col roulé autour du cou, épaules couvertes, deux pans devant qui laissent le gilet à découvert,
   un pan arrière jusqu'aux genoux. Anneaux { y, demi-largeur, avant, arrière, ouverture devant (demi-angle, rad), fin des
   pans latéraux } ; deux nappes (dessus et dessous) pour qu'on n'en voie jamais l'envers par transparence. */
const PONCHO = [[1.505, 0.066, 0.058, 0.066, 0], [1.497, 0.15, 0.11, 0.115, 0.1], [1.494, 0.215, 0.14, 0.136, 0.2], [1.455, 0.29, 0.172, 0.158, 0.3],
  [1.38, 0.32, 0.2, 0.174, 0.4], [1.26, 0.322, 0.214, 0.186, 0.48], [1.12, 0.3, 0.216, 0.198, 0.6], [0.98, 0.27, 0.222, 0.214, 0.76], [0.84, 0.25, 0.23, 0.24, 1.1],
  [0.66, 0.235, 0.24, 0.28, 1.95], [0.55, 0.225, 0.24, 0.3, 2.2]];
/* Coordonnées de camouflage du poncho, non repliées (s, t) : deux zones de camouflage sur le tour (raccord au milieu du dos, s = 1, et
   devant, dans l'ouverture), et un raccord vertical exactement à l'anneau 7 (t = 1) : le tissu simulé y double ses sommets (06gb-tissu.js),
   si bien que le motif n'y est jamais étiré d'une zone à l'autre ; à peu près l'échelle du camouflage des vêtements (0,7 m) */
const PONCHO_T0 = 1 - (1.52 - PONCHO[7][0]) * 1.1 / 0.7;
function ponchoST(ang, y) { return [ang / TAU * 2, (1.52 - y) * 1.1 / 0.7 + PONCHO_T0]; }
/* Point de l'anneau k à l'angle ang (0 : devant), dans la pose de repos */
function ponchoRing(k, ang, o) { const r = PONCHO[k], c = Math.cos(ang), s = Math.sin(ang), e = 2 / 2.2; return o.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r[1], r[0], -Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r[2] : r[3])); }
/* Poids d'os d'un point du poncho : le tronc ; au-dessus des épaules, ceux de la manche juste dessous (os d'épaule et haut du bras,
   selon la place le long du bras) : le col reste posé sur le deltoïde quand le bras se lève ou que l'épaule monte en visée, au lieu
   d'être traversé ; les pans latéraux, posés sur les bras, suivent un peu le haut du bras (le poncho se soulève quand on épaule) ;
   le bas du pan arrière suit à moitié les cuisses (il ne passe pas à travers en courant). Ce sont aussi les cibles du tissu simulé
   (06gb-tissu.js) et celles des capes des tenues de défi (06gc-tenues-defi.js). */
const _pwA = new V3(), _pwB = new V3();
function ponchoWeights(p, ang) {
  let w = torsoW(p);
  const R = soldierRest();
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), S = R.J[b.jSh], d = _pwB.subVectors(p, S).dot(_pwA.subVectors(R.J[b.jEl], S).normalize());
    const f = smoothstep(0.05, 0.12, p.x * sx) * smoothstep(1.3, 1.4, p.y) * smoothstep(0.2, 0.1, d);
    if (f > 0) { wScale(w, 1 - f); for (const e of armW(b)(Math.max(d, -0.09))) wAdd(w, e[0], e[1] * f); }
  }
  const sd = Math.sin(ang), k = smoothstep(0.45, 0.95, Math.abs(sd)) * smoothstep(0.95, 1.25, p.y) * smoothstep(1.5, 1.4, p.y) * 0.7;
  if (k > 0) { const b = SIDE_B(sd > 0 ? 1 : -1); w = w.map((e) => [e[0], e[1] * (1 - k)]); w.push([b.ua, k * 0.6], [b.shh, k * 0.4]); }
  if (p.y < 0.95) { const t = smoothstep(0.95, 0.6, p.y); w = w.map((e) => [e[0], e[1] * (1 - t * 0.5)]); w.push([SB.THL, t * 0.25], [SB.THR, t * 0.25]); }
  return w;
}
/* Modèle détaillé : le col et le dessus des épaules seulement (anneaux 0 à CLOTH_PONCHO_K0), le reste est le tissu simulé
   (06gb-tissu.js) ; modèle allégé (de loin, ombre portée) : le poncho entier, rigide */
function skinPoncho(B, skin, hi) {
  const nk = hi ? CLOTH_PONCHO_K0 + 1 : PONCHO.length, a = new V3(), b = new V3();
  for (const inner of [false, true]) {
    skinSurf(B, hi ? 40 : 14, (hi ? 2 : 1) * (nk - 1), (u, vv, o) => {
      const f = vv * (nk - 1), k = Math.min(nk - 2, Math.floor(f)), t = f - k, gap = lerp(PONCHO[k][4], PONCHO[k + 1][4], t);
      const ang = gap + u * (TAU - 2 * gap);
      ponchoRing(k, ang, a).lerp(ponchoRing(k + 1, ang, b), t);
      // drapé : plis verticaux plus marqués vers le bas, ourlet irrégulier
      const lo = smoothstep(1.35, 0.6, a.y), fold = (hi ? 0.012 : 0.006) * lo * Math.sin(ang * 9 + 0.7) + 0.004 * lo * Math.sin(ang * 23);
      const nx = Math.sin(ang), nz = -Math.cos(ang); a.x += nx * (fold - (inner ? 0.007 : 0)); a.z += nz * (fold - (inner ? 0.007 : 0));
      if (!hi && vv > 0.98) a.y += 0.025 * Math.sin(ang * 5 + 1.1);
      o.x = a.x; o.y = a.y; o.z = a.z; o.w = ponchoWeights(a, ang);
      o.col = inner ? new THREE.Color().setScalar(a.y > 1.49 ? 0.85 : 0.55) : vv < 0.06 && !hi ? new THREE.Color(0.85, 0.85, 0.85) : null; // (le bord du col, vu d'en haut, n'est pas plus sombre)
      const st = ponchoST(ang, a.y), uv = atlasUV('camo', st[0] - Math.floor(st[0]), st[1] - Math.floor(st[1])); o.U = uv[0]; o.V = uv[1];
    }, { out: !inner });
  }
}
/* Cartouches rouges au culot de laiton, sur un porte-cartouches élastique au milieu du gilet (brèche) */
function skinShells(B, skin, hi) {
  const G = skinGear(skin), CH = SB.CHE, D = G.poly;
  gBox(B, 0.15, 0.1, 0.02, 0.006, gMat(0, 1.14, -0.19, 0.12), CH, D, 'nyl');
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
    const x = -0.056 + i * 0.028, y = 1.165 - r * 0.052, z = -0.204 + r * 0.006;
    if (hi) {
      gCyl(B, 0.0105, 0.0105, 0.05, 8, gMat(x, y, z, 0.12), CH, G.shell, 'gloss');
      gCyl(B, 0.0112, 0.0112, 0.012, 8, gMat(x, y - 0.029, z - 0.0035, 0.12), CH, G.brass, 'brass');
    } else gBox(B, 0.022, 0.06, 0.022, 0, gMat(x, y - 0.004, z, 0.12), CH, G.shell, 'gloss');
  }
  if (hi) gBox(B, 0.152, 0.012, 0.024, 0.003, gMat(0, 1.152, -0.196, 0.12), CH, D, 'rub'); // élastique
}
/* Écusson d'épaule (bras gauche) et son symbole : Λ (assaut, ghillie, brèche) ou X (commando) */
function skinPatch(B, skin, hi) {
  if (!hi) return;
  const R = soldierRest(), M = R.mats, b = SIDE_B(-1), G = skinGear(skin), um = M[b.ua], X = SKINS[skin].sym === 'X';
  // repère du bras au repos : -z le long du bras ; l'extérieur du bras gauche est vers -x du modèle
  const out = new V3(-1, 0, 0).transformDirection(new THREE.Matrix4().copy(um).invert()).normalize();
  const c = new V3(0, 0, -0.085).addScaledVector(out, 0.064);
  const base = new THREE.Matrix4().lookAt(new V3(), out, new V3(0, 0, -1)).setPosition(c), wt = armW(b)(0.085);
  const put = (m) => um.clone().multiply(base).multiply(m);
  gBox(B, 0.055, 0.06, 0.005, 0.002, put(new THREE.Matrix4()), wt, G.patch, 'fab');
  const sw = (x, y, rot) => gBox(B, 0.006, 0.038, 0.003, 0, put(new THREE.Matrix4().compose(new V3(x, y, -0.003), new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), rot), new V3(1, 1, 1))), wt, G.symc, 'fab', 0, 0);
  if (X) { sw(0, 0, 0.6); sw(0, 0, -0.6); } else { sw(-0.008, 0, 0.38); sw(0.008, 0, -0.38); }
}
/* Bandes de reconnaissance (tuile « tag » : couleur allié ou ennemi posée par la matière) : brassard large sur chaque bras,
   bande autour du casque (ou de la capuche). Présentes aux deux niveaux de détail : c'est un repère de près. */
function skinTags(B, skin, hi) {
  const R = soldierRest(), M = R.mats, hm = M[SB.HEA], WH = new THREE.Color(1, 1, 1), tag = () => GEAR_TILE.tag, seg = hi ? 14 : 8;
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), um = M[b.ua], d = 0.15, S = [];
    for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; S.push(new V3(Math.cos(a) * 0.0565, Math.sin(a) * 0.0565, -d).applyMatrix4(um)); }
    gBand(B, S, 0.07, 0.004, (p) => p.clone().sub(new V3(0, 0, -d).applyMatrix4(um)), armW(b)(d), WH, tag, 4);
  }
  if (SKINS[skin].tagHead) { SKINS[skin].tagHead(B, skin, hi); return; } // casque propre à une tenue de défi
  const S = [], hood = SKINS[skin].parts.hood;
  if (hood) {
    // capuche : bande sur le haut du crâne, d'une tempe à l'autre par l'arrière (repère du corps, au-dessus du front), posée sur la forme
    // même de la capuche (hoodPt), à 4 mm : une ellipse passait sous ses flancs plus carrés et n'en ressortait que par endroits
    for (let i = 0; i <= seg; i++) { const a = 0.5 + i / seg * (TAU - 1.0), p = hoodPt(1.728, a, new V3()), n = new V3(p.x, 0, p.z + 0.02).normalize(); S.push(p.addScaledVector(n, 0.004)); }
    gBand(B, S, 0.03, 0.004, (p) => new V3(p.x, 0, p.z + 0.02), SB.HEA, WH, tag, 4);
    return;
  }
  // casque : autour de la coque, au-dessus du bord (mêmes cotes que soldierHelmet)
  const c = new V3(0, 0.024, 0.008), rx = 0.108, ry = 0.118, rz = 0.123;
  for (let i = 0; i <= seg * 2; i++) {
    const ph = (i / (seg * 2) - 0.5) * TAU, th = Math.acos(clamp((helmetRimY(ph) - c.y) / ry, -1, 1)) - 0.34, g = 0.004;
    S.push(new V3(Math.sin(th) * Math.sin(ph) * (rx + g), Math.cos(th) * (ry + g), -Math.sin(th) * Math.cos(ph) * (rz + g)).add(c).applyMatrix4(hm));
  }
  const hc = c.clone().applyMatrix4(hm);
  gBand(B, S, 0.026, 0.004, (p) => p.clone().sub(hc), SB.HEA, WH, tag, 4);
}
