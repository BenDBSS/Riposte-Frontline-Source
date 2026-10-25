/* Lecture des clips du pack d'animations (/anim-source/, GLB de Mixamo) et grandeurs de poseSoldier (src/06b-soldier.js) dans le repère du
   jeu. Partagé par la cuisson (cuire.mjs) et la page de comparaison (tools/dev/visual/anim.js).
   Repère du pack : Y vers le haut, le personnage regarde +z, sa gauche est +x. Repère du jeu (corps) : regard vers -z, droite vers +x,
   pieds à y = 0. On passe de l'un à l'autre par un demi-tour autour de Y, (x, y, z) -> (-x, y, -z) : une rotation, pas un miroir.
   Grandeurs par image (repère du corps du jeu, mètres et radians) :
   - bassin : position (J_PEL, os Hips) et orientation (repère des hanches : x de la hanche gauche vers la droite, y vers la colonne) ;
   - buste : orientation qui porte le segment bassin-cou (y vers l'os Neck, J_CHE) et la ligne des épaules (x vers l'épaule droite) ;
   - tête : rotation de l'os Head par rapport à sa pose de repos (T-pose) ;
   - pieds : chevilles (os Foot, J_FTL et J_FTR), inclinaison (cheville vers la plante, par rapport au repos, positive pointe en haut),
     lacet (axe latéral du pied, par rapport à l'avant des hanches, positif vers la gauche, comme S.fyG) ;
   - genoux : direction du genou depuis l'axe hanche-cheville, dans le repère du bassin (pôle de l'IK des jambes).
   Les positions sont mises à l'échelle du soldat (rapport des longueurs de jambe, SD.thigh + SD.shin contre celles du clip). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NM = path.join(HERE, '../visual/node_modules/three');
const THREE = await import(path.join(NM, 'build/three.module.js'));
const { GLTFLoader } = await import(path.join(NM, 'examples/jsm/loaders/GLTFLoader.js'));
export { THREE };
export const REPO = path.resolve(HERE, '../../..'), SRC = path.join(REPO, 'anim-source');
/* jambe du soldat (SD.thigh + SD.shin, src/06g-body.js) */
export const LEG = 0.43 + 0.425;
export const FPS = 30;

export async function loadGlb(file) {
  const b = fs.readFileSync(file);
  const g = await new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej));
  const bones = {};
  g.scene.traverse((o) => { const k = o.name.replace(/^mixamorig\d*:?/, ''); if (!bones[k] && o.name.startsWith('mixamorig')) bones[k] = o; });
  g.scene.updateMatrixWorld(true);
  // pose de repos (T-pose) : positions et orientations monde avant toute animation
  const rest = {};
  for (const k in bones) rest[k] = { p: bones[k].getWorldPosition(new THREE.Vector3()), q: bones[k].getWorldQuaternion(new THREE.Quaternion()) };
  const leg = rest.LeftUpLeg.p.distanceTo(rest.LeftLeg.p) + rest.LeftLeg.p.distanceTo(rest.LeftFoot.p);
  const clip = g.animations[0] || null;
  let mixer = null, act = null;
  if (clip) { mixer = new THREE.AnimationMixer(g.scene); act = mixer.clipAction(clip); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play(); }
  return { scene: g.scene, bones, rest, leg, k: LEG / leg, clip, dur: clip ? clip.duration : 0,
    /* pose à l'instant t (s) : positions et orientations monde de chaque os */
    at(t) {
      if (mixer) { act.paused = false; act.enabled = true; mixer.setTime(Math.min(t, clip.duration)); }
      g.scene.updateMatrixWorld(true);
      const P = {};
      for (const k in bones) P[k] = { p: bones[k].getWorldPosition(new THREE.Vector3()), q: bones[k].getWorldQuaternion(new THREE.Quaternion()) };
      return P;
    } };
}

/* demi-tour autour de Y (repère du pack vers celui du jeu) */
const RY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), RYi = RY.clone().invert();
export const toGameV = (v, out = new THREE.Vector3()) => out.set(-v.x, v.y, -v.z);
export const toGameQ = (q, out = new THREE.Quaternion()) => out.copy(RY).multiply(q).multiply(RYi);
const _m = new THREE.Matrix4();
/* repère (x, y presque perpendiculaires) vers quaternion ; y est gardé, x rendu perpendiculaire */
function frameQ(x, y) {
  const Y = y.clone().normalize(), X = x.clone().addScaledVector(Y, -x.dot(Y)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z));
}

