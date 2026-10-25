/* ==========================================================================
   ARMES : matériaux, armes vues de l'extérieur et vue subjective
   ========================================================================== */
/* Les armes (WEAPONS), leur ressenti (FEEL) et les classes (CLASSES) sont dans 06i-armes.js */

/* ---------- Matériaux des armes ---------- */
/* Surfaces des armes, construites au démarrage (socle commun, indépendant des cartes) : l'usure (gunSurfTexture), relief du gravier et toile
   procéduraux. La bibliothèque de matières des cartes reprend ces deux surfaces (buildTextures) sans les libérer. */
const GUN_GRAIN = (window.SOCLE || {}).grain || ''; // socle (build.py) : assets/arme/surface.webp
const GUNTEX = { rough: null, surf: {} };
function buildGunTextures() {
  const small = RQ.q.lean ? 0.5 : 1;
  for (const k of ['gravel', 'canvas']) GUNTEX.surf[k] = texLabSurface(k, TEXLAB[k], small);
  GUNTEX.rough = gunSurfTexture();
}
/* Usure des armes (assets/arme/surface.webp, textures CC0 d'ambientCG et de Poly Haven préparées par tools/build_armes.py) : une image en
   niveaux de gris à quatre cases (le WebP avec perte mêlerait des données rangées dans les canaux d'une image en couleur), remises ici
   dans les canaux d'une texture raccordable de 512 px, 11 cm d'arme : rouge, voile et traces de doigts ; vert, rayures fines ; bleu,
   marbrure d'un polymère ; alpha, fil du bois (dans le sens de la largeur de la texture). Texture de données (pas de toile : une toile
   prémultiplie l'alpha). Neutre (rien) tant que l'image n'est pas décodée, ou sans socle. */
function gunSurfTexture() {
  const N = 512, d = new Uint8Array(N * N * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 2] = 128; d[i + 3] = 128; }
  const t = new THREE.DataTexture(d, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  if (!GUN_GRAIN) return t;
  const im = new Image(); im.src = GUN_GRAIN;
  im.decode().then(() => {
    const s = document.createElement('canvas'); s.width = s.height = N;
    const sg = s.getContext('2d', { willReadFrequently: true }); sg.imageSmoothingQuality = 'high';
    // une case de l'image (x, y, largeur, hauteur), agrandie ou répétée n fois dans chaque sens sur toute la texture
    const cell = (x, y, w, h, n) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sg.drawImage(im, x, y, w, h, i * N / n, j * N / n, N / n, N / n); return sg.getImageData(0, 0, N, N).data; };
    const G = cell(0, 0, 512, 512, 1), R = cell(512, 0, 256, 256, 1), B = cell(512, 256, 256, 256, 2), A = cell(768, 0, 256, 512, 1);
    for (let i = 0; i < d.length; i += 4) { d[i] = R[i]; d[i + 1] = G[i]; d[i + 2] = B[i]; d[i + 3] = A[i]; }
    t.needsUpdate = true;
  }).catch(() => {});
  return t;
}
/* Matière des armes (retour du propriétaire, octobre 2026 : le grain de l'arme en main faisait papier de verre). L'ancien grain, un relief
   de gravier et une rugosité d'enduit plaqués par les coordonnées de texture de chaque pièce, changeait d'échelle d'une pièce à l'autre.
   La surface est maintenant lue en triplanaire dans le repère de l'arme, à l'échelle réelle (position du sommet multipliée par l'échelle
   du maillage : l'arme en main, ramenée par bakeRig dans le repère de l'arme, comme les pièces séparées des vitrines), sans relief : un
   voile et des traces de doigts qui font varier la rugosité, une marbrure fine, des rayures, et des arêtes usées. Une arête se repère à
   la courbure à l'écran (variation de la normale rapportée à celle de la position, en 1/m : forte sur les arrondis des pièces) ; elle
   et les rayures montrent le dessous du fini (uGunBare : couleur et rugosité, uGunBareM : métal) : l'aluminium nu d'un boîtier anodisé,
   un polymère éclairci par le frottement, le métal sombre sous un camouflage. uGunW : part des arêtes, des rayures, du voile et de la
   marbrure ; uGunWood : le fil du bois (crosses, garde-mains), orienté le long du canon sur les flancs comme sur le dessus. Un seul
   programme pour toutes les matières de l'arme (même retouche, valeurs propres à chaque matière). */
const GUN_SURF_U = { uGunSurf: { value: null }, uGunK: { value: 1 / 0.11 }, uGunE: { value: new THREE.Vector2(160, 480) } };
const GUN_WEAR = {
  // [arêtes, rayures, voile, marbrure], couleur du dessous (null : la teinte de la matière éclaircie de k), rugosité et métal du dessous
  metal: { w: [0.5, 0.35, 0.22, 0.15], bare: [0.3, 0.31, 0.33], r: 0.3, m: 1 }, // aluminium anodisé : l'arête montre l'aluminium nu
  steel: { w: [0.4, 0.3, 0.22, 0.12], bare: [0.26, 0.27, 0.29], r: 0.34, m: 1 }, // acier phosphaté ou bruni
  smooth: { w: [0.18, 0.06, 0.12, 0.05], bare: null, k: 1.5, r: -0.08, m: 1 }, // acier lisse, laiton, lame : à peine marqués
  poly: { w: [0.35, 0.12, 0.18, 0.3], bare: null, k: 1.7, r: -0.15, m: 0 }, // polymère : l'arête frottée s'éclaircit et se polit
  paint: { w: [0.3, 0.1, 0.18, 0.3], bare: null, k: 1.35, r: -0.12, m: 0 }, // garnitures teintes (olive, sable)
  wood: { w: [0.25, 0, 0.18, 0.2], bare: null, k: 1.5, r: -0.18, m: 0 }, // bois verni : arêtes patinées par les mains
  camo: { w: [0.6, 0.3, 0.15, 0.15], bare: [0.08, 0.085, 0.09], r: 0.4, m: 0.6 }, // peinture du camouflage : dessous sombre
};
/* Pose sur la matière m l'usure de la famille kind (GUN_WEAR) : uniformes propres à la matière, retouche commune */
function gunWear(m, kind) {
  const W = GUN_WEAR[kind], c = W.bare ? new THREE.Color(...W.bare) : m.color.clone().multiplyScalar(W.k);
  m.userData.gunU = { uGunW: { value: new THREE.Vector4(...W.w) }, uGunBare: { value: new THREE.Vector4(c.r, c.g, c.b, W.bare ? W.r : clamp(m.roughness + W.r, 0.1, 1)) }, uGunBareM: { value: W.bare ? W.m : m.metalness }, uGunWood: { value: kind === 'wood' ? 1 : 0 } };
  if (!m.onBeforeCompile.gunSurf) m.onBeforeCompile = gunSurfCompile;
  return m;
}
function gunSurfCompile(shader) { envCubeHook(shader); gunSurfPatch(shader, this.userData.gunU); }
gunSurfCompile.gunSurf = true;
function gunSurfPatch(shader, U) {
  GUN_SURF_U.uGunSurf.value = GUNTEX.rough || (GUNTEX.rough = gunSurfTexture());
  Object.assign(shader.uniforms, GUN_SURF_U, U);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGunP; varying vec3 vGunN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGunP = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); vGunN = normal;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uGunSurf; uniform float uGunK; uniform vec2 uGunE; uniform vec4 uGunW; uniform vec4 uGunBare; uniform float uGunBareM; uniform float uGunWood;
