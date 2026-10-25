/* Atteinte : ce qu'un joueur peut gagner en marchant et en sautant depuis un endroit, dans une zone de la carte. node atteinte.js [x0 x1 z0 z1] [--de x,z] [--seuil 2] [--max 40]   (MAP=meltem ; PAGE=autre version)
   Un point de départ (--de x,z et la hauteur y où l'on se tient, au sol par défaut ; sans lui, le milieu de la zone) puis tout ce qui s'ensuit, avec les vraies règles du contrôleur (07c-controller.js) :
   - marche : pas de 25 cm dans huit directions, refusé si collideCircle (rayon 0,36, 1,75 m) repousse le soldat, sur le sol que rend groundHeight
     (marche automatique de STEP = 0,45 m, chute depuis un rebord) ;
   - saut : élan de 6,3 m/s, pesanteur de 19 m/s² (1,04 m d'apex), seize directions, vitesses de 0, 3, celle de la course (MOVE_SPEED, 4,75 m/s), du sprint
     (SPRINT_MUL, 7,4 m/s) et du saut de glissade (SLIDE.max, 10,3 m/s, l'élan est gardé), lues dans le jeu, pas de 1/60 s, mêmes collisions en vol, plafond qui coupe l'élan, retombée sur la première surface atteinte.
     La vitesse du saut est limitée par l'élan : il faut 0,75 m de marche en ligne droite derrière le point de départ (à 20° près), sur un sol
     d'au moins 0,8 m de large, pour 4,4 m/s et 2,4 m pour le sprint et le saut de glissade ; sur un garde-corps de 10 cm, on ne saute qu'à l'arrêt.
   Les sauts ne partent que des bords (un voisin refusé, plus haut ou plus bas) : sauter du milieu d'une surface plane ne gagne rien que son bord
   ne gagne mieux, avec le même élan.
   Sortie : les endroits qu'un saut (ou une chaîne de sauts) atteint et que la marche seule n'atteint pas, à plus de --seuil m (2 par défaut) de haut
   au-dessus du sol, regroupés par case de 1 m : hauteur, nombre de positions, boîte de collision qui porte, et le chemin depuis le départ (sauts
   marqués ; on passe les supports de moins de 28 cm de large, garde-corps, parapets minces et vitres, où personne ne s'installe, mais ce qu'on atteint depuis eux compte).
   C'est ce que le joueur ne doit pas pouvoir faire : sauter sur un muret, sur un garde-corps puis plus haut, grimper un toit par ses
   corniches. Un toit voulu praticable est ouvert par un escalier : il n'apparaît pas ici. Code d'erreur s'il reste un endroit.
   La zone se donne en mètres (par défaut tout le jeu de la carte, lent : compter 20 s pour 400 m², une minute pour 1 500 m²). */
