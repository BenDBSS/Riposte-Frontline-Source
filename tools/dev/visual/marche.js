/* Vue à la première personne sur une marche, un trottoir (voir « Contrôles » du README, applyCamera dans src/08-player.js).
   Le sol du joueur change d'un coup (jusqu'à STEP, 45 cm) quand il monte ou descend sans sauter : la vue doit glisser, pas sauter. Le banc fait
   varier la hauteur du joueur image par image à 60 images par seconde (applyCamera appelée à la main, sans bob) et mesure la hauteur de la vue :
   - montée de 30 cm : la vue ne saute pas (pas plus de 5 cm d'une image à l'autre), arrive au sol à 5 mm près en 0,6 s, sans le dépasser ;
   - descente de 20 cm : de même ; marches d'escalier de 18 cm tous les 0,3 s : la vue suit sans à-coup (pas plus de 5 cm d'une image à l'autre) ;
   - en l'air (saut, chute), la vue garde sa hauteur exacte ; un écart plus grand qu'une marche (apparition) est suivi tout de suite.
   PAGE=autre.html : une autre version, placée dans dist/ (la 4.12.1, pour voir le saut d'avant). MAP=givre : une autre carte. Sort en erreur au premier défaut. */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'sable';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  await page.evaluate(() => { MATCH.state = 'capture'; });
  const R = await page.evaluate(() => {
    const e = PL.ent, dt = 1 / 60, out = {};
    e.alive = true; PL.bobA = 0; PL.bobT = 0; PL.shake = 0; PL.suppress = 0;
    const eye = () => camera.position.y - (e.pos.y + PL.eyeH); // hauteur de la vue au-dessus de sa position normale (0 : elle y est)
    const stand = (y) => { e.pos.y = y; e.onGround = true; e.vy = 0; for (let i = 0; i < 90; i++) applyCamera(dt, 0, false); };
    // frames : liste de [variation de hauteur du joueur, en l'air] ; rend les hauteurs absolues de la vue et le décalage final
    const run = (frames, air = false) => {
      const ys = []; let prev = camera.position.y;
      for (const dy of frames) { e.pos.y += dy; e.onGround = !air; applyCamera(dt, 0, false); ys.push(camera.position.y - prev); prev = camera.position.y; }
      return ys;
    };
    const maxAbs = (a) => Math.max(...a.map(Math.abs));
    const seq = (first, n) => [first, ...new Array(n - 1).fill(0)];
    // 1. montée de 30 cm
    stand(1.5);
    let d = run(seq(0.3, 36)); out.upMax = maxAbs(d); out.upEnd = eye();
    stand(1.5); { const tr = []; e.pos.y += 0.3; for (let i = 0; i < 36; i++) { applyCamera(dt, 0, false); tr.push(eye()); } out.upSigned = Math.max(...tr); out.upLag = tr[0]; }
    // 2. descente de 20 cm
    stand(1.5); d = run(seq(-0.2, 36)); out.downMax = maxAbs(d); out.downEnd = eye();
    stand(1.5); { const tr = []; e.pos.y -= 0.2; for (let i = 0; i < 36; i++) { applyCamera(dt, 0, false); tr.push(eye()); } out.downSigned = Math.min(...tr); }
    // 3. escalier : 18 cm toutes les 18 images (0,3 s), six marches
    stand(1.5); { const fr = []; for (let s = 0; s < 6; s++) fr.push(...seq(0.18, 18)); d = run(fr); out.stairMax = maxAbs(d); out.stairEnd = eye(); }
    // 4. en l'air : la vue suit exactement
    stand(1.5); e.onGround = false; PL.lastOn = false; { const tr = []; for (let i = 0; i < 10; i++) { e.pos.y += 0.1; e.onGround = false; applyCamera(dt, 0, false); tr.push(Math.abs(eye())); } out.airMax = Math.max(...tr); }
    // 5. apparition : un écart de 3 m est suivi tout de suite
    stand(1.5); e.pos.y += 3; applyCamera(dt, 0, false); out.tpErr = Math.abs(eye());
    return out;
  });
  console.log(JSON.stringify(R));
  ok(R.upMax < 0.05, `montée de 30 cm : au plus ${(R.upMax * 100).toFixed(1)} cm d'une image à l'autre (sans lissage : 30 cm)`);
  ok(R.upLag < -0.2, `montée de 30 cm : la vue reste en dessous au départ (${(R.upLag * 100).toFixed(1)} cm), elle glisse`);
  ok(R.upSigned < 0.001, `montée de 30 cm : la vue ne dépasse jamais sa hauteur d'arrivée (${(R.upSigned * 1000).toFixed(1)} mm)`);
  ok(Math.abs(R.upEnd) < 0.005, `montée de 30 cm : arrivée à ${(R.upEnd * 1000).toFixed(1)} mm en 0,6 s`);
  ok(R.downMax < 0.05 && Math.abs(R.downEnd) < 0.005 && R.downSigned > -0.001, `descente de 20 cm : au plus ${(R.downMax * 100).toFixed(1)} cm par image, arrivée à ${(R.downEnd * 1000).toFixed(1)} mm, sans dépassement`);
  ok(R.stairMax < 0.05 && Math.abs(R.stairEnd) < 0.005, `escalier de 6 marches de 18 cm : au plus ${(R.stairMax * 100).toFixed(1)} cm par image, arrivée à ${(R.stairEnd * 1000).toFixed(1)} mm`);
  ok(R.airMax < 0.001, `en l'air : la vue garde sa hauteur exacte (${(R.airMax * 1000).toFixed(2)} mm d'écart)`);
  ok(R.tpErr < 0.001, `apparition (+3 m) : la vue suit tout de suite (${(R.tpErr * 1000).toFixed(2)} mm d'écart)`);
  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND'));
  ok(errs.length === 0, `console propre${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
