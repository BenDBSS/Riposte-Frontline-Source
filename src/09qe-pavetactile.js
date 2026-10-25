/* ==========================================================================
   PAVÉ TACTILE (trackpad)
   Retour d'un joueur : « je joue au Magic Trackpad, je ne peux pas viser et tirer en même temps ». Sur un pavé tactile on ne tient pas un clic en
   déplaçant le doigt, ni deux boutons à la fois. Les commandes restent celles du clavier et de la souris (déplacement, sauts, armes aux touches), mais
   quand le pavé tactile est le pointeur principal, il prend l'esprit de l'écran tactile (09qd-visee.js, 09q-tactile.js) :
   - tir automatique (Settings.tpAuto) : on tire tout seul tant que le réticule est sur un ennemi visible, comme au doigt ; le clic ne tire plus ;
   - visée au double clic ou au toucher à deux doigts (Settings.tpDblAds ; le clic droit d'un pavé) : deux clics brefs épaulent, deux autres rangent
     l'arme ; la visée est une bascule, jamais « maintenue » ;
   - l'assistance à la visée (ralentissement, accroche, suivi) s'applique comme au doigt et à la manette (Options, Jeu : « Assistance à la visée ») ;
   - sensibilité propre (Settings.tpSens, Options, Jeu) : celle de la souris au premier lancement, puis indépendante (08-player.js, updatePlayer) ;
   - la molette ne change plus d'arme (le défilement à deux doigts d'un pavé la ferait changer à chaque geste) : les touches 1, 2 et Q s'en chargent.
   Le navigateur ne dit pas si le pointeur est un pavé ou une souris : Settings.tpMode vaut « auto » (détection), « on » ou « off » (Options, Jeu).
   Détection (trackpadWheel) : un geste de défilement du pavé est une salve d'au moins cinq évènements de molette rapprochés qui bouge aussi en largeur,
   ou une longue salve qui s'éteint (l'élan du doigt levé) ; un cran de molette est un évènement isolé et rond (par lignes, ou un multiple de 100 ou 120
   pixels). Un pas fractionnaire ne prouve rien : une souris en donne avec un zoom du navigateur ou une mise à l'échelle de l'écran (retour d'un joueur :
   « après les réglages, je ne peux plus tirer », le défilement des Options à la molette l'avait pris pour un pavé). Deux gestes de pavé de suite posent
   Settings.tpSeen (gardé d'une session à l'autre), deux crans de souris l'enlèvent, et un clic gauche tenu (trackpadHold) aussi : au pavé, on ne tient
   pas le clic, c'est même la raison du mode. Le défilement des menus suffit à le voir avant la partie. Chaque bascule faite par la détection pendant une
   partie est dite à l'écran (trackpadNote, à la reprise si elle a eu lieu pendant la pause), la première au départ de la partie aussi (Settings.tpHint).
   La visée en bascule (Settings.adsToggle, Options, Jeu) existe aussi à la souris : un clic droit épaule, un autre range l'arme.
   Contrôle : node tools/dev/visual/pavetactile.js
   ========================================================================== */
const TPAD = { n: 0, t: 0, t0: 0, fine: false, notch: false, big: 0, small: 0, max: 0, last: 0, trackB: 0, mouseB: 0, tap: 0, note: null, holdId: 0, down: false };
/* Le pavé tactile est le pointeur principal (hors écran tactile et manette, qui ont leurs commandes) */
function trackpadOn() { return !TOUCH.on && !PAD.drive && (Settings.tpMode === 'on' || (Settings.tpMode !== 'off' && !!Settings.tpSeen)); }
/* La visée se bascule (au lieu de se tenir) : au pavé tactile, ou à la souris si le joueur l'a choisi */
function adsToggleMode() { return trackpadOn() || !!Settings.adsToggle; }
/* Actions qui font quitter la visée en bascule : à la fin du rechargement ou d'une course, on ne revient pas en visée sans l'avoir voulu */
const ADS_UNAIM = new Set(['KeyR', 'Digit1', 'Digit2', 'KeyQ', 'KeyF', 'KeyG', 'KeyE', 'Digit4', 'Digit5', 'Digit6', 'ShiftLeft']);
/* Réglage changé (Options) ou pavé tactile vu : les commandes d'avant sont lâchées, la classe du corps montre ou cache les rangées d'options du pavé (shell.html,
   data-tp) sans reconstruire la liste, qui défile peut-être en ce moment même sous le doigt */
