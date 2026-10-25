/* ==========================================================================
   KIT DU DÉSERT : surfaces, matières et objets de Simoun, l'arène ronde au milieu des dunes.
   - Le sable des dunes (surface procédurale dune) : rides de vent courbes, au dos long et au front raide, des plages lissées, un grain ; le
     relief lui-même est dans 02-relief.js et la fonction des dunes dans 02yl-simoun.js ;
   - Surfaces photo (Poly Haven, CC0 ; chargées seulement pour une carte qui les demande, `textures` de sa définition) : le pisé des ruines
     (terre damée), les briques de terre crue, les galets et la vase craquelée des berges de l'oasis. À défaut (réseau coupé), une surface
     procédurale proche les remplace (simounKit) ;
   - Massifs de grès (smMassif) : des rectangles de collision, une paroi d'une seule boucle de sommets qui monte du pied au sommet, ses
     corniches calées sur les mêmes couches d'un massif à l'autre, une patine du désert en coulées sombres et un dessus de roche ou de sable ;
   - Pisé : murs ruinés de l'oasis (smRuin, arase cassée) ;
   - Camps de fortune : tente bédouine en bandes de laine (PF.smBedouin), cabane de tôle et de planches (smShack), mirador de bois et son
     escalier (smWatchtower), murets de sacs de sable (smSandbags), bâche tendue sur des perches (smTarp), foyer (PF.smFire) ;
   - L'épave d'un avion de ligne à aile basse (smPlane) : fuselage cassé en deux où l'on entre, cabine aux sièges 3 + 3 (PF.smSeats3),
     coffres et plafond, toit et ailes praticables (on monte sur le toit par les congères), dérive bleue, réacteurs arrachés (PF.smJetEngine) ;
   - Végétation et objets : palmiers (PF.palm de 02h-nature.js, nervures et version allégée), roseaux, acacia, puits, jarres, charrette ;
   - La vie du désert : tourbillons de poussière qui errent sur le sable, vautours.
   Tout se pose sur le relief (gy0) et se libère avec la carte.
   ========================================================================== */
Object.assign(TEXSCALE, { pise: 2.4, adobe: 1.8, galets: 1.7, vase: 4.4, gres: 9.0, dune: 3.2, reg: 2.8 });
Object.assign(TEXLAB, {
  /* grès rouge des falaises : bancs d'épaisseur inégale, ondulés, stratification oblique dans chaque banc, diaclases verticales propres à
     chaque banc, lits creusés entre deux bancs, coulées sombres de patine du désert, grain */
  gres: [1024, 83, 2.6, `
    float big = gfbm(uv, vec2(2.0), 5, 1.0), mid = gfbm(uv, vec2(8.0), 4, 2.0), fine = gfbm(uv, vec2(32.0), 3, 3.0), grain = gfbm(uv, vec2(96.0), 2, 4.0);
    float ly = uv.y * 5.0 + (big - 0.5) * 0.8 + (mid - 0.5) * 0.18;
    float band = fract(ly), bid = mod(floor(ly), 5.0), hb = hs(vec2(bid, 0.0), 7.0);
    float cr = fract(uv.x * 14.0 + band * (1.5 + hb * 2.5) + hs(vec2(bid, 2.0), 3.0) * 4.0);
    float xb = smoothstep(0.0, 0.07, cr) * (1.0 - smoothstep(0.07, 0.15, cr));
    float jx = uv.x * 7.0 + hs(vec2(bid, 3.0), 5.0) * 7.0 + (gfbm(uv, vec2(2.0, 8.0), 3, 6.0) - 0.5) * 0.5, jf = fract(jx);
    float joint = (1.0 - smoothstep(0.0, 0.035, min(jf, 1.0 - jf))) * step(0.45, hs(vec2(mod(floor(jx), 7.0), bid), 8.0)) * smoothstep(0.03, 0.12, band) * (1.0 - smoothstep(0.88, 0.97, band));
    float bed = 1.0 - smoothstep(0.0, 0.07, band) * (1.0 - smoothstep(0.92, 1.0, band));
    float streak = smoothstep(0.58, 0.8, gfbm(uv, vec2(24.0, 1.0), 3, 9.0)) * smoothstep(0.2, 0.9, band);
    h = 0.55 + (1.0 - bed) * 0.1 + (hb - 0.5) * 0.12 + mid * 0.2 + fine * 0.12 - joint * 0.3 - xb * 0.04;
    vec3 c0 = srgb(vec3(0.8, 0.5, 0.33)), c1 = srgb(vec3(0.9, 0.7, 0.52)), c2 = srgb(vec3(0.72, 0.42, 0.27)), c3 = srgb(vec3(0.86, 0.6, 0.42));
    a = hb < 0.3 ? c0 : hb < 0.55 ? c1 : hb < 0.8 ? c3 : c2;
    a *= (0.84 + mid * 0.22 + grain * 0.1) * (1.0 - joint * 0.4) * (1.0 - bed * 0.18) * (1.0 - xb * 0.1) * (1.0 - streak * 0.38);
    r = 0.88 + fine * 0.08; x = h;`],
  /* sable des dunes : rides de vent courbes (dos long, front raide), effacées par plages, grain fin, nuances de l'ocre au doré */
  dune: [1024, 61, 1.5, `
    float w = gfbm(uv, vec2(2.0), 4, 1.0), w2 = gfbm(uv, vec2(6.0), 3, 2.0);
    float ph = uv.y * 16.0 + uv.x * 3.0 + (w - 0.5) * 3.2 + (w2 - 0.5) * 0.9, f = fract(ph);
    float rip = smoothstep(0.0, 0.72, f) * (1.0 - smoothstep(0.72, 1.0, f));
    float fade = smoothstep(0.38, 0.8, gfbm(uv + 0.17, vec2(3.0), 3, 3.0));
    float big = gfbm(uv, vec2(3.0), 4, 4.0), gr = vn(uv * 512.0, vec2(512.0), 5.0);
    h = rip * (0.2 + 0.8 * fade) * 0.3 + big * 0.25 + gr * 0.07;
    vec3 c0 = srgb(vec3(0.9, 0.66, 0.43)), c1 = srgb(vec3(0.94, 0.74, 0.52)), c2 = srgb(vec3(0.82, 0.57, 0.36));
    a = mix(c2, c1, smoothstep(0.2, 0.8, big)); a = mix(a, c0, 0.3);
    a *= 0.93 + rip * fade * 0.09 + (gr - 0.5) * 0.12;
    r = 0.9 + gr * 0.05; x = h;`],
});
OPT_TEX.add('gres'); OPT_TEX.add('dune');
/* Surfaces procédurales que Simoun demande (`surfaces` de sa définition) : l'eau de l'oasis, le grès des rochers, le sable des dunes */
const SIMOUN_SURFACES = ['ripple', 'gres', 'dune', 'palmbark', 'drystone'];

