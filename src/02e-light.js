/* ==========================================================================
   ÉCLAIRAGE CUIT : volume 3D (cellules de 0,5 m) calculé au chargement à partir des volumes d'occlusion (OCC).
   - r : part de ciel visible (seize rayons en hémisphère, pondération en cosinus), plus la lumière du ciel qui
     entre par les ouvertures et se diffuse dans les pièces (atténuation d'environ 16 % par mètre) ;
   - g : lumière du soleil renvoyée par les surfaces éclairées (sol, murs au soleil), diffusée dans l'air sans
     traverser les murs (relaxation sur une grille de 1 m) ;
   - b : part de ciel visible à la verticale (les quatre rayons les plus redressés, à moins de 30 degrés du zénith) :
     là où la neige tombe et tient. Une pièce aux grandes vitres voit beaucoup de ciel (r), mais pas au-dessus d'elle ;
   - a : soleil visible (un rayon vers le soleil) : l'ombre portée du soleil, cuite, à la place des cartes d'ombre quand elles sont coupées (NO_SHADOWS, 01-core.js).
   Lampes du décor (Maker.lamp, LAMPS) : leur lumière, arrêtée par les volumes d'occlusion, est cuite dans des couches empilées au-dessus du
   volume, dans la même texture (pas d'unité de texture en plus) : rgb, la lumière des lampes sur les 9 premiers mètres (uVolL).
   Les rayons sont lancés dans des Web Workers, en parallèle de la suite du chargement ; sans Worker, le calcul
   se fait sur place. Le résultat est une texture 3D lue par la matière du décor (voir WM_AO dans 02c-materials.js).
   ========================================================================== */
const LIGHT = { x0: -52, z0: -66, d: 0.5, nx: 208, nz: 264, ny: 36, nyL: 0, tex: null, ready: null, ms: 0, gen: 0 };
/* Éclairement le plus fort que gardent les couches des lampes (au-delà, il plafonne) */
const LAMP_MAX = 4;

/* Noyau de calcul autonome (copié tel quel dans les Workers : aucune référence extérieure) */
function lightBakeKernel(J) {
  const nx = J.nx, ny = J.ny, nz = J.nz, occ = J.occ, hdil = J.hdil, hmax = J.hmax, dirs = J.dirs, sun = J.sun, NXZ = nx * nz, K = dirs.length / 3;
  const levels = J.levels, sky = new Uint8Array(levels.length * NXZ), sunv = new Uint8Array(levels.length * NXZ), zen = new Uint8Array(levels.length * NXZ), t0 = Date.now();
  function march(x, y, z, dx, dy, dz, maxS, exitMap) {
    let T = 1;
    for (let s = 0; s < maxS; s++) {
      x += dx; y += dy; z += dz;
      if (y >= ny || x < 0 || x >= nx || z < 0 || z >= nz) return T;
      const ix = x | 0, iy = y | 0, iz = z | 0;
      if (y < 0) return 0;
      if (exitMap ? iy >= exitMap[iz * nx + ix] : iy >= hmax) return T;
      const op = occ[(iy * nz + iz) * nx + ix];
      if (op) { T *= 1 - op / 255; if (T < 0.03) return 0; }
    }
    return T;
  }
  for (let li = 0; li < levels.length; li++) {
    const iy = levels[li];
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const ci = (iy * nz + iz) * nx + ix, o = li * NXZ + iz * nx + ix;
      if (occ[ci] >= 128) continue;
      const x = ix + 0.5, y = iy + 0.5, z = iz + 0.5;
      let vis = 1, zv = 1;
      if (iy < hdil[iz * nx + ix]) {
        let s = 0, sz = 0;
        for (let k = 0; k < K; k++) { const t = march(x, y, z, dirs[k * 3], dirs[k * 3 + 1], dirs[k * 3 + 2], 44, hdil); s += t; if (k < 4) sz += t; }
        vis = s / K; zv = sz / 4;
      }
      sky[o] = Math.round(vis * 255); zen[o] = Math.round(zv * 255);
      sunv[o] = Math.round(march(x, y, z, sun[0], sun[1], sun[2], 150, null) * 255);
    }
  }
  return { levels, sky, sun: sunv, zen, ms: Date.now() - t0 };
}

