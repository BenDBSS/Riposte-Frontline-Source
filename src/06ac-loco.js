/* ==========================================================================
   DÉPLACEMENT PAR CLIPS : marche, course et sprint tirés des animations cuites (06ab-anim.js), à la place du cycle procédural de
   poseSoldier (06b-soldier.js) pour tous les soldats (bots, joueurs distants, corps du joueur que la killcam enregistre), debout ou
   accroupis. Le cycle procédural reste pour l'arrêt, les transitions et le piétinement d'un pivot accroupi, et si les données manquent.
   Familles de clips par direction (marche, course et marche accroupie : huit directions ; sprint : avant et diagonales avant) : les
   deux clips voisins de la direction du déplacement se mélangent, puis marche et course selon la vitesse (de 1,1 fois l'allure naturelle
   de la marche à 0,8 fois celle de la course, au fusil 2 à 3,7 m/s : le clip de marche, fait pour 1,9 m/s, ne tourne pas à deux fois
   sa cadence), puis le sprint, puis la marche accroupie selon l'accroupissement. Tous les clips d'un mélange sont lus à la
   même phase (0 : pose du pied gauche, comme S.cyc). Arme de poing : marche et course de ses clips en avant et en arrière, pas
   latéraux de ses clips en marche ; diagonales, course de côté, sprint, accroupi et saut : clips du fusil (le haut du corps garde la
   posture du pistolet, bras tendus). La foulée reste celle des clips (l'allonger déplacerait le point d'appui
   pendant le déroulé du pied) : seule la cadence suit la vitesse.
   Saut (clips du saut, « sur place » : le jeu fait monter le corps) : en l'air, l'impulsion du départ (à partir du décollage, 0,30 s)
   puis le vol en boucle, tournés de leur lacet moyen (le profil de visée reste celui du jeu), jambes moins repliées (LOCO_TUCK) ; à la réception, le creux du bassin et
   la flexion du buste du clip (0,33 à 0,67 s) s'ajoutent à la pose, dosés par la vitesse de chute.
   Coup reçu (clip actions/coup-recu) : couche additive (écart à sa première image) sur le bassin, le buste et la tête, tournée vers la
   direction du tir et dosée par le coup (0,6 au corps, 0,84 à la tête, cumulés jusqu'à 1), par-dessus le ressort d'impact de
   poseSoldier.
   Glissade (clip actions/glissade) : son segment 0,10 à 0,73 s étiré sur les 0,8 s de la glissade du jeu, buste redressé pour que la tête reste vers 0,85 m (la caméra du joueur qui glisse) : ses zones de touche, chez les autres, restent
   là où il voit. Sortie vers l'accroupi.
   Lancer de grenade et rechargement (actions/lancer-grenade, segment 1,2 à 1,9 s sur les 0,7 s du lancer du jeu ; actions/rechargement,
   étiré sur la durée du rechargement de l'arme) : torsion et flexion du buste du clip en couche additive ; les mains restent celles du
   jeu (keySpline, chargeur). Les pivots de 90 degrés du pack ne servent pas : les pas de footPlant suivent n'importe quel angle.
   locoSel choisit les clips et leurs parts, et donne la longueur du cycle (LOCO.L, m) et la part de la vitesse que garde le mélange de
   deux directions (LOCO.k) : la phase avance de v / (L k), le pied d'appui recule alors exactement à la vitesse du corps.
   locoPose lit la pose à une phase. Aucune allocation par image.
   ========================================================================== */
