/* ==========================================================================
   RELIEF ET ZONE RONDE : le sol en relief d'une carte qui le déclare (les dunes de Simoun), et le cercle hors duquel on meurt.
   Sans relief, le sol reste le plan implicite y = 0 des autres cartes ; sans zone, les bornes rectangulaires de la définition retiennent.
   - Relief (MAP_DEFS.<id>.relief = { fn(x, z) : hauteur, pad }) : une grille de hauteurs de 1 m couvre les bornes de la carte et pad m
     autour, échantillonnée au chargement (reliefBuild). Chaque case est coupée en deux triangles par sa diagonale (x0, z0)-(x1, z1) et
     reliefAt interpole sur ces triangles : c'est exactement le maillage affiché (reliefMesh), les pieds et les balles sont sur le sable
     qu'on voit. Hors de la grille, la hauteur de son bord. Tout le moteur lit le sol implicite par gy0(x, z) : groundHeight, rayWorld
     (reliefRay), la navigation, les props, les corps, les particules, les apparitions et l'éclairage cuit (la grille remplit le volume
     d'occlusion sous le sable).
   - reliefFlat : sous un objet posé (voiture, tente, cabane), le sable est aplani à sa hauteur moyenne et raccordé en pente douce ; le
     décor l'appelle avant de poser l'objet, si bien qu'aucun objet n'entre dans une dune ni ne flotte au-dessus d'un creux ;
   - reliefRay : rayon contre le relief, par tronçons de 4 m ; un tronçon qui passe au-dessus du point le plus haut de ses cases de 8 m
     (RELIEF.mx) est sauté, les autres sont parcourus par pas de 0,4 m puis affinés par dichotomie.
   - Zone ronde (MAP_DEFS.<id>.ring = { r, hard, t }) : hors du cercle de rayon r, l'écran s'assombrit et un compte à rebours de t s
     commence (ringCheck, appelé après le déplacement de chaque soldat local, comme voidCheck) ; à zéro, le soldat meurt (zoneDeath,
     NET_WSPECIAL.zone). Au-delà de hard m, on ne va pas plus loin (collideCircle). Les bots n'ont aucun nœud de navigation hors du cercle.
   ========================================================================== */
const RELIEF = { on: false, x0: 0, z0: 0, W: 0, H: 0, h: null, mc: 8, mW: 0, mH: 0, mx: null, fn: null, lock: null };
const RING = { on: false, x: 0, z: 0, r: 1e9, hard: 1e9, t: 10 };
/* Hauteur du sol implicite (relief, sinon 0) */
const gy0 = (x, z) => (RELIEF.on ? reliefAt(x, z) : 0);

