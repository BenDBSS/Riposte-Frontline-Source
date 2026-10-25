/* Captures de la carte depuis des caméras libres, tout le post-traitement compris.
   node shot.js [dossier] [préfixe] [qualité] [caméras.json]
   caméras.json : [["nom", [x, y, z], [cibleX, cibleY, cibleZ], champ], ...]
   PAGE=chemin/vers/une/autre/version.html : capture une autre version (comparaison avant/après).
   MAP=givre : carte à charger (par défaut, Khamsin). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots'), prefix = process.argv[3] || 'vue', Q = process.argv[4] || 'high';
const CAMS = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5], 'utf8')) : [
  ['aerien', [30, 28, 58], [0, 0, 20]], ['long', [-30, 1.7, 44], [-30, 1.5, 0]], ['rue', [0, 1.7, 38], [0, 2, 0]],
  ['portes', [-2, 1.7, 8], [-2, 2, -6]], ['souk', [8, 1.7, 6], [18, 1.5, -4]], ['hangar', [22, 1.7, 32], [34, 1.5, 22]],
  ['conteneurs', [22, 1.7, 18], [32, 1.5, 4]], ['base', [-10, 1.7, 47], [10, 2, 40]], ['maison', [-22, 1.7, 19], [-15, 1.5, 28]],
  ['passage', [8, 1.7, 16], [18, 3, 16]],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now(), { browser, page, logs } = await openGame({ settings: { quality: Q, map: process.env.MAP || 'sable' }, page: process.env.PAGE });
  console.log('chargé en', ((Date.now() - t0) / 1000).toFixed(1), 's ; étapes :', JSON.stringify(await page.evaluate(() => (typeof MAPL !== 'undefined' ? BOOT_T.concat(MAPL.T) : BOOT_T))));
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  for (const [name, p, t, fov] of CAMS) {
    await page.evaluate(([p, t, fov]) => { camera.position.set(...p); camera.lookAt(...t); camera.fov = fov || 70; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }, [p, t, fov]);
    await page.waitForTimeout(1200);
    // rendu logiciel : une vue pleine de relief peut demander plusieurs dizaines de secondes par image
    await page.screenshot({ path: path.join(out, `${prefix}-${name}.png`), timeout: 240000 });
    console.log(name, JSON.stringify(await page.evaluate(() => ({ appels: renderer.info.render.calls, triangles: renderer.info.render.triangles }))));
  }
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
