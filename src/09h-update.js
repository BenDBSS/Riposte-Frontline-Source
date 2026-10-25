/* ==========================================================================
   MISE À JOUR AUTOMATIQUE
   Un onglet resté ouvert, une page restaurée par le navigateur (retour arrière, onglets rouverts au démarrage, mobile)
   ou un cache trop zélé peuvent faire tourner une ancienne version du jeu. build.py donne à chaque version un
   identifiant (meta cod-build) et publie dist/version.json, que Vercel sert sans cache (vercel.json). Le jeu compare
   les deux au lancement, au retour sur l'onglet, puis toutes les 3 minutes :
   - hors partie et hors salon en ligne (chargement, menus), il recharge aussitôt la page, l'identifiant de la nouvelle
     version dans l'adresse pour passer outre tout cache ;
   - en partie ou dans un salon, un bandeau prévient et le rechargement attend le retour au menu : on ne coupe jamais
     une partie.
   Un seul essai automatique par version et par onglet : si le serveur sert encore l'ancienne page, pas de boucle,
   le bandeau reste avec un bouton pour recharger. Page ouverte depuis le disque (file://) : rien à vérifier.
   ========================================================================== */
const BUILD_ID = (document.querySelector('meta[name="cod-build"]') || {}).content || '';
const UPD = { latest: '', pending: false, lastCheck: -1e9, busy: false, el: null, closed: false, playT: 0 };
const updOn = () => /^https?:$/.test(location.protocol) && /^[0-9a-f]{12}$/.test(BUILD_ID);
/* rechargement sans risque : ni en partie (y compris pause, killcam, tableau de fin), ni dans un salon en ligne */
const updSafe = () => !['playing', 'paused', 'killcam', 'ended'].includes(MATCH.state) && !netInLobby() && !UI.flow && !ACCT.code && !ACCT.busy; // pas pendant un lancement, ni pendant que le code de secours est affiché (il ne vit qu'en mémoire) ou qu'une demande du compte est en route
async function updCheck(force = false) {
  if (!updOn() || UPD.busy) return;
  const now = performance.now();
  if (!force && now - UPD.lastCheck < 20000) return;
  UPD.lastCheck = now; UPD.busy = true;
  try {
    const r = await fetch(new URL('/version.json?t=' + Date.now(), location.href), { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    if (j && /^[0-9a-f]{12}$/.test(j.build) && j.build !== BUILD_ID) { UPD.latest = j.build; UPD.pending = true; updApply(); }
  } catch (e) { /* hors ligne ou fichier absent : nouvel essai au prochain contrôle */ } finally { UPD.busy = false; }
}
function updApply() {
  if (!UPD.pending) return;
  if (updSafe() && updReload()) return;
  updBanner();
}
/* recharge vers la nouvelle version ; renvoie false si c'est déjà fait une fois dans cet onglet pour cette version */
function updReload() {
  let tried = ''; try { tried = sessionStorage.getItem('cod_upd_try') || ''; } catch (e) { /* stockage indisponible */ }
  if (tried === UPD.latest) return false;
  try { sessionStorage.setItem('cod_upd_try', UPD.latest); } catch (e) { /* stockage indisponible */ }
  const u = new URL(location.href); u.searchParams.set('v', UPD.latest); // adresse neuve : aucun cache ne peut la servir
  PAGE_LEAVE.ok = true; location.replace(u.href);
  return true;
}
/* Bandeau (#updBar, style dans shell.html) : en haut au centre, sous la zone sûre ; le joueur peut le fermer. En pleine action, il se pose sous le score
   et s'efface au bout de 8 s (il ne cache rien du jeu) ; il revient au retour aux menus, sauf s'il a été fermé. */
function updBanner() {
  if (UPD.el) return;
  const el = UPD.el = document.createElement('div'); el.id = 'updBar'; el.setAttribute('role', 'status');
  el.innerHTML = '<span id="updMsg"></span><button type="button" class="btn primary"></button><button type="button" class="upd-x"></button>';
  const [go, x] = el.querySelectorAll('button');
  go.textContent = _t('Recharger'); x.setAttribute('aria-label', _t('Fermer')); x.title = _t('Fermer');
  go.addEventListener('click', () => { try { sessionStorage.removeItem('cod_upd_try'); } catch (e) { /* ignoré */ } updReload(); });
  x.addEventListener('click', () => { UPD.closed = true; el.classList.add('hidden'); });
  document.body.appendChild(el);
  updMsgSet();
}
/* Texte de la bannière : quand la mise à jour se chargera ; sa place et sa visibilité selon le moment (appelé chaque seconde) */
function updMsgSet() {
  if (!UPD.el) return;
  const msg = updSafe() ? _t('Nouvelle version du jeu disponible.')
    : netInLobby() && !['playing', 'paused', 'killcam', 'ended'].includes(MATCH.state) ? _t('Nouvelle version du jeu disponible. Elle se chargera en quittant le salon.') : _t('Nouvelle version du jeu disponible. Elle se chargera à la fin de la partie.');
  const m = UPD.el.querySelector('#updMsg'); if (m.textContent !== msg) m.textContent = msg;
  const play = MATCH.state === 'playing' || MATCH.state === 'killcam';
  if (!play) UPD.playT = 0; else if (!UPD.playT) UPD.playT = performance.now();
  UPD.el.classList.toggle('play', play);
  UPD.el.classList.toggle('main', MATCH.state === 'menu' && UI.screen === 'main' && !$('ui').classList.contains('hidden'));
  UPD.el.classList.toggle('hidden', UPD.closed || (play && performance.now() - UPD.playT > 8000));
}
function updInit() {
  // l'adresse de rechargement (?v=...) ne sert qu'une fois : on la retire, sans toucher au reste (lien d'invitation ?salon=...)
  const u = new URL(location.href);
  if (u.searchParams.has('v')) { u.searchParams.delete('v'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
  if (!updOn()) return;
  updCheck(true);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updCheck(); });
  addEventListener('pageshow', (e) => { if (e.persisted) updCheck(true); }); // page restaurée telle quelle par le navigateur
  addEventListener('focus', () => updCheck());
  setInterval(() => updCheck(true), 180000);
  // une mise à jour en attente se fait dès le retour au menu (fin de partie, salon quitté)
  setInterval(() => {
    if (UPD.pending && updSafe()) updApply();
    updMsgSet();
  }, 1000);
}
updInit();
