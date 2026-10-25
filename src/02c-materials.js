/* ==========================================================================
   MATIÈRES DU DÉCOR : MeshStandardMaterial complétées par un petit patch de shader (worldMat).
   - Coordonnées de texture en mètres dans la géométrie ; chaque matière fixe sa taille de tuile (TEXSCALE).
   - Variation à grande échelle (texture macro en coordonnées du monde) : casse la répétition des tuiles.
   - Salissures au pied des murs et coulures verticales ; poussière de sable sur les surfaces tournées vers le ciel.
   - Éclairage cuit (02e-light.js) : un volume 3D donne la part de ciel visible (occlusion ambiante à grande
     échelle : ruelles, intérieurs, dessous d'auvents) et la lumière du soleil renvoyée par les surfaces
     éclairées ; l'occlusion de contact par sommet (attribut aoc) s'y ajoute. Seule la lumière indirecte est
     assombrie : le soleil direct reste géré par les ombres en cascade.
   - Sol à mélange de matières (groundMat) : sable de base et trois couches (pavés, dalles, asphalte) pondérées par
     une carte de répartition et par le relief de chaque couche (le sable remplit d'abord les joints).
   - Neige (cartes d'hiver, uSnow) : couche blanche sur tout ce qui regarde le ciel (dessus des objets, toits, appuis,
     branches) et petite congère au pied des murs, seulement à découvert (part de ciel visible à la verticale, lue dans
     l'éclairage cuit : rien sous un toit ni dans une pièce, même largement vitrée). Coût nul quand la carte n'a pas de neige (branche sur uniforme).
   - Relief par parallaxe (WM_POM, équivalent web de la tessellation, absente de WebGL) : sur les surfaces proches,
     le rayon de vue est suivi dans la carte de hauteur (map.a) pour décaler les textures ; les pavés, briques et
     moellons prennent de l'épaisseur et projettent leur propre ombre au soleil. Coût réglé par le profil de qualité
     (QUALITY.pom : pas de recherche, distance d'extinction, ombre propre) ; absent en qualité Basse.
   Les variantes passent par des defines (les programmes sont partagés entre matières identiques).
   ========================================================================== */
const WMU = {
  tMacro: { value: null }, tVol: { value: null }, uVolMin: { value: new V3(-50, 0, -64) }, uVolInv: { value: new V3(0.01, 0.05, 0.01) },
  uBounce: { value: new THREE.Color(0, 0, 0) }, uAOFloor: { value: 0.3 }, uDustCol: { value: new THREE.Color().setRGB(sl(0.8), sl(0.68), sl(0.54)) },
  // relief : pas de recherche maximum, début et fin d'extinction (m), force de l'ombre propre ; direction du soleil
  uPom: { value: new THREE.Vector4(0, 0, 1, 0) }, uSunW: { value: SUN_DIR },
  // neige : couverture du dessus des objets, congère au pied des murs, seuils de ciel visible (0 à 1) ; couleur
  uSnow: { value: new THREE.Vector4(0, 0, 0.3, 0.55) }, uSnowCol: { value: new THREE.Color(1, 1, 1) },
  // 1 : hors du volume d'éclairage cuit, le décor est à ciel ouvert (sinon il prend la valeur du bord du volume)
  uVolOpen: { value: 0 },
  // décalage (m) du point où le décor lit le volume cuit, le long de sa normale : une cellule touchée par une collision est pleine jusqu'à 0,85 cellule
  // au-delà de la face ; à 0,32 m, un mur de Simoun (cellules de 0,75 m) lisait souvent sa propre cellule pleine (taches sombres) ; voir lightFinish
  uVolNo: { value: 0.32 },
  // contraste intérieur/extérieur (atmo.interior) : pente de la courbe du ciel visible, part du plancher gardée, ciel vu à la caméra (après la courbe),
  // part du soleil renvoyé gardée à l'abri
  uSkyC: { value: new THREE.Vector4(1, 1, 1, 1) },
  // hauteur du sol d'une carte en relief (reliefGroundTex, 02-relief.js) : la crasse et la poussière du pied des murs se comptent depuis le sable ;
  // bornes de la grille (x0, z0, 1 / largeur, 1 / profondeur), 0 sans relief
  tGround: { value: null }, uGroundB: { value: new THREE.Vector4(0, 0, 0, 0) },
  // couches des lampes empilées au-dessus du volume (02e-light.js) : force (0 : aucune lampe), hauteur du volume, des couches des lampes,
  // et du tout (en cellules) ; VOL_Q et VOL_L donnent les coordonnées de lecture
  uVolL: { value: new THREE.Vector4(0, 1, 0, 1) },
};
/* Courbe du ciel visible (part de ciel du volume cuit, 0 à 1) : en S autour de 0,5, elle assombrit les lieux couverts (souk, maisons, passages)
   et éclaircit les rues dégagées ; uSkyC.x = 1 la laisse telle quelle. Même courbe sur le processeur : skyCurve (01-core.js n'en dépend pas). */
const SKY_CURVE = `float skyCurve(float s) { float a = pow(s, uSkyC.x), b = pow(1.0 - s, uSkyC.x); return a / max(a + b, 1e-4); }`;
function skyCurve(s, k = WMU.uSkyC.value.x) { const a = Math.pow(s, k), b = Math.pow(1 - s, k); return a / Math.max(a + b, 1e-4); }
/* Lecture du volume cuit au point q (coordonnées du volume, 0 à 1) : la hauteur est bornée sous les couches des lampes */
const VOL_Q = '#define VOL_Q(q) vec3((q).x, (q).z, min((q).y * uVolL.y, uVolL.y - 0.5) / uVolL.w)';
/* Lumière des lampes au point q : éclairement (même échelle que la lumière indirecte de three.js), racine gardée dans la texture */
const VOL_L = `vec3 volLamp(vec3 q) {
  if (uVolL.x <= 0.0) return vec3(0.0);
  vec3 e = texture(tVol, vec3(q.x, q.z, (uVolL.y + clamp(q.y * uVolL.y, 0.5, uVolL.z - 0.5)) / uVolL.w)).rgb;
  return e * e * uVolL.x;
}`;
/* Relief compilé si le profil de départ n'est pas Basse (un passage en Basse en cours de partie l'éteint par uniforme) */
const POM = { on: false };
{
  const t = new THREE.Data3DTexture(new Uint8Array([255, 0, 255, 255]), 1, 1, 1);
  t.format = THREE.RGBAFormat; t.needsUpdate = true; WMU.tVol.value = t;
  const g = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); g.needsUpdate = true; WMU.tGround.value = WMU.tGround.zero = g; // sans relief
}
const WM_VERT_HEAD = `#include <common>
varying vec3 vWPos; varying vec3 vWNor; attribute float aoc; varying float vAoc; uniform float uWMs;`;
const WM_VERT_POS = `#include <worldpos_vertex>
#ifdef USE_INSTANCING
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * objectNormal);
#endif
vAoc = aoc;`;
const WM_FRAG_HEAD = `#include <common>
varying vec3 vWPos; varying vec3 vWNor; varying float vAoc;
uniform sampler2D tMacro; uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv, uBounce, uDustCol; uniform float uAOFloor, uVolNo; uniform vec4 uVolL; uniform vec4 uSkyC;
${VOL_Q}
${VOL_L}
${SKY_CURVE}
// brume des lieux couverts : la lumière qu'elle renvoie vient du ciel, elle s'assombrit à l'abri (fog_fragment, 01-core.js ; réglée par WM_AO)
float wmFogK = 1.0;
#define FOG_K wmFogK
uniform vec4 uWM; uniform float uWMa, uWMn, uWMr; uniform vec4 uSnow; uniform vec3 uSnowCol; uniform float uVolOpen;
#ifndef WM_SPLAT
uniform sampler2D tGround; uniform vec4 uGroundB;
#endif
#ifdef WM_SPLAT
#ifdef WM_LEAN
uniform sampler2D tSplat, tL1, tL2, tL3;
#else
uniform sampler2D tSplat, tL1, tN1, tL2, tN2, tL3, tN3;
#endif
uniform vec4 uSplatB, uGS; uniform vec3 uGDirt; uniform float uGMul;
#define WM_G(t, p, s) textureGrad(t, (p) / (s), wmGx / (s), wmGy / (s))
#endif
#ifdef WM_POM
uniform vec4 uPom; uniform vec3 uSunW; uniform float uPomD; uniform vec4 uPomG;
#elif defined( WM_WIN )
uniform vec3 uSunW;
#endif
/* lectures des textures de la matière : aux coordonnées décalées par le relief, avec les dérivées d'origine
   (le décalage change brusquement au bord des reliefs : les dérivées implicites y choisiraient un mauvais mipmap) */
#if defined( WM_POM ) && ! defined( WM_SPLAT )
#define WM_T(t) textureGrad(t, wmUv, wmDx, wmDy)
#else
#define WM_T(t) texture2D(t, vUv)
#endif`;
/* Fonctions de relief (après les déclarations de three.js : map y est connue) */
const WM_FUNCS = `#include <clipping_planes_pars_fragment>
#ifdef WM_POM
#ifdef WM_SPLAT
/* profondeur du sol (m) sous le sommet des reliefs : couches pondérées par leur part et leur profondeur */
float wmGD(vec2 g, vec4 wd, vec2 gx, vec2 gy) {
  float d = 0.0;
  if (wd.x > 1e-4) d += wd.x * (1.0 - textureGrad(map, g / uGS.x, gx / uGS.x, gy / uGS.x).a);
  if (wd.y > 1e-4) d += wd.y * (1.0 - textureGrad(tL1, g / uGS.y, gx / uGS.y, gy / uGS.y).a);
  if (wd.z > 1e-4) d += wd.z * (1.0 - textureGrad(tL2, g / uGS.z, gx / uGS.z, gy / uGS.z).a);
  if (wd.w > 1e-4) d += wd.w * (1.0 - textureGrad(tL3, g / uGS.w, gx / uGS.w, gy / uGS.w).a);
  return d;
}
#else
float wmD(vec2 p, vec2 dx, vec2 dy) { return 1.0 - textureGrad(map, p, dx, dy).a; }
#endif
#endif`;
/* Relief par parallaxe, à la place de la lecture de la couleur (map_fragment). Recherche linéaire le long du rayon
   de vue dans la carte de hauteur, interpolation entre les deux derniers pas, puis ombre propre : second trajet
   vers le soleil depuis le point trouvé. Repère de la surface tiré des dérivées écran (position et uv). */
