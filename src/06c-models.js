/* ==========================================================================
   MODÈLES DÉTAILLÉS (remplacent les versions de base)
   Armes en pièces arrondies avec leurs détails fonctionnels, mains gantées
   articulées (doigts à deux phalanges, pouce), poses par action, terminal UAV
   tenu en main et actionné au pouce, grenade M67 avec cuillère et goupille.
   Les organes de visée gardent exactement leurs positions (alignement ADS).
   ========================================================================== */
const RBG = new Map();
function rgeo(w, h, d, r) {
  const k = `${w}|${h}|${d}|${r}`;
  // dimensions gardées pour la version allégée des armes vues de loin (lowPolyGeometry : boîte simple)
  if (!RBG.has(k)) { const g = new THREE.RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)); g.userData.box = [w, h, d]; RBG.set(k, g); }
  return RBG.get(k);
}
const rb = (p, mat, x, y, z, w, h, d, r = 0.004, rx = 0, ry = 0, rz = 0) => part(p, rgeo(w, h, d, r), mat, x, y, z, 1, 1, 1, rx, ry, rz);
const G_CYL12 = new THREE.CylinderGeometry(1, 1, 1, 20), G_CAP = new THREE.CapsuleGeometry(1, 1, 4, 10), G_TOR = new THREE.TorusGeometry(1, 0.18, 8, 20);
const cy = (p, mat, x, y, z, r, len, rx = Math.PI / 2, ry = 0, rz = 0, geo = G_CYL12) => part(p, geo, mat, x, y, z, r, len, r, rx, ry, rz);
function rail(p, M, x, y, z, len, vertical) {
  // rail Picatinny : semelle et dents
  rb(p, M.dark, x, y, z, vertical ? 0.008 : 0.022, vertical ? 0.022 : 0.008, len, 0.002);
  for (let i = 0; i < Math.floor(len / 0.012); i++) { const zz = z - len / 2 + 0.006 + i * 0.012; if (vertical) bx(p, M.dark, x + Math.sign(x) * 0.005, y, zz, 0.004, 0.024, 0.006); else bx(p, M.dark, x, y + 0.005, zz, 0.024, 0.004, 0.006); }
}
function curvedMag(parent, M, n, len, w, d, curve, mat) {
  // chargeur courbe : un seul profil le long d'un arc (l'arc penche vers l'avant), plaque de talon et nervures sur la face avant
  const N = Math.max(8, n * 2), pts = [], front = [], rear = [], ds = len / N;
  let y = 0, z = 0;
  for (let i = 0; i <= N; i++) {
    const a = curve * i / N, nz = Math.cos(a), ny = -Math.sin(a), h = d / 2;
    front.push([z - nz * h, y - ny * h]); rear.push([z + nz * h, y + ny * h]);
    if (i < N) { y -= Math.cos(a + curve / N / 2) * ds; z -= Math.sin(a + curve / N / 2) * ds; }
  }
  front[0][1] += 0.012; rear[0][1] += 0.012; // le haut dépasse dans le puits
  for (const q of front) pts.push([q[0], q[1], 0]); for (let i = N; i >= 0; i--) pts.push([rear[i][0], rear[i][1], 0]);
  prof(parent, mat || M.poly, pts, w, 0, 0.0035, 0.002);
  const a = curve;
  for (let i = 1; i < n; i += 2) {
    const t = i / n, aa = curve * t, k = Math.round(t * N), q = front[k];
    bx(parent, M.dark, 0, q[1], q[0] - 0.0005, w + 0.002, 0.004, 0.003, aa);
  }
  rb(parent, M.dark, 0, y - 0.006, z, w + 0.004, 0.014, d + 0.008, 0.003, a);
}

/* buildGunModel (assemblage d'une arme montée) et les modèles eux-mêmes : 06j-modeles.js et suivants */

/* ---------- Grenade M67 : corps, cuillère, goupille ---------- */
/* Grenade en main, par type (NADE_TYPES) : frag (M67, ovoïde), flash (M84, cylindre gris percé), fumigène (M18, boîte kaki à bandeau clair) ; même
   bouchon, cuillère et anneau, au même endroit */
function buildGrenadeModel(M, type = 'frag') {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x2f3421, roughness: 0.62, metalness: 0.12, normalMap: M.poly.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  if (type === 'flash') {
    cy(g, M.metal, 0, -0.01, 0, 0.021, 0.085, 0);
    for (const y of [-0.035, 0.015]) cy(g, body, 0, y, 0, 0.0225, 0.012, 0); // bandes sombres
  } else if (type === 'smoke') {
    cy(g, body, 0, -0.012, 0, 0.029, 0.1, 0);
    cy(g, M.metal, 0, 0.026, 0, 0.0295, 0.014, 0); // bandeau clair
  } else if (type === 'knife') {
    throwKnifeBuild(g, throwKnifeSteel(), M.rubber);
    g.userData.spoon = new THREE.Object3D(); g.userData.ring = new THREE.Object3D(); g.add(g.userData.ring); // (ni cuillère ni anneau)
    return g;
  } else part(g, new THREE.SphereGeometry(1, 18, 14), body, 0, 0, 0, 0.032, 0.037, 0.032);
  cy(g, M.metal, 0, 0.038, 0, 0.011, 0.018, 0);
  const spoon = rb(g, M.metal, 0.02, 0.018, 0, 0.008, 0.07, 0.016, 0.003, 0, 0, 0.35); g.userData.spoon = spoon;
  const ring = part(g, G_TOR, M.metal, -0.018, 0.045, 0, 0.012, 0.012, 0.012, 0, Math.PI / 2, 0); g.userData.ring = ring;
  return g;
}
/* Couteau de lancer d'une pièce (repère : la pointe vers +y, la lame finit en y = 0,115, le pommeau en y = -0,08 ; plat dans le plan xy), en main
   (buildGrenadeModel) et en vol (tknifeTemplate, 07-bots.js) : une seule découpe d'acier, lame en pointe de lance et manche plein, extrudée avec un
   biseau tout autour qui fait le fil (pas de jour entre la lame et le manche : retour du propriétaire, l'ancien modèle de boîtes en laissait un) ;
   sur le manche, une cordelette noire enroulée en spires jointives, un peu inclinées. Géométries construites une fois, partagées */
const THROW_KNIFE_G = { steel: null, cord: null };
function throwKnifeSteel() { return THROW_KNIFE_G.mat || (THROW_KNIFE_G.mat = new THREE.MeshStandardMaterial({ color: 0xa3a7ab, roughness: 0.32, metalness: 0.9 })); }
function throwKnifeBuild(g, steel, cord) {
  const G = THROW_KNIFE_G;
  if (!G.steel) {
    const sh = new THREE.Shape(); // contour : du pommeau arrondi au bout de la lame, symétrique
    sh.moveTo(-0.0105, -0.072); sh.quadraticCurveTo(-0.0105, -0.08, 0, -0.08); sh.quadraticCurveTo(0.0105, -0.08, 0.0105, -0.072);
    sh.lineTo(0.0105, -0.002); sh.lineTo(0.0135, 0.018); sh.quadraticCurveTo(0.0142, 0.05, 0.0085, 0.084); sh.lineTo(0, 0.115);
    sh.lineTo(-0.0085, 0.084); sh.quadraticCurveTo(-0.0142, 0.05, -0.0135, 0.018); sh.lineTo(-0.0105, -0.002); sh.closePath();
    G.steel = new THREE.ExtrudeGeometry(sh, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0011, bevelSize: 0.0028, bevelOffset: -0.0028, bevelSegments: 1, curveSegments: 6, steps: 1 });
    G.steel.translate(0, 0, -0.0006); G.steel.computeVertexNormals();
    G.cord = rgeo(0.0252, 0.0086, 0.0086, 0.0038); // une spire de cordelette autour du manche (plat de 2,1 x 0,34 cm)
  }
  const m = new THREE.Mesh(G.steel, steel); m.castShadow = true; g.add(m);
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(G.cord, cord); c.position.set(0, -0.069 + i * 0.0084, 0); c.rotation.z = (i % 2 ? -1 : 1) * 0.08; c.castShadow = true; g.add(c); }
  return g;
}
const NADE_RIG = { g: null, arm: null, left: null, nade: null, ring: null };
function initNadeRig() {
  const M = gunMaterials(), g = new THREE.Group(); g.visible = false; VM.root.add(g);
  const R = makeArm(M, g, -1), L = makeArm(M, g, 1);
  const models = {}; for (const id of NADE_IDS) { models[id] = buildGrenadeModel(M, id); models[id].visible = false; g.add(models[id]); }
  const nade = models.frag, ring = nade.userData.ring;
  Object.assign(NADE_RIG, { g, R, L, nade, ring, M, models });
  if (VM.nadeRig) VM.nadeRig.visible = false;
}
function rigArm(a, S, T, pole, pose, roll, flex = 0) {
  placeArm(a, S, T, 0.34, 0.34, pole, 0.05, 0.043, roll, flex); a.hand.userData.set(pose);
}
const _nv = (x, y, z) => new V3(x, y, z);
function keyLerp(keys, t) {
  // interpolation douce entre positions clés [temps, x, y, z]
  if (t <= keys[0][0]) return _nv(keys[0][1], keys[0][2], keys[0][3]);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], u = smoothstep(0, 1, (t - a[0]) / (b[0] - a[0])); return _nv(lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)); }
  const k = keys[keys.length - 1]; return _nv(k[1], k[2], k[3]);
}
/* Courbe de Catmull-Rom par positions clés [temps, x, y, z] : contrairement à keyLerp, la main ne
   s'arrête pas à chaque clé, la vitesse est continue (indispensable pour un geste de lancer) */
