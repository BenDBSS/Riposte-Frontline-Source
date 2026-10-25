/* ==========================================================================
   KIT PAVILLONNAIRE : le lotissement de province de French Dream (02yn-french-dream.js), réutilisable sur une autre carte.
   - Pavillon type (fdHouse) : bloc enduit d'un étage, façades percées (porte de PVC, baies, volets roulants le plus souvent baissés, coffres,
     appuis, soubassement gris, descentes d'eau), toit à deux pans d'ardoise ou de tuiles mécaniques (fdRoof : débords fermés, bandeaux de PVC,
     gouttières, faîtage, fenêtres de toit, cheminée enduite), garage accolé à sa porte sectionnelle. Une collision pleine : on n'y entre pas.
   - Matériel de jardin et de rue (prefabs PF.fd*) : poubelles à roulettes, boîte aux lettres sur pied, lampadaire de lotissement, piscine
     hors-sol, trampoline à filet, abri de jardin, balançoire, séchoir parapluie, salon de jardin, barbecue, conteneurs de tri, transformateur,
     toboggan, canapé ; chantier : bétonnière, palette de parpaings, benne, barrière de chantier.
   - Surface procédurale du parpaing (TEXLAB.parpaing) et atlas des panneaux (fdSignAtlas : lot à vendre, maison témoin, plaque de rue...).
   Tout est construit par le code ; les tirages sont reproductibles (graines fixes).
   ========================================================================== */
/* Parpaing creux de 50 x 20 cm, joints de mortier gris clair, pores et taches de laitance */
Object.assign(TEXLAB, {
  parpaing: [512, 71, 1.8, `
    vec4 t = tiles(uv, vec2(4.0, 10.0), 0.5);
    float joint = smoothstep(0.0, 0.04, t.w);
    float big = gfbm(uv, vec2(3.0), 4, 1.0), gr = vn(uv * 384.0, vec2(384.0), 3.0), mid = gfbm(uv, vec2(16.0), 3, 2.0);
    vec4 po = vor(uv, vec2(150.0), 4.0, 1.0); float pore = (1.0 - smoothstep(0.05, 0.14, po.x)) * step(0.62, po.z);
    h = joint * (0.7 + gr * 0.15 + mid * 0.1) - pore * 0.25;
    vec3 blk = srgb(vec3(0.6, 0.6, 0.58)) * (0.84 + t.z * 0.16 + big * 0.12 + gr * 0.12);
    vec3 mort = srgb(vec3(0.7, 0.69, 0.65)) * (0.9 + gr * 0.1);
    a = mix(mort, blk, joint) * (1.0 - pore * 0.22);
    r = 0.94; x = h;`],
});
Object.assign(TEXSCALE, { parpaing: 2.0, crepi: 3.0, peinture: 3.0 });
OPT_TEX.add('parpaing');

/* Couleurs du lotissement : crépis (crème, ivoire, beige, saumon pâle), menuiseries de PVC, volets roulants, tôle des voitures */
const FDP = {
  // (l'enduit photographié tire sur le jaune : des teintes presque neutres le gardent crème)
  crepi: [[0.95, 0.95, 0.9], [0.97, 0.97, 0.94], [0.93, 0.92, 0.86], [0.96, 0.94, 0.9]],
  crepiS: [[1.0, 0.9, 0.84], [1.0, 0.93, 0.88], [0.97, 0.88, 0.82], [1.0, 0.92, 0.88]],
  pvc: [0.95, 0.95, 0.93], volet: [[0.93, 0.93, 0.91], [0.84, 0.84, 0.82], [0.62, 0.6, 0.56]],
  slate: [0.56, 0.58, 0.64], tiles: [0.95, 0.82, 0.76], socle: [0.56, 0.56, 0.55],
  // voitures : gris clair, anthracite, gris, rouge, bleu, blanc cassé ; puis orange (le petit SUV), champagne, noir, titane, blanc, bleu nuit
  cars: [[0.78, 0.78, 0.76], [0.2, 0.22, 0.25], [0.62, 0.62, 0.6], [0.55, 0.12, 0.1], [0.24, 0.32, 0.46], [0.86, 0.86, 0.84], [0.86, 0.42, 0.12], [0.72, 0.64, 0.52], [0.11, 0.11, 0.12], [0.46, 0.48, 0.5], [0.93, 0.93, 0.91], [0.18, 0.28, 0.48]],
};

/* ---------- Panneaux (atlas de 1024 x 1536 : huit panneaux en largeur de 512 x 256, deux en hauteur de 320 x 512 pour la sucette
   publicitaire) ; chaque panneau a sa mise en page, des marges larges et un corps qui tient dans sa ligne ---------- */
