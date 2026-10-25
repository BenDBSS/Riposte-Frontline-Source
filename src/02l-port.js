/* ==========================================================================
   KIT PORTUAIRE : tout ce qu'il faut pour un port de pêche, réutilisable d'une carte à l'autre (Kervénec).
   - Surfaces procédurales : coque peinte (traînées de rouille, ligne de flottaison, salissures), filet de pêche
     (mailles découpées), glace pilée, caillebotis d'acier ; reprises du kit d'hiver : roche, bardage, rouille, ardoise.
   - Atlas dessinés : enseignes peintes et émaillées (Criée, Café de la Marine, Fabrique de glace...), décalques
     (noms et immatriculations des bateaux, cadran des ventes, ardoises de prix, affiches, flaques, taches).
   - Prefabs : chalutiers et caseyeur, canots, voiliers au mouillage, bittes d'amarrage, défenses, bouées, filets,
     casiers, bacs à poisson, étals de criée, palettes de glace, grue de quai, portique, camion frigorifique, phare...
   Tout se construit au chargement de la carte et se libère avec elle.
   ========================================================================== */
Object.assign(TEXLAB, {
  /* coque d'acier peinte (teintée par les sommets) : tôles soudées, traînées de rouille sous les dalots, rayures des
     défenses, crasse vers la flottaison ; alpha = masque de métal (peinture écaillée) */
  hull: [512, 85, 1.4, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(12.0), 4, 2.0), fine = vn(uv * 256.0, vec2(256.0), 3.0);
    float plate = 1.0 - smoothstep(0.0, 0.004, min(abs(fract(uv.x * 3.0) - 0.5) - 0.496, 1.0)) ;
    float seam = max(1.0 - smoothstep(0.0, 0.006, abs(fract(uv.x * 3.0)) ), 1.0 - smoothstep(0.0, 0.006, abs(fract(uv.y * 2.0))));
    float st = gfbm(vec2(uv.x, uv.y * 0.15), vec2(28.0, 1.0), 4, 9.0);
    float rust = smoothstep(0.66, 0.82, st + uv.y * 0.12 + (big - 0.5) * 0.2) * 0.8 + smoothstep(0.8, 0.92, gfbm(uv, vec2(9.0), 5, 4.0)) * 0.6;
    float scuff = smoothstep(0.93, 0.99, ridge(vec2(uv.x * 0.3, uv.y), vec2(2.0, 18.0), 3, 7.0)) * step(0.5, big);
    float chip = smoothstep(0.78, 0.8, gfbm(uv, vec2(22.0), 4, 3.0) + (big - 0.5) * 0.1);
    h = mid * 0.05 - chip * 0.25 - seam * 0.2 + rust * 0.08;
    a = vec3(0.86) * (0.92 + big * 0.1 + fine * 0.04);
    a = mix(a, srgb(vec3(0.5, 0.26, 0.12)), clamp(rust, 0.0, 1.0) * 0.75);
    a = mix(a, srgb(vec3(0.42, 0.38, 0.34)), chip * 0.7); a = mix(a, vec3(0.55), scuff * 0.5);
    r = mix(0.45 + big * 0.1, 0.85, max(chip, rust)); x = (1.0 - chip) * 0.3;`],
  /* filet de pêche : mailles en losange (alpha = opacité), fil de nylon vert ou bleu teinté par les sommets */
  net: [256, 87, 1.2, `
    vec2 q = vec2(uv.x + uv.y, uv.x - uv.y) * 12.0; vec2 f = abs(fract(q) - 0.5);
    float th = 0.43 + gfbm(uv, vec2(8.0), 3, 2.0) * 0.04, knot = 1.0 - smoothstep(0.08, 0.14, length(fract(q) - 0.5) - 0.32);
    float m = max(smoothstep(th, th + 0.03, max(f.x, f.y)), knot * 0.0);
    h = m; a = vec3(0.9) * (0.85 + gfbm(uv, vec2(16.0), 3, 3.0) * 0.25); r = 0.7; x = m;`],
  /* glace pilée des étals : éclats translucides, brillances */
  crushedice: [512, 89, 2.2, `
    vec4 v = vor(uv, vec2(48.0), 4.0, 1.0), v2 = vor(uv + 0.3, vec2(96.0), 5.0, 1.0);
    float big = gfbm(uv, vec2(4.0), 4, 1.0);
    h = (1.0 - v.x) * 0.6 + (1.0 - v2.x) * 0.3 + big * 0.1;
    a = srgb(vec3(0.82, 0.88, 0.92)) * (0.8 + v.z * 0.2 + (1.0 - smoothstep(0.0, 0.06, v.w)) * 0.15);
    r = 0.12 + v2.z * 0.15; x = h;`],
  /* caillebotis d'acier (passerelles) : grille de plats soudés, alpha = opacité */
  grating: [256, 91, 1.4, `
    vec2 f = fract(uv * vec2(16.0, 5.0)); float bar = max(1.0 - smoothstep(0.08, 0.16, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.04, 0.09, min(f.y, 1.0 - f.y)));
    h = bar; a = srgb(vec3(0.45, 0.46, 0.46)) * (0.8 + gfbm(uv, vec2(8.0), 3, 2.0) * 0.3); r = 0.55; x = bar;`],
});
Object.assign(TEXSCALE, { hull: 4.0, net: 1.2, crushedice: 0.9, grating: 1.0 });
for (const k of ['hull', 'net', 'crushedice', 'grating']) OPT_TEX.add(k);
/* Surfaces procédurales qu'une carte portuaire demande (à mettre dans surfaces de sa définition) */
const PORT_SURFACES = ['hull', 'net', 'crushedice', 'grating', 'ripple', 'rock', 'boards', 'rust', 'slate'];

/* ---------- Matières ---------- */
function makePortMaterials(M) {
  M('rock', { tex: 'rock', grime: 0.4, macro: 0.5, dust: 0.1, pom: 0.03 });
  M('boards', { tex: 'boards', grime: 0.9, streak: 0.5, macro: 0.25 });
  M('rust', { tex: 'rust', metal: 0.75, ma: true, env: 0.55, macro: 0.25, grime: 0.6, streak: 0.4 });
  M('slate', { tex: 'slate', env: 0.7, macro: 0.3, grime: 0.3 });
  M('hull', { tex: 'hull', metal: 0.25, ma: true, env: 0.8, macro: 0.2, grime: 0.6, streak: 0.5 });
  M('net', { tex: 'net', cut: 0.5, rough: 0.8, env: 0.3, macro: 0.2 });
  M('crushedice', { tex: 'crushedice', env: 1.4, macro: 0.05 });
  M('grating', { tex: 'grating', cut: 0.5, metal: 0.7, env: 0.8, macro: 0.15 });
  // pierre mouillée et algues au pied des quais : sombre, presque lisse
  M('wetstone', { tex: 'ashlar', rough: 0.45, env: 0.9, macro: 0.4, grime: 0, dust: 0 });
  // écailles et chair des poissons (teintées par les sommets), brillantes
  M('fish', { tex: 'plastic', rough: 0.3, metal: 0.35, env: 1.3, macro: 0.05 });
  // sol de la criée : résine lavée à grande eau, encore humide
  M('resin', { tex: 'concrete', rough: 0.32, env: 1.0, macro: 0.45, grime: 0, dust: 0 });
  M('glassLit', { tex: 'glass', metal: 0.4, ma: true, env: 0.9, macro: 0.1, emissive: [0.95, 0.58, 0.28], polyOff: -2 });
  MAT.bulb = new THREE.MeshBasicMaterial({ vertexColors: true }); MAT.bulb.userData.noShadow = true;
  M('signs3', { tex: 'signs3', rough: 0.45, env: 0.6, macro: 0.05, scale: 1, noNormal: true });
  M('decals3', { tex: 'decals3', rough: 0.75, env: 0.35, macro: 0.15, scale: 1, noNormal: true, polyOff: -4 });
  Object.assign(MAT.decals3, { transparent: true, depthWrite: false }); MAT.decals3.defines.WM_CUT = ''; MAT.decals3.side = THREE.FrontSide;
  MAT.decals3.userData.noShadow = true;
  // écran à diodes du cadran des ventes : lumineux, sans éclairage
  MAT.screen = new THREE.MeshBasicMaterial({ map: TEX.decals3.map, color: new THREE.Color(1.8, 1.8, 1.8) }); MAT.screen.userData.noShadow = true;
}

/* ---------- Atlas dessinés ---------- */
/* Enseignes du port (1024², 8 panneaux de 512 x 256) */
const SIGNS3 = { criee: 0, marine: 1, glace: 2, mareyage: 3, coop: 4, capitainerie: 5, poissonnerie: 6, ventes: 7 };
function portSignAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), R = rngOf(97);
  const P = [
    ['#f2efe6', '#1d3a63', 'CRIÉE\nDE KERVÉNEC', 'Arial, sans-serif', 78, '#1d3a63'],
    ['#1d3a63', '#f3e9d2', 'CAFÉ DE LA MARINE', 'Georgia, serif', 56, '#e9c46a'],
    ['#2e6f8e', '#f4f4ee', 'FABRIQUE\nDE GLACE', 'Arial, sans-serif', 76, '#f4f4ee'],
    ['#efe9da', '#8c2f22', 'MAREYAGE\nEXPÉDITIONS', 'Arial, sans-serif', 62, '#8c2f22'],
    ['#2f5b3f', '#f1ead6', 'COOPÉRATIVE\nMARITIME', 'Georgia, serif', 64, '#f1ead6'],
    ['#f4f2ec', '#1d3a63', 'CAPITAINERIE', 'Arial, sans-serif', 74, '#b3261e'],
    ['#9a2b20', '#f6efdf', 'POISSONNERIE', 'Georgia, serif', 70, '#f6efdf'],
    ['#f6d64a', '#1a1a1a', 'SALLE DES VENTES\nACHETEURS AGRÉÉS', 'Arial, sans-serif', 46, '#1a1a1a'],
  ];
  P.forEach(([bg, fg, txt, font, size, border], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
    g.fillStyle = bg; g.fillRect(x, y, 512, 256);
    g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(x + 14, y + 14, 484, 228);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    // corps réduit si la police de la machine est plus large : le texte tient toujours dans le cadre
    const lines = txt.split('\n'); g.font = `bold ${size}px ${font}`;
    const fs = Math.min(size, (size * 440) / Math.max(...lines.map((l) => g.measureText(l).width)));
    g.font = `bold ${fs}px ${font}`;
    lines.forEach((l, k) => g.fillText(l, x + 256, y + 132 + (k - (lines.length - 1) / 2) * fs * 1.12));
    // embruns : rouille aux fixations, sel et salissures
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '110,58,30' : '40,30,22'},${0.25 + R() * 0.5})`; const ex = x + (R() < 0.5 ? 8 + R() * 28 : 476 + R() * 28), ey = y + (R() < 0.5 ? 8 + R() * 28 : 220 + R() * 28); g.beginPath(); g.arc(ex, ey, 2 + R() * 6, 0, TAU); g.fill(); }
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '255,255,250' : '40,35,30'},${R() * 0.08})`; g.fillRect(x + R() * 512, y + R() * 256, 1 + R() * 4, 1 + R() * 3); }
    const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(40,45,50,0.22)'); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
  });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
function sign3UV(i) { return [(i % 2) * 0.5, Math.floor(i / 2) * 0.25, 0.5, 0.25]; }
/* Enseigne du port posée à plat (repère de façade), avec son cadre */
function sign3Board(M, xc, y, w, h, idx, frame = [0.3, 0.3, 0.3]) {
  const [u0, v0, du, dv] = sign3UV(idx), B = M.buf('signs3', xc, y, 0.05), z = 0.06;
  M.save().color([1, 1, 1]);
  const a = M.v(B, xc - w / 2, y, z, 0, 0, 1, u0, v0 + dv), b = M.v(B, xc + w / 2, y, z, 0, 0, 1, u0 + du, v0 + dv);
  const c = M.v(B, xc + w / 2, y + h, z, 0, 0, 1, u0 + du, v0), d = M.v(B, xc - w / 2, y + h, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d);
  if (frame) { M.color(frame).local(1); lbox(M, 'paint', xc - w / 2 - 0.03, xc + w / 2 + 0.03, y - 0.03, y + h + 0.03, 0, z - 0.002); }
  M.restore();
}
/* Décalques du port (1024², grille 4 x 4, alpha) : 0 à 3 noms et immatriculations des bateaux, 4 cadran des ventes,
   5 ardoise des prix, 6 et 7 affiches, 8 coulure de rouille, 9 flaque, 10 tache d'huile, 11 écailles et sang de poisson,
   12 « accès interdit », 13 numéros de lots, 14 horaires des marées, 15 graffiti */
const DEC3 = { boat0: 0, boat1: 1, boat2: 2, boat3: 3, cadran: 4, prix: 5, poster: 6, poster2: 7, rust: 8, puddle: 9, oil: 10, scales: 11, interdit: 12, lots: 13, marees: 14, tag: 15 };
const BOATS = [['AR MOR', 'GV 913425'], ['STEREDENN', 'CC 832107'], ['BUGALE MOR', 'GV 905118'], ['GWENOLA', 'AD 771304']];
function portDecalAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(7531), T = S / 4;
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  const wear = (n, a) => { g.globalCompositeOperation = 'destination-out'; for (let j = 0; j < n; j++) { g.fillStyle = `rgba(0,0,0,${R() * a})`; g.fillRect(R() * T, R() * T, 2 + R() * 4, 1 + R() * 3); } g.globalCompositeOperation = 'source-over'; };
  BOATS.forEach(([name, reg], k) => cell(k, () => {
    // nom en capitales sur la moitié haute, immatriculation dessous (proportions d'un panneau 4 x 1)
    g.fillStyle = 'rgba(246,244,236,0.95)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${name.length > 8 ? 30 : 38}px Arial, sans-serif`; g.fillText(name, T / 2, 30, T - 16);
    g.font = 'bold 26px Arial, sans-serif'; g.fillText(reg, T / 2, 62, T - 16);
    wear(140, 0.6);
  }));
  cell(4, () => {
    g.fillStyle = '#0c0d10'; g.fillRect(8, 8, T - 16, T - 16); g.strokeStyle = '#555'; g.lineWidth = 4; g.strokeRect(10, 10, T - 20, T - 20);
    g.fillStyle = '#ff3a22'; g.font = 'bold 58px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('12,40', T / 2, 92);
    g.fillStyle = '#ffb21e'; g.font = 'bold 22px "Courier New", monospace'; g.fillText('LOT 0347  BAR', T / 2, 140); g.fillText('48 KG  EXTRA', T / 2, 170);
    g.fillStyle = '#4ad14a'; g.fillText('ACHETEUR 112', T / 2, 210);
    for (let j = 0; j < 40; j++) { const a = (j / 40) * TAU; g.fillStyle = j < 26 ? '#ff3a22' : '#3a1410'; g.fillRect(T / 2 + Math.cos(a) * 110 - 2, 128 + Math.sin(a) * 110 - 2, 4, 4); }
  });
  cell(5, () => {
    g.fillStyle = '#1b1d1c'; g.fillRect(20, 14, T - 40, T - 28); g.strokeStyle = '#6b4a2c'; g.lineWidth = 10; g.strokeRect(20, 14, T - 40, T - 28);
    g.fillStyle = 'rgba(240,240,232,0.9)'; g.font = 'italic bold 24px Georgia, serif'; g.textAlign = 'left';
    [['Bar de ligne', '24,50'], ['Lieu jaune', '9,80'], ['Sole', '19,00'], ['Langoustines', '22,00'], ['Maquereau', '4,20'], ['Saint-Pierre', '16,90']].forEach(([n, p], j) => { g.fillText(n, 36, 52 + j * 32); g.textAlign = 'right'; g.fillText(p, T - 36, 52 + j * 32); g.textAlign = 'left'; });
    wear(200, 0.4);
  });
  [['#1d4e89', '#f6f1e3', 'FÊTE\nDE LA MER', 'Kervénec · 14 août'], ['#c0392b', '#f7ecd0', 'PARDON\nDES MARINS', 'Bénédiction des bateaux']].forEach(([bg, fg, title, sub], k) => cell(6 + k, () => {
    const x = 40 + R() * 8, y = 18, w = T - 80, h = T - 36;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = fg; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center';
    title.split('\n').forEach((l, j) => g.fillText(l, x + w / 2, y + 52 + j * 34));
    g.font = 'italic 16px Georgia, serif'; g.fillText(sub, x + w / 2, y + h - 22);
    // voilier stylisé
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.beginPath(); g.moveTo(x + w / 2, y + 112); g.lineTo(x + w / 2, y + h - 62); g.lineTo(x + w / 2 + 50, y + h - 62); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + w / 2 - 4, y + 124); g.lineTo(x + w / 2 - 4, y + h - 62); g.lineTo(x + w / 2 - 40, y + h - 62); g.closePath(); g.fill();
    g.fillRect(x + w / 2 - 55, y + h - 56, 110, 10);
    wear(120, 0.7);
  }));
  cell(8, () => { const gr = g.createLinearGradient(0, 0, 0, T); gr.addColorStop(0, 'rgba(112,50,20,0.65)'); gr.addColorStop(1, 'rgba(112,50,20,0)'); g.fillStyle = gr; for (let j = 0; j < 14; j++) { const x = T * 0.15 + R() * T * 0.7, w = 3 + R() * 12; g.fillRect(x, 0, w, T * (0.25 + R() * 0.75)); } });
  cell(9, () => { for (let j = 0; j < 16; j++) { const x = T / 2 + (R() - 0.5) * 100, y = T / 2 + (R() - 0.5) * 80, rr = 30 + R() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(28,30,32,0.5)'); gr.addColorStop(0.75, 'rgba(28,30,32,0.3)'); gr.addColorStop(1, 'rgba(28,30,32,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); } });
  cell(10, () => { for (let j = 0; j < 30; j++) { const x = T / 2 + (R() - 0.5) * 120, y = T / 2 + (R() - 0.5) * 90, rr = 20 + R() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(12,10,9,0.32)'); gr.addColorStop(1, 'rgba(12,10,9,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); } });
  cell(11, () => {
    for (let j = 0; j < 18; j++) { const x = T / 2 + (R() - 0.5) * 140, y = T / 2 + (R() - 0.5) * 120, rr = 12 + R() * 34, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(120,30,28,0.35)'); gr.addColorStop(1, 'rgba(120,30,28,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); }
    for (let j = 0; j < 160; j++) { g.fillStyle = `rgba(${200 + R() * 55},${200 + R() * 55},${210 + R() * 45},${0.5 + R() * 0.4})`; g.beginPath(); g.ellipse(30 + R() * (T - 60), 30 + R() * (T - 60), 2 + R() * 2, 1.5 + R(), R() * 3, 0, TAU); g.fill(); }
  });
  cell(12, () => {
    g.fillStyle = '#f4f2ec'; g.fillRect(18, 50, T - 36, T - 100); g.strokeStyle = '#b3261e'; g.lineWidth = 8; g.strokeRect(22, 54, T - 44, T - 108);
    g.fillStyle = '#b3261e'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('ACCÈS', T / 2, 110); g.fillText('INTERDIT', T / 2, 146);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 16px Arial, sans-serif'; g.fillText('AU PUBLIC', T / 2, 178); g.fillText('ZONE PORTUAIRE', T / 2, 198);
  });
  cell(13, () => { g.fillStyle = 'rgba(245,245,240,0.92)'; g.font = 'bold 54px Arial, sans-serif'; g.textAlign = 'center'; for (let j = 0; j < 4; j++) g.fillText(String(11 + j * 7), (j % 2) * T / 2 + T / 4, Math.floor(j / 2) * T / 2 + T / 4 + 20); wear(120, 0.6); });
  cell(14, () => {
    g.fillStyle = '#f2efe6'; g.fillRect(16, 16, T - 32, T - 32); g.strokeStyle = '#1d3a63'; g.lineWidth = 5; g.strokeRect(18, 18, T - 36, T - 36);
    g.fillStyle = '#1d3a63'; g.font = 'bold 20px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('HORAIRES DES MARÉES', T / 2, 46);
    g.font = '16px Arial, sans-serif'; g.textAlign = 'left';
    [['PM', '06 h 42', '5,80 m'], ['BM', '12 h 58', '0,95 m'], ['PM', '19 h 07', '5,95 m'], ['BM', '01 h 20', '1,10 m']].forEach(([k, h, m], j) => { g.fillText(k, 34, 86 + j * 36); g.fillText(h, 84, 86 + j * 36); g.fillText(m, 170, 86 + j * 36); });
    g.fillStyle = '#b3261e'; g.font = 'bold 15px Arial, sans-serif'; g.fillText('COEF. 98 · GRANDE MARÉE', 34, 232);
  });
  cell(15, () => { g.lineCap = 'round'; g.strokeStyle = '#13233d'; g.lineWidth = 9; g.font = 'bold 66px Arial, sans-serif'; g.fillStyle = '#f2c230'; g.save(); g.translate(T / 2, T / 2 + 12); g.rotate(-0.1); g.textAlign = 'center'; g.strokeText('BZH', 0, 0); g.fillText('BZH', 0, 0); g.restore(); });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Décalque du port i (quart de case : u0, v0, du, dv dans la case) sur un quadrilatère du repère courant */
