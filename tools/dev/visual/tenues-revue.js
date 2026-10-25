/* Revue des modèles des tenues (référence low poly, voir README « Règles de modélisation des tenues ») : pour chaque tenue, dans le studio
   de l'écran Tenues (09u-tenues.js), soldat debout, arme basse, tissu retombé : corps entier de face, de trois quarts, de profil et de
   dos, tête de face et de dos, buste, jambes ; une planche par tenue (revue-<tenue>.png). En visée (VISEE=1), même chose arme épaulée.
   node tools/dev/visual/tenues-revue.js [dossier] ; TENUES=assault,nomad (par défaut les dix) ; PAGE=autre/version.html */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots');
const VUES = [
  ['face', 'corps', 0, 2.7, 40], ['34', 'corps', 0.75, 2.7, 40], ['profil', 'corps', 1.57, 2.7, 40], ['dos', 'corps', 3.14, 2.7, 40],
  ['tete', 'tete', 0.35, 0.8, 38], ['tete-dos', 'tete', 2.7, 0.8, 38], ['buste', 'buste', 0.5, 1.2, 40], ['jambes', 'jambes', 0.6, 1.6, 40],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 1500, h: 1050, settings: { quality: 'high', map: 'sable' }, noMap: true, noHdri: true, page: process.env.PAGE });
  await page.evaluate(() => uiOpen('skins', ['main']));
  await page.waitForFunction(() => MBG.live && SKV.live, null, { timeout: 120000, polling: 500 });
  const skins = process.env.TENUES ? process.env.TENUES.split(',') : await page.evaluate(() => SKIN_ALL);
  const box = await page.evaluate((visee) => {
    GPUX.halt = true; // boucle du jeu suspendue : chaque image est rendue ici, à pas fixe
    const f = skinLivePose;
    skinLivePose = (M, key, d) => { const e = skinLiveEnt(M, key); e.arms.adsW = visee ? 1 : 0; f(M, key, d, false); }; // debout, sans marcher
    const r = $('skView').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, !!process.env.VISEE);
  const { execFileSync } = require('child_process');
  for (const sk of skins) {
    await page.evaluate((sk) => { skinView(sk); SKV.a = 0; for (let i = 0; i < 60; i++) { SKV.acc = 1 / 30; skinLiveDraw(); } }, sk);
    const files = [];
    for (const [nm, cible, az, dist, fov] of VUES) {
      await page.evaluate(([cible, az, dist, fov]) => {
        vwCamPlace = (cam) => {
          const M = skinLiveModel(SKV.view), B = M.bones, t = new THREE.Vector3();
          if (cible === 'tete') t.copy(B[SB.HEA].position).add(new THREE.Vector3(0, 0.06, 0));
          else if (cible === 'buste') t.copy(B[SB.CHE].position).add(new THREE.Vector3(0, -0.05, 0));
          else if (cible === 'jambes') t.set(B[SB.PEL].position.x, 0.5, B[SB.PEL].position.z);
          else t.set(B[SB.PEL].position.x, 0.92, B[SB.PEL].position.z);
          // soldat tourné vers -z (SKV.a = 0) ; az : la caméra tourne autour de lui, vers sa droite
          cam.position.set(t.x + Math.sin(az) * dist, t.y + dist * 0.12, t.z - Math.cos(az) * dist); cam.up.set(0, 1, 0); cam.lookAt(t); cam.fov = fov; cam.updateProjectionMatrix();
        };
        SKV.acc = 0; skinLiveDraw();
      }, [cible, az, dist, fov]);
      const f = path.join(out, `revue-${sk}-${nm}.png`); await page.screenshot({ path: f, clip: box, timeout: 240000 }); files.push(f);
    }
    // planche : deux rangées de quatre
    try { execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs = sys.argv[2:]; ims = []
for f in fs:
    im = Image.open(f).convert('RGB'); s = 420 / im.size[1]; im = im.resize((int(im.size[0] * s), 420)); ImageDraw.Draw(im).text((4, 4), f.split('revue-')[-1][:-4], fill=(255, 255, 0)); ims.append(im)
W = ims[0].size[0]; o = Image.new('RGB', (W * 4, 840))
for i, im in enumerate(ims): o.paste(im, ((i % 4) * W, (i // 4) * 420))
o.save(sys.argv[1])`, path.join(out, `revue-${sk}.png`), ...files]); } catch (e) { console.log('planche :', e.message); }
    console.log('revue', sk);
  }
  const errs = logs.filter((l) => !l.includes('HDRI') && !l.includes('FILE_NOT_FOUND')); if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