/* Lance le calcul ; LIGHT.ready se résout quand la texture est prête. Le volume couvre la zone de jeu et 16 m autour, sur 18 m de haut ;
   une grande carte peut demander des cellules plus grandes (MAP_DEFS.<id>.light = { d } : 0,75 m pour Simoun, deux fois moins de mémoire
   qu'à 0,5 m). Le relief d'une carte en dunes (02-relief.js) remplit les cellules sous le sable : les dunes se font de l'ombre. */
function bakeLightStart() {
  const L = LIGHT, gen = ++L.gen, LD = CURMAP.def && CURMAP.def.light;
  L.d = (LD && LD.d) || 0.5; L.ny = Math.round(18 / L.d);
  L.x0 = MAP.x0 - 16; L.z0 = MAP.z0 - 16; L.nx = Math.round((MAP.x1 - MAP.x0 + 32) / L.d); L.nz = Math.round((MAP.z1 - MAP.z0 + 32) / L.d);
  const t0 = performance.now(), nx = L.nx, ny = L.ny, nz = L.nz, NXZ = nx * nz, d = L.d;
  const occ = new Uint8Array(nx * ny * nz);
  for (const b of OCC) {
    const op = Math.round(clamp(b.k === undefined ? 1 : b.k, 0, 1) * 255); if (!op) continue;
    const ix0 = Math.max(0, Math.floor((b.x0 - L.x0) / d + 0.15)), ix1 = Math.min(nx - 1, Math.ceil((b.x1 - L.x0) / d - 0.15) - 1);
    const iz0 = Math.max(0, Math.floor((b.z0 - L.z0) / d + 0.15)), iz1 = Math.min(nz - 1, Math.ceil((b.z1 - L.z0) / d - 0.15) - 1);
    const iy0 = Math.max(0, Math.floor(b.y0 / d + 0.15)), iy1 = Math.min(ny - 1, Math.ceil(b.y1 / d - 0.15) - 1);
    for (let iy = iy0; iy <= iy1; iy++) for (let iz = iz0; iz <= iz1; iz++) {
      const row = (iy * nz + iz) * nx;
      for (let ix = ix0; ix <= ix1; ix++) if (occ[row + ix] < op) occ[row + ix] = op;
    }
  }
  if (RELIEF.on) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { // sous le sable
    const top = Math.min(ny, Math.floor(reliefAt(L.x0 + (ix + 0.5) * d, L.z0 + (iz + 0.5) * d) / d));
    for (let iy = 0; iy < top; iy++) occ[(iy * nz + iz) * nx + ix] = 255;
  }
  // hauteur occupée par colonne (en cellules), puis dilatée sur 8 m : au-dessus, plus rien ne masque le ciel
  const hcol = new Uint8Array(NXZ); let hmax = 0;
  for (let iy = 0; iy < ny; iy++) for (let i = 0; i < NXZ; i++) if (occ[iy * NXZ + i] >= 128) { hcol[i] = iy + 1; if (iy + 1 > hmax) hmax = iy + 1; }
  const R = 16, tmp = new Uint8Array(NXZ), hdil = new Uint8Array(NXZ);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { let m = 0; for (let k = Math.max(0, ix - R); k <= Math.min(nx - 1, ix + R); k++) m = Math.max(m, hcol[iz * nx + k]); tmp[iz * nx + ix] = m; }
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { let m = 0; for (let k = Math.max(0, iz - R); k <= Math.min(nz - 1, iz + R); k++) m = Math.max(m, tmp[k * nx + ix]); hdil[iz * nx + ix] = m; }
  // seize directions réparties en cosinus sur l'hémisphère (spirale dorée), de la plus redressée à la plus rasante
  const K = 16, dirs = new Float32Array(K * 3);
  for (let k = 0; k < K; k++) { const u = (k + 0.5) / K, r = Math.sqrt(u), ph = k * 2.39996323; dirs[k * 3] = r * Math.cos(ph); dirs[k * 3 + 1] = Math.sqrt(1 - u); dirs[k * 3 + 2] = r * Math.sin(ph); }
  const sun = [SUN_DIR.x, SUN_DIR.y, SUN_DIR.z];
  // lampes du décor (Maker.lamp), en cellules : position, couleur fois puissance, portée, part rabattue vers le bas ; leurs couches couvrent les 9 premiers mètres
  const lamps = new Float32Array(LAMPS.length * 8);
  LAMPS.forEach((l, k) => lamps.set([(l.x - L.x0) / d, l.y / d, (l.z - L.z0) / d, l.c[0] * l.p, l.c[1] * l.p, l.c[2] * l.p, l.r / d, l.down || 0], k * 8));
  L.nyL = LAMPS.length ? Math.min(ny, Math.ceil(9 / d)) : 0;
  const nW = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  const jobs = []; for (let w = 0; w < nW; w++) { const lv = []; for (let iy = w; iy < ny; iy += nW) lv.push(iy); jobs.push(lv); }
  const base = { nx, ny, nz, occ, hdil, hmax, dirs, sun };
  let worker = null;
  try {
    const src = `self.onmessage = function (e) { const r = (${lightBakeKernel.toString()})(e.data); self.postMessage(r, [r.sky.buffer, r.sun.buffer, r.zen.buffer]); };`;
    worker = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  } catch (e) { worker = null; }
  const runJob = (levels) => new Promise((res) => {
    if (worker) {
      try {
        const wk = new Worker(worker);
        wk.onmessage = (e) => { wk.terminate(); res(e.data); };
        wk.onerror = () => { wk.terminate(); res(lightBakeKernel({ ...base, levels })); };
        wk.postMessage({ ...base, levels });
        return;
      } catch (e) { /* Worker refusé : calcul sur place */ }
    }
    res(lightBakeKernel({ ...base, levels }));
  });
  L.ready = Promise.all(jobs.map(runJob)).then((parts) => {
    L.tw = performance.now() - t0; L.wk = parts.map((p) => p.ms);
    const sky = new Uint8Array(nx * ny * nz), sunv = new Uint8Array(nx * ny * nz), zen = new Uint8Array(nx * ny * nz);
    for (const p of parts) p.levels.forEach((iy, li) => { const a = li * NXZ, b = (li + 1) * NXZ; sky.set(p.sky.subarray(a, b), iy * NXZ); sunv.set(p.sun.subarray(a, b), iy * NXZ); zen.set(p.zen.subarray(a, b), iy * NXZ); });
    // diffusion et assemblage : dans un Worker aussi (le fil principal continue le chargement)
    const J = { nx, ny, nz, occ, sky, sunv, zen, sun, lamps, nyL: L.nyL, d, lampMax: LAMP_MAX };
    return new Promise((res) => {
      let url = null;
      try { url = URL.createObjectURL(new Blob([`self.onmessage = function (e) { const r = (${lightDiffuseKernel.toString()})(e.data); self.postMessage(r, [r.buffer]); };`], { type: 'text/javascript' })); } catch (e) { url = null; }
      if (url) {
        try {
          const wk = new Worker(url);
          wk.onmessage = (e) => { wk.terminate(); URL.revokeObjectURL(url); res(e.data); };
          wk.onerror = () => { wk.terminate(); URL.revokeObjectURL(url); res(lightDiffuseKernel(J)); };
          wk.postMessage(J, [occ.buffer, sky.buffer, sunv.buffer, zen.buffer]);
          return;
        } catch (e) { /* calcul sur place */ }
      }
      res(lightDiffuseKernel(J));
    });
  }).then((out) => {
    if (worker) URL.revokeObjectURL(worker);
    if (gen !== L.gen) return null; // carte déchargée pendant le calcul
    lightFinish(out);
    L.ms = performance.now() - t0;
    return L.tex;
  });
  return L.ready;
}

