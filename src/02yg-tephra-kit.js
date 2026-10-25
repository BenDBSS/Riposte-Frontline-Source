/* ==========================================================================
   KIT VOLCANIQUE : surfaces, matières, atlas et objets de Tephra, la station de recherche au pied du volcan.
   - Surfaces procédurales (facultatives, générées seulement pour une carte qui les demande, voir OPT_TEX) : cendre et
     scories (le sol), basalte (blocs de lave, coulées, enrochements), mousse laineuse des champs de lave, panneaux
     composites des façades de la station (teintés par les sommets), gaine d'aluminium des conduites de vapeur ;
   - Atlas dessinés : enseignes de la station, panneaux de danger, décalques (marquages, numéros de puits, héliport) ;
   - Objets : conduites et leurs supports, têtes de puits et silencieux, séparateurs, turbines, aéroréfrigérants,
     instruments (sismomètre, station GPS, mât météo), radôme, hélicoptère de la station, derrick, mât de télécommunication.
   Le plan de la carte est dans 02yh-tephra.js. Tout se construit au chargement et se libère avec la carte.
   ========================================================================== */
Object.assign(TEXLAB, {
  /* cendre et scories : grains noirs, lapilli rougeâtres, quelques pierres ponces claires, rides laissées par le vent */
  ash: [1024, 401, 1.6, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(18.0), 4, 2.0), gr = vn(uv * 320.0, vec2(320.0), 3.0);
    float rp = sin((uv.y * 14.0 + uv.x * 3.0 + big * 2.5) * 6.2831853) * 0.5 + 0.5; rp *= smoothstep(0.5, 0.8, gfbm(uv + 0.37, vec2(2.0), 3, 4.0));
    vec4 v = vor(uv, vec2(44.0), 5.0, 1.0); float peb = (1.0 - smoothstep(0.1, 0.26, v.x)) * step(0.62, v.z);
    vec4 w = vor(uv, vec2(130.0), 7.0, 1.0); float grit = (1.0 - smoothstep(0.12, 0.34, w.x)) * step(0.35, w.z);
    h = big * 0.22 + mid * 0.14 + gr * 0.1 + rp * 0.12 + peb * 0.42 + grit * 0.12;
    vec3 c0 = srgb(vec3(0.14, 0.135, 0.13)), c1 = srgb(vec3(0.25, 0.235, 0.22));
    a = mix(c0, c1, smoothstep(0.3, 0.75, big)) * (0.84 + mid * 0.24 + gr * 0.16 + rp * 0.06);
    vec3 pc = v.z > 0.9 ? srgb(vec3(0.56, 0.53, 0.5)) : mix(srgb(vec3(0.3, 0.15, 0.1)), srgb(vec3(0.2, 0.18, 0.17)), step(0.78, v.z));
    a = mix(a, pc * (0.75 + v.y * 0.4), peb * 0.75);
    a = mix(a, a * 1.25, grit * 0.3);
    r = 0.95 - peb * 0.08; x = h;`],
  /* basalte : lave refroidie, vacuoles, fissures, voile d'oxydation rouille, éclats vitreux */
  basalt: [1024, 403, 2.4, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(10.0), 5, 2.0), fine = gfbm(uv, vec2(40.0), 3, 3.0);
    vec4 c = vor(uv, vec2(6.0), 4.0, 1.0); float crack = (1.0 - smoothstep(0.0, 0.03, c.w)) * smoothstep(0.3, 0.6, gfbm(uv, vec2(4.0), 3, 9.0));
    vec4 vs = vor(uv, vec2(90.0), 6.0, 1.0); float hole = (1.0 - smoothstep(0.05, 0.17, vs.x)) * step(0.45, vs.z);
    float ox = smoothstep(0.6, 0.8, gfbm(uv, vec2(5.0), 4, 7.0));
    h = big * 0.3 + mid * 0.32 + fine * 0.16 + c.z * 0.12 - crack * 0.4 - hole * 0.28;
    vec3 base = mix(srgb(vec3(0.12, 0.115, 0.115)), srgb(vec3(0.3, 0.28, 0.27)), smoothstep(0.2, 0.85, mid + c.z * 0.25 - 0.1));
    a = base * (0.84 + fine * 0.32);
    a = mix(a, srgb(vec3(0.38, 0.2, 0.12)), ox * 0.42);
    a *= 1.0 - crack * 0.55 - hole * 0.45;
    r = 0.9 - hole * 0.06 - fine * 0.05; x = h;`],
  /* mousse laineuse des champs de lave : coussins gris-vert, cœurs plus sombres, interstices noirs */
  moss: [512, 405, 2.2, `
    vec4 c = vor(uv, vec2(10.0), 8.0, 1.0); float dome = 1.0 - smoothstep(0.08, 0.55, c.x);
    vec4 c2 = vor(uv, vec2(26.0), 9.0, 1.0); float tuft = 1.0 - smoothstep(0.05, 0.5, c2.x);
    float fib = vn(uv * 420.0, vec2(420.0), 2.0), big = gfbm(uv, vec2(3.0), 4, 1.0);
    h = dome * 0.5 + tuft * 0.25 + fib * 0.12 + big * 0.15;
    vec3 g0 = srgb(vec3(0.27, 0.31, 0.23)), g1 = srgb(vec3(0.47, 0.5, 0.4)), g2 = srgb(vec3(0.4, 0.38, 0.27));
    a = mix(g0, g1, smoothstep(0.25, 0.8, big + c.z * 0.35 - 0.1));
    a = mix(a, g2, smoothstep(0.6, 0.9, c2.z) * 0.4);
    a *= 0.78 + fib * 0.36 + tuft * 0.12;
    a = mix(srgb(vec3(0.09, 0.09, 0.08)), a, smoothstep(0.02, 0.32, dome + tuft * 0.4));
    r = 0.97; x = h;`],
  /* panneaux composites de façade (teintés par les sommets) : calepinage de 1,2 x 0,6 m, joints creux, voile de poussière en pied */
  panel: [512, 407, 1.2, `
    vec4 t = tiles(uv, vec2(2.0, 4.0), 0.0);
    float joint = 1.0 - smoothstep(0.006, 0.02, t.w), big = gfbm(uv, vec2(3.0), 4, 1.0), mid = gfbm(uv, vec2(12.0), 3, 2.0);
    float streak = smoothstep(0.55, 0.9, gfbm(vec2(uv.x, uv.y * 0.2), vec2(32.0, 1.0), 4, 5.0)) * (1.0 - t.y) * 0.5;
    h = (1.0 - joint) * 0.5 + mid * 0.04;
    a = vec3(0.86) * (0.95 + (t.z - 0.5) * 0.06 + big * 0.05) * (1.0 - streak * 0.18);
    a *= 1.0 - joint * 0.6;
    r = 0.5 + mid * 0.1 + streak * 0.3 + joint * 0.4; x = (1.0 - joint) * 0.35;`],
  /* gaine d'aluminium des conduites : tôle lisse, joints de recouvrement tous les 0,9 m, bosses, coulures */
  jacket: [512, 409, 1.0, `
    float seam = 1.0 - smoothstep(0.0, 0.012, abs(fract(uv.y * 2.0) - 0.04));
    float lap = smoothstep(0.0, 0.03, fract(uv.y * 2.0)) * (1.0 - smoothstep(0.03, 0.06, fract(uv.y * 2.0)));
    float big = gfbm(uv, vec2(3.0), 4, 1.0), dent = gfbm(uv, vec2(9.0), 3, 2.0), br = vn(vec2(uv.x * 320.0, uv.y * 4.0), vec2(320.0, 4.0), 3.0);
    float st = smoothstep(0.62, 0.86, gfbm(vec2(uv.x, uv.y * 0.3), vec2(24.0, 1.0), 4, 6.0));
    h = dent * 0.25 + lap * 0.35 - seam * 0.3 + br * 0.05;
    a = srgb(vec3(0.74, 0.75, 0.75)) * (0.88 + big * 0.12 + br * 0.08) * (1.0 - st * 0.2);
    a = mix(a, srgb(vec3(0.5, 0.42, 0.33)), st * 0.25);
    r = 0.32 + big * 0.12 + st * 0.3 + seam * 0.2; x = 0.95 - st * 0.4;`],
  /* sol des laboratoires et des salles : dalles de vinyle de 60 cm, mouchetures, joints fins, traces de passage */
  vinyl: [512, 411, 0.6, `
    vec4 t = tiles(uv, vec2(4.0), 0.0);
    float joint = 1.0 - smoothstep(0.004, 0.012, t.w), big = gfbm(uv, vec2(3.0), 4, 1.0);
    float sp1 = smoothstep(0.8, 0.88, vn(uv * 420.0, vec2(420.0), 2.0)), sp2 = smoothstep(0.82, 0.9, vn(uv * 300.0 + 3.7, vec2(300.0), 5.0));
    float scuff = smoothstep(0.62, 0.85, gfbm(vec2(uv.x * 2.0, uv.y * 0.6), vec2(8.0, 2.0), 4, 6.0)) * 0.5;
    h = (1.0 - joint) * 0.4 + big * 0.05;
    a = srgb(vec3(0.74, 0.75, 0.74)) * (0.96 + (t.z - 0.5) * 0.06 + big * 0.05) * (1.0 - sp1 * 0.35) + sp2 * 0.05;
    a *= 1.0 - joint * 0.3 - scuff * 0.12;
    r = 0.42 + scuff * 0.25 + big * 0.08 + joint * 0.3; x = h;`],
  /* lave en mouvement : plaques de croûte sombre, fentes et chenaux incandescents (la matière l'éclaire d'elle-même, voir lavaTp) */
  lava: [512, 415, 1.4, `
    vec2 wu = uv + vec2(gfbm(uv, vec2(4.0), 3, 7.0), gfbm(uv + 0.5, vec2(4.0), 3, 8.0)) * 0.12;
    vec4 c = vor(wu, vec2(5.0), 3.0, 1.0), c2 = vor(wu + 0.31, vec2(11.0), 5.0, 1.0);
    float crack = 1.0 - smoothstep(0.0, 0.11, c.w), crack2 = (1.0 - smoothstep(0.0, 0.05, c2.w)) * 0.45 * step(0.4, c.z);
    float big = gfbm(uv, vec2(3.0), 4, 1.0), fine = gfbm(uv, vec2(24.0), 3, 2.0);
    float hot = clamp(max(crack, crack2) * (0.5 + 0.7 * big) + smoothstep(0.55, 0.85, big) * 0.85, 0.0, 1.0);
    h = (1.0 - crack) * 0.6 + fine * 0.2;
    a = mix(srgb(vec3(0.07, 0.055, 0.05)) * (0.6 + fine * 0.8), mix(srgb(vec3(0.85, 0.16, 0.02)), srgb(vec3(1.0, 0.72, 0.24)), hot * hot), hot);
    r = 0.8; x = h;`],
  /* faux plafond : dalles minérales de 60 cm (piqûres, fissures fines), ossature en T laquée blanche */
  ceiltile: [512, 413, 0.8, `
    vec4 t = tiles(uv, vec2(4.0), 0.0);
    float bar = 1.0 - smoothstep(0.012, 0.02, t.w), big = gfbm(uv, vec2(2.0), 3, 1.0);
    float pits = smoothstep(0.72, 0.86, vn(uv * 520.0, vec2(520.0), 4.0)), fis = smoothstep(0.93, 0.99, ridge(uv, vec2(40.0), 3, 6.0)) * 0.6;
    h = (1.0 - bar) * 0.5 - pits * 0.15 - fis * 0.1;
    a = srgb(vec3(0.86, 0.86, 0.84)) * (0.95 + (t.z - 0.5) * 0.05 + big * 0.04) * (1.0 - pits * 0.25 - fis * 0.2);
    a = mix(a, srgb(vec3(0.93, 0.93, 0.91)), bar);
    r = mix(0.95, 0.4, bar); x = h;`],
});
Object.assign(TEXSCALE, { ash: 2.6, basalt: 3.0, moss: 2.4, panel: 2.4, jacket: 1.8, vinyl: 2.4, ceiltile: 2.4, lava: 4.0 });
for (const k of ['ash', 'basalt', 'moss', 'panel', 'jacket', 'vinyl', 'ceiltile', 'lava']) OPT_TEX.add(k);
/* Surfaces que Tephra demande (surfaces de sa définition) : les nôtres, caillebotis (passerelles), rouille, rides de l'eau (bassin de rejet) */
const TEPHRA_SURFACES = ['ash', 'basalt', 'moss', 'panel', 'jacket', 'vinyl', 'ceiltile', 'lava', 'grating', 'rust', 'ripple'];

