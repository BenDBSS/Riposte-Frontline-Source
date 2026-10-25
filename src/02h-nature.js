/* ==========================================================================
   VÉGÉTATION ET DÉBRIS : palmiers, buissons, herbes sèches, bougainvilliers, gravats ; menus débris dispersés au
   sol (cailloux, briques, morceaux de béton, tessons de tuiles, déchets, herbes) et congères de sable.
   Feuillages en cartes découpées (atlas FOL, découpe alpha) : chaque carte est émise dans les deux sens avec
   des normales inclinées vers le ciel, pour un éclairage doux et sans face arrière noire. Les palmes
   projettent des ombres découpées (la carte d'ombre lit l'alpha de l'atlas).
   ========================================================================== */
/* Écorce de palmier : bases de palmes coupées, en losanges serrés sur un réseau oblique (comme sur un tronc de dattier), creux sombres entre
   elles, fibres verticales dans chaque base. Tuile de 1 m : 9 losanges sur le tour d'un tronc, 12 rangées. À demander dans `surfaces` d'une
   carte qui a des palmiers. */
Object.assign(TEXLAB, {
  palmbark: [512, 79, 2.6, `
    vec2 w = vec2(gfbm(uv, vec2(4.0), 3, 2.0), gfbm(uv + 0.43, vec2(4.0), 3, 7.0)) - 0.5;
    vec2 p = vec2(uv.x * 9.0 + uv.y * 6.0, uv.x * 9.0 - uv.y * 6.0) + w * 0.45;
    vec2 ci = floor(p), cf = fract(p);
    float e = min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y));
    vec2 cid = vec2(mod(ci.x + ci.y, 18.0), mod(ci.x - ci.y, 12.0));
    float n = hs(cid, 3.0), n2 = hs(cid, 8.0);
    float base = smoothstep(0.02, 0.15 + n2 * 0.1, e), core = smoothstep(0.08, 0.5, e);
    float fib = vn(vec2(uv.x * 180.0, uv.y * 12.0), vec2(180.0, 12.0), 5.0), big = gfbm(uv, vec2(3.0), 4, 1.0), gr = vn(uv * 256.0, vec2(256.0), 6.0);
    h = base * (0.5 + core * 0.25 + n * 0.1 + fib * 0.1) + big * 0.08 + gr * 0.04;
    vec3 sc = srgb(vec3(0.21, 0.15, 0.105)), lo = srgb(vec3(0.5, 0.39, 0.27)), hi = srgb(vec3(0.78, 0.66, 0.48));
    a = mix(sc, mix(lo, hi, core * (0.3 + n * 0.7)), base) * (0.78 + n * 0.3 + fib * 0.2 + big * 0.14 + gr * 0.06);
    r = 0.95; x = h;`],
});
TEXSCALE.palmbark = 1;
OPT_TEX.add('palmbark');
/* Quadrilatère de feuillage double face : 4 points [x,y,z], région d'atlas reg [u0, v0 (haut), du, dv] ; mat : matière
   découpée (atlas des feuillages par défaut, conifer pour les sapins) ; w : poids de souplesse des quatre coins (vent, voir
   02md-vent.js), sinon celui de M.swFn */
