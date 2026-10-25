/* Contrôle des placements du décor d'une carte : node decor.js [--json]   (MAP=meltem ; les portes viennent du registre CYC.doors de Meltem)
   Cherche ce qui se voit en jouant :
   - un obstacle (mur de décor, prop, objet posé) dans le couloir de 1,5 m devant une porte, hors des pots rangés contre le montant et des murs
     qui prolongent le tableau (dans un mur épais, le couloir commence au parement) (une porte
     qu'on ne franchit pas, avec le réseau de navigation d'un seul côté, est signalée comme telle : porte peinte, fermée, tournée vers l'extérieur) ;
   - un pot enfoncé dans un mur, ou en l'air sans appui (un rebord de fenêtre est un appui), ou au milieu d'une ruelle ;
   - un arbre planté dans une ruelle de moins de 3,4 m, ou dont la couronne couvre une porte ;
   - un escalier qui ne mène pas au réseau de navigation, ou dont le pied ou la tête touche une porte ;
   - une affiche ou un panneau mural du kit portuaire ou de Val-Blanc (decal3Quad, decal2Quad) sans mur juste derrière lui (posé en travers d'une porte,
     il flotte dans le vide) ou caché dans un volume, posé sur une fenêtre ou une porte d'un mur de façade (wallPierced), qui dépasse du mur ou touche
     son bout, ou pas centré dans son panneau de mur quand celui-ci fait moins de 3,5 m (entre deux fenêtres, entre une fenêtre et un coin) ;
   - un vélo (prop qui bascule) dont le cadre entre dans un mur : il n'en bouge plus quand on lui tire dessus ;
   - un obstacle à la tête d'un pont suspendu (îles flottantes, BRIDGES) : sur 5 m dans le prolongement du pont et sur sa largeur plus 0,5 m de
     chaque côté, rien de plus haut que 0,5 m (bloc, stèle, rocher, arbre, caisse, rampe) ; on sort d'un pont sur un palier dégagé (ce qui
     l'encadre, plus à côté, reste permis).
   - carte en relief (dunes) : un objet posé (prefab) dont une partie entre dans le sable ou dont le pied flotte (rochers, arbres et herbes
     exceptés) ;
   - toutes les cartes : deux choses qui se recouvrent : les boîtes de collision d'un objet posé ou d'un prop physique qui entrent de plus de
     8 cm dans celles d'une autre construction ou d'un autre objet, une perche de bâche (smTarp) qui traverse quelque chose.
   Sortie : une ligne par défaut, avec l'endroit et la fonction qui l'a posé ; code d'erreur s'il y a une porte gênée, un pot enfoncé ou en l'air,
   une affiche qui flotte, un vélo dans un mur ou une tête de pont encombrée.
   Le journal des placements est tenu en enveloppant Maker.place avant la construction de la carte (rien n'est gardé dans le jeu). */
