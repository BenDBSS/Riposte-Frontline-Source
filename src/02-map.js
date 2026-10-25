/* ==========================================================================
   CARTE : infrastructure commune à toutes les cartes. Limites, liste des cartes, collisions en boîtes
   alignées (COL) et rampes (RAMPS), requêtes (sol, glissement, plafond, rayons), blocs simples et escaliers.
   Le décor est construit par l'atelier (02a-kit.js) et ses bibliothèques ; le plan de chaque carte est dans
   son propre fichier (Khamsin : 02s-sable.js, Val-Blanc : 02t-givre.js, Kervénec : 02u-embruns.js, Hortus : 02v-floreal.js, Meltem : 02yb à 02yf, Tephra : 02yg et 02yh, Stratus : 02yi et 02yj, French Dream : 02ym et 02yn ; le nom d'une carte est un nom propre, le même dans les deux langues), qui déclare sa
   définition (MAP_DEFS) ; l'eau d'une carte portuaire est dans 02m-water.js ;
   le chargement est dans 09a-loading.js, les réglages propres à chaque carte (ambiance, zones...) dans 02z-load.js.
   ========================================================================== */
/* Bornes de la zone de jeu de la carte chargée (recopiées depuis sa définition au chargement) */
const MAP = { x0: -36, x1: 36, z0: -50, z1: 50 };
/* Vide sous la carte (îles flottantes : MAP_DEFS.<id>.void = { kill }) : hors des boîtes de collision et des rampes, pas de sol (floor :
   très bas mais fini, jamais -Infinity, sinon les positions et les calculs qui en dépendent tournent en NaN), pas de bornes qui
   retiennent (on tombe), et sous kill un soldat meurt (voidDeath, 09-game.js), un objet disparaît. Posé par mapSetup, éteint au
   déchargement : les autres cartes gardent leur sol implicite à y = 0. */
const VOID = { on: false, floor: -200, kill: -1e9 };
/* Cartes proposées dans les menus. Une carte n'est jouable que si ok est vrai ; les autres s'affichent « Bientôt ». */
const MAPS = [
  { id: 'sable', name: 'Khamsin', tag: _t('Village de ruelles'), ok: true,
    desc: _t('Un village écrasé de soleil où il ne se passe jamais rien. Sauf aujourd\u0027hui.') },
  { id: 'givre', name: 'Val-Blanc', tag: _t('Gare de montagne enneigée'), ok: true,
    desc: _t('Une gare de montagne sous la neige. Le prochain train a du retard depuis 1987.') },
  { id: 'embruns', name: 'Kervénec', tag: _t('Port de pêche et criée'), ok: true,
    desc: _t('Un port breton au soleil couchant. Il fait beau, ce qui inquiète tout le monde.') },
  { id: 'floreal', name: 'Hortus', tag: _t('Jardin botanique et grande serre'), ok: true,
    desc: _t('Un jardin botanique en pleine floraison. Prière de ne pas marcher sur les pelouses, même mort.') },
  { id: 'meltem', name: 'Meltem', tag: _t('Île des Cyclades'), ok: true,
    desc: _t('Un village blanc au bord de la mer Égée. Le vent y souffle depuis l\u0027Antiquité, personne n\u0027a pensé à l\u0027éteindre.') },
  { id: 'tephra', name: 'Tephra', tag: _t('Station volcanologique'), ok: true,
    desc: _t('Une station de recherche au pied d\u0027un volcan en éruption. Le volcan avait prévenu.') },
  { id: 'stratus', name: 'Stratus', tag: _t('Îles flottantes'), ok: true,
    desc: _t('Des îles suspendues au-dessus des nuages, reliées par des ponts de cordes. Personne ne les a jamais fait réviser.') },
  { id: 'simoun', name: 'Simoun', tag: _t('Mer de dunes'), ok: true,
    desc: _t('Une oasis au milieu des dunes. Au-delà, il n\u0027y a que du sable et ceux qui sont partis vérifier.') },
  { id: 'lotissement', name: 'French Dream', tag: _t('Lotissement pavillonnaire'), ok: true,
    desc: _t('Un lotissement où toutes les maisons se ressemblent. Le syndic décline toute responsabilité.') },
];
const mapById = (id) => MAPS.find((m) => m.id === id && m.ok) || MAPS[0];
/* Carte chargée : entrée de MAPS et définition (null hors partie : le démarrage ne construit aucune carte) */
const CURMAP = { id: null, info: null, def: null };
/* Carte de répartition du sol de la carte chargée : origine, taille (m), pixels par mètre */
const SPLAT = { x0: -64, z0: -80, w: 128, d: 160, ppm: 4 };
/* Construction de chaque carte jouable, déclarée par le fichier de son plan (MAP_DEFS.id = { ... }) :
   bounds (limites de la zone de jeu), textures (surfaces photo de assets/tex/ qu'elle utilise), art (caméra de son
   illustration dans les menus : cam, look, fov ; voir tools/dev/illustrations.js), build() (décor et collisions),
   after() (facultatif : ce qui a besoin des collisions, comme les puits de lumière). Le reste (fusion du décor,
   éclairage cuit, navigation, relevé satellite, shaders) est commun : voir mapBuild dans 09a-loading.js.
   Réglages de jeu et d'ambiance de la carte (spawns, poi, zones, atmo...) : voir en tête de 02z-load.js. */
