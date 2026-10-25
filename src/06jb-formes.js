/* ==========================================================================
   FORMES DES ARMES : profils extrudés, sections, pontets, cônes, organes de visée métalliques
   Les gros volumes d'une arme (crosse, boîtier, garde-main, poignée, chargeur) sont des profils vus de côté, extrudés sur
   la largeur de la pièce, aux arêtes adoucies : une silhouette d'un seul tenant plutôt que des boîtes posées côte à côte.
   Un profil est une suite de points [z, y] dans le repère de l'arme (le canon pointe vers -z) ; un troisième nombre
   fixe le rayon d'arrondi de ce coin (0 : coin vif), sinon c'est le rayon par défaut du profil. Les pièces d'une arme
   doivent toutes se toucher : tools/dev/visual/flottants.js le vérifie (README, « Armes, accessoires et progression »).
   ========================================================================== */
const PROF_GEO = new Map();
/* Trace le contour pts sur un chemin (forme ou trou), coins arrondis par des courbes de Bézier quadratiques */
function profTrace(s, pts, rc) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[(i + n - 1) % n], V = pts[i], N = pts[(i + 1) % n], r0 = V.length > 2 ? V[2] : rc;
    const a = hyp(P[0] - V[0], P[1] - V[1]) || 1e-9, b = hyp(N[0] - V[0], N[1] - V[1]) || 1e-9, r = Math.min(r0, a * 0.5, b * 0.5);
    if (r < 1e-5) { if (i) s.lineTo(V[0], V[1]); else s.moveTo(V[0], V[1]); continue; }
    const sx = V[0] + (P[0] - V[0]) * r / a, sy = V[1] + (P[1] - V[1]) * r / a;
    if (i) s.lineTo(sx, sy); else s.moveTo(sx, sy);
    s.quadraticCurveTo(V[0], V[1], V[0] + (N[0] - V[0]) * r / b, V[1] + (N[1] - V[1]) * r / b);
  }
  s.closePath();
}
/* Géométrie d'un profil extrudé sur la largeur w (centrée en x = 0), arêtes arrondies de rayon r ; holes : contours évidés */
function profGeo(pts, w, r, rc, holes) {
  const k = JSON.stringify([pts, w, r, rc, holes]);
  let geo = PROF_GEO.get(k); if (geo) return geo;
  const sh = new THREE.Shape(); profTrace(sh, pts, rc);
  if (holes) for (const h of holes) { const hp = new THREE.Path(); profTrace(hp, h, rc); sh.holes.push(hp); }
  r = Math.min(r, w * 0.45);
  const depth = Math.max(w - 2 * r, 0.0006);
  geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: r > 0.0003, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: 2, curveSegments: 4, steps: 1 });
  geo.translate(0, 0, -depth / 2); geo.rotateY(-Math.PI / 2); // forme (x, y) du profil → (z, y) de l'arme, épaisseur selon x
  // coordonnées de texture : plaquage plan selon la face dominante, une répétition tous les ~11 cm (comme les boîtes arrondies)
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
    if (nx >= ny && nx >= nz) U.setXY(i, P.getZ(i) * 9, P.getY(i) * 9); else if (ny >= nz) U.setXY(i, P.getX(i) * 9, P.getZ(i) * 9); else U.setXY(i, P.getX(i) * 9, P.getY(i) * 9);
  }
  geo.userData.low = { pts, w, rc, holes };
  PROF_GEO.set(k, geo); return geo;
}
/* Version allégée d'un profil (armes vues de loin, ombres) : même contour, sans arêtes adoucies, coins en biseau simple */
function profLow(geo) {
  const L = geo.userData.low, k = 'low' + JSON.stringify(L);
  let g = PROF_GEO.get(k); if (g) return g;
  const sh = new THREE.Shape(); profTrace(sh, L.pts, Math.min(L.rc, 0.004));
  if (L.holes) for (const h of L.holes) { const hp = new THREE.Path(); profTrace(hp, h, 0); sh.holes.push(hp); }
  g = new THREE.ExtrudeGeometry(sh, { depth: L.w, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -L.w / 2); g.rotateY(-Math.PI / 2);
  PROF_GEO.set(k, g); return g;
}
/* Pièce en profil : pts [[z, y], ...], largeur w, centre x, arrondi des arêtes r, arrondi des coins du profil rc */
function prof(p, mat, pts, w, x = 0, r = 0.003, rc = 0.004, holes = null) { return part(p, profGeo(pts, w, r, rc, holes), mat, x, 0, 0, 1, 1, 1); }

/* Haut d'un contour de profil, au-dessus de y : le contour est tracé et arrondi comme le fait profTrace, puis coupé. Pour une pièce qui épouse
   le haut d'une autre (pont d'un capot entre ses deux flancs) */
function profAbove(pts, rc, y) {
  const sh = new THREE.Shape(); profTrace(sh, pts, rc);
  const P = sh.getPoints(6).filter((q, i, a) => !i || q.distanceTo(a[i - 1]) > 1e-6), out = [];
  if (P.length > 1 && P[0].distanceTo(P[P.length - 1]) < 1e-6) P.pop();
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length];
    if (A.y >= y) out.push([A.x, A.y, 0]);
    if (A.y >= y !== B.y >= y) out.push([A.x + (B.x - A.x) * (y - A.y) / (B.y - A.y), y, 0]);
  }
  return out;
}

