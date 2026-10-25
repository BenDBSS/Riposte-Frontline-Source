/* ==========================================================================
   CONTRÔLES TACTILES : jouer au doigt sur un téléphone ou une tablette (Android surtout), dans le même jeu que sur ordinateur.
   Actifs sur un écran tactile (pointeur grossier, voir COARSE dans 01-core.js) ou à la demande (Options, Jeu, « Contrôles tactiles »).
   - joystick (Options, Joystick) : par défaut flottant, absent de l'écran jusqu'à ce que le pouce gauche touche la moitié gauche : il apparaît alors sous le doigt, y reste
     tant que le doigt glisse (il ne suit pas) et disparaît au relâchement ; ou fixe, à la place réglée dans la disposition (saisi près de son cercle). L'analogique va de
     la marche lente à la pleine vitesse, et la course se lance en le poussant au-delà du cercle (anneau en pointillés : comme Call of Duty Mobile ou Delta Force). Au
     choix dans les Options (Course au doigt) : le bouton « Courir » à la place (un appui : on court tant qu'on avance, le doigt levé du joystick l'arrête) ;
   - le doigt qui tire (ou vise) peut aussi glisser pour regarder, sans lâcher le bouton ;
   - disposition modifiable par le joueur (09qb-tactile-layout.js) : boutons déplacés, agrandis, retirés ; enregistrée dans les réglages (Settings.tcLay) ;
   - le pouce droit glisse pour regarder (moitié droite) et appuie sur les boutons : tirer (aussi à gauche ; en tir automatique, réglage par défaut,
     pas de bouton de tir : la visée prend sa place, 09qd-visee.js), viser (deux touchers brefs sur la zone de regard, réglage par défaut, sans bouton
     Viser ; sinon le bouton : un appui épaule et
     garde, un appui long vise le temps du doigt), sauter, s'accroupir (en sprint : glissade), recharger, changer d'arme, grenade (appui :
     dégoupille, relâcher : lancer), couteau, ramasser, retenir son souffle (en lunette), séries d'éliminations (quand elles sont prêtes),
     pause, tableau des scores, discussion en ligne ;
   - le jeu n'a plus besoin de la capture de la souris : pointerActive() est vrai (09-game.js), les entrées passent par les mêmes variables
     que le clavier et la souris (mouseDX, PL.held, KEYS...), donc le comportement du joueur ne change pas ;
   - plein écran et paysage au lancement d'une partie, écran gardé allumé, pause quand la page passe en arrière-plan.
   Voir README, « Version mobile ».
   ========================================================================== */
const TOUCH = { on: false, mx: 0, mz: 0, sprint: false, lastT: -1e9, lookK: 2.8, R: 51, kx: 1, ky: 1 }; // lookK : un pixel de doigt vaut lookK pixels de souris (2,3 avant la 3.0.1, trop lent) ; R : rayon du joystick en pixels (12,5 u, voir touchSize)
const TC = { root: null, el: {}, move: null, look: null, fire: new Set(), ads: null, autoOn: null, dblOn: null, tap: null, show: false, dead: false, wake: null, hint: false, runOn: false, stickRun: false, edit: false, sel: null, drag: null, lay: {} };

/* Bornes et disposition d'origine des boutons (09qb-tactile-layout.js : déclarées ici parce que touchInit, en bas de ce fichier, s'en sert au chargement) */
const TC_MINU = 6, TC_MAXU = 26;
/* Disposition d'origine : celle du joueur qui a réglé les boutons sur son Pixel (2.23.1) ; les boutons absents (séries, ramassage, pause, scores, discussion, joystick)
   gardent leur place par défaut de shell.html. Le dernier nombre d'une entrée : 1 = retiré. */
