/* Tissus simulés du décor (02me-toiles.js) : relevé et captures. MAP=<carte> node tissus.js [x z] [genre]
   Relève les toiles de la carte (nombre, particules, genre), puis choisit la toile du genre voulu ('pendu' par défaut) la plus proche du
   point (x, z) et la filme : au repos, pendant qu'un soldat (une capsule, comme dans le jeu) la traverse en courant, puis sous le souffle
   d'une grenade à 3 m (SIDE=-1 : filmée de l'autre côté ; CAM=x,y,z : caméra imposée). Captures : tissus/<carte>-<n>.png à côté de ce fichier (ignoré par git). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const MAP = process.env.MAP || 'sable', SIDE = +(process.env.SIDE || 1), CAM = process.env.CAM ? process.env.CAM.split(',').map(Number) : null, X = +(process.argv[2] || 0), Z = +(process.argv[3] || 0), GENRE = process.argv[4] || 'pendu', OUT = path.join(HERE, 'tissus');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, page: process.env.PAGE, settings: { quality: process.env.Q || 'medium', map: MAP } });
  await page.evaluate(() => mapEnsure(Settings.map));
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  const info = await page.evaluate(([X, Z, GENRE]) => {
    const g = (S) => (S.body ? (S.T.g < 5 ? 'drapeau' : S.T.drag < 0.5 ? 'lourd' : 'pendu') : S.shot ? 'drapeau' : 'tendu');
    const list = TOILES.map((S, i) => ({ i, genre: g(S), n: S.T.n, nappes: S.T.sheets.length, c: [S.sph.center.x, S.sph.center.y, S.sph.center.z].map((v) => +v.toFixed(1)), r: +S.sph.radius.toFixed(1) }));
    const cand = list.filter((t) => t.genre === GENRE).sort((a, b) => Math.hypot(a.c[0] - X, a.c[2] - Z) - Math.hypot(b.c[0] - X, b.c[2] - Z));
    return { list, pick: cand[0] || null };
  }, [X, Z, GENRE]);
  console.log(`${info.list.length} toiles, ${info.list.reduce((s, t) => s + t.n, 0)} particules`);
  for (const t of info.list) console.log(`  #${t.i} ${t.genre} ${t.nappes} nappe(s) ${t.n} part. centre ${t.c.join(' ')} r ${t.r}`);
  if (!info.pick) { console.log('aucune toile du genre ' + GENRE); await browser.close(); return; }
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${MAP}-${name}.png`), timeout: 240000 }); console.log(name); };
  // caméra à 4 m de la toile, de face (normale de sa première nappe), à hauteur d'homme ou de la toile
  await page.evaluate(([i, SIDE, CAM]) => {
    const S = TOILES[i], c = S.sph.center, N = S.sim.nor, n = new V3(N[0], 0, N[2]).normalize();
    if (!(n.lengthSq() > 0.5)) n.set(1, 0, 0);
    n.multiplyScalar(SIDE);
    window._tis = { S, c: c.clone(), n };
    if (CAM) camera.position.set(...CAM); else camera.position.set(c.x + n.x * 4.2, Math.max(c.y, groundHeight(c.x, c.z) + 1.7), c.z + n.z * 4.2);
    camera.lookAt(c.x, c.y - 0.2, c.z); camera.fov = 65; camera.updateProjectionMatrix();
  }, [info.pick.i, SIDE, CAM]);
  // le banc ne rend qu'une image par seconde environ (deux pas de simulation par image) : on fait avancer la simulation à la main
  const steps = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) toilesUpdate(TOILE_H); }, n);
  await steps(Math.round(4 / (1 / 60))); await page.waitForTimeout(400); await shot('repos');
  // un soldat traverse la toile en courant (6 m/s), d'un côté à l'autre, au ras de son centre ; le banc logiciel ne rend qu'une image par
  // seconde environ : la simulation avance ici pas à pas (1/60 s) pendant que le soldat avance, puis on filme
  await page.evaluate(() => {
    const T = window._tis, y = groundHeight(T.c.x, T.c.z), e = { alive: true, off: false, crouchAmt: 0, pos: new V3(), fake: true };
    entities.push(e); T.e = e; T.k = -3;
    T.go = (k1) => { while (T.k < k1) { T.k += 6 * TOILE_H; e.pos.set(T.c.x - T.n.x * T.k, y, T.c.z - T.n.z * T.k); toilesUpdate(TOILE_H); } };
    T.go(-0.35);
  });
  await page.waitForTimeout(400); await shot('traversee1');
  await page.evaluate(() => window._tis.go(0.05)); await page.waitForTimeout(400); await shot('traversee2');
  await page.evaluate(() => window._tis.go(0.5)); await page.waitForTimeout(400); await shot('traversee3');
  await page.evaluate(() => window._tis.go(3));
  await page.evaluate(() => { const T = window._tis; entities.splice(entities.indexOf(T.e), 1); toilesBlast(new V3(T.c.x + T.n.x * 3, groundHeight(T.c.x, T.c.z) + 0.3, T.c.z + T.n.z * 3), 5); });
  await steps(15); await page.waitForTimeout(400); await shot('souffle');
  await steps(210); await page.waitForTimeout(400); await shot('apres');
  const err = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
  if (err.length) console.log(err.slice(0, 5).join('\n'));
  await browser.close();
})();