function foliageQuad(M, p0, p1, p2, p3, reg, up = 0.6, mat = 'foliage', w = null) {
  const [u0, v0, du, dv] = reg, B = M.buf(mat, (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2);
  const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = hyp3(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const uvs = [[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, v0], [u0, v0]], P = [p0, p1, p2, p3];
  for (const s of [1, -1]) {
    let mx = nx * s * (1 - up), my = ny * s * (1 - up) + up, mz = nz * s * (1 - up); const ml = hyp3(mx, my, mz); mx /= ml; my /= ml; mz /= ml;
    const ids = P.map((p, k) => M.v(B, p[0], p[1], p[2], mx, my, mz, uvs[k][0], uvs[k][1], 0.6 + 0.4 * (k > 1 ? 1 : 0), w ? w[k] : 0));
    if (s > 0) M.quadI(B, ids[0], ids[1], ids[2], ids[3]); else M.quadI(B, ids[0], ids[3], ids[2], ids[1]);
  }
}
/* Touffe en cartes croisées : n plans verticaux autour de l'axe, largeur w, hauteur h, base y0 */
function foliageCard(M, reg, w, h, y0 = 0, n = 2, flare = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI + 0.3, c = Math.cos(a) * w / 2, s = Math.sin(a) * w / 2, fc = Math.cos(a) * flare, fs = Math.sin(a) * flare;
    foliageQuad(M, [-c, y0, -s], [c, y0, s], [c + fc, y0 + h, s + fs], [-c - fc, y0 + h, -s - fs], reg);
  }
}
/* ---------- Palmiers dattiers ---------- */
/* Palme : bande de folioles pliée en V le long d'un rachis courbe, dans le plan vertical d'azimut az. tp : point d'attache [x, y, z] ; e0, e1 : élévation
   (rad) du rachis au départ et au bout (la courbure se concentre vers le bout : la palme monte, puis retombe en arc) ; len : longueur (m).
   o : w (demi-largeur maximale, m), fold (relèvement des bords, rad), segs, dry (palme sèche : moitié droite du sprite), fw (souplesse au vent, 0 à 1,
   voir 02md-vent.js : le poids croît du pied au bout, le pied ne bouge pas), floor (hauteur minimale du bout : la palme se redresse tant qu'elle
   descendrait plus bas, pour qu'un jeune palmier ne pende pas jusque dans les yeux). Teinte : celle de M.color. La largeur suit la palme : pied nu
   (le pétiole), folioles les plus longues vers le tiers, bout effilé. */
const PALM_VFLIP = false; // sens du sprite dans l'atlas (base de la palme en bas du sprite : faux)
function palmFrond(M, tp, az, e0, e1, len, o = {}) {
  const segs = o.segs || 8, ca = Math.cos(az), sa = Math.sin(az), wm = o.w || 0.5, fold = o.fold !== undefined ? o.fold : 0.5, fw = o.fw !== undefined ? o.fw : 1;
  const cf = Math.cos(fold), sf = Math.sin(fold), K = 1.3, ang = (t) => e0 + (e1 - e0) * Math.pow(t, K);
  let xy;
  for (let tries = 0; ; tries++) {
    xy = [[0, 0]]; let x = 0, y = 0;
    for (let i = 1; i <= segs; i++) { const a = ang((i - 0.5) / segs), dl = len / segs; x += Math.cos(a) * dl; y += Math.sin(a) * dl; xy.push([x, y]); }
    if (!o.floor || tries > 4 || tp[1] + Math.min(xy[segs][1], xy[segs - 1][1]) >= o.floor) break;
    e0 += 0.06; e1 += 0.26; // se redresse
  }
  const rows = xy.map(([x, y], i) => {
    const t = i / segs, th = ang(t), c = [tp[0] + ca * x, tp[1] + y, tp[2] + sa * x];
    const hw = wm * smoothstep(0.03, 0.2, t) * (1 - 0.92 * Math.pow(smoothstep(0.3, 1, t), 1.1)) + 0.012;
    const bx = -ca * Math.sin(th), by = Math.cos(th), bz = -sa * Math.sin(th); // dessus de la palme (normale au rachis, dans son plan)
    const sx = -sa * hw * cf, sz = ca * hw * cf, ux = bx * hw * sf, uy = by * hw * sf, uz = bz * hw * sf;
    return { c, l: [c[0] - sx + ux, c[1] + uy, c[2] - sz + uz], r: [c[0] + sx + ux, c[1] + uy, c[2] + sz + uz], t, w: fw * Math.pow(t, 1.25) };
  });
  const [u0, , du] = FOL.palm, uc = u0 + du / 2, hu = (o.dry ? 1 : -1) * du / 2, vb = (t) => (PALM_VFLIP ? t : 1 - t);
  for (let i = 0; i < segs; i++) {
    const a = rows[i], b = rows[i + 1], v0 = vb(b.t), dv = vb(a.t) - v0, wa = a.w, wb = b.w, ea = Math.min(1, wa * 1.12), eb = Math.min(1, wb * 1.12);
    foliageQuad(M, a.c, a.l, b.l, b.c, [uc, v0, hu, dv], 0.55, 'foliage', [wa, ea, eb, wb]);
    foliageQuad(M, a.r, a.c, b.c, b.r, [uc + hu, v0, -hu, dv], 0.55, 'foliage', [ea, wa, wb, eb]);
  }
}
/* Allures de palmier (PF.palm, o.v) : g grosseur du tronc (1 : un tronc de dattier de 48 cm au pied) ; c taille de la couronne ; n palmes vertes ;
   dry palmes sèches pendantes (au-delà de 6, la jupe d'un vieux palmier, plus bas sur le tronc) ; lean courbure du tronc (m au sommet) ;
   dates régimes ; kids rejets au pied (petits palmiers sans tronc, sans collision) ; trunks troncs de plus qui partent du même pied, penchés vers
   le dehors (touffe de deux ou trois palmiers) ; open de 0 (couronne dressée, d'un jeune palmier) à 1 (couronne ouverte qui retombe, d'un vieux) ;
   tint teinte des palmes vertes. Sans o.v : un dattier adulte. */
const PALM_KINDS = {
  dattier: { g: 1, c: 1, n: 34, dry: 8, lean: 0.5, dates: 3, kids: 0, trunks: 0, open: 0.45, tint: [1, 1, 1] },
  jeune: { g: 1.2, c: 0.85, n: 26, dry: 1, lean: 0.2, dates: 0, kids: 0, trunks: 0, open: 0.12, tint: [1, 1.02, 0.94] },
  vieux: { g: 0.85, c: 1.05, n: 24, dry: 14, lean: 1.1, dates: 4, kids: 0, trunks: 0, open: 0.8, tint: [1.04, 1, 0.86] },
  rejets: { g: 1, c: 1, n: 30, dry: 6, lean: 0.4, dates: 2, kids: 2, trunks: 0, open: 0.4, tint: [0.96, 1, 0.92] },
  touffe: { g: 0.9, c: 0.95, n: 22, dry: 5, lean: 0.4, dates: 1, kids: 1, trunks: 2, open: 0.55, tint: [1, 1, 0.9] },
};
/* Tronc : balayage d'un cercle le long d'une courbe qui s'incline vers (lx, lz) au sommet (en t² : droit au pied), écorce losangée, pied évasé,
   légère renflement sous la couronne ; renvoie le point de la courbe à la hauteur relative t (0 à 1) */
function palmTrunk(M, R, bx, bz, h, lx, lz, g, lite) {
  const at = (t) => [bx + lx * t * t, t * h, bz + lz * t * t], N = lite ? 11 : 17, ts = [0, 0.012, 0.03, 0.06, 0.1];
  for (let i = 1; i <= N; i++) ts.push(0.1 + 0.9 * i / N);
  const rad = (t) => g * (0.245 - 0.085 * t + 0.11 * Math.pow(1 - clamp(t * h / 0.9, 0, 1), 2.2) + 0.03 * smoothstep(0.88, 1, t));
  const k = R.range(0.74, 0.96);
  M.color([k, k * 0.92, k * 0.82]).local(1);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0, 1.5, y));
  M.sweep('palmbark', circleShape(1, lite ? 8 : 10), ts.map(at), { scale: (f) => rad(ts[Math.round(f * (ts.length - 1))]), uAround: 1 });
  M.aoFn = null;
  return at;
}
/* Couronne : palmes vertes sur une spirale d'angle d'or, du cœur (jeunes palmes presque droites) au bord (les plus anciennes, qui retombent), puis
   palmes sèches pendantes. top : sommet du tronc ; hb : hauteur du tronc au pied de la couronne ; sc : échelle de la couronne (rejets : petite) */
