'use strict';
/* ==========================================================================
   RIPOSTE: FRONTLINE - noyau : utilitaires, textures procédurales, rendu
   ========================================================================== */
THREE.ColorManagement.legacyMode = false;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* Longueur d'un vecteur à deux ou trois composantes. Math.hypot alloue à chaque appel et coûte cinq fois plus (mesuré dans Chrome :
   357 appels dans le jeu, une bonne part à chaque image, une cause des petits ramasse-miettes à 280 images par seconde) */
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function hyp3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }
/* Valeurs venues du réseau (un autre joueur, peut-être avec un client modifié) : une clé n'est prise que si elle est bien une entrée de
   la table (pas « constructor » ni « __proto__ », hérités de tout objet), un nombre que s'il est fini (« 1e999 » donne Infinity) */
const hasKey = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const numOr = (v, d = 0) => { v = +v; return Number.isFinite(v) ? v : d; };
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const V3 = THREE.Vector3;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3();
const _q1 = new THREE.Quaternion(), _m1 = new THREE.Matrix4();
const UP = new V3(0, 1, 0);
const sl = (c) => Math.pow(c, 2.2); // sRGB vers linéaire

/* ---------- Réglages persistants ---------- */
/* Steam Deck lancé depuis le mode Jeu : le lanceur que l'installeur ajoute à Steam ouvre le jeu avec ?deck=1 (dist/deck/installer.sh, README
   « Steam Deck », 09ra-deck.js). Une console à la manette : ni contrôles tactiles, ni fenêtre d'installation, ni réglages de téléphone. */
const DECK = /[?&]deck=1(&|$)/.test(location.search);
/* Navigateur d'un Steam Deck en mode Bureau (Linux, écran de 1280 x 800, Steam Deck OLED compris) : la carte du menu propose l'installation
   dans Steam (09ra-deck.js), et la fenêtre d'installation des téléphones ne s'affiche pas. ?installer=deck la fait paraître ailleurs (essais). */
function deckLooksLike() {
  if (DECK) return false;
  if (/[?&]installer=deck(&|$)/.test(location.search)) return true;
  const ua = navigator.userAgent, w = Math.round(screen.width * (devicePixelRatio || 1)), h = Math.round(screen.height * (devicePixelRatio || 1));
  return /Linux x86_64/.test(ua) && !/Android/.test(ua) && ((w === 1280 && h === 800) || (w === 800 && h === 1280));
}
/* Écran tactile comme pointeur principal (téléphone, tablette) : contrôles tactiles (09q-tactile.js) et profil graphique de départ allégé */
const COARSE = !DECK && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0;
const VIEW = { w: innerWidth, h: innerHeight, set: false }; // taille de la vue 3D (viewSync)
const Settings = { binds: {}, touch: 'auto', tcRun: 'stick', tcStick: 'float', tcLay: null, aimAssist: 'normal', tpMode: 'auto', tpSeen: false, tpHint: false, tpAuto: true, tpDblAds: true, adsToggle: false, tcAuto: true, tcDblAds: true, tcQuick: true, tcVib: true, tcAlpha: '1', tcV: 0, gfxSafe: false, gfxSafeAuto: '', padSeen: false, padSens: 1.0, padAdsMul: 0.65, adsMul: 1.0, padDead: 0.1, padCurve: 'reactive', padAccel: 'normal', padRun: 'click', padLay: 'default', padVib: true, sens: 1.0, fov: 62, quality: 'auto', dynres: true, eco: null, fpsMax: '0', perf: false, ao: false, rays: true, grass: true, difficulty: 2, loadout: 0, mode: 'tdm', limit: 75, limitFfa: 20, limitDom: 150, minutes: 10, map: 'sable', volume: 0.8, music: 0.5, voice: true, nadeArc: true, invertY: false, fsGame: false, allyMarks: true, hudScale: '1', skin: 'assault', lang: 'auto', sv: 8 };
try {
  const s = JSON.parse(localStorage.getItem('dc_settings') || 'null');
  // réglages d'avant la version 2 : la qualité « Haute » y était la valeur par défaut, on passe en automatique
  if (s) { if (!s.sv) { s.quality = 'auto'; s.sv = 2; } if (s.sv < 3) { s.fsGame = false; s.sv = 3; } Object.assign(Settings, s); }
  // 3.0.1 : tir automatique au doigt par défaut, remis une fois pour tous ; l'assistance à la visée « Forte » (trop favorable) n'existe plus
  if (s && s.sv < 4) Settings.tcAuto = true;
  // 3.0.3 : viser d'un double toucher (sans bouton Viser) par défaut, remis une fois pour tous
  if (s && s.sv < 5) { Settings.tcDblAds = true; Settings.sv = 5; }
  // manette plus vive : zone morte de 10 % (15 % avant) pour qui n'avait pas touché au réglage
  if (s && s.sv < 6) { if (Settings.padDead === 0.15) Settings.padDead = 0.1; Settings.sv = 6; }
  if (s && s.sv < 7) { Settings.difficulty = 2; Settings.sv = 7; } // les bots jouent au niveau maximal par défaut : remis une fois, y compris chez qui avait gardé l'ancien réglage
  // séries au choix (trois par classe) : les touches et les boutons tactiles de l'UAV, de la frappe et de l'hélicoptère deviennent ceux des emplacements 1 à 3
  if (s && s.sv < 8) {
    const ren = { uav: 'ks1', air: 'ks2', heli: 'ks3' };
    for (const o of [Settings.binds, Settings.tcLay]) if (o && typeof o === 'object') for (const k in ren) if (k in o) { o[ren[k]] = o[k]; delete o[k]; }
    Settings.sv = 8;
  }
  if (Settings.aimAssist !== 'off') Settings.aimAssist = 'normal';
} catch (e) { /* stockage indisponible */ }
/* Économie d'énergie (CAP, plus bas) : jamais choisie, elle part activée au doigt (téléphone, tablette) et le jeu demande une fois s'il faut la garder
   (ecoAsk, 09zl-economie.js) ; ailleurs, désactivée sans question */
if (Settings.eco !== true && Settings.eco !== false) { Settings.eco = COARSE; Settings.ecoAsk = COARSE; }
/* Sous l'économie d'énergie, c'est le jeu qui règle l'image (Options, Vidéo : les rangées sont grisées et montrent ces valeurs). Qualité
   automatique : elle part du profil de l'appareil (téléphone : Basse, puce intégrée : Moyenne, carte dédiée : Haute) et la résolution
   dynamique l'adapte, sans jamais monter au-delà du profil ; ni occlusion ambiante ni rayons du soleil (deux passes plein écran) ; l'herbe
   en relief reste, allégée par le profil. Minimale choisie reste Minimale (plus légère que tout le reste). Les choix du joueur sont gardés
   et reviennent quand il la désactive. gfxSet : la valeur en vigueur d'un réglage d'image, à lire au lieu de Settings. */
const ECO_GFX = { quality: 'auto', ao: false, rays: false, grass: true, dynres: true };
function gfxSet(k) {
  if (!Settings.eco || !(k in ECO_GFX)) return Settings[k];
  return k === 'quality' && Settings.quality === 'ultra' ? 'ultra' : ECO_GFX[k];
}
if (!(Settings.tpSens > 0)) Settings.tpSens = Settings.sens; // sensibilité du pavé tactile (09qe-pavetactile.js) : celle de la souris au départ, indépendante ensuite
function saveSettings() { try { localStorage.setItem('dc_settings', JSON.stringify(Settings)); } catch (e) { /* ignoré */ } }
/* Mode graphique économique (Options, Vidéo ; activé tout seul après une perte du contexte WebGL, voir 01a-gpu.js) : profil Basse allégé (ombres 512, pas d'éclairs
   de tir, rendu plus petit), textures réduites, pas de pré-passe de profondeur. Lu une fois au chargement : le changement relance le jeu. */
/* Identifiant du build en cours (balise cod-build, écrite par build.py) */
const BUILD = (document.querySelector('meta[name="cod-build"]') || {}).content || '';
/* Un mode économique armé tout seul (perte du contexte, bouton de l'écran d'échec) l'a été par un build plus ancien : on réessaie une fois en profil normal, la
   cause a pu être corrigée depuis ; s'il échoue encore, la perte du contexte le réarme pour ce build. Choisi par le joueur dans les Options (gfxSafeAuto
   « manual »), il reste. */
if (Settings.gfxSafe && Settings.gfxSafeAuto !== 'manual' && Settings.gfxSafeAuto !== BUILD) { Settings.gfxSafe = false; Settings.gfxSafeAuto = ''; saveSettings(); }
const GFX_SAFE = !!Settings.gfxSafe;

/* ---------- Bruit tuilable ---------- */
function makeNoise(seed) {
  const r = mulberry32(seed), S = 256, vals = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) vals[i] = r();
  function n(x, y, px, py) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = vals[y0 * S + x0], b = vals[y0 * S + x1], c = vals[y1 * S + x0], d = vals[y1 * S + x1];
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  n.fbm = function (u, v, bx, by, oct) {
    let s = 0, a = 0.5, t = 0, fx = bx, fy = by;
    for (let o = 0; o < oct; o++) { s += a * n(u * fx, v * fy, fx, fy); t += a; a *= 0.5; fx *= 2; fy *= 2; }
    return s / t;
  };
  n.hash = (ix, iy) => vals[((iy & 255) * S + (ix & 255))];
  return n;
}

/* Textures dessinées (décals, particules, feuillage) */
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; return t;
}
/* Flash de bouche : un champ de chaleur (0 à 1 et plus) calculé case par case, passé par une rampe de couleurs (rouge sombre, orange,
   jaune, blanc) sur fond noir. La texture est additive : le noir n'ajoute rien, il n'y a pas de transparence à gérer. Tirage fixe
   (graine) : les mêmes formes à chaque lancement. */
function flashTex(cell, n, kind) {
  let sd = 9157; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const S = cell * n;
  return canvasTex(S, (g) => {
    const im = g.createImageData(S, S), D = im.data;
    for (let c = 0; c < n * n; c++) {
      const ox = (c % n) * cell, oy = Math.floor(c / n) * cell, h = kind(c, rnd);
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const v = h(((x + 0.5) / cell) * 2 - 1, ((y + 0.5) / cell) * 2 - 1), i = ((oy + y) * S + ox + x) * 4;
        D[i] = 255 * clamp(v * 2, 0, 1); D[i + 1] = 255 * clamp(v * 1.75 - 0.08, 0, 1); D[i + 2] = 255 * clamp(v * 1.5 - 0.6, 0, 1); D[i + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
  }, false);
}
/* rosace : cœur blanc, trois à six pétales effilés de longueurs inégales, éclats plus courts entre eux, stries */
function flashFront(c, rnd) {
  const np = [4, 5, 6, 3][c % 4], a0 = rnd() * TAU, P = [];
  for (let k = 0; k < np; k++) P.push({ a: a0 + ((k + (rnd() - 0.5) * 0.4) * TAU) / np, l: 0.7 + rnd() * 0.28, w: 0.22 + rnd() * 0.12, k: 1 });
  for (let k = 0; k < np * 2; k++) P.push({ a: rnd() * TAU, l: 0.3 + rnd() * 0.35, w: 0.07 + rnd() * 0.06, k: 0.6 });
  const f1 = 13 + Math.floor(rnd() * 8), f2 = 29 + Math.floor(rnd() * 10), ph = rnd() * TAU;
  return (x, y) => {
    const r = hyp(x, y), a = Math.atan2(y, x);
    let h = 1.3 * Math.exp(-(r * r) / 0.008) + 0.35 * Math.exp(-(r * r) / 0.05);
    for (const p of P) {
      const u = r / p.l; if (u >= 1) continue;
      let d = Math.abs(a - p.a) % TAU; if (d > Math.PI) d = TAU - d;
      const w = p.w * (1 - 0.75 * u);
      h += p.k * Math.exp(-(d * d) / (w * w)) * (1 - u);
    }
    h *= 0.78 + 0.12 * Math.sin(a * f1 + ph) + 0.1 * Math.sin(a * f2 + r * 7);
    return h * smoothstep(1, 0.8, r);
  };
}
/* langue de flamme de profil : la bouche près du bas (t = 0, un peu de marge en dessous pour le cœur), un fuseau qui s'ouvre vite
   puis s'effile en ondulant, des renflements (diamants de choc) et des filets ; une variante sur deux a deux jets en travers près de
   la bouche, comme un frein de bouche */
function flashSide(c, rnd) {
  const L = [0.95, 0.7, 0.62, 0.9][c % 4], W = 0.18 + rnd() * 0.12, ph = rnd() * TAU, jet = c % 2 === 1, bz = 0.06 + rnd() * 0.05, dk = 20 + rnd() * 8;
  return (x, y) => {
    const t = ((1 - y) / 2) * 1.08 - 0.08, cx = 0.07 * Math.sin(t * 8 + ph) * Math.max(t, 0);
    let h = 0;
    if (t > 0 && t < L) {
      const w = W * Math.pow(Math.sin(Math.PI * Math.pow(t / L, 0.5)), 1.1) + 0.02, dx = (x - cx) / w;
      h = Math.exp(-dx * dx * 1.7) * Math.pow(1 - t / L, 0.75) * (1.05 + 0.22 * Math.max(0, Math.cos(t * dk + ph))) * (0.86 + 0.14 * Math.sin(x * 34 + t * 11 + ph));
    }
    if (jet) { const ax = Math.abs(x), d = (t - bz - ax * 0.35) / 0.045; h += 0.75 * Math.exp(-d * d) * Math.pow(Math.max(0, 1 - ax / 0.85), 1.4); }
    h += 1.1 * Math.exp(-(x * x) / 0.012 - (t * t) / 0.003);
    return h * smoothstep(1, 0.88, Math.abs(x)) * smoothstep(1, 0.95, t) * smoothstep(-0.08, -0.03, t);
  };
}
function buildFxTextures() {
  const T = {};
  T.hole = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(10,8,6,1)'); r.addColorStop(0.18, 'rgba(18,15,12,1)'); r.addColorStop(0.3, 'rgba(40,35,30,0.85)');
    r.addColorStop(0.55, 'rgba(60,55,48,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(20,18,15,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const a = Math.random() * TAU; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * s * 0.4, s / 2 + Math.sin(a) * s * 0.4); g.stroke(); }
  });
  T.glow = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }, false);
  T.star = canvasTex(128, (g, s) => {
    g.translate(s / 2, s / 2);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,230,180,0.9)'); r.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = r;
    for (let i = 0; i < 6; i++) {
      g.rotate(TAU / 6 + (Math.random() - 0.5) * 0.3);
      const l = s * (0.3 + Math.random() * 0.2);
      g.beginPath(); g.moveTo(0, -s * 0.06); g.lineTo(l, 0); g.lineTo(0, s * 0.06); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(0, 0, s * 0.16, 0, TAU); g.fill();
  }, false);
  // flash de bouche : rosace vue de face (flashF), langue de flamme vue de profil (flashS), quatre variantes par planche (2 x 2) ;
  // flashP : une rosace seule pour les tirs vus de loin (particules)
  T.flashF = flashTex(128, 2, flashFront); T.flashS = flashTex(128, 2, flashSide); T.flashP = flashTex(128, 1, flashFront);
  T.smoke = canvasTex(128, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const x = s / 2 + (Math.random() - 0.5) * s * 0.45, y = s / 2 + (Math.random() - 0.5) * s * 0.45, rr = s * (0.12 + Math.random() * 0.2);
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      r.addColorStop(0, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }
  }, false);
  T.blood = canvasTex(64, (g, s) => {
    g.fillStyle = 'rgba(110,8,6,0.9)';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(s / 2 + (Math.random() - 0.5) * s * 0.6, s / 2 + (Math.random() - 0.5) * s * 0.6, Math.random() * s * 0.14 + 2, 0, TAU); g.fill(); }
  });
  T.scorch = canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(8,6,5,0.95)'); r.addColorStop(0.5, 'rgba(15,12,10,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  T.frond = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s); g.strokeStyle = '#5b6b2c'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(s / 2, s); g.lineTo(s / 2, 0); g.stroke();
    for (let i = 0; i < 26; i++) {
      const y = s - (i / 26) * s, len = s * 0.46 * Math.sin((i / 26) * Math.PI * 0.9 + 0.2);
      const c = 60 + Math.random() * 40;
      g.strokeStyle = `rgb(${c},${c + 45},${30})`; g.lineWidth = 4;
      g.beginPath(); g.moveTo(s / 2, y); g.quadraticCurveTo(s / 2 - len * 0.6, y - 10, s / 2 - len, y - 26); g.stroke();
      g.beginPath(); g.moveTo(s / 2, y); g.quadraticCurveTo(s / 2 + len * 0.6, y - 10, s / 2 + len, y - 26); g.stroke();
    }
  });
  return T;
}

/* ---------- Renderer, scènes, caméras ---------- */
const canvas = document.getElementById('game');
/* ?desync=1 : contexte WebGL « désynchronisé » (Chrome, Windows) : l'image est présentée sans repasser par le compositeur de la page, un étage de file en moins entre
   la souris et l'écran. Expérimental (déchirures possibles selon le pilote), jamais activé de lui-même ; three.js r147 ne transmet pas cet attribut, on crée le contexte. */
