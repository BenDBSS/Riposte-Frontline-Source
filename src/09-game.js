/* ==========================================================================
   MATCH, HUD, MENU, BOUCLE
   ========================================================================== */
const MATCH = { state: 'loading', mode: 'tdm', time: 0, timeLeft: 600, score: [0, 0], limit: 75, uav: [0, 0], uavPing: [null, null], sat: [0, 0], iem: [0, 0], events: [], winner: -1 };
const $ = (id) => document.getElementById(id);
const LOCK = { rawNo: false, fallback: false, pending: false, manual: false, fails: 0, inputT: -1e9, resumeT: -1e9, escArmed: false, quiet: false, scriptExit: false, kbLock: false, fsPending: null };
function pointerActive() { return document.pointerLockElement === canvas || LOCK.fallback || TOUCH.on || PAD.drive; } // au doigt ou à la manette, pas de capture de la souris : toujours actif

/* ---------- Dégâts et éliminations ---------- */
function applyDamage(victim, dmg, attacker, weapon, head, dir, srcPos, life) { // life : apparition du tireur au lancer d'une grenade ou d'une frappe (streakKill)
  if (!victim.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  if (victim.inMecha) return; // à bord de son mecha : les coups vont au blindage (rayMechas, mechaBlast)
  if ((ESSAI || ESSAI_MECHA) && victim.isPlayer && !(attacker === victim && weapon === NET_WSPECIAL.mecha)) return; // essai d'une série (?essai=, 09zm-essai.js) : le joueur ne prend rien (sauf son mecha qui explose avec lui à bord, ce qu'on essaie aussi)
  if (MATCH.online && attacker && attacker !== victim && allied(attacker, victim)) return; // pas de tir allié (en match à mort, personne n'est allié)
  if (victim.protT > 0) return; // protection de réapparition (match à mort, domination)
  // victime distante : la touche lui est adressée, elle applique elle-même les dégâts
  if (victim.isRemote) {
    if (attacker && netIsLocal(attacker)) {
      // mort prédite : une touche mortelle d'après la vie de la victime moins mes touches encore en route (netPredHealth) se voit tout de suite
      // chez le tireur (netPredictKill) ; liaison douteuse (netLinkBad) : la touche part, mais ni croix ni mort prédite, qui annonceraient une
      // élimination qui ne viendrait pas
      const sure = attacker === PL.ent && !netLinkBad(), lethal = sure && !victim.pred && dmg >= netPredHealth(victim) + 2;
      netSendHit(victim, dmg, weapon, head, dir, attacker); victim.dmgBy.set(attacker, MATCH.time);
      if (lethal) netPredictKill(victim, head, dir);
      if (sure) hitFeedback(head, lethal);
      kcEvent('hit', { sid: attacker.kcI, head: !!head, kill: lethal }); // (la croix de touche, rejouée dans la killcam)
    }
    return;
  }
  victim.health -= dmg;
  victim.dmgBy.set(attacker, MATCH.time);
  if (victim.isPlayer) {
    PL.lastDmgT = MATCH.time; sfxHurt(dmg); padRumble(0.4 + dmg / 120, 0.8, 140 + dmg * 2); touchBuzz(clamp(dmg * 0.6, 12, 40));
    FinalShader.uniforms.uDamage.value = Math.min(0.8, FinalShader.uniforms.uDamage.value + dmg / 90);
    // la vue encaisse du côté d'où vient le coup : choc vers le haut, lacet et roulis à l'opposé du tireur
    let side = 0;
    if (attacker !== victim) {
      const sp = srcPos || attacker.pos; PL.dmgInd.push({ x: sp.x, z: sp.z, t: 1.6 });
      side = clamp(((sp.x - victim.pos.x) * Math.cos(PL.yaw) - (sp.z - victim.pos.z) * Math.sin(PL.yaw)) / 5, -1, 1);
    }
    PL.vpP += 0.8 + dmg * 0.012; PL.vpY += (Math.random() - 0.5) * 0.8 + side * 0.9; PL.vrollP += side * 0.45;
  } else {
    victim.model.flinch = 1; victim.lastHitT = MATCH.time;
    // réaction à l'impact (06b-soldier.js) : dans le sens du tir, plus forte en pleine tête
    const M = victim.model; M.hitKick = (M.hitKick || 0) + (head ? 1.4 : 1); M.hitHead = !!head;
    if (dir) (M.hitDir = M.hitDir || new V3()).copy(dir);
    if (!srcPos && attacker !== victim) botHurt(victim, attacker, dmg, dir, MATCH.time); // pas de riposte contre l'hélicoptère : les bots ne le visent pas
  }
  const kill = victim.health <= 0;
  if (attacker.isPlayer && victim !== attacker) hitFeedback(head, kill);
  if (attacker && victim !== attacker) kcEvent('hit', { sid: attacker.kcI, head: !!head, kill }); // la croix de touche de chaque tireur, rejouée dans sa killcam
  if (kill) killEnt(victim, attacker, weapon, head, dir || new V3(0, 0, -1), life);
}
/* Chute dans le vide (îles flottantes, VOID) : la machine qui simule ce soldat (le joueur chez lui, les bots chez l'hôte ou hors ligne) le
   tue elle-même, sans applyDamage (la protection de réapparition l'empêcherait), et l'annonce en ligne comme toute mort ('kill', cause
   'fall'). L'adversaire qui l'a touché dans les 5 dernières secondes (le temps avant que la santé ne remonte) est crédité de
   l'élimination, comme dans les jeux du genre ; sinon c'est une chute seule, comptée comme un suicide. Ni killcam, ni corps. */
function voidDeath(e) {
  if (!e.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  let a = e, best = -1;
  for (const [ent, t] of e.dmgBy) if (ent !== e && !allied(ent, e) && MATCH.time - t < 5 && t > best) { best = t; a = ent; }
  const dir = new V3(e.vel.x, 0, e.vel.z); if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); dir.normalize();
  e.voidDead = true;
  if (!e.isPlayer) e.lastForce = { dir: dir.clone(), mag: 1, part: 'body' };
  killEnt(e, a, NET_WSPECIAL.fall, false, dir);
}
/* Après le déplacement d'un soldat local : passé sous le plan de mort, il meurt ; pendant l'annonce de fin (plus de mort possible), il reste
   suspendu sous les îles, hors de vue. Rend vrai si le soldat vient de mourir. */
function voidCheck(e) {
  if (!VOID.on || !e.alive || e.pos.y >= VOID.kill) return false;
  if (MATCH.state === 'playing' || MATCH.state === 'paused') voidDeath(e); else { e.pos.y = VOID.kill; e.vy = 0; }
  return !e.alive;
}
/* Une élimination ne fait monter la série que si le tueur est en vie et l'a faite dans sa vie actuelle : ni avec l'hélicoptère, ni pendant
   l'écran de mort, ni avec une grenade ou une frappe aérienne lancée dans une vie précédente (life : son apparition, spawnAt, au lancer) */
function streakKill(a, weapon, life) { return a.alive && weapon !== NET_WSPECIAL.heli && (life === undefined || life === a.spawnAt); }
function killEnt(v, a, weapon, head, dir, life) {
  v.alive = false; v.deaths++; v.streak = 0; v.health = 0; v.protT = 0; pfrEvent(2);
  noteDeath(v); botDeathNote(v, a);
  dropKilledWeapon(v, dir);
  const now = MATCH.time;
  // en ligne, chaque participant local (moi, ou un bot simulé par l'hôte) annonce sa propre mort
  if (MATCH.online && (v.isPlayer || v.netBot)) netEvent({ k: 'kill', by: netIdOf(a), h: head ? 1 : 0, w: netWeaponKey(weapon), x: +(dir ? dir.x : 0).toFixed(2), z: +(dir ? dir.z : 1).toFixed(2), q: NET.hitQ || undefined }, v); // q : la touche qui a tué (morts croisées, netHeldCheck)
  if (v.isPlayer) {
    if (PILOT.d) fpvLeave(); // la vue revient au corps ; le drone tombe (fpvStep)
    PL.deathT = 0; PL.killer = a !== v ? a : null; PL.reload = null; dropCookedNade(); PL.nadeState = null; PL.knifeT = 0; PL.knifeOut = false; PL.knifeHold = 0; PL.knifeBtn = null; vmClearHeld();
      KC.pending = a && a !== v && a.model && weapon !== NET_WSPECIAL.heli && weapon !== NET_WSPECIAL.drone && weapon !== NET_WSPECIAL.mecha && weapon !== NET_WSPECIAL.fall && weapon !== NET_WSPECIAL.zone ? a : null; KC.deathT = MATCH.time; // (le nom traduit : en anglais, 'Hélicoptère' ne correspondait jamais)
    if (KC.pending) KC.info = `<span class="enemy">${esc(a.name)}</span><i>${esc(weapon)}</i><i>${Math.round(a.pos.distanceTo(v.pos))} m</i>`;
    showDeathScreen(a, weapon, head);
  } else {
    v.respawnT = modeDef().botRespawn; v.target = null; v.path = null;
    if (!v.lastForce) v.lastForce = { dir: dir.clone().normalize(), mag: 2.5, part: head ? 'head' : 'body' };
    v.model.rag = null;
  }
  const enemyKill = a !== v && !allied(a, v) && !MATCH.finalPending && !MATCH.fin; // la partie annoncée ne marque plus
  if (enemyKill) {
    // un tueur distant tient ses propres compteurs et les publie ; up : la série vient de monter (les paliers ne se lisent qu'alors, sinon
    // une élimination qui ne compte pas, celle de l'hélicoptère par exemple, redonnait la série du palier où l'on était : un hélicoptère
    // par élimination de l'hélicoptère, la série restant à 11)
    let combo = 0, up = false;
    if (!a.isRemote) {
      // combo : chaque élimination à moins de COMBO.win s de la précédente rapporte un cran de plus (la mort remet à zéro, spawnEntity)
      a.comboN = MATCH.time - (a.comboT === undefined ? -99 : a.comboT) < COMBO.win ? (a.comboN || 0) + 1 : 1; a.comboT = MATCH.time;
      combo = Math.min(COMBO.max, (a.comboN - 1) * COMBO.step);
      a.kills++; a.score += 100 + (head ? 50 : 0) + combo; up = streakKill(a, weapon, life); if (up) a.streak++;
    }
    if (MATCH.mode === 'tdm') MATCH.score[a.team]++; // en domination, le score vient des points tenus
    domKillBonus(a, v);
    if (a.isPlayer) {
      PL.bestStreak = Math.max(PL.bestStreak, a.streak);
      xpPopup('+100', HUD.chain > 1 ? chainLabel(HUD.chain) : head ? _t('Tir en pleine tête') : _t('Élimination'), HUD.chain > 1 ? 'chain' : head ? 'head' : '');
      HUD.chain = 0;
      if (head) setTimeout(() => xpPopup('+50', _t('Bonus tête'), 'small'), 160);
      if (combo) setTimeout(() => xpPopup('+' + combo, _t('Bonus combo'), 'small'), head ? 340 : 160);
      const wid = WEAPON_ID_BY_NAME[weapon]; if (wid) arsNotify(arsKill(wid, head)); // XP de l'arme (06r-arsenal.js)
      defisKill(a, v, weapon, head); // défis des tenues (06s-defis.js)
      // série prête : son nom et, à l'ordinateur ou à la manette, la touche ou le bouton qui l'appelle (glyphe du mode d'entrée, 09x-invites.js)
      if (up) for (const id of PL.ksSel) if (a.streak === KSDEF[id].n) {
        const g = actGlyph(ksAct(id)), name = KSDEF[id].name;
        PL.ks[id] = true; sfxAnnounce(id + '_ready', 'st_ready'); hudMsg(g ? _t('{0} disponible : {1}', name, g) : _t('{0} disponible', name), 'xp', 3, !!g);
      }
      updateStreakHud();
    } else if (up) botStreak(a);
    for (const [ent, t] of v.dmgBy) {
      if (ent === a || allied(ent, v) || now - t > 8) continue;
      ent.assists++; ent.score += 20; if (ent.isPlayer) xpPopup('+20', _t('Aide'), 'small');
    }
  } else if (a === v) { a.score = Math.max(0, a.score - 50); }
  addKillfeed(a, v, weapon, head);
  const nocam = weapon === NET_WSPECIAL.fall || weapon === NET_WSPECIAL.zone; // une chute ne se rejoue pas (le corps est tombé dans le vide), une mort dans le désert non plus (personne n'a tiré)
  if (MATCH.online && enemyKill) MATCH.lastKill = { killer: a, victim: v, t: now, info: killInfo(a, v, weapon), nocam }; // en ligne, l'hôte décide la fin : la killcam finale reprend cette dernière élimination (matchFinish)
  if (!MATCH.online && !MATCH.finalPending && !MATCH.fin && killLimitReached()) {
    // la dernière élimination décide la partie : annonce du résultat (09l-fin.js), puis killcam finale sur cette élimination
    MATCH.finalPending = { killer: a, victim: v, t: now, info: killInfo(a, v, weapon), nocam };
    matchFinishSoon(); // un court délai : la dernière victime a le temps de tomber avant l'annonce
  }
}
function killInfo(a, v, weapon) { return `<span class="${teamCls(a)}">${esc(a.name)}</span><i>${esc(weapon)}</i><i>${Math.round(a.pos.distanceTo(v.pos))} m</i>`; }
/* Séries d'un bot : trois au hasard, à trois seuils différents, tirées une fois pour toutes */
function botKs(b) { if (!b.ks) b.ks = ksSort(ksPick(KS_IDS.slice().sort(() => Math.random() - 0.5))); return b.ks; }
function botStreak(b) {
  if (MATCH.mode === 'ffa' || ksJammed(b.team)) return; // chacun pour soi : les séries restent au joueur ; brouillé par une IEM : la série est perdue
  for (const id of botKs(b)) if (b.streak === KSDEF[id].n) KSDEF[id].bot(b);
}
function botUav(b) {
  const ally = b.team === PL.ent.team;
  uavStart(b.team); spawnDrone(b.team); netUav(b); sfxAnnounce(ally ? 'uav_on' : 'uav_enemy');
  hudMsg(ally ? `${_t('UAV allié ({0})', b.name)}` : _t('UAV ennemi en ligne'), ally ? 'ally' : 'enemy', 2.5);
}
/* Mecha d'un bot : largué sur la zone la plus proche d'un ennemi au hasard, tourné vers lui */
function botMecha(b) {
  const foes = entities.filter((e) => e.alive && !e.off && !allied(e, b)); if (!foes.length) return;
  const t = pick(foes), q = mnavZone(t.pos.x, t.pos.z); if (!q) return;
  mechaCall(b, new V3(q.x, q.y, q.z), Math.atan2(-(t.pos.x - q.x), -(t.pos.z - q.z)));
}
function botAirstrike(b) {
  const ally = b.team === PL.ent.team, foes = entities.filter((e) => e.alive && e.team !== b.team);
  if (!foes.length) return;
  netAirstrike(pick(foes).pos.clone(), rand(0, TAU), b);
  hudMsg(ally ? _t('Frappe aérienne alliée') : _t('Frappe aérienne ennemie !'), ally ? 'ally' : 'enemy', 2.5);
}

/* ---------- HUD ---------- */
const HUD = { mmAt: 0, lastAmmo: '', msgT: 0, hitT: 0, xhairGap: 20, kick: 0, chain: 0, tagT: 0, board: false, boardT: 0, dMode: '', mm: null, mmStatic: null, mmFit: true, k: '', mode: '', rkT: 0, jam: null, fpvMode: '' }; // jam : neige de la mini-carte brouillée (mmJamDraw)
addEventListener('resize', () => { HUD.mmFit = true; }); // mini-carte : bitmap à la taille affichée (drawMinimap)
/* Message au centre haut (à --msg-top) ; html : le texte porte un glyphe de touche (actGlyph), déjà échappé */
function hudMsg(text, kind, dur, html) {
  const el = $('msg'); if (html) el.innerHTML = text; else el.textContent = text; el.className = 'msg show k-' + (kind || 'none'); HUD.msgT = dur || 2;
}
/* Gain d'XP à droite du réticule : la colonne (#xpbox, flex) range les gains, le plus récent au plus près du réticule ; trois au plus à la fois */
function xpPopup(big, small, cls = '') {
  const el = document.createElement('div'); el.className = 'xp ' + cls;
  el.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ''}`;
  const box = $('xpbox'); box.appendChild(el); setTimeout(() => el.remove(), 1700);
  while (box.children.length > 3) box.firstChild.remove();
}
function showHitmarker(head, kill) {
  const h = $('hitmarker'); h.classList.remove('on', 'head', 'kill'); void h.offsetWidth;
  h.classList.add('on'); if (head) h.classList.add('head'); if (kill) h.classList.add('kill');
}
/* Chaîne d'éliminations du joueur : chacune à moins de 4 s de la précédente monte d'un cran (son et message). Le score suit la même règle pour
   tous (killEnt, a.comboN) : +25 points par cran, jusqu'à +100 (retour du propriétaire : « un combo qui fait gagner un peu plus de points ») */
const COMBO = { win: 4, step: 25, max: 100 };
const CHAIN = { n: 0, t: -99 };
function chainLabel(n) { return n === 2 ? _t('Double élimination') : n === 3 ? _t('Triple élimination') : n === 4 ? _t('Quadruple élimination') : `${_t('Série de {0} éliminations', n)}`; }
/* Retour d'une balle qui touche : croix de touche, son sec, et le réticule qui se resserre sur la cible */
function hitFeedback(head, kill) {
  // une grenade lâchée à la mort ou lancée avant elle peut éliminer quelqu'un après la réapparition : le crédit reste, mais pas la croix
  // ni le son au milieu de l'écran tant que le joueur n'a rien fait (tiré, lancé, appelé une série) dans cette vie
  if (PL.actT < (PL.ent.spawnAt || 0)) return;
  let ch = 1;
  if (head && kill) PL.hsKills = (PL.hsKills || 0) + 1; // éliminations à la tête de la partie (statistiques du compte)
  if (kill) { ch = MATCH.time - CHAIN.t < 4 ? CHAIN.n + 1 : 1; CHAIN.n = ch; CHAIN.t = MATCH.time; HUD.chain = ch; }
  showHitmarker(head, kill); sfxHit(head, kill, ch); touchBuzz(kill ? 28 : 8); // vibration au doigt (09qd-visee.js)
  padRumble(kill ? 0.9 : head ? 0.55 : 0.3, kill ? 0.5 : 0.6, kill ? 110 : 40, true); // à la manette : la touche se sent dans la main, l'élimination plus fort (09qc-manette.js)
  HUD.kick = Math.max(0, (HUD.kick || 0) - (kill ? 5 : 2));
}
function teamCls(e) { return allied(e, PL.ent) ? 'ally' : 'enemy'; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function addKillfeed(a, v, weapon, head) {
  const el = document.createElement('div'); el.className = a === PL.ent || v === PL.ent ? 'kf me' : 'kf'; // les éliminations du joueur (ou sa mort) : filet jaune
  el.innerHTML = a === v
    ? `<span class="${teamCls(v)}">${esc(v.name)}</span><i>${esc(weapon)}</i>`
    : `<span class="${teamCls(a)}">${esc(a.name)}</span><i>${esc(weapon)}${head ? ' ' + _t('<em>tête</em>') : ''}</i><span class="${teamCls(v)}">${esc(v.name)}</span>`;
  const kf = $('killfeed'); kf.appendChild(el);
  while (kf.children.length > 5) kf.firstChild.remove();
  setTimeout(() => el.classList.add('fade'), 5500); setTimeout(() => el.remove(), 6200);
}
/* Les trois emplacements de séries (#ks1 à #ks3), avec l'icône et le nom de la série de la classe */
function updateStreakHud() {
  HUD.mode = inputMode(); // updateHud la rappelle quand le mode d'entrée change (clavier, manette) : le glyphe suit
  PL.ksSel.forEach((k, i) => {
    const el = $('ks' + (i + 1)), K = KSDEF[k];
    el.className = 'ks' + (PL.ks[k] ? ' ready' : '');
    hudHtml(el.querySelector('i'), `<svg viewBox="0 0 24 24" aria-hidden="true">${K.icon}</svg><span>${esc(K.name)}</span>`);
    // la progression reste cachée : seule la touche ou le bouton qui l'appelle apparaît, une fois la série obtenue (rien au doigt : ses boutons sont à l'écran)
    hudHtml(el.querySelector('b'), PL.ks[k] ? actGlyph('ks' + (i + 1)) : '');
  });
  if (TOUCH.on) touchKsIcons();
}
/* Écran de mort : carte en bas au centre (« Éliminé par » en surtitre, le tueur en grand, l'arme et la distance), l'invite de réapparition avec la
   touche ou le bouton du mode d'entrée et, sans killcam à suivre, la barre du temps avant la réapparition automatique */
function showDeathScreen(a, weapon, head) {
  const d = $('death'), by = a && a !== PL.ent, W = NET_WSPECIAL;
  d.classList.add('show'); clearHitmarker();
  $('deathBy').innerHTML = by ? `<small>${_t('Éliminé par')}</small><b class="${teamCls(a)}">${esc(a.name)}</b>` : `<b>${weapon === W.fall ? _t('Tombé dans le vide') : weapon === W.zone ? _t('Perdu dans le désert') : _t('Vous vous êtes éliminé')}</b>`;
  const far = by && weapon !== W.fall && weapon !== W.zone && weapon !== W.air && weapon !== W.heli && weapon !== W.drone && weapon !== W.mecha; // la distance n'a de sens que pour un tir ou un lancer
  $('deathWeap').innerHTML = (far ? esc(_t('{0} · {1} m', weapon, Math.round(a.pos.distanceTo(PL.ent.pos)))) : esc(weapon)) + (by && head ? ` <em>${_t('Tir en pleine tête')}</em>` : '');
  d.classList.toggle('kcnext', !!KC.pending); d.style.setProperty('--rs', modeDef().respawn + 's'); // killcam à suivre : pas de compte à rebours
  HUD.dMode = ''; deathPrompt();
  if (document.activeElement) document.activeElement.blur();
}
/* Invite de réapparition (Espace, clic, Entrée ; A ou X à la manette ; un toucher) : réécrite si le mode d'entrée change pendant l'attente */
function deathPrompt() {
  const mode = inputMode(); if (mode === HUD.dMode) return; HUD.dMode = mode;
  hudHtml($('death').querySelector('.skip'), mode === 'touch' ? esc(_t('Touchez : réapparaître tout de suite')) : mode === 'pad' ? _t('{0} Réapparaître tout de suite', actGlyph('confirm'))
    : _t('{0} ou {1} Réapparaître tout de suite', keyGlyph(_t('Espace')), actGlyph('fire')));
}
function clearHitmarker() { $('hitmarker').classList.remove('on', 'head', 'kill'); }
function hideDeathScreen() { $('death').classList.remove('show'); clearHitmarker(); }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/* Mini-carte, à chaque image : dessinée en unités de 240 (W, H), sur un bitmap à la taille affichée et à la densité de l'écran (au plus 2), recalculé
   seulement quand la taille change (HUD.mmFit : fenêtre, réglage de taille, passage au doigt) */
function drawMinimap() {
  const cv = $('minimap'), g = HUD.mm, W = 240, H = 240, scale = MM_ZOOM, now = MATCH.time, C = HUD.mmCol;
  if (HUD.mmFit) { HUD.mmFit = false; const px = clamp(Math.round((cv.clientWidth || 200) * Math.min(2, devicePixelRatio || 1)), 120, 600); if (cv.width !== px) cv.width = cv.height = px; }
  const e = PL.ent, yaw = PL.yaw, k0 = cv.width / W;
  g.setTransform(k0, 0, 0, k0, 0, 0);
  g.save(); g.clearRect(0, 0, W, H);
  g.fillStyle = HUD.mmBg; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2 + 14); g.rotate(yaw);
  g.translate(-e.pos.x * scale, -e.pos.z * scale);
  const k = scale / HUD.mmS;
  g.imageSmoothingEnabled = true;
  g.drawImage(HUD.mmStatic, HUD.mmX0 * scale, HUD.mmZ0 * scale, HUD.mmStatic.width * k, HUD.mmStatic.height * k);
  domMinimap(g, scale, yaw);
  // repère orienté (alliés, adversaires vus par le satellite) ; contour sombre : il se détache d'un bâtiment clair
  const arrow = (o, col) => {
    g.save(); g.translate(o.pos.x * scale, o.pos.z * scale); g.rotate(-o.yaw);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 4.5); g.lineTo(0, 2.5); g.lineTo(-4.5, 4.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1; g.stroke(); g.restore();
  };
  const jam = ksJammed(e.team), sat = satOn(e.team);
  for (const o of entities) {
    if (!o.alive || o === e || jam) continue; // brouillé par une IEM : aucun repère
    if (allied(o, e)) arrow(o, C.ally);
    else if (sat) arrow(o, C.enemy);
    else {
      const shot = now - o.lastShotT < 1.4, b = shot ? null : uavBlip(o, e, true); // tir : à sa place ; sinon le dernier relevé de l'UAV
      if (!shot && !b) continue;
      g.globalAlpha = shot ? 1 : b.a;
      g.fillStyle = C.enemy; g.beginPath(); g.arc((shot ? o.pos.x : b.x) * scale, (shot ? o.pos.z : b.z) * scale, 4.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
    }
  }
  if (!jam) for (const n of NADES) { g.fillStyle = C.acc; g.fillRect(n.p.x * scale - 2, n.p.z * scale - 2, 4, 4); }
  g.restore();
  if (jam) mmJamDraw(g, W, H, now);
  // joueur
  g.save(); g.translate(W / 2, H / 2 + 14);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 70, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
  g.fillStyle = C.acc; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1.2; g.stroke();
  g.restore();
  // onde du sonar de l'UAV : part du joueur à chaque relevé, à la vitesse où elle révèle les adversaires (uavBlip)
  const ping = MATCH.uav[e.team] > 0 && MATCH.uavPing[e.team], r = ping ? (now - ping.t) * UAV.speed * scale : 999;
  if (r < 170) { g.strokeStyle = `rgba(143,209,106,${(0.7 * (1 - r / 170)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2 + 14, r, 0, TAU); g.stroke(); }
}
/* Mini-carte brouillée par une IEM : neige animée par-dessus le plan, et la mention du brouillage */
function mmJamDraw(g, W, H, now) {
  if (!HUD.jam) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const q = c.getContext('2d'), im = q.createImageData(96, 96);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 200; }
    q.putImageData(im, 0, 0); HUD.jam = c;
  }
  const k = Math.floor(now * 24); // une autre neige à chaque image (24 par seconde), sans recalculer de pixels
  g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = 0.55;
  g.drawImage(HUD.jam, (k * 37) % 48, (k * 53) % 48, 48, 48, 0, 0, W, H);
  g.globalAlpha = 1; g.fillStyle = 'rgba(10,11,9,0.72)'; g.fillRect(0, H / 2 - 16, W, 32);
  g.fillStyle = '#E4473B'; g.font = '700 20px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(_t('Signal brouillé'), W / 2, H / 2 + 1); g.restore();
}
/* Écritures du HUD : il est mis à jour à chaque image, mais la plupart de ses valeurs ne changent que rarement.
   Réécrire un texte identique remplace quand même son nœud (mise en page et nouvelle peinture du texte ombré), et le
   navigateur recompose la zone : sur une puce intégrée, ce travail du compositeur se paie sur le même GPU que la
   scène 3D. On n'écrit donc que ce qui change (valeur mémorisée sur l'élément). */