const TC_DEFAULT_LAY = {
  run: [0.2321, 0.7788, 11, 1], fireL: [0.1016, 0.5981, 13, 1], fire: [0.8033, 0.671, 20, 0], knife: [0.6482, 0.8913, 10, 0], nade: [0.9509, 0.4836, 11, 0],
  breath: [0.3424, 0.8944, 12, 1], ads: [0.8729, 0.5006, 14, 0], crouch: [0.8188, 0.9048, 11, 0], swap: [0.8987, 0.8797, 10, 0], jump: [0.9089, 0.7206, 13, 0], reload: [0.7333, 0.8559, 10.5, 0],
};
/* Une unité « u » du HUD tactile : 1 % de la hauteur de l'écran, bornée comme --u dans shell.html ; le joystick en dépend */
function touchSize() {
  TOUCH.R = 12.5 * clamp(innerHeight / 100, 3.3, 5.6);
  // au-delà de 560 px de haut (tablette, iPad), u plafonne : la disposition se ramène vers les bords comme sur un téléphone de 100 u de haut et d'au plus 222 u
  // de large (shell.html, .tcb.ov ; inverse : touchFrac), sinon ses boutons s'éloigneraient des pouces avec la taille de l'écran
  TOUCH.ky = innerHeight > 560 ? 560 / innerHeight : 1; TOUCH.kx = TOUCH.ky < 1 ? Math.min(1, 1244 / innerWidth) : 1;
  document.documentElement.style.setProperty('--tkx', TOUCH.kx); document.documentElement.style.setProperty('--tky', TOUCH.ky);
  // « 1 % de la hauteur » mesuré sur la fenêtre réellement visible : dans un navigateur de téléphone, 1vh compte la hauteur sans la barre d'adresse, et tout ce qui est
  // dimensionné en u (menus compacts, HUD tactile) dépasserait de l'écran tant qu'elle est là
  document.documentElement.style.setProperty('--vh', innerHeight / 100 + 'px');
}
/* Fraction de la disposition dont la place tombe en px (axe 'x' ou 'y') : l'inverse du calcul de .tcb.ov dans shell.html (zone de passage de 0,4 à 0,6 en largeur,
   de 0,2 à 0,4 en hauteur) ; la fraction elle-même sur un téléphone */
function touchFrac(px, ax) {
  const x = ax === 'x', p = px / (x ? innerWidth : innerHeight), k = (x ? TOUCH.kx : TOUCH.ky) || 1, a = x ? 0.4 : 0.2;
  if (p <= k * a) return p / k;
  if (p >= 1 - k * (0.8 - a)) return 1 - (1 - p) / k;
  return (p + 5 * (1 - k) * a) / (k + 5 * (1 - k));
}
/* Écran tactile utilisé comme pointeur principal ? (Options > Contrôles tactiles : Automatique, Activés, Désactivés) */
function touchDetect() {
  const pref = Settings.touch;
  TOUCH.on = pref === 'on' || (pref !== 'off' && COARSE);
  document.body.classList.toggle('touch', TOUCH.on);
  if (TC.root) { touchReset(); if (!TOUCH.on) { TC.show = false; TC.root.classList.add('hidden'); } }
}
/* Lâche tout : joystick, regard, tirs, boutons (pause, fin de partie, changement d'écran) */
function touchReset() {
  TC.move = null; TC.look = null; TC.fire.clear(); TC.ads = null; TC.qs = null; TC.tap = null; PL.knifeBtn = null;
  TOUCH.mx = TOUCH.mz = 0; TOUCH.sprint = false; TC.runOn = false; TC.stickRun = false;
  KEYS.Space = false; KEYS.ShiftLeft = false;
  if (!TOUCH.on) return;
  PL.held = false; PL.adsWant = false;
  if (TC.root) { TC.el.stick.classList.remove('on'); TC.el.stick.querySelector('b').style.transform = ''; for (const b of TC.root.querySelectorAll('.tcb.on')) b.classList.remove('on'); }
}

