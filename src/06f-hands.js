/* ==========================================================================
   MAINS GANTÉES (vue subjective)
   Une main est une surface continue, lissée sur 16 os : la paume (racine), trois phalanges par doigt et,
   pour le pouce, le métacarpien puis deux phalanges. Le métacarpien du pouce n'est pas un segment visible :
   il est noyé dans l'éminence thénar, la masse charnue à la base du pouce, et une palmure épaisse le relie au bord
   de la paume jusqu'à la jointure de l'index. On voit donc, comme sur une vraie main, un pouce court à deux phalanges
   qui sort d'une paume épaisse (et non un doigt de plus qui partirait du poignet). Le métacarpien pivote selon les
   deux axes de la base du pouce et tourne en opposition avec eux : les transitions suivent le chemin d'un vrai pouce.

   Proportions d'une main d'homme adulte gantée : paume de 10,5 cm du poignet à l'articulation du majeur,
   8,5 cm de large aux jointures, doigts de 19 à 20 mm de diamètre ; phalanges de l'index 41, 24 et 21 mm.
   La pose de repos (celle où le maillage est construit) a les doigts à demi fléchis : les poses courantes
   (poignée, garde-main) s'en écartent peu, ce qui limite les déformations aux articulations.

   Repère de la main : -z vers les doigts, +y le dos de la main, pouce du côté x = side (côté radial) ;
   side vaut +1 pour la main gauche et -1 pour la droite. Les poses ne sautent pas d'une image à l'autre :
   chaque main glisse vers sa pose cible (VM.handDt).
   Une pose donne, par doigt (i index, m majeur, r annulaire, p auriculaire, f pour les manquants), les flexions
   [base, milieu, bout] (base 0 à 90°, milieu 0 à 110°, bout 0 à 80° et jamais plus fléchi que le milieu) ;
   t : pouce [flexion de la phalange proximale, flexion du bout, flexion du métacarpien vers l'auriculaire, abduction hors de la paume]
   (la rotation d'opposition du pouce en découle, un cinquième terme facultatif la corrige) ; spread : écart ; free : l'index ne se referme pas sur l'objet (détente) ;
   topen : pose d'approche du pouce pour la prise procédurale.
   ========================================================================== */
const HAND_POSES = {
  // poing autour d'une poignée : le majeur, l'annulaire et l'auriculaire s'empilent, l'index un peu moins fermé ;
  // le pouce passe en travers, devant l'index et le majeur
  grip: { f: [1.3, 1.5, 0.95], i: [1.05, 1.35, 0.9], t: [0.35, 0.5, 0.9, 0.55, -0.9], spread: 0.0 },
  // couteau tenu en avant (prise en poignée de main, 06c-models.js : KNIFE_HELD), réglée à la main avec le banc de réglage (09zk-couteau-reglage.js) : les doigts font le
  // tour du manche, chacun à lui, et le pouce a huit angles (les trois derniers pivotent sa base autour de x, y et z de la main : thumbQ)
  kgrip: { i: [1.37, 1.35, 0.67], m: [1.48, 1.5, 0.95], r: [1.3, 1.5, 0.95], p: [1.3, 1.5, 0.95], t: [0.42, 0.47, -0.16, 0.89, -1.37, 0.06, 0.28, -0.16], spread: 0 },
  // couteau pendant le coup (06c-models.js : KNIFE_STAB) : les doigts mélangés de la pose tenue au début, à la fin du coup, réécrits à chaque image
  kstab: { i: [0, 0, 0], m: [0, 0, 0], r: [0, 0, 0], p: [0, 0, 0], t: [0, 0, 0, 0, 0, 0, 0, 0], spread: 0 },
  // main d'appui sur une poignée d'appui : même poing (la prise le referme au contact de la poignée) ; le pouce part écarté du côté
  // du dos de la main (sans quoi il naîtrait dans la poignée) et vient l'entourer par l'arrière
  fgrip: { f: [1.3, 1.5, 0.95], i: [1.05, 1.35, 0.9], t: [0.35, 0.5, 0.9, 0.55, -0.9], topen: [0.05, 0.05, 0.6, -0.25], spread: 0.0, sortie: true },
  // main de détente d'un fusil : l'index tendu vers la détente (libre, la prise ne le referme pas), le pouce qui fait le
  // tour du dos de la poignée et se rabat sur son flanc gauche (angles trouvés par optimisation contre la poignée)
  trigger: { f: [1.3, 1.5, 0.95], i: [0.32, 0.5, 0.3], t: [0.28, 0.86, 1.4, 0.94, 2.05], topen: [0.05, 0.05, 0.3, 0.4], spread: 0.0, free: true },
  // main de détente du pistolet, prise haute « pouces en avant » : la base du pouce enveloppe l'arrière de la poignée,
  // puis le pouce, paume tournée vers la carcasse, s'allonge vers l'avant sur le flanc gauche, au-dessus du pouce de la
  // main d'appui (angles trouvés par optimisation contre la forme de l'arme)
  ptrig: { f: [1.35, 1.55, 1.0], i: [0.3, 0.55, 0.3], t: [0.42, 0.63, 0.335, 1.04, -2.5], topen: [0.05, 0.05, 0.1, 0.3], spread: 0.0, free: true },
  // main d'appui du pistolet : paume sur le flanc gauche de la poignée, doigts refermés par-dessus ceux de la main droite,
  // pouce allongé vers l'avant sous la glissière
  psup: { f: [1.25, 1.35, 0.9], i: [1.15, 1.25, 0.85], t: [0.45, 0.0, 0.2, 0.34, -1.5], topen: [0.05, 0.0, 0.1, 0.1], spread: 0.0 },
  // main d'appui sous le garde-main : les doigts l'enveloppent par la droite ; le pouce, écarté de la paume (abduction) et un peu
  // replié vers les doigts (la paume étant relevée vers l'avant, il se dresserait ; plus replié, il passerait sous le garde-main),
  // file vers l'avant le long du flanc gauche
  support: { f: [1.0, 1.15, 0.75], i: [0.85, 1.0, 0.7], p: [1.1, 1.2, 0.8], t: [0.1, 0.1, 0.3, 0.9], topen: [0.05, 0.05, 0.2, 0.3], spread: 0.0, sortie: true },
  // main gauche figée des soldats (06g-body.js), d'après la prise de la vue subjective : sous un garde-main de 3 cm de rayon environ
  // (le pouce, écarté dans le plan de la paume, longe le flanc gauche sans passer sous l'arme, la paume étant relevée vers l'avant :
  // voir frameUnder), autour d'une poignée d'appui verticale
  tsup: { i: [0.45, 0.75, 0.6], m: [0.8, 0.9, 0.65], r: [0.92, 1.0, 0.7], p: [0.92, 1.0, 0.7], t: [0.05, 0.05, -0.3, 0], spread: 0.0 },
  tgrip: { i: [1.0, 1.4, 0.9], m: [1.19, 1.37, 0.79], r: [1.19, 1.25, 0.95], p: [1.08, 1.25, 0.87], t: [0.75, 0.9, 0.69, 0, -0.9], spread: 0.0 },
  // prise en « C » : doigts enroulés sous le garde-main, pouce tendu par-dessus
  cclamp: { f: [0.95, 1.15, 0.7], i: [0.8, 0.95, 0.6], p: [1.05, 1.2, 0.8], t: [0.08, 0.05, 0.2, 0.25], spread: 0.02 },
  // terminal des séries tenu dans la paume : doigts refermés sur le flanc gauche, pouce par-dessus le flanc droit, sur le bouton d'appel
  // (l'index moins fermé : il passerait devant l'écran)
  hold: { f: [1.2, 1.25, 0.8], i: [0.85, 0.9, 0.6], t: [0.35, 0.3, 0.6, 0.6], spread: 0.02 },
  // tablette tenue par les flancs : doigts derrière, pouce allongé sur le cadre
  tablet: { f: [1.1, 1.2, 0.7], t: [0.1, 0.15, 0.2, 0.6], spread: 0.03 },
  // grenade : les doigts épousent la sphère sans la serrer en poing
  nade: { f: [0.95, 1.05, 0.7], i: [0.85, 1.0, 0.65], p: [1.1, 1.1, 0.75], t: [0.35, 0.3, 0.8, 0.8], spread: 0.1 },
  // la main qui tient chaque type de grenade (06c-models.js : NADE_GRIP), un doigt par entrée et le pouce en huit angles comme kgrip ; réglable au banc
  // de réglage des grenades (?grenade=1, 09zj-grenade-reglage.js). Poses réglées par le propriétaire
  nfrag: { i: [1.32, 0.97, 0.65], m: [1.35, 1.05, 0.7], r: [1.32, 1.05, 0.7], p: [1.06, 1.1, 0.75], t: [0.55, 0.43, 0.71, 1.14, -2.63, -0.06, 0, 0], spread: 0 },
  nflash: { i: [1.32, 0.97, 0.65], m: [1.35, 1.05, 0.7], r: [1.32, 1.05, 0.7], p: [1.06, 1.1, 0.75], t: [0.55, 0.43, 0.71, 1.14, -2.63, -0.06, 0, 0], spread: 0 },
  nsmoke: { i: [1.32, 0.97, 0.65], m: [1.35, 1.05, 0.7], r: [1.32, 1.05, 0.7], p: [1.06, 1.1, 0.75], t: [0.55, 0.43, 0.71, 1.14, -2.63, -0.06, 0, 0], spread: 0 },
  nknife: { i: [1.9, 1.6, 0.94], m: [1.9, 1.6, 1.26], r: [1.9, 1.58, 1.16], p: [1.9, 1.82, 1.33], t: [0.9, 0.38, 0.74, 1.36, -2.86, 0.3, -0.5, 0], spread: 0 },
  pinch: { f: [1.5, 1.5, 0.9], i: [0.9, 1.2, 0.8], t: [0.5, 0.6, 1.1, 0.8], spread: 0.0 },
  open: { f: [0.05, 0.1, 0.06], p: [0.1, 0.12, 0.08], t: [0.05, 0.05, 0.0, 0.1], spread: 0.16 },
  relaxed: { f: [0.5, 0.6, 0.4], p: [0.65, 0.7, 0.45], t: [0.2, 0.3, 0.45, 0.2], spread: 0.06 },
  // main qui va chercher ou porte un chargeur : doigts en crochet
  mag: { f: [0.95, 1.1, 0.7], i: [0.9, 1.05, 0.65], p: [1.0, 1.1, 0.7], t: [0.3, 0.3, 0.7, 0.7], spread: 0.03 },
  // paume à plat (claque sur un chargeur ou un levier)
  slap: { f: [0.12, 0.15, 0.1], t: [0.1, 0.1, 0.1, 0.25], spread: 0.05 },
};
/* extension maximale de l'index à sa base (rad) : un index posé le long d'une carcasse se cambre un peu vers l'arrière */
const IDX_EXT = -0.45;
/* pose de construction du maillage (demi-flexion) */
const HAND_REST = { f: [0.45, 0.6, 0.35], t: [0.25, 0.2, 0.2, 0.45], spread: 0.0 };
/* index, majeur, annulaire, auriculaire : articulation de la base (x vers le pouce), longueurs des phalanges,
   rayon, convergence (en se fermant, les doigts pointent vers la base du pouce) */
