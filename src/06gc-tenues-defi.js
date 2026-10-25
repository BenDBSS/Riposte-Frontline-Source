/* ==========================================================================
   TENUES DE DÉFI : six tenues que le joueur débloque en relevant des défis (06s-defis.js) et qu'il porte quelle que soit son
   arme ; les bots gardent les tenues de base (06ga-tenues.js). D'après les illustrations du propriétaire :
   - Nomade (fusil à pompe) : casque et lunettes, respirateur, écharpe, crâne de bête sur l'épaule, cartouchière en travers,
     plaques de récupération ; cape à l'emblème du crâne, tablier en lambeaux et pan rouille (tissu simulé).
   - Tempête (précision) : capuche, masque à visière bleue, écharpe marine, bretelle et poches ; cape d'orage en éclats
     sur l'épaule gauche et le dos, à l'emblème blanc (tissu simulé).
   - Fantôme vert (précision) : capuche feuillue, yeux ambrés ; cape de feuillage jusqu'aux chevilles, ses feuilles et ses
     lucioles accrochées au tissu (tissu simulé, sommets satellites).
   - Raptor (pistolet-mitrailleur) : capuche, quadruple vision nocturne magenta, écharpe et harnais roses ; pagne et lanières
     roses aux hanches, rubans qui flottent de la capuche (tissu simulé).
   - Néant (fusil d'assaut) : casque intégral à facettes et visière violette, col, triangle lumineux, lame de cuisse ; basques
     de veste à chevrons lumineux (tissu simulé).
   - Gilet jaune (cartes françaises) : veste noire, capuche, cagoule, lunettes fumées, gilet de haute visibilité sali, écussons
     tricolores ; bas du gilet, à l'ourlet en dents, en tissu simulé.
   Même squelette, mêmes animations, mêmes zones de touche que les autres tenues ; clair ou sombre selon la relation au joueur,
   bandes de reconnaissance comprises. Les néons sont la tuile « glow » de l'atlas (éclairés par leur couleur de sommet,
   skinTagPatch) ; l'emblème d'une cape est dessiné dans la zone « art » de la texture de la tenue : ni texture ni programme de
   plus. Rien n'est construit au démarrage : une tenue de défi l'est la première fois qu'on la montre ou qu'un soldat la porte
   (soldierGeometry, soldierMaterial), et libérée quand plus rien ne la montre (skinRelease).
   ========================================================================== */

/* ---------- Outils de modélisation ---------- */
/* Repère d'une pièce posée sur le segment a-b (repos) : origine à la fraction t, y le long du segment, z vers out (rendu
   perpendiculaire), décalée de off le long de z */
function dSeg(a, b, t, out, off = 0) {
  const y = new V3().subVectors(b, a).normalize(), z = out.clone().addScaledVector(y, -out.dot(y)).normalize(), x = new V3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(new V3().lerpVectors(a, b, t).addScaledVector(z, off));
}
/* Plaque d'armure à facettes : boîte aux arêtes vives (cintrée de bend : z += bend·x²) */
function dPlate(B, w, h, d, m, wt, col, bend = 0, tile = 'plate') { gBox(B, w, h, d, 0, m, wt, col, tile, bend, 0); }
/* Géométrie three.js aux faces planes (normales par face) : le style des illustrations, à facettes */
function dFlat(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
/* Polygone (contour [[x, y]...], trou facultatif) extrudé sur depth, arêtes biseautées ; posé par m */
function dExtrude(B, pts, depth, bevel, m, wt, col, tile, hole) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  if (hole) sh.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = dFlat(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 }));
  g.translate(0, 0, -depth / 2);
  B.geo(g, m, wt, col, () => GEAR_TILE[tile]);
}
/* Étoile à cinq branches (contour), rayon r */
function dStar(r) { const p = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.42 : r; p.push([Math.cos(a) * q, Math.sin(a) * q]); } return p; }
/* Corne ou pointe effilée le long d'un chemin (repos) : sections rondes de r0 à r1 */
function dHorn(B, pts, r0, r1, wt, col, tile, seg = 8) {
  const n = pts.length, S = pts.map((c, i) => {
    const T = new V3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize(), up = Math.abs(T.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
    const X = new V3().crossVectors(up, T).normalize(), Y = new V3().crossVectors(T, X);
    return { c, X, Y, r: lerp(r0, r1, Math.pow(i / (n - 1), 0.8)), n: 2, v: i / (n - 1) };
  });
  skinLoft(B, S, seg, { wp: typeof wt === 'function' ? wt : () => wt, col: () => col, uv: () => GEAR_TILE[tile], cap1: r1 * 0.5 });
}
/* Points d'une courbe de Bézier quadratique a, c, b (n + 1 points) */
function dCurve(a, c, b, n) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push(new V3().copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * t * (1 - t)).addScaledVector(b, t * t)); } return o; }
/* Poids d'un point de l'épaule (côté sx) : tronc, aide d'épaule et bras */
const dShoulderW = (sx, k = 0.5) => { const b = SIDE_B(sx); return [[SB.CHE, 0.25], [b.shh, (1 - k) * 0.75], [b.ua, k * 0.75]]; };
/* Bandoulière (sangle en travers du torse) le long de pts, et ses objets posés tous les pas (fn(position, tangente, normale)) */
function dSling(B, pts, w, t, col, hi, step, fn) {
  gBand(B, pts, w, t, (p) => new V3(p.x * 0.4, (p.y - 1.25) * 0.3, p.z).normalize(), (p) => torsoW(p), col, (u, v) => atlasUV('web', u * 0.3, v), hi ? 10 : 5);
  if (!fn) return;
  const L = []; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += pts[i].distanceTo(pts[i - 1]); L.push(acc); }
  for (let d = step * 0.5; d < acc - step * 0.3; d += step) {
    let i = 0; while (i < L.length - 1 && L[i] < d) i++;
    const d0 = i ? L[i - 1] : 0, f = (d - d0) / (L[i] - d0), p = new V3().lerpVectors(pts[i], pts[i + 1], f), T = new V3().subVectors(pts[i + 1], pts[i]).normalize();
    fn(p, T, new V3(p.x * 0.4, (p.y - 1.25) * 0.3, p.z).normalize());
  }
}
/* Cartouche de fusil à pompe (douille rouge, culot de laiton) debout sur une sangle : axe across, appuyée vers out */
function dShell(B, G, p, across, out, hi, len = 0.05) {
  const y = across.clone().normalize(), z = out.clone().addScaledVector(y, -out.dot(y)).normalize(), x = new V3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(p.clone().addScaledVector(z, 0.011));
  const wt = torsoW(p);
  if (hi) {
    gCyl(B, 0.0105, 0.0105, len, 8, m, wt, G.shell, 'gloss');
    gCyl(B, 0.0112, 0.0112, 0.012, 8, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -len / 2 + 0.006, 0)), wt, G.brass, 'brass');
  } else gBox(B, 0.022, len, 0.022, 0, m, wt, G.shell, 'gloss');
}
/* Lunettes de protection (deux oculaires ronds sur une sangle autour du casque) */
function dGoggles(B, G, hi, ph0 = 0.34, th = 1.5, lensCol = null, glow = false) {
  const hm = soldierRest().mats[SB.HEA], H = SB.HEA, v = new V3(), S = [];
  const seg = hi ? 16 : 8;
  for (let i = 0; i <= seg; i++) { const ph = -Math.PI + (i / seg) * TAU; headPt(th - 0.02, ph, v, 0.018); S.push(v.clone().applyMatrix4(hm)); }
  gBand(B, S, 0.022, 0.004, (p) => p.clone().sub(new V3(0, 0.02, 0.006).applyMatrix4(hm)), H, G.poly, null, 4);
  for (const s of [-1, 1]) {
    headPt(th, s * ph0, v, 0.026); const c = v.clone(), n = headPt(th, s * ph0, new V3(), 0.06).sub(c).normalize();
    const z = n, y = new V3(0, 1, 0).addScaledVector(z, -z.y).normalize(), x = new V3().crossVectors(y, z);
    const m = hm.clone().multiply(new THREE.Matrix4().makeBasis(x, z, y.negate()).setPosition(c));
    gCyl(B, 0.026, 0.024, 0.02, hi ? 12 : 6, m, H, G.poly, 'rub');
    gCyl(B, 0.02, 0.02, 0.004, hi ? 12 : 6, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.011, 0)), H, lensCol || G.lens, glow ? 'glow' : 'lens');
  }
}
/* Écharpe roulée autour du cou : un bourrelet plissé posé sur les trapèzes, serré au cou et renflé au milieu (un grand cône parti des
   épaules, à 4 cm de la poitrine, faisait plastron) ; drop : un pan en pointe qui retombe devant sur le haut de la poitrine, plissé, à
   deux faces (le dessous plus sombre). col : couleur, tile : tuile, k : ampleur */