const FDS = { lot: 0, temoin: 1, residence: 2, rue: 3, vendre: 4, danger: 5, verre: 6, papiers: 7, mupi: 8, mupiVente: 9 };
const FDS_CELL = (i) => (i < 8 ? [(i % 2) * 512, Math.floor(i / 2) * 256, 512, 256] : [(i - 8) * 320, 1024, 320, 512]);
function fdSignAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1536; const g = c.getContext('2d'), R = rngOf(4407);
  const SANS = 'Arial, Helvetica, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
  // une ligne de texte centrée en (cx, cy), réduite si elle dépasse maxW
  const text = (str, cx, cy, size, color, maxW, font = SANS, weight = 'bold', style = '') => {
    g.font = `${style} ${weight} ${size}px ${font}`; const w = g.measureText(str).width, fs = w > maxW ? (size * maxW) / w : size;
    g.font = `${style} ${weight} ${fs}px ${font}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(str, cx, cy);
  };
  const rrect = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const cell = (i, bg, draw) => { const [x, y, w, h] = FDS_CELL(i); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = bg; g.fillRect(x, y, w, h); draw(x, y, w, h); g.restore(); };
  // lot à vendre : bandeau rouge, numéro du lot, terrain viabilisé
  cell(FDS.lot, '#f5f3ee', (x, y, w) => {
    g.fillStyle = '#b3261e'; g.fillRect(x, y + 28, w, 62); text('À VENDRE', x + w / 2, y + 60, 40, '#ffffff', w - 120);
    text('LOT N° 12', x + w / 2, y + 134, 52, '#b3261e', w - 120);
    text('Terrain viabilisé, 452 m²', x + w / 2, y + 192, 32, '#262626', w - 110);
  });
  // maison témoin : bandeau jaune, horaires des visites
  cell(FDS.temoin, '#1f4e79', (x, y, w) => {
    g.fillStyle = '#f2c14e'; g.fillRect(x, y + 30, w, 72); text('MAISON TÉMOIN', x + w / 2, y + 67, 44, '#1f3550', w - 110);
    text('Visite libre', x + w / 2, y + 146, 34, '#ffffff', w - 110);
    text('Samedi et dimanche, de 10 h à 18 h', x + w / 2, y + 196, 22, '#d8e4f0', w - 110, SANS, 'normal');
  });
  // panneau de la résidence (entrée de la rue) : cadre crème, nom en capitales à empattements
  cell(FDS.residence, '#2f5b3f', (x, y, w, h) => {
    g.strokeStyle = '#e9e0c8'; g.lineWidth = 4; rrect(x + 24, y + 22, w - 48, h - 44, 10); g.stroke();
    text('Résidence', x + w / 2, y + 72, 28, '#e9e0c8', w - 140, SERIF, 'normal', 'italic');
    text('Les Mésanges', x + w / 2, y + 128, 58, '#f6f0de', w - 120, SERIF);
    text('24 pavillons de 3 à 5 pièces', x + w / 2, y + 186, 23, '#e9e0c8', w - 140, SANS, 'normal');
  });
  // plaque de rue émaillée : bleu, liseré blanc, coins arrondis
  cell(FDS.rue, '#c9ccd0', (x, y, w, h) => {
    g.fillStyle = '#1d4f9c'; rrect(x + 10, y + 10, w - 20, h - 20, 26); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; rrect(x + 26, y + 26, w - 52, h - 52, 18); g.stroke();
    text('RUE DES', x + w / 2, y + 96, 44, '#ffffff', w - 130); text('MÉSANGES', x + w / 2, y + 160, 58, '#ffffff', w - 120);
  });
  cell(FDS.vendre, '#ffffff', (x, y, w) => { text('À VENDRE', x + w / 2, y + 110, 72, '#c62828', w - 120); text('Renseignements au bureau de vente', x + w / 2, y + 180, 22, '#444444', w - 120, SANS, 'normal'); });
  // danger de mort : triangle et éclair à gauche, texte à droite
  cell(FDS.danger, '#f6d64a', (x, y, w, h) => {
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(x + 40, y + 200); g.lineTo(x + 115, y + 56); g.lineTo(x + 190, y + 200); g.closePath(); g.fill();
    g.fillStyle = '#f6d64a'; g.beginPath(); g.moveTo(x + 122, y + 92); g.lineTo(x + 98, y + 146); g.lineTo(x + 118, y + 146); g.lineTo(x + 104, y + 186); g.lineTo(x + 138, y + 132); g.lineTo(x + 118, y + 132); g.closePath(); g.fill();
    text('DANGER', x + 345, y + 100, 52, '#1a1a1a', 260); text('DE MORT', x + 345, y + 160, 52, '#1a1a1a', 260);
  });
  // conteneurs d'apport volontaire
  cell(FDS.verre, '#2e7d32', (x, y, w) => { text('VERRE', x + w / 2, y + 104, 74, '#ffffff', w - 140); text('Bouteilles, pots et bocaux', x + w / 2, y + 176, 26, '#e3f1e3', w - 140, SANS, 'normal'); });
  cell(FDS.papiers, '#f2c230', (x, y, w) => { text('PAPIERS', x + w / 2, y + 100, 64, '#1a1a1a', w - 140); text('Emballages, cartons et journaux', x + w / 2, y + 172, 24, '#3a3220', w - 140, SANS, 'normal'); });
  // sucette publicitaire, face rue : le pavillon dessiné sous un ciel bleu, le nom de la résidence, le prix d'appel
  cell(FDS.mupi, '#2f5b3f', (x, y, w, h) => {
    const sky = g.createLinearGradient(0, y, 0, y + 250); sky.addColorStop(0, '#6fa3d8'); sky.addColorStop(1, '#cfe3f2'); g.fillStyle = sky; g.fillRect(x, y, w, 250);
    g.fillStyle = '#7fae5a'; g.fillRect(x, y + 205, w, 45);
    g.fillStyle = '#f1ede2'; g.fillRect(x + 70, y + 130, 180, 90); // le pavillon : façade, toit, porte, fenêtres
    g.fillStyle = '#b5523b'; g.beginPath(); g.moveTo(x + 58, y + 132); g.lineTo(x + 160, y + 70); g.lineTo(x + 262, y + 132); g.closePath(); g.fill();
    g.fillStyle = '#6d7782'; g.fillRect(x + 145, y + 168, 30, 52); g.fillRect(x + 90, y + 150, 34, 30); g.fillRect(x + 196, y + 150, 34, 30);
    text('Les Mésanges', x + w / 2, y + 296, 42, '#f6f0de', w - 60, SERIF);
    text('Votre maison avec jardin', x + w / 2, y + 344, 22, '#e9e0c8', w - 60, SANS, 'normal');
    text('à partir de 189 000 €', x + w / 2, y + 388, 30, '#f2c14e', w - 60);
    g.fillStyle = '#e6e1d3'; g.fillRect(x, y + 440, w, 72); text('Bureau de vente sur place', x + w / 2, y + 476, 23, '#16301f', w - 50);
  });
  // sucette publicitaire, face d'en face : dernières maisons à vendre
  cell(FDS.mupiVente, '#ffffff', (x, y, w, h) => {
    g.fillStyle = '#c62828'; g.fillRect(x, y + 40, w, 110); text('À VENDRE', x + w / 2, y + 95, 50, '#ffffff', w - 60);
    text('Dernières maisons', x + w / 2, y + 205, 28, '#1a1a1a', w - 60); text('disponibles', x + w / 2, y + 240, 28, '#1a1a1a', w - 60);
    text('De 90 à 120 m²', x + w / 2, y + 300, 24, '#444444', w - 60, SANS, 'normal'); text('Garage et jardin clos', x + w / 2, y + 334, 24, '#444444', w - 60, SANS, 'normal');
    g.fillStyle = '#2f5b3f'; g.fillRect(x, y + 420, w, 92); text('Les Mésanges', x + w / 2, y + 466, 34, '#f6f0de', w - 60, SERIF);
  });
  // salissures légères (poussière, coulures), dégradé de patine vers le bas
  for (let i = 0; i < 10; i++) {
    const [x, y, w, h] = FDS_CELL(i);
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '255,255,250' : '50,50,45'},${R() * 0.06})`; g.fillRect(x + R() * w, y + R() * h, 1 + R() * 4, 1 + R() * 3); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(40,45,50,0.14)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Panneau de l'atlas posé à plat, face +z du repère courant (centre xc, bas y), avec son cadre ; o.both : imprimé des deux côtés */
function fdSign(M, xc, y, w, h, idx, frame = [0.3, 0.3, 0.3], o = {}) {
  const [cx, cy, cw, ch] = FDS_CELL(idx), u0 = cx / 1024, v0 = cy / 1536, du = cw / 1024, dv = ch / 1536, z = 0.03;
  M.save().color([1, 1, 1]);
  for (const sd of o.both ? [1, -1] : [1]) {
    const B = M.buf('signs5', xc, y, sd * z), zz = sd * z, xa = xc - sd * w / 2, xb = xc + sd * w / 2;
    const a = M.v(B, xa, y, zz, 0, 0, sd, u0, v0 + dv), b = M.v(B, xb, y, zz, 0, 0, sd, u0 + du, v0 + dv);
    const c = M.v(B, xb, y + h, zz, 0, 0, sd, u0 + du, v0), d = M.v(B, xa, y + h, zz, 0, 0, sd, u0, v0);
    M.quadI(B, a, b, c, d);
  }
  if (frame) { M.color(frame).local(1); lbox(M, 'paint', xc - w / 2 - 0.025, xc + w / 2 + 0.025, y - 0.025, y + h + 0.025, -z + 0.002, z - 0.002); }
  M.restore();
}

/* ---------- Toit à deux pans ---------- */
/* Toit sur le bloc [x0, x1] x [z0, z1], faîtage le long de x, égout à y. o : mat ('slate' ou 'rooftiles'), tint, gable (teinte des pignons
   enduits), wallMat (matière des pignons et de la cheminée, crépi par défaut), pitch (rad), ov (débord à l'égout), ovx (débord en pignon), gables ([côté x0, côté x1] : pignon enduit et rive ; sans pignon, le pan
   finit contre le mur voisin), chimney (x de la cheminée dans le monde, ou null), velux ([[pan +1 ou -1, x dans le monde], ...]), col (collision du comble, true par défaut).
   Dessous des débords fermé (lambris de PVC), bandeaux d'égout, gouttières demi-rondes. Rend { rise }. */
function fdRoof(x0, x1, z0, z1, y, o = {}) {
  const M = DECOR, span = z1 - z0, len = x1 - x0, tn = Math.tan(o.pitch || 0.65), rise = (span / 2) * tn, ov = o.ov !== undefined ? o.ov : 0.4, drop = ov * tn;
  const hs = span / 2 + ov, nl = hyp(hs, rise + drop), ovx = o.ovx !== undefined ? o.ovx : 0.3, G = o.gables || [true, true];
  const xa = G[0] ? -ovx : -0.05, xb = len + (G[1] ? ovx : 0.05), mat = o.mat || 'rooftiles', tint = o.tint || (mat === 'slate' ? FDP.slate : FDP.tiles);
  const slate = mat === 'slate';
  M.save().move(x0, y, (z0 + z1) / 2);
  for (const s of [1, -1]) {
    M.color(tint).world(1); M.cls = 0;
    M.quad(mat, [xa, -drop, s * hs], [xb, -drop, s * hs], [xb, rise, 0], [xa, rise, 0], [0, hs / nl, (s * (rise + drop)) / nl]);
    // lambris de PVC sous le débord, parallèle au pan (fermé jusqu'au mur), bandeau d'égout
    M.color(FDP.pvc).local(1);
    M.quad('paintwood', [xa, -drop - 0.07, s * hs], [xb, -drop - 0.07, s * hs], [xb, rise - 0.07, 0], [xa, rise - 0.07, 0], [0, -1, 0]);
    M.save().move((xa + xb) / 2, -drop - 0.22, s * (hs + 0.01)); M.box('paintwood', xb - xa, 0.2, 0.03); M.restore();
    // gouttière demi-ronde de PVC gris
    M.color([0.62, 0.62, 0.6]); M.cls = 1;
    M.save().move(xa, -drop - 0.12, s * (hs + 0.08)).rotZ(-Math.PI / 2); M.cyl('plastic', 0.065, xb - xa, 8, { a0: -Math.PI / 2, a1: Math.PI / 2, caps: '' }); M.restore();
    M.cls = 0;
  }
  // faîtage : tuiles faîtières demi-rondes ou lignolet d'ardoise
  M.color(slate ? tint.map((c) => c * 0.82) : [0.86, 0.52, 0.4]).local(1);
  M.save().move(xa, rise - 0.02, 0).rotZ(-Math.PI / 2); M.cyl(mat, slate ? 0.07 : 0.13, xb - xa, 8, { a0: Math.PI / 2, a1: Math.PI * 1.5 }); M.restore();
  // pignons enduits et rives de PVC le long des rampants (le pignon monte jusque sous les pans)
  for (const [k, xx, dir] of [[0, 0, -1], [1, len, 1]]) {
    if (!G[k]) continue;
    M.color(o.gable || FDP.crepi[0]).world(1);
    M.tri3(o.wallMat || 'crepi', [xx, 0, -span / 2], [xx, 0, span / 2], [xx, rise - 0.03, 0], [dir, 0, 0]);
    // dessous du débord de pignon (entre le pignon et la rive) : fermé
    const xe = k ? xb : xa;
    M.color(FDP.pvc).local(1);
    for (const s of [1, -1]) M.quad('paintwood', [xx, -drop - 0.07, s * hs], [xe, -drop - 0.07, s * hs], [xe, rise - 0.07, 0], [xx, rise - 0.07, 0], [0, -1, 0]);
    for (const s of [1, -1]) { const dy = rise + drop, dz = -s * hs, L = hyp(dy, dz); M.save().move(xe - dir * 0.015, (rise - drop) / 2 - 0.08, (s * hs) / 2).rotX(Math.atan2(-dy, dz)); M.box('paintwood', 0.03, 0.24, L + 0.06); M.restore(); }
  }
  // fenêtres de toit (cadre d'aluminium gris, vitrage sombre), posées sur le pan
  for (const [s, xc] of o.velux || []) {
    const tc = 0.42, zS = s * tc * hs, yS = rise - tc * (rise + drop), a = Math.atan2(rise + drop, hs);
    M.save().move(xc - x0, yS, zS).rotX(s * a).local(1);
    M.color([0.32, 0.33, 0.34]); M.boxB('steel', -0.4, 0.4, -0.01, 0.08, -0.55, 0.55, { bevel: 0.015 });
    M.color([0.12, 0.14, 0.17]); M.cls = 1; M.quad('glass', [-0.33, 0.082, -0.48], [0.33, 0.082, -0.48], [0.33, 0.082, 0.48], [-0.33, 0.082, 0.48], [0, 1, 0]); M.cls = 0;
    M.restore();
  }
  // cheminée enduite et son chapeau, au faîtage
  if (o.chimney !== undefined && o.chimney !== null) {
    const cx = o.chimney - x0;
    M.color(o.gable || FDP.crepi[0]).world(1); M.boxB(o.wallMat || 'crepi', cx - 0.32, cx + 0.32, rise * 0.55, rise + 0.85, -0.32, 0.32);
    M.color([0.62, 0.62, 0.6]).local(1); M.boxB('concrete', cx - 0.38, cx + 0.38, rise + 0.85, rise + 0.93, -0.38, 0.38, { bevel: 0.01 });
    M.color([0.4, 0.4, 0.4]); M.save().move(cx, rise + 0.93, 0); M.cyl('steel', 0.08, 0.3, 8); M.restore();
  }
  // occultation et collision du comble en gradins, sous les pans : une boîte unique dépassait des pans près de l'égout (saillie invisible,
  // éclairage cuit assombri en bande au milieu du toit) ; l'occultation reste à 0,35 m sous la couverture (cellules de 0,5 m)
  for (let k = 0; k < 6; k++) { const w = hs * (1 - k / 6), yt = rise - w * tn - 0.35; if (yt > -drop + 0.1) M.occ(0, len, -drop, yt, -w, w, 1); }
  if (o.col !== false) for (let k = 0, yb = 0; k < 4; k++) { const w = (span / 2 - 0.3) * (1 - k / 4), yt = rise - w * tn - 0.12; if (yt > yb) M.col(0, len, yb, yt, -w, w, 'concrete'); yb = Math.max(yb, yt); }
  M.restore();
  return { rise };
}

/* ---------- Façades ---------- */
/* Volet roulant au fond d'une embrasure (repère de façade) : lames de PVC baissées jusqu'à la part open (0 : fermé, 1 : relevé), coffre dans le
   haut du tableau ; derrière la part ouverte, la fenêtre et sa pièce (windowJoinery) */
function fdShutter(M, op, d, tint, open) {
  const h = op.y1 - op.y0, bottom = op.y0 + h * open;
  if (open > 0.04) windowJoinery(M, { ...op, y1: op.y1 - 0.16 }, d, FDP.pvc, { glass: open > 0.5 ? undefined : 'glass' });
  M.save().color(tint).local(1); M.uvS = 1.5 / TEXSCALE.rollshutter;
  if (bottom < op.y1 - 0.18) M.boxB('rollshutter', op.x0 + 0.01, op.x1 - 0.01, bottom, op.y1 - 0.16, -0.07, -0.05);
  M.color(FDP.pvc); M.boxB('paintwood', op.x0, op.x1, op.y1 - 0.18, op.y1, -0.09, -0.005); // coffre
  M.color([0.7, 0.7, 0.7]); lbox(M, 'steel', op.x0 + 0.005, op.x0 + 0.035, op.y0, op.y1 - 0.18, -0.08, -0.045); lbox(M, 'steel', op.x1 - 0.035, op.x1 - 0.005, op.y0, op.y1 - 0.18, -0.08, -0.045);
  M.restore();
}
/* Porte de garage sectionnelle (repère de façade) : panneaux de PVC à rainures ; open : relevée (on voit le dessous des panneaux en haut) */
function fdGarageDoor(M, op, d, tint, open) {
  M.save().color(tint).local(1);
  if (!open) {
    const n = 4, ph = (op.y1 - op.y0) / n;
    for (let i = 0; i < n; i++) M.boxB('paintwood', op.x0 + 0.02, op.x1 - 0.02, op.y0 + i * ph + 0.012, op.y0 + (i + 1) * ph - 0.012, -d + 0.04, -d + 0.08, { bevel: 0.01 });
    M.color([0.5, 0.5, 0.5]); M.boxB('steel', (op.x0 + op.x1) / 2 - 0.12, (op.x0 + op.x1) / 2 + 0.12, op.y0 + 0.5, op.y0 + 0.56, -d + 0.08, -d + 0.1);
  } else {
    M.boxB('paintwood', op.x0 + 0.02, op.x1 - 0.02, op.y1 - 0.08, op.y1 - 0.02, -d - 2.4, -d + 0.06); // la porte relevée, sous le plafond
  }
  M.restore();
}
/* Pavillon type sur le bloc [x0, x1] x [z0, z1] (un étage, égout à h), garage accolé (g : { x0, x1, z0, z1 }), façade sur la rue côté front ('n' : z0,
   's' : z1). o : tint, roof ('slate' ou 'rooftiles'), R (tirages), doorX (x de la porte dans le monde), shut (part relevée des volets, tirée par fenêtre si absente), open (garage ouvert : rien que la porte relevée, voir la maison
   témoin), garage.flat (toit-terrasse : la carte pose la dalle), solid (false : ni collision ni murs, la maison est construite à part ; on ne pose que le toit et l'habillage) */
function fdHouse(x0, x1, z0, z1, h, front, o = {}) {
  const R = o.R || rngOf(Math.round(x0 * 31 + z0 * 17) + 77), tint = o.tint || R.pick(FDP.crepi), voletT = R.pick(FDP.volet), back = front === 'n' ? 's' : 'n';
  const shut = () => (o.shut !== undefined ? o.shut : R() < 0.7 ? 0 : R.pick([0.15, 0.35, 1]));
  if (o.solid !== false) DECOR.col(x0, x1, 0, h, z0, z1, 'concrete');
  for (const f of 'nsew') {
    if (o.solid === false) break;
    const F = facadeFrame(f, x0, x1, z0, z1), len = F.len, ops = [], after = [];
    if (f === front) {
      const dx = o.doorX !== undefined ? (front === 'n' ? x1 - o.doorX : o.doorX - x0) : len * 0.42; // abscisse de la porte dans le repère de la façade
      const door = { x0: dx - 0.5, x1: dx + 0.5, y0: 0, y1: 2.15, depth: 0.2 }; ops.push(door);
      after.push((M) => { panelDoor(M, door, 0.2, FDP.pvc, { glazed: true }); wallLamp(M, dx + 0.85, 2.2, false); M.save().color(FDP.socle).local(1); M.boxB('concrete', dx - 0.75, dx + 0.75, 0, 0.15, 0, 0.55, { bevel: 0.02 }); M.col(dx - 0.75, dx + 0.75, 0, 0.15, 0, 0.55, 'concrete'); M.restore(); }); // seuil de béton
      // baie du séjour, fenêtres de l'étage
      const wx = dx < len / 2 ? len * 0.74 : len * 0.24, big = { x0: wx - 1.0, x1: wx + 1.0, y0: 0.9, y1: 2.25, depth: 0.2 }; ops.push(big);
      for (const ux of [len * 0.25, len * 0.72]) ops.push({ x0: ux - 0.6, x1: ux + 0.6, y0: 3.55, y1: 4.8, depth: 0.2 });
    } else if (f === back) {
      ops.push({ x0: len * 0.3 - 1.2, x1: len * 0.3 + 1.2, y0: 0, y1: 2.15, depth: 0.2, baie: true }, { x0: len * 0.75 - 0.5, x1: len * 0.75 + 0.5, y0: 1.1, y1: 2.2, depth: 0.2 });
      for (const ux of [len * 0.28, len * 0.7]) ops.push({ x0: ux - 0.55, x1: ux + 0.55, y0: 3.55, y1: 4.7, depth: 0.2 });
    } else if (R() < 0.5) ops.push({ x0: len / 2 - 0.4, x1: len / 2 + 0.4, y0: 3.7, y1: 4.6, depth: 0.2 }); // pignon : un petit jour à l'étage, une fois sur deux
    for (const op of ops) if (!op.y0 || op.y0 > 0.5) { const st = op.y0 === 0 && !op.baie ? null : shut(); if (st !== null) after.push((M) => { fdShutter(M, op, 0.2, voletT, st); if (op.y0 > 0.5) sill(M, op, 'concrete', [0.78, 0.77, 0.74]); }); }
    inFrame(F, (M) => {
      M.save().color(tint).world(1); M.aoFn = (x, y) => lerp(0.75, 1, smoothstep(0, 1.2, y));
      wallPierced(M, 'crepi', len, 0, h, ops, { depth: 0.2, back: true });
      M.restore();
      // soubassement gris (enduit taloché) entre les portes
      let cur = 0; for (const p of ops.filter((q) => q.y0 < 0.3)) { if (p.x0 - cur > 0.05) plinthSeg(M, cur, p.x0, { mat: 'concrete', h: 0.32, tint: FDP.socle }); cur = p.x1; }
      if (len - cur > 0.05) plinthSeg(M, cur, len, { mat: 'concrete', h: 0.32, tint: FDP.socle });
      for (const fn of after) fn(M);
      if (f === front || f === back) drainPipe(M, f === front ? 0.2 : len - 0.2, h - 0.1);
    });
  }
  fdRoof(x0, x1, z0, z1, h, { mat: o.roof, gable: tint, pitch: o.roof === 'slate' ? 0.72 : 0.6, chimney: o.chimney !== undefined ? o.chimney : x0 + (x1 - x0) * 0.25, velux: [[front === 'n' ? 1 : -1, x0 + (x1 - x0) * 0.3], [front === 'n' ? 1 : -1, x0 + (x1 - x0) * 0.72]] });
  // garage accolé : porte sectionnelle côté rue, toit plus bas qui finit contre le pignon de la maison
  const g = o.garage;
  if (g) {
    const gh = 2.7, gside = (g.x0 + g.x1) / 2 < (x0 + x1) / 2 ? 0 : 1; // le garage est à gauche (côté x0) ou à droite de la maison
    if (!o.open) {
      DECOR.col(g.x0, g.x1, 0, gh, g.z0, g.z1, 'concrete');
      for (const f of 'nsew') {
        if ((f === 'e' && gside === 0) || (f === 'w' && gside === 1)) continue; // le mur contre la maison
        const F = facadeFrame(f, g.x0, g.x1, g.z0, g.z1), len = F.len, ops = [];
        const gd = f === front ? { x0: 0.4, x1: len - 0.4, y0: 0, y1: 2.05, depth: 0.2, ferme: true } : null; if (gd) ops.push(gd); // fermée : ce n'est pas un passage
        inFrame(F, (M) => {
          M.save().color(tint).world(1); wallPierced(M, 'crepi', len, 0, gh, ops, { depth: 0.2, back: true }); M.restore();
          if (gd) fdGarageDoor(M, gd, 0.2, FDP.pvc, false); else plinthSeg(M, 0, len, { mat: 'concrete', h: 0.32, tint: FDP.socle });
        });
      }
    }
    if (!g.flat) fdRoof(g.x0, g.x1, g.z0, g.z1, gh, { mat: o.roof, gable: tint, pitch: 0.5, gables: gside === 0 ? [true, false] : [false, true], col: !o.open }); // flat : toit-terrasse posé par la carte
  }
}

/* ---------- Rue et jardins ---------- */
/* Poubelle à roulettes (cuve gris anthracite, couvercle de la couleur de la collecte) */
PF.fdBin = (lid = [0.98, 0.78, 0.12]) => prefab('fdBin' + lid.join(','), (M) => {
  M.local(1); M.color([0.24, 0.25, 0.26]);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0.1, 0.5, y));
  M.save().move(0.29, 0, 0).rotY(-Math.PI / 2); M.extrude('rubber', [[-0.33, 0.06], [0.33, 0.06], [0.37, 0.98], [-0.36, 0.98]], 0.58, { sharp: 0.2 }); M.restore(); // cuve évasée vers le haut
  M.aoFn = null;
  M.color(lid); M.boxB('plastic', -0.31, 0.31, 0.98, 1.04, -0.39, 0.38, { bevel: 0.02 });
  M.color([0.12, 0.12, 0.12]); M.boxB('plastic', -0.26, 0.26, 0.93, 0.99, -0.42, -0.36, { bevel: 0.01 }); // poignée
  for (const sd of [-1, 1]) { M.save().move(sd * 0.24, 0, -0.33).rotY(Math.PI / 2); wheel(M, 0.1, 0.05, { side: sd, rim: [0.25, 0.25, 0.25] }); M.restore(); }
  M.col(-0.3, 0.3, 0, 1.04, -0.38, 0.38, 'wood');
});
propType('fdBin', (a) => ({ pf: () => PF.fdBin(a.length ? a : undefined), shapes: [BOX(0, 0.52, 0, 0.32, 0.52, 0.4)], com: [0, 0.45, 0],
  mass: 14, mu: 0.6, e: 0.15, rr: 3, resp: 2, blast: 6, hold: 8, mat: 'metal', snd: 'plastic' }));