function keySpline(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return _nv(keys[0][1], keys[0][2], keys[0][3]);
  if (t >= keys[n - 1][0]) { const k = keys[n - 1]; return _nv(k[1], k[2], k[3]); }
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u;
  const c = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3);
  return _nv(c(1), c(2), c(3));
}
/* Grenade, trois temps comme dans CoD :
   pull  : l'arme descend, la grenade monte dans la main droite, la gauche arrache l'anneau ;
   cook  : bras droit armé derrière l'épaule, grenade en haut à droite, bras gauche tendu vers l'avant ;
   throw : le bras passe par-dessus l'épaule, la grenade part à l'avant, le bras finit sa course en bas à gauche. */
const NADE_POSE = {
  armed: [0.24, -0.02, -0.26], guide: [-0.14, -0.14, -0.46],
  rollPull: [-1.9, -1.4], rollArmed: -1.4, rollThrow: -0.6, guidePose: 'relaxed', rollL: 0.9,
  pole: [0.8, -0.5, 0.35], poleThrow: [0.7, 0.4, 0.2], shoulderUp: 0.12, shoulderThrow: 0.16,
  pullR: [[0, 0.28, -0.4, -0.3], [0.1, 0.13, -0.2, -0.36], [0.24, 0.16, -0.18, -0.35], [0.42, 0.24, -0.02, -0.26]],
  pullL: [[0, -0.24, -0.42, -0.3], [0.1, 0.03, -0.22, -0.37], [0.2, 0.08, -0.16, -0.35], [0.28, -0.06, -0.2, -0.42], [0.42, -0.14, -0.14, -0.46]],
  // armé loin derrière l'épaule, fouetté très court jusqu'au point de lâcher (0,12 s), puis le bras croise vers le bas à gauche
  throwR: [[0, 0.24, -0.02, -0.26], [0.07, 0.31, 0.08, -0.1], [0.12, 0.07, 0.09, -0.5], [0.2, -0.1, -0.2, -0.53], [0.38, -0.08, -0.68, -0.36]],
  throwL: [[0, -0.14, -0.14, -0.46], [0.07, -0.1, -0.11, -0.52], [0.16, -0.28, -0.34, -0.38], [0.34, -0.32, -0.74, -0.2]],
  // rotation du buste pendant le lancer (lacet, roulis) : vers la droite à l'armé, vers la gauche à la détente
  twist: [[0, 0, 0, 0], [0.07, 0.08, -0.05, 0], [0.15, -0.1, 0.07, 0], [0.38, 0, 0, 0]],
};
/* Chaque grenade dans la main droite, par type : p, son centre dans le repère de la main (m ; x petit doigt, y dos de la main, z coude) ; r, sa
   rotation dans ce repère (degrés, x puis y puis z) ; les doigts : HAND_POSES.n<type> (06f-hands.js). Réglable au banc de réglage des grenades
   (?grenade=1, 09zj-grenade-reglage.js), qui donne la configuration à copier */
const NADE_GRIP = { // (réglé par le propriétaire au banc)
  frag: { p: [-0.003, -0.03, -0.021], r: [-136, 180, -80] },
  flash: { p: [-0.003, -0.03, -0.021], r: [-136, 180, -80] },
  smoke: { p: [-0.01, -0.027, -0.019], r: [-136, 180, -85] },
  knife: { p: [-0.081, -0.03, -0.021], r: [-66, 174, 86] },
};
const _ngE = new THREE.Euler(), _ngQ = new THREE.Quaternion();
/* Poignard de combat (couteau de tranchée) : lame de 18 cm à pointe en « clip », méplat rectifié jusqu'au tranchant,
   dents de scie sur le dos près de la garde, garde droite, manche rainuré en caoutchouc, pommeau avec son anneau.
   Repère : lame vers -z, dos de la lame (dents) vers +y, tranchant vers -y, garde en z = 0, manche vers +z.
   La lame est une surface lofée : à chaque tranche, cinq points (dos plat, méplat, tranchant) ; chaque face a ses
   propres sommets, donc ses arêtes restent vives. */
const KNIFE_L = 0.185;
function knifeBladeGeometry() {
  const L = KNIFE_L, pitch = 0.0046, serr0 = 0.014, serr1 = 0.088, depth = 0.0019;
  const ss = [];
  for (let s = 0; s < L - 1e-6; s += (s >= serr0 && s < serr1 ? pitch / 6 : 0.004)) ss.push(s);
  ss.push(L);
  const top = (s) => {
    let y = 0.0155;
    if (s > 0.108) y -= (0.0155 + 0.0016) * Math.pow((s - 0.108) / (L - 0.108), 1.7); // dos qui plonge vers la pointe
    if (s >= serr0 && s < serr1) { const u = ((s - serr0) / pitch) % 1; y -= depth * (u < 0.72 ? u / 0.72 : 1 - (u - 0.72) / 0.28); } // dents
    return y;
  };
  const bot = (s) => -0.0185 + (s > 0.095 ? 0.0165 * Math.pow((s - 0.095) / (L - 0.095), 2.3) : 0); // ventre puis remontée vers la pointe
  const pos = [], idx = [], N = ss.length;
  for (let i = 0; i < N; i++) {
    const s = ss[i], last = i === N - 1;
    let yt = top(s), yb = bot(s); if (yt - yb < 0.0006) { const m = (yt + yb) / 2; yt = m + 0.0003; yb = m - 0.0003; }
    const t = last ? 0 : 0.0024 * (1 - 0.55 * smoothstep(0.1, L, s)) * (1 - 0.9 * smoothstep(L - 0.012, L, s)), ym = yt - 0.52 * (yt - yb);
    const R = [[-t, yt], [t, yt], [t * 0.92, ym], [0, yb], [-t * 0.92, ym]];
    for (let f = 0; f < 5; f++) { const A = R[f], B = R[(f + 1) % 5]; pos.push(A[0], A[1], -s, B[0], B[1], -s); }
  }
  for (let i = 0; i < N - 1; i++) for (let f = 0; f < 5; f++) {
    const a = i * 10 + f * 2, c = (i + 1) * 10 + f * 2;
    idx.push(a, a + 1, c + 1, a, c + 1, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildKnifeModel(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(knifeBladeGeometry(), M.knifeSteel));
  // gouttière peinte (rainure sombre le long du méplat, des deux côtés)
  for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0023, 0.004, -0.058, 0.0008, 0.0042, 0.075);
  // talon (ricasso) et garde droite aux quillons arrondis
  bx(g, M.knifeSteel, 0, -0.001, -0.004, 0.0055, 0.034, 0.012);
  bx(g, M.metal, 0, -0.001, 0.0045, 0.0125, 0.062, 0.0085);
  for (const sy of [-1, 1]) part(g, G_CYL, M.metal, 0, -0.001 + sy * 0.031, 0.0045, 0.0064, 0.0085, 0.0064, Math.PI / 2, 0, 0);
  // manche : anneaux alternés (rainures des doigts), ovale (plus haut que large), caoutchouc noir
  for (let i = 0; i < 11; i++) {
    const ridge = i % 2 === 0;
    part(g, G_CYL, ridge ? M.poly : M.dark, 0, -0.002, 0.0125 + i * 0.0104 + 0.005, ridge ? 0.0136 : 0.0123, 0.0104, ridge ? 0.0158 : 0.0145, Math.PI / 2, 0, 0);
  }
  // pommeau : calotte d'acier et anneau pour la dragonne
  part(g, G_CYL, M.metal, 0, -0.002, 0.1305, 0.0135, 0.012, 0.0155, Math.PI / 2, 0, 0);
  part(g, new THREE.TorusGeometry(0.0072, 0.0019, 8, 16), M.metal, 0, -0.002, 0.1425, 1, 1, 1, 0, Math.PI / 2, 0);
  bakeRig(g);
  return g;
}
/* Coup de couteau : un balayage de gauche à droite, comme un coup d'épée. Le couteau reste tenu comme en main (KNIFE_HELD.grip, HAND_POSES.kgrip) ; le bras part sur la gauche, le
   poignet armé, puis balaie vers la droite en faisant tourner la lame autour de l'avant-bras comme l'aiguille d'une montre (KNIFE_STAB plus bas). Avant, un coup retournait le
   couteau en prise inversée, comme dans Modern Warfare 2, puis il piquait : le passage de la main tenue au coup se voyait. */
const KNIFE_DUR = 0.42, KNIFE_HIT = 0.34; // durée du geste (s) ; instant du contact (part de la durée)
/* Magnétisme du couteau (comme dans les anciens Call of) : à moins de near m, la visée est tirée vers le torse de la cible, plus
   faiblement jusqu'à range m, d'au plus max radians en tout (environ 11 degrés) ; cone : cosinus de l'angle de sélection de très près */
const KNIFE_MAG = { near: 1.9, range: 2.8, cone: 0.7, rate: 6, max: 0.2 };
/* Le coup d'origine, celui d'un appui simple sur le bouton couteau quand le couteau n'est pas en main : la main sort d'en bas, fend l'air et redescend, avec
   la prise de base (_km) et les doigts de HAND_POSES.grip. Poignet (espace de la caméra), puis [t, roulis de l'avant-bras, flexion du poignet, 0] : la main prolonge l'avant-bras */
const KNIFE_ANIM = {
  pos: [[0, 0.3, -0.45, -0.22], [0.09, 0.25, -0.14, -0.29], [0.2, 0.21, -0.08, -0.31], [0.27, 0.1, -0.07, -0.39], [0.34, -0.04, -0.08, -0.41], [0.41, -0.19, -0.11, -0.37], [0.53, -0.26, -0.18, -0.29], [0.76, -0.1, -0.42, -0.21], [1, 0.3, -0.45, -0.22]],
  rot: [[0, 0.3, 0, 0], [0.09, 0.4, 0, 0], [0.2, 0.45, 0.1, 0], [0.27, 0.35, 0, 0], [0.34, 0.25, 0, 0], [0.41, 0.15, 0, 0], [0.53, 0.15, 0, 0], [0.76, 0.25, 0, 0], [1, 0.3, 0, 0]],
  S: [0.24, -0.18, 0.2], pole: [0.8, -0.1, 0.15],
};
/* Base de la prise du couteau (knifeGripMatrix la retourne et la tourne), trouvée à l'écran de débogage sur la référence (repère de la main : x vers le petit doigt,
   y vers le dos de la main, z vers le coude). Ici : la lame revient vers le coude (back : angle avec l'axe du poing) en
   surplombant l'avant-bras (lift), dos denté contre l'avant-bras, tranchant vers le haut ; puis réglage fin : position de la
   garde (cm), rotation dans le repère de la main (rotH, degrés) et dans celui du couteau (rotK, degrés). */
const KNIFE_POSE = { back: 1.5, lift: 0.6, guard: [0.012, 0.014, -0.034], pos: [7.1, -3.7, 0], rotH: [-23, 57, -80], rotK: [3, 0, 2] };
const _km = (() => {
  const P = KNIFE_POSE, D = Math.PI / 180, cb = Math.cos(P.back), sb = Math.sin(P.back), cl = Math.cos(P.lift), sl = Math.sin(P.lift);
  const blade = new V3(cb * cl, sl, sb * cl).normalize(), up = new V3(0, 1, 0);
  const edge = up.clone().addScaledVector(blade, -up.dot(blade)).normalize();
  const B = new THREE.Matrix4().makeBasis(new V3().crossVectors(edge, blade), edge.clone().negate(), blade.clone().negate());
  const rot = (r) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0] * D, r[1] * D, r[2] * D, 'XYZ'));
  return rot(P.rotH).multiply(B).multiply(rot(P.rotK)).setPosition(P.guard[0] + P.pos[0] / 100, P.guard[1] + P.pos[1] / 100, P.guard[2] + P.pos[2] / 100);
})();
const _kg = new THREE.Matrix4();
/* Plus rien en main dans la vue subjective (mort du joueur, début d'une relecture) : couteau, bras et grenade du lancer, terminal et
   ordinateur des séries. updateRigs ne tourne que tant que le joueur vit : une mort au milieu d'un lancer ou d'un coup de couteau laissait
   ses bras figés à l'écran, sur la vue du corps qui tombe et pendant la killcam */
