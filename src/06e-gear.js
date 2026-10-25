/* ==========================================================================
   ATLAS DES TENUES : une texture couleur, une texture de relief et une texture rugosité / métal
   communes aux soldats et aux bras de la vue subjective. Chaque zone de l'atlas a un rôle :
     camouflage (raccordable dans les deux sens, à l'échelle réelle du tissu), tissu de gant, sangles
     MOLLE, visage, caoutchouc ; et une colonne de tuiles unies qui ne portent que la rugosité et le
     métal d'une matière (la couleur vient alors des couleurs de sommets).
   Une texture couleur par tenue (SKINS, 06ga-tenues.js) : seul le camouflage change d'une tenue à l'autre. Le relief
   et la rugosité sont communs. Le canal rouge de la texture rugosité / métal, inutilisé par three.js, marque la tuile
   « tag » (bandes de reconnaissance) : la retouche de la matière y met la couleur allié ou ennemi (skinTagPatch) ; à mi-valeur,
   il marque la tuile « glow » (néons des tenues de défi), qui éclaire de sa couleur de sommet.
   La zone « art » (sous les tuiles) porte l'emblème propre à une tenue (cape, pans de veste : SKINS.<id>.art).
   Tout est généré au chargement, sans image externe. Un maillage d'un seul appel de rendu peut ainsi
   mêler toile, nylon, polymère, caoutchouc, métal, peau et verres.
   ========================================================================== */
const ATLAS_N = 1024;
/* zones [x, y, largeur, hauteur] en pixels de la toile (y vers le bas) */
const ATLAS_R = { camo: [0, 0, 768, 768], glove: [0, 768, 256, 128], leath: [0, 896, 256, 128], web: [256, 768, 256, 256], face: [512, 768, 256, 256], misc: [768, 768, 256, 256], art: [768, 384, 256, 384] };
/* tuiles unies : nom, rugosité, métal (4 colonnes de 64 px dans la bande x 768 à 1024) */
const GEAR_TILES = [
  ['fab', 0.94, 0], ['nyl', 0.78, 0], ['poly', 0.52, 0.04], ['rub', 0.88, 0],
  ['met', 0.34, 0.92], ['metD', 0.52, 0.7], ['skin', 0.56, 0], ['lens', 0.05, 0.55],
  ['leat', 0.62, 0], ['paint', 0.72, 0.03], ['gloss', 0.28, 0], ['hair', 0.9, 0],
  ['plate', 0.66, 0.02], ['brass', 0.28, 1], ['eye', 0.12, 0], ['lip', 0.42, 0],
  ['tag', 0.6, 0], ['glow', 0.45, 0],
];
const GEAR_TILE = {};
/* bruit de valeur centré (-0,5 à 0,5), périodique de période p (motifs raccordables) */
function noise2(seed) { const n = makeNoise(seed); return (x, y, p = 256) => n(x, y, p, p) - 0.5; }
GEAR_TILES.forEach(([n], i) => { GEAR_TILE[n] = [(768 + (i % 4) * 64 + 32) / ATLAS_N, 1 - (Math.floor(i / 4) * 64 + 32) / ATLAS_N]; });
/* coordonnées de texture dans une zone (s, t de 0 à 1, bordure de 3 px pour éviter les débords) */
function atlasUV(reg, s, t) {
  const r = ATLAS_R[reg];
  return [(r[0] + 3 + clamp(s, 0, 1) * (r[2] - 6)) / ATLAS_N, 1 - (r[1] + 3 + clamp(t, 0, 1) * (r[3] - 6)) / ATLAS_N];
}
/* Coordonnées de camouflage à l'échelle réelle : phys est la taille (m) de la zone ; s0, t0 décalent le patron. Une
   pièce plus grande que la zone est coupée par une couture, comme un vêtement cousu de plusieurs pans. */
function camoUV(x, y, phys, s0 = 0, t0 = 0) {
  const s = x / phys + s0, t = y / phys + t0;
  return atlasUV('camo', s - Math.floor(s), t - Math.floor(t));
}

