/* ==========================================================================
   VENT : un seul souffle pour toute la flore (retour du propriétaire : arbres, plantes, fleurs, roseaux et palmiers animés au gré du
   vent, sur toutes les cartes). Comme les tissus (02mc-tissus.js), tout se passe dans le nuanceur de sommets : aucune simulation sur le
   processeur, aucune unité de texture de plus (le champ de poussée BEND de Hortus et de Stratus reste à part, voir 02n-flore.js).
   - Chaque sommet d'une matière souple porte son poids de souplesse (aSw, le canal des matières vivantes, LIVING) : 0 à l'attache, 1 au bout
     libre ; un poids négatif ne donne que le frémissement des feuilles (une grimpante plaquée au mur ne s'incline pas dedans). Une carte
     découpée de feuillage prend le poids de sa hauteur ou de son éloignement du tronc (M.swFn d'un prefab, swHeight et swCrown plus bas),
     une palme celui de sa distance au tronc (foliageQuad, option w).
   - windDisp(position, amplitudes) : la rafale (windGust) est une onde qui traverse la carte dans le sens du vent à une dizaine de mètres
     par seconde, plus une rafale fine qui la double ; elle penche la plante sous le vent (x), elle fait osciller le balancement (y, à la
     fréquence propre de chaque endroit : deux palmiers voisins ne battent pas ensemble) et elle renforce le frémissement des feuilles (z).
     Le vent ne tombe jamais tout à fait : une brise reste. Le bout qui penche descend un peu (la longueur de la palme ne change pas).
   - Chaque matière a ses amplitudes (WIND_AMP : inclinaison, balancement, frémissement en mètres au poids 1, et portée) : le feuillage
     d'un palmier bouge plus que celui d'un sapin chargé de neige. Au-delà de la portée, la plante ne bouge plus (fondu sur la moitié
     extérieure). Comme les matières de Hortus, ces matières n'ont pas de pré-passe de profondeur ni d'ombre qui bouge : l'ombre portée est
     celle de la plante au repos (l'écart est de quelques centimètres).
   - Direction et force (windInit, appelée par makeMaterials) : `vent: [x, z, force]` dans la définition d'une carte s'il y en a un ; sinon la
     direction de l'herbe de la carte (`grass.wind`, pour que l'herbe et les arbres penchent du même côté) ou une brise de nord-est, et la
     force du vent qu'on entend (`atmo.wind[1]`, le gain de l'ambiance sonore, 0,07 : force 1) : le vent qu'on voit est celui qu'on entend.
     Horloge : WIND_U.uWnT, avancée par la boucle d'images (09-game.js).
   ========================================================================== */
