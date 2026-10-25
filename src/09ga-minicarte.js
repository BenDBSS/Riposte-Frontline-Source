/* ==========================================================================
   MINICARTE : LE PLAN
   Le fond de la mini-carte (HUD.mmStatic, dessiné une fois au chargement de la carte, voir drawMinimap dans 09-game.js pour ce qui bouge dessus) est un
   plan en gris, pas le relevé satellite : on lit d'un coup d'oeil où l'on passe (sol sombre) et ce qui arrête (objets clairs), sans texture ni ombre.
   Retour d'un joueur : « la minicarte en noir et blanc, simplifiée, lisible d'un coup d'oeil ». Le même plan, à plus grande échelle, est le fond de la
   carte de la frappe aérienne et de l'écran de la tablette (KS.plan, 08b-killstreaks.js) ; le relevé satellite (buildSatelliteMap) n'est plus affiché,
   mais son rendu reste au chargement : il fait aussi le balayage des programmes sur téléphone (voir « Version mobile »).
   La mini-carte est zoomée (MM_ZOOM) : on voit ce qui est proche (une trentaine de mètres autour du joueur), pas toute la carte.
   - Le sol de la zone de jeu est un gris sombre, le dehors presque noir. Îles flottantes : seules les îles ont un sol, liseré clair, le vide reste noir,
     les ponts sont tracés. Relief (dunes de Simoun) : teinte par hauteur, ombrage venu du haut à gauche, courbes de niveau tous les 2 m. Eau (mer,
     bassins) : bleu nuit à traits de vagues. Quadrillage de 10 m très discret (pas sur le vide).
   - Les objets viennent des boîtes de collision (COL), sans celles qui n'arrêtent que les tirs (ray) ni les murs invisibles du bord de l'eau (inv) ni
     les objets de moins de 0,5 m2 (cageots, poteaux : du bruit). Ce qui arrête un soldat (dessous à moins de 1,7 m du sol) a quatre étages selon la
     hauteur de son dessus : ras (marche, socle : pas dessiné), couvert bas (sous 1 m), couvert (sous 2,2 m), mur (sous 4,5 m), bâtiment. Du plus bas au
     plus haut, un contour sombre puis la teinte de l'étage : un objet haut se détache de ce qui l'entoure. Ce qui est au-dessus des têtes (toit, auvent,
     passerelle, étage) n'arrête personne : un aplat gris moyen posé sous les obstacles, pour que l'on voie à la fois qu'on y passe en dessous (une
     rue couverte, une salle) et où sont ses murs. Les rampes sont un dégradé de la teinte de leur départ à celle de leur arrivée.
   - Rien de coûteux : quelques centaines de rectangles dans une toile 2D (mmDensity px par mètre pour la mini-carte, TAC_S pour la frappe), une fois par
     carte ; le relief se calcule à 2 px par mètre (4 pour la frappe).
   ========================================================================== */
const MMPAL = {
  bg: '#08090a', ground: '#2c3136', rim: 'rgba(190,198,204,0.55)', edge: 'rgba(5,6,7,0.92)', grid: 'rgba(255,255,255,0.045)',
  water: '#0d1a25', wave: '#1d3446', ring: 'rgba(239,85,67,0.8)', roof: '#464d53',
  tiers: ['#4a5157', '#6f777d', '#a3aaae', '#d6dadb'],
};
/* Zoom de la mini-carte : unités de la toile (240) par mètre. 3,6 : 67 m de large, le joueur un peu sous le centre pour voir plus loin devant */
const MM_ZOOM = 3.6;
/* Pixels par mètre du fond : de quoi rester net à l'écran le plus dense (6 px par mètre à 2x), moins sur téléphone (pas de rééchantillonnage inutile) */
function mmDensity() { return COARSE ? 3.5 : 5; }
/* Étage d'un objet selon la hauteur de son dessus au-dessus du sol : -1 (ras, rien) à 3 (bâtiment) */
function mmTier(t) { return t < 0.3 ? -1 : t < 1 ? 0 : t < 2.2 ? 1 : t < 4.5 ? 2 : 3; }
function mmHeightColor(h) { return h < 0.3 ? MMPAL.ground : MMPAL.tiers[Math.min(2, mmTier(h))]; }

/* Le plan de la zone de jeu à S pixels par mètre, avec une marge de padX m sur les côtés et padZ m aux bouts ; grid : quadrillage de 10 m. Rend { c, X0, Z0 } (toile et
   coin haut gauche en mètres) */
