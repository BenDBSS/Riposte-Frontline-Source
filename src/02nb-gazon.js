/* ==========================================================================
   GAZON : de vrais brins d'herbe sur les pelouses (Stratus, Hortus).
   Technique de l'herbe de Ghost of Tsushima (GDC 2021, « Procedural Grass in Ghost of Tsushima »), telle que SimonDev l'a reprise
   pour three.js (Quick_Grass, licence MIT), avec ce que conseille le forum three.js pour tenir la cadence avec beaucoup de brins :
   tuiles, rejet hors du champ, niveaux de détail, géométrie réduite au loin, tout le mouvement dans le nuanceur de sommets.
   - Placement, au chargement (une fois, en JavaScript) : la zone de jeu est découpée en tuiles de 8 m ; dans chacune, des brins tirés
     sur une grille tremblée (GRASS.dens par m², 80) là où la carte veut du gazon (grass.density de sa définition, de 0 à 1) et où il peut
     pousser (masque au quart de mètre : sol au niveau 0, ni le vide ni un pont ni une terrasse, aucun obstacle posé, ni eau ni rampe).
     Les brins d'une tuile sont mélangés et numérotés : le rang d'un brin (de 0 à 1) décide s'il reste quand la densité baisse avec la
     distance ou la qualité, sans saut d'une tuile à l'autre.
   - Rendu : un programme, deux gabarits de brin (près : 7 triangles effilés ; loin : un triangle). Chaque tuile est un dessin instancié
     (attribut par brin, en demi-flottants : x et z dans la tuile, hauteur, rang ; 8 octets) ; à chaque image, les tuiles hors du champ ou au-delà de la portée sont masquées, les
     autres prennent le gabarit de leur distance et ne dessinent que les brins utiles (instanceCount). Le nuanceur de sommets forme et
     courbe le brin, le couche au vent (rafales qui traversent la pelouse), sous les pas et les souffles (champ de souplesse BEND de la
     flore), l'allume (soleil enveloppant, contre-jour, ciel et rebond lus dans le volume d'éclairage cuit ; l'ombre du soleil est celle du
     sol : les deux cascades proches des cartes d'ombre, lues par sommet, et l'ombre cuite au-delà ou sans cartes d'ombre) et le rentre
     dans le sol au bout de la portée (aucun brin ne surgit) ; un brin n'est jamais plus fin qu'un pixel (pas de scintillement au loin).
     Le nuanceur de fragments ne fait que la couleur et le brouillard : l'herbe
     se recouvre beaucoup, chaque pixel doit coûter peu.
   - Hors de l'occlusion ambiante (SSAO), de la pré-passe de profondeur et des ombres portées. Densité et portée suivent le profil de
     qualité (QUALITY.*.grass : part des brins, portée, fin du gabarit proche) ; réglage Vidéo « Herbe en relief » ; rien en mode
     graphique économique. Tout appartient à la carte et se libère avec elle.
   Définition d'une carte : grass = { density(x, z) de 0 à 1, height(x, z, r) en m (r : tirage de 0 à 1), colors [pied, pointe, herbe
   sèche] (sRGB), wind [direction x, direction z, force], width (demi-largeur au pied, m), amb (part de la couleur du ciel ajoutée :
   la lumière de l'environnement que reçoit le sol), dens (brins par m², GRASS.dens par défaut), seed }.
   ========================================================================== */
