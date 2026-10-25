/* ==========================================================================
   CAMOUFLAGES
   Dix camouflages procéduraux dessinés au premier usage sur une toile 2D raccordable de 256 pixels (une graine fixe par
   camouflage), plaqués sur le métal, le polymère et les garnitures de l'arme par un mélange triplanaire dans le repère de
   l'arme : le motif garde la même échelle sur toutes les pièces, qu'elles soient grandes ou minuscules, et sur l'arme
   en main comme sur l'arme d'un soldat. Les pièces sombres (rails, canon, optiques) gardent leur teinte.
   Un camouflage se débloque par paliers de niveau de l'arme (lvl), sans autre condition (choix du propriétaire : l'Or demandait aussi
   30 tirs à la tête, le Diamant 250 éliminations, le Holo le Diamant) ; l'état de déblocage est dans 06r-arsenal.js.
   Holo : une feuille holographique. Sa toile ne porte qu'un champ de plis en niveaux de gris ; le nuanceur en tire une teinte
   irisée pastel (cyan, lilas, rose, blanc nacré, menthe) qui suit l'angle de vue et la direction du reflet, comme une couche
   mince : la couleur glisse sur l'arme quand elle bouge, et dérive lentement avec le temps. Ce qui la fait briller (retour du
   propriétaire : la première version faisait mat) : un métal poli qui reflète le décor dans cette teinte, des bandes de lumière
   nettes le long des plis qui glissent avec le regard (assez vives pour le halo lumineux), un liseré clair sur les bords et
   des paillettes qui s'allument selon l'angle (pas en qualité Basse : sous le pixel, elles scintilleraient). Même programme
   que les autres camouflages (uHolo), aucune texture de plus.
   ========================================================================== */