/* Boîte aux lettres sur pied (plastique beige, comme sur les photos) */
PF.fdMailbox = () => prefab('fdMailbox', (M) => {
  M.local(1); M.color([0.62, 0.62, 0.6]); M.boxB('steel', -0.03, 0.03, 0, 1.0, -0.03, 0.03);
  M.color([0.9, 0.86, 0.72]); M.boxB('plastic', -0.21, 0.21, 1.0, 1.32, -0.17, 0.17, { bevel: 0.025 });
  M.color([0.2, 0.2, 0.2]); M.boxB('plastic', -0.12, 0.12, 1.25, 1.27, 0.165, 0.18);
  M.col(-0.21, 0.21, 0, 1.32, -0.17, 0.17, 'wood');
});
/* Lampadaire de lotissement : mât gris effilé, lanterne plate */
PF.fdLamp = () => prefab('fdLamp', (M) => {
  M.color([0.42, 0.43, 0.44]).local(1);
  M.cyl('steel', 0.07, 4.6, 8, { r1: 0.045 });
  M.save().move(0, 4.6, 0); M.boxB('steel', -0.03, 0.03, -0.03, 0.03, 0, 0.5); M.restore();
  M.color([0.3, 0.31, 0.32]); M.boxB('steel', -0.16, 0.16, 4.5, 4.62, 0.4, 0.9, { bevel: 0.02 });
  M.cls = 1; M.color([0.9, 0.9, 0.86]); M.boxB('lampOff', -0.13, 0.13, 4.48, 4.5, 0.44, 0.86);
  M.col(-0.08, 0.08, 0, 4.6, -0.08, 0.08, 'metal');
});
/* Piscine hors-sol à structure tubulaire (diamètre 2 r, haute de 1,22 m) : liner bleu clair, margelle de PVC, poteaux, échelle ; l'eau est
   posée à part (pondAdd, bassin où l'on entre), ses collisions aussi (fdRingCols : la paroi seule) */
