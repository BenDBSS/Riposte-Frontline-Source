/* ==========================================================================
   PROPS PHYSIQUES : kit. Des objets légers du décor (fruits, pots, chaises, bonhomme de neige, barque...) qui ne sont
   pas fusionnés avec la carte : ce sont des corps rigides (voir 04b-physprops.js pour la simulation), dessinés en
   instances. Ils réagissent aux balles, aux explosions et aux soldats qui les bousculent, sans changer le jeu : un prop
   qui avait une collision la garde tant qu'on n'y a pas touché (mêmes boîtes qu'avant), et ne la rend qu'une fois délogé.
   - Un TYPE (propType) décrit un objet : son prefab, ses formes de contact (sphère, boîte, cylindre), sa masse et sa
     réaction (tir, souffle), ce qu'il devient s'il casse. Une usine à paramètres permet des variantes (carton : w, h, d).
   - Une VARIANTE est un type : une géométrie partagée et un InstancedMesh par matière (un appel de rendu par matière, quel
     que soit le nombre d'objets). La teinte de chaque objet passe par la couleur d'instance (les fruits orange, rouges et
     verts sont dans le même maillage). Les maillages de débris restent invisibles tant que rien n'a éclaté.
   - Un CORPS (PBody) est un objet posé sur la carte, avec sa position, son orientation et ses vitesses.
   Poser un prop : M.dyn('type', x, y, z, ry, { tint, s, a, rx, rz }) dans l'atelier (ou depuis un prefab, qui le recrée
   à chaque estampille). Tout se construit pendant la construction de la carte (propsFinalize en fin de décor) : rien de
   lourd en pleine partie, les débris sont des corps dormants réservés d'avance.
   ========================================================================== */
const PHYS = {
  bodies: [], defs: new Map(), variants: new Map(), pcols: [], phash: new Map(), balls: [], awake: [], slept: [], stackers: [], moving: new Set(),
  live: false, ready: false, g: 15, maxAwake: 150, nextId: 0, pv: 0, acc: 0, // pv : numéro des listes awake et slept (paires candidates, 04b-physprops.js) ; acc : temps pas encore simulé (PH.hMin)
};
const PROPT = {}; // types : id -> définition, ou usine (a) => définition
function propType(id, def) { PROPT[id] = def; return def; }
/* Formes de contact, dans le repère du prefab (posé sur y = 0) : sphère, boîte (demi-dimensions), cylindre vertical (demi-hauteur) */
const SPH = (cx, cy, cz, r) => ['s', cx, cy, cz, r];
const BOX = (cx, cy, cz, hx, hy, hz) => ['b', cx, cy, cz, hx, hy, hz];
const CYL = (cx, cy, cz, r, hh) => ['y', cx, cy, cz, r, hh];

/* Définition complète d'un type : formes recentrées sur le centre de masse, masse volumique et inertie, points de contact */
function propDef(type, a) {
  const key = type + (a && a.length ? '|' + a.join(',') : '');
  let d = PHYS.defs.get(key); if (d) return d;
  const F = PROPT[type]; if (!F) throw new Error('prop inconnu : ' + type);
  d = Object.assign({ mass: 1, mu: 0.6, e: 0.3, drag: 0.05, rr: 2.5, resp: 3, blast: 8, lift: 0.5, hp: Infinity, mat: 'concrete', snd: 'hard', ray: true, hold: 0, stack: false, spill: false, topple: 0, through: false, ball: false, debris: null }, typeof F === 'function' ? F(a || []) : F);
  d.type = type; d.key = key;
  // centre de masse : celui du type, sinon le centre de la boîte englobante des formes
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  const ext = (cx, cy, cz, hx, hy, hz) => { x0 = Math.min(x0, cx - hx); x1 = Math.max(x1, cx + hx); y0 = Math.min(y0, cy - hy); y1 = Math.max(y1, cy + hy); z0 = Math.min(z0, cz - hz); z1 = Math.max(z1, cz + hz); };
  for (const s of d.shapes) {
    if (s[0] === 's') ext(s[1], s[2], s[3], s[4], s[4], s[4]); else if (s[0] === 'b') ext(s[1], s[2], s[3], s[4], s[5], s[6]); else ext(s[1], s[2], s[3], s[4], s[5], s[4]);
  }
  d.com = d.com || [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const [mx, my, mz] = d.com;
  d.sh = d.shapes.map((s) => { const o = s.slice(); o[1] -= mx; o[2] -= my; o[3] -= mz; return o; });
  // inertie principale (pour s = 1) : sphère, cylindre ou boîte englobante
  const m = d.mass, lx = x1 - x0, ly = y1 - y0, lz = z1 - z0;
  let I;
  if (d.sh.length === 1 && d.sh[0][0] === 's') { const q = 0.4 * m * d.sh[0][4] ** 2; I = [q, q, q]; }
  else if (d.sh.length === 1 && d.sh[0][0] === 'y') { const r = d.sh[0][4], h = 2 * d.sh[0][5], t = m * (3 * r * r + h * h) / 12; I = [t, m * r * r / 2, t]; }
  else I = [m * (ly * ly + lz * lz) / 12, m * (lx * lx + lz * lz) / 12, m * (lx * lx + ly * ly) / 12];
  d.ii = I.map((v) => 1 / Math.max(v, 1e-5));
  // rayon englobant et points de contact (x, y, z, rayon), dans le repère du centre de masse
  let rad = 0; const pts = [];
  for (const s of d.sh) {
    if (s[0] === 's') { rad = Math.max(rad, hyp3(s[1], s[2], s[3]) + s[4]); pts.push([s[1], s[2], s[3], s[4]]); }
    else if (s[0] === 'b') {
      rad = Math.max(rad, hyp3(s[1], s[2], s[3]) + hyp3(s[4], s[5], s[6]));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push([s[1] + sx * s[4], s[2] + sy * s[5], s[3] + sz * s[6], 0]);
    } else {
      rad = Math.max(rad, hyp3(s[1], s[2], s[3]) + hyp(s[4], s[5]));
      for (const sy of [-1, 1]) for (let k = 0; k < 12; k++) { const t = (k / 12) * TAU; pts.push([s[1] + Math.cos(t) * s[4], s[2] + sy * s[5], s[3] + Math.sin(t) * s[4], 0]); }
    }
  }
  d.pts = d.contact ? d.contact.map((p) => [p[0] - mx, p[1] - my, p[2] - mz, p[3] || 0]) : pts;
  // points de sonde pour les collisions entre corps (propDeepest) : coins, centres des faces et des bases. Les coins seuls ne voient pas
  // deux boîtes de même empreinte qui se traversent à la verticale (leurs coins restent sur les parois de l'autre).
  d.qp = [];
  for (const s of d.sh) {
    if (s[0] === 's') d.qp.push([s[1], s[2], s[3]]);
    else if (s[0] === 'b') {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) d.qp.push([s[1] + sx * s[4], s[2] + sy * s[5], s[3] + sz * s[6]]);
      for (const k of [-1, 1]) d.qp.push([s[1] + k * s[4], s[2], s[3]], [s[1], s[2] + k * s[5], s[3]], [s[1], s[2], s[3] + k * s[6]]);
    } else {
      for (const sy of [-1, 1]) { d.qp.push([s[1], s[2] + sy * s[5], s[3]]); for (let k = 0; k < 12; k++) { const t = (k / 12) * TAU; d.qp.push([s[1] + Math.cos(t) * s[4], s[2] + sy * s[5], s[3] + Math.sin(t) * s[4]]); } }
    }
  }
  d.rad = rad;
  // volume des formes (s = 1) et masse volumique : un corps plus léger que l'eau y flotte (propStep), sauf d.sink (sable, métal, gaz, poterie
  // pleine de terre) ; d.hy : demi-hauteur des formes, sur laquelle se mesure la part immergée
  let vol = 0; for (const s of d.sh) vol += s[0] === 's' ? 4.19 * s[4] ** 3 : s[0] === 'b' ? 8 * s[4] * s[5] * s[6] : 6.283 * s[4] * s[4] * s[5];
  d.rho = d.sink ? 2500 : d.mass / Math.max(vol, 1e-6); d.hy = (y1 - y0) / 2;
  PHYS.defs.set(key, d);
  return d;
}