function dScarf(B, col, hi, k = 1, tile = 'fab', drop = 0) {
  const rings = [[1.458, 0.142, 0.094, 0.097, 0.004], [1.474, 0.128, 0.1, 0.1, 0.006], [1.497, 0.107, 0.094, 0.095, 0.006], [1.522, 0.09, 0.081, 0.085, 0.004], [1.545, 0.075, 0.07, 0.076, 0.002]];
  const S = rings.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w * k, w * k, f * k, bk * k], n: 2.2, v: y }));
  const edge = col.clone().multiplyScalar(0.78);
  skinLoft(B, S, hi ? 14 : 8, {
    wp: (p) => (p.y > 1.5 ? [[SB.NEC, 0.7], [SB.CHE, 0.3]] : torsoW(p)), col: (a, kk) => (kk === 0 || kk === 4 ? edge : col), uv: () => GEAR_TILE[tile],
    bump: (a, kk) => (0.012 * Math.sin(a * 5 + kk * 1.9) + 0.005 * Math.sin(a * 9 - kk * 2.3)) * (kk > 0 && kk < 4 ? 1 : 0.3), // plis à facettes
  });
  if (!drop) return;
  // pan devant : du bas du bourrelet à sa pointe, sur le haut de la poitrine et devant la plaque du gilet ; trois plis qui se creusent vers le bas
  const T = GEAR_TILE[tile], dark = col.clone().multiplyScalar(0.6); // (edge : bords plus sombres, comme le bourrelet)
  for (const inner of [false, true]) {
    skinSurf(B, hi ? 6 : 4, hi ? 3 : 2, (u, v, o) => {
      const x = (u - 0.5) * 0.22 * k * (1 - v * 0.9), y = 1.47 - v * drop, fold = 0.014 * v * Math.cos((u - 0.5) * Math.PI * 4);
      const z = -0.112 * k - 0.07 * v - 0.016 * Math.cos((u - 0.5) * Math.PI) - fold + (inner ? 0.004 : 0);
      o.x = x; o.y = y; o.z = z; o.w = torsoW(new V3(x, y, z)); o.col = inner ? dark : v > 0.9 ? edge : col; o.U = T[0]; o.V = T[1];
    }, { out: !inner });
  }
}
/* Plaques d'un membre : avant-bras (bracelets), tibias, cuisses ; col, accent (bande d'une autre couleur ou lumineuse) */
function dArmor(B, G, hi, o) {
  const R = soldierRest(), J = R.J;
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx);
    if (o.fore) {
      const out = new V3(sx * 0.75, 0.65, 0.1);
      dPlate(B, 0.075, 0.15, 0.016, dSeg(J[b.jEl], J[b.jHa], 0.52, out, 0.04), armW(b)(SD.ua + SD.fa * 0.52), o.fore, -3.2);
      if (o.foreAcc) dPlate(B, 0.012, 0.11, 0.004, dSeg(J[b.jEl], J[b.jHa], 0.52, out, 0.05), armW(b)(SD.ua + SD.fa * 0.52), o.foreAcc, 0, o.foreTile || 'paint');
    }
    if (o.shin) {
      const out = new V3(sx * 0.15, 0, -1);
      dPlate(B, 0.085, 0.22, 0.016, dSeg(J[b.jKn], J[b.jFt], 0.36, out, 0.062), legW(b)(SD.thigh + SD.shin * 0.36), o.shin, -2.8);
      if (o.shinAcc) for (const s of [-1, 1]) dPlate(B, 0.008, 0.07, 0.004, dSeg(J[b.jKn], J[b.jFt], 0.36, out, 0.071).multiply(gMat(s * 0.017, -0.03, 0, 0, 0, s * 0.5)), legW(b)(SD.thigh + SD.shin * 0.36), o.shinAcc, 0, o.shinTile || 'paint');
    }
    if (o.thigh) dPlate(B, 0.09, 0.16, 0.014, dSeg(J[b.jHi], J[b.jKn], 0.42, new V3(sx * 0.7, 0, -0.7), 0.085), legW(b)(SD.thigh * 0.42), o.thigh, -2.6);
    if (o.knee) {
      // genouillère à facettes, plus grande que celle du gilet
      const km = R.mats[b.kn].clone().multiply(new THREE.Matrix4().makeBasis(new V3(0, -1, 0), new V3(0, 0, 1), new V3(-1, 0, 0)));
      dExtrude(B, [[-0.05, -0.06], [0.05, -0.06], [0.062, 0.0], [0.04, 0.07], [-0.04, 0.07], [-0.062, 0.0]], 0.022, hi ? 0.006 : 0, km.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.012, -0.084)), [[b.kn, 0.45], [b.sh, 0.55]], o.knee, 'plate');
      if (o.kneeStar && sx > 0) dExtrude(B, dStar(0.026), 0.004, 0, km.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.008, -0.1)), [[b.kn, 0.45], [b.sh, 0.55]], o.kneeStar, 'paint');
      if (o.kneeAcc) dPlate(B, 0.07, 0.008, 0.004, km.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.03, -0.098)), [[b.kn, 0.45], [b.sh, 0.55]], o.kneeAcc, 0, o.kneeTile || 'paint');
    }
    if (o.pauldron) {
      // épaulière : trois plaques étagées sur le haut du bras
      const sh = J[b.jSh], el = J[b.jEl], out = new V3(sx, 0.85, 0.05);
      for (let k = 0; k < (hi ? 3 : 2); k++) dPlate(B, 0.13 - k * 0.014, 0.075, 0.014, dSeg(sh, el, 0.02 + k * 0.17, out, 0.072 - k * 0.006).multiply(gMat(0, 0, 0, -0.28)), dShoulderW(sx, 0.35 + k * 0.25), o.pauldron, -5 + k);
      if (o.pauldronAcc) dPlate(B, 0.1, 0.008, 0.004, dSeg(sh, el, 0.14, out, 0.081).multiply(gMat(0, 0, 0, -0.28)), dShoulderW(sx, 0.55), o.pauldronAcc, 0, o.pauldronTile || 'paint');
    }
  }
}
/* Coordonnées d'un pan de tissu dans la zone de camouflage, sans raccord (le pan tient dans une tuile) */
const dCamoST = (s, t, s0 = 0.05, t0 = 0.05, ks = 0.9, kt = 0.9) => atlasUV('camo', s0 + s * ks, t0 + t * kt);
/* Ourlet en lambeaux : longueur relative de chaque colonne (tirage fixe), entre lo et 1 ; pointes : une colonne sur deux plus courte */
function dHem(seed, lo, saw = 0) { const R = mulberry32(seed), L = []; return (s, i) => { while (L.length <= i) L.push(lo + R() * (1 - lo)); return L[i] * (saw && i % 2 ? 1 - saw : 1); }; }

