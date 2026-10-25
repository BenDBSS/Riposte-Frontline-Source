/* Politique de sécurité du contenu (CSP, posée par build.py dans la page) : le jeu ouvert avec elle (les autres outils la lèvent), menus,
   chargement de cartes et quelques secondes de partie, puis la liste de ce qu'elle a bloqué (événement securitypolicyviolation) : rien
   ne doit l'être. Vérifie aussi qu'elle mord : un attribut onerror glissé dans la page ne s'exécute pas.
   node tools/dev/visual/csp.js ; MAPS=sable,embruns,givre (par défaut) ; PAGE=autre/version.html */
const { openGame } = require('./common');
const MAPS = (process.env.MAPS || 'sable,embruns,givre').split(',');
(async () => {
  const init = `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.effectiveDirective + ' ' + (e.blockedURI || '(en ligne)') + ' ' + (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber));`;
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, csp: true, init, noMap: true, settings: { quality: 'medium', lang: 'fr', map: MAPS[0] } });
  let bad = 0;
  const report = async (what) => {
    const v = await page.evaluate(() => window.__csp.splice(0));
    const real = v.filter((x) => !/_vercel\/insights/.test(x)); // hors Vercel, le script d'Analytics n'existe pas (file://)
    console.log((real.length ? 'BLOQUÉ ' : 'ok     ') + ': ' + what + (real.length ? ' : ' + real.slice(0, 6).join(' | ') : ''));
    bad += real.length;
  };
  await report('démarrage et menus');
  // la CSP mord : un script glissé dans la page par une faille ne s'exécute pas
  const xss = await page.evaluate(async () => { document.body.insertAdjacentHTML('beforeend', '<img id="cspX" src="data:," onerror="window.__xss=1">'); await new Promise((r) => setTimeout(r, 300)); document.getElementById('cspX').remove(); const v = window.__csp.splice(0); return { ran: !!window.__xss, blocked: v.length }; });
  console.log((xss.ran || !xss.blocked ? 'ÉCHEC  ' : 'ok     ') + ': attribut onerror injecté ' + (xss.ran ? 'exécuté' : 'bloqué'));
  if (xss.ran || !xss.blocked) bad++;
  for (const m of MAPS) {
    await page.evaluate(async (m) => { Settings.map = m; await mapEnsure(m); if (CURMAP.def.atmo.hdri) await hdriFetch(CURMAP.def.atmo.hdri).ready; }, m);
    await page.evaluate(() => { LOCK.fallback = true; startMatch({}); PL.ent.protT = 1e9; });
    await page.waitForTimeout(3000);
    await page.evaluate(() => { if (typeof endMatch === 'function' && MATCH.state === 'playing') endMatch(); });
    await report('carte ' + m + ' (chargement, HDRI, quelques secondes de partie)');
  }
  const errs = logs.filter((l) => /Content Security Policy|Refused to/i.test(l) && !/_vercel/.test(l));
  if (errs.length) { console.log('journal :', errs.slice(0, 5)); bad += errs.length; }
  console.log(bad ? `\n${bad} blocage(s) : la CSP de build.py gêne le jeu` : '\nla CSP ne bloque rien du jeu');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
