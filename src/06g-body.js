/* ==========================================================================
   SOLDATS : corps lissé sur 31 os, tenue et équipement
   Les 15 articulations de l'animation (et du ragdoll, de la killcam, des zones de touche) restent la référence.
   On en déduit à chaque image le repère de 31 os : bassin, lombaires, thorax, cou, tête ; pour chaque bras,
   bras, os d'aide du coude, avant-bras, os de torsion, main ; pour chaque jambe, cuisse, os d'aide du genou,
   jambe, pied, orteils ; enfin des os d'aide aux hanches et aux épaules. Un os d'aide prend à chaque image la
   rotation à mi-chemin de ses deux voisins : les articulations pliées gardent leur volume.

   Le corps est un seul maillage continu (deux niveaux de détail), construit dans une pose de repos :
   pantalon et veste de treillis camouflés, gilet porte-plaques avec sangles MOLLE, poches à chargeurs,
   radio et antenne, sac d'hydratation, ceinture, étui de cuisse, genouillères, rangers à semelle crantée,
   gants tactiques, casque à rails et coquilles d'écoute, cagoule et masque, lunettes balistiques ; puis les pièces propres
   à chaque tenue (06ga-tenues.js : jumelles de vision nocturne, capuche et lanières ghillie, poncho, cartouches).
   Mensurations d'un homme de 1,76 m : cuisse 43 cm, jambe 42,5 cm, bras 29 cm, avant-bras 26,5 cm, épaules (articulations) à 32,4 cm
   l'une de l'autre, assez près du torse pour que les manches en partent (silhouette athlétique, d'après le X Bot de Mixamo).
   Repère du modèle au repos : pieds à y = 0, regard vers -z, droite du soldat vers +x.
   ========================================================================== */
const SB = { PEL: 0, SPI: 1, CHE: 2, NEC: 3, HEA: 4, UAL: 5, ELL: 6, FAL: 7, TWL: 8, HAL: 9, UAR: 10, ELR: 11, FAR: 12, TWR: 13, HAR: 14,
  THL: 15, KNL: 16, SHL: 17, FTL: 18, TOL: 19, THR: 20, KNR: 21, SHR: 22, FTR: 23, TOR: 24, HPL: 25, HPR: 26, SHHL: 27, SHHR: 28, HLS: 29, HLG: 30 };
/* HLS, HLG : la main gauche existe en deux formes figées (sous un garde-main, autour d'une poignée d'appui), chacune sur son os, placé
   comme l'os de la main (HAL, qui garde la manchette du gant) ; celle qui ne sert pas est réduite à rien (échelle nulle) */
const SOLDIER_NB = 31;
/* mensurations (m) */
const SD = { pel: 0.995, hipX: 0.088, hipY: -0.065, thigh: 0.43, shin: 0.425, trunk: 0.445, shX: 0.162, shY: -0.035, shZ: 0.012, head: [0, 0.188, -0.028], ua: 0.29, fa: 0.265, ball: [0, -0.052, -0.122] };
/* os par côté (sx = -1 gauche, +1 droite) */
const SIDE_B = (sx) => (sx < 0
  ? { ua: SB.UAL, el: SB.ELL, fa: SB.FAL, tw: SB.TWL, ha: SB.HAL, th: SB.THL, kn: SB.KNL, sh: SB.SHL, ft: SB.FTL, to: SB.TOL, hp: SB.HPL, shh: SB.SHHL, jSh: J_SHL, jEl: J_ELL, jHa: J_HAL, jHi: J_HIL, jKn: J_KNL, jFt: J_FTL }
  : { ua: SB.UAR, el: SB.ELR, fa: SB.FAR, tw: SB.TWR, ha: SB.HAR, th: SB.THR, kn: SB.KNR, sh: SB.SHR, ft: SB.FTR, to: SB.TOR, hp: SB.HPR, shh: SB.SHHR, jSh: J_SHR, jEl: J_ELR, jHa: J_HAR, jHi: J_HIR, jKn: J_KNR, jFt: J_FTR });
/* Articulations au repos : jambes presque tendues, bras en avant et vers le bas (pose proche du port d'arme,
   ce qui limite les déformations là où le soldat passe le plus de temps) */
function soldierRestJoints() {
  const J = []; for (let i = 0; i < 15; i++) J.push(new V3());
  J[J_PEL].set(0, SD.pel, 0); J[J_CHE].set(0, SD.pel + SD.trunk, 0.005); J[J_HEAD].copy(J[J_CHE]).add(new V3(...SD.head));
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx);
    J[b.jSh].set(sx * SD.shX, J[J_CHE].y + SD.shY, SD.shZ);
    const du = new V3(sx * 0.3, -0.88, -0.36).normalize(), df = new V3(sx * 0.18, -0.4, -0.9).normalize();
    J[b.jEl].copy(J[b.jSh]).addScaledVector(du, SD.ua); J[b.jHa].copy(J[b.jEl]).addScaledVector(df, SD.fa);
    J[b.jHi].set(sx * SD.hipX, SD.pel + SD.hipY, 0);
    J[b.jKn].copy(J[b.jHi]).add(new V3(sx * 0.004, -SD.thigh * Math.cos(0.06), -SD.thigh * Math.sin(0.06)));
    J[b.jFt].copy(J[b.jKn]).add(new V3(sx * 0.003, -SD.shin * Math.cos(0.06), SD.shin * Math.sin(0.06)));
  }
  return J;
}
/* ---------- Repères des os ---------- */
const _so = { x: new V3(), y: new V3(), z: new V3(), a: new V3(), b: new V3(), n: new V3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), q3: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), qf: new THREE.Quaternion() };
function _sBasis(x, y, z, q) { _so.m.makeBasis(x, y, z); return q.setFromRotationMatrix(_so.m); }
/* Membre a-b-c : repères des deux segments (-z le long du segment, y sur l'axe de la charnière multiplié par ys) */
function limbFrames(a, b, c, ys, lastN, qU, qF) {
  const du = _so.a.subVectors(b, a).normalize(), df = _so.b.subVectors(c, b).normalize(), n = _so.n.crossVectors(du, df);
  if (n.lengthSq() < 1e-6) n.copy(lastN); else n.normalize();
  if (n.dot(lastN) < -0.2) n.lerp(lastN, 0.5).normalize();
  lastN.copy(n);
  _so.y.copy(n).multiplyScalar(ys);
  _so.z.copy(du).negate(); _so.x.crossVectors(_so.y, _so.z); _sBasis(_so.x, _so.y, _so.z, qU);
  _so.z.copy(df).negate(); _so.x.crossVectors(_so.y, _so.z); _sBasis(_so.x, _so.y, _so.z, qF);
}
/* Os d'aide : rotation à mi-chemin (par rapport au repos) de ses deux voisins */
function helperQ(B, a, b, rest, out) {
  _so.qa.copy(rest[a]).invert().premultiply(B[a].quaternion);
  _so.qb.copy(rest[b]).invert().premultiply(B[b].quaternion);
  return out.slerpQuaternions(_so.qa, _so.qb, 0.5).multiply(rest[a]);
}
/* Place les os à partir des articulations J (espace monde). o : { rest (quaternions de repos), lastN (4 vecteurs),
   fwd (avant du corps, horizontal), fp (inclinaison des pieds) ou null (pieds déduits des jambes, ragdoll), fy (lacet des pieds),
   headQ (orientation de la tête) ou null, handQ / handP (mains posées sur l'arme) ou null, lGrip (main gauche sur une poignée d'appui) } */
