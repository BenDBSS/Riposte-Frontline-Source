/* Vérification au démarrage : node tools/dev/visual/demarrage.js
   Sans elle (src/00b-preflight.js), un contexte WebGL refusé ou un three.js absent laissait l'écran sur « Chargement de three.js » sans un mot (un Pixel, juste après
   une interruption de l'affichage 3D : Chrome bloque alors quelques minutes la création d'un contexte pour la page). Émule, dans un vrai navigateur :
   - la création du contexte refusée quelques secondes (« Web page caused context loss and was blocked ») : le message d'attente s'affiche, la page se recharge d'elle-même
     et le jeu démarre quand le contexte redevient possible ;
   - un three.js qui ne se charge pas : le message et le nouvel essai ;
   - un démarrage qui s'arrête sur une erreur du script : le message avec l'erreur et le bouton pour recharger.
   Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
const open = (init) => openGame({ mobile: true, w: 987, h: 444, dpr: 1, settings: { quality: 'low', lang: 'fr' }, noMap: true, noHdri: true, init, gate: true });
(async () => {
  // 1. création du contexte refusée pendant 12 s (à partir du premier essai)
  const BLOCK = "window.__PRE_WATCH = 3000; (() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { if (/webgl/.test(t) && (+sessionStorage.getItem('__t0') || (sessionStorage.setItem('__t0', String(Date.now())), Date.now())) + 12000 > Date.now()) { this.dispatchEvent(Object.assign(new Event('webglcontextcreationerror'), { statusMessage: 'Web page caused context loss and was blocked' })); return null; } return g.call(this, t, a); }; })();";
  let { browser, page } = await open(BLOCK);
  await page.waitForFunction("/bloqué l'affichage 3D/.test(document.getElementById('loadMsg').textContent)", null, { timeout: 30000 });
  await page.waitForTimeout(4000); // la vérification du démarrage (avancée à 3 s) ne doit pas proposer « Recharger » : recharger ne débloque pas Chrome
  const m1 = await page.evaluate(() => ({ txt: document.getElementById('loadMsg').textContent, booted: PRE.booted, btn: !!document.querySelector('#loading .load-inner > button') }));
  ok(!m1.booted && /Forcer l'arrêt/.test(m1.txt) && /Attente : \d+ s/.test(m1.txt) && /was blocked/.test(m1.txt) && !m1.btn, `contexte refusé : message (arrêter Chrome), attente et motif du navigateur, pas de bouton (« ${m1.txt.slice(0, 70)}... »)`);
  await page.waitForFunction("(() => { try { return MATCH.state === 'menu'; } catch (e) { return false; } })()", null, { timeout: 300000, polling: 500 }); // MATCH n'existe pas encore tant que le script est arrêté
  const tl = await page.evaluate(() => GPU_EV.map((e) => e[2]));
  ok(tl.some((m) => /WebGL unavailable at start/.test(m)) && tl.some((m) => /WebGL available again/.test(m)), `contexte redevenu possible : la page s'est rechargée et le jeu a démarré (${tl.filter((m) => /WebGL/.test(m)).join(' > ').slice(0, 120)})`);
  await browser.close();

  // 2. three.js qui ne se charge pas
  ({ browser, page } = await open("Object.defineProperty(window, 'THREE', { configurable: true, get() { return undefined; }, set() {} });"));
  await page.waitForFunction("/three.js n'a pas pu/.test(document.getElementById('loadMsg').textContent)", null, { timeout: 30000 });
  ok(true, 'three.js absent : message et nouvel essai annoncés');
  await browser.close();

  // 3. démarrage arrêté par une erreur du script (contexte principal refusé, l'essai de vérification passe) : message avec l'erreur et bouton
  ({ browser, page } = await open("window.__PRE_WATCH = 3000; (() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { if (/webgl/.test(t) && a && a.powerPreference) return null; return g.call(this, t, a); }; })();"));
  await page.waitForFunction("/Le démarrage n'a pas abouti/.test(document.getElementById('loadMsg').textContent)", null, { timeout: 30000 });
  const m3 = await page.evaluate(() => ({ txt: document.getElementById('loadMsg').textContent, btn: !!document.querySelector('#loading .load-inner > button') }));
  ok(/WebGL: no context/.test(m3.txt) && m3.btn, `démarrage arrêté : l'erreur est dite, bouton pour recharger (« ${m3.txt.slice(0, 80)}... »)`);
  await page.screenshot({ path: (process.argv[2] || '/tmp') + '/demarrage-bloque.png' }).catch(() => {});
  await browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