const FINGERS = [
  { x: 0.0295, y: -0.0015, z: -0.046, L: [0.039, 0.023, 0.02], r: 0.0094, conv: 0.0 },
  { x: 0.0098, y: 0.0, z: -0.0505, L: [0.043, 0.026, 0.021], r: 0.0097, conv: 0.04 },
  { x: -0.0102, y: -0.0008, z: -0.0475, L: [0.04, 0.025, 0.02], r: 0.0092, conv: 0.09 },
  { x: -0.0288, y: -0.0035, z: -0.0395, L: [0.032, 0.019, 0.018], r: 0.0083, conv: 0.16 },
];
/* pouce : articulation trapézo-métacarpienne (près du poignet, côté paume), direction de repos du métacarpien,
   côté de l'ongle, longueurs métacarpien / phalange proximale / phalange distale (bout compris) */
const THUMB = { cmc: [0.022, 0.0, 0.036], dir: [0.6, -0.05, -0.8], nail: [0.9, 0.4, 0.15], L: [0.041, 0.027, 0.022] };
function thumbRestQ(side) {
  const z = new V3(-THUMB.dir[0] * side, -THUMB.dir[1], -THUMB.dir[2]).normalize();
  const y = new V3(THUMB.nail[0] * side, THUMB.nail[1], THUMB.nail[2]); y.addScaledVector(z, -y.dot(z)).normalize();
  const x = new V3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
/* Applique les angles courants (cur) aux os de la main */
function handApply(u) {
  const cur = u.cur, side = u.side, per = [cur.i, cur.m, cur.r, cur.p];
  u.fingers.forEach((fg, i) => {
    const F = per[i], fl = clamp(F[0], i === 0 ? IDX_EXT : -0.15, 1.6);
    fg.base.rotation.set(-fl, ((1.5 - i) * cur.spread - FINGERS[i].conv * Math.max(0, fl)) * -side, 0);
    fg.mid.rotation.x = -clamp(F[1], 0, 1.92); fg.tip.rotation.x = -clamp(Math.min(F[2], F[1] + 0.1), 0, 1.4);
  });
  // index de détente : se referme d'un cran quand on tire
  if (cur.trig) { const f = u.fingers[0]; f.base.rotation.x -= cur.trig * 0.22; f.mid.rotation.x -= cur.trig * 0.42; f.tip.rotation.x -= cur.trig * 0.18; }
  // pouce : le métacarpien pivote autour de la base du pouce selon deux axes de la main (flexion dans le plan de la paume,
  // vers l'auriculaire ; abduction hors de la paume, côté paume), et tourne sur lui-même d'autant (opposition : l'ongle
  // se présente de face quand le pouce vient au-dessus de la paume), comme un vrai pouce
  const T = cur.t;
  thumbQ(side, T, u.tq, u.tm.quaternion);
  u.tb.rotation.set(-T[0] - cur.press * 0.3, 0, 0);
  u.tt.rotation.x = -T[1] - cur.press * 0.45;
}
/* ---------- Prise procédurale ----------
   Une pose ne dit plus exactement où vont les doigts : elle donne jusqu'où ils peuvent se fermer. Chaque doigt part de la
   main presque ouverte et se referme phalange par phalange ; une phalange qui touche l'objet tenu s'arrête, les suivantes
   continuent de s'enrouler, comme une vraie main qui empoigne. S'il reste un jour sous le doigt à la fin de la pose, il se
   referme encore un peu pour venir au contact. L'objet est fait de formes simples dans l'espace de l'arme : boîtes
   arrondies (poignée, carcasse, garde-main) et capsules (les doigts de l'autre main, pour la main d'appui du pistolet). */
function gripShape(o) { // { c, h (demi-côtés), r (arrondi), rx : inclinaison autour de x } ou { a, b, r } (capsule)
  if (o.a) return { cap: true, a: new V3(...o.a), b: new V3(...o.b), r: o.r };
  return { c: new V3(...o.c), h: new V3(o.h[0] - o.r, o.h[1] - o.r, o.h[2] - o.r), r: o.r, qi: new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -(o.rx || 0)) };
}
/* Appelée des milliers de fois par image (prise des deux mains en vue subjective, mains des soldats) : rien n'y est alloué,
   pas même par Math.hypot (une fonction intégrée qui alloue, contrairement à Math.sqrt) */
const _gp = new V3(), _gsq = new V3();
function gripSdf(shapes, p) {
  let d = 1e9;
  for (let k = 0; k < shapes.length; k++) {
    const S = shapes[k];
    let e;
    if (S.cap) {
      _gsq.subVectors(S.b, S.a); const t = clamp(_gp.subVectors(p, S.a).dot(_gsq) / Math.max(1e-9, _gsq.lengthSq()), 0, 1);
      e = _gp.copy(S.a).addScaledVector(_gsq, t).distanceTo(p) - S.r;
    } else {
      _gp.subVectors(p, S.c).applyQuaternion(S.qi);
      const qx = Math.abs(_gp.x) - S.h.x, qy = Math.abs(_gp.y) - S.h.y, qz = Math.abs(_gp.z) - S.h.z;
      const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
      e = Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - S.r;
    }
    if (e < d) d = e;
  }
  return d;
}
/* Cinématique directe d'un doigt (a : flexions des trois articulations) ou du pouce (a : [pp, pd, flexion, abduction]),
   dans le repère de la main : quatre points (base, deux articulations, bout) dans out */
const _gk = { q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), v: new V3(), ax: new V3(), d: new V3() };
function digitFK(u, f, a, out) {
  const K = _gk, side = u.side, q = K.q;
  if (f < 4) {
    const F = FINGERS[f], fl = clamp(a[0], f === 0 ? IDX_EXT : -0.15, 1.6);
    out[0].set(F.x * side, F.y, F.z);
    q.setFromEuler(K.e.set(-fl, ((1.5 - f) * u.cur.spread - F.conv * Math.max(0, fl)) * -side, 0));
    out[1].copy(out[0]).add(K.v.set(0, 0, -F.L[0]).applyQuaternion(q));
    q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -clamp(a[1], 0, 1.92)));
    out[2].copy(out[1]).add(K.v.set(0, 0, -F.L[1]).applyQuaternion(q));
    q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -clamp(Math.min(a[2], a[1] + 0.1), 0, 1.4)));
    out[3].copy(out[2]).add(K.v.set(0, 0, -F.L[2] - 0.004).applyQuaternion(q));
    return out;
  }
  thumbQ(side, a, u.tq, q);
  out[0].set(THUMB.cmc[0] * side, THUMB.cmc[1], THUMB.cmc[2]);
  out[1].copy(out[0]).add(K.v.set(0, 0, -THUMB.L[0]).applyQuaternion(q));
  q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -a[0]));
  out[2].copy(out[1]).add(K.v.set(0, 0, -THUMB.L[1]).applyQuaternion(q));
  q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -a[1]));
  out[3].copy(out[2]).add(K.v.set(0, 0, -THUMB.L[2] - 0.004).applyQuaternion(q));
  return out;
}
/* Orientation du métacarpien du pouce : flexion (vers l'auriculaire, dans le plan de la paume), abduction (hors de la
   paume, autour de l'axe perpendiculaire au pouce) et rotation d'opposition qui les accompagne. T[5], T[6], T[7] (facultatifs, nuls
   par défaut) tournent ensuite tout le pouce autour de sa base, selon les axes x, y et z de la main : de quoi le poser où l'on veut
   (banc de réglage du couteau, 09zk-couteau-reglage.js) */
function thumbQ(side, T, tq, out) {
  const K = _gk;
  out.setFromAxisAngle(K.ax.set(0, 1, 0), T[2] * side);
  K.d.set(THUMB.dir[0] * side, THUMB.dir[1], THUMB.dir[2]).normalize().applyQuaternion(out);
  K.ax.set(0, 1, 0).cross(K.d).normalize(); // d × (-y) : l'abduction écarte le pouce côté paume
  out.premultiply(K.q2.setFromAxisAngle(K.ax, T[3])).multiply(tq).multiply(K.q2.setFromAxisAngle(K.ax.set(0, 0, 1), side * (0.5 * T[2] + 0.3 * T[3] + (T[4] || 0))));
  if (T[5] || T[6] || T[7]) out.premultiply(K.q2.setFromEuler(K.e.set(T[5] || 0, (T[6] || 0) * side, (T[7] || 0) * side, 'XYZ')));
  return out;
}
const _gP = [new V3(), new V3(), new V3(), new V3()], _gW = new V3(), _gM = new THREE.Matrix4();
const GAP_T = [0.4, 0.75, 1]; // points testés le long de chaque phalange
/* Distance au contact de la chaîne à partir de la phalange k (négative : elle s'enfonce) ; M : main vers arme */
function digitGap(u, f, a, k, shapes, M) {
  digitFK(u, f, a, _gP);
  let d = 1e9;
  for (let l = Math.max(1, k); l <= 3; l++) {
    const r = f < 4 ? FINGERS[f].r * (l === 3 ? 0.86 : 0.93) : 0.0106;
    for (let i = 0; i < 3; i++) {
      _gW.lerpVectors(_gP[l - 1], _gP[l], GAP_T[i]).applyMatrix4(M);
      d = Math.min(d, gripSdf(shapes, _gW) - r);
    }
  }
  return d;
}
/* Angles de prise d'un doigt : fermeture de la pose d'approche O vers la pose P, articulation par articulation.
   J : paramètres de chaque articulation (le pouce bouge sa base sur deux paramètres) ; out reçoit les angles */
const _gA = [0, 0, 0, 0, 0], _gS = [0, 0, 0, 0, 0];
/* doigts au plus ouverts quand une prise d'appui doit les sortir de l'objet : index, autres doigts, pouce (abduction côté dos de la
   main), et en dernier recours le pouce écarté aussi dans le plan de la paume, à l'opposé des doigts (il se dresse : seulement s'il ne sort
   pas autrement, d'une rampe de poignée angulaire par exemple) */