const _hudV = [new V3(), new V3(), new V3()];
function hudText(el, v) { v = String(v); if (el.__t !== v) { el.__t = v; el.textContent = v; } }
function hudStyle(el, prop, v) { const k = '__s' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
function hudVar(el, name, v) { const k = '__v' + name; if (el[k] !== v) { el[k] = v; el.style.setProperty(name, v); } }
function hudHtml(el, v) { if (el.__h !== v) { el.__h = v; el.innerHTML = v; } } // texte qui porte un glyphe de touche (actGlyph)
function hudCls(el, c, on) { const k = '__c' + c; if (el[k] !== on) { el[k] = on; el.classList.toggle(c, on); } }
function updateHud(dt) {
  const e = PL.ent, w = curW(), d = w.def, now = MATCH.time, mode = inputMode(), hud = $('hud');
  // taille de l'interface en jeu (Options, Jeu) : --hud-k multiplie --hu ; au doigt, le HUD est en u et ne change pas
  const k = TOUCH.on ? '1' : String(Settings.hudScale || 1);
  if (HUD.k !== k + TOUCH.on) { HUD.k = k + TOUCH.on; hud.style.setProperty('--hud-k', k); HUD.mmFit = true; } // (passer au doigt change aussi la taille de la mini-carte)
  if (mode !== HUD.mode) { updateStreakHud(); if (!e.alive) deathPrompt(); } // glyphes des séries prêtes et de la réapparition : clavier, manette ou doigt
  hudText($('scA'), MATCH.score[0]); hudText($('scB'), MATCH.score[1]);
  hudStyle($('barA'), 'transform', `scaleX(${MATCH.score[0] / MATCH.limit})`); hudStyle($('barB'), 'transform', `scaleX(${MATCH.score[1] / MATCH.limit})`);
  hudText($('timer'), fmtTime(MATCH.timeLeft));
  // match à mort : le rang trie tous les soldats, quatre fois par seconde suffisent
  if (MATCH.mode === 'ffa' && (HUD.rkT -= dt) <= 0) { HUD.rkT = 0.25; hudText($('scLim'), `${_t('Premier à {0} · vous êtes {1}', MATCH.limit, ordinal(ffaRank()))}`); }
  domHud(dt); ringHud(e);
  const kn = PL.knifeOut; // couteau en main : son nom à la place de l'arme, ni chargeur ni réserve (la place des chiffres reste, rien ne bouge en bas à droite)
  const ammo = `${kn ? 'k' : w.mag + '|' + w.reserve + '|' + d.name}|${PL.nades}${PL.nadeType}|${mode}`;
  if (ammo !== HUD.lastAmmo) {
    HUD.lastAmmo = ammo;
    $('mag').textContent = w.mag; $('reserve').textContent = w.reserve; $('wname').textContent = kn ? _t('Couteau') : d.name;
    $('mag').parentNode.style.visibility = kn ? 'hidden' : '';
    $('mag').classList.toggle('low', !kn && w.mag <= Math.ceil(d.mag * 0.25));
    // grenades : la touche qui les lance (rien au doigt) puis une icône par grenade, pleine ou vide, à la forme du type de la classe
    const nn = Math.max(PL.nades, CLASSES[PL.classIdx].nades), ty = PL.nadeType === 'frag' ? '' : ` ${PL.nadeType}`;
    $('nades').innerHTML = (nn ? actGlyph('nade') : '') + Array.from({ length: nn }, (x, i) => `<i class="${i < PL.nades ? '' : 'off'}${ty}"></i>`).join('');
    const pips = $('pips'); const n = kn ? 0 : Math.min(d.mag, 40);
    if (pips.children.length !== n) { pips.innerHTML = ''; for (let i = 0; i < n; i++) pips.appendChild(document.createElement('i')); }
    for (let i = 0; i < n; i++) pips.children[i].className = i < w.mag ? '' : 'spent';
  }
  // invite de rechargement : chargeur au quart ou vide (en rouge), avec la touche ou le bouton du mode d'entrée
  const rh = $('reloadHint'), low = e.alive && !PL.knifeOut && w.mag <= Math.ceil(d.mag * 0.25) && !PL.reload && w.reserve > 0;
  hudStyle(rh, 'opacity', low ? '1' : '0');
  if (low) { const g = actGlyph('reload'); hudHtml(rh, g ? _t('{0} Recharger', g) : _t('Recharger')); hudCls(rh, 'empty', w.mag === 0); }
  if ((HUD.zT = (HUD.zT || 0) - dt) <= 0) { hudText($('zone'), zoneName(e.pos.x, e.pos.z)); HUD.zT = 0.3; }
  arsLevelTick(dt); // niveau du joueur franchi en cours de partie (06r-arsenal.js)
  { const t = performance.now(); if (t - HUD.mmAt >= 8) { HUD.mmAt = t; drawMinimap(); } } // mini-carte : 120 fois par seconde au plus (à 280 images par seconde, elle se redessinait à chacune)
  // réticule
  const ads = VM.ads, spd = hyp(e.vel.x, e.vel.z);
  let spread = lerp(d.spread[0], d.spread[1], ads) + d.moveSpread * clamp(spd / MOVE_SPEED, 0, 1.5) + PL.bloom + (PL.onGround ? 0 : 0.05);
  if (e.crouch) spread *= 0.8;
  const focal = VIEW.h / (2 * Math.tan((camera.fov * Math.PI) / 360));
  HUD.xhairGap = damp(HUD.xhairGap, 6 + Math.tan(spread) * focal, 20, dt);
  HUD.kick = damp(HUD.kick, 0, 14, dt);
  const xh = $('xhair'), gap = HUD.xhairGap + HUD.kick;
  hudStyle(xh, 'opacity', !e.alive || ads > 0.6 || PL.sprinting || PL.knifeT > 0 || PL.knifeOut || KS.mode || playHold() ? '0' : '0.9'); // (décompte : l'anneau prend sa place)
  hudVar(xh, '--gap', (Math.round(gap * 2) / 2).toFixed(1) + 'px'); // demi-pixel : pas de nouveau style pour un écart invisible
  const scoped = !!(d.scope && ads > 0.92 && e.alive);
  $('scope').classList.toggle('on', scoped);
  if (scoped) {
    hudStyle($('breath'), 'transform', `scaleX(${clamp(PL.breath, 0, 1).toFixed(3)})`);
    const g = actGlyph('sprint'); hudHtml($('breathHint'), g ? _t('{0} Retenir son souffle', g) : ''); // au doigt : le bouton (s'il est gardé)
  }
  FinalShader.uniforms.uAberr.value = Math.max(d.scope && ads > 0.92 ? 1.6 : 0.0, PL.aberr || 0);
  { const k = PL.boltT > 0 ? Math.sin(clamp((1 - PL.boltT / 1.05) * 1.25, 0, 1) * Math.PI) : 0; hudStyle($('scopeMask'), 'transform', k ? `translate(${k * 6}px, ${k * 22}px) rotate(${k * 1.6}deg)` : ''); }
  // indicateurs de dégâts
  const box = $('dmgind');
  while (box.children.length < PL.dmgInd.length) box.appendChild(document.createElement('i'));
  PL.dmgInd = PL.dmgInd.filter((k) => (k.t -= dt) > 0);
  for (let i = 0; i < box.children.length; i++) {
    const el = box.children[i], k = PL.dmgInd[i];
    if (!k) { hudStyle(el, 'opacity', '0'); continue; }
    const dx = k.x - e.pos.x, dz = k.z - e.pos.z;
    const f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], r = [Math.cos(PL.yaw), -Math.sin(PL.yaw)];
    const ang = Math.atan2(dx * r[0] + dz * r[1], dx * f[0] + dz * f[1]);
    hudStyle(el, 'opacity', String(Math.min(1, k.t * 1.3))); hudStyle(el, 'transform', `translate(-50%,-50%) rotate(${ang}rad) scale(${(1 + Math.max(0, k.t - 1.4) * 1.5).toFixed(2)})`);
  }
  // grenade proche
  let nd = null;
  for (const n of NADES) { if (allied(n.owner, e) && n.owner !== e) continue; if (n.p.distanceTo(e.pos) < 8) { nd = n; break; } }
  const nw = $('nadeWarn');
  if (nd && e.alive) {
    const dx = nd.p.x - e.pos.x, dz = nd.p.z - e.pos.z;
    const ang = Math.atan2(dx * Math.cos(PL.yaw) - dz * Math.sin(PL.yaw), -dx * Math.sin(PL.yaw) - dz * Math.cos(PL.yaw));
    hudStyle(nw, 'opacity', '1'); hudVar(nw, '--a', ang + 'rad'); hudCls(nw, 'on', true);
  } else { hudStyle(nw, 'opacity', '0'); hudCls(nw, 'on', false); } // le battement ne tourne que visible
  // nom sous le réticule : jamais pour un ennemi (on le reconnaît à l'absence de marqueur) ; pour un allié seulement si les marqueurs
  // d'alliés sont coupés, car sinon son nom est déjà au-dessus de sa tête (09m-marqueurs.js)
  if ((HUD.tagT -= dt) <= 0) {
    HUD.tagT = 0.1; let tag = null;
    if (!Settings.allyMarks && e.alive && !(d.scope && ads > 0.9)) {
      const f = camFwd(_hudV[0]), c = _hudV[1], to = _hudV[2];
      for (const o of entities) {
        if (!o.alive || o === e || !allied(o, e)) continue;
        entChest(o, c); to.subVectors(c, camera.position); const dist = to.length();
        if (dist > 70) continue; to.divideScalar(dist);
        if (to.dot(f) < Math.cos(Math.max(0.02, 0.5 / dist))) continue;
        if (!lineClear(camera.position, c)) continue;
        tag = o; break;
      }
    }
    const nt = $('nameTag');
    if (tag) { hudText(nt, tag.name); nt.className = 'nametag show ally'; }
    else if (nt.className !== 'nametag') nt.className = 'nametag';
  }
  if (HUD.msgT > 0) { HUD.msgT -= dt; if (HUD.msgT <= 0) $('msg').classList.remove('show'); }
  if (HUD.board && (HUD.boardT -= dt) <= 0) fillScoreboard(); // quatre fois par seconde, et le DOM seulement si le tableau a changé
  const hp = $('hp');
  const hpv = Math.max(0, Math.ceil(e.health)); // le chiffre affiché : la santé n'apparaît que sous 100
  hudStyle(hp, 'opacity', e.alive && hpv < 100 ? '1' : '0');
  hudStyle($('hpFill'), 'transform', `scaleX(${clamp(e.health / 100, 0, 1)})`);
  hudText($('hpN'), hpv); hudCls(hp, 'crit', hpv <= 35);
}
function showScoreboard(on) { HUD.board = on && MATCH.state !== 'ended'; $('board').classList.toggle('show', !!HUD.board); if (on) fillScoreboard(); }
const boardName = (x) => (x.isPlayer && MATCH.online ? NET.nick : x.name) + (MATCH.online && (x.netBot || x.remoteBot) ? ' ' + _t('(bot)') : '');
/* Joueurs d'une équipe, du meilleur au moins bon (en ligne : seulement ceux qui participent) */
const boardCmp = (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths;
function boardList(t) { return entities.filter((x) => x.team === t && (!MATCH.online || x.isPlayer || x.isRemote || x.netBot)).sort(boardCmp); }
/* Tableau des scores (Tab, Retour, bouton au doigt) : un panneau par équipe, en-tête (nom, score), colonnes en chiffres tabulaires ; ma ligne marquée
   (trait jaune et gras), les morts estompés. Récrit quatre fois par seconde au plus (updateHud), et seulement si son contenu a changé (hudHtml) */
function fillScoreboard() {
  HUD.boardT = 0.25;
  const ffa = MATCH.mode === 'ffa'; hudCls($('board'), 'one', ffa);
  const head = `<thead><tr><th>${_t('Nom')}</th><th>${_t('Score')}</th><th>${_t('Élim.')}</th><th>${_t('Morts')}</th><th>${_t('Aides')}</th></tr></thead>`;
  const row = (x) => `<tr class="${x.isPlayer ? 'me' : ''}${x.alive ? '' : ' dead'}"><td>${esc(boardName(x))}</td><td>${x.score}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${x.assists}</td></tr>`;
  if (ffa) { // un seul classement, tous les soldats
    hudHtml($('board0'), `<caption class="ally"><span>${_t('Classement, premier à {0}', MATCH.limit)}</span></caption>${head}<tbody>${ffaList().sort(ffaCmp).map(row).join('')}</tbody>`);
    return;
  }
  for (const t of [0, 1]) { // mon équipe à gauche, comme le score en haut de l'écran
    const team = t === 0 ? PL.ent.team : 1 - PL.ent.team, mine = team === PL.ent.team;
    hudHtml($('board' + t), `<caption class="${mine ? 'ally' : 'enemy'}"><span>${TEAM_NAMES[team]}${mine ? ` <em>${_t('Vous')}</em>` : ''}</span><b>${MATCH.score[team]}</b></caption>${head}<tbody>${boardList(team).map(row).join('')}</tbody>`);
  }
}

/* ---------- Écran de résultats : classement des deux équipes, affiché quelques secondes après la killcam finale ---------- */
const END = { t: 0, shown: -1 };
const END_SECONDS = 15;
const ordinal = (n) => (LANG === 'en' ? n + ((n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10]) || 'th') : n === 1 ? '1er' : n + 'e');
/* Tableaux de l'écran de résultats : mon équipe à gauche (comme le score et le tableau en partie), rang, nom (MVP), score, éliminations, morts,
   ratio, aides ; ma ligne marquée (trait jaune et gras) */