const DESYNC = /[?&]desync=1\b/.test(location.search);
const renderer = new THREE.WebGLRenderer(Object.assign({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }, DESYNC ? (() => {
  try { const c = canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, powerPreference: 'high-performance', desynchronized: true }); return c ? { context: c } : {}; } catch (e) { return {}; }
})() : {}));
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputEncoding = THREE.LinearEncoding;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
renderer.info.autoReset = false; // compteurs remis à zéro une fois par image (frame), toutes passes comprises
/* Ombres calculées en temps réel (cartes d'ombre des cascades) : coupées sur les GPU PowerVR (Imagination). Le pilote d'un Pixel 10 (PowerVR D-Series DXT-48-1536,
   Chrome 153 et 154, ANGLE sur GLES) perd le contexte WebGL vers la 8e image dès que des dessins lisent une carte d'ombre : d'autres projets three.js l'ont isolé
   sur le même GPU (README, « Version mobile »), et nos rapports le montraient (chargement sain, perte à la 7e ou à la 12e image de la vue aérienne, où plus de
   200 dessins par image lisent les cascades). Seul retirer la lecture du shader à la compilation tient : shadowMap désactivée (plus de USE_SHADOWMAP), le soleil
   reste (une seule fois, voir le morceau CSM plus bas) et le décor et les soldats reçoivent l'ombre du soleil calculée au chargement (volume cuit, 02e-light.js).
   Coupées aussi dans Samsung Internet : sur un Galaxy S25 (Adreno 830, Samsung Internet 30), le décor et les soldats, qui lisent les cascades, ne
   s'affichaient pas (ciel, arme et interface seuls), alors que le même téléphone affiche tout dans Chrome. Aussi après une perte du contexte pendant que le
   jeu dessinait sur un téléphone (appris pour 30 jours, dc_gpu_noshadow, 01a-gpu.js), ou avec ?ombres=0 dans l'adresse ; ?ombres=1 les force. */
const GPU_NAME = (() => { try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return String((x && gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) || ''); } catch (e) { return ''; } })();
/* Rendu logiciel (pas de carte graphique utilisable : pilote absent ou refusé par le navigateur) et puces trop faibles pour le profil Basse : Intel des
   années 2010 à 2012 (GMA, HD Graphics 2000 à 4000, HD Graphics sans numéro des Atom, 400 à 505 des Celeron et Pentium N), Adreno 300 et 400, Mali-T et
   Mali-400, PowerVR SGX. Le mode automatique y part du profil Minimale. */
const GPU_SOFT = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(GPU_NAME);
const GPU_WEAK = /\bGMA\b|Mobile Intel|Sandybridge|Ivybridge|Ironlake|Bay ?Trail|Intel(?:\(R\))? HD Graphics(?: (?:2000|2500|3000|4000|400|405|500|505|Family)\b| (?!\d)|,|\)|$)|Adreno \(TM\) [34]\d\d|Mali-T\d|Mali-4\d\d|PowerVR SGX/i.test(GPU_NAME);
/* Profil Minimale en vigueur au lancement (choisi, ou mode automatique sur une puce de GPU_WEAK ou en rendu logiciel) : ce qui ne se change qu'en
   recompilant tous les shaders se décide ici, une fois (ombres calculées coupées, pas de pré-passe, pas de gazon, tissus simulés comme sur téléphone).
   Le reste du profil (QUALITY.ultra) s'applique à chaud ; choisir ou quitter Minimale dans les Options propose de relancer le jeu (qualityBootCheck). */
function ultraAtBoot(q) { return q === 'ultra' || (q === 'auto' && (GPU_SOFT || GPU_WEAK)); }
const ULTRA = ultraAtBoot(gfxSet('quality'));
const SHADOWS = (() => {
  const q = /[?&]ombres=([01])\b/.exec(location.search);
  if (q) return { on: q[1] === '1', why: '?ombres=' + q[1] };
  if (ULTRA) return { on: false, why: 'minimum quality' };
  if (/PowerVR|Imagination/i.test(GPU_NAME)) return { on: false, why: 'PowerVR' };
  if (/SamsungBrowser/i.test(navigator.userAgent)) return { on: false, why: 'Samsung Internet' };
  try { const v = JSON.parse(localStorage.getItem('dc_gpu_noshadow') || 'null'); if (v && Date.now() - v.t < 30 * 864e5) return { on: false, why: 'learned after a context loss' }; } catch (e) { /* stockage indisponible */ }
  return { on: true, why: '' };
})();
const NO_SHADOWS = !SHADOWS.on;
renderer.shadowMap.enabled = !NO_SHADOWS;

/* ---------- Profils de qualité ----------
   Tout ce qui fait varier le coût du rendu se règle ici, une ligne par profil :
   pr       densité de pixels maximale du rendu 3D (plafonnée par l'écran) ;
   scaleMin plancher de la résolution dynamique, en fraction de pr ;
   msaa     échantillons d'anticrénelage ; shadow : taille des cartes d'ombre en cascade ;
   bloom, rays : halo lumineux et rayons du soleil ; lights : éclairs de tir qui éclairent le décor ;
   lodPx    hauteur à l'écran (pixels) au-delà de laquelle un soldat passe au modèle détaillé ;
   detail   distance (m) au-delà de laquelle les menus détails du décor (grilles, câbles, objets posés) sont masqués ;
   scatter  distance (m) au-delà de laquelle la dispersion au sol (cailloux, briques, débris) est masquée ;
   pom      relief par parallaxe : pas de recherche le long du rayon (0 = éteint), début et fin de l'extinction (m),
            force de l'ombre propre des reliefs au soleil ;
   grass    brins d'herbe des pelouses (02nb-gazon.js) : part des brins dessinés, portée (m), fin du gabarit détaillé (m) ;
   lean     profil allégé (Basse, Minimale) : textures réduites, ni relief par parallaxe ni paillettes, une seule cascade d'ombre avec les petits objets. */
const QUALITY = {
  high: { label: _t('Haute'), pr: 1.5, scaleMin: 0.6, msaa: 4, shadow: 2048, bloom: true, rays: true, lights: 4, lodPx: 110, detail: 90, scatter: 44, pom: [12, 10, 16, 1], grass: [1, 40, 14] },
  medium: { label: _t('Moyenne'), pr: 1.0, scaleMin: 0.6, msaa: 4, shadow: 1536, bloom: true, rays: true, lights: 4, lodPx: 140, detail: 70, scatter: 38, pom: [8, 6, 10, 0.85], grass: [0.8, 34, 11] },
  // palier réservé au mode automatique : sur les puces intégrées, l'anticrénelage 2x coûte nettement moins cher
  // en bande passante que le 4x et laisse une résolution plus haute, avant de devoir passer en Basse
  medium2: { label: _t('Moyenne allégée'), pr: 1.0, scaleMin: 0.65, msaa: 2, shadow: 1536, bloom: true, rays: true, lights: 3, lodPx: 150, detail: 60, scatter: 32, pom: [0, 0, 1, 0], grass: [0.65, 28, 9] },
  low: { label: _t('Basse'), pr: GFX_SAFE ? 0.6 : 0.75, scaleMin: 0.55, msaa: 0, shadow: GFX_SAFE ? 512 : 1024, bloom: false, rays: false, lights: COARSE || GFX_SAFE ? 0 : 2, lodPx: 180, detail: 40, scatter: 24, pom: [0, 0, 1, 0], grass: [0.5, 22, 7], lean: true },
  // pour les machines trop faibles pour Basse (Intel HD 3000, vieux téléphones) : en plus de Basse, sans éclairs de tir ni gazon, menus détails et
  // dispersion au sol plus proches, modèle détaillé des soldats de plus près, plancher de résolution plus bas ; lancé ainsi, sans ombres calculées
  // (le soleil garde son ombre, cuite dans l'éclairage), sans pré-passe, textures au tiers (ULTRA)
  ultra: { label: _t('Minimale'), pr: GFX_SAFE ? 0.6 : 0.75, scaleMin: 0.5, msaa: 0, shadow: 512, bloom: false, rays: false, lights: 0, lodPx: 260, detail: 24, scatter: 14, pom: [0, 0, 1, 0], grass: null, lean: true },
};
/* Échelle du mode automatique, du plus beau au plus léger : [profil, plus petit et plus grand facteur de résolution].
   On renonce d'abord à ce qui se voit le moins (anticrénelage 4x puis 2x) ; la résolution ne descend qu'ensuite, par
   pas de 5 % ou plus (voir dynDown) dans la plage du profil, et le profil Basse (sans anticrénelage ni halo) ne vient
   qu'en dernier. Au bout de la plage, on passe au profil voisin (en descendant, il commence en haut de sa plage ; en
   montant, en bas). Le mode automatique part du profil de la carte graphique, à la résolution 1 (plus si le temps GPU
   mesuré le permet, jusqu'à la densité de l'écran), et ne remonte jamais au-dessus. Un profil fixe ne fait varier que
   sa résolution (1 à scaleMin). Changer de résolution ne recrée rien (RS) ; changer de profil recrée les cibles. */
const AUTO_LADDER = [['high', 0.8, 1], ['medium', 1, 1], ['medium2', 0.7, 1], ['low', 0.7, 1], ['ultra', 0.5, 0.7]];
/* Profil de départ en mode automatique : carte graphique dédiée → Haute, puce intégrée (Intel Iris/UHD,
   Radeon intégrées, Apple M) → Moyenne, téléphone → Basse, rendu logiciel et puce trop faible (GPU_WEAK) → Minimale.
   La résolution dynamique fait le reste. */
const GPU = (() => {
  const gl = renderer.getContext(); let name = '';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { /* inconnu */ }
  const discrete = /NVIDIA|GeForce|Quadro|RTX|GTX|Radeon RX|Radeon Pro|Radeon\(TM\) RX|FirePro|Arc\(TM\) A\d|Arc A\d/i.test(name);
  return { name, tier: ULTRA ? 'ultra' : COARSE ? 'low' : discrete ? 'high' : 'medium' }; // téléphone : on part du plus léger, la résolution dynamique remonte si la puce suit
})();
/* État courant : profil retenu, facteur de résolution dynamique. En mode automatique : échelon de AUTO_LADDER (rung)
   et échelon de départ (rungMin), où la résolution va de la plage du profil jusqu'à la densité de l'écran (voir stepQuality). */
const RQ = { tier: 'high', q: QUALITY.high, scale: 1, rung: -1, rungMin: 0 };
function resolveQuality() {
  if (QUALITY[gfxSet('quality')] || GFX_SAFE) {
    RQ.tier = GFX_SAFE ? (ULTRA ? 'ultra' : 'low') : gfxSet('quality'); RQ.q = QUALITY[RQ.tier]; RQ.scale = clamp(RQ.scale, RQ.q.scaleMin, 1);
    return RQ.q;
  }
  if (RQ.rung < 0) { RQ.rung = RQ.rungMin = Math.max(0, AUTO_LADDER.findIndex((r) => r[0] === GPU.tier)); RQ.scale = 1; }
  const [t, lo, hi] = AUTO_LADDER[RQ.rung];
  RQ.tier = t; RQ.q = QUALITY[t];
  RQ.scale = clamp(RQ.scale, lo, RQ.rung === RQ.rungMin && !Settings.eco ? Math.max(1, maxBoost()) : hi); // économie d'énergie : jamais au-delà du profil
  return RQ.q;
}
/* Nouveau réglage de qualité : le mode automatique repart de son échelon de départ */
function qualityReset() { RQ.rung = -1; RQ.scale = 1; applyQuality(); }
resolveQuality();
/* Pas de pré-passe de profondeur sur téléphone ni en mode économique : les puces mobiles à rendu par tuiles écartent déjà les surfaces cachées (la pré-passe
   n'y gagne rien) et son hypothèse, la même surface calculée par deux programmes donne la même profondeur, n'y tient pas toujours (mondes noirs) */
const NO_PREPASS = COARSE || GFX_SAFE || ULTRA;

/* three.js résout la cible multi-échantillonnée (copie couleur + profondeur) après chaque rendu qui la vise :
   pré-passe, monde puis arme en provoqueraient trois. Une seule suffit, après l'arme, et la profondeur n'est
   jamais relue : les copies intermédiaires sont sautées et seule la couleur est copiée. */
const RENDER = { skipResolve: false, clip: false };
/* Calque des objets opaques qui écrivent la profondeur dans la pré-passe (voir DepthPrepass, markPrepass) */
const LAYER_PREPASS = 2;
/* Calque des petits objets du décor : vus par la caméra et par les deux cascades d'ombre proches, pas par la
   cascade lointaine (au-delà d'une quarantaine de mètres, leur ombre est imperceptible). */
const LAYER_NEAR = 1;
/* Calque des maillages qui ne font que projeter une ombre (modèle allégé d'un soldat affiché en détaillé, corps du
   joueur) : la caméra ne le voit que pendant le calcul des cartes d'ombre, ils ne coûtent donc rien à l'écran.
   MASK_SCREEN : maillage affiché (passe principale et pré-passe) ; MASK_SHADOW : ombre seule. */
const LAYER_SHADOW = 3;
const MASK_SCREEN = 1 | (1 << LAYER_PREPASS), MASK_SHADOW = 1 << LAYER_SHADOW;
{
  const gl = renderer.getContext(), blit = gl.blitFramebuffer.bind(gl);
  gl.blitFramebuffer = function (x0, y0, x1, y1, dx0, dy0, dx1, dy1, mask, filter) {
    if (RENDER.skipResolve) return;
    // rendu dans un sous-rectangle (RS, pendant composer.render) : seule la part dessinée est copiée
    if (RENDER.clip && x1 === RS.cw && y1 === RS.ch) { x1 = dx1 = RS.w; y1 = dy1 = RS.h; }
    const m = mask & gl.COLOR_BUFFER_BIT; if (m) blit(x0, y0, x1, y1, dx0, dy0, dx1, dy1, m, filter);
  };
}

const scene = new THREE.Scene();
scene.matrixAutoUpdate = false; // la racine ne bouge jamais : sinon son recalcul à chaque image force celui de tous les objets, y compris les centaines d'objets fixes de la carte
const camera = new THREE.PerspectiveCamera(Settings.fov, innerWidth / innerHeight, 0.15, 260);
camera.rotation.order = 'YXZ'; camera.layers.enable(LAYER_NEAR);
const vmScene = new THREE.Scene();
vmScene.matrixAutoUpdate = false;
const vmCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10);

/* Ambiance d'une carte (appliquée par applyAtmosphere, 02z-load.js) : soleil, ciel, brouillard, lumière d'ambiance,
   environnement, étalonnage. Couleurs du ciel en valeurs linéaires (au-delà de 1 : lumineuses), teintes des lumières en
   hexadécimal sRGB. Valeurs par défaut : celles de Khamsin (soleil de fin d'après-midi, bas à l'ouest-sud-ouest).
   sky.cloud : seuils de couverture des nuages et opacité ; bounce : soleil renvoyé par le sol (éclairage cuit) ;
   dust, motes : poussière déposée sur le décor, grains en suspension ; impact : poussière des impacts au sol ;
   snow : neige sur le décor (null : aucune) ; coat : dépôt de même forme sans les effets de la neige (cendre) ; snowfall : densité des
   flocons ; wind : timbre (Hz) et force du vent ;
   bloom : halo lumineux (une carte enneigée le veut plus discret : la neige au soleil dépasse vite le seuil).
   grade : étalonnage de la passe finale (GRADE_DEF pour ce qu'une carte ne précise pas) : lo, hi, teintes des ombres et des hautes
   lumières ; exp, exposition ; sat, saturation ; con, contraste ; vig, vignettage ; lift, noirs relevés ; gain, facteur commun d'exposition.
   fogSun, fogH : atmosphère (voir FOG_U) ; winLit : part des fenêtres dont la pièce a sa lampe allumée (vitre d'une pièce, 02c-materials.js).
   hdri : HDRI d'éclairage (null : environnement tiré du ciel de la carte, de rigueur la nuit ou au crépuscule, une HDRI de jour éclaire trop) ;
   lit : éclairage public allumé (lampadaires, lanternes, appliques : litOn, 02f-props.js) ; lamps : force des lampes cuites (1 par défaut). */
const ATMO_DEFAULT = {
  sun: [-0.62, 0.34, 0.5], sunColor: 0xffcf9a, sunI: 2.9, vmSun: 0xffcf9a,
  fog: [0.62, 0.47, 0.36], fogD: 0.0058,
  hemi: [0xc6d6f0, 0x7a5c40, 0.62], vmHemi: [0xc6d6f0, 0x6a5038],
  sky: {
    zen: [0.10, 0.20, 0.42], mid: [0.42, 0.44, 0.52], hor: [1.05, 0.60, 0.34], gnd: [0.30, 0.22, 0.16],
    glow: [1.0, 0.5, 0.22], halo: [1.0, 0.78, 0.5], disk: [28, 19, 11], cloudLo: [0.55, 0.42, 0.42], cloudHi: [1.25, 0.82, 0.55], cloud: [0.52, 0.86, 0.7],
    // crêtes lointaines peintes dans le ciel : hauteur (en sinus de l'élévation), relief, brume ; couleurs neige et roche
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
    // cratère en éruption (son cône est du relief de la carte) : azimut du cratère vu de la caméra, son rayon apparent (radians), sinus de
    // l'élévation de sa lèvre (recalculés à chaque image par la carte) ; colonne éruptive : sinus de l'élévation de son sommet, dérive,
    // opacité, lueur du cratère ; fontaine de lave et bombes (forces), éclair dans la colonne (intensité et graine)
    volc: [0, 0, 0, 0], plume: [0, 0, 0, 0], erupt: [0, 0, 0, 0],
    // mer de nuages sous l'horizon (îles flottantes) : hauteur de la caméra au-dessus d'elle (m), position de la caméra (x, z : parallaxe ;
    // recalculées à chaque image par la carte), couverture (0 : éteinte)
    sea: [0, 0, 0, 0],
  },
  envGround: 0x5a4636, hdri: 'sunset',
  bounce: [1.45, 1.12, 0.8], dust: [0.8, 0.68, 0.54], motes: [1.3, 1.05, 0.78],
  grade: { lo: [0.9, 1.0, 1.08], hi: [1.07, 1.0, 0.88], exp: 1.0 }, rays: [1.0, 0.72, 0.45],
  fogSun: 0.45, fogH: [26, 0], // lueur du soleil dans la brume ; brouillard allégé en altitude : hauteur caractéristique (m), altitude de référence
  winLit: 0.1, // part des fenêtres dont la pièce a sa lampe allumée (vitre d'une pièce, 02c-materials.js)
  // contraste entre l'intérieur et le dehors : pente de la courbe du ciel visible (1 : sans effet ; au-dessus, les lieux couverts s'assombrissent et
  // les rues dégagées gardent leur lumière), part du plancher aoFloor gardée à l'abri, part du soleil renvoyé gardée à l'abri (skyCurve, 02c-materials.js)
  interior: [2.6, 0.35, 0.45],
  impact: [0.5, 0.4, 0.28], snow: null, coat: null, snowfall: 0, wind: [380, 0.05],
  bloom: [0.42, 0.55, 0.82], aoFloor: 0.3, // halo lumineux (force, rayon, seuil) ; plancher de la lumière indirecte à l'ombre
  raysThr: 1.9, // luminance au-delà de laquelle un pixel nourrit les rayons du soleil (au-dessus de la neige ensoleillée en hiver)
  satExp: 0.95, // exposition de la vue satellite (carte tactique, vignettes) : plus basse sur la neige, sinon tout est blanc
  raysCap: 1e4, // apport maximal d'un échantillon : borné, le disque solaire (minuscule, très lumineux) ne fait plus grésiller les rayons
};
/* Étalonnage par défaut (chantier du rendu, octobre 2026 : plus sobre, comme un jeu AAA) : après ACES, la saturation n'est plus
   poussée de 10 % ni le contraste de 7 % (le sable et les enduits viraient au jaune orangé), et le vignettage n'assombrit plus les coins
   de 42 % mais de 17 %. Essayé et écarté : le rendu de tons AgX, plus doux sur les hautes lumières, mais qui faisait virer le sable de
   Simoun au saumon. */