/* Couleurs de la station. Les deux moitiés se distinguent (on sait de quel côté on est) : orange au sud (Alpha), bleu canard au nord (Bravo) */
const TP = {
  white: [0.9, 0.9, 0.87], grey: [0.62, 0.63, 0.62], dark: [0.24, 0.25, 0.26], concrete: [0.72, 0.71, 0.68],
  accent: [[0.93, 0.42, 0.1], [0.08, 0.46, 0.5]], // orange (Alpha, sud), bleu canard (Bravo, nord)
  steel: [0.42, 0.44, 0.45], yellow: [0.92, 0.72, 0.12], red: [0.72, 0.12, 0.08],
};
const tpAccent = (z) => TP.accent[z >= 0 ? 0 : 1];

/* ---------- Matières ---------- */
function makeTephraMaterials(M) {
  M('ash', { tex: 'ash', macro: 0.4, dust: 0.1 });
  M('basalt', { tex: 'basalt', grime: 0.2, macro: 0.45, dust: 0.15, pom: 0.03 });
  M('moss', { tex: 'moss', macro: 0.4 });
  M('panel', { tex: 'panel', metal: 0.25, ma: true, env: 0.7, grime: 0.5, streak: 0.5, dust: 0.3, macro: 0.2 });
  M('jacket', { tex: 'jacket', metal: 0.85, ma: true, env: 1.0, grime: 0.4, streak: 0.4, dust: 0.25, macro: 0.2 });
  M('grating', { tex: 'grating', cut: 0.5, metal: 0.7, ma: true, env: 0.6, macro: 0.1, dust: 0.3 });
  M('rust', { tex: 'rust', metal: 0.75, ma: true, env: 0.55, macro: 0.25, grime: 0.6, streak: 0.4 });
  // croûte de soufre autour des fumerolles : jaune pâle, poudreuse
  M('sulfur', { tex: 'ash', color: [1.0, 0.86, 0.36], macro: 0.3 });
  // vitres éclairées de l'intérieur (salle de contrôle, observatoire) et voyants
  M('glassLit', { tex: 'glass', metal: 0.4, ma: true, env: 0.9, macro: 0.1, emissive: [0.55, 0.62, 0.66], polyOff: -2 });
  M('lampTp', { color: [1, 1, 1], rough: 0.6, emissive: [1.6, 1.5, 1.3], macro: 0, noShadow: true });
  // sols et plafonds des salles : vinyle ; faux plafond et plafond de béton des locaux techniques, éclairés par leurs luminaires (sans eux,
  // une face tournée vers le bas, loin des fenêtres, ne reçoit presque rien et reste noire)
  M('vinyl', { tex: 'vinyl', env: 0.7, macro: 0.12, dust: 0.2 });
  M('ceil', { tex: 'ceiltile', macro: 0.08, emissive: [0.075, 0.075, 0.072], noShadow: true });
  M('ceilc', { tex: 'concrete', color: [0.82, 0.82, 0.8], macro: 0.15, emissive: [0.05, 0.05, 0.048], noShadow: true });
  // enseignes et décalques de la station (tephraKit) ; écrans allumés : le contenu de l'atlas des enseignes, sans éclairage (lumineux par
  // eux-mêmes), voilés par le brouillard comme le reste
  M('signs5', { tex: 'signs5', rough: 0.45, env: 0.6, macro: 0.05, scale: 1, noNormal: true });
  M('decals5', { tex: 'decals5', rough: 0.75, env: 0.35, macro: 0.15, scale: 1, noNormal: true, polyOff: -4 });
  Object.assign(MAT.decals5, { transparent: true, depthWrite: false }); MAT.decals5.defines.WM_CUT = ''; MAT.decals5.side = THREE.FrontSide;
  MAT.decals5.userData.noShadow = true;
  MAT.screenTp = new THREE.MeshBasicMaterial({ map: TEX.signs5.map, vertexColors: true }); MAT.screenTp.userData.noShadow = true;
  // coulées de lave : lumineuses par elles-mêmes (au-delà de 1 : le halo les fait rayonner), la texture glisse dans le sens de la pente
  MAT.lavaTp = new THREE.MeshBasicMaterial({ map: TEX.lava.map, color: new THREE.Color(3.4, 3.4, 3.4), vertexColors: true }); MAT.lavaTp.userData.noShadow = true;
}

