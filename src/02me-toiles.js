/* ==========================================================================
   TISSUS DU DÉCOR : toiles simulées sur le processeur (le toit de toiles du souk de Khamsin, le linge, les tapis, les drapeaux ; puis les
   tentes, les bâches et les stores). Retours du propriétaire, octobre 2026 : « plusieurs tissus tendus, les uns au-dessus des autres, avec une
   vraie physique de tissu tendu, comme les capes, qui réagissent à l'environnement, au souffle d'une explosion, sans aller dans tous les sens
   ni se traverser », puis « chaque tissu du jeu passe en élément physique ; le linge, les draps ont une vraie physique, comme les capes : si
   mon personnage court à travers le tissu, il se déforme ; les tissus réagissent aux explosions ».
   Chaque toile est faite d'une ou plusieurs nappes de particules menées par le moteur des capes (ClothSim, 06gb-tissu.js) : contraintes de
   structure, de cisaillement et de pliure, pesanteur, vent de la carte (rafales, remous, et un souffle vertical qui fait respirer une toile
   à plat) qui pousse l'étoffe selon sa normale. Sa cible est sa forme de repos :
   - épinglée : attachée à une perche, une poutre, une corde (pince à linge), une hampe ;
   - les autres particules ne s'éloignent jamais de leur place de repos de plus de leur jeu (maxD) : une toile ne s'emballe pas, et deux
     toiles étagées à plus de deux fois leur jeu l'une de l'autre ne se touchent jamais. Une toile tendue a un jeu de quelques centimètres et
     un rappel fort vers sa forme (home) ; un linge pendu a un jeu de la taille de la pièce et presque pas de rappel : il se balance, se
     soulève au vent, s'écarte au passage d'un soldat et retombe ;
   - soldats (o.body) : chacun est une capsule (des pieds à la tête, 28 cm de rayon) qui repousse l'étoffe ; la toile garde la vitesse
     que lui donne le passage (Verlet) : elle s'ouvre devant le soldat, glisse sur ses épaules et se referme derrière lui ;
   - souffle : une explosion pousse les particules proches (toilesBlast, appelé par explode) : la toile se gonfle et retombe en quelques
     secondes ; une balle qui traverse un linge le pousse dans son sens (toilesShot, appelé par fireRay), sans s'y arrêter.
   Rien de tout cela ne change le jeu (aucune collision ne suit l'étoffe) : chaque machine simule ses tissus pour elle seule.
   Déclaration : une construction pose ses nappes par Maker.fabric (en coordonnées locales, dans un prefab comme dans le décor) ; à la fin de
   la construction (tissusBuild), les nappes d'un même groupe (f.grp : une corde à linge ; sinon le carré de 16 m) et de même réglage
   deviennent une seule toile, donc un seul appel de rendu.
   Rendu : un maillage par toile, deux nappes, le dessus et le dessous (retourné, 7 mm plus loin), dans une matière du décor sans face arrière
   (o.mat). Le dessous peut être éclairci (glow) : la lumière du soleil qui traverse l'étoffe. Pas de pré-passe de profondeur (la toile bouge) ;
   ombre portée (la cascade proche se refait à chaque image). La carte pose les collisions du jeu qu'il faut (boîtes noRay qui arrêtent les
   grenades sous un toit de toile, volumes d'occlusion de la forme au repos pour l'éclairage cuit, qui ne bougent pas).
   Coût : pas fixe de 1/60 s (1/30 sur téléphone, avec moins de passes), deux au plus par image ; hors du champ ou à plus de 60 m de la
   caméra (45 m pour un linge ; 35 m pour une toile tendue sur téléphone), une toile garde sa dernière pose (sauf pendant les 3 s qui suivent
   un souffle ou un passage). Au-delà de 20 m, une toile n'est simulée qu'une image sur deux, au-delà de 40 m une sur quatre (elle bouge
   alors au ralenti, ce qui ne se voit pas de si loin). Relevé sur Khamsin et Simoun (11 400 et 10 500 particules en tout) : de 1,3 à 1,9 ms
   par image pour toutes les toiles visibles d'un coup, sur le processeur du banc, avant ces niveaux de détail.
   ========================================================================== */