/* Noirs relevés et exposition (retour du propriétaire, chantier des ambiances, octobre 2026 : les contrastes plaisent, mais certains coins
   étaient trop sombres pour bien voir) : lift relève le noir pur (6 % : 15 sur 255) sans presque toucher aux tons moyens ; gain multiplie
   l'exposition de toutes les cartes. */
const GRADE_DEF = { sat: 1.03, con: 1.05, vig: 0.35, lift: 0.06, gain: 1.06 };
const SUN_DIR = new V3(...ATMO_DEFAULT.sun).normalize();
const FOG_COLOR = new THREE.Color().setRGB(...ATMO_DEFAULT.fog);
scene.fog = new THREE.FogExp2(FOG_COLOR, ATMO_DEFAULT.fogD);
/* Atmosphère (retour du propriétaire, octobre 2026 : passer un cap vers un rendu de jeu AAA). Le brouillard de three.js est d'une seule
   couleur et ne dépend que de la profondeur. Deux ajouts, communs à toutes les matières (morceaux de shader fog_* remplacés au démarrage) :
   - brouillard plus léger en altitude (fogH : hauteur caractéristique, en m, et altitude de référence ; 0 : uniforme) : la densité
     décroît en exponentielle au-dessus de la référence, reste celle de la base en dessous (le dessous des îles, la mer en contrebas), et
     l'on prend sa moyenne exacte sur le trajet du regard (la caméra et le point vu), si bien qu'il n'y a pas de couture et que la rue
     reste brumeuse vue du toit pendant que le haut des façades se détache sur le ciel ;
   - lueur du soleil dans la brume (fogSun : force) : vers le soleil, le brouillard prend sa couleur, comme une brume éclairée à
     contre-jour (deux lobes : un large, un serré).
   Les valeurs sont communes à tous les programmes : chaque matière reçoit les mêmes tableaux (FOG_U), que three.js recopie par référence
   dans les uniformes de chaque matière (un tableau typé n'est pas cloné) ; applyAtmosphere (02z-load.js) les remplit. Une matière qui ne
   les a pas (ShaderMaterial sans les uniformes du brouillard de UniformsLib) les lit à zéro : le brouillard d'avant. Les matières éclairées
   ont déjà la position vue de la caméra (vViewPosition) ; les autres (sprites, particules, herbe) reçoivent un varying de plus. */
const FOG_U = { fogSun: { value: new Float32Array(4) }, fogSunCol: { value: new Float32Array(3) }, fogHeight: { value: new Float32Array(2) } };
(() => {
  Object.assign(THREE.UniformsLib.fog, FOG_U);
  for (const k in THREE.ShaderLib) if (THREE.ShaderLib[k].uniforms && THREE.ShaderLib[k].uniforms.fogColor) Object.assign(THREE.ShaderLib[k].uniforms, FOG_U);
  const lit = '!defined( STANDARD ) && !defined( LAMBERT ) && !defined( PHONG ) && !defined( TOON ) && !defined( MATCAP )';
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth;
#if ${lit}
varying vec3 vFogV;
#endif
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
#if ${lit}
vFogV = mvPosition.xyz;
#endif
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
#if ${lit}
varying vec3 vFogV;
#define FOG_V vFogV
#else
#define FOG_V ( - vViewPosition )
#endif
uniform vec4 fogSun; uniform vec3 fogSunCol; uniform vec2 fogHeight;
#ifndef FOG_K
#define FOG_K 1.0
#endif
// primitive de la densité relative à l'altitude h (au-dessus de la référence) : exp( - h / H ) au-dessus, 1 en dessous
float fogPrim( float h ) { return min( h, 0.0 ) - fogHeight.x * exp( - max( h, 0.0 ) / fogHeight.x ); }
// part du brouillard pour une épaisseur optique de base dd (densité x profondeur, comme FogExp2), allégée en altitude sur le trajet du regard
float fogPath( float dd ) {
  float k = dd * dd;
  if ( fogHeight.x > 0.0 ) {
    float hc = cameraPosition.y - fogHeight.y, dh = ( FOG_V * mat3( viewMatrix ) ).y;
    k *= abs( dh ) > 0.5 ? clamp( ( fogPrim( hc + dh ) - fogPrim( hc ) ) / dh, 0.0, 1.0 ) : exp( - max( hc + dh * 0.5, 0.0 ) / fogHeight.x );
  }
  return 1.0 - exp( - k );
}
// couleur du brouillard : sa teinte, plus la lueur du soleil vers lui
vec3 fogTint( vec3 c ) {
  if ( fogSun.w <= 0.0 ) return c;
  float s = max( dot( normalize( FOG_V * mat3( viewMatrix ) ), fogSun.xyz ), 0.0 );
  return c + fogSunCol * ( pow( s, 5.0 ) * 0.65 + pow( s, 36.0 ) * 0.35 ) * fogSun.w;
}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = fogPath( fogDensity * vFogDepth );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint( fogColor ) * FOG_K, fogFactor );
#endif`;
})();