const MAP_DEFS = {};
/* Tout objet 3D de la carte est rangé sous sa racine (MAPL.root), libérée d'un bloc au déchargement */
function mapAdd(o) { MAPL.root.add(o); return o; }
/* Collisions : {x0,x1,y0,y1,z0,z1,m,ray} ; ray : n'arrête que les tirs ; noRay : arrête les soldats, pas les tirs ;
   inv : mur invisible au bord de l'eau (waterEdge, 02m-water.js), ni couvert pour les bots ni obstacle pour les grenades */
const COL = [];
const RAMPS = []; // rampes : {x0,x1,z0,z1,axis,h0,h1}
const LINES = []; // lignes tendues entre deux points du décor (linge, fils, guirlandes, amarres) : {k, a, b} ; tools/dev/visual/anchors.js vérifie que chaque bout tient à quelque chose
const BRIDGES = []; // ponts suspendus (îles flottantes) : {axis, c, a0, a1, w} ; leurs têtes restent dégagées (tools/dev/visual/decor.js)

/* ---------- Blocs simples ---------- */
/* Boîte centrée (cx, cz), bas à y0, rotation Y optionnelle : décor et collision. o : tint (sRGB), rot, collide,
   m (matière d'impact), rayOnly (n'arrête que les tirs), skip (faces omises), uv (m par tuile), localUV, ao,
   aoBase, bevel. Les éléments fins sans collision ne projettent pas d'ombre (source de scintillement). */
function boxC(key, cx, y0, cz, w, h, d, o = {}) {
  const thin = o.collide === false && Math.min(w, h, d) < 0.12 && key !== 'glass' && key !== 'lamp' && !o.cast;
  const k = LEGACY_KEY[key] || key, M = DECOR, rot = o.rot || 0;
  M.save().move(cx, y0, cz).rotY(rot).color(o.tint);
  M.cls = thin ? 1 : 0;
  if (rot === 0 && !o.localUV) M.world(1); else M.local(1);
  if (o.uv && TEXSCALE[k]) M.uvS = o.uv / TEXSCALE[k];
  M.aoFn = o.ao === false ? null : (x, y, z, nx, ny) => aoAt(y, o) * (ny < -0.5 ? 0.6 : 1);
  if (o.skip !== 'xXyYzZ') M.box(k, w, h, d, { skip: o.skip, bevel: o.bevel });
  if (o.collide !== false) M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, o.m || matKind(key), !!o.rayOnly);
  M.restore();
}
/* Collisions d'un objet posé comme DECOR.place (centre cx, cz, sol y, tourné de rot) : boîtes [x0, x1, y0, y1, z0, z1] dans son repère, qui
   suivent sa forme (caisse, habitacle, cabine...) ; tournées hors angle droit, l'atelier les découpe pour qu'elles collent à l'objet (col, 02a-kit.js) */