/* ---------- Nomade ---------- */
/* Emblème de la cape : toile sable délavée, écu rouille pointe en bas, crâne de bête aux cornes en croissant, ourlet sali */
function nomadArt(g, W, H) {
  const R = mulberry32(57), cx = W / 2;
  g.fillStyle = '#b29c78'; g.fillRect(0, 0, W, H);
  // usure : nappes plus sombres et plus claires, salissures vers le bas
  for (let i = 0; i < 160; i++) { g.fillStyle = R() < 0.55 ? 'rgba(80,62,44,0.08)' : 'rgba(225,212,182,0.08)'; const r = 6 + R() * 28; g.beginPath(); g.ellipse(R() * W, R() * H, r, r * (0.4 + R()), R() * 3, 0, TAU); g.fill(); }
  const gr = g.createLinearGradient(0, H * 0.5, 0, H); gr.addColorStop(0, 'rgba(60,44,30,0)'); gr.addColorStop(1, 'rgba(60,44,30,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // écu rouille, pointe en bas, bords usés
  const top = H * 0.1, poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  g.fillStyle = '#8c3a22';
  poly([[cx - W * 0.33, top], [cx + W * 0.33, top], [cx + W * 0.3, top + H * 0.27], [cx, top + H * 0.6], [cx - W * 0.3, top + H * 0.27]]);
  g.fillStyle = 'rgba(40,16,8,0.3)'; for (let i = 0; i < 60; i++) g.fillRect(cx + (R() - 0.5) * W * 0.6, top + R() * H * 0.45, 2 + R() * 9, 1 + R() * 3);
  g.fillStyle = 'rgba(178,156,120,0.9)'; for (let i = 0; i < 24; i++) { const a = R(); g.fillRect(cx + (a - 0.5) * W * 0.66, top + R() * 4 - 2, 3 + R() * 6, 2 + R() * 3); } // éraflures du bord
  // crâne : cornes en croissant, front large, chanfrein qui s'effile, orbites et naseaux
  const bone = '#e6dbc0', y0 = top + H * 0.13;
  g.fillStyle = bone;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(cx + s * W * 0.1, y0 + H * 0.03);
    g.quadraticCurveTo(cx + s * W * 0.3, y0 + H * 0.05, cx + s * W * 0.36, y0 - H * 0.06);
    g.quadraticCurveTo(cx + s * W * 0.37, y0 - H * 0.1, cx + s * W * 0.33, y0 - H * 0.11);
    g.quadraticCurveTo(cx + s * W * 0.31, y0 - H * 0.02, cx + s * W * 0.12, y0 - H * 0.005); g.closePath(); g.fill();
  }
  poly([[cx - W * 0.15, y0 - H * 0.01], [cx + W * 0.15, y0 - H * 0.01], [cx + W * 0.13, y0 + H * 0.07], [cx + W * 0.075, y0 + H * 0.13], [cx + W * 0.05, y0 + H * 0.27], [cx - W * 0.05, y0 + H * 0.27], [cx - W * 0.075, y0 + H * 0.13], [cx - W * 0.13, y0 + H * 0.07]]);
  g.fillStyle = '#2e211a';
  for (const s of [-1, 1]) poly([[cx + s * W * 0.03, y0 + H * 0.06], [cx + s * W * 0.115, y0 + H * 0.045], [cx + s * W * 0.075, y0 + H * 0.11]]);
  poly([[cx - W * 0.008, y0 + H * 0.12], [cx + W * 0.008, y0 + H * 0.12], [cx + W * 0.004, y0 + H * 0.2], [cx - W * 0.004, y0 + H * 0.2]]);
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * W * 0.022, y0 + H * 0.245, W * 0.011, H * 0.012, 0, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(70,52,38,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + W * 0.06, y0 + H * 0.01); g.lineTo(cx + W * 0.03, y0 + H * 0.04); g.lineTo(cx + W * 0.045, y0 + H * 0.07); g.stroke();
  // ourlet effiloché : fils sombres verticaux en bas
  g.strokeStyle = 'rgba(55,40,28,0.55)'; g.lineWidth = 1;
  for (let i = 0; i < 80; i++) { const x = R() * W, y = H * (0.8 + R() * 0.18); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + 6 + R() * 14); g.stroke(); }
}
/* Pièces du Nomade (repos) */
function nomadModel(B, skin, hi) {
  const R = soldierRest(), J = R.J, G = skinGear(skin), hm = R.mats[SB.HEA];
  dGoggles(B, G, hi, 0.34, 1.47, G.lens);
  dScarf(B, G.scarf, hi, 1.08, 'fab', 0.11);
  // crâne de bête sur l'épaule droite : boîte crânienne et chanfrein à facettes, orbites, cornes, pointes rouilles
  const sh = J[J_SHR], wS = dShoulderW(1, 0.45), ico = (d) => dFlat(new THREE.IcosahedronGeometry(1, d));
  const sk = new THREE.Matrix4().compose(new V3(sh.x + 0.06, sh.y + 0.075, sh.z - 0.005), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.35, -0.55)), new V3(0.085, 0.072, 0.092));
  B.geo(ico(1), sk, wS, G.bone, () => GEAR_TILE.plate);
  B.geo(ico(1), sk.clone().multiply(new THREE.Matrix4().compose(new V3(0, -0.15, -1.15), new THREE.Quaternion(), new V3(0.55, 0.48, 0.95))), wS, G.bone, () => GEAR_TILE.plate);
  for (const s of [-1, 1]) {
    B.geo(ico(0), sk.clone().multiply(new THREE.Matrix4().compose(new V3(s * 0.48, 0.12, -0.72), new THREE.Quaternion(), new V3(0.26, 0.22, 0.2))), wS, G.poly, () => GEAR_TILE.rub);
    const base = new V3(s * 0.85, 0.45, -0.25).applyMatrix4(sk), tip = new V3(s * 1.45, 2.5, 0.55).applyMatrix4(sk), mid = new V3(s * 1.9, 0.9, 0.0).applyMatrix4(sk);
    dHorn(B, dCurve(base, mid, tip, hi ? 6 : 3), 0.016, 0.003, wS, G.bone.clone().multiplyScalar(0.92), 'plate', hi ? 8 : 5);
  }
  if (hi) for (let k = 0; k < 3; k++) {
    const p0 = new V3(sh.x + 0.03 - k * 0.025, sh.y + 0.085 - k * 0.005, sh.z + 0.05 + k * 0.012);
    dHorn(B, [p0, p0.clone().add(new V3(0.01, 0.06 + k * 0.012, 0.03))], 0.01, 0.002, wS, G.rust, 'paint', 5);
  }
  // épaulière gauche : plaques étagées de métal rouillé
  dArmor(B, G, hi, { fore: G.metal, shin: G.boot.clone().multiplyScalar(0.7), knee: G.metal, kneeStar: G.bone });
  const shl = J[J_SHL], el = J[J_ELL];
  for (let k = 0; k < (hi ? 3 : 2); k++) dPlate(B, 0.14 - k * 0.016, 0.08, 0.016, dSeg(shl, el, 0.0 + k * 0.17, new V3(-1, 0.85, 0.05), 0.075 - k * 0.006).multiply(gMat(0, 0, 0, -0.3)), dShoulderW(-1, 0.3 + k * 0.25), k === 1 ? G.rust : G.metal, -5 + k);
  // cartouchière en travers : de l'épaule droite à la hanche gauche, devant et dans le dos
  const front = [[0.15, 1.475, -0.03], [0.12, 1.405, -0.135], [0.03, 1.29, -0.178], [-0.07, 1.17, -0.18], [-0.165, 1.07, -0.13]].map(([x, y, z]) => new V3(x, y, z));
  dSling(B, front, 0.05, 0.012, G.belt, hi, hi ? 0.026 : 0.05, (p, T, n) => dShell(B, G, p, new V3().crossVectors(T, n), n, hi));
  dSling(B, [[0.15, 1.475, -0.03], [0.14, 1.42, 0.09], [0.04, 1.27, 0.155], [-0.08, 1.14, 0.15], [-0.165, 1.07, 0.1]].map(([x, y, z]) => new V3(x, y, z)), 0.05, 0.012, G.belt, hi, 0, null);
  // ceinturon : poches sombres, cartouches, boucle de métal
  for (const x of [-0.12, -0.06, 0.06, 0.12]) gBox(B, 0.052, 0.06, 0.03, hi ? 0.006 : 0, gMat(x, 1.09, -0.118 - Math.abs(x) * 0.12, 0.05, x * 2.2), torsoW(new V3(x, 1.09, -0.12)), G.vest, (u, v) => atlasUV('web', u * 0.4, v * 0.4));
  for (let i = 0; i < (hi ? 9 : 5); i++) {
    const a = -0.95 + i * (1.9 / ((hi ? 9 : 5) - 1)), x = Math.sin(a) * 0.168, z = -Math.cos(a) * 0.112;
    dShell(B, G, new V3(x, 1.03, z), new V3(0, 1, 0), new V3(Math.sin(a), 0, -Math.cos(a)), hi, 0.044);
  }
  dExtrude(B, [[-0.03, 0.025], [0.03, 0.025], [0, -0.03]], 0.008, hi ? 0.003 : 0, gMat(0, 1.045, -0.124, 0.05), SB.PEL, G.metal, 'met');
  // pointe rouille sur le casque
  if (hi) dHorn(B, [new V3(-0.04, 0.12, 0.03).applyMatrix4(hm), new V3(-0.05, 0.17, 0.06).applyMatrix4(hm)], 0.012, 0.002, SB.HEA, G.rust, 'paint', 5);
}
/* Tissus du Nomade : cape au dos (emblème), tablier devant en lambeaux, pan rouille de l'épaule gauche */
function nomadCloth(skin) {
  const G = skinGear(skin);
  const cape = clothRing({
    rings: [[1.47, 0.19, 0.12, 0.095], [1.31, 0.225, 0.2, 0.205], [1.0, 0.24, 0.21, 0.22], [0.66, 0.26, 0.24, 0.245], [0.36, 0.27, 0.26, 0.265]],
    a0: Math.PI - 1.05, a1: Math.PI + 1.05, cu: 13, rv: 14, hem: dHem(11, 0.8),
    w: (p, a) => ponchoWeights(p, a), maxD: (p, t) => 0.02 + Math.max(0, 1.47 - p.y) * 0.7,
    uv: (s, t) => atlasUV('art', 1 - s, t), shade: 0.6,
  });
  const apron = clothRing({
    rings: [[1.03, 0.178, 0.126, 0.13], [0.82, 0.19, 0.155, 0.15], [0.56, 0.2, 0.17, 0.16]],
    a0: -0.72, a1: 0.72, cu: 9, rv: 8, hem: dHem(23, 0.7, 0.12),
    w: (p) => clothHipW(p), maxD: (p, t) => 0.015 + t * 0.3, uv: (s, t) => dCamoST(s, t, 0.1, 0.1, 0.45, 0.4), shade: 0.65,
  });
  const sash = clothStrip({
    p0: new V3(-0.185, 1.44, 0.035), dir: new V3(-0.06, -1, 0.1).normalize(), side: new V3(0.25, 0, 1).normalize(), len: 1.02, w0: 0.2, w1: 0.09, cu: 3, rv: 12,
    w: (p) => (p.y > 1.2 ? torsoW(p) : ponchoWeights(p, -Math.PI / 2)), maxD: (t) => 0.02 + t * 0.55, uv: () => GEAR_TILE.fab, col: G.rust, shade: 0.75,
  });
  return clothBuild([cape, apron, sash]);
}