/* Boutons : [id, classe de place, icône, libellé, type, action(s)]. « hold » : appui et relâchement ; « tap » : un appui. */
const TC_ICONS = {
  fire: '<circle cx="12" cy="12" r="5.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  aim: '<circle cx="12" cy="12" r="8.5"/><path d="M12 5v4M12 15v4M5 12h4M15 12h4"/>',
  jump: '<path d="M6 11l6-6 6 6M6 18l6-6 6 6"/>',
  crouch: '<path d="M6 6l6 6 6-6M6 13l6 6 6-6"/>',
  reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5h-4.5"/>',
  swap: '<path d="M6 8h12l-3-3.2M18 16H6l3 3.2"/>',
  nade: '<circle cx="12" cy="14.5" r="6"/><path d="M9.5 8.5V4.5h4.5l1.5 2.5"/>',
  knife: '<path d="M20 4c-.6 5-4 9-9 10l-1-1c1-5 5-8.4 10-9z"/><path d="M8.2 12.2l3.6 3.6M10.5 14.5L5 20"/>',
  pick: '<path d="M12 3.5v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  board: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  chat: '<path d="M4.5 5.5h15v10h-8l-4.5 4v-4h-2.5z"/>',
  run: '<path d="M13 3.5L6.5 13.5H12l-1 7 6.5-10H12z"/>',
  breath: '<path d="M4 12c2-4 4-4 6 0s4 4 6 0 3-3 4-1.5"/>',
  boom: '<path d="M12 3l1.8 5 5-2-2.6 4.6 4.8 2.2-5.2 1 1 5.2-4.8-3-4.8 3 1-5.2-5.2-1 4.8-2.2L5.2 6l5 2z"/>',
  // séries (les mêmes que celles du HUD de l'ordinateur, catalogue KSDEF) : les boutons des emplacements prennent celle de la série de la classe (touchKsIcons)
  ...Object.fromEntries(KS_IDS.map((k) => [k, KSDEF[k].icon])),
};
const TC_BTNS = [
  ['fire', 'tc-fire', 'fire', _t('Tirer'), 'hold', (d) => touchFire(d, 'r')],
  ['fireL', 'tc-fire-l l', 'fire', _t('Tirer'), 'hold', (d) => touchFire(d, 'l')],
  ['ads', 'tc-ads', 'aim', _t('Viser'), 'ads'],
  ['jump', 'tc-jump', 'jump', _t('Sauter'), 'hold', (d) => { KEYS.Space = d; }],
  ['run', 'tc-run l', 'run', _t('Courir'), 'tap', () => { TC.runOn = !TC.runOn; touchSprint(); }],
  ['crouch', 'tc-crouch', 'crouch', _t('S\u0027accroupir'), 'tap', () => { if (!trySlide()) PL.crouchToggle = !PL.crouchToggle; }],
  ['reload', 'tc-reload', 'reload', _t('Recharger'), 'tap', () => startReload()],
  ['swap', 'tc-swap', 'swap', _t('Changer d\u0027arme'), 'tap', () => quickSwap()],
  ['nade', 'tc-nade', 'nade', _t('Grenade'), 'hold', (d) => { if (d) cookNade(); else releaseNade(); }],
  ['knife', 'tc-knife', 'knife', _t('Couteau'), 'hold', (d) => knifeButton(d)], // appui bref : un coup ; maintenu : couteau en main (08-player.js)
  ['pick', 'tc-pick', 'pick', _t('Ramasser'), 'tap', () => { if (!mechaUse()) swapWithDrop(); }], // à portée de son mecha, ou à bord : monter, descendre (08g-mecha-pilote.js)
  ['breath', 'tc-breath', 'breath', _t('Retenir son souffle'), 'hold', (d) => { KEYS.ShiftLeft = d; }],
  ['ks1', 'tc-ks tc-ks0', 'uav', _t('Première série'), 'tap', () => useKs(0)],
  ['ks2', 'tc-ks tc-ks1', 'air', _t('Deuxième série'), 'tap', () => useKs(1)],
  ['ks3', 'tc-ks tc-ks2', 'heli', _t('Troisième série'), 'tap', () => useKs(2)],
  ['boom', 'tc-boom', 'boom', _t('Exploser'), 'tap', () => { PL.queued = true; }], // drone kamikaze en vol (08e-fpv.js)
  ['pause', 'tc-pause', 'pause', _t('Pause'), 'tap', () => pauseGame()],
  ['board', 'tc-board', 'board', _t('Tableau des scores'), 'tap', () => showScoreboard(!HUD.board)],
  ['chat', 'tc-chat', 'chat', _t('Discussion'), 'tap', () => chatOpen()],
];
/* Boutons d'action qui font quitter la visée (recharger, changer d'arme, ramasser, couteau, séries) : à la fin du rechargement, on ne revient pas en
   visée sans l'avoir voulu */