function palmCrown(M, R, top, hb, S, lite, sc = 1, at = null) {
  const n = Math.max(6, Math.round(S.n * (lite ? 0.72 : 1) * Math.min(1, 0.5 + sc * 0.5))), segs = lite ? 5 : 8, cr = S.c * sc, open = S.open;
  const tn = () => [R.range(0.88, 1) * S.tint[0], R.range(0.92, 1) * S.tint[1], R.range(0.8, 0.95) * S.tint[2]];
  // bulbe de bases de palmes sous la couronne
  M.color([0.6, 0.5, 0.36]);
  M.save().move(top[0], 0, top[2]);
  M.lathe('palmbark', [[0.2 * S.g * sc, top[1] - 0.95 * sc], [0.26 * S.g * sc, top[1] - 0.55 * sc], [0.33 * S.g * sc, top[1] - 0.12 * sc], [0.27 * S.g * sc, top[1] + 0.14 * sc], [0.1 * S.g * sc, top[1] + 0.3 * sc], [0, top[1] + 0.32 * sc]], lite ? 7 : 9, { sharp: 0.9 });
  M.restore();
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1), az = i * 2.39996 + R() * 0.3, uu = Math.pow(u, 0.9);
    const e0 = lerp(1.38, 0.2, uu) - 0.3 * open * u + R.range(-0.12, 0.12), e1 = Math.max(-1.45, lerp(1.26, -1.1, Math.pow(u, 0.8)) - 0.6 * open * u + R.range(-0.15, 0.15));
    const len = 3.4 * cr * lerp(0.55, 1, smoothstep(0, 0.35, u)) * (1 - 0.1 * u * u) * R.range(0.9, 1.1);
    M.color(tn());
    palmFrond(M, top, az, e0, e1, len, { w: 0.5 * Math.sqrt(cr) * R.range(0.92, 1.1), segs, fw: lerp(0.5, 1, Math.min(1, u * 1.6)) * R.range(0.85, 1), floor: top[1] > 3.2 ? 2.3 : 0 });
  }
  // palmes sèches : les premières pendent sous la couronne, la jupe plus bas contre le tronc
  for (let i = 0; i < S.dry; i++) {
    const skirt = i >= 6, q = at ? at(clamp((hb - 0.3 - 0.12 * (i - 6)) / hb, 0, 1)) : top;
    M.color(skirt && i % 2 ? [0.86, 0.75, 0.62] : [0.95, 0.84, 0.7]);
    palmFrond(M, skirt ? [q[0], top[1] - 0.3 * sc - 0.12 * (i - 6) * sc, q[2]] : top, R() * TAU, R.range(-0.5, 0.1) - (skirt ? 0.15 : 0), -1.3 + R.range(-0.1, 0.1), R.range(1.7, 2.5) * cr, { w: 0.42 * Math.sqrt(cr), segs: Math.max(4, segs - 2), dry: true, fw: 0.8, fold: 0.3 });
  }
}
/* Palmier dattier : tronc losangé à pied évasé, couronne dense de palmes arquées en V, palmes sèches pendantes, régimes de dattes ; variantes par o.v
   (PALM_KINDS) ; o.lite : version allégée pour une palmeraie nombreuse (tronc de 8 pans, palmes de 5 segments, moins de palmes). Ses collisions sont
   quatre tronçons qui suivent la courbe de chaque tronc. Les palmes bougent au vent (poids de souplesse, 02md-vent.js), pas le tronc. */