/* Pontet : anneau en D sous le boîtier, de zF (avant) à zR (arrière), du dessus yTop (noyé dans le boîtier) au dessous yBot,
   épais de th ; la détente passe dans le vide. Le dessus du vide est yTop - hTop (le dessous du boîtier). */
function guard(p, mat, zF, zR, yTop, yBot, th, hTop = 0.006, w = 0.006) {
  const rr = Math.min(0.014, Math.abs(yTop - yBot) * 0.45), ri = Math.max(0.001, rr - th);
  const outer = [[zF, yTop, 0], [zF, yBot, rr], [zR, yBot, rr], [zR, yTop, 0]];
  const hole = [[zF + th, yTop - hTop, 0.001], [zF + th, yBot + th, ri], [zR - th, yBot + th, ri], [zR - th, yTop - hTop, 0.001]];
  return prof(p, mat, outer, w, 0, Math.min(0.0015, w * 0.3), 0.002, [hole]);
}

/* Cône ou tube orienté selon z : rFront (côté -z, vers la bouche) et rRear (côté +z, vers l'épaule), longueur len */
const CONE_GEO = new Map();
function cone(p, mat, x, y, z, rFront, rRear, len, seg = 20, open = false) {
  const k = rRear + '|' + rFront + '|' + seg + '|' + open;
  let geo = CONE_GEO.get(k); if (!geo) { geo = new THREE.CylinderGeometry(rRear, rFront, 1, seg, 1, open); CONE_GEO.set(k, geo); }
  return part(p, geo, mat, x, y, z, 1, len, 1, Math.PI / 2, 0, 0); // le haut du cylindre (rRear) regarde vers +z
}

/* Pièce de section constante le long du canon : contour pts [[x, y], ...] (vu de face, un troisième nombre arrondit ce coin), de z0 (avant)
   à z1, arêtes adoucies r ; o.holes : contours évidés (fenêtre d'une optique), o.rc : arrondi des coins par défaut, o.seg : points par coin
   arrondi, o.bev : segments des arêtes adoucies */