function vmClearHeld() {
  if (VM.knifeRig) VM.knifeRig.visible = false;
  if (VM.nadeRig) VM.nadeRig.visible = false;
  if (NADE_RIG.g) { NADE_RIG.g.visible = false; NADE_RIG.nade.userData.spoon.visible = true; }
  if (typeof ksAbort === 'function') ksAbort();
}
/* Couteau en main (bouton couteau maintenu, voir knifeButton) et coup de couteau : une seule prise, celle du poing refermé sur le manche, en poignée de main comme dans
   Counter-Strike (lame presque verticale). Tout se règle en direct avec le banc de réglage (?couteau=1, 09zk-couteau-reglage.js), qui donne la configuration à copier,
   ou à l'image avec couteau.js ; tout doit rester dans le champ, de la sortie à la course et au coup, sur un écran de 16:9 comme de 2,05:1 (couteau-main.js).
   KNIFE_HELD : le poignet (espace de la caméra, en mètres), le roulis de l'avant-bras (-1,57 : pouce en haut) et la flexion du poignet (rad), le coude (pole) et l'épaule (S) ;
   grip : flip, lame du côté du pouce plutôt que du petit doigt ; pitch, phi et tilt, degrés dont le couteau tourne autour de x (en travers du poing), y (dans la paume) et z
   (de l'avant-bras) dans le repère de la main ; roll, degrés autour du manche ; mid, milieu du manche dans la main.
   run : la course. Décalage du poignet, du roulis et de la flexion à fond de sprint, puis amplitude des foulées (amp : x, va-et-vient latéral ; y, creux de chaque pas ; z, le
   bras qui pompe d'avant en arrière ; rouler et flexAmp : roulis et flexion du poignet), phase de la foulée en radians. */
const KNIFE_HELD = {
  pos: [0.205, -0.18, -0.41], roll: -1.02, flex: -0.12, pole: [1.2, -0.85, 0], S: [0.24, -0.18, 0.2],
  grip: { flip: true, phi: -16, tilt: 3, pitch: 0, roll: -3, mid: [-0.01, -0.022, -0.015] },
  run: { pos: [0, 0.05, 0], roll: -0.1, flex: 0.15, amp: [0.02, 0.02, 0.04], rouler: 0.12, flexAmp: 0.15, phase: 0 },
};
/* Le coup, de la pose tenue à deux poses complètes : start (le geste armé, à gauche) et end (la fin du balayage, à droite), chacune avec tous les réglages de la main tenue :
   poignet (mètres, caméra), roulis de l'avant-bras et flexion du poignet (rad), coude (pole), épaule (S), prise du couteau (phi, tilt, pitch, roll en degrés, mid : milieu du manche
   dans la main ; flip reste celui de KNIFE_HELD.grip) et doigts (fingers : mêmes champs que HAND_POSES.kgrip, le pouce en huit angles). Réglage du propriétaire : le balayage vient du
   poignet (de -0,285 à 0,6 en x), du coude et de l'épaule, le roulis restant autour de -0,9 ; la prise tourne en fin de coup (phi de -13 à -49, tilt 9, pitch 27).
   Le temps t va de 0 à 1 sur KNIFE_DUR : de la pose tenue à start (jusqu'à tStart), de start à end (jusqu'à tEnd, avec ease : 0 à vitesse constante, 1 doux au départ et à l'arrivée,
   et arc, un détour du poignet au milieu du balayage, en mètres), puis de end à la pose tenue. Le contact tombe à KNIFE_HIT. Sans couteau en main, la main monte de low
   (hors champ) pendant rise et y redescend pendant fall. */
const KNIFE_STAB = {
  low: [0.3, -0.45, -0.22], rise: [0, 0.18], fall: [0.72, 1], tStart: 0.14, tEnd: 0.46, ease: 0.5, arc: [0, 0, -0.08],
  start: {
    pos: [-0.285, 0.015, -0.415], roll: -0.94, flex: -0.06, pole: [2, -0.8, 0.45], S: [0.27, -0.18, 0.2],
    grip: { phi: -13, tilt: 3, pitch: 0, roll: -3, mid: [-0.01, -0.022, -0.015] },
    fingers: { i: [1.37, 1.35, 0.67], m: [1.48, 1.5, 0.95], r: [1.3, 1.5, 0.95], p: [1.3, 1.5, 0.95], t: [0.42, 0.47, -0.16, 0.89, -1.37, 0.06, 0.28, -0.16], spread: 0 },
  },
  end: {
    pos: [0.6, -0.325, -0.425], roll: -0.88, flex: -0.1, pole: [0.55, 0.2, -1.45], S: [0.15, -0.19, 0.5],
    grip: { phi: -49, tilt: 9, pitch: 27, roll: -3, mid: [-0.01, -0.022, -0.015] },
    fingers: { i: [1.37, 1.35, 0.67], m: [1.48, 1.5, 0.95], r: [1.3, 1.5, 0.95], p: [1.3, 1.5, 0.95], t: [0.42, 0.47, -0.16, 0.89, -1.37, 0.06, 0.28, -0.16], spread: 0 },
  },
};
/* Une pose à plat, pour mélanger deux poses d'un coup : poignet (3), roulis, flexion, coude (3), épaule (3), prise phi tilt pitch roll (4) et milieu du manche (3), doigts i m r p
   (12), pouce (8), écart (1) : 39 nombres. P : poignet, coude, épaule et prise ; G : les doigts (HAND_POSES.kgrip pour la pose tenue, start.fingers pour le début du coup). */