/* ---------- Tempête ---------- */
const TEMPEST_A = [Math.PI * 0.62, TAU - 0.35]; // la cape d'orage : du dos côté droit à l'avant de l'épaule gauche (le bras de l'arme reste libre)
/* Cape d'orage : éclats blancs, gris et marine sur fond marine, emblème blanc (flèche en V) au milieu du dos */
function tempestArt(g, W, H) {
  const R = mulberry32(91), uc = 1 - (Math.PI - TEMPEST_A[0]) / (TEMPEST_A[1] - TEMPEST_A[0]), cx = uc * W;
  g.fillStyle = '#1e2b4a'; g.fillRect(0, 0, W, H);
  const cols = ['#b9c2cd', '#929dab', '#68727f', '#434d5e', '#2a3a60', '#33467a', '#526078']; // (pas de blanc pur : vue par un allié, la tenue est éclaircie du double)
  // éclats : triangles pointe en bas, plus serrés sur les bords et vers l'ourlet ; le panneau central reste marine
  for (let i = 0; i < 420; i++) {
    const x = R() * W, y = R() * H, dc = Math.abs(x - cx) / W, keep = y > H * 0.62 || dc > 0.17 || R() < 0.08;
    if (!keep) continue;
    const sz = 10 + R() * 30, c = cols[Math.floor(R() * cols.length)];
    g.fillStyle = c; g.globalAlpha = 0.85 + R() * 0.15;
    g.beginPath(); g.moveTo(x - sz * (0.3 + R() * 0.4), y - sz * 0.4); g.lineTo(x + sz * (0.3 + R() * 0.4), y - sz * 0.45); g.lineTo(x + (R() - 0.5) * sz * 0.4, y + sz * (0.8 + R() * 0.7)); g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
  // emblème : flèche en V (deux bras qui se rejoignent sur la hampe), losange à la pointe, blanc cassé
  const y0 = H * 0.25, ww = W * 0.12, poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  g.fillStyle = '#ccd3db';
  for (const s of [-1, 1]) poly([[cx + s * ww, y0], [cx + s * (ww - W * 0.045), y0], [cx + s * W * 0.012, y0 + H * 0.115], [cx + s * W * 0.012, y0 + H * 0.15]]);
  poly([[cx - W * 0.012, y0 + H * 0.1], [cx + W * 0.012, y0 + H * 0.1], [cx + W * 0.012, y0 + H * 0.22], [cx - W * 0.012, y0 + H * 0.22]]);
  poly([[cx, y0 + H * 0.205], [cx + W * 0.032, y0 + H * 0.235], [cx, y0 + H * 0.27], [cx - W * 0.032, y0 + H * 0.235]]);
}
/* Pièces de la Tempête : visière lumineuse, écharpe, bretelle et poches, plaques à néons (la capuche et le masque : parts ; plus de
   radio dans le dos : sous la cape, elle et son antenne passaient au travers) */
function tempestModel(B, skin, hi) {
  const R = soldierRest(), J = R.J, G = skinGear(skin), hm = R.mats[SB.HEA], v = new V3();
  // visière : fente lumineuse bleue sur le masque, d'une tempe à l'autre
  skinSurf(B, hi ? 14 : 6, 1, (u, vv, o) => {
    const ph = (u - 0.5) * 1.8, th = lerp(1.44, 1.53, vv) + 0.03 * Math.abs(ph) * (vv - 0.5);
    headPt(th, ph, v, 0.019 + 0.004 * Math.cos(ph)).applyMatrix4(hm);
    o.x = v.x; o.y = v.y; o.z = v.z; o.w = SB.HEA; o.col = G.glowc; o.U = GEAR_TILE.glow[0]; o.V = GEAR_TILE.glow[1];
  }, { out: true });
  dScarf(B, G.navy, hi, 1.04, 'fab', 0.08);
  // bretelle en travers (épaule droite, hanche gauche) et ses poches à voyant bleu
  const sl = [[0.13, 1.47, -0.02], [0.1, 1.4, -0.13], [0.0, 1.28, -0.172], [-0.09, 1.16, -0.17], [-0.16, 1.06, -0.12]].map(([x, y, z]) => new V3(x, y, z));
  let k = 0;
  dSling(B, sl, 0.04, 0.01, G.belt, hi, 0.1, (p, T, n) => {
    if (k++ > 2) return;
    const y = new V3().crossVectors(T, n).normalize(), x = new V3().crossVectors(y, n), m = new THREE.Matrix4().makeBasis(x, y, n).setPosition(p.clone().addScaledVector(n, 0.02));
    gBox(B, 0.05, 0.07, 0.03, hi ? 0.006 : 0, m, torsoW(p), G.pouch, (u, vv) => atlasUV('web', u * 0.4, vv * 0.4));
    if (hi) gBox(B, 0.01, 0.01, 0.004, 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.012, 0.022, 0.016)), torsoW(p), G.glowc, 'glow');
  });
  dArmor(B, G, hi, { fore: G.plate, foreAcc: G.glowc, foreTile: 'glow', shin: G.plate, shinAcc: G.glowc, shinTile: 'glow', knee: G.plate, kneeAcc: G.glowc, kneeTile: 'glow', thigh: G.plate });
}
/* Tissu de la Tempête : la cape d'orage, en pointes, de l'arrière de l'épaule droite à l'avant de l'épaule gauche */
function tempestCloth(skin) {
  const cloak = clothRing({
    rings: [[1.47, 0.2, 0.125, 0.1], [1.38, 0.315, 0.195, 0.175], [1.15, 0.33, 0.225, 0.215], [0.82, 0.32, 0.245, 0.245], [0.5, 0.31, 0.255, 0.265]],
    a0: TEMPEST_A[0], a1: TEMPEST_A[1], cu: 17, rv: 14, hem: dHem(31, 0.84, 0.16),
    w: (p, a) => ponchoWeights(p, a), maxD: (p) => 0.02 + Math.max(0, 1.47 - p.y) * 0.75,
    uv: (s, t) => atlasUV('art', 1 - s, t), shade: 0.6,
  });
  return clothBuild([cloak]);
}

/* ---------- Fantôme vert ---------- */
/* Pièces du Fantôme vert : yeux lumineux, genouillères (la capuche et ses feuilles : parts.hood, parts.ghillie) */
function verdantModel(B, skin, hi) {
  const R = soldierRest(), hm = R.mats[SB.HEA], G = skinGear(skin), v = new V3();
  // yeux ambrés dans l'ombre de la capuche
  for (const s of [-1, 1]) {
    headPt(1.49, s * 0.33, v, 0.006); const c = v.clone().applyMatrix4(hm), n = headPt(1.49, s * 0.33, new V3(), 0.05).applyMatrix4(hm).sub(c).normalize();
    const y = new V3(0, 1, 0).addScaledVector(n, -n.y).normalize(), x = new V3().crossVectors(y, n);
    gBox(B, 0.026, 0.008, 0.004, 0, new THREE.Matrix4().makeBasis(x, y, n).setPosition(c).multiply(gMat(0, 0, 0, 0, 0, -s * 0.25)), SB.HEA, G.glowc, 'glow', 0, 0);
  }
  dArmor(B, G, hi, { knee: G.knee });
}
/* Tissu du Fantôme vert : cape de feuillage ouverte devant, jusqu'aux chevilles ; feuilles et lucioles en sommets satellites */
function verdantCloth(skin) {
  const G = skinGear(skin), gap = (t) => lerp(0.62, 0.95, t);
  const cloak = clothRing({
    rings: [[1.48, 0.21, 0.13, 0.12], [1.38, 0.33, 0.22, 0.2], [1.12, 0.35, 0.25, 0.24], [0.78, 0.36, 0.28, 0.28], [0.45, 0.37, 0.3, 0.31], [0.17, 0.38, 0.31, 0.32]],
    a0: gap, a1: (t) => TAU - gap(t), cu: 19, rv: 16, hem: dHem(41, 0.86),
    w: (p, a) => ponchoWeights(p, a), maxD: (p) => 0.02 + Math.max(0, 1.48 - p.y) * 0.62,
    uv: (s, t) => dCamoST(s, t, 0.03, 0.03, 0.94, 0.94), shade: 0.5,
  });
  const T = clothBuild([cloak], { drag: 1.1 });
  // feuilles accrochées à la cape (pendantes, écartées du tissu, de travers) et quelques lucioles
  const RNG = mulberry32(87), quads = [], pts = () => [new V3(), new V3(), new V3(), new V3()], tile = GEAR_TILE.fab, gl = GEAR_TILE.glow;
  const N = new Float32Array(T.n * 3); clothNormals(T, T.rest, N);
  const nn = new V3(), d = new V3(), sd = new V3(), t = new V3();
  for (let q = 0; q < 420; q++) {
    const k = Math.floor(RNG() * T.n), P = pts();
    t.fromArray(T.rest, k * 3); nn.fromArray(N, k * 3);
    d.set((RNG() - 0.5) * 0.8, -1, (RNG() - 0.5) * 0.8).addScaledVector(nn, 0.5 + RNG() * 0.6).normalize();
    sd.crossVectors(d, nn); if (sd.lengthSq() < 1e-6) sd.set(1, 0, 0); sd.normalize();
    const L = 0.1 + RNG() * 0.08, W2 = 0.022 + RNG() * 0.02, lift = 0.015 + RNG() * 0.03;
    P[0].copy(t).addScaledVector(nn, 0.004);
    P[1].copy(P[0]).addScaledVector(d, L * 0.42).addScaledVector(sd, W2).addScaledVector(nn, lift);
    P[2].copy(P[0]).addScaledVector(d, L).addScaledVector(nn, lift * 1.6);
    P[3].copy(P[0]).addScaledVector(d, L * 0.42).addScaledVector(sd, -W2).addScaledVector(nn, lift);
    const col = G.leaves[Math.floor(RNG() * G.leaves.length)].clone().multiplyScalar(0.8 + RNG() * 0.4);
    quads.push({ k, P, uv: [tile, tile, tile, tile], col });
  }
  for (let q = 0; q < 34; q++) {
    const k = Math.floor(RNG() * T.n), P = pts(); t.fromArray(T.rest, k * 3); nn.fromArray(N, k * 3);
    sd.set(1, 0, 0).addScaledVector(nn, -nn.x).normalize(); d.crossVectors(nn, sd);
    const c = t.clone().addScaledVector(nn, 0.04 + RNG() * 0.03), r = 0.014;
    P[0].copy(c).addScaledVector(d, r); P[1].copy(c).addScaledVector(sd, r); P[2].copy(c).addScaledVector(d, -r); P[3].copy(c).addScaledVector(sd, -r);
    quads.push({ k, P, uv: [gl, gl, gl, gl], col: G.glowc, colB: G.glowc });
  }
  return clothSatBuild(T, quads);
}

