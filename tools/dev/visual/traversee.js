/* Traversée d'une carte sans sauter : node traversee.js [--json]   (MAP=meltem ; PAGE=autre version)
   Retour du propriétaire (octobre 2026) : « je dois pouvoir me déplacer d'un bout à l'autre de la carte sans me retrouver bloqué par un
   obstacle sur ma route que je dois sauter ». Le réseau des bots (03-nav.js) a des liens de marche et des liens de saut (navLeaps : montée,
   enjambement, chute). Ce contrôle compare, entre les points clés (une apparition de chaque camp, les points de domination, les points
   d'intérêt au sol), le plus court chemin avec les sauts et le plus court chemin à la marche seule (marche automatique de 0,45 m, rampes,
   escaliers) :
   - les paires sans chemin à la marche, ou dont le chemin à la marche est plus long de plus de 25 % ;
   - les sauts que prennent les plus courts chemins (avec sauts) entre toutes les paires, regroupés par case de 1 m, du plus emprunté au
     moins emprunté : ce sont les obstacles à corriger sur les routes (muret, caisse, bordure, rebord de plus de 0,45 m) ;
   - les zones de plain-pied (moins de 0,6 m au-dessus du sol) du réseau principal qu'on n'atteint qu'en sautant, par paquets d'au moins
     4 m² (une pièce dont le seuil est trop haut, un recoin fermé par une caisse) ; les dessus de caisses et les toits, voulus, n'y sont pas.
   Code d'erreur s'il reste une paire sans chemin à la marche ou plus longue de 25 %. Compter une minute par carte. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'sable';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', difficulty: 1, map, mode: 'dom' } });
  const R = await page.evaluate(() => {
    LOCK.fallback = true; startMatch({});
    const N = NAV.count, main = (i) => NAV.comp[i] === NAV.mainComp, lift = (i) => NAV.ny[i] - gy0(NAV.nx[i], NAV.nz[i]);
    const dij = (s, walk) => {
      const dist = new Float64Array(N).fill(1e9), from = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1), H = [];
      const push = (k, id) => { H.push([k, id]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
      const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = i * 2 + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
      dist[s] = 0; push(0, s);
      while (H.length) {
        const [d, n] = pop(); if (d > dist[n]) continue;
        for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) {
          if (walk && NAV.adjKind[j]) continue;
          const m = NAV.adj[j], nd = d + NAV.adjCost[j];
          if (nd < dist[m]) { dist[m] = nd; from[m] = n; via[m] = j; push(nd, m); }
        }
      }
      return { dist, from, via };
    };
    // points clés : une apparition par camp (la première), les points de domination, les points d'intérêt de plain-pied
    const keys = [];
    const add = (name, x, y, z) => { const id = navNode(x, y, z); if (id >= 0 && main(id)) keys.push({ name, id, x: +x.toFixed(1), z: +z.toFixed(1) }); };
    SPAWNS.forEach((side, t) => { if (side[0]) add(t ? 'apparition Bravo' : 'apparition Alpha', side[0][0], gy0(side[0][0], side[0][1]), side[0][1]); });
    DOM.pts.forEach((p, i) => add('point ' + 'ABC'[i], p.x, p.y !== undefined ? p.y : gy0(p.x, p.z), p.z));
    POI.forEach((p, i) => { if (p[1] - gy0(p[0], p[2]) < 0.6) add('intérêt ' + i, p[0], p[1], p[2]); });
    const full = keys.map((k) => dij(k.id, false)), walk = keys.map((k) => dij(k.id, true));
    const pairs = [], leaps = new Map();
    for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
      const df = full[a].dist[keys[b].id], dw = walk[a].dist[keys[b].id];
      if (df > 1e8) continue;
      if (dw > 1e8 || dw > df * 1.25) pairs.push({ de: keys[a].name, vers: keys[b].name, avec: +df.toFixed(0), marche: dw > 1e8 ? null : +dw.toFixed(0) });
      for (let n = keys[b].id; full[a].from[n] >= 0; n = full[a].from[n]) {
        const j = full[a].via[n]; if (!NAV.adjKind[j]) continue;
        const p = full[a].from[n], k = Math.floor(NAV.nx[p]) + ',' + Math.floor(NAV.nz[p]);
        const e = leaps.get(k) || { x: +NAV.nx[p].toFixed(1), z: +NAV.nz[p].toFixed(1), y0: +NAV.ny[p].toFixed(2), y1: +NAV.ny[n].toFixed(2), kind: NAV.adjKind[j], n: 0 };
        e.n++; leaps.set(k, e);
      }
    }
    // zones de plain-pied atteintes seulement en sautant (depuis l'apparition Alpha)
    const w0 = walk[0] ? walk[0].dist : null, cells = new Map();
    if (w0) for (let i = 0; i < N; i++) if (main(i) && w0[i] > 1e8 && lift(i) < 0.6) { const k = Math.floor(NAV.nx[i] / 2) + ',' + Math.floor(NAV.nz[i] / 2); cells.set(k, (cells.get(k) || 0) + 1); }
    // paquets de cases de 2 m voisines
    const seen = new Set(), zones = [];
    for (const k of cells.keys()) {
      if (seen.has(k)) continue;
      const st = [k], z = { n: 0, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; seen.add(k);
      while (st.length) { const c = st.pop(), [cx, cz] = c.split(',').map(Number); z.n += cells.get(c); z.x0 = Math.min(z.x0, cx * 2); z.x1 = Math.max(z.x1, cx * 2 + 2); z.z0 = Math.min(z.z0, cz * 2); z.z1 = Math.max(z.z1, cz * 2 + 2); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (cx + dx) + ',' + (cz + dz); if (cells.has(q) && !seen.has(q)) { seen.add(q); st.push(q); } } }
      if (z.n >= 4) zones.push(z);
    }
    const KIND = ['', 'montée', 'chute', 'enjambement'];
    return {
      carte: CURMAP.id, points: keys.length, paires: keys.length * (keys.length - 1) / 2, mauvaises: pairs,
      sauts: [...leaps.values()].sort((a, b) => b.n - a.n).slice(0, 30).map((e) => ({ ...e, kind: KIND[e.kind] || e.kind })),
      zones: zones.sort((a, b) => b.n - a.n).slice(0, 20),
    };
  });
  await browser.close();
  if (json) { console.log(JSON.stringify(R)); return; }
  console.log(`${R.carte} : ${R.points} points clés, ${R.paires} paires ; ${R.mauvaises.length} sans chemin à la marche ou plus longues de 25 %`);
  for (const p of R.mauvaises) console.log(`  ${p.de} > ${p.vers} : ${p.avec} m avec sauts, ${p.marche === null ? 'aucun chemin' : p.marche + ' m'} à la marche`);
  if (R.sauts.length) console.log('sauts sur les plus courts chemins (case, hauteurs, nombre de chemins) :');
  for (const s of R.sauts) console.log(`  (${s.x}, ${s.z}) ${s.kind} de ${s.y0} à ${s.y1} m : ${s.n}`);
  if (R.zones.length) console.log("zones de plain-pied qu'on n'atteint qu'en sautant :");
  for (const z of R.zones) console.log(`  x ${z.x0} à ${z.x1}, z ${z.z0} à ${z.z1} : ${z.n} nœuds`);
  if (R.mauvaises.length) process.exit(1);
})();