/* Noyau autonome (Worker) : diffusion du ciel entrant et du soleil renvoyé sur une grille de 1 m, puis texture
   [ciel, rebond, ciel au zénith, soleil visible] en octets. Aucune référence extérieure. */
function lightDiffuseKernel(J) {
  const nx = J.nx, ny = J.ny, nz = J.nz, occ = J.occ, sky = J.sky, sunv = J.sunv, zen = J.zen;
  const cx = nx >> 1, cy = ny >> 1, cz = nz >> 1, CXZ = cx * cz, CN = CXZ * cy;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const solidC = new Uint8Array(CN), S = new Float32Array(CN), Q = new Float32Array(CN);
  const sx = J.sun[0], sy = J.sun[1], sz = J.sun[2];
  const solid = (ix, iy, iz) => iy < 0 || (ix >= 0 && ix < nx && iz >= 0 && iz < nz && iy < ny && occ[(iy * nz + iz) * nx + ix] >= 128);
  for (let y = 0; y < cy; y++) for (let z = 0; z < cz; z++) for (let x = 0; x < cx; x++) {
    let ns = 0, src = 0, sk = 0, na = 0;
    for (let k = 0; k < 8; k++) {
      const ix = x * 2 + (k & 1), iy = y * 2 + ((k >> 1) & 1), iz = z * 2 + (k >> 2), i = (iy * nz + iz) * nx + ix;
      if (occ[i] >= 128) { ns++; continue; }
      na++; sk += sky[i];
      const sv = sunv[i]; if (!sv) continue;
      // surface éclairée voisine : sol ou mur, pondérée par l'incidence du soleil
      let c = 0;
      if (solid(ix, iy - 1, iz)) c += sy;
      if (solid(ix - 1, iy, iz)) c += Math.max(0, sx); if (solid(ix + 1, iy, iz)) c += Math.max(0, -sx);
      if (solid(ix, iy, iz - 1)) c += Math.max(0, sz); if (solid(ix, iy, iz + 1)) c += Math.max(0, -sz);
      src += c * sv / 255;
    }
    const ci = (y * cz + z) * cx + x;
    solidC[ci] = ns >= 5 ? 1 : 0; S[ci] = src / 8; Q[ci] = na ? sk / na / 255 : 0;
  }
  // relaxation : le soleil renvoyé se diffuse (somme), le ciel se propage vers l'intérieur (maximum atténué)
  let B = Float32Array.from(S), B2 = new Float32Array(CN), P = Float32Array.from(Q), P2 = new Float32Array(CN);
  const nb = [1, -1, cx, -cx, CXZ, -CXZ];
  for (let it = 0; it < 24; it++) {
    for (let y = 0; y < cy; y++) for (let z = 0; z < cz; z++) for (let x = 0; x < cx; x++) {
      const ci = (y * cz + z) * cx + x;
      if (solidC[ci]) { B2[ci] = 0; P2[ci] = 0; continue; }
      let sb = 0, n = 0, pm = P[ci];
      for (let k = 0; k < 6; k++) {
        if ((k === 0 && x === cx - 1) || (k === 1 && x === 0) || (k === 2 && z === cz - 1) || (k === 3 && z === 0) || (k === 4 && y === cy - 1) || (k === 5 && y === 0)) continue;
        const j = ci + nb[k]; if (solidC[j]) continue;
        sb += B[j]; n++; if (P[j] * 0.87 > pm) pm = P[j] * 0.87;
      }
      B2[ci] = S[ci] + (n ? (sb / n) * 0.9 : 0); P2[ci] = pm;
    }
    const tb = B; B = B2; B2 = tb; const tp = P; P = P2; P2 = tp;
  }
  // normalisation du rebond (90e centile des cellules d'air près du sol)
  const vals = []; for (let z = 0; z < cz; z += 2) for (let x = 0; x < cx; x += 2) { const ci = z * cx + x; if (!solidC[ci]) vals.push(B[ci]); }
  vals.sort((a, b) => a - b); const bmax = Math.max(1e-3, vals[Math.floor(vals.length * 0.9)] || 1);
  const nyL = J.nyL || 0, out = new Uint8Array(nx * (ny + nyL) * nz * 4), DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
  for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const i = (iy * nz + iz) * nx + ix;
    // grille grossière : interpolation trilinéaire (centres des cellules de 1 m), cellules pleines ignorées
    const fx = ix * 0.5 - 0.25, fy = iy * 0.5 - 0.25, fz = iz * 0.5 - 0.25, x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz), tx = fx - x0, ty = fy - y0, tz = fz - z0;
    let b = 0, p = 0, w = 0;
    for (let k = 0; k < 8; k++) {
      const ox = k & 1, oy = (k >> 1) & 1, oz = k >> 2, X = clamp(x0 + ox, 0, cx - 1), Y = clamp(y0 + oy, 0, cy - 1), Z = clamp(z0 + oz, 0, cz - 1);
      const ci = (Y * cz + Z) * cx + X; if (solidC[ci]) continue;
      const wk = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty) * (oz ? tz : 1 - tz) + 1e-4;
      b += B[ci] * wk; p += P[ci] * wk; w += wk;
    }
    if (w > 0) { b /= w; p /= w; } else { b = B[((iy >> 1) * cz + (iz >> 1)) * cx + (ix >> 1)] || 0; p = 0; }
    let s = sky[i] / 255, zv = zen[i], sv = sunv[i];
    // cellule pleine : moyenne des cellules d'air voisines (la lecture trilinéaire près des murs ne s'assombrit pas)
    if (occ[i] >= 128) {
      let a = 0, az = 0, as = 0, n = 0;
      for (let k = 0; k < 6; k++) {
        const X = ix + DX[k], Y = iy + DY[k], Z = iz + DZ[k]; if (X < 0 || X >= nx || Y < 0 || Y >= ny || Z < 0 || Z >= nz) continue;
        const j = (Y * nz + Z) * nx + X; if (occ[j] >= 128) continue; a += sky[j] / 255; az += zen[j]; as += sunv[j]; n++;
      }
      s = n ? a / n : p; zv = n ? az / n : 0; sv = n ? as / n : 0;
    }
    s = Math.max(s, p * 0.92);
    out[i * 4] = Math.round(clamp(s, 0, 1) * 255);
    const bn = b / bmax; out[i * 4 + 1] = Math.round(clamp(bn / (1 + bn * 0.35) * 1.35, 0, 1) * 255);
    out[i * 4 + 2] = Math.round(zv); out[i * 4 + 3] = Math.round(sv); // a : soleil visible (ombre du soleil cuite, lue sans carte d'ombre, voir NO_SHADOWS)
  }
  // lampes (Maker.lamp) : nyL couches de plus au-dessus du volume (du sol à nyL cellules de haut), rgb = racine de l'éclairement sur LAMP_MAX.
  // La lumière va en ligne droite de la lampe à la cellule, les volumes d'occlusion l'arrêtent (murs, dalles) ; pas de rebond.
  if (nyL) {
    const lp = J.lamps, NL = nx * nz, E = new Float32Array(NL * nyL * 3), dd = J.d * J.d;
    for (let k = 0; k < lp.length; k += 8) {
      const lx = lp[k], ly = lp[k + 1], lz = lp[k + 2], R = lp[k + 6], R2 = R * R;
      const l0 = ly >= 0 && ly < ny && lx >= 0 && lx < nx && lz >= 0 && lz < nz ? (((ly | 0) * nz + (lz | 0)) * nx + (lx | 0)) : -1;
      const xa = Math.max(0, Math.floor(lx - R)), xb = Math.min(nx - 1, Math.ceil(lx + R)), za = Math.max(0, Math.floor(lz - R)), zb = Math.min(nz - 1, Math.ceil(lz + R));
      const ya = Math.max(0, Math.floor(ly - R)), yb = Math.min(nyL - 1, Math.ceil(ly + R));
      for (let iy = ya; iy <= yb; iy++) for (let iz = za; iz <= zb; iz++) for (let ix = xa; ix <= xb; ix++) {
        const dx = ix + 0.5 - lx, dy = iy + 0.5 - ly, dz = iz + 0.5 - lz, q2 = dx * dx + dy * dy + dz * dz;
        if (q2 > R2) continue;
        const i = (iy * nz + iz) * nx + ix; if (occ[i] >= 128) continue;
        // rayon par demi-cellules ; chaque cellule traversée compte une fois, ni celle de la lampe (son boîtier) ni la cellule visée
        const n = Math.ceil(Math.sqrt(q2) * 2); let T = 1, prev = -1;
        for (let st = 1; st < n && T > 0.03; st++) {
          const t = st / n, j = (((ly + dy * t) | 0) * nz + ((lz + dz * t) | 0)) * nx + ((lx + dx * t) | 0);
          if (j === prev || j === i || j === l0) continue;
          prev = j; const op = occ[j]; if (op) T *= 1 - op / 255;
        }
        if (T <= 0.03) continue;
        // abat-jour : sous l'ampoule la lumière est rabattue (jusqu'à 2,5 fois plus forte à la verticale), au-dessus il n'en reste que 1 - down
        const dn = lp[k + 7], u = q2 / R2, w = 1 - u * u, o = i * 3;
        const f = ((T * w * w) / (q2 * dd + 0.35)) * (1 - dn + dn * 2.5 * Math.max(0, -dy / Math.sqrt(q2 + 1e-6)));
        E[o] += lp[k + 3] * f; E[o + 1] += lp[k + 4] * f; E[o + 2] += lp[k + 5] * f;
      }
    }
    // cellule pleine : moyenne des cellules d'air voisines (la lecture trilinéaire près des murs ne s'assombrit pas), puis en octets
    const base = nx * ny * nz * 4, LM = J.lampMax;
    for (let iy = 0; iy < nyL; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const i = (iy * nz + iz) * nx + ix; let r = E[i * 3], g = E[i * 3 + 1], b = E[i * 3 + 2];
      if (occ[i] >= 128) {
        r = g = b = 0; let n = 0;
        for (let k = 0; k < 6; k++) {
          const X = ix + DX[k], Y = iy + DY[k], Z = iz + DZ[k]; if (X < 0 || X >= nx || Y < 0 || Y >= nyL || Z < 0 || Z >= nz) continue;
          const j = (Y * nz + Z) * nx + X; if (occ[j] >= 128) continue; r += E[j * 3]; g += E[j * 3 + 1]; b += E[j * 3 + 2]; n++;
        }
        if (n) { r /= n; g /= n; b /= n; }
      }
      const o = base + i * 4;
      out[o] = Math.round(Math.sqrt(Math.min(r / LM, 1)) * 255); out[o + 1] = Math.round(Math.sqrt(Math.min(g / LM, 1)) * 255);
      out[o + 2] = Math.round(Math.sqrt(Math.min(b / LM, 1)) * 255); out[o + 3] = 255;
    }
  }
  return out;
}
/* Texture 3D du volume et réglages de la matière du décor */
function lightFinish(out) {
  const L = LIGHT, nx = L.nx, ny = L.ny, nz = L.nz;
  const tex = new THREE.Data3DTexture(out, nx, nz, ny + L.nyL);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1; tex.needsUpdate = true;
  L.tex = tex;
  WMU.tVol.value = tex;
  WMU.uVolMin.value.set(L.x0, 0, L.z0);
  WMU.uVolInv.value.set(1 / (nx * L.d), 1 / (ny * L.d), 1 / (nz * L.d)); WMU.uVolNo.value = Math.max(0.32, L.d * 0.72); // 0,36 m en cellules de 0,5 m, 0,54 en 0,75
  // couches des lampes empilées au-dessus du volume (voir uVolL dans 02c-materials.js) ; force des lampes de la carte (atmo.lamps)
  const lk = CURMAP.def.atmo.lamps !== undefined ? CURMAP.def.atmo.lamps : 1;
  WMU.uVolL.value.set(L.nyL ? LAMP_MAX * lk : 0, ny, L.nyL, ny + L.nyL);
  // lumière du soleil renvoyée par le sol et les murs (couleur du soleil, atténuée par l'albédo moyen ; voir l'ambiance de la carte)
  WMU.uBounce.value.setRGB(...CURMAP.def.atmo.bounce);
  L.data = out;
}
/* Déchargement de la carte : volume libéré, calcul en cours ignoré */
function lightUnload() {
  const L = LIGHT; L.gen++;
  if (L.tex) L.tex.dispose();
  L.tex = null; L.data = null; L.ready = null; WMU.tVol.value = null; WMU.uVolL.value.set(0, 1, 0, 1); L.nyL = 0;
}
/* Lumière des lampes du décor au point (x, y, z), lue sur le processeur dans les couches des lampes : éclairement rangé dans la couleur c */
function lampAt(x, y, z, c) {
  const L = LIGHT; if (!L.data || !L.nyL) return c.setRGB(0, 0, 0);
  const ix = clamp(Math.floor((x - L.x0) / L.d), 0, L.nx - 1), iy = clamp(Math.floor(y / L.d), 0, L.nyL - 1), iz = clamp(Math.floor((z - L.z0) / L.d), 0, L.nz - 1);
  const i = (((L.ny + iy) * L.nz + iz) * L.nx + ix) * 4, k = WMU.uVolL.value.x / 65025;
  return c.setRGB(L.data[i] * L.data[i] * k, L.data[i + 1] * L.data[i + 1] * k, L.data[i + 2] * L.data[i + 2] * k);
}
/* Lecture sur le processeur (soldats, objets mobiles) : [ciel, rebond] de 0 à 1 */
function lightAt(x, y, z) {
  const L = LIGHT; if (!L.data) return [1, 0];
  const ix = clamp(Math.floor((x - L.x0) / L.d), 0, L.nx - 1), iy = clamp(Math.floor(y / L.d), 0, L.ny - 1), iz = clamp(Math.floor((z - L.z0) / L.d), 0, L.nz - 1);
  const i = ((iy * L.nz + iz) * L.nx + ix) * 4;
  return [L.data[i] / 255, L.data[i + 1] / 255];
}
