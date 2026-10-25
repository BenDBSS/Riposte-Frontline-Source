/* Essai d'ambiance : une carte rendue avec une ambiance modifiée, sans toucher à son code. node ambiance.js essai.json [qualité=high]
   essai.json : { "map": "givre", "prefix": "nuit", "atmo": { ...champs de l'ambiance à remplacer (sky : fusionné champ par champ) },
                  "skyPhoto": { "key": "kloppenheim_02", "rot": 0.3, "gain": 0.4 } ou null (ciel calculé), "cams": [["nom", [x, y, z], [cx, cy, cz], champ], ...],
                  "js": "SMS.force = 1" (facultatif : exécuté une fois la carte prête, ici la tempête de Simoun au plus fort) }
   Sans "cams" : les vues de shot.js pour Khamsin, sinon le cadrage de l'illustration de la carte (MAP_DEFS.<id>.art). Les ciels photographiés
   doivent être dans assets/sky/ et la page construite (build.py). Sortie : ambiances/<prefix>-<nom>.png à côté de ce fichier (ignoré par git).
   Sert à chercher une ambiance (heure, ciel, brouillard, étalonnage, éclairage public atmo.lit, force des lampes atmo.lamps, fenêtres
   allumées winLit) avant de la recopier dans la définition de la carte. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const E = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), Q = process.argv[3] || 'high', OUT = path.join(HERE, 'ambiances');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, page: process.env.PAGE, settings: { quality: Q, map: E.map } });
  const cams = await page.evaluate((E) => {
    const D = MAP_DEFS[E.map], A = Object.assign({}, D.atmo, E.atmo || {});
    if (E.atmo && E.atmo.sky) A.sky = Object.assign({}, D.atmo.sky, E.atmo.sky);
    if (E.atmo && E.atmo.grade) A.grade = Object.assign({}, D.atmo.grade, E.atmo.grade);
    D.atmo = A;
    if (E.skyPhoto !== undefined) D.skyPhoto = E.skyPhoto;
    const art = D.art || { cam: [30, 20, 40], look: [0, 0, 0], fov: 60 };
    return E.cams || [['art', art.cam, art.look, art.fov]];
  }, E);
  await page.evaluate(() => mapEnsure(Settings.map));
  if (E.js) await page.evaluate(E.js);
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  for (const [name, p, t, fov] of cams) {
    await page.evaluate(([p, t, fov]) => { camera.position.set(...p); camera.lookAt(...t); camera.fov = fov || 70; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }, [p, t, fov]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${E.prefix || E.map}-${name}.png`), timeout: 240000 });
    console.log(name);
  }
  const err = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
  if (err.length) console.log(err.slice(0, 5).join('\n'));
  await browser.close();
})();
