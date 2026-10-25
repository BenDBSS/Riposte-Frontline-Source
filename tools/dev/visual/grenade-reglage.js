/* Banc de réglage des grenades en main (src/09zj-grenade-reglage.js, jeu ouvert avec ?grenade=1) : node grenade-reglage.js [dossier de captures] ; PAGE=autre.html.
   Le jeu tourne pour de bon (rendu 3D coupé sans dossier de captures, bots figés et écartés) et le panneau est manipulé comme le ferait le propriétaire. Contrôles :
   - sans ?grenade=1, rien n'existe (ni panneau, ni crochet) ;
   - avec : le panneau, ses réglages et la souris libre ; un curseur et un champ numérique changent NADE_GRIP, HAND_POSES.n<type> et NADE_POSE, et la vraie main ;
   - le type choisi est celui que la main tient (même après une réapparition) ; Tenue, Dégoupillage et Lancer forcent la pose sans rien lancer ;
   - ce qu'on fait dans le panneau ne parvient pas au jeu (touche G, clic) ;
   - Copier donne un texte que Appliquer relit, Tout remettre revient au code, la configuration survit au rechargement ; un texte étranger n'entre pas.
   Sort en erreur au premier défaut. Avec un dossier : captures de chaque grenade tenue (rendu 3D gardé). */
