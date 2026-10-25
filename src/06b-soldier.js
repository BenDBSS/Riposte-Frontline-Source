/* ==========================================================================
   SOLDATS : silhouette stylisée pilotée par 15 articulations.
   Vivant : pose procédurale (IK bras et jambes). Mort : ragdoll (06h-ragdoll.js)
   avec collisions contre la carte. Les hitboxes suivent les articulations.
   ========================================================================== */
const J_PEL = 0, J_CHE = 1, J_HEAD = 2, J_SHL = 3, J_ELL = 4, J_HAL = 5, J_SHR = 6, J_ELR = 7, J_HAR = 8, J_HIL = 9, J_KNL = 10, J_FTL = 11, J_HIR = 12, J_KNR = 13, J_FTR = 14;
function setSoldierGun(model, key) {
  gunSoundPrepare(weaponDefByKey(key).sound);
  if (model.gun) model.root.remove(model.gun);
  const g = buildWorldGun(key);
  setGunLod(g.group, !!(model.lod && model.lod.hiOn), model.shadowOnly);
  model.root.add(g.group); model.gun = g.group; model.muzzleLocal = g.muzzle; model.gunKey = key; model.kind = g.kind; model.grips = gripsFor(key);
}

/* ---------- Pose procédurale ---------- */
const _pz = { a: new V3(), b: new V3(), c: new V3(), q: new THREE.Quaternion(), qp: new THREE.Quaternion(), m: new THREE.Matrix4(), X: new V3(), Y: new V3(), Z: new V3() };
function ik2(S, T, a, b, pole, outE, outT) {
  const d = _pz.a.subVectors(T, S); const len = clamp(d.length(), 0.05, a + b - 0.002); d.normalize();
  const cosA = clamp((a * a + len * len - b * b) / (2 * a * len), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const p = _pz.b.subVectors(pole, S); p.addScaledVector(d, -p.dot(d)); if (p.lengthSq() < 1e-8) p.set(0, -1, 0); p.normalize();
  outE.copy(S).addScaledVector(d, a * cosA).addScaledVector(p, a * sinA);
  outT.copy(S).addScaledVector(d, len);
}
/* Bras vers une main posée sur l'arme (repère de main Q0, point de prise G) : le coude se place là où l'avant-bras
   prolonge la main (poignet droit) au lieu de pointer dans une direction fixe, si bien que tout le bras suit l'arme quand
   elle vise haut ou bas ; si le poignet reste cassé au-delà de 25°, la main pivote un peu sur la poignée vers
   l'avant-bras. w : poignet visé (modifié en place) ; pole : direction naturelle du coude ; k : 1 main sur l'arme, 0 libre ;
   align : part de la direction de la main dans le choix du coude (le reste suit le pôle) */
const _ag = { z: new V3(), p: new V3(), f: new V3(), n: new V3(), q: new THREE.Quaternion(), i: new THREE.Quaternion() };
function armToGrip(sh, w, G, Q0, pole, k, jE, jH, align = 0.75) {
  const A = _ag;
  A.z.set(0, 0, 1).applyQuaternion(Q0);
  A.p.copy(w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
  ik2(sh, w, SD.ua, SD.fa, A.p, jE, jH);
  if (k <= 0) return;
  A.f.subVectors(jH, jE).normalize(); A.n.copy(A.z).negate();
  const ang = Math.acos(clamp(A.f.dot(A.n), -1, 1)), lim = 0.44;
  if (ang <= lim) return;
  A.q.setFromUnitVectors(A.n, A.f); A.i.identity().slerp(A.q, (ang - lim) / ang * k);
  w.sub(G).applyQuaternion(A.i).add(G);
  A.z.set(0, 0, 1).applyQuaternion(A.i.multiply(Q0));
  A.p.copy(w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
  ik2(sh, w, SD.ua, SD.fa, A.p, jE, jH);
}
/* Bras gauche vers une main d'appui qui roule autour de sa prise (garde-main, poignée d'appui : axe F.axis du repère de la main,
   amplitude F.range), comme en vue subjective : parmi neuf roulis, celui qui garde le poignet le plus droit, au lieu d'un pivot libre
   qui décollerait la paume du garde-main d'un côté et l'y enfoncerait de l'autre ; pour chaque roulis, la paume reste à la hauteur
   du garde-main (soldierLift : prises _ar.grips, recul _ar.sl posés par poseSoldier). Mêmes paramètres qu'armToGrip ; layoutSoldier
   retrouve le roulis d'après le poignet. */
const _ar = { grips: null, sl: 0, a: new V3(), d: new V3(), y: new V3(), z0: new V3(), w: new V3(), z: new V3(), p: new V3(), e: new V3(), h: new V3(), f: new V3(), r: new THREE.Quaternion() };
function armToGripRoll(sh, w, G, Q0, pole, k, jE, jH, align, F) {
  const A = _ar, N = 9, l0 = soldierLift(A.grips, A.sl), lo = F.lift ? F.lift.lo : l0;
  A.a.copy(F.axis).applyQuaternion(Q0); A.d.subVectors(w, G); A.y.set(0, 1, 0).applyQuaternion(Q0); A.z0.set(0, 0, 1).applyQuaternion(Q0);
  let best = 0, bc = 1e9;
  for (let i = 0; i < N; i++) {
    const phi = (i / (N - 1) * 2 - 1) * Math.min(F.range, SOLDIER_ROLL) * k;
    rollWrist(A, G, phi, F, l0);
    A.p.copy(A.w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
    ik2(sh, A.w, SD.ua, SD.fa, A.p, A.e, A.h);
    // poignet le plus droit ; un roulis qui ferait descendre la paume (pièce saillante sous le garde-main) est écarté
    const ang = Math.acos(clamp(-A.f.subVectors(A.h, A.e).normalize().dot(A.z), -1, 1));
    const c = Math.max(0, ang - 0.44) ** 2 + 0.05 * phi * phi + 2000 * Math.max(0, soldierLift(A.grips, A.sl, phi) - lo - 0.003) ** 2;
    if (c < bc) { bc = c; best = phi; }
  }
  rollWrist(A, G, best, F, l0); w.copy(A.w);
  A.p.copy(w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
  ik2(sh, w, SD.ua, SD.fa, A.p, jE, jH);
}
/* poignet (A.w) et axe de la main vers l'avant-bras (A.z) quand la main a roulé de phi autour de sa prise G ; la paume se règle sur la
   hauteur du garde-main pour ce roulis (dos de la main : A.y) */
function rollWrist(A, G, phi, F, l0) {
  A.r.setFromAxisAngle(A.a, phi);
  A.w.copy(A.d).addScaledVector(A.y, soldierLift(A.grips, A.sl, phi) - l0).applyQuaternion(A.r).add(G);
  A.z.copy(A.z0).applyQuaternion(A.r);
}
const _L = []; for (let i = 0; i < 15; i++) _L.push(new V3());
/* avancée maximale de l'épaule gauche vers une main d'appui hors de portée (m) ; roulis maximal de la main d'appui d'un soldat autour
   de sa prise (rad, sa main figée n'épouse pas l'arme comme celle de la vue subjective) */
const SOLDIER_PROT = 0.09, SOLDIER_ROLL = 0.35, _gripLw = new V3();
const _tmpA = new V3(), _tmpB = new V3(), _tmpC = new V3(), _tmpD = new V3();
function rotX(v, a) { const c = Math.cos(a), s = Math.sin(a), y = v.y * c - v.z * s, z = v.y * s + v.z * c; v.y = y; v.z = z; return v; }

const _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _qT = new THREE.Quaternion(), _qH = new THREE.Quaternion(), _qG = new THREE.Quaternion(), _qY = new THREE.Quaternion(), _qW = new THREE.Quaternion();
const _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _tmpE = new V3(), _tmpF = new V3(), _tmpG = new V3(), _tmpH = new V3();
/* Pose procédurale : cycle de marche à appuis réels (le pied posé ne glisse pas),
   bassin qui monte, se décale, pivote et bascule à chaque pas, épaules en contre-rotation,
   arme et bras entraînés par le buste avec un léger retard, course à phase aérienne,
   pas chassés, marche arrière, accroupi statique et mobile, piétinement en pivot, respiration.
   Haut du corps : trois postures qui se fondent l'une dans l'autre par des ressorts (jamais de saut de pose) :
     visée : crosse au creux de l'épaule droite, buste de profil (épaule gauche avancée), joue sur la crosse,
             buste qui se plie pour viser haut ou bas ; pistolet tenu à deux mains, bras tendus ;
     port bas : canon vers le sol, en travers du corps ;
     sprint : arme en travers de la poitrine, canon vers le haut à gauche, qui pompe au rythme des foulées.
   Saut : jambes repliées ; réception amortie par les genoux. Les pieds se posent sur les marches (hauteur du sol
   sous chaque pied), le bassin descend pour que la jambe atteigne la marche basse.
   Rechargement : l'arme bascule, la main gauche tire le chargeur, va au porte-chargeurs du gilet, revient,
   insère et claque le chargeur ; fusil à pompe : une navette par cartouche entre la ceinture et le port de chargement. */
/* Ressort amorti sur S[k], vitesse dans S[v] (clés écrites en toutes lettres par l'appelant : une clé recomposée, k + 'V', allouait
   une chaîne à chaque appel). Les champs existent dès la première pose (poseSoldier) : une propriété ajoutée par une clé calculée
   faisait passer le modèle en dictionnaire, chaque lecture devenait une recherche et chaque nombre écrit une allocation. */
/* Ressort amorti : nouvelle vitesse d'une valeur x de vitesse v tirée vers target ; l'appelant avance ensuite la valeur
   ((S.kV = sprV(S.k, S.kV, ...), S.k += S.kV * dt), qui vaut la nouvelle valeur). Jusqu'à la 5.4.0, spr(S, 'k', 'kV', ...) lisait et
   écrivait S[k] par une clé calculée : douze clés au même endroit, l'accès passait par le chemin générique de V8 et chaque nombre écrit
   était alloué (environ 30 Ko par image pour 12 soldats à 280 images par seconde, autant de petits ramasse-miettes) */
function sprV(x, v, target, stiff, damping, dt) { return v + ((target - x) * stiff - v * damping) * dt; }
/* talon de crosse (appui à l'épaule) et prise du chargeur (main gauche) dans le repère de l'arme : GUN_BUTT et GUN_MAGP (06j-modeles.js), par arme */
const _qS = new THREE.Quaternion(), _qL = new THREE.Quaternion(), _pk = new V3(), _sLp = new V3(), _mp = new V3(), _hl = new V3(), _ft = [new V3(), new V3()];
const _gl = [new V3(), new V3()], _tl = [new V3(), new V3()], _fpG = [0, 0], _fyW = [0, 0], _qC = new THREE.Quaternion(), _qD = new THREE.Quaternion(), _qE = new THREE.Quaternion(), _qF = new THREE.Quaternion(), _qI = new THREE.Quaternion(), _vA = new V3();
/* Appuis à l'arrêt : chaque pied reste planté au sol (coordonnées du monde) au lieu de glisser vers sa place. Quand l'un
   s'en écarte trop (arrêt après une course, pivot sur place, changement de posture), il fait un vrai pas, un pied à la
   fois : il se lève, avance en arc jusqu'à sa place et se repose, la pointe tournée comme il faut, pendant que le bassin se
   reporte sur l'autre pied. gl : pieds de la marche, tl : places visées (repère du corps), fyT : lacets visés (par rapport
   aux hanches), hipW : lacet des hanches. Résultat par pied : l (position, repère du corps), fy (lacet), pitch. */
function footPlant(e, S, pk, dt, cy, sy, hipW, gl, tl, fyT) {
  const P = S.plant || (S.plant = [0, 1].map(() => ({ x: 0, z: 0, yaw: 0, s: -1, fx: 0, fz: 0, fyaw: 0, dur: 0.3, d0: 0, l: new V3(), fy: 0, pitch: 0 })));
  S.stepSh = 0; S.stepDip = 0;
  if (pk <= 0.001) { S.plantOn = false; return P; }
  const wx = (l) => e.pos.x + l.x * cy + l.z * sy, wz = (l) => e.pos.z - l.x * sy + l.z * cy, by = e.yaw + hipW;
  if (!S.plantOn) {
    // entrée à l'arrêt : les pieds sont plantés là où la marche les a laissés
    // (un pied surpris en l'air termine son pas depuis sa hauteur au lieu de retomber d'un coup)
    for (let i = 0; i < 2; i++) {
      const p = P[i]; p.x = wx(gl[i]); p.z = wz(gl[i]); p.yaw = by + S.fy[i]; p.s = -1; p.l0 = Math.max(0, gl[i].y - tl[i].y);
      if (p.l0 > 0.012) { p.s = 0; p.fx = p.x; p.fz = p.z; p.fyaw = p.yaw; p.d0 = 0.1; p.dur = 0.18; }
    }
    S.plantOn = true; S.stepCd = 0.12;
  }
  let worst = -1, we = 0;
  for (let i = 0; i < 2; i++) {
    const p = P[i], tx = wx(tl[i]), tz = wz(tl[i]), ty = by + fyT[i], d = hyp(p.x - tx, p.z - tz), da = Math.abs(angDiff(p.yaw, ty));
    if (d > 0.9) { p.x = tx; p.z = tz; p.yaw = ty; p.s = -1; continue; } // téléporté (réapparition) : pas de pas à travers la carte
    if (p.s >= 0) {
      p.s += dt / p.dur;
      const s = Math.min(1, p.s), k = s * s * (3 - 2 * s), side = i === 0 ? -1 : 1;
      p.x = lerp(p.fx, tx, k); p.z = lerp(p.fz, tz, k); p.yaw = p.fyaw + angDiff(p.fyaw, ty) * k;
      p.lift = Math.max(Math.sin(Math.PI * s) * Math.min(0.075, 0.03 + p.d0 * 0.2), (p.l0 || 0) * (1 - k)); p.pitch = -0.22 * Math.sin(Math.PI * s);
      S.stepSh = -side * 0.028 * Math.sin(Math.PI * s); S.stepDip = 0.01 * Math.sin(Math.PI * s);
      if (p.s >= 1) { p.s = -1; p.lift = 0; p.pitch = 0; p.l0 = 0; S.stepCd = 0.06; }
    } else {
      p.lift = 0; p.pitch = 0;
      const err = d + 0.12 * da + (da > 1.0 ? 1 : 0);
      if (err > we) { we = err; worst = i; }
    }
  }
  // un seul pied à la fois ; au-delà de 7 cm (ou d'un quart de tour de la pointe) il va reprendre sa place
  S.stepCd = (S.stepCd || 0) - dt;
  if (worst >= 0 && P[0].s < 0 && P[1].s < 0 && S.stepCd <= 0 && we > 0.075) {
    const p = P[worst]; p.s = 0; p.l0 = 0; p.fx = p.x; p.fz = p.z; p.fyaw = p.yaw; p.d0 = Math.min(we, 0.5); p.dur = clamp(0.2 + p.d0 * 0.3, 0.2, 0.34);
  }
  for (let i = 0; i < 2; i++) {
    const p = P[i], ex = p.x - e.pos.x, ez = p.z - e.pos.z;
    p.l.set(ex * cy - ez * sy, tl[i].y + (p.lift || 0), ex * sy + ez * cy);
    p.fy = clamp(angDiff(by, p.yaw), -1.1, 1.1);
  }
  return P;
}
/* écart d'orientation q0 vers q (repère du corps), tourné de _qF (sens du coup) et dosé par k ; résultat dans _qE */
function hitDelta(q, q0, k) {
  _qD.copy(q).multiply(_qI.copy(q0).invert()).premultiply(_qF).multiply(_qI.copy(_qF).invert());
  return _qE.identity().slerp(_qD, k);
}
function poseSoldier(e, dt) {
  const S = e.model, J = S.J, L = _L;
  for (let i = 0; i < 15; i++) S.Jp[i].copy(J[i]);
  if (dt > 0) S.pdt = dt; // durée de cette image : le ragdoll en déduit la vitesse des articulations
  if (S.cyc === undefined) { S.cyc = Math.random(); S.hipYaw = 0; S.aimW = 1; S.aimWV = 0; S.ld = 0; S.ldV = 0; S.wt = 0; S.wtV = 0; S.lk = 0; S.lkV = 0; S.lkp = 0; S.lkpV = 0; S.rg = 0; S.rgV = 0; S.hr = 0; S.hrV = 0; S.lean = 0; S.leanV = 0; S.sroll = 0; S.srollV = 0; S.blade = 0; S.bladeV = 0; S.twist = 0; S.twistV = 0; S.gby = 0; S.gbyV = 0; S.gbw = 0; S.gbwV = 0; S.rk = 0; S.rkV = 0; S.runW = 0; S.sprW = 0; S.airW = 0; S.lastYaw = e.yaw; S.turn = 0; S.t = Math.random() * 10; S.lastV = 0; S.fp = [0, 0]; S.fy = [0, 0]; S.fyG = [0, 0]; S.amp = 0; S.wasAir = false; S.gyL = 0; S.gyR = 0; }
  S.t += dt;
  const v = hyp(e.vel.x, e.vel.z), c = e.crouchAmt || 0, K = S.kind || 'rifle', isP = K === 'pistol';
  // clips (06ac-loco.js)
  const clipOK = locoInit();
  const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
  const lvx = e.vel.x * cy - e.vel.z * sy, lvz = e.vel.x * sy + e.vel.z * cy;
  const dyaw = dt > 0 ? angDiff(S.lastYaw, e.yaw) / dt : 0; S.lastYaw = e.yaw;
  S.turn = damp(S.turn, v < 0.8 ? clamp(Math.abs(dyaw) / 2.5, 0, 1) : 0, 8, dt);
  const sprinting = !!e.sprinting && v > 2.5;
  const aiming = e.isPlayer ? !PL.sprinting : !sprinting && ((e.visible && e.target && e.target.alive) || MATCH.time - e.lastShotT < 1.2 || MATCH.time - e.lastSeenT < 3 || (e.arms && e.arms.adsW > 0.5));
  // épauler : ressort vif et à peine sous-amorti (l'arme arrive sur la cible et se pose), redescente plus lente
  S.aimWV = sprV(S.aimW, S.aimWV, aiming ? 1 : 0, aiming ? 120 : 34, aiming ? 17 : 11, dt); S.aimW += S.aimWV * dt; S.aimW = clamp(S.aimW, -0.05, 1.05);
  S.sprW = damp(S.sprW, sprinting ? 1 : 0, sprinting ? 6 : 8, dt);
  S.runW = damp(S.runW, clamp((v - 3.8) / 1.3, 0, 1) * (1 - c), 5, dt);
  // en l'air : jambes repliées ; à la réception, les genoux amortissent (ressort sur la hauteur du bassin)
  const air = e.onGround === false;
  S.airW = damp(S.airW, air ? 1 : 0, air ? 9 : 16, dt);
  const landed = S.wasAir && !air;
  if (landed) { S.ldV = (S.ldV || 0) - clamp(-(S.airVy || 0) * 0.16, 0.35, 1.6); }
  if (clipOK) locoAirT(S, air, landed, e.vy || 0, S.airVy || 0, dt);
  S.wasAir = air; S.airVy = e.vy || 0;
  const land = (S.ldV = sprV(S.ld, S.ldV, 0, 170, 13, dt), S.ld += S.ldV * dt);
  const run = S.runW, aw = smoothstep(0, 1, clamp(S.aimW, 0, 1)), sw = smoothstep(0, 1, S.sprW) * (1 - aw), airW = S.airW;
  const acc = dt > 0 ? (v - S.lastV) / dt : 0; S.lastV = v;
  // amplitude globale du cycle (0 à l'arrêt, 1 en marche), lissée pour des départs et arrêts souples
  // (pivot sur place : debout, ce sont les pieds plantés qui font de vrais pas, voir footPlant ; accroupi, le cycle piétine)
  S.amp = damp(S.amp, Math.max(clamp(v / 2.2, 0, 1), S.turn * 0.5 * c) * (1 - airW), 6, dt);
  const amp = S.amp;
  // ---- déplacement par clips (06ac-loco.js) pour les bots au fusil : kc, part du clip ; ka, cette part fondue avec l'amplitude due à
  //      la vitesse (ampV : à l'arrêt, posture et pieds plantés restent procéduraux, comme le piétinement d'un pivot accroupi) ; ampP, ce
  //      qui reste au cycle procédural ; wf, part du clip dans le cycle
  S.ampV = damp(S.ampV || 0, clamp(v / 2.2, 0, 1) * (1 - airW), 6, dt);
  const kc = clipOK ? 1 - airW : 0, ampV = Math.min(S.ampV, amp), ka = kc * ampV, ampP = amp - ka;
  const wf = amp > 1e-3 ? ka / amp : kc;
  // ---- posture de combat au repos : genoux fléchis au-dessus des pointes, bassin bas et en arrière, buste en avant
  //      (plus marquée en visée) ; st vaut 1 à l'arrêt, debout
  const st = (1 - amp) * (1 - c) * (1 - airW);
  // ---- vie au repos : transferts de poids d'une jambe à l'autre, regard qui balaie les alentours, arme réajustée
  const idle = (1 - amp) * (1 - c * 0.5) * (1 - airW);
  if ((S.wtClk = (S.wtClk || 0) - dt) <= 0) { S.wtClk = rand(2.4, 5.8); S.wtT = (S.wtT > 0 ? -1 : 1) * rand(0.45, 1); }
  if ((S.lkClk = (S.lkClk || 0) - dt) <= 0) {
    S.lkClk = rand(1.4, 4.2); S.lkT = Math.random() < 0.3 ? 0 : rand(-0.75, 0.75); S.lkP = rand(-0.14, 0.1);
    if (!aiming && Math.random() < 0.35) S.rgV = (S.rgV || 0) + 3.2; // réajuste l'arme en main
  }
  const wt = (S.wtV = sprV(S.wt, S.wtV, (S.wtT || 0) * idle * (1 - 0.5 * clamp(S.aimW, 0, 1)), 13, 7.2, dt), S.wt += S.wtV * dt);
  const look = (S.lkV = sprV(S.lk, S.lkV, (S.lkT || 0) * idle * (1 - clamp(S.aimW, 0, 1)), 26, 9.5, dt), S.lk += S.lkV * dt), lookP = (S.lkpV = sprV(S.lkp, S.lkpV, (S.lkP || 0) * idle * (1 - clamp(S.aimW, 0, 1)), 26, 9.5, dt), S.lkp += S.lkpV * dt);
  const regrip = (S.rgV = sprV(S.rg, S.rgV, 0, 95, 9, dt), S.rg += S.rgV * dt);
  // ---- impact : le corps encaisse dans le sens du tir (impulsion amortie : il part, dépasse un peu, revient)
  const kick = S.hitKick || 0;
  if (kick) { S.hrV = (S.hrV || 0) + 11 * kick; S.hitKick = 0; }
  const hr = (S.hrV = sprV(S.hr, S.hrV, 0, 150, 11.5, dt), S.hr += S.hrV * dt);
  let hx = 0, hz = 1;
  if (S.hitDir) { hx = S.hitDir.x * cy - S.hitDir.z * sy; hz = S.hitDir.x * sy + S.hitDir.z * cy; const l = hyp(hx, hz) || 1; hx /= l; hz /= l; }
  // clips : coup reçu en couche additive (06ac-loco.js)
  if (clipOK && kick) locoHitStart(S, kick, hx, hz);
  const HIT = clipOK ? locoHit(S, dt, LOCO.mh) : null;
  if (HIT) _qF.setFromAxisAngle(UP, S.hA);
  // ---- recul du tir : l'épaule et le buste encaissent chaque coup
  const rec = e.recoil || 0;
  // direction de déplacement dans le repère du corps
  let dx = 0, dz = -1;
  if (v > 0.25) { dx = lvx / v; dz = lvz / v; S.lth = Math.atan2(-lvx, -lvz); } else if (S.turn > 0.05) { dx = Math.sign(dyaw) * -1; dz = 0; }
  const fwdc = -dz, back = smoothstep(-0.2, -0.6, fwdc);
  // foulée et cadence : le pied au sol recule exactement à la vitesse du corps
  const A = (lerp(0.17, 0.33, clamp(v / 4.5, 0, 1)) + run * 0.06) * (1 - c * 0.3) * (1 - back * 0.25) * Math.max(amp, 0.001);
  const D = lerp(lerp(0.62, 0.44, clamp(v / 5, 0, 1)), 0.36, run);
  let rate = v > 0.25 ? (D * v) / Math.max(0.06, 2 * A) : (S.turn > 0.05 ? 1.3 : 0);
  // clips : la foulée est celle du clip (réduite avec l'amplitude), la cadence suit la vitesse
  const useC = ka > 1e-3;
  if (useC) { locoSel(v, S.lth || 0, sw, c, isP); rate = lerp(rate, v / (LOCO.L * LOCO.k * Math.max(ampV, 0.15)), wf); }
  S.cyc = (S.cyc + Math.min(rate, 2.7) * dt * (1 - airW)) % 1;
  const LM = useC ? locoPose(S.cyc, LOCO.m) : null;
  // saut : pose du clip en l'air (part kA), creux et flexion de la réception (REC) ; glissade (S.slT, temps depuis son début ; le
  // joueur glisse, un joueur distant envoie e.slide) : l'une ou l'autre recouvre la pose (OV, part kO)
  const LA = clipOK && airW > 0.01 ? locoAirPose(S, LOCO.ma) : null, kA = LA ? airW : 0, REC = clipOK ? locoRec(S, LOCO.mr) : null;
  const slOn = e.isRemote ? !!e.slide : (e.slideT || 0) > 0;
  S.slT = slOn ? (S.slOn ? S.slT + dt : 0) : S.slT || 0; S.slOn = slOn;
  const kS = clipOK ? clamp(e.slideAmt || 0, 0, 1) : 0, LS = kS > 0.01 ? locoSlidePose(S.slT, LOCO.ms) : null;
  const OV = LS && kS > kA ? LS : LA, kO = OV === LS ? kS : kA;
  const TW = TAU * S.cyc, mid = TW - D * Math.PI;
  // bassin (en visée à l'arrêt, les hanches s'effacent vers la droite avec le buste)
  const stanceYaw = -0.3 * aw * (1 - amp) * (isP ? 0.4 : 1);
  // en pas chassés, les hanches s'ouvrent franchement vers le déplacement (les jambes marchent dans leur axe, sans se croiser)
  // pendant que le buste reste face à la cible
  const latK = Math.abs(dx) * clamp(v / 1.5, 0, 1);
  const hipT = lerp(v > 0.5 ? clamp(-dx * (fwdc >= -0.25 ? 1 : -1) * 1.0, -1.0, 1.0) : stanceYaw, stanceYaw, kc); // clips : leurs hanches
  S.hipYaw = damp(S.hipYaw, hipT, 10, dt);
  const steady = 1 - aw * 0.65; // en visée : buste gainé, arme stable, seules les jambes travaillent
  S.flinch = damp(S.flinch || 0, 0, 9, dt);
  const bob = Math.cos(2 * mid) * lerp(0.013, 0.03, run) * ampP * lerp(1, 0.6, aw);
  const shift = -Math.cos(mid) * lerp(0.02, 0.012, run) * ampP * (1 - c * 0.5);
  const pYaw = -Math.cos(TW) * lerp(0.09, 0.14, run) * ampP;
  // hanche du côté de la jambe porteuse plus haute (contrapposto), l'autre genou se relâche
  const pRoll = -Math.cos(mid) * 0.045 * ampP * (1 - run * 0.4) + wt * 0.05;
  // buste : penché selon l'effort et l'accélération, plié pour viser haut ou bas, épaules en contre-rotation, profil en visée
  const gp = clamp(e.pitch, -1.1, 1.1);
  const leanT = 0.05 + 0.08 * ampP + (0.26 * run + 0.04 * sw) * (1 - kc) + 0.22 * c * (1 - ka) - 0.12 * back * ampP + clamp(acc * 0.045, -0.15, 0.18) - hr * hz * 0.5 - gp * 0.38 * aw + 0.18 * airW * (1 - kA)
    + st * (0.07 + 0.07 * aw) - rec * 2.2 + lookP * 0.3;
  const lean = (S.leanV = sprV(S.lean, S.leanV, leanT, 150, 19, dt), S.lean += S.leanV * dt);
  const strafeRoll = (S.srollV = sprV(S.sroll, S.srollV, -dx * 0.14 * clamp(v / 3, 0, 1) * (1 - run * 0.4) * (1 - kc) - hr * hx * 0.4, 140, 18, dt), S.sroll += S.srollV * dt);
  const blade = (S.bladeV = sprV(S.blade, S.bladeV, (isP ? -0.15 : -0.62) * aw + -0.12 * (1 - aw) * (1 - sw), 90, 16, dt), S.blade += S.bladeV * dt); // buste de profil en visée
  const twist = (S.twistV = sprV(S.twist, S.twistV, -pYaw * lerp(1.25, 0.95, aw) - S.hipYaw * lerp(0.35, -0.2, latK) + blade - stanceYaw + look * 0.3 - rec * 1.6 - hr * hx * 0.3, 180, 20, dt), S.twist += S.twistV * dt);
  const roll = (strafeRoll - pRoll * 0.8 + shift * 0.8) * lerp(1, 0.6, aw) - wt * 0.02;
  const breath = Math.sin(S.t * 1.7) * 0.008 * (1 - amp);
  const idleSway = Math.sin(S.t * 0.45) * 0.012 * (1 - amp);
  let pelY = lerp(SD.pel - 0.015 - st * (0.026 + 0.012 * aw), 0.62, c) - hr * 0.045 + bob - (0.035 * aw + 0.02) * ampP - run * 0.04 * (1 - kc) + Math.sin(S.t * 0.6) * 0.002 + (clipOK ? 0 : land * 0.13) - airW * 0.03;
  // clips : leur bassin, relevé debout autant que les jambes le permettent (5 cm au plus), abaissé accroupi (davantage en visée) pour
  // garder la tête à la hauteur de l'accroupi procédural (œil des bots, couverture, zones de touche)
  if (LM) pelY += ka * (LM.pel.y + lerp(c < 1 ? locoLift(S.cyc) : 0, LOCO_CDY[0] + LOCO_CDY[1] * aw, c) - lerp(SD.pel - 0.015, 0.62, c));
  if (REC) pelY += S.rK * (REC.pel.y - LOCO.rec0.pel.y);
  // les pieds sur le sol réel (marches, trottoirs) : hauteur du sol sous chaque pied, le bassin descend pour la jambe la plus basse
  const gL = e.onGround !== false ? S.gyL : 0, gR = e.onGround !== false ? S.gyR : 0;
  pelY += Math.min(0, Math.min(gL, gR)) * 0.95 + Math.max(0, Math.min(gL, gR)) * 0.5;
  // bassin vers la jambe porteuse, et en arrière des pieds en posture de combat (fesses en arrière, poids sur l'avant du pied)
  L[J_PEL].set(shift + idleSway + wt * 0.032 + (S.stepSh || 0) + (LM ? ka * LM.pel.x : 0), pelY - (S.stepDip || 0), st * (0.025 + 0.01 * aw) + (LM ? ka * LM.pel.z : 0));
  _eu.set(0, S.hipYaw + pYaw, pRoll); _qY.setFromEuler(_eu);
  if (LM) _qY.slerp(LM.qP, ka);
  // l'impact passe aussi directement dans le buste (sans le filtre des ressorts) : le coup se lit tout de suite
  _eu.set(-lean + hr * hz * 0.32, pYaw + twist, roll - hr * hx * 0.28); _qT.setFromEuler(_eu);
  if (LM) {
    // buste du clip (sans le lacet moyen qu'il tient en visée : le profil de visée le remplace), plus calme en visée et au sprint,
    // puis les termes d'intention (lacet, puis penchée et roulis) par-dessus
    _qC.setFromAxisAngle(UP, -LOCO.ty * aw).multiply(LM.qT); _qD.identity().slerp(_qC, ka * (1 - 0.3 * aw) * (1 - 0.4 * sw));
    _eu.set(0, pYaw + twist, 0); _qT.setFromEuler(_eu).multiply(_qD);
    _eu.set(-lean + hr * hz * 0.32, 0, roll - hr * hx * 0.28); _qT.multiply(_qD.setFromEuler(_eu));
  }
  if (OV) {
    // en l'air ou en glissade : bassin, hanches et buste du clip, composés comme ceux du déplacement
    L[J_PEL].lerp(_vA.copy(OV.pel), kO); _qY.slerp(OV.qP, kO);
    _eu.set(0, pYaw + twist, 0); _qD.setFromEuler(_eu).multiply(OV.qT);
    _eu.set(-lean + hr * hz * 0.32, 0, roll - hr * hx * 0.28); _qD.multiply(_qE.setFromEuler(_eu)); _qT.slerp(_qD, kO);
    if (OV === LS) locoSlideUp(_qT, L[J_PEL].y, kO); // glissade : tête vers 0,85 m, comme la caméra du joueur
  }
  // réception : flexion du buste du clip (dans son propre repère), dosée par la chute
  if (REC) { _qD.copy(LOCO.rec0.qT).invert().multiply(REC.qT); _qT.multiply(_qE.identity().slerp(_qD, S.rK)); }
  // coup reçu : écart du clip à sa première image, tourné dans le sens du tir et dosé par le coup (bassin, hanches, buste)
  if (HIT) {
    L[J_PEL].add(_vA.subVectors(HIT.pel, LOCO.hit0.pel).applyQuaternion(_qF).multiplyScalar(S.hK));
    _qY.premultiply(hitDelta(HIT.qP, LOCO.hit0.qP, S.hK)); _qT.premultiply(hitDelta(HIT.qT, LOCO.hit0.qT, S.hK));
  }
  // lancer de grenade et rechargement (hors fusil à pompe) : torsion du buste du clip, les mains restent celles du jeu
  if (clipOK) {
    const RLg = e.arms && e.arms.reload, thr = e.throwT > 0, tt = thr ? 1 - e.throwT / 0.7 : RLg && !RLg.tube ? rythme3p(RLg.t / RLg.dur) : -1;
    const G = tt >= 0 ? locoGesture(thr, tt, LOCO.mx) : null;
    if (G) {
      const w = (thr ? 0.8 : 0.6) * smoothstep(0, 0.08, tt) * (1 - smoothstep(0.92, 1, tt));
      _qD.copy(G.qT).multiply(_qI.copy(LOCO.x0.qT).invert()); _qT.premultiply(_qE.identity().slerp(_qD, w));
    }
  }
  L[J_CHE].set(0, SD.trunk + breath, 0).applyQuaternion(_qT).add(L[J_PEL]);
  const hunch = 0.02 + 0.03 * run + 0.02 * amp;
  const shc = _tmpA.set(0, SD.shY, -hunch).applyQuaternion(_qT).add(L[J_CHE]);
  L[J_SHL].set(-SD.shX, breath * 0.6, SD.shZ).applyQuaternion(_qT).add(shc); L[J_SHR].set(SD.shX, breath * 0.6 + 0.03 * aw * (isP ? 0 : 1), SD.shZ + rec * (isP ? 0.2 : 0.5)).applyQuaternion(_qT).add(shc);
  // tête : compense le buste pour garder le regard sur la cible ; en visée, joue posée sur la crosse (tête avancée, baissée, inclinée).
  // _qH est l'orientation de la tête dans le repère du corps (pas du buste) : son lacet ne garde qu'une part de celui du buste (en
  // visée, aucune : le regard suit l'arme ; avant, -tY le comptait deux fois et la tête regardait 30 degrés à gauche de l'arme)
  const tY = pYaw + twist;
  _eu.set(clamp(gp * 0.55, -0.45, 0.5) + lean * -0.62 - bob * 0.8 + 0.1 * aw * (isP ? 0 : 1) + lookP - hr * hz * (S.hitHead ? 0.9 : 0.35) + rec * 0.8,
    tY * lerp(0.3, 0, aw) + look - hr * hx * (S.hitHead ? 0.6 : 0.2), -roll * 0.7 - 0.22 * aw * (isP ? 0.2 : 1) + hr * hx * 0.25); _qH.setFromEuler(_eu);
  // (la tête du clip part de 30 degrés en arrière : réduite, le ressort d'impact la secoue déjà, et un second tir doit rester possible)
  if (HIT) _qH.premultiply(hitDelta(HIT.qH, LOCO.hit0.qH, S.hK * (S.hitHead ? 0.6 : 0.35)));
  L[J_HEAD].set(0.05 * aw * (isP ? 0 : 1), SD.head[1] - 0.035 * aw * (isP ? 0.3 : 1), SD.head[2] - hunch * 0.4 - 0.025 * aw).applyQuaternion(_qH).add(L[J_CHE]);
  // ---- arme : trois postures fondues
  const gunBobY = (S.gbyV = sprV(S.gby, S.gbyV, -bob * lerp(0.8, 0.25, aw), 220, 18, dt), S.gby += S.gbyV * dt), gunBobYaw = (S.gbwV = sprV(S.gbw, S.gbwV, (pYaw + twist - blade) * 0.35 * steady, 200, 18, dt), S.gbw += S.gbwV * dt);
  // visée : orientation du regard ; la crosse au creux de l'épaule droite (fusils) ou le pistolet bras tendus
  _eu.set(gp + gunBobY * 0.3 + hr * 0.22 + rec * 1.2, gunBobYaw * 0.45 - hr * hx * 0.18, roll * 0.25 - 0.04); _qA.setFromEuler(_eu);
  const aimP = _tmpB;
  if (!isP) {
    const bt = S.grips.butt;
    _pk.set(-0.045, 0.065, -0.035).applyQuaternion(_qT).add(L[J_SHR]);
    aimP.set(bt[0], bt[1], bt[2] - rec * 0.6).applyQuaternion(_qA).negate().add(_pk);
  } else aimP.set(0.02, 0.16, -0.46 + rec * 0.5).applyQuaternion(_qA).add(shc);
  aimP.y += gunBobY * 0.4;
  // port bas : canon vers le sol, en travers du corps
  const pump = Math.sin(TW) * run;
  _eu.set(-0.55 - run * 0.1 + gunBobY * 2.5 + pump * 0.06 + regrip * 0.22 - st * 0.08, (isP ? 0.2 : 0.5) + pump * 0.1, (isP ? 0.1 : 0.3) + roll * 1.2 - regrip * 0.12); _qB.setFromEuler(_eu); _qB.premultiply(_qT);
  const lowP = _tmpE.set(isP ? 0.02 : 0.03, isP ? -0.1 : -0.17, isP ? -0.3 : -0.27).applyQuaternion(_qT).add(shc);
  lowP.y += gunBobY + regrip * 0.025;
  // sprint : en travers de la poitrine, canon vers le haut à gauche, qui pompe avec les foulées
  const sp2 = Math.sin(TW) * sw, sp1 = Math.cos(2 * TW) * sw;
  _eu.set(isP ? -0.9 : 0.42 + sp1 * 0.08, isP ? 0.25 : 1.05 + sp2 * 0.12, isP ? 0.2 : -0.35 + sp2 * 0.18); _qS.setFromEuler(_eu); _qS.premultiply(_qT);
  _sLp.set((isP ? 0.14 : -0.02) + sp2 * 0.03, (isP ? -0.26 : -0.14) + sp1 * 0.025, isP ? -0.14 : -0.24).applyQuaternion(_qT).add(shc);
  const gunP = _tmpF.lerpVectors(lowP, aimP, aw).lerp(_sLp, sw);
  // épauler / abaisser : l'arme passe en arc devant le buste (et non à travers), canon qui mène
  const arcK = Math.sin(Math.PI * clamp(S.aimW, 0, 1)) * (1 - sw) * (isP ? 0.6 : 1);
  gunP.add(_tmpG.set(0.01, 0.035, -0.08).applyQuaternion(_qT).multiplyScalar(arcK));
  _qG.slerpQuaternions(_qB, _qA, aw).slerp(_qS, sw);
  // en l'air : l'arme se relève un peu, à la réception elle s'enfonce avec le buste
  gunP.y += land * 0.08 + airW * 0.02;
  // ---- rechargement : l'arme bascule vers le corps, la main gauche fait le trajet chargeur, porte-chargeurs, insertion
  const RL = e.arms && e.arms.reload;
  let relK = 0, handL = null;
  if (RL) {
    const tube = RL.tube, tt = tube ? (RL.phase === 'shell' ? RL.t / 0.46 : RL.phase === 'end' ? 1 : 0) : rythme3p(RL.t / RL.dur); // rythme : 06d-reload.js
    relK = tube ? 1 - smoothstep(0.8, 1, RL.phase === 'end' ? 1 : 0) : smoothstep(0, 0.12, tt) * (1 - smoothstep(0.86, 1, tt));
    relK = (S.rkV = sprV(S.rk, S.rkV, relK, 260, 24, dt), S.rk += S.rkV * dt); // l'arme bascule d'un coup sec
    _qL.setFromAxisAngle(_tmpG.set(0, 0, -1), 0.6 * relK); _qG.multiply(_qL);
    _qL.setFromAxisAngle(_tmpG.set(1, 0, 0), 0.22 * relK); _qG.multiply(_qL);
    gunP.addScaledVector(_tmpG.set(-0.03, 0.04, 0.07).applyQuaternion(_qT), relK);
    const mg = S.grips.magP, magW = _mp.set(mg[0], mg[1], mg[2]).applyQuaternion(_qG).add(gunP);
    const pouch = _pk.set(tube ? -0.14 : -0.02, tube ? -0.36 : -0.3, tube ? -0.05 : -0.22).applyQuaternion(_qT).add(shc);
    let k = 0;
    if (tube) k = RL.phase === 'shell' ? Math.sin(clamp(tt, 0, 1) * Math.PI) : 0;
    else k = tt < 0.14 ? 0 : tt < 0.3 ? smoothstep(0.14, 0.3, tt) : tt < 0.5 ? 1 : tt < 0.62 ? 1 - smoothstep(0.5, 0.62, tt) : 0;
    const atMag = tube ? relK : smoothstep(0.05, 0.14, tt) * (1 - smoothstep(0.7, 0.84, tt));
    handL = _hl.copy(magW).lerp(pouch, k);
    handL.y += Math.sin(S.t * 11) * 0.006 * k;
    if (!tube && tt > 0.62 && tt < 0.72) handL.y += Math.sin((tt - 0.62) / 0.1 * Math.PI) * 0.03; // claque sous le chargeur
    S.relAt = atMag;
  }
  // ---- poignets : la main se referme sur la prise (repère de main de la vue subjective), le poignet est en retrait
  const HF = soldierHandFrames(S);
  const wR = _tmpC.copy(HF[1].off).negate().add(_tmpH.set(0, 0, WRIST_OFF)).applyQuaternion(HF[1].q).add(S.grips.R).applyQuaternion(_qG).add(gunP);
  const wL = _tmpD.copy(HF[0].off).negate().add(_tmpH.set(0, 0, WRIST_OFF)).applyQuaternion(HF[0].q).add(S.grips.L).applyQuaternion(_qG).add(gunP);
  // garde-main hors de portée du bras gauche : l'épaule s'avance vers la main (omoplate), puis la main recule le long du garde-main
  // (gunGrips : sans le quitter ni approcher le chargeur)
  const gripW = _gripLw.copy(S.grips.L).applyQuaternion(_qG).add(gunP); _ar.sl = 0; _ar.grips = S.grips;
  if (!isP) {
    const reach = (SD.ua + SD.fa) * 0.95, toW = _tmpG.subVectors(wL, L[J_SHL]), d0 = toW.length();
    if (d0 > reach) {
      const pr = Math.min(d0 - reach, SOLDIER_PROT); L[J_SHL].addScaledVector(toW.normalize(), pr);
      const ax = _tmpH.set(0, 0, 1).applyQuaternion(_qG), c = -ax.dot(toW), sl = c > 0.2 ? Math.min((d0 - pr - reach) / c, S.grips.slide || 0) : 0;
      if (sl > 0) {
        wL.addScaledVector(ax, sl); gripW.addScaledVector(ax, sl); _ar.sl = sl;
        // la paume suit la hauteur du garde-main (dos de la main : y du repère de la main)
        wL.addScaledVector(_tmpH.set(0, 1, 0).applyQuaternion(HF[0].q).applyQuaternion(_qG), soldierLift(S.grips, sl) - soldierLift(S.grips, 0));
      }
    }
  }
  if (handL) wL.lerp(handL, clamp(S.relAt || 0, 0, 1));
  // lancer de grenade : bras droit armé derrière la tête puis projeté vers l'avant, buste en torsion
  if (e.throwT > 0) {
    e.throwT -= dt;
    const tt = 1 - e.throwT / 0.7, h = keySpline([[0, 0.2, -0.05, -0.1], [0.3, 0.3, 0.3, 0.25], [0.48, 0.28, 0.34, 0.2], [0.66, 0.08, 0.22, -0.45], [1, 0.16, -0.2, -0.3]], tt);
    wR.copy(h.applyQuaternion(_qT).add(shc));
  }
  const elbowOut = 0.9 + 0.35 * run;
  _qW.copy(_qG).multiply(HF[1].q);
  // coude droit : en visée il s'écarte à peine et reste plus bas que l'épaule (bras fléchi vers le bas, pas à l'horizontale)
  armToGrip(L[J_SHR], wR, _tmpH.copy(S.grips.R).applyQuaternion(_qG).add(gunP), _qW, _pz.c.set(elbowOut - 0.1 * aw, -0.45 - 0.25 * aw, 0.12).applyQuaternion(_qT).add(L[J_SHR]), e.throwT > 0 ? 0 : 1, L[J_ELR], L[J_HAR], lerp(0.75, 0.45, aw));
  _qW.copy(_qG).multiply(HF[0].q);
  // coude gauche : sous le garde-main, plus bas que l'épaule
  (HF[0].axis && !isP ? armToGripRoll : armToGrip)(L[J_SHL], wL, gripW, _qW, _pz.c.set(-elbowOut * 0.9 + 0.3 * aw, -0.6 - 0.35 * aw, -0.05).applyQuaternion(_qT).add(L[J_SHL]), 1 - clamp(S.relAt || 0, 0, 1) * (handL ? 1 : 0), L[J_ELL], L[J_HAL], lerp(0.75, 0.4, aw), HF[0]);
  // ---- jambes : appui (pied fixe au sol) puis balancé (pied levé en arc), talon puis pointe ; repliées en l'air
  const lift0 = lerp(0.13, 0.26, run) * (1 - c * 0.5);
  const blP = isP ? 0.3 : 1; // pistolet : tir de face (isocèle), pieds presque à la même hauteur
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const u = (S.cyc + i * 0.5) % 1;
    let off, lift = 0, pitch = 0;
    if (u < D) { const k = u / D; off = A * (1 - 2 * k); pitch = k > 0.75 ? -((k - 0.75) / 0.25) * 0.55 : (k < 0.12 ? (1 - k / 0.12) * 0.25 : 0); }
    else { const k = (u - D) / (1 - D), ks = k * k * (3 - 2 * k); off = -A + 2 * A * ks; lift = Math.sin(Math.PI * k) * lift0 * Math.min(1, amp * 1.5) + (run * 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.6))); pitch = k < 0.35 ? -0.5 * (1 - k / 0.35) : 0.25 * smoothstep(0.6, 1, k); }
    const moveC = Math.min(1, v / 1.5);
    // appuis : un peu plus larges que les épaules, pied gauche en avant, pied droit en arrière (plus en visée) ;
    // le pied libre (transfert de poids) s'avance et s'ouvre un peu
    const free = Math.max(0, -wt * side);
    const baseX = side * (lerp(0.16 + 0.015 * aw, 0.11, amp) + free * 0.015), baseZ = ((side > 0 ? 0.075 + 0.045 * aw * blP : -0.075 - 0.045 * aw * blP) - free * 0.03) * (1 - amp);
    const cbx = side * 0.15, cbz = lerp(side < 0 ? -0.24 : 0.32, side < 0 ? -0.08 : 0.12, moveC);
    const bxL = lerp(baseX, cbx, c), bzL = lerp(baseZ, cbz, c);
    // pied posé dans le repère du corps (le bassin tourne au-dessus du pied)
    _tmpG.set(bxL, 0, bzL);
    if (S.hipYaw) _tmpG.applyAxisAngle(UP, S.hipYaw);
    const gy = i === 0 ? gL : gR;
    const fyS = lerp(0.077, side < 0 ? 0.077 : lerp(0.097, 0.077, moveC), c) + gy;
    _tl[i].set(_tmpG.x + idleSway * 0.3, fyS, _tmpG.z); // place visée à l'arrêt
    _gl[i].set(_tmpG.x + dx * off * (1 - airW) + idleSway * 0.3, fyS + lift + airW * (side < 0 ? 0.3 : 0.22), _tmpG.z + dz * off * (1 - airW) + airW * (side < 0 ? -0.1 : 0.06));
    // pointes ouvertes (pied arrière de profil en visée, surtout à l'arrêt)
    const out = 0.07 + st * (side > 0 ? 0.16 + 0.26 * aw * blP : 0.08 + 0.05 * aw) + free * 0.1;
    S.fyG[i] = damp(S.fyG[i], -side * out * (1 - airW), 10, dt);
    _fpG[i] = (pitch * Math.min(1, amp * 1.3) * (1 - c * 0.5)) * (1 - airW) - 0.35 * airW;
    _fyW[i] = S.fyG[i];
    if (LM) {
      // pied du clip, posé sur le sol réel, qui s'écarte de sa place à l'arrêt avec l'amplitude du cycle (la levée du pied, elle, reste
      // entière dès les petites vitesses : il ne frotte pas le sol)
      const yl = Math.min(1, ampV * 1.5);
      _tmpG.set(lerp(_tl[i].x, LM.ft[i].x, ampV), lerp(_tl[i].y, LM.ft[i].y + gy, yl), lerp(_tl[i].z, LM.ft[i].z, ampV)); _gl[i].lerp(_tmpG, wf);
      _fpG[i] = lerp(_fpG[i], LM.fp[i] * ampV, wf); _fyW[i] = lerp(S.fyG[i], LM.fy[i], ka);
    }
    if (OV) { _gl[i].lerp(_vA.copy(OV.ft[i]), kO); _fpG[i] = lerp(_fpG[i], OV.fp[i], kO); _fyW[i] = lerp(_fyW[i], OV.fy[i], kO); }
  }
  // à l'arrêt : pieds plantés au sol (ils ne glissent plus), un vrai pas quand l'un s'écarte trop de sa place
  // (selon la vitesse réelle : dès qu'il freine, les pieds se plantent, sans attendre que la foulée retombe)
  const pk = (1 - smoothstep(0.08, 0.35, clamp(v / 2.2, 0, 1))) * (1 - airW) * (1 - smoothstep(0.3, 0.6, c));
  const PLT = footPlant(e, S, pk, dt, cy, sy, S.hipYaw + pYaw, _gl, _tl, S.fyG);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1, hip = L[i === 0 ? J_HIL : J_HIR], knee = L[i === 0 ? J_KNL : J_KNR], foot = L[i === 0 ? J_FTL : J_FTR];
    hip.set(side * SD.hipX, SD.hipY, 0).applyQuaternion(_qY).add(L[J_PEL]);
    _tmpG.lerpVectors(_gl[i], PLT[i].l, pk);
    _ft[i].copy(_tmpG);
    S.fy[i] = lerp(_fyW[i], PLT[i].fy, pk);
    // le genou suit la pointe du pied, un peu en dehors (clips : leur direction du genou, repère du bassin)
    _pz.c.set(side * (0.06 + 0.2 * st), -0.1, -1).applyAxisAngle(UP, S.fy[i]);
    if (LM) _pz.c.lerp(LM.kn[i], ka);
    if (OV) _pz.c.lerp(OV.kn[i], kO);
    ik2(hip, _tmpG, SD.thigh, SD.shin, _pz.c.applyQuaternion(_qY).add(hip), knee, foot);
    S.fp[i] = damp(S.fp[i], lerp(_fpG[i], PLT[i].pitch, pk), 20 + 100 * Math.max(wf, kO), dt);
  }
  // hauteur du sol sous chaque pied (pour l'image suivante), lissée pour ne pas sauter d'une marche à l'autre
  if (e.onGround !== false) for (let i = 0; i < 2; i++) {
    const f = _ft[i], wx = e.pos.x + f.x * cy + f.z * sy, wz = e.pos.z - f.x * sy + f.z * cy;
    const gh = groundHeight(wx, wz, e.pos.y + 0.35, 0.06), g = VOID.on && gh <= VOID.floor + 1 ? 0 : clamp(gh - e.pos.y, -0.4, 0.35); // au bord du vide, le pied reste à plat
    if (i === 0) S.gyL = damp(S.gyL, g, 18, dt); else S.gyR = damp(S.gyR, g, 18, dt);
  }
  // passage en coordonnées monde
  for (let i = 0; i < 15; i++) { const l = L[i]; J[i].set(e.pos.x + l.x * cy + l.z * sy, e.pos.y + l.y, e.pos.z - l.x * sy + l.z * cy); }
  _eu.set(0, e.yaw, 0); _qW.setFromEuler(_eu);
  S.headQ = (S.headQ || new THREE.Quaternion()).copy(_qW).multiply(_qH).multiply(soldierRest().q[SB.HEA]);
  S.gun.position.set(e.pos.x + gunP.x * cy + gunP.z * sy, e.pos.y + gunP.y, e.pos.z - gunP.x * sy + gunP.z * cy);
  S.gun.quaternion.copy(_qW).multiply(_qG);
  e.recoil = damp(e.recoil || 0, 0, 18, dt);
}

function animSoldier(e, dt) {
  const S = e.model;
  if (e.alive) {
    S.sink = 0; S.rag = null; S.root.visible = true; e.voidDead = false; if (S.gun) S.gun.visible = true; // l'arme quitte le corps à la mort (dropKilledWeapon)
    poseSoldier(e, dt);
    layoutSoldier(S, true);
  } else if (e.respawnT === Infinity || S.cyc === undefined) {
    // bot hors jeu (retiré du match à mort : modeRoster ; inactif en ligne : netBotOff, startMatch) : aucun corps. La fin d'une killcam et
    // l'écran de fin animent tous les morts : il apparaissait debout dans sa dernière pose (au centre de la carte s'il n'avait pas joué),
    // et, sa mise à jour s'arrêtant là (updateBot), y restait jusqu'à la fin de la partie.
    // Jamais posé (S.cyc, voir poseSoldier) : un joueur ou un bot distant déjà mort quand on rejoint la partie. Son ragdoll partirait de la
    // pose de repos du modèle, au centre de la carte : pas de corps jusqu'à sa réapparition
    S.rag = null; S.root.visible = false;
  } else {
    if (!S.rag) startRagdoll(e);
    stepRagdoll(e, dt);
    S.sink = e.respawnT !== undefined && e.respawnT < 0.9 && MATCH.state === 'playing' ? (0.9 - e.respawnT) * 0.9 : 0;
    layoutSoldier(S, false);
    S.root.visible = !e.voidDead && !(e.respawnT !== undefined && e.respawnT < 0.1 && MATCH.state === 'playing'); // tombé dans le vide : pas de corps
  }
}

/* ---------- Hitboxes ---------- */
const HB = [{ y: 1.63, r: 0.15, part: 'head' }, { y: 1.34, r: 0.24, part: 'body' }, { y: 1.06, r: 0.23, part: 'body' }, { y: 0.72, r: 0.19, part: 'legs' }, { y: 0.34, r: 0.17, part: 'legs' }];
const HS = []; for (let i = 0; i < 11; i++) HS.push({ c: new V3(), r: 0, part: 'body' });
function hitSpheres(e) {
  if (!e.model || e.isPlayer) {
    const k = 1 - (e.crouchAmt || 0) * 0.33;
    for (let i = 0; i < HB.length; i++) { HS[i].c.set(e.pos.x, e.pos.y + HB[i].y * k, e.pos.z); HS[i].r = HB[i].r; HS[i].part = HB[i].part; }
    return HB.length;
  }
  const J = e.model.J; let n = 0;
  const s = (c, r, part) => { HS[n].c.copy(c); HS[n].r = r; HS[n].part = part; n++; };
  s(_tmpA.copy(J[J_HEAD]).add(_tmpB.set(0, 0.02, 0)), 0.155, 'head');
  s(_tmpA.lerpVectors(J[J_PEL], J[J_CHE], 0.72), 0.24, 'body');
  s(_tmpA.lerpVectors(J[J_PEL], J[J_CHE], 0.22), 0.22, 'body');
  s(_tmpA.lerpVectors(J[J_HIL], J[J_KNL], 0.5), 0.11, 'legs'); s(_tmpA.lerpVectors(J[J_KNL], J[J_FTL], 0.5), 0.1, 'legs');
  s(_tmpA.lerpVectors(J[J_HIR], J[J_KNR], 0.5), 0.11, 'legs'); s(_tmpA.lerpVectors(J[J_KNR], J[J_FTR], 0.5), 0.1, 'legs');
  s(_tmpA.lerpVectors(J[J_SHL], J[J_ELL], 0.5), 0.08, 'legs'); s(_tmpA.lerpVectors(J[J_SHR], J[J_ELR], 0.5), 0.08, 'legs');
  s(_tmpA.lerpVectors(J[J_ELL], J[J_HAL], 0.5), 0.07, 'legs'); s(_tmpA.lerpVectors(J[J_ELR], J[J_HAR], 0.5), 0.07, 'legs');
  return n;
}
function entEye(e, out) {
  if (e.isPlayer) return out.set(e.pos.x, e.pos.y + PL.eyeH, e.pos.z);
  if (e.model && e.alive) return out.copy(e.model.J[J_HEAD]).add(_tmpB.set(0, 0.03, 0));
  return out.set(e.pos.x, e.pos.y + lerp(1.62, 1.12, e.crouchAmt || 0), e.pos.z);
}
function entChest(e, out) {
  if (!e.isPlayer && e.model) return out.lerpVectors(e.model.J[J_PEL], e.model.J[J_CHE], 0.62);
  const k = 1 - (e.crouchAmt || 0) * 0.33; return out.set(e.pos.x, e.pos.y + 1.2 * k, e.pos.z);
}
function entHead(e, out) {
  if (!e.isPlayer && e.model) return out.copy(e.model.J[J_HEAD]);
  const k = 1 - (e.crouchAmt || 0) * 0.33; return out.set(e.pos.x, e.pos.y + 1.63 * k, e.pos.z);
}
function rayEntities(o, d, maxT, shooter) {
  let best = null, bt = maxT, bp = null;
  for (const e of entities) {
    if (!e.alive || e.inMecha || e === shooter || allied(e, shooter)) continue; // (un pilote est dans son mecha : c'est le blindage qu'on touche)
    const cx = e.pos.x - o.x, cy = e.pos.y + 0.9 - o.y, cz = e.pos.z - o.z;
    const tc = cx * d.x + cy * d.y + cz * d.z; if (tc < -1.5 || tc > bt + 1.5) continue;
    if (cx * cx + cy * cy + cz * cz - tc * tc > 1.6) continue;
    const n = hitSpheres(e);
    for (let i = 0; i < n; i++) {
      const h = HS[i];
      const hx = h.c.x - o.x, hy = h.c.y - o.y, hz = h.c.z - o.z;
      const t = hx * d.x + hy * d.y + hz * d.z; if (t < 0) continue;
      const d2 = hx * hx + hy * hy + hz * hz - t * t;
      if (d2 > h.r * h.r) continue;
      const th = t - Math.sqrt(h.r * h.r - d2);
      if (th < bt) { bt = th; best = e; bp = h.part; }
    }
  }
  return best ? { ent: best, t: bt, part: bp } : null;
}
