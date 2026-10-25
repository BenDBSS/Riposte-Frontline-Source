/* Banc des ragdolls : tue un soldat avec une force donnée (arme, partie touchée, direction) et suit le corps image par
   image. Trois séries :
   - terrain plat : l'effet de chaque arme (distance parcourue, pic de vitesse, sommeil, os étirés) ;
   - géométrie de la carte : contre un mur, sur une caisse, sur une rampe, en chute libre, explosion contre un mur ;
   - tirage aléatoire : des centaines de morts (arme, angle, vitesse, lieu) pour traquer ce qui bugge : corps qui ne
     s'endort pas, qui glisse après le repos, qui traverse un mur, valeurs aberrantes (NaN), os étirés.
   node ragdoll.js [page=dist/riposte-frontline.html] ; MAP=givre pour l'autre carte ; N=300 : nombre de tirages ;
   DETAIL=1 : trace seconde par seconde de la série plate ; TRACE=nom T=t0,t1 : trace image par image d'un cas ;
   RAGSET='{"iters":4}' : réglages de RAG essayés sans reconstruire ; SEED=n : graine du hasard (rejoue les mêmes cas) ; REP=20 : répète la série plate 20 fois (graines différentes). Code de sortie 1 si un défaut est trouvé. */
const { openGame } = require('./common');
const TRACE = process.env.TRACE || '', [TR0, TR1] = (process.env.T || '0,12').split(',').map(Number);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 480, h: 270, settings: { quality: 'low', difficulty: 1, map: process.env.MAP || 'sable' }, noHdri: true });
  const out = await page.evaluate(([detail, N, TR, TR0, TR1, SET, SEED, REP, ANOM]) => {
    let sd = +SEED; Math.random = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296); // graine fixe : les cas se rejouent à l'identique
    LOCK.fallback = true; startMatch({});
    MATCH.state = 'playing';
    if (SET) Object.assign(RAG, JSON.parse(SET));
    const bot = entities.find((e) => !e.isPlayer), dt = 1 / 60;
    // ---- une mort, suivie pendant `secs` secondes ----
    const run = (s) => {
      const FLAT = [400, 400];
      const at = s.at || FLAT;
      bot.pos.set(at[0], s.y || 0, at[1]); bot.yaw = s.yaw || 0; bot.alive = true; bot.model.rag = null; bot.model.sink = 0; bot.respawnT = 1e9; bot.onGround = !(s.y > 0.1 && !s.stand);
      const vel = s.vel || 0, yaw = bot.yaw;
      bot.vel.set(-Math.sin(yaw) * vel, 0, -Math.cos(yaw) * vel); bot.sprinting = vel > 4;
      for (let i = 0; i < 40; i++) { bot.pos.x += bot.vel.x * dt; bot.pos.z += bot.vel.z * dt; if (s.at) collideCircle(bot.pos, 0.34, 1.75); animSoldier(bot, dt); }
      bot.model.gun.visible = !!s.gun; // un bot tué lâche son arme (dropKilledWeapon) : elle ne suit pas le corps ; la killcam du joueur la garde
      bot.lastForce = { dir: new V3(...s.dir).normalize(), mag: s.mag, lift: s.lift, part: s.part || 'body', radial: !!s.radial };
      bot.alive = false;
      const p0 = bot.model.J[J_PEL].clone(); let last = p0.clone(), path = 0, vmax = 0, sleepT = -1, maxStretch = 0, stretchAt = '', maxPen = 0, atRest = null, drift = 0, nan = false, minY = 9;
      const trace = [], n = Math.round((s.secs || 12) * 60), R0 = () => bot.model.rag, hist = []; let anom = null, anomLeft = 0, penInfo = null;
      for (let i = 0; i < n; i++) {
        animSoldier(bot, dt); const t = (i + 1) * dt, J = bot.model.J, pel = J[J_PEL], R = R0();
        if (!isFinite(pel.x + pel.y + pel.z)) { nan = true; break; }
        const step = Math.hypot(pel.x - last.x, pel.z - last.z); path += step; vmax = Math.max(vmax, step / dt); last.copy(pel);
        for (let k = 0; k < 15; k++) {
          minY = Math.min(minY, J[k].y);
          // enfoncement dans les boîtes (pleines) : profondeur jusqu'à la face la plus proche, au-delà de la tolérance
          for (const c of queryBoxes(J[k].x - 1, J[k].z - 1, J[k].x + 1, J[k].z + 1)) {
            if (c.ray) continue; const r = RAG_RAD[k];
            const d = Math.min(J[k].x - (c.x0 - r), c.x1 + r - J[k].x, J[k].y - (c.y0 - r), c.y1 + r - J[k].y, J[k].z - (c.z0 - r), c.z1 + r - J[k].z);
            if (d > 0 && d > maxPen) { maxPen = d; penInfo = { t: +t.toFixed(3), k, box: [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((x) => +x.toFixed(2)).join(','), p: [J[k].x, J[k].y, J[k].z].map((x) => +x.toFixed(3)).join(',') }; }
          }
        }
        if (R) for (let k = 0; k < RAG_RIGID.length; k++) { const [a, b] = RAG_RIGID[k], st = Math.abs(J[a].distanceTo(J[b]) - R.rest[k]); if (st > maxStretch) { maxStretch = st; stretchAt = `${a}-${b}@${t.toFixed(2)}`; } }
        if (R && !anom && ANOM && !(i === 6 * 60)) {
          const snap = { t: +t.toFixed(3), step: +(step / dt).toFixed(1), p: R.p.slice(0, 15).map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')), v: R.v.slice(0, 15).map((v) => +v.length().toFixed(1)).join(' '), hit: Array.from(R.hit).join('') };
          hist.push(snap); if (hist.length > 8) hist.shift();
          if (t > 0.6 && Math.max(...R.v.slice(0, 15).map((v) => v.length())) > 5.5 && s.name !== "explosion") { anom = hist.slice(); anomLeft = 1; }
        } else if (anom && anomLeft-- > 0 && R) anom.push({ t: +t.toFixed(3), step: +(step / dt).toFixed(1), p: R.p.slice(0, 15).map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')), v: R.v.slice(0, 15).map((v) => +v.length().toFixed(1)).join(' '), hit: Array.from(R.hit).join('') });
        if (R && i === 6 * 60 && !R.sleep) anom = [{ t: +t.toFixed(3), nosleep: 1, v: R.v.map((v) => +v.length().toFixed(2)).join(' '), hit: Array.from(R.hit).join(''), still: R.still, p: R.p.map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')) }];
        if (R && R.sleep && sleepT < 0) { sleepT = t; atRest = pel.clone(); }
        if (TR && s.name.includes(TR) && i > TR0 * 60 && i < TR1 * 60 && R) trace.push([+t.toFixed(3), ...J.map((j) => [+j.x.toFixed(2), +j.y.toFixed(2), +j.z.toFixed(2)].join(',')).filter((_, q) => q < 3), 'v', R.v.slice(0, 15).map((v) => +v.length().toFixed(2)).join(' '), 'gun', R.n > 15 ? [R.p[15], R.p[16], R.v[15], R.v[16]].map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')).join(' ') : '', 'hit', Array.from(R.hit).join(''), 'still', +R.still.toFixed(2), 'sleep', R.sleep]);
        if (detail && (i + 1) % 30 === 0) trace.push([+t.toFixed(1), +(pel.x - p0.x).toFixed(2), +pel.y.toFixed(2), +(pel.z - p0.z).toFixed(2), +(step / dt).toFixed(2)]);
      }
      const pe = bot.model.J[J_PEL];
      if (atRest) drift = Math.hypot(pe.x - atRest.x, pe.z - atRest.z) + Math.abs(pe.y - atRest.y);
      return { name: s.name, aller: +Math.hypot(pe.x - p0.x, pe.z - p0.z).toFixed(2), chemin: +path.toFixed(2), vmax: +vmax.toFixed(1), sommeil: +sleepT.toFixed(2), derive: +drift.toFixed(4), enfonce: +maxPen.toFixed(3), basY: +minY.toFixed(2), etire: +maxStretch.toFixed(3), etireOu: stretchAt, spec: s.dump ? JSON.stringify({ at: s.at, yaw: s.yaw, dir: s.dir, mag: s.mag, lift: s.lift, part: s.part, radial: s.radial, vel: s.vel }) : undefined, nan, finY: +pe.y.toFixed(2), trace, anom, penInfo };
    };
    const W = (name, o) => Object.assign({ name, dir: [0, 0, 1], mag: 5.4, lift: 3, secs: 12 }, o);
    const flat = [
      W('fusil face', {}), W('fusil dos', { dir: [0, 0, -1] }), W('fusil côté', { dir: [1, 0, 0] }), W('fusil tête', { part: 'head', mag: 6.2 }), W('fusil jambes', { part: 'legs' }),
      W('pistolet-mitrailleur', { mag: 3, lift: 1.2 }), W('pompe', { mag: 8.2, lift: 4.4 }), W('sniper', { mag: 7.4, lift: 4.2 }), W('couteau', { mag: 6, lift: 1.4 }),
      W('avec arme (killcam) fusil', { gun: 1 }), W('avec arme (killcam) pompe', { gun: 1, mag: 8.2, lift: 4.4 }), W('avec arme (killcam) course dos', { gun: 1, dir: [0, 0, -1], vel: 5.5 }),
      W('explosion', { mag: 14, lift: 12, radial: true }), W('explosion proche', { mag: 17, lift: 16, radial: true }), W('course face', { vel: 5.5 }), W('course dos', { dir: [0, 0, -1], vel: 5.5 }), W('sans force', { mag: 2.5, lift: 0.6 }),
    ].map((sp) => {
      const rs = []; for (let k = 0; k < REP; k++) { sd = (+SEED + 101 * k) >>> 0; rs.push(run(sp)); }
      const worst = (f) => rs.reduce((a, b) => (f(b) > f(a) ? b : a));
      const w = worst((r) => r.vmax / 10 + r.etire + Math.max(0, r.sommeil - 3)), m = rs.reduce((t, r) => t + r.aller, 0) / rs.length;
      return Object.assign({}, w, { aller: +m.toFixed(2), reps: rs.length, vmaxMax: Math.max(...rs.map((r) => r.vmax)), sommeilMax: Math.max(...rs.map((r) => r.sommeil)), etireMax: Math.max(...rs.map((r) => r.etire)) });
    });
    // ---- géométrie de la carte ----
    const geo = [];
    const boxes = COL.filter((c) => !c.ray);
    // mur : une face verticale haute et longue, dégagée devant ; le soldat se tient à 0,7 m, tourné vers le large, tiré vers le mur
    const faceCand = [];
    for (const c of boxes) {
      if (c.y1 < 2.5 || c.y0 > 0.1 || c.x1 - c.x0 < 3) continue;
      for (const sgn of [-1, 1]) {
        const z = sgn < 0 ? c.z0 - 0.7 : c.z1 + 0.7, x = (c.x0 + c.x1) / 2; let ok = true;
        for (const o of queryBoxes(x - 1.2, z - 1.2, x + 1.2, z + 1.2)) if (!o.ray && o !== c && o.y1 > 0.1) ok = false;
        if (ok) faceCand.push([x, z, sgn]);
      }
    }
    for (const [x, z, sgn] of faceCand.slice(0, 3)) {
      geo.push(run(W(`vers un mur (fusil) ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z], dir: [0, 0, -sgn] })));
      geo.push(run(W(`vers un mur (pompe) ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z], dir: [0, 0, -sgn], mag: 8.2, lift: 4.4 })));
      geo.push(run(W(`explosion contre un mur ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z], dir: [0, 0, -sgn], mag: 17, lift: 16, radial: true })));
      geo.push(run(W(`course contre un mur ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z + sgn * 4], dir: [0, 0, -sgn], vel: 6, yaw: sgn < 0 ? Math.PI : 0 })));
    }
    // dessus de caisse : un grand plateau bas (0,3 à 1,6 m), le soldat debout au milieu
    const tops = boxes.filter((c) => c.y1 > 0.3 && c.y1 < 1.6 && c.x1 - c.x0 > 2 && c.z1 - c.z0 > 2).slice(0, 3);
    for (const c of tops) {
      const x = (c.x0 + c.x1) / 2, z = (c.z0 + c.z1) / 2, tag = `${x.toFixed(0)},${z.toFixed(0)} h${c.y1.toFixed(1)}`;
      geo.push(run(W(`sur un plateau, sans force ${tag}`, { at: [x, z], y: c.y1, stand: 1, mag: 2.5, lift: 0.6 })));
      geo.push(run(W(`sur un plateau, fusil ${tag}`, { at: [x, z], y: c.y1, stand: 1 })));
    }
    // rampes : milieu de la rampe, sans force puis avec un tir dans la pente
    for (const rp of RAMPS.slice(0, 2)) {
      const x = (rp.x0 + rp.x1) / 2, z = (rp.z0 + rp.z1) / 2, h = rampHeight(rp, x, z), tag = `${x.toFixed(0)},${z.toFixed(0)}`;
      geo.push(run(W(`sur une rampe, sans force ${tag}`, { at: [x, z], y: h, stand: 1, mag: 2.5, lift: 0.6 })));
      geo.push(run(W(`sur une rampe, fusil ${tag}`, { at: [x, z], y: h, stand: 1, dir: [0, 0, 1] })));
      geo.push(run(W(`sur une rampe, fusil en travers ${tag}`, { at: [x, z], y: h, stand: 1, dir: [1, 0, 0] })));
    }
    geo.push(run(W('chute de 4 m (tué en l\'air)', { y: 4, stand: 1, mag: 2.5, lift: 0.6 })));
    // ---- tirage aléatoire sur la carte ----
    const WP = [[3, 1.2], [3.5, 1.4], [4.8, 2.4], [5.4, 3], [7.4, 4.2], [8.2, 4.4], [6, 1.4]], rnd = [];
    let seed = 12345; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const clearAt = (x, z) => { for (const c of queryBoxes(x - 0.45, z - 0.45, x + 0.45, z + 0.45)) if (!c.ray && c.y1 > 0.5 && c.y0 < 1.8) return false; return true; };
    for (let k = 0; k < N; k++) {
      let x, z, tries = 0; do { x = MAP.x0 + 2 + R() * (MAP.x1 - MAP.x0 - 4); z = MAP.z0 + 2 + R() * (MAP.z1 - MAP.z0 - 4); } while (!clearAt(x, z) && ++tries < 50);
      if (tries >= 50) continue;
      const w = WP[Math.floor(R() * WP.length)], a = R() * 2 * Math.PI, part = ['body', 'body', 'body', 'head', 'legs'][Math.floor(R() * 5)], rad = R() < 0.08;
      const r = run({ dump: 1, name: `tirage ${k}`, at: [x, z], yaw: R() * 2 * Math.PI, dir: [Math.sin(a), 0, Math.cos(a)], mag: rad ? 8 + R() * 10 : w[0], lift: rad ? 6 + R() * 10 : w[1], part: rad ? 'body' : part, radial: rad, vel: R() < 0.4 ? R() * 6 : 0, secs: 12 });
      r.at = [+x.toFixed(1), +z.toFixed(1)]; r.radial = rad; rnd.push(r);
    }
    return { flat, geo, rnd };
  }, [!!process.env.DETAIL, +(process.env.N || 150), TRACE, TR0, TR1, process.env.RAGSET || '', process.env.SEED || '987', +(process.env.REP || 1), !!process.env.ANOM]);
  const fmt = (r) => { const { trace, name, at, radial, spec, anom, penInfo, ...m } = r; return `${name.padEnd(40)} ${JSON.stringify(m)}`; };
  console.log('--- terrain plat'); for (const r of out.flat) { console.log(fmt(r)); if (r.anom) for (const a of r.anom) console.log('   ANOM', JSON.stringify(a)); if (r.trace && r.trace.length) console.log('  ' + r.trace.map((t) => t.join(' ')).join('\n  ')); }
  console.log('--- géométrie de la carte'); for (const r of out.geo) { console.log(fmt(r)); if (TRACE && r.name.includes(TRACE) && r.trace.length) console.log('  ' + r.trace.map((t) => t.join(' ')).join('\n  ')); }
  // ---- défauts ----
  const bad = [], warn = [];
  const chk = (r, ctx) => {
    if (r.nan) bad.push(`${ctx} ${r.name} : valeurs non finies`);
    if (r.sommeil < 0 || r.sommeil > 6) bad.push(`${ctx} ${r.name} : ne s'endort pas (${r.sommeil}) ${r.spec || ''}`);
    if (r.derive > 0.002) bad.push(`${ctx} ${r.name} : bouge après le sommeil (${r.derive})`);
    if (r.enfonce > 0.06 && r.penInfo && r.penInfo.t > 0.05) bad.push(`${ctx} ${r.name} : enfoncé de ${r.enfonce} m dans une boîte ${JSON.stringify(r.penInfo)} ${r.spec || ''}`);
    if (r.basY < -0.02) bad.push(`${ctx} ${r.name} : passe sous le sol (${r.basY})`);
    if (r.etire > 0.2) bad.push(`${ctx} ${r.name} : os étiré de ${(r.etire * 100).toFixed(0)} cm (${r.etireOu}) ${r.spec || ''}`);
    else if (r.etire > 0.08) warn.push(`${ctx} ${r.name} : os étiré de ${(r.etire * 100).toFixed(0)} cm (${r.etireOu})`);
  };
  for (const r of out.flat) chk(r, 'plat'); for (const r of out.geo) chk(r, 'carte');
  for (const r of out.rnd) { chk(r, 'tirage'); if (TRACE && r.name === TRACE && r.trace.length) console.log(r.name + '\n  ' + r.trace.map((t) => t.join(' ')).join('\n  ')); }
  const nonRad = out.rnd.filter((r) => !r.radial), st = (a, f) => { const v = a.map(f).sort((x, y) => x - y); return v.length ? `moy ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)} med ${v[Math.floor(v.length / 2)].toFixed(2)} p95 ${v[Math.floor(v.length * 0.95)].toFixed(2)} max ${v[v.length - 1].toFixed(2)}` : '-'; };
  console.log(`--- ${out.rnd.length} tirages (dont ${out.rnd.length - nonRad.length} explosions)`);
  console.log('distance (hors explosion) :', st(nonRad, (r) => r.aller)); console.log('sommeil (s)               :', st(out.rnd, (r) => r.sommeil)); console.log('os étirés (m)             :', st(out.rnd, (r) => r.etire)); console.log('enfoncement boîtes (m)    :', st(out.rnd, (r) => r.enfonce));
  if (warn.length) console.log(`avertissements (${warn.length}) : os étirés de plus de 8 cm\n  ` + warn.slice(0, 10).join('\n  '));
  console.log(bad.length ? `DÉFAUTS (${bad.length}) :\n  ` + bad.slice(0, 40).join('\n  ') : 'aucun défaut');
  if (logs.length) console.log(logs.filter((l) => !l.includes('HDRI')).slice(0, 20).join('\n'));
  await browser.close();
  if (bad.length) process.exit(1);
})();