function decal3Quad(M, i, p0, p1, p2, p3, n, sub = [0, 0, 1, 1], mat = 'decals3') {
  const u0 = (i % 4) * 0.25 + sub[0] * 0.25, v0 = Math.floor(i / 4) * 0.25 + sub[1] * 0.25, du = sub[2] * 0.25, dv = sub[3] * 0.25;
  const B = M.buf(mat, (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2);
  M.save(); M.cls = 1;
  const ids = [[p0, u0, v0 + dv], [p1, u0 + du, v0 + dv], [p2, u0 + du, v0], [p3, u0, v0]].map(([p, u, v]) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], u, v));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
function wallDecal3(M, i, xc, y, w, h, z = 0.008, sub) { decal3Quad(M, i, [xc - w / 2, y, z], [xc + w / 2, y, z], [xc + w / 2, y + h, z], [xc - w / 2, y + h, z], [0, 0, 1], sub); }
function groundDecal3(i, x, z, w, d, rot = 0, y = 0.014) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (a, b) => [x + a * c - b * s, y, z + a * s + b * c];
  decal3Quad(DECOR, i, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), [0, 1, 0]);
}
/* Flaque : nappe d'eau mince au sol, bord fondu, avec le rendu de l'eau de la mer (pondAdd, 02m-water.js) ; l'ancienne flaque dessinée
   (DEC3.puddle) n'est plus posée */
function puddleAdd(x, z, w, d, rot = 0, seed = 1, y = 0.022) {
  return pondAdd({ shape: 'blob', x, y, z, w, d, rot, seed, seg: 20, rings: 4, alpha: 0.88, depth: 0.3, foam: 0, deep: [0.016, 0.026, 0.03], shallow: [0.03, 0.05, 0.055], scatter: [0.01, 0.03, 0.03], tone: 1 });
}
/* Atlas de la carte portuaire (appelé par buildTextures) */
function portKit() { TEX.signs3 = portSignAtlas(); TEX.decals3 = portDecalAtlas(); }

/* ---------- Bateaux ---------- */
/* Gabarit d'une coque : stations [t (0 arrière, 1 étrave), demi-largeur au livet (part de la largeur), livet, fin du
   bordé droit, quille, rondeur du bouchain (exposant de superellipse)] ; hauteurs en mètres au-dessus de la flottaison */
const HULL_TRAWLER = [
  [0.0, 0.88, 3.05, 0.55, -0.55, 5], [0.05, 0.95, 2.95, 0.42, -1.45, 4.2], [0.18, 1.0, 2.86, 0.32, -2.05, 3.4], [0.5, 1.0, 2.84, 0.3, -2.25, 3.0],
  [0.68, 0.97, 2.92, 0.35, -2.2, 2.7], [0.8, 0.86, 3.12, 0.5, -2.0, 2.3], [0.89, 0.64, 3.38, 0.78, -1.62, 1.9], [0.955, 0.36, 3.62, 1.15, -1.0, 1.6], [1.0, 0.04, 3.82, 1.75, 0.15, 1.4],
];
const HULL_CANOT = [
  [0.0, 0.82, 0.62, 0.25, -0.22, 5], [0.1, 0.92, 0.6, 0.2, -0.38, 3.6], [0.45, 1.0, 0.62, 0.18, -0.45, 3.0], [0.7, 0.9, 0.7, 0.24, -0.42, 2.4],
  [0.86, 0.62, 0.82, 0.35, -0.3, 1.9], [0.95, 0.3, 0.92, 0.5, -0.12, 1.6], [1.0, 0.04, 0.98, 0.75, 0.15, 1.4],
];
/* Section de la coque à t (interpolée entre les stations) */
function hullAt(T, t, hw0) {
  let i = 0; while (i < T.length - 2 && t > T[i + 1][0]) i++;
  const a = T[i], b = T[i + 1], k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1), m = k * k * (3 - 2 * k);
  return { hw: lerp(a[1], b[1], m) * hw0, yd: lerp(a[2], b[2], m), yw: lerp(a[3], b[3], m), yk: lerp(a[4], b[4], m), n: lerp(a[5], b[5], m) };
}
/* Point du contour de la section : u de 0 (livet bâbord) à 1 (livet tribord) en passant par la quille */
function hullPoint(s, u) {
  const uS = 0.16;
  if (u < uS) return [-s.hw, lerp(s.yd, s.yw, u / uS)];
  if (u > 1 - uS) return [s.hw, lerp(s.yw, s.yd, (u - 1 + uS) / uS)];
  const a = Math.PI + ((u - uS) / (1 - 2 * uS)) * Math.PI, c = Math.cos(a), sn = Math.sin(a), ex = 2 / s.n;
  return [Math.sign(c) * Math.pow(Math.abs(c), ex) * s.hw, s.yw + Math.pow(Math.abs(sn), ex) * (s.yk - s.yw)];
}
/* Coque, pavois, pont et lisses. o : L, B, deck (hauteur du pont), hull (teinte), inner (teinte du pavois), deckTint,
   stripe (liston), boot (bande de flottaison), gaps (coupées, ouvertes dans le pavois et sans collision :
   [côté -1 ou 1, t0, t1] ; [0, x0, x1] dans le tableau arrière), noCol. Une coupée de chaque côté jusqu'à t = 1 ouvre
   l'étrave. Renvoie les fonctions utiles au reste du bateau (z(t), sections, demi-largeur au pont). */