const TOILES = [];
const FABRICS = []; // nappes déclarées pendant la construction (Maker.fabric), réunies par tissusBuild
const TOILE_H = COARSE || ULTRA ? 1 / 30 : 1 / 60;
const _tlw = new V3(), _tfr = new THREE.Frustum(), _tpm = new THREE.Matrix4();
let TOILE_F = 0; // images comptées, pour simuler les toiles lointaines une image sur deux ou sur quatre
/* Réglages de chaque genre de tissu : prise au vent, part du vent de la carte, pesanteur (m/s²), rappel vers la forme de repos (par pas
   de 1/60 s), soldats qui le déforment, balles qui le poussent, distance au-delà de laquelle il ne bouge plus */
const TISSU_GENRES = {
  tendu: { drag: 0.6, wind: 1, g: 2.5, home: 0.006, body: false, shot: false, far: COARSE || ULTRA ? 35 : 60 },
  pendu: { drag: 0.85, wind: 0.75, g: 9.8, home: 0.0012, body: true, shot: true, far: 45 },
  lourd: { drag: 0.45, wind: 0.5, g: 9.8, home: 0.002, body: true, shot: true, far: 45 }, // tapis, couverture
  drapeau: { drag: 0.9, wind: 1.2, g: 4, home: 0.004, body: false, shot: true, far: 70, flap: 1.6 }, // flap : claquement (ClothSim.step)
};
/* Une nappe sous forme de fonctions (o.cu x o.rv particules ; u en travers, v en long, de 0 à 1) : o.rest(u, v) -> [x, y, z] ; o.pin(u, v) ;
   o.maxD(u, v) ; o.uv(u, v) -> [s, t] ; o.color [r, g, b] (sRGB) ; o.glow(u, v) -> 0 à 1, lumière qui traverse (dessous) */
function toileSheet(o) {
  const cu = o.cu, rv = o.rv, P = [], pin = [], maxD = [], uv = [], glow = [];
  for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) {
    const u = i / (cu - 1), v = j / (rv - 1);
    P.push(o.rest(u, v)); pin.push(o.pin(u, v) ? 1 : 0); maxD.push(o.maxD(u, v)); uv.push(o.uv(u, v)); glow.push(o.glow ? o.glow(u, v) : 0);
  }
  const c = o.color || [1, 1, 1];
  return { cu, rv, P, pin, maxD, uv, glow, side: [0, 1, 0], lin: [sl(c[0]), sl(c[1]), sl(c[2])] };
}
/* Ajoute une toile. Ses nappes : o.sheets (comme Maker.fabric : cu, rv, P, pin, maxD, uv, glow (nombre ou liste), side, lin), sinon une
   nappe décrite par des fonctions (toileSheet). o.mat : matière (MAT) ; o.genre : réglages (TISSU_GENRES, 'tendu' par défaut), que
   o.drag, o.wind, o.g, o.home, o.body, o.shot remplacent. Renvoie la toile. */