const endHead = () => `<thead><tr><th>#</th><th>${_t('Nom')}</th><th>${_t('Score')}</th><th>${_t('Élim.')}</th><th>${_t('Morts')}</th><th>${_t('Ratio')}</th><th>${_t('Aides')}</th></tr></thead>`;
function endRow(x, k, mvp) {
  const ratio = (x.deaths ? x.kills / x.deaths : x.kills).toFixed(2);
  return `<tr class="${x.isPlayer ? 'me' : ''}"><td>${k + 1}</td><td><span>${esc(boardName(x))}</span>${x === mvp ? ` <em class="mvp">MVP</em>` : ''}</td><td>${x.score}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${ratio}</td><td>${x.assists}</td></tr>`;
}
function fillEnd() {
  if (MATCH.mode === 'ffa') return fillEndFfa();
  const me = PL.ent, all = [0, 1].flatMap(boardList).sort(boardCmp), mvp = all[0], rank = all.indexOf(me) + 1;
  [me.team, 1 - me.team].forEach((t, i) => {
    const mine = t === me.team, win = MATCH.winner === t;
    $('endC' + i).className = 'eb-cap ' + (mine ? 'ally' : 'enemy');
    $('endC' + i).innerHTML = `<span><span>${TEAM_NAMES[t]}</span>${mine ? ` <em class="you">${_t('Vous')}</em>` : ''}${win ? ` <em class="win">${_t('Vainqueur')}</em>` : ''}</span><b>${MATCH.score[t]}</b>`;
    $('endT' + i).innerHTML = `${endHead()}<tbody>${boardList(t).map((x, k) => endRow(x, k, mvp)).join('')}</tbody>`;
  });
  return { rank, total: all.length };
}
/* Match à mort : un seul classement (colonne de gauche), la seconde n'existe pas */
function fillEndFfa() {
  const me = PL.ent, all = ffaList().sort(ffaCmp), mvp = all[0];
  $('endC0').className = 'eb-cap ally';
  $('endC0').innerHTML = `<span><span>${_t('Classement')}</span> <em class="win">${_t('Vainqueur : {0}', esc(boardName(mvp)))}</em></span><b>${mvp.kills}</b>`;
  $('endT0').innerHTML = `${endHead()}<tbody>${all.map((x, k) => endRow(x, k, mvp)).join('')}</tbody>`;
  return { rank: all.indexOf(me) + 1, total: all.length };
}
/* Bloc XP de l'écran de résultats (#endXp, écrit par acctMatchEnd, 09j-compte.js) : insigne du niveau, gain de la partie, barre vers le niveau
   suivant (elle se remplit depuis l'XP d'avant la partie), progression en clair ; o : { xp, level, into, need, up, notes } */