function soldierFrames(J, B, o) {
  const x = _so.x, y = _so.y, z = _so.z, R = o.rest;
  // bassin : hanches et direction du buste ; thorax : épaules et direction du buste
  x.subVectors(J[J_HIR], J[J_HIL]).normalize(); y.subVectors(J[J_CHE], J[J_PEL]); y.addScaledVector(x, -y.dot(x)).normalize(); z.crossVectors(x, y);
  _sBasis(x, y, z, B[SB.PEL].quaternion); B[SB.PEL].position.copy(J[J_PEL]);
  x.subVectors(J[J_SHR], J[J_SHL]).normalize(); y.subVectors(J[J_CHE], J[J_PEL]); y.addScaledVector(x, -y.dot(x)).normalize(); z.crossVectors(x, y);
  _sBasis(x, y, z, B[SB.CHE].quaternion); B[SB.CHE].position.lerpVectors(J[J_PEL], J[J_CHE], 0.58);
  B[SB.SPI].quaternion.slerpQuaternions(B[SB.PEL].quaternion, B[SB.CHE].quaternion, 0.5); B[SB.SPI].position.lerpVectors(J[J_PEL], J[J_CHE], 0.3);
  // cou : de la base du cou vers la tête ; tête : orientation donnée (regard) ou celle du cou
  x.set(1, 0, 0).applyQuaternion(B[SB.CHE].quaternion); y.subVectors(J[J_HEAD], J[J_CHE]).normalize(); x.addScaledVector(y, -x.dot(y)).normalize(); z.crossVectors(x, y);
  _sBasis(x, y, z, B[SB.NEC].quaternion); B[SB.NEC].position.copy(J[J_CHE]);
  if (o.headQ) B[SB.HEA].quaternion.copy(o.headQ); else B[SB.HEA].quaternion.copy(B[SB.NEC].quaternion).multiply(_so.q.copy(R[SB.NEC]).invert()).multiply(R[SB.HEA]);
  B[SB.HEA].position.copy(J[J_HEAD]);
  for (let k = 0; k < 2; k++) {
    const sx = k ? 1 : -1, b = SIDE_B(sx);
    // bras : charnière du coude ; main posée sur l'arme ou dans le prolongement de l'avant-bras
    limbFrames(J[b.jSh], J[b.jEl], J[b.jHa], sx, o.lastN[k], B[b.ua].quaternion, B[b.fa].quaternion);
    B[b.ua].position.copy(J[b.jSh]); B[b.fa].position.copy(J[b.jEl]); B[b.el].position.copy(J[b.jEl]);
    helperQ(B, b.ua, b.fa, R, B[b.el].quaternion);
    const fd = _so.a.subVectors(J[b.jHa], J[b.jEl]).normalize();
    if (o.handQ && o.handQ[k]) { B[b.ha].quaternion.copy(o.handQ[k]); B[b.ha].position.copy(o.handP[k]); }
    else { B[b.ha].quaternion.copy(B[b.fa].quaternion); B[b.ha].position.copy(J[b.jHa]).addScaledVector(fd, WRIST_OFF); }
    if (!k) for (const [i, on] of [[SB.HLS, !o.lGrip], [SB.HLG, !!o.lGrip]]) { B[i].position.copy(B[b.ha].position); B[i].quaternion.copy(B[b.ha].quaternion); B[i].scale.setScalar(on ? 1 : 0); }
    // torsion : avant-bras tourné à moitié vers la main
    z.copy(fd).negate(); y.set(0, 1, 0).applyQuaternion(B[b.ha].quaternion); y.addScaledVector(z, -y.dot(z));
    if (y.lengthSq() < 1e-6) y.set(0, 1, 0).applyQuaternion(B[b.fa].quaternion); y.normalize(); x.crossVectors(y, z);
    _sBasis(x, y, z, _so.q2); B[b.tw].quaternion.slerpQuaternions(B[b.fa].quaternion, _so.q2, 0.5); B[b.tw].position.lerpVectors(J[b.jEl], J[b.jHa], 0.55);
    B[b.shh].position.copy(J[b.jSh]); helperQ(B, SB.CHE, b.ua, R, B[b.shh].quaternion);
    // jambes : charnière du genou
    limbFrames(J[b.jHi], J[b.jKn], J[b.jFt], 1, o.lastN[k + 2], B[b.th].quaternion, B[b.sh].quaternion);
    B[b.th].position.copy(J[b.jHi]); B[b.sh].position.copy(J[b.jKn]); B[b.kn].position.copy(J[b.jKn]);
    helperQ(B, b.th, b.sh, R, B[b.kn].quaternion);
    B[b.hp].position.copy(J[b.jHi]); helperQ(B, SB.PEL, b.th, R, B[b.hp].quaternion);
    // pied : à plat dans l'axe du corps et incliné (vivant), ou perpendiculaire à la jambe (ragdoll)
    const ft = B[b.ft], to = B[b.to];
    if (o.fp) {
      z.copy(o.fwd).negate(); y.set(0, 1, 0); x.crossVectors(y, z); _sBasis(x, y, z, _so.qf);
      // pointe du pied tournée (lacet propre à chaque pied : pointes ouvertes, pied arrière de profil en posture de tir)
      if (o.fy) _so.qf.premultiply(_so.q.setFromAxisAngle(_so.a.set(0, 1, 0), o.fy[k]));
      ft.quaternion.copy(_so.qf).multiply(_so.q3.setFromAxisAngle(_so.a.set(1, 0, 0), o.fp[k]));
    } else {
      _so.q.copy(B[b.sh].quaternion); x.set(1, 0, 0).applyQuaternion(_so.q); z.copy(x).negate(); y.set(0, 0, 1).applyQuaternion(_so.q); x.crossVectors(y, z);
      _sBasis(x, y, z, ft.quaternion);
    }
    ft.position.copy(J[b.jFt]);
    to.position.set(...SD.ball).applyQuaternion(ft.quaternion).add(J[b.jFt]);
    to.quaternion.copy(ft.quaternion);
    if (o.fp && o.fp[k] < 0) to.quaternion.multiply(_so.q3.setFromAxisAngle(_so.a.set(1, 0, 0), -o.fp[k] * 0.85));
  }
}
/* Repos : repères des os et quaternions de référence (calculés une fois) */
let SOLDIER_REST = null;
function soldierRest() {
  if (SOLDIER_REST) return SOLDIER_REST;
  const J = soldierRestJoints(), B = [];
  for (let i = 0; i < SOLDIER_NB; i++) B.push(new THREE.Object3D());
  const lastN = [new V3(0, 1, 0), new V3(0, 1, 0), new V3(-1, 0, 0), new V3(-1, 0, 0)];
  // première passe pour les os principaux, puis quaternions de repos = ceux de cette pose (les os d'aide s'y alignent)
  const R0 = []; for (let i = 0; i < SOLDIER_NB; i++) R0.push(new THREE.Quaternion());
  soldierFrames(J, B, { rest: R0, lastN, fwd: new V3(0, 0, -1), fp: [0, 0], headQ: null });
  const rest = B.map((b) => b.quaternion.clone());
  soldierFrames(J, B, { rest, lastN, fwd: new V3(0, 0, -1), fp: [0, 0], headQ: null });
  for (const k of [SB.ELL, SB.ELR, SB.KNL, SB.KNR, SB.HPL, SB.HPR, SB.SHHL, SB.SHHR]) rest[k].copy(B[k].quaternion);
  const mats = B.map((b) => new THREE.Matrix4().compose(b.position, b.quaternion, new V3(1, 1, 1)));
  return (SOLDIER_REST = { J, q: rest, mats, lastN: lastN.map((v) => v.clone()) });
}

/* ---------- Tenues ---------- */
/* Couleurs de l'équipement : celles de la tenue (skinGear, 06ga-tenues.js), en linéaire */
const _wv = new V3();
function wAdd(w, b, v) { if (v <= 0) return; for (const e of w) if (e[0] === b) { e[1] += v; return; } w.push([b, v]); }
function wScale(w, k) { for (const e of w) e[1] *= k; return w; }
/* Poids des pièces du tronc, selon la hauteur (bassin, lombaires, thorax, cou), avec les épaules et le haut des cuisses */
function torsoW(p) {
  const R = soldierRest(), J = R.J;
  const w = chainW(p.y, [{ s: 1.035, h: 0.06, a: SB.PEL, b: SB.SPI }, { s: 1.2, h: 0.075, a: SB.SPI, b: SB.CHE }, { s: 1.46, h: 0.025, a: SB.CHE, b: SB.NEC }]).map((e) => e.slice());
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), sh = J[b.jSh], hi = J[b.jHi];
    const ts = smoothstep(0.15, 0.05, p.distanceTo(sh)) * smoothstep(0.07, 0.13, p.x * sx);
    if (ts > 0) { wScale(w, 1 - ts); wAdd(w, b.shh, ts * 0.65); wAdd(w, b.ua, ts * 0.35); }
    const th = smoothstep(0.16, 0.06, p.distanceTo(hi)) * smoothstep(hi.y + 0.07, hi.y - 0.05, p.y) * smoothstep(-0.01, 0.05, p.x * sx);
    if (th > 0) { wScale(w, 1 - th); wAdd(w, b.hp, th * 0.6); wAdd(w, b.th, th * 0.4); }
  }
  return w;
}
function legW(b) { const J = [{ s: 0, h: 0.075, a: SB.PEL, m: b.hp, b: b.th }, { s: SD.thigh, h: 0.06, a: b.th, m: b.kn, b: b.sh }, { s: SD.thigh + SD.shin, h: 0.035, a: b.sh, b: b.ft }]; return (d) => chainW(d, J); }
function armW(b, handK = 0) {
  const J = [{ s: 0, h: 0.07, a: SB.CHE, m: b.shh, b: b.ua }, { s: SD.ua, h: 0.05, a: b.ua, m: b.el, b: b.fa }];
  return (d) => {
    const w = chainW(d, J).map((e) => e.slice()), t = clamp((d - SD.ua) / SD.fa, 0, 1);
    for (const e of w) if (e[0] === b.fa) { const v = e[1]; e[1] = v * (1 - t); w.push([b.tw, v * t * (1 - handK)]); if (handK) w.push([b.ha, v * t * handK]); break; }
    return w;
  };
}
/* Tête sculptée (repère de la tête) : ellipsoïde déformé, mâchoire plus étroite, menton, arcades, nez, pommettes, lèvres.
   th : 0 au sommet, π sous le menton ; ph : 0 devant (-z), π/2 à droite */
function headPt(th, ph, out, grow = 0) {
  const sx = Math.sin(th) * Math.sin(ph), sy = Math.cos(th), sz = -Math.sin(th) * Math.cos(ph);
  let x = sx * 0.075, y = sy * (sy > 0 ? 0.117 : 0.122), z = sz * (sz < 0 ? 0.097 : 0.104) + 0.006;
  const front = Math.max(0, -sz), back = Math.max(0, sz);
  const jw = smoothstep(-0.015, -0.085, y);
  x *= 1 - 0.24 * jw - 0.1 * smoothstep(-0.07, -0.115, y) * front; z += 0.006 * jw * front;
  z *= 1 - 0.45 * smoothstep(-0.02, -0.1, y) * back * back;
  if (front > 0.3) {
    const f = smoothstep(0.3, 0.8, front);
    z *= 1 - 0.07 * f * smoothstep(0.08, 0.0, Math.abs(y - 0.0));
    const g2 = (cx, cy, s) => Math.exp(-(((x - cx) / s) ** 2) - (((y - cy) / s) ** 2));
    let dz = 0;
    dz -= 0.007 * (g2(0.03, 0.012, 0.015) + g2(-0.03, 0.012, 0.015));
    dz += 0.005 * Math.exp(-((x / 0.05) ** 2) - (((y - 0.032) / 0.01) ** 2));
    dz += 0.0045 * (g2(0.048, -0.012, 0.018) + g2(-0.048, -0.012, 0.018));
    // nez : arête qui s'avance jusqu'à la pointe, ailes plus larges, narines
    const nw = lerp(0.0075, 0.0135, smoothstep(0.015, -0.034, y));
    dz += 0.021 * smoothstep(0.035, -0.03, y) * smoothstep(-0.047, -0.036, y) * Math.exp(-((x / nw) ** 2));
    dz += 0.006 * Math.exp(-(((Math.abs(x) - 0.012) / 0.006) ** 2) - (((y + 0.038) / 0.006) ** 2));
    // sillons nasogéniens, lèvres, creux sous la lèvre, menton
    dz -= 0.003 * Math.exp(-(((Math.abs(x) - 0.024) / 0.005) ** 2) - (((y + 0.05) / 0.014) ** 2));
    dz += 0.0055 * Math.exp(-((x / 0.022) ** 2) - (((y + 0.057) / 0.007) ** 2)) + 0.0045 * Math.exp(-((x / 0.02) ** 2) - (((y + 0.07) / 0.006) ** 2));
    dz -= 0.0025 * Math.exp(-((x / 0.024) ** 2) - (((y + 0.0635) / 0.0022) ** 2)) + 0.003 * Math.exp(-((x / 0.02) ** 2) - (((y + 0.082) / 0.006) ** 2));
    dz += 0.0085 * Math.exp(-((x / 0.021) ** 2) - (((y + 0.1) / 0.013) ** 2));
    z -= dz * f;
  }
  if (grow) { const l = hyp3(x, y - 0.005, z - 0.006) || 1; x += x / l * grow; y += (y - 0.005) / l * grow; z += (z - 0.006) / l * grow; }
  return out.set(x, y, z);
}
/* Anneaux du torse de la veste { y, demi-largeur, avant, arrière, centre z } (superellipse d'exposant 2,4) : taille, côtes, poitrine,
   épaules, trapèzes jusqu'à la base du cou (soldierBase) ; le gilet du Gilet jaune (06gc-tenues-defi.js) s'y pose */
