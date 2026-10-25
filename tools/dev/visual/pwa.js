/* Contrôle de l'installation (PWA) : node tools/dev/visual/pwa.js [dossier de captures]
   Sert dist/ en local (localhost est un contexte sécurisé : le service worker s'y enregistre) et vérifie :
   - le manifeste et ses icônes, le service worker (actif, met en cache les fichiers à empreinte, laisse la page au réseau) ;
   - l'installation d'abord sur écran tactile dans un navigateur : la fenêtre s'affiche tout de suite (portrait compris, avant « Tournez
     votre téléphone »), le jeu ne démarre pas derrière ; Android avec l'annonce du navigateur (bouton Installer, actif à l'annonce),
     navigateur sans annonce (gestes à la main), iPhone (gestes de Safari) ; la dérogation (« Impossible d'installer ? ») ;
     application installée ou lancée depuis l'icône : le jeu démarre sans fenêtre ; liens de vérification de compte, invitation à un salon ;
   - rien sur ordinateur.
   Sort avec un code d'erreur au premier échec. WebKit (iPhone) n'est pas disponible ici : l'iPhone est simulé par son agent
   utilisateur, ce qui vérifie notre logique, pas le comportement réel de Safari. */
const { openGame, REPO } = require('./common');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(REPO, 'dist');
const out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// Safari sur iPad se présente comme un Mac : seuls la plateforme MacIntel et l'écran tactile le trahissent
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const IPAD_INIT = "Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }); Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 });";
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('ECHEC :', msg); } else console.log('ok    :', msg); };
const hits = {};
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); hits[u] = (hits[u] || 0) + 1;
  const f = path.join(DIST, u === '/' ? 'riposte-frontline.html' : u);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
});
const MENU = "typeof MATCH!=='undefined' && MATCH.state==='menu'";
const shown = (page, id) => page.evaluate((i) => !document.getElementById(i).classList.contains('hidden'), id);
const announce = (page) => page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); return e.defaultPrevented; });
const wait = (page, cond, ms) => page.waitForFunction(cond, null, { timeout: ms || 15000, polling: 100 }).then(() => true, () => false);
let base = '';
const open = async (o) => {
  const g = await openGame(Object.assign({ mobile: true, pwa: !!(o && o.gate), dpr: 1, url: `${base}/riposte-frontline.html`, settings: { quality: 'low', lang: 'fr', touch: 'on' }, noHdri: true, noMap: true }, o || {})); // sans o.gate : dérogation déjà accordée (le jeu démarre) ; o.gate : le jeu attend derrière la fenêtre d'installation
  return g;
};
const shot = async (g, name) => { if (out) { await g.page.waitForTimeout(400); await g.page.screenshot({ path: path.join(out, `pwa-${name}.png`) }); } };