function hullBody(M, T, o) {
  const L = o.L, hw0 = o.B / 2, Dk = o.deck, z = (t) => (t - 0.5) * L, th = o.thick || 0.1, nv = o.nv || 26, gaps = o.gaps || [];
  const S = (t) => hullAt(T, t, hw0), inner = (t) => Math.max(0.02, S(t).hw - th);
  // intervalles de pavois (t) d'un côté, coupées retirées
  const runs = (sd) => {
    let r = [[0, 1]];
    for (const g of gaps) if (g[0] === sd) r = r.flatMap(([a, b]) => (g[2] <= a || g[1] >= b ? [[a, b]] : [[a, g[1]], [g[2], b]].filter(([p, q]) => q - p > 1e-3)));
    return r;
  };
  const bowOpen = gaps.some((g) => g[0] === 1 && g[2] >= 0.99) && gaps.some((g) => g[0] === -1 && g[2] >= 0.99);
  const stern = gaps.find((g) => g[0] === 0);
  M.save().local(1);
  // bordé extérieur sous le pont (le pavois est à part, pour les coupées)
  M.color(o.hull); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(-0.2, 1.4, y));
  const low = (t) => { const s = S(t); return { ...s, yd: Math.min(s.yd, Dk) }; };
  M.surf('hull', 18, nv, (u, v) => { const p = hullPoint(low(v), u); return [p[0], p[1], z(v)]; }, { uL: o.B * 1.6, vL: L });
  M.aoFn = null;
  // tableau arrière : le contour de la section arrière jusqu'au pont, fermé en éventail
  { const s0 = low(0), ring = []; for (let i = 0; i <= 18; i++) { const p = hullPoint(s0, i / 18); ring.push([p[0], p[1], z(0)]); }
    const c = [0, (Dk + s0.yk) / 2, z(0)]; for (let i = 0; i <= 18; i++) M.tri3('hull', c, ring[(i + 1) % 19], ring[i], [0, 0, -1]); }
  // pavois : peau extérieure (couleur de la coque), peau intérieure, lisse, joues des coupées
  for (const sd of [-1, 1]) for (const [a, b] of runs(sd)) {
    const n = Math.max(1, Math.round((b - a) * nv)), t = (v) => lerp(a, b, v);
    M.color(o.hull); M.surf('hull', 1, n, (u, v) => { const s = S(t(v)); return [sd * s.hw, lerp(Dk, s.yd, sd > 0 ? u : 1 - u), z(t(v))]; }, { uL: 1, vL: (b - a) * L });
    M.color(o.inner || [0.9, 0.9, 0.88]); M.surf('paint', 1, n, (u, v) => { const s = S(t(v)); return [sd * inner(t(v)), lerp(Dk, s.yd, sd > 0 ? 1 - u : u), z(t(v))]; }, { uL: 1, vL: (b - a) * L });
    M.color(o.rail || [0.92, 0.92, 0.9]);
    const P = []; for (let i = 0; i <= n; i++) { const s = S(t(i / n)); P.push([sd * Math.max(0, s.hw - th / 2), s.yd + 0.03, z(t(i / n))]); }
    if (P.length > 1) M.sweep('paint', rectShape(th + 0.06, 0.07), P);
    for (const e of [a, b]) if (e > 1e-3 && e < 0.999) { const s = S(e); M.color(o.hull); M.quad('paint', [sd * inner(e), Dk, z(e)], [sd * s.hw, Dk, z(e)], [sd * s.hw, s.yd, z(e)], [sd * inner(e), s.yd, z(e)], [0, 0, e === a ? -1 : 1]); }
  }
  // pavois du tableau arrière (avec son ouverture)
  { const s0 = S(0), a = inner(0), segs = stern ? [[-a, stern[1]], [stern[2], a]] : [[-a, a]];
    for (const [x0, x1] of segs) {
      const ox0 = x0 === -a ? -s0.hw : x0, ox1 = x1 === a ? s0.hw : x1;
      M.color(o.hull); M.quad('hull', [ox0, Dk, z(0)], [ox1, Dk, z(0)], [ox1, s0.yd, z(0)], [ox0, s0.yd, z(0)], [0, 0, -1]);
      M.color(o.inner || [0.9, 0.9, 0.88]); M.quad('paint', [x0, Dk, z(0) + th], [x1, Dk, z(0) + th], [x1, s0.yd, z(0) + th], [x0, s0.yd, z(0) + th], [0, 0, 1]);
      M.color(o.rail || [0.92, 0.92, 0.9]); M.boxB('paint', x0, x1, s0.yd, s0.yd + 0.07, z(0) - 0.03, z(0) + th + 0.03);
    }
    if (stern) for (const x of [stern[1], stern[2]]) { M.color(o.hull); M.quad('paint', [x, Dk, z(0)], [x, Dk, z(0) + th], [x, s0.yd, z(0) + th], [x, s0.yd, z(0)], [x < 0 ? 1 : -1, 0, 0]); }
  }
  // bande de flottaison et liston le long des flancs (là où le bordé est droit)
  if (o.boot) for (const sd of [-1, 1]) {
    M.color(o.boot); M.surf('hull', 1, 16, (u, v) => { const t = lerp(0.02, 0.78, v), s = S(t); return [sd * (s.hw + 0.006), lerp(s.yw + 0.02, s.yw + 0.3, sd > 0 ? u : 1 - u), z(t)]; }, { uL: 0.3, vL: L * 0.76 });
  }
  M.color(o.stripe || [0.92, 0.92, 0.9]);
  for (const sd of [-1, 1]) { const P = []; for (let i = 0; i <= 20; i++) { const t = 0.01 + (i / 20) * 0.94, s = S(t); P.push([sd * (s.hw + 0.035), Dk - 0.08, z(t)]); } M.tube('paint', 0.07, P, 6); }
  // pont (plat)
  M.color(o.deckTint || [0.4, 0.45, 0.42]); M.world(1);
  for (let i = 0; i < nv; i++) {
    const t0 = i / nv, t1 = (i + 1) / nv, a = inner(t0), b = inner(t1);
    M.quad('paint', [-a, Dk, z(t0)], [a, Dk, z(t0)], [b, Dk, z(t1)], [-b, Dk, z(t1)], [0, 1, 0]);
  }
  // étrave : les deux flancs (bordé et pavois) s'arrêtent à quelques centimètres l'un de l'autre à t = 1 et laissaient, de face, une fente
  // de la quille au plat-bord. Une pièce d'étrave la ferme : elle suit la quille depuis le brion puis monte jusqu'au-dessus de la lisse
  // (sous le pont seulement quand des coupées ouvrent l'étrave)
  { const s1 = S(1), r = Math.max(0.05, s1.hw + 0.02), P = [];
    for (let i = 0; i <= 5; i++) { const t = lerp(0.9, 1, i / 5); P.push([0, S(t).yk + r * 0.3, z(t)]); }
    const top = bowOpen ? Dk - 0.03 : s1.yd + 0.07;
    for (let i = 1; i <= 4; i++) P.push([0, lerp(P[5][1], top, i / 4), z(1)]);
    M.color(o.hull); M.tube('hull', r, P, 8);
    M.save().move(0, top, z(1)); M.cyl('hull', r, 0.001, 8, { side: false, caps: 't' }); M.restore(); // le bout du tube, fermé
  }
  M.restore();
  // collisions : coque en tranches (l'étrave s'affine), pavois en segments, coupées laissées ouvertes
  if (!o.noCol) {
    for (const [t0, t1] of [[0, 0.8], [0.8, 0.9], [0.9, 0.98]]) { const w = S((t0 + t1) / 2).hw * 0.98; M.col(-w, w, Math.min(S(0.5).yk, -1), Dk, z(t0), z(t1), 'metal'); }
    for (const sd of [-1, 1]) for (const [a, b] of runs(sd)) {
      const n = Math.max(1, Math.round((b - a) * 22));
      for (let i = 0; i < n; i++) {
        const t0 = lerp(a, b, i / n), t1 = lerp(a, b, (i + 1) / n), s = S((t0 + t1) / 2), w = s.hw;
        M.col(sd > 0 ? w - th - 0.06 : -w, sd > 0 ? w : -w + th + 0.06, Dk, s.yd + 0.05, z(t0), z(Math.min(t1, 0.985)), 'metal');
      }
    }
    const s0 = S(0);
    for (const [x0, x1] of stern ? [[-s0.hw, stern[1]], [stern[2], s0.hw]] : [[-s0.hw, s0.hw]]) M.col(x0, x1, Dk, s0.yd + 0.05, z(0), z(0) + th + 0.05, 'metal');
    if (!bowOpen) M.col(-0.6, 0.6, Dk, S(0.985).yd, z(0.97), z(1.0), 'metal');
  }
  // étrave ouverte : garde-corps de chandeliers autour de la plage avant, ouvert au milieu pour la coupée
  if (bowOpen) {
    const t0 = Math.max(...gaps.filter((g) => g[0] !== 0 && g[2] >= 0.99).map((g) => g[1]));
    M.save().local(1).color(o.rail || [0.92, 0.92, 0.9]); M.cls = 1;
    for (const sd of [-1, 1]) {
      const P = []; for (let i = 0; i <= 6; i++) { const t = lerp(t0, 0.985, i / 6); P.push([sd * Math.max(0.62, inner(t) - 0.05), Dk + 1.0, z(t)]); }
      M.tube('steel', 0.03, P, 5); M.tube('steel', 0.018, P.map((p) => [p[0], Dk + 0.5, p[2]]), 4);
      for (const p of P) { M.save().move(p[0], Dk, p[2]); M.cyl('steel', 0.025, 1.0, 5); M.restore(); }
    }
    M.restore();
  }
  return { z, S, inner, Dk, L, hw0 };
}
/* Point du plat-bord d'une coque posée en (x, y, z), tournée de ry (table T, longueur L, largeur B) : côté sd (1 : +x de la coque), à t
   (0 : tableau arrière, 1 : étrave), juste au-dessus de la lisse. Une amarre qui y aboutit reste dehors : attachées au jugé, sur l'axe du
   bateau ou dans le pavois, elles traversaient le pont et ce qu'il porte. */
function hullRail(T, L, B, x, y, z, ry, sd, t) {
  const s = hullAt(T, t, B / 2), lx = sd * (s.hw + 0.03), lz = (t - 0.5) * L, c = Math.cos(ry), sn = Math.sin(ry);
  return [x + lx * c + lz * sn, y + s.yd + 0.1, z - lx * sn + lz * c];
}
/* Contour de la coque à la flottaison, dans le repère du monde (bateau posé en (x, z), tourné de ry) : pour l'eau */
function hullOutline(T, L, B, x, z, ry, k = 0.97) {
  const P = [], c = Math.cos(ry), s = Math.sin(ry), n = 16;
  for (let sd of [1, -1]) for (let i = 0; i <= n; i++) {
    const t = sd > 0 ? i / n : 1 - i / n, h = hullAt(T, t, B / 2).hw * k * sd, zz = (t - 0.5) * L;
    P.push([x + h * c + zz * s, z - h * s + zz * c]);
  }
  return P;
}
/* Nom et immatriculation peints de chaque côté de l'étrave (case de l'atlas BOATS) et sur le tableau */
/* Nom peint sur le flanc sd de la coque, de t0 à t1, haut de h à partir de y : six bandes qui suivent la courbure du bordé. D'un seul
   quadrilatère, tendu entre les deux bouts, le milieu rentrait dans le pavois de l'avant et le nom se lisait depuis le pont. Le texte se lit
   de gauche à droite vu de l'extérieur : de l'étrave vers l'arrière à tribord, l'inverse à bâbord. */
function hullSideName(M, H, idx, sd, t0, t1, y, h, mat = 'decals3') {
  const n = 6, off = 0.03;
  for (let k = 0; k < n; k++) {
    const ta = lerp(t0, t1, k / n), tb = lerp(t0, t1, (k + 1) / n), a = H.S(ta), b = H.S(tb), za = H.z(ta), zb = H.z(tb);
    const pa = [sd * (a.hw + off), za], pb = [sd * (b.hw + off), zb], nx = sd * (zb - za), nz = -(b.hw - a.hw), l = hyp(nx, nz) || 1;
    const [p, q, u] = sd > 0 ? [pb, pa, (n - 1 - k) / n] : [pa, pb, k / n];
    decal3Quad(M, idx, [p[0], y, p[1]], [q[0], y, q[1]], [q[0], y + h, q[1]], [p[0], y + h, p[1]], [nx / l, 0, nz / l], [u, 0, 1 / n, 0.33], mat);
  }
}
function hullName(M, H, idx, y) {
  for (const sd of [-1, 1]) hullSideName(M, H, idx, sd, 0.8, 0.9, y, 0.62);
  const s0 = H.S(0), w = Math.min(2.4, s0.hw * 1.4);
  decal3Quad(M, idx, [w / 2, y + 0.2, H.z(0) - 0.02], [-w / 2, y + 0.2, H.z(0) - 0.02], [-w / 2, y + 0.2 + w / 4, H.z(0) - 0.02], [w / 2, y + 0.2 + w / 4, H.z(0) - 0.02], [0, 0, -1], [0, 0, 1, 0.33]);
}
/* Défense (pneu ou boudin) pendue au pavois, côté sd, à t */
function hullFender(M, H, sd, t, kind) {
  const s = H.S(t), x = sd * (s.hw + 0.16), z = H.z(t);
  M.save().color([0.12, 0.12, 0.12]).local(1);
  M.tube('rubber', 0.01, [[sd * (s.hw - 0.05), s.yd + 0.05, z], [x, s.yd - 0.2, z], [x, H.Dk - 0.2, z]], 3);
  if (kind) { M.save().move(x, H.Dk - 0.75, z).rotZ(Math.PI / 2).move(0, -0.13, 0); M.lathe('rubber', [[0.18, 0], [0.28, 0], [0.31, 0.04], [0.31, 0.22], [0.28, 0.26], [0.18, 0.26], [0.16, 0.13], [0.18, 0]], 12, { sharp: 0.9 }); M.restore(); }
  else { M.color([0.85, 0.22, 0.12]); M.save().move(x, H.Dk - 1.05, z); M.lathe('rubber', [[0, 0], [0.1, 0.03], [0.15, 0.15], [0.15, 0.6], [0.1, 0.72], [0, 0.75]], 10); M.restore(); }
  M.restore();
}
/* Chalutier (pêche arrière) : coque, timonerie à deux niveaux (fenêtres inclinées, portes, hublots), mât et radar,
   portique arrière avec enrouleur de filet, panneaux de chalut, treuil, panneau de cale, défenses. Repère : flottaison
   en y = 0, étrave vers +z. o : L, B, name (case de l'atlas), hull, house ([t0, t1] de la timonerie), gaps, seed */