const { openGame } = require('./common');
const json = process.argv.includes('--json'), liste = process.argv.includes('--affiches'); // --affiches : toutes les affiches et panneaux muraux, avec leur position et leur face
(async () => {
  const map = process.env.MAP || 'sable';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noMap: true, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate(async (map) => {
    const PL = [], P = Maker.prototype, old = P.place;
    P.place = function (pf, x, y, z, ry, o) {
      if (this === DECOR && !/^(gravel|stone|chunk|pebbles|litter|weed|brick|shard|pile|grass|rubble|scrap|paper|leaf|moss|dirt|crack|puddle|debris|splat)/i.test(pf.name)) { // le menu débris du sol (scatterGround) n'est pas un obstacle
        this._n(); const e = this.m.elements;
        PL.push({ n: pf.name, x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14], nocol: !!(o && o.nocol), fn: ((new Error().stack.split('\n')[2] || '').trim().replace(/^at /, '').replace(/ \(.*$/, '')) });
      }
      return old.apply(this, arguments);
    };
    // portes des autres cartes : on note les ouvertures de plain-pied (au moins 1,9 m de haut, de 0 à 5 cm du sol) que posent wallPierced et wallOpen,
    // sauf celles fermées exprès (ferme: true dans l'ouverture : le portail d'un tunnel muré ou bouché, qui n'est pas un passage)
    const DOORS = [], WALLS = [];
    if (map !== 'meltem') {
      const wp = wallPierced, wo = wallOpen;
      wallPierced = function (M, key, len, y, h, ops, o) {
        // le mur et toutes ses ouvertures (portes et fenêtres) dans le monde : le repère de la façade a x le long du mur, z vers l'extérieur ; sert à poser les affiches
        if (M === DECOR) { const e = M.m.elements, tl = Math.hypot(e[0], e[2]) || 1, nl = Math.hypot(e[8], e[10]) || 1; WALLS.push({ ox: e[12], oz: e[14], tx: e[0] / tl, tz: e[2] / tl, nx: e[8] / nl, nz: e[10] / nl, s: tl, len, y0: e[13] + y, y1: e[13] + y + h, ops: (ops || []).map((q) => ({ x0: q.x0, x1: q.x1, y0: e[13] + q.y0, y1: e[13] + q.y1 })) }); }
        for (const op of ops || []) if (op.y0 <= 0.05 && op.y1 - op.y0 >= 1.9 && y <= 0.05 && !op.ferme) { const e = M.m.elements, xc = (op.x0 + op.x1) / 2, nl = Math.hypot(e[8], e[10]) || 1; DOORS.push({ x: e[0] * xc + e[12], z: e[2] * xc + e[14], nx: e[8] / nl, nz: e[10] / nl, w: op.x1 - op.x0, kind: 'façade' }); }
        return wp.apply(this, arguments);
      };
      wallOpen = function (key, axis, fixed, t, a0, a1, y0, h, ops, o) {
        for (const op of ops || []) if (op.b0 <= 0.05 && op.b1 - op.b0 >= 1.9 && y0 <= 0.05 && !op.ferme) { const c = (op.a0 + op.a1) / 2, w = op.a1 - op.a0; for (const sg of [1, -1]) DOORS.push(axis === 'x' ? { x: c, z: fixed, nx: 0, nz: sg, w, t, kind: 'passage' } : { x: fixed, z: c, nx: sg, nz: 0, w, t, kind: 'passage' }); }
        return wo.apply(this, arguments);
      };
    }
    // affiches et panneaux muraux (kit portuaire : decal3Quad ; Val-Blanc : decal2Quad) : leurs quatre coins dans le monde (les prefabs ont leur propre
    // atelier, pas DECOR) ; pour Val-Blanc, les décalques au sol (normale vers le haut) sont écartés comme pour le port
    const DEC = [], dq = typeof decal3Quad === 'function' ? decal3Quad : null, dq2 = typeof decal2Quad === 'function' ? decal2Quad : null;
    const decNote = (pf, kit) => function (M, i, p0, p1, p2, p3, n) {
      if (M === DECOR) {
        const e = M.m.elements, T = (q) => [e[0] * q[0] + e[4] * q[1] + e[8] * q[2] + e[12], e[1] * q[0] + e[5] * q[1] + e[9] * q[2] + e[13], e[2] * q[0] + e[6] * q[1] + e[10] * q[2] + e[14]];
        const N = [e[0] * n[0] + e[4] * n[1] + e[8] * n[2], e[1] * n[0] + e[5] * n[1] + e[9] * n[2], e[2] * n[0] + e[6] * n[1] + e[10] * n[2]];
        if (Math.abs(N[1]) < 0.5) DEC.push({ i, kit, P: [p0, p1, p2, p3].map(T), N, fn: (new Error().stack.split('\n')[3] || '').trim().replace(/^at /, '').replace(/ \(.*$/, '') });
      }
      return pf.apply(this, arguments);
    };
    if (dq) decal3Quad = decNote(dq, 'port');
    if (dq2) decal2Quad = decNote(dq2, 'hiver');
    // objets posés (Maker.put dans le décor) et propriétaire de chaque boîte de collision : une construction du décor commence à un save()
    // de premier niveau ; une boîte posée hors de tout save() appartient à la fonction qui l'a posée
    const PUTS = [], oput = P.put, osave = P.save, ocol = WORLD.col, frame = () => new Error().stack.split('\n').slice(2).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*$/, '')).find((f) => !/^(P\.|Maker\.|Object\.|WORLD\.|smPlace|smFlat|smTarp)/.test(f)) || '?'; // la fonction de la carte qui pose
    let own = 0, cur = 0, loose = '', looseId = 0;
    P.save = function () { if (this === DECOR && this.stack.length === 0) cur = ++own; return osave.apply(this, arguments); };
    WORLD.col = function () { const r = ocol.apply(this, arguments), c = COL[COL.length - 1]; if (DECOR.stack.length) c.own = cur; else { const f = frame(); if (f !== loose) { loose = f; looseId = ++own; } c.own = looseId; c.ownFn = f; } return r; };
    P.put = function (pf) {
      if (this !== DECOR) return oput.apply(this, arguments);
      this._n(); const c0 = COL.length, r = oput.apply(this, arguments), id = ++own;
      for (let k = c0; k < COL.length; k++) COL[k].own = id;
      PUTS.push({ pf, m: this.m.elements.slice(), id, fn: frame() });
      return r;
    };
    // perches des bâches de Simoun (smTarp) : leurs pieds dans le monde, et la construction de la bâche (les collisions de ses perches ne
    // comptent pas contre elles-mêmes)
    const POLES = [], otarp = typeof smTarp === 'function' ? smTarp : null;
    if (otarp) smTarp = function (x, y, z, rot, w, d, h0, h1) {
      const c = Math.cos(rot), sn = Math.sin(rot), n0 = POLES.length;
      for (const sx of [-1, 1]) for (const [sz, h] of [[-1, h0], [1, h1]]) { const lx = sx * w / 2, lz = sz * d / 2; POLES.push({ x: x + lx * c + lz * sn, z: z - lx * sn + lz * c, y0: y, y1: y + h, fn: frame() }); }
      const r = otarp.apply(this, arguments);
      for (let k = n0; k < POLES.length; k++) POLES[k].own = cur;
      return r;
    };
    Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({});
    P.place = old; P.put = oput; P.save = osave; WORLD.col = ocol; if (dq) decal3Quad = dq; if (dq2) decal2Quad = dq2; if (otarp) smTarp = otarp;
    const r1 = (v) => Math.round(v * 10) / 10;
    const solids = COL.filter((c) => !c.ray && !c.inv && !c.prop), propBoxes = COL.filter((c) => !c.ray && c.prop);
    const inBox = (c, x, z, y0, y1) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 > y0 && c.y0 < y1;
    const scan = (x, z, dx, dz, ya = gy0(x, z) + 0.3, yb = gy0(x, z) + 1.8) => { for (let d = 0.1; d <= 6; d += 0.1) { const px = x + dx * d, pz = z + dz * d; for (const c of queryBoxes(px, pz, px, pz)) { if (c.ray || c.inv || c.prop || c.y1 < ya || c.y0 > yb || (c.x1 - c.x0) * (c.z1 - c.z0) < 1.2 || Math.max(c.x1 - c.x0, c.z1 - c.z0) < 1.5) continue; if (px >= c.x0 && px <= c.x1 && pz >= c.z0 && pz <= c.z1) return d; } } return 6; };
    const width = (x, z) => Math.min(scan(x, z, 1, 0) + scan(x, z, -1, 0), scan(x, z, 0, 1) + scan(x, z, 0, -1));
    const wallDist = (x, z, ya, yb) => Math.min(scan(x, z, 1, 0, ya, yb), scan(x, z, -1, 0, ya, yb), scan(x, z, 0, 1, ya, yb), scan(x, z, 0, -1, ya, yb));
    const zone = (x, z) => zoneName(x, z);
    const out = { all: DEC.map((d) => ({ i: d.i, kit: d.kit, c: [0, 1, 2].map((k) => r1((d.P[0][k] + d.P[2][k]) / 2)), N: [r1(d.N[0]), r1(d.N[2])] })), doors: 0, doorBlocked: [], potsBad: [], trees: [], stairs: [], decals: DEC.length, decalsBad: [], bikesBad: [], heads: 0, headsBlocked: [], placed: PL.length, sand: [], overlaps: [], relief: RELIEF.on };
    const doors = map === 'meltem' && CYC.doors ? CYC.doors : DOORS;
    out.doors = doors.length;
    // 1. devant les portes
    for (const D of doors) {
      // le couloir d'un passage dans un mur épais (rempart) commence au parement, pas au milieu du mur ; un mur qui prolonge le tableau de la
      // porte (ruelle aussi large qu'elle) ne la gêne pas : seuls comptent les murs qui entrent dans sa largeur
      const tx = -D.nz, tz = D.nx, hits = new Map(), d0 = Math.max(0, (D.t || 0) / 2 - 0.4);
      for (let a = -(D.w / 2 + 0.15); a <= D.w / 2 + 0.15; a += 0.15) for (let d = 0.45 + d0; d <= 1.5 + d0; d += 0.15) {
        const x = D.x + D.nx * d + tx * a, z = D.z + D.nz * d + tz * a;
        for (const c of solids) if (Math.abs(a) < D.w / 2 - 0.01 && inBox(c, x, z, 0.5, 1.9)) hits.set('décor ' + [c.x0, c.x1, c.z0, c.z1].map(r1).join(','), d);
        for (const c of propBoxes) if (inBox(c, x, z, 0.05, 1.9) && !(Math.abs(a) > D.w / 2 - 0.05 && c.prop && /pot|jar|planter|vase|urn/i.test(c.prop.d.type))) hits.set('prop ' + c.prop.d.type + ' (' + r1(c.prop.origin.x) + ', ' + r1(c.prop.origin.z) + ')', d);
      }
      for (const p of PL) {
        if (p.nocol) continue;
        const dx = p.x - D.x, dz = p.z - D.z, d = dx * D.nx + dz * D.nz, a = dx * tx + dz * tz;
        if (d > 0.1 && d < 1.7 && Math.abs(a) < D.w / 2 + 0.3) hits.set('posé ' + p.n + ' (' + r1(p.x) + ', ' + r1(p.z) + ') par ' + p.fn, d);
      }
      // une porte qu'on ne franchit pas (réseau de navigation d'un seul côté : porte peinte, fermée, sur l'extérieur de la carte) est signalée comme telle
      const navAt = (x, z) => { const c = NAV.cells[(Math.floor(z) - NAV.z0) * NAV.W + Math.floor(x) - NAV.x0]; return !!c && c.some((i) => NAV.ny[i] < gy0(x, z) + 0.6); };
      const open = navAt(D.x - D.nx * 1.2, D.z - D.nz * 1.2) && navAt(D.x + D.nx * 1.2, D.z + D.nz * 1.2);
      if (hits.size) out.doorBlocked.push({ porte: D.kind + ' (' + r1(D.x) + ', ' + r1(D.z) + ') normale (' + D.nx + ', ' + D.nz + ') ' + zone(D.x, D.z) + (open ? '' : ' (porte qu\u0027on ne franchit pas)'), devant: [...hits.keys()], open });
    }
    // 2. pots
    for (const b of PHYS.bodies) {
      if (b.pooled || !/pot|jar|planter|vase|urn/i.test(b.d.type)) continue;
      const { x, y, z } = b.origin, why = [], up = y - gy0(x, z); // hauteur au-dessus du sol (du sable, sur une carte en relief)
      if (solids.some((c) => inBox(c, x, z, y + 0.14, y + 0.3))) why.push('enfoncé dans un mur ou un volume');
      if (up > 0.25) {
        // appuis : murs et volumes, autres corps, et collisions réservées aux objets (PHYS.pcols : étagère, dalle de balcon)
        const wall = wallDist(x, z, y - 0.3, y + 0.6), sup = [...solids, ...propBoxes, ...(PHYS.pcols || [])].some((c) => c !== b.cols[0] && x >= c.x0 - 0.1 && x <= c.x1 + 0.1 && z >= c.z0 - 0.1 && z <= c.z1 + 0.1 && Math.abs(c.y1 - y) < 0.15);
        if (!sup && !(wall < 0.4 && up > 0.8)) why.push('en l\'air à ' + r1(up) + ' m (sans appui, hors rebord)');
      }
      const w = width(x, z), wd = wallDist(x, z);
      if (up < 0.3 && w <= 3.2 && wd > 0.6) why.push('au milieu d\'une ruelle de ' + r1(w) + ' m');
      if (why.length) out.potsBad.push({ pot: b.d.type + ' (' + r1(x) + ', ' + r1(y) + ', ' + r1(z) + ') ' + zone(x, z), defauts: why });
    }
    // 3. arbres
    for (const p of PL) {
      if (!/tree|palm|olive|fig|cypress|plane|tamarisk|pine|fir|spruce|linden|willow|bamboo|banana|fern|hedge|topiary|oak|birch|maple|cherry|ginkgo|conifer|larch/i.test(p.n)) continue;
      const nm = /([\d]+(?:\.[\d]+)?)/.exec(p.n), h = nm ? Math.min(14, +nm[1]) : 5, rc = /cypress|topiary|fir|spruce|pine|conifer|larch/i.test(p.n) ? 0.5 + h * 0.05 : h * 0.42, w = width(p.x, p.z), why = [];
      if (w <= 3.4) why.push('dans une ruelle de ' + r1(w) + ' m');
      for (const D of doors) { const dx = p.x - D.x, dz = p.z - D.z, d = dx * D.nx + dz * D.nz, a = dx * -D.nz + dz * D.nx; if (d > -0.5 && d < 3.0 && Math.abs(a) < rc + D.w / 2) why.push('couvre la porte ' + D.kind + ' (' + r1(D.x) + ', ' + r1(D.z) + ')'); }
      out.trees.push({ arbre: p.n + ' (' + r1(p.x) + ', ' + r1(p.z) + ') rayon de couronne ~' + r1(rc) + ' m ' + zone(p.x, p.z) + ' par ' + p.fn, defauts: why });
    }
    // 4. escaliers
    for (const r of RAMPS) {
      const lo = r.h0 <= r.h1 ? 0 : 1, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const foot = r.axis === 'x' ? [lo ? r.x1 : r.x0, cz] : [cx, lo ? r.z1 : r.z0], head = r.axis === 'x' ? [lo ? r.x0 : r.x1, cz] : [cx, lo ? r.z0 : r.z1], why = [];
      const ok = (pt, y) => { const id = navNode(pt[0], y, pt[1]); return id >= 0 && Math.hypot(NAV.nx[id] - pt[0], NAV.nz[id] - pt[1]) < 1.2 && Math.abs(NAV.ny[id] - y) < 0.8; };
      if (!ok(foot, Math.min(r.h0, r.h1))) why.push('le pied (' + r1(foot[0]) + ', ' + r1(foot[1]) + ') n\'est pas sur le réseau');
      if (!ok(head, Math.max(r.h0, r.h1))) why.push('la tête (' + r1(head[0]) + ', ' + r1(head[1]) + ') n\'est pas sur le réseau');
      for (const D of doors) for (const [nm, pt] of [['pied', foot], ['tête', head]]) if (Math.hypot(D.x - pt[0], D.z - pt[1]) < 2.2) why.push('porte ' + D.kind + ' (' + r1(D.x) + ', ' + r1(D.z) + ') à ' + r1(Math.hypot(D.x - pt[0], D.z - pt[1])) + ' m du ' + nm);
      // sol libre devant la première marche (README, Finitions : 1,5 m au moins) : boîtes pleines entre 0,1 et 1,7 m au-dessus du pied, dans
      // l'axe de la volée, sur sa largeur moins 30 cm de chaque côté (un garde-corps qui la longe ne compte pas)
      {
        const yf = Math.min(r.h0, r.h1), dir = r.axis === 'x' ? [lo ? 1 : -1, 0] : [0, lo ? 1 : -1], half = (r.axis === 'x' ? r.z1 - r.z0 : r.x1 - r.x0) / 2 - 0.3;
        let free = 1.5;
        for (const c of solids) {
          if (c.y1 < yf + 0.1 || c.y0 > yf + 1.7) continue;
          for (let t = 0.05; t < free; t += 0.1) for (const a of [-half, 0, half]) {
            const px = foot[0] + dir[0] * t + (r.axis === 'x' ? 0 : a), pz = foot[1] + dir[1] * t + (r.axis === 'x' ? a : 0);
            if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) { free = Math.min(free, t); break; }
          }
        }
        if (free < 1.45) why.push('sol libre devant la première marche : ' + r1(free) + ' m (1,5 au moins)');
      }
      out.stairs.push({ escalier: [r.x0, r.x1, r.z0, r.z1].map(r1).join(' ') + ' axe ' + r.axis + ' de ' + r.h0 + ' à ' + r.h1 + ' ' + zone(cx, cz), defauts: why });
    }
    // 5. affiches murales : un mur 12 cm derrière le centre et les quatre coins (à 70 % du centre), rien 15 cm devant
    const inSolid = (q) => solids.some((c) => q[0] >= c.x0 - 0.02 && q[0] <= c.x1 + 0.02 && q[1] >= c.y0 - 0.02 && q[1] <= c.y1 + 0.02 && q[2] >= c.z0 - 0.02 && q[2] <= c.z1 + 0.02);
    for (const d of DEC) {
      const c = [0, 1, 2].map((k) => (d.P[0][k] + d.P[2][k]) / 2), pts = [c].concat(d.P.map((q) => [0, 1, 2].map((k) => c[k] + (q[k] - c[k]) * 0.7)));
      const miss = pts.filter((q) => !inSolid([0, 1, 2].map((k) => q[k] - d.N[k] * 0.12))).length, hid = inSolid([0, 1, 2].map((k) => c[k] + d.N[k] * 0.15));
      // au-dessus d'un bâtiment (une boîte de 4 m ou plus dans sa colonne, sous elle) : un pignon ou une corniche, que la collision ne couvre pas (horloge de pignon)
      const gable = solids.some((b) => b.y1 >= 4 && b.y1 <= Math.min(...d.P.map((q) => q[1])) + 0.05 && c[0] - d.N[0] * 0.12 >= b.x0 - 0.3 && c[0] - d.N[0] * 0.12 <= b.x1 + 0.3 && c[2] - d.N[2] * 0.12 >= b.z0 - 0.3 && c[2] - d.N[2] * 0.12 <= b.z1 + 0.3);
      const why = [miss && !gable ? 'sans mur derrière (' + miss + ' points sur 5)' : '', hid ? 'cachée dans un volume' : ''].filter(Boolean);
      // le mur de façade (wallPierced) qui la porte : même plan à 30 cm près, même sens ; ses ouvertures et le vide autour d'elle, dans le plan du mur
      const W = WALLS.find((w) => w.nx * d.N[0] + w.nz * d.N[2] > 0.9 && Math.abs((c[0] - w.ox) * w.nx + (c[2] - w.oz) * w.nz) < 0.3 && ((c[0] - w.ox) * w.tx + (c[2] - w.oz) * w.tz) / w.s > -0.05 && ((c[0] - w.ox) * w.tx + (c[2] - w.oz) * w.tz) / w.s < w.len + 0.05 && c[1] >= w.y0 - 0.05 && c[1] <= w.y1 + 0.05);
      // ouvertures et centrage : seulement pour les affiches (port : 0 à 3 ; hiver : poster, poster2, départs) : un graffiti, une horloge ou une coulure a des bords transparents
      const poster = d.kit === 'port' ? d.i <= 3 : d.i === 4 || d.i === 5 || d.i === 6;
      if (W && poster) {
        const U = (q) => ((q[0] - W.ox) * W.tx + (q[2] - W.oz) * W.tz) / W.s, us = d.P.map(U), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...d.P.map((q) => q[1])), v1 = Math.max(...d.P.map((q) => q[1])), uc = (u0 + u1) / 2;
        const hit = W.ops.filter((q) => u1 > q.x0 - 0.03 && u0 < q.x1 + 0.03 && v1 > q.y0 - 0.03 && v0 < q.y1 + 0.03); // 3 cm de tolérance autour de l'ouverture (le cadre est dessiné par-dessus)
        if (hit.length) why.push('sur une ouverture (fenêtre ou porte à ' + hit.map((q) => r1(q.x0) + ' à ' + r1(q.x1) + ' m du bout du mur, de ' + r1(q.y0) + ' à ' + r1(q.y1) + ' m de haut').join(', ') + ' ; mur de ' + r1(W.len) + ' m posé en (' + r1(W.ox) + ', ' + r1(W.oz) + '), de ' + r1(W.y0) + ' à ' + r1(W.y1) + ' m)');
        if (u0 < 0.05 || u1 > W.len - 0.05) why.push('dépasse du mur ou touche son bout (' + r1(u0) + ' à ' + r1(u1) + ' m, mur de ' + r1(W.len) + ' m)');
        // centrage : le vide du mur autour d'elle, à sa hauteur, entre ouvertures et bouts du mur
        const band = W.ops.filter((q) => v1 > q.y0 && v0 < q.y1), left = Math.max(0, ...band.filter((q) => q.x1 <= u0 + 0.05).map((q) => q.x1)), right = Math.min(W.len, ...band.filter((q) => q.x0 >= u1 - 0.05).map((q) => q.x0)), off = Math.abs(uc - (left + right) / 2);
        if (right - left < 3.5 && off > 0.3 && !hit.length) why.push('pas centrée dans son panneau de mur (' + r1(off) + ' m de décalage, panneau de ' + r1(right - left) + ' m entre ' + r1(left) + ' et ' + r1(right) + ')');
      }
      if (why.length) out.decalsBad.push({ affiche: 'n° ' + d.i + ' (' + c.map(r1).join(', ') + ') face vers (' + r1(d.N[0]) + ', ' + r1(d.N[2]) + ') ' + zone(c[0], c[2]) + ' par ' + d.fn, defauts: why.concat(W && !why.some((w) => /mur de/.test(w)) ? ['(mur de façade de ' + r1(W.len) + ' m posé en (' + r1(W.ox) + ', ' + r1(W.oz) + '))'] : []) });
    }
    // 6. vélos (props qui basculent) : le cadre, de roue à roue à mi-hauteur, hors des murs
    for (const b of PHYS.bodies) {
      if (b.pooled || !b.d.topple) continue;
      propRot(b); const R = b.R, ax = [R[2], R[5], R[8]];
      const inWall = [-0.5, -0.25, 0, 0.25, 0.5].some((t) => inSolid([b.p.x + ax[0] * t, gy0(b.p.x, b.p.z) + 0.5, b.p.z + ax[2] * t]));
      if (inWall) out.bikesBad.push({ velo: b.d.type + ' (' + r1(b.origin.x) + ', ' + r1(b.origin.z) + ') ' + zone(b.origin.x, b.origin.z), defauts: ['le cadre entre dans un mur'] });
    }
    // 7. têtes des ponts suspendus : 5 m dans le prolongement, largeur du pont plus 0,5 m de chaque côté, rien de plus haut que 0,5 m (les poteaux
    //    des ponts, aux coins des têtes, ne comptent pas)
    const BR = typeof BRIDGES !== 'undefined' ? BRIDGES : []; // (une version plus ancienne du jeu, PAGE=..., n'a pas de registre des ponts)
    const posts = BR.flatMap((b) => [b.a0 - 0.35, b.a1 + 0.35].flatMap((a) => [-1, 1].map((sd) => (b.axis === 'z' ? [b.c + sd * (b.w / 2 + 0.16), a] : [a, b.c + sd * (b.w / 2 + 0.16)]))));
    const isPost = (c) => posts.some(([x, z]) => Math.abs((c.x0 + c.x1) / 2 - x) < 0.05 && Math.abs((c.z0 + c.z1) / 2 - z) < 0.05);
    for (const b of BR) for (const end of [0, 1]) {
      const e = end ? b.a1 : b.a0, sg = end ? 1 : -1, lo = Math.min(e, e + sg * 5), hi = Math.max(e, e + sg * 5), u0 = b.c - b.w / 2 - 0.5, u1 = b.c + b.w / 2 + 0.5;
      const [x0, x1, z0, z1] = b.axis === 'z' ? [u0, u1, lo, hi] : [lo, hi, u0, u1], hits = new Set();
      for (const c of COL) {
        if (c.ray || c.inv || c.y1 <= 0.5 || c.y0 >= 2 || c.x1 <= x0 || c.x0 >= x1 || c.z1 <= z0 || c.z0 >= z1 || isPost(c)) continue;
        const p = PL.find((q) => q.x >= c.x0 - 0.6 && q.x <= c.x1 + 0.6 && q.z >= c.z0 - 0.6 && q.z <= c.z1 + 0.6);
        hits.add((c.prop ? 'prop ' + c.prop.d.type : p ? 'posé ' + p.n + ' par ' + p.fn : 'décor') + ' (' + [c.x0, c.x1, c.z0, c.z1].map(r1).join(', ') + ', haut de ' + r1(c.y1) + ' m)');
      }
      for (const r of RAMPS) if (r.x1 > x0 && r.x0 < x1 && r.z1 > z0 && r.z0 < z1) hits.add('rampe (' + [r.x0, r.x1, r.z0, r.z1].map(r1).join(', ') + ')');
      out.heads++;
      if (hits.size) out.headsBlocked.push({ tete: 'pont ' + b.axis + ' = ' + r1(b.c) + ' de ' + r1(b.a0) + ' à ' + r1(b.a1) + ', bout ' + r1(e) + ' ' + zone((x0 + x1) / 2, (z0 + z1) / 2), devant: [...hits] });
    }
    // 8. carte en relief : un objet posé (prefab) ne doit ni entrer dans le sable (un sommet à plus de 15 cm au-dessus de son pied, sous le
    //    sable de plus de 8 cm) ni flotter (un sommet de son pied à plus de 25 cm au-dessus du sable) ; rochers, arbres, roseaux et herbes
    //    exceptés (un rocher s'enfonce, un tronc pousse dans la pente)
    if (RELIEF.on) {
      const skip = /^(smRock|smScree|palm|smPalmFar|smReeds|cyGrass|cyBush|smAcacia|tree|bush)/i; // (éboulis et buissons de Simoun : rochers et herbes)
      for (const u of PUTS) {
        if (skip.test(u.pf.name)) continue;
        const e = u.m, upright = e[5] / Math.hypot(e[4], e[5], e[6]) > 0.9; let deep = 0, nDeep = 0, high = 0, nHigh = 0, nBase = 0; // un objet couché n'a plus de pied
        for (const part of u.pf.parts.values()) {
          const Pp = part.g.P;
          for (let i = 0; i < part.g.nv; i++) {
            const x = Pp[i * 3], y = Pp[i * 3 + 1], z = Pp[i * 3 + 2], wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14], g = gy0(wx, wz);
            if (y > 0.15 && g - wy > 0.08) { nDeep++; deep = Math.max(deep, g - wy); }
            if (y < 0.03 && upright) { nBase++; const sup = Math.max(g, groundHeight(wx, wz, wy - STEP + 0.05, 0.05)); if (wy - sup > 0.25) { nHigh++; high = Math.max(high, wy - sup); } } // appui : le sable ou un plancher
          }
        }
        const why = [];
        if (nDeep) why.push(nDeep + ' sommets dans le sable, jusqu\u0027à ' + r1(deep) + ' m');
        if (nHigh > nBase * 0.25) why.push('en l\u0027air : ' + nHigh + ' sommets du pied sur ' + nBase + ', jusqu\u0027à ' + r1(high) + ' m');
        if (why.length) out.sand.push({ objet: u.pf.name + ' (' + r1(e[12]) + ', ' + r1(e[14]) + ') ' + zone(e[12], e[14]) + ' par ' + u.fn, defauts: why });
      }
    }
    // 9. toutes les cartes : deux choses ne se recouvrent pas (les boîtes d'un objet posé ou d'un prop dans celles d'une autre construction ou
    //    d'un autre objet, une perche de bâche qui traverse quelque chose)
    {
      const label = new Map(); for (const u of PUTS) label.set(u.id, 'posé ' + u.pf.name + ' (' + r1(u.m[12]) + ', ' + r1(u.m[14]) + ') par ' + u.fn);
      const putIds = new Set(PUTS.map((u) => u.id)), boxes = COL.filter((c) => !c.ray && !c.inv), grid = new Map(), key = (i, j) => i + ',' + j;
      for (const c of boxes) for (let i = Math.floor(c.x0 / 4); i <= Math.floor(c.x1 / 4); i++) for (let j = Math.floor(c.z0 / 4); j <= Math.floor(c.z1 / 4); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); }
      const who = (c) => (c.prop ? 'prop ' + c.prop.d.type + ' (' + r1(c.prop.origin.x) + ', ' + r1(c.prop.origin.z) + ')' : label.get(c.own) || 'décor de ' + (c.ownFn || '?') + ' (' + r1((c.x0 + c.x1) / 2) + ', ' + r1((c.z0 + c.z1) / 2) + ')');
      const idOf = (c) => (c.prop ? 'p' + PHYS.bodies.indexOf(c.prop) : 'o' + c.own), pairs = new Map();
      for (const a of boxes) {
        if (!a.prop && !putIds.has(a.own)) continue;
        const seen = new Set();
        for (let i = Math.floor(a.x0 / 4); i <= Math.floor(a.x1 / 4); i++) for (let j = Math.floor(a.z0 / 4); j <= Math.floor(a.z1 / 4); j++) for (const b of grid.get(key(i, j)) || []) {
          if (b === a || seen.has(b)) continue; seen.add(b);
          if (idOf(a) === idOf(b)) continue;
          const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
          if (ox <= 0.08 || oy <= 0.08 || oz <= 0.08) continue;
          const k = [idOf(a), idOf(b)].sort().join('|');
          if (!pairs.has(k)) pairs.set(k, { a: who(a), b: who(b), at: zone((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), d: 0 });
          const p = pairs.get(k); p.d = Math.max(p.d, Math.min(ox, oz));
        }
      }
      for (const p of pairs.values()) out.overlaps.push({ objets: p.a + ' et ' + p.b + ' ' + p.at, recouvrement: r1(p.d) });
      // une perche de bâche ne traverse ni un objet, ni une construction, ni un prop
      for (const q of POLES) {
        const hit = (grid.get(key(Math.floor(q.x / 4), Math.floor(q.z / 4))) || []).find((c) => c.own !== q.own && q.x > c.x0 - 0.04 && q.x < c.x1 + 0.04 && q.z > c.z0 - 0.04 && q.z < c.z1 + 0.04 && c.y1 > q.y0 + 0.1 && c.y0 < q.y1 - 0.1);
        if (hit) out.overlaps.push({ objets: 'perche de bâche (' + r1(q.x) + ', ' + r1(q.z) + ') par ' + q.fn + ' et ' + who(hit) + ' ' + zone(q.x, q.z), recouvrement: 'traverse' });
      }
    }
    return out;
  }, map);
  await browser.close();
  if (json) { console.log(JSON.stringify(R, null, 1)); }
  else {
    console.log(`${R.doors} portes, ${R.placed} objets posés suivis`);
    for (const d of R.doorBlocked) console.log('PORTE GÊNÉE : ' + d.porte + ' : ' + d.devant.join(' ; '));
    for (const p of R.potsBad) console.log('POT : ' + p.pot + ' : ' + p.defauts.join(' ; '));
    for (const t of R.trees) console.log('ARBRE : ' + t.arbre + (t.defauts.length ? ' : ' + t.defauts.join(' ; ') : ''));
    for (const s of R.stairs) console.log('ESCALIER : ' + s.escalier + (s.defauts.length ? ' : ' + s.defauts.join(' ; ') : ''));
    for (const d of R.decalsBad) console.log('AFFICHE : ' + d.affiche + ' : ' + d.defauts.join(' ; '));
    for (const v of R.bikesBad) console.log('VÉLO : ' + v.velo + ' : ' + v.defauts.join(' ; '));
    for (const h of R.headsBlocked) console.log('TÊTE DE PONT : ' + h.tete + ' : ' + h.devant.join(' ; '));
    for (const o of R.sand) console.log('SABLE : ' + o.objet + ' : ' + o.defauts.join(' ; '));
    for (const o of R.overlaps) console.log('RECOUVREMENT : ' + o.objets + ' : ' + o.recouvrement + (o.recouvrement === 'traverse' ? '' : ' m'));
    if (R.heads) console.log(`${R.heads} têtes de pont contrôlées`);
    if (R.decals) console.log(`${R.decals} affiches et panneaux muraux contrôlés`);
    if (liste) for (const d of R.all) console.log(`AFFICHE n° ${d.i} (${d.kit}) en (${d.c.join(', ')}) face vers (${d.N.join(', ')})`);
  }
  const bad = R.doorBlocked.length + R.potsBad.filter((p) => p.defauts.some((d) => /enfoncé|en l'air/.test(d))).length + R.decalsBad.length + R.bikesBad.length + R.headsBlocked.length + R.sand.length + R.overlaps.length;
  if (bad) { console.error(`ÉCHEC : ${bad} porte(s) gênée(s), pot(s) enfoncé(s) ou en l'air, affiche(s) qui flottent, vélo(s) dans un mur, tête(s) de pont encombrée(s), objet(s) dans le sable ou en l'air, recouvrement(s)`); process.exit(1); }
  console.log('décor : portes dégagées, pots posés, affiches sur leur mur, vélos libres, têtes de pont dégagées, sans recouvrement' + (R.relief ? ', objets posés sur le sable' : ''));
})();
