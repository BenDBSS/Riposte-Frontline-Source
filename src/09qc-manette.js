/* ==========================================================================
   MANETTE : jouer à la manette (Xbox, PlayStation, 8BitDo, Switch Pro...), dans le même jeu que sur clavier et souris.
   Norme « Standard Gamepad » de l'API Gamepad (navigateurs récents) : toute manette qui s'y présente fonctionne, sans pilote ni réglage. Les boutons sont nommés
   comme sur une manette Xbox (A en bas, B à droite, X à gauche, Y en haut ; LB/RB, LT/RT ; L3/R3 : appui sur un bâton) ; les autres manettes ont la même disposition
   par position (Croix, Rond, Carré, Triangle ; L1/R1, L2/R2 ; une 8BitDo en mode Xbox ou Switch).
   Schéma des Call of Duty (disposition par défaut) :
   - bâton gauche : se déplacer (analogique : marche lente à pleine vitesse) ; L3 : sprinter (un appui, jusqu'à l'arrêt du bâton ou au premier tir) ; en lunette, L3 retient son souffle ;
   - bâton droit : regarder (petite zone morte, courbe réactive, accélération à fond de course, plus lent en visée) ; R3 : couteau ;
   - RT : tirer ; LT : viser (maintenu) ; RB : grenade (maintenu : cuisson, relâché : lancer) ;
   - A : sauter ; B : s'accroupir (en sprint : glissade) ; X : recharger (appui bref) ou ramasser l'arme au sol (maintenu) ; Y : changer d'arme ;
   - croix : haut UAV, droite frappe aérienne, bas hélicoptère, gauche inspecter l\u0027arme ; Retour : tableau des scores ; Menu (Start) : pause.
   Autres dispositions (Options, Jeu, « Disposition de la manette ») : Gaucher (bâtons échangés), Bumper jumper (saut sur LB, accroupi sur A).
   Dans les menus : croix ou bâton gauche pour naviguer (gauche et droite règlent un curseur ou une liste), A valide, B revient, LB et RB changent d'onglet.
   Les entrées passent par les mêmes variables que le clavier et la souris (PL.held, PL.adsWant, KEYS, fonctions d'action) : le comportement du joueur ne change pas ;
   seul le regard et le déplacement analogiques ont leur propre lecture (PAD.lx/ly, PAD.mx/mz), ajoutée à celle du clavier dans updatePlayer (08-player.js).
   Le navigateur ne donne la manette qu'au premier appui sur un bouton (événement gamepadconnected). Une manette n'est pas un geste d'utilisateur : ni capture de la
   souris ni plein écran ni son ne peuvent en dépendre ; pointerActive() est donc vrai tant que la manette a la main (PAD.drive), jusqu'à un clic ou une touche.
   Voir README, « Manette ».
   ========================================================================== */
const PAD = {
  seen: false, id: '', drive: false, // seen : une manette s'est manifestée ; drive : c'est elle qui joue (jusqu'au prochain clic ou à la prochaine touche)
  mx: 0, mz: 0, lx: 0, ly: 0, // déplacement et regard, de -1 à 1 (après zone morte et courbe)
  sprint: false, l3: false, jumpOn: false, ramp: 0, fireOn: false, adsOn: false, mapOn: false, prev: [], navKey: '', navT: 0, rumT: 0, rumS: 0, rumW: 0, rumEnd: 0, xT: 0, useT: -1,
};
/* Dispositions : numéro de bouton (norme Standard Gamepad) vers action. Les bâtons, RT et LT ne sont pas des boutons à réaffecter. */
const PAD_LAYOUTS = {
  default: { 0: 'jump', 1: 'crouch', 2: 'reload', 3: 'swap', 5: 'nade', 10: 'sprint', 11: 'knife', 12: 'ks1', 13: 'ks3', 14: 'inspect', 15: 'ks2' },
  southpaw: { 0: 'jump', 1: 'crouch', 2: 'reload', 3: 'swap', 5: 'nade', 10: 'knife', 11: 'sprint', 12: 'ks1', 13: 'ks3', 14: 'inspect', 15: 'ks2' },
  bumper: { 0: 'crouch', 2: 'reload', 3: 'swap', 4: 'jump', 5: 'nade', 10: 'sprint', 11: 'knife', 12: 'ks1', 13: 'ks3', 14: 'inspect', 15: 'ks2' },
};
const PAD_KEYS = new Set(['padSens', 'padAdsMul', 'padDead', 'padCurve', 'padAccel', 'padRun', 'padLay', 'padVib']); // réglages montrés dans les Options une fois une manette détectée
/* Réponse du bâton du regard : la déflexion v (0 à 1, après la zone morte) donne la part de la vitesse maximale. Réactive (par défaut) : une part linéaire pour
   que le regard démarre dès la sortie de la zone morte, puis une montée qui se creuse pour rester précis au centre et vif en bout de course ; Progressive : l'ancienne
   courbe, plus douce au départ ; Linéaire : la vitesse suit la déflexion. À 10 % de zone morte et à la sensibilité 1 (195 degrés par seconde à fond) : bâton à 25 %,
   16 degrés par seconde (5 avant), à 50 %, 56 (46), à 75 %, 121 (115). */
