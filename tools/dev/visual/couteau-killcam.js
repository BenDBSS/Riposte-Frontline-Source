/* La killcam rejoue les coups de couteau du tueur (src/09b-killcam.js : événements knife et melee, part du couteau sorti dans le tampon) : node couteau-killcam.js [page] ; PAGE=autre.html.
   Le jeu tourne pour de bon (boucle d'images, rendu 3D coupé, bots figés). Trois relectures, le joueur étant le tueur :
   - un coup d'appui simple (couteau pas en main) qui tue : le couteau et le bras sont à l'écran pendant le coup, c'est le coup d'origine, l'arme baisse puis remonte, la main passe dans le champ,
     et rien ne reste en main à la fin ;
   - un coup donné couteau en main : le couteau est déjà en main et l'arme déjà baissée dès la première image, c'est le coup réglé ;
   - une relecture sans coup de couteau : le couteau n'apparaît jamais.
   Sort en erreur au premier défaut. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2] || process.env.PAGE, w: 640, h: 360, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); composer.render = () => {}; // rendu 3D coupé : la boucle d'images tourne vite en rendu logiciel
    window.botsTick = () => {};
    window.entChest = (e, out) => out.set(e.pos.x, e.pos.y + 1.3, e.pos.z);
  });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40', null, { timeout: 300000, polling: 500 });
  const spot = await page.evaluate(() => {
    for (let x = -30; x <= 30; x += 3) for (let z = -30; z <= 30; z += 3) for (let a = 0; a < 8; a++) {
      const yaw = a * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw), g = groundHeight(x, z, 5, 0.3);
      if (Math.abs(g) > 0.3) continue;
      let free = true;
      for (let d = 0; d <= 6 && free; d++) { const q = new V3(x + dx * d, g, z + dz * d), x0 = q.x, z0 = q.z; collideCircle(q, 0.36, 1.75); free = Math.hypot(q.x - x0, q.z - z0) < 0.01 && Math.abs(groundHeight(x0, z0, 5, 0.3) - g) < 0.3; }
      if (free) return { x, z, yaw };
    }
    return null;
  });
  ok(!!spot, 'un terrain dégagé de 6 m', spot);
  if (!spot) { await browser.close(); process.exit(1); }
  // le joueur à sa place, un ennemi à 1,6 m devant lui (aucun si enemy est faux), le couteau sorti ou non
  const setup = (enemy, knifeOut) => page.evaluate(({ s, enemy, knifeOut }) => {
    const e = PL.ent; e.alive = true; e.health = 100; e.pos.set(s.x, groundHeight(s.x, s.z, 5, 0.3), s.z); e.vel.set(0, 0, 0); e.vy = 0; e.onGround = true;
    PL.yaw = s.yaw; PL.pitch = 0; PL.protT = 99; e.protT = 99; PL.knifeT = 0; PL.knifeBtn = null; PL.nadeState = null; PL.reload = null; PL.knifeOut = false; PL.knifeHold = 0;
    VM.lowerTarget = 0; VM.lower = 0;
    for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; }
    if (enemy) {
      const f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], b = entities.find((o) => !o.isPlayer && o.team !== e.team);
      b.alive = true; b.model.root.visible = true; b.health = 100; b.pos.set(e.pos.x + f[0] * 1.6, e.pos.y, e.pos.z + f[1] * 1.6);
    }
    if (knifeOut) { knifeDraw(); VM.lowerTarget = 1; }
  }, { s: spot, enemy, knifeOut });
  const rec = () => page.evaluate(() => { kcReset(); }); // l'enregistrement de la killcam repart de zéro
  // relecture : une image sur deux de l'état de la vue du tueur, jusqu'à la fin
  const replay = () => page.evaluate(() => new Promise((resolve) => {
    const v = new V3(), out = [], victim = entities.find((o) => !o.isPlayer && o.team !== PL.ent.team);
    if (!startKillcam({ killer: PL.ent, victim, tEnd: window.__tEnd, final: false, info: '' })) { resolve(null); return; }
    const step = () => {
      if (!KC.active || out.length > 900) { resolve({ frames: out, after: { vis: VM.knifeRig.visible, state: MATCH.state } }); return; }
      VM.root.updateMatrixWorld(true); VM.knifeArm.hand.localToWorld(v.set(0, 0, 0)); v.project(vmCamera);
      out.push({ t: +KC.t.toFixed(3), vis: VM.knifeRig.visible, kt: +(KC.knifeT || 0).toFixed(3), neu: !!KC.knifeNew, low: +VM.lower.toFixed(2), up: !!KC.knifeUp, x: +v.x.toFixed(2), y: +v.y.toFixed(2) });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
  // un coup donné pour de bon, puis le temps de remplir le tampon après le coup
  const stab = async () => {
    await page.evaluate(() => { knife(); });
    await page.waitForFunction('PL.knifeHit', null, { timeout: 20000, polling: 10 });
    await page.evaluate(() => { window.__tEnd = MATCH.time; });
    await wait(page, 700);
  };

  // 1. appui simple, couteau pas en main : le coup d'origine
  await setup(true, false); await wait(page, 300); await rec(); await wait(page, 700);
  await stab();
  const killed = await page.evaluate(() => !entities.find((o) => !o.isPlayer && o.team !== PL.ent.team).alive);
  ok(killed, 'le coup de couteau tue l\'ennemi à 1,6 m', { killed });
  let R = await replay();
  ok(!!R && R.frames.length > 5, 'la killcam démarre et dure', { frames: R && R.frames.length });
  if (R) {
    const F = R.frames, stabF = F.filter((f) => f.kt > 0);
    ok(stabF.length > 2 && stabF.every((f) => f.vis), 'coup d\'appui simple rejoué : le couteau et le bras sont à l\'écran pendant le coup', { images: stabF.length });
    ok(stabF.length > 2 && stabF.every((f) => !f.neu), 'coup d\'appui simple rejoué : c\'est le coup d\'origine', { neu: stabF.map((f) => f.neu).slice(0, 3) });
    ok(F.some((f) => f.kt > 0 && f.low > 0.5), 'coup rejoué : l\'arme baisse pendant le coup', { low: Math.max(...F.map((f) => f.low)) });
    const mid = stabF.filter((f) => f.kt < 0.32 && f.kt > 0.22);
    ok(mid.length > 0 && mid.every((f) => Math.abs(f.x) < 1.2 && f.y > -1.2 && f.y < 1), 'coup rejoué : la main passe dans le champ au contact', mid.map((f) => [f.x, f.y]).slice(0, 3));
    const first = F.find((g) => g.kt > 0), before = first ? F.filter((f) => f.t < first.t - 0.05) : [];
    ok(before.length > 0 && before.every((f) => !f.vis && f.low < 0.05), 'avant le coup : ni couteau ni arme baissée', { n: before.length });
    ok(!R.after.vis, 'fin de la relecture : plus de couteau dans la vue', R.after);
  }
  await wait(page, 300);

  // 2. coup donné couteau en main : le couteau et l'arme baissée dès la première image, le coup réglé
  await setup(true, true); await wait(page, 1200); await rec(); await wait(page, 700);
  await stab();
  R = await replay();
  ok(!!R && R.frames.length > 5, 'la killcam démarre (couteau en main)', { frames: R && R.frames.length });
  if (R) {
    const F = R.frames, stabF = F.filter((f) => f.kt > 0);
    ok(F[0].vis && F[0].low > 0.95 && F[0].up, 'couteau en main : il l\'est dès la première image, l\'arme déjà baissée', F[0]);
    ok(stabF.length > 2 && stabF.every((f) => f.neu), 'couteau en main : c\'est le coup réglé', { neu: stabF.map((f) => f.neu).slice(0, 3) });
    ok(F.every((f) => f.vis), 'couteau en main : il reste à l\'écran avant, pendant et après le coup', { sans: F.filter((f) => !f.vis).length });
    ok(!R.after.vis, 'fin de la relecture : plus de couteau dans la vue', R.after);
  }
  await wait(page, 300);

  // 3. une relecture sans coup de couteau : rien du couteau
  await setup(false, false); await wait(page, 300); await rec(); await wait(page, 1000);
  await page.evaluate(() => { window.__tEnd = MATCH.time - 0.2; });
  R = await replay();
  ok(!!R && R.frames.length > 3, 'la killcam démarre (sans couteau)', { frames: R && R.frames.length });
  if (R) ok(R.frames.every((f) => !f.vis && f.kt === 0 && f.low < 0.05), 'sans coup de couteau : le couteau n\'apparaît jamais, l\'arme reste en main', { couteau: R.frames.filter((f) => f.vis).length });

  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED'));
  ok(errs.length === 0, 'console propre', errs.slice(0, 3));
  await browser.close();
  if (fails.length) { console.log(fails.length + ' échec(s)'); process.exit(1); }
  console.log('tout est bon');
})().catch((e) => { console.error(e); process.exit(1); });
