/* ==========================================================================
   NOUVEAUTÉS : journal des mises à jour.
   Les données viennent de changelog.json (validé et intégré par build.py, du plus récent au plus ancien).
   - menu Nouveautés : historique des NEWS_MAX dernières mises à jour (numéro de version et liste des changements, sans titre), pastille
     « Nouveau » tant que la dernière n'a pas été vue ;
   - fenêtre « Quoi de neuf » en plein écran : seulement pour une grande version (X.0.0, la seule qui porte un titre), une seule fois
     au lancement qui suit sa publication (mémorisée dans le navigateur). Les autres mises à jour ne sont pas annoncées à l'arrivée.
   Une nouvelle publication = une nouvelle entrée en tête de changelog.json (voir README).
   ========================================================================== */
const CHANGELOG = JSON.parse($('changelogData').textContent);
const GAME_VERSION = CHANGELOG[0].version;
const NEWS_MAX = 10;
const NEWS_TAG = { new: _t('Nouveau'), improved: _t('Amélioré'), fixed: _t('Corrigé') };
const newsDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number), s = fmtDate(new Date(Date.UTC(y, m - 1, d)), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return LANG === 'fr' && d === 1 ? s.replace(/^1 /, '1er ') : s;
};
/* Textes d'une entrée du journal : changelog.json porte le français (title, x) et l'anglais (title_en, x_en) */
const newsTitle = (r) => (LANG === 'en' && r.title_en) || r.title || '';
const vkey = (v) => v.split('.').map(Number);
const vNewer = (a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
/* La grande version (X.0.0) publiée depuis la dernière version vue : celle qu'on annonce en plein écran (aucune pour un nouveau joueur) */
const newsMajor = () => { const seen = newsSeenGet(); return seen ? CHANGELOG.find((r) => /^\d+\.0\.0$/.test(r.version) && vNewer(r.version, seen)) || null : null; };
const newsText = (c) => (LANG === 'en' && c.x_en) || c.x;
const newsSeenGet = () => { try { return localStorage.getItem('cod_seen_version'); } catch (e) { return null; } };
function newsMarkSeen() { try { localStorage.setItem('cod_seen_version', GAME_VERSION); } catch (e) { /* stockage indisponible */ } newsBadge(); }
const newsUnseen = () => newsSeenGet() !== GAME_VERSION;
const newsChanges = (list) => list.map((c) => `<li><span class="tg ${c.t}">${NEWS_TAG[c.t]}</span><span>${esc(newsText(c))}</span></li>`).join('');

function renderNews() {
  const list = CHANGELOG.slice(0, NEWS_MAX);
  $('newsSub').textContent = list.length > 1 ? _t('Version actuelle : {0}. Les {1} dernières mises à jour.', GAME_VERSION, list.length) : _t('Version actuelle : {0}. Dernières nouveautés.', GAME_VERSION);
  $('newsList').innerHTML = list.map((r, i) => `<article class="rel${i === 0 ? ' latest' : ''}">
    <div class="rel-head"><b>${esc(r.version)}</b>${newsTitle(r) ? `<em>${esc(newsTitle(r))}</em>` : ''}${i === 0 ? `<i>${_t('Dernière')}</i>` : ''}<span>${newsDate(r.date)}</span></div>
    <ul class="chg">${newsChanges(r.changes)}</ul></article>`).join('');
  newsMarkSeen();
}
/* Pastille « Nouveau » du menu principal et numéro de version */
function newsBadge() {
  $('mmNewsBadge').classList.toggle('hidden', !newsUnseen());
  $('mmNews').textContent = _t('Version {0}', GAME_VERSION);
  $('verTag').textContent = _t('Version {0}', GAME_VERSION);
}
function newsClose() { $('whatsnew').classList.add('hidden'); newsMarkSeen(); }
/* Fenêtre « Quoi de neuf » : une fois par grande version, jamais sur un lien d'invitation à un salon */
function newsPopup() {
  const r = newsMajor();
  if (!r || new URLSearchParams(location.search).get('salon')) return;
  $('wnKicker').textContent = _t('Mise à jour {0} · {1}', r.version, newsDate(r.date));
  $('wnTitle').textContent = newsTitle(r);
  $('wnList').innerHTML = newsChanges(r.changes);
  $('whatsnew').classList.remove('hidden'); requestAnimationFrame(() => $('wnOk').focus({ preventScroll: true }));
}
function newsInit() {
  // premier lancement d'un nouveau joueur : rien à annoncer, la version courante est simplement mémorisée
  let existing = false; try { existing = localStorage.getItem('dc_settings') !== null; } catch (e) { /* ignoré */ }
  if (newsSeenGet() === null && !existing) newsMarkSeen();
  $('wnOk').addEventListener('click', () => { newsClose(); sfxUi('click'); });
  $('wnMore').addEventListener('click', () => { newsClose(); uiGo('news'); });
  // la fenêtre garde le clavier : Échap la ferme, les flèches ne déplacent pas le menu en dessous
  addEventListener('keydown', (e) => {
    if ($('whatsnew').classList.contains('hidden')) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); newsClose(); }
    else if (e.code.startsWith('Arrow')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  newsBadge();
}