const path = require('path');
const { openGame, REPO } = require('./common');
const out = process.argv[2], fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
// le rendu logiciel est lent quand on prend des captures : on attend des images du jeu (frameN), pas des millisecondes
const frames = async (page, n) => { const f0 = await page.evaluate('frameN'); await page.waitForFunction(`frameN >= ${f0 + n}`, null, { timeout: 180000, polling: 50 }); };
const PAGE = path.resolve(REPO, 'dist', process.env.PAGE || 'riposte-frontline.html');
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  // 1. sans ?grenade=1
  let g = await openGame({ url: 'file://' + PAGE, w: 960, h: 540, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  ok(await g.page.evaluate(() => !document.getElementById('ndbg') && NADE_DEBUG === null && !LOCK.fallback), 'sans ?grenade=1 : ni panneau ni crochet, la souris reste capturée');
  await g.browser.close();
  // 2. avec
  g = await openGame({ url: 'file://' + PAGE + '?grenade=1', w: 960, h: 540, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  const { page, logs } = g;
  await page.evaluate((cut) => { startMatch({}); if (cut) composer.render = () => {}; window.botsTick = () => {}; for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; } }, !out);
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40 && !!document.getElementById("ndbg")', null, { timeout: 300000, polling: 500 });
  await page.evaluate(() => { localStorage.removeItem('dc_grenade'); PL.yaw = 0; PL.pitch = -0.1; });
  const P = (js) => page.evaluate(js);
  const click = async (txt) => page.evaluate((t) => { for (const b of document.querySelectorAll('#ndbg button')) if (b.textContent === t) { b.click(); return true; } return false; }, txt);
  const slide = (p, v) => P(`(() => { const r = NDBG.rows.find((r) => r.path === '${p}'); r.input.value = ${v}; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok(await P('NADE_DEBUG !== null && LOCK.fallback === true'), 'avec ?grenade=1 : crochet posé, souris libre');
  const n = await P('NDBG.rows.length');
  ok(n >= 3 * 27 + 12, `le panneau a ${n} réglages (trois grenades : prise, doigts, pouce ; bras armé, main gauche)`);
  ok(await P('["G.frag.p.0","G.flash.r.1","G.smoke.p.2","H.nfrag.i.0","H.nflash.t.7","H.nsmoke.spread","N.armed.2","N.rollArmed","N.guide.0"].every((p) => NDBG.rows.some((r) => r.path === p))'), 'les réglages clés y sont');

  // rien ne parvient au jeu
  await click('Jeu');
  await P(`(() => { [...document.querySelectorAll('#ndbg input[type=number]')].find((x) => x.getClientRects().length > 0).focus(); })()`); // un champ visible (ceux des sections repliées ne prennent pas la main)
  const st0 = await P('PL.nadeState');
  await page.keyboard.press('KeyG'); await wait(page, 250);
  ok(st0 === null && await P('PL.nadeState === null'), 'une touche tapée dans le panneau n\'arrive pas au jeu', { avant: st0, apres: await P('PL.nadeState') });
  const box = await page.evaluate(() => { const r = document.querySelector('#ndbg h1').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await wait(page, 150);
  ok(await P('PL.held === false && PL.queued === false'), 'un clic dans le panneau ne tire pas');
  await page.mouse.up(); await wait(page, 150); await P('document.getElementById("ndbg").classList.remove("min")');

  // Tenue : la grenade du type choisi en main, sans rien lancer
  const rig = () => P('(() => { const v = new V3(), q = new THREE.Quaternion(); const N = NADE_RIG; N.nade.getWorldPosition(v); N.nade.getWorldQuaternion(q); return { vis: N.g.visible && N.nade.visible, ty: Object.keys(N.models).find((k) => N.models[k] === N.nade), p: [v.x, v.y, v.z], q: [q.x, q.y, q.z, q.w], state: PL.nadeState, nades: PL.nades }; })()');
  await click('Tenue'); await frames(page, 30); let s = await rig();
  ok(s.vis && s.ty === 'frag' && s.state === null, 'Tenue : la frag en main, sans grenade dégoupillée pour de bon', s);
  await P(`document.querySelector('#ndbg button[data-ty=flash]').click()`); await frames(page, 20); s = await rig();
  ok(s.vis && s.ty === 'flash' && (await P('PL.nadeType')) === 'flash', 'le bouton Flash met la flash en main', s);
  ok(await P('NDBG.secs.filter((x) => x.type === "flash").some((x) => x.d.open) && NDBG.secs.filter((x) => x.type === "frag").every((x) => !x.d.open)'), 'ses réglages s\'ouvrent, ceux de la frag se referment');
  const s0 = s; await slide('G.flash.p.2', -0.09); await frames(page, 20); s = await rig();
  ok(Math.hypot(s.p[0] - s0.p[0], s.p[1] - s0.p[1], s.p[2] - s0.p[2]) > 0.02 && Math.abs((await P('NADE_GRIP.flash.p[2]')) + 0.09) < 1e-6, 'un curseur de place déplace la grenade dans la main (NADE_GRIP)');
  await slide('G.flash.r.0', 70); await frames(page, 20); const s2 = await rig();
  ok(Math.abs(s2.q[0] - s.q[0]) + Math.abs(s2.q[1] - s.q[1]) + Math.abs(s2.q[2] - s.q[2]) > 0.2, 'un curseur d\'angle tourne la grenade dans la main');
  ok(await P('NADE_GRIP.frag.p[2] === NDBG.def.NADE_GRIP.frag.p[2]'), 'la prise d\'un type ne touche pas celle des autres');
  // doigts et pouce de la vraie main
  const fing = () => P('(() => { const u = NADE_RIG.R.hand.userData; return { i0: u.cur.i[0], t: u.cur.t.slice() }; })()');
  await slide('H.nflash.i.0', 0.2); await frames(page, 30); const f1 = await fing();
  ok(Math.abs(f1.i0 - 0.2) < 0.03 && Math.abs((await P('HAND_POSES.nflash.i[0]')) - 0.2) < 1e-6, 'un doigt se règle et la main le prend', f1.i0);
  await P(`(() => { for (const { d: b } of NDBG.secs.filter((x) => x.type === 'flash' && /pouce/.test(x.d.querySelector('summary').textContent))) for (const x of b.querySelectorAll('button')) if (x.textContent === 'Posé sur le manche, vers la garde') x.click(); })()`); await frames(page, 30); const f2 = await fing();
  ok(await P('JSON.stringify(HAND_POSES.nflash.t) === JSON.stringify([0.2, 0.3, 0.2, 0.5, 0, 0, 0, 0])') && Math.abs(f2.t[3] - 0.5) < 0.03, 'Pouce : une pose de départ pose les huit angles, la main la prend');
  await click('Prendre la prise de : Frag');
  ok(await P('JSON.stringify(NADE_GRIP.flash) === JSON.stringify(NADE_GRIP.frag) && JSON.stringify(HAND_POSES.nflash) === JSON.stringify(HAND_POSES.nfrag)'), 'Prendre la prise de : Frag recopie la place et les doigts');
  // bras armé
  const a0 = await rig(); await slide('N.armed.0', 0.1); await frames(page, 30); const a1 = await rig();
  ok(Math.abs(a1.p[0] - a0.p[0]) + Math.abs(a1.p[2] - a0.p[2]) > 0.05, 'le poignet du bras armé déplace la main et sa grenade');
  // Dégoupillage et Lancer : figés à un instant, rien ne part
  await click('Lancer'); await P('(() => { NDBG.loop = false; NDBG.t = 0.05; })()'); await frames(page, 20); const l1 = await rig();
  await P('(() => { NDBG.t = 0.5; })()'); await frames(page, 20); const l2 = await rig();
  ok(l1.vis && !l2.vis && l2.nades === l1.nades && (await P('NADES.length')) === 0, 'Lancer : la grenade quitte la main à l\'instant du lâcher, sans grenade lancée pour de bon', { avant: l1.vis, apres: l2.vis });
  await click('Dégoupillage'); await P('(() => { NDBG.loop = true; NDBG.clock = 0; })()'); await frames(page, 20);
  ok(await P('NDBG.clock > 0 && NADE_RIG.g.visible'), 'Dégoupillage en boucle : le geste se rejoue');
  // le type tenu reste après une réapparition
  await P('(() => { PL.ent.alive = false; respawnPlayer(); })()'); await frames(page, 10);
  ok((await P('PL.nadeType')) === 'flash', 'après une réapparition, la main tient toujours le type choisi');
  if (out) {
    await click('Tout remettre'); await click('Tenue');
    for (const id of ['frag', 'flash', 'smoke']) { // (les boutons portent le nom traduit : on les prend par leur type)
      await P(`document.querySelector('#ndbg button[data-ty=${id}]').click()`); await frames(page, 40); await page.screenshot({ path: path.join(out, `tenue-${id}.png`), timeout: 180000 });
    }
  }
  // copier, appliquer, tout remettre
  await click('Tout remettre');
  await P(`(() => { const r = NDBG.rows.find((r) => r.path === 'G.smoke.p.1'); r.num.value = -0.051; r.num.dispatchEvent(new Event('change')); })()`);
  await click('Copier'); await wait(page, 300);
  const txt = await P('NDBG.ta.value'), cfg = JSON.parse(txt);
  ok(cfg.NADE_GRIP && cfg.NADE_GRIP.smoke.p[1] === -0.051 && cfg.mains.nflash.t.length === 8 && cfg.mains.nsmoke.i.length === 3 && cfg.NADE_POSE.armed.length === 3 && !('pullR' in cfg.NADE_POSE), 'Copier : le texte est du JSON (prises, mains des trois types, bras armé ; sans les trajectoires)');
  await click('Tout remettre');
  ok(await P('NADE_GRIP.smoke.p[1] === NDBG.def.NADE_GRIP.smoke.p[1]'), 'Tout remettre : la configuration du code revient');
  await P(`(t => { NDBG.ta.value = t; })(${JSON.stringify(txt)})`); await click('Appliquer le texte');
  ok(await P('NADE_GRIP.smoke.p[1] === -0.051 && Math.abs(+NDBG.rows.find((r) => r.path === "G.smoke.p.1").input.value + 0.051) < 1e-6'), 'Appliquer : le texte copié est relu et les curseurs suivent');
  await click('Tout remettre');
  await P(`(() => { NDBG.ta.value = JSON.stringify({ NADE_GRIP: { frag: { p: [0.01, 'x'], evil: 1 }, autre: { p: [1, 1, 1] } }, NADE_POSE: { armed: [0.3], pullR: [[9, 9, 9, 9]] }, mains: { nsmoke: { t: 'non', i: [0.4] } } }); })()`); await click('Appliquer le texte');
  const after = await P('({ p: NADE_GRIP.frag.p, evil: NADE_GRIP.frag.evil, autre: NADE_GRIP.autre, armed: NADE_POSE.armed, pull: NADE_POSE.pullR[0][0], t: HAND_POSES.nsmoke.t, i: HAND_POSES.nsmoke.i, def: NDBG.def })');
  ok(after.p[0] === 0.01 && after.p[1] === after.def.NADE_GRIP.frag.p[1] && after.evil === undefined && after.autre === undefined && after.armed[0] === 0.3 && after.pull === 0 && after.t.length === 8 && after.i[0] === 0.4, 'texte étranger : seules les clés connues, de même type, entrent', after);
  await click('Tout remettre');
  // rechargement : la configuration reste
  await P(`(() => { const r = NDBG.rows.find((r) => r.path === 'N.rollArmed'); r.num.value = -1.11; r.num.dispatchEvent(new Event('change')); })()`);
  await page.reload(); await page.waitForFunction('typeof NDBG !== "undefined" && !!NDBG.el', null, { timeout: 300000, polling: 500 });
  ok(await P('Math.abs(NADE_POSE.rollArmed + 1.11) < 1e-6'), 'après rechargement : la configuration est reprise', await P('[NADE_POSE.rollArmed, (localStorage.getItem("dc_grenade") || "").length]'));
  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED') && !l.includes('Failed to load'));
  ok(errs.length === 0, `console propre${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await g.browser.close();
  console.log(fails.length ? `${fails.length} échec(s)` : 'tout est bon');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