/* bassin de la marche accroupie (m, sans visée et part de la visée) : abaissé pour garder la tête à la hauteur de l'accroupi d'avant */
const LOCO_CDY = [-0.05, -0.08];
const LOCO = { fam: null, a: null, b: null, r: null, rc: null, m: null, ma: null, mr: null, mh: null, ms: null, mx: null, rec0: null, hit0: null, thr0: null, rld0: null, hit: null, slide: null, thr: null, rld: null, jump: null, sel: [{}, {}, {}, {}], g: 0, sw: 0, c: 0, L: 1, k: 1, ty: 0, v: new V3() };
/* familles (une fois) : clips triés par direction (rad, 0 avant, positif vers la gauche) */
function locoInit() {
  if (LOCO.fam !== null) return LOCO.fam;
  LOCO.fam = false;
  if (!animInit()) return false;
  const fam = (pre, names) => names.map((n) => animClip(pre + n)).filter((c) => c && c.dir !== null)
    .map((c) => { const a = Math.atan2(Math.sin((c.dir * Math.PI) / 180), Math.cos((c.dir * Math.PI) / 180)); return { c, a, ux: -Math.sin(a), uz: -Math.cos(a) }; })
    .sort((x, y) => x.a - y.a);
  const D8 = ['avant', 'avant-gauche', 'gauche', 'arriere-gauche', 'arriere', 'arriere-droite', 'droite', 'avant-droite'];
  const F = { walk: fam('fusil/debout/marche-', D8), run: fam('fusil/debout/course-', D8), sprint: fam('fusil/debout/sprint-', ['avant', 'avant-gauche', 'avant-droite']), crouch: fam('fusil/accroupi/marche-', D8) };
  if (F.walk.length < 8 || F.run.length < 8 || F.sprint.length < 3 || F.crouch.length < 8) return false;
  // arme de poing : ses clips là où le pack en a, ceux du fusil ailleurs
  const P = (pre, rifle) => D8.map((d) => (pre[d] && animClip('pistolet/' + pre[d])) || animClip(rifle + d));
  const pw = P({ avant: 'marche-avant', arriere: 'marche-arriere', gauche: 'pas-lateral-gauche', droite: 'pas-lateral-droite' }, 'fusil/debout/marche-');
  const pr = P({ avant: 'course-avant', arriere: 'course-arriere' }, 'fusil/debout/course-');
  const byDir = (L) => L.filter(Boolean).map((c) => { const a = Math.atan2(Math.sin((c.dir * Math.PI) / 180), Math.cos((c.dir * Math.PI) / 180)); return { c, a, ux: -Math.sin(a), uz: -Math.cos(a) }; }).sort((x, y) => x.a - y.a);
  F.pwalk = byDir(pw); F.prun = byDir(pr);
  if (F.pwalk.length < 8 || F.prun.length < 8) { F.pwalk = F.walk; F.prun = F.run; }
  for (const k of ['walk', 'run', 'sprint', 'pwalk', 'prun']) for (const e of F[k]) locoLiftTab(e.c);
  LOCO.a = animSmp(); LOCO.b = animSmp(); LOCO.r = animSmp(); LOCO.rc = animSmp(); LOCO.m = animSmp(); LOCO.ma = animSmp(); LOCO.mr = animSmp(); LOCO.rec0 = animSmp();
  const J = { dep: animClip('fusil/saut/depart'), vol: animClip('fusil/saut/vol'), rec: animClip('fusil/saut/reception') };
  if (J.dep && J.vol && J.rec) { LOCO.jump = J; animSample(J.rec, 0.33, LOCO.rec0); }
  LOCO.hit = animClip('actions/coup-recu'); LOCO.mh = animSmp(); LOCO.hit0 = animSmp();
  LOCO.slide = animClip('actions/glissade'); LOCO.ms = animSmp();
  LOCO.thr = animClip('actions/lancer-grenade'); LOCO.rld = animClip('actions/rechargement'); LOCO.mx = animSmp(); LOCO.thr0 = animSmp(); LOCO.rld0 = animSmp();
  if (LOCO.thr) animSample(LOCO.thr, 1.2, LOCO.thr0);
  if (LOCO.rld) animSample(LOCO.rld, 0, LOCO.rld0);
  if (LOCO.hit) animSample(LOCO.hit, 0, LOCO.hit0);
  return (LOCO.fam = F);
}
/* clips voisins de la direction th dans la famille F : s.A, s.B, part s.t de B ; longueur du cycle et part de vitesse gardée */
function locoFamSel(F, th, s) {
  const n = F.length;
  let i = 0; while (i < n && F[i].a <= th) i++;
  const A = F[(i - 1 + n) % n], B = F[i % n];
  let span = B.a - A.a, d = th - A.a;
  if (span <= 0) span += TAU; if (d < 0) d += TAU;
  const t = clamp(d / span, 0, 1);
  s.A = A.c; s.B = B.c; s.t = t; s.v = lerp(A.c.v, B.c.v, t); s.cyc = lerp(A.c.cyc, B.c.cyc, t); s.k = hyp(lerp(A.ux, B.ux, t), lerp(A.uz, B.uz, t)); s.ty = lerp(A.c.ty, B.c.ty, t);
  return s;
}
/* choix des clips pour une vitesse v (m/s), une direction th (rad, repère du corps), une part de sprint sw, un accroupissement c, et
   l'arme de poing isP */
