/* ==========================================================================
   EAU : la mer et les bassins d'une carte portuaire (Kervénec), avec leur shader dédié.
   - Plan d'eau sous le niveau des quais (WATER.y) : une grille fine (80 cm) le long de la côte, de plus en plus lâche
     vers le large, jusqu'à 900 m. Vagues de Gerstner calculées sur la carte graphique : clapot partout, houle au-delà
     de la digue (WATER.open), amorties contre les quais et les coques. Les mêmes vagues, calculées ici en JavaScript
     (waterHeight), font danser les canots (floatAdd).
   - Matière (waterMaterial) : MeshStandardMaterial retouchée par userData.patch, pour garder les ombres en cascade,
     le soleil et le brouillard du moteur. Le shader ajoute :
       · des rides en trois couches qui défilent (surface procédurale « ripple » du laboratoire de textures), fondues
         avec la distance (pas de scintillement au loin) ;
       · le reflet du ciel, rendu une fois au chargement dans une cube map à mipmaps (waterReady) : le ciel reflété
         est celui qu'on voit (dégradé, nuages, lueur du couchant), pas celui de l'éclairage HDRI ;
       · le reflet sombre des quais et coloré des coques tout près de l'eau : le rayon réfléchi avance dans le champ de
         distance aux obstacles (waterField) et les touche s'il passe sous leur arête ;
       · la lumière qui traverse les crêtes à contre-jour (diffusion, dans RE_Direct : elle suit donc les ombres) ;
       · l'écume : liseré qui lèche les quais et les coques, vagues qui battent la digue, moutons de la houle au large ;
       · le fond vu à travers l'eau claire (floor, abs) : le rayon réfracté descend jusqu'à un fond de sable qui n'est pas modélisé (plus
         profond à mesure qu'on s'éloigne des quais), ou bute sur le pied immergé d'un quai ou d'une coque (champ des obstacles) ; l'eau
         absorbe chaque couleur sur ce trajet (le rouge d'abord), et la lumière du soleil y dessine des caustiques. Une mer claire (Meltem)
         laisse voir son fond au pied des quais, une eau de port trouble (Kervénec) presque pas.
   - Le reste du jeu connaît l'eau : un tir y fait une gerbe (rayWorld, matière 'water'), une grenade y plonge et sa
     gerbe remplace la boule de feu, une arme lâchée y coule (groundHeight). Les bords de quai portent des murs
     invisibles (waterEdge) qui arrêtent les soldats mais pas les balles ni les grenades, et que les bots ne prennent
     pas pour des couverts.
   Tout appartient à la carte : maillage et matière sous sa racine, textures libérées avec la matière (MAT.water).
   ========================================================================== */
const WATER = {
  on: false, y: -1.5, floor: -7, land: [], box: [-1e4, 1e4, -1e4, 1e4], obs: [], floats: [], t: 0,
  open: [-150, -112], east: -16, F: null, dist: null, cube: null, mat: null, U: null,
};
/* Vagues : [direction de propagation (rad, 0 = vers +x), longueur d'onde (m), amplitude (m), raideur (déplacement
   horizontal en part de l'amplitude), groupe : 0 clapot (partout, amorti près des quais), 1 houle (au large)] */
const WAVES = [
  [0.35, 8.5, 0.045, 1.6, 0], [-0.45, 5.6, 0.03, 1.5, 0], [1.15, 3.6, 0.017, 1.2, 0], [-1.05, 2.4, 0.01, 1.0, 0],
  [0.08, 46, 0.4, 1.1, 1], [-0.22, 29, 0.22, 1.2, 1], [0.42, 18, 0.12, 1.3, 1], [-0.62, 11, 0.06, 1.2, 1],
];
const WAVES_C = WAVES.map(([a, L, A, Q, g], i) => { const k = TAU / L; return { dx: Math.cos(a), dz: Math.sin(a), k, A, Q, g, w: Math.sqrt(9.81 * k), ph: i * 1.7 }; });

/* ---------- Surface procédurale des rides (normales), motif d'écume (map.a) et caustiques (map.rgb) ----------
   Caustiques : réseau de lignes lumineuses fines et de leur halo (bords de cellules de Voronoï déformées, deux tailles), que les eaux
   lisent deux fois, à deux échelles qui défilent en sens contraires, et dont elles gardent le minimum : le réseau se défait et se
   refait sans cesse, comme la lumière du soleil au fond d'un bassin. */
Object.assign(TEXLAB, {
  ripple: [512, 83, 1.6, `
    vec2 ww = vec2(gfbm(uv, vec2(4.0), 3, 7.0), gfbm(uv + 0.37, vec2(4.0), 3, 8.0)) - 0.5;
    float w1 = gfbm(uv + ww * 0.09, vec2(5.0, 7.0), 5, 1.0), w2 = gfbm(uv - ww * 0.07, vec2(12.0, 9.0), 4, 2.0);
    float cr = 1.0 - abs(gfbm(uv + ww * 0.05, vec2(8.0, 11.0), 4, 3.0) * 2.0 - 1.0);
    h = w1 * 0.5 + w2 * 0.25 + cr * cr * 0.25;
    vec4 v1 = vor(uv + ww * 0.12, vec2(18.0), 4.0, 1.0), v2 = vor(uv + 0.5, vec2(37.0), 5.0, 1.0);
    float lines = (1.0 - smoothstep(0.02, 0.1, v1.w)) * 0.75 + (1.0 - smoothstep(0.02, 0.08, v2.w)) * 0.5;
    float blot = gfbm(uv, vec2(5.0), 4, 9.0);
    x = clamp(lines * smoothstep(0.3, 0.6, blot) + smoothstep(0.5, 0.75, blot) * 0.7, 0.0, 1.0);
    vec2 cw = vec2(gfbm(uv, vec2(3.0), 3, 21.0), gfbm(uv + 0.31, vec2(3.0), 3, 22.0)) - 0.5;
    vec4 c1 = vor(uv + cw * 0.16, vec2(7.0), 31.0, 1.0), c2 = vor(uv - cw * 0.1 + 0.27, vec2(12.0), 33.0, 1.0);
    float cs = exp(-c1.w * c1.w * 420.0) + exp(-c1.w * c1.w * 45.0) * 0.3 + exp(-c2.w * c2.w * 520.0) * 0.55 + exp(-c2.w * c2.w * 60.0) * 0.15;
    a = vec3(clamp(cs * 0.85, 0.0, 1.0)); r = 0.1;`],
});
TEXSCALE.ripple = 8; OPT_TEX.add('ripple');

/* ---------- Plan : terre, obstacles, bords ---------- */
/* Réglages de la carte : niveau de l'eau, zone où il peut y avoir de l'eau (box : x0, x1, z0, z1), limite de la houle
   (open : la houle est pleine à l'ouest de open[0], nulle à l'est de open[1]), bord est du plan d'eau (sous les quais) */
function waterSetup(o) {
  Object.assign(WATER, { on: true, y: o.y, floor: o.y - 5.5, box: o.box, open: o.open, east: o.east, land: [], obs: [], floats: [], F: null, dist: null });
}
/* Terre ferme (rectangle) : ni eau pour les tirs et les grenades, ni plan d'eau visible au-dessus d'elle */
function waterLand(x0, x1, z0, z1) { WATER.land.push([x0, x1, z0, z1]); }
/* Point (x, z) au-dessus de l'eau ? */
function waterAt(x, z) {
  const W = WATER, b = W.box;
  if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return false;
  for (const r of W.land) if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return false;
  return true;
}
/* Obstacle dans l'eau (quai, coque, digue, pieux) pour l'écume et les reflets : polygone [[x, z], ...] ou rectangle
   [x0, x1, z0, z1] ; h : hauteur au-dessus de l'eau (m) ; c : teinte sRGB de sa base ; foam : force de l'écume */
function waterObstacle(shape, h, c, foam = 1) {
  const poly = shape.length === 4 && typeof shape[0] === 'number' ? [[shape[0], shape[2]], [shape[1], shape[2]], [shape[1], shape[3]], [shape[0], shape[3]]] : shape;
  WATER.obs.push({ poly, h, c, foam });
}
/* Mur invisible au bord de l'eau : arrête les soldats (et les corps), laisse passer les balles et les grenades,
   n'est ni un couvert pour les bots ni une ombre pour l'éclairage cuit */
function waterEdge(x0, x1, z0, z1) {
  COL.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: WATER.y - 2, y1: WATER.y + 7.5, z0: Math.min(z0, z1), z1: Math.max(z0, z1), m: 'concrete', ray: false, noRay: true, inv: true });
}