/* ---------- Raptor ---------- */
/* Pièces du Raptor : vision nocturne à quatre tubes, écharpe et harnais roses, ceinture, plaques à liserés */
function raptorModel(B, skin, hi) {
  const R = soldierRest(), hm = R.mats[SB.HEA], G = skinGear(skin), H = SB.HEA, v = new V3();
  // quadruple vision nocturne : boîtier sur le front de la capuche, quatre tubes aux lentilles magenta
  const at = (th, ph, grow) => headPt(th, ph, new V3(), grow), frame = (th, ph, grow) => {
    const c = at(th, ph, grow), n = at(th, ph, grow + 0.05).sub(c).normalize(), y = new V3(0, 1, 0).addScaledVector(n, -n.y).normalize(), x = new V3().crossVectors(y, n);
    return hm.clone().multiply(new THREE.Matrix4().makeBasis(x, y, n).setPosition(c));
  };
  gBox(B, 0.11, 0.036, 0.03, hi ? 0.008 : 0, frame(1.43, 0, 0.022), H, G.poly, 'poly');
  for (const [ph, r] of [[-0.42, 0.014], [-0.15, 0.019], [0.15, 0.019], [0.42, 0.014]]) {
    const m = frame(1.475, ph, 0.03).multiply(gMat(0, 0, 0.012, Math.PI / 2));
    gCyl(B, r + 0.004, r + 0.003, 0.03, hi ? 12 : 6, m, H, G.poly, 'rub');
    gCyl(B, r, r, 0.004, hi ? 12 : 6, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.016, 0)), H, G.glowc, 'glow');
  }
  dScarf(B, G.pink, hi, 1.06, 'fab', 0.1);
  // harnais en X (devant et dans le dos), ceinture rose
  const band = (pts) => dSling(B, pts.map(([x, y, z]) => new V3(x, y, z)), 0.034, 0.008, G.pink, hi, 0, null);
  band([[0.13, 1.46, -0.03], [0.1, 1.38, -0.15], [0.0, 1.27, -0.178], [-0.1, 1.15, -0.172], [-0.16, 1.07, -0.12]]);
  band([[-0.13, 1.46, -0.03], [-0.1, 1.38, -0.15], [0.0, 1.27, -0.178], [0.1, 1.15, -0.172], [0.16, 1.07, -0.12]]);
  band([[0.13, 1.46, 0.05], [0.1, 1.38, 0.15], [0.0, 1.27, 0.165], [-0.1, 1.15, 0.155], [-0.16, 1.07, 0.11]]);
  band([[-0.13, 1.46, 0.05], [-0.1, 1.38, 0.15], [0.0, 1.27, 0.165], [0.1, 1.15, 0.155], [0.16, 1.07, 0.11]]);
  const bl = [[1.066, 0.168, 0.11, 0.115, 0], [1.07, 0.17, 0.112, 0.117, 0], [1.1, 0.17, 0.112, 0.117, 0], [1.104, 0.168, 0.11, 0.115, 0]];
  skinLoft(B, bl.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.5, v: y })), hi ? 34 : 12, { wp: (p) => torsoW(p), col: () => G.pink, uv: () => GEAR_TILE.nyl });
  dArmor(B, G, hi, { fore: G.plate, foreAcc: G.pink, shin: G.plate, shinAcc: G.pink, knee: G.plate, kneeAcc: G.pink, pauldron: G.plate, pauldronAcc: G.pink });
}
/* Tissus du Raptor : pagne devant, quatre lanières pointues aux hanches, trois rubans qui pendent de la capuche */
function raptorCloth(skin) {
  const G = skinGear(skin), sheets = [];
  sheets.push(clothRing({
    rings: [[1.01, 0.172, 0.12, 0.12], [0.8, 0.18, 0.15, 0.14], [0.6, 0.185, 0.16, 0.15]], a0: -0.5, a1: 0.5, cu: 7, rv: 7, hem: dHem(61, 0.72, 0.25),
    w: (p) => clothHipW(p), maxD: (p, t) => 0.015 + t * 0.3, uv: (s, t) => dCamoST(s, t, 0.2, 0.2, 0.4, 0.4), shade: 0.6,
  }));
  // lanières roses pointues aux hanches (deux devant, deux derrière)
  for (const a of [-1.2, 1.2, Math.PI - 0.95, Math.PI + 0.95]) {
    const p0 = new V3(Math.sin(a) * 0.178, 1.0, -Math.cos(a) * (Math.cos(a) >= 0 ? 0.125 : 0.13)), out = new V3(Math.sin(a), 0, -Math.cos(a));
    sheets.push(clothStrip({ p0, dir: new V3(0, -1, 0).addScaledVector(out, 0.12).normalize(), side: new V3(Math.cos(a), 0, Math.sin(a)), len: 0.5, w0: 0.075, w1: 0.004, cu: 2, rv: 7,
      w: (p) => clothHipW(p), uv: () => GEAR_TILE.fab, col: G.pink, maxD: (t) => 0.015 + t * 0.3 }));
  }
  // rubans qui flottent de la capuche, côté droit
  for (let i = 0; i < 3; i++) {
    const p0 = new V3(0.07 + i * 0.014, 1.69 - i * 0.04, 0.06 + i * 0.012), len = 0.48 + i * 0.08;
    sheets.push(clothStrip({ p0, dir: new V3(0.45, -0.45, 0.77).normalize(), side: new V3(0.2, 0.75, -0.6).normalize(), len, w0: 0.055, w1: 0.004, cu: 2, rv: 8,
      w: (p, t) => [[SB.HEA, Math.max(0, 1 - t * 2)], [SB.NEC, Math.min(1, t * 2) * 0.5], [SB.CHE, Math.min(1, t * 2) * 0.5]], uv: () => GEAR_TILE.fab, col: G.pink, shade: 0.85, maxD: (t) => 0.02 + t * 0.45 }));
  }
  return clothBuild(sheets, { drag: 1.0 });
}

/* ---------- Néant ---------- */
/* Basques : toile graphite à facettes et liseré violet (le double chevron lumineux y est cousu : voidCloth) */
function voidArt(g, W, H) {
  const R = mulberry32(73);
  g.fillStyle = '#2a2930'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { g.fillStyle = R() < 0.5 ? 'rgba(15,14,18,0.35)' : 'rgba(80,78,92,0.25)'; const x = R() * W, y = R() * H, r = 10 + R() * 34; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * (0.5 + R()), y + r * 0.3); g.lineTo(x - r * (0.5 + R()), y + r * (0.2 + R() * 0.6)); g.closePath(); g.fill(); }
  // liseré violet sombre le long de l'ourlet
  g.fillStyle = 'rgba(110,60,190,0.35)'; g.fillRect(0, H * 0.86, W, H * 0.02);
}
/* Pièces du Néant : casque intégral et visière, col, poche au triangle lumineux, boucle, lame de cuisse, plaques à néons */
function voidModel(B, skin, hi) {
  const R = soldierRest(), hm = R.mats[SB.HEA], G = skinGear(skin), H = SB.HEA;
  // casque intégral à facettes : coque, panneau de visière sombre, fente lumineuse en V, deux ergots
  const shell = dFlat(new THREE.SphereGeometry(1, 8, hi ? 6 : 4, 0, TAU, 0, 2.3));
  const P = shell.attributes.position;
  // en pointe vers l'avant (+z de la sphère : l'avant du soldat après rotation), crête au sommet, joues aplaties
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); P.setXYZ(i, x * (1 - 0.12 * Math.max(0, -y)), y + 0.08 * Math.max(0, z) * Math.max(0, y), z > 0 ? z * (1.12 + 0.1 * (1 - Math.abs(x))) : z); }
  shell.computeVertexNormals();
  B.geo(shell, hm.clone().multiply(new THREE.Matrix4().compose(new V3(0, 0.02, -0.002), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new V3(0.118, 0.128, 0.128))), H, G.helm, () => GEAR_TILE.plate);
  const vis = dFlat(new THREE.SphereGeometry(1, hi ? 8 : 5, hi ? 3 : 2, -0.9 + Math.PI / 2 + Math.PI, 1.8, 1.25, 0.62));
  B.geo(vis, hm.clone().multiply(new THREE.Matrix4().compose(new V3(0, 0.022, -0.004), new THREE.Quaternion(), new V3(0.128, 0.137, 0.152))), H, G.visor, () => GEAR_TILE.lens);
  for (const s of [-1, 1]) {
    gBox(B, 0.05, 0.007, 0.004, 0, hm.clone().multiply(gMat(s * 0.03, 0.016 - 0.0, -0.148, 0.12, s * 0.22, s * 0.34)), H, G.glowc, 'glow', 0, 0);
    gBox(B, 0.018, 0.022, 0.03, 0, hm.clone().multiply(gMat(s * 0.07, 0.125, 0.0, 0, 0, s * 0.4)), H, G.helm.clone().multiplyScalar(0.8), 'plate', 0, 0);
  }
  dScarf(B, G.cowl, hi, 1.12, 'fab', 0.12);
  // poche centrale au triangle lumineux, boucle en X, emblème du dos
  gBox(B, 0.095, 0.095, 0.034, hi ? 0.008 : 0, gMat(0, 1.25, -0.19, 0.12), SB.CHE, G.pouch, (u, vv) => atlasUV('web', u * 0.4, vv * 0.4));
  const tri = [[-0.03, 0.022], [0.03, 0.022], [0, -0.03]], hole = [[-0.016, 0.013], [0, -0.014], [0.016, 0.013]];
  dExtrude(B, tri, 0.004, 0, gMat(0, 1.25, -0.209, 0.12), SB.CHE, G.glowc, 'glow', hole);
  dExtrude(B, tri.map(([x, y]) => [x * 1.6, y * 1.6]), 0.004, 0, gMat(0, 1.34, 0.141, -0.07, Math.PI), SB.CHE, G.glowc, 'glow', hole.map(([x, y]) => [x * 1.6, y * 1.6]));
  for (const s of [-1, 1]) gBox(B, 0.06, 0.012, 0.008, 0, gMat(0, 1.042, -0.118, 0, 0, s * 0.62), SB.PEL, G.metal, 'met', 0, 0);
  // lame de cuisse (fourreau sur la cuisse droite, tranchant lumineux)
  const J = R.J, b = SIDE_B(1), km = dSeg(J[b.jHi], J[b.jKn], 0.45, new V3(1, 0, -0.25), 0.095), wt = legW(b)(SD.thigh * 0.45);
  dPlate(B, 0.03, 0.24, 0.016, km, wt, G.poly, 0, 'poly');
  if (hi) dPlate(B, 0.006, 0.2, 0.004, km.clone().multiply(new THREE.Matrix4().makeTranslation(0.016, -0.01, 0.006)), wt, G.glowc, 0, 'glow');
  dPlate(B, 0.024, 0.07, 0.022, km.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.15, 0)), wt, G.plate, 0, 'rub');
  dArmor(B, G, hi, { fore: G.plate, foreAcc: G.glowc, foreTile: 'glow', shin: G.plate, shinAcc: G.glowc, shinTile: 'glow', knee: G.plate, kneeAcc: G.glowc, kneeTile: 'glow', pauldron: G.plate, pauldronAcc: G.glowc, pauldronTile: 'glow' });
}
/* Bande de reconnaissance du casque intégral : au-dessus de la visière, par les sommets de la troisième rangée de la coque (mêmes facettes,
   même déformation que voidModel), à 4 mm (elle flottait à 2 ou 3 cm, comme une auréole) */