/* Variante : un type. Ses corps sont rangés dans un groupe par case de la carte (PCELL m de côté) ; le groupe est un InstancedMesh
   par matière, avec la sphère englobante de ses corps. Une seule case pour l'instant (PCELL énorme) : scinder la carte en
   cases faisait écarter des groupes hors champ mais multipliait les appels de rendu bien plus qu'elle n'en évitait (160 de
   plus en vue ouverte, ombres comprises). */
const PCELL = Infinity;
function propCell(x, z) { return Math.floor(x / PCELL) + ',' + Math.floor(z / PCELL); }
function propVariant(d) {
  let V = PHYS.variants.get(d.key); if (V) return V;
  V = { key: d.key, d, pf: d.pf(), groups: new Map() };
  PHYS.variants.set(d.key, V);
  return V;
}
function propGroup(V, cell) {
  let G = V.groups.get(cell);
  if (!G) V.groups.set(cell, G = { V, cell, bodies: [], pool: [], reserve: 0, attr: null, colors: null, sphere: new THREE.Sphere(), meshes: [], lazy: false, on: false });
  return G;
}
/* Réserve de débris : chaque corps cassable emporte avec lui, dans sa case, les corps dormants dont il aura besoin en cassant */
function propReserve(d, cell) {
  if (!d.debris) return;
  for (const [type, n, a] of d.debris) propGroup(propVariant(propDef(type, a)), cell).reserve += n;
}

const _phM = new Maker(null);
/* Pose un prop : (x, y, z) est l'origine du prefab (au sol). o : tint (sRGB), s (échelle), a (arguments de l'usine),
   rx et rz (inclinaison de départ, en radians), nocol (sans la collision du prefab), id (identifiant d'un corps de réserve) */
function propSpawn(type, x, y, z, ry = 0, o = {}) {
  const d = propDef(type, o.a), V = propVariant(d), s = o.s || 1;
  const b = new PBody(d, V, s);
  if (o.tint) { b.tintRaw = o.tint; b.tint = [sl(o.tint[0]), sl(o.tint[1]), sl(o.tint[2])]; }
  const q = b.q; q.setFromEuler(_peul.set(o.rx || 0, ry, o.rz || 0, 'YXZ'));
  propRot(b);
  b.p.set(x + (b.R[0] * d.com[0] + b.R[1] * d.com[1] + b.R[2] * d.com[2]) * s, y + (b.R[3] * d.com[0] + b.R[4] * d.com[1] + b.R[5] * d.com[2]) * s, z + (b.R[6] * d.com[0] + b.R[7] * d.com[1] + b.R[8] * d.com[2]) * s);
  b.origin = { x, y, z, ry, rx: o.rx || 0, rz: o.rz || 0 };
  // collision du prefab : les mêmes boîtes qu'avant, que les tirs ignorent (la forme du prop s'en charge) ; rendue au premier choc
  if (!o.nocol && V.pf.cols.length) {
    _phM.m.makeTranslation(x, y, z); _phM.m.multiply(_pdm.makeRotationFromQuaternion(q)); _phM.m.multiply(_pdm.makeScale(s, s, s));
    for (const c of V.pf.cols) {
      const bb = _phM._aabb(c.x0, c.x1, c.y0, c.y1, c.z0, c.z1), e = { x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, m: c.m, ray: !!c.ray, noRay: true, prop: b };
      e.o = [e.x0, e.x1, e.y0, e.y1, e.z0, e.z1];
      COL.push(e); b.cols.push(e);
      if (c.occ !== false && !c.ray) OCC.push({ x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, k: 1 });
    }
  }
  const cell = propCell(x, z), G = propGroup(V, cell);
  propReserve(d, cell);
  b.id = PHYS.nextId++; b.G = G; b.cell = cell; b.vi = G.bodies.length; G.bodies.push(b); PHYS.bodies.push(b);
  if (d.ball) PHYS.balls.push(b);
  PHYS.live = true;
  return b;
}
const _peul = new THREE.Euler(), _pdm = new THREE.Matrix4();
/* Boîte de collision de la carte que les corps listés se partagent (deux jarres contre un mur) : les tirs l'ignorent, les
   soldats la rencontrent, et elle disparaît dès que l'un des corps est délogé */