const GRASP_EXT = [[IDX_EXT * 0.6, 0, 0], [-0.15, 0, 0], [0, 0, 0, -0.3, 0], [0, 0, -0.5, -0.3, 0]];
const GRASP_J = [[[0], [1], [2]], [[2, 3, 4], [0], [1]]], _gLock = [false, false, false];
function graspDigit(u, f, O, P, shapes, M, out, sortie = false) {
  const J = GRASP_J[f < 4 ? 0 : 1], n = O.length, lock = _gLock, N = 10;
  lock[0] = lock[1] = lock[2] = false;
  for (let j = 0; j < n; j++) _gA[j] = O[j];
  const g0 = digitGap(u, f, _gA, 1, shapes, M);
  if (g0 < 0 && !sortie) { for (let j = 0; j < n; j++) out[j] = P[j]; return out; } // déjà dans l'objet : pose telle quelle
  if (g0 < 0) {
    // poses d'appui des armes longues (sortie, voir HAND_POSES) : au lieu de garder sa pose dans l'objet, le doigt cherche la sortie
    // la plus proche, en s'ouvrant pas à pas (jusqu'à la main ouverte, puis un peu en extension) ou en se refermant vers P (un index
    // qui pointe dans le garde-main au-dessus d'une poignée s'enroule dessous), et s'arrête dès qu'il en sort ; sinon le pouce
    // s'écarte (GRASP_EXT[3]) ; sans sortie, il garde la position la moins enfoncée essayée
    const at = (s, X) => { for (let j = 0; j < n; j++) _gA[j] = X ? (f === 4 && j === 4 ? O[j] : O[j] + (X[j] - O[j]) * s / N) : O[j] + (P[j] - O[j]) * s / N; };
    let bg = -1e9, bs = 0, bX = null;
    const chemin = (X, m) => {
      for (let s = 1; s <= m; s++) { at(s, X); const g = digitGap(u, f, _gA, 1, shapes, M); if (g >= 0) return s; if (g > bg) { bg = g; bs = s; bX = X; } }
      return 0;
    };
    let X = f < 4 ? GRASP_EXT[f ? 1 : 0] : GRASP_EXT[2], s = chemin(X, N);
    const sc = chemin(null, s ? s - 1 : N);
    if (sc) { X = null; s = sc; } else if (!s && f === 4) s = chemin((X = GRASP_EXT[3]), N);
    if (!s) { X = bX; s = bs; }
    at(s, X);
    for (let j = 0; j < n; j++) out[j] = _gA[j];
    return out;
  }
  // phase 1 : de O à P ; phase 2 : au-delà de P (jusqu'à +0,4 rad) si le doigt frôle l'objet sans le toucher
  for (let s = 1; s <= N + 4; s++) {
    const t = s / N;
    if (s === N + 1 && digitGap(u, f, _gA, 1, shapes, M) > 0.012) break;
    for (let j = 0; j < 3; j++) {
      if (lock[j]) continue;
      const Jj = J[j];
      for (let q = 0; q < Jj.length; q++) { const i = Jj[q]; _gS[i] = _gA[i]; _gA[i] = t <= 1 ? O[i] + (P[i] - O[i]) * t : P[i] + Math.sign(P[i] - O[i] || 1) * 0.1 * (s - N); }
      if (digitGap(u, f, _gA, j + 1, shapes, M) < 0) { for (let q = 0; q < Jj.length; q++) _gA[Jj[q]] = _gS[Jj[q]]; lock[j] = true; }
    }
    if (lock[0] && lock[1] && lock[2]) break;
  }
  for (let j = 0; j < n; j++) out[j] = _gA[j];
  return out;
}
/* Index de détente : le coussinet de la dernière phalange vient sur la détente (point T de l'arme, axe du doigt), sans que
   le doigt entre dans l'arme (formes S : carcasse, pontet, puits de chargeur) ni que son bout ressorte de l'autre côté
   (x < xTip). Descente par coordonnées à partir de la solution précédente : le doigt suit la main quand elle roule sur la
   poignée, sans saut. a : angles [base, milieu, bout], modifiés en place. */
const _ti = [new V3(), new V3(), new V3(), new V3()], _tw = new V3(), _tp = new V3(), _ta = [0, 0, 0];
const TRIG_T = [0.35, 0.7, 1];
function trigCost(u, a, M, T, S, xTip) {
  digitFK(u, 0, a, _ti);
  for (let l = 0; l < 4; l++) _ti[l].applyMatrix4(M);
  let pen = 0;
  for (let l = 1; l <= 3; l++) for (let i = 0; i < 3; i++) {
    const k = TRIG_T[i];
    _tw.lerpVectors(_ti[l - 1], _ti[l], k);
    // la base de la phalange proximale est noyée dans la paume : quelques millimètres de recouvrement admis
    pen = Math.min(pen, gripSdf(S, _tw) - FINGERS[0].r * (l === 3 ? 0.86 : 0.93) + (l === 1 && k < 0.5 ? 0.006 : 0));
  }
  _tp.lerpVectors(_ti[2], _ti[3], 0.6);
  return _tp.distanceToSquared(T) * 1e4 + pen * pen * 4e5 + Math.max(0, xTip - _ti[3].x) ** 2 * 1e5 + 0.02 * (a[1] - 0.6) ** 2;
}
const TRIG_LIM = [[IDX_EXT, 1.2], [0, 1.8], [0, 1.3]], TRIG_H = [0.08, 0.04, 0.02];
function indexToTrigger(u, M, TR, a) {
  const T = TR.at, S = TR.shapes, x0 = TR.xTip, lim = TRIG_LIM;
  if (!a.init) { // premier appel : grille grossière
    let best = 1e9;
    for (let b = IDX_EXT; b <= 0.8; b += 0.15) for (let m = 0; m <= 1.8; m += 0.2) for (let t = 0; t <= Math.min(1.3, m + 0.1); t += 0.2) {
      _ta[0] = b; _ta[1] = m; _ta[2] = t; const c = trigCost(u, _ta, M, T, S, x0);
      if (c < best) { best = c; a[0] = b; a[1] = m; a[2] = t; }
    }
    a.init = true;
  }
  let c0 = trigCost(u, a, M, T, S, x0);
  for (let ih = 0; ih < 3; ih++) for (let it = 0; it < 2; it++) for (let j = 0; j < 3; j++) for (let sg = 1; sg >= -1; sg -= 2) {
    const h = TRIG_H[ih], v = a[j]; a[j] = clamp(v + sg * h, lim[j][0], j === 2 ? Math.min(lim[j][1], a[1] + 0.1) : lim[j][1]);
    const c = trigCost(u, a, M, T, S, x0);
    if (c < c0) c0 = c; else a[j] = v;
  }
  return a;
}
/* Pose de prise complète d'une main (repère de la main vers l'arme : M) : résultat dans G { i, m, r, p, t } */
const _gO = [0, 0, 0], _gOt = [0, 0, 0, 0, 0], _gT = [0, 0, 0, 0, 0], GRASP_KEYS = ['i', 'm', 'r', 'p'];
function handGrasp(u, P, shapes, M, G) {
  const keys = GRASP_KEYS;
  for (let f = 0; f < 4; f++) {
    const k = keys[f], Pf = P[k] || P.f;
    if (f === 0 && P.free) { // index de détente : sur la détente de l'arme si elle est décrite, sinon suit sa pose
      if (shapes.trig) { if (!G[k] || !G[k].init || G.tk !== shapes.trig) { G[k] = Pf.slice(); G.tk = shapes.trig; } indexToTrigger(u, M, shapes.trig, G[k]); } else G[k] = Pf.slice();
      continue;
    }
    for (let j = 0; j < 3; j++) _gO[j] = Pf[j] * 0.15;
    G[k] = graspDigit(u, f, _gO, Pf, shapes, M, G[k] || [0, 0, 0], P.sortie);
  }
  const T = P.t, To = P.topen || [0.05, 0.05, T[2] * 0.4, T[3] * 0.6];
  for (let j = 0; j < 5; j++) { _gT[j] = T[j] || 0; _gOt[j] = j < 4 ? To[j] : _gT[4]; }
  G.t = graspDigit(u, 4, _gOt, _gT, shapes, M, G.t || [0, 0, 0, 0, 0], P.sortie);
  return G;
}
/* Capsules des doigts d'une main (pour la main qui se referme par-dessus), dans l'espace de l'arme */
function handCapsules(u, M, out, fingers = [1, 2, 3, 4]) {
  const c = u.cur, per = [c.i, c.m, c.r, c.p, c.t];
  out.length = 0;
  for (const f of fingers) {
    digitFK(u, f, per[f], _gP);
    for (let l = 1; l <= 3; l++) {
      if (f === 4 && l === 1) continue;
      const r = f < 4 ? FINGERS[f].r * 0.95 : 0.0106;
      out.push({ cap: true, a: _gP[l - 1].clone().applyMatrix4(M), b: _gP[l].clone().applyMatrix4(M), r });
    }
  }
  return out;
}
/* Géométrie d'une main (côté side), construite dans la pose de repos ; partagée par toutes les mains du même côté.
   Gant tactique : dos en tissu, paume en synthétique plus sombre, bouts de doigts renforcés, coque des jointures et
   protège-phalanges en caoutchouc moulés dans la surface (bosses et couleur, pas de pièces rapportées). */