/* Toile de dessin raccordable : chaque forme est tracée aussi de l'autre côté des bords */
function wrapShape(g, W, H, x, y, rad, fn) {
  for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
    if (x + dx + rad < 0 || x + dx - rad > W || y + dy + rad < 0 || y + dy - rad > H) continue;
    fn(x + dx, y + dy);
  }
}
/* Forme organique : contour à lobes (somme de sinusoïdes) et bord déchiqueté (bruit par sommet), étirée et tournée */
function camoShape(g, x, y, r, R, stretch, rot, rag = 0.25) {
  const n = 24, ph = [R() * TAU, R() * TAU, R() * TAU], am = [0.22 + R() * 0.2, 0.12 + R() * 0.1, 0.06 + R() * 0.05], pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, rr = r * (1 + am[0] * Math.sin(a * 2 + ph[0]) + am[1] * Math.sin(a * 3 + ph[1]) + am[2] * Math.sin(a * 5 + ph[2])) * (1 - rag * 0.5 + R() * rag);
    const lx = Math.cos(a) * rr * stretch, ly = Math.sin(a) * rr;
    pts.push([x + lx * c - ly * s, y + lx * s + ly * c]);
  }
  const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  g.beginPath(); let st = m(pts[n - 1], pts[0]); g.moveTo(st[0], st[1]);
  for (let k = 0; k < n; k++) { const e = m(pts[k], pts[(k + 1) % n]); g.quadraticCurveTo(pts[k][0], pts[k][1], e[0], e[1]); }
  g.closePath(); g.fill();
}
/* Branche : trait irrégulier surtout vertical, qui s'affine et se ramifie parfois */
function camoBranch(g, x, y, len, w, R, depth = 0) {
  let a = Math.PI / 2 + (R() - 0.5) * 0.9, px = x, py = y, d = 0;
  const step = Math.max(1.5, len / 9);
  g.lineCap = 'round'; g.lineJoin = 'round';
  while (d < len) {
    a += (R() - 0.5) * 0.7; const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
    g.lineWidth = Math.max(0.8, w * Math.pow(Math.sin(Math.PI * clamp((d + step * 0.5) / len, 0.05, 0.95)), 0.6) * (0.7 + R() * 0.5));
    g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    if (depth < 1 && R() < 0.14) camoBranch(g, nx, ny, len * 0.45, w * 0.6, R, depth + 1);
    px = nx; py = ny; d += step;
  }
}
/* Aplat anguleux (style « poly ») : polygone de 4 à 7 sommets aux angles vifs, étiré et tourné, comme une facette de modèle
   à faces planes */
function camoFacet(g, x, y, r, R, stretch, rot) {
  const n = 4 + Math.floor(R() * 4), c = Math.cos(rot), s = Math.sin(rot), a0 = R() * TAU;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const a = a0 + (k + (R() - 0.5) * 0.6) / n * TAU, rr = r * (0.55 + R() * 0.65), lx = Math.cos(a) * rr * stretch, ly = Math.sin(a) * rr;
    if (k) g.lineTo(x + lx * c - ly * s, y + lx * s + ly * c); else g.moveTo(x + lx * c - ly * s, y + lx * s + ly * c);
  }
  g.closePath(); g.fill();
}
/* Feuille pointue (style « leaf ») : deux arcs qui se rejoignent aux pointes, longueur len, largeur relative wr */
function camoLeaf(g, x, y, len, wr, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), h = len / 2, w = len * wr;
  const P = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c], A = P(-h, 0), B = P(h, 0), U = P(0, w), D = P(0, -w);
  g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(U[0], U[1], B[0], B[1]); g.quadraticCurveTo(D[0], D[1], A[0], A[1]); g.closePath(); g.fill();
}
/* Motif de camouflage de la tenue skin dans une toile de W px représentant phys mètres de tissu (ks : échelle du motif).
   Trois styles (SKINS[skin].camo.style) : « blot » (taches organiques et branches sombres, façon multicam), « poly » (aplats
   anguleux à facettes, celui des illustrations des tenues), « leaf » (feuilles pointues serrées, la toile d'une tenue ghillie). */