/* Grille de hauteurs de la carte chargée (après mapSetup : bornes connues) ; D.relief absent : relief éteint */
function reliefBuild(D) {
  const R = RELIEF, P = D && D.relief;
  R.on = !!P; R.h = R.mx = R.lock = null; R.fn = null;
  RING.on = !!(D && D.ring); if (RING.on) Object.assign(RING, { x: 0, z: 0, t: 10 }, D.ring);
  if (!P) return;
  const pad = P.pad || 0;
  R.fn = P.fn; R.x0 = Math.floor(MAP.x0 - pad); R.z0 = Math.floor(MAP.z0 - pad);
  R.W = Math.ceil(MAP.x1 + pad) - R.x0; R.H = Math.ceil(MAP.z1 + pad) - R.z0;
  const n = R.W + 1, h = new Float32Array(n * (R.H + 1));
  for (let j = 0; j <= R.H; j++) for (let i = 0; i <= R.W; i++) h[j * n + i] = P.fn(R.x0 + i, R.z0 + j);
  R.h = h; R.lock = new Uint8Array(h.length);
  // hauteur maximale par case de mc m (bords compris) : les rayons qui passent au-dessus sautent la case
  R.mW = Math.ceil(R.W / R.mc); R.mH = Math.ceil(R.H / R.mc); R.mx = new Float32Array(R.mW * R.mH);
  reliefMaxUpdate(0, 0, R.mW - 1, R.mH - 1);
}
/* Recalcule la hauteur maximale des cases de mc m de (ci0, cj0) à (ci1, cj1) */
function reliefMaxUpdate(ci0, cj0, ci1, cj1) {
  const R = RELIEF, n = R.W + 1;
  for (let cj = Math.max(0, cj0); cj <= Math.min(R.mH - 1, cj1); cj++) for (let ci = Math.max(0, ci0); ci <= Math.min(R.mW - 1, ci1); ci++) {
    let m = -1e9;
    for (let j = cj * R.mc; j <= Math.min(R.H, (cj + 1) * R.mc); j++) for (let i = ci * R.mc; i <= Math.min(R.W, (ci + 1) * R.mc); i++) m = Math.max(m, R.h[j * n + i]);
    R.mx[cj * R.mW + ci] = m;
  }
}
/* Sol aplani sous un objet posé (voiture, tente, cabane, mirador) : le sable ne doit ni entrer dans l'objet ni le laisser en l'air. Rectangle de
   centre (cx, cz), demi-côtés hw (le long de x local) et hd (z local), tourné de rot comme Maker.rotY, agrandi de o.margin (0,4 m) : ramené à sa
   hauteur moyenne (o.y pour l'imposer), puis fondu vers le relief sur une largeur qui tient la pente sous 0,6 m par mètre (o.fade au moins,
   2,5 m). Une case déjà aplanie pour un autre objet ne bouge plus ; si le rectangle en recouvre, il prend leur hauteur. À appeler pendant la
   construction de la carte, avant de poser l'objet et avant reliefMesh (le maillage lit la grille). Rend la hauteur du sol aplani. */
function reliefFlat(cx, cz, hw, hd, rot = 0, o = {}) {
  const R = RELIEF; if (!R.on) return 0;
  const n = R.W + 1, m = o.margin !== undefined ? o.margin : 0.4, c = Math.cos(rot), s = Math.sin(rot), ex = hw + m, ez = hd + m;
  const dist = (x, z) => { const dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c; return hyp(Math.max(0, Math.abs(lx) - ex), Math.max(0, Math.abs(lz) - ez)); };
  const span = (r) => [Math.max(0, Math.floor(cx - r - R.x0)), Math.min(R.W, Math.ceil(cx + r - R.x0)), Math.max(0, Math.floor(cz - r - R.z0)), Math.min(R.H, Math.ceil(cz + r - R.z0))];
  // hauteur du dessous : celle des cases déjà aplanies qu'il recouvre, sinon la moyenne
  let [i0, i1, j0, j1] = span(hyp(ex, ez)), sum = 0, cnt = 0, lsum = 0, lcnt = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (dist(R.x0 + i, R.z0 + j) > 0) continue;
    const k = j * n + i; sum += R.h[k]; cnt++; if (R.lock[k]) { lsum += R.h[k]; lcnt++; }
  }
  if (!cnt) return reliefAt(cx, cz);
  const y = o.y !== undefined ? o.y : lcnt ? lsum / lcnt : sum / cnt;
  // largeur du fondu : la pente du raccord (au plus 1,5 fois l'écart sur la largeur, avec smoothstep) reste sous 0,6
  let gap = 0; [i0, i1, j0, j1] = span(hyp(ex, ez) + 2.5);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = dist(R.x0 + i, R.z0 + j); if (d > 0 && d <= 2.5) gap = Math.max(gap, Math.abs(R.h[j * n + i] - y)); }
  const F = Math.max(o.fade || 2.5, gap * 2.5);
  [i0, i1, j0, j1] = span(hyp(ex, ez) + F);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i, d = dist(R.x0 + i, R.z0 + j);
    if (d === 0) { R.h[k] = y; R.lock[k] = 1; } else if (!R.lock[k] && d < F) R.h[k] = lerp(R.h[k], y, 1 - smoothstep(0, F, d));
  }
  reliefMaxUpdate(Math.floor((i0 - 1) / R.mc), Math.floor((j0 - 1) / R.mc), Math.floor((i1 + 1) / R.mc), Math.floor((j1 + 1) / R.mc));
  return y;
}
function reliefFree() {
  RELIEF.on = false; RELIEF.h = RELIEF.mx = RELIEF.lock = null; RELIEF.fn = null; RING.on = false;
  if (WMU.tGround.value !== WMU.tGround.zero) { WMU.tGround.value.dispose(); WMU.tGround.value = WMU.tGround.zero; WMU.uGroundB.value.set(0, 0, 0, 0); }
}
/* Hauteurs du relief pour les shaders du décor (WMU.tGround, demi-flottants, un texel par point de la grille de 1 m), après la construction (les
   objets ont aplani le sable) : la crasse et la poussière du pied des murs se comptent depuis le sable. Le plus bas à 2 m à la ronde : sous un
   rocher, le relief monte (la congère qui grimpe sur son dos s'y prolonge), et le bandeau du pied tombait au milieu de la paroi */
