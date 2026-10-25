/* Steam Deck côté jeu (src/09ra-deck.js, README « Steam Deck ») : node tools/dev/visual/deck.js [dossier de captures]
   dist/ servi en local, Chromium avec l'écran (1280 x 800, tactile) et l'agent d'un Steam Deck :
   - navigateur du Deck en mode Bureau : ni fenêtre ni carte d'installation des téléphones, la carte « Installer sur Steam Deck », le fichier
     téléchargé (raccourci .desktop qui installe depuis l'adresse de la page), la carte qui dit quoi faire ensuite ;
   - jeu lancé par Steam (?deck=1) : ni écran tactile ni contrôles tactiles, pas de fenêtre d'installation, pas de bouton Plein écran ; sans
     manette, la carte de la disposition des commandes, qui s'efface quand une manette se connecte ; le rappel du clavier de Steam ;
   - téléphone Android : rien de changé (fenêtre d'installation habituelle).
   L'installeur lui-même : python3 tools/dev/check_deck.py. Sort avec un code d'erreur au moindre échec. */
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const { REPO } = require('./common');
const DIST = path.join(REPO, 'dist'), HERE = __dirname, OUT = process.argv[2];
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok    : ' : 'ECHEC : ') + m); };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/riposte-frontline.html'; const f = path.join(DIST, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.sh') ? 'text/plain' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (q, ctx) => {
    const c = await b.newContext(Object.assign({ bypassCSP: true, viewport: { width: 1280, height: 800 }, screen: { width: 1280, height: 800 }, hasTouch: true, acceptDownloads: true }, ctx || {}));
    await c.addInitScript(`try{localStorage.setItem('dc_settings', ${JSON.stringify(JSON.stringify({ quality: 'low', sv: 7, dynres: false, lang: 'fr', eco: false }))})}catch(e){}`);
    const p = await c.newPage(), logs = []; p.on('pageerror', (e) => logs.push(String(e)));
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(HERE, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' }); if (u.includes('@pmndrs') || u.includes('peerjs') || u.includes('fonts.g') || u.endsWith('.mp3') || u.includes('version.json') || u.includes('/api/')) return r.abort(); return r.continue(); });
    await p.goto(base + '/' + q);
    return { c, p, logs };
  };
  const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  // 1. navigateur du Deck en mode Bureau
  {
    const { c, p, logs } = await open('', { userAgent: LINUX });
    await p.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 300000 });
    const st = await p.evaluate(() => ({ deck: DECK, look: deckLooksLike(), gate: document.body.classList.contains('gated'), card: !$('deckCard').classList.contains('hidden'), pwa: !$('pwaCard').classList.contains('hidden'), btn: $('deckGo').textContent, txt: $('deckTxt').textContent }));
    ok(!st.deck && st.look, 'mode Bureau : reconnu comme un Steam Deck, pas en mode Deck');
    ok(!st.gate && !st.pwa, 'mode Bureau : ni fenêtre ni carte d\'installation pour téléphone');
    ok(st.card && st.btn === 'Installer sur Steam Deck', 'mode Bureau : carte « ' + st.btn + ' » : ' + st.txt);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#deckGo')]);
    const txt = fs.readFileSync(await dl.path(), 'utf8');
    ok(dl.suggestedFilename() === 'Installer Riposte.desktop', 'fichier téléchargé : ' + dl.suggestedFilename());
    ok(txt.includes(`Exec=bash -c "curl -fsSL --create-dirs ${base}/deck/installer.sh -o ~/.cache/riposte-installer.sh && bash ~/.cache/riposte-installer.sh ${base}"`) && /Terminal=true/.test(txt) && !/[$`\\]/.test(txt.split('Exec=')[1]), 'raccourci : installe depuis l\'adresse de la page (' + base + ')');
    ok(await p.evaluate(() => $('deckGo').textContent === 'Télécharger de nouveau' && /Téléchargements/.test($('deckTxt').textContent)), 'après le téléchargement : la carte dit quoi faire');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'deck-bureau.png') });
    ok(!logs.length, 'mode Bureau : aucune erreur' + (logs.length ? ' ' + logs[0] : ''));
    await c.close();
  }
  // 2. jeu lancé par Steam (?deck=1), écran tactile du Deck
  {
    const { c, p, logs } = await open('?deck=1', { userAgent: LINUX });
    await p.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 300000 });
    const st = await p.evaluate(() => ({ deck: DECK, coarse: COARSE, touch: TOUCH.on, gate: document.body.classList.contains('gated'), fs: $('fsBtn').classList.contains('hidden'), card: !$('deckCard').classList.contains('hidden'), tier: RQ.q.label }));
    ok(st.deck && !st.coarse && !st.touch, 'mode Deck : pas d\'écran tactile ni de contrôles tactiles');
    ok(!st.gate, 'mode Deck : pas de fenêtre d\'installation');
    ok(st.fs, 'mode Deck : bouton Plein écran caché');
    ok(!st.card, 'mode Deck : pas de carte au démarrage');
    await p.waitForTimeout(6000); await p.evaluate(() => deckCard());
    const hint = await p.evaluate(() => (!$('deckCard').classList.contains('hidden') && $('deckGo').classList.contains('hidden')) ? $('deckTxt').textContent : '');
    ok(/Manette avec trackpad souris/.test(hint), 'mode Deck, aucune manette : la carte indique la disposition : ' + hint);
    if (OUT) await p.screenshot({ path: path.join(OUT, 'deck-sans-manette.png') });
    await p.evaluate(() => dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: { id: 'Microsoft X-Box 360 pad 0 (STANDARD GAMEPAD Vendor: 28de Product: 11ff)' } })));
    ok(await p.evaluate(() => $('deckCard').classList.contains('hidden')), 'mode Deck : manette vue, la carte s\'efface');
    await p.evaluate(() => { const i = document.createElement('input'); i.type = 'text'; document.body.appendChild(i); i.focus(); });
    ok(await p.evaluate(() => !$('deckKb').classList.contains('hidden') && $('deckKb').textContent), 'mode Deck : champ de texte, rappel du clavier de Steam');
    await p.evaluate(() => document.activeElement.blur());
    ok(await p.evaluate(() => $('deckKb').classList.contains('hidden')), 'mode Deck : rappel retiré hors du champ');
    ok(!logs.length, 'mode Deck : aucune erreur' + (logs.length ? ' ' + logs[0] : ''));
    await c.close();
  }
  // 3. téléphone Android : rien ne change (fenêtre d'installation, pas de carte Deck)
  {
    const { c, p } = await open('', { viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 }, isMobile: true, deviceScaleFactor: 2.625, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
    await p.waitForFunction("document.body.classList.contains('gated')", null, { timeout: 120000 }).catch(() => {});
    const st = await p.evaluate(() => ({ gate: document.body.classList.contains('gated'), look: deckLooksLike(), deck: DECK }));
    ok(st.gate && !st.look && !st.deck, 'téléphone : fenêtre d\'installation habituelle, pas de Steam Deck');
    await c.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon'); process.exit(fails ? 1 : 0);
})();
