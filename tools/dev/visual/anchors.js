/* Lignes tendues : vérifie que chaque bout du linge, des fils électriques, des guirlandes et des amarres tient à quelque chose
   (un mur, un poteau, une bitte ; une amarre n'a besoin que d'un bout à quai, l'autre tient au bateau : une boîte de collision du décor à moins de 35 cm, à la bonne hauteur).
   node anchors.js        Khamsin ;  MAP=givre node anchors.js  ou  MAP=embruns node anchors.js
   Sort en erreur au premier bout accroché à rien. */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'sable';
(async () => {
  const { browser, page } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const m = 0.35, bad = [], per = {};
    const held = (p) => COL.some((c) => !c.prop && p[0] >= c.x0 - m && p[0] <= c.x1 + m && p[2] >= c.z0 - m && p[2] <= c.z1 + m && p[1] >= c.y0 - 0.1 && p[1] <= c.y1 + 0.5);
    for (const l of LINES) {
      per[l.k] = (per[l.k] || 0) + 1;
      // une amarre tient d'un côté à une bitte du quai, de l'autre à un bateau (qui flotte et n'a pas de boîte de collision)
      const ends = [['a', l.a], ['b', l.b]].filter(([, p]) => !held(p));
      if (l.k === 'amarre' ? ends.length === 2 : ends.length) for (const [name, p] of ends) bad.push(l.k + ' (' + p.map((v) => v.toFixed(1)).join(', ') + ') bout ' + name + ' accroché à rien');
    }
    return { per, bad };
  });
  console.log(JSON.stringify(R.per));
  await browser.close();
  if (R.bad.length) { console.error('ÉCHEC :\n' + R.bad.join('\n')); process.exit(1); }
  console.log('anchors : tout est accroché');
})();