PF.fdPool = (r = 2.2) => prefab('fdPool' + r, (M) => {
  M.local(1); const n = 12, h = 1.22;
  M.color([0.55, 0.68, 0.78]); M.cyl('plastic', r, h - 0.05, 32, { caps: '' });
  M.color([0.42, 0.66, 0.8]); M.lathe('plastic', [[r - 0.03, h - 0.06], [r - 0.03, 0.02]], 32); // intérieur du liner, tourné vers l'eau (profil de haut en bas)
  M.save().move(0, 0.02, 0); M.color([0.36, 0.6, 0.76]); M.cyl('plastic', r - 0.02, 0.01, 32, { caps: 't' }); M.restore(); // fond du liner (sous l'eau, on ne voit pas la pelouse)
  M.color([0.86, 0.87, 0.88]); M.save().move(0, h - 0.06, 0); M.lathe('plastic', [[r - 0.06, 0], [r + 0.07, 0], [r + 0.07, 0.06], [r - 0.06, 0.06], [r - 0.06, 0]], 32, { sharp: 0.3 }); // margelle fermée tout autour M.restore();
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; M.save().move(Math.cos(a) * (r + 0.04), 0, Math.sin(a) * (r + 0.04)); M.cyl('steel', 0.03, h - 0.05, 6); M.restore(); }
  M.color([0.82, 0.83, 0.84]); M.cls = 1;
  for (const sd of [-1, 1]) M.tube('steel', 0.022, [[sd * 0.25, 0, r + 0.55], [sd * 0.25, h + 0.25, r + 0.05], [sd * 0.25, h + 0.3, r - 0.3], [sd * 0.25, 0.4, r - 0.55]], 6);
  for (const y of [0.35, 0.7, 1.0]) M.boxB('plastic', -0.25, 0.25, y, y + 0.04, r + 0.55 - (y / (h + 0.25)) * 0.5 - 0.08, r + 0.55 - (y / (h + 0.25)) * 0.5 + 0.08);
  M.cls = 0;
});
/* Paroi circulaire de rayon r (x, z), épaisseur e, hauteur h : n boîtes posées sur le cercle (l'intérieur reste libre) */
function fdRingCols(x, z, r, e, h, n) {
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * TAU, cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r, hl = Math.PI * r / n + 0.03;
    const hx = Math.abs(Math.cos(a)) * e / 2 + Math.abs(Math.sin(a)) * hl, hz = Math.abs(Math.sin(a)) * e / 2 + Math.abs(Math.cos(a)) * hl;
    DECOR.col(cx - Math.min(hx, 0.42), cx + Math.min(hx, 0.42), 0, h, cz - Math.min(hz, 0.42), cz + Math.min(hz, 0.42), 'wood');
  }
}
/* Contour d'un cercle (n côtés) pour un bassin praticable */
function fdCirclePoly(x, z, r, n) { const P = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; P.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); } return P; }
/* Collisions d'un disque de rayon r (x, z) : quatre boîtes qui restent dans le cercle */
function fdDiscCols(x, z, r, h, m = 'wood') {
  for (const [a, b] of [[0.95, 0.31], [0.31, 0.95], [0.8, 0.6], [0.6, 0.8]]) DECOR.col(x - a * r, x + a * r, 0, h, z - b * r, z + b * r, m);
}
/* Trampoline à filet de protection : cadre et tapis à 0,8 m, poteaux mousse, filet tendu ; collisions à part (fdNetCols : le filet arrête les
   soldats, ni les tirs ni la vue) */
