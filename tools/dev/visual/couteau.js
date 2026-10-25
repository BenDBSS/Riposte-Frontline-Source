/* Planche de captures du coup de couteau en vue subjective : le geste est figé à des instants fixes (0 = armé, 1 = retour)
   et photographié, puis assemblé avec ImageMagick (montage). node couteau.js [dossier] [instants=0,0.15,...] ; QUALITE=high ; MAIN=1 : le couteau tenu en main
   (sortie, repos, course en huit instants d'une foulée, puis le même coup donné depuis cette pose) ; TAILLE=740x360 pour un écran de téléphone. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const out = process.argv[2] || path.join(__dirname, 'shots');
const times = (process.argv[3] || '0,0.12,0.24,0.36,0.46,0.58,0.75,1').split(',').map(Number);
const MAIN = !!process.env.MAIN, [SW, SH] = (process.env.TAILLE || '960x540').split('x').map(Number);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: SW, h: SH, settings: { quality: process.env.QUALITE || 'medium', difficulty: 1, map: process.env.MAP || 'sable' }, noHdri: true });
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (!e.isPlayer) e.model.root.visible = false;
    VM.holder.visible = false; VM.root.visible = true;
    camera.position.set(0, 1.6, 20); camera.lookAt(0, 1.5, 0); camera.fov = Settings.fov; camera.updateProjectionMatrix();
  });
  // chaque image : l'état passé à updateRigs (S), la phase de la foulée (bob : sans phase, la main ne balance pas) ; les balancements du jeu (updateViewmodel) ne sont pas joués
  const snap = async (name, S, bob) => {
    await page.evaluate(([S, bob]) => {
      VM.holder.visible = false; VM.root.visible = true; VM.knifeRig.visible = true;
      VM.handDt = 1; // les doigts rejoignent tout de suite leur pose (updateViewmodel, qui avance leur temps, n'est pas joué)
      VM.bobAmt = bob ? 1.2 : 0; VM.bobT = bob || 0; VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0);
      for (let i = 0; i < 3; i++) updateRigs(1 / 60, Object.assign({ knifeT: 0, nadeState: null, nadeT: 0, cookT: 0 }, S));
    }, [S, bob]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, name + '.png'), timeout: 240000 });
  };
  const dur = await page.evaluate(() => KNIFE_DUR), tag = (T) => String(T).replace('.', '_');
  if (MAIN) {
    for (const h of [0.6, 0.8, 1]) await snap(`main-sortie-${tag(h)}`, { knifeHold: h });
    for (let i = 0; i < 8; i++) await snap(`main-course-${i}`, { knifeHold: 1, sprint: 1 }, (i * Math.PI) / 4 + 0.001);
    for (const T of times) await snap(`main-coup-${tag(T)}`, { knifeHold: 1, knifeNew: true, knifeT: Math.max(0.0001, dur * (1 - T)) });
  } else for (const T of times) await snap(`couteau-${tag(T)}`, { knifeT: Math.max(0.0001, dur * (1 - T)) });
  if (logs.length) console.log(logs.filter((l) => !l.includes('HDRI')).slice(0, 10).join('\n'));
  await browser.close();
})();
