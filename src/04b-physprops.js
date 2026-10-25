/* ==========================================================================
   PROPS PHYSIQUES : simulation (le kit et les types sont dans 02k-dynprops.js).
   Un corps rigide est un centre de masse, une orientation, deux vitesses et des points de contact (coins d'une boîte,
   pourtour d'un cylindre, centre d'une sphère avec son rayon). Il dort tant que rien ne le touche : un corps endormi ne
   coûte rien, ni en calcul ni en collision. Réveillé (tir, explosion, soldat qui le bouscule, autre prop), il est simulé
   en pas de 1/100 s : intégration, un contact par point avec le sol, les rampes et les boîtes de la carte (une seule
   requête de boîtes par image et par corps), impulsions séquentielles avec frottement de Coulomb, puis sommeil quand il
   est posé et immobile. Les sphères (fruits, boules de neige) se heurtent entre elles : un fruit lancé réveille ses voisins.
   Les props sont cosmétiques : chaque pair simule les siens, seuls les tirs sont annoncés (événement « prop ») pour que
   tous voient le même bonhomme de neige éclater. Un soldat qui marche ou court contre un prop ne le déplace jamais : seuls les
   tirs et les explosions le délogent (sinon chaque pas sur un objet physique devient une source de collisions bancales).
   ========================================================================== */
const _ph1 = new V3(), _ph2 = new V3(), _ph3 = new V3(), _ph4 = new V3(), _ph5 = new V3(), _ph6 = new V3();
const PH = { slop: 0.003, iters: 5, hMax: 1 / 100, hMin: 1 / 200, vMax: 22, wMax: 28, sleepW: 0.45, sleepT: 0.55, maxT: 14, stride: 21 };
class PBody {
  constructor(d, V, s) {
    this.d = d; this.V = V; this.id = 0; this.vi = 0; this.state = 1; // 0 absent (réserve de débris), 1 au repos, 2 en mouvement
    this.p = new V3(); this.q = new THREE.Quaternion(); this.vel = new V3(); this.w = new V3();
    this.R = new Float64Array(9); this.iw = new Float64Array(9);
    this.cols = []; this.boxes = []; this.ramps = []; this.origin = null; this.pooled = false; this.tint = null; this.tintRaw = null;
    this.hp = d.hp; this.shock = 0; this.ext = null; this.still = 0; this.t = 0; this.t0 = 0; this.sndT = 0; this.need = true; this.nc = 0; this.floor = 0; this.wet = false; this.ripT = 0; this.cb = 0; this.mg = 0; this.sleepNow = false; this.snap = new V3(); this.snapT = 0;
    this.setScale(s);
  }
  /* Échelle uniforme : la masse suit le volume, l'inertie la masse et le carré de la taille */
  setScale(s) {
    const d = this.d; this.s = s;
    this.m = d.mass * s * s * s; this.im = 1 / this.m;
    const k = 1 / (s ** 5); this.ii = [d.ii[0] * k, d.ii[1] * k, d.ii[2] * k];
    this.rad = d.rad * s;
    this.sh = d.sh.map((a) => a.map((v, i) => (i === 0 ? v : v * s)));
    const n = d.pts.length; this.np = n; this.pts = new Float64Array(n * 4);
    d.pts.forEach((p, i) => { this.pts[i * 4] = p[0] * s; this.pts[i * 4 + 1] = p[1] * s; this.pts[i * 4 + 2] = p[2] * s; this.pts[i * 4 + 3] = p[3] * s; });
    this.pp = new Float64Array(n * 3); this.cc = new Float64Array(n * PH.stride);
    this.nq = d.qp.length; this.qp = new Float64Array(this.nq * 3); d.qp.forEach((p, i) => { this.qp[i * 3] = p[0] * s; this.qp[i * 3 + 1] = p[1] * s; this.qp[i * 3 + 2] = p[2] * s; });
    this.rb = d.ball ? this.sh[0][4] : 0; // rayon d'une sphère (collisions entre sphères)
  }
}

/* Matrice de rotation et inertie inverse dans le repère du monde (R diag(ii) R^T) */
function propRot(b) {
  const q = b.q, x = q.x, y = q.y, z = q.z, w = q.w, R = b.R, I = b.iw, ii = b.ii;
  R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - z * w); R[2] = 2 * (x * z + y * w);
  R[3] = 2 * (x * y + z * w); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - x * w);
  R[6] = 2 * (x * z - y * w); R[7] = 2 * (y * z + x * w); R[8] = 1 - 2 * (x * x + y * y);
  const a = ii[0], c = ii[1], e = ii[2];
  I[0] = R[0] * R[0] * a + R[1] * R[1] * c + R[2] * R[2] * e; I[1] = R[0] * R[3] * a + R[1] * R[4] * c + R[2] * R[5] * e; I[2] = R[0] * R[6] * a + R[1] * R[7] * c + R[2] * R[8] * e;
  I[3] = I[1]; I[4] = R[3] * R[3] * a + R[4] * R[4] * c + R[5] * R[5] * e; I[5] = R[3] * R[6] * a + R[4] * R[7] * c + R[5] * R[8] * e;
  I[6] = I[2]; I[7] = I[5]; I[8] = R[6] * R[6] * a + R[7] * R[7] * c + R[8] * R[8] * e;
}
/* Pose du corps dans la matrice d'instance de sa variante (échelle nulle s'il est absent) */
function propWrite(b) {
  const e = b.G.attr.array, o = b.vi * 16, R = b.R, s = b.state === 0 ? 0 : b.s, p = b.p;
  e[o] = R[0] * s; e[o + 1] = R[3] * s; e[o + 2] = R[6] * s; e[o + 3] = 0;
  e[o + 4] = R[1] * s; e[o + 5] = R[4] * s; e[o + 6] = R[7] * s; e[o + 7] = 0;
  e[o + 8] = R[2] * s; e[o + 9] = R[5] * s; e[o + 10] = R[8] * s; e[o + 11] = 0;
  e[o + 12] = p.x; e[o + 13] = p.y; e[o + 14] = p.z; e[o + 15] = 1;
}

/* Sphère englobante d'un groupe : celle de ses corps présents (la caméra et les ombres écartent le groupe hors champ) */
function propGroupBounds(G) {
  let n = 0, cx = 0, cy = 0, cz = 0;
  const B = G.bodies;
  for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.state) { cx += b.p.x; cy += b.p.y; cz += b.p.z; n++; } }
  const S = G.sphere;
  if (!n) { S.center.set(0, -1000, 0); S.radius = 0.001; return; }
  cx /= n; cy /= n; cz /= n; let r = 0;
  for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.state) { const dx = b.p.x - cx, dy = b.p.y - cy, dz = b.p.z - cz; r = Math.max(r, Math.sqrt(dx * dx + dy * dy + dz * dz) + b.rad); } }
  S.center.set(cx, cy, cz); S.radius = r + 0.3;
}

/* ---------- Réveil, sommeil, remise à zéro ---------- */
/* Les boîtes de collision du prefab ne sont plus : le prop a quitté sa place */
function propFreeCols(b) { for (const c of b.cols) { c.x0 = c.x1 = c.z0 = c.z1 = 1e6; c.y0 = c.y1 = -1e6; } }
function propWake(b, force) {
  if (b.state === 2) return true;
  if (b.state === 0 || (!force && PHYS.awake.length >= PHYS.maxAwake)) return false;
  const rest = b.state === 1;
  b.state = 2; b.still = 0; b.t = 0; b.need = true; b.snap.copy(b.p); b.snapT = 0; propFreeCols(b); PHYS.pv++;
  if (b.inSlept) { b.inSlept = false; const k = PHYS.slept.indexOf(b); if (k >= 0) PHYS.slept.splice(k, 1); }
  PHYS.awake.push(b);
  if (rest && !b.pooled) { if (b.d.spill) propSpill(b); if (b.d.stack) propUnsupport(b); }
  return true;
}
/* Demi-dimensions de la boîte alignée sur les axes qui contient la forme du corps (dans sa pose actuelle) */
function propExtent(b) {
  const s = b.sh[0], R = b.R;
  let hx, hy, hz;
  if (s[0] === 'b') { hx = s[4]; hy = s[5]; hz = s[6]; } else if (s[0] === 'y') { hx = s[4]; hy = s[5]; hz = s[4]; } else { hx = hy = hz = s[4]; }
  b.ext = [Math.abs(R[0]) * hx + Math.abs(R[1]) * hy + Math.abs(R[2]) * hz, Math.abs(R[3]) * hx + Math.abs(R[4]) * hy + Math.abs(R[5]) * hz, Math.abs(R[6]) * hx + Math.abs(R[7]) * hy + Math.abs(R[8]) * hz];
  return b.ext;
}
/* Un corps empilé vient de partir : ceux qui ne reposaient que sur lui tombent à leur tour (le mur de sacs s'effrite, la pile
   de pneus s'éboule). Un corps tient tant qu'un autre corps au repos, sous lui, le porte encore. */
