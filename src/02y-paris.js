/* ==========================================================================
   LE DEHORS de Hortus : ce qu'on voit par-dessus l'enceinte depuis le plateau, la terrasse du Rocher et la passerelle.
   Autour du jardin, une ceinture de pelouse plantée de grands arbres, puis un boulevard (trottoirs de dalles, chaussée pavée,
   platanes, réverbères, colonnes Morris), puis une rangée continue d'immeubles de pierre à toit mansardé, avec des cheminées
   et des lucarnes ; derrière, les toits plus hauts d'un second rang, un dôme et une tour de fer, estompés par la brume.
   Tout est hors de la zone de jeu : aucune collision, aucune ombre (les immeubles, à 25 m, projetteraient leur ombre jusque
   dans le jardin). Tout est dans le tronçon lointain (`far`) : un seul maillage par matière.
   Plan (demi-dimensions, centre de la carte) : enceinte 38 x 50 ; pelouse jusqu'à 52 x 64 ; trottoir intérieur 52-55 x 64-67 ;
   chaussée 55-63 x 67-75 ; trottoir extérieur 63-66 x 75-78 ; façades à 66 x 78.
   ========================================================================== */
const PARIS = { rx: 66, rz: 78, road: [55, 63, 67, 75], walkIn: [52, 55, 64, 67], walkOut: [63, 66, 75, 78] };
const PARIS_TINTS = [[0.84, 0.78, 0.66], [0.8, 0.75, 0.66], [0.86, 0.8, 0.7], [0.83, 0.73, 0.65], [0.78, 0.76, 0.72], [0.85, 0.77, 0.62]];

/* Cadre rectangulaire (demi-dimensions extérieures ox, oz ; intérieures ix, iz) en quatre bandes : f(x0, x1, z0, z1) */
function parisFrame(ox, oz, ix, iz, f) { f(ix, ox, -oz, oz); f(-ox, -ix, -oz, oz); f(-ix, ix, iz, oz); f(-ix, ix, -oz, -iz); }
/* Parcourt les quatre côtés d'un rectangle de demi-dimensions (hx, hz), tous les pas mètres : fn(x, z, côté) */
function parisRing(hx, hz, step, fn) {
  for (const [side, pts] of [
    ['E', Array.from({ length: Math.floor((2 * hz) / step) + 1 }, (_, i) => [hx, -hz + i * step])],
    ['W', Array.from({ length: Math.floor((2 * hz) / step) + 1 }, (_, i) => [-hx, -hz + i * step])],
    ['S', Array.from({ length: Math.floor((2 * hx) / step) - 1 }, (_, i) => [-hx + (i + 1) * step, hz])],
    ['N', Array.from({ length: Math.floor((2 * hx) / step) - 1 }, (_, i) => [-hx + (i + 1) * step, -hz])],
  ]) for (const [x, z] of pts) fn(x, z, side);
}

/* Réverbère de boulevard : fût de fonte vert sombre, console courbe, lanterne ; sans collision */
PF.farLamp = (lit = litOn()) => prefab('farLamp' + (lit ? 'L' : ''), (M) => {
  M.save().color([0.12, 0.2, 0.15]).local(1); M.cls = 1;
  M.cyl('paintwood', 0.16, 0.5, 8, { r1: 0.12 }); M.save().move(0, 0.5, 0); M.cyl('paintwood', 0.07, 4.3, 6); M.restore();
  M.tube('paintwood', 0.04, [[0, 4.7, 0], [0.1, 5.1, 0], [0.5, 5.25, 0], [0.9, 5.1, 0]], 5);
  M.color([1, 0.92, 0.7]); M.save().move(0.9, 4.7, 0); M.cyl(lit ? 'lamp' : 'lampOff', 0.2, 0.4, 6, { r1: 0.12 }); M.restore(); // (hors de la zone de jeu : sa lumière n'est pas cuite)
  M.restore();
});
/* Colonne Morris : fût vert, bandeau d'affiches, toit en dôme */
PF.morris = () => prefab('morris', (M) => {
  M.save().local(1); M.cls = 1;
  M.color([0.14, 0.26, 0.2]); M.cyl('paintwood', 0.62, 0.3, 12); M.save().move(0, 0.3, 0); M.cyl('paintwood', 0.5, 2.0, 12); M.restore();
  M.color([0.9, 0.82, 0.62]); M.save().move(0, 0.9, 0); M.cyl('paintwood', 0.52, 1.1, 12); M.restore();
  M.color([0.14, 0.26, 0.2]); M.save().move(0, 2.3, 0); M.lathe('paintwood', [[0.6, 0], [0.62, 0.1], [0.5, 0.2], [0.3, 0.45], [0.1, 0.65], [0, 0.72]], 12); M.restore();
  M.restore();
});

