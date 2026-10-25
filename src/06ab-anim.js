/* ==========================================================================
   ANIMATIONS CUITES : clips Mixamo (Pro Rifle Pack, Pistol Handgun Locomotion Pack, Basic Shooter Pack) réduits aux grandeurs que
   poseSoldier calcule (src/06b-soldier.js), image par image, par tools/dev/anim/cuire.mjs (le pack lui-même reste hors du dépôt : licence).
   Données livrées dans le socle de la page par build.py (window.SOCLE.anim : assets/anim/clips.bin en base64, index de clips.json) : 30 images par seconde, 31 entiers
   16 bits par image, dans le repère du corps du jeu (regard vers -z, droite vers +x, pieds à y = 0), à l'échelle du soldat :
     bassin : position (J_PEL) et orientation (repère des hanches) ; buste : orientation qui porte le segment bassin-cou et les épaules ;
     tête : orientation ; chevilles gauche et droite (J_FTL, J_FTR) ; inclinaison des pieds (positive pointe en haut, comme S.fp) ; lacet
     des pieds par rapport aux hanches (positif vers la gauche, comme S.fyG) ; direction des genoux dans le repère du bassin (pôle de
     l'IK des jambes).
   Index d'un clip (ANIM.clips[id], id : chemin dans le pack sans .glb, ex. 'fusil/debout/marche-avant') : n images, o première image,
   loop, dur (s), v (m/s, repère du jeu), dir (degrés : 0 avant, 90 gauche, comme atan2(-lvx, -lvz)), cyc (m par cycle : la phase avance de
   v / cyc), ty (lacet moyen du buste, rad, positif vers la gauche), head (hauteur de la tête, min et max). Phase 0 d'un clip de déplacement : pose du pied gauche (comme S.cyc = 0).
   ========================================================================== */
const ANIM_DATA = (window.SOCLE || {}).anim || null; // socle (build.py)
const ANIM = { clips: null, d: null, st: 31 };
function animInit() {
  if (ANIM.clips) return !!ANIM.d;
  ANIM.clips = {};
  if (!ANIM_DATA) return false;
  const s = atob(ANIM_DATA.b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  ANIM.d = new Int16Array(u.buffer); ANIM.st = ANIM_DATA.stride; ANIM.fps = ANIM_DATA.fps;
  for (const c of ANIM_DATA.clips) ANIM.clips[c.id] = c;
  return true;
}
function animClip(id) { animInit(); return ANIM.clips[id] || null; }
/* une pose (sortie de animSample) */
function animSmp() { return { pel: new V3(), qP: new THREE.Quaternion(), qT: new THREE.Quaternion(), qH: new THREE.Quaternion(), ft: [new V3(), new V3()], fp: [0, 0], fy: [0, 0], kn: [new V3(), new V3()] }; }
const _anA = animSmp(), _anB = animSmp();
/* image f (entière) du clip c dans out */
function animRead(c, f, out) {
  const d = ANIM.d, i = (c.o + f) * ANIM.st, P = 1e-4, Q = 1 / 32767;
  out.pel.set(d[i] * P, d[i + 1] * P, d[i + 2] * P);
  out.qP.set(d[i + 3] * Q, d[i + 4] * Q, d[i + 5] * Q, d[i + 6] * Q).normalize();
  out.qT.set(d[i + 7] * Q, d[i + 8] * Q, d[i + 9] * Q, d[i + 10] * Q).normalize();
  out.qH.set(d[i + 11] * Q, d[i + 12] * Q, d[i + 13] * Q, d[i + 14] * Q).normalize();
  out.ft[0].set(d[i + 15] * P, d[i + 16] * P, d[i + 17] * P); out.ft[1].set(d[i + 18] * P, d[i + 19] * P, d[i + 20] * P);
  out.fp[0] = d[i + 21] * P; out.fp[1] = d[i + 22] * P; out.fy[0] = d[i + 23] * P; out.fy[1] = d[i + 24] * P;
  out.kn[0].set(d[i + 25] * P, d[i + 26] * P, d[i + 27] * P); out.kn[1].set(d[i + 28] * P, d[i + 29] * P, d[i + 30] * P);
  return out;
}
/* mélange de deux poses (w : part de b) ; out peut être a */
function animMix(a, b, w, out) {
  out.pel.lerpVectors(a.pel, b.pel, w);
  out.qP.slerpQuaternions(a.qP, b.qP, w); out.qT.slerpQuaternions(a.qT, b.qT, w); out.qH.slerpQuaternions(a.qH, b.qH, w);
  for (let k = 0; k < 2; k++) { out.ft[k].lerpVectors(a.ft[k], b.ft[k], w); out.fp[k] = lerp(a.fp[k], b.fp[k], w); out.fy[k] = lerp(a.fy[k], b.fy[k], w); out.kn[k].lerpVectors(a.kn[k], b.kn[k], w); }
  return out;
}
/* pose du clip c à l'instant t (s) : entre deux images ; une boucle reprend au début (ses n images couvrent exactement sa durée, qui
   n'est pas toujours un nombre entier d'images à 30 par seconde), un clip simple s'arrête sur sa dernière image */
function animSample(c, t, out) {
  let x;
  if (c.loop) { x = (t / c.dur) * c.n; x = ((x % c.n) + c.n) % c.n; } else x = clamp(t * ANIM.fps, 0, c.n - 1);
  const i0 = Math.floor(x), i1 = c.loop ? (i0 + 1) % c.n : Math.min(i0 + 1, c.n - 1);
  animRead(c, i0, _anA); animRead(c, i1, _anB);
  return animMix(_anA, _anB, x - i0, out);
}
/* pose tournée de a (rad) autour de la verticale (bassin, chevilles, orientations ; les genoux sont dans le repère du bassin) */
const _anQ = new THREE.Quaternion(), _anY = new V3(0, 1, 0);
function animYaw(m, a) {
  _anQ.setFromAxisAngle(_anY, a);
  m.pel.applyQuaternion(_anQ); m.ft[0].applyQuaternion(_anQ); m.ft[1].applyQuaternion(_anQ);
  m.qP.premultiply(_anQ); m.qT.premultiply(_anQ); m.qH.premultiply(_anQ);
  return m;
}
/* pose d'une boucle à la phase ph (0 à 1, 0 : pose du pied gauche) */
function animPhase(c, ph, out) { return animSample(c, ph * c.dur, out); }