PF.trawler = (o) => prefab('trawler' + JSON.stringify(o), (M) => {
  const R = rngOf(o.seed || 5), H = hullBody(M, HULL_TRAWLER, { L: o.L, B: o.B, deck: 1.9, hull: o.hull, boot: o.boot || [0.75, 0.16, 0.1], stripe: o.stripe, inner: o.inner, deckTint: o.deckTint, gaps: o.gaps });
  const Dk = H.Dk, z = H.z, [h0, h1] = o.house || [0.55, 0.78], hx = o.houseW || 1.45, zh0 = z(h0), zh1 = z(h1), white = [0.93, 0.93, 0.9];
  hullName(M, H, o.name || 0, Dk + 0.45);
  M.save().local(1);
  // roof
  // timonerie : rouf (niveau du pont) et passerelle vitrée au-dessus, plus courte, front incliné
  M.color(white); M.aoFn = (x, y) => lerp(0.7, 1, smoothstep(Dk, Dk + 0.8, y));
  M.boxB('paint', -hx, hx, Dk, Dk + 2.15, zh0, zh1, { bevel: 0.04 });
  M.aoFn = null;
  const zb0 = zh0 + 0.6, zb1 = zh1 - 0.25, yb0 = Dk + 2.15, yb1 = Dk + 4.2;
  M.save().move(0, yb0, 0).mul(basis([0, 0, 1], [0, 1, 0], [-1, 0, 0]).clone()).move(0, 0, -hx + 0.1);
  M.extrude('paint', [[zb0, 0], [zb1 + 0.3, 0], [zb1, yb1 - yb0], [zb0, yb1 - yb0]], (hx - 0.1) * 2, { sharp: 0.3 });
  M.restore();
  // vitres : bandeau sombre tout autour de la passerelle, montants blancs
  M.color([0.32, 0.36, 0.4]); M.cls = 1;
  const wy0 = yb0 + 0.95, wy1 = yb1 - 0.3, fr = (wy1 - wy0) / (yb1 - yb0) * 0.3;
  for (const sd of [-1, 1]) M.quad('glass', [sd * (hx - 0.09), wy0, zb0 + 0.3], [sd * (hx - 0.09), wy0, zb1], [sd * (hx - 0.09), wy1, zb1 - 0.05], [sd * (hx - 0.09), wy1, zb0 + 0.3], [sd, 0, 0]);
  { const k = 0.3 / (yb1 - yb0); M.quad('glass', [-hx + 0.25, wy0, zb1 + 0.3 - (wy0 - yb0) * k + 0.01], [hx - 0.25, wy0, zb1 + 0.3 - (wy0 - yb0) * k + 0.01], [hx - 0.25, wy1, zb1 + 0.3 - (wy1 - yb0) * k + 0.01], [-hx + 0.25, wy1, zb1 + 0.3 - (wy1 - yb0) * k + 0.01], [0, 0.3, 1]); }
  M.quad('glass', [hx - 0.3, wy0, zb0 - 0.01], [-hx + 0.3, wy0, zb0 - 0.01], [-hx + 0.3, wy1, zb0 - 0.01], [hx - 0.3, wy1, zb0 - 0.01], [0, 0, -1]);
  void fr;
  M.cls = 0; M.color(white);
  for (const sd of [-1, 1]) for (let k = 1; k < 4; k++) { const zz = lerp(zb0 + 0.3, zb1, k / 4); M.boxB('paint', sd * (hx - 0.1) - 0.03, sd * (hx - 0.1) + 0.03, wy0, wy1, zz - 0.05, zz + 0.05); }
  for (const x of [-0.5, 0.5]) { const k = 0.3 / (yb1 - yb0); M.boxB('paint', x - 0.05, x + 0.05, wy0, wy1, zb1 + 0.2 - (wy1 - yb0) * k, zb1 + 0.34 - (wy0 - yb0) * k); }
  // toit en débord, visière, main courante
  M.boxB('paint', -hx - 0.15, hx + 0.15, yb1, yb1 + 0.12, zb0 - 0.2, zb1 + 0.55, { bevel: 0.03 });
  M.color([0.2, 0.2, 0.2]); M.cls = 1;
  for (const sd of [-1, 1]) M.tube('steel', 0.025, [[sd * (hx + 0.05), yb1 + 0.12, zb0 - 0.1], [sd * (hx + 0.05), yb1 + 0.55, zb0 - 0.1], [sd * (hx + 0.05), yb1 + 0.55, zb1 + 0.4], [sd * (hx + 0.05), yb1 + 0.12, zb1 + 0.4]], 5);
  // portes du rouf, hublots
  M.color([0.18, 0.2, 0.22]); M.cls = 1;
  for (const sd of [-1, 1]) M.quad('dark', [sd * (hx + 0.005), Dk + 0.25, zh0 + 0.5], [sd * (hx + 0.005), Dk + 0.25, zh0 + 1.25], [sd * (hx + 0.005), Dk + 1.95, zh0 + 1.25], [sd * (hx + 0.005), Dk + 1.95, zh0 + 0.5], [sd, 0, 0]);
  M.quad('dark', [0.45, Dk + 0.2, zh0 - 0.005], [-0.45, Dk + 0.2, zh0 - 0.005], [-0.45, Dk + 1.95, zh0 - 0.005], [0.45, Dk + 1.95, zh0 - 0.005], [0, 0, -1]);
  M.color([0.55, 0.55, 0.52]);
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const zz = zh0 + 1.9 + k * ((zh1 - zh0 - 2.3) / 2); M.save().move(sd * (hx + 0.01), Dk + 1.35, zz).rotZ(sd * Math.PI / 2); M.cyl('steel', 0.17, 0.04, 10); M.restore(); M.save().color([0.06, 0.07, 0.08]).move(sd * (hx + 0.03), Dk + 1.35, zz).rotZ(sd * Math.PI / 2); M.cyl('glass', 0.12, 0.02, 10); M.restore(); }
  M.cls = 0;
  // mât tripode, vergue, radar, feux, antennes
  M.color([0.9, 0.9, 0.88]);
  const zm = (zb0 + zb1) / 2, ym = yb1 + 0.12;
  M.save().move(0, ym, zm); M.cyl('steel', 0.08, 4.6, 8, { r1: 0.05 }); M.restore();
  for (const sd of [-1, 1]) M.tube('steel', 0.04, [[sd * 0.9, ym, zm - 0.9], [0, ym + 3.0, zm]], 5);
  M.boxB('steel', -1.3, 1.3, ym + 2.6, ym + 2.7, zm - 0.05, zm + 0.05);
  M.color([0.12, 0.12, 0.12]); M.boxB('steel', -1.0, 1.0, ym + 3.2, ym + 3.32, zm - 0.12, zm + 0.12); M.save().move(0, ym + 3.0, zm); M.cyl('steel', 0.1, 0.2, 8); M.restore();
  M.cls = 1; M.color([0.88, 0.88, 0.86]); for (const x of [-0.8, 0.85]) { M.save().move(x, ym, zm + 0.6); M.cyl('plastic', 0.02, 2.4, 4, { r1: 0.01 }); M.restore(); }
  M.color([1.6, 0.15, 0.1]); M.boxB('bulb', -hx - 0.2, -hx - 0.12, yb1 - 0.3, yb1 - 0.15, zb1 - 0.3, zb1 - 0.1);
  M.color([0.15, 1.4, 0.3]); M.boxB('bulb', hx + 0.12, hx + 0.2, yb1 - 0.3, yb1 - 0.15, zb1 - 0.3, zb1 - 0.1);
  M.cls = 0;
  // bouées couronnes et radeaux de survie sur le toit
  for (const sd of [-1, 1]) { M.save().move(sd * (hx + 0.06), Dk + 1.3, zh1 - 0.6).rotY(sd * Math.PI / 2); M.put(PF.lifeRing()); M.restore(); }
  M.color([0.95, 0.95, 0.93]); for (const sd of [-1, 1]) { M.save().move(sd * 0.75, yb1 + 0.12, zb0 + 0.25).rotX(Math.PI / 2); M.cyl('plastic', 0.28, 1.1, 10); M.restore(); }
  // portique arrière (en U), enrouleur de filet, panneaux de chalut sur les potences
  const zs = z(0.05), gc = o.gantry || [0.92, 0.45, 0.12], gw = H.inner(0.05) - 0.25;
  M.color(gc);
  for (const sd of [-1, 1]) M.boxB('paint', sd * gw - 0.16, sd * gw + 0.16, Dk, Dk + 5.2, zs - 0.16, zs + 0.16, { bevel: 0.02 });
  M.boxB('paint', -gw - 0.2, gw + 0.2, Dk + 5.0, Dk + 5.45, zs - 0.2, zs + 0.2, { bevel: 0.03 });
  M.color([0.25, 0.25, 0.25]); M.save().move(0, Dk + 4.5, zs - 0.15); M.cyl('steel', 0.18, 0.3, 10); M.restore();
  // enrouleur : au pied du portique (pêche arrière) ou perché sur le portique (o.drum = 'haut', le pont reste libre)
  const zd = o.drum === 'haut' ? zs + 0.9 : z(0.2), yd0 = o.drum === 'haut' ? Dk + 3.6 : Dk;
  if (o.drum !== false) {
    M.color([0.3, 0.3, 0.3]);
    for (const sd of [-1, 1]) M.boxB('steel', sd * 1.9 - 0.08, sd * 1.9 + 0.08, yd0, yd0 + 1.6, zd - 0.6, zd + 0.6, { bevel: 0.02 });
    // rotZ(+90°) couche l'axe du cylindre vers -x : on part donc du flanc +x
    M.save().move(1.85, yd0 + 1.2, zd).rotZ(Math.PI / 2); M.color([0.42, 0.42, 0.4]); M.cyl('steel', 0.45, 3.7, 14); M.restore();
    M.save().move(1.65, yd0 + 1.2, zd).rotZ(Math.PI / 2); M.color(o.netColor || [0.25, 0.52, 0.4]); M.cyl('canvas', 0.8, 3.3, 16, { caps: '' }); M.restore();
    if (o.drum === 'haut') { M.color(gc); for (const sd of [-1, 1]) M.boxB('paint', sd * 2.05 - 0.12, sd * 2.05 + 0.12, Dk, yd0, zd - 0.12, zd + 0.12); }
  }
  // panneaux de chalut pendus aux potences, à l'extérieur du pavois
  for (const sd of [-1, 1]) { M.save().move(sd * (H.S(0.1).hw + 0.14), Dk + 0.35, z(0.1)).rotY(sd * 0.06); M.color(o.doors || [0.55, 0.18, 0.12]); M.boxB('rust', -0.07, 0.07, -0.55, 0.55, -0.85, 0.85, { bevel: 0.03 }); M.restore();
    M.color([0.25, 0.25, 0.25]); M.tube('steel', 0.03, [[sd * (H.S(0.1).hw - 0.05), H.S(0.1).yd + 0.05, z(0.1)], [sd * (H.S(0.1).hw + 0.4), H.S(0.1).yd + 0.9, z(0.1)], [sd * (H.S(0.1).hw + 0.4), H.S(0.1).yd + 0.9, z(0.1) - 0.3]], 4); }
  // treuil derrière la timonerie, panneau de cale, bacs et cordages
  const ww = o.winchW || 1.2;
  M.color([0.2, 0.36, 0.5]); M.boxB('paint', -ww, ww, Dk, Dk + 1.0, zh0 - 1.6, zh0 - 0.4, { bevel: 0.05 });
  // tambours du treuil (l'axe du cylindre part vers -x après rotZ)
  M.color([0.35, 0.35, 0.35]); for (const sd of [-1, 1]) { M.save().move(sd * ww * 0.62 + 0.25, Dk + 1.0, zh0 - 1.0).rotZ(Math.PI / 2); M.cyl('steel', 0.35, 0.5, 12); M.restore(); }
  M.color(o.deckTint ? o.deckTint.map((c) => c * 0.8) : [0.32, 0.36, 0.34]); M.boxB('paint', -0.9, 0.9, Dk, Dk + 0.35, z(0.32) - 0.9, z(0.32) + 0.9, { bevel: 0.03 });
  M.restore();
  for (const [x, t, k] of o.bins || [[0.9, 0.42, 0], [1.2, 0.36, 1], [-1.1, 0.4, 2]]) { M.save().move(x, Dk, z(t)).rotY(R() - 0.5); M.put(PF.fishBinStackDyn(1 + (k % 2), k)); M.restore(); }
  M.save().move(-1.0, Dk, z(0.88)); M.dyn('ropeCoil', 0, 0, 0, 0); M.restore();
  M.save().move(0.6, Dk, z(0.27)); M.dyn('ropeCoil', 0, 0, 0, 0); M.restore();
  for (const sd of [-1, 1]) for (const [t, k] of [[0.3, 1], [0.45, 0], [0.62, 1]]) if (!(o.gaps || []).some((g) => g[0] === sd && t > g[1] - 0.04 && t < g[2] + 0.04)) hullFender(M, H, sd, t, k);
  // collisions : timonerie, portique, enrouleur, treuil
  M.col(-hx, hx, Dk, yb1 + 0.1, zh0, zh1, 'metal');
  for (const sd of [-1, 1]) M.col(sd * gw - 0.17, sd * gw + 0.17, Dk, Dk + 5.2, zs - 0.17, zs + 0.17, 'metal');
  if (o.drum !== false) { if (o.drum === 'haut') { for (const sd of [-1, 1]) M.col(sd * 2.05 - 0.13, sd * 2.05 + 0.13, Dk, yd0, zd - 0.13, zd + 0.13, 'metal'); } else M.col(-2.0, 2.0, Dk, Dk + 2.0, zd - 0.8, zd + 0.8, 'metal'); }
  M.col(-ww, ww, Dk, Dk + 1.0, zh0 - 1.6, zh0 - 0.4, 'metal');
  M.occ(-hx, hx, Dk, yb1, zh0, zh1, 1);
});
/* Bouée couronne (orange, bandes blanches), dans le plan xy, centre en y = 0 */
PF.lifeRing = () => prefab('lifeRing', (M) => {
  M.local(1); M.cls = 1;
  for (let i = 0; i < 4; i++) { M.color(i % 2 ? [0.95, 0.95, 0.92] : [0.95, 0.42, 0.08]); M.save().rotZ((i * Math.PI) / 2); M.save().rotX(Math.PI / 2); M.lathe('plastic', [[0.28, -0.05], [0.33, -0.04], [0.35, 0], [0.33, 0.04], [0.28, 0.05], [0.26, 0], [0.28, -0.05]], 8, { a0: 0, a1: Math.PI / 2 }); M.restore(); M.restore(); }
});
/* Glène de cordage lovée sur le pont */
PF.ropeCoil = () => prefab('ropeCoil', (M) => {
  M.color([0.82, 0.7, 0.42]).local(1); M.cls = 1;
  for (let k = 0; k < 4; k++) { const r = 0.32 - k * 0.03, P = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU; P.push([Math.cos(a) * r, 0.03 + k * 0.045, Math.sin(a) * r]); } M.tube('canvas', 0.022, P, 5); }
});
/* Bac à poisson en plastique (80 x 50 x 30 cm), teinte de l'estampille ; empilés de n ; k : poisson et glace dans celui du haut */
function fishBinShell(M) {
  M.local(1);
  M.aoFn = (x, y) => lerp(0.65, 1, smoothstep(0, 0.2, y));
  M.boxB('plastic', -0.4, 0.4, 0, 0.03, -0.25, 0.25);
  for (const s of [-1, 1]) { M.boxB('plastic', -0.42, 0.42, 0, 0.3, s * 0.25 - 0.02, s * 0.25 + 0.01 * s); M.boxB('plastic', s * 0.4 - 0.02, s * 0.4 + 0.02, 0, 0.3, -0.24, 0.24); }
  M.aoFn = null;
  for (const s of [-1, 1]) { M.color([0.06, 0.06, 0.06]); M.boxB('dark', s * 0.425, s * 0.426, 0.2, 0.26, -0.08, 0.08); }
}
PF.fishBin = () => prefab('fishBin', (M, P) => {
  P.tintable = ['plastic'];
  fishBinShell(M);
});
/* Bac à poisson physique, vide (avec sa collision), et bac du haut d'une pile : lit de glace compris, collision jusqu'à la glace */
PF.fishBinSolid = () => prefab('fishBinSolid', (M, P) => {
  P.tintable = ['plastic'];
  fishBinShell(M);
  M.col(-0.42, 0.42, 0, 0.3, -0.27, 0.27, 'dirt');
});
PF.fishBinIce = () => prefab('fishBinIce', (M, P) => {
  P.tintable = ['plastic'];
  fishBinShell(M);
  M.save().move(0, 0.03, 0); fishIce(M, 0.36, 0.22, 0.16, rngOf(3)); M.restore();
  M.col(-0.42, 0.42, 0, 0.14, -0.27, 0.27, 'dirt');
});
/* Pile de bacs physiques (au sol, hors des bateaux qui bougent) : mêmes bacs et mêmes teintes que fishBinStack, poissons dynamiques */
PF.fishBinStackDyn = (n = 2, k = 0) => prefab('fishBinStackDyn' + n + '_' + k, (M) => {
  const R = rngOf(31 + k * 7 + n), cols = [[0.15, 0.36, 0.72], [0.95, 0.5, 0.08], [0.85, 0.85, 0.82], [0.2, 0.5, 0.35]];
  for (let i = 0; i < n; i++) { const x = (R() - 0.5) * 0.04, z = (R() - 0.5) * 0.04; M.dyn(i === n - 1 ? 'fishBinIce' : 'fishBin', x, i * 0.285, z, (R() - 0.5) * 0.08, { tint: cols[(k + i) % cols.length] }); }
  M.save().move(0, (n - 1) * 0.285 + 0.03, 0); fishPile(M, 0.36, 0.22, 0.16, k, true); M.restore();
});
/* Un poisson de 30 cm, couché (repère : son centre), teinte de l'estampille */
PF.fishOne = () => prefab('fishOne', (M, P) => { P.tintable = ['fish']; M.color([1, 1, 1]).local(1); fishBody(M, 0.3); });
PF.fishBinStack = (n = 2, k = 0) => prefab('fishBinStack' + n + '_' + k, (M) => {
  const R = rngOf(31 + k * 7 + n), cols = [[0.15, 0.36, 0.72], [0.95, 0.5, 0.08], [0.85, 0.85, 0.82], [0.2, 0.5, 0.35]];
  for (let i = 0; i < n; i++) { M.save().move((R() - 0.5) * 0.04, i * 0.285, (R() - 0.5) * 0.04).rotY((R() - 0.5) * 0.08); M.put(PF.fishBin(), { tint: cols[(k + i) % cols.length] }); M.restore(); }
  M.save().move(0, (n - 1) * 0.285 + 0.03, 0); fishPile(M, 0.36, 0.22, 0.16, k); M.restore();
  M.col(-0.42, 0.42, 0, n * 0.285 + 0.06, -0.27, 0.27, 'dirt');
});
/* Lit de glace pilée et poissons couchés dessus (repère local : centre du lit, y = 0 au fond), demi-longueur a, demi-largeur b */
function fishIce(M, a, b, h, R) {
  M.save().color([0.95, 0.96, 0.98]); M.cls = 1;
  M.surf('crushedice', 6, 4, (u, v) => { const x = lerp(-a, a, u), z = lerp(-b, b, v); return [x, h * (0.55 + 0.25 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI)) + (R() - 0.5) * 0.01, z]; }, { uL: a * 2, vL: b * 2, flipN: true });
  M.restore();
}
/* dyn : les poissons sont des props physiques (teinte de l'espèce) et le lit de glace n'est pas dessiné (c'est celui du bac ou de l'étal) */
function fishPile(M, a, b, h, seed, dyn) {
  const R = rngOf(seed * 13 + 3);
  if (dyn) for (let i = 0; i < 35; i++) R(); else fishIce(M, a, b, h, R);
  M.save(); M.cls = 2;
  const kinds = [[0.72, 0.74, 0.78], [0.62, 0.66, 0.7], [0.8, 0.58, 0.5], [0.55, 0.6, 0.48], [0.88, 0.86, 0.8]];
  const n = Math.round(a * b * 40);
  for (let i = 0; i < n; i++) {
    const x = R.range(-a + 0.08, a - 0.08), zz = R.range(-b + 0.05, b - 0.05), L = R.range(0.22, 0.38);
    if (dyn) { const ry = R() * TAU, rz = (R() - 0.5) * 0.3; M.dyn('fish', x, h * 0.78 + 0.02, zz, ry, { rz, s: L / 0.3, tint: R.pick(kinds) }); continue; }
    M.save().move(x, h * 0.78 + 0.02, zz).rotY(R() * TAU).rotZ((R() - 0.5) * 0.3); M.color(R.pick(kinds)); fishBody(M, L); M.restore();
  }
  M.restore();
}
/* Poisson stylisé (fuseau aplati, nageoire caudale), longueur L le long de x */
function fishBody(M, L) {
  M.loft('fish', [{ z: -L / 2, w: 0.002, yb: -0.004, yt: 0.004, n: 2 }, { z: -L * 0.32, w: L * 0.05, yb: -L * 0.07, yt: L * 0.07, n: 2 }, { z: L * 0.05, w: L * 0.07, yb: -L * 0.11, yt: L * 0.12, n: 2 },
    { z: L * 0.35, w: L * 0.045, yb: -L * 0.06, yt: L * 0.08, n: 2 }, { z: L / 2, w: 0.002, yb: -0.004, yt: 0.006, n: 2 }].map((s) => ({ ...s })), 6, { caps: false, uL: L, vL: L });
  M.quad('fish', [0, -L * 0.1, -L / 2 - L * 0.12], [0, L * 0.1, -L / 2 - L * 0.12], [0, 0.004, -L / 2 + 0.01], [0, -0.004, -L / 2 + 0.01], [1, 0, 0]);
}
/* Canot à moteur (5,6 m) : coque ouverte, banc, console, moteur hors-bord ; pour flotter (floatAdd) ou reposer sur un ber */
PF.canot = (hull = [0.85, 0.85, 0.82], seed = 1) => prefab('canot' + hull.join(',') + seed, (M) => {
  const H = hullBody(M, HULL_CANOT, { L: 5.6, B: 2.1, deck: 0.18, thick: 0.06, nv: 16, hull, boot: [0.2, 0.32, 0.55], stripe: [0.2, 0.32, 0.55], inner: [0.92, 0.92, 0.9], deckTint: [0.62, 0.6, 0.55], noCol: true });
  const z = H.z;
  M.save().local(1);
  M.color([0.9, 0.9, 0.88]); M.boxB('paint', -0.35, 0.35, 0.18, 1.05, z(0.55) - 0.3, z(0.55) + 0.3, { bevel: 0.04 });
  M.color([0.1, 0.12, 0.14]); M.boxB('glass', -0.33, 0.33, 1.05, 1.35, z(0.55) + 0.15, z(0.55) + 0.2);
  M.color([0.6, 0.48, 0.34]); M.boxB('wood', -0.85, 0.85, 0.45, 0.5, z(0.25) - 0.18, z(0.25) + 0.18);
  M.color([0.15, 0.15, 0.16]); M.boxB('paint', -0.22, 0.22, 0.25, 1.05, z(0) - 0.45, z(0) - 0.05, { bevel: 0.05 });
  M.color([0.2, 0.2, 0.2]); M.boxB('steel', -0.06, 0.06, -0.55, 0.3, z(0) - 0.35, z(0) - 0.22);
  const R = rngOf(seed); if (R() < 0.7) { M.save().move(0.3, 0.18, z(0.75)); M.put(PF.fishBinStack(1, seed)); M.restore(); }
  M.save().move(-0.4, 0.18, z(0.35)); M.put(PF.ropeCoil()); M.restore();
  M.restore();
});
/* Voilier au mouillage (lointain) : coque blanche, rouf, mât et bôme, voile ferlée */
PF.sailboat = (seed = 1) => prefab('sailboat' + seed, (M) => {
  const R = rngOf(seed * 7 + 2);
  hullBody(M, HULL_CANOT, { L: 9, B: 3, deck: 0.75, thick: 0.05, nv: 12, hull: [0.94, 0.94, 0.92], boot: R.pick([[0.12, 0.2, 0.42], [0.6, 0.14, 0.1]]), stripe: [0.2, 0.25, 0.4], inner: [0.9, 0.9, 0.88], deckTint: [0.78, 0.74, 0.66], noCol: true });
  M.save().local(1).color([0.95, 0.95, 0.93]);
  M.boxB('paint', -0.9, 0.9, 0.75, 1.3, -1.4, 1.2, { bevel: 0.08 });
  M.color([0.85, 0.85, 0.85]); M.cyl('steel', 0.06, 12, 6, { r1: 0.04 });
  M.save().move(0, 1.9, 0).rotX(-Math.PI / 2); M.cyl('steel', 0.05, 3.8, 6); M.restore();
  M.color(R.pick([[0.18, 0.3, 0.55], [0.85, 0.82, 0.74], [0.55, 0.15, 0.12]])); M.save().move(0, 1.95, -0.2).rotX(-Math.PI / 2); M.cyl('canvas', 0.16, 3.4, 8, { r1: 0.1 }); M.restore();
  M.color([0.3, 0.3, 0.3]); M.cls = 2; M.tube('steel', 0.008, [[0, 11.8, 0], [0, 0.8, 4.2]], 3); M.tube('steel', 0.008, [[0, 11.8, 0], [0, 0.8, -4.3]], 3);
  M.restore();
});
/* Bitte d'amarrage en fonte (bollard à tête renflée) sur sa platine */
PF.bitt = () => prefab('bitt', (M) => {
  M.color([0.16, 0.17, 0.18]).local(1);
  M.boxB('steel', -0.3, 0.3, 0, 0.05, -0.3, 0.3, { bevel: 0.02 });
  M.lathe('steel', [[0, 0.05], [0.17, 0.05], [0.15, 0.14], [0.13, 0.42], [0.2, 0.5], [0.22, 0.56], [0.2, 0.62], [0, 0.63]], 14, { sharp: 0.7 });
  M.col(-0.2, 0.2, 0, 0.6, -0.2, 0.2, 'metal');
});
/* Amarre : cordage tendu en chaînette d'un point à l'autre (repère monde), sans collision */
function mooringLine(a, b, sag = 0.4, col = [0.85, 0.74, 0.45]) {
  LINES.push({ k: 'amarre', a, b });
  DECOR.save().color(col); DECOR.cls = 2; DECOR.tube('canvas', 0.022, sagPath(a, b, sag, 12), 4); DECOR.restore();
}
/* Coupée : planche à taquets et mains courantes de cordage, de (x0, z0) à (x1, z1) le long de axis, de h0 à h1.
   Rampe praticable (RAMPS, les bots la prennent), sans marches */