/* ---------- Bassins praticables (étangs, ruisseaux, canaux) ----------
   Un bassin est un contour où l'on patauge : le fond des pieds y est à bed (m, négatif pour un étang creusé, 0 pour un ruisseau
   posé sur le sol) et l'eau à wl. groundHeight (02-map.js) rend le fond du bassin à la place du sol, rayWorld la surface de l'eau
   (gerbe des tirs), la navigation des bots passe par le fond, surfaceAt répond 'water' (pas dans l'eau). Se déclare par pondAdd (wade). */
const POOLS = [];
function poolAdd(poly, bed, wl) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  POOLS.push({ poly, bed, wl, x0, x1, z0, z1 });
}
function poolAt(x, z) {
  for (const p of POOLS) {
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    const P = p.poly; let inside = false;
    for (let a = 0, b = P.length - 1; a < P.length; b = a++) if ((P[a][1] > z) !== (P[b][1] > z) && x < ((P[b][0] - P[a][0]) * (z - P[a][1])) / (P[b][1] - P[a][1]) + P[a][0]) inside = !inside;
    if (inside) return p;
  }
  return null;
}
/* Niveau de l'eau sous le point (x, z) : la mer (au-dessus de son plan), un bassin, ou null s'il n'y a pas d'eau */
function waterSurfaceAt(x, z) {
  if (WATER.on && waterAt(x, z)) return WATER.y;
  if (POOLS.length) { const p = poolAt(x, z); if (p) return p.wl; }
  return null;
}

/* ---------- Vagues (JavaScript, mêmes formules que le shader, déplacement vertical seul) ---------- */
function waterCalm(x, z) {
  const F = WATER.F; if (!F) return 1;
  const i = Math.floor((x - F.x0) * F.ppm), j = Math.floor((z - F.z0) * F.ppm);
  if (i < 0 || j < 0 || i >= F.w || j >= F.h) return 1;
  return lerp(0.35, 1, smoothstep(0.5, 8, WATER.dist[j * F.w + i]));
}
function waterHeight(x, z, t) {
  const calm = waterCalm(x, z), open = 1 - smoothstep(WATER.open[0], WATER.open[1], x);
  let h = 0;
  for (const w of WAVES_C) {
    const a = w.A * (w.g ? open : calm); if (a < 1e-4) continue;
    h += a * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.ph);
  }
  return h;
}

/* ---------- Champ de distance aux obstacles (écume, reflets, amortissement des vagues) ----------
   2 pixels par mètre sur la zone portuaire. Chaque cellule retient la cellule d'obstacle la plus proche (propagation
   de vecteurs en deux passes) : distance, direction de l'obstacle, sa hauteur, sa teinte et la force de son écume. */
function waterField() {
  const W = WATER, F = { x0: -144, z0: -128, ppm: 2, w: 256, h: 512 }, N = F.w * F.h;
  const id = new Int16Array(N).fill(-1), sx = new Int16Array(N).fill(-1), sz = new Int16Array(N).fill(-1);
  W.obs.forEach((o, k) => {
    const P = o.poly; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const i0 = Math.max(0, Math.floor((x0 - F.x0) * F.ppm)), i1 = Math.min(F.w - 1, Math.ceil((x1 - F.x0) * F.ppm));
    const j0 = Math.max(0, Math.floor((z0 - F.z0) * F.ppm)), j1 = Math.min(F.h - 1, Math.ceil((z1 - F.z0) * F.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = F.x0 + (i + 0.5) / F.ppm, z = F.z0 + (j + 0.5) / F.ppm;
      let inside = false;
      for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
        if ((P[a][1] > z) !== (P[b][1] > z) && x < ((P[b][0] - P[a][0]) * (z - P[a][1])) / (P[b][1] - P[a][1]) + P[a][0]) inside = !inside;
      }
      if (inside) { const c = j * F.w + i; id[c] = k; sx[c] = i; sz[c] = j; }
    }
  });
  const d2 = (c, i, j) => (sx[c] < 0 ? 1e9 : (sx[c] - i) ** 2 + (sz[c] - j) ** 2);
  const take = (c, n, i, j) => { if (sx[n] >= 0 && d2(n, i, j) < d2(c, i, j)) { sx[c] = sx[n]; sz[c] = sz[n]; id[c] = id[n]; } };
  for (let j = 0; j < F.h; j++) {
    for (let i = 0; i < F.w; i++) { const c = j * F.w + i; if (i > 0) take(c, c - 1, i, j); if (j > 0) { take(c, c - F.w, i, j); if (i > 0) take(c, c - F.w - 1, i, j); if (i < F.w - 1) take(c, c - F.w + 1, i, j); } }
    for (let i = F.w - 2; i >= 0; i--) { const c = j * F.w + i; take(c, c + 1, i, j); }
  }
  for (let j = F.h - 1; j >= 0; j--) {
    for (let i = F.w - 1; i >= 0; i--) { const c = j * F.w + i; if (i < F.w - 1) take(c, c + 1, i, j); if (j < F.h - 1) { take(c, c + F.w, i, j); if (i < F.w - 1) take(c, c + F.w + 1, i, j); if (i > 0) take(c, c + F.w - 1, i, j); } }
    for (let i = 1; i < F.w; i++) { const c = j * F.w + i; take(c, c - 1, i, j); }
  }
  const a = new Uint8Array(N * 4), b = new Uint8Array(N * 4), dist = new Float32Array(N);
  for (let c = 0; c < N; c++) {
    const i = c % F.w, j = (c / F.w) | 0, o = c * 4;
    if (sx[c] < 0) { dist[c] = 16; a[o] = 255; a[o + 1] = a[o + 2] = 128; continue; }
    const dx = sx[c] - i, dz = sz[c] - j, l = hyp(dx, dz), d = l / F.ppm, ob = W.obs[id[c]];
    dist[c] = d;
    a[o] = Math.round(clamp(d / 16, 0, 1) * 255);
    a[o + 1] = Math.round(((l > 0 ? dx / l : 0) * 0.5 + 0.5) * 255); a[o + 2] = Math.round(((l > 0 ? dz / l : 0) * 0.5 + 0.5) * 255);
    a[o + 3] = Math.round(clamp(ob.h / 16, 0, 1) * 255);
    b[o] = Math.round(ob.c[0] * 255); b[o + 1] = Math.round(ob.c[1] * 255); b[o + 2] = Math.round(ob.c[2] * 255); b[o + 3] = Math.round(clamp(ob.foam, 0, 1) * 255);
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, F.w, F.h, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false;
    if (srgb) t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; return t;
  };
  W.F = F; W.dist = dist;
  return { field: tex(a, false), col: tex(b, true) };
}

/* ---------- Maillage : grille fine près de la côte, lâche au large ---------- */
function waterGeometry() {
  const W = WATER, xs = [], zp = [0];
  for (let x = W.east, s = 0.8; x > -900; x -= s) { xs.push(x); if (x < -72) s = Math.min(s * 1.07, 45); }
  xs.push(-900); xs.reverse();
  for (let z = 0, s = 0.8; z < 900;) { if (z > 75) s = Math.min(s * 1.07, 45); z = Math.min(900, z + s); zp.push(z); }
  const zs = zp.slice(1).map((v) => -v).reverse().concat(zp), nx = xs.length, nz = zs.length;
  const P = new Float32Array(nx * nz * 3), idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  for (let j = 0, o = 0; j < nz; j++) for (let i = 0; i < nx; i++, o += 3) { P[o] = xs[i]; P[o + 1] = W.y; P[o + 2] = zs[j]; }
  let k = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nx * nz * 3).fill(0), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/* ---------- Shader ---------- */