/* Couleurs. Les deux moitiés se distinguent : bâches vertes et drapeaux verts au nord (Alpha, +z), bâches bleues au sud (Bravo, -z) */
const SM = {
  accent: [[0.16, 0.42, 0.26], [0.12, 0.3, 0.62]],
  wood: [0.62, 0.48, 0.36], palm: [0.58, 0.46, 0.34], rock: [1.0, 0.94, 0.9], rockP: [1.16, 0.88, 0.7], // rockP : sur la photo de falaise
  rust: [[0.62, 0.4, 0.28], [0.72, 0.52, 0.38], [0.55, 0.5, 0.46], [0.66, 0.6, 0.52], [0.5, 0.34, 0.26]],
  wool: [[0.2, 0.15, 0.11], [0.28, 0.2, 0.14], [0.16, 0.12, 0.09], [0.34, 0.26, 0.18]],
};
const smAccent = (z) => SM.accent[z >= 0 ? 0 : 1];
/* Bruit de taille f (m), périodique tous les 32 f mètres */
function smN(N, x, z, f, oct = 3, o = 0) { return N.fbm(x / (f * 32) + o, z / (f * 32), 32, 32, oct); }
/* Hauteur où poser un objet de rayon r : la plus basse du relief sous lui (il s'enfonce un peu dans le sable, jamais en l'air) */
function smY(x, z, r = 0) {
  if (!r) return gy0(x, z);
  let h = gy0(x, z);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; h = Math.min(h, gy0(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
  return h - 0.04;
}
/* Emprise d'un prefab au sol (sommets sous 2 m, repère local) : centre et demi-côtés, gardés avec lui */
function smFoot(pf) {
  if (pf.foot) return pf.foot;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const part of pf.parts.values()) { const P = part.g.P; for (let i = 0; i < part.g.nv; i++) { if (P[i * 3 + 1] > 2) continue; const x = P[i * 3], z = P[i * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } }
  if (x0 > x1) x0 = x1 = z0 = z1 = 0;
  return (pf.foot = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 });
}
/* Collisions des prefabs qui n'en portent pas (02f-props.js, 02g-vehicles.js : la carte les décrit), dans le repère du prefab :
   [matière, [x0, x1, y0, y1, z0, z1], ...] ; les véhicules portent les leurs (pf.vcols, 02g-vehicles.js). Tente : les parois jusqu'à 2,1 m, le toit à
   deux pans en deux gradins ; conteneur ouvert : les deux parois et le toit (on le traverse) ; citerne ; mât de l'antenne. Jusqu'en 4.6.0, aucune :
   on traversait les voitures, les camions et les tentes de Simoun */
const SM_COLS = {
  tent: ['dirt', [-3.5, 3.5, 0, 2.1, -2.2, 2.2], [-3.5, 3.5, 2.1, 2.7, -1.2, 1.2], [-3.5, 3.5, 2.7, 3.25, -0.5, 0.5]],
  containerOpen: ['metal', [-1.22, -1.1, 0, 2.6, -3.03, 3.03], [1.1, 1.22, 0, 2.6, -3.03, 3.03], [-1.22, 1.22, 2.5, 2.62, -3.03, 3.03]],
  waterTank: ['metal', [-0.55, 0.55, 0, 1.42, -0.55, 0.55]],
  antenna: ['metal', [-0.06, 0.06, 0, 3.2, -0.06, 0.06]],
};
/* Pose un prefab sur le sable aplani sous son emprise (reliefFlat) : il n'entre pas dans une dune et ne flotte pas ; o.margin (0,4 m).
   Les collisions de SM_COLS s'ajoutent à celles du prefab */
function smPlace(pf, x, z, rot = 0, o = {}) {
  const f = smFoot(pf), c = Math.cos(rot), s = Math.sin(rot);
  const y = reliefFlat(x + f.cx * c + f.cz * s, z - f.cx * s + f.cz * c, f.hw, f.hd, rot, { margin: o.margin !== undefined ? o.margin : 0.4 });
  DECOR.place(pf, x, y - 0.02, z, rot, o);
  const k = pf.vcols ? ['metal', ...pf.vcols] : SM_COLS[pf.name]; // véhicule : ses collisions (vehCols)
  if (k && !o.nocol) colShape(x, y - 0.02, z, rot, k.slice(1), k[0]);
  return y;
}
/* Sol aplani sous une construction posée à la main (cabane, mirador, bâche, mur) : comme smPlace, rend la hauteur où la poser */
const smFlat = (x, z, hw, hd, rot = 0, margin = 0.4) => reliefFlat(x, z, hw, hd, rot, { margin }) - 0.02;

/* ---------- Matières et atlas ---------- */
function makeSimounMaterials(M) {
  M('pise', { tex: 'pise', grime: 1.3, streak: 0.9, dust: 0.35, macro: 0.5 });
  M('adobe', { tex: 'adobe', grime: 0.9, streak: 0.6, dust: 0.35, macro: 0.35, pom: 0.02, relief: 0.35 });
  // grès des massifs : photo d'une falaise stratifiée (Poly Haven, cliff_side) teintée par les sommets ; sans elle (réseau coupé), la surface procédurale
  if (TEX.strata) M('gres', { tex: 'strata', scale: 5.5, macro: 0.5, grime: 0.35, streak: 0.45, dust: 0.1, pom: 0.06 });
  else M('gres', { tex: 'gres', macro: 0.55, grime: 0.3, streak: 0.35, dust: 0.08, pom: 0.05 });
  M('galets', { tex: 'galets', macro: 0.35, dust: 0.2, pom: 0.03 });
  M('drystone', { tex: 'drystone', grime: 0.4, dust: 0.4, macro: 0.3, pom: 0.04 }); // la pierre sèche du puits de Meltem (cyWell)
  // carlingue de l'avion : peinture mate, passée et poussiéreuse (moins de reflets que la peinture des voitures)
  M('hull', { tex: 'paint', metal: 0.2, ma: true, env: 0.3, grime: 1.2, dust: 1.0, macro: 0.45, streak: 0.7 });
  // cabine de l'avion : panneaux et coffres lisses, cuir des sièges, sans motif (la couleur vient des sommets)
  M('cabin', { color: [1, 1, 1], rough: 0.5, env: 0.45, macro: 0.04 });
  // vitres de l'avion : verre transparent, poussiéreux et rayé, une moitié de l'atlas fêlée ; ni ombre ni occlusion (comme la verrière de Hortus)
  const gt = smGlassTex(), gm = new THREE.MeshStandardMaterial({ map: gt, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.08, metalness: 0, envMapIntensity: 1, side: THREE.DoubleSide });
  gm.userData.noShadow = true; gm.userData.noAO = true; gm.userData.noReceive = true; gm.userData.own = [gt]; MAT.glassAir = gm;
  // feuillages en cartes découpées (atlas de la flore méditerranéenne de Meltem : tamaris, olivier, roseaux, herbes)
  M('cyfol', { tex: 'cyfol', cut: 0.42, rough: 0.8, env: 0.35, macro: 0.25, scale: 1, noNormal: true }); makeWind(MAT.cyfol, WIND_AMP.cyfol, { leaf: true, cards: true }); // feuillage au vent (02md-vent.js)
}
/* Atlas de la carte (appelé par buildTextures) ; une photo absente est remplacée par une surface procédurale proche */
function simounKit() {
  TEX.cyfol = cyFloraAtlas();
  if (!TEX.pise) TEX.pise = TEX.plaster2 || TEX.concrete;
  if (!TEX.adobe) TEX.adobe = TEX.ashlar || TEX.concrete;
  if (!TEX.galets) TEX.galets = TEX.gravel;
  if (!TEX.vase) TEX.vase = TEX.dirt || TEX.sand;
  if (!TEX.reg) TEX.reg = TEX.dirt || TEX.sand;
}

/* ---------- Massifs de grès ---------- */
/* Couches dures du grès (hauteurs absolues, m) : la paroi y avance en corniche, à la même hauteur d'un massif à l'autre */
const SM_BANDS = [2.6, 5.9, 9.4, 13.8, 18.5, 24.0, 30.5, 37.0];
/* Teinte de la roche (linéaire) : pied plus sombre et plus rouge, patine du désert en coulées (vn : bruit de la coulée, de 0 à 1), dessus
   pâli par le soleil ; k : variation du grain */
function smRockTint(y, y0, top, vn, k) {
  const foot = 1 - smoothstep(y0, y0 + 2.2, y), head = smoothstep(top - 2.5, top, y), streak = smoothstep(0.55, 0.85, vn) * smoothstep(top, top - 6, y) * 0.42;
  const C = TEX.strata ? SM.rockP : SM.rock; // la photo de falaise est beige : teinte plus chaude pour un grès du désert
  const r = lerp(C[0], 0.86, foot) * (1 - streak) * k + head * 0.05, g = lerp(C[1], 0.6, foot) * (1 - streak * 1.1) * k + head * 0.06, b = lerp(C[2], 0.5, foot) * (1 - streak * 1.2) * k + head * 0.06;
  return [sl(clamp(r, 0, 1.2)), sl(clamp(g, 0, 1.2)), sl(clamp(b, 0, 1.2))];
}
/* Massif. I : { rects [x0, x1, z0, z1] (multiples de 0,5 m, voir stOutline), top (hauteur du dessus), seed, y0 (pied, 0), walk (dessus
   praticable : plat, matière du sol, bord exact), col (faux : sans collision, décor lointain), cls (classe de détail, 0), bulge (avancée
   maximale de la paroi, m), cap (faux : sans dessus, caché sous un autre massif) }.
   Collisions : une boîte par rectangle, du pied au dessus. La paroi ne rentre jamais derrière le bord des collisions (on voit où l'on bute) ;
   au pied elle n'avance que de quelques centimètres (les jambes n'y entrent pas), plus haut elle se bossèle et avance en corniche sur les
   couches dures. Rend le contour (stOutline). */
function smMassif(I) {
  const M = DECOR, O = stOutline(I.rects), N = makeNoise(I.seed), R = rngOf(I.seed * 7 + 3), y0 = I.y0 || 0, top = I.top, bulge = I.bulge !== undefined ? I.bulge : 0.9;
  if (I.col !== false) for (const q of I.rects) DECOR.col(q[0], q[1], y0, top, q[2], q[3], 'concrete');
  // boucle du bord, tous les 0,6 m au plus ; normale horizontale sortante (moyenne aux angles rentrants). Aux angles saillants, un éventail
  // de normales au même point : avec l'avancée minimale de la paroi (dmin, plus bas), l'angle droit des collisions devient un arc, toujours
  // dehors (retour du propriétaire, octobre 2026 : rochers très anguleux, géométrie ratée)
  const P = O.pts, loop = [], NF = 7;
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.6));
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L, pa = P[(k + P.length - 1) % P.length], Lp = hyp(a[0] - pa[0], a[1] - pa[1]);
    const px = (a[1] - pa[1]) / Lp, pz = -(a[0] - pa[0]) / Lp, convex = (b[0] - a[0]) * px + (b[1] - a[1]) * pz < 0;
    if (convex) { const t0 = Math.atan2(pz, px); let dt = Math.atan2(nz, nx) - t0; if (dt > Math.PI) dt -= TAU; if (dt < -Math.PI) dt += TAU; for (let f = 1; f < NF; f++) loop.push({ x: a[0], z: a[1], nx: Math.cos(t0 + dt * f / NF), nz: Math.sin(t0 + dt * f / NF), fan: true }); }
    for (let i = 0; i < n; i++) loop.push({ x: lerp(a[0], b[0], i / n), z: lerp(a[1], b[1], i / n), nx, nz, corner: i === 0, convex: i === 0 && convex, arms: i === 0 ? Math.min(L, Lp) : 0 });
  }
  for (let k = 0; k < loop.length; k++) if (loop[k].corner && !loop[k].convex) { const p = loop[(k + loop.length - 1) % loop.length], q = loop[k], l = hyp(p.nx + q.nx, p.nz + q.nz) || 1; q.nx = (p.nx + q.nx) / l; q.nz = (p.nz + q.nz) / l; }
  // normales lissées sur quelques points de part et d'autre : aux petits ressauts des massifs en bandes, deux normales voisines presque
  // opposées repliaient la paroi sur elle-même (de minces lames verticales) ; amortissement près des angles rentrants
  { const n = loop.length, nx = loop.map((p) => p.nx), nz = loop.map((p) => p.nz);
    for (let it = 0; it < 4; it++) for (let k = 0; k < n; k++) { const a = (k + n - 1) % n, b = (k + 1) % n; nx[k] = nx[a] + 2 * loop[k].nx + nx[b]; nz[k] = nz[a] + 2 * loop[k].nz + nz[b]; }
    for (let k = 0; k < n; k++) { const l = hyp(nx[k], nz[k]); loop[k].damp = clamp(l / (4 * 4), 0.15, 1); if (l > 1e-6) { loop[k].nx = nx[k] / l; loop[k].nz = nz[k] / l; } } }
  let s = 0; for (let k = 0; k < loop.length; k++) { loop[k].s = s; const q = loop[(k + 1) % loop.length]; s += hyp(q.x - loop[k].x, q.z - loop[k].z); }
  // distance (le long du contour) à l'angle le plus proche : les faces bombent plus que les angles, qui paraissent usés et arrondis
  { const cs = loop.filter((p) => p.corner).map((p) => p.s); for (const p of loop) { let m = 1e9; for (const c of cs) { const d = Math.abs(p.s - c); m = Math.min(m, d, s - d); } p.face = smoothstep(0, 3, m); } }
  const per = s, K = Math.max(4, Math.round(per / 7)), K2 = Math.max(6, Math.round(per / 3)), K3 = Math.max(4, Math.round(per / 6.5));
  // rangs : sous le sol, au pied, puis tous les 1,2 à 2 m, deux de part et d'autre de chaque couche dure, le haut de la paroi et le dessus
  let Ys = I.under ? [y0, y0 + 0.3] : [y0 - 0.5, y0 + 0.3];
  for (let y = y0 + R.range(0.9, 1.2); y < top - 0.8; y += R.range(0.8, 1.2)) Ys.push(y);
  const bands = SM_BANDS.filter((b) => b > y0 + 1.2 && b < top - 0.6);
  for (const b of bands) Ys.push(b - 0.3, b + 0.08);
  Ys = Ys.filter((y) => !bands.some((b) => y > b - 0.75 && y < b + 0.55 && Math.abs(y - (b - 0.3)) > 1e-6 && Math.abs(y - (b + 0.08)) > 1e-6));
  Ys.push(top - (I.walk ? 0.12 : 0.4), top); if (I.walk) Ys.push(top - 0.35, top - 0.7); Ys.sort((a, b) => a - b);
  Ys = Ys.filter((y, i) => i === 0 || y - Ys[i - 1] > 0.05);
  const nR = Ys.length, nL = loop.length;
  const ring = Ys.map((y, j) => loop.map((p) => {
    const foot = smoothstep(y0 + 0.2, y0 + 2.4, y), t = p.s / per;
    const lump = smN(N, p.s, y, 6, 3) - 0.38, crag = 0.5 - Math.abs(2 * N.fbm(t + 0.37, y / 9, K2, 6, 2) - 1);
    // côtes verticales (diaclases : la paroi se débite en colonnes), bosses, arêtes, corniches sur les couches dures
    const rib = smoothstep(0.4, 0.75, N.fbm(t + 0.13, y / 70, K3, 1, 2)) * 0.7;
    let d = Math.max(0, lump) * lerp(0.2, bulge, foot) + Math.max(0, crag) * 0.4 * foot * bulge + rib * bulge * lerp(0.15, 1, foot);
    // contreforts : grandes masses arrondies de 6 à 12 m, au-dessus de la hauteur d'homme seulement (au pied, la paroi suit la collision) ; elles
    // s'enflent sur 4 m de haut : plus vite, leur dessous faisait un surplomb tourné vers le sol, sans soleil ni ciel (de grandes taches sombres)
    const high = smoothstep(y0 + 2.4, y0 + 6.6, y), mass = smoothstep(0.36, 0.74, N.fbm(t + 0.71, y / 26, Math.max(3, Math.round(per / 9)), 2, 2));
    d += mass * high * bulge * 0.9 * lerp(0.35, 1, p.face);
    // corniches des couches dures : à peine saillantes, par endroits (la photo porte déjà les bancs ; un bandeau continu faisait un gâteau à étages,
    // et une corniche franche, interrompue, laissait dessous une tache d'ombre)
    for (const b of bands) d += 0.32 * bulge * Math.exp(-(((y - b + 0.12) / 0.45) ** 2)) * foot * smoothstep(0.3, 0.62, N.fbm(t, b / 40, K, 2, 2)) * (TEX.strata ? 0.35 : 1.3);
    d *= p.damp;
    d = Math.max(d, lerp(0.22, 0.75, foot) * lerp(0.75, 1, p.face)); // avancée minimale : les angles saillants s'arrondissent (éventail de normales), dehors
    if (I.walk) d *= smoothstep(top + 0.01, top - 1.2, y); // le bord du dessus suit exactement la collision
    else if (y >= top - 1e-6) d = 0; // le dessus se referme sur le contour (sans repli)
    if (y < y0) d = Math.max(d, 0.2);
    const jy = j > 1 && j < nR - 2 ? (N.fbm(t, j / 7, K, 2, 2) - 0.5) * 0.35 : 0;
    return [p.x + p.nx * d, y + jy, p.z + p.nz * d];
  }));
  // normales : différences le long de la boucle et d'un rang à l'autre ; vers l'extérieur
  const norm = [];
  for (let j = 0; j < nR; j++) for (let k = 0; k < nL; k++) {
    const a = ring[j][(k + 1) % nL], b = ring[j][(k + nL - 1) % nL], c = ring[Math.min(nR - 1, j + 1)][k], d = ring[Math.max(0, j - 1)][k];
    const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
    const p = loop[k]; if (nx * p.nx + nz * p.nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = hyp3(nx, ny, nz) || 1; norm.push([nx / l, ny / l, nz / l]);
  }
  M.save().local(1); M.cls = I.cls || 0; M.aoFn = null;
  let cx = 0, cz = 0; for (const p of loop) { cx += p.x; cz += p.z; } cx /= nL; cz /= nL;
  const B = M.buf('gres', cx, (y0 + top) / 2, cz), ids = [];
  for (let j = 0; j < nR; j++) for (let k = 0; k < nL; k++) {
    const q = ring[j][k], n = norm[j * nL + k], vn = N.fbm(loop[k].s / per + 0.61, 0.5, Math.max(8, Math.round(per / 2.2)), 1, 2);
    M.tint = smRockTint(q[1], y0, top, vn, 0.92 + (N.fbm(loop[k].s / per, j / 9, 8, 2, 2) - 0.5) * 0.3);
    ids.push(M.v(B, q[0], q[1], q[2], n[0], n[1], n[2], loop[k].s, q[1], lerp(0.55, 1, smoothstep(y0, y0 + 1.6, Ys[j]))));
  }
  // faces tournées vers l'extérieur (la boucle du contour tourne dans le sens où sa normale (dz, -dx) sort)
  for (let j = 0; j < nR - 1; j++) for (let k = 0; k < nL; k++) M.quadI(B, ids[j * nL + k], ids[(j + 1) * nL + k], ids[(j + 1) * nL + (k + 1) % nL], ids[j * nL + (k + 1) % nL]);
  M.restore();
  // éboulis au pied : petits blocs tombés de la paroi, en traînées irrégulières hors des boîtes de collision ; sans collision (moins de 35 cm de
  // haut, comme les débris du sol), ils cassent la ligne droite entre le sable et la roche
  if (I.col !== false && I.scree !== false) {
    const inRect = (x, z) => I.rects.some((q) => x > q[0] - 0.25 && x < q[1] + 0.25 && z > q[2] - 0.25 && z < q[3] + 0.25);
    for (let k = 0; k < nL; k++) {
      const p = loop[k]; if (N.fbm(p.s / per + 0.29, 0.3, Math.max(4, Math.round(per / 5)), 1, 2) < 0.47) continue;
      for (let i = 0, n = 1 + Math.floor(R() * 2); i < n; i++) {
        const o = R.range(0.35, 1.7), w = R.range(-0.45, 0.45), x = p.x + p.nx * o - p.nz * w, z = p.z + p.nz * o + p.nx * w;
        if (inRect(x, z)) continue;
        DECOR.place(PF.smScree(1 + Math.floor(R() * 6)), x, smY(x, z) - 0.04, z, R() * TAU, { nocol: true, s: R.range(0.6, 1.25) });
      }
    }
  }
  if (I.under) { // dessous d'un pont de roche (voûte d'une grotte) : la roche vue d'en bas, sombre
    M.save().local(1); M.cls = I.cls || 0; M.aoFn = null; M.color([0.6, 0.46, 0.38]);
    const U = M.buf('gres', cx, y0, cz);
    for (const q of I.rects) { const a = M.v(U, q[0], y0, q[2], 0, -1, 0, q[0], q[2], 0.5), b = M.v(U, q[1], y0, q[2], 0, -1, 0, q[1], q[2], 0.5), c = M.v(U, q[1], y0, q[3], 0, -1, 0, q[1], q[3], 0.5), d = M.v(U, q[0], y0, q[3], 0, -1, 0, q[0], q[3], 0.5); M.quadI(U, a, b, c, d); }
    M.restore();
  }
  if (I.cap === false) return O;
  // blocs détachés le long de l'arête du dessus praticable, un plus gros sur chaque angle saillant : ils cassent la ligne droite et l'angle
  // droit du plateau ; à demi sur le bord, sans collision (moins de 45 cm au-dessus du dessus : on marche à travers comme sur des cailloux)
  if (I.walk && I.rim !== false) {
    let last = -9;
    for (let k = 0; k < nL; k++) {
      const p = loop[k]; if (p.fan) continue;
      const big = p.convex && p.arms >= 2.5, nz = N.fbm(p.s / per + 0.83, 0.7, Math.max(6, Math.round(per / 3)), 1, 2); // gros bloc : angle franc, pas un petit ressaut
      if (!big && (nz < 0.62 || p.s - last < 4.5 || p.corner)) continue;
      last = p.s;
      const sc = big ? R.range(0.95, 1.25) : R.range(0.7, 1.0), o = big ? -0.45 : R.range(-0.4, -0.1);
      DECOR.place(PF.smRock(sc, 1 + Math.floor(R() * 6), 0.42), p.x + p.nx * o, top - sc * 0.16, p.z + p.nz * o, R() * TAU, { nocol: true });
    }
  }
  if (I.walk) {
    // dessus praticable : les cases de 0,5 m couvertes, réunies par rangées, dans la matière du sol (répartition comprise)
    M.save().local(1).color([0.92, 0.9, 0.86]); M.cls = 0; M.aoFn = null;
    const T = M.buf('ground', O.bx0 + O.W * O.r / 2, top, O.bz0 + O.H * O.r / 2);
    for (let j = 0; j < O.H; j++) for (let i = 0; i < O.W; i++) {
      if (!O.on[j * O.W + i] || (i > 0 && O.on[j * O.W + i - 1])) continue;
      let k = i; while (k + 1 < O.W && O.on[j * O.W + k + 1]) k++;
      const x0 = O.bx0 + i * O.r, x1 = O.bx0 + (k + 1) * O.r, z0 = O.bz0 + j * O.r, z1 = z0 + O.r;
      const a = M.v(T, x0, top, z0, 0, 1, 0, x0, -z0), b = M.v(T, x1, top, z0, 0, 1, 0, x1, -z0), c = M.v(T, x1, top, z1, 0, 1, 0, x1, -z1), d = M.v(T, x0, top, z1, 0, 1, 0, x0, -z1);
      M.quadI(T, a, d, c, b);
    }
    M.restore();
  } else {
    // dessus de roche : le haut de la paroi (dernier rang) triangulé, dans la matière du sol (sable et cailloux du plateau)
    const top2 = ring[nR - 1].map((q) => q.slice()), contour = top2.map((q) => new THREE.Vector2(q[0], q[2]));
    const tri = THREE.ShapeUtils.triangulateShape(contour, []);
    M.save().local(1); M.cls = I.cls || 0; M.aoFn = null;
    M.color([0.98, 0.86, 0.74]);
    const T = M.buf('ground', cx, top, cz), vids = top2.map((q) => M.v(T, q[0], q[1], q[2], 0, 1, 0, q[0], -q[2]));
    for (const t of tri) { const a = top2[t[0]], b = top2[t[1]], c = top2[t[2]], cr = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]); if (cr > 0) M.tri(T, vids[t[0]], vids[t[2]], vids[t[1]]); else M.tri(T, vids[t[0]], vids[t[1]], vids[t[2]]); }
    M.restore();
  }
  return O;
}

/* Éboulis : deux à quatre petits blocs anguleux de grès tombés de la paroi (au plus 30 cm), sans collision */
PF.smScree = (seed = 1) => prefab('smScree' + seed, (M) => {
  const R = rngOf(seed * 37 + 11); M.cls = 2; M.local(1);
  for (let i = 0, n = 2 + Math.floor(R() * 3); i < n; i++) {
    const a = R() * TAU, d = i ? R.range(0.15, 0.5) : 0, s = i ? R.range(0.06, 0.16) : R.range(0.14, 0.26), g = R.range(0.86, 1.06);
    M.color([1.06 * g, 0.8 * g, 0.62 * g]);
    M.save().move(Math.cos(a) * d, -s * 0.15, Math.sin(a) * d).rotY(R() * TAU).rotZ(R.range(-0.3, 0.3));
    rockMesh(M, R, s * R.range(1, 1.5), s * R.range(0.55, 0.9), s * R.range(0.8, 1.2), 3 + Math.floor(R() * 4), 7, 5, 'gres');
    M.restore();
  }
});
/* Rocher de grès isolé (couvert) : bloc taillé de facettes, collision de sa boîte resserrée ; s : taille (m), squash : aplatissement */
PF.smRock = (s = 1.6, seed = 1, squash = 0.75) => prefab(`smRock${s}_${seed}_${squash}`, (M) => {
  const R = rngOf(seed * 13 + 7);
  M.color([R.range(0.92, 1.02), R.range(0.74, 0.84), R.range(0.6, 0.7)]).local(1);
  rockMesh(M, R, s * 0.62, s * 0.62 * squash, s * 0.55, 8, 11, 8, 'gres');
  M.col(-s * 0.5, s * 0.5, 0, s * 0.62 * squash * 1.7, -s * 0.44, s * 0.44, 'concrete');
});

/* ---------- Pisé : ruines ---------- */
/* Mur ruiné : de a0 à a1, troué des passages gaps [[a0, a1], ...] (sans linteau), en pans de 0,8 à 2 m de hauteurs tirées entre h0 et h1 (arase
   cassée en gradins), pied enfoncé sous le sable (y0) ; quelques briques tombées au pied */
function smRuin(axis, fixed, t, a0, a1, y0, h0, h1, gaps, R, tint) {
  const segs = []; let cur = a0;
  for (const g of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g[0] - cur > 0.3) segs.push([cur, g[0]]); cur = g[1]; }
  if (a1 - cur > 0.3) segs.push([cur, a1]);
  for (const [s0, s1] of segs) {
    let a = s0;
    let h = R.range(h0, h1);
    while (a < s1 - 1e-3) {
      const b = Math.min(s1, a + R.range(0.5, 1.1));
      h = clamp(h + R.range(-0.35, 0.35), h0, h1);
      wallOpen('pise', axis, fixed, t, a, s1 - b < 0.3 ? s1 : b, y0, h, [], { tint, frames: false });
      a = s1 - b < 0.3 ? s1 : b;
    }
  }
  const M = DECOR; M.save().color(tint); M.cls = 2;
  for (let i = 0; i < Math.round((a1 - a0) / 2.5); i++) {
    const a = R.range(a0, a1), off = (R() < 0.5 ? -1 : 1) * R.range(t / 2 + 0.15, t / 2 + 0.7), x = axis === 'x' ? a : fixed + off, z = axis === 'x' ? fixed + off : a, s = R.range(0.18, 0.3);
    M.save().move(x, smY(x, z) + s * 0.25, z).rotY(R() * TAU).rotX(R.range(-0.4, 0.4)); M.boxB('adobe', -s, s, -s * 0.4, s * 0.4, -s * 0.6, s * 0.6, { bevel: 0.03 }); M.restore();
  }
  M.restore();
}

/* ---------- Objets du désert ---------- */
function smJar(x, z, s = 1, R) { DECOR.dyn('jar', x, smY(x, z, 0.25), z, R ? R() * TAU : 0, { s }); }
/* Muret de sacs de sable : un prop physique par sac, en rangs décalés, posés sur le relief ; les tirs les ébranlent et finissent par les faire
   tomber, avec ceux qu'ils portaient */