const SEC_GEO = new Map();
function zSection(p, mat, pts, z0, z1, r = 0.001, o = {}) {
  const holes = o.holes || null, rc = o.rc != null ? o.rc : 0.0015, seg = o.seg || 3, bev = o.bev || 1;
  const k = JSON.stringify([pts, z1 - z0, r, holes, rc, seg, bev]);
  let geo = SEC_GEO.get(k);
  if (!geo) {
    const sh = new THREE.Shape(); profTrace(sh, pts, rc);
    if (holes) for (const h of holes) { const hp = new THREE.Path(); profTrace(hp, h, rc); sh.holes.push(hp); }
    const depth = Math.max(z1 - z0 - 2 * r, 0.0005);
    geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: bev, curveSegments: seg, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv; // plaquage plan, comme profGeo
    for (let i = 0; i < P.count; i++) {
      const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
      if (nx >= ny && nx >= nz) U.setXY(i, P.getZ(i) * 9, P.getY(i) * 9); else if (ny >= nz) U.setXY(i, P.getX(i) * 9, P.getZ(i) * 9); else U.setXY(i, P.getX(i) * 9, P.getY(i) * 9);
    }
    geo.userData.sec = { pts, holes, rc, depth: z1 - z0 };
    SEC_GEO.set(k, geo);
  }
  return part(p, geo, mat, 0, 0, (z0 + z1) / 2, 1, 1, 1);
}
/* Version allégée d'une section (armes vues de loin, ombres) : même contour, sans arêtes adoucies, coins en biseau simple */
function secLow(geo) {
  const L = geo.userData.sec, k = 'low' + JSON.stringify(L);
  let g = SEC_GEO.get(k); if (g) return g;
  const sh = new THREE.Shape(); profTrace(sh, L.pts, Math.min(L.rc, 0.004));
  if (L.holes) for (const h of L.holes) { const hp = new THREE.Path(); profTrace(hp, h, Math.min(L.rc, 0.004)); sh.holes.push(hp); }
  g = new THREE.ExtrudeGeometry(sh, { depth: L.depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -L.depth / 2);
  SEC_GEO.set(k, g); return g;
}

/* Anneau d'axe z (bague, bonnette, capot rond d'une optique) : rayons rOut et rIn, de z0 (avant) à z1, centré en (0, y), arêtes arrondies
   de o.rr, o.seg segments ; un tour (LatheGeometry), ombré lisse, plutôt qu'une section extrudée (facettes visibles de près, en visée).
   o.cut : face avant en biais, [ya, za, yb, zb] (deux points de son tracé vu de profil, repère de l'arme) : chaque sommet avance ou recule
   d'autant plus qu'il est près de l'avant, l'arrière reste droit ; les normales de la face prennent celle du plan, les flancs gardent les
   leurs. Version allégée : 12 segments, sans arrondis (lowPolyGeometry) */
const RING_GEO = new Map();
function ringGeo(rOut, rIn, z0, z1, y, rr, seg, cut) {
  const k = JSON.stringify([rOut, rIn, z1 - z0, rr, seg, cut, cut ? [z0, y] : 0]);
  let geo = RING_GEO.get(k); if (geo) return geo;
  const h = (z1 - z0) / 2, pts = [];
  const arc = (cr, cz, a0) => { for (let i = 0; i <= (rr > 0 ? 3 : 0); i++) { const a = a0 + i / 3 * Math.PI / 2; pts.push(new THREE.Vector2(cr + Math.cos(a) * rr, cz + Math.sin(a) * rr)); } };
  arc(rIn + rr, -h + rr, Math.PI); arc(rOut - rr, -h + rr, Math.PI * 1.5); arc(rOut - rr, h - rr, 0); arc(rIn + rr, h - rr, Math.PI / 2); pts.push(pts[0].clone());
  geo = new THREE.LatheGeometry(pts, seg); geo.rotateX(Math.PI / 2); // axe du tour (y) : axe du canon, l'arrière vers +z
  if (cut) {
    const [ya, za, yb, zb] = cut, s = (za - zb) / (ya - yb), zc = (z0 + z1) / 2, L = hyp(1, s), P = geo.attributes.position, N = geo.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const z = P.getZ(i), w = (h - z) / (2 * h);
      P.setZ(i, z + w * (za + (P.getY(i) + y - ya) * s - zc + h));
      const nz = N.getZ(i);
      if (nz < 0) { const v = _v1.set(N.getX(i), N.getY(i) - nz * s / L, nz / L).normalize(); N.setXYZ(i, v.x, v.y, v.z); }
    }
    geo.computeBoundingBox(); geo.computeBoundingSphere();
  }
  geo.userData.ring = [rOut, rIn, z0, z1, y, 0, 12, cut];
  RING_GEO.set(k, geo); return geo;
}
function zRing(p, mat, rOut, rIn, z0, z1, y, o = {}) { return part(p, ringGeo(rOut, rIn, z0, z1, y, o.rr || 0, o.seg || 32, o.cut || null), mat, 0, y, (z0 + z1) / 2, 1, 1, 1); }

/* ---------- Organes de visée métalliques (fusils d'assaut, pistolets-mitrailleurs, fusils à pompe) ----------
   En visée, l'œil est sur la ligne de mire (info.sightY), info.adsZ en arrière de l'origine de l'arme, et la vue subjective a un champ
   vertical de 44° (08-player.js) : une pièce large de w, à la distance d de l'œil, couvre w / (IRON_K d) de la hauteur de l'écran. Les
   traits des organes de visée se dimensionnent donc en fraction de l'écran (IRON), pour qu'une mire soit aussi fine d'une arme à
   l'autre, l'œil à 10 cm de la hausse (MP5, M1014) ou à 19 cm (M4A1). Retour du propriétaire : des cercles trop gras, des traits trop
   gros, il faut que ce soit précis pour viser (le trait des anneaux couvrait de 1,4 à 5,7 % de la hauteur de l'écran ; à 0,55 %, un
   poil trop fin : 0,75 %).
     ring   trait de l'anneau de la hausse (œilleton)          foot   largeur de son montant (pied), sous l'anneau
     hole   ouverture de l'œilleton (diamètre intérieur)       wing   épaisseur des ailes de la hausse
     post   largeur du guidon, sa pointe sur la ligne de mire  ear    largeur des oreilles du guidon
   Plancher : sur téléphone (qualité Basse), l'image 3D a environ 300 pixels de haut, sans anticrénelage ; un trait de 0,45 % y garde
   plus d'un pixel. Contrôle : node tools/dev/visual/armes.js --vues ads. */