const HAND_GEO = {};
function handGeometry(side, u, h, lod) {
  const key = side + (lod || 'fp');
  if (HAND_GEO[key]) return HAND_GEO[key];
  const B = new SkinBuilder(), hi = lod !== 'lo' && lod !== 'xlo', xlo = lod === 'xlo', seg = hi ? 16 : xlo ? 4 : 6;
  const WHITE = new THREE.Color(1, 1, 1), PALM = new THREE.Color(0.58, 0.57, 0.55), RUB = new THREE.Color(0.2, 0.2, 0.2), SEAM = new THREE.Color(0.8, 0.8, 0.8);
  // dos en tissu, paume et bouts des doigts en synthétique (zone « leath » : plus satinée)
  const phys = 0.14, guv = (x, z, palm) => atlasUV(palm ? 'leath' : 'glove', 0.5 + x / phys, (z + 0.085) / phys);
  const mix = (a, b, t) => (t <= 0 ? a : t >= 1 ? b : a.clone().lerp(b, t));
  // ---- paume : sections du poignet aux jointures [z, demi-largeur côté pouce, côté auriculaire, dos, paume, décalage y]
  const rows = [[0.08, 0.027, 0.027, 0.018, 0.017, 0], [0.066, 0.0285, 0.0285, 0.0168, 0.0172, 0], [0.05, 0.0325, 0.0315, 0.0158, 0.0176, 0], [0.032, 0.0365, 0.036, 0.015, 0.0168, 0.0004],
    [0.014, 0.0395, 0.039, 0.0145, 0.0158, 0.0008], [-0.005, 0.0415, 0.041, 0.0141, 0.0148, 0.001], [-0.022, 0.0425, 0.0415, 0.0136, 0.0138, 0.001], [-0.034, 0.042, 0.041, 0.0128, 0.0122, 0.0006], [-0.041, 0.0405, 0.0395, 0.0118, 0.0108, 0.0003]];
  const last = rows[rows.length - 1];
  for (let i = 1; i <= 4; i++) { const t = i / 4 * Math.PI / 2, k = i === 4 ? 0.02 : Math.cos(t); rows.push([last[0] - Math.sin(t) * 0.009, last[1] * (0.35 + 0.65 * k), last[2] * (0.35 + 0.65 * k), last[3] * k, last[4] * k, last[5]]); }
  // rangées supplémentaires (interpolées) pour que la coque des jointures ait une forme nette
  const R2 = []; for (let i = 0; i < rows.length - 1; i++) { R2.push(rows[i]); if (i >= 4 && i < 9) R2.push(rows[i].map((x, j) => (x + rows[i + 1][j]) / 2)); }
  R2.push(rows[rows.length - 1]);
  const R3 = xlo ? R2.filter((r, i) => i % 3 === 0 || i === R2.length - 1) : R2;
  const nr = R3.length, nu = hi ? 36 : xlo ? 8 : 12, bIdx = (f, k) => 1 + f * 3 + k;
  skinSurf(B, nu, nr - 1, (uu, vv, o) => {
    const r = R3[Math.round(vv * (nr - 1))], a = uu * TAU, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.35;
    let x = Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r[1] : r[2]), y = Math.sign(s) * Math.pow(Math.abs(s), e) * (s >= 0 ? r[3] : r[4]) + r[5];
    let z = r[0], col = WHITE;
    // dos de la main incliné vers l'auriculaire, éminence hypothénar, creux de la paume
    y += x * 0.06 * Math.max(0, s);
    if (s < 0) {
      y -= 0.003 * Math.exp(-(((x + 0.028) / 0.013) ** 2) - (((z - 0.012) / 0.03) ** 2)) * -s;
      y += 0.0024 * Math.exp(-((x / 0.016) ** 2) - (((z + 0.004) / 0.022) ** 2)) * -s;
    }
    // coque des jointures : bande moulée en travers du dos, une bosse par jointure
    const kz = smoothstep(-0.026, -0.031, z) * smoothstep(-0.056, -0.049, z), kd = smoothstep(0.35, 0.6, s);
    if (kz * kd > 0) {
      let ridge = 0; for (const F of FINGERS) ridge = Math.max(ridge, Math.exp(-(((x - F.x) / 0.0075) ** 2)));
      y += (0.0022 + 0.0012 * ridge) * kz * kd;
      col = mix(WHITE, RUB, smoothstep(0.3, 0.6, kz * kd));
    }
    // couture entre dos et paume
    if (Math.abs(s + 0.25) < 0.06) col = SEAM;
    else if (s < -0.25) col = PALM;
    if (z < -0.02) z += (x < 0 ? -x / 0.042 * 0.0075 : x / 0.042 * 0.0015) * smoothstep(-0.02, -0.045, z);
    o.x = x * side; o.y = y; o.z = z;
    // poids : paume ; base du pouce (thénar) ; bord des jointures qui suit les doigts
    const w = [[0, 1]];
    const th = Math.exp(-(((x - 0.024) / 0.016) ** 2) - (((y + 0.012) / 0.015) ** 2) - (((z - 0.018) / 0.022) ** 2)) * 0.4;
    if (th > 0.01) w.push([13, th]);
    const tw = smoothstep(-0.034, -0.054, z) * 0.6 * (s < 0 ? 1 : 0.5);
    if (tw > 0.01) {
      let f0 = 3; for (let f = 0; f < 3; f++) if (x > (FINGERS[f].x + FINGERS[f + 1].x) / 2) { f0 = f; break; }
      w[0][1] = 1 - tw; w.push([bIdx(f0, 0), tw]);
    }
    o.w = w; o.col = col;
    const uv = guv(x, z, s < -0.25); o.U = uv[0]; o.V = uv[1];
  });
  // ---- doigts : balayage le long des trois phalanges, jointures saillantes sur le dos, pulpes côté paume,
  //      protège-phalange en caoutchouc sur la phalange proximale
  const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), AX = new V3(0, 0, -1);
  u.fingers.forEach((fg, f) => {
    const F = FINGERS[f], L = F.L, r = F.r, d1 = L[0], d2 = L[0] + L[1], dt = d2 + L[2];
    const chain = [{ M: restMatrix(fg.base, h), L: L[0] }, { M: restMatrix(fg.mid, h), L: L[1] }, { M: restMatrix(fg.tip, h), L: L[2] }];
    const secs = [[-0.017, 0.93], [-0.01, 1.0, 0.0012], [-0.003, 1.08, 0.0026], [0.004, 1.03, 0.001], [0.01, 1.0], [0.0135, 1.0, 0, 0.0008, 1], [d1 * 0.5, 0.97, 0, 0.0012, 1], [d1 - 0.011, 0.95, 0, 0, 1], [d1 - 0.0075, 0.94], [d1 - 0.004, 0.93],
      [d1 - 0.0015, 0.95, 0.0014], [d1 + 0.002, 0.95, 0.0012], [d1 + 0.006, 0.9], [d1 + L[1] * 0.5, 0.87, 0, 0.001], [d2 - 0.004, 0.84], [d2, 0.86, 0.001], [d2 + 0.004, 0.84], [dt - 0.009, 0.85, 0, 0.0012], [dt - 0.004, 0.8]];
    const S = secs.filter((x, i) => hi || i % (xlo ? 3 : 2) === 0 || i === secs.length - 1).map(([d, k, kn, pad, guard]) => ({ d, r: [r * 1.06 * k, r * 1.06 * k, r * 0.9 * k, r * 1.0 * k], n: 2.3, kn: kn || 0, pad: pad || 0, guard: guard || 0 }));
    const J = [{ s: 0, h: 0.009, a: 0, b: bIdx(f, 0) }, { s: d1, h: 0.0055, a: bIdx(f, 0), b: bIdx(f, 1) }, { s: d2, h: 0.0045, a: bIdx(f, 1), b: bIdx(f, 2) }];
    const gd = (a, s) => s.guard * smoothstep(0.45, 0.7, Math.sin(a));
    skinSweep(B, chain, [0.0045, 0.0038], AX, X, Y, S, seg, {
      cap1: 0.0065,
      w: (d) => chainW(d, J),
      bump: (a, k, s) => s.kn * Math.pow(Math.max(0, Math.sin(a)), 4) + s.pad * Math.pow(Math.max(0, -Math.sin(a)), 2) + gd(a, s) * 0.0021 - 0.0006 * Math.exp(-(((s.v - d1) / 0.0025) ** 2)) * Math.max(0, -Math.sin(a)),
      col: (a, k, p, s) => (gd(a, s) > 0.5 ? RUB : Math.abs(Math.sin(a) + 0.2) < 0.08 ? SEAM : Math.sin(a) < -0.2 || s.v > dt - 0.011 ? PALM : WHITE),
      uv: (uu, v, s, px, py) => atlasUV(py < -r * 0.2 || v > dt - 0.011 ? 'leath' : 'glove', 0.2 + f * 0.2 + px / phys, (v + 0.02) / phys),
    });
  });
  // ---- pouce : thénar charnu autour du métacarpien (qui part de l'intérieur de la paume), puis deux phalanges courtes et
  //      épaisses ; pas de pièce rapportée sur le pouce (un anneau de caoutchouc s'y lisait comme un pli)
  const tchain = [{ M: restMatrix(u.tm, h), L: THUMB.L[0] }, { M: restMatrix(u.tb, h), L: THUMB.L[1] }, { M: restMatrix(u.tt, h), L: THUMB.L[2] }];
  const t1 = THUMB.L[0], t2 = t1 + THUMB.L[1], tt = t2 + THUMB.L[2];
  // [d, x+, x-, dos (ongle), pulpe]
  const tsec = [[0.0, 0.0095, 0.0095, 0.0075, 0.009], [0.01, 0.0125, 0.012, 0.0088, 0.0118], [0.021, 0.0135, 0.0135, 0.0094, 0.0132], [0.031, 0.0128, 0.013, 0.0095, 0.0122],
    [t1 - 0.004, 0.0118, 0.0118, 0.0097, 0.0108], [t1, 0.0116, 0.0116, 0.0101, 0.0106], [t1 + 0.007, 0.0112, 0.0112, 0.0097, 0.0106], [t1 + 0.016, 0.0109, 0.0109, 0.0094, 0.0104],
    [t2 - 0.003, 0.0107, 0.0107, 0.0094, 0.0102], [t2 + 0.001, 0.0108, 0.0108, 0.0095, 0.0103], [t2 + 0.006, 0.0109, 0.0109, 0.009, 0.0108], [tt - 0.008, 0.011, 0.011, 0.0087, 0.0112], [tt - 0.004, 0.0101, 0.0101, 0.008, 0.01]];
  const TJ = [{ s: 0.012, h: 0.016, a: 0, b: 13 }, { s: t1, h: 0.0105, a: 13, b: 14 }, { s: t2, h: 0.0062, a: 14, b: 15 }];
  skinSweep(B, tchain, [0.008, 0.005], AX, X, Y, tsec.filter((x, i) => hi || i % (xlo ? 3 : 2) === 0 || i === tsec.length - 1).map(([d, a, b, c, e]) => ({ d, r: [a, b, c, e], n: 2.2 })), seg + 2, {
    cap1: 0.0062,
    w: (d) => chainW(d, TJ),
    bump: (a, k, s) => 0.0008 * Math.exp(-(((s.v - t1) / 0.004) ** 2)) * Math.pow(Math.max(0, Math.sin(a)), 4),
    col: (a, k, p, s) => (Math.sin(a) < -0.3 || s.v > tt - 0.012 ? PALM : WHITE),
    uv: (uu, v, s, px, py) => atlasUV(py < -0.003 || v > tt - 0.012 ? 'leath' : 'glove', 0.85 + px / phys, (v + 0.02) / phys),
  });
  // ---- palmure : membrane épaisse entre le pouce et l'index. Elle relie le bord intérieur du pouce (du métacarpien au milieu
  //      de la première phalange) au bord de la paume (de la base du pouce à la jointure de l'index) ; ses deux bords sont
  //      noyés dans le pouce et dans la paume, ses sommets partagés entre leurs os : elle s'étire quand le pouce s'écarte et
  //      se replie quand il se referme. Sans elle, le pouce semble partir du poignet.
  {
    const Mt = [restMatrix(u.tm, h), restMatrix(u.tb, h)], half = (z) => {
      for (let i = 0; i < rows.length - 1; i++) if (z <= rows[i][0] && z >= rows[i + 1][0]) return rows[i][1] + (rows[i + 1][1] - rows[i][1]) * (rows[i][0] - z) / (rows[i][0] - rows[i + 1][0]);
      return z > rows[0][0] ? rows[0][1] : rows[rows.length - 1][1];
    };
    const dA = (v) => 0.012 + (t1 + 0.45 * THUMB.L[1] - 0.012) * v, zB = (v) => 0.03 - 0.068 * v;
    const pA = (v, o) => { const d = dA(v); return d <= t1 ? o.set(0, 0, -d).applyMatrix4(Mt[0]) : o.set(0, 0, -(d - t1)).applyMatrix4(Mt[1]); };
    const pB = (v, o) => { const z = zB(v); return o.set(half(z) * 0.7 * side, 0.005, z); };
    const A = new V3(), Bp = new V3(), A1 = new V3(), B1 = new V3(), D = new V3(), N = new V3(), T = new V3(), P = new V3();
    pA(0, A); pB(0, Bp); pA(1, A1); pB(1, B1);
    D.addVectors(A1, B1).sub(A).sub(Bp).normalize();
    const nv = hi ? 10 : xlo ? 3 : 5, nu = hi ? 20 : xlo ? 6 : 10;
    skinSurf(B, nu, nv, (uu, vv, o) => {
      const th = uu * TAU, sAB = (1 - Math.cos(th)) / 2;
      pA(vv, A); pB(vv, Bp);
      // point intérieur du pouce : un peu vers la paume, pour que le bord de la membrane reste dans le pouce
      T.subVectors(Bp, A); const len = T.length(); T.multiplyScalar(1 / len); A.addScaledVector(T, 0.004); Bp.addScaledVector(T, -0.002);
      N.crossVectors(T, D).normalize(); if (N.y < 0) N.negate();
      const ht = (0.0095 + (0.005 - 0.0095) * vv) * (vv > 0.8 ? Math.sqrt(Math.max(0, 1 - ((vv - 0.8) / 0.2) ** 2)) : 1) * (0.7 + 0.3 * Math.abs(2 * sAB - 1));
      P.lerpVectors(A, Bp, sAB).addScaledVector(N, ht * Math.sin(th)).addScaledVector(D, -0.011 * Math.sin(Math.PI * sAB) * vv * vv);
      o.x = P.x; o.y = P.y; o.z = P.z;
      const wp = smoothstep(0.2, 0.85, sAB), wt = chainW(dA(vv), TJ), w = [[0, wp]];
      for (const [bi, bw] of wt) { if (bi === 0) w[0][1] += bw * (1 - wp); else w.push([bi, bw * (1 - wp)]); }
      o.w = w;
      const dorsal = Math.sin(th) > 0;
      o.col = dorsal ? WHITE : PALM;
      const uv = atlasUV(dorsal ? 'glove' : 'leath', 0.75 + P.x * side / phys, (P.z + 0.085) / phys); o.U = uv[0]; o.V = uv[1];
    });
  }
  const geo = B.build();
  geo.userData.shared = true;
  return (HAND_GEO[key] = geo);
}
/* Matières des bras de la vue subjective : gants (teinte de la tenue) et manches (camouflage de la tenue) */
const VM_LOOK = { key: '', fp: '', hand: null, arm: null };
function vmGearMats() {
  const s = skinMine();
  if (!VM_LOOK.hand) { VM_LOOK.hand = gearMaterial(s, 'fp'); VM_LOOK.arm = gearMaterial(s, 'fp'); vmSetLook(s, 0); }
  return VM_LOOK;
}
/* Tenue des bras à l'écran : celle du joueur (vue par un allié : teinte claire), ou celle du tueur pendant la killcam (teinte
   sombre). Le camouflage fin de la vue subjective n'existe que pour la tenue du joueur (une texture : construite au démarrage,
   refaite quand il en change, aux menus ou dans la pause) ; un tueur d'une autre tenue prend celle de son modèle (motif plus large). */