function propUnsupport(b) {
  const S = PHYS.stackers, e = b.ext || propExtent(b), top = b.p.y + e[1];
  for (const c of S) {
    if (c === b || c.state !== 1 || c.pooled) continue;
    const ce = c.ext || propExtent(c);
    if (Math.abs((c.p.y - ce[1]) - top) > 0.12 || Math.abs(c.p.x - b.p.x) > e[0] + ce[0] - 0.03 || Math.abs(c.p.z - b.p.z) > e[2] + ce[2] - 0.03) continue;
    let held = false;
    for (const o of S) {
      if (o === b || o === c || o.state !== 1 || o.pooled) continue;
      const oe = o.ext || propExtent(o);
      if (Math.abs((c.p.y - ce[1]) - (o.p.y + oe[1])) <= 0.12 && Math.abs(c.p.x - o.p.x) < oe[0] + ce[0] - 0.12 && Math.abs(c.p.z - o.p.z) < oe[2] + ce[2] - 0.12) { held = true; break; }
    }
    if (!held) { propWake(c, true); c.vel.set(rand(-0.2, 0.2), 0, rand(-0.2, 0.2)); }
  }
}
/* Un cageot ou un bac part (d.spill : le type de ce qu'il porte, fruits ou poissons) : sa charge le quitte et le plancher qui la retenait disparaît */
function propSpill(b) {
  const e = b.ext || propExtent(b), x0 = b.p.x - e[0] - 0.03, x1 = b.p.x + e[0] + 0.03, z0 = b.p.z - e[2] - 0.03, z1 = b.p.z + e[2] + 0.03, y0 = b.p.y - e[1] - 0.03;
  for (const c of PHYS.pcols) if (c.crate && c.x0 >= x0 && c.x1 <= x1 && c.z0 >= z0 && c.z1 <= z1 && c.y0 >= y0 - 0.02 && c.y1 <= y0 + 0.5) { c.x0 = c.x1 = c.z0 = c.z1 = 1e6; c.y0 = c.y1 = -1e6; }
  for (const f of PHYS.bodies) {
    if (f.state !== 1 || f.pooled || f.d.type !== b.d.spill || f.p.x < x0 || f.p.x > x1 || f.p.z < z0 || f.p.z > z1 || f.p.y < y0 || f.p.y > y0 + 0.5) continue;
    if (propWake(f, true)) { f.vel.set(rand(-0.5, 0.5), rand(0.8, 1.8), rand(-0.5, 0.5)); f.w.set(rand(-4, 4), rand(-4, 4), rand(-4, 4)); }
  }
}
function propSleep(b) {
  b.state = 1; b.vel.set(0, 0, 0); b.w.set(0, 0, 0); PHYS.pv++;
  const i = PHYS.awake.indexOf(b); if (i >= 0) PHYS.awake.splice(i, 1);
  // endormi ailleurs que sur sa place : ses boîtes de collision ne le suivent pas, les corps réveillés le rencontrent par propPairs
  if (!b.d.ball && !b.inSlept) { b.inSlept = true; PHYS.slept.push(b); }
}
/* Fait disparaître un corps (réserve de débris, prop brisé) */
function propHide(b) {
  const i = PHYS.awake.indexOf(b); if (i >= 0) PHYS.awake.splice(i, 1);
  b.state = 0; propFreeCols(b); PHYS.pv++; if (b.inSlept) { b.inSlept = false; PHYS.slept.splice(PHYS.slept.indexOf(b), 1); } propWrite(b); b.G.attr.needsUpdate = true; propGroupBounds(b.G);
}
/* Nouvelle partie dans la même carte : tout revient à sa place, entier */
function propsReset() {
  if (!PHYS.ready) return;
  PHYS.awake.length = 0; PHYS.slept.length = 0;
  for (const c of PHYS.pcols) if (c.o) { c.x0 = c.o[0]; c.x1 = c.o[1]; c.y0 = c.o[2]; c.y1 = c.o[3]; c.z0 = c.o[4]; c.z1 = c.o[5]; }
  for (const b of PHYS.bodies) {
    b.vel.set(0, 0, 0); b.w.set(0, 0, 0); b.hp = b.d.hp; b.shock = 0; b.still = 0; b.sndT = 0; b.inSlept = false;
    if (b.pooled) { b.state = 0; b.setScale(1); b.q.set(0, 0, 0, 1); propRot(b); b.p.set(0, 0, 0); }
    else {
      const o = b.origin; b.state = 1; b.q.setFromEuler(_peul.set(o.rx, o.ry, o.rz, 'YXZ')); propRot(b);
      const c = b.d.com, R = b.R, s = b.s;
      b.p.set(o.x + (R[0] * c[0] + R[1] * c[1] + R[2] * c[2]) * s, o.y + (R[3] * c[0] + R[4] * c[1] + R[5] * c[2]) * s, o.z + (R[6] * c[0] + R[7] * c[1] + R[8] * c[2]) * s);
      for (const c2 of b.cols) { const k = c2.o; c2.x0 = k[0]; c2.x1 = k[1]; c2.y0 = k[2]; c2.y1 = k[3]; c2.z0 = k[4]; c2.z1 = k[5]; }
    }
    propWrite(b);
  }
  for (const V of PHYS.variants.values()) for (const G of V.groups.values()) { G.attr.needsUpdate = true; propGroupBounds(G); if (G.lazy) { G.on = false; for (const m of G.meshes) m.visible = false; } }
}
/* Pour la compilation des shaders : les maillages de débris, invisibles tant que rien n'a éclaté, sont montrés le temps de la compilation */
function propsWarm(on) {
  for (const V of PHYS.variants.values()) for (const G of V.groups.values()) if (G.lazy) for (const m of G.meshes) m.visible = on || G.on;
}
/* Déchargement de la carte */
function propsClear() {
  PROP_MATS.clear(); // copies des matières (propMat) : libérées avec les maillages de la carte (mapUnload)
  PHYS.bodies.length = 0; PHYS.variants.clear(); PHYS.pcols.length = 0; PHYS.phash.clear(); PHYS.balls.length = 0; PHYS.awake.length = 0; PHYS.slept.length = 0;
  PHYS.stackers = []; PHYS.moving.clear(); PHYS.live = false; PHYS.ready = false; PHYS.nextId = 0;
}

/* ---------- Contacts ---------- */
/* Boîtes et rampes autour du corps, une seule requête par image : la marge couvre la distance parcourue pendant l'image */
function propBounds(b, dt) {
  const p = b.p, r = b.rad + 0.35 + (b.vel.length() + b.w.length() * b.rad * 0.5) * dt;
  b.boxes.length = 0; b.ramps.length = 0; b.need = false;
  for (const c of queryBoxes(p.x - r, p.z - r, p.x + r, p.z + r)) if (!c.ray && c.y1 > p.y - r && c.y0 < p.y + r) b.boxes.push(c);
  for (let x = Math.floor((p.x - r) / 2); x <= Math.floor((p.x + r) / 2); x++) for (let z = Math.floor((p.z - r) / 2); z <= Math.floor((p.z + r) / 2); z++) {
    const a = PHYS.phash.get(x * 1000 + z); if (!a) continue;
    for (const i of a) { const c = PHYS.pcols[i]; if (c.y1 > p.y - r && c.y0 < p.y + r && b.boxes.indexOf(c) < 0) b.boxes.push(c); }
  }
  for (const rp of RAMPS) if (rp.x1 > p.x - r && rp.x0 < p.x + r && rp.z1 > p.z - r && rp.z0 < p.z + r) b.ramps.push(rp);
}
const PC = { nx: 0, ny: 0, nz: 0 }, _pn = [0, 1, 0];
/* Sol implicite sous (x, z) : le fond de la mer ou d'un bassin où l'on patauge, sinon 0 (un objet tombé à l'eau coule ou flotte au lieu de
   rester posé sur un sol invisible à la hauteur des quais) */
function propFloor(x, z) {
  if (WATER.on && waterAt(x, z)) return WATER.floor;
  if (POOLS.length) { const q = poolAt(x, z); if (q) return q.bed; }
  return 0;
}
/* Pénétration la plus profonde d'un point (centre px, py, pz ; rayon r ; position précédente qx, qy, qz) dans le sol, les
   rampes et les boîtes. Sortie des boîtes par la face d'où le point vient (jamais par en dessous d'une boîte posée au sol). */
function propPenetration(b, px, py, pz, qx, qy, qz, r) {
  let bd = 0;
  if (RELIEF.on) { // sol en relief (dunes) : plan tangent sous le point
    const h = reliefAt(px, pz);
    if (py - h < r + 0.5) { const n = reliefNormal(px, pz, _pn), pen = r - (py - h) * n[1]; if (pen > 0) { bd = pen; PC.nx = n[0]; PC.ny = n[1]; PC.nz = n[2]; } }
  } else if (!VOID.on && r - (py - b.floor) > 0) { bd = r - (py - b.floor); PC.nx = 0; PC.ny = 1; PC.nz = 0; } // sol implicite (aucun au-dessus du vide ; le fond sous l'eau)
  for (const rp of b.ramps) {
    if (px < rp.x0 || px > rp.x1 || pz < rp.z0 || pz > rp.z1) continue;
    const h = rampHeight(rp, px, pz); if (py < h - 0.3) continue;
    const sl = (rp.h1 - rp.h0) / (rp.axis === 'x' ? rp.x1 - rp.x0 : rp.z1 - rp.z0), il = 1 / Math.sqrt(1 + sl * sl), ux = rp.axis === 'x' ? -sl * il : 0, uz = rp.axis === 'z' ? -sl * il : 0;
    const pen = r - (py - h) * il;
    if (pen > bd) { bd = pen; PC.nx = ux; PC.ny = il; PC.nz = uz; }
  }
  for (const c of b.boxes) {
    const x0 = c.x0 - r, x1 = c.x1 + r, y0 = c.y0 - r, y1 = c.y1 + r, z0 = c.z0 - r, z1 = c.z1 + r;
    if (px < x0 || px > x1 || py < y0 || py > y1 || pz < z0 || pz > z1) continue;
    // face franchie depuis le début du pas ; à défaut (point né dans la boîte), la plus proche
    const low = c.y0 < 0.05;
    const m0 = x0 - qx, m1 = qx - x1, m2 = low ? -1e9 : y0 - qy, m3 = qy - y1, m4 = z0 - qz, m5 = qz - z1;
    const e0 = px - x0, e1 = x1 - px, e2 = low ? 1e9 : py - y0, e3 = y1 - py, e4 = pz - z0, e5 = z1 - pz;
    let k = 0, best = m0;
    if (m1 > best) { best = m1; k = 1; } if (m2 > best) { best = m2; k = 2; } if (m3 > best) { best = m3; k = 3; } if (m4 > best) { best = m4; k = 4; } if (m5 > best) { best = m5; k = 5; }
    if (best < -0.004) { let mn = e0; k = 0; if (e1 < mn) { mn = e1; k = 1; } if (e2 < mn) { mn = e2; k = 2; } if (e3 < mn) { mn = e3; k = 3; } if (e4 < mn) { mn = e4; k = 4; } if (e5 < mn) { k = 5; } }
    const pen = k === 0 ? e0 : k === 1 ? e1 : k === 2 ? e2 : k === 3 ? e3 : k === 4 ? e4 : e5;
    if (pen > bd) { bd = pen; PC.nx = k === 0 ? -1 : k === 1 ? 1 : 0; PC.ny = k === 2 ? -1 : k === 3 ? 1 : 0; PC.nz = k === 4 ? -1 : k === 5 ? 1 : 0; }
  }
  return bd;
}