PF.palm = (h = 7, seed = 1, o = {}) => prefab('palm' + h + '_' + seed + (o.lite ? 'l' : '') + (o.v ? 'v' + Object.values(o.v).join('_') : ''), (M) => {
  const R = rngOf(seed * 7 + 3), lean0 = R.range(0.2, 0.9), ld = R() * TAU, lite = !!o.lite;
  const S = { ...PALM_KINDS.dattier, lean: lean0, ...(o.v || {}) };
  const g = S.g, lx = Math.cos(ld) * S.lean, lz = Math.sin(ld) * S.lean;
  const at = palmTrunk(M, R, 0, 0, h, lx, lz, g, lite), top = at(1);
  const cols = (f, hh, gg) => { for (let k = 0; k < 4; k++) { const p = f(k / 4), q = f((k + 1) / 4), r = 0.21 * gg * (1 - 0.07 * k); M.col(Math.min(p[0], q[0]) - r, Math.max(p[0], q[0]) + r, p[1], q[1], Math.min(p[2], q[2]) - r, Math.max(p[2], q[2]) + r, 'wood'); } };
  cols(at, h, g);
  palmCrown(M, R, top, h, S, lite, 1, at);
  M.occ(top[0] - 2.5 * S.c, top[0] + 2.5 * S.c, h - 0.8 * S.c, h + 0.6 * S.c, top[2] - 2.5 * S.c, top[2] + 2.5 * S.c, 0.35);
  // troncs de plus : partent du même pied, penchés vers le dehors, un peu plus bas
  for (let j = 0; j < S.trunks; j++) {
    const a = ld + (j + 1) * (TAU / (S.trunks + 1)) + R.range(-0.4, 0.4), d = R.range(0.3, 0.5) * g, h2 = h * R.range(0.68, 0.92), L2 = R.range(1.0, 2.1), bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const at2 = palmTrunk(M, R, bx, bz, h2, Math.cos(a) * L2, Math.sin(a) * L2, g * 0.82, lite), top2 = at2(1);
    cols((t) => at2(t), h2, g * 0.82);
    palmCrown(M, R, top2, h2, { ...S, n: Math.round(S.n * 0.75), dry: Math.min(S.dry, 6) }, lite, 0.9, at2);
    M.occ(top2[0] - 2.2 * S.c, top2[0] + 2.2 * S.c, h2 - 0.8 * S.c, h2 + 0.6 * S.c, top2[2] - 2.2 * S.c, top2[2] + 2.2 * S.c, 0.3);
  }
  // rejets au pied : de petits palmiers sans tronc qui poussent en touffe contre le pied, penchés vers le dehors
  for (let k = 0; k < S.kids; k++) {
    const a = R() * TAU, d = R.range(0.45, 0.7) * g, b = [Math.cos(a) * d, -0.05, Math.sin(a) * d], kt = [b[0] + Math.cos(a) * 0.15, R.range(0.25, 0.6), b[2] + Math.sin(a) * 0.15];
    M.color([0.62, 0.55, 0.46]); M.sweep('palmbark', circleShape(1, 6), [b, kt], { scale: (t) => 0.16 - 0.05 * t, uAround: 0.5 });
    for (let i = 0; i < 9; i++) {
      M.color([R.range(0.85, 1) * S.tint[0], R.range(0.9, 1) * S.tint[1], R.range(0.75, 0.9) * S.tint[2]]);
      palmFrond(M, kt, a + R.range(-1.8, 1.8), i % 2 ? R.range(0.4, 0.75) : R.range(0.95, 1.3), i % 2 ? -0.5 : 0.1, R.range(1.1, 1.8), { w: 0.3, segs: lite ? 4 : 6, fw: 0.8 });
    }
  }
  // régimes de dattes
  M.color([0.62, 0.3, 0.1]); M.cls = 1;
  for (let i = 0; i < S.dates; i++) { const a = R() * TAU; for (let k = 0; k < (lite ? 3 : 5); k++) { M.save().move(top[0] + Math.cos(a) * 0.4 + (R() - 0.5) * 0.12, h - 0.55 - k * 0.07, top[2] + Math.sin(a) * 0.4 + (R() - 0.5) * 0.12).scl(0.09, 0.07, 0.09); M.geo('plastic', G_SPH); M.restore(); } }
  M.cls = 0;
});
/* Buisson (cartes croisées) */
PF.bush = (s = 1) => prefab('bush' + s, (M) => {
  M.swFn = swHeight(0, 1.1 * s, 1.3, 0.5); // le haut des rameaux plie au vent (02md-vent.js)
  M.color([0.95, 1, 0.9]);
  foliageCard(M, FOL.bush, 1.3 * s, 1.1 * s, -0.05, 3, 0.15 * s);
  M.color([0.85, 0.9, 0.8]);
  foliageQuad(M, [-0.55 * s, 0.55 * s, -0.55 * s], [0.55 * s, 0.55 * s, -0.55 * s], [0.55 * s, 0.62 * s, 0.55 * s], [-0.55 * s, 0.62 * s, 0.55 * s], FOL.bush, 0.8);
});
/* Touffe d'herbes sèches */
PF.grass = (s = 1) => prefab('grass' + s, (M) => {
  M.swFn = swHeight(0, 0.55 * s, 1.4, 0.7);
  M.color([1, 0.95, 0.85]);
  foliageCard(M, FOL.grass, 0.7 * s, 0.55 * s, 0, 3, 0.12 * s);
});
/* Bougainvillier grimpant sur une façade (repère de façade : plan du mur en z = 0) */
PF.bougainvillea = (w = 2.2, h = 2.6) => prefab(`bougain${w}${h}`, (M) => {
  const R = rngOf(Math.round(w * 10 + h));
  M.swFn = () => -0.6; // plaqué au mur : les feuilles frémissent, la plante ne s'incline pas
  M.color([1, 1, 1]);
  for (let i = 0; i < 5; i++) {
    const cw = w * R.range(0.45, 0.75), ch = h * R.range(0.4, 0.7), x = R.range(-w / 2 + cw / 2, w / 2 - cw / 2), y = R.range(0, h - ch), z = 0.05 + i * 0.03;
    foliageQuad(M, [x - cw / 2, y, z], [x + cw / 2, y, z + 0.05], [x + cw / 2, y + ch, z], [x - cw / 2, y + ch, z + 0.05], FOL.flower, 0.35);
  }
  // tige principale
  M.color([0.35, 0.26, 0.18]); M.cls = 2;
  M.tube('wood', 0.03, [[-w * 0.3, 0, 0.06], [-w * 0.25, h * 0.4, 0.08], [0, h * 0.8, 0.07], [w * 0.3, h * 0.95, 0.06]], 5);
});
/* Gravats : blocs de béton et de brique chanfreinés, poussière */
PF.rubble = (seed = 1, r = 1.2) => prefab('rubble' + seed + '_' + r, (M) => {
  const R = rngOf(seed * 31 + 5);
  M.local(1);
  for (let i = 0; i < 16; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * r, s = R.range(0.08, 0.3), brick = R() < 0.35;
    M.save().move(Math.cos(a) * d, -s * 0.2, Math.sin(a) * d).rotY(R() * TAU).rotX(R.range(-0.4, 0.4)).rotZ(R.range(-0.4, 0.4));
    M.color(brick ? [0.72, 0.42, 0.3] : [0.85, 0.82, 0.76]);
    M.box(brick ? 'brick' : 'concrete', s * (brick ? 1.6 : 1.2), s * 0.6, s * (brick ? 0.8 : 1), { bevel: s * 0.12 });
    M.restore();
  }
  // tas de poussière et de sable
  M.color([0.95, 0.9, 0.82]);
  M.surf('sand', 10, 4, (u, v) => { const a = u * TAU, rr = r * 0.9 * v, y = (1 - v * v) * 0.18; return [Math.cos(a) * rr, y, Math.sin(a) * rr * 0.8]; }, { closeU: true, uL: 3, vL: 1, pole: () => [0, 1, 0] });
});