const _skyU = (k) => ({ value: ATMO_DEFAULT.sky[k].length === 4 ? new THREE.Vector4(...ATMO_DEFAULT.sky[k]) : new V3(...ATMO_DEFAULT.sky[k]) });
const SkyShader = {
  uniforms: {
    sunDir: { value: SUN_DIR }, uTime: { value: 0 }, uZen: _skyU('zen'), uMid: _skyU('mid'), uHor: _skyU('hor'), uGnd: _skyU('gnd'),
    uGlow: _skyU('glow'), uHalo: _skyU('halo'), uDisk: _skyU('disk'), uCloudLo: _skyU('cloudLo'), uCloudHi: _skyU('cloudHi'), uCloud: _skyU('cloud'),
    uRidge: _skyU('ridge'), uRidgeSnow: _skyU('ridgeSnow'), uRidgeRock: _skyU('ridgeRock'),
    uVolc: _skyU('volc'), uPlume: _skyU('plume'), uErupt: _skyU('erupt'), uSea: _skyU('sea'),
    // ciel photographié (SKY_PHOTO, skyPhoto d'une définition de carte) : moitié haute d'un panorama ; x : rotation (part de tour), y : gain
    tSky: { value: null }, uSkyP: { value: new THREE.Vector4(0, 1, 0, 0) },
  },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 sunDir, uZen, uMid, uHor, uGnd, uGlow, uHalo, uDisk, uCloudLo, uCloudHi, uCloud, uRidge, uRidgeSnow, uRidgeRock;
    uniform vec4 uVolc, uPlume, uErupt, uSea, uSkyP; uniform float uTime;
#ifdef SKY_PHOTO
    uniform sampler2D tSky;
#endif
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
    float fbm3(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
    // un plan de crêtes (k : 0 le plus loin, plus haut et plus voilé ; 1 le plus proche) ; sommets enneigés éclairés côté soleil
    vec3 ridgeLayer(vec3 col, float fk, vec2 ap, float h){
      float amp = uRidge.y * (1.25 - fk * 0.4);
      float r1 = fbm(ap * (1.6 + fk) + vec2(7.3 + fk * 3.1, 2.1)), r2 = fbm(ap * (5.5 + fk * 2.0) + vec2(1.7, fk * 5.3));
      float top = uRidge.x * (1.15 - fk * 0.45) + (r1 * 0.75 + r2 * r2 * 0.45 - 0.35) * amp;
      if (h < top) {
        float depth = clamp((top - h) / (amp * 0.9 + 1e-3), 0.0, 1.0), lit = 0.6 + 0.4 * dot(normalize(vec2(ap.x, ap.y)), normalize(sunDir.xz));
        float snowLine = smoothstep(0.55, 0.25, depth + (fbm(ap * 30.0 + vec2(h * 60.0)) - 0.5) * 0.35);
        vec3 mc = mix(uRidgeRock, uRidgeSnow * lit, snowLine) * (0.9 + 0.2 * fbm(ap * 60.0 + vec2(h * 120.0)));
        mc = mix(mc, uHor, uRidge.z * (1.0 - fk * 0.55) * (1.0 - depth * 0.6));
        col = mix(col, mc, smoothstep(0.0, 0.003, top - h));
      }
      return col;
    }
#ifdef SKY_VOLC
    // colonne éruptive au-dessus du cratère : elle monte, s'élargit, ses bords bouillonnent, puis s'étale en parapluie vers le zénith ; volutes
    // plus claires sur leurs bosses, rougies au pied par la fontaine ; un éclair l'illumine de temps en temps
    vec3 plume(vec3 col, vec3 d, float h){
      vec2 v0 = vec2(cos(uVolc.x), sin(uVolc.x)), dh = normalize(d.xz);
      float da = atan(v0.x * dh.y - v0.y * dh.x, dot(v0, dh)), U = uVolc.y, Hc = uVolc.z, yh = (h - Hc) / max(uPlume.x - Hc, 0.05);
      if (yh < -0.04 || yh > 1.0) return col;
      float ce = sqrt(max(1.0 - h * h, 0.03)); // cos de l'élévation : près du zénith, un écart d'azimut vaut moins d'angle
      float ax = min(uPlume.y * pow(max(yh, 0.0), 2.4), 1.2), w = U * (1.4 + 5.0 * yh) * (1.0 + 2.2 * smoothstep(0.55, 0.95, yh)) / ce, u = (da - ax) / w;
      if (abs(u) > 2.2) return col;
      float n1 = fbm(vec2(u * 1.3 + 5.0, yh * 5.0 - uTime * 0.05)), n2 = fbm3(vec2(u * 3.0 - 3.0, yh * 11.0 - uTime * 0.09));
      float edge = abs(u) + (n1 - 0.5) * 0.9 + (n2 - 0.5) * 0.35;
      float dens = (1.0 - smoothstep(0.55, 1.05, edge)) * smoothstep(-0.04, 0.02, yh) * (1.0 - smoothstep(0.82, 1.0, yh));
      vec3 lat = vec3(-v0.y, 0.0, v0.x);
      float sh = 0.55 + 0.7 * n2 + 0.25 * clamp(u * dot(lat, sunDir), -1.0, 1.0);
      vec3 pc = mix(vec3(0.04, 0.032, 0.03), vec3(0.17, 0.13, 0.11), smoothstep(0.1, 0.8, yh)) * sh;
      pc += vec3(1.0, 0.3, 0.06) * uPlume.w * exp(-max(yh, 0.0) * 9.0) * (0.25 + 0.6 * (1.0 - n2));
      if (uErupt.z > 0.01) {
        float ly = 0.12 + fract(uErupt.w * 7.31) * 0.45, lx = (fract(uErupt.w * 3.17) - 0.5) * 0.9;
        float bx = lx + 0.4 * (vn(vec2(yh * 30.0, uErupt.w * 13.0)) - 0.5) + 0.14 * (vn(vec2(yh * 95.0, uErupt.w * 29.0)) - 0.5);
        float inY = smoothstep(ly - 0.14, ly - 0.11, yh) * (1.0 - smoothstep(ly + 0.11, ly + 0.14, yh)), bolt = exp(-pow((u - bx) * 22.0, 2.0)) * inY;
        pc += vec3(0.8, 0.74, 1.0) * uErupt.z * (exp(-pow((u - lx) * 1.1, 2.0) - pow((yh - ly) * 7.0, 2.0)) * 1.2 + bolt * 7.0);
        dens = max(dens, bolt * uErupt.z);
      }
      return mix(col, pc, clamp(dens * uPlume.z, 0.0, 0.97));
    }
    // fontaine de lave qui vacille au-dessus de la lèvre du cratère, bombes incandescentes en vol balistique ; unités : le rayon apparent du
    // cratère (ce que la lèvre cache est caché par le relief, dessiné devant le ciel)
    vec3 fountain(vec3 col, vec3 d, float h){
      vec2 v0 = vec2(cos(uVolc.x), sin(uVolc.x)), dh = normalize(d.xz);
      float da = atan(v0.x * dh.y - v0.y * dh.x, dot(v0, dh)), U = uVolc.y, ce = sqrt(max(1.0 - h * h, 0.03)), x = da * ce / U, y = (h - uVolc.z) / (U * ce);
      if (abs(x) > 6.0 || y < -1.5 || y > 9.0) return col;
      float fl = vn(vec2(uTime * 5.0, 1.7)), hj = 1.8 + 1.4 * fl, wj = 0.22 + max(y + 0.6, 0.0) * 0.16;
      float jet = exp(-pow(x / wj, 2.0)) * smoothstep(-1.2, -0.6, y) * (1.0 - smoothstep(hj * 0.5, hj, y)) * (0.65 + 0.35 * vn(vec2(x * 9.0, y * 4.0 - uTime * 9.0)));
      vec3 e = vec3(2.8, 1.05, 0.25) * jet * uErupt.x;
      for (int i = 0; i < 14; i++) {
        float fi = float(i), ph = fract(uTime * (0.22 + 0.06 * fract(fi * 0.37)) + fi * 0.618);
        float bx = (fract(fi * 0.73) - 0.5) * 7.0 * ph, by = -0.4 + (6.0 + 3.5 * fract(fi * 0.41)) * ph - 8.0 * ph * ph;
        vec2 q = vec2(x - bx, y - by) * U;
        e += vec3(2.4, 0.75, 0.12) * uErupt.y * exp(-dot(q, q) / 0.0000065) * (1.0 - ph * 0.6);
      }
      return col + e;
    }
#endif
#ifdef SKY_SEA
    // mer de nuages vue d'en haut : un plan à uSea.x m sous la caméra (uSea.yz : sa position, pour la parallaxe), des bosses de cumulus
    // éclairées du côté du soleil et ombrées de l'autre, des trouées sur le bleu des profondeurs (gnd), une brume qui monte vers l'horizon
    vec3 sea(vec3 d, float h){
      float t = uSea.x / max(-h, 0.004);
      vec2 p = (uSea.yz + d.xz * t) * 0.0065 + vec2(uTime * 0.0011, uTime * 0.0005);
      float n = fbm(p), n2 = fbm3(p * 3.3 + vec2(4.2, 1.7));
      float dens = smoothstep(uSea.w - 0.2, uSea.w + 0.12, n * 0.78 + n2 * 0.32);
      float sl = fbm(p + normalize(sunDir.xz) * 0.035) - n;
      float lit = clamp(0.66 + sl * 10.0 + (n2 - 0.5) * 0.5 + (dens - 0.5) * 0.3, 0.2, 1.3);
      vec3 sc = mix(uGnd, mix(uCloudLo, uCloudHi, lit), dens);
      float far = 1.0 - exp(-t * 0.0019);
      return mix(sc, mix(uHor, uMid, 0.15), clamp(far * 0.9 + smoothstep(-0.06, 0.0, h) * 0.7, 0.0, 1.0));
    }
#endif
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 zen = uZen, mid = uMid, hor = uHor, gnd = uGnd;
      vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
      col = mix(col, zen, smoothstep(0.12, 0.75, h));
#ifdef SKY_SEA
      if (h < 0.0) col = mix(col, sea(d, h), smoothstep(0.0, -0.015, h));
#else
      col = mix(col, gnd, smoothstep(0.0, -0.12, h));
#endif
      float sd = max(dot(d, sunDir), 0.0);
      col += uGlow*pow(sd,6.0)*0.55 + uHalo*pow(sd,48.0)*1.1;
      col += uDisk*smoothstep(0.99935,0.99965,sd);
#ifdef SKY_PHOTO
      // ciel photographié au-dessus de l'horizon (lu en sRGB, ramené en linéaire), fondu dans la brume de l'horizon (et la mer de nuages) en dessous de 2°
      if (h > -0.01) {
        vec2 st = vec2(fract(atan(d.z, d.x) * 0.15915494 + 0.5 + uSkyP.x), asin(clamp(h, 0.0, 1.0)) * 0.63661977);
        vec3 ph = pow(texture2D(tSky, st).rgb, vec3(2.2)) * uSkyP.y;
        col = mix(col, ph, smoothstep(-0.005, 0.035, h) * (1.0 - uSkyP.z)); // uSkyP.z : la photo s'efface devant le ciel calculé (tempête de Simoun)
      }
#else
      vec2 uv = d.xz/(max(h,0.02)+0.18);
      float c = fbm(uv*0.9 + vec2(uTime*0.004, uTime*0.002));
      c = smoothstep(uCloud.x, uCloud.y, c) * smoothstep(0.0, 0.2, h);
      vec3 cc = mix(uCloudLo, uCloudHi, pow(sd,3.0)*0.8 + 0.25);
      col = mix(col, cc, c*uCloud.z);
#endif
      // crêtes lointaines (deux plans de montagnes) et, entre les deux, le volcan et son panache
      vec2 ap = normalize(d.xz + vec2(1e-5, 0.0));
      if (uRidge.x > 0.0) col = ridgeLayer(col, 0.0, ap, h);
#ifdef SKY_VOLC
      if (h > -0.01) { col = plume(col, d, h); if (uErupt.x > 0.0) col = fountain(col, d, h); }
#endif
      if (uRidge.x > 0.0) col = ridgeLayer(col, 1.0, ap, h);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const skyMat = new THREE.ShaderMaterial({ uniforms: SkyShader.uniforms, vertexShader: SkyShader.vertexShader, fragmentShader: SkyShader.fragmentShader, side: THREE.BackSide, depthWrite: false, fog: false });
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -1;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xc6d6f0, 0x7a5c40, 0.62);
scene.add(hemi);
/* ---------- Ombres filtrées par le GPU ----------
   three.js r147 range la profondeur des cartes d'ombre dans une texture de couleur (RGBA) et la filtre à la main :
   17 lectures et autant de décodages par cascade, et deux cascades dans les zones de fondu, soit jusqu'à 34 lectures
   par pixel, suivies d'un calcul complet de l'éclairage du soleil par cascade. Ici :
   - chaque carte reçoit une vraie texture de profondeur, lue par un échantillonneur de comparaison (sampler2DShadow) :
     une lecture compare et interpole déjà 2 x 2 texels. Un filtre en tente (Castaño) de 5 x 5 texels pour la cascade
     proche (9 lectures) et de 3 x 3 pour les lointaines (4 lectures) donne une pénombre continue, sans les paliers des
     17 prises ponctuelles ;
   - les trois cascades sont un seul et même soleil : son éclairage est calculé une fois, multiplié par l'ombre de la
     ou des cascades qui couvrent le pixel (mêmes poids de fondu que CSMShader) ;
   - les cartes ne reçoivent plus que la profondeur : aucune couleur écrite (voir l'enveloppe de shadowMap.render).
   Sans WebGL 2 (pas de sampler2DShadow), le code d'origine de three.js est conservé tel quel. */
const CSM_HW = { on: renderer.capabilities.isWebGL2, uniform: { value: [] }, gl: [] };
if (CSM_HW.on) {
  const C = THREE.CSMShader, lfb = C.lights_fragment_begin;
  const a = lfb.indexOf('#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )');
  const b = lfb.indexOf('#if ( NUM_DIR_LIGHTS > NUM_DIR_LIGHT_SHADOWS)', a);
  if (a < 0 || b < 0) CSM_HW.on = false; // three.js différent de celui attendu : on ne touche à rien
  else C.lights_fragment_begin = lfb.slice(0, a) + `#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
	if ( receiveShadow ) {
		float linearDepth = ( vViewPosition.z ) / ( shadowFar - cameraNear );
		float csmS = 0.0, csmR, csmV, cascadeCenter, closestEdge, margin, csmx, csmy;
		vec2 cascade;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			cascade = CSM_cascades[ i ];
			cascadeCenter = ( cascade.x + cascade.y ) / 2.0;
			closestEdge = linearDepth < cascadeCenter ? cascade.x : cascade.y;
			#ifdef CSM_FADE
			margin = max( 0.25 * pow( closestEdge, 2.0 ), 1e-6 );
			#else
			margin = 1e-6;
			#endif
			csmx = cascade.x - margin / 2.0;
			csmy = cascade.y + margin / 2.0;
			if ( linearDepth >= csmx && ( linearDepth < csmy || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 ) ) {
				csmR = clamp( min( linearDepth - csmx, csmy - linearDepth ) / margin, 0.0, 1.0 );
				#ifdef CSM_HW
				#if UNROLLED_LOOP_INDEX == 0
				csmV = csmShadow5( uCsmShadowMap[ i ], directionalLightShadows[ i ].shadowMapSize, directionalLightShadows[ i ].shadowBias, vDirectionalShadowCoord[ i ] );
				#else
				csmV = csmShadow3( uCsmShadowMap[ i ], directionalLightShadows[ i ].shadowMapSize, directionalLightShadows[ i ].shadowBias, vDirectionalShadowCoord[ i ] );
				#endif
				#else
				csmV = getShadow( directionalShadowMap[ i ], directionalLightShadows[ i ].shadowMapSize, directionalLightShadows[ i ].shadowBias, directionalLightShadows[ i ].shadowRadius, vDirectionalShadowCoord[ i ] );
				#endif
				csmS += UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth > cascadeCenter ? mix( 1.0, csmV, csmR ) : csmR * csmV;
			}
		}
		#pragma unroll_loop_end
		directLight.color *= csmS;
	}
	RE_Direct( directLight, geometry, material, reflectedLight );
	#else
	// sans carte d'ombre (NO_SHADOWS) : le soleil une seule fois (les trois cascades sont un même soleil), sans ombre calculée ici ; le décor reçoit l'ombre cuite
	directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
	RE_Direct( directLight, geometry, material, reflectedLight );
	#endif

	` + lfb.slice(b);
  THREE.ShaderChunk.shadowmap_pars_fragment += `
#if defined( USE_SHADOWMAP ) && defined( CSM_HW ) && NUM_DIR_LIGHT_SHADOWS > 0
	precision highp sampler2DShadow;
	uniform sampler2DShadow uCsmShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
	// coordonnées d'ombre ramenées dans la carte ; hors de la carte (bords, au-delà du plan lointain) : pas d'ombre
	bool csmCoord( inout vec4 c, float bias ) {
		c.xyz /= c.w; c.z += bias;
		return c.x >= 0.0 && c.x <= 1.0 && c.y >= 0.0 && c.y <= 1.0 && c.z <= 1.0;
	}
	float csmTap( sampler2DShadow m, vec2 base, float u, float v, vec2 inv, float z ) { return texture( m, vec3( base + vec2( u, v ) * inv, z ) ); }
	// filtre en tente de 5 x 5 texels en 9 lectures comparées et interpolées (Castaño, « optimized PCF »)
	float csmShadow5( sampler2DShadow m, vec2 size, float bias, vec4 c ) {
		if ( ! csmCoord( c, bias ) ) return 1.0;
		vec2 inv = 1.0 / size, uv = c.xy * size, b = floor( uv + 0.5 ), st = uv + 0.5 - b;
		b = ( b - 0.5 ) * inv;
		vec3 uw = vec3( 4.0 - 3.0 * st.x, 7.0, 1.0 + 3.0 * st.x ), vw = vec3( 4.0 - 3.0 * st.y, 7.0, 1.0 + 3.0 * st.y );
		vec3 u = vec3( ( 3.0 - 2.0 * st.x ) / uw.x - 2.0, ( 3.0 + st.x ) / uw.y, st.x / uw.z + 2.0 );
		vec3 v = vec3( ( 3.0 - 2.0 * st.y ) / vw.x - 2.0, ( 3.0 + st.y ) / vw.y, st.y / vw.z + 2.0 );
		float s = uw.x * vw.x * csmTap( m, b, u.x, v.x, inv, c.z ) + uw.y * vw.x * csmTap( m, b, u.y, v.x, inv, c.z ) + uw.z * vw.x * csmTap( m, b, u.z, v.x, inv, c.z );
		s += uw.x * vw.y * csmTap( m, b, u.x, v.y, inv, c.z ) + uw.y * vw.y * csmTap( m, b, u.y, v.y, inv, c.z ) + uw.z * vw.y * csmTap( m, b, u.z, v.y, inv, c.z );
		s += uw.x * vw.z * csmTap( m, b, u.x, v.z, inv, c.z ) + uw.y * vw.z * csmTap( m, b, u.y, v.z, inv, c.z ) + uw.z * vw.z * csmTap( m, b, u.z, v.z, inv, c.z );
		return s / 144.0;
	}
	// filtre en tente de 3 x 3 texels en 4 lectures
	float csmShadow3( sampler2DShadow m, vec2 size, float bias, vec4 c ) {
		if ( ! csmCoord( c, bias ) ) return 1.0;
		vec2 inv = 1.0 / size, uv = c.xy * size, b = floor( uv + 0.5 ), st = uv + 0.5 - b;
		b = ( b - 0.5 ) * inv;
		vec2 uw = vec2( 3.0 - 2.0 * st.x, 1.0 + 2.0 * st.x ), vw = vec2( 3.0 - 2.0 * st.y, 1.0 + 2.0 * st.y );
		vec2 u = vec2( ( 2.0 - st.x ) / uw.x - 1.0, st.x / uw.y + 1.0 ), v = vec2( ( 2.0 - st.y ) / vw.x - 1.0, st.y / vw.y + 1.0 );
		float s = uw.x * vw.x * csmTap( m, b, u.x, v.x, inv, c.z ) + uw.y * vw.x * csmTap( m, b, u.y, v.x, inv, c.z );
		s += uw.x * vw.y * csmTap( m, b, u.x, v.y, inv, c.z ) + uw.y * vw.y * csmTap( m, b, u.y, v.y, inv, c.z );
		return s / 16.0;
	}
#endif
`;
}
/* Cartes d'ombre des cascades : cible de rendu avec texture de profondeur (24 bits, filtrage linéaire, mode
   comparaison). La couleur n'est jamais écrite : un seul canal de 8 bits suffit à la cible. Recréées quand leur
   taille change (applyQuality les libère). */
function csmDepthMaps() {
  const gl = renderer.getContext(), st = renderer.state;
  csm.lights.forEach((l, i) => {
    const sh = l.shadow; let rt = sh.map;
    if (!rt || !rt.depthTexture || rt.width !== sh.mapSize.x || rt.height !== sh.mapSize.y) {
      if (rt) rt.dispose();
      const dt = new THREE.DepthTexture(sh.mapSize.x, sh.mapSize.y, THREE.UnsignedIntType);
      dt.minFilter = dt.magFilter = THREE.LinearFilter;
      rt = sh.map = new THREE.WebGLRenderTarget(sh.mapSize.x, sh.mapSize.y, { format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: dt });
      rt.texture.name = l.name + '.shadowMap';
      sh.camera.updateProjectionMatrix(); sh.needsUpdate = true;
      // allouée tout de suite, profondeur 1 (aucune ombre) tant qu'elle n'est pas calculée
      const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      renderer.setRenderTarget(rt); st.buffers.depth.setMask(true); renderer.clear(false, true, false); renderer.setRenderTarget(prev, face, mip);
      CSM_HW.uniform.value[i] = dt;
    }
    const t = renderer.properties.get(rt.depthTexture).__webglTexture;
    if (t && CSM_HW.gl[i] !== t) {
      CSM_HW.gl[i] = t;
      st.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    }
  });
}
/* Enveloppe du calcul des cartes d'ombre (appelé au début de chaque renderer.render) : cartes à profondeur prêtes
   avant tout dessin qui les lit ; couleur verrouillée (non écrite) pendant le calcul ; calque d'ombre seule visible
   de la caméra le temps du calcul (LAYER_SHADOW). */
{
  const sm = renderer.shadowMap, render = sm.render, cb = renderer.state.buffers.color;
  sm.render = function (lights, sc, cam) {
    if (CSM_HW.on && csm && sm.enabled) csmDepthMaps(); // sans ombres (NO_SHADOWS) : aucune carte allouée
    const lock = CSM_HW.on && sm.enabled && (sm.autoUpdate || sm.needsUpdate) && lights.length > 0 && lights.every((l) => l.shadow.map && l.shadow.map.depthTexture);
    const had = cam.layers.isEnabled(LAYER_SHADOW);
    if (lock) { cb.setMask(false); cb.setLocked(true); }
    cam.layers.enable(LAYER_SHADOW);
    try { render.call(this, lights, sc, cam); } finally {
      if (!had) cam.layers.disable(LAYER_SHADOW);
      if (lock) { cb.setLocked(false); cb.setMask(true); }
    }
  };
}
/* Ombres en cascade (CSM de three.js) : trois cartes d'ombre centrées sur la caméra,
   recalées sur la grille de texels pour ne pas scintiller quand on bouge. */
let csm = null;
function shadowMapSize() { return RQ.q.shadow; }
function setupShadows() {
  const A = CURMAP.def ? CURMAP.def.atmo : ATMO_DEFAULT;
  csm = new THREE.CSM({
    camera, parent: scene, cascades: 3, maxFar: 120, mode: 'practical', shadowMapSize: shadowMapSize(),
    lightDirection: SUN_DIR.clone().negate(), lightIntensity: A.sunI, lightNear: 1, lightFar: 500, lightMargin: 140, shadowBias: -0.0001,
  });
  csm.fade = true;
  // chaque cascade décide elle-même si sa carte est recalculée (voir updateShadows)
  for (const l of csm.lights) { l.color.setHex(A.sunColor); l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; l.layers.enable(LAYER_PREPASS); }
  SHADOW_FAR.light = csm.lights[csm.lights.length - 1];
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.isMeshStandardMaterial && !seen.has(m)) { seen.add(m); csmSetup(m); }
  });
  csm.updateFrustums();
  tuneShadowLights();
}
function csmMaterial(m) { if (csm && m.isMeshStandardMaterial) csmSetup(m); return m; }
/* CSM remplace onBeforeCompile : on enchaîne le patch de la matière du décor (userData.patch) après le sien, puis
   l'éclairage d'ambiance en cube (envCubeHook) et les cartes de profondeur des ombres filtrées par le GPU. La clé de
   cache des programmes reste propre à la chaîne d'origine (avec ou sans patch du décor) : sans elle, toutes ces
   matières auraient la même fonction et des matières différentes pourraient partager un programme. */
function csmSetup(m) {
  if (m.userData.csmOn) return; // déjà fait (une matière partagée créée avant les ombres, reprise ensuite : soldierMatsCsm)
  m.userData.csmOn = true;
  csm.setupMaterial(m);
  if (CSM_HW.on) m.defines.CSM_HW = '';
  const h = m.onBeforeCompile, p = m.userData.patch;
  const base = p ? (s, r) => { h(s, r); p(s, r); } : h;
  const key = base.toString() + (ENVC.on ? '|cube' : '') + (CSM_HW.on ? '|hw' : '');
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = function (shader, r) { base(shader, r); envCubeHook(shader); if (CSM_HW.on) shader.uniforms.uCsmShadowMap = CSM_HW.uniform; };
}
/* Biais adaptés à la taille réelle d'un texel de chaque cascade */
function tuneShadowLights() {
  if (!csm) return;
  csm.lights.forEach((l, i) => {
    const cam = l.shadow.camera, texel = (cam.right - cam.left) / csm.shadowMapSize;
    l.shadow.normalBias = texel * 1.6;
    l.shadow.bias = -0.00006 * (i + 1);
    l.shadow.radius = i === 0 ? 2.2 : i === 1 ? 1.6 : 1.0;
  });
}
/* La cascade proche est recalculée à chaque image. Les deux lointaines (au-delà d'une quinzaine de mètres)
   alternent, une image sur deux chacune : leur carte garde la matrice avec laquelle elle a été rendue, l'ombre
   reste donc exacte et ne retarde que d'une image au loin. Si la caméra a tourné ou bougé nettement depuis,
   la cascade est recalculée quand même pour qu'aucun bord du champ ne reste sans ombre. */
const SHADOW_STAGGER = { frame: 0, q: [], p: [], maxTurn: Math.cos(0.026 / 2), maxMove: 0.3 };
function updateShadows() {
  if (!csm) return;
  camera.updateMatrixWorld(); csm.update();
  const S = SHADOW_STAGGER; S.frame++;
  csm.lights.forEach((l, i) => {
    if (!S.q[i]) { S.q[i] = new THREE.Quaternion(); S.p[i] = new V3(); S.p[i].set(1e9, 0, 0); }
    const moved = Math.abs(S.q[i].dot(camera.quaternion)) < S.maxTurn || S.p[i].distanceToSquared(camera.position) > S.maxMove * S.maxMove;
    // la cascade proche toutes les k images, les autres en alternance toutes les 2k (k = HF.k : 1 sous 175 images par seconde, comme avant)
    const k = HF.k, due = (i === 0 ? S.frame % k === 0 : (S.frame + i * k) % (2 * k) === 0) || moved;
    if (due) { l.shadow.needsUpdate = true; S.q[i].copy(camera.quaternion); S.p[i].copy(camera.position); }
  });
}
/* Lumières ponctuelles réservées (nombre fixe, pas de recompilation de shaders) */
/* Éclairs de tir et d'explosion. Une lumière ponctuelle coûte un calcul d'éclairage complet par pixel même
   éteinte : elles ne sont donc déclarées au shader que pendant un éclair (deux variantes de shader seulement,
   0 ou « lights » lumières, compilées au chargement). Le nombre de lumières dépend du profil de qualité. */