function smSandbags(cx, cz, len, axis, rows, R) {
  const bl = 0.6, n = Math.max(1, Math.round(len / bl)), step = len / n, k = step / bl, dx = axis === 'x' ? 1 : 0, dz = axis === 'x' ? 0 : 1, rot = axis === 'x' ? 0 : Math.PI / 2;
  const W = rngOf(Math.round(cx * 131 + cz * 17 + len * 7 + 99)), fallen = [], top = rows - 1, base = [0.95, 0.85, 0.71];
  // usure (sandbagWear) : rang du haut jamais complet, bouts partis surtout, sacs partis souvent couchés au pied du mur
  const wr = rows > 1 ? sandbagWear(n - (top % 2), top % 2 === 1, (top - 1) % 2 === 1, W) : null, fall = (x, z, type) => sandbagFallen(x, z, dx, dz, 0.2 * k, rot, (px, pz) => smY(px, pz), k, base, W, fallen, type);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * step * 0.5;
    for (let i = 0; i < n - (r % 2); i++) {
      const a = -len / 2 + step * (i + 0.5) + off, j = (R() - 0.5) * 0.03, x = axis === 'x' ? cx + a : cx + j, z = axis === 'x' ? cz + j : cz + a;
      const tint = [0.9 + R() * 0.1, 0.8 + R() * 0.1, 0.66 + R() * 0.1];
      if (wr && r === top && wr.gone.has(i)) { fall(x, z); continue; }
      DECOR.dyn('sandbag', x, smY(x, z) + r * 0.22 * k, z, rot + j * 2, { s: k, tint }); // désaxé de 3° au plus
    }
    // un rang décalé se ferme par deux demi-sacs (tirage propre au mur : la suite du décor ne change pas)
    if (r % 2) sandbagHalves(cx, cz, len, dx, dz, (x, z) => smY(x, z) + r * 0.22 * k, k, base, rngOf(Math.round(cx * 131 + cz * 17 + r * 7 + 9000)), wr ? (r === top ? wr.half : r === top - 1 ? wr.low : null) : null, fall);
  }
}
/* Bâche tendue sur quatre perches : de (x, z), w le long de rot, d en travers, bord haut h0 et bord bas h1 au-dessus du sol y ; la toile sans
   collision (une ombre et un abri pour les yeux), simulée (Maker.toile : tenue aux quatre coins et le long des deux bords hauts et bas, ses
   côtés libres battent), les perches ont une collision, haubans */
function smTarp(x, y, z, rot, w, d, h0, h1, col) {
  const M = DECOR; M.save().move(x, y, z).rotY(rot);
  M.color(col); M.cls = 1;
  M.toile(4, 3, (u, v) => { const xx = (u - 0.5) * w, zz = (v - 0.5) * d; return [xx, lerp(h0, h1, v) - Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.12, zz]; }, { uL: w, vL: d, flipN: true, play: 0.22, pin: (u, v) => v <= 0 || v >= 1 });
  M.color(SM.palm); M.cls = 1;
  for (const sx of [-1, 1]) for (const [sz, h] of [[-1, h0], [1, h1]]) { M.save().move(sx * w / 2, 0, sz * d / 2); M.cyl('wood', 0.04, h + 0.05, 6); M.restore(); M.col(sx * w / 2 - 0.06, sx * w / 2 + 0.06, 0, h, sz * d / 2 - 0.06, sz * d / 2 + 0.06, 'wood'); }
  M.color([0.62, 0.56, 0.46]);
  for (const sx of [-1, 1]) for (const [sz, h] of [[-1, h0], [1, h1]]) M.tube('burlap', 0.008, [[sx * w / 2, h, sz * d / 2], [sx * (w / 2 + 0.9), 0, sz * (d / 2 + 0.9)]], 3);
  M.restore();
}
/* Foyer : cercle de pierres noircies, braises éteintes, marmite sur trois pierres */
PF.smFire = () => prefab('smFire', (M) => {
  const R = rngOf(9177); M.local(1);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; M.save().move(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55).rotY(a); M.color([0.42, 0.36, 0.32]); rockMesh(M, R, 0.16, 0.1, 0.13, 5, 6, 5, 'stone'); M.restore(); }
  M.color([0.12, 0.1, 0.09]); M.boxB('charred', -0.4, 0.4, 0, 0.04, -0.4, 0.4, { bevel: 0.02 });
  for (let i = 0; i < 4; i++) { M.save().move(0, 0.06, 0).rotY(i * 0.8).rotZ(0.2); M.cyl('charred', 0.04, 0.6, 6); M.restore(); }
  M.color([0.2, 0.19, 0.18]); M.save().move(0.15, 0.08, 0.1); M.lathe('steel', [[0, 0], [0.18, 0.02], [0.22, 0.14], [0.2, 0.24], [0.17, 0.25]], 10); M.restore();
});
/* Tente bédouine : toit bas et large en lés de laine sombre (une bande claire de temps en temps), affaissé entre les poteaux, relevé devant (le
   côté ouvert, +z), fermé derrière et sur les côtés jusqu'au sol ; tapis et coussins dedans, haubans et piquets devant. Collisions des parois
   (on y entre par l'avant) ; le toit n'en a pas. Lés et parois sont des toiles simulées (Maker.toile) : chaque lé est cousu à ses voisins
   (ses bords tiennent) et repose sur la rangée de poteaux, le milieu des lés ondule et se creuse sous un souffle */
PF.smBedouin = (w = 7, d = 4.4, seed = 1) => prefab(`smBedouin${w}_${d}_${seed}`, (M) => {
  const R = rngOf(seed * 37 + 5), hw = w / 2, hd = d / 2, hR = 2.05, hF = 1.6, hB = 0.85, rz = -0.3, np = Math.max(2, Math.round(w / 2.4));
  const yz = (z) => (z < rz ? lerp(hB, hR, smoothstep(-hd, rz, z)) : lerp(hR, hF, smoothstep(rz, hd, z)));
  const sag = (x) => { const t = ((x + hw) / w) * np, f = t - Math.floor(t); return 0.2 * Math.sin(f * Math.PI); };
  const Y = (x, z) => yz(z) - sag(x) * (1 - 0.4 * Math.abs(z - rz) / hd);
  M.local(1); M.cls = 0;
  const nb = Math.round(w / 0.75), wool = (b) => (R() < 0.12 ? [0.6, 0.52, 0.4] : SM.wool[(b % 2) + (R() < 0.3 ? 2 : 0)]);
  for (let b = 0; b < nb; b++) {
    const x0 = -hw + (w * b) / nb, x1 = -hw + (w * (b + 1)) / nb;
    M.color(wool(b));
    M.toile(2, 10, (u, v) => { const x = lerp(x0, x1, u), z = lerp(-hd, hd, v); return [x, Y(x, z), z]; }, { mat: 'laine', uL: x1 - x0, vL: d, flipN: true, play: 0.07, pin: (u, v) => u <= 0 || u >= 1 || v <= 0 || v >= 1 || Math.abs(lerp(-hd, hd, v) - rz) < 0.12, glow: 0.05 });
    M.toile(2, 2, (u, v) => { const x = lerp(x0, x1, u); return [x, lerp(Y(x, -hd), 0, v), -hd - v * 0.2]; }, { mat: 'laine', uL: x1 - x0, vL: 1, play: 0.06, glow: 0.05 });
  }
  M.color(SM.wool[0]);
  for (const s of [-1, 1]) M.toile(6, 2, (u, v) => { const z = lerp(-hd, 0.4, u); return [s * hw, lerp(Y(s * hw, z), 0, v), z]; }, { mat: 'laine', uL: hd, vL: 1.6, flipN: s < 0, play: 0.08, glow: 0.05 });
  M.color(SM.palm);
  for (let i = 0; i <= np; i++) { const x = -hw + (w * i) / np; M.save().move(x, 0, rz); M.cyl('wood', 0.05, Y(x, rz) + 0.08, 6); M.restore(); M.save().move(x, 0, hd); M.cyl('wood', 0.045, Y(x, hd) + 0.06, 6); M.restore(); }
  M.color([0.6, 0.54, 0.44]);
  for (let i = 0; i <= np; i++) { const x = -hw + (w * i) / np; M.tube('burlap', 0.008, [[x, Y(x, hd), hd], [x * 1.08, 0, hd + 1.7]], 3); }
  M.save().color([1, 1, 1]); M.uvS = 2.4 / TEXSCALE.rug; M.uvO = [0.5, 0.5]; M.cls = 1;
  for (const x of [-hw * 0.5, hw * 0.45]) { M.save().move(x, 0.015, -0.4).rotY(R.range(-0.1, 0.1)); M.boxB('rug', -1.2, 1.2, 0, 0.012, -0.8, 0.8); M.restore(); }
  M.restore();
  for (let i = 0; i < 4; i++) { M.color(R.pick([[0.62, 0.14, 0.12], [0.75, 0.42, 0.15], [0.2, 0.25, 0.5], [0.55, 0.2, 0.3]])); const x = R.range(-hw + 0.6, hw - 0.6); M.save().move(x, 0, -hd + 0.45).rotY(R.range(-0.2, 0.2)); M.boxB('canvas', -0.35, 0.35, 0, 0.32, -0.25, 0.25, { bevel: 0.1 }); M.restore(); }
  M.col(-hw, hw, 0, 1.0, -hd - 0.2, -hd + 0.05, 'dirt');
  for (const s of [-1, 1]) M.col(s * hw - 0.08, s * hw + 0.08, 0, 1.3, -hd, 0.3, 'dirt');
});
/* Cabane de fortune (repère à son pied : (x, y, z), tournée de rot) : poteaux de bois, parois en tôles ondulées rouillées et en planches, de
   teintes mêlées ; une porte sans battant dans la face avant (+z, de o.door à o.door + 1,2 m depuis le milieu), une fenêtre sur un côté, toit
   de tôle en pente vers l'arrière (pneus et pierres dessus) ; o.back : la même porte dans la face arrière (on traverse). Collisions des parois
   et du toit : on entre par la porte */
