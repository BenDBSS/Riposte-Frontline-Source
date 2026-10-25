/* ==========================================================================
   HERBIER : les plantes de Hortus, dessinées au chargement sur deux atlas de 2048 x 2048 (aucune image à télécharger).
   Atlas A « tropical » (la Grande Serre) : monstera, feuilles de bananier et d'alocasia, palmes, fougères, ficus, orchidées,
   lianes, nénuphars. Atlas B « tempéré » (le jardin) : feuillus, érable rouge, cerisier en fleurs, ginkgo, saule, bambou,
   hortensias, roses, tulipes, lavande, prairie fleurie, herbes, roseaux, lierre, glycine.
   Chaque sprite est une carte découpée (alpha) dont la base est en bas de sa case ; HERB.<nom> donne sa région
   [u0, v0 (haut), du, dv] dans son atlas. Les toiles sont libérées après l'envoi à la carte graphique (canvasOnce).
   Les couleurs sont dessinées franches : le décor les nuance par la teinte des sommets (M.color) et l'éclairage.
   ========================================================================== */
/* Régions : nom -> [atlas, colonne, ligne, largeur, hauteur] en cases de 256 px */
const HERB_LAYOUT = {
  // atlas A
  monstera: ['A', 0, 0, 2, 2], banana: ['A', 2, 0, 1, 2], alocasia: ['A', 3, 0, 1, 1], philo: ['A', 3, 1, 1, 1],
  palm: ['A', 4, 0, 4, 1], palm2: ['A', 4, 1, 4, 1],
  fernA: ['A', 0, 2, 1, 2], fernB: ['A', 1, 2, 1, 2], treefern: ['A', 2, 2, 1, 2], ficus: ['A', 3, 2, 2, 2],
  schef: ['A', 5, 2, 1, 1], bird: ['A', 6, 2, 1, 1], orchidW: ['A', 7, 2, 1, 1], orchidP: ['A', 5, 3, 1, 1], orchidY: ['A', 6, 3, 1, 1], hibiscus: ['A', 7, 3, 1, 1],
  liana: ['A', 0, 4, 2, 2], calathea: ['A', 2, 4, 2, 2], papyrus: ['A', 4, 4, 2, 2], lily: ['A', 6, 4, 2, 2], bromel: ['A', 0, 6, 1, 1], heliconia: ['A', 1, 6, 1, 1],
  fernC: ['A', 2, 6, 1, 2], strap: ['A', 3, 6, 2, 1], trail: ['A', 3, 7, 2, 1], arum: ['A', 5, 6, 1, 1], anthurium: ['A', 6, 6, 1, 1],
  // atlas B
  oak: ['B', 0, 0, 2, 2], linden: ['B', 2, 0, 2, 2], maple: ['B', 4, 0, 2, 2], ginkgo: ['B', 6, 0, 2, 2],
  cherry: ['B', 0, 2, 2, 2], cherryW: ['B', 2, 2, 2, 2], cedar: ['B', 4, 2, 2, 2], willow: ['B', 6, 2, 2, 2],
  bamboo: ['B', 0, 4, 2, 2], hydB: ['B', 2, 4, 1, 1], hydP: ['B', 3, 4, 1, 1], hydW: ['B', 2, 5, 1, 1], hydV: ['B', 3, 5, 1, 1],
  roseR: ['B', 4, 4, 1, 1], roseP: ['B', 5, 4, 1, 1], roseW: ['B', 4, 5, 1, 1], roseY: ['B', 5, 5, 1, 1],
  tulipR: ['B', 6, 4, 1, 1], tulipP: ['B', 7, 4, 1, 1], lavender: ['B', 6, 5, 1, 1], agapanthus: ['B', 7, 5, 1, 1],
  meadow: ['B', 0, 6, 2, 1], grass: ['B', 2, 6, 1, 1], grassT: ['B', 3, 6, 1, 1], reed: ['B', 4, 6, 1, 2], iris: ['B', 5, 6, 1, 1],
  wisteria: ['B', 6, 6, 1, 2], ivy: ['B', 7, 6, 1, 2], dahlia: ['B', 0, 7, 1, 1], azalea: ['B', 1, 7, 1, 1], hosta: ['B', 2, 7, 1, 1], clover: ['B', 3, 7, 1, 1],
  lilac: ['B', 4, 7, 1, 1], peony: ['B', 5, 7, 1, 1],
};
const HERB = {};
for (const [k, v] of Object.entries(HERB_LAYOUT)) HERB[k] = [v[1] * 0.125, v[2] * 0.125, v[3] * 0.125, v[4] * 0.125];

const hbHsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
/* Feuille : base (x, y), axe tourné de ang (0 = vers le haut, sens horaire), longueur len, demi-largeur wid. Dégradé en travers
   (lumière de gauche), nervure et nervures latérales. o : vein (force 0 à 1), nerv (paires de nervures), bulge (position de la
   plus grande largeur, 0 à 1), tipk (finesse de la pointe), edge (épaisseur du contour) */
function hbLeaf(g, x, y, ang, len, wid, c0, c1, o = {}) {
  const bulge = o.bulge !== undefined ? o.bulge : 0.38, tipk = o.tipk !== undefined ? o.tipk : 0.5, vein = o.vein !== undefined ? o.vein : 0.45, nerv = o.nerv !== undefined ? o.nerv : 4;
  g.save(); g.translate(x, y); g.rotate(ang);
  const b = len * bulge, w = wid, tk = len * (0.75 + tipk * 0.12);
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(w * 0.5, -b * 0.35, w * 1.05, -b * 0.8, w * 0.8, -b * 1.25);
  g.bezierCurveTo(w * 0.5, -tk, w * 0.12, -len * 0.97, 0, -len);
  g.bezierCurveTo(-w * 0.12, -len * 0.97, -w * 0.5, -tk, -w * 0.8, -b * 1.25);
  g.bezierCurveTo(-w * 1.05, -b * 0.8, -w * 0.5, -b * 0.35, 0, 0);
  g.closePath();
  const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fill();
  if (o.edge !== 0) { g.lineWidth = o.edge || 1; g.strokeStyle = o.edgeCol || 'rgba(10,25,5,0.28)'; g.stroke(); }
  if (vein > 0 && len > 14) {
    g.lineCap = 'round';
    g.strokeStyle = o.veinCol || `rgba(235,255,200,${0.3 * vein})`; g.lineWidth = Math.max(0.8, w * 0.07);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len * 0.94); g.stroke();
    g.lineWidth = Math.max(0.6, w * 0.035); g.strokeStyle = o.veinCol2 || `rgba(235,255,200,${0.18 * vein})`;
    for (let i = 1; i <= nerv; i++) {
      const t = i / (nerv + 1) * 0.85, y0 = -len * t, ww = w * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.06)) * 0.8;
      g.beginPath(); g.moveTo(0, y0); g.lineTo(ww, y0 - len * 0.1); g.moveTo(0, y0); g.lineTo(-ww, y0 - len * 0.1); g.stroke();
    }
  }
  g.restore();
}
/* Fleur : n pétales ovales autour de (x, y), rayon r. col : [bord, cœur du pétale], centre : couleur du cœur */
function hbFlower(g, x, y, r, n, col, centre, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.rot || 0);
  for (let i = 0; i < n; i++) {
    g.save(); g.rotate((i / n) * TAU);
    const gr = g.createLinearGradient(0, 0, 0, -r); gr.addColorStop(0, col[1]); gr.addColorStop(1, col[0]);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, -r * 0.55, r * (o.wid || 0.32), r * 0.5, 0, 0, TAU); g.fill();
    if (o.edge) { g.strokeStyle = o.edge; g.lineWidth = 0.8; g.stroke(); }
    g.restore();
  }
  if (centre) { g.fillStyle = centre; g.beginPath(); g.arc(0, 0, r * (o.cr || 0.2), 0, TAU); g.fill(); }
  g.restore();
}
/* Tige : segment, courbe quadratique (3 points) ou cubique (4 points) */
function hbStem(g, pts, w, col) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3) g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else if (pts.length === 4) g.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
  else g.lineTo(pts[1][0], pts[1][1]);
  g.stroke();
}
/* Une case : dessin coupé à son rectangle, origine dans son coin haut gauche */
function hbCell(g, name, fn) {
  const L = HERB_LAYOUT[name];
  g.save(); g.translate(L[1] * 256, L[2] * 256); g.beginPath(); g.rect(0, 0, L[3] * 256, L[4] * 256); g.clip();
  fn(L[3] * 256, L[4] * 256); g.restore();
}
/* Cœur : contour d'une feuille cordée centrée en (cx, cy), largeur w, pointe en haut, échancrure en bas */
function hbHeartPath(g, cx, cy, w, tip = 1) {
  const s = w / 32, P = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * TAU, X = 16 * Math.pow(Math.sin(t), 3), Y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    P.push([cx + X * s, cy + Y * s * (Y < 0 ? tip : 1)]);
  }
  g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  return P;
}
/* Fronde dressée de fougère : base au milieu du bas de la case, pointe en haut, rachis courbe, pennes de part et d'autre.
   o : n (paires), lobes (pinnules par penne), spread, bend (courbure), wide (longueur max des pennes), c0, c1 */
