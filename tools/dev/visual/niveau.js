/* Montée de niveau et aperçus de la pause : node tools/dev/visual/niveau.js [dossier de captures]
   Sur un téléphone en paysage, en partie :
   - la pause montre les armes de la classe équipée avec leurs accessoires (vignette différente de l'arme nue) ;
   - une montée de niveau lance le rituel (09s-rankup.js) et la fanfare une fois par niveau, pas pour un déblocage d'accessoire ;
   - le rituel tient dans l'écran, ne prend pas les touches, et se retire seul. Captures aux étapes de l'animation. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('ECHEC :', msg); } else console.log('ok    :', msg); };

(async () => {
  const g = await openGame({ mobile: true, w: 915, h: 412, dpr: 1.5, settings: { quality: 'low', lang: 'fr', map: 'sable', touch: 'on' }, noHdri: true, init: "try{localStorage.setItem('dc_touch_help','1')}catch(e){}" });
  const { page } = g, P = (e) => page.evaluate(e);
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('depGo').click());
  await page.waitForFunction("MATCH.state==='playing' && PL.ent.alive", null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const h = document.getElementById('tcHelp'); if (h) h.classList.add('hidden'); });

  // 1. pause : la classe équipée montre ses accessoires
  const setup = await P(`(() => {
    ARS.wxp = Object.fromEntries(Object.keys(WEAPONS).map((k) => [k, 1e6])); ARS.px = 1e6;
    const i = classCreate(0); if (i < 0) return { err: 'classe non créée' };
    const base = WEAPONS[CLASSES[i].primary], ids = Object.keys(ATT).filter((a) => attFits(base, a));
    const msgs = []; for (const a of ids.slice(0, 3)) msgs.push(classToggleAtt(i, 'p', a));
    const sb = WEAPONS[CLASSES[i].secondary]; for (const a of Object.keys(ATT).filter((a) => attFits(sb, a)).slice(0, 1)) msgs.push(classToggleAtt(i, 's', a)); // le pistolet aussi est monté
    Settings.loadout = i; return { i, pa: CLASSES[i].pa, key: classWeapons(i)[0].key, id: CLASSES[i].primary, msgs };
  })()`);
  ok(!setup.err && setup.pa.length > 0, `classe d'essai : ${setup.id} avec ${setup.pa.length} accessoire(s) (${setup.key})`);
  await P('pauseGame(); document.querySelector("[data-pm=class]").click()');
  console.log('  état :', JSON.stringify(await P('({ allowed: thumbsAllowed(), ready: VTHUMB.ready, busy: UI.busy, screen: UI.screen, mapl: MAPL.state, st: MATCH.state, done: Object.keys(VTHUMB.img).length })')));
  const got = await page.waitForFunction(`(() => { const im = document.querySelector('#cpPause img[alt=""]'); return VTHUMB.img[${JSON.stringify(setup.key)}] && [...document.querySelectorAll('#cpPause img')].some((e) => e.src === VTHUMB.img[${JSON.stringify(setup.key)}]); })()`, null, { timeout: 60000, polling: 300 }).then(() => true, () => false);
  const th = await P(`({ own: !!VTHUMB.img[${JSON.stringify(setup.key)}], same: VTHUMB.img[${JSON.stringify(setup.key)}] === VTHUMB.img[${JSON.stringify(setup.id)}], imgs: [...document.querySelectorAll('#cpPause img')].map((e) => e.src.slice(0, 22)), state: MATCH.state })`);
  ok(got && th.own && !th.same, `pause en partie : l'arme équipée s'affiche avec ses accessoires (vignette propre, différente de l'arme nue) ${JSON.stringify(th)}`);
  const both = await page.waitForFunction(`(() => { const im = [...document.querySelectorAll('#cpPause .cp-img img')]; return im.length === 2 && im.every((e) => e.src.startsWith('data:image/webp') && !e.hasAttribute('data-pend')); })()`, null, { timeout: 60000, polling: 300 }).then(() => true).catch(() => false);
  ok(both, 'pause en partie : les deux armes de la classe (principale et secondaire montées) sont dessinées, aucune n\'est l\'arme nue en attente');
  if (out) await page.screenshot({ path: path.join(out, 'pause-classe.png') });
  await P('resumeGame()'); await page.waitForTimeout(400);

  // 2. rituel de montée de niveau
  await P('ARS.lvSeen = playerLevelLive(); rankUpClear()'); // (le niveau de l'essai ne doit pas déclencher de rituel de lui-même)
  ok(await until(page, 'AU.ready && !!AU.rankBuf', 20000), 'fanfare décodée (MP3)');
  await P(`window.__snd = []; const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__snd.push(this.buffer === AU.rankBuf ? 'rank' : 'autre'); return st.apply(this, a); };`);
  await P('rankUpShow(7, -1)');
  await page.waitForTimeout(450);
  ok(await P("document.getElementById('rankUp').classList.contains('show')"), 'montée de niveau : le rituel s\'affiche');
  ok((await P('window.__snd.filter((s) => s === "rank").length')) === 1, 'montée de niveau : la fanfare joue une fois');
  if (out) await page.screenshot({ path: path.join(out, 'rankup-1.png') });
  await page.waitForTimeout(1100); if (out) await page.screenshot({ path: path.join(out, 'rankup-2.png') });
  await page.waitForTimeout(1400); if (out) await page.screenshot({ path: path.join(out, 'rankup-3.png') });
  const box = await P(`(() => { const o = []; for (const s of ['.ru-kick', '.ru-badge', '.ru-sub']) { const r = document.querySelector(s).getBoundingClientRect(); o.push([s, r.left, r.right, r.top, r.bottom]); } return { o, W: innerWidth, H: innerHeight, pe: getComputedStyle(document.getElementById('rankUp')).pointerEvents, num: document.querySelector('.ru-new').textContent }; })()`);
  ok(box.num === '7' && box.o.every(([s, l, r, t, b]) => l >= 0 && r <= box.W && t >= 0 && b <= box.H), `le rituel tient dans l'écran (${box.W}x${box.H}) et annonce le niveau ${box.num}`);
  ok(box.pe === 'none', 'le rituel ne prend pas les touches');
  ok(await until(page, "!document.getElementById('rankUp').classList.contains('show')", 12000), 'le rituel se retire seul');
  // déblocage d'accessoire : pas de fanfare ; plusieurs niveaux d'affilée : une fanfare chacun
  await P(`arsNotify({ weapon: 'm4', up: false, level: 3, items: ['att:' + Object.keys(ATT)[0]] })`); await page.waitForTimeout(500);
  ok((await P('window.__snd.filter((s) => s === "rank").length')) === 1, 'déblocage d\'accessoire : pas de fanfare');
  await P('rankUpShow(8, -1); rankUpShow(9, 1)'); await page.waitForTimeout(500);
  ok((await P('window.__snd.filter((s) => s === "rank").length')) === 2, 'deux niveaux d\'affilée : le second attend la fin du premier');
  ok(await until(page, 'window.__snd.filter((s) => s === "rank").length === 3', 20000), 'le second niveau a sa propre fanfare');
  if (out) await page.screenshot({ path: path.join(out, 'rankup-slot.png') });
  await P('rankUpClear()'); ok(!(await P("document.getElementById('rankUp').classList.contains('show')")), 'fin de partie : plus de rituel en attente');
  await g.browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);

  function until(pg, cond, ms) { return pg.waitForFunction(cond, null, { timeout: ms || 30000, polling: 100 }).then(() => true, () => false); }
})().catch((e) => { console.error(e); process.exit(2); });