function smShack(x, y, z, rot, w, d, h, R, o = {}) {
  const M = DECOR, hw = w / 2, hd = d / 2, dr = o.door !== undefined ? o.door : -0.6, t = 0.06, win = o.win !== undefined ? o.win : 1;
  M.save().move(x, y, z).rotY(rot); M.cls = 0;
  const panel = (x0, x1, y0, y1, z0, z1) => { const tin = R() < 0.72; M.color(tin ? R.pick(SM.rust) : [0.55, 0.44, 0.34]); M.boxB(tin ? 'corrugated' : 'wood', x0, x1, y0, y1, z0, z1); };
  const run = (a0, a1, y0, y1, fixed, axis, holes) => { // une face, en panneaux de 0,9 à 1,3 m, trouée de [a0, a1, b0, b1]
    let a = a0;
    while (a < a1 - 1e-3) {
      const b = Math.min(a1, a + R.range(0.9, 1.3)), c = a1 - b < 0.35 ? a1 : b;
      let segs = [[a, c, y0, y1]];
      for (const q of holes) segs = segs.flatMap((s) => { const u0 = Math.max(s[0], q[0]), u1 = Math.min(s[1], q[1]); return q[0] >= s[1] || q[1] <= s[0] ? [s] : [[s[0], u0, s[2], s[3]], [u0, u1, s[2], q[2]], [u0, u1, q[3], s[3]], [u1, s[1], s[2], s[3]]].filter((p) => p[1] - p[0] > 0.02 && p[3] - p[2] > 0.02); }); // le trou rogné au panneau : pas de recouvrement entre deux panneaux
      for (const s of segs) {
        if (axis === 'x') { panel(s[0], s[1], s[2], s[3], fixed - t / 2, fixed + t / 2); M.col(s[0], s[1], s[2], s[3], fixed - 0.07, fixed + 0.07, 'metal'); }
        else { panel(fixed - t / 2, fixed + t / 2, s[2], s[3], s[0], s[1]); M.col(fixed - 0.07, fixed + 0.07, s[2], s[3], s[0], s[1], 'metal'); }
      }
      a = c;
    }
  };
  const hb = h - 0.35;
  run(-hw, hw, 0, h, hd, 'x', [[dr, dr + 1.2, 0, 2.05]]);
  run(-hw, hw, 0, hb, -hd, 'x', o.back ? [[dr, dr + 1.2, 0, 2.05]] : []);
  run(-hd, hd, 0, hb, -hw, 'z', win < 0 ? [[-0.4, 0.4, 1.0, 1.55]] : []);
  run(-hd, hd, 0, hb, hw, 'z', win > 0 ? [[-0.4, 0.4, 1.0, 1.55]] : []);
  // poteaux, linteau, toit
  M.color([0.5, 0.4, 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('wood', sx * hw - 0.06, sx * hw + 0.06, 0, (sz > 0 ? h : hb) - 0.025, sz * hd - 0.06, sz * hd + 0.06); // sous la tôle (pas dans son plan)
  M.boxB('wood', dr - 0.05, dr + 1.25, 2.0, 2.13, hd - 0.05, hd + 0.05); // linteau : son dessous dépasse sous la tôle (pas dans son plan)
  if (o.back) M.boxB('wood', dr - 0.05, dr + 1.25, 2.0, 2.13, -hd - 0.05, -hd + 0.05);
  M.color(R.pick(SM.rust));
  const B = [[-hw - 0.25, h + 0.04, hd + 0.3], [hw + 0.25, h + 0.04, hd + 0.3], [hw + 0.25, hb - 0.04, -hd - 0.3], [-hw - 0.25, hb - 0.04, -hd - 0.3]];
  M.quad('corrugated', B[0], B[1], B[2], B[3], [0, 1, 0]); M.quad('corrugated', B[0], B[3], B[2], B[1], [0, -1, 0]);
  M.col(-hw, hw, hb - 0.05, h + 0.05, -hd, hd, 'metal');
  M.color([0.18, 0.17, 0.16]); M.cls = 1;
  M.save().move(R.range(-hw * 0.5, hw * 0.5), (h + hb) / 2 + 0.06, R.range(-hd * 0.3, hd * 0.3)); M.lathe('rubber', [[0.2, 0], [0.36, 0.02], [0.4, 0.11], [0.36, 0.2], [0.2, 0.22], [0.18, 0.11], [0.2, 0]], 12); M.restore();
  M.restore();
}
/* Mirador de bois (repère au pied, (x, y, z), x et z au centre d'une case de 1 m) : quatre poteaux, plate-forme de 3,2 m à 3 m, garde-corps
   de tôle sur trois côtés et demi, toit de tôle ; l'escalier (rampe de 6,2 m le long de z, 1,6 m de large, pente 0,48) part du côté dir
   (1 : +z, -1 : -z), sur la moitié x > x0 du devant, ouverte dans le garde-corps */
function smWatchtower(x, y, z, R, dir = 1) {
  const M = DECOR, P = 3.0, hw = 1.6;
  M.save().move(x, y, z); M.cls = 0; M.color([0.52, 0.4, 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { M.boxB('wood', sx * hw - 0.09, sx * hw + 0.09, 0, P + 2.3, sz * hw - 0.09, sz * hw + 0.09); M.col(sx * hw - 0.09, sx * hw + 0.09, 0, P + 2.3, sz * hw - 0.09, sz * hw + 0.09, 'wood'); }
  // contreventement : croix de Saint-André sur les deux côtés et le fond (deux étages de croix, lisses entre elles), devant ouvert sous
  // l'escalier ; chaque face contreventée arrête le passage (on la traversait : retour du propriétaire, octobre 2026), pas les balles
  const braced = [['x', -1], ['x', 1], ['z', -dir]], seg = (ax, f, y0b, y1b, u0, u1) => { // barre de (u0, y0b) à (u1, y1b) dans la face
    const L = hyp(u1 - u0, y1b - y0b), ang = Math.atan2(y1b - y0b, u1 - u0);
    M.save().move(ax === 'x' ? f * hw : (u0 + u1) / 2, (y0b + y1b) / 2, ax === 'x' ? (u0 + u1) / 2 : f * hw);
    if (ax === 'x') M.rotX(-ang); else M.rotZ(ang);
    if (ax === 'x') M.boxB('wood', -0.045, 0.045, -0.05, 0.05, -L / 2, L / 2); else M.boxB('wood', -L / 2, L / 2, -0.05, 0.05, -0.045, 0.045);
    M.restore();
  };
  for (const [ax, f] of braced) {
    for (const [a, b] of [[0.25, 1.6], [1.6, 2.86]]) { seg(ax, f, a, b, -hw + 0.09, hw - 0.09); seg(ax, f, a, b, hw - 0.09, -hw + 0.09); }
    for (const yy of [0.22, 1.6]) { if (ax === 'x') M.boxB('wood', f * hw - 0.05, f * hw + 0.05, yy - 0.06, yy + 0.06, -hw, hw); else M.boxB('wood', -hw, hw, yy - 0.06, yy + 0.06, f * hw - 0.05, f * hw + 0.05); }
    const c = ax === 'x' ? [f * hw - 0.06, f * hw + 0.06, -hw, hw] : [-hw, hw, f * hw - 0.06, f * hw + 0.06];
    COL.push({ x0: x + c[0], x1: x + c[1], y0: y, y1: y + P - 0.3, z0: z + c[2], z1: z + c[3], m: 'wood', ray: false, noRay: true });
  }
  M.boxB('wood', -hw - 0.1, hw + 0.1, P - 0.14, P, -hw - 0.1, hw + 0.1);
  M.col(-hw - 0.1, hw + 0.1, P - 0.3, P, -hw - 0.1, hw + 0.1, 'wood');
  const back = -dir * hw, front = dir * hw;
  for (const [x0, x1, z0, z1] of [[-hw, hw, back - 0.04, back + 0.04], [-hw - 0.04, -hw + 0.04, -hw, hw], [hw - 0.04, hw + 0.04, -hw, hw], [-hw, -0.1, front - 0.04, front + 0.04]]) {
    M.color(R.pick(SM.rust)); M.boxB('corrugated', x0, x1, P, P + 1.1, z0, z1); M.col(x0, x1, P, P + 1.1, z0, z1, 'metal');
  }
  M.color(R.pick(SM.rust)); M.boxB('corrugated', -hw - 0.3, hw + 0.3, P + 2.3, P + 2.36, -hw - 0.3, hw + 0.3);
  M.col(-hw - 0.3, hw + 0.3, P + 2.3, P + 2.36, -hw - 0.3, hw + 0.3, 'metal', true); // le toit arrête les balles ; on ne s'y hisse pas depuis le garde-corps
  M.restore();
  const za = z + dir * hw, zb = z + dir * (hw + 6.2);
  ramp(x, x + 1.6, Math.min(za, zb), Math.max(za, zb), 'z', dir > 0 ? y + P : y, dir > 0 ? y : y + P, 'pavers', [0.62, 0.5, 0.38], { mat: 'wood' });
}

/* Touffe de roseaux (atlas de Meltem) */
PF.smReeds = (s = 1) => prefab('smReeds' + s, (M) => {
  // touffe de roseaux : une trentaine de tiges fines et effilées (deux triangles de toile, verts à jaunes), penchées, quelques épis bruns
  const R = rngOf(Math.round(s * 100) + 17); M.local(1); M.cls = 1;
  M.swFn = swHeight(0, 2 * s, 1.4, 1); // les tiges plient par le haut, au vent (02md-vent.js) ; matière souple 'stem'
  for (let i = 0; i < 30; i++) {
    const a = R() * TAU, r = R() * 0.32 * s, x = Math.cos(a) * r, z = Math.sin(a) * r, h = R.range(1.1, 2.0) * s, lean = R.range(0.05, 0.35), la = R() * TAU, w = R.range(0.02, 0.035);
    const tx = x + Math.cos(la) * lean * h, tz = z + Math.sin(la) * lean * h, mx = (x + tx) / 2 + Math.cos(la) * 0.05, mz = (z + tz) / 2 + Math.sin(la) * 0.05, px = -Math.sin(la) * w, pz = Math.cos(la) * w;
    M.color(R.pick([[0.46, 0.56, 0.26], [0.58, 0.62, 0.3], [0.7, 0.66, 0.38], [0.52, 0.5, 0.28]]));
    M.quad('stem', [x - px, 0, z - pz], [x + px, 0, z + pz], [mx + px * 0.7, h * 0.55, mz + pz * 0.7], [mx - px * 0.7, h * 0.55, mz - pz * 0.7], [Math.cos(la), 0.3, Math.sin(la)]);
    M.quad('stem', [mx - px * 0.7, h * 0.55, mz - pz * 0.7], [mx + px * 0.7, h * 0.55, mz + pz * 0.7], [tx + px * 0.1, h, tz + pz * 0.1], [tx - px * 0.1, h, tz - pz * 0.1], [Math.cos(la), 0.3, Math.sin(la)]);
    if (R() < 0.2) { M.color([0.4, 0.28, 0.18]); M.save().move(tx, h - 0.05, tz); M.cyl('stem', 0.025, 0.2, 5); M.restore(); }
  }
});
/* Acacia (arbre en parasol des oueds) : tronc tordu, couronne plate en nappe, sans feuilles en bas (on voit dessous) */
PF.smAcacia = (h = 4.6, seed = 1, dead = false) => prefab(`smAcacia${h}_${seed}_${dead ? 1 : 0}`, (M) => {
  const R = rngOf(seed * 23 + 11);
  M.color(dead ? [0.62, 0.56, 0.5] : [0.46, 0.38, 0.32]).local(1);
  const path = []; for (let k = 0; k <= 6; k++) { const t = k / 6; path.push([Math.sin(t * 3 + seed) * 0.35 * t, t * h * 0.62, Math.cos(t * 2 + seed) * 0.25 * t]); }
  M.sweep('wood', circleShape(1, 7), path, { scale: (t) => lerp(0.2, 0.09, t), uAround: 0.6 });
  const top = path[path.length - 1], tips = [];
  M.swFn = swCrown(top[0], top[2], h * 0.5, h, h * 0.5, 0.7); // la nappe de feuilles frémit et se balance (02md-vent.js)
  for (let b = 0; b < 4; b++) {
    const a = b * 1.6 + seed + R() * 0.5, reach = h * R.range(0.38, 0.55), P2 = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; P2.push([top[0] + Math.cos(a) * reach * t, top[1] + Math.sin(t * Math.PI * 0.6) * h * 0.22, top[2] + Math.sin(a) * reach * t]); }
    M.sweep('wood', circleShape(1, 5), P2, { scale: (t) => lerp(0.08, 0.025, t), uAround: 0.6 }); tips.push(P2[4], P2[2]);
  }
  if (!dead) for (let i = 0; i < Math.round(h * 9); i++) {
    const c = tips[Math.floor(R() * tips.length)], a = R() * TAU, r = R() * h * 0.22;
    cyPatch(M, [c[0] + Math.cos(a) * r, c[1] + R.range(-0.05, 0.25), c[2] + Math.sin(a) * r], R.range(0.9, 1.3), CYF.olive, R, R.pick([[0.72, 0.82, 0.55], [0.8, 0.86, 0.6], [0.66, 0.76, 0.5]]), { tilt: R.range(0, 0.35), up: 0.8 });
  }
  M.col(-0.2, 0.2, 0, h * 0.6, -0.2, 0.2, 'wood');
  M.occ(-h * 0.45, h * 0.45, h * 0.6, h, -h * 0.45, h * 0.45, 0.3);
});
/* Prefab de palmier lointain (peu de sommets, sans collision ni ombre propre) : mêmes palmes que PF.palm, en trois segments ; tronc plus ou moins
   gros et couronne plus ou moins grande selon la graine */
PF.smPalmFar = (h = 8, seed = 1) => prefab(`smPalmFar${h}_${seed}`, (M) => {
  const R = rngOf(seed * 7 + 5), lx = R.range(-0.6, 0.6), lz = R.range(-0.6, 0.6), g = 0.75 + ((seed * 5) % 7) * 0.09, cr = 0.85 + ((seed * 3) % 5) * 0.08;
  M.color([0.6, 0.52, 0.42]).local(1); M.cls = 1;
  M.sweep('palmbark', circleShape(1, 5), [[0, 0, 0], [lx * 0.3, h * 0.5, lz * 0.3], [lx, h, lz]], { scale: (t) => (0.22 - 0.08 * t) * g, uAround: 1 });
  for (let i = 0; i < 14; i++) {
    const u = i / 13;
    M.color([R.range(0.85, 1), R.range(0.9, 1), R.range(0.75, 0.9)]);
    palmFrond(M, [lx, h, lz], i * 2.39996 + R() * 0.3, lerp(1.3, 0.25, u), lerp(1.2, -1, u), R.range(3.1, 4) * cr * lerp(0.7, 1, u), { w: 0.5, segs: 3, fw: 0 });
  }
});
/* Puits : celui de Meltem (cyWell, 02ye-cyclades-deco.js), sur le sable aplani : même puits creux (margelle de pierre sèche, conduit jusqu'à l'eau,
   potence, poulie), même seau qui pend et se balance quand on le touche (hangAdd), mêmes collisions, tirs et grenades qui descendent dans le
   conduit (HOLES). Conduit de 1 m (rw 0,5) : la grille du relief est de 1 m, le puits est au milieu d'une case (x et z sont ramenés au centre
   de leur case) que reliefMesh saute, la margelle la recouvre. À poser pendant la construction de la carte, avant reliefMesh. */
function smWell(x, z) {
  x = Math.floor(x) + 0.5; z = Math.floor(z) + 0.5;
  cyWell(x, z, { y: reliefFlat(x, z, 1.0, 1.0, 0, { margin: 0.5 }), rw: 0.5, relief: true });
}
/* Tapis qui sèchent sur une corde tendue entre deux perches plantées dans le sable (tissus simulés, lourds : 02mc-tissus.js) ; la corde à y. Jusqu'en
   4.6.0, la corde pendait entre deux crochets en l'air */
function smRugLine(xa, za, xb, zb, y, R) {
  LINES.push({ k: 'linge', a: [xa, y, za], b: [xb, y, zb] }); lineHooks([xa, y, za], [xb, y, zb]);
  const M = DECOR; M.save().color(SM.palm); M.cls = 1;
  for (const [px, pz] of [[xa, za], [xb, zb]]) { const g = smY(px, pz, 0.1); M.save().move(px, g - 0.1, pz); M.cyl('wood', 0.045, y - g + 0.22, 6); M.restore(); M.col(px - 0.06, px + 0.06, g, y + 0.1, pz - 0.06, pz + 0.06, 'wood'); }
  M.color([0.7, 0.62, 0.5]); M.cls = 2;
  M.tube('plastic', 0.008, sagPath([xa, y, za], [xb, y, zb], 0.18, 10), 3);
  const dx = xb - xa, dz = zb - za, l = hyp(dx, dz), ux = dx / l, uz = dz / l, rugs = [[0.62, 0.14, 0.12], [0.75, 0.42, 0.15], [0.2, 0.25, 0.5], [0.55, 0.2, 0.3], [0.85, 0.75, 0.55]];
  for (let t = 0.2; t < 0.85; t += 0.32) {
    const w = R.range(0.8, 1.1), h = R.range(1.0, 1.4), x = xa + dx * t, z = za + dz * t, yy = y - Math.sin(t * Math.PI) * 0.18;
    M.color(R.pick(rugs));
    clothPiece(M, [x - ux * w / 2, yy - h, z - uz * w / 2], [x + ux * w / 2, yy - h, z + uz * w / 2], [x + ux * w / 2, yy, z + uz * w / 2], [x - ux * w / 2, yy, z - uz * w / 2], [uz, 0, -ux], { genre: 'lourd', grp: 'tapis' + xa + ',' + za });
  }
  M.restore();
}

/* Charrette à bras (bois, deux roues pleines sur un essieu), posée sur ses brancards ; collisions de la caisse et des roues, et une
   boîte basse sous les brancards (on l'enjambe d'un pas, on n'y bute plus). Brancards fixés sous la caisse et posés au sol par leur bout,
   barre de poussée entre eux (ils partaient du sol sous la caisse et remontaient vers l'avant) ; roues symétriques, avec moyeu */
PF.smCart = () => prefab('smCart', (M) => {
  M.color(SM.wood).local(1);
  M.boxB('wood', -0.7, 0.7, 0.55, 0.62, -1.0, 1.0, { bevel: 0.01 });
  for (const sx of [-1, 1]) M.boxB('wood', sx * 0.7 - 0.04, sx * 0.7 + 0.04, 0.62, 0.95, -1.0, 1.0);
  M.boxB('wood', -0.7, 0.7, 0.62, 0.95, 0.96, 1.0); M.boxB('wood', -0.7, 0.7, 0.62, 0.95, -1.0, -0.96);
  for (const sx of [-1, 1]) M.boxB('wood', sx * 0.45 - 0.05, sx * 0.45 + 0.05, 0.47, 0.55, -0.95, 1.0); // longerons sous la caisse
  const tilt = Math.asin(0.46 / 1.75);
  for (const sx of [-1, 1]) { M.save().move(sx * 0.45, 0.51, 0.95).rotX(tilt); M.boxB('wood', -0.04, 0.04, -0.04, 0.04, 0, 1.75); M.restore(); }
  M.save().move(0.49, 0.51 - Math.sin(tilt) * 1.55, 0.95 + Math.cos(tilt) * 1.55).rotZ(Math.PI / 2); M.cyl('wood', 0.03, 0.98, 8); M.restore(); // barre de poussée
  M.color([0.36, 0.28, 0.2]);
  for (const sx of [-1, 1]) { M.save().move(sx > 0 ? 0.85 : -0.77, 0.45, 0).rotZ(Math.PI / 2); M.cyl('wood', 0.45, 0.08, 16); M.restore(); }
  M.color([0.25, 0.22, 0.2]);
  M.save().move(0.93, 0.45, 0).rotZ(Math.PI / 2); M.cyl('steel', 0.035, 1.86, 8); M.restore(); // essieu et moyeux
  for (const sx of [-1, 1]) { M.save().move(sx > 0 ? 0.92 : -0.85, 0.45, 0).rotZ(Math.PI / 2); M.cyl('steel', 0.09, 0.07, 10); M.restore(); }
  M.col(-0.75, 0.75, 0, 0.95, -1.0, 1.0, 'wood');
  for (const sx of [-1, 1]) M.col(sx > 0 ? 0.75 : -0.93, sx > 0 ? 0.93 : -0.75, 0, 0.9, -0.42, 0.42, 'wood');
  M.col(-0.5, 0.5, 0, 0.3, 1.0, 2.62, 'wood');
});

/* ---------- Surfaces trouées (vitres de l'avion) ---------- */
/* Vitres (256 x 128) : à gauche, une vitre claire, poussiéreuse vers le bas (v = 0) et rayée ; à droite, la même fêlée en étoile autour d'un trou */
function smGlassTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), R = rngOf(4747);
  for (const x0 of [0, 128]) {
    g.save(); g.beginPath(); g.rect(x0, 0, 128, 128); g.clip();
    g.fillStyle = 'rgba(206,220,228,0.14)'; g.fillRect(x0, 0, 128, 128);
    const gr = g.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, 'rgba(200,172,128,0.5)'); gr.addColorStop(1, 'rgba(200,172,128,0)'); g.fillStyle = gr; g.fillRect(x0, 0, 128, 70);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(205,180,140,${(0.15 + R() * 0.25).toFixed(2)})`; g.fillRect(x0 + R() * 128, R() * 128 * R(), 1 + R() * 1.5, 1 + R() * 1.5); }
    g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) { const x = x0 + R() * 128, y = R() * 128, a = R() * Math.PI, l = 10 + R() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.restore();
  }
  // la fêlure : une auréole d'éclats, des fêlures en étoile, des arcs entre elles, un trou déchiqueté au point d'impact
  const ix = 198, iy = 74, rays = [];
  g.save(); g.beginPath(); g.rect(128, 0, 128, 128); g.clip();
  g.fillStyle = 'rgba(232,238,238,0.42)'; g.beginPath(); for (let k = 0; k <= 16; k++) { const a = (k / 16) * TAU, r = 24 + R() * 10; g.lineTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); } g.fill();
  g.strokeStyle = 'rgba(244,248,248,0.8)'; g.lineWidth = 1.1;
  for (let k = 0; k < 11; k++) { const a = (k / 11) * TAU + R() * 0.4; rays.push(a); let x = ix, y = iy; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 8; i++) { const b = a + (R() - 0.5) * 0.5; x += Math.cos(b) * 16; y += Math.sin(b) * 16; g.lineTo(x, y); } g.stroke(); }
  g.lineWidth = 0.8;
  for (const r of [34, 52, 74]) for (let k = 0; k < 11; k++) if (R() < 0.75) { const a = rays[k], b = rays[(k + 1) % 11], r2 = r + (R() - 0.5) * 8; g.beginPath(); g.moveTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); g.lineTo(ix + Math.cos(b) * r2, iy + Math.sin(b) * r2); g.stroke(); }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, r = (k % 2 ? 9 : 17) + R() * 7; g.lineTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); }
  g.fill(); g.restore();
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.flipY = false; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/* Rectangle arrondi : contour convexe dans le sens trigonométrique en (u, v), centre (cu, cv), demi-tailles (hu, hv), coins de rayons (ru, rv) */
function smRound(cu, cv, hu, hv, ru, rv, n = 4) {
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const su = k === 0 || k === 3 ? 1 : -1, sv = k < 2 ? 1 : -1;
    for (let i = 0; i < n; i++) { const a = ((k + i / (n - 1)) * Math.PI) / 2; pts.push([cu + su * (hu - ru) + ru * Math.cos(a), cv + sv * (hv - rv) + rv * Math.sin(a)]); }
  }
  return { c: [cu, cv], pts };
}
/* Point (x, y) dans le polygone convexe q, bord compris */
function smConvexIn(q, x, y) {
  let pos = 0, neg = 0;
  for (let k = 0; k < q.length; k++) { const a = q[k], b = q[(k + 1) % q.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c > 1e-12) pos++; else if (c < -1e-12) neg++; }
  return !(pos && neg);
}
/* Surface en grille : sommets f(u, v) aux valeurs us x vs (croissantes), normales par différences finies (o.pole aux pôles dégénérés, comme
   M.surf), coordonnées de texture o.uv(u, v) en mètres ; o.flip : face visible du côté -(du x dv). Deux façons d'y ouvrir des vitres :
   - o.holes : contours convexes { c, pts } (smRound), chacun au milieu d'une seule case, triangulée entre ses quatre coins et le contour
     (aucun sommet de plus sur ses bords : les cases voisines restent jointives) ;
   - o.snap(u, v) -> [u, v] | null pose un sommet proche du bord d'une ouverture sur ce bord, o.drop(u, v) retire le triangle dont c'est le
     centre : une grille assez fine épouse ainsi des vitres de forme quelconque, sans fente entre les cases. */
function smGrid(M, mat, us, vs, f, o = {}) {
  const nu = us.length, nv = vs.length, eu = (us[nu - 1] - us[0]) * 1e-4, ev = (vs[nv - 1] - vs[0]) * 1e-4, sg = o.flip ? -1 : 1;
  const c = f((us[0] + us[nu - 1]) / 2, (vs[0] + vs[nv - 1]) / 2), B = M.buf(mat, c[0], c[1], c[2]);
  const vert = (u, v) => {
    const a = f(u - eu, v), b = f(u + eu, v), a2 = f(u, v - ev), b2 = f(u, v + ev);
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = b2[0] - a2[0], by = b2[1] - a2[1], bz = b2[2] - a2[2];
    let nx = (ay * bz - az * by) * sg, ny = (az * bx - ax * bz) * sg, nz = (ax * by - ay * bx) * sg; const l = hyp3(nx, ny, nz);
    if (l < 1e-12) [nx, ny, nz] = o.pole ? o.pole(u, v) : [0, 1, 0]; else { nx /= l; ny /= l; nz /= l; }
    const p = f(u, v), t = o.uv ? o.uv(u, v) : [u, v]; // f en dernier : la teinte qu'il pose (M.tint) est celle du sommet
    return { id: M.v(B, p[0], p[1], p[2], nx, ny, nz, t[0], t[1]), u, v };
  };
  // triangle rendu s'il tourne dans le sens trigonométrique en (u, v) (fix : remis dans ce sens) ; dégénéré ou dans une ouverture, retiré
  const tri = (a, b, d, fix) => {
    let ar = (b.u - a.u) * (d.v - a.v) - (b.v - a.v) * (d.u - a.u);
    if (fix && ar < 0) { [b, d] = [d, b]; ar = -ar; }
    if (ar <= 1e-12 || (o.drop && o.drop((a.u + b.u + d.u) / 3, (a.v + b.v + d.v) / 3))) return;
    if (o.flip) M.tri(B, a.id, d.id, b.id); else M.tri(B, a.id, b.id, d.id);
  };
  const G = [];
  for (const v of vs) for (const u of us) { const q = (o.snap && o.snap(u, v)) || [u, v]; G.push(vert(q[0], q[1])); }
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const k = j * nu + i, O = [G[k], G[k + 1], G[k + nu + 1], G[k + nu]];
    const h = o.holes && o.holes.find((q) => q.c[0] > us[i] && q.c[0] < us[i + 1] && q.c[1] > vs[j] && q.c[1] < vs[j + 1]);
    if (!h) { tri(O[0], O[1], O[2]); tri(O[0], O[2], O[3]); continue; }
    // couronne entre la case et le trou : on tourne autour du centre en avançant sur celui des deux bords dont le sommet suivant vient d'abord
    const I = h.pts.map((p) => vert(p[0], p[1])), a0 = Math.atan2(O[0].v - h.c[1], O[0].u - h.c[0]);
    const at = (q) => { let a = Math.atan2(q.v - h.c[1], q.u - h.c[0]) - a0; while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; };
    let s0 = 0; for (let m = 1; m < I.length; m++) if (at(I[m]) < at(I[s0])) s0 = m;
    const In = I.map((_, m) => I[(s0 + m) % I.length]), nI = In.length, aO = (m) => (m < 4 ? at(O[m]) : TAU), aI = (m) => (m < nI ? at(In[m]) : TAU + at(In[0]));
    let p = 0, q = 0;
    while (p < 4 || q < nI) {
      if (p < 4 && (q >= nI || aO(p + 1) <= aI(q + 1))) { tri(O[p], O[(p + 1) % 4], In[q % nI], true); p++; }
      else { tri(O[p % 4], In[q], In[(q + 1) % nI], true); q++; }
    }
  }
}
/* Éventail plan (centre c, contour pts) de normale n ; uv facultatif : [centre, puis chaque point du contour] */
function smFan(M, mat, c, pts, n, uv) {
  const B = M.buf(mat, c[0], c[1], c[2]), vt = (p, k) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], uv ? uv[k][0] : 0, uv ? uv[k][1] : 0);
  const ic = vt(c, 0), ids = pts.map((p, k) => vt(p, k + 1)), a = pts[0], b = pts[1];
  const cr = [(a[1] - c[1]) * (b[2] - c[2]) - (a[2] - c[2]) * (b[1] - c[1]), (a[2] - c[2]) * (b[0] - c[0]) - (a[0] - c[0]) * (b[2] - c[2]), (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0])];
  const ok = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0;
  for (let k = 0; k < ids.length; k++) { const i = ids[k], j = ids[(k + 1) % ids.length]; if (ok) M.tri(B, ic, i, j); else M.tri(B, ic, j, i); }
}

/* ---------- L'épave de l'avion de ligne ---------- */
/* Biréacteur moyen-courrier à aile basse (fuselage de 4 m de diamètre), posé sur le ventre dans la sebkha et cassé en deux, le long de x (le nez
   vers +x). (cx, y0) : la cassure, le sable sous le fuselage ; axe du fuselage en z = zc (0,5 m à Simoun : l'allée de la cabine passe sur une
   rangée de centres de case, où marchent les bots). Fuselage de 2 m de rayon enfoncé d'un mètre, plancher à y0 + 0,25 (on y entre de
   plain-pied) ; les portes et les issues font 1,2 m, centrées sur un centre de case.
   - Tronçon avant (de cx + 2,2 à cx + 14,4) : la cabine, sièges 3 + 3 (PF.smSeats3) de part et d'autre d'une allée de 1,2 m, coffres à bagages
     et leur liseré bleu, plafond et rampes de lumière, hublots ouverts (vitre transparente, fêlée ou absente, volet), rideau ; portes avant
     ouvertes des deux côtés (on traverse), cloison et poste de pilotage, nez au profil d'avion de ligne et son pare-brise à six vitres
     transparentes (une absente, deux fêlées).
   - Tronçon arrière (de cx - 12 à cx) : de la cassure à une cloison (cx - 7), des sièges renversés, des bagages, les issues d'aile ouvertes ;
     au-delà, le fuselage est plein du sable d'une dune qui monte sur son flanc : par elle on gagne le toit (praticable, des marches de
     collision suivent la courbe). La queue relevée, la dérive bleue à bandes claires, les empennages.
   - Ailes basses en flèche, le dessus praticable, winglets bleus ; les deux réacteurs arrachés, couchés dans le sable devant les ailes.
   Livrée sans nom ni marque : fuselage blanc, ventre arrière et dérive bleus. Rend { top } */
function smPlane(cx, y0, R, zc = 0) {
  const M = DECOR, Rf = 2.0, Ri = Rf - 0.07, cy = y0 + 1.0, top = cy + Rf, yf = cy - 0.75, N = makeNoise(3131), Z = (dz) => zc + dz;
  const white = [0.83, 0.84, 0.85], blue = [0.12, 0.22, 0.56], dirt = [0.78, 0.7, 0.6], insul = [0.5, 0.54, 0.46];
  const XF0 = cx + 2.2, XF1 = cx + 14.4, XR0 = cx - 12, XR1 = cx, RB = cx - 7, P = (x, r, th) => [x, cy + r * Math.sin(th), Z(r * Math.cos(th))];
  const jag = (th, s) => (N.fbm(Math.sin(th) * 1.5 + 2.3 + s, Math.abs(Math.cos(th)) * 1.5 + 0.7, 8, 8, 2) - 0.5) * 1.4;
  // ouvertures : portes avant, issues d'aile ; de 1,2 m centrées sur un centre de case, seuil au plancher, 1,95 m de haut
  const thA = Math.asin((yf - 0.05 - cy) / Rf), thB = Math.asin((yf + 1.95 - cy) / Rf), OPEN = [cx + 13.5, cx - 5.5].map((x) => [x - 0.6, x + 0.6]);
  // livrée : blanc, sali de sable au ras du sol, ventre bleu sur l'arrière (une bande qui remonte vers la queue)
  // vieillie au désert : plaques ternies par le sable, coulées sombres sous les hublots et les joints, poussière qui monte du ventre
  const liv = (x, y) => {
    const b = x < cx - 2 ? smoothstep(0.1, -0.1, y - (cy - 0.45 + (cx - 2 - x) * 0.17)) : 0, d = 1 - smoothstep(y0 - 0.1, y0 + 1.2, y);
    const n = N.fbm(x * 0.21 + 3.1, y * 0.35 + 1.7, 64, 64, 3), st = smoothstep(0.56, 0.8, N.fbm(x * 0.45 + 9.3, y * 0.05 + 0.4, 64, 64, 2)) * smoothstep(cy + 1.7, cy - 0.5, y);
    const dd = Math.max(d * 0.7, (1 - smoothstep(y0 + 0.3, cy + 0.7, y)) * 0.32);
    return [0, 1, 2].map((k) => sl(lerp(lerp(white[k], blue[k], b), dirt[k], dd) * (0.84 + n * 0.24) * (1 - st * 0.36)));
  };
  // hublots, au droit des rangées de sièges, vitre (claire ou fêlée) et volet tirés au sort ; près des cassures, plus de casse. Jamais de hublot
  // sans vitre : on verrait au travers de la coque qui arrête les balles (fentes.js).
  // Derrière la cloison du tronçon arrière, le fuselage est plein de sable : la vitre y reste, opaque, couleur de sable
  const winTh = Math.asin((yf + 1.25 - cy) / Rf), inOpen = (x, m = 0.25) => OPEN.some((o) => x > o[0] - m && x < o[1] + m), WINS = [];
  for (const x0 of [XF0 + 1.2, XR0 + 1.0]) for (let x = x0; x <= (x0 > cx ? cx + 11.7 : XR1 - 0.6); x += 0.82) for (const s of [1, -1]) {
    if (inOpen(x)) continue;
    const open = (x > XF0 && x < XF1) || (x > RB + 0.25 && x < XR1), near = Math.min(Math.abs(x - XF0), Math.abs(x - XR1)) < 2.6, r = R();
    WINS.push({ x, s, th: s > 0 ? winTh : Math.PI - winTh, open, glass: !open ? 'sand' : r < (near ? 0.7 : 0.25) ? 'crack' : 'ok', shade: R() });
  }
  // ouverture d'un hublot [demi-largeur, demi-hauteur en angle, rayon des coins] : dans la peau et l'isolant (HO), plus grande dans le revêtement
  // de la cabine (HL : le tableau s'évase vers l'intérieur)
  const HO = [0.115, 0.165 / Rf, 0.085], HL = [0.155, 0.215 / 1.84, 0.1], hole = (w, r, H) => smRound(w.x, w.th, H[0], H[1], H[2], H[2] / r);
  // colonnes d'un morceau [a, b] : une case de 0,82 m par hublot ouvert (le hublot au milieu), ailleurs au plus tous les `step` m
  const cols = (a, b, ws, step) => {
    const xs = [a, b, ...ws.flatMap((w) => [w.x - 0.41, w.x + 0.41])].map((x) => clamp(x, a, b)).sort((p, q) => p - q), us = [a];
    for (const q of xs) { const p = us[us.length - 1]; if (q - p < 0.02) continue; const n = ws.some((w) => Math.abs((p + q) / 2 - w.x) < 0.3) ? 1 : Math.max(1, Math.round((q - p) / step)); for (let m = 1; m <= n; m++) us.push(p + ((q - p) * m) / n); }
    return us;
  };
  // rangées de la coque (tous les 0,12 rad au plus), communes à tous les morceaux ; la bande des hublots tient dans une seule rangée
  const ROWS = (() => {
    const k = [-Math.PI / 2, 1.5 * Math.PI, thA, thB, Math.PI - thB, Math.PI - thA, winTh - 0.12, winTh + 0.12, Math.PI - winTh - 0.12, Math.PI - winTh + 0.12].sort((p, q) => p - q), out = [k[0]];
    for (let i = 1; i < k.length; i++) { const p = k[i - 1], q = k[i], band = Math.abs((p + q) / 2 - winTh) < 1e-6 || Math.abs((p + q) / 2 - Math.PI + winTh) < 1e-6, n = band ? 1 : Math.max(1, Math.ceil((q - p) / 0.12)); for (let m = 1; m <= n; m++) out.push(p + ((q - p) * m) / n); }
    return out;
  })();
  // coque d'un morceau [a, b], des rangées t0 à t1 : peau (livrée) et doublure (isolant), trouées aux hublots ouverts ; aux cassures (ja, jb),
  // la case du bout se plie sur le bord déchiqueté
  const hull = (a, b, ja, jb, t0, t1) => {
    const ws = WINS.filter((w) => w.open && w.x > a && w.x < b), us = cols(a, b, ws, 0.6), vs = ROWS.filter((t) => t > t0 - 1e-9 && t < t1 + 1e-9), n = us.length;
    const X = (x, th) => x + (ja ? jag(th, 0) * Math.max(0, 1 - (x - us[0]) / (us[1] - us[0])) : 0) + (jb ? jag(th, 5) * Math.max(0, 1 - (us[n - 1] - x) / (us[n - 1] - us[n - 2])) : 0);
    const holes = ws.filter((w) => w.th > t0 && w.th < t1).map((w) => hole(w, Rf, HO));
    for (const [r, inner] of [[Rf, false], [Ri, true]]) {
      M.save().local(1); M.cls = 0; M.color(insul);
      smGrid(M, 'hull', us, vs, (x, th) => { const p = P(X(x, th), r, th); if (!inner) M.tint = liv(p[0], p[1]); return p; }, { flip: inner, uv: (x, th) => [x, th * r], holes });
      M.restore();
    }
  };
  // un tronçon : la coque découpée autour des ouvertures (les deux côtés à la fois)
  const tube = (x0, x1, j0, j1) => {
    const cuts = [x0, x1, ...OPEN.flat().filter((x) => x > x0 && x < x1)].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], open = OPEN.some((o) => a >= o[0] - 1e-6 && b <= o[1] + 1e-6), ja = j0 && a === x0, jb = j1 && b === x1;
      if (!open) { hull(a, b, ja, jb, -Math.PI / 2, 1.5 * Math.PI); continue; }
      hull(a, b, ja, jb, -Math.PI / 2, thA); hull(a, b, ja, jb, thB, Math.PI - thB); hull(a, b, ja, jb, Math.PI - thA, 1.5 * Math.PI);
    }
  };
  tube(XR0, XR1, false, true); tube(XF0, XF1, true, false);
  // les hublots : tableau (de la peau à l'isolant, puis évasé jusqu'au revêtement de la cabine), vitre, volet à hauteur variable
  const ring = (w, H, rH, r) => hole(w, rH, H).pts.map(([x, t]) => P(x, r, t));
  M.save().local(1);
  for (const w of WINS) {
    const out = [0, Math.sin(w.th), Math.cos(w.th)], cen = (r) => P(w.x, r, w.th);
    if (!w.open) { M.cls = 1; M.color([0.58, 0.47, 0.34]); smFan(M, 'glass', cen(Rf + 0.004), ring(w, HO, Rf, Rf + 0.004), out); continue; }
    const A0 = ring(w, HO, Rf, Rf), A1 = ring(w, HO, Rf, Ri), A2 = ring(w, HL, 1.84, 1.84);
    for (const [S0, S1, col] of [[A0, A1, [0.66, 0.68, 0.7]], [A1, A2, [0.86, 0.86, 0.84]]]) {
      M.cls = 1; M.color(col);
      for (let k = 0; k < S0.length; k++) {
        const k1 = (k + 1) % S0.length, m = [0, 1, 2].map((i) => (S0[k][i] + S0[k1][i] + S1[k][i] + S1[k1][i]) / 4), c = cen(hyp(m[1] - cy, m[2] - Z(0)));
        M.quad('cabin', S0[k], S0[k1], S1[k1], S1[k], [c[0] - m[0], c[1] - m[1], c[2] - m[2]]);
      }
    }
    if (w.glass !== 'none') {
      const pts = hole(w, Rf, HO).pts, tile = w.glass === 'crack' ? 0.5 : 0, uv = (x, t) => [tile + (0.5 * (x - w.x + HO[0])) / (2 * HO[0]), 0.5 + (w.s * (t - w.th)) / (2 * HO[1])];
      M.cls = 1; M.color([0.82, 0.88, 0.9]);
      smFan(M, 'glassAir', cen(Rf - 0.03), pts.map(([x, t]) => P(x, Rf - 0.03, t)), out, [uv(w.x, w.th), ...pts.map(([x, t]) => uv(x, t))]);
    }
    const f = w.shade < 0.4 ? 0 : w.shade < 0.75 ? 0.5 : 0.96; // volet levé, à demi baissé, fermé
    if (f) {
      const t0 = w.th + w.s * 0.125, t1 = t0 - w.s * 0.25 * f, q = [P(w.x - 0.15, 1.87, t0), P(w.x + 0.15, 1.87, t0), P(w.x + 0.15, 1.87, t1), P(w.x - 0.15, 1.87, t1)];
      M.cls = 1; M.color([0.9, 0.9, 0.88]); M.quad('cabin', ...q, out.map((v) => -v)); M.quad('cabin', ...q, out);
    }
  }
  M.restore();
  // cabine : plancher, moquette de l'allée, doublure blanche des parois, coffres à bagages, plafond et ses rampes, cloisons
  const thLo = Math.asin((yf + 0.04 - cy) / 1.84), thHi = Math.asin((yf + 1.56 - cy) / 1.84);
  for (const [a, b] of [[RB, XR1], [XF0, XF1 - 0.12]]) {
    M.save().local(1); M.cls = 1; // l'intérieur ne porte pas d'ombre au soleil (la coque s'en charge)
    M.color([0.24, 0.25, 0.27]); M.boxB('cabin', a, b, yf - 0.12, yf, Z(-1.8), Z(1.8), { skip: 'y' });
    M.color([0.16, 0.19, 0.32]); M.boxB('canvas', a + 0.3, b - 0.1, yf, yf + 0.008, Z(-0.5), Z(0.5), { skip: 'y' });
    DECOR.col(a, b, yf - 0.5, yf, Z(-1.9), Z(1.9), 'metal');
    // doublure, coupée aux ouvertures
    const segs = [[a, b]]; for (const o of OPEN) for (let i = segs.length - 1; i >= 0; i--) { const sg = segs[i]; if (o[1] <= sg[0] || o[0] >= sg[1]) continue; segs.splice(i, 1, ...[[sg[0], o[0]], [o[1], sg[1]]].filter((p) => p[1] - p[0] > 0.05)); }
    M.color([0.9, 0.9, 0.88]);
    const seg = (p, q) => { const n = Math.max(1, Math.ceil((q - p) / 0.13)); return Array.from({ length: n }, (_, k) => lerp(p, q, (k + 1) / n)); };
    for (const [s0, s1] of segs) for (const s of [1, -1]) {
      const c = s > 0 ? winTh : Math.PI - winTh, t0 = s > 0 ? thLo : Math.PI - thHi, t1 = s > 0 ? thHi : Math.PI - thLo, ws = WINS.filter((w) => w.open && w.s === s && w.x > s0 && w.x < s1);
      smGrid(M, 'cabin', cols(s0, s1, ws, 0.8), [t0, ...seg(t0, c - 0.15), c + 0.15, ...seg(c + 0.15, t1)], (x, t) => P(x, 1.84, t), { flip: true, uv: (x, t) => [x, t * 1.84], holes: ws.map((w) => hole(w, 1.84, HL)) });
    }
    // coffres : dessous, face bombée, liseré bleu dessous le long du bord, poignées ; pas au-dessus des portes
    const bins = []; for (const [s0, s1] of segs) { const c0 = s0 + 0.15, c1 = s1 - 0.15; if (c1 - c0 > 0.6) bins.push([c0, c1]); }
    for (const [b0, b1] of bins) for (const s of [1, -1]) {
      const zz = (d) => Z(s * d), A = [1.08, yf + 1.55], Bm = [1.0, yf + 1.8], C = [1.04, yf + 2.05], D = [1.45, yf + 2.05], E = [1.72, yf + 1.55], pt = (x, p) => [x, p[1], zz(p[0])];
      M.color([0.93, 0.93, 0.92]);
      M.quad('cabin', pt(b0, A), pt(b1, A), pt(b1, E), pt(b0, E), [0, -1, 0]);
      M.quad('cabin', pt(b0, A), pt(b1, A), pt(b1, Bm), pt(b0, Bm), [0, -0.3, -s]);
      M.quad('cabin', pt(b0, Bm), pt(b1, Bm), pt(b1, C), pt(b0, C), [0, 0.15, -s]);
      M.quad('cabin', pt(b0, C), pt(b1, C), pt(b1, [1.04, yf + 2.2]), pt(b0, [1.04, yf + 2.2]), [0, 0, -s]);
      for (const xe of [b0, b1]) { const n = [xe === b0 ? -1 : 1, 0, 0]; M.quad('cabin', pt(xe, A), pt(xe, Bm), pt(xe, C), pt(xe, D), n); M.tri3('cabin', pt(xe, A), pt(xe, D), pt(xe, E), n); }
      M.color([0.35, 0.72, 1.0]); M.quad('lampOff', [b0, yf + 1.544, zz(1.09)], [b1, yf + 1.544, zz(1.09)], [b1, yf + 1.544, zz(1.16)], [b0, yf + 1.544, zz(1.16)], [0, -1, 0]);
      { const t0 = Math.asin((yf + 1.47 - cy) / 1.828), t1 = Math.asin((yf + 1.53 - cy) / 1.828), w = (x, t) => P(x, 1.828, s > 0 ? t : Math.PI - t); M.quad('lampOff', w(b0, t0), w(b1, t0), w(b1, t1), w(b0, t1), [0, 0, -s]); } // la lumière bleue sous les coffres
      M.color([0.62, 0.63, 0.64]); M.quad('cabin', [b0, yf + 1.546, zz(1.075)], [b1, yf + 1.546, zz(1.075)], [b1, yf + 1.546, zz(1.09)], [b0, yf + 1.546, zz(1.09)], [0, -1, 0]);
      M.color([0.55, 0.56, 0.57]);
      for (let x = b0 + 0.82; x < b1 - 0.1; x += 1.64) M.quad('cabin', [x - 0.008, yf + 1.555, zz(1.072)], [x + 0.008, yf + 1.555, zz(1.072)], [x + 0.008, yf + 1.79, zz(0.997)], [x - 0.008, yf + 1.79, zz(0.997)], [0, -0.3, -s]);
      M.color([0.42, 0.43, 0.45]);
      for (let x = b0 + 0.41; x < b1 - 0.1; x += 0.82) M.boxB('cabin', x - 0.08, x + 0.08, yf + 1.78, yf + 1.82, zz(0.985) - 0.02, zz(0.985) + 0.02);
      // panneaux de service sous les coffres, au-dessus de chaque rangée : liseuses et bouches d'air
      for (let x = b0 + 0.25; x < b1 - 0.4; x += 0.82) {
        M.color([0.78, 0.79, 0.8]); M.quad('cabin', [x, yf + 1.543, zz(1.2)], [x + 0.36, yf + 1.543, zz(1.2)], [x + 0.36, yf + 1.543, zz(1.5)], [x, yf + 1.543, zz(1.5)], [0, -1, 0]);
        M.color([1, 0.96, 0.85]); for (const d of [1.26, 1.36, 1.46]) M.quad('lampOff', [x + 0.08, yf + 1.539, zz(d - 0.025)], [x + 0.13, yf + 1.539, zz(d - 0.025)], [x + 0.13, yf + 1.539, zz(d + 0.025)], [x + 0.08, yf + 1.539, zz(d + 0.025)], [0, -1, 0]);
      }
    }
    // plafond et rampe de lumière au milieu
    M.color([0.95, 0.95, 0.94]); M.quad('cabin', [a, yf + 2.2, Z(-1.04)], [b, yf + 2.2, Z(-1.04)], [b, yf + 2.2, Z(1.04)], [a, yf + 2.2, Z(1.04)], [0, -1, 0]);
    M.color([1, 0.97, 0.9]);
    for (let x = a + 0.4; x < b - 0.9; x += 1.64) M.quad('lampOff', [x, yf + 2.192, Z(-0.14)], [x + 1.3, yf + 2.192, Z(-0.14)], [x + 1.3, yf + 2.192, Z(0.14)], [x, yf + 2.192, Z(0.14)], [0, -1, 0]);
    M.restore();
  }
  // cloisons : celle du poste de pilotage (porte fermée), celle du fond du tronçon arrière (derrière, la queue est pleine de sable) ; la
  // sortie de secours en vert au-dessus des portes
  const bulk = (x, nx, door) => {
    M.save().local(1); M.cls = 1; M.color([0.88, 0.88, 0.86]);
    M.surf('cabin', 1, 24, (u, v) => P(x, u * Ri, v * TAU), { uL: Ri, vL: TAU * Ri, flipN: nx > 0 });
    M.color([0.42, 0.44, 0.48]); M.quad('cabin', [x + nx * 0.01, yf, Z(-0.42)], [x + nx * 0.01, yf, Z(0.42)], [x + nx * 0.01, yf + 1.92, Z(0.42)], [x + nx * 0.01, yf + 1.92, Z(-0.42)], [nx, 0, 0]);
    if (door) { M.color([0.12, 0.13, 0.15]); M.quad('cabin', [x + nx * 0.016, yf + 1.4, Z(-0.08)], [x + nx * 0.016, yf + 1.4, Z(0.08)], [x + nx * 0.016, yf + 1.58, Z(0.08)], [x + nx * 0.016, yf + 1.58, Z(-0.08)], [nx, 0, 0]); }
    M.color([0.1, 0.72, 0.32]); M.boxB('lampOff', x + nx * 0.02 - 0.015, x + nx * 0.02 + 0.015, yf + 2.0, yf + 2.13, Z(-0.2), Z(0.2));
    M.restore();
    DECOR.col(Math.min(x, x - nx * 0.15), Math.max(x, x - nx * 0.15), yf, top - 0.75, Z(-1.9), Z(1.9), 'metal');
  };
  bulk(XF1 - 0.12, -1, true); bulk(RB, 1, false);
  for (const [a, b] of OPEN) { M.save().local(1); M.color([0.1, 0.72, 0.32]); M.boxB('lampOff', (a + b) / 2 - 0.18, (a + b) / 2 + 0.18, yf + 2.06, yf + 2.17, Z(0.98), Z(1.0)); M.boxB('lampOff', (a + b) / 2 - 0.18, (a + b) / 2 + 0.18, yf + 2.06, yf + 2.17, Z(-1.0), Z(-0.98)); M.restore(); }
  // sièges 3 + 3 de la cabine avant (11 rangées) ; à l'arrière, un bloc resté en place, deux renversés, des bagages vers la cassure
  // (détails fins : masqués au loin, on ne les voit que de près, par les portes et la cassure)
  for (let x = XF0 + 1.2; x <= cx + 11.7; x += 0.82) for (const s of [1, -1]) M.place(PF.smSeats3(), x, yf, Z(s * 1.19), 0, { cls: 2 });
  M.place(PF.smSeats3(), RB + 0.4, yf, Z(1.19), 0, { cls: 2 });
  for (const [x, dz, ry, rz] of [[cx - 3.4, 0.75, 0.25, Math.PI / 2], [cx - 1.6, -0.6, -0.2, -Math.PI / 2]]) { M.save().move(x, yf + 0.6, Z(dz)).rotY(ry).rotX(rz); M.put(PF.smSeats3(), { cls: 2 }); M.restore(); }
  M.save().move(cx + 1.0, smY(cx + 1.0, Z(3.6), 0.8) + 0.42, Z(3.6)).rotY(2.2).rotZ(Math.PI / 2); M.put(PF.smSeats3()); M.restore();
  const bags = [[cx - 4.6, -0.9, 0.3], [cx - 3.0, -0.2, 2.1], [cx - 1.0, 1.2, 0.9], [cx + 2.6, 1.0, 1.4], [cx + 0.8, -2.6, 0.2], [cx + 1.6, 2.2, 2.6], [cx - 1.0, -3.4, 1.1]];
  bags.forEach(([x, dz, ry], i) => {
    const inside = Math.abs(dz) < 1.8 && (x > RB && x < XR1 || x > XF0 && x < XF1), y = inside ? yf : smY(x, Z(dz), 0.4) + 0.02;
    M.save().local(1).move(x, y, Z(dz)).rotY(ry); M.color([[0.12, 0.16, 0.3], [0.5, 0.12, 0.1], [0.24, 0.25, 0.27], [0.36, 0.38, 0.28]][i % 4]);
    M.boxB('cabin', -0.34, 0.34, 0, 0.24, -0.23, 0.23, { bevel: 0.04 }); M.color([0.15, 0.15, 0.16]); M.boxB('rubber', -0.1, 0.1, 0.24, 0.27, -0.02, 0.02);
    M.col(-0.34, 0.34, 0, 0.24, -0.23, 0.23, 'wood'); M.restore();
  });
  // rideau tiré au bord de l'allée, sur sa tringle
  M.save().local(1); M.cls = 1; M.color([0.12, 0.15, 0.26]);
  for (let i = 0; i < 8; i++) { const x0 = cx + 6.98 + i * 0.025, z0 = Z(-0.56 - (i % 2) * 0.04), z1 = Z(-0.56 - ((i + 1) % 2) * 0.04); M.quad('canvas', [x0, yf + 0.06, z0], [x0 + 0.025, yf + 0.06, z1], [x0 + 0.025, yf + 2.16, z1], [x0, yf + 2.16, z0], [0, 0, -1]); }
  M.color([0.6, 0.6, 0.62]); M.boxB('steel', cx + 6.96, cx + 7.2, yf + 2.16, yf + 2.19, Z(-1.0), Z(-0.55));
  M.restore();
  // portes ouvertes, rabattues vers l'avant le long du fuselage ; câbles qui pendent à la cassure
  M.save().local(1); M.cls = 1;
  for (const [, b] of [OPEN[0]]) for (const s of [1, -1]) {
    M.color(white); M.boxB('hull', b + 0.15, b + 1.05, yf - 0.02, yf + 1.92, Z(s * 2.32) - 0.06, Z(s * 2.32) + 0.06, { bevel: 0.03 }); DECOR.col(b + 0.15, b + 1.05, yf - 0.02, yf + 1.92, Z(s * 2.32) - 0.06, Z(s * 2.32) + 0.06, 'metal');
    M.color([0.6, 0.62, 0.62]); M.boxB('steel', b + 0.05, b + 0.2, yf + 0.9, yf + 1.0, Z(s * 2.05), Z(s * 2.27));
  }
  M.color([0.16, 0.16, 0.17]);
  for (const [x, sx] of [[XR1, 1], [XF0, -1]]) for (const dz of [-0.7, 0.2, 0.9]) M.tube('rubber', 0.012, [[x - sx * 0.1, yf + 2.15, Z(dz)], [x + sx * 0.25, yf + 1.5, Z(dz + 0.1)], [x + sx * 0.35, yf + 0.9, Z(dz + 0.05)]], 4);
  M.restore();
  // collisions de la carlingue : parois (ouvertes aux portes), toit en marches qui suivent la courbe (praticable)
  for (const [a, b] of [[XR0, XR1], [XF0, XF1]]) {
    for (const s of [-1, 1]) {
      const z0 = Z(s > 0 ? 1.85 : -2.1), z1 = Z(s > 0 ? 2.1 : -1.85), cuts = [a, b, ...OPEN.flat().filter((x) => x > a && x < b)].sort((p, q) => p - q);
      for (let i = 0; i < cuts.length - 1; i++) { const p = cuts[i], q = cuts[i + 1], open = OPEN.some((o) => p >= o[0] - 1e-6 && q <= o[1] + 1e-6); DECOR.col(p, q, open ? yf + 1.95 : yf, cy + 1.25, z0, z1, 'metal'); }
    }
    for (const [d0, d1, h] of [[0, 0.75, top - 0.05], [0.75, 1.3, cy + Math.sqrt(Rf * Rf - 1)], [1.3, 1.75, cy + Math.sqrt(Rf * Rf - 2.25)]]) {
      if (d0 === 0) DECOR.col(a, b, cy + 1.25, h, Z(-d1), Z(d1), 'metal');
      else for (const s of [-1, 1]) DECOR.col(a, b, cy + 1.25, h, Math.min(Z(s * d0), Z(s * d1)), Math.max(Z(s * d0), Z(s * d1)), 'metal');
    }
  }
  // nez : profil d'avion de ligne. Le radôme pointe sous l'axe, le dessus descend par le pare-brise, le menton remonte ; sections en ellipse.
  // d : distance à la pointe ; table [d, dessus, dessous, demi-largeur] (par rapport à l'axe), lue en √d pour arrondir la pointe (keyM, 06d-reload.js)
  const NL = 5.2, NK = [[0, -0.5, -0.5, 0], [0.25, -0.12, -0.85, 0.42], [0.6, 0.2, -1.1, 0.72], [1, 0.45, -1.3, 0.98], [1.4, 0.72, -1.47, 1.2],
    [1.8, 1.05, -1.62, 1.42], [2.2, 1.38, -1.73, 1.6], [2.6, 1.62, -1.82, 1.74], [3, 1.78, -1.88, 1.85], [3.5, 1.9, -1.94, 1.93], [4.2, 1.97, -1.98, 1.98],
    [5.2, Rf, -Rf, Rf]].map((k) => [Math.sqrt(k[0]), k[1], k[2], k[3]]);
  const sec = (d) => { const k = keyM(NK, Math.sqrt(Math.max(0, d))); return { yc: cy + (k[0] + k[1]) / 2, ry: (k[0] - k[1]) / 2, rz: k[2] }; };
  const NP = (d, th, dr = 0) => { const s = sec(d); return [XF1 + NL - d, s.yc + (s.ry + dr) * Math.sin(th), Z((s.rz + dr) * Math.cos(th))]; };
  // vitres du poste : le pare-brise en deux, puis la vitre coulissante et la vitre arrière de chaque côté. Un coin est [d, angle depuis le
  // dessus] ; Wp le prend vu de côté (d, hauteur sur l'axe), les bords des vitres voisines suivent le même montant (de 13 cm) décalé de g
  const Wp = (d, y) => { const s = sec(d); return [d, Math.PI / 2 - Math.asin(clamp((cy + y - s.yc) / s.ry, -1, 1))]; }, g = 0.045;
  const A = Wp(1.7, 0.55), B = Wp(2.45, 1.2), C = Wp(2.95, 0.55), D = Wp(2.95, 1.28), sh = (p, dd, da) => [p[0] + dd, p[1] + da];
  const PANES = [[[1.45, g], sh(A, 0, -g), sh(B, 0, -g), [2.13, g]], [sh(A, 0, g), sh(C, -0.065, 0), sh(D, -0.065, 0), sh(B, 0, g)], [sh(C, 0.065, 0), Wp(3.55, 0.6), Wp(3.4, 1.16), sh(D, 0.065, 0)]];
  const onNose = (q, s, dr) => (u, v) => { const lo = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)], hi = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)]; return NP(lerp(lo[0], hi[0], v), Math.PI / 2 - s * lerp(lo[1], hi[1], v), dr); };
  const inward = (f) => { // vrai si la normale de f (du x dv) rentre dans la coque
    const p = f(0.5, 0.5), a = f(0.6, 0.5), b = f(0.5, 0.6), c = sec(XF1 + NL - p[0]), u = [a[0] - p[0], a[1] - p[1], a[2] - p[2]], v = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
    return (u[2] * v[0] - u[0] * v[2]) * (p[1] - c.yc) + (u[0] * v[1] - u[1] * v[0]) * (p[2] - Z(0)) < 0;
  };
  // coque du nez et doublure du poste : grille de 9 cm autour des vitres ; un sommet à moins de 6,6 cm du bord d'une vitre s'y pose, un
  // triangle dont le centre est dans une vitre tombe. PN : les six vitres en (d, angle signé depuis le dessus, + côté +z), distances avec
  // l'angle x 1,5 (le rayon moyen du poste)
  const PN = [1, -1].flatMap((s) => PANES.map((q) => q.map(([d, a]) => [d, s * a]))), KF = 1.5, thr = 0.066;
  const nSnap = (d, th) => {
    const a = Math.PI / 2 - th; if (d < 1.2 || d > 3.9 || Math.abs(a) > 1.4) return null;
    let best = thr, out = null;
    for (const q of PN) for (const c of q) { const e = hyp(d - c[0], (a - c[1]) * KF); if (e < best) { best = e; out = c; } }
    if (!out) for (const q of PN) for (let k = 0; k < 4; k++) {
      const p = q[k], r = q[(k + 1) % 4], ex = r[0] - p[0], ey = (r[1] - p[1]) * KF, t = clamp(((d - p[0]) * ex + (a - p[1]) * KF * ey) / (ex * ex + ey * ey), 0, 1);
      const x = p[0] + ex * t, y = p[1] + (r[1] - p[1]) * t, e = hyp(d - x, (a - y) * KF);
      if (e < best) { best = e; out = [x, y]; }
    }
    return out && [out[0], Math.PI / 2 - out[1]];
  };
  const nDrop = (d, th) => PN.some((q) => smConvexIn(q, d, Math.PI / 2 - th)), NU = [], NV = [], T0 = Math.PI / 2 - 1.35, T1 = Math.PI / 2 + 1.35;
  for (let k = 0; k <= 7; k++) NU.push(1.3 * (k / 7) ** 2);
  for (let k = 1; k <= 29; k++) NU.push(1.3 + (2.55 * k) / 29);
  for (let k = 1; k <= 5; k++) NU.push(3.85 + ((NL - 3.85) * k) / 5);
  for (let k = 0; k < 9; k++) NV.push(-Math.PI / 2 + ((T0 + Math.PI / 2) * k) / 9);
  for (let k = 0; k < 45; k++) NV.push(T0 + ((T1 - T0) * k) / 45);
  for (let k = 0; k <= 9; k++) NV.push(T1 + ((1.5 * Math.PI - T1) * k) / 9);
  M.save().local(1); M.cls = 0;
  smGrid(M, 'hull', NU, NV, (d, th) => { const p = NP(d, th); M.tint = liv(p[0], p[1]); return p; }, { flip: true, snap: nSnap, drop: nDrop, uv: (d, th) => [NL - d, (th + Math.PI / 2) * Rf], pole: () => [0.98, -0.2, 0] });
  M.cls = 1; M.color([0.42, 0.45, 0.48]);
  smGrid(M, 'cabin', NU.filter((d) => d > 0.9), NV.filter((th) => th > -0.8 && th < Math.PI + 0.8), (d, th) => NP(d, th, -0.05), { snap: nSnap, drop: nDrop });
  // tableaux des vitres (de la coque à la doublure) ; vitres transparentes : la coulissante de gauche a disparu, deux autres sont fêlées
  M.color([0.3, 0.31, 0.33]);
  for (const q of PN) {
    const mc = [0, 1].map((i) => (q[0][i] + q[1][i] + q[2][i] + q[3][i]) / 4), at = (e, dr) => NP(e[0], Math.PI / 2 - e[1], dr);
    for (let k = 0; k < 4; k++) {
      const p = q[k], r = q[(k + 1) % 4], n = Math.max(1, Math.ceil(hyp(r[0] - p[0], (r[1] - p[1]) * KF) / 0.08));
      for (let i = 0; i < n; i++) {
        const e0 = [lerp(p[0], r[0], i / n), lerp(p[1], r[1], i / n)], e1 = [lerp(p[0], r[0], (i + 1) / n), lerp(p[1], r[1], (i + 1) / n)], em = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
        const m = at(em, -0.025), c = at([lerp(em[0], mc[0], 0.2), lerp(em[1], mc[1], 0.2)], -0.025);
        M.quad('cabin', at(e0, 0), at(e1, 0), at(e1, -0.05), at(e0, -0.05), [c[0] - m[0], c[1] - m[1], c[2] - m[2]]);
      }
    }
  }
  const PST = ['ok', 'ok', 'crack', 'crack', 'none', 'ok']; // dans l'ordre de PN : côté +z (pare-brise, coulissante, arrière), puis côté -z
  M.color([0.8, 0.87, 0.88]);
  PN.forEach((q, i) => { if (PST[i] === 'none') return; const f = onNose(q, 1, -0.02); M.uvO = [PST[i] === 'crack' ? 0.5 : 0, 0]; M.surf('glassAir', 4, 4, f, { uL: 0.5, vL: 1, flipN: inward(f) }); });
  M.uvO = [0, 0];
  // essuie-glaces au repos, sondes sous les vitres latérales
  M.cls = 2;
  for (const s of [-1, 1]) {
    M.color([0.12, 0.12, 0.13]); M.tube('rubber', 0.014, [NP(1.6, Math.PI / 2 - s * 0.62, 0.035), NP(1.52, Math.PI / 2 - s * 0.36, 0.035), NP(1.5, Math.PI / 2 - s * 0.14, 0.035)], 4);
    M.color([0.55, 0.56, 0.58]);
    for (const [d, y] of [[2.3, -0.2], [2.65, -0.45]]) { const th = Math.PI / 2 - s * Wp(d, y)[1]; M.tube('steel', 0.016, [NP(d, th, -0.02), NP(d - 0.16, th, 0.07)], 4); }
  }
  M.restore();
  // le poste de pilotage, vu par les vitres : plancher, casquette noire au-dessus de la planche de bord et ses écrans éteints, pupitre central,
  // deux sièges, panneau du plafond, cloison et porte du fond
  const xd = (d) => XF1 + NL - d, wz = (d, y) => { const c = sec(d), t = (y - c.yc) / (c.ry - 0.06); return Math.abs(t) >= 1 ? 0 : (c.rz - 0.06) * Math.sqrt(1 - t * t); };
  const strip = (d0, d1, y, n) => { for (let i = 0; i < n; i++) { const a = lerp(d0, d1, i / n), b = lerp(d0, d1, (i + 1) / n), wa = wz(a, y), wb = wz(b, y); if (wa + wb > 0.02) M.quad('cabin', [xd(a), y, Z(-wa)], [xd(b), y, Z(-wb)], [xd(b), y, Z(wb)], [xd(a), y, Z(wa)], [0, 1, 0]); } };
  const yg = cy + 0.5, xp = xd(1.98);
  M.save().local(1); M.cls = 1;
  M.color([0.2, 0.21, 0.22]); strip(1.9, NL + 0.12, yf, 8);
  M.color([0.07, 0.075, 0.08]); strip(0.95, 2.05, yg, 6);
  { const w = wz(2.05, yg); M.quad('cabin', [xd(2.05), yg - 0.12, Z(-w)], [xd(2.05), yg - 0.12, Z(w)], [xd(2.05), yg, Z(w)], [xd(2.05), yg, Z(-w)], [-1, 0, 0]); }
  M.color([0.15, 0.16, 0.18]);
  for (let i = 0; i < 4; i++) { const y0 = lerp(yf, yg - 0.12, i / 4), y1 = lerp(yf, yg - 0.12, (i + 1) / 4), w0 = wz(1.98, y0), w1 = wz(1.98, y1); M.quad('cabin', [xp, y0, Z(-w0)], [xp, y0, Z(w0)], [xp, y1, Z(w1)], [xp, y1, Z(-w1)], [-1, 0, 0]); }
  M.cls = 2; M.color([0.035, 0.04, 0.045]);
  for (const [z, y] of [[-0.8, 0.15], [-0.52, 0.15], [0, 0.18], [0, -0.06], [0.52, 0.15], [0.8, 0.15]]) M.quad('glass', [xp - 0.006, cy + y - 0.09, Z(z - 0.1)], [xp - 0.006, cy + y - 0.09, Z(z + 0.1)], [xp - 0.006, cy + y + 0.09, Z(z + 0.1)], [xp - 0.006, cy + y + 0.09, Z(z - 0.1)], [-1, 0, 0]);
  M.color([0.2, 0.21, 0.23]); M.boxB('cabin', xd(2.95), xp, yf, cy - 0.22, Z(-0.2), Z(0.2));
  M.color([0.55, 0.56, 0.58]); for (const z of [-0.06, 0.06]) M.boxB('cabin', xd(2.2) - 0.03, xd(2.2) + 0.03, cy - 0.22, cy - 0.06, Z(z) - 0.015, Z(z) + 0.015);
  M.cls = 1; M.color([0.22, 0.24, 0.27]);
  const ov = (u, v, dr) => NP(lerp(2.45, 3.3, u), Math.PI / 2 + lerp(-0.32, 0.32, v), dr);
  { const f = (u, v) => ov(u, v, -0.075); M.surf('cabin', 3, 3, f, { uL: 1, vL: 1, flipN: !inward(f) }); }
  M.cls = 2; M.color([0.75, 0.76, 0.78]);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) { const f = (a, b) => ov(0.12 + i * 0.22 + a * 0.06, 0.08 + k * 0.135 + b * 0.05, -0.08); M.surf('cabin', 1, 1, f, { uL: 1, vL: 1, flipN: !inward(f) }); }
  M.cls = 1; M.color([0.36, 0.38, 0.41]);
  M.surf('cabin', 1, 24, (u, v) => P(XF1 - 0.1, u * Ri, v * TAU), { uL: Ri, vL: TAU * Ri, flipN: true, pole: () => [1, 0, 0] });
  M.color([0.28, 0.3, 0.33]); M.quad('cabin', [XF1 - 0.094, yf, Z(-0.42)], [XF1 - 0.094, yf, Z(0.42)], [XF1 - 0.094, yf + 1.92, Z(0.42)], [XF1 - 0.094, yf + 1.92, Z(-0.42)], [1, 0, 0]);
  M.restore();
  for (const s of [1, -1]) M.place(PF.smPilotSeat(), xd(2.8), yf, Z(s * 0.56), 0, { cls: 2 });
  // collisions du nez : par tranches, un noyau et des gradins qui suivent la section (depuis le toit, on descend sur le nez)
  const ncut = [0.3, 0.7, 1.1, 1.6, 2.2, 2.9, 3.7, 4.5, NL];
  for (let i = 0; i < ncut.length - 1; i++) {
    const d0 = ncut[i], d1 = ncut[i + 1], s = sec(d0 + (d1 - d0) * 0.35), x0 = XF1 + NL - d1, x1 = XF1 + NL - d0;
    for (const [f0, f1, fh] of [[0, 0.35, 0.2], [0.35, 0.6, 0.48], [0.6, 0.8, 0.7], [0.8, 0.97, 0.9]]) {
      const h = s.yc + s.ry * Math.sqrt(1 - fh * fh);
      if (!f0) DECOR.col(x0, x1, y0 - 0.5, h, Z(-f1 * s.rz), Z(f1 * s.rz), 'metal');
      else for (const sg of [-1, 1]) DECOR.col(x0, x1, y0 - 0.5, h, Math.min(Z(sg * f0 * s.rz), Z(sg * f1 * s.rz)), Math.max(Z(sg * f0 * s.rz), Z(sg * f1 * s.rz)), 'metal');
    }
  }
  // queue : le cône relevé, la dérive bleue à bandes, les empennages, l'échappement de l'APU
  const TL = 7.5, ts = (t) => { const r = lerp(Rf, 0.32, Math.pow(t, 1.15)); return { x: XR0 - TL * t, y: cy + (Rf - r) * 0.86, r }; };
  M.save().local(1); M.cls = 0; M.color([1, 1, 1]);
  M.surf('hull', 10, 24, (u, v) => { const s = ts(u), th = v * TAU - Math.PI / 2, p = [s.x, s.y + s.r * Math.sin(th), Z(s.r * Math.cos(th))]; M.tint = liv(p[0], p[1] - 0.35 * u); return p; }, { uL: TL, vL: TAU * 1.2, flipN: true });
  M.tint = null; M.color([0.1, 0.1, 0.11]); const te = ts(1); M.save().move(te.x + 0.05, te.y, Z(0)).rotZ(Math.PI / 2); M.cyl('dark', 0.2, 0.3, 10, { r1: 0.24 }); M.restore();
  const fa = ts(0.12), fb = ts(0.86), fy = (s) => s.y + s.r - 0.12, F = [[fa.x - 0.6, fy(fa)], [fb.x + 0.2, fy(fb)], [fb.x - 1.6, fy(fb) + 5.6], [fa.x - 4.2, fy(fa) + 5.6]];
  const fin = (k, d) => [F[k][0], F[k][1], Z(d)], fth = (k) => (k < 2 ? 0.16 : 0.07);
  M.color(blue);
  for (const s of [-1, 1]) M.quad('hull', fin(0, s * fth(0)), fin(1, s * fth(1)), fin(2, s * fth(2)), fin(3, s * fth(3)), [0, 0, s]);
  M.quad('hull', fin(0, -fth(0)), fin(0, fth(0)), fin(3, fth(3)), fin(3, -fth(3)), [0.94, 0.35, 0]); M.quad('hull', fin(3, -fth(3)), fin(3, fth(3)), fin(2, fth(2)), fin(2, -fth(2)), [0, 1, 0]);
  M.quad('hull', fin(2, -fth(2)), fin(2, fth(2)), fin(1, fth(1)), fin(1, -fth(1)), [-0.96, -0.27, 0]);
  // bandes claires en arcs sur les deux faces de la dérive
  const fpt = (u, w) => { const yA = lerp(F[0][1], F[3][1], w), xLE = lerp(F[0][0], F[3][0], w), xTE = lerp(F[1][0], F[2][0], w); return [lerp(xLE, xTE, u), yA]; };
  for (const [w0, w1, col] of [[0.28, 0.36, [0.36, 0.55, 0.86]], [0.42, 0.5, [0.64, 0.78, 0.95]], [0.56, 0.62, [0.92, 0.94, 0.97]], [0.68, 0.75, [0.36, 0.55, 0.86]]]) {
    M.color(col);
    for (let i = 0; i < 6; i++) {
      const u0 = i / 6, u1 = (i + 1) / 6, sag = (u) => -0.12 * Math.sin(u * Math.PI) - 0.1 * u, p00 = fpt(u0, w0 + sag(u0)), p10 = fpt(u1, w0 + sag(u1)), p11 = fpt(u1, w1 + sag(u1)), p01 = fpt(u0, w1 + sag(u0));
      for (const s of [-1, 1]) { const d = (p) => s * (lerp(fth(0), fth(3), (p[1] - F[0][1]) / 5.6) + 0.006); M.quad('hull', [p00[0], p00[1], Z(d(p00))], [p10[0], p10[1], Z(d(p10))], [p11[0], p11[1], Z(d(p11))], [p01[0], p01[1], Z(d(p01))], [0, 0, s]); }
    }
  }
  M.color(white);
  const hs = ts(0.62);
  for (const s of [-1, 1]) {
    const r0 = [hs.x + 1.4, hs.y + 0.1, Z(s * 0.45)], r1 = [hs.x - 1.1, hs.y + 0.1, Z(s * 0.45)], t1 = [hs.x - 2.6, hs.y + 0.5, Z(s * 6.0)], t0 = [hs.x - 1.5, hs.y + 0.5, Z(s * 6.0)];
    M.quad('hull', r0, r1, t1, t0, [0, 1, 0]); M.quad('hull', [r0[0], r0[1] - 0.14, r0[2]], [t0[0], t0[1] - 0.06, t0[2]], [t1[0], t1[1] - 0.06, t1[2]], [r1[0], r1[1] - 0.14, r1[2]], [0, -1, 0]);
    M.quad('hull', [r0[0], r0[1] - 0.14, r0[2]], r0, t0, [t0[0], t0[1] - 0.06, t0[2]], [0.9, 0, -0.4 * s]);
    for (let k = 0; k < 3; k++) { const f0 = k / 3, f1 = (k + 1) / 3, la = lerp(r0[0], t0[0], f1), tb = lerp(r1[0], t1[0], f0); DECOR.col(tb, la, r0[1] - 0.14, t0[1], Math.min(Z(s * lerp(0.45, 6, f0)), Z(s * lerp(0.45, 6, f1))), Math.max(Z(s * lerp(0.45, 6, f0)), Z(s * lerp(0.45, 6, f1))), 'metal'); }
  }
  M.restore();
  DECOR.col(F[2][0], F[0][0], fy(fb), fy(fa) + 5.6, Z(-0.18), Z(0.18), 'metal');
  for (let t = 0; t < 1; t += 0.25) { const a = ts(t), b = ts(t + 0.25), r = Math.min(a.r, b.r) * 0.8; DECOR.col(b.x, a.x, Math.min(a.y, b.y) - r, Math.max(a.y, b.y) + r, Z(-r), Z(r), 'metal'); }
  // ailes basses en flèche : extrados praticable, intrados, bords, volets soulignés, winglets bleus ; carénages de rails sous le bord de fuite.
  // Posées sur le ventre, elles s'enfoncent vers le bout dans le sable (de 37 à 13 cm au-dessus du sol) : on les franchit en marchant sur toute
  // leur longueur (avec le dièdre d'un avion au sol, le bout montait à 1,3 m et l'aile coupait la sebkha en deux : traversee.js)
  const W0 = 1.85, W1 = 15.3, LE = (d) => cx - 1.0 - (d - W0) * (7.3 / (W1 - W0)), TE = (d) => cx - 7.4 - (d - W0) * (2.5 / (W1 - W0)), WY = (d) => yf + 0.12 - (d - W0) * 0.018, WT = (d) => lerp(0.62, 0.16, (d - W0) / (W1 - W0));
  M.save().local(1); M.cls = 0;
  for (const s of [-1, 1]) {
    const pt = (x, y, d) => [x, y, Z(s * d)], n = (v) => [v[0], v[1], v[2] * s];
    M.color([0.86, 0.87, 0.88]);
    M.quad('hull', pt(LE(W0), WY(W0), W0), pt(TE(W0), WY(W0), W0), pt(TE(W1), WY(W1), W1), pt(LE(W1), WY(W1), W1), [0, 1, 0]);
    M.quad('hull', pt(LE(W0), WY(W0) - WT(W0), W0), pt(TE(W0), WY(W0) - WT(W0), W0), pt(TE(W1), WY(W1) - WT(W1), W1), pt(LE(W1), WY(W1) - WT(W1), W1), [0, -1, 0]);
    M.quad('hull', pt(LE(W0), WY(W0), W0), pt(LE(W0) + 0.18, WY(W0) - WT(W0) * 0.5, W0), pt(LE(W1) + 0.06, WY(W1) - WT(W1) * 0.5, W1), pt(LE(W1), WY(W1), W1), n([0.8, 0.5, 0.3]));
    M.quad('hull', pt(LE(W0) + 0.18, WY(W0) - WT(W0) * 0.5, W0), pt(LE(W0), WY(W0) - WT(W0), W0), pt(LE(W1), WY(W1) - WT(W1), W1), pt(LE(W1) + 0.06, WY(W1) - WT(W1) * 0.5, W1), n([0.8, -0.5, 0.3]));
    M.quad('hull', pt(TE(W0), WY(W0), W0), pt(TE(W0), WY(W0) - WT(W0), W0), pt(TE(W1), WY(W1) - WT(W1), W1), pt(TE(W1), WY(W1), W1), n([-0.95, 0, -0.3]));
    M.quad('hull', pt(LE(W1), WY(W1), W1), pt(TE(W1), WY(W1), W1), pt(TE(W1), WY(W1) - WT(W1), W1), pt(LE(W1), WY(W1) - WT(W1), W1), n([0, 0, 1]));
    M.color([0.62, 0.64, 0.66]);
    for (const f of [0.72, 0.9]) { const xa = (d) => lerp(LE(d), TE(d), f); M.quad('hull', pt(xa(W0 + 0.3) + 0.02, WY(W0 + 0.3) + 0.006, W0 + 0.3), pt(xa(W0 + 0.3) - 0.02, WY(W0 + 0.3) + 0.006, W0 + 0.3), pt(xa(W1 - 0.4) - 0.02, WY(W1 - 0.4) + 0.006, W1 - 0.4), pt(xa(W1 - 0.4) + 0.02, WY(W1 - 0.4) + 0.006, W1 - 0.4), [0, 1, 0]); }
    M.color([0.84, 0.85, 0.86]);
    for (const d of [5.0, 8.4, 11.6]) { const yb = WY(d) - WT(d); M.boxB('hull', TE(d) - 0.9, TE(d) + 1.4, yb - 0.32, yb + 0.02, Z(s * d) - 0.14, Z(s * d) + 0.14, { bevel: 0.08 }); }
    M.color([0.8, 0.81, 0.82]); M.boxB('hull', LE(5.7) - 2.4, LE(5.7) - 0.4, WY(5.7) - WT(5.7) - 0.45, WY(5.7) - WT(5.7) + 0.02, Z(s * 5.7) - 0.18, Z(s * 5.7) + 0.18); // mât du réacteur, arraché
    // winglet
    M.color(blue);
    const wa = [LE(W1), WY(W1), W1], wb = [TE(W1), WY(W1), W1], wc = [TE(W1) - 0.5, WY(W1) + 1.6, W1 + 0.3], wd = [TE(W1) + 0.2, WY(W1) + 1.6, W1 + 0.3];
    for (const k of [-1, 1]) M.quad('hull', pt(wa[0], wa[1], wa[2] + k * 0.04), pt(wb[0], wb[1], wb[2] + k * 0.04), pt(wc[0], wc[1], wc[2] + k * 0.02), pt(wd[0], wd[1], wd[2] + k * 0.02), n([0, 0, k]));
    for (let d = W0; d < W1 - 0.01; d += 1) { const d1 = Math.min(W1, d + 1), y = WY((d + d1) / 2); DECOR.col(Math.max(TE(d), TE(d1)), Math.min(LE(d), LE(d1)), y - WT(d), y, Math.min(Z(s * d), Z(s * d1)), Math.max(Z(s * d), Z(s * d1)), 'metal'); }
  }
  M.restore();
  // les réacteurs, arrachés, couchés dans le sable devant les ailes
  smPlace(PF.smJetEngine(), cx + 3.6, Z(7.6), 0.42); smPlace(PF.smJetEngine(), cx + 3.0, Z(-7.6), -0.42);
  return { top };
}
/* Bloc de trois sièges de cabine (repère : le plancher, le milieu du bloc ; on regarde vers +x) : assise et dossier bleu marine, têtière à housse
   rayée gris et blanc au dos, accoudoirs gris-vert, piètement d'acier ; une collision pour le bloc */
PF.smSeats3 = () => prefab('smSeats3', (M) => {
  const navy = [0.1, 0.13, 0.22], light = [0.88, 0.87, 0.84], stripe = [0.52, 0.5, 0.46];
  M.local(1);
  for (let k = 0; k < 3; k++) {
    const z = -0.4 + k * 0.4;
    M.color(navy); M.boxB('cabin', -0.22, 0.24, 0.36, 0.5, z - 0.18, z + 0.18, { bevel: 0.03 });
    M.save().move(-0.2, 0.46, z).rotZ(0.16);
    M.color(navy); M.boxB('cabin', -0.06, 0.05, 0, 0.74, -0.18, 0.18, { bevel: 0.025 });
    for (let i = 0; i < 5; i++) { M.color(i % 2 ? light : stripe); const za = -0.17 + (i / 5) * 0.34, zb = -0.17 + ((i + 1) / 5) * 0.34; M.quad('canvas', [-0.066, 0.5, za], [-0.066, 0.5, zb], [-0.066, 0.72, zb], [-0.066, 0.72, za], [-1, 0, 0]); }
    M.color(light); M.quad('canvas', [0.056, 0.5, -0.17], [0.056, 0.5, 0.17], [0.056, 0.72, 0.17], [0.056, 0.72, -0.17], [1, 0, 0]);
    M.restore();
  }
  M.color([0.3, 0.31, 0.27]);
  for (const z of [-0.6, -0.2, 0.2, 0.6]) M.boxB('cabin', -0.16, 0.2, 0.58, 0.64, z - 0.025, z + 0.025, { bevel: 0.01 });
  M.color([0.55, 0.56, 0.58]);
  for (const z of [-0.42, 0.42]) { M.boxB('steel', -0.14, -0.1, 0, 0.36, z - 0.02, z + 0.02); M.boxB('steel', 0.14, 0.18, 0, 0.36, z - 0.02, z + 0.02); }
  M.boxB('steel', -0.16, 0.2, 0.3, 0.34, -0.55, 0.55);
  M.col(-0.3, 0.28, 0, 1.0, -0.6, 0.6, 'wood');
});
/* Siège de pilote (vers +x) : socle, assise et dossier anthracite, housse en peau de mouton claire, appui-tête, accoudoirs */
PF.smPilotSeat = () => prefab('smPilotSeat', (M) => {
  const dark = [0.13, 0.13, 0.14];
  M.local(1);
  M.color([0.3, 0.31, 0.33]); M.boxB('steel', -0.2, 0.2, 0, 0.34, -0.16, 0.16);
  M.color(dark); M.boxB('cabin', -0.26, 0.26, 0.34, 0.47, -0.25, 0.25, { bevel: 0.03 });
  M.save().move(-0.24, 0.45, 0).rotZ(0.12);
  M.color(dark); M.boxB('cabin', -0.07, 0.04, 0, 0.82, -0.25, 0.25, { bevel: 0.03 }); M.boxB('cabin', -0.04, 0.06, 0.84, 1.0, -0.15, 0.15, { bevel: 0.03 });
  M.color([0.74, 0.68, 0.58]); M.boxB('canvas', 0.04, 0.07, 0.06, 0.66, -0.21, 0.21, { bevel: 0.02 });
  M.restore();
  M.color(dark); for (const z of [-0.29, 0.29]) M.boxB('cabin', -0.18, 0.16, 0.6, 0.66, z - 0.03, z + 0.03, { bevel: 0.01 });
});
/* Réacteur à double flux arraché de son mât (repère : le sable sous lui, l'entrée d'air vers +x) : nacelle grise, soufflante et cône, tuyère et
   cône d'éjection, le mât déchiré au-dessus ; enfoncé de 12 cm ; une collision */
PF.smJetEngine = () => prefab('smJetEngine', (M) => {
  M.local(1); const ay = 0.92;
  M.save().move(-1.8, ay, 0).rotZ(-Math.PI / 2);
  M.color([0.8, 0.81, 0.82]); M.lathe('hull', [[0.62, 0], [0.8, 0.45], [0.98, 1.4], [1.04, 2.6], [1.02, 3.3], [0.94, 3.6], [0.86, 3.52], [0.84, 3.3]], 20);
  M.color([0.08, 0.08, 0.09]); M.save().move(0, 3.24, 0); M.cyl('dark', 0.85, 0.02, 20); M.restore();
  M.color([0.62, 0.63, 0.65]); M.save().move(0, 3.26, 0); M.cyl('steel', 0.3, 0.32, 14, { r1: 0.02 }); M.restore();
  M.color([0.3, 0.31, 0.33]);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; M.save().move(0, 3.27, 0).rotY(a); M.quad('steel', [0.3, 0, -0.06], [0.84, 0, -0.1], [0.84, 0.03, 0.1], [0.3, 0.03, 0.06], [0, 1, 0]); M.restore(); }
  M.color([0.5, 0.5, 0.52]); M.lathe('steel', [[0, -1.05], [0.22, -0.9], [0.44, -0.35], [0.5, 0]], 14);
  M.color([0.12, 0.12, 0.12]); M.lathe('dark', [[0.5, 0.02], [0.6, 0.02]], 16);
  M.restore();
  M.color([0.78, 0.79, 0.8]); M.boxB('hull', -1.2, 1.0, ay + 0.9, ay + 1.3, -0.17, 0.17);
  M.color([0.4, 0.4, 0.42]); M.boxB('steel', 0.6, 1.0, ay + 1.28, ay + 1.36, -0.12, 0.12);
  M.col(-2.6, 1.8, 0, ay + 1.0, -0.95, 0.95, 'metal');
});

/* ---------- La vie du désert : tourbillons de poussière, vautours ---------- */
/* Texture des tourbillons (128 x 256, alpha) : traînées de poussière qui montent en spirale, plus denses en bas, effilochées en haut */
function smDevilTex() {
  const t = canvasTex(256, (g, S) => {
    const R = rngOf(818); g.clearRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = R() * S, y = R() * S, h = 8 + R() * 60, w = 2 + R() * 6, a = 0.04 + 0.1 * Math.pow(y / S, 1.5);
      const gr = g.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, 'rgba(255,240,220,0)'); gr.addColorStop(0.5, `rgba(255,240,220,${a})`); gr.addColorStop(1, 'rgba(255,240,220,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.rotate(-0.35); g.fillRect(-w / 2, -h, w, h); g.restore();
      if (x < 12) { g.save(); g.translate(x + S, y); g.rotate(-0.35); g.fillStyle = gr; g.fillRect(-w / 2, -h, w, h); g.restore(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
/* Tourbillon de poussière : deux cônes ouverts emboîtés qui tournent et errent lentement sur un circuit (cx, cz, rx, rz, période) ;
   sans collision, sans ombre, transparents (on voit au travers) ; animés par smLife */
function smDustDevil(o, tex) {
  const g = new THREE.Group(), mats = [];
  for (const [r0, r1, h, op] of [[0.9, 3.2, 14, 0.34], [0.5, 1.8, 9, 0.26]]) {
    const geo = new THREE.CylinderGeometry(r1, r0, h, 20, 6, true); geo.translate(0, h / 2, 0);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(sl(0.92), sl(0.76), sl(0.58)), transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const mesh = new THREE.Mesh(geo, m); mesh.userData.noAO = true; mesh.userData.noPrepass = true; mesh.castShadow = false; mesh.renderOrder = 4;
    g.add(mesh); mats.push(m);
  }
  mapAdd(g);
  return { k: 'devil', g, mats, o, ph: o.ph || 0 };
}
/* Voiles de sable : le vent arrache du sable aux crêtes des dunes et le traîne au ras du sol. Minces nappes verticales de 0,7 m couchées dans le sens du
   vent, drapées sur le relief, transparentes, sans collision ni ombre ; une seule matière dont la texture de traînées défile (smLife). Sur les crêtes
   seulement (plus hautes que le sable à 4 m en amont), hors des camps et des bases */
function smVeilTex() {
  const t = canvasTex(256, (g, S) => {
    const R = rngOf(919); g.clearRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      const y = S * (1 - Math.pow(R(), 1.8)), x = R() * S, w = 20 + R() * 90, h = 1 + R() * 3, a = 0.05 + 0.16 * Math.pow(y / S, 2);
      const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,236,210,0)'); gr.addColorStop(0.5, `rgba(255,236,210,${a})`); gr.addColorStop(1, 'rgba(255,236,210,0)');
      g.fillStyle = gr; g.fillRect(x, y - h, w, h); if (x + w > S) g.fillRect(x - S, y - h, w, h);
    }
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function smSandVeils(R, tex) {
  const D = WIND_U.uWnD.value, dx = D.x, dz = D.y, tile = 6, pos = [], uv = [], idx = [];
  for (let i = 0, n = 0; i < 600 && n < 26; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * (SM_R + 24), cx = Math.cos(a) * r, cz = Math.sin(a) * r, h = smH(cx, cz);
    if (h < smH(cx - dx * 4, cz - dz * 4) + 0.35 || SM_PADS.some((p) => hyp((cx - p[0]) / (p[2] + 4), (Math.abs(cz) - p[1]) / (p[3] + 4)) < 1) || smPondQ(cx, cz) < 1.6) continue;
    const L = R.range(9, 18), off = R.range(-0.6, 0.6), base = pos.length / 3;
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, x = cx + dx * (u * L - 1.5) - dz * off * u, z = cz + dz * (u * L - 1.5) + dx * off * u, y = smY(x, z) - 0.05;
      pos.push(x, y, z, x, y + 0.75, z); uv.push((u * L) / tile, 0, (u * L) / tile, 1);
      if (k) { const b = base + (k - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    n++;
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(sl(0.95), sl(0.82), sl(0.66)), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(g, m); mesh.userData.noAO = true; mesh.userData.noPrepass = true; mesh.castShadow = false; mesh.renderOrder = 4; mesh.frustumCulled = false;
  mapAdd(mesh);
  return { k: 'veil', g: mesh, mats: [m], o: {}, tile };
}
/* Vautour : silhouette sombre aux ailes en planche (doigts écartés au bout), qui tourne en spirale au-dessus des dunes */
function smVulture(o) {
  const shape = new THREE.Shape(); shape.moveTo(0, 0.5); shape.lineTo(1.1, 0.2); shape.lineTo(1.6, 0.25); shape.lineTo(1.75, 0.05); shape.lineTo(1.2, -0.1); shape.lineTo(0.25, -0.3); shape.lineTo(0, -0.7);
  shape.lineTo(-0.25, -0.3); shape.lineTo(-1.2, -0.1); shape.lineTo(-1.75, 0.05); shape.lineTo(-1.6, 0.25); shape.lineTo(-1.1, 0.2); shape.lineTo(0, 0.5);
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: 0x1c1612, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = false; mesh.userData.noAO = true; mapAdd(mesh);
  return { k: 'bird', g: mesh, mats: [m], o };
}
/* Animation : le tourbillon tourne, erre sur son circuit, s'efface et renaît (il vit 70 % du temps) ; les vautours tournent */
function smLife(list, t) {
  for (const A of list) {
    const o = A.o;
    if (A.k === 'devil') {
      const u = (t / o.T + A.ph) % 1, life = smoothstep(0, 0.12, u) * (1 - smoothstep(0.58, 0.7, u)), w = (t / o.T + A.ph) * TAU;
      A.g.visible = life > 0.01;
      if (!A.g.visible) continue;
      const px = o.cx + Math.sin(w * 1.3) * o.rx, pz = o.cz + Math.sin(w * 0.7 + 1.1) * o.rz;
      A.g.position.set(px, gy0(px, pz) - 0.3, pz); // sur le sable
      A.g.children.forEach((c, i) => { c.rotation.y = t * (i ? 2.6 : 1.7); c.scale.set(0.6 + 0.4 * life, 0.5 + 0.5 * life, 0.6 + 0.4 * life); c.rotation.z = Math.sin(t * 0.7 + i) * 0.06; });
      A.mats[0].map.offset.y = -t * 0.25; A.mats.forEach((m, i) => { m.opacity = (i ? 0.26 : 0.34) * life; });
    } else if (A.k === 'veil') {
      // le sable file dans le sens du vent (3 m/s), par rafales
      A.mats[0].map.offset.x = -((t * 3) / A.tile) % 1; A.mats[0].opacity = Math.min(1, 0.42 * (0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1.3)) * (1 + 1.4 * Math.max(0, SMS.s))); // plus denses dans la tempête (smStorm)
    } else {
      const a = t * o.w + o.a0;
      A.g.position.set(o.cx + Math.cos(a) * o.r, o.y + Math.sin(t * 0.13 + o.a0) * 3, o.cz + Math.sin(a) * o.r);
      A.g.rotation.set(0, (o.w > 0 ? Math.PI : 0) - a, (o.w > 0 ? 1 : -1) * 0.32);
    }
  }
}
