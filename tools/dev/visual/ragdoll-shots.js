/* Planche de captures d'un ragdoll : un soldat est tué sur la carte avec la force choisie, puis photographié de côté à
   des instants fixes. node ragdoll-shots.js [dossier] [scénario=fusil] [instants=0.1,0.3,0.6,1,1.6,3]
   Scénarios : fusil, fusil-dos, tete, jambes, pompe, sniper, explosion, course, cote.
   SPOT=x,z : lieu du tir (par défaut, le point le plus dégagé de la carte) ; MAP=givre. Assembler avec ImageMagick (montage). */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const out = process.argv[2] || path.join(__dirname, 'shots'), name = process.argv[3] || 'fusil';
const times = (process.argv[4] || '0.1,0.3,0.6,1,1.6,3').split(',').map(Number);
const SC = {
  fusil: { dir: [0, 0, 1], mag: 5.4, lift: 3 }, 'fusil-dos': { dir: [0, 0, -1], mag: 5.4, lift: 3 }, tete: { dir: [0, 0, 1], mag: 6.2, lift: 3, part: 'head' },
  jambes: { dir: [0, 0, 1], mag: 5.4, lift: 3, part: 'legs' }, pompe: { dir: [0, 0, 1], mag: 8.2, lift: 4.4 }, sniper: { dir: [0, 0, 1], mag: 7.4, lift: 4.2 },
  explosion: { dir: [0, 0, 1], mag: 14, lift: 12, radial: true }, course: { dir: [0, 0, -1], mag: 5.4, lift: 3, vel: 5.5 }, cote: { dir: [1, 0, 0], mag: 5.4, lift: 3 },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = SC[name]; if (!s) { console.log('scénarios :', Object.keys(SC).join(', ')); process.exit(1); }
  const { browser, page, logs } = await openGame({ w: 800, h: 450, settings: { quality: 'medium', difficulty: 1, map: process.env.MAP || 'sable' }, noHdri: true });
  await page.evaluate(([s, spot]) => {
    LOCK.fallback = true; startMatch({}); MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (!e.isPlayer) e.model.root.visible = false;
    PL.ent.model.root.visible = false; VM.root.visible = false;
    const bot = entities.find((e) => !e.isPlayer); window.__bot = bot; window.__spot = spot;
    bot.pos.set(spot[0], 0, spot[1]); bot.yaw = 0; bot.alive = true; bot.model.rag = null; bot.model.sink = 0; bot.respawnT = 1e9; bot.model.root.visible = true;
    const dt = 1 / 60, vel = s.vel || 0; bot.vel.set(0, 0, -vel); bot.sprinting = vel > 4;
    for (let i = 0; i < 40; i++) { bot.pos.z -= vel * dt; animSoldier(bot, dt); }
    bot.lastForce = { dir: new V3(...s.dir).normalize(), mag: s.mag, lift: s.lift, part: s.part || 'body', radial: !!s.radial };
    bot.alive = false; window.__t = 0;
  }, [s, (process.env.SPOT || (process.env.MAP === 'givre' ? '7,38' : '0,14')).split(',').map(Number)]);
  let t = 0;
  for (const T of times) {
    await page.evaluate((T) => { const dt = 1 / 60; while (window.__t < T - 1e-6) { animSoldier(window.__bot, dt); window.__t += dt; } }, T);
    await page.evaluate(() => {
      const b = window.__bot, J = b.model.J, c = J[J_PEL];
      camera.position.set(c.x + 3.6, 1.3, c.z + 0.6); camera.lookAt(c.x, 0.35, c.z); camera.fov = 52; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, `${name}-${String(T).replace('.', '_')}.png`), timeout: 240000 });
    console.log(T, JSON.stringify(await page.evaluate(() => { const b = window.__bot, p = b.model.J[J_PEL]; return { pel: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), sleep: b.model.rag && b.model.rag.sleep }; })));
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
