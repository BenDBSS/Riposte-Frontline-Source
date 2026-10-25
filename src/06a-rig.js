/* ==========================================================================
   SQUELETTES RIGIDES : regroupement des maillages pour le rendu
   Les modèles restent décrits pièce par pièce (boîtes, cylindres, sphères posées dans des groupes), ce qui
   les garde faciles à modifier. Une fois construits, bakeRig réunit toutes les pièces fixes d'une hiérarchie
   en un seul maillage par matière : chaque groupe qui porte des pièces devient un os d'un squelette rigide
   (un sommet suit un seul os, avec un poids de 1). On continue d'animer les groupes exactement comme avant,
   les sommets suivent ; un modèle de 150 pièces passe de 150 appels de rendu à quelques-uns.
   ========================================================================== */
const _RIG_ID = new THREE.Matrix4();
/* Matière des maillages qui ne servent qu'à projeter une ombre (rien n'est écrit à l'écran) */
const SHADOW_ONLY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
/* Matière des cartes d'ombre pour les maillages animés. three.js en partage une seule entre tous les objets : chaque
   passage d'un maillage animé (soldat) à un maillage fixe (son arme, le décor) l'obligeait à rechoisir son programme,
   des dizaines de fois par image (trois cascades). Une matière à part pour les maillages animés supprime ces bascules. */
const SKIN_DEPTH_MAT = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

/* Squelette dont les os sont des groupes ordinaires. Un os caché (lui ou un parent jusqu'à la racine du
   modèle) a sa matrice mise à zéro : ses sommets se replient en un point et ne sont plus dessinés, ce qui
   préserve les bascules de visibilité des sous-groupes (chargeur, pièces masquées). */
function rigidSkeleton(bones, root) {
  const sk = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const up = sk.update.bind(sk);
  sk.update = function () {
    up();
    const bm = this.boneMatrices;
    for (let i = 0; i < bones.length; i++) {
      let o = bones[i], vis = true;
      while (o && o !== root) { if (!o.visible) { vis = false; break; } o = o.parent; }
      if (!vis) bm.fill(0, i * 16, i * 16 + 16);
    }
  };
  return sk;
}

/* Géométrie d'une liste de pièces { geo, matrix (dans l'espace de son os), bone } : attributs communs
   position / normale / uv (+ couleur si demandé), indices conservés (cache de sommets du GPU), os par sommet. */
