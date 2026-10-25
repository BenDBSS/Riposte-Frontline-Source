/* Mesures de level design d'une carte : node leveldesign.js [--json]   (MAP=meltem, MAP=sable... ; PAGE=autre version construite ;
   DOM="x,z x,z x,z" : d'autres points de domination à essayer)
   Charge la carte en domination (si elle en a) et mesure ce qui fait une bonne carte pour les trois modes :
   - apparitions : écart entre elles, distance de marche d'un camp à l'autre, nombre d'apparitions vues d'un adversaire (à moins de 60 m), de la base adverse ;
   - points de domination (A, B, C) : part praticable du disque de 5,5 m, distance de marche depuis chaque camp (A doit être plus proche d'Alpha,
     C de Bravo, B à égalité), ouverture de la vue (24 directions à hauteur d'yeux : moyenne, minimum, maximum, plafonnées à 80 m),
     nombre d'accès distincts (arcs praticables sur un anneau de 8 m), couverts à moins de 9 m, postes en hauteur qui voient le point,
     nombre d'apparitions qui le voient (rayon de 60 m), point couvert par un toit ;
   - routes : combien de routes distinctes (sans repasser à moins de 2,5 m d'une route déjà prise) relient les deux camps en moins de 1,6 fois
     la plus courte ; longueur de la plus courte ; virages de plus de 90° sur chaque route tendue (hors des bases) ;
   - goulot : la coupe la plus étroite du milieu de la carte entre les deux camps (flot maximal sur le réseau), en mètres de front et en
     passages séparés : un seul passage est un goulot absolu ; entrées à pied de chaque point de domination (ou « ouvert ») ;
   - vues : histogramme de la longueur de la vue (au ras du sol, 24 directions, tranches de 10 m) et les plus longues lignes de tir ;
   - verticalité : part du réseau au sol, à un étage (de 2,4 à 5 m), plus haut ; points d'intérêt par route (L, M, E) et en hauteur ;
   - lisibilité (une carte qui fait « labyrinthe ») : carrefours et impasses du réseau au sol, part de ruelle et de place, vue moyenne
     (distance moyenne au premier mur), détours (chemin le plus court sur vol d'oiseau), carrefours croisés sur la route la plus courte
     d'un camp à l'autre, et part du sol d'où l'on voit les repères de la carte (MAP_DEFS.<id>.landmarks : [x, y, z, nom]).
   Îles flottantes (MAP_DEFS.<id>.void) : une vue s'arrête au premier mur ou au dernier sol praticable sous le rayon (au-delà, personne ne
   peut s'y tenir) ; une direction qui ne donne que sur le vide n'entre pas dans les moyennes ; une impasse fermée surtout par le vide (coin
   d'île) compte à part, en « bouts d'île ».
   Carte en relief (dunes, MAP_DEFS.<id>.relief) : « au sol » et « en hauteur » se mesurent au-dessus du sable (gy0), pas au-dessus de y = 0,
   et une vue suit le terrain (jusqu'où un homme debout reste visible, masqué par le sable ou le décor). Zone ronde (MAP_DEFS.<id>.ring) : une
   vue s'arrête au bord de la zone, personne ne se tient au-delà.
   Les seuils de référence sont ceux de README, « Règles de conception d'une carte ». */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, settings: { quality: 'low', difficulty: 1, map: process.env.MAP || 'sable', mode: 'dom' }, noHdri: true });
  // DOM="x,z x,z x,z" : mesure d'autres points de domination que ceux de la carte (pour choisir où les poser)
  const domX = process.env.DOM ? process.env.DOM.trim().split(/\s+/).map((t) => t.split(',').map(Number)) : null;
  const R = await page.evaluate((domX) => {
    LOCK.fallback = true; if (domX) MAP_DEFS[CURMAP.id].dom = domX; startMatch({});
    const r1 = (v) => Math.round(v * 10) / 10, main = (id) => NAV.comp[id] === NAV.mainComp;
    const N = NAV.count, eyes = 1.6, lift = (i) => NAV.ny[i] - gy0(NAV.nx[i], NAV.nz[i]); // lift : hauteur au-dessus du sol implicite (relief d'une carte en dunes, sinon 0)
    // plus court chemin sur le réseau principal (Dijkstra, nœuds interdits facultatifs) : longueur en mètres, liste de nœuds
    const heap = [];
    const hpush = (k, id) => { heap.push([k, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const hpop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = i * 2 + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    const dijk = (sources, blocked) => {
      const dist = new Float64Array(N).fill(1e9), from = new Int32Array(N).fill(-1); heap.length = 0;
      for (const s of sources) { if (blocked && blocked[s]) continue; dist[s] = 0; hpush(0, s); }
      while (heap.length) {
        const [d, n] = hpop(); if (d > dist[n]) continue;
        for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) { if (NAV.adjKind && NAV.adjKind[j]) continue; const m = NAV.adj[j]; if (blocked && blocked[m]) continue; const nd = d + NAV.adjCost[j]; if (nd < dist[m]) { dist[m] = nd; from[m] = n; hpush(nd, m); } }
      }
      return { dist, from };
    };
    const nodeOf = (x, z, y) => navNode(x, y === undefined ? gy0(x, z) : y, z);
    const groups = (list) => list.map(([x, z]) => nodeOf(x, z)).filter((i) => i >= 0);
    const A = SPAWNS[0] || [], B = SPAWNS[1] || [], aN = groups(A), bN = groups(B);
    const out = { map: CURMAP.id, type: MAP_DEFS[CURMAP.id].type || null, bounds: [MAP.x0, MAP.x1, MAP.z0, MAP.z1], navNodes: N, mainNodes: N - Array.from({ length: N }, (_, i) => i).filter((i) => !main(i)).length, spawns: {}, dom: [], routes: {}, los: {}, vertical: {}, poi: {} };
    // --- apparitions
    const eye = (x, z, y) => [x, (y === undefined ? gy0(x, z) : y) + eyes, z];
    const visible = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz); return !rayWorld(a[0], a[1], a[2], dx / d, dy / d, dz / d, d - 0.2); };
    let minGap = 1e9; for (const [i, p] of A.entries()) for (const [j, q] of A.entries()) if (j > i) minGap = Math.min(minGap, Math.hypot(p[0] - q[0], p[1] - q[1]));
    const seen = (side, enemy) => side.map(([x, z]) => enemy.some(([ex, ez]) => Math.hypot(ex - x, ez - z) < 60 && visible(eye(x, z), eye(ex, ez)))).filter(Boolean).length;
    const dFrom = dijk(aN);
    out.spawns = { alpha: A.length, bravo: B.length, minGap: r1(minGap), seenByEnemySpawnAlpha: seen(A, B), seenByEnemySpawnBravo: seen(B, A), walkAlphaToBravoMin: r1(Math.min(...bN.map((b) => dFrom.dist[b]))), walkAlphaToBravoMax: r1(Math.max(...bN.map((b) => dFrom.dist[b]))) };
    // --- routes distinctes entre les camps
    const centroid = (L) => { const c = L.reduce((s, [x, z]) => [s[0] + x, s[1] + z], [0, 0]); return [c[0] / L.length, c[1] / L.length]; };
    const ca = nodeOf(...centroid(A)), cb = nodeOf(...centroid(B)), lens = [], paths = [], blocked = new Uint8Array(N);
    if (ca >= 0 && cb >= 0) for (let k = 0; k < 6; k++) {
      const { dist, from } = dijk([ca], blocked), L = dist[cb]; if (L > 1e8) break;
      lens.push(r1(L)); if (lens[k] > lens[0] * 1.6) { lens.pop(); break; }
      const path = []; for (let n = cb; n >= 0; n = from[n]) path.push(n);
      paths.push(path);
      for (const n of path) { const x = NAV.nx[n], y = NAV.ny[n], z = NAV.nz[n]; if (Math.hypot(x - NAV.nx[ca], z - NAV.nz[ca]) < 12 || Math.hypot(x - NAV.nx[cb], z - NAV.nz[cb]) < 12) continue; for (let m = 0; m < N; m++) if (Math.abs(NAV.ny[m] - y) < 1.2 && Math.hypot(NAV.nx[m] - x, NAV.nz[m] - z) < 2.5) blocked[m] = 1; }
    }
    out.routes = { distinctesSousUnTiersEtDemi: lens.length, longueurs: lens };
    // --- boucles, goulots, entrées, virages (README, « Leçons des grands jeux de tir »)
    // goulot : la coupe la plus étroite du milieu de la carte entre les deux camps. Flot maximal (Edmonds-Karp) sur le réseau principal dédoublé
    // (chaque nœud passe une unité : la coupe se compte en nœuds, une case de 1 m chacun, donc en mètres de front), de la moitié Alpha
    // (plus près d'Alpha de 20 m de marche) à la moitié Bravo ; la coupe est faite des nœuds atteints à l'entrée et pas à la sortie. Ses amas
    // (voisins à 1,6 m) sont les passages : un seul passage, c'est un goulot absolu (de_dust) ; trois, les trois couloirs (de_dust2).
    {
      const dAl = dFrom.dist, dBr = dijk(bN).dist, W = 20, INF = 1e6, SRC = 2 * N, SNK = 2 * N + 1, kind = new Int8Array(N); // 1 Alpha, 2 Bravo, 3 milieu
      for (let i = 0; i < N; i++) { if (!main(i) || dAl[i] > 1e8 || dBr[i] > 1e8) continue; const d = dAl[i] - dBr[i]; kind[i] = d < -W ? 1 : d > W ? 2 : 3; }
      const E = []; // arêtes [de, vers, capacité], l'arête inverse suit chaque arête
      for (let i = 0; i < N; i++) {
        if (!kind[i]) continue;
        E.push([2 * i, 2 * i + 1, kind[i] === 3 ? 1 : INF]);
        if (kind[i] === 1) E.push([SRC, 2 * i, INF]); if (kind[i] === 2) E.push([2 * i + 1, SNK, INF]);
        for (let j = NAV.adjStart[i]; j < NAV.adjStart[i + 1]; j++) { if (NAV.adjKind && NAV.adjKind[j]) continue; const m = NAV.adj[j]; if (kind[m]) E.push([2 * i + 1, 2 * m, INF]); }
      }
      const M = E.length * 2, to = new Int32Array(M), cap = new Float64Array(M), head = new Int32Array(2 * N + 2).fill(-1), nxt = new Int32Array(M);
      E.forEach(([a, b, c], k) => { to[2 * k] = b; cap[2 * k] = c; nxt[2 * k] = head[a]; head[a] = 2 * k; to[2 * k + 1] = a; cap[2 * k + 1] = 0; nxt[2 * k + 1] = head[b]; head[b] = 2 * k + 1; });
      const prev = new Int32Array(2 * N + 2), q2 = new Int32Array(2 * N + 2); let flow = 0;
      const bfs = () => { prev.fill(-2); prev[SRC] = -1; let h = 0, t = 0; q2[t++] = SRC; while (h < t) { const u = q2[h++]; for (let e = head[u]; e >= 0; e = nxt[e]) if (cap[e] > 0 && prev[to[e]] === -2) { prev[to[e]] = e; if (to[e] === SNK) return true; q2[t++] = to[e]; } } return false; };
      while (flow < 400 && bfs()) { for (let v = SNK; v !== SRC; v = to[prev[v] ^ 1]) { cap[prev[v]] -= 1; cap[prev[v] ^ 1] += 1; } flow++; }
      bfs(); // ce qu'on atteint encore depuis la source : la coupe passe entre l'entrée et la sortie des nœuds du milieu
      const cut = []; for (let i = 0; i < N; i++) if (kind[i] === 3 && prev[2 * i] !== -2 && prev[2 * i + 1] === -2) cut.push(i);
      const used = new Uint8Array(cut.length), passages = [];
      for (let a = 0; a < cut.length; a++) {
        if (used[a]) continue; const mem = [a]; used[a] = 1;
        for (let k = 0; k < mem.length; k++) for (let b = 0; b < cut.length; b++) { if (used[b]) continue; const i = cut[mem[k]], j = cut[b]; if (Math.hypot(NAV.nx[i] - NAV.nx[j], NAV.nz[i] - NAV.nz[j]) <= 1.6 && Math.abs(NAV.ny[i] - NAV.ny[j]) < 1.5) { used[b] = 1; mem.push(b); } }
        const x = mem.reduce((t, k) => t + NAV.nx[cut[k]], 0) / mem.length, z = mem.reduce((t, k) => t + NAV.nz[cut[k]], 0) / mem.length, y = mem.reduce((t, k) => t + lift(cut[k]), 0) / mem.length;
        passages.push({ ou: [r1(x), r1(z)], largeur: mem.length, ...(y > 1.5 ? { enHauteur: true } : {}), zone: typeof zoneName === 'function' ? zoneName(x, z) : '' });
      }
      out.goulot = { front: flow >= 400 ? '400+' : flow, passages: passages.length, detail: passages.sort((a, b) => b.largeur - a.largeur) };
    }
    // virages : chaque route tendue (on avance tant que la ligne droite reste praticable : réseau sous les pieds à moins de 0,75 m, pas de mur à
    // hauteur de genou), hors des 12 m de chaque base ; un changement de direction de plus de 90° est un virage serré (Midship : jamais plus de 90°)
    {
      const walk = (a, b) => {
        const x0 = NAV.nx[a], z0 = NAV.nz[a], y0 = NAV.ny[a], x1 = NAV.nx[b], z1 = NAV.nz[b], y1 = NAV.ny[b], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) return true;
        if (rayWorld(x0, y0 + 0.9, z0, (x1 - x0) / L, 0, (z1 - z0) / L, L)) return false; // à hauteur de genou, à plat
        for (let s = 0.5; s < L; s += 0.5) { const t = s / L, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t, i = nodeOf(x, z, y); if (i < 0 || !main(i) || Math.hypot(NAV.nx[i] - x, NAV.nz[i] - z) > 0.75 || Math.abs(NAV.ny[i] - y) > 0.8) return false; }
        return true;
      };
      out.virages = paths.map((path) => {
        const pts = [path[0]]; let i = 0;
        while (i < path.length - 1) { let j = Math.min(path.length - 1, i + 40); while (j > i + 1 && !walk(path[i], path[j])) j--; pts.push(path[j]); i = j; }
        let serres = 0, maxi = 0; const ou = [];
        for (let k = 1; k < pts.length - 1; k++) {
          const a = pts[k - 1], b = pts[k], c = pts[k + 1], x = NAV.nx[b], z = NAV.nz[b];
          if (Math.hypot(x - NAV.nx[ca], z - NAV.nz[ca]) < 12 || Math.hypot(x - NAV.nx[cb], z - NAV.nz[cb]) < 12) continue;
          const ux = x - NAV.nx[a], uz = z - NAV.nz[a], vx = NAV.nx[c] - x, vz = NAV.nz[c] - z, lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz); if (lu < 1.5 || lv < 1.5) continue;
          const ang = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / (lu * lv)))) * 180) / Math.PI; maxi = Math.max(maxi, ang);
          if (ang > 95) { serres++; ou.push([r1(x), r1(z), Math.round(ang)]); }
        }
        return { troncons: pts.length - 1, serres, maxi: Math.round(maxi), ou, trace: pts.map((n) => [r1(NAV.nx[n]), r1(NAV.nz[n])]) };
      });
    }
    // --- points de domination
    // vue dans une direction : distance au premier mur, plafonnée à 80 m et aux bornes. Îles flottantes (VOID) : la vue s'arrête aussi au dernier
    // sol praticable sous le rayon (au-delà, personne ne peut s'y tenir), et une direction qui ne donne que sur le vide ne compte pas (null)
    // carte en relief : un rayon horizontal passe au-dessus d'une cuvette et bute sur la pente d'en face, alors la vue suit le terrain. C'est la
    // distance jusqu'au premier endroit où un homme debout (yeux à 1,6 m au-dessus du sable) n'est plus vu : masqué par le sable (horizon
    // balayé tous les 0,5 m) ou par le décor (rayon des yeux aux yeux tous les 2 m)
    const capRelief = (x, z, dx, dz, y, lim) => {
      const e = Math.max(y, gy0(x, z)) + eyes; let hor = -1e9;
      for (let s = 0.5; s <= lim; s += 0.5) {
        const px = x + dx * s, pz = z + dz * s, g = gy0(px, pz), aim = (g + eyes - e) / s;
        if (aim < hor - 1e-4) return s;
        if (s % 2 === 0) { const ty = g + eyes - e, L = Math.hypot(s, ty), h = rayWorld(x, e, z, (dx * s) / L, ty / L, (dz * s) / L, L); if (h && h.t < L - 0.3) return (h.t * s) / L; }
        hor = Math.max(hor, (g - e) / s);
      }
      return lim;
    };
    const cap = (x, z, dx, dz, y = 0) => {
      let lim = 80; if (dx > 1e-6) lim = Math.min(lim, (MAP.x1 - x) / dx); if (dx < -1e-6) lim = Math.min(lim, (MAP.x0 - x) / dx); if (dz > 1e-6) lim = Math.min(lim, (MAP.z1 - z) / dz); if (dz < -1e-6) lim = Math.min(lim, (MAP.z0 - z) / dz); lim = Math.max(0.1, lim);
      if (RING.on) { const ox = x - RING.x, oz = z - RING.z, b = ox * dx + oz * dz, c = ox * ox + oz * oz - RING.r * RING.r; if (c < 0) lim = Math.max(0.1, Math.min(lim, -b + Math.sqrt(b * b - c))); }
      if (RELIEF.on) return capRelief(x, z, dx, dz, y, lim);
      const h = rayWorld(x, y + eyes, z, dx, 0, dz, lim), d = h ? h.t : lim;
      if (!VOID.on) return d;
      let last = 0;
      for (let s = 0.5; s <= d; s += 0.5) {
        const cx = Math.floor(x + dx * s - NAV.x0), cz = Math.floor(z + dz * s - NAV.z0); if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) break;
        if ((NAV.cells[cz * NAV.W + cx] || []).some((i) => main(i) && Math.abs(NAV.ny[i] - y) < 4)) last = s;
      }
      if (h && h.t <= last + 0.5) return d;
      return last < 2 ? null : Math.min(d, last + 0.5);
    };
    // vue d'un nœud dans la direction k sur 24, gardée (les vues et la lisibilité la demandent toutes deux)
    const capMemo = new Map(), capN = (i, k) => { const key = i * 24 + k; if (!capMemo.has(key)) { const a = (k / 24) * Math.PI * 2; capMemo.set(key, cap(NAV.nx[i], NAV.nz[i], Math.cos(a), Math.sin(a), NAV.ny[i])); } return capMemo.get(key); };
    const mean = (a) => { const v = a.filter((t) => t !== null); return v.length ? v.reduce((s, t) => s + t, 0) / v.length : 0; };
    const dA = dijk(aN), dB = dijk(bN);
    for (const p of DOM.pts) {
      const R = DOM.rad, id = nodeOf(p.x, p.z, p.y || 0);
      let n = 0; for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) { const x = Math.floor(p.x) + dx + 0.5, z = Math.floor(p.z) + dz + 0.5; if (Math.hypot(x - p.x, z - p.z) > R) continue; const cell = NAV.cells[(Math.floor(z) - NAV.z0) * NAV.W + Math.floor(x) - NAV.x0] || []; if (cell.some((i) => main(i) && Math.abs(NAV.ny[i] - (p.y || 0)) < 0.6)) n++; }
      const opens = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, v = cap(p.x, p.z, Math.cos(a), Math.sin(a), p.y || 0); if (v !== null) opens.push(v); }
      if (!opens.length) opens.push(0);
      // accès : arcs praticables (nœuds du réseau principal à 7 à 9 m, à la hauteur du point)
      const ring = new Array(48).fill(false); for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; for (const rr of [7, 8, 9]) { const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, i = nodeOf(x, z, p.y || 0); if (i >= 0 && main(i) && Math.hypot(NAV.nx[i] - x, NAV.nz[i] - z) < 0.8 && Math.abs(NAV.ny[i] - (p.y || 0)) < 0.7) ring[k] = true; } }
      let arcs = 0; for (let k = 0; k < 48; k++) if (ring[k] && !ring[(k + 47) % 48]) arcs++; const ouvert = Math.round((ring.filter(Boolean).length / 48) * 100);
      let cover = 0; for (const c of COL) { if (c.ray || c.inv || c.prop) continue; const h = c.y1 - c.y0; if (c.y0 > gy0((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2) + 0.4 || h < 0.8 || h > 2.2 || (c.x1 - c.x0) * (c.z1 - c.z0) > 8 || Math.max(c.x1 - c.x0, c.z1 - c.z0) > 4) continue; if (Math.hypot((c.x0 + c.x1) / 2 - p.x, (c.z0 + c.z1) / 2 - p.z) < 9) cover++; }
      let over = 0; for (let i = 0; i < N; i++) { if (!main(i) || NAV.ny[i] < (p.y || 0) + 2.2 || Math.hypot(NAV.nx[i] - p.x, NAV.nz[i] - p.z) > 25) continue; if (visible([NAV.nx[i], NAV.ny[i] + eyes, NAV.nz[i]], [p.x, (p.y || 0) + eyes, p.z])) over++; }
      const spawnsSee = (side) => side.filter(([x, z]) => Math.hypot(x - p.x, z - p.z) < 60 && visible(eye(x, z), eye(p.x, p.z, p.y || 0))).length;
      const roof = !!rayWorld(p.x, (p.y || 0) + eyes, p.z, 0, 1, 0, 8);
      // entrées à pied : amas de nœuds à 8 à 10 m de marche du centre (et à moins de 10,5 m à vol d'oiseau : pas un détour), voisins dans le
      // réseau ou à moins de 3 m (une caisse ou un poteau dans un passage ne le coupe pas en deux), d'au moins 3 nœuds (un passage de 1,5 m) ; un seul amas
      // qui fait presque tout le tour : un point ouvert (une place, une dune)
      let entrees = null;
      if (id >= 0) {
        const dd = dijk([id]).dist, band = new Uint8Array(N), L = [];
        for (let i = 0; i < N; i++) if (main(i) && dd[i] >= 8 && dd[i] <= 10 && Math.hypot(NAV.nx[i] - p.x, NAV.nz[i] - p.z) <= 10.5) { band[i] = 1; L.push(i); }
        const seenB = new Uint8Array(N), am = [];
        for (const i of L) {
          if (seenB[i]) continue; const st = [i], mem = []; seenB[i] = 1;
          while (st.length) { const n = st.pop(); mem.push(n); for (const m of L) if (!seenB[m] && Math.hypot(NAV.nx[m] - NAV.nx[n], NAV.nz[m] - NAV.nz[n]) <= 3 && Math.abs(NAV.ny[m] - NAV.ny[n]) < 1.5) { seenB[m] = 1; st.push(m); } }
          if (mem.length >= 3) am.push(mem);
        }
        const ang = new Array(36).fill(false); for (const i of L) ang[Math.floor(((Math.atan2(NAV.nz[i] - p.z, NAV.nx[i] - p.x) + Math.PI) / (2 * Math.PI)) * 36) % 36] = true;
        entrees = am.length === 1 && ang.filter(Boolean).length > 27 ? 'ouvert' : am.length;
      }
      out.dom.push({ point: [p.x, p.z], entrees, praticable: Math.round((n / (Math.PI * R * R)) * 100), vueMoyenne: r1(opens.reduce((s, v) => s + v, 0) / 24), vueMin: r1(Math.min(...opens)), vueMax: r1(Math.max(...opens)), accesDistincts: arcs, anneau8mPraticable: ouvert, couverts9m: cover, postesEnHauteurQuiVoient: over, apparitionsAlphaQuiVoient: spawnsSee(A), apparitionsBravoQuiVoient: spawnsSee(B), sousToit: roof });
    }
    // distance de marche moyenne depuis les apparitions de chaque camp
    for (const d of out.dom) {
      const id = nodeOf(d.point[0], d.point[1]); if (id < 0) continue;
      const m = (nodes) => { const ds = nodes.map((s) => dijk([s]).dist[id]).filter((v) => v < 1e8); return ds.length ? r1(ds.reduce((s, v) => s + v, 0) / ds.length) : null; };
      d.marcheMoyenneAlpha = m(aN); d.marcheMoyenneBravo = m(bN);
    }
    // --- longueur des vues au sol
    const hist = new Array(9).fill(0), longs = []; let ground = 0;
    for (let i = 0; i < N; i++) {
      if (!main(i) || lift(i) > 0.3) continue; ground++;
      let m = 0, ma = 0; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, d = capN(i, k); if (d !== null && d > m) { m = d; ma = a; } }
      hist[Math.min(8, Math.floor(m / 10))]++; if (m > 60) longs.push([r1(NAV.nx[i]), r1(NAV.nz[i]), Math.round(m), Math.round((ma * 180) / Math.PI)]);
    }
    out.los = { noeudsAuSol: ground, histogramme10m: hist, plusDe60m: longs.length, exemples: longs.filter((_, i) => i % Math.max(1, Math.ceil(longs.length / 12)) === 0) };
    // --- verticalité et points d'intérêt
    let g = 0, f1 = 0, f2 = 0; for (let i = 0; i < N; i++) { if (!main(i)) continue; const y = lift(i); if (y < 2.4) g++; else if (y < 5) f1++; else f2++; }
    out.vertical = { sol: g, unEtage: f1, plusHaut: f2, partEnHauteur: r1(((f1 + f2) / Math.max(1, g + f1 + f2)) * 100) };
    const lanes = {}; for (const p of POI) { const k = p[3] + (p[1] - gy0(p[0], p[2]) > 1.5 ? ' (haut)' : ''); lanes[k] = (lanes[k] || 0) + 1; }
    out.poi = { total: POI.length, parRoute: lanes, tenues: POI.filter((p) => p[4]).length };
    // --- lisibilité (une carte « labyrinthe ») : carrefours, impasses, vue moyenne, détours, carrefours sur la route la plus courte, repères visibles
    // Sur un cercle de 3 m autour de chaque nœud au sol (32 directions, rayon tiré à 1,7 m : seuls les murs comptent, pas les caisses) :
    // 2 arcs praticables dans une ruelle, 3 ou plus à un carrefour, 1 dans une impasse, le cercle entier sur une place.
    const gnd = []; for (let i = 0; i < N; i++) if (main(i) && lift(i) < 0.3) gnd.push(i);
    const kind = new Uint8Array(N); // 1 ruelle, 2 carrefour, 3 impasse, 4 place
    for (const i of gnd) {
      const x = NAV.nx[i], z = NAV.nz[i], K = 32, ring = new Array(K).fill(false);
      for (let k = 0; k < K; k++) {
        const a = (k / K) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), px = x + dx * 3, pz = z + dz * 3, j = nodeOf(px, pz);
        ring[k] = j >= 0 && main(j) && lift(j) < 0.6 && Math.hypot(NAV.nx[j] - px, NAV.nz[j] - pz) < 0.8 && !rayWorld(x, NAV.ny[i] + 1.7, z, dx, 0, dz, 3);
      }
      const open = ring.filter(Boolean).length; let arcs = 0; for (let k = 0; k < K; k++) if (ring[k] && !ring[(k + K - 1) % K]) arcs++;
      kind[i] = open >= K * 0.8 ? 4 : arcs >= 3 ? 2 : arcs === 1 && open <= K * 0.3 ? 3 : 1;
    }
    // un carrefour (une impasse) = un amas de nœuds voisins du même genre
    const clusters = (want) => { const seenK = new Uint8Array(N), out2 = []; for (const i of gnd) { if (kind[i] !== want || seenK[i]) continue; const st = [i], mem = []; seenK[i] = 1; while (st.length) { const n = st.pop(); mem.push(n); for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) { const m = NAV.adj[j]; if (!seenK[m] && kind[m] === want) { seenK[m] = 1; st.push(m); } } } out2.push(mem); } return out2; };
    const junc = clusters(2), clusterOf = new Int32Array(N).fill(-1); junc.forEach((c, k) => { for (const n of c) clusterOf[n] = k; });
    // îles flottantes (VOID) : une impasse que ferme surtout le vide (coin d'île, bout de quai) n'est pas un cul-de-sac de labyrinthe, on la
    // compte à part (« bouts d'île »), comme un bout de jetée voulu
    const voidEnd = (c) => {
      if (!VOID.on) return false;
      let shut = 0, empty = 0; const i = c[0], x = NAV.nx[i], z = NAV.nz[i];
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), j = nodeOf(x + dx * 3, z + dz * 3, 0);
        if (j >= 0 && main(j) && NAV.ny[j] < 0.6 && Math.hypot(NAV.nx[j] - x - dx * 3, NAV.nz[j] - z - dz * 3) < 0.8 && !rayWorld(x, 1.7, z, dx, 0, dz, 3)) continue;
        shut++; if (!rayWorld(x, 1.7, z, dx, 0, dz, 3) && groundHeight(x + dx * 3, z + dz * 3, 0.5, 0.05) <= VOID.floor + 1) empty++;
      }
      return empty >= shut * 0.5;
    };
    const dead0 = clusters(3).filter((c) => c.length >= 2), dead = dead0.filter((c) => !voidEnd(c)), ends = dead0.filter(voidEnd);
    const cnt = (v) => gnd.filter((i) => kind[i] === v).length;
    // vue moyenne : moyenne, sur les nœuds au sol, de la distance au premier mur dans 24 directions (plafonnée à 80 m)
    let vSum = 0; const vAll = []; for (const i of gnd) { const v = []; for (let k = 0; k < 24; k++) v.push(capN(i, k)); const s = mean(v); vSum += s; vAll.push(s); }
    vAll.sort((a, b) => a - b);
    // détours : chemin le plus court / distance à vol d'oiseau, entre des nœuds au sol pris sur une grille de 8 m (paires à plus de 12 m)
    const lat = new Map(); for (const i of gnd) { const key = Math.floor(NAV.nx[i] / 8) + ',' + Math.floor(NAV.nz[i] / 8); if (!lat.has(key)) lat.set(key, i); }
    const L8 = [...lat.values()], ratios = [];
    for (const s of L8) { const { dist } = dijk([s]); for (const t of L8) { if (t <= s) continue; const e = Math.hypot(NAV.nx[t] - NAV.nx[s], NAV.nz[t] - NAV.nz[s]); if (e < 12 || dist[t] > 1e8) continue; ratios.push(dist[t] / e); } }
    ratios.sort((a, b) => a - b);
    const q = (arr, f) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * f))] : 0);
    // carrefours croisés sur la route la plus courte d'un camp à l'autre (un amas compte une fois) : autant de décisions à prendre
    let onPath = 0, pathLen = 0;
    if (ca >= 0 && cb >= 0) { const { dist, from } = dijk([ca]); pathLen = dist[cb]; const met = new Set(); for (let n = cb; n >= 0; n = from[n]) if (clusterOf[n] >= 0) met.add(clusterOf[n]); onPath = met.size; }
    out.lisibilite = {
      noeudsAuSol: gnd.length, carrefours: junc.length, carrefoursPour1000m2: r1((junc.length / gnd.length) * 1000), impasses: dead.length, ...(VOID.on ? { boutsDIle: ends.length } : {}),
      partRuelle: r1((cnt(1) / gnd.length) * 100), partPlace: r1((cnt(4) / gnd.length) * 100),
      vueMoyenne: r1(vSum / gnd.length), vueMediane: r1(q(vAll, 0.5)), partVueMoyenneSous6m: r1((vAll.filter((v) => v < 6).length / vAll.length) * 100),
      detourMoyen: Math.round((ratios.reduce((s, v) => s + v, 0) / Math.max(1, ratios.length)) * 100) / 100, detour90: Math.round(q(ratios, 0.9) * 100) / 100,
      carrefoursRoutePlusCourte: onPath, carrefoursPour100m: r1((onPath / Math.max(1, pathLen)) * 100),
      impassesOu: dead.slice(0, 12).map((c) => [r1(NAV.nx[c[0]]), r1(NAV.nz[c[0]])]), ...(VOID.on ? { boutsDIleOu: ends.slice(0, 12).map((c) => [r1(NAV.nx[c[0]]), r1(NAV.nz[c[0]])]) } : {}),
    };
    // repères (MAP_DEFS.<id>.landmarks : [x, y, z, nom]) : part des nœuds au sol d'où on voit chacun, et au moins un
    const LM = CURMAP.landmarks || MAP_DEFS[CURMAP.id].landmarks || [];
    if (LM.length) {
      const seenBy = LM.map(() => 0); let any = 0;
      for (const i of gnd) { let ok = false; LM.forEach(([x, y, z], k) => { const a = [NAV.nx[i], NAV.ny[i] + 1.6, NAV.nz[i]], dx = x - a[0], dy = y - a[1], dz = z - a[2], d = Math.hypot(dx, dy, dz); if (d < 150 && !rayWorld(a[0], a[1], a[2], dx / d, dy / d, dz / d, d - 1.2)) { seenBy[k]++; ok = true; } }); if (ok) any++; }
      out.lisibilite.reperes = Object.fromEntries(LM.map((l, k) => [l[3] || String(k), r1((seenBy[k] / gnd.length) * 100)]));
      out.lisibilite.auMoinsUnRepere = r1((any / gnd.length) * 100);
    }
    return out;
  }, domX);
  await browser.close();
  if (json) { console.log(JSON.stringify(R, null, 1)); return; }
  console.log(`${R.map} : zone ${R.bounds.join(' ')} ; ${R.navNodes} nœuds (${R.mainNodes} dans le réseau principal)`);
  console.log('apparitions :', JSON.stringify(R.spawns));
  console.log('routes distinctes entre les camps :', JSON.stringify(R.routes));
  console.log('goulot (coupe la plus étroite du milieu) :', JSON.stringify(R.goulot));
  console.log('virages des routes :', JSON.stringify(R.virages));
  for (const d of R.dom) console.log('domination', JSON.stringify(d));
  console.log('vues :', JSON.stringify(R.los));
  console.log('verticalité :', JSON.stringify(R.vertical));
  console.log('points d\'intérêt :', JSON.stringify(R.poi));
  console.log('lisibilité :', JSON.stringify(R.lisibilite));
})();
