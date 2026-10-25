/* Contrôle de la navigation d'une carte (réseau des bots) : node navigation.js [x0 x1 z0 z1]   (MAP=meltem pour une autre carte que Khamsin)
   - les apparitions des deux camps, les points d'intérêt et les points de domination tombent-ils sur un nœud du plus grand réseau
     (à moins de 0,7 m pour une apparition, 1 m pour un point d'intérêt, à la bonne hauteur) ? Un point qui tombe dans un mur, sous un
     bateau ou sur un toit sans escalier envoie les bots ailleurs, ou nulle part ;
   - la part praticable du disque de chaque point de domination (au moins 70 %, voir « Modes de jeu et réapparition » du README) ;
   - les nœuds hors du réseau principal, par zone (toits sans accès, intérieurs aux portes trop étroites, dessus de caisses) ;
   - le dessin de la zone demandée (par défaut le côté sud, z de 0 à 48), une lettre par case de 1 m : « . » sol, « : » marches,
     « + » toit ou passerelle (plus de 2,4 m au-dessus du sol, du sable sur une carte en relief), « # » très haut, « x » seulement des nœuds hors du réseau principal, « S » apparition, « P » point
     d'intérêt, « D » point de domination.
   La grille de navigation (README, « IA des bots ») a un nœud au centre de chaque case de 1 m et exige 0,42 m de dégagement : une porte, une
   arche ou une trouée de parapet doit être large d'au moins 1,2 m et centrée sur un centre de case (n + 0,5), sinon elle se franchit à la main
   mais pas pour les bots ; sous une trémie, une rampe d'au moins 1,9 m de large ; un escalier de toit finit sur un palier plein, de plain-pied.
   Sort en erreur si une apparition, un point d'intérêt ou un point de domination est hors réseau. */
const { openGame } = require('./common');
const [x0, x1, z0, z1] = process.argv.slice(2).map(Number);
(async () => {
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, settings: { quality: 'low', difficulty: 1, map: process.env.MAP || 'sable', mode: 'dom' }, noHdri: true });
  const r = await page.evaluate(([x0, x1, z0, z1]) => {
    LOCK.fallback = true; startMatch({});
    const main = (id) => NAV.comp[id] === NAV.mainComp;
    const near = (x, y, z) => { const id = navNode(x, y, z); return id < 0 ? null : { d: Math.hypot(NAV.nx[id] - x, NAV.nz[id] - z), dy: NAV.ny[id] - y }; };
    const bad = [], marks = new Map();
    const note = (k, x, z) => marks.set(Math.floor(x) + ',' + Math.floor(z), k);
    SPAWNS.forEach((side, t) => side.forEach(([x, z], i) => { const c = near(x, gy0(x, z), z); note('S', x, z); if (!c || c.d > 0.7) bad.push(`apparition ${t === 0 ? 'Alpha' : 'Bravo'} ${i} (${x}, ${z}) : ${c ? c.d.toFixed(1) + ' m du nœud le plus proche' : 'aucun nœud'}`); }));
    POI.forEach((p, i) => { const c = near(p[0], p[1], p[2]); note('P', p[0], p[2]); if (!c || c.d > 1.0 || Math.abs(c.dy) > 1.0) bad.push(`point d'intérêt ${i} (${p[0]}, ${p[1]}, ${p[2]}) : ${c ? c.d.toFixed(1) + ' m, écart de hauteur ' + c.dy.toFixed(1) : 'aucun nœud'}`); });
    const dom = DOM.pts.map((p) => {
      let n = 0; const R = DOM.rad;
      for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        const x = Math.floor(p.x) + dx + 0.5, z = Math.floor(p.z) + dz + 0.5; if (Math.hypot(x - p.x, z - p.z) > R) continue;
        const cell = NAV.cells[(Math.floor(z) - NAV.z0) * NAV.W + Math.floor(x) - NAV.x0] || []; if (cell.some((id) => main(id) && NAV.ny[id] < 0.5 + (p.y || 0))) n++;
      }
      note('D', p.x, p.z); const frac = n / (Math.PI * R * R); if (frac < 0.7) bad.push(`point de domination (${p.x}, ${p.z}) : ${(frac * 100).toFixed(0)} % praticable (70 % au moins)`);
      return [p.x, p.z, +(frac * 100).toFixed(0)];
    });
    const zones = new Map(); let other = 0;
    for (let id = 0; id < NAV.count; id++) if (!main(id)) { other++; const z = zoneName(NAV.nx[id], NAV.nz[id]); zones.set(z, (zones.get(z) || 0) + 1); }
    const X0 = Number.isFinite(x0) ? x0 : MAP.x0, X1 = Number.isFinite(x1) ? x1 : MAP.x1, Z0 = Number.isFinite(z0) ? z0 : 0, Z1 = Number.isFinite(z1) ? z1 : MAP.z1 - 1, rows = [];
    for (let z = Z0; z <= Z1; z++) {
      let s = '';
      for (let x = X0; x < X1; x++) {
        const k = marks.get(x + ',' + z); if (k) { s += k; continue; }
        const cell = NAV.cells[(z - NAV.z0) * NAV.W + (x - NAV.x0)] || []; let c = ' ', top = -9;
        for (const id of cell) { if (main(id)) top = Math.max(top, NAV.ny[id] - gy0(NAV.nx[id], NAV.nz[id])); else if (c === ' ') c = 'x'; } // hauteur au-dessus du sable (relief)
        if (top > -9) c = top > 5 ? '#' : top > 2.4 ? '+' : top > 0.3 ? ':' : '.';
        s += c;
      }
      rows.push(String(z).padStart(4) + ' ' + s);
    }
    return { count: NAV.count, mainCount: NAV.count - other, dom, zones: [...zones.entries()].sort((a, b) => b[1] - a[1]), bad, rows, X0, X1 };
  }, [x0, x1, z0, z1]);
  console.log(`${r.count} nœuds, ${r.mainCount} dans le réseau principal, domination : ${JSON.stringify(r.dom)}`);
  console.log('nœuds hors réseau par zone :', r.zones.map(([k, v]) => `${k} ${v}`).join(', ') || 'aucun');
  let hdr = '     '; for (let x = r.X0; x < r.X1; x++) hdr += x % 10 === 0 ? String(Math.abs(x / 10) % 10) : ' ';
  console.log(hdr); console.log(r.rows.join('\n'));
  await browser.close();
  if (r.bad.length) { console.error('ÉCHEC :\n' + r.bad.join('\n')); process.exit(1); }
  console.log("navigation : apparitions, points d'intérêt et domination sur le réseau");
})();
