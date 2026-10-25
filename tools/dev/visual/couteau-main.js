/* Couteau en main (src/08-player.js : knifeButton, knifeDraw, knifeStow ; src/07c-controller.js : KNIFE_MOVE) : node couteau-main.js [page] ; PAGE=autre.html.
   Le jeu tourne pour de bon (boucle d'images, rendu 3D coupé, bots figés), les touches et la souris viennent de Playwright. Contrôles :
   - sans le couteau : vitesse de marche et de sprint de l'arme ; un appui bref sur F donne un coup, qui part au relâchement ;
   - F maintenu : le couteau sort (au bout de KNIFE_HOLD), la marche et le sprint vont KNIFE_MOVE / d.move fois plus vite ;
   - couteau en main : le clic donne un coup et ne tire pas, la visée et le rechargement sont sans effet, ni réticule ni chargeur au HUD, l'arme reste baissée ;
   - un ennemi à portée : le coup part dès l'appui, et un appui maintenu sort ensuite le couteau ;
   - 2 (ou 1, Q) range le couteau et ressort l'arme, Q revient à celle d'avant ; une grenade lancée couteau en main le laisse en main ;
   - l'animation du coup : un appui simple (couteau pas en main) joue le coup d'origine, un coup couteau en main joue celui réglé dans le banc (KNIFE_STAB), et un couteau sorti en plein coup d'origine ne fait pas sauter la main ;
   - mort : plus de couteau en main ; une autre classe (giveLoadout) non plus ;
   - la main reste dans le champ (repos, course sur plusieurs foulées ; au contact du coup, et le balayage la sort du cadre en fin de coup), la pointe aussi au repos et en course, en 16:9 et sur un écran de téléphone.
   Sort en erreur au premier défaut. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2] || process.env.PAGE, w: 640, h: 360, settings: { quality: 'low', map: 'sable' }, noHdri: true });
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); composer.render = () => {}; // rendu 3D coupé : la boucle d'images tourne vite en rendu logiciel
    window.botsTick = () => {}; // bots figés : rien ne tire, rien ne bouge
    window.entChest = (e, out) => out.set(e.pos.x, e.pos.y + 1.3, e.pos.z); // le corps d'un bot figé ne suit pas sa position : le torse est posé d'après elle
  });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40', null, { timeout: 300000, polling: 500 });
  // un terrain dégagé : 28 m devant soi sans mur ni marche (collideCircle ne pousse nulle part), pour courir sans rien toucher
  const spot = await page.evaluate(() => {
    for (let x = -30; x <= 30; x += 3) for (let z = -30; z <= 30; z += 3) for (let a = 0; a < 8; a++) {
      const yaw = a * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw), g = groundHeight(x, z, 5, 0.3);
      if (Math.abs(g) > 0.3) continue;
      let free = true;
      for (let d = 0; d <= 28 && free; d++) { const q = new V3(x + dx * d, g, z + dz * d), x0 = q.x, z0 = q.z; collideCircle(q, 0.36, 1.75); free = Math.hypot(q.x - x0, q.z - z0) < 0.01 && Math.abs(groundHeight(x0, z0, 5, 0.3) - g) < 0.3; }
      if (free) return { x, z, yaw };
    }
    return null;
  });
  ok(!!spot, 'un terrain dégagé de 28 m pour courir', spot);
  if (!spot) { await browser.close(); process.exit(1); }
  const place = () => page.evaluate((s) => {
    const e = PL.ent; e.alive = true; e.health = 100; e.pos.set(s.x, groundHeight(s.x, s.z, 5, 0.3), s.z); e.vel.set(0, 0, 0); e.vy = 0; e.onGround = true;
    PL.yaw = PL.pitch = 0; PL.yaw = s.yaw; PL.protT = 99; e.protT = 99;
    if (PL.cur !== 0) { PL.cur = 0; } PL.switching = 0; PL.knifeOut = false; PL.knifeHold = 0; PL.knifeBtn = null; PL.knifeT = 0; PL.nadeState = null; PL.reload = null;
    VM.lowerTarget = 0; VM.lower = 0; PL.ent.arms.slots[0].mag = PL.ent.arms.slots[0].def.mag; vmEquip(PL.ent.arms.slots[0].def);
    for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; }
  }, spot);
  const st = () => page.evaluate(() => ({
    out: PL.knifeOut, knew: PL.knifeNew, knifeT: PL.knifeT, cur: PL.cur, sw: PL.switching, lowerT: VM.lowerTarget, lower: +VM.lower.toFixed(2), hold: +PL.knifeHold.toFixed(2),
    mag: curW().mag, shots: PL.ent.arms.shots, reload: !!PL.reload, ads: !!PL.ent.adsActive, vads: +VM.ads.toFixed(2), spd: +Math.hypot(PL.ent.vel.x, PL.ent.vel.z).toFixed(2),
    sprint: !!PL.sprinting, rig: VM.knifeRig.visible, holder: VM.holder.visible, nades: PL.nades, wname: document.getElementById('wname').textContent,
    xh: document.getElementById('xhair').style.opacity, hudNums: document.querySelector('.ammo .nums').style.visibility, bm: PL.ent.arms.slots[0].def.move, pm: PL.ent.arms.slots[1].def.move,
  }));
  const run = async (key, ms) => { await page.keyboard.down(key); await wait(page, ms); };

  // 1. à mains nues : vitesse de l'arme, appui bref = coup au relâchement
  await place(); await wait(page, 200);
  await page.keyboard.down('KeyW'); await wait(page, 1400);
  let s = await st();
  const base = 4.4 * s.bm;
  ok(Math.abs(s.spd - base) < 0.35, `marche avec l'arme : ${s.spd} m/s (attendu ${base.toFixed(2)})`);
  await page.keyboard.up('KeyW'); await wait(page, 500);
  await page.keyboard.down('KeyF'); await wait(page, 90); s = await st();
  ok(s.knifeT === 0 && !s.out, 'appui bref, personne à portée : le coup n\'est pas parti à l\'appui', { knifeT: s.knifeT });
  await page.keyboard.up('KeyF'); await wait(page, 60); s = await st();
  ok(s.knifeT > 0 && !s.out, 'appui bref : le coup part au relâchement, le couteau ne reste pas en main', { knifeT: +s.knifeT.toFixed(2), out: s.out });
  ok(!s.knew, 'appui simple : le coup d\'origine, pas celui du couteau en main', { knew: s.knew });
  await wait(page, 700);

  // 2. F maintenu : le couteau sort, on va plus vite
  await place(); await wait(page, 200);
  await page.keyboard.down('KeyF'); await wait(page, 150); s = await st();
  ok(!s.out, 'F maintenu 0,15 s : pas encore en main', { out: s.out });
  await wait(page, 350); s = await st();
  ok(s.out && s.knifeT === 0, 'F maintenu 0,5 s : le couteau est en main, sans coup donné', { out: s.out, knifeT: s.knifeT });
  await page.keyboard.up('KeyF'); await wait(page, 300); s = await st();
  ok(s.out && s.rig && s.hold > 0.9 && s.lowerT === 1 && !s.holder, 'F relâché : le couteau reste en main, la main est là, l\'arme baissée', { hold: s.hold, rig: s.rig, holder: s.holder, lowerT: s.lowerT });
  ok(s.wname.toLowerCase() === 'couteau' || s.wname.toLowerCase() === 'knife', 'HUD : le nom du couteau à la place de l\'arme', s.wname);
  ok(s.hudNums === 'hidden', 'HUD : ni chargeur ni réserve', s.hudNums);
  ok(+s.xh === 0, 'HUD : pas de réticule', s.xh);
  await page.keyboard.down('KeyW'); await wait(page, 1400); s = await st();
  const kn = 4.4 * 1.15;
  ok(Math.abs(s.spd - kn) < 0.35 && s.spd > base + 0.4, `marche couteau en main : ${s.spd} m/s (attendu ${kn.toFixed(2)}, ${base.toFixed(2)} avec l'arme)`);
  await page.keyboard.down('ShiftLeft'); await wait(page, 1200); s = await st();
  const kns = kn * 1.55;
  ok(s.sprint && Math.abs(s.spd - kns) < 0.5, `sprint couteau en main : ${s.spd} m/s (attendu ${kns.toFixed(2)})`);
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await wait(page, 400);

  // 3. couteau en main : le clic frappe, la visée et le rechargement ne font rien
  await place(); await wait(page, 100);
  await page.evaluate(() => { curW().mag = 10; });
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 200);
  const before = await st();
  await page.mouse.down(); await wait(page, 120); s = await st();
  ok(s.knifeT > 0 && s.shots === before.shots && s.mag === 10, 'clic couteau en main : un coup de couteau, pas de tir', { knifeT: +s.knifeT.toFixed(2), shots: s.shots - before.shots, mag: s.mag });
  ok(s.knew, 'clic couteau en main : le coup du couteau en main', { knew: s.knew });
  await wait(page, 600); s = await st();
  ok(s.out && s.rig && s.knifeT >= 0, 'clic tenu : les coups s\'enchaînent et le couteau reste en main', { knifeT: +s.knifeT.toFixed(2) });
  await page.mouse.up(); await wait(page, 700);
  await page.mouse.down({ button: 'right' }); await wait(page, 500); s = await st();
  ok(!s.ads && s.vads < 0.05, 'clic droit couteau en main : pas de visée', { ads: s.ads, vads: s.vads });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('KeyR'); await wait(page, 300); s = await st();
  ok(!s.reload && s.mag === 10, 'R couteau en main : pas de rechargement', { reload: s.reload, mag: s.mag });

  // 4. ranger : 2 sort le pistolet, Q revient à l'arme d'avant
  await page.keyboard.press('Digit2'); await wait(page, 900); s = await st();
  ok(!s.out && s.cur === 1 && s.sw <= 0 && s.lowerT === 0 && s.lower < 0.05 && s.holder && !s.rig, 'touche 2 : couteau rangé, pistolet en main', { out: s.out, cur: s.cur, lower: s.lower, holder: s.holder, rig: s.rig });
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 200); s = await st();
  ok(s.out && s.cur === 1, 'couteau sorti avec le pistolet', { out: s.out, cur: s.cur });
  await page.keyboard.press('KeyQ'); await wait(page, 900); s = await st();
  ok(!s.out && s.cur === 1 && s.holder, 'Q couteau en main : retour au pistolet tenu avant (pas à l\'autre arme)', { out: s.out, cur: s.cur });
  await page.keyboard.press('Digit1'); await wait(page, 900);
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 200);
  await page.keyboard.press('Digit1'); await wait(page, 900); s = await st();
  ok(!s.out && s.cur === 0 && s.holder && s.lower < 0.05, 'touche 1 couteau en main : l\'arme principale ressort', { out: s.out, cur: s.cur, lower: s.lower });

  // 5. un ennemi à portée : le coup part dès l'appui, un appui maintenu sort ensuite le couteau
  await place(); await wait(page, 100);
  await page.evaluate(() => {
    const e = PL.ent, f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], b = entities.find((o) => !o.isPlayer && o.team !== e.team);
    b.alive = true; b.model.root.visible = true; b.health = 100; b.pos.set(e.pos.x + f[0] * 1.6, e.pos.y, e.pos.z + f[1] * 1.6);
  });
  await page.keyboard.down('KeyF'); await wait(page, 80); s = await st();
  ok(s.knifeT > 0 && !s.knew, 'ennemi à 1,6 m : le coup d\'origine part dès l\'appui', { knifeT: +s.knifeT.toFixed(2), knew: s.knew });
  await page.keyboard.up('KeyF'); await wait(page, 800); s = await st();
  ok(!s.out, 'ennemi à portée, appui bref : le couteau ne sort pas', { out: s.out });
  // appui maintenu sur un ennemi : le coup d'origine part à l'appui, le couteau sort en plein coup sans que la main saute (elle remonte une fois le coup fini)
  await place(); await wait(page, 100);
  await page.evaluate(() => {
    const e = PL.ent, f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], b = entities.find((o) => !o.isPlayer && o.team !== e.team);
    b.alive = true; b.model.root.visible = true; b.health = 100; b.pos.set(e.pos.x + f[0] * 1.6, e.pos.y, e.pos.z + f[1] * 1.6);
  });
  await page.keyboard.down('KeyF'); await page.waitForFunction('PL.knifeOut', null, { timeout: 5000, polling: 10 }); s = await st();
  ok(s.out && s.knifeT > 0 && !s.knew && s.hold < 0.1, 'F maintenu sur un ennemi : le couteau sort en plein coup d\'origine, la main ne saute pas', { knifeT: +s.knifeT.toFixed(2), knew: s.knew, hold: s.hold });
  await wait(page, 800); s = await st();
  ok(s.out && s.knifeT <= 0 && s.hold > 0.9, 'F maintenu sur un ennemi : le coup fini, la main remonte avec le couteau', { knifeT: s.knifeT, hold: s.hold });
  await page.keyboard.up('KeyF'); await wait(page, 100);
  await place(); await wait(page, 100);
  await page.evaluate(() => { const b = entities.find((o) => !o.isPlayer); b.alive = false; b.model.root.visible = false; });
  await page.keyboard.down('KeyF'); await wait(page, 600); await page.keyboard.up('KeyF'); await wait(page, 200); s = await st();
  ok(s.out, 'F maintenu : le couteau sort, même après un coup', { out: s.out });

  // 6. grenade couteau en main : le couteau reste en main
  await page.keyboard.press('KeyG'); await wait(page, 300);
  s = await st();
  ok(s.out && s.hold < 0.3, 'grenade en cours : le couteau reste en main, mais la main de la grenade prend la place', { out: s.out, hold: s.hold });
  await wait(page, 1400); s = await st();
  ok(s.out && s.lowerT === 1 && s.hold > 0.9 && s.rig && s.nades === 1, 'grenade lancée : le couteau est toujours en main, l\'arme baissée', { out: s.out, lowerT: s.lowerT, hold: s.hold, rig: s.rig, nades: s.nades });

  // 7. mort et nouvelle classe
  await page.evaluate(() => { killEnt(PL.ent, entities.find((o) => !o.isPlayer), 'M4A1', false, new V3(0, 0, 1)); });
  await wait(page, 200); s = await st();
  ok(!s.out && !s.rig, 'mort : plus de couteau en main', { out: s.out, rig: s.rig });
  await page.evaluate(() => { kcReset(); respawnPlayer(); }); await wait(page, 600);
  await place(); await wait(page, 100);
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 100);
  await page.evaluate(() => { giveLoadout(); }); await wait(page, 600); s = await st();
  ok(!s.out && s.cur === 0, 'nouvelle classe : le couteau est rangé', { out: s.out, cur: s.cur });

  // 8. la main reste dans le champ : au repos, sur plusieurs cycles de foulées à fond de sprint, puis pendant un coup donné couteau en main, à deux formats d'écran
  // (16:9 et un téléphone en paysage). On joue updateViewmodel et updateRigs à la main, dans la même évaluation (la boucle d'images n'a pas la main entre deux).
  const F = await page.evaluate(() => {
    const out = {}, v = new V3(), VMOD = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    const proj = (obj, p) => { VM.root.updateMatrixWorld(true); obj.localToWorld(v.copy(p)); v.project(vmCamera); return [v.x, v.y]; };
    const aspect0 = vmCamera.aspect;
    for (const asp of [16 / 9, 2.05]) {
      vmCamera.aspect = asp; vmCamera.updateProjectionMatrix();
      const r = { hand: [[9, 9], [-9, -9]], tip: [[9, 9], [-9, -9]], coup: [[9, 9], [-9, -9]], hit: [[9, 9], [-9, -9]], orig: [[9, 9], [-9, -9]] };
      // la pointe n'est suivie qu'au repos et en course : en armant le coup, la lame (prise inversée) pointe vers le coude, donc vers le bas de l'écran
      const note = (swing, orig, kt) => {
        const h = proj(VM.knifeArm.hand, new V3(0, 0, 0)), t = proj(VM.knife, new V3(0, 0, -0.185));
        for (let i = 0; i < 2; i++) { const R = orig ? r.orig : swing ? r.coup : r.hand; R[0][i] = Math.min(R[0][i], h[i]); R[1][i] = Math.max(R[1][i], h[i]); if (swing && !orig && Math.abs(1 - kt / KNIFE_DUR - KNIFE_HIT) < 0.05) { r.hit[0][i] = Math.min(r.hit[0][i], h[i]); r.hit[1][i] = Math.max(r.hit[1][i], h[i]); } if (!swing) { r.tip[0][i] = Math.min(r.tip[0][i], t[i]); r.tip[1][i] = Math.max(r.tip[1][i], t[i]); } }
      };
      const step = (sprint, knifeT, orig) => {
        const sp = sprint ? 7.84 : 0; updateViewmodel(1 / 60, Object.assign({}, VMOD, { sprint, speed: sp, fwd: sp }));
        updateRigs(1 / 60, { knifeT: knifeT || 0, knifeNew: !orig, nadeState: null, nadeT: 0, cookT: 0, knifeHold: orig ? 0 : 1, sprint: VM.sprint, speed: sp }); note(!!knifeT, !!orig, knifeT);
      };
      VM.sprint = 0; VM.sprV = 0; VM.bobAmt = 0; VM.bobT = 0; VM.lower = 1; VM.lowerTarget = 1;
      for (let i = 0; i < 60; i++) step(false);
      for (let i = 0; i < 150; i++) step(true);
      for (let i = 0; i < 40; i++) step(false);
      for (let i = 0; i < 26; i++) step(false, Math.max(0.0001, KNIFE_DUR * (1 - i / 25)));
      for (let i = 0; i < 26; i++) step(false, Math.max(0.0001, KNIFE_DUR * (1 - i / 25)), true);
      out[asp.toFixed(2)] = r;
    }
    vmCamera.aspect = aspect0; vmCamera.updateProjectionMatrix();
    return out;
  });
  for (const [asp, r] of Object.entries(F)) {
    const hand = r.hand, tip = r.tip, inView = hand[0][0] > -0.9 && hand[1][0] < 0.9 && hand[0][1] > -0.95 && hand[1][1] < 0 && r.hit[0][0] > -0.95 && r.hit[1][0] < 0.95 && r.hit[0][1] > -1.1 && r.hit[1][1] < 0.1 && tip[0][0] > -1 && tip[1][0] < 1 && tip[0][1] > -1 && tip[1][1] < 1;
    ok(r.orig[0][1] < -1.5 && r.orig[1][1] > -0.6 && r.orig[1][1] < 0, `coup d'origine à ${asp}:1 : la main vient d'en bas et monte dans le champ`, { origY: r.orig.map((p) => +p[1].toFixed(2)) });
    ok(inView, `couteau en main à ${asp}:1 : la main reste dans le champ (repos, course, contact du coup ; le balayage la sort du cadre en fin de coup) et la pointe au repos et en course`, { mainX: hand.map((p) => +p[0].toFixed(2)), mainY: hand.map((p) => +p[1].toFixed(2)), pointeY: tip.map((p) => +p[1].toFixed(2)), coupX: r.coup.map((p) => +p[0].toFixed(2)), coupY: r.coup.map((p) => +p[1].toFixed(2)), contactX: r.hit.map((p) => +p[0].toFixed(2)), contactY: r.hit.map((p) => +p[1].toFixed(2)), origX: r.orig.map((p) => +p[0].toFixed(2)), origY: r.orig.map((p) => +p[1].toFixed(2)) });
  }

  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED'));
  ok(errs.length === 0, `console propre${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails.length ? `${fails.length} échec(s)` : 'tout est bon');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