const SOLDIER_SHIRT = [[1.0, 0.145, 0.094, 0.102, 0.0], [1.07, 0.138, 0.098, 0.098, 0.0], [1.14, 0.146, 0.106, 0.1, -0.002], [1.22, 0.16, 0.116, 0.104, -0.006], [1.29, 0.168, 0.122, 0.106, -0.008], [1.345, 0.168, 0.116, 0.104, -0.005],
  [1.39, 0.165, 0.1, 0.1, 0.0], [1.425, 0.157, 0.088, 0.093, 0.004], [1.452, 0.143, 0.076, 0.083, 0.007], [1.47, 0.12, 0.067, 0.073, 0.007], [1.48, 0.094, 0.061, 0.066, 0.005], [1.485, 0.074, 0.057, 0.06, 0.004]];
/* Corps de base : jambes, bassin et torse, bras, gants et mains, cou, tête (visage ou cagoule) */
function soldierBase(B, skin, hi, mark = () => {}) {
  const R = soldierRest(), J = R.J, M = R.mats, P = skinGear(skin), Pp = SKINS[skin].parts, C = (h) => new THREE.Color(h);
  const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), AX = new V3(0, 0, -1), WH = C(0xffffff), SEAMC = new THREE.Color(0.7, 0.7, 0.7);
  const rs = hi ? 1 : 0.5;
  // ---- jambes de pantalon : cuisse ample, genou, mollet ; le bas est rentré dans les rangers et bouffe par-dessus le col
  //      (bourrelet plissé), puis se resserre à l'intérieur de la tige
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), rnd = mulberry32(sx > 0 ? 21 : 22), ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    // cuisse forte en haut (quadriceps devant, ischios derrière) qui s'affine vers le genou, rotule, mollet, bas de jambe fin jusqu'au bourrelet
    const prof = [[-0.09, 0.096, 0.098, 0.097], [-0.03, 0.096, 0.1, 0.096], [0.03, 0.093, 0.1, 0.092], [0.1, 0.089, 0.092, 0.087], [0.18, 0.083, 0.084, 0.08], [0.26, 0.075, 0.074, 0.072],
      [0.33, 0.066, 0.064, 0.064], [0.39, 0.06, 0.058, 0.058], [0.43, 0.063, 0.056, 0.057], [0.47, 0.059, 0.062, 0.057], [0.53, 0.057, 0.07, 0.059], [0.58, 0.054, 0.066, 0.056], [0.625, 0.053, 0.059, 0.054],
      [0.66, 0.065, 0.068, 0.066], [0.68, 0.068, 0.069, 0.069], [0.698, 0.069, 0.07, 0.07], [0.712, 0.067, 0.068, 0.068], [0.722, 0.062, 0.063, 0.063], [0.73, 0.052, 0.053, 0.052], [0.75, 0.047, 0.048, 0.047]];
    skinSweep(B, [{ M: M[b.th], L: SD.thigh }, { M: M[b.sh], L: SD.shin }], [0.05], AX, X, Y, prof.map(([d, f, bk, s]) => ({ d, r: [f, bk, s, s], n: 2.15 })), Math.round(22 * rs) + 2, {
      a0: sx > 0 ? Math.PI / 2 : -Math.PI / 2, // couture intérieure
      w: legW(b),
      bump: (a, k, s) => {
        const d = s.v, fr = Math.cos(a);
        let v = 0.0022 * Math.sin(a * 3 + d * 14 + ph[0]) + 0.0012 * Math.sin(a * 5 - d * 23 + ph[1]);
        v += 0.004 * Math.max(0, -fr) * Math.sin(d * 140 + ph[2]) * Math.exp(-(((d - SD.thigh) / 0.05) ** 2));
        // plis du bourrelet au-dessus du col des rangers : tissu tassé en travers et en long
        const bl = Math.exp(-(((d - 0.69) / 0.025) ** 2));
        v += bl * (0.0035 * Math.sin(a * 7 + ph[2] + d * 40) + 0.0025 * Math.sin(d * 260 + Math.sin(a * 3) * 2.5));
        return v;
      },
      col: (a) => (Math.abs(Math.sin(a) * -sx - 1) < 0.02 ? SEAMC : WH),
      uv: (u, v) => atlasUV('camo', 0.04 + u * 0.8, (v + 0.1) / 0.9),
    });
  }
  mark('jambes');
  // ---- bassin (pantalon) : du creux de l'entrejambe à la taille
  const torsoRing = (tab, y0, y1, uvK, o) => {
    const rows = tab.filter((r) => r[0] >= y0 - 1e-6 && r[0] <= y1 + 1e-6), nr = rows.length;
    const S = rows.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.4, v: y }));
    return skinLoft(B, S, Math.round(34 * rs) + 4, Object.assign({ wp: (p) => torsoW(p), uv: (u, v) => atlasUV('camo', 0.02 + u * 0.95, (v - y0) / 0.75 + uvK) }, o));
  };
  const PANTS = [[0.855, 0.1, 0.07, 0.078, 0.012], [0.885, 0.15, 0.092, 0.108, 0.01], [0.93, 0.163, 0.1, 0.114, 0.006], [0.98, 0.16, 0.098, 0.112, 0.002], [1.02, 0.15, 0.096, 0.104, 0.0], [1.06, 0.146, 0.096, 0.1, 0.0]]; // (fessiers en arrière, taille qui se resserre)
  torsoRing(PANTS, 0.855, 1.06, 0.62, { cap0: 0.03 });
  // ---- torse (veste) : taille, côtes, poitrine, épaules, trapèzes jusqu'à la base du cou
  // taille fine, dorsaux et poitrine plus larges (en V), haut du torse jusqu'à l'articulation de l'épaule (SD.shX) : la manche en part ;
  // trapèzes en pente douce du cou au deltoïde (le torse ne montait qu'à 1,39 m à l'aplomb de l'épaule, sous le haut du deltoïde à 1,47 m :
  // l'épaule faisait une boule à côté du cou, surtout bras levés)
  torsoRing(SOLDIER_SHIRT, 1.0, 1.485, 0.0, { bump: (a, k) => 0.0015 * Math.sin(a * 4 + k * 1.7) });
  // col de la veste
  skinLoft(B, [1.44, 1.47, 1.495].map((y, i) => ({ c: new V3(0, y, 0.004), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [0.071 - i * 0.004, 0.071 - i * 0.004, 0.064 - i * 0.003, 0.07 - i * 0.003], n: 2.2, v: y })), Math.round(24 * rs) + 4,
    { wp: (p) => torsoW(p), uv: (u, v) => atlasUV('camo', 0.1 + u * 0.6, 0.66 + (v - 1.44) * 2), col: () => new THREE.Color(0.85, 0.85, 0.85) });
  mark('torse');
  // ---- bras (manches) : deltoïde, biceps, coude, avant-bras, jusqu'au gant
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), rnd = mulberry32(sx > 0 ? 31 : 32), ph = [rnd() * 6, rnd() * 6, rnd() * 6], ant = -sx; // côté antérieur : x local * ant
    // deltoïde en dôme au-dessus de l'articulation (un tube coupé net à pleine largeur ressortait en pointe carrée au-dessus de l'épaule
    // quand le bras se lève), biceps, coude, avant-bras
    const prof = [[-0.085, 0.02], [-0.075, 0.04], [-0.06, 0.053], [-0.04, 0.061], [-0.01, 0.065], [0.04, 0.06], [0.09, 0.054], [0.14, 0.053], [0.2, 0.05], [0.25, 0.045], [SD.ua, 0.044], [0.33, 0.048], [0.37, 0.047], [0.42, 0.042], [0.47, 0.037], [0.505, 0.034], [0.53, 0.033]];
    skinSweep(B, [{ M: M[b.ua], L: SD.ua }, { M: M[b.fa], L: SD.fa }], [0.04], AX, X, Y, prof.map(([d, r]) => ({ d, r: [r * 1.02, r * 1.02, r, r * 0.96], n: 2.1 })), Math.round(18 * rs) + 2, {
      a0: Math.PI / 2, cap0: 0.012, // (dôme fermé : son bout ouvert faisait un trou sur le haut de l'épaule, au-dessus des trapèzes)
      w: armW(b),
      bump: (a, k, s) => {
        const d = s.v, fr = Math.cos(a) * ant, lat = Math.sin(a);
        let v = 0.011 * Math.exp(-(((d - 0.01) / 0.055) ** 2)) * Math.pow(Math.max(0, lat), 0.7) + 0.0018 * Math.sin(a * 3 + d * 20 + ph[0]);
        v += 0.004 * Math.exp(-(((d - SD.ua) / 0.025) ** 2)) * Math.pow(Math.max(0, -fr), 3);
        v += 0.003 * Math.sin((d - SD.ua) * 160 + ph[1]) * Math.exp(-(((d - SD.ua) / 0.04) ** 2)) * Math.max(0, fr);
        return v;
      },
      uv: (u, v) => atlasUV('camo', 0.45 + u * 0.52, (v + 0.1) / 0.7),
    });
    // gant : manchette et sangle, puis la main (doigts refermés, figés : poignée pour la droite, garde-main pour la gauche)
    const G = P.glove, dW = SD.ua + SD.fa;
    skinSweep(B, [{ M: M[b.ua], L: SD.ua }, { M: M[b.fa], L: SD.fa }], [0.04], AX, X, Y, [[dW - 0.05, 0.036], [dW - 0.044, 0.0375], [dW - 0.03, 0.0355], [dW - 0.015, 0.0325], [dW + 0.005, 0.03]].map(([d, r]) => ({ d, r: [r * 1.05, r * 1.05, r * 0.92, r * 0.95], n: 2.3 })), Math.round(14 * rs) + 2, {
      w: (d) => armW(b, clamp((d - dW + 0.02) / 0.03, 0, 1) * 0.6)(d), col: (a, k) => (k === 1 || k === 2 ? G.clone().multiplyScalar(0.6) : G),
      uv: (u, v) => atlasUV('glove', u * 0.6 + 0.2, (v - dW + 0.06) / 0.14),
    });
    // main droite : sur la poignée ; main gauche : sous le garde-main et autour d'une poignée d'appui (deux formes, voir SB.HLS)
    const hm = M[b.ha], nm = new THREE.Matrix3().getNormalMatrix(hm), t = new V3(), tc = new THREE.Color();
    for (const [pose, bone] of sx > 0 ? [['trigger', b.ha]] : [[SOLDIER_LPOSE, SB.HLS], [SOLDIER_LGRIP, SB.HLG]]) {
      const hb = handBaked(-sx, pose, hi ? 'lo' : 'xlo'), v0 = B.count;
      B.begin();
      for (let k = 0; k < hb.p.length / 3; k++) {
        t.fromArray(hb.p, k * 3).applyMatrix4(hm); tc.fromArray(hb.c, k * 3).multiply(G);
        B.vert(t.x, t.y, t.z, hb.uv[k * 2], hb.uv[k * 2 + 1], tc, bone);
        t.fromArray(hb.n, k * 3).applyMatrix3(nm).normalize(); B.n[(v0 + k) * 3] = t.x; B.n[(v0 + k) * 3 + 1] = t.y; B.n[(v0 + k) * 3 + 2] = t.z;
      }
      for (let k = 0; k < hb.idx.length; k++) B.idx.push(hb.idx[k] + v0);
    }
  }
  mark('bras-mains');
  // ---- cou et tête
  const hm = M[SB.HEA], hp = J[J_HEAD], face = !!Pp.face, KNIT = P.knit, EYES = P.knit.clone().multiplyScalar(0.3);
  const neckW = (p) => { const d = p.clone().sub(J[J_CHE]).dot(_wv.subVectors(hp, J[J_CHE]).normalize()); return chainW(d, [{ s: 0.03, h: 0.03, a: SB.CHE, b: SB.NEC }, { s: 0.115, h: 0.04, a: SB.NEC, b: SB.HEA }]); };
  const ncs = []; for (let i = 0; i <= 5; i++) { const t = i / 5; ncs.push({ c: new V3().lerpVectors(J[J_CHE], hp, lerp(-0.1, 0.55, t)).add(new V3(0, 0, 0.012 * t)), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [0.063 - t * 0.006, 0.063 - t * 0.006, 0.054, 0.06], n: 2, v: t }); }
  skinLoft(B, ncs, Math.round(18 * rs) + 2, { wp: (p) => neckW(p), col: () => (face ? WH : KNIT), uv: (u, v) => (face ? atlasUV('face', u, 0.72 + v * 0.25) : atlasUV('glove', u * 0.7, v * 0.4)) });
  const nth = hi ? 30 : 10, nph = hi ? 44 : 12, hv = new V3();
  // plus de sommets sur le visage (nez, bouche, menton) que derrière la tête
  const phOf = (u) => { const t = 2 * u - 1; return Math.PI * Math.sign(t) * Math.pow(Math.abs(t), hi ? 1.55 : 1); };
  const thOf = (v) => (hi ? Math.PI * 0.93 * (v + 0.09 * Math.sin(v * TAU)) : v * Math.PI * 0.93);
  skinSurf(B, nph, nth, (u, v, o) => {
    const th = thOf(v), ph = phOf(u);
    headPt(th, ph, hv).applyMatrix4(hm);
    o.x = hv.x; o.y = hv.y; o.z = hv.z;
    o.w = th > 2.2 ? [[SB.HEA, 0.8], [SB.NEC, 0.2]] : SB.HEA;
    // sans lunettes (ghillie) : l'ouverture des yeux de la cagoule, dans l'ombre
    o.col = face ? WH : Pp.glasses === false && Math.abs(ph) < 0.75 && th > 1.32 && th < 1.6 ? EYES : KNIT;
    const uv = face ? atlasUV('face', 0.5 + ph / TAU, th / Math.PI) : atlasUV('glove', 0.5 + ph / TAU * 0.7, th / Math.PI * 0.5); o.U = uv[0]; o.V = uv[1];
  }, { out: true });
}
/* Rangers montantes (23 cm) : le pantalon est rentré dans la tige et bouffe par-dessus le col rembourré. Avant-pied
   à bout renforcé, laçage du cou-de-pied au haut de la tige, semelle épaisse à talon et cambrure, qui déborde de l'empeigne.
   Pointure 44 : 31 cm de long, 11,5 cm de large. Repère du pied : origine à la cheville, -z vers la pointe, sol à y = -0,075. */
