/* Vitrine des modèles : chaque prefab d'une série posé seul sur un terrain vide (le sol de Khamsin, sans la ville), photographié de trois
   quarts avant et arrière, avec ses collisions en fil de fer sur une seconde vue. Sert à retoucher un modèle et ses variantes sans charger
   une carte entière, et à vérifier que ce qu'on voit et ce qu'on touche coïncident.
   node vitrine.js [série=voitures] [qualité=high] [--cols] [--profil] [--seul=nom,nom]      (séries : voir SERIES ; PAGE=autre version)
   --profil ajoute une vue de côté et une vue de face à hauteur d'homme (placement des vitres), --seul ne photographie que les modèles nommés.
   Sortie : vitrine/<série>-<n°>-<nom>-avant.png, -arriere.png (-profil.png et -face.png avec --profil, -cols.png avec --cols) à côté de ce fichier, ignorés par git ; en console,
   les triangles et les boîtes de collision de chaque modèle. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const args = process.argv.slice(2), serie = args.find((a) => !a.startsWith('-') && !/^(high|medium|low)$/.test(a)) || 'voitures';
const Q = args.find((a) => /^(high|medium|low)$/.test(a)) || 'high', withCols = args.includes('--cols'), withSide = args.includes('--profil');
const only = (args.find((a) => a.startsWith('--seul=')) || '').slice(7).split(',').filter(Boolean);
const OUT = path.join(HERE, 'vitrine');
/* Une série : [nom, expression du prefab (évaluée dans la page), teinte, boîtes de collision (expression, facultative), taille (m)].
   Un véhicule montre les boîtes que pose la carte (pf.vcols, vehCols) ; un prefab qui porte les siennes (M.col) les montre aussi. */
