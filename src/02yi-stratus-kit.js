/* ==========================================================================
   KIT DES ÎLES FLOTTANTES : surfaces, matières et objets de Stratus, l'archipel suspendu au-dessus de la mer de nuages.
   - Surface procédurale (générée seulement pour une carte qui la demande, voir OPT_TEX) : la roche stratifiée des falaises et
     de la masse rocheuse qui pend sous chaque île ;
   - Îles (stIsland) : un dessus plat fait de rectangles (collision : boîtes dont le dessus est à y = 0, rien d'autre ne porte),
     la falaise puis la masse rocheuse qui s'effile vers le vide, d'une seule boucle de sommets : le haut de la falaise suit
     exactement le bord des collisions (on voit où l'on peut marcher), le reste s'enfonce et se resserre ;
   - Ponts suspendus (stBridge) : tablier de planches qui s'affaisse un peu au milieu (collision en tronçons d'un mètre), poutres,
     cordes, filets et poteaux ; de chaque côté, un mur invisible de 2,2 m qui retient les soldats (on ne saute pas par-dessus) et
     laisse passer balles et grenades. Toujours alignés sur x ou z (les collisions sont des boîtes alignées) ;
   - Objets : colonnes et blocs des ruines, cristaux, tour de guet, dirigeables.
   Le plan de la carte est dans 02yj-stratus.js. Tout se construit au chargement et se libère avec la carte.
   ========================================================================== */
Object.assign(TEXLAB, {
  /* roche stratifiée (grès et marnes) : bandes horizontales de teintes et d'épaisseurs inégales, ondulées, joints creusés, fissures, grain */
  strata: [1024, 71, 2.4, `
    float big = gfbm(uv, vec2(2.0), 5, 1.0), mid = gfbm(uv, vec2(8.0), 4, 2.0), fine = gfbm(uv, vec2(32.0), 3, 3.0);
    float ly = uv.y * 6.0 + (big - 0.5) * 1.1 + (mid - 0.5) * 0.3;
    float band = fract(ly), bid = mod(floor(ly), 6.0), hb = hs(vec2(bid, 0.0), 7.0), th = 0.05 + hs(vec2(bid, 1.0), 9.0) * 0.08;
    float joint = 1.0 - smoothstep(0.0, th, band) * (1.0 - smoothstep(1.0 - th * 0.6, 1.0, band));
    vec4 cr = vor(uv, vec2(7.0, 4.0), 4.0, 1.0);
    float crack = (1.0 - smoothstep(0.0, 0.03, cr.w)) * smoothstep(0.42, 0.62, gfbm(uv, vec2(4.0), 3, 9.0));
    float pit = (1.0 - smoothstep(0.05, 0.16, vor(uv, vec2(24.0), 5.0, 1.0).x)) * step(0.82, vor(uv, vec2(24.0), 5.0, 1.0).z);
    h = (1.0 - joint) * 0.45 + mid * 0.3 + fine * 0.14 - crack * 0.42 - pit * 0.2;
    vec3 c0 = srgb(vec3(0.62, 0.56, 0.48)), c1 = srgb(vec3(0.72, 0.66, 0.57)), c2 = srgb(vec3(0.55, 0.53, 0.51)), c3 = srgb(vec3(0.66, 0.53, 0.42));
    a = hb < 0.32 ? c0 : hb < 0.58 ? c1 : hb < 0.82 ? c2 : c3;
    a *= (0.84 + mid * 0.22 + fine * 0.1) * (1.0 - crack * 0.45) * (1.0 - joint * 0.28) * (1.0 - pit * 0.25);
    r = 0.86 + fine * 0.08; x = h;`],
});
Object.assign(TEXSCALE, { strata: 5.0 });
OPT_TEX.add('strata');
/* Surfaces que Stratus demande (surfaces de sa définition) : la roche, la flore de Hortus (pelouse, allées, dalles, humus, écorce), les
   filets du port (côtés des ponts) */
const STRATUS_SURFACES = ['strata', 'lawn', 'flagstone', 'humus', 'bark', 'net'];

/* Couleurs. Les deux moitiés se distinguent (on sait de quel côté on est) : azur au nord (Alpha, +z), garance au sud (Bravo, -z) */
const ST = {
  accent: [[0.16, 0.42, 0.82], [0.84, 0.27, 0.14]],
  rope: [0.66, 0.56, 0.42], wood: [0.84, 0.74, 0.62], stone: [0.88, 0.84, 0.76], moss: [0.6, 0.7, 0.42],
};
const stAccent = (z) => ST.accent[z >= 0 ? 0 : 1];

/* ---------- Matières ---------- */
function makeStratusMaterials(M) {
  makeFloraMaterials(M);
  M('strata', { tex: 'strata', macro: 0.5, grime: 0.15, dust: 0.06 });
  M('rope', { tex: 'burlap', rough: 0.92, macro: 0.08, env: 0.2 });
  M('net', { tex: 'net', cut: 0.5, rough: 0.85, env: 0.25, macro: 0.15 });
  // cristaux : lumineux par eux-mêmes (au-delà de 1 : le halo les fait rayonner), voilés par le brouillard comme le reste, taillés et fêlés (stCrystalCut)
  MAT.crystalSt = stCrystalCut(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 1.25, 1.85), vertexColors: true })); MAT.crystalSt.userData.noShadow = true;
}
/* Fractures des cristaux : réseau de fissures de « Marble Rock 01 » (Poly Haven, CC0), passé en niveaux de gris et en passe-haut (les fissures
   seules, claires sur fond noir : assets/fx/cristal.webp, 512², 58 Ko), chargé au lancement de la carte (paquet fx_cristal) ; en attendant,
   une texture noire d'un pixel (aucune fissure). Libéré avec la carte. */
const CRX = { U: { tCrx: { value: null } }, tex: null };
function stCrystalTexLoad() {
  if (!CRX.none) { CRX.none = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); CRX.none.needsUpdate = true; }
  CRX.U.tCrx.value = CRX.none;
  fetchTexPack('fx_cristal').then((d) => d && new THREE.TextureLoader().load(d.map, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (CURMAP.id === 'stratus' && !CRX.tex) { CRX.tex = t; CRX.U.tCrx.value = t; } else t.dispose();
  }));
}
function stCrystalTexFree() { if (CRX.tex) { CRX.tex.dispose(); CRX.tex = null; } if (CRX.none) CRX.U.tCrx.value = CRX.none; }
/* Cristal taillé, toujours sans lumière (une seule texture : les fractures) : chaque facette prend sa normale par les dérivées de la position
   et sa propre clarté ; vue de face, elle est profonde et plus bleue, vue de biais, elle s'éclaire (Fresnel) jusqu'à rayonner sur les arêtes ;
   un reflet blanc passe d'une facette à l'autre quand on bouge (lumière fixe dans le repère de la caméra). Les fractures sont prises deux fois
   dans le plan de la facette (projection sur l'axe dominant de sa normale) : à la surface, et plus loin en profondeur, décalées selon le
   regard (parallaxe) : elles bougent à l'intérieur quand on tourne autour. Avant les facettes, une teinte plate : des silhouettes sans relief. */