const flashLights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffb060, 0, 10, 2); l.visible = false; scene.add(l); flashLights.push({ light: l, t: 0, dur: 0.05, peak: 0 }); }
function flashLight(pos, intensity, dist, dur, color) {
  const n = RQ.q.lights; let best = flashLights[0];
  for (let i = 0; i < n; i++) if (flashLights[i].t <= 0) { best = flashLights[i]; break; }
  best.light.position.copy(pos); best.light.distance = dist; best.light.color.setHex(color || 0xffb060);
  best.peak = intensity; best.dur = dur; best.t = dur; best.light.intensity = intensity;
}
/* Les lumières d'éclair restent dans la scène (à intensité nulle) 2 s après le dernier éclair : le nombre de lumières déclarées aux shaders ne
   change plus à chaque balle. Un éclair dure quelques centièmes de seconde, l'intervalle entre deux balles d'un fusil un dixième : les lumières
   apparaissaient et disparaissaient à chaque tir, et chaque fois three.js réévaluait toutes les matières éclairées visibles (getParameters,
   getProgramCacheKey : deux pics par tir, au moment où l'on vise, octobre 2026). Le programme avec éclairs est compilé au chargement. */
const FLASH_HOLD = { t: 0 };
function updateFlashLights(dt) {
  let any = false;
  for (const f of flashLights) { if (f.t > 0) { f.t -= dt; f.light.intensity = Math.max(0, f.t / f.dur) * f.peak; if (f.t > 0) any = true; } else f.light.intensity = 0; }
  FLASH_HOLD.t = any ? 2 : Math.max(0, FLASH_HOLD.t - dt);
  const on = FLASH_HOLD.t > 0, n = RQ.q.lights;
  for (let i = 0; i < flashLights.length; i++) { const v = on && i < n; if (flashLights[i].light.visible !== v) flashLights[i].light.visible = v; }
}
function setFlashLightsVisible(v) { const n = RQ.q.lights; for (let i = 0; i < flashLights.length; i++) flashLights[i].light.visible = v && i < n; }

/* Éclairage de l'arme en vue subjective (scène séparée) */
const vmHemi = new THREE.HemisphereLight(0xc6d6f0, 0x6a5038, 0.7);
const vmSun = new THREE.DirectionalLight(0xffcf9a, 2.2);
const vmFlash = new THREE.PointLight(0xffa850, 0, 3, 2);
vmFlash.position.set(0.1, 0, -0.9);
const vmLamp = new THREE.AmbientLight(0x000000, 1); // lumière des lampes du décor à hauteur des mains (lampAt, 02e-light.js)
vmScene.add(vmHemi, vmSun, vmFlash, vmLamp);

/* ---------- Post-traitement ---------- */
/* Rendu dans un sous-rectangle : les cibles du composeur sont allouées à la densité du profil (fois cap, plus de 1 seulement quand la résolution
   monte au-delà du profil) et la résolution dynamique ne change que la part dessinée, en bas à gauche (viewport et scissor des cibles, rsView).
   Changer d'échelle ne recrée plus rien. Les passes qui relisent l'image passent par rsUv : coordonnées d'écran (0 à 1) ramenées dans ce
   sous-rectangle, bornées au centre de son dernier pixel (au-delà, les restes d'une image plus grande). u : image du monde ; ry : rayons
   (demi-résolution). w, h : taille rendue ; cw, ch : taille allouée. */
const RS = { cap: 1, w: 1, h: 1, cw: 1, ch: 1, u: { value: new THREE.Vector4(1, 1, 1, 1) }, ry: { value: new THREE.Vector4(1, 1, 1, 1) } };
const RS_GLSL = 'vec2 rsUv(vec2 u, vec4 r){ return min(max(u, 0.0) * r.xy, r.zw); }\n';
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDamage: { value: 0 }, uHurt: { value: 0 }, uDesat: { value: 0 },
    uFlash: { value: 0 }, uExposure: { value: 1.0 }, uAberr: { value: 0.0 }, uRes: { value: new THREE.Vector2(1, 1) }, uScope: { value: 0 },
    uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunOn: { value: 0 }, uRays: { value: 1 },
    tBloom: { value: null }, uBloom: { value: 1 }, tRays: { value: null }, uSharp: { value: 0 }, uTexel: { value: new THREE.Vector2(1, 1) },
    uGradeLo: { value: new V3(...ATMO_DEFAULT.grade.lo) }, uGradeHi: { value: new V3(...ATMO_DEFAULT.grade.hi) }, uRayTint: { value: new V3(...ATMO_DEFAULT.rays) },
    uSat: { value: 1.1 }, uCon: { value: 1.07 }, uVig: { value: 0.85 }, uLift: { value: 0 },
    uRS: RS.u, uRY: RS.ry,
  },
  /* visibilité du soleil (reflets d'optique) : la même pour tout l'écran, lue une fois par sommet du triangle plein
     écran plutôt qu'à chaque pixel (10 lectures de texture de moins par pixel quand le soleil est à l'écran) */
  vertexShader: `
    uniform sampler2D tDiffuse, tBloom; uniform float uBloom, uSunOn, uRays; uniform vec2 uSun; uniform vec4 uRS;
    varying vec2 vUv; varying float vSunVis;
    ${RS_GLSL}
    void main(){
      vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
      float sv = 0.0;
      if (uSunOn * uRays > 0.001) {
        for (int k = 0; k < 5; k++) { vec2 o = clamp(uSun + vec2(float(k - 2) * 0.004, float(k % 2) * 0.004 - 0.002), 0.0, 1.0); sv += dot(texture2D(tDiffuse, rsUv(o, uRS)).rgb + texture2D(tBloom, o).rgb * uBloom, vec3(0.33)); }
        sv = smoothstep(4.0, 18.0, sv / 5.0) * uSunOn;
      }
      vSunVis = sv;
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tBloom, tRays; uniform float uTime,uDamage,uHurt,uDesat,uFlash,uExposure,uAberr,uScope,uSunOn,uRays,uBloom,uSharp; uniform vec2 uRes, uSun, uTexel;
    uniform vec3 uGradeLo, uGradeHi, uRayTint; uniform float uSat, uCon, uVig, uLift; uniform vec4 uRS, uRY;
    varying vec2 vUv; varying float vSunVis;
    ${RS_GLSL}
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vno(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
    vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
    vec3 src(vec2 uv){ return texture2D(tDiffuse, rsUv(uv, uRS)).rgb; }
  #if __VERSION__ >= 300
    // agrandissement EASU de FSR 1 (AMD FidelityFX, licence MIT), d'après FsrEasuF : 12 pixels source autour du point, direction et force du
    // contour tirées de leur luminance, puis un noyau de Lanczos approché, étiré le long du contour et plus court en travers, borné par les
    // 4 pixels les plus proches (pas de halo). Les bords restent nets sans marches d'escalier ; pas d'accentuation après coup (RCAS), qui
    // en crée. Lecture exacte des pixels (texelFetch), bornée au sous-rectangle rendu. L'image est encore en lumière linéaire (avant l'ACES) :
    // la luminance qui guide l'analyse est comprimée (l / (1 + l)) pour qu'un ciel très lumineux ne masque pas les contours sombres.
    vec3 ez(ivec2 p){ return texelFetch(tDiffuse, clamp(p, ivec2(0), ivec2(1.0 / uTexel + 0.5) - 1), 0).rgb; }
    float el(vec3 c){ float l = c.b * 0.5 + c.r * 0.5 + c.g; return l / (1.0 + 0.5 * l); }
    void eset(inout vec2 dir, inout float len, float w, float lA, float lB, float lC, float lD, float lE){
      float dc = lD - lC, cb = lC - lB, lx = max(abs(dc), abs(cb)), dx = lD - lB;
      lx = clamp(abs(dx) / max(lx, 1e-5), 0.0, 1.0); dir.x += dx * w; len += lx * lx * w;
      float ec = lE - lC, ca = lC - lA, ly = max(abs(ec), abs(ca)), dy = lE - lA;
      ly = clamp(abs(dy) / max(ly, 1e-5), 0.0, 1.0); dir.y += dy * w; len += ly * ly * w;
    }
    void etap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len2, float lob, float clp, vec3 c){
      vec2 v = vec2(off.x * dir.x + off.y * dir.y, off.y * dir.x - off.x * dir.y) * len2;
      float d2 = min(dot(v, v), clp);
      float wB = 0.4 * d2 - 1.0, wA = lob * d2 - 1.0;
      wB *= wB; wA *= wA; wB = 1.5625 * wB - 0.5625;
      float w = wB * wA; aC += c * w; aW += w;
    }
    vec3 upscale(vec2 uv){
      vec2 pp = uv / uTexel - 0.5, fp = floor(pp); pp -= fp; ivec2 ip = ivec2(fp);
      //    b c
      //  e f g h      f est le pixel source en bas à gauche du point (pp de 0 à 1 entre f, g, j, k)
      //  i j k l
      //    n o
      vec3 bC = ez(ip + ivec2(0, -1)), cC = ez(ip + ivec2(1, -1)), eC = ez(ip + ivec2(-1, 0)), fC = ez(ip), gC = ez(ip + ivec2(1, 0)), hC = ez(ip + ivec2(2, 0));
      vec3 iC = ez(ip + ivec2(-1, 1)), jC = ez(ip + ivec2(0, 1)), kC = ez(ip + ivec2(1, 1)), lC = ez(ip + ivec2(2, 1)), nC = ez(ip + ivec2(0, 2)), oC = ez(ip + ivec2(1, 2));
      float bL = el(bC), cL = el(cC), eL = el(eC), fL = el(fC), gL = el(gC), hL = el(hC), iL = el(iC), jL = el(jC), kL = el(kC), lL = el(lC), nL = el(nC), oL = el(oC);
      vec2 dir = vec2(0.0); float len = 0.0;
      eset(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
      eset(dir, len, pp.x * (1.0 - pp.y), cL, fL, gL, hL, kL);
      eset(dir, len, (1.0 - pp.x) * pp.y, fL, iL, jL, kL, nL);
      eset(dir, len, pp.x * pp.y, gL, jL, kL, lL, oL);
      float dr = dot(dir, dir); bool zro = dr < 1.0 / 32768.0;
      dir = zro ? vec2(1.0, 0.0) : dir * inversesqrt(dr);
      len *= 0.5; len *= len;
      float st = 1.0 / max(abs(dir.x), abs(dir.y));
      vec2 len2 = vec2(1.0 + (st - 1.0) * len, 1.0 - 0.5 * len);
      float lob = 0.5 + (0.25 - 0.04 - 0.5) * len, clp = 1.0 / lob;
      vec3 aC = vec3(0.0); float aW = 0.0;
      etap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, bC); etap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, cC);
      etap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, iC); etap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, jC);
      etap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, fC); etap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, eC);
      etap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, kC); etap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, lC);
      etap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, hC); etap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, gC);
      etap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, oC); etap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, nC);
      return clamp(aC / aW, min(min(fC, gC), min(jC, kC)), max(max(fC, gC), max(jC, kC)));
    }
  #else
    // sans WebGL 2 (pas de lecture exacte des pixels) : agrandissement bicubique (noyau de Keys, paramètre a = -uSharp : -0,5 pour
    // Catmull-Rom, plus négatif = plus net) en 5 lectures filtrées, borné par ces lectures
    vec3 upscale(vec2 uv){
      vec2 sp = uv / uTexel, t1 = floor(sp - 0.5) + 0.5, f = sp - t1, g = 1.0 - f;
      float k = -uSharp;
      vec2 w0 = k * f * g * g, w3 = k * f * f * g;
      vec2 w1 = ((k + 2.0) * f - (k + 3.0)) * f * f + 1.0, w2 = ((k + 2.0) * g - (k + 3.0)) * g * g + 1.0;
      vec2 w12 = w1 + w2, t12 = (t1 + w2 / w12) * uTexel, t0 = (t1 - 1.0) * uTexel, t3 = (t1 + 2.0) * uTexel;
      vec3 a = src(vec2(t12.x, t0.y)), b = src(vec2(t0.x, t12.y)), c = src(t12);
      vec3 d = src(vec2(t3.x, t12.y)), e = src(vec2(t12.x, t3.y));
      float wa = w12.x * w0.y, wb = w0.x * w12.y, wc = w12.x * w12.y, wd = w3.x * w12.y, we = w12.x * w3.y;
      vec3 r = (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
      return clamp(r, min(min(a, b), min(min(c, d), e)), max(max(a, b), max(max(c, d), e)));
    }
  #endif
    void main(){
      vec2 uv = vUv; vec2 cd = uv-0.5; float r2 = dot(cd,cd);
      float ab = uAberr*r2*0.006;
      vec3 col;
      if (uSharp > 0.0) {
        // rendu 3D plus petit que l'écran (profil, résolution dynamique) : agrandi ici plutôt que par le navigateur
        col = upscale(uv);
        if (ab > 0.0) { col.r = src(uv - cd*ab).r; col.b = src(uv + cd*ab).b; }
      } else {
        col.r = src(uv - cd*ab).r;
        col.g = src(uv).g;
        col.b = src(uv + cd*ab).b;
      }
      // halo lumineux (bloom) : ajouté ici plutôt que dans l'image multi-échantillonnée, même décalage chromatique
      col += vec3(texture2D(tBloom, uv - cd*ab).r, texture2D(tBloom, uv).g, texture2D(tBloom, uv + cd*ab).b) * uBloom;
      // rayons crépusculaires : calculés en demi-résolution par RaysPass
      if (uSunOn * uRays > 0.001) {
        col += texture2D(tRays, rsUv(uv, uRY)).rgb * uSunOn * uRays;
        // reflets d'optique le long de l'axe soleil-centre, seulement si le soleil est visible (vSunVis : voir le vertex shader)
        float sv = vSunVis;
        vec2 ax = vec2(0.5) - uSun; vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        float gh = 0.0;
        gh += smoothstep(0.06, 0.0, length((uv - (uSun + ax * 0.7)) * asp)) * 0.35;
        gh += smoothstep(0.035, 0.0, length((uv - (uSun + ax * 1.25)) * asp)) * 0.5;
        gh += smoothstep(0.12, 0.09, length((uv - (uSun + ax * 1.6)) * asp)) * smoothstep(0.06, 0.1, length((uv - (uSun + ax * 1.6)) * asp)) * 0.25;
        gh += smoothstep(0.02, 0.0, length((uv - (uSun + ax * 0.45)) * asp)) * 0.4;
        col += gh * sv * uRayTint * 0.6;
        float halo = smoothstep(0.35, 0.0, length((uv - uSun) * asp));
        col += halo * halo * sv * uRayTint * vec3(1.0, 0.85, 0.67) * 0.1;
      }
      col *= uExposure;
      col = aces(col*0.92);
      float l = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(col, col*uGradeLo, (1.0-l)*0.4);
      col = mix(col, col*uGradeHi, l*0.35);
      col = mix(vec3(l), col, uSat - uDesat);
      col = max(col, vec3(0.0)); // la saturation poussée peut rendre un canal négatif : pow(négatif) = NaN = pixel noir
      col = pow(col, vec3(1.0/2.2));
      col = clamp((col-0.5)*uCon+0.5, 0.0, 1.0);
      // noirs relevés (grade.lift) : le noir pur monte de uLift, l'effet décroît vite vers les tons moyens (un huitième au gris moyen) ;
      // l'image est un peu plus terne mais un soldat dans l'ombre reste lisible
      vec3 dk = 1.0 - col; col += uLift * dk * dk * dk;
      col *= 1.0 - r2*uVig;
      float e = smoothstep(0.18, 0.62, sqrt(r2)*1.35);
      // sang et assombrissement progressifs selon la vie manquante
      vec2 q = (uv-0.5)*vec2(uRes.x/uRes.y, 1.0);
      float ed = length(q)*1.35;
      float nb = vno(uv*vec2(7.0,5.0))*0.6 + vno(uv*vec2(19.0,13.0))*0.4;
      float thr = mix(1.5, 0.22, uHurt);
      float blood = smoothstep(thr, thr + 0.3, ed + (nb-0.5)*0.5) * smoothstep(0.02, 0.15, uHurt);
      float pulse = 1.0 + 0.1*sin(uTime*7.0)*uHurt*uHurt;
      col = mix(col, col*vec3(0.6,0.07,0.05) + vec3(0.11,0.0,0.0), clamp(blood*pulse, 0.0, 0.93));
      col *= 1.0 - uHurt*0.32*smoothstep(0.05, 1.0, ed);
      col = mix(col, vec3(dot(col, vec3(0.3,0.59,0.11))), uHurt*0.4);
      col = mix(col, vec3(0.5,0.02,0.02), clamp(uDamage*e*1.2, 0.0, 0.6));
      col += vec3(uFlash);
      float g = fract(sin(dot(uv*uRes + uTime*61.7, vec2(12.9898,78.233)))*43758.5453);
      col += (g-0.5)*0.012;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* Rayons crépusculaires : flou radial des zones très lumineuses (soleil, ciel, halo) vers le soleil,
   en demi-résolution (le résultat est très doux, un quart des pixels suffit). */
const RaysShader = {
  uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uBloom: { value: 1 }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new V3(...ATMO_DEFAULT.rays) }, uThr: { value: ATMO_DEFAULT.raysThr }, uCap: { value: ATMO_DEFAULT.raysCap }, uRS: RS.u },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tBloom; uniform float uBloom, uThr, uCap; uniform vec2 uSun, uRes; uniform vec3 uTint; uniform vec4 uRS; varying vec2 vUv;
    ${RS_GLSL}
    void main(){
      vec2 uv = vUv, dlt = (uSun - uv) / 32.0, p = uv; float dec = 1.0; vec3 acc = vec3(0.0);
      p += dlt * fract(sin(dot(uv * uRes, vec2(12.9898, 78.233))) * 43758.5453);
      for (int i = 0; i < 32; i++) {
        p += dlt; vec2 c = clamp(p, 0.001, 0.999);
        vec3 sm = texture2D(tDiffuse, rsUv(c, uRS)).rgb + texture2D(tBloom, c).rgb * uBloom;
        acc += clamp(dot(sm, vec3(0.3, 0.59, 0.11)) - uThr, 0.0, uCap) * dec; dec *= 0.955;
      }
      gl_FragColor = vec4(acc * uTint * 0.018, 1.0);
    }`,
};
class RaysPass extends THREE.Pass {
  constructor() {
    super(); this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(RaysShader.uniforms), vertexShader: RaysShader.vertexShader, fragmentShader: RaysShader.fragmentShader, depthTest: false, depthWrite: false });
    this.mat.uniforms.uRS = RS.u; // partagée (le clonage en a fait une copie)
    this.quad = new THREE.FullScreenQuad(this.mat);
  }
  setSize(w, h) { const rw = Math.max(1, Math.round(w / 2)), rh = Math.max(1, Math.round(h / 2)); this.rt.setSize(rw, rh); this.mat.uniforms.uRes.value.set(rw, rh); }
  render(renderer, writeBuffer, readBuffer) {
    const U = FinalShader.uniforms, u = this.mat.uniforms;
    if (U.uSunOn.value * U.uRays.value <= 0.001) return; // soleil hors champ : rien à calculer
    u.tDiffuse.value = readBuffer.texture; u.tBloom.value = U.tBloom.value; u.uBloom.value = U.uBloom.value; u.uSun.value.copy(U.uSun.value);
    renderer.setRenderTarget(this.rt); this.quad.render(renderer);
  }
}
/* Pré-passe de profondeur : la carte est fusionnée par matière, dessinée dans un ordre sans rapport avec la
   distance, et chaque pixel était ombré en moyenne 6 à 13 fois avec le shader complet (PBR, trois cascades
   d'ombre, éclairs). On écrit d'abord la seule profondeur des objets opaques (shader vide) ; la passe
   principale n'ombre ensuite que la surface visible. polygonOffset recule très légèrement cette profondeur
   pour que la même surface, recalculée par un autre programme, passe toujours le test. Les ombres ne sont
   pas rendues ici : elles le sont pendant la passe principale, avec tous les calques. */
