/* Qualité des apparitions : simulation accélérée d'une partie entre bots (le joueur est retiré du jeu), qui note chaque apparition au moment
   où elle a lieu. node apparitions.js [secondes=180] [page=dist/riposte-frontline.html] ; MAP=givre, MODE=tdm, ffa ou dom, DIFF=0 à 2.
   Rapporte, pour les réapparitions en cours de partie :
     vue       part des apparitions qu'un adversaire voit (ligne de vue dégagée vers la tête ou le buste, à moins de 60 m) ;
     deFace    part de celles qu'un adversaire voit dans son champ (60 degrés de part et d'autre de son regard) : il voit l'autre apparaître ;
     proche    part de celles qui ont un adversaire à moins de 15 m ;
     mort5     part des vies finies dans les 5 s qui suivent l'apparition (tué à l'apparition) ;
     distAdv   médiane de la distance à l'adversaire le plus proche ;
     ms        durée d'une apparition (choix de la place compris), médiane et pire cas, sur cette machine ;
   et pour le départ : la plus petite distance entre deux soldats et le nombre de paires à moins de 1,5 m (des places partagées).
   Plusieurs graines (SEEDS=3) : la moyenne. JSON sur une ligne, à comparer avant et après une retouche du système d'apparition. */
const { openGame } = require('./common');
(async () => {
  const secs = +(process.argv[2] || 180), seeds = +(process.env.SEEDS || 1);
  const { browser, page, logs } = await openGame({ page: process.argv[3], w: 480, h: 270, settings: { quality: 'low', difficulty: +(process.env.DIFF || 2), map: process.env.MAP || 'sable', mode: process.env.MODE || 'tdm' }, noHdri: true });
  const runs = [];
  for (let s = 0; s < seeds; s++) runs.push(await page.evaluate((secs) => {
    LOCK.fallback = true;
    const ev = [], deaths = [], V = new THREE.Vector3(), W = new THREE.Vector3();
    // chaque apparition est notée telle que les adversaires la voient à cet instant
    const note = (e, open) => {
      let md = 999, seen = 0, face = 0, near = 0;
      for (const o of entities) {
        if (!o.alive || o === e || o.off || allied(o, e)) continue;
        const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d = Math.hypot(dx, dz);
        md = Math.min(md, d); if (d < 15) near = 1;
        if (d > 60) continue;
        entEye(o, W);
        if (!lineClear(V.set(e.pos.x, e.pos.y + 1.6, e.pos.z), W) && !lineClear(V.set(e.pos.x, e.pos.y + 1.0, e.pos.z), W)) continue;
        seen = 1;
        const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
        if (d < 1 || (fx * dx + fz * dz) / d > Math.cos(Math.PI / 3)) face = 1;
      }
      ev.push({ open, md, seen, face, near, team: e.team, x: e.pos.x, z: e.pos.z });
    };
    const orig = spawnEntity, ms = [];
    window.spawnEntity = function (e) { const t0 = performance.now(); orig(e); ms.push(performance.now() - t0); if (!e.isPlayer) note(e, MATCH.time - MATCH.startAt < 0.01); };
    try {
      startMatch({});
      // le joueur sort du jeu : ni cible ni gêne pour les apparitions
      PL.ent.alive = false; PL.ent.pos.set(MAP.x1 + 400, -50, MAP.z1 + 400); PL.ent.model && (PL.ent.model.root.visible = false);
      const bots = entities.filter((e) => !e.isPlayer && !e.off);
      // départ : distances entre soldats (toutes équipes), sur les places tirées par startMatch
      let minD = 999, pairs = 0;
      for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
        if (!bots[i].alive || !bots[j].alive) continue;
        const d = Math.hypot(bots[i].pos.x - bots[j].pos.x, bots[i].pos.z - bots[j].pos.z); minD = Math.min(minD, d); if (d < 1.5) pairs++;
      }
      const dt = 1 / 30;
      for (let i = 0; i < secs * 30; i++) {
        MATCH.time += dt; MATCH.timeLeft -= dt;
        for (const e of bots) if (e.protT > 0) { e.protT -= dt; if (e.lastShotT > e.spawnAt) e.protT = 0; }
        for (let k = MATCH.events.length - 1; k >= 0; k--) if (MATCH.events[k].t <= MATCH.time) { const x = MATCH.events[k]; MATCH.events.splice(k, 1); x.fn(); }
        const was = bots.map((e) => e.alive);
        for (const e of bots) updateBot(e, dt, MATCH.time);
        updateNades(dt);
        if (MATCH.mode === 'dom') domUpdate(dt);
        bots.forEach((e, k) => { if (was[k] && !e.alive) deaths.push(MATCH.time - (e.spawnAt || 0)); }); // (tué par le tir d'un autre, pendant la mise à jour de celui-ci)
      }
      return { ev, deaths, minD, pairs, ms };
    } finally { window.spawnEntity = orig; }
  }, secs));
  const all = runs.flatMap((r) => r.ev.filter((e) => !e.open)), deaths = runs.flatMap((r) => r.deaths);
  const pct = (n, d) => (d ? +((n / d) * 100).toFixed(1) : 0), med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[b.length >> 1].toFixed(1) : 0; };
  const r = {
    carte: process.env.MAP || 'sable', mode: process.env.MODE || 'tdm', apparitions: all.length,
    vue: pct(all.filter((e) => e.seen).length, all.length), deFace: pct(all.filter((e) => e.face).length, all.length),
    proche: pct(all.filter((e) => e.near).length, all.length), mort5: pct(deaths.filter((t) => t < 5).length, deaths.length), morts: deaths.length,
    distAdv: med(all.map((e) => e.md)), ms: { mediane: med(runs.flatMap((r) => r.ms)), max: +Math.max(...runs.flatMap((r) => r.ms)).toFixed(1) },
    depart: { distMin: +Math.min(...runs.map((r) => r.minD)).toFixed(2), pairesSous1m5: runs.reduce((a, r) => a + r.pairs, 0) },
  };
  console.log(JSON.stringify(r));
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