function voidTagHead(B, skin, hi) {
  const hm = soldierRest().mats[SB.HEA], S = [], th = 3 / 6 * 2.3, sm = new THREE.Matrix4().compose(new V3(0, 0.02, -0.002), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new V3(0.118, 0.128, 0.128));
  const c = new V3(0, 0.02, -0.002).applyMatrix4(hm);
  for (let i = 0; i <= 8; i++) {
    const ph = i / 8 * TAU, x0 = -Math.cos(ph) * Math.sin(th), y0 = Math.cos(th), z0 = Math.sin(ph) * Math.sin(th); // sommet de SphereGeometry
    const p = new V3(x0, y0 + 0.08 * Math.max(0, z0) * Math.max(0, y0), z0 > 0 ? z0 * (1.12 + 0.1 * (1 - Math.abs(x0))) : z0).applyMatrix4(sm).applyMatrix4(hm);
    const n = p.clone().sub(c); n.y = 0; S.push(p.addScaledVector(n.normalize(), 0.004));
  }
  gBand(B, S, 0.02, 0.004, (p) => { const n = p.clone().sub(c); n.y = 0; return n; }, SB.HEA, new THREE.Color(1, 1, 1), () => GEAR_TILE.tag, 4);
}
/* Tissus du Néant : basques dans le dos (double chevron lumineux en sommets satellites) et pan devant, à gauche */
function voidCloth(skin) {
  const G = skinGear(skin), rings = [[1.05, 0.176, 0.12, 0.123], [0.78, 0.196, 0.15, 0.17], [0.47, 0.206, 0.17, 0.19]];
  const tails = clothRing({ rings, a0: Math.PI - 0.85, a1: Math.PI + 0.85, cu: 11, rv: 9, hem: dHem(51, 0.84, 0.1),
    w: (p) => clothHipW(p), maxD: (p, t) => 0.015 + t * 0.32, uv: (s, t) => atlasUV('art', 1 - s, t), shade: 0.55 });
  const flap = clothRing({ rings, a0: -1.2, a1: -0.32, cu: 6, rv: 9, hem: dHem(53, 0.78, 0.1),
    w: (p) => clothHipW(p), maxD: (p, t) => 0.015 + t * 0.32, uv: (s, t) => dCamoST(s, t, 0.3, 0.1, 0.3, 0.5), shade: 0.55 });
  const T = clothBuild([tails, flap]);
  // double chevron lumineux cousu sur les basques : bras en petits segments, chacun suit la particule la plus proche
  const N = new Float32Array(T.n * 3); clothNormals(T, T.rest, N);
  const gl = GEAR_TILE.glow, quads = [], at = (s, t) => Math.round(t * 8) * 11 + Math.round(s * 10); // particule des basques la plus proche de (s, t)
  const P0 = new V3(), nn = new V3(), seg = (a, b, k) => {
    nn.fromArray(N, k * 3); const d = new V3().subVectors(b, a), w = new V3().crossVectors(nn, d).normalize().multiplyScalar(0.007);
    const A = a.clone().addScaledVector(nn, 0.004), Bq = b.clone().addScaledVector(nn, 0.004);
    quads.push({ k, P: [A.clone().add(w), Bq.clone().add(w), Bq.clone().sub(w), A.clone().sub(w)], uv: [gl, gl, gl, gl], col: G.glowc, colB: G.glowc });
  };
  const surf = (s, t) => { // position de repos interpolée sur la grille des basques
    const fi = s * 10, fj = t * 8, i = Math.min(9, Math.floor(fi)), j = Math.min(7, Math.floor(fj)), u = fi - i, v = fj - j, r = T.rest, q = (ii, jj) => P0.fromArray(r, (jj * 11 + ii) * 3).clone();
    return q(i, j).multiplyScalar((1 - u) * (1 - v)).add(q(i + 1, j).multiplyScalar(u * (1 - v))).add(q(i, j + 1).multiplyScalar((1 - u) * v)).add(q(i + 1, j + 1).multiplyScalar(u * v));
  };
  for (let c = 0; c < 2; c++) for (const side of [-1, 1]) {
    const t0 = 0.42 + c * 0.13;
    for (let k = 0; k < 3; k++) {
      const s0 = 0.5 + side * (0.2 - k * 0.0667), s1 = 0.5 + side * (0.2 - (k + 1) * 0.0667), ta = t0 + (k / 3) * 0.08, tb = t0 + ((k + 1) / 3) * 0.08;
      seg(surf(s0, ta), surf(s1, tb), at((s0 + s1) / 2, (ta + tb) / 2));
    }
  }
  return clothSatBuild(T, quads);
}

/* ---------- Gilet jaune ---------- */
/* Gilet de haute visibilité posé sur la veste (SOLDIER_SHIRT, à GJ.g) : un tube de l'ourlet (bas, en dents irrégulières) au bas des
   emmanchures (ys), puis trois pans (devant droit, dos, devant gauche) jusqu'à la base du cou (y1), séparés par les emmanchures (gjEdge :
   en haut, la bande ne passe que sur le trapèze et le haut du dôme de l'épaule) et la petite encolure (gjNeck). Sous ym, il tombe droit de la poitrine jusque sous
   le ceinturon (GJ_HEM) au lieu de rentrer à la taille. De ym à l'ourlet, c'est un tissu simulé (giletCloth), qui garde sa forme par un
   rappel vers la pose et heurte un tronc mince (slim, 06gb-tissu.js : la capsule unique des capes le relevait en collerette). Angles : 0
   devant, π/2 à droite du soldat, π derrière ; n : segments sur le tour du tissu. */
const GJ = { g: 0.014, ym: 1.2, ys: 1.22, yt: 1.465, yn: 1.42, y1: 1.485, bas: 0.995, n: 24, xs: 0.1 };
const GJ_EDGE = new THREE.Color(0.72, 0.72, 0.72); // (biais cousu des bords : emmanchures, encolure, ourlet)
/* Dents de l'ourlet : remontée relative de chaque colonne (tirage fixe), nulle à la fermeture éclair */
const GJ_JAG = (() => { const R = mulberry32(97), o = []; for (let i = 0; i <= GJ.n; i++) o.push(i === 0 || i === GJ.n ? 0 : R() * (i % 2 ? 1 : 0.45)); return o; })();
/* Ourlet du gilet { demi-largeur, avant, arrière } : au large du ceinturon (0,16 ; 0,108 ; 0,115) et des hanches */
const GJ_HEM = [0, 0.172, 0.126, 0.13];
/* Rayon i (1 demi-largeur, 2 avant, 3 arrière, 4 centre z) de la veste à la hauteur y */
function gjShirt(y, i) {
  const T = SOLDIER_SHIRT; let k = 0; while (k < T.length - 2 && T[k + 1][0] < y) k++;
  return lerp(T[k][i], T[k + 1][i], clamp((y - T[k][0]) / (T[k + 1][0] - T[k][0]), 0, 1));
}
/* Demi-angle de l'emmanchure (autour de ±π/2, arrondie en haut et en bas) et de l'encolure (autour de 0) à la hauteur y */
/* Capuche de sweat : celle de la tenue ghillie jusque sous le menton, puis serrée autour du cou, le bord glissé sous le gilet (ni drapé
   sur les épaules, qui cacherait le gilet, ni jour entre la capuche et le gilet) */
const GJ_HOOD = HOOD_RINGS.slice(0, 7).concat([[1.5, -0.006, 0.122, 0.1, 0.112, 0.6], [1.462, 0.0, 0.124, 0.078, 0.086, 0.55]]);
const gjArm = (y) => 0.86 * Math.pow(Math.sin(Math.PI * clamp((y - GJ.ys) / (GJ.yt - GJ.ys), 0, 1)), 0.45); // (la racine du bras traverse la veste jusqu'à 1,26 m et à 50° de l'avant, bras tendu vers le garde-main : tools/dev/visual/gilet.js)
/* Bord de l'emmanchure à la hauteur y, en angle depuis le milieu du devant (back : depuis le milieu du dos), côté droit (le gauche par
   symétrie) : l'emmanchure, avancée vers le devant au-dessus de son bas (le bras tendu vers le garde-main y passe : tools/dev/visual/gilet.js),
   et sur le haut de l'épaule la verticale x = GJ.xs, au-delà de laquelle le torse est au fond du dôme de la manche (le gilet sorti de là
   faisait des pointes) */
function gjEdge(y, back) {
  const fw = 0.42 * smoothstep(GJ.ys, GJ.ys + 0.08, y) * (1 - smoothstep(1.455, 1.48, y)); // (nul au bas de l'emmanchure : couture avec le tube)
  const e = Math.PI / 2 - gjArm(y) + (back ? fw : -fw), k = smoothstep(1.4, 1.44, y); if (k <= 0) return e;
  return Math.min(e, lerp(Math.PI / 2, gjShirt(y, 1) + GJ.g > GJ.xs ? gjAng(GJ.xs, y, 1) : Math.PI / 2, k));
}
const gjNeck = (y) => 0.4 * Math.pow(clamp((y - GJ.yn) / (GJ.y1 - GJ.yn), 0, 1), 1.5); // (fermé presque jusqu'au cou : 8 cm d'ouverture en haut)
/* Point du torse de la veste à la hauteur y et à l'angle A, décalé de g ; vers le haut (trapèzes en pente), le décalage monte aussi. W
   (facultatif) reçoit ses poids : ceux du tronc, comme la veste dessous. (Le haut de l'épaule n'est pas couvert, gjEdge : le gilet sorti du
   dôme de la manche, avec les poids du bras, se relevait en lanières quand le bras bouge.) */
