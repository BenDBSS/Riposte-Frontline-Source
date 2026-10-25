/* ==========================================================================
   TISSUS AU VENT : drapeaux et linge (retour du propriétaire : « de la physique sur les tissus, drapeau, t-shirt, qui vole au vent »)
   Le linge, les tapis et le drapeau de Simoun sont devenus des tissus simulés (clothPiece, plus bas, et 02me-toiles.js) ; ce qui suit vaut
   pour les étoffes restées dans le shader (drapeau grec de Meltem, matières 'cloth' et 'cyflag').
   Pas de simulation sur le processeur : le shader des sommets fait onduler l'étoffe, comme le feuillage (02n-flore.js), mais sans texture
   de plus (aucune unité de texture, rien de lu dans une carte d'ombre). Chaque sommet porte son poids de souplesse (aSw, le canal des
   matières vivantes, LIVING) : 0 à l'attache (hampe, corde), 1 au bout libre. Le drapeau fait courir une vague de la hampe au bout ; le
   linge se balance sous sa corde. Comme le feuillage, ces matières n'ont pas de pré-passe de profondeur (un sommet qui bouge n'y serait
   pas au même endroit), et leur ombre portée reste celle de l'étoffe au repos. Au-delà de 55 m, l'étoffe ne bouge plus.
   ========================================================================== */
LIVING.add('cloth'); LIVING.add('cyflag');
const CLOTH_U = { uClT: { value: 0 }, uClW: { value: new THREE.Vector2(0.07, 0.06) } }; // vague et balancement (m au bout libre)
const CLOTH_VERT = `#include <begin_vertex>
{
  float cw = aSw;
  if (cw > 0.001) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float lod = 1.0 - smoothstep(30.0, 55.0, distance(wp, cameraPosition));
    if (lod > 0.0) {
      float t = uClT, ph = dot(wp.xz, vec2(0.37, 0.29)) + wp.y * 0.21;
      float gust = 0.6 + 0.4 * sin(t * 0.4 + wp.x * 0.05 - wp.z * 0.04);
      float wave = sin(cw * 7.0 - t * 6.0 + ph) * 0.75 + sin(cw * 13.0 - t * 9.5 + ph * 1.7) * 0.25;
      float swing = sin(t * 1.6 + ph) * 0.65 + sin(t * 2.9 + ph * 1.3) * 0.35;
      transformed += objectNormal * (wave * uClW.x + swing * uClW.y) * gust * cw * lod;
    }
  }
}`;
/* Rend une matière du décor souple (après sa création, comme makeLiving) */
function makeCloth(m) {
  const base = m.userData.patch;
  m.userData.patch = (s) => {
    base(s); Object.assign(s.uniforms, CLOTH_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSw; uniform float uClT; uniform vec2 uClW;').replace('#include <begin_vertex>', CLOTH_VERT);
  };
  m.onBeforeCompile = m.userData.patch; m.defines.WM_CLOTH = '';
  return m;
}
/* Pièce de linge pendue (coins locaux : bas gauche, bas droit, haut droit, haut gauche ; le haut tient à la corde), normale n : un tissu simulé
   (Maker.fabric, 02me-toiles.js), une particule tous les 11 cm environ. Le haut est pincé aux deux coins (et au milieu d'une pièce large) : il
   se creuse entre les pinces ; le reste pend, se balance au vent, s'écarte au passage d'un soldat, se soulève sous un souffle. o.grp : groupe
   (une corde : un seul maillage) ; o.genre : 'pendu' (linge), 'lourd' (tapis), 'drapeau' (o.hoist : la hampe tient le côté gauche, p0-p3,
   au lieu du haut) ; o.mat : matière (le coton du linge, la laine d'un tapis, la toile d'un drapeau). */
function clothPiece(M, p0, p1, p2, p3, n, o = {}) {
  const at = (u, v) => { const b = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u)], t = [lerp(p3[0], p2[0], u), lerp(p3[1], p2[1], u), lerp(p3[2], p2[2], u)]; return [lerp(b[0], t[0], v), lerp(b[1], t[1], v), lerp(b[2], t[2], v)]; };
  const w = hyp3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), h = hyp3(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
  const cu = clamp(Math.round(w / 0.11) + 1, 3, o.hoist ? 9 : 7), rv = clamp(Math.round(h / 0.11) + 1, 4, 9), P = [], pin = [], maxD = [], uv = [];
  for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) {
    const u = i / (cu - 1), v = 1 - j / (rv - 1); // la première rangée est le haut (indice 0 épinglé : le moteur s'y repère)
    P.push(at(u, v)); uv.push([u * w, v * h]); // (en mètres : la matière y pose sa photo à son échelle)
    const pinned = o.hoist ? i === 0 : j === 0 && (i === 0 || i === cu - 1 || (cu >= 5 && i === (cu - 1) >> 1));
    pin.push(pinned ? 1 : 0);
    // jeu : de quoi se balancer jusqu'à l'horizontale (la longueur pendue sous la particule), un peu plus pour le flottement
    maxD.push(pinned ? 0 : o.hoist ? 0.05 + u * w * 1.1 : 0.04 + (1 - v) * h * 1.15 + (j === 0 ? 0.03 : 0));
  }
  M.fabric({ cu, rv, P, pin, maxD, uv, glow: 0.12, side: n, genre: o.genre || 'pendu', grp: o.grp, mat: o.mat || (o.hoist ? 'canvas' : o.genre === 'lourd' ? 'laine' : 'linge') });
}
