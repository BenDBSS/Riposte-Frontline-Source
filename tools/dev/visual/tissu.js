/* Captures du tissu simulé (06gb-tissu.js) : un soldat en tenue Brèche dans une rue de Khamsin, au repos, en pleine course, à
   l'arrêt brusque, au vent de côté, puis en ragdoll ; chaque scène est vue de côté et de dos. Mesure aussi le coût d'un pas.
   node tools/dev/visual/tissu.js [dossier] ; MAP=givre pour une autre carte, XZ=x,z pour le lieu (par défaut 0,30) ; Q=low ;
   PAGE=chemin/vers/une/autre/version.html ; TENUE=nomad pour une autre tenue à tissu (par défaut Brèche : shotgun). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ settings: { quality: process.env.Q || 'high', map: process.env.MAP || 'sable' }, page: process.env.PAGE });
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  const spot = await page.evaluate(([XZ, skin]) => {
    const x0 = XZ[0], z0 = XZ[1], y0 = groundHeight(x0, z0, 3, 0.3);
    for (const e of entities) if (e.model) e.model.root.visible = false;
    const M = makeSoldier(skin, 0, 'm1014');
    const e = { model: M, pos: new V3(x0, y0, z0), vel: new V3(), yaw: Math.PI, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -9, lastSeenT: -99, arms: { adsW: 0 }, recoil: 0, sprinting: false, hp: 100, team: 0, throwT: 0 };
    setSoldierLod(M, true);
    window.__E = e;
    // avance la scène de n images à 60 i/s : vitesse v (m/s, le long de +z, la rue), vent imposé (sinon celui de la carte)
    window.__run = (n, v, wind) => {
      let ms = 0;
      for (let k = 0; k < n; k++) {
        e.vel.set(0, 0, v); e.pos.z += v / 60; e.sprinting = v > 4; e.yaw = Math.PI;
        animSoldier(e, 1 / 60);
        const t0 = performance.now();
        if (wind) { const w = CLOTH_BREEZE_DEF.slice(); CLOTH_BREEZE_DEF[0] = wind[0]; CLOTH_BREEZE_DEF[1] = wind[1]; CLOTH_BREEZE_DEF[2] = wind[2]; CLOTH_BREEZE[CURMAP.id] = undefined; clothSimulate(M, M.cloth, 1 / 60); CLOTH_BREEZE_DEF.splice(0, 3, ...w); }
        else clothSimulate(M, M.cloth, 1 / 60);
        CLOTH.t += 1 / 60;
        ms += performance.now() - t0;
      }
      return ms / n;
    };
    window.__kill = () => { e.alive = false; e.lastForce = { dir: new V3(0, 0, 1), mag: 9, lift: 4, part: 'body' }; };
    return { x0, y0, z0 };
  }, [(process.env.XZ || '0,30').split(',').map(Number), process.env.TENUE || 'shotgun']);
  const shoot = async (name, side) => {
    await page.evaluate(([S, side]) => {
      const p = __E.pos;
      if (side) camera.position.set(p.x + 3.4, S.y0 + 1.2, p.z); else camera.position.set(p.x + 0.4, S.y0 + 1.3, p.z - 3.4);
      camera.lookAt(p.x, S.y0 + 0.95, p.z); camera.fov = 45; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
      const t = performance.now(); frame(t);
    }, [spot, side]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, `tissu-${process.env.TENUE ? process.env.TENUE + '-' : ''}${name}.png`), timeout: 240000 });
  };
  const ms = [];
  ms.push(await page.evaluate(() => __run(120, 0)));
  await shoot('repos-cote', true); await shoot('repos-dos', false);
  ms.push(await page.evaluate(() => __run(60, 6.2)));
  await shoot('course-cote', true); await shoot('course-dos', false);
  ms.push(await page.evaluate(() => __run(10, 0)));
  await shoot('arret-cote', true);
  ms.push(await page.evaluate(() => __run(150, 0, [0, 1, 6])));
  await shoot('vent-cote', true); await shoot('vent-dos', false);
  await page.evaluate(() => __kill());
  ms.push(await page.evaluate(() => __run(150, 0)));
  await shoot('ragdoll-cote', true); await shoot('ragdoll-dos', false);
  console.log('coût moyen du tissu par image (ms) : repos, course, arrêt, vent, ragdoll =', ms.map((x) => x.toFixed(3)).join(' '));
  const errs = logs.filter((l) => /error|Error/.test(l) && !/Failed to load resource/.test(l)); if (errs.length) console.log(errs.slice(0, 10).join('\n'));
  await browser.close();
})();