function gjPt(y, A, g, o, W) {
  const h = clamp((GJ.ym - y) / (GJ.ym - GJ.bas), 0, 1); // (sous ym : le gilet tombe droit vers l'ourlet)
  const r = (i) => (i === 4 ? lerp(gjShirt(Math.max(y, GJ.ym), 4), 0, h) : Math.max(gjShirt(y, i), lerp(gjShirt(GJ.ym, i), GJ_HEM[i] - GJ.g, h)) + g);
  const c = Math.cos(A), s = Math.sin(A), e = 2 / 2.4;
  o.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r(1), y + g * 0.9 * smoothstep(1.4, 1.48, y), r(4) - Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r(2) : r(3)));
  if (W) W[0] = torsoW(o);
  return o;
}
/* Angle du point d'abscisse x (côté sx) sur l'anneau y, devant (back : derrière) */
function gjAng(x, y, sx, back) {
  const T = SOLDIER_SHIRT; let k = 0; while (k < T.length - 2 && T[k + 1][0] < y) k++;
  const w = lerp(T[k][1], T[k + 1][1], clamp((y - T[k][0]) / (T[k + 1][0] - T[k][0]), 0, 1)) + GJ.g;
  const A = Math.asin(Math.min(1, Math.pow(Math.min(1, x / w), 2.4 / 2)));
  return sx * (back ? Math.PI - A : A);
}
/* Coordonnées du gilet dans la zone « art » : le tour de 0 (fermeture éclair, devant) à 2π, de la base du cou à l'ourlet */
const gjUV = (A, y) => atlasUV('art', A / TAU, (GJ.y1 - y) / (GJ.y1 - GJ.bas + 0.03));
/* Gilet peint : jaune fluo sali, deux bandes rétroréfléchissantes, fermeture éclair sur les bords (le devant), accrocs */
function gjArt(g, W, H) {
  const R = mulberry32(83), ty = (y) => (GJ.y1 - y) / (GJ.y1 - GJ.bas + 0.03) * H;
  g.fillStyle = '#a9b612'; g.fillRect(0, 0, W, H);
  // usure : nappes plus claires et plus ternes, crasse vers le bas, traînées
  for (let i = 0; i < 140; i++) { g.fillStyle = R() < 0.6 ? 'rgba(96,92,34,0.1)' : 'rgba(226,232,96,0.1)'; const r = 6 + R() * 26; g.beginPath(); g.ellipse(R() * W, R() * H, r, r * (0.4 + R()), R() * 3, 0, TAU); g.fill(); }
  const gr = g.createLinearGradient(0, H * 0.45, 0, H); gr.addColorStop(0, 'rgba(60,54,30,0)'); gr.addColorStop(1, 'rgba(60,54,30,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(48,44,30,${0.08 + R() * 0.16})`; const x = R() * W, y = R() * H; g.fillRect(x, y, 1 + R() * 3, 4 + R() * 22); }
  // bandes rétroréfléchissantes (5 cm) : gris argenté, grain de billes de verre, usées par endroits
  for (const [ya, yb] of [[1.365, 1.315], [1.175, 1.125]]) {
    const y0 = ty(ya), h = ty(yb) - y0;
    g.fillStyle = '#8a8e91'; g.fillRect(0, y0, W, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = R() < 0.5 ? 'rgba(70,72,76,0.35)' : 'rgba(205,208,210,0.35)'; g.fillRect(R() * W, y0 + R() * h, 1 + R() * 2, 1); }
    for (let i = 0; i < 18; i++) { g.fillStyle = R() < 0.5 ? 'rgba(150,150,60,0.5)' : 'rgba(60,58,50,0.35)'; g.fillRect(R() * W, y0 + R() * h, 3 + R() * 12, 2 + R() * (h * 0.5)); }
    g.fillStyle = 'rgba(40,40,30,0.4)'; g.fillRect(0, y0, W, 1); g.fillRect(0, y0 + h - 1, W, 1); // coutures
  }
  // fermeture éclair : sur les deux bords (le devant), dents claires sur un ruban sombre
  for (const x0 of [0, W - 5]) {
    g.fillStyle = '#2b2b26'; g.fillRect(x0, 0, 5, H);
    g.fillStyle = 'rgba(150,150,140,0.8)'; for (let y = 0; y < H; y += 3) g.fillRect(x0 + (x0 ? 0 : 2), y, 3, 1);
  }
  // accrocs : petits trous sombres bordés de fils
  for (let i = 0; i < 9; i++) {
    const x = 12 + R() * (W - 24), y = H * (0.3 + R() * 0.62), r = 2 + R() * 4;
    g.fillStyle = 'rgba(28,28,24,0.85)'; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + R() * 0.5), R() * 3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(80,80,40,0.7)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { const a = R() * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 2); g.stroke(); }
  }
  // ourlet effiloché : fils sombres en bas
  g.strokeStyle = 'rgba(55,52,30,0.55)';
  for (let i = 0; i < 90; i++) { const x = R() * W, y = H * (0.86 + R() * 0.12); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + 5 + R() * 12); g.stroke(); }
}
/* Haut du gilet, cousu (comme le col du poncho de la Brèche) : un tube de ym au bas des emmanchures et trois pans, bords de l'emmanchure et
   de l'encolure un peu plus sombres (biais cousu) ; le reste est le tissu simulé (giletCloth). Deux fois plus de détail de près pour épouser
   le dôme de l'épaule, la rangée du bas ayant ses sommets intermédiaires sur les cordes de celle du tissu (GJ.n segments : aucune fente) */
function gjVest(B, hi, under) { // (under : reçoit, sommet par sommet, le point de la veste dessous ; contrôle tools/dev/visual/gilet.js)
  const N = GJ.n, NU = hi ? 2 * N : N, v = new V3(), v2 = new V3(), edge = GJ_EDGE;
  const rows = (a, b, k) => { const o = []; for (let j = 0; j <= k; j++) o.push(lerp(a, b, j / k)); return o; };
  // (arm : côtés u = 0 ou 1 qui bordent une emmanchure, et s'il s'agit d'un devant ; le gilet s'y rapproche de la veste, de 14 à 2 mm sur les derniers 0,35 rad : le bras
  // tendu vers le garde-main frôle ce bord, tools/dev/visual/gilet.js ; pas au bas de l'emmanchure, couture avec le tube)
  const sheet = (Y, nu, ang, isEdge, chord, arm) => skinSurf(B, nu, Y.length - 1, (u, vv, o) => {
    const y = Y[Math.round(vv * (Y.length - 1))], A = ang(u, y), i = Math.round(u * nu), W = [];
    let g = GJ.g;
    if (arm) {
      const da = Math.min(arm[0] ? Math.abs(A - ang(0, y)) : 9, arm[1] ? Math.abs(ang(1, y) - A) : 9);
      // devant, la racine de la bretelle, où repose le bras tendu vers le garde-main, est plaquée sur la veste
      const root = arm[2] ? smoothstep(1.41, 1.43, y) * (1 - smoothstep(1.455, 1.47, y)) * (1 - smoothstep(0.35, 0.6, da)) : 0;
      g *= lerp(1, Math.min(0.15 + 0.85 * smoothstep(0, 0.35, da), 1 - 0.85 * root), smoothstep(GJ.ys, GJ.ys + 0.03, y));
    }
    gjPt(y, A, g, v, W);
    if (chord && vv === 0 && i % 2) { const W2 = []; gjPt(y, ang((i - 1) / nu, y), GJ.g, v, W); gjPt(y, ang((i + 1) / nu, y), GJ.g, v2, W2); v.add(v2).multiplyScalar(0.5); }
    if (under) under.push(gjPt(y, A, 0, new V3()));
    o.x = v.x; o.y = v.y; o.z = v.z; o.w = W[0];
    o.col = isEdge && isEdge(u, y) ? edge : null;
    const uv = gjUV(A, y); o.U = uv[0]; o.V = uv[1];
  }, { out: false });
  // haut de la poitrine : de ym (où le tissu simulé s'attache, GJ.n segments) au bas des emmanchures ; fermé devant (fermeture éclair à A = 0)
  sheet(rows(GJ.ym, GJ.ys, hi ? 2 : 1), NU, (u) => u * TAU, null, NU > N);
  // pans : leurs sommets du bas tombent sur ceux du tube (NU / 4, NU / 2, NU / 4 segments)
  const Y = rows(GJ.ys, GJ.y1, hi ? 16 : 5), q = Math.PI / 2;
  const ed = (u) => u < 0.02 || u > 0.98; // (y : bas des pans, sans biais)
  sheet(Y, NU / 4, (u, y) => lerp(gjNeck(y), gjEdge(y), u), (u, y) => y > GJ.ys + 0.01 && ed(u), false, [false, true, true]);
  sheet(Y, NU / 2, (u, y) => lerp(Math.PI - gjEdge(y, true), Math.PI + gjEdge(y, true), u), (u, y) => y > GJ.ys + 0.01 && (ed(u) || y > GJ.y1 - 0.005), false, [true, true]);
  sheet(Y, NU / 4, (u, y) => lerp(TAU - gjEdge(y), TAU - gjNeck(y), u), (u, y) => y > GJ.ys + 0.01 && ed(u), false, [true, false, true]);
}
/* Écusson tricolore sur le haut du bras (côté sx), bleu vers l'avant : fond sombre et trois bandes, cintrés comme la manche */
function gjFlag(B, G, sx) {
  const M = soldierRest().mats, b = SIDE_B(sx), um = M[b.ua], inv = new THREE.Matrix4().copy(um).invert();
  const out = new V3(sx, 0, 0).transformDirection(inv).normalize(), d = 0.09, bend = 8;
  const base = new THREE.Matrix4().lookAt(new V3(), out, new V3(0, 0, -1)).setPosition(new V3(0, 0, -d).addScaledVector(out, 0.064));
  const fw = new V3(0, 0, -1).transformDirection(inv).transformDirection(new THREE.Matrix4().extractRotation(base).invert()), fs = Math.sign(fw.x) || 1;
  const wt = armW(b)(d), put = (x, z) => um.clone().multiply(base).multiply(new THREE.Matrix4().makeTranslation(x, 0, z + bend * x * x));
  gBox(B, 0.056, 0.04, 0.004, 0.0015, put(0, 0), wt, G.patch, 'fab', bend, 0);
  [G.blue, G.white, G.red].forEach((c, i) => gBox(B, 0.016, 0.032, 0.002, 0, put(-fs * (i - 1) * 0.016, -0.0028), wt, c, 'fab', bend, 0));
}
/* Pièces du Gilet jaune : gilet, écusson de reconnaissance, écussons tricolores (la capuche, la cagoule, les lunettes : parts) */
function giletModel(B, skin, hi) {
  const G = skinGear(skin);
  gjVest(B, hi);
  // écusson de reconnaissance (tuile « tag ») cousu sur le haut du gilet, à gauche, au-dessus de la bande de poitrine (à 2 mm du gilet ;
  // plus bas, ce serait une pièce rigide sur le tissu simulé)
  if (hi) {
    const y = 1.405, sx = -1, a = new V3(), W = [], g = GJ.g + 0.004, A = gjAng(0.07, y, sx), p = gjPt(y, A, g, new V3(), W);
    const n = gjPt(y, A, g + 0.02, new V3()).sub(gjPt(y, A, g, a)).normalize();
    const up = gjPt(y + 0.02, A, g, new V3()).sub(gjPt(y - 0.02, A, g, a)).normalize(), x = new V3().crossVectors(up, n).normalize();
    gBox(B, 0.036, 0.04, 0.004, 0.0015, new THREE.Matrix4().makeBasis(x, new V3().crossVectors(n, x), n).setPosition(p), W[0], new THREE.Color(1, 1, 1), 'tag', 0, 0);
  }
  if (hi) for (const sx of [-1, 1]) gjFlag(B, G, sx);
}