/* ---------- Objets ---------- */
/* Hélicoptère de la station (monoturbine léger), posé, nez vers -z : fuselage blanc, poutre de queue et dérive à la couleur du camp (paint),
   verrière, patins, rotor arrêté. Sans collision propre (tpHeli, 02yh, pose celle du fuselage et de la poutre). */
PF.tpHeli = () => prefab('tpHeli', (M, P) => {
  P.tintable = ['paint'];
  const body = (prof, mat) => { M.save().move(0, 1.5, -2.4).scl(1, 1.1, 1).rotX(Math.PI / 2); M.lathe(mat, prof, 20); M.restore(); };
  M.local(1);
  M.color([0.94, 0.94, 0.92]); body([[1.02, 1.3], [1.05, 2.0], [1.0, 3.0], [0.82, 3.9], [0.48, 4.6], [0, 4.64]], 'carpaint');
  M.color([0.55, 0.62, 0.68]); body([[0, -0.02], [0.55, 0.14], [0.86, 0.5], [1.0, 1.0], [1.02, 1.3]], 'glass');
  // capot moteur, mât, moyeu
  M.color([0.9, 0.9, 0.88]); M.boxB('carpaint', -0.55, 0.55, 2.45, 2.9, -0.6, 1.6, { bevel: 0.12 });
  M.color([0.25, 0.26, 0.27]); M.save().move(0, 2.9, 0.1); M.cyl('steel', 0.09, 0.32, 8); M.restore();
  M.save().move(0, 3.22, 0.1); M.cyl('steel', 0.2, 0.12, 10); M.restore();
  // pales arrêtées (trois), légèrement fléchies
  for (let i = 0; i < 3; i++) { M.save().move(0, 3.27, 0.1).rotY(0.4 + i * TAU / 3).rotZ(-0.02); M.boxB('steel', 0.15, 5.3, -0.02, 0.02, -0.16, 0.16); M.restore(); }
  // poutre de queue, stabilisateur, dérive et rotor de queue
  M.color([1, 1, 1]); M.save().move(0, 1.75, 1.9).rotX(Math.PI / 2); M.cyl('paint', 0.3, 4.6, 12, { r1: 0.16 }); M.restore();
  M.boxB('paint', -0.95, 0.95, 1.7, 1.78, 5.2, 5.65, { bevel: 0.02 });
  M.save().move(0, 1.6, 6.15).rotX(-0.35); M.boxB('paint', -0.05, 0.05, 0, 1.45, -0.32, 0.32, { bevel: 0.02 }); M.restore();
  M.color([0.25, 0.26, 0.27]); for (const a of [0.3, 0.3 + Math.PI / 2]) { M.save().move(0.17, 2.35, 6.35).rotX(a); M.boxB('steel', -0.02, 0.02, -0.65, 0.65, -0.06, 0.06); M.restore(); }
  // patins et jambes de train
  M.color([0.3, 0.31, 0.32]);
  for (const sx of [-1, 1]) {
    M.tube('steel', 0.045, [[sx * 0.98, 0.07, -2.0], [sx * 0.98, 0.07, 1.8], [sx * 0.98, 0.14, 2.05]], 6);
    M.tube('steel', 0.045, [[sx * 0.98, 0.07, -2.0], [sx * 0.98, 0.2, -2.25]], 6);
    for (const z of [-1.1, 0.9]) M.tube('steel', 0.05, [[sx * 0.98, 0.07, z], [sx * 0.7, 0.5, z], [sx * 0.5, 0.75, z]], 6);
  }
  // marchepieds, feu anticollision
  M.color([0.25, 0.26, 0.27]); for (const sx of [-1, 1]) M.boxB('steel', sx * 1.0 - 0.12, sx * 1.0 + 0.12, 0.5, 0.54, -0.6, 0.2);
  M.color([0.9, 0.1, 0.05]); M.save().move(0, 2.92, 1.7); M.cyl('plastic', 0.06, 0.08, 8); M.restore();
});