function mapPlanPaint(S, padX, padZ, grid) {
  const X0 = MAP.x0 - padX, Z0 = MAP.z0 - padZ, W = Math.ceil((MAP.x1 + padX - X0) * S), H = Math.ceil((MAP.z1 + padZ - Z0) * S), RIM = 0.4 * S, EDGE = 0.33 * S;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tx = (x) => (x - X0) * S, tz = (z) => (z - Z0) * S;
  const rect = (x0, x1, z0, z1, e = 0) => g.fillRect(tx(x0) - e, tz(z0) - e, (x1 - x0) * S + 2 * e, (z1 - z0) * S + 2 * e);
  g.fillStyle = MMPAL.bg; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(tx(MAP.x0), tz(MAP.z0), (MAP.x1 - MAP.x0) * S, (MAP.z1 - MAP.z0) * S); g.clip(); // tout reste dans la zone de jeu
  // boîtes qui arrêtent un soldat, avec la hauteur de leur dessus et de leur dessous au-dessus du sol (le relief des dunes compte)
  const boxes = [];
  for (const b of COL) {
    if (b.ray || b.inv) continue;
    const gy = gy0((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    boxes.push({ b, t: b.y1 - gy, e: b.y0 - gy, a: (b.x1 - b.x0) * (b.z1 - b.z0) });
  }
  // sol
  if (VOID.on) {
    const isl = boxes.filter((o) => o.t > -1 && o.t < 1.9 && o.e < 0.5);
    g.fillStyle = MMPAL.rim; for (const o of isl) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1, RIM);
    g.fillStyle = MMPAL.ground; for (const o of isl) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1);
  } else {
    if (RELIEF.on) mmRelief(g, S, X0, Z0); else { g.fillStyle = MMPAL.ground; rect(MAP.x0, MAP.x1, MAP.z0, MAP.z1); }
    if (grid) {
      g.strokeStyle = MMPAL.grid; g.lineWidth = 1; g.beginPath();
      for (let x = Math.ceil(MAP.x0 / 10) * 10; x < MAP.x1; x += 10) { g.moveTo(Math.round(tx(x)) + 0.5, tz(MAP.z0)); g.lineTo(Math.round(tx(x)) + 0.5, tz(MAP.z1)); }
      for (let z = Math.ceil(MAP.z0 / 10) * 10; z < MAP.z1; z += 10) { g.moveTo(tx(MAP.x0), Math.round(tz(z)) + 0.5); g.lineTo(tx(MAP.x1), Math.round(tz(z)) + 0.5); }
      g.stroke();
    }
  }
  // eau : la mer (hors des rectangles de terre) et les bassins
  if (WATER.on) {
    const wb = WATER.box;
    g.fillStyle = MMPAL.water; rect(Math.max(wb[0], X0), Math.min(wb[1], MAP.x1 + padX), Math.max(wb[2], Z0), Math.min(wb[3], MAP.z1 + padZ));
    g.fillStyle = MMPAL.ground; for (const r of WATER.land) rect(r[0], r[1], r[2], r[3]);
    g.fillStyle = MMPAL.wave; // traits de vagues, une rangée sur deux décalée
    for (let z = Math.ceil(MAP.z0 / 2.6) * 2.6, k = 0; z < MAP.z1; z += 2.6, k++) {
      for (let x = Math.ceil(Math.max(wb[0], MAP.x0) / 5) * 5 + (k % 2) * 2.5; x < Math.min(wb[1], MAP.x1); x += 5) if (waterAt(x, z) && waterAt(x + 1.6, z)) rect(x, x + 1.6, z, z + 0.3);
    }
  }
  for (const p of POOLS) {
    g.beginPath(); p.poly.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tz(z)) : g.moveTo(tx(x), tz(z)))); g.closePath();
    g.fillStyle = MMPAL.water; g.fill(); g.strokeStyle = MMPAL.wave; g.lineWidth = 0.45 * S; g.stroke();
  }
  // ponts (îles flottantes) : le tablier, avec le liseré des îles
  for (const b of BRIDGES) {
    const [x0, x1, z0, z1] = b.axis === 'z' ? [b.c - b.w / 2, b.c + b.w / 2, b.a0, b.a1] : [b.a0, b.a1, b.c - b.w / 2, b.c + b.w / 2];
    g.fillStyle = MMPAL.rim; rect(x0, x1, z0, z1, RIM); g.fillStyle = MMPAL.tiers[0]; rect(x0, x1, z0, z1);
  }
  // rampes : dégradé de la teinte de leur départ à celle de leur arrivée
  for (const r of RAMPS) {
    const gr = r.axis === 'x' ? g.createLinearGradient(tx(r.x0), 0, tx(r.x1), 0) : g.createLinearGradient(0, tz(r.z0), 0, tz(r.z1));
    gr.addColorStop(0, mmHeightColor(r.h0)); gr.addColorStop(1, mmHeightColor(r.h1));
    g.fillStyle = gr; rect(r.x0, r.x1, r.z0, r.z1);
  }
  // surplombs (le dessous est au-dessus des têtes) : un aplat sous les obstacles, que l'on passe dessous ou qu'on y monte
  g.fillStyle = MMPAL.roof; for (const o of boxes) if (o.e >= 1.7 && o.a >= 1.5) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1);
  // obstacles, du plus bas au plus haut : un contour sombre, puis la teinte de l'étage
  const objs = boxes.filter((o) => o.e < 1.7 && o.a >= 0.5 && mmTier(o.t) >= 0);
  for (let tier = 0; tier < 4; tier++) {
    const L = objs.filter((o) => mmTier(o.t) === tier); if (!L.length) continue;
    g.fillStyle = MMPAL.edge; for (const o of L) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1, EDGE);
    g.fillStyle = MMPAL.tiers[tier]; for (const o of L) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1);
  }
  g.restore();
  if (RING.on) { // zone ronde : le dehors assombri, le cercle tracé
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(tx(RING.x), tz(RING.z), RING.r * S, 0, TAU, true); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill('evenodd');
    g.beginPath(); g.arc(tx(RING.x), tz(RING.z), RING.r * S, 0, TAU); g.strokeStyle = MMPAL.ring; g.lineWidth = 0.5 * S; g.stroke(); g.restore();
  }
  return { c, X0, Z0 };
}
/* Fond de la mini-carte (marge de 14 m sur les côtés, 18 m aux bouts : le joueur au bord de la carte voit le dehors noir) et fond de la carte de la frappe aérienne
   et de la tablette (KS.plan : la zone de jeu seule, à TAC_S pixels par mètre, de la taille de l'ancien relevé) */
