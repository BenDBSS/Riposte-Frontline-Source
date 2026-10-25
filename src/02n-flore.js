/* ==========================================================================
   FLORE : le moteur de végétation de Hortus.
   - Surfaces procédurales (pelouse, gravier d'allée, humus, écorce, haie, rocaille) ajoutées au laboratoire de textures,
     à demander dans `surfaces` de la définition de la carte.
   - Matières vivantes (leafA, leafB, cane) : MeshStandardMaterial du décor retouchée par un petit shader. Chaque sommet porte
     un poids de souplesse (attribut aSw, 0 : fixe, 1 : libre, voir GeoBuf dans 02a-kit.js). Le shader y applique un vent
     lent (rafales, balancement) et un frémissement, puis le décalage lu dans le champ de souplesse (BEND) : les feuilles
     s'écartent au passage d'un soldat, reviennent en oscillant, et les explosions les couchent. Coût fixe : une lecture de
     texture par sommet vivant (au-delà de 70 m, rien), quel que soit le nombre de soldats.
   - Champ de souplesse (BEND) : grille de 25 cm sur la zone de jeu. Chaque soldat y imprime une poussée radiale (plus forte
     s'il court) ; chaque cellule touchée est un ressort amorti (position, vitesse) simulé en JavaScript tant qu'elle bouge,
     puis rendu au sommeil. Seules les cellules actives coûtent ; la texture n'est renvoyée à la carte graphique que si
     quelque chose bouge.
   - Primitives de feuillage (leafQuadUV, leafQuad, frondStrip, palmStrip) : cartes découpées à une seule face (la normale
     n'est pas retournée à l'arrière : lumière douce des deux côtés, moitié moins de triangles que les cartes à deux faces).
   ========================================================================== */
