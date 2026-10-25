/* Saccades : ce que le joueur ressent quand la caméra bouge et que la médiane des images par seconde ne montre pas (une image lente isolée de
   temps en temps). Joue la vraie boucle frame() (bots en partie, joueur protégé qui avance, caméra qui balaie à droite puis à gauche), chronomètre
   chaque étape de la boucle, relève les pauses du ramasse-miettes (traces V8) et les octets alloués, puis donne : la répartition des temps d'image
   (médiane, 99e centile, pire), les étapes les plus coûteuses et celles qui font les pics, les pauses du ramasse-miettes, et les images lentes
   avec l'étape en cause.
   Le rendu logiciel (SwiftShader) prend des secondes par image : on le supprime. Le jeu fait tout son travail de processeur (calculs, parcours de
   la scène, états et uniformes de three.js, appels WebGL), seuls les ordres de dessin (drawArrays, drawElements, leurs variantes) sont ignorés une
   fois la partie lancée : ce qui est mesuré est le temps du fil principal, indépendant de la carte graphique, à ces ordres de dessin près (un
   millier d'appels coûtent de 1 à 2 ms de plus sur une vraie machine). Les images sont jouées une à une à FPS images par seconde simulées
   (dt de 1/FPS : les mêmes calculs, le même nombre d'allocations par image qu'à cette cadence).
   node saccades.js [images=2000]   MAP=simoun (défaut) ; MODE=tdm (défaut), ffa ou dom ; FPS=280 ; Q=high ; TURN=3 (pixels de souris par image, 0 : caméra fixe) ; RUN=0 (joueur
   immobile) ; PAGE=autre/version.html ; TOP=8 ; ALLOC=25 (octets alloués par fonction, les 25 premières) ; OLD=1 (avec ALLOC : seulement les objets qui survivent à un petit ramasse-miettes, ceux qui finissent dans la vieille génération et déclenchent les grandes pauses) ; STEPS=3 (étapes citées par image lente) ; EXTRA=f,g (fonctions chronométrées en plus) ; PROF=25 (temps propre par fonction ; à ne pas combiner avec ALLOC, qui ralentit tout) ; W=128 H=72 (taille de la fenêtre : petite,
   pour que les ordres non supprimés, les effacements de cibles de rendu par exemple, ne coûtent rien) ; JSON=1 (écrit saccades-<carte>.json). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const N = +(process.argv[2] || 2000), MAP = process.env.MAP || 'simoun', TOP = +(process.env.TOP || 8), FPS = +(process.env.FPS || 280);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: +(process.env.W || 128), h: +(process.env.H || 72), noHdri: true,
    init: `window.__DRAWS = 0; window.__noDraw = false; (() => { for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) { const o = WebGL2RenderingContext.prototype[k]; WebGL2RenderingContext.prototype[k] = function () { if (window.__noDraw) { window.__DRAWS++; return; } return o.apply(this, arguments); }; } })();`,
    settings: { quality: process.env.Q || 'high', dynres: false, difficulty: 1, map: MAP, mode: process.env.MODE || 'tdm', lang: 'fr' } });
  const cdp = await page.context().newCDPSession(page);
  const evts = []; cdp.on('Tracing.dataCollected', (d) => evts.push(...d.value));
  await page.evaluate(() => { LOCK.fallback = true; startMatch({}); PL.ent.protT = 1e9; });
  await page.waitForFunction(() => MATCH.state === 'playing' && frameN > 3, null, { timeout: 600000, polling: 500 });
  // à partir d'ici : plus d'ordres de dessin, plus de boucle d'images du navigateur (les images sont jouées une à une par ce script)
  await page.evaluate(([FPS, TURN, RUN, COUNT, EXTRA]) => {
    window.__noDraw = true;
    const rafReal = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; window.__rafReal = rafReal;
    const R = { frames: [], cur: null };
    window.__R = R;
    const wrap = (name) => { const f = window[name]; if (typeof f !== 'function' || f.__w) return; const g = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { if (R.cur) R.cur[name] = (R.cur[name] || 0) + performance.now() - t; } }; g.__w = 1; window[name] = g; };
    for (const n of ['padTick', 'musicTick', 'sfxTick', 'modeUpdate', 'updatePlayer', 'updateBot', 'updateNades', 'updateDrops', 'updateProps', 'updateKillstreak', 'updateAircraft',
      'drawTacMap', 'updateHud', 'netUpdate', 'kcRecord', 'mapUpdate', 'updatePostFx', 'updateFx', 'updateFlashLights', 'updateListener', 'allyMarksUpdate', 'updateSoldierLods',
      'clothUpdate', 'updateMapDetail', 'grassUpdate', 'updateShadows', 'gpuFrame', 'updateDynRes', 'markPrepass', 'touchTick', 'findPath', 'animSoldier', 'botSense', 'decideTactic', 'botsTick', 'renderFrame', ...(EXTRA ? EXTRA.split(',') : [])]) wrap(n);
    const r0 = composer.render.bind(composer); composer.render = function (dt) { const t = performance.now(); r0(dt); if (R.cur) R.cur.render = (R.cur.render || 0) + performance.now() - t; };
    // cascades d'ombres redessinées à cette image : needsUpdate est remis à faux par three.js au rendu, on le relève juste après updateShadows
    const us = window.updateShadows; window.updateShadows = function () { us(); if (R.cur) R.cur.cascades = csm ? csm.lights.filter((l) => l.shadow.needsUpdate).length : 0; };
    // éclairs de tir : image où un éclair démarre, image où le dernier s'éteint (le nombre de lumières déclarées au shader change : tous les matériaux éclairés sont réévalués)
    const fl = window.flashLight; window.flashLight = function () { if (R.cur) R.cur.flash = 1; return fl.apply(this, arguments); };
    let anyOn = false; const ul = window.updateFlashLights; window.updateFlashLights = function (dt) { ul(dt); const on = flashLights.some((f) => f.light.visible); if (R.cur && on !== anyOn) R.cur.flashEdge = 1; anyOn = on; };
    // chaque appel de renderer.render : la scène (ou la scène de l'arme, ou un quadrilatère plein écran de post-traitement), son temps et ses appels de dessin
    const rr = renderer.render.bind(renderer); let nq = 0;
    renderer.render = function (sc, cam) {
      const t = performance.now(), c0 = renderer.info.render.calls; rr(sc, cam);
      if (R.cur) { const kd = sc === scene ? 'passe:scène' : sc === vmScene ? 'passe:arme' : 'passe:plein écran'; R.cur[kd] = (R.cur[kd] || 0) + performance.now() - t; R.cur[kd + ' (appels)'] = (R.cur[kd + ' (appels)'] || 0) + renderer.info.render.calls - c0; R.cur['passes'] = (R.cur['passes'] || 0) + 1; }
    };
    // compteurs d'opérations de three.js, par image (COUNT=1) : ils ne dépendent pas du bruit de la machine, contrairement aux temps
    window.__cnt = { mm: 0, um: 0, umw: 0, bones: 0 };
    if (COUNT) {
      const C = window.__cnt, M4 = THREE.Matrix4.prototype, O3 = THREE.Object3D.prototype, mm = M4.multiplyMatrices, um = O3.updateMatrix, umw = O3.updateMatrixWorld;
      M4.multiplyMatrices = function (a, b) { C.mm++; return mm.call(this, a, b); }; O3.updateMatrix = function () { C.um++; return um.call(this); };
      O3.updateMatrixWorld = function (f) { C.umw++; return umw.call(this, f); };
    }
    const fr = window.frame; let now = performance.now(), k = 0;
    window.__play = (n) => {
      for (let i = 0; i < n; i++) {
        const C0 = window.__cnt ? { ...window.__cnt } : null;
        now += 1000 / FPS; k++;
        if (TURN) mouseDX += TURN * (Math.sin(k / FPS / 1.5) > -0.2 ? 1 : -1); // la caméra balaie à droite puis à gauche
        if (RUN) KEYS.KeyW = true;
        R.cur = {}; const P0 = renderer.info.programs ? renderer.info.programs.length : 0, t0 = performance.now();
        try { fr(now); } finally { R.cur.total = performance.now() - t0; R.cur.newProg = (renderer.info.programs ? renderer.info.programs.length : 0) - P0; R.cur.calls = renderer.info.render.calls; if (C0) { R.cur.mm = window.__cnt.mm - C0.mm; R.cur.um = window.__cnt.um - C0.um; R.cur.umw = window.__cnt.umw - C0.umw; } R.frames.push(R.cur); R.cur = null; }
      }
      return R.frames.length;
    };
  }, [FPS, +(process.env.TURN === undefined ? 3 : process.env.TURN), process.env.RUN !== '0', !!process.env.COUNT, process.env.EXTRA || '']);
  // échauffement (compilations tardives, premiers ramasse-miettes), sans trace
  await page.evaluate(() => window.__play(200)); await page.evaluate(() => { window.__R.frames.length = 0; });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.gc', transferMode: 'ReportEvents' });
  if (process.env.ALLOC) await cdp.send('HeapProfiler.enable'), await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: !process.env.OLD });
  if (process.env.PROF) await cdp.send('Profiler.enable'), await cdp.send('Profiler.setSamplingInterval', { interval: 200 }), await cdp.send('Profiler.start');
  const t0 = Date.now();
  for (let done = 0; done < N; done += 250) await page.evaluate((n) => window.__play(n), Math.min(250, N - done));
  const wall = (Date.now() - t0) / 1000;
  let cpu = null; if (process.env.PROF) cpu = (await cdp.send('Profiler.stop')).profile;
  let prof = null; if (process.env.ALLOC) prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
  await new Promise((res) => { cdp.once('Tracing.tracingComplete', res); cdp.send('Tracing.end'); });
  const R = await page.evaluate(() => window.__R.frames), info = await page.evaluate(() => ({ hf: typeof HF === 'undefined' ? '-' : HF.k, finite: entities.every((e) => Number.isFinite(e.pos.x + e.pos.y + e.pos.z)), kills: entities.reduce((a, e) => a + e.kills, 0), deaths: entities.reduce((a, e) => a + e.deaths, 0), map: CURMAP.id, q: RQ.q.label, scale: RQ.scale, ents: entities.length, draws: window.__DRAWS, bodies: PHYS.bodies.length }));
  const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const tot = R.map((f) => f.total), f1 = (v) => v.toFixed(2), f0 = (v) => v.toFixed(0);
  const budget = 1000 / FPS;
  console.log(`cadence haute HF.k = ${info.hf} · positions finies : ${info.finite} · éliminations ${info.kills}, morts ${info.deaths}`);
  console.log(`${info.map} : ${R.length} images jouées à ${FPS} i/s simulées (${f0(wall)} s réelles), ${info.q}, ${info.ents} soldats, ${f0(info.draws / R.length)} ordres de dessin ignorés par image, ${info.bodies} props`);
  console.log(`temps du fil principal par image (ms) : médiane ${f1(pct(tot, 0.5))} · 95e ${f1(pct(tot, 0.95))} · 99e ${f1(pct(tot, 0.99))} · 99,9e ${f1(pct(tot, 0.999))} · pire ${f1(Math.max(...tot))}   (budget à ${FPS} i/s : ${f1(budget)} ms)`);
  const over = tot.filter((t) => t > budget * 1.5).length;
  console.log(`images au-delà de 1,5 fois le budget : ${over} (${(100 * over / tot.length).toFixed(1)} %)`);
  const cl = R.map((f) => f.calls), cs = R.map((f) => f.cascades || 0);
  console.log(`appels de rendu par image : médiane ${f0(pct(cl, 0.5))} (de ${f0(Math.min(...cl))} à ${f0(Math.max(...cl))}) · cascades d'ombres redessinées par image : ${f1(cs.reduce((a, b) => a + b, 0) / cs.length)} en moyenne`);
  { const edge = R.filter((f) => f.flashEdge), calm = R.filter((f) => !f.flashEdge), mean = (a, k) => a.reduce((s, f) => s + (f[k] || 0), 0) / Math.max(1, a.length);
    console.log(`images où l'état des lumières d'éclair change : ${edge.length} sur ${R.length} · temps moyen de render ${f1(mean(edge, 'render'))} ms contre ${f1(mean(calm, 'render'))} ms les autres (pire ${f1(Math.max(0, ...edge.map((f) => f.render || 0)))} ms)`); }
  { const pr = R.map((f) => f.passes || 0), mean = (k) => R.reduce((s, f) => s + (f[k] || 0), 0) / R.length;
    console.log(`rendus par image : ${f1(pr.reduce((a, b) => a + b, 0) / R.length)} · scène ${f1(mean('passe:scène'))} ms pour ${f0(mean('passe:scène (appels)'))} appels (ombres comprises) · arme ${f1(mean('passe:arme'))} ms pour ${f0(mean('passe:arme (appels)'))} appels · plein écran ${f1(mean('passe:plein écran'))} ms pour ${f0(mean('passe:plein écran (appels)'))} appels`); }
  if (process.env.COUNT) { const m = (k) => R.reduce((s, f) => s + (f[k] || 0), 0) / R.length; console.log(`opérations de three.js par image : ${f0(m('mm'))} multiplications de matrices · ${f0(m('um'))} updateMatrix · ${f0(m('umw'))} updateMatrixWorld (tous objets)`); }
  const names = new Set(); for (const f of R) for (const k of Object.keys(f)) if (!['total', 'calls', 'cascades', 'flash', 'flashEdge', 'passes', 'mm', 'um', 'umw', 'newProg'].includes(k) && !/\(appels\)/.test(k)) names.add(k);
  const rows = [...names].map((k) => { const v = R.map((f) => f[k] || 0); return { k, moy: v.reduce((a, b) => a + b, 0) / v.length, p99: pct(v, 0.99), max: Math.max(...v) }; }).sort((a, b) => b.moy - a.moy);
  console.log('étape                       moyenne   99e centile   pire   (ms)');
  for (const r of rows.slice(0, 14)) console.log(`  ${r.k.padEnd(22)} ${f1(r.moy).padStart(8)}  ${f1(r.p99).padStart(10)}  ${f1(r.max).padStart(7)}`);
  // ramasse-miettes (traces V8) : durée et octets alloués entre deux passages
  const gcs = evts.filter((e) => /^(MinorGC|MajorGC)$/.test(e.name) && e.ph === 'X').sort((a, b) => a.ts - b.ts);
  const minor = gcs.filter((g) => g.name === 'MinorGC'), major = gcs.filter((g) => g.name === 'MajorGC');
  let bytes = 0, prev = null; for (const g of gcs) { const a = g.args || {}, before = a.usedHeapSizeBefore, after = a.usedHeapSizeAfter; if (prev !== null && before !== undefined) bytes += Math.max(0, before - prev); if (after !== undefined) prev = after; }
  if (process.env.GCDETAIL) { for (const g of major) console.log('  grand ramasse-miettes', JSON.stringify({ ms: +(g.dur / 1000).toFixed(1), args: g.args })); const kinds = new Map(); for (const e of evts) if (/GC/i.test(e.name) && e.ph === 'X') kinds.set(e.name, (kinds.get(e.name) || 0) + 1); console.log('  évènements GC :', JSON.stringify([...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12))); }
  const sum = (a) => a.reduce((s, g) => s + g.dur / 1000, 0), mx = (a) => Math.max(0, ...a.map((g) => g.dur / 1000));
  console.log(`ramasse-miettes : ${minor.length} petits (${f1(sum(minor))} ms au total, le plus long ${f1(mx(minor))} ms) · ${major.length} grands (${f1(sum(major))} ms, le plus long ${f1(mx(major))} ms)`);
  console.log(`alloué : environ ${(bytes / R.length / 1024).toFixed(1)} Ko par image (${(bytes / R.length * FPS / 1048576).toFixed(0)} Mo par seconde à ${FPS} i/s), un petit ramasse-miettes toutes les ${(R.length / Math.max(1, minor.length)).toFixed(0)} images`);
  if (prof) { // octets alloués par fonction (échantillonnage du tas), les plus gros d'abord
    // par pile d'appels (la fonction et ses trois appelants) : une fonction native qui alloue, comme join ou hypot, est rapportée à celle qui l'appelle
    const by = new Map(); let all = 0; const nm = (n) => (n.callFrame.functionName || '(anonyme)') + ':' + n.callFrame.lineNumber;
    const walk = (n, st) => { const stack = [n, ...st].slice(0, 4); const k = stack.map(nm).join(' <- '); by.set(k, (by.get(k) || 0) + n.selfSize); all += n.selfSize; for (const c of n.children) walk(c, [n, ...st]); };
    walk(prof.head, []);
    console.log(`allocations par pile d'appels (${(all / R.length / 1024).toFixed(0)} Ko par image échantillonnés) :`);
    for (const [k, v] of [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.ALLOC)) console.log(`  ${(v / R.length / 1024).toFixed(1).padStart(7)} Ko/image  ${k}`);
  }
  if (cpu) { // temps processeur propre à chaque fonction (profileur à échantillonnage), par image
    const self = new Map(), byId = new Map(cpu.nodes.map((n) => [n.id, n])); let tot2 = 0;
    for (let i = 0; i < cpu.samples.length; i++) { const n = byId.get(cpu.samples[i]), dt = (cpu.timeDeltas[i] || 0) / 1000, f = n.callFrame, k = (f.functionName || '(anonyme)') + ' ' + path.basename(f.url || '') + ':' + f.lineNumber; self.set(k, (self.get(k) || 0) + dt); tot2 += dt; }
    console.log(`temps propre par fonction (ms par image, ${(tot2 / R.length).toFixed(2)} ms échantillonnés) :`);
    for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.PROF)) console.log(`  ${(v / R.length).toFixed(3).padStart(8)} ms/image  ${k}`);
    // temps cumulé (la fonction et tout ce qu'elle appelle), une fois par pile même si la fonction se rappelle elle-même
    const par = new Map(); for (const n of cpu.nodes) for (const c of n.children || []) par.set(c, n.id);
    const incl = new Map(), key = (n) => (n.callFrame.functionName || '(anonyme)') + ' ' + path.basename(n.callFrame.url || '') + ':' + n.callFrame.lineNumber;
    for (let i = 0; i < cpu.samples.length; i++) { const dt = (cpu.timeDeltas[i] || 0) / 1000, seen = new Set(); for (let id = cpu.samples[i]; id !== undefined; id = par.get(id)) { const k = key(byId.get(id)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } } }
    console.log('temps cumulé par fonction (ms par image) :');
    for (const [k, v] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.PROF + 8)) console.log(`  ${(v / R.length).toFixed(3).padStart(8)} ms/image  ${k}`);
  }
  const comp = R.map((f, i) => ({ f, i })).filter((x) => x.f.newProg > 0);
  console.log(`images qui compilent un programme de shader : ${comp.length} (${comp.reduce((a, x) => a + x.f.newProg, 0)} programmes)${comp.length ? ' aux images ' + comp.slice(0, 12).map((x) => x.i + ' (' + f1(x.f.total) + ' ms)').join(', ') : ''}`);
  // images lentes : plus de trois fois la médiane et au moins 1 ms de plus
  const med = pct(tot, 0.5), slow = R.map((f, i) => ({ f, i })).filter((x) => x.f.total > Math.max(med * 3, med + 1)).sort((a, b) => b.f.total - a.f.total);
  console.log(`images lentes (plus de 3 fois la médiane) : ${slow.length} sur ${R.length}`);
  for (const { f, i } of slow.slice(0, TOP)) {
    const main = Object.entries(f).filter(([k]) => !['total', 'calls', 'cascades', 'flash', 'flashEdge', 'passes', 'mm', 'um', 'umw', 'newProg'].includes(k) && !/\(appels\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, +(process.env.STEPS || 3)).map(([k, v]) => `${k} ${f1(v)}`).join(', ');
    console.log(`  image ${i}: ${f1(f.total)} ms (${main})${f.newProg ? ` · ${f.newProg} programme(s) de shader compilé(s)` : ''}`);
  }
  if (process.env.JSON) fs.writeFileSync(path.join(HERE, 'saccades-' + MAP + '.json'), JSON.stringify({ info, n: tot.length, med, p99: pct(tot, 0.99), max: Math.max(...tot), rows, gc: { minor: minor.length, major: major.length, bytes } }));
  if (logs.filter((l) => !/ERR_FILE/.test(l)).length) console.log(logs.filter((l) => !/ERR_FILE/.test(l)).slice(0, 5).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
