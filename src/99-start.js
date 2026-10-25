/* ==========================================================================
   DÉMARRAGE : après tous les modules (la fenêtre d'installation, 09r-pwa.js, doit exister). Sur écran tactile dans un navigateur, le jeu
   ne démarre pas tant que l'installation n'est pas faite ou écartée (voir README, « Version mobile ») ; ailleurs, il démarre aussitôt.
   ========================================================================== */
if (!window.WebGLRenderingContext) $('loadMsg').textContent = _t('WebGL est indisponible sur ce navigateur.');
else if (!pwaGate(boot)) boot();