PF.fdTrampoline = (r = 1.8) => prefab('fdTramp' + r, (M) => {
  M.local(1); const n = 8, y = 0.8, H = 2.55;
  M.color([0.25, 0.27, 0.3]); M.save().move(0, y - 0.04, 0); M.cyl('plastic', r - 0.15, 0.02, 24); M.restore(); // tapis
  M.color([0.2, 0.45, 0.75]); M.save().move(0, y - 0.06, 0); M.lathe('plastic', [[r - 0.2, 0], [r + 0.05, 0], [r + 0.05, 0.08], [r - 0.2, 0.08]], 24); M.restore(); // protection des ressorts
  M.color([0.35, 0.36, 0.38]);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; M.tube('steel', 0.025, [[Math.cos(a - 0.3) * r, y - 0.06, Math.sin(a - 0.3) * r], [Math.cos(a) * (r + 0.05), 0, Math.sin(a) * (r + 0.05)], [Math.cos(a + 0.3) * r, y - 0.06, Math.sin(a + 0.3) * r]], 6); }
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; M.color([0.2, 0.45, 0.75]); M.save().move(Math.cos(a) * r, y - 0.06, Math.sin(a) * r); M.cyl('plastic', 0.04, H - y, 6); M.restore(); }
  M.color([0.12, 0.12, 0.13]); M.cls = 1;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, p = (a, yy) => [Math.cos(a) * r, yy, Math.sin(a) * r];
    M.quad('lattice', p(a0, y), p(a1, y), p(a1, H - 0.05), p(a0, H - 0.05), [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
  }
  M.cls = 0;
});
function fdNetCols(x, z, r, h) {
  for (const [a, b] of [[0.95, 0.31], [0.31, 0.95], [0.8, 0.6], [0.6, 0.8]]) COL.push({ x0: x - a * r, x1: x + a * r, y0: 0, y1: h, z0: z - b * r, z1: z + b * r, m: 'glass', ray: false, noRay: true });
}
/* Abri de jardin en PVC imitation bois (w x d, porte double sur la face +z), toit à deux pans de bac acier */
PF.fdShed = (w = 2.2, d = 2.0, tint = [0.62, 0.52, 0.4]) => prefab(`fdShed${w}_${d}_${tint.join(',')}`, (M) => {
  M.local(1); const h = 1.95, rise = 0.4;
  M.color(tint); M.boxB('paintwood', -w / 2, w / 2, 0, h, -d / 2, d / 2);
  for (const sd of [-1, 1]) M.tri3('paintwood', [sd * w / 2, h, -d / 2], [sd * w / 2, h, d / 2], [sd * w / 2, h + rise, 0], [sd, 0, 0]);
  M.color([0.3, 0.32, 0.3]);
  for (const s of [1, -1]) { const nl = hyp(d / 2 + 0.12, rise + 0.08); M.quad('corrugated', [-w / 2 - 0.08, h - 0.08, s * (d / 2 + 0.12)], [w / 2 + 0.08, h - 0.08, s * (d / 2 + 0.12)], [w / 2 + 0.08, h + rise, 0], [-w / 2 - 0.08, h + rise, 0], [0, (d / 2 + 0.12) / nl, (s * (rise + 0.08)) / nl]); M.quad('corrugated', [-w / 2 - 0.08, h - 0.1, s * (d / 2 + 0.12)], [w / 2 + 0.08, h - 0.1, s * (d / 2 + 0.12)], [w / 2 + 0.08, h + rise - 0.02, 0], [-w / 2 - 0.08, h + rise - 0.02, 0], [0, -1, 0]); }
  M.color(tint.map((c) => c * 0.8)); M.boxB('paintwood', -0.6, 0.6, 0.02, 1.8, d / 2, d / 2 + 0.025); M.color([0.15, 0.15, 0.15]); M.boxB('paintwood', -0.01, 0.01, 0.02, 1.8, d / 2 + 0.025, d / 2 + 0.03);
  M.col(-w / 2, w / 2, 0, h + rise * 0.5, -d / 2, d / 2, 'wood');
});
/* Balançoire de jardin : portique en tubes d'acier vert (3 m), deux sièges ; seuls les pieds arrêtent */
PF.fdSwing = () => prefab('fdSwing', (M) => {
  M.local(1); const L = 1.5, H = 2.1;
  M.color([0.2, 0.42, 0.28]);
  M.save().move(-L, H, 0).rotZ(-Math.PI / 2); M.cyl('steel', 0.04, 2 * L, 8); M.restore();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.tube('steel', 0.035, [[sx * L, H, 0], [sx * (L + 0.15), 0, sz * 0.75]], 6);
  for (const x of [-0.55, 0.55]) { M.color([0.5, 0.5, 0.5]); M.cls = 1; for (const dx of [-0.2, 0.2]) M.tube('steel', 0.006, [[x + dx, H, 0], [x + dx, 0.45, 0]], 3); M.cls = 0; M.color([0.85, 0.2, 0.15]); M.boxB('plastic', x - 0.24, x + 0.24, 0.42, 0.46, -0.1, 0.1, { bevel: 0.015 }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.col(sx * (L + 0.15) - 0.08, sx * (L + 0.15) + 0.08, 0, 1.0, sz * 0.75 - 0.08, sz * 0.75 + 0.08, 'metal');
});
/* Séchoir parapluie : mât, quatre bras, fils (le linge, tissu simulé, se pend à la pose : fdDryerLinge) */
PF.fdDryer = () => prefab('fdDryer', (M) => {
  M.local(1); M.color([0.75, 0.76, 0.77]); M.cyl('steel', 0.025, 1.75, 6);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.3; M.tube('steel', 0.012, [[0, 1.75, 0], [Math.cos(a) * 1.3, 1.62, Math.sin(a) * 1.3]], 4); M.tube('steel', 0.01, [[0, 1.2, 0], [Math.cos(a) * 0.7, 1.68, Math.sin(a) * 0.7]], 4); }
  M.cls = 2; M.color([0.85, 0.85, 0.8]);
  for (const k of [0.5, 0.8, 1.1]) for (let i = 0; i < 4; i++) { const a0 = (i / 4) * TAU + 0.3, a1 = ((i + 1) / 4) * TAU + 0.3, yk = 1.75 - (k / 1.3) * 0.13; M.tube('plastic', 0.004, [[Math.cos(a0) * k, yk, Math.sin(a0) * k], [Math.cos(a1) * k, yk, Math.sin(a1) * k]], 3); }
  M.cls = 0;
  M.col(-0.04, 0.04, 0, 1.75, -0.04, 0.04, 'metal');
});
/* Linge du séchoir posé en (x, z), tourné de ry : serviettes et t-shirts pendus aux fils (tissus simulés : ils flottent au vent et s'écartent
   au passage d'un soldat). pieces : [[bras 0 à 3, fil 0 à 2, position le long du fil -0,5 à 0,5, largeur, hauteur, teinte], ...] */
function fdDryerLinge(x, z, ry, pieces, grp) {
  const M = DECOR; M.save().move(x, 0, z).rotY(ry);
  for (const [i, f, u, w, h, c] of pieces) {
    const k = [0.5, 0.8, 1.1][f], a0 = (i / 4) * TAU + 0.3, a1 = ((i + 1) / 4) * TAU + 0.3, yk = 1.75 - (k / 1.3) * 0.13 - 0.01;
    const A = [Math.cos(a0) * k, Math.sin(a0) * k], B = [Math.cos(a1) * k, Math.sin(a1) * k], L = hyp(B[0] - A[0], B[1] - A[1]), tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L;
    const cx = (A[0] + B[0]) / 2 + tx * u * L, cz = (A[1] + B[1]) / 2 + tz * u * L;
    M.color(c); clothPiece(M, [cx - tx * w / 2, yk - h, cz - tz * w / 2], [cx + tx * w / 2, yk - h, cz + tz * w / 2], [cx + tx * w / 2, yk, cz + tz * w / 2], [cx - tx * w / 2, yk, cz - tz * w / 2], [tz, 0, -tx], { grp });
  }
  M.restore();
}
/* Table de jardin ronde en résine blanche et son parasol replié (prop physique, fdTableJardin) */
PF.fdTableJardin = () => prefab('fdTableJardin', (M) => {
  M.local(1); M.color([0.92, 0.92, 0.9]);
  M.save().move(0, 0.7, 0); M.cyl('plastic', 0.5, 0.04, 16); M.restore();
  M.cyl('plastic', 0.05, 0.7, 8);
  M.cyl('plastic', 0.28, 0.05, 12);
  M.color([0.8, 0.78, 0.7]); M.cyl('steel', 0.02, 2.1, 6);
  M.color([0.2, 0.32, 0.5]); M.save().move(0, 1.2, 0); M.cyl('canvas', 0.1, 0.85, 8, { r1: 0.06 }); M.restore();
  M.col(-0.5, 0.5, 0, 0.74, -0.5, 0.5, 'wood');
});
propType('fdTableJardin', { pf: () => PF.fdTableJardin(), shapes: [CYL(0, 0.37, 0, 0.5, 0.37), BOX(0, 1.42, 0, 0.1, 0.68, 0.1)], com: [0, 0.5, 0],
  contact: [[0.28, 0, 0], [-0.28, 0, 0], [0, 0, 0.28], [0, 0, -0.28], [0.5, 0.72, 0], [-0.5, 0.72, 0], [0, 0.72, 0.5], [0, 0.72, -0.5], [0, 2.1, 0]],
  mass: 9, mu: 0.5, e: 0.2, rr: 2, resp: 2.4, blast: 7, mat: 'metal', snd: 'plastic' });
/* Fauteuil monobloc en résine blanche (prop physique, fdChaise) : assise, dossier incliné, quatre pieds, accoudoirs ; devant vers +z */
PF.fdChaise = () => prefab('fdChaise', (M) => {
  M.local(1); M.color([0.92, 0.92, 0.9]);
  M.boxB('plastic', -0.25, 0.25, 0.4, 0.44, -0.22, 0.22, { bevel: 0.015 });
  M.save().move(0, 0.43, -0.21).rotX(-0.18); M.boxB('plastic', -0.24, 0.24, 0, 0.44, -0.02, 0.02, { bevel: 0.015 }); M.restore();
  for (const sx of [-1, 1]) {
    for (const z of [-0.19, 0.19]) M.boxB('plastic', sx * 0.22 - 0.025, sx * 0.22 + 0.025, 0, 0.41, z - 0.025, z + 0.025);
    M.boxB('plastic', sx * 0.25 - 0.03, sx * 0.25 + 0.03, 0.6, 0.63, -0.22, 0.2, { bevel: 0.01 }); M.boxB('plastic', sx * 0.25 - 0.02, sx * 0.25 + 0.02, 0.43, 0.6, 0.15, 0.19);
  }
  M.col(-0.28, 0.28, 0, 0.63, -0.24, 0.24, 'wood');
});
propType('fdChaise', { pf: () => PF.fdChaise(), shapes: [BOX(0, 0.43, -0.01, 0.27, 0.43, 0.24)], com: [0, 0.38, 0],
  contact: [[-0.22, 0, -0.19], [0.22, 0, -0.19], [-0.22, 0, 0.19], [0.22, 0, 0.19], [-0.25, 0.63, 0.2], [0.25, 0.63, 0.2], [-0.24, 0.86, -0.29], [0.24, 0.86, -0.29]],
  mass: 2.5, mu: 0.5, e: 0.25, resp: 3.2, blast: 9, mat: 'metal', snd: 'plastic' });
/* Salon de jardin posé en (x, z) : la table et quatre fauteuils tournés vers elle (props physiques) */
function fdGardenSetAt(x, z, ry) {
  const M = DECOR; M.dyn('fdTableJardin', x, 0, z, ry);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + ry, cx = x + Math.cos(a) * 0.86, cz = z + Math.sin(a) * 0.86; M.dyn('fdChaise', cx, 0, cz, Math.atan2(x - cx, z - cz)); }
}
/* Barbecue boule sur trépied */
PF.fdBbq = () => prefab('fdBbq', (M) => {
  M.local(1); M.color([0.08, 0.08, 0.09]);
  M.save().move(0, 0.62, 0); M.lathe('steel', [[0, 0], [0.22, 0.02], [0.28, 0.15], [0.28, 0.2], [0.27, 0.38], [0.18, 0.5], [0, 0.53]], 14); M.restore();
  M.color([0.6, 0.6, 0.6]); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; M.tube('steel', 0.012, [[Math.cos(a) * 0.12, 0.66, Math.sin(a) * 0.12], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]], 4); }
  M.col(-0.26, 0.26, 0, 1.12, -0.26, 0.26, 'metal');
});
propType('fdBbq', { pf: () => PF.fdBbq(), shapes: [CYL(0, 0.58, 0, 0.29, 0.58)], com: [0, 0.75, 0],
  contact: [[0.3, 0, 0], [-0.15, 0, 0.26], [-0.15, 0, -0.26], [0.28, 0.82, 0], [-0.28, 0.82, 0], [0, 0.82, 0.28], [0, 0.82, -0.28], [0, 1.15, 0]],
  mass: 9, mu: 0.55, e: 0.2, rr: 2, resp: 2.2, blast: 7, mat: 'metal', snd: 'metal' });