/* avant des hanches du soldat (layoutSoldier) : perpendiculaire, à l'horizontale, à la ligne des hanches posée par le bassin qP */
export function hipFwd(qP) { const x = new THREE.Vector3(1, 0, 0).applyQuaternion(qP); return new THREE.Vector3(x.z, 0, -x.x).normalize(); }
/* orientation du pied du soldat (soldierFrames) : à plat dans l'axe des hanches, lacet fy autour de la verticale, inclinaison fp */
export function footQ(qP, fy, fp) {
  const z = hipFwd(qP).negate(), y = new THREE.Vector3(0, 1, 0), x = new THREE.Vector3().crossVectors(y, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(y, fy));
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), fp));
}
/* Points d'appui de la semelle des rangers (soldierBoots ; repère du pied : origine à la cheville, -z vers la pointe, sol à y = -0,075),
   dans le repère de la cheville a : talon, et plante sous l'os des orteils (SD.ball), qui se replie de 85 % quand le pied se tend
   (soldierFrames) : au déroulé, c'est lui qui reste au sol. */
const HEEL = new THREE.Vector3(0, -0.075, 0.07), BALL = new THREE.Vector3(0, -0.052, -0.122), PAD = new THREE.Vector3(0, -0.023, -0.03), X1 = new THREE.Vector3(1, 0, 0);
export function soleW(qP, fy, fp, a) {
  const qf = footQ(qP, fy, fp), qt = fp < 0 ? qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X1, -fp * 0.85)) : qf;
  return [HEEL.clone().applyQuaternion(qf).add(a), PAD.clone().applyQuaternion(qt).add(BALL.clone().applyQuaternion(qf)).add(a)];
}

/* Grandeurs d'une pose P (sortie de at), dans le repère du jeu, à l'échelle k ; root : point du sol (repère du pack) retiré des positions */
export function quantities(A, P, root) {
  const k = A.k, g = (v) => toGameV(new THREE.Vector3().subVectors(v, root)).multiplyScalar(k);
  const pel = g(P.Hips.p), hL = g(P.LeftUpLeg.p), hR = g(P.RightUpLeg.p), sp = g(P.Spine.p), neck = g(P.Neck.p), sL = g(P.LeftArm.p), sR = g(P.RightArm.p);
  const qP = frameQ(new THREE.Vector3().subVectors(hR, hL), new THREE.Vector3().subVectors(sp, pel));
  const qT = frameQ(new THREE.Vector3().subVectors(sR, sL), new THREE.Vector3().subVectors(neck, pel));
  // tête : rotation de l'os depuis la T-pose (regard droit devant), passée dans le repère du jeu
  const qH = toGameQ(P.Head.q.clone().multiply(A.rest.Head.q.clone().invert()));
  // avant des hanches (comme layoutSoldier : perpendiculaire à la ligne des hanches du soldat, qui suit qP, horizontal)
  const fwd = hipFwd(qP);
  const feet = [], pitch = [], yaw = [], knee = [], qPi = qP.clone().invert();
  for (const s of ['Left', 'Right']) {
    const a = g(P[s + 'Foot'].p), b = g(P[s + 'ToeBase'].p), d = new THREE.Vector3().subVectors(b, a);
    const r0 = new THREE.Vector3().subVectors(toGameV(A.rest[s + 'ToeBase'].p), toGameV(A.rest[s + 'Foot'].p));
    const el = Math.atan2(d.y, Math.hypot(d.x, d.z)), el0 = Math.atan2(r0.y, Math.hypot(r0.x, r0.z));
    feet.push(a); pitch.push(el - el0);
    // lacet : avant du pied tiré de son axe latéral (qui reste horizontal quand le pied se tend ou se relève), angle depuis l'avant des
    // hanches, positif vers la gauche (-x), comme S.fyG
    const lat = toGameV(new THREE.Vector3(1, 0, 0).applyQuaternion(P[s + 'Foot'].q.clone().multiply(A.rest[s + 'Foot'].q.clone().invert())));
    const h = new THREE.Vector3().crossVectors(lat, new THREE.Vector3(0, 1, 0)).setY(0).normalize();
    yaw.push(Math.atan2(fwd.z * h.x - fwd.x * h.z, fwd.dot(h)));
    // genou : direction depuis le milieu hanche-cheville, perpendiculaire à cet axe, dans le repère du bassin (pôle de l'IK des jambes)
    const hip = g(P[s + 'UpLeg'].p), kn = g(P[s + 'Leg'].p), ax = new THREE.Vector3().subVectors(a, hip).normalize();
    const kd = new THREE.Vector3().subVectors(kn, hip); kd.addScaledVector(ax, -kd.dot(ax));
    knee.push(kd.lengthSq() > 1e-8 ? kd.normalize().applyQuaternion(qPi) : new THREE.Vector3(0, 0, -1));
  }
  // point équivalent à J_HEAD : 40 % de l'os Head vers HeadTop_End (milieu de la tête), pour mesurer la hauteur de la tête
  const head = g(P.Head.p).lerp(g(P.HeadTop_End.p), 0.4);
  return { pel, qP, qT, qH, feet, pitch, yaw, knee, head, neck, hips: [hL, hR], sh: [sL, sR] };
}

