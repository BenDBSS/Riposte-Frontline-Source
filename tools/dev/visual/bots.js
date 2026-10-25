/* Simulation accélérée d'une partie entre bots (le joueur reste invulnérable dans sa base) : vérifie que les bots se
   déplacent et combattent sur la carte. node bots.js [secondes=90] [page=dist/riposte-frontline.html] ; MAP=givre : autre carte.
   Rapporte aussi les zones où les bots passent le plus de temps et les éliminations par zone, et ce que la simulation a fait
   aux props physiques (délogés, brisés, nombre maximal en mouvement), et, sur une carte d'îles flottantes, les bots tombés dans le vide.
   Mesure aussi les murs : part du temps vivant où le décor reprend plus de la moitié du déplacement voulu (`murs.partDuTemps`), nombre de
   ces chocs par minute et par bot, durée de la pire série continue (`murs.serieMax`, quelques secondes au plus : un bot ne reste pas le nez
   contre une cloison, 07e-humain.js) ; et l'usage des mouvements (`mouvements` : sprint, accroupi, glissade, en l'air, nombre de sauts et de
   glissades). DIFF=0 à 2 (défaut 2, Vétéran) règle le niveau des bots, MODE=tdm, ffa ou dom le mode. */
const { openGame } = require('./common');
(async () => {
  const secs = +(process.argv[2] || 90);
  const { browser, page, logs } = await openGame({ page: process.argv[3], w: 480, h: 270, settings: { quality: 'low', difficulty: +(process.env.DIFF || 2), map: process.env.MAP || 'sable', mode: process.env.MODE || 'tdm' }, noHdri: true });
  const r = await page.evaluate((secs) => {
    LOCK.fallback = true; startMatch({});
    // le joueur, invulnérable, reste au fond de sa base (hors de portée)
    PL.ent.pos.set(SPAWNS[0][0][0], 0, VOID.on ? SPAWNS[0][0][1] + 4 : MAP.z1 - 0.5); // îles flottantes : au bord de la zone, c'est le vide
    const dt = 1 / 30, bots = entities.filter((e) => !e.isPlayer), dist = new Map(bots.map((e) => [e, 0])), prev = new Map(bots.map((e) => [e, e.pos.clone()]));
    const zt = new Map(), zk = new Map(), stuck = new Map(bots.map((e) => [e, 0]));
    const kills0 = new Map(bots.map((e) => [e, 0])); let pmax = 0, falls = 0;
    // murs : pour chaque bot, la part du pas voulu (vitesse avant collision) que le décor a reprise, sur 0,5 s glissantes
    const W = new Map(bots.map((e) => [e, { w: [], cm: 0, lost: 0, bump: false, t: 0, tot: 0, events: 0, streaks: [], alive: 0, sprint: 0, crouch: 0, slide: 0, air: 0, jumps: 0, slides: 0, ground: true, sl: false }]));
    for (let i = 0; i < secs * 30; i++) {
      MATCH.time += dt; MATCH.timeLeft -= dt; PL.ent.health = 1e9;
      for (const e of bots) if (e.protT > 0) e.protT -= dt; // protection de réapparition (09i-modes.js, que la boucle de frame n'appelle pas ici)
      for (let k = MATCH.events.length - 1; k >= 0; k--) if (MATCH.events[k].t <= MATCH.time) { const ev = MATCH.events[k]; MATCH.events.splice(k, 1); ev.fn(); }
      const alive = new Map(bots.map((e) => [e, e.alive]));
      for (const e of bots) {
        const x0 = e.pos.x, z0 = e.pos.z, was = e.alive, w = W.get(e);
        updateBot(e, dt, MATCH.time); const d = e.pos.distanceTo(prev.get(e)); dist.set(e, dist.get(e) + d); prev.get(e).copy(e.pos);
        if (!was || !e.alive) { w.w.length = 0; w.cm = w.lost = 0; if (w.bump) { w.streaks.push(w.t); w.bump = false; w.t = 0; } }
        else {
          w.alive += dt;
          const cx = e.vel.x * dt, cz = e.vel.z * dt, cm = Math.hypot(cx, cz), lost = cm > 1e-4 ? Math.max(0, cm - ((e.pos.x - x0) * cx + (e.pos.z - z0) * cz) / cm) : 0;
          w.w.push([cm, lost]); w.cm += cm; w.lost += lost; if (w.w.length > 15) { const o = w.w.shift(); w.cm -= o[0]; w.lost -= o[1]; }
          const ratio = w.cm > 1 ? w.lost / w.cm : 0;
          if (!w.bump && ratio > 0.55) { w.bump = true; w.t = 0; w.events++; } else if (w.bump && ratio < 0.25) { w.streaks.push(w.t); w.bump = false; w.t = 0; }
          if (w.bump) { w.t += dt; w.tot += dt; }
          if (e.sprinting) w.sprint += dt; if (e.crouch) w.crouch += dt; if ((e.slideT || 0) > 0) { w.slide += dt; if (!w.sl) w.slides++; } w.sl = (e.slideT || 0) > 0; if (!e.onGround) w.air += dt;
          if (w.ground && !e.onGround && e.vy > 1) w.jumps++; w.ground = e.onGround;
        }
        if (e.alive) { const z = zoneName(e.pos.x, e.pos.z); zt.set(z, (zt.get(z) || 0) + dt); if (d < 0.002 && !e.goal) stuck.set(e, stuck.get(e) + dt); }
      }
      for (const e of bots) if (alive.get(e) && !e.alive) { const z = zoneName(e.pos.x, e.pos.z); zk.set(z, (zk.get(z) || 0) + 1); if (e.voidDead) falls++; }
      updateNades(dt);
      if (typeof updateProps === 'function') { updateProps(dt); pmax = Math.max(pmax, PHYS.awake.length); }
    }
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ');
    const props = typeof PHYS === 'undefined' ? null : { corps: PHYS.bodies.filter((b) => !b.pooled).length, enMouvementAuPlusHaut: pmax, deloges: PHYS.bodies.filter((b) => !b.pooled && b.origin && (b.state === 2 || b.p.distanceTo(new V3(b.origin.x, b.p.y, b.origin.z)) > 0.3)).length, brises: PHYS.bodies.filter((b) => !b.pooled && b.state === 0).length };
    const sum = (f) => bots.reduce((a, e) => a + f(W.get(e)), 0), alive = sum((w) => w.alive) || 1, streaks = bots.flatMap((e) => W.get(e).streaks).sort((a, b) => a - b), pct = (v) => +(v / alive * 100).toFixed(1) + ' %';
    const murs = { partDuTemps: +(sum((w) => w.tot) / alive * 100).toFixed(2) + ' %', chocsParMinuteParBot: +(sum((w) => w.events) / (alive / 60)).toFixed(2), serieMax: +(streaks[streaks.length - 1] || 0).toFixed(2) };
    const mouvements = { sprint: pct(sum((w) => w.sprint)), accroupi: pct(sum((w) => w.crouch)), glissade: pct(sum((w) => w.slide)), enLair: pct(sum((w) => w.air)), sauts: sum((w) => w.jumps), glissades: sum((w) => w.slides) };
    return { props, murs, mouvements, ...(VOID.on ? { chutes: falls } : {}), score: MATCH.score, eliminations: bots.map((e) => e.kills - kills0.get(e)), metres: bots.map((e) => Math.round(dist.get(e))), temps: top(zt), morts: top(zk) };
  }, secs);
  console.log(JSON.stringify(r));
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