function colShape(cx, y, cz, rot, boxes, m = 'metal') {
  const M = DECOR; M.save().move(cx, y, cz).rotY(rot);
  for (const b of boxes) {
    // b[6] 'vitre' : un habitacle vitré arrête les soldats, pas les balles ni la vue (comme une vitre du décor, glassWall)
    if (b[6] === 'vitre') { const w = M._aabb(b[0], b[1], b[2], b[3], b[4], b[5], true); COL.push({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1, z0: w.z0, z1: w.z1, m: 'glass', ray: false, noRay: true }); }
    else M.col(b[0], b[1], b[2], b[3], b[4], b[5], m);
  }
  M.restore();
}
/* Boîte par bornes, alignée sur les axes */
function box(key, x0, x1, y0, y1, z0, z1, o = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0];
  boxC(key, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o);
}
/* Anciennes clés de matière */
const LEGACY_KEY = { metal: 'corrugated', fabric: 'burlap', trim: 'paintwood', leaf: 'foliage' };
function aoAt(y, o) { return o.ao === false ? 1 : lerp(0.7, 1, smoothstep(0.0, 2.2, y - (o.aoBase || 0))); }
function matKind(key) {
  if (key === 'metal' || key === 'steel' || key === 'paint' || key === 'corrugated' || key === 'carpaint') return 'metal';
  if (key === 'wood' || key === 'crate' || key === 'paintwood') return 'wood';
  if (key === 'dirt' || key === 'fabric' || key === 'canvas' || key === 'burlap' || key === 'sand') return 'dirt';
  if (key === 'glass') return 'glass';
  return 'concrete';
}

/* ---------- Escaliers ---------- */
/* Rampe praticable (RAMPS) doublée de marches visibles. Les collisions des marches n'arrêtent que les tirs,
   comme avant ; le décor : marches à nez arrondi, limon latéral. o : tint, mat (matière des marches) */
function ramp(x0, x1, z0, z1, axis, h0, h1, key = 'pavers', tint = [0.8, 0.78, 0.74], o = {}) {
  RAMPS.push({ x0, x1, z0, z1, axis, h0, h1 });
  const len = axis === 'x' ? x1 - x0 : z1 - z0;
  const steps = Math.max(2, Math.round(Math.abs(h1 - h0) / 0.2));
  const M = DECOR, mat = o.mat || (key === 'pavers' ? 'concrete' : key);
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const hTop = Math.max(0.05, lerp(h0, h1, (t0 + t1) / 2) + Math.abs(h1 - h0) / steps / 2);
    const bx0 = axis === 'x' ? x0 + len * t0 : x0, bx1 = axis === 'x' ? x0 + len * t1 : x1, bz0 = axis === 'x' ? z0 : z0 + len * t0, bz1 = axis === 'x' ? z1 : z0 + len * t1;
    M.col(bx0, bx1, 0, hTop, bz0, bz1, 'concrete', true);
    // marche : contremarche pleine et giron débordant (nez)
    M.save().color(tint).world(1);
    M.aoFn = (x, y) => lerp(0.72, 1, smoothstep(0, 0.6, y - hTop + 0.6));
    M.boxB(mat, bx0, bx1, 0, hTop - 0.04, bz0, bz1, { skip: 'y' });
    const up = h1 > h0 ? 1 : -1, nose = 0.03;
    const nx0 = axis === 'x' ? (up > 0 ? bx0 - nose : bx0) : bx0, nx1 = axis === 'x' ? (up > 0 ? bx1 : bx1 + nose) : bx1;
    const nz0 = axis === 'z' ? (up > 0 ? bz0 - nose : bz0) : bz0, nz1 = axis === 'z' ? (up > 0 ? bz1 : bz1 + nose) : bz1;
    M.local(1); M.boxB(mat, nx0, nx1, hTop - 0.045, hTop, nz0, nz1, { bevel: 0.015 });
    M.restore();
  }
}
function rampHeight(r, x, z) {
  const t = r.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
  return lerp(r.h0, r.h1, clamp(t, 0, 1));
}