function buildMinimapStatic() {
  const S = mmDensity(), p = mapPlanPaint(S, 14, 18, true);
  HUD.mmStatic = p.c; HUD.mmS = S; HUD.mmX0 = p.X0; HUD.mmZ0 = p.Z0; HUD.mmFit = true; HUD.mmBg = MMPAL.bg;
  // teintes des repères : les jetons de l'interface (shell.html, :root), lus une fois
  const cs = getComputedStyle(document.documentElement), tok = (n, d) => cs.getPropertyValue(n).trim() || d;
  HUD.mmCol = { ally: tok('--ally', '#8FD16A'), enemy: tok('--enemy', '#EF5543'), acc: tok('--acc', '#F6C445') };
  HUD.mm = $('minimap').getContext('2d');
  KS.plan = mapPlanPaint(TAC_S, 0, 0, false).c;
  const tc = $('tacCanvas'); tc.width = KS.plan.width; tc.height = KS.plan.height; tc.style.aspectRatio = `${KS.plan.width} / ${KS.plan.height}`;
}
/* Relief des dunes : teinte par hauteur, ombrage venu du haut à gauche, courbe de niveau tous les 2 m ; calculé à 2 px par mètre puis agrandi */
function mmRelief(g, S, X0, Z0) {
  const R = S > 4 ? 4 : 2, w = Math.ceil((MAP.x1 - MAP.x0) * R), h = Math.ceil((MAP.z1 - MAP.z0) * R);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const q = cv.getContext('2d'), im = q.createImageData(w, h), d = im.data, H = new Float32Array(w * h);
  let lo = 1e9, hi = -1e9; for (const v of RELIEF.h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = reliefAt(MAP.x0 + (i + 0.5) / R, MAP.z0 + (j + 0.5) / R);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i, hx = (H[j * w + Math.min(w - 1, i + 1)] - H[j * w + Math.max(0, i - 1)]) * R / 2, hz = (H[Math.min(h - 1, j + 1) * w + i] - H[Math.max(0, j - 1) * w + i]) * R / 2;
      let L = 0.17 + (H[k] - lo) / Math.max(1, hi - lo) * 0.12 + ((hx * 0.55 + hz * 0.55 + 0.65) / hyp3(hx, 1, hz) - 0.65) * 0.16;
      const lv = Math.floor(H[k] / 2);
      if ((i + 1 < w && Math.floor(H[k + 1] / 2) !== lv) || (j + 1 < h && Math.floor(H[k + w] / 2) !== lv)) L -= 0.045;
      const v = Math.round(clamp(L, 0, 1) * 255); d[k * 4] = v - 1; d[k * 4 + 1] = v + 2; d[k * 4 + 2] = v + 6; d[k * 4 + 3] = 255;
    }
  }
  q.putImageData(im, 0, 0); g.imageSmoothingEnabled = true;
  g.drawImage(cv, (MAP.x0 - X0) * S, (MAP.z0 - Z0) * S, (MAP.x1 - MAP.x0) * S, (MAP.z1 - MAP.z0) * S);
}