const GRASS = { on: false, size: 8, dens: 80, width: 0.012, bytes: 0, chunks: [], root: null, mat: null, tplN: null, tplF: null, blades: 0, drawn: 0, ms: 0, frustum: new THREE.Frustum(), pv: new THREE.Matrix4(), box: new THREE.Box3() };
/* Uniformes du gazon ; le temps, le champ de souplesse et le volume d'éclairage sont ceux de la flore et du décor (mêmes objets) */
const GRASS_U = {
  uGrT: { value: 0 }, uGrW: { value: new THREE.Vector4(1, 0, 0.5, 0) }, uGrD: { value: new THREE.Vector4(40, 14, 1, 0.012) }, uGrP: { value: 0.0013 },
  uGrSun: { value: new THREE.Color() }, uGrL: { value: new THREE.Vector3(0, 1, 0) }, uGrSky: { value: new THREE.Color() }, uGrGnd: { value: new THREE.Color() }, uGrAmb: { value: new THREE.Color() },
  uGrC0: { value: new THREE.Color() }, uGrC1: { value: new THREE.Color() }, uGrC2: { value: new THREE.Color() },
  // ombre du soleil : cartes des deux cascades proches (mêmes textures et matrices que le décor), biais, lues ou non (cartes prêtes)
  uGrSh0: { value: null }, uGrSh1: { value: null }, uGrShM0: { value: new THREE.Matrix4() }, uGrShM1: { value: new THREE.Matrix4() }, uGrShB: { value: -0.0001 }, uGrShOn: { value: 0 },
};
const GRASS_VERT = `#include <common>
#include <fog_pars_vertex>
attribute vec4 aGr;
uniform float uGrT, uGrP; uniform vec4 uGrW, uGrD;
uniform vec3 uGrSun, uGrL, uGrSky, uGrGnd, uGrAmb, uGrC0, uGrC1, uGrC2;
uniform sampler2D tLvB; uniform vec4 uLvBnd, uLvW;
uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv, uBounce; uniform float uAOFloor; uniform vec4 uVolL;
${VOL_Q}
${VOL_L}
varying vec3 vGrC; varying float vGrS;
float grH(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
#ifdef GR_SH
uniform highp sampler2DShadow uGrSh0, uGrSh1; uniform mat4 uGrShM0, uGrShM1; uniform float uGrShB, uGrShOn;
// ombre du soleil en p d'après les cartes d'ombre (cascade proche, puis la suivante) ; -1 hors des deux : l'ombre cuite prend le relais
float grShadow(vec3 p) {
  if (uGrShOn < 0.5) return -1.0;
  vec4 c = uGrShM0 * vec4(p, 1.0); c.xyz /= c.w;
  if (c.x > 0.002 && c.x < 0.998 && c.y > 0.002 && c.y < 0.998 && c.z <= 1.0) return texture(uGrSh0, vec3(c.xy, c.z + uGrShB));
  c = uGrShM1 * vec4(p, 1.0); c.xyz /= c.w;
  if (c.x > 0.002 && c.x < 0.998 && c.y > 0.002 && c.y < 0.998 && c.z <= 1.0) return texture(uGrSh1, vec3(c.xy, c.z + uGrShB));
  return -1.0;
}
#endif
void main() {
  vec3 root = (modelMatrix * vec4(aGr.x, 0.0, aGr.y, 1.0)).xyz; // x et z dans la tuile : la tuile est placée par sa matrice
  float rank = aGr.w, t = position.y, sd = position.x, dist = distance(cameraPosition, root);
  // part des brins gardée à cette distance (et selon la qualité) : un brin reste si son rang est dessous ; au bout de la portée, il rentre dans le sol
  float keep = uGrD.z * (1.0 - 0.86 * smoothstep(uGrD.y * 0.6, uGrD.x, dist));
  float on = step(rank, keep) * (1.0 - smoothstep(uGrD.x * 0.8, uGrD.x, dist));
  float r1 = grH(rank + 0.13), r2 = grH(rank + 0.71), r3 = grH(rank + 0.37);
  float H = aGr.z * on, ang = r1 * 6.2831853;
  vec2 face = vec2(cos(ang), sin(ang)), side = vec2(-face.y, face.x);
  // largeur presque constante puis pointue, plus grande quand les brins s'éclaircissent (le pré reste couvert au loin), jamais sous un pixel
  float w = uGrD.w * (0.7 + 0.6 * r2) * mix(1.0, 2.0, 1.0 - keep / max(uGrD.z, 0.01));
  w = max(w, dist * uGrP * 0.5) * (1.0 - t * t * 0.95) * on;
  // courbure naturelle, rafales qui traversent la pelouse dans le sens du vent, frémissement, pas et souffles (champ de souplesse)
  vec2 wd = uGrW.xy, wp = vec2(-wd.y, wd.x);
  float wave = sin(dot(root.xz, wd) * 0.32 - uGrT * 1.7 + sin(dot(root.xz, wp) * 0.11 + uGrT * 0.3) * 1.5);
  float gust = uGrW.z * (0.3 + 0.7 * (wave * 0.5 + 0.5));
  float flut = sin(uGrT * (4.0 + 3.0 * r2) + rank * 40.0) * 0.07 * uGrW.z;
  vec4 bd = texture2D(tLvB, (root.xz - uLvBnd.xy) * uLvBnd.zw);
  vec2 push = (bd.xy - 0.5) * 2.0 * uLvW.z;
  vec2 bend = (face * (0.15 + 0.4 * r3) + wd * gust + side * flut) * H + push * 1.1;
  // longueur du brin à peu près constante : la pointe descend quand il plie
  float b = min(length(bend) / max(H, 0.02), 0.95), tip = H * sqrt(1.0 - b * b);
  vec3 pos = root + vec3(side.x * sd * w + bend.x * t * t, tip * t, side.y * sd * w + bend.y * t * t);
  // lumière par sommet : soleil enveloppant et contre-jour, ciel et rebond du volume cuit, ombre du soleil cuite, pied du brin dans l'ombre des autres
  vec3 V = normalize(cameraPosition - pos);
  float fs = dot(V.xz, face) < 0.0 ? -1.0 : 1.0;
  vec3 N = normalize(vec3(face.x * fs, 0.0, face.y * fs) * 0.55 + vec3(side.x, 0.0, side.y) * sd * 0.25 + vec3(0.0, 0.85, 0.0));
  vec3 vq = (root + vec3(0.0, 0.3, 0.0) - uVolMin) * uVolInv;
  vec4 vol = texture(tVol, VOL_Q(vq));
  float sky = mix(uAOFloor, 1.0, vol.r);
  float dif = clamp((dot(N, uGrL) + 0.45) / 1.45, 0.0, 1.0), back = pow(clamp(dot(-V, uGrL), 0.0, 1.0), 4.0) * 0.6 * t;
  vec3 hemi = mix(uGrGnd, uGrSky, N.y * 0.5 + 0.5);
  // plaques d'herbe sèche et tons du pré, qui varient lentement d'un endroit à l'autre
  float dry = smoothstep(0.3, 0.95, sin(root.x * 0.21 + sin(root.z * 0.17) * 1.7) * sin(root.z * 0.19 + 1.3)) * 0.75;
  float tone = 0.86 + 0.12 * sin(root.x * 0.13 + root.z * 0.07) + 0.2 * r3;
  vec3 alb = mix(mix(uGrC0, uGrC1, t), uGrC2, dry * t) * tone;
  float sunV = vol.a;
#ifdef GR_SH
  float shv = grShadow(pos + uGrL * 0.15); // un peu vers le soleil : le pied du brin ne s'ombre pas contre le sol
  if (shv >= 0.0) sunV = shv;
#endif
  vec3 c = alb * (uGrSun * (dif + back) * sunV + (hemi + uGrAmb) * sky + uBounce * vol.g * 0.32 + volLamp(vq)); // volLamp : lampes du décor
  vGrC = c * mix(0.42, 1.0, smoothstep(0.0, 0.75, t)); vGrS = sd;
  vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const GRASS_FRAG = `#include <common>