/* ---------- Requêtes de collision ---------- */
const HASH = new Map(), HCELL = 4;
function buildHash() {
  for (let i = 0; i < COL.length; i++) {
    const c = COL[i];
    for (let x = Math.floor(c.x0 / HCELL); x <= Math.floor(c.x1 / HCELL); x++)
      for (let z = Math.floor(c.z0 / HCELL); z <= Math.floor(c.z1 / HCELL); z++) {
        const k = x * 1000 + z; let a = HASH.get(k); if (!a) HASH.set(k, a = []); a.push(i);
      }
  }
}
/* Une boîte rangée dans plusieurs cases n'est rendue qu'une fois : elle garde le numéro de la dernière requête qui l'a rendue
   (_qstamp). Un Set vidé à chaque requête réallouait sa table : les lignes de vue des bots en faisaient une bonne part des
   allocations d'une image. */
const _qarr = [];
let _qn = 0, _qstamp = new Uint32Array(0);
function queryBegin() {
  _qarr.length = 0;
  if (_qstamp.length < COL.length) _qstamp = new Uint32Array(COL.length + 256);
  if (++_qn === 0xffffffff) { _qstamp.fill(0); _qn = 1; }
}
function queryCell(a) { for (let k = 0; k < a.length; k++) { const i = a[k]; if (_qstamp[i] !== _qn) { _qstamp[i] = _qn; _qarr.push(COL[i]); } } }
function queryBoxes(x0, z0, x1, z1) {
  queryBegin();
  for (let x = Math.floor(x0 / HCELL); x <= Math.floor(x1 / HCELL); x++)
    for (let z = Math.floor(z0 / HCELL); z <= Math.floor(z1 / HCELL); z++) {
      const a = HASH.get(x * 1000 + z); if (a) queryCell(a);
    }
  return _qarr;
}
const STEP = 0.45;
/* Trous du sol (le conduit d'un puits) : cercles (x, z, r) où le sol y = 0 s'ouvre jusqu'au fond y (de l'eau, m) ; posés par la carte au
   chargement, vidés avec elle (mapTeardown). Les tirs y descendent jusqu'au fond ou à la paroi, une grenade y tombe. */
