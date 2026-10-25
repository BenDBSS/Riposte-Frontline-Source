/* ==========================================================================
   RAGDOLLS : le corps d'un soldat mort.
   15 points (les articulations de l'animation, voir 06b-soldier.js) reliés par des barres rigides, simulés par
   positions (PBD) en petits pas. Ce qui donne du poids au corps :
   - des masses réalistes (le buste et le bassin pèsent, les mains ne pèsent rien) : les membres ballottent autour d'un
     tronc qui bouge peu ;
   - un vrai frottement de Coulomb (adhérence au repos, glissement freiné) : un corps couché ne glisse jamais tout seul,
     et un corps lancé s'arrête vite ;
   - une impulsion de tir répartie sur le corps (le haut part plus vite que les pieds, qui accrochent le sol : le corps
     bascule au lieu de voler) et des genoux qui lâchent ;
   - aucun rebond, un choc sourd et un peu de poussière quand le corps s'écrase (sfxBodyFall, bodyDustFx) ;
   - un sommeil décidé sur l'immobilité réelle, jamais sur un compte à rebours.
   Les collisions sont balayées : un point qui entre dans une boîte ressort par la face d'où il vient, jamais de
   l'autre côté, et le sol ne le hisse pas sur une caisse voisine.
   ========================================================================== */
const RAG_RIGID = [[0, 1], [1, 2], [1, 3], [1, 6], [3, 6], [3, 4], [4, 5], [6, 7], [7, 8], [0, 9], [0, 12], [9, 12], [9, 10], [10, 11], [12, 13], [13, 14], [3, 0], [6, 0], [9, 1], [12, 1], [2, 3], [2, 6], [3, 12], [6, 9]];
const RAG_MIN = [[3, 5, 0.24], [6, 8, 0.24], [9, 11, 0.5], [12, 14, 0.5], [2, 0, 0.62], [11, 14, 0.16], [10, 13, 0.16], [5, 2, 0.18], [8, 2, 0.18], [5, 8, 0.1], [4, 0, 0.2], [7, 0, 0.2], [5, 1, 0.2], [8, 1, 0.2]];
/* rayon de contact de chaque point (l'épaisseur du corps : gilet, cuisses, bottes), puis ceux des deux bouts de l'arme */
const RAG_RAD = [0.15, 0.17, 0.13, 0.09, 0.065, 0.055, 0.09, 0.065, 0.055, 0.09, 0.075, 0.07, 0.09, 0.075, 0.07, 0.05, 0.035];
/* masse relative (kg d'un homme équipé, ramenés à ses points) : tronc 36 %, cuisses 12 %, mains et pieds presque rien */
const RAG_MASS = [10, 14, 5, 3, 2, 1, 3, 2, 1, 6, 3.5, 1.8, 6, 3.5, 1.8, 1.2, 0.8];
/* articulations à sens unique : [attache, articulation, extrémité, sens] ; sens 1 : l'articulation reste devant la corde
   (genou) ; le contraire serait une hyperextension. Pas de butée au coude : l'avant-bras se replie dans tous les sens
   selon la pose, et la butée y faisait trembler le bras. */
