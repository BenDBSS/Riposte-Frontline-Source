/* Contrôle de la frappe aérienne : node tools/dev/visual/frappe.js [dossier de captures]
   1. Manette (Xbox simulée, navigator.getGamepads) : la carte de la frappe s'ouvre, les deux bâtons déplacent le point visé (leurs vecteurs s'ajoutent, limités à 1),
      la vitesse (précise à petite déflexion, 85 m/s à fond), A et RT confirment (pas pendant la première 0,2 s), B annule ; le point de la souris suit le curseur 1 pour 1.
   2. Au doigt (téléphone en paysage, deux tailles) : un toucher sur la carte lance la frappe là où le doigt se pose, levé hors de la carte rien ne part, Annuler annule,
      plus de bouton Confirmer, la consigne et Annuler ne recouvrent pas la carte.
   3. Létalité (carte Simoun, terrain dégagé, cibles immobiles à chaque anneau autour du point visé, dégâts comptés par le vrai moteur) : tout meurt jusqu'à 6 m, la plupart
      jusqu'à 10 m, un peu plus de la moitié à 11 m (la zone affichée a 11 m de rayon), plus rien à 13 m.
   4. Abri (carte Meltem, cibles immobiles au fond des maisons, frappe centrée sur chacune) : les bombes éclatent
      sur le toit et non dans la pièce, et presque tout le monde survit (une sur dix au plus meurt ; sans l'abri, le souffle passé par les portes et
      les fenêtres en tuait quatre sur dix).
   PARTIES=3 (ou 1, 2, 1,3...) : seulement ces parties. Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('ECHEC :', msg); } else console.log('ok    :', msg); };
const until = (page, cond, ms) => page.waitForFunction(cond, null, { timeout: ms || 90000, polling: 100 }).then(() => true, () => false);
const frames = (page, n) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function play(opts, init) {
  const g = await openGame(Object.assign({ settings: { quality: 'low', lang: 'fr', map: 'sable', touch: opts.mobile ? 'on' : 'auto' }, noHdri: true, init }, opts));
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('depGo').click());
  await page.waitForFunction("MATCH.state==='playing' && PL.ent.alive", null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const h = document.getElementById('tcHelp'); if (h) h.classList.add('hidden'); PL.ent.protT = 1e9; }); // les bots qui réapparaissent ne tuent pas le joueur pendant le contrôle
  return g;
}
/* appelle la frappe aérienne et attend la carte ouverte depuis plus de 0,3 s de jeu */
async function openMap(page) {
  await page.evaluate(() => { for (const e of entities) if (!e.isPlayer) e.alive = false; PL.ks.air = true; PL.ent.pos.set(0, PL.ent.pos.y, 0); useAirstrike(); });
  const opened = await until(page, 'KS.map.open', 60000);
  if (!opened) console.log('      état :', JSON.stringify(await page.evaluate(() => ({ alive: PL.ent.alive, mode: KS.mode, stage: KS.stage, air: PL.ks.air, sw: PL.switching, state: MATCH.state }))));
  await until(page, 'MATCH.time - KS.map.t0 > 0.3', 60000);
  return opened;
}