function soldierBoots(B, skin, hi) {
  const R = soldierRest(), M = R.mats, P = skinGear(skin);
  const BOOT = P.boot, SOLE = P.sole, LACE = P.boot.clone().multiplyScalar(0.5), TOE = P.boot.clone().multiplyScalar(0.8), COLLAR = P.boot.clone().multiplyScalar(0.7);
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), fm = M[b.ft], fi = fm.clone().invert(), X = new V3(1, 0, 0).transformDirection(fm);
    const toW = (z) => { const t = smoothstep(-0.095, -0.145, z); return t <= 0 ? b.ft : t >= 1 ? b.to : [[b.ft, 1 - t], [b.to, t]]; };
    const loc = (p) => p.clone().applyMatrix4(fi);
    // empeigne : [z, demi-largeur, haut, bas] ; le bas repose sur la semelle (y = -0,052)
    const S = [[0.078, 0.035, -0.005, -0.055], [0.06, 0.045, 0.02, -0.057], [0.03, 0.05, 0.034, -0.057], [0.0, 0.051, 0.032, -0.057], [-0.035, 0.053, 0.016, -0.057],
      [-0.07, 0.055, 0.0, -0.057], [-0.105, 0.057, -0.013, -0.057], [-0.14, 0.056, -0.019, -0.057], [-0.17, 0.051, -0.023, -0.057], [-0.195, 0.041, -0.027, -0.056], [-0.21, 0.027, -0.033, -0.055]];
    const lace = (z) => z < 0.0 && z > -0.085;
    skinLoft(B, S.map(([z, w, t, d]) => ({ c: new V3(0, (t + d) / 2, z).applyMatrix4(fm), X: X.clone(), Y: new V3(0, 1, 0).transformDirection(fm), r: [w, w, (t - d) / 2, (t - d) / 2], n: 2.6, z, v: z })), hi ? 16 : 6, {
      cap0: 0.01, cap1: 0.011,
      wp: (p) => toW(loc(p).z),
      // languette sur le cou-de-pied (sous les lacets), surpiqûre du bout renforcé
      bump: (a, k, s) => (lace(s.z) ? 0.0015 * Math.max(0, Math.sin(a)) ** 8 : 0) + (Math.abs(s.z + 0.15) < 0.004 ? 0.0012 : 0),
      col: (a, k, p, s) => (lace(s.z) && Math.sin(a) > 0.92 ? LACE : s.z < -0.15 ? TOE : BOOT),
      uv: (u, v, s, px, py) => atlasUV('leath', 0.5 + px / 0.2, (s.z + 0.22) / 0.32),
    });
    // tige : de la cheville au col, aussi large que la jambe de pantalon qu'elle contient ; elle suit la jambe en haut et
    // le pied en bas (la botte plie à la cheville) ; col rembourré, languette et laçage sur le devant
    const shS = []; for (let i = 0; i <= 8; i++) { const y = -0.035 + i * 0.0225; shS.push({ y, w: 0.05 + 0.004 * smoothstep(-0.035, 0.1, y), f: 0.055 - 0.003 * smoothstep(0.0, 0.1, y), bk: 0.053, z: 0.012 - 0.01 * smoothstep(-0.035, 0.145, y) }); }
    const top = shS[shS.length - 1].y, shW = (p) => { const t = smoothstep(0.0, 0.08, loc(p).y); return t <= 0 ? b.ft : t >= 1 ? b.sh : [[b.ft, 1 - t], [b.sh, t]]; };
    skinLoft(B, shS.map((s) => ({ c: new V3(0, s.y, s.z).applyMatrix4(fm), X: X.clone(), Y: new V3(0, 0, -1).transformDirection(fm), r: [s.w, s.w, s.f, s.bk], n: 2.2, y: s.y, v: s.y })), hi ? 16 : 6, {
      wp: shW,
      // col rembourré (bourrelet), languette plus sombre sur le devant, creux des malléoles
      bump: (a, k, s) => 0.006 * smoothstep(top - 0.028, top, s.y) + 0.0015 * Math.max(0, Math.sin(a)) ** 8 * (s.y < top - 0.02 ? 1 : 0) - 0.0012 * Math.max(0, Math.cos(a * 2)) * smoothstep(0.02, -0.02, s.y),
      col: (a, k, p, s) => (s.y > top - 0.014 ? COLLAR : Math.sin(a) > 0.92 && s.y < top - 0.02 ? LACE : BOOT),
      uv: (u, v, s, px, py) => atlasUV('leath', u * 0.9, (s.y + 0.05) / 0.3 + 0.35),
    });
    // lacets croisés, du cou-de-pied au haut de la tige (deux zigzags décalés qui se croisent sur la languette)
    if (hi) {
      const instep = (z) => { for (let i = 0; i < S.length - 1; i++) if (z <= S[i][0] && z >= S[i + 1][0]) return S[i][2] + (S[i + 1][2] - S[i][2]) * (S[i][0] - z) / (S[i][0] - S[i + 1][0]); return 0; };
      const front = (y) => { const t = smoothstep(-0.035, 0.145, y); return 0.012 - 0.01 * t - (0.055 - 0.003 * smoothstep(0.0, 0.1, y)); };
      for (const zig of [0, 1]) {
        const pts = [];
        for (let i = 0; i <= 11; i++) {
          const xs = ((i + zig) % 2 ? 1 : -1) * 0.013;
          if (i < 4) { const z = -0.075 + i * 0.022; pts.push(new V3(xs, instep(z) + 0.0045, z)); }
          else { const y = 0.012 + (i - 4) * (top - 0.035) / 7; pts.push(new V3(xs, y, front(y) - 0.0035)); }
        }
        gBand(B, pts.map((p) => p.applyMatrix4(fm)), 0.0045, 0.003, (p) => (loc(p).y < 0.008 ? new V3(0, 1, 0) : new V3(0, 0.25, -1)).transformDirection(fm), shW, LACE, null, 3);
      }
    }
    // semelle : plus large que l'empeigne, talon marqué, cambrure relevée sous la voûte, crampons sur la tranche
    const SS = [[0.088, 0.037], [0.065, 0.049], [0.03, 0.053], [-0.01, 0.052], [-0.05, 0.056], [-0.09, 0.06], [-0.13, 0.061], [-0.165, 0.057], [-0.198, 0.046], [-0.218, 0.031]];
    const arch = (z) => smoothstep(0.03, 0.005, z) * smoothstep(-0.075, -0.045, z);
    skinLoft(B, SS.map(([z, w]) => ({ c: new V3(0, -0.0635 + 0.004 * arch(z), z).applyMatrix4(fm), X: X.clone(), Y: new V3(0, 1, 0).transformDirection(fm), r: [w, w, 0.0115, 0.0115 - 0.008 * arch(z)], n: 5, z, v: z })), hi ? 12 : 6, {
      cap0: 0.007, cap1: 0.009,
      wp: (p) => toW(loc(p).z),
      bump: (a, k, s) => (Math.abs(Math.sin(a)) < 0.4 ? 0.0012 * Math.max(0, Math.sin(s.z * 260)) : 0),
      col: () => SOLE, uv: (u, v, s, px) => atlasUV('misc', 0.5 + px / 0.12, (s.z + 0.22) / 0.32),
    });
  }
}
/* Occlusion de contact cuite dans le modèle au repos (attribut aoc : part de la lumière indirecte qui n'arrive pas, de 0 à 1). Le gilet,
   les poches, les sangles, le casque et le col assombrissent le tissu qu'ils touchent, au lieu de paraître posés dessus. Une fois par
   tenue et par niveau de détail : le maillage est rangé dans une grille de cases de 7,5 mm, puis chaque sommet lance douze rayons dans
   l'hémisphère de sa normale, sur 10 cm. Courte portée voulue : c'est l'occlusion des pièces posées les unes sur les autres, qui ne
   bougent pas entre elles, pas celle des membres (ils bougent ; l'occlusion à l'écran s'en charge quand elle est active).
   Le calcul (45 à 70 ms par modèle détaillé, 15 à 25 ms par modèle allégé, sur un PC) se fait dans un Worker, tenue après tenue : le
   démarrage n'attend pas, l'attribut naît à zéro (aucune occlusion) et reçoit son résultat quelques centaines de millisecondes plus tard.
   Sans Worker, le calcul se fait sur place, une tenue par tâche. Lue par la matière des soldats (skAoPatch, 06e-gear.js) ; un maillage
   sans cet attribut (tissu simulé) en porte un nul. */