const KP_N = 39, _kpB = new Float64Array(KP_N), _kpS = new Float64Array(KP_N), _kpE = new Float64Array(KP_N), _kpF = new Float64Array(KP_N);
function knifePut(out, n, a) { for (let j = 0; j < a.length; j++) out[n++] = a[j]; return n; }
function knifeFlat(P, G, out) {
  const g = P.grip; let n = knifePut(out, 0, P.pos); out[n++] = P.roll; out[n++] = P.flex; n = knifePut(out, n, P.pole); n = knifePut(out, n, P.S);
  out[n++] = g.phi; out[n++] = g.tilt; out[n++] = g.pitch; out[n++] = g.roll; n = knifePut(out, n, g.mid);
  n = knifePut(out, n, G.i); n = knifePut(out, n, G.m); n = knifePut(out, n, G.r); n = knifePut(out, n, G.p); n = knifePut(out, n, G.t); out[n] = G.spread;
  return out;
}
function knifeMix(a, b, w, out) { for (let j = 0; j < KP_N; j++) out[j] = a[j] + (b[j] - a[j]) * w; return out; }
/* Matrice couteau vers main d'une prise : la base (_km, lame vers le coude), retournée bout pour bout (flip) et tournée autour du manche (roll), puis tournée dans le repère
   de la main : pitch autour de x, phi autour de y, tilt autour de z ; le milieu du manche posé en mid. Écrite dans out si on en donne une (rien d'alloué). */
const _gmX = new THREE.Matrix4(), _gmC = new V3();
function knifeGripMatrix(P, out = new THREE.Matrix4()) {
  const D = Math.PI / 180, R = out.extractRotation(_km);
  if (P.flip) R.multiply(_gmX.makeRotationY(Math.PI));
  if (P.roll) R.multiply(_gmX.makeRotationZ(P.roll * D));
  if (P.pitch) R.premultiply(_gmX.makeRotationX(P.pitch * D));
  R.premultiply(_gmX.makeRotationY((P.phi || 0) * D));
  if (P.tilt) R.premultiply(_gmX.makeRotationZ(P.tilt * D));
  const c = _gmC.set(0, -0.002, 0.07).applyMatrix4(R); // milieu du manche, dans le repère du couteau tourné
  return R.setPosition(P.mid[0] - c.x, P.mid[1] - c.y, P.mid[2] - c.z);
}
const _kgmH = new THREE.Matrix4(), _kgmS = new THREE.Matrix4(), _gpS = { flip: true, phi: 0, tilt: 0, pitch: 0, roll: 0, mid: [0, 0, 0] }, _knP = new V3();
function knifeGripSet() { knifeGripMatrix(KNIFE_HELD.grip, _kgmH); } // la prise tenue, une fois pour toutes (le banc de réglage la recalcule)
knifeGripSet();
const _knH = { p: new V3(), roll: 0, flex: 0 };
/* La pose tenue : montée depuis le bas selon hold (0 hors champ, 1 en main), puis la course (S.sprint, foulée de VM.bobT) */
function knifeHeld(S, hold) {
  const H = KNIFE_HELD, R = H.run, r0 = KNIFE_STAB.low, e = smoothstep(0, 1, hold), sp = clamp(S.sprint || 0, 0, 1.08), k = sp * Math.min(1, VM.bobAmt || 0), p = _knH.p;
  const ph = VM.bobT + R.phase, s1 = Math.sin(ph), c1 = Math.cos(ph), c2 = (Math.cos(2 * ph) - 1) * 0.5;
  p.set(lerp(r0[0], H.pos[0], e), lerp(r0[1], H.pos[1], e), lerp(r0[2], H.pos[2], e));
  p.x += R.pos[0] * sp + c1 * R.amp[0] * k; p.y += R.pos[1] * sp + Math.sin(VM.breath * 1.6) * 0.003 * (1 - sp) + c2 * R.amp[1] * k; p.z += R.pos[2] * sp + s1 * R.amp[2] * k;
  _knH.roll = H.roll - (1 - e) * 0.9 + R.roll * sp + s1 * R.rouler * k; _knH.flex = H.flex + R.flex * sp + c1 * R.flexAmp * k;
  return _knH;
}
/* La pose du coup à l'instant t (0 à 1), dans F : de la pose tenue (B) à start, de start à end, de end à la pose tenue */
function knifeStabPose(t, B, F) {
  const Z = KNIFE_STAB, t0 = Math.max(0.001, Z.tStart), t1 = Math.max(t0 + 0.001, Z.tEnd);
  knifeFlat(Z.start, Z.start.fingers, _kpS); knifeFlat(Z.end, Z.end.fingers, _kpE);
  if (t < t0) return knifeMix(B, _kpS, smoothstep(0, 1, t / t0), F);
  if (t < t1) {
    const u = (t - t0) / (t1 - t0), w = lerp(u, smoothstep(0, 1, u), clamp(Z.ease, 0, 1)), bump = Math.sin(Math.PI * u);
    knifeMix(_kpS, _kpE, w, F); F[0] += Z.arc[0] * bump; F[1] += Z.arc[1] * bump; F[2] += Z.arc[2] * bump;
    return F;
  }
  return knifeMix(_kpE, B, smoothstep(0, 1, (t - t1) / Math.max(0.001, 1 - t1)), F);
}
/* Crochet du banc de réglage (09zk-couteau-reglage.js, ouvert avec ?couteau=1) : il peut forcer l'état passé à updateRigs (repos, course, coup) */
let KNIFE_DEBUG = null;
let NADE_DEBUG = null; // crochet du banc de réglage des grenades (09zj-grenade-reglage.js, ?grenade=1) : il peut forcer l'état passé à updateRigs (tenue, dégoupillage, lancer)
function updateRigs(dt, S) {
  const k = VM.knifeRig, hold = S.knifeHold || 0, stab = S.knifeT > 0;
  if (stab && !S.knifeNew) { // appui simple, le couteau n'était pas en main : le coup d'origine
    const t = 1 - S.knifeT / KNIFE_DUR, A = KNIFE_ANIM, arm = VM.knifeArm; k.visible = true;
    k.position.copy(VM.bobO); k.rotation.set(VM.bobR.x, VM.bobR.y, VM.bobR.z);
    const p = keySpline(A.pos, t), r = keySpline(A.rot, t);
    placeArm(arm, _nv(...A.S), p, 0.34, 0.34, _nv(A.S[0] + A.pole[0], A.S[1] + A.pole[1], A.S[2] + A.pole[2]), 0.05, 0.043, r.x, r.y);
    arm.hand.userData.set('grip');
    arm.hand.updateMatrix(); _kg.copy(arm.hand.matrix).multiply(_km); _kg.decompose(VM.knife.position, VM.knife.quaternion, VM.knife.scale);
  } else if (stab || hold > 0.01) {
    const arm = VM.knifeArm, Z = KNIFE_STAB, F = _kpF, B = _kpB, low = Z.low;
    const H = knifeHeld(S, stab ? 1 : hold); // la pose tenue (à la course comprise) : celle d'où le coup part et où il revient, ou la montée du couteau qu'on sort
    knifeFlat(KNIFE_HELD, HAND_POSES.kgrip, B); B[0] = H.p.x; B[1] = H.p.y; B[2] = H.p.z; B[3] = H.roll; B[4] = H.flex;
    if (stab) {
      const t = 1 - S.knifeT / KNIFE_DUR, up = Math.max(hold, smoothstep(Z.rise[0], Z.rise[1], t) * (1 - smoothstep(Z.fall[0], Z.fall[1], t))), e = smoothstep(0, 1, up);
      knifeStabPose(t, B, F);
      for (let j = 0; j < 3; j++) F[j] = lerp(low[j], F[j], e); F[3] -= (1 - e) * 0.9; // à mains nues, la main monte d'en bas et y redescend
    } else F.set(B);
    k.visible = true;
    k.position.copy(VM.bobO); k.rotation.set(VM.bobR.x, VM.bobR.y, VM.bobR.z);
    placeArm(arm, _nv(F[8], F[9], F[10]), _knP.set(F[0], F[1], F[2]), 0.34, 0.34, _nv(F[8] + F[5], F[9] + F[6], F[10] + F[7]), 0.05, 0.043, F[3], F[4]);
    // les doigts et le poignard suivent la pose : pendant le coup, les doigts passent par HAND_POSES.kstab et la prise est recalculée à chaque image
    let M = _kgmH, pose = 'kgrip';
    if (stab) {
      const D = HAND_POSES.kstab, g = _gpS;
      for (let j = 0; j < 3; j++) { D.i[j] = F[18 + j]; D.m[j] = F[21 + j]; D.r[j] = F[24 + j]; D.p[j] = F[27 + j]; }
      for (let j = 0; j < 8; j++) D.t[j] = F[30 + j];
      D.spread = F[38]; pose = 'kstab';
      g.flip = KNIFE_HELD.grip.flip; g.phi = F[11]; g.tilt = F[12]; g.pitch = F[13]; g.roll = F[14]; g.mid[0] = F[15]; g.mid[1] = F[16]; g.mid[2] = F[17];
      M = knifeGripMatrix(g, _kgmS);
    }
    arm.hand.userData.set(pose);
    arm.hand.updateMatrix(); _kg.copy(arm.hand.matrix).multiply(M); _kg.decompose(VM.knife.position, VM.knife.quaternion, VM.knife.scale);
  } else k.visible = false;
  if (!NADE_RIG.g) initNadeRig();
  const N = NADE_RIG, g = N.g, P = NADE_POSE;
  if (VM.nadeRig) VM.nadeRig.visible = false;
  if (!S.nadeState) { g.visible = false; N.nade.userData.spoon.visible = true; return; }
  const want = N.models[PL.nadeType] || N.models.frag; // la grenade de la classe
  if (N.nade !== want) { if (N.ring.parent !== N.nade) N.nade.add(N.ring); N.nade.visible = false; N.nade = want; N.ring = want.userData.ring; }
  g.visible = true;
  // les bras suivent le pas et le regard comme l'arme
  g.position.copy(VM.bobO); g.rotation.set(VM.bobR.x, VM.bobR.y, VM.bobR.z);
  const t = S.nadeT || 0;
  // l'épaule droite se lève quand le bras s'arme, le coude monte pendant le lancer
  const up = S.nadeState === 'pull' ? smoothstep(0.2, 0.42, t) : S.nadeState === 'cook' ? 1 : 1 - smoothstep(0.12, 0.3, t);
  const th = S.nadeState === 'throw' ? Math.sin(clamp(t / 0.24, 0, 1) * Math.PI) : 0;
  // au fouetté, l'épaule monte encore : le bras passe par-dessus au lieu d'arriver d'en bas
  const SR = _nv(0.22, -0.34 + P.shoulderUp * up + P.shoulderThrow * th, 0.22), SL = _nv(-0.24, -0.36, 0.2);
  const pole = _nv(lerp(P.pole[0], P.poleThrow[0], th), lerp(P.pole[1], P.poleThrow[1], th), lerp(P.pole[2], P.poleThrow[2], th));
  const ty = NADE_GRIP[PL.nadeType] ? PL.nadeType : 'frag', NG = NADE_GRIP[ty], hPose = 'n' + ty; // la prise et les doigts du type
  let hr, hl, lVis = true, nadeInHand = true, rRoll = P.rollArmed, lRoll = P.rollL, rPose = hPose, lPose = 'pinch', ringL = true;
  if (S.nadeState === 'pull') {
    hr = keySpline(P.pullR, t); hl = keySpline(P.pullL, t);
    // secousse de la main droite quand l'anneau est arraché
    hr.x += Math.sin(clamp((t - 0.22) / 0.08, 0, 1) * Math.PI) * 0.012;
    rRoll = lerp(P.rollPull[0], P.rollPull[1], smoothstep(0.22, 0.42, t));
    ringL = t >= NADE_ANIM.pin; lPose = t < 0.12 || t > 0.34 ? 'open' : 'pinch';
    lRoll = lerp(1.9, P.rollL, smoothstep(0.28, 0.42, t));
  } else if (S.nadeState === 'cook') {
    // bras armé : léger balancement, tremblement qui monte quand la mèche approche de la fin
    const c = S.cookT || 0, f = nadeFuse(PL.nadeType), tr = f > 0 ? smoothstep(f * 0.43, f, c) * 0.004 : 0; // (le couteau de lancer n'a pas de mèche)
    hr = _nv(P.armed[0] + Math.sin(c * 1.7) * 0.003 + (Math.random() - 0.5) * tr, P.armed[1] + Math.sin(c * 2.3) * 0.004 + (Math.random() - 0.5) * tr, P.armed[2]);
    hl = _nv(P.guide[0], P.guide[1] + Math.sin(c * 1.9 + 1) * 0.003, P.guide[2]);
    rRoll = P.rollArmed; lPose = P.guidePose;
  } else {
    hr = keySpline(P.throwR, t); hl = keySpline(P.throwL, t);
    rRoll = lerp(P.rollArmed, P.rollThrow, smoothstep(0.07, 0.2, t));
    const tw = keySpline(P.twist, t); g.rotation.y += tw.x; g.rotation.z += tw.y;
    nadeInHand = t < NADE_ANIM.release; rPose = nadeInHand ? hPose : t < NADE_ANIM.release + 0.1 ? 'open' : 'relaxed';
    lVis = t < 0.33; lPose = 'relaxed';
  }
  rigArm(N.R, SR, hr, pole, rPose, rRoll);
  rigArm(N.L, SL, hl, _nv(-0.7, -0.7, 0), lPose, lRoll);
  setArmVisible(N.L, lVis);
  // l'anneau et sa goupille restent au doigt de la main gauche une fois arrachés
  if (ringL) { if (N.ring.parent !== N.L.hand) N.L.hand.add(N.ring); N.ring.position.set(0.004, -0.018, -0.075); N.ring.visible = lVis; }
  else { if (N.ring.parent !== N.nade) N.nade.add(N.ring); N.ring.position.set(-0.018, 0.045, 0); N.ring.visible = true; }
  if (S.nadeState === 'pull' && t < 0.05) N.nade.userData.spoon.visible = true;
  N.nade.visible = nadeInHand;
  if (nadeInHand) {
    const D = Math.PI / 180;
    N.nade.position.copy(N.R.hand.position).add(_nv(NG.p[0], NG.p[1], NG.p[2]).applyQuaternion(N.R.hand.quaternion));
    N.nade.quaternion.copy(N.R.hand.quaternion).multiply(_ngQ.setFromEuler(_ngE.set(NG.r[0] * D, NG.r[1] * D, NG.r[2] * D)));
  }
}

