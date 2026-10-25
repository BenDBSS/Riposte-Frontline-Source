/* Fluidité des rechargements en vue subjective : node recharge.js [--armes m4,usp,l96,m1014] [--cas norm,vide] [--images dossier] [--json fichier]
   (PAGE=autre version construite : comparaison avant/après)
   Joue chaque rechargement comme en partie (vmStartAction, durée de l'arme), à 120 images par seconde, et relève image par image la
   position et l'orientation de l'arme, des deux mains, des coudes et du chargeur tenu (espace de la caméra). Un à-coup est :
   - un saut : plus de 3,5 cm en une image (1/120 s, 4,2 m/s), ou une rotation de plus de 10° (1200°/s), plus vite qu'un geste rapide
     (mains, arme, chargeur ; un coude qui balance peut aller plus vite que la main) ;
   - une cassure : la vitesse change de plus de 0,9 m/s (ou de 70°/s) d'une image à la suivante, ce qu'aucun geste réel ne fait ;
   - un arrêt sec : une main lancée à plus de 0,6 m/s qui s'immobilise en moins de 3 images.
   Sortie : une ligne par arme et par cas (vitesse de pointe de chaque partie, nombre d'à-coups), puis le détail des à-coups (instant,
   partie, ampleur) ; avec --images, 16 images régulièrement espacées par arme et par cas (dossier/<arme>-<cas>/00.png à 15.png).
   Fusils à pompe à chargement par le tube : début, deux cartouches, fin. Vérifie aussi que les clés de chaque chorégraphie se
   suivent dans l'ordre du temps. Code d'erreur s'il reste un saut ou une clé dans le désordre.
   Les chocs du maniement (chargeur claqué, culasse qui part : VM_ANIM, 06cy-ressorts.js) lancent l'arme d'un coup : les cassures
   qu'ils donnent à ces instants sont voulues ; seuls les sauts restent des défauts. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ids = opt('armes', 'm4,mp5,usp,deagle,l96,svd,m1014,rem870').split(','), cases = opt('cas', 'norm,vide').split(','), imgDir = opt('images', ''), jsonOut = opt('json', '');
const FPS = 120;
(async () => {
  if (imgDir) fs.mkdirSync(imgDir, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 640, h: 360, page: process.env.PAGE, settings: { quality: imgDir ? 'medium' : 'low', dynres: false }, noMap: true, noHdri: true });
  await page.evaluate(() => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (typeof sky !== 'undefined') sky.visible = false;
    scene.background = new THREE.Color(0x8a939c);
    const S = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    const wp = (o, v) => o.getWorldPosition(v), wq = (o, q) => o.getWorldQuaternion(q);
    window.__rl = {
      // arme prête, pose d'attente posée ; programme : liste [action, durée, données]
      setup(id, empty) {
        const def = weaponDef(id, [], null);
        vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null; VM.farK = 0;
        camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); camera.fov = Settings.fov; camera.updateProjectionMatrix();
        vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0);
        S.empty = false; VM.breath = 0; VM.bobT = 0; VM.bobAmt = 0;
        for (let i = 0; i < 90; i++) updateViewmodel(1 / 60, S);
        VM.breath = 0;
        const prog = def.tube ? [['shellStart', 0.32, { empty }], ['shell', 0.46, { empty }], ['shell', 0.46, { empty }], ['shellEnd', 0.3, { empty }]]
          : [['reload', empty ? def.reloadEmpty : def.reload, { empty }]];
        if (!def.tube && empty) S.empty = def.fam === 'pistol';
        return prog;
      },
      start(a) { vmStartAction(a[0], a[1], Object.assign({}, a[2])); },
      // une image : mise à jour, puis relevé (positions dans l'espace de la caméra du viewmodel)
      step(dt) {
        VM.breath = 0; // la respiration n'est pas un à-coup
        updateViewmodel(dt, S); VM.root.updateMatrixWorld(true);
        const m = VM.cur, out = {}, v = new V3(), q = new THREE.Quaternion();
        const put = (k, o) => { wp(o, v); wq(o, q); out[k] = [v.x, v.y, v.z, q.x, q.y, q.z, q.w]; };
        put('arme', VM.holder); put('mainG', VM.arms.L.hand); put('mainD', VM.arms.R.hand);
        for (const [k, arm] of [['coudeG', VM.arms.L], ['coudeD', VM.arms.R]]) if (arm.elbowAt) { v.copy(arm.elbowAt).applyMatrix4(VM.holder.matrixWorld); out[k] = [v.x, v.y, v.z, 0, 0, 0, 1]; }
        const held = m.spare && m.spare.visible ? m.spare : m.mag.visible && m.mag.parent ? m.mag : null;
        if (held) put('chargeur', held);
        out.act = VM.action || '';
        return out;
      },
    };
  });
  // clés de chaque chorégraphie dans l'ordre du temps (une clé plus ancienne après une plus récente fait sauter l'interpolation)
  const order = await page.evaluate(() => {
    const bad = [], seen = new Set();
    const walk = (T, name) => {
      if (!T || typeof T !== 'object' || seen.has(T)) return; seen.add(T);
      for (const k of ['gun', 'lh', 'rh', 'bolt']) if (Array.isArray(T[k])) for (let i = 1; i < T[k].length; i++) if (T[k][i][0] <= T[k][i - 1][0]) bad.push(`${name}.${k} : ${T[k][i - 1][0]} puis ${T[k][i][0]}`);
      for (const [n, v] of Object.entries(T)) if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, name + '.' + n);
    };
    walk(RELOAD, 'RELOAD'); walk({ INSPECT_LONG, INSPECT_PISTOL }, 'inspection');
    return bad;
  });
  if (order.length) console.log('CLÉS DANS LE DÉSORDRE :\n  ' + order.join('\n  '));
  const report = [];
  for (const id of ids) for (const cas of cases) {
    const prog = await page.evaluate(([id, e]) => __rl.setup(id, e), [id, cas === 'vide']);
    const frames = [];
    for (const a of prog) {
      await page.evaluate((a) => __rl.start(a), a);
      const n = Math.round(a[1] * FPS);
      const chunk = await page.evaluate(([n, dt]) => { const r = []; for (let i = 0; i < n; i++) r.push(__rl.step(dt)); return r; }, [n, 1 / FPS]);
      frames.push(...chunk);
    }
    frames.push(...await page.evaluate(([n, dt]) => { const r = []; for (let i = 0; i < n; i++) r.push(__rl.step(dt)); return r; }, [Math.round(0.35 * FPS), 1 / FPS]));
    // analyse
    const parts = ['arme', 'mainG', 'mainD', 'coudeG', 'coudeD', 'chargeur'], ev = [], peak = {};
    const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6])));
    for (const p of parts) {
      let vPrev = null, wPrev = null; peak[p] = 0;
      for (let i = 1; i < frames.length; i++) {
        const A = frames[i - 1][p], B = frames[i][p];
        if (!A || !B) { vPrev = wPrev = null; continue; }
        const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), w = ang(A, B), t = +(i / FPS).toFixed(3);
        const vel = [(B[0] - A[0]) * FPS, (B[1] - A[1]) * FPS, (B[2] - A[2]) * FPS], sp = d * FPS;
        peak[p] = Math.max(peak[p], sp);
        // un chargeur qui change de main (pris dans la main, lâché) n'est pas suivi d'une image à l'autre
        if (p === 'chargeur' && d > 0.08) { vPrev = wPrev = null; continue; }
        if (d > 0.035 && p !== 'coudeG' && p !== 'coudeD') ev.push({ t, p, k: 'saut', v: +(d * 100).toFixed(1) + ' cm' });
        else if (p !== 'coudeG' && p !== 'coudeD' && p !== 'chargeur' && w > 0.175) ev.push({ t, p, k: 'saut', v: +(w * 57.3).toFixed(0) + '°' });
        if (vPrev) {
          const dv = Math.hypot(vel[0] - vPrev[0], vel[1] - vPrev[1], vel[2] - vPrev[2]);
          if (dv > 0.9) ev.push({ t, p, k: 'cassure', v: +dv.toFixed(2) + ' m/s' });
          if (p !== 'coudeG' && p !== 'coudeD' && p !== 'chargeur' && wPrev !== null && Math.abs(w - wPrev) * FPS > 1.22) ev.push({ t, p, k: 'cassure', v: +((Math.abs(w - wPrev) * FPS) * 57.3).toFixed(0) + '°/s' });
        }
        if ((p === 'mainG' || p === 'mainD') && vPrev && Math.hypot(...vPrev) > 0.6) {
          const C = frames[i + 2] && frames[i + 2][p];
          if (C && Math.hypot(C[0] - B[0], C[1] - B[1], C[2] - B[2]) * FPS / 2 < 0.05) ev.push({ t, p, k: 'arrêt sec', v: +Math.hypot(...vPrev).toFixed(2) + ' m/s' });
        }
        vPrev = vel; wPrev = w;
      }
    }
    // à-coups voisins regroupés : un par partie et par tranche de 30 ms
    const merged = []; for (const e of ev.sort((a, b) => a.t - b.t)) { const l = merged.find((x) => x.p === e.p && x.k === e.k && e.t - x.t1 < 0.03); if (l) { l.t1 = e.t; l.n++; } else merged.push(Object.assign({ t1: e.t, n: 1 }, e)); }
    report.push({ id, cas, dur: +(frames.length / FPS).toFixed(2), peak: Object.fromEntries(Object.entries(peak).map(([k, v]) => [k, +v.toFixed(2)])), coups: merged });
    if (imgDir) {
      // planche : 16 instants régulièrement espacés, rejoués depuis le début
      const N = 16, tot = frames.length, dir = path.join(imgDir, `${id}-${cas}`);
      fs.mkdirSync(dir, { recursive: true });
      const prog2 = await page.evaluate(([id, e]) => __rl.setup(id, e), [id, cas === 'vide']);
      let f = 0, next = 0, k = 0;
      for (const a of prog2) {
        await page.evaluate((a) => __rl.start(a), a);
        const n = Math.round(a[1] * FPS);
        for (let i = 0; i < n; i++, f++) {
          await page.evaluate((dt) => __rl.step(dt), 1 / FPS);
          if (f >= next && k < N) { await page.waitForTimeout(60); await page.screenshot({ path: path.join(dir, String(k).padStart(2, '0') + '.png') }); k++; next = Math.round((k * tot) / N); }
        }
      }
    }
  }
  for (const r of report) {
    console.log(`${r.id} ${r.cas} (${r.dur} s) : pointes ${Object.entries(r.peak).map(([k, v]) => k + ' ' + v).join(', ')} m/s ; ${r.coups.length} à-coup(s)`);
    for (const c of r.coups) console.log(`   ${c.t.toFixed(3)}${c.n > 1 ? '-' + c.t1.toFixed(3) : ''} s  ${c.p}  ${c.k}  ${c.v}`);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  const bad = logs.filter((l) => !l.includes('HDRI'));
  if (bad.length) console.log(bad.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(order.length || report.some((r) => r.coups.some((c) => c.k === 'saut')) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