varying vec3 vGunP; varying vec3 vGunN;`).replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness, gunWear = 0.0;
{
  vec3 gw = pow(abs(normalize(vGunN)), vec3(4.0)); gw /= gw.x + gw.y + gw.z;
  vec3 gp = vGunP * uGunK;
  vec4 gs = texture2D(uGunSurf, gp.zy) * gw.x + texture2D(uGunSurf, gp.zx) * gw.y + texture2D(uGunSurf, gp.xy) * gw.z; // largeur de la texture le long du canon
  diffuseColor.rgb *= mix(1.0, 0.55 + gs.a * 0.9, uGunWood); // fil du bois : veines sombres et claires
  float gc = length(fwidth(normalize(vNormal))) / max(length(fwidth(vViewPosition)), 1e-6); // courbure à l'écran, en 1/m
  float ge = smoothstep(uGunE.x, uGunE.y, gc) * clamp(0.35 + (gs.b - 0.5) * 1.6 + (gs.r - 0.5) * 0.8, 0.0, 1.0) * uGunW.x; // arête, usée par endroits
  float gr = smoothstep(0.4, 0.85, gs.g) * uGunW.y; // rayure : dans le reflet surtout, à peine dans la couleur
  gunWear = max(ge, gr * 0.5);
  roughnessFactor = roughnessFactor * (1.0 + (gs.b - 0.5) * uGunW.w) + (gs.r - 0.5) * uGunW.z + (0.5 - gs.a) * 0.18 * uGunWood; // pores du bois : plus mats
  roughnessFactor = clamp(mix(roughnessFactor, uGunBare.a, max(ge, gr)), 0.06, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uGunBare.rgb, max(ge, gr * 0.25));
}`).replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(metalness, uGunBareM, gunWear);');
}
let GM = null;
function gunMaterials() {
  if (GM) return GM;
  const S = GUNTEX.surf, T = S.canvas ? { canvas: S.canvas } : null;
  const mk = (color, r, m, o = {}, kind) => { const t = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: r, metalness: m, envMapIntensity: 1.0 }, o)); return kind ? gunWear(t, kind) : t; };
  GM = {
    metal: mk(0x34373b, 0.38, 0.78, {}, 'metal'),
    dark: mk(0x202124, 0.5, 0.55, {}, 'steel'),
    poly: mk(0x27282a, 0.6, 0.06, {}, 'poly'),
    olive: mk(0x4d5236, 0.7, 0.05, {}, 'paint'),
    tan: mk(0x9a8664, 0.7, 0.05, {}, 'paint'),
    wood: mk(0x3a2a20, 0.58, 0.02, {}, 'wood'),
    woodR: mk(0x3a1c17, 0.46, 0.02, {}, 'wood'), // bois rouge verni de l'AK-47
    woodB: mk(0x393223, 0.56, 0.02, {}, 'wood'), // bois blond verni de la Dragounov
    fde: mk(0x4d4a3a, 0.68, 0.05, {}, 'paint'),
    taupe: mk(0x2e3138, 0.66, 0.05, {}, 'poly'), // polymère gris-brun du L96A1
    gray: mk(0x343c48, 0.55, 0.35, {}, 'steel'), // tôle phosphatée grise du Barrett M82
    blued: mk(0x2c2f34, 0.36, 0.7, {}, 'smooth'), // acier bruni lisse du M9 (vu de près en visée : à peine marqué)
    polyM: mk(0x19191b, 0.62, 0.05, {}, 'poly'), // polymère noir mat des carcasses de pistolet
    drab: mk(0x2e3426, 0.7, 0.05, {}, 'paint'),
    brass: mk(0xb58f3e, 0.3, 1.0, {}, 'smooth'),
    steel: mk(0xaab0b6, 0.3, 0.86, {}, 'smooth'), // inox brossé (Desert Eagle) ; le camouflage le recouvre
    grip: mk(0x131313, 0.8, 0.02, {}, 'poly'), // caoutchouc d'une poignée ; le camouflage le laisse noir
    sight: mk(0x1c1e21, 0.55, 0.4), // anneau et guidon des organes de visée : sombres, mats, sans usure (programme le plus simple) ; le camouflage les laisse noirs
    glove: mk(0x2e2a25, 0.8, 0.05),
    sleeve: new THREE.MeshStandardMaterial({ color: 0xb3a07a, roughness: 0.95, map: T ? T.canvas.map : null, normalMap: T ? T.canvas.normal : null }),
    skin: mk(0xc49a78, 0.6, 0.0),
    lens: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.35, envMapIntensity: 1.5 }),
    lensR: new THREE.MeshStandardMaterial({ color: 0xc4521e, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.55, envMapIntensity: 1.6 }), // traitement orangé de la lentille d'un point rouge, vu de l'avant seulement
    glass: mk(0x3a5878, 0.04, 1.0, { envMapIntensity: 2.2 }), // lentille de lunette, opaque : verre traité qui reflète le décor
    glint: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.2, 1.15, 1.3), transparent: true, opacity: 0.4, depthWrite: false }), // reflet peint sur une lentille
    dot: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.6, 0.12, 0.08) }),
    ink: new THREE.MeshBasicMaterial({ color: 0x050505 }), // traits noirs gravés d'un réticule (ACOG)
    // oculaire de l'ACOG : masque qui n'écrit que la profondeur (on voit le monde à travers), teinte cyan ajoutée, bord assombri
    ocMask: new THREE.MeshBasicMaterial({ colorWrite: false }),
    ocTint: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.05, 0.11, 0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    ocShade: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.055, depthWrite: false }), // douze anneaux superposés : de 0 à 50 % vers le bord
    blade: mk(0x9da2a6, 0.25, 1.0, {}, 'smooth'),
    knifeSteel: mk(0xd2d7da, 0.22, 0.6, { envMapIntensity: 1.3 }),
    tube: mk(0x18191a, 0.55, 0.6, { side: THREE.DoubleSide }, 'steel'),
    dotW: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.2, 2.2, 1.8) }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
  };
  return GM;
}
const RING_REAR = new THREE.TorusGeometry(0.0092, 0.0024, 8, 24); // anneau de dragonne des pistolets
const G_BOX = new THREE.BoxGeometry(1, 1, 1), G_CYL = new THREE.CylinderGeometry(1, 1, 1, 14), G_CYL_O = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
function part(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
const bx = (p, mat, x, y, z, w, h, d, rx, ry, rz) => part(p, G_BOX, mat, x, y, z, w, h, d, rx, ry, rz);
/* cylindre orienté selon Z (le long du canon) */
const cz = (p, mat, x, y, z, r, len, geo = G_CYL) => part(p, geo, mat, x, y, z, r, len, r, Math.PI / 2, 0, 0);

/* Armes vues de l'extérieur (tenues par les soldats, posées au sol) : la géométrie est construite une seule fois par
   arme montée (clé du modèle, des accessoires et du camouflage) et partagée par toutes les armes identiques (plus de reconstruction à chaque changement d'arme ni à
   chaque arme lâchée). Teintes (garnitures olive, bois, sable, métal et polymère sombres) ou camouflage : de deux à quatre appels de rendu par
   arme, et deux niveaux de détail choisis avec celui du soldat (setSoldierLod) ou la distance (armes au sol) :
   - « hi » : toutes les pièces du modèle de la vue subjective, avec leurs indices (le GPU réutilise les sommets) ;
   - « lo » : sans les petites pièces (dents de rail, vis, goupilles : invisibles au-delà de quelques mètres), avec
     des cylindres, sphères et arrondis simplifiés. Il sert de loin et projette toujours l'ombre. */
const WORLD_GUN_GEO = {};
const _lowGeo = new WeakMap();
/* Version allégée d'une géométrie de pièce (même encombrement) */
function lowPolyGeometry(g) {
  if (_lowGeo.has(g)) return _lowGeo.get(g);
  const P = g.parameters || {}; let r = g;
  if (g.userData.box) r = new THREE.BoxGeometry(...g.userData.box); // boîte arrondie (rgeo) : boîte simple
  else if (g.userData.low) r = profLow(g); // profil extrudé (06jb-formes.js) : sans arêtes adoucies
  else if (g.userData.sec) r = secLow(g); // section le long du canon (06jb-formes.js) : de même
  else if (g.userData.ring) r = ringGeo(...g.userData.ring); // anneau d'axe z (06jb-formes.js) : 12 segments, sans arrondis
  else if (g.type === 'CylinderGeometry' && P.radialSegments > 8) r = new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, P.height, 8, 1, P.openEnded, P.thetaStart, P.thetaLength);
  else if (g.type === 'SphereGeometry' && P.widthSegments > 8) r = new THREE.SphereGeometry(P.radius, 8, 6, P.phiStart, P.phiLength, P.thetaStart, P.thetaLength);
  else if (g.type === 'TorusGeometry' && P.tubularSegments > 10) r = new THREE.TorusGeometry(P.radius, P.tube, 4, 10, P.arc);
  else if (g.type === 'CapsuleGeometry' && P.radialSegments > 6) r = new THREE.CapsuleGeometry(P.radius, P.length, 2, 6);
  _lowGeo.set(g, r); return r;
}
/* Réunit des pièces { geo, m } en une géométrie indexée (positions et normales dans le repère de l'arme) */
function mergeGunParts(parts) {
  if (!parts.length) return null;
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new V3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position, N = p.geo.attributes.normal, n = P.count;
    nm.getNormalMatrix(p.m);
    for (let k = 0; k < n; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(p.m); v.toArray(pos, (vo + k) * 3);
      v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); v.toArray(nor, (vo + k) * 3);
    }
    if (p.geo.index) { const I = p.geo.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; io += I.length; }
    else { for (let k = 0; k < n; k++) idx[io + k] = vo + k; io += n; }
    vo += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