/* Un pas de simulation de durée h : intégration, contacts, impulsions séquentielles (normale puis frottement) */
function propStep(b, h) {
  const d = b.d, n = b.np, pts = b.pts, pp = b.pp, R = b.R, p = b.p, v = b.vel, w = b.w, S = PH.stride, cc = b.cc;
  if (b.need) propBounds(b, h * 2);
  for (let i = 0; i < n; i++) {
    const l = i * 4;
    pp[i * 3] = p.x + R[0] * pts[l] + R[1] * pts[l + 1] + R[2] * pts[l + 2]; pp[i * 3 + 1] = p.y + R[3] * pts[l] + R[4] * pts[l + 1] + R[5] * pts[l + 2]; pp[i * 3 + 2] = p.z + R[6] * pts[l] + R[7] * pts[l + 1] + R[8] * pts[l + 2];
  }
  // intégration
  v.y -= PHYS.g * h;
  // dans l'eau : poussée d'Archimède sur la part immergée (mesurée sur la hauteur du corps, vagues de la mer comprises), d'après sa masse
  // volumique ; l'eau le freine et freine sa rotation ; il éclabousse en y entrant, laisse des ronds en y flottant
  const surf = POOLS.length || WATER.on ? waterSurfaceAt(p.x, p.z) : null;
  if (surf !== null) {
    const hy = d.hy * b.s, top = surf + (WATER.on && waterAt(p.x, p.z) ? waterHeight(p.x, p.z, WATER.t) : 0), f = clamp((top - (p.y - hy)) / (2 * hy), 0, 1);
    if (f > 0) {
      // (rapport des masses volumiques plafonné à 4 : un corps très léger flotte au quart immergé au lieu de bondir hors de l'eau)
      v.y += PHYS.g * Math.min(4, 1000 / d.rho) * f * h;
      const dw = Math.exp(-(1.5 + 3 * f) * h), ww = Math.exp(-2.5 * f * h); v.x *= dw; v.y *= dw * Math.exp(-5 * f * h); v.z *= dw; w.x *= ww; w.y *= ww; w.z *= ww;
      if (!b.wet && v.y < -1.2) { const P = _ph2.set(p.x, top, p.z); waterSplashFx(P, b.m > 10); sfxPlunge(P, clamp(b.m / 20, 0.2, 0.8)); }
      b.wet = true; b.ripT = (b.ripT || 0) + h;
      if (b.ripT > 0.18) { b.ripT = 0; const sp2 = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); if (sp2 > 0.4) rippleAdd(p.x, p.z, 0.18 + hy * 0.6, -0.004 * Math.min(sp2, 3), 0); }
    } else b.wet = false;
  } else b.wet = false;
  const dk = Math.exp(-d.drag * h); v.x *= dk; v.y *= dk; v.z *= dk;
  const sp = v.length(); if (sp > PH.vMax) v.multiplyScalar(PH.vMax / sp);
  const ws = w.length(); if (ws > PH.wMax) w.multiplyScalar(PH.wMax / ws);
  p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;
  const q = b.q, hw = 0.5 * h;
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  q.x += hw * (w.x * qw + w.y * qz - w.z * qy); q.y += hw * (w.y * qw + w.z * qx - w.x * qz); q.z += hw * (w.z * qw + w.x * qy - w.y * qx); q.w += hw * (-w.x * qx - w.y * qy - w.z * qz);
  q.normalize(); propRot(b);
  // contacts : un par point, le plus profond ; la position est corrigée au fur et à mesure (jamais plus que nécessaire)
  b.floor = RELIEF.on || VOID.on ? 0 : propFloor(p.x, p.z);
  let nc = 0;
  for (let i = 0; i < n; i++) {
    const l = i * 4, lx = pts[l], ly = pts[l + 1], lz = pts[l + 2], r = pts[l + 3];
    const px = p.x + R[0] * lx + R[1] * ly + R[2] * lz, py = p.y + R[3] * lx + R[4] * ly + R[5] * lz, pz = p.z + R[6] * lx + R[7] * ly + R[8] * lz;
    const pen = propPenetration(b, px, py, pz, pp[i * 3], pp[i * 3 + 1], pp[i * 3 + 2], r);
    if (pen <= 0) continue;
    const c = nc++ * S, nx = PC.nx, ny = PC.ny, nz = PC.nz, corr = Math.max(0, pen - PH.slop) * 0.9;
    p.x += nx * corr; p.y += ny * corr; p.z += nz * corr;
    cc[c] = nx; cc[c + 1] = ny; cc[c + 2] = nz; cc[c + 20] = i;
  }
  b.nc = nc;
  if (!nc) { propSleepCheck(b, h, false); return; }
  const iw = b.iw, im = b.im, mu = d.mu * (CURMAP.def && CURMAP.def.atmo.snow ? 0.6 : 1);
  for (let k = 0; k < nc; k++) {
    const c = k * S, i = cc[c + 20], l = i * 4, nx = cc[c], ny = cc[c + 1], nz = cc[c + 2], r = pts[l + 3];
    // bras de levier : du centre de masse au point de la surface touchée
    const wx = R[0] * pts[l] + R[1] * pts[l + 1] + R[2] * pts[l + 2] - nx * r, wy = R[3] * pts[l] + R[4] * pts[l + 1] + R[5] * pts[l + 2] - ny * r, wz = R[6] * pts[l] + R[7] * pts[l + 1] + R[8] * pts[l + 2] - nz * r;
    cc[c + 3] = wx; cc[c + 4] = wy; cc[c + 5] = wz;
    const vx = v.x + w.y * wz - w.z * wy, vy = v.y + w.z * wx - w.x * wz, vz = v.z + w.x * wy - w.y * wx, vn = vx * nx + vy * ny + vz * nz;
    cc[c + 19] = vn; cc[c + 7] = vn < -1.2 ? -d.e * vn : 0; cc[c + 8] = 0; cc[c + 17] = 0; cc[c + 18] = 0;
    // masse effective le long de la normale et de deux tangentes
    const ax = Math.abs(nx) > 0.9 ? 0 : 1, ay = Math.abs(nx) > 0.9 ? 1 : 0, az = 0;
    let t1x = ny * az - nz * ay, t1y = nz * ax - nx * az, t1z = nx * ay - ny * ax; const tl = Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z) || 1; t1x /= tl; t1y /= tl; t1z /= tl;
    const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x;
    cc[c + 9] = t1x; cc[c + 10] = t1y; cc[c + 11] = t1z; cc[c + 12] = t2x; cc[c + 13] = t2y; cc[c + 14] = t2z;
    cc[c + 6] = propKk(im, iw, wx, wy, wz, nx, ny, nz); cc[c + 15] = propKk(im, iw, wx, wy, wz, t1x, t1y, t1z); cc[c + 16] = propKk(im, iw, wx, wy, wz, t2x, t2y, t2z);
    // choc audible (un par instant) : le son suit la matière, la poussière la masse
    if (vn < -1.8 && b.sndT <= 0) {
      b.sndT = 0.14; const k2 = clamp(-vn / 6, 0.3, 1.3);
      const P = _ph1.set(p.x + R[0] * pts[l] + R[1] * pts[l + 1] + R[2] * pts[l + 2], p.y + R[3] * pts[l] + R[4] * pts[l + 1] + R[5] * pts[l + 2], p.z + R[6] * pts[l] + R[7] * pts[l + 1] + R[8] * pts[l + 2]);
      sfxProp(P, d.snd, k2);
      if (b.m > 20 && vn < -3 && ny > 0.7) bodyDustFx(P, clamp(-vn / 8, 0.3, 1));
    }
  }
  for (let it = 0; it < PH.iters; it++) {
    for (let k = 0; k < nc; k++) {
      const c = k * S, nx = cc[c], ny = cc[c + 1], nz = cc[c + 2], wx = cc[c + 3], wy = cc[c + 4], wz = cc[c + 5];
      let vx = v.x + w.y * wz - w.z * wy, vy = v.y + w.z * wx - w.x * wz, vz = v.z + w.x * wy - w.y * wx;
      let jn = (cc[c + 7] - (vx * nx + vy * ny + vz * nz)) * cc[c + 6];
      const acc = Math.max(cc[c + 8] + jn, 0); jn = acc - cc[c + 8]; cc[c + 8] = acc;
      propImpulse(b, wx, wy, wz, nx * jn, ny * jn, nz * jn);
      const lim = mu * acc;
      for (let a = 0; a < 2; a++) {
        const o = c + 9 + a * 3, tx = cc[o], ty = cc[o + 1], tz = cc[o + 2];
        vx = v.x + w.y * wz - w.z * wy; vy = v.y + w.z * wx - w.x * wz; vz = v.z + w.x * wy - w.y * wx;
        let jt = -(vx * tx + vy * ty + vz * tz) * cc[c + 15 + a];
        const ta = Math.max(-lim, Math.min(lim, cc[c + 17 + a] + jt)); jt = ta - cc[c + 17 + a]; cc[c + 17 + a] = ta;
        propImpulse(b, wx, wy, wz, tx * jt, ty * jt, tz * jt);
      }
    }
  }
  propSleepCheck(b, h, true);
}
/* Masse effective au point de bras (wx, wy, wz) le long de u : 1 / (m^-1 + (r x u) . I^-1 (r x u)) */
function propKk(im, iw, wx, wy, wz, ux, uy, uz) {
  const rx = wy * uz - wz * uy, ry = wz * ux - wx * uz, rz = wx * uy - wy * ux;
  return 1 / (im + rx * (iw[0] * rx + iw[1] * ry + iw[2] * rz) + ry * (iw[3] * rx + iw[4] * ry + iw[5] * rz) + rz * (iw[6] * rx + iw[7] * ry + iw[8] * rz));
}
/* Impulsion j appliquée au point de bras r (par rapport au centre de masse) */
function propImpulse(b, rx, ry, rz, jx, jy, jz) {
  const v = b.vel, w = b.w, iw = b.iw, im = b.im;
  v.x += jx * im; v.y += jy * im; v.z += jz * im;
  const tx = ry * jz - rz * jy, ty = rz * jx - rx * jz, tz = rx * jy - ry * jx;
  w.x += iw[0] * tx + iw[1] * ty + iw[2] * tz; w.y += iw[3] * tx + iw[4] * ty + iw[5] * tz; w.z += iw[6] * tx + iw[7] * ty + iw[8] * tz;
}
/* Sommeil : le corps est posé (au moins un contact) et n'a presque pas bougé en 0,2 s, trois fois de suite (le déplacement, pas la
   vitesse : un tas de fruits frémit de quelques millimètres sans bouger), ou il est en mouvement depuis trop longtemps.
   Une sphère qui tourne sur place ne compte pas : sa rotation ne se voit pas. */
