/* Contrôle de la version mobile : node tools/dev/visual/tactile.js [dossier de captures]
   Pour plusieurs tailles de téléphone en paysage : lance une partie avec les contrôles tactiles, montre tous les boutons, relève les
   recouvrements (boutons entre eux, boutons et éléments d'interface) et les débordements de l'écran. Puis joue au doigt (événements
   tactiles réels, par le protocole de débogage) : joystick, regard, tir, visée, saut, recharge, changement d'arme, pause, plusieurs doigts
   à la fois. Les recouvrements sont relevés dans trois modes : par défaut (tir automatique et double toucher pour viser : ni bouton de tir ni bouton Viser),
   tir automatique seul (la visée à la place du tir) et tir manuel ; le jeu au doigt se fait en tir manuel, puis le tir automatique est vérifié (boutons, tir
   continu d'un pistolet sur un ennemi devant soi), puis le double toucher (deux touchers brefs épaulent, deux autres rangent, un toucher seul ou un regard non),
   la mort et la killcam au doigt (invite « Touchez », un toucher fait réapparaître).
   Enfin, l'écran en portrait doit demander de tourner le téléphone. Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
const SIZES = process.env.TAILLES ? process.env.TAILLES.split(',').map((t) => t.split('x').map(Number)) // TAILLES=1024x768,1366x1024 : ces tailles seulement
  : [[915, 412], [844, 390], [740, 360], [667, 375], [1024, 460], [1024, 768], [1366, 1024]]; // les deux dernières : iPad en paysage (4:3)
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('ECHEC :', msg); } else console.log('ok    :', msg); };
const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

async function start(w, h, dpr, auto = true, dbl = true) {
  const g = await openGame({ mobile: true, w, h, dpr, settings: { quality: 'low', lang: 'fr', map: 'sable', touch: 'on', tcAuto: auto, tcDblAds: dbl }, noHdri: true, init: "try{localStorage.setItem('dc_touch_help','1')}catch(e){}" }); // (l'aide du premier lancement avale sinon le premier toucher)
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('depGo').click());
  await page.waitForFunction("MATCH.state==='playing' && PL.ent.alive", null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const h = document.getElementById('tcHelp'); if (h) h.classList.add('hidden'); });
  g.cdp = await page.context().newCDPSession(page);
  return g;
}
/* Horloge des événements tactiles : le rendu logiciel est lent, l'écart réel entre deux événements ne dit rien du geste ; elle repart de l'heure réelle
   à chaque doigt posé, adv : secondes écoulées dans le geste */
let clk = Date.now() / 1000;
const touch = (g, type, pts, adv) => { clk = type === 'touchStart' ? Date.now() / 1000 : clk + (adv === undefined ? 0.03 : adv); return g.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id || 0 })), timestamp: clk }); };
/* attend une condition dans la page (le rendu logiciel est lent : quelques images par seconde, parfois une) */
const until = (g, cond, ms) => g.page.waitForFunction(cond, null, { timeout: ms || 90000, polling: 100 }).then(() => true, () => false);
const center = (g, sel) => g.page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);