function endXpHtml(o) {
  const x1 = o.need ? clamp(o.into / o.need, 0, 1) : 1, x0 = o.up || !o.need ? 0 : clamp((o.into - o.xp) / o.need, 0, 1);
  const notes = (o.notes || []).filter(Boolean).map((n) => `<span>${n}</span>`).join('');
  return `<div class="ex-badge"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,3 93,26.5 93,73.5 50,97 7,73.5 7,26.5"/></svg><b>${o.level}</b></div>
    <div class="ex-main"><p class="ex-top"><b>${_t('+{0} XP', fmtNum(o.xp))}</b>${o.up ? `<em>${_t('Niveau {0} !', o.level)}</em>` : ''}</p>
      <div class="ex-bar" style="--x0:${x0.toFixed(3)};--x1:${x1.toFixed(3)}"><i></i></div>
      <p class="ex-sub"><span>${o.need ? _t('{0} / {1} XP avant le niveau {2}', fmtNum(o.into), fmtNum(o.need), o.level + 1) : _t('Niveau maximal')}</span>${notes}</p></div>`;
}
function updateEnd(dt) {
  END.t -= dt;
  const n = Math.max(0, Math.ceil(END.t));
  if (n !== END.shown) { END.shown = n; $('endTimer').textContent = `${_t('{0} dans {1} s', MATCH.online ? _t('Retour au salon') : _t('Retour au menu'), n)}`; }
  if (END.t <= 0) toMenu(MATCH.online ? undefined : 'solo');
}

