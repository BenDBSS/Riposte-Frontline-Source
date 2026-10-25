/* ==========================================================================
   JOUEUR
   ========================================================================== */
const PL = {
  ent: { id: 0, name: _t('Vous'), team: 0, isPlayer: true, pos: new V3(), vel: new V3(), vy: 0, yaw: 0, pitch: 0, alive: false, health: 100, crouch: false, crouchAmt: 0,
    kills: 0, deaths: 0, score: 0, assists: 0, streak: 0, lastShotT: -9, dmgBy: new Map() },
  actT: -1e9, // dernier acte du joueur dans la partie (tir, grenade, série) : voir hitFeedback
  classIdx: 0, nades: 2, held: false, queued: false, noFireT: 0,
  knifeT: 0, knifeNew: false, knifeHit: false, nadeState: null, nadeT: 0, cookT: 0, knifeHold: 0, knifeBtn: null, // knifeHold : part du couteau sorti (0 à 1, pour la main) ; knifeBtn : appui en cours sur le bouton couteau (knifeButton)
  lastDmgT: -9, shake: 0, suppress: 0, punchP: 0, vpP: 0, punchY: 0, vpY: 0, rollP: 0, vrollP: 0, lunge: 0, vlunge: 0,
  shots: 0, hits: 0, bestStreak: 0, ks: {}, ksSel: KS_DEFAULT.slice(), breath: 1, holding: false, deathT: 0, killer: null,
  bobT: 0, bobA: 0, stepPh: 0, wasAir: false, runShot: false, dmgInd: [], lastRegenSnd: 0, heartT: 0, crouchToggle: false, adsWant: false,
  stepOff: 0, stepV: 0, lastY: 0, lastOn: false, // vue qui glisse sur une marche (applyCamera)
  wasSprint: false, fovK: 0, // départ du sprint ; à-coup du champ de vision (degrés)
};
entities.push(PL.ent);
initCtl(PL.ent, ['m4', 'm9']);
/* Les anciens champs du joueur pointent vers le contrôleur commun (même code que les bots). Ils ne sont pas dans l'objet littéral : les
   y mettre puis les retirer (delete) faisait passer PL en dictionnaire (lectures lentes, nombres écrits alloués) pour toute la session. */
for (const [k, obj, key] of [['weapons', 'arms', 'slots'], ['cur', 'arms', 'cur'], ['fireCd', 'arms', 'fireCd'], ['reload', 'arms', 'reload'], ['switching', 'arms', 'switching'], ['switchTo', 'arms', 'switchTo'], ['bloom', 'arms', 'bloom'], ['boltT', 'arms', 'boltT'], ['onGround', null, 'onGround'], ['eyeH', null, 'eyeH'], ['airVy', null, 'airVy'], ['sprinting', null, 'sprinting'], ['knifeOut', 'arms', 'knife']]) {
  Object.defineProperty(PL, k, { get: () => (obj ? PL.ent[obj][key] : PL.ent[key]), set: (v) => { if (obj) PL.ent[obj][key] = v; else PL.ent[key] = v; }, configurable: true });
}
const KEYS = {};
let mouseDX = 0, mouseDY = 0;

function giveLoadout() {
  classFix(); // la classe choisie existe toujours (06r-arsenal.js)
  const C = CLASSES[PL.classIdx = Settings.loadout];
  PL.ent.arms = makeArms(classWeapons(PL.classIdx));
  PL.ksSel = ESSAI ? essaiKs() : classKs(PL.classIdx); updateStreakHud(); // séries de la classe ; celles déjà prêtes d'une autre classe attendent qu'on la reprenne
  PL.nades = C.nades; PL.nadeType = NADE_TYPES[C.nade] ? C.nade : 'frag'; PL.flashT = 0; PL.knifeT = 0; PL.nadeState = null; PL.knifeOut = false; PL.knifeHold = 0; PL.knifeBtn = null;
  vmSetLook(skinOf(PL.ent), 0); vmEquip(PL.weapons[0].def); VM.action = null;
  if (MATCH.state === 'paused') { PL.pendingDraw = true; VM.lower = 1; VM.lowerTarget = 1; return; } // changement de classe dans la pause : l'arme sort à la reprise (resumeGame)
  PL.pendingDraw = false; VM.lower = 1; VM.lowerTarget = 0; VM.lowerRate = 16; sfxMech('draw');
}
function curW() { return armsW(PL.ent); }

/* ---------- Entrées ---------- */
function onKey(e, down) {
  if (CHAT.open) return; // saisie d'un message : les touches ne commandent plus le soldat
  if (down && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') && (MATCH.state === 'killcam' || (MATCH.state === 'playing' && !PL.ent.alive))) { e.preventDefault(); kcSkip(); return; }
  if (MATCH.state !== 'playing' && MATCH.state !== 'paused') return;
  const c = keyCanon(e.code); // touche liée à une action : on reçoit la touche par défaut de cette action (08a-binds.js)
  if (!c) return;
  if (c === 'Tab') { e.preventDefault(); showScoreboard(down); return; }
  if (MATCH.state !== 'playing' || !pointerActive()) return;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(c)) e.preventDefault();
  if (KS.map.open && down) { ksMapKey(c); if (c !== 'Escape') { e.preventDefault(); return; } }
  const was = KEYS[c]; KEYS[c] = down;
  if (!down || was) { if (!down && c === 'KeyG') releaseNade(); if (!down && c === 'KeyF') knifeButton(false); return; }
  if (PILOT.d) return; // drone en vol : les touches ne servent qu'à le piloter (KEYS, lu par fpvPlayer)
  if (MECHA_P.me) { if (c === 'KeyE') mechaUse(); return; } // à bord du mecha : les touches le pilotent (mechaPilot), E fait descendre
  if (adsToggleMode() && ADS_UNAIM.has(c)) PL.adsWant = false; // visée en bascule : recharger, changer d'arme, courir la rangent
  if (c === 'KeyR') startReload();
  else if (c === 'Digit1') switchWeapon(0);
  else if (c === 'Digit2') switchWeapon(1);
  else if (c === 'KeyQ' && e.getModifierState && !e.getModifierState('Control')) quickSwap();
  else if (c === 'KeyF') knifeButton(true, true);
  else if (c === 'KeyG') cookNade();
  else if (c === 'KeyE') { if (!mechaUse()) swapWithDrop(); } // à portée de son mecha : on monte à bord
  else if (c === 'KeyC') { if (!trySlide()) PL.crouchToggle = !PL.crouchToggle; }
  else if (c === 'ControlLeft') trySlide();
  else if (c === 'Digit4') useKs(0);
  else if (c === 'Digit5') useKs(1);
  else if (c === 'Digit6') useKs(2);
  else if (c === 'KeyI') inspectWeapon();
}
/* Vitesse du regard en visée par rapport à la hanche : mul = 1 ne change rien, 0,6 donne 60 % de la vitesse sans zoom. Le facteur suit la visée (VM.ads, 0 à 1) pour
   que le passage de l'une à l'autre soit progressif. S'ajoute à la réduction due au champ de vision (0,35 + 0,65 x zoom), commune à la souris et à la manette. */