/* ---------- Terminal des séries (UAV, hélicoptère) : boîtier durci tenu dans la main droite, bouton d'appel pressé au pouce ----------
   Repère du boîtier : x vers la droite, y vers le haut, z vers l'avant de l'écran. Le dos repose dans la paume, les doigts
   passent derrière et se referment sur le flanc gauche, le pouce passe par-dessus le flanc droit et vient sur le bouton d'appel,
   sous l'écran. */
const PHONE = { w: 0.074, h: 0.142, d: 0.022, btn: [0, -0.044], scr: [0.058, 0.07, 0.024] };
/* Matières des appareils des séries (terminal, tablette) : coque olive, façade sombre et lisse, sans le grain des armes (sur une coque de
   26 cm, la carte de relief des armes, tendue sur chaque face, faisait de la pierre) */
function ksDevMats() {
  if (KS.mats) return KS.mats;
  const M = gunMaterials();
  return (KS.mats = { shell: new THREE.MeshStandardMaterial({ color: 0x565c40, roughness: 0.66, metalness: 0.04 }), face: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.38, metalness: 0.15 }), rubber: M.rubber, metal: M.metal });
}
function buildPhoneRig() {
  const M = gunMaterials(), K = ksDevMats(), g = new THREE.Group(), D = PHONE;
  g.visible = false; VM.root.add(g);
  const dev = new THREE.Group(); g.add(dev);
  // coque olive, bandes de caoutchouc sur les flancs, coins renforcés
  rb(dev, K.shell, 0, 0, 0, D.w, D.h, D.d, 0.009);
  for (const sx of [-1, 1]) {
    rb(dev, K.rubber, sx * (D.w / 2 - 0.002), -0.006, 0, 0.007, D.h - 0.036, D.d + 0.002, 0.003);
    for (const sy of [-1, 1]) rb(dev, K.rubber, sx * (D.w / 2 - 0.006), sy * (D.h / 2 - 0.007), 0, 0.016, 0.018, D.d + 0.004, 0.005);
  }
  // façade : cadre sombre de l'écran, grille du haut-parleur, bouton d'appel dans sa garde, deux touches
  rb(dev, K.face, 0, 0.014, D.d / 2 + 0.0004, 0.064, 0.096, 0.002, 0.004);
  for (let i = 0; i < 4; i++) rb(dev, K.rubber, -0.012 + i * 0.008, 0.063, D.d / 2 + 0.0006, 0.005, 0.0014, 0.001, 0.0005);
  const ring = new THREE.Mesh(G_TOR, K.metal); ring.scale.set(0.0118, 0.0118, 0.016); ring.position.set(D.btn[0], D.btn[1], D.d / 2 + 0.0008); dev.add(ring);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x8fd16a, emissive: new THREE.Color().setRGB(0.2, 0.5, 0.15), roughness: 0.4 }));
  btn.rotation.x = Math.PI / 2; btn.position.set(D.btn[0], D.btn[1], D.d / 2 + 0.0015); dev.add(btn);
  for (const sx of [-1, 1]) rb(dev, K.face, sx * 0.024, D.btn[1], D.d / 2 + 0.0006, 0.012, 0.007, 0.002, 0.002);
  // antenne courte en caoutchouc sur le coin supérieur gauche, embase crantée ; anneau de dragonne en bas
  cy(dev, K.metal, -0.022, D.h / 2 + 0.003, -0.002, 0.0062, 0.008, 0);
  cy(dev, K.rubber, -0.022, D.h / 2 + 0.022, -0.002, 0.0045, 0.032, 0);
  part(dev, new THREE.SphereGeometry(1, 10, 8), K.rubber, -0.022, D.h / 2 + 0.038, -0.002, 0.0045, 0.0045, 0.0045);
  const loop = new THREE.Mesh(G_TOR, K.face); loop.scale.set(0.006, 0.006, 0.02); loop.position.set(0.022, -D.h / 2 - 0.002, -0.004); loop.rotation.y = Math.PI / 2; dev.add(loop);
  const sc = document.createElement('canvas'); sc.width = 144; sc.height = 174;
  const tex = new THREE.CanvasTexture(sc); tex.encoding = THREE.sRGBEncoding;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(D.scr[0], D.scr[1]), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(1.5, 1.5, 1.5) }));
  scr.position.set(0, D.scr[2], D.d / 2 + 0.0016); dev.add(scr);
  // main droite : paume derrière la moitié droite du boîtier, doigts vers la gauche et l'arrière (ils se referment sur le flanc gauche),
  // dos de la main vers l'extérieur ; le pouce, du côté radial, passe par-dessus le flanc droit jusqu'au bouton
  const grip = devGrip(dev, PHONE_GRIP.p, PHONE_GRIP.f, PHONE_GRIP.b);
  const arm = makeArm(M, VM.root, -1); setArmVisible(arm, false);
  bakeRig(g, { keep: [btn] });
  KS.phone = { g, tex, sc, grip, arm, btn, press: (pk) => { btn.position.z = D.d / 2 + 0.0015 - pk * 0.0018; } };
}
const PHONE_GRIP = { p: [0.042, -0.046, -0.024], f: [-0.6, 0.6, -0.5], b: [0.55, 0.2, -0.85] };
/* Écran du terminal : titre (série appelée), balayage radar, état ; les textes sont ramenés à la largeur de l'écran */
function drawPhoneScreen(pressed) {
  const P = KS.phone, g = P.sc.getContext('2d'), W = P.sc.width, H = P.sc.height, t = MATCH.time;
  g.fillStyle = '#081109'; g.fillRect(0, 0, W, H);
  const fit = (txt, y, size, col) => { g.font = `700 ${size}px "Barlow Condensed", sans-serif`; const k = Math.min(1, (W - 16) / Math.max(1, g.measureText(txt).width)); g.save(); g.translate(W / 2, y); g.scale(k, 1); g.fillStyle = col; g.fillText(txt, 0, 0); g.restore(); };
  g.textAlign = 'center';
  g.fillStyle = 'rgba(143,209,106,0.16)'; g.fillRect(0, 0, W, 30);
  fit(KSDEF[KS.mode] ? KSDEF[KS.mode].name : _t('UAV'), 22, 20, '#d4f7d8');
  const cx = W / 2, cy = 96, R = 50;
  g.strokeStyle = 'rgba(140,230,150,0.35)'; g.lineWidth = 1.5;
  for (const r of [R / 3, R * 2 / 3, R]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  const a = t * 3;
  if (g.createConicGradient) { const grd = g.createConicGradient(a - 0.9, cx, cy); grd.addColorStop(0, 'rgba(140,230,150,0)'); grd.addColorStop(0.14, 'rgba(140,230,150,0.38)'); grd.addColorStop(0.145, 'rgba(140,230,150,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); }
  g.strokeStyle = '#9fe6a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
  if (pressed) { g.fillStyle = '#ff5a48'; for (const [x, y] of [[0.4, -0.5], [-0.55, 0.2], [0.15, 0.6]]) { g.beginPath(); g.arc(cx + x * R, cy + y * R, 3.5, 0, TAU); g.fill(); } }
  const on = pressed && Math.floor(t * 5) % 2 === 0;
  g.fillStyle = pressed ? (on ? 'rgba(143,209,106,0.5)' : 'rgba(143,209,106,0.28)') : 'rgba(143,209,106,0.16)'; g.fillRect(8, H - 32, W - 16, 24);
  const done = { heli: _t('Hélicoptère en approche'), sat: _t('Satellite en ligne'), iem: _t('IEM déclenchée'), fpv: _t('Drone en vol') }[KS.mode] || _t('UAV en ligne');
  fit(pressed ? done : _t('Appuyer pour appeler'), H - 14, 17, '#d4f7d8');
  g.textAlign = 'left'; P.tex.needsUpdate = true;
}

/* ---------- Mains posées sur l'arme ----------
   Le repère de chaque main est défini dans l'espace de l'arme : la poignée est au creux
   des doigts refermés (et non plus au poignet), puis l'avant-bras rejoint le poignet par IK. */
const _hm = new THREE.Matrix4(), _hx = new V3(), _hy = new V3(), _hz = new V3();
/* repère à partir de l'axe du poignet (z, de la paume vers l'avant-bras) et d'une indication pour le dos de la main (y) */
function frameZY(z, y) { _hz.set(...z).normalize(); _hy.set(...y); _hx.crossVectors(_hy, _hz).normalize(); _hy.crossVectors(_hz, _hx).normalize(); _hm.makeBasis(_hx, _hy, _hz); return new THREE.Quaternion().setFromRotationMatrix(_hm); }
/* Main d'appui sous un garde-main (main gauche) : la paume est posée sur le dessous gauche du garde-main (roulis roll autour du
   canon, rad) ; les doigts partent vers la droite et l'avant, à yaw (rad) du canon, et remontent sur le flanc droit ; le pouce (côté
   x de la main) file vers la bouche le long du flanc gauche. Avec pitch nul, la paume est tangente au garde-main, mais le poignet
   casse : l'avant-bras, qui arrive d'en bas, n'est pas dans le plan de la paume. pitch (rad) relève la paume vers l'avant (base des
   doigts contre le garde-main, talon plus bas, comme une vraie main) et remet le poignet dans le prolongement de l'avant-bras ; la
   hauteur mesurée sur le maillage (palmLift) garde la paume hors de l'arme. */
function frameUnder(roll, yaw, pitch = 0) {
  const sr = Math.sin(roll), cr = Math.cos(roll), sy = Math.sin(yaw), cy = Math.cos(yaw);
  _hy.set(-sr, -cr, 0); _hz.set(-sy * cr, sy * sr, cy); _hx.crossVectors(_hy, _hz); _hm.makeBasis(_hx, _hy, _hz);
  return new THREE.Quaternion().setFromRotationMatrix(_hm).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -pitch));
}
function frameQ(x, y) { _hx.set(...x).normalize(); _hy.set(...y).normalize(); _hz.crossVectors(_hx, _hy).normalize(); _hy.crossVectors(_hz, _hx).normalize(); _hm.makeBasis(_hx, _hy, _hz); return new THREE.Quaternion().setFromRotationMatrix(_hm); }
const HAND_FRAMES = {
  // x : alignement des jointures (le long de la poignée), y : dos de la main ; off : position de l'objet tenu dans le repère de la main
  R: { q: frameQ([0, -0.946, 0.324], [1, 0, 0]), off: new V3(0.008, -0.03, -0.015), pose: 'trigger', side: -1, axis: new V3(1, 0, 0), range: 0.6 },
  Rp: { q: frameQ([0, -0.976, 0.218], [1, 0, 0]), off: new V3(0.012, -0.028, -0.018), pose: 'ptrig', side: -1, axis: new V3(1, 0, 0), range: 0.5, axis2: new V3(0, 1, 0), range2: 0.5 },
  // main gauche sous le garde-main : voir frameUnder ; off.y est remplacé par la distance mesurée sur chaque arme (lHandFrame)
  L: { q: frameUnder(0.55, 1.0, 0.5), off: new V3(0, -0.048, -0.012), pose: 'support', side: 1, range: 0.5 },
  Lp: { q: frameQ([0, 0.976, -0.218], [-1, 0, 0]), off: new V3(-0.004, -0.028, -0.028), pose: 'psup', side: 1, axis: new V3(1, 0, 0), range: 0.5, axis2: new V3(0, 1, 0), range2: 0.5 },
  // culasse du pistolet saisie par le flanc gauche : main à plat contre la glissière, doigts vers l'avant, pouce en haut ;
  // rien au-dessus de la glissière, les organes de visée restent dégagés
  Lr: { q: frameQ([0, 1, 0], [-1, 0, 0]), off: new V3(0, -0.015, -0.02), pose: 'slap', side: 1, axis: new V3(1, 0, 0), range: 0.4 },
  // poignée de culasse saisie par le dessus, doigts refermés sur la boule
  // l'avant-bras arrive de l'arrière et de la droite (et non perpendiculairement à l'arme, ce qu'aucun poignet n'accepte) ;
  // la main peut tourner autour de la boule de la poignée
  Rb: { q: frameQ([0.66, -0.15, -0.75], [0, 1, -0.2]), off: new V3(0, -0.02, -0.03), pose: 'pinch', side: -1, axis: new V3(0, 1, 0), range: 0.55 },
};
// prise en « C » des fusils modernes : paume sur le flanc gauche du garde-main, pouce tendu par-dessus vers l'avant,
// doigts qui passent dessous ; le poignet arrive de l'arrière et de la gauche (main bien visible à l'écran)
HAND_FRAMES.Lcc = { q: frameZY([-0.15, -0.12, 1], [-0.92, 0.28, 0.1]), off: new V3(0.012, -0.046, -0.042), pose: 'cclamp', side: 1, range: 0.35 };
// le garde-main est un cylindre : la main gauche peut rouler autour du canon sans le lâcher
for (const k of ['L', 'Lcc']) HAND_FRAMES[k].axis = new V3(0, 0, -1).applyQuaternion(HAND_FRAMES[k].q.clone().invert());
// poignée d'appui verticale, empoignée comme la main droite tient la sienne (en miroir) : jointures le long de la poignée, index en
// haut sous la semelle de la poignée, paume sur son flanc gauche, doigts qui passent devant et se referment sur le flanc droit, pouce
// qui fait le tour par l'arrière. Comme une vraie main qui empoigne, la poignée passe en travers de la paume (0,35 rad autour de sa
// normale) et la main est tournée de 0,55 rad autour d'elle : l'avant-bras, qui arrive d'en bas, de l'arrière et de la gauche,
// prolonge alors le poignet au lieu de le casser ; elle tient la poignée 2 cm sous le garde-main, où l'index, incliné, a sa place.
// La main peut tourner autour de la poignée, et un peu en travers (axis2). frameFgrip : même prise sur une poignée inclinée vers
// l'arrière de rake (rad, le bas vers le tireur), en travers de la paume de diag (rad)
function frameFgrip(rake, diag) {
  return new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -rake).multiply(frameQ([0, 1, -0.05], [-1, 0, 0]))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -0.55)).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), diag));
}
HAND_FRAMES.Lv = { q: frameFgrip(0, -0.35), off: new V3(0.02, -0.03, -0.015), pose: 'fgrip', side: 1, axis: new V3(1, 0, 0), range: 0.6, axis2: new V3(0, 1, 0), range2: 0.5 };
// poignée angulaire (06p-accessoires.js) : inclinée de AGRIP_RAKE vers l'arrière, empoignée comme la verticale mais bien plus en
// travers de la paume (son bas vient vers l'avant-bras, qui arrive d'en bas : sans cela le poignet casse, surtout en visée), la
// main 2,8 cm plus bas sur le fût (le haut du poing toucherait le garde-main). Les soldats, dont le poing figé est fait pour une
// poignée droite dans la main (SOLDIER_LGRIP), la prennent comme la verticale (soldat)
const AGRIP_RAKE = 0.5;
HAND_FRAMES.La = { q: frameFgrip(AGRIP_RAKE, -0.85), off: new V3(0.028, -0.03, -0.015), pose: 'fgrip', side: 1, axis: new V3(1, 0, 0), range: 0.6, axis2: new V3(0, 1, 0), range2: 0.5 };
HAND_FRAMES.La.soldat = Object.assign({}, HAND_FRAMES.La, { q: frameFgrip(AGRIP_RAKE, -0.35) });
/* Formes de prise des mains (gripDef) et détente (trigDef) de chaque arme : dans le modèle (06j-modeles.js, gripShapes) */
/* Repère de la main d'appui d'une arme (vue subjective et soldats) : sous le garde-main (L) sur toutes les armes longues (la main
   soutient l'arme, coude plié), autour de la poignée d'appui quand l'arme en porte une (info.lFrame, posé par l'accessoire), sur la
   main droite au pistolet ; la prise en « C » (Lcc) reste disponible. La paume se pose sur le garde-main (ou contre la poignée), à la
   distance mesurée sur le maillage de l'arme pour chaque roulis de la main (palmLift). Un repère par arme montée et par point de
   prise G (celui de la vue subjective, ou celui des soldats quand le modèle en donne un autre : tag le distingue), et par écrasement
   de la base des doigts (soft : celui de la main figée des soldats est plus grand, voir palmGrid). */