/* ---------- Déroulement du match ---------- */
function startMatch(opt = {}) {
  gpuLog('match start');
  initAudio(); setAmbience(true); saveSettings(); applyQuality();
  // résolution dynamique : l'échelle reste la meilleure estimation, mais l'attente avant de remonter (doublée à chaque remontée ratée) repart de zéro
  Object.assign(DYN, { good: 0, slow: 0, need: 4, lastUp: -1e9 }); DYN.win.length = 0;
  if (!opt.online && netInLobby()) netQuit();
  MATCH.online = !!opt.online; if (MATCH.online) hostBgInit(); // hôte en arrière-plan : la partie continue (hostBgTick)
  const want = MATCH.online ? NET.cfg.mode : Settings.mode, mode = !MODES[want] || !CURMAP.def || (want === 'dom' && !CURMAP.def.dom) ? 'tdm' : want; // en ligne, le mode est celui du salon
  MATCH.limit = MATCH.online ? NET.cfg.limit : Settings[MODES[mode].key];
  SMOKES.length = 0; PL.flashT = 0; MATCH.score = [0, 0]; MATCH.time = 0; MATCH.timeLeft = (MATCH.online ? NET.cfg.time : Settings.minutes) * 60; MATCH.uav = [0, 0]; MATCH.uavPing = [null, null]; MATCH.sat = [0, 0]; MATCH.iem = [0, 0]; MATCH.events = []; MATCH.winner = -1;
  for (const n of NADES) scene.remove(n.mesh); NADES.length = 0; clearThrowKnives(); soundEvents.length = 0; clearAircraft(); clearDrops();
  FX.holes.clear(); FX.splats.clear(); FX.scorch.clear(); propsReset();
  for (const e of entities) { e.kills = e.deaths = e.score = e.assists = e.streak = e.comboN = 0; e.comboT = -99; e.alive = false; e.lastShotT = -9; }
  MATCH.state = 'playing'; kcReset(); MATCH.finalPending = null; MATCH.lastKill = null; MATCH.fin = null; MATCH.finSoon = false; finClear(); MATCH.startAt = MATCH.time;
  modeStart(mode);
  // armes des bots selon le type de la carte (07-bots.js) : la première partie après le chargement garde le tirage fait pendant la compilation
  // (mapCompile) ; les suivantes tirent à nouveau, et ce qui manque se construit ici, au déploiement, pas à la première apparition
  if (BOT_ARM.map !== MAPL.id) { botArmForMap(); botArmPrebuild(); }
  BOT_ARM.map = null;
  if (MATCH.online) { PL.ent.team = NET.team; for (const e of entities) if (!e.isPlayer && !e.isRemote) { e.netBot = false; e.alive = false; e.respawnT = Infinity; e.model.root.visible = false; e.model.rag = null; } }
  else { PL.ent.team = 0; for (const e of entities) if (!e.isPlayer && !e.off) spawnEntity(e); }
  spawnEntity(PL.ent);
  soldierLookAll(); // alliés en clair, ennemis en sombre, d'après l'équipe du joueur (en ligne, il peut jouer Bravo)
  // mon camp (classe a : à gauche du chrono, en vert) et l'adverse (b : à droite, en rouge) ; en ligne, on peut jouer Bravo. En match à mort, la première
  // ligne est toujours la mienne (« Vous »), quelle que soit l'équipe d'origine
  const mine = MATCH.mode === 'ffa' ? 0 : PL.ent.team;
  document.querySelectorAll('.score .row').forEach((r, t) => { r.classList.toggle('a', t === mine); r.classList.toggle('b', t !== mine); });
  HUD.rkT = 0;
  PL.held = false; PL.queued = false; PL.adsWant = false; PL.noFireT = performance.now() + 450; // aucun tir avant que le joueur ait relâché et rappuyé
  PL.yaw = PL.ent.yaw; PL.pitch = 0; PL.shots = 0; PL.hits = 0; PL.bestStreak = 0; PL.ks = {}; PL.dmgInd = []; PL.crouchToggle = false; CHAIN.n = 0; CHAIN.t = -99; HUD.chain = 0;
  FinalShader.uniforms.uDamage.value = 0; FinalShader.uniforms.uDesat.value = 0; FinalShader.uniforms.uHurt.value = 0;
  giveLoadout(); updateStreakHud(); hideDeathScreen();
  VM.root.visible = true; VM.holder.visible = true;
  uiHide(); $('end').classList.remove('show'); $('pause').classList.remove('show'); $('hud').classList.remove('hidden');
  HUD.lastAmmo = '';
  // le passage en plein écran (demandé au clic de déploiement) fait refuser une capture demandée pendant la transition : on l'attend
  if (LOCK.fsPending) { const fs = LOCK.fsPending; LOCK.fsPending = null; LOCK.quiet = true; fs.then(() => setTimeout(() => { if (MATCH.state === 'playing') requestLock(); }, 80)); }
  else requestLock();
  hudText($('scLim'), MATCH.mode === 'dom' ? _t('Premier à {0} points', MATCH.limit) : _t('Premier à {0}', MATCH.limit));
  PL.hsKills = 0; arsSessionReset(); acctMatchStart(); // jeton de partie du compte (09j-compte.js)
  skinTrim(); // tenues de défi que personne ne porte : libérées (09u-tenues.js)
  pfrStart(); // enregistreur de performances, avec « Afficher les performances » (09zo-perfs.js)
  cdStart(); // « La partie commence dans 10 » : personne ne bouge avant le départ (09y-decompte.js)
}
function endMatch() {
  if (MATCH.state === 'ended') return;
  pfrStop(); showLockPrompt(false);
  if (KC.active) { KC.active = false; $('killcam').classList.remove('show'); KC.body.root.visible = false; }
  MATCH.state = 'ended'; arsShowClear(); cdClear();
  const me = PL.ent, o = MATCH.fin ? MATCH.fin.out : matchOutcome(); // figé par l'annonce : les deux disent la même chose
  $('end').classList.toggle('one', MATCH.mode === 'ffa');
  MATCH.winner = o.winner;
  $('endKick').textContent = finKicker(); // ce qui a fini la partie : limite atteinte ou temps écoulé
  $('endTitle').textContent = FIN_TEXT[o.result];
  $('endTitle').className = FIN_CLS[o.result]; $('end').dataset.res = o.result;
  $('endScore').textContent = o.sub;
  $('endMeta').textContent = [mapById(MATCH.online ? NET.cfg.map : Settings.map).name, modeDef().name, MATCH.online ? _t('Match en ligne') : _t('Solo')].join(' · ');
  const acc = PL.shots ? Math.round((PL.hits / PL.shots) * 100) : 0;
  const ratio = me.deaths ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2);
  const R = fillEnd(); defisMatchEnd(o.result, R.rank); arsEndFill(); // défis : rang en match à mort, carte terminée (06s-defis.js)
  END.t = END_SECONDS; END.shown = -1; $('end').style.setProperty('--es', END_SECONDS + 's'); updateEnd(0); // (minuteur écrit tout de suite ; sa barre est en CSS)
  // statistiques personnelles : une tuile par chiffre, le classement en tête
  const st = (v, l, c) => `<div class="st${c ? ' ' + c : ''}"><span>${l}</span><b>${v}</b></div>`;
  $('endStats').innerHTML = st(`${ordinal(R.rank)}<small>/${R.total}</small>`, _t('Classement'), 'hi') + st(me.score, _t('Score')) + st(me.kills, _t('Éliminations')) + st(me.deaths, _t('Morts'))
    + st(ratio, _t('Ratio')) + st(`${acc}<small>%</small>`, _t('Précision')) + st(PL.bestStreak, _t('Meilleure série'));
  $('end').classList.add('show'); $('pause').classList.remove('show'); $('hud').classList.add('hidden'); showScoreboard(false); hideDeathScreen();
  $('againBtn').textContent = MATCH.online ? _t('Retour au salon') : _t('Rejouer');
  $('menuBtn').classList.toggle('hidden', !!MATCH.online);
  if (document.pointerLockElement) document.exitPointerLock();
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false;
  if (MATCH.online) netMatchEnded();
  arsLocalXp(o.result); // sans compte : XP gardée dans le navigateur (06r-arsenal.js)
  acctMatchEnd(o.result, true); // XP et statistiques du compte
}
/* Retour aux menus : l'écran demandé, sinon le salon si on y est encore, sinon le menu principal */
function toMenu(screen) {
  pfrStop(); acctMatchAbandon(); netLeaveMatch(); modeEnd(); arsShowClear();
  if (KC.active) { KC.active = false; $('killcam').classList.remove('show'); KC.body.root.visible = false; }
  kcReset(); MATCH.fin = null; finClear(); cdClear();
  MATCH.state = 'menu'; showLockPrompt(false); setAmbience(false); musicRestart();
  if (document.fullscreenElement && Settings.fsGame && document.exitFullscreen) document.exitFullscreen().catch(() => {}); // les menus gardent Échap (retour) et la sortie du plein écran
  for (const e of entities) { e.alive = false; if (e.model) e.model.root.visible = false; }
  for (const n of NADES) scene.remove(n.mesh); NADES.length = 0; clearThrowKnives(); clearAircraft();
  VM.root.visible = false;
  $('hud').classList.add('hidden'); $('end').classList.remove('show'); $('pause').classList.remove('show');
  hideDeathScreen(); showScoreboard(false);
  if (document.pointerLockElement) document.exitPointerLock();
  const to = screen || (netInLobby() ? 'multi' : 'main');
  uiOpen(to, to === 'main' ? [] : ['main']);
}
function pauseGame() {
  if (MATCH.state !== 'playing') return;
  MATCH.state = 'paused'; LOCK.escArmed = false; LOCK.quiet = false; $('pause').classList.add('show'); showLockPrompt(false);
  // la partie continue derrière le menu (en ligne comme en solo) : les bots jouent, le temps s'écoule
  $('quitBtn').firstElementChild.textContent = !MATCH.online ? _t('Quitter le match') : NET.role === 'host' ? _t('Terminer la partie') : _t('Retour au salon');
  chatClose(); laneSuspend(); // une annonce du couloir reprendra à la reprise (09s-rankup.js)
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false;
  pmOpen();
}
function resumeGame() {
  if (MATCH.state !== 'paused') return;
  MATCH.state = 'playing'; $('pause').classList.remove('show');
  LOCK.resumeT = performance.now(); LOCK.quiet = true; // reprise : pas d'invite, la première touche ou le premier clic redonne la souris
  requestLock(); lanePump(); trackpadNote(); // la détection a basculé souris ou pavé pendant la pause (09qe-pavetactile.js)
  // arme équipée pendant la pause : elle sort maintenant, devant le joueur (voir giveLoadout)
  if (PL.pendingDraw) { PL.pendingDraw = false; VM.raiseRate = 7; VM.lowerTarget = 0; sfxMech('draw'); VM.rec.vy += 0.5; VM.rec.vrx -= 0.9; VM.rec.vz += 0.15; }
  if (Settings.loadout !== PL.classIdx && PL.ent.alive) hudMsg(`${_t('{0} : équipée à votre prochaine réapparition', CLASSES[Settings.loadout].name)}`, 'xp', 3);
}
/* Plein écran et verrou du clavier : en plein écran, Chrome livre Échap à la page au lieu de défaire lui-même la capture de la souris.
   Le jeu se met alors en pause en rendant lui-même la capture, et la reprend sans clic (le navigateur n'exige un geste que
   lorsque c'est lui, par Échap, qui l'a défaite). Sans plein écran ni verrou du clavier, la reprise demande un clic. */