function adsLookMul(mul) { return lerp(1, clamp(+mul || 1, 0.1, 2), smoothstep(0, 1, VM.ads)); }
/* Accroupi pendant un sprint : glissade (la décision finale est prise par ctlMove, qui vérifie l'élan, le sol et l'attente) */
function trySlide() {
  const e = PL.ent;
  // en sprint, ou déjà en glissade / juste après avec Maj tenu (enchaînement) : la demande est retenue par ctlMove
  if (!(PL.sprinting || e.slideT > 0 || (e.slideCd > 0 && (KEYS.ShiftLeft || TOUCH.sprint || PAD.sprint)))) return false;
  e.input.slide = true; return true;
}
addEventListener('keydown', (e) => onKey(e, true));
addEventListener('keyup', (e) => onKey(e, false));
addEventListener('mousemove', (e) => {
  if (MATCH.state !== 'playing' || !pointerActive() || CHAT.open || (TOUCH.on && performance.now() - TOUCH.lastT < 800)) return; // la souris que le navigateur simule après un toucher ne compte pas
  mouseDX += e.movementX || 0; mouseDY += e.movementY || 0;
});
addEventListener('mousedown', (e) => {
  if (TOUCH.on && performance.now() - TOUCH.lastT < 800) return;
  if (e.button === 0 && (MATCH.state === 'killcam' || (MATCH.state === 'playing' && !PL.ent.alive && pointerActive()))) { kcSkip(); return; }
  if (MATCH.state !== 'playing' || !pointerActive() || CHAT.open) return;
  if (performance.now() < PL.noFireT) return; // second clic d'un double clic sur Déployer ou Reprendre : pas un tir
  if (KS.map.open) { if (e.button === 0) ksConfirm(); else if (e.button === 2) ksCancel(); return; }
  if (e.button === 0) { if (trackpadOn()) trackpadClick(e); else { PL.held = true; PL.queued = true; } } // pavé tactile : tir automatique, double clic pour viser (09qe-pavetactile.js)
  if (e.button === 2) { if (adsToggleMode()) adsToggleClick(); else PL.adsWant = true; }
});
addEventListener('mouseup', (e) => { if (TOUCH.on && performance.now() - TOUCH.lastT < 800) return; if (e.button === 0) { PL.held = false; TPAD.down = false; } if (e.button === 2 && !adsToggleMode()) PL.adsWant = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (MATCH.state !== 'playing' || !pointerActive()) return;
  if (KS.map.open || trackpadOn()) return; // au pavé tactile, le défilement à deux doigts ne change pas d'arme
  quickSwap();
}, { passive: true });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; PL.held = false; TPAD.down = false; PL.adsWant = false; PL.knifeBtn = null; });

/* ---------- Actions ---------- */
function busy() { return PL.switching > 0 || PL.knifeT > 0 || PL.nadeState || !PL.ent.alive || !!KS.mode || !!PILOT.d || !!MECHA_P.me; }
function startReload() { PL.ent.busy = busy(); ctlStartReload(PL.ent); }
function switchWeapon(i) {
  if (PL.knifeT > 0 || PL.nadeState || !PL.ent.alive || KS.mode) return;
  if (PL.knifeOut) { knifeStow(i); return; }
  PL.ent.busy = false; ctlSwitch(PL.ent, i);
}
/* Changer d'arme (Q, molette, bouton) : l'autre arme, ou, couteau en main, celle qu'on tenait avant */
function quickSwap() { switchWeapon(PL.knifeOut ? PL.cur : 1 - PL.cur); }
function knife() {
  if (PL.knifeT > 0 || PL.nadeState || !PL.ent.alive || KS.mode || playHold()) return;
  kcEvent('knife', { sid: PL.ent.kcI, neu: PL.knifeOut }); // la killcam rejoue le coup
  PL.actT = MATCH.time; // le joueur agit : sa touche a sa croix (hitFeedback), comme une balle
  PL.knifeT = KNIFE_DUR; PL.knifeNew = PL.knifeOut; PL.knifeHit = false; PL.knifePull = 0; PL.knifeKick = false; VM.lowerTarget = 1; PL.reload = null; VM.action = null;
  setTimeout(() => { if (PL.knifeT > 0) sfxMech('knife'); }, KNIFE_DUR * 200); // le sifflement de la lame accompagne le balayage, pas l'armement
  PL.knifeTarget = knifePick();
}
/* Cible d'une fente de couteau : un ennemi proche devant soi */
function knifePick() {
  const f = camFwd(new V3());
  let best = null, bd = 4.2;
  for (const e of entities) {
    if (!e.alive || allied(e, PL.ent)) continue;
    const d = e.pos.distanceTo(PL.ent.pos); if (d > bd) continue;
    const to = entChest(e, new V3()).sub(camera.position).normalize();
    if (to.dot(f) < (d < KNIFE_MAG.near ? KNIFE_MAG.cone : 0.82)) continue; // de très près, le cône est un peu plus large
    if (!lineClear(camera.position, entChest(e, new V3()))) continue;
    best = e; bd = d;
  }
  return best;
}
/* Couteau en main, comme dans Counter-Strike : on court plus vite (KNIFE_MOVE), le clic donne un coup, l'arme ne tire plus ni ne se vise. Maintenir le bouton
   couteau (F, bouton à l'écran, R3) le sort ; une touche d'arme (1, 2, Q, molette, Changer d'arme) le range. Un appui bref reste un coup de couteau. Il part au
   relâchement, pour qu'on sache s'il fallait sortir le couteau, sauf si un ennemi est à portée ou si le couteau est déjà en main : là le coup part tout de suite,
   en plein corps à corps l'attente ne vaut pas la peine. */