const L_FRAMES = {};
function lHandFrame(m, G = m.gripL, tag = '', soft = PG.soft) {
  if (m.kind === 'pistol') return HAND_FRAMES.Lp;
  const k = m.key + tag + (soft === PG.soft ? '' : '~t');
  if (L_FRAMES[k]) return L_FRAMES[k];
  const F0 = HAND_FRAMES[m.lFrame || 'L'], F = soft !== PG.soft && F0.soldat ? F0.soldat : F0;
  // main figée des soldats : elle roule moins (SOLDIER_ROLL), 7 roulis suffisent
  const v = palmLift(m.group, G, F.q, -F.off.z, F.axis, F.range, soft === PG.soft ? 13 : 7, soft), lift = { v, range: F.range, lo: Math.min(...v) };
  return (L_FRAMES[k] = Object.assign({}, F, { off: new V3(F.off.x, -liftAt(lift, 0), F.off.z), lift }));
}

/* Épaules fixées au corps (espace de la caméra) et non plus à l'arme : en visée, et surtout au
   pistolet, les bras partent du bas de l'écran au lieu de passer devant l'objectif. Elles sont
   converties dans le repère de l'arme à chaque image. Pôles : direction où pointe le coude à partir de
   l'épaule. Les valeurs viennent d'un calcul hors ligne des angles du poignet : l'épaule est haute et en retrait
   (comme celle d'un vrai tireur, la caméra étant à hauteur des yeux). Aux armes longues le coude est au niveau de
   la main ; au pistolet il est plus bas, ce qui fait sortir les avant-bras du bas de l'écran comme dans CoD4. */
