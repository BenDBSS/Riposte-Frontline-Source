/* Vent de la flore (voir « Vent de la flore » du README) : node vent.js        CARTES=sable,simoun pour en limiter la liste.
   Pour chaque carte (en qualité Basse, dans une vue choisie sur de la flore : VUES) :
   - aucun programme de shader refusé (gpuCheckPrograms), la console reste propre ;
   - chaque maillage d'une matière au vent (WM_WIND : foliage, cyfol, conifer, stem ; WM_LIVE : leafA, leafB, cane de Hortus et de Stratus) porte
     l'attribut de souplesse aSw (les poids eux-mêmes sont libérés de la mémoire vive une fois envoyés au GPU) ;
   - la même vue prise à quelques secondes d'écart change là où il y a de la flore (une part des pixels diffère) : le vent anime bien l'image.
   Une carte sans flore au vent (Kervénec, Tephra) doit n'avoir aucune matière au vent et aucune image qui bouge à cause d'elle. Sort en erreur au
   premier défaut. Variables : CHROMIUM (navigateur). */
const { openGame } = require('./common');
const MAPS = (process.env.CARTES || 'sable,givre,embruns,floreal,meltem,tephra,stratus,simoun').split(',');
// cartes dont le décor porte de la flore au vent
const FLORE = { sable: true, givre: true, embruns: false, floreal: true, meltem: true, tephra: false, stratus: true, simoun: true };
// vue de chaque carte sur de la flore : [caméra, cible, champ] (palmier de la base, sapin de la placette, allée de Hortus, platane de la place, bosquet, oasis) ;
// les cartes sans flore gardent la vue de leur illustration (`art`)
const VUES = {
  sable: [[-15, 2, 43], [-9, 5.5, 48.5], 60], givre: [[14, 2, 20.6], [20.6, 3.5, 20.6], 60], floreal: [[0, 1.75, 42.9], [0.4, 4.6, 18], 62],
  meltem: [[-2, 4, 12], [-8.5, 8, 0], 60], stratus: [[18, 2, 12], [27, 6, 3], 60], simoun: [[-6, 2, -9], [-3.6, 7, 3.9], 60],
};
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };

(async () => {
  for (const id of MAPS) {
    const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: id } });
    await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
    const R = await page.evaluate((vues) => {
      const bad = gpuCheckPrograms().map((b) => b.name + ' ' + b.log), mats = {};
      for (const m of WORLD.meshes) {
        const mat = m.material, wind = mat.defines && (mat.defines.WM_WIND !== undefined || mat.defines.WM_LIVE !== undefined);
        if (!wind) continue;
        const a = m.geometry.attributes.aSw, k = m.name.split(':')[1], r = mats[k] || (mats[k] = { meshes: 0, verts: 0, noAttr: 0 });
        r.meshes++; if (!a) { r.noAttr++; continue; }
        r.verts += a.count;
      }
      const art = CURMAP.def.art, v = vues || [art.cam, art.look, art.fov || 60];
      camera.position.set(...v[0]); camera.lookAt(...v[1]); camera.fov = v[2]; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
      return { bad, mats, wind: [...WIND_U.uWnD.value.toArray()] };
    }, VUES[id] || null);
    ok(R.bad.length === 0, `${id} : aucun programme refusé${R.bad.length ? ' : ' + R.bad.join(' | ') : ''}`);
    const names = Object.keys(R.mats);
    if (FLORE[id]) {
      ok(names.length > 0, `${id} : des matières au vent (${names.join(', ') || 'aucune'})`);
      for (const k of names) ok(R.mats[k].noAttr === 0 && R.mats[k].verts > 0, `${id} : ${k} porte les poids de souplesse (${R.mats[k].meshes} maillages, ${R.mats[k].verts} sommets)`);
    } else ok(names.length === 0, `${id} : pas de matière au vent (${names.join(', ') || 'aucune'})`);
    ok(R.wind[2] > 0.5 && R.wind[2] < 1.6 && Math.abs(Math.hypot(R.wind[0], R.wind[1]) - 1) < 1e-3, `${id} : vent de la carte (direction ${R.wind[0].toFixed(2)}, ${R.wind[1].toFixed(2)}, force ${R.wind[2].toFixed(2)})`);
    // trois images de la même vue, à 1,7 s d'écart : la plus grande différence est celle qui compte (deux instants peuvent tomber en phase)
    const shots = [];
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(i ? 1700 : 2500); shots.push((await page.screenshot({ timeout: 240000 })).toString('base64')); }
    const diff = await page.evaluate(async (S) => {
      const load = (b) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); res(g.getImageData(0, 0, im.width, im.height).data); }; im.src = 'data:image/png;base64,' + b; });
      const D = await Promise.all(S.map(load)); let best = 0;
      for (let a = 0; a < D.length; a++) for (let b = a + 1; b < D.length; b++) { let n = 0; for (let i = 0; i < D[a].length; i += 4) if (Math.abs(D[a][i] - D[b][i]) + Math.abs(D[a][i + 1] - D[b][i + 1]) + Math.abs(D[a][i + 2] - D[b][i + 2]) > 60) n++; best = Math.max(best, n / (D[a].length / 4)); }
      return best;
    }, shots);
    if (FLORE[id]) ok(diff > 0.0015, `${id} : la flore bouge (${(diff * 100).toFixed(2)} % des pixels changent d'une image à l'autre)`);
    else console.log(`      ${id} : ${(diff * 100).toFixed(2)} % des pixels changent (eau, ciel, drapeaux : à titre indicatif)`);
    const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND'));
    ok(errs.length === 0, `${id} : console propre${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
    await browser.close();
  }
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
