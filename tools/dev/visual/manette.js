/* Contrôle de la manette : node tools/dev/visual/manette.js [dossier de captures]
   Simule une manette Xbox (navigator.getGamepads) dans le jeu : navigation des menus (croix, A, B, onglets), lancement d'une partie, puis déplacement, sprint (L3),
   regard (courbes de réponse, accélération), tir (RT, qui arrête le sprint), visée (LT), saut, accroupi, recharge (X bref) et ramassage d'une arme au sol (X maintenu), changement d'arme, grenade, pause (Menu), disposition gaucher ; la barre d'invites (#padHints) de la pause
   et des résultats (glyphes, rien de recouvert, focus sur « Rejouer »). Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('ECHEC :', msg); } else console.log('ok    :', msg); };
const until = (page, cond, ms) => page.waitForFunction(cond, null, { timeout: ms || 90000, polling: 100 }).then(() => true, () => false);

(async () => {
  const g = await openGame({ w: 800, h: 450, settings: { quality: 'low', lang: 'fr', map: 'sable' }, noHdri: true, init: `
    window.__pad = { id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', index: 0, axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
    navigator.getGamepads = () => [window.__pad];
    window.__set = (axes, btns) => { const p = window.__pad; if (axes) p.axes = axes; for (const k in (btns||{})) { const v = btns[k]; p.buttons[k] = { pressed: v > 0.5, value: v }; } };` });
  const { page } = g;
  const set = (axes, btns) => page.evaluate(([a, b]) => window.__set(a, b), [axes, btns]);
  // le rendu logiciel est lent (quelques images par seconde) : un appui doit durer plusieurs images pour être vu, et on attend des conditions plutôt que des durées
  const frames = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const tap = async (i) => { await set(null, { [i]: 1 }); await frames(4); await set(null, { [i]: 0 }); await frames(4); };
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad })));
  ok(await page.evaluate(() => PAD.seen), 'manette détectée');
  // menus : A sur le premier bouton, croix bas, B
  await tap(13); await frames(2);
  ok(await page.evaluate(() => PAD.drive && document.body.classList.contains('padnav')), 'la manette a la main dans les menus');
  await tap(13); await frames(2);
  const f1 = await page.evaluate(() => document.activeElement && document.activeElement.className);
  ok(!!f1 && f1.includes('mbtn'), 'croix bas : le focus avance dans le menu principal (' + f1 + ')');
  // Options (onglets, une rangée par réglage) : la rangée est l'unité ; haut et bas passent d'une rangée à l'autre, gauche et droite règlent, A bascule, LB et RB changent d'onglet
  await page.evaluate(() => { UI.stack = ['main']; uiGo('options', true); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const a = document.activeElement; return !!a && a.getAttribute('role') === 'tab' && a.getAttribute('aria-selected') === 'true'; }), 'Options : le focus arrive sur l\'onglet ouvert');
  await tap(5); await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.querySelectorAll('#optMenu .tabs button')[1].getAttribute('aria-selected') === 'true'), 'RB : onglet suivant');
  await tap(4); await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.querySelectorAll('#optMenu .tabs button')[0].getAttribute('aria-selected') === 'true'), 'LB : onglet précédent');
  await tap(13); await page.waitForTimeout(100);
  ok(await page.evaluate(() => document.activeElement.classList.contains('onav')), 'bas : le focus passe sur la première rangée de réglage');
  // curseur : la rangée de la sensibilité de la manette, droite augmente, gauche diminue
  await page.evaluate(() => { [...document.querySelectorAll('#optMenu .onav')].find((r) => /sensibilit.* manette|controller sens/i.test(r.textContent)).focus(); });
  const s0 = await page.evaluate(() => Settings.padSens); await tap(15);
  ok((await page.evaluate(() => Settings.padSens)) > s0, 'croix droite : règle le curseur de sensibilité');
  await tap(14);
  ok((await page.evaluate(() => Settings.padSens)) <= s0 + 1e-9, 'croix gauche : le diminue');
  ok(await page.evaluate(() => !document.getElementById('padHints').classList.contains('hidden') && /Régler/.test(document.getElementById('padHints').textContent)), 'bandeau d\'aide : Régler sur une rangée qu\'on règle');
  await tap(13); await tap(13); await tap(12); await tap(12);
  ok(await page.evaluate(() => document.activeElement.classList.contains('onav') && !!document.activeElement.closest('.orows')), 'haut et bas : le focus reste sur les rangées de réglages');
  // choix segmenté : A passe au choix suivant ; interrupteur : A bascule
  const sg0 = await page.evaluate(() => { [...document.querySelectorAll('#optMenu .onav')].find((r) => r.querySelector('.seg') && /tactile|touch/i.test(r.textContent)).focus(); return Settings.touch; });
  await tap(0);
  ok((await page.evaluate(() => Settings.touch)) !== sg0, 'A sur un choix segmenté : réglage changé');
  await page.evaluate(() => { Settings.touch = 'auto'; saveSettings(); touchDetect(); syncOptions(); });
  const iv0 = await page.evaluate(() => { [...document.querySelectorAll('#optMenu .onav')].find((r) => r.querySelector('input[type=checkbox]') && /vertical/i.test(r.textContent)).focus(); return Settings.invertY; });
  await tap(0);
  ok((await page.evaluate(() => Settings.invertY)) === !iv0, 'A sur un interrupteur : il bascule');
  await tap(0);
  if (out) await page.screenshot({ path: out + '/manette-options.png' });
  await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'main'), 'B : retour au menu principal');
  ok(await page.evaluate(() => { const a = document.activeElement; return !!a && document.getElementById('scr-main').contains(a); }), 'retour au menu principal : le focus revient tout seul dans l\'écran');
  // Solo, à la manière des anciens Call of Duty : le menu à gauche ; un sous-menu s'ouvre à droite (A ou droite), le menu s'assombrit ; gauche au bord ou B le referme
  await page.evaluate(() => { UI.stack = ['main']; uiGo('solo', true); }); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.activeElement.dataset.key === 'map'), 'Solo : le focus arrive sur la première rangée (Carte)');
  await tap(15); await page.waitForTimeout(300);
  ok(await page.evaluate(() => lmDepth(LM.scr.solo) === 1 && document.activeElement.classList.contains('lcard') && document.activeElement.classList.contains('on') && document.getElementById('scr-solo').classList.contains('lm-open')), 'droite sur Carte : le sous-menu des cartes s\'ouvre à droite, focus sur la carte choisie, menu assombri');
  const k0 = await page.evaluate(() => document.activeElement.dataset.key); await tap(15);
  const k1 = await page.evaluate(() => document.activeElement.dataset.key);
  ok(k1 !== k0 && (await page.evaluate(() => document.activeElement.classList.contains('lcard'))), 'droite dans la grille : la carte voisine');
  await tap(14); await page.waitForTimeout(100);
  ok((await page.evaluate(() => document.activeElement.dataset.key)) === k0, 'gauche : retour à la carte d\'avant');
  await tap(14); await page.waitForTimeout(300);
  ok(await page.evaluate(() => lmDepth(LM.scr.solo) === 0 && document.activeElement.dataset.key === 'map'), 'gauche au bord de la grille : le sous-menu se referme, focus sur Carte');
  await tap(0); await page.waitForTimeout(300); await tap(15); await tap(0); await page.waitForTimeout(400);
  ok(await page.evaluate((k) => lmDepth(LM.scr.solo) === 0 && document.activeElement.dataset.key === 'map' && Settings.map === k, k1), 'A sur une carte : la choisit, le sous-menu se referme, focus sur Carte');
  await page.evaluate((k) => { Settings.map = k; saveSettings(); }, k0);
  await tap(13); await tap(0); await page.waitForTimeout(300);
  ok(await page.evaluate(() => lmDepth(LM.scr.solo) === 1 && LM.scr.solo.stack[1].id === 'setup' && document.activeElement.dataset.key === 'mode'), 'A sur Paramètres de partie : le sous-menu s\'ouvre sur le mode');
  await page.evaluate(() => { document.querySelector('#soloPanel .lrow[data-key="time"]').focus(); });
  const m0 = await page.evaluate(() => Settings.minutes); await tap(15); await page.waitForTimeout(200);
  ok((await page.evaluate(() => Settings.minutes)) !== m0 && (await page.evaluate(() => document.activeElement.dataset.key)) === 'time', 'croix droite sur la durée : elle change et le focus reste sur la rangée');
  await tap(14); await page.waitForTimeout(200);
  ok((await page.evaluate(() => Settings.minutes)) === m0, 'croix gauche : revient');
  await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'solo' && lmDepth(LM.scr.solo) === 0 && document.activeElement.dataset.key === 'setup'), 'B : referme le sous-menu, focus sur Paramètres de partie');
  await tap(13); await tap(13); await tap(13);
  ok(await page.evaluate(() => document.activeElement.id === 'soloGo'), 'bas depuis la dernière rangée : le focus passe à « Lancer la partie »');
  await tap(12); await tap(12);
  // salon : Retour (B) est la seule sortie ; il ouvre « Quitter le salon ? » au milieu de l'écran, le focus sur « Rester dans le salon » ; B la referme, A sur « Quitter le salon » quitte
  await page.evaluate(() => {
    UI.stack = ['main']; uiGo('multi', false);
    Object.assign(NET, { role: 'host', joined: true, code: 'AB12C', me: 'me', phase: 'lobby', t0: performance.now(), hostSeen: performance.now() + 1e6 });
    NET.players.clear(); NET.players.set('me', { id: 'me', n: 'Soldat', t: 0, h: true, lv: 12 }); netRender({ fresh: true });
  });
  await page.waitForTimeout(300); await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'multi' && NET.role === 'host' && !document.getElementById('netLeave').classList.contains('hidden') && document.activeElement.id === 'nlStay'), 'salon, B : « Quitter le salon ? » s\'ouvre, focus sur « Rester dans le salon »');
  await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'multi' && NET.role === 'host' && document.getElementById('netLeave').classList.contains('hidden')), 'B de nouveau : la question se referme, on reste dans le salon');
  await tap(1); await page.waitForTimeout(300);
  const up = await page.evaluate(() => document.getElementById('nlQuit').getBoundingClientRect().bottom <= document.getElementById('nlStay').getBoundingClientRect().top); // boutons l'un sous l'autre sur écran court
  await tap(up ? 12 : 14); await tap(0); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'multi' && NET.role === 'off' && LM.scr.multi.stack[0].id === 'home'), 'A sur « Quitter le salon » : le salon est quitté, on reste sur l\'écran Multijoueur');
  await page.evaluate(() => { Settings.touch = 'auto'; saveSettings(); touchDetect(); UI.stack = ['main']; uiGo('main', false); }); await page.waitForTimeout(200);
  // curseur et survol : la manette a la main, la souris ne survole plus rien (pas de double surbrillance) ; un glissement de souris rend la main
  await tap(13); await frames(2);
  ok(await page.evaluate(() => { const b = document.querySelector('#scr-main .mbtn'), c = getComputedStyle(b); return PAD.drive && c.pointerEvents === 'none' && c.cursor === 'none'; }), 'manette active : curseur caché, aucun survol');
  await page.mouse.move(400, 300); await page.mouse.move(430, 330); await frames(2);
  ok(await page.evaluate(() => !PAD.drive && !document.body.classList.contains('padnav') && getComputedStyle(document.querySelector('#scr-main .mbtn')).pointerEvents !== 'none'), 'un glissement de souris rend la main (curseur et survol de retour)');
  // Menu : l'action principale de l'écran (« Lancer la partie ») ; le bandeau d'aide la nomme
  await page.evaluate(() => { UI.stack = ['main']; uiGo('solo', false); window.__go = 0; document.getElementById('soloGo').addEventListener('click', (e) => { window.__go++; e.stopImmediatePropagation(); }, true); });
  await page.waitForTimeout(300); await tap(13); await frames(2);
  ok(await page.evaluate(() => !document.getElementById('padHints').classList.contains('hidden') && document.getElementById('padHints').textContent.includes('Lancer la partie')), 'bandeau d\'aide : Menu = Lancer la partie');
  await tap(9); await frames(2);
  ok(await page.evaluate(() => window.__go === 1), 'Menu : lance la partie depuis n\'importe quel élément de l\'écran Solo');
  // vitesse de visée : 100 % à la hanche, le multiplicateur plein en visée
  ok(await page.evaluate(() => { VM.ads = 0; const a = adsLookMul(0.5); VM.ads = 1; const b = adsLookMul(0.5), c = adsLookMul(1); VM.ads = 0; return Math.abs(a - 1) < 1e-6 && Math.abs(b - 0.5) < 1e-6 && Math.abs(c - 1) < 1e-6; }), 'multiplicateur de visée : 1 à la hanche, plein en visée');
  // courbes de réponse du bâton du regard (padStick) : zone morte, départ dès la sortie de la zone morte, monotone, pleine à 95 % de la course
  const cv = await page.evaluate(() => {
    const at = (name, m, dead) => padStick(m, 0, dead, PAD_CURVES[name])[0];
    const mono = (name) => { let p = -1; for (let m = 0; m <= 1.0001; m += 0.01) { const o = at(name, m, 0.1); if (o < p - 1e-9) return false; p = o; } return true; };
    return { dead: at('reactive', 0.09, 0.1), start: at('reactive', 0.15, 0.1), startOld: at('classic', 0.15, 0.1), full: at('reactive', 0.95, 0.1), fullLin: at('linear', 0.95, 0.1), over: at('reactive', 1, 0.1),
      mid: at('reactive', 0.5, 0.1), midOld: at('classic', 0.5, 0.1), lin: at('linear', 0.525, 0.1), mono: mono('reactive') && mono('classic') && mono('linear'),
      circ: Math.hypot(...padStick(0.8, 0.8, 0.1, PAD_CURVES.reactive).slice(0, 2)), noPick: Object.values(PAD_LAYOUTS).every((l) => !Object.values(l).includes('pick')), def: [Settings.padCurve, Settings.padAccel, Settings.padDead] };
  });
  ok(cv.dead === 0 && cv.start > 0.015 && cv.start > cv.startOld * 2, `courbe réactive : rien dans la zone morte, un départ net dès sa sortie (${cv.start.toFixed(3)} contre ${cv.startOld.toFixed(3)} avant)`);
  ok(Math.abs(cv.full - 1) < 1e-9 && Math.abs(cv.fullLin - 1) < 1e-9 && Math.abs(cv.over - 1) < 1e-9, 'bâton à 95 % de la course : vitesse pleine, sans dépassement à fond');
  ok(cv.mono && cv.mid > cv.midOld && Math.abs(cv.mid - 0.287) < 0.03 && Math.abs(cv.lin - 0.5) < 0.01, `courbes monotones, la réactive est plus vive que l'ancienne au milieu (${cv.mid.toFixed(2)} contre ${cv.midOld.toFixed(2)}), la linéaire suit la course`);
  ok(Math.abs(cv.circ - 1) < 1e-9 && cv.def.join() === 'reactive,normal,0.1', `zone morte radiale (diagonale à fond = 1) et réglages par défaut ${cv.def.join(' ')}`);
  ok(cv.noPick, 'aucune disposition n\'a plus de bouton de ramassage (X maintenu)');
  await page.evaluate(() => { toMenu('main'); });
  // partie
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await until(page, "UI.screen==='deploy'", 120000);
  await page.evaluate(() => { if (UI.screen === 'deploy') document.getElementById('depGo').click(); });
  ok(await until(page, "MATCH.state==='playing' && PL.ent.alive", 120000), 'partie lancée');
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => pointerActive() && !document.getElementById('lockPrompt').classList.contains('show')), 'pointerActive à la manette, pas d\'invite « Cliquez pour jouer »');
  // déplacement
  const p0 = await page.evaluate(() => PL.ent.pos.toArray());
  await set([0, -1, 0, 0], {});
  ok(await until(page, `Math.hypot(PL.ent.pos.x - ${p0[0]}, PL.ent.pos.z - ${p0[2]}) > 0.8`, 60000), 'bâton gauche en avant : le soldat avance');
  await set([0, 0, 0, 0], {});
  // sprint L3
  await set([0, -1, 0, 0], {}); await frames(6); await tap(10);
  ok(await until(page, 'PL.sprinting', 30000), 'L3 : sprint');
  await set([0, 0, 0, 0], {}); await frames(4);
  ok(await page.evaluate(() => !PAD.sprint), 'bâton relâché : le sprint s\'arrête');
  // tirer en courant : la course s'arrête et le coup part ; elle ne reprend qu'avec L3
  await set([0, -1, 0, 0], {}); await frames(6); await tap(10);
  ok(await until(page, 'PL.sprinting', 30000), 'L3 : sprint, avant le tir');
  const shots0 = await page.evaluate(() => PL.ent.arms.shots);
  await set([0, -1, 0, 0], { 7: 1 });
  ok(await until(page, `!PL.sprinting && PL.ent.arms.shots > ${shots0}`, 30000), 'RT en sprint : la course s\'arrête et le tir part');
  await set([0, -1, 0, 0], { 7: 0 }); await frames(6);
  ok(await page.evaluate(() => !PAD.sprint && !PL.sprinting), 'RT relâchée : la course ne reprend pas sans L3');
  await tap(10); ok(await until(page, 'PL.sprinting', 30000), 'L3 : sprint de nouveau');
  const shots1 = await page.evaluate(() => PL.ent.arms.shots);
  await set([0, -1, 0, 0], { 7: 1 }); await frames(1); await set([0, -1, 0, 0], { 7: 0 }); // appui bref, relâché avant la fin de la sortie de course
  ok(await until(page, `PL.ent.arms.shots > ${shots1}`, 30000), 'RT brève en sprint (arme automatique) : le coup part quand même');
  await set([0, 0, 0, 0], {}); await frames(4);
  // regard
  const y0 = await page.evaluate(() => PL.yaw);
  await set([0, 0, 1, 0], {});
  ok(await until(page, `PL.yaw < ${y0} - 0.2`, 60000), 'bâton droit à droite : la vue tourne à droite'); await set([0, 0, 0, 0], {});
  // petite déflexion (20 % de la course brute) : le regard démarre tout de suite
  const ys = await page.evaluate(() => PL.yaw);
  await set([0, 0, 0.2, 0], {});
  ok(await until(page, `PL.yaw < ${ys} - 0.03`, 60000), 'bâton droit à 20 % : le regard démarre dès la sortie de la zone morte'); await set([0, 0, 0, 0], {});
  // accélération : à fond, la rampe monte à 1 puis le gain de vitesse de PAD_ACCEL s'applique ; relâché, elle retombe
  await set([0, 0, 1, 0], {});
  ok(await until(page, 'PAD.ramp > 0.99', 60000), 'bâton droit à fond : la rampe d\'accélération monte au maximum');
  ok(await page.evaluate(() => { const y0 = PL.yaw; PAD.lx = 1; PAD.ly = 0; padLook(0.01); return PL.yaw < y0; }), 'padLook fait tourner la vue à pleine rampe');
  await set([0, 0, 0, 0], {});
  ok(await until(page, 'PAD.ramp === 0', 30000), 'bâton relâché : la rampe retombe');
  const accOff = await page.evaluate(() => {
    const run = (acc) => { Settings.padAccel = acc; PAD.ramp = 1; PAD.lx = 1; PAD.ly = 0; const y0 = PL.yaw; padLook(0.01); return y0 - PL.yaw; };
    const off = run('off'), normal = run('normal'), strong = run('strong'); PAD.lx = 0; PAD.ramp = 0; Settings.padAccel = 'normal';
    return { off, normal, strong };
  });
  ok(Math.abs(accOff.normal / accOff.off - 1.5) < 0.2 && accOff.strong > accOff.normal, `gain de l'accélération : Aucune 1, Normale ${(accOff.normal / accOff.off).toFixed(2)}, Forte ${(accOff.strong / accOff.off).toFixed(2)}`);
  const pi0 = await page.evaluate(() => PL.pitch);
  await set([0, 0, 0, -1], {});
  ok(await until(page, `PL.pitch > ${pi0} + 0.1`, 60000), 'bâton droit en haut : la vue monte'); await set([0, 0, 0, 0], {});
  // gâchettes
  await set(null, { 7: 1 }); await frames(4);
  ok(await page.evaluate(() => PL.held), 'RT : tir maintenu');
  await set(null, { 7: 0 }); await frames(4);
  ok(await page.evaluate(() => !PL.held), 'RT relâchée : le tir s\'arrête');
  await set(null, { 6: 1 }); await frames(4);
  ok(await page.evaluate(() => PL.adsWant), 'LT : visée'); await set(null, { 6: 0 }); await frames(4);
  ok(await page.evaluate(() => !PL.adsWant), 'LT relâchée : fin de visée');
  // boutons
  const c0 = await page.evaluate(() => PL.cur); await tap(3);
  ok(await until(page, `PL.cur !== ${c0}`, 30000), 'Y : changer d\'arme');
  await until(page, 'PL.switching <= 0', 30000);
  await page.evaluate(() => { PL.weapons[PL.cur].mag = 1; }); await tap(2);
  ok(await until(page, 'PL.reload', 30000), 'X : recharge');
  await until(page, '!PL.reload', 60000);
  // X maintenu : ramasse l'arme au sol à portée (un appui bref recharge toujours) ; l'invite le dit et un filet se remplit pendant l'appui
  await page.evaluate(() => {
    clearDrops(); // (les armes lâchées par les bots morts ne doivent pas passer avant)
    const P = PL.ent, A = P.arms, have = new Set(A.slots.map((x) => x.def.id));
    const def = Object.values(WEAPONS).find((w) => !have.has(w.id) && w.cat === A.slots[A.cur].def.cat) || Object.values(WEAPONS).find((w) => !have.has(w.id));
    window.__dropId = def.id; window.__heldId = A.slots[A.cur].def.id;
    dropWeapon(def, 20, 60, new V3(P.pos.x - Math.sin(P.yaw) * 0.8, P.pos.y + 0.3, P.pos.z - Math.cos(P.yaw) * 0.8), new THREE.Quaternion(), new V3());
  });
  ok(await until(page, 'DROP.cur && DROP.cur.def.id === window.__dropId', 60000), 'arme au sol à portée : l\'invite apparaît');
  const pk = await page.evaluate(() => { const el = document.getElementById('pickup'); return { t: el.textContent, g: el.querySelectorAll('kbd.key.pad.b2').length }; });
  ok(/Maintenir/.test(pk.t) && pk.g === 1, 'invite : « Maintenir X pour échanger... » avec le bouton X (' + pk.t + ')');
  await page.evaluate(() => { PL.weapons[PL.cur].mag = 1; });
  await set(null, { 2: 1 }); await frames(2);
  ok(await page.evaluate(() => !PL.reload && PAD.useT >= 0 && document.getElementById('pickup').classList.contains('hold')), 'X enfoncé : pas de rechargement tout de suite, le filet se remplit');
  await set(null, { 2: 0 }); await frames(2);
  ok(await until(page, 'PL.reload', 30000), 'X relâché avant 0,3 s : il recharge');
  ok(await page.evaluate(() => !!DROP.cur && PL.weapons[PL.cur].def.id === window.__heldId), 'appui bref : l\'arme au sol est restée où elle était');
  await until(page, '!PL.reload', 60000);
  await set(null, { 2: 1 });
  ok(await until(page, 'PL.weapons[PL.cur].def.id === window.__dropId', 60000), 'X maintenu 0,3 s : l\'arme au sol est ramassée');
  ok(await page.evaluate(() => !PL.reload && DROP.list.some((d) => d.def.id === window.__heldId)), 'ramassage : pas de rechargement, l\'arme déposée tombe au sol');
  await set(null, { 2: 0 }); await frames(3);
  ok(await page.evaluate(() => !PL.reload && PAD.useT === -1 && !document.getElementById('pickup').classList.contains('hold')), 'X relâché après le ramassage : rien ne recharge, le filet disparaît');
  await until(page, 'PL.switching <= 0', 30000);
  await set(null, { 0: 1 }); await frames(3);
  ok(await page.evaluate(() => !!KEYS.Space), 'A : saut (touche saut tenue)'); await set(null, { 0: 0 }); await frames(3);
  ok(await page.evaluate(() => !KEYS.Space), 'A relâché : saut lâché');
  await tap(1); ok(await until(page, 'PL.crouchToggle', 30000), 'B : accroupi');
  await tap(1);
  const n0 = await page.evaluate(() => PL.nades); await set(null, { 5: 1 }); await frames(8); await set(null, { 5: 0 });
  ok(await until(page, `PL.nades < ${n0}`, 60000), 'RB : grenade lancée');
  await until(page, '!PL.nadeState', 60000); await until(page, 'PL.switching <= 0', 30000);
  // R3 : un appui bref donne un coup, maintenu il sort le couteau, Y (changer d'arme) le range
  await tap(11); ok(await until(page, 'PL.knifeT > 0 && !PL.knifeOut', 30000), 'R3 bref : un coup de couteau, le couteau ne reste pas en main');
  await until(page, 'PL.knifeT <= 0', 30000);
  await set(null, { 11: 1 }); ok(await until(page, 'PL.knifeOut', 60000), 'R3 maintenu : le couteau est en main'); await set(null, { 11: 0 }); await frames(4);
  ok(await page.evaluate(() => PL.knifeOut && PL.knifeT <= 0), 'R3 relâché : le couteau reste en main, sans coup de plus');
  await tap(3); ok(await until(page, '!PL.knifeOut', 30000), 'Y : le couteau est rangé');
  await until(page, 'PL.switching <= 0 && VM.lower < 0.05', 60000);
  await set(null, { 8: 1 }); await frames(4);
  ok(await page.evaluate(() => HUD.board), 'Retour : tableau des scores'); await set(null, { 8: 0 }); await frames(4);
  ok(await page.evaluate(() => !HUD.board), 'Retour relâché : tableau fermé');
  if (out) await page.screenshot({ path: out + '/manette-jeu.png' });
  // gaucher : les bâtons sont échangés
  await page.evaluate(() => { Settings.padLay = 'southpaw'; });
  const q0 = await page.evaluate(() => PL.ent.pos.toArray());
  await set([0, 0, 0, -1], {});
  ok(await until(page, `Math.hypot(PL.ent.pos.x - ${q0[0]}, PL.ent.pos.z - ${q0[2]}) > 0.6`, 60000), 'gaucher : le bâton droit déplace'); await set([0, 0, 0, 0], {}); await page.evaluate(() => { Settings.padLay = 'default'; });
  // pause
  await tap(9); ok(await until(page, "MATCH.state==='paused'", 30000), 'Menu : pause');
  // pause : la barre d'invites en bas à droite, avec les glyphes des boutons (A, Menu = Reprendre), qui ne recouvre pas le menu
  ok(await until(page, "!document.getElementById('padHints').classList.contains('hidden')", 30000), 'pause : barre d\'invites de la manette');
  const ph = await page.evaluate(() => { const h = document.getElementById('padHints'), r = h.getBoundingClientRect(), hit = [...document.querySelectorAll('.pm button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; }).map((b) => b.id || b.dataset.pm); return { t: h.textContent, g: h.querySelectorAll('kbd.key.pad').length, right: innerWidth - r.right, hit }; });
  ok(ph.t.includes('Reprendre') && ph.g >= 2 && ph.right < 40 && !ph.hit.length, `pause : invites ${JSON.stringify(ph)}`);
  if (out) await page.screenshot({ path: out + '/manette-pause.png' });
  await tap(9); ok(await until(page, "MATCH.state==='playing'", 30000), 'Menu : reprise');
  // un clic rend la main à la souris
  await page.mouse.click(300, 300); await page.waitForTimeout(200);
  ok(await page.evaluate(() => !PAD.drive), 'un clic rend la main à la souris');
  // fin de partie : la manette reprend la main sur les résultats ; barre d'invites (A, Menu = Rejouer), focus sur l'action principale, rien recouvert
  await page.evaluate(() => { MATCH.score[0] = MATCH.limit; endMatch(); });
  await tap(13); await frames(3);
  ok(await until(page, "MATCH.state==='ended' && PAD.drive && !document.getElementById('padHints').classList.contains('hidden')", 30000), 'fin de partie : barre d\'invites de la manette');
  const eh = await page.evaluate(() => { const h = document.getElementById('padHints'), r = h.getBoundingClientRect(), hit = [...document.querySelectorAll('#end button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; }).map((b) => b.id); return { t: h.textContent, g: h.querySelectorAll('kbd.key.pad').length, f: document.activeElement && document.activeElement.id, hit }; });
  ok(eh.t.includes('Rejouer') && eh.g >= 2 && eh.f === 'againBtn' && !eh.hit.length, `fin de partie : invites et focus sur « Rejouer » ${JSON.stringify(eh)}`);
  if (out) await page.screenshot({ path: out + '/manette-fin.png' });
  const errs = g.logs.filter((l) => l.includes('pageerror'));
  ok(!errs.length, 'aucune erreur de page' + (errs.length ? ' : ' + errs[0] : ''));
  await g.browser.close();
  console.log(fails ? fails + ' échec(s)' : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERREUR', e); process.exit(2); });