const VM_BODY = {
  // armes longues
  R: new V3(0.2, -0.14, 0.3), L: new V3(-0.3, -0.14, -0.02),
  poleR: new V3(0.14, -0.12, -0.27), poleL: new V3(-0.04, -0.3, -0.14),
  poleRs: new V3(0.1, -0.4, 0), poleLs: new V3(-0.1, -0.4, 0), // sprint : coudes vers le bas, sous l'épaule
  RA: new V3(0.2, -0.14, 0.3), LA: new V3(-0.3, -0.14, -0.02),
  poleRA: new V3(0.06, -0.12, -0.3), poleLA: new V3(0.0, -0.3, -0.12),
  // pistolet : épaules basses et en retrait, si bien que les avant-bras sortent du bas de l'écran au lieu de le traverser
  // à l'horizontale ; en visée, les coudes s'écartent (position isocèle, bras presque tendus) au lieu de tomber : l'avant-bras
  // prolonge alors la poignée et le poignet reste presque droit (déviation ramenée de 29° à 14°)
  Rp: new V3(0.1, -0.2, 0.3), Lp: new V3(-0.15, -0.25, 0.3), RAp: new V3(0.1, -0.19, 0.32), LAp: new V3(-0.15, -0.22, 0.32),
  poleRp: new V3(0.5, -0.8, 0), poleLp: new V3(-0.5, -0.8, 0), poleRAp: new V3(0.7, -0.6, 0), poleLAp: new V3(-0.7, -0.6, 0),
  // main gauche loin du garde-main (ceinture, chargeur) : le coude tombe, l'avant-bras monte vers la main
  poleLD: new V3(-0.1, -1, 0.15),
  // appareils : tablette tenue à deux mains par le bas des flancs, épaules basses et coudes écartés vers le bas (les avant-bras montent du
  // bas de l'écran) ; terminal tenu à une main, coude sous le corps
  dev: {
    R: { S: new V3(0.24, -0.36, 0.1), pole: new V3(0.7, -0.5, 0.1) },
    L: { S: new V3(-0.24, -0.36, 0.1), pole: new V3(-0.7, -0.5, 0.1) },
    P: { S: new V3(0.25, -0.45, 0.05), pole: new V3(0.5, -0.6, 0.1) },
  },
};
const _sR = new V3(), _sL = new V3(), _pR = new V3(), _pL = new V3(), _pLd = new V3();
const _hInv = new THREE.Matrix4();
function placeHands(m, gR, gL) {
  const pistol = m.kind === 'pistol', M = gunMaterials(), LF = lHandFrame(m);
  VM.holder.updateMatrix(); _hInv.copy(VM.holder.matrix).invert();
  const toGun = (v) => v.clone().applyMatrix4(_hInv);
  const ka = smoothstep(0, 1, VM.ads), sp = VM.sprK; // (pose de sprint effective : effacée pendant un rechargement, updateViewmodel)
  _sR.lerpVectors(pistol ? VM_BODY.Rp : VM_BODY.R, pistol ? VM_BODY.RAp : VM_BODY.RA, ka); _sL.lerpVectors(pistol ? VM_BODY.Lp : VM_BODY.L, pistol ? VM_BODY.LAp : VM_BODY.LA, ka);
  _pR.lerpVectors(pistol ? VM_BODY.poleRp : VM_BODY.poleR, pistol ? VM_BODY.poleRAp : VM_BODY.poleRA, ka); _pL.lerpVectors(pistol ? VM_BODY.poleLp : VM_BODY.poleL, pistol ? VM_BODY.poleLAp : VM_BODY.poleLA, ka);
  // sprint : l'arme baissée met la main gauche dans l'axe épaule-pôle, où le repère du coude devient instable (il bascule
  // d'une image à l'autre et le coude jaillit dans l'écran) ; le pôle passe donc sous l'épaule, vers l'extérieur
  if (sp > 0) { _pR.lerp(VM_BODY.poleRs, sp); _pL.lerp(VM_BODY.poleLs, sp); }
  // pistolet au sprint : épaule droite avancée (buste penché) et coude vers le bas et l'extérieur, comme dans pistolRunPose
  if (pistol && sp > 0 && !VM.action) { const k = smoothstep(0, 1, sp); _sR.lerp(_vRun.set(...VM_PRUN.S), k); _pR.lerp(_vRun.set(...VM_PRUN.pole), k); }
  // chorégraphie en cours (rechargement, culasse) : chaque main peut suivre son propre trajet, entre l'arme et la ceinture
  // chorégraphie coupée : la main revient à sa prise en quelques images (vmHandExit, 06d-reload.js)
  const lho = vmHandExit(VM_HX.L, VM.rlT ? vmLeftHand(m, (v) => v.applyMatrix4(_hInv)) : null, gL, 'support');
  const rho = vmHandExit(VM_HX.R, VM.rlT ? vmRightHand(m) : null, gR, 'trigger');
  const pairs = [[VM.arms.R, rho ? rho.G : gR, _sR, _pR, HAND_FRAMES[pistol ? 'Rp' : 'R'], 0.33], [VM.arms.L, lho ? lho.G : gL, _sL, _pL, LF, 0.34]];
  const GS = gripShapes(m);
  // sprint au pistolet : la main gauche lâche l'arme et balance le long du corps au rythme des foulées (on ne court pas
  // l'arme serrée à deux mains, les poignets casseraient) ; elle revient envelopper la poignée dès qu'on ralentit
  const pRun = pistol && !lho ? smoothstep(0.15, 0.85, sp) : 0;
  for (const [arm, G0, Sb, Pb0, F0, fore] of pairs) {
    let F = F0, Pb = Pb0, G = G0, shapes = GS ? (arm === VM.arms.R ? GS.R : GS.L) : null;
    if (pRun > 0 && arm === VM.arms.L) {
      const c = Math.cos(VM.bobT), s2 = Math.sin(2 * VM.bobT), kb = Math.min(1, VM.bobAmt);
      G = _gRun.copy(G0).lerp(toGun(_vRun.set(-0.2 + c * 0.015 * kb, -0.47 + s2 * 0.025 * kb, -0.06 + c * 0.1 * kb)), pRun);
      _qRun.copy(VM.holder.quaternion).invert().multiply(VM_RUNQ);
      F = { q: _fq3.copy(F0.q).slerp(_qRun, pRun), off: _fo3.copy(F0.off).multiplyScalar(1 - pRun), pose: pRun > 0.4 ? 'relaxed' : F0.pose, side: F0.side, axis: pRun < 0.5 ? F0.axis : null, range: F0.range, axis2: pRun < 0.5 ? F0.axis2 : null, range2: F0.range2 };
      Pb = _pLd.lerpVectors(_pL, VM_BODY.poleLD, pRun);
      if (pRun > 0.15) shapes = null;
    }
    if (lho && arm === VM.arms.L) {
      // fb 0 à 1 : du garde-main vers la prise de chargeur (ou, repère 1, vers la culasse du pistolet saisie par le flanc)
      const Fb = lho.frame === 1 ? HAND_FRAMES.Lr : HAND_FRAMES.Lp, kf = lho.fb;
      F = { q: _fq.copy(F0.q).slerp(Fb.q, kf), off: _fo.lerpVectors(F0.off, Fb.off, kf), pose: lho.pose === 'support' || (pistol && lho.pose === 'grip') ? F0.pose : lho.pose, side: F0.side, axis: kf < 0.5 ? F0.axis : Fb.axis, range: kf < 0.5 ? F0.range : Fb.range, axis2: kf < 0.5 ? F0.axis2 : Fb.axis2, range2: kf < 0.5 ? F0.range2 : Fb.range2 };
      if (kf > 0.25 || F.pose !== F0.pose) shapes = null; // la main quitte la poignée : plus de prise
      // hors du garde-main, le coude tombe : l'avant-bras monte vers la main au lieu de traverser l'écran à l'horizontale
      Pb = _pLd.lerpVectors(_pL, VM_BODY.poleLD, smoothstep(0.03, 0.16, G.distanceTo(gL)));
    } else if (rho && arm === VM.arms.R) { const Fb = HAND_FRAMES.Rb; if (rho.fb > 0.25) shapes = null; F = { q: _fq2.copy(F0.q).slerp(Fb.q, rho.fb), off: _fo2.lerpVectors(F0.off, Fb.off, rho.fb), pose: rho.pose === 'trigger' ? F0.pose : rho.pose, side: F0.side, axis: rho.fb < 0.5 ? F0.axis : Fb.axis, range: rho.fb < 0.5 ? F0.range : Fb.range, axis2: rho.fb < 0.5 ? F0.axis2 : Fb.axis2, range2: rho.fb < 0.5 ? F0.range2 : Fb.range2 }; }
    const H = G.clone().sub(F.off.clone().applyQuaternion(F.q));
    // pistolet : la main gauche se referme aussi sur les doigts de la main droite
    if (pistol && shapes && arm === VM.arms.L) { VM.arms.R.hand.updateMatrix(); shapes = handCapsules(VM.arms.R.hand.userData, VM.arms.R.hand.matrix, _gCaps).concat(shapes); }
    poseArmToHand(arm, toGun(Sb), H, F.q, toGun(Sb.clone().add(Pb)), F.pose, 0, 0.34, fore, F.off, F.axis, F.range, F.axis2, F.range2, shapes, F === F0 ? F.lift : null);
  }
  vmAttachMags(m, lho ? lho.carry : 0);
}
const _fq = new THREE.Quaternion(), _fo = new V3(), _fq2 = new THREE.Quaternion(), _fo2 = new V3(), _gCaps = [];
const _fq3 = new THREE.Quaternion(), _fo3 = new V3(), _gRun = new V3(), _vRun = new V3(), _qRun = new THREE.Quaternion();
/* Sprint au pistolet, piloté par le bras : le bras droit descend le long du flanc, coude en arrière et en dehors, l'avant-bras
   remonte vers l'avant ; tout le bras pompe au rythme des foulées. La main prolonge l'avant-bras (poignet droit) et le
   pistolet est posé dans la main : c'est l'arme qui suit le bras, et non le poignet qui rattrape une arme placée à part.
   k : poids (0 à 1) du sprint ; la pose du support d'arme est fondue vers celle-ci. */
