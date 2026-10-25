/* Contrôle de la réapparition après une mort aux commandes d'une série : le joueur meurt en pilotant le drone kamikaze (08e-fpv.js), ou dans
   son mecha qui explose (08g-mecha-pilote.js), sans killcam (tué par un drone, une explosion) ; à sa réapparition, il a son arme en main (vue subjective
   visible, arme équipée, prêt à tirer). Avant le correctif, il repartait les mains vides jusqu'au drone suivant.
   node tools/dev/visual/reapparition.js ; code d'erreur au premier échec. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', lang: 'fr' }, page: process.env.PAGE }); // PAGE=autre/version.html
  await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    let t = performance.now();
    const run = (n) => { for (let k = 0; k < n; k++) { t += 1000 / 60; frame(t); } };
    const until = (f, n) => { for (let k = 0; k < n && !f(); k++) run(1); return f(); };
    const state = () => ({ alive: PL.ent.alive, vm: VM.root.visible, holder: VM.holder.visible, arme: !!curW(), pret: !busy(), drone: !!PILOT.d, mecha: !!MECHA_P.me });
    const out = {};
    run(30);
    // drone : lancé, piloté, puis le joueur est tué
    fpvLaunch(PL.ent); run(40);
    out.vol = state();
    const foe = entities.find((e) => !e.isPlayer && !e.off && !allied(PL.ent, e));
    killEnt(PL.ent, foe, NET_WSPECIAL.drone, false, new V3(0, 0, 1)); run(5); // (tué par un drone ennemi : pas de killcam)
    out.mortDrone = state();
    out.reapDrone = until(() => PL.ent.alive, 60 * 20) && (run(30), state());
    // mecha : à bord, il surchauffe et explose avec son pilote
    const me = mechaSpawn(PL.ent, PL.ent.pos.clone().add(new V3(0, 0, 2)), PL.ent.yaw); mechaBoard(me); run(30);
    out.bord = state();
    mechaOverheat(me); run(5);
    out.mortMecha = state();
    out.reapMecha = until(() => PL.ent.alive, 60 * 20) && (run(30), state());
    return out;
  });
  ok(r.vol.drone && !r.vol.vm, `drone en vol : la vue est dans le drone, l'arme cachée (${JSON.stringify(r.vol)})`);
  ok(!r.mortDrone.alive && !r.mortDrone.drone, `mort aux commandes du drone : la vue revient au corps (${JSON.stringify(r.mortDrone)})`);
  ok(r.reapDrone && r.reapDrone.alive && r.reapDrone.vm && r.reapDrone.holder && r.reapDrone.arme && r.reapDrone.pret, `réapparition après le drone : arme en main, prêt à tirer (${JSON.stringify(r.reapDrone)})`);
  ok(r.bord.mecha && !r.bord.vm, `à bord du mecha : l'arme cachée (${JSON.stringify(r.bord)})`);
  ok(!r.mortMecha.alive, `mecha qui explose avec son pilote (${JSON.stringify(r.mortMecha)})`);
  ok(r.reapMecha && r.reapMecha.alive && r.reapMecha.vm && r.reapMecha.holder && r.reapMecha.arme && r.reapMecha.pret, `réapparition après le mecha : arme en main, prêt à tirer (${JSON.stringify(r.reapMecha)})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon/.test(l));
  ok(errs.length === 0, `aucune erreur de la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