/* Conteneur d'apport volontaire (verre, papiers) : cuve métallique 1,5 x 1,5 x 1,7, toit bombé, ouvertures, pictogramme */
PF.fdTri = (tint, sign) => prefab('fdTri' + tint.join(',') + sign, (M) => {
  M.local(1); M.color(tint);
  M.boxB('paint', -0.75, 0.75, 0.05, 1.45, -0.75, 0.75, { bevel: 0.05 });
  M.boxB('paint', -0.74, 0.74, 1.42, 1.62, -0.74, 0.74, { bevel: 0.14 }); // dessus bombé
  M.color([0.12, 0.12, 0.12]); for (const sz of [-1, 1]) { M.save().move(0, 1.25, sz * 0.751); M.cyl('dark', 0.11, 0.002, 12); M.restore(); }
  M.color([0.35, 0.35, 0.35]); M.boxB('steel', -0.12, 0.12, 1.62, 1.78, -0.12, 0.12); // crochet de levage
  M.save().move(0, 0, 0.756); fdSign(M, 0, 0.55, 1.1, 0.55, sign, null); M.restore();
  M.col(-0.75, 0.75, 0, 1.62, -0.75, 0.75, 'metal');
});
/* Poste de transformation : cabine de béton beige, portes métalliques, ventilations, panneau « danger de mort » */
PF.fdTransfo = () => prefab('fdTransfo', (M) => {
  M.local(1); const w = 2.6, d = 2.0, h = 2.4;
  M.color([0.84, 0.8, 0.7]); M.boxB('concrete', -w / 2, w / 2, 0, h, -d / 2, d / 2);
  M.color([0.7, 0.68, 0.62]); M.boxB('concrete', -w / 2 - 0.06, w / 2 + 0.06, h, h + 0.12, -d / 2 - 0.06, d / 2 + 0.06, { bevel: 0.02 });
  M.color([0.36, 0.42, 0.38]);
  for (const x of [-0.65, 0.55]) { M.boxB('paint', x - 0.45, x + 0.45, 0.1, 2.05, d / 2, d / 2 + 0.03); for (let y = 1.6; y < 1.95; y += 0.07) { M.color([0.15, 0.15, 0.15]); M.boxB('dark', x - 0.3, x + 0.3, y, y + 0.03, d / 2 + 0.03, d / 2 + 0.035); M.color([0.36, 0.42, 0.38]); } }
  M.save().move(-0.65, 0, d / 2 + 0.032); fdSign(M, 0, 1.1, 0.42, 0.22, FDS.danger, null); M.restore();
  M.col(-w / 2, w / 2, 0, h + 0.12, -d / 2, d / 2, 'concrete');
});
/* Toboggan de jardin en bois : petite tour (plancher à 1 m) fermée de planches, échelle sur le côté -x, bac à sable bâché au pied,
   glissière vert anis ondulée de 2 m vers +z ; sous la glissière, des collisions en gradins */
PF.fdSlide = () => prefab('fdSlide', (M) => {
  M.local(1); const W = 0.55, Y = 1.0, za = -1.1, zb = 0;
  M.color([0.7, 0.5, 0.3]);
  for (const x of [-W, W]) for (const z of [za, zb]) M.boxB('wood', x - 0.045, x + 0.045, 0, 1.7, z - 0.045, z + 0.045, { bevel: 0.01 }); // poteaux
  M.boxB('wood', -W, W, Y - 0.06, Y, za, zb); // plancher
  M.color([0.76, 0.56, 0.34]);
  // garde-corps de planches verticales : fond, côté +x, côté -x (ouvert sur l'échelle), devant (ouvert sur la glissière)
  const planks = (axis, fixed, a0, a1) => { for (let u = a0 + 0.06; u < a1 - 0.04; u += 0.13) { if (axis === 'x') M.boxB('wood', u - 0.05, u + 0.05, Y + 0.05, Y + 0.62, fixed - 0.015, fixed + 0.015); else M.boxB('wood', fixed - 0.015, fixed + 0.015, Y + 0.05, Y + 0.62, u - 0.05, u + 0.05); } };
  planks('x', za, -W, W); planks('z', W, za, zb); planks('z', -W, za, -0.75); planks('x', zb, -W, -0.26); planks('x', zb, 0.26, W);
  for (const [axis, fixed, a0, a1] of [['x', za, -W, W], ['z', W, za, zb]]) { if (axis === 'x') M.boxB('wood', a0, a1, Y + 0.62, Y + 0.68, fixed - 0.035, fixed + 0.035); else M.boxB('wood', fixed - 0.035, fixed + 0.035, Y + 0.62, Y + 0.68, a0, a1); } // lisses
  // échelle : deux montants inclinés et quatre barreaux
  for (const z of [-0.7, -0.3]) M.tube('wood', 0.03, [[-W - 0.02, Y + 0.6, z], [-W - 0.5, 0, z]], 5);
  for (let i = 1; i <= 4; i++) { const t = i / 5; M.save().move(-W - 0.02 - 0.48 * (1 - t), (Y + 0.6) * t * 0.95, -0.7).rotX(Math.PI / 2); M.cyl('wood', 0.022, 0.4, 6); M.restore(); }
  // bac à sable au pied de la tour : bordure de planches, bâche noire, sable
  M.color([0.62, 0.45, 0.28]);
  for (const sd of [-1, 1]) { M.boxB('wood', -0.75, 0.75, 0, 0.16, sd > 0 ? 0.12 : -1.32, sd > 0 ? 0.2 : -1.24); M.boxB('wood', sd * 0.75 - 0.04, sd * 0.75 + 0.04, 0, 0.16, -1.24, 0.12); }
  M.color([0.1, 0.1, 0.11]); M.quad('canvas', [-0.71, 0.1, -1.24], [0.71, 0.1, -1.24], [0.71, 0.1, 0.12], [-0.71, 0.1, 0.12], [0, 1, 0]);
  // glissière ondulée : fond et rebords le long d'un profil (du bord du plancher au sol, deux creux)
  const N = 18, L = 2.0, prof = (t) => { const z = zb + t * L, d = Math.min(1, t / 0.86); return [z, 0.2 + (Y - 0.2) * Math.pow(1 - d, 1.15) + 0.06 * Math.sin(d * Math.PI * 2) * (1 - d) + (t > 0.86 ? (t - 0.86) * 0.25 : 0)]; };
  M.color([0.62, 0.84, 0.18]);
  const P = []; for (let i = 0; i <= N; i++) P.push(prof(i / N));
  for (let i = 0; i < N; i++) {
    const [z0, y0] = P[i], [z1, y1] = P[i + 1], dz = z1 - z0, dy = y1 - y0, l = hyp(dz, dy), n = [0, dz / l, -dy / l];
    M.quad('plastic', [-0.22, y0, z0], [0.22, y0, z0], [0.22, y1, z1], [-0.22, y1, z1], n); // fond
    M.quad('plastic', [-0.26, y0 - 0.04, z0], [0.26, y0 - 0.04, z0], [0.26, y1 - 0.04, z1], [-0.26, y1 - 0.04, z1], n.map((c) => -c)); // dessous
    for (const sd of [-1, 1]) {
      M.quad('plastic', [sd * 0.22, y0, z0], [sd * 0.22, y1, z1], [sd * 0.22, y1 + 0.14, z1], [sd * 0.22, y0 + 0.14, z0], [-sd, 0, 0]); // rebord, dedans
      M.quad('plastic', [sd * 0.26, y0 - 0.04, z0], [sd * 0.26, y1 - 0.04, z1], [sd * 0.26, y1 + 0.14, z1], [sd * 0.26, y0 + 0.14, z0], [sd, 0, 0]); // dehors
      M.quad('plastic', [sd * 0.22, y0 + 0.14, z0], [sd * 0.26, y0 + 0.14, z0], [sd * 0.26, y1 + 0.14, z1], [sd * 0.22, y1 + 0.14, z1], [0, 1, 0]); // dessus du rebord
    }
  }
  { const [z, y] = P[N]; M.quad('plastic', [-0.26, y - 0.04, z], [0.26, y - 0.04, z], [0.26, y + 0.14, z], [-0.26, y + 0.14, z], [0, 0, 1]); } // bout
  M.color([0.62, 0.45, 0.28]); for (const sd of [-1, 1]) M.boxB('wood', sd * 0.2 - 0.03, sd * 0.2 + 0.03, 0, 0.2, 1.62, 1.68); // pieds du bas
  for (const x of [-W, W]) for (const z of [za, zb]) M.col(x - 0.05, x + 0.05, 0, 1.7, z - 0.05, z + 0.05, 'wood');
  M.col(-W, W, Y - 0.06, Y, za, zb, 'wood'); M.col(-W, W, Y, Y + 0.68, za - 0.03, za + 0.03, 'wood'); M.col(W - 0.03, W + 0.03, Y, Y + 0.68, za, zb, 'wood');
  M.col(-W - 0.03, -W + 0.03, Y, Y + 0.68, za, -0.75, 'wood'); M.col(-W, -0.26, Y, Y + 0.68, zb - 0.03, zb + 0.03, 'wood'); M.col(0.26, W, Y, Y + 0.68, zb - 0.03, zb + 0.03, 'wood');
  M.col(-0.75, 0.75, 0, 0.1, -1.32, 0.2, 'wood'); // bac à sable (on marche sur la bâche)
  for (const [z0, z1, y] of [[0, 0.5, 0.7], [0.5, 1.0, 0.42], [1.0, 1.5, 0.22]]) M.col(-0.26, 0.26, 0, y, z0, z1, 'plastic'); // sous la glissière
});
/* Canapé (déménagement) : tissu gris, accoudoirs */
PF.fdSofa = (tint = [0.52, 0.5, 0.48]) => prefab('fdSofa' + tint.join(','), (M) => {
  M.local(1); M.color(tint);
  M.boxB('canvas', -1.0, 1.0, 0.1, 0.45, -0.45, 0.45, { bevel: 0.05 }); M.boxB('canvas', -1.0, 1.0, 0.45, 0.85, -0.45, -0.22, { bevel: 0.06 });
  for (const sx of [-1, 1]) M.boxB('canvas', sx * 1.0 - (sx > 0 ? 0.2 : 0), sx * 1.0 + (sx > 0 ? 0 : 0.2), 0.1, 0.62, -0.45, 0.45, { bevel: 0.05 });
  M.color([0.82, 0.8, 0.76]); for (const x of [-0.45, 0.45]) M.boxB('canvas', x - 0.42, x + 0.42, 0.45, 0.55, -0.2, 0.4, { bevel: 0.04 });
  M.color([0.15, 0.12, 0.1]); for (const sx of [-0.9, 0.9]) for (const sz of [-0.38, 0.38]) M.boxB('wood', sx - 0.03, sx + 0.03, 0, 0.1, sz - 0.03, sz + 0.03);
  M.col(-1.0, 1.0, 0, 0.85, -0.45, 0.45, 'wood');
});
/* Sucette publicitaire (mobilier urbain) : panneau rétroéclairé de 1,3 x 2 m sur pied, l'affiche des derniers lots des deux côtés */
PF.fdMupi = () => prefab('fdMupi', (M) => {
  M.local(1); M.color([0.3, 0.31, 0.32]);
  M.boxB('paint', -0.7, 0.7, 0.35, 2.55, -0.12, 0.12, { bevel: 0.03 });
  M.boxB('paint', -0.12, 0.12, 0, 0.35, -0.08, 0.08);
  M.save().move(0, 0, 0.121); fdSign(M, 0, 0.5, 1.2, 1.9, FDS.mupi, null); M.restore();
  M.save().move(0, 0, -0.121).rotY(Math.PI); fdSign(M, 0, 0.5, 1.2, 1.9, FDS.mupiVente, null); M.restore();
  M.col(-0.7, 0.7, 0, 2.55, -0.12, 0.12, 'metal');
});
/* Caravane remisée (5,6 m, caisse blanche à bande, baies, porte, timon, roues) ; front : timon vers -z */
PF.fdCaravan = () => prefab('fdCaravan', (M) => {
  M.local(1); const L = 5.6, W = 2.2, H = 2.55, y0 = 0.4, hl = L / 2, hw = W / 2;
  M.color([0.94, 0.94, 0.92]);
  M.save().move(hw, y0, 0).rotY(-Math.PI / 2); M.extrude('paint', [[-hl, 0], [hl, 0], [hl, H - y0 - 0.25], [hl - 0.3, H - y0], [-hl + 0.4, H - y0], [-hl, H - y0 - 0.4]], W, { sharp: 0.3 }); M.restore();
  M.color([0.55, 0.62, 0.7]); for (const sd of [-1, 1]) M.boxB('paint', sd * (hw + 0.004) - 0.004, sd * (hw + 0.004) + 0.004, y0 + 0.55, y0 + 0.75, -hl + 0.05, hl - 0.05);
  M.color([0.1, 0.12, 0.14]); M.cls = 1;
  for (const sd of [-1, 1]) for (const [z0, z1] of [[-1.9, -0.9], [0.6, 1.8]]) M.quad('glass', [sd * (hw + 0.01), y0 + 1.0, z0], [sd * (hw + 0.01), y0 + 1.0, z1], [sd * (hw + 0.01), y0 + 1.7, z1], [sd * (hw + 0.01), y0 + 1.7, z0], [sd, 0, 0]);
  M.quad('glass', [-0.7, y0 + 1.1, -hl - 0.01], [0.7, y0 + 1.1, -hl - 0.01], [0.7, y0 + 1.7, -hl - 0.01], [-0.7, y0 + 1.7, -hl - 0.01], [0, 0, -1]);
  M.color([0.82, 0.82, 0.8]); M.boxB('paint', hw, hw + 0.03, y0 + 0.1, y0 + 1.95, -0.2, 0.5); M.cls = 0;
  M.color([0.2, 0.2, 0.2]); M.tube('steel', 0.04, [[-0.6, 0.45, -hl], [0, 0.4, -hl - 1.1], [0.6, 0.45, -hl]], 6); M.boxB('steel', -0.05, 0.05, 0, 0.42, -hl - 1.15, -hl - 1.05);
  for (const sd of [-1, 1]) { M.save().move(sd * (hw - 0.15), 0, 0.2); wheel(M, 0.32, 0.18, { side: sd, rim: [0.6, 0.6, 0.6] }); M.restore(); }
  M.col(-hw, hw, 0, H, -hl, hl, 'metal');
});
/* Ballon d'enfant en plastique (prop physique, fdBallon, a : sa couleur ; il roule, les balles le poussent). La couleur est dans le prefab :
   la teinte d'instance ne prend pas sur les corps ronds (les fruits sortent blancs eux aussi) */