const SERIES = {
  // objets courants des cartes (revue d'octobre 2026)
  objets: [
    ['groupe', 'PF.generator()', 'null', null, 3], ['benne', 'PF.dumpster()', '[0.25, 0.42, 0.3]', null, 3], ['touret', 'PF.reel()', 'null', null, 2.5],
    ['fut', 'PF.barrel()', '[0.3, 0.42, 0.55]', null, 1.5], ['jerrican', 'PF.jerrycan()', '[0.75, 0.15, 0.1]', null, 1], ['bouteille', 'PF.gasBottle()', '[0.2, 0.35, 0.65]', null, 1],
    ['chaise', 'PF.chair()', 'null', null, 1.5], ['table', 'PF.cafeTable()', 'null', null, 1.5], ['jarre', 'PF.jar()', 'null', null, 1.5],
    ['poteau', 'PF.pole()', 'null', null, 9], ['borne', 'PF.bollard()', 'null', null, 1.2], ['parpaings', 'PF.blocks()', 'null', null, 2],
  ],
  // objets du port et de l'hiver (revue d'octobre 2026)
  quai: [
    ['machine-glace', 'PF.iceMachine()', 'null', null, 5], ['chambre-froide', 'PF.coldRoom(4, 3, 3)', 'null', null, 8], ['tapis', 'PF.conveyor(4)', 'null', null, 4],
    ['palette-glace', 'PF.icePallet()', 'null', null, 2], ['bitte', 'PF.bitt()', 'null', null, 1], ['poteau-bouee', 'PF.lifeRingStand()', 'null', null, 2],
    ['luge', 'PF.sled()', 'null', null, 1.5], ['bucher', 'PF.woodpile()', 'null', null, 3], ['barriere', 'PF.fence()', 'null', null, 4],
    ['planches', 'PF.plankStack()', 'null', null, 4], ['foin', 'PF.hayBale()', 'null', null, 1.5], ['etal', 'PF.etal(1)', 'null', null, 3],
  ],
  // toits et rues (revue d'octobre 2026)
  rues: [
    ['clim', 'PF.acUnit()', 'null', null, 1.5], ['citerne', 'PF.waterTank()', 'null', null, 2.5], ['parabole', 'PF.dish()', 'null', null, 1.5],
    ['chauffe-eau', 'PF.solarHeater()', 'null', null, 2.5], ['rateau', 'PF.antenna()', 'null', null, 3], ['lampadaire', 'PF.lampPost()', 'null', null, 6],
    ['pneus', 'PF.tire()', 'null', null, 1.2], ['comptoir', 'PF.counter()', 'null', null, 3], ['etal-marche', 'PF.stall([0.7, 0.2, 0.15])', 'null', null, 3.5],
    ['lanterne', 'PF.lantern()', 'null', null, 1], ['table', 'PF.table()', 'null', null, 2.5], ['chaise', 'PF.chair()', '[0.2, 0.35, 0.65]', null, 1.2],
  ],
  // engins et gros objets du port (refaits d'après photos, octobre 2026)
  port: [
    ['chariot', 'PF.forklift()', '[0.95, 0.75, 0.15]', null, 4.5],
    ['grue', 'PF.quayCrane(9)', 'null', null, 14],
  ],
  voitures: [
    ['berline', "PF.car('sedan')", "[0.86, 0.84, 0.78]", "vehCols('sedan')", 5],
    ['berline-poussiere', "PF.car('sedan', { dust: 1 })", "[0.55, 0.12, 0.1]", "vehCols('sedan')", 5],
    ['berline-epave', "PF.car('sedan', { wreck: 1 })", 'null', "vehCols('sedan', { wreck: 1 })", 5],
    ['citadine', "PF.car('hatch')", "[0.2, 0.32, 0.5]", "vehCols('hatch')", 4.5],
    ['citadine-epave', "PF.car('hatch', { wreck: 1 })", 'null', "vehCols('hatch', { wreck: 1 })", 4.5],
    ['suv', "PF.car('suv')", "[0.55, 0.12, 0.1]", "vehCols('suv')", 5],
    ['monospace', "PF.car('mpv')", "[0.2, 0.32, 0.5]", "vehCols('mpv')", 5],
    ['crossover', "PF.car('cross')", "[0.86, 0.86, 0.84]", "vehCols('cross')", 5],
    ['4x4', "PF.car('offroad')", "[0.12, 0.5, 0.62]", "vehCols('offroad')", 5],
    ['4x4-boue', "PF.car('offroad', { dust: 1, rack: 1 })", "[0.62, 0.58, 0.48]", "vehCols('offroad')", 5],
    ['4x4-epave', "PF.car('offroad', { wreck: 1 })", 'null', "vehCols('offroad', { wreck: 1 })", 5],
  ],
  camions: [
    ['militaire-bache', "PF.truck('army', { load: 'tarp' })", '[0.42, 0.44, 0.32]', "vehCols('army', { load: 'tarp' })", 8],
    ['militaire-plateau', "PF.truck('army', { load: 'open' })", '[0.66, 0.58, 0.44]', "vehCols('army', { load: 'open' })", 8],
    ['militaire-epave', "PF.truck('army', { wreck: 1 })", 'null', "vehCols('army', { wreck: 1 })", 8],
    ['porteur-ridelles', "PF.truck('cargo', { load: 'cargo' })", '[0.72, 0.62, 0.42]', "vehCols('cargo', { load: 'cargo' })", 8],
    ['porteur-bache', "PF.truck('cargo', { load: 'tarp' })", '[0.36, 0.42, 0.3]', "vehCols('cargo', { load: 'tarp' })", 8],
    ['fourgon', "PF.truck('box')", '[0.9, 0.9, 0.88]', "vehCols('box')", 8],
    ['frigo', "PF.truck('box', { reefer: 1 })", '[0.9, 0.3, 0.12]', "vehCols('box', { reefer: 1 })", 8],
    ['fourgon-epave', "PF.truck('box', { wreck: 1 })", 'null', "vehCols('box', { wreck: 1 })", 8],
  ],
  sacs: [
    ['sac-jute', 'PF.sandbagFat()', 'SANDBAG_TINT.jute', '', 1.2],
    ['sac-kaki', 'PF.sandbagFat()', 'SANDBAG_TINT.kaki', '', 1.2],
    ['sac-blanc', 'PF.sandbagFat()', 'SANDBAG_TINT.blanc', '', 1.2],
    ['sac-bas', 'PF.sandbag()', 'SANDBAG_TINT.sable', '', 1.2],
  ],
  // les murs de sacs : des corps physiques posés par les constructeurs (sandbags, sandbagArc, sandbagU, sandbagPile)
  murs: [
    ['droit', "(x, z) => sandbags(x, z, 3.6, 'x', 4)", '', '', 5],
    ['double', "(x, z) => sandbagWall(x, z, 3.6, 0, { rows: 5, deep: 2 })", '', '', 5],
    ['arc', "(x, z) => sandbagArc(x, z + 2.4, 3.2, -2.2, -0.9, { rows: 4 })", '', '', 5],
    ['fer-a-cheval', "(x, z) => sandbagU(x, z, 3.0, 1.8, 0, { rows: 4 })", '', '', 5],
    ['tas', "(x, z) => sandbagPile(x, z, 2.6, 0, { seed: 3 })", '', '', 4],
    ['kaki', "(x, z) => sandbagWall(x, z, 3.0, 0, { rows: 3, color: 'kaki' })", '', '', 5],
  ],
};
(async () => {
  const list = SERIES[serie];
  if (!list) { console.error('série inconnue : ' + serie + ' (' + Object.keys(SERIES).join(', ') + ')'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, noHdri: false, page: process.env.PAGE, settings: { quality: Q, map: 'sable' } });
  // la carte : le sol de Khamsin seul, chaque modèle sur une rangée (8 par rangée, 10 m d'écart sur x, 14 m entre rangées)
  const info = await page.evaluate((list) => {
    const D = MAP_DEFS.sable, spots = list.map((it, i) => [-31.5 + (i % 8) * 9, -20 + Math.floor(i / 8) * 14]), out = [];
    D.build = function () {
      SR.rng = rngOf(1337);
      list.forEach(([name, pfx, tint, colx], i) => {
        const [x, z] = spots[i], f = (0, eval)(pfx);
        if (typeof f === 'function' && !f.parts) { f(x, z); out.push({ name, tris: 0, cols: [] }); return; }
        const t = (0, eval)('(' + (tint || 'null') + ')');
        DECOR.place(f, x, 0, z, 0, t ? { tint: t } : undefined);
        const boxes = f.vcols || (colx ? (0, eval)(colx) : []);
        if (boxes.length) colShape(x, 0, z, 0, boxes);
        out.push({ name, tris: Math.round(f.tris()), cols: boxes.concat(f.cols.map((c) => [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1])) });
      });
    };
    D.after = () => {}; D.update = () => {};
    return mapEnsure('sable').then(() => ({ spots, out }));
  }, list);
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  const shot = async (file, p, t, fov) => {
    await page.evaluate(([p, t, fov]) => { camera.position.set(...p); camera.lookAt(...t); camera.fov = fov; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }, [p, t, fov]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, file), timeout: 240000 });
  };
  for (let i = 0; i < list.length; i++) {
    const [name, , , , size] = list[i], [x, z] = info.spots[i], s = size || 5, o = info.out[i], tag = `${serie}-${String(i + 1).padStart(2, '0')}-${name}`;
    console.log(`${name} : ${o.tris} triangles, ${o.cols.length} boîte${o.cols.length > 1 ? 's' : ''}${o.cols.length ? ' : ' + o.cols.map((b) => '[' + b.map((v) => +(+v).toFixed(2)).join(' ') + ']').join(' ') : ''}`);
    if (only.length && !only.includes(name)) continue;
    await shot(tag + '-avant.png', [x + s * 0.62, s * 0.34, z - s * 0.9], [x, s * 0.12, z], 50);
    await shot(tag + '-arriere.png', [x - s * 0.7, s * 0.3, z + s * 0.85], [x, s * 0.12, z], 50);
    if (withSide) {
      await shot(tag + '-profil.png', [x + s * 1.25, s * 0.16, z], [x, s * 0.16, z], 40);
      await shot(tag + '-face.png', [x + s * 0.12, s * 0.2, z - s * 1.3], [x, s * 0.16, z], 40);
    }
    if (withCols && o.cols.length) {
      await page.evaluate(([x, z, cols]) => {
        const g = new THREE.Group(); g.name = 'vitrineCols';
        for (const b of cols) { const m = new THREE.Mesh(new THREE.BoxGeometry(b[1] - b[0], b[3] - b[2], b[5] - b[4]), new THREE.MeshBasicMaterial({ color: 0xff2060, wireframe: true, depthTest: false })); m.position.set(x + (b[0] + b[1]) / 2, (b[2] + b[3]) / 2, z + (b[4] + b[5]) / 2); m.renderOrder = 9; g.add(m); }
        scene.add(g);
      }, [x, z, o.cols]);
      await shot(tag + '-cols.png', [x + s * 1.1, s * 0.25, z], [x, s * 0.12, z], 50);
      await page.evaluate(() => { const g = scene.getObjectByName('vitrineCols'); if (g) scene.remove(g); });
    }
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