/* Toit mansardé en zinc : brisis raide, terrasson, lucarnes sur les façades visibles (faces), cheminées. h : hauteur de l'égout */
function parisRoof(w, d, h, faces, R) {
  const M = DECOR, i1 = 1.7, h1 = 3.0, i2 = Math.min(i1 + 3.0, Math.min(w, d) / 2 - 0.6), h2 = 1.2, zinc = [0.5, 0.56, 0.64];
  const rect = (i, y) => [[-w / 2 + i, y, -d / 2 + i], [w / 2 - i, y, -d / 2 + i], [w / 2 - i, y, d / 2 - i], [-w / 2 + i, y, d / 2 - i]];
  const A = rect(0, h), B = rect(i1, h + h1), C = rect(i2, h + h1 + h2);
  M.save().color(zinc).local(1); M.cls = 1;
  for (const [P, Q] of [[A, B], [B, C]]) for (let k = 0; k < 4; k++) {
    const p0 = P[k], p1 = P[(k + 1) % 4], q0 = Q[k], q1 = Q[(k + 1) % 4], e = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], f = [q0[0] - p0[0], q0[1] - p0[1], q0[2] - p0[2]];
    let n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]]; const mx = (p0[0] + p1[0]) / 2, mz = (p0[2] + p1[2]) / 2;
    if (n[0] * mx + n[2] * mz < 0) n = n.map((v) => -v);
    M.quad('slate', p0, p1, q1, q0, n);
  }
  M.quad('slate', C[0], C[1], C[2], C[3], [0, 1, 0]);
  // lucarnes : à l'aplomb de la façade, posées sur la corniche ; un volume de pierre, une vitre sombre, deux pans de zinc et un fronton
  for (const face of faces) {
    const alongX = face === 'n' || face === 's', len = alongX ? w : d, sg = face === 's' || face === 'e' ? 1 : -1, nb = Math.max(1, Math.round(len / 3.4)), sx = len / nb;
    for (let k = 0; k < nb; k++) {
      const t = -len / 2 + sx * (k + 0.5), off = (alongX ? d : w) / 2 - 0.2, ex = alongX ? t : sg * off, ez = alongX ? sg * off : t;
      M.save().move(ex, h, ez).rotY(alongX ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI / 2 : -Math.PI / 2));
      M.color([0.94, 0.9, 0.8]); M.boxB('plaster', -0.6, 0.6, 0, 1.5, -1.3, 0.05);
      M.color([0.08, 0.1, 0.13]); M.quad('plaster', [-0.36, 0.25, 0.06], [0.36, 0.25, 0.06], [0.36, 1.25, 0.06], [-0.36, 1.25, 0.06], [0, 0, 1]);
      M.color(zinc);
      M.quad('slate', [-0.72, 1.45, 0.14], [-0.72, 1.45, -1.3], [0, 2.1, -1.3], [0, 2.1, 0.14], [-0.65, 0.76, 0]); M.quad('slate', [0.72, 1.45, 0.14], [0.72, 1.45, -1.3], [0, 2.1, -1.3], [0, 2.1, 0.14], [0.65, 0.76, 0]);
      M.tri3('slate', [-0.72, 1.45, 0.14], [0.72, 1.45, 0.14], [0, 2.1, 0.14], [0, 0.3, 1]);
      M.restore();
    }
  }
  // cheminées sur le terrasson
  const n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) { const x = R.range(-w / 2 + i2 + 0.8, w / 2 - i2 - 0.8), z = R.range(-d / 2 + i2 + 0.6, d / 2 - i2 - 0.6); M.color([0.88, 0.8, 0.7]); M.boxB('plaster', x - 0.45, x + 0.45, h + h1 + h2 - 0.2, h + h1 + h2 + 2.2, z - 0.35, z + 0.35); M.color([0.3, 0.28, 0.27]); M.boxB('plaster', x - 0.52, x + 0.52, h + h1 + h2 + 2.2, h + h1 + h2 + 2.4, z - 0.42, z + 0.42); }
  M.restore();
}