const PAD_CURVES = {
  reactive: (v) => 0.4 * v + 0.6 * Math.pow(v, 2.4),
  classic: (v) => Math.pow(v, 1.7),
  linear: (v) => v,
};
const PAD_MOVE = (v) => Math.pow(v, 1.15); // le bâton du déplacement : presque linéaire
/* Accélération du regard : bâton poussé au bord, la vitesse monte de (1 + gain) fois en PAD_RAMP s, et retombe en 0,1 s dès qu'il revient vers le centre. Le gain est
   réduit de moitié en visée. Un demi-tour à fond prend 0,92 s sans accélération, 0,67 s en « Normale », 0,56 s en « Forte » (0,75 s avec l'ancienne rampe). */
const PAD_ACCEL = { off: 0, normal: 0.5, strong: 0.9 };
const PAD_RAMP = 0.3;
const PAD_HOLD = 0.3; // secondes de X tenu pour ramasser une arme au sol (un appui plus bref recharge)
const PAD_TRIG = { on: 0.25, off: 0.15 }; // gâchettes : seuils d'appui et de relâchement (LT, RT), assez bas pour tirer au tout début de la course
const PAD_HELP = [
  [_t('Bâton gauche'), _t('Se déplacer (analogique). L3 (appui sur le bâton) pour sprinter, en lunette pour retenir son souffle')], [_t('Bâton droit'), _t('Regarder. R3 (appui sur le bâton) pour le couteau, maintenu pour le garder en main')],
  ['RT / LT', _t('Tirer / viser (maintenu)')], ['RB', _t('Grenade (maintenir pour la garder en main)')],
  ['A', _t('Sauter')], ['B', _t('S\u0027accroupir (glissade en sprintant)')], ['X', _t('Recharger, maintenir pour ramasser l\u0027arme au sol')], ['Y', _t('Changer d\u0027arme')],
  [_t('Croix directionnelle'), _t('Haut : UAV, droite : frappe aérienne, bas : hélicoptère, gauche : inspecter l\u0027arme')],
  [_t('Retour'), _t('Tableau des scores')], ['Menu', _t('Pause')], [_t('Dans les menus'), _t('Croix ou bâton gauche pour naviguer, A valider, B revenir, LB et RB changer d\u0027onglet')],
];
const padClamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
/* Une manette utilisable : de préférence au mappage standard ; à défaut, une manette qui a au moins les deux bâtons et les boutons de face */
function padPick() {
  let best = null;
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) {
    if (!g || !g.connected || g.axes.length < 4 || g.buttons.length < 10) continue;
    if (g.mapping === 'standard') return g;
    if (!best) best = g;
  }
  return best;
}
/* Bâton avec zone morte radiale (le cercle, pas des carrés : pas de diagonale perdue), plein à 95 % de la course (un bâton qui n'atteint pas tout à fait le bord
   arrive quand même à fond) et courbe de réponse f (PAD_CURVES) ; renvoie le vecteur et la déflexion v après zone morte */
function padStick(x, y, dead, f) {
  const m = hyp(x, y); if (m <= dead) return [0, 0, 0];
  const v = Math.min(1, (m - dead) / (0.95 - dead)), k = f(v) / m;
  return [x * k, y * k, v];
}
const padDown = (g, i) => { const b = g.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
/* Mappage : un appui sur un bouton déjà tenu au changement d'écran (A de « Déployer ») n'agit pas : on ne réagit qu'au passage de relâché à appuyé */
function padEdge(g, i) { const now = padDown(g, i), was = !!PAD.prev[i]; return now && !was ? 1 : !now && was ? -1 : 0; }
function padRumble(strong, weak, ms, force) { // force : retours qui passent même pendant le grondement d'un tir (touche, élimination, ramassage) et s'y ajoutent
  if (!Settings.padVib || !PAD.seen || !PAD.drive) return;
  const t = performance.now(), live = t < PAD.rumEnd; if (t < PAD.rumT && !force) return;
  if (live) { strong = Math.max(strong, PAD.rumS); weak = Math.max(weak, PAD.rumW); ms = Math.max(ms, PAD.rumEnd - t); } // le plus fort des deux, sans rien perdre du tir en cours
  PAD.rumT = t + ms * 0.8; PAD.rumS = strong; PAD.rumW = weak; PAD.rumEnd = t + ms;
  const g = padPick(), a = g && g.vibrationActuator; if (!a || !a.playEffect) return;
  try { a.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {}); } catch (e) { /* manette sans vibration */ }
}