function hbFrond(g, W, H, R, o = {}) {
  const n = o.n || 34, c0 = o.c0 || hbHsl(112, 52, 36), c1 = o.c1 || hbHsl(118, 55, 18), bend = o.bend !== undefined ? o.bend : 26, base = H - 6, top = 10;
  const px = (t) => W / 2 + bend * t * t, py = (t) => base - (base - top) * t, ang = (t) => Math.atan2(2 * bend * t, base - top);
  hbStem(g, [[px(0), py(0)], [px(0.4), py(0.4)], [px(0.75), py(0.75)], [px(1), py(1)]], 3.2, hbHsl(95, 38, 24));
  const maxL = o.wide || W * 0.46;
  for (let i = 0; i < n; i++) {
    const t = 0.06 + (i / n) * 0.93, prof = Math.pow(Math.sin(Math.PI * Math.min(1, t + 0.04)), o.prof || 0.75) * (1 - t * 0.28);
    const len = Math.max(8, maxL * prof), a = ang(t);
    for (const s of [-1, 1]) {
      const aa = a + s * (1.5708 - ((o.spread || 1) + R() * 0.12) * 0.62);
      hbLeaf(g, px(t), py(t), aa, len, len * (o.lw || 0.17), c0, c1, { vein: 0.25, nerv: 0, edge: 0.7, bulge: 0.45 });
      if (o.lobes) for (let k = 1; k <= o.lobes; k++) {
        const u = k / (o.lobes + 1), ll = len * 0.34 * (1 - u * 0.45), bx = px(t) + Math.sin(aa) * len * u * 0.85, by = py(t) - Math.cos(aa) * len * u * 0.85;
        hbLeaf(g, bx, by, aa + 0.9, ll, ll * 0.32, c0, c1, { vein: 0, edge: 0.5 });
        hbLeaf(g, bx, by, aa - 0.9, ll, ll * 0.32, c0, c1, { vein: 0, edge: 0.5 });
      }
    }
  }
}
/* Palme horizontale : rachis de gauche à droite au milieu de la case, folioles couchées vers la pointe, dessus et dessous */
function hbPalm(g, W, H, R, o = {}) {
  const n = o.n || 46, mid = H / 2, c0 = o.c0 || hbHsl(105, 55, 36), c1 = o.c1 || hbHsl(115, 58, 17), droop = o.droop || 8;
  hbStem(g, [[4, mid], [W * 0.35, mid - 3], [W * 0.7, mid + droop * 0.4], [W - 6, mid + droop]], 3.4, hbHsl(90, 35, 26));
  for (let i = 0; i < n; i++) {
    const t = 0.04 + (i / n) * 0.94, x = 4 + t * (W - 10), y = mid - 3 * Math.sin(t * 2) + droop * t * t * 0.9;
    const prof = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.06)), 0.7), len = H * (o.len || 0.47) * prof + 6;
    const e = 0.62 + R() * 0.14 + t * 0.1;
    hbLeaf(g, x, y, 1.5708 - e, len, len * (o.lw || 0.075), c0, c1, { vein: 0.3, nerv: 0, bulge: 0.5, edge: 0.6 });
    hbLeaf(g, x, y, 1.5708 + e + 0.12, len * 0.94, len * (o.lw || 0.075), c0, c1, { vein: 0.3, nerv: 0, bulge: 0.5, edge: 0.6 });
  }
}
/* Amas de feuilles (couronne d'arbre) : quelques bosses voisines dans une ellipse, pour un contour irrégulier ; fn(g, x, y, k, i)
   dessine une feuille ; k = clarté 0 (dedans, dessous) à 1 (dessus, dehors) */
function hbMass(g, cx, cy, rx, ry, n, R, fn) {
  const C = [], m = 6 + Math.floor(R() * 3);
  for (let i = 0; i < m; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 0.55; C.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 0.3 + R() * 0.24]); }
  const P = [];
  for (let i = 0; i < n; i++) {
    const c = C[Math.floor(R() * m)], a = R() * TAU, d = Math.pow(R(), 0.72), x = c[0] + Math.cos(a) * rx * c[2] * d, y = c[1] + Math.sin(a) * ry * c[2] * d;
    const top = 0.5 - (y - cy) / (2 * ry), out = hyp((x - cx) / rx, (y - cy) / ry), k = clamp(top * 0.55 + out * 0.4 + R() * 0.25, 0, 1);
    P.push([x, y, k, out]);
  }
  P.sort((p, q) => p[3] - q[3]);
  P.forEach((p, i) => fn(g, p[0], p[1], p[2], i));
}
/* Lobe de feuille d'érable : étoile à n pointes dentelées autour de (x, y), rayon r */
function hbMaple(g, x, y, r, rot, c0, c1) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.1); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.beginPath();
  const pts = 5, steps = pts * 6;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU, lobe = Math.pow(Math.max(0, Math.cos(a * pts / 2)), 1.6), tooth = 0.1 * Math.sin(a * pts * 3), rr = r * (0.34 + 0.66 * lobe + tooth * lobe);
    const px = Math.sin(a) * rr, py = -Math.cos(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(40,5,5,0.3)'; g.stroke();
  g.strokeStyle = 'rgba(255,220,170,0.28)'; g.lineWidth = 0.9; g.beginPath();
  for (let i = 0; i < pts; i++) { const a = (i / pts) * TAU; g.moveTo(0, 0); g.lineTo(Math.sin(a) * r * 0.8, -Math.cos(a) * r * 0.8); }
  g.stroke(); g.restore();
}

/* Rameau feuillu : base en bas au milieu de la case, tige centrale qui s'infléchit, rameaux alternes et feuilles par paires.
   leaf(g, x, y, ang, taille, k) dessine une feuille (k : clarté 0 à 1, croissante vers la pointe) ; o : n (nœuds), twig (couleur de la tige),
   size (taille des feuilles en px), sub (rameaux latéraux) */
function hbSpray(g, W, H, R, o) {
  const twig = o.twig || hbHsl(28, 32, 15), size = o.size || 44;
  const branch = (x, y, ang, len, depth, k0) => {
    const n = Math.max(3, Math.round(len / (o.step || 30))), drift = (R() - 0.5) * 0.5;
    let px = x, py = y, a = ang;
    g.strokeStyle = twig; g.lineCap = 'round';
    for (let i = 1; i <= n; i++) {
      const t = i / n, st = len / n; a += drift * 0.12 + (R() - 0.5) * 0.12;
      const nx = px + Math.sin(a) * st, ny = py - Math.cos(a) * st;
      g.lineWidth = Math.max(1.2, (depth === 0 ? 4.2 : 2.2) * (1 - t * 0.6)); g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      const k = clamp(k0 + t * 0.5 + (R() - 0.5) * 0.3, 0, 1), sz = size * (1 - t * 0.35) * (0.85 + R() * 0.3) * (depth ? 0.85 : 1);
      if (i > 1) for (const sd of [-1, 1]) if (!o.alt || (i + (sd > 0 ? 1 : 0)) % 2 === 0) o.leaf(g, nx, ny, a + sd * (0.75 + R() * 0.45), sz, k);
      if (depth < (o.sub === undefined ? 1 : o.sub) && i > 1 && i < n && R() < 0.62) branch(nx, ny, a + (R() < 0.5 ? -1 : 1) * (0.55 + R() * 0.45), len * 0.5, depth + 1, k);
      px = nx; py = ny;
    }
    o.leaf(g, px, py, a, size * 1.1, clamp(k0 + 0.55, 0, 1));
  };
  branch(W / 2, H - 8, (R() - 0.5) * 0.3, H * 0.62, 0, 0.1);
  branch(W / 2, H - 8, -0.5 + R() * 0.1, H * 0.46, 1, 0.1);
  branch(W / 2, H - 8, 0.5 + R() * 0.1, H * 0.46, 1, 0.1);
}