function vmSetLook(skin, rel) {
  const L = VM_LOOK, key = skin + rel; if (!L.hand || L.key === key) return;
  L.key = key;
  const mine = skinMine();
  if (skin === mine && L.fp !== mine) { if (L.fp) gearFreeFp(L.fp); L.fp = mine; }
  const T = skin === mine ? gearTextures(skin, true) : gearTextures(skin, false), G = skinGear(skin);
  skinTone(skin, rel, L.arm.color); L.hand.color.copy(G.glove).multiply(L.arm.color).multiplyScalar(1.15);
  L.arm.map = T.map; L.hand.map = T.map;
}
/* Os d'une main (groupes) : racine (paume), phalanges des quatre doigts, métacarpien et phalanges du pouce */
function handBones(side) {
  const h = new THREE.Group(), fingers = [];
  for (let i = 0; i < 4; i++) {
    const F = FINGERS[i];
    const base = new THREE.Group(); base.position.set(F.x * side, F.y, F.z); h.add(base);
    const mid = new THREE.Group(); mid.position.z = -F.L[0]; base.add(mid);
    const tip = new THREE.Group(); tip.position.z = -F.L[1]; mid.add(tip);
    fingers.push({ base, mid, tip });
  }
  const tm = new THREE.Group(); tm.position.set(THUMB.cmc[0] * side, THUMB.cmc[1], THUMB.cmc[2]); h.add(tm);
  const tb = new THREE.Group(); tb.position.z = -THUMB.L[0]; tm.add(tb);
  const tt = new THREE.Group(); tt.position.z = -THUMB.L[1]; tb.add(tt);
  const P0 = HAND_REST, cur = { f: [0, 0, 0], i: P0.f.slice(), m: P0.f.slice(), r: P0.f.slice(), p: P0.f.slice(), t: [0, 0, 0, 0, 0, 0, 0, 0].map((x, j) => P0.t[j] || 0), spread: 0, press: 0, trig: 0 };
  const u = { fingers, tm, tb, tt, side, cur, init: false, tq: thumbRestQ(side) };
  h.userData = u;
  handApply(u);
  const bones = [h]; for (const f of fingers) bones.push(f.base, f.mid, f.tip); bones.push(tm, tb, tt);
  const rest = bones.map((b) => (b === h ? new THREE.Matrix4() : restMatrix(b, h)));
  return { h, u, bones, rest };
}
/* Géométrie figée d'une main dans une pose (mains des soldats, qui ne bougent pas les doigts) : sommets déformés une fois
   par les os de la main, exprimés dans le repère de la paume ; renvoie { p, n, uv, c, idx } */
const HAND_BAKED = {};
function handBaked(side, pose, lod = 'lo') {
  const key = side + pose + lod;
  if (HAND_BAKED[key]) return HAND_BAKED[key];
  const H = handBones(side), g = handGeometry(side, H.u, H.h, lod), P = HAND_POSES[pose] || HAND_POSES.grip, c = H.u.cur;
  c.i = (P.i || P.f).slice(); c.m = (P.m || P.f).slice(); c.r = (P.r || P.f).slice(); c.p = (P.p || P.f).slice(); c.t = P.t.slice(); c.spread = P.spread;
  handApply(H.u);
  const K = H.bones.map((b, i) => (b === H.h ? new THREE.Matrix4() : restMatrix(b, H.h)).multiply(H.rest[i].clone().invert()));
  const pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count;
  const out = { p: new Float32Array(n * 3), n: new Float32Array(n * 3), uv: g.attributes.uv.array, c: g.attributes.color.array, idx: g.index.array };
  const v = new V3(), a = new V3(), t = new V3(), nm = new THREE.Matrix3();
  for (let k = 0; k < n; k++) {
    a.set(0, 0, 0); t.set(0, 0, 0);
    for (let j = 0; j < 4; j++) {
      const w = sw.array[k * 4 + j]; if (!w) continue;
      const M = K[si.array[k * 4 + j]];
      a.addScaledVector(v.fromBufferAttribute(pos, k).applyMatrix4(M), w);
      t.addScaledVector(v.fromBufferAttribute(nor, k).applyMatrix3(nm.setFromMatrix4(M)), w);
    }
    t.normalize(); a.toArray(out.p, k * 3); t.toArray(out.n, k * 3);
  }
  return (HAND_BAKED[key] = out);
}
function makeHand(M, side = 1) {
  const H = handBones(side), h = H.h, u = H.u, cur = u.cur;
  const mesh = skinnedMesh(handGeometry(side, u, h), vmGearMats().hand, H.bones, H.rest);
  mesh.frustumCulled = false; h.add(mesh); u.mesh = mesh;
  /* pose cible (nom), pression du pouce, index de détente (0 à 1) */
  u.set = (name, press = 0, trig = 0, shapes = null) => {
    let P = HAND_POSES[name] || HAND_POSES.grip;
    if (P.free && u.trigSrc) trig = Math.max(trig, u.trigSrc());
    // objet tenu : les doigts se referment jusqu'au contact (calculé une image sur deux, la main glisse vers le résultat)
    if (shapes) {
      if (!u.G || u.gName !== name || (u.gTick = (u.gTick || 0) + 1) % 2 === 0) { h.updateMatrix(); u.G = handGrasp(u, P, shapes, h.matrix, u.G || {}); u.gName = name; }
      u.G.spread = P.spread; P = u.G;
    } else u.gName = null;
    const k = u.init ? 1 - Math.exp(-22 * (VM.handDt || 0)) : 1; u.init = true;
    const go = (a, b) => { for (let j = 0; j < a.length; j++) a[j] += ((b[j] || 0) - a[j]) * k; };
    go(cur.i, P.i || P.f); go(cur.m, P.m || P.f); go(cur.r, P.r || P.f); go(cur.p, P.p || P.f); go(cur.t, P.t);
    cur.spread += (P.spread - cur.spread) * k; cur.press += (press - cur.press) * Math.min(1, k * 2);
    cur.trig += (trig - cur.trig) * Math.min(1, k * 2.5);
    handApply(u);
  };
  u.set('grip');
  return h;
}