/* Une action de la disposition choisie : appui (down vrai) ou relâchement */
function padAction(act, down) {
  if (MECHA_P.me && act !== 'reload') { if (act === 'jump') KEYS.Space = PAD.jumpOn = down; return; } // à bord du mecha : bâtons, gâchettes, A pour sauter, X maintenu pour descendre
  if (PILOT.d && act !== 'jump' && act !== 'sprint' && act !== 'crouch') return; // drone en vol : monter, pousser, descendre (crouch, ci-dessous)
  if (PILOT.d) { if (act === 'crouch') KEYS.ControlLeft = down; else if (act === 'jump') KEYS.Space = PAD.jumpOn = down; else { PAD.l3 = down; if (down) PAD.sprint = !PAD.sprint; } return; }
  if (act === 'jump') { KEYS.Space = PAD.jumpOn = down; return; }
  if (act === 'nade') { if (down) cookNade(); else releaseNade(); return; }
  if (act === 'knife') { knifeButton(down); return; } // appui bref : un coup ; maintenu : couteau en main (08-player.js)
  if (act === 'sprint') {
    PAD.l3 = down; // en lunette, tenu : retenir son souffle (PL.holding, 08-player.js)
    if (down && !PL.adsWant) PAD.sprint = !PAD.sprint && PAD.mz > 0.2;
    return;
  }
  if (act === 'reload') { padReloadUse(down); return; }
  if (!down) return;
  if (act === 'crouch') { if (!trySlide()) PL.crouchToggle = !PL.crouchToggle; }
  else if (act === 'swap') quickSwap();
  else if (act === 'ks1') useKs(0);
  else if (act === 'ks2') useKs(1);
  else if (act === 'ks3') useKs(2);
  else if (act === 'inspect') inspectWeapon();
}

/* X : recharger (appui bref) ou ramasser l'arme au sol qui est à portée (maintenu PAD_HOLD s), comme dans les Call of Duty. Sans arme à portée, le rechargement part
   dès l'appui, sans attente ; avec une arme à portée, on attend de savoir : relâché avant PAD_HOLD, il recharge, tenu jusqu'au bout, il échange (padUseTick) */
function padReloadUse(down) {
  if (down) { if (DROP.cur || MECHA_P.me || mechaNear()) PAD.useT = 0; else startReload(); return; }
  if (PAD.useT >= 0 && PAD.useT < PAD_HOLD) startReload();
  PAD.useT = -1;
}
function padUseTick(dt) {
  if (PAD.useT < 0 || PAD.useT >= PAD_HOLD) return; // pas d'appui en attente, ou ramassage déjà fait (le relâchement ne rechargera pas)
  PAD.useT += dt;
  if (PAD.useT < PAD_HOLD) return;
  PAD.useT = PAD_HOLD + 1;
  if (mechaUse()) padRumble(0.7, 0.5, 140, true); // monter dans son mecha, ou en descendre
  else if (DROP.cur) { swapWithDrop(); padRumble(0.55, 0.35, 80, true); } else startReload(); // l'arme a disparu ou s'est éloignée pendant l'appui : on recharge
}

/* Carte de la frappe aérienne : les deux bâtons déplacent le point visé (leurs vecteurs s'ajoutent, la somme est limitée à 1), quelle que soit la disposition.
   Précis à petite déflexion (7 m/s à 25 %), vif à fond (85 m/s : la largeur de la carte en une seconde) ; avant, 43 m/s à fond et 13 m/s à mi-course. */
const PAD_MAP_SPEED = 85;
const padMapCurve = (v) => 0.12 * v + 0.88 * v * v;
function padMapMove(g, dt) {
  const a = padStick(g.axes[0], g.axes[1], Settings.padDead, padMapCurve), b = padStick(g.axes[2], g.axes[3], Settings.padDead, padMapCurve);
  let x = a[0] + b[0], y = a[1] + b[1]; const m = hyp(x, y); if (m > 1) { x /= m; y /= m; }
  ksMapMove(x * PAD_MAP_SPEED * dt, y * PAD_MAP_SPEED * dt);
}

