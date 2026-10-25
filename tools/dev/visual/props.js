/* Banc des props physiques (voir « Props physiques » du README). Charge la carte, puis pour chaque type de prop pose un coup
   de fusil et une explosion, laisse le corps se calmer, et sort en erreur au premier défaut : valeur non finie, corps qui
   ne s'endort pas, corps enfoncé dans le sol, coup de feu qui traverse un prop, remise à zéro qui ne remet pas tout en place.
   Il vérifie aussi la visée (rayWorld voit les props non traversables, tir compris les fruits) et les débris (éclatement,
   réserve, retour à l'état d'origine).
   node props.js            Khamsin ;  MAP=givre node props.js   Val-Blanc.
   Variables : CHROMIUM (navigateur), PAGE (autre version). */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'sable';
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  await page.evaluate(() => { MATCH.state = 'capture'; MATCH.time = 1; });
  const R = await page.evaluate(() => {
    const out = { fails: [], types: {}, n: PHYS.bodies.length, variants: PHYS.variants.size };
    const fail = (m) => out.fails.push(m);
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) updateProps(1 / 60); };
    const settle = (max) => { let t = 0; while (PHYS.awake.length && t < max) { sim(0.1); t += 0.1; } return +t.toFixed(1); };
    const finite = (tag) => { for (const b of PHYS.bodies) if (![b.p.x, b.p.y, b.p.z, b.q.x, b.q.y, b.q.z, b.q.w, b.vel.x, b.w.x].every(Number.isFinite)) { fail(tag + ' : valeur non finie sur ' + b.d.key); return false; } return true; };
    const below = (tag) => { for (const b of PHYS.bodies) if (b.state && b.p.y < -0.02) fail(tag + ' : ' + b.d.key + ' sous le sol (y = ' + b.p.y.toFixed(2) + ')'); };
    const start = PHYS.bodies.map((b) => [b.p.x, b.p.y, b.p.z, b.state]);
    // visée : un rayon vers chaque corps non traversable le touche
    for (const b of PHYS.bodies) {
      if (b.pooled || !b.d.ray) continue;
      const o = new V3(b.p.x + 3, b.p.y, b.p.z), d = new V3(-1, 0, 0);
      const h = rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, 3 + b.rad, b.d.through ? 1 : 0);
      if (b.d.through) { const h0 = rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, 3 + b.rad, 0); if (h0 && h0.prop === b) fail('visée : ' + b.d.key + ' (traversable) vu par une ligne de vue'); }
    }
    // chaque type : un coup de fusil, puis une explosion à 2,5 m
    for (const type of [...new Set(PHYS.bodies.filter((b) => !b.pooled).map((b) => b.d.key))]) {
      const b = PHYS.bodies.find((x) => x.d.key === type && !x.pooled);
      const p0 = b.p.clone(), dir = new V3(1, 0, 0.3).normalize();
      propShot(b, b.p.clone().addScaledVector(dir, -0.1), dir, 32);
      const t1 = settle(25);
      if (PHYS.awake.length) fail(type + ' : encore éveillé après 25 s (' + PHYS.awake.length + ' corps)');
      const rec = { coup: { t: t1, dist: +b.p.distanceTo(p0).toFixed(2), cassé: b.state === 0 } };
      if (b.state) {
        explode(new V3(b.p.x + 2.5, 0.3, b.p.z), PL.ent, 'Grenade', 7.5, 150);
        const t2 = settle(25);
        if (PHYS.awake.length) fail(type + ' : encore éveillé après le souffle');
        rec.souffle = { t: t2, dist: +b.p.distanceTo(p0).toFixed(2), cassé: b.state === 0 };
      }
      below(type); finite(type);
      out.types[type] = rec;
      propsReset();
      const s = start[PHYS.bodies.indexOf(b)];
      if (Math.hypot(b.p.x - s[0], b.p.y - s[1], b.p.z - s[2]) > 1e-4 || b.state !== s[3]) fail(type + ' : propsReset ne remet pas le corps en place');
    }
    // fruits : un cageot entier, un coup puis un souffle
    const fr = PHYS.bodies.filter((b) => b.d.type === 'fruit');
    if (fr.length) {
      const f0 = fr[0];
      propShot(f0, f0.p.clone().add(new V3(-0.05, 0, 0)), new V3(1, 0.1, 0), 32);
      const t = settle(25); if (PHYS.awake.length) fail('fruits : encore ' + PHYS.awake.length + ' corps éveillés après 25 s');
      below('fruits');
      explode(new V3(f0.p.x, f0.p.y + 1.2, f0.p.z + 1.2), PL.ent, 'Grenade', 7.5, 150);
      const t2 = settle(25); if (PHYS.awake.length) fail('fruits : encore ' + PHYS.awake.length + ' corps éveillés après le souffle');
      below('fruits après souffle'); finite('fruits');
      out.fruits = { n: fr.length, coup: t, souffle: t2 };
      propsReset();
    }
    // tir complet : fireRay sur un prop de face, sans mur devant (le corps doit se réveiller, ou éclater)
    for (const b of PHYS.bodies) {
      if (b.pooled || !b.d.ray) continue;
      const org = new V3(b.p.x - 3, b.p.y, b.p.z), w = rayWorld(org.x, org.y, org.z, 1, 0, 0, 3 - b.rad, 2);
      if (w) continue;
      // un autre prop sur la ligne de tir (pots serrés sur un établi) : c'est lui que la balle toucherait, pas ce corps
      if (PHYS.bodies.some((o) => o !== b && !o.pooled && o.p.x > org.x && o.p.x < b.p.x && Math.abs(o.p.y - b.p.y) < o.rad + b.rad && Math.abs(o.p.z - b.p.z) < o.rad + b.rad)) continue;
      fireRay(PL.ent, org, new V3(1, 0, 0), WEAPONS.m4, null, false);
      if (b.state === 1 && !b.d.hold) fail('tir : ' + b.d.key + ' touché de face mais resté endormi');
      propsReset(); break;
    }
    // chaises : chacune regarde la table la plus proche (le devant d'une chaise est +z dans son repère)
    const tables = PHYS.bodies.filter((b) => b.d.type === 'table' || b.d.type === 'cafeTable');
    for (const c of PHYS.bodies.filter((b) => b.d.type === 'chair')) {
      let t = null, td = 1e9; for (const x of tables) { const d = Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z); if (d < td) { td = d; t = x; } }
      if (!t || td > 1.4) continue;
      const fx = c.R[2], fz = c.R[8], l = Math.hypot(fx, fz) || 1, dot = (fx * (t.p.x - c.p.x) + fz * (t.p.z - c.p.z)) / l / td;
      if (dot < 0.8) fail('chaise en (' + c.p.x.toFixed(1) + ', ' + c.p.z.toFixed(1) + ') tournée dos à sa table (cos ' + dot.toFixed(2) + ')');
      out.chaises = (out.chaises || 0) + 1;
    }
    if (typeof propsKick !== 'undefined') fail('propsKick existe encore : marcher sur un prop ne doit rien déplacer');
    // résistance : sous le seuil le corps ne bouge pas, au-delà il part
    const hb = PHYS.bodies.find((b) => b.d.hold && !b.pooled && b.state === 1);
    if (hb) {
      const p0 = hb.p.clone(), dir = new V3(1, 0, 0);
      propShot(hb, hb.p.clone().addScaledVector(dir, -0.1), dir, hb.d.hold * 0.4);
      if (hb.state !== 1 || hb.p.distanceTo(p0) > 1e-6) fail(hb.d.key + ' : un petit coup ne doit pas le déloger');
      propShot(hb, hb.p.clone().addScaledVector(dir, -0.1), dir, hb.d.hold);
      if (hb.state !== 2) fail(hb.d.key + ' : des coups répétés doivent le déloger');
      settle(25); propsReset();
    }
    // empilement : le corps posé sur un seul appui tombe quand l'appui part
    let pile = null;
    for (const c of PHYS.stackers) {
      const ce = propExtent(c), under = PHYS.stackers.filter((o) => o !== c && Math.abs((c.p.y - ce[1]) - (o.p.y + propExtent(o)[1])) <= 0.12 && Math.abs(c.p.x - o.p.x) < propExtent(o)[0] + ce[0] - 0.12 && Math.abs(c.p.z - o.p.z) < propExtent(o)[2] + ce[2] - 0.12);
      if (under.length === 1) { pile = [c, under[0]]; break; }
    }
    if (pile) {
      propShot(pile[1], pile[1].p.clone(), new V3(0, 0, 1), 300);
      if (pile[0].state !== 2) fail('empilement : ' + pile[0].d.key + ' ne tombe pas quand son seul appui part');
      settle(25); below('empilement'); finite('empilement'); propsReset(); out.empilement = pile[0].d.key;
    }
    // cageot : un coup le déloge, ses parois disparaissent et ses fruits se répandent
    const cr = PHYS.bodies.find((b) => b.d.type === 'fruitBox');
    if (cr) {
      const inside = PHYS.bodies.filter((f) => f.d.type === 'fruit' && Math.abs(f.p.x - cr.p.x) < 0.4 && Math.abs(f.p.z - cr.p.z) < 0.3 && Math.abs(f.p.y - cr.p.y) < 0.4), walls = PHYS.pcols.filter((c) => c.crate && c.x0 > cr.p.x - 0.5 && c.x1 < cr.p.x + 0.5 && c.z0 > cr.p.z - 0.4 && c.z1 < cr.p.z + 0.4 && c.y0 > cr.p.y - 0.4);
      propShot(cr, cr.p.clone().add(new V3(-0.2, 0, 0)), new V3(1, 0.1, 0), 30);
      if (inside.length < 10) fail('cageot : ' + inside.length + ' fruits seulement trouvés dedans');
      if (inside.some((f) => f.state === 1)) fail('cageot : des fruits sont restés endormis dans un cageot délogé');
      if (walls.some((c) => c.y1 > 0)) fail('cageot : ses parois sont restées');
      settle(25); below('cageot'); finite('cageot');
      out.cageot = { fruits: inside.length, parois: walls.length };
      propsReset();
      if (walls.some((c) => c.y1 < 0)) fail('cageot : propsReset ne remet pas les parois');
    }
    // vélo : un coup de côté le renverse (d'un côté ou de l'autre : il peut être appuyé contre un mur)
    const bk = PHYS.bodies.find((b) => b.d.type === 'bicycle');
    if (bk) {
      let fell = false;
      for (const sx of [1, -1]) {
        propsReset(); propShot(bk, bk.p.clone().add(new V3(-0.2 * sx, 0.2, 0)), new V3(sx, 0, 0), 30); settle(25);
        below('vélo'); finite('vélo'); if (bk.R[4] < 0.5) fell = true;
      }
      if (!fell) fail('vélo : toujours debout après un coup de chaque côté');
      propsReset();
    }
    // état d'origine
    PHYS.bodies.forEach((b, i) => { const s = start[i]; if (Math.hypot(b.p.x - s[0], b.p.y - s[1], b.p.z - s[2]) > 1e-4 || b.state !== s[3]) fail('propsReset : corps ' + i + ' (' + b.d.key + ') mal remis'); });
    out.sol = PHYS.bodies.filter((b) => b.state === 1).length;
    return out;
  });
  console.log(JSON.stringify(R.types, null, 1));
  console.log(R.fruits ? 'fruits : ' + JSON.stringify(R.fruits) : '', '\n' + R.n + ' corps, ' + R.variants + ' variantes', R.chaises ? ', ' + R.chaises + ' chaises face à leur table' : '', R.empilement ? ', empilement (' + R.empilement + ')' : '', R.cageot ? ', cageot ' + JSON.stringify(R.cageot) : '');
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
  if (R.fails.length) { console.error('ÉCHEC :\n' + R.fails.join('\n')); process.exit(1); }
  console.log('props : tout est en ordre');
})();
