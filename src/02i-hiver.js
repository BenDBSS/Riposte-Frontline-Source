/* ==========================================================================
   KIT HIVERNAL : tout ce qu'il faut pour une carte de montagne enneigée, réutilisable d'une carte à l'autre.
   - Surfaces procédurales : neige fraîche (rides de vent, scintillements), neige tassée (empreintes, ornières,
     plaques de glace), roche (strates, fissures, lichen), bardage de mélèze grisé, écorce, ardoise, fer rouillé,
     bois de bout (cernes des grumes).
   - Atlas dessinés : branches d'épicéa chargées de neige et silhouettes de sapins (cartes découpées), enseignes
     émaillées, décalques (inscriptions des wagons, affiches, horaires, givre, traces au sol).
   - Matières : neige, roche, bardage, écorce, ardoise, rouille, glace (stalactites), fenêtres éclairées, ampoules.
   - Prefabs et architecture : sapins, tas et bourrelets de neige, bûchers, barrières, luge, bonhomme de neige,
     chalets (toits débordants à couche de neige épaisse et stalactites, balcons ajourés, volets), falaise, montagnes
     et forêts lointaines, chute de neige autour de la caméra.
   La neige posée sur le décor (dessus des objets, toits, appuis) est ajoutée par le shader (uSnow, 02c-materials.js) :
   les objets n'ont pas besoin d'une version enneigée.
   ========================================================================== */