/* En partie : lecture des bâtons et des gâchettes, actions des boutons */
function padPlay(g, dt) {
  const south = Settings.padLay === 'southpaw', dead = Settings.padDead;
  const L = padStick(g.axes[south ? 2 : 0], g.axes[south ? 3 : 1], dead, PAD_MOVE), R = padStick(g.axes[south ? 0 : 2], g.axes[south ? 1 : 3], dead, PAD_CURVES[Settings.padCurve] || PAD_CURVES.reactive);
  const lay = PAD_LAYOUTS[Settings.padLay] || PAD_LAYOUTS.default;
  const alive = PL.ent.alive, map = KS.map.open;
  // déplacement : analogique, de la marche lente à la pleine vitesse (avant = haut du bâton)
  PAD.mx = alive && !map ? L[0] : 0; PAD.mz = alive && !map ? -L[1] : 0;
  // course : un appui sur L3 la lance, elle dure tant que le bâton pousse vers l'avant ; en option, le bâton poussé à fond suffit
  if (Settings.padRun === 'auto') PAD.sprint = alive && !map && !PL.adsWant && (PAD.sprint ? L[2] > 0.9 && -L[1] > 0.3 : L[2] > 0.98 && -L[1] > 0.6);
  else if (PAD.sprint && (!alive || PAD.mz < 0.1 || PL.adsWant || map)) PAD.sprint = false;
  if (!alive) PAD.sprint = false;
  // regard : vitesse angulaire maxi 3,4 rad/s, plus lente en visée comme à la souris ; le bâton poussé au bord accélère (PAD_ACCEL, PAD_RAMP) pour les demi-tours :
  // la rampe monte vers la part de bord atteinte (de 80 % à 98 % de la course utile) en PAD_RAMP s et retombe en 0,1 s
  PAD.lx = R[0]; PAD.ly = R[1];
  const rampTo = smoothstep(0.8, 0.98, R[2]);
  PAD.ramp = PAD.ramp < rampTo ? Math.min(rampTo, PAD.ramp + dt / PAD_RAMP) : Math.max(rampTo, PAD.ramp - dt / 0.1);
  // gâchettes
  const rt = g.buttons[7] ? g.buttons[7].value : 0, lt = g.buttons[6] ? g.buttons[6].value : 0;
  const fire = PAD.fireOn ? rt > PAD_TRIG.off : rt > PAD_TRIG.on, ads = PAD.adsOn ? lt > PAD_TRIG.off : lt > PAD_TRIG.on;
  if (map) {
    PAD.useT = -1;
    if ((fire && !PAD.fireOn) || padEdge(g, 0) > 0) ksConfirm(); // RT ou A
    PAD.fireOn = fire; PAD.adsOn = ads;
    padMapMove(g, dt);
    if (padEdge(g, 1) > 0) ksCancel();
    return;
  }
  if (fire !== PAD.fireOn) { PAD.fireOn = fire; if (alive && performance.now() >= PL.noFireT) { if (fire) PL.queued = true; PL.held = fire; } else if (!fire) PL.held = false; if (fire) PAD.sprint = false; } // tirer arrête le sprint : L3 pour le relancer
  if (ads !== PAD.adsOn) { PAD.adsOn = ads; if (alive) PL.adsWant = ads; else PL.adsWant = false; }
  if (ads && PAD.sprint) PAD.sprint = false;
  if (!alive) { PAD.useT = -1; if (padEdge(g, 0) > 0 || padEdge(g, 2) > 0) kcSkip(); return; }
  for (const k in lay) { const e = padEdge(g, +k); if (e) padAction(lay[k], e > 0); }
  padUseTick(dt);
  const back = padDown(g, 8); if (back !== !!HUD.board) showScoreboard(back);
}

/* Navigation dans les menus : le focus va à l'élément le plus proche dans la direction demandée ; gauche et droite règlent un curseur ou une liste.
   Le focus se souvient de sa place par écran (PAD.mem) : un écran qui se reconstruit sous le doigt (choix d'un mode, d'un onglet) le rend à l'élément le plus
   proche de l'ancienne position, et un écran qui s'ouvre prend le focus tout de suite (le dernier élément touché, sinon le bouton principal). */
const PAD_FOCUS = 'button:not(:disabled):not(.ro), select:not(:disabled), input:not([readonly]):not(:disabled):not([type=hidden]), textarea:not(:disabled), [data-focus], [role=button][tabindex="0"], .lcard[tabindex="0"], .onav, summary'; // .lcard : vignette (une carte), .onav : rangée d'option ; summary : volets repliés du Profil (mot de passe, suppression du compte), A les ouvre
const PAD_MAIN = '.mbtn, .lrow.on, [data-focus], [role=radiogroup] [aria-checked="true"], .lrow, .lcard'; // où le focus arrive : le menu, sinon l'élément choisi (carte, mode), sinon le premier hors « Retour »
const PAD_PRIMARY = '.deploy:not(:disabled), .btn.primary:not(:disabled), [data-primary]:not(:disabled)'; // l'action principale de l'écran (touche Menu)
PAD.mem = new WeakMap(); PAD.scope = null; PAD.stickDir = '';
function padScope() {
  // fenêtre ouverte par-dessus : elle garde le focus (la dernière ouverte d'abord)
  const dlg = [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].filter((e) => !e.classList.contains('hidden') && e.getClientRects().length > 0).pop();
  if (dlg) return dlg;
  const st = MATCH.state;
  // échec du chargement d'une partie : ses boutons (retour, mode économique, rapport) se manient comme un écran
  if (!$('matchload').classList.contains('hidden') && !$('mlBack').classList.contains('hidden')) return $('matchload');
  if (st === 'menu') return UI.busy ? null : $('scr-' + UI.screen);
  if (st === 'paused') return document.querySelector('.pm');
  if (st === 'ended') return $('end');
  return null;
}
function padVisible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.tabIndex >= 0 && getComputedStyle(el).visibility !== 'hidden'; }
const padCenter = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
// tout focus (manette, souris, clavier) est mémorisé : un écran reconstruit retrouve la place
addEventListener('focusin', (e) => { const sc = padScope(); if (sc && e.target instanceof Element && sc.contains(e.target) && e.target.matches(PAD_FOCUS)) { const [x, y] = padCenter(e.target); PAD.mem.set(sc, { el: e.target, x, y }); } });
function padFocus(scope, el) {
  if (!el) return;
  el.focus({ preventScroll: false }); const [x, y] = padCenter(el); PAD.mem.set(scope, { el, x, y });
  sfxUi('hover');
}
/* Où remettre le focus : l'élément mémorisé s'il existe encore, sinon le plus proche de sa position, sinon le bouton principal de l'écran */
function padRestore(scope, list) {
  const m = PAD.mem.get(scope);
  if (m) {
    if (m.el.isConnected && list.includes(m.el)) return m.el;
    let best = null, bd = 1e9;
    for (const el of list) { const [x, y] = padCenter(el), d = hyp(x - m.x, y - m.y); if (d < bd) { bd = d; best = el; } }
    if (best && bd < 480) return best;
  }
  return list.find((el) => el.matches(PAD_MAIN)) || list.find((el) => !el.matches('.back')) || list[0];
}
/* Voisin dans une direction, comme la navigation spatiale des navigateurs : d'abord ce qui est franchement au-delà du bord de l'élément (écart minimal entre les
   bords) ET se recouvre sur l'autre axe (même rangée ou même colonne), les mieux alignés d'abord ; une rangée voisine décalée coûte cher (x4), jamais d'élément
   « de travers » avant un élément aligné. Rien de tel : on se rabat sur le plus proche dont le centre est dans le bon sens, pour ne jamais rester bloqué. */
