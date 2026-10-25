/* Contrôle du mode pavé tactile (src/09qe-pavetactile.js) : node pavetactile.js [page=dist/riposte-frontline.html]
   Évènements synthétiques (molette, clics) envoyés à la fenêtre, comme le navigateur le ferait ; partie solo réelle, rendu 3D coupé.
   - détection : des crans de molette ne posent rien ; deux gestes de pavé (salve de petits pas fractionnaires qui s'éteint) posent Settings.tpSeen et la
     classe du corps ; deux crans de souris l'enlèvent ; la molette d'une souris sous un zoom (pas fractionnaires) ne pose rien ; un clic gauche tenu en
     mode détecté rend la souris, tire et le dit ; le mode « off » ou « on » prime sur la détection ;
   - en mode pavé, tir automatique : un clic simple ne tire pas, un double clic épaule puis range l'arme, un clic droit (toucher à deux doigts) fait de même, la
     molette ne change plus d'arme, le réticule sur un ennemi lance le tir et le perdre l'arrête ;
   - sans tir automatique, un clic simple tire ; sans double clic, il n'épaule pas ;
   - mode « off » : la souris d'avant (clic qui tire, clic droit tenu, molette qui change d'arme) ; visée en bascule choisie à la souris : le clic droit bascule ;
     recharger range la visée en bascule ;
   - au doigt ou à la manette, le mode pavé ne s'applique jamais ;
   - sensibilité propre au pavé : deux fois celle de la souris donne deux fois le déplacement du regard, et changer celle de la souris n'y fait rien ;
     au départ, elle reprend celle de la souris ;
   - Options, Jeu : les rangées du pavé (réglette de sensibilité comprise) ne s'affichent qu'avec le mode, le choix du mode existe. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 1000, h: 560, settings: { quality: 'low', map: 'sable', tpMode: 'auto', tpSeen: false, tpHint: true }, noHdri: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { LOCK.fallback = true; startMatch({}); composer.render = () => {}; });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 30', null, { timeout: 300000, polling: 500 });
  // helpers dans la page : molette (une salve de n évènements espacés de dt ms, pas decroissants ou cran), clics espacés
  await ev(() => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__sleep = sleep;
    window.__frames = async (n) => { const f = frameN; while (frameN < f + n) await sleep(15); }; // (les images sont lentes en rendu logiciel : on compte les images, pas les millisecondes)
    window.__wheel = async (kind) => {
      if (kind === 'pad') { for (let i = 0; i < 14; i++) { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 14.37 * Math.pow(0.82, i) + 0.31, deltaX: i % 3 ? 0.4 : 0 })); await sleep(18); } }
      else for (let i = 0; i < 2; i++) { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0 })); await sleep(30); }
      await sleep(420); // la salve est finie (le délai de fin de salve, 140 ms, puis le minuteur de 250 ms)
    };
    window.__click = (b = 0) => { window.dispatchEvent(new MouseEvent('mousedown', { button: b })); window.dispatchEvent(new MouseEvent('mouseup', { button: b })); };
    window.__reset = () => { PL.held = false; PL.queued = false; PL.adsWant = false; TPAD.tap = 0; PL.shots0 = PL.shots; };
  });
  // --- détection ---
  const st = () => ev(() => ({ seen: !!Settings.tpSeen, on: trackpadOn(), cls: document.body.classList.contains('trackpad') }));
  await ev(() => window.__wheel('cran')); await ev(() => window.__wheel('cran'));
  let s = await st(); ok(!s.seen && !s.on && !s.cls, 'deux crans de molette : rien de détecté', s);
  await ev(() => window.__wheel('pad')); s = await st(); ok(!s.seen, 'un seul geste de pavé : pas encore', s);
  await ev(() => window.__wheel('pad')); s = await st(); ok(s.seen && s.on && s.cls, 'deux gestes de pavé : mode pavé, classe du corps posée', s);
  await ev(() => window.__wheel('cran')); await ev(() => window.__wheel('cran')); s = await st(); ok(!s.seen && !s.on && !s.cls, 'deux crans de souris : le mode s\'éteint', s);
  // une souris sous un zoom du navigateur (ou une mise à l'échelle de l'écran) donne des pas fractionnaires : pas un pavé (retour « après les réglages, je ne peux plus tirer »)
  await ev(async () => { for (let b = 0; b < 3; b++) { for (let i = 0; i < 6; i++) { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 90.90909, deltaMode: 0 })); await window.__sleep(20); } await window.__sleep(420); } });
  s = await st(); ok(!s.seen && !s.on, 'molette d\'une souris sous un zoom (pas fractionnaires) : pas un pavé', s);
  // mode pavé détecté à tort : un clic gauche tenu est celui d'une souris, le mode s'éteint, le tir part et un message le dit
  await ev(() => window.__wheel('pad')); await ev(() => window.__wheel('pad'));
  const hold = await ev(async () => {
    window.__reset(); PL.noFireT = 0; const on0 = trackpadOn(); $('msg').textContent = '';
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); const held0 = PL.held;
    await window.__sleep(500); const r = { on0, held0, on: trackpadOn(), held: PL.held, msg: $('msg').textContent };
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); r.after = PL.held; return r;
  });
  ok(hold.on0 && !hold.held0 && !hold.on && hold.held && !hold.after, 'pavé détecté à tort : un clic tenu rend la souris et tire, relâché il s\'arrête', hold);
  ok(/Souris|Mouse/.test(hold.msg), 'retour à la souris : un message le dit', hold.msg);
  await ev(() => { Settings.tpMode = 'on'; trackpadSync(); }); s = await st(); ok(s.on && s.cls, 'mode « Activés » : sans détection', s);
  await ev(() => window.__wheel('cran')); await ev(() => window.__wheel('cran')); s = await st(); ok(s.on, 'mode « Activés » : la molette n\'y change rien', s);
  await ev(() => { Settings.tpMode = 'off'; Settings.tpSeen = true; trackpadSync(); }); s = await st(); ok(!s.on && !s.cls, 'mode « Désactivés » : prime sur la détection', s);
  // --- en mode pavé, tir automatique et double clic ---
  await ev(() => { Settings.tpMode = 'on'; Settings.tpAuto = true; Settings.tpDblAds = true; Settings.adsToggle = false; trackpadSync(); window.__reset(); });
  const S = () => ev(() => ({ held: PL.held, queued: PL.queued, ads: PL.adsWant, shots: PL.shots - (PL.shots0 || 0), cur: PL.cur }));
  await ev(() => window.__click(0)); let t = await S(); ok(!t.held && !t.queued, 'un clic simple ne tire pas (tir automatique)', t);
  await ev(() => window.__sleep(450)); await ev(() => window.__click(0)); await ev(() => window.__sleep(120)); await ev(() => window.__click(0)); t = await S(); ok(t.ads, 'un double clic épaule', t);
  await ev(() => window.__sleep(450)); await ev(() => window.__click(0)); await ev(() => window.__sleep(120)); await ev(() => window.__click(0)); t = await S(); ok(!t.ads, 'un autre double clic range l\'arme', t);
  await ev(() => window.__sleep(450)); await ev(() => window.__click(0)); await ev(() => window.__sleep(600)); await ev(() => window.__click(0)); t = await S(); ok(!t.ads, 'deux clics trop espacés : pas un double clic', t);
  await ev(() => window.__click(2)); t = await S(); ok(t.ads, 'clic droit (toucher à deux doigts) : épaule', t);
  await ev(() => window.__click(2)); t = await S(); ok(!t.ads, 'clic droit encore : range l\'arme (jamais tenu)', t);
  await ev(() => { PL.adsWant = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' })); }); t = await S(); ok(!t.ads, 'recharger range la visée en bascule', t);
  const cur0 = (await S()).cur; await ev(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))); t = await S(); ok(t.cur === cur0, 'la molette ne change pas d\'arme', [cur0, t.cur]);
  // tir automatique : un ennemi sous le réticule, puis plus rien (la cible et le rayon sont simulés : la géométrie de la visée est celle de l'écran tactile)
  const auto = await ev(async () => {
    const out = {}, aT = aimTarget, rE = rayEntities, rW = rayWorld, foe = entities.find((e) => !e.isPlayer);
    window.__reset(); PL.ent.alive = true; PL.noFireT = 0;
    aimTarget = () => ({ e: foe, ang: 0, rad: 0.05, d: 10, yaw: PL.yaw, pitch: PL.pitch }); rayEntities = () => ({ t: 10 }); rayWorld = () => null;
    aimAssist(1 / 60); out.held = PL.held; out.queued = PL.queued;
    aimTarget = () => null; AIM.autoT = MATCH.time - 0.3; aimAssist(1 / 60); out.heldAfter = PL.held;
    aimTarget = aT; rayEntities = rE; rayWorld = rW;
    Settings.tpAuto = false; window.__reset(); aimTarget = () => ({ e: foe, ang: 0, rad: 0.05, d: 10, yaw: PL.yaw, pitch: PL.pitch }); rayEntities = () => ({ t: 10 }); rayWorld = () => null;
    aimAssist(1 / 60); out.heldSans = PL.held; Settings.tpAuto = true;
    aimTarget = aT; rayEntities = rE; rayWorld = rW; window.__reset();
    return out;
  });
  ok(auto.held && auto.queued, 'un ennemi sous le réticule : le tir part tout seul', auto);
  ok(!auto.heldSans, 'sans tir automatique, le réticule sur un ennemi ne tire pas', auto);
  ok(!auto.heldAfter, 'plus d\'ennemi sous le réticule : le tir s\'arrête', auto);
  // --- sans tir automatique, sans double clic ---
  await ev(() => { Settings.tpAuto = false; window.__reset(); window.__click(0); }); t = await S(); ok(t.queued, 'sans tir automatique, un clic tire', t);
  await ev(() => { PL.held = false; PL.queued = false; Settings.tpAuto = true; Settings.tpDblAds = false; window.__reset(); });
  await ev(() => window.__click(0)); await ev(() => window.__sleep(120)); await ev(() => window.__click(0)); t = await S(); ok(!t.ads, 'sans double clic, deux clics n\'épaulent pas', t);
  // --- mode off : la souris d'avant ---
  t = await ev(() => { Settings.tpMode = 'off'; Settings.tpDblAds = true; trackpadSync(); window.__reset(); window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); return { held: PL.held, queued: PL.queued }; }); ok(t.held && t.queued, 'mode « Désactivés » : le clic tire', t);
  await ev(() => { window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); window.dispatchEvent(new MouseEvent('mousedown', { button: 2 })); }); t = await S(); ok(t.ads, 'mode « Désactivés » : clic droit tenu, on vise', t);
  await ev(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))); t = await S(); ok(!t.ads, 'mode « Désactivés » : relâché, la visée s\'arrête', t);
  const w0 = (await S()).cur; await ev(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))); await ev(() => window.__sleep(900)); t = await S(); ok(t.cur !== w0, 'mode « Désactivés » : la molette change d\'arme', [w0, t.cur]);
  // --- visée en bascule choisie à la souris ---
  await ev(() => { Settings.adsToggle = true; trackpadSync(); window.__reset(); window.__click(2); }); t = await S(); ok(t.ads, 'visée en bascule à la souris : un clic droit épaule', t);
  await ev(() => window.__click(2)); t = await S(); ok(!t.ads, 'visée en bascule à la souris : un autre range l\'arme', t);
  // --- au doigt, jamais ---
  await ev(() => { Settings.adsToggle = false; Settings.tpMode = 'on'; TOUCH.on = true; }); ok(!(await ev(() => trackpadOn())), 'au doigt, le mode pavé ne s\'applique pas');
  await ev(() => { TOUCH.on = false; PAD.drive = true; }); ok(!(await ev(() => trackpadOn())), 'à la manette, le mode pavé ne s\'applique pas');
  await ev(() => { PAD.drive = false; });
  // --- sensibilité propre ---
  ok(await ev(() => Settings.tpSens === Settings.sens), 'au départ, la sensibilité du pavé reprend celle de la souris', await ev(() => [Settings.tpSens, Settings.sens]));
  const look = (mode) => ev(async (mode) => {
    Settings.tpMode = mode; trackpadSync(); PL.adsWant = false; for (const e of entities) if (!e.isPlayer) e.alive = false;
    await window.__frames(3); const y0 = PL.yaw; window.dispatchEvent(new MouseEvent('mousemove', { movementX: 120, movementY: 0 }));
    await window.__frames(3); return Math.abs(PL.yaw - y0);
  }, mode);
  await ev(() => { Settings.sens = 1; Settings.tpSens = 2; });
  const dMouse = await look('off'), dPad = await look('on');
  ok(dMouse > 0 && Math.abs(dPad / dMouse - 2) < 0.08, 'sensibilité du pavé : deux fois celle de la souris, deux fois le déplacement du regard', [+dMouse.toFixed(4), +dPad.toFixed(4)]);
  await ev(() => { Settings.sens = 3; }); const dPad3 = await look('on');
  ok(Math.abs(dPad3 - dPad) < dPad * 0.05, 'changer la sensibilité de la souris ne change rien au pavé', [+dPad.toFixed(4), +dPad3.toFixed(4)]);
  await ev(() => { Settings.sens = 1; Settings.tpMode = 'on'; trackpadSync(); });
  // --- Options ---
  const opt = await ev(() => {
    const rows = [...document.querySelectorAll('.orow[data-tp]')], all = [...document.querySelectorAll('.orow')];
    const vis = (r) => getComputedStyle(r).display !== 'none';
    document.body.classList.remove('trackpad'); const hidden = rows.every((r) => !vis(r));
    document.body.classList.add('trackpad'); const shown = rows.every((r) => vis(r));
    document.body.classList.toggle('trackpad', trackpadOn());
    return { rows: rows.length, hidden, shown, sens: all.some((r) => /sensibilité du pavé|trackpad sensitivity/i.test(r.textContent)), mode: all.some((r) => /pavé tactile|trackpad controls/i.test(r.textContent)), toggle: all.some((r) => /bascule|toggle aim/i.test(r.textContent)) };
  });
  ok(opt.rows >= 4 && opt.sens && opt.hidden && opt.shown, 'Options : les rangées du pavé ne s\'affichent qu\'avec le mode', opt);
  ok(opt.mode && opt.toggle, 'Options : le choix du mode et la visée en bascule existent', opt);
  const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
  ok(!errs.length, 'aucune erreur dans la page', errs.slice(0, 3));
  console.log(fails.length ? `${fails.length} échec(s)` : 'tout est bon');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