function enterGameFullscreen() {
  if (TOUCH.on) { touchFullscreen(); return; } // téléphone : plein écran et paysage (09q-tactile.js)
  if (!Settings.fsGame || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  try { LOCK.fsPending = document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignoré */ }
}
function syncKeyboardLock() {
  const kb = navigator.keyboard;
  if (!kb || !kb.lock) return;
  if (document.fullscreenElement) kb.lock([...bindCodes(), ...closeKeyCodes()]).then(() => { LOCK.kbLock = true; }).catch(() => { LOCK.kbLock = false; });
  else { LOCK.kbLock = false; try { kb.unlock(); } catch (e) { /* ignoré */ } }
}
document.addEventListener('fullscreenchange', syncKeyboardLock);
/* Ctrl+W (fermer l'onglet) tombe facilement en jouant : Ctrl s'accroupit, W avance en QWERTY. Aucun navigateur ne laisse une page l'intercepter,
   sauf en plein écran avec le verrou du clavier : la touche qui donne W dans la disposition du joueur (KeyW en QWERTY, KeyZ en AZERTY) est
   alors verrouillée elle aussi, Ctrl+W arrive à la page, qui l'ignore (closeKeyBlock). Hors plein écran (le cas par défaut sur ordinateur),
   le navigateur demande confirmation avant de fermer ou de recharger la page pendant une partie (sa propre fenêtre, texte imposé). Les
   rechargements voulus par le jeu passent (PAGE_LEAVE). */
function closeKeyCodes() {
  const L = BIND.layout, out = ['KeyW', 'KeyZ'];
  if (L) for (const [code, ch] of L) if (ch === 'w' && !out.includes(code)) out.push(code);
  return out;
}
function closeKeyBlock(e) {
  if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'w' && (MATCH.state === 'playing' || MATCH.state === 'paused')) e.preventDefault();
}
addEventListener('keydown', closeKeyBlock, true);
addEventListener('beforeunload', (e) => {
  if (PAGE_LEAVE.ok || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  e.preventDefault(); e.returnValue = ''; // (returnValue : Chrome et Safari plus anciens)
});
/* Capture de la souris. Le navigateur ne l'accorde qu'en réponse à un geste de l'utilisateur :
   une partie lancée par un message réseau (invités d'un salon) ou un « Reprendre » cliqué trop vite
   après Échap est refusée sans que la capture soit impossible pour autant. On affiche alors
   « Cliquez pour jouer » ; la visée au curseur (sans capture) ne sert que si la capture échoue
   deux fois de suite malgré un clic, par exemple dans un cadre isolé qui l'interdit. */
function userGesture() {
  const ua = navigator.userActivation;
  return ua ? ua.isActive : performance.now() - LOCK.inputT < 1500;
}
addEventListener('pointerdown', () => { LOCK.inputT = performance.now(); }, true);
addEventListener('keydown', () => { LOCK.inputT = performance.now(); }, true);
function showLockPrompt(on) { $('lockPrompt').classList.toggle('show', on && MATCH.state === 'playing' && !LOCK.fallback); }
/* manual : la demande suit un clic sur « Cliquez pour jouer » ou sur la scène. Seuls ces refus-là comptent vers la visée au
   curseur : reprendre avec Échap est refusé par le navigateur un instant après la sortie de la capture (ni geste, ni délai
   écoulé), ce qui ne veut pas dire que la capture est impossible. */
function requestLock(manual = false) {
  if (TOUCH.on || PAD.drive) return;
  if (LOCK.fallback || document.pointerLockElement === canvas) return;
  // après une sortie demandée par la page (pause par Échap en plein écran), le navigateur redonne la capture sans geste
  if (!LOCK.scriptExit && !userGesture()) { if (!LOCK.quiet) showLockPrompt(true); return; }
  LOCK.pending = true; LOCK.manual = manual;
  lockAsk();
}
/* Capture du pointeur en mouvement brut (unadjustedMovement) : sans l'accélération ni le lissage du système (« Améliorer la précision du pointeur »
   de Windows, accélération de macOS), la caméra suit la main au même pas quelle que soit la vitesse, et ne change pas d'un poste à l'autre. Un
   navigateur qui ne le prend pas en charge (Linux, versions anciennes) refuse avec NotSupportedError : on redemande alors la capture ordinaire,
   et l'on s'en souvient (LOCK.rawNo). */
function lockAsk() {
  try {
    const p = LOCK.rawNo ? canvas.requestPointerLock() : canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch((err) => { if (!LOCK.rawNo && err && err.name === 'NotSupportedError') { LOCK.rawNo = true; lockAsk(); } else lockFailed(); });
  } catch (e) { if (!LOCK.rawNo) { LOCK.rawNo = true; lockAsk(); } else lockFailed(); }
}
function lockFailed() {
  // la promesse rejetée et l'événement pointerlockerror signalent le même refus : on ne le compte qu'une fois
  if (!LOCK.pending || document.pointerLockElement === canvas) return;
  LOCK.pending = false;
  if (!LOCK.manual) {
    // refus automatique (reprise avec Échap) : l'invite s'affiche, et une nouvelle tentative suit quand le délai du navigateur est passé
    if (!LOCK.quiet) showLockPrompt(true);
    setTimeout(() => { if (MATCH.state === 'playing' && !pointerActive()) requestLock(); }, 1400);
    return;
  }
  if (++LOCK.fails < 2) { showLockPrompt(true); return; }
  LOCK.fallback = true; showLockPrompt(false);
  $('lockNote').classList.add('show');
  setTimeout(() => $('lockNote').classList.remove('show'), 7000);
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { LOCK.pending = false; LOCK.fails = 0; LOCK.quiet = false; LOCK.scriptExit = false; showLockPrompt(false); PL.noFireT = Math.max(PL.noFireT, performance.now() + 300); return; }
  if (MATCH.state !== 'playing' || LOCK.fallback) return;
  // capture perdue à l'instant d'une reprise : le navigateur a défait la capture demandée, ce n'est pas un Échap du joueur
  if (performance.now() - LOCK.resumeT < 500) return;
  pauseGame();
});
document.addEventListener('pointerlockerror', lockFailed);
$('lockPrompt').addEventListener('click', () => { LOCK.inputT = performance.now(); requestLock(true); });
// « Cliquez pour jouer » : une touche (hors Échap, qui ne compte pas comme un geste) redonne aussi la capture
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' && MATCH.state === 'playing' && ($('lockPrompt').classList.contains('show') || LOCK.quiet) && !pointerActive()) { LOCK.inputT = performance.now(); requestLock(true); }
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && MATCH.state === 'playing') { if (document.pointerLockElement) { LOCK.scriptExit = true; document.exitPointerLock(); } else pauseGame(); }
});
document.addEventListener('mousemove', (e) => {
  if (!KS.map.open || document.pointerLockElement || (TOUCH.on && performance.now() - TOUCH.lastT < 800)) return; // (la souris que le navigateur simule après un toucher ne compte pas)
  const r = $('tacCanvas').getBoundingClientRect(); if (!r.width) return;
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; // curseur libre hors de la carte : le point ne bouge pas (il filait au bord)
  KS.map.x = clamp(MAP.x0 + ((e.clientX - r.left) / r.width) * (MAP.x1 - MAP.x0), MAP.x0 + 1, MAP.x1 - 1);
  KS.map.z = clamp(MAP.z0 + ((e.clientY - r.top) / r.height) * (MAP.z1 - MAP.z0), MAP.z0 + 1, MAP.z1 - 1);
});
canvas.addEventListener('click', () => { if (MATCH.state === 'playing' && !pointerActive()) requestLock(true); });

/* ---------- Menu ---------- */
let menuT = 0; // temps de la caméra aérienne du choix de classe
function buildMenu() { menuInit(); } // écrans, options, classes : voir 09e-menus.js

/* Une mise à jour des matrices par image : composer.render appelle renderer.render une quinzaine de fois (pré-passe, monde, arme, halo...) et chaque appel
   à la scène reparcourait tous ses objets (matrixWorldAutoUpdate), soit 1,7 parcours de quelque 900 objets par image. On les met à jour une fois, ici,
   après tous les déplacements de l'image, puis on coupe la mise à jour automatique le temps du rendu. */