function padTarget(cur, list, dx, dy) {
  const c = cur.getBoundingClientRect(), horiz = !!dx, cc = horiz ? (c.top + c.bottom) / 2 : (c.left + c.right) / 2;
  let best = null, bs = 1e9;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const gap = dx > 0 ? r.left - c.right : dx < 0 ? c.left - r.right : dy > 0 ? r.top - c.bottom : c.top - r.bottom; // négatif : se chevauchent dans ce sens
    if (gap < -8) continue;
    const orth = horiz ? Math.max(0, r.top - c.bottom, c.top - r.bottom) : Math.max(0, r.left - c.right, c.left - r.right); // 0 : même rangée ou même colonne
    const off = Math.abs((horiz ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2) - cc);
    const sc = Math.max(0, gap) + orth * 4 + off * 0.3;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) return best;
  const cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2;
  for (const el of list) {
    if (el === cur) continue;
    const [x, y] = padCenter(el), along = dx ? (x - cx) * dx : (y - cy) * dy;
    if (along < (dx ? c.width : c.height) / 2) continue; // le centre doit dépasser le milieu de l'élément : un voisin à peine décalé d'un bord à l'autre n'est pas « dans cette direction »
    const sc = hyp(x - cx, y - cy); if (sc < bs) { bs = sc; best = el; }
  }
  return best;
}
/* Listes de menu (09ea-liste.js, Options) : dans une colonne [data-lm], haut et bas passent à la rangée suivante ou précédente (jamais de saut
   de côté), puis aux rangées « en plus » du pied de l'écran ([data-lm-extra] : l'action principale), et au bout sortent vers le voisin le plus
   proche ; gauche et droite règlent la valeur de la rangée (_adj), sinon sortent de la colonne vers le voisin de côté (une colonne d'arrivée
   donne la rangée où l'on était). Dans le menu, droite ouvre le sous-menu d'une rangée ; dans un sous-menu, gauche le referme. Une grille de
   vignettes ([data-lm-grid] : les cartes) se parcourt dans les deux sens. Vrai si le mouvement est traité. */