/* Une pièce est « petite » si deux de ses dimensions sont millimétriques et la troisième courte (dent de rail, vis) */
function gunPartSmall(o) {
  const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const sz = g.boundingBox.getSize(_v1), sc = _v2.setFromMatrixScale(o.matrixWorld);
  const d = [sz.x * sc.x, sz.y * sc.y, sz.z * sc.z].sort((a, b) => a - b);
  return d[1] < 0.0085 && d[2] < 0.035;
}
function worldGunGeometry(key) {
  if (WORLD_GUN_GEO[key]) return WORLD_GUN_GEO[key];
  const info = buildGunModel(key);
  info.group.updateMatrixWorld(true);
  const L = { hi: {}, lo: {} };
  for (const lv of ['hi', 'lo']) for (const k of WORLD_GUN_KEYS) L[lv][k] = [];
  const visit = (o) => {
    if (!o.visible) return; // pièce cachée du modèle (chargeur interne du fusil à pompe)
    if (o.isMesh && !o.material.transparent && !o.material.isMeshBasicMaterial && o.geometry.attributes.normal) {
      /* camouflage : une matière à part ; sinon teinte chaude (olive, sable ; couleurs en espace linéaire) : garnitures
         claires ; métal et polymère gris : sombre */
      const c = o.material.color, k = o.material.userData.camo ? 'camo' : o.material === GM.wood ? 'wood' : o.material === GM.woodR ? 'woodR' : o.material === GM.woodB ? 'woodB' : o.material === GM.taupe ? 'taupe' : o.material === GM.gray ? 'gray' : o.material === GM.tan || o.material === GM.fde ? 'tan' : o.material === GM.drab ? 'light' : o.material === GM.steel ? 'steel' : c.r - c.b > 0.025 ? 'light' : 'dark';
      L.hi[k].push({ geo: o.geometry, m: o.matrixWorld });
      if (!gunPartSmall(o)) L.lo[k].push({ geo: lowPolyGeometry(o.geometry), m: o.matrixWorld });
    }
    for (const c of o.children) visit(c);
  };
  visit(info.group);
  const G = { muzzle: info.muzzle.position.clone(), kind: info.kind, grips: gunGrips(info), hi: {}, lo: {} };
  for (const lv of ['hi', 'lo']) for (const k of WORLD_GUN_KEYS) G[lv][k] = mergeGunParts(L[lv][k]);
  return (WORLD_GUN_GEO[key] = G);
}
/* Arme prête à poser dans la scène : un maillage par matière et par niveau de détail, dont les calques sont réglés par setGunLod */
function buildWorldGun(key) {
  const G = worldGunGeometry(key), out = new THREE.Group(), camo = gunSpec(key).camo;
  for (const lv of ['hi', 'lo']) for (const k of WORLD_GUN_KEYS) {
    if (!G[lv][k]) continue;
    const mesh = new THREE.Mesh(G[lv][k], k === 'camo' ? camoWorldMaterial(camo) : WORLD_GUN_MATS[k]);
    mesh.castShadow = lv === 'lo'; mesh.userData.noPrepass = true; mesh.userData.gunLod = lv;
    out.add(mesh);
  }
  setGunLod(out, false);
  return { group: out, muzzle: G.muzzle.clone(), kind: G.kind };
}
/* Niveau de détail d'une arme : le modèle allégé projette toujours l'ombre ; quand le détaillé est affiché, l'allégé
   ne sert plus qu'à ça (calque d'ombre seule). shadowOnly : arme du corps du joueur, qui ne s'affiche jamais. */
function setGunLod(group, hi, shadowOnly) {
  for (const m of group.children) {
    if (!m.userData.gunLod) continue;
    if (m.userData.gunLod === 'hi') { m.visible = hi && !shadowOnly; m.layers.mask = MASK_SCREEN; }
    else m.layers.mask = hi || shadowOnly ? MASK_SHADOW : MASK_SCREEN;
  }
}
const WORLD_GUN_MATS = {
  dark: new THREE.MeshStandardMaterial({ color: 0x1f2022, roughness: 0.5, metalness: 0.6 }), light: new THREE.MeshStandardMaterial({ color: 0x4d5236, roughness: 0.7 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.58 }), woodR: new THREE.MeshStandardMaterial({ color: 0x3a1c17, roughness: 0.46 }),
  woodB: new THREE.MeshStandardMaterial({ color: 0x393223, roughness: 0.56 }), taupe: new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.66 }),
  gray: new THREE.MeshStandardMaterial({ color: 0x343c48, roughness: 0.55, metalness: 0.35 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x4d4a3a, roughness: 0.68 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9ea4aa, roughness: 0.35, metalness: 0.75 }),
};
const WORLD_GUN_KEYS = ['light', 'dark', 'wood', 'woodR', 'woodB', 'taupe', 'gray', 'tan', 'steel', 'camo']; // une matière de l'arme extérieure par famille de teintes (camo : peinture)

/* ---------- Vue subjective ---------- */
/* Champ de la vue de l'arme, de la hanche (base) à la visée (44°). Une optique qui grossit (ACOG : info.vmFov) resserre la vue de l'arme
   jusqu'à ce que son oculaire remplisse l'écran ; le grossissement suit alors la tangente du demi-champ, régulier pendant la mise en joue */
