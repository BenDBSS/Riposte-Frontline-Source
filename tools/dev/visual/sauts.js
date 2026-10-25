/* Sauts : chaque lien de saut du réseau des bots (03-nav.js, navLeaps : montée sur un rebord de 0,47 à 1 m, enjambement d'un obstacle bas, descente d'un rebord jusqu'à 3 m) passé au
   contrôleur du jeu. node sauts.js [--json]   (MAP=meltem ; PAGE=autre version)
   Un marcheur (un soldat de la carte, mené par ctlMove comme le joueur et les bots) part de 2 m avant le nœud de départ (à défaut de place, de
   1 m, puis du nœud lui-même, à l'arrêt), marche vers le nœud d'arrivée à l'allure de la marche puis du sprint, et saute quand la règle des bots
   (botLeapNow, 07e-humain.js) le demande. Un lien passe s'il le pose sur l'arrivée en 3 s : au sol, à moins de 0,6 m en plan et de 0,35 m de haut
   pour une montée ou un enjambement ; à moins de 2,5 m et de 0,5 m au-dessus à 1 m au-dessous pour une descente (il ne tombe pas à côté, ni dans le vide).
   Sortie : le nombre de liens par type, les échecs regroupés par mode et par hauteur, les premiers échecs avec les boîtes qui touchent le marcheur ;
   code d'erreur s'il en reste. Compter une minute. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'sable';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', difficulty: 2, map } });
  const R = await page.evaluate(() => {
    LOCK.fallback = true; startMatch({});
    const N = NAV.count, links = [], LEAD = {};
    for (let i = 0; i < N; i++) if (NAV.comp[i] === NAV.mainComp) for (let j = NAV.adjStart[i]; j < NAV.adjStart[i + 1]; j++) if (NAV.adjKind[j]) { links.push([i, NAV.adj[j], NAV.adjKind[j]]); LEAD[i + ':' + NAV.adj[j]] = NAV.adjLead[j]; }
    const w = entities.find((e) => !e.isPlayer); w.alive = true; w.health = 1e9;
    const I = w.input, dt = 1 / 30, fails = [], stat = { montees: 0, enjambements: 0, descentes: 0, echecs: { marche: 0, sprint: 0 }, parHauteur: {} };
    const hasLedge = (x, z) => COL.filter((c) => !c.ray && x > c.x0 - 0.6 && x < c.x1 + 0.6 && z > c.z0 - 0.6 && z < c.z1 + 0.6 && c.y1 > w.pos.y - 0.05 && c.y0 < w.pos.y + 1.8).slice(0, 4).map((c) => c.m + ' [' + [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((v) => +v.toFixed(2)).join(', ') + ']');
    for (const [a, b, kind] of links) {
      const ax = NAV.nx[a], ay = NAV.ny[a], az = NAV.nz[a], bx = NAV.nx[b], by = NAV.ny[b], bz = NAV.nz[b], rise = by - ay;
      if (kind === 1) stat.montees++; else if (kind === 3) stat.enjambements++; else stat.descentes++;
      const ux = bx - ax, uz = bz - az, ul = Math.hypot(ux, uz) || 1;
      let start = [ax, az, 'arrêté'];
      const clear = (sx, sz) => { // le point de départ est au même niveau et rien ne le sépare du nœud de départ
        if (!botSpotFree(sx, sz, ay, false) || Math.abs(groundHeight(sx, sz, ay + 0.05, 0.3) - ay) > 0.1) return false;
        for (let f = 0; f <= 1.0001; f += 0.125) { const px = sx + (ax - sx) * f, pz = sz + (az - sz) * f; if (!botSpotFree(px, pz, ay, false) || Math.abs(groundHeight(px, pz, ay + 0.05, 0.3) - ay) > 0.1) return false; }
        return true;
      };
      for (const back of [2, 1]) { const sx = ax - ux / ul * back, sz = az - uz / ul * back; if (clear(sx, sz)) { start = [sx, sz, back + ' m']; break; } }
      const key = (kind === 1 ? 'montée ' : kind === 3 ? 'enjambement ' : 'descente ') + (Math.round(Math.abs(rise) * 4) / 4).toFixed(2);
      for (const mode of kind === 2 ? ['marche'] : ['marche', 'sprint']) { // les bots ralentissent au bord d'une chute de plus de 0,9 m
        w.pos.set(start[0], ay + 0.01, start[1]); w.vel.set(0, 0, 0); w.vy = 0; w.onGround = true; w.slideT = 0; w.slideCd = 0; w.crouch = false; w.jumpHeld = false; w.input.jump = false; w.airVy = 0; w.eyeH = 1.62;
        let ok = false, maxY = ay, jt = 0;
        const PA = { x: ax, y: ay, z: az }, P = { x: bx, y: by, z: bz, jump: kind !== 2, lead: LEAD[a + ':' + b] };
        for (let f = 0; f < 90; f++) {
          const dx = bx - w.pos.x, dz = bz - w.pos.z;
          w.yaw = Math.atan2(-dx, -dz); I.mx = 0; I.mz = 1; I.sprint = mode === 'sprint'; I.crouch = false; I.ads = false; I.slide = false;
          if (jt <= 0 && kind !== 2 && botLeapNow(w, PA, P)) jt = 0.12;
          I.jump = jt > 0 && w.onGround; if (jt > 0) jt -= dt;
          ctlMove(w, dt); maxY = Math.max(maxY, w.pos.y);
          if (w.pos.y < -20) break;
          const dh = Math.hypot(bx - w.pos.x, bz - w.pos.z), dy = Math.abs(w.pos.y - by);
          if (w.onGround && (kind !== 2 ? dh < 0.6 && dy < 0.35 : dh < 2.5 && w.pos.y < by + 0.5 && w.pos.y > by - 1.0)) { ok = true; break; }
        }
        if (!ok) {
          stat.echecs[mode]++; stat.parHauteur[key] = (stat.parHauteur[key] || 0) + 1;
          if (fails.length < 25) fails.push({ type: kind === 1 ? 'montée' : kind === 3 ? 'enjambement' : 'descente', mode, depart: start[2], de: [ax, ay, az].map((v) => +v.toFixed(2)), vers: [bx, by, bz].map((v) => +v.toFixed(2)), fin: [w.pos.x, w.pos.y, w.pos.z].map((v) => +v.toFixed(2)), zone: zoneName(ax, az), boites: hasLedge(w.pos.x, w.pos.z) });
        }
      }
    }
    return { map: CURMAP.id, liens: links.length, ...stat, fails };
  });
  await browser.close();
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.map} : ${R.liens} liens de saut (${R.montees} montées, ${R.enjambements} enjambements, ${R.descentes} descentes) ; échecs à la marche ${R.echecs.marche}, au sprint ${R.echecs.sprint}`);
    if (Object.keys(R.parHauteur).length) console.log('  par hauteur : ' + Object.entries(R.parHauteur).sort().map(([k, v]) => `${k} : ${v}`).join(', '));
    for (const f of R.fails) console.log(`  ÉCHEC ${f.type} (${f.mode}, départ ${f.depart}) de (${f.de.join(', ')}) vers (${f.vers.join(', ')}) ${f.zone}, fin (${f.fin.join(', ')}) ; ${f.boites.join(' ; ')}`);
  }
  process.exit(R.echecs.marche + R.echecs.sprint ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
