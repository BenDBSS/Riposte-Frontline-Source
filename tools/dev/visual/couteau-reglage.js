/* Banc de réglage du couteau en main (src/09zk-couteau-reglage.js, jeu ouvert avec ?couteau=1) : node couteau-reglage.js [dossier de captures] ; PAGE=autre.html.
   Le jeu tourne pour de bon (rendu 3D coupé sans dossier de captures, bots figés par le panneau) et le panneau est manipulé comme le ferait le propriétaire. Contrôles :
   - sans ?couteau=1, rien n'existe (ni panneau, ni crochet) ;
   - avec : le panneau, ses réglages et la souris libre ; un curseur, une case et un champ numérique changent KNIFE_HELD, HAND_POSES.kgrip et la prise du couteau ;
   - Repos, Course et Coup forcent la pose (couteau sorti tout seul, foulée figée ou jouée, coup figé à un instant) ;
   - ce qu'on fait dans le panneau ne parvient pas au jeu (touche F, clic) ;
   - Copier donne un texte que Appliquer relit, Tout remettre revient au code, la configuration survit au rechargement ;
   - un texte abîmé ou étranger n'entre pas (clés inconnues, nombres faux).
   Sort en erreur au premier défaut. Avec un dossier : captures du panneau et du jeu (rendu 3D gardé). */