(async () => {
  // 1. recouvrements pour chaque taille
  for (const [w, h] of process.env.JEU ? [] : SIZES) { // JEU=1 : saute les recouvrements, joue seulement
    const g = await start(w, h, 1.5), { page } = g;
    await page.evaluate(() => {
      touchTick = () => {}; // fige les boutons contextuels : on les montre tous
      TC.root.classList.remove('hidden', 'dead', 'map');
      for (const b of document.querySelectorAll('.tcb')) b.classList.remove('gone');
      document.getElementById('killfeed').innerHTML = '<div class="kf">Joueur<i>M4A1</i>Bot Alpha</div><div class="kf">Bot<i>M9</i>Bot Bravo</div>';
      document.getElementById('msg').textContent = 'Message de test'; document.getElementById('msg').classList.add('show');
      document.getElementById('hp').style.opacity = 1;
    });
    for (const [auto, dbl] of [[true, true], [true, false], [false, false]]) {
      await page.evaluate(([a, d]) => { Settings.tcAuto = a; Settings.tcDblAds = d; touchModeSync(); }, [auto, dbl]);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const box = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
        const btn = [...document.querySelectorAll('.tcb')].map((e) => ({ id: e.dataset.tc, ...box(e) })).filter((b) => b.right - b.left > 1);
        const hud = ['.mm', '.score', '.ammo', '#killfeed', '#hp', '#msg', '#hitmarker', '#tcStick i'].map((s) => ({ id: s, ...box(document.querySelector(s)) }));
        return { btn, hud, w: innerWidth, h: innerHeight, u: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) };
      });
      const bad = [];
      for (let i = 0; i < r.btn.length; i++) {
        const a = r.btn[i];
        if (a.left < 0 || a.top < 0 || a.right > r.w || a.bottom > r.h) bad.push(`${a.id} hors de l'écran`);
        for (let j = i + 1; j < r.btn.length; j++) if (inter(a, r.btn[j])) bad.push(`${a.id} / ${r.btn[j].id}`);
        for (const e of r.hud) if (e.id !== '#hitmarker' && inter(a, e)) bad.push(`${a.id} / ${e.id}`);
      }
      for (let i = 0; i < r.hud.length; i++) for (let j = i + 1; j < r.hud.length; j++) { const a = r.hud[i], b = r.hud[j]; if (a.id === '#tcStick i' || b.id === '#tcStick i' || a.id === '#hitmarker' || b.id === '#hitmarker' || a.id === '#msg' || b.id === '#msg') continue; if (inter(a, b)) bad.push(`${a.id} / ${b.id}`); }
      const want = 15 - (auto ? 1 : 0) - (dbl ? 1 : 0), mode = dbl ? 'tir automatique et double toucher' : auto ? 'tir automatique' : 'tir manuel';
      ok(r.btn.length === want && bad.length === 0, `${w}x${h}, ${mode} : aucun recouvrement (${r.btn.length} boutons visibles sur ${want}, trois sont retirés par la disposition d'origine${auto ? ', pas de bouton de tir' : ''}${dbl ? ', pas de bouton Viser' : ''})${bad.length ? ' : ' + bad.join(', ') : ''}`);
      if (dbl) ok(await page.evaluate(() => getComputedStyle(TC.el.ads).display === 'none'), `${w}x${h}, double toucher : pas de bouton Viser`);
      if (dbl) { // places de la disposition : à la même distance des bords que sur un téléphone de 100 u de haut (au plus 222 u de large), quelle que soit la taille de l'écran
        const q = await page.evaluate(() => {
          const W = innerWidth, H = innerHeight, Hb = Math.min(H, 560), Wb = H > 560 ? Math.min(W, 1244) : W, u = TOUCH.R / 12.5, bad = [];
          for (const [id, L] of Object.entries(TC.lay)) {
            const e = TC.el[id]; if (!e || L[3] || (id !== 'stick' && !e.classList.contains('ov'))) continue;
            const r = (id === 'stick' ? e.firstChild : e).getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            if (r.width < 1) continue;
            if (L[1] >= 0.4 && Math.abs(H - cy - (1 - L[1]) * Hb) > 1.5) bad.push(`${id} à ${((H - cy) / u).toFixed(1)} u du bas au lieu de ${((1 - L[1]) * Hb / u).toFixed(1)}`);
            if (L[0] >= 0.6 && Math.abs(W - cx - (1 - L[0]) * Wb) > 1.5) bad.push(`${id} à ${((W - cx) / u).toFixed(1)} u de la droite au lieu de ${((1 - L[0]) * Wb / u).toFixed(1)}`);
            if (L[0] <= 0.4 && Math.abs(cx - L[0] * Wb) > 1.5) bad.push(`${id} à ${(cx / u).toFixed(1)} u de la gauche au lieu de ${(L[0] * Wb / u).toFixed(1)}`);
          }
          // aller et retour (joystick flottant, glisser en édition) : la fraction de touchFrac remet le cercle sous le doigt, partout sur l'écran
          for (const [fx, fy] of [[0.1, 0.9], [0.3, 0.25], [0.45, 0.33], [0.5, 0.5], [0.58, 0.15], [0.9, 0.6]]) {
            const X = fx * W, Y = fy * H; TC.el.stick.style.setProperty('--fx', touchFrac(X, 'x')); TC.el.stick.style.setProperty('--fy', touchFrac(Y, 'y'));
            const g = touchStickGeom(); if (Math.abs(g.cx - X) > 1 || Math.abs(g.cy - Y) > 1) bad.push(`joystick posé en ${Math.round(X)}, ${Math.round(Y)} mais dessiné en ${Math.round(g.cx)}, ${Math.round(g.cy)}`);
          }
          touchLayoutOne('stick'); // (sa place d'origine)
          const n = TC.el.nade.getBoundingClientRect();
          return { bad, nade: (H - n.top - n.height / 2) / u };
        });
        ok(q.bad.length === 0, `${w}x${h}, disposition à la même distance des bords que sur téléphone (grenade à ${q.nade.toFixed(1)} u du bas)${q.bad.length ? ' : ' + q.bad.join(', ') : ''}`);
      }
      if (auto && !dbl) {
        const q = await page.evaluate(() => { const a = TC.el.ads.getBoundingClientRect(), F = TC.lay.fire; return { fire: getComputedStyle(TC.el.fire).display, fireL: getComputedStyle(TC.el.fireL).display, ax: touchFrac(a.left + a.width / 2, 'x'), ay: touchFrac(a.top + a.height / 2, 'y'), as: a.height / (TOUCH.R / 12.5), F }; });
        ok(q.fire === 'none' && q.fireL === 'none' && Math.abs(q.ax - q.F[0]) < 0.01 && Math.abs(q.ay - q.F[1]) < 0.01 && Math.abs(q.as - q.F[2]) < 0.6, `${w}x${h}, tir automatique : pas de bouton de tir, la visée à sa place et à sa taille (${q.as.toFixed(1)} u)`);
      }
      if (out) await page.screenshot({ path: path.join(out, `t-${w}x${h}-${dbl ? 'defaut' : auto ? 'auto' : 'manuel'}.png`) });
    }

    await g.browser.close();
  }

  // 2. jeu au doigt (tir manuel : bouton de tir ; visée au bouton)
  const g = await start(915, 412, 1, false, false), { page } = g;
  const P = (e) => page.evaluate(e);
  ok(await P('TOUCH.on === true && document.body.classList.contains("touch")'), 'contrôles tactiles actifs, classe body.touch');
  ok(await P('pointerActive()'), 'pointerActive() vrai (pas de capture de la souris)');
  // joystick fixe : le centre de son cercle ne bouge pas, l'écart du doigt dit la marche ou la course
  await P("Settings.tcStick = 'fixed'"); await page.waitForTimeout(300);
  const G = await P('touchStickGeom()'); const sx0 = G.cx, sy0 = G.cy, R = G.R;
  await touch(g, 'touchStart', [[sx0 + 8, sy0, 1]]);
  let s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(Math.abs(s.mz) < 0.2, `doigt posé près du centre : presque immobile (mz ${s.mz.toFixed(2)})`);
  await touch(g, 'touchMove', [[sx0, sy0 - R * 0.55, 1]]);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})');
  ok(s.mz > 0.2 && s.mz < 0.9 && !s.sprint, `joystick à demi poussé : marche proportionnelle (mz ${s.mz.toFixed(2)})`);
  await touch(g, 'touchMove', [[sx0, sy0 - R * 1.0, 1]]);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(s.mz > 0.95 && !s.sprint, `au bord du cercle : pleine marche, pas de course (mz ${s.mz.toFixed(2)})`);
  await touch(g, 'touchMove', [[sx0, sy0 - R * 1.3, 1]]);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(s.sprint, 'doigt au-delà du cercle : course');
  ok(await P('TC.el.stick.classList.contains("run")'), 'joystick : la course se voit (anneau jaune)');
  const G2 = await P('touchStickGeom()'); ok(Math.abs(G2.cx - sx0) < 0.5 && Math.abs(G2.cy - sy0) < 0.5, 'le joystick ne suit pas le doigt : centre inchangé');
  await touch(g, 'touchMove', [[sx0, sy0 - R * 0.7, 1]]);
  s = await P('({sprint: TOUCH.sprint})'); ok(!s.sprint, 'doigt revenu dans le cercle : retour à la marche');
  await touch(g, 'touchMove', [[sx0 + R * 1.3, sy0, 1]]); s = await P('({sprint: TOUCH.sprint, mx: TOUCH.mx})'); ok(!s.sprint && s.mx > 0.9, 'poussé loin sur le côté : pas de course, il se déplace en crabe');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(200);
  s = await P('({sprint: TOUCH.sprint, mz: TOUCH.mz})'); ok(!s.sprint && s.mz === 0, 'joystick relâché : arrêt');
  // réglage « bouton Courir » : le joystick ne lance plus la course ; le bouton la verrouille tant qu'on avance
  await P("Settings.tcRun = 'button'; TC.el.run.classList.remove('off')"); await page.waitForTimeout(300);
  await touch(g, 'touchStart', [[sx0, sy0, 1]]); await touch(g, 'touchMove', [[sx0, sy0 - R * 1.4, 1]]);
  s = await P('({sprint: TOUCH.sprint})'); ok(!s.sprint, 'réglage bouton : pousser le joystick ne fait pas courir');
  const [kx, ky] = await center(g, '[data-tc=run]'); await touch(g, 'touchStart', [[sx0, sy0 - R * 1.4, 1], [kx, ky, 9]]); await touch(g, 'touchEnd', [[kx, ky, 9]]);
  ok(await until(g, 'TOUCH.sprint === true && TC.runOn'), 'bouton Courir : sprint tant que le joystick avance');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(200);
  s = await P('({sprint: TOUCH.sprint, on: TC.runOn})'); ok(!s.sprint && !s.on, 'joystick relâché : la course s\'arrête');
  await P("Settings.tcRun = 'stick'; TC.el.run.classList.add('off')");
  // joystick flottant (réglage par défaut) : rien à l'écran, il apparaît sous le doigt, n'en suit pas le glissement et disparaît au relâchement
  await P("Settings.tcStick = 'float'"); await page.waitForTimeout(400);
  ok(await until(g, 'TC.root.classList.contains("float") && getComputedStyle(TC.el.stick).opacity === "0"'), 'joystick flottant : rien à l\'écran tant qu\'on ne touche pas');
  await touch(g, 'touchStart', [[300, 170, 1]]);
  ok(await until(g, 'TC.el.stick.classList.contains("on")'), 'joystick flottant : il apparaît sous le doigt');
  const F = await P('touchStickGeom()'); ok(Math.abs(F.cx - 300) < 1 && Math.abs(F.cy - 170) < 1, `joystick flottant : centré sur le doigt (${Math.round(F.cx)}, ${Math.round(F.cy)})`);
  await touch(g, 'touchMove', [[300, 170 - F.R * 0.6, 1]]); await touch(g, 'touchMove', [[300 + F.R * 0.3, 170 - F.R * 1.4, 1]]);
  s = await P('({ mz: TOUCH.mz, sprint: TOUCH.sprint })'); ok(s.mz > 0.9 && s.sprint, 'joystick flottant : le doigt qui glisse au-delà du cercle fait courir');
  const F2 = await P('touchStickGeom()'); ok(Math.abs(F2.cx - 300) < 1 && Math.abs(F2.cy - 170) < 1, 'joystick flottant : il reste là où le doigt s\'est posé');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(300);
  ok(await P('!TC.el.stick.classList.contains("on") && TOUCH.mz === 0 && !TOUCH.sprint'), 'joystick flottant : il disparaît quand le doigt se lève');
  await touch(g, 'touchStart', [[700, 200, 2]]); ok(await P('!TC.el.stick.classList.contains("on") && !!TC.look'), 'moitié droite : le regard, pas de joystick');
  await touch(g, 'touchEnd', []);
  await touch(g, 'touchStart', [[sx0, sy0, 1]]); await touch(g, 'touchMove', [[sx0, sy0 - R * 0.9, 1]]);
  const z0 = await P('PL.ent.pos.z + "," + PL.ent.pos.x');
  const adv = await until(g, `PL.ent.pos.z + "," + PL.ent.pos.x !== ${JSON.stringify(z0)}`); ok(adv, 'le joueur avance avec le joystick');
  if (!adv) console.log('  état :', JSON.stringify(await P('({mz: TOUCH.mz, move: !!TC.move, sprint: TOUCH.sprint, st: MATCH.state, alive: PL.ent.alive, busy: typeof busy === "function" ? busy() : null, pos: [PL.ent.pos.x, PL.ent.pos.z], fps: DYN.stat.fps})')));
  await touch(g, 'touchEnd', []);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(s.mx === 0 && s.mz === 0 && !s.sprint, 'joystick relâché : arrêt');
  // regard
  const yaw0 = await P('PL.yaw');
  await touch(g, 'touchStart', [[620, 200, 2]]); for (let i = 1; i <= 6; i++) await touch(g, 'touchMove', [[620 + i * 12, 200 + i * 3, 2]]); await touch(g, 'touchEnd', []);
  await until(g, `Math.abs(PL.yaw - ${yaw0}) > 0.02`);
  const yaw1 = await P('PL.yaw'); ok(Math.abs(yaw1 - yaw0) > 0.02, `glisser à droite fait tourner la vue (${(yaw1 - yaw0).toFixed(3)} rad)`);
  // tir
  const [fx, fy] = await center(g, '[data-tc=fire]'); const mag0 = await P('curW().mag');
  await touch(g, 'touchStart', [[fx, fy, 3]]);
  ok(await P('PL.held'), 'bouton de tir : gâchette tenue'); await until(g, `curW().mag < ${mag0}`); await touch(g, 'touchEnd', []);
  ok(!(await P('PL.held')), 'bouton de tir relâché : gâchette lâchée'); ok((await P('curW().mag')) < mag0, `des balles sont parties (${mag0} -> ${await P('curW().mag')})`);
  // tir : le doigt qui tire peut glisser pour regarder, sans lâcher la gâchette
  const yawF = await P('PL.yaw');
  await touch(g, 'touchStart', [[fx, fy, 3]]); for (let i = 1; i <= 6; i++) await touch(g, 'touchMove', [[fx - i * 14, fy + i * 2, 3]]);
  ok(await P('PL.held'), 'doigt qui glisse sur le bouton de tir : gâchette toujours tenue');
  ok(await until(g, `Math.abs(PL.yaw - ${yawF}) > 0.02`), 'doigt qui glisse sur le bouton de tir : la vue tourne');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(100); ok(!(await P('PL.held')), 'bouton de tir relâché après le glissement');
  // visée : appui bref épaule, un autre range ; appui long tient le temps du doigt
  const [ax, ay] = await center(g, '[data-tc=ads]');
  await P(`window.__ev = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) document.querySelector('[data-tc=ads]').addEventListener(t, (e) => window.__ev.push([t, e.timeStamp | 0, performance.now() | 0, PL.adsWant]), true);`);
  // (les événements sont traités image par image : on attend l'effet plutôt que de le lire aussitôt)
  await touch(g, 'touchStart', [[ax, ay, 4]]); await touch(g, 'touchEnd', []); await page.waitForTimeout(1500); ok(await P('PL.adsWant'), 'appui bref sur viser : épaulé');
  await touch(g, 'touchStart', [[ax, ay, 4]]); await touch(g, 'touchEnd', []); ok(await until(g, '!PL.adsWant'), 'second appui : rangé');
  await touch(g, 'touchStart', [[ax, ay, 4]]); await page.waitForTimeout(1500); ok(await P('PL.adsWant'), 'appui long : visée tenue');
  await touch(g, 'touchEnd', [], 0.6); const rel = await until(g, '!PL.adsWant', 8000); ok(rel, 'appui long relâché : rangé');
  if (!rel) console.log('  événements :', JSON.stringify(await P('window.__ev')), JSON.stringify(await P('({ads: PL.adsWant, tc: TC.ads, now: performance.now() | 0})')));
  // saut
  const [jx, jy] = await center(g, '[data-tc=jump]'); await touch(g, 'touchStart', [[jx, jy, 5]]); ok(await P('KEYS.Space'), 'bouton de saut tenu'); await touch(g, 'touchEnd', []); ok(!(await P('KEYS.Space')), 'saut relâché');
  // recharge, arme
  const [rx, ry] = await center(g, '[data-tc=reload]'); await touch(g, 'touchStart', [[rx, ry, 6]]); await touch(g, 'touchEnd', []); ok(await until(g, '!!PL.reload'), 'bouton de recharge : rechargement lancé');
  await until(g, '!PL.reload');
  const cur0 = await P('PL.cur'); const [sx, sy] = await center(g, '[data-tc=swap]'); await touch(g, 'touchStart', [[sx, sy, 7]]); await touch(g, 'touchEnd', []);
  ok(await until(g, `PL.cur !== ${cur0}`), "bouton de changement d'arme");
  // couteau : un appui bref donne un coup, un appui maintenu sort le couteau, le bouton de changement d'arme le range
  await until(g, 'PL.switching <= 0');
  const [kbx, kby] = await center(g, "[data-tc=knife]");
  await touch(g, 'touchStart', [[kbx, kby, 9]]); await touch(g, 'touchEnd', []); ok(await until(g, 'PL.knifeT > 0 && !PL.knifeOut'), 'bouton couteau, appui bref : un coup, le couteau ne reste pas en main');
  await until(g, 'PL.knifeT <= 0');
  await touch(g, 'touchStart', [[kbx, kby, 9]]); ok(await until(g, 'PL.knifeOut', 20000), 'bouton couteau maintenu : le couteau est en main'); await touch(g, 'touchEnd', []);
  await page.waitForTimeout(300); ok(await P('PL.knifeOut && PL.knifeT <= 0'), 'bouton couteau relâché : le couteau reste en main, sans coup de plus');
  await touch(g, 'touchStart', [[sx, sy, 7]]); await touch(g, 'touchEnd', []); ok(await until(g, '!PL.knifeOut'), "bouton de changement d'arme : le couteau est rangé");
  await until(g, 'PL.switching <= 0 && VM.lower < 0.05', 30000);
  // plusieurs doigts : joystick + regard + tir en même temps
  await touch(g, 'touchStart', [[150, 300, 1], [620, 200, 2], [fx, fy, 3]]); await touch(g, 'touchMove', [[150, 240, 1], [660, 210, 2], [fx, fy, 3]]);
  s = await P('({mz: TOUCH.mz, held: PL.held})'); ok(s.mz > 0.5 && s.held, 'joystick, regard et tir à trois doigts');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(100);
  s = await P('({mz: TOUCH.mz, held: PL.held})'); ok(s.mz === 0 && !s.held, 'tous les doigts levés : tout est relâché');
  if (out) await page.screenshot({ path: path.join(out, 't-jeu.png') });
  // pause au toucher
  const [px, py] = await center(g, '[data-tc=pause]'); await touch(g, 'touchStart', [[px, py, 8]]); await touch(g, 'touchEnd', []); await page.waitForTimeout(300);
  ok((await P('MATCH.state')) === 'paused', 'bouton pause : menu pause');
  ok(await P('document.getElementById("touch").classList.contains("hidden")'), 'commandes tactiles cachées pendant la pause');
  if (out) await page.screenshot({ path: path.join(out, 't-pause.png') });
  // options en pause : la liste doit s'afficher (elle avait une hauteur nulle sur téléphone)
  await P("document.querySelector('[data-pm=options]').click()"); await page.waitForTimeout(300);
  const ob = await P("(() => { const r = document.querySelector('#optPause .orows').getBoundingClientRect(); return { h: r.height, n: document.querySelectorAll('#optPause .orow').length, tool: [...document.querySelectorAll('#optPause .orow')].some((e) => /Disposition|layout/i.test(e.textContent)) }; })()");
  ok(ob.h > 100 && ob.n >= 5 && ob.tool, `options en pause : ${ob.n} réglages affichés sur ${Math.round(ob.h)} px, dont la disposition des commandes`);
  if (out) await page.screenshot({ path: path.join(out, 't-pause-options.png') });
  // disposition : ouvrir depuis la pause, déplacer, agrandir, retirer, partager, réinitialiser
  await P("[...document.querySelectorAll('#optPause .orow button')].find((b) => /Disposition|layout/i.test(b.textContent)).click()"); await page.waitForTimeout(300);
  ok(await P('TC.edit && !document.getElementById("pause").classList.contains("show") && !document.getElementById("touch").classList.contains("hidden")'), 'édition de la disposition : les commandes s\'affichent, le menu pause s\'efface');
  ok(await P('[...document.querySelectorAll(".tcb")].every((b) => b.getBoundingClientRect().width > 0)'), 'édition : tous les boutons sont visibles, même les contextuels');
  const [ex, ey] = await center(g, '[data-tc=knife]'); const R0 = await P('JSON.stringify(document.querySelector("[data-tc=knife]").getBoundingClientRect())');
  await touch(g, 'touchStart', [[ex, ey, 1]]); await touch(g, 'touchMove', [[ex - 150, ey - 60, 1]]); await touch(g, 'touchMove', [[ex - 300, ey - 120, 1]]); await touch(g, 'touchEnd', []);
  const moved = await P('(() => { const r = document.querySelector("[data-tc=knife]").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, lay: Settings.tcLay && Settings.tcLay.knife, saved: JSON.parse(localStorage.getItem("dc_settings")).tcLay }; })()');
  ok(Math.abs(moved.x - (ex - 300)) < 6 && Math.abs(moved.y - (ey - 120)) < 6 && moved.lay && moved.saved && moved.saved.knife, `bouton glissé à sa nouvelle place (${Math.round(moved.x)}, ${Math.round(moved.y)}) et enregistré`);
  // le joystick : flottant, seule sa taille se règle (sa place est celle du doigt) ; fixe, il se déplace aussi
  const gf0 = await P('touchStickGeom()'); await touch(g, 'touchStart', [[gf0.cx, gf0.cy, 1]]); await touch(g, 'touchMove', [[gf0.cx + 90, gf0.cy - 60, 1]]); await touch(g, 'touchEnd', []);
  const gf1 = await P('touchStickGeom()'); ok(Math.abs(gf1.cx - gf0.cx) < 1 && Math.abs(gf1.cy - gf0.cy) < 1, 'joystick flottant : il ne se déplace pas dans l\'éditeur (il apparaît sous le doigt)');
  await P("Settings.tcStick = 'fixed'; TC.root.classList.remove('float')");
  const gs0 = await P('touchStickGeom()'); await touch(g, 'touchStart', [[gs0.cx, gs0.cy, 1]]); await touch(g, 'touchMove', [[gs0.cx + 60, gs0.cy - 40, 1]]); await touch(g, 'touchMove', [[gs0.cx + 120, gs0.cy - 80, 1]]); await touch(g, 'touchEnd', []);
  const gs1 = await P('touchStickGeom()'); ok(Math.abs(gs1.cx - (gs0.cx + 120)) < 6 && Math.abs(gs1.cy - (gs0.cy - 80)) < 6 && await P('!!Settings.tcLay.stick'), `joystick glissé à sa nouvelle place (${Math.round(gs1.cx)}, ${Math.round(gs1.cy)}) et enregistré`);
  await P("Settings.tcStick = 'float'; TC.root.classList.add('float')");
  await P("TC.el.ed.querySelector('[data-ed=reset]').click()"); const gs2 = await P('touchStickGeom()'); ok(Math.abs(gs2.cx - gs0.cx) < 1 && Math.abs(gs2.cy - gs0.cy) < 1, 'réinitialiser : le joystick revient à sa place d\'origine');
  await touch(g, 'touchStart', [[ex, ey, 1]]); await touch(g, 'touchMove', [[ex - 150, ey - 60, 1]]); await touch(g, 'touchMove', [[ex - 300, ey - 120, 1]]); await touch(g, 'touchEnd', []);
  await P("TC.el.ed.querySelector('[data-ed=plus]').click(); TC.el.ed.querySelector('[data-ed=plus]').click()");
  const sz = await P('Settings.tcLay.knife[2]'); ok(sz === 12, `bouton agrandi (${sz} u)`);
  await P("TC.el.ed.querySelector('[data-ed=toggle]').click()");
  ok(await P('TC.el.knife.classList.contains("off") && Settings.tcLay.knife[3] === 1'), 'bouton retiré : il reste visible en édition (estompé)');
  await P("TC.el.ed.querySelector('[data-ed=share]').click()");
  const js = await P('TC.el.ed.querySelector("textarea").value'); ok(/"v":1/.test(js) && /"knife"/.test(js), 'partage : la disposition est donnée en texte');
  await P("TC.el.ed.querySelector('[data-ed=done]').click()"); await page.waitForTimeout(200);
  ok(await P('!TC.edit && document.getElementById("pause").classList.contains("show") && document.getElementById("touch").classList.contains("hidden")'), 'fin de l\'édition : retour au menu pause, commandes cachées');
  await page.evaluate(() => resumeGame()); await page.waitForTimeout(500);
  ok(await P('getComputedStyle(TC.el.knife).display === "none"'), 'en partie, le bouton retiré n\'apparaît pas');
  const kn = await until(g, 'TC.show && TC.el.fire.getBoundingClientRect().width > 0'); ok(kn, 'les autres boutons restent à leur place');
  // texte importé : disposition rétablie puis réinitialisation
  const imp = await P(`(() => { const r = touchLayoutImport(${JSON.stringify(js)}); return { r, knife: Settings.tcLay && Settings.tcLay.knife }; })()`);
  ok(imp.r && !!imp.knife, 'texte de disposition réimporté'); if (!(imp.r && imp.knife)) console.log('  import :', JSON.stringify(imp), js.slice(0, 200));
  ok(await P('!touchLayoutImport("{pas du json") && !touchLayoutImport(JSON.stringify({v:1,b:{nimporte:[0.5,0.5,10,0]}}))'), 'texte invalide refusé');
  await P('Settings.tcLay = null; touchLayoutApply(); saveSettings()');
  await P('pauseGame()'); await page.waitForTimeout(200); await page.evaluate(() => resumeGame()); await page.waitForTimeout(300);
  // tir automatique (réglage par défaut au doigt) : plus de bouton de tir, la visée à sa place ; un pistolet tire coup sur coup sur un ennemi devant soi
  await P('Settings.tcAuto = true');
  ok(await until(g, 'TC.root.classList.contains("auto") && getComputedStyle(TC.el.fire).display === "none" && getComputedStyle(TC.el.ads).display !== "none"'), 'tir automatique : le bouton de tir laisse sa place à la visée');
  await P('switchWeapon(1)');
  ok(await until(g, '!curW().def.auto && PL.ent.arms.switching <= 0'), 'arme semi-automatique en main');
  const tg = await P(`(() => {
    const p = PL.ent.pos, b = entities.find((e) => !e.isPlayer && e.alive && !allied(e, PL.ent)); let yaw = null;
    for (let k = 0; k < 16 && yaw === null; k++) { const a = k * Math.PI / 8; if (!rayWorld(p.x, p.y + 1.5, p.z, -Math.sin(a), 0, -Math.cos(a), 9)) yaw = a; }
    if (yaw === null || !b) return null;
    // l'ennemi reste à 6 m devant le joueur, en vie ; le joueur le regarde et ne craint rien
    window.__hold = setInterval(() => { const q = PL.ent.pos; b.alive = true; b.health = 100; b.pos.set(q.x - Math.sin(yaw) * 6, q.y, q.z - Math.cos(yaw) * 6); if (b.vel) b.vel.set(0, 0, 0); PL.yaw = yaw; PL.pitch = -0.04; PL.ent.protT = 1e9; PL.ent.health = 100; }, 30);
    return { mag: curW().mag, w: curW().def.id };
  })()`);
  ok(!!tg, 'un ennemi placé devant le joueur');
  if (tg) {
    const shot = await until(g, `curW().mag <= ${tg.mag - 3}`, 120000);
    ok(shot, `tir automatique, arme semi-automatique (${tg.w}) : elle tire coup sur coup tant que l'ennemi est dans le réticule (${tg.mag} -> ${await P('curW().mag')})`);
    await P('clearInterval(window.__hold)');
  }
  await P('Settings.tcAuto = false');
  // double toucher pour viser (réglage par défaut) : pas de bouton Viser ; deux touchers brefs épaulent, deux autres rangent ; un toucher seul ou un regard, non
  await P('Settings.tcDblAds = true; PL.adsWant = false');
  ok(await until(g, 'TC.root.classList.contains("dbl") && getComputedStyle(TC.el.ads).display === "none"'), 'double toucher : le bouton Viser disparaît');
  // horodatages imposés (le rendu logiciel espace les événements bien plus que ne le ferait un doigt)
  const taps = async (list) => { for (const [type, x, y, dt] of list) { const p = type === 'touchEnd' ? [] : [{ x, y, id: 5 }]; tt += dt; await g.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p, timestamp: tt }); } };
  let tt = Date.now() / 1000;
  await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06], ['touchStart', 704, 163, 0.12], ['touchEnd', 704, 163, 0.06]]);
  ok(await until(g, 'PL.adsWant === true'), 'deux touchers brefs : épaulé');
  tt += 1; await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06]]); await page.waitForTimeout(300);
  ok(await P('PL.adsWant === true'), 'un toucher seul : rien ne change');
  tt += 1; await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06], ['touchStart', 702, 158, 0.12], ['touchEnd', 702, 158, 0.06]]);
  ok(await until(g, 'PL.adsWant === false'), 'deux autres touchers brefs : arme rangée');
  tt += 1; await taps([['touchStart', 650, 160, 0], ['touchMove', 700, 170, 0.05], ['touchEnd', 700, 170, 0.05], ['touchStart', 700, 170, 0.1], ['touchEnd', 700, 170, 0.05]]); await page.waitForTimeout(300);
  ok(await P('PL.adsWant === false'), 'un regard suivi d\'un toucher : pas de visée');
  // un bouton d'action (recharger) fait quitter la visée : à la fin du rechargement, on ne revient pas en visée
  tt += 1; await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06], ['touchStart', 703, 161, 0.12], ['touchEnd', 703, 161, 0.06]]);
  await until(g, 'PL.adsWant === true');
  const rb = await P('(() => { const r = TC.el.reload.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()');
  await P('curW().mag = 1');
  tt += 1; await taps([['touchStart', rb[0], rb[1], 0], ['touchEnd', rb[0], rb[1], 0.08]]);
  ok(await until(g, 'PL.adsWant === false'), 'recharger en visée : la visée est quittée');
  // le rendu logiciel est lent : on attend la fin réelle du rechargement (chargeur plein) puis que l'arme soit redescendue, plutôt qu'un délai fixe
  const reloaded = await until(g, 'curW().mag > 1', 60000);
  await page.waitForTimeout(400);
  ok(reloaded && await P('PL.adsWant === false') && await until(g, 'VM.ads < 0.05', 20000), 'fin du rechargement : toujours hors visée');
  await P('Settings.tcDblAds = false; PL.adsWant = false');
  // mort au doigt : la carte (invite « Touchez », dans l'écran, sans bouton par-dessus : les commandes s'effacent), un toucher fait réapparaître ;
  // killcam : invite « Touchez », un toucher la passe et fait réapparaître
  await P("PL.ent.protT = 0; killEnt(PL.ent, PL.ent, 'M4A1', false, new V3(0, 0, 1))");
  ok(await until(g, 'TC.dead && PL.deathT > 0.4', 60000), 'mort : les commandes tactiles s\'effacent');
  const dc = await P(`(() => { const b = document.querySelector('#death .box').getBoundingClientRect(), sk = document.querySelector('#death .skip').textContent, vis = [...document.querySelectorAll('.tcb')].filter((e) => e.getBoundingClientRect().width > 0).length; return { sk, vis, inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }; })()`);
  ok(dc.inside && /Touchez/.test(dc.sk) && dc.vis === 0, `mort : carte dans l'écran, invite au doigt, aucun bouton par-dessus ${JSON.stringify(dc)}`);
  if (out) await page.screenshot({ path: path.join(out, 't-mort.png') });
  await touch(g, 'touchStart', [[700, 200, 3]]); await touch(g, 'touchEnd', []);
  ok(await until(g, 'PL.ent.alive && !document.getElementById("death").classList.contains("show")', 30000), 'mort : un toucher fait réapparaître');
  await until(g, 'KC.count >= 14', 60000);
  const kc0 = await P(`(() => { const b = entities.find((e) => !e.isPlayer && !allied(e, PL.ent) && e.alive && e.model); return !!b && startKillcam({ killer: b, victim: PL.ent, tEnd: MATCH.time - 0.3, info: killInfo(b, PL.ent, 'AK-47') }); })()`);
  ok(kc0 && await until(g, 'TC.dead', 30000) && /Touchez/.test(await P("document.getElementById('kcSkip').textContent")), 'killcam : invite au doigt');
  if (out) await page.screenshot({ path: path.join(out, 't-killcam.png') });
  await touch(g, 'touchStart', [[700, 200, 3]]); await touch(g, 'touchEnd', []);
  ok(await until(g, '!KC.active && PL.ent.alive && MATCH.state === "playing"', 30000), 'killcam : un toucher la passe et fait réapparaître');
  // page en arrière-plan : pause automatique
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok((await P('MATCH.state')) === 'paused', 'page en arrière-plan : pause automatique');
  await g.browser.close();

  // 3. portrait : demander de tourner le téléphone
  const q = await openGame({ mobile: true, w: 412, h: 915, settings: { quality: 'low', lang: 'fr', touch: 'on' }, noHdri: true, noMap: true });
  ok(await q.page.evaluate('getComputedStyle(document.getElementById("rotate")).display !== "none"'), 'portrait : écran « Tournez votre appareil »');
  if (out) await q.page.screenshot({ path: path.join(out, 't-portrait.png') });
  await q.browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