/* ---------- Dispersion au sol ----------
   Pièces de quelques centimètres dans la matière « rubble » (teinte par sommet), classe 3 : un maillage par tronçon,
   masqué au-delà de QUALITY.scatter, ombre dans les cascades proches seulement. Aucune collision. */
/* Pierre : sphère bosselée de demi-axes (rx, ry, rz) ; k plans de coupe tirés au hasard la rendent anguleuse
   (pierre éclatée, morceau de béton), sans eux c'est un galet. Posée sur y = 0, enfoncée d'un quart. */
function rockMesh(M, R, rx, ry, rz, k = 0, nu = 6, nv = 4, mat = 'rubble', contact = true) { // contact : assombri près du sol (y = 0) ; faux pour un rocher qui flotte
  const P = [], ph = [R() * TAU, R() * TAU, R() * TAU];
  for (let i = 0; i < k; i++) { const a = R() * TAU, b = Math.acos(R.range(-0.5, 1)); P.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a), R.range(0.6, 0.88)]); }
  M.save().move(0, ry * 0.75, 0);
  M.aoFn = contact ? (x, y) => lerp(0.5, 1, smoothstep(0, ry * 1.2, y)) : null;
  M.surf(mat, nu, nv, (u, v) => {
    const a = u * TAU, b = v * Math.PI, sb = Math.sin(b), dx = sb * Math.cos(a), dy = -Math.cos(b), dz = sb * Math.sin(a);
    let r = 1 + sb * (0.09 * Math.sin(3 * a + ph[0]) * Math.sin(2 * b + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]));
    for (const p of P) { const d = dx * p[0] + dy * p[1] + dz * p[2]; if (d > 0.05) r = Math.min(r, p[3] / d); }
    return [dx * r * rx, dy * r * ry, dz * r * rz];
  }, { closeU: true, flipN: true, pole: (v) => [0, v < 0.5 ? -1 : 1, 0], uL: TAU * Math.max(rx, rz), vL: Math.PI * ry });
  M.aoFn = null; M.restore();
}
/* Gravillons : quelques galets serrés */
PF.gravel = (seed = 1) => prefab('gravel' + seed, (M) => {
  const R = rngOf(seed * 13 + 7); M.cls = 3; M.local(1);
  const n = 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 0.2, s = R.range(0.018, 0.045), g = R.range(0.85, 1.1);
    M.color(R.pick([[0.72 * g, 0.62 * g, 0.5 * g], [0.58 * g, 0.53 * g, 0.47 * g], [0.66 * g, 0.47 * g, 0.34 * g], [0.78 * g, 0.72 * g, 0.62 * g]]));
    M.save().move(Math.cos(a) * d, -s * 0.2, Math.sin(a) * d).rotY(R() * TAU); rockMesh(M, R, s * R.range(1, 1.4), s * R.range(0.55, 0.8), s, 0, 4, 3); M.restore();
  }
});
/* Pierre isolée, lisse ou éclatée */
PF.stone = (seed = 1) => prefab('stone' + seed, (M) => {
  const R = rngOf(seed * 29 + 3); M.cls = 3; M.local(1);
  const s = R.range(0.05, 0.13), g = R.range(0.85, 1.1);
  M.color(R.pick([[0.72 * g, 0.61 * g, 0.48 * g], [0.6 * g, 0.55 * g, 0.48 * g], [0.68 * g, 0.5 * g, 0.36 * g]]));
  rockMesh(M, R, s * R.range(1, 1.5), s * R.range(0.45, 0.7), s, R() < 0.25 ? 0 : 2 + Math.floor(R() * 4));
});
/* Morceau de béton ou de parpaing : très anguleux, parfois un bout de fer à béton qui dépasse */
PF.chunk = (seed = 1) => prefab('chunk' + seed, (M) => {
  const R = rngOf(seed * 41 + 11); M.cls = 3; M.local(1);
  const s = R.range(0.07, 0.16), g = R.range(0.9, 1.08);
  M.color([0.7 * g, 0.68 * g, 0.64 * g]);
  rockMesh(M, R, s * R.range(1.1, 1.6), s * R.range(0.55, 0.85), s, 5 + Math.floor(R() * 3), 7, 4);
  if (R() < 0.3) { M.color([0.3, 0.2, 0.15]); M.save().move(0, s * 0.5, 0).rotZ(R.range(1.1, 1.4)).rotX(R.range(-0.3, 0.3)); M.cyl('rubble', 0.005, s * 2.2, 4, { caps: '' }); M.restore(); }
});
/* Brique pleine (22 x 10,5 x 6,5 cm) ou demi-brique, arêtes chanfreinées */
PF.brick = (seed = 1, half = false) => prefab('brick' + seed + (half ? 'h' : ''), (M) => {
  const R = rngOf(seed * 23 + (half ? 5 : 1)); M.cls = 3; M.local(1);
  const g = R.range(0.85, 1.08);
  M.color(R.pick([[0.74 * g, 0.42 * g, 0.3 * g], [0.66 * g, 0.36 * g, 0.26 * g], [0.8 * g, 0.52 * g, 0.38 * g]]));
  M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0, 0.07, y));
  M.save().move(0, -0.006, 0); M.box('rubble', half ? R.range(0.09, 0.13) : 0.22, 0.065, 0.105, { bevel: 0.007 }); M.restore();
  M.aoFn = null;
});
/* Petit tas de briques tombées d'un mur : quelques-unes à plat, une ou deux de chant ou en appui */
PF.brickPile = (seed = 1) => prefab('brickPile' + seed, (M) => {
  const R = rngOf(seed * 71 + 13); M.cls = 3; M.local(1);
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0, 0.12, y));
  const n = 3 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const g = R.range(0.85, 1.08), top = i >= n - 2 && R() < 0.6;
    M.color(R.pick([[0.74 * g, 0.42 * g, 0.3 * g], [0.66 * g, 0.36 * g, 0.26 * g], [0.8 * g, 0.52 * g, 0.38 * g]]));
    M.save().move(R.range(-0.2, 0.2), top ? 0.05 : -0.006, R.range(-0.16, 0.16)).rotY(R() * TAU);
    if (top) M.rotZ(R.range(-0.35, 0.35)).rotX(R.range(-0.2, 0.2));
    M.box('rubble', R() < 0.3 ? R.range(0.1, 0.14) : 0.22, 0.065, 0.105, { bevel: 0.007 }); M.restore();
  }
  M.aoFn = null;
});
/* Tesson de tuile canal : portion d'anneau extrudée, posée bombée ou en gouttière */
PF.shard = (seed = 1) => prefab('shard' + seed, (M) => {
  const R = rngOf(seed * 37 + 9); M.cls = 3; M.local(1);
  const r = R.range(0.06, 0.08), t = 0.012, half = R.range(0.5, 0.85), len = R.range(0.06, 0.14), n = 5, trough = R() < 0.5, S = [];
  // arc centré sur la verticale ; en gouttière le bas de l'arc touche le sol, bombé ce sont ses deux bords
  const pt = (a, rho) => [Math.cos(a) * rho, trough ? r - Math.sin(a) * rho : Math.sin(a) * rho - (r - t) * Math.cos(half)];
  for (let i = 0; i <= n; i++) S.push(pt(Math.PI / 2 - half + (2 * half * i) / n, r));
  for (let i = n; i >= 0; i--) S.push(pt(Math.PI / 2 - half + (2 * half * i) / n, r - t));
  const g = R.range(0.85, 1.05);
  M.color([0.74 * g, 0.4 * g, 0.26 * g]);
  M.save().move(0, 0, -len / 2); M.extrude('rubble', S, len, { sharp: 0.4 }); M.restore();
});
/* Déchets : canette écrasée, bouteille en plastique, papier froissé */
PF.litter = (seed = 1) => prefab('litter' + seed, (M) => {
  const R = rngOf(seed * 53 + 17), k = seed % 3; M.cls = 3; M.local(1);
  if (k === 0) {
    M.color(R.pick([[0.7, 0.12, 0.1], [0.15, 0.3, 0.62], [0.78, 0.78, 0.74], [0.2, 0.5, 0.25]]));
    M.save().move(0, 0.028, -0.06).rotX(Math.PI / 2).scl(1, 1, R.range(0.6, 0.9)); M.cyl('rubble', 0.033, 0.12, 8, { r1: 0.031 }); M.restore();
  } else if (k === 1) {
    M.color(R.pick([[0.72, 0.84, 0.76], [0.86, 0.88, 0.9], [0.5, 0.66, 0.5]]));
    M.save().move(0, 0.034, -0.12).rotX(Math.PI / 2);
    M.lathe('rubble', [[0, 0], [0.034, 0.005], [0.034, 0.16], [0.014, 0.21], [0.013, 0.24], [0, 0.24]], 7); M.restore();
  } else {
    M.color(R.pick([[0.92, 0.9, 0.84], [0.84, 0.78, 0.66], [0.9, 0.86, 0.7]]));
    // feuille pliée : quatre facettes relevées, visibles des deux côtés
    const w = R.range(0.08, 0.14), d = R.range(0.07, 0.12), hy = R.range(0.01, 0.03), P = [[-w, 0.004, -d], [0, hy, -d * 0.8], [w, 0.004, -d], [-w * 0.8, hy * 0.7, 0], [0, hy * 1.4, 0], [w, 0.01, 0], [-w, 0.004, d], [0, hy, d * 0.9], [w, 0.006, d]];
    const B = M.buf('rubble'), ids = [[], []];
    for (const s of [1, -1]) for (const p of P) ids[s > 0 ? 0 : 1].push(M.v(B, p[0], p[1] + (s < 0 ? -0.001 : 0), p[2], 0, s, 0, p[0], p[2], s > 0 ? 1 : 0.6));
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const a = j * 3 + i, q = [a, a + 1, a + 4, a + 3];
      M.quadI(B, ids[0][q[0]], ids[0][q[3]], ids[0][q[2]], ids[0][q[1]]); M.quadI(B, ids[1][q[0]], ids[1][q[1]], ids[1][q[2]], ids[1][q[3]]);
    }
  }
});
/* Petite touffe d'herbe sèche poussée entre deux pierres */
PF.weed = (seed = 1) => prefab('weed' + seed, (M) => {
  const R = rngOf(seed * 61 + 5); M.cls = 2; // peu nombreuses : fusionnées avec les autres feuillages fins
  M.swFn = swHeight(0, 0.26, 1.4, 0.5);
  M.color([R.range(0.9, 1.05), R.range(0.9, 1), R.range(0.75, 0.9)]);
  foliageCard(M, FOL.grass, R.range(0.2, 0.34), R.range(0.14, 0.26), 0, 2, 0.04);
});
/* Variantes de chaque sorte (prefabs construits une fois) */
const SCATTER_KINDS = {
  gravel: (i) => PF.gravel(i), stone: (i) => PF.stone(i), chunk: (i) => PF.chunk(i), brick: (i) => PF.brick(i, i % 3 === 2), pile: (i) => PF.brickPile(i),
  shard: (i) => PF.shard(i), litter: (i) => PF.litter(i), weed: (i) => PF.weed(i),
};
/* Dispersion déterministe sur [x0, x1] x [z0, z1] (grille de cellules de cell m, assez fines pour suivre le pied des
   murs ; position tirée dans chaque cellule).
   at(x, z) : null (rien ici) ou { n : pièces par m², w : { sorte: poids } }. Renvoie le nombre de pièces posées. */
