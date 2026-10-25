/* ==========================================================================
   VÉRIFICATION AU DÉMARRAGE
   Les sources sont un seul script : si three.js ne s'est pas téléchargé ou si le navigateur refuse de créer le contexte WebGL (01-core.js), le script s'arrête
   en silence et l'écran reste sur « Chargement de three.js », sans un mot. Un Pixel s'y est retrouvé juste après une interruption de l'affichage 3D : Chrome
   bloque alors la création d'un contexte pour le site (« Web page caused context loss and was blocked ») et, d'après le code de Chromium (blocage par domaine des API
   3D, sans expiration), ne la rend qu'à son propre redémarrage : rechargements et attente n'y font rien, il faut arrêter Chrome. Ce module passe avant tout le reste :
   - three.js absent : message et nouvel essai (rechargement) ;
   - contexte WebGL impossible à créer : message qui dit d'arrêter Chrome, nouvel essai toutes les 3 s malgré tout (un blocage de tous les sites, lui, dure
     quelques secondes), la page se recharge dès que c'est possible ;
   - démarrage qui n'a pas abouti au bout de 25 s (hors fenêtre d'installation) : message avec la première erreur de la page et un bouton pour recharger.
   Tout ce qui est noté va aussi dans le journal chronologique du rapport graphique (dc_gpu_tl, voir 01a-gpu.js).
   ========================================================================== */
const PRE = { err: [], booted: false, blocked: false };
/* Départ voulu par le jeu (rechargement après une perte du contexte, mise à jour) : la confirmation de sortie en partie ne s'affiche pas (09-game.js) */
const PAGE_LEAVE = { ok: false };
addEventListener('error', (e) => { if (PRE.err.length < 3) PRE.err.push(String((e && e.message) || 'error') + (e && e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : '')); });
function preLog(m) {
  try { const k = 'dc_gpu_tl', v = JSON.parse(localStorage.getItem(k) || '[]'); v.push([Date.now(), 'pre', String(m).slice(0, 90)]); localStorage.setItem(k, JSON.stringify(v.slice(-70))); } catch (e) { /* ignoré */ }
}
/* Essai de création d'un contexte WebGL 2 sur une toile jetable, aussitôt libéré (attrs : les attributs demandés par le jeu, voir 01-core.js) */
function preGlTest(attrs) {
  let ok = false, why = '';
  try {
    const c = document.createElement('canvas');
    c.addEventListener('webglcontextcreationerror', (e) => { why = (e && e.statusMessage) || ''; });
    const gl = c.getContext('webgl2', attrs);
    ok = !!gl && !gl.isContextLost() && !!gl.getParameter(gl.VERSION);
    if (!ok && !why) why = gl ? 'context lost at creation' : 'no context';
    if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
  } catch (e) { why = String((e && e.message) || e); }
  return { ok, why };
}
(function preflight() {
  const msg = document.getElementById('loadMsg'); if (!msg) return;
  const say = (t) => { msg.textContent = t; };
  if (typeof THREE === 'undefined') {
    preLog('three.js not loaded'); say(_t('three.js n\u0027a pas pu être téléchargé. Vérifiez la connexion. Nouvel essai dans quelques secondes.'));
    setTimeout(() => location.reload(), 5000); return;
  }
  const r = preGlTest();
  if (!r.ok) {
    preLog('WebGL unavailable at start: ' + r.why); PRE.blocked = true;
    const t0 = Date.now(), show = (why) => say(_t('Chrome a bloqué l\'affichage 3D du jeu après une interruption et ne le rend qu\'à son redémarrage. Fermez le jeu, arrêtez Chrome (Paramètres du téléphone, Applications, Chrome, Forcer l\'arrêt), puis rouvrez le jeu.') + ' ' + _t('Attente : {0} s', Math.round((Date.now() - t0) / 1000)) + (why ? ' (' + why + ')' : ''));
    show(r.why);
    const tick = () => {
      const t = preGlTest();
      if (t.ok) { preLog('WebGL available again after ' + Math.round((Date.now() - t0) / 1000) + ' s: reload'); location.reload(); return; }
      show(t.why); setTimeout(tick, 3000);
    };
    setTimeout(tick, 3000);
  }
  // démarrage qui n'aboutit pas, pour une autre raison (une erreur du script, par exemple)
  setTimeout(() => {
    let gate = false; try { gate = !!PWA.gate; } catch (e) { /* le script s'est arrêté avant PWA */ }
    if (PRE.booted || PRE.blocked || gate || !document.getElementById('loading') || document.getElementById('loading').classList.contains('hidden')) return;
    // l'erreur d'un script d'un autre site (three.js) arrive sans détail (« Script error. ») : on refait l'essai de création du contexte avec les attributs du jeu
    const a = preGlTest({ powerPreference: 'high-performance', antialias: false, stencil: false });
    const why = (PRE.err[0] || '?') + (a.ok ? '' : ' ; WebGL: ' + a.why); preLog('startup stuck: ' + why);
    say(_t('Le démarrage n\'a pas abouti : {0}', why));
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary'; b.textContent = _t('Recharger');
    b.onclick = () => location.reload(); msg.parentNode.insertBefore(b, msg.nextSibling);
  }, window.__PRE_WATCH || 25000);
})();