function stCrystalCut(m) {
  m.extensions = { derivatives: true };
  stCrystalTexLoad();
  m.onBeforeCompile = (s) => {
    s.uniforms.tCrx = CRX.U.tCrx;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCrV, vCrW;').replace('#include <project_vertex>', '#include <project_vertex>\nvCrV = -mvPosition.xyz; vCrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCrV, vCrW; uniform sampler2D tCrx;').replace('#include <color_fragment>', `#include <color_fragment>
  vec3 crV = normalize(vCrV), crN = normalize(cross(dFdx(vCrV), dFdy(vCrV)));
  if (dot(crN, crV) < 0.0) crN = -crN;
  float crF = 1.0 - clamp(dot(crN, crV), 0.0, 1.0);
  float crH = fract(sin(dot(floor(crN * 5.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float crS = pow(max(dot(reflect(-crV, crN), normalize(vec3(-0.35, 0.75, 0.55))), 0.0), 18.0);
  vec3 crWN = normalize(cross(dFdx(vCrW), dFdy(vCrW))), crA = abs(crWN), crVW = normalize(cameraPosition - vCrW);
  bool crX = crA.x > crA.y && crA.x > crA.z, crY = !crX && crA.y > crA.z;
  vec2 crUv = crX ? vCrW.zy : crY ? vCrW.xz : vCrW.xy, crVp = crX ? crVW.zy : crY ? crVW.xz : crVW.xy;
  float crD = max(abs(dot(crVW, crWN)), 0.3);
  float crF1 = texture2D(tCrx, crUv * 0.28).r, crF2 = texture2D(tCrx, crUv * 0.45 - crVp / crD * 0.12 + 0.37).r;
  diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.55, 0.85, 1.15), diffuseColor.rgb, crF) * (0.26 + 0.46 * crH + 1.3 * crF * crF) * (1.0 - 0.35 * crF1) + vec3(0.9, 1.0, 1.1) * crS
    + vec3(0.5, 0.95, 1.3) * (crF2 * 0.85 + crF1 * 0.3) * (1.0 - 0.5 * crF);`);
  };
  return m;
}
function stratusKit() { floraKit(); }

/* ---------- Îles ---------- */
/* Contour d'une union de rectangles [x0, x1, z0, z1] (multiples de 0,5 m) : boucle fermée, l'île à gauche du sens de parcours, points aux
   angles. Les rectangles d'une île se recouvrent ou se touchent par un côté, jamais par un seul coin (contour ambigu). */
function stOutline(rects) {
  const r = 0.5, bx0 = Math.min(...rects.map((q) => q[0])), bx1 = Math.max(...rects.map((q) => q[1])), bz0 = Math.min(...rects.map((q) => q[2])), bz1 = Math.max(...rects.map((q) => q[3]));
  const W = Math.round((bx1 - bx0) / r), H = Math.round((bz1 - bz0) / r), on = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = bx0 + (i + 0.5) * r, z = bz0 + (j + 0.5) * r; on[j * W + i] = rects.some((q) => x > q[0] && x < q[1] && z > q[2] && z < q[3]) ? 1 : 0; }
  const inside = (i, j) => i >= 0 && j >= 0 && i < W && j < H && on[j * W + i] === 1, next = new Map(), key = (x, z) => x.toFixed(2) + ',' + z.toFixed(2);
  const edge = (ax, az, bx, bz) => next.set(key(ax, az), [ax, az, bx, bz]);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!inside(i, j)) continue;
    const x0 = bx0 + i * r, z0 = bz0 + j * r, x1 = x0 + r, z1 = z0 + r;
    if (!inside(i, j - 1)) edge(x0, z0, x1, z0);
    if (!inside(i, j + 1)) edge(x1, z1, x0, z1);
    if (!inside(i - 1, j)) edge(x0, z1, x0, z0);
    if (!inside(i + 1, j)) edge(x1, z0, x1, z1);
  }
  // chaînage, puis fusion des pas alignés : il ne reste que les angles
  const first = next.values().next().value, pts = [];
  let e = first, guard = 0;
  do { pts.push([e[0], e[1]]); e = next.get(key(e[2], e[3])); } while (e && e !== first && ++guard < 100000);
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[(k + pts.length - 1) % pts.length], b = pts[k], c = pts[(k + 1) % pts.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
  }
  return { pts: out, on, W, H, bx0, bz0, r };
}
/* Contour arrondi : les angles saillants de stOutline deviennent des arcs (rayon r, au plus 45 % des côtés voisins), les angles rentrants
   restent vifs (un arc y ajouterait un sol sans collision). L'arc rentre d'au plus 0,29 r dans la boîte de collision : le bord droit et l'angle
   droit des îles disparaissent (retour du propriétaire, octobre 2026 : bords de terrain droits et anguleux) */
const ST_CUTS = []; // angles arrondis des îles de la carte en construction : le gazon n'y pousse pas (stCut), vidés au début de stratusLevel
function stCut(x, z) { for (const c of ST_CUTS) if ((x - c.bx) * (x - c.cx) <= 0 && (z - c.bz) * (z - c.cz) <= 0 && hyp(x - c.cx, z - c.cz) > c.rr - 0.05) return true; return false; }
function stRoundLoop(O, r = 1.2) {
  const P = O.pts, n = P.length, out = [];
  const inside = (x, z) => { const i = Math.floor((x - O.bx0) / O.r), j = Math.floor((z - O.bz0) / O.r); return i >= 0 && j >= 0 && i < O.W && j < O.H && O.on[j * O.W + i] === 1; };
  for (let k = 0; k < n; k++) {
    const a = P[(k + n - 1) % n], b = P[k], c = P[(k + 1) % n];
    const la = hyp(a[0] - b[0], a[1] - b[1]), lc = hyp(c[0] - b[0], c[1] - b[1]);
    const u1 = [(a[0] - b[0]) / la, (a[1] - b[1]) / la], u2 = [(c[0] - b[0]) / lc, (c[1] - b[1]) / lc];
    const convex = inside(b[0] + (u1[0] + u2[0]) * 0.1, b[1] + (u1[1] + u2[1]) * 0.1), rr = Math.min(r, la * 0.45, lc * 0.45);
    if (!convex || rr < 0.2) { out.push([b[0], b[1]]); continue; }
    const cxr = b[0] + (u1[0] + u2[0]) * rr, czr = b[1] + (u1[1] + u2[1]) * rr, a0 = Math.atan2(b[1] + u1[1] * rr - czr, b[0] + u1[0] * rr - cxr);
    let da = Math.atan2(b[1] + u2[1] * rr - czr, b[0] + u2[0] * rr - cxr) - a0; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
    for (let f = 0; f <= 6; f++) out.push([cxr + Math.cos(a0 + da * f / 6) * rr, czr + Math.sin(a0 + da * f / 6) * rr]);
    ST_CUTS.push({ bx: b[0], bz: b[1], cx: cxr, cz: czr, rr });
  }
  return out;
}
/* Allure du dessous d'une île, tirée au hasard pour chacune (aucune ne ressemble à une autre) : profil de la masse (part du rayon gardée à
   chaque profondeur, du pied de la falaise à la pointe : cône, ventre, gradins, poire, bloc trapu), corniches (la masse rentre d'un coup :
   un surplomb dans les strates), lobes et torsion (la coupe n'est pas une réduction du contour : la masse pend d'un côté, s'allonge, se
   tord), arêtes plus ou moins vives, profondeur, stalactites et éclats. firm : rocher flottant, dont les boîtes de collision doivent rester
   dans la roche (allures pleines, relief atténué, profondeur entière ; voir stIsland). walk : île praticable, sans ventre (sa masse reste dans
   le contour du dessus sur 21 m : stIsland) */
function stUnderShape(R, firm, walk) {
  const kinds = firm ? ['ventre', 'trapu', 'cone'] : walk ? ['cone', 'gradins', 'poire', 'trapu', 'cone', 'gradins', 'poire'] : ['cone', 'ventre', 'gradins', 'poire', 'trapu', 'cone', 'gradins'];
  const kind = R.pick(kinds), j = () => R.range(-0.05, 0.05);
  // profil en six points (profondeur relative 0, 0,2, 0,4, 0,6, 0,8, 1 : jusqu'à la pointe), lissé entre eux
  const F = { cone: [0.94, 0.74, 0.5, 0.24], ventre: [1.1, 1.04, 0.74, 0.36], gradins: [0.92, 0.72, 0.52, 0.27], poire: [0.82, 0.9, 0.66, 0.3], trapu: [1.0, 0.88, 0.66, 0.38] }[kind];
  const pts = [1, ...F.map((v) => v + j()), 0.03];
  const ledges = []; for (let i = 0, n = kind === 'gradins' ? 2 + Math.floor(R() * 2) : R() < 0.45 ? 1 : 0; i < n; i++) ledges.push({ t: R.range(0.14, 0.72), d: firm ? R.range(0.04, 0.08) : kind === 'gradins' ? R.range(0.12, 0.24) : R.range(0.06, 0.16) });
  const la = firm ? 0.5 : 1;
  // une île sur trois se partage vers le bas en deux ou trois pointes (lobes profonds qui se creusent à partir du milieu, une grande stalactite
  // sous chacun : stUnderParts)
  const split = !firm && R() < 0.35 ? { k: R() < 0.6 ? 2 : 3, a: R.range(0.22, 0.4), ph: R() * TAU } : null;
  return {
    kind, pts, ledges, split, depth: firm ? R.range(0.95, 1.2) : kind === 'trapu' ? R.range(0.62, 0.8) : R.range(0.88, 1.22), twist: R.range(-1.4, 1.4), crag: R.range(0.7, 1.8) * la, lumpy: R.range(0.6, 1.4) * la,
    // strates : pendage (pente des couches, en x et en z) et épaisseur propres à l'île
    dip: [R.range(-0.13, 0.13), R.range(-0.13, 0.13)], band: R.range(0.75, 1.3),
    lobes: [[1, R.range(0.03, 0.14)], [2, R.range(0.02, 0.12)], [3, R.range(0.0, 0.08)], [5, R.range(0.0, 0.04)]].map(([k, a]) => ({ k, a: a * la, ph: R() * TAU })),
    pend: kind === 'trapu' ? R.range(1.4, 2.0) : R.range(0.6, 1.3), firm,
  };
}
/* Part du rayon gardée à la profondeur relative t (0 au pied de la falaise, 1 à la pointe), dans la direction ang */
function stUnderScale(S, t, ang) {
  const u = clamp(t, 0, 1) * 5, i = Math.min(4, Math.floor(u)), f0 = S.pts[i], f1 = S.pts[i + 1], e = u - i;
  let f = lerp(f0, f1, e * e * (3 - 2 * e));
  for (const L of S.ledges) f *= 1 - L.d * smoothstep(L.t - 0.012, L.t + 0.012, t);
  let lob = 1; for (const L of S.lobes) lob += L.a * Math.pow(t, 0.8) * Math.cos(L.k * ang + L.ph + S.twist * t);
  if (S.split) lob += S.split.a * smoothstep(0.35, 0.8, t) * (Math.cos(S.split.k * ang + S.split.ph + S.twist * t * 0.5) - 0.35);
  f *= Math.max(0.2, lob);
  return Math.max(0.03, f);
}
/* Île flottante. I : { rects, depth (pointe, m sous le dessus), seed, tip [dx, dz] (décalage de la pointe), m (matière d'impact),
   y (hauteur du dessus, 0 par défaut), nocol (sans collision : rocher flottant, qui pose les siennes), firm (rocher flottant : sa masse
   contient ses collisions) }.
   Collisions : une boîte par rectangle, de y = -8 à 0 (dessus praticable) ; décor : dessus (matière du sol de la carte, répartition
   comprise), puis la falaise et la masse rocheuse en une seule boucle qui descend vers la pointe (allure propre à l'île : stUnderShape),
   des stalactites qui pendent de la masse et quelques éclats qui flottent autour (stUnderParts). Rend le contour. */
function stIsland(I) {
  const M = DECOR, O = stOutline(I.rects), N = makeNoise(I.seed), R = rngOf(I.seed * 7 + 3), y0 = I.y || 0;
  if (!I.nocol) for (const q of I.rects) DECOR.col(q[0], q[1], y0 - 8, y0, q[2], q[3], I.m || 'concrete');
  // dessus : le contour arrondi, triangulé (une seule nappe, pas de recouvrement)
  const P = stRoundLoop(O), loop = [];
  M.save().local(1).color([0.86, 0.88, 0.76]); M.cls = 0; M.aoFn = null;
  { const B = M.buf('ground', O.bx0 + O.W * O.r / 2, y0, O.bz0 + O.H * O.r / 2), vids = P.map((q) => M.v(B, q[0], y0, q[1], 0, 1, 0, q[0], -q[1]));
    for (const t of THREE.ShapeUtils.triangulateShape(P.map((q) => new THREE.Vector2(q[0], q[1])), [])) { const a = P[t[0]], b = P[t[1]], c = P[t[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (cr > 0) M.tri(B, vids[t[0]], vids[t[2]], vids[t[1]]); else M.tri(B, vids[t[0]], vids[t[1]], vids[t[2]]); } }
  M.restore();
  // boucle du bord, rééchantillonnée tous les 0,8 m au plus ; normale horizontale sortante (moyenne aux angles)
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.8));
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; // à droite du sens de parcours : l'extérieur
    if (L < 1e-6) continue;
    for (let i = 0; i < n; i++) loop.push({ x: lerp(a[0], b[0], i / n), z: lerp(a[1], b[1], i / n), nx, nz, corner: i === 0 });
  }
  for (let k = 0; k < loop.length; k++) if (loop[k].corner) { const p = loop[(k + loop.length - 1) % loop.length], q = loop[k], l = hyp(p.nx + q.nx, p.nz + q.nz) || 1; q.nx = (p.nx + q.nx) / l; q.nz = (p.nz + q.nz) / l; }
  let cx = 0, cz = 0; for (const p of loop) { cx += p.x; cz += p.z; } cx /= loop.length; cz /= loop.length;
  cx += (I.tip ? I.tip[0] : 0); cz += (I.tip ? I.tip[1] : 0);
  let s = 0; for (let k = 0; k < loop.length; k++) { loop[k].s = s; const q = loop[(k + 1) % loop.length]; s += hyp(q.x - loop[k].x, q.z - loop[k].z); }
  const per = s, S = stUnderShape(R, !!I.firm, !I.nocol), D = Math.max(6, (I.depth || 30) * S.depth);
  // rangs : la falaise (presque verticale, irrégulière) jusqu'à 3 m sous le dessus, puis la masse, un rang tous les 1,5 à 2,5 m (deux de part et
  // d'autre de chaque corniche, pour un surplomb net) jusqu'à la pointe
  let Yl = [];
  for (let y = -3.1 - R.range(1.2, 2.0); y > -D + 1.2; y -= R.range(1.5, 2.5)) Yl.push({ y });
  for (const L of S.ledges) { const y = -3.1 - L.t * (D - 3.1); Yl.push({ y: y + 0.3, ledge: true }, { y: y - 0.3, ledge: true }); }
  // un rang ordinaire trop près d'un rang de corniche s'efface (le surplomb reste net), puis deux rangs ordinaires trop proches
  Yl = Yl.filter((a) => a.ledge || !Yl.some((b) => b.ledge && Math.abs(b.y - a.y) < 0.4)).sort((a, b) => b.y - a.y);
  Yl = Yl.filter((a, i) => i === 0 || a.ledge || Yl[i - 1].y - a.y >= 0.35);
  const Y = [0, -0.3, -1.0, -2.0, -3.1, ...Yl.map((a) => a.y).filter((y) => y < -3.4), -D];
  const ring = Y.map((y, j) => loop.map((p) => {
    const t = clamp((-y - 3.1) / (D - 3.1), 0, 1), last = j === Y.length - 1, f0 = last ? 0.03 : stUnderScale(S, t, Math.atan2(p.z - cz, p.x - cx));
    // rocher flottant : la masse contient ses boîtes de collision (stFloatRock : 88 % du demi-côté jusqu'à 5,2 m sous le dessus, 60 % jusqu'à 8,5 m)
    const f = S.firm && !last ? Math.max(f0, y > -5.6 ? 0.96 : y > -8.9 ? 0.7 : 0) : f0;
    // relief : nul au bord du dessus (le bord des collisions), ressaut sous la lèvre, bosses et creux qui grandissent vers le bas, arêtes vives
    // (bruit en crêtes) dans la masse
    const nv = N.fbm(p.s / per, -y / 60, Math.max(4, Math.round(per / 6)), 4, 3) - 0.5, amp = (y === 0 ? 0 : y > -0.5 ? 0.12 : lerp(0.5, 1.6, t)) * (S.firm ? 0.4 : 1);
    const rg = y < -3 ? (0.45 - Math.abs(2 * N.fbm(p.s / per + 0.37, -y / 23, Math.max(6, Math.round(per / 3.5)), 6, 2) - 1)) * S.crag * lerp(0.5, 1.2, t) : 0;
    // grosses bosses et creux (une dizaine de mètres) : la masse n'est pas un cône régulier
    const Kl = Math.max(3, Math.round(per / 10)), lump = y < -3 ? (N.fbm(p.s / per + 0.31, -y / 13, Kl, 3, 2) - 0.5) * 2 * lerp(0.6, 2.6, t) * S.lumpy * smoothstep(-3, -6, y) : 0;
    let d = (y === 0 ? 0 : y > -0.5 ? -0.12 : 0.15) + nv * 2 * amp + rg + lump, fe = f;
    // île praticable : jusqu'à 21 m sous le dessus, la roche ne dépasse jamais le bord du dessus : on ne voit pas de corniche où se laisser tomber
    // (rien n'est solide hors des boîtes), et ni celui qui tombe ni sa caméra de mort (plan de mort à -14 m, puis 9 m de descente : 08-player.js)
    // ne traversent la roche ; les lobes ne sortent qu'en dessous. Plus haut, ce qui dépasserait rentre d'autant (une bosse devient un creux) :
    // la paroi reste irrégulière
    if (!I.nocol) { const k = smoothstep(-21, -27, y0 + y); if (f > 1) fe = lerp(1 - (f - 1) * 0.6, f, k); if (d > 0.15) d = lerp(0.15 - (d - 0.15) * 0.7, d, k); }
    if (S.firm && y > -8.9) d = Math.max(d, 0.15); // rocher flottant : rien ne rentre devant ses boîtes de collision
    const px = p.x + p.nx * d, pz = p.z + p.nz * d;
    return [cx + (px - cx) * fe, y0 + y + (j > 0 && !last ? (N.fbm(p.s / per, j / 7, Math.max(4, Math.round(per / 9)), 2, 2) - 0.5) * 0.5 : 0), cz + (pz - cz) * fe];
  }));
  const nL = loop.length, nR = Y.length, norm = [];
  for (let j = 0; j < nR; j++) for (let k = 0; k < nL; k++) {
    const a = ring[j][(k + 1) % nL], b = ring[j][(k + nL - 1) % nL], c = ring[Math.min(nR - 1, j + 1)][k], d = ring[Math.max(0, j - 1)][k];
    const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
    const p = loop[k]; if (nx * p.nx + nz * p.nz < 0 && j < nR - 1) { nx = -nx; ny = -ny; nz = -nz; }
    const l = hyp3(nx, ny, nz) || 1; norm.push([nx / l, ny / l, nz / l]);
  }
  M.save().local(1); M.cls = 1; M.aoFn = null;
  const B = M.buf('strata', cx, y0 - D / 2, cz), ids = [];
  for (let j = 0; j < nR; j++) for (let k = 0; k < nL; k++) {
    const q = ring[j][k], y = Y[j], n = norm[j * nL + k], h = N.fbm(loop[k].s / per, j / 9, 8, 2, 2);
    M.tint = stRockTint(y, 0.9 + (h - 0.5) * 0.3); // mousse et herbe qui débordent sous la lèvre, roche plus claire au soleil, plus sombre en profondeur
    ids.push(M.v(B, q[0], q[1], q[2], n[0], n[1], n[2], loop[k].s * S.band, stBandV(S, q, y0, cx, cz)));
  }
  for (let j = 0; j < nR - 1; j++) for (let k = 0; k < nL; k++) {
    const a = ids[j * nL + k], b = ids[j * nL + (k + 1) % nL], c = ids[(j + 1) * nL + (k + 1) % nL], d = ids[(j + 1) * nL + k];
    M.quadI(B, a, b, c, d); // face vers l'extérieur (l'île est à gauche du sens de parcours)
  }
  M.restore();
  stUnderParts(ring, Y, per, S, R, y0, D, cx, cz, !!I.nocol);
  return O;
}
/* Coordonnée v des strates (m) au point q : couches inclinées (pendage de l'île) et d'épaisseur propre */
const stBandV = (S, q, y0, cx, cz) => (q[1] - y0 + S.dip[0] * (q[0] - cx) + S.dip[1] * (q[2] - cz)) * S.band;
/* Teinte de la roche à la hauteur y sous le dessus (et v : variation du grain) : mousse sous la lèvre, plus claire au soleil, plus sombre et
   froide en profondeur */
function stRockTint(y, v) {
  const top = smoothstep(-1.4, -0.1, y), deep = smoothstep(-6, -26, y);
  return [lerp(lerp(1, 0.84, deep), ST.moss[0], top) * v, lerp(lerp(0.97, 0.86, deep), ST.moss[1], top) * v, lerp(lerp(0.92, 0.9, deep), ST.moss[2], top) * v].map((c) => sl(c));
}
/* Stalactites qui pendent de la masse (de tailles très inégales, plus nombreuses sous une île trapue ; sous une île qui se partage, une grande
   pointe sous chaque lobe), blocs incrustés et éclats de roche qui flottent autour : le dessous d'une île n'est pas une seule pointe.
   ring, Y : les rangs de la masse (coordonnées du monde). Sans collision, donc jamais là où l'on joue : sous une île praticable, rien ne dépasse
   le bord du dessus jusqu'à 22 m plus bas (comme la masse : chute et caméra de mort, voir stIsland) ; autour d'un rocher flottant, rien dans la
   bande des tirs (au-dessus de y = -2). Rien sous les îlots du décor du ciel (des cailloux de quelques pixels, jamais écartés) */
function stUnderParts(ring, Y, per, S, R, y0, D, cx, cz, nocol) {
  if (nocol && !S.firm) return;
  const M = DECOR, nR = Y.length, nL = ring[0].length, tOf = (j) => (-Y[j] - 3.1) / (D - 3.1);
  const mid = (j) => { let x = 0, z = 0; for (const q of ring[j]) { x += q[0]; z += q[2]; } return [x / nL, z / nL]; };
  // dans le contour du dessus (pair-impair) ; une île praticable garde ses pièces dedans jusqu'à 22 m sous le dessus, même dans un angle rentrant
  const top = ring[0], inTop = (x, z) => { let c = false; for (let i = 0, k = nL - 1; i < nL; k = i++) { const a = top[i], b = top[k]; if ((a[2] > z) !== (b[2] > z) && x < ((b[0] - a[0]) * (z - a[2])) / (b[2] - a[2]) + a[0]) c = !c; } return c; };
  const safe = (x, y, z) => nocol || y < -22 || inTop(x, z);
  const js = []; for (let j = 0; j < nR - 1; j++) { const t = tOf(j); if (t > 0.18 && t < 0.9 && (!S.firm || y0 + Y[j] < -2.8)) js.push(j); }
  if (!js.length) return;
  M.save().local(1); M.cls = 1; M.aoFn = null;
  // stalactite au point k du rang j : racine enfoncée dans la masse (son anneau reste dedans), un peu sous le rang ; rayon r0, longueur L,
  // légère inclinaison vers l'extérieur
  const stal = (j, k, r0, L) => {
    const a = ring[j][k], [mx, mz] = mid(j), rl = hyp(a[0] - mx, a[2] - mz) || 1, ox = (a[0] - mx) / rl, oz = (a[2] - mz) / rl;
    const rx = a[0] - ox * r0 * 1.3, rz = a[2] - oz * r0 * 1.3, ry = a[1] - r0 * 0.1, lean = R.range(0, 0.28) * L, K = 6 + Math.floor(R() * 3), ph = R() * TAU;
    const V = [0, 0.12, 0.3, 0.5, 0.7, 0.86, 1], B = M.buf('strata', rx, ry - L / 2, rz), pts = [];
    for (const v of V) for (let q = 0; q <= K; q++) { // K + 1 colonnes : la dernière double la première (raccord de la texture)
      const ang = ph + (q / K) * TAU + v * R.range(-0.4, 0.4), w = v === 1 ? 0.02 : (1 - Math.pow(v, 1.2) * 0.96) * (1 + R.range(-0.16, 0.16));
      const cxv = rx + ox * lean * Math.pow(v, 1.6), czv = rz + oz * lean * Math.pow(v, 1.6);
      pts.push([cxv + Math.cos(ang) * r0 * w, ry - v * L, czv + Math.sin(ang) * r0 * w]);
    }
    for (let vi = 0; vi < V.length; vi++) pts[vi * (K + 1) + K] = pts[vi * (K + 1)];
    if (!pts.every((p) => safe(p[0], p[1], p[2]))) return;
    const ids = [], C = K + 1;
    for (let vi = 0; vi < V.length; vi++) for (let q = 0; q <= K; q++) {
      const qq = q % K, p = pts[vi * C + q], pa = pts[vi * C + (qq + 1) % K], pb = pts[vi * C + (qq + K - 1) % K], pc = pts[Math.min(V.length - 1, vi + 1) * C + qq], pd = pts[Math.max(0, vi - 1) * C + qq];
      const tx = pa[0] - pb[0], ty = pa[1] - pb[1], tz = pa[2] - pb[2], vx = pc[0] - pd[0], vy = pc[1] - pd[1], vz = pc[2] - pd[2]; // le long du tour, vers le bas : normale sortante
      let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx; const l = hyp3(nx, ny, nz) || 1;
      M.tint = stRockTint(p[1] - y0, R.range(0.84, 1.04));
      ids.push(M.v(B, p[0], p[1], p[2], nx / l, ny / l, nz / l, (q / K) * TAU * r0 * S.band, stBandV(S, p, y0, cx, cz)));
    }
    for (let vi = 0; vi < V.length - 1; vi++) for (let q = 0; q < K; q++) M.quadI(B, ids[vi * C + q], ids[vi * C + q + 1], ids[(vi + 1) * C + q + 1], ids[(vi + 1) * C + q]); // même sens que la masse
    // haut fermé (au cas où l'anneau de la racine affleure) : un éventail tourné vers le haut
    M.tint = stRockTint(ry - y0, 0.9); const cap = M.v(B, rx, ry + r0 * 0.2, rz, 0, 1, 0, 0, stBandV(S, [rx, ry, rz], y0, cx, cz));
    const rim = []; for (let q = 0; q <= K; q++) { const p = pts[q]; rim.push(M.v(B, p[0], p[1], p[2], 0, 1, 0, (q / K) * TAU * r0 * S.band, stBandV(S, p, y0, cx, cz))); }
    for (let q = 0; q < K; q++) M.tri(B, cap, rim[q + 1], rim[q]);
  };
  // trois familles : dents courtes et larges, pointes moyennes, longues aiguilles
  const n = Math.min(9, Math.max(1, Math.round((per / 22) * S.pend + R.range(-0.5, 1.5))));
  for (let i = 0; i < n; i++) {
    const j = R.pick(js), k = Math.floor(R() * nL), a = ring[j][k], [mx, mz] = mid(j), rl = hyp(a[0] - mx, a[2] - mz), fam = R();
    if (rl < 1.2) continue;
    const r0 = clamp(rl * (fam < 0.3 ? R.range(0.18, 0.3) : fam < 0.75 ? R.range(0.1, 0.22) : R.range(0.05, 0.12)), 0.4, 5);
    stal(j, k, r0, r0 * (fam < 0.3 ? R.range(1.3, 2.2) : fam < 0.75 ? R.range(2.4, 4.0) : R.range(4.5, 7.5)) + R.range(0, 2));
  }
  // île qui se partage : une grande pointe sous chaque lobe (vers les deux tiers de la masse, au sommet du lobe), qui descend presque aussi bas
  // que la pointe principale : la masse finit en deux ou trois pointes de plus
  if (S.split) for (let m = 0; m < S.split.k; m++) {
    const tt = R.range(0.56, 0.68), j = js.reduce((b, i) => (Math.abs(tOf(i) - tt) < Math.abs(tOf(b) - tt) ? i : b), js[0]);
    const th = (TAU * m - S.split.ph - S.twist * tOf(j) * 0.5) / S.split.k;
    let k = 0, best = 9;
    for (let i = 0; i < nL; i++) { const q = ring[0][i], e = Math.atan2(q[2] - cz, q[0] - cx) - th, d = Math.abs(Math.atan2(Math.sin(e), Math.cos(e))); if (d < best) { best = d; k = i; } }
    const a = ring[j][k], [mx, mz] = mid(j), rl = hyp(a[0] - mx, a[2] - mz), r0 = clamp(rl * R.range(0.24, 0.34), 0.8, 5);
    if (rl > 1.2) stal(j, k, r0, r0 * 1.2 + (D + Y[j]) * R.range(0.55, 0.95));
  }
  // blocs incrustés : des rochers à demi enfoncés dans la masse, qui la rendent bosselée. Sous une île praticable, jusqu'à 22 m sous le dessus,
  // un bloc ne dépasse pas le bord du dessus (on l'enfonce d'autant) ; autour d'un rocher flottant, aucun dans la bande des tirs
  const nb = Math.min(10, Math.round(per / 16 + R.range(0, 2)));
  for (let i = 0; i < nb; i++) {
    const j = R.pick(js), k = Math.floor(R() * nL), a = ring[j][k], [mx, mz] = mid(j), rl = hyp(a[0] - mx, a[2] - mz) || 1;
    const s = clamp(rl * R.range(0.1, 0.24), 0.8, 4.5), ox = (a[0] - mx) / rl, oz = (a[2] - mz) / rl, rx = s * R.range(0.9, 1.6), ry = s * R.range(0.55, 1.1), rz = s * R.range(0.7, 1.0);
    const e = 1.2 * Math.max(rx, ry, rz) + 0.3 * ry; // portée du bloc autour du point du rang (bosses, inclinaison et décalage de rockMesh compris)
    if (S.firm && a[1] + e > -2) continue;
    let cin = s * 0.55;
    if (!nocol && a[1] + e > -22) {
      const q = top[k]; cin = Math.max(cin, e - Math.max(0, (q[0] - a[0]) * ox + (q[2] - a[2]) * oz));
      let ok = true; for (let m = 0; m < 8 && ok; m++) ok = inTop(a[0] - ox * cin + Math.cos((m * TAU) / 8) * e, a[2] - oz * cin + Math.sin((m * TAU) / 8) * e);
      if (!ok) continue; // dans un angle rentrant du contour : il en sortirait
    }
    if (e - cin < 0.15 * e) continue; // presque tout dans la masse : on ne le verrait pas
    // retourné (rotZ), le rocher descend de 0,75 · ry sous son origine (rockMesh le pose sur le sol) : on le remonte d'autant
    M.save().move(a[0] - ox * cin, a[1] + ry * 0.75, a[2] - oz * cin).rotY(R() * TAU).rotZ(Math.PI + R.range(-0.4, 0.4)); M.tint = stRockTint(a[1] - y0, R.range(0.84, 1.02));
    rockMesh(M, R, rx, ry, rz, 5 + Math.floor(R() * 4), 8, 6, 'strata', false); // taillé de facettes : pas un galet
    M.restore();
  }
  // éclats : de la roche détachée qui flotte sous la pointe ou à côté de la masse, sur le côté seulement loin sous le dessus (plus bas que la
  // caméra de mort : on ne croit pas pouvoir y sauter) ; sous un rocher flottant, seulement sous sa pointe
  const deep = js.filter((j) => y0 + Y[j] < -26), ne = Math.min(5, Math.round(per / 40 + R.range(0, 1.6)));
  for (let i = 0; i < ne; i++) {
    const under = S.firm || !deep.length || R() < 0.35, j = R.pick(under ? js : deep), k = Math.floor(R() * nL), a = ring[j][k], [mx, mz] = mid(j), rl = hyp(a[0] - mx, a[2] - mz) || 1;
    const s = clamp(Math.sqrt(per) * R.range(0.08, 0.2), 0.4, 2.2), g = R.range(0.84, 1.02);
    const x = under ? mx + R.range(-2, 2) : a[0] + ((a[0] - mx) / rl) * R.range(1.5, 4.5), z = under ? mz + R.range(-2, 2) : a[2] + ((a[2] - mz) / rl) * R.range(1.5, 4.5);
    const y = under ? y0 - D - R.range(2, 7) : a[1] - R.range(-1, 3);
    if (y + s * 1.5 > (nocol ? -2 : -22)) continue; // pas de collision : jamais à hauteur d'homme, dans un couloir de tir, ni où l'on tombe
    M.save().move(x, y, z).rotY(R() * TAU).rotX(R.range(-0.5, 0.5)); M.tint = stRockTint(y - y0, g);
    rockMesh(M, R, s * R.range(0.8, 1.5), s * R.range(0.5, 1.0), s * R.range(0.6, 1.0), 5 + Math.floor(R() * 4), 7, 5, 'strata', false);
    M.restore();
  }
  M.restore();
}
/* Rocher flottant : une petite île sans prise (son dessus est au-dessus des têtes), posée dans le vide entre deux îles pour couper les vues
   d'un bout à l'autre de l'archipel. r : [x0, x1, z0, z1] (multiples de 0,5 m), top : hauteur du dessus. Coins abattus ; collisions
   (balles, lignes de vue) en deux boîtes qui restent dans la roche : la falaise, puis la masse qui se resserre */
function stFloatRock(r, top, depth, seed) {
  const [x0, x1, z0, z1] = r, w = x1 - x0, d = z1 - z0;
  stIsland({ rects: [[x0 + 0.5, x1 - 0.5, z0, z1], [x0, x1, z0 + 0.5, z1 - 0.5]], depth, seed, y: top, nocol: true, firm: true });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // deux boîtes par étage, aux coins abattus comme le dessus : rien ne dépasse de la roche visible (sa masse les contient : firm)
  DECOR.col(cx - w * 0.44, cx + w * 0.44, top - 5.2, top, cz - d * 0.44 + 0.55, cz + d * 0.44 - 0.55, 'concrete');
  DECOR.col(cx - w * 0.44 + 0.55, cx + w * 0.44 - 0.55, top - 5.2, top, cz - d * 0.44, cz + d * 0.44, 'concrete');
  DECOR.col(cx - w * 0.3, cx + w * 0.3, top - 8.5, top - 5.2, cz - d * 0.3 + 0.3, cz + d * 0.3 - 0.3, 'concrete');
  DECOR.col(cx - w * 0.3 + 0.3, cx + w * 0.3 - 0.3, top - 8.5, top - 5.2, cz - d * 0.3, cz + d * 0.3, 'concrete');
}

/* ---------- Ponts suspendus ---------- */
/* Pont le long de axis ('x' ou 'z'), centré sur c (l'autre coordonnée), du bord d'une île (a0) au bord de l'autre (a1), largeur w entre les
   murs invisibles (3 m : trois files de nœuds si c est un centre de case n + 0,5 ; 4 m si c est entier). Rend la hauteur du tablier. */
function stBridge(axis, c, a0, a1, w = 3) {
  const L = a1 - a0, sag = Math.min(0.5, 0.1 + L * 0.024), M = DECOR, R = rngOf(Math.round(c * 37 + a0 * 13 + 101));
  BRIDGES.push({ axis, c, a0, a1, w });
  const yAt = (a) => (a <= a0 || a >= a1 ? 0 : -sag * 4 * ((a - a0) / L) * (1 - (a - a0) / L));
  const at = (u, y, a) => (axis === 'z' ? [c + u, y, a] : [a, y, c + u]); // u : écart à l'axe, a : abscisse le long du pont
  const box3 = (u0, u1, y0, y1, b0, b1) => (axis === 'z' ? [c + u0, c + u1, y0, y1, b0, b1] : [b0, b1, y0, y1, c + u0, c + u1]);
  // collisions : le tablier en tronçons d'un mètre (des marches de quelques centimètres), qui dépasse de 0,6 m sur chaque île
  for (let b = a0 - 0.6; b < a1 + 0.6 - 1e-6; b += 1) {
    const e = Math.min(b + 1, a1 + 0.6), y = yAt((b + e) / 2), q = box3(-w / 2, w / 2, y - 0.25, y, b, e);
    DECOR.col(q[0], q[1], q[2], q[3], q[4], q[5], 'wood');
  }
  // murs invisibles au-dessus du vide (les cordes et les filets retiennent ; trop hauts pour un saut) : ni couverts, ni obstacles aux grenades
  for (const sd of [-1, 1]) { const q = box3(sd < 0 ? -w / 2 - 0.1 : w / 2, sd < 0 ? -w / 2 : w / 2 + 0.1, -sag - 0.6, 2.2, a0, a1); COL.push({ x0: q[0], x1: q[1], y0: q[2], y1: q[3], z0: q[4], z1: q[5], m: 'wood', ray: false, noRay: true, inv: true }); }
  // planches (teintes inégales, quelques-unes plus sombres ou de travers), sur deux longerons ; leur dessus est 2,5 cm au-dessus du tablier
  // de collision : à chaque bout, posées sur l'île, elles affleuraient exactement le sol (y = 0) et scintillaient avec lui
  M.save().local(1); M.cls = 0;
  for (let a = a0 - 0.45; a < a1 + 0.45; a += 0.26) {
    const y = yAt(a + 0.1), k = R.range(0.8, 1.08), dk = R.chance(0.08) ? 0.7 : 1;
    M.color([ST.wood[0] * k * dk, ST.wood[1] * k * dk, ST.wood[2] * k * dk]);
    M.save().move(...at(R.range(-0.04, 0.04), y - 0.035, a + 0.11)).rotY((axis === 'z' ? 0 : Math.PI / 2) + R.range(-0.02, 0.02));
    M.box('wood', w + 0.16, 0.06, 0.22, { bevel: 0.01 }); M.restore();
  }
  M.color([0.62, 0.52, 0.42]);
  for (const u of [-w / 2 + 0.25, w / 2 - 0.25]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const a = lerp(a0 - 0.5, a1 + 0.5, i / 16); pts.push(at(u, yAt(a) - 0.16, a)); }
    M.sweep('wood', [[-0.08, -0.1], [0.08, -0.1], [0.08, 0.1], [-0.08, 0.1]], pts);
  }
  M.restore();
  // poteaux aux quatre coins (sur les îles, hors de la largeur du tablier : ils ne gênent pas le passage), cordes, suspentes et filets
  const posts = [];
  for (const end of [0, 1]) for (const sd of [-1, 1]) {
    const a = end ? a1 + 0.35 : a0 - 0.35, u = sd * (w / 2 + 0.16), p = at(u, 0, a);
    M.save().move(p[0], 0, p[2]).color([0.6, 0.48, 0.36]); M.cls = 0; M.boxB('wood', -0.11, 0.11, 0, 1.45, -0.11, 0.11, { bevel: 0.02 }); M.restore();
    DECOR.col(p[0] - 0.12, p[0] + 0.12, 0, 1.45, p[2] - 0.12, p[2] + 0.12, 'wood');
    posts.push({ end, sd, p });
  }
  M.save().local(1).color(ST.rope); M.cls = 1;
  for (const sd of [-1, 1]) {
    const u = sd * (w / 2 + 0.06), top = [], low = [];
    for (let i = 0; i <= 20; i++) {
      const a = lerp(a0 - 0.35, a1 + 0.35, i / 20), t = (a - a0) / L, droop = 4 * clamp(t, 0, 1) * (1 - clamp(t, 0, 1));
      top.push(at(u, yAt(a) + 1.32 - droop * 0.22, a)); low.push(at(u, yAt(a) + 0.62 - droop * 0.08, a));
    }
    M.tube('rope', 0.032, top, 6); M.tube('rope', 0.022, low, 5);
    // suspentes tous les 0,9 m environ, de la main courante au tablier
    const n = Math.max(2, Math.round(L / 0.9));
    for (let i = 1; i < n; i++) { const a = lerp(a0, a1, i / n), t = (a - a0) / L, droop = 4 * t * (1 - t); M.tube('rope', 0.012, [at(u, yAt(a) - 0.02, a), at(u, yAt(a) + 1.32 - droop * 0.22, a)], 4); }
    // filet entre le tablier et la corne basse : on voit que le bord retient
    const B = M.buf('net', ...at(u, 0.3, (a0 + a1) / 2)), ids = [];
    for (let i = 0; i <= 12; i++) {
      const a = lerp(a0, a1, i / 12), t = (a - a0) / L, droop = 4 * t * (1 - t), yb = yAt(a) - 0.02, yt = yAt(a) + 0.62 - droop * 0.08, nn = axis === 'z' ? [sd, 0, 0] : [0, 0, sd];
      const pb = at(u, yb, a), pt = at(u, yt, a);
      ids.push(M.v(B, pb[0], pb[1], pb[2], ...nn, a, yb), M.v(B, pt[0], pt[1], pt[2], ...nn, a, yt));
    }
    for (let i = 0; i < 12; i++) { const a = ids[i * 2], b = ids[i * 2 + 2], cc = ids[i * 2 + 3], d = ids[i * 2 + 1]; M.quadI(B, a, b, cc, d); M.quadI(B, a, d, cc, b); }
  }
  // haubans : du sommet de chaque poteau à un piquet planté 1,6 m en arrière sur l'île
  for (const P of posts) {
    const a = P.end ? a1 + 1.95 : a0 - 1.95, s = at(P.sd * (w / 2 + 0.5), 0.05, a);
    M.tube('rope', 0.028, [[P.p[0], 1.4, P.p[2]], [(P.p[0] + s[0]) / 2, 0.68, (P.p[2] + s[2]) / 2], s], 5);
    M.save().move(s[0], 0, s[2]).color([0.5, 0.4, 0.3]); M.cyl('wood', 0.06, 0.32, 6, { r1: 0.045 }); M.restore();
    LINES.push({ k: 'hauban', a: [P.p[0], 1.4, P.p[2]], b: s });
  }
  M.restore();
  return yAt;
}

/* ---------- Objets ---------- */
/* Colonne de ruine en pierre : socle, fût cannelé, chapiteau ; h : hauteur ; broken : fût cassé en biseau (sans chapiteau). Collision du fût. */
PF.stColumn = (h = 4, broken = false, seed = 1) => prefab(`stColumn${h}_${broken ? 1 : 0}_${seed}`, (M, P) => {
  const R = rngOf(seed * 31 + 5); void P;
  M.color(ST.stone).local(1);
  M.boxB('stone', -0.48, 0.48, 0, 0.32, -0.48, 0.48, { bevel: 0.03 });
  const hs = broken ? h * R.range(0.45, 0.8) : h - 0.62;
  M.save().move(0, 0.32, 0); M.cyl('ashlar', 0.34, hs, 16, { r1: 0.3, caps: broken ? 'b' : 'bt' }); M.restore();
  if (broken) { M.save().move(0, 0.32 + hs, 0).rotZ(R.range(0.25, 0.45)); M.cyl('ashlar', 0.3, 0.12, 16, { r1: 0.05, caps: 't' }); M.restore(); }
  else { M.boxB('stone', -0.44, 0.44, h - 0.3, h, -0.44, 0.44, { bevel: 0.03 }); M.save().move(0, h - 0.3, 0); M.cyl('stone', 0.3, -0.2, 16, { r1: 0.4, caps: '' }); M.restore(); }
  M.col(-0.42, 0.42, 0, broken ? 0.32 + hs : h, -0.42, 0.42, 'concrete');
});
/* Bloc de pierre taillée (tombé d'une ruine) : couvert bas */
PF.stBlock = (w = 1.4, h = 0.9, d = 0.8, seed = 1) => prefab(`stBlock${w}_${h}_${d}_${seed}`, (M) => {
  const R = rngOf(seed * 17 + 1);
  M.color([ST.stone[0] * R.range(0.9, 1.02), ST.stone[1] * R.range(0.9, 1.02), ST.stone[2] * R.range(0.9, 1.02)]).local(1);
  M.boxB('ashlar', -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.05 });
  M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, 'concrete');
});
/* Rocher : bloc de roche stratifiée irrégulier (rockMesh), collision de sa boîte resserrée ; s : taille (m), squash : aplatissement */
PF.stRock = (s = 1.6, seed = 1, squash = 0.75) => prefab(`stRock${s}_${seed}_${squash}`, (M) => {
  const R = rngOf(seed * 13 + 7);
  M.color([R.range(0.86, 1), R.range(0.82, 0.94), R.range(0.76, 0.88)]).local(1);
  rockMesh(M, R, s * 0.62, s * 0.62 * squash, s * 0.55, 2, 8, 5, 'strata');
  M.col(-s * 0.5, s * 0.5, 0, s * 0.62 * squash * 1.7, -s * 0.44, s * 0.44, 'concrete');
});
/* Grappe de cristaux plantée au sol (bleu pâle, lumineux par eux-mêmes) ; h : hauteur du plus grand */
PF.stCrystals = (h = 1.6, seed = 1) => prefab(`stCrystals${h}_${seed}`, (M) => {
  const R = rngOf(seed * 19 + 11), n = 3 + Math.floor(R() * 3);
  M.local(1); M.cls = 1;
  for (let i = 0; i < n; i++) {
    const hh = h * (i ? R.range(0.35, 0.75) : 1), r = hh * 0.16, a = R() * TAU, d = i ? R.range(0.15, 0.4) : 0;
    M.save().move(Math.cos(a) * d, -0.05, Math.sin(a) * d).rotY(R() * TAU).rotZ(i ? R.range(-0.5, 0.5) : R.range(-0.12, 0.12)).rotX(i ? R.range(-0.4, 0.4) : 0);
    M.color([R.range(0.85, 1), R.range(0.92, 1), 1]);
    M.cyl('crystalSt', r, hh * 0.78, 6, { r1: r * 0.9, caps: 'b' }); M.save().move(0, hh * 0.78, 0); M.cyl('crystalSt', r * 0.9, hh * 0.22, 6, { r1: 0.001, caps: '' }); M.restore();
    M.restore();
  }
  M.cls = 0; M.col(-h * 0.2, h * 0.2, 0, h * 0.85, -h * 0.2, h * 0.2, 'glass');
});
/* Aiguille rocheuse (h : hauteur, r : rayon à la base) : grand bloc de roche stratifiée qui coupe les vues d'une île à l'autre ; collision
   de son fût, resserrée */
PF.stSpire = (h = 5, r = 1.4, seed = 1) => prefab(`stSpire${h}_${r}_${seed}`, (M) => {
  const R = rngOf(seed * 29 + 3);
  M.color([R.range(0.88, 1), R.range(0.84, 0.95), R.range(0.78, 0.88)]).local(1);
  rockMesh(M, R, r, h / 1.75, r * R.range(0.8, 1.0), 3, 10, 7, 'strata');
  // un second bloc accolé, plus bas : la silhouette n'est pas un fuseau régulier
  M.save().move(r * 0.7, 0, r * 0.3).rotY(R() * TAU); rockMesh(M, R, r * 0.7, h * 0.32, r * 0.65, 2, 8, 5, 'strata'); M.restore();
  M.col(-r * 0.78, r * 0.78, 0, h * 0.92, -r * 0.7, r * 0.7, 'concrete');
});
/* Pierre levée (menhir) : bloc dressé, légèrement penché, de la pierre des ruines */
PF.stMenhir = (h = 3.6, w = 1.2, seed = 1) => prefab(`stMenhir${h}_${w}_${seed}`, (M) => {
  const R = rngOf(seed * 23 + 9), d = w * 0.62;
  M.color([ST.stone[0] * R.range(0.84, 0.96), ST.stone[1] * R.range(0.84, 0.95), ST.stone[2] * R.range(0.82, 0.92)]).local(1);
  M.save().rotZ(R.range(-0.04, 0.04)).rotX(R.range(-0.03, 0.03));
  M.boxB('stone', -w / 2, w / 2, 0, h * 0.86, -d / 2, d / 2, { bevel: 0.08 });
  M.save().move(0, h * 0.86, 0).scl(1, 1, d / w); M.cyl('stone', w * 0.5, h * 0.14, 8, { r1: w * 0.26, caps: 't' }); M.restore();
  M.restore();
  M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, 'concrete');
});
/* Stèle : grande dalle de pierre dressée à une tête de pont (elle arrête la vue d'un bout à l'autre de l'archipel, on la contourne), un
   cristal serti sur chaque face ; w : largeur, h : hauteur, d : épaisseur. Collision de la dalle */
PF.stStele = (w = 4.6, h = 3.6, d = 0.9, seed = 1) => prefab(`stStele${w}_${h}_${d}_${seed}`, (M) => {
  const R = rngOf(seed * 43 + 7), k = R.range(0.86, 0.96);
  M.local(1);
  M.color([ST.stone[0] * 0.8, ST.stone[1] * 0.78, ST.stone[2] * 0.74]);
  M.boxB('stone', -w / 2 - 0.18, w / 2 + 0.18, 0, 0.3, -d / 2 - 0.18, d / 2 + 0.18, { bevel: 0.05 });
  M.color([ST.stone[0] * k, ST.stone[1] * k, ST.stone[2] * k * 0.97]);
  M.boxB('ashlar', -w / 2, w / 2, 0.3, h - 0.5, -d / 2, d / 2, { bevel: 0.06 });
  M.boxB('ashlar', -w / 2 + 0.4, w / 2 - 0.4, h - 0.5, h, -d / 2 + 0.06, d / 2 - 0.06, { bevel: 0.06 });
  M.color([0.9, 1, 1]); M.cls = 1;
  for (const sz of [-1, 1]) { M.save().move(0, h * 0.6, sz * (d / 2 - 0.02)).rotX(sz * Math.PI / 2); M.cyl('crystalSt', 0.3, 0.08, 6, { r1: 0.22 }); M.restore(); }
  M.cls = 0;
  M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, 'concrete');
});
/* Trilithe : deux pierres levées et leur linteau (on passe dessous) */
PF.stTrilithon = (seed = 1) => prefab(`stTrilithon${seed}`, (M) => {
  const R = rngOf(seed * 41 + 5), H = 3.4, w = 1.0, d = 0.7, gap = 1.9;
  M.local(1);
  for (const sx of [-1, 1]) {
    const x = sx * (gap / 2 + w / 2);
    M.color([ST.stone[0] * R.range(0.86, 0.96), ST.stone[1] * R.range(0.85, 0.95), ST.stone[2] * R.range(0.82, 0.92)]);
    M.boxB('stone', x - w / 2, x + w / 2, 0, H, -d / 2, d / 2, { bevel: 0.07 });
    M.col(x - w / 2, x + w / 2, 0, H, -d / 2, d / 2, 'concrete');
  }
  M.color([ST.stone[0] * 0.92, ST.stone[1] * 0.9, ST.stone[2] * 0.86]);
  M.boxB('stone', -gap / 2 - w - 0.15, gap / 2 + w + 0.15, H, H + 0.62, -d / 2 - 0.04, d / 2 + 0.04, { bevel: 0.07 });
  M.col(-gap / 2 - w - 0.15, gap / 2 + w + 0.15, H, H + 0.62, -d / 2 - 0.04, d / 2 + 0.04, 'concrete');
});
/* Tente d'expédition : toile tendue sur un faîtage (deux pans jusqu'au sol, pignons fermés), à la couleur du camp ; arrête les balles et les
   soldats (w : largeur, L : longueur, h : faîtage). Les deux pans sont des toiles simulées (Maker.toile), tenues au faîtage, au sol et aux
   pignons */
PF.stTent = (col, w = 3.2, L = 4.2, h = 2.4) => prefab(`stTent${col.join(',')}_${w}_${L}_${h}`, (M) => {
  M.color(col).local(1); M.cls = 0;
  const x = w / 2, z = L / 2;
  for (const s of [-1, 1]) M.toile(4, 3, (u, v) => [s * x * (1 - v), v * h, lerp(-z, z, u)], { uL: L, vL: hyp(x, h), side: [s * h, x, 0], play: 0.1 });
  M.color([col[0] * 0.85, col[1] * 0.85, col[2] * 0.85]);
  for (const sz of [-1, 1]) M.tri3('canvas', [-x, 0, sz * z], [x, 0, sz * z], [0, h, sz * z], [0, 0, sz]);
  M.color([0.5, 0.4, 0.3]); for (const sz of [-1, 1]) { M.save().move(0, 0, sz * (z + 0.05)); M.cyl('wood', 0.04, h + 0.2, 6); M.restore(); }
  M.col(-x * 0.7, x * 0.7, 0, h * 0.75, -z, z, 'dirt');
});
/* Pile de caisses : deux en bas, une dessus (couvert haut) */
PF.stCrateStack = (seed = 1) => prefab(`stCrateStack${seed}`, (M) => {
  const R = rngOf(seed * 7 + 2), s = 1.1;
  M.place(PF.crate(s), -0.58, 0, R.range(-0.05, 0.05), R.range(-0.08, 0.08)); M.place(PF.crate(s), 0.58, 0, R.range(-0.05, 0.05), R.range(-0.08, 0.08));
  M.place(PF.crate(1.0), R.range(-0.3, 0.3), s, 0, R.range(-0.4, 0.4));
});