function drawCamo(g, skin, W, phys, ks = 1) {
  const S = SKINS[skin], P = S.camo, R = mulberry32(S.seed), pm = W / phys * ks, area = phys * phys / ks / ks;
  g.fillStyle = P.base; g.fillRect(0, 0, W, W);
  // nappes de fond aux bords très doux : dessinées en basse résolution puis agrandies (raccord conservé)
  const lo = document.createElement('canvas'), L = Math.max(16, Math.round(W / 8)); lo.width = lo.height = L;
  const gl = lo.getContext('2d'); gl.fillStyle = P.base; gl.fillRect(0, 0, L, L);
  const lpm = L / phys * ks;
  P.soft.forEach((col, i) => {
    gl.fillStyle = col;
    for (let k = 0, n = Math.round(area * 60); k < n; k++) { const x = R() * L, y = R() * L, r = (0.035 + R() * 0.05) * lpm; wrapShape(gl, L, L, x, y, r * 2.4, (a, b) => camoShape(gl, a, b, r, R, 0.8 + R() * 1.0, R() * TAU, 0.35)); }
  });
  const big = document.createElement('canvas'); big.width = big.height = W * 3;
  const gb = big.getContext('2d'); gb.imageSmoothingEnabled = true; gb.imageSmoothingQuality = 'high';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) gb.drawImage(lo, i * W, j * W, W, W);
  g.drawImage(big, W, W, W, W, 0, 0, W, W);
  if (P.style === 'poly') {
    // facettes : grandes puis moyennes, chaque couleur en aplats francs qui se chevauchent
    P.mid.forEach((col, i) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * (P.n ? P.n[i] : 40)); k < n; k++) { const x = R() * W, y = R() * W, r = (0.018 + R() * 0.038) * pm; wrapShape(g, W, W, x, y, r * 2.2, (a, b) => camoFacet(g, a, b, r, R, 1 + R() * 1.1, R() * TAU)); }
    });
    P.branch.forEach((col) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * 45); k < n; k++) { const x = R() * W, y = R() * W, r = (0.008 + R() * 0.016) * pm; wrapShape(g, W, W, x, y, r * 2.2, (a, b) => camoFacet(g, a, b, r, R, 1.2 + R() * 1.4, R() * TAU)); }
    });
  } else if (P.style === 'leaf') {
    // feuilles serrées, de toutes les couleurs de la palette, surtout tombantes
    [...P.mid, ...P.branch].forEach((col, i) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * (P.n ? P.n[i] || 260 : 260)); k < n; k++) { const x = R() * W, y = R() * W, len = (0.016 + R() * 0.03) * pm; wrapShape(g, W, W, x, y, len, (a, b) => camoLeaf(g, a, b, len, 0.18 + R() * 0.16, Math.PI / 2 + (R() - 0.5) * 1.6)); }
    });
  } else {
    // formes moyennes : organiques, étirées, bords déchiquetés
    P.mid.forEach((col, i) => {
      g.fillStyle = col; g.globalAlpha = 0.9;
      for (let k = 0, n = Math.round(area * [95, 70, 30][i]); k < n; k++) { const x = R() * W, y = R() * W, r = (0.009 + R() * 0.02) * pm; wrapShape(g, W, W, x, y, r * 3, (a, b) => camoShape(g, a, b, r, R, 1 + R() * 1.4, (R() - 0.5) * 1.2 + (R() < 0.5 ? Math.PI / 2 : 0))); }
    });
    g.globalAlpha = 1;
    // branches sombres (le trait caractéristique des motifs multicam)
    P.branch.forEach((col, i) => {
      g.strokeStyle = col;
      for (let k = 0, n = Math.round(area * [150, 90][i]); k < n; k++) { const x = R() * W, y = R() * W, len = (0.022 + R() * 0.05) * pm, w = (0.0022 + R() * 0.0035) * pm; wrapShape(g, W, W, x, y, len * 1.3, (a, b) => camoBranch(g, a, b, len, w, mulberry32((k + 1) * 7919 + i * 13))); }
    });
  }
  // entailles (tenues de défi : P.slash = { col, n, len, w, rot }) : longues facettes effilées en diagonale, d'une couleur vive
  if (P.slash) {
    const L = P.slash;
    L.col.forEach((col, i) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * L.n[i]); k < n; k++) {
        const x = R() * W, y = R() * W, len = (L.len[0] + R() * L.len[1]) * pm, w = (L.w[0] + R() * L.w[1]) * pm, rot = L.rot + (R() - 0.5) * 0.35, c = Math.cos(rot), sn = Math.sin(rot), sk = (R() - 0.5) * w * 1.5;
        wrapShape(g, W, W, x, y, len, (a, b2) => {
          // parallélogramme pointu : deux pointes au bout de la longueur, la largeur au milieu (décalée : une facette, pas une ellipse)
          const P4 = [[-len / 2, 0], [sk, -w / 2], [len / 2, 0], [-sk, w / 2]];
          g.beginPath(); P4.forEach(([lx, ly], j) => { const X = a + lx * c - ly * sn, Y = b2 + lx * sn + ly * c; if (j) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill();
        });
      }
    });
  }
  // rehauts clairs, rares et petits
  g.fillStyle = P.hi;
  for (let k = 0, n = Math.round(area * 120); k < n; k++) { const x = R() * W, y = R() * W, r = (0.002 + R() * 0.004) * pm; wrapShape(g, W, W, x, y, r * 3, (a, b) => camoShape(g, a, b, r, R, 1 + R(), R() * TAU, 0.5)); }
  // délavé : grain fin (petite toile de bruit répétée) et larges variations de teinte, en lumière douce
  const grain = document.createElement('canvas'); grain.width = grain.height = 128;
  const gg = grain.getContext('2d'), gi = gg.createImageData(128, 128), R2 = mulberry32(S.seed + 3);
  for (let i = 0; i < 128 * 128; i++) { const v = 128 + (R2() - 0.5) * 90; gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255; }
  gg.putImageData(gi, 0, 0);
  const wash = document.createElement('canvas'); wash.width = wash.height = 12;
  const gw = wash.getContext('2d'); for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const v = Math.round(128 + (R2() - 0.5) * 70); gw.fillStyle = `rgb(${v},${v},${v})`; gw.fillRect(x, y, 1, 1); }
  g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5;
  g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, W);
  g.globalAlpha = 0.45; g.imageSmoothingEnabled = true; g.drawImage(wash, 0, 0, W, W);
  g.restore();
}
/* Tête (zone face) en projection cylindrique : s fait le tour de la tête (0,5 devant, 0 et 1 derrière), t descend du
   sommet (0) au menton (1). Peau, barbe de quelques jours, sourcils, lèvres, cheveux ras sur le crâne et la nuque. */