function gangway(x0, x1, z0, z1, axis, h0, h1) {
  RAMPS.push({ x0, x1, z0, z1, axis, h0, h1 });
  const M = DECOR, L = axis === 'x' ? x1 - x0 : z1 - z0, W = axis === 'x' ? z1 - z0 : x1 - x0, ang = Math.atan2(h1 - h0, L);
  M.save().move((x0 + x1) / 2, (h0 + h1) / 2, (z0 + z1) / 2).rotY(axis === 'x' ? Math.PI / 2 : 0).rotX(-ang).local(1);
  const len = hyp(L, h1 - h0);
  M.color([0.55, 0.45, 0.34]); M.boxB('wood', -W / 2, W / 2, -0.07, -0.01, -len / 2, len / 2, { bevel: 0.01 });
  M.color([0.45, 0.36, 0.26]); M.cls = 1;
  for (let k = -len / 2 + 0.2; k < len / 2; k += 0.32) M.boxB('wood', -W / 2 + 0.05, W / 2 - 0.05, -0.01, 0.02, k - 0.025, k + 0.025);
  for (const s of [-1, 1]) for (const k of [-len / 2 + 0.05, len / 2 - 0.05]) M.boxB('steel', s * W / 2 - 0.02, s * W / 2 + 0.02, -0.01, 0.95, k - 0.02, k + 0.02);
  M.color([0.85, 0.74, 0.45]);
  for (const s of [-1, 1]) M.tube('canvas', 0.015, sagPath([s * W / 2, 0.92, -len / 2 + 0.05], [s * W / 2, 0.92, len / 2 - 0.05], 0.08, 8), 4);
  M.restore();
  // les tirs s'arrêtent sur la planche, pas sur les cordages
  if (axis === 'x') M.col(x0, x1, Math.min(h0, h1) - 0.1, Math.min(h0, h1), z0, z1, 'wood', true); else M.col(x0, x1, Math.min(h0, h1) - 0.1, Math.min(h0, h1), z0, z1, 'wood', true);
}

/* ---------- Matériel de quai ---------- */
/* Tas de filet de pêche : amas bosselé (deux teintes de nappe), flotteurs orange, ralingue ; collision basse */
PF.netPile = (seed = 1, w = 2.2, d = 1.6, h = 0.9) => prefab(`netPile${seed}_${w}_${d}_${h}`, (M) => {
  const R = rngOf(seed * 37 + 5), N = makeNoise(seed * 11 + 3), col = [[0.24, 0.5, 0.38], [0.2, 0.36, 0.6], [0.75, 0.32, 0.14], [0.3, 0.55, 0.62]];
  M.local(1);
  for (let k = 0; k < 2; k++) {
    const c = R.pick(col), ox = (R() - 0.5) * w * 0.25, oz = (R() - 0.5) * d * 0.25, sc = k ? 0.7 : 1;
    M.save().color(c).move(ox, 0, oz); M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0, h * 0.6, y));
    M.surf('canvas', 14, 10, (u, v) => {
      const a = u * TAU, r = Math.sin(v * Math.PI / 2), n = N.fbm(u * 3 + k, v * 2, 64, 64, 3);
      const rr = r * (0.75 + n * 0.5);
      return [Math.cos(a) * rr * w / 2 * sc, Math.cos(v * Math.PI / 2) * h * sc * (0.8 + n * 0.4) + (k ? h * 0.25 : 0), Math.sin(a) * rr * d / 2 * sc];
    }, { closeU: true, uL: w * 2, vL: h * 2, pole: () => [0, 1, 0] });
    M.restore();
  }
  M.aoFn = null; M.cls = 1;
  for (let i = 0; i < 9; i++) { const a = R() * TAU, r = R.range(0.3, 0.9); M.save().color([0.95, 0.45, 0.1]).move(Math.cos(a) * r * w / 2, R.range(0.25, h * 0.95), Math.sin(a) * r * d / 2).scl(0.09, 0.07, 0.09); M.geo('plastic', G_SPH); M.restore(); }
  M.color([0.86, 0.76, 0.48]); M.tube('canvas', 0.02, [[-w / 2, 0.05, -d * 0.3], [-w * 0.2, h * 0.7, 0], [w * 0.25, h * 0.6, d * 0.2], [w / 2 + 0.3, 0.02, d * 0.4]], 4);
  M.col(-w * 0.42, w * 0.42, 0, h * 0.95, -d * 0.42, d * 0.42, 'dirt');
});
/* Casier à crustacés : armature cylindrique couchée, filet, goulotte ; empilés par rangées */
PF.lobsterPot = () => prefab('lobsterPot', (M) => {
  M.local(1); M.color([0.2, 0.22, 0.22]); M.cls = 1;
  for (const z of [-0.28, 0, 0.28]) { const P = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); P.push([Math.cos(a) * 0.3, Math.sin(a) * 0.3, z]); } M.tube('steel', 0.012, P, 4); }
  M.boxB('steel', -0.3, 0.3, 0, 0.02, -0.3, 0.3);
  M.color([0.25, 0.42, 0.62]);
  M.surf('net', 6, 1, (u, v) => { const a = Math.PI * u; return [Math.cos(a) * 0.3, Math.sin(a) * 0.3, lerp(-0.3, 0.3, v)]; }, { uL: 0.95, vL: 0.6, flipN: true });
  for (const z of [-0.3, 0.3]) { const B = 8; for (let i = 0; i < B; i++) { const a0 = Math.PI * i / B, a1 = Math.PI * (i + 1) / B; M.tri3('net', [0, 0.1, z], [Math.cos(a0) * 0.3, Math.sin(a0) * 0.3, z], [Math.cos(a1) * 0.3, Math.sin(a1) * 0.3, z], [0, 0, Math.sign(z)]); } }
  M.color([0.85, 0.55, 0.15]); M.save().move(0, 0.3, 0); M.cyl('plastic', 0.08, 0.06, 8); M.restore();
  M.col(-0.3, 0.3, 0, 0.3, -0.3, 0.3, 'dirt');
});
PF.lobsterPots = (nx = 3, ny = 2, nz = 2, seed = 1) => prefab(`lobsterPots${nx}${ny}${nz}_${seed}`, (M) => {
  const R = rngOf(seed);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx - (j % 2); i++) for (let k = 0; k < nz; k++) {
    M.dyn('lobsterPot', (i - (nx - 1) / 2 + (j % 2) * 0.5) * 0.62, j * 0.3, (k - (nz - 1) / 2) * 0.62, Math.PI / 2 + (R() - 0.5) * 0.15);
  }
});
/* Bouée de corps-mort ou de casier (sphère orange ou blanche et son anneau) */
PF.buoy = (c = [0.95, 0.42, 0.1], r = 0.3) => prefab('buoy' + c.join(',') + r, (M) => {
  M.color(c).local(1); M.save().move(0, r, 0).scl(r, r * 0.92, r); M.geo('plastic', new THREE.SphereGeometry(1, 12, 8)); M.restore();
  M.color([0.2, 0.2, 0.2]); M.save().move(0, r * 1.85, 0).rotX(Math.PI / 2); M.lathe('steel', [[0.06, -0.012], [0.08, 0], [0.06, 0.012], [0.05, 0], [0.06, -0.012]], 8); M.restore();
});
/* Échelle de quai : montants et barreaux de fer scellés dans le parement (repère : face du quai en z = 0, l'eau vers +z) */
PF.quayLadder = (depth = 2.2) => prefab('quayLadder' + depth, (M) => {
  M.local(1); M.color([0.22, 0.2, 0.18]);
  for (const x of [-0.22, 0.22]) M.tube('rust', 0.025, [[x, -depth, 0.12], [x, -0.05, 0.12], [x, 0.25, 0.06], [x, 0.25, -0.25]], 5);
  M.cls = 1; for (let y = -depth + 0.15; y < 0; y += 0.3) M.boxB('rust', -0.22, 0.22, y - 0.015, y + 0.015, 0.1, 0.14);
});
/* Poteau de bouée couronne : potelet, boîte à bouée, la bouée accrochée */
PF.lifeRingStand = () => prefab('lifeRingStand', (M) => {
  M.local(1); M.color([0.85, 0.12, 0.1]); M.boxB('paint', -0.04, 0.04, 0, 1.5, -0.04, 0.04);
  M.color([0.92, 0.92, 0.9]); M.boxB('paint', -0.4, 0.4, 0.75, 1.55, 0.04, 0.12, { bevel: 0.01 });
  M.save().move(0, 1.15, 0.2); M.put(PF.lifeRing()); M.restore();
  M.col(-0.1, 0.1, 0, 1.5, -0.1, 0.1, 'metal', true);
});
/* Grue de déchargement (grue de quai sur fût, d'après des photos de grues portuaires à flèche treillis) : semelle boulonnée, fût conique,
   couronne d'orientation, plateforme tournante avec la salle des machines, la cabine du grutier en avant, chevalet en A, flèche en treillis
   à quatre membrures orientée vers -z (vers l'eau), câbles de relevage, câble de levage, moufle et crochet. Collisions : le fût et la semelle. */