function rigGeometry(items, withColor) {
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = withColor ? new Float32Array(nv * 3) : null;
  const skI = new Uint16Array(nv * 4), skW = new Float32Array(nv * 4), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const nm = new THREE.Matrix3(), v = new V3();
  let vo = 0, io = 0;
  for (const it of items) {
    const g = it.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color, n = P.count;
    nm.getNormalMatrix(it.matrix);
    for (let k = 0; k < n; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(it.matrix); v.toArray(pos, (vo + k) * 3);
      if (N) { v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); v.toArray(nor, (vo + k) * 3); }
      if (it.uvMap) it.uvMap(U ? U.getX(k) : 0, U ? U.getY(k) : 0, uv, (vo + k) * 2);
      else if (U) { uv[(vo + k) * 2] = U.getX(k); uv[(vo + k) * 2 + 1] = U.getY(k); }
      if (col) { const c = it.color; if (c) { col[(vo + k) * 3] = c.r; col[(vo + k) * 3 + 1] = c.g; col[(vo + k) * 3 + 2] = c.b; } else if (C) { col[(vo + k) * 3] = C.getX(k); col[(vo + k) * 3 + 1] = C.getY(k); col[(vo + k) * 3 + 2] = C.getZ(k); } else col.fill(1, (vo + k) * 3, (vo + k) * 3 + 3); }
      skI[(vo + k) * 4] = it.bone; skW[(vo + k) * 4] = 1;
    }
    if (g.index) { const I = g.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; io += I.length; }
    else { for (let k = 0; k < n; k++) idx[io + k] = vo + k; io += n; }
    vo += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(skW, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/* Maillage rigide lié à un squelette. Mode « attached » avec des inverses identité : un sommet exprimé dans
   l'espace de son os se retrouve à boneWorld × sommet, où que soit rangé le maillage lui-même. */
function rigMesh(geo, mat, skel) {
  const m = new THREE.SkinnedMesh(geo, mat);
  m.bind(skel, _RIG_ID); m.customDepthMaterial = SKIN_DEPTH_MAT;
  return m;
}

/* Arme en main : pièces fixes réunies par matière ; chargeur, culasse, glissière et pompe restent des os
   animés, le réticule des viseurs (m.keep) reste une pièce à part. */
function vmGunModel(key) {
  const m = buildGunModel(key);
  bakeRig(m.group, { keep: m.keep });
  return m;
}

/* Matière d'un maillage lié à un squelette : une copie de celle des pièces. Le programme d'un maillage animé par os n'est pas celui d'un
   maillage simple ; partagée entre les pièces fixes réunies (rigMesh) et les pièces mobiles restées à part (chargeur, culasse), une matière de
   l'arme en main changeait de programme deux fois par image, et three.js recalculait sa clé chaque fois (saccades.js, octobre 2026). La copie
   garde le patch de la matière (onBeforeCompile) et ses uniformes (userData partagé) ; une par matière, gardée pour la session. */
const SKIN_TWINS = new Map();
function skinTwin(m) {
  let c = SKIN_TWINS.get(m); if (c) return c;
  c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.userData = m.userData; c.customProgramCacheKey = m.customProgramCacheKey;
  SKIN_TWINS.set(m, c); return c;
}
/* Réunit les pièces fixes de la hiérarchie root. Une pièce est une feuille Mesh ordinaire, visible, à matière
   unique, ni référencée dans opts.keep ni marquée userData.dyn (pièce animée ou modifiée individuellement :
   elle reste telle quelle). Sans sous-groupe mobile, le résultat est un maillage ordinaire fusionné. */
function bakeRig(root, opts = {}) {
  const keep = new Set((opts.keep || []).filter(Boolean));
  root.updateMatrixWorld(true);
  const bones = [], boneOf = new Map(), byMat = new Map(), taken = [];
  const visit = (n) => {
    for (const c of n.children) {
      if (keep.has(c)) continue;
      const leaf = c.isMesh && !c.isSkinnedMesh && !c.isInstancedMesh && c.children.length === 0 && c.visible && !c.userData.dyn && !Array.isArray(c.material) && c.geometry.attributes.normal; // les groupes de faces (boîtes, cylindres) ne comptent qu'avec plusieurs matières
      if (leaf) {
        if (!boneOf.has(n)) { boneOf.set(n, bones.length); bones.push(n); }
        const list = byMat.get(c.material) || []; if (!list.length) byMat.set(c.material, list);
        c.updateMatrix();
        list.push({ geo: c.geometry, matrix: c.matrix.clone(), bone: boneOf.get(n), cast: c.castShadow, recv: c.receiveShadow, order: c.renderOrder });
        taken.push(c);
      } else visit(c);
    }
  };
  visit(root);
  if (!taken.length) return [];
  for (const c of taken) c.parent.remove(c);
  const rigid = bones.length === 1 && bones[0] === root; // tout est fixe : maillage ordinaire, sans squelette
  const skel = rigid ? null : rigidSkeleton(bones, root);
  const out = [];
  for (const [mat, list] of byMat) {
    const geo = rigGeometry(list, !!mat.vertexColors);
    let m;
    if (rigid) { geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight'); m = new THREE.Mesh(geo, mat); }
    else { m = rigMesh(geo, skinTwin(mat), skel); m.frustumCulled = opts.cull === true; }
    m.castShadow = list.some((it) => it.cast); m.receiveShadow = list.some((it) => it.recv); m.renderOrder = list[0].order;
    if (!rigid && opts.cull !== true) geo.boundingSphere = new THREE.Sphere(new V3(), 1e4);
    root.add(m); out.push(m);
  }
  return out;
}

/* ==========================================================================
   MAILLAGES LISSÉS : surfaces continues déformées par plusieurs os
   Corps, bras et mains ne sont plus des assemblages de pièces rigides mais des surfaces continues (sections
   lofées, surfaces paramétriques), construites dans une pose de repos. Chaque sommet suit jusqu'à quatre os,
   avec des poids qui se fondent aux articulations (skinning linéaire). Les os restent des groupes ordinaires,
   animés comme avant ; leur matrice de repos, inversée, ramène chaque sommet dans l'espace de son os.
   ========================================================================== */
class SkinBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.si = []; this.sw = []; this.idx = []; this.v0 = 0; this.i0 = 0; }
  get count() { return this.p.length / 3; }
  /* w : indice d'os, ou liste [[os, poids], ...] (les quatre plus forts, normalisés) ; col : THREE.Color (1 par défaut) */
  vert(x, y, z, u, v, col, w) {
    this.p.push(x, y, z); this.n.push(0, 0, 0); this.uv.push(u, v);
    if (col) this.c.push(col.r, col.g, col.b); else this.c.push(1, 1, 1);
    if (typeof w === 'number') { this.si.push(w, 0, 0, 0); this.sw.push(1, 0, 0, 0); return this.count - 1; }
    const l = w.length > 4 ? w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4) : w;
    let s = 0; for (const e of l) s += e[1];
    for (let k = 0; k < 4; k++) { const e = l[k]; this.si.push(e ? e[0] : 0); this.sw.push(e && s > 0 ? e[1] / s : k === 0 ? 1 : 0); }
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  /* une pièce : ses normales sont lissées entre ses seules faces, coutures comprises (sommets confondus) */
  begin() { this.v0 = this.count; this.i0 = this.idx.length; }
  end(weld = true) {
    const P = this.p, N = this.n, I = this.idx, v0 = this.v0;
    for (let t = this.i0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
    }
    if (weld) {
      const map = new Map();
      for (let i = v0; i < this.count; i++) {
        const key = `${Math.round(P[i * 3] * 2e4)},${Math.round(P[i * 3 + 1] * 2e4)},${Math.round(P[i * 3 + 2] * 2e4)}`;
        const l = map.get(key); if (l) l.push(i); else map.set(key, [i]);
      }
      for (const l of map.values()) {
        if (l.length < 2) continue;
        let x = 0, y = 0, z = 0; for (const i of l) { x += N[i * 3]; y += N[i * 3 + 1]; z += N[i * 3 + 2]; }
        for (const i of l) { N[i * 3] = x; N[i * 3 + 1] = y; N[i * 3 + 2] = z; }
      }
    }
    for (let i = v0; i < this.count; i++) {
      const x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2], l = hyp3(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
  }
  /* ajoute une géométrie three.js (normales conservées) transformée par m ; poids et couleur fixes, ou fonctions de la position */
  geo(g, m, w, col, uv) {
    this.begin();
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, v0 = this.count, nm = new THREE.Matrix3().getNormalMatrix(m), t = new V3();
    for (let k = 0; k < P.count; k++) {
      t.fromBufferAttribute(P, k).applyMatrix4(m);
      const uu = uv ? uv(U ? U.getX(k) : 0, U ? U.getY(k) : 0) : null;
      this.vert(t.x, t.y, t.z, uu ? uu[0] : 0, uu ? uu[1] : 0, typeof col === 'function' ? col(t) : col, typeof w === 'function' ? w(t) : w);
      if (N) { t.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); const o = (v0 + k) * 3; this.n[o] = t.x; this.n[o + 1] = t.y; this.n[o + 2] = t.z; }
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.idx.push(g.index.getX(k) + v0);
    else for (let k = 0; k < P.count; k++) this.idx.push(v0 + k);
    if (!N) this.end(false);
  }
  build() {
    const g = new THREE.BufferGeometry(), n = this.count;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(new (n > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(this.idx, 1));
    return g;
  }
}
/* Surface paramétrique en grille : f(u, v, out) remplit out = { x, y, z, w, col, U, V } pour u et v de 0 à 1.
   wrapU : la grille fait le tour (couture confondue). La face avant est choisie pour que la normale s'éloigne du centre
   de la pièce (o.out = true ou false pour l'imposer). */
const _sf = { x: 0, y: 0, z: 0, w: 0, col: null, U: 0, V: 0 };
function skinSurf(B, nu, nv, f, o = {}) {
  B.begin();
  const v0 = B.count;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    _sf.col = null; _sf.U = i / nu; _sf.V = j / nv;
    f(i / nu, j / nv, _sf);
    B.vert(_sf.x, _sf.y, _sf.z, _sf.U, _sf.V, _sf.col, _sf.w);
  }
  const at = (i, j) => v0 + j * (nu + 1) + i, P = B.p;
  let flip = o.out === false;
  if (o.out === undefined) {
    // sens des faces : la normale doit s'éloigner du centre de la pièce
    let cx = 0, cy = 0, cz = 0; const n = (nu + 1) * (nv + 1);
    for (let k = v0; k < v0 + n; k++) { cx += P[k * 3]; cy += P[k * 3 + 1]; cz += P[k * 3 + 2]; }
    cx /= n; cy /= n; cz /= n; let s = 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = at(i, j) * 3, b = at(i + 1, j) * 3, c = at(i, j + 1) * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      s += (uy * vz - uz * vy) * (P[a] - cx) + (uz * vx - ux * vz) * (P[a + 1] - cy) + (ux * vy - uy * vx) * (P[a + 2] - cz);
    }
    flip = s < 0;
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    if (flip) { B.tri(a, c, b); B.tri(b, c, d); } else { B.tri(a, b, c); B.tri(b, d, c); }
  }
  B.end(o.weld !== false);
  return v0;
}
/* Tube lofté le long de sections { c : centre, X, Y : axes du profil, r : rayon ou [x+, x-, y+, y-], n : exposant de
   superellipse (2 = ellipse, plus = plus carré), w : poids (tableau ou fonction (p, a)), col, v : abscisse de texture }.
   o.wp(p, a, s) : poids selon la position (remplace ceux des sections) ;
   o.bump(a, k) : rayon ajouté (m) à l'angle a sur la section k ; o.cap0 / o.cap1 : longueur d'un bout arrondi ;
   o.uv(u, v) : coordonnées de texture ; o.col(a, k, p) : couleur par sommet ; o.a0 : angle de la couture. */
const _lp = new V3(), _la = new V3(), _lq = new V3();
function skinLoft(B, S, seg, o = {}) {
  const rings = S.slice();
  // bouts arrondis : sections supplémentaires qui se referment en quart d'ellipse
  const capRings = (end, len) => {
    const s = end ? S[S.length - 1] : S[0], p = end ? S[S.length - 2] : S[1];
    const ax = _la.subVectors(s.c, p.c).normalize().clone(), out = [];
    for (let i = 1; i <= 4; i++) {
      const t = (i / 4) * Math.PI / 2, k = i === 4 ? 0.001 : Math.cos(t);
      const r = Array.isArray(s.r) ? s.r.map((x) => x * k) : s.r * k;
      out.push(Object.assign({}, s, { c: s.c.clone().addScaledVector(ax, Math.sin(t) * len), r, v: (s.v || 0) + (end ? 1 : -1) * Math.sin(t) * len, cap: true }));
    }
    return end ? out : out.reverse();
  };
  const R = (o.cap0 ? capRings(false, o.cap0) : []).concat(rings, o.cap1 ? capRings(true, o.cap1) : []);
  const a0 = o.a0 || 0, nk = R.length;
  _la.subVectors(S[S.length - 1].c, S[0].c);
  const flip = _lq.crossVectors(S[0].X, S[0].Y).dot(_la) < 0;
  return skinSurf(B, seg, nk - 1, (u, v, out) => {
    const k = Math.round(v * (nk - 1)), s = R[k], a = a0 + u * TAU, cs = Math.cos(a), sn = Math.sin(a), e = 2 / (s.n || 2);
    const r = s.r, xp = Array.isArray(r) ? r[0] : r, xn = Array.isArray(r) ? r[1] : r, yp = Array.isArray(r) ? r[2] : r, yn = Array.isArray(r) ? r[3] : r;
    let px = Math.sign(cs) * Math.pow(Math.abs(cs), e) * (cs >= 0 ? xp : xn), py = Math.sign(sn) * Math.pow(Math.abs(sn), e) * (sn >= 0 ? yp : yn);
    const b = o.bump && !s.cap ? o.bump(a, k - (o.cap0 ? 4 : 0), s) : 0;
    if (b) { const l = hyp(px, py) || 1; px += px / l * b; py += py / l * b; }
    _lp.copy(s.c).addScaledVector(s.X, px).addScaledVector(s.Y, py);
    out.x = _lp.x; out.y = _lp.y; out.z = _lp.z;
    out.w = o.wp ? o.wp(_lp, a, s) : typeof s.w === 'function' ? s.w(_lp, a) : s.w;
    out.col = o.col ? o.col(a, k, _lp, s) : s.col || null;
    const uv = o.uv ? o.uv(u, s.v || 0, s, px, py) : null; out.U = uv ? uv[0] : u; out.V = uv ? uv[1] : s.v || 0;
  }, { out: !flip, weld: true });
}
/* Maillage lissé : sommets exprimés dans l'espace de repos, rest[i] = matrice de repos de l'os i dans ce même espace */
function skinnedMesh(geo, mat, bones, rest) {
  const sk = new THREE.Skeleton(bones, rest.map((m) => m.clone().invert()));
  const m = new THREE.SkinnedMesh(geo, mat);
  m.bind(sk, _RIG_ID); m.customDepthMaterial = SKIN_DEPTH_MAT;
  return m;
}
/* Matrice d'un os relativement à la racine du modèle (pose courante) */
function restMatrix(bone, root) {
  const m = new THREE.Matrix4(); let o = bone;
  while (o && o !== root) { o.updateMatrix(); m.premultiply(o.matrix); o = o.parent; }
  return m;
}
/* Occlusion ambiante cuite dans les couleurs de sommets : chaque sphère { x, y, z, r } assombrit les surfaces qui la
   regardent (facteur de forme d'une sphère), ce qui creuse les plis entre les pièces (sous le gilet, les poches, le casque). */
function skinBakeAO(B, spheres, k = 1, from = 0, to = B.count) {
  const P = B.p, N = B.n, C = B.c;
  for (let i = from; i < to; i++) {
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let occ = 0;
    for (const s of spheres) {
      const dx = s.x - px, dy = s.y - py, dz = s.z - pz, d2 = dx * dx + dy * dy + dz * dz, r2 = s.r * s.r;
      if (d2 < r2 * 1.03) continue;
      const d = Math.sqrt(d2), c = (dx * nx + dy * ny + dz * nz) / d;
      if (c > 0) occ += c * r2 / d2;
    }
    const f = 1 - k * Math.min(1, occ) * 0.85;
    C[i * 3] *= f; C[i * 3 + 1] *= f; C[i * 3 + 2] *= f;
  }
}
/* Poids d'une chaîne d'os le long d'une abscisse s (membre droit au repos) : autour de chaque articulation j (s, h, a, m, b),
   l'os a cède la place à l'os b sur ±h, l'os d'aide m (orienté à mi-chemin) prenant jusqu'à la moitié du poids. */
function chainW(s, J, first) {
  for (const j of J) {
    if (s <= j.s - j.h) return [[j.a, 1]];
    if (s < j.s + j.h) {
      const t = (s - (j.s - j.h)) / (2 * j.h), wa = (1 - t) * (1 - t), wb = t * t, wm = 2 * t * (1 - t);
      return j.m === undefined || j.m === null ? [[j.a, wa + wm * 0.5], [j.b, wb + wm * 0.5]] : [[j.a, wa], [j.m, wm], [j.b, wb]];
    }
  }
  return [[J.length ? J[J.length - 1].b : first, 1]];
}
/* Balayage le long d'une chaîne d'os au repos : chain = [{ M : matrice de repos (espace racine), L : longueur }], l'axe du
   membre étant ax et le profil portant sur les axes px, py (repère local des os). Aux articulations, la ligne médiane suit
   un congé (courbe de Bézier de demi-longueur H[k]) et le profil pivote progressivement : la géométrie de repos d'un doigt
   plié ne se pince pas. S : sections { d : abscisse depuis l'origine du premier os, r, n, col } ; o.w(d) : poids. */
function skinSweep(B, chain, H, ax, px, py, S, seg, o = {}) {
  const F = chain.map((c) => { const q = new THREE.Quaternion(), p = new V3(), s = new V3(); c.M.decompose(p, q, s); return { q, p, a: ax.clone().applyQuaternion(q) }; });
  const sj = []; let acc = 0; for (const c of chain) { acc += c.L; sj.push(acc); }
  const q = new THREE.Quaternion(), secs = [];
  for (const s of S) {
    const d = s.d; let k = 0;
    while (k < chain.length - 1 && d > sj[k] + H[k]) k++;
    const c = new V3();
    if (k < chain.length - 1 && d >= sj[k] - H[k]) {
      const h = H[k], t = (d - (sj[k] - h)) / (2 * h), J = F[k + 1].p;
      const p0 = J.clone().addScaledVector(F[k].a, -h), p2 = J.clone().addScaledVector(F[k + 1].a, h);
      c.copy(p0).multiplyScalar((1 - t) * (1 - t)).addScaledVector(J, 2 * t * (1 - t)).addScaledVector(p2, t * t);
      q.slerpQuaternions(F[k].q, F[k + 1].q, t);
    } else { c.copy(F[k].p).addScaledVector(F[k].a, d - (k ? sj[k - 1] : 0)); q.copy(F[k].q); }
    secs.push(Object.assign({}, s, { c, X: px.clone().applyQuaternion(q), Y: py.clone().applyQuaternion(q), w: o.w ? o.w(d) : s.w, v: d }));
  }
  return skinLoft(B, secs, seg, o);
}