const SOLDIER_AO_DIRS = (() => { const D = [], K = 12; for (let i = 0; i < K; i++) { const u = (i + 0.5) / K, a = i * 2.39996, r = Math.sqrt(u); D.push(r * Math.cos(a), r * Math.sin(a), Math.sqrt(1 - u)); } return D; })();
const SOLDIER_AO = { q: [], busy: false, wk: null, url: null };
/* Noyau autonome (copié tel quel dans le Worker : aucune référence extérieure) : J = { P, N, I, D } (positions, normales, indices,
   directions des rayons dans le repère de la normale) ; renvoie l'occlusion de chaque sommet */
function soldierAoKernel(J) {
  const P = J.P, Nr = J.N, I = J.I, D = J.D, nv = P.length / 3, c = 0.0075, L = 0.1, M = L + 4 * c;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let i = 0; i < nv * 3; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  x0 -= M; y0 -= M; z0 -= M;
  const nx = Math.ceil((x1 - x0 + M) / c) + 1, ny = Math.ceil((y1 - y0 + M) / c) + 1, nz = Math.ceil((z1 - z0 + M) / c) + 1, G = new Uint8Array(nx * ny * nz);
  // les triangles, semés de points tous les demi-côtés de case
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    const e2 = Math.max((P[b] - P[a]) ** 2 + (P[b + 1] - P[a + 1]) ** 2 + (P[b + 2] - P[a + 2]) ** 2, (P[d] - P[a]) ** 2 + (P[d + 1] - P[a + 1]) ** 2 + (P[d + 2] - P[a + 2]) ** 2, (P[d] - P[b]) ** 2 + (P[d + 1] - P[b + 1]) ** 2 + (P[d + 2] - P[b + 2]) ** 2);
    const s = Math.max(1, Math.ceil(Math.sqrt(e2) / (c * 0.5)));
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
      const u = i / s, v = j / s, w = 1 - u - v;
      const x = P[a] * w + P[b] * u + P[d] * v, y = P[a + 1] * w + P[b + 1] * u + P[d + 1] * v, z = P[a + 2] * w + P[b + 2] * u + P[d + 2] * v;
      G[(((y - y0) / c | 0) * nz + ((z - z0) / c | 0)) * nx + ((x - x0) / c | 0)] = 1;
    }
  }
  const ao = new Float32Array(nv), K = D.length / 3, st = c * 0.75, ns = Math.round(L / st);
  for (let i = 0; i < nv; i++) {
    const qx = Nr[i * 3], qy = Nr[i * 3 + 1], qz = Nr[i * 3 + 2];
    // repère de la normale : tangente t (normale × axe le moins aligné), bitangente normale × t
    let tx = -qz, ty = 0, tz = qx;
    if (Math.abs(qy) > 0.9) { tx = 0; ty = qz; tz = -qy; }
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const bx = qy * tz - qz * ty, by = qz * tx - qx * tz, bz = qx * ty - qy * tx;
    let hit = 0;
    for (let k = 0; k < K; k++) {
      const a = D[k * 3], b = D[k * 3 + 1], h = D[k * 3 + 2];
      const dx = (tx * a + bx * b + qx * h) * st, dy = (ty * a + by * b + qy * h) * st, dz = (tz * a + bz * b + qz * h) * st;
      let x = P[i * 3] + qx * c * 1.5 - x0, y = P[i * 3 + 1] + qy * c * 1.5 - y0, z = P[i * 3 + 2] + qz * c * 1.5 - z0;
      for (let s = 0; s < ns; s++) {
        x += dx; y += dy; z += dz;
        if (G[((y / c | 0) * nz + (z / c | 0)) * nx + (x / c | 0)]) { hit++; break; }
      }
    }
    ao[i] = hit / K;
  }
  return ao;
}
/* Pose l'attribut (nul) et met le calcul en file */
function soldierBakeAO(geo) {
  const A = new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1);
  geo.setAttribute('aoc', A);
  SOLDIER_AO.q.push({ A, J: { P: geo.attributes.position.array, N: geo.attributes.normal.array, I: geo.index.array, D: SOLDIER_AO_DIRS } });
  soldierAoNext();
}
function soldierAoNext() {
  const S = SOLDIER_AO;
  if (S.busy || !S.q.length) return;
  const { A, J } = S.q.shift(), done = (ao) => { A.array.set(ao); A.needsUpdate = true; S.busy = false; soldierAoNext(); };
  S.busy = true;
  const inPlace = () => setTimeout(() => done(soldierAoKernel(J)), 0); // sans Worker : sur place, une tenue par tâche
  try {
    if (!S.wk) {
      S.url = URL.createObjectURL(new Blob([`self.onmessage = function (e) { const r = (${soldierAoKernel.toString()})(e.data); self.postMessage(r, [r.buffer]); };`], { type: 'text/javascript' }));
      S.wk = new Worker(S.url);
    }
    const wk = S.wk, end = () => { if (!S.busy && S.wk === wk) { wk.terminate(); URL.revokeObjectURL(S.url); S.wk = null; } }; // file vide : le Worker s'en va
    wk.onmessage = (e) => { done(e.data); end(); };
    wk.onerror = () => { wk.terminate(); S.wk = null; inPlace(); };
    wk.postMessage(J);
  } catch (e) { S.wk = null; inPlace(); }
}
/* Géométrie complète d'un soldat (partagée par tenue et niveau de détail) */
const SOLDIER_GEOS = {};
function soldierGeometry(skin, lod) {
  const key = skin + lod;
  if (SOLDIER_GEOS[key]) return SOLDIER_GEOS[key];
  const B = new SkinBuilder(), hi = lod === 'hi', st = [], Pp = SKINS[skin].parts; GEAR_HI = hi;
  const mark = (n) => { st.push(n + ':' + (B.idx.length / 3 - st.reduce((a, x) => a + (+x.split(':')[1] || 0), 0))); };
  soldierBase(B, skin, hi, mark); mark('fin-base');
  soldierBoots(B, skin, hi); mark('bottes');
  soldierVest(B, skin, hi); mark('gilet');
  if (Pp.helmet) soldierHelmet(B, skin, hi);
  if (Pp.glasses !== false) soldierGlasses(B, skin, hi);
  if (Pp.mask) skinMask(B, skin, hi);
  if (Pp.nvg) skinNvg(B, skin, hi);
  mark('casque');
  if (Pp.hood) skinHood(B, skin, hi);
  if (Pp.poncho) skinPoncho(B, skin, hi);
  if (Pp.pouches === 'shells') skinShells(B, skin, hi);
  if (SKINS[skin].model) SKINS[skin].model(B, skin, hi); // pièces propres des tenues de défi (06gc-tenues-defi.js)
  if (Pp.patch !== false) skinPatch(B, skin, hi);
  if (Pp.ghillie) skinGhillie(B, skin, hi); // après tout ce qui porte de la toile camouflée (feuilles accrochées à ses sommets)
  if (!hi && SKINS[skin].cloth && !Pp.poncho) clothStaticInto(B, clothTpl(skin), 2); // tissu simulé, figé dans le modèle allégé (06gb-tissu.js)
  mark('tenue');
  skinTags(B, skin, hi); mark('bandes');
  SOLDIER_GEOS['stats' + key] = st;
  const geo = B.build();
  soldierBakeAO(geo);
  // les sommets sont exprimés au repos : sphère englobante autour du bassin (le maillage est rangé dans l'os du bassin)
  geo.boundingSphere = new THREE.Sphere(new V3(0, 0.1, 0), 1.35);
  geo.userData.shared = true;
  return (SOLDIER_GEOS[key] = geo);
}
/* Matière d'une tenue vue par un allié (rel 0 : teinte claire, bandes vertes) ou par un ennemi (rel 1 : teinte sombre,
   bandes rouges) ; partagée, un seul programme pour toutes (seules ses valeurs changent) */