const only = (n) => !process.env.PARTIES || process.env.PARTIES.split(',').includes(String(n));
(async () => {
  let g, page;
  // --- 1. manette
  if (only(1)) {
  g = await play({ w: 800, h: 450 }, `
    window.__pad = { id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', index: 0, axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
    navigator.getGamepads = () => [window.__pad];
    window.__set = (axes, btns) => { const p = window.__pad; if (axes) p.axes = axes; for (const k in (btns||{})) { const v = btns[k]; p.buttons[k] = { pressed: v > 0.5, value: v }; } };`);
  page = g.page;
  const set = (axes, btns) => page.evaluate(([a, b]) => window.__set(a, b), [axes, btns]);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad })));
  await set(null, { 13: 1 }); await frames(page, 3); await set(null, { 13: 0 }); await frames(page, 3); // la manette a la main
  ok(await page.evaluate(() => PAD.drive), 'la manette a la main');
  // vitesse : fonction pure, une image de 10 ms
  const sp = await page.evaluate(() => {
    const mv = (axes) => { KS.map.x = 0; KS.map.z = 0; padMapMove({ axes }, 0.01); return [KS.map.x, KS.map.z]; };
    return { full: mv([1, 0, 0, 0]), right: mv([0, 0, 1, 0]), both: mv([1, 0, 1, 0]), up: mv([0, -1, 0, -1]), diag: mv([1, 1, 0, 0]), half: mv([0.5, 0, 0, 0]), quarter: mv([0.35, 0, 0, 0]), dead: mv([0.08, 0, 0.08, 0]), opposite: mv([1, 0, -1, 0]) };
  });
  const near = (a, b, e) => Math.abs(a - b) <= e;
  ok(near(sp.full[0], 0.85, 0.01) && near(sp.right[0], 0.85, 0.01), `bâton gauche et bâton droit à fond : 85 m/s (${sp.full[0].toFixed(2)} et ${sp.right[0].toFixed(2)} m en 10 ms)`);
  ok(near(sp.both[0], 0.85, 0.01) && near(sp.up[1], -0.85, 0.01), 'les deux bâtons dans le même sens : la somme est limitée à la pleine vitesse');
  ok(near(Math.hypot(...sp.diag), 0.85, 0.01), 'diagonale à fond : même vitesse que sur un axe');
  ok(sp.half[0] > 0.18 && sp.half[0] < 0.26 && sp.quarter[0] > 0.03 && sp.quarter[0] < 0.12, `précis à petite déflexion (${sp.quarter[0].toFixed(2)} m à 35 %, ${sp.half[0].toFixed(2)} m à 50 % en 10 ms)`);
  ok(sp.dead[0] === 0 && Math.abs(sp.opposite[0]) < 1e-9, 'zone morte respectée, deux bâtons opposés s\'annulent');
  // en jeu : la carte, les deux bâtons, A, RT, B
  ok(await openMap(page), 'carte de la frappe ouverte');
  // souris capturée : un pixel de souris, un pixel de carte
  const mouse = await page.evaluate(() => { const r = $('tacCanvas').getBoundingClientRect(); KS.map.x = 0; KS.map.z = 0; ksMapMouse(100, 0); return { m: KS.map.x, px: KS.map.x * r.height / (MAP.z1 - MAP.z0), canvas: r.height }; });
  ok(near(mouse.px, 100, 1), `souris : 100 pixels de souris font ${mouse.px.toFixed(1)} pixels de carte (${mouse.m.toFixed(1)} m)`);
  ok(await page.evaluate(() => /LS/.test($('tacKeys').textContent) && /RS/.test($('tacKeys').textContent) && $('tacKeys').querySelectorAll('kbd.key.pad.b0').length === 1 && $('tacKeys').querySelectorAll('kbd.key.pad.sh').length >= 3), 'légende : LS RS pour viser, A et RT pour confirmer');
  await page.evaluate(() => { KS.map.x = 0; KS.map.z = 0; });
  await set([1, 0, 0, 0], {});
  ok(await until(page, 'KS.map.x > 4', 60000), 'bâton gauche à droite : le point visé va à droite');
  await set([0, 0, 0, 1], {});
  const z0 = await page.evaluate(() => KS.map.z);
  ok(await until(page, `KS.map.z > ${z0} + 4`, 60000), 'bâton droit en bas : le point visé descend');
  await set([0, 0, 0, 0], {});
  if (out) await page.screenshot({ path: out + '/frappe-manette.png' });
  // A pressé en même temps que la carte s'ouvre : rien ne part (délai de 0,2 s) ; plus tard, A lance la frappe
  await page.evaluate(() => { window.__t0 = KS.map.t0; KS.map.t0 = MATCH.time; }); // comme si la carte venait de s'ouvrir
  await set(null, { 0: 1 }); await frames(page, 1); await set(null, { 0: 0 }); await frames(page, 2);
  ok(await page.evaluate(() => KS.map.open), 'A pressé dans les 0,2 s qui suivent l\'ouverture : rien ne part');
  await page.evaluate(() => { KS.map.t0 = window.__t0; });
  const tgt = await page.evaluate(() => [KS.map.x, KS.map.z]);
  await set(null, { 0: 1 }); await frames(page, 2); await set(null, { 0: 0 });
  ok(await until(page, '!KS.map.open && KS.stage === "confirm"', 30000), 'A : la frappe est confirmée');
  const strike = await page.evaluate(() => ({ events: MATCH.events.length, jets: KS.jets.length, ks: PL.ks.air }));
  ok(strike.jets === 2 && strike.events >= 16 && strike.ks === false, `les avions arrivent, ${strike.events} événements de bombes, série dépensée`);
  ok(await page.evaluate((t) => { const b = airPattern(new V3(Math.round(t[0] * 10) / 10, 0, Math.round(t[1] * 10) / 10), Math.round(KS.map.yaw * 1000) / 1000); return b.length === AIR.n; }, tgt), 'zone de bombes au point visé');
  await until(page, '!KS.mode', 60000);
  // RT confirme aussi, B annule
  ok(await openMap(page), 'carte ouverte de nouveau');
  await set(null, { 7: 1 }); await frames(page, 2); await set(null, { 7: 0 });
  ok(await until(page, '!KS.map.open && KS.stage === "confirm"', 30000), 'RT : la frappe est confirmée');
  await until(page, '!KS.mode', 60000);
  ok(await openMap(page), 'carte ouverte une troisième fois');
  await set(null, { 1: 1 }); await frames(page, 2); await set(null, { 1: 0 });
  ok(await until(page, '!KS.map.open && KS.stage === "cancel"', 30000) && await page.evaluate(() => PL.ks.air), 'B : annulé, la série reste prête');
  await until(page, '!KS.mode', 60000);
  ok(!g.logs.some((l) => l.includes('pageerror')), 'aucune erreur de page (manette)');
  await g.browser.close();
  }

  // --- 2. au doigt
  if (only(2)) for (const [w, h] of [[915, 412], [667, 340]]) {
    g = await play({ mobile: true, w, h, dpr: 2 }, "try{localStorage.setItem('dc_touch_help','1')}catch(e){}");
    page = g.page;
    const cdp = await page.context().newCDPSession(page);
    const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await frames(page, 2); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    ok(await openMap(page), `${w}x${h} : carte ouverte`);
    const lay = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, vis: getComputedStyle(e).display !== 'none' }; };
      return { map: r('#tacCanvas'), hint: r('#tcMapHint'), no: r('#tcMapNo'), ok: !!document.getElementById('tcMapOk'), vw: innerWidth, vh: innerHeight };
    });
    const hit = (a, b) => a && b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
    ok(!lay.ok, `${w}x${h} : plus de bouton Confirmer`);
    ok(lay.hint && lay.hint.vis && lay.no && lay.no.vis && !hit(lay.hint, lay.map) && !hit(lay.no, lay.map) && lay.no.r <= lay.vw && lay.no.b <= lay.vh && lay.hint.t >= 0, `${w}x${h} : la consigne et Annuler sont visibles, hors de la carte et de l'écran ${JSON.stringify({ hint: lay.hint && [Math.round(lay.hint.l), Math.round(lay.hint.t), Math.round(lay.hint.r), Math.round(lay.hint.b)], no: [Math.round(lay.no.l), Math.round(lay.no.t), Math.round(lay.no.r), Math.round(lay.no.b)], map: [Math.round(lay.map.l), Math.round(lay.map.t), Math.round(lay.map.r), Math.round(lay.map.b)] })}`);
    if (out) await page.screenshot({ path: `${out}/frappe-doigt-${w}x${h}.png` });
    // levé hors de la carte : rien ne part
    await page.evaluate(() => { const r = $('tacCanvas').getBoundingClientRect(); $('tacCanvas').dispatchEvent(new PointerEvent('pointerup', { clientX: r.right + 30, clientY: r.top + 20, pointerId: 77, bubbles: true })); });
    await frames(page, 2);
    ok(await page.evaluate(() => KS.map.open), `${w}x${h} : doigt levé hors de la carte, la frappe ne part pas`);
    // toucher à côté de la carte (sur la consigne) : la souris que le navigateur simule ensuite ne déplace pas le point et ne lance rien (le point filait au bord)
    await page.evaluate(() => { KS.map.x = 3; KS.map.z = -4; });
    await tap((lay.hint.l + lay.hint.r) / 2, (lay.hint.t + lay.hint.b) / 2); await frames(page, 3);
    ok(await page.evaluate(() => KS.map.open && KS.map.x === 3 && KS.map.z === -4), `${w}x${h} : un toucher à côté de la carte ne déplace pas le point et ne lance rien`);
    // un toucher : la frappe part là où il se pose
    const at = [lay.map.l + lay.map.w * 0.3, lay.map.t + (lay.map.b - lay.map.t) * 0.7];
    await tap(at[0], at[1]);
    ok(await until(page, '!KS.map.open && KS.stage === "confirm"', 30000), `${w}x${h} : un toucher lance la frappe`);
    const hitPt = await page.evaluate(([a, m]) => ({ x: KS.map.x, z: KS.map.z, ex: MAP.x0 + ((a[0] - m.l) / m.w) * (MAP.x1 - MAP.x0), ez: MAP.z0 + ((a[1] - m.t) / (m.b - m.t)) * (MAP.z1 - MAP.z0), jets: KS.jets.length }), [at, lay.map]);
    ok(Math.hypot(hitPt.x - hitPt.ex, hitPt.z - hitPt.ez) < 1 && hitPt.jets === 2, `${w}x${h} : la frappe est là où le doigt s'est posé (${hitPt.x.toFixed(1)}, ${hitPt.z.toFixed(1)} pour ${hitPt.ex.toFixed(1)}, ${hitPt.ez.toFixed(1)})`);
    await until(page, '!KS.mode', 60000);
    // Annuler
    ok(await openMap(page), `${w}x${h} : carte ouverte de nouveau`);
    const no = await page.evaluate(() => { KS.map.x = 3; KS.map.z = -4; window.__nj = KS.jets.length; const q = $('tcMapNo').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    await tap(no[0], no[1]);
    ok(await until(page, '!KS.map.open && KS.stage === "cancel"', 30000) && await page.evaluate(() => PL.ks.air && KS.jets.length <= window.__nj && KS.map.x === 3 && KS.map.z === -4), `${w}x${h} : Annuler annule vraiment (la série reste prête, pas de nouvelle frappe, le point n'a pas bougé)`);
    ok(!g.logs.some((l) => l.includes('pageerror')), `${w}x${h} : aucune erreur de page`);
    await g.browser.close();
  }

  // --- 3. létalité
  if (only(3)) {
  g = await play({ w: 800, h: 450, settings: { quality: 'low', lang: 'fr', map: 'simoun' } });
  page = g.page;
  const res = await page.evaluate(() => {
    const bots = entities.filter((e) => !e.isPlayer);
    for (const e of bots) { e.team = 1 - PL.ent.team; e.model = null; } // sans modèle, entChest lit la position de l'entité
    let best = null;
    for (let x = MAP.x0 + 20; x <= MAP.x1 - 20 && !best; x += 6) for (let z = MAP.z0 + 20; z <= MAP.z1 - 20 && !best; z += 6) {
      const h0 = groundHeight(x, z, 12); let flat = true;
      for (let a = 0; a < 6.28 && flat; a += 0.4) for (const r of [4, 8, 11]) if (Math.abs(groundHeight(x + Math.cos(a) * r, z + Math.sin(a) * r, 12) - h0) > 1.6) flat = false;
      if (flat) best = [x, z];
    }
    if (!best) return null;
    const T = new V3(best[0], 0, best[1]), dealt = new Map(), orig = window.applyDamage;
    window.applyDamage = (v, dmg) => dealt.set(v, (dealt.get(v) || 0) + dmg);
    const RINGS = [0, 4, 8, 10, 11, 13], samples = [], per = {};
    for (const r of RINGS) { per[r] = [0, 0]; for (let k = 0; k < (r === 0 ? 1 : 8); k++) samples.push([r, r === 0 ? 0 : k * Math.PI / 4 + 0.3 * r]); }
    PL.ent.pos.set(T.x + 60 > MAP.x1 ? T.x - 60 : T.x + 60, groundHeight(T.x, T.z, 12), T.z); // le joueur hors de la zone
    for (let s0 = 0; s0 < samples.length; s0 += bots.length) {
      const chunk = samples.slice(s0, s0 + bots.length); dealt.clear();
      chunk.forEach(([r, a], i) => { const e = bots[i], x = T.x + Math.cos(a) * r, z = T.z + Math.sin(a) * r; e.alive = true; e.health = 100; e.protT = 0; e.pos.set(x, groundHeight(x, z, 12), z); e.vel.set(0, 0, 0); });
      MATCH.events.length = 0; airstrike(T, 0.7, PL.ent);
      for (let t = 0; t < 4.2; t += 1 / 30) { MATCH.time += 1 / 30; for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= MATCH.time) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); } updateAircraft(1 / 30); updateFx(1 / 30); }
      chunk.forEach(([r], i) => { per[r][1]++; if ((dealt.get(bots[i]) || 0) >= 100) per[r][0]++; });
    }
    window.applyDamage = orig;
    return { at: best, per };
  });
  ok(!!res, 'terrain dégagé trouvé sur Simoun');
  if (res) {
    const p = res.per, pct = (r) => p[r][0] / p[r][1];
    console.log('      morts par anneau :', Object.entries(p).map(([r, [k, n]]) => `${r} m ${k}/${n}`).join(', '));
    ok(pct(0) === 1 && pct(4) === 1 && pct(8) >= 0.85, 'jusqu\'à 8 m du point visé : presque tout le monde meurt (une cible peut être abritée par le relief)');
    ok(pct(10) >= 0.75 && pct(11) >= 0.4, 'à 10 m, et au bord de la zone affichée (11 m) : la plupart meurent');
    ok(pct(13) <= 0.25, 'à 13 m, hors de la zone affichée : presque personne');
  }
  ok(!g.logs.some((l) => l.includes('pageerror')), 'aucune erreur de page (létalité)');
  await g.browser.close();
  }
  if (only(4)) {
  g = await play({ w: 800, h: 450, settings: { quality: 'low', lang: 'fr', map: 'meltem' } });
  page = g.page;
  const res = await page.evaluate(() => {
    const bots = entities.filter((e) => !e.isPlayer);
    for (const e of bots) { e.team = 1 - PL.ent.team; e.model = null; }
    // au fond d'une maison : un toit au-dessus, des murs dans sept directions sur huit à moins de 10 m, la place d'un soldat
    const pts = [];
    for (let x = MAP.x0 + 2; x < MAP.x1 - 2; x += 1.5) for (let z = MAP.z0 + 2; z < MAP.z1 - 2; z += 1.5) {
      const fy = groundHeight(x, z, 0.5);
      if (queryBoxes(x - 0.3, z - 0.3, x + 0.3, z + 0.3).some((b) => !b.ray && b.y0 < fy + 1.7 && b.y1 > fy + 0.5 && x + 0.3 > b.x0 && x - 0.3 < b.x1 && z + 0.3 > b.z0 && z - 0.3 < b.z1)) continue;
      const u = rayWorld(x, fy + 0.2, z, 0, 1, 0, 40); if (u && u.t < 2) continue;
      if (!roofAbove(x, fy + 1.75, z, 30)) continue;
      let walls = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (rayWorld(x, fy + 1.3, z, Math.cos(a), 0, Math.sin(a), 10)) walls++; }
      if (walls >= 7) pts.push([x, fy, z]);
    }
    const dealt = new Map(), orig = window.applyDamage;
    window.applyDamage = (v, dmg) => dealt.set(v, (dealt.get(v) || 0) + dmg);
    PL.ent.pos.set(MAP.x1 - 3, groundHeight(MAP.x1 - 3, MAP.z1 - 3, 12), MAP.z1 - 3);
    let dead = 0, n = 0;
    for (const [x, fy, z] of pts) {
      for (const e of bots) e.alive = false;
      const e = bots[0]; e.alive = true; e.health = 100; e.protT = 0; e.pos.set(x, fy, z); e.vel.set(0, 0, 0); dealt.clear();
      MATCH.events.length = 0; airstrike(new V3(x, fy, z), 0.7 + x * 0.13, PL.ent);
      for (let t = 0; t < 4.2; t += 1 / 30) { MATCH.time += 1 / 30; for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= MATCH.time) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); } updateAircraft(1 / 30); updateFx(1 / 30); }
      n++; if ((dealt.get(e) || 0) >= 100) dead++;
      if (airImpact(x, z) < fy + 2) return { bad: [x, fy, z, airImpact(x, z)] };
    }
    window.applyDamage = orig;
    return { n, dead };
  });
  ok(res && !res.bad, 'au-dessus d\'une maison, la bombe éclate sur le toit' + (res && res.bad ? ' ' + JSON.stringify(res.bad) : ''));
  if (res && !res.bad) {
    console.log(`      ${res.n} points au fond des maisons, ${res.dead} morts`);
    ok(res.n >= 15, 'Meltem : assez de points au fond des maisons');
    ok(res.dead <= res.n * 0.1, 'à l\'abri dans une maison : une cible sur dix au plus meurt d\'une frappe centrée sur elle');
  }
  ok(!g.logs.some((l) => l.includes('pageerror')), 'aucune erreur de page (abri)');
  await g.browser.close();
  }
  console.log(fails ? fails + ' échec(s)' : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERREUR', e); process.exit(2); });
