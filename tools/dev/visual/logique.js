/* Banc de la logique d'une partie, sans rendu : node logique.js [page...] (défaut : dist/riposte-frontline.html)
   Le hasard est fixé (Math.random à graine), puis une partie entre bots se joue pas à pas (1/60 s) : bots, joueur et vue subjective
   (sa main d'appui, ses doigts), grenades, armes au sol, props, effets, tissus. Pour chaque répétition : temps par pas des bots, du
   joueur et du reste, et une empreinte de l'état final (positions, éliminations, articulations des soldats).
   Comparer deux versions : la même empreinte veut dire le même comportement, à l'articulation près. Mettre l'ancienne page dans
   dist/ (git show HEAD:dist/riposte-frontline.html > dist/_avant.html, à effacer ensuite) : elle doit trouver les mêmes paquets de
   sons et de textures, car tirer une variante de son consomme le hasard. Quelques décisions dépendent de l'horloge (budgets de
   calcul) : une répétition peut s'écarter au premier lancement ou sous le profileur, les suivantes se rejoignent.
   MAP=sable (carte), PAS=900 (pas par répétition), REP=3 ; ALLOC=20 : allocations par fonction (échantillonnage du tas, les 20
   premières) ; PROF=20 : temps processeur par fonction (les 20 premières). Les temps sont ceux du processeur de la machine : on
   compare toujours deux versions dans les mêmes conditions. */
const path = require('path');
const { openGame, REPO } = require('./common');
const MAP = process.env.MAP || 'sable', PAS = +(process.env.PAS || 900), REP = +(process.env.REP || 3);
const SEED = `(() => { let a = 12345; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
const NL = '\n';
function top(m, n, N, unit, scale) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => '    ' + (v * scale / N).toFixed(3).padStart(8) + ' ' + unit + '  ' + k).join(NL);
}
(async () => {
  const pages = process.argv.slice(2); if (!pages.length) pages.push(path.join(REPO, 'dist/riposte-frontline.html'));
  for (const p of pages) {
    const { browser, page, logs } = await openGame({ page: path.resolve(p), w: 320, h: 180, settings: { quality: 'low', difficulty: 2, map: MAP }, noHdri: true, init: SEED });
    const cdp = process.env.ALLOC || process.env.PROF ? await page.context().newCDPSession(page) : null;
    if (process.env.ALLOC) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
    if (process.env.PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
    const r = await page.evaluate(({ PAS, REP }) => {
      LOCK.fallback = true; startMatch({});
      const out = [], dt = 1 / 60, bots = entities.filter((e) => !e.isPlayer);
      for (let rep = 0; rep < REP; rep++) {
        let tb = 0, tp = 0, ta = 0;
        for (let i = 0; i < PAS; i++) {
          MATCH.time += dt; MATCH.timeLeft -= dt; PL.ent.health = 100; // le joueur ne meurt pas
          for (let k = MATCH.events.length - 1; k >= 0; k--) if (MATCH.events[k].t <= MATCH.time) { const ev = MATCH.events[k]; MATCH.events.splice(k, 1); ev.fn(); }
          const t0 = performance.now();
          for (const e of bots) updateBot(e, dt, MATCH.time);
          const t1 = performance.now(); tb += t1 - t0;
          PL.yaw += 0.01; updatePlayer(dt, MATCH.time); // le joueur tourne sur lui-même : la vue et l'arme bougent
          const t2 = performance.now(); tp += t2 - t1;
          updateNades(dt); updateDrops(dt); updateProps(dt); updateFx(dt); updateSoldierLods(); clothUpdate(dt);
          ta += performance.now() - t2;
        }
        let h = 0;
        for (const e of entities) {
          h = (h * 31 + Math.round(e.pos.x * 1000) * 7 + Math.round(e.pos.z * 1000) * 13 + (e.alive ? 1 : 0) + (e.kills | 0) * 101) | 0;
          if (e.model && e.model.J) for (const j of e.model.J) h = (h * 31 + Math.round(j.x * 1e6) + Math.round(j.y * 1e6) * 3 + Math.round(j.z * 1e6) * 5) | 0;
        }
        out.push({ bots: tb / PAS, joueur: tp / PAS, reste: ta / PAS, h, score: MATCH.score.join('-') });
      }
      return out;
    }, { PAS, REP });
    console.log(path.relative(REPO, path.resolve(p)));
    for (const x of r) console.log(`  ms par pas : bots ${x.bots.toFixed(3)}, joueur ${x.joueur.toFixed(3)}, reste ${x.reste.toFixed(3)} | empreinte ${x.h}, score ${x.score}`);
    const N = PAS * REP;
    if (process.env.ALLOC) {
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      const self = new Map(); let tot = 0;
      const walk = (n, par) => { const k = (n.callFrame.functionName || '(anonyme)') + (n.callFrame.url ? '' : ' <' + par + '>'); const s = n.selfSize || 0; tot += s; self.set(k, (self.get(k) || 0) + s); for (const c of n.children || []) walk(c, n.callFrame.functionName || '(anonyme)'); };
      walk(profile.head, '');
      console.log(`  alloué : ${(tot / 1024 / N).toFixed(1)} Ko par pas` + NL + top(self, +process.env.ALLOC, N, 'Ko/pas', 1 / 1024));
    }
    if (process.env.PROF) {
      const { profile } = await cdp.send('Profiler.stop');
      const dtm = new Map(); for (let i = 0; i < profile.samples.length; i++) dtm.set(profile.samples[i], (dtm.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
      const self = new Map(); for (const n of profile.nodes) { const t = dtm.get(n.id) || 0; if (t) { const k = n.callFrame.functionName || '(anonyme)'; self.set(k, (self.get(k) || 0) + t); } }
      console.log('  temps propre par fonction :' + NL + top(self, +process.env.PROF, N, 'ms/pas', 1 / 1000));
    }
    const bad = logs.filter((l) => !l.includes('HDRI') && !l.includes('ERR_FILE'));
    if (bad.length) console.log(bad.slice(0, 5).join(NL));
    await browser.close();
  }
})();