/* Immeuble parisien : rez-de-chaussée à bossage, nf étages de portes-fenêtres, corniche, toit mansardé. Façades détaillées sur les faces demandées (faces : 'nsew'), enduit uni ailleurs */
function parisBuilding(cx, cz, w, d, nf, tint, R, faces) {
  const M = DECOR, gh = 4.2, fh = 3.3, h = gh + nf * fh;
  M.save().move(cx, 0, cz); M.cls = 1;
  for (const face of 'swne') {
    const F = facadeFrame(face, -w / 2, w / 2, -d / 2, d / 2);
    M.save().move(F.ox, 0, F.oz).rotY(F.rot).color(tint);
    if (faces.includes(face)) {
      const nb = Math.max(1, Math.round(F.len / 3.4));
      M.quad('haussrdc', [0, 0, 0], [F.len, 0, 0], [F.len, gh, 0], [0, gh, 0], [0, 0, 1], { uv: [[0, 0], [nb, 0], [nb, 1], [0, 1]] });
      M.quad('haussmann', [0, gh, 0], [F.len, gh, 0], [F.len, h, 0], [0, h, 0], [0, 0, 1], { uv: [[0, 0], [nb, 0], [nb, nf], [0, nf]] });
      M.color([0.95, 0.91, 0.82]);
      M.boxB('plaster', -0.05, F.len + 0.05, gh - 0.2, gh + 0.12, 0, 0.3);             // bandeau au-dessus du rez-de-chaussée
      for (const k of [1, nf - 2]) if (k >= 0 && k < nf) M.boxB('plaster', -0.05, F.len + 0.05, gh + k * fh - 0.1, gh + k * fh + 0.06, 0, 0.55); // balcons filants
      M.boxB('plaster', -0.1, F.len + 0.1, h - 0.1, h + 0.38, 0, 0.55);               // corniche
    } else M.quad('plaster', [0, 0, 0], [F.len, 0, 0], [F.len, h, 0], [0, h, 0], [0, 0, 1]);
    M.restore();
  }
  M.restore();
  M.save().move(cx, 0, cz); parisRoof(w, d, h + 0.38, faces, R); M.restore();
}

/* Tour de fer : quatre pieds qui se rejoignent, croisillons, deux plates-formes, flèche (silhouette dans la brume) */
function parisTower(x, z, H = 110, B = 24) {
  const M = DECOR, hw = (y) => 1.4 + (B - 1.4) * Math.pow(1 - y / H, 2.2), lv = [0, 9, 20, 33, 48, 65, 84, 104, H], co = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  M.save().move(x, 0, z).color([0.36, 0.31, 0.27]).local(1); M.cls = 1;
  const P = (c, y) => [c[0] * hw(y), y, c[1] * hw(y)];
  for (let i = 0; i < lv.length - 1; i++) {
    const r = Math.max(0.18, 0.95 * (1 - lv[i] / H));
    for (const c of co) M.tube('paint', r, [P(c, lv[i]), P(c, lv[i + 1])], 5);
    for (let k = 0; k < 4; k++) {
      const a = co[k], b = co[(k + 1) % 4];
      M.tube('paint', r * 0.45, [P(a, lv[i]), P(b, lv[i + 1])], 4); M.tube('paint', r * 0.45, [P(b, lv[i]), P(a, lv[i + 1])], 4);
      if (i > 0) M.tube('paint', r * 0.6, [P(a, lv[i]), P(b, lv[i])], 4);
    }
  }
  for (const y of [lv[3], lv[5]]) M.boxB('paint', -hw(y) - 0.6, hw(y) + 0.6, y - 0.5, y + 0.5, -hw(y) - 0.6, hw(y) + 0.6);
  M.tube('paint', 0.1, [[0, H, 0], [0, H + 14, 0]], 4);
  M.restore();
}