function reliefGroundTex() {
  const R = RELIEF; if (!R.on || !R.h) return;
  const n = R.W + 1, m = R.H + 1, d = new Uint16Array(n * m), K = 2;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    let lo = 1e9;
    for (let b = Math.max(0, j - K); b <= Math.min(m - 1, j + K); b++) for (let a = Math.max(0, i - K); a <= Math.min(n - 1, i + K); a++) lo = Math.min(lo, R.h[b * n + a]);
    d[j * n + i] = THREE.DataUtils.toHalfFloat(lo);
  }
  const t = new THREE.DataTexture(d, n, m, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  if (WMU.tGround.value !== WMU.tGround.zero) WMU.tGround.value.dispose();
  WMU.tGround.value = t; WMU.uGroundB.value.set(R.x0 - 0.5, R.z0 - 0.5, 1 / n, 1 / m);
}
/* Hauteur du relief en (x, z), interpolée sur les deux triangles de la case */
function reliefAt(x, z) {
  const R = RELIEF;
  let u = x - R.x0, v = z - R.z0;
  if (u < 0) u = 0; else if (u > R.W - 1e-4) u = R.W - 1e-4;
  if (v < 0) v = 0; else if (v > R.H - 1e-4) v = R.H - 1e-4;
  const i = u | 0, j = v | 0, fu = u - i, fv = v - j, n = R.W + 1, k = j * n + i, h = R.h, h00 = h[k], h11 = h[k + n + 1];
  return fu >= fv ? h00 + (h[k + 1] - h00) * fu + (h11 - h[k + 1]) * fv : h00 + (h11 - h[k + n]) * fu + (h[k + n] - h00) * fv;
}
/* Normale du relief en (x, z) (différences centrées sur 0,5 m) dans out [x, y, z] */
function reliefNormal(x, z, out = [0, 1, 0]) {
  const sx = (reliefAt(x + 0.5, z) - reliefAt(x - 0.5, z)), sz = (reliefAt(x, z + 0.5) - reliefAt(x, z - 0.5)), l = hyp3(sx, 1, sz);
  out[0] = -sx / l; out[1] = 1 / l; out[2] = -sz / l;
  return out;
}
/* Hauteur maximale des cases de 8 m qui contiennent (x, z) ; hors de la grille, celle du bord */
function reliefMaxAt(x, z) {
  const R = RELIEF, ci = clamp(Math.floor((x - R.x0) / R.mc), 0, R.mW - 1), cj = clamp(Math.floor((z - R.z0) / R.mc), 0, R.mH - 1);
  return R.mx[cj * R.mW + ci];
}
/* Distance le long du rayon (direction unitaire) jusqu'au relief, ou -1 au-delà de maxD */
function reliefRay(ox, oy, oz, dx, dy, dz, maxD) {
  if (oy < reliefAt(ox, oz) - 0.05) return 0; // origine sous le sable : le rayon ne va nulle part
  const SEG = 4, ST = 0.4;
  for (let t0 = 0; t0 < maxD; t0 += SEG) {
    const t1 = Math.min(maxD, t0 + SEG), xa = ox + dx * t0, za = oz + dz * t0, xb = ox + dx * t1, zb = oz + dz * t1;
    const top = Math.max(reliefMaxAt(xa, za), reliefMaxAt(xb, zb), reliefMaxAt(xa, zb), reliefMaxAt(xb, za));
    if (Math.min(oy + dy * t0, oy + dy * t1) > top) continue;
    let ta = t0;
    for (let t = Math.min(t1, t0 + ST); ; t = Math.min(t1, t + ST)) {
      if (oy + dy * t <= reliefAt(ox + dx * t, oz + dz * t)) {
        let a = ta, b = t;
        for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (oy + dy * m <= reliefAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
        return b;
      }
      ta = t; if (t >= t1) break;
    }
  }
  return -1;
}

/* Un trou du sol (HOLES, le conduit d'un puits) est au milieu de cette case de 1 m de côté, de coin (x, z) ? */
function holeInCell(x, z) { for (const h of HOLES) if (h.x > x && h.x < x + 1 && h.z > z && h.z < z + 1) return true; return false; }
/* Maillage du relief dans l'atelier (matière du sol, splat compris) : la grille de 1 m sur le disque de rayon rIn (tuiles de 8 m, rangées
   par tronçon pour le culling), puis des anneaux de plus en plus lâches jusqu'à rOut, sur la fonction du relief (au-delà de la grille).
   Le bord intérieur des anneaux reprend la grille au rayon rIn : pas de couture. o : tint (sRGB), tintAt(x, z, h) (teinte linéaire par sommet :
   crêtes plus claires, creux plus sombres), ring (rangs des anneaux), seg (directions) */
function reliefMesh(rIn, rOut, o = {}) {
  const R = RELIEF, M = DECOR, n = R.W + 1, fn = R.fn, nv = (x, z, f) => { const sx = f(x + 0.5, z) - f(x - 0.5, z), sz = f(x, z + 0.5) - f(x, z - 0.5), l = hyp3(sx, 1, sz); return [-sx / l, 1 / l, -sz / l]; };
  M.save().color(o.tint || [1, 1, 1]).world(1); M.aoFn = null;
  // grille : tuiles de 8 m, une case n'est posée que si l'un de ses coins est dans le disque
  const T = 8, i0 = Math.max(0, Math.floor((-rIn - 1 - R.x0))), i1 = Math.min(R.W, Math.ceil(rIn + 1 - R.x0)), j0 = Math.max(0, Math.floor(-rIn - 1 - R.z0)), j1 = Math.min(R.H, Math.ceil(rIn + 1 - R.z0));
  const inD = (i, j) => { const x = R.x0 + i, z = R.z0 + j; return x * x + z * z <= rIn * rIn; };
  for (let tj = j0; tj < j1; tj += T) for (let ti = i0; ti < i1; ti += T) {
    const ie = Math.min(i1, ti + T), je = Math.min(j1, tj + T);
    let any = false;
    for (let j = tj; j < je && !any; j++) for (let i = ti; i < ie; i++) if (inD(i, j) || inD(i + 1, j) || inD(i, j + 1) || inD(i + 1, j + 1)) { any = true; break; }
    if (!any) continue;
    const B = M.buf('ground', R.x0 + (ti + ie) / 2, 0, R.z0 + (tj + je) / 2), ids = new Map();
    const vid = (i, j) => { const k = j * n + i; let v = ids.get(k); if (v === undefined) { const x = R.x0 + i, z = R.z0 + j, nn = nv(x, z, reliefAt); if (o.tintAt) M.tint = o.tintAt(x, z, R.h[k]); v = M.v(B, x, R.h[k], z, nn[0], nn[1], nn[2], x, -z); ids.set(k, v); } return v; };
    for (let j = tj; j < je; j++) for (let i = ti; i < ie; i++) {
      if (!(inD(i, j) || inD(i + 1, j) || inD(i, j + 1) || inD(i + 1, j + 1))) continue;
      if (HOLES.length && holeInCell(R.x0 + i, R.z0 + j)) continue; // la case d'un puits : le conduit descend dessous, la margelle la recouvre
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
      M.tri(B, a, c, b); M.tri(B, a, d, c);
    }
  }
  // anneaux : du contour de la grille (les cases posées vont jusqu'à rIn + 1,5 m) vers l'horizon, rangs resserrés près du bord
  const NU = o.seg || 192, rings = o.ring || 26, r0 = rIn - 0.5;
  for (let s = 0; s < NU; s++) {
    const a0 = (s / NU) * TAU, a1 = ((s + 1) / NU) * TAU, B = M.buf('ground', Math.cos((a0 + a1) / 2) * 200, 0, Math.sin((a0 + a1) / 2) * 200);
    let prev = null;
    for (let k = 0; k <= rings; k++) {
      const t = k / rings, r = r0 + (rOut - r0) * t * t;
      const row = [a0, a1].map((a) => {
        const x = Math.cos(a) * r, z = Math.sin(a) * r, f = r < rIn + 2 ? reliefAt : fn, nn = nv(x, z, f), y = f(x, z);
        if (o.tintAt) M.tint = o.tintAt(x, z, y);
        return M.v(B, x, y - (k === 0 ? 0.03 : 0), z, nn[0], nn[1], nn[2], x, -z);
      });
      if (prev) { M.tri(B, prev[0], row[1], row[0]); M.tri(B, prev[0], prev[1], row[1]); }
      prev = row;
    }
  }
  M.tint = null; M.restore();
}

/* ---------- Zone ronde : compte à rebours hors du cercle ---------- */
/* Après le déplacement d'un soldat local (joueur, bot de cette machine) : hors du cercle depuis RING.t s, il meurt. Rend vrai s'il vient
   de mourir. Le temps passé dehors (e.outT) se remet à zéro dès qu'il revient. */
function ringCheck(e, dt) {
  if (!RING.on || !e.alive) { e.outT = 0; return false; }
  const out = (e.pos.x - RING.x) ** 2 + (e.pos.z - RING.z) ** 2 > RING.r * RING.r;
  e.outT = out ? (e.outT || 0) + dt : 0;
  if (e.outT < RING.t || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return false;
  e.outT = 0; zoneDeath(e);
  return !e.alive;
}
/* Mort dans le désert : créditée, comme une chute dans le vide, au dernier adversaire qui l'a touché depuis moins de 5 s */
function zoneDeath(e) {
  if (!e.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  let a = e, best = -1;
  for (const [ent, t] of e.dmgBy) if (ent !== e && !allied(ent, e) && MATCH.time - t < 5 && t > best) { best = t; a = ent; }
  const dir = new V3(e.vel.x, 0, e.vel.z); if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); dir.normalize();
  if (!e.isPlayer) e.lastForce = { dir: dir.clone(), mag: 1, part: 'body' };
  killEnt(e, a, NET_WSPECIAL.zone, false, dir);
}
/* Écran du joueur hors de la zone : voile qui s'assombrit à mesure que le temps passe, message et secondes restantes */
const RINGHUD = { on: false, n: -1 };
function ringHud(e) {
  const el = $('ringOut'); if (!el) return;
  const show = RING.on && e && e.alive && (e.outT || 0) > 0;
  if (show !== RINGHUD.on) { RINGHUD.on = show; el.classList.toggle('show', show); RINGHUD.n = -1; }
  if (!show) return;
  const left = Math.max(0, RING.t - e.outT), n = Math.ceil(left);
  el.style.setProperty('--k', (0.45 + 0.5 * clamp(e.outT / RING.t, 0, 1)).toFixed(3));
  if (n !== RINGHUD.n) { RINGHUD.n = n; $('ringN').textContent = n; }
}