const RAG_HINGE = [[J_HIL, J_KNL, J_FTL, 1], [J_HIR, J_KNR, J_FTR, 1]];
/* points qui encaissent la chute (bassin, buste, tête, hanches) : leur choc est entendu et soulève la poussière */
const RAG_HEAVY = [J_PEL, J_CHE, J_HEAD, J_HIL, J_HIR];
const RAG = {
  hMax: 1 / 120,      // pas maximal (s) : l'image est découpée en pas égaux, 2 à 60 images par seconde
  g: 24,              // pesanteur (m/s2) : plus forte que 9,8, le corps tombe comme un poids mort
  drag: 0.35,         // résistance de l'air (1/s)
  slow: 5,            // résistance supplémentaire aux mouvements lents (1/s)
  vMax: 11,           // vitesse maximale d'un point (m/s) : ni tunnel dans un mur ni projection absurde
  iters: 5,           // passes de contraintes par pas
  hingeMax: 0.004,    // correction maximale d'une butée d'articulation par passe (m)
  mu: 0.85, muK: 0.55, // frottement d'adhérence et de glissement
  stick: 0.12,        // adhérence minimale (m/s) : une glisse plus lente que ça est annulée au contact (un corps adossé à un mur ne s'affaisse pas en douce)
  stairs: 1.8,        // les rampes sont des escaliers : les marches retiennent le corps (frottement multiplié)
  bounce: 0.04, bounceWall: 0.1, // rebonds (quasi nuls)
  knock: 0.8,         // vitesse du haut du corps = force du tir x knock (m/s)
  sleepD: 0.006, sleepT: 0.4, maxT: 12, // sommeil : moins de 6 mm en 0,1 s pendant 0,4 s
};
const _rg = { a: new V3(), b: new V3(), n: new V3(), f: new V3(), r: new V3(), u: new V3() };

/* Lancement du ragdoll d'un soldat qui vient de mourir (e.lastForce : { dir, mag, lift, part, radial }) */
function startRagdoll(e) {
  const S = e.model, f = e.lastForce, J = S.J, Jp = S.Jp;
  const gun = !!S.gun && S.gun.visible !== false, n = gun ? 17 : 15;
  const R = S.rag = { n, p: [], v: [], q: [], vin: [], hit: new Int8Array(n), fr: new Float32Array(n), dep: new Float64Array(n), nx: new Float64Array(n), ny: new Float64Array(n), nz: new Float64Array(n),
    links: gun ? RAG_RIGID.concat([[15, 16]]) : RAG_RIGID, rest: [], boxes: [], ramps: [], snap: [], snapT: 0, t: 0, still: 0, sleep: false, thud: 0, dust: 1 };
  for (let i = 0; i < 15; i++) R.p.push(J[i].clone());
  // vitesse héritée de l'animation (course, chute, recul) : plafonnée, un peu amortie
  const pdt = S.pdt || 1 / 60;
  for (let i = 0; i < 15; i++) {
    const v = _rg.a.subVectors(J[i], Jp[i]).multiplyScalar(0.85 / pdt), s = v.length();
    R.v.push(s > 6 ? v.multiplyScalar(6 / s).clone() : v.clone());
  }
  if (gun) {
    S.gun.updateWorldMatrix(true, false);
    const a = S.gun.localToWorld(new V3(0, 0.02, 0.2)), b = S.gun.localToWorld(S.muzzleLocal.clone());
    R.p.push(a, b); R.v.push(R.v[J_HAR].clone(), R.v[J_HAR].clone());
  }
  for (let i = 0; i < n; i++) { R.q.push(R.p[i].clone()); R.vin.push(new V3()); }
  for (const [a, b] of R.links) R.rest.push(R.p[a].distanceTo(R.p[b]));
  // pose déjà enfoncée dans un mur (une main qui dépasse) : dégagée avant le premier affichage, sans claquement de membre
  ragBounds(R, 0.1);
  for (let it = 0; it < 12; it++) { ragLinks(R); for (let i = 0; i < n; i++) ragCollide(R, i); }
  for (let i = 0; i < n; i++) { R.q[i].copy(R.p[i]); R.snap.push(R.p[i].clone()); }
  ragKnock(e, R, f);
}

/* Le coup : vitesse répartie sur le corps. Le haut part plus vite que les pieds (qui accrochent le sol) : le corps
   bascule autour d'eux ; les genoux lâchent ; l'angle du tir décide de la chute (sur le dos, en avant, de côté). */