function propLink(bodies, bb, m) {
  const e = { x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, m, ray: false, noRay: true, prop: bodies[0] };
  e.o = [e.x0, e.x1, e.y0, e.y1, e.z0, e.z1];
  COL.push(e); OCC.push({ ...bb, k: 1 });
  for (const b of bodies) b.cols.push(e);
}
/* Collision réservée aux props (parois du cageot de fruits) */
function propBlock(bb, tag) { PHYS.pcols.push({ x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, m: 'wood', ray: false, crate: tag === 'crate', o: [bb.x0, bb.x1, bb.y0, bb.y1, bb.z0, bb.z1] }); }

/* Fin de la construction du décor : corps de réserve, géométries partagées, instances. Appelé juste après finalizeWorld. */
function propsFinalize() {
  // débris : une réserve de corps dormants par groupe (les types de débris n'ont pas de prefab posé sur la carte)
  for (const V of [...PHYS.variants.values()]) for (const G of V.groups.values()) {
    for (let i = 0; i < G.reserve; i++) {
      const b = new PBody(V.d, V, 1); b.state = 0; b.pooled = true; b.G = G; b.cell = G.cell; b.id = PHYS.nextId++; b.vi = G.bodies.length;
      G.bodies.push(b); G.pool.push(b); PHYS.bodies.push(b); if (V.d.ball) PHYS.balls.push(b);
    }
  }
  for (const V of PHYS.variants.values()) {
    const pf = V.pf, parts = [];
    for (const part of pf.parts.values()) { const mat = propMat(part.mat); if (part.g.nv && mat) parts.push({ part, mat, geo: propGeometry(V, part) }); }
    for (const G of V.groups.values()) {
      const n = Math.max(1, G.bodies.length), tinted = G.bodies.some((b) => b.tint);
      G.attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16).setUsage(THREE.DynamicDrawUsage);
      if (tinted) {
        G.colors = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
        for (const b of G.bodies) if (b.tint) G.colors.array.set(b.tint, b.vi * 3);
      }
      G.lazy = G.bodies.every((b) => b.pooled); // débris : le maillage n'existe à l'écran qu'à partir du premier éclatement
      for (const { part, mat, geo } of parts) {
        // une géométrie par groupe (sphère englobante propre), les tampons de sommets restent partagés
        const g2 = new THREE.BufferGeometry(); for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]); g2.setIndex(geo.index); g2.boundingSphere = G.sphere;
        const mesh = new THREE.InstancedMesh(g2, mat, n), cls = part.cls >= 2 ? 1 : part.cls;
        mesh.instanceMatrix = G.attr; mesh.count = n; mesh.matrixAutoUpdate = false;
        // la teinte de l'objet (couleur d'instance) ne touche que les pièces teintables du prefab. Tous les maillages de props ont
        // une couleur d'instance, blanche à défaut : three.js choisit le programme d'une matière au premier maillage instancié qui
        // l'utilise, et un maillage sans couleur d'instance sur un programme qui en lit une serait noir (ou, dans l'autre sens, les
        // teintes seraient ignorées selon l'ordre de construction des variantes)
        if (tinted && (pf.tintable ? pf.tintable.includes(part.mat) : true)) mesh.instanceColor = G.colors;
        else mesh.instanceColor = G.white || (G.white = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3));
        mesh.name = 'prop:' + V.key + ':' + G.cell + ':' + part.mat;
        mesh.castShadow = cls === 0 && !mat.userData.noShadow; mesh.receiveShadow = !mat.userData.noReceive;
        if (mat.userData.noAO) mesh.userData.noAO = true;
        if (cls === 0 && NEAR_SHADOW.has(part.mat)) mesh.layers.set(LAYER_NEAR);
        mesh.userData.noPrepass = true; mesh.visible = !G.lazy;
        mapAdd(mesh); G.meshes.push(mesh);
      }
      for (const b of G.bodies) propWrite(b);
      G.attr.needsUpdate = true; propGroupBounds(G);
    }
    V.pf = null; // ses tampons ne servent plus : la géométrie est partagée
  }
  propsIndex();
  // volumes des collisions réservées aux props : table de hachage de 2 m
  PHYS.phash.clear();
  PHYS.pcols.forEach((c, i) => {
    for (let x = Math.floor(c.x0 / 2); x <= Math.floor(c.x1 / 2); x++) for (let z = Math.floor(c.z0 / 2); z <= Math.floor(c.z1 / 2); z++) {
      const k = x * 1000 + z; let a = PHYS.phash.get(k); if (!a) PHYS.phash.set(k, a = []); a.push(i);
    }
  });
  PHYS.ready = true;
}
/* Matière d'un prop : une copie de celle du décor. three.js ne garde qu'un programme par matière, et le programme d'un maillage instancié
   n'est pas celui d'un maillage simple : partagée entre le décor et les props, une matière changeait de programme deux fois par image et
   three.js recalculait chaque fois sa clé (getParameters, getProgramCacheKey : 13 matières sur Khamsin, 26 recalculs et 19 Ko alloués par
   image, saccades.js). Une copie par matière, gardée pour la carte (libérée avec ses maillages par mapUnload). Elle reste inscrite aux ombres
   en cascade par la matière d'origine (même onBeforeCompile : elles partagent le tableau des cascades).
   Les defines sont ceux de la matière, partagés : la copie de three.js (MeshStandardMaterial.copy) les remet à { STANDARD }, et le prop
   perdait l'éclairage cuit du décor (WM : il sortait plus clair et délavé) et les ombres en cascade. Les ombres s'installent après la copie
   (shadeMaterials) : propMatsSync y reprend la chaîne de la matière d'origine. */
