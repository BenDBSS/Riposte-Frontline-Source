/* ==========================================================================
   APPLICATION INSTALLABLE (PWA) : sur téléphone, le jeu se joue installé. Il s'ajoute à l'écran d'accueil et s'ouvre ensuite en plein
   écran, sans barre d'adresse (manifeste généré par build.py, service worker assets/pwa/sw.js copié dans dist/).
   - le service worker ne garde en cache que les fichiers à empreinte (/tex, /maps, /icons) : la page, l'API et version.json restent
     toujours frais, la mise à jour automatique du jeu (09h-update.js) ne change pas ;
   - dans le navigateur d'un écran tactile, le jeu ne démarre pas : la fenêtre d'installation s'affiche d'abord, tout de suite (en portrait
     comme en paysage : « Tournez votre appareil » ne passe pas devant), et le jeu n'est lancé (99-start.js) qu'une fois l'application
     ouverte depuis son icône, ou si le joueur déroge (« Impossible d'installer ? », puis « Jouer dans le navigateur quand même », une
     semaine) :
       Android (Chrome, Edge, Samsung Internet) : le navigateur annonce l'installation (« beforeinstallprompt »), un bouton la lance ;
       iPhone et iPad : Apple n'offre aucune invite, la fenêtre montre le geste (Partager, « Sur l'écran d'accueil ») ;
       autre navigateur sans annonce : le geste dans le menu du navigateur ;
   - la dérogation existe parce que l'installation est parfois impossible (navigateur intégré à une application, navigateur sans
     installation) : sans elle, ces joueurs ne pourraient plus jouer du tout ;
   - les anciens liens de compte reçus par e-mail (?verif, ?mdp : le Profil dit qu'ils ne servent plus), ?navigateur et ?diag (rapport graphique)
     passent sans fenêtre ; un lien d'invitation (?salon) est retenu
     un moment pour l'application (qui s'ouvre sans l'adresse) ;
   - une carte discrète du menu principal rappelle l'installation à qui joue dans le navigateur. Le jeu lancé depuis l'icône n'en parle plus.
   Voir README, « Version mobile ».
   ========================================================================== */
const PWA = { prompt: null, ios: false, standalone: false, wait: 0, gate: false, alt: false, done: false, start: null, title0: '', lead0: '' };
const PWA_BROWSER = 7 * 24 * 3600 * 1000, PWA_INSTALLED = 90 * 24 * 3600 * 1000, PWA_SALON = 30 * 60 * 1000;

const pwaGet = (k) => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
const pwaSet = (k) => { try { localStorage.setItem(k, String(Date.now())); } catch (e) { /* ignoré */ } };
function pwaStandalone() {
  try { return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || !!navigator.standalone; } catch (e) { return false; }
}
const pwaInstalled = () => Date.now() - pwaGet('dc_pwa_in') < PWA_INSTALLED; // installé sur cet appareil (ou lancé depuis l'icône) depuis moins de 90 jours
const pwaBrowserOk = () => Date.now() - pwaGet('dc_pwa_ok') < PWA_BROWSER; // dérogation en cours : jeu dans le navigateur accepté
/* Faut-il rappeler l'installation (carte du menu) ? Écran tactile, hors application installée */
const pwaCan = () => COARSE && !deckLooksLike() && !PWA.standalone && !pwaInstalled();
const pwaMode = () => (PWA.done ? 'done' : PWA.prompt ? 'prompt' : PWA.ios ? 'ios' : PWA.gate && pwaInstalled() ? 'installed' : PWA.wait ? 'wait' : 'manual');

/* Carte du menu principal : rappel discret, toujours là tant que le jeu n'est pas installé */
function pwaCard() { $('pwaCard').classList.toggle('hidden', !pwaCan()); }