function florealParis() {
  const R = rngOf(8383), M = DECOR, { rx, rz } = PARIS;
  WORLD.force = 'far'; // tout le dehors dans un seul tronçon : hors de la zone de jeu, il n'y a rien à écarter, et chaque tronçon coûterait un appel de rendu par matière
  // arbres de la ceinture de pelouse (grands, allégés) et platanes des deux trottoirs ; hauts troncs : on voit la pelouse dessous
  const tree = (x, z, h, r, kind) => M.place(PF.tree(kind || R.pick(['oak', 'linden', 'maple', 'ginkgo', 'oak']), h, r, 1 + Math.floor(R() * 12), { th: h * 0.38, lod: 1 }), x + R.range(-1, 1), 0, z + R.range(-1, 1), R() * TAU, { nocol: true, cls: 1 });
  parisRing(46, 57, 8, (x, z) => tree(x, z, R.range(15, 19), R.range(4.8, 6.2)));
  parisRing(53.5, 65.5, 10, (x, z) => tree(x, z, R.range(10, 12.5), R.range(3.2, 4), R.pick(['linden', 'maple', 'linden'])));
  parisRing(64.5, 76.5, 12, (x, z) => tree(x, z, R.range(10, 12.5), R.range(3.2, 4), R.pick(['linden', 'maple', 'linden'])));
  // réverbères et colonnes Morris sur les trottoirs
  parisRing(54.2, 66.2, 18, (x, z, side) => { const ry = side === 'E' ? -Math.PI / 2 : side === 'W' ? Math.PI / 2 : side === 'S' ? Math.PI : 0; M.place(PF.farLamp(), x, 0, z, ry, { nocol: true }); });
  parisRing(63.8, 75.8, 18, (x, z, side) => { const ry = side === 'E' ? Math.PI / 2 : side === 'W' ? -Math.PI / 2 : side === 'S' ? 0 : Math.PI; M.place(PF.farLamp(), x + (side === 'N' || side === 'S' ? 9 : 0), 0, z + (side === 'E' || side === 'W' ? 9 : 0), ry, { nocol: true }); });
  for (const [x, z] of [[52.8, -30], [-52.8, 22], [26, 64.8], [-34, -64.8], [64.7, 40]]) M.place(PF.morris(), x, 0, z, 0, { nocol: true });
  // haie basse au bord de la pelouse, côté trottoir
  for (const [a, b, c, d] of [[51.2, 51.8, -63, 63], [-51.8, -51.2, -63, 63], [-51, 51, 63.2, 63.8], [-51, 51, -63.8, -63.2]]) { M.save().color([0.8, 0.94, 0.72]).world(1); M.cls = 1; M.boxB('hedge', a, b, 0, 0.8, c, d, { bevel: 0.1 }); M.restore(); }
  // chaussée pavée
  M.save().color([1, 1, 1]).world(1); M.cls = 1;
  const [r0, r1, q0, q1] = PARIS.road;
  for (const [x0, x1, z0, z1] of [[r0, r1, -q1, q1], [-r1, -r0, -q1, q1], [-r0, r0, q0, q1], [-r0, r0, -q1, -q0]]) { M.quad('pave', [x0, 0.03, z0], [x1, 0.03, z0], [x1, 0.03, z1], [x0, 0.03, z1], [0, 1, 0]); }
  M.restore();
  // rangs d'immeubles : E et W de bout en bout, S et N entre les coins, quatre immeubles d'angle
  const row = (side, faces, a0, a1, off, depth, alongZ) => {
    for (let t = a0; t < a1 - 0.5;) {
      const w = a1 - t < 30 ? a1 - t : R.range(13, 24), d = R.range(depth - 2, depth + 3), nf = 5 + Math.floor(R() * 3), c = t + w / 2;
      const sg = side === 'E' || side === 'S' ? 1 : -1;
      if (alongZ) parisBuilding(sg * (off + d / 2), c, d, w, nf, R.pick(PARIS_TINTS), R, faces); else parisBuilding(c, sg * (off + d / 2), w, d, nf, R.pick(PARIS_TINTS), R, faces);
      t += w;
    }
  };
  row('E', 'w', -rz, rz, rx, 15, true); row('W', 'e', -rz, rz, rx, 15, true); row('S', 'n', -rx, rx, rz, 15, false); row('N', 's', -rx, rx, rz, 15, false);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parisBuilding(sx * (rx + 8), sz * (rz + 8), 16, 16, 6, R.pick(PARIS_TINTS), R, (sx > 0 ? 'w' : 'e') + (sz > 0 ? 'n' : 's'));
  // second rang, plus haut et plus loin : seuls les toits se voient au-dessus du premier (façades simples, tronçon lointain)
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * TAU + R() * 0.05, d = R.range(112, 165), x = Math.cos(a) * d * 1.1, z = Math.sin(a) * d * 1.25;
    if (Math.abs(x) < 100 && Math.abs(z) < 112) continue;
    if (hyp(x - PARIS_DOME[0], z - PARIS_DOME[1]) < 36 || hyp(x - PARIS_TOUR[0], z - PARIS_TOUR[1]) < 32) continue;
    farBuilding(x, z, R.range(18, 30), R.range(14, 22), R.range(30, 40), R.pick(PARIS_TINTS), R);
  }
  // les deux repères de la carte (MAP_DEFS.floreal.landmarks), un par moitié, au-dessus des grands arbres de la ceinture : au nord
  // (Bravo) le dôme d'un édifice sur son tambour, au sud (Alpha) la tour de fer
  const [dx, dz] = PARIS_DOME;
  M.save().move(dx, 0, dz).color([0.82, 0.8, 0.74]).world(1); M.boxB('stone', -14, 14, 0, 18, -14, 14);
  M.local(1); M.save().move(0, 18, 0); M.cyl('stone', 10.5, 10, 20); M.restore();
  M.color([0.5, 0.58, 0.55]); M.save().move(0, 28, 0); M.lathe('slate', [[10.8, 0], [10.8, 2.5], [9.8, 6.5], [7.4, 10.5], [3.8, 14], [1.4, 16], [0, 17]], 20); M.restore();
  M.color([0.82, 0.8, 0.74]); M.save().move(0, 44.6, 0); M.cyl('stone', 1.3, 3.2, 10); M.restore();
  M.color([0.5, 0.58, 0.55]); M.save().move(0, 47.8, 0); M.lathe('slate', [[1.5, 0], [0, 3.4]], 10); M.restore(); M.restore();
  parisTower(PARIS_TOUR[0], PARIS_TOUR[1], 110, 18);
  WORLD.force = null;
}
