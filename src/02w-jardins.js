/* ==========================================================================
   LES JARDINS DE FLORÉAL, hors de la serre :
   - OUEST « Jardin japonais » : étang aux nénuphars, île au pavillon de thé, pont rouge arqué et passerelle en zigzag, lanternes de
     pierre, jardin sec, cerisiers, érables rouges, saule pleureur, bambous.
   - EST « Ravin des fougères » : ruisseau peu profond au pied de la serre, cascades de la falaise, fougères arborescentes ; le plateau des
     bambous (y = FL.high) auquel on monte par des escaliers de roche et par la passerelle de la canopée, avec son kiosque.
   - NORD ET SUD : labyrinthe de buis, roseraie et pergolas de glycines, pelouses et bosquets.
   ========================================================================== */
/* Toit à quatre pans (pavillons) : égout rectangulaire à y, faîte à y + h, débord ov */
function hipRoof(x0, x1, z0, z1, y, h, o = {}) {
  const M = DECOR, ov = o.ov !== undefined ? o.ov : 0.5, a0 = x0 - ov, a1 = x1 + ov, b0 = z0 - ov, b1 = z1 + ov, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, yt = y + h, mat = o.mat || 'slate';
  M.save().color(o.tint || [0.42, 0.46, 0.52]).world(1); M.cls = 0;
  const sx = h / ((a1 - a0) / 2 + 0.001), sz = h / ((b1 - b0) / 2 + 0.001);
  M.tri3(mat, [a0, y, b0], [a1, y, b0], [cx, yt, cz], [0, 1, -sz]); M.tri3(mat, [a1, y, b1], [a0, y, b1], [cx, yt, cz], [0, 1, sz]);
  M.tri3(mat, [a1, y, b0], [a1, y, b1], [cx, yt, cz], [sx, 1, 0]); M.tri3(mat, [a0, y, b1], [a0, y, b0], [cx, yt, cz], [-sx, 1, 0]);
  M.color(o.under || [0.3, 0.22, 0.15]).local(1);
  M.boxB('paintwood', a0, a1, y - 0.14, y, b0, b1, { bevel: 0.02 });
  M.restore();
  M.occ(a0, a1, y - 0.1, yt * 0.9 + y * 0.1, b0, b1, 0.9);
  DECOR.col(x0 - ov * 0.5, x1 + ov * 0.5, y - 0.14, y + 0.1, z0 - ov * 0.5, z1 + ov * 0.5, 'wood', true);
}
/* Poteau de bois : carré (s) de y0 à y1, avec collision étroite */
function post(x, z, y0, y1, s = 0.2, tint = [0.4, 0.28, 0.18], col = true) {
  box('paintwood', x - s / 2, x + s / 2, y0, y1, z - s / 2, z + s / 2, { tint, collide: col, bevel: 0.02, m: 'wood', ao: false });
}
/* Pin taillé en nuages (niwaki) : tronc tordu, étages de coussins d'aiguilles posés à plat */
PF.pine = (h = 4.5, seed = 1) => prefab(`pine_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 211 + 19), path = [], N = 12, tw = R.range(0.5, 1.0);
  for (let i = 0; i <= N; i++) { const t = i / N; path.push([Math.sin(t * 3.2 + tw) * 0.45 * t, t * h * 0.8, Math.cos(t * 2.6 + tw) * 0.3 * t]); }
  M.save().color([0.5, 0.4, 0.34]).local(1); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 1.2, y));
  M.sweep('bark', circleShape(1, 8), path, { scale: (t) => 0.2 * (1 + 0.8 * Math.pow(1 - t, 4)) * (1 - 0.6 * t), uAround: 0.6 }); M.aoFn = null; M.restore();
  M.save().cls = 0;
  const layers = [[0.34, 1.5], [0.5, 1.3], [0.66, 1.05], [0.82, 0.8], [0.97, 0.5]];
  for (const [t, rad] of layers) {
    const q = path[Math.min(N, Math.round(t * N))], ox = q[0] + R.range(-0.35, 0.35), oz = q[2] + R.range(-0.35, 0.35);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + R(), d = rad * R.range(0.15, 0.7); M.color([R.range(0.8, 1), R.range(0.9, 1), R.range(0.8, 0.95)]); leafPatch(M, 'leafB', HERB.cedar, [ox + Math.cos(a) * d, q[1] + R.range(-0.08, 0.08), oz + Math.sin(a) * d], [R.range(-0.12, 0.12), 1, R.range(-0.12, 0.12)], rad * 1.7, R() * TAU, { up: 0.85, crown: [ox, q[1] - 0.5, oz, 1.0], w: [0.5, 0.5, 0.5, 0.5], ao: [0.75, 0.75, 0.75, 0.75] }); }
  }
  M.restore();
  M.occ(-1.4, 1.4, h * 0.3, h * 1.0, -1.4, 1.4, 0.45); M.col(-0.2, 0.2, 0, h * 0.5, -0.2, 0.2, 'wood');
});

/* ---------- Jardin japonais ---------- */
const JAPON_POND = [[-22.2, -1.5], [-22.6, -4.5], [-24.4, -7.2], [-27.5, -8.6], [-31.2, -8.2], [-34.0, -6.2], [-35.2, -3.0], [-35.0, 0.5], [-34.4, 4.0], [-32.2, 7.0], [-28.8, 8.6], [-25.4, 7.6], [-23.0, 4.8], [-22.2, 1.6]];
/* L'île est sur l'axe de la porte ouest de la serre (z = 0) : porte, sentier, pont rouge et pavillon sont alignés */
const JAPON_ISLE = { x: -29.1, z: 0, r: 3.2, y: 0.5 };
/* Rectangles praticables dans l'étang : pont rouge et ses appuis, pont droit de bois de la rive sud à l'île (x0, x1, z0, z1) */
const JAPON_WALK = [[-26.55, -21.55, -1.35, 1.35], [-30.1, -28.1, 3.0, 9.3]];
function florealJapon() {
  const M = DECOR, R = rngOf(6161), I = JAPON_ISLE, wl = -0.12;
  pondBasin(JAPON_POND, { wl, bed: -0.5, foam: 0.6, pond: { calm: 0.35, vis: 0.45, caus: 0.4 }, deep: [0.012, 0.05, 0.045], shallow: [0.04, 0.12, 0.1], scatter: [0.012, 0.06, 0.05] });
  // île : monticule de rocaille, dessus de mousse, enrochement
  M.save().move(I.x, 0, I.z).color([0.9, 0.9, 0.86]).world(1); M.lathe('rocaille', [[I.r + 0.18, -0.52], [I.r + 0.1, wl + 0.1], [I.r, 0.2], [I.r - 0.2, I.y - 0.02], [0, I.y - 0.02]], 14, { sharp: 0.5, uR: 1.2 });
  M.color([0.5, 0.58, 0.4]); M.save().move(0, I.y - 0.01, 0); M.lathe('mulch', [[0, 0], [I.r - 0.2, 0]], 14); M.restore(); M.restore();
  // île praticable : un octogone de trois boîtes (croix et carré), qui suit le disque sans que la rive d'eau soit marchable
  for (const [hx, hz] of [[0.92, 0.4], [0.4, 0.92], [0.72, 0.72]]) DECOR.col(I.x - I.r * hx, I.x + I.r * hx, 0, I.y, I.z - I.r * hz, I.z + I.r * hz, 'concrete');
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + R() * 0.2; M.place(PF.rockG(1 + (i % 9), R.range(0.5, 0.9), R.range(0.35, 0.6), R.range(0.5, 0.9)), I.x + Math.cos(a) * (I.r - 0.1), wl + 0.2, I.z + Math.sin(a) * (I.r - 0.1), R() * TAU, { nocol: true }); }
  // pavillon de thé : plateforme, quatre poteaux, toit à quatre pans
  const pa = [I.x - 1.95, I.x + 0.75, I.z - 1.55, I.z + 1.15]; // décalé vers le nord-ouest : le chemin de l'île (pont droit au sud, pont rouge à l'est) passe librement
  box('paintwood', pa[0] - 0.1, pa[1] + 0.1, I.y, I.y + 0.18, pa[2] - 0.1, pa[3] + 0.1, { tint: [0.45, 0.32, 0.22], bevel: 0.02, m: 'wood' });
  for (const x of [pa[0], pa[1]]) for (const z of [pa[2], pa[3]]) post(x, z, I.y + 0.18, I.y + 2.5, 0.2, [0.32, 0.2, 0.14]);
  hipRoof(pa[0], pa[1], pa[2], pa[3], I.y + 2.5, 1.5, { ov: 0.9 });
  M.save().color([0.9, 0.86, 0.78]).local(1); M.cls = 1; for (const [x0, x1, z0, z1] of [[pa[0], pa[1], pa[2], pa[2]], [pa[0], pa[0], pa[2], pa[3]]]) M.boxB('canvas', x0 - 0.02, x1 + 0.02, I.y + 0.5, I.y + 2.1, z0 - 0.02, z1 + 0.02); M.restore();
  M.place(PF.toro(0.8), I.x + 2.0, I.y, I.z - 1.9, 0.4); M.place(PF.pine(4.4, 3), I.x - 2.4, I.y, I.z + 1.3, 1.2); M.place(PF.tree('maple', 5.2, 2.2, 3, { th: 1.6, shape: 'spread' }), I.x - 0.6, I.y, I.z - 2.3, 0.4);
  // pont rouge : tablier arqué, garde-corps vermillon, posé à chaque bout sur un appui de pierre (sur l'île, un bloc au bord du monticule ;
  // sur la rive, un seuil qui avance sur l'eau). Le tablier s'arrêtait à 10 cm de la rive, au-dessus de l'eau : on tombait là au fond de
  // l'étang et l'on restait coincé sous le pont. Collision : les appuis, huit rampes qui suivent l'arc (deux droites passaient 12 cm sous
  // les lattes), et pour les tirs seulement, le tablier en seize tronçons
  const BW = 1.15, bx0 = I.x + I.r - 0.1, bx1 = -22.0, bz = I.z, ya = I.y + 0.06, ye = 0.08, yb = (t) => lerp(ya, ye, t) + 0.55 * Math.sin(Math.PI * t);
  box('ashlar', bx0 - 0.55, bx0, -0.3, ya, bz - BW - 0.2, bz + BW + 0.2, { tint: [0.74, 0.72, 0.66], bevel: 0.03 });
  box('ashlar', -22.5, -21.55, -0.3, ye, bz - BW - 0.2, bz + BW + 0.2, { tint: [0.74, 0.72, 0.66], bevel: 0.03 });
  for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8; RAMPS.push({ x0: lerp(bx0, bx1, t0), x1: lerp(bx0, bx1, t1), z0: bz - BW, z1: bz + BW, axis: 'x', h0: yb(t0), h1: yb(t1) }); }
  for (let i = 0; i < 16; i++) { const t0 = i / 16, t1 = (i + 1) / 16; DECOR.col(lerp(bx0, bx1, t0), lerp(bx0, bx1, t1), Math.min(yb(t0), yb(t1)) - 0.18, Math.max(yb(t0), yb(t1)), bz - BW, bz + BW, 'wood', true); }
  M.save().color([0.78, 0.14, 0.1]).local(1); M.cls = 0;
  for (let i = 0; i < 14; i++) { const t0 = i / 14, t1 = (i + 1) / 14, xa = lerp(bx0, bx1, t0), xb = lerp(bx0, bx1, t1), ya = yb(t0), yy = yb(t1); M.quad('paintwood', [xa, ya, bz - BW], [xb, yy, bz - BW], [xb, yy, bz + BW], [xa, ya, bz + BW], [0, 1, 0]); M.quad('paintwood', [xa, ya - 0.18, bz - BW], [xa, ya, bz - BW], [xb, yy, bz - BW], [xb, yy - 0.18, bz - BW], [0, 0, -1]); M.quad('paintwood', [xa, ya - 0.18, bz + BW], [xb, yy - 0.18, bz + BW], [xb, yy, bz + BW], [xa, ya, bz + BW], [0, 0, 1]); }
  for (const sd of [-1, 1]) {
    const top = [], mid = []; for (let i = 0; i <= 8; i++) { const t = i / 8, x = lerp(bx0, bx1, t); top.push([x, yb(t) + 0.95, bz + sd * (BW - 0.02)]); mid.push([x, yb(t) + 0.45, bz + sd * (BW - 0.02)]); }
    M.tube('paintwood', 0.045, top, 6); M.tube('paintwood', 0.03, mid, 5);
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = lerp(bx0, bx1, t); M.save().move(x, yb(t), bz + sd * (BW - 0.02)); M.cyl('paintwood', i % 4 === 0 ? 0.06 : 0.035, i % 4 === 0 ? 1.1 : 0.95, 6); if (i % 4 === 0) { M.save().move(0, 1.1, 0); M.cyl('paintwood', 0.08, 0.06, 8, { r1: 0.04 }); M.restore(); } M.restore(); }
  }
  M.restore();
  for (const sd of [-1, 1]) glassWall(bx0, bx1, -2, 3, bz + sd * (BW + 0.05) - 0.06, bz + sd * (BW + 0.05) + 0.06);
  // pont droit de bois, de la rive sud à l'île : tablier de planches en pente douce (une rampe), deux longerons, balustrade basse, piliers dans l'eau
  const wx = I.x, wz0 = I.z + I.r - 0.2, wz1 = 9.3, wy = (z) => lerp(I.y, 0.04, (z - wz0) / (wz1 - wz0));
  RAMPS.push({ x0: wx - 1.0, x1: wx + 1.0, z0: wz0, z1: wz1, axis: 'z', h0: I.y, h1: 0.04 });
  M.save().local(1).color([0.5, 0.38, 0.28]);
  for (let z = wz0; z < wz1 - 0.1; z += 0.6) { const y1 = wy(z), y2 = wy(Math.min(wz1, z + 0.55)); M.quad('wood', [wx - 1.0, y1, z], [wx + 1.0, y1, z], [wx + 1.0, y2, z + 0.55], [wx - 1.0, y2, z + 0.55], [0, 1, 0]); M.quad('wood', [wx - 1.0, y1 - 0.12, z], [wx + 1.0, y1 - 0.12, z], [wx + 1.0, y1, z], [wx - 1.0, y1, z], [0, 0, -1]); }
  M.color([0.36, 0.27, 0.2]);
  for (const sd of [-1, 1]) {
    M.tube('wood', 0.09, [[wx + sd * 0.95, wy(wz0) - 0.16, wz0], [wx + sd * 0.95, wy(wz1) - 0.16, wz1]], 6);
    const top = [], mid = []; for (let i = 0; i <= 8; i++) { const z = lerp(wz0, wz1, i / 8); top.push([wx + sd * 0.97, wy(z) + 0.85, z]); mid.push([wx + sd * 0.97, wy(z) + 0.45, z]); }
    M.tube('wood', 0.045, top, 6); M.tube('wood', 0.03, mid, 5);
    for (let i = 0; i <= 8; i++) { const z = lerp(wz0, wz1, i / 8); M.save().move(wx + sd * 0.97, wy(z) - 0.1, z); M.cyl('wood', 0.055, 1.0, 6); M.restore(); }
  }
  for (const z of [4.8, 6.9, 8.4]) for (const sd of [-1, 1]) { M.save().move(wx + sd * 0.8, -0.9, z); M.cyl('wood', 0.1, 1.1, 7); M.restore(); }
  M.restore();
  for (const sd of [-1, 1]) glassWall(wx + sd * 1.05 - 0.05, wx + sd * 1.05 + 0.05, -2, 3, wz0, wz1 + 0.4); // flancs du pont : on ne passe pas dessous
  // nénuphars et fleurs
  for (const [x, z, r, n, sd] of [[-31.5, -5.2, 2.6, 14, 4], [-26.4, 5.4, 1.5, 8, 5], [-33.2, 3.6, 1.7, 9, 6], [-25.5, -5.5, 1.8, 9, 7], [-32.2, 6.2, 1.5, 7, 8]]) M.place(PF.lilies(r, n, sd, 0.4), x, wl + 0.02, z, 0, { cls: 2 });
  // lanternes de pierre, rochers moussus, bambous, saule, cerisiers, érables
  for (const [x, z, s] of [[-21.4, -3.2, 1], [-21.4, 3.4, 1], [-26.6, -10.2, 1.1], [-34.2, -8.6, 0.9], [-30.5, 10.4, 1], [-35.4, 5.4, 0.9]]) M.place(PF.toro(s), x, 0, z, R() * TAU);
  rockPile(-22.4, -2.5, -23.5, -6.2, 0.05, 6, 91, 0.9); rockPile(-23.2, 4.2, -26.2, 7.4, 0.05, 6, 92, 0.9); rockPile(-34.2, -5.5, -32, -7.5, 0.05, 5, 93, 0.9);
  for (let z = -15; z <= 15; z += 3.7) M.place(PF.bamboo(7, 6.2 + (z % 3), Math.round(z * 5)), -36.1, 0, z, R() * TAU);
  M.place(PF.willow(8.5, 3.6, 2), -24.3, 0, 8.6, 0.6);
  for (const [x, z, k, h, sd] of [[-20.8, -10.4, 'cherry', 7, 1], [-27.2, -12.6, 'cherry', 7.5, 2], [-33.4, -11.2, 'cherryW', 7, 3], [-34.4, 7.5, 'cherry', 6.5, 4], [-23.8, 11, 'cherryW', 7, 5], [-31, 12, 'cherry', 7.2, 6], [-20.8, 7.2, 'cherry', 6.8, 7], [-35.5, -10.5, 'cherryW', 6.5, 8], [-33.8, 11.8, 'cherry', 6.8, 9]]) M.place(PF.tree(k, h, 3.4, sd, { shape: 'spread', th: 1.8 }), x, 0, z, R() * TAU);
  for (const [x, z, h, sd] of [[-22.2, -13.6, 6.5, 1], [-29, -14.4, 6.8, 2], [-35.9, -2.2, 6, 3], [-35.6, 2.6, 6.2, 4], [-22.4, 13, 6.4, 5], [-28.6, 13.6, 6.2, 6]]) M.place(PF.tree('maple', h, 2.8, sd, { shape: 'round', th: 1.6 }), x, 0, z, R() * TAU);
  M.place(PF.tree('ginkgo', 9, 2.4, 3, { shape: 'tall', th: 2.6 }), -19.6, 0, -14.5, 0.4); // à côté du banc de x = -22, pas dedans
  // sous-bois : azalées, fougères, hostas, iris et roseaux au bord de l'eau
  const edge = (x, z) => polyDist(JAPON_POND, x, z) < -0.6 && !JAPON_WALK.some((r) => x > r[0] - 0.8 && x < r[1] + 0.8 && z > r[2] - 0.8 && z < r[3] + 0.8) && !(x > -23.6 && Math.abs(z) < 1.6) && hyp(x - I.x, z - I.z) > I.r + 0.7;
  plantBed(R, [-37, -20.2, -16, 16], 260, (RR) => { const k = RR(); return k < 0.25 ? [PF.clump('azalea', 'leafB', 1.0, 0.9, 3, 1 + Math.floor(RR() * 5)), RR.range(0.9, 1.5)] : k < 0.5 ? [PF.fern('fernA', RR.range(0.9, 1.4), 1 + Math.floor(RR() * 6)), 1] : k < 0.7 ? [PF.rosette('hosta', 'leafB', 0.9, 7, 1 + Math.floor(RR() * 4)), RR.range(0.9, 1.3)] : k < 0.85 ? [PF.clump('iris', 'leafB', 0.9, 0.9, 3, 1 + Math.floor(RR() * 4)), RR.range(0.9, 1.2)] : [PF.clump('hydB', 'leafB', 0.9, 0.9, 3, 1 + Math.floor(RR() * 4)), RR.range(0.9, 1.3)]; }, (x, z) => polyDist(JAPON_POND, x, z) < -1.3 && !(x > -20.6 && Math.abs(z) < 2) && !(Math.abs(z) < 3 && x > -23));
  plantBed(R, [-36, -21.5, -9.6, 9.6], 150, (RR) => (RR() < 0.6 ? [PF.reeds(RR.range(1.5, 2.3), 1 + Math.floor(RR() * 6)), 1] : [PF.clump('iris', 'leafB', 0.9, 0.9, 3, 1 + Math.floor(RR() * 4)), 1.1]), (x, z) => { const d = polyDist(JAPON_POND, x, z); return d < -0.4 && d > -1.2 && edge(x, z) && !JAPON_WALK.some((r) => x > r[0] - 1 && x < r[1] + 1 && z > r[2] - 1 && z < r[3] + 1) && !(x > -23.6 && Math.abs(z) < 2.4) && hyp(x - I.x, z - I.z) > I.r + 0.8; });
  // jardin sec au nord : gravier ratissé, trois rochers
  box('ashlar', -36.6, -26.4, 0, 0.14, -15.6, -15.3, { tint: [0.8, 0.78, 0.72], collide: false }); box('ashlar', -36.6, -26.4, 0, 0.14, -11.3, -11.0, { tint: [0.8, 0.78, 0.72], collide: false });
  box('ashlar', -36.6, -36.3, 0, 0.14, -15.3, -11.3, { tint: [0.8, 0.78, 0.72], collide: false }); box('ashlar', -26.7, -26.4, 0, 0.14, -15.3, -11.3, { tint: [0.8, 0.78, 0.72], collide: false }); // entre les deux longs côtés
  for (const [x, z, a, b, c, sd] of [[-33.5, -13.5, 1.0, 0.8, 0.8, 21], [-30.8, -12.6, 0.7, 0.5, 0.6, 22], [-29.3, -14.3, 0.9, 0.7, 0.8, 23]]) M.place(PF.rockG(sd, a, b, c), x, 0.0, z, R() * TAU);
  M.place(PF.pine(3.6, 5), -35, 0, -14.4, 0.4);
}

/* ---------- Ravin des fougères et plateau des bambous ---------- */
/* Flancs d'une rampe isolée (x0..x1, z0..z1, axis, h0 -> h1) : murs invisibles qui suivent la pente, juste hors de la rampe, et main courante de fer.
   Les marches n'arrêtent que les tirs : sans cela, un soldat entre par le flanc au ras du sol et reste coincé sous la rampe. sides : 0 (x0 ou z0), 1 (x1 ou z1) ; col : teinte de la main courante */
function rampGuard(x0, x1, z0, z1, axis, h0, h1, sides = [0, 1], col) {
  const a0 = axis === 'x' ? x0 : z0, a1 = axis === 'x' ? x1 : z1, n = Math.max(2, Math.ceil((a1 - a0) / 0.6));
  for (const sd of sides) {
    const c = axis === 'x' ? (sd ? z1 : z0) : (sd ? x1 : x0), o = sd ? 0.1 : -0.1, e = sd ? 0.3 : -0.3; // le mur invisible est à 0,3 m du bord : un soldat qui longe la rampe ne s'y frotte pas, et l'interstice est trop étroit pour s'y glisser
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, top = Math.max(lerp(h0, h1, t0), lerp(h0, h1, t1)) + 1.0, u0 = lerp(a0, a1, t0), u1 = lerp(a0, a1, t1);
      if (axis === 'x') glassWall(u0, u1, 0, top, c + e, c + e + o); else glassWall(c + e, c + e + o, 0, top, u0, u1);
    }
    railing(c, c, 0, a0, a1, axis, [h0, h1], col);
  }
}
const RAVIN_STREAM = [[26.2, -6.0], [25.0, -5.0], [23.8, -3.0], [23.2, -0.5], [24.0, 2.0], [25.0, 4.0], [24.2, 6.5], [23.0, 9.0], [23.4, 12.0], [24.4, 14.8]];
const PLATEAU = { x0: 27.8, x1: 37, z0: -13.2, z1: 13.2 };
function florealRavin() {
  const M = DECOR, R = rngOf(7373), { x0, x1, z0, z1 } = PLATEAU, y = FL.high;
  box('rocaille', x0, x1, 0, y, z0, z1, { tint: [1, 0.97, 0.93], m: 'concrete', uv: 3.2, skip: 'Y' });
  M.save().color([0.8, 0.72, 0.6]).world(1); M.cls = 1; M.quad('mulch', [x0, y + 0.005, z0], [x1, y + 0.005, z0], [x1, y + 0.005, z1], [x0, y + 0.005, z1], [0, 1, 0]); M.restore();
  rockFace({ x: x0, out: -1, z0, z1, y0: 0, y1: y, seed: 31, bulge: 0.8 });
  for (const [a, b] of [[x0, 28.7], [32.3, x1]]) { rockFace({ axis: 'x', z: z0, out: -1, x0: a, x1: b, y0: 0, y1: y, seed: 32, bulge: 0.7 }); rockFace({ axis: 'x', z: z1, out: 1, x0: a, x1: b, y0: 0, y1: y, seed: 33, bulge: 0.7 }); }
  rockPile(x0 - 0.6, z0 + 0.5, x0 - 0.6, z1 - 0.5, 0.05, 22, 41, 1.1);
  // deux cascades de la falaise
  for (const [z, w] of [[-6, 1.7], [7, 1.3]]) {
    M.save().color([0.9, 0.86, 0.8]).world(1); M.boxB('rocaille', x0 - 0.7, x0 + 0.1, y - 0.7, y - 0.2, z - w / 2 - 0.3, z + w / 2 + 0.3, { bevel: 0.06 }); M.restore();
    waterfallAdd(x0 - 0.62, y - 0.2, 0.0, z - w / 2, z + w / 2, 1, [1.0, 1.06, 1.04]);
  }
  // ruisseau peu profond : lit de gravier visible à travers l'eau claire, qui coule vers le sud
  pondAdd({ shape: 'poly', poly: ribbonPoly(RAVIN_STREAM, [2.4, 2.8, 2.4, 2.2, 2.4, 2.8, 2.4, 2.2, 2.4, 3.2]), y: 0.04, wade: 0, probeAt: [23.6, 1.7, 3.0], alpha: 0.72, depth: 0.4, foam: 0.7, flow: [0, 0.32], deep: [0.03, 0.08, 0.06], shallow: [0.06, 0.15, 0.11], scatter: [0.02, 0.08, 0.06], cell: 0.4 });
  pondAdd({ shape: 'poly', poly: ribbonPoly([[26.4, 6.8], [25.4, 6.9], [24.6, 6.7]], [1.8, 1.6, 1.5]), y: 0.04, wade: 0, alpha: 0.72, depth: 0.4, foam: 0.7, flow: [-0.3, 0], deep: [0.03, 0.08, 0.06], shallow: [0.06, 0.15, 0.11], scatter: [0.02, 0.08, 0.06], cell: 0.4 });
  // escaliers de roche vers le plateau (nord et sud), garde-corps au bord de la falaise (sauf à la passerelle)
  ramp(29, 32, -22, z0, 'z', 0, y, 'flagstone', [0.8, 0.76, 0.68], { mat: 'rocaille' }); ramp(29, 32, z1, 22, 'z', y, 0, 'flagstone', [0.8, 0.76, 0.68], { mat: 'rocaille' });
  rampGuard(29, 32, -22, z0, 'z', 0, y); rampGuard(29, 32, z1, 22, 'z', y, 0);
  for (const [a, b] of [[z0 + 0.3, -1.4], [1.4, z1 - 0.3]]) { railing(x0 + 0.1, x0 + 0.1, y, a, b, 'z'); glassWall(x0 - 0.05, x0 + 0.25, y, y + 1.0, a, b); }
  // sol du sommet : allées de dalles, kiosque de thé
  M.save().color([0.9, 0.86, 0.78]).world(1); M.cls = 1;
  for (const [a, b, c, d] of [[x0, 29.7, -0.8, 0.8], [29.7, 31.3, z0, z1], [31.3, x1 - 0.8, -0.8, 0.8]]) M.quad('flagstone', [a, y + 0.012, c], [b, y + 0.012, c], [b, y + 0.012, d], [a, y + 0.012, d], [0, 1, 0]); // bout à bout, sans recouvrement
  M.restore();
  const kx = 34.2;
  box('flagstone', kx - 1.9, kx + 1.9, y, y + 0.2, -1.9, 1.9, { tint: [0.85, 0.82, 0.74], bevel: 0.02, m: 'concrete', uv: 2 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(kx + sx * 1.6, sz * 1.6, y + 0.2, y + 2.7, 0.22, [0.34, 0.22, 0.15]);
  hipRoof(kx - 1.6, kx + 1.6, -1.6, 1.6, y + 2.7, 1.6, { ov: 1.0, tint: [0.4, 0.44, 0.5] });
  benchAt(kx, -1.4, kx, 0, y + 0.2); benchAt(kx, 1.4, kx, 0, y + 0.2);
  // bambous du plateau, fougères et hostas dessous
  const pfree = (x, z) => x > x0 + 1.2 && x < x1 - 0.8 && Math.abs(z) < z1 - 0.8 && !(x > kx - 3.3 && x < kx + 3.3 && Math.abs(z) < 3.3) && !(Math.abs(z) < 1.4) && !(x > 29.2 && x < 31.8);
  plantBed(R, [x0 + 1, x1 - 0.5, -z1 + 0.5, z1 - 0.5], 26, (RR) => [PF.bamboo(7 + Math.floor(RR() * 4), RR.range(7, 9.5), 1 + Math.floor(RR() * 8)), 1], (x, z) => pfree(x, z), y);
  // écran de bambous haut le long du bord est (le plateau domine l'enceinte : on ne voit plus que leurs cimes), rochers moussus dans les massifs
  for (let z = -12; z <= 12; z += 3.1) if (Math.abs(z) > 2.4) M.place(PF.bamboo(9, R.range(9.5, 11.5), Math.round(z * 7)), 36.3 + R.range(-0.3, 0.2), y, z + R.range(-0.4, 0.4), R() * TAU, { nocol: true });
  for (let i = 0; i < 9; i++) { const rx = R.range(29.2, 36), rz = R.range(-12, 12); if (pfree(rx, rz)) M.place(PF.rockG(60 + i, R.range(0.6, 1.1), R.range(0.4, 0.7), R.range(0.6, 1.1)), rx, y - 0.1, rz, R() * TAU, { nocol: true }); }
  plantBed(R, [x0 + 1, x1 - 0.5, -z1 + 0.5, z1 - 0.5], 470, (RR) => { const k = RR(); return k < 0.5 ? [PF.fern(['fernA', 'fernC'][Math.floor(RR() * 2)], RR.range(0.9, 1.5), 1 + Math.floor(RR() * 6)), 1] : k < 0.8 ? [PF.rosette('hosta', 'leafB', 1.0, 7, 1 + Math.floor(RR() * 4)), RR.range(0.9, 1.4)] : [PF.clump('grassT', 'leafB', 0.9, 1.1, 3, 1 + Math.floor(RR() * 4)), 1]; }, pfree, y);
  // le ravin : fougères arborescentes, tapis de fougères, rochers moussus, bambous et palmiers rustiques sur les bords
  const rfree = (x, z) => x > 19.8 && x < x0 - 0.7 && z > -14.2 && z < 15.6 && polyDist(ribbonPoly(RAVIN_STREAM, 3.6), x, z) < 0 && !(Math.abs(z) < 1.6 && x > 21.7 && x < 26.2);
  // (les fougères arborescentes laissent la place des bambous posés ensuite, x = 20,6 + |z| x 0,05)
  plantBed(R, [19.8, x0 - 0.5, -14.2, 15.6], 36, (RR) => [PF.treeFern(RR.range(2.0, 3.8), 1 + Math.floor(RR() * 6)), 1], (x, z) => rfree(x, z) && ![-12.5, -9, 9, 12.5].some((bz) => hyp(x - 20.6 - Math.abs(bz) * 0.05, z - bz) < 1.3));
  plantBed(R, [19.8, x0 - 0.5, -14.2, 15.6], 520, (RR) => { const k = RR(); return k < 0.35 ? [PF.fern(['fernA', 'fernB', 'fernC'][Math.floor(RR() * 3)], RR.range(1.0, 1.7), 1 + Math.floor(RR() * 6)), 1] : k < 0.55 ? [PF.rosette('hosta', 'leafB', 1.0, 7, 1 + Math.floor(RR() * 4)), RR.range(0.9, 1.5)] : k < 0.7 ? [PF.rosette('alocasia', 'leafA', 0.85, 6, 1 + Math.floor(RR() * 6)), RR.range(0.9, 1.5)] : k < 0.82 ? [PF.clump('iris', 'leafB', 0.9, 0.9, 3, 1 + Math.floor(RR() * 4)), 1.1] : k < 0.92 ? [PF.clump('hydB', 'leafB', 0.9, 0.9, 3, 1 + Math.floor(RR() * 4)), 1.2] : [PF.clump('grassT', 'leafB', 0.9, 1.1, 3, 1 + Math.floor(RR() * 4)), 1.1]; }, (x, z) => rfree(x, z) || (polyDist(ribbonPoly(RAVIN_STREAM, 3.6), x, z) > -0.6 && polyDist(ribbonPoly(RAVIN_STREAM, 3.6), x, z) < 0));
  for (const z of [-12.5, -9, 9, 12.5]) M.place(PF.bamboo(8, 7.5, Math.round(z * 3)), 20.6 + Math.abs(z) * 0.05, 0, z, R() * TAU);
  rockPile(25.8, -5.2, 25.0, -3.0, 0.02, 6, 51, 0.8); rockPile(24.6, 6.3, 22.6, 9.4, 0.02, 7, 52, 0.8); rockPile(23.3, 11.4, 24.6, 14.6, 0.02, 6, 53, 0.9); rockPile(21.6, -1.2, 21.8, 2.6, 0.02, 5, 54, 0.9);
}

/* ---------- Labyrinthe de buis ---------- */
/* Grille de murs d'un labyrinthe parfait (parcours en profondeur, graine fixe) auquel on retire quelques murs pour faire des boucles ;
   les cases impaires sont des couloirs, les paires des murs et des poteaux (1 : mur) */
function mazeGrid(seed, cols, rows, loops) {
  const R = rngOf(seed), W = cols * 2 + 1, H = rows * 2 + 1, g = Array.from({ length: H }, () => new Array(W).fill(1)), seen = new Set(['0,0']), stack = [[0, 0]];
  g[1][1] = 0;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen.has(x + ',' + y));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(R() * nb.length)];
    g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0; g[ny * 2 + 1][nx * 2 + 1] = 0; seen.add(nx + ',' + ny); stack.push([nx, ny]);
  }
  for (let i = 0; i < loops; i++) { const x = 1 + Math.floor(R() * (W - 2)), y = 1 + Math.floor(R() * (H - 2)); if ((x % 2) !== (y % 2)) g[y][x] = 0; }
  return g;
}
/* Labyrinthe : origine (ox, oz) du coin nord-ouest, côté s (+1 sud, -1 nord : miroir en z), entrées par ouest (ligne j), nord (colonne i) et sud */
function florealMaze(s, seed) {
  const cols = 5, rows = 4, g = mazeGrid(seed, cols, rows, 7), W = g[0].length, H = g.length, ox = 19.5, oz = 23.5, Wc = 2.0, Wp = 1.0, hh = 2.2;
  g[3][0] = 0; g[0][3 * 2 + 1] = 0; g[H - 1][1 * 2 + 1] = 0; g[5][W - 1] = 0; // entrées ouest, nord, sud et une sortie vers le ravin
  // labyrinthe tressé : chaque cul-de-sac s'ouvre sur la case voisine (en face d'abord), sans tirage ; on s'y perd un peu, on n'y est jamais coincé
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], open = dirs.filter(([dx, dy]) => g[y + dy][x + dx] === 0);
    if (open.length !== 1) continue;
    const [ox0, oy0] = open[0], order = [[-ox0, -oy0], ...dirs.filter(([dx, dy]) => (dx !== ox0 || dy !== oy0) && (dx !== -ox0 || dy !== -oy0))];
    for (const [dx, dy] of order) { const nx = x + 2 * dx, ny = y + 2 * dy; if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1) { g[y + dy][x + dx] = 0; break; } }
  }
  const pos = [], wid = []; let acc = 0; for (let i = 0; i < Math.max(W, H); i++) { const w = i % 2 ? Wc : Wp; pos.push(acc); wid.push(w); acc += w; }
  const Z = (z) => z * s, open = new Map();
  const emit = (o) => { const a = Z(o.z0), b = Z(o.z1); hedge(o.x0, o.x1, Math.min(a, b), Math.max(a, b), hh, { tint: [0.84, 0.95, 0.76], bevel: 0.12 }); };
  for (let y = 0; y < H; y++) {
    const runs = []; let a = null;
    for (let x = 0; x <= W; x++) { const wall = x < W && g[y][x] === 1; if (wall && a === null) a = x; else if (!wall && a !== null) { runs.push([a, x]); a = null; } }
    const keys = new Set(runs.map((r) => r[0] + ':' + r[1]));
    for (const [k, o] of [...open]) if (!keys.has(k) || o.endY !== y - 1) { emit(o); open.delete(k); }
    for (const [xa, xb] of runs) { const k = xa + ':' + xb, o = open.get(k), z0 = oz + pos[y], z1 = z0 + wid[y]; if (o) { o.z1 = z1; o.endY = y; } else open.set(k, { x0: ox + pos[xa], x1: ox + pos[xb - 1] + wid[xb - 1], z0, z1, endY: y }); }
  }
  for (const o of open.values()) emit(o);
  return { ox, oz, w: acc, d: (() => { let t = 0; for (let i = 0; i < H; i++) t += wid[i]; return t; })() };
}

/* ---------- Roseraie, pergolas de glycines, kiosque ---------- */
/* Pergola le long de z : x0..x1 (largeur), z0..z1 (longueur), hauteur h ; glycines en rideaux, lierre et feuillage sur le toit */
function pergola(x0, x1, z0, z1, h, seed) {
  const M = DECOR, R = rngOf(seed), tint = [0.94, 0.92, 0.86], n = Math.max(2, Math.round((z1 - z0) / 2.4));
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    post(x0, z, 0, h, 0.17, tint); post(x1, z, 0, h, 0.17, tint);
    box('paintwood', x0 - 0.35, x1 + 0.35, h, h + 0.13, z - 0.08, z + 0.08, { tint, collide: false, bevel: 0.015 });
  }
  for (const x of [x0 - 0.15, (x0 + x1) / 2, x1 + 0.15]) box('paintwood', x - 0.05, x + 0.05, h + 0.13, h + 0.22, z0 - 0.1, z1 + 0.1, { tint, collide: false });
  DECOR.col(x0 - 0.3, x1 + 0.3, h, h + 0.22, z0 - 0.1, z1 + 0.1, 'wood', true);
  M.occ(x0 - 0.2, x1 + 0.2, h - 0.1, h + 0.5, z0, z1, 0.55);
  for (let z = z0 + 0.3; z < z1; z += 0.62) {
    for (const [x, ry] of [[x0 - 0.18, Math.PI / 2], [x1 + 0.18, -Math.PI / 2], [x0 + 0.22, -Math.PI / 2], [x1 - 0.22, Math.PI / 2]]) M.place(PF.hanging('wisteria', R.range(0.85, 1.1), R.range(1.7, 2.4), 1 + Math.floor(R() * 4)), x, h - 1.9 + 0.0, z + R.range(-0.15, 0.15), ry);
    M.place(PF.hanging('wisteria', 1.0, R.range(1.2, 1.8), 1 + Math.floor(R() * 4)), (x0 + x1) / 2 + R.range(-0.6, 0.6), h - 1.45, z, 0);
    M.place(PF.hanging('ivy', 1.0, R.range(0.9, 1.5), 1 + Math.floor(R() * 4)), (x0 + x1) / 2 + R.range(-0.8, 0.8), h - 1.1, z + 0.3, Math.PI / 2);
  }
  for (let z = z0; z < z1; z += 1.2) for (const x of [x0 + 0.4, (x0 + x1) / 2, x1 - 0.4]) { M.color([R.range(0.85, 1), R.range(0.92, 1), R.range(0.8, 0.95)]); leafPatch(M, 'leafB', HERB.linden, [x + R.range(-0.2, 0.2), h + 0.3, z + R.range(0, 1.2)], [R.range(-0.2, 0.2), 1, R.range(-0.2, 0.2)], R.range(1.3, 1.9), R() * TAU, { up: 1, w: [0.4, 0.4, 0.4, 0.4], ao: [0.85, 0.85, 0.85, 0.85] }); }
}
/* Kiosque : estrade ronde, six poteaux de fer blanc, toit conique vert-de-gris, bancs en cercle */
function gazebo(x, z, r = 2.2) {
  const M = DECOR, white = [0.94, 0.92, 0.86];
  M.save().move(x, 0, z).color([0.86, 0.84, 0.78]).local(1); M.lathe('flagstone', [[r + 0.25, 0], [r + 0.25, 0.22], [r + 0.1, 0.26], [0, 0.26]], 20, { sharp: 0.3, uR: 1.2 }); M.restore();
  DECOR.col(x - r * 0.86, x + r * 0.86, 0, 0.26, z - r * 0.86, z + r * 0.86, 'concrete');
  const P = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P.push([x + Math.cos(a) * (r - 0.15), z + Math.sin(a) * (r - 0.15)]); }
  for (const [px, pz] of P) { M.save().move(px, 0.26, pz).color(white).local(1); M.cyl('paint', 0.07, 2.4, 8); M.save().move(0, 0, 0); M.cyl('paint', 0.11, 0.22, 8, { r1: 0.07 }); M.restore(); M.restore(); DECOR.col(px - 0.09, px + 0.09, 0.26, 2.7, pz - 0.09, pz + 0.09, 'metal'); }
  M.save().move(x, 2.66, z).color(white).local(1); M.tube('paint', 0.05, Array.from({ length: 25 }, (_, i) => [Math.cos(i / 24 * TAU) * (r - 0.15), 0, Math.sin(i / 24 * TAU) * (r - 0.15)]), 5); M.restore();
  M.save().move(x, 2.7, z).color([0.4, 0.66, 0.56]).local(1); M.lathe('paint', [[r + 0.55, 0], [r + 0.5, 0.06], [r * 0.6, 0.6], [0.2, 1.5], [0.06, 1.9], [0, 2.1]], 18, { sharp: 0.6 }); M.restore();
  M.occ(x - r - 0.4, x + r + 0.4, 2.6, 4.4, z - r - 0.4, z + r + 0.4, 0.85);
  // bancs contre les poteaux, une travée sur deux, face au centre : les trois autres travées restent ouvertes (à 1,3 m du centre, ils laissaient
  // entre eux des passages trop étroits, on n'entrait dans le kiosque qu'en enjambant un banc : traversee.js)
  // (au sud de la carte, z < 0, la disposition se reflète comme le reste du jardin)
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + Math.PI / 6; benchAt(x + Math.cos(a) * (r - 0.75), z + Math.sign(z || 1) * Math.sin(a) * (r - 0.75), x, z, 0.26); }
}
function florealRoseraie(s, R) {
  const Z = (z) => z * s, M = DECOR, cx = -26.6, cz = 31.2;
  pergola(-34.9, -32.3, Math.min(Z(25), Z(37.5)), Math.max(Z(25), Z(37.5)), 2.7, s > 0 ? 601 : 602); pergola(-20.9, -18.3, Math.min(Z(25), Z(37.5)), Math.max(Z(25), Z(37.5)), 2.7, s > 0 ? 603 : 604);
  gazebo(cx, Z(cz), 2.2);
  // massifs de rosiers en couronne autour du kiosque, entre quatre allées
  const roses = ['roseR', 'roseP', 'roseW', 'roseY'];
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 + 0.22, a1 = (k + 1) * Math.PI / 2 - 0.22;
    for (const rr of [3.6, 6.4]) { M.save().move(cx, 0, Z(cz)).color([0.84, 0.96, 0.76]).local(1); M.lathe('hedge', [[rr - 0.18, 0], [rr - 0.2, 0.42], [rr + 0.2, 0.42], [rr + 0.18, 0]], 8, { a0, a1, sharp: 0.4, uR: 1 }); M.restore(); }
    for (let rr = 4.1; rr < 6.1; rr += 0.55) for (let a = a0 + 0.1; a < a1 - 0.05; a += 0.55 / rr) M.place(PF.clump(roses[(k + (rr > 5 ? 1 : 0)) % 4], 'leafB', 0.8, 0.8, 3, 1 + Math.floor(R() * 4), { cls: 2 }), cx + Math.cos(a) * rr, 0, Z(cz + Math.sin(a) * rr), R() * TAU, { s: R.range(0.9, 1.25) });
  }
  M.place(PF.urn('lavender', 'leafB', 1), cx + 7.2, 0, Z(cz), 0); M.place(PF.urn('lavender', 'leafB', 1), cx - 7.2, 0, Z(cz), 0);
  for (const [x, z] of [[-30.6, 26.8], [-22.6, 26.8], [-30.6, 35.8], [-22.6, 35.8]]) benchAt(x, Z(z), cx, Z(cz)); // face au kiosque
  for (const [x, z, k, h, sd] of [[-35.2, 38.8, 'linden', 9, 1], [-17.3, 38.6, 'oak', 9, 2], [-36, 23.4, 'maple', 7, 3], [-17.6, 23.6, 'ginkgo', 9, 4]]) M.place(PF.tree(k, h, 3.0, sd + (s > 0 ? 0 : 10)), x, 0, Z(z), R() * TAU);
}

/* ---------- Pelouses, promenade, allée, enceinte ---------- */
/* Lampadaire de parc en fonte vert sombre : base ouvragée, fût cannelé, lanterne à pans, flèche */
PF.gardenLamp = (lit = litOn()) => prefab('gardenLamp' + (lit ? 'L' : ''), (M) => {
  M.save().color([0.1, 0.24, 0.14]).local(1);
  M.lathe('paintwood', [[0.3, 0], [0.3, 0.1], [0.2, 0.2], [0.22, 0.5], [0.12, 0.62], [0.09, 0.7], [0.07, 3.0], [0.1, 3.06], [0.18, 3.16], [0.2, 3.24]], 10, { sharp: 0.5, uR: 0.1 });
  M.save().move(0, 3.24, 0); M.lathe('steel', [[0.22, 0], [0.2, 0.34], [0.14, 0.36], [0.02, 0.4], [0.2, 0.42], [0.04, 0.9], [0, 1.1]], 6, { sharp: 0.5 }); M.restore();
  M.color([1, 0.92, 0.7]); M.cls = 1; M.save().move(0, 3.28, 0); M.cyl(lit ? 'lamp' : 'lampOff', 0.17, 0.3, 6, { r1: 0.15 }); M.restore();
  if (lit) M.lamp(0, 3.43, 0, [1.0, 0.78, 0.5], 2.2, 10, 0.3);
  M.restore(); M.col(-0.12, 0.12, 0, 3.5, -0.12, 0.12, 'metal');
});
/* Bosquets et pelouses d'un côté de la carte : arbres isolés et massifs d'arbustes ; allée du canal, promenade, lampadaires, bancs */
function florealPelouses(s, R) {
  const Z = (z) => z * s, M = DECOR, T = (k, x, z, h, r, sd, o) => M.place(PF.tree(k, h, r, sd + (s > 0 ? 0 : 20), o), x, 0, Z(z), R() * TAU);
  // bosquets des pelouses entre l'allée, la promenade et les parterres
  for (const [k, x, z, h, r, sd] of [['oak', -14, 19.8, 12, 4.2, 1], ['linden', -8.6, 22.6, 11, 3.6, 2], ['maple', -12.4, 16.8, 8, 3.0, 3], ['ginkgo', -15.8, 23.4, 10, 2.8, 4], ['oak', 14, 19.8, 12, 4.2, 5], ['linden', 8.8, 22.8, 11, 3.6, 6], ['ginkgo', 12, 16.6, 10, 2.8, 7], ['maple', 15.4, 23.6, 8, 3.0, 8],
    ['cherry', -33, 19.5, 7.5, 3.6, 9], ['cherryW', -27.5, 22, 7.5, 3.6, 10], ['linden', -22.5, 19, 11, 3.6, 11], ['maple', -19, 21.8, 8, 3.0, 12], ['oak', 24, 18.5, 12, 4.0, 13], ['linden', 19.2, 21.5, 11, 3.4, 14], ['cherry', 35, 19.5, 7.5, 3.4, 15], ['maple', 25.6, 22.6, 8, 3.0, 16]]) T(k, x, z, h, r, sd, k === 'cherry' || k === 'cherryW' ? { shape: 'spread', th: 1.8 } : undefined);
  // charmille sur la pelouse de l'ouest : la vue des apparitions sur B (la place de la serre) filait par le passage entre les parterres
  hedge(-13.3, -10.1, Math.min(Z(18.4), Z(18.9)), Math.max(Z(18.4), Z(18.9)), 1.8, { bevel: 0.1 });
  // canal de l'allée : eau peu profonde bordée de dalles, vasques fleuries, lampadaires et bancs le long de l'allée
  const [ca, cb] = [Math.min(Z(14.6), Z(25)), Math.max(Z(14.6), Z(25))];
  pondAdd({ shape: 'rect', x: 0, y: 0.05, z: (ca + cb) / 2, w: 2.3, d: cb - ca, n: 10, wade: 0, calm: 0.6, vis: 0.6, caus: 0.7, alpha: 0.82, depth: 0.5, foam: 0.5, flow: [0, 0.1 * s], deep: [0.02, 0.07, 0.06], shallow: [0.05, 0.14, 0.11], scatter: [0.02, 0.08, 0.06] });
  // margelle de dalles tout autour : les deux longs côtés, et les deux bouts entre eux (l'eau arrivait au ras de l'allée)
  for (const sx of [-1, 1]) box('flagstone', sx > 0 ? 1.15 : -1.45, sx > 0 ? 1.45 : -1.15, 0, 0.1, ca - 0.3, cb + 0.3, { tint: [0.84, 0.8, 0.72], collide: false, bevel: 0.03 });
  for (const [z0, z1] of [[ca - 0.3, ca], [cb, cb + 0.3]]) box('flagstone', -1.15, 1.15, 0, 0.1, z0, z1, { tint: [0.84, 0.8, 0.72], collide: false, bevel: 0.03 });
  M.place(PF.lilies(0.8, 4, s > 0 ? 3 : 4, 0.5), 0, 0.06, (ca + cb) / 2, 0, { cls: 2 });
  for (const sx of [-1, 1]) { M.place(PF.urn('roseP', 'leafB', 1), sx * 2.4, 0, Z(14.2), 0); M.place(PF.urn('tulipR', 'leafB', 1), sx * 2.4, 0, Z(25.4), 0); }
  // le long des parterres, lampadaires et bancs sont adossés aux charmilles, au milieu de chaque tronçon : ni dans les trouées qui mènent
  // aux allées des parterres (z 30,7 à 31,7 et 35,7 à 36,7), ni à l'entrée de l'allée devant les apparitions (z 40,7 à 43)
  for (const z of [16, 22, 28.7, 33.7]) for (const sx of [-1, 1]) M.place(PF.gardenLamp(), sx * 4.9, 0, Z(z), 0);
  for (const z of [18.5, 38.7]) for (const sx of [-1, 1]) benchAt(sx * 4.2, Z(z), 0, Z(z)); // face à l'allée (et au canal)
  // promenade transversale : lampadaires, bancs et vasques
  for (const x of [-34, -26, -18, 18, 26, 34]) M.place(PF.gardenLamp(), x, 0, Z(16.8), 0);
  for (const x of [-22, -9, 9, 22]) benchAt(x, Z(14.3), x, Z(16)); // dos au mur de la serre, face à la promenade
  // arbustes et massifs en bordure de la promenade
  plantBed(R, [-37, 37, Math.min(Z(17.4), Z(25.5)), Math.max(Z(17.4), Z(25.5))], 90, (RR) => { const k = RR(); return k < 0.35 ? [PF.clump(['hydB', 'hydP', 'hydW', 'hydV'][Math.floor(RR() * 4)], 'leafB', 1.0, 1.0, 3, 1 + Math.floor(RR() * 4)), RR.range(1.0, 1.5)] : k < 0.6 ? [PF.clump('azalea', 'leafB', 1.0, 0.9, 3, 1 + Math.floor(RR() * 4)), RR.range(1.0, 1.5)] : k < 0.8 ? [PF.clump(['lilac', 'peony'][Math.floor(RR() * 2)], 'leafB', 1.0, 1.0, 3, 1), 1.2] : [PF.clump('dahlia', 'leafB', 0.9, 0.9, 3, 1), 1.1]; }, (x, z) => Math.abs(x) > 6 && !(x > -37 && x < -17.5 && Math.abs(z) > 24.2) && !(x > 19 && x < 38 && Math.abs(z) > 22) && polyDist(JAPON_POND, x, z) < -2 && !(Math.abs(x - 30.5) < 2.5));
}