function propSleepCheck(b, h, grounded) {
  if (b.cb > 0) { grounded = true; b.cb--; } // posé sur d'autres sphères : c'est aussi un appui
  const d = b.d, v = b.vel, w = b.w;
  if (grounded) {
    // posé : l'élan de rotation s'use (les sphères roulent longtemps, les boîtes s'arrêtent vite), et les petits mouvements
    // sont freinés bien plus que les rapides
    const rk = Math.exp(-(d.rr + (b.cb > 0 ? 6 : 0)) * h); w.x *= rk; w.y *= rk; w.z *= rk;
    if (v.lengthSq() < 0.36) { const k = Math.exp(-2.5 * h); v.x *= k; v.y *= k; v.z *= k; }
  }
  b.t += h; b.sndT -= h; b.snapT += h;
  if (b.snapT >= 0.2) {
    const lim = d.ball ? 0.012 : 0.006; // une sphère s'arrête dès qu'elle avance de moins de 6 cm/s
    const moved = b.p.distanceToSquared(b.snap) > lim * lim || (!d.ball && w.lengthSq() > PH.sleepW * PH.sleepW);
    b.still = grounded && !moved ? b.still + b.snapT : 0; b.snapT = 0; b.snap.copy(b.p);
  }
  b.sleepNow = b.still > PH.sleepT || b.t > PH.maxT;
}

/* Collisions entre sphères (fruits, boules de neige, bonnets) : un fruit lancé réveille ceux qu'il touche */
function propBalls(h) {
  const A = PHYS.awake, B = PHYS.balls;
  for (let i = 0; i < A.length; i++) {
    const a = A[i]; if (!a.d.ball || a.state !== 2) continue;
    for (let j = 0; j < B.length; j++) {
      const c = B[j]; if (c === a || c.state === 0) continue;
      const dx = a.p.x - c.p.x, rr = a.rb + c.rb; if (dx > rr || dx < -rr) continue;
      const dz = a.p.z - c.p.z; if (dz > rr || dz < -rr) continue;
      const dy = a.p.y - c.p.y, d2 = dx * dx + dy * dy + dz * dz;
      // une endormie n'est réveillée que par un vrai choc (enfoncement de plus de 8 mm) : au contact d'une sphère qui ne fait que
      // reposer contre elle, elle reste en place
      if (c.state === 1) { const lim = rr - 0.008; if (d2 < lim * lim && propWake(c, false)) { /* réveillée */ } else continue; }
      if (d2 < (rr + 0.01) * (rr + 0.01)) { a.cb = c.cb = 3; } // appui, même sans enfoncement
      if (d2 >= rr * rr || d2 < 1e-10) continue;
      if (c.state === 2 && c.id < a.id) continue; // une paire, une fois
      a.cb = c.cb = 3;
      // une sphère qui repose sur le sol ou un bord ne cède pas à celle qui est au-dessus d'elle : c'est la seconde qui bouge
      let ia = a.im, ic = c.im; if (dy < -0.2 * rr && a.nc > 0) ia *= 0.05; else if (dy > 0.2 * rr && c.nc > 0) ic *= 0.05;
      const dist = Math.sqrt(d2), nx = dx / dist, ny = dy / dist, nz = dz / dist, pen = rr - dist, is = ia + ic;
      a.p.x += nx * pen * ia / is; a.p.y += ny * pen * ia / is; a.p.z += nz * pen * ia / is;
      c.p.x -= nx * pen * ic / is; c.p.y -= ny * pen * ic / is; c.p.z -= nz * pen * ic / is;
      const vn = (a.vel.x - c.vel.x) * nx + (a.vel.y - c.vel.y) * ny + (a.vel.z - c.vel.z) * nz;
      if (vn < 0) {
        const j = -(1 + (vn < -1.5 ? Math.min(a.d.e, c.d.e) : 0)) * vn / is; // pas de rebond sous 1,5 m/s : un tas au repos ne rebondit pas sur lui-même
        a.vel.x += nx * j * ia; a.vel.y += ny * j * ia; a.vel.z += nz * j * ia; c.vel.x -= nx * j * ic; c.vel.y -= ny * j * ic; c.vel.z -= nz * j * ic;
        // frottement entre les deux sphères (Coulomb) : un tas de fruits se tient, une boule ne glisse pas sur une autre sans fin
        const tx = a.vel.x - c.vel.x - ((a.vel.x - c.vel.x) * nx + (a.vel.y - c.vel.y) * ny + (a.vel.z - c.vel.z) * nz) * nx, ty = a.vel.y - c.vel.y - ((a.vel.x - c.vel.x) * nx + (a.vel.y - c.vel.y) * ny + (a.vel.z - c.vel.z) * nz) * ny, tz = a.vel.z - c.vel.z - ((a.vel.x - c.vel.x) * nx + (a.vel.y - c.vel.y) * ny + (a.vel.z - c.vel.z) * nz) * nz;
        const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tl > 1e-6) {
          const jt = Math.min(tl / is, Math.min(a.d.mu, c.d.mu) * j) / tl;
          a.vel.x -= tx * jt * ia; a.vel.y -= ty * jt * ia; a.vel.z -= tz * jt * ia; c.vel.x += tx * jt * ic; c.vel.y += ty * jt * ic; c.vel.z += tz * jt * ic;
        }
        if (vn < -1.5 && a.sndT <= 0) { a.sndT = 0.12; sfxProp(a.p, a.d.snd, clamp(-vn / 6, 0.25, 1)); }
      }
    }
  }
}

/* Collisions entre corps rigides en mouvement (pneus, bacs, caisses, tables...) : les points de contact de chacun contre les formes de
   l'autre. Un corps réveillé perd ses boîtes de collision (propFreeCols) : sans cela, deux corps réveillés ensemble (une pile qui
   s'éboule, un bac et celui du dessus) se traversaient, alors que chacun ne rencontrait que le sol et les corps restés au repos. */