/* ---------- Atlas de Tephra (appelé par buildTextures) ---------- */
function tephraKit() { TEX.signs5 = tpSignAtlas(); TEX.decals5 = tpDecalAtlas(); }
/* Enseignes (1024², 8 panneaux de 512 x 256), en islandais et en anglais comme sur les sites de là-bas : 0 nom de la station, 1 laboratoire,
   2 salle de contrôle, 3 carothèque, 4 station de pompage, 5 danger vapeur ; 6 et 7, contenus des écrans : sismogrammes, carte de surveillance */
const TPS = { station: 0, lab: 1, control: 2, cores: 3, pump: 4, steam: 5, seismo: 6, map: 7 };
function tpSignUV(i, sub = [0, 0, 1, 1]) { return [(i % 2) * 0.5 + sub[0] * 0.5, Math.floor(i / 2) * 0.25 + sub[1] * 0.25, sub[2] * 0.5, sub[3] * 0.25]; }
function tpSignAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), R = rngOf(419);
  const sans = '"Liberation Sans", Arial, "DejaVu Sans", sans-serif';
  const fit = (txt, size, w, bold = 'bold ') => { g.font = `${bold}${size}px ${sans}`; return Math.min(size, (size * w) / g.measureText(txt).width); };
  const grime = (x, y) => {
    for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '40,38,36'},${R() * 0.06})`; g.fillRect(x + R() * 512, y + R() * 256, 1 + R() * 3, 1 + R() * 3); }
    const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(40,38,36,0.2)'); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
  };
  const board = (i, bg, fg, l1, l2, band) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
    g.fillStyle = bg; g.fillRect(x, y, 512, 256);
    if (band) { g.fillStyle = band; g.fillRect(x, y + 214, 512, 42); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = fit(l1, 76, 440); g.font = `bold ${fs}px ${sans}`; g.fillText(l1, x + 256, y + 92);
    fs = fit(l2, 34, 440, ''); g.font = `${fs}px ${sans}`; g.fillText(l2, x + 256, y + 160);
    grime(x, y);
  };
  // 0 : nom de la station et son logo (un cône qui fume)
  g.fillStyle = '#1f2a33'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#e8622a'; g.beginPath(); g.moveTo(34, 196); g.lineTo(92, 92); g.lineTo(110, 92); g.lineTo(168, 196); g.closePath(); g.fill();
  g.strokeStyle = '#d9dde0'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(101, 82); g.bezierCurveTo(95, 60, 124, 50, 118, 26); g.stroke();
  g.fillStyle = '#f2f2ee'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `bold ${fit('TEPHRA', 88, 300)}px ${sans}`; g.fillText('TEPHRA', 188, 100);
  g.fillStyle = '#c9ced2'; g.font = `${fit('VOLCANO OBSERVATORY', 28, 300, '')}px ${sans}`; g.fillText('ELDFJALLASTÖÐ', 192, 162); g.fillText('VOLCANO OBSERVATORY', 192, 198);
  grime(0, 0);
  board(1, '#f2f2ee', '#1f2a33', 'RANNSÓKNARSTOFA', 'LABORATORY  ·  GEOCHEMISTRY', '#e8622a');
  board(2, '#f2f2ee', '#1f2a33', 'STJÓRNSTÖÐ', 'CONTROL ROOM  ·  GEOTHERMAL PLANT', '#16767c');
  board(3, '#f2f2ee', '#1f2a33', 'BORKJARNASAFN', 'CORE STORE', '#8a8f93');
  board(4, '#2f3a42', '#f2f2ee', 'DÆLUSTÖÐ 2', 'PUMP STATION 2  ·  REINJECTION', null);
  // 5 : danger, vapeur sous pression (jaune et noir)
  { const x = 512, y = 512; g.fillStyle = '#151515'; g.fillRect(x, y, 512, 256); g.fillStyle = '#f2c31b'; g.fillRect(x + 12, y + 12, 488, 232);
    g.fillStyle = '#151515'; g.beginPath(); g.moveTo(x + 90, y + 48); g.lineTo(x + 152, y + 160); g.lineTo(x + 28, y + 160); g.closePath(); g.fill();
    g.fillStyle = '#f2c31b'; g.font = `bold 70px ${sans}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', x + 90, y + 122);
    g.fillStyle = '#151515'; g.textAlign = 'left'; g.font = `bold ${fit('HÆTTA · DANGER', 54, 310)}px ${sans}`; g.fillText('HÆTTA · DANGER', x + 174, y + 80);
    g.font = `bold ${fit('HÁÞRÝSTIGUFA', 40, 310)}px ${sans}`; g.fillText('HÁÞRÝSTIGUFA', x + 174, y + 136);
    g.font = `${fit('HIGH PRESSURE STEAM', 28, 310, '')}px ${sans}`; g.fillText('HIGH PRESSURE STEAM', x + 174, y + 176);
    g.textAlign = 'center'; g.font = `bold 22px ${sans}`; g.fillText('EKKI SNERTA  ·  DO NOT TOUCH', x + 256, y + 220); grime(x, y); }
  // 6 : écran de sismogrammes (enregistreur numérique, 24 heures) : traces horizontales, quelques séismes
  { const x = 0, y = 768; g.fillStyle = '#0c1216'; g.fillRect(x, y, 512, 256);
    g.fillStyle = '#7fe0c0'; g.font = `bold 13px ${sans}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('TPH.HHZ  ·  SKJÁLFTAVIRKNI  ·  24 KLST', x + 10, y + 7);
    g.strokeStyle = 'rgba(127,224,192,0.16)'; g.lineWidth = 1; for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(x + 12 + k * 61, y + 28); g.lineTo(x + 12 + k * 61, y + 250); g.stroke(); }
    for (let r = 0; r < 14; r++) {
      const yy = y + 36 + r * 15.4, q = R() < 0.4 ? 40 + R() * 400 : -1; g.strokeStyle = r % 4 === 3 ? '#e8622a' : r % 2 ? '#8fd3ff' : '#c8f0de'; g.lineWidth = 1.3; g.beginPath();
      for (let k = 0; k <= 488; k += 2) { let a = (R() - 0.5) * 2.4; if (q > 0 && k > q && k < q + 60) a *= 1 + 10 * Math.exp(-(k - q) / 13); g.lineTo(x + 12 + k, yy + a); }
      g.stroke();
    } }
  // 7 : carte de surveillance : courbes de niveau du volcan, stations (triangles), séismes récents, panache
  { const x = 512, y = 768, cx = x + 210, cy = y + 134; g.fillStyle = '#10181d'; g.fillRect(x, y, 512, 256);
    for (let k = 1; k <= 9; k++) { g.strokeStyle = `rgba(160,200,190,${0.16 + k * 0.045})`; g.lineWidth = 1.3; g.beginPath(); for (let a = 0; a <= 64; a++) { const t = (a / 64) * TAU, rr = k * 11 * (1 + 0.12 * Math.sin(t * 3 + k) + 0.06 * Math.sin(t * 7)); g.lineTo(cx + Math.cos(t) * rr * 1.3, cy + Math.sin(t) * rr); } g.closePath(); g.stroke(); }
    g.fillStyle = 'rgba(232,98,42,0.25)'; g.beginPath(); g.ellipse(cx + 74, cy - 34, 84, 26, -0.4, 0, TAU); g.fill();
    for (let k = 0; k < 26; k++) { const a = R() * TAU, rr = R() * 58; g.fillStyle = k < 6 ? '#e8622a' : '#f2c31b'; g.beginPath(); g.arc(cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr, 2 + R() * 4, 0, TAU); g.fill(); }
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + 0.3, rr = 92 + R() * 18, px = cx + Math.cos(a) * rr * 1.3, py = cy + Math.sin(a) * rr; g.fillStyle = '#8fd3ff'; g.beginPath(); g.moveTo(px, py - 7); g.lineTo(px + 6, py + 5); g.lineTo(px - 6, py + 5); g.closePath(); g.fill(); }
    g.fillStyle = '#c8f0de'; g.font = `bold 14px ${sans}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('TEPHRA  ·  VÖKTUN / MONITORING', x + 10, y + 8);
    g.font = `13px ${sans}`; ['GPS  +4.2 mm/d', 'SO2  2140 t/d', 'H2S  38 ppm', 'ÓRÓI / TREMOR  ▲'].forEach((l, k) => g.fillText(l, x + 382, y + 62 + k * 26)); }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Décalques (1024², grille 4 x 4, alpha) : 0 bandes de danger, 1 H de l'héliport, 2 et 3 numéros de puits au pochoir, 4 surface chaude, 5 gaz H2S,
   6 sismogramme imprimé, 7 carte géologique, 8 coulures grises, 9 coulures de rouille, 10 croûte de soufre (sol), 11 flèche du cheminement (sol),
   12 accès interdit, 13 extincteur, 14 sortie de secours, 15 cendre soufflée au pied d'un mur */