const _ra = { s: new V3(), e: new V3(), w: new V3(), p: new V3(), df: new V3(), x: new V3(), y: new V3(), z: new V3(), g: new V3(), m: new THREE.Matrix4(), qh: new THREE.Quaternion(), qg: new THREE.Quaternion(), q: new THREE.Quaternion() };
/* espace de la caméra : épaule (avancée par la bascule du buste au sprint), poignet visé, direction du coude, dos de la main,
   balancement du poignet à chaque foulée (bas-haut, avant-arrière) */
const VM_PRUN = { S: [0.15, -0.22, 0.05], W: [0.11, -0.195, -0.3], pole: [0.7, -0.6, 0.3], back: [0.3, 1, 0.0], swing: [0.008, 0.016, 0.03] };
function pistolRunPose(m, k) {
  const A = _ra, F = HAND_FRAMES.Rp, P = VM_PRUN;
  const c = Math.cos(VM.bobT), s2 = Math.sin(2 * VM.bobT), kb = Math.min(1, VM.bobAmt);
  A.s.set(...P.S); A.w.set(P.W[0] + c * P.swing[0] * kb, P.W[1] + s2 * P.swing[1] * kb, P.W[2] + c * P.swing[2] * kb);
  elbowAt(A.s, A.w, ARM_LU, ARM_LF, A.p.set(...P.pole).add(A.s), 0, A.s, A.e);
  A.df.subVectors(A.w, A.e).normalize();
  // main dans l'axe de l'avant-bras : -z vers les doigts, dos de la main vers le haut (pistolet couché vers la gauche,
  // bas et devant, prêt à revenir en visée)
  A.z.copy(A.df).negate(); A.y.set(...P.back); A.y.addScaledVector(A.z, -A.y.dot(A.z)).normalize(); A.x.crossVectors(A.y, A.z);
  A.m.makeBasis(A.x, A.y, A.z); A.qh.setFromRotationMatrix(A.m);
  // arme : repère de la main dans l'arme (Rp) inversé ; la poignée au creux de la main
  A.qg.copy(A.qh).multiply(A.q.copy(F.q).invert());
  A.g.set(0, 0, -WRIST_OFF).applyQuaternion(A.qh).add(A.w).add(A.x.copy(F.off).applyQuaternion(A.qh));
  A.g.sub(A.y.copy(m.gripR).applyQuaternion(A.qg));
  VM.holder.position.lerp(A.g, k); VM.holder.quaternion.slerp(A.qg, k);
}
/* main gauche qui court (espace de la caméra) : doigts vers l'avant et le bas, dos de la main vers l'extérieur */
const VM_RUNQ = frameZY([-0.25, 0.75, 0.6], [-1, 0.1, 0.2]);

/* Niveau de détail d'un soldat et de son arme : modèle détaillé de près, allégé de loin. Le modèle allégé projette
   toujours l'ombre ; quand le détaillé est affiché, l'allégé passe sur le calque d'ombre seule (LAYER_SHADOW) : il
   n'est plus dessiné à l'écran, pas même en matière invisible. */
function setSoldierLod(S, hi) {
  const L = S.lod; L.hiOn = hi;
  L.hi.visible = hi; L.hi.layers.mask = MASK_SCREEN;
  L.lo.layers.mask = hi ? MASK_SHADOW : MASK_SCREEN;
  if (S.gun) setGunLod(S.gun, hi);
}
/* Choix par la taille apparente (hauteur d'un corps de 1,8 m à l'écran, focale courante) : un soldat vu à la
   lunette passe au modèle détaillé bien plus loin. Seuil par profil de qualité (lodPx), avec hystérésis. */
function updateSoldierLods() {
  const k = 1.8 * VIEW.h / (2 * Math.tan(camera.fov * Math.PI / 360)), th = RQ.q.lodPx;
  const one = (S) => {
    const L = S && S.lod; if (!L || !L.hi || !S.root.visible) return;
    const px = k / (camera.position.distanceTo(S.P.pelvis.position) + 0.01);
    const hi = L.hiOn ? px > th * 0.85 : px > th;
    if (hi !== L.hiOn) setSoldierLod(S, hi);
  };
  for (const e of entities) one(e.model);
  if (KC.body) one(KC.body);
}