function ragKnock(e, R, f) {
  const P = R.p, V = R.v;
  if (!f) f = { dir: new V3(rand(-1, 1), 0, rand(-1, 1)), mag: 2, lift: 0.5, part: 'body' };
  const dir = _rg.a.set(f.dir.x, 0, f.dir.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
  const dx = dir.x, dz = dir.z, mag = f.mag;
  const idx = f.part === 'head' ? J_HEAD : f.part === 'legs' ? (Math.random() < 0.5 ? J_KNL : J_KNR) : J_CHE;
  const add = (i, x, y, z) => { V[i].x += x; V[i].y += y; V[i].z += z; };
  for (let i = 0; i < 15; i++) {
    const hi = clamp((P[i].y - e.pos.y) / 1.6, 0, 1);
    if (f.radial) {
      // explosion : tout le corps part, comme un sac jeté
      add(i, dx * mag * 0.85, f.lift * 0.8 * (0.75 + hi * 0.25), dz * mag * 0.85);
    } else {
      const near = Math.exp(-P[i].distanceTo(P[idx]) / 0.5), w = (0.3 + 0.7 * hi) * (0.8 + 0.4 * near);
      add(i, dx * mag * RAG.knock * w, f.lift * 0.1 * hi, dz * mag * RAG.knock * w);
    }
  }
  if (!f.radial) {
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), along = dx * fx + dz * fz, side = dx * fz - dz * fx;
    const up = [J_HEAD, J_CHE, J_SHL, J_SHR], low = [J_KNL, J_KNR, J_FTL, J_FTR];
    const m = Math.min(mag, 6.5) * clamp(1 - (mag - 5) * 0.12, 0.35, 1) * 0.5; // la rotation plafonne, la translation continue de croître avec l'arme
    if (along < -0.35) { for (const i of up) add(i, dx * m * 0.5, 0.3, dz * m * 0.5); for (const i of low) add(i, -dx * m * 0.1, 0, -dz * m * 0.1); } // de face : sur le dos
    else if (along > 0.35) { for (const i of up) add(i, dx * m * 0.6, -0.5, dz * m * 0.6); for (const i of low) add(i, -dx * m * 0.12, 0.15, -dz * m * 0.12); } // de dos : en avant
    else { // de côté : le corps pivote autour de l'axe vertical
      const spin = Math.sign(side || 1) * (1.2 + m * 0.5);
      for (const i of [J_SHL, J_SHR, J_ELL, J_ELR, J_HAL, J_HAR, J_HIL, J_HIR]) add(i, -(P[i].z - P[J_PEL].z) * spin, 0, (P[i].x - P[J_PEL].x) * spin);
      for (const i of up) add(i, dx * m * 0.3, 0.15, dz * m * 0.3);
    }
    if (f.part === 'head') { add(J_HEAD, dx * m * 1.1, 0.9, dz * m * 1.1); for (const i of [J_PEL, J_KNL, J_KNR]) add(i, 0, -1.2, 0); } // la tête part, les jambes lâchent
    else if (f.part === 'legs') { for (const i of low) add(i, dx * m * 1.0, 0.7, dz * m * 1.0); for (const i of up) add(i, -dx * m * 0.15, 0, -dz * m * 0.15); } // fauché
    // les jambes lâchent : d'autant plus que l'arme est légère (la poussée ne porte pas le corps)
    const buckle = lerp(1.7, 0.9, clamp((mag - 3) / 5, 0, 1));
    for (const i of [J_PEL, J_KNL, J_KNR, J_HIL, J_HIR]) add(i, 0, -buckle, 0);
    const tw = rand(-1, 1) * 1.0; for (const i of [J_SHL, J_SHR]) add(i, -(P[i].z - P[J_CHE].z) * tw, 0, (P[i].x - P[J_CHE].x) * tw);
  }
  // l'arme, si elle est encore dans les mains, est lâchée avec le bras
  if (R.n > 15) { V[15].addScaledVector(dir, mag * 0.3); V[16].addScaledVector(dir, mag * 0.3); }
}