/* Tissu du Gilet jaune : de ym (première rangée épinglée : les sommets du bas de la partie cousue) à l'ourlet en dents ; fermé devant à
   l'attache, la fermeture éclair peut bâiller en bas. Il garde sa forme (rappel vers la pose, T.home, et faible jeu) : le bas suit les
   hanches et bat un peu, sans flotter comme une cape ; tronc mince et sans bras pour les collisions (T.slim) */
function giletCloth(skin) {
  const N = GJ.n, rv = 6;
  const body = { cu: N + 1, rv, shade: 0.55, node: (i, j, nd) => {
    const t = j / (rv - 1), y = lerp(GJ.ym, GJ.bas + 0.035 * GJ_JAG[i], t), A = i / N * TAU, W = [];
    gjPt(y, A, GJ.g, nd.p, W); nd.w = W[0]; nd.maxD = 0.006 + t * 0.05;
    const uv = gjUV(A, y); nd.uv[0] = uv[0]; nd.uv[1] = uv[1];
    if (j === rv - 1) nd.col = GJ_EDGE;
  } };
  const T = clothBuild([body], { drag: 0.5 });
  T.home = 0.04; T.slim = true; T.pinOut = false; T.noIn = GJ.g - 0.004; // (jamais plus d'1 cm sous sa cible : à 4 mm de la veste au plus près)
  return T;
}

/* ---------- Les tenues de défi ----------
   Mêmes champs que les tenues de base (06ga-tenues.js) ; en plus : model (pièces propres, appelé par soldierGeometry), cloth
   (tissu simulé), art (emblème dessiné dans la zone « art »), neon (intensité des néons, tuile « glow »), tagHead (bande de
   reconnaissance d'un casque propre). Les défis qui les débloquent : DEFIS (06s-defis.js). */
Object.assign(SKINS, {
  nomad: {
    name: _t('Nomade'), role: _t('Survie, brèche, sans frontières'), seed: 733, sym: 'L', defi: true,
    camo: { style: 'poly', base: '#6a5a48', soft: ['#76654f', '#5d4f40', '#806d55'], mid: ['#9a8464', '#43392f', '#2f2a25'], n: [52, 46, 34], branch: ['#262220'], hi: '#c9b48e' },
    gear: { vest: '#4a4038', pouch: '#5a4e42', helm: '#a8926f', glove: '#3b3530', boot: '#6a5a48', sole: '#2a2622', belt: '#3f362e', poly: '#2e2a26', cup: '#4a4038', knee: '#6e5f4d', knit: '#3b3530',
      mask: '#3a3633', lens: '#2a1c12', patch: '#4a4038', symc: '#e8dcc0', shell: '#a8261c', brass: '#c09a48', bone: '#e2d6bc', rust: '#9c4a2c', metal: '#8d8a84', scarf: '#b49a78' },
    parts: { helmet: 'camo', mask: 'poly', glasses: false, patch: false, cape: true },
    tone: [[1.12, 1.1, 1.05], [0.46, 0.44, 0.43]], art: nomadArt, model: nomadModel, cloth: nomadCloth, neon: 0,
  },
  tempest: {
    name: _t('Tempête'), role: _t('Reconnaissance, longue portée'), seed: 845, sym: 'L', defi: true,
    camo: { style: 'poly', base: '#2b2f36', soft: ['#31353d', '#262a30', '#2f3540'], mid: ['#444b56', '#1d2026', '#1f2e52'], n: [50, 45, 30], branch: ['#15171b'], hi: '#6f7883' },
    gear: { vest: '#262a31', pouch: '#30343c', glove: '#202328', boot: '#262930', sole: '#141619', belt: '#22262c', poly: '#191c20', cup: '#262a31', knee: '#363b44', knit: '#16181b',
      mask: '#131518', lens: '#0c0e10', patch: '#262a31', symc: '#cfd6de', plate: '#2c3038', navy: '#22355f', glowc: '#2f86ff' },
    parts: { hood: true, mask: 'poly', glasses: false, pouches: 'sn', patch: false, cape: true },
    tone: [[1.95, 1.97, 2.03], [0.48, 0.48, 0.51]], art: tempestArt, model: tempestModel, cloth: tempestCloth, neon: 1.8,
  },
  verdant: {
    name: _t('Fantôme vert'), role: _t('Affût, invisible dans les feuillages'), seed: 629, sym: 'L', defi: true,
    camo: { style: 'leaf', base: '#46502f', soft: ['#505b36', '#3f482b'], mid: ['#62703a', '#788445', '#56622f'], n: [260, 220, 200, 160, 110], branch: ['#2f3622', '#9a9658'], hi: '#c2b86a' },
    gear: { vest: '#5f5a40', pouch: '#6e6748', glove: '#3a3f2c', boot: '#6f6046', sole: '#2a2724', belt: '#55533c', poly: '#30322a', cup: '#3a3f2c', knee: '#6e6748', knit: '#15170f',
      mask: '#1b1e16', lens: '#0c0e10', patch: '#5f5a40', symc: '#c2b86a', glowc: '#ffb43c',
      leaves: ['#55602f', '#667236', '#7a8442', '#47512d', '#8d894f', '#5e5732', '#a09757'] },
    parts: { hood: true, ghillie: { minY: 1.42, k: 0.55 }, glasses: false, pouches: 'sn', patch: false, cape: true },
    tone: [[1.3, 1.32, 1.24], [0.5, 0.5, 0.49]], model: verdantModel, cloth: verdantCloth, neon: 2.2,
  },
  raptor: {
    name: _t('Raptor'), role: _t('Vitesse, assaut rapproché'), seed: 517, sym: 'X', defi: true,
    camo: { style: 'poly', base: '#242529', soft: ['#2a2b30', '#1f2024', '#2e2f35'], mid: ['#383940', '#18191c', '#43444b'], n: [45, 40, 30], branch: ['#121214'], hi: '#55565d',
      slash: { col: ['#f0208a', '#a8125c'], n: [16, 12], len: [0.05, 0.1], w: [0.007, 0.01], rot: -0.75 } },
    gear: { vest: '#1c1d20', pouch: '#26272b', glove: '#18191c', boot: '#202125', sole: '#101012', belt: '#1c1d20', poly: '#131315', cup: '#1c1d20', knee: '#26272b', knit: '#131315',
      mask: '#161719', lens: '#0c0e10', patch: '#1c1d20', symc: '#ff2d9a', plate: '#25262a', pink: '#f0208a', glowc: '#ff2bd0' },
    parts: { hood: true, mask: 'poly', glasses: false, pouches: 'smg', pack: true, patch: false },
    tone: [[2.25, 2.22, 2.26], [0.56, 0.55, 0.57]], model: raptorModel, cloth: raptorCloth, neon: 1.8,
  },
  void: {
    name: _t('Néant'), role: _t('Infiltration, précision, domination'), seed: 389, sym: 'X', defi: true,
    camo: { style: 'poly', base: '#2a2930', soft: ['#302f37', '#25242a', '#2d2c34'], mid: ['#3b3a43', '#1c1b20', '#474651'], n: [45, 40, 30], branch: ['#161519'], hi: '#5f5d6a' },
    gear: { vest: '#222127', pouch: '#2b2a31', glove: '#1d1c21', boot: '#25242a', sole: '#111014', belt: '#1d1c21', poly: '#17161a', cup: '#222127', knee: '#323139', knit: '#17161a',
      mask: '#17161a', lens: '#0c0e10', patch: '#222127', symc: '#9b4dff', plate: '#2c2b33', helm: '#2e2d35', visor: '#121116', cowl: '#26252b', metal: '#7d7b86', glowc: '#a855ff' },
    parts: { glasses: false, pouches: 'ar', patch: false },
    tone: [[2.15, 2.13, 2.2], [0.56, 0.55, 0.58]], art: voidArt, model: voidModel, cloth: voidCloth, tagHead: voidTagHead, neon: 1.8,
  },
  gilet: {
    name: _t('Gilet jaune'), role: _t('Haute visibilité, aucune discrétion'), seed: 457, sym: 'L', defi: true,
    camo: { style: 'poly', base: '#252628', soft: ['#292a2d', '#212224', '#27282b'], mid: ['#313236', '#1b1c1e', '#2d2e32'], n: [45, 40, 30], branch: ['#141516'], hi: '#3d3e42' },
    gear: { vest: '#2a2b2e', pouch: '#2c2d31', glove: '#1c1d20', boot: '#26272a', sole: '#121315', belt: '#1e1f22', poly: '#17181a', cup: '#2a2b2e', knee: '#2b2c30', knit: '#1d1e21',
      mask: '#1b1c1f', lens: '#2a1912', patch: '#1d1e21', symc: '#c4c6c8', blue: '#24418e', white: '#c8cacc', red: '#b5252b' },
    parts: { hood: { rings: GJ_HOOD, inner: true, tuck: true }, mask: 'fab', carrier: false, patch: false },
    tone: [[1.6, 1.6, 1.56], [0.5, 0.5, 0.5]], art: gjArt, model: giletModel, cloth: giletCloth, neon: 0,
  },
});
/* Tenues de défi, dans l'ordre de l'écran Tenues */
const SKIN_DEFI = ['nomad', 'tempest', 'verdant', 'raptor', 'void', 'gilet'];