const padLmRows = (box) => [...box.querySelectorAll(box.dataset.lm)].filter((e) => padVisible(e) && e.getAttribute('aria-disabled') !== 'true');
function padLmEntry(box) {
  const rows = padLmRows(box);
  return (box._lastKey != null && rows.find((e) => e.dataset.key === box._lastKey)) || rows.find((e) => e.matches('.on, [aria-selected="true"], [aria-checked="true"]')) || rows[0];
}
addEventListener('focusin', (e) => { // la rangée où l'on était dans chaque colonne (padLmEntry)
  const b = e.target.closest && e.target.closest('[data-lm]'), it = b && e.target.closest(b.dataset.lm);
  if (it && it.dataset.key != null) b._lastKey = it.dataset.key;
});
/* La colonne à laquelle appartient un élément « en plus » : la dernière colonne visible qui le précède dans la page (le pied d'un écran suit sa liste) */
function padLmOwner(scope, el) {
  let own = null;
  for (const b of scope.querySelectorAll('[data-lm]')) if (b.getClientRects().length > 0 && (b.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) own = b;
  return own;
}
function padListNav(scope, cur, dx, dy, list) {
  const own = cur.closest('[data-lm]'), box = own && scope.contains(own) ? own : null, extra = cur.matches('[data-lm-extra]');
  const main = box || (extra ? padLmOwner(scope, cur) : null);
  if (!main) return false;
  const row = extra ? cur : cur.closest(main.dataset.lm) || cur;
  if (dx && !extra) {
    if (cur.tagName === 'INPUT' && cur.type !== 'range' && cur.type !== 'checkbox') return true; // le curseur du texte, pas la liste
    if (row._adj && row._adj(dx)) return true; // une valeur réglée
  }
  const sub = LM.all.find((l) => l.pbody === main), menu = LM.all.find((l) => l.col === main);
  if (main.hasAttribute('data-lm-grid')) { // vignettes : déplacement dans la grille ; au bord gauche, le sous-menu se referme
    const n = padTarget(row, padLmRows(main), dx, dy);
    if (n) padFocus(scope, n); else if (dx < 0 && sub && lmPop(sub)) sfxUi('back');
    return true;
  }
  const seq = padLmRows(main).concat([...scope.querySelectorAll('[data-lm-extra]')].filter((e) => padVisible(e) && padLmOwner(scope, e) === main)), i = seq.indexOf(row);
  if (i < 0) return false;
  if (dy && seq[i + dy]) { padFocus(scope, seq[i + dy]); return true; }
  if (dx < 0 && sub) { if (lmPop(sub)) sfxUi('back'); return true; } // au bord gauche d'un sous-menu : il se referme
  if (dx > 0 && menu && row._r && row._r.k === 'link' && row._r.page) { row.click(); return true; } // le sous-menu s'ouvre à droite du menu
  if (extra && dx) return true;
  // sortie (sur le côté, ou au bout de la colonne) : le voisin le plus proche hors de la colonne ; une autre colonne donne sa rangée
  const out = list.filter((el) => !main.contains(el) && !el.matches('[data-lm-extra]'));
  let n = padTarget(row, out, dx, dy);
  if (n) { const b = n.closest('[data-lm]'); if (b && scope.contains(b)) n = padLmEntry(b) || n; padFocus(scope, n); }
  return true;
}
function padNav(scope, dx, dy) {
  const a = document.activeElement, cur = a && scope.contains(a) && a.matches(PAD_FOCUS) ? a : null;
  const list = [...scope.querySelectorAll(PAD_FOCUS)].filter(padVisible);
  if (!list.length) return;
  if (!cur) { padFocus(scope, padRestore(scope, list)); return; }
  if (!dx && !dy) return; // (0, 0) : seulement s'assurer qu'un élément a le focus
  if (padListNav(scope, cur, dx, dy, list)) return;
  // gauche et droite sur un curseur ou une liste déroulante : on règle la valeur
  if (dx && cur.tagName === 'INPUT' && cur.type === 'range') {
    const st = parseFloat(cur.step) || 1, v = clamp(parseFloat(cur.value) + dx * st, parseFloat(cur.min), parseFloat(cur.max));
    if (v !== parseFloat(cur.value)) { cur.value = String(v); cur.dispatchEvent(new Event('input', { bubbles: true })); sfxUi('hover'); } return;
  }
  if (dx && cur.tagName === 'SELECT') {
    const i = clamp(cur.selectedIndex + dx, 0, cur.options.length - 1);
    if (i !== cur.selectedIndex) { cur.selectedIndex = i; cur.dispatchEvent(new Event('change', { bubbles: true })); sfxUi('hover'); } return;
  }
  const best = padTarget(cur, list, dx, dy);
  if (best) padFocus(scope, best);
}
/* Défilement d'une liste longue au bâton droit : le parent défilant de l'élément qui a le focus, sinon de l'écran ; sinon la zone [data-scroll] de
   l'écran (résultats : le focus est sur les boutons du pied, le corps défile à côté) */
function padScrollMenu(scope, v, dt) {
  let el = document.activeElement && scope.contains(document.activeElement) ? document.activeElement : scope;
  for (; el && el !== document.body; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2) { el.scrollTop += v * dt * 900; return; }
  }
  const z = scope.querySelector('[data-scroll]'); if (z && z.scrollHeight > z.clientHeight + 2) z.scrollTop += v * dt * 900;
}
function padMenu(g, dt) {
  const scope = padScope(); if (!scope) { PAD.navKey = ''; PAD.scope = null; return; }
  const a = document.activeElement, inScope = a && scope.contains(a) && a.matches(PAD_FOCUS);
  // écran qui s'ouvre, ou focus perdu parce que l'écran s'est reconstruit : le focus revient tout seul (pas sur un champ de saisie ailleurs)
  if (scope !== PAD.scope || (!inScope && (!a || a === document.body || !a.isConnected))) { PAD.scope = scope; padNav(scope, 0, 0); }
  // direction : croix ou bâton gauche ; une première pression agit tout de suite, puis la répétition prend le relais (0,38 s puis toutes les 0,11 s).
  // Le bâton a une hystérésis (0,6 pour partir, 0,35 pour s'arrêter) : un bâton qui tremble autour du seuil ne rebondit plus d'un élément à l'autre.
  const sx = g.axes[0], sy = g.axes[1], thr = PAD.navKey ? 0.35 : 0.6;
  let dx = (padDown(g, 15) || sx > thr ? 1 : 0) - (padDown(g, 14) || sx < -thr ? 1 : 0), dy = (padDown(g, 13) || sy > thr ? 1 : 0) - (padDown(g, 12) || sy < -thr ? 1 : 0);
  if (dx && dy) { if (Math.abs(sx) > Math.abs(sy)) dy = 0; else dx = 0; }
  const key = dx + ',' + dy;
  if (!dx && !dy) PAD.navKey = '';
  else if (key !== PAD.navKey) { PAD.navKey = key; PAD.navT = 0.38; padNav(scope, dx, dy); }
  else if ((PAD.navT -= dt) <= 0) { PAD.navT = 0.11; padNav(scope, dx, dy); }
  if (Math.abs(g.axes[3]) > 0.3) padScrollMenu(scope, g.axes[3], dt);
  const cur = document.activeElement;
  if (padEdge(g, 0) > 0) {
    if (cur && scope.contains(cur) && cur.matches(PAD_FOCUS)) {
      if (cur.tagName === 'SELECT') { // la liste du navigateur ne se manie pas à la manette : A passe à l'option suivante (retour au début après la dernière)
        cur.selectedIndex = (cur.selectedIndex + 1) % cur.options.length; cur.dispatchEvent(new Event('change', { bubbles: true })); sfxUi('hover');
      } else cur.click();
    } else padNav(scope, 0, 0);
  }
  if (padEdge(g, 1) > 0) { // B : même chemin qu'Échap (retour, fermeture d'une fenêtre, reprise dans la pause)
    const t = (cur && scope.contains(cur) ? cur : scope);
    t.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
    t.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
  }
  const tab = (padEdge(g, 5) > 0 ? 1 : 0) - (padEdge(g, 4) > 0 ? 1 : 0);
  if (tab) {
    // la rangée d'onglets du focus (un écran peut en avoir plusieurs), sinon la première visible
    const groups = [...scope.querySelectorAll('.tabs')].filter((t) => t.getClientRects().length > 0);
    const grp = groups.find((t) => cur && t.contains(cur)) || groups[0];
    const tabs = grp ? [...grp.querySelectorAll('button')].filter(padVisible) : [], i = tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    if (tabs.length && i >= 0 && tabs[i + tab]) { tabs[i + tab].click(); padFocus(scope, tabs[i + tab]); }
  }
  const primary = [...scope.querySelectorAll(PAD_PRIMARY)].find(padVisible);
  if (padEdge(g, 9) > 0) { // Menu : l'action principale de l'écran (lancer la partie, déployer, rejouer) ; dans la pause, reprendre la partie
    if (MATCH.state === 'paused') resumeGame();
    else if (primary) { sfxUi('click'); primary.click(); }
  }
  padHints(scope, primary, [...scope.querySelectorAll('.tabs')].some((t) => t.getClientRects().length > 0));
}
/* Barre d'invites en bas à droite, tant que la manette a la main dans un menu, la pause ou les résultats (pas au doigt) : ce que font A, B, LB RB
   et Menu sur l'écran affiché, avec les glyphes des boutons (padGlyph) ; écrite seulement si elle change */