function vmFovAt(base, ads) {
  const f = VM.cur && VM.cur.vmFov;
  if (!f) return lerp(base, 44, ads);
  return Math.atan(lerp(Math.tan(base * Math.PI / 360), Math.tan(f * Math.PI / 360), ads)) * 360 / Math.PI;
}
const VM = {
  root: new THREE.Group(), holder: new THREE.Group(), models: {}, cur: null, curDef: null,
  arms: null, flash: null, shells: [], shellIdx: 0,
  ads: 0, sprint: 0, bobT: 0, bobAmt: 0, swayX: 0, swayY: 0, swayTX: 0, swayTY: 0,
  rec: { z: 0, vz: 0, rx: 0, vrx: 0, ry: 0, vry: 0, rz: 0, vrz: 0, y: 0, vy: 0 },
  fovHip: 58, lastGo: [0, 0, 0, 0, 0, 0], popO: [0, 0, 0, 0, 0, 0], popV: [0, 0, 0, 0, 0, 0], gV: [0, 0, 0, 0, 0, 0], camK: [0, 0, 0, 0], chocO: [0, 0, 0, 0, 0, 0], chocV: [0, 0, 0, 0, 0, 0], lastAct: '', actK: 1, actFade: false, sprV: 0, sprK: 0, tilt: 0, push: 0, wall: 0, trig: 0, trigT: 0, land: 0, vland: 0, lower: 0, lowerTarget: 0, lowV: 0, lowerUp: true, lowArr: true, lhOk: false, sling: 0, action: null, actionT: 0, actionDur: 1, actionData: null,
  flashT: 0, flashT0: 0.05, flashM: null, crouch: 0, knifeRig: null, nadeRig: null, sunVis: 1, breath: 0, jump: 0, bobO: new THREE.Vector3(), bobR: new THREE.Vector3(),
};
/* Position de l'arme à la hanche, par modèle : décalage x, y, z puis tangage, lacet (le canon converge vers le centre de
   l'écran, ce qui montre le flanc gauche de l'arme et la main droite sur la poignée) et roulis.
   Retour du propriétaire, « l'arme est un poil haute sur l'écran » : toutes descendues de 1,2 cm (1 cm au pistolet). Les fusils de
   précision, plus longs, sont tenus 2 cm plus près : la main d'appui, loin sur l'avant, gardait le bras presque tendu. */
const VM_HIP = {
  rifle: [0.13, -0.15, -0.28, 0.07, 0.12, -0.04], smg: [0.13, -0.14, -0.28, 0.06, 0.12, -0.04], sniper: [0.14, -0.16, -0.26, 0.015, 0.08, -0.02],
  shotgun: [0.13, -0.144, -0.27, 0.02, 0.09, -0.03], pistol: [0.1, -0.088, -0.38, 0.03, 0.06, -0.02],
};
/* Position (plus loin et plus haut) que reprend l'arme pendant un rechargement ou une inspection : les chorégraphies de
   06d-reload.js sont réglées pour elle, et l'arme rapprochée de la hanche emplirait l'écran en basculant. Elle revient à la
   hanche pendant les VM_FAR_OUT dernières secondes de l'action qui termine la série (VM_FAR_END), avec la remise en place */
const VM_HIP_ACT = {
  rifle: [0.12, -0.117, -0.36, 0.07, 0.12, -0.04], smg: [0.12, -0.112, -0.35, 0.06, 0.12, -0.04], sniper: [0.13, -0.124, -0.32, 0.015, 0.08, -0.02],
  shotgun: [0.12, -0.12, -0.33, 0.02, 0.09, -0.03],
};
const VM_FAR_ACTIONS = new Set(['reload', 'inspect', 'shellStart', 'shell', 'shellEnd']), VM_FAR_END = new Set(['reload', 'inspect', 'shellEnd']), VM_FAR_OUT = 0.5, _hipK = [0, 0, 0, 0, 0, 0];
/* Pose de sprint (décalage x, y, z puis tangage, lacet, roulis) */
const VM_SPRINT = [0.01, -0.04, -0.04, -0.5, 0.65, 0.7];
/* sprint au pistolet : pas de pose fixe, c'est le bras qui la donne (pistolRunPose, dans 06c-models.js) */
const VM_SPRINT_NONE = [0, 0, 0, 0, 0, 0];
/* Trajet de l'arme quand on la passe dans le dos (0 = en main, 1 = dans le dos, hors champ) :
   [avancement, x, y, z] pour la position et [avancement, tangage, lacet, roulis] pour la rotation */
const VM_SLING = {
  pos: [[0, 0, 0, 0], [0.3, 0.04, 0.03, 0.0], [0.65, 0.17, 0.14, 0.1], [1, 0.33, 0.27, 0.32]],
  rot: [[0, 0, 0, 0], [0.3, 0.22, -0.18, 0.4], [0.65, 0.75, -0.55, 0.85], [1, 1.3, -0.95, 1.15]],
};
function spring(o, key, vkey, k, c, dt) { o[vkey] += (-k * o[key] - c * o[vkey]) * dt; o[key] += o[vkey] * dt; }


function initViewmodel() {
  const M = gunMaterials();
  vmScene.add(VM.root); VM.root.add(VM.holder);
  VM.arms = { R: makeArm(M, null, -1), L: makeArm(M, null, 1) };
  VM.arms.R.hand.userData.trigSrc = () => VM.trig; // l'index de la main droite suit la détente
  // montre au poignet gauche
  VM.watch = buildWatch(M); VM.holder.add(VM.watch); VM.arms.L.watch = VM.watch; // masquée avec le bras gauche
  // flash de bouche : une rosace face au tireur et deux langues de flamme croisées le long du canon, tirées chacune d'une planche de
  // quatre variantes à chaque coup (flashTex, 01-core.js) ; additif, sans écriture de profondeur, une seule unité de texture
  const fmF = new THREE.MeshBasicMaterial({ map: FXT.flashF, color: new THREE.Color().setRGB(2.3, 2.05, 1.7), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const fmS = fmF.clone(); fmS.map = FXT.flashS;
  FXT.flashF.repeat.set(0.5, 0.5); FXT.flashS.repeat.set(0.5, 0.5);
  VM.flash = new THREE.Group(); VM.flashM = [fmF, fmS];
  VM.flash.add(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), fmF));
  // planche de profil : la bouche à 3,5 cm de son bord (la marge du cœur), la flamme vers l'avant (-z)
  const gs = new THREE.PlaneGeometry(0.17, 0.5).translate(0, 0.215, 0).rotateX(-Math.PI / 2);
  for (let i = 0; i < 2; i++) { const f = new THREE.Mesh(gs, fmS); f.rotation.z = (i * Math.PI) / 2; VM.flash.add(f); }
  VM.flash.visible = false;
  // douilles
  const sg = new THREE.CylinderGeometry(0.0045, 0.0045, 0.024, 8);
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(sg, M.brass); s.visible = false; vmScene.add(s);
    VM.shells.push({ mesh: s, v: new V3(), w: new V3(), t: 0 });
  }
  // couteau : bras droit complet, main gantée qui serre un poignard de combat (voir updateRigs)
  VM.knifeRig = new THREE.Group(); VM.knifeRig.visible = false; VM.root.add(VM.knifeRig);
  VM.knifeArm = makeArm(M, VM.knifeRig, -1);
  VM.knife = buildKnifeModel(M); VM.knifeRig.add(VM.knife);
  // grenade
  VM.nadeRig = new THREE.Group(); VM.nadeRig.visible = false; VM.root.add(VM.nadeRig);
  const nArm = new THREE.Mesh(G_CYL, M.sleeve); nArm.scale.set(0.045, 0.45, 0.045); nArm.position.set(0.04, -0.08, 0.22); nArm.rotation.x = Math.PI / 2 - 0.3; VM.nadeRig.add(nArm);
  bx(VM.nadeRig, M.glove, 0, 0, 0, 0.075, 0.085, 0.1);
  part(VM.nadeRig, new THREE.SphereGeometry(1, 14, 10), GM.olive, 0, 0.05, -0.04, 0.038, 0.045, 0.038);
  bx(VM.nadeRig, M.metal, 0.02, 0.09, -0.04, 0.01, 0.03, 0.015);
}