const PROP_MATS = new Map();
function propMat(k) {
  const m = MAT[k]; if (!m) return m;
  let c = PROP_MATS.get(m); if (c) return c;
  c = m.clone(); c.defines = m.defines; c.onBeforeCompile = m.onBeforeCompile; c.userData = m.userData; c.customProgramCacheKey = m.customProgramCacheKey;
  c.uuid = 'decor-' + k + '-prop'; // identifiant fixe, comme celui de la matière (shadeMaterials, appelée plus tard) : le cache des matières d'ombre de three.js ne grossit pas d'une partie à l'autre
  PROP_MATS.set(m, c); return c;
}
/* Après l'installation des ombres sur les matières du décor (shadeMaterials) : les copies des props reprennent leur chaîne de compilation */
function propMatsSync() {
  for (const [m, c] of PROP_MATS) { c.defines = m.defines; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; }
}
/* Géométrie partagée d'une pièce du prefab, recentrée sur le centre de masse */
function propGeometry(V, part) {
  const g = part.g, n = g.nv, com = V.d.com;
  const P = new Float32Array(n * 3), C = g.C.slice(0, n * 3);
  for (let i = 0; i < n; i++) { P[i * 3] = g.P[i * 3] - com[0]; P[i * 3 + 1] = g.P[i * 3 + 1] - com[1]; P[i * 3 + 2] = g.P[i * 3 + 2] - com[2]; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(g.N.slice(0, n * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(g.U.slice(0, n * 2), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('aoc', new THREE.BufferAttribute(g.A.slice(0, n), 1));
  geo.setIndex(new THREE.BufferAttribute(n > 65535 ? g.I.slice(0, g.ni) : Uint16Array.from(g.I.subarray(0, g.ni)), 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

/* ---------- Prefabs des props ---------- */
const G_FRUIT = new THREE.SphereGeometry(1, 9, 6);
/* Fruit : sphère de 6 cm de rayon (la teinte donne l'orange, la pomme, le citron) */
PF.fruitBall = () => prefab('fruitBall', (M) => {
  M.color([1, 1, 1]).local(1);
  M.cls = 1; // pas d'ombre portée : un fruit de 12 cm n'en projette pas de visible
  M.save().move(0, 0.06, 0).scl(0.06); M.geo('plastic', G_FRUIT, { uvs: 0.12 }); M.restore();
});
/* Lattes et plancher d'un cageot de fruits (60 x 40 x 19 cm) : un corps physique, qui emporte ses fruits quand il part */
PF.fruitBox = () => prefab('fruitBox', (M) => {
  M.save().color([0.8, 0.7, 0.55]).local(1);
  for (const y of [0.02, 0.12]) for (const s of [-1, 1]) { M.boxB('crate', -0.3, 0.3, y, y + 0.07, s * 0.2 - 0.01, s * 0.2 + 0.01); M.boxB('crate', s * 0.3 - 0.01, s * 0.3 + 0.01, y, y + 0.07, -0.2, 0.2); }
  M.boxB('crate', -0.3, 0.3, 0, 0.02, -0.2, 0.2);
  M.restore();
});
/* Cageot de fruits : le cageot lui-même (corps `fruitBox`), les parois qui retiennent les fruits (collision réservée aux props,
   étiquette 'crate') et 15 fruits dynamiques à la teinte de l'estampille. Un tir sur le cageot ou un souffle le déplace : ses
   parois disparaissent avec lui et les fruits se répandent. Les fruits seuls roulent et se poussent entre eux. */
PF.fruitCrate = () => prefab('fruitCrate', (M, P) => {
  P.tintable = []; // la teinte de l'estampille est celle des fruits, pas des lattes
  M.dyn('fruitBox', 0, 0, 0, 0);
  M.pcol(-0.3, 0.3, 0, 0.03, -0.2, 0.2, 'crate');
  for (const s of [-1, 1]) { M.pcol(s * 0.3 - 0.01, s * 0.3 + 0.01, 0, 0.2, -0.2, 0.2, 'crate'); M.pcol(-0.3, 0.3, 0, 0.2, s * 0.2 - 0.01, s * 0.2 + 0.01, 'crate'); }
  const R = rngOf(5);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) M.dyn('fruit', -0.21 + i * 0.14, 0.03, (j - 1) * 0.12, R() * TAU, { tintFrom: true });
  for (let i = 0; i < 3; i++) M.dyn('fruit', -0.14 + i * 0.14, 0.1275, 0, R() * TAU, { tintFrom: true });
});
propType('fruitBox', { pf: () => PF.fruitBox(), shapes: [BOX(0, 0.095, 0, 0.3, 0.095, 0.2)], mass: 1.4, mu: 0.55, e: 0.2, rr: 3, resp: 4, blast: 10, spill: 'fruit', mat: 'wood', snd: 'wood' });
/* Ce que les fruits ont de commun : de petites sphères qui roulent et se poussent entre elles */
propType('fruit', { pf: () => PF.fruitBall(), shapes: [SPH(0, 0.06, 0, 0.06)], mass: 0.2, mu: 0.5, e: 0.4, rr: 1.2, resp: 6, blast: 11, lift: 1.2, through: true, ball: true, mat: 'dirt', snd: 'fruit' });

/* Tesson de terre cuite : éclat d'un pot ou d'une jarre qui se brise (propKid, 04b-physprops.js). Il s'appelait PF.shard, comme le tesson
   de tuile de la poussière du sol (02h-nature.js), qu'il remplaçait partout (fichiers concaténés : la dernière définition gagne) */
PF.potShard = () => prefab('potShard', (M) => {
  M.color([0.72, 0.42, 0.28]).local(1);
  M.cls = 1;
  M.boxB('concrete', -0.05, 0.05, 0, 0.014, -0.035, 0.035, { bevel: 0.004 });
});
propType('shard', { sink: true, pf: () => PF.potShard(), shapes: [BOX(0, 0.007, 0, 0.05, 0.007, 0.035)], mass: 0.05, mu: 0.7, e: 0.2, rr: 3, ray: false, through: true, mat: 'dirt', snd: 'clay' });
/* Pot et jarre en terre cuite : un tir les brise en tessons */
propType('pot', { sink: true, pf: () => PF.pot(), shapes: [CYL(0, 0.125, 0, 0.14, 0.125)], mass: 6, mu: 0.7, e: 0.2, resp: 2.6, blast: 7, hp: 20, mat: 'dirt', snd: 'clay', brk: 'clay', debris: [['shard', 6]] });
propType('jar', { pf: () => PF.jar(1), shapes: [CYL(0, 0.32, 0, 0.22, 0.32)], mass: 7, mu: 0.7, e: 0.2, resp: 3, blast: 8, hp: 28, mat: 'dirt', snd: 'clay', brk: 'clay', debris: [['shard', 7]] });

/* Caisse en planches (PF.crate, côté s en argument : 0,55 à 1,2 m) : elle résiste à quelques balles, puis bouge et tombe de sa pile. Les grosses (0,9 m et plus)
   bloquent des passages : elles sont des obstacles fixes (fixed), posées comme un décor ordinaire que ni balle ni explosion ne déplace ; les petites restent des props */
propType('crate', (a) => { const s = a[0] || 1.1; return { pf: () => PF.crate(s), shapes: [BOX(0, s / 2, 0, s / 2, s / 2, s / 2)], mass: 22 * s * s * s, mu: 0.6, e: 0.15, rr: 3, resp: 2.4, blast: 6, hold: 12 + 28 * s, stack: true, mat: 'wood', snd: 'wood', fixed: s >= 0.9 }; });
/* Sac d'épices ouvert (48 x 41 cm), sac de sable bas (PF.sandbag), bouteille de bar (hauteur en argument, éclate dès la première balle).
   noNav : la navigation des bots ne pose aucun nœud sur le dessus (un mur de sacs écorné faisait une marche de 0,44 m, plus haute sur une
   dune, où les bots montaient sans pouvoir la franchir ; ils contournent les murs et enjambent un sac tombé) */
propType('spiceSack', { sink: true, pf: () => PF.spiceSack(), shapes: [BOX(0, 0.205, 0, 0.24, 0.205, 0.23)], mass: 9, mu: 0.9, e: 0.05, rr: 6, resp: 2.6, blast: 7, hold: 6, stack: true, mat: 'dirt', snd: 'soft' });
propType('sandbagLow', { sink: true, noNav: true, pf: () => PF.sandbag(), shapes: [BOX(0, 0.075, 0, 0.29, 0.075, 0.165)], mass: 12, mu: 0.9, e: 0.05, rr: 6, resp: 2, blast: 5, hold: 40, stack: true, mat: 'dirt', snd: 'soft' });
propType('bottle', (a) => { const h = a[0] || 0.26; return { pf: () => PF.bottle(h), shapes: [CYL(0, h / 2, 0, 0.035, h / 2)], mass: 0.7, mu: 0.4, e: 0.2, rr: 2, resp: 5, blast: 12, hp: 1, mat: 'glass', snd: 'plastic', brk: 'glass' }; });
/* Glène de cordage lovée (PF.ropeCoil) */
propType('ropeCoil', { pf: () => PF.ropeCoil(), shapes: [CYL(0, 0.09, 0, 0.34, 0.09)], mass: 6, mu: 0.8, e: 0.1, rr: 5, resp: 3, blast: 8, stack: true, mat: 'dirt', snd: 'soft' });
/* Bouteille de verre (corps et goulot), teinte de l'estampille */
PF.bottle = (h = 0.26) => prefab('bottle' + h.toFixed(2), (M) => {
  M.color([1, 1, 1]).local(1); M.cls = 1;
  M.cyl('glass', 0.035, h * 0.62, 6); M.save().move(0, h * 0.62, 0); M.cyl('glass', 0.014, h * 0.38, 6); M.restore();
});

/* Mobilier et objets du quotidien */
propType('chair', { sink: true, pf: () => PF.chair(), shapes: [BOX(0, 0.45, 0, 0.23, 0.45, 0.23)], mass: 2.5, mu: 0.5, e: 0.25, resp: 3.2, blast: 9, mat: 'metal', snd: 'plastic' });
propType('cafeTable', { sink: true, pf: () => PF.cafeTable(), shapes: [CYL(0, 0.35, 0, 0.35, 0.35)], mass: 6, mu: 0.5, e: 0.25, resp: 2.2, blast: 7, mat: 'metal', snd: 'metal' });
propType('jerrycan', { pf: () => PF.jerrycan(), shapes: [BOX(0, 0.24, 0, 0.09, 0.24, 0.17)], mass: 1.6, mu: 0.55, e: 0.25, resp: 4.5, blast: 10, mat: 'metal', snd: 'metal' });
propType('gasBottle', { sink: true, pf: () => PF.gasBottle(), shapes: [CYL(0, 0.33, 0, 0.15, 0.33)], mass: 14, mu: 0.5, e: 0.2, rr: 1.2, resp: 1.8, blast: 6, mat: 'metal', snd: 'metal' });
propType('trashBag', { pf: () => PF.trashBag(), shapes: [SPH(0, 0.24, 0, 0.23)], mass: 3, mu: 1, e: 0.05, rr: 6, resp: 3, blast: 8, mat: 'dirt', snd: 'soft' });
propType('cardboard', (a) => {
  const w = a[0] || 0.5, h = a[1] || 0.4, d = a[2] || 0.4;
  return { pf: () => PF.cardboard(w, h, d), shapes: [BOX(0, h / 2, 0, w / 2, h / 2, d / 2)], mass: 12 * w * h * d, mu: 0.7, e: 0.15, resp: 4, blast: 10, mat: 'dirt', snd: 'soft' };
});
propType('sled', { pf: () => PF.sled(), shapes: [BOX(0, 0.12, -0.03, 0.23, 0.12, 0.5)], mass: 6, mu: 0.35, e: 0.2, resp: 3, blast: 8, mat: 'wood', snd: 'wood' });
/* Skis et bâtons : chacun est un corps, appuyé contre la planche du râtelier (skiRackAt) ; un tir en fait tomber un, pas les autres */
propType('ski', { pf: () => PF.skiOne(), shapes: [BOX(0, 0.875, 0, 0.04, 0.875, 0.012)], mass: 2.2, mu: 0.4, e: 0.2, rr: 3, resp: 3.5, blast: 9, mat: 'wood', snd: 'wood' });
propType('skiPole', { pf: () => PF.skiPole(), shapes: [BOX(0, 0.625, 0, 0.02, 0.625, 0.02)], mass: 0.4, mu: 0.5, e: 0.2, rr: 3, resp: 5, blast: 11, mat: 'wood', snd: 'wood' });

/* Mobilier et caisses : ce qui se tient en équilibre (pile de sacs, de pneus, de caisses) tombe quand son appui part (stack),
   ce qui est lourd résiste aux premiers coups (hold : points de dégâts encaissés avant de bouger) */
propType('table', { pf: () => PF.table(), shapes: [BOX(0, 0.4, 0, 1.0, 0.4, 0.5)], mass: 26, mu: 0.5, e: 0.2, rr: 3, resp: 1.5, blast: 5, hold: 20, mat: 'wood', snd: 'wood' });
propType('barrel', { pf: () => PF.barrel(), shapes: [CYL(0, 0.45, 0, 0.29, 0.45)], mass: 24, mu: 0.45, e: 0.2, rr: 0.9, resp: 1.7, blast: 5, hold: 25, mat: 'metal', snd: 'metal' });
propType('sandbag', { sink: true, noNav: true, pf: () => PF.sandbagFat(), shapes: [BOX(0, 0.11, 0, 0.3, 0.11, 0.2)], mass: 16, mu: 0.9, e: 0.05, rr: 6, resp: 1.8, blast: 5, hold: 70, stack: true, mat: 'dirt', snd: 'soft' });
propType('sandbagHalf', { sink: true, noNav: true, pf: () => PF.sandbagHalf(), shapes: [BOX(0, 0.11, 0, 0.15, 0.11, 0.2)], mass: 8, mu: 0.9, e: 0.05, rr: 6, resp: 2.2, blast: 6, hold: 45, stack: true, mat: 'dirt', snd: 'soft' }); // ferme le bout d'un rang décalé
propType('tire', { pf: () => PF.tire(), shapes: [CYL(0, 0.1, 0, 0.4, 0.1)], mass: 9, mu: 0.8, e: 0.45, rr: 1.2, resp: 2.2, blast: 6, hold: 25, stack: true, mat: 'dirt', snd: 'soft' });
propType('hayBale', { pf: () => PF.hayBale(), shapes: [BOX(0, 0.225, 0, 0.45, 0.225, 0.25)], mass: 22, mu: 0.85, e: 0.05, rr: 6, resp: 1.3, blast: 5, hold: 45, stack: true, mat: 'dirt', snd: 'soft' });
propType('lobsterPot', { sink: true, pf: () => PF.lobsterPot(), shapes: [BOX(0, 0.15, 0, 0.3, 0.15, 0.3)], mass: 8, mu: 0.6, e: 0.2, rr: 3, resp: 2.2, blast: 6, hold: 20, stack: true, mat: 'metal', snd: 'metal' });
/* Bacs à poisson (80 x 50 x 30 cm) : le bac du haut d'une pile porte son lit de glace (`fishBinIce`) et ses poissons, qui se répandent
   quand il part ; les bacs du dessous tombent quand leur appui part */
propType('fishBin', { pf: () => PF.fishBinSolid(), shapes: [BOX(0, 0.15, 0, 0.42, 0.15, 0.25)], mass: 1.3, mu: 0.5, e: 0.2, rr: 3, resp: 3.2, blast: 9, stack: true, mat: 'metal', snd: 'plastic' });
propType('fishBinIce', { pf: () => PF.fishBinIce(), shapes: [BOX(0, 0.15, 0, 0.42, 0.15, 0.25)], mass: 4, mu: 0.5, e: 0.2, rr: 3, resp: 2.4, blast: 7, stack: true, spill: 'fish', mat: 'metal', snd: 'plastic' });
/* Poisson de 30 cm (échelle selon sa longueur, teinte selon l'espèce) : les balles le traversent et le poussent comme un fruit */
propType('fish', { pf: () => PF.fishOne(), shapes: [BOX(0, 0, 0, 0.025, 0.035, 0.17)], mass: 0.45, mu: 0.7, e: 0.1, rr: 4, resp: 6, blast: 11, lift: 1.0, through: true, mat: 'dirt', snd: 'fruit' });
propType('buoy', (a) => {
  const r = a[0] || 0.3;
  return { pf: () => PF.buoy([a[1], a[2], a[3]], r), shapes: [SPH(0, r, 0, r)], mass: 14 * r * r * r * 10, mu: 0.5, e: 0.4, rr: 0.7, resp: 4, blast: 8, mat: 'dirt', snd: 'soft' };
});
/* Vélo : debout sur ses deux roues, il tombe sur le côté dès qu'un tir le touche (topple), guidon et selle en appui */
propType('bicycle', (a) => {
  const rim = [];
  for (const z of [-0.52, 0.52]) for (let i = 0; i < 10; i++) { const t = (i / 10) * TAU; rim.push([0, 0.34 + 0.34 * Math.cos(t), z + 0.34 * Math.sin(t)]); }
  return {
    pf: () => PF.bicycle(), shapes: [BOX(0, 0.5, 0, 0.14, 0.5, 0.55)], com: [0, 0.5, 0],
    contact: [...rim, [0, 0.9, -0.12], [0, 0.86, -0.28], [-0.25, 0.98, 0.34], [0.25, 0.98, 0.34], [0, 0.98, 0.4]],
    mass: 13, mu: 0.5, e: 0.2, rr: 2, resp: 1.6, blast: 6, topple: 3, mat: 'metal', snd: 'metal',
  };
});

/* ---------- Mise en place : chaises face à leur table, râtelier à skis ---------- */
/* Chaise posée en (cx, cz) et tournée vers (tx, tz) : une chaise regarde toujours la table qu'elle sert (le devant du prefab est +z) */
function chairFacing(M, cx, cz, tx, tz, tint, jit = 0, y = 0) { return M.dyn('chair', cx, y, cz, Math.atan2(tx - cx, tz - cz) + jit, { tint }); }
/* Table de café ronde en (x, z) et ses chaises (angle autour de la table en radians, 0 = vers +x) à 0,6 m de l'axe. M : repère du monde. */
function cafeSet(M, x, z, angles, tint) {
  M.dyn('cafeTable', x, 0, z, 0);
  angles.forEach((a, i) => chairFacing(M, x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6, x, z, tint, (i % 2 ? 0.1 : -0.08)));
}
/* Table en bois de 2 x 1 m (angle ry) et ses chaises : seats = [[lx, lz]...] dans le repère de la table (lz = ±0.72 le long des grands côtés) */
function tableSet(M, x, z, ry, seats, tint) {
  M.dyn('table', x, 0, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  seats.forEach(([lx, lz], i) => chairFacing(M, x + lx * c + lz * s, z - lx * s + lz * c, x, z, tint, (i % 2 ? 0.12 : -0.1)));
}
/* Râtelier à skis posé en (x, z), le dos vers -z tourné de ry : 4 paires de skis et leurs bâtons, chacun un corps indépendant.
   cols : teintes des paires. Rien ne tient les skis que la planche du fond : un tir en fait tomber un, les autres restent. */
function skiRackAt(M, x, z, ry, cols) {
  M.save().move(x, 0, z).rotY(ry); M.put(PF.skiRack());
  cols.forEach((c, k) => {
    const x0 = -0.85 + k * 0.45;
    M.dyn('ski', x0, 0, 0, 0, { rx: -0.2, tint: c }); M.dyn('ski', x0 + 0.14, 0, 0, 0, { rx: -0.2, tint: c });
    M.dyn('skiPole', x0 + 0.28, 0, 0, 0, { rx: -0.2757 }); M.dyn('skiPole', x0 + 0.34, 0, 0.01, 0, { rx: -0.2757 });
  });
  M.restore();
}

/* Bonhomme de neige : au premier tir il éclate en trois boules, bonnet, carotte, écharpe et branches */
propType('snowman', {
  pf: () => PF.snowman(), shapes: [SPH(0, 0.32, 0, 0.4), SPH(0, 0.9, 0, 0.3), SPH(0, 1.33, 0, 0.2)], mass: 120, mu: 0.4, e: 0.1, resp: 0.8, blast: 7, hp: 18, mat: 'snow', snd: 'snow', brk: 'snowman',
  debris: [['snowball', 3], ['snowHat', 1], ['carrot', 1], ['scarf', 1], ['twig', 2]],
});
/* Boule de neige : sphère de rayon 1 mise à l'échelle (le bas du bonhomme : 0,4 ; son milieu : 0,3 ; sa tête : 0,2) */
PF.snowball = () => prefab('snowball', (M) => { M.color([1, 1, 1]).local(1); M.geo('snowmat', new THREE.SphereGeometry(1, 14, 10), { uvs: 2 }); });
propType('snowball', { pf: () => PF.snowball(), shapes: [SPH(0, 0, 0, 1)], mass: 900, mu: 0.4, e: 0.1, rr: 0.9, resp: 1, blast: 8, ball: true, ray: false, mat: 'snow', snd: 'snow' });
PF.snowHat = () => prefab('snowHat', (M) => {
  M.color([0.2, 0.32, 0.55]).local(1);
  M.lathe('canvas', [[0, 0.23], [0.12, 0.2], [0.19, 0.09], [0.205, 0.03], [0.205, 0], [0, 0]], 12);
  M.save().move(0, 0.26, 0).scl(0.05); M.geo('canvas', G_SPH); M.restore();
});
propType('snowHat', { pf: () => PF.snowHat(), shapes: [SPH(0, 0.12, 0, 0.17)], mass: 0.3, mu: 0.6, e: 0.3, rr: 1.5, resp: 6, blast: 12, through: true, ray: false, ball: true, mat: 'snow', snd: 'soft' });
PF.carrot = () => prefab('carrot', (M) => {
  M.color([0.95, 0.45, 0.12]).local(1);
  M.save().move(0, 0.03, 0).rotX(Math.PI / 2); M.cyl('plastic', 0.03, 0.17, 6, { r1: 0.002 }); M.restore();
});
propType('carrot', { pf: () => PF.carrot(), shapes: [BOX(0, 0.03, 0.085, 0.03, 0.03, 0.085)], mass: 0.1, mu: 0.6, e: 0.3, rr: 3, through: true, ray: false, mat: 'snow', snd: 'soft' });
PF.scarf = () => prefab('scarf', (M) => {
  M.color([0.72, 0.12, 0.1]).local(1);
  M.cyl('canvas', 0.21, 0.08, 12);
});
propType('scarf', { pf: () => PF.scarf(), shapes: [CYL(0, 0.04, 0, 0.21, 0.04)], mass: 0.3, mu: 0.8, e: 0.1, rr: 4, through: true, ray: false, mat: 'snow', snd: 'soft' });
PF.twig = () => prefab('twig', (M) => {
  M.color([0.35, 0.25, 0.17]).local(1);
  M.tube('wood', 0.015, [[-0.3, 0.015, 0], [0, 0.015, 0.03], [0.3, 0.015, 0]], 4);
});
propType('twig', { pf: () => PF.twig(), shapes: [BOX(0, 0.015, 0.01, 0.3, 0.015, 0.025)], mass: 0.1, mu: 0.7, e: 0.2, rr: 3, through: true, ray: false, mat: 'snow', snd: 'wood' });

/* ---------- Barque de pêcheur ---------- */
/* Coque de 3,4 m sur 1,3 m, fond plat, étrave relevée, tableau arrière ; plat-bord blanc, deux bancs, deux avirons.
   Repère : étrave vers +z, quille sur y = 0. */
PF.barque = () => prefab('barque', (M, P) => {
  const L = 3.4, W = 1.3, D = 0.56, T = 0.035;
  // demi-largeur au plat-bord, hauteur du plat-bord et de la quille, de l'arrière (t = 0) à l'étrave (t = 1)
  const hw = (t) => (W / 2) * (t < 0.45 ? lerp(0.6, 1, Math.sin((t / 0.45) * Math.PI / 2)) : Math.pow(Math.max(0, 1 - Math.pow((t - 0.45) / 0.55, 2.2)), 0.6));
  const gy = (t) => D + 0.2 * Math.pow(Math.max(0, (t - 0.6) / 0.4), 2) + 0.05 * Math.pow(1 - t, 3);
  const ky = (t) => 0.22 * Math.pow(Math.max(0, (t - 0.68) / 0.32), 2.2);
  const zt = (t) => lerp(-L / 2, L / 2, t);
  const sec = (t, s, inner) => { const w = Math.max(0, hw(t) - (inner ? T : 0)), y0 = ky(t) + (inner ? T : 0), y1 = gy(t); return [s * w, y0 + (y1 - y0) * Math.pow(Math.abs(s), 2.6), zt(t)]; };
  M.local(1);
  M.save().color([0.2, 0.44, 0.52]);
  M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0, 0.4, y));
  M.surf('paintwood', 16, 20, (u, v) => sec(v, u * 2 - 1, false), { uL: 2.6, vL: 3.4 });
  M.restore();
  M.save().color([0.62, 0.5, 0.36]);
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0, 0.45, y));
  M.surf('wood', 16, 20, (u, v) => sec(v, u * 2 - 1, true), { uL: 2.6, vL: 3.4, flipN: true });
  M.restore();
  M.aoFn = null;
  // tableau arrière : disque plein fermant la coque (de plat-bord en plat-bord en passant par le fond)
  M.save().color([0.2, 0.44, 0.52]);
  { const ring = []; for (let i = 0; i <= 16; i++) ring.push(sec(0, (i / 16) * 2 - 1, false));
    const c = [0, 0.3, zt(0)]; for (let i = 0; i < 16; i++) M.tri3('paintwood', c, ring[i], ring[i + 1], [0, 0, -1]); }
  M.restore();
  // plat-bord : lisse balayée d'un plat-bord à l'autre autour de l'étrave, tableau arrière en travers
  const rim = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; rim.push([-hw(t) + 0.01, gy(t) + 0.012, zt(t)]); }
  for (let i = 17; i >= 0; i--) { const t = i / 18; rim.push([hw(t) - 0.01, gy(t) + 0.012, zt(t)]); }
  M.save().color([0.9, 0.88, 0.82]); M.sweep('paintwood', rectShape(0.07, 0.03), rim, { uAround: 1 }); M.restore();
  M.save().color([0.9, 0.88, 0.82]).move(0, gy(0) + 0.012, zt(0) + 0.03); M.boxB('paintwood', -hw(0), hw(0), 0, 0.03, -0.035, 0.035); M.restore();
  // bancs, patins de quille et deux avirons posés en travers
  M.save().color([0.66, 0.52, 0.36]);
  for (const t of [0.27, 0.6]) { const w = hw(t) - T; M.boxB('wood', -w, w, 0.27 + ky(t), 0.31 + ky(t), zt(t) - 0.12, zt(t) + 0.12, { bevel: 0.006 }); }
  for (const x of [-0.26, 0.26]) M.boxB('wood', x - 0.03, x + 0.03, -0.03, 0.02, -1.3, 0.5, { bevel: 0.006 });
  M.restore();
  M.save().color([0.55, 0.4, 0.26]);
  for (const [x, a] of [[-0.12, 0.05], [0.12, -0.05]]) { M.save().move(x, 0.32, -0.3).rotY(a); M.boxB('wood', -0.02, 0.02, 0, 0.04, -1.0, 1.1, { bevel: 0.006 }); M.boxB('wood', -0.07, 0.07, 0, 0.012, 1.1, 1.65, { bevel: 0.004 }); M.restore(); }
  M.restore();
  // la coque repose sur sa quille : les mêmes boîtes que la collision d'une caisse longue (retirées au premier choc)
  M.col(-0.6, 0.6, 0, 0.5, -1.65, 1.0, 'wood');
});
propType('barque', {
  pf: () => PF.barque(), shapes: [BOX(0, 0.3, -0.6, 0.62, 0.3, 1.1), BOX(0, 0.33, 0.85, 0.42, 0.33, 0.35), BOX(0, 0.42, 1.5, 0.15, 0.42, 0.2)], com: [0, 0.2, -0.1],
  contact: [[-0.3, 0, -1.5], [0.3, 0, -1.5], [-0.3, 0, -0.4], [0.3, 0, -0.4], [-0.3, 0, 0.7], [0.3, 0, 0.7], [0, 0.12, 1.4], [0, 0.4, 1.68],
    [-0.62, 0.55, -0.4], [0.62, 0.55, -0.4], [-0.39, 0.6, -1.7], [0.39, 0.6, -1.7], [-0.5, 0.15, -0.4], [0.5, 0.15, -0.4], [-0.35, 0.58, 0.7], [0.35, 0.58, 0.7]],
  mass: 70, mu: 0.6, e: 0.15, rr: 2, resp: 1.0, blast: 8.5, lift: 0.5, mat: 'wood', snd: 'wood',
});