/* ---------- Surfaces procédurales ---------- */
Object.assign(TEXLAB, {
  /* pelouse : brins, touffes, ton qui varie de l'herbe grasse à l'herbe sèche, pâquerettes et boutons d'or */
  lawn: [1024, 61, 1.2, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(14.0), 4, 2.0);
    float b1 = vn(uv * 384.0, vec2(384.0), 3.0), b2 = vn(uv * vec2(160.0, 300.0), vec2(160.0, 300.0), 7.0);
    vec4 cl = vor(uv, vec2(11.0), 4.0, 1.0); float tuft = 1.0 - smoothstep(0.0, 0.5, cl.x);
    h = big * 0.15 + mid * 0.25 + (b1 * 0.5 + b2 * 0.5) * 0.35 + tuft * 0.25;
    vec3 g1 = srgb(vec3(0.12, 0.28, 0.06)), g2 = srgb(vec3(0.25, 0.44, 0.09)), g3 = srgb(vec3(0.44, 0.54, 0.16));
    vec3 c = mix(g1, g2, smoothstep(0.25, 0.7, mid * 0.7 + big * 0.5));
    c = mix(c, g3, smoothstep(0.55, 0.82, big + (mid - 0.5) * 0.3) * 0.6);
    c *= 0.74 + b1 * 0.22 + b2 * 0.2 + tuft * 0.12;
    vec4 fl = vor(uv, vec2(41.0), 9.0, 1.0); float fd = (1.0 - smoothstep(0.035, 0.075, fl.x)) * step(0.9, fl.z);
    c = mix(c, mix(vec3(0.95, 0.95, 0.92), srgb(vec3(0.98, 0.82, 0.12)), step(0.55, fract(fl.z * 31.0))), fd);
    a = c; r = 0.93; x = h;`],
  /* gravier fin des allées : gravillons clairs, grains sombres */
  pathgravel: [1024, 63, 3.0, `
    vec4 v = vor(uv, vec2(54.0), 1.0, 1.0), v2 = vor(uv + 0.5, vec2(90.0), 2.0, 1.0);
    float s1 = smoothstep(0.0, 0.2, v.w), s2 = smoothstep(0.0, 0.18, v2.w);
    float big = gfbm(uv, vec2(4.0), 5, 3.0), fine = vn(uv * 512.0, vec2(512.0), 5.0);
    h = max(s1 * (0.5 + v.z * 0.4), s2 * 0.55) * 0.9 + fine * 0.1;
    vec3 st = mix(srgb(vec3(0.62, 0.55, 0.43)), srgb(vec3(0.86, 0.8, 0.68)), v.z), st2 = mix(srgb(vec3(0.7, 0.66, 0.58)), srgb(vec3(0.9, 0.86, 0.76)), v2.z);
    a = mix(srgb(vec3(0.38, 0.33, 0.27)), mix(st, st2, step(0.5, s2 - s1 + 0.5)), max(s1, s2 * 0.9)) * (0.86 + big * 0.2 + fine * 0.1);
    r = 0.9; x = h;`],
  /* humus : terre sombre, feuilles mortes, plaques de mousse */
  humus: [1024, 65, 2.0, `
    float big = gfbm(uv, vec2(4.0), 5, 1.0), mid = gfbm(uv, vec2(18.0), 4, 2.0), gr = vn(uv * 300.0, vec2(300.0), 3.0);
    vec4 lv = vor(uv, vec2(36.0), 5.0, 1.0); float leaf = (1.0 - smoothstep(0.1, 0.3, lv.x)) * step(0.35, lv.z);
    float moss = smoothstep(0.55, 0.8, gfbm(uv, vec2(6.0), 5, 4.0));
    h = big * 0.3 + mid * 0.25 + gr * 0.15 + leaf * 0.2;
    vec3 soil = mix(srgb(vec3(0.22, 0.15, 0.095)), srgb(vec3(0.42, 0.29, 0.18)), mid) * (0.8 + gr * 0.3);
    vec3 lf = mix(srgb(vec3(0.5, 0.28, 0.1)), srgb(vec3(0.7, 0.5, 0.15)), lv.z);
    a = mix(soil, lf * (0.7 + gr * 0.3), leaf * 0.85);
    a = mix(a, srgb(vec3(0.16, 0.3, 0.1)) * (0.8 + gr * 0.4), moss * 0.7);
    r = 0.96; x = h;`],
  /* écorce : crêtes verticales, creux sombres, plaques de lichen */
  bark: [512, 67, 2.4, `
    float fis = gfbm(uv, vec2(14.0, 1.0), 5, 1.0), rg = 1.0 - abs(fis * 2.0 - 1.0), lump = gfbm(uv, vec2(6.0, 3.0), 4, 3.0);
    h = rg * 0.7 + lump * 0.25;
    a = mix(srgb(vec3(0.2, 0.15, 0.11)), srgb(vec3(0.48, 0.4, 0.32)), smoothstep(0.25, 0.8, rg)) * (0.8 + lump * 0.3);
    float mo = smoothstep(0.62, 0.85, gfbm(uv, vec2(3.0), 5, 5.0)); a = mix(a, srgb(vec3(0.3, 0.38, 0.16)), mo * 0.4);
    r = 0.95; x = h;`],
  /* haie taillée : feuilles serrées en pastilles, ombres entre les amas (opaque) */
  hedge: [512, 69, 2.0, `
    vec4 v = vor(uv, vec2(28.0), 3.0, 1.0), v2 = vor(uv + 0.37, vec2(56.0), 8.0, 1.0);
    float big = gfbm(uv, vec2(4.0), 4, 2.0), lf = smoothstep(0.0, 0.25, v.w), lf2 = smoothstep(0.0, 0.2, v2.w);
    h = lf * 0.5 + lf2 * 0.4 + v.z * 0.1;
    vec3 g = mix(srgb(vec3(0.06, 0.18, 0.05)), srgb(vec3(0.18, 0.4, 0.09)), v.z), g2 = mix(srgb(vec3(0.09, 0.24, 0.06)), srgb(vec3(0.28, 0.5, 0.13)), v2.z);
    a = mix(g * 0.45, mix(g, g2, 0.5), max(lf, lf2 * 0.7)) * (0.85 + big * 0.3);
    r = 0.8; x = h;`],
  /* rocaille : grès ocre aux strates horizontales ondulées, grain fin, fissures fines suivant des blocs, plaques de mousse basses */
  rocaille: [1024, 71, 2.6, `
    vec2 w = vec2(gfbm(uv, vec2(3.0), 4, 1.0), gfbm(uv + 0.31, vec2(3.0), 4, 2.0)) - 0.5;
    float sy = uv.y * 14.0 + w.x * 2.4 + gfbm(uv, vec2(2.0, 6.0), 3, 3.0) * 1.4;
    float strata = sin(sy * 6.2831853) * 0.5 + 0.5, ledge = smoothstep(0.86, 1.0, strata);
    float big = gfbm(uv + w * 0.15, vec2(4.0), 5, 5.0), mid = gfbm(uv, vec2(16.0), 4, 8.0), grain = vn(uv * 384.0, vec2(384.0), 9.0), g2 = vn(uv * 128.0, vec2(128.0), 4.0);
    vec4 cv = vor(uv + w * 0.22, vec2(4.0, 6.0), 7.0, 1.0); float crack = (1.0 - smoothstep(0.0, 0.025, cv.w)) * step(0.6, cv.z);
    h = big * 0.45 + mid * 0.2 + strata * 0.12 + ledge * 0.12 + grain * 0.12 + g2 * 0.12 - crack * 0.4;
    vec3 tn = mix(srgb(vec3(0.6, 0.5, 0.38)), srgb(vec3(0.84, 0.73, 0.57)), big * 0.8 + strata * 0.25), gy = srgb(vec3(0.6, 0.54, 0.46));
    a = mix(tn, gy, smoothstep(0.45, 0.8, mid) * 0.45) * (0.9 + grain * 0.1 + g2 * 0.1);
    a *= 1.0 - crack * 0.35 - ledge * 0.12; a = mix(a, srgb(vec3(0.2, 0.28, 0.1)), smoothstep(0.7, 0.9, gfbm(uv, vec2(6.0), 4, 11.0)) * 0.4 * (1.0 - strata));
    r = 0.92; x = h;`],
  /* façade d'immeuble parisien, une travée d'un étage (3,4 m x 3,3 m) : pierre de taille, haute porte-fenêtre à petits bois, garde-corps de fer forgé */
  haussmann: [512, 93, 1.0, `
    vec2 p = uv; float big = gfbm(uv, vec2(2.0), 4, 3.0), grain = vn(uv * 256.0, vec2(256.0), 2.0);
    float course = smoothstep(0.0, 0.03, abs(fract(p.y * 3.0) - 0.5) - 0.47) * 0.5;
    float win = step(abs(p.x - 0.5), 0.17) * step(0.08, p.y) * step(p.y, 0.8);
    float frame = step(abs(p.x - 0.5), 0.22) * step(0.05, p.y) * step(p.y, 0.86) * (1.0 - win);
    float lintel = step(abs(p.x - 0.5), 0.25) * step(0.86, p.y) * step(p.y, 0.92);
    float mull = win * max(step(abs(p.x - 0.5), 0.012), step(abs(p.y - 0.58), 0.012));
    float rail = step(abs(p.x - 0.5), 0.3) * step(0.04, p.y) * step(p.y, 0.3) * (1.0 - step(0.55, fract(p.x * 34.0))) + step(abs(p.x - 0.5), 0.3) * step(abs(p.y - 0.31), 0.012);
    float sill = step(abs(p.x - 0.5), 0.3) * step(0.02, p.y) * step(p.y, 0.05);
    float cornice = step(0.95, p.y) * 0.4 - step(p.y, 0.04) * 0.15;
    h = -win * 0.6 + frame * 0.25 + lintel * 0.3 + sill * 0.3 + cornice - course * 0.2 + grain * 0.04;
    vec3 stone = mix(srgb(vec3(0.84, 0.78, 0.66)), srgb(vec3(0.9, 0.85, 0.74)), big) * (0.9 + grain * 0.1 - course * 0.35);
    vec3 glass = mix(srgb(vec3(0.09, 0.12, 0.16)), srgb(vec3(0.42, 0.52, 0.6)), smoothstep(0.1, 0.8, p.y) * 0.8);
    a = stone; a = mix(a, srgb(vec3(0.93, 0.89, 0.8)), max(frame, max(lintel, sill)));
    a = mix(a, glass, win); a = mix(a, srgb(vec3(0.82, 0.8, 0.74)), mull); a = mix(a, srgb(vec3(0.05, 0.05, 0.055)), rail * 0.95);
    r = mix(0.9, 0.18, win); x = h;`],
  /* rez-de-chaussée d'une travée (3,4 m x 4,2 m) : bossage de pierre, grande baie cintrée vitrée ou porte sombre */
  haussrdc: [512, 95, 1.0, `
    vec2 p = uv; float big = gfbm(uv, vec2(2.0), 4, 5.0), grain = vn(uv * 256.0, vec2(256.0), 4.0);
    float joint = step(0.93, fract(p.y * 6.0)) * 0.6 + step(0.96, fract(p.x * 4.0 + 0.5 * step(0.5, fract(p.y * 3.0)))) * 0.3;
    float dx = abs(p.x - 0.5), top = 0.62, arch = step(dx, 0.3) * step(p.y, top + sqrt(max(0.0, 0.09 - dx * dx)) * 0.8) * step(0.02, p.y);
    float surround = step(dx, 0.34) * step(p.y, top + sqrt(max(0.0, 0.1156 - dx * dx)) * 0.8 + 0.02) * (1.0 - arch);
    float mull = arch * max(step(dx, 0.01), step(abs(p.y - 0.4), 0.012));
    h = -arch * 0.7 + surround * 0.2 - joint * 0.3 + grain * 0.04;
    vec3 stone = mix(srgb(vec3(0.8, 0.74, 0.62)), srgb(vec3(0.88, 0.82, 0.7)), big) * (0.92 + grain * 0.1 - joint * 0.4);
    vec3 shop = mix(srgb(vec3(0.07, 0.08, 0.09)), srgb(vec3(0.36, 0.3, 0.2)), smoothstep(0.0, 0.6, p.y) * step(0.5, fract(p.x * 9.0)) * 0.5);
    a = mix(stone, srgb(vec3(0.9, 0.85, 0.75)), surround); a = mix(a, shop, arch); a = mix(a, srgb(vec3(0.7, 0.62, 0.35)), mull);
    r = mix(0.9, 0.3, arch); x = h;`],
  /* chaussée pavée sombre : pavés carrés en quinconce, joints sombres */
  pave: [512, 97, 1.0, `
    vec2 q = uv * vec2(24.0, 24.0); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 f = fract(q), id = floor(q); float cell = abs(f.x - 0.5) < 0.43 && abs(f.y - 0.5) < 0.43 ? 1.0 : 0.0;
    float n = vn(id, vec2(64.0), 7.0), fine = vn(uv * 256.0, vec2(256.0), 6.0);
    h = cell * (0.6 + n * 0.3) + fine * 0.05;
    vec3 c = mix(srgb(vec3(0.3, 0.3, 0.32)), srgb(vec3(0.5, 0.49, 0.47)), n) * (0.88 + fine * 0.2);
    a = mix(srgb(vec3(0.1, 0.1, 0.11)), c, cell); r = 0.92; x = h;`],
  /* dalles de pierre claire des allées et des margelles */
  flagstone: [1024, 73, 2.2, `
    vec4 v = vor(uv, vec2(6.0), 3.0, 0.8); float e = smoothstep(0.0, 0.09, v.w), big = gfbm(uv, vec2(3.0), 4, 1.0), nb = gfbm(uv, vec2(24.0), 3, 2.0);
    h = e * (0.6 + v.z * 0.2 + nb * 0.15);
    vec3 st = mix(srgb(vec3(0.7, 0.65, 0.56)), srgb(vec3(0.86, 0.82, 0.72)), v.z) * (0.88 + big * 0.2 + nb * 0.1);
    a = mix(srgb(vec3(0.26, 0.24, 0.2)), st, e); a = mix(a, srgb(vec3(0.3, 0.38, 0.16)), smoothstep(0.7, 0.9, gfbm(uv, vec2(5.0), 4, 6.0)) * 0.3 * (1.0 - e * 0.4));
    r = 0.9; x = h;`],
});
Object.assign(TEXSCALE, { haussmann: 1, haussrdc: 1, pave: 6, lawn: 3.2, pathgravel: 1.8, humus: 2.4, bark: 1.4, hedge: 1.5, rocaille: 3.0, flagstone: 3.4, leafA: 1, leafB: 1 });
for (const k of ['lawn', 'pathgravel', 'humus', 'bark', 'hedge', 'rocaille', 'flagstone', 'haussmann', 'haussrdc', 'pave']) OPT_TEX.add(k);
/* Surfaces procédurales qu'une carte de jardin demande (à mettre dans surfaces de sa définition) */
const FLORA_SURFACES = ['lawn', 'pathgravel', 'humus', 'bark', 'hedge', 'rocaille', 'flagstone', 'ripple', 'haussmann', 'haussrdc', 'pave'];
const GROUND_FLOREAL = { base: 'lawn', l1: 'pathgravel', l2: 'flagstone', l3: 'humus', pom: [0, 0, 0.03, 0], dirt: [0.74, 0.66, 0.5], mul: 0, env: 0.45 };

/* ---------- Matières ---------- */
LIVING.add('leafA'); LIVING.add('leafB'); LIVING.add('cane'); LIVING.add('vine');
const LIVE_U = {
  uLvT: { value: 0 }, tLvB: { value: null }, uLvBnd: { value: new THREE.Vector4(0, 0, 1, 1) },
  // balancement (m au poids 1), inclinaison sous la rafale (m), poussée maximale (m), frémissement (m) ; le vent est celui de 02md-vent.js
  uLvW: { value: new THREE.Vector4(0.055, 0.09, 0.8, 0.016) },
};
const LIVE_VERT_HEAD = `#include <common>
attribute float aSw; uniform float uLvT; uniform sampler2D tLvB; uniform vec4 uLvBnd, uLvW;
${WIND_HEAD}`;
const LIVE_VERT_BODY = `#include <begin_vertex>
{
  float sw = aSw;
  if (sw > 0.001) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float lod = 1.0 - smoothstep(38.0, 70.0, distance(wp, cameraPosition));
    if (lod > 0.0) {
      float t = uLvT;
      vec3 wd = windDisp(wp, vec3(uLvW.y, uLvW.x, 0.0)); // rafale qui traverse la carte, inclinaison et balancement
      float fa = sin(t * 3.7 + dot(wp, vec3(2.1, 3.3, 1.7))) * 0.6 + sin(t * 6.1 + dot(wp, vec3(4.3, 1.9, 5.1))) * 0.4;
      vec2 fl = vec2(fa, sin(t * 4.3 + dot(wp, vec3(3.1, 2.3, 4.7)))) * uLvW.w;
      vec4 bd = texture2D(tLvB, (wp.xz - uLvBnd.xy) * uLvBnd.zw);
      vec2 push = (bd.xy - 0.5) * 2.0 * uLvW.z;
      float k = sw * lod;
      transformed.xz += (wd.xz + fl) * k + push * k;
      transformed.y += wd.y * k - length(push) * k * 0.22;
    }
  }
}`;
function livePatch(s) {
  Object.assign(s.uniforms, LIVE_U, WIND_U);
  s.vertexShader = s.vertexShader.replace('#include <common>', LIVE_VERT_HEAD).replace('#include <begin_vertex>', LIVE_VERT_BODY);
  leafLight(s);
}
/* Éclairage de feuille (matière WM_LEAF) : cartes à une seule face, la normale reste celle du sommet (inclinée vers le ciel) des deux côtés, jamais
   retournée ; diffus mat et translucidité */
function leafLight(s) {
  s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef WM_LEAF\nnormal = normalize( vNormal );\n#endif')
    .replace('#include <lights_physical_pars_fragment>', LIVE_DIRECT);
}
/* Translucidité : un feuillage éclairé par derrière laisse passer le soleil, jaune-vert (suit les ombres : la lumière directe les contient déjà) */
const LIVE_DIRECT = `#include <lights_physical_pars_fragment>
#ifdef WM_LEAF
void RE_Direct_Leaf( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  // feuille mate : diffus de Lambert (ni lobe spéculaire GGX, ni reflet de l'environnement : un feuillage de rugosité 0,85 n'en montre pas), plus la translucidité
  float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
  reflectedLight.directDiffuse += dotNL * directLight.color * BRDF_Lambert( material.diffuseColor );
  float back = saturate( dot( geometry.viewDir, - directLight.direction ) );
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * vec3( 1.0, 1.1, 0.45 ) * ( pow( back, 3.0 ) * 0.55 + 0.04 );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Leaf
#undef RE_IndirectSpecular
#endif`;
/* Rend une matière du décor vivante : feuillage découpé (leaf : normale non retournée) ou tige (sans découpe) */
function makeLiving(m, leaf) {
  m.defines.WM_LIVE = ''; if (leaf) m.defines.WM_LEAF = '';
  const base = m.userData.patch;
  m.userData.patch = (s) => { base(s); livePatch(s); };
  m.onBeforeCompile = m.userData.patch; m.userData.living = true;
  return m;
}
function makeFloraMaterials(M) {
  M('leafA', { tex: 'leafA', cut: 0.4, rough: 0.82, env: 0.2, macro: 0.18, scale: 1, noNormal: true, snow: 0, color: [0.88, 0.92, 0.84] });
  M('leafB', { tex: 'leafB', cut: 0.4, rough: 0.85, env: 0.2, macro: 0.18, scale: 1, noNormal: true, snow: 0, color: [0.9, 0.93, 0.86] });
  makeLiving(MAT.leafA, true); makeLiving(MAT.leafB, true);
  for (const k of ['leafA', 'leafB']) MAT[k].alphaToCoverage = true; // bords adoucis par le multi-échantillonnage
  M('bark', { tex: 'bark', rough: 0.95, macro: 0.3, dust: 0.1, grime: 0.5 });
  M('cane', { tex: 'bark', rough: 0.55, macro: 0.2, color: [0.9, 1, 0.6] }); makeLiving(MAT.cane, false);
  M('hedge', { tex: 'hedge', rough: 0.85, macro: 0.4, env: 0.4 });
  M('rocaille', { tex: 'rocaille', macro: 0.5, grime: 0.9, streak: 0.7, dust: 0.1, pom: 0.05, env: 0.4 });
  M('flagstone', { tex: 'flagstone', macro: 0.35, grime: 0.5, dust: 0.1, env: 0.4 });
  M('haussmann', { tex: 'haussmann', macro: 0.2, env: 0.3, grime: 0.6, streak: 0.4 });
  M('haussrdc', { tex: 'haussrdc', macro: 0.2, env: 0.3 });
  M('pave', { tex: 'pave', rough: 0.92, macro: 0.3, env: 0.3, polyOff: -2 });
  M('turf', { tex: 'lawn', rough: 0.95, macro: 0.3, env: 0.4 });
  M('mulch', { tex: 'humus', rough: 0.98, macro: 0.3, env: 0.3 });
  M('gravelpath', { tex: 'pathgravel', rough: 0.95, macro: 0.3, env: 0.4 });
  // verrière : verre clair et teinté de vert, carreaux lisibles, reflet du ciel ; ni ombre ni occlusion ; dessinée après tout le reste
  const t = glassPaneTexture(), g = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.06, metalness: 0, envMapIntensity: 0.9, side: THREE.DoubleSide });
  g.userData.noShadow = true; g.userData.noAO = true; g.userData.noReceive = true; g.userData.own = [t]; MAT.glassT = g;
}
/* Carreaux de la verrière : un carreau par mètre (voile très léger, petits bois plus marqués) */
function glassPaneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(205,232,226,0.07)'; g.fillRect(0, 0, 128, 128);
  const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0.1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(180,215,205,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(120,150,138,0.6)'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128); g.fillStyle = 'rgba(235,245,240,0.28)'; g.fillRect(0, 3, 128, 1.5); g.fillRect(3, 0, 1.5, 128);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.flipY = false; t.generateMipmaps = true;
  return t;
}
/* Atlas de la carte (appelé par buildTextures) */
function floraKit() { TEX.leafA = herbierTex('A'); TEX.leafB = herbierTex('B'); }

