/* Exporte les atlas de végétation (herbier, src/02o-herbier.js) en PNG pour les juger à l'œil, sans charger de carte.
   node atlas.js [dossier] [A|B|AB] */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots'), which = process.argv[3] || 'AB';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, noHdri: true });
  for (const k of which) {
    const t0 = Date.now();
    const url = await page.evaluate((k) => herbierCanvas(k).toDataURL('image/png'), k);
    fs.writeFileSync(path.join(out, `herbier-${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('atlas', k, (Date.now() - t0) + ' ms');
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