function scatterGround(x0, x1, z0, z1, seed, at, cell = 0.3) {
  const R = rngOf(seed), M = DECOR, kinds = Object.keys(SCATTER_KINDS), variants = 8;
  let count = 0;
  for (let z = z0; z < z1; z += cell) for (let x = x0; x < x1; x += cell) {
    const lam = (() => { const q = at(x + cell / 2, z + cell / 2); return q ? q.n * cell * cell : 0; })();
    let n = Math.floor(lam) + (R() < lam % 1 ? 1 : 0);
    while (n-- > 0) {
      const px = x + R() * cell, pz = z + R() * cell, q = at(px, pz);
      const r1 = R(), r2 = R(), r3 = R(), r4 = R(); // tirages toujours consommés : la suite ne dépend pas des refus
      if (!q) continue;
      let tot = 0; for (const k of kinds) tot += q.w[k] || 0;
      let t = r1 * tot, kind = kinds[0];
      for (const k of kinds) { t -= q.w[k] || 0; if (t <= 0) { kind = k; break; } }
      M.place(SCATTER_KINDS[kind](1 + Math.floor(r2 * variants)), px, 0, pz, r3 * TAU, { s: 0.8 + r4 * 0.45 });
      count++;
    }
  }
  return count;
}
/* Congères de sable contre les murs : bandes en pente douce le long des faces libres des boîtes de collision.
   walls : boîtes (murs au sol) ; at(x, z) : hauteur voulue (m) au pied du mur en ce point, 0 pour rien. Rendues dans la
   matière du sol (même carte de répartition, même teinte) : elles s'y fondent sans couture. */