const TPD = { stripes: 0, heli: 1, well7: 2, well12: 3, hot: 4, h2s: 5, seismo: 6, geomap: 7, drip: 8, rust: 9, sulfur: 10, arrow: 11, noentry: 12, extinct: 13, exit: 14, ash: 15 };
function tpDecalAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(421), T = S / 4;
  const sans = '"Liberation Sans", Arial, "DejaVu Sans", sans-serif';
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  const wear = (n, a) => { g.globalCompositeOperation = 'destination-out'; for (let j = 0; j < n; j++) { g.fillStyle = `rgba(0,0,0,${R() * a})`; g.fillRect(R() * T, R() * T, 2 + R() * 4, 1 + R() * 3); } g.globalCompositeOperation = 'source-over'; };
  const txt = (s, x, y, size, w, bold = 'bold ') => { g.font = `${bold}${size}px ${sans}`; const fs = Math.min(size, (size * w) / g.measureText(s).width); g.font = `${bold}${fs}px ${sans}`; g.fillText(s, x, y); };
  cell(0, () => { g.fillStyle = '#f2c31b'; g.fillRect(0, 0, T, T); g.fillStyle = '#161616'; for (let k = -5; k < 9; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 32, 0); g.lineTo(k * 64 + 32 + T, T); g.lineTo(k * 64 + T, T); g.closePath(); g.fill(); } wear(500, 0.7); });
  cell(1, () => { g.strokeStyle = 'rgba(242,242,236,0.95)'; g.lineWidth = 14; g.beginPath(); g.arc(T / 2, T / 2, T / 2 - 14, 0, TAU); g.stroke(); g.fillStyle = 'rgba(242,242,236,0.95)'; g.fillRect(T / 2 - 58, T / 2 - 70, 26, 140); g.fillRect(T / 2 + 32, T / 2 - 70, 26, 140); g.fillRect(T / 2 - 32, T / 2 - 13, 64, 26); wear(700, 0.8); });
  for (const [i, n] of [[2, 'TP-07'], [3, 'TP-12']]) cell(i, () => { g.fillStyle = 'rgba(25,25,25,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle'; txt(n, T / 2, T / 2 - 8, 70, T - 24); txt('BORHOLA · WELL', T / 2, T / 2 + 50, 20, T - 40); wear(300, 0.8); });
  cell(4, () => { // surface chaude : triangle jaune, ondes de chaleur
    g.fillStyle = '#f2c31b'; g.strokeStyle = '#151515'; g.lineWidth = 12; g.lineJoin = 'round'; g.beginPath(); g.moveTo(T / 2, 26); g.lineTo(T - 26, T - 46); g.lineTo(26, T - 46); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 7; for (let k = -1; k <= 1; k++) { g.beginPath(); for (let j = 0; j <= 20; j++) g.lineTo(T / 2 + k * 26 + Math.sin(j * 0.7) * 7, 108 + j * 4.5); g.stroke(); }
    g.fillStyle = '#151515'; g.fillRect(70, 198, T - 140, 9); });
  cell(5, () => { // H2S : panneau jaune
    g.fillStyle = '#f2c31b'; g.fillRect(20, 30, T - 40, T - 60); g.strokeStyle = '#151515'; g.lineWidth = 8; g.strokeRect(28, 38, T - 56, T - 76);
    g.fillStyle = '#151515'; g.textAlign = 'center'; g.textBaseline = 'middle'; txt('H2S', T / 2, 96, 66, T - 80); txt('BRENNISTEINSVETNI', T / 2, 150, 20, T - 76); txt('TOXIC GAS  ·  GASGRÍMA', T / 2, 182, 16, T - 76, ''); wear(120, 0.5); });
  cell(6, () => { // sismogramme imprimé, punaisé au mur
    g.fillStyle = '#f4f3ee'; g.fillRect(18, 22, T - 36, T - 44); g.strokeStyle = '#1b2a3a'; g.lineWidth = 1.4;
    for (let r = 0; r < 9; r++) { const yy = 50 + r * 21, q = R() < 0.4 ? 30 + R() * 150 : -1; g.beginPath(); for (let k = 0; k <= 196; k += 2) { let a = (R() - 0.5) * 2.4; if (q > 0 && k > q && k < q + 40) a *= 1 + 8 * Math.exp(-(k - q) / 10); g.lineTo(30 + k, yy + a); } g.stroke(); }
    g.fillStyle = '#c0392b'; for (const px of [30, T - 30]) { g.beginPath(); g.arc(px, 32, 5, 0, TAU); g.fill(); } wear(60, 0.3); });
  cell(7, () => { // carte géologique : coulées colorées, courbes de niveau
    g.fillStyle = '#efeae0'; g.fillRect(18, 18, T - 36, T - 36); const cols = ['#c86b4a', '#9c5a7a', '#d9a441', '#6f8f5f', '#7a7a86'];
    for (let k = 0; k < 9; k++) { g.fillStyle = cols[k % 5]; g.globalAlpha = 0.75; g.beginPath(); const cx = 44 + R() * (T - 88), cy = 44 + R() * (T - 100); for (let a = 0; a <= 12; a++) { const t = (a / 12) * TAU, rr = 16 + R() * 26; g.lineTo(cx + Math.cos(t) * rr * 1.5, cy + Math.sin(t) * rr); } g.closePath(); g.fill(); }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(60,50,40,0.5)'; g.lineWidth = 1; for (let k = 1; k < 7; k++) { g.beginPath(); g.ellipse(T / 2, T / 2 - 10, k * 15, k * 11, 0.3, 0, TAU); g.stroke(); }
    g.fillStyle = '#1b2a3a'; g.textAlign = 'center'; g.textBaseline = 'middle'; txt('JARÐFRÆÐIKORT  ·  GEOLOGY', T / 2, T - 32, 15, T - 56); });
  cell(8, () => { for (let j = 0; j < 14; j++) { const x = T * 0.12 + R() * T * 0.76, w = 4 + R() * 12, gr = g.createLinearGradient(0, 0, 0, T * (0.3 + R() * 0.7)); gr.addColorStop(0, 'rgba(90,88,84,0.5)'); gr.addColorStop(1, 'rgba(90,88,84,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, T); } });
  cell(9, () => { const gr = g.createLinearGradient(0, 0, 0, T); gr.addColorStop(0, 'rgba(120,56,28,0.6)'); gr.addColorStop(1, 'rgba(120,56,28,0)'); g.fillStyle = gr; for (let j = 0; j < 10; j++) { const x = T * 0.15 + R() * T * 0.7, w = 3 + R() * 9; g.fillRect(x, 0, w, T * (0.25 + R() * 0.75)); } });
  cell(10, () => { // croûte de soufre autour d'un évent : jaune vif au centre, blanchâtre au bord, irrégulière ; la bouche sombre
    for (let j = 0; j < 280; j++) { const a = R() * TAU, rr = Math.pow(R(), 0.7) * T * 0.46, k = 1 - rr / (T * 0.46);
      g.fillStyle = `rgba(${Math.round(lerp(232, 250, k))},${Math.round(lerp(226, 212, k))},${Math.round(lerp(196, 64, k))},${0.1 + k * 0.32})`; g.beginPath(); g.arc(T / 2 + Math.cos(a) * rr, T / 2 + Math.sin(a) * rr, 4 + R() * 14 * (1 - k * 0.5), 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(40,36,30,0.8)'; g.beginPath(); g.ellipse(T / 2, T / 2, 16, 11, 0.4, 0, TAU); g.fill(); });
  cell(11, () => { g.fillStyle = 'rgba(242,242,236,0.92)'; g.beginPath(); g.moveTo(T / 2, 30); g.lineTo(T - 50, 120); g.lineTo(T / 2 + 30, 120); g.lineTo(T / 2 + 30, T - 30); g.lineTo(T / 2 - 30, T - 30); g.lineTo(T / 2 - 30, 120); g.lineTo(50, 120); g.closePath(); g.fill(); wear(500, 0.8); });
  cell(12, () => { g.fillStyle = '#c62828'; g.beginPath(); g.arc(T / 2, 108, 84, 0, TAU); g.fill(); g.fillStyle = '#f4f4f0'; g.fillRect(T / 2 - 62, 96, 124, 24); g.fillRect(36, 204, T - 72, 40); g.fillStyle = '#151515'; g.textAlign = 'center'; g.textBaseline = 'middle'; txt('BANNAÐ  ·  NO ENTRY', T / 2, 224, 20, T - 90); });
  cell(13, () => { g.fillStyle = '#c62828'; g.fillRect(48, 36, T - 96, T - 72); g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(T / 2 - 8, 132, 26, 58, 0, 0, TAU); g.fill(); g.fillRect(T / 2 - 20, 60, 24, 18); g.fillRect(T / 2 + 4, 64, 30, 8); g.textAlign = 'center'; g.textBaseline = 'middle'; txt('SLÖKKVITÆKI', T / 2, T - 56, 18, T - 110); });
  cell(14, () => { g.fillStyle = '#1e8a4c'; g.fillRect(16, 72, T - 32, T - 144); g.fillStyle = '#f4f4f0'; g.fillRect(T - 92, 88, 56, 80); g.fillStyle = '#1e8a4c'; g.fillRect(T - 84, 96, 40, 64);
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(70, 98, 11, 0, TAU); g.fill(); g.lineWidth = 10; g.strokeStyle = '#f4f4f0'; g.lineCap = 'round'; g.beginPath(); g.moveTo(66, 112); g.lineTo(58, 146); g.lineTo(78, 168); g.moveTo(58, 146); g.lineTo(42, 166); g.moveTo(62, 120); g.lineTo(84, 130); g.moveTo(62, 120); g.lineTo(44, 130); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'middle'; txt('NEYÐARÚTGANGUR', 100, 116, 17, T - 206); txt('EXIT', 100, 146, 22, 80); });
  cell(15, () => { const gr = g.createLinearGradient(0, T, 0, 0); gr.addColorStop(0, 'rgba(46,44,42,0.7)'); gr.addColorStop(0.45, 'rgba(46,44,42,0.35)'); gr.addColorStop(1, 'rgba(46,44,42,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); wear(400, 0.6); });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Quadrilatère d'atlas (enseigne, écran) dans le plan z du repère courant, tourné vers +z ; uv : [u0, v0, du, dv], v vers le bas de l'image */
function tpAtlasQuad(M, mat, x0, x1, y0, y1, z, uv) {
  const [u0, v0, du, dv] = uv, B = M.buf(mat, (x0 + x1) / 2, (y0 + y1) / 2, z);
  const a = M.v(B, x0, y0, z, 0, 0, 1, u0, v0 + dv), b = M.v(B, x1, y0, z, 0, 0, 1, u0 + du, v0 + dv), c = M.v(B, x1, y1, z, 0, 0, 1, u0 + du, v0), d = M.v(B, x0, y1, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d);
}
/* Enseigne de la station posée sur une façade (repère de façade : z = 0, le mur), cadre d'acier */
function tpSignBoard(M, xc, y, w, h, idx) {
  M.save().color([1, 1, 1]); tpAtlasQuad(M, 'signs5', xc - w / 2, xc + w / 2, y, y + h, 0.05, tpSignUV(idx));
  M.color([0.3, 0.32, 0.33]).local(1); M.boxB('steel', xc - w / 2 - 0.03, xc + w / 2 + 0.03, y - 0.03, y + h + 0.03, 0, 0.048); M.restore();
}
/* Décalque de Tephra sur un mur (repère de façade) ou au sol */
function tpWallDecal(M, i, xc, y, w, h, z = 0.008, sub) { decal3Quad(M, i, [xc - w / 2, y, z], [xc + w / 2, y, z], [xc + w / 2, y + h, z], [xc - w / 2, y + h, z], [0, 0, 1], sub, 'decals5'); }
function tpGroundDecal(i, x, z, w, d, rot = 0, y = 0.014) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (a, b) => [x + a * c - b * s, y, z + a * s + b * c];
  decal3Quad(DECOR, i, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), [0, 1, 0], [0, 0, 1, 1], 'decals5');
}

/* ---------- Mobilier et instruments du centre de recherche (repère local : y vers le haut, la face avant vers +z) ---------- */
/* Paillasse centrale de laboratoire (îlot de 2,9 x 1,4 m, double face) : meubles bas des deux côtés, plan de résine noire, étagère à réactifs
   au milieu et ses flacons, un microscope d'un côté, une balance de l'autre */
PF.tpBench = () => prefab('tpBench', (M) => {
  M.local(1);
  M.color([0.25, 0.26, 0.27]); M.boxB('steel', -1.4, 1.4, 0, 0.08, -0.62, 0.62);
  M.color([0.9, 0.9, 0.88]); M.boxB('paint', -1.4, 1.4, 0.08, 0.88, -0.66, 0.66, { bevel: 0.01 });
  M.color([0.62, 0.64, 0.65]); for (let k = -2; k <= 2; k++) for (const z of [-0.665, 0.665]) M.boxB('steel', k * 0.56 - 0.006, k * 0.56 + 0.006, 0.14, 0.84, z - 0.004, z + 0.004);
  M.color([0.11, 0.11, 0.12]); M.boxB('plastic', -1.45, 1.45, 0.88, 0.93, -0.7, 0.7, { bevel: 0.01 });
  M.color([0.62, 0.64, 0.65]); for (const x of [-1.3, 1.3]) M.boxB('steel', x - 0.02, x + 0.02, 0.93, 1.78, -0.05, 0.05);
  for (const y of [1.3, 1.74]) M.boxB('steel', -1.32, 1.32, y, y + 0.025, -0.14, 0.14);
  const R = rngOf(431), cols = [[0.86, 0.55, 0.2], [0.55, 0.72, 0.86], [0.92, 0.92, 0.9], [0.42, 0.3, 0.2], [0.32, 0.56, 0.42]];
  for (const y of [1.325, 1.765]) for (let x = -1.2; x < 1.2; x += 0.13 + R() * 0.1) { if (R() < 0.25) continue; M.color(R.pick(cols)); M.save().move(x, y, R.range(-0.06, 0.06)); M.cyl('glass', 0.03 + R() * 0.025, 0.12 + R() * 0.12, 8); M.restore(); }
  // microscope (socle, potence, tube) côté +z ; balance (boîtier, cage de verre) côté -z ; béchers
  M.color([0.9, 0.9, 0.88]); M.boxB('plastic', -0.95, -0.7, 0.93, 0.97, 0.3, 0.55); M.boxB('plastic', -0.86, -0.79, 0.97, 1.3, 0.3, 0.37);
  M.color([0.15, 0.15, 0.16]); M.save().move(-0.82, 1.22, 0.45).rotX(-0.5); M.cyl('steel', 0.025, 0.2, 8); M.restore();
  M.color([0.88, 0.88, 0.86]); M.boxB('plastic', 0.6, 0.92, 0.93, 1.0, -0.6, -0.28); M.color([0.7, 0.78, 0.82]); M.boxB('glass', 0.62, 0.9, 1.0, 1.2, -0.58, -0.3);
  M.color([0.8, 0.86, 0.9]); for (const [x, z] of [[0.3, 0.45], [0.42, 0.38], [-0.3, -0.45]]) { M.save().move(x, 0.93, z); M.cyl('glass', 0.04, 0.1, 10); M.restore(); }
});
/* Hotte d'aspiration (1,6 m de large) : meuble bas, joues, vitre relevée, éclairage intérieur, gaine d'extraction */
PF.tpHood = () => prefab('tpHood', (M) => {
  M.local(1); M.color([0.88, 0.88, 0.86]);
  M.boxB('paint', -0.8, 0.8, 0, 0.88, -0.45, 0.45); M.boxB('paint', -0.8, -0.72, 0.88, 2.35, -0.45, 0.45); M.boxB('paint', 0.72, 0.8, 0.88, 2.35, -0.45, 0.45);
  M.boxB('paint', -0.8, 0.8, 1.95, 2.35, -0.45, 0.45); M.boxB('paint', -0.72, 0.72, 0.88, 1.95, -0.45, -0.4);
  M.color([0.11, 0.11, 0.12]); M.boxB('plastic', -0.72, 0.72, 0.88, 0.92, -0.4, 0.42);
  M.color([0.7, 0.78, 0.82]); M.boxB('glass', -0.72, 0.72, 1.25, 1.95, 0.38, 0.4);
  M.color([1, 1, 1]); M.boxB('lampTp', -0.6, 0.6, 1.9, 1.93, -0.3, 0.2);
  M.color([0.6, 0.62, 0.63]); M.save().move(0, 2.35, -0.1); M.cyl('steel', 0.16, 0.6, 10); M.restore();
});
/* Pupitre de conduite (len le long de x, 1 m de profondeur) : caisson, plan, rangée d'écrans allumés tournés vers +z */
PF.tpConsole = (len) => prefab('tpConsole' + len, (M) => {
  M.local(1); const n = Math.max(2, Math.round(len / 0.75));
  M.color([0.24, 0.25, 0.27]); M.boxB('paint', -len / 2, len / 2, 0, 0.72, -0.45, 0.35, { bevel: 0.01 });
  M.color([0.62, 0.63, 0.64]); M.boxB('plastic', -len / 2 - 0.03, len / 2 + 0.03, 0.72, 0.76, -0.5, 0.5, { bevel: 0.01 });
  for (let i = 0; i < n; i++) {
    const cx = -len / 2 + (len * (i + 0.5)) / n, w = Math.min(0.66, len / n - 0.06);
    M.color([0.12, 0.12, 0.13]); M.boxB('plastic', cx - 0.04, cx + 0.04, 0.76, 0.98, -0.3, -0.26); M.boxB('plastic', cx - w / 2, cx + w / 2, 0.92, 1.34, -0.34, -0.3);
    M.color([1, 1, 1]); tpAtlasQuad(M, 'screenTp', cx - w / 2 + 0.02, cx + w / 2 - 0.02, 0.94, 1.32, -0.295, tpSignUV(i % 3 === 1 ? TPS.map : TPS.seismo, [(i * 0.37) % 0.5, 0, 0.5, 1]));
    M.color([0.2, 0.2, 0.21]); M.boxB('plastic', cx - 0.22, cx + 0.22, 0.76, 0.78, 0.0, 0.16);
  }
});
/* Baie de serveurs (0,6 x 0,7 m, 2,1 m de haut) : porte perforée sombre, voyants (bandeaux d'écran) */
PF.tpRack = () => prefab('tpRack', (M) => {
  M.local(1); M.color([0.13, 0.14, 0.15]); M.boxB('steel', -0.3, 0.3, 0, 2.1, -0.35, 0.35, { bevel: 0.01 });
  M.color([0.5, 0.52, 0.53]); M.boxB('steel', -0.27, 0.27, 0.06, 2.04, 0.35, 0.355);
  M.color([1, 1, 1]); for (let k = 0; k < 7; k++) tpAtlasQuad(M, 'screenTp', -0.2, 0.2, 0.3 + k * 0.24, 0.34 + k * 0.24, 0.358, tpSignUV(TPS.seismo, [0.1 + k * 0.1, 0.3 + (k % 3) * 0.2, 0.15, 0.03]));
});
/* Enregistreurs à tambour (sismographes) sur leur table : socle, tambour de papier, couvercle de verre ; 1,8 m le long de x */
PF.tpDrums = () => prefab('tpDrums', (M) => {
  M.local(1); M.color([0.42, 0.34, 0.26]); M.boxB('paint', -0.9, 0.9, 0.74, 0.78, -0.35, 0.35); M.color([0.3, 0.31, 0.32]); for (const x of [-0.84, 0.84]) for (const z of [-0.3, 0.3]) M.boxB('steel', x - 0.02, x + 0.02, 0, 0.74, z - 0.02, z + 0.02);
  for (const x of [-0.5, 0.0, 0.5]) {
    M.color([0.85, 0.86, 0.86]); M.boxB('plastic', x - 0.22, x + 0.22, 0.78, 0.86, -0.18, 0.18);
    M.color([0.95, 0.94, 0.9]); M.save().move(x, 0.98, 0).rotZ(Math.PI / 2); M.cyl('plastic', 0.09, 0.38, 14); M.restore();
    M.color([0.7, 0.78, 0.82]); M.boxB('glass', x - 0.22, x + 0.22, 0.86, 1.12, -0.16, 0.16);
  }
});
/* Lits superposés (2 x 0,9 m) : cadre d'acier, matelas, échelle */
PF.tpBunk = () => prefab('tpBunk', (M) => {
  M.local(1); M.color([0.36, 0.42, 0.48]);
  for (const x of [-1.0, 1.0]) for (const z of [-0.45, 0.45]) M.boxB('steel', x - 0.025, x + 0.025, 0, 1.75, z - 0.025, z + 0.025);
  for (const y of [0.35, 1.3]) { M.boxB('steel', -1.0, 1.0, y, y + 0.05, -0.47, 0.47); M.color([0.52, 0.58, 0.66]); M.boxB('canvas', -0.97, 0.97, y + 0.05, y + 0.2, -0.43, 0.43, { bevel: 0.04 }); M.color([0.36, 0.42, 0.48]); }
  for (let y = 0.5; y < 1.3; y += 0.28) M.boxB('steel', 0.9, 1.0, y, y + 0.025, 0.44, 0.48);
});
/* Antenne GPS de surveillance des déformations : pilier de béton, antenne en disque sous son radôme, coffret et panneau solaire */
PF.tpGps = () => prefab('tpGps', (M) => {
  M.local(1); M.color([0.72, 0.71, 0.68]); M.boxB('concrete', -0.15, 0.15, 0, 1.1, -0.15, 0.15);
  M.color([0.92, 0.92, 0.9]); M.save().move(0, 1.1, 0); M.cyl('plastic', 0.19, 0.06, 16); M.restore(); M.save().move(0, 1.16, 0); M.lathe('plastic', [[0.17, 0], [0.15, 0.05], [0.08, 0.1], [0, 0.11]], 12); M.restore();
  M.color([0.85, 0.85, 0.83]); M.boxB('paint', 0.35, 0.75, 0, 0.45, -0.2, 0.2);
  M.color([0.4, 0.42, 0.43]); M.boxB('steel', 0.53, 0.57, 0.45, 1.0, -0.02, 0.02);
  M.color([0.14, 0.18, 0.3]); M.save().move(0.55, 1.0, 0).rotX(-0.6); M.boxB('glass', -0.3, 0.3, -0.02, 0.02, -0.22, 0.22); M.restore();
});
/* Mât météorologique (6 m) : anémomètre à coupelles, girouette, abri à persiennes, panneau solaire, haubans */
PF.tpWeather = () => prefab('tpWeather', (M) => {
  M.local(1); M.color([0.66, 0.68, 0.69]); M.cyl('steel', 0.04, 6.0, 8);
  M.save().move(0, 6.0, 0); M.cyl('steel', 0.012, 0.22, 6); for (let k = 0; k < 3; k++) { M.boxB('steel', -0.005, 0.005, 0.2, 0.21, 0, 0.14); M.rotY(TAU / 3); } M.restore();
  M.color([0.9, 0.9, 0.88]); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; M.save().move(Math.cos(a) * 0.15, 6.2, Math.sin(a) * 0.15); M.lathe('plastic', [[0, 0], [0.04, 0.0], [0.045, 0.03], [0, 0.04]], 8); M.restore(); }
  M.color([0.66, 0.68, 0.69]); M.boxB('steel', -0.6, 0.6, 5.4, 5.43, -0.015, 0.015); M.boxB('steel', 0.45, 0.65, 5.43, 5.6, -0.004, 0.004);
  M.color([0.94, 0.94, 0.92]); for (let k = 0; k < 6; k++) { M.save().move(0.22, 3.2 + k * 0.05, 0); M.cyl('plastic', 0.09, 0.03, 12); M.restore(); }
  M.color([0.14, 0.18, 0.3]); M.save().move(-0.3, 2.4, 0).rotZ(0.7); M.boxB('glass', -0.25, 0.25, -0.02, 0.02, -0.2, 0.2); M.restore();
  M.color([0.85, 0.85, 0.83]); M.boxB('paint', -0.18, 0.18, 1.2, 1.6, 0.05, 0.25);
  M.color([0.5, 0.51, 0.52]); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; M.tube('steel', 0.008, [[0, 4.5, 0], [Math.cos(a) * 1.5, 0.02, Math.sin(a) * 1.5]], 3); }
});
/* Station de mesure des gaz (près des fumerolles) : poteau, coffret d'analyseur, prise d'air, panneau solaire */
PF.tpGas = () => prefab('tpGas', (M) => {
  M.local(1); M.color([0.5, 0.52, 0.53]); M.boxB('steel', -0.04, 0.04, 0, 2.2, -0.04, 0.04);
  M.color([0.92, 0.72, 0.12]); M.boxB('paint', -0.25, 0.25, 0.9, 1.5, 0.04, 0.32, { bevel: 0.02 });
  M.color([0.3, 0.31, 0.32]); M.tube('rubber', 0.015, [[0.18, 0.95, 0.2], [0.3, 0.6, 0.3], [0.32, 0.12, 0.35]], 5);
  M.color([0.14, 0.18, 0.3]); M.save().move(0, 2.2, 0).rotX(-0.6); M.boxB('glass', -0.3, 0.3, -0.02, 0.02, -0.25, 0.25); M.restore();
});