const PWA_IC = {
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  add: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  dots: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
/* Contenu de la fenêtre selon le cas : bouton d'installation, ou les gestes à faire à la main */
function pwaRender() {
  const m = pwaMode(), steps = $('poSteps'), note = $('poNote'), box = $('pwaOffer');
  const L = m === 'ios'
    ? [['share', _t('Touchez Partager dans Safari (le carré avec une flèche vers le haut).')], ['add', _t('Choisissez "Sur l\u0027écran d\u0027accueil".')], ['ok', _t('Touchez Ajouter, puis lancez le jeu depuis sa nouvelle icône.')]]
    : m === 'manual'
      ? [['dots', _t('Ouvrez le menu du navigateur (les trois points).')], ['add', _t('Touchez "Installer l\u0027application" ou "Ajouter à l\u0027écran d\u0027accueil".')], ['ok', _t('Confirmez, puis lancez le jeu depuis sa nouvelle icône.')]]
      : [];
  steps.innerHTML = L.map(([ic, tx]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true">${PWA_IC[ic]}</svg><span>${esc(tx)}</span></li>`).join('');
  steps.classList.toggle('hidden', !L.length);
  box.classList.toggle('steps', L.length > 0); // gestes à la main : sur écran bas, ils prennent la place des raisons
  box.classList.toggle('plain', m === 'done' || m === 'installed'); // rien à installer : ni raisons ni bouton
  $('poTitle').textContent = m === 'done' ? _t('C\u0027est installé !') : m === 'installed' ? _t('Le jeu est déjà installé') : PWA.title0;
  $('poLead').textContent = m === 'done' ? _t('Ouvrez Riposte: Frontline depuis son icône sur votre écran d\u0027accueil.') : m === 'installed' ? _t('Ouvrez-le depuis son icône. Plein écran, même progression.') : PWA.lead0;
  note.textContent = m === 'ios' ? _t('Sur iPhone et iPad, le jeu se joue en paysage. Désactivez le verrouillage de l\u0027orientation.') : '';
  note.classList.toggle('hidden', m !== 'ios');
  const go = $('poGo'); go.classList.toggle('hidden', m !== 'prompt' && m !== 'wait'); go.disabled = m === 'wait'; // en attente de l'annonce du navigateur : le bouton n'est pas encore actif
  // dérogation : demandée (« Impossible d'installer ? ») ou proposée d'emblée quand le jeu est déjà installé ; hors blocage (carte du menu), « Plus tard » ferme simplement
  $('poHelp').classList.toggle('hidden', !PWA.gate || PWA.alt || m === 'installed');
  $('poAlt').classList.toggle('hidden', PWA.gate && !PWA.alt && m !== 'installed');
  $('poAltTxt').classList.toggle('hidden', !PWA.gate);
  $('poNo').textContent = PWA.gate ? _t('Jouer dans le navigateur quand même') : _t('Plus tard');
}
/* Bloque le démarrage du jeu derrière la fenêtre d'installation (appelée par 99-start.js : start lance le jeu quand le joueur déroge) */
function pwaGate(start) {
  const q = new URLSearchParams(location.search);
  if (!COARSE || deckLooksLike() || PWA.standalone || pwaBrowserOk() || q.has('verif') || q.has('mdp') || q.has('navigateur') || q.has('diag') || q.has('essai') || q.has('outil')) return false;
  const salon = q.get('salon'); if (salon) { try { localStorage.setItem('dc_salon', JSON.stringify({ c: String(salon).slice(0, 8), t: Date.now() })); } catch (e) { /* ignoré */ } }
  PWA.gate = true; PWA.start = start; PWA.wait = PWA.ios ? 0 : setTimeout(() => { PWA.wait = 0; pwaRender(); }, 3500);
  document.body.classList.add('gated'); pwaRender(); $('pwaOffer').classList.remove('hidden'); gpuLog('install gate shown');
  return true;
}
/* Invitation reçue dans le navigateur, ouverte ensuite dans l'application : le code du salon est retenu une demi-heure */
function pwaSalon() {
  try {
    const v = JSON.parse(localStorage.getItem('dc_salon') || 'null'); localStorage.removeItem('dc_salon');
    return v && Date.now() - v.t < PWA_SALON && PWA.standalone ? v.c : null;
  } catch (e) { return null; }
}
/* Dérogation : le joueur joue dans le navigateur (une semaine) ; hors blocage, la fenêtre se ferme simplement */
function pwaBrowser() {
  $('pwaOffer').classList.add('hidden');
  if (!PWA.gate) { pwaCard(); return; }
  gpuLog('install gate left: browser'); pwaSet('dc_pwa_ok'); PWA.gate = false; PWA.alt = false; document.body.classList.remove('gated'); pwaCard();
  const f = PWA.start; PWA.start = null; if (f) f();
}
async function pwaInstall() {
  const p = PWA.prompt; if (!p) return;
  PWA.prompt = null;
  let accepted = false;
  try { p.prompt(); const r = await p.userChoice; accepted = !!r && r.outcome === 'accepted'; } catch (e) { /* invite déjà utilisée : sans conséquence */ }
  if (accepted) pwaDone(); else pwaRender(); // refusée : les gestes à la main prennent le relais
}
/* Installé : en blocage, la fenêtre reste et dit d'ouvrir l'icône ; sinon elle se ferme */
function pwaDone() {
  PWA.prompt = null; pwaSet('dc_pwa_in'); gpuLog('app installed');
  if (PWA.gate) { PWA.done = true; pwaRender(); } else $('pwaOffer').classList.add('hidden');
  pwaCard();
}
function pwaInit() {
  PWA.standalone = pwaStandalone();
  if (PWA.standalone) pwaSet('dc_pwa_in'); // lancé depuis l'icône : on s'en souvient pour le navigateur du même téléphone
  PWA.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  PWA.title0 = $('poTitle').textContent; PWA.lead0 = $('poLead').textContent; // textes ordinaires de la fenêtre (déjà traduits), rétablis après un cas particulier
  // service worker : après le chargement de la page, pour ne pas ralentir le démarrage
  if ('serviceWorker' in navigator) {
    const reg = () => { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* hors HTTPS, ou refusé : le jeu fonctionne sans */ }); };
    if (document.readyState === 'complete') reg(); else addEventListener('load', reg, { once: true });
  }
  $('poGo').addEventListener('click', () => pwaInstall());
  $('poHelp').addEventListener('click', () => { PWA.alt = true; pwaRender(); $('poNo').scrollIntoView({ block: 'nearest' }); });
  $('poNo').addEventListener('click', () => pwaBrowser());
  $('pwaOffer').addEventListener('keydown', (e) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!PWA.gate) $('pwaOffer').classList.add('hidden'); } }, true);
  // la carte du menu : installe d'un toucher quand c'est possible, sinon rouvre la fenêtre et ses gestes
  $('pwaGo').addEventListener('click', () => { if (PWA.prompt) pwaInstall(); else { pwaRender(); $('pwaOffer').classList.remove('hidden'); } });
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); PWA.prompt = e;
    if (PWA.wait) { clearTimeout(PWA.wait); PWA.wait = 0; } // l'annonce est arrivée pendant l'attente : le bouton s'active
    if (!$('pwaOffer').classList.contains('hidden')) pwaRender(); // fenêtre ouverte avec les gestes à la main : le bouton prend le relais
    pwaCard();
  });
  addEventListener('appinstalled', () => pwaDone());
  pwaCard();
}
pwaInit();