const WM_MAP = `float wmPS = 1.0, wmCav = 1.0;
#ifdef WM_SPLAT
vec2 wmGp = vec2(vWPos.x, -vWPos.z), wmGx = dFdx(wmGp), wmGy = dFdy(wmGp);
vec4 wmSp = texture2D(tSplat, (vWPos.xz - uSplatB.xy) * uSplatB.zw);
#ifdef WM_POM
if (uPom.x > 0.5) {
  vec3 V = cameraPosition - vWPos; float dist = length(V); V /= dist;
  vec4 wd = vec4(max(0.0, 1.0 - wmSp.r - wmSp.g - wmSp.b), wmSp.rgb) * uPomG * (1.0 - smoothstep(uPom.y, uPom.z, dist));
  float dmax = wd.x + wd.y + wd.z + wd.w;
  if (dmax > 0.0015) {
    // sol : repère fixe (x, -z, y) ; déplacement de gp par mètre de profondeur
    vec2 dir = -vec2(V.x, -V.z) / max(V.y, 0.12);
    float n = floor(mix(uPom.x, max(3.0, uPom.x * 0.3), V.y)), dl = dmax / n, lay = 0.0, pLay = 0.0;
    vec2 st = dir * dl, g = wmGp;
    float D = wmGD(g, wd, wmGx, wmGy), pD = D;
    for (int i = 0; i < 32; i++) { if (float(i) >= n || lay >= D) break; pD = D; pLay = lay; g += st; lay += dl; D = wmGD(g, wd, wmGx, wmGy); }
    float a = D - lay, b = pD - pLay, t = lay > 0.0 ? b / max(b - a, 1e-6) : 0.0;
    g = g - st + st * t; float hit = lay > 0.0 ? pLay + dl * t : 0.0;
    wmGp = g; wmCav = 1.0 - hit / dmax * smoothstep(0.004, 0.02, dmax);
    if (uPom.w > 0.0 && hit > 1e-4) {
      vec2 ld = vec2(uSunW.x, -uSunW.z) / max(uSunW.y, 0.2) * hit;
      float occ = 0.0;
      for (int j = 1; j <= 5; j++) { float s = float(j) / 5.0; occ = max(occ, (hit * (1.0 - s) - wmGD(g + ld * s, wd, wmGx, wmGy)) * (1.0 - s)); }
      wmPS = 1.0 - clamp(occ / (dmax * 0.18), 0.0, 1.0) * uPom.w;
    }
  }
}
#endif
#else
#ifdef WM_POM
vec2 wmUv = vUv, wmDx = dFdx(vUv), wmDy = dFdy(vUv);
vec3 wmQ0 = dFdx(vWPos), wmQ1 = dFdy(vWPos);
if (uPom.x > 0.5) {
  vec3 V = cameraPosition - vWPos; float dist = length(V); V /= dist;
  float depth = uPomD * (1.0 - smoothstep(uPom.y, uPom.z, dist));
  vec3 N = normalize(vWNor), q1p = cross(wmQ1, N), q0p = cross(N, wmQ0);
  // gradients de u et v sur la surface (repère cotangent) : duv = (T, B) . déplacement / det
  vec3 T = q1p * wmDx.x + q0p * wmDy.x, B = q1p * wmDx.y + q0p * wmDy.y;
  float det = dot(wmQ0, q1p), vn = dot(V, N);
  if (depth > 1e-4 && abs(det) > 1e-14 && vn > 0.02) {
    vec2 dir = -vec2(dot(T, V), dot(B, V)) / (det * max(vn, 0.12)) * depth;
    float n = floor(mix(uPom.x, max(3.0, uPom.x * 0.3), vn)), dl = 1.0 / n, lay = 0.0, pLay = 0.0;
    vec2 st = dir * dl, uv = vUv;
    float D = wmD(uv, wmDx, wmDy), pD = D;
    for (int i = 0; i < 32; i++) { if (float(i) >= n || lay >= D) break; pD = D; pLay = lay; uv += st; lay += dl; D = wmD(uv, wmDx, wmDy); }
    float a = D - lay, b = pD - pLay, t = lay > 0.0 ? b / max(b - a, 1e-6) : 0.0;
    wmUv = uv - st + st * t; float hit = lay > 0.0 ? pLay + dl * t : 0.0;
    wmCav = 1.0 - hit * smoothstep(0.004, 0.02, depth);
    float ln = dot(uSunW, N);
    if (uPom.w > 0.0 && hit > 1e-3 && ln > 0.03) {
      vec2 ld = vec2(dot(T, uSunW), dot(B, uSunW)) / (det * max(ln, 0.2)) * depth * hit;
      float occ = 0.0;
      for (int j = 1; j <= 5; j++) { float s = float(j) / 5.0; occ = max(occ, (hit * (1.0 - s) - wmD(wmUv + ld * s, wmDx, wmDy)) * (1.0 - s)); }
      wmPS = 1.0 - clamp(occ * 5.5, 0.0, 1.0) * uPom.w;
    }
  }
}
#endif
#ifdef USE_MAP
vec4 sampledDiffuseColor = WM_T( map );
diffuseColor *= sampledDiffuseColor;
#endif
#endif`;
/* Couleur : variation macro, salissures, poussière (après les couleurs de sommets) */
const WM_COLOR = `#include <color_fragment>
float wmA = 1.0;
#if defined( USE_MAP ) && ! defined( WM_SPLAT )
wmA = sampledDiffuseColor.a;
#endif
#ifndef WM_CUT
diffuseColor.a = opacity;
#endif
vec3 wmN = vec3(0.0, 0.0, 1.0); float wmR = 1.0;
#ifdef WM_SPLAT
{
  vec2 gp = wmGp; vec4 sp = wmSp;
  vec4 c0 = WM_G(map, gp, uGS.x), c1 = WM_G(tL1, gp, uGS.y), c2 = WM_G(tL2, gp, uGS.z), c3 = WM_G(tL3, gp, uGS.w);
#ifdef WM_LEAN
  // peu d'unités de texture (13 sur un Pixel) : seule la normale du fond est lue, les trois couches restent plates
  vec4 n0 = WM_G(normalMap, gp, uGS.x), n1 = vec4(0.5, 0.5, 1.0, 0.85), n2 = n1, n3 = n1;
#else
  vec4 n0 = WM_G(normalMap, gp, uGS.x), n1 = WM_G(tN1, gp, uGS.y), n2 = WM_G(tN2, gp, uGS.z), n3 = WM_G(tN3, gp, uGS.w);
#endif
  vec4 w = vec4(max(0.0, 1.0 - sp.r - sp.g - sp.b), sp.rgb);
  vec4 hh = vec4(c0.a, c1.a, c2.a, c3.a) * 0.6 + w;
  float hm = max(max(hh.x, hh.y), max(hh.z, hh.w)) - 0.18;
  vec4 bw = max(hh - hm, 0.0) * step(0.002, w); bw /= max(bw.x + bw.y + bw.z + bw.w, 1e-4);
  vec3 dirtC = c0.rgb * uGDirt;
  vec3 base = mix(c0.rgb, dirtC, sp.a);
  // le grain du sable teinte aussi les autres couches (poussière déposée) ; uGMul : part de cette teinte
  diffuseColor.rgb *= mix(vec3(1.0), c0.rgb, uGMul) * (base * bw.x + c1.rgb * bw.y + c2.rgb * bw.z + c3.rgb * bw.w);
  wmN = normalize((n0.xyz * 2.0 - 1.0) * bw.x + (n1.xyz * 2.0 - 1.0) * bw.y + (n2.xyz * 2.0 - 1.0) * bw.z + (n3.xyz * 2.0 - 1.0) * bw.w);
  wmR = n0.a * bw.x + n1.a * bw.y + n2.a * bw.z + n3.a * bw.w; wmR = mix(wmR, 1.0, sp.a * 0.5);
  wmA = bw.x;
}
#endif
float wmDust = 0.0;
// éclairage cuit, lu une fois (crasse des recoins, neige, lumière indirecte de WM_AO) : part de ciel, rebond, ciel au zénith, ombre cuite
vec3 wmVq = (vWPos + vWNor * uVolNo - uVolMin) * uVolInv; // uVolNo : décalage le long de la normale, hors de la cellule pleine du mur
vec4 wmVol = texture(tVol, VOL_Q(wmVq));
float wmTa = 0.5, wmCr = 0.0, wmK = 0.0;
// hauteur au-dessus du sol : bandeau de crasse, poussière et congère du pied (sur une carte en relief, le sable n'est pas en y = 0)
float wmY = vWPos.y;
#ifndef WM_SPLAT
if (uGroundB.z > 0.0) wmY -= texture2D(tGround, (vWPos.xz - uGroundB.xy) * uGroundB.zw).r;
#endif
{
  vec2 mp = abs(vWNor.y) > 0.6 ? vWPos.xz : vec2(vWPos.x + vWPos.z, vWPos.y);
  vec4 m1 = texture2D(tMacro, mp * 0.037), m2 = texture2D(tMacro, mp * 0.19);
  diffuseColor.rgb *= 1.0 + ((m1.r - 0.5) * 0.9 + (m2.g - 0.5) * 0.5) * uWM.x;
  {
  float vert = 1.0 - abs(vWNor.y);
  // coulures (scan de traînées verticales, canal a) : traînées sur les murs, et bandeau de crasse du pied qu'elles déchirent
  float st = texture2D(tMacro, vec2((vWPos.x + vWPos.z) * 0.5, vWPos.y * 0.11)).a;
  float g0 = (1.0 - smoothstep(0.0, uWM.z, wmY - 0.02 + (m2.g - 0.5) * 0.6)) * vert * step(0.01, uWM.z) * clamp(0.55 + (st - 0.5) * 1.8, 0.0, 1.0);
  float g1 = smoothstep(0.5, 0.8, st + (m1.r - 0.5) * 0.3) * vert * uWM.w;
  diffuseColor.rgb *= 1.0 - g0 * 0.3 - g1 * 0.22;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 0.9, 0.75), g0 * 0.6);
  }
#ifndef WM_SPLAT
  // couche d'usure (scans d'ambientCG, tools/build_usure.py), pour les matières qui prennent des salissures (grime) : taches sur la couleur
  // (et la rugosité, WM_ROUGH), crasse des recoins là où le ciel se voit peu d'après l'éclairage cuit (sous les avancées, dans les angles)
  wmK = smoothstep(0.0, 0.5, uWM.z);
  if (wmK > 0.01) {
    wmTa = texture2D(tMacro, mp * 0.55 + 0.37).b;
    float sky = uVolOpen > 0.5 ? mix(1.0, wmVol.r, step(0.0, min(wmVq.x, wmVq.z)) * step(max(wmVq.x, wmVq.z), 1.0)) : wmVol.r;
    wmCr = (1.0 - smoothstep(0.3, 0.9, sky)) * clamp(0.6 + (wmTa - 0.5) * 1.6, 0.0, 1.0) * wmK;
    diffuseColor.rgb *= (1.0 - (wmTa - 0.5) * 0.3 * wmK) * (1.0 - wmCr * 0.3);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.97, 0.9, 0.8), wmCr * 0.6);
  }
#endif
  float up = smoothstep(0.5, 0.92, vWNor.y);
  wmDust = up * smoothstep(0.35, 0.7, m1.g * 0.7 + m2.r * 0.6 - 0.1) * uWM.y;
  wmDust = max(wmDust, (1.0 - smoothstep(0.0, 0.45, wmY)) * (1.0 - up) * smoothstep(0.3, 0.6, m2.g) * uWM.y * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, uDustCol, clamp(wmDust, 0.0, 1.0));
}
float wmSnow = 0.0;
#ifndef WM_SPLAT
if (uSnow.x * uWMn > 0.0) {
  // à découvert seulement : part de ciel visible à la verticale, d'après l'éclairage cuit (hors du volume : ciel ouvert)
  vec3 vq = wmVq;
  float inV = step(0.0, min(vq.x, vq.z)) * step(max(vq.x, vq.z), 1.0) * step(vq.y, 1.0);
  float open = mix(1.0, smoothstep(uSnow.z, uSnow.w, wmVol.b), inV);
  vec2 sp = vWPos.xz + vWPos.y * 0.37;
  float n1 = texture2D(tMacro, sp * 0.09).r, n2 = texture2D(tMacro, sp * 0.47 + 0.3).g;
  // dessus des objets et pentes des toits : bord irrégulier, la neige glisse des pentes raides
  float up = smoothstep(0.3 + (n2 - 0.5) * 0.35, 0.68, vWNor.y);
  float cover = up * smoothstep(0.2, 0.42, n1 * 0.55 + n2 * 0.45 + uSnow.x * 0.35 - 0.15);
  // petite congère au pied des murs et des objets
  float foot = (1.0 - smoothstep(0.0, 0.12 + n2 * 0.4, wmY - 0.005)) * (1.0 - up) * uSnow.y;
  wmSnow = clamp(max(cover * uSnow.x, foot), 0.0, 1.0) * open * uWMn;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol * (0.93 + n2 * 0.1), wmSnow);
}
#endif`;
const WM_ROUGH = `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
roughnessFactor *= texture2D( roughnessMap, vUv ).g;
#endif
#if defined( WM_NR ) && ! defined( WM_SPLAT )
roughnessFactor *= WM_T( normalMap ).a;
#endif
#ifdef WM_SPLAT
roughnessFactor *= wmR;
#else
roughnessFactor = clamp(roughnessFactor * (1.0 + (wmTa - 0.5) * 0.6 * wmK) + wmCr * 0.12, 0.03, 1.0); // couche d'usure : taches, crasse des recoins
#endif
roughnessFactor = mix(roughnessFactor, 0.95, wmDust);
roughnessFactor = mix(roughnessFactor, 0.7, wmSnow);`;
const WM_METAL = `#include <metalnessmap_fragment>
metalnessFactor *= mix(1.0, wmA, uWMa);
metalnessFactor *= (1.0 - wmDust) * (1.0 - wmSnow);`;
const WM_NORMAL = `#ifdef WM_SPLAT
{ vec3 mN = wmN; mN.xy *= normalScale; normal = perturbNormal2Arb( - vViewPosition, normal, mN, faceDirection ); }
#elif defined( WM_POM ) && defined( WM_NR )
{ vec3 mN = WM_T( normalMap ).xyz * 2.0 - 1.0; mN.xy *= normalScale; normal = perturbNormal2Arb( - vViewPosition, normal, mN, faceDirection ); }
#else
#include <normal_fragment_maps>
#endif
#ifndef WM_SPLAT
if (uWMr > 0.0) {
  // ondulations d'un enduit posé à la main (relief : uWMr m de creux pour une unité de bruit) : bosses de 0,5 à 2 m tirées du bruit macro
  // (canal r), pente prise sur 15 cm (les octaves fines s'y effacent) ; invisibles de face, elles marquent la façade sous un soleil rasant
  vec3 gN = normalize(vWNor);
  float wall = step(abs(gN.y), 0.6);
  vec2 rp = (wall > 0.5 ? vec2(vWPos.x + vWPos.z, vWPos.y) : vWPos.xz) * 0.12;
  float h0 = texture2D(tMacro, rp).r, hx = texture2D(tMacro, rp + vec2(0.018, 0.0)).r, hy = texture2D(tMacro, rp + vec2(0.0, 0.018)).r;
  vec2 d = vec2(hx - h0, hy - h0) / 0.15;
  vec3 g = wall > 0.5 ? vec3(d.x, d.y, d.x) : vec3(d.x, 0.0, d.y);
  g -= gN * dot(gN, g);
  normal = normalize(normal - uWMr * (viewMatrix * vec4(g, 0.0)).xyz);
}
#endif
normal = normalize(mix(normal, geometryNormal, wmSnow * 0.85)); // la neige lisse le relief`;
/* Lumière indirecte : part de ciel visible, rebond du soleil, occlusion de contact */
const WM_AO = `{
  vec3 vq = wmVq; vec4 vol = wmVol; // lu par WM_COLOR
  if (uVolOpen > 0.5) vol = mix(vec4(1.0, 0.55, 1.0, 1.0), vol, step(0.0, min(vq.x, vq.z)) * step(max(vq.x, vq.z), 1.0));
  float sc = skyCurve(vol.r);
  float sky = mix(uAOFloor * uSkyC.y, 1.0, sc) * vAoc * mix(0.62, 1.0, wmCav);
  wmFogK = mix(0.35, 1.0, max(sc, uSkyC.z)); // brume claire si la caméra ou le point voient le ciel
  reflectedLight.indirectDiffuse *= sky;
  reflectedLight.directDiffuse *= wmPS; reflectedLight.directSpecular *= wmPS;${NO_SHADOWS ? `
  reflectedLight.directDiffuse *= vol.a; reflectedLight.directSpecular *= vol.a; // ombre du soleil cuite (sans carte d'ombre, NO_SHADOWS)` : ''}
  reflectedLight.indirectDiffuse += uBounce * vol.g * BRDF_Lambert( material.diffuseColor ) * mix(0.55, 1.0, vAoc) * mix(uSkyC.w, 1.0, sc);
  reflectedLight.indirectDiffuse += volLamp(vq) * material.diffuseColor * mix(0.55, 1.0, vAoc); // lampes du décor (02e-light.js)
  float dNV = saturate( dot( geometry.normal, geometry.viewDir ) );
  reflectedLight.indirectSpecular *= computeSpecularOcclusion( dNV, sky, material.roughness );
}`;
/* Vitre d'une pièce (windowJoinery, 02d-archi.js) : un verre qui ne reflète que selon l'angle (Fresnel, celui de three.js : 4 % de face,
   presque tout en rasant ; matière lisse, non métallique, sans couleur propre) et, derrière, la pièce dessinée dans le shader (« interior
   mapping ») : le regard traverse la vitre et touche la boîte de la pièce (murs, sol, plafond, fond), qui glisse en parallaxe quand on
   bouge, sans géométrie ni texture. Pièce tirée de la graine de la fenêtre : largeur, profondeur, couleur des murs, sol, armoire ou porte au
   fond, tableau. Lumière : le jour entre par la fenêtre et s'éteint vers le fond (selon le ciel que voit la façade, éclairage cuit) ; une
   lampe chaude au plafond dans les pièces allumées (atmo.winLit des cartes, glassLit à Val-Blanc). Les sommets portent les données de la
   fenêtre à la place de la teinte : r, graine ; g, lampe ; b, rapport hauteur sur largeur / 8, + 0,5 pour une porte-fenêtre. */
const WIN_ROOM = `#include <emissivemap_fragment>
{
  float wSeed = vColor.r, wLit = vColor.g, wDoor = step(0.5, vColor.b), wAsp = mod(vColor.b, 0.5) * 8.0;
  vec3 wN = normalize(vWNor), wT = normalize(cross(vec3(0.0, 1.0, 0.0), wN)), wRd = normalize(vWPos - cameraPosition);
  vec3 wd = vec3(dot(wRd, wT), wRd.y, dot(wRd, wN)); wd = sign(wd) * max(abs(wd), vec3(1e-4));
  vec3 wo = vec3(vUv.x, vUv.y * wAsp, 0.0);
  float rx = 0.45 + fract(wSeed * 3.7) * 0.9, D = 2.0 + fract(wSeed * 5.3) * 1.8;
  float yF = wDoor > 0.5 ? 0.0 : -0.85, yC = wAsp + (wDoor > 0.5 ? 0.35 : 0.6);
  vec3 lo = vec3(-rx, yF, -D), hi = vec3(1.0 + rx, yC, 0.0);
  vec3 tt = (mix(lo, hi, step(0.0, wd)) - wo) / wd;
  float t = min(min(tt.x, tt.y), tt.z);
  vec3 h = wo + wd * t;
  float ps = floor(fract(wSeed * 17.3) * 6.0);
  vec3 wall = ps < 1.0 ? vec3(0.74, 0.69, 0.58) : ps < 2.0 ? vec3(0.58, 0.64, 0.56) : ps < 3.0 ? vec3(0.52, 0.58, 0.66) : ps < 4.0 ? vec3(0.76, 0.6, 0.44) : ps < 5.0 ? vec3(0.7, 0.7, 0.68) : vec3(0.64, 0.48, 0.4);
  vec3 c;
  if (t == tt.z) {
    c = wall;
    // armoire ou porte sombre au fond, tableau au mur
    float ax = mix(-rx + 0.1, 1.0 + rx - 0.8, fract(wSeed * 11.1)), aw = fract(wSeed * 2.3) < 0.5 ? 0.7 : 0.9;
    float box = step(ax, h.x) * step(h.x, ax + aw) * step(h.y, yF + 2.0);
    c = mix(c, fract(wSeed * 2.3) < 0.5 ? vec3(0.16, 0.1, 0.06) : vec3(0.05), box * step(0.25, fract(wSeed * 4.1)));
    float px = 1.0 - ax - 0.2, pic = step(abs(h.x - px), 0.28) * step(abs(h.y - yF - 1.6), 0.2) * (1.0 - box);
    c = mix(c, vec3(0.3, 0.22, 0.14) + 0.3 * vec3(fract(wSeed * 23.0), fract(wSeed * 29.0), fract(wSeed * 31.0)), pic);
  } else if (t == tt.y) c = wd.y < 0.0 ? (fract(wSeed * 7.3) < 0.5 ? vec3(0.24, 0.15, 0.09) : vec3(0.42, 0.4, 0.36)) : vec3(0.82, 0.8, 0.76);
  else c = wall * 0.86;
  // le jour entre par la fenêtre et s'éteint vers le fond, le plafond renvoie un peu de la lumière du sol
  float wDepth = clamp(-h.z / D, 0.0, 1.0);
  vec3 wLight = vec3(mix(0.34, 0.05, sqrt(wDepth)) * (0.35 + 0.65 * wmVol.r) * (t == tt.y && wd.y > 0.0 ? 1.25 : 1.0));
  // tache de soleil : le point de la pièce voit le soleil à travers l'ouverture (façade au soleil d'après l'éclairage cuit)
  vec3 wS = vec3(dot(uSunW, wT), uSunW.y, dot(uSunW, wN));
  if (wS.z > 0.05 && wmVol.a > 0.02) {
    vec3 q = h - wS * (h.z / wS.z);
    float inW = smoothstep(-0.03, 0.03, q.x) * smoothstep(1.03, 0.97, q.x) * smoothstep(-0.03, 0.03, q.y) * smoothstep(wAsp + 0.03, wAsp - 0.03, q.y);
    vec3 sn = t == tt.z ? vec3(0.0, 0.0, 1.0) : t == tt.y ? vec3(0.0, -sign(wd.y), 0.0) : vec3(-sign(wd.x), 0.0, 0.0);
    wLight += vec3(1.0, 0.86, 0.68) * 1.6 * inW * max(dot(sn, wS), 0.0) * wmVol.a;
  }
  vec3 wL = vec3(0.5, yC - 0.3, -D * 0.55); float wDl = length(h - wL);
  wLight += wLit * vec3(1.0, 0.62, 0.3) * 1.5 / (1.0 + 2.5 * wDl * wDl);
  float wF = 0.04 + 0.96 * pow(1.0 - clamp(dot(wN, -wRd), 0.0, 1.0), 5.0);
  totalEmissiveRadiance += c * wLight * (1.0 - wF);
  diffuseColor.rgb = vec3(0.0);
}`;
function windowMat(m) {
  m.defines.USE_UV = ''; m.defines.WM_WIN = '';
  const p0 = m.userData.patch;
  m.userData.patch = m.onBeforeCompile = (s, r) => { p0(s, r); s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', WIN_ROOM); };
}
function wmPatch(shader, m) {
  const u = m.userData.wmU;
  Object.assign(shader.uniforms, WMU, u);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', WM_VERT_HEAD).replace('#include <worldpos_vertex>', WM_VERT_POS)
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\nvUv *= uWMs;\n#endif');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', WM_FRAG_HEAD).replace('#include <clipping_planes_pars_fragment>', WM_FUNCS)
    .replace('#include <map_fragment>', WM_MAP).replace('#include <color_fragment>', WM_COLOR)
    .replace('#include <roughnessmap_fragment>', WM_ROUGH).replace('#include <metalnessmap_fragment>', WM_METAL)
    .replace('#include <normal_fragment_maps>', WM_NORMAL).replace('#include <aomap_fragment>', WM_AO);
}
/* Matière du décor. o : tex (surface de TEX), color (sRGB), rough, metal, env, scale (m par tuile, TEXSCALE par
   défaut), macro, dust, grime (hauteur des salissures, m), streak, ma (map.a = masque de métal), cut (découpe alpha),
   side, emissive, pom (profondeur du relief par parallaxe, m ; map.a doit être une hauteur), snow (part de neige
   reçue sur les cartes d'hiver, 1 par défaut), relief (ondulations lentes d'un enduit, m de creux par unité de bruit) */
function worldMat(o = {}) {
  const tx = o.tex ? TEX[o.tex] : null;
  const m = new THREE.MeshStandardMaterial({
    color: o.color ? new THREE.Color().setRGB(sl(o.color[0]), sl(o.color[1]), sl(o.color[2])) : 0xffffff,
    roughness: o.rough !== undefined ? o.rough : 1, metalness: o.metal || 0, vertexColors: true,
    envMapIntensity: o.env !== undefined ? o.env : 0.5,
    map: tx ? tx.map : null, normalMap: tx && !o.noNormal ? tx.normal : null,
  });
  if (o.normalScale) m.normalScale.set(o.normalScale, o.normalScale);
  if (o.cut) { m.alphaTest = o.cut; m.side = THREE.DoubleSide; }
  if (o.side) m.side = o.side;
  if (o.emissive) m.emissive = new THREE.Color().setRGB(...o.emissive);
  if (o.polyOff) { m.polygonOffset = true; m.polygonOffsetFactor = o.polyOff; m.polygonOffsetUnits = o.polyOff; }
  const scale = o.scale || (o.tex && ((tx && tx.asset && PHOTO_SCALE[o.tex]) || TEXSCALE[o.tex])) || 1;
  // peu de variantes de programme : salissures, poussière et masque de métal sont réglés par uniformes
  m.defines = { WM: '' };
  if (tx && tx.normal && !o.noNormal) m.defines.WM_NR = '';
  if (o.cut) m.defines.WM_CUT = '';
  if (o.pom && POM.on && tx) m.defines.WM_POM = '';
  const grime = o.grime !== undefined && o.grime !== false ? o.grime : 0;
  m.userData.wmU = {
    uWMs: { value: 1 / scale }, uWMa: { value: o.ma ? 1 : 0 }, uWMn: { value: o.snow !== undefined ? o.snow : 1 }, uWMr: { value: o.relief || 0 },
    uWM: { value: new THREE.Vector4(o.macro !== undefined ? o.macro : 0.35, o.dust || 0, grime || 0.001, grime ? o.streak || 0 : 0) },
    uPomD: { value: o.pom || 0 },
  };
  m.userData.patch = (s) => wmPatch(s, m);
  m.onBeforeCompile = m.userData.patch;
  if (o.noShadow) m.userData.noShadow = true;
  return m;
}
/* Objets mobiles (soldats) : la même lumière indirecte que le décor, lue dans le volume cuit à leur position */
const VL_VERT = `#include <common>
varying vec3 vVlPos; varying vec3 vVlNor;`;
const VL_POS = `#include <worldpos_vertex>
vVlPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vVlNor = normalize(mat3(modelMatrix) * objectNormal);`;
const VL_FRAG = `#include <common>
varying vec3 vVlPos; varying vec3 vVlNor; uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv, uBounce; uniform float uAOFloor; uniform vec4 uVolL; uniform vec4 uSkyC;
${VOL_Q}
${VOL_L}
${SKY_CURVE}`;
const VL_AO = `#include <aomap_fragment>
{
  vec3 vq = (vVlPos + vVlNor * 0.3 - uVolMin) * uVolInv;
  vec4 vol = texture(tVol, VOL_Q(vq));
  float sky = mix(uAOFloor, 1.0, skyCurve(vol.r)); // (plancher entier : un soldat à l'abri reste lisible)${NO_SHADOWS ? `
  reflectedLight.directDiffuse *= vol.a; reflectedLight.directSpecular *= vol.a; // ombre du soleil cuite (sans carte d'ombre, NO_SHADOWS)` : ''}
  reflectedLight.indirectDiffuse *= sky;
  reflectedLight.indirectDiffuse += uBounce * vol.g * BRDF_Lambert( material.diffuseColor ) * 0.8;
  reflectedLight.indirectDiffuse += volLamp(vq) * material.diffuseColor; // lampes du décor
  reflectedLight.indirectSpecular *= computeSpecularOcclusion( saturate( dot( geometry.normal, geometry.viewDir ) ), sky, material.roughness );
#ifdef USE_SHEEN
  sheenSpecular *= sky${NO_SHADOWS ? ' * mix(0.35, 1.0, vol.a)' : ''}; // reflet du tissu des tenues (06e-gear.js), éteint à l'abri du ciel
#endif
}`;
function volumeLit(m) {
  m.userData.patch = (s) => {
    Object.assign(s.uniforms, WMU);
    s.vertexShader = s.vertexShader.replace('#include <common>', VL_VERT).replace('#include <worldpos_vertex>', VL_POS);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', VL_FRAG).replace('#include <aomap_fragment>', VL_AO);
  };
  m.onBeforeCompile = m.userData.patch;
  return m;
}
/* Sol à mélange : une surface de fond (map) et trois couches (répartition dans tSplat : r, g, b ; a = salissure).
   L : { base, l1, l2, l3 (surfaces de TEX), pom (profondeur du relief de chaque couche, m), dirt (teinte de la
   salissure, multipliée à la surface de fond), mul (part de la teinte du fond reportée sur les couches) }.
   Par défaut, celui de Khamsin : sable, pavés, dalles, asphalte. */
const GROUND_SABLE = { base: 'sand', l1: 'cobble', l2: 'pavers', l3: 'asphalt', pom: [0, 0.04, 0, 0], dirt: [0.84, 0.8, 0.76], mul: 1, env: 0.35 };
function groundMat(splat, bounds, L = GROUND_SABLE) {
  const m = worldMat({ tex: L.base, rough: 1, env: L.env, macro: 0.28 });
  m.defines.WM_SPLAT = '';
  if (POM.on) m.defines.WM_POM = '';
  // sol : 16 unités de texture avec les normales des couches et l'environnement brillant, plus que les 13 d'un Pixel (TEX_LEAN, 01a-gpu.js) : sans les
  // trois normales de couches et sans la cube map brillante, 12
  if (TEX_LEAN) { m.defines.WM_LEAN = ''; m.defines.WM_NOGLOSS = ''; }
  Object.assign(m.userData.wmU, {
    tSplat: { value: splat }, uSplatB: { value: new THREE.Vector4(bounds[0], bounds[1], 1 / bounds[2], 1 / bounds[3]) },
    tL1: { value: TEX[L.l1].map }, tL2: { value: TEX[L.l2].map }, tL3: { value: TEX[L.l3].map },
    ...(TEX_LEAN ? {} : { tN1: { value: TEX[L.l1].normal }, tN2: { value: TEX[L.l2].normal }, tN3: { value: TEX[L.l3].normal } }),
    uGS: { value: new THREE.Vector4(TEXSCALE[L.base], TEXSCALE[L.l1], TEXSCALE[L.l2], TEXSCALE[L.l3]) },
    // profondeur du relief de chaque couche (m) : seuls les pavés en ont assez pour justifier le calcul
    uPomG: { value: new THREE.Vector4(...L.pom) },
    uGDirt: { value: new V3(...L.dirt) }, uGMul: { value: L.mul },
  });
  m.userData.wmU.uWMs.value = 1 / TEXSCALE[L.base];
  m.userData.own = [splat]; // propre à la carte : libérée avec la matière
  return m;
}

/* ---------- Bibliothèque ---------- */
const TEX = {};
/* Taille d'une tuile de texture (m) : surfaces photo CC0 puis surfaces procédurales */
const TEXSCALE = {
  plaster: 3.0, plaster2: 3.2, stone: 2.2, brick: 2.6, cobble: 2.2, pavers: 2.6, asphalt: 4.5, rooftiles: 2.2, wood: 1.5, shutter: 1.3,
  sand: 4.0, dirt: 3.0, concrete: 2.5, corrugated: 2.0, paint: 1.5, steel: 1.0, charred: 2.0, cement_tiles: 1.6, canvas: 1.2, burlap: 0.6,
  rubber: 0.5, timber: 1.2, crate: 1.2, plastic: 1.0, glass: 1.5, gravel: 2.0, farfacade: 1.0, rug: 1.2, linge: 0.45, laine: 0.7, paintwood: 1.2, ashlar: 2.4, rollshutter: 1.5, cardboard: 0.8, carpaint: 1.6, lattice: 0.8,
};
/* Taille d'une tuile quand la photo remplace la surface procédurale de même nom et n'a pas sa taille (planches de caisse de 14 cm, de porte
   de 13 cm, lames de rideau de 6 cm) */
const PHOTO_SCALE = { crate: 2.0, paintwood: 1.8, rollshutter: 1.8 };
const MAT = {};
/* Textures : photos CC0 réemballées, surfaces procédurales générées sur GPU (taille réduite en qualité Basse). Construites
   au chargement d'une carte (le profil de qualité du moment décide de leur taille), libérées avec elle (freeMaterials). */
function buildTextures(T) {
  // qualité Basse : textures deux fois plus petites (quatre fois moins de mémoire graphique)
  const small = (RQ.q.lean ? (GFX_SAFE || RQ.tier === 'ultra' ? 0.35 : 0.5) : 1) * GPUX.lean.tex; // GPUX.lean : adaptation apprise sur cet appareil (01a-gpu.js)
  POM.on = !RQ.q.lean;
  // surfaces photo à relief marqué : hauteur reconstruite depuis les normales (pour la parallaxe)
  if (POM.on) for (const k of ['cobble', 'brick', 'stone', 'rooftiles', 'flagstone', 'drystone', 'ashlar', 'rock', 'galets', 'adobe', ...((CURMAP.def && CURMAP.def.texRelief) || [])]) if (T[k]) T[k].relief = true; // texRelief : relief demandé par la carte
  // photos d'une matière à masque de métal (ma) : map.a porte le masque (canal bleu de leur rugosité, build_assets.py), pas le relief
  for (const k of ['rust', 'rollshutter', 'steel']) if (T[k] && T[k].asset) { T[k].metal = true; T[k].relief = false; }
  for (const k of Object.keys(T)) if (T[k] && T[k].asset) TEX[k] = texLabPack(T[k], 1024 * small);
  // surfaces du socle (grain des armes) : reprises telles quelles, jamais libérées avec la carte
  for (const k in GUNTEX.surf) if (!TEX[k]) TEX[k] = GUNTEX.surf[k];
  // surfaces d'hiver (02i-hiver.js) : seulement pour une carte enneigée ; surfaces facultatives (kit portuaire, eau) :
  // seulement pour une carte qui les demande (surfaces de sa définition)
  const winter = !!(CURMAP.def && CURMAP.def.winter), want = new Set((CURMAP.def && CURMAP.def.surfaces) || []);
  for (const k of Object.keys(TEXLAB)) if (!TEX[k] && ((winter && !OPT_TEX.has(k)) || want.has(k) || (!WINTER_TEX.has(k) && !OPT_TEX.has(k)))) TEX[k] = texLabSurface(k, TEXLAB[k], small);
  // repli : une surface photo absente est remplacée par une surface procédurale proche
  const alias = { plaster: 'concrete', plaster2: 'concrete', stone: 'ashlar', brick: 'ashlar', cobble: 'ashlar', pavers: 'concrete', asphalt: 'concrete', rooftiles: 'crate', wood: 'crate', shutter: 'paintwood' };
  for (const [k, a] of Object.entries(alias)) if (!TEX[k]) TEX[k] = TEX[a];
  WMU.tMacro.value = texLabMacro(T.usure); if (T.usure) T.usure.dispose(); // couche d'usure scannée (02b-texlab.js)
  TEX.foliage = foliageAtlas(); TEX.signs = signAtlas(); TEX.decals = decalAtlas();
  if (winter) { TEX.conifer = coniferAtlas(); TEX.signs2 = winterSignAtlas(); TEX.decals2 = winterDecalAtlas(); } // 02i-hiver.js
  if (CURMAP.def && CURMAP.def.kit) CURMAP.def.kit(); // atlas propres à la carte
}
/* Surfaces procédurales facultatives : générées seulement pour une carte qui les demande (surfaces de sa définition) */
const OPT_TEX = new Set();
function makeMaterials() {
  const M = (k, o) => { MAT[k] = worldMat(o); };
  windInit(CURMAP.def); // direction et force du vent de la carte (02md-vent.js)
  // maçonnerie et enduits (teintés par les sommets)
  M('plaster', { tex: 'plaster', grime: 1.1, streak: 0.9, dust: 0.5, macro: 0.4, relief: 0.25 });
  M('plaster2', { tex: 'plaster2', grime: 1.1, streak: 0.8, dust: 0.5, macro: 0.4, relief: 0.25 });
  M('stone', { tex: 'stone', grime: 0.6, dust: 0.6, macro: 0.3, pom: 0.045 });
  M('brick', { tex: 'brick', grime: 0.9, streak: 0.6, dust: 0.5, macro: 0.3, pom: 0.02 });
  M('ashlar', { tex: 'ashlar', grime: 0.7, streak: 0.4, dust: 0.6, macro: 0.3, pom: 0.035 });
  M('concrete', { tex: 'concrete', grime: 0.5, streak: 0.5, dust: 0.7, macro: 0.4, relief: 0.12 });
  M('pavers', { tex: 'pavers', dust: 0.5, macro: 0.35, grime: 0.4 });
  M('cobble', { tex: 'cobble', dust: 0.4, macro: 0.3, pom: 0.04 });
  M('asphalt', { tex: 'asphalt', dust: 0.5, macro: 0.35 });
  M('rooftiles', { tex: 'rooftiles', dust: 0.35, macro: 0.35, env: 0.4, pom: 0.04 });
  M('gravel', { tex: 'gravel', macro: 0.3, dust: 0.15, color: [0.86, 0.84, 0.8], pom: 0.025 });
  M('tiles', { tex: 'cement_tiles', macro: 0.25, env: 0.6, dust: 0.25 });
  M('sand', { tex: 'sand', macro: 0.35 });
  M('dirt', { tex: 'dirt', macro: 0.35 });
  M('farfacade', { tex: 'farfacade', macro: 0.25, env: 0.3, noNormal: false });
  // bois
  M('wood', { tex: 'wood', grime: 0.6, dust: 0.35, macro: 0.2 });
  // bois massif des poteaux, poutres, lisses, planches seules et bois ronds (photo sans joints de planches) : le Maker y range d'office le
  // bois mince (boîte de moins de 30 cm dans ses deux petites dimensions, cylindre de moins de 40 cm de rayon, tube, tour) ; sans sa photo,
  // la surface du bois
  M('timber', { tex: TEX.timber ? 'timber' : 'wood', grime: 0.6, dust: 0.35, macro: 0.2 });
  M('palmbark', { tex: 'palmbark', rough: 0.95, dust: 0.12, macro: 0.3 }); // tronc de palmier (surface facultative `palmbark`, voir 02h-nature.js)
  M('shutter', { tex: 'shutter', macro: 0.15, dust: 0.2 });
  M('paintwood', { tex: 'paintwood', macro: 0.15, dust: 0.25, grime: 0.5 });
  M('crate', { tex: 'crate', macro: 0.15, dust: 0.45 });
  M('cardboard', { tex: 'cardboard', macro: 0.15, dust: 0.3 });
  M('lattice', { tex: 'lattice', cut: 0.5, rough: 0.8, macro: 0.1, dust: 0.2 });
  M('rollshutter', { tex: 'rollshutter', metal: 0.5, ma: true, env: 0.7, grime: 0.8, streak: 0.5, macro: 0.2 });
  // métaux
  M('corrugated', { tex: 'corrugated', metal: 0.8, ma: true, env: 0.9, grime: 1.2, streak: 0.6, dust: 0.35, macro: 0.25 });
  M('paint', { tex: 'paint', metal: 0.6, ma: true, env: 0.8, grime: 0.6, dust: 0.45, macro: 0.2 });
  M('carpaint', { tex: 'carpaint', metal: 0.35, ma: true, env: 1.5, dust: 0.12, macro: 0.08 }); // vernis brillant (poussière légère : les voitures sales prennent paint)
  M('steel', { tex: 'steel', metal: 0.9, ma: true, env: 1.0, dust: 0.3, macro: 0.15 });
  M('charred', { tex: 'charred', env: 0.4, dust: 0.5, macro: 0.3 });
  // menus débris dispersés au sol (cailloux, briques, gravats, tessons, déchets) : une seule matière teintée par les sommets
  M('rubble', { tex: 'concrete', scale: 0.7, macro: 0.25, dust: 0.3 });
  // matières souples
  M('canvas', { tex: 'canvas', macro: 0.2, dust: 0.35, side: THREE.DoubleSide });
  M('cloth', { tex: 'canvas', macro: 0.2, dust: 0.35, side: THREE.DoubleSide }); makeCloth(MAT.cloth); // linge au vent (02mc-tissus.js)
  M('linge', { tex: TEX.linge ? 'linge' : 'canvas', macro: 0.1, dust: 0.12, side: THREE.DoubleSide }); // linge simulé (coton photographié, sinon la toile)
  M('laine', { tex: TEX.laine ? 'laine' : 'canvas', macro: 0.2, dust: 0.4, side: THREE.DoubleSide }); // laine tissée : tentes bédouines, tapis
  M('burlap', { tex: 'burlap', macro: 0.2, dust: 0.5 });
  M('rug', { tex: 'rug', macro: 0.15, side: THREE.DoubleSide });
  M('rubber', { tex: 'rubber', env: 0.3, macro: 0.1, dust: 0.4 });
  M('plastic', { tex: 'plastic', env: 0.6, macro: 0.1, dust: 0.3 });
  M('glass', { tex: 'glass', metal: 0.85, ma: true, env: 1.3, macro: 0.1, polyOff: -2 });
  // vitre de véhicule (voitures, 4x4, cabines de camion) : verre teinté qu'on traverse du regard (l'habitacle se voit), reflet du ciel ; ni
  // ombre ni occlusion, dessinée après le décor opaque, comme la verrière (glassT). carglassD : vitre poussiéreuse, plus opaque
  for (const [k, op] of [['carglass', 0.52], ['carglassD', 0.78]]) {
    const g = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: op, depthWrite: false, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.3, side: THREE.DoubleSide });
    g.userData.noShadow = true; g.userData.noAO = true; g.userData.noReceive = true; MAT[k] = g;
  }
  M('window', { rough: 0.05, metal: 0, env: 1.0, macro: 0, snow: 0, polyOff: -2 }); windowMat(MAT.window); // vitre d'une pièce : la pièce derrière
  M('dark', { color: [0.05, 0.05, 0.05], rough: 0.95, macro: 0 });
  M('foliage', { tex: 'foliage', cut: 0.42, rough: 0.8, env: 0.35, macro: 0.3, scale: 1, noNormal: true }); makeWind(MAT.foliage, WIND_AMP.foliage, { leaf: true, cards: true }); // feuillage au vent (02md-vent.js)
  M('stem', { tex: 'canvas', macro: 0.2, dust: 0.35, side: THREE.DoubleSide }); makeWind(MAT.stem, WIND_AMP.stem); // tiges de roseaux et nervures de palmes, au vent
  M('signs', { tex: 'signs', rough: 0.7, env: 0.4, macro: 0.1, scale: 1, noNormal: true });
  // décalques (affiches, pochoirs, graffitis, coulures, taches au sol) : fondus sur les surfaces, sans ombre
  M('decals', { tex: 'decals', rough: 0.85, env: 0.3, macro: 0.2, scale: 1, noNormal: true, polyOff: -4 });
  Object.assign(MAT.decals, { transparent: true, depthWrite: false }); MAT.decals.defines.WM_CUT = ''; MAT.decals.side = THREE.FrontSide;
  MAT.decals.userData.noShadow = true;
  MAT.lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.2, 2.4, 1.4) });
  MAT.lamp.userData.noShadow = true;
  MAT.lampCool = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.5, 2.8, 3.1) }); // néon, ampoule froide (PF.hangLamp)
  MAT.lampCool.userData.noShadow = true;
  // lampadaire éteint en plein jour : verre dépoli, à peine une lueur
  M('lampOff', { color: [0.92, 0.9, 0.84], rough: 0.25, env: 1.1, macro: 0, emissive: [0.18, 0.14, 0.08] });
  if (CURMAP.def && CURMAP.def.winter) makeWinterMaterials(M); // 02i-hiver.js
  if (CURMAP.def && CURMAP.def.materials) CURMAP.def.materials(M); // matières propres à la carte
  // compatibilité : anciennes clés
  MAT.metal = MAT.corrugated; MAT.fabric = MAT.burlap; MAT.trim = MAT.paintwood;
}
/* Ombres en cascade sur les matières du décor (une fois par matière ; le socle est préparé par setupShadows).
   Chaque matière reçoit aussi un identifiant fixe, tiré de sa clé : three.js garde en cache, par identifiant de
   matière et sans jamais le libérer, la matière d'ombre des matières à découpe alpha (feuillages, treillis). Avec un
   identifiant neuf à chaque chargement de carte, ce cache grossirait d'une partie à l'autre ; ainsi il est réutilisé. */
function shadeMaterials() {
  for (const [k, m] of Object.entries(MAT)) {
    if (m.userData.csm) continue;
    m.userData.csm = true; m.uuid = 'decor-' + k; csmMaterial(m);
  }
  propMatsSync(); // copies des matières pour les props physiques (02k-dynprops.js)
}
/* Atlas dessiné : la toile ne sert plus une fois l'image envoyée à la carte graphique (jusqu'à 4 Mo chacune) */
function canvasOnce(t) {
  t.onUpdate = () => { t.image = { width: t.image.width, height: t.image.height }; t.onUpdate = null; };
  return t;
}
/* Libère la bibliothèque de matières au déchargement d'une carte : matières (et programmes de shaders qui ne servent
   plus qu'à elles), textures qu'elles possèdent (m.userData.own), surfaces et atlas. Les surfaces du socle restent. */
function freeMaterials() {
  const keep = new Set();
  for (const k in GUNTEX.surf) keep.add(GUNTEX.surf[k].map).add(GUNTEX.surf[k].normal);
  for (const m of new Set(Object.values(MAT))) {
    if (csm) csm.shaders.delete(m);
    for (const t of m.userData.own || []) freeTexture(t);
    m.dispose();
  }
  const seen = new Set();
  for (const s of Object.values(TEX)) for (const t of s.isTexture ? [s] : [s.map, s.normal]) if (t && !keep.has(t) && !seen.has(t)) { seen.add(t); freeTexture(t); }
  freeTexture(WMU.tMacro.value); WMU.tMacro.value = null;
  for (const k in MAT) delete MAT[k];
  for (const k in TEX) delete TEX[k];
}

/* ---------- Atlas dessinés (feuillages, enseignes) ---------- */
/* Feuillages (1024², alpha) : [0, 0.5]x[0, 1] palmes (verte à gauche du rachis, sèche à droite, voir foliagePalms) ; [0.5, 1]x[0.5, 1] buisson ; [0.5, 1]x[0, 0.5] herbes et fleurs */
const FOL = { palm: [0, 0, 0.5, 1], bush: [0.5, 0.5, 0.5, 0.5], grass: [0.5, 0, 0.25, 0.5], flower: [0.75, 0, 0.25, 0.5] };
/* Sprites de palme du feuillage (région FOL.palm : moitié gauche de l'atlas, deux demi-palmes de 256 x 1024 qui se rejoignent sur le rachis) :
   à gauche la palme verte (folioles vers la gauche), à droite la palme sèche (vers la droite). Base en bas, bout en haut ; les folioles
   partent du rachis vers le bout, serrées au pied (masse pleine qui garde la palme à distance, quand la découpe alpha s'efface),
   de plus en plus écartées vers l'extérieur (bord plumeux, on voit le ciel entre les pointes). */
function foliagePalms(g, S, R) {
  const H = S, X0 = S * 0.25, N = 128;
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  for (const dry of [false, true]) {
    const dir = dry ? 1 : -1;
    // folioles, de la base (en bas) au bout (en haut) ; les plus longues vers le tiers, raccourcies près du bout
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), y = H * (1 - 0.012 - 0.975 * t);
      const ang = (R() - 0.5) * 0.16, reach = (230 + R() * 20) * (0.5 + 0.5 * Math.min(1, t / 0.07)) * (1 - 0.5 * Math.pow(Math.max(0, (t - 0.8) / 0.2), 1.3)), fwd = reach * (0.66 + ang + R() * 0.16) * (1 - 0.22 * t);
      const w = 5 + R() * 2.8, tip = [X0 + dir * reach, y - fwd], mid = [X0 + dir * reach * 0.5, y - fwd * 0.3 - 7 * (0.6 + R())];
      const jh = (R() - 0.5) * 12, jl = (R() - 0.5) * 9;
      const gr = g.createLinearGradient(X0, y, tip[0], tip[1]);
      if (dry) { gr.addColorStop(0, hsl(32 + jh * 0.4, 40, 31 + jl)); gr.addColorStop(0.5, hsl(36 + jh * 0.4, 50, 46 + jl)); gr.addColorStop(1, hsl(41 + jh * 0.4, 60, 62 + jl)); }
      else { gr.addColorStop(0, hsl(98 + jh, 42, 25 + jl)); gr.addColorStop(0.5, hsl(81 + jh, 52, 40 + jl)); gr.addColorStop(1, hsl(63 + jh, 62, 56 + jl)); }
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(X0, y + 3.5);
      g.quadraticCurveTo(mid[0], mid[1] + w, tip[0], tip[1]);
      g.quadraticCurveTo(mid[0], mid[1] - w, X0, y - 3.5); g.closePath(); g.fill();
      if (!dry || R() < 0.7) { g.strokeStyle = dry ? hsl(44, 52, 72, 0.4) : hsl(70 + jh, 55, 62, 0.4); g.lineWidth = 1.1; g.beginPath(); g.moveTo(X0, y); g.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); g.stroke(); }
    }
    // rachis : clair, épais au pied, fin au bout, de part et d'autre de la jonction des deux demi-palmes
    g.lineCap = 'round';
    for (let k = 0; k < 24; k++) {
      const t0 = k / 24, t1 = (k + 1) / 24, w = 20 - 15 * t0;
      g.strokeStyle = dry ? hsl(34, 36, 44) : hsl(54, 36, 46); g.lineWidth = w;
      g.beginPath(); g.moveTo(X0, H * (1 - t0)); g.lineTo(X0, H * (1 - t1)); g.stroke();
    }
  }
}
function foliageAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = rngOf(77);
  const col = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  foliagePalms(g, S, rngOf(78)); // palmes verte et sèche (moitié gauche de l'atlas)
  // buisson : amas de petites feuilles
  {
    const cx = S * 0.75, cy = S * 0.25, r = S * 0.22;
    for (let i = 0; i < 1400; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * r, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9;
      const l = 18 + R() * 18 + (1 - d / r) * -6 + (y < cy ? 6 : 0);
      g.fillStyle = col(80 + R() * 25, 35 + R() * 15, l);
      g.save(); g.translate(x, y); g.rotate(R() * TAU); g.beginPath(); g.ellipse(0, 0, 9 + R() * 6, 4 + R() * 2.5, 0, 0, TAU); g.fill(); g.restore();
    }
  }
  // touffe d'herbes sèches
  {
    const x0 = S * 0.625, yb = S;
    for (let i = 0; i < 160; i++) {
      const x = x0 + (R() - 0.5) * S * 0.18, hgt = S * (0.18 + R() * 0.3), bend = (R() - 0.5) * S * 0.12;
      g.strokeStyle = col(40 + R() * 30, 30 + R() * 25, 35 + R() * 25); g.lineWidth = 2 + R() * 2;
      g.beginPath(); g.moveTo(x, yb); g.quadraticCurveTo(x + bend * 0.3, yb - hgt * 0.6, x + bend, yb - hgt); g.stroke();
    }
  }
  // bougainvillier : feuilles et bractées magenta
  {
    const cx = S * 0.875, cy = S * 0.75, r = S * 0.11;
    for (let i = 0; i < 900; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * r * 1.1, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 1.9;
      const fl = R() < 0.45;
      g.fillStyle = fl ? col(318 + R() * 16, 62 + R() * 20, 42 + R() * 14) : col(95 + R() * 20, 40, 20 + R() * 12);
      g.save(); g.translate(x, y); g.rotate(R() * TAU); g.beginPath(); g.ellipse(0, 0, fl ? 6 : 8, fl ? 5 : 4, 0, 0, TAU); g.fill(); g.restore();
    }
  }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Enseignes (1024 x 1024, 8 panneaux de 512 x 256) : noms de boutiques peints, affiches */
const SIGNS = ['ÉPICERIE', 'PHARMACIE', 'CAFÉ DU SOUK', 'BOULANGERIE', 'GARAGE', 'HÔTEL', 'TAILLEUR', 'TÉLÉPHONE'];
function signAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  const R = rngOf(91);
  const bgs = ['#1f4f6b', '#8a2a1e', '#e8dcc0', '#2f5d3a', '#c9a33b', '#3b3b3b', '#6d3f7a', '#d9d2c1'];
  const fgs = ['#f1e6c9', '#f5e9d0', '#8a2a1e', '#f1e6c9', '#2a2014', '#e9c46a', '#f5e9d0', '#1f4f6b'];
  for (let i = 0; i < 8; i++) {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
    g.fillStyle = bgs[i]; g.fillRect(x, y, 512, 256);
    // cadre, lettres, usure
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 10; g.strokeRect(x + 10, y + 10, 492, 236);
    g.fillStyle = fgs[i]; g.font = `bold ${SIGNS[i].length > 9 ? 62 : 84}px Georgia, 'Times New Roman', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(SIGNS[i], x + 256, y + 132);
    for (let k = 0; k < 900; k++) {
      g.fillStyle = `rgba(${R() < 0.5 ? '255,245,225' : '40,30,20'},${R() * 0.12})`;
      g.fillRect(x + R() * 512, y + R() * 256, 1 + R() * 5, 1 + R() * 3);
    }
    const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.35)');
    g.fillStyle = gr; g.fillRect(x, y, 512, 256);
  }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Décalques (1024², grille 4 x 4, alpha) : 0 à 3 affiches, 4 et 5 pochoirs, 6 et 7 graffitis, 8 coulure,
   9 salissure, 10 fissure, 11 impacts, 12 tache d'huile, 13 traces de pneus, 14 flaque sèche, 15 marquage */
function decalAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(4321), T = S / 4;
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  const posters = [['#d8c9a3', '#8a2a1e', 'GRAND\nCONCERT'], ['#e9e2cf', '#1f4f6b', 'ÉLECTIONS'], ['#c94f2c', '#f1e6c9', 'FÊTE\nDU VILLAGE'], ['#2f5d3a', '#e9c46a', 'CIRQUE']];
  posters.forEach(([bg, fg, txt], i) => cell(i, () => {
    const x = 34 + R() * 10, y = 20, w = T - 70, h = T - 40;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = fg; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center';
    txt.split('\n').forEach((l, k) => g.fillText(l, x + w / 2, y + 60 + k * 36));
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.2})`; g.fillRect(x + 20, y + 120 + k * 14, w - 40 - R() * 60, 6); }
    // déchirures, délavage
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 9; k++) { g.beginPath(); const ex = x + (R() < 0.5 ? 0 : w), ey = y + R() * h; g.moveTo(ex, ey); for (let j = 0; j < 5; j++) g.lineTo(ex + (R() - 0.5) * 60, ey + (R() - 0.5) * 60); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,250,235,0.35)'); gr.addColorStop(1, 'rgba(90,70,40,0.25)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  }));
  [['DÉFENSE\nD\'AFFICHER', '#1a1a1a'], ['STATIONNEMENT\nINTERDIT', '#7a1a12']].forEach(([txt, col], k) => cell(4 + k, () => {
    g.fillStyle = col; g.font = 'bold 26px Arial, sans-serif'; g.textAlign = 'center';
    txt.split('\n').forEach((l, j) => g.fillText(l, T / 2, 110 + j * 34));
    g.globalCompositeOperation = 'destination-out'; for (let j = 0; j < 400; j++) { g.fillStyle = `rgba(0,0,0,${R()})`; g.fillRect(R() * T, R() * T, 2 + R() * 4, 2 + R() * 3); } g.globalCompositeOperation = 'source-over';
  }));
  for (const k of [6, 7]) cell(k, () => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const col = k === 6 ? '#1b1b1b' : '#b3261e';
    for (let s = 0; s < 3; s++) {
      g.strokeStyle = col; g.lineWidth = 7 + R() * 5; g.beginPath();
      let x = 30 + s * 60 + R() * 20, y = 150 + (R() - 0.5) * 40; g.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += 8 + R() * 20; y += (R() - 0.5) * 90; g.quadraticCurveTo(x - 10, y - 40 * (R() - 0.5), x, y); }
      g.stroke();
    }
    g.fillStyle = col; for (let j = 0; j < 60; j++) g.fillRect(20 + R() * (T - 40), 90 + R() * 130, 2, 2);
  });
  cell(8, () => { const gr = g.createLinearGradient(0, 0, 0, T); gr.addColorStop(0, 'rgba(40,32,24,0.55)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = gr; for (let j = 0; j < 14; j++) { const x = T * 0.3 + R() * T * 0.4, w = 6 + R() * 18; g.fillRect(x, 0, w, T * (0.4 + R() * 0.6)); } });
  cell(9, () => { for (let j = 0; j < 40; j++) { const x = T / 2 + (R() - 0.5) * T * 0.6, y = T / 2 + (R() - 0.5) * T * 0.6, r = 10 + R() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(45,36,26,0.18)'); gr.addColorStop(1, 'rgba(45,36,26,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); } });
  cell(10, () => { g.strokeStyle = 'rgba(30,24,18,0.8)'; g.lineWidth = 2; const br = (x, y, a, l, d) => { if (d > 4 || l < 6) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a + (R() - 0.5) * 0.9, l * 0.75, d + 1); if (R() < 0.4) br(x2, y2, a + (R() - 0.5) * 2, l * 0.5, d + 1); }; br(T / 2, 10, Math.PI / 2, 60, 0); });
  cell(11, () => { for (let j = 0; j < 9; j++) { const x = 40 + R() * (T - 80), y = 40 + R() * (T - 80), gr = g.createRadialGradient(x, y, 0, x, y, 16); gr.addColorStop(0, 'rgba(15,12,10,0.95)'); gr.addColorStop(0.35, 'rgba(60,50,40,0.7)'); gr.addColorStop(1, 'rgba(120,100,80,0)'); g.fillStyle = gr; g.fillRect(x - 20, y - 20, 40, 40); } });
  cell(12, () => { for (let j = 0; j < 30; j++) { const x = T / 2 + (R() - 0.5) * 120, y = T / 2 + (R() - 0.5) * 90, r = 20 + R() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(12,10,9,0.3)'); gr.addColorStop(1, 'rgba(12,10,9,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); } });
  cell(13, () => { for (const x of [T * 0.3, T * 0.7]) for (let y = 0; y < T; y += 6) { g.fillStyle = `rgba(25,20,15,${0.1 + R() * 0.15})`; g.fillRect(x - 14 + (R() - 0.5) * 3, y, 28, 4); } });
  cell(14, () => { const gr = g.createRadialGradient(T / 2, T / 2, 10, T / 2, T / 2, T * 0.45); gr.addColorStop(0, 'rgba(70,55,40,0.25)'); gr.addColorStop(0.8, 'rgba(70,55,40,0.12)'); gr.addColorStop(1, 'rgba(70,55,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); });
  cell(15, () => { g.fillStyle = 'rgba(235,230,215,0.85)'; g.beginPath(); g.moveTo(T / 2, 20); g.lineTo(T - 60, 110); g.lineTo(T / 2 + 28, 110); g.lineTo(T / 2 + 28, T - 20); g.lineTo(T / 2 - 28, T - 20); g.lineTo(T / 2 - 28, 110); g.lineTo(60, 110); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; for (let j = 0; j < 500; j++) { g.fillStyle = `rgba(0,0,0,${R() * 0.8})`; g.fillRect(R() * T, R() * T, 3, 3); } g.globalCompositeOperation = 'source-over'; });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Décalque i de l'atlas : quadrilatère (points [x,y,z] du repère courant) légèrement décollé de la surface */
function decalQuad(M, i, p0, p1, p2, p3, n) {
  const u0 = (i % 4) * 0.25, v0 = Math.floor(i / 4) * 0.25, B = M.buf('decals', (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2);
  M.save(); M.cls = 1;
  const ids = [[p0, u0, v0 + 0.25], [p1, u0 + 0.25, v0 + 0.25], [p2, u0 + 0.25, v0], [p3, u0, v0]].map(([p, u, v]) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], u, v));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
/* Décalque sur un mur (repère de façade : x le long, y en haut, z vers l'extérieur) */
function wallDecal(M, i, xc, y, w, h) { decalQuad(M, i, [xc - w / 2, y, 0.008], [xc + w / 2, y, 0.008], [xc + w / 2, y + h, 0.008], [xc - w / 2, y + h, 0.008], [0, 0, 1]); }
/* Décalque au sol (monde) : centre, taille, rotation */
function groundDecal(i, x, z, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (a, b) => [x + a * c - b * s, 0.012, z + a * s + b * c];
  decalQuad(DECOR, i, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), [0, 1, 0]);
}
/* Coordonnées (u0, v0, du, dv) d'une enseigne de l'atlas */
function signUV(i) { i = ((i % 8) + 8) % 8; return [(i % 2) * 0.5, Math.floor(i / 2) * 0.25, 0.5, 0.25]; }