/* ---------- Bras : squelette avec limites articulaires ----------
   Manche longue du treillis (camouflage de l'équipe), lissée sur cinq os : bras, os d'aide du coude (orienté à
   mi-chemin, il garde le volume du coude plié), avant-bras, os de torsion à mi-avant-bras et os du poignet. La torsion
   de l'avant-bras (pronation) se répartit ainsi du coude au poignet au lieu de vriller d'un coup. La manche plisse
   au pli du coude et s'accumule au-dessus du gant ; la manchette du gant, avec sa sangle, recouvre le bas de la manche.

   Le bras est une vraie chaîne : épaule (ancrée au corps, elle avance ou recule d'un ou deux
   centimètres comme une omoplate), coude à charnière (jamais tendu à fond, jamais plié à plus de
   145°), avant-bras dont la torsion est libre, poignet à deux axes (flexion/extension,
   déviation radiale/cubitale) aux amplitudes d'un poignet gainé. Une main visée sur l'arme n'est
   plus suivie aveuglément : on cherche d'abord la position du coude (rotation autour de l'axe
   épaule-poignet) qui garde le poignet le plus neutre, puis, si l'arme l'impose encore, c'est la
   main qui se laisse tourner autour de son point d'appui plutôt que le poignet qui casse. */
const ARM_REACH = 0.965, ARM_MINLEN = 0.235, WRIST_OFF = 0.056;
const WRIST_LIM = { flex: 1.25, ext: 1.1, uln: 0.66, rad: 0.36 }; // 72°, 63°, 38°, 21° : amplitudes d'un poignet ganté, sous le maximum anatomique
/* longueurs de construction (épaule-coude, coude-poignet) ; en jeu, les os s'étirent un peu si la pose le demande */
const ARM_LU = 0.34, ARM_LF = 0.33;
const _af = { du: new V3(), df: new V3(), n: new V3(), x: new V3(), y: new V3(), z: new V3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion() };
function _basisQ(x, y, z, out) { _af.m.makeBasis(x, y, z); return out.setFromRotationMatrix(_af.m); }
/* Place les os du bras entre l'épaule S, le coude E et le poignet W, la main (orientée par Qh) étant au bout.
   Repère des os : -z le long du membre, +y du côté du dos de la main quand l'avant-bras est neutre (pouce en haut). */
function armFrames(arm, S, E, W, Qh) {
  const A = _af, b = arm.bones;
  A.du.subVectors(E, S).normalize(); A.df.subVectors(W, E).normalize();
  A.n.crossVectors(A.du, A.df);
  if (A.n.lengthSq() < 1e-6) A.n.copy(arm.lastN); else A.n.normalize();
  if (A.n.dot(arm.lastN) < -0.2) A.n.lerp(arm.lastN, 0.5).normalize();
  arm.lastN.copy(A.n);
  A.y.copy(A.n).multiplyScalar(-arm.side);
  A.z.copy(A.du).negate(); A.x.crossVectors(A.y, A.z); _basisQ(A.x, A.y, A.z, b.up.quaternion); b.up.position.copy(S);
  A.z.copy(A.df).negate(); A.x.crossVectors(A.y, A.z); _basisQ(A.x, A.y, A.z, b.fo.quaternion); b.fo.position.copy(E);
  b.el.quaternion.slerpQuaternions(b.up.quaternion, b.fo.quaternion, 0.5); b.el.position.copy(E);
  // poignet : même axe que l'avant-bras, tourné comme la main (dos de la main projeté perpendiculairement à l'avant-bras)
  A.y.set(0, 1, 0).applyQuaternion(Qh); A.y.addScaledVector(A.z, -A.y.dot(A.z));
  if (A.y.lengthSq() < 1e-6) A.y.set(0, 1, 0).applyQuaternion(b.fo.quaternion); A.y.normalize();
  A.x.crossVectors(A.y, A.z); _basisQ(A.x, A.y, A.z, b.wr.quaternion); b.wr.position.copy(W);
  b.tw.quaternion.slerpQuaternions(b.fo.quaternion, b.wr.quaternion, 0.5); b.tw.position.addVectors(E, W).multiplyScalar(0.5);
}
/* Géométrie d'un bras (côté side) : manche (matière des manches) et manchette de gant (matière des gants) ;
   os : 0 bras, 1 aide du coude, 2 avant-bras, 3 torsion, 4 poignet, 5 main */
const ARM_GEO = {};
function armGeometry(side, rest) {
  if (ARM_GEO[side]) return ARM_GEO[side];
  const LU = ARM_LU, LF = ARM_LF, dW = LU + LF, X = new V3(1, 0, 0), Y = new V3(0, 1, 0), AX = new V3(0, 0, -1);
  const chain = [{ M: rest[0], L: LU }, { M: rest[2], L: LF }];
  // poids : bras / aide du coude / groupe de l'avant-bras, lui-même réparti entre avant-bras, torsion et poignet
  const wArm = (d, handK = 0) => {
    const te = clamp((d - (LU - 0.07)) / 0.14, 0, 1), t = clamp((d - LU) / LF, 0, 1);
    const g = te * te, w = [[0, (1 - te) * (1 - te)], [1, 2 * te * (1 - te)], [2, g * (1 - t) * (1 - t)], [3, g * 2 * t * (1 - t)], [4, g * t * t * (1 - handK)]];
    if (handK > 0) w.push([5, g * t * t * handK]);
    return w;
  };
  // ---- manche : bras large, coude, avant-bras qui s'affine, tissu accumulé au-dessus du gant
  const B = new SkinBuilder(), R = mulberry32(side > 0 ? 3 : 4);
  const ph = []; for (let i = 0; i < 8; i++) ph.push(R() * TAU);
  const prof = [[-0.08, 0.056], [-0.03, 0.058], [0.05, 0.056], [0.14, 0.053], [0.22, 0.05], [LU - 0.06, 0.047], [LU - 0.03, 0.046], [LU, 0.047], [LU + 0.03, 0.049], [LU + 0.07, 0.048],
    [LU + 0.12, 0.0435], [LU + 0.17, 0.0405], [LU + 0.21, 0.038], [LU + 0.235, 0.0372], [LU + 0.25, 0.036], [dW - 0.066, 0.031], [dW - 0.05, 0.0295], [dW - 0.03, 0.0285]];
  const S = [];
  for (let i = 0; i < prof.length - 1; i++) { const [d0, r0] = prof[i], [d1, r1] = prof[i + 1], n = Math.max(1, Math.round((d1 - d0) / 0.012)); for (let k = 0; k < n; k++) { const t = k / n; S.push({ d: lerp(d0, d1, t), rr: lerp(r0, r1, t) }); } }
  S.push({ d: prof[prof.length - 1][0], rr: prof[prof.length - 1][1] });
  skinSweep(B, chain, [0.035], AX, X, Y, S.map((s) => ({ d: s.d, r: [s.rr * 1.02, s.rr * 1.02, s.rr * 0.92, s.rr * 0.96], n: 2.1, rr: s.rr })), 30, {
    a0: side > 0 ? Math.PI : 0, // couture de la manche sous le bras, côté fléchisseurs
    w: (d) => wArm(d),
    bump: (a, k, s) => {
      const d = s.v, fl = Math.cos(a) * side; // fl = 1 : côté du pli du coude
      let b = 0;
      // coude : pointe de l'olécrane derrière, plis en éventail au creux du coude
      b += 0.006 * Math.exp(-(((d - LU) / 0.03) ** 2)) * Math.pow(Math.max(0, -fl), 3);
      b += 0.0035 * Math.sin((d - LU) * 150 + ph[0]) * Math.exp(-(((d - LU) / 0.045) ** 2)) * Math.pow(Math.max(0, fl), 1.5);
      // plis longs de l'avant-bras et du bras, qui tournent un peu autour du membre
      b += 0.0016 * Math.sin(a * 3 + d * 18 + ph[1]) + 0.0009 * Math.sin(a * 5 - d * 31 + ph[2]);
      // tissu accumulé au-dessus du gant : bourrelets irréguliers
      const acc = smoothstep(LU + 0.15, LU + 0.22, d) * (1 - smoothstep(dW - 0.085, dW - 0.07, d));
      b += acc * (0.0032 * Math.sin(d * 230 + Math.sin(a * 2 + ph[3]) * 1.6) + 0.0018 * Math.sin(a * 4 + d * 90 + ph[4]));
      return b;
    },
    col: (a, k, p, s) => { const c = 0.92 + 0.08 * Math.sin(a * 3 + s.v * 18 + ph[1]); return new THREE.Color(c, c, c); },
    uv: (u, v) => camoUV(u * 0.34, v, 0.34, side > 0 ? 0.13 : 0.61, 0.07),
  });
  // ---- manchette du gant : évasée à l'entrée, serrée au poignet, sangle auto-agrippante en travers, bord roulé
  const C = new SkinBuilder(), WHITE = new THREE.Color(1, 1, 1), NEO = new THREE.Color(0.55, 0.55, 0.55), STRAP = new THREE.Color(0.42, 0.42, 0.42);
  const cs = [[dW - 0.062, 0.031, 0], [dW - 0.059, 0.0372, 0], [dW - 0.055, 0.0378, 0], [dW - 0.049, 0.0372, 0], [dW - 0.043, 0.0364, 1], [dW - 0.036, 0.0356, 1], [dW - 0.029, 0.0348, 1], [dW - 0.022, 0.0334, 0], [dW - 0.014, 0.0322, 0],
    [dW - 0.006, 0.031, 0], [dW + 0.004, 0.0302, 0], [dW + 0.014, 0.0296, 0]];
  skinSweep(C, chain, [0.035], AX, X, Y, cs.map(([d, r, st]) => ({ d, r: [r * 1.05, r * 1.05, r * 0.95, r * 0.98], n: 2.3, st })), 30, {
    w: (d) => wArm(d, clamp((d - (dW - 0.02)) / 0.03, 0, 1) * 0.55),
    bump: (a, k, s) => (s.st ? 0.0022 + 0.0006 * Math.sin(a * 22) * 0 : 0) + (k === 1 || k === 2 ? 0.001 : 0),
    col: (a, k, p, s) => (s.st ? STRAP : k <= 3 ? NEO : WHITE),
    uv: (u, v, s, px, py) => atlasUV('glove', 0.5 + Math.atan2(py, px) / TAU * 0.9, (v - dW + 0.07) / 0.1),
  });
  // languette de la sangle (sur le dos du poignet) et boucle : placée dans le repère de l'avant-bras, qui part du coude
  // (distance comptée depuis le coude, et non depuis l'épaule comme les sections : sinon elle flotte 34 cm plus loin)
  const tab = new THREE.Matrix4().compose(new V3(0, 0.0352, -(dW - 0.036 - LU)), new THREE.Quaternion(), new V3(1, 1, 1));
  C.geo(rgeo(0.022, 0.004, 0.02, 0.0015), rest[2].clone().multiply(tab), [[3, 0.4], [4, 0.6]], STRAP, () => GEAR_TILE.nyl);
  const out = { sleeve: B.build(), cuff: C.build() };
  out.sleeve.userData.shared = out.cuff.userData.shared = true;
  return (ARM_GEO[side] = out);
}
/* side : +1 main gauche, -1 main droite (le pouce est du côté x = side de la main) */
function makeArm(M, parent, side) {
  const P = parent || VM.holder, L = vmGearMats();
  const hand = makeHand(M, side);
  const bones = { up: new THREE.Object3D(), el: new THREE.Object3D(), fo: new THREE.Object3D(), tw: new THREE.Object3D(), wr: new THREE.Object3D() };
  const arm = { hand, bones, side, phi: 0, psi: 0, chi: 0, jt: { fl: 0, dv: 0, r: 0, elbow: 0, reach: 0 }, lastN: new V3(-1, 0, 0) };
  // pose de construction : bras le long de -z, coude légèrement plié vers le bas, poignet neutre
  const S = new V3(0, 0, 0), E = new V3(0, 0, -ARM_LU), W = E.clone().add(new V3(0, -Math.sin(0.35), -Math.cos(0.35)).multiplyScalar(ARM_LF));
  const fd = new V3().subVectors(W, E).normalize(), yv = new V3(-1, 0, 0).multiplyScalar(-side);
  const Qh = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3().crossVectors(yv, fd.clone().negate()), yv, fd.clone().negate()));
  armFrames(arm, S, E, W, Qh);
  hand.position.copy(W).addScaledVector(fd, WRIST_OFF); hand.quaternion.copy(Qh);
  const list = [bones.up, bones.el, bones.fo, bones.tw, bones.wr, hand];
  const rest = list.map((b) => { b.updateMatrix(); return b.matrix.clone(); });
  const G = armGeometry(side, rest);
  arm.mesh = skinnedMesh(G.sleeve, L.arm, list, rest); arm.mesh.frustumCulled = false;
  arm.cuffMesh = new THREE.SkinnedMesh(G.cuff, L.hand); arm.cuffMesh.bind(arm.mesh.skeleton, _RIG_ID); arm.cuffMesh.frustumCulled = false;
  P.add(bones.up, bones.el, bones.fo, bones.tw, bones.wr, hand, arm.mesh, arm.cuffMesh);
  return arm;
}
function setArmVisible(arm, v) { arm.mesh.visible = v; arm.cuffMesh.visible = v; arm.hand.visible = v; if (arm.watch) arm.watch.visible = v; }
const _aS = new V3(), _aE = new V3(), _aD = new V3(), _aP = new V3(), _aN = new V3(), _aF = new V3(), _aH = new V3(), _aW = new V3(), _aG = new V3(), _aB = new V3(), _aX = new V3();
const _aQ = new THREE.Quaternion(), _aQi = new THREE.Quaternion(), _aQf = new THREE.Quaternion(), _aM = new THREE.Matrix4();
/* Épaule éventuellement déplacée, puis coude pour un angle de rotation phi autour de l'axe épaule-poignet
   (phi = 0 : le coude pointe vers le pôle). Résultats dans oS (épaule) et oE (coude) ; renvoie l'angle intérieur du coude. */