class DepthPrepass extends THREE.Pass {
  constructor(sc, cam) {
    super(); this.scene = sc; this.camera = cam; this.needsSwap = false;
    // sans brouillard : la couleur n'est pas écrite, et le brouillard en altitude (fog_fragment, plus haut) coûtait un quart de la passe pour rien
    this.mat = new THREE.MeshBasicMaterial({ colorWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, mask = cam.layers.mask, sm = renderer.shadowMap.enabled;
    renderer.setRenderTarget(readBuffer); renderer.clear(true, true, false);
    cam.layers.set(LAYER_PREPASS); this.scene.overrideMaterial = this.mat; renderer.shadowMap.enabled = false; RENDER.skipResolve = true;
    try { renderer.render(this.scene, cam); } finally { RENDER.skipResolve = false; renderer.shadowMap.enabled = sm; this.scene.overrideMaterial = null; cam.layers.mask = mask; }
  }
}
/* Passe de scène dont la résolution multi-échantillonnée peut être différée (voir RENDER.skipResolve) */
class ScenePass extends THREE.RenderPass {
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    RENDER.skipResolve = !!this.deferResolve;
    try { super.render(renderer, writeBuffer, readBuffer, dt, mask); } finally { RENDER.skipResolve = false; }
  }
}
/* Objets admis dans la pré-passe : maillages opaques ordinaires, sans transparence ni découpe alpha, qui
   écrivent leur profondeur normalement. Tout objet non marqué est simplement ombré sans pré-passe : l'oubli
   coûte un peu de calcul mais ne fausse jamais l'image. Les lumières sont ajoutées au calque pour que la
   pré-passe voie le même éclairage que la passe principale (sinon three.js réévaluerait tous les programmes). */
function prepassEligible(o) {
  if (!o.isMesh || o.userData.noPrepass) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return false;
  return !m.transparent && !m.alphaTest && m.depthWrite && m.depthTest && m.colorWrite && m.depthFunc === THREE.LessEqualDepth && !m.wireframe && m.side !== THREE.BackSide && !m.alphaMap && !m.displacementMap;
}
function markPrepass(root) {
  root.traverse((o) => {
    if (o.isLight) o.layers.enable(LAYER_PREPASS);
    else if (o.userData.noPrepass || o.layers.isEnabled(LAYER_SHADOW)) return; // niveaux de détail gérés à part, ombre seule
    else if (prepassEligible(o)) o.layers.enable(LAYER_PREPASS);
    else o.layers.disable(LAYER_PREPASS);
  });
}

/* Matières de normales à découpe : même texture et même échelle que la matière du décor, pixels sous le seuil jetés */
const SSAO_CUT = new Map();
function ssaoCutMat(m) {
  let n = SSAO_CUT.get(m); if (n) return n;
  n = new THREE.MeshNormalMaterial({ side: m.side }); n.map = m.map; // la présence d'une texture fait générer les coordonnées (vUv)
  n.onBeforeCompile = (sh) => {
    sh.uniforms.uCutMap = { value: m.map }; sh.uniforms.uCutSc = m.userData.wmU ? m.userData.wmU.uWMs : { value: 1 }; sh.uniforms.uCut = { value: m.alphaTest };
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uCutSc;\nvoid main() {').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\nvUv *= uCutSc;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D uCutMap; uniform float uCut;\nvoid main() {\n#ifdef USE_UV\nif ( texture2D( uCutMap, vUv ).a < uCut ) discard;\n#endif');
  };
  n.customProgramCacheKey = () => 'ssaocut';
  SSAO_CUT.set(m, n); return n;
}
/* Seconde moitié de la passe de normales : seuls les objets à découpe, avec leur matière de normales, dans la même cible */
function ssaoCutPass(pass, renderer, target, cuts) {
  const scene = pass.scene, vis = [], mats = [];
  scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { vis.push([o, o.visible]); o.visible = false; } });
  for (const o of cuts) { mats.push([o, o.material]); o.material = ssaoCutMat(o.material); o.visible = true; }
  const ac = renderer.autoClear;
  renderer.setRenderTarget(target); renderer.autoClear = false;
  renderer.render(scene, pass.camera);
  renderer.autoClear = ac; renderer.setRenderTarget(pass.beautyRenderTarget);
  for (const [o, m] of mats) o.material = m;
  for (const [o, v] of vis) o.visible = v;
}
let composer, prePass, worldPass, vmPass, bloomPass, raysPass, finalPass, msaaTarget, ssaoPass = null;
/* Densité de pixels : la toile (canvas) suit toujours l'écran (jusqu'à 2) ; le rendu 3D suit l'écran dans la limite du
   profil (pr), multipliée par la résolution dynamique (dans un sous-rectangle des cibles, voir RS). La dernière passe agrandit
   l'image 3D à la taille de la toile (EASU) : sur un portable réglé à 125 ou 150 %, c'est elle qui agrandit, plus le navigateur. */
function canvasPixelRatio() { return Math.min(window.devicePixelRatio || 1, 2); }
function basePixelRatio() { return Math.min(canvasPixelRatio(), RQ.q.pr); }
function renderPixelRatio() { return basePixelRatio() * (gfxSet('dynres') === false ? 1 : RQ.scale); }
/* Surcroît de résolution possible au sommet de l'échelle automatique : jusqu'à la densité de l'écran */
function maxBoost() { return canvasPixelRatio() / basePixelRatio(); }
function setupComposer() {
  resolveQuality();
  renderer.setPixelRatio(canvasPixelRatio());
  viewSync();
  renderer.setSize(VIEW.w, VIEW.h, false);
  rsSize();
  msaaTarget = new THREE.WebGLRenderTarget(RS.cw, RS.ch, { type: THREE.HalfFloatType, samples: RQ.q.msaa });
  composer = new THREE.EffectComposer(renderer, msaaTarget); // densité 1 : les tailles données au composeur sont en pixels (RS)
  // la seconde cible ne sert qu'avec l'occlusion ambiante : pas d'anticrénelage sinon (voir applyQuality)
  composer.renderTarget2.samples = 0;
  { const cr = composer.render.bind(composer); composer.render = (dt) => { RENDER.clip = true; try { cr(dt); } finally { RENDER.clip = false; } }; }
  prePass = new DepthPrepass(scene, camera);
  worldPass = new ScenePass(scene, camera); worldPass.clear = NO_PREPASS; worldPass.deferResolve = true; // la pré-passe efface l'image ; sans elle, c'est la passe du monde
  prePass.enabled = !NO_PREPASS;
  composer.addPass(prePass); composer.addPass(worldPass);
  if (THREE.SSAOPass) {
    // occlusion un peu renforcée : les contacts entre murs, sol et objets se lisent mieux
    // (atténuée avec la distance, et sur les surfaces vues de biais où l'échantillonnage est le moins fiable : intérieurs de camions, murs rasants)
    THREE.SSAOShader.fragmentShader = THREE.SSAOShader.fragmentShader.replace('vec3( 1.0 - occlusion )',
      'vec3( clamp( 1.0 - pow( occlusion, 0.8 ) * 1.2 * ( 1.0 - smoothstep( 25.0, 60.0, - viewZ ) ) * mix( 0.45, 1.0, smoothstep( 0.1, 0.5, abs( viewNormal.z ) ) ), 0.0, 1.0 ) )');
    ssaoPass = new THREE.SSAOPass(scene, camera, RS.cw, RS.ch);
    ssaoPass.beautyRenderTarget.dispose();
    ssaoPass.beautyRenderTarget = new THREE.WebGLRenderTarget(RS.cw, RS.ch, { type: THREE.HalfFloatType, samples: 4 });
    // lectures ramenées dans le sous-rectangle rendu (RS) : profondeur et normales, flou, recopie finale
    rsTex(ssaoPass.ssaoMaterial, ['tDepth', 'tNormal']); rsTex(ssaoPass.blurMaterial, ['tDiffuse']); rsTex(ssaoPass.copyMaterial, ['tDiffuse']);
    ssaoPass.kernelRadius = 0.6; ssaoPass.minDistance = 0.00015; ssaoPass.maxDistance = 0.004;
    // les objets instanciés (chaises, caisses, pots...) restent dans la passe de profondeur : sinon l'occlusion les calcule comme
    // s'ils n'existaient pas et le décor derrière transparaît à travers eux
    const ov = ssaoPass.overrideVisibility.bind(ssaoPass);
    // Les objets à découpe (feuillages, grillages, filets) sortent de la passe commune : la matière de remplacement ignore leur
    // texture et en ferait des plaques pleines (halos autour des frondes, mur assombri derrière). Ils sont redessinés après, avec une
    // matière de normales qui jette les pixels transparents (ssaoCutPass).
    const cuts = [];
    ssaoPass.overrideVisibility = function () {
      ov(); cuts.length = 0;
      scene.traverse((o) => {
        if (o.userData.noAO || (o.material && o.material.transparent && !o.material.alphaTest)) o.visible = false;
        else if (o.isMesh && o.visible && o.material && !Array.isArray(o.material) && o.material.alphaTest && o.material.map) { cuts.push(o); o.visible = false; }
      });
    };
    const ro = ssaoPass.renderOverride.bind(ssaoPass);
    ssaoPass.renderOverride = function (renderer, mat, target, cc, ca) {
      ro(renderer, mat, target, cc, ca);
      if (mat === this.normalMaterial && cuts.length) ssaoCutPass(this, renderer, target, cuts);
    };
    composer.addPass(ssaoPass);
  }
  vmPass = new THREE.RenderPass(vmScene, vmCamera); vmPass.clear = false; vmPass.clearDepth = true;
  const B = (CURMAP.def ? CURMAP.def.atmo : ATMO_DEFAULT).bloom;
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(VIEW.w, VIEW.h), B[0], B[1], B[2]);
  // le halo est ajouté par la passe finale : on saute sa copie additive dans l'image multi-échantillonnée
  { const q = bloomPass.fsQuad, r = q.render.bind(q); q.render = (rd) => { if (q.material !== bloomPass.materialCopy) r(rd); }; }
  rsTex(bloomPass.materialHighPassFilter, ['tDiffuse']); // le halo lit le sous-rectangle rendu et s'étend à tout l'écran
  raysPass = new RaysPass();
  finalPass = new THREE.ShaderPass(FinalShader);
  FinalShader.uniforms = finalPass.uniforms; // ShaderPass clone les uniformes : on pointe sur les siens
  finalPass.uniforms.uRS = RS.u; finalPass.uniforms.uRY = RS.ry; // partagées
  FinalShader.uniforms.tBloom.value = bloomPass.renderTargetsHorizontal[0].texture;
  FinalShader.uniforms.tRays.value = raysPass.rt.texture;
  composer.addPass(vmPass); composer.addPass(bloomPass); composer.addPass(raysPass); composer.addPass(finalPass);
  applyQuality();
}
function applyQuality() {
  const q = resolveQuality();
  if (csm && csm.shadowMapSize !== shadowMapSize()) {
    csm.shadowMapSize = shadowMapSize();
    for (const l of csm.lights) { l.shadow.mapSize.set(csm.shadowMapSize, csm.shadowMapSize); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } l.shadow.needsUpdate = true; }
    csm.updateFrustums(); tuneShadowLights();
  }
  bloomPass.enabled = q.bloom; FinalShader.uniforms.uBloom.value = q.bloom ? 1 : 0;
  WMU.uPom.value.fromArray(q.pom);
  const ao = !!gfxSet('ao') && q.msaa > 0;
  if (ssaoPass) { ssaoPass.enabled = ao; worldPass.enabled = !ao; prePass.enabled = !ao && !NO_PREPASS; }
  FinalShader.uniforms.uRays.value = q.rays && gfxSet('rays') !== false ? 1 : 0;
  const rt1 = composer.renderTarget1, rt2 = composer.renderTarget2, s2 = ao ? q.msaa : 0;
  if (rt1.samples !== q.msaa) { rt1.samples = q.msaa; rt1.dispose(); }
  if (rt2.samples !== s2) { rt2.samples = s2; rt2.dispose(); }
  setFlashLightsVisible(false);
  applyResolution();
}
/* Change seulement les cibles du composeur (la toile garde sa taille : pas de clignotement de la page) */
function applyResolution() {
  renderer.setPixelRatio(canvasPixelRatio());
  onResize();
}
/* Nouvelle échelle de la résolution dynamique, même profil : seule la part dessinée change (rsView), rien n'est recréé ; au-delà de la taille
   allouée (résolution au-dessus du profil), les cibles grandissent d'un quart */
function applyScale() {
  if ((gfxSet('dynres') === false ? 1 : RQ.scale) > RS.cap + 1e-6) onResize(); else { rsView(); if (typeof onResizeFx === 'function') onResizeFx(); } // taille des particules (pointScale)
}
/* Taille allouée des cibles (voir RS) : la densité du profil, ou par quarts au-dessus quand la résolution y monte */
function rsSize() {
  RS.cap = Math.max(1, Math.ceil((gfxSet('dynres') === false ? 1 : RQ.scale) * 4 - 1e-6) / 4);
  const pr = basePixelRatio() * RS.cap;
  RS.cw = Math.max(1, Math.round(VIEW.w * pr)); RS.ch = Math.max(1, Math.round(VIEW.h * pr));
}
/* Part dessinée des cibles (viewport et scissor) et uniformes qui en dépendent */
function rsView() {
  const pr = renderPixelRatio(), cw = RS.cw, ch = RS.ch;
  const w = Math.min(cw, Math.max(1, Math.round(VIEW.w * pr))), h = Math.min(ch, Math.max(1, Math.round(VIEW.h * pr)));
  RS.w = w; RS.h = h;
  const tg = [composer.renderTarget1, composer.renderTarget2];
  if (ssaoPass) tg.push(ssaoPass.beautyRenderTarget, ssaoPass.normalRenderTarget, ssaoPass.ssaoRenderTarget, ssaoPass.blurRenderTarget);
  for (const t of tg) { t.viewport.set(0, 0, w, h); t.scissor.set(0, 0, w, h); t.scissorTest = w < cw || h < ch; }
  RS.u.value.set(w / cw, h / ch, (w - 0.5) / cw, (h - 0.5) / ch);
  const r = raysPass.rt, W = r.width, H = r.height, rw = Math.min(W, Math.max(1, Math.round(w / 2))), rh = Math.min(H, Math.max(1, Math.round(h / 2)));
  r.viewport.set(0, 0, rw, rh); r.scissor.set(0, 0, rw, rh); r.scissorTest = rw < W || rh < H;
  RS.ry.value.set(rw / W, rh / H, (rw - 0.5) / W, (rh - 0.5) / H);
  raysPass.mat.uniforms.uRes.value.set(rw, rh);
  if (ssaoPass) { ssaoPass.ssaoMaterial.uniforms.resolution.value.set(w, h); ssaoPass.blurMaterial.uniforms.resolution.value.set(w, h); }
  // rendu 3D plus petit que la toile : agrandissement (EASU ; bicubique sans WebGL 2, d'autant plus net que l'écart est grand) ; 0 : lecture directe
  const U = FinalShader.uniforms, ratio = (VIEW.h * canvasPixelRatio()) / h;
  U.uTexel.value.set(1 / w, 1 / h);
  U.uSharp.value = ratio > 1.001 ? 0.5 + clamp((ratio - 1) * 0.6, 0, 0.35) : 0;
}
/* Lectures d'une passe d'image (samplers nommés) ramenées dans le sous-rectangle rendu : texture2D(t, uv) devient texture2D(t, rsUv(uv, uRS)) */
function rsTex(mat, names) {
  let fs = mat.fragmentShader, out = '', i = 0;
  const re = new RegExp(`texture2D\\(\\s*(${names.join('|')})\\s*,`, 'g');
  for (let m; (m = re.exec(fs));) {
    let j = re.lastIndex, d = 1;
    for (; j < fs.length && d; j++) d += fs[j] === '(' ? 1 : fs[j] === ')' ? -1 : 0;
    out += fs.slice(i, re.lastIndex) + ' rsUv(' + fs.slice(re.lastIndex, j - 1) + ', uRS))'; i = re.lastIndex = j;
  }
  mat.fragmentShader = 'uniform vec4 uRS;\n' + RS_GLSL + out + fs.slice(i);
  mat.uniforms.uRS = RS.u; mat.needsUpdate = true;
}
/* Taille de la vue 3D. Sur iPhone (iOS 26 notamment), la hauteur annoncée est parfois plus courte que l'écran : au lancement d'une application
   installée (indicateur d'accueil) ou sous les commandes flottantes de Safari, qui ne dessine pas un élément fixe jusqu'en bas. La toile en
   « inset: 0 » laissait une bande noire en bas, jusqu'au recalcul suivant. On prend la plus grande hauteur connue (fenêtre, vue visible,
   document et, en application installée, l'écran lui-même), imposée à la toile, au HUD et au fond des menus (--app-h) ; les projections (HUD,
   marqueurs, niveaux de détail) s'y rapportent toutes (VIEW). Revérifiée quand la vue change et dans les secondes qui suivent le lancement. */
