/* Changement de carte : charge chaque carte jouable l'une après l'autre (comme l'écran de chargement d'une partie),
   puis revient à la première ; vérifie que les collisions, les rampes et la navigation sont identiques après
   l'aller-retour, et relève les erreurs de la console. node maps.js [page=dist/riposte-frontline.html] */
const { openGame } = require('./common');
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 480, h: 270, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  const r = await page.evaluate(async () => {
    const dump = () => ({ id: CURMAP.id, col: COL.length, sig: COL.reduce((h, c) => (h * 31 + Math.round((c.x0 + c.x1 * 3 + c.y1 * 7 + c.z0 * 11) * 100)) | 0, 0), ramps: RAMPS.length, nav: NAV.count, covers: COVERS.length, meshes: WORLD.meshes.length, objs: MAPL.root ? MAPL.root.children.length : 0, tris: WORLD.tris });
    const out = [dump()];
    for (const m of MAPS.filter((x) => x.ok && x.id !== CURMAP.id).concat([MAPS[0]])) {
      const t0 = performance.now();
      await mapEnsure(m.id);
      out.push(Object.assign(dump(), { ms: Math.round(performance.now() - t0) }));
    }
    return out;
  });
  for (const d of r) console.log(JSON.stringify(d));
  const a = r[0], b = r[r.length - 1];
  console.log(a.sig === b.sig && a.col === b.col && a.nav === b.nav && a.ramps === b.ramps ? 'aller-retour : collisions et navigation identiques' : 'ÉCART après l\'aller-retour');
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