function sandDrifts(walls, at, free) {
  const M = DECOR, st = 0.25, K = [0, 0.12, 0.3, 0.55, 0.8, 1];
  let strips = 0;
  M.save().color([1, 1, 1]).local(1); M.cls = 1; M.aoFn = null;
  for (const c of walls) {
    for (const side of [0, 1, 2, 3]) {
      // bord de la face : origine, direction le long, normale sortante
      const alongX = side < 2, len = alongX ? c.x1 - c.x0 : c.z1 - c.z0;
      if (len < 0.8) continue;
      const nx = alongX ? 0 : side === 2 ? -1 : 1, nz = alongX ? (side === 0 ? -1 : 1) : 0;
      const ox = alongX ? c.x0 : side === 2 ? c.x0 : c.x1, oz = alongX ? (side === 0 ? c.z0 : c.z1) : c.z0;
      const ux = alongX ? 1 : 0, uz = alongX ? 0 : 1, n = Math.floor(len / st);
      // hauteurs le long de la face, puis découpage en tronçons continus
      const H = [];
      for (let i = 0; i <= n; i++) {
        const s = (i / n) * len, x = ox + ux * s + nx * 0.3, z = oz + uz * s + nz * 0.3;
        H.push(free(x, z) && free(x + nx * 0.5, z + nz * 0.5) ? at(x, z) : 0);
      }
      let i = 0;
      while (i <= n) {
        if (H[i] < 0.03) { i++; continue; }
        let j = i; while (j < n && H[j + 1] >= 0.03) j++;
        if (j - i >= 2) { emitDrift(M, ox, oz, ux, uz, nx, nz, (i / n) * len, (j / n) * len, H.slice(i, j + 1), K); strips++; }
        i = j + 1;
      }
    }
  }
  M.restore();
  return strips;
}
/* Une bande de congère : profil concave (plus haut contre le mur), bouts effilés, largeur liée à la hauteur */
function emitDrift(M, ox, oz, ux, uz, nx, nz, s0, s1, H, K) {
  const cnt = H.length, pos = [];
  for (let i = 0; i < cnt; i++) {
    const s = lerp(s0, s1, i / (cnt - 1)), e = Math.min(1, Math.min(i, cnt - 1 - i) / 2.5), taper = e * e * (3 - 2 * e);
    const h = H[i] * taper, w = 0.25 + H[i] * 3.2;
    pos.push(K.map((k) => {
      const x = ox + ux * s + nx * (0.004 + k * w), z = oz + uz * s + nz * (0.004 + k * w);
      return [x, h * Math.pow(1 - k, 1.7), z];
    }));
  }
  const cx = (pos[0][0][0] + pos[cnt - 1][0][0]) / 2, cz = (pos[0][0][2] + pos[cnt - 1][0][2]) / 2;
  const B = M.buf('ground', cx, 0, cz), ids = [];
  for (let i = 0; i < cnt; i++) {
    ids.push(pos[i].map((p, k) => {
      // normale : produit vectoriel des tangentes le long du mur et à travers la bande
      const a = pos[Math.min(cnt - 1, i + 1)][k], b = pos[Math.max(0, i - 1)][k], c = pos[i][Math.min(K.length - 1, k + 1)], d = pos[i][Math.max(0, k - 1)];
      const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2], sx = c[0] - d[0], sy = c[1] - d[1], sz = c[2] - d[2];
      let mx = ty * sz - tz * sy, my = tz * sx - tx * sz, mz = tx * sy - ty * sx;
      if (my < 0) { mx = -mx; my = -my; mz = -mz; }
      const l = hyp3(mx, my, mz) || 1;
      return M.v(B, p[0], p[1], p[2], mx / l, my / l, mz / l, p[0], -p[2], lerp(0.72, 1, K[k]));
    }));
  }
  // sens des triangles : face vers le haut
  const flip = (ux * nz - uz * nx) > 0;
  for (let i = 0; i < cnt - 1; i++) for (let k = 0; k < K.length - 1; k++) {
    const a = ids[i][k], b = ids[i + 1][k], c = ids[i + 1][k + 1], d = ids[i][k + 1];
    if (flip) M.quadI(B, a, d, c, b); else M.quadI(B, a, b, c, d);
  }
}