PF.fdBallon = (c = [0.9, 0.2, 0.15]) => prefab('fdBallon' + c.join(','), (M) => {
  M.local(1); M.color(c); M.save().move(0, 0.11, 0); M.geo('plastic', new THREE.SphereGeometry(0.11, 12, 8)); M.restore();
});
propType('fdBallon', (a) => ({ pf: () => PF.fdBallon(a.length ? a : undefined), shapes: [SPH(0, 0.11, 0, 0.11)], mass: 0.35, mu: 0.5, e: 0.6, rr: 0.8, resp: 6, blast: 12, lift: 1.0, through: true, ball: true, mat: 'dirt', snd: 'soft' }));
/* Nain de jardin en céramique (prop physique, fdNain : il tombe, et se brise en éclats sous les balles) : bonnet rouge pointu, barbe
   blanche, veste bleue, socle vert */
PF.fdNain = () => prefab('fdNain', (M) => {
  M.local(1);
  M.color([0.3, 0.5, 0.25]); M.cyl('paint', 0.13, 0.04, 10);
  M.color([0.25, 0.4, 0.7]); M.save().move(0, 0.04, 0); M.lathe('paint', [[0.11, 0], [0.12, 0.08], [0.1, 0.2], [0.07, 0.26], [0, 0.27]], 10); M.restore();
  M.color([0.95, 0.94, 0.9]); M.save().move(0, 0.2, 0.035); M.lathe('paint', [[0, -0.06], [0.06, 0.0], [0.065, 0.06], [0.03, 0.1], [0, 0.1]], 8); M.restore(); // barbe
  M.color([0.95, 0.75, 0.62]); M.save().move(0, 0.33, 0); M.geo('paint', new THREE.SphereGeometry(0.055, 10, 8)); M.restore();
  M.color([0.85, 0.15, 0.12]); M.save().move(0, 0.35, -0.01); M.lathe('paint', [[0.065, 0], [0.06, 0.04], [0.035, 0.1], [0.01, 0.15], [0, 0.16]], 10); M.restore(); // bonnet
  M.col(-0.12, 0.12, 0, 0.5, -0.12, 0.12, 'wood');
});
propType('fdNain', { pf: () => PF.fdNain(), shapes: [CYL(0, 0.25, 0, 0.12, 0.25)], com: [0, 0.18, 0], mass: 4, mu: 0.7, e: 0.2, resp: 3, blast: 8, hp: 15, mat: 'dirt', snd: 'clay', brk: 'clay', debris: [['shard', 5]] });

/* ---------- Chantier ---------- */
/* Bétonnière de chantier (prop physique, fdMixer) : châssis de tubes rouges en A sur deux roues et deux pieds, cuve orange inclinée sur sa
   fourche, moteur, volant de basculement ; roues vers +z */
PF.fdMixer = () => prefab('fdMixer', (M) => {
  M.local(1); M.color([0.75, 0.18, 0.12]);
  for (const sd of [-1, 1]) {
    M.tube('steel', 0.028, [[sd * 0.4, 0.22, 0.38], [sd * 0.26, 0.86, 0], [sd * 0.34, 0.02, -0.44]], 6); // flanc en A : de l'essieu au pied
    M.tube('steel', 0.022, [[sd * 0.4, 0.22, 0.38], [sd * 0.34, 0.12, -0.44]], 6); // traverse basse
    M.boxB('steel', sd * 0.34 - 0.05, sd * 0.34 + 0.05, 0, 0.03, -0.49, -0.39); // semelle du pied
    M.save().move(sd * 0.47, 0, 0.38); wheel(M, 0.22, 0.07, { side: sd, rim: [0.7, 0.2, 0.15] }); M.restore();
  }
  M.save().move(-0.42, 0.22, 0.38).rotZ(-Math.PI / 2); M.cyl('steel', 0.02, 0.84, 6); M.restore(); // essieu
  M.save().move(-0.27, 0.86, 0).rotZ(-Math.PI / 2); M.cyl('steel', 0.03, 0.54, 6); M.restore(); // axe de basculement
  M.color([0.3, 0.32, 0.34]); M.boxB('paint', 0.3, 0.46, 0.5, 0.74, -0.16, 0.12, { bevel: 0.02 }); // moteur
  M.color([0.2, 0.2, 0.2]); { const pts = []; for (let i = 0; i <= 16; i++) { const t = (i / 16) * TAU; pts.push([-0.36, 0.86 + Math.cos(t) * 0.16, Math.sin(t) * 0.16]); } M.tube('steel', 0.015, pts, 4); } // volant
  M.color([0.92, 0.5, 0.12]); M.save().move(0, 0.92, 0.04).rotX(-0.55); M.lathe('paint', [[0, -0.32], [0.3, -0.28], [0.4, 0.0], [0.36, 0.3], [0.2, 0.56], [0.16, 0.6]], 16);
  M.color([0.35, 0.33, 0.3]); M.lathe('paint', [[0.145, 0.6], [0.18, 0.55], [0.34, 0.3], [0.38, 0.0], [0.28, -0.27], [0, -0.3]], 16); M.restore(); // intérieur de la cuve (profil inverse) : on ne voit pas au travers par la bouche
  M.color([0.55, 0.55, 0.55]); M.save().move(0, 0.92, 0.04).rotX(-0.55).move(0, -0.02, 0); M.cyl('steel', 0.41, 0.05, 16); M.restore(); // couronne
  M.col(-0.5, 0.5, 0, 1.4, -0.5, 0.6, 'metal');
});
propType('fdMixer', { pf: () => PF.fdMixer(), shapes: [BOX(0, 0.7, 0.05, 0.48, 0.7, 0.55)], com: [0, 0.6, 0.05],
  contact: [[-0.5, 0, 0.38], [0.5, 0, 0.38], [-0.34, 0, -0.44], [0.34, 0, -0.44], [0, 1.45, 0.3], [0.4, 1.2, 0.4], [-0.4, 1.2, 0.4], [0.45, 0.6, -0.2], [-0.45, 0.6, -0.2]],
  mass: 80, mu: 0.75, e: 0.1, rr: 3, resp: 1.2, blast: 4, hold: 60, mat: 'metal', snd: 'metal' });