function vmEquip(def) {
  gunSoundPrepare(def.sound);
  if (!VM.models[def.key]) VM.models[def.key] = vmGunModel(def.key);
  if (VM.cur) { vmResetHandling(VM.cur); VM.holder.remove(VM.cur.group); }
  VM.cur = VM.models[def.key]; VM.curDef = def;
  VM.holder.add(VM.cur.group);
  VM.cur.muzzle.add(VM.flash);
  VM.cur.mag.position.copy(VM.cur.magHome); VM.cur.mag.visible = !VM.cur.tubeFed; vmResetHandling(VM.cur);
}

function vmKick(def, ads) {
  const r = def.recoil, a = (ads ? 0.55 : 1) * RECOIL.vis; // (RECOIL.vis : le coup se voit plus, 07ca-recul.js)
  const F = def.feel || FEEL.m4;
  VM.rec.vz += r.kick * 22 * a * F.kick; VM.rec.vrx += r.rot * 18 * a * F.rot; VM.rec.vry += (Math.random() - 0.5) * r.rot * 10 * a; VM.rec.vrz += (Math.random() - 0.5) * r.rot * 14 * (1 + F.roll);
  VM.rec.vy += r.kick * 4 * F.kick;
  // attaque : le premier déplacement est immédiat (l'arme part dès l'image du tir au lieu de prendre de la vitesse)
  VM.rec.z += r.kick * 0.35 * a * F.kick; VM.rec.rx += r.rot * 0.25 * a * F.rot;
  VM.flashT = VM.flashT0 = def.silent ? 0 : def.pellets || def.bolt ? 0.065 : 0.05; VM.trigT = 0.085;
  VM.flash.rotation.z = Math.random() * TAU; const s = rand(0.85, 1.15) * F.flash; VM.flash.scale.set(s, s, s * rand(0.85, 1.25));
  // variantes du coup : une rosace au hasard, une flamme avec jets en travers si un frein de bouche ou un compensateur renvoie les gaz sur les côtés
  const jet = !!def.att && (def.att.includes('brake') || def.att.includes('comp'));
  FXT.flashF.offset.set(randi(0, 1) * 0.5, randi(0, 1) * 0.5); FXT.flashS.offset.set(jet ? 0.5 : 0, randi(0, 1) * 0.5);
  if (VM.cur && VM.cur.slide) VM.slideK = 1;
  vmFlash.intensity = def.silent ? 0.8 : 4.5 * Math.max(1, F.flash);
}
function vmShell(def) {
  const s = VM.shells[VM.shellIdx]; VM.shellIdx = (VM.shellIdx + 1) % VM.shells.length;
  VM.cur.eject.getWorldPosition(s.mesh.position);
  s.v.set(rand(1.4, 2.2), rand(1.0, 1.8), rand(0.2, 0.6)); s.w.set(rand(-20, 20), rand(-20, 20), rand(-20, 20)); s.t = 0.7; s.mesh.visible = true;
  if (def.shell === 'shotgun') s.mesh.scale.set(2.2, 2.4, 2.2); else if (def.shell === 'sniper') s.mesh.scale.set(1.3, 2.2, 1.3); else if (def.shell === 'pistol50') s.mesh.scale.set(1.4, 1.5, 1.4); else s.mesh.scale.set(1, 1, 1);
  s.mesh.material = def.shell === 'shotgun' ? SHELL_RED : GM.brass;
}
const SHELL_RED = new THREE.MeshStandardMaterial({ color: 0x9c2a1c, roughness: 0.5 });
/* Cuillère de grenade qui saute quand la mèche démarre : même pool que les douilles */
function vmSpoon() {
  const N = NADE_RIG; if (!N.nade) return;
  const sp = N.nade.userData.spoon; if (!sp || !sp.visible) return;
  const s = VM.shells[VM.shellIdx]; VM.shellIdx = (VM.shellIdx + 1) % VM.shells.length;
  sp.getWorldPosition(s.mesh.position); sp.getWorldQuaternion(s.mesh.quaternion); sp.visible = false;
  // elle file vers la droite et l'arrière : un éclat métallique bref, pas un objet qui traverse l'écran
  s.v.set(rand(1.8, 2.6), rand(1.2, 1.8), rand(1.0, 1.5)); s.w.set(rand(-40, 40), rand(-15, 15), rand(-40, 40)); s.t = 0.3; s.mesh.visible = true;
  s.mesh.scale.set(1.3, 2.3, 0.45); s.mesh.material = GM.blade;
}
function vmStartAction(name, dur, data) { VM.action = name; VM.actionT = 0; VM.actionDur = dur; VM.actionData = data || {}; VM.actK = 1; VM.actFade = false; VM.lastAct = ''; }

/* Arme baissée (VM.lower, 0 en main, 1 hors champ) : rangée d'un coup sec (départ à pleine vitesse, VM.lowerRate), sortie sur un ressort
   peu amorti (pulsation 1,5 fois VM.raiseRate) qui la lance, la fait dépasser un peu sa place, canon relevé, puis l'y pose : elle claque
   en position comme dans les Call of Duty récents. La vue accompagne les deux gestes (événements rangee et sortie de VM_ANIM). Pas de
   1/120 s au plus, comme les autres ressorts de la vue subjective. */
function vmLowerStep(dt, def) {
  const C = vmaCfg(def).recharge, E = C.ev;
  if (VM.lowerTarget >= 0.5) {
    if (VM.lowerUp && VM.lower < 0.5 && E.rangee) vmCamKick(E.rangee.cam, E.rangee.fov, C.cam);
    VM.lowerUp = false; VM.lowV = 0;
    VM.lower = damp(VM.lower, VM.lowerTarget, (VM.lowerRate || 16) * 1.6, dt); // (1,3 avant la 5.1)
    return;
  }
  VM.lowerUp = true;
  if (VM.lower > 0.3) VM.lowArr = false; // l'arme repart de hors champ (changement d'arme, apparition, grenade lancée)
  // (5.1 : pulsation 1,75 et amortissement 0,48 au lieu de 1,5 et 0,6 : l'arme arrive plus vite et dépasse davantage sa place)
  const w = 1.75 * (VM.raiseRate || 16), k = w * w, c = 2 * 0.48 * w, n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let i = 0; i < n; i++) { VM.lowV += (-k * (VM.lower - VM.lowerTarget) - c * VM.lowV) * h; VM.lower += VM.lowV * h; }
  if (Math.abs(VM.lower) < 2e-4 && Math.abs(VM.lowV) < 2e-3) { VM.lower = 0; VM.lowV = 0; }
  // l'arme arrive en place : la vue marque l'arrêt
  if (!VM.lowArr && VM.lower < 0.15) { VM.lowArr = true; if (E.sortie) { vmCamKick(E.sortie.cam, E.sortie.fov, C.cam); vmChoc(E.sortie.vm, C); } }
  if (VM.raiseRate && VM.lower < 0.02) VM.raiseRate = 0; // sortie d'arme lente terminée (changement de classe en pause)
}

const env = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? smoothstep(a, b, t) : t < c ? 1 : 1 - smoothstep(c, d, t));