const WTR_VERT_HEAD = `#include <common>
uniform float uWTime; uniform vec4 uWv[8], uWw[8]; uniform vec2 uWOpen; uniform sampler2D tWField; uniform vec4 uWFieldB;
varying vec3 vWtr; varying vec3 vWtrN; varying float vWtrC;
/* vagues de Gerstner : position déplacée, normale, hauteur relative de la crête (-1 à 1) */
void wtrWaves(vec2 p, out vec3 P, out vec3 N, out float crest) {
  vec2 fuv = (p - uWFieldB.xy) * uWFieldB.zw;
  float d = (fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0) ? texture2D(tWField, fuv).r * 16.0 : 16.0;
  float calm = mix(0.35, 1.0, smoothstep(0.5, 8.0, d)), open = 1.0 - smoothstep(uWOpen.x, uWOpen.y, p.x);
  P = vec3(p.x, 0.0, p.y); float nx = 0.0, ny = 1.0, nz = 0.0, h = 0.0, am = 1e-4;
  for (int i = 0; i < 8; i++) {
    vec4 a = uWv[i], b = uWw[i];
    float A = a.w * (b.w > 0.5 ? open : calm);
    float th = a.z * dot(a.xy, p) - b.x * uWTime + b.z, s = sin(th), c = cos(th);
    P.x += b.y * A * a.x * c; P.z += b.y * A * a.y * c; P.y += A * s;
    nx -= a.x * a.z * A * c; nz -= a.y * a.z * A * c; ny -= b.y * a.z * A * s;
    h += A * s; am += A;
  }
  N = normalize(vec3(nx, ny, nz)); crest = h / am;
}`;
const WTR_FRAG_HEAD = `#include <common>
uniform float uWTime, uWReflI; uniform vec2 uWOpen; uniform sampler2D tWField, tWFieldC, tWRip, tWFoam; uniform vec4 uWFieldB;
uniform samplerCube tWRefl; uniform vec3 uWDeep, uWShallow, uWScat, uWFoamC, uWAmb, uWSunC, uWSunD, uWFloor, uWAbs, uWSand; uniform float uWCaus, uWFoamK;
varying vec3 vWtr; varying vec3 vWtrN; varying float vWtrC;
vec3 wtrN, wtrTr, wtrSand; float wtrFoam, wtrRough, wtrD, wtrCK; vec4 wtrF, wtrFC;`;
/* Couleur, normale et écume (à la place de color_fragment, avant la rugosité et la normale) */
const WTR_COLOR = `{
  vec3 V = cameraPosition - vWtr; float dist = length(V);
  vec2 fuv = (vWtr.xz - uWFieldB.xy) * uWFieldB.zw;
  bool inF = fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0;
  wtrF = inF ? texture2D(tWField, fuv) : vec4(1.0, 0.5, 0.5, 0.0); wtrFC = inF ? texture2D(tWFieldC, fuv) : vec4(0.0);
  wtrD = wtrF.r * 16.0;
  // rides : trois couches qui défilent, de moins en moins marquées avec la distance
  vec2 p = vWtr.xz, t = vec2(uWTime);
  vec3 r1 = texture2D(tWRip, p * 0.085 + t * vec2(0.011, 0.004)).xyz * 2.0 - 1.0;
  vec3 r2 = texture2D(tWRip, p.yx * 0.19 + t * vec2(-0.017, 0.021)).xyz * 2.0 - 1.0;
  vec3 r3 = texture2D(tWRip, p * 0.024 + t * vec2(0.0035, -0.002)).xyz * 2.0 - 1.0;
  float fade = 1.0 / (1.0 + dist * 0.03), calm = mix(0.55, 1.0, smoothstep(0.5, 6.0, wtrD));
  vec2 sl = (r1.xy / max(r1.z, 0.25) * 0.9 + r2.yx / max(r2.z, 0.25) * 0.55) * fade * calm + r3.xy / max(r3.z, 0.25) * 0.7 * (0.35 + 0.65 * fade);
  vec3 Nw = normalize(vWtrN);
  vec2 rps; float rpf, rph, rpl; ripple(vWtr.xz, rps, rpf, rph, rpl); // ondulations des soldats, des tirs et des explosions (02mb-ondes.js)
  wtrN = normalize(vec3(Nw.x / Nw.y + sl.x * 0.34 + rps.x * uRipG * 1.3, 1.0, Nw.z / Nw.y + sl.y * 0.34 + rps.y * uRipG * 1.3));
  // écume : liseré contre les quais et les coques, battement de la digue, moutons de la houle
  float pat = texture2D(tWFoam, p * 0.19 + t * vec2(0.006, 0.0015)).a, pat2 = texture2D(tWFoam, p * 0.07 - t * vec2(0.002, 0.004)).a;
  float k = wtrFC.a, open = 1.0 - smoothstep(uWOpen.x, uWOpen.y, vWtr.x);
  float shore = (1.0 - smoothstep(0.0, 0.25 + pat2 * 0.7 + k * 0.9, wtrD)) * k * uWFoamK;
  float lap = smoothstep(0.7, 1.0, sin(wtrD * 2.6 - uWTime * 1.4 + pat2 * 5.0)) * (1.0 - smoothstep(0.2, 1.0 + k * 1.6, wtrD)) * k * 0.35 * uWFoamK;
  float caps = smoothstep(0.55, 0.95, vWtrC) * open * smoothstep(0.35, 0.7, pat2);
  wtrFoam = clamp((shore + lap) * (pat * 1.5 - 0.15) + caps * pat * 0.9, 0.0, 1.0) * (0.45 + 0.55 * fade);
  wtrFoam = max(wtrFoam, clamp(rpf * (0.6 + pat * 0.5), 0.0, 1.0));
  // eau : vert-de-gris trouble près des quais, plus sombre et plus bleue au large
  vec3 body = mix(uWShallow, uWDeep, smoothstep(0.5, 9.0, wtrD)) * (0.9 + pat2 * 0.2);
  // le fond vu à travers l'eau (uWFloor : profondeur au pied des obstacles, au large, distance de l'une à l'autre ; x = 0 : pas de fond visible)
  wtrTr = vec3(0.0); wtrCK = 0.0; wtrSand = uWSand;
  if (uWFloor.x > 0.0) {
    vec3 Vn = normalize(V), T = refract(-Vn, normalize(mix(wtrN, vec3(0.0, 1.0, 0.0), 0.4)), 0.75);
    float D = mix(uWFloor.x, uWFloor.y, smoothstep(0.0, uWFloor.z, wtrD)), ty = max(-T.y, 0.25), tl = length(T.xz), L = D / ty;
    bool wall = false; vec3 hitC = uWSand;
    // le pied immergé d'un quai ou d'une coque : le rayon avance dans le champ des obstacles jusqu'à toucher l'un d'eux avant le fond
    if (wtrD < 6.0 && tl > 1e-3) {
      vec2 d2 = T.xz / tl; float s = 0.0, Dd = wtrD;
      for (int i = 0; i < 5; i++) {
        s += max(Dd, 0.2); float dep = s * ty / tl;
        if (dep > D) break;
        vec2 fuv = (vWtr.xz + d2 * s - uWFieldB.xy) * uWFieldB.zw;
        if (fuv.x < 0.0 || fuv.x > 1.0 || fuv.y < 0.0 || fuv.y > 1.0) break;
        Dd = texture2D(tWField, fuv).r * 16.0;
        if (Dd < 0.3) { L = dep / ty; hitC = texture2D(tWFieldC, fuv).rgb * vec3(0.55, 0.6, 0.55); wall = true; break; } // pierre un peu verdie sous l'eau
      }
    }
    wtrTr = exp(-uWAbs * L);
    vec2 fp = vWtr.xz + T.xz * L;
    if (!wall) { // sable : grain, taches, caustiques (deux lectures du réseau qui défilent)
      hitC *= 0.8 + texture2D(tWFoam, fp * 0.11).a * 0.35;
      float c1 = texture2D(tWFoam, fp * 0.21 + t * vec2(0.012, 0.007)).r, c2 = texture2D(tWFoam, fp.yx * 0.17 - t * vec2(0.009, 0.014) + 0.37).r, cn = (c1 + c2) * 0.5;
      wtrCK = cn * cn * 2.2 * uWCaus * exp(-D * 0.22);
    }
    float Fv = 0.02 + 0.98 * pow(1.0 - clamp(dot(Vn, wtrN), 0.0, 1.0), 5.0);
    wtrSand = hitC * (1.0 - Fv); wtrTr *= 1.0 - wtrFoam;
    body = body * (1.0 - wtrTr) + wtrSand * wtrTr;
  }
  diffuseColor.rgb = mix(body, uWFoamC, wtrFoam);
  wtrRough = mix(mix(0.02, 0.14, smoothstep(12.0, 220.0, dist)), 0.85, wtrFoam);
}`;
const WTR_ROUGH = 'float roughnessFactor = wtrRough;';
const WTR_NORMAL = 'normal = normalize((viewMatrix * vec4(normalize(mix(wtrN, vec3(0.0, 1.0, 0.0), wtrFoam * 0.7)), 0.0)).xyz);';
/* Lumière à contre-jour à travers les crêtes : ajoutée au soleil (et aux éclairs), donc éteinte à l'ombre */
const WTR_DIRECT = `#include <lights_physical_pars_fragment>
void RE_Direct_Water( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometry, material, reflectedLight );
  float back = saturate( dot( geometry.viewDir, - directLight.direction ) ), crest = saturate( vWtrC * 0.5 + 0.5 );
  float sss = ( pow( back, 4.0 ) * ( 0.12 + crest * crest * 1.1 ) + 0.02 ) * ( 1.0 - wtrFoam );
  reflectedLight.directDiffuse += directLight.color * uWScat * sss;
  reflectedLight.directDiffuse += directLight.color * wtrCK * wtrTr * wtrSand * 0.3 * saturate( dot( directLight.direction, geometry.normal ) ); // caustiques sur le fond
}
#undef RE_Direct
#define RE_Direct RE_Direct_Water`;
/* Reflets : ciel et lointain (cube map de la carte), quais et coques tout près (champ des obstacles) */
const WTR_REFL = `#if defined( RE_IndirectDiffuse ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
iblIrradiance += getIBLIrradiance( geometry.normal );
#endif
#if defined( RE_IndirectSpecular )
{
  vec3 V = normalize(cameraPosition - vWtr), Nw = normalize(mix(wtrN, vec3(0.0, 1.0, 0.0), wtrFoam * 0.7));
  vec3 R = reflect(-V, Nw); R.y = max(R.y, 0.012);
  vec3 env = textureLod(tWRefl, R, clamp(wtrRough * 9.0, 0.0, 6.0)).rgb * uWReflI;
  // rayon du reflet proche : normale de la seule houle, adoucie, pour une image des quais et des coques qui ondule
  // sans se déchirer en éclats
  vec3 Rh = reflect(-V, normalize(mix(normalize(vWtrN), vec3(0.0, 1.0, 0.0), 0.5))); Rh.y = max(Rh.y, 0.012);
  // le rayon réfléchi avance dans le champ de distance (pas égal à la distance libre) jusqu'à un obstacle : il le
  // touche s'il passe encore sous son sommet. Juste pour toute forme (coin de coque, bout de quai, pieu)
  float rl = length(Rh.xz);
  // (aucun obstacle ne dépasse 4,5 m au-dessus de l'eau : un rayon plus haut ne touche plus rien)
  if (rl > 1e-3 && wtrD < 12.0 && Rh.y / rl * wtrD < 4.5) {
    vec2 d2 = Rh.xz / rl; float rise = Rh.y / rl, s = 0.0, D = wtrD;
    for (int i = 0; i < 6; i++) {
      s += max(D, 0.25);
      if (s > 14.0 || rise * s > 4.5) break;
      vec2 fuv = (vWtr.xz + d2 * s - uWFieldB.xy) * uWFieldB.zw;
      if (fuv.x < 0.0 || fuv.x > 1.0 || fuv.y < 0.0 || fuv.y > 1.0) break;
      vec4 f = texture2D(tWField, fuv); D = f.r * 16.0;
      if (D < 0.3) {
        float H = f.a * 16.0, hy = rise * s;
        float hit = (1.0 - smoothstep(H * 0.75, H * 1.05, hy)) * (1.0 - smoothstep(9.0, 14.0, s));
        vec2 dir = f.gb * 2.0 - 1.0; vec2 dn = dot(dir, dir) > 0.1 ? normalize(dir) : d2;
        vec3 wn = -vec3(dn.x, 0.0, dn.y);
        vec3 lit = texture2D(tWFieldC, fuv).rgb * (uWAmb + uWSunC * max(dot(wn, uWSunD), 0.0) * 0.32) * (0.75 + 0.25 * smoothstep(0.0, H, hy));
        env = mix(env, lit, hit);
        break;
      }
    }
  }
  radiance += env;
}
#endif`;
function waterPatch(s) {
  Object.assign(s.uniforms, WATER.U, RIP.U);
  s.vertexShader = s.vertexShader.replace('#include <common>', WTR_VERT_HEAD)
    .replace('#include <beginnormal_vertex>', 'vec3 wtrP, wtrNv; float wtrC; wtrWaves(position.xz, wtrP, wtrNv, wtrC);\nvec3 objectNormal = wtrNv;')
    .replace('#include <begin_vertex>', 'vec3 transformed = vec3(wtrP.x, position.y + wtrP.y, wtrP.z);')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWtr = (modelMatrix * vec4(transformed, 1.0)).xyz; vWtrN = wtrNv; vWtrC = wtrC;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', WTR_FRAG_HEAD + RIP_GLSL).replace('#include <color_fragment>', WTR_COLOR)
    .replace('#include <roughnessmap_fragment>', WTR_ROUGH).replace('#include <normal_fragment_maps>', WTR_NORMAL)
    .replace('#include <lights_physical_pars_fragment>', WTR_DIRECT).replace('#include <lights_fragment_maps>', WTR_REFL);
}
/* Matière de l'eau ; couleurs de la carte (linéaires) : deep, shallow, scatter, foam ; le fond vu au travers : floor ([profondeur au pied des
   obstacles, au large, distance de l'une à l'autre], m ; sans : pas de fond visible), abs (absorption par mètre de chaque couleur), sand (albédo
   du fond), caus (caustiques) ; foamK : force du liseré d'écume contre les quais */
