/* Arme en course pendant un rechargement : node course-recharge.js [--armes m4,mp5,usp,l96,m1014] [--images dossier]   (PAGE=autre version)
   Joue, pour chaque arme, un rechargement à l'arrêt puis le même en sprint (foulées comprises), à 60 images par seconde, et relève
   à chaque image la hauteur à l'écran de la bouche du canon et du milieu de l'arme (coordonnées normalisées : 0 au milieu, 1 en haut).
   Une arme dont l'un de ces points monte au-dessus du réticule, à moins de 0,25 de lui en largeur, gêne la visée. Sortie : une ligne par arme et par cas (haut moyen et le plus haut, part du temps où l'arme couvre le réticule) ; avec
   --images, 8 images par cas. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ids = opt('armes', 'm4,mp5,usp,l96,m1014').split(','), imgDir = opt('images', '');
(async () => {
  if (imgDir) fs.mkdirSync(imgDir, { recursive: true });
  const { browser, page } = await openGame({ w: 640, h: 360, page: process.env.PAGE, settings: { quality: imgDir ? 'medium' : 'low', dynres: false }, noMap: true, noHdri: true });
  await page.evaluate(() => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (typeof sky !== 'undefined') sky.visible = false;
    scene.background = new THREE.Color(0x8a939c);
    const S = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    const v = new THREE.Vector3();
    window.__cr = {
      setup(id, sprint) {
        const def = weaponDef(id, [], null);
        vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null; VM.farK = 0;
        camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); camera.fov = Settings.fov; camera.updateProjectionMatrix();
        vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0);
        Object.assign(S, { sprint, speed: sprint ? 7.4 : 0, fwd: sprint ? 7.4 : 0 });
        VM.breath = 0; VM.bobT = 0; VM.bobAmt = 0;
        for (let i = 0; i < 90; i++) updateViewmodel(1 / 60, S);
        if (def.tube) return [['shellStart', 0.32, {}], ['shell', 0.46, {}], ['shell', 0.46, {}], ['shellEnd', 0.3, {}]];
        return [['reload', def.reload, {}]];
      },
      start(a) { vmStartAction(a[0], a[1], Object.assign({}, a[2])); },
      step(dt) {
        updateViewmodel(dt, S); VM.root.updateMatrixWorld(true); vmCamera.updateMatrixWorld(true);
        // bouche du canon et milieu de l'arme (origine du support) à l'écran
        VM.cur.muzzle.getWorldPosition(v).project(vmCamera); const mx = v.x, my = v.y;
        VM.holder.getWorldPosition(v).project(vmCamera);
        const top = Math.max(my, v.y), x0 = Math.min(mx, v.x), x1 = Math.max(mx, v.x);
        return [top, x0, x1, VM.sprint];
      },
    };
  });
  for (const id of ids) for (const sprint of [false, true]) {
    const prog = await page.evaluate(([id, s]) => __cr.setup(id, s), [id, sprint]);
    const fr = [];
    for (const a of prog) {
      await page.evaluate((a) => __cr.start(a), a);
      const n = Math.round(a[1] * 60), per = Math.max(1, Math.floor(n / 4));
      for (let i = 0; i < n; i += per) {
        fr.push(...await page.evaluate(([k, dt]) => { const r = []; for (let j = 0; j < k; j++) r.push(__cr.step(dt)); return r; }, [Math.min(per, n - i), 1 / 60]));
        if (imgDir) await page.screenshot({ path: path.join(imgDir, `${id}-${sprint ? 'course' : 'arret'}-${String(fr.length).padStart(3, '0')}.png`) });
      }
    }
    const tops = fr.map((f) => f[0]), cov = fr.filter((f) => f[0] > 0 && f[1] < 0.25 && f[2] > -0.25).length / fr.length;
    console.log(`${id.padEnd(6)} ${sprint ? 'course' : 'arrêt '} : haut moyen ${(tops.reduce((a, b) => a + b, 0) / tops.length).toFixed(2)}, le plus haut ${Math.max(...tops).toFixed(2)}, réticule couvert ${Math.round(cov * 100)} % du temps, pose de sprint ${Math.max(...fr.map((f) => f[3])).toFixed(2)}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