function drawFace(g, x0, y0, S) {
  const R = mulberry32(71), im = g.getImageData(x0, y0, S, S), d = im.data, N = noise2(21);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S - 0.5, v = y / S, au = Math.abs(u);
    let r = 176, gg = 132, b = 101;
    // joues et nez plus rouges
    const cheek = Math.exp(-(((au - 0.085) / 0.04) ** 2 + ((v - 0.56) / 0.07) ** 2)), nose = Math.exp(-((u / 0.022) ** 2 + ((v - 0.56) / 0.07) ** 2));
    r += 18 * cheek + 14 * nose; gg -= 5 * cheek; b -= 5 * cheek;
    // barbe courte : mâchoire et moustache, bord irrégulier
    const nz = N(x / S * 14, y / S * 14) * 0.08;
    const jaw = smoothstep(0.64, 0.72, v + nz - au * 0.25) * (1 - smoothstep(0.22, 0.27, au + nz));
    const must = Math.exp(-((u / 0.05) ** 2 + ((v - 0.675) / 0.018) ** 2));
    const lips = Math.exp(-((u / 0.03) ** 2 + ((v - 0.715) / 0.014) ** 2));
    const beard = clamp(Math.max(jaw, must) * (0.6 + 0.4 * R()) * (1 - lips * 0.95), 0, 1);
    r = lerp(r, 58, beard * 0.85); gg = lerp(gg, 44, beard * 0.85); b = lerp(b, 34, beard * 0.85);
    r = lerp(r, 148, lips * 0.65); gg = lerp(gg, 88, lips * 0.65); b = lerp(b, 80, lips * 0.65);
    // sourcils
    const brow = Math.exp(-(((au - 0.045) / 0.026) ** 2 + ((v - 0.36 + au * 0.25) / 0.012) ** 2));
    r = lerp(r, 52, brow * 0.9); gg = lerp(gg, 40, brow * 0.9); b = lerp(b, 31, brow * 0.9);
    // cheveux ras : crâne, tempes et nuque
    const hair = Math.max(smoothstep(0.31, 0.27, v + nz * 0.5 - au * 0.08), smoothstep(0.17, 0.2, au + nz) * smoothstep(0.66, 0.6, v + nz) * smoothstep(0.26, 0.3, au + nz * 0.5 + (0.6 - v) * 0.15));
    r = lerp(r, 44, hair * 0.88); gg = lerp(gg, 34, hair * 0.88); b = lerp(b, 27, hair * 0.88);
    const n = N(x / S * 60, y / S * 60) * 14 + (R() - 0.5) * 6;
    d[i] = clamp(r + n, 0, 255); d[i + 1] = clamp(gg + n, 0, 255); d[i + 2] = clamp(b + n, 0, 255); d[i + 3] = 255;
  }
  g.putImageData(im, x0, y0);
}
/* Scans de tissu (Poly Haven, CC0 : tools/build_tenues.py), livrés dans le socle de la page (build.py) : une toile, un tricot et un
   cuir. Ils donnent aux zones toile, gant et cuir de l'atlas le relief et la rugosité d'un vrai tissu, et les nuances de sa teinte, à la
   place de la trame calculée (trop régulière : la lumière glissait dessus comme sur du plastique). Décodés au démarrage (gearScanLoad,
   attendu avant la préparation des soldats) ; absents (socle non chargé), l'atlas garde sa trame calculée. */