const { openGame } = require('./common');
const args = process.argv.slice(2), num = args.slice(0, args.findIndex((a) => a.startsWith('--')) < 0 ? args.length : args.findIndex((a) => a.startsWith('--'))).filter((a) => /^-?\d+(\.\d+)?$/.test(a)).map(Number);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
(async () => {
  const map = process.env.MAP || 'sable';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', map } });
  const R = await page.evaluate(([zone, de, seuil, max]) => {
    const [X0, X1, Z0, Z1] = zone.length === 4 ? zone : [MAP.x0, MAP.x1, MAP.z0, MAP.z1], C = 0.25, DT = 1 / 60;
    const ix = (x) => Math.round((x - X0) / C), iz = (z) => Math.round((z - Z0) / C), key = (x, z, h) => (ix(x) * 4096 + iz(z)) * 4096 + Math.round(h / 0.05);
    const inside = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
    const standable = (x, z, h) => ceilingAbove(x, z, h + 0.05, 0.3) > h + 1.2;
    const start = de || [(X0 + X1) / 2, (Z0 + Z1) / 2];
    // vitesses d'élan lues dans le jeu (07c-controller.js) : marche, sprint, saut de glissade (4,4, 6,8 et 9,7 m/s avant la 5.1)
    const VW = MOVE_SPEED, VS = MOVE_SPEED * (typeof SPRINT_MUL === 'number' ? SPRINT_MUL : 1.55), VG = SLIDE.max;
    // 1) la marche seule, 2) la marche et les sauts ; chaque nœud garde son père (n.p) et la manière d'y arriver (n.k : 0 marche, 1 saut)
    // élan : la plus longue marche en ligne droite, au même niveau (à 0,3 m près) et sur un sol d'au moins 0,8 m de large (sur un garde-corps ou
    // un chaperon étroit, on ne court pas), derrière le point de départ pour un saut dans la direction th (à 20° près de chaque côté : en l'air,
    // l'élan ne tourne guère)
    const p2 = { x: 0, y: 0, z: 0 };
    const elan = (n, th) => {
      let best = 0;
      for (const dl of [0, -0.35, 0.35]) {
        const bx = -Math.cos(th + dl), bz = -Math.sin(th + dl); let L = 0;
        for (let i = 1; i <= 10; i++) {
          const x = n.x + bx * C * i, z = n.z + bz * C * i; p2.x = x; p2.y = n.h; p2.z = z; collideCircle(p2, 0.36, 1.75);
          if (Math.abs(p2.x - x) + Math.abs(p2.z - z) > 0.03 || Math.abs(groundHeight(x, z, n.h, 0.3) - n.h) > 0.3) break;
          let large = true; // un sol de chaque côté, à 0,4 m
          for (const sg of [1, -1]) large = large && Math.abs(groundHeight(x - bz * 0.4 * sg, z + bx * 0.4 * sg, n.h, 0.3) - n.h) <= 0.3;
          if (!large) break;
          L = i * C;
        }
        best = Math.max(best, L);
      }
      return best;
    };
    const run = (jumps) => {
      const nodes = new Map(), q = [];
      const sx = Math.round(start[0] / C) * C, sz = Math.round(start[1] / C) * C, sh = groundHeight(sx, sz, (start[2] ?? 0) + 0.1, 0.3);
      const add = (x, z, h, p, k, v) => {
        if (!inside(x, z)) return; // la position reste exacte (rien n'est ramené dans un mur) ; seule la clé est à la case de 25 cm
        const kk = key(x, z, h); if (nodes.has(kk) || !standable(x, z, h)) return;
        const n = { x, z, h, p, k, v }; nodes.set(kk, n); q.push(n);
      };
      add(sx, sz, sh, null, 0, 0);
      const pos = { x: 0, y: 0, z: 0 };
      for (let qi = 0; qi < q.length; qi++) {
        const n = q[qi];
        let bord = false;
        for (let d = 0; d < 8; d++) {
          const nx = n.x + Math.round(Math.cos(d * Math.PI / 4)) * C, nz = n.z + Math.round(Math.sin(d * Math.PI / 4)) * C;
          pos.x = nx; pos.y = n.h; pos.z = nz; collideCircle(pos, 0.36, 1.75);
          if (Math.abs(pos.x - nx) + Math.abs(pos.z - nz) > 0.03) { bord = true; continue; }
          const g = groundHeight(nx, nz, n.h, 0.3);
          if (Math.abs(g - n.h) > 0.1) bord = true;
          add(nx, nz, g, n, 0, 0);
        }
        if (!jumps || !bord) continue;
        for (const v of [0, 3, VW, VS, VG]) for (let a = 0; a < (v ? 16 : 1); a++) {
          if (v > 0 && elan(n, a * Math.PI / 8) < (v > VW ? 2.4 : v > 3 ? 0.75 : 0.25)) continue;
          const vx = Math.cos(a * Math.PI / 8) * v, vz = Math.sin(a * Math.PI / 8) * v;
          pos.x = n.x; pos.y = n.h; pos.z = n.z; let vy = 6.3;
          for (let f = 0; f < 120; f++) {
            pos.x += vx * DT; pos.z += vz * DT;
            collideCircle(pos, 0.36, 1.75);
            vy -= 19 * DT; pos.y += vy * DT;
            if (!inside(pos.x, pos.z)) break;
            const g = groundHeight(pos.x, pos.z, Math.max(pos.y, pos.y - vy * DT), 0.3);
            if (vy > 0) { const c = ceilingAbove(pos.x, pos.z, pos.y + 0.3, 0.3); if (c < pos.y + 1.75 + 0.05) vy = 0; }
            if (pos.y <= g && vy <= 0) { add(pos.x, pos.z, g, n, 1, v); break; }
          }
        }
      }
      return nodes;
    };
    const W = run(false), J = run(true);
    // les positions que les sauts ajoutent, loin du sol (au sol local : le relief ou 0), hors de ce que la marche atteint à moins de 0,3 m près
    const walkH = new Map(); for (const n of W.values()) { const k = ix(n.x) * 4096 + iz(n.z); (walkH.get(k) || walkH.set(k, []).get(k)).push(n.h); }
    const extra = [];
    for (const n of J.values()) {
      let connu = false; // une position de la marche à moins de 0,35 m (cases voisines comprises) et à moins de 0,3 m de haut
      for (let a = -1; a <= 1 && !connu; a++) for (let b = -1; b <= 1 && !connu; b++) connu = (walkH.get((ix(n.x) + a) * 4096 + iz(n.z) + b) || []).some((h) => Math.abs(h - n.h) < 0.3);
      if (connu) continue;
      if (n.h - gy0(n.x, n.z) < seuil) continue;
      // un garde-corps, un parapet ou une vitre mince porte un pied sans que personne s'y installe : on le passe, mais ce qui s'atteint depuis lui reste compté
      const bx = queryBoxes(n.x - 0.1, n.z - 0.1, n.x + 0.1, n.z + 0.1).find((c) => !c.ray && Math.abs(c.y1 - n.h) < 0.02 && n.x >= c.x0 - 0.2 && n.x <= c.x1 + 0.2 && n.z >= c.z0 - 0.2 && n.z <= c.z1 + 0.2);
      if (bx && Math.min(bx.x1 - bx.x0, bx.z1 - bx.z0) < 0.28) continue;
      extra.push(n);
    }
    const cases = new Map();
    for (const n of extra) { const k = Math.floor(n.x) + ',' + Math.floor(n.z); const c = cases.get(k) || { x: Math.floor(n.x), z: Math.floor(n.z), n: 0, h0: 99, h1: -99, top: n }; c.n++; c.h0 = Math.min(c.h0, n.h); c.h1 = Math.max(c.h1, n.h); cases.set(k, c); }
    const chemin = (n) => { const out = []; for (let m = n; m; m = m.p) out.push(`${m.k ? 'SAUT ' + m.v + ' m/s ' : ''}(${m.x.toFixed(2)}, ${m.h.toFixed(2)}, ${m.z.toFixed(2)})`); return out.reverse(); };
    const boite = (n) => { const b = queryBoxes(n.x - 0.1, n.z - 0.1, n.x + 0.1, n.z + 0.1).filter((c) => !c.ray && Math.abs(c.y1 - n.h) < 0.02 && n.x >= c.x0 - 0.2 && n.x <= c.x1 + 0.2 && n.z >= c.z0 - 0.2 && n.z <= c.z1 + 0.2)[0]; return b ? `${b.m || '?'} [${b.x0.toFixed(2)}..${b.x1.toFixed(2)}, ${b.y0.toFixed(2)}..${b.y1.toFixed(2)}, ${b.z0.toFixed(2)}..${b.z1.toFixed(2)}]` : 'rampe ou sol'; };
    return { carte: CURMAP.id, depart: start, marche: W.size, sauts: J.size, extra: extra.length,
      cases: [...cases.values()].sort((a, b) => b.h1 - a.h1).slice(0, max).map((c) => ({ x: c.x, z: c.z, n: c.n, h0: +c.h0.toFixed(2), h1: +c.h1.toFixed(2), boite: boite(c.top), chemin: chemin(c.top) })) };
  }, [num.length === 4 ? num : [], opt('--de', '') ? opt('--de').split(',').map(Number) : null, +opt('--seuil', 2), +opt('--max', 40)]); // --max : nombre de cases listées (comparaison de deux versions)
  await browser.close();
  console.log(`${R.carte} : ${R.marche} positions à la marche, ${R.sauts} avec les sauts, ${R.extra} gagnées par les sauts à plus de ${opt('--seuil', 2)} m du sol, ${R.cases.length} cases de 1 m`);
  for (const c of R.cases) {
    console.log(`  case (${c.x}, ${c.z}) : ${c.n} positions, de ${c.h0} à ${c.h1} m ; ${c.boite}`);
    console.log('    ' + c.chemin.filter((s, i, a) => i === 0 || s.startsWith('SAUT') || i === a.length - 1).join(' > '));
  }
  if (R.cases.length) process.exit(1);
})();