function padHints(scope, primary, tabs) {
  const el = $('padHints'); if (!el) return;
  if (!scope || TOUCH.on) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); document.body.classList.remove('padbar'); } return; }
  const paused = MATCH.state === 'paused', it = (g, t) => `<span>${g}<b>${esc(t)}</b></span>`;
  const noBack = scope.id === 'scr-main' || scope.id === 'scr-deploy' || scope.id === 'end'; // (rien à quitter : B n'y fait rien)
  const cur = document.activeElement, crow = cur && cur.closest && cur.closest('.lrow, .onav'), adj = !!crow && scope.contains(crow) && (crow._adjK || (crow._r && (crow._r.k === 'seg' || crow._r.k === 'check' || crow._r.k === 'range'))); // une rangée qu'on règle
  const html = (adj ? it(padGlyph(12), _t('Régler')) : '') + it(padGlyph(0), _t('Valider'))
    + (noBack ? '' : it(padGlyph(1), paused && UI.pm === 'home' ? _t('Reprendre') : _t('Retour')))
    + (tabs ? it(padGlyph(4) + padGlyph(5), _t('Onglets')) : '')
    + (paused ? it(padGlyph(9), _t('Reprendre')) : primary ? it(padGlyph(9), (primary.textContent || '').trim()) : '');
  if (el.dataset.k !== html) { el.dataset.k = html; el.innerHTML = html; }
  if (el.classList.contains('hidden')) { el.classList.remove('hidden'); document.body.classList.add('padbar'); }
}