function waterMaterial(field, o) {
  const A = CURMAP.def.atmo, lin = (h) => new THREE.Color(h).convertSRGBToLinear();
  const hemi = lin(A.hemi[0]), sun = lin(A.sunColor);
  WATER.U = {
    uWTime: { value: 0 }, uWReflI: { value: o.refl || 1 }, uWOpen: { value: new THREE.Vector2(...WATER.open) },
    uWv: { value: WAVES_C.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.A)) }, uWw: { value: WAVES_C.map((w) => new THREE.Vector4(w.w, w.Q, w.ph, w.g)) },
    tWField: { value: field.field }, tWFieldC: { value: field.col }, uWFieldB: { value: new THREE.Vector4(WATER.F.x0, WATER.F.z0, 1 / (WATER.F.w / WATER.F.ppm), 1 / (WATER.F.h / WATER.F.ppm)) },
    tWRip: { value: TEX.ripple.normal }, tWFoam: { value: TEX.ripple.map }, tWRefl: { value: null },
    uWDeep: { value: new V3(...o.deep) }, uWShallow: { value: new V3(...o.shallow) }, uWScat: { value: new V3(...o.scatter) }, uWFoamC: { value: new V3(...o.foam) },
    uWAmb: { value: new V3(hemi.r, hemi.g, hemi.b).multiplyScalar(A.hemi[2] * 0.9) }, uWSunC: { value: new V3(sun.r, sun.g, sun.b).multiplyScalar(A.sunI) }, uWSunD: { value: SUN_DIR },
    uWFloor: { value: new V3(...(o.floor || [0, 0, 1])) }, uWAbs: { value: new V3(...(o.abs || [1, 1, 1])) }, uWSand: { value: new V3(...(o.sand || [0.5, 0.45, 0.35])) },
    uWCaus: { value: o.caus || 0 }, uWFoamK: { value: o.foamK !== undefined ? o.foamK : 1 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, envMapIntensity: 1 });
  m.defines = { WATER: '' };
  m.userData.patch = waterPatch; m.onBeforeCompile = waterPatch;
  m.userData.noShadow = true; m.userData.noAO = true;
  m.userData.own = [field.field, field.col];
  return m;
}