/* Boîtes et rampes autour du corps, une seule requête par image : la marge couvre la distance parcourue pendant l'image */
function ragBounds(R, span) {
  const P = R.p; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < R.n; i++) { const p = P[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
  const m = 0.35 + RAG.vMax * span;
  R.boxes.length = 0; R.ramps.length = 0;
  for (const c of queryBoxes(x0 - m, z0 - m, x1 + m, z1 + m)) if (!c.ray && c.y1 > y0 - m && c.y0 < y1 + m) R.boxes.push(c);
  for (const rp of RAMPS) if (rp.x1 > x0 - m && rp.x0 < x1 + m && rp.z1 > z0 - m && rp.z0 < z1 + m) R.ramps.push(rp);
}

function ragTouch(R, i, pen, x, y, z) {
  R.hit[i] = 1;
  if (pen >= R.dep[i]) { R.dep[i] = pen; R.nx[i] = x; R.ny[i] = y; R.nz[i] = z; }
}
/* Contact d'un point avec le sol, les rampes et les boîtes : projection de la position, avec mémoire de la normale et de
   l'enfoncement (le frottement en dépend, voir ragStep). Sortie des boîtes par la face d'où le point vient. */
function ragCollide(R, i) {
  const p = R.p[i], q = R.q[i], r = RAG_RAD[i];
  // sol (y = 0 ; aucun au-dessus du vide) et rampes (la normale suit la pente : un corps tient sur un escalier, mais glisse sur une pente raide)
  let gy = VOID.on ? -1e9 : 0, sx = 0, sz = 0, ramp = false;
  if (RELIEF.on) { gy = reliefAt(p.x, p.z); sx = (reliefAt(p.x + 0.5, p.z) - reliefAt(p.x - 0.5, p.z)); sz = (reliefAt(p.x, p.z + 0.5) - reliefAt(p.x, p.z - 0.5)); ramp = true; } // dunes : la pente du sable
  for (const rp of R.ramps) {
    if (p.x < rp.x0 || p.x > rp.x1 || p.z < rp.z0 || p.z > rp.z1) continue;
    const h = rampHeight(rp, p.x, p.z);
    if (h > gy && h <= p.y + r + 0.35) { gy = h; ramp = true; const s = (rp.h1 - rp.h0) / (rp.axis === 'x' ? rp.x1 - rp.x0 : rp.z1 - rp.z0); sx = rp.axis === 'x' ? s : 0; sz = rp.axis === 'z' ? s : 0; }
  }
  if (ramp) {
    const il = 1 / Math.sqrt(1 + sx * sx + sz * sz), ux = -sx * il, uy = il, uz = -sz * il;
    const d = (p.y - gy) * uy - r;
    if (d < 0) { p.x -= ux * d; p.y -= uy * d; p.z -= uz * d; ragTouch(R, i, -d, ux, uy, uz); R.fr[i] = RAG.stairs; }
  } else if (!VOID.on && p.y - r < 0) { ragTouch(R, i, r - p.y, 0, 1, 0); p.y = r; }
  for (const c of R.boxes) {
    const x0 = c.x0 - r, x1 = c.x1 + r, y0 = c.y0 - r, y1 = c.y1 + r, z0 = c.z0 - r, z1 = c.z1 + r;
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || p.z < z0 || p.z > z1) continue;
    // face d'entrée : celle que le point a franchie depuis le début du pas ; à défaut (point né dans la boîte), la plus proche
    const mg = [x0 - q.x, q.x - x1, y0 - q.y, q.y - y1, z0 - q.z, q.z - z1], pen = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y, p.z - z0, z1 - p.z];
    if (c.y0 < 0.05) { mg[2] = -1e9; pen[2] = 1e9; } // boîte posée au sol : pas de sortie par en dessous
    let k = 0, best = -1e9;
    for (let a = 0; a < 6; a++) if (mg[a] > best) { best = mg[a]; k = a; }
    if (best < -0.004) { k = 0; for (let a = 1; a < 6; a++) if (pen[a] < pen[k]) k = a; }
    switch (k) {
      case 0: ragTouch(R, i, pen[0], -1, 0, 0); p.x = x0; break; case 1: ragTouch(R, i, pen[1], 1, 0, 0); p.x = x1; break;
      case 2: ragTouch(R, i, pen[2], 0, -1, 0); p.y = y0; break; case 3: ragTouch(R, i, pen[3], 0, 1, 0); p.y = y1; break;
      case 4: ragTouch(R, i, pen[4], 0, 0, -1); p.z = z0; break; default: ragTouch(R, i, pen[5], 0, 0, 1); p.z = z1;
    }
  }
}

