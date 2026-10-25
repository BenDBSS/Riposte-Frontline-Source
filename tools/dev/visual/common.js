/* Outils communs : ouverture du jeu dans Chromium sans interface, réseau et musique coupés, carte chargée. three.js et les HDRI sont
   servis par le site (dist/tex) ; les pages construites avant (jsDelivr) les reçoivent de node_modules. */
const { chromium } = require('playwright-core');
const path = require('path');
const HERE = __dirname, REPO = path.resolve(HERE, '../../..');
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
async function openGame(o = {}) {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])] }); // CHROME_ARGS : options de plus (ex. --js-flags=--allow-natives-syntax)
  // o.mobile : téléphone Android en paysage (écran tactile, pixels de 2,625 ou o.dpr, Chrome Android ; o.ua : autre agent, iPhone par exemple ; o.pwa : laisse venir la fenêtre d'installation) ; sinon un écran de bureau
  const pg = o.mobile
    ? await (await b.newContext({ bypassCSP: !o.csp, viewport: { width: o.w || 915, height: o.h || 412 }, deviceScaleFactor: o.dpr || 2.625, isMobile: true, hasTouch: true, userAgent: o.ua || 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' })).newPage()
    : await b.newPage({ bypassCSP: !o.csp, viewport: { width: o.w || 1280, height: o.h || 720 } }); // CSP de la page (build.py) levée : les outils évaluent du texte (waitForFunction) ; o.csp la garde (visual/csp.js)
  const settings = Object.assign({ quality: 'high', sv: 7, dynres: false, eco: false }, o.settings || {}); // sv : version des réglages (01-core.js) ; à jour, les réglages passés ne sont pas migrés ; eco : pas de limite de cadence ni de question au doigt (09zl-economie.js), o.settings.eco les rend
  await pg.addInitScript(`try{localStorage.setItem('dc_settings', ${JSON.stringify(JSON.stringify(settings))})}catch(e){}`);
  if (o.mobile && !o.pwa) await pg.addInitScript(`try{localStorage.setItem('dc_pwa_ok', String(Date.now()))}catch(e){}`); // sur téléphone, le jeu ne démarre pas sans installation (09r-pwa.js) : o.pwa laisse venir la fenêtre d'installation
  // décompte du départ (src/09y-decompte.js) : coupé, les outils déploient puis jouent tout de suite ; o.countdown : sa durée en secondes (true : celle du jeu)
  if (o.countdown !== true) await pg.addInitScript(`window.MATCH_COUNTDOWN = ${JSON.stringify(o.countdown === undefined ? 0 : +o.countdown)}`);
  if (o.init) await pg.addInitScript(o.init); // o.init : script exécuté avant la page (simuler le mode application, par exemple)
  const logs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  pg.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  await pg.route('**/*', async (r) => {
    const u = r.request().url();
    if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(HERE, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
    if (u.includes('@pmndrs/assets@1.7.0/') && !o.noHdri) return r.fulfill({ path: path.join(HERE, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (o.noHdri && u.includes('/tex/hdri_')) return r.abort();
    if (u.includes('@pmndrs') || u.includes('peerjs') || u.includes('fonts.g') || u.endsWith('.mp3') || u.includes('version.json')) return r.abort();
    return r.continue();
  });
  await pg.goto(o.url || 'file://' + (o.page || path.join(REPO, 'dist/riposte-frontline.html'))); // o.url : page servie par tools/dev/api-dev.js (comptes)
  if (o.gate) return { browser: b, page: pg, logs }; // o.gate : le jeu attend derrière la fenêtre d'installation, rien à attendre
  await pg.waitForFunction(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu', null, { timeout: 600000, polling: 500 });
  // la carte n'est construite qu'au lancement d'une partie (les versions plus anciennes la construisaient au démarrage)
  if (!o.noMap) await pg.evaluate(() => (typeof mapEnsure === 'function' ? mapEnsure(Settings.map) : null));
  return { browser: b, page: pg, logs: logs.filter((l) => !l.includes('ERR_FAILED')) };
}
module.exports = { openGame, REPO, HERE };
