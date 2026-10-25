/* Contrôle des défis qui débloquent les tenues de défi (src/06s-defis.js), sans jouer de partie entière : chaque défi compte ce qu'il doit
   compter et rien d'autre (famille d'arme, couteau et grenade, distance, accroupi, glissade et saut, double élimination, silencieux, drone UAV,
   point capturé, rang en match à mort, cartes terminées, cartes françaises), un défi s'arrête à son objectif, une tenue se débloque et s'annonce quand ses trois
   défis sont accomplis, la tenue choisie mais verrouillée revient à Assaut, l'avancement se sauvegarde et se fusionne (le plus haut compteur
   l'emporte, les cartes se réunissent), l'écran de fin le résume.
   node tools/dev/visual/defis.js ; sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', lang: 'fr', skin: 'raptor' } });
  await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const out = {}, me = PL.ent, foe = entities.find((e) => !e.isPlayer && !e.off && !allied(me, e)), N = (id) => WEAPONS[id].name;
    const reset = () => { ARS.ch = {}; ARS.chMaps = []; ARS.chSess = {}; };
    const snap = () => Object.fromEntries(DEFIS.map((d) => [d.id, defiCount(d.id)]).filter(([, n]) => n));
    const kill = (weapon, o = {}) => {
      Object.assign(me, { crouch: false, slideT: 0, onGround: true, comboN: 1 }, o.me || {});
      foe.pos.copy(me.pos).add(new V3(0, 0, -(o.d || 10)));
      defisKill(me, foe, weapon, !!o.head);
    };
    out.locked = { set: Settings.skin, mine: skinMine() };
    reset();
    for (const id of ['m1014', 'l96', 'mp5', 'm4', 'm9']) kill(N(id));
    out.cats = snap(); reset();
    kill(NET_WSPECIAL.knife); kill(NET_WSPECIAL.nade); kill(NET_WSPECIAL.air); kill(NET_WSPECIAL.heli); kill(NET_WSPECIAL.fall);
    out.special = snap(); reset();
    kill(N('l96'), { d: 55 }); kill(N('l96'), { d: 30 });
    out.far = snap(); reset();
    kill(N('m4'), { me: { crouch: true } }); kill(N('m4'), { me: { crouch: true, slideT: 0.3 } }); kill(N('m4'), { me: { onGround: false } });
    out.pose = snap(); reset();
    kill(N('m4'), { me: { comboN: 2 } }); kill(N('m4'), { me: { comboN: 3 } });
    out.combo = snap(); reset();
    const w = curW(), def0 = w.def; w.def = weaponDef(def0.id, ['sil'], null); kill(def0.name); w.def = def0; kill(def0.name);
    out.sil = snap(); reset();
    PL.ks.uav = true; useUAV(); if (typeof ksAbort === 'function') ksAbort();
    out.uav = snap(); reset();
    me.alive = true; domChanged({ owner: me.team, n: [1, 1], x: me.pos.x, y: me.pos.y, z: me.pos.z, name: 'A' }, -1);
    out.cap = snap(); reset();
    MATCH.mode = 'ffa'; defisMatchEnd('win', 2); defisMatchEnd('loss', 4); MATCH.mode = 'tdm'; defisMatchEnd('win', 1);
    out.end = snap(); out.maps = ARS.chMaps.slice(); reset();
    // cartes françaises (Gilet jaune) : parties terminées, victoires et éliminations sur Val-Blanc, Kervénec ou French Dream seulement
    const map0 = CURMAP.id;
    CURMAP.id = 'embruns'; kill(N('m4')); kill(NET_WSPECIAL.knife); defisMatchEnd('win', 1); defisMatchEnd('loss', 5);
    CURMAP.id = 'sable'; kill(N('m4')); defisMatchEnd('win', 1);
    CURMAP.id = map0;
    out.fr = snap(); reset();
    // plafond à l'objectif, déblocage et annonces
    ARSQ.list.length = 0;
    defiAdd('rPm', 500); defiAdd('rMouv', 25);
    out.before = { un: skinUnlocked('raptor'), mine: skinMine() };
    defiAdd('rDouble', 15);
    out.after = { un: skinUnlocked('raptor'), mine: skinMine(), rPm: ARS.ch.rPm, ann: ARSQ.list.concat(ARSQ.on ? [document.getElementById('arsUp').innerHTML] : []).join(' | ') };
    out.endHtml = defisEndHtml().length;
    // sauvegarde et fusion : le plus haut compteur l'emporte, les cartes se réunissent, une clé mal formée est écartée
    const s0 = JSON.parse(JSON.stringify(arsSnapshot()));
    ARS.ch = { rPm: 10, vFa: 7 }; ARS.chMaps = ['givre'];
    arsApply(Object.assign({}, s0, { ch: Object.assign({}, s0.ch, { vFa: 3, 'bad key!': 9 }), cm: ['sable', 'sable', 'nulle'] }), true);
    out.merge = { ch: ARS.ch, maps: ARS.chMaps.slice().sort() };
    return out;
  });
  ok(r.locked.set === 'raptor' && r.locked.mine === 'assault', `tenue choisie mais verrouillée : Assaut portée (${JSON.stringify(r.locked)})`);
  ok(JSON.stringify(r.cats) === JSON.stringify({ nPompe: 1, tPrec: 1, rPm: 1, vFa: 1, vPist: 1 }), `chaque famille d'arme compte pour son défi (${JSON.stringify(r.cats)})`);
  ok(JSON.stringify(r.special) === JSON.stringify({ nBrut: 2 }), `couteau et grenade comptent, frappe aérienne, hélicoptère et chute non (${JSON.stringify(r.special)})`);
  ok(r.far.tLoin === 1 && r.far.tPrec === 2, `à 50 m ou plus seulement (${JSON.stringify(r.far)})`);
  ok(r.pose.fAcc === 1 && r.pose.rMouv === 2, `accroupi (pas en glissade), glissade et saut (${JSON.stringify(r.pose)})`);
  ok(r.combo.rDouble === 1, `double élimination : une fois par enchaînement (${JSON.stringify(r.combo)})`);
  ok(r.sil.fSil === 1, `silencieux : seulement l'arme qui en porte un (${JSON.stringify(r.sil)})`);
  ok(r.uav.tUav === 1, `drone UAV appelé (${JSON.stringify(r.uav)})`);
  ok(r.cap.vDom === 1, `point capturé en Domination (${JSON.stringify(r.cap)})`);
  ok(r.end.nFfa === 1 && r.end.fCartes === 1 && r.maps.length === 1, `fin de partie : rang en match à mort, carte terminée une seule fois (${JSON.stringify(r.end)} ${r.maps})`);
  ok(r.fr.gElim === 2 && r.fr.gParties === 2 && r.fr.gVict === 1, `cartes françaises : éliminations, parties et victoires, pas ailleurs (${JSON.stringify(r.fr)})`);
  ok(!r.before.un && r.before.mine === 'assault' && r.after.un && r.after.mine === 'raptor' && r.after.rPm === 150, `trois défis accomplis : Raptor débloqué et porté, compteur plafonné (${JSON.stringify(r.before)} ${JSON.stringify(r.after).slice(0, 160)})`);
  ok(/Défi accompli/.test(r.after.ann) && /Tenue débloquée : Raptor/.test(r.after.ann), `annonces : défi accompli, tenue débloquée`);
  ok(r.endHtml > 100, `écran de fin : défis de la partie (${r.endHtml} caractères)`);
  ok(r.merge.ch.rPm === 150 && r.merge.ch.vFa === 7 && !('bad key!' in r.merge.ch) && JSON.stringify(r.merge.maps) === JSON.stringify(['givre', 'sable']), `fusion des sauvegardes (${JSON.stringify(r.merge)})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon/.test(l));
  ok(errs.length === 0, `aucune erreur de la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