/* lecture du manifeste */
export function manifest() { return JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8')); }

/* suites cycliques de valeurs vraies d'un tableau : [{ s, l }] (début, longueur) */
function runs(a) {
  const N = a.length, out = [];
  if (a.every(Boolean)) return [{ s: 0, l: N }];
  const z = a.indexOf(false);
  for (let k = 1; k <= N; k++) { const i = (z + k) % N; if (a[i] && !a[(i - 1 + N) % N]) { let l = 0; while (a[(i + l) % N]) l++; out.push({ s: i, l }); } }
  return out;
}
/* Verrouillage des appuis (boucles de déplacement), sur les points d'appui de la ranger (soleW), le corps avançant à la vitesse du clip :
   - pendant chaque appui, le point qui porte (talon à l'attaque, plante ensuite, mélange selon le plus bas des deux) ne bouge plus dans le
     monde ; l'écart rattrapé est centré sur l'appui (la jambe s'étire deux fois moins) et passe d'un appui à l'autre pendant la phase en
     l'air ;
   - la semelle ne descend pas sous son niveau d'appui (le pied du X Bot, plus court, roule autrement que la ranger), et un pied en l'air
     garde 4,5 cm sous la semelle dès l'image qui suit le décollage et jusqu'à celle qui précède la pose : la capture pose et lève
     souvent le pied en le traînant, qui frotterait le sol entre deux images.
   Corrige le glissement de la capture et l'écart entre le pied du X Bot et celui du soldat.
   Appui : semelle à moins de 3 cm de son plus bas avec un point d'appui plus lent que 30 % de la vitesse du clip (0,35 m/s au moins),
   ou à moins de 1,2 cm et plus lent que 60 % (fin de déroulé, qui glisse dans la capture ; un pied qui frôle le sol en l'air va plus
   vite). Vitesse : la plus faible de celles vers l'image d'avant et vers l'image d'après (la dernière image d'un appui ne compte pas le
   décollage, la première pas la pose). */
function lockFeet(Q, N, dur, gv, spd) {
  const dt = dur / N, thr = Math.max(0.35, spd * 0.3), ss = THREE.MathUtils.smoothstep, GARDE = 0.045;
  for (let f = 0; f < 2; f++) {
    // semelle dans le monde sur deux cycles (image i + N : image i, un cycle plus loin)
    const W = [];
    for (let i = 0; i <= 2 * N; i++) { const q = Q[i % N]; W.push(soleW(q.qP, q.yaw[f], q.pitch[f], gv.clone().multiplyScalar(i * dt).add(q.feet[f]))); }
    const wb = W.map(([h, b]) => ss(h.y - b.y, -0.01, 0.01)), piv = (i, w) => W[i][0].clone().lerp(W[i][1], w);
    const step = (i, w) => { const d = piv(i + 1, w).sub(piv(i, w)); d.y = 0; return d; };
    const low = W.slice(0, N).map(([h, b]) => Math.min(h.y, b.y)), lo = Math.min(...low);
    const sp = low.map((y, i) => Math.min(step(i + N - 1, wb[i + N]).length(), step(i, wb[i]).length()) / dt);
    const on = low.map((y, i) => y < lo + 0.03 && sp[i] < (y < lo + 0.012 ? 2 : 1) * thr);
    // trous de deux images au plus comblés, appuis de moins de trois images ignorés
    for (const r of runs(on.map((x) => !x))) if (r.l <= 2 && r.l < N) for (let j = 0; j < r.l; j++) on[(r.s + j) % N] = true;
    for (const r of runs(on)) if (r.l < 3) for (let j = 0; j < r.l; j++) on[(r.s + j) % N] = false;
    const R = runs(on);
    if (!R.length || R[0].l >= N) continue;
    // niveau d'appui : médiane du point le plus bas pendant les appuis
    const gl = low.filter((y, i) => on[i]).sort((a, b) => a - b), gnd = gl[gl.length >> 1];
    const c = new Array(N), up = new Array(N);
    for (const r of R) {
      const v = new THREE.Vector3(), a = [v.clone()];
      for (let j = 1; j < r.l; j++) { v.sub(step(r.s + j - 1, wb[r.s + j])); a.push(v.clone()); }
      const m = a[0].clone().add(a[r.l - 1]).multiplyScalar(0.5);
      a.forEach((x, j) => { const i = (r.s + j) % N; c[i] = x.sub(m); up[i] = Math.max(0, gnd - low[i]); });
    }
    R.forEach((r, k) => {
      const n = R[(k + 1) % R.length], e = r.s + r.l - 1, g = (((n.s - e) % N) + N) % N || N, c0 = c[e % N], c1 = c[n.s], u0 = up[e % N], u1 = up[n.s];
      for (let j = 1; j < g; j++) {
        const i = (e + j) % N, u = ss(j / g, 0, 1);
        c[i] = c0.clone().lerp(c1, u);
        up[i] = Math.max(u0 + (u1 - u0) * u, gnd + GARDE - low[i]);
      }
    });
    for (let i = 0; i < N; i++) { Q[i].feet[f].x += c[i].x; Q[i].feet[f].y += up[i]; Q[i].feet[f].z += c[i].z; }
  }
}

/* Os dessinés pour la référence (page de comparaison) */
export const DRAW_BONES = ['Hips', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
/* Un clip du manifeste (entrée c), prêt à quantifier, à 30 images par seconde :
   - déplacement retiré : pour une boucle, la partie linéaire de la piste horizontale du bassin (le balancement reste) ; pour un clip qui
     avance sans boucler (glissade), toute la piste horizontale ; vitesse gv et direction dir (repère du corps du jeu, à l'échelle) ;
   - boucle raccordée : l'écart entre la pose à t = durée (qui doit répéter la première) et la première est fondu sur le dernier quart ;
   - phase alignée : l'image 0 d'un clip de déplacement est la pose du pied gauche (début de son plus long appui : pied qui s'arrête au sol),
     comme S.cyc = 0 dans le jeu ; appuis verrouillés (lockFeet) ; aucune semelle sous le sol ;
   Q : grandeurs par image (quantities) ; R : points des os (DRAW_BONES) dans le repère du jeu, même ancrage et même phase que Q. */
export async function bakeClip(c) {
  const id = c.fichier.replace(/\.glb$/, ''), A = await loadGlb(path.join(SRC, c.fichier));
  const loop = !!c.boucle, dur = A.dur;
  const N = loop ? Math.round(dur * FPS) : Math.round(dur * FPS) + 1;
  const T = []; for (let i = 0; i < N; i++) T.push(loop ? (i * dur) / N : Math.min(i / FPS, dur));
  const P = T.map((t) => A.at(t)), Pend = A.at(dur);
  const h0 = P[0].Hips.p, h1 = Pend.Hips.p, vel = new THREE.Vector3(h1.x - h0.x, 0, h1.z - h0.z).divideScalar(dur || 1);
  const moving = vel.length() > 0.3, lin = (t) => new THREE.Vector3(h0.x + vel.x * t, 0, h0.z + vel.z * t);
  let roots;
  if (!loop && moving) roots = P.map((p) => new THREE.Vector3(p.Hips.p.x, 0, p.Hips.p.z)); // glissade : le bassin reste au-dessus de l'ancrage
  else {
    const m = new THREE.Vector3(); P.forEach((p, i) => m.add(new THREE.Vector3(p.Hips.p.x, 0, p.Hips.p.z).sub(lin(T[i])))); m.divideScalar(N);
    roots = T.map((t) => lin(t).add(m));
  }
  let Q = P.map((p, i) => quantities(A, p, roots[i]));
  let seam = 0;
  if (loop) {
    const qe = quantities(A, Pend, lin(dur).add(roots[0].clone().sub(lin(0)))), q0 = Q[0];
    seam = THREE.MathUtils.radToDeg(Math.max(qe.qT.angleTo(q0.qT), qe.qP.angleTo(q0.qP), qe.qH.angleTo(q0.qH)));
    const B = Math.max(2, Math.round(N / 4));
    for (let i = N - B; i < N; i++) {
      const s = (i - (N - B) + 1) / (B + 1), w = s * s * (3 - 2 * s), q = Q[i];
      const fix = (a, e0, e1) => a.addScaledVector(new THREE.Vector3().subVectors(e1, e0), -w);
      fix(q.pel, q0.pel, qe.pel); for (let f = 0; f < 2; f++) fix(q.feet[f], q0.feet[f], qe.feet[f]);
      for (const k of ['qP', 'qT', 'qH']) { const d = q0[k].clone().multiply(qe[k].clone().invert()); q[k].premultiply(new THREE.Quaternion().slerp(d, w)); }
      for (let f = 0; f < 2; f++) { q.pitch[f] -= (qe.pitch[f] - q0.pitch[f]) * w; q.yaw[f] -= (qe.yaw[f] - q0.yaw[f]) * w; fix(q.knee[f], q0.knee[f], qe.knee[f]).normalize(); }
    }
  }
  let ph = 0;
  if (loop && moving) {
    const sp = P.map((p, i) => (i < N - 1 ? p.LeftFoot.p.distanceTo(P[i + 1].LeftFoot.p) : p.LeftFoot.p.distanceTo(Pend.LeftFoot.p)) * N / dur);
    const thr = Math.max(0.3, vel.length() * 0.3), st = sp.map((v) => v < thr);
    let best = -1, bl = 0;
    for (let i = 0; i < N; i++) if (st[i] && !st[(i - 1 + N) % N]) { let l = 0; while (l < N && st[(i + l) % N]) l++; if (l > bl) { bl = l; best = i; } }
    if (best > 0) { ph = best; Q = Q.slice(ph).concat(Q.slice(0, ph)); }
    lockFeet(Q, N, dur, new THREE.Vector3(-vel.x, 0, -vel.z).multiplyScalar(A.k), vel.length() * A.k);
  }
  // plancher : aucune semelle de ranger sous le sol (son talon dépasse celui du X Bot : pied tendu de la glissade, pointe levée)
  for (const q of Q) for (let f = 0; f < 2; f++) { const lo = Math.min(...soleW(q.qP, q.yaw[f], q.pitch[f], q.feet[f]).map((p) => p.y)); if (lo < 0.004) q.feet[f].y += 0.004 - lo; }
  for (const k of ['qP', 'qT', 'qH']) for (let i = 1; i < N; i++) if (Q[i][k].dot(Q[i - 1][k]) < 0) { const q = Q[i][k]; q.set(-q.x, -q.y, -q.z, -q.w); }
  const R = []; for (let i = 0; i < N; i++) { const j = (i + ph) % N; R.push(DRAW_BONES.map((b) => toGameV(new THREE.Vector3().subVectors(P[j][b].p, roots[j])).multiplyScalar(A.k))); }
  const gv = new THREE.Vector3(-vel.x, 0, -vel.z).multiplyScalar(A.k), spd = gv.length();
  const dir = spd > 0.3 ? Math.round(THREE.MathUtils.radToDeg(Math.atan2(-gv.x, -gv.z))) : null;
  return { id, loop, dur, N, T, Q, ph, seam, k: A.k, gv, spd, dir, R };
}