const SOLDIER_MATS = {};
function soldierMaterial(skin, rel) {
  const k = skin + rel; if (SOLDIER_MATS[k]) return SOLDIER_MATS[k];
  const m = gearMaterial(skin, 'tp');
  skinTone(skin, rel, m.color); skinRelColor(rel, m.userData.skU.tag.value);
  return (SOLDIER_MATS[k] = csmMaterial(m)); // ombres en cascade : setupShadows reprend celles créées avant lui (soldierMatsCsm)
}
/* Matières créées avant les ombres en cascade et pas encore dans la scène (une tenue qu'aucun soldat ne porte au démarrage) */
function soldierMatsCsm() { for (const k in SOLDIER_MATS) csmMaterial(SOLDIER_MATS[k]); }
/* Tout ce qui sert aux soldats, construit au démarrage (rien de lourd en pleine partie) : géométries des quatre tenues aux deux
   niveaux de détail, textures, matières vues par un allié et par un ennemi */
function soldierPrebuild() { for (const s of SKIN_IDS) { soldierGeometry(s, 'hi'); soldierGeometry(s, 'lo'); soldierMaterial(s, 0); soldierMaterial(s, 1); } }
/* skin : tenue (SKINS) ; rel : relation au joueur (0 allié, 1 ennemi) */
/* État d'animation d'un soldat (poseSoldier, 06b-soldier.js ; boucle de saut et de coup reçu, 06ac-loco.js ; glissade, pieds plantés, tenue Brèche) :
   déclaré d'emblée, dans un ordre fixe, pour que tous les modèles aient la même forme d'objet. Ces champs naissaient à la première pose ou au premier
   tir reçu, du saut, de la glissade, dans un ordre différent selon le soldat : douze soldats finissaient avec sept formes, et chaque appel de
   poseSoldier, updateBot ou layoutSoldier passait par des accès polymorphes, ou jetait son code optimisé (« wrong map », une quinzaine de fois
   mesurées). Les valeurs sont celles que le code lisait déjà quand le champ n'existait pas : -1 pour aT, hT et rT (testés par >= 0), et cyc reste
   undefined (c'est la marque d'un soldat jamais posé, 06b-soldier.js). Que des valeurs simples : l'objet est copié tel quel dans chaque modèle. */
const SOLDIER_STATE = {
  cloth: null, cyc: undefined, hipYaw: 0, aimW: 1, aimWV: 0, ld: 0, ldV: 0, wt: 0, wtV: 0, lk: 0, lkV: 0, lkp: 0, lkpV: 0, rg: 0, rgV: 0, hr: 0, hrV: 0, lean: 0, leanV: 0,
  sroll: 0, srollV: 0, blade: 0, bladeV: 0, twist: 0, twistV: 0, gby: 0, gbyV: 0, gbw: 0, gbwV: 0, rk: 0, rkV: 0, runW: 0, sprW: 0, airW: 0, lastYaw: 0, turn: 0, t: 0, lastV: 0,
  fy: null, fyG: null, amp: 0, wasAir: false, gyL: 0, gyR: 0, aT: -1, airVy: 0, ampV: 0, wtClk: 0, wtT: 0, lkClk: 0, lkT: 0, lkP: 0, slT: 0, slOn: false, plant: null,
  stepSh: 0, stepDip: 0, plantOn: false, stepCd: 0, headQ: null, pdt: 0, lth: 0, hitKick: 0, hitHead: false, hitDir: null, hT: -1, hK: 0, hA: 0, relAt: 0, jmp: false, rT: -1, rK: 0,
};
function makeSoldier(skin, rel, weaponKey, opts = {}) {
  const R = soldierRest(), root = new THREE.Group(); scene.add(root);
  if (opts.shadowOnly) root.userData.noAO = true;
  const bones = []; for (let i = 0; i < SOLDIER_NB; i++) { const b = new THREE.Object3D(); b.position.setFromMatrixPosition(R.mats[i]); b.quaternion.copy(R.q[i]); root.add(b); bones.push(b); }
  const skel = new THREE.Skeleton(bones, R.mats.map((m) => m.clone().invert()));
  const mat = opts.shadowOnly ? SHADOW_ONLY_MAT : soldierMaterial(skin, rel), L = { hi: null, lo: null, mat, hiOn: null, skin, rel };
  const addSkin = (geo) => { const m = new THREE.SkinnedMesh(geo, mat); m.bind(skel, _RIG_ID); m.customDepthMaterial = SKIN_DEPTH_MAT; m.userData.noPrepass = true; m.castShadow = true; m.receiveShadow = !opts.shadowOnly; bones[SB.PEL].add(m); return m; };
  if (opts.shadowOnly) { L.lo = addSkin(soldierGeometry(skin, 'lo')); L.lo.layers.mask = MASK_SHADOW; }
  else { L.hi = addSkin(soldierGeometry(skin, 'hi')); L.hi.castShadow = false; L.lo = addSkin(soldierGeometry(skin, 'lo')); setSoldierLod({ lod: L }, false); }
  const model = { root, bones, P: { pelvis: bones[SB.PEL] }, J: [], Jp: [], phase: Math.random() * TAU, flinch: 0, rag: null, sink: 0, shadowOnly: !!opts.shadowOnly, lod: L, lastN: R.lastN.map((v) => v.clone()), fp: [0, 0], ...SOLDIER_STATE };
  for (let i = 0; i < 15; i++) { model.J.push(R.J[i].clone()); model.Jp.push(R.J[i].clone()); }
  setSoldierGun(model, weaponKey);
  clothSync(model, skin, mat); // poncho de la tenue Brèche : tissu simulé (06gb-tissu.js)
  return model;
}
/* Change la tenue d'un soldat déjà construit, ou sa relation au joueur (géométries et matières partagées, rien n'est
   reconstruit) ; un modèle d'ombre seule garde sa matière d'ombre */
function soldierLook(S, skin, rel) {
  const L = S && S.lod; if (!L || (L.skin === skin && L.rel === rel)) return;
  const geo = L.skin !== skin; L.skin = skin; L.rel = rel;
  if (!S.shadowOnly) L.mat = soldierMaterial(skin, rel);
  for (const k of ['hi', 'lo']) if (L[k]) { if (geo) L[k].geometry = soldierGeometry(skin, k); L[k].material = L.mat; }
  clothSync(S, skin, L.mat);
}
/* Main gauche des soldats, figée (les doigts ne se referment pas sur l'arme) : sous un garde-main, autour d'une poignée d'appui ;
   poses tirées de la prise procédurale de la vue subjective (06f-hands.js) */
const SOLDIER_LPOSE = 'tsup', SOLDIER_LGRIP = 'tgrip';
/* Prises des mains dans le repère de l'arme, pour un soldat : main droite sur la poignée, main gauche sous le garde-main, autour
   de la poignée d'appui ou sur la main droite (pistolet). Repères de main de la vue subjective (lHandFrame : celui de l'arme montée) */