function locoSel(v, th, sw, c, isP) {
  const F = LOCO.fam, S = LOCO.sel;
  locoFamSel(isP ? F.pwalk : F.walk, th, S[0]); locoFamSel(isP ? F.prun : F.run, th, S[1]);
  // de la marche à la course : entre un peu plus que l'allure naturelle de la marche et un peu moins que celle de la course
  const g = smoothstep(S[0].v * 1.1, Math.max(S[0].v * 1.1 + 0.5, S[1].v * 0.8), v);
  // sprint : avant et diagonales avant (au-delà, la direction est ramenée à 45 degrés)
  locoFamSel(F.sprint, clamp(th, -Math.PI / 4, Math.PI / 4), S[2]);
  locoFamSel(F.crouch, th, S[3]);
  LOCO.g = g; LOCO.sw = sw; LOCO.c = c;
  const m = (k) => lerp(lerp(lerp(S[0][k], S[1][k], g), S[2][k], sw), S[3][k], c);
  LOCO.L = m('cyc'); LOCO.k = Math.max(0.5, m('k')); LOCO.ty = m('ty');
}
/* pose à la phase ph (0 à 1) d'après le dernier locoSel ; out : animSmp() */
function locoFam(s, ph, out) { animPhase(s.A, ph, LOCO.a); animPhase(s.B, ph, LOCO.b); return animMix(LOCO.a, LOCO.b, s.t, out); }
function locoPose(ph, out) {
  const S = LOCO.sel, g = LOCO.g, sw = LOCO.sw, c = LOCO.c;
  if (c < 1) {
    if (g < 1) locoFam(S[0], ph, out);
    if (g > 0) { if (g < 1) animMix(out, locoFam(S[1], ph, LOCO.r), g, out); else locoFam(S[1], ph, out); }
    if (sw > 0.001) animMix(out, locoFam(S[2], ph, LOCO.r), sw, out);
  }
  if (c > 0) { if (c < 1) animMix(out, locoFam(S[3], ph, LOCO.rc), c, out); else locoFam(S[3], ph, out); }
  return out;
}
/* Levée du bassin (m, max au plus) que permettent les jambes de la pose m (99 % de leur longueur) : les clips marchent genoux fléchis,
   bassin plus bas que le jeu, qui le relève pour garder la tête (œil des bots, zones de touche) près de sa hauteur d'avant ; négative
   (5 cm au plus) quand le clip tend les jambes au-delà de leur longueur (le pied décrocherait du sol). Image par image, elle plongeait
   au moment où une jambe tendue en arrière la limite (marche avant : de 5 cm à 0,8 cm et retour en 0,07 s, à la pose du pied droit) :
   un à-coup du bassin et des genoux à chaque cycle ; on se sert donc de sa courbe lissée (locoLiftTab, locoLift) */
function locoRaise(m, max) {
  const Lm = 0.99 * (SD.thigh + SD.shin), d = LOCO.v;
  let r = max;
  for (let i = 0; i < 2; i++) {
    d.set((i ? 1 : -1) * SD.hipX, SD.hipY, 0).applyQuaternion(m.qP).add(m.pel).sub(m.ft[i]);
    const h2 = d.x * d.x + d.z * d.z;
    r = Math.min(r, h2 < Lm * Lm ? Math.sqrt(Lm * Lm - h2) - d.y : 0);
  }
  return Math.max(-0.05, r);
}
/* Courbe de levée d'une boucle de déplacement (c.lift, une valeur par image) : la levée de chaque image (locoRaise), la même pour les deux
   pas (minimum avec celle du demi-cycle opposé : sinon un pas sur deux descendait plus bas, comme une boiterie), érodée puis moyennée sur
   une fenêtre de 0,1 cycle de part et d'autre (ouverture) : partout sous la levée permise (les jambes ne se tendent jamais trop), sans
   plongée brusque (le bassin descend en douceur avant le pas qui la demande) */
function locoLiftTab(c) {
  if (c.lift) return;
  const n = c.n, m = animSmp(), raw = new Float32Array(n), ero = new Float32Array(n), out = new Float32Array(n), w = Math.max(1, Math.round(n * 0.1));
  for (let f = 0; f < n; f++) raw[f] = locoRaise(animRead(c, f, m), 0.05);
  const sym = raw.slice(); for (let f = 0; f < n; f++) raw[f] = Math.min(sym[f], sym[Math.round(f + n / 2) % n]);
  for (let f = 0; f < n; f++) { let v = 1; for (let k = -w; k <= w; k++) v = Math.min(v, raw[(f + k + n) % n]); ero[f] = v; }
  for (let f = 0; f < n; f++) { let s = 0; for (let k = -w; k <= w; k++) s += ero[(f + k + n) % n]; out[f] = s / (2 * w + 1); }
  c.lift = out;
}
/* levée lissée à la phase ph, mêlée comme la pose (locoPose : directions, marche et course, sprint ; l'accroupi a ses propres décalages) */
function locoLift(ph) {
  const S = LOCO.sel, g = LOCO.g, sw = LOCO.sw;
  const tab = (c) => { const L = c.lift; if (!L) return 0.05; const x = ph * L.length, i = Math.floor(x) % L.length, u = x - Math.floor(x); return lerp(L[i], L[(i + 1) % L.length], u); };
  const fam = (s) => lerp(tab(s.A), tab(s.B), s.t);
  let v = g < 1 ? fam(S[0]) : 0;
  if (g > 0) v = g < 1 ? lerp(v, fam(S[1]), g) : fam(S[1]);
  if (sw > 0.001) v = lerp(v, fam(S[2]), sw);
  return v;
}
/* Temps du saut, chaque image : S.aT, temps en l'air (-1 au sol) ; S.jmp, saut (et non chute) ; S.rT, temps depuis la réception ;
   S.rK, intensité de la réception (0 à 1 selon la vitesse de chute airVy, nulle pour un petit saut) */