LIVING.add('foliage'); LIVING.add('stem'); LIVING.add('conifer'); LIVING.add('cyfol');
const WIND_U = { uWnT: { value: 0 }, uWnD: { value: new THREE.Vector4(0.8, 0.6, 1, 0) } }; // temps ; direction (x, z), force
/* Amplitudes par matière : inclinaison sous la rafale, balancement, frémissement (m au poids 1), portée (m) */
const WIND_AMP = {
  foliage: [0.3, 0.16, 0.05, 120], // palmes, buissons, herbes sèches, bougainvilliers (Khamsin, Simoun)
  cyfol: [0.2, 0.12, 0.05, 90], // olivier, cyprès, tamaris, figuier, platane, agave, touffes, grimpantes (Meltem, Simoun)
  conifer: [0.1, 0.06, 0.018, 70], // sapins et buissons chargés de neige (Val-Blanc)
  stem: [0.34, 0.15, 0.015, 75], // tiges de roseaux et nervures
};
const WIND_HEAD = `uniform float uWnT; uniform vec4 uWnD;
// rafale de 0 à 1,4 au point wp : une onde large qui avance dans le sens du vent, doublée d'une onde plus fine (deux sinus)
float windGust(vec3 wp) {
  vec2 d = uWnD.xy, p = vec2(-d.y, d.x);
  float a = dot(wp.xz, d), b = dot(wp.xz, p);
  float g1 = 0.5 + 0.5 * sin(a * 0.07 - uWnT * 0.9 + b * 0.05);
  float g2 = 0.5 + 0.5 * sin(a * 0.19 - uWnT * 2.3 + b * 0.11);
  return clamp((0.12 + 0.62 * g1 * g1 + 0.26 * g2 * g1) * uWnD.z, 0.0, 1.4);
}
// déplacement (m) d'un point : am = (inclinaison, balancement, frémissement), déjà multipliés par le poids ; quatre sinus et cosinus en plus de la rafale
vec3 windDisp(vec3 wp, vec3 am) {
  float g = windGust(wp);
  vec2 d = uWnD.xy, p = vec2(-d.y, d.x);
  float ph = uWnT * 2.1 + dot(wp.xz, vec2(0.37, 0.29)) + wp.y * 0.11, fa = uWnT * 7.3 + dot(wp, vec3(2.1, 3.3, 1.7));
  float so = (0.25 + 0.75 * g) * am.y, fl = (0.3 + 0.9 * g) * am.z;
  vec2 xz = d * (g * am.x + sin(ph) * so) + p * (cos(ph * 0.8 + 1.9) * so * 0.4) + vec2(sin(fa), cos(fa * 1.37 + 1.1)) * fl;
  return vec3(xz.x, -length(xz) * 0.3 + sin(fa * 0.7) * fl * 0.35, xz.y);
}`;
const WIND_VERT = `#include <begin_vertex>
{
  float sw = aSw;
  if (abs(sw) > 0.001) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float lod = 1.0 - smoothstep(uWnA.w * 0.5, uWnA.w, distance(wp, cameraPosition));
    if (lod > 0.0) transformed += windDisp(wp, vec3(uWnA.xy * max(sw, 0.0), uWnA.z * abs(sw))) * lod;
  }
}`;
/* Rend une matière du décor souple au vent (après sa création, comme makeCloth) ; amp : amplitudes (WIND_AMP) ; o.leaf : éclairage de feuille de
   Hortus (diffus mat, translucidité : un palmier à contre-jour s'allume en jaune-vert, voir leafLight dans 02n-flore.js) ; o.cards : cartes de
   feuillage émises dans les deux sens par foliageQuad, chacune avec sa normale inclinée vers le ciel (une seule des deux regarde le joueur) :
   la matière ne dessine que la face qui regarde le joueur (FrontSide), sans quoi les deux cartes, au même endroit, seraient éclairées et
   découpées toutes les deux, pour le double du travail par pixel */
function makeWind(m, amp, o = {}) {
  const base = m.userData.patch;
  m.userData.windA = { value: new THREE.Vector4(amp[0], amp[1], amp[2], amp[3]) };
  m.userData.patch = (s) => {
    base(s); Object.assign(s.uniforms, WIND_U); s.uniforms.uWnA = m.userData.windA;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSw; uniform vec4 uWnA;\n' + WIND_HEAD).replace('#include <begin_vertex>', WIND_VERT);
    if (o.leaf) leafLight(s);
  };
  m.onBeforeCompile = m.userData.patch; m.defines.WM_WIND = ''; if (o.leaf) m.defines.WM_LEAF = ''; if (o.cards) m.side = THREE.FrontSide;
  return m;
}
/* Direction et force du vent de la carte */
function windInit(def) {
  const v = def && def.vent, d = v || (def && def.grass && def.grass.wind) || [0.8, 0.6], l = hyp(d[0], d[1]) || 1;
  const aw = def && def.atmo && def.atmo.wind, f = v && v[2] !== undefined ? v[2] : aw ? clamp(aw[1] / 0.07, 0.6, 1.5) : 1;
  WIND_U.uWnD.value.set(d[0] / l, d[1] / l, f, 0);
}
/* Poids de souplesse à poser dans M.swFn d'un prefab (les sommets reçoivent swFn(x, y, z) en coordonnées du prefab) :
   swHeight, de 0 au pied (y0) à m au sommet (y1), en puissance k (une tige plie surtout par le haut) ;
   swCrown, selon l'éloignement de l'axe (cx, cz) du tronc, jusqu'au rayon r, et un peu selon la hauteur. */
const swHeight = (y0, y1, k = 1.5, m = 1) => (x, y) => m * Math.pow(clamp((y - y0) / (y1 - y0), 0, 1), k);
const swCrown = (cx, cz, y0, y1, r, m = 1) => (x, y, z) => m * clamp(0.3 * clamp((y - y0) / (y1 - y0), 0, 1) + 0.7 * hyp(x - cx, z - cz) / r, 0, 1);