function viewMeasure() {
  const vv = window.visualViewport, de = document.documentElement;
  let h = Math.max(innerHeight, de.clientHeight || 0, vv ? Math.round(vv.height) : 0);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && screen.width && screen.height && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) {
    const sh = innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    if (sh > h && sh - h < 90) h = sh; // écart d'une barre d'état ou de l'indicateur d'accueil, pas d'un clavier ni d'un écran partagé
  }
  return [innerWidth, h];
}
function viewSync() {
  const [w, h] = viewMeasure();
  if (VIEW.set && w === VIEW.w && h === VIEW.h) return false;
  VIEW.w = w; VIEW.h = h; VIEW.set = true;
  document.documentElement.style.setProperty('--app-h', h + 'px');
  return true;
}
function viewCheck() { if (viewSync()) onResize(); }
function onResize() {
  viewSync();
  const w = VIEW.w, h = VIEW.h;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  FinalShader.uniforms.uRes.value.set(w, h);
  if (composer) { rsSize(); composer.setSize(RS.cw, RS.ch); rsView(); }
  if (typeof onResizeFx === 'function') onResizeFx();
  if (csm) { csm.updateFrustums(); tuneShadowLights(); }
}
/* ---------- Résolution dynamique ----------
   Quand les images arrivent en retard parce que la carte graphique sature, on baisse la résolution (de 5 à 20 %, dynDown ; au bout de la
   plage du profil, échelon suivant de AUTO_LADDER en mode automatique) ; on remonte de 5 % après quelques secondes de marge. Changer de
   résolution ne recrée aucune cible (rendu dans un sous-rectangle, RS) : pas d'à-coup, d'où les petits pas. Chaque remontée ratée
   allonge l'attente avant la suivante (pas d'oscillation), et un changement de profil (anticrénelage, ombres, qui
   recrée les cibles de rendu) demande une confirmation : deux fenêtres lentes de suite pour descendre, deux fois plus
   de marge pour remonter. Si le processeur est seul en cause, baisser la qualité ne servirait à rien : on ne touche
   à rien. Le temps GPU est mesuré directement quand le navigateur le permet (EXT_disjoint_timer_query_webgl2) : c'est
   seulement alors que la résolution peut monter au-delà du profil (écrans haute densité), marge prouvée. */
/* Cadence haute : à partir de 175 images par seconde (écrans de 240 Hz et plus), les bots (intelligence et animation) et les cascades d'ombres n'ont
   plus besoin de suivre chaque image. HF.k vaut 1 (rien ne change), 2 (240 Hz : bots et ombres proches à 120 Hz) ou 3 (360 Hz). Le joueur, la
   caméra, le rendu et les armes restent à chaque image. Seuils avec hystérésis : on monte à 175 et 340, on redescend à 150 et 290. Le coût de
   l'image à 280 images par seconde se joue en dixièmes de milliseconde : une image de 3,6 ms de budget n'en laisse pas pour un ramasse-miettes ou
   un pic de calcul, et un rafraîchissement raté de l'écran se voit alors. */
const HF = { k: 1 };
function hfUpdate(fps) { HF.k = fps > (HF.k >= 3 ? 290 : 340) ? 3 : fps > (HF.k >= 2 ? 150 : 175) ? 2 : 1; }
/* ring : les 256 derniers intervalles entre deux images (hors chargement et onglet masqué) ; la médiane des images par seconde cache les images lentes
   isolées, que le joueur ressent comme des à-coups : worst et low1 (le 1 % le plus lent) les montrent (dynStat) */
const DYN = { win: [], cpu: 0, gpu: 0, good: 0, need: 4, lastUp: -1e9, slow: 0, lagN: 0, stat: { fps: 0, ms: 0, worst: 0, worstC: 0, low1: 0 }, ring: new Float32Array(256), ringC: new Float32Array(256), tmp: new Float32Array(256), ri: 0 };
function dynStat() {
  const r = DYN.ring, t = DYN.tmp, n = Math.min(DYN.ri, 256); if (n < 30) return DYN.stat;
  let w = 0; for (let i = 0; i < n; i++) { t[i] = r[i]; if (r[i] > r[w]) w = i; }
  DYN.stat.worstC = DYN.ringC[w]; // temps de calcul de cette image-là : bien plus petit que son intervalle, le retard est hors de notre code (navigateur, GPU, synchronisation)
  const v = t.subarray(0, n).sort(); DYN.stat.worst = v[n - 1]; DYN.stat.low1 = v[Math.min(n - 1, Math.floor(n * 0.99))];
  return DYN.stat;
}
const GPUT = (() => {
  // pas sur téléphone : le premier rendu continu d'un Pixel (vue aérienne, la seule différence avec l'image d'échauffement du chargement, qui passait) a perdu le contexte WebGL
  // 0,7 s après son début ; les requêtes de chronométrage, seul chemin graphique exotique de la boucle d'images, sont écartées (le temps CPU suffit à la résolution dynamique)
  const gl = renderer.getContext(), ext = COARSE ? null : gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  const T = { gl, ext, pending: [], active: null, ms: 0 };
  T.begin = () => { if (T.active || T.pending.length > 3) return; T.active = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, T.active); };
  T.end = () => { if (!T.active) return; gl.endQuery(ext.TIME_ELAPSED_EXT); T.pending.push(T.active); T.active = null; };
  T.poll = () => {
    while (T.pending.length && gl.getQueryParameter(T.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = T.pending.shift(), ok = !gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (ok) { const v = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; T.ms = T.ms ? T.ms * 0.85 + v * 0.15 : v; }
      gl.deleteQuery(q);
    }
    return T.ms;
  };
  return T;
})();
const FRAME_BUDGET = 1000 / 60;
/* ---------- Limite de cadence ----------
   Sans limite, un téléphone à écran de 120 Hz dessine 120 images par seconde et chauffe (retour du propriétaire, Pixel). Économie d'énergie (Settings.eco,
   activée par défaut au doigt) : 30 images par seconde ; sinon, le plafond choisi dans Options, Vidéo (Settings.fpsMax, '0' : sans limite, 'half' : moitié de la fréquence de l'écran, voir VSYNC). La qualité
   de l'image ne change pas, seules les images en trop sont sautées, menus compris. Une image n'est dessinée que si une période s'est écoulée depuis la
   précédente (à 1 ms près, les horodatages d'image suivent le rafraîchissement de l'écran) : à 30 sur un écran de 60 Hz, une image sur deux, à 60 sur
   120 Hz aussi. La période avance d'un pas fixe (pas de dérive de la cadence), repart de l'image courante après une pause ou un gros retard.
   La résolution dynamique mesure alors ses images contre la période (frameBudget) : sans quoi 33 ms par image passeraient pour un GPU trop lent. */
const CAP = { t: 0 };
function capMs() {
  if (!Settings.eco && Settings.fpsMax === 'half') return VSYNC.ms ? 2 * VSYNC.ms : 0;
  const f = Settings.eco ? 30 : +Settings.fpsMax || 0; return f > 0 ? 1000 / f : 0;
}
/* « Moitié de l'écran » (Settings.fpsMax 'half') : une image sur deux rafraîchissements, quelle que soit la fréquence de l'écran (140 sur un écran de
   280 Hz, 72 sur 144 Hz). Rapport de performances du propriétaire (RTX 3070, écran de 280 Hz, Kervénec) : les images tombent sur les multiples de la
   période de l'écran, 3,6 ms (un quart des images), 7,1 ms (six sur dix), 10,7 ms ; l'alternance de 280 et 140 images par seconde fait une cadence
   irrégulière, à moitié elle est égale. La période de l'écran est suivie sur les rappels d'image, dessinés ou non (vsyncTrack, au début de frame) :
   le plus court intervalle de chaque série de 60, lissé ; adopté tout de suite s'il s'écarte de plus d'un cinquième (fenêtre passée sur un autre écran). */
const VSYNC = { ms: 0, last: 0, min: Infinity, n: 0 };
function vsyncTrack(now) {
  const d = now - VSYNC.last; VSYNC.last = now;
  if (d <= 1 || d > 50) return;
  if (!VSYNC.ms) VSYNC.ms = d;
  if (d < VSYNC.min) VSYNC.min = d;
  if (++VSYNC.n < 60) return;
  const m = VSYNC.min; VSYNC.min = Infinity; VSYNC.n = 0;
  VSYNC.ms = Math.abs(m - VSYNC.ms) > VSYNC.ms * 0.2 ? m : VSYNC.ms + (m - VSYNC.ms) * 0.25;
}
function capWait(now) { const ms = capMs(), d = now - CAP.t; return ms > 0 && d >= 0 && d < ms - 1; }
function capTake(now) { const ms = capMs(), d = now - CAP.t; CAP.t = ms > 0 && d >= 0 && d < ms * 2 ? CAP.t + ms : now; }
function frameBudget() { return Math.max(FRAME_BUDGET, capMs()); }
/* ---------- File d'images courte ----------
   Quand la carte graphique est le goulot, le processeur prend de l'avance et le pilote empile 2 à 3 images déjà préparées : la souris, lue au début de l'image,
   n'apparaît à l'écran qu'après toute la file (80 à 120 ms de retard sur une puce intégrée, alors que l'affichage indique 60 images par seconde). Tant que le
   temps GPU mesuré frôle le budget (LAG.on, décidé par updateDynRes), une barrière (fenceSync) suit chaque image et la file est bornée à une image en
   cours sur le GPU : si l'avant-dernière image n'est pas finie, l'image est sautée (lagSkip, avant toute lecture de la souris) au lieu de s'ajouter à la
   file. L'image précédente, elle, peut encore se dessiner pendant que le processeur prépare la suivante : la barrière de l'image précédente (version 2.32.1
   et avant) sérialisait processeur et GPU, et dès que leurs deux temps additionnés dépassaient 16,7 ms, une image sur deux sautait (30 images par seconde
   pile sur une puce Intel intégrée, quelle que soit la résolution). Aucun effet quand le GPU a de la marge : la barrière est toujours franchie.
   Sauf quand le pilote signale ses barrières en retard (Radeon RX 580 sous Windows, rendu par Direct3D 11 : 20 images par seconde, GPU occupé à
   45 %) : l'image sautait alors deux fois sur trois alors que le GPU avait fini. Si les images sautées font tomber la cadence loin sous ce que
   le temps GPU mesuré permettrait, la file courte est coupée pour la session (LAG.ban, updateDynRes).
   Une image sautée se voit (la même image reste affichée deux fois) : retour du propriétaire, octobre 2026, sur un ultraportable et un eGPU
   d'entrée de gamme, « 60 images par seconde affichées, mais ça accroche souris en main ». Les barrières d'un eGPU arrivent en retard (le
   câble), et jusque-là la file courte n'était coupée qu'au-delà de 10 images sautées sur 30 avec une cadence effondrée : quelques images
   sautées par seconde passaient sous la médiane. La fluidité passe avant ce gain de latence : plus de 2 images sautées sur 30, deux relevés
   de suite, et la file courte est coupée pour la session (la résolution dynamique, elle, continue d'alléger le GPU s'il est le goulot). */
const LAG = { on: false, q: [], skips: 0, n: 0, ban: false, bad: 0 };
function lagDrop() {
  const gl = renderer.getContext();
  for (const f of LAG.q) { try { gl.deleteSync(f); } catch (e) { /* ignoré */ } }
  LAG.q.length = 0;
}
function lagSkip() {
  if (LAG.q.length < 2) return false;
  const gl = renderer.getContext(); let r = 0;
  try { r = gl.clientWaitSync(LAG.q[0], 0, 0); } catch (e) { lagDrop(); return false; }
  if (r !== gl.TIMEOUT_EXPIRED) { LAG.skips = 0; return false; }
  if (++LAG.skips > 6) { lagDrop(); LAG.skips = 0; return false; } // GPU figé ou très lent : on ne prive pas le jeu d'images
  LAG.n++; return true;
}
function lagMark() {
  if (!LAG.on) { if (LAG.q.length) lagDrop(); return; }
  const gl = renderer.getContext();
  try { LAG.q.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)); gl.flush(); } catch (e) { lagDrop(); LAG.on = false; return; }
  while (LAG.q.length > 2) { try { gl.deleteSync(LAG.q.shift()); } catch (e) { /* ignoré */ } }
}
/* Un pas de qualité : dir = -1 plus léger, +1 plus beau, step : écart de résolution (5 % en montant). Renvoie faux si rien
   ne change, 'wait' si le changement de profil attend sa confirmation. */
function stepQuality(dir, step = 0.05) {
  if (QUALITY[gfxSet('quality')]) {
    const sc = clamp(Math.round((RQ.scale + dir * step) * 100) / 100, RQ.q.scaleMin, 1);
    if (sc === RQ.scale) return false;
    RQ.scale = sc; applyScale(); return true;
  }
  if (GFX_SAFE) return false; // mode économique, profil imposé
  // au-dessus de 1 (profil de départ seulement), il faut une marge prouvée par le temps GPU mesuré
  const [, lo, hi] = AUTO_LADDER[RQ.rung], room = DYN.gpu > 0 && DYN.gpu < FRAME_BUDGET * 0.5;
  const top = RQ.rung === RQ.rungMin ? (room && !Settings.eco ? Math.max(1, maxBoost()) : 1) : hi;
  const sc = Math.round((dir > 0 ? Math.min(RQ.scale + step, top) : Math.max(RQ.scale - step, lo)) * 100) / 100;
  if (dir > 0 ? sc > RQ.scale : sc < RQ.scale) { RQ.scale = sc; applyScale(); return true; }
  const r = RQ.rung - dir;
  if (r < RQ.rungMin || r >= AUTO_LADDER.length || (dir > 0 && RQ.scale < hi)) return false;
  if (dir < 0 ? DYN.slow < 2 : DYN.good < DYN.need * 2) return 'wait';
  RQ.rung = r; RQ.scale = AUTO_LADDER[r][dir < 0 ? 2 : 1]; resolveQuality(); applyQuality();
  return true;
}
/* Pas de descente : proportionnel au temps GPU mesuré quand il dépasse le budget (le coût suit le nombre de pixels, le carré de l'échelle ;
   visé : 75 % du budget), de 5 à 20 % ; sans mesure, 10 % pour des images très en retard, 5 % sinon */