function soldierHandFrames(S) {
  const pistol = S.kind === 'pistol';
  return [(S.grips && S.grips.LF) || HAND_FRAMES[pistol ? 'Lp' : 'L'], HAND_FRAMES[pistol ? 'Rp' : 'R']];
}
const _lo = { J: [], fwd: new V3(), hq: [new THREE.Quaternion(), new THREE.Quaternion()], hp: [new V3(), new V3()], w: new V3(), v: new V3(), r2: new V3(), o: new V3(), a: new V3(), b: new V3(), c: new V3(), g: new V3(), q: new THREE.Quaternion(), r: new THREE.Quaternion() };
for (let i = 0; i < 15; i++) _lo.J.push(new V3());
/* Place les os d'un soldat d'après ses articulations (et son arme s'il est vivant) */
function layoutSoldier(S, alive) {
  const J = _lo.J, sink = S.sink || 0;
  for (let i = 0; i < 15; i++) { J[i].copy(S.J[i]); J[i].y -= sink; }
  const R = soldierRest();
  _lo.fwd.subVectors(J[J_HIR], J[J_HIL]); _lo.fwd.set(_lo.fwd.z, 0, -_lo.fwd.x); if (_lo.fwd.lengthSq() < 1e-6) _lo.fwd.set(0, 0, -1); _lo.fwd.normalize();
  // mains : posées sur l'arme tant que le poignet est au rendez-vous (sinon, rechargement ou ragdoll : dans l'axe de l'avant-bras)
  let handQ = null;
  if (alive && S.gun && S.gun.visible !== false) {
    const F = soldierHandFrames(S);
    handQ = _lo.hq;
    for (let k = 0; k < 2; k++) {
      const f = F[k], grip = k ? S.grips.R : S.grips.L, jw = J[k ? J_HAR : J_HAL];
      _lo.q.copy(S.gun.quaternion).multiply(f.q);
      _lo.g.copy(grip).applyQuaternion(S.gun.quaternion).add(S.gun.position); _lo.g.y -= sink;
      _lo.o.copy(f.off); _lo.w.set(0, 0, WRIST_OFF).sub(_lo.o).applyQuaternion(_lo.q);
      // main gauche qui a pu reculer le long du garde-main (bras trop court, poseSoldier) : recul retrouvé d'après le poignet, et
      // hauteur de la paume à cet endroit
      let sl = 0;
      if (!k && S.grips.slide) {
        _lo.v.set(0, 0, 1).applyQuaternion(S.gun.quaternion);
        sl = clamp(_lo.r2.subVectors(jw, _lo.g).sub(_lo.w).dot(_lo.v), 0, S.grips.slide);
        _lo.g.addScaledVector(_lo.v, sl); _lo.o.y = -soldierLift(S.grips, sl); _lo.w.set(0, 0, WRIST_OFF).sub(_lo.o).applyQuaternion(_lo.q);
      }
      _lo.v.subVectors(jw, _lo.g);
      if (Math.abs(_lo.v.length() - _lo.w.length()) > 0.03) { handQ[k] = null; continue; }
      if (!k && f.axis && S.kind !== 'pistol') {
        // main gauche qui a roulé autour de sa prise (armToGripRoll) : roulis retrouvé d'après le poignet (angle autour de l'axe de
        // roulis entre le poignet attendu et le poignet atteint), puis hauteur de la paume pour ce roulis
        _lo.a.copy(f.axis).applyQuaternion(_lo.q);
        let phi = 0;
        for (let it = 0; it < 2; it++) {
          _lo.o.y = -soldierLift(S.grips, sl, phi); _lo.w.set(0, 0, WRIST_OFF).sub(_lo.o).applyQuaternion(_lo.q);
          _lo.r2.copy(_lo.w).addScaledVector(_lo.a, -_lo.w.dot(_lo.a)); _lo.b.copy(_lo.v).addScaledVector(_lo.a, -_lo.v.dot(_lo.a));
          const lim = Math.min(f.range, SOLDIER_ROLL); phi = clamp(Math.atan2(_lo.c.crossVectors(_lo.r2, _lo.b).dot(_lo.a), _lo.r2.dot(_lo.b)), -lim, lim);
        }
        _lo.r.setFromAxisAngle(_lo.a, phi);
        if (_lo.w.applyQuaternion(_lo.r).normalize().dot(_lo.b.copy(_lo.v).normalize()) < 0.4) { handQ[k] = null; continue; } // main loin de sa prise (rechargement)
      } else {
        // la main a pu pivoter un peu sur la prise pour garder le poignet droit (armToGrip) : on retrouve ce pivot à partir
        // du poignet réellement atteint (vaut aussi pour la killcam, rejouée depuis les articulations)
        if (_lo.w.normalize().dot(_lo.v.normalize()) < 0.4) { handQ[k] = null; continue; } // main loin de sa prise (rechargement)
        _lo.r.setFromUnitVectors(_lo.w, _lo.v);
      }
      _lo.q.premultiply(_lo.r);
      _lo.hp[k].copy(_lo.o).applyQuaternion(_lo.q).negate().add(_lo.g);
      handQ[k] = _lo.hq[k] = _lo.hq[k] || new THREE.Quaternion(); handQ[k].copy(_lo.q);
    }
  }
  soldierFrames(J, S.bones, { rest: R.q, lastN: S.lastN, fwd: _lo.fwd, fp: alive ? S.fp : null, fy: alive ? S.fy : null, headQ: alive && S.headQ ? S.headQ : null, handQ, handP: _lo.hp,
    lGrip: !!(handQ && handQ[0] && S.grips && S.grips.LF && S.grips.LF.pose === 'fgrip') });
}
/* ---------- Équipement ---------- */
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _ge = new THREE.Euler(), _gs = new V3(1, 1, 1);
function gMat(x, y, z, rx = 0, ry = 0, rz = 0) { return new THREE.Matrix4().compose(new V3(x, y, z), _gq.setFromEuler(_ge.set(rx, ry, rz)), _gs); }
/* boîte arrondie, éventuellement cintrée (z += bend·x²) ; tile : nom de tuile, ou fonction (u, v) de coordonnées de texture */
let GEAR_HI = true; // niveau de détail en cours de construction (boîtes arrondies ou simples)
function gBox(B, w, h, d, r, m, wt, col, tile, bend = 0, segs = GEAR_HI ? 1 : 0) {
  const g = segs ? new THREE.RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d, bend ? 4 : 1, 1, 1);
  if (bend) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) + bend * P.getX(i) ** 2); g.computeVertexNormals(); }
  B.geo(g, m, wt, col, typeof tile === 'function' ? tile : () => GEAR_TILE[tile]);
}
function gCyl(B, r0, r1, h, seg, m, wt, col, tile) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, false);
  B.geo(g, m, wt, col, () => GEAR_TILE[tile]);
}
/* bande (sangle) le long d'un chemin : largeur w, épaisseur t ; out(p) donne le côté extérieur */
function gBand(B, pts, w, t, out, wt, col, uv, seg = 8) {
  const n = pts.length, S = pts.map((p, i) => {
    const T = new V3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    const Y = out(p).clone(); Y.addScaledVector(T, -Y.dot(T)).normalize();
    const X = new V3().crossVectors(Y, T);
    return { c: p, X, Y, r: [w / 2, w / 2, t / 2, t / 2], n: 5, v: i / (n - 1) };
  });
  skinLoft(B, S, seg, { wp: typeof wt === 'function' ? wt : () => wt, col: () => col, uv: uv || (() => GEAR_TILE.nyl), cap0: t * 0.4, cap1: t * 0.4 });
}
/* Gilet porte-plaques, poches (selon la tenue), radio, ceinturon, étui de cuisse, genouillères */
function soldierVest(B, skin, hi) {
  const R = soldierRest(), M = R.mats, P = skinGear(skin), Pp = SKINS[skin].parts, C = (h) => new THREE.Color(h);
  const VEST = P.vest, POUCH = P.pouch, DARK = P.poly, BELT = P.belt, MET = C(0x3a3b3c), WH = C(0xffffff);
  const web = (u, v) => atlasUV('web', u, v), CH = SB.CHE;
  // sans porte-plaques (parts.carrier === false, le Gilet jaune et son gilet de haute visibilité) : ceinturon, étui de cuisse et genouillères seuls
  if (Pp.carrier !== false) {
    // plaques avant et arrière : sacs à plaque cintrés, légèrement inclinés (ils touchent la poitrine, pas le ventre)
    gBox(B, 0.275, 0.33, 0.036, 0.012, gMat(0, 1.235, -0.146, 0.12), CH, VEST, web, 1.0, hi ? 2 : 0);
    gBox(B, 0.285, 0.35, 0.034, 0.012, gMat(0, 1.245, 0.12, -0.07), CH, VEST, web, -0.9, hi ? 2 : 0);
    // ceinture de gilet (cummerbund) : bande MOLLE tout autour du ventre
    const cb = [[1.058, 0.15, 0.106, 0.112, 0], [1.07, 0.155, 0.112, 0.116, 0], [1.2, 0.172, 0.13, 0.12, -0.005], [1.212, 0.167, 0.124, 0.114, -0.005]]; // (s'évase de la taille à la poitrine)
    skinLoft(B, cb.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.6, v: y })), hi ? 36 : 14,
      { wp: (p) => torsoW(p), col: () => VEST, uv: (u, v) => web(u, (v - 1.05) / 0.25) });
    // bretelles rembourrées, de la plaque avant à la plaque arrière par-dessus les épaules (posées sur les trapèzes)
    for (const sx of [-1, 1]) {
      const pts = [[0.1, 1.39, -0.13], [0.108, 1.445, -0.09], [0.114, 1.488, -0.025], [0.112, 1.477, 0.064], [0.104, 1.415, 0.106]].map(([x, y, z]) => new V3(x * sx, y, z));
      gBand(B, pts, 0.058, 0.014, (p) => new V3(p.x * 0.3, p.y - 1.3, p.z).normalize(), (p) => torsoW(p), VEST, (u, v) => web(u * 0.3, v), hi ? 8 : 4);
    }
    // poches à chargeurs ouvertes (chargeurs visibles) et leur sangle élastique : trois de fusil (assaut), trois plus étroites et
    // plus hautes (pistolet-mitrailleur), deux (ghillie) ; la brèche porte ses cartouches à la place (skinShells)
    const PK = { ar: [[-0.074, 0, 0.074], 0.068, 0.11, 0.03, 0.05], smg: [[-0.06, 0, 0.06], 0.052, 0.125, 0.024, 0.06], sn: [[-0.04, 0.04], 0.068, 0.1, 0.03, 0.045] }[Pp.pouches];
    if (PK) for (const x of PK[0]) {
      gBox(B, PK[1], PK[2], 0.044, 0.008, gMat(x, 1.125 - (PK[2] - 0.11) / 2, -0.199, 0.12), CH, POUCH, web);
      gBox(B, PK[3], PK[4], 0.062, 0.006, gMat(x, 1.183, -0.2, 0.2), CH, DARK, 'poly');
      if (hi) gBox(B, PK[1] + 0.002, 0.01, 0.046, 0.003, gMat(x, 1.15, -0.201, 0.12), CH, DARK, 'rub');
    }
    // poche administrative et son écusson, à la couleur de reconnaissance (tuile « tag », comme les brassards)
    gBox(B, 0.165, 0.085, 0.024, 0.008, gMat(0, 1.33, -0.165, 0.12), CH, POUCH, web);
    if (hi) gBox(B, 0.05, 0.034, 0.004, 0.002, gMat(-0.045, 1.335, -0.178, 0.12), CH, WH, 'tag');
    // radio sur le flanc gauche et son antenne souple ; garrot sur la bretelle droite ; poche à grenade à droite. Sous une cape
    // (parts.cape), rien sur le flanc ni dans le dos : la toile simulée passerait au travers (ou, rendu physique, s'y accrocherait)
    if (!Pp.cape) {
      gBox(B, 0.05, 0.13, 0.07, 0.01, gMat(-0.195, 1.155, 0.03), CH, POUCH, 'nyl');
      gBox(B, 0.036, 0.04, 0.05, 0.006, gMat(-0.195, 1.235, 0.035), CH, DARK, 'poly');
    }
    if (hi && Pp.antenna) {
      const ant = [[-0.198, 1.25, 0.04], [-0.2, 1.36, 0.06], [-0.204, 1.48, 0.085], [-0.208, 1.58, 0.1]].map(([x, y, z]) => new V3(x, y, z));
      gBand(B, ant, 0.007, 0.007, () => new V3(-1, 0, 0), CH, DARK, () => GEAR_TILE.rub, 5);
    }
    if (hi) {
      gBox(B, 0.032, 0.095, 0.026, 0.006, gMat(0.104, 1.4, -0.118, 0.5), CH, C(0x1b1b1b), 'rub');
      gBox(B, 0.034, 0.018, 0.028, 0.004, gMat(0.104, 1.35, -0.138, 0.5), CH, C(0x8a1d16), 'rub');
    }
    gCyl(B, 0.028, 0.026, 0.09, hi ? 12 : 6, gMat(0.17, 1.12, -0.085), CH, POUCH, 'nyl');
    // sac d'hydratation et poignée de traînage dans le dos
    if (Pp.pack && !Pp.cape) gBox(B, 0.2, 0.29, 0.05, 0.02, gMat(0, 1.24, 0.16, -0.07), CH, POUCH, web, -0.6, hi ? 2 : 0);
    if (hi && !Pp.cape) gBox(B, 0.08, 0.025, 0.02, 0.008, gMat(0, 1.405, 0.155, -0.3), CH, DARK, 'nyl');
  }
  // ceinturon et boucle ; étui de cuisse (plateforme, étui et crosse du pistolet) ; poche vide-chargeur à gauche
  const bl = [[1.018, 0.158, 0.106, 0.113, 0], [1.022, 0.16, 0.108, 0.115, 0], [1.058, 0.155, 0.106, 0.11, 0], [1.062, 0.151, 0.102, 0.106, 0]];
  skinLoft(B, bl.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.5, v: y })), hi ? 34 : 12,
    { wp: (p) => torsoW(p), col: () => BELT, uv: () => GEAR_TILE.nyl });
  gBox(B, 0.052, 0.036, 0.012, 0.004, gMat(0, 1.04, -0.112), SB.PEL, MET, 'met');
  const th = M[SB.THR], hl = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  // repère de la cuisse : -z vers le genou, +x devant, +y vers l'intérieur (cuisse droite : l'extérieur est en -y)
  gBox(B, 0.11, 0.02, 0.18, 0.01, th.clone().multiply(hl(0.0, -0.085, -0.14)), SB.THR, BELT, 'nyl');
  gBox(B, 0.05, 0.042, 0.15, 0.012, th.clone().multiply(hl(0.002, -0.106, -0.13)), SB.THR, POUCH, 'nyl');
  if (hi) gBox(B, 0.03, 0.028, 0.06, 0.008, th.clone().multiply(hl(0.012, -0.106, -0.035)).multiply(gMat(0, 0, 0, -0.35)), SB.THR, DARK, 'poly');
  if (hi) for (const d of [0.1, 0.2]) {
    const S = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; S.push(new V3(Math.cos(a) * 0.09, Math.sin(a) * 0.088, -d).applyMatrix4(th)); }
    gBand(B, S, 0.022, 0.004, (p) => p.clone().sub(new V3(0, 0, -d).applyMatrix4(th)), SB.THR, BELT, null, 4);
  }
  if (Pp.carrier !== false) gBox(B, 0.08, 0.1, 0.05, 0.02, gMat(-0.15, 0.98, 0.08, 0, 0.6), SB.PEL, POUCH, 'nyl'); // (sous le bas du Gilet jaune, simulé, elle passerait au travers)
  // genouillères : coque cintrée sur le genou, deux sangles élastiques qui font le tour de la jambe (au-dessus et
  // au-dessous du genou, serrées sur le pantalon)
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), km = M[b.kn].clone().multiply(new THREE.Matrix4().makeBasis(new V3(0, -1, 0), new V3(0, 0, 1), new V3(-1, 0, 0)));
    gBox(B, 0.095, 0.12, 0.024, 0.01, km.clone().multiply(hl(0, -0.012, -0.068)), [[b.kn, 0.45], [b.sh, 0.55]], P.knee, 'poly', 3.2, hi ? 2 : 0);
    if (hi) for (const [bm, d, rx, ry, wt] of [[M[b.th], SD.thigh - 0.045, 0.066, 0.064, [[b.th, 0.7], [b.kn, 0.3]]], [M[b.sh], 0.05, 0.066, 0.063, [[b.sh, 0.8], [b.kn, 0.2]]]]) {
      const S = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU; S.push(new V3(Math.cos(a) * rx, Math.sin(a) * ry, -d).applyMatrix4(bm)); }
      gBand(B, S, 0.02, 0.004, (p) => p.clone().sub(new V3(0, 0, -d).applyMatrix4(bm)), wt, P.knee.clone().multiplyScalar(0.7), null, 4);
    }
  }
}
/* Casque à coupe haute : coque (peinte, ou couverte du camouflage de la tenue), bord, rails latéraux, support de JVN, velcro ;
   coquilles d'écoute, micro, jugulaire */