/* ---------- Atlas A : la Grande Serre ---------- */
function herbierDrawA(g, R) {
  // monstera : grande feuille cordée percée de fentes et de trous
  hbCell(g, 'monstera', (W, H) => {
    const cx = 256, cy = 286, w = 420;
    g.save(); hbStem(g, [[cx, H - 4], [cx + 4, 440], [cx, 352]], 9, hbHsl(112, 40, 24));
    const P = hbHeartPath(g, cx, cy, w, 1.0); void P; const gr = g.createLinearGradient(cx - w / 2, cy - 230, cx + w / 2, cy + 160);
    gr.addColorStop(0, hbHsl(128, 48, 28)); gr.addColorStop(0.5, hbHsl(134, 52, 19)); gr.addColorStop(1, hbHsl(140, 55, 11)); g.fillStyle = gr; g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(5,25,10,0.5)'; g.stroke(); g.clip();
    // reflet vernissé : bande claire sur le côté éclairé
    const sh = g.createLinearGradient(cx - w / 2, cy - 120, cx + 40, cy + 20); sh.addColorStop(0, 'rgba(200,255,200,0.2)'); sh.addColorStop(1, 'rgba(200,255,200,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
    // nervures : médiane et latérales jusqu'aux fentes
    g.lineCap = 'round'; g.strokeStyle = hbHsl(100, 42, 52, 0.85); g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy + 60); g.lineTo(cx, cy - 215); g.stroke();
    g.lineWidth = 2.6; g.strokeStyle = hbHsl(100, 40, 48, 0.5);
    const C = [cx, cy + 22];
    for (const s of [-1, 1]) for (const d of [24, 44, 64, 84, 104, 124, 144]) { const a = (d + 10) * Math.PI / 180 * s; g.beginPath(); g.moveTo(cx, cy + 50 - d * 0.55); g.lineTo(C[0] + Math.sin(a) * 300, C[1] - Math.cos(a) * 300); g.stroke(); }
    // fentes depuis le bord, trous le long de la médiane (gomme : la couleur de remplissage doit être opaque)
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (const s of [-1, 1]) for (const d of [34, 54, 74, 94, 114, 134, 152]) {
      const a = d * Math.PI / 180 * s, dx = Math.sin(a), dy = -Math.cos(a), nx = -dy, ny = dx, r0 = 78 + (150 - d) * 0.28 + R() * 12, r1 = 330;
      g.beginPath(); g.moveTo(C[0] + dx * r0 + nx * 2, C[1] + dy * r0 + ny * 2); g.lineTo(C[0] + dx * r1 + nx * 22, C[1] + dy * r1 + ny * 22);
      g.lineTo(C[0] + dx * r1 - nx * 22, C[1] + dy * r1 - ny * 22); g.lineTo(C[0] + dx * r0 - nx * 2, C[1] + dy * r0 - ny * 2); g.closePath(); g.fill();
    }
    for (const s of [-1, 1]) for (const [x, y, rr] of [[40, -40, 11], [66, 14, 10], [36, 70, 12], [92, -78, 9], [100, 56, 9], [62, -118, 8]]) { g.beginPath(); g.ellipse(cx + s * x, cy + y, rr * 0.6, rr * 1.4, s * 0.4, 0, TAU); g.fill(); }
    g.restore();
  });
  // bananier : longue feuille déchirée entre les nervures
  hbCell(g, 'banana', (W, H) => {
    g.save(); const cx = 128;
    hbLeaf(g, cx, H - 12, 0, 485, 108, hbHsl(96, 62, 40), hbHsl(104, 64, 22), { vein: 0, edge: 1.2, bulge: 0.48, tipk: 0.8 });
    g.lineCap = 'round';
    for (let i = 1; i < 44; i++) { const t = i / 45, y = H - 12 - 480 * t, ww = 100 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03)); g.strokeStyle = i % 2 ? 'rgba(220,255,160,0.17)' : 'rgba(10,40,5,0.14)'; g.lineWidth = 1.4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + s * ww, y - 20 - 8 * t); g.stroke(); } }
    g.strokeStyle = hbHsl(80, 50, 66, 0.85); g.lineWidth = 5; g.beginPath(); g.moveTo(cx, H - 6); g.lineTo(cx, 30); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (let i = 0; i < 20; i++) { const t = 0.1 + R() * 0.8, y = H - 12 - 480 * t, ww = 105 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03)), s = R() < 0.5 ? -1 : 1, d = (0.4 + R() * 0.5) * ww; g.beginPath(); g.moveTo(cx + s * (ww + 6), y - 40); g.lineTo(cx + s * (ww - d), y - 14 - 8 * t); g.lineTo(cx + s * (ww + 6), y - 22 - R() * 4); g.closePath(); g.fill(); }
    g.restore();
  });
  // alocasia : feuille en fer de lance aux nervures claires
  hbCell(g, 'alocasia', (W, H) => {
    g.save(); const cx = 128;
    hbStem(g, [[cx, H - 2], [cx, 210]], 6, hbHsl(110, 30, 30));
    g.beginPath(); g.moveTo(cx, 16); g.bezierCurveTo(cx + 70, 50, cx + 100, 130, cx + 78, 200); g.bezierCurveTo(cx + 66, 232, cx + 18, 236, cx, 196);
    g.bezierCurveTo(cx - 18, 236, cx - 66, 232, cx - 78, 200); g.bezierCurveTo(cx - 100, 130, cx - 70, 50, cx, 16); g.closePath();
    const gr = g.createLinearGradient(cx - 90, 20, cx + 80, 220); gr.addColorStop(0, hbHsl(150, 42, 24)); gr.addColorStop(1, hbHsl(160, 48, 11)); g.fillStyle = gr; g.fill(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(0,15,5,0.5)'; g.stroke();
    g.strokeStyle = hbHsl(95, 55, 72, 0.9); g.lineWidth = 4.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, 200); g.lineTo(cx, 28); g.stroke();
    g.lineWidth = 2.2; g.strokeStyle = hbHsl(95, 50, 68, 0.75);
    for (let i = 1; i <= 6; i++) { const y = 190 - i * 27; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, y + 4); g.quadraticCurveTo(cx + s * 36, y - 6, cx + s * (66 - i * 6), y - 26); g.stroke(); } }
    g.restore();
  });
  // philodendron : feuille cordée vernissée
  hbCell(g, 'philo', (W, H) => {
    g.save(); const cx = 128; hbStem(g, [[cx, H - 2], [cx - 2, 190]], 5, hbHsl(120, 30, 28));
    hbHeartPath(g, cx, 120, 190, 1.3); const gr = g.createLinearGradient(cx - 90, 20, cx + 90, 200); gr.addColorStop(0, hbHsl(122, 56, 38)); gr.addColorStop(1, hbHsl(132, 60, 15)); g.fillStyle = gr; g.fill(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(0,20,5,0.5)'; g.stroke();
    g.strokeStyle = hbHsl(90, 50, 70, 0.8); g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, 150); g.lineTo(cx, 28); g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = hbHsl(90, 45, 65, 0.55);
    for (let i = 1; i <= 5; i++) for (const s of [-1, 1]) { const y = 150 - i * 20; g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + s * 30, y - 4, cx + s * (72 - i * 5), y - 18); g.stroke(); }
    g.fillStyle = 'rgba(230,255,220,0.08)'; g.beginPath(); g.ellipse(cx - 30, 70, 30, 14, -0.6, 0, TAU); g.fill();
    g.restore();
  });
  hbCell(g, 'palm', (W, H) => hbPalm(g, W, H, R, { n: 52 }));
  hbCell(g, 'palm2', (W, H) => hbPalm(g, W, H, R, { n: 36, c0: hbHsl(95, 62, 46), c1: hbHsl(105, 62, 24), droop: 26, len: 0.5, lw: 0.06 }));
  hbCell(g, 'fernA', (W, H) => hbFrond(g, W, H, R, { n: 36, bend: 30 }));
  // fougère capillaire : rachis noir, ramilles et pinnules en éventail
  hbCell(g, 'fernB', (W, H) => {
    const base = H - 6; hbStem(g, [[W / 2, base], [W / 2 + 6, 300], [W / 2 + 30, 100], [W / 2 + 56, 14]], 2.6, hbHsl(20, 40, 14));
    const sx = (t) => { const u = t; return W / 2 + 56 * u * u * u + 6 * 3 * u * (1 - u) * (1 - u) * 0 + 6 * u * 0; };
    for (let i = 0; i < 17; i++) {
      const t = 0.1 + (i / 17) * 0.88, x = W / 2 + 60 * t * t * (1.0 + t * 0.2), y = base - (base - 14) * t;
      for (const s of [-1, 1]) {
        const L = 100 * Math.sin(Math.PI * Math.min(1, t + 0.1)) * (1 - t * 0.5) + 14, a = s * (1.0 + R() * 0.2) + 0.3 * t;
        hbStem(g, [[x, y], [x + Math.sin(a) * L, y - Math.cos(a) * L * 0.7]], 1.2, hbHsl(20, 40, 14, 0.9));
        for (let k = 1; k <= 7; k++) { const u = k / 7.5, bx = x + Math.sin(a) * L * u, by = y - Math.cos(a) * L * 0.7 * u, rr = 7 + 6 * Math.sin(u * 3) + R() * 2; g.fillStyle = hbHsl(112 + R() * 12, 52, 38 + R() * 12, 0.97); g.beginPath(); g.ellipse(bx, by - 3, rr * 0.9, rr * 0.75, a * 0.5, 0, TAU); g.fill(); }
      }
    }
  });
  hbCell(g, 'treefern', (W, H) => hbFrond(g, W, H, R, { n: 30, lobes: 4, bend: 16, wide: 118, c0: hbHsl(104, 54, 34), c1: hbHsl(112, 56, 15), lw: 0.15, spread: 0.92 }));
  hbCell(g, 'fernC', (W, H) => hbFrond(g, W, H, R, { n: 22, lobes: 3, bend: -22, wide: 120, c0: hbHsl(86, 62, 44), c1: hbHsl(96, 62, 22), lw: 0.2, prof: 0.55, spread: 1.1 }));
  // ficus : rameau de feuilles vernissées
  hbCell(g, 'ficus', (W, H) => hbSpray(g, W, H, R, { size: 50, step: 36, twig: hbHsl(70, 22, 18), leaf: (g2, x, y, a, sz, k) => hbLeaf(g2, x, y, a, sz * 1.1, sz * 0.38, hbHsl(120 + R() * 12, 50, 18 + k * 14 + R() * 4), hbHsl(130, 56, 9 + k * 8), { vein: 0.45, nerv: 4, bulge: 0.45, edge: 0.6 }) }));
  // schefflera : feuille palmée à sept folioles
  hbCell(g, 'schef', (W, H) => {
    const cx = 128, cy = 120; hbStem(g, [[cx, H - 2], [cx, cy]], 5, hbHsl(100, 30, 32));
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.5, L = 105 - Math.abs(i - 3) * 9; hbLeaf(g, cx, cy, a, L, 26, hbHsl(112, 55, 38), hbHsl(122, 58, 18), { vein: 0.5, nerv: 5, bulge: 0.55, tipk: 0.2 }); }
  });
  // oiseau de paradis : fleur orange et bleue
  hbCell(g, 'bird', (W, H) => {
    const cx = 100; hbStem(g, [[cx, H - 2], [cx + 6, 170], [cx + 18, 118]], 5, hbHsl(100, 35, 28));
    hbLeaf(g, cx + 6, H - 6, -0.35, 120, 26, hbHsl(100, 60, 40), hbHsl(108, 62, 20), { nerv: 7, bulge: 0.5 });
    hbLeaf(g, cx + 6, H - 6, 0.5, 100, 22, hbHsl(100, 60, 38), hbHsl(108, 62, 18), { nerv: 6, bulge: 0.5 });
    g.save(); g.translate(cx + 18, 122); g.rotate(0.25);
    g.fillStyle = hbHsl(110, 45, 28); g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(-34, -18, 6, -26); g.quadraticCurveTo(46, -22, 36, 6); g.quadraticCurveTo(14, 18, -6, 4); g.fill();
    for (const a of [-0.5, 0, 0.5]) hbLeaf(g, 6, -8, a, 70 - Math.abs(a) * 24, 10, hbHsl(30, 100, 54), hbHsl(14, 92, 42), { vein: 0, edge: 0.6, tipk: 0.9 });
    for (const a of [-0.2, 0.2]) hbLeaf(g, 10, -6, a + 0.1, 40, 7, hbHsl(228, 76, 52), hbHsl(236, 80, 32), { vein: 0, edge: 0.6, tipk: 0.9 });
    g.restore();
  });
  for (const [nm, c0, c1, lip] of [['orchidW', hbHsl(330, 20, 97), hbHsl(330, 24, 84), hbHsl(320, 80, 48)], ['orchidP', hbHsl(330, 68, 70), hbHsl(335, 70, 52), hbHsl(320, 85, 32)], ['orchidY', hbHsl(52, 90, 66), hbHsl(40, 90, 48), hbHsl(10, 80, 40)]]) {
    hbCell(g, nm, (W, H) => {
      hbLeaf(g, 70, H - 4, -0.5, 95, 26, hbHsl(120, 40, 30), hbHsl(130, 44, 16), { vein: 0.3, nerv: 3, bulge: 0.5 });
      hbLeaf(g, 70, H - 4, 0.3, 105, 28, hbHsl(120, 42, 32), hbHsl(130, 46, 16), { vein: 0.3, nerv: 3, bulge: 0.5 });
      const pts = [[78, H - 8], [96, 170], [118, 100], [170, 52]];
      hbStem(g, pts, 3, hbHsl(90, 30, 28));
      for (let i = 0; i < 6; i++) {
        const t = 0.2 + i * 0.14, u = 1 - t, x = u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0], y = u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1];
        const r = 22 - i * 2;
        for (const s of [-1, 1]) { g.fillStyle = c1; g.beginPath(); g.ellipse(x + s * r * 0.62, y - r * 0.15, r * 0.62, r * 0.5, s * 0.5, 0, TAU); g.fill(); g.fillStyle = c0; g.beginPath(); g.ellipse(x + s * r * 0.58, y - r * 0.2, r * 0.54, r * 0.42, s * 0.5, 0, TAU); g.fill(); }
        g.fillStyle = c0; g.beginPath(); g.ellipse(x, y - r * 0.7, r * 0.3, r * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = lip; g.beginPath(); g.ellipse(x, y + r * 0.35, r * 0.26, r * 0.34, 0, 0, TAU); g.fill();
      }
    });
  }
  hbCell(g, 'hibiscus', (W, H) => {
    hbStem(g, [[128, H - 2], [120, 150], [128, 100]], 4, hbHsl(100, 30, 26));
    for (const [x, y, a] of [[70, 190, -1.2], [190, 180, 1.2], [90, 130, -0.6], [170, 120, 0.7], [128, 86, 0]]) hbLeaf(g, 128 + (x - 128) * 0.2, y + 40, a, 78, 28, hbHsl(122, 56, 34), hbHsl(130, 60, 16), { vein: 0.4, nerv: 5, bulge: 0.5 });
    for (const [x, y, r, rot] of [[90, 90, 36, 0.3], [170, 130, 32, -0.4], [128, 54, 30, 1]]) {
      hbFlower(g, x, y, r, 5, [hbHsl(2, 92, 46), hbHsl(0, 90, 28)], hbHsl(350, 80, 20), { rot, wid: 0.46, cr: 0.16 });
      hbStem(g, [[x, y], [x + 8 * Math.cos(rot), y - r * 0.9]], 2.4, hbHsl(48, 90, 70)); g.fillStyle = hbHsl(45, 100, 60); g.beginPath(); g.arc(x + 8 * Math.cos(rot), y - r * 0.9, 3, 0, TAU); g.fill();
    }
  });
  // lianes : brins pendants garnis de feuilles en cœur
  hbCell(g, 'liana', (W, H) => {
    for (let k = 0; k < 7; k++) {
      const x0 = 40 + k * 70 + (R() - 0.5) * 30, L = 260 + R() * 230, ph = R() * TAU, amp = 8 + R() * 10;
      g.strokeStyle = hbHsl(75, 25, 24 + R() * 6); g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, 0);
      const X = (y) => x0 + Math.sin(y * 0.02 + ph) * amp;
      for (let y = 4; y <= L; y += 6) g.lineTo(X(y), y); g.stroke();
      for (let y = 26; y < L; y += 16 + R() * 14) {
        const s = R() < 0.5 ? -1 : 1, a = s * (0.9 + R() * 0.7), r = 11 + R() * 6, x = X(y);
        g.save(); g.translate(x, y); g.rotate(a);
        hbHeartPath(g, 0, -r, r * 1.5, 1.2); const gr = g.createLinearGradient(-r, 0, r, 0); gr.addColorStop(0, hbHsl(115 + R() * 15, 52, 36)); gr.addColorStop(1, hbHsl(125, 56, 18)); g.fillStyle = gr; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(0,20,5,0.4)'; g.stroke(); g.restore();
      }
    }
    // racines aériennes : fils très fins
    g.strokeStyle = 'rgba(70,52,34,0.8)'; g.lineWidth = 1.2; for (let k = 0; k < 9; k++) { const x = R() * W, L = 200 + R() * 300; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < L; y += 10) g.lineTo(x + Math.sin(y * 0.03 + k) * 3, y); g.stroke(); }
  });
  // calathea : feuilles ovales rayées d'argent
  hbCell(g, 'calathea', (W, H) => {
    const cx = 256, by = H - 6, items = [];
    for (let i = 0; i < 17; i++) items.push([(i / 16 - 0.5) * 2.5 + (R() - 0.5) * 0.25, 150 + R() * 100, 40 + R() * 16, R()]);
    items.sort((p, q) => Math.abs(q[0]) - Math.abs(p[0]));
    for (const [a, L, w, r] of items) {
      hbLeaf(g, cx + a * 28, by, a, L, w, hbHsl(128, 42, 30 + r * 8), hbHsl(140, 46, 14), { vein: 0.9, nerv: 9, bulge: 0.5, tipk: 0.6, veinCol: 'rgba(230,255,230,0.5)', veinCol2: 'rgba(230,255,230,0.3)' });
    }
  });
  hbCell(g, 'papyrus', (W, H) => {
    for (let k = 0; k < 22; k++) {
      const x0 = 256 + (R() - 0.5) * 80, a = (R() - 0.5) * 1.1, L = 260 + R() * 220, tx = x0 + Math.sin(a) * L, ty = H - 6 - Math.cos(a) * L;
      hbStem(g, [[x0, H - 6], [x0 + Math.sin(a) * L * 0.55, H - 6 - Math.cos(a) * L * 0.55], [tx, ty]], 2.6, hbHsl(100, 40, 27 + R() * 8));
      for (let j = 0; j < 22; j++) { const b = -1.4 + (j / 21) * 2.8 + (R() - 0.5) * 0.1, l = 38 + R() * 14; hbStem(g, [[tx, ty], [tx + Math.sin(b) * l, ty - Math.cos(b) * l + 10 * Math.abs(b) * 0.4]], 1.1, hbHsl(94, 42, 31 + R() * 8)); }
    }
  });
  // nénuphars et lotus (vus de dessus)
  hbCell(g, 'lily', (W, H) => {
    const pad = (x, y, r, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, 0.22, TAU - 0.22); g.closePath();
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.1); gr.addColorStop(0, hbHsl(110, 52, 38)); gr.addColorStop(1, hbHsl(122, 56, 18)); g.fillStyle = gr; g.fill();
      g.lineWidth = 1.2; g.strokeStyle = 'rgba(5,25,5,0.45)'; g.stroke();
      g.strokeStyle = 'rgba(215,255,190,0.28)'; g.lineWidth = 1; for (let i = 0; i < 14; i++) { const a = 0.4 + (i / 13) * (TAU - 0.8); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); g.stroke(); }
      g.restore();
    };
    pad(128, 128, 108, 0.4); pad(384, 120, 92, 2.2); pad(110, 392, 54, 4.0);
    const flower = (x, y, r, c0, c1, y0) => {
      for (const [n, k, o] of [[10, 1.0, 0], [8, 0.78, 0.2], [6, 0.52, 0.4]]) hbFlower(g, x, y, r * k, n, [c0, c1], null, { rot: o, wid: 0.2 });
      g.fillStyle = y0; g.beginPath(); g.arc(x, y, r * 0.16, 0, TAU); g.fill(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.fillStyle = hbHsl(48, 95, 55); g.beginPath(); g.arc(x + Math.cos(a) * r * 0.13, y + Math.sin(a) * r * 0.13, 2, 0, TAU); g.fill(); }
    };
    pad(380, 380, 84, 1.0); flower(380, 380, 62, hbHsl(334, 70, 80), hbHsl(340, 76, 62), hbHsl(48, 95, 55));
    flower(250, 270, 38, hbHsl(0, 0, 98), hbHsl(60, 40, 86), hbHsl(48, 95, 55)); flower(120, 128, 34, hbHsl(335, 78, 76), hbHsl(342, 80, 58), hbHsl(48, 95, 55));
  });
  hbCell(g, 'bromel', (W, H) => {
    for (let i = 0; i < 13; i++) { const a = (i / 12 - 0.5) * 2.5, L = 110 + R() * 70; hbLeaf(g, 128, H - 6, a, L, 17, hbHsl(i % 2 ? 100 : 12, 60, i % 2 ? 36 : 44), hbHsl(i % 2 ? 108 : 6, 64, i % 2 ? 20 : 26), { vein: 0.3, nerv: 0, bulge: 0.5, tipk: 0.9 }); }
    for (let i = 0; i < 7; i++) hbLeaf(g, 128, H - 6, (i / 6 - 0.5) * 1.1, 80 + R() * 30, 12, hbHsl(2, 85, 52), hbHsl(0, 88, 30), { vein: 0, tipk: 0.9 });
    hbStem(g, [[128, H - 20], [128, 90]], 5, hbHsl(5, 70, 40)); hbFlower(g, 128, 82, 22, 7, [hbHsl(48, 100, 62), hbHsl(30, 100, 52)], hbHsl(5, 90, 40), { wid: 0.25 });
  });
  hbCell(g, 'heliconia', (W, H) => {
    hbLeaf(g, 90, H - 4, -0.5, 130, 36, hbHsl(100, 58, 36), hbHsl(108, 60, 18), { nerv: 7, bulge: 0.5 }); hbLeaf(g, 160, H - 4, 0.45, 120, 32, hbHsl(100, 58, 34), hbHsl(108, 60, 16), { nerv: 7, bulge: 0.5 });
    hbStem(g, [[128, H - 4], [124, 140], [138, 74]], 4, hbHsl(100, 35, 28));
    for (let i = 0; i < 7; i++) { const t = i / 6, x = 138 + (i % 2 ? 14 : -14) - t * 8, y = 86 + t * 74; g.save(); g.translate(x, y); g.rotate(i % 2 ? 0.9 : -0.9); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(26, -10, 40 - i * 2, 6); g.quadraticCurveTo(20, 14, 0, 0); g.fillStyle = hbHsl(i % 3 === 2 ? 48 : 2, 92, i % 3 === 2 ? 56 : 46); g.fill(); g.lineWidth = 1; g.strokeStyle = hbHsl(40, 90, 32); g.stroke(); g.restore(); }
  });
  hbCell(g, 'strap', (W, H) => {
    for (let i = 0; i < 11; i++) { const a = (i / 10 - 0.5) * 2.2 + (R() - 0.5) * 0.12, L = 170 + R() * 70; hbLeaf(g, W / 2, H - 6, a, L, 26 + R() * 7, hbHsl(106 + R() * 10, 56, 40), hbHsl(112, 58, 20), { vein: 0.5, nerv: 0, bulge: 0.5, tipk: 0.7 }); }
  });
  hbCell(g, 'trail', (W, H) => {
    for (let k = 0; k < 5; k++) {
      const x0 = 80 + k * 80 + R() * 20, L = 150 + R() * 90;
      g.strokeStyle = hbHsl(330, 25, 34); g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, 0); for (let y = 4; y < L; y += 5) g.lineTo(x0 + Math.sin(y * 0.05 + k) * 7, y); g.stroke();
      for (let y = 14; y < L; y += 12 + R() * 6) { const s = R() < 0.5 ? -1 : 1, x = x0 + Math.sin(y * 0.05 + k) * 7; hbLeaf(g, x, y, s * (1.3 + R() * 0.6) + 3.14, 24 + R() * 8, 8, hbHsl(120 + R() * 20, 45, 34), hbHsl(290, 40, 24), { vein: 0.4, nerv: 0 }); }
    }
  });
  hbCell(g, 'arum', (W, H) => {
    for (const [x, a, L] of [[96, -0.4, 150], [160, 0.35, 140], [126, 0.02, 160]]) hbLeaf(g, x, H - 4, a, L, 30, hbHsl(115, 50, 34), hbHsl(125, 56, 16), { nerv: 6, bulge: 0.4 });
    for (const [x, y, a] of [[100, 92, -0.2], [150, 70, 0.25]]) {
      hbStem(g, [[x - (x - 126) * 0.4, H - 6], [x, y + 50], [x, y]], 3, hbHsl(100, 35, 34));
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-34, 10, -24, -40, 0, -52); g.bezierCurveTo(26, -38, 30, 10, 0, 30);
      const gr = g.createLinearGradient(-30, 0, 30, 0); gr.addColorStop(0, hbHsl(60, 30, 99)); gr.addColorStop(1, hbHsl(60, 24, 84)); g.fillStyle = gr; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(120,120,90,0.4)'; g.stroke();
      g.fillStyle = hbHsl(50, 95, 55); g.beginPath(); g.ellipse(0, 4, 4, 16, 0, 0, TAU); g.fill(); g.restore();
    }
  });
  hbCell(g, 'anthurium', (W, H) => {
    for (const [x, a] of [[80, -0.5], [170, 0.5], [126, 0]]) hbLeaf(g, x, H - 4, a, 110, 38, hbHsl(122, 56, 30), hbHsl(132, 60, 14), { nerv: 6, bulge: 0.35, tipk: 0.3 });
    for (const [x, y, a] of [[100, 100, -0.3], [158, 82, 0.3]]) {
      hbStem(g, [[126, H - 6], [x, y + 60], [x, y]], 3, hbHsl(100, 30, 30));
      g.save(); g.translate(x, y); g.rotate(a); hbHeartPath(g, 0, -4, 52, 0.7); const gr = g.createRadialGradient(-6, -10, 2, 0, 0, 40); gr.addColorStop(0, hbHsl(4, 90, 56)); gr.addColorStop(1, hbHsl(0, 92, 34)); g.fillStyle = gr; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(80,0,0,0.5)'; g.stroke();
      g.fillStyle = hbHsl(52, 95, 74); g.beginPath(); g.ellipse(0, 2, 3, 14, 0, 0, TAU); g.fill(); g.restore();
    }
  });
}