const PP = { nx: 0, ny: 0, nz: 0, x: 0, y: 0, z: 0 };
/* Plus profond point de a dans une forme de c : renvoie la pénétration (0 si aucune) ; PP : normale sortante de c (monde) et point */
const _pdOn = new Uint8Array(64);
function propDeepest(a, c) {
  let best = 0; const R = c.R, ap = a.qp, AR = a.R, sh = c.sh, ns = Math.min(sh.length, 64);
  // les formes de c que la sphère englobante de a n'atteint pas ne sont pas testées point par point (deux caisses voisines dans un tas : la
  // plupart des formes de l'une sont loin de l'autre)
  { const px = a.p.x - c.p.x, py = a.p.y - c.p.y, pz = a.p.z - c.p.z, ra = a.rad;
    const ox = R[0] * px + R[3] * py + R[6] * pz, oy = R[1] * px + R[4] * py + R[7] * pz, oz = R[2] * px + R[5] * py + R[8] * pz;
    let any = 0;
    for (let k = 0; k < ns; k++) {
      const s = sh[k], lx = ox - s[1], ly = oy - s[2], lz = oz - s[3];
      const on = s[0] === 'b' ? Math.abs(lx) < s[4] + ra && Math.abs(ly) < s[5] + ra && Math.abs(lz) < s[6] + ra
        : s[0] === 'y' ? lx * lx + lz * lz < (s[4] + ra) * (s[4] + ra) && Math.abs(ly) < s[5] + ra
        : lx * lx + ly * ly + lz * lz < (s[4] + ra) * (s[4] + ra);
      _pdOn[k] = on ? 1 : 0; any |= _pdOn[k];
    }
    if (!any) return 0;
  }
  for (let i = 0; i < a.nq; i++) {
    const l = i * 3, lx0 = ap[l], ly0 = ap[l + 1], lz0 = ap[l + 2];
    const wx = a.p.x + AR[0] * lx0 + AR[1] * ly0 + AR[2] * lz0, wy = a.p.y + AR[3] * lx0 + AR[4] * ly0 + AR[5] * lz0, wz = a.p.z + AR[6] * lx0 + AR[7] * ly0 + AR[8] * lz0;
    const px = wx - c.p.x, py = wy - c.p.y, pz = wz - c.p.z;
    const ox = R[0] * px + R[3] * py + R[6] * pz, oy = R[1] * px + R[4] * py + R[7] * pz, oz = R[2] * px + R[5] * py + R[8] * pz;
    for (let k = 0; k < ns; k++) {
      if (!_pdOn[k]) continue;
      const s = sh[k], lx = ox - s[1], ly = oy - s[2], lz = oz - s[3];
      let pen = 0, nx = 0, ny = 0, nz = 0;
      if (s[0] === 'b') {
        const ex = s[4] - Math.abs(lx), ey = s[5] - Math.abs(ly), ez = s[6] - Math.abs(lz);
        if (ex <= 0 || ey <= 0 || ez <= 0) continue;
        if (ex <= ey && ex <= ez) { pen = ex; nx = lx < 0 ? -1 : 1; } else if (ey <= ez) { pen = ey; ny = ly < 0 ? -1 : 1; } else { pen = ez; nz = lz < 0 ? -1 : 1; }
      } else if (s[0] === 'y') {
        const rr = Math.sqrt(lx * lx + lz * lz), er = s[4] - rr, ey = s[5] - Math.abs(ly);
        if (er <= 0 || ey <= 0) continue;
        if (er < ey) { pen = er; nx = lx / (rr || 1); nz = rr ? lz / rr : 1; } else { pen = ey; ny = ly < 0 ? -1 : 1; }
      } else {
        const dd = Math.sqrt(lx * lx + ly * ly + lz * lz); pen = s[4] - dd; if (pen <= 0) continue;
        nx = lx / (dd || 1); ny = dd ? ly / dd : 1; nz = lz / (dd || 1);
      }
      if (pen > best) { best = pen; PP.nx = R[0] * nx + R[1] * ny + R[2] * nz; PP.ny = R[3] * nx + R[4] * ny + R[5] * nz; PP.nz = R[6] * nx + R[7] * ny + R[8] * nz; PP.x = wx; PP.y = wy; PP.z = wz; }
    }
  }
  return best;
}
/* Terme angulaire de la masse effective de b au point de bras r, le long de n */
function propAng(b, rx, ry, rz, nx, ny, nz) {
  const tx = ry * nz - rz * ny, ty = rz * nx - rx * nz, tz = rx * ny - ry * nx, iw = b.iw;
  return tx * (iw[0] * tx + iw[1] * ty + iw[2] * tz) + ty * (iw[3] * tx + iw[4] * ty + iw[5] * tz) + tz * (iw[6] * tx + iw[7] * ty + iw[8] * tz);
}
/* stat : c est un corps endormi hors de sa place (il sert d'appui, il ne bouge pas) ; flip : ce sont les points de c qui sont dans a */
function propContact(a, c, stat, flip) {
  const pen = flip ? propDeepest(c, a) : propDeepest(a, c); if (pen <= 0) return;
  const sg = flip ? -1 : 1, nx = PP.nx * sg, ny = PP.ny * sg, nz = PP.nz * sg, ia = a.im, ic = stat ? 0 : c.im, is = ia + ic;
  const corr = Math.max(0, pen - PH.slop) * 0.8;
  a.p.x += nx * corr * ia / is; a.p.y += ny * corr * ia / is; a.p.z += nz * corr * ia / is;
  c.p.x -= nx * corr * ic / is; c.p.y -= ny * corr * ic / is; c.p.z -= nz * corr * ic / is;
  a.cb = c.cb = 3; // appui : l'un porte l'autre, ils peuvent s'endormir ensemble
  const ax = PP.x - a.p.x, ay = PP.y - a.p.y, az = PP.z - a.p.z, cx = PP.x - c.p.x, cy = PP.y - c.p.y, cz = PP.z - c.p.z;
  const rvx = a.vel.x + a.w.y * az - a.w.z * ay - (c.vel.x + c.w.y * cz - c.w.z * cy), rvy = a.vel.y + a.w.z * ax - a.w.x * az - (c.vel.y + c.w.z * cx - c.w.x * cz), rvz = a.vel.z + a.w.x * ay - a.w.y * ax - (c.vel.z + c.w.x * cy - c.w.y * cx);
  const vn = rvx * nx + rvy * ny + rvz * nz; if (vn >= 0) return;
  const kN = is + propAng(a, ax, ay, az, nx, ny, nz) + (stat ? 0 : propAng(c, cx, cy, cz, nx, ny, nz));
  const jn = -(1 + (vn < -1.2 ? Math.min(a.d.e, c.d.e) : 0)) * vn / kN;
  propImpulse(a, ax, ay, az, nx * jn, ny * jn, nz * jn); if (!stat) propImpulse(c, cx, cy, cz, -nx * jn, -ny * jn, -nz * jn);
  // frottement de Coulomb le long du glissement
  let tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz; const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (tl > 1e-6) {
    tx /= tl; ty /= tl; tz /= tl;
    const kT = is + propAng(a, ax, ay, az, tx, ty, tz) + (stat ? 0 : propAng(c, cx, cy, cz, tx, ty, tz)), jt = Math.min(tl / kT, Math.min(a.d.mu, c.d.mu) * jn);
    propImpulse(a, ax, ay, az, -tx * jt, -ty * jt, -tz * jt); if (!stat) propImpulse(c, cx, cy, cz, tx * jt, ty * jt, tz * jt);
  }
  if (vn < -1.5 && a.sndT <= 0) { a.sndT = 0.12; sfxProp(a.p, a.d.snd, clamp(-vn / 6, 0.25, 1)); }
}
/* Paires candidates de propPairs, relevées une fois par image (updateProps) au lieu de chaque passe (trois par pas de 1/100 s) : deux
   corps réveillés, ou un réveillé et un endormi hors de sa place, dont les sphères englobantes se touchent une fois élargies de ce que
   chacun peut parcourir pendant l'image (b.mg). Une grenade au milieu des caisses de la criée de Kervénec réveille 150 corps : les
   tester deux à deux, et chacun contre tous les endormis déplacés, à chaque passe, prenait le tiers de la physique, qui montait alors à
   5 à 8 ms par image pendant 3 s. L'ordre des paires reste celui du parcours complet. Un corps réveillé ou endormi en cours d'image
   (PHYS.pv change) fait refaire le relevé. */
const PPAIR = { a: [], c: [], st: [], v: -1, dt: 0 };
function propPairsCollect(dt) {
  const A = PHYS.awake, S = PHYS.slept, PA = PPAIR.a, PC2 = PPAIR.c, ST = PPAIR.st;
  PA.length = 0; PC2.length = 0; ST.length = 0; PPAIR.v = PHYS.pv; PPAIR.dt = dt;
  for (let i = 0; i < A.length; i++) { const b = A[i], v = b.vel, w = b.w; b.mg = 0.05 + (Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) + Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z) * b.rad + PHYS.g * dt) * dt * 1.5; }
  for (let i = 0; i < A.length; i++) {
    const a = A[i]; if (a.d.ball || a.state !== 2) continue;
    for (let j = i + 1; j < A.length; j++) {
      const c = A[j]; if (c.d.ball || c.state !== 2) continue;
      const dx = a.p.x - c.p.x, dy = a.p.y - c.p.y, dz = a.p.z - c.p.z, rr = a.rad + c.rad + a.mg + c.mg;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      PA.push(a); PC2.push(c); ST.push(false);
    }
    for (let j = 0; j < S.length; j++) {
      const c = S[j], dx = a.p.x - c.p.x, dy = a.p.y - c.p.y, dz = a.p.z - c.p.z, rr = a.rad + c.rad + a.mg;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      PA.push(a); PC2.push(c); ST.push(true);
    }
  }
}
function propPairs() {
  if (PPAIR.v !== PHYS.pv) propPairsCollect(PPAIR.dt);
  const PA = PPAIR.a, PC2 = PPAIR.c, ST = PPAIR.st;
  for (let k = 0; k < PA.length; k++) {
    const a = PA[k], c = PC2[k];
    if (a.state !== 2 || (ST[k] ? !c.inSlept : c.state !== 2)) continue;
    const dx = a.p.x - c.p.x, dy = a.p.y - c.p.y, dz = a.p.z - c.p.z, rr = a.rad + c.rad;
    if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
    if (ST[k]) { propContact(a, c, true); propContact(a, c, true, true); } // le corps réveillé contre l'endormi déplacé : l'endormi sert d'appui, il ne bouge pas
    else { propContact(a, c); propContact(c, a); }
  }
}

