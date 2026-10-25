/* Contrôle de la mini-carte (src/09ga-minicarte.js, drawMinimap dans src/09-game.js) : node minicarte.js [page=dist/riposte-frontline.html]
   CARTES=sable,stratus pour en limiter le nombre (par défaut les huit) ; TEL=1 : téléphone en paysage au lieu d'un écran de bureau ; sorties dans
   minicartes/ (ignorées par git) : le fond de chaque carte (<id>.png), la mini-carte dessinée à 368 px et à 184 px (<id>-vue.png, <id>-vue-petite.png)
   la carte de la frappe aérienne telle que la tablette l'ouvre (<id>-frappe.png)
   et le coin haut gauche de l'écran en jeu, mini-carte comprise, avec des alliés et des ennemis (<id>-ecran.png ; sans le rendu 3D, qui ralentit
   beaucoup les captures en rendu logiciel : RENDU=1 pour le garder).
   Pour chaque carte, partie lancée sans relevé satellite (la mini-carte n'en dépend plus) :
   - le fond est dessiné, à la taille de la zone de jeu avec ses marges (mmDensity px par mètre), et le fond de la frappe aérienne (KS.plan) à celle de la
     zone de jeu à TAC_S px par mètre ;
   - il porte du sol sombre et des objets clairs (ni vide, ni plaque blanche), et aucun mur n'est dessiné là où les équipes apparaissent ;
   - le dessin ne prend pas plus de 400 ms (rendu logiciel, un téléphone est quelques fois plus lent) ;
   - drawMinimap passe avec des alliés, des ennemis révélés par l'UAV, une grenade et, en domination (Val-Blanc), les points. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const OUT = path.join(HERE, 'minicartes');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const maps = (process.env.CARTES || 'sable,givre,embruns,floreal,meltem,tephra,stratus,simoun,lotissement').split(',');
  for (const id of maps) {
    console.log(id);
    const { browser, page, logs } = await openGame({ page: process.argv[2], ...(process.env.TEL ? { mobile: true } : { w: 1280, h: 720 }), settings: { quality: 'low', map: id, mode: id === 'givre' ? 'dom' : 'tdm' }, noHdri: true });
    const r = await page.evaluate((RENDU) => {
      LOCK.fallback = true; startMatch({});
      KS.sat = null; // la mini-carte se passe du relevé satellite
      if (!RENDU) composer.render = () => {};
      const t0 = performance.now(); buildMinimapStatic(); const ms = performance.now() - t0;
      const c = HUD.mmStatic, g = c.getContext('2d'), S = HUD.mmS;
      // luminance du fond : part du sol de la zone de jeu qui est sombre ou claire
      const x0 = Math.round((MAP.x0 - HUD.mmX0) * S), z0 = Math.round((MAP.z0 - HUD.mmZ0) * S), w = Math.round((MAP.x1 - MAP.x0) * S), h = Math.round((MAP.z1 - MAP.z0) * S);
      const d = g.getImageData(x0, z0, w, h).data; let dark = 0, light = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; n++; if (l < 70) dark++; else if (l > 150) light++; }
      const at = (x, z) => { const p = g.getImageData(Math.round((x - HUD.mmX0) * S), Math.round((z - HUD.mmZ0) * S), 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
      const spawns = SPAWNS.flatMap((a) => a.map((s) => at(s[0], s[1])));
      // des alliés, des ennemis (UAV), une grenade, la domination : drawMinimap doit passer
      let err = null;
      try {
        MATCH.uav[PL.ent.team] = 30;
        for (const e of entities) if (e.alive && !e.isPlayer) { e.pos.x = PL.ent.pos.x + (Math.random() - 0.5) * 30; e.pos.z = PL.ent.pos.z + (Math.random() - 0.5) * 30; }
        if (typeof NADES !== 'undefined') NADES.push({ p: new V3(PL.ent.pos.x + 3, 0, PL.ent.pos.z) });
        HUD.mmFit = true; drawMinimap(); drawMinimap();
        if (typeof NADES !== 'undefined') NADES.pop();
      } catch (e) { err = String(e); }
      const plan = KS.plan ? [KS.plan.width, KS.plan.height] : null, tacW = Math.round((MAP.x1 - MAP.x0) * TAC_S), tacH = Math.round((MAP.z1 - MAP.z0) * TAC_S);
      let tac = null; try { KS.map.open = true; KS.map.x = 0; KS.map.z = 0; drawTacMap(); tac = $('tacCanvas').toDataURL('image/png'); KS.map.open = false; } catch (e) { err = err || 'frappe : ' + e; }
      return { ms, tac, plan, tacW, tacH, W: c.width, H: c.height, S, mapW: MAP.x1 - MAP.x0, mapH: MAP.z1 - MAP.z0, darkPart: dark / n, lightPart: light / n, spawns, err, mode: MATCH.mode, dom: typeof DOM !== 'undefined' && DOM.pts ? DOM.pts.length : 0 };
    }, !!process.env.RENDU);
    ok(r.W === Math.ceil((r.mapW + 28) * r.S) && r.H === Math.ceil((r.mapH + 36) * r.S), 'fond à la taille de la zone de jeu avec ses marges', [r.W, r.H, r.S]);
    ok(r.plan && r.plan[0] === r.tacW && r.plan[1] === r.tacH, 'fond de la frappe aérienne à la taille de la zone de jeu', [r.plan, r.tacW, r.tacH]);
    ok(r.darkPart > 0.3 && r.lightPart > 0.01 && r.lightPart < 0.6, 'du sol sombre et des objets clairs', { sombre: +r.darkPart.toFixed(2), clair: +r.lightPart.toFixed(2) });
    ok(r.spawns.every((l) => l < 100), "le sol n'est pas un mur sur chaque apparition (sombre, ou gris moyen sous un toit)", r.spawns.map((l) => Math.round(l)));
    ok(r.ms < 400, 'dessin du fond en moins de 400 ms', +r.ms.toFixed(0));
    ok(!r.err, 'drawMinimap passe (alliés, ennemis, grenade' + (r.dom ? ', domination' : '') + ')', r.err || undefined);
    await page.waitForTimeout(500);
    const box = await page.evaluate(() => { const r = $('minimap').getBoundingClientRect(); return { x: 0, y: 0, width: Math.min(innerWidth, r.right + 120), height: Math.min(innerHeight, r.bottom + 90), mm: Math.round(r.width) }; });
    await page.screenshot({ path: path.join(OUT, id + (process.env.TEL ? '-tel' : '') + '-ecran.png'), clip: { x: 0, y: 0, width: box.width, height: box.height } });
    console.log('mini-carte affichée à', box.mm, 'px');
    // images : le fond, puis la mini-carte à 184 px (ordinateur) et à 92 px (téléphone), joueur au centre de la carte
    const png = await page.evaluate(() => {
      const out = { fond: HUD.mmStatic.toDataURL('image/png') };
      const cv = $('minimap');
      for (const [k, px] of [['grand', 368], ['petit', 184]]) {
        cv.width = cv.height = px; HUD.mmFit = false; PL.ent.pos.set(0, 0, 0); drawMinimap(); out[k] = cv.toDataURL('image/png');
      }
      return out;
    });
    fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(png.fond.split(',')[1], 'base64'));
    if (r.tac) fs.writeFileSync(path.join(OUT, id + '-frappe.png'), Buffer.from(r.tac.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, id + '-vue.png'), Buffer.from(png.grand.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, id + '-vue-petite.png'), Buffer.from(png.petit.split(',')[1], 'base64'));
    const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
    ok(!errs.length, 'aucune erreur dans la page', errs.slice(0, 3));
    await browser.close();
  }
  console.log(fails.length ? `${fails.length} échec(s)` : 'tout est bon');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