function dynDown(med) {
  const b = frameBudget();
  if (DYN.gpu > b * 0.85) return clamp(RQ.scale * (1 - Math.sqrt((b * 0.75) / DYN.gpu)), 0.05, 0.2);
  return med > b * 1.4 ? 0.1 : 0.05;
}
function updateDynRes(now, intervalMs, cpuMs) {
  if (GPUT) DYN.gpu = GPUT.poll();
  if (now - GPUF.t0 < 5000) { DYN.win.length = 0; return; } // premières secondes d'un rendu continu (gpuFrame, 01a-gpu.js) : compilations tardives, mise en route du GPU ; pas de recréation des cibles de rendu
  if (intervalMs > 250 || document.hidden) { DYN.win.length = 0; return; } // onglet en arrière-plan, chargement
  DYN.cpu = DYN.cpu ? DYN.cpu * 0.9 + cpuMs * 0.1 : cpuMs;
  DYN.ringC[DYN.ri & 255] = cpuMs; DYN.ring[DYN.ri++ & 255] = intervalMs; DYN.win.push(intervalMs); if (DYN.win.length < 30) return;
  const w = DYN.win.sort((a, b) => a - b), med = w[15], p90 = w[27]; DYN.win.length = 0;
  DYN.stat.fps = 1000 / med; DYN.stat.ms = med; hfUpdate(DYN.stat.fps);
  if (gfxSet('dynres') === false || MATCH.state === 'loading') { if (gfxSet('dynres') === false && LAG.on) { LAG.on = false; lagDrop(); } return; } // résolution dynamique coupée : file courte coupée aussi
  const budget = frameBudget(); // la période de la limite de cadence, si elle est plus longue
  // un GPU à 95 % du budget tient 60 images par seconde mais remplit la file d'images (latence de la souris) et décroche au moindre pic : au-delà de 85 %
  // (seulement si l'écran n'est pas bien plus rapide que 60 Hz), on baisse la résolution ; on ne remonte qu'à moins de 60 % (hystérésis, voir roomy)
  const gpuHot = DYN.gpu > budget * 0.85 && med > budget * 0.9;
  const slow = med > budget * 1.12 || p90 > budget * 1.6 || gpuHot;
  // le GPU n'est le goulot que si son temps mesuré explique l'essentiel de l'intervalle entre deux images : à 20 images par seconde pour 14 ms de GPU,
  // baisser la qualité n'y changerait rien
  const gpuBound = DYN.gpu ? DYN.gpu > budget * 0.8 && DYN.gpu > med * 0.55 : DYN.cpu < med * 0.7;
  // barrières signalées en retard : la file courte saute plus d'une image sur quatre et la cadence tombe loin sous ce que le GPU tiendrait
  const skipped = LAG.n - DYN.lagN; DYN.lagN = LAG.n;
  LAG.bad = LAG.on && skipped > 2 ? LAG.bad + 1 : 0;
  if (LAG.on && ((skipped > 10 && med > budget * 1.4 && DYN.gpu < med * 0.6) || LAG.bad >= 2)) { LAG.ban = true; LAG.on = false; lagDrop(); gpuLog(`short frame queue off: ${LAG.bad >= 2 ? 'frames skipped again and again' : 'late fences'} (${skipped} skipped, ${med.toFixed(0)} ms per frame, GPU ${DYN.gpu.toFixed(1)} ms)`); }
  // file courte : nécessite le temps GPU mesuré (hystérésis 80 % / 65 %), pas sur téléphone (rendu par tuiles, rien à gagner)
  LAG.on = !COARSE && !LAG.ban && !!DYN.gpu && MATCH.state === 'playing' && DYN.gpu > budget * (LAG.on ? 0.65 : 0.8);
  // on n'embellit que si les images arrivent à l'heure : le temps GPU mesuré ne compte ni la composition de la page par le navigateur, ni ce
  // que coûte au processeur une puce graphique intégrée qui partage sa puissance avec lui (un PC de bureau à 40 images par seconde, GPU mesuré
  // à 7 ms, montait sa résolution jusqu'à 1,5 fois et ne la redescendait plus) ; images en retard, la résolution au-dessus du profil repart
  // d'abord, quel que soit le temps GPU mesuré
  const onTime = med <= budget * 1.04 && p90 < budget * 1.25;
  const roomy = onTime && (!DYN.gpu || DYN.gpu < budget * 0.6);
  if (slow && (gpuBound || RQ.scale > 1)) {
    DYN.good = 0; DYN.slow++;
    if (now - DYN.lastUp < 3000) DYN.need = Math.min(DYN.need * 2, 96); // la remontée précédente était de trop
    if (stepQuality(-1, dynDown(med)) === true) DYN.slow = 0;
  } else if (roomy) {
    DYN.slow = 0;
    if (++DYN.good >= DYN.need) { const r = stepQuality(1); if (r !== 'wait') DYN.good = 0; if (r === true) DYN.lastUp = now; }
  } else { DYN.slow = 0; DYN.good = Math.max(0, DYN.good - 1); }
}
addEventListener('resize', onResize);
if (window.visualViewport) visualViewport.addEventListener('resize', viewCheck);
addEventListener('orientationchange', () => { for (const ms of [120, 500, 1200]) setTimeout(viewCheck, ms); });
addEventListener('pageshow', () => { for (const ms of [0, 400]) setTimeout(viewCheck, ms); });
for (const ms of [300, 1000, 2500, 5000]) setTimeout(viewCheck, ms); // la hauteur juste n'arrive parfois qu'après le lancement

/* Environnement (reflets, lumière d'ambiance des matières) : ciel procédural de la carte, remplacé par son HDRI dès
   qu'elle est chargée. Les HDRI déjà converties restent en cache (retour sur une carte déjà jouée). */
let envMap = null;
const ENV_CACHE = new Map();
function setEnvMap(t) {
  if (envMap && envMap !== t && ![...ENV_CACHE.values()].includes(envMap)) envMap.dispose();
  envMap = t; scene.environment = t; vmScene.environment = t;
  buildEnvCubes(t);
}
function buildEnvironment() {
  const A = CURMAP.def ? CURMAP.def.atmo : ATMO_DEFAULT;
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    uniforms: SkyShader.uniforms, vertexShader: SkyShader.vertexShader.replace('p.xyww', 'p'), fragmentShader: SkyShader.fragmentShader, side: THREE.BackSide, defines: { ...skyMat.defines },
  }));
  envScene.add(s2);
  const g = new THREE.Mesh(new THREE.CircleGeometry(49, 24), new THREE.MeshBasicMaterial({ color: A.envGround }));
  g.rotation.x = -Math.PI / 2; g.position.y = -2; envScene.add(g);
  setEnvMap(pm.fromScene(envScene, 0.03).texture);
  pm.dispose();
  for (const m of [s2, g]) { m.geometry.dispose(); m.material.dispose(); }
}

/* ---------- Éclairage d'ambiance en cube maps ----------
   three.js range l'éclairage d'ambiance filtré (PMREM) dans un atlas 2D : chaque lecture cherche la face du cube, ses
   coordonnées et sa place dans l'atlas (code très ramifié), deux fois pour interpoler entre deux niveaux de flou, et
   une troisième pour la lumière diffuse. Mesuré : plus du tiers de la passe principale. Au chargement, on recopie donc
   chaque niveau du PMREM, lu par sa propre fonction (bilinearCubeUV, donc exactement le même flou), dans deux vraies
   cube maps à mipmaps : « brillante » (niveaux nets, 256 à 16 pixels) et « mate » (niveaux flous, suréchantillonnés).
   Le shader ne fait plus qu'une lecture matérielle trilinéaire par terme, et l'interpolation entre deux niveaux voisins
   est celle du PMREM (linéaire en niveau). Sans WebGL 2, le code de three.js est gardé. */
const ENVC = { on: renderer.capabilities.isWebGL2, gloss: { value: null }, rough: { value: null }, rtG: null, rtR: null };
if (ENVC.on) {
  const src = THREE.ShaderChunk.envmap_physical_pars_fragment;
  if (src.indexOf('vec3 getIBLIrradiance') < 0 || src.indexOf('vec3 getIBLRadiance') < 0) ENVC.on = false; // three.js inattendu
  else THREE.ShaderChunk.envmap_physical_pars_fragment = `#if defined( USE_ENVMAP ) && defined( ENV_CUBES ) && defined( ENVMAP_TYPE_CUBE_UV )
	#ifdef WM_NOGLOSS
	uniform highp samplerCube uEnvRough;
	#else
	uniform highp samplerCube uEnvGloss, uEnvRough;
	#endif
	// niveau de flou du PMREM pour cette rugosité (roughnessToMip), lu dans la cube map qui le porte ; WM_NOGLOSS : sans la cube map brillante (une unité de
	// texture de moins, pour le sol des téléphones), les niveaux nets sont remplacés par le plus net des niveaux mats
	vec3 envCubeSample( vec3 dir, float roughness ) {
		float m = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		#ifdef WM_NOGLOSS
		if ( m >= 3.0 ) return textureLod( uEnvRough, dir, 0.0 ).rgb;
		#else
		if ( m >= 4.0 ) return textureLod( uEnvGloss, dir, CUBEUV_MAX_MIP - m ).rgb;
		if ( m >= 3.0 ) return mix( textureLod( uEnvRough, dir, 0.0 ).rgb, textureLod( uEnvGloss, dir, CUBEUV_MAX_MIP - 4.0 ).rgb, m - 3.0 );
		#endif
		return textureLod( uEnvRough, dir, 3.0 - m ).rgb;
	}
	vec3 getIBLIrradiance( const in vec3 normal ) {
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		return PI * textureLod( uEnvRough, worldNormal, 5.0 ).rgb * envMapIntensity;
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		vec3 reflectVec = reflect( - viewDir, normal );
		reflectVec = normalize( mix( reflectVec, normal, roughness * roughness ) );
		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
		return envCubeSample( reflectVec, roughness ) * envMapIntensity;
	}
#else
` + src + `
#endif
`;
}
/* Branche l'éclairage en cube sur une matière standard (appelé par onBeforeCompile) */
function envCubeHook(shader) {
  if (!ENVC.on || shader.envCube) return;
  shader.envCube = true;
  shader.uniforms.uEnvGloss = ENVC.gloss; shader.uniforms.uEnvRough = ENVC.rough;
  shader.fragmentShader = '#define ENV_CUBES\n' + shader.fragmentShader;
}
// toutes les matières standard, de la scène comme de la vue subjective ; les matières des ombres en cascade passent par csmMaterial
THREE.MeshStandardMaterial.prototype.onBeforeCompile = function (shader) { envCubeHook(shader); };
/* Recopie du PMREM pm dans les deux cube maps (au chargement, et quand l'éclairage HDRI remplace l'éclairage procédural) */
function buildEnvCubes(pm) {
  if (!ENVC.on || !pm || !pm.image || !pm.image.height) return;
  const H = pm.image.height, maxMip = Math.round(Math.log2(H) - 2), gs = 2 ** maxMip;
  const mk = (size) => new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  if (!ENVC.rtG || ENVC.rtG.width !== gs) { if (ENVC.rtG) ENVC.rtG.dispose(); ENVC.rtG = mk(gs); }
  if (!ENVC.rtR) ENVC.rtR = mk(256);
  const mat = new THREE.ShaderMaterial({
    defines: { ENVMAP_TYPE_CUBE_UV: '', CUBEUV_MAX_MIP: maxMip + '.0', CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(2 ** maxMip, 7 * 16)), CUBEUV_TEXEL_HEIGHT: 1 / H },
    uniforms: { envMap: { value: pm }, uFace: { value: 0 }, uMip: { value: 0 }, uSize: { value: 1 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    // direction du texel selon la convention des cube maps de GL (face, coordonnées s et t)
    fragmentShader: `uniform highp sampler2D envMap; uniform float uFace, uMip, uSize;
      #include <cube_uv_reflection_fragment>
      void main() {
        vec2 st = gl_FragCoord.xy / uSize * 2.0 - 1.0; vec3 d;
        if (uFace < 0.5) d = vec3(1.0, -st.y, -st.x); else if (uFace < 1.5) d = vec3(-1.0, -st.y, st.x);
        else if (uFace < 2.5) d = vec3(st.x, 1.0, st.y); else if (uFace < 3.5) d = vec3(st.x, -1.0, -st.y);
        else if (uFace < 4.5) d = vec3(st.x, -st.y, 1.0); else d = vec3(-st.x, -st.y, -1.0);
        gl_FragColor = vec4(bilinearCubeUV(envMap, normalize(d), uMip), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.FullScreenQuad(mat), prev = renderer.getRenderTarget(), U = mat.uniforms;
  // niveau 0 d'abord (les mipmaps générées allouent tous les niveaux), puis chaque niveau recopié du PMREM
  const fill = (rt, levels, mipOf) => {
    rt.texture.generateMipmaps = true;
    for (let L = 0; L < levels; L++) {
      if (L === 1) rt.texture.generateMipmaps = false;
      const sz = Math.max(1, rt.width >> L); rt.viewport.set(0, 0, sz, sz);
      U.uMip.value = mipOf(L); U.uSize.value = sz;
      for (let f = 0; f < 6; f++) { U.uFace.value = f; renderer.setRenderTarget(rt, f, L); quad.render(renderer); }
    }
    rt.viewport.set(0, 0, rt.width, rt.width);
  };
  fill(ENVC.rtG, maxMip - 3, (L) => maxMip - L); // niveaux PMREM maxMip (net) à 4
  fill(ENVC.rtR, 6, (L) => 3 - L); // niveaux PMREM 3 à -2 (rugosité 1)
  renderer.setRenderTarget(prev);
  // pas de quad.dispose() : il libérerait la géométrie plein écran partagée par toutes les passes (voir buildSatelliteMap)
  mat.dispose();
  ENVC.gloss.value = ENVC.rtG.texture; ENVC.rough.value = ENVC.rtR.texture;
}

/* ---------- Ressources CC0 ---------- */
/* Textures photo (Poly Haven, ambientCG) : un fichier par surface à côté de la page (dist/tex/, voir build.py), chargé par
   une balise script (marche aussi en file://) au lancement de la première carte qui s'en sert ; le fichier appelle
   texPack(clé, données). Clé absente ou fichier injoignable : la surface procédurale la plus proche la remplace. */
const TEX_PACKS = /*__TEX_PACKS__*/ {};
const TEXP = new Map(); // clé → fonction qui reçoit les données
function texPack(key, d) { const f = TEXP.get(key); if (f) f(d); }
function fetchTexPack(key) {
  if (!TEX_PACKS[key]) return Promise.resolve(null);
  return new Promise((res) => {
    const s = document.createElement('script');
    const done = (d) => { if (!TEXP.has(key)) return; TEXP.delete(key); clearTimeout(timer); s.remove(); res(d); };
    const timer = setTimeout(() => done(null), 30000);
    TEXP.set(key, done);
    s.onerror = () => done(null);
    s.src = TEX_PACKS[key]; document.head.appendChild(s);
  });
}
/* Charge et décode les surfaces demandées dans T ; onOne() après chacune (progression) */
function loadAssetTextures(T, keys, onOne) {
  const L = new THREE.TextureLoader();
  const one = (url, srgb) => new Promise((res, rej) => L.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding; res(t); }, undefined, rej));
  return Promise.all(keys.map((k) => fetchTexPack(k)
    .then((d) => d && Promise.all([one(d.map, true), one(d.normal, false), one(d.rough, false)]))
    .then((r) => { if (r) T[k] = { map: r[0], normal: r[1], rough: r[2], asset: true }; })
    .catch(() => null)
    .then(() => { if (onOne) onOne(k); })));
}
/* Éclairage d'ambiance : HDRI de Poly Haven (« sunset » pour Khamsin, « sky » pour Val-Blanc), CC0, prises dans @pmndrs/assets et servies
   par le site (tools/vendor.py) : paquet texPack hdri_<nom>, la chaîne base64 du fichier EXR. */
/* Téléchargements par HDRI (nom → { ready, t0 }) : celle de la dernière carte choisie part dès le démarrage, les
   autres au chargement de leur carte, qui les attend au plus 6 s après leur départ (sinon éclairage procédural) */
const HDRI = { jobs: new Map() };
const HDRI_BUSY = ['playing', 'killcam', 'finish'];
function hdriFetch(name) {
  let j = HDRI.jobs.get(name);
  if (!j) { j = { t0: performance.now(), ready: null }; HDRI.jobs.set(name, j); j.ready = loadHDRIEnvironment(name); }
  return j;
}
async function loadHDRIEnvironment(name) {
  const wanted = () => CURMAP.def && CURMAP.def.atmo.hdri === name; // la carte a pu changer entre-temps
  if (ENV_CACHE.has(name)) { if (wanted()) setEnvMap(ENV_CACHE.get(name)); return true; }
  if (!THREE.EXRLoader || GPUX.lean.hdri) return false; // GPUX.lean.hdri : adaptation apprise (01a-gpu.js), le ciel procédural suffit
  try {
    const b64 = await fetchTexPack('hdri_' + name);
    if (!b64) return false;
    const bin = atob(b64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const loader = new THREE.EXRLoader(); loader.setDataType(THREE.HalfFloatType);
    const d = loader.parse(buf.buffer);
    // arrivée en pleine partie : la conversion (rendus sur le GPU) et le changement d'éclairage (recompilations possibles) attendent une pause ou la fin de la partie
    while (HDRI_BUSY.includes(MATCH.state)) await new Promise((r) => setTimeout(r, 1000));
    if (ENV_CACHE.has(name)) { if (wanted()) setEnvMap(ENV_CACHE.get(name)); return true; }
    const tex = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
    tex.encoding = THREE.LinearEncoding; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.flipY = false;
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.needsUpdate = true;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    ENV_CACHE.set(name, env);
    if (wanted()) setEnvMap(env);
    return true;
  } catch (e) { console.warn('HDRI indisponible, éclairage procédural conservé', e); return false; }
}

/* Cascades rendues une à une : three.js teste les calques des objets avec ceux de la caméra principale ; pour la
   cascade lointaine, on retire temporairement LAYER_NEAR de la caméra (les petits objets n'y projettent rien). */
const SHADOW_FAR = { light: null, lights: [] };
{
  const sm = renderer.shadowMap, render = sm.render.bind(sm);
  sm.render = function (lights, sc, cam) {
    // cascades sans petits objets : la lointaine ; en qualité Basse et Minimale, toutes sauf la plus proche
    const far = csm ? (RQ.q.lean ? csm.lights.slice(1) : [SHADOW_FAR.light]) : [];
    const farL = lights.filter((l) => far.includes(l));
    if (!farL.length || farL.length === lights.length) { render(lights, sc, cam); return; }
    const mask = cam.layers.mask, need = sm.needsUpdate;
    try {
      render(lights.filter((l) => !far.includes(l)), sc, cam);
      sm.needsUpdate = need; cam.layers.disable(LAYER_NEAR);
      render(farL, sc, cam);
    } finally { cam.layers.mask = mask; }
  };
}
/* Ombres recalculées une seule fois par image (le SSAO rend la scène plusieurs fois) */
renderer.shadowMap.autoUpdate = false;
const _sunP = new V3();
function updatePostFx() {
  renderer.shadowMap.needsUpdate = true;
  if (ssaoPass && ssaoPass.enabled) {
    const u = ssaoPass.ssaoMaterial.uniforms;
    u.cameraProjectionMatrix.value.copy(camera.projectionMatrix); u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
    ssaoPass.depthRenderMaterial && (ssaoPass.depthRenderMaterial.uniforms.cameraNear.value = camera.near);
    ssaoPass.blurMaterial.uniforms.resolution && ssaoPass.blurMaterial.uniforms.resolution.value.set(RS.w, RS.h); // part rendue (RS)
  }
  // position du soleil à l'écran pour les rayons et les reflets d'optique
  camera.updateMatrixWorld();
  _sunP.copy(camera.position).addScaledVector(SUN_DIR, 400).project(camera);
  const f = camera.getWorldDirection(_v1).dot(SUN_DIR);
  const U = FinalShader.uniforms, sx = _sunP.x * 0.5 + 0.5, sy = _sunP.y * 0.5 + 0.5;
  U.uSun.value.set(sx, sy);
  const off = Math.max(0, Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) - 0.5);
  U.uSunOn.value = f > 0 ? smoothstep(0.0, 0.25, f) * (1 - smoothstep(0.0, 0.35, off)) : 0;
}