/* ---------- Mise à jour par image ---------- */
function updateProps(dt) {
  if (!PHYS.ready || !PHYS.live) return;
  const A = PHYS.awake; if (!A.length) { PHYS.acc = 0; return; }
  // au-delà de 200 images par seconde, un pas couvre deux images (ou plus) : à 280 images par seconde, la physique faisait 280 pas par
  // seconde au lieu des 100 qui suffisent, et une explosion parmi les caisses prenait alors le plus gros de l'image (les corps bougent à
  // 140 Hz, ce qui ne se distingue pas)
  PHYS.acc += dt; if (PHYS.acc < PH.hMin) return;
  dt = Math.min(PHYS.acc, 0.05); PHYS.acc = 0;
  const ns = Math.max(1, Math.ceil(dt / PH.hMax - 1e-6)), h = dt / ns;
  for (const b of A) propBounds(b, dt);
  propPairsCollect(dt);
  for (let s = 0; s < ns; s++) { for (let i = 0; i < A.length; i++) propStep(A[i], h); propBalls(h); propBalls(h); propPairs(); propPairs(); propPairs(); }
  for (let i = A.length - 1; i >= 0; i--) {
    const b = A[i];
    // hors de la zone de jeu, ou tombé dans le vide : le corps s'arrête sur place
    if (b.p.y < -4 || b.p.x < MAP.x0 - 2 || b.p.x > MAP.x1 + 2 || b.p.z < MAP.z0 - 2 || b.p.z > MAP.z1 + 2) { propHide(b); continue; }
    if (b.sleepNow) { propSleep(b); b.sleepNow = false; }
    propWrite(b); b.G.attr.needsUpdate = true; PHYS.moving.add(b.G);
  }
  // les groupes dont un corps a bougé : leur sphère englobante suit (au sommeil du dernier aussi)
  for (const G of PHYS.moving) { propGroupBounds(G); }
  PHYS.moving.clear();
}
/* Corps empilés (sacs de sable, pneus, caisses) : ceux qui tombent quand leur appui part */
function propsIndex() { PHYS.stackers = PHYS.bodies.filter((b) => b.d.stack && !b.pooled); }

/* ---------- Rayon contre les props ---------- */
const PRAY = { t: 0, nx: 0, ny: 0, nz: 0, b: null };
/* Plus proche prop touché par le rayon (direction normalisée) avant maxT. mode 0 : visée et lignes de vue (les petits
   props, qui laissent passer les balles, sont ignorés) ; 1 : tir (tous) ; 2 : jamais appelé (rayWorld saute les props). */
function propsRay(ox, oy, oz, dx, dy, dz, maxT, mode) {
  let best = maxT, hit = null, bnx = 0, bny = 0, bnz = 0;
  const B = PHYS.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; if (b.state === 0 || !b.d.ray || (b.d.through && mode === 0)) continue;
    const p = b.p, rx = p.x - ox, ry = p.y - oy, rz = p.z - oz, t0 = rx * dx + ry * dy + rz * dz, rad = b.rad;
    if (t0 < -rad || t0 > best + rad || rx * rx + ry * ry + rz * rz - t0 * t0 > rad * rad) continue;
    // dans le repère du corps (R transposée)
    const R = b.R, lox = R[0] * -rx + R[3] * -ry + R[6] * -rz, loy = R[1] * -rx + R[4] * -ry + R[7] * -rz, loz = R[2] * -rx + R[5] * -ry + R[8] * -rz;
    const ldx = R[0] * dx + R[3] * dy + R[6] * dz, ldy = R[1] * dx + R[4] * dy + R[7] * dz, ldz = R[2] * dx + R[5] * dy + R[8] * dz;
    for (const s of b.sh) {
      let t = -1, nx = 0, ny = 0, nz = 0;
      if (s[0] === 's') {
        const cx = lox - s[1], cy = loy - s[2], cz = loz - s[3], bb = cx * ldx + cy * ldy + cz * ldz, disc = bb * bb - (cx * cx + cy * cy + cz * cz - s[4] * s[4]);
        if (disc < 0) continue; t = -bb - Math.sqrt(disc); if (t < 0) continue;
        nx = (cx + ldx * t) / s[4]; ny = (cy + ldy * t) / s[4]; nz = (cz + ldz * t) / s[4];
      } else if (s[0] === 'b') {
        let tmin = -1e9, tmax = 1e9, ax = 0, sg = 1, miss = false;
        for (let a = 0; a < 3; a++) {
          const o = a === 0 ? lox - s[1] : a === 1 ? loy - s[2] : loz - s[3], dd = a === 0 ? ldx : a === 1 ? ldy : ldz, hh = s[4 + a];
          if (Math.abs(dd) < 1e-9) { if (o < -hh || o > hh) { miss = true; break; } continue; }
          let t1 = (-hh - o) / dd, t2 = (hh - o) / dd, sn = -1; if (t1 > t2) { const k = t1; t1 = t2; t2 = k; sn = 1; }
          if (t1 > tmin) { tmin = t1; ax = a; sg = sn; } if (t2 < tmax) tmax = t2;
        }
        if (miss || tmax < tmin || tmin < 0) continue;
        t = tmin; if (ax === 0) nx = sg; else if (ax === 1) ny = sg; else nz = sg;
      } else {
        const cx = lox - s[1], cz = loz - s[3], r = s[4], y0 = s[2] - s[5], y1 = s[2] + s[5], a = ldx * ldx + ldz * ldz;
        let th = 1e9;
        if (a > 1e-9) {
          const bb = cx * ldx + cz * ldz, disc = bb * bb - a * (cx * cx + cz * cz - r * r);
          if (disc >= 0) { const tt = (-bb - Math.sqrt(disc)) / a, y = loy + ldy * tt; if (tt >= 0 && y >= y0 && y <= y1) { th = tt; nx = (cx + ldx * tt) / r; ny = 0; nz = (cz + ldz * tt) / r; } }
        }
        if (Math.abs(ldy) > 1e-9) for (const [yc, sn] of [[y0, -1], [y1, 1]]) {
          const tt = (yc - loy) / ldy; if (tt < 0 || tt >= th) continue;
          const ex = cx + ldx * tt, ez = cz + ldz * tt; if (ex * ex + ez * ez <= r * r) { th = tt; nx = 0; ny = sn; nz = 0; }
        }
        if (th >= 1e9) continue; t = th;
      }
      if (t < best) { best = t; hit = b; bnx = R[0] * nx + R[1] * ny + R[2] * nz; bny = R[3] * nx + R[4] * ny + R[5] * nz; bnz = R[6] * nx + R[7] * ny + R[8] * nz; }
    }
  }
  if (!hit) return null;
  PRAY.t = best; PRAY.nx = bnx; PRAY.ny = bny; PRAY.nz = bnz; PRAY.b = hit;
  return PRAY;
}

/* ---------- Coups, souffle, éclatement ---------- */
/* Impulsion j (vecteur) au point P du corps */
function propPush(b, P, jx, jy, jz) {
  propRot(b);
  propImpulse(b, P.x - b.p.x, P.y - b.p.y, P.z - b.p.z, jx, jy, jz);
  const ws = b.w.length(); if (ws > PH.wMax) b.w.multiplyScalar(PH.wMax / ws);
}
/* Une balle touche le prop au point P, dans la direction dir, avec dmg points de dégâts. Réveille le corps, le pousse
   (Δv de référence du type pour 30 points de dégâts, réparti en impulsion au point d'impact : un tir décentré le fait tourner)
   et le casse quand ses points de vie sont épuisés. */