const KNIFE_HOLD = 0.3;
function knifeButton(down, key) {
  if (down) {
    if (PL.knifeBtn) return;
    const hit = PL.knifeOut || !!knifePick();
    if (hit) knife();
    PL.knifeBtn = { t: 0, hit, eq: false, key: !!key }; // eq : le couteau a été sorti par cet appui ; key : appui au clavier (KEYS.KeyF dit s'il dure)
  } else {
    const b = PL.knifeBtn; PL.knifeBtn = null;
    if (b && !b.hit && !b.eq) knife();
  }
}
function knifeButtonTick(dt) {
  const b = PL.knifeBtn; if (!b) return;
  if (MATCH.state !== 'playing' || (b.key && !KEYS.KeyF)) { PL.knifeBtn = null; return; } // pause, ou touche lâchée sans que le jeu l'ait su (fenêtre quittée) : le relâchement ne viendra pas
  if (PL.knifeOut || b.eq) return;
  if ((b.t += dt) >= KNIFE_HOLD && knifeDraw()) b.eq = true; // (un geste en cours, grenade ou changement d'arme, retarde la sortie jusqu'à ce qu'il finisse)
}
function knifeDraw() {
  const A = PL.ent.arms;
  if (PL.knifeOut || PL.nadeState || !PL.ent.alive || KS.mode || playHold() || A.switching > 0) return false;
  PL.knifeOut = true; PL.knifeHold = PL.knifeT > 0 && PL.knifeNew ? 1 : 0; // en plein coup du couteau en main, le bras est déjà là ; après le coup d'origine, il remonte
  A.reload = null; A.boltT = 0; VM.action = null; VM.lowerTarget = 1;
  sfxMech('draw');
  return true;
}
/* Ranger le couteau et sortir l'arme i (celle qu'on tenait avant, ou l'autre) : même animation qu'un changement d'arme, l'arme baisse déjà */
function knifeStow(i) {
  PL.knifeOut = false; PL.ent.busy = false;
  ctlSwitch(PL.ent, i, true);
}
/* Inspection de l'arme : seulement au repos (ni rechargement, ni visée, ni sprint) ; tout geste de combat l'interrompt */
function inspectWeapon() {
  if (busy() || PL.knifeOut || PL.reload || PL.ads || PL.sprinting || VM.action || PL.boltT > 0) return;
  vmStartAction('inspect', curW().def.fam === 'pistol' ? INSPECT_PISTOL.dur : INSPECT_LONG.dur);
}
/* Grenade, comme dans CoD : appui = dégoupillage (toujours joué en entier), maintien = cuisson
   (la mèche court dès que la cuillère saute), relâchement = lancer par-dessus l'épaule.
   Un appui bref lance dès la goupille retirée, mèche pleine. Temps en secondes. */
const NADE_ANIM = { pin: 0.24, pull: 0.42, release: 0.12, raise: 0.19, throw: 0.38 };
function cookNade() {
  if (PL.nades <= 0 || PL.nadeState || PL.knifeT > 0 || PL.switching > 0 || !PL.ent.alive || KS.mode || playHold()) return;
  PL.nadeState = 'pull'; PL.nadeT = 0; PL.cookT = 0; PL.nadeQueued = false; PL.nadePin = false; PL.nadeFuse = false; PL.nadeThrown = false;
  if (PL.nadeType === 'knife') { PL.nadeT = NADE_ANIM.pin + 0.01; PL.nadePin = true; } // couteau de lancer : pas de goupille, il est en main tout de suite
  // l'arme plonge hors champ pendant que la grenade monte (un peu moins vite qu'un changement d'arme)
  VM.lowerTarget = 1; VM.lowerRate = 8; PL.reload = null; VM.action = null;
  sfxMech('ads');
}
function releaseNade() {
  if (PL.nadeState === 'pull') PL.nadeQueued = true;
  else if (PL.nadeState === 'cook') startThrow();
}
function startThrow() {
  PL.nades--; PL.nadeState = 'throw'; PL.nadeT = 0; PL.nadeThrown = false;
  // élan : le buste pivote vers la droite et se cambre, la vue suit
  PL.vpP += 0.55; PL.vpY -= 0.45; PL.vrollP -= 0.55; PL.vlunge -= 0.35;
  sfxMech('windup');
}
/* Départ d'un lancer du joueur (p, v) : de la main, en haut à droite de l'écran, sans traverser un mur tout proche ; la vitesse suit le regard et
   ne garde que l'élan vers l'avant (NADE.carry : jusqu'à la 5.0, tout l'élan, et un pas de côté la faisait dériver) */
