/* ==========================================================================
   LABORATOIRE DE TEXTURES : surfaces PBR procédurales calculées sur la carte graphique au chargement.
   Chaque surface est une fonction GLSL surf(uv, albédo, relief, rugosité, canal alpha) sur une tuile
   raccordable (uv de 0 à 1, bruits périodiques). Trois passes par surface : relief (flottant), couleur
   (sRGB, alpha = relief ou masque de métal ou opacité), puis normales + rugosité (alpha). Rien n'est
   téléchargé : quelques millisecondes de GPU remplacent des mégaoctets d'images.
   Convention des textures du décor (voir worldMat) : map.rgb = albédo, map.a = relief (ou métal, ou
   opacité selon la surface) ; normalMap.rgb = normale, normalMap.a = rugosité.
   ========================================================================== */
const TEXLAB_LIB = `
precision highp float; precision highp int;
uniform float uSeed; uniform vec2 uRes;
uint _hu(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v.x ^ v.y ^ v.z; }
float hs(vec2 i, float k) { return float(_hu(uvec3(uint(i.x + 8192.0), uint(i.y + 8192.0), uint(uSeed * 97.0 + k * 131.0 + 7.0)))) * (1.0 / 4294967295.0); }
vec2 hs2(vec2 i, float k) { return vec2(hs(i, k), hs(i, k + 17.0)); }
vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
/* bruit de valeur périodique : p en cellules, per : période (cellules) */
float vn(vec2 p, vec2 per, float k) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f), i0 = mod(i, per), i1 = mod(i + 1.0, per);
  return mix(mix(hs(i0, k), hs(vec2(i1.x, i0.y), k), u.x), mix(hs(vec2(i0.x, i1.y), k), hs(i1, k), u.x), u.y);
}
/* bruit de gradient périodique, environ -1 à 1 */
float gn(vec2 p, vec2 per, float k) {
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i0 = mod(i, per), i1 = mod(i + 1.0, per);
  float a0 = hs(i0, k) * 6.2831853, a1 = hs(vec2(i1.x, i0.y), k) * 6.2831853, a2 = hs(vec2(i0.x, i1.y), k) * 6.2831853, a3 = hs(i1, k) * 6.2831853;
  float v0 = dot(vec2(cos(a0), sin(a0)), f), v1 = dot(vec2(cos(a1), sin(a1)), f - vec2(1.0, 0.0));
  float v2 = dot(vec2(cos(a2), sin(a2)), f - vec2(0.0, 1.0)), v3 = dot(vec2(cos(a3), sin(a3)), f - vec2(1.0));
  return mix(mix(v0, v1, u.x), mix(v2, v3, u.x), u.y) * 1.414;
}
/* fbm périodique sur la tuile : f0 = fréquence de base (entière), oct octaves ; résultat 0 à 1 */
float fbm(vec2 uv, vec2 f0, int oct, float k) {
  float s = 0.0, a = 0.5, t = 0.0; vec2 f = f0;
  for (int o = 0; o < 8; o++) { if (o >= oct) break; s += a * vn(uv * f, f, k + float(o) * 3.0); t += a; a *= 0.5; f *= 2.0; }
  return s / t;
}
float gfbm(vec2 uv, vec2 f0, int oct, float k) {
  float s = 0.0, a = 0.5, t = 0.0; vec2 f = f0;
  for (int o = 0; o < 8; o++) { if (o >= oct) break; s += a * gn(uv * f, f, k + float(o) * 3.0); t += a; a *= 0.5; f *= 2.0; }
  return s / t * 0.5 + 0.5;
}
/* crêtes (fissures, veines) : 1 sur les crêtes */
float ridge(vec2 uv, vec2 f0, int oct, float k) { return 1.0 - abs(gfbm(uv, f0, oct, k) * 2.0 - 1.0); }
/* Voronoï périodique : x = distance au germe le plus proche, y = au second, z = identifiant de la cellule (0 à 1),
   w = distance au bord de la cellule */
vec4 vor(vec2 uv, vec2 cells, float k, float jit) {
  vec2 p = uv * cells, i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, id = 0.0; vec2 m1 = vec2(0.0), c1 = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), c = mod(i + g, cells), o = 0.5 + (hs2(c, k) - 0.5) * jit, r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hs(c, k + 5.0); m1 = r; c1 = g; } else if (d < d2) d2 = d;
  }
  float be = 9.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 g = c1 + vec2(float(x), float(y)), c = mod(i + g, cells), o = 0.5 + (hs2(c, k) - 0.5) * jit, r = g + o - f;
    if (dot(m1 - r, m1 - r) > 1e-5) be = min(be, dot(0.5 * (m1 + r), normalize(r - m1)));
  }
  return vec4(sqrt(d1), sqrt(d2), id, be);
}
/* grille de briques / planches : x, y = position dans l'élément (0 à 1), z = identifiant, w = distance au bord (en fraction) */
vec4 tiles(vec2 uv, vec2 n, float stagger) {
  vec2 p = uv * n; float row = floor(p.y); p.x += mod(row, 2.0) * stagger;
  vec2 i = floor(p), f = fract(p);
  return vec4(f, hs(vec2(mod(i.x, n.x), mod(i.y, n.y)), 11.0), min(min(f.x, 1.0 - f.x) * n.y / n.x, min(f.y, 1.0 - f.y)));
}
`;