function locoAirT(S, air, landed, vy, airVy, dt) {
  if (air) { if (!(S.aT >= 0)) { S.aT = 0; S.jmp = vy > 2; } else S.aT += dt; S.rT = -1; return; }
  S.aT = -1;
  if (landed) { S.rT = 0; S.rK = clamp((-airVy - 3) / 8, 0, 1); } else if (S.rT >= 0) S.rT += dt;
}
/* pose en l'air : impulsion du départ (saut), puis vol en boucle ; null sans les clips du saut */
/* jambes moins repliées que dans le clip (pieds 55 cm au-dessus de la base du corps) : le corps du jeu monte déjà de 1 m au sommet
   d'un saut, le repli entier faisait paraître le saut beaucoup plus haut ; part gardée de la levée des pieds et de leur inclinaison */
const LOCO_TUCK = 0.5;
function locoAirPose(S, out) {
  const J = LOCO.jump; if (!J) return null;
  const d0 = J.dep.dur - 0.3, dep = S.jmp && S.aT < d0;
  if (dep) animSample(J.dep, 0.3 + S.aT, out); else animSample(J.vol, S.aT - (S.jmp ? d0 : 0), out);
  for (let i = 0; i < 2; i++) { out.ft[i].y = 0.085 + (out.ft[i].y - 0.085) * LOCO_TUCK; out.fp[i] *= LOCO_TUCK; }
  return animYaw(out, -(dep ? J.dep.ty : J.vol.ty));
}
/* réception : pose du clip à 0,33 s + S.rT (à comparer à LOCO.rec0) ; null hors de la réception */
function locoRec(S, out) {
  const J = LOCO.jump;
  return J && S.rT >= 0 && S.rT < 0.34 && S.rK > 0 ? animSample(J.rec, 0.33 + S.rT, out) : null;
}
/* Coup reçu : départ du clip (kick : 1 au corps, 1,4 à la tête, cumulés ; hx, hz : sens du tir dans le repère du corps), puis pose du
   clip à S.hT (à comparer à LOCO.hit0) tant qu'il dure ; S.hA : lacet qui tourne le clip (écarté vers l'arrière) dans le sens du tir */
function locoHitStart(S, kick, hx, hz) { if (LOCO.hit) { S.hT = 0; S.hK = Math.min(1, 0.6 * kick); S.hA = Math.atan2(hx, hz); } }
function locoHit(S, dt, out) {
  if (!LOCO.hit || !(S.hT >= 0)) return null;
  if (S.hT > LOCO.hit.dur) { S.hT = -1; return null; }
  animSample(LOCO.hit, S.hT, out); S.hT += dt;
  return out;
}
/* glissade : pose au temps t (s) depuis son début ; null sans le clip (pas de lacet retiré : couché, le buste n'en a pas de sens) */
function locoSlidePose(t, out) {
  const C = LOCO.slide; if (!C) return null;
  return animSample(C, 0.1 + clamp(t / 0.8, 0, 1) * 0.63, out);
}
/* buste q redressé vers la verticale, d'une part k, tant que la tête passerait sous 0,85 m (bassin à la hauteur py) */
const _lsQ = new THREE.Quaternion(), _lsA = new V3();
function locoSlideUp(q, py, k) {
  const u = LOCO.v.set(0, 1, 0).applyQuaternion(q), cMin = clamp((0.85 - 0.17 - py) / SD.trunk, -1, 1);
  if (u.y >= cMin) return;
  _lsA.set(u.z, 0, -u.x); // u x (0, 1, 0) : axe qui ramène u vers la verticale
  if (_lsA.lengthSq() < 1e-8) return;
  q.premultiply(_lsQ.setFromAxisAngle(_lsA.normalize(), -(Math.acos(clamp(u.y, -1, 1)) - Math.acos(cMin)) * k));
}
/* Geste du buste : lancer (tt, avancement de 0 à 1 du lancer du jeu) ou rechargement (tt, avancement du rechargement) ; pose du clip
   dans out, et LOCO.x0, sa pose de départ ; null sans le clip */
function locoGesture(throwing, tt, out) {
  const C = throwing ? LOCO.thr : LOCO.rld; if (!C) return null;
  LOCO.x0 = throwing ? LOCO.thr0 : LOCO.rld0;
  return animSample(C, throwing ? 1.2 + clamp(tt, 0, 1) * 0.7 : clamp(tt, 0, 1) * C.dur, out);
}