const STANDALONE = "const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode: (fullscreen|standalone)/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));";
const gateOpen = (page) => page.evaluate(() => !document.getElementById('pwaOffer').classList.contains('hidden'));
const started = (page) => page.evaluate(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu');
const txt = (page, id) => page.evaluate((i) => document.getElementById(i).textContent, id);

(async () => {
  await new Promise((r) => srv.listen(0, r));
  base = `http://localhost:${srv.address().port}`;

  // 1. manifeste et service worker (dérogation accordée : le jeu démarre normalement)
  {
    const g = await open(), { page } = g;
    const href = await page.evaluate(() => document.querySelector('link[rel=manifest]').href);
    const m = await (await fetch(href)).json();
    ok(m.display === 'fullscreen' && m.orientation === 'landscape', `manifeste : plein écran, paysage (${m.display}, ${m.orientation})`);
    ok(m.start_url && m.scope && m.id && m.name && m.short_name, 'manifeste : id, start_url, scope, noms');
    const purposes = new Set((m.icons || []).map((i) => i.purpose || 'any')); ok(purposes.has('any') && purposes.has('maskable'), 'manifeste : icônes any et maskable');
    const sizes = new Set((m.icons || []).map((i) => i.sizes)); ok(sizes.has('192x192') && sizes.has('512x512'), 'manifeste : icônes 192 et 512');
    let allIcons = true; for (const i of m.icons) { const r = await fetch(new URL(i.src, href)); if (r.status !== 200 || !/png/.test(r.headers.get('content-type') || '')) allIcons = false; }
    ok(allIcons, `manifeste : ${m.icons.length} icônes servies`);
    const sw = await page.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise((x) => setTimeout(() => x(null), 15000))]); return r ? { scope: r.scope, active: !!r.active } : null; });
    ok(sw && sw.active, `service worker actif (${sw && sw.scope})`);
    const icon = new URL(m.icons[0].src, href).pathname;
    const fetchTwice = () => page.evaluate(async (u) => { const a = await fetch(u); await a.arrayBuffer(); const b = await fetch(u); await b.arrayBuffer(); }, icon);
    await page.reload(); await page.waitForFunction(MENU, null, { timeout: 120000 });
    ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker maître de la page après rechargement');
    await fetchTwice(); await page.waitForTimeout(400);
    const cached = await page.evaluate(async (u) => { const keys = await caches.keys(); const c = await caches.open('cod-fichiers-v1'); return { keys, has: !!(await c.match(u)), others: (await c.keys()).map((r) => new URL(r.url).pathname).filter((p) => !/^\/(tex|maps|icons)\//.test(p)) }; }, icon);
    ok(cached.keys.length === 1 && cached.has, `fichier à empreinte en cache (${icon})`);
    ok(cached.others.length === 0, "rien d'autre en cache : ni page, ni API, ni version.json");
    const before = hits[icon] || 0; await fetchTwice(); ok((hits[icon] || 0) === before, 'le second chargement du fichier à empreinte ne passe pas par le réseau');
    const pageHits = hits['/riposte-frontline.html'] || 0; await page.reload(); await page.waitForFunction(MENU, null, { timeout: 120000 });
    ok((hits['/riposte-frontline.html'] || 0) > pageHits, 'la page, elle, est toujours demandée au réseau (mise à jour automatique intacte)');
    await g.browser.close();
  }

  // 2. Android, navigateur avec annonce : fenêtre tout de suite, bouton actif à l'annonce, jeu bloqué derrière, puis « installé »
  {
    const g = await open({ gate: true }), { page } = g;
    ok(await wait(page, "!document.getElementById('pwaOffer').classList.contains('hidden')", 8000), "la fenêtre d'installation est là dès l'ouverture, sans attendre le menu");
    ok(!(await started(page)), 'le jeu ne démarre pas derrière la fenêtre');
    const t0 = await page.evaluate(() => ({ go: document.getElementById('poGo').textContent, dis: document.getElementById('poGo').disabled, hid: document.getElementById('poGo').classList.contains('hidden'), steps: document.getElementById('poSteps').classList.contains('hidden'), help: !document.getElementById('poHelp').classList.contains('hidden'), alt: document.getElementById('poAlt').classList.contains('hidden'), title: document.getElementById('poTitle').textContent }));
    ok(t0.go === "Installer l'application" && t0.dis && !t0.hid && t0.steps, "en attendant l'annonce du navigateur : bouton visible mais pas encore actif, pas de gestes");
    ok(t0.help && t0.alt, "« Impossible d'installer ? » discret, pas de bouton pour jouer dans le navigateur");
    ok(await announce(page), 'beforeinstallprompt : invite du navigateur retenue');
    ok(await page.evaluate(() => !document.getElementById('poGo').disabled), "à l'annonce, le bouton d'installation devient actif");
    await shot(g, 'android');
    await page.click('#poGo');
    ok(await wait(page, '(window.__prompted || 0) === 1'), 'bouton Installer : invite du navigateur ouverte');
    ok(await wait(page, "document.getElementById('poTitle').textContent === \"C'est installé !\""), "« C'est installé ! » : on dit d'ouvrir l'icône");
    ok(await page.evaluate(() => document.getElementById('poGo').classList.contains('hidden') && !!(+localStorage.getItem('dc_pwa_in'))), 'plus de bouton, installation mémorisée');
    ok(!(await started(page)), "le jeu reste bloqué dans l'onglet : on ouvre l'application");
    await shot(g, 'installe');
    // dérogation
    await page.click('#poHelp');
    ok(await page.evaluate(() => !document.getElementById('poAlt').classList.contains('hidden') && document.getElementById('poHelp').classList.contains('hidden')), "« Impossible d'installer ? » montre la dérogation");
    await page.click('#poNo');
    ok(await wait(page, MENU, 120000), 'jouer dans le navigateur quand même : le jeu démarre');
    ok(!(await gateOpen(page)), 'fenêtre refermée');
    ok(await page.evaluate(() => +localStorage.getItem('dc_pwa_ok') > 0), 'dérogation mémorisée (une semaine)');
    await page.reload(); ok(await wait(page, MENU, 120000) && !(await gateOpen(page)), 'rechargement : plus de fenêtre pendant la dérogation');
    await g.browser.close();
  }

  // 3. navigateur sans annonce : après l'attente, les gestes à la main, sans bouton ; la carte du menu rouvre la fenêtre
  {
    const g = await open({ w: 667, h: 375, gate: true }), { page } = g;
    ok(await gateOpen(page), 'sans annonce : la fenêtre est ouverte tout de suite');
    ok(await wait(page, "document.querySelectorAll('#poSteps li').length === 3", 8000), "après l'attente (3,5 s) : trois gestes à la main");
    const t = await page.evaluate(() => ({ go: document.getElementById('poGo').classList.contains('hidden'), steps: document.getElementById('poSteps').classList.contains('hidden'), btnsInView: (() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1; })() }));
    ok(t.go && !t.steps, 'gestes à la main : pas de bouton Installer');
    ok(t.btnsInView, "paysage bas : « Impossible d'installer ? » reste à l'écran");
    await shot(g, 'manuel');
    ok(await announce(page) && (await page.evaluate(() => !document.getElementById('poGo').classList.contains('hidden') && !document.getElementById('poGo').disabled)), "annonce tardive : le bouton d'installation prend le relais");
    await page.evaluate(() => { PWA.prompt = null; pwaRender(); });
    await page.click('#poHelp'); await page.click('#poNo');
    ok(await wait(page, MENU, 120000), 'dérogation : le jeu démarre');
    ok(await shown(page, 'pwaCard'), 'la carte du menu reste, en rappel');
    await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
    await page.click('#pwaGo');
    ok(await gateOpen(page), 'la carte du menu rouvre la fenêtre');
    const c = await page.evaluate(() => ({ no: document.getElementById('poNo').textContent, helpHidden: document.getElementById('poHelp').classList.contains('hidden'), altShown: !document.getElementById('poAlt').classList.contains('hidden') }));
    ok(c.no === 'Plus tard' && c.helpHidden && c.altShown, 'rouverte depuis le menu : « Plus tard » ferme, pas de blocage');
    await page.click('#poNo'); ok(!(await gateOpen(page)), '« Plus tard » ferme la fenêtre');
    await page.evaluate(() => localStorage.setItem('dc_pwa_ok', String(Date.now() - 8 * 24 * 3600 * 1000)));
    await page.reload();
    ok(await wait(page, "!document.getElementById('pwaOffer').classList.contains('hidden')", 8000) && !(await started(page)), 'une semaine plus tard, la fenêtre revient et bloque de nouveau');
    await g.browser.close();
  }

  // 4. iPhone en portrait : pas d'invite, les gestes de Safari tout de suite, devant « Tournez votre appareil »
  {
    const g = await open({ ua: IPHONE, w: 390, h: 844, gate: true }), { page } = g;
    ok(await wait(page, "document.querySelectorAll('#poSteps li').length === 3", 8000), "iPhone : la fenêtre s'ouvre aussitôt avec les gestes, sans attendre d'annonce");
    const t = await page.evaluate(() => ({ go: document.getElementById('poGo').classList.contains('hidden'), steps: [...document.querySelectorAll('#poSteps li span')].map((e) => e.textContent), note: !document.getElementById('poNote').classList.contains('hidden') }));
    ok(t.steps.length === 3 && /Partager/.test(t.steps[0]) && /accueil/.test(t.steps[1]) && t.go && t.note, "iPhone : Partager, « Sur l'écran d'accueil », Ajouter, la note sur l'orientation, pas de bouton");
    const r = await page.evaluate(() => { const o = document.getElementById('pwaOffer'), rot = document.getElementById('rotate'); return { z: +getComputedStyle(o).zIndex > +getComputedStyle(rot).zIndex, rot: getComputedStyle(rot).display !== 'none', help: (() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1 || o.scrollHeight > innerHeight; })() }; });
    ok(r.rot && r.z, "portrait : « Tournez votre appareil » existe mais la fenêtre d'installation passe devant");
    ok(r.help, 'portrait : tout est atteignable');
    await shot(g, 'iphone-portrait');
    await page.setViewportSize({ width: 844, height: 390 }); await shot(g, 'iphone');
    ok(await page.evaluate(() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1 || document.getElementById('pwaOffer').scrollHeight > innerHeight; }), 'paysage : tout est atteignable (défilement au besoin)');
    await g.browser.close();
  }

  // 4 bis. iPad en paysage (4:3) : reconnu malgré son agent de Mac, les gestes de Safari, tout à l'écran
  {
    const g = await open({ ua: IPAD, init: IPAD_INIT, w: 1024, h: 768, gate: true }), { page } = g;
    ok(await wait(page, "document.querySelectorAll('#poSteps li').length === 3", 8000), "iPad : reconnu comme iOS, la fenêtre montre les gestes de Safari");
    const t = await page.evaluate(() => ({ steps: [...document.querySelectorAll('#poSteps li span')].map((e) => e.textContent), note: document.getElementById('poNote').textContent, help: (() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.height > 0; })() }));
    ok(/Partager/.test(t.steps[0]) && /iPad/.test(t.note) && t.help, `iPad : Partager, la note sur l'orientation (${t.note}), tout à l'écran`);
    await shot(g, 'ipad');
    await g.browser.close();
  }

  // 5. jeu lancé depuis l'icône (mode application) : pas de fenêtre, le jeu démarre, et on s'en souvient pour le navigateur
  {
    const g = await open({ init: STANDALONE, gate: true, pwa: true }), { page } = g;
    ok(await wait(page, MENU, 120000), 'application installée : le jeu démarre sans fenêtre');
    await page.waitForTimeout(1500);
    ok(!(await gateOpen(page)) && !(await shown(page, 'pwaCard')), 'application installée : ni fenêtre ni carte');
    ok(await page.evaluate(() => +localStorage.getItem('dc_pwa_in') > 0), "lancé depuis l'icône : mémorisé pour le navigateur du même téléphone");
    await g.browser.close();
  }

  // 6. déjà installé (vu depuis l'icône), mais ouvert dans le navigateur : on dit d'ouvrir l'icône, la dérogation est offerte d'emblée
  {
    const g = await open({ gate: true, init: "try{localStorage.setItem('dc_pwa_in', String(Date.now()))}catch(e){}" }), { page } = g;
    ok(await gateOpen(page), 'installé mais ouvert dans le navigateur : fenêtre');
    const t = await page.evaluate(() => ({ title: document.getElementById('poTitle').textContent, alt: !document.getElementById('poAlt').classList.contains('hidden'), go: document.getElementById('poGo').classList.contains('hidden') }));
    ok(t.title === 'Le jeu est déjà installé' && t.alt && t.go, `« ${t.title} » : dérogation offerte d'emblée, pas de bouton Installer`);
    await g.browser.close();
  }

  // 7. liens : vérification de compte (aucune fenêtre), invitation à un salon (retenue pour l'application)
  {
    const g = await open({ gate: true, url: `${base}/riposte-frontline.html?verif=abc123` }), { page } = g;
    ok(await wait(page, MENU, 120000) && !(await gateOpen(page)), 'lien de vérification de compte : pas de fenêtre, le jeu démarre');
    await g.browser.close();
    const g2 = await open({ gate: true, url: `${base}/riposte-frontline.html?salon=ABCDE` });
    ok(await gateOpen(g2.page), "invitation à un salon dans le navigateur : fenêtre d'installation");
    const kept = await g2.page.evaluate(() => JSON.parse(localStorage.getItem('dc_salon') || 'null'));
    ok(kept && kept.c === 'ABCDE', `le code du salon est retenu pour l'application (${kept && kept.c})`);
    const code = await g2.page.evaluate(() => { PWA.standalone = true; return pwaSalon(); });
    ok(code === 'ABCDE', "l'application retrouve le code du salon");
    ok(await g2.page.evaluate(() => { PWA.standalone = true; return pwaSalon(); }) === null, 'et ne le rejoue pas');
    await g2.browser.close();
  }

  // 8. ordinateur : jamais
  {
    const g = await openGame({ url: `${base}/riposte-frontline.html`, w: 960, h: 540, settings: { quality: 'low', lang: 'fr' }, noHdri: true, noMap: true }), { page } = g;
    await announce(page); await page.waitForTimeout(3000);
    ok(!(await gateOpen(page)) && !(await shown(page, 'pwaCard')), "ordinateur : ni fenêtre ni carte, même si le navigateur annonce l'installation");
    await g.browser.close();
  }
  srv.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