const HOLES = [];
function holeAt(x, z) { for (const h of HOLES) { const dx = x - h.x, dz = z - h.z; if (dx * dx + dz * dz < h.r * h.r) return h; } return null; }
/* Surface la plus haute sous (x,z) accessible depuis la hauteur y ; noInv : sans les murs invisibles (une grenade ne se pose pas dessus) */
function groundHeight(x, z, y, r = 0.2, noInv = false) {
  const g0 = RELIEF.on ? reliefAt(x, z) : 0; // sol implicite : le relief (dunes, 02-relief.js), sinon y = 0
  let g = VOID.on ? VOID.floor : WATER.on && waterAt(x, z) ? WATER.floor : g0; // au-dessus de l'eau (carte portuaire) : le fond ; au-dessus du vide : rien
  if (POOLS.length && (g === g0 || VOID.on)) { const pl = poolAt(x, z); if (pl) g = RELIEF.on ? Math.max(g0, pl.bed) : pl.bed; } // dans un bassin : le fond du bassin (02m-water.js) ; sur une carte en relief, un îlot dépasse du fond
  if (HOLES.length && g === g0) { const hh = holeAt(x, z); if (hh) g = hh.y; }
  const arr = queryBoxes(x - r, z - r, x + r, z + r);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || (noInv && c.inv)) continue;
    if (x + r * 0.5 < c.x0 || x - r * 0.5 > c.x1 || z + r * 0.5 < c.z0 || z - r * 0.5 > c.z1) continue;
    if (c.y1 <= y + STEP && c.y1 > g) g = c.y1;
  }
  for (const rp of RAMPS) {
    if (x < rp.x0 || x > rp.x1 || z < rp.z0 || z > rp.z1) continue;
    const h = rampHeight(rp, x, z);
    if (h <= y + STEP && h > g) g = h;
  }
  return g;
}
/* Déplacement horizontal d'un cylindre avec glissement */
function collideCircle(pos, r, height) {
  const feet = pos.y;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    const arr = queryBoxes(pos.x - r, pos.z - r, pos.x + r, pos.z + r);
    for (let k = 0; k < arr.length; k++) {
      const c = arr[k];
      if (c.ray) continue;
      if (c.y1 <= feet + STEP || c.y0 >= feet + height) continue;
      const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1);
      let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = r - d; pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      } else {
        const l = pos.x - c.x0, rr = c.x1 - pos.x, f = pos.z - c.z0, bb = c.z1 - pos.z, m = Math.min(l, rr, f, bb);
        if (m === l) pos.x = c.x0 - r; else if (m === rr) pos.x = c.x1 + r; else if (m === f) pos.z = c.z0 - r; else pos.z = c.z1 + r;
      }
      moved = true;
    }
    for (const rp of RAMPS) {
      const cx = clamp(pos.x, rp.x0, rp.x1), cz = clamp(pos.z, rp.z0, rp.z1);
      let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 1e-8) continue;
      const h = rampHeight(rp, cx, cz);
      if (h <= feet + STEP) continue;
      const d = Math.sqrt(d2), push = r - d; pos.x += (dx / d) * push; pos.z += (dz / d) * push; moved = true;
    }
    if (!moved) break;
  }
  if (!VOID.on) { pos.x = clamp(pos.x, MAP.x0 + r, MAP.x1 - r); pos.z = clamp(pos.z, MAP.z0 + r, MAP.z1 - r); } // au bord du vide, pas de mur invisible : on tombe
  if (RING.on) { const dx = pos.x - RING.x, dz = pos.z - RING.z, d = hyp(dx, dz); if (d > RING.hard) { pos.x = RING.x + dx * RING.hard / d; pos.z = RING.z + dz * RING.hard / d; } } // zone ronde : pas plus loin que hard
}
function ceilingAbove(x, z, y, r) {
  let c = 99;
  for (const b of queryBoxes(x - r, z - r, x + r, z + r)) {
    if (b.ray) continue;
    if (x + r * 0.7 < b.x0 || x - r * 0.7 > b.x1 || z + r * 0.7 < b.z0 || z - r * 0.7 > b.z1) continue;
    if (b.y0 >= y - 0.05 && b.y0 < c) c = b.y0;
  }
  return c;
}
/* Rayon contre la géométrie statique et les props physiques. Renvoie distance, normale, matière, et le prop touché s'il y en a un
   (RAYHIT.prop). mode : 0 visée et lignes de vue (les petits props, que les balles traversent, sont ignorés), 1 tir (tous les
   props), 2 la carte seule. Les boîtes de collision d'un prop (noRay) ne comptent pas : c'est sa forme qui répond. */