/* ---------- Champ de souplesse ---------- */
const BEND = { on: false, ppm: 4, x0: 0, z0: 0, w: 0, d: 0, nx: 0, nz: 0, px: null, pz: null, vx: null, vz: null, tx: null, tz: null, flag: null, act: [], data: null, tex: null, max: 0.8, tw: 0, tile: null, tiles: [] };
/* Envoi au GPU par tuiles de 32 x 32 cases (8 m de côté) : seules celles qu'un soldat ou une explosion a fait bouger repartent, au lieu de toute la
   texture à chaque image (320 x 416 cases à Hortus, un demi-mégaoctet par image tant qu'un soldat marche, sur toute la partie) */
const BEND_TILE = 32;
const BEND_K = 80, BEND_C = 6.5;
/* Texture neutre (aucun décalage) tant que la carte n'a pas son champ : une texture absente serait lue comme noire, soit une poussée maximale */
const BEND_NEUTRAL = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1, THREE.RGBAFormat); BEND_NEUTRAL.needsUpdate = true;
LIVE_U.tLvB.value = BEND_NEUTRAL;
function bendInit(b) {
  const m = 2, x0 = b.x0 - m, z0 = b.z0 - m, w = b.x1 - b.x0 + 2 * m, d = b.z1 - b.z0 + 2 * m, nx = Math.ceil(w * BEND.ppm), nz = Math.ceil(d * BEND.ppm), n = nx * nz;
  const tw = Math.ceil(nx / BEND_TILE), th = Math.ceil(nz / BEND_TILE);
  Object.assign(BEND, { on: true, x0, z0, w, d, nx, nz, px: new Float32Array(n), pz: new Float32Array(n), vx: new Float32Array(n), vz: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n), flag: new Uint8Array(n), act: [], tw, tile: new Uint8Array(tw * th), tiles: [] });
  BEND.data = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { BEND.data[i * 4] = BEND.data[i * 4 + 1] = 128; BEND.data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(BEND.data, nx, nz, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.needsUpdate = true;
  BEND.tex = t; LIVE_U.tLvB.value = t; LIVE_U.uLvBnd.value.set(x0, z0, 1 / w, 1 / d);
}
function bendClear() {
  if (BEND.tex) BEND.tex.dispose();
  Object.assign(BEND, { on: false, px: null, pz: null, vx: null, vz: null, tx: null, tz: null, flag: null, act: [], data: null, tex: null, tile: null, tiles: [] });
  LIVE_U.tLvB.value = BEND_NEUTRAL; LIVE_U.uLvBnd.value.set(0, 0, 1, 1);
}
/* Poussée circulaire de rayon r en (x, z) : cible de déplacement k (m) à l'écart, avec un biais vers (vx, vz) ; impulse : coup sec (vitesse) */
function bendStamp(x, z, r, k, vx, vz, impulse) {
  const B = BEND, i0 = Math.max(0, Math.floor((x - r - B.x0) * B.ppm)), i1 = Math.min(B.nx - 1, Math.ceil((x + r - B.x0) * B.ppm));
  const j0 = Math.max(0, Math.floor((z - r - B.z0) * B.ppm)), j1 = Math.min(B.nz - 1, Math.ceil((z + r - B.z0) * B.ppm));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = B.x0 + (i + 0.5) / B.ppm - x, dz = B.z0 + (j + 0.5) / B.ppm - z, d2 = dx * dx + dz * dz; if (d2 >= r * r) continue;
    const d = Math.sqrt(d2), f = (1 - d / r) * (1 - d / r); let ux, uz;
    if (d > 0.05) { ux = dx / d; uz = dz / d; } else { const l = hyp(vx, vz) || 1; ux = vx / l; uz = vz / l; }
    ux += vx * 0.1; uz += vz * 0.1;
    const c = j * B.nx + i; if (!B.flag[c]) { B.flag[c] = 1; B.act.push(c); }
    if (impulse) { B.vx[c] += ux * k * f; B.vz[c] += uz * k * f; } else { B.tx[c] += ux * k * f; B.tz[c] += uz * k * f; }
  }
}
/* Une explosion couche les plantes alentour (impulsion radiale) */
function bendBlast(x, z, r = 7, k = 7) { if (BEND.on) bendStamp(x, z, r, k, 0, 0, true); }
function bendUpdate(dt) {
  const B = BEND; if (!B.on) return;
  dt = Math.min(dt, 1 / 30);
  for (const c of B.act) { B.tx[c] = 0; B.tz[c] = 0; }
  const cam = camera.position;
  for (const e of entities) {
    if (!e.alive || e.off || e.pos.y > 2.2) continue;
    if (Math.abs(e.pos.x - cam.x) > 52 || Math.abs(e.pos.z - cam.z) > 52) continue;
    const sp = hyp(e.vel.x, e.vel.z);
    bendStamp(e.pos.x, e.pos.z, 0.95 + Math.min(sp, 6) * 0.07, B.max * (0.5 + 0.5 * Math.min(1, sp / 3.2)), e.vel.x, e.vel.z, false);
  }
  const mx = B.max;
  for (let n = B.act.length - 1; n >= 0; n--) {
    const c = B.act[n];
    const tx = clamp(B.tx[c], -mx, mx), tz = clamp(B.tz[c], -mx, mx);
    B.vx[c] += ((tx - B.px[c]) * BEND_K - B.vx[c] * BEND_C) * dt; B.vz[c] += ((tz - B.pz[c]) * BEND_K - B.vz[c] * BEND_C) * dt;
    B.px[c] = clamp(B.px[c] + B.vx[c] * dt, -mx, mx); B.pz[c] = clamp(B.pz[c] + B.vz[c] * dt, -mx, mx);
    const o = c * 4;
    if (Math.abs(tx) + Math.abs(tz) < 1e-4 && Math.abs(B.px[c]) + Math.abs(B.pz[c]) < 0.004 && Math.abs(B.vx[c]) + Math.abs(B.vz[c]) < 0.03) {
      B.px[c] = B.pz[c] = B.vx[c] = B.vz[c] = 0; B.flag[c] = 0; B.data[o] = B.data[o + 1] = 128;
      B.act[n] = B.act[B.act.length - 1]; B.act.pop(); bendDirty(c); continue;
    }
    const r = Math.round((B.px[c] / mx * 0.5 + 0.5) * 255), g = Math.round((B.pz[c] / mx * 0.5 + 0.5) * 255);
    if (r !== B.data[o] || g !== B.data[o + 1]) { B.data[o] = r; B.data[o + 1] = g; bendDirty(c); }
  }
  bendFlush();
}
/* Case c modifiée : sa tuile repartira au GPU */
function bendDirty(c) {
  const B = BEND, t = ((c / B.nx / BEND_TILE) | 0) * B.tw + (((c % B.nx) / BEND_TILE) | 0);
  if (!B.tile[t]) { B.tile[t] = 1; B.tiles.push(t); }
}
/* Envoie les tuiles modifiées (texSubImage2D d'un rectangle de la texture) ; tant que three.js n'a pas créé la texture, envoi complet par lui */
function bendFlush() {
  const B = BEND; if (!B.tiles.length) return;
  const P = renderer.properties.get(B.tex), gl = renderer.getContext();
  if (!P.__webglTexture || B.tex.needsUpdate) { B.tex.needsUpdate = true; for (const t of B.tiles) B.tile[t] = 0; B.tiles.length = 0; return; }
  renderer.state.bindTexture(gl.TEXTURE_2D, P.__webglTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, B.nx);
  for (const t of B.tiles) {
    const x = (t % B.tw) * BEND_TILE, y = ((t / B.tw) | 0) * BEND_TILE, w = Math.min(BEND_TILE, B.nx - x), h = Math.min(BEND_TILE, B.nz - y);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, B.data);
    B.tile[t] = 0;
  }
  B.tiles.length = 0;
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
}
/* À chaque image (hook update de la carte) : horloge du vent et champ de souplesse */
function floraUpdate(t, dt) { LIVE_U.uLvT.value = t; bendUpdate(dt); }

