/* Killcam d'un tueur distant (src/09b-killcam.js, kcNetView ; trace des états reçus, netTrack, 09c-net.js) : node tools/dev/visual/killcam-reseau.js ; PAGE=autre.html.
   Partie en ligne simulée dans une seule page (rôle d'invité, rien n'est envoyé). Un tueur distant tourne à vitesse constante en se déplaçant en ligne
   droite ; il publie un état toutes les 66 ms, qui arrive 80 à 200 ms plus tard (parfois deux d'un coup, comme par un relais chargé). La relecture est
   jouée deux fois, avec la trace des états puis sans (la vue enregistrée, celle d'avant) ; à chaque image on mesure l'à-coup de la caméra (écart de la
   rotation d'une image à l'autre par rapport à la précédente) et l'écart au vrai regard du tueur.
   - avec la trace : les à-coups tombent à moins d'un tiers de ceux de la vue enregistrée, et la caméra suit le vrai regard avec un retard régulier
     (écart médian sous 2 degrés, et au plus 1 degré de plus) ;
   - un état sans heure d'envoi (version précédente du jeu) : la trace prend l'heure d'arrivée, la relecture se joue sans erreur.
   Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, noHdri: true, settings: { quality: 'low', map: 'sable', lang: 'fr' } });
  await page.evaluate(() => { LOCK.fallback = true; startMatch({}); composer.render = () => {}; });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 10', null, { timeout: 300000, polling: 500 });
  const run = (withTs) => page.evaluate((withTs) => {
    NET.on = true; NET.role = 'client'; NET.me = 'moi'; NET.joined = true; NET.t0 = performance.now(); NET.hostConn = { open: true, send() {} };
    for (const e of entities) if (!e.isPlayer && !e.isRemote) { e.alive = false; if (e.model) e.model.root.visible = false; }
    PL.ent.protT = 1e9; PL.ent.health = 100; kcReset();
    const id = 'kc' + (withTs ? 'A' : 'B'), W = 1.2, V = 2.5, x0 = PL.ent.pos.x + 8, z0 = PL.ent.pos.z, y0 = PL.ent.pos.y;
    const truth = (ts) => ({ yaw: 0.3 + W * ts, x: x0, z: z0 + V * (ts - 1) });
    const mk = (ts) => { const T = truth(ts); return { ts: withTs ? Math.round(ts * 1000) + 5e6 : undefined, n: 'Tueur', t: 1 - PL.ent.team, w: 'm4', g: 'm4', s: [T.x, y0, T.z, T.yaw, -0.05, 0, V, 0, 0, 1, 0, 100], f: 0, k: 0, d: 0, a: 0, sc: 0, sk: 'assault', ev: [] }; };
    // envoi toutes les 66 ms (temps de l'auteur), arrivée 80 à 200 ms plus tard ; un état sur cinq attend le suivant (deux d'un coup)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sends = []; for (let ts = 0; ts < 7; ts += 0.066) sends.push({ ts, at: ts + 0.08 + rnd() * 0.12 });
    for (let i = 0; i + 1 < sends.length; i++) if (rnd() < 0.2) sends[i].at = Math.max(sends[i].at, sends[i + 1].at);
    const t0 = MATCH.time, dt = 1 / 60; let k = 0;
    for (let f = 0; f < 7 * 60; f++) {
      MATCH.time += dt; const local = MATCH.time - t0;
      while (k < sends.length && sends[k].at <= local) netApply(id, mk(sends[k++].ts));
      netUpdate(dt); kcRecord();
    }
    const K = NET.remotes.get(id); if (!K) return { err: 'pas de tueur' };
    if (!withTs) K.net.hist = null; // la vue enregistrée seule, celle d'avant
    const tEnd = MATCH.time - 0.8;
    if (!startKillcam({ killer: K, victim: PL.ent, tEnd, final: false })) return { err: 'pas de relecture' };
    const yaws = [], errs = []; let prev = null;
    for (let f = 0; f < 150 && KC.active && KC.phase === 'replay'; f++) {
      updateKillcam(dt);
      const y = camera.rotation.y, tl = KC.t - t0; yaws.push(y);
      // vrai regard à cet instant : la trace va du temps de l'auteur au nôtre avec le trajet le plus court (80 ms au moins)
      if (KC.t < tEnd - 0.05) errs.push(Math.abs(angDiff(truth(tl - 0.08).yaw, y)));
      prev = y;
    }
    endKillcam();
    const d = []; for (let i = 1; i < yaws.length; i++) d.push(angDiff(yaws[i - 1], yaws[i]));
    let jerk = 0; for (let i = 1; i < d.length; i++) jerk += (d[i] - d[i - 1]) ** 2;
    errs.sort((a, b) => a - b);
    NET.remotes.delete(id); const ix = entities.indexOf(K); if (ix >= 0) entities.splice(ix, 1); if (K.model) scene.remove(K.model.root);
    NET.on = false; NET.role = 'off';
    return { frames: yaws.length, jerk: Math.sqrt(jerk / Math.max(1, d.length - 1)), errMed: errs[errs.length >> 1], errMax: errs[Math.floor(errs.length * 0.95)] };
  }, withTs);
  const a = await run(true), b = await run(false);
  console.log('      avec la trace :', JSON.stringify(a)); console.log('      vue enregistrée :', JSON.stringify(b));
  ok(!a.err && !b.err && a.frames > 100, 'les deux relectures se jouent', [a.err, b.err, a.frames]);
  if (!a.err && !b.err) {
    ok(a.jerk < b.jerk / 3, 'avec la trace : bien moins d\'à-coups que la vue enregistrée', [a.jerk, b.jerk]);
    const deg = (v) => +(v * 180 / Math.PI).toFixed(2);
    ok(a.errMed < 2 * Math.PI / 180 && a.errMax - a.errMed < Math.PI / 180, 'avec la trace : la caméra suit le vrai regard du tueur, avec un retard régulier', [deg(a.errMed), deg(a.errMax)]);
  }
  // un état sans heure d'envoi (version précédente) : l'heure d'arrivée, la relecture se joue
  const old = await page.evaluate(() => {
    NET.on = true; NET.role = 'client';
    const P = { n: 'Ancien', t: 1 - PL.ent.team, w: 'm4', g: 'm4', s: [PL.ent.pos.x + 6, PL.ent.pos.y, PL.ent.pos.z, 0, 0, 0, 0, 0, 0, 1, 0, 100], f: 0, k: 0, d: 0, a: 0, sc: 0, sk: 'assault', ev: [] };
    kcReset();
    for (let f = 0; f < 240; f++) { MATCH.time += 1 / 60; if (f % 4 === 0) { P.s[3] += 0.05; netApply('kcC', P); } netUpdate(1 / 60); kcRecord(); }
    const K = NET.remotes.get('kcC'), n = K.net.hist.length;
    const started = startKillcam({ killer: K, victim: PL.ent, tEnd: MATCH.time - 0.5, final: false });
    for (let f = 0; f < 60 && KC.active; f++) updateKillcam(1 / 60);
    if (KC.active) endKillcam();
    NET.on = false; NET.role = 'off';
    return { n, started };
  });
  ok(old.n >= 50 && old.started, 'état sans heure d\'envoi : tracé à l\'heure d\'arrivée, relecture jouée', old);
  const pe = logs.filter((l) => l.startsWith('[pageerror]'));
  ok(!pe.length, 'aucune erreur de page', pe.slice(0, 3));
  console.log(fails.length ? fails.length + ' échec(s)' : 'tout est bon');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('ERREUR', e); process.exit(2); });