function nadeLaunch(p, v) {
  // (direction : le regard visé, pas la caméra, que l'élan du lancer fait basculer avant que la grenade parte)
  const e = PL.ent, cp = Math.cos(PL.pitch), f = _nlF.set(-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp), right = _nlR.crossVectors(f, UP).normalize();
  const want = _nlW.copy(camera.position).addScaledVector(f, 0.5).addScaledVector(right, 0.08); want.y += 0.08;
  const to = _nlT.copy(want).sub(camera.position), len = to.length(); to.divideScalar(len);
  const h = rayWorld(camera.position.x, camera.position.y, camera.position.z, to.x, to.y, to.z, len + 0.1);
  if (h) p.copy(camera.position).addScaledVector(to, Math.max(0.05, h.t - 0.12)); else p.copy(want);
  const fl = hyp(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl, ahead = Math.max(0, e.vel.x * fx + e.vel.z * fz) * NADE.carry;
  v.copy(f).multiplyScalar(NADE.speed); v.x += fx * ahead; v.z += fz * ahead; v.y += NADE.up + Math.max(0, e.vy) * 0.5;
}
const _nlF = new V3(), _nlR = new V3(), _nlW = new V3(), _nlT = new V3();
function throwNadeNow() {
  const e = PL.ent, p = new V3(), v = new V3(); nadeLaunch(p, v);
  if (PL.nadeType === 'knife') { throwKnifeNow(p); return; }
  const fuse = Math.max(0.1, nadeFuse(PL.nadeType) - PL.cookT);
  spawnNade(e, p, v, fuse, PL.nadeType); PL.actT = MATCH.time;
  if (MATCH.online) netEvent({ k: 'nade', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu: +fuse.toFixed(2), ty: PL.nadeType });
  if (!PL.nadeFuse) { PL.nadeFuse = true; sfxMech('spoon'); vmSpoon(); } // lancer direct : la cuillère saute à la sortie de la main
  sfxMech('throw');
  // détente : le buste bascule vers l'avant et la gauche, la vue plonge, s'incline et s'élargit un instant
  PL.vpP -= 1.5; PL.vpY += 0.75; PL.vrollP += 1.25; PL.vlunge += 1.4; PL.fovK = (PL.fovK || 0) + 5; VM.swayTX -= 0.05;
}
/* Couteau de lancer : de la main vers ce qui est au centre de la vue (le décor ou un soldat, 80 m au plus), à THROW_KNIFE.speed m/s (07-bots.js), en visant
   un peu au-dessus pour que la pesanteur le ramène sur le point visé */
function throwKnifeNow(p) {
  const e = PL.ent, c = camera.position, cp = Math.cos(PL.pitch), f = _nlF.set(-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp);
  const h = rayWorld(c.x, c.y, c.z, f.x, f.y, f.z, 80, 1), eh = rayEntities(c, f, h ? h.t : 80, e);
  const aim = c.clone().addScaledVector(f, eh ? eh.t : h ? h.t : 80), to = aim.sub(p), T = to.length() / THROW_KNIFE.speed, v = to.normalize().multiplyScalar(THROW_KNIFE.speed);
  v.y += 0.5 * THROW_KNIFE.g * T; // la pesanteur compensée : il arrive là où l'on vise, en légère cloche au loin
  spawnThrowKnife(e, p, v); PL.actT = MATCH.time;
  if (MATCH.online) netEvent({ k: 'nade', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu: 0, ty: 'knife' });
  sfxMech('throw');
  PL.vpP -= 1.2; PL.vpY += 0.6; PL.vrollP += 1; PL.vlunge += 1.1; VM.swayTX -= 0.04;
}
/* Trajectoire prévue en tenant une grenade (Settings.nadeArc ; référence : Apex, Battlefield) : des points le long de la course, jusqu'au
   premier choc (sol, décor), un tous les NADE_ARC.gap m, et un cercle là où elle touche. Même lancer et même pesanteur que le vrai (nadeLaunch, NADE) ; les rebonds ne
   sont pas prévus. Objets posés une fois (nadeWarm, 07-bots.js : compilés au chargement), cachés hors de la prise en main */
const NADE_ARC = { n: 60, dt: 1 / 30, gap: 0.7, pts: null, ring: null, p: new V3(), v: new V3(), q: new V3() };
function nadeArcUpdate() {
  const A = NADE_ARC, on = Settings.nadeArc !== false && (PL.nadeState === 'pull' || PL.nadeState === 'cook') && PL.ent.alive && !KS.mode && PL.nadeType !== 'knife'; // (le couteau part tout droit : on vise au réticule)
  if (!A.pts) return;
  A.pts.visible = A.ring.visible = on; if (!on) return;
  const p = A.p, v = A.v, q = A.q, pos = A.pts.geometry.attributes.position, R = NADE.r;
  A.pts.material.size = 4 * (RS.h > 1 ? RS.h : VIEW.h * renderPixelRatio()) / Math.max(1, VIEW.h); // 5 px de l'écran, quelle que soit la résolution de l'image (pointScale)
  nadeLaunch(p, v);
  let k = 0, hit = null, run = A.gap * 0.6;
  for (let i = 0; i < A.n * 2 && !hit; i++) { // 2 s de vol au plus, par demi-pas
    q.copy(p); v.y -= NADE.g * A.dt / 2; p.addScaledVector(v, A.dt / 2); run += p.distanceTo(q);
    const g = groundHeight(p.x, p.z, q.y, 0.05, true);
    if (p.y < g + R) { p.y = g + R; hit = 'y'; break; }
    for (const c of queryBoxes(p.x - 0.1, p.z - 0.1, p.x + 0.1, p.z + 0.1)) {
      if (c.inv || c.ray || (c.noRay && c.m === 'glass')) continue;
      if (p.x < c.x0 - R || p.x > c.x1 + R || p.z < c.z0 - R || p.z > c.z1 + R || p.y < c.y0 - R || p.y > c.y1 + R) continue;
      if (q.y >= c.y1 + R - 0.02) { p.y = c.y1 + R; hit = 'y'; } else if (q.x < c.x0 - R || q.x > c.x1 + R) hit = 'x'; else if (q.z < c.z0 - R || q.z > c.z1 + R) hit = 'z'; else hit = 'y';
      if (hit !== 'y') p.copy(q);
      break;
    }
    if (!hit && run >= A.gap && k < A.n) { pos.setXYZ(k++, p.x, p.y, p.z); run = 0; }
  }
  for (let i = k; i < A.n; i++) pos.setXYZ(i, p.x, p.y, p.z); // les points en trop sur le point d'arrivée
  pos.needsUpdate = true; A.pts.geometry.setDrawRange(0, Math.max(1, k));
  // cercle d'arrivée : à plat sur un sol, debout contre un mur
  A.ring.position.copy(p); A.ring.visible = !!hit;
  if (hit === 'y') A.ring.rotation.set(-Math.PI / 2, 0, 0); else A.ring.rotation.set(0, hit === 'x' ? Math.PI / 2 : 0, 0);
}
/* Mort avec une grenade cuisinée en main : elle tombe aux pieds, mèche en cours (comme dans CoD) */
function dropCookedNade() {
  if (!PL.nadeState || !PL.nadeFuse || PL.nadeThrown) return;
  const e = PL.ent, p = e.pos.clone().add(new V3(0, 1.1, 0)), v = new V3(e.vel.x * 0.5, 0.5, e.vel.z * 0.5);
  const fuse = Math.max(0.1, nadeFuse(PL.nadeType) - PL.cookT);
  spawnNade(e, p, v, fuse, PL.nadeType);
  if (MATCH.online) netEvent({ k: 'nade', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu: +fuse.toFixed(2), ty: PL.nadeType });
}
function camFwd(out) { return camera.getWorldDirection(out); }

/* ---------- Tir ---------- */
function playerShotFx(d, ads, f, muzzle, kv, kh, hitAny) {
  PL.shots++; NET.shots++; if (hitAny) PL.hits++;
  PL.yaw = PL.ent.yaw; PL.pitch = PL.ent.pitch;
  const F = d.feel;
  PL.vpP += kv * 30 * (1 + F.shake) * F.punch; PL.vpY += kh * 20 + (Math.random() - 0.5) * F.shake * 0.6; PL.vrollP += (Math.random() - 0.5) * F.roll * 0.35;
  PL.shake = Math.max(PL.shake, F.shake); PL.fovK = (PL.fovK || 0) + F.fov;
  if (F.shake > 0.3) { FinalShader.uniforms.uFlash.value = Math.max(FinalShader.uniforms.uFlash.value, 0.05 * F.shake); PL.aberr = 2.2 * F.shake; }
  const mw = camera.position.clone().addScaledVector(f, 0.9);
  for (let i = 0; i < Math.ceil(F.smoke * 5); i++) FX.smoke.spawn(mw.x, mw.y - 0.05, mw.z, f.x * rand(0.5, 2) + rand(-0.3, 0.3), rand(0.1, 0.5), f.z * rand(0.5, 2) + rand(-0.3, 0.3), rand(0.6, 1.4), 0.12, rand(0.5, 1.1) * (0.5 + F.smoke), 0.62, 0.6, 0.57, 0.14 * F.smoke + 0.05, 0, 0, 1.4, rand(-1, 1));
  if (d.bolt) { for (let s2 = 2; s2 < 90; s2 += 1.6) { const p = camera.position.clone().addScaledVector(f, s2); FX.smoke.spawn(p.x, p.y, p.z, rand(-0.05, 0.05), rand(0, 0.06), rand(-0.05, 0.05), rand(1.2, 2.2), 0.08, 0.35, 0.75, 0.74, 0.72, 0.1, 0, 0, 0.3); } }
  // gerbe d'étincelles à la bouche et sursaut du réticule : le tir se voit avant de s'entendre
  for (let i = 0; i < F.spark; i++) FX.add.spawn(mw.x, mw.y - 0.06, mw.z, f.x * rand(3, 11) + rand(-2.5, 2.5), f.y * rand(3, 11) + rand(-1.5, 3), f.z * rand(3, 11) + rand(-2.5, 2.5), rand(0.06, 0.16), 0.007, 0.002, 4, 2.4, 1.0, 1, 0, 2, 2);
  HUD.kick = Math.min(16, HUD.kick + 2 + d.recoil.kick * 80);
  vmKick(d, ads > 0.5);
  padRumble(0.18 + d.recoil.kick * 40, 0.5, 45);
  if (!d.bolt && !d.pump) vmShell(d);
  sfxGun(d.sound, null);
  if (!d.silent) flashLight(muzzle, 3, 8, 0.05);
}

/* ---------- Mise à jour ---------- */
function updatePlayer(dt, now) {
  const e = PL.ent;
  if (!e.alive) { updateDeadPlayer(dt); return; }
  const w = curW(), d = w.def;
  // regard
  if (KS.map.open) { ksMapMouse(mouseDX, mouseDY); mouseDX = 0; mouseDY = 0; }
  const zoom = camera.fov / Settings.fov;
  const s = 0.0021 * (trackpadOn() ? Settings.tpSens : Settings.sens) * (0.35 + 0.65 * zoom) * adsLookMul(Settings.adsMul); // au pavé tactile, sa propre sensibilité (09qe-pavetactile.js)
  const ak = PILOT.d ? 1 : aimAssist(dt); // (à bord du mecha aussi : au doigt, son tir automatique tient la détente, mechaPilot) // assistance à la visée au doigt et à la manette : ralentissement, accroche, suivi, tir automatique (09qd-visee.js)
  const pitch0 = PL.pitch;
  PL.yaw -= mouseDX * s * ak; PL.pitch -= mouseDY * s * ak * (Settings.invertY ? -1 : 1);
  VM.swayTX += mouseDX * 0.0006; VM.swayTY += mouseDY * 0.0006;
  mouseDX = 0; mouseDY = 0;
  if (PAD.drive) padLook(dt); // manette (09qc-manette.js)
  recoilTick(dt, now, PL.pitch - pitch0); // retour de la visée après un tir ; ce que le joueur vient de reprendre à la main compte (07ca-recul.js)
  PL.pitch = clamp(PL.pitch, -1.5, 1.5);
  if (MECHA_P.me) { mechaPilot(dt, now); return; } // à bord du mecha (08g-mecha-pilote.js)
  if (PILOT.d) { fpvPlayer(dt, now); return; } // drone kamikaze : le regard et les déplacements le pilotent, le corps reste sur place (08e-fpv.js)

  // entrées clavier et souris vers le contrôleur commun ; seule la carte plein écran de la frappe
  // aérienne immobilise le joueur (drone, tablette qu'on sort ou range : on continue d'avancer), et le décompte du départ
  // (09y-decompte.js : on regarde autour de soi, on recharge, on change d'arme, mais ni pas, ni saut, ni visée, ni tir)
  const hold = playHold(), I = e.input, lockMove = KS.map.open || hold;
  // au doigt : joystick analogique et sprint à fond vers l'avant (09q-tactile.js) ; Maj sert alors à retenir son souffle (bouton)
  const fw = lockMove ? 0 : padClamp((TOUCH.on ? TOUCH.mz : (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0)) + PAD.mz);
  const st = lockMove ? 0 : padClamp((TOUCH.on ? TOUCH.mx : (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0)) + PAD.mx);
  const run = (TOUCH.on ? TOUCH.sprint : !!KEYS.ShiftLeft) || PAD.sprint;
  if (run && fw > 0 && PL.crouchToggle) PL.crouchToggle = false;
  if (KEYS.Space && e.crouch && PL.onGround) PL.crouchToggle = false;
  // tirer pendant une course l'interrompt, quelle que soit l'entrée (le contrôleur ne tire pas en sprint, ctlWeapon) : tant que la
  // gâchette est tenue, et pour un coup demandé en courant tant qu'il n'est pas parti (runShot : la sortie de course dure un instant,
  // un appui bref doit quand même tirer, arme automatique comprise). La course reprend ensuite si on la demande encore (Maj tenue,
  // joystick poussé à fond) ; à la manette, le sprint lancé par L3 est annulé (padPlay), comme dans les Call of Duty
  const canShoot = !hold && !busy() && !PL.knifeOut && !PL.reload && PL.switching <= 0 && curW().mag > 0;
  if (PL.queued && (PL.sprinting || e.arms.sprintW > 0.3)) PL.runShot = true;
  if (!canShoot) PL.runShot = false;
  I.mz = fw; I.mx = st; I.sprint = run && !lockMove && !(canShoot && (PL.held || PL.runShot)); I.crouch = PL.crouchToggle || !!KEYS.ControlLeft; I.jump = !!KEYS.Space && !lockMove;
  I.ads = PL.adsWant && !hold; I.fire = (PL.held || PL.runShot) && !hold; I.firePressed = PL.queued && !hold;
  if (hold) PL.queued = false; // un tir demandé pendant le décompte ne part pas au départ (une gâchette tenue, si)
  e.busy = busy(); e.blockSprint = !!PL.nadeState; e.sprintBusyOk = KS_PHONE.has(KS.mode);
  e.yaw = PL.yaw; e.pitch = PL.pitch;
  const mv = ctlMove(e, dt);
  if (voidCheck(e) || ringCheck(e, dt)) return; // tombé dans le vide (îles flottantes), ou resté trop longtemps hors de la zone ronde
  // fin d'une glissade au sol (hors saut) : le joueur reste accroupi ; Maj en avançant, saut ou C le relèvent
  if (PL.wasSliding && !(e.slideT > 0) && !mv.jumped && e.onGround && e.alive) PL.crouchToggle = true;
  PL.wasSliding = e.slideT > 0;
  // (5.1, plus franc : glissade, saut, réception et départ du sprint marqués davantage)
  if (mv.slid) { sfxSlide(); e.dustT = 0; VM.vland += 0.65; PL.fovK = 6.5; PL.vpP += 0.7; PL.vrollP += 0.35; }
  if (mv.jumped) { VM.vland -= 0.75; sfxJump(surfaceAt(e.pos)); }
  if (e.slideT > 0) slideDust(e, dt);
  if (mv.landed) { const lk = clamp(-mv.landed * 0.08, 0.3, 1.3); VM.vland += lk * 1.5; sfxLand(surfaceAt(e.pos), lk); PL.punchP -= 0.016 + 0.026 * lk; PL.vrollP += (Math.random() < 0.5 ? -1 : 1) * 0.32 * lk; }
  const ads = !!e.adsActive; if (ads !== !!PL.ads && e.alive) sfxMech('ads'); PL.ads = ads; // épaulé et relâché : froissement de tissu, cliquetis
  if (VM.action === 'inspect' && (PL.held || PL.adsWant || PL.sprinting || PL.reload || !PL.onGround)) VM.actFade = true;
  const hs = hyp(e.vel.x, e.vel.z);
  // balancement calé sur les foulées réelles (un demi-cycle par pas, 2,1 m en marche, 2,7 m en sprint) ;
  // le bruit de pas tombe au point bas du balancement, quand le pied se pose
  PL.bobA = damp(PL.bobA, PL.onGround && !e.slideT ? clamp(hs / 5, 0, 1.5) : 0, 8, dt);
  PL.bobT += dt * Math.PI * hs / (PL.sprinting ? 2.7 : 2.1);
  const stepPh = Math.floor((PL.bobT * 2 + Math.PI / 2) / TAU);
  if (stepPh !== PL.stepPh) {
    PL.stepPh = stepPh;
    if (PL.onGround && hs > 0.8 && !e.slideT && !(e.crouch && !PL.sprinting)) {
      const sf = surfaceAt(e.pos); sfxStep(null, PL.sprinting ? 0.3 : 0.18, sf); if (sf === 'water') stepSplashFx(e.pos, hs, e.vel);
      // chaque pied posé se sent : l'arme s'enfonce d'un rien, la tête pique en sprint (petit coup amorti, pas un tremblement)
      const sk = (1 - VM.ads) * clamp(hs / 6.5, 0, 1); VM.vland += (PL.sprinting ? 0.16 : 0.06) * sk; if (PL.sprinting) { PL.vpP -= 0.16 * sk; PL.vrollP += (stepPh & 1 ? 0.1 : -0.1) * sk; }
    }
  }
  // départ en sprint : la vue s'élargit d'un coup et la tête plonge vers l'avant
  if (PL.sprinting && !PL.wasSprint && PL.onGround) { PL.fovK = (PL.fovK || 0) + 3; PL.vpP -= 0.45; }
  PL.wasSprint = PL.sprinting;

  if (PL.knifeT > 0) {
    PL.knifeT -= dt;
    const T = PL.knifeTarget;
    if (T && T.alive && PL.knifeT > KNIFE_DUR * (1 - KNIFE_HIT) - 0.01) { const to = new V3().subVectors(T.pos, e.pos); to.y = 0; const dd = to.length(); if (dd > 1.1) { to.normalize(); if (!VOID.on || groundHeight(e.pos.x + to.x * 0.8, e.pos.z + to.z * 0.8, e.pos.y, 0.3) > e.pos.y - 0.6) { e.vel.x = to.x * 14; e.vel.z = to.z * 14; } } } // pas d'élan vers le vide
    // début du balayage : léger élan de la vue (champ de vision, tangage)
    if (!PL.knifeKick && PL.knifeT < KNIFE_DUR * 0.8) { PL.knifeKick = true; PL.fovK = (PL.fovK || 0) + 4; PL.vpP -= 0.7; }
    // magnétisme : tant que le coup n'est pas porté, la visée est tirée vers le torse d'une cible très proche (au plus
    // KNIFE_MAG.max radians en tout, la souris garde la main : le geste reste à vous)
    if (T && T.alive && !PL.knifeHit && PL.knifePull < KNIFE_MAG.max) {
      const c = entChest(T, new V3()), dx = c.x - camera.position.x, dz = c.z - camera.position.z, dy = c.y - camera.position.y, hd = hyp(dx, dz);
      const w = 1 - smoothstep(KNIFE_MAG.near, KNIFE_MAG.range, hd);
      if (w > 0) {
        const ay = angDiff(e.yaw, Math.atan2(-dx, -dz)), ap = Math.atan2(dy, hd) - e.pitch, k = 1 - Math.exp(-KNIFE_MAG.rate * w * dt);
        let sy = ay * k, sp = ap * k; const m = hyp(sy, sp), room = KNIFE_MAG.max - PL.knifePull;
        if (m > room) { sy *= room / m; sp *= room / m; }
        e.yaw += sy; e.pitch = clamp(e.pitch + sp, -1.5, 1.5); PL.knifePull += hyp(sy, sp);
      }
    }
    if (!PL.knifeHit && PL.knifeT < KNIFE_DUR * (1 - KNIFE_HIT)) {
      PL.knifeHit = true;
      if (T && T.alive && T.pos.distanceTo(e.pos) < 2.2) { sfxMelee(); bloodFx(entChest(T, new V3()), camFwd(new V3()), false); kcEvent('melee', { sid: e.kcI, p: entChest(T, new V3()), dir: camFwd(new V3()) }); T.lastForce = { dir: camFwd(new V3()), mag: 6, lift: 1.4, part: 'body' }; applyDamage(T, 200, e, _t('Couteau'), false, camFwd(new V3())); PL.vpY += 1.5; }
    }
    if (PL.knifeT <= 0) { VM.lowerTarget = PL.knifeOut ? 1 : 0; PL.knifeTarget = null; }
  }
  nadeArcUpdate();
  if (PL.nadeState) {
    PL.nadeT += dt;
    if (PL.nadeFuse && !PL.nadeThrown) {
      // mèche en cours dans la main : un déclic par seconde, puis explosion si on tarde trop
      PL.cookT += dt;
      if (Math.floor(PL.cookT) !== Math.floor(PL.cookT - dt)) sfxClick(null, 2600, 0.15);
      if (PL.cookT >= nadeFuse(PL.nadeType)) { if (PL.nadeState !== 'throw') PL.nades--; PL.nadeState = null; VM.lowerTarget = PL.knifeOut ? 1 : 0; VM.lowerRate = 16; nadeBurst(PL.nadeType, e.pos.clone().add(new V3(0, 1, 0)), e); } // gardée trop longtemps : dans la main
    }
    if (PL.nadeState === 'pull') {
      if (!PL.nadePin && PL.nadeT >= NADE_ANIM.pin) { PL.nadePin = true; sfxMech('pin'); PL.vpY += 0.25; }
      if (PL.nadeT >= NADE_ANIM.pull) {
        if (PL.nadeQueued) startThrow();
        else { PL.nadeState = 'cook'; PL.nadeT = 0; if (NADE_TYPES[PL.nadeType].cook) { PL.nadeFuse = true; sfxMech('spoon'); vmSpoon(); } } // flash, fumigène : la cuillère reste, la mèche ne part qu'au lancer
      }
    } else if (PL.nadeState === 'throw') {
      if (!PL.nadeThrown && PL.nadeT >= NADE_ANIM.release) { PL.nadeThrown = true; throwNadeNow(); }
      if (PL.nadeT >= NADE_ANIM.raise) VM.lowerTarget = PL.knifeOut ? 1 : 0;
      if (PL.nadeT >= NADE_ANIM.throw) { PL.nadeState = null; VM.lowerRate = 16; }
    }
  }
  // couteau en main : le clic donne des coups (tant qu'il est tenu, un coup après l'autre) à la place des tirs ; la main sort et rentre avec knifeHold
  knifeButtonTick(dt);
  if (PL.knifeOut) { if ((PL.queued || PL.held) && !hold) knife(); PL.queued = false; }
  PL.knifeHold = damp(PL.knifeHold, PL.knifeOut && !PL.nadeState && !KS.mode && !(PL.knifeT > 0 && !PL.knifeNew) ? 1 : 0, PL.knifeOut ? 8 : 12, dt); // la sortie se voit (0,3 s), le rangement est plus vif
  // arme : même contrôleur que les bots
  const shotsBefore = e.arms.shots;
  ctlWeapon(e, dt, now);
  if (e.arms.shots !== shotsBefore || curW().mag <= 0 || PL.sprinting) PL.queued = false;
  if (e.arms.shots !== shotsBefore) PL.runShot = false;
  PL.yaw = e.yaw; PL.pitch = e.pitch;
  // souffle retenu en lunette
  const scoped = d.scope && VM.ads > 0.9;
  PL.holding = scoped && (KEYS.ShiftLeft || PAD.l3) && PL.breath > 0;
  PL.breath = clamp(PL.breath + (PL.holding ? -dt / 4 : dt / 5), 0, 1);
  // régénération
  if (now - PL.lastDmgT > 4.5 && e.health < 100) e.health = Math.min(100, e.health + 45 * dt);
  if (e.health < 40) { PL.heartT -= dt; if (PL.heartT <= 0) { sfxHeart(); PL.heartT = 0.9; } }
  PL.suppress = Math.max(0, PL.suppress - dt * 0.8);
  PL.ent.pitch = PL.pitch; PL.ent.yaw = PL.yaw;
  applyCamera(dt, now, scoped);
  // soleil sur l'arme : visible si le rayon vers le soleil est libre
  if ((PL.sunTick = (PL.sunTick || 0) + 1) % 6 === 0) {
    const h = rayWorld(camera.position.x, camera.position.y, camera.position.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 120);
    PL.sunTarget = h ? 0 : 1;
  }
  VM.sunVis = damp(VM.sunVis, PL.sunTarget ?? 1, 4, dt);
  // vitesse dans le repère du regard (pas chassés, poussée) et distance du mur droit devant (arme repliée)
  const lat = e.vel.x * Math.cos(PL.yaw) - e.vel.z * Math.sin(PL.yaw), fwd = -e.vel.x * Math.sin(PL.yaw) - e.vel.z * Math.cos(PL.yaw);
  let wall = 0;
  if ((PL.wallTick = (PL.wallTick || 0) + 1) % 2 === 0) {
    const f = camFwd(_v1), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 0.95);
    PL.wall = h ? clamp((0.9 - h.t) / 0.45, 0, 1) : 0;
  }
  wall = PL.wall || 0;
  laserUpdate(!!d.laser && e.alive && !PL.sprinting && VM.ads < 0.35 && !PL.nadeState && PL.knifeT <= 0 && VM.lower < 0.3, dt);
  updateViewmodel(dt, { ads, sprint: PL.sprinting, speed: hs, grounded: PL.onGround, crouch: e.crouch, empty: curW().mag === 0, lat, fwd, fire: PL.held, wall, slide: e.slideAmt });
  // corps invisible du joueur : ne sert qu'à projeter son ombre
  const sm = e.model;
  if (sm) {
    if (sm.gunKey !== d.key) setSoldierGun(sm, d.key);
    e.recoil = 0; poseSoldier(e, dt); layoutSoldier(sm, true);
    sm.root.visible = false; // l'ombre du corps invisible créait une silhouette noire parasite devant le joueur
  }
  const rigS = { knifeT: PL.knifeT, knifeNew: PL.knifeNew, nadeState: PL.nadeState, nadeT: PL.nadeT, cookT: PL.cookT, knifeHold: PL.knifeHold, sprint: VM.sprint, speed: hs };
  if (KNIFE_DEBUG) KNIFE_DEBUG(rigS, dt); // banc de réglage du couteau (?couteau=1)
  if (NADE_DEBUG) NADE_DEBUG(rigS, dt); // banc de réglage des grenades (?grenade=1)
  updateRigs(dt, rigS);
}
/* Poussière soulevée derrière les pieds pendant la glissade */
function slideDust(e, dt) { // e : le joueur ou un bot
  e.dustT = (e.dustT || 0) - dt;
  if (e.dustT > 0) return;
  e.dustT = 0.03;
  const dx = e.slideDx, dz = e.slideDz, k = clamp(e.slideT / 0.5, 0.3, 1), c = CURMAP.def.atmo.snow ? [0.88, 0.91, 0.95] : [0.58, 0.53, 0.45];
  FX.smoke.spawn(e.pos.x - dx * 0.4 + rand(-0.15, 0.15), e.pos.y + 0.05, e.pos.z - dz * 0.4 + rand(-0.15, 0.15), -dx * rand(0.4, 1.4) + rand(-0.4, 0.4), rand(0.3, 0.9), -dz * rand(0.4, 1.4) + rand(-0.4, 0.4), rand(0.5, 0.9), 0.1, 0.5, c[0], c[1], c[2], 0.32 * k, 0, 0, 1.6, rand(-1, 1));
}
function surfaceAt(p) {
  const g0 = RELIEF.on ? reliefAt(p.x, p.z) : 0; // sol implicite : le relief d'une carte en dunes
  if (POOLS.length && (RELIEF.on || p.y < 0.25)) { const pl = poolAt(p.x, p.z); if (pl && (!RELIEF.on || p.y < pl.wl)) return 'water'; } // dans un bassin : on patauge (pas, éclaboussures, ondulations) ; sur un îlot, non
  if (p.y > g0 + 0.1) { for (const c of queryBoxes(p.x, p.z, p.x, p.z)) if (Math.abs(c.y1 - p.y) < 0.05 && p.x >= c.x0 && p.x <= c.x1 && p.z >= c.z0 && p.z <= c.z1) return c.m; return 'concrete'; }
  return CURMAP.def.surface(p);
}
/* Ressort de la vue sur une marche : pulsation (rad/s) d'un ressort à amortissement critique ; la vue rattrape le sol en 0,2 s environ, sans dépasser */
const STEP_CAM_W = 21;
function applyCamera(dt, now, scoped) {
  const e = PL.ent, d = curW().def;
  PL.vpP += (-180 * PL.punchP - 16 * PL.vpP) * dt; PL.punchP += PL.vpP * dt;
  // secousses de la vue et à-coups du champ de vision des gestes de l'arme (chargeur claqué, culasse : vmCamKick, 06cy-ressorts.js)
  const K = VM.camK; if (K[0] || K[1] || K[2] || K[3]) { PL.vpP += K[0]; PL.vpY += K[1]; PL.vrollP += K[2]; PL.fovK = (PL.fovK || 0) + K[3]; K.fill(0); }
  PL.vpY += (-180 * PL.punchY - 16 * PL.vpY) * dt; PL.punchY += PL.vpY * dt;
  // roulis et élan du buste (lancer de grenade)
  PL.vrollP += (-150 * PL.rollP - 15 * PL.vrollP) * dt; PL.rollP += PL.vrollP * dt;
  PL.vlunge += (-120 * PL.lunge - 14 * PL.vlunge) * dt; PL.lunge += PL.vlunge * dt;
  PL.shake = Math.max(0, PL.shake - dt * 1.6);
  const sh = PL.shake * PL.shake * 0.04 + PL.suppress * 0.004;
  let sx = 0, sy = 0;
  if (scoped) {
    const k = PL.holding ? 0.08 : 1, t = now;
    sx = (Math.sin(t * 0.83) * 0.0065 + Math.sin(t * 1.91) * 0.003) * k; sy = (Math.sin(t * 1.13) * 0.005 + Math.cos(t * 0.57) * 0.0035) * k;
  }
  const bob = PL.bobA * (1 - VM.ads * 0.8), sw = e.arms.sprintW; // en sprint, la tête marque davantage les foulées
  // réarmement en lunette : la visée bouge avec la culasse sans quitter le zoom
  if (scoped && PL.boltT > 0) { const k = 1 - PL.boltT / 1.05, w = Math.sin(clamp(k * 1.25, 0, 1) * Math.PI); sy -= w * 0.01; sx += w * 0.004; }
  PL.aberr = damp(PL.aberr || 0, 0, 9, dt);
  // marche, trottoir, escalier : la pose au sol (07c-controller.js) change la hauteur du joueur d'un coup, jusqu'à STEP. La vue ne suit pas ce saut : l'écart
  // fait à pied est absorbé dans un décalage de la vue (stepOff), que ramène à zéro un ressort à amortissement critique (0,2 s environ).
  // En l'air, le saut, la chute et l'atterrissage gardent leur hauteur exacte (le décalage s'efface vite) ; un écart plus grand qu'une marche (apparition,
  // téléportation) remet la vue à zéro.
  const dy = e.pos.y - PL.lastY;
  PL.lastY = e.pos.y;
  if (Math.abs(dy) > STEP + 0.1) { PL.stepOff = 0; PL.stepV = 0; }
  else if (e.onGround && PL.lastOn) {
    // solution exacte du ressort amorti sur dt : la même courbe à toute cadence (un pas d'Euler donnait, à 24 images par seconde, la moitié de la marche d'un coup)
    const x = clamp(PL.stepOff - dy, -STEP - 0.1, STEP + 0.1), w = STEP_CAM_W, q = PL.stepV + w * x, ex = Math.exp(-w * dt);
    PL.stepOff = ex * (x + q * dt); PL.stepV = ex * (PL.stepV - w * q * dt);
  } else { PL.stepOff = damp(PL.stepOff, 0, 14, dt); PL.stepV = 0; }
  PL.lastOn = e.onGround;
  // tête stable façon CoD : petit mouvement de caméra, c'est l'arme qui porte l'essentiel du balancement
  camera.position.set(e.pos.x, e.pos.y + PL.stepOff + PL.eyeH + Math.sin(PL.bobT * 2) * (0.012 + 0.008 * sw) * bob, e.pos.z);
  camera.position.x += Math.cos(PL.yaw) * Math.cos(PL.bobT) * 0.007 * bob; camera.position.z -= Math.sin(PL.yaw) * Math.cos(PL.bobT) * 0.007 * bob;
  camera.position.x -= Math.sin(PL.yaw) * PL.lunge; camera.position.z -= Math.cos(PL.yaw) * PL.lunge;
  camera.rotation.set(PL.pitch + PL.punchP + sy + (Math.random() - 0.5) * sh + Math.sin(PL.bobT * 2) * 0.004 * sw * bob, PL.yaw + PL.punchY + sx + (Math.random() - 0.5) * sh, Math.cos(PL.bobT) * (0.003 + 0.005 * sw) * bob + VM.swayX * -0.02 + PL.rollP + (e.slideAmt || 0) * 0.045);
  PL.yawReal = PL.yaw;
  PL.fovK = damp(PL.fovK || 0, 0, 7, dt);
  const fovT = Settings.fov * lerp(1, d.adsFov, smoothstep(0, 1, VM.ads)) * (1 + 0.085 * sw + (e.slideAmt || 0) * 0.09) + PL.fovK * lerp(1, 0.35, VM.ads);
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = damp(camera.fov, fovT, 26, dt); camera.updateProjectionMatrix(); onResizeFx(); }
  const vf = vmFovAt(VM.fovHip, VM.ads);
  if (Math.abs(vmCamera.fov - vf) > 0.01) { vmCamera.fov = vf; vmCamera.updateProjectionMatrix(); }
}
function updateDeadPlayer(dt) {
  PL.deathT += dt;
  if (KC.active && KC.live) return; // relecture en ligne : la caméra et l'arme sont celles du tueur (09b-killcam.js), la suite vient de endKillcam
  const e = PL.ent, k = smoothstep(0, 0.8, PL.deathT);
  if (e.voidDead) {
    // chute dans le vide : la vue continue de tomber en ralentissant, tournée vers les îles qui s'éloignent
    camera.position.set(e.pos.x, e.pos.y + PL.eyeH - 9 * (1 - Math.exp(-0.9 * PL.deathT)), e.pos.z);
    camera.rotation.set(lerp(PL.pitch, 0.8, smoothstep(0, 1.6, PL.deathT)), PL.yaw, 0);
  } else {
    camera.position.set(e.pos.x, e.pos.y + lerp(PL.eyeH, 0.35, k), e.pos.z);
    let yaw = PL.yaw;
    if (PL.killer && PL.killer.alive && PL.deathT > 0.9) { const dx = PL.killer.pos.x - e.pos.x, dz = PL.killer.pos.z - e.pos.z; yaw = PL.yaw + angDiff(PL.yaw, Math.atan2(-dx, -dz)) * smoothstep(0.9, 2, PL.deathT); }
    camera.rotation.set(lerp(PL.pitch, -0.1, k), yaw, lerp(0, 0.5, k));
  }
  VM.holder.visible = false; vmClearHeld();
  if (e.model) e.model.root.visible = false;
  if (KC.pending && PL.deathT > 1.2 && MATCH.state === 'playing' && !MATCH.finalPending) { if (startKillcam({ killer: KC.pending, victim: PL.ent, tEnd: KC.deathT, info: KC.info })) return; KC.pending = null; $('death').classList.remove('kcnext'); } // (pas de relecture : la barre de réapparition revient)
  if (PL.deathT > modeDef().respawn && MATCH.state === 'playing' && !KC.pending && !MATCH.finalPending) respawnPlayer();
}
function respawnPlayer() {
  spawnEntity(PL.ent);
  PL.yaw = PL.ent.yaw; PL.pitch = 0; PL.eyeH = 1.62; PL.onGround = true; PL.crouchToggle = false;
  giveLoadout(); PL.ent.arms.recPend = 0;
  // l'arme en main revient toujours : le drone kamikaze et le mecha la cachent pendant qu'on les pilote, et une mort aux commandes (fpvLeave,
  // mechaExit, joueur déjà mort) ne la rendait pas ; sans killcam (mort par explosion, drone, hélicoptère), on réapparaissait les mains vides
  VM.root.visible = true; VM.holder.visible = true;
  hideDeathScreen();
}