const path = require('path');
const { openGame, REPO } = require('./common');
const out = process.argv[2], fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
// le rendu logiciel est lent quand on prend des captures : on attend des images du jeu (frameN), pas des millisecondes
const frames = async (page, n) => { const f0 = await page.evaluate('frameN'); await page.waitForFunction(`frameN >= ${f0 + n}`, null, { timeout: 120000, polling: 50 }); };
const PAGE = path.resolve(REPO, 'dist', process.env.PAGE || 'riposte-frontline.html');
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  // 1. sans ?couteau=1
  let g = await openGame({ url: 'file://' + PAGE, w: 960, h: 540, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  ok(await g.page.evaluate(() => !document.getElementById('kdbg') && KNIFE_DEBUG === null && !LOCK.fallback), 'sans ?couteau=1 : ni panneau ni crochet, la souris reste capturée');
  await g.browser.close();
  // 2. avec
  g = await openGame({ url: 'file://' + PAGE + '?couteau=1', w: 960, h: 540, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  const { page, logs } = g;
  await page.evaluate((cut) => { startMatch({}); if (cut) composer.render = () => {}; window.botsTick = () => {}; for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; } }, !out); // bots figés et écartés : rien ne tue le joueur pendant le test
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40 && !!document.getElementById("kdbg")', null, { timeout: 300000, polling: 500 });
  await page.evaluate(() => { localStorage.removeItem('dc_couteau'); const e = PL.ent; e.pos.set(-27, groundHeight(-27, -12, 5, 0.3), -12); PL.yaw = 0; });
  const P = (js) => page.evaluate(js);
  const click = async (txt) => page.evaluate((t) => { for (const b of document.querySelectorAll('#kdbg button')) if (b.textContent === t) { b.click(); return true; } return false; }, txt);
  ok(await P('KNIFE_DEBUG !== null && LOCK.fallback === true && pointerActive()'), 'avec ?couteau=1 : crochet posé, souris libre');
  const n = await P('KDBG.rows.length');
  ok(n >= 50, `le panneau a ${n} réglages (bras, couteau, doigts, course)`);
  ok(await P('["H.pos.0","H.grip.phi","H.grip.mid.2","G.i.0","G.t.4","G.t.5","G.t.6","G.t.7","H.run.amp.2","H.flex","H.S.1","G.p.2"].every((p) => KDBG.rows.some((r) => r.path === p))'), 'les réglages clés y sont (poignet, prise, doigts, pouce en huit angles, course, épaule)');

  // curseur, champ numérique, case
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.pos.0'); r.input.value = 0.31; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok(await P('Math.abs(KNIFE_HELD.pos[0] - 0.31) < 1e-6 && Math.abs(+KDBG.rows.find((r) => r.path === "H.pos.0").num.value - 0.31) < 1e-6'), 'un curseur change KNIFE_HELD et son champ numérique');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.pos.1'); r.num.value = -0.22; r.num.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  ok(await P('Math.abs(KNIFE_HELD.pos[1] + 0.22) < 1e-6 && Math.abs(+KDBG.rows.find((r) => r.path === "H.pos.1").input.value + 0.22) < 1e-6'), 'un champ numérique change KNIFE_HELD et son curseur');
  const m0 = await P('Array.from(knifeGripMatrix(KNIFE_HELD.grip).elements)');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.grip.phi'); r.input.value = 40; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const m1 = await P('Array.from(knifeGripMatrix(KNIFE_HELD.grip).elements)'), moved = await P('Array.from(_kgmH.elements).every((v, i) => Math.abs(v - knifeGripMatrix(KNIFE_HELD.grip).elements[i]) < 1e-9)');
  ok(m0.some((v, i) => Math.abs(v - m1[i]) > 1e-3) && moved, 'l\'angle du couteau dans la paume change la prise (matrice et prise en cache)');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.grip.flip'); r.input.checked = false; r.input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  ok(await P('KNIFE_HELD.grip.flip === false'), 'la case « prise retournée » change la prise');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'G.i.1'); r.input.value = 0.4; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok(await P('Math.abs(HAND_POSES.kgrip.i[1] - 0.4) < 1e-6'), 'un doigt se règle (HAND_POSES.kgrip)');
  ok(await P('localStorage.getItem("dc_couteau") && JSON.parse(localStorage.getItem("dc_couteau")).KNIFE_HELD.pos[0] === 0.31'), 'la configuration est gardée dans le navigateur');

  // rien ne parvient au jeu
  await P(`(() => { document.querySelector('#kdbg input[type=number]').focus(); })()`);
  await page.keyboard.press('KeyF'); await wait(page, 250);
  ok(await P('PL.knifeT === 0 && PL.knifeBtn === null && !PL.knifeOut'), 'une touche tapée dans le panneau n\'arrive pas au jeu');
  const box = await page.evaluate(() => { const r = document.querySelector('#kdbg h1').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  const yaw0 = await P('PL.yaw');
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 30, box.y + 4); await wait(page, 200);
  ok(await P('PL.held === false && PL.queued === false'), 'un clic dans le panneau ne tire pas');
  await page.mouse.up(); await wait(page, 200);
  ok(Math.abs((await P('PL.yaw')) - yaw0) < 1e-9, 'la souris qui bouge sur le panneau ne tourne pas la vue');

  ok(await P('document.getElementById("kdbg").classList.contains("min")'), 'un clic sur le titre replie le panneau'); await P('document.getElementById("kdbg").classList.remove("min")');
  await click('Tout remettre');
  // modes
  const rig = () => P('(() => { const v = new V3(); VM.knife.getWorldPosition(v); return { out: PL.knifeOut, vis: VM.knifeRig.visible, hold: +PL.knifeHold.toFixed(2), sprint: +VM.sprint.toFixed(2), knifeT: +PL.knifeT.toFixed(2), p: [v.x, v.y, v.z] }; })()');
  await click('Figer les bots'); ok(await P('KDBG.bots !== null && botsTick !== KDBG.bots'), 'Figer les bots');
  await click('Repos'); await frames(page, 80); let s = await rig();
  ok(s.out && s.vis && s.hold > 0.95, 'Repos : le couteau sort tout seul et reste en main', s);
  // le pouce : un préréglage pose les huit angles, un curseur pivote la base du pouce dans la vraie main
  await click('Posé sur le manche, vers la garde');
  ok(await P('JSON.stringify(HAND_POSES.kgrip.t) === JSON.stringify([0.2, 0.3, 0.2, 0.5, 0, 0, 0, 0])'), 'Pouce : un préréglage pose les huit angles');
  const tq = () => P('(() => { const q = VM.knifeArm.hand.userData.tm.quaternion; return [q.x, q.y, q.z, q.w]; })()');
  await frames(page, 10); const q0 = await tq();
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'G.t.6'); r.input.value = 1.2; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await frames(page, 10); const q1 = await tq();
  ok(q0.some((v, i) => Math.abs(v - q1[i]) > 0.05), 'Pouce : le pivot de la base tourne le pouce de la main', { avant: q0.map((v) => +v.toFixed(2)), apres: q1.map((v) => +v.toFixed(2)) });
  await click('Tout remettre');
  await click('Course'); await P('(() => { KDBG.anim = false; KDBG.ph = 0.5; })()'); await frames(page, 30); const c1 = await rig();
  await P('(() => { KDBG.ph = 3.6; })()'); await frames(page, 30); const c2 = await rig();
  const dc = Math.hypot(c1.p[0] - c2.p[0], c1.p[1] - c2.p[1], c1.p[2] - c2.p[2]);
  ok(dc > 0.005, 'Course : la pose suit la phase de la foulée figée', { dx: +dc.toFixed(3) });
  await P('(() => { KDBG.anim = true; })()'); await frames(page, 20);
  ok((await P('KDBG.ph')) !== 3.6, 'Course animée : la foulée avance');
  await click('Coup'); await P('(() => { KDBG.loop = false; KDBG.t = 0.05; })()'); await frames(page, 30); const k1 = await rig();
  await P('(() => { KDBG.t = 0.4; })()'); await frames(page, 30); const k2 = await rig();
  const dk = Math.hypot(k1.p[0] - k2.p[0], k1.p[1] - k2.p[1], k1.p[2] - k2.p[2]);
  ok(dk > 0.03 && k1.knifeT === 0, 'Coup : la pose suit l\'instant choisi, sans coup donné pour de bon', { dx: +dk.toFixed(3) });
  // le coup : deux poses complètes, début et fin. Le coup part de la pose tenue, passe par le début à tStart et par la fin à tEnd, et revient à la pose tenue
  const flatDiff = await P(`(() => {
    const B = knifeFlat(KNIFE_HELD, HAND_POSES.kgrip, new Float64Array(KP_N)), F = new Float64Array(KP_N), S0 = knifeFlat(KNIFE_STAB.start, KNIFE_STAB.start.fingers, new Float64Array(KP_N)), E0 = knifeFlat(KNIFE_STAB.end, KNIFE_STAB.end.fingers, new Float64Array(KP_N));
    const d = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0), Z = KNIFE_STAB;
    return { t0: d(knifeStabPose(0, B, F), B), t1: d(knifeStabPose(1, B, F), B), start: d(knifeStabPose(Z.tStart, B, F), S0), end: d(knifeStabPose(Z.tEnd, B, F), E0), n: KP_N };
  })()`);
  ok(flatDiff.t0 < 1e-9 && flatDiff.t1 < 1e-9 && flatDiff.start < 1e-9 && flatDiff.end < 1e-9, 'le coup part de la pose tenue, passe par le début et la fin à leurs instants et revient à la pose tenue', flatDiff);
  await click('Panneau à droite / à gauche'); ok(await P('getComputedStyle(document.getElementById("kdbg")).left !== "0px" && document.getElementById("kdbg").classList.contains("right")'), 'le bouton passe le panneau à droite (le début du coup se joue à gauche)'); await click('Panneau à droite / à gauche'); ok(await P('getComputedStyle(document.getElementById("kdbg")).left === "0px"'), 'et le ramène à gauche');
  await click('Voir le début'); await frames(page, 30); const q2 = await rig();
  ok(await P('KDBG.mode === "coup" && KDBG.loop === false && KDBG.t === KNIFE_STAB.tStart'), 'Voir le début : le mode Coup, figé à l\'instant du début', await P('KDBG.t'));
  await click('Voir la fin'); await frames(page, 30); const q3 = await rig();
  const dq = Math.hypot(q2.p[0] - q3.p[0], q2.p[1] - q3.p[1], q2.p[2] - q3.p[2]);
  ok(dq > 0.1, 'le début et la fin du coup ne sont pas la même pose (le couteau passe de gauche à droite)', { dx: +dq.toFixed(3), debut: q2.p.map((v) => +v.toFixed(2)), fin: q3.p.map((v) => +v.toFixed(2)) });
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'K.end.pos.0'); r.input.value = +r.input.value - 0.2; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await frames(page, 30); const q4 = await rig();
  ok(Math.hypot(q3.p[0] - q4.p[0], q3.p[1] - q4.p[1], q3.p[2] - q4.p[2]) > 0.05, 'un curseur de la pose de fin déplace le couteau à la fin du coup');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'K.end.fingers.i.0'); r.input.value = 0.2; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await frames(page, 30);
  ok(await P('Math.abs(KNIFE_STAB.end.fingers.i[0] - 0.2) < 1e-6 && Math.abs(HAND_POSES.kstab.i[0] - 0.2) < 0.02'), 'un doigt de la pose de fin se règle et la main du coup le prend');
  await click('Fin : prendre la pose tenue');
  ok(await P('JSON.stringify(KNIFE_STAB.end.pos) === JSON.stringify(KNIFE_HELD.pos) && KNIFE_STAB.end.roll === KNIFE_HELD.roll && JSON.stringify(KNIFE_STAB.end.fingers.t) === JSON.stringify(HAND_POSES.kgrip.t) && KNIFE_STAB.end.grip.phi === KNIFE_HELD.grip.phi'), 'Fin : prendre la pose tenue recopie bras, prise et doigts');
  await click('Début : prendre la fin');
  ok(await P('JSON.stringify(KNIFE_STAB.start) === JSON.stringify(KNIFE_STAB.end)'), 'Début : prendre la fin recopie toute la pose');
  await click('Tout remettre');
  await P('(() => { KDBG.loop = true; KDBG.clock = 0; })()'); await frames(page, 20);
  ok(await P('KDBG.clock > 0'), 'Coup en boucle : le geste se rejoue');
  if (out) {
    await click('Course'); await P('(() => { KDBG.anim = false; KDBG.ph = 0.8; })()'); await frames(page, 40);
    await page.screenshot({ path: path.join(out, 'reglage-course.png') });
    await click('Repos'); await frames(page, 40);
    await page.screenshot({ path: path.join(out, 'reglage-repos.png') });
  }
  await click('Jeu');

  // copier, appliquer, tout remettre
  await P(`(() => { KDBG.rows.find((r) => r.path === 'H.pos.2').num.value = -0.37; KDBG.rows.find((r) => r.path === 'H.pos.2').num.dispatchEvent(new Event('change')); })()`);
  await click('Copier'); await wait(page, 300);
  const txt = await P('KDBG.ta.value'), cfg = JSON.parse(txt);
  ok(cfg.KNIFE_HELD && cfg.kgrip && cfg.KNIFE_HELD.pos[2] === -0.37 && cfg.kgrip.i.length === 3 && cfg.kgrip.t.length === 8 && cfg.KNIFE_HELD.run.amp.length === 3 && cfg.KNIFE_STAB.start.pos.length === 3 && cfg.KNIFE_STAB.start.fingers.t.length === 8 && cfg.KNIFE_STAB.end.grip.mid.length === 3 && cfg.KNIFE_STAB.end.pole.length === 3 && typeof cfg.KNIFE_STAB.tStart === 'number', 'Copier : le texte est du JSON complet (KNIFE_HELD, KNIFE_STAB avec début et fin, et kgrip)');
  await click('Tout remettre');
  ok(await P('KNIFE_HELD.pos[2] !== -0.37 && JSON.stringify(KNIFE_HELD.pos) === JSON.stringify(KDBG.def.KNIFE_HELD.pos)'), 'Tout remettre : la configuration du code revient');
  await P(`(t => { KDBG.ta.value = t; })(${JSON.stringify(txt)})`); await click('Appliquer le texte');
  ok(await P('KNIFE_HELD.pos[2] === -0.37 && Math.abs(+KDBG.rows.find((r) => r.path === "H.pos.2").input.value + 0.37) < 1e-6'), 'Appliquer : le texte copié est relu et les curseurs suivent');
  // un texte étranger : seules les clés connues, de même type, entrent
  await click('Tout remettre');
  await P(`(() => { KDBG.ta.value = JSON.stringify({ KNIFE_HELD: { pos: [1, 'x', null], roll: 'oups', evil: 1, grip: { flip: 0, phi: 33, __proto__: { z: 1 } } }, kgrip: { i: [0.1, 0.2], t: 'non' }, KNIFE_STAB: { start: { pos: [9, 'x'], fingers: { t: [1, 2] } }, tStart: 0.2, low: [0.1, 0.2, 0.3] }, autre: 5 }); })()`); await click('Appliquer le texte');
  const after = await P('({ pos: KNIFE_HELD.pos, roll: KNIFE_HELD.roll, evil: KNIFE_HELD.evil, flip: KNIFE_HELD.grip.flip, phi: KNIFE_HELD.grip.phi, i: HAND_POSES.kgrip.i, t: HAND_POSES.kgrip.t, z: ({}).z, def: KDBG.def.KNIFE_HELD, start: KNIFE_STAB.start, defs: KDBG.def.KNIFE_STAB.start, tStart: KNIFE_STAB.tStart, low: KNIFE_STAB.low })');
  ok(after.pos[0] === 1 && after.pos[1] === after.def.pos[1] && after.pos[2] === after.def.pos[2], 'texte étranger : le nombre valable entre, le texte et le vide à la place d\'un nombre non', after.pos);
  ok(after.roll === after.def.roll && after.evil === undefined && after.z === undefined && after.flip === false && after.phi === 33 && after.t.length === 8 && after.i.length === 3, 'texte étranger : clé inconnue, texte à la place d\'un nombre et __proto__ n\'entrent pas', after);
  ok(after.start.pos[0] === 9 && after.start.pos[1] === after.defs.pos[1] && after.start.fingers.t[0] === 1 && after.start.fingers.t[1] === 2 && after.start.fingers.t[2] === after.defs.fingers.t[2] && after.tStart === 0.2 && after.low[2] === 0.3, 'texte étranger : la pose du début (objets et tableaux dans la pose) ne reprend que les nombres valables', { pos: after.start.pos, t: after.start.fingers.t.slice(0, 3) });
  await P('(() => { try { kdbgLoad(\'{abîmé\'); } catch (e) {} })()');
  ok(true, 'texte illisible : refusé sans casser le panneau');
  await click('Tout remettre');
  // rechargement : la configuration reste
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.roll'); r.num.value = -1.11; r.num.dispatchEvent(new Event('change')); })()`);
  await page.reload(); await page.waitForFunction('typeof KDBG !== "undefined" && !!KDBG.el', null, { timeout: 300000, polling: 500 });
  ok(await P('Math.abs(KNIFE_HELD.roll + 1.11) < 1e-6'), 'après rechargement : la configuration est reprise');
  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED') && !l.includes('Failed to load'));
  ok(errs.length === 0, `console propre${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await g.browser.close();
  console.log(fails.length ? `${fails.length} échec(s)` : 'tout est bon');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