/* Barres, distances minimales (pliures limites) et sens des articulations, résolues par masse */
function ragLinks(R) {
  const P = R.p, L = R.links, rest = R.rest;
  for (let k = 0; k < L.length; k++) {
    const a = L[k][0], b = L[k][1], pa = P[a], pb = P[b];
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const wa = 1 / RAG_MASS[a], wb = 1 / RAG_MASS[b], d = (len - rest[k]) / (len * (wa + wb));
    pa.x += dx * d * wa; pa.y += dy * d * wa; pa.z += dz * d * wa; pb.x -= dx * d * wb; pb.y -= dy * d * wb; pb.z -= dz * d * wb;
  }
  for (const [a, b, mn] of RAG_MIN) {
    const pa = P[a], pb = P[b], dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    if (len >= mn) continue;
    const wa = 1 / RAG_MASS[a], wb = 1 / RAG_MASS[b], d = (len - mn) / (len * (wa + wb));
    pa.x += dx * d * wa; pa.y += dy * d * wa; pa.z += dz * d * wa; pb.x -= dx * d * wb; pb.y -= dy * d * wb; pb.z -= dz * d * wb;
  }
  // avant du corps : (haut du buste) x (de la hanche gauche à la droite)
  const F = _rg.f, A = _rg.a, B = _rg.b;
  A.subVectors(P[J_CHE], P[J_PEL]); B.subVectors(P[J_HIR], P[J_HIL]); F.crossVectors(A, B);
  if (F.lengthSq() < 1e-8) return; F.normalize();
  for (const [a, k, b, s] of RAG_HINGE) {
    const pk = P[k], m = _rg.r.addVectors(P[a], P[b]).multiplyScalar(0.5), o = (pk.x - m.x) * F.x + (pk.y - m.y) * F.y + (pk.z - m.z) * F.z;
    // ramené vers la corde, au-delà c'est une hyperextension ; la correction est plafonnée par passe : une articulation pliée
    // du mauvais côté repasse en douceur (un genou ramené d'un coup fouetterait toute la jambe)
    if (o * s < 0) { const c = clamp(o * 0.3, -RAG.hingeMax, RAG.hingeMax); pk.x -= F.x * c; pk.y -= F.y * c; pk.z -= F.z * c; }
  }
}

/* Un pas de simulation de durée h : intégration, contraintes et contacts en alternance, puis frottement, rebond et
   vitesses déduites des positions. Dit si le corps touche quelque chose. */