/* ---------- Construction (après le décor : les obstacles sont posés) ---------- */
function waterBuild(o) {
  rippleEnsure();
  const field = waterField();
  // cube map des reflets du ciel, rendue par waterReady une fois l'éclairage de la carte en place
  const rt = new THREE.WebGLCubeRenderTarget(o.cube || 256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  rt.texture.userData.rt = rt; WATER.cube = rt;
  const m = waterMaterial(field, o); MAT.water = m; WATER.mat = m;
  m.userData.own.push(rt.texture);
  WATER.U.tWRefl.value = rt.texture;
  const mesh = new THREE.Mesh(waterGeometry(), m);
  mesh.name = 'map:water'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  mesh.userData.noPrepass = true; mesh.userData.noAO = true; mesh.frustumCulled = false;
  mapAdd(mesh); WATER.mesh = mesh;
}
/* Calque des objets reflétés par l'eau (le ciel) pendant le rendu de la cube map */
const LAYER_REFL = 5;
/* Cube map des reflets : le ciel vu depuis l'avant-port, à ras de l'eau. Le décor n'y entre pas : vu d'un seul point,
   il se refléterait au mauvais endroit (les quais et les coques ont leur propre reflet, voir WTR_REFL). Le disque du
   soleil en est retiré (le soleil se reflète déjà par la lumière directe, avec ses ombres) */
function waterReady(o = {}) {
  if (!WATER.cube) return;
  const cc = new THREE.CubeCamera(0.5, 1200, WATER.cube), p = new V3(...(o.from || [-70, WATER.y + 2.5, 0]));
  cc.position.copy(p); cc.updateMatrixWorld(true);
  for (const c of cc.children) c.layers.set(LAYER_REFL);
  sky.layers.enable(LAYER_REFL);
  const sp = sky.position.clone(), disk = SkyShader.uniforms.uDisk.value.clone();
  sky.position.copy(p); sky.updateMatrixWorld(); SkyShader.uniforms.uDisk.value.set(0, 0, 0);
  // chaque face est effacée avant son rendu
  const sm = renderer.shadowMap.needsUpdate, ac = renderer.autoClear; renderer.shadowMap.needsUpdate = false; renderer.autoClear = true;
  try { cc.update(renderer, scene); } finally {
    renderer.shadowMap.needsUpdate = sm; renderer.autoClear = ac; SkyShader.uniforms.uDisk.value.copy(disk); sky.position.copy(sp); sky.updateMatrixWorld();
    sky.layers.disable(LAYER_REFL);
  }
}

/* ---------- Objets flottants (canots, voiliers au mouillage) ----------
   Un prefab devient un groupe de maillages (un seul par matière, classes de détail confondues : chaque maillage coûte
   un appel de rendu par passe) que les vagues soulèvent et balancent. Sans collision : à réserver à ce que les
   soldats ne peuvent pas atteindre. Au loin (arrière-plan), ni ombre ni pré-passe : quelques pixels à l'écran.
   o : draft (enfoncement, m), L et B (longueur et largeur sur lesquelles on mesure la pente des vagues), roll
   (balancement propre, rad) */
function floatAdd(pf, x, z, ry, o = {}) {
  const g = new THREE.Group(); g.matrixAutoUpdate = false; g.name = 'flotteur:' + pf.name;
  const far = Math.abs(x) > CHUNK_NEAR.x || Math.abs(z) > CHUNK_NEAR.z, byMat = new Map();
  for (const part of pf.parts.values()) {
    if (!part.g.nv || !MAT[part.mat]) continue;
    let e = byMat.get(part.mat); if (!e) byMat.set(part.mat, e = { parts: [], cls: 9 });
    e.parts.push(part.g); e.cls = Math.min(e.cls, part.cls);
  }
  for (const [name, e] of byMat) {
    const mat = MAT[name]; let gb = e.parts[0];
    if (e.parts.length > 1) { gb = new GeoBuf(256, 512, LIVING.has(name)); for (const p of e.parts) gb.append(p); }
    const mesh = new THREE.Mesh(gb.geometry(), mat);
    mesh.matrixAutoUpdate = false; mesh.castShadow = !far && e.cls === 0 && !mat.userData.noShadow; mesh.receiveShadow = !mat.userData.noReceive;
    if (far || e.cls > 0 || NEAR_SHADOW.has(name)) { mesh.userData.noPrepass = true; if (mesh.castShadow) mesh.layers.set(LAYER_NEAR); }
    if (mat.userData.noAO) mesh.userData.noAO = true;
    g.add(mesh);
  }
  mapAdd(g);
  const R = rngOf(Math.round(x * 31 + z * 17) + 77);
  WATER.floats.push({ g, x, z, ry, draft: o.draft || 0, L: o.L || 4, B: o.B || 1.6, roll: o.roll !== undefined ? o.roll : 0.03, ph: R() * TAU, f: R.range(0.55, 0.85) });
}
const _wq = new THREE.Quaternion(), _we = new THREE.Euler(0, 0, 0, 'YXZ'), _wp = new V3(), _ws = new V3(1, 1, 1);
function waterUpdate(t) {
  if (!WATER.on || !WATER.U) return;
  WATER.t = t; WATER.U.uWTime.value = t;
  for (const f of WATER.floats) {
    const c = Math.cos(f.ry), s = Math.sin(f.ry), hl = f.L / 2, hb = f.B / 2;
    const hf = waterHeight(f.x + s * hl, f.z + c * hl, t), ha = waterHeight(f.x - s * hl, f.z - c * hl, t);
    const hp = waterHeight(f.x + c * hb, f.z - s * hb, t), hs = waterHeight(f.x - c * hb, f.z + s * hb, t);
    _wp.set(f.x, WATER.y + (hf + ha + hp + hs) / 4 - f.draft, f.z);
    _we.set(-Math.atan2(hf - ha, f.L) + Math.sin(t * f.f * 1.3 + f.ph) * f.roll * 0.4, f.ry, Math.atan2(hp - hs, f.B) + Math.sin(t * f.f + f.ph) * f.roll);
    f.g.matrix.compose(_wp, _wq.setFromEuler(_we), _ws); f.g.matrixWorldNeedsUpdate = true;
  }
}
/* Nouvelle carte ou déchargement : l'état de l'eau repart de zéro (maillage et textures partent avec la carte) */
function waterUnload() {
  for (const rt of WPROBES) rt.dispose(); WPROBES.length = 0;
  Object.assign(WATER, { on: false, land: [], obs: [], floats: [], F: null, dist: null, cube: null, mat: null, U: null, mesh: null });
  POOLS.length = 0; PONDAREAS.length = 0; rippleUnload();
}

/* ==========================================================================
   PETITES EAUX : fontaines, bassins, canaux, ruisseaux, étangs, abreuvoirs, flaques. RÈGLE DU DÉCOR : toute eau, si petite soit-elle, se pose
   avec pondAdd (jamais une face 'glass' ou une teinte plate) pour avoir le même rendu que la mer. Le shader rend l'eau comme une eau :
   - transparente selon sa profondeur : le fond est à bed m sous la surface (le fond du bassin où l'on patauge, sinon une profondeur
     donnée), les berges descendent en pente slope depuis le bord (aRim : distance au bord) ; le long du rayon réfracté, le corps de l'eau
     devient opaque sur vis m (Beer-Lambert), teinté de shallow à deep ; on voit donc le vrai fond (gravier, sable, dalles) là où l'eau
     est mince, et l'eau se fond dans la berge au lieu de la couper net ;
   - Fresnel : rendue en alpha prémultiplié, l'eau laisse passer le fond pour (1 - Fresnel) x (1 - opacité) et ajoute son reflet par-dessus,
     si bien que le reflet reste franc de biais quand on voit le fond en regardant vers le bas ;
   - le reflet du décor (waterProbes) : une cube map rendue au chargement autour de l'eau (arbres, murs, pont, palmiers), recalée sur une
     boîte (parallaxe) ; à défaut (flaques, puits, appareil fragile), le ciel de la carte ;
   - les caustiques : la lumière du soleil concentrée par les rides dessine sur le fond un réseau qui ondule (motif de la surface
     « ripple » lu au point du fond que touche le rayon réfracté, deux fois, à deux échelles qui défilent), resserré et déplacé par les
     ondulations du champ d'ondes (02mb-ondes.js : une bosse fait lentille), éteint à l'ombre comme le reste de la lumière du soleil ;
   - rides qui défilent, lumière qui traverse l'eau à contre-jour, liseré d'écume contre la margelle (shore), anneaux d'un jet (jet).
   Une flaque (shape 'blob') est la même eau en nappe très mince et sombre (murk), sans caustiques ni reflet du décor.
   Une eau = un maillage et une matière à elle (libérés avec la carte) ; la texture 'ripple' doit figurer dans `textures` de la carte.
   ========================================================================== */
const PONDS = [];
const PONDAREAS = []; // eaux surélevées (fontaines) : surface où un tir fait gerbe et ondulations, sous le couvercle de collision du bassin
const POND_VERT_HEAD = `#include <common>
attribute float aRim; varying float vRim; varying vec3 vPw;`;
const POND_FRAG_HEAD = `#include <common>
uniform float uPT, uPRing, uPFoam, uPAlpha, uPTone, uPBed, uPSlope, uPVis, uPMurk, uPCaus, uPCalm; uniform vec2 uPC, uPFlow; uniform vec3 uPDeep, uPShal, uPScat;
uniform vec4 uPProbe; uniform vec3 uPBoxA, uPBoxB; uniform sampler2D tPRip, tPFoam; uniform samplerCube tPRefl;
varying float vRim; varying vec3 vPw; vec3 pdN, pdUp, pdCL; float pdFoam, pdA, pdF, pdK;`;
const POND_COLOR = `{
  vec2 p = vPw.xz - uPFlow * uPT, t = vec2(uPT);
  vec3 r1 = texture2D(tPRip, p * 0.9 + t * vec2(0.03, 0.012)).xyz * 2.0 - 1.0;
  vec3 r2 = texture2D(tPRip, p.yx * 1.7 + t * vec2(-0.045, 0.05)).xyz * 2.0 - 1.0;
  vec3 r3 = texture2D(tPRip, p * 0.35 + t * vec2(0.01, -0.007)).xyz * 2.0 - 1.0;
  vec2 sl = (r1.xy / max(r1.z, 0.25) * 0.42 + r2.yx / max(r2.z, 0.25) * 0.3 + r3.xy / max(r3.z, 0.25) * 0.4) * uPCalm; // eau dormante : rides faibles, reflet net
  vec2 dv = vPw.xz - uPC; float rr = length(dv);
  float ring = uPRing * cos(rr * 15.0 - uPT * 3.4) * exp(-rr * 1.4) / (1.0 + rr * 2.0);
  sl += dv / max(rr, 1e-3) * ring * 0.8;
  vec2 rps; float rpf, rph, rpl; ripple(vPw.xz, rps, rpf, rph, rpl); // ondulations des soldats, des tirs et des explosions (02mb-ondes.js)
  pdN = normalize(vec3(sl.x * 0.5 + rps.x * uRipG, 1.0, sl.y * 0.5 + rps.y * uRipG));
  float pat = texture2D(tPFoam, p * 0.8 + t * vec2(0.008, 0.002)).a, pat2 = texture2D(tPFoam, p * 0.3 - t * vec2(0.003, 0.005)).a;
  float shore = (1.0 - smoothstep(0.0, 0.05 + pat2 * 0.09, vRim)) * uPFoam;
  pdFoam = clamp(max(shore * (pat * 1.5 - 0.1), rpf * 0.28 * (0.5 + pat)), 0.0, 0.4); // hors de la mer : pas de blanc, seulement l'eau qui s'éclaircit dans la gerbe
  // profondeur sous ce point (fond plat à uPBed, berges en pente uPSlope depuis le bord), rayon réfracté (air vers eau), trajet dans l'eau
  vec3 V = normalize(cameraPosition - vPw), T = refract(-V, pdN, 0.75);
  float dep = min(uPBed, vRim * uPSlope), cosT = max(-T.y, 0.3), L = dep / cosT;
  // opacité du corps de l'eau : Beer-Lambert sur uPVis m, un minimum pour une eau trouble (uPMurk), plafonnée (uPAlpha), nulle au ras du bord
  pdA = clamp(max(1.0 - exp(-L / uPVis), uPMurk) * uPAlpha, 0.0, 1.0) * smoothstep(0.0, 0.03, vRim);
  // Fresnel de l'eau (Schlick, 0,03 de face) sur la normale ridée
  pdF = 0.03 + 0.97 * pow(1.0 - clamp(dot(V, pdN), 0.0, 1.0), 5.0);
  // caustiques au point du fond que touche le rayon réfracté : deux lectures du réseau qui défilent en sens contraires, mêlées puis
  // resserrées ; la courbure des ondulations les concentre (une bosse fait lentille), elles pâlissent avec la profondeur
  vec2 bp = vPw.xz + T.xz / cosT * dep - uPFlow * uPT * 0.6;
  float c1 = texture2D(tPFoam, bp * 0.47 + t * vec2(0.019, 0.011)).r, c2 = texture2D(tPFoam, bp.yx * 0.39 - t * vec2(0.014, 0.022) + 0.37).r;
  float cn = (c1 + c2) * 0.5;
  pdK = cn * cn * 2.2 * clamp(1.0 - rpl * dep * 0.25, 0.5, 2.0) * uPCaus * smoothstep(0.0, 0.06, dep) * exp(-dep * 1.6 - dep / uPVis);
  pdCL = vec3(0.0); pdUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 body = mix(uPShal, uPDeep, pdA) * (0.9 + pat2 * 0.2) * uPTone;
  diffuseColor.rgb = mix(body, body * 3.0 + vec3(0.03, 0.04, 0.04), pdFoam * 2.0);
}`;
const POND_DIRECT = `#include <lights_physical_pars_fragment>
void RE_Direct_Pond( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometry, material, reflectedLight );
  float back = saturate( dot( geometry.viewDir, - directLight.direction ) );
  reflectedLight.directDiffuse += directLight.color * uPScat * ( pow( back, 4.0 ) * 0.5 + 0.05 ) * ( 1.0 - pdFoam );
  pdCL += directLight.color * saturate( dot( directLight.direction, pdUp ) ); // la lumière qui atteint le fond (caustiques), à l'ombre comme le reste
}
#undef RE_Direct
#define RE_Direct RE_Direct_Pond`;
/* Reflet : la cube map du décor autour de l'eau, recalée sur sa boîte (le point de la boîte que touche le rayon réfléchi, vu depuis la sonde),
   à défaut le ciel (cube map d'ambiance, 01-core.js) ; sans elle (WebGL 1), le reflet de three.js */
const POND_REFL = `#if defined( RE_IndirectDiffuse ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
iblIrradiance += getIBLIrradiance( geometry.normal );
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
#ifdef POND_CUBE
{
  vec3 V = normalize(cameraPosition - vPw), R = reflect(-V, pdN); R.y = max(R.y, 0.015);
  vec3 dir = R;
  if (uPProbe.w > 0.5) { vec3 ta = (uPBoxB - vPw) / R, tb = (uPBoxA - vPw) / R, tf = max(ta, tb); dir = vPw + R * min(min(tf.x, tf.y), tf.z) - uPProbe.xyz; }
  radiance += textureLod(tPRefl, dir, uPProbe.w > 0.5 ? 0.7 : 0.0).rgb * envMapIntensity;
}
#else
radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );
#endif
#endif`;
/* Sortie en alpha prémultiplié : le fond passe pour (1 - Fresnel) x (1 - opacité) ; s'y ajoutent le corps de l'eau, les caustiques sur le fond
   (albédo du fond pris à 0,45) et le reflet. Le brouillard couvre l'eau et le fond vu au travers dans la même proportion. */
const POND_OUT = `float pdO = max(pdA, pdFoam * 2.0), pdT = (1.0 - pdF) * (1.0 - pdO);
gl_FragColor = vec4((totalDiffuse * pdO + pdCL * pdK * 0.045 * (1.0 - pdO)) * (1.0 - pdF) + totalSpecular + totalEmissiveRadiance, 1.0 - pdT);`;
const POND_FOG = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = fogPath( fogDensity * vFogDepth ); // brouillard allégé en altitude, lueur du soleil (01-core.js)
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint( fogColor ) * gl_FragColor.a, fogFactor );
#endif`;
function pondPatch(s, U) {
  Object.assign(s.uniforms, U, RIP.U);
  s.vertexShader = s.vertexShader.replace('#include <common>', POND_VERT_HEAD)
    .replace('#include <project_vertex>', '#include <project_vertex>\nvRim = aRim; vPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  s.fragmentShader = (ENVC.on ? '#define POND_CUBE\n' : '') + s.fragmentShader.replace('#include <common>', POND_FRAG_HEAD + RIP_GLSL).replace('#include <color_fragment>', POND_COLOR)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.035, 0.7, pdFoam);')
    .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(pdN, 0.0)).xyz);')
    .replace('#include <lights_physical_pars_fragment>', POND_DIRECT).replace('#include <lights_fragment_maps>', POND_REFL)
    .replace('#include <output_fragment>', POND_OUT).replace('#include <fog_fragment>', POND_FOG);
}
/* Maillage plat d'une eau : sommets locaux autour de (0, 0, 0), distance au bord (m) dans aRim. disc : r, seg, rings ;
   rect : w, d, n ; blob : w, d, seed (nappe irrégulière) */