function elbowAt(S, W, a, b, pole, phi, oS, oE) {
  _aD.subVectors(W, S); let len = _aD.length(); _aD.multiplyScalar(1 / Math.max(1e-6, len));
  oS.copy(S);
  const max = (a + b) * ARM_REACH;
  // trop loin : l'omoplate avance ; trop près : elle recule (le coude ne se plie pas à plus de 145°)
  if (len > max) { oS.addScaledVector(_aD, len - max); len = max; } else if (len < ARM_MINLEN) { oS.addScaledVector(_aD, len - ARM_MINLEN); len = ARM_MINLEN; }
  const cosA = clamp((a * a + len * len - b * b) / (2 * a * len), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _aP.subVectors(pole, oS); _aP.addScaledVector(_aD, -_aP.dot(_aD));
  if (_aP.lengthSq() < 1e-8) _aP.set(0, -1, 0).addScaledVector(_aD, _aD.y);
  _aP.normalize(); _aN.crossVectors(_aD, _aP);
  const c = Math.cos(phi), s = Math.sin(phi);
  oE.copy(oS).addScaledVector(_aD, a * cosA).addScaledVector(_aP, a * sinA * c).addScaledVector(_aN, a * sinA * s);
  return len;
}
/* Flexion et déviation du poignet quand le coude est en E : dans le repère de la main, le coude est
   dans la direction +z quand le poignet est droit. Si le coude se retrouve du côté du dos de la main, la main est
   penchée vers ce même côté par rapport à l'avant-bras : c'est une extension. fl > 0 : flexion palmaire ;
   dv > 0 : déviation cubitale (vers le petit doigt). Le rapport à la limite vaut 1 en butée. */
const _bend = { fl: 0, dv: 0, r: 0 };
function wristBend(Qinv, E, W, side) {
  _aB.subVectors(E, W).normalize().applyQuaternion(Qinv);
  const fl = -Math.atan2(_aB.y, _aB.z), dv = -Math.atan2(_aB.x * side, _aB.z);
  _bend.fl = fl; _bend.dv = dv;
  const rf = fl / (fl >= 0 ? WRIST_LIM.flex : WRIST_LIM.ext), rd = dv / (dv >= 0 ? WRIST_LIM.uln : WRIST_LIM.rad); _bend.r = Math.sqrt(rf * rf + rd * rd);
  return _bend;
}
const _sE = new V3(), _sS = new V3();
const _bs = { phi: 0, cost: 0 }; // (champs d'un objet : une variable de module qui reçoit un nombre à virgule l'alloue à chaque écriture)
/* Meilleur angle de coude : poignet le plus neutre possible, sans s'éloigner du pôle sans raison,
   avec une préférence pour l'angle de l'image précédente (pas de saut d'une image à l'autre).
   Résultat dans _bs.phi (angle) et _bs.cost (coût) */
const _bsC = new Float32Array(27);
function bestSwivel(arm, S, W, Qinv, a, b, pole) {
  let bi = 0, bc = 1e9;
  for (let k = -13; k <= 13; k++) {
    const phi = k * 0.1;
    elbowAt(S, W, a, b, pole, phi, _sS, _sE);
    const r = wristBend(Qinv, _sE, W, arm.side).r;
    const cost = r * r * 0.8 + 40 * Math.max(0, r - 0.85) ** 2 + 0.4 * phi * phi + 0.3 * (phi - arm.phi) ** 2;
    _bsC[k + 13] = cost;
    if (cost < bc) { bc = cost; bi = k + 13; }
  }
  _bs.phi = (bi - 13) * 0.1 + parabolaStep(_bsC, bi, 27) * 0.1; _bs.cost = bc;
}
/* Sommet de la parabole qui passe par l'échantillon i d'un relevé de coûts et ses deux voisins, en fraction de pas (de -0,5 à 0,5) :
   l'optimum varie alors continûment au lieu de sauter d'un échantillon à l'autre (le coude avançait par crans de 0,1 rad) */
function parabolaStep(C, i, n, stride = 1) {
  if (i < stride || i + stride >= n) return 0;
  const c0 = C[i - stride], c1 = C[i], c2 = C[i + stride], den = c0 - 2 * c1 + c2;
  return den > 1e-9 ? clamp((0.5 * (c0 - c2)) / den, -0.5, 0.5) : 0;
}
/* Pose le bras entre l'épaule et le poignet, la main étant déjà orientée */
function drawArm(arm, S, E, W, r0, r1, elbowFlex) {
  arm.wrist = (arm.wrist || new V3()).copy(W); arm.foreDir = (arm.foreDir || new V3()).subVectors(W, E).normalize();
  armFrames(arm, S, E, W, arm.hand.quaternion);
}
/* Montre au poignet gauche, cadran sur le dos du poignet, juste derrière la manchette du gant */
function placeWatch(w, arm) {
  if (!arm.foreDir) return;
  const fd = arm.foreDir, dorsal = new V3(0, 1, 0).applyQuaternion(arm.hand.quaternion);
  dorsal.addScaledVector(fd, -dorsal.dot(fd)).normalize();
  w.position.copy(arm.wrist).addScaledVector(fd, -0.1).addScaledVector(dorsal, 0.029);
  const x = new V3().crossVectors(dorsal, fd).normalize();
  _m1.makeBasis(x, dorsal, fd); w.quaternion.setFromRotationMatrix(_m1);
}
/* Bras de la caméra à une main tenue en un point d'appui (off, dans le repère de la main) : la main est
   orientée par Q0. Une main qui serre une poignée ou un garde-main peut pivoter autour de cet objet sans le lâcher :
   axis (dans le repère de la main) et range donnent cette rotation libre ; lift (main d'appui, lHandFrame) donne la distance de
   la paume à la prise pour chaque roulis (liftAt) : elle reste posée sur un garde-main ou une poignée qui n'est pas rond. On cherche
   le couple (rotation de la main,
   position du coude) qui garde le poignet le plus neutre. Si l'arme impose encore un poignet hors limites, la main
   pivote autour de son point d'appui plutôt que de casser le poignet. */
const _pQ = new THREE.Quaternion(), _pQi = new THREE.Quaternion(), _pQc = new THREE.Quaternion(), _pO = new V3(), _pH = new V3(), _pW = new V3(), _pG = new V3(), _pS = new V3(), _pE = new V3(), _pV = new V3(), _pV2 = new V3();
function handAt(Q) { // origine de la main et poignet pour une orientation Q, le point d'appui restant fixe
  _pH.copy(_pO).applyQuaternion(Q).negate().add(_pG);
  _pW.set(0, 0, WRIST_OFF).applyQuaternion(Q).add(_pH);
}
const _pC = new Float32Array(25);
function poseArmToHand(arm, S, H0, Q0, pole, pose, press = 0, a = 0.34, b = 0.33, off = null, axis = null, range = 0.6, axis2 = null, range2 = 0.3, shapes = null, lift = null) {
  if (off) _pO.copy(off); else _pO.set(0, 0, 0);
  _pG.copy(_pO).applyQuaternion(Q0).add(H0); // point d'appui, fixe pendant la recherche
  const side = arm.side, dt = Math.min(VM.handDt || 1 / 60, 0.05);
  if (VM.debugArms) arm.dbg = { S: S.clone(), G: _pG.clone(), Q0: Q0.clone(), pole: pole.clone(), axis: axis ? axis.clone() : null, range, axis2: axis2 ? axis2.clone() : null, range2, a, b, off: _pO.clone() };
  // 1. rotations libres autour de l'objet tenu (rouler autour d'une poignée, s'incliner un peu dessus), avec le coude
  //    qui s'adapte à chaque essai
  const Q = _pQ, N = axis ? 5 : 1, N2 = axis2 ? 5 : 1;
  let bestPsi = 0, bestChi = 0, bestPhi = 0, bc = 1e9, bn = 0, bn2 = 0;
  for (let n = 0; n < N; n++) {
    const psi = N > 1 ? (n / (N - 1) * 2 - 1) * range : 0;
    for (let n2 = 0; n2 < N2; n2++) {
      const chi = N2 > 1 ? (n2 / (N2 - 1) * 2 - 1) * range2 : 0;
      Q.copy(Q0); if (N > 1) Q.multiply(_pQc.setFromAxisAngle(axis, psi)); if (N2 > 1) Q.multiply(_pQc.setFromAxisAngle(axis2, chi));
      if (lift) _pO.y = -liftAt(lift, psi);
      handAt(Q); _pQi.copy(Q).invert(); bestSwivel(arm, S, _pW, _pQi, a, b, pole);
      // sous un garde-main, un roulis qui ferait descendre la paume (pièce saillante, chargeur) est écarté
      const cost = _bs.cost + (N > 1 ? 0.4 * (psi / range) ** 2 : 0) + (N2 > 1 ? 0.6 * (chi / range2) ** 2 : 0) + 0.4 * (psi - arm.psi) ** 2 + 0.4 * (chi - arm.chi) ** 2
        + (lift ? 2000 * Math.max(0, -_pO.y - lift.lo - 0.003) ** 2 : 0);
      _pC[n * N2 + n2] = cost;
      if (cost < bc) { bc = cost; bestPsi = psi; bestChi = chi; bestPhi = _bs.phi; bn = n; bn2 = n2; }
    }
  }
  // affinage entre les échantillons (sommet de parabole), comme pour le coude : la main roule continûment
  if (N > 1) bestPsi += parabolaStep(_pC, bn * N2 + bn2, N * N2, N2) * (2 * range) / (N - 1) * (bn > 0 && bn < N - 1 ? 1 : 0);
  if (N2 > 1) bestChi += parabolaStep(_pC, bn * N2 + bn2, N * N2, 1) * (2 * range2) / (N2 - 1) * (bn2 > 0 && bn2 < N2 - 1 ? 1 : 0);
  // 2. les angles rejoignent leur cible en douceur (approche exponentielle, au plus 9 rad/s) : ni saut de coude ni main qui tourne
  //    d'un coup, et plus de mouvement par saccades à vitesse constante
  const step = 9 * dt, f = 1 - Math.exp(-25 * dt);
  if (!arm._init) { arm.psi = bestPsi; arm.chi = bestChi; arm.phi = bestPhi; arm._init = true; }
  else { arm.psi += clamp((bestPsi - arm.psi) * f, -step, step); arm.chi += clamp((bestChi - arm.chi) * f, -step, step); arm.phi += clamp((bestPhi - arm.phi) * f, -step, step); }
  Q.copy(Q0); if (N > 1) Q.multiply(_pQc.setFromAxisAngle(axis, arm.psi)); if (N2 > 1) Q.multiply(_pQc.setFromAxisAngle(axis2, arm.chi));
  if (lift) _pO.y = -liftAt(lift, arm.psi);
  // 3. poignet encore en butée : la main pivote autour de son point d'appui, en plusieurs passes
  let bd = null;
  for (let it = 0; it < 4; it++) {
    handAt(Q); _pQi.copy(Q).invert(); elbowAt(S, _pW, a, b, pole, arm.phi, _pS, _pE);
    bd = wristBend(_pQi, _pE, _pW, side);
    if (bd.r <= 1) break;
    const k = 1 / bd.r * 0.98, fl = bd.fl * k, dv = bd.dv * k;
    _pV.set(-Math.tan(dv) * side, -Math.tan(fl), 1).normalize();
    _pV2.subVectors(_pE, _pW).normalize().applyQuaternion(_pQi);
    _pQc.setFromUnitVectors(_pV, _pV2); Q.multiply(_pQc);
    if (it === 3) { // dernier recours : pivot autour du poignet, le contact glisse de quelques millimètres
      _pH.set(0, 0, -WRIST_OFF).applyQuaternion(Q).add(_pW); _pQi.copy(Q).invert(); bd = wristBend(_pQi, _pE, _pW, side);
    }
  }
  // 4. orientation finale lissée (dans le repère de l'arme) : un changement de prise (un axe libre qui apparaît, le poignet qui entre
  //    en butée) ne fait plus tourner la main d'un coup d'une image à l'autre ; elle rejoint l'orientation calculée en quelques
  //    images (approche exponentielle, au plus 14 rad/s), autour du même point d'appui. Un écart de plus de 70° (changement d'arme)
  //    est pris tel quel.
  if (arm._qs && VM.handDt) {
    const ang = 2 * Math.acos(Math.min(1, Math.abs(arm._qs.dot(Q))));
    if (ang > 1e-4 && ang < 1.2) {
      let k = 1 - Math.exp(-30 * dt); if (ang * k > 14 * dt) k = (14 * dt) / ang;
      Q.copy(arm._qs.slerp(Q, k)); handAt(Q); _pQi.copy(Q).invert(); elbowAt(S, _pW, a, b, pole, arm.phi, _pS, _pE); bd = wristBend(_pQi, _pE, _pW, side);
    }
  }
  (arm._qs = arm._qs || new THREE.Quaternion()).copy(Q);
  const J = arm.jt; J.fl = bd.fl; J.dv = bd.dv; J.r = bd.r; J.reach = _pS.distanceTo(S); J.psi = arm.psi; J.chi = arm.chi;
  J.turn = 2 * Math.acos(Math.min(1, Math.abs(Q.dot(Q0)))); // écart d'orientation par rapport à la pose visée
  _pV.subVectors(_pS, _pE).normalize(); _pV2.subVectors(_pW, _pE).normalize(); J.elbow = Math.PI - Math.acos(clamp(_pV.dot(_pV2), -1, 1));
  arm.hand.position.copy(_pH); arm.hand.quaternion.copy(Q);
  (arm.elbowAt = arm.elbowAt || new V3()).copy(_pE); (arm.wristAt = arm.wristAt || new V3()).copy(_pW);
  drawArm(arm, _pS, _pE, _pW, 0.046, 0.039, J.elbow);
  arm.hand.userData.set(pose, press, 0, shapes);
}
/* Bras dont la main prolonge l'avant-bras (grenade) : le poignet est droit, plus une flexion éventuelle (claquement
   du poignet au lâcher), et un roulis libre de l'avant-bras autour de son axe */
const _alq = new THREE.Quaternion(), _alr = new THREE.Quaternion(), _alv = new V3();
function placeArm(arm, S, T, a, b, pole, r0, r1, roll = 0, flex = 0) {
  const len = elbowAt(S, T, a, b, pole, 0, _pS, _pE);
  _alv.subVectors(T, _pE).normalize();
  _m1.lookAt(new V3(0, 0, 0), _alv, UP); _alq.setFromRotationMatrix(_m1);
  _alq.multiply(_alr.setFromAxisAngle(_alv.set(0, 0, 1), roll));
  _alq.multiply(_alr.setFromAxisAngle(_alv.set(1, 0, 0), -flex));
  arm.hand.quaternion.copy(_alq);
  arm.hand.position.copy(T).add(_pV.set(0, 0, -(WRIST_OFF - 0.02)).applyQuaternion(_alq));
  _alv.subVectors(_pS, _pE).normalize(); _pV2.subVectors(T, _pE).normalize();
  const J = arm.jt; J.elbow = Math.PI - Math.acos(clamp(_alv.dot(_pV2), -1, 1)); J.fl = flex; J.dv = 0; J.r = Math.abs(flex) / (flex >= 0 ? WRIST_LIM.flex : WRIST_LIM.ext); J.reach = _pS.distanceTo(S);
  drawArm(arm, _pS, _pE, T, r0, r1, J.elbow);
}
function buildWatch(M) {
  const w = new THREE.Group();
  rb(w, M.dark, 0, 0, 0, 0.032, 0.01, 0.036, 0.005);
  rb(w, M.lens, 0, 0.0055, 0, 0.024, 0.002, 0.026, 0.004);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 20, 1, true), M.tube || M.dark);
  band.rotation.x = Math.PI / 2; band.position.y = -0.029; w.add(band);
  return w;
}