const TC_UNAIM = new Set(['reload', 'swap', 'pick', 'knife', 'ks1', 'ks2', 'ks3']);
function touchUnaim() {
  PL.adsWant = false; TC.ads = null; // bouton Viser tenu : son relâcher ne remet rien
  if (TC.qs) TC.qs.was = false; // tir au relâcher du fusil de précision en cours : la visée d'avant ne revient pas
}
function touchFire(down, side) {
  // fusil de précision, tir au relâcher (option, comme Call of Duty Mobile) : appuyer met en visée, glisser vise, relâcher tire, puis la visée d'avant revient
  const w = PL.ent.alive ? curW() : null;
  if (Settings.tcQuick !== false && ((down && w && w.def.scope) || (!down && TC.qs))) {
    if (down) { if (!TC.qs) TC.qs = { was: PL.adsWant }; TC.fire.add(side); PL.adsWant = true; return; }
    TC.fire.delete(side); if (TC.fire.size) return;
    if (VM.ads > 0.6 && performance.now() >= PL.noFireT) PL.queued = true;
    PL.adsWant = TC.qs.was; TC.qs = null; return;
  }
  if (down) TC.fire.add(side); else TC.fire.delete(side);
  const on = TC.fire.size > 0;
  if (on && !PL.held) PL.queued = true;
  PL.held = on;
}
/* Double toucher pour viser (Settings.tcDblAds, par défaut ; le bouton Viser est alors caché) : deux touchers brefs au même endroit de la zone de regard épaulent,
   deux autres rangent l'arme. Le second compte dès qu'il se pose ; un toucher qui glisse ou qui dure ne compte pas (c'est un regard). Délais sur les horodatages des
   événements (ms) */
const TC_TAP = { dur: 260, move: 14, gap: 330, dist: 80 };
function touchTapDown(e) {
  const T = TC.tap; TC.look.dbl = false;
  if (!Settings.tcDblAds || !T || e.timeStamp - T.t > TC_TAP.gap || hyp(e.clientX - T.x, e.clientY - T.y) > TC_TAP.dist) return;
  TC.tap = null; TC.look.dbl = true;
  if (PL.ent.alive && MATCH.state === 'playing') { PL.adsWant = !PL.adsWant; touchBuzz(6); }
}
function touchTapUp(e) {
  const L = TC.look; if (!Settings.tcDblAds || L.dbl) return;
  const short = e.timeStamp - L.t0 < TC_TAP.dur && hyp(e.clientX - L.x0, e.clientY - L.y0) < TC_TAP.move;
  TC.tap = short ? { t: e.timeStamp, x: e.clientX, y: e.clientY } : null;
}
/* Viser (bouton) : un appui court épaule (un autre le range), un appui long vise tant que le doigt reste posé */
function touchAds(down, ts) {
  if (down) { TC.ads = { was: PL.adsWant, t: ts }; PL.adsWant = true; return; }
  const a = TC.ads; TC.ads = null; if (!a) return;
  if (ts - a.t > 350 || a.was) PL.adsWant = false; // long : relâché ; court sur une visée déjà tenue : rangé (durée mesurée sur les horodatages des événements)
}