const IRON = { ring: 0.0075, foot: 0.035, wing: 0.009, post: 0.0045, ear: 0.0034, hole: { rifle: 0.095, smg: 0.13 } };
const IRON_K = 2 * Math.tan(THREE.MathUtils.degToRad(22));
/* Largeur d'une pièce posée en z (repère de l'arme) qui couvre la fraction f de la hauteur de l'écran en visée */
function ironW(c, z, f) { return f * IRON_K * (c.info.adsZ - z); }
/* Œilleton : anneau d'axe z, de rayon intérieur r, de trait t, profond de dep. Face arrière plate à arête vive côté œil, ouverture
   évasée vers l'avant (en biseau) : sa paroi intérieure tourne le dos à l'œil. Vu en visée, un seul trait net d'une seule teinte (un
   tore prend des reflets sur son arrondi et, l'œil à 10 cm, sa paroi intérieure épaissit le trait). Coins doublés dans le profil :
   arêtes vives, sans normales moyennées. */
const IRON_GEO = new Map();
function ironRingGeo(r, t, dep) {
  const k = [r, t, dep].map((v) => v.toFixed(5)).join('|');
  let geo = IRON_GEO.get(k); if (geo) return geo;
  const h = dep / 2, R = r + t, f = r + Math.min(t * 0.8, dep * 0.3);
  const P = [[R, -h], [R, h], [R, h], [r, h], [r, h], [f, -h], [f, -h], [R, -h]].map((q) => new THREE.Vector2(q[0], q[1]));
  geo = new THREE.LatheGeometry(P, 40); geo.rotateX(Math.PI / 2); // axe du tour (y) : axe du canon, face arrière vers l'œil (+z)
  IRON_GEO.set(k, geo); return geo;
}
/* Pose l'œilleton en z, centré sur la ligne de mire, d'ouverture hole (fraction de l'écran, IRON.hole), en M.sight (sombre, mat et
   lisse, que le camouflage laisse noir). Rend le bas de son trait, où poser son montant ou son embase (ironFoot) */
function ironRing(c, z, hole) {
  const t = ironW(c, z, IRON.ring), r = ironW(c, z, hole) / 2;
  part(c.g, ironRingGeo(r, t, 0.0025), c.M.sight, 0, c.info.sightY, z, 1, 1, 1);
  return c.info.sightY - r - t * 0.4;
}
/* Montant de l'œilleton, en z : de y0 (noyé dans son embase) au bas du trait de l'anneau (y1, rendu par ironRing), large de IRON.foot */
function ironFoot(c, mat, z, y0, y1, dep) { return bx(c.g, mat, 0, (y0 + y1) / 2, z, ironW(c, z, IRON.foot), y1 - y0, dep); }

/* Poignée pistolet inclinée vers l'arrière : de son haut (zT, yT, noyé dans le boîtier) à son bas (zB, yB), profondeur d, largeur w ;
   le dos bombé et le talon élargi donnent la prise */
function gripProf(p, mat, zT, yT, zB, yB, d, w = 0.032, bulge = 0.003) {
  const dz = zB - zT, dy = yB - yT, L = hyp(dz, dy), ux = dz / L, uy = dy / L, nx = -uy, ny = ux, h = d / 2;
  const P = (t, off) => [zT + ux * t * L + nx * off, yT + uy * t * L + ny * off];
  return prof(p, mat, [P(0, -h), P(0, h), P(0.4, h + bulge), P(0.88, h + bulge * 0.4), P(1, h + 0.002, 0.004), P(1, -h - 0.001, 0.004), P(0.7, -h - bulge * 0.2), P(0.3, -h + bulge * 0.4)], w, 0, 0.003, 0.006);
}