PF.quayCrane = (reach = 9) => prefab('quayCrane' + reach, (M) => {
  const Yl = [0.82, 0.6, 0.14], D = [0.18, 0.18, 0.19];
  M.local(1); M.color(Yl);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0, 0.6, y));
  // semelle et boulons, fût conique, couronne d'orientation
  M.boxB('paint', -1.1, 1.1, 0, 0.42, -1.1, 1.1, { bevel: 0.06 });
  M.color(D); M.cls = 2; for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8; M.save().move(Math.cos(a) * 0.88, 0.42, Math.sin(a) * 0.88); M.cyl('steel', 0.045, 0.07, 6); M.restore(); } M.cls = 0;
  M.color(Yl); M.save().move(0, 0.42, 0); M.lathe('paint', [[0, 0], [0.62, 0], [0.62, 0.12], [0.52, 0.3], [0.42, 4.6], [0.5, 4.66], [0.5, 4.8], [0, 4.8]], 16, { sharp: 0.35 }); M.restore();
  M.color(D); M.save().move(0, 5.22, 0); M.cyl('steel', 0.62, 0.14, 18); M.restore();
  // plateforme tournante, salle des machines (arrière, +z) et contrepoids, cabine du grutier (avant gauche)
  M.color(Yl); M.boxB('paint', -0.95, 0.95, 5.36, 5.5, -0.9, 1.9, { bevel: 0.03 });
  M.boxB('paint', -0.85, 0.85, 5.5, 6.9, 0.1, 1.8, { bevel: 0.05 });
  M.color([0.7, 0.5, 0.12]); M.save().move(0.86, 5.5, 0.1).rotY(-Math.PI / 2); M.extrude('paint', [[0, 1.4], [1.7, 1.4], [1.7, 1.55], [0, 1.55]], 1.72, { sharp: 0.2 }); M.restore(); // débord du toit
  M.color(D); M.boxB('paint', -0.9, 0.9, 5.5, 6.3, 1.8, 2.15, { bevel: 0.04 }); // contrepoids
  M.color([0.3, 0.3, 0.3]); M.boxB('paint', 0.851, 0.86, 5.6, 6.6, 0.6, 1.2); // porte de la salle des machines
  M.color([0.24, 0.28, 0.32]); for (const sd of [-1, 1]) M.boxB('glass', sd * 0.852 - 0.004, sd * 0.852 + 0.004, 6.2, 6.6, 1.3, 1.7);
  M.color(Yl); M.boxB('paint', -0.85, -0.05, 5.5, 7.0, -0.85, 0.1, { bevel: 0.04 });
  M.color([0.25, 0.3, 0.35]);
  M.boxB('glass', -0.8, -0.1, 6.0, 6.85, -0.87, -0.85); M.boxB('glass', -0.87, -0.85, 6.0, 6.85, -0.75, -0.05); M.boxB('glass', -0.05, -0.03, 6.0, 6.85, -0.75, -0.05);
  M.color(D); M.boxB('steel', -0.88, -0.02, 7.0, 7.06, -0.9, 0.15); // toit de cabine
  // garde-corps de la plateforme, côté flèche
  M.cls = 1; M.tube('steel', 0.02, [[0.95, 6.5, 0.1], [0.95, 6.5, -0.9], [-0.95, 6.5, -0.9]], 4); for (const p of [[0.95, -0.9], [0.95, -0.4], [0.95, 0.1]]) M.tube('steel', 0.02, [[p[0], 5.5, p[1]], [p[0], 6.5, p[1]]], 4); M.cls = 0;
  // chevalet en A au-dessus de la salle des machines
  M.color(Yl); const ap = [0, 8.6, 0.9];
  for (const sd of [-1, 1]) { M.tube('paint', 0.06, [[sd * 0.7, 6.9, 0.3], ap], 6); M.tube('paint', 0.06, [[sd * 0.7, 6.9, 1.7], ap], 6); }
  M.save().move(0, ap[1], ap[2]).rotZ(Math.PI / 2); M.cyl('steel', 0.12, 0.3, 10); M.restore();
  // flèche en treillis : quatre membrures du pied (pivot sur l'avant de la plateforme) à la tête, section qui se resserre, treillis en zigzag
  const top = 6.0, z0 = -0.9, tip = [0, 9.5, -reach], N = 9;
  const P = (t, sx, sy) => { const w = lerp(0.36, 0.14, t), h = lerp(0.42, 0.16, t); return [sx * w, lerp(top, tip[1], t) + sy * h, lerp(z0, tip[2], t)]; };
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sy] of C) M.tube('paint', 0.045, [P(0, sx, sy), P(1, sx, sy)], 6);
  M.cls = 1;
  for (let f = 0; f < 4; f++) { const a = C[f], b = C[(f + 1) % 4]; const path = []; for (let k = 0; k <= N; k++) { const t = k / N, c = k % 2 ? b : a; path.push(P(t, c[0], c[1])); } for (let k = 0; k < N; k++) M.tube('paint', 0.022, [path[k], path[k + 1]], 4); }
  M.cls = 0;
  M.color(D); M.save().move(0, tip[1], tip[2]).rotZ(Math.PI / 2); M.cyl('steel', 0.2, 0.34, 12); M.restore(); // poulie de tête
  M.save().move(0, top, z0).rotZ(Math.PI / 2); M.cyl('steel', 0.12, 0.8, 10); M.restore(); // axe du pied
  // câbles de relevage (chevalet vers la tête), câble de levage et moufle, crochet
  M.color([0.14, 0.14, 0.14]); M.cls = 1;
  for (const sd of [-0.06, 0.06]) M.tube('steel', 0.012, [[sd, ap[1], ap[2]], [sd, tip[1] + 0.15, tip[2] + 0.1]], 3);
  M.tube('steel', 0.012, [[0, ap[1] - 0.2, ap[2] + 0.2], [0, 6.9, 1.4]], 3);
  for (const sd of [-0.05, 0.05]) M.tube('steel', 0.01, [[sd, tip[1] - 0.2, tip[2]], [sd, 4.3, tip[2]]], 3);
  M.cls = 0; M.color(D);
  M.save().move(0, 3.9, tip[2]); M.boxB('steel', -0.16, 0.16, 0, 0.42, -0.1, 0.1, { bevel: 0.03 }); M.save().move(0, 0.21, 0).rotZ(Math.PI / 2); M.cyl('steel', 0.13, 0.22, 10); M.restore(); M.restore();
  M.color([0.85, 0.65, 0.12]); M.tube('steel', 0.03, [[0, 3.9, tip[2]], [0, 3.62, tip[2]], [0.02, 3.42, tip[2] - 0.1], [0, 3.36, tip[2] - 0.22], [-0.01, 3.46, tip[2] - 0.28]], 6);
  M.aoFn = null;
  M.col(-0.6, 0.6, 0, 5.4, -0.6, 0.6, 'metal');
  M.col(-1.1, 1.1, 0, 0.5, -1.1, 1.1, 'metal');
});
/* Portique de manutention (élévateur à bateaux) enjambant la darse : quatre jambes sur roues, deux poutres le long de z,
   palans et sangles. Repère : centre au sol, poutres en x = ±w/2, jambes en z = ±L/2 */
PF.portique = (w = 11, L = 25, H = 10) => prefab(`portique${w}_${L}_${H}`, (M) => {
  M.local(1); const blue = [0.2, 0.38, 0.62];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * w / 2, z = sz * L / 2;
    M.color(blue); M.boxB('paint', x - 0.35, x + 0.35, 1.0, H, z - 0.35, z + 0.35, { bevel: 0.04 });
    M.color([0.15, 0.15, 0.15]); M.boxB('paint', x - 0.6, x + 0.6, 0.45, 1.0, z - 1.1, z + 1.1, { bevel: 0.04 });
    for (const dz of [-0.65, 0.65]) { M.save().move(x - 0.35, 0, z + dz); wheel(M, 0.45, 0.4, { side: -1, rim: [0.85, 0.7, 0.15] }); M.restore(); }
  }
  M.color(blue);
  for (const sx of [-1, 1]) M.boxB('paint', sx * w / 2 - 0.45, sx * w / 2 + 0.45, H, H + 1.3, -L / 2 - 0.5, L / 2 + 0.5, { bevel: 0.05 });
  for (const sz of [-1, 1]) M.boxB('paint', -w / 2, w / 2, H + 0.2, H + 1.1, sz * L / 2 - 0.4, sz * L / 2 + 0.4, { bevel: 0.04 });
  M.color([0.92, 0.75, 0.12]); M.cls = 1;
  for (const sx of [-1, 1]) for (let k = -L / 2 + 1; k < L / 2; k += 2.2) M.boxB('paint', sx * w / 2 - 0.47, sx * w / 2 + 0.47, H + 0.5, H + 0.62, k - 0.5, k + 0.5);
  M.cls = 0; M.color([0.2, 0.2, 0.2]);
  for (const sx of [-1, 1]) for (const z of [-4.5, 4.5]) {
    M.save().move(sx * (w / 2 - 0.6), H - 0.4, z); M.boxB('steel', -0.25, 0.25, 0, 0.4, -0.3, 0.3); M.restore();
    M.cls = 1; M.tube('steel', 0.015, [[sx * (w / 2 - 0.6), H - 0.4, z - 0.15], [sx * (w / 2 - 0.6), 2.6, z - 0.15]], 3); M.tube('steel', 0.015, [[sx * (w / 2 - 0.6), H - 0.4, z + 0.15], [sx * (w / 2 - 0.6), 2.6, z + 0.15]], 3); M.cls = 0;
  }
  M.color([0.12, 0.12, 0.12]); M.cls = 1;
  for (const z of [-4.5, 4.5]) M.tube('canvas', 0.05, sagPath([-w / 2 + 0.6, 2.6, z], [w / 2 - 0.6, 2.6, z], 1.8, 12), 5);
  M.cls = 0;
  M.color([0.95, 0.95, 0.92]); M.boxB('paint', -w / 2 - 0.46, -w / 2 - 0.44, H + 0.15, H + 1.15, -3, 3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.col(sx * w / 2 - 0.6, sx * w / 2 + 0.6, 0, H, sz * L / 2 - 1.1, sz * L / 2 + 1.1, 'metal');
  M.occ(-w / 2 - 0.5, w / 2 + 0.5, H, H + 1.3, -L / 2, L / 2, 0.35);
});
/* Machine à glace en écailles (d'après photos de machines de criée) : pieds, bac à glace en inox à panneaux et trappe, tambour évaporateur
   et son motoréducteur, groupe de condensation à deux ventilateurs grillagés, armoire électrique et voyants, liaisons frigorifiques en cuivre,
   tuyaux qui montent au plafond. Collision : le bloc (2,4 x 1,6 x 2,5 m) */