function helmetRimY(ph) {
  const a = Math.abs(ph);
  const front = 0.047, temple = 0.04, ear = 0.058, back = -0.018;
  if (a < 0.9) return lerp(front, temple, smoothstep(0, 0.9, a));
  if (a < 1.25) return lerp(temple, ear, smoothstep(0.9, 1.25, a));
  if (a < 1.95) return ear;
  return lerp(ear, back, smoothstep(1.95, 2.45, a));
}
function soldierHelmet(B, skin, hi) {
  const R = soldierRest(), hm = R.mats[SB.HEA], P = skinGear(skin), H = SB.HEA, camo = SKINS[skin].parts.helmet === 'camo';
  const HELM = P.helm, CUP = P.cup, DARK = P.poly;
  const c = new V3(0, 0.024, 0.008), rx = 0.108, ry = 0.118, rz = 0.123, v = new V3();
  const shell = (ph, th, grow = 0) => v.set(Math.sin(th) * Math.sin(ph) * (rx + grow), Math.cos(th) * (ry + grow), -Math.sin(th) * Math.cos(ph) * (rz + grow)).add(c);
  const thR = (ph) => Math.acos(clamp((helmetRimY(ph) - c.y) / ry, -1, 1));
  const nu = hi ? 32 : 12, nv = hi ? 9 : 3;
  // coque, puis bord épais qui rentre vers l'intérieur
  skinSurf(B, nu, nv + 2, (u, vv, o) => {
    const ph = (u - 0.5) * TAU, j = Math.round(vv * (nv + 2)), tr = thR(ph);
    if (j <= nv) shell(ph, tr * (j / nv));
    else { shell(ph, tr + 0.02 * (j - nv), -0.01 * (j - nv)); }
    v.applyMatrix4(hm); o.x = v.x; o.y = v.y; o.z = v.z; o.w = H; o.col = j > nv ? HELM.clone().multiplyScalar(0.7) : HELM;
    const t = camo ? camoUV(u * 0.7, Math.min(j, nv) / nv * tr * 0.12, 0.7, 0.31, 0.57) : GEAR_TILE.paint; o.U = t[0]; o.V = t[1];
  }, { out: true });
  const onShell = (ph, th, grow, w, h, d, r, col, tile) => {
    const p = shell(ph, th, grow).clone(), n = p.clone().sub(c).normalize(), up = new V3(0, 1, 0), X = new V3().crossVectors(up, n).normalize(), Y = new V3().crossVectors(n, X);
    const m = new THREE.Matrix4().makeBasis(X, Y, n).setPosition(p);
    gBox(B, w, h, d, r, hm.clone().multiply(m), H, col, tile);
  };
  if (hi) {
    // rails latéraux, support de JVN, velcro, contrepoids
    for (const s of [-1, 1]) for (const ph of [1.05, 1.5, 1.95]) onShell(ph * s, thR(ph) - 0.2, 0.004, 0.05, 0.013, 0.009, 0.003, DARK, 'poly');
    onShell(0, 0.62, 0.006, 0.05, 0.034, 0.012, 0.005, DARK, 'poly');
    onShell(0, 0.3, -0.001, 0.06, 0.07, 0.004, 0.002, camo ? P.pouch : HELM.clone().multiplyScalar(0.82), 'fab');
    onShell(Math.PI, 0.95, 0.004, 0.07, 0.04, 0.02, 0.008, DARK, 'nyl');
  }
  // coquilles d'écoute (sur les oreilles) et leurs bras de fixation au rail
  for (const s of [-1, 1]) {
    const m = hm.clone().multiply(gMat(s * 0.087, -0.006, 0.012, 0, 0, Math.PI / 2));
    gCyl(B, 0.037, 0.034, 0.03, hi ? 14 : 6, m, H, CUP, 'poly');
    if (hi) gCyl(B, 0.028, 0.02, 0.012, 10, hm.clone().multiply(gMat(s * 0.106, -0.006, 0.012, 0, 0, Math.PI / 2)), H, CUP.clone().multiplyScalar(0.8), 'poly');
    if (hi) gBox(B, 0.01, 0.05, 0.016, 0.004, hm.clone().multiply(gMat(s * 0.098, 0.045, 0.012)), H, DARK, 'poly');
  }
  if (hi) {
    // micro sur la coquille droite
    const pts = [[0.092, -0.035, -0.012], [0.08, -0.058, -0.06], [0.05, -0.07, -0.095], [0.03, -0.068, -0.108]].map(([x, y, z]) => new V3(x, y, z).applyMatrix4(hm));
    gBand(B, pts, 0.005, 0.005, () => new V3(0, 1, 0), H, DARK, () => GEAR_TILE.rub, 5);
    gBox(B, 0.018, 0.014, 0.014, 0.006, hm.clone().multiply(gMat(0.028, -0.068, -0.11)), H, DARK, 'fab');
    // jugulaire : des coquilles au menton
    for (const s of [-1, 1]) {
      const pts = [[s * 0.07, 0.035, -0.045], [s * 0.074, -0.03, -0.05], [s * 0.06, -0.085, -0.055], [s * 0.035, -0.112, -0.07], [s * 0.01, -0.121, -0.078]].map(([x, y, z]) => new V3(x, y, z).applyMatrix4(hm));
      gBand(B, pts, 0.012, 0.003, (p) => p.clone().sub(new V3(0, 0, 0).applyMatrix4(hm)), H, DARK, null, 4);
    }
  }
}
/* Lunettes balistiques enveloppantes (verres fumés ou ambrés selon la tenue, monture fine) */
function soldierGlasses(B, skin, hi) {
  const hm = soldierRest().mats[SB.HEA], P = skinGear(skin), H = SB.HEA, DARK = P.poly, LENS = P.lens;
  const gl = new V3();
  skinSurf(B, hi ? 18 : 8, hi ? 3 : 1, (u, vv, o) => {
    // verre enveloppant : bord supérieur droit, bord inférieur qui descend sous chaque œil et remonte sur le nez
    const ph = (u - 0.5) * 2.05, low = -0.004 + 0.012 * Math.exp(-((ph / 0.2) ** 2)) + 0.008 * smoothstep(0.75, 1.02, Math.abs(ph)), y = lerp(0.031, low, vv), th = Math.acos(clamp(y / 0.117, -1, 1));
    headPt(th, ph, gl, 0.013 + 0.004 * Math.cos(ph)); gl.applyMatrix4(hm);
    o.x = gl.x; o.y = gl.y; o.z = gl.z; o.w = H; o.col = vv < 0.2 && hi ? DARK : LENS;
    const t = vv < 0.2 && hi ? GEAR_TILE.poly : GEAR_TILE.lens; o.U = t[0]; o.V = t[1];
  }, { out: true });
}