function renderFrame(dt) {
  scene.updateMatrixWorld(); vmScene.updateMatrixWorld();
  scene.matrixWorldAutoUpdate = false; vmScene.matrixWorldAutoUpdate = false;
  try { composer.render(dt); } finally { scene.matrixWorldAutoUpdate = true; vmScene.matrixWorldAutoUpdate = true; }
}
/* Mise à jour des bots. À cadence haute (HF.k > 1, voir 01-core.js), chaque bot n'est mis à jour qu'une image sur k, en alternance (le coût est réparti
   sur les images et non groupé), avec le temps écoulé depuis sa dernière mise à jour : l'intelligence, le déplacement, la visée et l'animation d'un
   bot tournent alors à 120 Hz sur un écran de 240 Hz, ce que rien ne distingue de 240. */
function botsTick(dt, t) {
  const k = HF.k;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]; if (e.isPlayer) continue;
    e.hfDt = (e.hfDt || 0) + dt; // (les joueurs distants, créés ailleurs, n'ont pas le champ)
    if (k > 1 && (frameN + i) % k !== 0) continue;
    const d = e.hfDt; e.hfDt = 0; updateBot(e, d, t);
  }
}
/* Une image de partie (en jeu, en pause en ligne, annonce du résultat) : le temps, les règles, le joueur, les bots, les projectiles, le réseau ;
   renvoie le pas de temps (ralenti pendant l'annonce du résultat). bg : simulation seule, onglet de l'hôte en arrière-plan (hostBgTick) ;
   ni carte tactique, ni HUD, ni enregistrement de la killcam */
function matchTick(dt, bg) {
  const fin = MATCH.state === 'finish';
  if (fin) dt *= finTick(); // annonce du résultat : le jeu continue derrière, en ralenti (09l-fin.js)
  cdTick(); const hold = playHold(); // décompte du départ, migration de l'hôte : le chrono ne tourne pas, ni les points ni le score (09y-decompte.js)
  MATCH.time += dt; if (!fin && !hold) MATCH.timeLeft -= dt;
  const t = MATCH.time;
  for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= t) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); }
  uavTick(dt);
  if (!fin && !hold) modeUpdate(dt);
  pfrLap(3); updatePlayer(dt, t); pfrLap(0); // pfrLap : étapes de l'enregistreur de performances (09zo-perfs.js)
  botsTick(dt, t); pfrLap(1);
  updateNades(dt); updateThrowKnives(dt); updateSmokes(dt); updateDrops(dt); updateProps(dt); pfrLap(2);
  updateKillstreak(dt); updateAircraft(dt);
  if (!bg) { drawTacMap(); if (ESSAI || ESSAI_MECHA) essaiTick(dt); updateHud(dt); }
  if (!fin && MATCH.timeLeft <= 0) matchFinish();
  if (!bg && !(KC.active && KC.live)) kcRecord(); // relecture en ligne : tampon figé
  netUpdate(dt);
  return dt;
}
/* Hôte d'une partie en ligne dont l'onglet passe en arrière-plan (autre onglet, autre fenêtre, écran éteint) : le navigateur n'appelle plus
   requestAnimationFrame, et la partie s'arrêtait chez lui ; ses bots, qu'il est seul à faire jouer, restaient figés chez tous les joueurs
   jusqu'à son retour (signalé par un joueur : « en début de partie, les bots sont AFK »). Un petit worker donne alors le rythme (20 fois par
   seconde : ses messages ne sont pas bridés comme les minuteries d'un onglet caché) et l'hôte fait tourner la partie, sans rien dessiner.
   Un téléphone qui suspend le navigateur arrête tout : la migration de l'hôte prend alors le relais (09c-net.js). */
const HOSTBG = { wk: null, last: 0 };
function hostBgInit() {
  if (HOSTBG.wk) return;
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(function () { postMessage(0); }, 50);'], { type: 'text/javascript' }));
    HOSTBG.wk = new Worker(url);
    HOSTBG.wk.onmessage = hostBgTick;
  } catch (e) { HOSTBG.wk = null; } // pas de worker : comme avant, la partie s'arrête avec l'onglet
}
function hostBgTick() {
  const now = performance.now(), dt = clamp((now - (HOSTBG.last || now)) / 1000, 0, 0.1); HOSTBG.last = now;
  if (!document.hidden || !MATCH.online || !NET.on || NET.role !== 'host') return;
  if (MATCH.state !== 'playing' && MATCH.state !== 'paused' && MATCH.state !== 'finish') return;
  const fin = MATCH.state === 'finish';
  matchTick(dt, true);
  if (fin && MATCH.fin && MATCH.fin.t >= FIN_LEN) finDone();
}
/* ---------- Boucle ---------- */
let lastT = performance.now(), frameN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (GPUX.halt) return; // contexte WebGL perdu en partie : plus rien à dessiner, la fenêtre « Affichage 3D interrompu » propose de relancer (01a-gpu.js)
  vsyncTrack(now); if (capWait(now)) return; // limite de cadence, économie d'énergie (01-core.js)
  if (LAG.on && MATCH.state === 'playing' && lagSkip()) return; // le GPU n'a pas fini l'image précédente : on n'allonge pas la file, la souris sera lue à la prochaine (01-core.js)
  capTake(now);
  if (TOUCH.on) touchTick();
  const t0 = performance.now(), interval = now - lastT;
  // pas de temps jamais négatif (horodatage d'image antérieur au précédent) : les lissages exponentiels divergeraient
  let dt = clamp(interval / 1000, 0, 0.05); lastT = now;
  if (PAD.seen) padTick(dt); // manette (09qc-manette.js)
  // menus : scène 3D non rendue, sauf au choix de la classe (vue aérienne de la carte) ; le fond animé (09w-fond.js) remplace l'image CSS (#menuBg) une fois prêt
  musicTick(dt); sfxTick(dt);
  CAMO_U.uCamoT.value = now / 1000; CAMO_U.uHoloFx.value = RQ.q.lean ? 0 : 1; // le Holo dérive aussi dans la vitrine de l'atelier ; ses paillettes, pas en qualité Basse (06q-camos.js)
  const aerial = MATCH.state === 'menu' && UI.screen === 'deploy';
  if (MATCH.state === 'menu' && !aerial) { menuBgShow(true); if (UI.screen === 'arsenal' && ARSUI.tab !== 'k') vwTick(dt); else if (UI.screen === 'skins') skinTick(); const drew = mbgDraw(dt); if (UI.screen === 'skins') skinLive(drew, dt); return; } // l'atelier de classe dessine l'arme dans son cadre (09o-vitrine.js), puis le fond animé (09w-fond.js), et par-dessus, l'écran Tenues son soldat animé (09u-tenues.js)
  menuBgShow(false);
  renderer.info.reset();
  if (PFR.on) { PFR.inFrame = true; PFR.lt = performance.now(); } // enregistreur de performances (09zo-perfs.js)
  // objets créés en cours de partie (armes ramassées, projectiles) : admis dans la pré-passe au plus tard une seconde après
  if (++frameN % 60 === 0) markPrepass(scene);
  const U = FinalShader.uniforms;
  if (aerial) {
    menuT += dt;
    const a = menuT * 0.035 + 0.6, r = CURMAP.def ? CURMAP.def.cam : 46;
    camera.position.set(Math.sin(a) * r * 0.75, 17 + Math.sin(menuT * 0.1) * 3, Math.cos(a) * r);
    camera.lookAt(0, 2, 0);
    if (Math.abs(camera.fov - Settings.fov) > 0.01) { camera.fov = Settings.fov; camera.updateProjectionMatrix(); }
    U.uDamage.value = 0; U.uHurt.value = 0; U.uDesat.value = 0.05;
  } else if (MATCH.state === 'playing' || MATCH.state === 'paused' || MATCH.state === 'finish') {
    const fin = MATCH.state === 'finish';
    dt = matchTick(dt, false); pfrLap(3);
    U.uDamage.value = Math.max(0, U.uDamage.value - dt * 0.9);
    const hurt = PL.ent.alive ? clamp(1 - PL.ent.health / 100, 0, 1) : 0.85;
    U.uHurt.value = damp(U.uHurt.value, hurt, hurt > U.uHurt.value ? 14 : 2.2, dt);
    U.uDesat.value = damp(U.uDesat.value, fin ? (MATCH.fin.out.result === 'loss' ? 0.55 : MATCH.fin.out.result === 'win' ? 0.12 : 0.3) : PL.ent.alive ? 0 : 0.85, 3, dt);
    if (KC.active && KC.live) { updateKillcam(dt); U.uDesat.value = damp(U.uDesat.value, 0.35, 3, dt); U.uHurt.value = damp(U.uHurt.value, 0, 3, dt); U.uDamage.value = 0; } // killcam de mort en ligne : la partie continue derrière
    if (fin && MATCH.fin.t >= FIN_LEN) finDone(); // la suite (killcam finale ou résultats) change l'état : en toute fin d'image
  } else if (MATCH.state === 'killcam') {
    netUpdate(dt);
    updateKillcam(dt);
    U.uDesat.value = damp(U.uDesat.value, 0.35, 3, dt); U.uHurt.value = damp(U.uHurt.value, 0, 3, dt); U.uDamage.value = 0;
  } else if (MATCH.state === 'ended') {
    for (const e of entities) if (!e.isPlayer && !e.alive) animSoldier(e, dt);
    updateEnd(dt); if (MATCH.state !== 'ended') return;
    updateAircraft(dt); if (KS.map.open) ksCloseMap();
    const a = performance.now() * 0.00005;
    const r = (CURMAP.def ? CURMAP.def.cam : 46) * 0.65; camera.position.set(Math.sin(a) * r, 22, Math.cos(a) * r); camera.lookAt(0, 2, 0);
    VM.root.visible = false; U.uDesat.value = damp(U.uDesat.value, 0.3, 2, dt); U.uHurt.value = damp(U.uHurt.value, 0, 3, dt); PL.ent.model.root.visible = false;
  }
  U.uFlash.value = Math.max(0, U.uFlash.value - dt * 1.4);
  flashTick(dt); smokeView(); // aveuglé par une flash, dans un nuage de fumée (07-bots.js)
  U.uTime.value = now / 1000; CLOTH_U.uClT.value = now / 1000; WIND_U.uWnT.value = now / 1000; // tissus et flore au vent (02mc-tissus.js, 02md-vent.js)
  skyMat.uniforms.uTime.value = now / 1000; mapUpdate(now / 1000, dt); updatePostFx();
  sky.position.copy(camera.position);
  updateFx(dt); updateFlashLights(dt);
  updateListener();
  allyMarksUpdate(); // marqueurs d'alliés (09m-marqueurs.js) : la caméra est définitive
  updateSoldierLods(); clothUpdate(dt); updateMapDetail(); grassUpdate(now / 1000); // clothUpdate : tissus des soldats (06gb-tissu.js), après le choix des modèles détaillés
  pfrLap(4); updateShadows(); pfrLap(5);
  if (GPUT) GPUT.begin();
  renderFrame(dt); pfrLap(6);
  if (GPUT) GPUT.end();
  lagMark();
  gpuFrame(now);
  updateDynRes(now, interval, performance.now() - t0);
  if (PFR.on) pfrFrame(now, interval, performance.now() - t0);
  if (Settings.perf) updatePerfHud();
}
/* Indicateur de performances (réglage « Afficher les performances ») */
let perfT = 0;
function updatePerfHud() {
  const t = performance.now(); if (t - perfT < 250) return; perfT = t;
  const el = $('perf'), i = renderer.info.render, st = dynStat();
  el.textContent = `${_t('{0} i/s', Math.round(st.fps))} · ${st.ms.toFixed(1)} ms · ${_t('pire {0} ms (CPU {1})', st.worst.toFixed(1), st.worstC.toFixed(1))} · CPU ${DYN.cpu.toFixed(1)} ms${DYN.gpu ? ' · GPU ' + DYN.gpu.toFixed(1) + ' ms' : ''}\n` +
    `${RQ.q.label}${QUALITY[gfxSet('quality')] ? '' : ' ' + _t('(auto)')}${LAG.on ? ' · ' + _t('file courte') : ''}${LAG.n ? ' · ' + _tn(LAG.n, '{0} image sautée', '{0} images sautées') : ''} · ${_t('rendu {0} %', Math.round(renderPixelRatio() / canvasPixelRatio() * 100))} · ${_t('{0} appels', i.calls)} · ${_t('{0} k triangles', Math.round(i.triangles / 1000))}`;
}