function ragStep(R, h) {
  const P = R.p, V = R.v, Q = R.q, n = R.n, g = RAG.g * h, drag = Math.max(0, 1 - RAG.drag * h);
  for (let i = 0; i < n; i++) {
    const p = P[i], v = V[i];
    Q[i].copy(p);
    // les mouvements lents sont freinés bien plus que les rapides : un coude libre ne tourne pas des secondes autour de son axe
    const sl = v.length(), k = Math.max(0, drag - RAG.slow * h * (1 - smoothstep(0.4, 2.5, sl)));
    v.x *= k; v.y = v.y * k - g; v.z *= k;
    const s = v.length(); if (s > RAG.vMax) v.multiplyScalar(RAG.vMax / s);
    R.vin[i].copy(v); R.hit[i] = 0; R.dep[i] = 0; R.fr[i] = 1;
    p.addScaledVector(v, h);
  }
  for (let it = 0; it < RAG.iters; it++) {
    ragLinks(R);
    for (let i = 0; i < n; i++) ragCollide(R, i);
  }
  const inv = 1 / h; let grounded = false;
  for (let i = 0; i < n; i++) {
    const p = P[i], q = Q[i], v = V[i];
    if (R.hit[i]) {
      grounded = true;
      const nx = R.nx[i], ny = R.ny[i], nz = R.nz[i], d = Math.min(R.dep[i], 0.03);
      // frottement de Coulomb sur le déplacement du pas : adhérence sous mu x enfoncement, sinon glissement freiné
      const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, dn = dx * nx + dy * ny + dz * nz;
      const tx = dx - dn * nx, ty = dy - dn * ny, tz = dz - dn * nz, ts = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (ts > 1e-9) {
        const fr = R.fr[i], k = ts <= RAG.mu * fr * d + RAG.stick * h ? 1 : RAG.muK * fr * d / ts;
        p.x -= tx * k; p.y -= ty * k; p.z -= tz * k;
      }
      v.set((p.x - q.x) * inv, (p.y - q.y) * inv, (p.z - q.z) * inv);
      // rebond presque nul ; le choc d'un point lourd s'entend et soulève la poussière
      const vi = R.vin[i], vin = vi.x * nx + vi.y * ny + vi.z * nz, vn = v.x * nx + v.y * ny + v.z * nz;
      if (vin < -1.5) {
        const want = -vin * (ny > 0.7 ? RAG.bounce : RAG.bounceWall);
        if (vn < want) { v.x += nx * (want - vn); v.y += ny * (want - vn); v.z += nz * (want - vn); }
        if (R.thud <= 0 && ny > 0.7 && -vin > 2.2 && RAG_HEAVY.includes(i)) ragThud(R, p, -vin);
      }
    } else v.set((p.x - q.x) * inv, (p.y - q.y) * inv, (p.z - q.z) * inv);
  }
  R.thud -= h;
  return { grounded };
}
/* Choc d'un corps sur le sol : bruit sourd et poussière, au plus un par instant */
function ragThud(R, p, speed) {
  R.thud = 0.2;
  const k = clamp(speed / 7, 0.35, 1.2);
  sfxBodyFall(p, k);
  if (R.dust > 0) { R.dust--; bodyDustFx(p, k); }
}

function stepRagdoll(e, dt) {
  const S = e.model, R = S.rag; if (!R) return;
  R.t += dt;
  if (!R.sleep && dt > 0) {
    dt = Math.min(dt, 0.05);
    const ns = Math.max(1, Math.ceil(dt / RAG.hMax - 1e-6)), h = dt / ns;
    ragBounds(R, dt);
    for (let s = 0; s < ns; s++) {
      const r = ragStep(R, h);
      // sommeil : le corps n'a presque pas bougé (déplacement, pas vitesse : un point qui tremble de 1 mm ne compte pas)
      // pendant sleepT alors qu'il est posé, ou il dure trop longtemps pour rien
      R.snapT += h;
      if (R.snapT >= 0.1) {
        let far = 0;
        // l'arme (killcam du joueur) compte pour le sommeil pendant 3 s ; passé ce délai, elle glisse seule d'un bord de caisse sans retenir le corps
        for (let i = 0; i < R.n; i++) { const d = R.p[i].distanceTo(R.snap[i]); if (d > far && (i < 15 || R.t < 3)) far = d; R.snap[i].copy(R.p[i]); }
        R.still = r.grounded && far < RAG.sleepD ? R.still + R.snapT : 0; R.snapT = 0;
      }
      if (R.still > RAG.sleepT || R.t > RAG.maxT) {
        R.sleep = true;
        for (let i = 0; i < R.n; i++) R.v[i].set(0, 0, 0);
        break;
      }
    }
  }
  // tombé dans le vide : le corps disparaît (il ne s'endort pas en l'air sous les îles)
  if (VOID.on && R.p[0].y < VOID.kill) { R.sleep = true; e.voidDead = true; }
  for (let i = 0; i < 15; i++) S.J[i].copy(R.p[i]);
  if (R.n > 15) {
    const d = _rg.u.subVectors(R.p[16], R.p[15]).normalize();
    S.gun.position.copy(R.p[15]).addScaledVector(d, -0.2); S.gun.position.y -= S.sink;
    _pz.q.setFromUnitVectors(_rg.n.set(0, 0, -1), d);
    S.gun.quaternion.copy(_pz.q);
  }
}