PF.iceMachine = () => prefab('iceMachine', (M) => {
  M.local(1); const ss = [0.74, 0.77, 0.79];
  M.color([0.3, 0.3, 0.32]); for (const x of [-1.1, 1.1]) for (const z of [-0.7, 0.7]) { M.save().move(x, 0, z); M.cyl('steel', 0.05, 0.35, 8); M.cyl('steel', 0.08, 0.02, 8); M.restore(); }
  M.boxB('steel', -1.2, 1.2, 0.3, 0.38, -0.8, 0.8);
  // bac à glace : panneaux d'inox, couvre-joints, trappe à charnières et poignée
  M.color(ss); M.boxB('steel', -1.2, 1.2, 0.38, 1.6, -0.8, 0.8, { bevel: 0.03 });
  M.color([0.66, 0.69, 0.71]); M.cls = 1;
  for (const x of [-0.6, 0, 0.6]) for (const sd of [-1, 1]) M.boxB('steel', x - 0.015, x + 0.015, 0.4, 1.58, sd * 0.8 - 0.006, sd * 0.8 + 0.006);
  M.boxB('steel', -0.5, 0.5, 0.75, 1.45, 0.8, 0.82, { bevel: 0.01 }); M.color([0.2, 0.2, 0.2]); M.boxB('steel', -0.2, 0.2, 1.32, 1.37, 0.82, 0.86, { bevel: 0.01 });
  for (const x of [-0.42, 0.42]) M.boxB('steel', x - 0.05, x + 0.05, 1.42, 1.47, 0.81, 0.84);
  M.cls = 0;
  // tambour évaporateur (gauche) et motoréducteur
  M.color(ss); M.save().move(-0.6, 1.6, 0); M.cyl('steel', 0.46, 0.7, 20); M.restore();
  M.color([0.62, 0.65, 0.67]); for (const y of [1.62, 2.28]) { M.save().move(-0.6, y, 0); M.cyl('steel', 0.49, 0.03, 20); M.restore(); }
  M.color([0.2, 0.36, 0.62]); M.save().move(-0.6, 2.31, 0); M.boxB('paint', -0.18, 0.18, 0, 0.18, -0.15, 0.15, { bevel: 0.02 }); M.save().move(0, 0.09, 0.15).rotX(Math.PI / 2); M.cyl('paint', 0.08, 0.22, 12); M.restore(); M.restore();
  // groupe de condensation (droite) : caisson bleu, deux ventilateurs en façade (+z)
  M.color([0.35, 0.55, 0.7]); M.boxB('paint', 0.1, 1.15, 1.6, 2.45, -0.7, 0.7, { bevel: 0.04 });
  for (const zc of [-0.3, 0.3]) {
    M.color([0.08, 0.08, 0.09]); M.save().move(0.62, 2.02, 0.705).rotX(Math.PI / 2); M.cyl('dark', 0.28, 0.01, 18); M.restore();
    M.color([0.25, 0.25, 0.27]); M.cls = 1;
    M.save().move(0.62, 2.02, 0.715); for (const r of [0.1, 0.18, 0.27]) M.tube('steel', 0.008, Array.from({ length: 17 }, (_, i) => [Math.cos((i / 16) * TAU) * r, Math.sin((i / 16) * TAU) * r, 0]), 3);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; M.tube('steel', 0.008, [[0, 0, 0], [Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0]], 3); } M.restore();
    M.cls = 0;
    if (zc > 0) break; // un seul ventilateur en façade, l'autre sur le flanc
  }
  M.color([0.08, 0.08, 0.09]); M.save().move(1.155, 2.02, 0).rotZ(Math.PI / 2); M.cyl('dark', 0.26, 0.01, 18); M.restore();
  // armoire électrique et voyants (flanc +x du bac)
  M.color([0.82, 0.82, 0.8]); M.boxB('paint', 1.2, 1.32, 0.7, 1.4, -0.35, 0.25, { bevel: 0.02 });
  M.color([0.1, 0.8, 0.2]); M.save().move(1.33, 1.2, 0.1).rotZ(-Math.PI / 2); M.cyl('plastic', 0.025, 0.02, 8); M.restore();
  M.color([0.85, 0.25, 0.1]); M.save().move(1.33, 1.2, -0.05).rotZ(-Math.PI / 2); M.cyl('plastic', 0.025, 0.02, 8); M.restore();
  // liaisons en cuivre, tuyaux vers le plafond
  M.color([0.72, 0.42, 0.25]); M.cls = 1;
  M.tube('steel', 0.022, [[0.1, 2.1, -0.4], [-0.14, 2.1, -0.4], [-0.14, 1.95, -0.4]], 5); M.tube('steel', 0.016, [[0.1, 1.9, -0.5], [-0.14, 1.9, -0.5], [-0.14, 1.8, -0.5]], 5);
  M.color([0.55, 0.55, 0.55]);
  for (const x of [-0.8, -0.3, 0.2, 0.7]) M.tube('steel', 0.05, [[x, 2.5, -0.55], [x, 3.2, -0.55], [x, 3.2, -1.2]], 6);
  M.cls = 0;
  M.col(-1.2, 1.2, 0, 2.5, -0.8, 0.8, 'metal');
});
/* Étal de criée (2,4 x 1,1 m) : table inox sur tréteaux, lit de glace et poissons, ardoise de prix ou balance */
PF.etal = (seed = 1) => prefab('etal' + seed, (M) => {
  const R = rngOf(seed * 19 + 1), w = 2.4, d = 1.1, y = 0.86;
  M.local(1); M.color([0.78, 0.8, 0.82]);
  M.boxB('steel', -w / 2, w / 2, y - 0.05, y, -d / 2, d / 2, { bevel: 0.01 });
  for (const s of [-1, 1]) { M.boxB('steel', -w / 2, w / 2, y, y + 0.1, s * d / 2 - 0.02 * s - 0.01, s * d / 2 + 0.01 - 0.02 * s); M.boxB('steel', s * w / 2 - 0.02, s * w / 2 + 0.01 * s, y, y + 0.1, -d / 2, d / 2); }
  M.color([0.55, 0.57, 0.6]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('steel', sx * (w / 2 - 0.12) - 0.03, sx * (w / 2 - 0.12) + 0.03, 0, y - 0.05, sz * (d / 2 - 0.1) - 0.03, sz * (d / 2 - 0.1) + 0.03);
  M.boxB('steel', -w / 2 + 0.1, w / 2 - 0.1, 0.18, 0.22, -d / 2 + 0.1, d / 2 - 0.1);
  M.save().move(0, y - 0.04, 0); fishIce(M, w / 2 - 0.06, d / 2 - 0.05, 0.16, rngOf(seed * 13 + 3)); fishPile(M, w / 2 - 0.06, d / 2 - 0.05, 0.16, seed, true); M.restore();
  // cagettes sous la table, ardoise ou balance
  if (R() < 0.7) { M.save().move((R() - 0.5) * 1.2, 0.22, 0).rotY(R() * 0.3); M.dyn('fishBin', 0, 0, 0, 0, { tint: R.pick([[0.15, 0.36, 0.72], [0.95, 0.5, 0.08], [0.85, 0.85, 0.82]]) }); M.restore(); }
  if (R() < 0.6) {
    // ardoise des prix plantée dans la glace, face au client (-z)
    const x = R() < 0.5 ? -0.7 : 0.7;
    M.save().move(x, y + 0.1, -d / 2 + 0.12).rotX(0.2); M.color([0.4, 0.3, 0.2]); M.boxB('wood', -0.025, 0.025, -0.1, 0.05, 0.01, 0.04); M.restore();
    M.save().move(x, y + 0.12, -d / 2 + 0.1).rotX(0.2); decal3Quad(M, DEC3.prix, [0.25, 0, -0.005], [-0.25, 0, -0.005], [-0.25, 0.42, -0.005], [0.25, 0.42, -0.005], [0, 0, -1], [0.06, 0.03, 0.88, 0.94]); M.restore();
  } else {
    M.save().move(R.range(-0.7, 0.7), y + 0.1, -d / 2 + 0.25); M.color([0.85, 0.85, 0.82]); M.boxB('plastic', -0.18, 0.18, 0, 0.12, -0.15, 0.15, { bevel: 0.02 }); M.color([0.75, 0.77, 0.8]); M.boxB('steel', -0.16, 0.16, 0.12, 0.14, -0.14, 0.14); M.color([0.1, 0.3, 0.12]); M.boxB('glass', -0.08, 0.08, 0.04, 0.1, -0.151, -0.15); M.restore();
  }
  // collisions : plateau et rebords, pieds, tablette réservée aux objets (la cagette s'y pose et réagit aux tirs ; dans un bloc plein
  // jusqu'au plateau, elle était prise dans la table)
  M.col(-w / 2, w / 2, y - 0.05, y + 0.1, -d / 2, d / 2, 'metal');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.col(sx * (w / 2 - 0.12) - 0.03, sx * (w / 2 - 0.12) + 0.03, 0, y - 0.05, sz * (d / 2 - 0.1) - 0.03, sz * (d / 2 - 0.1) + 0.03, 'metal');
  M.pcol(-w / 2 + 0.1, w / 2 - 0.1, 0.18, 0.22, -d / 2 + 0.1, d / 2 - 0.1);
});
/* Cadran des ventes : caisson lumineux suspendu, deux faces (repère : centre du caisson) */
PF.cadran = () => prefab('cadran', (M) => {
  M.local(1); M.color([0.12, 0.12, 0.13]);
  M.boxB('steel', -1.6, 1.6, -1.0, 1.0, -0.25, 0.25, { bevel: 0.03 });
  for (const sd of [-1, 1]) { M.save().rotY(sd > 0 ? 0 : Math.PI); decal3Quad(M, DEC3.cadran, [-1.45, -0.9, 0.26], [1.45, -0.9, 0.26], [1.45, 0.9, 0.26], [-1.45, 0.9, 0.26], [0, 0, 1], [0.03, 0.03, 0.94, 0.94], 'screen'); M.restore(); }
  M.color([0.2, 0.2, 0.2]); M.cls = 1;
  for (const x of [-1.3, 1.3]) M.tube('steel', 0.01, [[x, 1.0, 0], [x, 4.0, 0]], 3);
});
/* Tapis de vente (convoyeur à bande de criée, d'après photos) de longueur L le long de x, hauteur 0,9 m : longerons en U, tambours aux deux
   bouts, bande dessus et brin de retour dessous, pieds réglables entretoisés, garde-corps bas le long de la bande, motoréducteur au bout +x ;
   bacs de poisson posés dessus */
PF.conveyor = (L = 10) => prefab('conveyor' + L, (M) => {
  M.local(1); M.color([0.7, 0.72, 0.74]);
  for (const s of [-1, 1]) { M.boxB('steel', -L / 2, L / 2, 0.7, 0.9, s * 0.42 - 0.04, s * 0.42 + 0.04); M.boxB('steel', -L / 2, L / 2, 0.88, 0.9, s * 0.42 - (s > 0 ? 0.06 : -0.02), s * 0.42 + (s > 0 ? -0.02 : 0.06)); }
  const legs = []; for (let x = -L / 2 + 0.3; x < L / 2; x += 1.4) legs.push(x);
  for (const x of legs) { for (const s of [-1, 1]) { M.boxB('steel', x - 0.035, x + 0.035, 0.03, 0.7, s * 0.38 - 0.03, s * 0.38 + 0.03); M.boxB('steel', x - 0.06, x + 0.06, 0, 0.03, s * 0.38 - 0.06, s * 0.38 + 0.06); } M.boxB('steel', x - 0.025, x + 0.025, 0.22, 0.27, -0.38, 0.38); }
  M.cls = 1; for (const s of [-1, 1]) { M.tube('steel', 0.015, [[-L / 2 + 0.1, 1.0, s * 0.43], [L / 2 - 0.1, 1.0, s * 0.43]], 5); for (const x of legs) M.tube('steel', 0.012, [[x, 0.9, s * 0.43], [x, 1.0, s * 0.43]], 4); } M.cls = 0;
  M.color([0.6, 0.62, 0.64]); for (const x of [-L / 2 + 0.06, L / 2 - 0.06]) { M.save().move(x, 0.8, -0.4).rotX(Math.PI / 2); M.cyl('steel', 0.065, 0.8, 14); M.restore(); }
  M.color([0.16, 0.17, 0.18]); M.boxB('rubber', -L / 2 + 0.06, L / 2 - 0.06, 0.84, 0.866, -0.38, 0.38); M.boxB('rubber', -L / 2 + 0.06, L / 2 - 0.06, 0.73, 0.746, -0.38, 0.38);
  M.color([0.2, 0.36, 0.62]); M.save().move(L / 2 - 0.25, 0.55, 0.42); M.boxB('paint', -0.16, 0.16, -0.14, 0.14, 0, 0.22, { bevel: 0.02 }); M.save().move(0, 0, 0.22).rotX(Math.PI / 2); M.cyl('paint', 0.1, 0.26, 12); M.restore(); M.restore();
  const R = rngOf(L * 7);
  for (let x = -L / 2 + 0.7; x < L / 2 - 0.5; x += 1.1 + R() * 0.8) { M.save().move(x, 0.866, 0).rotY(Math.PI / 2 + (R() - 0.5) * 0.2); M.put(PF.fishBinStackDyn(1, Math.floor(R() * 4))); M.restore(); }
  M.col(-L / 2, L / 2, 0, 0.9, -0.46, 0.46, 'metal');
});
/* Chambre froide en panneaux isolants (d'après photos) : panneaux blancs à joints verticaux sur les quatre faces, cornières d'aluminium
   aux arêtes, porte coulissante à joint et poignée, rail, plinthe d'inox, afficheur de température, groupe de condensation sur le toit avec
   son ventilateur grillagé et ses liaisons ; w (x), d (z), h ; porte face +z */
PF.coldRoom = (w = 4, d = 3, h = 3) => prefab(`coldRoom${w}_${d}_${h}`, (M) => {
  M.local(1); M.color([0.9, 0.91, 0.9]); M.aoFn = (x, y) => lerp(0.62, 1, smoothstep(0, 0.8, y));
  M.boxB('paint', -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.03 }); M.aoFn = null;
  M.color([0.74, 0.76, 0.77]); M.cls = 1;
  for (let x = -w / 2 + 1.0; x < w / 2 - 0.05; x += 1.0) for (const sd of [-1, 1]) M.boxB('paint', x - 0.008, x + 0.008, 0.02, h - 0.02, sd * d / 2 - 0.004, sd * d / 2 + 0.006);
  for (let z = -d / 2 + 1.0; z < d / 2 - 0.05; z += 1.0) for (const sd of [-1, 1]) M.boxB('paint', sd * w / 2 - 0.004, sd * w / 2 + 0.006, 0.02, h - 0.02, z - 0.008, z + 0.008);
  M.color([0.78, 0.8, 0.82]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('steel', sx * w / 2 - 0.04, sx * w / 2 + 0.04, 0, h + 0.01, sz * d / 2 - 0.04, sz * d / 2 + 0.04);
  for (const sz of [-1, 1]) M.boxB('steel', -w / 2 - 0.04, w / 2 + 0.04, h - 0.03, h + 0.02, sz * d / 2 - 0.04, sz * d / 2 + 0.04);
  for (const sx of [-1, 1]) M.boxB('steel', sx * w / 2 - 0.04, sx * w / 2 + 0.04, h - 0.03, h + 0.02, -d / 2, d / 2);
  M.boxB('steel', -w / 2 - 0.01, w / 2 + 0.01, 0, 0.15, d / 2, d / 2 + 0.008); // plinthe d'inox
  M.cls = 0;
  // porte coulissante (entrouverte vers -x), joint, poignée, rail
  M.color([0.82, 0.84, 0.85]); M.boxB('paint', -0.95, 0.45, 0.02, 2.3, d / 2 + 0.02, d / 2 + 0.11, { bevel: 0.02 });
  M.color([0.2, 0.2, 0.2]); M.boxB('rubber', -0.97, 0.47, 0.02, 2.32, d / 2 + 0.01, d / 2 + 0.03);
  M.color([0.7, 0.72, 0.74]); M.boxB('steel', 0.3, 0.36, 0.9, 1.45, d / 2 + 0.11, d / 2 + 0.16, { bevel: 0.01 });
  M.color([0.18, 0.18, 0.2]); M.boxB('steel', -1.7, 1.2, 2.35, 2.45, d / 2 + 0.02, d / 2 + 0.12);
  M.color([0.04, 0.05, 0.05]); M.boxB('dark', 0.75, 0.95, 1.6, 1.72, d / 2 + 0.008, d / 2 + 0.03); M.color([0.95, 0.2, 0.1]); M.boxB('paint', 0.78, 0.92, 1.63, 1.69, d / 2 + 0.031, d / 2 + 0.034); // afficheur
  // groupe de condensation sur le toit
  const ux0 = -w / 2 + 0.3, ux1 = -w / 2 + 1.5;
  M.color([0.55, 0.58, 0.6]); M.boxB('steel', ux0, ux1, h, h + 0.6, -0.5, 0.5, { bevel: 0.03 });
  M.color([0.08, 0.08, 0.09]); M.save().move((ux0 + ux1) / 2, h + 0.601, 0); M.cyl('dark', 0.3, 0.005, 18); M.restore();
  M.color([0.3, 0.3, 0.32]); M.cls = 1; M.save().move((ux0 + ux1) / 2, h + 0.61, 0); for (const r of [0.12, 0.21, 0.3]) M.tube('steel', 0.008, Array.from({ length: 17 }, (_, i) => [Math.cos((i / 16) * TAU) * r, 0, Math.sin((i / 16) * TAU) * r]), 3); M.restore();
  M.color([0.72, 0.42, 0.25]); M.tube('steel', 0.02, [[ux1, h + 0.2, 0.3], [ux1 + 0.4, h + 0.2, 0.3], [ux1 + 0.4, h + 0.02, 0.3]], 5); M.cls = 0;
  M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, 'metal');
});
/* Palette de sacs de glace (filmée) */
PF.icePallet = () => prefab('icePallet', (M) => {
  M.place(PF.pallet(), 0, 0, 0, 0);
  M.local(1); M.color([0.88, 0.93, 0.96]);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) M.boxB('plastic', -0.58 + i * 0.6, -0.02 + i * 0.6, 0.13 + j * 0.25, 0.36 + j * 0.25, -0.38 + k * 0.39, -0.01 + k * 0.39, { bevel: 0.06 });
  M.col(-0.6, 0.6, 0, 0.9, -0.4, 0.4, 'dirt');
});