function pondGeometry(o) {
  const P = [], I = [], E = [];
  const rings = o.rings || 6, seg = o.seg || 24;
  if (o.shape === 'rect') {
    const nx = o.n || 8, nz = Math.max(2, Math.round(nx * o.d / o.w));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * o.w, z = (j / nz - 0.5) * o.d;
      P.push(x, 0, z); E.push(Math.max(0, Math.min(o.w / 2 - Math.abs(x), o.d / 2 - Math.abs(z))));
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  } else if (o.shape === 'poly') {
    // contour libre (points locaux [x, z]) : grille régulière dont les sommets hors du contour sont ramenés sur lui ; aRim = distance au bord
    const Q = o.poly, st = o.cell || 0.5; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of Q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const nx = Math.ceil((x1 - x0) / st) + 1, nz = Math.ceil((z1 - z0) / st) + 1, sd = new Float32Array(nx * nz), idx = new Int32Array(nx * nz).fill(-1);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) sd[j * nx + i] = polyDist(Q, x0 + i * st, z0 + j * st);
    const vert = (i, j) => {
      const k = j * nx + i; if (idx[k] >= 0) return idx[k];
      let x = x0 + i * st, z = z0 + j * st, d = sd[k];
      if (d < 0) { const q = polyNearest(Q, x, z); x = q[0]; z = q[1]; d = 0; }
      P.push(x, 0, z); E.push(d); return (idx[k] = P.length / 3 - 1);
    };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const c = [sd[j * nx + i], sd[j * nx + i + 1], sd[(j + 1) * nx + i], sd[(j + 1) * nx + i + 1]];
      if (Math.max(...c) <= 0) continue; // cellule entièrement dehors
      const a = vert(i, j), b = vert(i + 1, j), cc = vert(i, j + 1), d = vert(i + 1, j + 1);
      I.push(a, cc, b, b, cc, d);
    }
  } else {
    const blob = o.shape === 'blob', R = rngOf((o.seed || 1) * 31 + 7), ph = [R() * TAU, R() * TAU, R() * TAU];
    const rx = blob ? o.w / 2 : o.r, rz = blob ? o.d / 2 : o.r, rmin = Math.min(rx, rz) * (blob ? 0.8 : 1);
    P.push(0, 0, 0); E.push(rmin);
    for (let k = 1; k <= rings; k++) {
      const f = k / rings;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * TAU, wob = blob ? 1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.1 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(7 * a + ph[2]) : 1;
        P.push(Math.cos(a) * rx * f * wob, 0, Math.sin(a) * rz * f * wob); E.push((1 - f) * rmin * (blob ? 1 : 1) );
      }
    }
    for (let i = 0; i < seg; i++) I.push(0, 1 + (i + 1) % seg, 1 + i);
    for (let k = 1; k < rings; k++) for (let i = 0; i < seg; i++) {
      const a = 1 + (k - 1) * seg + i, b = 1 + (k - 1) * seg + (i + 1) % seg, c = 1 + k * seg + i, d = 1 + k * seg + (i + 1) % seg;
      I.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aRim', new THREE.Float32BufferAttribute(E, 1));
  g.setIndex(I); g.computeBoundingSphere();
  return g;
}
/* Pose une eau. o : shape ('disc' : r, seg ; 'rect' : w, d ; 'poly' : contour ; 'blob' : w, d, seed), x, y, z (centre, y = surface), rot ;
   l'eau elle-même : bed (profondeur du fond sous la surface, m ; par défaut celle du bassin où l'on patauge, sinon depth), slope (pente des
   berges depuis le bord, 4 par défaut : un bassin à margelle ; moins pour une berge naturelle), vis (distance sur laquelle l'eau devient
   opaque, m), murk (opacité minimale : eau trouble, puits), alpha (opacité maximale), deep / shallow / scatter (couleurs linéaires du corps de
   l'eau, de la mince à l'épaisse, et de la lumière qui la traverse), tone (clarté de ces couleurs, 0,2 par défaut), caus (force des
   caustiques, 1), calm (force des rides : 1, moins pour une eau dormante qui reflète net) ; shore (liseré d'écume contre la margelle, 0 par défaut : hors de la mer, l'eau n'a pas d'écume), jet (anneaux d'un jet au
   centre, 0 à 1), flow (courant, m/s), wade (niveau du fond où l'on patauge) ; reflet du décor : probe (faux : le ciel seul), probeAt
   (point de la sonde), probeBox (boîte de parallaxe [x0, y0, z0, x1, y1, z1]) */