const GEAR_SCAN = { n: null, t: null }; // images décodées : tissus (normale en rouge et vert, rugosité en bleu) et teinte (luminance)
const GEAR_SCAN_K = { camo: 1.7, glove: 1.4, leath: 1.2 }; // force du relief scanné, par zone
const GEAR_SCAN_R = { camo: 0.7, glove: 0.6, leath: 1.1 }; // part des écarts de rugosité du scan reportée sur la zone
function gearScanLoad() {
  const S = window.SOCLE || {};
  if (!S.tissus || !S.teinte) return Promise.resolve();
  const img = (src) => { const im = new Image(); im.src = src; return im.decode().then(() => im); };
  return Promise.all([img(S.tissus), img(S.teinte)]).then(([n, t]) => { GEAR_SCAN.n = n; GEAR_SCAN.t = t; }).catch(() => {});
}
/* Une image du scan (k : son échelle, 1 pour tissus, 0,5 pour teinte) disposée comme l'atlas. La toile se répète un nombre entier
   de fois dans la zone du camouflage, pour se raccorder à ses bords comme le motif : une fois en vue subjective (34 cm de tissu pour un
   carreau de 27 cm), trois fois sur un soldat (70 cm). Le tricot et le cuir remplissent leur zone (14 et 20 cm de scan). */
function gearScanLayout(img, k, fp) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  const C = ATLAS_R.camo, n = fp ? 1 : 3, st = (C[2] - 6) / n;
  g.save(); g.beginPath(); g.rect(C[0], C[1], C[2], C[3]); g.clip();
  for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) g.drawImage(img, 0, 0, 512 * k, 512 * k, C[0] + 3 + i * st, C[1] + 3 + j * st, st, st);
  g.restore();
  const G = ATLAS_R.glove, L = ATLAS_R.leath;
  g.drawImage(img, 512 * k, 0, 256 * k, 256 * k, G[0], G[1], G[2], G[3]);
  g.drawImage(img, 512 * k, 256 * k, 256 * k, 256 * k, L[0], L[1], L[2], L[3]);
  return c;
}
/* Hauteurs (relief) de l'atlas, en unités arbitraires ; converties en normales ensuite. Avec les scans, la toile, le gant et le cuir
   ne gardent ici que leurs plis et le fil de renfort : la trame vient du scan (gearScanNormals) */
