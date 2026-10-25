/* ==========================================================================
   LANGUES : français et anglais
   Les textes du code sont écrits en français : _t('texte') renvoie ce texte tel quel en français et sa traduction en anglais
   (dictionnaire i18n/en.txt, intégré par build.py à la place du marqueur ci-dessous). Une clé sans traduction reste en français.
   Paramètres : _t('Niveau {0} sur {1}', n, max). Pluriels : _tn(n, '{0} ennemi', '{0} ennemis', ...autres) (n est {0} ; le français compte 0 et 1 au singulier,
   l'anglais seulement 1). La langue se choisit au chargement de la page (Options > Jeu > Langue) : anglais par défaut, français
   si le navigateur le demande en premier ; un changement recharge la page. Voir README, « Langues ».
   ========================================================================== */
const I18N_EN = /*__I18N_EN__*/ {};
const I18N_MISS = new Set(); // clés absentes du dictionnaire rencontrées en anglais (contrôle : tools/dev/check_i18n.py)
/* Langue choisie : 'auto', 'en' ou 'fr' (enregistrée avec les réglages) ; la langue effective, LANG, est 'en' ou 'fr' */
const LANG_PREF = (() => {
  try { const s = JSON.parse(localStorage.getItem('dc_settings') || 'null'); if (s && (s.lang === 'en' || s.lang === 'fr')) return s.lang; } catch (e) { /* ignoré */ }
  return 'auto';
})();
const LANG = (() => {
  if (LANG_PREF !== 'auto') return LANG_PREF;
  const l = (typeof navigator !== 'undefined' && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) || [];
  for (const x of l) { const c = String(x || '').slice(0, 2).toLowerCase(); if (c === 'fr' || c === 'en') return c; }
  return 'en';
})();
const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-US';
const PCT = LANG === 'fr' ? ' %' : '%'; // « 10 % » en français, « 10% » en anglais
function _t(fr, ...a) {
  let s = fr;
  if (LANG === 'en') { const e = I18N_EN[fr]; if (e !== undefined && Object.prototype.hasOwnProperty.call(I18N_EN, fr)) s = e; else I18N_MISS.add(fr); }
  return a.length ? s.replace(/\{(\d+)\}/g, (m, i) => (+i < a.length ? String(a[+i]) : m)) : s;
}
/* Pluriel : one sert pour 1 en anglais, pour 0 et 1 en français ; les deux formes se traduisent séparément */
function _tn(n, one, many, ...a) { return _t((LANG === 'en' ? n === 1 : n < 2) ? one : many, n, ...a); }
/* Nombre et date selon la langue */
function fmtNum(n, digits) { return Number(n).toLocaleString(LOCALE, digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function fmtDate(d, opts) { return d.toLocaleDateString(LOCALE, opts); }
/* Traduit les textes statiques de la page (shell.html) : nœuds de texte et attributs dont le texte est une clé du dictionnaire */
function i18nDom(root) {
  if (LANG !== 'en') return;
  const tr = (s) => { const k = s.trim(); if (!k || !Object.prototype.hasOwnProperty.call(I18N_EN, k)) return s; return s.replace(k, () => I18N_EN[k]); };
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === 3) { const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; continue; }
    if (n.nodeType !== 1) continue;
    for (const a of ['aria-label', 'placeholder', 'title', 'alt']) if (n.hasAttribute && n.hasAttribute(a)) { const v = n.getAttribute(a), r = tr(v); if (r !== v) n.setAttribute(a, r); }
  }
}
document.documentElement.lang = LANG;
i18nDom(document.body);
if (LANG === 'en') document.title = _t(document.title); // titre de l'onglet (dans <head>, hors de body)