/* ---------- Primitives de feuillage ---------- */
/* Carte découpée à une seule face : 4 points [x,y,z] (p0 en bas à gauche du sprite, sens horaire vu de face), uv explicites.
   o : up (inclinaison des normales vers le ciel, 0 à 1), crown ([cx, cy, cz, aplatissement] : normales rayonnant depuis le centre
   d'une couronne), w (poids de souplesse par sommet), ao (occlusion par sommet) */
function leafQuadUV(M, mat, p, uvs, o = {}) {
  const B = M.buf(mat, (p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, (p[0][2] + p[2][2]) / 2);
  const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2], bx = p[3][0] - p[0][0], by = p[3][1] - p[0][1], bz = p[3][2] - p[0][2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = hyp3(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  const up = o.up !== undefined ? o.up : 0.6, W = o.w || [0, 0, 1, 1], A = o.ao || [0.6, 0.6, 1, 1];
  const ids = p.map((q, k) => {
    let mx, my, mz;
    if (o.crown) {
      const c = o.crown; mx = q[0] - c[0]; my = (q[1] - c[1]) * c[3] + 0.0; mz = q[2] - c[2]; const l = hyp3(mx, my, mz) || 1; mx /= l; my /= l; mz /= l;
      const s = nx * mx + ny * my + nz * mz < 0 ? -1 : 1; mx = mx * 0.75 + nx * s * 0.25; my = my * 0.75 + ny * s * 0.25 + 0.12; mz = mz * 0.75 + nz * s * 0.25;
    } else { mx = nx * (1 - up); my = ny * (1 - up) + up; mz = nz * (1 - up); if (my < 0) { mx = -mx; my = -my; mz = -mz; } }
    const l = hyp3(mx, my, mz) || 1;
    return M.v(B, q[0], q[1], q[2], mx / l, my / l, mz / l, uvs[k][0], uvs[k][1], A[k], W[k]);
  });
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
}
/* Carte rectangulaire d'une région d'atlas reg [u0, v0 (haut), du, dv] */
function leafQuad(M, mat, p, reg, o = {}) {
  const [u0, v0, du, dv] = reg;
  leafQuadUV(M, mat, p, [[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, v0], [u0, v0]], o);
}
const _lv = new V3(), _lt = new V3(), _ls = new V3();
/* Bande le long d'une ligne médiane (pts : [x,y,z] de la base à la pointe) pour un sprite vertical (base en bas, pointe en haut :
   fougères, feuilles). wid : demi-largeur (m) constante ou fonction de t (0 à 1) ; roll : roulis autour de l'axe de la bande
   (0 : à plat, 1,57 : dressée) ; side : vecteur horizontal de départ (par défaut perpendiculaire à la direction de la fronde).
   w0, w1 : poids de souplesse du pied et de la pointe (interpolés, élevés à la puissance wp) */
function frondStrip(M, mat, reg, pts, wid, roll = 0.5, o = {}) {
  const n = pts.length - 1, [u0, v0, du, dv] = reg, w0 = o.w0 || 0, w1 = o.w1 !== undefined ? o.w1 : 1, wp = o.wp || 1.4;
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    _lt.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    if (o.side) _ls.set(...o.side); else { _ls.set(-_lt.z, 0, _lt.x); if (_ls.lengthSq() < 1e-6) _ls.set(1, 0, 0); _ls.normalize(); }
    // roulis : rotation du vecteur latéral autour de la tangente
    _lv.crossVectors(_lt, _ls); const c = Math.cos(roll), s = Math.sin(roll), sx = _ls.x * c + _lv.x * s, sy = _ls.y * c + _lv.y * s, sz = _ls.z * c + _lv.z * s;
    const t = i / n, hw = typeof wid === 'function' ? wid(t) : wid;
    rows.push({ L: [pts[i][0] - sx * hw, pts[i][1] - sy * hw, pts[i][2] - sz * hw], R: [pts[i][0] + sx * hw, pts[i][1] + sy * hw, pts[i][2] + sz * hw], t, w: w0 + (w1 - w0) * Math.pow(t, wp) });
  }
  for (let i = 0; i < n; i++) {
    const a = rows[i], b = rows[i + 1], va = v0 + dv * (1 - b.t), vb = v0 + dv * (1 - a.t);
    leafQuadUV(M, mat, [a.L, a.R, b.R, b.L], [[u0, vb], [u0 + du, vb], [u0 + du, va], [u0, va]], { up: o.up, w: [a.w, a.w, b.w, b.w], ao: [lerp(0.55, 1, a.t), lerp(0.55, 1, a.t), lerp(0.55, 1, b.t), lerp(0.55, 1, b.t)] });
  }
}
/* Palme : sprite horizontal (base à gauche, pointe à droite, rachis au milieu). Deux demi-bandes en V (fold : relèvement des
   bords, rad) le long de la ligne médiane pts */
function palmStrip(M, mat, reg, pts, wid, fold = 0.5, o = {}) {
  const n = pts.length - 1, [u0, v0, du, dv] = reg, w1 = o.w1 !== undefined ? o.w1 : 1;
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    _lt.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); _ls.set(-_lt.z, 0, _lt.x).normalize();
    _lv.crossVectors(_lt, _ls); // vers le haut de la bande
    const t = i / n, hw = typeof wid === 'function' ? wid(t) : wid, c = Math.cos(fold), s = Math.sin(fold), P = pts[i];
    rows.push({ P, L: [P[0] - (_ls.x * c - _lv.x * s) * hw, P[1] - (_ls.y * c - _lv.y * s) * hw, P[2] - (_ls.z * c - _lv.z * s) * hw], R: [P[0] + (_ls.x * c + _lv.x * s) * hw, P[1] + (_ls.y * c + _lv.y * s) * hw, P[2] + (_ls.z * c + _lv.z * s) * hw], t, w: Math.pow(t, 1.3) * w1 });
  }
  for (let i = 0; i < n; i++) {
    const a = rows[i], b = rows[i + 1], ua = u0 + du * a.t, ub = u0 + du * b.t, vm = v0 + dv / 2, ao = [lerp(0.6, 1, a.t), lerp(0.6, 1, a.t), lerp(0.6, 1, b.t), lerp(0.6, 1, b.t)];
    // moitié haute du sprite : côté R (v de v0 à vm) ; moitié basse : côté L
    leafQuadUV(M, mat, [a.P, b.P, b.R, a.R], [[ua, vm], [ub, vm], [ub, v0], [ua, v0]], { up: 0.55, w: [a.w, b.w, b.w, a.w], ao });
    leafQuadUV(M, mat, [a.L, b.L, b.P, a.P], [[ua, v0 + dv], [ub, v0 + dv], [ub, vm], [ua, vm]], { up: 0.55, w: [a.w, b.w, b.w, a.w], ao });
  }
}