/* Surfaces : [taille (px), graine, relief (force des normales), code GLSL de surf] */
const TEXLAB = {
  /* sable rouge du désert : rides de vent, grains, gravillons */
  sand: [1024, 3, 1.1, `
    float w = gfbm(uv, vec2(3.0), 4, 1.0);
    float rp = sin((uv.y * 22.0 + uv.x * 4.0 + w * 3.0) * 6.2831853) * 0.5 + 0.5; rp = rp * rp;
    float rm = smoothstep(0.45, 0.8, gfbm(uv + 0.31, vec2(2.0), 3, 2.0));
    float big = gfbm(uv, vec2(4.0), 5, 4.0), mid = gfbm(uv, vec2(24.0), 3, 6.0), gr = vn(uv * 384.0, vec2(384.0), 3.0);
    vec4 v = vor(uv, vec2(64.0), 5.0, 1.0);
    float peb = (1.0 - smoothstep(0.06, 0.16, v.x)) * step(0.9, v.z);
    h = rp * rm * 0.3 + big * 0.3 + mid * 0.15 + gr * 0.12 + peb * 0.35;
    vec3 c0 = srgb(vec3(0.78, 0.65, 0.5)), c1 = srgb(vec3(0.85, 0.75, 0.62)), c2 = srgb(vec3(0.7, 0.57, 0.44));
    a = mix(c2, c1, smoothstep(0.25, 0.75, big)); a = mix(a, c0, rp * rm * 0.3); a *= 0.9 + gr * 0.18 + (mid - 0.5) * 0.2;
    a = mix(a, srgb(vec3(0.6, 0.52, 0.44)) * (0.8 + v.z * 0.4), peb * 0.6);
    r = 0.94 - peb * 0.15 + gr * 0.04; x = h;`],
  /* terre battue : taches, fissures fines, cailloux */
  dirt: [512, 5, 2.5, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(16.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec4 cr = vor(uv, vec2(7.0), 4.0, 1.0); float crack = (1.0 - smoothstep(0.0, 0.035, cr.w)) * smoothstep(0.45, 0.7, gfbm(uv, vec2(4.0), 3, 9.0));
    vec4 st = vor(uv, vec2(26.0), 6.0, 1.0); float stn = (1.0 - smoothstep(0.1, 0.3, st.x)) * step(0.72, st.z);
    h = big * 0.4 + mid * 0.25 + gr * 0.1 - crack * 0.4 + stn * 0.45;
    a = mix(srgb(vec3(0.46, 0.34, 0.24)), srgb(vec3(0.66, 0.51, 0.37)), smoothstep(0.2, 0.8, big)) * (0.88 + mid * 0.2 + gr * 0.12);
    a *= 1.0 - crack * 0.45; a = mix(a, srgb(vec3(0.52, 0.48, 0.43)) * (0.7 + st.z * 0.5), stn);
    r = 0.95 - stn * 0.12; x = h;`],
  /* béton coulé : pores, nuages, reprises de coffrage */
  concrete: [512, 7, 1.6, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(12.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec4 po = vor(uv, vec2(128.0), 4.0, 1.0); float pore = (1.0 - smoothstep(0.04, 0.12, po.x)) * step(0.78, po.z) * 0.6;
    float seam = 1.0 - smoothstep(0.0, 0.006, abs(fract(uv.y * 2.0) - 0.5) - 0.494);
    h = mid * 0.3 + gr * 0.15 - pore * 0.5 - seam * 0.15;
    a = srgb(vec3(0.66, 0.64, 0.6)) * (0.82 + big * 0.25 + mid * 0.1 + gr * 0.08);
    a *= 1.0 - pore * 0.35 - seam * 0.1; a = mix(a, a * vec3(1.03, 0.98, 0.9), smoothstep(0.5, 0.8, big));
    r = 0.88 - mid * 0.08; x = h;`],
  /* tôle ondulée galvanisée : ondes, paillettes de zinc, coulures de rouille */
  corrugated: [512, 9, 3.0, `
    float wv = sin(uv.x * 26.0 * 6.2831853) * 0.5 + 0.5;
    float big = gfbm(uv, vec2(3.0), 4, 1.0), sp = vor(uv, vec2(40.0, 40.0), 3.0, 1.0).z;
    float st = gfbm(vec2(uv.x, uv.y * 0.25), vec2(40.0, 1.0), 4, 2.0);
    float rust = smoothstep(0.7, 0.86, st + (1.0 - uv.y) * 0.06 + big * 0.15) + smoothstep(0.76, 0.88, gfbm(uv, vec2(6.0), 5, 5.0));
    rust = clamp(rust, 0.0, 1.0);
    h = wv * 0.8 + rust * 0.1;
    vec3 zinc = srgb(vec3(0.66, 0.65, 0.62)) * (0.85 + sp * 0.2 + big * 0.1);
    vec3 rc = mix(srgb(vec3(0.42, 0.2, 0.1)), srgb(vec3(0.62, 0.34, 0.16)), gfbm(uv, vec2(32.0), 3, 8.0));
    a = mix(zinc, rc, rust); a *= 0.85 + wv * 0.15;
    r = mix(0.42 + sp * 0.15, 0.9, rust); x = mix(0.85, 0.1, rust);`],
  /* tôle peinte (teintée par les sommets) : fines écaillures, rayures, coulures de rouille, crasse */
  paint: [512, 11, 1.6, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(14.0), 3, 2.0);
    float chip = smoothstep(0.79, 0.81, gfbm(uv, vec2(20.0), 4, 3.0) + (big - 0.5) * 0.12);
    float sc = smoothstep(0.94, 0.99, ridge(vec2(uv.x * 0.5 + uv.y, uv.y), vec2(3.0, 24.0), 3, 7.0)) * step(0.62, gfbm(uv, vec2(5.0), 3, 8.0));
    float st = gfbm(vec2(uv.x, uv.y * 0.2), vec2(24.0, 1.0), 4, 9.0);
    float rust = smoothstep(0.7, 0.84, st + (1.0 - uv.y) * 0.05) * 0.5;
    float grime = smoothstep(0.4, 0.9, gfbm(vec2(uv.x, uv.y * 0.3), vec2(12.0, 2.0), 4, 9.0)) * 0.35;
    h = -chip * 0.25 + mid * 0.04 - sc * 0.15;
    a = vec3(0.84) * (0.93 + big * 0.08) * (1.0 - grime * 0.3);
    a = mix(a, srgb(vec3(0.55, 0.36, 0.22)), rust * 0.45);
    a = mix(a, srgb(vec3(0.5, 0.42, 0.36)), chip * 0.7); a = mix(a, vec3(0.62), sc * 0.4);
    r = mix(0.42 + big * 0.1 + grime * 0.3, 0.8, max(chip, rust)); x = sc * 0.8 + chip * 0.3;`],
  /* peinture de carrosserie (teintée) : vernis lisse et brillant (5.1, le ciel s'y reflète), rares voiles de poussière, micro-rayures */
  carpaint: [512, 47, 0.4, `
    float big = gfbm(uv, vec2(2.0), 4, 1.0), peel = gfbm(uv, vec2(48.0), 2, 2.0);
    float dust = smoothstep(0.6, 0.95, gfbm(uv, vec2(4.0), 5, 3.0) + (1.0 - uv.y) * 0.1);
    float sc = smoothstep(0.96, 0.995, ridge(vec2(uv.x + uv.y * 0.3, uv.y), vec2(6.0, 18.0), 3, 5.0)) * step(0.55, big);
    h = peel * 0.012 - sc * 0.015; // (vernis presque lisse : un relief plus fort scintille sous le soleil)
    a = vec3(0.86) * (0.96 + big * 0.05); a = mix(a, srgb(vec3(0.72, 0.62, 0.5)), dust * 0.35); a = mix(a, vec3(0.9), sc * 0.15);
    r = mix(0.07, 0.6, dust) + sc * 0.05; x = 1.0 - dust * 0.8;`],
  /* treillis de moucharabieh (bois tourné) : alpha = opacité */
  lattice: [256, 49, 1.4, `
    vec2 p = fract(uv * 8.0) - 0.5; float d = min(abs(p.x), abs(p.y)), dd = abs(abs(p.x) - abs(p.y));
    float bar = 1.0 - smoothstep(0.06, 0.09, d), dia = 1.0 - smoothstep(0.05, 0.08, dd) * step(length(p), 0.42);
    float knob = 1.0 - smoothstep(0.1, 0.13, length(p));
    float solid = max(max(bar, dia * 0.0), knob);
    float grain = gfbm(uv, vec2(4.0, 32.0), 4, 2.0);
    h = solid * (0.6 + knob * 0.3); a = srgb(vec3(0.42, 0.28, 0.18)) * (0.8 + grain * 0.3);
    r = 0.8; x = solid;`],
  /* carton ondulé : fibres, ruban adhésif, taches */
  cardboard: [256, 45, 0.8, `
    float fib = vn(uv * vec2(256.0, 40.0), vec2(256.0, 40.0), 1.0), big = gfbm(uv, vec2(3.0), 4, 2.0);
    float stain = smoothstep(0.6, 0.8, gfbm(uv, vec2(4.0), 5, 3.0));
    float flute = sin(uv.x * 110.0 * 6.2831853) * 0.5 + 0.5;
    h = flute * 0.15 + fib * 0.1;
    a = srgb(vec3(0.72, 0.56, 0.38)) * (0.88 + fib * 0.1 + big * 0.1) * (1.0 - stain * 0.2);
    r = 0.92; x = h;`],
  /* acier brossé ou galvanisé */
  steel: [512, 13, 0.8, `
    float br = vn(vec2(uv.x * 512.0, uv.y * 6.0), vec2(512.0, 6.0), 1.0), big = gfbm(uv, vec2(3.0), 4, 2.0);
    float spot = smoothstep(0.7, 0.85, gfbm(uv, vec2(8.0), 5, 3.0));
    h = br * 0.2; a = vec3(0.56, 0.57, 0.58) * (0.85 + br * 0.15 + big * 0.12) * (1.0 - spot * 0.3);
    r = 0.34 + br * 0.1 + spot * 0.3 + big * 0.1; x = 1.0 - spot * 0.6;`],
  /* métal brûlé et rouillé (épaves) */
  charred: [512, 15, 2.2, `
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(16.0), 4, 2.0), fl = vor(uv, vec2(18.0), 5.0, 1.0).w;
    float rust = smoothstep(0.4, 0.75, big + mid * 0.3);
    h = mid * 0.4 + smoothstep(0.0, 0.08, fl) * 0.2;
    vec3 soot = srgb(vec3(0.12, 0.11, 0.1)) * (0.7 + mid * 0.6), rc = mix(srgb(vec3(0.36, 0.17, 0.08)), srgb(vec3(0.58, 0.3, 0.13)), mid);
    a = mix(soot, rc, rust) * (0.85 + smoothstep(0.0, 0.1, fl) * 0.2);
    r = mix(0.8, 0.95, rust); x = 0.15;`],
  /* carreaux de ciment du souk : motif à quatre lobes, émail usé, joints */
  cement_tiles: [1024, 17, 1.5, `
    vec2 p = uv * 8.0, i = floor(p), f = fract(p) - 0.5;
    float g = min(0.5 - abs(f.x), 0.5 - abs(f.y)), joint = 1.0 - smoothstep(0.006, 0.014, g);
    vec2 q = abs(f); float rr = length(f), ang = atan(f.y, f.x);
    float petal = 1.0 - smoothstep(0.0, 0.012, rr - 0.2 - 0.09 * cos(ang * 4.0));
    float petalIn = 1.0 - smoothstep(0.0, 0.012, rr - 0.12 - 0.05 * cos(ang * 4.0));
    float disc = 1.0 - smoothstep(0.0, 0.01, rr - 0.055);
    float corner = 1.0 - smoothstep(0.0, 0.01, length(q - 0.5) - 0.17), cornerIn = 1.0 - smoothstep(0.0, 0.01, length(q - 0.5) - 0.1);
    float border = smoothstep(0.428, 0.432, max(q.x, q.y)) * (1.0 - smoothstep(0.462, 0.466, max(q.x, q.y)));
    vec3 cream = srgb(vec3(0.86, 0.81, 0.7)), blue = srgb(vec3(0.16, 0.3, 0.44)), ochre = srgb(vec3(0.74, 0.52, 0.26)), red = srgb(vec3(0.56, 0.2, 0.15));
    vec3 c = cream; c = mix(c, ochre, petal); c = mix(c, cream, petalIn); c = mix(c, red, disc);
    c = mix(c, blue, corner); c = mix(c, cream, cornerIn * 0.85); c = mix(c, blue, border * (1.0 - corner));
    float wear = smoothstep(0.55, 0.8, gfbm(uv, vec2(6.0), 5, 3.0)), dirt = gfbm(uv, vec2(3.0), 4, 4.0);
    float tv = hs(mod(i, 8.0), 2.0);
    a = mix(c, c * 0.75 + srgb(vec3(0.5, 0.45, 0.38)) * 0.2, wear) * (0.88 + tv * 0.14) * (0.85 + dirt * 0.2);
    a = mix(a, srgb(vec3(0.3, 0.28, 0.25)), joint);
    h = (1.0 - joint) * 0.6 - wear * 0.05; r = mix(mix(0.32, 0.7, wear), 0.95, joint); x = h;`],
  /* toile d'auvent (teintée) : tissage, plis, salissures */
  canvas: [512, 19, 1.2, `
    float wx = sin(uv.x * 220.0 * 6.2831853) * 0.5 + 0.5, wy = sin(uv.y * 220.0 * 6.2831853) * 0.5 + 0.5;
    float weave = mix(wx, wy, step(0.5, fract(uv.x * 110.0 + floor(uv.y * 220.0) * 0.5)));
    float big = gfbm(uv, vec2(3.0), 4, 1.0), fold = gfbm(vec2(uv.x, uv.y * 0.2), vec2(8.0, 1.0), 3, 2.0);
    float stain = smoothstep(0.62, 0.85, gfbm(uv, vec2(5.0), 5, 3.0));
    h = weave * 0.25 + fold * 0.5;
    a = vec3(0.86, 0.84, 0.8) * (0.85 + weave * 0.1 + big * 0.12) * (1.0 - stain * 0.3) * (0.9 + fold * 0.15);
    r = 0.9; x = h;`],
  /* toile de jute des sacs de sable */
  burlap: [512, 21, 2.4, `
    vec2 p = uv * vec2(96.0);
    float tx = sin(p.x * 6.2831853) * 0.5 + 0.5, ty = sin(p.y * 6.2831853) * 0.5 + 0.5;
    float over = step(0.5, fract((floor(p.x) + floor(p.y)) * 0.5));
    float weave = mix(tx * (0.6 + 0.4 * ty), ty * (0.6 + 0.4 * tx), over);
    float fib = vn(uv * vec2(512.0, 64.0), vec2(512.0, 64.0), 2.0), big = gfbm(uv, vec2(3.0), 4, 3.0);
    float dirt = smoothstep(0.5, 0.85, gfbm(uv, vec2(4.0), 5, 4.0));
    h = weave * 0.7 + fib * 0.15;
    a = srgb(vec3(0.66, 0.56, 0.4)) * (0.72 + weave * 0.35 + fib * 0.1) * (0.9 + big * 0.15);
    a = mix(a, srgb(vec3(0.45, 0.36, 0.26)), dirt * 0.5);
    r = 0.97; x = h;`],
  /* caoutchouc de pneu : sculptures en blocs */
  rubber: [256, 23, 2.0, `
    vec4 t = tiles(uv, vec2(4.0, 8.0), 0.5);
    float groove = 1.0 - smoothstep(0.04, 0.09, t.w), mid = gfbm(uv, vec2(8.0), 4, 2.0);
    h = (1.0 - groove) * 0.8 + mid * 0.1;
    a = srgb(vec3(0.075, 0.072, 0.07)) * (0.85 + mid * 0.3) * (1.0 - groove * 0.4) + srgb(vec3(0.25, 0.2, 0.15)) * smoothstep(0.6, 0.9, mid) * 0.15;
    r = 0.88 + groove * 0.08; x = h;`],
  /* planches de caisse (pin) : fil du bois, clous, jointures */
  crate: [512, 25, 2.0, `
    float n = 4.0; float pv = uv.y * n, pi = floor(pv), fv = fract(pv);
    float gap = 1.0 - smoothstep(0.015, 0.04, min(fv, 1.0 - fv));
    float id = hs(vec2(pi, 3.0), 1.0);
    float grain = gfbm(vec2(uv.x, uv.y + id), vec2(2.0, 48.0), 5, 2.0 + id);
    float ring = sin((grain * 10.0 + uv.x * 3.0 + id * 5.0) * 6.2831853) * 0.5 + 0.5;
    float knot = smoothstep(0.1, 0.0, length((vec2(fract(uv.x * 2.0 + id), fv) - vec2(0.5)) * vec2(1.0, 2.5)) - 0.05) * step(0.6, id);
    vec2 nl = vec2(fract(uv.x * 2.0) - 0.06, fv - 0.5); float nail = smoothstep(0.012, 0.006, length(nl * vec2(1.0, 0.25))) + smoothstep(0.012, 0.006, length((vec2(fract(uv.x * 2.0) - 0.94, fv - 0.5)) * vec2(1.0, 0.25)));
    float dirt = gfbm(uv, vec2(3.0), 4, 5.0);
    h = (1.0 - gap) * (0.6 + ring * 0.12) - knot * 0.1;
    a = srgb(mix(vec3(0.62, 0.47, 0.3), vec3(0.8, 0.66, 0.46), id * 0.6 + ring * 0.3)) * (0.82 + grain * 0.25) * (0.85 + dirt * 0.25);
    a = mix(a, srgb(vec3(0.38, 0.26, 0.15)), knot * 0.8); a = mix(a, srgb(vec3(0.12, 0.09, 0.06)), gap); a = mix(a, vec3(0.08), clamp(nail, 0.0, 1.0));
    r = 0.82 + gap * 0.15 - nail * 0.3; x = h;`],
  /* plastique moulé (teinté) */
  plastic: [256, 27, 0.6, `
    float big = gfbm(uv, vec2(3.0), 4, 1.0), sc = smoothstep(0.9, 0.98, ridge(uv, vec2(6.0), 3, 5.0));
    h = sc * -0.2; a = vec3(0.8) * (0.93 + big * 0.1) * (1.0 - sc * 0.15); r = 0.42 + big * 0.12 + sc * 0.2; x = 0.0;`],
  /* verre de fenêtre sale */
  glass: [256, 29, 0.3, `
    float big = gfbm(uv, vec2(2.0), 4, 1.0), st = gfbm(vec2(uv.x, uv.y * 0.15), vec2(16.0, 1.0), 4, 2.0);
    float dirt = smoothstep(0.45, 0.8, big * 0.6 + st * 0.5 + (1.0 - uv.y) * 0.15);
    h = 0.0; a = mix(vec3(0.03, 0.035, 0.04), srgb(vec3(0.42, 0.36, 0.3)), dirt * 0.5);
    r = mix(0.05, 0.55, dirt); x = 1.0 - dirt * 0.7;`],
  /* gravier de toit terrasse */
  gravel: [512, 31, 3.0, `
    vec4 v = vor(uv, vec2(36.0), 1.0, 1.0), v2 = vor(uv + 0.5, vec2(58.0), 2.0, 1.0);
    float st = smoothstep(0.0, 0.18, v.w), st2 = smoothstep(0.0, 0.14, v2.w);
    h = max(st * (0.6 + v.z * 0.4), st2 * 0.7);
    vec3 c = mix(srgb(vec3(0.55, 0.52, 0.48)), srgb(vec3(0.75, 0.7, 0.62)), v.z) * (0.75 + st * 0.3);
    a = mix(srgb(vec3(0.26, 0.24, 0.21)), c, max(st, st2 * 0.8)); r = 0.9; x = h;`],
  /* façade lointaine : une travée d'un étage (fenêtre, volets, bandeau) pour les silhouettes d'arrière-plan */
  farfacade: [512, 33, 1.5, `
    vec2 p = uv; float big = gfbm(uv, vec2(2.0), 4, 1.0);
    float win = step(abs(p.x - 0.5), 0.17) * step(abs(p.y - 0.5), 0.24);
    float frame = step(abs(p.x - 0.5), 0.2) * step(abs(p.y - 0.5), 0.27) * (1.0 - win);
    float sh = step(abs(abs(p.x - 0.5) - 0.28), 0.08) * step(abs(p.y - 0.5), 0.24) * step(0.45, hs(vec2(3.0), 1.0));
    float band = step(0.94, p.y) + step(p.y, 0.03);
    h = -win * 0.5 + frame * 0.2 + band * 0.2;
    a = srgb(vec3(0.84, 0.74, 0.6)) * (0.85 + big * 0.2);
    a = mix(a, srgb(vec3(0.06, 0.06, 0.07)) + srgb(vec3(0.2, 0.18, 0.15)) * step(0.62, p.y) * 0.3, win);
    a = mix(a, srgb(vec3(0.5, 0.44, 0.36)), frame); a = mix(a, srgb(vec3(0.3, 0.42, 0.36)), sh); a = mix(a, srgb(vec3(0.9, 0.86, 0.78)), band * 0.6);
    r = mix(0.9, 0.2, win); x = h;`],
  /* tapis tissé (kilim) des étals */
  rug: [512, 35, 1.0, `
    vec2 p = uv * vec2(1.0, 2.0); float wv = sin(uv.x * 300.0 * 6.2831853) * 0.5 + 0.5;
    float band = floor(fract(p.y) * 9.0), bd = abs(fract(fract(p.y) * 9.0) - 0.5);
    float dia = step(abs(fract(uv.x * 6.0) - 0.5) + bd, 0.42), dia2 = step(abs(fract(uv.x * 6.0) - 0.5) + bd, 0.22);
    vec3 red = srgb(vec3(0.58, 0.14, 0.1)), ind = srgb(vec3(0.14, 0.18, 0.34)), och = srgb(vec3(0.8, 0.58, 0.24)), cr = srgb(vec3(0.85, 0.8, 0.68));
    vec3 c = mod(band, 2.0) < 1.0 ? red : ind; c = mix(c, och, dia * step(0.5, mod(band, 3.0))); c = mix(c, cr, dia2);
    float edge = step(0.46, abs(uv.x - 0.5)); c = mix(c, cr * 0.8, edge);
    float dirt = gfbm(uv, vec2(3.0), 4, 2.0);
    a = c * (0.8 + wv * 0.2) * (0.8 + dirt * 0.3); h = wv * 0.4; r = 0.95; x = h;`],
  /* bois peint des portes et volets (teinté) : planches verticales, peinture écaillée */
  paintwood: [512, 37, 2.2, `
    float n = 5.0, pu = uv.x * n, pi = floor(pu), fu = fract(pu);
    float gap = 1.0 - smoothstep(0.02, 0.05, min(fu, 1.0 - fu)), id = hs(vec2(pi, 1.0), 3.0);
    float grain = gfbm(vec2(uv.x + id, uv.y), vec2(40.0, 2.0), 5, 2.0);
    float chip = smoothstep(0.64, 0.68, gfbm(uv, vec2(5.0), 6, 4.0) + (grain - 0.5) * 0.15);
    float grime = smoothstep(0.3, 0.9, gfbm(vec2(uv.x, uv.y * 0.3), vec2(6.0, 2.0), 4, 5.0)) * 0.4 + (1.0 - smoothstep(0.0, 0.25, uv.y)) * 0.25;
    h = (1.0 - gap) * 0.5 + grain * 0.15 - chip * 0.2;
    vec3 wood = srgb(vec3(0.45, 0.33, 0.22)) * (0.7 + grain * 0.5);
    a = mix(vec3(0.8) * (0.92 + id * 0.1), wood, chip) * (1.0 - grime * 0.4); a = mix(a, vec3(0.05), gap * 0.8);
    r = mix(0.62, 0.85, chip); x = h;`],
  /* rideau métallique de boutique (teinté) : lames horizontales, rouille, crasse */
  rollshutter: [512, 43, 2.6, `
    float pv = uv.y * 24.0, fv = fract(pv), id = hs(vec2(floor(pv), 1.0), 2.0);
    float groove = 1.0 - smoothstep(0.0, 0.1, min(fv, 1.0 - fv));
    float big = gfbm(uv, vec2(3.0), 4, 1.0), grime = smoothstep(0.3, 0.9, gfbm(vec2(uv.x, uv.y * 0.5), vec2(5.0, 3.0), 4, 3.0));
    float rust = smoothstep(0.66, 0.84, gfbm(vec2(uv.x, uv.y * 0.5), vec2(8.0, 4.0), 5, 2.0) + (1.0 - uv.y) * 0.12);
    float dent = gfbm(uv, vec2(2.0, 1.0), 3, 5.0);
    h = sin(fv * 3.14159) * 0.6 + dent * 0.2;
    a = vec3(0.8) * (0.86 + big * 0.12 + id * 0.05) * (1.0 - grime * 0.35);
    a = mix(a, srgb(vec3(0.45, 0.24, 0.12)), rust * 0.75); a *= 1.0 - groove * 0.55;
    r = mix(0.5, 0.88, max(rust, grime * 0.5)); x = mix(0.55, 0.05, rust);`],
  /* moellons de pierre sèche (murets, soubassements, pierre de taille) */
  ashlar: [1024, 39, 2.4, `
    vec2 p = uv * vec2(4.0, 8.0); float row = floor(p.y); p.x += hs(vec2(row, 1.0), 2.0) * 0.8;
    vec2 i = floor(p), f = fract(p); float id = hs(mod(i, vec2(4.0, 8.0)), 4.0);
    float e = min(min(f.x, 1.0 - f.x) * 0.5, min(f.y, 1.0 - f.y)) ;
    float nb = gfbm(uv, vec2(24.0), 4, 3.0), big = gfbm(uv, vec2(3.0), 4, 5.0);
    float mortar = 1.0 - smoothstep(0.03, 0.07, e + (nb - 0.5) * 0.04);
    float bev = smoothstep(0.03, 0.14, e);
    h = (1.0 - mortar) * (0.45 + bev * 0.35 + nb * 0.2);
    vec3 st = mix(srgb(vec3(0.72, 0.62, 0.48)), srgb(vec3(0.86, 0.78, 0.64)), id) * (0.82 + nb * 0.25) * (0.9 + big * 0.15);
    a = mix(st, srgb(vec3(0.55, 0.5, 0.43)), mortar);
    r = mix(0.82, 0.95, mortar); x = h;`],
};

/* ---------- Exécution sur GPU ---------- */
const TLAB = { quad: null, tmp: null };
function _tlQuad(frag, uniforms) {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uSeed: { value: 0 }, uRes: { value: new THREE.Vector2() } }, uniforms || {}),
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag, depthTest: false, depthWrite: false,
  });
  return new THREE.FullScreenQuad(m);
}
function _tlTarget(size, srgb, float) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: float ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    minFilter: float ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: !float,
    encoding: srgb ? THREE.sRGBEncoding : THREE.LinearEncoding, anisotropy: 8,
  });
  rt.texture.userData.rt = rt; // libérée avec sa cible (freeTexture)
  return rt;
}
/* Libère une texture du GPU, avec sa cible de rendu si elle en a une (sinon le framebuffer resterait alloué) */
function freeTexture(t) { if (t) { if (t.userData.rt) t.userData.rt.dispose(); else t.dispose(); } }
function _tlRender(quad, rt, seed) {
  const prev = renderer.getRenderTarget(), m = quad.material;
  m.uniforms.uSeed.value = seed; m.uniforms.uRes.value.set(rt.width, rt.height);
  renderer.setRenderTarget(rt); quad.render(renderer); renderer.setRenderTarget(prev);
}
/* Génère une surface : { map, normal } (textures de cibles de rendu, raccordables, avec mipmaps) */
function texLabSurface(key, def, sizeScale = 1) {
  const [size0, seed, bump, code] = def, size = Math.max(64, Math.round(size0 * sizeScale));
  const surf = `${TEXLAB_LIB}\nvoid surf(vec2 uv, out vec3 a, out float h, out float r, out float x) { a = vec3(0.5); h = 0.0; r = 0.9; x = 0.0; ${code} }\nvarying vec2 vUv;\n`;
  const qH = _tlQuad(surf + 'void main(){ vec3 a; float h, r, x; surf(vUv, a, h, r, x); gl_FragColor = vec4(h, 0.0, 0.0, 1.0); }');
  const qA = _tlQuad(surf + 'void main(){ vec3 a; float h, r, x; surf(vUv, a, h, r, x); gl_FragColor = vec4(clamp(a, 0.0, 1.0), clamp(x, 0.0, 1.0)); }');
  const qN = _tlQuad(surf + `uniform sampler2D tH; uniform float uBump;
    void main(){ vec3 a; float h, r, x; surf(vUv, a, h, r, x);
      vec2 e = 1.0 / uRes;
      float hl = texture2D(tH, vUv - vec2(e.x, 0.0)).r, hr = texture2D(tH, vUv + vec2(e.x, 0.0)).r, hd = texture2D(tH, vUv - vec2(0.0, e.y)).r, hu = texture2D(tH, vUv + vec2(0.0, e.y)).r;
      vec3 n = normalize(vec3((hl - hr) * uBump, (hd - hu) * uBump, 1.0));
      gl_FragColor = vec4(n * 0.5 + 0.5, clamp(r, 0.04, 1.0)); }`, { tH: { value: null }, uBump: { value: 0 } });
  const tmp = _tlTarget(size, false, true), map = _tlTarget(size, true), nor = _tlTarget(size, false);
  _tlRender(qH, tmp, seed); _tlRender(qA, map, seed);
  qN.material.uniforms.tH.value = tmp.texture; qN.material.uniforms.uBump.value = bump * size / 32;
  _tlRender(qN, nor, seed);
  for (const q of [qH, qA, qN]) q.material.dispose(); // pas q.dispose() : la géométrie du quad est partagée par tous
  tmp.dispose();
  map.texture.name = key + '.map'; nor.texture.name = key + '.normal';
  return { map: map.texture, normal: nor.texture, rt: [map, nor], size };
}
/* Texture de variation à grande échelle (anti-répétition) : r, g = nuages à deux échelles, b = taches, a = coulures verticales */
/* Texture macro du décor (512 px, raccordable) : r, variation de grande échelle (bruit) ; g, b, a, la couche d'usure : grain de crasse,
   taches, coulures, recopiés des scans (assets/fx/usure.webp, tools/build_usure.py : trois cases de 512 px côte à côte, paquet fx_usure
   chargé avec les textures de la carte, usureLoad). Sans eux (réseau coupé), du bruit procédural : bruit fin, taches de Voronoï, traînées. */
function texLabMacro(scan) {
  const q = _tlQuad(`${TEXLAB_LIB}\nuniform sampler2D tScan; uniform float uScan; varying vec2 vUv; void main(){ vec2 uv = vUv;
    float a = gfbm(uv, vec2(4.0), 5, 1.0), b = gfbm(uv, vec2(16.0), 4, 2.0);
    vec4 v = vor(uv, vec2(10.0), 3.0, 1.0); float c = smoothstep(0.55, 0.1, v.x) * v.z;
    float d = gfbm(vec2(uv.x, uv.y), vec2(64.0, 2.0), 4, 4.0);
    if (uScan > 0.5) { ivec2 p = ivec2(gl_FragCoord.xy); b = texelFetch(tScan, p, 0).r; c = texelFetch(tScan, p + ivec2(512, 0), 0).r; d = texelFetch(tScan, p + ivec2(1024, 0), 0).r; }
    gl_FragColor = vec4(a, b, c, d); }`, { tScan: { value: scan || null }, uScan: { value: scan ? 1 : 0 } });
  const rt = _tlTarget(512, false); _tlRender(q, rt, 41); q.material.dispose();
  return rt.texture;
}
/* Scans de la couche d'usure (paquet fx_usure) : null s'ils manquent */
function usureLoad() {
  return fetchTexPack('fx_usure').then((d) => d && new Promise((res) => new THREE.TextureLoader().load(d.map, (t) => {
    t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.NearestFilter; res(t);
  }, undefined, () => res(null))));
}
/* Relief d'une surface photo retrouvé à partir de sa carte de normales. Les pentes (-n.x / n.z, -n.y / n.z) sont
   intégrées en résolvant l'équation de Poisson par relaxation de Jacobi, de la résolution la plus grossière à la plus
   fine (chaque niveau part du résultat agrandi du précédent : quelques dizaines de passes suffisent). La tuile reste
   raccordable (bords bouclés). Sortie : cible flottante r = relief sans ondulations lointaines, g = r², avec mipmaps
   (le dernier niveau donne l'écart type, qui sert à normaliser). */
function texLabHeight(nor, size) {
  const rt = (s, mip) => new THREE.WebGLRenderTarget(s, s, {
    type: THREE.HalfFloatType, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: mip,
  });
  const top = Math.log2(size), G = rt(size, true);
  const qG = _tlQuad(`uniform sampler2D tN; varying vec2 vUv; void main(){ vec3 n = texture2D(tN, vUv).xyz * 2.0 - 1.0;
    gl_FragColor = vec4(clamp(-n.xy / max(n.z, 0.3), -2.5, 2.5), 0.0, 1.0); }`, { tN: { value: nor } });
  _tlRender(qG, G, 0);
  // relaxation amortie (0,8) : h = moyenne des voisins corrigée de la divergence des pentes (unités : texels fins)
  const qJ = _tlQuad(`uniform sampler2D tH, tG; uniform float uR, uLod, uS; varying vec2 vUv; void main(){
    vec2 dx = vec2(1.0 / uR, 0.0), dy = vec2(0.0, 1.0 / uR);
    float s = texture2D(tH, vUv + dx).r + texture2D(tH, vUv - dx).r + texture2D(tH, vUv + dy).r + texture2D(tH, vUv - dy).r;
    float dv = textureLod(tG, vUv + dx, uLod).x - textureLod(tG, vUv - dx, uLod).x + textureLod(tG, vUv + dy, uLod).y - textureLod(tG, vUv - dy, uLod).y;
    gl_FragColor = vec4(mix(texture2D(tH, vUv).r, (s - dv * uS * 0.5) * 0.25, 0.8), 0.0, 0.0, 1.0); }`,
  { tH: { value: null }, tG: { value: G.texture }, uR: { value: 0 }, uLod: { value: 0 }, uS: { value: 0 } });
  const U = qJ.material.uniforms;
  // chaque niveau part du précédent agrandi (lecture bilinéaire de la petite cible), le premier de zéro
  let prev = null; const zero = new THREE.DataTexture(new Uint8Array(4), 1, 1); zero.needsUpdate = true;
  for (let R = 8; R <= size; R *= 2) {
    const n = R >= 512 ? 14 : R >= 256 ? 20 : R >= 128 ? 30 : 40;
    let cur = rt(R, false), nxt = rt(R, false);
    U.uR.value = R; U.uLod.value = Math.log2(size / R); U.uS.value = size / R;
    U.tH.value = prev ? prev.texture : zero; _tlRender(qJ, cur, 0);
    if (prev) prev.dispose();
    for (let i = 1; i < n; i++) { U.tH.value = cur.texture; _tlRender(qJ, nxt, 0); [cur, nxt] = [nxt, cur]; }
    nxt.dispose(); prev = cur;
  }
  zero.dispose(); const src = prev;
  // relief sans ondulations lointaines (écart à la moyenne sur un quart de tuile), puis carré pour l'écart type
  const HM = rt(size, true), V = rt(size, true);
  const qC = _tlQuad('uniform sampler2D tH; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tH, vUv).r, 0.0, 0.0, 1.0); }', { tH: { value: src.texture } });
  _tlRender(qC, HM, 0);
  const qV = _tlQuad(`uniform sampler2D tH; uniform float uLod; varying vec2 vUv; void main(){
    float h = texture2D(tH, vUv).r - textureLod(tH, vUv, uLod).r; gl_FragColor = vec4(h, h * h, 0.0, 1.0); }`, { tH: { value: HM.texture }, uLod: { value: top - 2 } });
  _tlRender(qV, V, 0);
  for (const q of [qG, qJ, qC, qV]) q.material.dispose();
  for (const t of [G, src, HM]) t.dispose();
  return { rt: V, top };
}
/* Réemballe une surface photo (map, normal, rough séparées) au format du décor : map.a = relief (intégré depuis les
   normales si T.relief, sinon estimé d'après la luminance : il ne sert alors qu'aux mélanges de sol), ou masque de métal
   (T.metal : canal bleu de la rugosité, pour une matière à masque, ma), normal.a = rugosité. Les textures d'origine sont libérées. */
function texLabPack(T, maxSize = 1024) {
  const size = Math.min(maxSize, T.map.image.width || 1024);
  const H = T.relief ? texLabHeight(T.normal, Math.min(512, size)) : null;
  const qA = _tlQuad(`${TEXLAB_LIB}\nuniform sampler2D tM, tV, tR; uniform float uTop; varying vec2 vUv; void main(){
    vec3 c = texture2D(tM, vUv).rgb, lo = textureLod(tM, vUv, 5.0).rgb;
    float h = clamp(0.5 + (lum(c) - lum(lo)) * 2.5, 0.0, 1.0);
    #ifdef RELIEF
    h = clamp(0.5 + texture2D(tV, vUv).r / (5.0 * sqrt(max(textureLod(tV, vUv, uTop).g, 1e-6))), 0.0, 1.0);
    #endif
    #ifdef METAL
    h = texture2D(tR, vUv).b;
    #endif
    gl_FragColor = vec4(c, h); }`, { tM: { value: T.map }, tV: { value: H ? H.rt.texture : null }, tR: { value: T.rough }, uTop: { value: H ? H.top : 0 } });
  if (H) qA.material.defines = { RELIEF: '' };
  if (T.metal) qA.material.defines = { METAL: '' };
  const qN = _tlQuad(`${TEXLAB_LIB}\nuniform sampler2D tN, tR; varying vec2 vUv; void main(){
    gl_FragColor = vec4(texture2D(tN, vUv).rgb, texture2D(tR, vUv).g); }`, { tN: { value: T.normal }, tR: { value: T.rough } });
  const map = _tlTarget(size, true), nor = _tlTarget(size, false);
  _tlRender(qA, map, 0); _tlRender(qN, nor, 0);
  for (const q of [qA, qN]) q.material.dispose();
  if (H) H.rt.dispose();
  T.map.dispose(); T.normal.dispose(); T.rough.dispose();
  return { map: map.texture, normal: nor.texture, asset: true };
}