function trackpadSync() {
  PL.held = false; PL.queued = false; if (adsToggleMode()) PL.adsWant = false; TPAD.tap = 0;
  document.body.classList.toggle('trackpad', trackpadOn());
}
/* Clic gauche au pavé tactile : le second clic d'un double clic épaule ou range l'arme ; le premier ne tire que sans tir automatique */
function trackpadClick(e) {
  TPAD.down = true; trackpadHold();
  const dbl = Settings.tpDblAds !== false && TPAD.tap && e.timeStamp - TPAD.tap <= 380;
  TPAD.tap = dbl ? 0 : e.timeStamp;
  if (dbl) { PL.adsWant = !PL.adsWant; return; }
  if (Settings.tpAuto === false) { PL.held = true; PL.queued = true; }
}
/* Clic droit (au pavé : toucher à deux doigts) : épauler ou ranger l'arme en bascule */
function adsToggleClick() { PL.adsWant = !PL.adsWant; }
/* Évènement de molette (menus compris) : cherche la signature d'un pavé tactile ou d'une souris */
function trackpadWheel(e) {
  const now = e.timeStamp;
  if (now - TPAD.t > 140) trackpadBurst(); // une salve est finie
  if (!TPAD.n) TPAD.t0 = now;
  TPAD.t = now; TPAD.n++;
  const dy = Math.abs(e.deltaY), dx = Math.abs(e.deltaX), wd = e.wheelDeltaY;
  TPAD.max = Math.max(TPAD.max, dy); TPAD.last = dy;
  if (e.deltaMode === 1) TPAD.notch = true; // par lignes : une molette
  else if (e.deltaMode === 0) {
    if (dx > 0) TPAD.fine = true;
    if (dy >= 100 && dx === 0 && Number.isInteger(e.deltaY) && (dy % 100 === 0 || dy % 120 === 0 || (wd && wd % 120 === 0))) TPAD.big++; // un cran rond
  }
}
function trackpadBurst() {
  // pavé : des pas en largeur, ou une longue salve qui s'éteint (l'élan du doigt levé, que seul un pavé ou une souris tactile donne)
  const n = TPAD.n, notch = TPAD.notch || (TPAD.big >= 1 && n <= 3), long = n >= 10 && TPAD.t - TPAD.t0 >= 300 && TPAD.max < 80 && TPAD.last <= Math.max(3, TPAD.max * 0.3);
  const fine = (n >= 5 && TPAD.fine) || long;
  TPAD.n = 0; TPAD.fine = false; TPAD.notch = false; TPAD.big = 0; TPAD.max = 0; TPAD.last = 0;
  if (!n) return;
  if (notch) { TPAD.trackB = 0; if (++TPAD.mouseB >= 2) trackpadSeen(false); }
  else if (fine) { TPAD.mouseB = 0; if (++TPAD.trackB >= 2) trackpadSeen(true); }
}
function trackpadSeen(v) {
  if (!!Settings.tpSeen === v) return;
  Settings.tpSeen = v; saveSettings();
  trackpadSync();
  if (Settings.tpMode !== 'auto') return;
  TPAD.note = v ? 'pad' : 'mouse';
  if (MATCH.state === 'playing') trackpadNote();
}
/* Bascule de la détection : dite à l'écran en partie (à la reprise si elle a eu lieu pendant la pause, au départ de la partie si c'était dans les menus) */
function trackpadNote() {
  if (!TPAD.note || MATCH.state !== 'playing') return;
  Settings.tpHint = true; saveSettings();
  hudMsg(TPAD.note === 'pad' ? _t('Pavé tactile détecté. Tir automatique et double clic pour viser (Options, Jeu)') : _t('Souris détectée. Le clic gauche tire de nouveau (Options, Jeu)'), 'xp', 5);
  TPAD.note = null;
}
/* Clic gauche tenu en mode pavé détecté : c'est une souris (au pavé, on ne tient pas le clic). Le mode s'éteint et le tir part, sans relâcher. */
function trackpadHold() {
  clearTimeout(TPAD.holdId);
  if (Settings.tpMode !== 'auto') return;
  TPAD.holdId = setTimeout(() => {
    if (!trackpadOn() || !TPAD.down || MATCH.state !== 'playing') return;
    trackpadSeen(false); PL.held = true; PL.queued = true;
  }, 350);
}
/* Au début d'une partie (décompte) ou dès qu'il est vu en partie : une seule fois, un mot sur le pavé tactile détecté tout seul */
function trackpadHint() {
  if (TPAD.note && Settings.tpMode === 'auto') { TPAD.note = trackpadOn() ? 'pad' : 'mouse'; trackpadNote(); return; }
  if (!trackpadOn() || Settings.tpMode !== 'auto' || Settings.tpHint) return;
  Settings.tpHint = true; saveSettings();
  hudMsg(_t('Pavé tactile détecté. Tir automatique et double clic pour viser (Options, Jeu)'), 'xp', 5);
}
addEventListener('wheel', trackpadWheel, { passive: true });
setInterval(() => { if (TPAD.n && performance.now() - TPAD.t > 200) trackpadBurst(); }, 250); // une dernière salve, une fois le geste terminé
if (document.body) document.body.classList.toggle('trackpad', trackpadOn());