/* Bouton Ramasser : l'icône du mecha quand il sert à monter à bord ou à descendre */
function touchPickIcon(mk) {
  const b = TC.el.pick; if (b.dataset.mk === String(mk)) return;
  b.dataset.mk = String(mk); b.setAttribute('aria-label', mk ? (MECHA_P.me ? _t('Descendre du mecha') : _t('Monter dans le mecha')) : _t('Ramasser'));
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${mk ? KSDEF.mecha.icon : TC_ICONS.pick}</svg>`;
}
/* Boutons des emplacements de séries : icône et nom de la série de la classe (updateStreakHud) ; bouton Grenade : celle de la classe */
function touchKsIcons() {
  if (!TC.root) return;
  PL.ksSel.forEach((k, i) => {
    const b = TC.el['ks' + (i + 1)]; if (b.dataset.ks === k) return;
    b.dataset.ks = k; b.setAttribute('aria-label', KSDEF[k].name); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${KSDEF[k].icon}</svg>`;
  });
  // bouton Grenade : le type de la classe (NADE_TYPES)
  const g = TC.el.nade, N = NADE_TYPES[PL.nadeType]; if (!g || !N || g.dataset.ty === PL.nadeType) return;
  g.dataset.ty = PL.nadeType; g.setAttribute('aria-label', N.long); g.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${N.icon}</svg>`;
}
function touchBuild() {
  const root = document.createElement('div'); root.id = 'touch'; root.className = 'hidden'; TC.root = root;
  const stick = document.createElement('div'); stick.id = 'tcStick'; stick.innerHTML = '<i></i><b></b><u></u>'; root.appendChild(stick); TC.el.stick = stick; // cercle, bouton qui suit le doigt, anneau de la course
  for (const [id, pos, icon, label, kind, act] of TC_BTNS) {
    const b = document.createElement('div'); b.className = 'tcb ' + pos; b.dataset.tc = id; b.setAttribute('role', 'button'); b.setAttribute('aria-label', label);
    // l'icône seule (séries comprises : leur nom n'est plus écrit, il reste dans aria-label) ; le texte pour un bouton sans icône
    b.innerHTML = icon ? `<svg viewBox="0 0 24 24" aria-hidden="true">${TC_ICONS[icon]}</svg>` : `<span>${esc(label)}</span>`;
    TC.el[id] = b; root.appendChild(b);
    const look = id === 'fire' || id === 'fireL' || id === 'ads';
    const press = (d, ts) => { b.classList.toggle('on', d); if (d && TC_UNAIM.has(id)) touchUnaim(); if (kind === 'ads') touchAds(d, ts); else if (kind === 'hold') act(d); else if (d) act(); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (TC.edit) { touchEditDown(id, e); return; } TOUCH.lastT = performance.now(); b.setPointerCapture(e.pointerId); if (look) b._lk = { id: e.pointerId, x: e.clientX, y: e.clientY }; if (kind === 'tap') b.classList.add('on'); press(true, e.timeStamp); if (kind === 'tap') setTimeout(() => b.classList.remove('on'), 130); });
    // tir et visée : le doigt posé sur le bouton fait aussi tourner la vue quand il glisse (sans quoi la vue restait figée pendant qu'on tire)
    b.addEventListener('pointermove', (e) => {
      if (TC.edit) { touchEditMove(e); return; }
      const L = b._lk; if (!L || e.pointerId !== L.id) return;
      TOUCH.lastT = performance.now(); mouseDX += (e.clientX - L.x) * TOUCH.lookK; mouseDY += (e.clientY - L.y) * TOUCH.lookK; L.x = e.clientX; L.y = e.clientY;
    });
    const up = (e) => { b._lk = null; if (TC.edit) { touchEditUp(e); return; } if (kind === 'tap') return; TOUCH.lastT = performance.now(); press(false, e.timeStamp); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', (e) => { if (TC.edit) touchEditUp(e); else if (b.classList.contains('on') && kind !== 'tap') up(e); });
  }
  const help = document.createElement('div'); help.id = 'tcHelp'; help.className = 'hidden';
  help.innerHTML = `<div><b>${esc(_t('Joystick à gauche'))}</b> ${esc(_t('pour avancer. Poussé au-delà du cercle, il fait sprinter.'))}</div><div><b>${esc(_t('Glissez à droite'))}</b> ${esc(_t('pour regarder autour de vous.'))}</div><div class="tch-b"></div><p>${esc(_t('Touchez pour commencer'))}</p>`;
  root.appendChild(help); TC.el.help = help;
  help.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); help.classList.add('hidden'); try { localStorage.setItem('dc_touch_help', '1'); } catch (er) { /* ignoré */ } });
  // zones : joystick fixe (saisi près de son cercle), regard partout ailleurs ; mort ou killcam : un toucher passe l'attente
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault(); TOUCH.lastT = performance.now();
    if (TC.edit) return;
    if (TC.dead) { kcSkip(); return; }
    if (KS.map.open || CHAT.open) return;
    const fixed = Settings.tcStick === 'fixed', G = touchStickGeom();
    // fixe : saisi près de son cercle ; flottant : toute la moitié gauche, le cercle se pose sous le doigt et n'en bouge plus
    const near = fixed ? hyp(e.clientX - G.cx, e.clientY - G.cy) <= G.R * 2 : e.clientX < innerWidth * 0.46;
    if (near && !TC.move) {
      if (!fixed) { G.cx = e.clientX; G.cy = e.clientY; TC.el.stick.style.setProperty('--fx', touchFrac(e.clientX, 'x')); TC.el.stick.style.setProperty('--fy', touchFrac(e.clientY, 'y')); }
      TC.move = { id: e.pointerId, g: G }; root.setPointerCapture(e.pointerId); TC.el.stick.classList.add('on'); touchStick(e);
    } else if (!near && !TC.look) { TC.look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp }; root.setPointerCapture(e.pointerId); touchTapDown(e); }
  });
  root.addEventListener('pointermove', (e) => {
    TOUCH.lastT = performance.now();
    if (TC.move && e.pointerId === TC.move.id) touchStick(e);
    else if (TC.look && e.pointerId === TC.look.id) {
      const k = TOUCH.lookK; mouseDX += (e.clientX - TC.look.x) * k; mouseDY += (e.clientY - TC.look.y) * k; TC.look.x = e.clientX; TC.look.y = e.clientY;
    }
  });
  const end = (e) => {
    if (TC.move && e.pointerId === TC.move.id) { TC.move = null; TOUCH.mx = TOUCH.mz = 0; TC.runOn = false; TC.stickRun = false; touchSprint(); TC.el.stick.classList.remove('on'); TC.el.stick.classList.remove('run'); TC.el.stick.querySelector('b').style.transform = ''; touchLayoutOne('stick'); }
    if (TC.look && e.pointerId === TC.look.id) { touchTapUp(e); TC.look = null; }
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  touchLayoutMigrate(); touchEditBuild(root); touchLayoutApply();
  document.body.appendChild(root); touchAlpha();
}
/* Course : le bouton « Courir » (verrou : on court tant que le joystick avance) ou, selon l'option, le joystick poussé à fond */
function touchSprint() {
  const run = TC.stickRun || (TC.runOn && !!TC.move && TOUCH.mz > 0.2);
  TOUCH.sprint = run; if (TC.el.stick) TC.el.stick.classList.toggle('run', run);
}
/* Cercle du joystick à l'écran (centre et rayon en pixels) : sa place vient de la disposition (09qb-tactile-layout.js) */
function touchStickGeom() {
  const r = TC.el.stick.firstChild.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: Math.max(20, r.width / 2) };
}
/* Joystick fixe, analogique : m est l'écart du doigt au centre en rayons de cercle. Marche proportionnelle jusqu'au bord (pleine allure à 0,9), puis la course se
   lance en poussant le doigt au-delà du cercle vers l'avant (anneau en pointillés, 1,15) et dure tant qu'il reste près du bord (0,95) : plus on accentue, plus on va
   vite, jusqu'à courir, comme dans Call of Duty Mobile. */
const TC_SPRINT_ON = 1.15, TC_SPRINT_OFF = 0.95;
function touchStick(e) {
  const G = TC.move.g, dx = e.clientX - G.cx, dy = e.clientY - G.cy, len = hyp(dx, dy), m = len / G.R;
  const dead = 0.14, v = m < dead ? 0 : Math.min(1, (m - dead) / (0.9 - dead)), fwd = len ? -dy / len : 0;
  TOUCH.mx = len ? (dx / len) * v : 0; TOUCH.mz = len ? (-dy / len) * v : 0;
  TC.stickRun = Settings.tcRun === 'stick' && (TC.stickRun ? m > TC_SPRINT_OFF && fwd > 0.35 : m > TC_SPRINT_ON && fwd > 0.55);
  touchSprint();
  const k = len > G.R ? G.R / len : 1; TC.el.stick.querySelector('b').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
}

/* À chaque image : commandes visibles en partie, boutons contextuels (séries prêtes, arme au sol, lunette, discussion). Pendant l'annonce
   du résultat ('finish'), rien : les commandes n'y servent plus, le HUD s'efface (#hud.finish), les boutons aussi (retour du propriétaire :
   ils restaient affichés derrière « Victoire » ou « Défaite »). Pendant une killcam, la couche reste, sans ses boutons ni son joystick
   (mode « mort ») : un toucher passe la relecture */
function touchTick() {
  touchModeSync();
  if (TC.edit) return; // disposition en cours de modification : rien ne se cache ni ne se montre tout seul
  const st = MATCH.state, playing = st === 'playing', dead = st === 'killcam' || (playing && !PL.ent.alive);
  const show = playing || st === 'killcam';
  if (show !== TC.show) {
    TC.show = show; TC.root.classList.toggle('hidden', !show);
    if (show) { touchWake(); if (!TC.hint) { TC.hint = true; let seen = false; try { seen = !!localStorage.getItem('dc_touch_help'); } catch (e) { /* ignoré */ } if (!seen) touchHelpShow(); } }
    else touchReset();
  }
  if (!show) return;
  if (dead !== TC.dead) { TC.dead = dead; TC.root.classList.toggle('dead', dead); if (dead) touchReset(); }
  const map = KS.map.open || CHAT.open; TC.root.classList.toggle('map', map); TC.root.classList.toggle('fpv', !!PILOT.d); TC.root.classList.toggle('mecha', !!MECHA_P.me);
  const vis = (id, on) => TC.el[id].classList.toggle('gone', !on);
  touchKsIcons(); PL.ksSel.forEach((k, i) => vis('ks' + (i + 1), !!PL.ks[k]));
  const mk = !!MECHA_P.me || !!mechaNear(); vis('pick', !!DROP.cur || mk); touchPickIcon(mk); vis('run', Settings.tcRun !== 'stick'); TC.el.run.classList.toggle('lit', TC.runOn); TC.root.classList.toggle('runbtn', Settings.tcRun === 'button'); TC.root.classList.toggle('float', Settings.tcStick !== 'fixed');
  const w = PL.ent.alive ? curW() : null; vis('breath', !!(w && w.def.scope && VM.ads > 0.6));
  vis('chat', MATCH.online && !!NET.on); vis('nade', PL.nades > 0 || !!PL.nadeState);
  TC.el.ads.classList.toggle('lit', !!PL.adsWant);
}
/* Aide du premier lancement : les boutons dépendent du tir automatique (sans bouton de tir) */
function touchHelpShow() {
  const a = Settings.tcAuto, d = Settings.tcDblAds;
  TC.el.help.querySelector('.tch-b').textContent = a && d ? _t('Le tir part tout seul quand le réticule est sur un ennemi. Touchez deux fois l\u0027écran pour viser. Boutons : sauter, s\u0027accroupir (glissade en sprint), recharger, grenade, couteau.')
    : a ? _t('Le tir part tout seul quand le réticule est sur un ennemi. Boutons : viser, sauter, s\u0027accroupir (glissade en sprint), recharger, grenade, couteau.')
    : d ? _t('Touchez deux fois l\u0027écran pour viser. Boutons : tirer, sauter, s\u0027accroupir (glissade en sprint), recharger, grenade, couteau.')
    : _t('Boutons : tirer, viser, sauter, s\u0027accroupir (glissade en sprint), recharger, grenade, couteau.');
  TC.el.help.classList.remove('hidden');
}
/* Écran gardé allumé pendant la partie (si le navigateur le permet) */
async function touchWake() {
  try { if (navigator.wakeLock && !TC.wake) { TC.wake = await navigator.wakeLock.request('screen'); TC.wake.addEventListener('release', () => { TC.wake = null; }); } } catch (e) { /* refusé : sans conséquence */ }
}
/* Plein écran et paysage au lancement d'une partie (le geste est le toucher de « Déployer »). Aussi dans l'application installée : Android l'ouvre déjà en plein écran
   (manifeste), mais Chrome y laisse une bande noire le long de la caméra en paysage, car il n'applique viewport-fit=cover (l'image sous l'encoche) qu'à une page en plein
   écran HTML (requestFullscreen). Sans API (iPhone), rien. */
function touchFullscreen() {
  if (!TOUCH.on) return;
  gpuLog('fullscreen + landscape requested');
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) { try { LOCK.fsPending = document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* ignoré */ } }
  try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* ignoré */ }
}

/* Gestes du navigateur qui n'ont rien à faire dans le jeu, surtout sur iPhone et iPad : sélection de texte, menu « Copier » et loupe au toucher long,
   zoom au double toucher ou à deux doigts (Safari ignore user-scalable=no). Le CSS fait l'essentiel (shell.html : -webkit-user-select, -webkit-touch-callout,
   touch-action: manipulation) ; ici, ce que Safari n'écoute que par ses évènements propres (gesturestart, échelle du toucher). Les champs de saisie, le code
   de secours et le rapport graphique restent sélectionnables. */
function touchNoBrowserGestures() {
  const free = (t) => { const el = t && t.nodeType === 3 ? t.parentElement : t; return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable], .ac-code, #grTxt')); };
  document.addEventListener('selectstart', (e) => { if (!free(e.target)) e.preventDefault(); });
  if (!('ongesturestart' in window)) return; // Safari seulement
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });
}
function touchInit() {
  touchDetect(); touchSize(); addEventListener('resize', touchSize);
  touchNoBrowserGestures();
  // un toucher n'importe où (bouton de l'interface, carte de la frappe) : la souris que le navigateur simule ensuite (mousemove, mousedown, click) ne compte pas. Sans cela,
  // toucher un bouton à côté de la carte de la frappe faisait filer le point visé au bord de la carte puis confirmait la frappe (gardes TOUCH.lastT de 08-player.js et 09-game.js)
  for (const ev of ['pointerdown', 'pointerup']) addEventListener(ev, (e) => { if (e.pointerType === 'touch') TOUCH.lastT = performance.now(); }, true);
  touchBuild();
  if (TOUCH.on && !localStorageHas('dc_settings')) { Settings.fsGame = true; saveSettings(); } // première visite sur téléphone : plein écran par défaut
  // carte de la frappe aérienne : le doigt place la zone, on peut la faire glisser, et la frappe part là où le doigt se lève (levé hors de la carte : rien ne part,
  // on peut reprendre) ; un bouton annule
  const tac = $('tacCanvas'), place = (e) => {
    if (!TOUCH.on || !KS.map.open) return; const r = tac.getBoundingClientRect(); if (!r.width) return;
    KS.map.x = clamp(MAP.x0 + ((e.clientX - r.left) / r.width) * (MAP.x1 - MAP.x0), MAP.x0 + 1, MAP.x1 - 1);
    KS.map.z = clamp(MAP.z0 + ((e.clientY - r.top) / r.height) * (MAP.z1 - MAP.z0), MAP.z0 + 1, MAP.z1 - 1);
  };
  tac.addEventListener('pointerdown', (e) => { TOUCH.lastT = performance.now(); place(e); tac.setPointerCapture(e.pointerId); }); tac.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) place(e); });
  tac.addEventListener('pointerup', (e) => {
    if (!TOUCH.on || !KS.map.open) return; const r = tac.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    place(e); ksConfirm();
  });
  $('tcMapNo').addEventListener('click', () => ksCancel());
  // plein écran dès le premier toucher dans le jeu, installé ou non : en paysage, Chrome laisse sinon une bande noire à côté de l'encoche de l'écran, sur les
  // menus comme sur le chargement (voir touchFullscreen). Pas pendant la fenêtre d'installation (son bouton a besoin du geste).
  const firstTap = () => { if (PWA.gate) return; removeEventListener('pointerup', firstTap, true); if (TOUCH.on && MATCH.state !== 'playing') touchFullscreen(); };
  addEventListener('pointerup', firstTap, true);
  // la page passe en arrière-plan ou l'écran passe en portrait : pause
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (TOUCH.on && MATCH.state === 'playing') pauseGame(); } else if (TC.show) touchWake(); });
  addEventListener('orientationchange', () => { if (TOUCH.on && MATCH.state === 'playing') pauseGame(); });
}
const localStorageHas = (k) => { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } };
touchInit();