Object.assign(TEXLAB, {
  /* neige fraîche : rides de vent (sastrugi), creux bleutés, grain et scintillements (rugosité plus faible) */
  snow: [1024, 61, 1.7, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(12.0), 4, 2.0), w = gfbm(uv, vec2(2.0), 3, 3.0);
    float rp = sin((uv.y * 9.0 + uv.x * 2.0 + w * 2.6) * 6.2831853) * 0.5 + 0.5; rp = rp * rp * smoothstep(0.35, 0.75, w);
    float gr = vn(uv * 512.0, vec2(512.0), 4.0);
    vec4 v = vor(uv, vec2(160.0), 5.0, 1.0); float sp = step(0.97, v.z) * (1.0 - smoothstep(0.05, 0.18, v.x));
    h = big * 0.42 + mid * 0.24 + rp * 0.22 + gr * 0.05;
    a = srgb(vec3(0.86, 0.885, 0.92)) * (0.93 + big * 0.05 + mid * 0.03 + gr * 0.02);
    a = mix(a * vec3(0.9, 0.94, 1.0), a, smoothstep(0.25, 0.7, h));
    r = 0.8 - sp * 0.55 + gr * 0.04; x = h;`],
  /* neige tassée : empreintes de pas, ornières, plaques de glace lisses, gadoue grise par endroits */
  snowpack: [1024, 63, 1.6, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(16.0), 4, 2.0), gr = vn(uv * 384.0, vec2(384.0), 3.0);
    vec2 p = uv * 11.0, ic = floor(p), f = fract(p) - 0.5; vec2 cm = mod(ic, 11.0);
    float rn = hs(cm, 3.0), an = rn * 6.2831853; vec2 o = (hs2(cm, 5.0) - 0.5) * 0.45;
    vec2 q = mat2(cos(an), -sin(an), sin(an), cos(an)) * (f - o);
    float heel = 1.0 - smoothstep(0.7, 1.0, length((q - vec2(0.0, -0.1)) / vec2(0.06, 0.07)));
    float sole = 1.0 - smoothstep(0.7, 1.0, length((q - vec2(0.0, 0.07)) / vec2(0.075, 0.11)));
    float fp = max(heel, sole) * step(0.3, rn);
    float rut = smoothstep(0.38, 0.47, abs(fract(uv.x * 2.0 + gfbm(uv, vec2(1.0, 4.0), 3, 7.0) * 0.15) - 0.5)) * smoothstep(0.55, 0.7, gfbm(uv, vec2(2.0, 1.0), 3, 8.0));
    float ice = smoothstep(0.62, 0.7, gfbm(uv, vec2(4.0), 4, 5.0)), slush = smoothstep(0.66, 0.86, big) * (1.0 - ice);
    h = big * 0.25 + mid * 0.3 + gr * 0.08 - fp * 0.32 - rut * 0.2 - ice * 0.12;
    a = srgb(vec3(0.78, 0.8, 0.84)) * (0.86 + mid * 0.12 + gr * 0.06) * (1.0 - fp * 0.14);
    a = mix(a, srgb(vec3(0.64, 0.69, 0.76)), ice * 0.65); a = mix(a, srgb(vec3(0.56, 0.55, 0.53)), slush * 0.45 + rut * 0.15);
    r = mix(0.8 - fp * 0.08, 0.22, ice); x = h;`],
  /* roche de falaise (granite) : strates, fissures, lichen */
  rock: [1024, 65, 2.6, `
    float big = gfbm(uv, vec2(2.0), 5, 1.0), mid = gfbm(uv, vec2(8.0), 5, 2.0), fine = gfbm(uv, vec2(32.0), 3, 3.0);
    float strata = sin((uv.y * 6.0 + big * 1.6) * 6.2831853) * 0.5 + 0.5;
    vec4 cr = vor(uv, vec2(5.0), 4.0, 1.0); float crack = (1.0 - smoothstep(0.0, 0.025, cr.w)) * smoothstep(0.35, 0.6, gfbm(uv, vec2(4.0), 3, 9.0));
    float lich = smoothstep(0.62, 0.76, gfbm(uv, vec2(10.0), 4, 6.0));
    h = big * 0.3 + mid * 0.35 + fine * 0.15 + strata * 0.15 + cr.z * 0.15 - crack * 0.45;
    vec3 c = mix(srgb(vec3(0.36, 0.34, 0.32)), srgb(vec3(0.58, 0.55, 0.51)), smoothstep(0.25, 0.75, mid + cr.z * 0.3 - 0.15)) * (0.84 + fine * 0.26);
    c = mix(c, c * vec3(1.08, 0.96, 0.84), strata * smoothstep(0.4, 0.7, big) * 0.35);
    c = mix(c, srgb(vec3(0.5, 0.55, 0.4)), lich * 0.35);
    a = c * (1.0 - crack * 0.6); r = 0.9 - fine * 0.08; x = h;`],
  /* bardage de mélèze (planches horizontales à rainures) : brun doré, grisé par les intempéries, nœuds */
  boards: [512, 67, 2.0, `
    float n = 8.0, pv = uv.y * n, pi = floor(pv), fv = fract(pv);
    float gap = 1.0 - smoothstep(0.02, 0.07, min(fv, 1.0 - fv)), id = hs(vec2(pi, 2.0), 3.0);
    float grain = gfbm(vec2(uv.x + id * 3.0, uv.y), vec2(3.0, 64.0), 5, 2.0 + id);
    float kx = fract(uv.x * 2.0 + id * 7.0), kid = hs(vec2(pi, floor(uv.x * 2.0 + id * 7.0)), 9.0);
    float knot = (1.0 - smoothstep(0.4, 1.0, length((vec2(kx, fv) - vec2(0.3 + kid * 0.4, 0.5)) / vec2(0.035, 0.22)))) * step(0.82, kid);
    float weather = smoothstep(0.25, 0.85, gfbm(uv, vec2(3.0), 4, 6.0) + (1.0 - fv) * 0.15);
    vec3 wood = mix(srgb(vec3(0.36, 0.25, 0.16)), srgb(vec3(0.5, 0.36, 0.24)), id * 0.5 + grain * 0.5);
    wood = mix(wood, srgb(vec3(0.42, 0.4, 0.37)) * (0.8 + grain * 0.3), weather * 0.55);
    wood = mix(wood, srgb(vec3(0.2, 0.13, 0.08)), knot * 0.6);
    a = mix(wood, srgb(vec3(0.07, 0.05, 0.04)), gap);
    h = (1.0 - gap) * (0.6 + grain * 0.2 - knot * 0.1); r = 0.84 + gap * 0.1; x = h;`],
  /* écorce d'épicéa : plaques allongées, fissures sombres (barkw et non bark : la carte florale, 02n-flore.js, a sa propre écorce sous ce nom, facultative ;
     le même nom écrasait celle-ci et la laissait absente des cartes d'hiver : grumes et troncs sortaient blancs) */
  barkw: [512, 69, 2.4, `
    float warp = gfbm(uv, vec2(4.0, 1.0), 3, 5.0) * 0.6;
    float fur = ridge(vec2(uv.x + warp * 0.25, uv.y * 0.15), vec2(18.0, 2.0), 4, 2.0);
    vec4 v = vor(vec2(uv.x + warp * 0.1, uv.y), vec2(16.0, 3.0), 4.0, 0.9);
    float fis = clamp(smoothstep(0.55, 0.9, fur) + (1.0 - smoothstep(0.0, 0.035, v.w)) * 0.6, 0.0, 1.0);
    float mid = gfbm(uv, vec2(6.0, 2.0), 4, 2.0), fine = gfbm(uv, vec2(32.0, 16.0), 3, 3.0);
    h = (1.0 - fis) * (0.55 + v.z * 0.2) + mid * 0.15 + fine * 0.1;
    a = mix(srgb(vec3(0.34, 0.25, 0.19)), srgb(vec3(0.5, 0.38, 0.28)), v.z * 0.5 + fine * 0.5) * (0.8 + mid * 0.3);
    a = mix(a, srgb(vec3(0.08, 0.06, 0.05)), fis * 0.9);
    r = 0.93; x = h;`],
  /* ardoises (toit de la gare) : rangs décalés, bords irréguliers, nuances bleu-gris */
  slate: [512, 71, 2.0, `
    vec4 t = tiles(uv, vec2(5.0, 12.0), 0.5);
    float jag = gfbm(uv, vec2(40.0, 8.0), 3, 2.0) * 0.08, edge = 1.0 - smoothstep(0.0, 0.05, t.w - jag * (1.0 - t.y));
    float fine = gfbm(uv, vec2(24.0), 3, 2.0), big = gfbm(uv, vec2(3.0), 4, 1.0);
    h = (1.0 - edge) * (0.35 + (1.0 - t.y) * 0.45) + fine * 0.1;
    a = srgb(mix(vec3(0.2, 0.22, 0.26), vec3(0.32, 0.34, 0.38), t.z)) * (0.8 + fine * 0.25 + big * 0.1) * (1.0 - edge * 0.5);
    r = 0.5 + fine * 0.2 + edge * 0.2; x = h;`],
  /* fer rouillé (rails, bogies, ferrures) : écailles, piqûres ; alpha = masque de métal sain */
  rust: [512, 73, 1.8, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(16.0), 4, 2.0), fine = vn(uv * 256.0, vec2(256.0), 3.0);
    float sc = smoothstep(0.55, 0.75, gfbm(uv, vec2(8.0), 5, 4.0));
    vec4 pit = vor(uv, vec2(64.0), 5.0, 1.0); float pt = (1.0 - smoothstep(0.05, 0.15, pit.x)) * step(0.8, pit.z);
    h = mid * 0.3 + sc * 0.25 + fine * 0.1 - pt * 0.3;
    vec3 c = mix(srgb(vec3(0.32, 0.17, 0.09)), srgb(vec3(0.55, 0.3, 0.14)), mid) * (0.8 + fine * 0.3);
    a = mix(c, srgb(vec3(0.2, 0.18, 0.17)) * (0.8 + fine * 0.3), sc * 0.7) * (1.0 - pt * 0.4);
    r = mix(0.9, 0.6, sc); x = sc * 0.5;`],
  /* bois de bout des grumes : cernes concentriques autour du coin de la tuile (centre des faces de coupe), fentes */
  logend: [512, 75, 1.4, `
    vec2 d = uv - floor(uv + 0.5); float rr = length(d), an = atan(d.y, d.x);
    float wob = gfbm(vec2(an / 6.2831853 + 0.5, rr), vec2(8.0, 2.0), 3, 2.0) * 0.012;
    float ring = sin((rr + wob * 2.5) * 130.0 + gfbm(d + 0.5, vec2(6.0), 2, 4.0) * 3.0) * 0.5 + 0.5, crack = (1.0 - smoothstep(0.0, 0.02, abs(sin(an * 3.0 + 0.7)) * rr * 10.0)) * smoothstep(0.03, 0.12, rr);
    h = 0.5 + ring * 0.15 - crack * 0.4;
    a = mix(srgb(vec3(0.6, 0.45, 0.3)), srgb(vec3(0.72, 0.58, 0.42)), ring * 0.7) * (1.0 - crack * 0.5);
    a = mix(a, srgb(vec3(0.5, 0.36, 0.22)), smoothstep(0.38, 0.5, rr));
    r = 0.85; x = h;`],
});
Object.assign(TEXSCALE, { snow: 4.0, snowpack: 3.2, rock: 6.0, boards: 1.6, barkw: 1.4, slate: 2.0, rust: 1.2, logend: 1.0 });
/* Surfaces générées seulement pour une carte enneigée (MAP_DEFS.id.winter) */
const WINTER_TEX = new Set(['snow', 'snowpack', 'rock', 'boards', 'barkw', 'slate', 'rust', 'logend']);

/* ---------- Matières ---------- */
function makeWinterMaterials(M) {
  M('snowmat', { tex: 'snow', macro: 0.12, env: 0.35, snow: 0 });           // tas, bourrelets et couches de neige modelés
  M('rock', { tex: 'rock', grime: 0.4, macro: 0.5, dust: 0.1, pom: 0.03 });
  M('boards', { tex: 'boards', grime: 0.9, streak: 0.5, macro: 0.25 });
  M('bark', { tex: 'barkw', macro: 0.2, grime: 0.6, snow: 0.6 });
  M('slate', { tex: 'slate', env: 0.7, macro: 0.3, grime: 0.3 });
  M('rust', { tex: 'rust', metal: 0.75, ma: true, env: 0.55, macro: 0.25, grime: 0.6, streak: 0.4 });
  M('logend', { tex: 'logend', macro: 0.15, snow: 0.6 });
  M('ice', { color: [0.8, 0.88, 0.96], rough: 0.08, env: 1.6, macro: 0.05, snow: 0 });
  M('conifer', { tex: 'conifer', cut: 0.45, rough: 0.85, env: 0.3, macro: 0.25, scale: 1, noNormal: true, snow: 0.35 }); makeWind(MAT.conifer, WIND_AMP.conifer, { cards: true }); // les branches balancent au vent (02md-vent.js)
  M('signs2', { tex: 'signs2', rough: 0.4, env: 0.7, macro: 0.05, scale: 1, noNormal: true, snow: 0.4 });
  M('decals2', { tex: 'decals2', rough: 0.8, env: 0.3, macro: 0.15, scale: 1, noNormal: true, polyOff: -4, snow: 0 });
  Object.assign(MAT.decals2, { transparent: true, depthWrite: false }); MAT.decals2.defines.WM_CUT = ''; MAT.decals2.side = THREE.FrontSide;
  MAT.decals2.userData.noShadow = true;
  // fenêtre éclairée de l'intérieur : vitre sale qui laisse passer une lumière chaude
  M('glassLit', { tex: 'glass', metal: 0.4, ma: true, env: 0.9, macro: 0.1, emissive: [0.95, 0.58, 0.28], snow: 0, polyOff: -2 });
  // ampoules des guirlandes (couleur des sommets, lumineuse : au-delà de 1)
  MAT.bulb = new THREE.MeshBasicMaterial({ vertexColors: true }); MAT.bulb.userData.noShadow = true;
}

/* ---------- Atlas dessinés ---------- */
/* Conifères (1024², alpha) : [0, 0, 0.5, 0.5] et [0.5, 0, 0.5, 0.5] branches d'épicéa enneigées (base en bas, pointe en
   haut) ; [0, 0.5, 0.5, 0.5] silhouette de sapin enneigé (forêts lointaines) ; [0.5, 0.5, 0.5, 0.5] buisson enneigé */
const CONIF = { branch: [0, 0, 0.5, 0.5], branch2: [0.5, 0, 0.5, 0.5], tree: [0, 0.5, 0.5, 0.5], bush: [0.5, 0.5, 0.5, 0.5] };
function coniferAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(4711);
  const needle = () => `hsl(${148 + R() * 22},${26 + R() * 18}%,${11 + R() * 13}%)`;
  const snowC = (k) => `hsl(212,${30 + R() * 20}%,${86 + k * 10 + R() * 4}%)`;
  g.lineCap = 'round';
  /* branche : tige centrale de bas en haut, rameaux latéraux vers la pointe couverts d'aiguilles, neige posée dessus */
  const branch = (x0, y0, W, H, snowK) => {
    const cx = x0 + W / 2, base = y0 + H - 8, tip = y0 + 10, twigs = [];
    g.strokeStyle = 'hsl(25,30%,18%)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx, base); g.quadraticCurveTo(cx + 10, (base + tip) / 2, cx, tip); g.stroke();
    for (let i = 0; i < 26; i++) {
      const t = (i + 0.5) / 26, y = lerp(base, tip, t), len = W * 0.45 * Math.sin(Math.min(1, t * 1.15 + 0.08) * Math.PI) * (0.75 + R() * 0.3);
      for (const s of [-1, 1]) {
        const ang = -Math.PI / 2 + s * (0.85 + R() * 0.25), ex = cx + Math.cos(ang) * len, ey = y + Math.sin(ang) * len * 0.55;
        twigs.push([cx, y, ex, ey]);
        g.strokeStyle = 'hsl(25,25%,20%)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(cx, y); g.lineTo(ex, ey); g.stroke();
      }
    }
    // aiguilles : petits traits serrés le long des rameaux, plus clairs au bout
    for (const [ax, ay, bx, by] of twigs) {
      const n = 26;
      for (let k = 0; k < n; k++) {
        const t = k / n, px = lerp(ax, bx, t), py = lerp(ay, by, t), dx = bx - ax, dy = by - ay, l = hyp(dx, dy) || 1;
        for (const s of [-1, 1]) {
          const nx = -dy / l * s, ny = dx / l * s, L = 9 + R() * 7 - t * 3;
          g.strokeStyle = needle(); g.lineWidth = 2 + R() * 1.2;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + (nx * 0.8 + dx / l * 0.6) * L, py + (ny * 0.8 + dy / l * 0.6) * L); g.stroke();
        }
      }
    }
    // neige : paquets arrondis sur la tige et les rameaux, ombrés en bleu sur le bord inférieur
    for (let i = 0; i < 140 * snowK; i++) {
      const tw = twigs[Math.floor(R() * twigs.length)], t = R() * 0.8, px = lerp(tw[0], tw[2], t), py = lerp(tw[1], tw[3], t);
      const r = (7 + R() * 12) * (1 - t * 0.5);
      g.fillStyle = snowC(-0.35); g.beginPath(); g.ellipse(px, py + r * 0.25, r * 1.15, r * 0.75, 0, 0, TAU); g.fill();
      g.fillStyle = snowC(0.2); g.beginPath(); g.ellipse(px - r * 0.1, py - r * 0.05, r, r * 0.62, 0, 0, TAU); g.fill();
    }
  };
  branch(0, 0, 512, 512, 1); branch(512, 0, 512, 512, 1.5);
  /* sapin entier : étages de branches tombantes, neige sur chaque étage */
  {
    const cx = 256, top = 530, bot = 1010;
    g.fillStyle = 'hsl(25,30%,16%)'; g.fillRect(cx - 9, bot - 70, 18, 70);
    for (let i = 0; i < 11; i++) {
      const t = i / 10, y = lerp(bot - 50, top + 20, t), w = lerp(210, 22, Math.pow(t, 0.9)), hgt = lerp(70, 34, t);
      g.fillStyle = `hsl(${150 + R() * 12},${24 + R() * 10}%,${12 + R() * 6}%)`;
      g.beginPath(); g.moveTo(cx, y - hgt * 1.6); g.quadraticCurveTo(cx + w * 0.6, y - hgt * 0.4, cx + w, y + hgt * 0.15);
      for (let k = 0; k <= 8; k++) g.lineTo(cx + w - (k / 8) * w * 2, y + hgt * 0.15 + Math.sin(k * 1.7) * 8 + R() * 6);
      g.quadraticCurveTo(cx - w * 0.6, y - hgt * 0.4, cx, y - hgt * 1.6); g.fill();
      // neige sur le dessus de l'étage
      g.fillStyle = snowC(0.1);
      g.beginPath(); g.moveTo(cx, y - hgt * 1.5); g.quadraticCurveTo(cx + w * 0.55, y - hgt * 0.5, cx + w * 0.92, y - hgt * 0.02);
      for (let k = 0; k <= 10; k++) g.lineTo(cx + w * 0.92 - (k / 10) * w * 1.84, y - hgt * (0.12 + 0.18 * Math.abs(Math.sin(k * 1.3 + i))) - R() * 5);
      g.quadraticCurveTo(cx - w * 0.55, y - hgt * 0.5, cx, y - hgt * 1.5); g.fill();
    }
    g.fillStyle = snowC(0.2); g.beginPath(); g.ellipse(cx, top + 6, 10, 16, 0, 0, TAU); g.fill();
  }
  /* buisson enneigé : touffe sombre, coussin de neige */
  {
    const cx = 768, cy = 820;
    for (let i = 0; i < 900; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 200, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7;
      g.strokeStyle = needle(); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 20, y - 6 - R() * 14); g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI * R(), d = Math.sqrt(R()) * 190, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6 - 20, r = 18 + R() * 30;
      g.fillStyle = snowC(-0.3); g.beginPath(); g.ellipse(x, y + 5, r * 1.1, r * 0.6, 0, 0, TAU); g.fill();
      g.fillStyle = snowC(0.2); g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, TAU); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Enseignes émaillées et peintes (1024², 8 panneaux de 512 x 256) */
const SIGNS2 = { gare: 0, hotel: 1, boulangerie: 2, scierie: 3, buffet: 4, douane: 5, altitude: 6, voies: 7 };
function winterSignAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), R = rngOf(93);
  const P = [
    ['#1d3557', '#f1f1ea', 'GIVRE', 'Georgia, serif', 150, '#f1f1ea'],
    ['#4a2c1a', '#e9c46a', 'HÔTEL DU COL', 'Georgia, serif', 76, '#e9c46a'],
    ['#efe6d2', '#8a2a1e', 'BOULANGERIE', 'Georgia, serif', 70, '#8a2a1e'],
    ['#2f4a33', '#efe6d2', 'SCIERIE DU GIVRE', 'Georgia, serif', 58, '#efe6d2'],
    ['#7a1f1a', '#f3e9d2', 'BUFFET DE LA GARE', 'Georgia, serif', 54, '#f3e9d2'],
    ['#26415f', '#f1f1ea', 'DOUANE', 'Arial, sans-serif', 118, '#f1f1ea'],
    ['#e8c547', '#1a1a1a', 'ALTITUDE 1847 m', 'Arial, sans-serif', 66, '#1a1a1a'],
    ['#f4f2ec', '#b3261e', 'DÉFENSE DE TRAVERSER\nLES VOIES', 'Arial, sans-serif', 46, '#b3261e'],
  ];
  P.forEach(([bg, fg, txt, font, size, border], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
    g.fillStyle = bg; g.fillRect(x, y, 512, 256);
    g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(x + 16, y + 16, 480, 224);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = txt.split('\n');
    lines.forEach((l, k) => { g.font = `bold ${size}px ${font}`; g.fillText(l, x + 256, y + 132 + (k - (lines.length - 1) / 2) * size * 1.15); });
    // émail écaillé, coins rouillés, salissures
    for (let k = 0; k < 18; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '40,30,22' : '120,70,40'},${0.3 + R() * 0.5})`; const ex = x + (R() < 0.5 ? 6 + R() * 30 : 476 + R() * 30), ey = y + (R() < 0.5 ? 6 + R() * 30 : 220 + R() * 30); g.beginPath(); g.arc(ex, ey, 2 + R() * 7, 0, TAU); g.fill(); }
    for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '30,25,20'},${R() * 0.08})`; g.fillRect(x + R() * 512, y + R() * 256, 1 + R() * 4, 1 + R() * 3); }
    const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(40,35,30,0.25)'); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Coordonnées (u0, v0, du, dv) d'une enseigne de l'atlas d'hiver */
function sign2UV(i) { return [(i % 2) * 0.5, Math.floor(i / 2) * 0.25, 0.5, 0.25]; }
/* Décalques d'hiver (1024², grille 4 x 4, alpha) : 0 et 1 inscriptions de wagon, 2 plaque orange de matière dangereuse,
   3 tableau de destination, 4 et 5 affiches, 6 tableau des départs, 7 givre de vitre, 8 coulure de rouille,
   9 flaque gelée, 10 ornières de gadoue, 11 traces de pas, 12 panneau « avalanches », 13 suie, 14 graffiti, 15 cadran d'horloge */
const DEC2 = { wagon: 0, wagon2: 1, hazard: 2, dest: 3, poster: 4, poster2: 5, departs: 6, frost: 7, rust: 8, ice: 9, ruts: 10, steps: 11, avalanche: 12, soot: 13, tag: 14, clock: 15 };
function winterDecalAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(8642), T = S / 4;
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  const stencil = (lines, size, col) => {
    g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    lines.forEach(([txt, k], j) => { g.font = `bold ${Math.round(size * k)}px Arial, sans-serif`; g.fillText(txt, 14, 60 + j * size * 1.25); });
    g.globalCompositeOperation = 'destination-out';
    for (let j = 0; j < 260; j++) { g.fillStyle = `rgba(0,0,0,${R() * 0.7})`; g.fillRect(R() * T, R() * T, 2 + R() * 4, 1 + R() * 3); }
    g.globalCompositeOperation = 'source-over';
  };
  cell(0, () => stencil([['CFG', 1.6], ['21 85 150 3', 0.8], ['012-7', 0.8], ['Gbs 254', 0.7]], 30, 'rgba(238,236,228,0.92)'));
  cell(1, () => stencil([['ANCIEN DÉPÔT', 0.7], ['DU COL', 0.9], ['Tare 13 400 kg', 0.6], ['Charge 27 t', 0.6]], 34, 'rgba(238,236,228,0.9)'));
  cell(2, () => {
    g.fillStyle = '#e46a12'; g.fillRect(28, 64, 200, 128); g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(31, 67, 194, 122);
    g.beginPath(); g.moveTo(31, 128); g.lineTo(225, 128); g.stroke();
    g.fillStyle = '#111'; g.font = 'bold 44px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('33', 128, 116); g.fillText('1203', 128, 176);
  });
  cell(3, () => {
    g.fillStyle = '#f2efe6'; g.fillRect(16, 80, 224, 96); g.strokeStyle = '#1d3557'; g.lineWidth = 5; g.strokeRect(19, 83, 218, 90);
    g.fillStyle = '#1d3557'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('GIVRE', 128, 122); g.font = 'bold 22px Arial, sans-serif'; g.fillText('↔ VAL-BLANC', 128, 156);
  });
  [['#1d4e89', '#f6f1e3', 'SKI-CLUB\nDU COL', 'Concours de saut'], ['#b8322a', '#f7ecd0', 'BAL DU\nNOUVEL AN', 'Hôtel du Col']].forEach(([bg, fg, title, sub], k) => cell(4 + k, () => {
    const x = 40 + R() * 8, y = 18, w = T - 80, h = T - 36;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = fg; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center';
    title.split('\n').forEach((l, j) => g.fillText(l, x + w / 2, y + 56 + j * 34));
    g.font = 'italic 18px Georgia, serif'; g.fillText(sub, x + w / 2, y + h - 26);
    // montagnes stylisées
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(x + 10, y + h - 50); g.lineTo(x + w * 0.35, y + 120); g.lineTo(x + w * 0.55, y + h - 70); g.lineTo(x + w * 0.72, y + 140); g.lineTo(x + w - 10, y + h - 50); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let j = 0; j < 7; j++) { g.beginPath(); const ex = x + (R() < 0.5 ? 0 : w), ey = y + R() * h; g.moveTo(ex, ey); for (let q = 0; q < 5; q++) g.lineTo(ex + (R() - 0.5) * 50, ey + (R() - 0.5) * 50); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  }));
  cell(6, () => {
    g.fillStyle = '#141619'; g.fillRect(12, 12, T - 24, T - 24); g.strokeStyle = '#6d6d6d'; g.lineWidth = 4; g.strokeRect(14, 14, T - 28, T - 28);
    g.fillStyle = '#f2d35b'; g.font = 'bold 22px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('DÉPARTS', 26, 44);
    const rows = [['07:42', 'VAL-BLANC'], ['09:15', 'LA COMBE'], ['11:03', 'VAL-BLANC'], ['14:28', 'SAINT-ROC'], ['17:50', 'VAL-BLANC']];
    g.font = '18px Arial, sans-serif';
    rows.forEach(([h, d], j) => { g.fillStyle = '#e8e8e8'; g.fillText(h, 26, 82 + j * 32); g.fillText(d, 96, 82 + j * 32); });
    g.fillStyle = '#d9483b'; g.font = 'bold 18px Arial, sans-serif'; g.fillText('TRAFIC INTERROMPU', 26, 236);
  });
  cell(7, () => {
    for (let j = 0; j < 80; j++) { const x = R() < 0.5 ? R() * 70 : T - R() * 70, y = R() < 0.5 ? R() * 70 : T - R() * 70, rr = 10 + R() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(240,246,252,0.7)'); gr.addColorStop(1, 'rgba(240,246,252,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); }
    g.strokeStyle = 'rgba(250,252,255,0.55)'; g.lineWidth = 1.2;
    const fern = (x, y, a, l, d) => { if (d > 4 || l < 4) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); fern(x2, y2, a + 0.5, l * 0.6, d + 1); fern(x2, y2, a - 0.5, l * 0.6, d + 1); fern(x2, y2, a, l * 0.75, d + 1); };
    for (const [x, y, a] of [[0, 0, 0.8], [T, 0, 2.3], [0, T, -0.8], [T, T, -2.3], [10, T * 0.5, 0], [T - 10, T * 0.4, Math.PI]]) fern(x, y, a, 26, 0);
  });
  cell(8, () => { const gr = g.createLinearGradient(0, 0, 0, T); gr.addColorStop(0, 'rgba(110,52,22,0.6)'); gr.addColorStop(1, 'rgba(110,52,22,0)'); g.fillStyle = gr; for (let j = 0; j < 12; j++) { const x = T * 0.2 + R() * T * 0.6, w = 4 + R() * 14; g.fillRect(x, 0, w, T * (0.3 + R() * 0.7)); } });
  cell(9, () => { for (let j = 0; j < 14; j++) { const x = T / 2 + (R() - 0.5) * 90, y = T / 2 + (R() - 0.5) * 70, rr = 30 + R() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(150,175,200,0.55)'); gr.addColorStop(0.7, 'rgba(170,195,215,0.35)'); gr.addColorStop(1, 'rgba(170,195,215,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); } });
  cell(10, () => { for (const x of [T * 0.3, T * 0.7]) for (let y = 0; y < T; y += 5) { g.fillStyle = `rgba(80,74,66,${0.18 + R() * 0.2})`; g.fillRect(x - 16 + (R() - 0.5) * 4, y, 32, 4); } });
  cell(11, () => { for (let j = 0; j < 8; j++) { const s = j % 2 ? 1 : -1, x = T / 2 + s * 18, y = T - 20 - j * 30; g.fillStyle = 'rgba(90,100,115,0.35)'; g.beginPath(); g.ellipse(x, y, 9, 15, 0.05 * s, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x, y + 17, 7, 7, 0, 0, TAU); g.fill(); } });
  cell(12, () => {
    g.fillStyle = '#f2f2ee'; g.beginPath(); g.moveTo(T / 2, 30); g.lineTo(T - 30, T - 50); g.lineTo(30, T - 50); g.closePath(); g.fill();
    g.strokeStyle = '#c0261e'; g.lineWidth = 16; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(80, T - 76); g.lineTo(T / 2 - 10, 110); g.lineTo(T / 2 + 20, 150); g.lineTo(T - 78, T - 76); g.closePath(); g.fill();
    g.fillStyle = '#f2f2ee'; for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(T / 2 + 10 + j * 9, 150 + j * 12, 7, 0, TAU); g.fill(); }
  });
  cell(13, () => { for (let j = 0; j < 40; j++) { const x = T / 2 + (R() - 0.5) * T * 0.6, y = T * 0.3 + R() * T * 0.5, rr = 10 + R() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(18,16,15,0.22)'); gr.addColorStop(1, 'rgba(18,16,15,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); } });
  cell(14, () => {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1f2a44'; g.lineWidth = 9;
    g.font = 'bold 64px Arial, sans-serif'; g.fillStyle = '#d23a2c'; g.save(); g.translate(T / 2, T / 2 + 10); g.rotate(-0.12); g.textAlign = 'center'; g.strokeText('GEL', 0, 0); g.fillText('GEL', 0, 0); g.restore();
  });
  cell(15, () => {
    // cadran d'horloge de gare : disque blanc, index, aiguilles arrêtées (le froid a eu raison du mécanisme)
    g.fillStyle = '#f4f2ea'; g.beginPath(); g.arc(T / 2, T / 2, T / 2 - 6, 0, TAU); g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; g.stroke();
    for (let j = 0; j < 60; j++) { const a = (j / 60) * TAU, r0 = j % 5 ? T / 2 - 20 : T / 2 - 38; g.lineWidth = j % 5 ? 3 : 9; g.beginPath(); g.moveTo(T / 2 + Math.cos(a) * r0, T / 2 + Math.sin(a) * r0); g.lineTo(T / 2 + Math.cos(a) * (T / 2 - 12), T / 2 + Math.sin(a) * (T / 2 - 12)); g.stroke(); }
    const hand = (a, l, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(T / 2 - Math.cos(a) * 14, T / 2 - Math.sin(a) * 14); g.lineTo(T / 2 + Math.cos(a) * l, T / 2 + Math.sin(a) * l); g.stroke(); };
    hand(-Math.PI / 2 + (10.7 / 12) * TAU, 62, 12, '#1a1a1a'); hand(-Math.PI / 2 + (42 / 60) * TAU, 96, 8, '#1a1a1a'); hand(-Math.PI / 2 + (17 / 60) * TAU, 96, 3, '#c0261e');
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Décalque d'hiver i : quadrilatère (points du repère courant) légèrement décollé de la surface */
function decal2Quad(M, i, p0, p1, p2, p3, n) {
  const u0 = (i % 4) * 0.25, v0 = Math.floor(i / 4) * 0.25, B = M.buf('decals2', (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2);
  M.save(); M.cls = 1;
  const ids = [[p0, u0, v0 + 0.25], [p1, u0 + 0.25, v0 + 0.25], [p2, u0 + 0.25, v0], [p3, u0, v0]].map(([p, u, v]) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], u, v));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
/* Emplacement d'une affiche de largeur w sur une façade percée d'ouvertures ops : le milieu du panneau de mur libre (au moins w + 5 cm de large) le plus
   proche de u, à la hauteur [y0, y1]. Chaque ouverture de cette hauteur compte avec 45 cm de volets de chaque côté, les bouts du mur avec 30 cm
   (madriers d'angle, descente d'eau). Rend null s'il n'y a pas de place : une affiche posée au hasard tombait sur une fenêtre ou à cheval sur un volet. */
function posterSpot(len, ops, y0, y1, w, u) {
  const blocks = ops.filter((q) => q.y1 > y0 - 0.1 && q.y0 < y1 + 0.1).map((q) => [q.x0 - 0.45, q.x1 + 0.45]).sort((a, b) => a[0] - b[0]);
  let best = null, bd = Infinity, a = 0.3;
  for (const [b0, b1] of blocks.concat([[len - 0.3, len + 1]])) {
    if (b0 - a >= w + 0.05) { const c = (a + b0) / 2, d = Math.abs(c - u); if (d < bd) { bd = d; best = c; } }
    a = Math.max(a, b1);
  }
  return best;
}
/* Décalque d'hiver sur une façade (repère de façade) ou au sol (monde) */
function wallDecal2(M, i, xc, y, w, h, z = 0.008) { decal2Quad(M, i, [xc - w / 2, y, z], [xc + w / 2, y, z], [xc + w / 2, y + h, z], [xc - w / 2, y + h, z], [0, 0, 1]); }
function groundDecal2(i, x, z, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (a, b) => [x + a * c - b * s, 0.014, z + a * s + b * c];
  decal2Quad(DECOR, i, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), [0, 1, 0]);
}
/* Enseigne de l'atlas d'hiver posée à plat (repère de façade), avec son cadre */
function sign2Board(M, xc, y, w, h, idx, frame = [0.3, 0.25, 0.2]) {
  const [u0, v0, du, dv] = sign2UV(idx), B = M.buf('signs2', xc, y, 0.05), z = 0.06;
  M.save().color([1, 1, 1]);
  const a = M.v(B, xc - w / 2, y, z, 0, 0, 1, u0, v0 + dv), b = M.v(B, xc + w / 2, y, z, 0, 0, 1, u0 + du, v0 + dv);
  const c = M.v(B, xc + w / 2, y + h, z, 0, 0, 1, u0 + du, v0), d = M.v(B, xc - w / 2, y + h, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d);
  if (frame) { M.color(frame).local(1); lbox(M, 'paintwood', xc - w / 2 - 0.03, xc + w / 2 + 0.03, y - 0.03, y + h + 0.03, 0, z - 0.002); }
  M.restore();
}

/* ---------- Végétation ---------- */
/* Épicéa enneigé : tronc conique, verticilles de branches tombantes (deux cartes croisées par branche, de plus en plus
   courtes vers la cime), flèche ; collision du tronc seulement (les tirs et le regard passent entre les branches). */
/* base : hauteur de la première couronne de branches (un sapin de place, taillé, laisse passer dessous) ; sinon 0,9 à 1,5 m */
PF.spruce = (h = 9, seed = 1, base = 0) => prefab(`spruce${h}_${seed}${base ? '_' + base : ''}`, (M) => {
  const R = rngOf(seed * 31 + 7), r0 = 0.1 + h * 0.017;
  M.swFn = swCrown(0, 0, 0, h, h * 0.28, 0.75); // les bouts de branches et la cime balancent (02md-vent.js)
  M.color([0.62, 0.55, 0.48]).local(1);
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0, 1.4, y));
  M.cyl('bark', r0, h, 8, { r1: 0.025, caps: '', uR: 0.6 });
  M.aoFn = null;
  const y0r = 0.9 + R() * 0.6, y0 = base || y0r, n = Math.max(6, Math.round((h - y0) / 0.48));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = lerp(y0, h - 0.5, t), L = 0.3 + h * 0.3 * Math.pow(1 - t, 1.05) * (0.85 + R() * 0.3);
    const k = t > 0.75 ? 4 : t > 0.4 ? 5 : 6, off = R() * TAU, rt = r0 * (1 - t);
    M.color([R.range(0.88, 1), R.range(0.92, 1.02), R.range(0.9, 1)]);
    for (let j = 0; j < k; j++) {
      const a = off + (j / k) * TAU + (R() - 0.5) * 0.45, ca = Math.cos(a), sa = Math.sin(a), droop = L * R.range(0.25, 0.42);
      const c0 = [ca * rt, y, sa * rt], c1 = [c0[0] + ca * L, y + 0.12 * L - droop, c0[2] + sa * L], hw = L * 0.34 + 0.08;
      for (const roll of [0.5, -0.5]) {
        const px = -sa * Math.cos(roll) * hw, py = Math.sin(roll) * hw, pz = ca * Math.cos(roll) * hw;
        foliageQuad(M, [c0[0] - px, c0[1] - py, c0[2] - pz], [c0[0] + px, c0[1] + py, c0[2] + pz], [c1[0] + px, c1[1] + py, c1[2] + pz], [c1[0] - px, c1[1] - py, c1[2] - pz],
          R() < 0.5 ? CONIF.branch : CONIF.branch2, 0.5, 'conifer');
      }
    }
  }
  // flèche : deux petites cartes dressées
  for (const a of [0, Math.PI / 2]) {
    const ca = Math.cos(a) * 0.32, sa = Math.sin(a) * 0.32;
    foliageQuad(M, [-ca, h - 0.9, -sa], [ca, h - 0.9, sa], [ca, h + 0.35, sa], [-ca, h + 0.35, -sa], CONIF.branch2, 0.3, 'conifer');
  }
  M.occ(-h * 0.25, h * 0.25, 1.2, h * 0.8, -h * 0.25, h * 0.25, 0.3);
  M.col(-r0, r0, 0, h * 0.8, -r0, r0, 'wood');
});
/* Sapin lointain (forêts, versants) : trois cartes verticales de la silhouette entière, sans ombre ni collision */
function farTree(M, x, y, z, h, rot) {
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * Math.PI, c = Math.cos(a) * h * 0.3, s = Math.sin(a) * h * 0.3;
    foliageQuad(M, [x - c, y - 0.3, z - s], [x + c, y - 0.3, z + s], [x + c, y + h, z + s], [x - c, y + h, z - s], CONIF.tree, 0.25, 'conifer');
  }
}
/* Buisson enneigé (cartes croisées) */
PF.snowBush = (s = 1) => prefab('snowBush' + s, (M) => {
  M.swFn = swHeight(0, s, 1.3, 0.5);
  M.color([0.95, 1, 0.97]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + 0.4, c = Math.cos(a) * 0.75 * s, sn = Math.sin(a) * 0.75 * s;
    foliageQuad(M, [-c, -0.05, -sn], [c, -0.05, sn], [c, 1.0 * s, sn], [-c, 1.0 * s, -sn], CONIF.bush, 0.6, 'conifer');
  }
});

/* ---------- Neige modelée ---------- */
/* Tas de neige arrondi et bosselé (ellipse w x d, hauteur h), posé sur y = 0. mat 'ground' : posé au sol d'une carte d'hiver, il prend la
   matière du sol (même neige, mêmes traces, lue à la position dans le monde) et son pied se raccorde au sol en pente douce, sans arête
   (retour du propriétaire, octobre 2026 : les mottes étaient trop marquées par rapport au sol) ; le sol est peint en neige fraîche
   dessous (snowHeap) */
PF.snowMound = (w = 2, d = 1.4, h = 0.7, seed = 1, mat = 'snowmat') => prefab(`snowMound${w}_${d}_${h}_${seed}_${mat}`, (M) => {
  const R = rngOf(seed * 97 + 3), ph = [R() * TAU, R() * TAU, R() * TAU, R() * TAU], soft = mat === 'ground', k = soft ? 1.45 : 1;
  M.save().color([1, 1, 1]).local(1);
  M.surf(mat, 18, soft ? 10 : 7, (u, v) => {
    const a = u * TAU, wob = 1 + 0.1 * Math.sin(a * 3 + ph[0]) + 0.06 * Math.sin(a * 5 + ph[1]), r = (1 - v) * wob;
    const bump = 1 + 0.12 * Math.sin(a * 2 + ph[2] + v * 3) * Math.sin(v * Math.PI) + 0.08 * Math.sin(a * 7 + ph[3]) * (1 - v);
    const q = r * r / (wob * wob), prof = soft ? (1 - q) * (1 - q) : Math.pow(1 - q, 0.65);
    return [Math.cos(a) * r * k * w / 2, Math.max(soft ? -0.04 : 0, h * prof * bump - (soft ? 0.04 : 0)) - (soft ? 0 : 0.03 * (1 - v)), Math.sin(a) * r * k * d / 2];
  }, { closeU: true, flipN: true, uL: (w + d) * 1.6, vL: Math.max(w, d) * 0.6, pole: () => [0, 1, 0], ao: (u, v) => lerp(soft ? 0.94 : 0.82, 1, v) });
  M.restore();
});
/* Empreintes des tas de neige posés au sol (x, z, demi-axes, angle) : le sol y est peint en neige fraîche (givreGround), vidées après */
const SNOW_HEAPS = [];
function snowHeap(x, z, rx, rz, rot = 0) { SNOW_HEAPS.push({ x, z, rx, rz, rot }); }
/* Bourrelet de neige déblayée le long d'une rue (x0..x1 ou z0..z1 selon le plus long), hauteur h, avec collision basse :
   un couvert qu'on peut enjamber d'un saut. Dans la matière du sol (même neige, mêmes traces), profil en cloche qui se raccorde au sol
   sans arête, neige fraîche peinte dessous et autour (snowHeap) : il sort du sol au lieu d'y être posé */
function snowBank(x0, x1, z0, z1, h, seed = 1, col = true) {
  const M = DECOR, alongX = x1 - x0 >= z1 - z0, L = alongX ? x1 - x0 : z1 - z0, W = alongX ? z1 - z0 : x1 - x0, R = rngOf(seed * 53 + 11);
  const ph = [R() * TAU, R() * TAU, R() * TAU], nu = Math.max(6, Math.round(L / 0.5));
  M.save().color([1, 1, 1]).local(1).move((x0 + x1) / 2, 0, (z0 + z1) / 2);
  if (!alongX) M.rotY(Math.PI / 2);
  // profil en travers arrondi, crête irrégulière, bouts arrondis
  M.surf('ground', nu, 10, (u, v) => {
    // bouts effilés en pente douce (sur au moins 1,2 m ou une largeur et demie), crête irrégulière, largeur qui varie
    const s = (u - 0.5) * L, e = Math.min(1, Math.min(u, 1 - u) * L / Math.max(1.2, W * 1.5)), end = Math.sin(e * Math.PI / 2);
    const hh = h * end * (1 + 0.16 * Math.sin(s * 1.3 + ph[0]) + 0.1 * Math.sin(s * 3.1 + ph[1]) + 0.05 * Math.sin(s * 7.3 + ph[2])), ww = W * 0.75 * (0.45 + 0.55 * end) * (1 + 0.08 * Math.sin(s * 1.9 + ph[1]));
    const a = v * Math.PI, c = -Math.cos(a), prof = (1 - c * c) * (1 - c * c);
    return [s * (1 + 0.12 * (1 - end)), Math.max(-0.04, hh * prof - 0.04), c * ww * (1 + 0.06 * Math.sin(s * 2.3 + ph[2]))];
  }, { uL: L, vL: W * 1.5, flipN: true, ao: (u, v) => lerp(0.94, 1, Math.sin(v * Math.PI)) });
  M.restore();
  snowHeap((x0 + x1) / 2, (z0 + z1) / 2, (alongX ? L * 0.56 : W * 0.75), (alongX ? W * 0.75 : L * 0.56));
  if (col) WORLD.col({ x0: alongX ? x0 + 0.2 : x0 + W * 0.15, x1: alongX ? x1 - 0.2 : x1 - W * 0.15, y0: 0, y1: h * 0.85, z0: alongX ? z0 + W * 0.15 : z0 + 0.2, z1: alongX ? z1 - W * 0.15 : z1 - 0.2 }, 'snow');
}

/* ---------- Accessoires ---------- */
/* Bûcher : rondins fendus empilés (bois de bout en façade), petit toit de planches ; longueur L, hauteur H, profondeur D */
PF.woodpile = (L = 2.4, H = 1.2, D = 0.5) => prefab(`woodpile${L}_${H}_${D}`, (M) => {
  const R = rngOf(Math.round(L * 100 + H * 10)), r = 0.068, rows = Math.floor(H / (r * 1.85));
  M.local(1);
  for (let j = 0; j < rows; j++) {
    const y = r + j * r * 1.8, off = (j % 2) * r;
    for (let x = -L / 2 + r + off; x < L / 2 - r; x += r * 2.05) {
      const rr = r * R.range(0.85, 1.1), dz = R.range(-0.04, 0.04);
      M.color([R.range(0.85, 1), R.range(0.85, 1), R.range(0.85, 1)]);
      M.save().move(x + R.range(-0.01, 0.01), y, -D / 2 + dz).rotX(Math.PI / 2).rotY(R() * TAU); M.cyl('bark', rr, D, 8, { caps: '' }); M.restore();
      M.save().move(x, y, D / 2 + dz + 0.001).rotX(Math.PI / 2); M.cyl('logend', rr, 0.0005, 8, { caps: 't', side: false }); M.restore();
    }
  }
  // auvent de planches
  M.color([0.55, 0.45, 0.36]);
  M.save().move(0, rows * r * 1.8 + 0.12, 0).rotX(-0.12); M.boxB('wood', -L / 2 - 0.12, L / 2 + 0.12, 0, 0.04, -D / 2 - 0.1, D / 2 + 0.25); M.restore();
  for (const x of [-L / 2 - 0.05, L / 2 + 0.05]) M.boxB('wood', x - 0.04, x + 0.04, 0, rows * r * 1.8 + 0.12, D / 2 + 0.05, D / 2 + 0.13);
  M.col(-L / 2, L / 2, 0, rows * r * 1.8 + 0.1, -D / 2, D / 2, 'wood');
});
/* Barrière de bois (poteaux et deux lisses), longueur L le long de x ; sans collision (posée hors des passages) */
PF.fence = (L = 4) => prefab('fence' + L, (M) => {
  const R = rngOf(Math.round(L * 10)), n = Math.max(1, Math.round(L / 1.8));
  M.color([0.55, 0.46, 0.38]).local(1);
  for (let i = 0; i <= n; i++) { const x = -L / 2 + (L * i) / n; M.save().move(x, 0, 0).rotY(R() * 0.5); M.boxB('wood', -0.06, 0.06, 0, 1.15 + R() * 0.08, -0.06, 0.06, { bevel: 0.01 }); M.restore(); }
  for (const y of [0.45, 0.95]) { M.save().move(0, y, 0).rotZ((R() - 0.5) * 0.03); M.boxB('wood', -L / 2, L / 2, -0.04, 0.05, 0.06, 0.12, { bevel: 0.01 }); M.restore(); }
});
/* Luge de bois */
PF.sled = () => prefab('sled', (M) => {
  M.color([0.62, 0.42, 0.26]).local(1); M.cls = 2;
  for (const x of [-0.17, 0.17]) { M.tube('wood', 0.018, [[x, 0.02, 0.45], [x, 0.0, 0.3], [x, 0.0, -0.4], [x, 0.06, -0.52], [x, 0.16, -0.5]], 5); for (const z of [-0.3, 0, 0.3]) M.boxB('wood', x - 0.015, x + 0.015, 0.02, 0.2, z - 0.015, z + 0.015); }
  for (let i = 0; i < 5; i++) { const z = -0.32 + i * 0.16; M.boxB('wood', -0.22, 0.22, 0.2, 0.225, z - 0.06, z + 0.06, { bevel: 0.005 }); }
});
/* Bonhomme de neige : trois boules, yeux de charbon, nez en carotte, bras en branches, écharpe et bonnet */
PF.snowman = () => prefab('snowman', (M) => {
  M.color([1, 1, 1]).local(1);
  for (const [y, r] of [[0.32, 0.4], [0.9, 0.3], [1.33, 0.2]]) { M.save().move(0, y, 0).scl(r, r * 0.95, r); M.geo('snowmat', new THREE.SphereGeometry(1, 14, 10), { uvs: r * 2 }); M.restore(); }
  M.color([0.05, 0.05, 0.05]); M.cls = 1;
  for (const [x, y, z] of [[-0.07, 1.4, 0.17], [0.07, 1.4, 0.17], [0, 1.07, 0.27], [0, 0.94, 0.3], [0, 0.8, 0.29]]) { M.save().move(x, y, z).scl(0.025); M.geo('dark', G_SPH); M.restore(); }
  M.color([0.95, 0.45, 0.12]); M.save().move(0, 1.33, 0.18).rotX(Math.PI / 2); M.cyl('plastic', 0.03, 0.17, 6, { r1: 0.002 }); M.restore();
  M.color([0.35, 0.25, 0.17]);
  for (const s of [-1, 1]) M.tube('wood', 0.015, [[s * 0.26, 0.98, 0], [s * 0.5, 1.15, 0.05], [s * 0.62, 1.28, 0.02]], 4);
  M.color([0.72, 0.12, 0.1]); M.save().move(0, 1.12, 0); M.cyl('canvas', 0.21, 0.08, 12); M.restore();
  M.tube('canvas', 0.035, [[0.15, 1.15, 0.12], [0.2, 1.0, 0.2], [0.22, 0.85, 0.2]], 5);
  M.color([0.2, 0.32, 0.55]); M.save().move(0, 1.46, 0); M.lathe('canvas', [[0, 0.2], [0.12, 0.17], [0.19, 0.06], [0.205, 0], [0.205, -0.03], [0, -0.03]], 12); M.restore();
  M.save().move(0, 1.67, 0).scl(0.05); M.geo('canvas', G_SPH); M.restore();
  M.col(-0.4, 0.4, 0, 1.6, -0.4, 0.4, 'snow');
});
/* Un ski (175 x 8 cm) debout, spatule en +y : teinte de l'estampille. Prop physique : on l'incline au placement (rx = -0.2) pour l'appuyer */
PF.skiOne = () => prefab('skiOne', (M, P) => {
  P.tintable = ['plastic'];
  M.local(1); M.color([1, 1, 1]);
  M.boxB('plastic', -0.04, 0.04, 0, 1.75, -0.012, 0.012, { bevel: 0.005 });
  M.color([0.12, 0.12, 0.12]); M.boxB('dark', -0.03, 0.03, 0.62, 0.7, -0.03, 0.03, { bevel: 0.005 });
});
/* Un bâton de ski (1,25 m), debout */
PF.skiPole = () => prefab('skiPole', (M) => {
  M.local(1); M.color([0.3, 0.3, 0.3]);
  M.tube('steel', 0.009, [[0, 0, 0], [0, 1.2, 0]], 4);
  M.color([0.12, 0.12, 0.12]); M.tube('plastic', 0.016, [[0, 1.0, 0], [0, 1.25, 0]], 5);
  M.save().move(0, 0.12, 0); M.cyl('plastic', 0.045, 0.012, 8); M.restore();
});
/* Râtelier à skis (repère : le dos du râtelier vers -z, les skis posés devant, appuyés contre la planche du fond) : socle, deux
   montants, planche du fond. Les skis et les bâtons sont des props physiques, un par un (voir skiRackAt). */
PF.skiRack = () => prefab('skiRack', (M) => {
  M.color([0.5, 0.36, 0.24]).local(1);
  for (const x of [-1.1, 1.1]) M.boxB('wood', x - 0.05, x + 0.05, 0, 1.95, -0.52, -0.42);
  M.boxB('wood', -1.15, 1.15, 1.0, 1.9, -0.40, -0.36, { bevel: 0.008 });
  M.col(-1.15, 1.15, 0, 1.95, -0.54, -0.36, 'wood');
});

/* ---------- Architecture alpine ---------- */
const PAL_ALP = {
  plaster: [[0.95, 0.93, 0.88], [0.93, 0.89, 0.82], [0.9, 0.9, 0.87], [0.96, 0.91, 0.84], [0.88, 0.84, 0.78]],
  wood: [[0.86, 0.8, 0.72], [0.74, 0.66, 0.58], [0.95, 0.86, 0.76], [0.66, 0.6, 0.55]],
  shutter: [[0.22, 0.42, 0.28], [0.62, 0.17, 0.13], [0.2, 0.32, 0.5], [0.4, 0.28, 0.18], [0.85, 0.82, 0.74]],
  roof: [[0.78, 0.8, 0.85], [0.62, 0.52, 0.45], [0.58, 0.6, 0.64]],
  door: [[0.42, 0.26, 0.14], [0.2, 0.36, 0.26], [0.55, 0.16, 0.12], [0.3, 0.22, 0.16]],
};
/* Toit alpin à deux pans sur le bloc [x0, x1] x [z0, z1], égout à la hauteur y : couverture (ardoise ou bardeaux),
   sous-face lambrissée et chevrons apparents, pignons en planches, épaisse couche de neige qui déborde de l'égout,
   stalactites, cheminée. o : alongX (faîtage le long de x), pitch (rad), ovE / ovG (débords d'égout et de pignon),
   mat, tint, snowT (épaisseur de neige), chimney, wood (teinte des pignons), gable (matière des pignons), R */
function alpineRoof(x0, x1, z0, z1, y, o = {}) {
  const M = DECOR, alongX = o.alongX !== undefined ? o.alongX : x1 - x0 >= z1 - z0, span = alongX ? z1 - z0 : x1 - x0, len = alongX ? x1 - x0 : z1 - z0;
  const R = o.R || rngOf(Math.round(x0 * 7 + z0 * 13 + y)), pitch = o.pitch || 0.46, ovE = o.ovE !== undefined ? o.ovE : 1.1, ovG = o.ovG !== undefined ? o.ovG : 0.8, tR = 0.16;
  const tn = Math.tan(pitch), rise = (span / 2) * tn, hs = span / 2 + ovE, drop = ovE * tn, T = o.snowT !== undefined ? o.snowT : 0.34;
  const L0 = -ovG, L1 = len + ovG, top = (z) => rise + tR - Math.abs(z) * tn, nl = hyp(hs, rise + drop), roofTint = o.tint || R.pick(PAL_ALP.roof);
  M.save();
  if (alongX) M.move(x0, y, (z0 + z1) / 2); else M.move((x0 + x1) / 2, y, z1).rotY(Math.PI / 2);
  for (const s of [1, -1]) {
    // couverture, sous-face, bandeau d'égout
    M.color(roofTint).world(1);
    M.quad(o.mat || 'slate', [L0, -drop + tR, s * hs], [L1, -drop + tR, s * hs], [L1, rise + tR, 0], [L0, rise + tR, 0], [0, hs / nl, s * (rise + drop) / nl]);
    M.color([0.58, 0.48, 0.38]).local(1);
    M.quad('boards', [L0, -drop, s * hs], [L1, -drop, s * hs], [L1, rise, 0], [L0, rise, 0], [0, -hs / nl, -s * (rise + drop) / nl]);
    M.color([0.45, 0.34, 0.25]);
    M.save().move(len / 2, -drop - 0.06, s * (hs + 0.02)); M.box('wood', L1 - L0 + 0.04, tR + 0.1, 0.05); M.restore();
    // chevrons apparents sous le débord d'égout
    M.cls = 1;
    const zc = (span / 2 + hs) / 2, Lr = (hs - span / 2) / Math.cos(pitch) + 0.05;
    for (let x = L0 + 0.35; x < L1 - 0.2; x += 0.72) { M.save().move(x, rise - zc * tn - 0.15, s * zc).rotX(s * pitch); M.box('wood', 0.1, 0.15, Lr); M.restore(); }
    M.cls = 0;
  }
  // pignons en planches, oculus sombre ; rives
  M.color(o.wood || [0.82, 0.74, 0.64]).world(1);
  for (const [xx, dir] of [[0, -1], [len, 1]]) {
    M.tri3(o.gable || 'boards', [xx, 0, -span / 2], [xx, 0, span / 2], [xx, rise, 0], [dir, 0, 0]);
    M.save().color([0.06, 0.06, 0.06]); M.quad('dark', [xx + dir * 0.01, rise * 0.45, -0.22], [xx + dir * 0.01, rise * 0.45, 0.22], [xx + dir * 0.01, rise * 0.45 + 0.5, 0.22], [xx + dir * 0.01, rise * 0.45 + 0.5, -0.22], [dir, 0, 0]); M.restore();
  }
  M.color([0.42, 0.32, 0.24]).local(1);
  for (const xx of [L0, L1]) for (const s of [1, -1]) {
    const dy = rise + drop, dz = -s * hs, L = hyp(dy, dz);
    // 2 cm sous la sous-face : M.box part de sa base, sa face basse était dans le plan des planches (z-fighting le long de chaque rive)
    M.save().move(xx, (rise - drop) / 2 + tR / 2 - 0.1, (s * hs) / 2).rotX(Math.atan2(-dy, dz)); M.box('wood', 0.06, 0.24, L); M.restore();
  }
  // cheminée de pierre, chapeau de béton, coussin de neige
  if (o.chimney) {
    const cx = len * R.range(0.25, 0.75), cz = (R() < 0.5 ? -1 : 1) * span * 0.14, cy = top(cz);
    M.color([0.85, 0.82, 0.78]).world(1); M.boxB('stone', cx - 0.32, cx + 0.32, cy - 0.6, cy + 1.1, cz - 0.32, cz + 0.32);
    M.color([0.75, 0.73, 0.7]).local(1); M.boxB('concrete', cx - 0.4, cx + 0.4, cy + 1.1, cy + 1.18, cz - 0.4, cz + 0.4, { bevel: 0.015 });
    M.color([1, 1, 1]); M.boxB('snowmat', cx - 0.38, cx + 0.38, cy + 1.18, cy + 1.32, cz - 0.38, cz + 0.38, { bevel: 0.06 });
    M.color([0.12, 0.11, 0.1]); M.boxB('dark', cx - 0.18, cx + 0.18, cy + 0.9, cy + 1.101, cz - 0.18, cz + 0.18);
  }
  // couche de neige : profil bombé, bourrelet qui déborde de l'égout, extrudé le long du faîtage
  if (T > 0) {
    const P = [[0, top(0) + T * 1.02]], side = (s) => {
      const pts = [[hs * 0.35, top(hs * 0.35) + T * 1.06], [hs * 0.75, top(hs * 0.75) + T], [hs - 0.04, top(hs) + T * 0.9], [hs + 0.11, top(hs) + T * 0.62], [hs + 0.17, top(hs) + T * 0.28],
        [hs + 0.13, top(hs) + 0.02], [hs + 0.02, top(hs) - 0.02], [hs - 0.1, top(hs - 0.1) - 0.01]];
      return pts.map(([z, yy]) => [s * z, yy]);
    };
    P.push(...side(1), [0, top(0) - 0.01], ...side(-1).reverse());
    M.save().color([1, 1, 1]).local(1).move(L0 - 0.06, 0, 0).mul(basis([0, 0, 1], [0, 1, 0], [1, 0, 0]).clone());
    M.extrude('snowmat', P, L1 - L0 + 0.12, { sharp: 1.0 });
    M.restore();
    // amas de neige bosselés sur les pans
    for (const s of [1, -1]) for (let k = 0; k < Math.max(1, Math.round(len / 4)); k++) {
      const zz = hs * R.range(0.25, 0.8), x = R.range(L0 + 0.8, L1 - 0.8);
      M.save().move(x, top(zz) + T * 0.75, s * zz).rotX(s * pitch); M.put(PF.snowMound(R.range(1.2, 2.2), R.range(0.8, 1.3), R.range(0.12, 0.22), 1 + Math.floor(R() * 6)), { cls: 1 }); M.restore();
    }
    // stalactites sous le bourrelet
    M.save().color([1, 1, 1]); M.cls = 2;
    for (const s of [1, -1]) for (let x = L0 + 0.15; x < L1 - 0.1; x += 0.1 + R() * 0.13) {
      if (R() < 0.3) continue;
      const L = 0.05 + Math.pow(R(), 2.3) * 0.65, r = 0.01 + L * 0.035;
      M.save().move(x, top(hs) + 0.03, s * (hs + 0.08)).rotX(Math.PI); M.cyl('ice', r, L, 5, { r1: 0.002, caps: '' }); M.restore();
    }
    M.restore();
  }
  M.occ(L0, L1, -drop, rise * 0.6, -hs, hs, 1);
  M.col(0, len, 0, rise * 0.5, -span / 2 + 0.3, span / 2 - 0.3, 'concrete');
  M.restore();
  return { rise, span, len, alongX };
}
/* Balcon de chalet (repère de façade) : plancher sur consoles, garde-corps de planches ajourées, main courante */
function chaletBalcony(M, x0, x1, y, dp, tint) {
  M.save().color(tint).local(1);
  M.boxB('boards', x0, x1, y - 0.12, y, 0, dp, { bevel: 0.015 });
  M.color([0.5, 0.38, 0.28]);
  for (const x of [x0 + 0.2, (x0 + x1) / 2, x1 - 0.2]) lbox(M, 'wood', x - 0.07, x + 0.07, y - 0.34, y - 0.12, 0, dp + 0.06);
  const top = y + 1.0;
  lbox(M, 'wood', x0, x1, top - 0.08, top, dp - 0.08, dp + 0.02);
  lbox(M, 'wood', x0, x1, y + 0.05, y + 0.12, dp - 0.06, dp);
  for (const x of [x0, x1]) { lbox(M, 'wood', x - 0.04, x + 0.04, top - 0.08, top, 0, dp); lbox(M, 'wood', x - 0.05, x + 0.05, y, top, dp - 0.07, dp + 0.01); }
  M.color(tint); M.cls = 1;
  for (let x = x0 + 0.12; x < x1 - 0.06; x += 0.15) lbox(M, 'boards', x - 0.055, x + 0.055, y + 0.12, top - 0.08, dp - 0.05, dp - 0.025);
  for (const x of [x0, x1]) for (let z = 0.12; z < dp - 0.1; z += 0.15) lbox(M, 'boards', x - 0.012, x + 0.012, y + 0.12, top - 0.08, z - 0.055, z + 0.055);
  M.restore();
  M.occ(x0, x1, y - 0.3, y, 0, dp, 0.8);
}
/* Petit auvent au-dessus d'une porte (repère de façade) : consoles, pan d'ardoise, neige */
function doorCanopy(M, xc, y, w) {
  M.save().color([0.45, 0.34, 0.25]).local(1);
  for (const x of [xc - w / 2 + 0.08, xc + w / 2 - 0.08]) M.tube('wood', 0.04, [[x, y - 0.45, 0], [x, y - 0.05, 0.75]], 4);
  M.save().move(xc, y, 0).rotX(0.32); M.color([0.62, 0.62, 0.66]); M.boxB('slate', -w / 2, w / 2, -0.04, 0.03, -0.05, 0.95); M.color([1, 1, 1]); M.boxB('snowmat', -w / 2 + 0.03, w / 2 - 0.03, 0.03, 0.17, 0.0, 0.92, { bevel: 0.06 }); M.restore();
  M.restore();
  M.occ(xc - w / 2, xc + w / 2, y - 0.2, y + 0.2, 0, 0.9, 0.8);
}
/* Façade de chalet : rez-de-chaussée de pierre ou enduit (fenêtres à volets, porte), étages en bardage de mélèze,
   angles en madriers croisés, balcon sur le pignon, jardinières, fenêtres parfois éclairées. o : voir chalet */
function chaletFace(face, x0, x1, z0, z1, o) {
  const F = facadeFrame(face, x0, x1, z0, z1), len = F.len, R = o.R, h = o.h, g0 = o.g0;
  const ops0 = [], ops1 = [], after = [], lit = () => R() < o.lit;
  const bays = Math.max(1, Math.round(len / (o.detailed ? 2.7 : 4.6))), bw = len / bays, mid = Math.floor(bays / 2);
  for (let i = 0; i < bays && !o.noGround; i++) {
    const a = bw * (i + 0.5);
    if (o.door && i === mid) {
      const op = { x0: a - 0.55, x1: a + 0.55, y0: 0, y1: 2.25, depth: 0.25 }; ops0.push(op);
      const tint = o.doorTint || R.pick(PAL_ALP.door);
      after.push((M) => { panelDoor(M, op, 0.25, tint, {}); casing(M, op, [0.42, 0.32, 0.24], 'wood', 0.1); doorCanopy(M, a, 2.75, 1.7); if (R() < 0.6) wallLamp(M, a + 0.85, 2.3); });
    } else if (o.detailed || R() < 0.45) {
      const op = { x0: a - 0.45, x1: a + 0.45, y0: 1.0, y1: 2.15, depth: 0.24 }; ops0.push(op);
      const L = lit(), st = R() < 0.2 ? 'closed' : 'open', gr = !o.stone && R() < 0.35;
      after.push((M) => { if (st !== 'closed') windowJoinery(M, op, 0.24, [0.92, 0.9, 0.86], { glass: L ? 'glassLit' : 'glass', curtain: R() < 0.4 ? R.pick(PAL.awning) : null }); sill(M, op, 'stone', [0.82, 0.8, 0.76]); shutters(M, op, o.shutter, st, R); if (gr) grille(M, op); });
    }
  }
  let first = true;
  for (let fy = g0 + 0.15; fy + 2.25 <= h - 0.05; fy += 2.8, first = false) {
    for (let i = 0; i < bays; i++) {
      if (!o.detailed && R() < 0.5) continue;
      const a = bw * (i + 0.5), french = o.balcony && first && i === mid;
      const op = french ? { x0: a - 0.5, x1: a + 0.5, y0: fy + 0.02, y1: fy + 2.1, depth: 0.2 } : { x0: a - 0.42, x1: a + 0.42, y0: fy + 0.8, y1: fy + 1.95, depth: 0.2 };
      ops1.push(op);
      const L = lit(), st = R() < 0.15 ? 'closed' : 'open', box = !french && !o.balcony && R() < 0.6;
      after.push((M) => {
        if (st !== 'closed' || french) windowJoinery(M, op, 0.2, [0.92, 0.9, 0.86], { glass: L ? 'glassLit' : 'glass', door: french });
        if (!french) shutters(M, op, o.shutter, st, R);
        if (box) { M.save().color([0.5, 0.36, 0.24]).local(1); lbox(M, 'boards', op.x0 - 0.06, op.x1 + 0.06, op.y0 - 0.26, op.y0 - 0.03, 0, 0.24); M.restore(); }
      });
    }
  }
  inFrame(F, (M) => {
    if (!o.noGround) {
      M.save().color(o.stone ? [0.9, 0.88, 0.85] : o.tint).world(1); M.aoFn = (x, y) => lerp(0.72, 1, smoothstep(0, 1.2, y));
      wallPierced(M, o.stone ? 'stone' : 'plaster', len, 0, g0, ops0, { depth: 0.24 });
      M.restore();
    }
    M.save().color(o.wood).world(1);
    wallPierced(M, 'boards', len, g0, h - g0, ops1, { depth: 0.2 });
    M.restore();
    // soubassement de pierre sous l'enduit
    if (!o.stone && !o.noGround) {
      let cur = 0; const pl = { mat: 'stone', h: 0.7, tint: [0.86, 0.84, 0.8] };
      for (const p of ops0.filter((q) => q.y0 < 0.5)) { if (p.x0 - cur > 0.05) plinthSeg(M, cur, p.x0, pl); cur = p.x1; }
      if (len - cur > 0.05) plinthSeg(M, cur, len, pl);
    }
    // sablière entre la maçonnerie et le bois, angles en madriers croisés
    M.save().color([0.5, 0.38, 0.28]).local(1); lbox(M, 'wood', -0.02, len + 0.02, g0 - 0.08, g0 + 0.14, 0.005, 0.1); M.restore(); // dos à 5 mm du mur : dans son plan, il scintillait sur la façade d'un chalet accolé
    M.save().color(o.wood).local(1); M.cls = 1;
    for (let y = g0 + 0.2; y < h - 0.15; y += 0.26) { lbox(M, 'boards', -0.22, 0.02, y, y + 0.2, -0.18, 0.05); lbox(M, 'boards', len - 0.02, len + 0.22, y, y + 0.2, -0.18, 0.05); }
    M.restore();
    for (const fn of after) fn(M);
    if (o.balcony) chaletBalcony(M, Math.max(0.5, len / 2 - 3.2), Math.min(len - 0.5, len / 2 + 3.2), g0 + 0.15, 1.15, o.wood);
    if (o.detailed && len > 5 && R() < 0.6 && !o.noGround) drainPipe(M, R() < 0.5 ? 0.35 : len - 0.35, h - 0.2);
    if (o.pile) { const L = Math.min(len - 1.2, 3.2); M.place(PF.woodpile(Math.round(L * 2) / 2, 1.3, 0.55), len / 2, 0, 0.3, 0, { nocol: !o.pileCol }); }
    if (o.detailed && !o.door && !o.noGround && R() < 0.35) { // affiche : entre deux fenêtres, au milieu du mur libre (les tirages restent ceux d'avant)
      const k = R() < 0.5 ? DEC2.poster : DEC2.poster2, u = posterSpot(len, ops0, 1.0, 1.8, 0.7, len * R.range(0.3, 0.7));
      if (u !== null && !o.noPoster) { M.save().color([1, 1, 1]); wallDecal2(M, k, u, 1.0, 0.7, 0.8); M.restore(); } // teinte neutre : celle du dernier élément posé (bois sombre) noircissait l'affiche ; noPoster : face cachée par un autre bâtiment (le fond de la scierie)
    }
  });
}
/* Chalet : bloc plein [x0, x1] x [z0, z1] (collision), façades détaillées sur les côtés de o.faces, toit alpin.
   o : h (hauteur à l'égout), g0 (hauteur du rez), ridge ('x' ou 'z'), faces, door (côté de la porte), balcony, stone,
   lit (part des fenêtres éclairées), tint, wood, shutter, roofMat, roofTint, pitch, chimney, pile (côté du bûcher),
   hollow (rez-de-chaussée praticable construit à part : collision et façades à partir de g0), noPoster (pas d'affiche : la façade est cachée par un autre bâtiment) */
function chalet(x0, x1, z0, z1, o = {}) {
  const R = rngOf(Math.round(x0 * 71 + z0 * 137 + (o.h || 6.6) * 13) + 4242);
  const h = o.h || 6.6, g0 = o.g0 || 3.0, alongX = o.ridge ? o.ridge === 'x' : x1 - x0 >= z1 - z0, faces = o.faces || 'nsew';
  const C = { R, h, g0, lit: o.lit !== undefined ? o.lit : 0.3, stone: o.stone !== undefined ? o.stone : R() < 0.4, tint: o.tint || R.pick(PAL_ALP.plaster), wood: o.wood || R.pick(PAL_ALP.wood), shutter: o.shutter || R.pick(PAL_ALP.shutter), doorTint: o.doorTint };
  DECOR.col(x0, x1, o.hollow ? g0 : 0, h, z0, z1, 'concrete');
  for (const f of 'nsew') {
    const gable = alongX ? f === 'e' || f === 'w' : f === 'n' || f === 's', det = faces.indexOf(f) >= 0;
    chaletFace(f, x0, x1, z0, z1, Object.assign({}, C, { detailed: det, door: o.door === f, balcony: det && gable && o.balcony !== false && h - g0 > 2.4, pile: o.pile === f, pileCol: o.pileCol, noGround: !!o.hollow, noPoster: !!o.noPoster }));
  }
  alpineRoof(x0, x1, z0, z1, h, { alongX, R, pitch: o.pitch, mat: o.roofMat, tint: o.roofTint, chimney: o.chimney !== undefined ? o.chimney : R() < 0.7, wood: C.wood, ovE: o.ovE, ovG: o.ovG });
}

/* ---------- Roche, falaise, montagnes ---------- */
/* Bloc de roche facetté (demi-axes rx, ry, rz) : sphère bosselée tranchée par des plans tirés au hasard ; posé sur y = 0 */
PF.boulder = (seed = 1, rx = 3, ry = 2.5, rz = 2.5) => prefab(`boulder${seed}_${rx}_${ry}_${rz}`, (M) => {
  const R = rngOf(seed * 113 + 9), P = [], ph = [R() * TAU, R() * TAU, R() * TAU];
  for (let i = 0; i < 9; i++) { const a = R() * TAU, b = Math.acos(R.range(-0.6, 1)); P.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a), R.range(0.62, 0.9)]); }
  const k = R.range(0.88, 1.04);
  M.save().color([k, k * 0.99, k * 0.97]).world(1).move(0, ry * 0.7, 0);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(-ry * 0.5, ry * 0.4, y));
  M.surf('rock', 16, 10, (u, v) => {
    const a = u * TAU, b = v * Math.PI, sb = Math.sin(b), dx = sb * Math.cos(a), dy = -Math.cos(b), dz = sb * Math.sin(a);
    let r = 1 + sb * (0.08 * Math.sin(3 * a + ph[0]) * Math.sin(2 * b + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]));
    for (const p of P) { const d = dx * p[0] + dy * p[1] + dz * p[2]; if (d > 0.05) r = Math.min(r, p[3] / d); }
    return [dx * r * rx, dy * r * ry, dz * r * rz];
  }, { closeU: true, flipN: true, pole: (v) => [0, v < 0.5 ? -1 : 1, 0], uL: TAU * Math.max(rx, rz), vL: Math.PI * ry });
  M.restore();
});
/* Paroi rocheuse le long de z (de za à zb), pied en x = xf, tournée vers +x (dir = 1) ou -x (dir = -1), hauteur H :
   fond continu bosselé, gros blocs facettés empilés devant (corniches et replats où la neige se pose), sapins en haut.
   Collision : la boîte pleine derrière xf (la paroi ne déborde jamais dans la zone de jeu). */
function rockWall(xf, za, zb, H, dir, seed, o = {}) { // o : skip(z, y) pour un bloc, clear(x, z) pour un sapin du replat, top
  const M = DECOR, R = rngOf(seed), N = makeNoise(seed + 7), L = zb - za;
  M.save().color([0.92, 0.92, 0.94]).world(1);
  M.surf('rock', Math.round(L / 1.5), 12, (u, v) => {
    const z = za + u * L, y = v * (H + 1), n = N.fbm(u * L * 0.05, v * 0.6, 64, 8, 4), st = Math.floor(y / 2.6) * 2.6;
    const back = 0.3 + y * 0.18 + n * 2.2 + smoothstep(st + 1.4, st + 2.4, y) * 0.5;
    return [xf - dir * back, y - 0.4, z];
  }, { uL: L, vL: H, flipN: dir > 0 });
  M.restore();
  // blocs : rangées du pied au sommet, de plus en plus en retrait
  for (let y = 0; y < H - 1; y += R.range(2.2, 3.4)) {
    for (let z = za + R.range(0, 3); z < zb - 1; z += R.range(3.5, 7)) {
      const rx = R.range(1.4, 2.8), ry = R.range(1.4, 2.6), rz = R.range(2, 4.2), back = 0.3 + y * 0.18 + rx * 0.55;
      if (o.skip && o.skip(z, y)) continue;
      M.place(PF.boulder(1 + Math.floor(R() * 12), Math.round(rx * 4) / 4, Math.round(ry * 4) / 4, Math.round(rz * 4) / 4), xf - dir * back, y - ry * 0.35, z, R() * TAU, { nocol: true });
    }
  }
  // replat sommital enneigé et sapins
  if (o.top !== false) {
    M.save().color([1, 1, 1]).world(1);
    M.surf('snowmat', 8, Math.round(L / 6), (u, v) => [xf - dir * (0.4 + H * 0.18 + 1.5 + u * 34), H + 0.3 + N.fbm(u * 3, v * 6, 64, 64, 3) * 1.2 - 0.6, za + v * L], { uL: 34, vL: L, flipN: dir < 0 });
    M.restore();
    for (let z = za + 2; z < zb - 2; z += R.range(3, 6)) {
      const x = xf - dir * (H * 0.18 + 3.5 + R() * 14), n = R.range(8, 13) | 0, k = 1 + Math.floor(R() * 6), r = R() * TAU; // tirages dans l'ordre d'avant
      if (!(o.clear && o.clear(x, z))) M.place(PF.spruce(n, k), x, H + 0.1, z, r, { nocol: true }); // o.clear : pas de sapin là (le pied d'une tour)
    }
  }
  if (dir > 0) WORLD.col({ x0: xf - 12, x1: xf, y0: 0, y1: H, z0: za, z1: zb }, 'concrete');
  else WORLD.col({ x0: xf, x1: xf + 12, y0: 0, y1: H, z0: za, z1: zb }, 'concrete');
}
/* Anneau de montagnes autour de la vallée (rayons r0 à r1, z étiré de k), roche que le shader enneige sur les pentes
   douces ; forêt de sapins lointains sur les bas versants. west : surélévation du côté -x (la vallée y est plus haute) */
function mountainRing(r0, r1, hmax, seed, o = {}) {
  const M = DECOR, N = makeNoise(seed), R = rngOf(seed + 1), k = o.k || 1.2, west = o.west || 0;
  const H = (u, v) => {
    const a = u * TAU, ridge = 1 - Math.abs(N.fbm(u, v * 0.6, 24, 4, 4) * 2 - 1), big = N.fbm(u, 0.5, 7, 1, 3);
    return hmax * Math.pow(smoothstep(0, 1, v), 1.3) * (0.3 + big * 0.95) * (0.5 + ridge * 0.65) + west * Math.pow(Math.max(0, -Math.cos(a)), 2) * smoothstep(0, 0.15, v);
  };
  const P = (u, v) => { const a = u * TAU, r = lerp(r0, r1, v); return [Math.cos(a) * r, H(u, v) - 1.5, Math.sin(a) * r * k]; };
  WORLD.force = 'far';
  M.save().color([0.95, 0.96, 1]).world(4); M.cls = 1;
  M.surf('rock', 150, 18, P, { closeU: true, uL: 1, vL: 1 });
  M.world(1); M.restore();
  for (let i = 0; i < (o.trees || 420); i++) {
    const u = R(), v = R.range(0.03, 0.42), p = P(u, v);
    if (p[1] > hmax * 0.5) continue;
    farTree(M, p[0], p[1], p[2], R.range(7, 13), R() * TAU);
  }
  WORLD.force = null;
}
/* Chalet lointain simplifié (vallée, versants) : volume enduit et boisé, toit enneigé sans détails */
function farChalet(cx, cz, w, d, h, rot, R) {
  const M = DECOR;
  M.save().move(cx, 0, cz).rotY(rot).color(R.pick(PAL_ALP.plaster)).world(1);
  M.boxB('plaster', -w / 2, w / 2, 0, h * 0.45, -d / 2, d / 2, { skip: 'y' });
  M.color(R.pick(PAL_ALP.wood)); M.boxB('boards', -w / 2, w / 2, h * 0.45, h, -d / 2, d / 2, { skip: 'y' });
  M.color([0.06, 0.06, 0.06]);
  for (let x = -w / 2 + 1.2; x < w / 2 - 0.8; x += 2.2) for (const y of [1.2, h * 0.45 + 1.0]) M.quad(R() < 0.3 ? 'glassLit' : 'dark', [x - 0.4, y, d / 2 + 0.02], [x + 0.4, y, d / 2 + 0.02], [x + 0.4, y + 1.0, d / 2 + 0.02], [x - 0.4, y + 1.0, d / 2 + 0.02], [0, 0, 1]);
  M.restore();
  M.save().move(cx, 0, cz).rotY(rot).move(-w / 2, 0, -d / 2);
  alpineRoofLocal(M, w, d, h, R);
  M.restore();
}
/* Toit enneigé simplifié dans le repère courant (bloc de 0 à w en x, 0 à d en z, égout à h), faîtage le long de x */
function alpineRoofLocal(M, w, d, h, R) {
  const pitch = 0.46, tn = Math.tan(pitch), ov = 0.9, hs = d / 2 + ov, rise = (d / 2) * tn, drop = ov * tn;
  M.save().move(0, h, d / 2);
  M.color(R.pick(PAL_ALP.wood)).world(1);
  for (const xx of [0, w]) M.tri3('boards', [xx, 0, -d / 2], [xx, 0, d / 2], [xx, rise, 0], [xx ? 1 : -1, 0, 0]);
  M.color([0.55, 0.45, 0.36]).local(1);
  for (const s of [1, -1]) M.quad('boards', [-ov, -drop, s * hs], [w + ov, -drop, s * hs], [w + ov, rise, 0], [-ov, rise, 0], [0, -1, 0]);
  const T = 0.4, P = [[0, rise + 0.16 + T], [hs + 0.12, -drop + 0.16 + T * 0.55], [hs + 0.12, -drop + 0.05], [0, rise + 0.12], [-hs - 0.12, -drop + 0.05], [-hs - 0.12, -drop + 0.16 + T * 0.55]];
  M.color([1, 1, 1]).move(-ov - 0.05, 0, 0).mul(basis([0, 0, 1], [0, 1, 0], [1, 0, 0]).clone());
  M.extrude('snowmat', P, w + ov * 2 + 0.1, { sharp: 0.9 });
  M.restore();
}

/* ---------- Chute de neige ---------- */
/* Flocons autour de la caméra (boîte de 36 x 16 x 36 m qui la suit), poussés par un vent qui tourne lentement ; cachés
   sous les toits et dans les pièces (part de ciel visible de l'éclairage cuit, lue dans le shader). */
const SNOWFALL = { obj: null, mat: null };
function makeSnowfall(k) {
  const n = Math.round(2400 * k), g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = rand(-18, 18); p[i * 3 + 1] = rand(-4, 12); p[i * 3 + 2] = rand(-18, 18); s[i] = rand(0.6, 1.5); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 540 }, tVol: WMU.tVol, uVolMin: WMU.uVolMin, uVolInv: WMU.uVolInv, uVolL: WMU.uVolL },
    vertexShader: `uniform float uScale; uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv; uniform vec4 uVolL;
      ${VOL_Q}
      attribute float aS; varying float vA;
      void main() {
        vec3 q = clamp((position - uVolMin) * uVolInv, 0.0, 1.0);
        float sky = texture(tVol, VOL_Q(q)).b; // ciel à la verticale : pas de flocons sous un toit
        vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        vA = smoothstep(0.32, 0.6, sky) * smoothstep(0.7, 2.2, d) * (1.0 - smoothstep(13.0, 19.0, d));
        gl_PointSize = clamp(0.024 * aS * uScale / max(d, 0.1), 1.0, 7.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.25, 1.0, r)) * vA * 0.8;
      if (a < 0.01) discard; gl_FragColor = vec4(0.94, 0.96, 1.0, a); }`,
    transparent: true, depthWrite: false,
  });
  const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 4; o.userData.weather = true; o.userData.noAO = true;
  SNOWFALL.obj = mapAdd(o); SNOWFALL.mat = m;
  if (FX) onResizeFx();
}
function updateSnowfall(dt, t) {
  const o = SNOWFALL.obj; if (!o) return;
  const p = o.geometry.attributes.position.array, c = camera.position, wx = 0.7 + Math.sin(t * 0.07) * 0.6, wz = 0.25 + Math.cos(t * 0.05) * 0.45;
  for (let i = 0, j = 0; i < p.length; i += 3, j++) {
    const k = j * 0.618;
    p[i] += (wx + Math.sin(t * 1.3 + k * 5.1) * 0.4) * dt;
    p[i + 1] -= (0.85 + (j % 9) * 0.07) * dt;
    p[i + 2] += (wz + Math.cos(t * 1.1 + k * 7.3) * 0.4) * dt;
    if (p[i] - c.x > 18) p[i] -= 36; else if (p[i] - c.x < -18) p[i] += 36;
    if (p[i + 2] - c.z > 18) p[i + 2] -= 36; else if (p[i + 2] - c.z < -18) p[i + 2] += 36;
    if (p[i + 1] - c.y < -4) p[i + 1] += 16; else if (p[i + 1] - c.y > 12) p[i + 1] -= 16;
  }
  o.geometry.attributes.position.needsUpdate = true;
}

/* ---------- Neige posée, lumières, bois ---------- */
/* Couche de neige bombée sur une surface plate (toit terrasse, dalle) : coussin bosselé aux bords arrondis, d'épaisseur T */
function snowCap(x0, x1, z0, z1, y, T = 0.3, seed = 1) {
  const M = DECOR, R = rngOf(seed * 41 + 3), ph = [R() * TAU, R() * TAU, R() * TAU], w = x1 - x0, d = z1 - z0;
  M.save().color([1, 1, 1]).local(1);
  M.surf('snowmat', Math.max(4, Math.round(w / 0.8)), Math.max(4, Math.round(d / 0.8)), (u, v) => {
    const ex = Math.min(u * w, (1 - u) * w), ez = Math.min(v * d, (1 - v) * d), e = smoothstep(0, 0.45, Math.min(ex, ez));
    const n = 1 + 0.15 * Math.sin(u * w * 0.9 + ph[0]) * Math.sin(v * d * 0.7 + ph[1]) + 0.08 * Math.sin((u * w + v * d) * 2.1 + ph[2]);
    return [x0 + u * w, y + T * Math.sqrt(e) * n - 0.02, z0 + v * d];
  }, { uL: w, vL: d, flipN: true });
  M.restore();
}
/* Petites pattes d'attache en métal aux deux bouts d'une ligne tendue (linge, guirlande) : le fil tient visiblement à quelque chose */
function lineHooks(a, b) {
  const M = DECOR; M.save().color([0.25, 0.25, 0.24]).local(1); M.cls = 2;
  for (const p of [a, b]) M.boxB('steel', p[0] - 0.035, p[0] + 0.035, p[1] - 0.04, p[1] + 0.04, p[2] - 0.035, p[2] + 0.035);
  M.restore();
}
/* Guirlande d'ampoules colorées entre deux points (fil qui pend de sag), menus détails */
function stringLights(a, b, sag, seed = 1) {
  LINES.push({ k: 'guirlande', a, b }); lineHooks(a, b);
  const M = DECOR, R = rngOf(seed), L = hyp3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(3, Math.round(L / 0.45));
  const C = [[2.6, 0.55, 0.3], [0.45, 2.0, 0.6], [2.6, 1.9, 0.5], [0.6, 1.0, 2.6]];
  M.save().color([0.08, 0.08, 0.08]); M.cls = 2;
  M.tube('rubber', 0.008, sagPath(a, b, sag, 14), 3);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag - 0.05, z = lerp(a[2], b[2], t);
    M.color(C[(i + seed) % 4]); M.save().move(x, y, z).scl(0.035, 0.05, 0.035); M.geo('bulb', G_SPH); M.restore();
  }
  M.restore();
}
/* Sapin de Noël décoré : épicéa, guirlande en spirale, boules et étoile */
PF.xmasTree = (h = 6, base = 0) => prefab('xmasTree' + h + (base ? '_' + base : ''), (M) => {
  M.put(PF.spruce(h, 3, base));
  const yb = base ? base - 0.2 : 0; // guirlande et boules depuis la première couronne
  const R = rngOf(h * 7), C = [[2.6, 0.55, 0.3], [2.6, 1.9, 0.5], [0.6, 1.0, 2.6], [2.4, 2.2, 1.6]];
  M.cls = 2;
  for (let i = 0; i < 70; i++) {
    const t = i / 70, y = Math.max(1.2, yb) + t * (h - 0.4 - Math.max(1.2, yb)), r = (h * 0.3) * Math.pow(1 - (y - 1) / h, 1.05) * 0.85 + 0.15, a = t * TAU * 5.5;
    M.color(C[i % 4]); M.save().move(Math.cos(a) * r, y - 0.25, Math.sin(a) * r).scl(0.045); M.geo('bulb', G_SPH); M.restore();
  }
  for (let i = 0; i < 26; i++) {
    const y = Math.max(1.3, yb) + R() * (h - 0.7 - Math.max(1.3, yb)), r = (h * 0.3) * Math.pow(1 - (y - 1) / h, 1.05) * 0.8, a = R() * TAU;
    M.color(R.pick([[0.75, 0.1, 0.08], [0.85, 0.65, 0.15], [0.15, 0.25, 0.6]])); M.save().move(Math.cos(a) * r, y - 0.35, Math.sin(a) * r).scl(0.09); M.geo('carpaint', G_SPH); M.restore();
  }
  M.color([2.8, 2.3, 0.9]); M.save().move(0, h + 0.4, 0).scl(0.14, 0.2, 0.05); M.geo('bulb', new THREE.OctahedronGeometry(1, 0)); M.restore();
});
/* Pile de grumes en pyramide (rangs de n, n-1... rondins de rayon r, longueur L le long de z), avec sa collision */
function logPile(x, z, L, n, r, seed = 1) {
  const M = DECOR, R = rngOf(seed * 19 + 5);
  M.save().local(1);
  let y = r, cnt = n;
  while (cnt > 0) {
    for (let i = 0; i < cnt; i++) {
      const xx = x + (i - (cnt - 1) / 2) * r * 2.02, rr = r * R.range(0.88, 1.06), len = L * R.range(0.92, 1), dz = R.range(-0.25, 0.25);
      const k = R.range(0.8, 1); M.color([k, k * R.range(0.94, 1), k * R.range(0.88, 0.98)]); // même teinte chaude pour toutes, seule la clarté varie (des canaux tirés au hasard donnaient des rondins rosés ou bleutés)
      M.save().move(xx, y, z - len / 2 + dz).rotX(Math.PI / 2).rotY(R() * TAU); M.cyl('bark', rr, len, 10, { caps: '' }); M.restore();
      for (const s of [-1, 1]) { M.save().move(xx, y, z + dz + s * len / 2).rotX(s * Math.PI / 2); M.cyl('logend', rr, 0.0005, 10, { caps: 't', side: false }); M.restore(); }
    }
    y += r * 1.72; cnt--;
  }
  M.color([0.3, 0.26, 0.22]);
  for (const s of [-1, 1]) for (const dz of [-L * 0.3, L * 0.3]) M.boxB('wood', x + s * (n * r + 0.05) - 0.06, x + s * (n * r + 0.05) + 0.06, 0, r * 2.4, z + dz - 0.06, z + dz + 0.06);
  M.restore();
  WORLD.col({ x0: x - n * r, x1: x + n * r, y0: 0, y1: r * 1.6, z0: z - L / 2, z1: z + L / 2 }, 'wood');
  if (n > 1) WORLD.col({ x0: x - (n - 1) * r, x1: x + (n - 1) * r, y0: r * 1.6, y1: r * (1 + 1.72 * (n - 1)) + r * 0.6, z0: z - L / 2, z1: z + L / 2 }, 'wood');
}
/* Pile de planches sciées, lits séparés par des liteaux, longueur L le long de z */
PF.plankStack = (L = 4, W = 1.2, H = 1.2) => prefab(`plankStack${L}_${W}_${H}`, (M) => {
  const R = rngOf(Math.round(L * 10 + H * 7)), n = Math.round(H / 0.09);
  M.local(1);
  for (let j = 0; j < n; j++) {
    const y = j * 0.09;
    if (j % 3 === 0) { M.color([0.4, 0.32, 0.24]); for (const dz of [-L * 0.4, 0, L * 0.4]) M.boxB('wood', -W / 2, W / 2, y, y + 0.03, dz - 0.03, dz + 0.03); continue; }
    M.color([R.range(0.85, 1), R.range(0.8, 0.95), R.range(0.75, 0.88)]);
    for (let x = -W / 2; x < W / 2 - 0.05; x += 0.2) M.boxB('crate', x + 0.005, x + 0.195, y, y + 0.06, -L / 2 + R.range(0, 0.15), L / 2 - R.range(0, 0.15));
  }
  M.col(-W / 2, W / 2, 0, n * 0.09, -L / 2, L / 2, 'wood');
});
/* Botte de foin rectangulaire (petite botte, d'après photos) : tranches pressées qui se décalent un peu, deux ficelles qui en font le tour,
   brins qui dépassent des bouts. Mêmes dimensions et même collision qu'avant (0,9 x 0,45 x 0,5 m) */
PF.hayBale = () => prefab('hayBale', (M) => {
  M.color([0.86, 0.74, 0.46]).local(1);
  const R = rngOf(917), n = 8;
  for (let k = 0; k < n; k++) { const x0 = lerp(-0.45, 0.45, k / n), x1 = lerp(-0.45, 0.45, (k + 1) / n), e = R.range(-0.006, 0.006); M.color([0.86 + e * 6, 0.74 + e * 6, 0.46]); M.boxB('burlap', x0, x1, 0, 0.45 + e, -0.25 - e, 0.25 + e, { bevel: 0.012 }); }
  M.color([0.55, 0.45, 0.3]); M.cls = 1;
  for (const x of [-0.2, 0.2]) M.boxB('plastic', x - 0.01, x + 0.01, -0.002, 0.468, -0.268, 0.268); // 8 mm au-dessus de la botte (à 2 mm, la ficelle scintillait de loin)
  M.color([0.82, 0.7, 0.42]); M.cls = 2;
  for (const sd of [-1, 1]) for (let k = 0; k < 7; k++) { const y = R.range(0.05, 0.4), z = R.range(-0.2, 0.2), a = R.range(-0.6, 0.6); M.save().move(sd * 0.452, y, z).rotX(a); M.quad('burlap', [0, -0.004, 0], [0, 0.004, 0], [sd * 0.07, 0.004, 0.01], [sd * 0.07, -0.004, 0.01], [0, 1, 0]); M.restore(); }
  M.cls = 0;
  M.col(-0.45, 0.45, 0, 0.45, -0.25, 0.25, 'dirt');
});