/* Mise à jour de la vue subjective. S : état du joueur utile à l'animation */
function updateViewmodel(dt, S) {
  if (!VM.cur) return;
  VM.handDt = dt;
  const def = VM.curDef, m = VM.cur;
  VM.ads = damp(VM.ads, S.ads ? 1 : 0, 1 / Math.max(0.05, def.adsTime) * 2.2, dt);
  // la visée se cale : un petit choc de l'arme et de la vue quand elle arrive à l'épaule (une fois par mise en joue)
  if (S.ads && !VM.adsSnap && VM.ads > 0.82) { VM.adsSnap = true; const C = vmaCfg(def).recharge; if (C.ev.visee && !def.scope) { vmChoc(C.ev.visee.vm, C); vmCamKick(C.ev.visee.cam, C.ev.visee.fov, C.cam); } } // (pas sous une lunette : l'image entière bougerait)
  else if (!S.ads && VM.ads < 0.3) VM.adsSnap = false;
  // sprint : ressort peu amorti, l'arme bascule d'un coup avec un dépassement à l'entrée comme à la sortie
  VM.sprV += ((S.sprint ? 1 : 0) - VM.sprint) * 270 * dt - VM.sprV * 18 * dt; VM.sprint = clamp(VM.sprint + VM.sprV * dt, -0.08, 1.08); // (210 et 17 avant la 5.1)
  // inclinaison en pas chassés, poussée en avançant, arme relevée en l'air, arme repliée contre un mur proche
  VM.tilt = damp(VM.tilt, clamp((S.lat || 0) / 5, -1.2, 1.2), 7, dt);
  VM.push = damp(VM.push, clamp((S.fwd || 0) / 6, -1, 1), 5, dt);
  VM.jump = damp(VM.jump, S.grounded === false ? 1 : 0, S.grounded === false ? 7 : 12, dt);
  VM.wall = damp(VM.wall, S.wall || 0, (S.wall || 0) > VM.wall ? 12 : 7, dt);
  // doigt de détente : pressé tant qu'on tire en rafale, ou un bref instant à chaque coup
  VM.trigT = Math.max(0, VM.trigT - dt);
  VM.trig = damp(VM.trig, (S.fire && def.auto && !S.empty) || VM.trigT > 0 ? 1 : 0, 30, dt);
  VM.crouch = damp(VM.crouch, S.crouch ? 1 : 0, 8, dt);
  const spd = S.speed;
  VM.bobAmt = damp(VM.bobAmt, S.grounded ? clamp(spd / 5, 0, 1.6) : 0, 8, dt);
  VM.bobT += dt * Math.PI * spd / (S.sprint ? 2.7 : 2.1); // un demi-cycle par pas, comme la caméra
  VM.swayTX = clamp(VM.swayTX, -0.12, 0.12); VM.swayTY = clamp(VM.swayTY, -0.12, 0.12);
  VM.swayX = damp(VM.swayX, VM.swayTX, 10, dt); VM.swayY = damp(VM.swayY, VM.swayTY, 10, dt);
  VM.swayTX = damp(VM.swayTX, 0, 6, dt); VM.swayTY = damp(VM.swayTY, 0, 6, dt);
  const R = VM.rec;
  const SP = (def.feel || FEEL.m4).spring, sk = SP[0] / 240, sc = SP[1] / 19;
  spring(R, 'z', 'vz', 260 * sk, 20 * sc, dt); spring(R, 'rx', 'vrx', 220 * sk, 17 * sc, dt); spring(R, 'ry', 'vry', 200 * sk, 16 * sc, dt); spring(R, 'rz', 'vrz', 180 * sk, 14 * sc, dt); spring(R, 'y', 'vy', 200 * sk, 18 * sc, dt);
  VM.slideK = Math.max(0, (VM.slideK || 0) - dt * 22);
  if (m.slide) m.slide.position.z = Math.max(VM.slideK, (VM.slideHold || (S.empty && m.kind === 'pistol')) ? 1 : 0) * (m.slideTravel || 0.034);
  VM.vland += (-120 * VM.land - 12 * VM.vland) * dt; VM.land += VM.vland * dt;
  vmLowerStep(dt, def);
  VM.breath += dt;

  const a = smoothstep(0, 1, VM.ads), sp = VM.sprint * (1 - a);
  const bobS = VM.bobAmt * (1 - a * 0.85);
  // saut et réception en visée : la mire reste devant l'œil (retour du propriétaire : « l'arme bouge mal quand on garde le zoom et qu'on saute ») ;
  // il ne reste que 15 % de la montée en l'air, 10 % de la bascule et 30 % du ressort de réception
  const airK = 1 - a * 0.85, landK = 1 - a * 0.7;
  // position à la hanche : le pistolet est tenu plus haut et plus près pour qu'on voie la main qui l'empoigne ; les armes
  // longues sont près du corps, coudes pliés, et s'éloignent le temps d'un rechargement. Le retour à la hanche se fait pendant la
  // remise en place qui termine la chorégraphie (ou pendant que s'efface une inspection interrompue), et non une fois tout fini :
  // retour du propriétaire, « la fin se termine avec les bras plus tendus, puis d'un coup ça revient à la position normale »
  const far = VM.action && VM_FAR_ACTIONS.has(VM.action);
  VM.farK = damp(VM.farK || 0, far ? 1 : 0, 7, dt);
  let fOut = 1;
  if (far && VM_FAR_END.has(VM.action)) {
    const w = Math.min(VM_FAR_OUT, VM.actionDur);
    fOut = 1 - smoothstep(VM.actionDur - w, VM.actionDur, VM.actionT);
    if (VM.action === 'inspect') fOut = Math.min(fOut, VM.actK);
  }
  const h0 = VM_HIP[m.kind] || VM_HIP.rifle, h1 = VM_HIP_ACT[m.kind] || h0, fk = smoothstep(0, 1, VM.farK) * fOut, hip = _hipK;
  for (let i = 0; i < 6; i++) hip[i] = lerp(h0[i], h1[i], fk);
  const px = lerp(hip[0], 0, a), py = lerp(hip[1], -m.sightY, a), pz = lerp(hip[2], -m.adsZ, a);
  // balancement en « sourire » : l'arme glisse d'un côté à l'autre et descend au milieu, sans rebond
  // brusque aux extrémités (cos 2θ au lieu de |sin θ|)
  const bx = Math.cos(VM.bobT), by = (Math.cos(2 * VM.bobT) - 1) * 0.5;
  let x = px + bx * 0.012 * bobS + VM.swayX * 0.08 * (1 - a * 0.8);
  let y = py + by * 0.013 * bobS - VM.land * landK + Math.sin(VM.breath * 1.6) * 0.0018 * (1 - a) + VM.jump * 0.02 * airK;
  let z = pz + R.z;
  let rx = R.rx + VM.swayY * 0.9 * (1 - a * 0.8) + Math.sin(VM.bobT * 2) * 0.01 * bobS + hip[3] * (1 - a);
  let ry = R.ry + VM.swayX * 1.2 * (1 - a * 0.8) + Math.cos(VM.bobT) * 0.012 * bobS + hip[4] * (1 - a);
  let rz = R.rz + Math.cos(VM.bobT) * 0.02 * bobS + VM.swayX * 0.6 + hip[5] * (1 - a);
  // balancement de marche commun, repris par les bras de grenade et les appareils tenus en main
  VM.bobO.set(bx * 0.012 * bobS + VM.swayX * 0.06, by * 0.013 * bobS - VM.land + Math.sin(VM.breath * 1.6) * 0.0018, 0);
  VM.bobR.set(VM.swayY * 0.35 + Math.sin(VM.bobT * 2) * 0.008 * bobS, VM.swayX * 0.5 + Math.cos(VM.bobT) * 0.01 * bobS, Math.cos(VM.bobT) * 0.015 * bobS + VM.swayX * 0.3);
  // sprint : arme inclinée vers le bas et le côté, qui pompe au rythme des foulées (roulis autour du
  // canon et léger va-et-vient) plutôt que de sautiller
  // course et rechargement (ou inspection) à la fois : la pose de sprint s'efface devant la chorégraphie, qui garde les foulées et
  // reste un peu plus basse ; additionnées, la bascule du sprint et celle du rechargement couchaient l'arme en travers du milieu
  // de l'écran, devant la visée (retour du propriétaire)
  const spA = sp * (1 - fk); VM.sprK = spA;
  const SPR = m.kind === 'pistol' ? VM_SPRINT_NONE : VM_SPRINT;
  x += SPR[0] * spA; y += SPR[1] * spA; z += SPR[2] * spA;
  rx += SPR[3] * spA; ry += SPR[4] * spA; rz += SPR[5] * spA;
  if (m.kind !== 'pistol') { y -= 0.025 * sp * fk; rx -= 0.08 * sp * fk; }
  if (sp > 0.01) {
    const s1 = Math.sin(VM.bobT), s2 = Math.sin(2 * VM.bobT), k = lerp(spA, sp * 0.5, fk) * Math.min(1, VM.bobAmt);
    x += bx * 0.012 * k; y += by * 0.012 * k; z += s2 * 0.01 * k; rz += s1 * 0.1 * k; rx += s2 * 0.04 * k; ry += bx * 0.05 * k;
  }
  y -= VM.crouch * 0.01 * (1 - a);
  // passage à l'épaule : l'arme décrit un arc (elle roule un peu et monte par en dessous) au lieu d'une ligne droite
  const arc = Math.sin(clamp(VM.ads, 0, 1) * Math.PI) * (1 - sp);
  rz += arc * 0.06 * (S.ads ? 1 : -0.6); y -= arc * 0.007; x += arc * 0.006;
  // pas chassés : l'arme s'incline du côté où l'on va et traîne un peu ; l'arme recule quand on accélère
  rz -= VM.tilt * 0.055 * (1 - a * 0.75); x -= VM.tilt * 0.007 * (1 - a * 0.6); ry += VM.tilt * 0.015 * (1 - a);
  z += VM.push * 0.012 * (1 - a * 0.7); rx -= VM.push * 0.012 * (1 - a);
  // en l'air : l'arme monte et bascule, puis la réception l'écrase (ressort de VM.land)
  y += VM.jump * 0.012 * airK; rx += VM.jump * 0.05 * (1 - a * 0.9);
  // contre un mur : l'arme recule et se redresse, canon vers le haut
  const wk = VM.wall * (1 - a) * (1 - sp);
  z += wk * 0.1; y -= wk * 0.025; rx += wk * 0.55; ry += wk * 0.22; rz -= wk * 0.12;
  // glissade : l'arme s'incline vers l'extérieur et descend, avec un léger tremblement de la vitesse
  const sl = (S.slide || 0) * (1 - a);
  if (sl > 0.01) { x += 0.03 * sl; y -= 0.025 * sl; z += 0.02 * sl; rx += 0.12 * sl; ry -= 0.1 * sl; rz += (0.32 + Math.sin(VM.breath * 40) * 0.01) * sl; }
  // abaissement (changement d'arme)
  // l'arme plonge en tournant vers l'extérieur (et remonte de même) plutôt que de descendre tout droit
  y -= VM.lower * 0.28; rx -= VM.lower * 0.9; rz += VM.lower * 0.32; x += VM.lower * 0.05; ry -= VM.lower * 0.18;
  // arme rangée dans le dos pour une série : elle se lève, bascule et passe par-dessus l'épaule droite
  if (VM.sling > 0.001) {
    const o = keySpline(VM_SLING.pos, VM.sling), r = keySpline(VM_SLING.rot, VM.sling);
    x += o.x; y += o.y; z += o.z; rx += r.x; ry += r.y; rz += r.z;
  }

  // animations d'action
  let gripL = m.gripL.clone(), gripR = m.gripR.clone();
  m.mag.position.copy(m.magHome); m.mag.rotation.set(0, 0, 0); if (!m.tubeFed) m.mag.visible = true;
  if (m.bolt) { m.bolt.position.set(0.02, 0.045, 0.07); m.bolt.rotation.set(0, 0, 0); }
  if (m.pump) m.pump.position.z = 0;
  VM.rlT = null; VM.rlD = null; VM.slideHold = false;
  // enchaînement et annulation : quand une chorégraphie en remplace une autre (ou s'interrompt), l'écart entre l'ancienne pose
  // et la nouvelle devient l'écart d'un ressort amorti (VM_ANIM.annul) lancé avec une part de la vitesse qu'avait l'arme :
  // elle garde un peu de son élan, puis rejoint sa nouvelle pose, sans saut d'une image à l'autre
  const cur = VM.action ? VM.action + ':' + VM.actionDur : '', G0 = VM.lastGo;
  let gNow = null;
  if (VM.action) {
    VM.actionT += dt; const t = clamp(VM.actionT / VM.actionDur, 0, 1), D = VM.actionData;
    const go = vmChoreo(VM.action, t, D, def, m); // chorégraphie complète (06d-reload.js), sinon anciennes poses ci-dessous
    if (go) {
      // inspection interrompue : la pose s'efface en douceur, puis l'action s'arrête
      const k = VM.action === 'inspect' ? (VM.actK = damp(VM.actK, VM.actFade ? 0 : 1, 16, dt)) : 1;
      if (VM.action === 'inspect' && VM.actFade && VM.actK < 0.02) VM.actionT = VM.actionDur;
      gNow = go.map((v) => v * k);
      x += gNow[0]; y += gNow[1]; z += gNow[2]; rx += gNow[3]; ry += gNow[4]; rz += gNow[5];
    }
    else if (VM.action === 'reload') {
      const e = env(t, 0, 0.14, 0.82, 1);
      rz += 0.34 * e; rx += 0.14 * e; ry += -0.08 * e; y -= 0.02 * e; x -= 0.025 * e;
      if (def.fam === 'pistol') { rz -= 0.2 * e; rx += 0.1 * e; }
      if (t > 0.16 && t < 0.34) { const k = smoothstep(0.16, 0.34, t); m.mag.position.y -= k * 0.3; m.mag.position.z += k * 0.05; m.mag.rotation.x = k * 0.4; }
      if (t >= 0.34 && t < 0.4) m.mag.visible = false;
      if (t >= 0.4 && t < 0.6) { const k = 1 - smoothstep(0.4, 0.58, t); m.mag.position.y -= k * 0.28; m.mag.position.z += k * 0.04; m.mag.rotation.x = k * 0.3; }
      const hk = env(t, 0.12, 0.2, 0.62, 0.74);
      gripL.lerp(_v4.copy(m.mag.position).add(new V3(-0.01, -0.09, 0)), hk);
      if (t > 0.34 && t < 0.4) gripL.y -= 0.25;
      if (D.empty) { const ck = env(t, 0.74, 0.8, 0.84, 0.9); rz += 0.15 * ck; gripL.lerp(new V3(0.02, 0.06, 0.1), ck * 0.9); if (m.bolt) m.bolt.position.z += ck * 0.08; }
      if (!D.sm && t > 0.2) { sfxMech('magout'); D.sm = 1; }
      if (!D.si && t > 0.57) { sfxMech('magin'); D.si = 1; R.vy -= 0.4; R.vrx += 0.6; }
      if (D.empty && !D.sc && t > 0.8) { sfxMech('charge'); D.sc = 1; R.vz += 0.4; }
    } else if (VM.action === 'shellStart' || VM.action === 'shellEnd') {
      const e = VM.action === 'shellStart' ? smoothstep(0, 1, t) : 1 - smoothstep(0, 1, t);
      rz += 0.35 * e; rx += 0.2 * e; y -= 0.02 * e; x -= 0.015 * e;
      gripL.lerp(new V3(0, -0.07, 0.0), e * 0.6);
    } else if (VM.action === 'shell') {
      rz += 0.35; rx += 0.2; y -= 0.02; x -= 0.015;
      const k = Math.sin(t * Math.PI);
      gripL.lerp(new V3(0, -0.09 + k * 0.05, 0.0 - k * 0.02), 1);
      m.mag.visible = t < 0.55; m.mag.position.set(0, -0.08 + k * 0.05, 0.0 - k * 0.02);
      if (!D.s && t > 0.5) { sfxMech('shell'); D.s = 1; R.vrx += 0.3; }
    } else if (VM.action === 'bolt') {
      const e = env(t, 0, 0.15, 0.8, 1);
      rz -= 0.18 * e; ry += 0.05 * e; rx += 0.05 * e;
      const k = env(t, 0.15, 0.35, 0.5, 0.7);
      if (m.bolt) { m.bolt.rotation.z = env(t, 0.12, 0.22, 0.65, 0.75) * 1.0; m.bolt.position.z += k * 0.1; }
      gripR.lerp(new V3(0.07, 0.03, 0.07 + k * 0.1), e);
      if (!D.s && t > 0.15) { sfxMech('bolt'); D.s = 1; }
      if (!D.e && t > 0.4) { vmShell(def); D.e = 1; }
    } else if (VM.action === 'pump') {
      // pompe : le garde-main recule avec la main gauche, éjecte la cartouche tirée, puis revient
      const k = env(t, 0.08, 0.3, 0.46, 0.76); gripL.z += k * 0.075; if (m.pump) m.pump.position.z = k * 0.075;
      if (!D.s && t > 0.3) { sfxMech('pump'); vmShell(def); D.s = 1; R.vz += 0.4; R.vrx += 0.3; }
    } else if (VM.action === 'draw') {
      // géré par lower
    }
    if (VM.actionT >= VM.actionDur) { if (VM_FAR_END.has(VM.action)) VM.farK = 0; VM.action = null; } // déjà revenue à la hanche
  }
  const AN = vmaCfg(def).annul, PO = VM.popO, PV = VM.popV, GV = VM.gV, changed = cur !== VM.lastAct;
  if (changed) { for (let i = 0; i < 6; i++) { PO[i] += G0[i] - (gNow ? gNow[i] : 0); PV[i] += GV[i] * AN.inertie; } VM.lastAct = cur; }
  for (let i = 0; i < 6; i++) { const g = gNow ? gNow[i] : 0; GV[i] = changed || dt <= 0 ? 0 : clamp((g - G0[i]) / dt, -12, 12); G0[i] = g; }
  vmaSpring(PO, PV, AN.ressort, dt);
  x += PO[0]; y += PO[1]; z += PO[2]; rx += PO[3]; ry += PO[4]; rz += PO[5];
  // chocs du maniement (chargeur claqué, culasse qui part : vmChoc, 06cy-ressorts.js), par-dessus la chorégraphie
  const CO = VM.chocO;
  vmaSpring(CO, VM.chocV, vmaCfg(def).recharge.ressort, dt);
  x += CO[0]; y += CO[1]; z += CO[2]; rx += CO[3]; ry += CO[4]; rz += CO[5];

  // optique qui resserre la vue de l'arme en visée (ACOG, info.vmFov) : ses mouvements (recul, balancement) sont réduits d'autant, ils
  // gardent à l'écran l'ampleur qu'ils ont avec les autres viseurs ; l'oculaire ne laisse voir le monde qu'en visée (masque, 06p)
  if (m.vmFov) {
    const kz = lerp(1, Math.tan(m.vmFov * Math.PI / 360) / Math.tan(22 * Math.PI / 180), a);
    x = px + (x - px) * kz; y = py + (y - py) * kz; z = pz + (z - pz) * kz; rx *= kz; ry *= kz; rz *= kz;
    if (m.ocular) m.ocular.visible = VM.ads > 0.2;
  }
  VM.holder.position.set(x, y, z);
  VM.holder.rotation.set(rx, ry, rz);
  // pistolet au sprint : l'arme suit le bras qui pompe (tenu d'une main, poignet droit)
  if (m.kind === 'pistol' && sp > 0.001) pistolRunPose(m, smoothstep(0, 1, sp) * (VM.action ? 0 : 1));
  // bras : épaules fixées au corps, mains posées sur l'arme
  placeHands(m, gripR, gripL);
  placeWatch(VM.watch, VM.arms.L);
  const hideArms = !!def.scope && a > 0.92;
  VM.holder.visible = !hideArms && VM.lower < 0.97 && VM.sling < 0.9;
  // les deux mains lâchent l'arme dès qu'elle part vers l'épaule : elle file seule sur sa bretelle, ce qui laisse la place à l'appareil
  setArmVisible(VM.arms.L, VM.sling < 0.4); setArmVisible(VM.arms.R, VM.sling < 0.5);

  // flash
  VM.flashT -= dt; VM.flash.visible = VM.flashT > 0 && !hideArms;
  if (VM.flash.visible) {
    // la rosace se resserre et s'éteint, la flamme s'allonge en s'éteignant (trois images à 60 par seconde)
    const k = smoothstep(0, 0.55, VM.flashT / VM.flashT0), c = VM.flash.children;
    VM.flashM[0].opacity = VM.flashM[1].opacity = k;
    c[0].scale.setScalar(0.75 + 0.25 * k); c[1].scale.z = c[2].scale.z = 1.3 - 0.3 * k;
  }
  vmFlash.intensity = Math.max(0, vmFlash.intensity - dt * 90);
  vmUpdateDrops(dt);
  // douilles
  for (const s of VM.shells) {
    if (s.t <= 0) continue; s.t -= dt;
    s.v.y -= 9.8 * dt; s.mesh.position.addScaledVector(s.v, dt);
    s.mesh.rotation.x += s.w.x * dt; s.mesh.rotation.y += s.w.y * dt; s.mesh.rotation.z += s.w.z * dt;
    if (s.t <= 0) s.mesh.visible = false;
  }
  // soleil de la scène de vue subjective aligné sur la caméra et atténué à l'ombre
  _q1.copy(camera.quaternion).invert();
  vmSun.position.copy(SUN_DIR).applyQuaternion(_q1).multiplyScalar(5);
  vmSun.intensity = lerp(0.25, 2.3, VM.sunVis);
  // ciel visible à hauteur des mains (éclairage cuit) : l'arme s'assombrit à l'intérieur
  const L = lightAt(camera.position.x, camera.position.y - 0.25, camera.position.z);
  VM.sky = damp(VM.sky === undefined ? L[0] : VM.sky, L[0], 3, dt);
  const skc = skyCurve(VM.sky); WMU.uSkyC.value.z = skc; // ciel vu à la caméra : brume des lieux couverts (WM_AO)
  vmHemi.intensity = lerp(0.55, 0.75, VM.sunVis) * lerp(0.42 * WMU.uSkyC.value.y, 1, skc);
  // sous une lampe du décor, l'arme prend sa lumière (couches des lampes de l'éclairage cuit)
  vmLamp.color.lerp(lampAt(camera.position.x, camera.position.y - 0.25, camera.position.z, _vmLampC), 1 - Math.exp(-3 * dt));
}
const _vmLampC = new THREE.Color();