/* À chaque image (09-game.js) : lit la manette et la traduit en actions */
function padTick(dt) {
  const g = padPick();
  if (!PAD.drive || !(MATCH.state === 'menu' || MATCH.state === 'paused' || MATCH.state === 'ended')) padHints(null);
  if (!g) { if (PAD.mx || PAD.mz || PAD.lx || PAD.ly || PAD.fireOn || PAD.adsOn || PAD.sprint || PAD.useT >= 0) padIdle(); return; }
  const st = MATCH.state;
  // la manette a la main dès qu'un bouton s'enfonce ou qu'un bâton sort de sa zone morte ; un clic ou une touche la lui reprend
  if (!PAD.drive) {
    let act = false; for (let i = 0; i < g.buttons.length && !act; i++) act = padDown(g, i);
    for (let i = 0; i < 4 && !act; i++) act = Math.abs(g.axes[i]) > 0.4;
    if (act) { PAD.drive = true; document.body.classList.add('padnav'); }
  }
  if (PAD.drive) {
    if (st === 'playing') {
      if (!CHAT.open) padPlay(g, dt); else padIdle();
      if (padEdge(g, 9) > 0 && !CHAT.open) pauseGame();
      if ($('lockPrompt').classList.contains('show')) showLockPrompt(false);
    } else {
      if (PAD.mx || PAD.mz || PAD.lx || PAD.ly || PAD.fireOn || PAD.adsOn || PAD.sprint || PAD.useT >= 0) padIdle();
      if (st === 'killcam' && padEdge(g, 0) > 0) kcSkip();
      else if (st === 'menu' || st === 'paused' || st === 'ended') padMenu(g, dt);
    }
  }
  for (let i = 0; i < g.buttons.length; i++) PAD.prev[i] = padDown(g, i);
}
/* Plus rien d'actif (pause, discussion, manette débranchée) : on lâche tout ce que la manette tenait */
function padIdle() {
  if (PAD.fireOn) PL.held = false;
  if (PAD.adsOn) PL.adsWant = false;
  if (PAD.l3) PAD.l3 = false;
  PAD.mx = PAD.mz = PAD.lx = PAD.ly = 0; PAD.sprint = false; PAD.fireOn = PAD.adsOn = false; PAD.ramp = 0; PAD.useT = -1;
  if (PAD.jumpOn) { PAD.jumpOn = false; KEYS.Space = false; }
}
/* Regard à la manette, appelé par updatePlayer : radians par seconde, plus lent quand le champ de vision se resserre (lunette) */
function padLook(dt) {
  if (!(PAD.lx || PAD.ly) || KS.map.open) return;
  const zoom = camera.fov / Settings.fov, acc = PAD_ACCEL[Settings.padAccel], gain = 1 + (acc === undefined ? PAD_ACCEL.normal : acc) * PAD.ramp * (1 - 0.5 * clamp(VM.ads, 0, 1));
  const k = Settings.padSens * 3.4 * gain * (0.35 + 0.65 * zoom) * adsLookMul(Settings.padAdsMul) * AIM.fr * dt; // AIM.fr : ralentissement sur la cible (09qd-visee.js)
  PL.yaw -= PAD.lx * k; PL.pitch -= PAD.ly * k * 0.8 * (Settings.invertY ? -1 : 1);
  VM.swayTX += PAD.lx * k * 0.35; VM.swayTY += PAD.ly * k * 0.35;
}

addEventListener('gamepadconnected', (e) => {
  PAD.id = e.gamepad ? e.gamepad.id : '';
  if (PAD.seen) return;
  PAD.seen = true;
  if (!Settings.padSeen) { Settings.padSeen = true; saveSettings(); }
  for (const O of OPTS) if (O.rebuild) O.rebuild(); // les réglages de la manette apparaissent dans les Options
});
addEventListener('gamepaddisconnected', () => { if (!padPick()) { padIdle(); PAD.drive = false; document.body.classList.remove('padnav'); if (MATCH.state === 'playing') pauseGame(); } });
// un clic ou une touche rend la main à la souris et au clavier (capture de la souris à nouveau demandée au prochain clic dans le jeu)
const padHand = (e) => { if (!PAD.drive || !e.isTrusted) return; PAD.drive = false; document.body.classList.remove('padnav'); padIdle(); padHints(null); };
addEventListener('pointerdown', padHand, true); addEventListener('keydown', padHand, true);
// la souris reprend la main dès qu'elle glisse (quelques pixels : un curseur immobile, ou qui bouge tout seul sous un écran qui défile, ne la reprend pas) ; sinon le curseur reste caché
// et ne survole plus rien (body.padnav : voir shell.html), donc plus de double surbrillance avec le focus de la manette
let padMouse = null, padMoved = 0;
addEventListener('mousemove', (e) => {
  if (!e.isTrusted) return;
  const p = padMouse; padMouse = [e.screenX, e.screenY];
  if (!PAD.drive || !p) { padMoved = 0; return; }
  padMoved += Math.abs(e.screenX - p[0]) + Math.abs(e.screenY - p[1]);
  if (padMoved >= 6) { padMoved = 0; padHand(e); }
}, true);
// manette déjà connue d'une visite précédente : les réglages sont visibles dès l'ouverture des Options
if (Settings.padSeen) PAD.seen = true;