/* Rendu complet pendant le chargement : compile aussi ce que renderer.compile ne voit pas (variantes de la
   pré-passe, ombres des corps animés, rayons du soleil), sinon compilé au premier affichage d'une partie. */
function warmupRender() {
  const saved = [], U = FinalShader.uniforms, sun = U.uSunOn.value;
  for (const M of [...entities.map((e) => e.model), KC.body]) {
    if (!M || !M.lod) continue;
    saved.push([M.root, M.root.visible, M.root.frustumCulled, M.root.layers.mask]); M.root.visible = true;
    // les deux niveaux de détail du corps et de l'arme, affichés ensemble le temps de compiler leurs variantes
    for (const m of [M.lod.hi, M.lod.lo, ...(M.gun ? M.gun.children : [])]) if (m) {
      saved.push([m, m.visible, m.frustumCulled, m.layers.mask]);
      m.frustumCulled = false; m.visible = true; m.layers.mask = MASK_SCREEN;
    }
  }
  U.uSunOn.value = 1;
  for (const lit of RQ.q.lights > 0 ? [true, false] : [false]) {
    setFlashLightsVisible(lit); updateShadows();
    for (const l of csm.lights) l.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true; renderer.info.reset(); composer.render(0);
  }
  for (const [m, v, fc, mask] of saved.reverse()) { m.visible = v; m.frustumCulled = fc; m.layers.mask = mask; }
  U.uSunOn.value = sun; setFlashLightsVisible(false);
}
/* Préchauffage des ombres : le programme de profondeur d'une matière dépend de son côté (une face avant projette son ombre par sa face
   arrière, une matière double face des deux) et n'est compilé qu'au premier passage d'un de ses objets dans une cascade. warmupRender ne voit
   que les cascades autour de la caméra de chargement : les autres se compilaient en pleine partie (sonde d'octobre 2026 : une toile de
   Khamsin, le seau du puits de Simoun, les canots de Kervénec, de 13 à 32 ms d'un coup). Un triangle minuscule par matière qui projette une
   ombre (instancié si l'objet l'est), sans culling, rendu avec ses ombres par la chaîne d'images du jeu (composer.render : un rendu direct ne
   donnait pas les mêmes variantes), avec et sans éclairs de tir (three.js compte les lumières jusque dans la clé d'un programme de
   profondeur), le reste de la scène masqué : les programmes sont prêts, presque rien n'est dessiné (sûr sur téléphone). Les cascades sont
   redessinées à l'image suivante.
   Chaque matière reçoit d'abord sa propre matière de profondeur (depthOwn) : three.js en partageait une seule entre tous les objets, en lui
   recopiant le côté et la texture de l'objet sans le signaler ; le programme retenu dépendait alors de l'ordre de dessin, et une variante
   jamais tirée au chargement se compilait en pleine partie. */
const DEPTH_OWN = new Map();
function depthOwn(m) {
  let d = DEPTH_OWN.get(m);
  if (!d) { d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); d.uuid = 'depth-' + m.uuid; DEPTH_OWN.set(m, d); }
  return d;
}
function shadowWarm() {
  if (!csm || !renderer.shadowMap.enabled) return;
  const seen = new Map();
  scene.traverse((o) => {
    if (!o.castShadow || !o.material || !o.isMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (!o.customDepthMaterial) o.customDepthMaterial = depthOwn(o.material);
    const m = o.material, k = m.uuid + (o.isInstancedMesh ? '|i' : '');
    if (!seen.has(k)) seen.set(k, [m, o.isInstancedMesh, o.customDepthMaterial]);
  });
  const geo = new THREE.BufferGeometry(), tmp = new THREE.Group();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.001, 0, 0, 0, 0.001, 0], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  for (const [m, inst, cd] of seen.values()) {
    const d = inst ? new THREE.InstancedMesh(geo, m, 1) : new THREE.Mesh(geo, m);
    if (inst) d.setMatrixAt(0, new THREE.Matrix4());
    d.castShadow = true; d.frustumCulled = false; if (cd) d.customDepthMaterial = cd;
    d.position.copy(camera.position); tmp.add(d);
  }
  const vis = scene.children.map((c) => c.visible), sm = renderer.shadowMap;
  scene.children.forEach((c) => { if (!c.isLight) c.visible = false; });
  scene.add(tmp); scene.updateMatrixWorld(true);
  try {
    for (const lit of RQ.q.lights > 0 ? [true, false] : [false]) {
      setFlashLightsVisible(lit); updateShadows();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
      sm.needsUpdate = true; composer.render(0);
    }
  } finally {
    scene.remove(tmp); setFlashLightsVisible(false);
    scene.children.forEach((c, i) => { c.visible = vis[i]; });
    for (const l of csm.lights) l.shadow.needsUpdate = true; // les cartes ne montrent que les triangles : redessinées à la prochaine image
    sm.needsUpdate = true;
    for (const d of tmp.children) if (d.isInstancedMesh) d.dispose();
    geo.dispose();
  }
}

/* ---------- Chargement ---------- */
const BOOT_T = [];
/* Démarrage : le socle commun à toutes les cartes, puis le menu. Les cartes sont chargées au lancement d'une partie
   (09a-loading.js). */
async function boot() {
  // durée de chaque étape (ms), consultable dans la console : BOOT_T
  let tStep = performance.now(), lastMsg = 'début';
  PRE.booted = true; // le démarrage a commencé (la vérification de 00b-preflight.js ne s'en occupe plus)
  // contexte perdu pendant la fenêtre d'installation et pas encore repris : on l'attend avant de construire quoi que ce soit dessus (01a-gpu.js)
  if (gpuLostNow()) { gpuLog('boot waits for the context'); await gpuRestored(10000); }
  GPUX.booting = true; gpuLog('boot');
  const step = (msg, p) => new Promise((r) => {
    const t = performance.now(); BOOT_T.push([lastMsg, Math.round(t - tStep)]); tStep = t; lastMsg = msg; gpuLog('boot: ' + msg);
    $('loadMsg').textContent = msg; $('loadBar').style.transform = `scaleX(${p / 100})`; setTimeout(r, 20);
  });
  try {
    await step(_t('Préparation des effets'), 5);
    const scan = gearScanLoad(); // scans de tissu des tenues (06e-gear.js), décodés pendant les étapes suivantes
    FXT = buildFxTextures();
    await step(_t('Éclairage de la scène'), 20);
    setupComposer(); buildEnvironment(); initFx();
    // éclairage HDRI de la dernière carte choisie : téléchargé en tâche de fond, attendu par son chargement
    { const h = MAP_DEFS[mapById(Settings.map).id].atmo.hdri; if (h) hdriFetch(h); }
    await step(_t('Préparation des soldats'), 45);
    await scan;
    buildGunTextures(); initViewmodel();
    // armes en main et armes vues de l'extérieur des classes disponibles construites au démarrage (et à chaque retouche d'une classe
    // dans l'atelier) : aucune construction pendant la partie (un changement d'arme la figeait de 8 à 22 ms)
    classFix(); arsenalPrebuild(); setTimeout(thumbsStart, 1500); // vignettes d'armes (09o-vitrine.js), une par tâche
    soldierPrebuild(); // les quatre tenues (06ga-tenues.js), vues par un allié et par un ennemi
    for (let i = 0; i < 5; i++) makeBot(0, i);
    for (let i = 0; i < 6; i++) makeBot(1, i);
    vmEquip(WEAPONS.m4); VM.root.visible = false;
    PL.ent.model = makeSoldier(skinOf(PL.ent), 0, 'm4', { shadowOnly: true }); PL.ent.model.root.visible = false;
    KC.body = makeSoldier(skinOf(PL.ent), 0, 'm4'); KC.body.root.visible = false; KC.bodyEnt = { model: KC.body, pos: new V3(), yaw: 0, alive: false, lastForce: null };
    kcInit();
    setupShadows(); soldierMatsCsm(); nadeWarm(); ksWarm();
    await step(_t('Préparation des menus'), 85);
    buildTabletRig(); buildPhoneRig();
    buildMenu();
    await step(_t('Prêt'), 100);
    GPUX.booted = true; GPUX.booting = false;
    MATCH.state = 'menu';
    $('loading').classList.add('hidden'); uiOpen('main'); newsPopup(); acctArrive(); ecoAsk(); // fenêtre « Quoi de neuf » ; liens reçus par e-mail (09j-compte.js) ; économie d'énergie au doigt (09zl-economie.js)
    if (/[?&]diag\b/.test(location.search)) gpuReport(); // ?diag : rapport graphique (01a-gpu.js)
    setTimeout(gpuResume, 400); // partie solo interrompue par un rechargement automatique (01a-gpu.js)
    requestAnimationFrame(frame);
    netAutoJoin();
  } catch (err) {
    console.error(err);
    $('loadMsg').textContent = _t('Le chargement a échoué : {0}. Rechargez la page ou passez la qualité en Basse.', err.message);
    $('loadFail').classList.remove('hidden'); $('loadSafe').classList.toggle('hidden', GFX_SAFE);
    $('loadSafe').onclick = () => { Settings.gfxSafe = true; Settings.gfxSafeAuto = BUILD; saveSettings(); location.reload(); }; $('loadRep').onclick = () => gpuReport();
  }
}
/* Le démarrage lui-même est lancé par 99-start.js, une fois tous les modules chargés */