function toileAdd(o) {
  const sheets = o.sheets || [toileSheet(o)], G0 = TISSU_GENRES[o.genre || 'tendu'], opt = (k) => (o[k] !== undefined ? o[k] : G0[k]);
  let n = 0; for (const s of sheets) n += s.cu * s.rv;
  const rest = new Float32Array(n * 3), pin = new Float32Array(n), maxD = new Float32Array(n), C = [], L = [], K = [], out = [];
  const N2 = n * 2, pos = new Float32Array(N2 * 3), nor = new Float32Array(N2 * 3), uvs = new Float32Array(N2 * 2), col = new Float32Array(N2 * 3), aoc = new Float32Array(N2).fill(1), idx = [];
  let o0 = 0;
  for (const s of sheets) {
    const cu = s.cu, rv = s.rv, m = cu * rv;
    for (let k = 0; k < m; k++) {
      const q = o0 + k, p = s.P[k], g = 1 + (Array.isArray(s.glow) ? s.glow[k] : s.glow || 0), c = s.lin || [1, 1, 1];
      rest[q * 3] = p[0]; rest[q * 3 + 1] = p[1]; rest[q * 3 + 2] = p[2];
      pin[q] = s.pin[k] ? 1 : 0; maxD[q] = pin[q] ? 0 : s.maxD[k];
      for (const [r, f] of [[q, 1], [q + n, g]]) { uvs[r * 2] = s.uv[k][0]; uvs[r * 2 + 1] = s.uv[k][1]; col[r * 3] = c[0] * f; col[r * 3 + 1] = c[1] * f; col[r * 3 + 2] = c[2] * f; }
    }
    const G = clothGridCons(rest, cu, rv, o0);
    for (let c = 0; c < G.stf.length; c++) { C.push(G.con[c * 2], G.con[c * 2 + 1]); L.push(G.len[c]); K.push(G.stf[c]); }
    const sd = s.side || [0, 1, 0], sgn = clothSign(rest, o0, cu, rv, (v) => v.set(sd[0], sd[1], sd[2]));
    out.push({ o: o0, cu, rv, sgn });
    // face avant du dessus du côté de la normale de la nappe ; le dessous à l'inverse
    for (let j = 0; j + 1 < rv; j++) for (let i = 0; i + 1 < cu; i++) {
      const a = o0 + j * cu + i, b = a + 1, d = a + cu, e = d + 1;
      if (sgn > 0) idx.push(a, b, d, b, e, d, a + n, d + n, b + n, b + n, d + n, e + n); else idx.push(a, d, b, b, d, e, a + n, b + n, d + n, b + n, e + n, d + n);
    }
    o0 += m;
  }
  // pesanteur et rappel vers la forme de repos (par pas de 1/60 s, au carré du pas sinon : même fréquence, même creux) : la tension
  // d'une toile tendue porte une part de son poids et la ramène à sa forme
  const T = { n, rest, pin, maxD, con: new Uint16Array(C), len: new Float32Array(L), stf: new Float32Array(K), drag: opt('drag'), g: opt('g'),
    home: opt('home') * (TOILE_H * 60) ** 2, flap: opt('flap') || 0, sheets: out };
  const sim = new ClothSim(T); sim.tgt.set(rest); sim.reset(); sim.normals();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aoc', new THREE.BufferAttribute(aoc, 1));
  geo.setIndex(new THREE.BufferAttribute(N2 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  // sphère englobante fixe : la forme de repos et son jeu (les positions changent à chaque image)
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, md = 0;
  for (let k = 0; k < n; k++) { const x = rest[k * 3], y = rest[k * 3 + 1], z = rest[k * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); md = Math.max(md, maxD[k]); }
  const ctr = new V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  geo.boundingSphere = new THREE.Sphere(ctr, Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2) / 2 + md + 0.1);
  sim.ground = y0 - md - 0.05; // (aucune particule ne descend plus bas que son jeu)
  const mat = toileMat(o.mat || 'toile'), mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'map:toile'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.userData.noPrepass = true;
  mapAdd(mesh);
  const S = { T, sim, mesh, pos, nor, sph: geo.boundingSphere, acc: 0, kick: 0, wind: opt('wind'), body: opt('body'), shot: opt('shot'), far2: opt('far') ** 2 };
  toileWrite(S); TOILES.push(S);
  return S;
}
/* Matière d'une toile : celle du décor, sans sa face arrière (la toile a ses deux nappes, à 7 mm l'une de l'autre : vues toutes deux des deux
   côtés, elles se disputaient la profondeur, un moirage) ; une copie par matière, gardée pour la carte */
const TOILE_MATS = new Map();
function toileMat(k) {
  const m = MAT[k]; if (m.side !== THREE.DoubleSide) return m;
  let c = TOILE_MATS.get(m); if (c) return c;
  c = m.clone(); c.side = THREE.FrontSide; c.onBeforeCompile = m.onBeforeCompile; c.userData = m.userData; c.customProgramCacheKey = m.customProgramCacheKey;
  c.uuid = 'decor-' + k + '-toile'; // identifiant fixe (voir shadeMaterials, appelée plus tard)
  TOILE_MATS.set(m, c); return c;
}
/* Positions et normales des deux nappes, d'après la simulation */
function toileWrite(S) {
  const n = S.T.n, p = S.sim.p, N = S.sim.nor, P = S.pos, Q = S.nor;
  for (let k = 0; k < n * 3; k++) { P[k] = p[k]; Q[k] = N[k]; P[k + n * 3] = p[k] - N[k] * 0.007; Q[k + n * 3] = -N[k]; }
  const g = S.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}
/* Soldats qui touchent la toile : une capsule chacun (pieds à tête), dans la limite des capsules du moteur ; vrai s'il y en a */
function toileBodies(S) {
  const sim = S.sim, c = S.sph.center, R = S.sph.radius + 0.5;
  sim.nc = 0;
  for (const e of entities) {
    if (!e.alive || e.off || sim.nc >= sim.cap.length) continue;
    const dx = e.pos.x - c.x, dz = e.pos.z - c.z, top = e.pos.y + 1.62 * (1 - (e.crouchAmt || 0) * 0.33);
    if (dx * dx + dz * dz > R * R || top < c.y - R || e.pos.y > c.y + R) continue;
    const C = sim.cap[sim.nc++]; C.a.set(e.pos.x, e.pos.y + 0.3, e.pos.z); C.b.set(e.pos.x, top - 0.14, e.pos.z); C.r = 0.28; C.o = null;
  }
  return sim.nc > 0;
}
/* À chaque image (mapUpdate) : vent de la carte, puis les toiles proches et dans le champ */
function toilesUpdate(dt) {
  if (!TOILES.length || !dt) return;
  const id = CURMAP.id, b = CLOTH_BREEZE[id] || CLOTH_BREEZE_DEF, t = CLOTH.t, l = Math.sqrt(b[0] * b[0] + b[1] * b[1]) || 1;
  const gust = 0.6 + 0.3 * Math.sin(t * 0.45) + 0.25 * Math.sin(t * 1.3 + 1.7) + 0.15 * Math.sin(t * 2.9 + 0.4), k = b[2] * gust;
  // le vent qui passe sur une toile à plat la soulève et la laisse retomber (dépression au-dessus, remous) : elle respire
  _tlw.set(b[0] / l * k, k * (0.35 * Math.sin(t * 0.9) + 0.2 * Math.sin(t * 2.3 + 0.6)), b[1] / l * k);
  camera.updateMatrixWorld(); _tfr.setFromProjectionMatrix(_tpm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const it = COARSE || ULTRA ? 2 : 3; TOILE_F++;
  for (let i = 0; i < TOILES.length; i++) {
    const S = TOILES[i];
    S.kick = Math.max(0, S.kick - dt);
    if (S.body && toileBodies(S)) S.kick = Math.max(S.kick, 1.5); // un soldat au contact : la toile vit, même hors du champ (elle se referme derrière lui)
    const d2 = S.sph.center.distanceToSquared(camera.position);
    if (S.kick <= 0 && (d2 > S.far2 || !_tfr.intersectsSphere(S.sph))) { S.acc = 0; continue; }
    const rate = S.kick > 0 || d2 < 400 ? 1 : d2 < 1600 ? 2 : 4; // une image sur rate, décalée d'une toile à l'autre
    if ((TOILE_F + i) % rate) continue;
    const w = _tlw, f = S.wind;
    if (f !== 1) w.multiplyScalar(f);
    S.acc = Math.min(S.acc + dt, TOILE_H * 2);
    while (S.acc >= TOILE_H) { S.sim.step(TOILE_H, w, it); S.sim.normals(); S.acc -= TOILE_H; }
    if (f !== 1) w.multiplyScalar(1 / f);
    toileWrite(S);
  }
}
/* Souffle d'une explosion en p (rayon r de ses dégâts) : les particules à moins de 1,8 r sont poussées loin du centre, jusqu'à 9 m/s
   tout près ; le jeu de chaque particule borne le gonflement */
function toilesBlast(p, r) {
  const R = r * 1.8;
  for (const S of TOILES) {
    if (S.sph.center.distanceTo(p) > S.sph.radius + R) continue;
    const P = S.sim.p, Q = S.sim.q, pin = S.T.pin;
    for (let k = 0; k < S.T.n; k++) {
      if (pin[k] >= 1) continue;
      const dx = P[k * 3] - p.x, dy = P[k * 3 + 1] - p.y, dz = P[k * 3 + 2] - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= R) continue;
      const f = 9 * (1 - d / R) * (1 - d / R) / Math.max(d, 0.3) * TOILE_H; // vitesse donnée (m/s), en pas de Verlet
      Q[k * 3] -= dx * f; Q[k * 3 + 1] -= dy * f; Q[k * 3 + 2] -= dz * f;
    }
    S.kick = 3;
  }
}
/* Balle de o, direction d (unitaire), jusqu'à la distance maxT : les particules d'un linge à moins de 25 cm de sa trajectoire prennent
   jusqu'à 4 m/s dans son sens ; la balle continue (le tissu ne l'arrête pas) */
function toilesShot(o, d, maxT) {
  for (const S of TOILES) {
    if (!S.shot) continue;
    const c = S.sph.center, cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -S.sph.radius || tc > maxT + S.sph.radius) continue;
    const ex = cx - d.x * tc, ey = cy - d.y * tc, ez = cz - d.z * tc;
    if (ex * ex + ey * ey + ez * ez > S.sph.radius * S.sph.radius) continue;
    const P = S.sim.p, Q = S.sim.q, pin = S.T.pin, k0 = 4 * TOILE_H; let hit = false;
    for (let k = 0; k < S.T.n; k++) {
      if (pin[k] >= 1) continue;
      const px = P[k * 3] - o.x, py = P[k * 3 + 1] - o.y, pz = P[k * 3 + 2] - o.z, t = px * d.x + py * d.y + pz * d.z;
      if (t < 0 || t > maxT) continue;
      const qx = px - d.x * t, qy = py - d.y * t, qz = pz - d.z * t, e2 = qx * qx + qy * qy + qz * qz;
      if (e2 > 0.0625) continue;
      const f = k0 * (1 - Math.sqrt(e2) / 0.25);
      Q[k * 3] -= d.x * f; Q[k * 3 + 1] -= d.y * f; Q[k * 3 + 2] -= d.z * f; hit = true;
    }
    if (hit) S.kick = Math.max(S.kick, 2);
  }
}
/* Fin de la construction : les nappes déclarées (FABRICS) deviennent des toiles, une par groupe (f.grp, sinon le carré de TISSU_CELL m) et
   par réglage (matière, genre). Des carrés de 12 m ajoutaient 70 appels de rendu sur Khamsin (+12 %, bench.js) : 16 m, 24 m sur téléphone */
const TISSU_CELL = COARSE || ULTRA ? 24 : 16;
function tissusBuild() {
  const groups = new Map();
  for (const f of FABRICS) {
    const c = f.P[0], key = (f.mat || 'canvas') + '|' + (f.genre || 'pendu') + '|' + (f.grp || Math.floor(c[0] / TISSU_CELL) + ',' + Math.floor(c[2] / TISSU_CELL));
    let g = groups.get(key); if (!g) groups.set(key, g = { mat: f.mat || 'canvas', genre: f.genre || 'pendu', sheets: [] });
    g.sheets.push(f);
  }
  for (const g of groups.values()) toileAdd({ sheets: g.sheets, mat: g.mat, genre: g.genre });
  FABRICS.length = 0;
}
/* Déchargement de la carte (les maillages partent avec sa racine) */
function toilesClear() { TOILES.length = 0; FABRICS.length = 0; for (const c of TOILE_MATS.values()) c.dispose(); TOILE_MATS.clear(); }