#include <fog_pars_fragment>
varying vec3 vGrC; varying float vGrS;
void main() {
  gl_FragColor = vec4(vGrC * (0.86 + 0.14 * abs(vGrS)), 1.0); // nervure un peu plus sombre au milieu du brin
  #include <fog_fragment>
}`;
function grassMaterial() {
  const U = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), GRASS_U, { tLvB: LIVE_U.tLvB, uLvBnd: LIVE_U.uLvBnd, uLvW: LIVE_U.uLvW, tVol: WMU.tVol, uVolMin: WMU.uVolMin, uVolInv: WMU.uVolInv, uVolL: WMU.uVolL, uBounce: WMU.uBounce, uAOFloor: WMU.uAOFloor });
  const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, fog: true, side: THREE.DoubleSide });
  if (!NO_SHADOWS && CSM_HW.on) m.defines = { GR_SH: '' }; // sans cartes d'ombre (PowerVR) : aucune lecture de carte d'ombre dans le programme
  m.name = 'gazon';
  return m;
}
/* Gabarits de brin (x : côté, -1 à 1 ; y : hauteur relative) : près, quatre étages et la pointe (9 sommets, 7 triangles : un brin long
   se courbe sans casser) ; loin, un triangle */
function grassTemplates() {
  const mk = (p, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); return g; };
  GRASS.tplN = mk([-1, 0, 0, 1, 0, 0, -1, 0.27, 0, 1, 0.27, 0, -1, 0.52, 0, 1, 0.52, 0, -1, 0.76, 0, 1, 0.76, 0, 0, 1, 0],
    [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7, 6, 7, 8]);
  GRASS.tplF = mk([-1, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
}
/* Masque des cases (25 cm) où l'herbe peut pousser : sol au niveau 0 (îles flottantes : le dessus des îles seulement, pas les ponts),
   sans obstacle posé (boîte de collision qui monte au-dessus du sol), ni rampe, ni eau (mer, bassins), ni sous un toit (volume
   d'occlusion opaque à moins de 6 m : les intérieurs) */
function grassMask() {
  const r = 4, x0 = MAP.x0, z0 = MAP.z0, W = Math.ceil((MAP.x1 - MAP.x0) * r), H = Math.ceil((MAP.z1 - MAP.z0) * r), m = new Uint8Array(W * H).fill(VOID.on ? 0 : 1);
  const fill = (ax, bx, az, bz, v) => {
    const i0 = Math.max(0, Math.floor((ax - x0) * r)), i1 = Math.min(W - 1, Math.ceil((bx - x0) * r) - 1), j0 = Math.max(0, Math.floor((az - z0) * r)), j1 = Math.min(H - 1, Math.ceil((bz - z0) * r) - 1);
    for (let j = j0; j <= j1; j++) m.fill(v, j * W + i0, j * W + i1 + 1);
  };
  if (VOID.on) for (const c of COL) if (!c.inv && Math.abs(c.y1) < 0.06 && c.y1 - c.y0 >= 1) fill(c.x0, c.x1, c.z0, c.z1, 1); // corps des îles (un tablier de pont est mince)
  for (const c of COL) if (!c.inv && c.y1 > 0.06 && c.y0 < 0.3) fill(c.x0 - 0.1, c.x1 + 0.1, c.z0 - 0.1, c.z1 + 0.1, 0);
  for (const rp of RAMPS) fill(rp.x0, rp.x1, rp.z0, rp.z1, 0);
  for (const o of OCC) if ((o.k === undefined ? 1 : o.k) >= 0.85 && o.y0 < 6 && o.y1 > 1) fill(o.x0, o.x1, o.z0, o.z1, 0);
  if (WATER.on || POOLS.length) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (m[k] && waterSurfaceAt(x0 + (i + 0.5) / r, z0 + (j + 0.5) / r) !== null) m[k] = 0; }
  for (const p of PONDS) { const b = new THREE.Box3().setFromObject(p.mesh); if (b.max.y > 0.25) fill(b.min.x, b.max.x, b.min.z, b.max.z, 0); } // vasques des fontaines
  return (x, z) => { const i = Math.floor((x - x0) * r), j = Math.floor((z - z0) * r); return i >= 0 && j >= 0 && i < W && j < H && m[j * W + i] === 1; };
}
/* Construit le gazon de la carte (après le décor et l'index des collisions) */
function grassBuild(G) {
  if (!G || GFX_SAFE || ULTRA) return;
  const t0 = performance.now(), ok = grassMask(), R = rngOf(G.seed || 5150), S = GRASS.size, step = 1 / Math.sqrt(G.dens || GRASS.dens), n1 = Math.round(S / step);
  grassTemplates(); GRASS.mat = grassMaterial(); GRASS.width = G.width || 0.012;
  GRASS.root = new THREE.Group(); GRASS.root.name = 'gazon'; GRASS.root.matrixAutoUpdate = false; GRASS.root.visible = false; MAPL.root.add(GRASS.root);
  let total = 0;
  for (let cz = Math.floor(MAP.z0 / S); cz * S < MAP.z1; cz++) for (let cx = Math.floor(MAP.x0 / S); cx * S < MAP.x1; cx++) {
    const x0 = cx * S, z0 = cz * S, b = [];
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const x = x0 + (i + R()) * step, z = z0 + (j + R()) * step;
      if (!ok(x, z)) continue;
      const d = G.density(x, z); if (d <= 0 || R() >= d) continue;
      b.push(x - x0, z - z0, G.height(x, z, R()), 0);
    }
    const n = b.length / 4; if (!n) continue;
    // mélange (Fisher-Yates) : les k premiers brins forment un échantillon uniforme de la tuile ; le rang décide de ceux qui restent au loin
    const a = new Float32Array(b);
    for (let i = n - 1; i > 0; i--) { const k = Math.floor(R() * (i + 1)); for (let c = 0; c < 4; c++) { const t = a[i * 4 + c]; a[i * 4 + c] = a[k * 4 + c]; a[k * 4 + c] = t; } }
    for (let i = 0; i < n; i++) a[i * 4 + 3] = (i + 0.5) / n;
    // demi-flottants (8 octets par brin) : x et z dans la tuile (8 m, à 4 mm près), hauteur, rang
    const hf = new Uint16Array(n * 4); for (let i = 0; i < n * 4; i++) hf[i] = THREE.DataUtils.toHalfFloat(a[i]);
    const attr = new THREE.InstancedBufferAttribute(hf, 4); attr.isFloat16BufferAttribute = true;
    const sph = new THREE.Sphere(new THREE.Vector3(x0 + S / 2, 0.4, z0 + S / 2), S * 0.75 + 1.2);
    const mesh = (tpl) => {
      const g = new THREE.InstancedBufferGeometry(); g.index = tpl.index; g.setAttribute('position', tpl.attributes.position); g.setAttribute('aGr', attr); g.instanceCount = 0; g.boundingSphere = sph;
      const o = new THREE.Mesh(g, GRASS.mat); o.position.set(x0, 0, z0); o.updateMatrix(); o.frustumCulled = false; o.matrixAutoUpdate = false; o.visible = false; o.castShadow = o.receiveShadow = false;
      o.userData.noAO = true; o.userData.noPrepass = true; GRASS.root.add(o); return o;
    };
    GRASS.chunks.push({ x0, z0, x1: x0 + S, z1: z0 + S, n, mN: mesh(GRASS.tplN), mF: mesh(GRASS.tplF), box: new THREE.Box3(new THREE.Vector3(x0 - 0.6, -0.2, z0 - 0.6), new THREE.Vector3(x0 + S + 0.6, 1.2, z0 + S + 0.6)) });
    total += n;
  }
  GRASS.bytes = total * 8;
  const C = G.colors || [[0.14, 0.27, 0.06], [0.42, 0.58, 0.16], [0.62, 0.58, 0.3]];
  GRASS_U.uGrC0.value.setRGB(sl(C[0][0]), sl(C[0][1]), sl(C[0][2])); GRASS_U.uGrC1.value.setRGB(sl(C[1][0]), sl(C[1][1]), sl(C[1][2])); GRASS_U.uGrC2.value.setRGB(sl(C[2][0]), sl(C[2][1]), sl(C[2][2]));
  const w = G.wind || [0.8, 0.6, 0.5], wl = hyp(w[0], w[1]) || 1; GRASS_U.uGrW.value.set(w[0] / wl, w[1] / wl, w[2], 0);
  GRASS.amb = G.amb !== undefined ? G.amb : 0.4;
  GRASS.blades = total; GRASS.on = total > 0; GRASS.ms = Math.round(performance.now() - t0);
}
function grassClear() {
  if (GRASS.tplN) { GRASS.tplN.dispose(); GRASS.tplF.dispose(); }
  Object.assign(GRASS, { on: false, chunks: [], root: null, mat: null, tplN: null, tplF: null, blades: 0, drawn: 0 });
}
/* À chaque image, la caméra placée : tuiles visibles, gabarit et nombre de brins selon la distance ; lumières de la carte */
function grassUpdate(t) {
  if (!GRASS.on) return;
  const q = RQ.q.grass, on = !!q && gfxSet('grass') !== false;
  GRASS.root.visible = on; if (!on) return;
  const [qd, far, near] = q, U = GRASS_U, p = camera.position;
  U.uGrT.value = t; U.uGrD.value.set(far, near, qd, GRASS.width); U.uGrL.value.copy(SUN_DIR);
  U.uGrP.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, VIEW.h * renderPixelRatio()); // angle d'un pixel
  const sl0 = csm ? csm.lights[0] : null;
  if (sl0) U.uGrSun.value.copy(sl0.color).multiplyScalar(sl0.intensity); else U.uGrSun.value.setRGB(0, 0, 0);
  U.uGrSky.value.copy(hemi.color).multiplyScalar(hemi.intensity); U.uGrGnd.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity);
  U.uGrAmb.value.copy(U.uGrSky.value).multiplyScalar(GRASS.amb);
  // cartes d'ombre des deux cascades proches : prêtes (texture de profondeur allouée) ou non
  const sh = CSM_HW.uniform.value, L = csm ? csm.lights : [];
  U.uGrShOn.value = sh[0] && sh[1] && L[1] && renderer.shadowMap.enabled ? 1 : 0;
  if (U.uGrShOn.value) { U.uGrSh0.value = sh[0]; U.uGrSh1.value = sh[1]; U.uGrShM0.value = L[0].shadow.matrix; U.uGrShM1.value = L[1].shadow.matrix; U.uGrShB.value = L[0].shadow.bias; }
  camera.updateMatrixWorld(); GRASS.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); GRASS.frustum.setFromProjectionMatrix(GRASS.pv);
  let drawn = 0;
  for (const c of GRASS.chunks) {
    const dx = Math.max(c.x0 - p.x, 0, p.x - c.x1), dz = Math.max(c.z0 - p.z, 0, p.z - c.z1), d = hyp3(dx, Math.max(0, p.y - 1), dz);
    const k = d < far && GRASS.frustum.intersectsBox(c.box) ? qd * (1 - 0.86 * smoothstep(near * 0.6, far, d)) : 0, n = Math.ceil(c.n * k), close = d < near;
    c.mN.visible = n > 0 && close; c.mF.visible = n > 0 && !close;
    if (n > 0) { (close ? c.mN : c.mF).geometry.instanceCount = n; drawn += n; }
  }
  GRASS.drawn = drawn;
}