function pondAdd(o) {
  rippleEnsure();
  // eau où l'on patauge (o.wade : niveau du fond, 0 pour un ruisseau posé sur le sol) : contour en coordonnées du monde, avant tout recentrage
  if (o.wade !== undefined) {
    let wp = null;
    if (o.shape === 'poly') wp = o.poly;
    else if (o.shape === 'rect') { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0); wp = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.x + (a * o.w / 2) * c - (b * o.d / 2) * s, o.z + (a * o.w / 2) * s + (b * o.d / 2) * c]); }
    if (wp) poolAdd(wp, o.wade, o.y);
  }
  if (o.shape === 'poly') { // le maillage est local autour du centre de la boîte du contour
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of o.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; o = Object.assign({}, o, { x: cx, z: cz, poly: o.poly.map(([x, z]) => [x - cx, z - cz]) });
  }
  const puddle = o.shape === 'blob', carved = o.wade !== undefined ? o.y - o.wade : 0;
  const bed = o.bed !== undefined ? o.bed : puddle ? 0.03 : carved > 0.1 ? carved : (o.depth || 0.5);
  // uPFoam : liseré d'écume au bord, nul hors de la mer (o.shore pour en remettre un)
  const U = {
    uPT: { value: 0 }, uPRing: { value: o.jet || 0 }, uPFoam: { value: o.shore || 0 }, uPAlpha: { value: o.alpha || 1 }, uPTone: { value: o.tone !== undefined ? o.tone : 0.2 },
    uPBed: { value: bed }, uPSlope: { value: o.slope || 4 }, uPVis: { value: o.vis || (puddle ? 0.2 : 0.7) }, uPMurk: { value: o.murk !== undefined ? o.murk : puddle ? 0.35 : 0 }, uPCaus: { value: o.caus !== undefined ? o.caus : puddle ? 0 : 1 }, uPCalm: { value: o.calm !== undefined ? o.calm : puddle ? 0.2 : 1 },
    uPC: { value: new THREE.Vector2(...(o.jc || [o.x, o.z])) }, uPFlow: { value: new THREE.Vector2(...(o.flow || [0, 0])) }, uPDeep: { value: new V3(...(o.deep || [0.006, 0.03, 0.04])) }, uPShal: { value: new V3(...(o.shallow || [0.025, 0.085, 0.09])) },
    uPScat: { value: new V3(...(o.scatter || [0.008, 0.04, 0.04])) }, tPRip: { value: TEX.ripple.normal }, tPFoam: { value: TEX.ripple.map },
    tPRefl: { value: null }, uPProbe: { value: new THREE.Vector4(0, 0, 0, 0) }, uPBoxA: { value: new V3() }, uPBoxB: { value: new V3() },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, envMapIntensity: puddle ? 1.1 : 0.62 });
  m.defines = { POND: '' };
  m.userData.patch = (s) => pondPatch(s, U); m.onBeforeCompile = m.userData.patch;
  m.userData.noShadow = true; m.userData.noAO = true;
  // alpha prémultiplié (voir POND_OUT) ; dessinée avant les autres objets transparents (gerbes, fumées : par-dessus l'eau)
  Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  if (puddle) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  const geo = pondGeometry(o), mesh = new THREE.Mesh(geo, m);
  mesh.name = 'map:pond'; mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.rot || 0; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = -1;
  mesh.userData.noPrepass = true; mesh.userData.noAO = true;
  mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  geo.computeBoundingBox(); const wb = geo.boundingBox.clone().applyMatrix4(mesh.matrix);
  mapAdd(mesh);
  PONDS.push({ U, mesh, y: o.y, b: [wb.min.x, wb.min.z, wb.max.x, wb.max.z], probe: o.probe !== undefined ? o.probe : !puddle && !(o.murk >= 1), at: o.probeAt, box: o.probeBox });
  if (o.wade === undefined && o.y > 0.3) { // fontaine : le bassin est plein de collision (on n'y entre pas), mais un tir qui s'y plante touche l'eau
    const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    let inside;
    if (o.shape === 'disc') { const r = o.r * 0.97; inside = (x, z) => (x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < r * r; }
    else if (o.shape === 'rect') inside = (x, z) => { const dx = x - o.x, dz = z - o.z, lx = dx * c + dz * s, lz = -dx * s + dz * c; return Math.abs(lx) < o.w / 2 && Math.abs(lz) < o.d / 2; };
    else inside = (x, z) => { const poly = o.poly.map(([a, b]) => [a + o.x, b + o.z]); let n = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > z) !== (poly[j][1] > z) && x < ((poly[j][0] - poly[i][0]) * (z - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) n = !n; return n; };
    PONDAREAS.push({ y: o.y, inside });
  }
  if (o.jet > 0) AMBW.push({ x: o.jc ? o.jc[0] : o.x, y: o.y, z: o.jc ? o.jc[1] : o.z }); // fontaine : source sonore d'ambiance (05c-ambiance.js)
  if (o.jet > 0) rippleSource(o.jc ? o.jc[0] : o.x, o.jc ? o.jc[1] : o.z, 0.26 + 0.1 * o.jet, -0.034 * o.jet, 0.24, 0.3); // le jet creuse l'eau du bassin sans cesse
  return mesh;
}

/* ---------- Reflets du décor dans les petites eaux ----------
   Une cube map par groupe d'eaux voisines (une fontaine et sa vasque, un canal, un étang), rendue une seule fois au chargement de la carte,
   après la compilation des shaders (mapCompile), une barrière GPU entre deux : le décor vu d'un point à ras de l'eau, avec ses ombres
   (les cascades sont recentrées sur la sonde), sans l'eau elle-même ni les soldats, le disque du soleil retiré (il se reflète déjà par la
   lumière directe). Le shader recale le reflet sur une boîte autour de l'eau et de son décor (parallaxe : un arbre au bord se reflète au
   pied de l'arbre). La sonde se place à 1,1 m au-dessus de l'eau (au-dessus des nénuphars et des margelles), à l'écart du milieu (la
   colonne d'une fontaine), ou en probeAt (au-dessus des fougères d'un ruisseau, d'une île). 64 pixels sur téléphone, 128
   ailleurs ; au plus 6 ou 12 sondes, les plus grandes eaux d'abord ; sautées sur un appareil qui a perdu le contexte à cette étape
   (GPUX.lean.probe) : l'eau garde le reflet du ciel. */
