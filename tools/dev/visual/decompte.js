/* Contrôle du décompte du départ (src/09y-decompte.js) : node decompte.js [page=dist/riposte-frontline.html] ; LANGUE=en : textes anglais.
   Partie solo réelle (boucle d'images du jeu, rendu 3D coupé pour aller vite). Le décompte du jeu dure 5 s : un premier lancement le vérifie
   de bout en bout (le chiffre seul, un son par seconde de 5 à 1, aucune voix, « En avant ! »), puis un décompte rallongé à 12 s (MATCH_COUNTDOWN) laisse
   le temps de mesurer le reste :
   - au déploiement : décompte affiché (chiffre, surtitre), réticule masqué, chrono arrêté ;
   - pendant le décompte : ni pas, ni sprint, ni tir, ni couteau, ni grenade (touches tenues), bots immobiles qui ne tirent pas, chrono figé,
     chiffre qui suit le temps, délai de changement de classe ouvert ;
   - la pause arrête le décompte en solo ;
   - au départ : « En avant ! », ponctuation de départ sans voix, sons de chaque seconde, le chrono tourne, le joueur
     avance et tire avec les touches qu'il tenait ;
   - réapparition après une mort : pas de décompte ; « Rejouer » : un nouveau décompte ; MATCH_COUNTDOWN = 0 : départ immédiat ;
   - invité en ligne (messages de l'hôte simulés, sans réseau) : attente de l'hôte, temps restant reçu, départ quand l'hôte ne l'envoie plus,
     arrivée dans une partie lancée sans décompte. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const lang = process.env.LANGUE === 'en' ? 'en' : 'fr';
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 640, h: 360, countdown: true, settings: { quality: 'low', lang, map: 'sable', mode: 'tdm' }, noHdri: true, noMap: true });
  const ev = (f, a) => page.evaluate(f, a);
  const wait = (ms) => page.waitForTimeout(ms);
  // rendu 3D coupé (la logique seule : la boucle d'images tourne vite en rendu logiciel) ; espions sur les sons du décompte et les annonces
  await ev(() => {
    window.__cd = { snd: [], ann: [] };
    const s = cdSound; cdSound = (n, f) => { __cd.snd.push(n); return s(n, f); };
    const a = sfxAnnounce; sfxAnnounce = (l, st) => { __cd.ann.push(l); return a(l, st); };
    LOCK.fallback = true;
  });
  const launch = async () => {
    await ev(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
    await page.waitForFunction("UI.screen==='deploy' && !UI.busy", null, { timeout: 600000 });
    await ev(() => { composer.render = () => {}; __cd.snd.length = 0; __cd.ann.length = 0; document.getElementById('depGo').click(); });
    await page.waitForFunction("MATCH.state==='playing'", null, { timeout: 60000 });
  };
  const state = () => ev(() => {
    const cd = $('cd'), ring = !!document.getElementById('cdRing');
    return { cd: MATCH.cd, on: cdOn(), wait: CD.wait, tl: MATCH.timeLeft, cls: cd.className, num: $('cdNum').textContent, echo: $('cdNum').dataset.n, ring, kick: $('cdKick').textContent, goal: !!document.querySelector('#cd .cd-goal'),
      xh: $('xhair').style.opacity, hud: $('hud').classList.contains('counting'), go: $('cdGo').classList.contains('show'), goTxt: $('cdGo').textContent, msg: $('msg').className.includes('show') ? $('msg').textContent : '' };
  });
  const T = lang === 'en' ? { kick: 'Match begins in', go: 'Move out!', wait: 'Waiting for the host' } : { kick: 'La partie commence dans', go: 'En avant !', wait: "En attente de l'hôte" };

  console.log('Solo, match à mort par équipe, décompte du jeu (5 s)');
  await ev(() => { Settings.limit = 75; saveSettings(); });
  await launch();
  await page.waitForFunction('CD.shown > 0', null, { timeout: 120000 }).catch(() => {}); // (les premières images sont lentes en rendu logiciel : on attend le premier chiffre)
  let s = await state();
  ok(await ev(() => cdLen() === 5), 'cinq secondes');
  ok(s.on && s.cd > 3.5 && s.cd <= 5, 'décompte lancé au déploiement', +s.cd.toFixed(2));
  ok(s.cls.includes('show') && s.hud, 'décompte affiché, HUD en mode décompte', s.cls);
  ok(s.kick === T.kick && !s.goal, "surtitre seul, sans rappel de l'objectif (il est au score)", [s.kick, s.goal]);
  ok(+s.num === Math.ceil(s.cd) && s.echo === s.num && !s.ring, 'chiffre et son écho, sans barre', [s.num, s.echo, s.ring]);
  ok(s.xh === '0', 'réticule masqué');
  ok(s.tl === 600, 'chrono arrêté au départ', s.tl);
  ok(await ev(() => typeof cdNetOut() === 'number' && classGraceLeft() > CLASS_GRACE), 'temps restant prêt pour les invités, changement de classe immédiat ouvert');
  await page.waitForFunction('!cdOn()', null, { timeout: 120000 }).catch(() => {});
  s = await state();
  const def = await ev(() => ({ snd: __cd.snd.slice(), ann: __cd.ann.slice() }));
  ok(!s.on && s.go && s.goTxt === T.go, 'départ : « ' + T.go + ' »', [s.on, s.go, s.goTxt]);
  ok(def.snd.join() === '5,4,3,2,1', 'un son par seconde, de 5 à 1', def.snd);
  ok(def.ann.every((l) => l === null) && def.ann.length === 1, 'départ : la ponctuation seule, aucune annonce vocale (ni phrase radio, ni chiffres, ni « En avant »)', def.ann);

  console.log('Décompte rallongé à 12 s (le temps de mesurer)');
  await ev(() => { window.MATCH_COUNTDOWN = 12; });
  await launch();
  s = await state();
  ok(s.on && s.cd > 10.5 && s.cd <= 12, 'décompte rallongé lancé au déploiement', +s.cd.toFixed(2));
  // le joueur tient avancer, sprint, tir et visée, et tente couteau et grenade
  const p0 = await ev(() => {
    KEYS.KeyW = true; KEYS.ShiftLeft = true; PL.held = true; PL.queued = true; PL.adsWant = true; knife(); cookNade();
    const bots = entities.filter((e) => !e.isPlayer && e.alive);
    window.__p0 = { me: PL.ent.pos.clone(), bots: bots.map((e) => [e, e.pos.clone()]), shots: bots.reduce((a, e) => a + e.arms.shots, 0) };
    return { knife: PL.knifeT, nade: PL.nadeState, bots: bots.length };
  });
  ok(p0.knife === 0 && !p0.nade, 'ni couteau ni grenade pendant le décompte');
  // (les premières images après le déploiement sont lentes en rendu logiciel : on attend que le décompte ait avancé de 2 s)
  await page.waitForFunction('MATCH.cd < 10', null, { timeout: 120000 }).catch(() => {});
  const mv = await ev(() => {
    const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    return { me: d(PL.ent.pos, __p0.me), bots: Math.max(...__p0.bots.map(([e, p]) => d(e.pos, p))), botShots: entities.filter((e) => !e.isPlayer).reduce((a, e) => a + e.arms.shots, 0) - __p0.shots, shots: PL.shots, ads: VM.ads };
  });
  s = await state();
  ok(mv.me < 0.01, 'le joueur ne bouge pas (avancer et sprint tenus)', +mv.me.toFixed(3));
  ok(mv.shots === 0 && mv.ads < 0.05, 'le joueur ne tire ni ne vise', [mv.shots, +mv.ads.toFixed(2)]);
  ok(mv.bots < 0.05 && mv.botShots === 0, 'les bots restent en place et ne tirent pas', [+mv.bots.toFixed(3), mv.botShots]);
  ok(s.tl === 600, 'chrono figé pendant le décompte', s.tl);
  ok(s.on && s.cd < 10 && s.cd > 3, 'le décompte avance (temps réel)', +s.cd.toFixed(2));
  ok(+s.num === Math.ceil(s.cd) && s.echo === s.num, 'chiffre et écho suivent le temps', [s.num, s.echo, +s.cd.toFixed(2)]);
  // pause : le décompte s'arrête en solo
  const pz = await ev(() => { pauseGame(); window.__f0 = frameN; return MATCH.cd; });
  await page.waitForFunction('frameN > __f0 + 12', null, { timeout: 120000 }).catch(() => {});
  // reprise : la pause a relâché les touches (pauseGame), le joueur les tient de nouveau
  const pz2 = await ev(() => { const c = MATCH.cd; resumeGame(); KEYS.KeyW = true; PL.held = true; return [c, frameN - __f0]; });
  ok(Math.abs(pz2[0] - pz) < 0.02 && pz2[1] > 12, 'la pause arrête le décompte (solo)', [+pz.toFixed(2), +pz2[0].toFixed(2), pz2[1] + ' images']);
  await page.waitForFunction('!cdOn()', null, { timeout: 120000 }).catch(() => {});
  s = await state();
  const after = await ev(() => ({ snd: __cd.snd.slice(), ann: __cd.ann.slice(), start: MATCH.startAt, time: MATCH.time }));
  ok(!s.on && s.go && s.goTxt === T.go, 'départ : « ' + T.go + ' »', [s.on, s.go, s.goTxt]);
  ok(!s.hud && !s.cls.includes('show'), 'décompte effacé');
  ok(after.ann.every((l) => l === null), 'aucune annonce vocale', after.ann);
  ok([3, 2, 1].every((n) => after.snd.includes(n)) && after.snd.join() === after.snd.slice().sort((a, b) => b - a).join(), "un son par seconde, dans l'ordre", after.snd);
  ok(Math.abs(after.start - after.time) < 0.5, 'début de partie compté depuis le départ (MATCH.startAt)');
  await page.waitForFunction('MATCH.time - MATCH.startAt > 1.2', null, { timeout: 120000 }).catch(() => {});
  const run = await ev(() => { const d = Math.hypot(PL.ent.pos.x - __p0.me.x, PL.ent.pos.z - __p0.me.z); const r = { tl: MATCH.timeLeft, me: d, shots: PL.shots, xh: $('xhair').style.opacity }; for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false; return r; });
  ok(run.tl < 600, 'le chrono tourne après le départ', +run.tl.toFixed(1));
  ok(run.me > 0.5 && run.shots > 0, 'le joueur avance et tire avec les touches tenues', [+run.me.toFixed(2), run.shots]);

  console.log('Réapparition après une mort : pas de décompte');
  await ev(() => { const b = entities.find((x) => !x.isPlayer && x.alive && !allied(x, PL.ent)); killEnt(PL.ent, b, 'AK-47', false, new V3(0, 0, 1)); });
  await page.waitForFunction("(MATCH.state==='killcam' && kcSkip(), MATCH.state==='playing' && PL.ent.alive)", null, { timeout: 60000, polling: 300 }).catch(() => {});
  s = await state();
  ok(await ev(() => PL.ent.alive) && !s.on && !s.cls.includes('show'), 'réapparu sans décompte', [s.on, s.cls]);

  console.log('« Rejouer » : un nouveau décompte');
  await ev(() => endMatch());
  await ev(() => { composer.render = () => {}; $('againBtn').click(); });
  await page.waitForFunction("UI.screen==='deploy' && !UI.busy", null, { timeout: 600000 });
  await ev(() => { __cd.snd.length = 0; __cd.ann.length = 0; $('depGo').click(); });
  await page.waitForFunction("MATCH.state==='playing'", null, { timeout: 60000 });
  s = await state();
  ok(s.on && s.cd > 8.5 && s.tl === 600, 'nouveau décompte après « Rejouer »', +s.cd.toFixed(2));

  console.log('Outils de test : MATCH_COUNTDOWN = 0');
  await ev(() => { window.MATCH_COUNTDOWN = 0; });
  await launch();
  s = await state();
  ok(!s.on && !s.go && s.msg.length > 0, 'départ immédiat, objectif en message comme avant', s.msg);
  await ev(() => { delete window.MATCH_COUNTDOWN; });

  console.log("Invité en ligne (messages de l'hôte simulés)");
  // (salon rejoint et hôte vu à l'instant : le battement du réseau, netHeartbeat, ne le ferme pas)
  await ev(() => { const now = performance.now(); Object.assign(NET, { role: 'client', on: true, joined: true, t0: now, hostSeen: now, lastSend: now }); MATCH.online = true; __cd.ann.length = 0; cdStart(); });
  await wait(1200);
  s = await state();
  ok(s.on && s.wait && s.cls.includes('wait') && s.kick === T.wait, "déployé avant l'hôte : en attente", [s.cls, s.kick]);
  const tlw = await ev(() => MATCH.timeLeft);
  await ev((tl) => netClientMsg({ t: 'ps', l: [], tl, cd: 3.4 }), tlw);
  await page.waitForFunction('CD.shown > 0', null, { timeout: 60000 }).catch(() => {});
  s = await state();
  ok(s.on && !s.wait && s.cd > 2.5 && s.cd <= 3.4 && +s.num === Math.ceil(s.cd), "temps restant reçu de l'hôte", +s.cd.toFixed(2));
  const c1 = await ev(() => { const c = MATCH.cd; netClientMsg({ t: 'ps', l: [{}], tl: MATCH.timeLeft, cd: +(c + 0.05).toFixed(2) }); netClientMsg({ t: 'ps', l: [], cd: 1 }); return [c, MATCH.cd]; });
  ok(Math.abs(c1[1] - c1[0]) < 0.06, 'petit écart et état relayé (sans tl) : pas de saut', c1.map((x) => +x.toFixed(2)));
  await ev(() => netClientMsg({ t: 'ps', l: [], tl: MATCH.timeLeft }));
  s = await state();
  ok(!s.on && s.go, "départ quand l'hôte n'envoie plus de décompte");
  await ev(() => { cdStart(); netClientMsg({ t: 'ps', l: [], tl: 512 }); });
  s = await state();
  ok(!s.on && !s.go && s.msg.length > 0 && s.tl === 512, 'arrivée dans une partie lancée : pas de décompte', [s.on, s.go, s.tl, s.msg]);
  await ev(() => { NET.role = 'off'; NET.on = false; MATCH.online = false; toMenu(); });

  const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
  ok(!errs.length, 'aucune erreur dans la page', errs.slice(0, 3));
  console.log(fails.length ? `${fails.length} échec(s)` : 'tout est bon');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