function propShot(b, P, dir, dmg) {
  const d = b.d; if (b.state === 0) return;
  const rest = b.state === 1;
  // un corps au repos qui résiste (sac de sable d'un mur, caisse d'une pile) encaisse les premiers coups sans bouger
  if (rest && d.hold) {
    b.shock += dmg;
    if (b.shock < d.hold) { propHitFx(b, P, dir); return; }
  }
  propWake(b, true);
  const dv = d.resp * clamp(dmg / 30, 0.3, 4) / Math.max(0.5, Math.cbrt(b.s)), m = b.m;
  propPush(b, P, dir.x * dv * m, (dir.y * dv + d.lift * dv * 0.35) * m, dir.z * dv * m);
  // un objet debout sur une arête (vélo) bascule du côté du coup
  if (rest && d.topple) {
    const R = b.R, side = (dir.x * R[0] + dir.y * R[3] + dir.z * R[6]) >= 0 ? -1 : 1; // (tourner autour de +z penche le haut vers -x)
    b.w.x += R[2] * d.topple * side; b.w.y += R[5] * d.topple * side; b.w.z += R[8] * d.topple * side;
  }
  b.still = 0;
  propHitFx(b, P, dir);
  b.hp -= dmg;
  if (b.hp <= 0 && d.brk) propBreak(b, P, dir, 1);
}
/* Étincelles, éclats ou jus au point d'impact (pas de trou de balle : le prop bouge) */
function propHitFx(b, P, dir) {
  const n = _ph2.copy(dir).negate(), d = b.d;
  if (d.snd === 'fruit') {
    const t = b.tintRaw || [1, 0.5, 0.1];
    for (let i = 0; i < 7; i++) FX.smoke.spawn(P.x, P.y, P.z, rand(-1.5, 1.5) + dir.x * 2, rand(0.5, 3), rand(-1.5, 1.5) + dir.z * 2, rand(0.35, 0.7), 0.035, 0.02, t[0], t[1], t[2], 1, 0.6, 12, 0.6);
    FX.smoke.spawn(P.x, P.y, P.z, dir.x * 0.5, 0.3, dir.z * 0.5, 0.6, 0.1, 0.35, t[0], t[1] * 0.9, t[2] * 0.8, 0.45, 0, 0, 1.5);
  } else impactFx(P, n, d.mat, false, true);
  if (Math.random() < 0.6) sfxImpact(P, d.mat === 'snow' ? 'snow' : d.snd === 'clay' ? 'concrete' : d.mat);
}
/* Explosion en p, rayon radius, dégâts maxDmg au centre : tous les props touchés sont soulevés, éloignés, parfois cassés */
function propBlast(p, radius, maxDmg) {
  if (!PHYS.live) return;
  for (const b of PHYS.bodies) {
    if (b.state === 0) continue;
    const dx = b.p.x - p.x, dy = b.p.y - p.y, dz = b.p.z - p.z, dist = hyp3(dx, dy, dz), reach = radius + b.rad * 0.5;
    if (dist > reach) continue;
    // à couvert derrière un mur : rien (le rayon vise la surface du corps, sans compter le corps lui-même). Ce qui se dresse tout près du corps est son
    // support, pas un abri : le souffle passe par-dessus l'étal et la caisse, on ne compte pas leur flanc (marge d'autant plus large que le corps est haut posé)
    const ex = dx, ey = dy - 0.3, ez = dz, el = hyp3(ex, ey, ez) || 1, tt = Math.max(0.05, el - b.rad * 0.6);
    const hh = rayWorld(p.x, p.y + 0.3, p.z, ex / el, ey / el, ez / el, tt, 2);
    if (hh && hh.t < tt - 0.1 - clamp(b.p.y - b.rad, 0.15, 1.1)) continue;
    const f = Math.pow(1 - dist / reach, 0.8), L = dist || 1;
    // un corps au repos qui résiste (mur de sacs, pile de caisses) ne cède qu'à un souffle assez fort, ou à des souffles répétés
    if (b.state === 1 && b.d.hold) { b.shock += maxDmg * f; if (b.shock < b.d.hold) continue; }
    if (!propWake(b, true)) continue;
    const dv = b.d.blast * f / Math.max(0.6, Math.cbrt(b.s)), up = 0.45 + b.d.lift * 0.35;
    b.vel.x += (dx / L) * dv; b.vel.z += (dz / L) * dv; b.vel.y += (dy / L * 0.5 + up) * dv;
    const sp = clamp(dv * 0.5 / Math.max(0.2, b.rad), 1, 18);
    b.w.x += rand(-1, 1) * sp; b.w.y += rand(-1, 1) * sp * 0.5; b.w.z += rand(-1, 1) * sp;
    b.still = 0;
    b.hp -= maxDmg * f;
    if (b.hp <= 0 && b.d.brk) propBreak(b, b.p, _ph3.set(dx / L, 0.4, dz / L).normalize(), 1.6);
  }
}

/* Corps de réserve d'un type de débris (le plus ancien est recyclé quand la réserve est épuisée) */
function propKid(par, type, off, s, kick) {
  const V = propVariant(propDef(type)), G = V.groups.get(par.cell);
  if (!G || !G.pool.length) return null;
  let k = G.pool.find((x) => x.state === 0);
  if (!k) { k = G.pool[0]; for (const x of G.pool) if (x.t0 < k.t0) k = x; }
  const ai = PHYS.awake.indexOf(k); if (ai >= 0) PHYS.awake.splice(ai, 1);
  k.setScale(s); k.state = 0; k.hp = Infinity;
  k.q.copy(par.q); propRot(k);
  const R = par.R, ps = par.s, c = par.d.com;
  // origine du prefab du parent dans le monde, puis position du prefab du débris
  const ox = par.p.x - (R[0] * c[0] + R[1] * c[1] + R[2] * c[2]) * ps, oy = par.p.y - (R[3] * c[0] + R[4] * c[1] + R[5] * c[2]) * ps, oz = par.p.z - (R[6] * c[0] + R[7] * c[1] + R[8] * c[2]) * ps;
  const kc = k.d.com, kr = k.R;
  k.p.set(ox + (R[0] * off[0] + R[1] * off[1] + R[2] * off[2]) * ps + (kr[0] * kc[0] + kr[1] * kc[1] + kr[2] * kc[2]) * s,
    oy + (R[3] * off[0] + R[4] * off[1] + R[5] * off[2]) * ps + (kr[3] * kc[0] + kr[4] * kc[1] + kr[5] * kc[2]) * s,
    oz + (R[6] * off[0] + R[7] * off[1] + R[8] * off[2]) * ps + (kr[6] * kc[0] + kr[7] * kc[1] + kr[8] * kc[2]) * s);
  k.vel.copy(par.vel).add(kick); k.w.set(rand(-1, 1) * 6, rand(-1, 1) * 6, rand(-1, 1) * 6);
  k.t0 = MATCH.time; k.need = true; k.still = 0; k.t = 0; k.snap.copy(k.p);
  k.state = 1; propWake(k, true);
  if (G.lazy && !G.on) { G.on = true; for (const m of G.meshes) m.visible = true; } // premier éclatement : le maillage des débris apparaît
  propWrite(k); G.attr.needsUpdate = true; propGroupBounds(G);
  return k;
}
/* Le prop éclate : lui-même disparaît, ses débris partent depuis ses morceaux. dir : direction du coup, k : violence */
function propBreak(b, P, dir, k) {
  const d = b.d; propRot(b);
  const burst = (pos, sp) => _ph4.set(pos[0] * b.s, pos[1] * b.s, pos[2] * b.s).applyQuaternion(b.q).normalize().multiplyScalar(sp);
  const kick = (pos, sp, extra = 0) => _ph5.copy(burst(pos, sp)).addScaledVector(dir, 2.2 * k + extra).add(_ph6.set(rand(-0.6, 0.6), rand(0.8, 2.2), rand(-0.6, 0.6)));
  propHide(b);
  if (d.brk === 'clay') {
    for (let i = 0; i < 6 + (d.rad > 0.5 ? 2 : 0); i++) {
      const off = [rand(-0.1, 0.1) * b.s, rand(0.02, 0.28) * b.s, rand(-0.1, 0.1) * b.s];
      propKid(b, 'shard', off, rand(0.7, 1.5), kick(off, rand(1.2, 2.6) * k));
    }
    propBreakFx('clay', b.p, k);
    sfxPropBreak(b.p, 'clay');
  } else if (d.brk === 'glass') {
    propBreakFx('glass', b.p, k);
    sfxPropBreak(b.p, 'glass');
  } else if (d.brk === 'snowman') {
    const parts = [['snowball', [0, 0.32, 0], 0.4, 1.4], ['snowball', [0, 0.9, 0], 0.3, 2.4], ['snowball', [0, 1.33, 0], 0.2, 3.2], ['snowHat', [0, 1.43, 0], 1, 3.6], ['carrot', [0, 1.33, 0.1], 1, 3.4],
      ['scarf', [0, 1.1, 0], 1, 2.6], ['twig', [-0.45, 1.15, 0], 1, 3.2], ['twig', [0.45, 1.15, 0], 1, 3.2]];
    for (const [type, off, s, sp] of parts) propKid(b, type, off, s, kick(off, sp * k, 1));
    propBreakFx('snow', b.p, k);
    sfxPropBreak(b.p, 'snow');
  }
}
function propBreakFx(kind, p, k) {
  if (kind === 'glass') { // éclats de verre : étincelles claires, pas de corps (une étagère de bouteilles en compterait des centaines)
    for (let i = 0; i < 10; i++) FX.add.spawn(p.x, p.y + 0.1, p.z, rand(-2.5, 2.5) * k, rand(0.5, 3), rand(-2.5, 2.5) * k, rand(0.2, 0.45), 0.03, 0.01, 2.2, 2.6, 2.8, 1, 0.2, 14, 1);
    FX.smoke.spawn(p.x, p.y + 0.1, p.z, 0, 0.3, 0, 0.7, 0.08, 0.4, 0.85, 0.9, 0.92, 0.25, 0, 0, 1.4, rand(-1, 1));
  } else if (kind === 'snow') {
    for (let i = 0; i < 14; i++) FX.smoke.spawn(p.x + rand(-0.3, 0.3), p.y + rand(0.2, 1.5), p.z + rand(-0.3, 0.3), rand(-2.5, 2.5), rand(0.5, 3), rand(-2.5, 2.5), rand(0.8, 1.6), 0.25, 1.2, 0.93, 0.95, 0.98, 0.7, 0, 0.3, 1.2, rand(-1, 1));
    for (let i = 0; i < 18; i++) FX.smoke.spawn(p.x, p.y + 0.9, p.z, rand(-4, 4), rand(0.5, 5), rand(-4, 4), rand(0.5, 1), 0.04, 0.02, 0.97, 0.98, 1, 1, 0.8, 9, 0.8);
  } else {
    const dust = [0.62, 0.45, 0.32];
    FX.smoke.spawn(p.x, p.y + 0.15, p.z, 0, 0.4, 0, 1.0, 0.2, 0.9, dust[0], dust[1], dust[2], 0.5, 0, 0, 1.6, rand(-1, 1));
    for (let i = 0; i < 9; i++) FX.smoke.spawn(p.x, p.y + 0.15, p.z, rand(-3, 3) * k, rand(0.5, 3.5), rand(-3, 3) * k, rand(0.4, 0.8), 0.04, 0.02, 0.72, 0.42, 0.28, 1, 0.8, 12, 0.5);
  }
}