const RAYHIT = { t: 0, nx: 0, ny: 0, nz: 0, m: 'concrete', prop: null }, _rn = [0, 1, 0];
function rayWorld(ox, oy, oz, dx, dy, dz, maxD, mode = 0) {
  let best = maxD, bn = 0, bm = 'concrete', found = false, pb = null;
  if (RELIEF.on && !VOID.on) {
    // relief (dunes) : dans toutes les directions ; au-dessus d'un bassin, la surface de l'eau
    const t = reliefRay(ox, oy, oz, dx, dy, dz, best);
    if (t >= 0) {
      best = t; bm = 'ground'; bn = 9; found = true;
      if (POOLS.length && dy < -1e-6) { const pl = poolAt(ox + dx * t, oz + dz * t); if (pl && oy > pl.wl) { const tw = (pl.wl - oy) / dy; if (tw < best) { best = tw; bm = 'water'; bn = 2; } } }
      if (HOLES.length && dy < -1e-6 && bm === 'ground') { // trou d'un puits dans le sable : le tir continue dans le conduit (voir plus bas, sur le sol plat)
        const hh = holeAt(ox + dx * t, oz + dz * t);
        if (hh) {
          const px = ox + dx * t - hh.x, pz = oz + dz * t - hh.z, a = dx * dx + dz * dz, b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - hh.r * hh.r;
          const sw = a > 1e-9 ? (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a) : Infinity, sf = (hh.y - (oy + dy * t)) / dy;
          if (sw < sf) { const wx = px + dx * sw, wz = pz + dz * sw; best = t + sw; bm = hh.wall; bn = Math.abs(wx) > Math.abs(wz) ? (wx > 0 ? -1 : 1) : (wz > 0 ? -3 : 3); }
          else { best = t + sf; bm = hh.m; bn = 2; }
        }
      }
    }
  } else if (dy < -1e-6 && !VOID.on) {
    // sol (y = 0) ; au-dessus de l'eau, la surface de l'eau (02m-water.js), plus bas ; au-dessus du vide, aucun (le dessus des îles est fait de boîtes)
    let t = -oy / dy, gm = 'ground', gn = 2;
    if (WATER.on && t > 0 && t < best && waterAt(ox + dx * t, oz + dz * t)) { t = (WATER.y - oy) / dy; gm = 'water'; }
    else if (POOLS.length && t > 0 && t < best) { const pl = poolAt(ox + dx * t, oz + dz * t); if (pl && oy > pl.wl) { t = (pl.wl - oy) / dy; gm = 'water'; } } // bassin : le tir touche la surface de l'eau
    if (HOLES.length && t > 0 && t < best && gm === 'ground') {
      // trou d'un puits : le tir continue dans le conduit jusqu'à la paroi (pierre) ou jusqu'au fond (eau)
      const hh = holeAt(ox + dx * t, oz + dz * t);
      if (hh) {
        const px = ox + dx * t - hh.x, pz = oz + dz * t - hh.z, a = dx * dx + dz * dz, b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - hh.r * hh.r;
        const sw = a > 1e-9 ? (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a) : Infinity, sf = hh.y / dy;
        if (sw < sf) { const wx = px + dx * sw, wz = pz + dz * sw; t += sw; gm = hh.wall; gn = Math.abs(wx) > Math.abs(wz) ? (wx > 0 ? -1 : 1) : (wz > 0 ? -3 : 3); }
        else { t += sf; gm = hh.m; }
      }
    }
    if (t > 0 && t < best) { best = t; bn = gn; bm = gm; found = true; }
  }
  const ex = ox + dx * maxD, ez = oz + dz * maxD;
  const arr = queryBoxesRay(ox, oz, ex, ez);
  const ix = 1 / (Math.abs(dx) < 1e-9 ? 1e-9 : dx), iy = 1 / (Math.abs(dy) < 1e-9 ? 1e-9 : dy), iz = 1 / (Math.abs(dz) < 1e-9 ? 1e-9 : dz);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.noRay) continue;
    let t1 = (c.x0 - ox) * ix, t2 = (c.x1 - ox) * ix;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
    t1 = (c.y0 - oy) * iy; t2 = (c.y1 - oy) * iy;
    let a = Math.min(t1, t2), b = Math.max(t1, t2);
    if (a > tmin) { tmin = a; ax = 1; } if (b < tmax) tmax = b;
    t1 = (c.z0 - oz) * iz; t2 = (c.z1 - oz) * iz;
    a = Math.min(t1, t2); b = Math.max(t1, t2);
    if (a > tmin) { tmin = a; ax = 2; } if (b < tmax) tmax = b;
    if (tmax < Math.max(tmin, 0) || tmin > best || tmin < 0) continue;
    best = tmin; bm = c.m; found = true;
    bn = ax === 0 ? (dx > 0 ? -1 : 1) : ax === 1 ? (dy > 0 ? -2 : 2) : (dz > 0 ? -3 : 3);
  }
  if (PHYS.live && mode !== 2) { const h = propsRay(ox, oy, oz, dx, dy, dz, best, mode); if (h) { best = h.t; bm = h.b.d.mat; found = true; pb = h; } }
  if (!found) return null;
  RAYHIT.t = best; RAYHIT.m = bm; RAYHIT.prop = pb ? pb.b : null;
  if (pb) { RAYHIT.nx = pb.nx; RAYHIT.ny = pb.ny; RAYHIT.nz = pb.nz; return RAYHIT; }
  if (bn === 9) { const n = reliefNormal(ox + dx * best, oz + dz * best, _rn); RAYHIT.nx = n[0]; RAYHIT.ny = n[1]; RAYHIT.nz = n[2]; return RAYHIT; } // pente d'une dune
  RAYHIT.nx = Math.abs(bn) === 1 ? Math.sign(bn) : 0; RAYHIT.ny = Math.abs(bn) === 2 ? Math.sign(bn) : 0; RAYHIT.nz = Math.abs(bn) === 3 ? Math.sign(bn) : 0;
  return RAYHIT;
}
/* Parcours des cellules traversées par le segment (DDA sur la grille de hachage) */
function queryBoxesRay(x0, z0, x1, z1) {
  queryBegin();
  let cx = Math.floor(x0 / HCELL), cz = Math.floor(z0 / HCELL);
  const ex = Math.floor(x1 / HCELL), ez = Math.floor(z1 / HCELL);
  const dx = x1 - x0, dz = z1 - z0;
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(dx) < 1e-9 ? 1e9 : Math.abs(HCELL / dx), tdz = Math.abs(dz) < 1e-9 ? 1e9 : Math.abs(HCELL / dz);
  let tmx = Math.abs(dx) < 1e-9 ? 1e9 : ((sx > 0 ? (cx + 1) * HCELL - x0 : x0 - cx * HCELL) / Math.abs(dx));
  let tmz = Math.abs(dz) < 1e-9 ? 1e9 : ((sz > 0 ? (cz + 1) * HCELL - z0 : z0 - cz * HCELL) / Math.abs(dz));
  for (let n = 0; n < 400; n++) {
    const a = HASH.get(cx * 1000 + cz);
    if (a) queryCell(a);
    if (cx === ex && cz === ez) break;
    if (tmx < tmz) { if (tmx > 1) break; tmx += tdx; cx += sx; } else { if (tmz > 1) break; tmz += tdz; cz += sz; }
  }
  return _qarr;
}
function lineClear(a, b) {
  _v4.subVectors(b, a); const d = _v4.length(); if (d < 1e-4) return true;
  _v4.divideScalar(d);
  const h = rayWorld(a.x, a.y, a.z, _v4.x, _v4.y, _v4.z, d);
  return !h || h.t >= d - 0.05;
}

/* ---------- Zones nommées (affichées sous la mini-carte) ----------
   [nom, x0, x1, z0, z1] ; la première qui contient le point l'emporte. Recopiées depuis la définition de la carte. */
const ZONES = [];
function zoneName(x, z) { for (const zn of ZONES) if (x >= zn[1] && x <= zn[2] && z >= zn[3] && z <= zn[4]) return zn[0]; return CURMAP.info ? CURMAP.info.name : ''; }