function gearHeights(fp) {
  const H = new Float32Array(ATLAS_N * ATLAS_N), N = noise2(3), N2 = noise2(8), sc = GEAR_SCAN.n ? 0 : 1;
  const put = (reg, fn) => { const r = ATLAS_R[reg]; for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) H[(r[1] + y) * ATLAS_N + r[0] + x] = fn(x, y, r[2], r[3]); };
  // camouflage : toile croisée, fil de renfort ripstop tous les 5 mm environ, froissé léger
  const phys = fp ? 0.34 : 0.7, pmm = 768 / (phys * 1000), rip = Math.max(3, Math.round(5 * pmm));
  put('camo', (x, y, W) => {
    const weave = Math.sin(x * 2.1) * Math.sin(y * 2.1) * 0.35 * sc;
    const grid = ((x % rip < 1.2 ? 0.5 : 0) + (y % rip < 1.2 ? 0.5 : 0)) * (sc ? 1 : 0.25); // avec le scan, à peine marqué : régulier, il faisait grillage
    const wr = N(x / W * 6, y / W * 6, 6) * 5 + N2(x / W * 13, y / W * 13, 13) * 1.8;
    return weave + grid + wr;
  });
  // gant : tricot fin et coutures
  put('glove', (x, y) => (Math.sin(x * 2.4 + Math.sin(y * 0.9) * 0.6) * 0.12 + Math.sin(y * 2.9) * 0.1 + N2(x / 5, y / 5) * 0.12) * sc + N(x / 14, y / 14) * 0.35);
  // synthétique : grain fin et quelques plis
  put('leath', (x, y) => N(x / 2.2, y / 2.2) * 0.35 * sc + N2(x / 9, y / 9) * 0.5 + Math.sin(x * 0.21 + N(x / 30, y / 30) * 3) * 0.12);
  // sangles MOLLE : bandes de 25 mm tous les 38 mm, piqûres, trame
  put('web', (x, y) => {
    const band = (y % 38) < 25 ? 1 : 0, edge = band && ((y % 38) < 2 || (y % 38) > 22) ? -0.4 : 0;
    const stitch = band && (x % 38 < 3) ? -0.8 : 0;
    return band * 1.2 + edge + stitch + Math.sin(x * 2.4) * 0.12 * band + Math.sin(y * 2.4) * 0.1;
  });
  // peau : pores et micro-relief
  put('face', (x, y, W) => N(x / W * 60, y / W * 60) * 0.5 + N2(x / W * 16, y / W * 16) * 0.7);
  // emblèmes (capes, pans) : toile croisée plus lâche et quelques froissures
  put('art', (x, y, W) => Math.sin(x * 1.9) * Math.sin(y * 1.9) * 0.3 + N(x / W * 5, y / W * 5, 5) * 3.5 + N2(x / W * 11, y / W * 11, 11) * 1.2);
  // caoutchouc : crampons en losanges (semelles, protège-phalanges)
  put('misc', (x, y) => ((Math.abs(((x + y) % 24) - 12) < 5) && (Math.abs(((x - y + 240) % 24) - 12) < 5) ? 1.4 : 0) + N(x / 30, y / 30) * 0.4);
  return H;
}
function heightsToNormals(H, k, fp) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d'), im = g.createImageData(ATLAS_N, ATLAS_N), d = im.data, n = ATLAS_N;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, hx = H[y * n + Math.min(n - 1, x + 1)] - H[y * n + Math.max(0, x - 1)], hy = H[Math.min(n - 1, y + 1) * n + x] - H[Math.max(0, y - 1) * n + x];
    const nx = -hx * k, ny = hy * k, l = hyp3(nx, ny, 1);
    d[i * 4] = (nx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  if (GEAR_SCAN.n) gearScanNormals(d, fp);
  g.putImageData(im, 0, 0);
  return c;
}
/* Relief du scan superposé à celui des plis (mélange « whiteout » : pentes additionnées, hauteurs multipliées), zones toile, gant et cuir */
function gearScanNormals(d, fp) {
  const S = gearScanLayout(GEAR_SCAN.n, 1, fp).getContext('2d').getImageData(0, 0, ATLAS_N, ATLAS_N).data;
  for (const reg in GEAR_SCAN_K) {
    const r = ATLAS_R[reg], k = GEAR_SCAN_K[reg];
    for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) {
      const i = (y * ATLAS_N + x) * 4, sx = S[i] / 127.5 - 1, sy = S[i + 1] / 127.5 - 1;
      const nx = d[i] / 127.5 - 1 + sx * k, ny = d[i + 1] / 127.5 - 1 + sy * k, nz = (d[i + 2] / 127.5 - 1) * Math.sqrt(Math.max(0.04, 1 - sx * sx - sy * sy));
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255;
    }
  }
}
/* Rugosité (vert) et métal (bleu) */
function gearRM() {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d', { willReadFrequently: true }), R = mulberry32(5); // toile en mémoire : relue pour la rugosité des scans
  const reg = (name, r, m) => { const a = ATLAS_R[name]; g.fillStyle = `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`; g.fillRect(a[0], a[1], a[2], a[3]); };
  reg('camo', 0.9, 0); reg('glove', 0.9, 0); reg('leath', 0.52, 0); reg('web', 0.84, 0); reg('face', 0.55, 0); reg('misc', 0.86, 0); reg('art', 0.88, 0);
  // rouge : masque des bandes de reconnaissance (1) et des néons (0,5), lu par skinTagPatch
  GEAR_TILES.forEach(([n, r, m], i) => { g.fillStyle = `rgb(${n === 'tag' ? 255 : n === 'glow' ? 128 : 0},${Math.round(r * 255)},${Math.round(m * 255)})`; g.fillRect(768 + (i % 4) * 64, Math.floor(i / 4) * 64, 64, 64); });
  // un peu de variation dans la toile (usure, zones lustrées)
  const a = ATLAS_R.camo; g.globalAlpha = 0.08;
  for (let i = 0; i < 400; i++) { g.fillStyle = R() < 0.5 ? '#00c000' : '#00ff00'; g.fillRect(a[0] + R() * a[2], a[1] + R() * a[3], 4 + R() * 30, 4 + R() * 30); }
  g.globalAlpha = 1;
  // rugosité du scan : ses écarts à sa moyenne, autour de la valeur de la zone (disposition des soldats, commune aux deux vues)
  if (GEAR_SCAN.n) {
    const S = gearScanLayout(GEAR_SCAN.n, 1, false).getContext('2d').getImageData(0, 0, ATLAS_N, ATLAS_N).data;
    const im = g.getImageData(0, 0, ATLAS_N, ATLAS_N), d = im.data;
    for (const reg in GEAR_SCAN_R) {
      const r = ATLAS_R[reg], k = GEAR_SCAN_R[reg];
      let m = 0; for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) m += S[(y * ATLAS_N + x) * 4 + 2];
      m /= r[2] * r[3];
      for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) { const i = (y * ATLAS_N + x) * 4; d[i + 1] = clamp(d[i + 1] + (S[i + 2] - m) * k, 0, 255); }
    }
    g.putImageData(im, 0, 0);
  }
  return c;
}
/* Couleur : camouflage de la tenue, zones claires modulées par les couleurs de sommets */
function gearAlbedo(skin, fp) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d', { willReadFrequently: true }); // toile en mémoire : lectures de pixels rapides
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, ATLAS_N, ATLAS_N);
  const cam = document.createElement('canvas'); cam.width = cam.height = 768;
  drawCamo(cam.getContext('2d', { willReadFrequently: true }), skin, 768, fp ? 0.34 : 0.7, fp ? 0.7 : 1);
  g.drawImage(cam, 0, 0);
  // tissu de gant : blanc légèrement tramé (la couleur du gant vient des sommets)
  const G = ATLAS_R.glove, R = mulberry32(12), LT = ATLAS_R.leath;
  g.fillStyle = 'rgb(222,222,222)'; g.fillRect(LT[0], LT[1], LT[2], LT[3]);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.05})`; g.fillRect(G[0] + R() * G[2], G[1] + R() * G[3], 1 + R() * 3, 1); g.fillRect(LT[0] + R() * LT[2], LT[1] + R() * LT[3], 1, 1); }
  // nuances du vrai tissu (fils plus ou moins teints, usure) : la luminance du scan en incrustation, neutre à mi-gris
  if (GEAR_SCAN.t) {
    const T = gearScanLayout(GEAR_SCAN.t, 0.5, fp);
    g.save(); g.globalCompositeOperation = 'overlay';
    for (const [reg, al] of [['camo', 0.45], ['glove', 0.6], ['leath', 0.6]]) { const r = ATLAS_R[reg]; g.globalAlpha = al; g.drawImage(T, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); }
    g.restore();
  }
  // sangles : bandes claires, jours sombres entre les bandes, piqûres
  const Wb = ATLAS_R.web;
  for (let y = 0; y < Wb[3]; y++) { const inb = (y % 38) < 25; g.fillStyle = inb ? 'rgb(236,236,236)' : 'rgb(150,150,150)'; g.fillRect(Wb[0], Wb[1] + y, Wb[2], 1); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < Wb[3]; y += 38) for (let x = 0; x < Wb[2]; x += 38) g.fillRect(Wb[0] + x, Wb[1] + y + 2, 3, 21);
  // visage dessiné sur sa propre petite toile (lire les pixels de la grande toile forcerait tout son rendu différé)
  const fc = document.createElement('canvas'); fc.width = fc.height = ATLAS_R.face[2];
  drawFace(fc.getContext('2d', { willReadFrequently: true }), 0, 0, ATLAS_R.face[2]); g.drawImage(fc, ATLAS_R.face[0], ATLAS_R.face[1]);
  // caoutchouc : gris neutre
  const M = ATLAS_R.misc; g.fillStyle = '#d8d8d8'; g.fillRect(M[0], M[1], M[2], M[3]);
  // emblème de la tenue (cape, pans), dessiné sur sa propre toile ; blanc sinon
  const A = ATLAS_R.art, art = SKINS[skin].art;
  if (art) { const ac = document.createElement('canvas'); ac.width = A[2]; ac.height = A[3]; art(ac.getContext('2d'), A[2], A[3], skin); g.drawImage(ac, A[0], A[1]); }
  return c;
}
const GEAR = { maps: {} };
const _gearTex = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
/* Textures d'une tenue (mises en cache) : fp = vue subjective (camouflage plus fin, au plus près de l'écran) */
function gearTextures(skin, fp) {
  const key = skin + (fp ? 'fp' : 'tp');
  if (GEAR.maps[key]) return GEAR.maps[key];
  const nk = fp ? 'nfp' : 'ntp';
  if (!GEAR[nk]) GEAR[nk] = _gearTex(heightsToNormals(gearHeights(fp), 1.2, fp), false);
  if (!GEAR.rm) GEAR.rm = _gearTex(gearRM(), false);
  return (GEAR.maps[key] = { map: _gearTex(gearAlbedo(skin, fp), true), normal: GEAR[nk], rm: GEAR.rm });
}
/* Texture couleur de la vue subjective d'une tenue qui n'est plus portée : libérée (une seule tenue à la fois dans les bras) */
function gearFreeFp(skin) { const T = GEAR.maps[skin + 'fp']; if (T) { T.map.dispose(); delete GEAR.maps[skin + 'fp']; } }
/* Bandes de reconnaissance : la tuile « tag » (canal rouge de la texture rugosité / métal à 1) prend la couleur uSkTag, allié ou
   ennemi, quelle que soit la teinte de la tenue ; uSkGlow lui ajoute une légère lumière propre. Néons des tenues de défi : la
   tuile « glow » (canal rouge à 0,5) éclaire de sa couleur de sommet (uSkNeon : intensité), allié comme ennemi (la couleur du
   sommet, pas la teinte de la matière). Aucune texture de plus. */
function skinTagPatch(s, U) {
  s.uniforms.uSkTag = U.tag; s.uniforms.uSkGlow = U.glow; s.uniforms.uSkNeon = U.neon;
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkTag; uniform float uSkGlow; uniform float uSkNeon;')
    .replace('#include <color_fragment>', '#include <color_fragment>\n  float skR = texture2D(roughnessMap, vUv).r, skTag = smoothstep(0.7, 0.9, skR), skNeon = smoothstep(0.3, 0.42, skR) - skTag;\n  diffuseColor.rgb = mix(diffuseColor.rgb, uSkTag, skTag);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uSkTag * skTag * uSkGlow + vColor * skNeon * uSkNeon;');
}
/* Matière d'une tenue : couleurs de sommets × atlas ; rugosité et métal lus dans l'atlas.
   mode : 'fp' bras de la vue subjective (scène à part, réglée globalement), 'tp' soldat dans le décor (éclairage cuit,
   bandes de reconnaissance), 'pv' aperçu des menus (bandes, sans volume d'éclairage : aucune carte n'est chargée) */
function gearMaterial(skin, mode) {
  const fp = mode === 'fp', T = gearTextures(skin, fp);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.map, normalMap: T.normal, normalScale: new THREE.Vector2(fp ? 0.65 : 0.36, fp ? 0.65 : 0.36), roughnessMap: T.rm, metalnessMap: T.rm, roughness: 1, metalness: 1, envMapIntensity: fp ? 0.9 : 0.7 });
  m.defines = { USE_SHEEN: '' };
  if (fp) { m.onBeforeCompile = (s) => { envCubeHook(s); gearSheenPatch(s); }; return m; }
  const U = (m.userData.skU = { tag: { value: new THREE.Color(1, 1, 1) }, glow: { value: 0 }, neon: { value: SKINS[skin].neon || 0 } });
  m.defines.SK_TAG = '';
  if (mode === 'pv') { m.userData.patch = (s) => { skAoPatch(s); skinTagPatch(s, U); gearSheenPatch(s); }; m.onBeforeCompile = m.userData.patch; return m; }
  volumeLit(m);
  const vl = m.userData.patch;
  m.userData.patch = (s) => { skAoPatch(s); vl(s); skinTagPatch(s, U); gearSheenPatch(s); };
  m.onBeforeCompile = m.userData.patch;
  return m;
}
/* Reflet propre au tissu (« sheen » de three.js : la lumière rasante accroche le duvet des fibres) : il éclaire doucement le bord des
   manches, des jambes et des épaules, ce qui fait lire une toile plutôt qu'un plastique mat. Seules les zones textiles le prennent :
   rugosité haute et pas de métal (toile, tricot, sangles, tuiles de tissu et de nylon ; ni le cuir, ni la peau, ni les verres, ni le
   métal). Teinté par la couleur du tissu. Aucune texture de plus, un seul programme pour toutes les tenues ; à l'abri du ciel, le volume
   d'éclairage cuit l'éteint comme le reste de la lumière indirecte (VL_AO, 02c-materials.js). */
/* Occlusion cuite des soldats (attribut aoc, soldierBakeAO dans 06g-body.js) : là où une pièce en couvre une autre, elle éteint la lumière
   indirecte et le reflet du tissu, et un peu le soleil (une ombre de quelques millimètres que les cartes d'ombre ne voient pas). Posée
   avant la retouche du volume d'éclairage cuit (volumeLit) : celle-ci garde l'inclusion de aomap_fragment en tête de son propre code, qui
   s'insère donc avant celui-ci. */
function skAoPatch(s) {
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aoc; varying float vSkAo;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSkAo = aoc;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSkAo;').replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
  float skAo = 1.0 - vSkAo * 0.85;
  reflectedLight.indirectDiffuse *= skAo; reflectedLight.indirectSpecular *= skAo;
  reflectedLight.directDiffuse *= 1.0 - vSkAo * 0.3;
#ifdef USE_SHEEN
  sheenSpecular *= skAo;
#endif
}`);
}
const GEAR_SHEEN = { color: { value: new THREE.Color(0.45, 0.45, 0.45) }, rough: { value: 0.55 } };
function gearSheenPatch(s) {
  s.uniforms.sheenColor = GEAR_SHEEN.color; s.uniforms.sheenRoughness = GEAR_SHEEN.rough;
  s.fragmentShader = s.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.sheenColor *= mix(diffuseColor.rgb, vec3(1.0), 0.15) * smoothstep(0.74, 0.86, roughnessFactor) * (1.0 - smoothstep(0.1, 0.3, metalnessFactor));');
}