/* ---------- Tirs : liaison avec fireRay et le réseau ---------- */
/* Tir local sur un prop : effet immédiat, puis annonce aux autres joueurs (leur propre copie du prop reçoit le même coup) */
function propShotLocal(b, P, dir, dmg, shooter) {
  propShot(b, P, dir, dmg);
  if (MATCH.online && shooter && (shooter.isPlayer || shooter.netBot))
    netEvent({ k: 'prop', n: b.id, x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), dx: +dir.x.toFixed(2), dy: +dir.y.toFixed(2), dz: +dir.z.toFixed(2), d: Math.round(dmg) }, shooter);
}
/* Coup annoncé par un autre joueur */
function propNetHit(ev) {
  const b = PHYS.bodies[ev.n | 0]; if (!b || b.state === 0 || !PHYS.ready) return;
  const P = new V3(clamp(+ev.x || 0, -200, 200), clamp(+ev.y || 0, -10, 60), clamp(+ev.z || 0, -200, 200)), dir = new V3(+ev.dx || 0, +ev.dy || 0, +ev.dz || 0);
  if (dir.lengthSq() < 1e-6) return;
  // le corps a pu s'écarter de sa place chez l'autre joueur : le coup compte quand même (points de vie, éclatement), au centre
  if (P.distanceTo(b.p) > b.rad + 1.5) P.copy(b.p);
  propShot(b, P, dir.normalize(), clamp(+ev.d || 0, 1, 300));
}

/* ---------- Objets suspendus : pendules (le seau du puits de Meltem) ----------
   Un groupe (corde et charge) pend d'un pivot fixe. Deux angles d'inclinaison (autour de x et de z) suivent l'équation du pendule
   (g / l sin θ, amortissement léger), à pas fixes de 1/120 s ; un troisième, la torsion autour de la corde, revient lentement. Une balle qui
   passe sur la charge ou sur la corde la pousse au point touché sans s'y arrêter (bois mince, chanvre) ; une explosion la repousse ; le meltem
   l'agite à peine. Des butées (montants de la potence) renvoient la charge. Cosmétique : chaque pair simule les siens, ses propres tirs
   sont annoncés (événement « hang », au plus cinq par seconde) pour que tous voient le seau partir du même côté. */
const HANGS = [];
const _hg1 = new V3(), _hg2 = new V3(), _hg3 = new V3();
/* g : groupe posé au pivot (la corde descend le long de -y), body : son enfant tourné par la torsion ; l : longueur du pivot au centre de la
   charge ; o : r (rayon de la charge), top (longueur de corde nue au-dessus de la charge), mat (matière d'impact), lim : butées [x-, x+, z-, z+] (rad) */
function hangAdd(g, body, l, o = {}) {
  g.rotation.order = 'XZY';
  const h = { g, body, l, r: o.r || 0.15, top: o.top !== undefined ? o.top : l * 0.7, mat: o.mat || 'wood', lim: o.lim || [-1, 1, -1, 1], ax: 0, az: 0, tw: 0, vx: 0, vz: 0, vt: 0, ph: HANGS.length * 1.7, acc: 0, netT: -9 };
  HANGS.push(h);
  return h;
}
function hangsClear() { HANGS.length = 0; }
/* Centre de la charge dans le monde */
function hangCenter(h, out) { return out.set(0, -h.l, 0).applyEuler(h.g.rotation).add(h.g.position); }
/* Coup en P (dans le monde), direction dir, vitesse donnée au point touché dv (m/s) */
function hangPush(h, P, dir, dv) {
  const p = h.g.position, rx = P.x - p.x, ry = P.y - p.y, rz = P.z - p.z, arm = Math.max(0.2, hyp3(rx, ry, rz));
  const hx = dir.x, hz = dir.z, hl = hyp(hx, hz) || 1, k = (dv * arm) / (h.l * h.l); // moment de l'impulsion sur l'inertie m l² : un coup sur la corde, près du pivot, la remue à peine
  h.vz += (hx / hl) * k * Math.min(1, hl * 1.4); // tourner autour de +z mène la charge vers +x
  h.vx -= (hz / hl) * k * Math.min(1, hl * 1.4); // autour de +x, vers -z
  const C = hangCenter(h, _hg3), off = (P.x - C.x) * hz - (P.z - C.z) * hx; // un coup décentré fait tourner la charge sur sa corde
  h.vt += clamp(off / Math.max(0.05, h.r), -1, 1) * dv * 2.2;
}
/* Rayon contre les objets suspendus jusqu'à maxT : chaque charge ou corde traversée reçoit le coup (la balle continue) */
function hangShot(o, d, maxT, dmg, shooter) {
  for (let i = 0; i < HANGS.length; i++) {
    const h = HANGS[i], C = hangCenter(h, _hg1);
    let t = -1;
    // la charge : une sphère de rayon r
    const ox = o.x - C.x, oy = o.y - C.y, oz = o.z - C.z, b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - h.r * h.r, disc = b * b - c;
    if (disc >= 0) { const tt = -b - Math.sqrt(disc); if (tt > 0 && tt < maxT) t = tt; }
    // la corde : segment du pivot au haut de la charge, touché à 4 cm près
    if (t < 0) {
      const A = h.g.position, B = _hg2.copy(C).sub(A).multiplyScalar(h.top / h.l), bl = B.length(), ux = B.x / bl, uy = B.y / bl, uz = B.z / bl;
      const wx = o.x - A.x, wy = o.y - A.y, wz = o.z - A.z, dd = d.x * ux + d.y * uy + d.z * uz, den = 1 - dd * dd;
      if (den > 1e-6) {
        const dw = d.x * wx + d.y * wy + d.z * wz, uw = ux * wx + uy * wy + uz * wz, tr = (dd * uw - dw) / den, s = clamp((uw - dd * dw) / den, 0, bl);
        const px = o.x + d.x * tr - (A.x + ux * s), py = o.y + d.y * tr - (A.y + uy * s), pz = o.z + d.z * tr - (A.z + uz * s);
        if (tr > 0 && tr < maxT && px * px + py * py + pz * pz < 0.04 * 0.04) t = tr;
      }
    }
    if (t < 0) continue;
    const P = _hg2.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), dv = 1.1 * clamp(dmg / 30, 0.4, 3);
    hangPush(h, P, d, dv);
    impactFx(P, _hg3.copy(d).negate(), h.mat, false, true);
    if (Math.random() < 0.6) sfxImpact(P, h.mat);
    if (MATCH.online && shooter && (shooter.isPlayer || shooter.netBot) && MATCH.time - h.netT > 0.2) {
      h.netT = MATCH.time;
      netEvent({ k: 'hang', n: i, x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), dx: +d.x.toFixed(2), dy: +d.y.toFixed(2), dz: +d.z.toFixed(2), d: Math.round(dmg) }, shooter);
    }
  }
}
/* Coup annoncé par un autre joueur */
function hangNetHit(ev) {
  const h = HANGS[ev.n | 0]; if (!h) return;
  const P = new V3(+ev.x || 0, +ev.y || 0, +ev.z || 0), dir = new V3(+ev.dx || 0, +ev.dy || 0, +ev.dz || 0);
  if (dir.lengthSq() < 1e-6) return;
  if (P.distanceTo(h.g.position) > h.l + h.r + 0.5) hangCenter(h, P);
  hangPush(h, P, dir.normalize(), 1.1 * clamp(+ev.d / 30 || 1, 0.4, 3));
}
/* Souffle d'une explosion en p : la charge part à l'opposé, d'autant plus fort qu'elle est proche */
function hangBlast(p, radius) {
  for (const h of HANGS) {
    const C = hangCenter(h, _hg1), dx = C.x - p.x, dy = C.y - p.y, dz = C.z - p.z, dist = hyp3(dx, dy, dz);
    if (dist > radius * 1.2) continue;
    hangPush(h, C, _hg2.set(dx, dy, dz).normalize(), 5 * (1 - dist / (radius * 1.2)));
  }
}
/* Avance les pendules (appelée par mapUpdate, menus compris : la vue aérienne les montre) */
function updateHangs(dt, t) {
  if (!HANGS.length) return;
  const H = 1 / 120;
  for (const h of HANGS) {
    h.acc = Math.min(h.acc + Math.min(dt, 0.1), 0.1);
    const w2 = 9.81 / h.l, gust = 0.05 * Math.sin(t * 1.3 + h.ph) + 0.03 * Math.sin(t * 2.7 + h.ph * 2.1); // le meltem pousse vers l'est
    while (h.acc >= H) {
      h.acc -= H;
      h.vz += (-w2 * Math.sin(h.az) - 0.7 * h.vz + gust) * H; h.vx += (-w2 * Math.sin(h.ax) - 0.7 * h.vx + gust * 0.4) * H;
      h.vt += (-3 * h.tw - 0.8 * h.vt) * H;
      h.ax += h.vx * H; h.az += h.vz * H; h.tw += h.vt * H;
      // butées : la charge rebondit sur les montants de la potence
      if (h.ax < h.lim[0]) { h.ax = h.lim[0]; if (h.vx < 0) h.vx *= -0.35; } else if (h.ax > h.lim[1]) { h.ax = h.lim[1]; if (h.vx > 0) h.vx *= -0.35; }
      if (h.az < h.lim[2]) { h.az = h.lim[2]; if (h.vz < 0) h.vz *= -0.35; } else if (h.az > h.lim[3]) { h.az = h.lim[3]; if (h.vz > 0) h.vz *= -0.35; }
    }
    h.g.rotation.x = h.ax; h.g.rotation.z = h.az; h.body.rotation.y = h.tw;
  }
}
