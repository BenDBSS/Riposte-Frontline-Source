/* ==========================================================================
   MUSIQUE DES MENUS
   Le thème (dist/menu-theme.mp3, à côté du HTML) joue dans les menus principaux et s'éteint en fondu dès le lancement
   d'une partie (écran de chargement, choix de la classe compris ; il revient si on annule). Au retour d'une partie
   il repart du début de la piste. Ni la pause, ni les résultats n'ont de musique.
   Le fichier n'est pas dans le HTML : il n'est téléchargé (en flux) que quand les menus sont affichés, et son adresse
   porte un numéro de version (build.py) pour rester en cache. S'il manque, le jeu est simplement silencieux.
   Le volume est Musique x Volume général (Options, Audio).
   ========================================================================== */
const MUS = { el: null, url: '', vol: 0, pending: false, blocked: false, dead: false };
const MUS_FADE_IN = 1.2, MUS_FADE_OUT = 3.5; // vitesses de fondu (par seconde)

function musicInit() {
  const m = document.querySelector('meta[name="menu-music"]');
  MUS.url = m ? m.content : ''; if (!MUS.url) MUS.dead = true;
  // le navigateur n'autorise le son qu'après un geste : le premier clic ou la première touche relance la lecture
  // (Safari sur iPhone n'accepte la lecture que dans un geste complet : on relance aussi à la fin du toucher et au clic, directement dans le geste)
  const unlock = () => { MUS.blocked = false; if (MUS.el && MUS.el.paused && MATCH.state === 'menu') { const p = MUS.el.play(); if (p && p.catch) p.catch(() => { /* refusé : musicTick réessaiera */ }); } };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && MUS.el) MUS.el.pause(); });
}
/* Retour au menu principal (partie quittée ou terminée) : le thème repart du début de la piste, en fondu */
function musicRestart() {
  MUS.vol = 0;
  if (!MUS.el) return;
  MUS.el.volume = 0;
  try { MUS.el.currentTime = 0; } catch (e) { /* flux pas encore prêt : il démarrera au début de toute façon */ }
}
/* Appelée à chaque image de la boucle de jeu */
function musicTick(dt) {
  const M = MUS; if (M.dead) return;
  const want = MATCH.state === 'menu' && !UI.flow && !document.hidden; // le lancement d'une partie (chargement compris) coupe la musique
  const target = want ? clamp(Settings.music * Settings.volume, 0, 1) : 0;
  M.vol += (target - M.vol) * Math.min(1, dt * (target > M.vol ? MUS_FADE_IN : MUS_FADE_OUT));
  if (!M.el) {
    if (!want) return;
    M.el = new Audio(); M.el.preload = 'none'; M.el.loop = true; M.el.volume = 0;
    M.el.addEventListener('error', () => { M.dead = true; });
    M.el.src = M.url;
  }
  if (want && M.el.paused && !M.blocked && !M.pending) {
    M.pending = true;
    const p = M.el.play();
    if (p && p.then) p.then(() => { M.pending = false; }, (e) => { M.pending = false; if (e && e.name === 'NotAllowedError') M.blocked = true; else M.dead = true; });
    else M.pending = false;
  }
  M.el.volume = clamp(M.vol, 0, 1);
  if (!want && M.vol < 0.003 && !M.el.paused) M.el.pause();
}