const CAMOS = {
  desert: { name: _t('Désert'), lvl: 3, seed: 11 },
  foret: { name: _t('Forêt'), lvl: 5, seed: 23 },
  urbain: { name: _t('Urbain'), lvl: 7, seed: 37 },
  neige: { name: _t('Neige'), lvl: 9, seed: 41 },
  tigre: { name: _t('Tigre'), lvl: 11, seed: 53 },
  cobalt: { name: _t('Cobalt'), lvl: 13, seed: 67 },
  braise: { name: _t('Braise'), lvl: 15, seed: 71 },
  or: { name: 'Or', lvl: 18, seed: 83, metal: 0.95, rough: 0.28 },
  diamant: { name: _t('Diamant'), lvl: 20, seed: 97, metal: 0.85, rough: 0.16 },
  holo: { name: 'Holo', lvl: 30, seed: 101, metal: 1, rough: 0.1, scale: 0.24 },
};
for (const id in CAMOS) CAMOS[id].id = id;
const CAMO_N = 256;
/* Dessine fn aux neuf positions voisines : ce qui déborde d'un bord reparaît du côté opposé (motif raccordable) */
function camoWrap(g, fn) { for (const dx of [-CAMO_N, 0, CAMO_N]) for (const dy of [-CAMO_N, 0, CAMO_N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }
/* Tache irrégulière centrée en (x, y), éventuellement allongée (sq) et tournée (ang) */
function camoBlob(g, rnd, x, y, r, col, sq = 1, ang = 0) {
  camoWrap(g, () => {
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, rr = r * (0.55 + rnd() * 0.75), px = Math.cos(a) * rr, py = Math.sin(a) * rr * sq; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fill(); g.restore();
  });
}
/* Motif pixelisé : un bruit de valeur raccordable choisit la couleur de chaque case */
function camoDigital(g, rnd, cols, cell) {
  const L = 12, lat = Array.from({ length: L * L }, () => rnd());
  const v = (x, y) => {
    x = x / CAMO_N * L; y = y / CAMO_N * L; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = lat[(yi % L) * L + (xi % L)], b = lat[(yi % L) * L + ((xi + 1) % L)], c = lat[(((yi + 1) % L)) * L + (xi % L)], d = lat[((yi + 1) % L) * L + ((xi + 1) % L)];
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
  for (let y = 0; y < CAMO_N; y += cell) for (let x = 0; x < CAMO_N; x += cell) {
    const k = Math.floor((v(x + cell / 2, y + cell / 2) * 1.5 - 0.25 + (rnd() - 0.5) * 0.5) * cols.length);
    g.fillStyle = cols[Math.max(0, Math.min(cols.length - 1, k))]; g.fillRect(x, y, cell, cell);
  }
}
const CAMO_DRAW = {
  desert: (g, rnd) => {
    for (let i = 0; i < 46; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 16 + rnd() * 26, ['#d6c08a', '#8a6a3e', '#a58a52'][i % 3], 0.6 + rnd() * 0.4, rnd() * TAU);
    for (let i = 0; i < 26; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 5 + rnd() * 9, '#5e4d2e', 0.5 + rnd() * 0.5, rnd() * TAU);
  },
  foret: (g, rnd) => {
    for (let i = 0; i < 52; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 14 + rnd() * 24, ['#2c3a1e', '#6b5b36', '#7d8a4a', '#1b1f14'][i % 4], 0.55 + rnd() * 0.45, rnd() * TAU);
    for (let i = 0; i < 24; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 4 + rnd() * 7, '#0f120c', 0.6, rnd() * TAU);
  },
  urbain: (g, rnd) => camoDigital(g, rnd, ['#3b3d40', '#5a5d60', '#7a7d80', '#9a9da0', '#b5b8bb'], 8),
  neige: (g, rnd) => {
    for (let i = 0; i < 90; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 10 + rnd() * 24, ['#aab4bd', '#c9d1d8', '#7d8a96', '#d9dee3'][i % 4], 0.22 + rnd() * 0.2, (rnd() < 0.5 ? 0.45 : -0.45) + (rnd() - 0.5) * 0.4);
  },
  tigre: (g, rnd) => {
    for (let i = 0; i < 20; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 14 + rnd() * 20, i % 2 ? '#e0a04a' : '#8f4d1a', 0.5, rnd() * TAU);
    for (let i = 0; i < 17; i++) {
      const x0 = (i + rnd() * 0.5) * CAMO_N / 17, w = 5 + rnd() * 9, ph = rnd() * TAU, amp = 6 + rnd() * 10;
      camoWrap(g, () => {
        g.fillStyle = '#16110c'; g.beginPath();
        const L = [], R = [];
        for (let y = -8; y <= CAMO_N + 8; y += 4) { const cx = x0 + Math.sin(y * 0.045 + ph) * amp + Math.sin(y * 0.11 + ph * 2) * amp * 0.35, ww = w * (0.35 + 0.65 * Math.abs(Math.sin(y * 0.03 + ph))); L.push([cx - ww, y]); R.push([cx + ww, y]); }
        L.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); R.reverse().forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill();
      });
    }
  },
  cobalt: (g, rnd) => camoDigital(g, rnd, ['#0a1020', '#14264a', '#1c3768', '#2f5fb0', '#4b86d8'], 6),
  braise: (g, rnd) => {
    for (let i = 0; i < 30; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 10 + rnd() * 22, i % 2 ? '#22171a' : '#0c0808', 0.7, rnd() * TAU);
    for (let k = 0; k < 24; k++) {
      let x = rnd() * CAMO_N, y = rnd() * CAMO_N, a = rnd() * TAU; const pts = [[x, y]];
      for (let s = 0; s < 6 + Math.floor(rnd() * 8); s++) { a += (rnd() - 0.5) * 1.5; x += Math.cos(a) * (8 + rnd() * 14); y += Math.sin(a) * (8 + rnd() * 14); pts.push([x, y]); }
      for (const [col, wd] of [['#b32a0c', 4.5], ['#ff6a1f', 2.6], ['#ffd57a', 1.1]]) camoWrap(g, () => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); });
    }
  },
  or: (g, rnd) => {
    for (let i = 0; i < 2600; i++) { g.fillStyle = i % 2 ? 'rgba(255,232,150,0.16)' : 'rgba(110,72,0,0.14)'; g.fillRect(rnd() * CAMO_N, rnd() * CAMO_N, 1 + rnd() * 3, 1 + rnd() * 2); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,245,190,0.07)'; g.fillRect(rnd() * CAMO_N, 0, 1 + rnd() * 2, CAMO_N); }
  },
  diamant: (g, rnd) => {
    const cell = 32, cols = ['#8fc5f0', '#bfe3ff', '#e6f6ff', '#6ea8d8', '#a8d4f5'];
    for (let y = 0; y < CAMO_N; y += cell) for (let x = 0; x < CAMO_N; x += cell) for (const flip of [0, 1]) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.beginPath();
      if (flip) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); g.lineTo(x, y + cell); } else { g.moveTo(x, y); g.lineTo(x + cell, y); g.lineTo(x, y + cell); }
      g.closePath(); g.fill();
    }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(rnd() * CAMO_N, rnd() * CAMO_N, 1.5, 1.5); }
  },
  // plis de la feuille : ondes de fréquences entières (raccordables) dans un domaine tordu par d'autres ondes, de longues bandes souples
  holo: (g, rnd) => {
    const N = CAMO_N, W = [], img = g.createImageData(N, N), p = [0, 1, 2, 3].map(() => rnd() * TAU);
    for (let i = 0; i < 4; i++) W.push([1 + Math.floor(rnd() * 2), Math.floor(rnd() * 3) - 1, rnd() * TAU, 0.6 + rnd() * 0.4]);
    const A = W.reduce((s, w) => s + w[3], 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N * TAU, v = y / N * TAU, wu = u + 0.9 * Math.sin(2 * v + p[0]) + 0.5 * Math.sin(u + v + p[1]), wv = v + 0.9 * Math.sin(2 * u + p[2]) + 0.5 * Math.sin(u - v + p[3]);
      let f = 0; for (const [kx, ky, ph, a] of W) f += a * Math.sin(kx * wu + ky * wv + ph);
      const c = Math.round((f / A * 0.5 + 0.5) * 255), k = (y * N + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = c; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  },
};
/* Teintes de la feuille holographique, parcourues en boucle (holoColor ici pour la vignette du menu, HOLO_GLSL dans le nuanceur) */
const HOLO_COLS = [[0.5, 0.95, 1], [0.72, 0.64, 1], [1, 0.62, 0.92], [0.95, 0.96, 1], [0.62, 1, 0.86]];
function holoColor(t) {
  const n = HOLO_COLS.length, u = (t - Math.floor(t)) * n, i = Math.floor(u) % n, f = u - Math.floor(u), s = f * f * (3 - 2 * f), a = HOLO_COLS[i], b = HOLO_COLS[(i + 1) % n];
  return a.map((v, k) => v + (b[k] - v) * s);
}
const HOLO_GLSL = `vec3 holoColor(float t) {
  float u = fract(t) * ${HOLO_COLS.length}.0, s = smoothstep(0.0, 1.0, fract(u));
  ${HOLO_COLS.map((c, i) => `${i ? 'else ' : ''}if (u < ${i + 1}.0) return mix(vec3(${c.join(', ')}), vec3(${HOLO_COLS[(i + 1) % HOLO_COLS.length].join(', ')}), s);`).join('\n  ')}
  return vec3(1.0);
}`;
/* Teinte du Holo en un point : plis (0 à 1), angle de vue (1 - |n.v|, 0 de face), position dans l'arme ; même formule que le nuanceur */
const holoPhase = (fold, rim, x, y, z) => fold * 0.85 + rim * 0.9 + x * 0.6 + y * 1.2 + z * 1.4;
const CAMO_BASE = { desert: '#b89a64', foret: '#4a5a30', urbain: '#7a7d80', neige: '#e8ecef', tigre: '#c77a2d', cobalt: '#0f1b33', braise: '#151012', or: '#c9a02c', diamant: '#bfe3ff', holo: '#808080' };
const CAMO_CANVAS = {}, CAMO_TEX = {}, CAMO_MATS = {};
function camoCanvas(id) {
  if (CAMO_CANVAS[id]) return CAMO_CANVAS[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = CAMO_N;
  const g = cv.getContext('2d'); g.fillStyle = CAMO_BASE[id]; g.fillRect(0, 0, CAMO_N, CAMO_N);
  CAMO_DRAW[id](g, dspRng(CAMOS[id].seed * 7919));
  return (CAMO_CANVAS[id] = cv);
}
function camoTexture(id) {
  if (!CAMO_TEX[id]) { const t = new THREE.CanvasTexture(camoCanvas(id)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; CAMO_TEX[id] = t; }
  return CAMO_TEX[id];
}
/* Vignette du menu : le motif réduit, en image (le Holo, ses plis passés dans ses teintes, vus de face) */
const CAMO_SWATCH = {};
function camoSwatch(id) {
  if (!CAMO_SWATCH[id]) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = c.height = 64; g.drawImage(camoCanvas(id), 0, 0, 64, 64);
    if (id === 'holo') {
      const d = g.getImageData(0, 0, 64, 64);
      for (let k = 0; k < 64 * 64; k++) { const col = holoColor(holoPhase(d.data[k * 4] / 255, 0.25, 0, -(k >> 6) / 64 * 0.12, (k & 63) / 64 * 0.12)); for (let j = 0; j < 3; j++) d.data[k * 4 + j] = Math.round(col[j] * 255); }
      g.putImageData(d, 0, 0);
    }
    CAMO_SWATCH[id] = c.toDataURL('image/png');
  }
  return CAMO_SWATCH[id];
}
/* Retouche de shader : la couleur vient du motif, lu sur trois plans selon la normale (repère de l'arme, sans UV). Le Holo
   (uHolo) : teinte de couche mince selon les plis, l'angle de vue et la direction du reflet (repère de la vue : elle glisse quand
   on bouge) et le temps ; métal poli qui reflète dans cette teinte, bandes de lumière nettes le long des plis (band), liseré des
   bords (rim), paillettes (spark) ; CAMO_U : temps et paillettes (0 en qualité Basse), mis à jour à chaque image (frame,
   09-game.js). Un seul programme pour tous les camouflages */
const CAMO_U = { uCamoT: { value: 0 }, uHoloFx: { value: 1 } };
function camoPatch(m, id) {
  m.onBeforeCompile = (shader) => {
    envCubeHook(shader);
    shader.uniforms.uCamo = { value: camoTexture(id) }; shader.uniforms.uCamoK = { value: 1 / (CAMOS[id].scale || 0.17) };
    shader.uniforms.uHolo = { value: id === 'holo' ? 1 : 0 }; shader.uniforms.uCamoT = CAMO_U.uCamoT; shader.uniforms.uHoloFx = CAMO_U.uHoloFx;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCamoP;\nvarying vec3 vCamoN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamoP = position; vCamoN = normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uCamo; uniform float uCamoK; uniform float uHolo; uniform float uCamoT; uniform float uHoloFx; varying vec3 vCamoP; varying vec3 vCamoN; vec3 camoGlow = vec3(0.0);
vec3 camoTri() {
  vec3 w = pow(abs(normalize(vCamoN)), vec3(5.0)); w /= (w.x + w.y + w.z);
  vec3 p = vCamoP * uCamoK;
  return texture2D(uCamo, p.zy).rgb * w.x + texture2D(uCamo, p.xz).rgb * w.y + texture2D(uCamo, p.xy).rgb * w.z;
}
${HOLO_GLSL}`).replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 cc = camoTri();
    if (uHolo > 0.5) {
      vec3 hN = normalize(vNormal), hV = normalize(vViewPosition), hR = reflect(-hV, hN);
      float rim = 1.0 - clamp(dot(hN, hV), 0.0, 1.0), fold = cc.r;
      vec3 hc = pow(holoColor(fold * 0.7 + rim * 1.1 + hR.x * 0.55 + hR.y * 0.75 + dot(vCamoP, vec3(0.6, 1.2, 1.4)) + uCamoT * 0.025), vec3(2.2));
      diffuseColor.rgb = hc;
      float band = pow(0.5 + 0.5 * sin((hR.y * 2.6 + hR.x * 1.3 + fold * 1.6) * 6.2832 + uCamoT * 0.35), 14.0);
      vec3 cq = vCamoP * 380.0, cf = fract(cq) - 0.5;
      float hs = fract(sin(dot(floor(cq), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float spark = step(0.97, hs) * smoothstep(0.42, 0.1, length(cf)) * pow(max(0.0, sin(hs * 91.0 + dot(hR, vec3(23.0, 31.0, 17.0)) + uCamoT * 1.5)), 12.0) * uHoloFx;
      camoGlow = (hc + 0.12) * (0.06 + rim * rim * rim * 0.55 + band * 1.7) + vec3(spark * 3.5);
    } else diffuseColor.rgb = pow(cc, vec3(2.2)) * 0.74;
  }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += camoGlow;');
    if (m.userData.gunU) gunSurfPatch(shader, m.userData.gunU); // arme en main : usure de la peinture (06-weapons.js)
  };
  const key = m.userData.gunU ? 'camo-usure' : 'camo'; // l'arme en main a l'usure, celle des soldats non : deux programmes
  m.customProgramCacheKey = () => key;
  m.userData.camo = id;
  return m;
}
/* Matières de la vue subjective : celles de l'arme, sauf le métal, le polymère et les garnitures, peints */
function camoMaterials(id) {
  const M = gunMaterials();
  if (!id) return M;
  if (!CAMO_MATS[id]) {
    const C = CAMOS[id], o = {};
    for (const k of ['metal', 'steel', 'poly', 'olive', 'tan', 'wood', 'woodR', 'woodB', 'taupe', 'gray', 'blued', 'polyM', 'fde', 'drab']) {
      const m = M[k].clone(); m.color.set(0xffffff);
      const met = k === 'metal' || k === 'steel';
      m.metalness = C.metal != null ? C.metal : met ? 0.4 : 0.08; m.roughness = C.rough != null ? C.rough : met ? 0.5 : 0.66;
      o[k] = camoPatch(gunWear(m, 'camo'), id); // (la copie a des uniformes d'usure recopiés en simples objets : refaits ici)
    }
    CAMO_MATS[id] = Object.assign(Object.create(M), o);
  }
  return CAMO_MATS[id];
}
/* Matière de l'arme vue de l'extérieur (soldats, armes au sol) */
const CAMO_WORLD = {};
function camoWorldMaterial(id) {
  if (!CAMO_WORLD[id]) { const C = CAMOS[id]; CAMO_WORLD[id] = camoPatch(new THREE.MeshStandardMaterial({ roughness: C.rough != null ? C.rough : 0.62, metalness: C.metal != null ? C.metal : 0.2 }), id); }
  return CAMO_WORLD[id];
}