/* Brouette de chantier (prop physique, fdBrouette) : bac de tôle galvanisée évasé et ouvert, un peu de sable dedans, brancards de tube posés
   sur la roue (devant, +z) et sur deux pieds à l'arrière, poignées noires */
PF.fdBrouette = () => prefab('fdBrouette', (M) => {
  M.local(1);
  // bac : fond et quatre parois évasées, tôle vue des deux côtés
  const B = [[-0.2, 0.38, -0.18], [0.2, 0.38, -0.18], [0.2, 0.38, 0.3], [-0.2, 0.38, 0.3]], T = [[-0.34, 0.66, -0.34], [0.34, 0.66, -0.34], [0.34, 0.66, 0.52], [-0.34, 0.66, 0.52]];
  const face = (a, b, c, d) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
    for (const k of [1, -1]) M.quad('steel', a, b, c, d, n.map((x) => (k * x) / l));
  };
  M.color([0.62, 0.64, 0.66]);
  face(B[0], B[1], B[2], B[3]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face(B[i], B[j], T[j], T[i]); }
  M.color([0.5, 0.52, 0.54]); for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; M.tube('steel', 0.015, [T[i], T[j]], 4); } // bord roulé
  M.color([0.72, 0.62, 0.46]); M.save().move(0, 0.44, 0.07).scl(1, 1, 1.5); M.lathe('dirt', [[0, 0.14], [0.12, 0.12], [0.22, 0.05], [0.26, 0]], 10); M.restore(); // sable
  // brancards et pieds (tube vert), roue
  M.color([0.2, 0.4, 0.28]);
  for (const sd of [-1, 1]) {
    M.tube('steel', 0.022, [[sd * 0.3, 0.58, -1.05], [sd * 0.22, 0.37, -0.3], [sd * 0.08, 0.22, 0.62]], 6);
    M.tube('steel', 0.02, [[sd * 0.22, 0.37, -0.28], [sd * 0.26, 0.02, -0.36]], 5);
    M.boxB('steel', sd * 0.26 - 0.03, sd * 0.26 + 0.03, 0, 0.03, -0.42, -0.3);
  }
  M.color([0.08, 0.08, 0.08]); for (const sd of [-1, 1]) { M.save().move(sd * 0.3, 0.58, -1.05).rotX(-0.27).move(0, 0, 0); M.save().rotX(Math.PI / 2); M.cyl('rubber', 0.03, 0.16, 6); M.restore(); M.restore(); } // poignées
  M.color([0.12, 0.12, 0.12]); M.save().move(0.045, 0.2, 0.62).rotZ(Math.PI / 2); M.cyl('rubber', 0.2, 0.09, 12); M.restore();
  M.color([0.7, 0.7, 0.7]); M.save().move(0.06, 0.2, 0.62).rotZ(Math.PI / 2); M.cyl('steel', 0.07, 0.12, 8); M.restore(); // moyeu
  M.col(-0.36, 0.36, 0, 0.7, -1.05, 0.82, 'metal');
});
propType('fdBrouette', { pf: () => PF.fdBrouette(), shapes: [BOX(0, 0.35, -0.12, 0.35, 0.35, 0.93)], com: [0, 0.42, 0.05],
  contact: [[0, 0, 0.62], [-0.26, 0, -0.36], [0.26, 0, -0.36], [-0.34, 0.66, -0.34], [0.34, 0.66, -0.34], [-0.34, 0.66, 0.52], [0.34, 0.66, 0.52], [-0.3, 0.58, -1.05], [0.3, 0.58, -1.05], [0, 0.4, 0.82]],
  mass: 30, mu: 0.6, e: 0.15, rr: 3, resp: 1.6, blast: 5, hold: 25, mat: 'metal', snd: 'metal' });
/* Palette de parpaings filmée (1,2 x 1,0, 1 m) */
PF.fdBlockPallet = () => prefab('fdBlockPallet', (M) => {
  M.local(1); M.color([0.62, 0.5, 0.36]); M.boxB('wood', -0.6, 0.6, 0, 0.13, -0.5, 0.5);
  M.color([0.85, 0.84, 0.8]); M.world(1); M.boxB('parpaing', -0.58, 0.58, 0.13, 0.98, -0.48, 0.48);
  M.col(-0.6, 0.6, 0, 0.98, -0.5, 0.5, 'concrete');
});
/* Benne de chantier (3,6 x 1,8) : tôle jaune, côtés évasés, gravats */
PF.fdSkip = () => prefab('fdSkip', (M) => {
  M.local(1); M.color([0.88, 0.66, 0.12]);
  // parois évasées, tôle vue des deux côtés (faces extérieures, puis intérieures)
  for (const k of [1, -1]) {
    for (const sz of [-1, 1]) M.quad('paint', [-1.8, 0.05, sz * 0.75], [1.8, 0.05, sz * 0.75], [2.0, 1.4, sz * 0.9], [-2.0, 1.4, sz * 0.9], [0, 0.1 * k, sz * k]);
    for (const sx of [-1, 1]) M.quad('paint', [sx * 1.8, 0.05, -0.75], [sx * 1.8, 0.05, 0.75], [sx * 2.0, 1.4, 0.9], [sx * 2.0, 1.4, -0.9], [sx * k, 0.15 * k, 0]);
  }
  for (const sz of [-1, 1]) M.boxB('paint', -2.02, 2.02, 1.36, 1.44, sz * 0.9 - 0.04, sz * 0.9 + 0.04); // rebord
  M.boxB('paint', -1.8, 1.8, 0, 0.08, -0.75, 0.75);
  M.color([0.5, 0.48, 0.44]); M.boxB('rubble', -1.85, 1.85, 0.9, 1.0, -0.8, 0.8, { bevel: 0.2 });
  M.color([0.62, 0.6, 0.55]); const R = rngOf(611); M.cls = 1;
  for (let i = 0; i < 26; i++) { const s = R.range(0.12, 0.32); M.save().move(R.range(-1.6, 1.6), 0.95 + R() * 0.2, R.range(-0.6, 0.6)).rotY(R() * TAU).rotX(R() - 0.5); M.box(R() < 0.5 ? 'parpaing' : 'concrete', s * 1.6, s, s); M.restore(); }
  M.cls = 0;
  M.col(-1.95, 1.95, 0, 1.4, -0.85, 0.85, 'metal');
});
/* Barrière de chantier (grillage galvanisé de 3,5 m sur plots de béton) de (xa, za) à (xb, zb) : arrête les soldats, ni les tirs ni la vue */
function fdHeras(xa, za, xb, zb) {
  const M = DECOR, L = hyp(xb - xa, zb - za), n = Math.max(1, Math.round(L / 3.5)), ux = (xb - xa) / L, uz = (zb - za) / L;
  M.save().color([0.45, 0.46, 0.47]); M.cls = 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * L, b = ((i + 1) / n) * L, p = (t, y) => [xa + ux * t, y, za + uz * t];
    M.quad('lattice', p(a, 0.15), p(b, 0.15), p(b, 2.0), p(a, 2.0), [uz, 0, -ux]); // panneaux jointifs : pas de jour entre deux
    M.tube('steel', 0.02, [p(a + 0.02, 0.12), p(a + 0.02, 2.02), p(b - 0.02, 2.02), p(b - 0.02, 0.12), p(a + 0.02, 0.12)], 5);
  }
  M.cls = 0; M.color([0.6, 0.6, 0.58]).local(1);
  for (let i = 0; i <= n; i++) { const t = (i / n) * L; M.save().move(xa + ux * t, 0, za + uz * t).rotY(Math.atan2(ux, uz)); M.boxB('concrete', -0.1, 0.1, 0, 0.14, -0.35, 0.35, { bevel: 0.02 }); M.restore(); }
  M.restore();
  const x0 = Math.min(xa, xb) - (Math.abs(uz) > 0.5 ? 0.06 : 0), x1 = Math.max(xa, xb) + (Math.abs(uz) > 0.5 ? 0.06 : 0), z0 = Math.min(za, zb) - (Math.abs(ux) > 0.5 ? 0.06 : 0), z1 = Math.max(za, zb) + (Math.abs(ux) > 0.5 ? 0.06 : 0);
  COL.push({ x0, x1, y0: 0, y1: 2.0, z0, z1, m: 'metal', ray: false, noRay: true });
}
/* Matières propres au lotissement (en plus de celles de la flore : haies, verre clair) */
function makeFdMaterials(M) {
  makeFloraMaterials(M);
  M('slate', { tex: 'slate', env: 0.7, macro: 0.3, grime: 0.3 });
  // crépi des pavillons (l'enduit photographié, peu sali : des maisons de quelques années) ; peinture lisse de la maison témoin, neuve
  M('crepi', { tex: 'plaster', grime: 0.45, streak: 0.35, dust: 0.35, macro: 0.3, relief: 0.25 });
  M('peinture', { tex: 'plaster', grime: 0.05, streak: 0, dust: 0.05, macro: 0.12, relief: 0.08 });
  M('parpaing', { tex: 'parpaing', grime: 0.6, streak: 0.5, dust: 0.6, macro: 0.3 });
  M('signs5', { tex: 'signs5', rough: 0.5, env: 0.5, macro: 0.05, scale: 1, noNormal: true });
}
function fdKit() { floraKit(); TEX.signs5 = fdSignAtlas(); }