/* ---------- Atlas B : le jardin tempéré ---------- */
function herbierDrawB(g, R) {
  // arbres : rameaux feuillus (une carte = un rameau ; la couronne en réunit des centaines, orientés vers l'extérieur)
  const lf = (hue, sat, l0, l1, len, wid, bulge, tipk) => (g2, x, y, a, sz, k) => hbLeaf(g2, x, y, a, len * sz / 44, wid * sz / 44, hbHsl(hue + (R() - 0.5) * 16, sat, l0 + k * l1 + R() * 5), hbHsl(hue + 10, sat + 4, l0 * 0.55 + k * l1 * 0.4), { vein: 0.4, nerv: 3, bulge, tipk, edge: 0.6 });
  hbCell(g, 'oak', (W, H) => hbSpray(g, W, H, R, { size: 46, leaf: lf(96, 46, 15, 22, 44, 17, 0.5, 0.3), step: 34 }));
  hbCell(g, 'linden', (W, H) => hbSpray(g, W, H, R, { size: 42, leaf: lf(80, 52, 19, 22, 38, 17, 0.4, 0.7), step: 28 }));
  hbCell(g, 'maple', (W, H) => hbSpray(g, W, H, R, { size: 58, leaf: (g2, x, y, a, sz, k) => hbMaple(g2, x, y, sz * 0.62, a, hbHsl(6 + R() * 22 - k * 4, 80, 34 + k * 18 + R() * 6), hbHsl(350 + R() * 12, 72, 16 + k * 10)), step: 34 }));
  hbCell(g, 'ginkgo', (W, H) => hbSpray(g, W, H, R, { size: 48, leaf: (g2, x, y, a, sz, k) => {
    g2.save(); g2.translate(x, y); g2.rotate(a); const r = sz * 0.5;
    const gr = g2.createRadialGradient(0, -r * 0.6, 0, 0, -r * 0.6, r * 1.2); gr.addColorStop(0, hbHsl(50 + R() * 6, 92, 44 + k * 14)); gr.addColorStop(1, hbHsl(40, 88, 30 + k * 8)); g2.fillStyle = gr;
    g2.beginPath(); g2.moveTo(0, 0); g2.lineTo(-r * 0.95, -r * 1.05); g2.quadraticCurveTo(-r * 0.4, -r * 1.45, 0, -r * 1.12); g2.quadraticCurveTo(r * 0.4, -r * 1.45, r * 0.95, -r * 1.05); g2.closePath(); g2.fill();
    g2.lineWidth = 0.7; g2.strokeStyle = 'rgba(90,60,0,0.4)'; g2.stroke(); g2.restore();
  }, step: 30 }));
  // cerisier : rameaux couverts de fleurs
  const cherry = (name, c0, c1, ctr) => hbCell(g, name, (W, H) => hbSpray(g, W, H, R, { size: 34, sub: 2, step: 26, twig: hbHsl(18, 30, 15), leaf: (g2, x, y, a, sz, k) => {
    for (let i = 0; i < 4; i++) hbFlower(g2, x + (R() - 0.5) * 26, y + (R() - 0.5) * 26, 9 + R() * 4, 5, [c0, c1], ctr, { rot: R() * TAU, wid: 0.42, cr: 0.17 });
    if (R() < 0.5) hbLeaf(g2, x, y, a, 20, 7, hbHsl(86 + R() * 14, 46, 28 + R() * 8), hbHsl(98, 48, 16), { vein: 0.3, nerv: 2, edge: 0.5 });
  } }));
  cherry('cherry', hbHsl(350, 78, 82), hbHsl(348, 74, 62), hbHsl(345, 85, 38));
  cherry('cherryW', hbHsl(352, 50, 84), hbHsl(350, 56, 72), hbHsl(345, 75, 42));
  // cèdre : étages de rameaux plats aux aiguilles sombres
  hbCell(g, 'cedar', (W, H) => {
    for (let t = 0; t < 5; t++) {
      const y = 70 + t * 92, L = 232 - t * 8;
      g.strokeStyle = hbHsl(24, 30, 14); g.lineWidth = 6; g.beginPath(); g.moveTo(14, y + 26); g.quadraticCurveTo(256, y - 26, W - 14, y + 26); g.stroke();
      for (let i = 0; i < 70; i++) {
        const u = R(), x = 256 + (u - 0.5) * 2 * L, yy = y + 26 - Math.sin(u * Math.PI) * 52, a = (R() < 0.5 ? -1 : 1) * (0.9 + R() * 0.5);
        for (let k = 0; k < 9; k++) { const kk = k / 8; g.strokeStyle = hbHsl(150 + R() * 14, 42, 17 + R() * 13 + (1 - kk) * 4); g.lineWidth = 3.2 - kk * 1.4; g.beginPath(); g.moveTo(x + Math.sin(a) * kk * 34, yy + kk * 44 * Math.cos(a) * 0.4); g.lineTo(x + Math.sin(a) * (kk * 34 + 8), yy + kk * 44 * Math.cos(a) * 0.4 + 12); g.stroke(); }
      }
    }
  });
  // saule pleureur : brins pendants garnis de petites feuilles
  hbCell(g, 'willow', (W, H) => {
    for (let k = 0; k < 24; k++) {
      const x0 = 14 + k * 20 + (R() - 0.5) * 12, L = 240 + R() * 250, ph = R() * TAU;
      const X = (y) => x0 + Math.sin(y * 0.018 + ph) * 8; g.strokeStyle = hbHsl(70, 35, 28); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, 0); for (let y = 4; y <= L; y += 6) g.lineTo(X(y), y); g.stroke();
      for (let y = 18; y < L; y += 8 + R() * 6) { const s = R() < 0.5 ? -1 : 1; hbLeaf(g, X(y), y, 3.14 + s * (0.6 + R() * 0.5), 20 + R() * 8, 4.6, hbHsl(76 + R() * 22, 58, 36 + R() * 16), hbHsl(90, 56, 22), { vein: 0, nerv: 0, tipk: 0.9, edge: 0.4 }); }
    }
  });
  hbCell(g, 'bamboo', (W, H) => {
    for (let k = 0; k < 70; k++) {
      const x = 30 + R() * 450, y = 30 + R() * 450, a = (R() - 0.5) * 2.4 + 3.14;
      hbStem(g, [[x - Math.sin(a) * 26, y + Math.cos(a) * 26], [x, y]], 1.4, hbHsl(80, 30, 30));
      for (let j = 0; j < 5; j++) { const b = a + (j - 2) * 0.36 + (R() - 0.5) * 0.2; hbLeaf(g, x, y, b, 62 + R() * 22, 6.5, hbHsl(84 + R() * 16, 52, 28 + R() * 10), hbHsl(98, 54, 15), { vein: 0.55, nerv: 0, bulge: 0.45, tipk: 0.9, edge: 0.4 }); }
    }
  });
  // hortensias : grosses boules de fleurettes sur leurs grandes feuilles
  for (const [nm, hue, s, l] of [['hydB', 224, 62, 58], ['hydP', 330, 62, 74], ['hydW', 90, 22, 84], ['hydV', 275, 50, 62]]) {
    hbCell(g, nm, (W, H) => {
      for (const [x, a, L] of [[70, -1.1, 80], [186, 1.1, 80], [100, -0.6, 96], [156, 0.6, 96], [128, 0, 90]]) hbLeaf(g, 128 + (x - 128) * 0.3, H - 4, a, L, 34, hbHsl(112, 50, 32), hbHsl(124, 54, 16), { vein: 0.5, nerv: 5, bulge: 0.5, tipk: 0.3 });
      for (const [x, y, r] of [[128, 100, 56], [78, 146, 38], [180, 138, 40]]) {
        hbStem(g, [[128, H - 12], [x, y + r * 0.6]], 3.4, hbHsl(100, 28, 30));
        for (let i = 0; i < 90; i++) { const aa = R() * TAU, d = Math.sqrt(R()) * r, fx = x + Math.cos(aa) * d, fy = y + Math.sin(aa) * d * 0.9, k = clamp(0.5 - (fy - y) / (2 * r) + R() * 0.2, 0, 1); hbFlower(g, fx, fy, 8 + R() * 3, 4, [hbHsl(hue + (R() - 0.5) * 16, s, l + k * 14 - 8), hbHsl(hue, s, l - 8 + k * 8)], hbHsl(60, 40, 80), { rot: R() * TAU, wid: 0.5, cr: 0.15 }); }
      }
    });
  }
  const roses = (nm, c0, c1) => hbCell(g, nm, (W, H) => {
    for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4 + (R() - 0.5) * 0.3; hbStem(g, [[128, H - 4], [128 + Math.sin(a) * 40, H - 70], [128 + Math.sin(a) * 90, H - 40 - Math.cos(a) * 130]], 2.4, hbHsl(100, 32, 22)); }
    hbMass(g, 128, 135, 110, 100, 55, R, (g2, x, y, k) => hbLeaf(g2, x, y, R() * TAU, 34, 13, hbHsl(120 + R() * 10, 48, 20 + k * 14), hbHsl(130, 52, 11), { vein: 0.3, nerv: 3, edgeCol: 'rgba(0,15,0,0.4)' }));
    for (const [x, y, r] of [[78, 150, 22], [128, 70, 26], [180, 118, 24], [110, 118, 24], [160, 168, 20], [64, 100, 18], [196, 66, 17]]) {
      g.fillStyle = c1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      for (let k = 0; k < 4; k++) { const rr = r * (1 - k * 0.22); const gr = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.arc(x + (R() - 0.5) * 3, y + (R() - 0.5) * 3, rr * 0.92, k * 0.7, k * 0.7 + 5.3); g.lineTo(x, y); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.8; g.stroke(); }
    }
  });
  roses('roseR', hbHsl(354, 84, 48), hbHsl(352, 88, 26)); roses('roseP', hbHsl(335, 72, 74), hbHsl(338, 70, 52)); roses('roseW', hbHsl(50, 32, 88), hbHsl(46, 42, 74)); roses('roseY', hbHsl(50, 96, 62), hbHsl(40, 92, 46));
  const tulips = (nm, cols) => hbCell(g, nm, (W, H) => {
    for (let i = 0; i < 4; i++) hbLeaf(g, 128 + (i - 1.5) * 18, H - 4, (i - 1.5) * 0.35, 150 + R() * 30, 15, hbHsl(106, 52, 40), hbHsl(114, 56, 22), { vein: 0.3, nerv: 0, bulge: 0.5, tipk: 0.7 });
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 28 + (R() - 0.5) * 10, h = 110 + R() * 70, c = cols[i % cols.length];
      hbStem(g, [[128 + (x - 128) * 0.35, H - 8], [x, H - 8 - h]], 3, hbHsl(104, 46, 32));
      g.save(); g.translate(x, H - 8 - h); g.beginPath(); g.moveTo(-11, 2); g.quadraticCurveTo(-14, -26, -4, -34); g.lineTo(0, -22); g.lineTo(4, -34); g.quadraticCurveTo(14, -26, 11, 2); g.quadraticCurveTo(0, 12, -11, 2);
      const gr = g.createLinearGradient(-12, 0, 12, 0); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke(); g.restore();
    }
  });
  tulips('tulipR', [[hbHsl(2, 90, 52), hbHsl(0, 90, 34)], [hbHsl(50, 96, 58), hbHsl(40, 94, 44)], [hbHsl(18, 96, 54), hbHsl(8, 92, 40)]]);
  tulips('tulipP', [[hbHsl(330, 70, 74), hbHsl(336, 72, 56)], [hbHsl(50, 30, 98), hbHsl(46, 40, 84)], [hbHsl(290, 60, 62), hbHsl(280, 62, 42)]]);
  hbCell(g, 'lavender', (W, H) => {
    for (let i = 0; i < 26; i++) {
      const x0 = 128 + (R() - 0.5) * 60, a = (R() - 0.5) * 1.1, L = 130 + R() * 90, tx = x0 + Math.sin(a) * L, ty = H - 6 - Math.cos(a) * L;
      hbLeaf(g, x0, H - 6, a * 1.4, 70, 5, hbHsl(110, 24, 40), hbHsl(120, 26, 24), { vein: 0, nerv: 0 });
      hbStem(g, [[x0, H - 6], [x0 + Math.sin(a) * L * 0.5, H - 6 - Math.cos(a) * L * 0.5], [tx, ty]], 1.8, hbHsl(100, 22, 38));
      for (let j = 0; j < 12; j++) { const t = j / 11, x = tx + Math.sin(a) * -j * 3, y = ty + Math.cos(a) * j * 3; g.fillStyle = hbHsl(262 + R() * 20, 56, 52 + R() * 14 - t * 8); g.beginPath(); g.ellipse(x + (R() - 0.5) * 3, y, 3.6, 2.6, a, 0, TAU); g.fill(); }
    }
  });
  hbCell(g, 'agapanthus', (W, H) => {
    for (let i = 0; i < 6; i++) hbLeaf(g, 128, H - 4, (i / 5 - 0.5) * 1.8, 120 + R() * 30, 12, hbHsl(112, 50, 36), hbHsl(120, 54, 20), { vein: 0.3, nerv: 0, tipk: 0.8 });
    for (const [x, h] of [[88, 170], [128, 210], [168, 160], [108, 130]]) {
      hbStem(g, [[128, H - 8], [x, H - 8 - h]], 3.4, hbHsl(100, 36, 30));
      for (let j = 0; j < 20; j++) { const a = R() * TAU, d = Math.sqrt(R()) * 34; hbFlower(g, x + Math.cos(a) * d, H - 8 - h + Math.sin(a) * d * 0.8, 9, 5, [hbHsl(222, 70, 62), hbHsl(230, 74, 44)], null, { rot: R() * TAU, wid: 0.34 }); }
    }
  });
  // prairie fleurie : herbes, pâquerettes, coquelicots, bleuets, boutons d'or
  hbCell(g, 'meadow', (W, H) => {
    for (let i = 0; i < 70; i++) { const x = R() * W, h = 40 + R() * 90, a = (R() - 0.5) * 0.5; hbStem(g, [[x, H - 2], [x + Math.sin(a) * h * 0.4, H - h * 0.6], [x + Math.sin(a) * h, H - h]], 2.2, hbHsl(84 + R() * 30, 52, 28 + R() * 22)); }
    const F = [[hbHsl(0, 0, 99), hbHsl(55, 30, 90), hbHsl(48, 95, 55), 9, 12], [hbHsl(4, 92, 50), hbHsl(0, 90, 36), hbHsl(0, 0, 10), 4, 15], [hbHsl(222, 76, 60), hbHsl(230, 78, 44), hbHsl(270, 60, 30), 8, 9], [hbHsl(52, 98, 58), hbHsl(44, 96, 46), hbHsl(40, 90, 40), 5, 9], [hbHsl(330, 80, 70), hbHsl(336, 76, 54), hbHsl(48, 90, 50), 5, 10]];
    for (let i = 0; i < 36; i++) { const f = F[i % F.length], x = 20 + R() * (W - 40), h = 60 + R() * 120; hbStem(g, [[x + (R() - 0.5) * 20, H - 2], [x, H - h]], 2, hbHsl(100, 40, 30)); hbFlower(g, x, H - h, f[4] * (1 + R() * 0.5), f[3], [f[0], f[1]], f[2], { rot: R() * TAU, wid: f[3] > 5 ? 0.22 : 0.4 }); }
  });
  hbCell(g, 'grass', (W, H) => {
    for (let i = 0; i < 70; i++) { const x = 128 + (R() - 0.5) * 90, h = 70 + R() * 130, a = (R() - 0.5) * 1.2; const ex = x + Math.sin(a) * h * 0.55, ey = H - 4 - Math.cos(a) * h; hbStem(g, [[x, H - 2], [x + Math.sin(a) * h * 0.2, H - h * 0.55], [ex, ey]], 2 + R() * 2.4, hbHsl(86 + R() * 24, 56, 26 + R() * 24)); }
  });
  hbCell(g, 'grassT', (W, H) => {
    for (let i = 0; i < 40; i++) { const x = 128 + (R() - 0.5) * 80, h = 130 + R() * 100, a = (R() - 0.5) * 0.9; const ex = x + Math.sin(a) * h * 0.5, ey = H - 4 - Math.cos(a) * h; hbStem(g, [[x, H - 2], [x + Math.sin(a) * h * 0.2, H - h * 0.55], [ex, ey]], 2 + R() * 1.6, hbHsl(70 + R() * 24, 46, 34 + R() * 22));
      if (R() < 0.35) for (let k = 0; k < 9; k++) hbStem(g, [[ex, ey + k * 4], [ex + 4 + R() * 3, ey + k * 4 - 6]], 1.2, hbHsl(46, 50, 56 + R() * 12)); }
  });
  hbCell(g, 'reed', (W, H) => {
    for (let i = 0; i < 18; i++) { const x = 128 + (R() - 0.5) * 80, h = 330 + R() * 160, a = (R() - 0.5) * 0.35; const ex = x + Math.sin(a) * h * 0.6, ey = H - 4 - Math.cos(a) * h; hbStem(g, [[x, H - 2], [x + Math.sin(a) * h * 0.3, H - h * 0.5], [ex, ey]], 3 + R() * 2, hbHsl(86 + R() * 14, 46, 32 + R() * 14)); }
    for (let i = 0; i < 5; i++) { const x = 128 + (R() - 0.5) * 70, h = 250 + R() * 200, a = (R() - 0.5) * 0.25; const ex = x + Math.sin(a) * h * 0.6, ey = H - 4 - Math.cos(a) * h; hbStem(g, [[x, H - 2], [ex, ey]], 3, hbHsl(86, 40, 36)); g.fillStyle = hbHsl(24, 62, 24); g.beginPath(); g.roundRect ? g.roundRect(ex - 6, ey - 30, 12, 42, 5) : g.rect(ex - 6, ey - 30, 12, 42); g.fill(); hbStem(g, [[ex, ey - 30], [ex, ey - 52]], 2, hbHsl(40, 40, 36)); }
  });
  hbCell(g, 'iris', (W, H) => {
    for (let i = 0; i < 7; i++) hbLeaf(g, 128 + (i - 3) * 8, H - 4, (i - 3) * 0.22, 140 + R() * 40, 11, hbHsl(106, 50, 38), hbHsl(114, 54, 20), { vein: 0.3, nerv: 0, tipk: 0.9 });
    for (const [x, h, c0, c1, c2] of [[100, 150, hbHsl(268, 66, 52), hbHsl(274, 70, 30), hbHsl(48, 95, 55)], [156, 120, hbHsl(52, 96, 60), hbHsl(44, 94, 44), hbHsl(30, 90, 40)], [128, 190, hbHsl(262, 62, 56), hbHsl(270, 68, 32), hbHsl(48, 95, 55)]]) {
      hbStem(g, [[128, H - 8], [x, H - 8 - h]], 3, hbHsl(100, 34, 30));
      const y = H - 8 - h; for (const s of [-1, 1]) { g.fillStyle = c1; g.beginPath(); g.ellipse(x + s * 18, y + 14, 14, 20, s * 0.9, 0, TAU); g.fill(); g.fillStyle = c0; g.beginPath(); g.ellipse(x + s * 16, y + 12, 11, 17, s * 0.9, 0, TAU); g.fill(); }
      g.fillStyle = c0; g.beginPath(); g.ellipse(x, y - 12, 12, 22, 0, 0, TAU); g.fill(); g.fillStyle = c2; g.beginPath(); g.ellipse(x, y + 12, 4, 10, 0, 0, TAU); g.fill();
    }
  });
  hbCell(g, 'wisteria', (W, H) => {
    for (let k = 0; k < 3; k++) {
      const x0 = 56 + k * 70, L = 300 + R() * 190;
      g.strokeStyle = hbHsl(80, 30, 26); g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, 0); for (let y = 4; y < L; y += 6) g.lineTo(x0 + Math.sin(y * 0.02 + k * 2) * 6, y); g.stroke();
      for (let y = 20; y < L; y += 6) { const w = 14 * Math.sin(Math.PI * Math.min(1, y / L * 1.02)) + 3, x = x0 + Math.sin(y * 0.02 + k * 2) * 6; for (let j = 0; j < 3; j++) { g.fillStyle = hbHsl(262 + R() * 26, 58, 56 + R() * 22, 0.96); g.beginPath(); g.ellipse(x + (R() - 0.5) * w * 2, y + R() * 4, 4.4, 3.4, R() * 3, 0, TAU); g.fill(); } }
    }
    for (let k = 0; k < 16; k++) hbLeaf(g, 20 + R() * 200, R() * 120, R() * TAU, 34, 9, hbHsl(100 + R() * 14, 48, 34), hbHsl(112, 52, 18), { vein: 0.3, nerv: 2 });
  });
  hbCell(g, 'ivy', (W, H) => {
    for (let k = 0; k < 3; k++) {
      const x0 = 50 + k * 64, L = 360 + R() * 140;
      g.strokeStyle = hbHsl(60, 30, 24); g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0, 0); for (let y = 4; y < L; y += 6) g.lineTo(x0 + Math.sin(y * 0.03 + k) * 8, y); g.stroke();
      for (let y = 10; y < L; y += 9 + R() * 6) { const s = R() < 0.5 ? -1 : 1, x = x0 + Math.sin(y * 0.03 + k) * 8, r = 14 + R() * 6; g.save(); g.translate(x, y); g.rotate(s * (0.7 + R() * 0.9) + 3.14);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-r, -r * 0.4); g.lineTo(-r * 0.5, -r * 0.9); g.lineTo(0, -r * 1.6); g.lineTo(r * 0.5, -r * 0.9); g.lineTo(r, -r * 0.4); g.closePath(); const gr = g.createLinearGradient(-r, 0, r, 0); gr.addColorStop(0, hbHsl(110 + R() * 20, 52, 28 + R() * 10)); gr.addColorStop(1, hbHsl(122, 56, 14)); g.fillStyle = gr; g.fill(); g.lineWidth = 0.7; g.strokeStyle = 'rgba(200,255,200,0.3)'; g.stroke(); g.restore(); }
    }
  });
  hbCell(g, 'dahlia', (W, H) => {
    for (let i = 0; i < 5; i++) hbLeaf(g, 128, H - 4, (i / 4 - 0.5) * 2, 100, 22, hbHsl(120, 48, 28), hbHsl(130, 52, 14), { nerv: 4, bulge: 0.5, vein: 0.3 });
    for (const [x, y, r, h] of [[90, 100, 36, 24], [168, 130, 32, 8], [124, 60, 30, 48]]) { hbStem(g, [[128, H - 10], [x, y + r]], 3, hbHsl(100, 30, 28)); for (const [n, k] of [[16, 1], [12, 0.74], [9, 0.5]]) hbFlower(g, x, y, r * k, n, [hbHsl(h, 92, 52 + (1 - k) * 18), hbHsl(h - 8, 90, 34)], null, { rot: k, wid: 0.2 }); g.fillStyle = hbHsl(h + 20, 100, 60); g.beginPath(); g.arc(x, y, r * 0.1, 0, TAU); g.fill(); }
  });
  hbCell(g, 'azalea', (W, H) => {
    hbMass(g, 128, 150, 112, 96, 60, R, (g2, x, y, k) => hbLeaf(g2, x, y, R() * TAU, 30, 10, hbHsl(120, 44, 22 + k * 14), hbHsl(130, 48, 12), { vein: 0.3, nerv: 2 }));
    hbMass(g, 128, 140, 110, 92, 70, R, (g2, x, y) => hbFlower(g2, x, y, 12 + R() * 6, 5, [hbHsl(326, 86, 62), hbHsl(332, 90, 44)], hbHsl(48, 90, 60), { rot: R() * TAU, wid: 0.46, cr: 0.13 }));
  });
  hbCell(g, 'hosta', (W, H) => {
    for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4 + (R() - 0.5) * 0.2, L = 120 + R() * 70; hbLeaf(g, 128 + a * 20, H - 4, a, L, 40 + R() * 10, hbHsl(112 + R() * 20, 44, 40), hbHsl(130, 50, 22), { vein: 0.9, nerv: 7, bulge: 0.4, tipk: 0.4, veinCol: 'rgba(230,255,220,0.5)', veinCol2: 'rgba(230,255,220,0.3)' }); }
  });
  hbCell(g, 'clover', (W, H) => {
    for (let i = 0; i < 40; i++) { const x = 20 + R() * 216, y = H - 20 - R() * 150; hbStem(g, [[128 + (x - 128) * 0.4, H - 2], [x, y + 12]], 1.4, hbHsl(100, 36, 30)); for (let k = 0; k < 3; k++) { g.fillStyle = hbHsl(110 + R() * 20, 50, 32 + R() * 12); g.beginPath(); g.ellipse(x + Math.cos(k * 2.09 - 1.57) * 7, y + Math.sin(k * 2.09 - 1.57) * 7, 7, 6, 0, 0, TAU); g.fill(); } if (R() < 0.3) { g.fillStyle = hbHsl(0, 0, 98); g.beginPath(); g.arc(x, y - 16, 5, 0, TAU); g.fill(); } }
  });
  hbCell(g, 'lilac', (W, H) => {
    hbMass(g, 128, 150, 112, 98, 50, R, (g2, x, y, k) => hbLeaf(g2, x, y, R() * TAU, 38, 16, hbHsl(112, 44, 24 + k * 14), hbHsl(124, 48, 12), { vein: 0.3, nerv: 3, tipk: 0.6 }));
    for (let i = 0; i < 6; i++) { const x = 40 + i * 34 + (R() - 0.5) * 14, y = 60 + R() * 70; for (let j = 0; j < 56; j++) { const a = R() * TAU, d = Math.sqrt(R()), fx = x + Math.cos(a) * 14 * d, fy = y + (R() * 90) * 0.6 + Math.sin(a) * 6; g.fillStyle = hbHsl(282 + R() * 22, 50, 62 + R() * 22); g.beginPath(); g.arc(fx, fy, 3.2, 0, TAU); g.fill(); } }
  });
  hbCell(g, 'peony', (W, H) => {
    for (let i = 0; i < 6; i++) hbLeaf(g, 128, H - 4, (i / 5 - 0.5) * 2.2, 90, 24, hbHsl(120, 42, 26), hbHsl(130, 46, 13), { nerv: 4, bulge: 0.5, vein: 0.3 });
    for (const [x, y, r] of [[96, 110, 38], [166, 90, 34], [130, 160, 30]]) { hbStem(g, [[128, H - 10], [x, y + r * 0.8]], 3, hbHsl(100, 30, 26)); for (const [n, k] of [[11, 1], [9, 0.78], [7, 0.55], [5, 0.34]]) hbFlower(g, x, y, r * k, n, [hbHsl(338, 68, 84 - (1 - k) * 8), hbHsl(342, 76, 58)], null, { rot: k * 2, wid: 0.44, edge: 'rgba(120,20,60,0.2)' }); g.fillStyle = hbHsl(48, 95, 58); g.beginPath(); g.arc(x, y, r * 0.09, 0, TAU); g.fill(); }
  });
}
/* Atlas dessiné : toile 2048 x 2048 ; which = 'A' ou 'B' */
function herbierCanvas(which) {
  const c = document.createElement('canvas'); c.width = c.height = 2048; const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (which === 'A') herbierDrawA(g, rngOf(5151)); else herbierDrawB(g, rngOf(6262));
  return c;
}
function herbierTex(which) {
  const t = canvasOnce(new THREE.CanvasTexture(herbierCanvas(which))); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
