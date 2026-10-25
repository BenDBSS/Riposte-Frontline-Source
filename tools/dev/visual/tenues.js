/* Captures des tenues (06ga-tenues.js) dans une carte : chaque tenue vue par un allié (clair) puis, juste à sa droite, par un
   ennemi (sombre), de face, de dos, de profil (tournés d'un quart de tour), de près et les têtes ; plus une vue de loin pour juger la lecture allié / ennemi.
   node tools/dev/visual/tenues.js [dossier] ; MAP=givre pour une autre carte (par défaut, Khamsin), XZ=x,z pour le lieu de la rangée
   (dégagé sur 8 m de large et 30 m vers +z ; par défaut 0,30, une rue de Khamsin) ; Q=low pour la qualité Basse ;
   PAGE=chemin/vers/une/autre/version.html pour une autre version ; TENUES=defi pour les tenues de défi (06gc-tenues-defi.js), ou une
   liste (TENUES=nomad,void) ; par défaut, les quatre tenues de base ; VUES=face,loin pour ne rendre que ces vues. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ settings: { quality: process.env.Q || 'high', map: process.env.MAP || 'sable' }, page: process.env.PAGE });
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  // rangée : chaque tenue en clair puis en sombre (même éclairage pour les deux), face à la caméra ; lieu dégagé de la carte
  const spot = await page.evaluate(([XZ, list]) => {
    const x0 = XZ[0], z0 = XZ[1], y0 = groundHeight(x0, z0, 3, 0.3);
    for (const e of entities) if (e.model) e.model.root.visible = false;
    window.__T = [];
    let i = 0;
    const skins = list === 'defi' ? SKIN_DEFI : list ? list.split(',') : SKIN_IDS, n = skins.length * 2;
    for (const s of skins) for (const rel of [0, 1]) {
      const M = makeSoldier(s, rel, { assault: 'm4', smg: 'mp5', sniper: 'l96', shotgun: 'm1014', nomad: 'm1014', tempest: 'l96', verdant: 'l96', raptor: 'mp5', void: 'm4', gilet: 'm4' }[s]);
      const e = { model: M, pos: new V3(x0 - (n - 1) * 0.55 + i * 1.1, y0, z0), vel: new V3(), yaw: 0, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -9, lastSeenT: -99, arms: { adsW: 0 }, recoil: 0 };
      setSoldierLod(M, true); __T.push(e); i++;
    }
    window.__n = n;
    // (ces soldats ne sont pas des entités : leur tissu simulé, 06gb-tissu.js, est calculé ici)
    window.__pose = (yaw) => { for (const e of __T) { e.yaw = yaw; for (let k = 0; k < 30; k++) { animSoldier(e, 1 / 30); if (e.model.cloth) clothSimulate(e.model, e.model.cloth, 1 / 30); } } };
    __pose(Math.PI);
    return { x0, y0, z0 };
  }, [(process.env.XZ || '0,30').split(',').map(Number), process.env.TENUES || '']);
  const far = Math.max(1, (await page.evaluate(() => __n)) / 8); // une rangée plus longue que huit soldats : les vues d'ensemble reculent
  const views = [
    ['face', [0, 1.35, 6.2 * far], [0, 1.0, 0], 50, Math.PI], ['dos', [0, 1.35, 6.2 * far], [0, 1.0, 0], 50, 0], ['profil', [0, 1.35, 6.2 * far], [0, 1.0, 0], 50, Math.PI / 2],
    ['pres-1', [-2.2, 1.5, 2.6], [-2.2, 1.25, 0], 45, Math.PI], ['pres-2', [2.2, 1.5, 2.6], [2.2, 1.25, 0], 45, Math.PI],
    ['tetes', [-0.55, 1.72, 1.1], [-0.55, 1.6, 0], 40, Math.PI], ['loin', [2.5, 1.7, -24], [0, 1.0, 0], 62, 0.15],
  ];
  for (const [name, c, t, fov, yaw] of views.filter((v) => !process.env.VUES || process.env.VUES.split(',').includes(v[0]))) {
    await page.evaluate(([c, t, fov, yaw, S]) => {
      __pose(yaw);
      camera.position.set(S.x0 + c[0], S.y0 + c[1], S.z0 + c[2]); camera.lookAt(S.x0 + t[0], S.y0 + t[1], S.z0 + t[2]); camera.fov = fov; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
    }, [c, t, fov, yaw, spot]);
    await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 3; k++) frame(t + k * 16); }); // la boucle d'images ne tourne pas d'elle-même sans affichage
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `tenues-${name}.png`), timeout: 240000 });
    console.log(name);
  }
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