/* Repère de la main sur un appareil tenu (terminal, tablette), dans le repère de l'appareil : p, centre de la paume ; f, direction des doigts
   tendus ; b, dos de la main. Le pouce se place de lui-même du côté radial (en haut pour une main droite dont les doigts vont vers la gauche,
   paume vers l'avant). */
function devGrip(parent, p, f, b) {
  const ref = new THREE.Object3D(); ref.position.set(p[0], p[1], p[2]);
  ref.quaternion.copy(frameZY([-f[0], -f[1], -f[2]], b)); parent.add(ref); return ref;
}
/* Pose un bras de série sur le repère de main d'un appareil tenu (terminal, tablette) */
const _devP = new V3(), _devQ = new THREE.Quaternion();
const DEV_AXIS = new V3(1, 0, 0); // la poignée est verticale, le long de la ligne des jointures : la main peut rouler autour
function armOnDevice(arm, ref, sideKey, pose, press, visible, range = 0.3) {
  setArmVisible(arm, visible); if (!visible) return;
  ref.updateWorldMatrix(true, false); ref.getWorldPosition(_devP); ref.getWorldQuaternion(_devQ);
  const D = VM_BODY.dev[sideKey], S = D.S, pole = S.clone().add(D.pole);
  poseArmToHand(arm, S, _devP.clone(), _devQ.clone(), pole, pose, press, 0.34, 0.33, null, DEV_AXIS, range);
}

/* L'objet tenu suit la main, et non l'inverse : quand le poignet ne peut pas suivre la pose visée, la main reste
   sur l'objet et c'est l'objet qui s'incline avec elle. ref : repère de la prise dans l'objet (enfant direct ou petit-enfant
   sans décalage), hand : la main déjà posée, dans le même espace que l'objet. */
const _ahM = new THREE.Matrix4(), _ahR = new THREE.Matrix4(), _ahS = new V3();
function attachToHand(obj, ref, hand) {
  ref.updateMatrix(); hand.updateMatrix();
  _ahR.copy(ref.matrix).invert(); _ahM.copy(hand.matrix).multiply(_ahR);
  _ahM.decompose(obj.position, obj.quaternion, _ahS);
  obj.updateMatrix();
}

