/* Accroches : les endroits où l'on reste coincé en marchant. node accroches.js [chemins=160] [--json]   (MAP=meltem ; PAGE=autre version)
   Un marcheur (un soldat de la carte, mené par le même contrôleur que le joueur et les bots : ctlMove, 07c-controller.js) suit, nœud après
   nœud, des chemins du réseau principal : d'une apparition à l'autre camp, puis entre des nœuds au sol tirés au hasard (graine fixe) à 25 à
   70 m l'un de l'autre. Il marche droit vers le nœud suivant (voisin dans le réseau, donc franchissable selon la navigation) ; s'il ne l'atteint
   pas en 2 s, c'est une accroche : le relief, une marche, un rebord, une boîte qui dépasse l'arrête là où le réseau dit qu'on passe. On le
   pose alors sur le nœud visé et il continue.
   Sortie : les accroches regroupées par case de 1 m, de la plus fréquente à la moins fréquente, avec la montée vers le nœud visé (au-delà de
   la marche automatique, STEP = 0,45 m, il faut sauter : les bots ne sautent pas) et les boîtes qui touchent le marcheur ; code d'erreur s'il
   en reste une. Compter une à deux minutes. */
const { openGame } = require('./common');
const json = process.argv.includes('--json'), nPaths = +(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 160);
(async () => {
  const map = process.env.MAP || 'sable';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate((nPaths) => {
    LOCK.fallback = true; startMatch({});
    const N = NAV.count, main = (i) => NAV.comp[i] === NAV.mainComp, lift = (i) => NAV.ny[i] - gy0(NAV.nx[i], NAV.nz[i]);
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    // plus court chemin (Dijkstra) en nœuds, sans lissage : chaque pas va d'un nœud à un voisin du réseau
    const path = (s, e) => {
      const dist = new Float64Array(N).fill(1e9), from = new Int32Array(N).fill(-1), H = [];
      const push = (k, id) => { H.push([k, id]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
      const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = i * 2 + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
      dist[s] = 0; push(0, s);
      while (H.length) { const [d, n] = pop(); if (n === e) break; if (d > dist[n]) continue; for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) { if (NAV.adjKind && NAV.adjKind[j]) continue; const m = NAV.adj[j], nd = d + NAV.adjCost[j]; if (nd < dist[m]) { dist[m] = nd; from[m] = n; push(nd, m); } } }
      if (dist[e] > 1e8) return null;
      const p = []; for (let n = e; n >= 0; n = from[n]) p.push(n); return p.reverse();
    };
    // les chemins : d'apparition en apparition adverse, puis au hasard entre nœuds au sol
    const gnd = []; for (let i = 0; i < N; i++) if (main(i) && lift(i) < 0.3) gnd.push(i);
    const pairs = [];
    const sp = (side) => (SPAWNS[side] || []).map(([x, z]) => navNode(x, gy0(x, z), z)).filter((i) => i >= 0 && main(i));
    const A = sp(0), B = sp(1); for (let k = 0; k < Math.min(A.length, B.length); k++) pairs.push([A[k], B[(k * 3) % B.length]]);
    for (let tries = 0; pairs.length < nPaths && tries < nPaths * 50; tries++) {
      const a = gnd[Math.floor(rnd() * gnd.length)], b = gnd[Math.floor(rnd() * gnd.length)], d = Math.hypot(NAV.nx[a] - NAV.nx[b], NAV.nz[a] - NAV.nz[b]);
      if (d >= 25 && d <= 70) pairs.push([a, b]);
    }
    // le marcheur : un soldat de la carte, retiré de la partie (les autres ne bougent pas : la boucle du jeu attend la fin de ce calcul)
    const w = entities.find((e) => !e.isPlayer); w.alive = true; w.health = 1e9;
    const I = w.input, dt = 1 / 30, out = new Map(); let steps = 0, simT = 0;
    const place = (i) => { w.pos.set(NAV.nx[i], NAV.ny[i] + 0.02, NAV.nz[i]); w.vel.set(0, 0, 0); w.onGround = true; w.slideT = 0; w.crouch = false; };
    for (const [s, e] of pairs) {
      const p = path(s, e); if (!p) continue;
      place(p[0]);
      for (let k = 1; k < p.length; k++) {
        const t = p[k], tx = NAV.nx[t], ty = NAV.ny[t], tz = NAV.nz[t]; let ok = false; steps++;
        for (let f = 0; f < 60; f++) {
          const dx = tx - w.pos.x, dz = tz - w.pos.z;
          if (Math.hypot(dx, dz) < 0.3 && Math.abs(w.pos.y - ty) < 0.7) { ok = true; break; }
          w.yaw = Math.atan2(-dx, -dz); I.mx = 0; I.mz = 1; I.sprint = false; I.jump = false; I.crouch = false; I.ads = false; I.slide = false;
          ctlMove(w, dt); simT += dt;
          if (w.pos.y < -20) break; // tombé
        }
        if (!ok) {
          const from = p[k - 1], key = Math.floor(w.pos.x) + ',' + Math.floor(w.pos.z) + ',' + Math.round(w.pos.y);
          let a = out.get(key);
          if (!a) {
            const touch = COL.filter((c) => !c.ray && w.pos.x > c.x0 - 0.6 && w.pos.x < c.x1 + 0.6 && w.pos.z > c.z0 - 0.6 && w.pos.z < c.z1 + 0.6 && c.y1 > w.pos.y + 0.05 && c.y0 < w.pos.y + 1.8).slice(0, 4)
              .map((c) => c.m + ' [' + [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((v) => +v.toFixed(2)).join(', ') + ']');
            out.set(key, a = { x: +w.pos.x.toFixed(2), y: +w.pos.y.toFixed(2), z: +w.pos.z.toFixed(2), vers: [tx, +ty.toFixed(2), tz], montee: +(ty - NAV.ny[from]).toFixed(2), fois: 0, zone: typeof zoneName === 'function' ? zoneName(w.pos.x, w.pos.z) : '', boites: touch });
          }
          a.fois++;
          place(t);
        }
      }
    }
    return { map: CURMAP.id, chemins: pairs.length, pas: steps, secondes: Math.round(simT), accroches: [...out.values()].sort((a, b) => b.fois - a.fois) };
  }, nPaths);
  await browser.close();
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.map} : ${R.chemins} chemins, ${R.pas} pas de nœud à nœud, ${R.secondes} s de marche simulée ; ${R.accroches.length} accroche${R.accroches.length > 1 ? 's' : ''}`);
    for (const a of R.accroches.slice(0, 60)) console.log(`  ACCROCHE (${a.x}, ${a.y}, ${a.z}) ${a.zone}, ${a.fois} fois, vers (${a.vers.join(', ')}), montée ${a.montee} m${a.montee > 0.45 ? ' (plus haut que la marche automatique : il faut sauter)' : ''} ; boîtes : ${a.boites.join(' ; ') || 'aucune'}`);
  }
  process.exit(R.accroches.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