/* ---------- Architecture bretonne ---------- */
const PAL_BZH = {
  wash: [[0.95, 0.94, 0.9], [0.93, 0.9, 0.84], [0.9, 0.9, 0.88], [0.96, 0.93, 0.86]],
  // la photo de pierre est un grès chaud : le granite breton demande une teinte plus froide et plus sombre
  granite: [[0.6, 0.63, 0.66], [0.56, 0.58, 0.6], [0.64, 0.64, 0.64]],
  shutter: [[0.18, 0.36, 0.55], [0.2, 0.45, 0.42], [0.62, 0.16, 0.12], [0.3, 0.5, 0.65], [0.86, 0.84, 0.78]],
  door: [[0.16, 0.3, 0.5], [0.55, 0.15, 0.12], [0.2, 0.42, 0.36], [0.32, 0.24, 0.18]],
};
/* Toit d'ardoise à deux pans sur le bloc [x0, x1] x [z0, z1], égout à y : faîtage en lignolet, rives, pignons de granit
   montés en cheminées, lucarnes côté face (o.dormers : façade 'n','s','e','w'). o : alongX, pitch, R, gable (teinte des
   pignons), dormers, chimneys (0, 1 ou 2) */
function slateRoof(x0, x1, z0, z1, y, o = {}) {
  const M = DECOR, alongX = o.alongX !== undefined ? o.alongX : x1 - x0 >= z1 - z0, span = alongX ? z1 - z0 : x1 - x0, len = alongX ? x1 - x0 : z1 - z0;
  const R = o.R || rngOf(Math.round(x0 * 7 + z0 * 13 + y)), pitch = o.pitch || 0.82, tn = Math.tan(pitch), rise = (span / 2) * tn, ov = 0.25, drop = ov * tn;
  const hs = span / 2 + ov, nl = hyp(hs, rise + drop), tint = o.tint || [0.62, 0.64, 0.7], gt = o.gable || R.pick(PAL_BZH.granite), mat = o.mat || 'slate';
  M.save();
  if (alongX) M.move(x0, y, (z0 + z1) / 2); else M.move((x0 + x1) / 2, y, z1).rotY(Math.PI / 2);
  for (const s of [1, -1]) {
    M.color(tint).world(1);
    M.quad(mat, [-0.06, -drop, s * hs], [len + 0.06, -drop, s * hs], [len + 0.06, rise, 0], [-0.06, rise, 0], [0, hs / nl, (s * (rise + drop)) / nl]);
    M.color([0.3, 0.3, 0.32]).local(1); M.quad(mat, [-0.06, -drop - 0.04, s * hs], [len + 0.06, -drop - 0.04, s * hs], [len + 0.06, rise - 0.04, 0], [-0.06, rise - 0.04, 0], [0, -1, 0]);
    // gouttière de zinc
    M.color([0.6, 0.62, 0.64]); M.cls = 1;
    M.save().move(-0.06, -drop - 0.06, s * (hs + 0.06)).rotZ(-Math.PI / 2); M.cyl('steel', 0.06, len + 0.12, 8, { a0: -Math.PI / 2, a1: Math.PI / 2, caps: '' }); M.restore();
    M.cls = 0;
  }
  // faîtage (lignolet d'ardoise)
  M.color(tint.map((c) => c * 0.8)).local(1); M.save().move(-0.06, rise + 0.02, 0).rotZ(-Math.PI / 2); M.cyl(mat, 0.07, len + 0.12, 6, { a0: Math.PI / 2, a1: Math.PI * 1.5 }); M.restore();
  // pignons de granit qui dépassent légèrement (rampants), cheminées massives
  M.color(gt).world(1);
  for (const [xx, dir] of [[0, -1], [len, 1]]) {
    M.tri3(o.gableMat || 'stone', [xx, 0, -span / 2], [xx, 0, span / 2], [xx, rise, 0], [dir, 0, 0]);
    if (o.rampants !== false) for (const s of [1, -1]) { const dy = rise + drop, dz = -s * hs, L = hyp(dy, dz); M.save().move(xx - dir * 0.12, (rise - drop) / 2 + 0.07, (s * hs) / 2).rotX(Math.atan2(-dy, dz)); M.box('stone', 0.4, 0.16, L); M.restore(); }
  }
  const nc = o.chimneys !== undefined ? o.chimneys : 2;
  for (const [k, xx] of [[0, 0.3], [1, len - 0.3]]) if (k < nc) {
    M.color(gt).world(1); M.boxB('stone', xx - 0.45, xx + 0.45, rise - 0.6, rise + 1.15, -0.5, 0.5);
    M.color([0.66, 0.64, 0.6]).local(1); M.boxB('stone', xx - 0.5, xx + 0.5, rise + 1.15, rise + 1.25, -0.55, 0.55, { bevel: 0.02 });
    M.color([0.62, 0.36, 0.26]); for (const zz of [-0.22, 0.22]) { M.save().move(xx, rise + 1.25, zz); M.cyl('rooftiles', 0.1, 0.35, 8, { r1: 0.08 }); M.restore(); }
  }
  // lucarnes sur le pan avant (s = 1 : vers +z du repère du toit)
  for (const [s, n] of o.dormers || []) for (let i = 0; i < n; i++) {
    const xc = len * (i + 0.5) / n, zf = s * span * 0.5 * 0.7, yb = (span / 2 - Math.abs(zf)) * tn, w = 1.1, hh = 1.35;
    M.save().move(xc, 0, zf).rotY(s > 0 ? 0 : Math.PI);
    M.color(R.pick(PAL_BZH.wash)).world(1); M.boxB('plaster', -w / 2, w / 2, yb - 0.3, yb + hh, -1.6, 0, { skip: 'z' });
    // châssis en saillie de 1,5 cm et vitre devant lui : au ras de la façade, le châssis scintillait avec l'enduit et la vitre, derrière, ne se voyait pas
    M.local(1); M.color([0.92, 0.92, 0.9]); M.boxB('paintwood', -w / 2 + 0.12, w / 2 - 0.12, yb + 0.1, yb + hh - 0.15, -0.06, 0.015);
    M.color([0.3, 0.36, 0.42]); M.boxB('glass', -w / 2 + 0.18, w / 2 - 0.18, yb + 0.16, yb + hh - 0.21, 0.015, 0.025, { skip: 'z' });
    M.color(tint); const pr = 0.62;
    for (const sd of [-1, 1]) M.quad('slate', [sd * (w / 2 + 0.12), yb + hh, 0.12], [0, yb + hh + pr, 0.12], [0, yb + hh + pr, -1.8], [sd * (w / 2 + 0.12), yb + hh, -1.8], [sd * pr, w / 2 + 0.12, 0]);
    M.color(R.pick(PAL_BZH.wash)); M.tri3('plaster', [-w / 2, yb + hh, 0.0], [w / 2, yb + hh, 0.0], [0, yb + hh + pr - 0.05, 0.0], [0, 0, 1]);
    M.restore();
  }
  M.occ(-ov, len + ov, -drop, rise * 0.6, -hs, hs, 1);
  M.col(0, len, 0, rise * 0.55, -span / 2 + 0.3, span / 2 - 0.3, 'concrete');
  M.restore();
  return { rise, span, len };
}
/* Maison de pêcheur : bloc plein (collision), façades détaillées sur o.faces (rez de granit ou enduit, porte, fenêtres
   à petits bois et volets, linteaux et appuis de granit), toit d'ardoise à lucarnes. o : h (égout), floors, faces,
   door (côté de la porte), shop (vitrine au rez : index d'enseigne SIGNS3), tint, stone (rez de granit), R */
function portHouse(x0, x1, z0, z1, o = {}) {
  const R = o.R || rngOf(Math.round(x0 * 71 + z0 * 137) + 515), h = o.h || 6.2, faces = o.faces || 'nsew';
  const tint = o.tint || R.pick(PAL_BZH.wash), granite = R.pick(PAL_BZH.granite), shut = o.shutter || R.pick(PAL_BZH.shutter);
  const alongX = o.alongX !== undefined ? o.alongX : x1 - x0 >= z1 - z0, stone = o.stone !== undefined ? o.stone : R() < 0.5, g0 = o.g0 || 0;
  // g0 : rez-de-chaussée praticable construit à part (le bloc et ses façades ne commencent qu'à l'étage)
  DECOR.col(x0, x1, g0, h, z0, z1, 'concrete');
  for (const f of 'nsew') {
    const F = facadeFrame(f, x0, x1, z0, z1), len = F.len, det = faces.indexOf(f) >= 0;
    const gableSide = alongX ? f === 'e' || f === 'w' : f === 'n' || f === 's';
    inFrame(F, (M) => {
      if (!det) { M.save().color(stone && !g0 ? granite : tint).world(1).move(0, g0, 0); M.wall(stone && !g0 ? 'stone' : 'plaster', len, h - g0, []); M.restore(); return; }
      const bays = Math.max(1, Math.round(len / 2.6)), bw = len / bays, mid = Math.floor(bays / 2), ops0 = [], ops1 = [], after = [];
      for (let i = 0; i < bays && !g0; i++) {
        const a = bw * (i + 0.5);
        if (o.shop !== undefined && o.door === f && i !== mid) { const op = { x0: a - bw * 0.4, x1: a + bw * 0.4, y0: 0.45, y1: 2.5, depth: 0.25 }; ops0.push(op); after.push((MM) => { windowJoinery(MM, op, 0.25, [0.2, 0.3, 0.42], { glass: 'glassLit' }); }); continue; }
        // une porte dans une zone NO_DOOR (un camion, un conteneur, une maison devant) : mur plein, mêmes tirages
        if (o.door === f && i === mid && NO_DOOR.some((q) => { const wx = F.ox + a * Math.cos(F.rot), wz = F.oz - a * Math.sin(F.rot); return wx > q[0] && wx < q[1] && wz > q[2] && wz < q[3]; })) { R.pick(PAL_BZH.door); after.push(() => { R(); }); continue; }
        if (o.door === f && i === mid) { const op = { x0: a - 0.55, x1: a + 0.55, y0: 0, y1: 2.3, depth: 0.28 }; ops0.push(op); const dt = R.pick(PAL_BZH.door); after.push((MM) => { panelDoor(MM, op, 0.28, dt, {}); lintel(MM, op, 'stone', granite); if (R() < 0.7) wallLamp(MM, a + 0.95, 2.4); }); continue; }
        if (gableSide && R() < 0.5) continue;
        const op = { x0: a - 0.45, x1: a + 0.45, y0: 0.95, y1: 2.25, depth: 0.28 }; ops0.push(op);
        const st = R() < 0.25 ? 'closed' : 'open', lit = R() < 0.3;
        after.push((MM) => { if (st !== 'closed') windowJoinery(MM, op, 0.28, [0.94, 0.94, 0.92], { glass: lit ? 'glassLit' : 'glass', curtain: R() < 0.5 ? R.pick([[0.9, 0.88, 0.82], [0.75, 0.2, 0.15]]) : null }); sill(MM, op, 'stone', granite); lintel(MM, op, 'stone', granite); shutters(MM, op, shut, st, R); });
      }
      for (let fy = 3.1; fy + 1.5 <= h - 0.2; fy += 2.8) for (let i = 0; i < bays; i++) {
        if (gableSide && R() < 0.45) continue;
        const a = bw * (i + 0.5), op = { x0: a - 0.42, x1: a + 0.42, y0: fy + 0.65, y1: fy + 1.95, depth: 0.25 }; ops1.push(op);
        const st = R() < 0.2 ? 'closed' : 'open', lit = R() < 0.3;
        after.push((MM) => { if (st !== 'closed') windowJoinery(MM, op, 0.25, [0.94, 0.94, 0.92], { glass: lit ? 'glassLit' : 'glass' }); sill(MM, op, 'stone', granite); shutters(MM, op, shut, st, R); });
      }
      const gf = 3.0;
      if (!g0) { M.save().color(stone ? granite : tint).world(1); M.aoFn = (x, y) => lerp(0.7, 1, smoothstep(0, 1.2, y)); wallPierced(M, stone ? 'stone' : 'plaster', len, 0, gf, ops0, { depth: 0.25, back: true }); M.restore(); }
      M.save().color(tint).world(1);
      wallPierced(M, 'plaster', len, Math.max(gf, g0), h - Math.max(gf, g0), ops1, { depth: 0.25, back: true });
      M.restore();
      // chaînes d'angle en granit, bandeau, soubassement
      M.save().color(granite).world(1);
      for (const x of [0, len]) for (let y = g0, k = 0; y < h - 0.2; y += 0.5, k++) { const w = k % 2 ? 0.32 : 0.55; lbox(M, 'stone', x === 0 ? -0.02 : len - w, x === 0 ? w : len + 0.02, y, y + 0.46, 0, 0.05); }
      if (!stone && !g0) { let cur = 0; for (const p of ops0.filter((q) => q.y0 < 0.6)) { if (p.x0 - cur > 0.05) plinthSeg(M, cur, p.x0, { mat: 'stone', h: 0.6, tint: granite }); cur = p.x1; } if (len - cur > 0.05) plinthSeg(M, cur, len, { mat: 'stone', h: 0.6, tint: granite }); }
      M.restore();
      for (const fn of after) fn(M);
      if (o.shop !== undefined && o.door === f && !g0) sign3Board(M, len / 2, 2.65, Math.min(len - 0.6, 4.2), 0.75, o.shop, [0.2, 0.2, 0.22]);
      if (len > 5 && R() < 0.6) drainPipe(M, R() < 0.5 ? 0.3 : len - 0.3, h - 0.1);
    });
  }
  // lucarnes sur les pans tournés vers une façade détaillée (repère du toit : +z local vers le sud, ou vers l'est si le faîtage suit z)
  const dorm = o.dormers !== false ? [...faces].filter((f) => (alongX ? f === 'n' || f === 's' : f === 'e' || f === 'w')).map((f) => [alongX ? (f === 's' ? 1 : -1) : (f === 'e' ? 1 : -1), Math.max(1, Math.round((alongX ? x1 - x0 : z1 - z0) / 4.5))]) : [];
  slateRoof(x0, x1, z0, z1, h, { alongX, R, gable: granite, dormers: dorm, chimneys: o.chimneys });
}
/* Phare à l'extrémité d'une digue : tour tronconique blanche à bande rouge (ou verte), galerie, lanterne */
function lighthouse(x, z, h = 16, band = [0.78, 0.12, 0.1], y0 = 0) {
  const M = DECOR;
  M.save().move(x, y0, z).local(1);
  M.color([0.95, 0.95, 0.92]); M.cyl('plaster', 2.0, h, 18, { r1: 1.4, caps: '' });
  M.color(band); M.save().move(0, h * 0.62, 0); M.cyl('paint', 1.62, h * 0.22, 18, { r1: 1.5, caps: '' }); M.restore();
  M.color([0.2, 0.2, 0.22]); M.save().move(0, h, 0); M.cyl('steel', 2.0, 0.25, 18); M.restore();
  M.color([0.25, 0.25, 0.27]); M.save().move(0, h + 0.25, 0); M.cyl('steel', 1.0, 1.6, 12, { caps: '' }); M.restore();
  M.color([3.0, 2.4, 1.4]); M.save().move(0, h + 0.5, 0); M.cyl('lamp', 0.7, 1.0, 10); M.restore();
  M.color(band); M.save().move(0, h + 1.85, 0); M.lathe('paint', [[0, 0], [1.15, 0], [0.9, 0.5], [0.15, 1.1], [0, 1.2]], 12); M.restore();
  M.color([0.2, 0.2, 0.2]); M.cls = 1; M.save().move(0, h + 0.25, 0); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; M.save().move(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9); M.cyl('steel', 0.02, 0.9, 4); M.restore(); } M.restore();
  M.restore();
}