const WPROBES = [];
async function waterProbes() {
  if (!ENVC.on || GPUX.lean.probe || !PONDS.some((q) => q.probe)) return;
  const groups = [];
  for (const q of PONDS) {
    if (!q.probe) continue;
    const g = !q.at && groups.find((e) => !e.at && q.b[0] < e.b[2] + 3 && q.b[2] > e.b[0] - 3 && q.b[1] < e.b[3] + 3 && q.b[3] > e.b[1] - 3);
    if (g) { g.ponds.push(q); g.b = [Math.min(g.b[0], q.b[0]), Math.min(g.b[1], q.b[1]), Math.max(g.b[2], q.b[2]), Math.max(g.b[3], q.b[3])]; g.y = Math.min(g.y, q.y); }
    else groups.push({ ponds: [q], b: q.b.slice(), y: q.y, at: q.at, box: q.box });
  }
  const area = (g) => (g.b[2] - g.b[0]) * (g.b[3] - g.b[1]);
  groups.sort((a, b) => area(b) - area(a)); groups.length = Math.min(groups.length, COARSE || GFX_SAFE || ULTRA ? 6 : 12);
  const size = COARSE || GFX_SAFE || ULTRA ? 64 : 128, mask = camera.layers.mask;
  const saved = { p: camera.position.clone(), r: camera.rotation.clone(), dust: FX.dust.visible, sp: sky.position.clone(), disk: SkyShader.uniforms.uDisk.value.clone(), ac: renderer.autoClear };
  const hidden = PONDS.map((q) => q.mesh).concat(WATER.mesh ? [WATER.mesh] : []).concat(MAPL.root ? MAPL.root.children.filter((o) => o.userData.weather) : []).concat(entities.map((e) => e.model.root));
  const vis = hidden.map((o) => o.visible);
  try {
    for (const o of hidden) o.visible = false;
    FX.dust.visible = false; SkyShader.uniforms.uDisk.value.set(0, 0, 0); renderer.autoClear = true;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i], hx = (g.b[2] - g.b[0]) / 2, hz = (g.b[3] - g.b[1]) / 2;
      const c = g.at ? new V3(...g.at) : new V3(g.b[0] + hx * 1.45, g.y + 1.1, g.b[1] + hz * 1.45);
      const B = g.box || [g.b[0] - 6, g.y - 1, g.b[1] - 6, g.b[2] + 6, g.y + 12, g.b[3] + 6];
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
      WPROBES.push(rt);
      const cc = new THREE.CubeCamera(0.05, 600, rt); cc.position.copy(c); cc.updateMatrixWorld(true);
      for (const k of cc.children) k.layers.mask = mask;
      // ombres : cascades recentrées sur la sonde (caméra plongeante au-dessus d'elle), recalculées au premier rendu
      camera.position.set(c.x, c.y + 30, c.z); camera.rotation.set(-Math.PI / 2, 0, 0); updateShadows();
      if (csm) for (const l of csm.lights) l.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      sky.position.copy(c); sky.updateMatrixWorld();
      cc.update(renderer, scene);
      for (const q of g.ponds) {
        q.U.tPRefl.value = rt.texture; q.U.uPProbe.value.set(c.x, c.y, c.z, 1); q.U.uPBoxA.value.set(B[0], B[1], B[2]); q.U.uPBoxB.value.set(B[3], B[4], B[5]);
        q.mesh.material.envMapIntensity = 1;
      }
      await gpuBarrier('probes ' + (i + 1) + '/' + groups.length);
    }
  } finally {
    hidden.forEach((o, k) => { o.visible = vis[k]; });
    FX.dust.visible = saved.dust; SkyShader.uniforms.uDisk.value.copy(saved.disk); sky.position.copy(saved.sp); sky.updateMatrixWorld(); renderer.autoClear = saved.ac;
    renderer.setRenderTarget(null);
    camera.position.copy(saved.p); camera.rotation.copy(saved.r); updateShadows();
    if (csm) for (const l of csm.lights) l.shadow.needsUpdate = true;
  }
}
/* Surface d'une fontaine touchée par un point d'impact (au-dessus de l'eau, sous le bord) : y de l'eau, sinon null */
function pondHitAt(p) {
  for (const a of PONDAREAS) if (p.y > a.y - 0.1 && p.y < a.y + 0.6 && a.inside(p.x, p.z)) return a.y;
  return null;
}
// une eau sans sonde reflète le ciel de la carte : sa cube map n'existe qu'après l'éclairage de la carte (mapEnvironment), bien après pondAdd
function pondUpdate(t) { for (const q of PONDS) { q.U.uPT.value = t; if (q.U.uPProbe.value.w < 0.5) q.U.tPRefl.value = ENVC.gloss.value; } }

/* ---------- Gerbes ---------- */
/* Impact de balle dans l'eau : gouttes qui retombent, colonne de bruine, voile */
function waterSplashFx(p, big) {
  const sea = WATER.on && waterAt(p.x, p.z), y = (sea ? WATER.y + waterHeight(p.x, p.z, WATER.t) : p.y) + 0.02, k = big ? 1.4 : 1;
  rippleAdd(p.x, p.z, big ? 0.55 : 0.36, big ? -0.34 : -0.17, big ? 0.38 : 0.24); // le tir creuse l'eau : anneaux et gerbe d'écume (02mb-ondes.js)
  for (let i = 0; i < (big ? 14 : 9); i++) FX.smoke.spawn(p.x, y, p.z, rand(-0.9, 0.9) * k, rand(2.2, 4.6) * k, rand(-0.9, 0.9) * k, rand(0.45, 0.8), 0.05 * k, 0.035 * k, 0.82, 0.87, 0.9, 0.95, 0.3, 9.8, 0.4);
  FX.smoke.spawn(p.x, y + 0.05, p.z, 0, 1.5 * k, 0, 0.6, 0.18 * k, 0.7 * k, 0.86, 0.9, 0.93, 0.6, 0, 1.2, 1.4, rand(-1, 1));
  FX.smoke.spawn(p.x, y, p.z, 0, 0.25, 0, 1.1, 0.35 * k, 1.2 * k, 0.8, 0.85, 0.88, 0.32, 0, 0, 0.8, rand(-1, 1));
}
/* Grenade qui tombe à l'eau (k = 0,6) ou qui explose sous la surface (k = 1) : gerbe haute, rideau de gouttes, embruns */
function waterBlastFx(p, k = 1) {
  const sea = WATER.on && waterAt(p.x, p.z), y = (sea ? WATER.y + waterHeight(p.x, p.z, WATER.t) : (waterSurfaceAt(p.x, p.z) || p.y)) + 0.02;
  rippleAdd(p.x, p.z, 1.3 * k, -0.5 * k, 1); rippleAdd(p.x, p.z, 0.6 * k, -0.3 * k, 1); // onde de choc : un grand cercle et un cœur d'écume
  for (let i = 0; i < 46 * k; i++) { const a = rand(0, TAU), r = rand(0, 2.2) * k; FX.smoke.spawn(p.x, y, p.z, Math.cos(a) * r, rand(5, 13) * k, Math.sin(a) * r, rand(0.9, 1.6), rand(0.08, 0.14) * k, rand(0.06, 0.1), 0.84, 0.88, 0.9, 0.95, 0.3, 9.8, 0.3); }
  for (let i = 0; i < 10 * k; i++) FX.smoke.spawn(p.x + rand(-0.6, 0.6), y + rand(0, 1.5) * k, p.z + rand(-0.6, 0.6), rand(-1, 1), rand(3, 8) * k, rand(-1, 1), rand(1.2, 2.2), rand(0.6, 1.1) * k, rand(2, 3.5) * k, 0.88, 0.91, 0.94, 0.55, 0, 2.5, 1.0, rand(-0.5, 0.5));
  for (let i = 0; i < 8 * k; i++) { const a = rand(0, TAU); FX.smoke.spawn(p.x, y + 0.1, p.z, Math.cos(a) * rand(2, 4) * k, 0.3, Math.sin(a) * rand(2, 4) * k, rand(1.4, 2.4), 0.6 * k, 2.2 * k, 0.8, 0.84, 0.87, 0.4, 0, 0, 1.2, rand(-0.5, 0.5)); }
}
