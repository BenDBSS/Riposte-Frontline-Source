/* Trous dans les murs et collisions plus grosses que l'objet : node fentes.js [--json]   (MAP=meltem ; PAGE=autre version construite ; TOP=40)
   Ce que le joueur voit et ce qu'il touche doivent coïncider. Le rendu est relevé avant son envoi au GPU (finalizeWorld enveloppé, comme
   zfight.js : le décor fusionné) avec les objets posés à part (MAPL.root, instances comprises), puis confronté aux boîtes de collision
   (COL) par des rayons :
   - FENTE : deux murs (boîtes d'au moins 2 m de haut et 0,8 m de long, hors props, vitres et volumes invisibles) séparés de 1 à 30 cm,
     face à face sur l'épaisseur d'un mur ou en coin, sans autre boîte qui arrête les balles dans l'écart ; si des rayons traversent l'écart
     sans toucher le rendu, on voit le jour à travers sans pouvoir y passer ;
   - PASSE-BALLE : le même écart, mais le rendu le bouche : le mur paraît plein alors que les balles et la vue des bots (rayWorld, sur les
     boîtes) passent au travers ;
   - TROU : sur un mur (au moins 2 m de haut et 1,5 m de long, posé au sol ou sur un plancher), une face par ailleurs couverte par le rendu
     (85 % au moins), où des rayons tirés de 25 cm devant elle (puis de 1 m et de 1,8 m : une paroi bombée peut avancer de plus de 25 cm) traversent tout le mur sans rien toucher (à plus de 10 cm des bouts de la face, 25 à un angle rentrant
     et pas seulement sur la rangée du haut), entourés de mur (au-dessus, ou des deux côtés pour un trou de 60 cm au plus : un pignon, une pente
     de toit, une arête arrondie ne sont pas des trous) : on voit à travers un mur qu'on ne peut pas traverser ;
   - MARGE : une boîte dont l'objet dessiné est en retrait de plus de 15 cm (face couverte à moins de 85 %, profondeur médiane du premier
     triangle à hauteur du corps, de 0,6 à 1,8 m), à moins de 1,5 m du réseau des bots : on bute sur du vide et les balles s'arrêtent dans l'air (tronc penché, coque bombée,
     poteau rond dans une boîte carrée). Une face collée à un autre volume ne compte pas.
   Rayons à l'horizontale, tous les 30 cm de 32 cm au-dessus du sol jusqu'à 2,4 m (décalés des jointures des maillages), tous les 5 cm le
   long d'une face. Vu en jouant : des yeux (1,6 m) d'un nœud du réseau principal à moins de 25 m, devant la face ou dans l'axe de la
   fente, sans boîte entre les deux (rayWorld).
   Sortie : les fentes, les passe-balles, les trous et les marges, du plus visible au moins visible ; code d'erreur s'il reste une fente, un
   passe-balle ou un trou visible. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'sable', TOP = +(process.env.TOP || 40);
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noMap: true, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate(async (map) => {
    const bufs = [], fin = finalizeWorld;
    window.finalizeWorld = function () { for (const b of WORLD.bufs.values()) if (b.g.ni) bufs.push({ P: b.g.P.slice(0, b.g.nv * 3), I: b.g.I.slice(0, b.g.ni) }); return fin.apply(this, arguments); };
    Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({}); // le réseau de navigation : d'où l'on voit
    // objets posés hors du décor fusionné (ils gardent leur géométrie), une copie par instance
    const merged = new Set(WORLD.meshes), v = new THREE.Vector3(); let objets = 0;
    MAPL.root.updateMatrixWorld(true);
    MAPL.root.traverse((o) => {
      if (!o.isMesh || merged.has(o) || o.isSkinnedMesh || !o.visible) return;
      const g = o.geometry, pa = g && g.attributes && g.attributes.position; if (!pa || !pa.array) return;
      const mats = []; if (o.isInstancedMesh) for (let k = 0; k < o.count; k++) { const m = new THREE.Matrix4(); o.getMatrixAt(k, m); mats.push(m.premultiply(o.matrixWorld)); } else mats.push(o.matrixWorld);
      const n = pa.count, I = g.index && g.index.array ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i);
      for (const M of mats) { const P = new Float32Array(n * 3); for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; } bufs.push({ P, I }); objets++; }
    });
    const inMap = (c) => c.x1 > MAP.x0 - 1 && c.x0 < MAP.x1 + 1 && c.z1 > MAP.z0 - 1 && c.z0 < MAP.z1 + 1;
    const solids = COL.filter((c) => !c.prop && !c.ray && !c.inv && c.m !== 'glass' && c.y1 - c.y0 >= 1.2 && inMap(c)); // une vitre se voit au travers
    const key = (i, j) => (i + 5000) * 100003 + j + 5000;
    // Möller-Trumbore, deux faces : distance le long du rayon, ou -1
    const hit = (o, d, L, P, I, t) => {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-9) return -1;
      const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < -1e-6 || u > 1 + 1e-6) return -1;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (w < -1e-6 || u + w > 1 + 1e-6) return -1;
      const s = (e2x * qx + e2y * qy + e2z * qz) * inv; return s >= 0 && s <= L ? s : -1;
    };
    // triangles par case de 1 m, seulement autour des boîtes examinées (le ciel, la mer et les très grands triangles ne sont jamais un mur)
    const near = new Set(); for (const c of solids) for (let i = Math.floor(c.x0 - 0.6); i <= Math.floor(c.x1 + 0.6); i++) for (let j = Math.floor(c.z0 - 0.6); j <= Math.floor(c.z1 + 0.6); j++) near.add(key(i, j));
    const TB = new Map(); let triangles = 0;
    for (let bi = 0; bi < bufs.length; bi++) {
      const { P, I } = bufs[bi];
      for (let t = 0; t < I.length; t += 3) {
        triangles++;
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const x0 = Math.floor(Math.min(P[a], P[b], P[c])), x1 = Math.floor(Math.max(P[a], P[b], P[c])), z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[c + 2])), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[c + 2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4000) continue;
        for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); if (!near.has(k)) continue; let l = TB.get(k); if (!l) TB.set(k, l = []); l.push(bi, t); }
      }
    }
    // premier triangle touché par un segment horizontal (cases traversées, de part et d'autre des limites)
    const cast = (o, d, L) => {
      const ks = new Set();
      for (let s = -0.05; s <= L + 0.05; s += 0.5) for (const e of [-0.02, 0.02]) { const x = o[0] + d[0] * Math.min(s, L) + (d[2] ? e : 0), z = o[2] + d[2] * Math.min(s, L) + (d[0] ? e : 0); ks.add(key(Math.floor(x), Math.floor(z))); }
      for (const e of [-0.02, 0.02]) ks.add(key(Math.floor(o[0] + d[0] * L + (d[2] ? e : 0)), Math.floor(o[2] + d[2] * L + (d[0] ? e : 0))));
      let best = -1;
      for (const k of ks) { const l = TB.get(k); if (!l) continue; for (let n = 0; n < l.length; n += 2) { const b = bufs[l[n]], s = hit(o, d, L, b.P, b.I, l[n + 1]); if (s >= 0 && (best < 0 || s < best)) best = s; } }
      return best;
    };
    const main = (id) => NAV.comp[id] === NAV.mainComp;
    // vu en jouant : yeux d'un nœud du réseau principal à moins de 25 m, dans un cône autour de l'axe donné, sans boîte entre les deux
    const seen = (x, y, z, ax, az, cosMin, both) => {
      let n = 0, best = null;
      for (let i = 0; i < NAV.count && n < 8; i++) {
        if (!main(i)) continue;
        const ex = NAV.nx[i], ey = NAV.ny[i] + 1.6, ez = NAV.nz[i], dx = x - ex, dy = y - ey, dz = z - ez, d = Math.hypot(dx, dy, dz);
        if (d > 25 || d < 0.3) continue;
        const f = -(dx * ax + dz * az) / Math.hypot(dx, dz); if ((both ? Math.abs(f) : f) < cosMin) continue;
        const r = rayWorld(ex, ey, ez, dx / d, dy / d, dz / d, d);
        if (!r || r.t > d - 0.3) { n++; if (!best || d < best[3]) best = [+ex.toFixed(1), +NAV.ny[i].toFixed(1), +ez.toFixed(1), +d.toFixed(1)]; }
      }
      return { vu: n, depuis: best };
    };
    const inBox = (x, y, z, self) => COL.some((c) => c !== self && !c.ray && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > c.y0 && y < c.y1);
    const box = (c) => [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((t) => +t.toFixed(2));

    /* ---- Fentes entre deux murs ---- */
    const G = new Map();
    solids.forEach((c, id) => { for (let i = Math.floor((c.x0 - 0.3) / 2); i <= Math.floor((c.x1 + 0.3) / 2); i++) for (let j = Math.floor((c.z0 - 0.3) / 2); j <= Math.floor((c.z1 + 0.3) / 2); j++) { const k = key(i, j); let l = G.get(k); if (!l) G.set(k, l = []); l.push(id); } });
    const pairs = new Set(), fentes = [], passe = [];
    const isWall = (c) => c.y1 - c.y0 >= 2 && Math.max(c.x1 - c.x0, c.z1 - c.z0) >= 0.8;
    const stopsBullets = (x, y, z, A, B) => COL.some((c) => c !== A && c !== B && !c.noRay && x >= c.x0 - 0.005 && x <= c.x1 + 0.005 && z >= c.z0 - 0.005 && z <= c.z1 + 0.005 && y >= c.y0 && y <= c.y1);
    for (const l of G.values()) for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
      const ia = Math.min(l[a], l[b]), ib = Math.max(l[a], l[b]), pk = ia * 1e6 + ib; if (pairs.has(pk)) continue; pairs.add(pk);
      const A = solids[ia], B = solids[ib], y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1); if (y1 - y0 < 0.8) continue;
      if (!isWall(A) || !isWall(B)) continue; // un poteau, un lampadaire près d'un mur : pas une fente
      const gx = Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1), gz = Math.max(A.z0, B.z0) - Math.min(A.z1, B.z1);
      let f = null; // écart (x0..x1, z0..z1) et direction de la vue à travers
      if (gx >= 0.01 && gx <= 0.3 && gz < -0.05 && -gz <= 1.2) f = { g: gx, x0: Math.min(A.x1, B.x1), x1: Math.max(A.x0, B.x0), z0: Math.max(A.z0, B.z0), z1: Math.min(A.z1, B.z1), d: [0, 0, 1] };
      else if (gz >= 0.01 && gz <= 0.3 && gx < -0.05 && -gx <= 1.2) f = { g: gz, x0: Math.max(A.x0, B.x0), x1: Math.min(A.x1, B.x1), z0: Math.min(A.z1, B.z1), z1: Math.max(A.z0, B.z0), d: [1, 0, 0] };
      else if (gx >= 0.01 && gz >= 0.01 && Math.hypot(gx, gz) <= 0.3) { const x0 = Math.min(A.x1, B.x1), x1 = Math.max(A.x0, B.x0), z0 = Math.min(A.z1, B.z1), z1 = Math.max(A.z0, B.z0), l2 = Math.hypot(x1 - x0, z1 - z0); f = { g: l2, x0, x1, z0, z1, d: [-(z1 - z0) / l2, 0, (x1 - x0) / l2], coin: true }; }
      if (!f) continue;
      const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
      if (stopsBullets(cx, Math.min(y1 - 0.2, y0 + 1.4), cz, A, B)) continue; // une autre boîte bouche l'écart
      let pass = 0, tot = 0; const hs = [];
      for (let y = y0 + 0.217; y <= Math.min(y1 - 0.1, y0 + 3); y += 0.3) for (const k of f.coin ? [0.5] : [0.25, 0.5, 0.75]) {
        const px = f.d[0] ? cx : f.x0 + (f.x1 - f.x0) * k, pz = f.d[0] ? f.z0 + (f.z1 - f.z0) * k : cz, L = f.coin ? 1.6 : (f.d[0] ? f.x1 - f.x0 : f.z1 - f.z0) + 0.8;
        const o = f.coin ? [px - f.d[0] * 0.8, y, pz - f.d[2] * 0.8] : [px - f.d[0] * (cx - f.x0 + 0.4), y, pz - f.d[2] * (cz - f.z0 + 0.4)];
        tot++; if (cast(o, f.d, L) < 0) { pass++; hs.push(+y.toFixed(2)); }
      }
      if (!pass) { passe.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), ecart: Math.round(f.g * 100), h: [+y0.toFixed(2), +y1.toFixed(2)], mats: A.m + '+' + B.m, ...seen(cx, Math.min(y1 - 0.2, y0 + 1.4), cz, f.d[0], f.d[2], 0.5, true) }); continue; }
      const s = seen(cx, hs[Math.floor(hs.length / 2)], cz, f.d[0], f.d[2], 0.5, true);
      fentes.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), ecart: Math.round(f.g * 100), h: [+y0.toFixed(2), +y1.toFixed(2)], rayons: pass + '/' + tot, mats: A.m + '+' + B.m, ...s });
    }

    /* ---- Faces : trous et marges ---- */
    const trous = [], marges = [];
    for (const c of solids) {
      const mur = c.y1 - c.y0 >= 2;
      for (const [ax, sg] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
        const f = ax === 'x' ? (sg < 0 ? c.x0 : c.x1) : (sg < 0 ? c.z0 : c.z1), u0 = ax === 'x' ? c.z0 : c.x0, u1 = ax === 'x' ? c.z1 : c.x1, th = ax === 'x' ? c.x1 - c.x0 : c.z1 - c.z0, len = u1 - u0;
        if (len < 0.15) continue;
        const d = ax === 'x' ? [-sg, 0, 0] : [0, 0, -sg], step = Math.max(0.05, len / 300);
        let tot = 0, cov = 0, top = -1e9, ui = -1; const through = [], depth = [], grid = new Map(); // grid : case (rang le long de la face, rangée) -> 1 couverte, 2 traversée
        { const [gx, gz] = ax === 'x' ? [f + sg * 0.3, (u0 + u1) / 2] : [(u0 + u1) / 2, f + sg * 0.3]; if (c.y0 > groundHeight(gx, gz, c.y0 + 0.3, 0.05) + 1) continue; } // boîte en l'air vue de ce côté (étage, toit) : hors de portée
        for (let u = u0 + 0.043; u <= u1 - 0.04; u += step) {
          ui++; let yi = -1;
          const at = (n) => (ax === 'x' ? [f + sg * n, u] : [u, f + sg * n]);
          const [gx, gz] = at(0.1), g = Math.max(c.y0, groundHeight(gx, gz, Math.min(c.y1, c.y0 + 2.5), 0.05));
          for (let y = g + 0.317; y <= Math.min(c.y1 - 0.05, g + 2.4); y += 0.3) {
            top = Math.max(top, y - g); yi++;
            const [px, pz] = at(0.08); if (inBox(px, y, pz, c)) continue; // face collée à un autre volume : cachée
            const [ox, oz] = at(0.25); tot++;
            const s = cast([ox, y, oz], d, 0.25 + th + 0.25);
            if (s >= 0 && s <= 0.6) { cov++; grid.set(ui * 64 + yi, 1); continue; }
            // paroi bombée de plus de 25 cm (roche, coque) : le rayon partait de dedans ; on le relance de 1 m puis de 1,8 m devant la face
            if (s < 0 && [1.0, 1.8].some((n) => { const [qx, qz] = at(n), s2 = cast([qx, y, qz], d, n + th + 0.25); return s2 >= 0 && s2 <= n - 0.25; })) { cov++; grid.set(ui * 64 + yi, 1); continue; }
            const corps = y - g > 0.55 && y - g < 1.9; // la marge ne compte qu'à hauteur du corps (sous une coque sur cales, on ne bute pas)
            if (s < 0) { through.push([u, y, corps, y - g, ui, yi]); grid.set(ui * 64 + yi, 2); } else if (corps) depth.push(s - 0.25);
          }
        }
        if (!tot || cov === tot) continue;
        const rate = cov / tot, mid = (u0 + u1) / 2, ctr = ax === 'x' ? [f + sg * 0.05, mid] : [mid, f + sg * 0.05];
        if (rate >= 0.85) {
          if (!mur || len < 1.5) continue;
          // à un angle rentrant (un autre volume prolonge la face), la paroi d'une roche s'y replie : 25 cm de marge au lieu de 10
          const rentre = (u) => inBox(...(ax === 'x' ? [f + sg * 0.3, c.y0 + 1.5, u] : [u, c.y0 + 1.5, f + sg * 0.3]), c);
          const m0 = rentre(u0 - 0.05) ? 0.25 : 0.1, m1 = rentre(u1 + 0.05) ? 0.25 : 0.1;
          const pts = through.filter(([u, , , h]) => u > u0 + m0 && u < u1 - m1 && h < top - 0.01); if (!pts.length) continue;
          pts.sort((a, b) => a[0] - b[0]);
          const runs = []; let r = null;
          for (const [u, y, , , i, j] of pts) { if (r && u - r.u1 <= step * 2.1) { r.u1 = u; r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y); r.n++; r.pts.push([i, j]); } else runs.push(r = { u0: u, u1: u, y0: y, y1: y, n: 1, pts: [[i, j]] }); }
          // un trou est entouré de mur : du mur au-dessus de lui, ou, s'il est étroit (60 cm au plus), du mur des deux côtés ; sinon c'est le
          // haut de la boîte qui dépasse de l'objet (pignon, pente de toit, parapet plus bas que sa boîte)
          const covered = (i, j) => grid.get(i * 64 + j) === 1;
          const enclosed = (q) => {
            const cols = new Map(); for (const [i, j] of q.pts) cols.set(i, Math.max(cols.has(i) ? cols.get(i) : -1, j));
            let above = 0; for (const [i, jm] of cols) { for (let j = jm + 1; j < 64; j++) { const v = grid.get(i * 64 + j); if (v === undefined) break; if (v === 1) { above++; break; } } }
            if (above >= cols.size * 0.6) return true;
            if (q.u1 - q.u0 > 0.6) return false;
            const i0 = Math.min(...cols.keys()), i1 = Math.max(...cols.keys()), rows = [...new Set(q.pts.map((t) => t[1]))];
            const side = (i) => rows.filter((j) => covered(i, j)).length >= rows.length * 0.6;
            return (side(i0 - 1) || side(i0 - 2)) && (side(i1 + 1) || side(i1 + 2));
          };
          for (const q of runs) {
            if (!enclosed(q) || q.pts.every(([, j]) => j === 0)) continue; // seulement la rangée du bas : un objet sur des cales, on voit dessous
            const um = (q.u0 + q.u1) / 2, [x, z] = ax === 'x' ? [f + sg * 0.05, um] : [um, f + sg * 0.05];
            trous.push({ x: +x.toFixed(2), z: +z.toFixed(2), face: (sg > 0 ? '+' : '-') + ax, large: +(q.u1 - q.u0 + step).toFixed(2), h: [+q.y0.toFixed(2), +q.y1.toFixed(2)], rayons: q.n, couverture: Math.round(rate * 100), mat: c.m, boite: box(c), ...seen(x, (q.y0 + q.y1) / 2, z, ax === 'x' ? sg : 0, ax === 'z' ? sg : 0, 0.2) });
          }
        } else {
          // l'objet dessiné est en retrait : marge médiane (sans rien derrière, toute l'épaisseur)
          const all = depth.concat(through.filter((t) => t[2]).map(() => th)).sort((a, b) => a - b), med = all[Math.floor(all.length / 2)];
          if (!all.length || med <= 0.15) continue;
          // le joueur peut-il buter dessus : un nœud du réseau principal devant la face, à moins de 1,5 m, au niveau du pied de la boîte
          let proche = false;
          for (let i = 0; i < NAV.count && !proche; i++) {
            if (!main(i) || Math.abs(NAV.ny[i] - c.y0) > 1) continue;
            const n = ((ax === 'x' ? NAV.nx[i] : NAV.nz[i]) - f) * sg, w = ax === 'x' ? NAV.nz[i] : NAV.nx[i];
            if (n >= 0 && Math.hypot(n, Math.max(0, u0 - w, w - u1)) <= 1.5) proche = true;
          }
          if (!proche) continue;
          marges.push({ x: +ctr[0].toFixed(2), z: +ctr[1].toFixed(2), face: (sg > 0 ? '+' : '-') + ax, marge: +Math.min(med, th).toFixed(2), vide: med >= th, couverture: Math.round(rate * 100), mat: c.m, boite: box(c) });
        }
      }
    }
    // une marge par boîte (sa pire face)
    const mb = new Map(); for (const m of marges) { const k = m.boite.join(','); const o = mb.get(k); if (!o || m.marge > o.marge) mb.set(k, m); }
    fentes.sort((a, b) => b.vu - a.vu || parseInt(b.rayons) - parseInt(a.rayons));
    // un trou traverse le mur : vu de ses deux faces, il ne compte qu'une fois
    const tk = new Map(); for (const t of trous) { const k = t.boite.join(',') + '|' + t.face[1] + '|' + (t.face[1] === 'x' ? t.z : t.x).toFixed(1); const o = tk.get(k); if (!o || t.vu > o.vu) tk.set(k, t); }
    trous.length = 0; trous.push(...tk.values());
    trous.sort((a, b) => b.vu - a.vu || b.rayons - a.rayons);
    passe.sort((a, b) => b.vu - a.vu);
    return { map, murs: solids.length, triangles, objets, fentes, passe, trous, marges: [...mb.values()].sort((a, b) => b.marge - a.marge) };
  }, map);
  const vf = R.fentes.filter((f) => f.vu), vp = R.passe.filter((f) => f.vu), vt = R.trous.filter((t) => t.vu);
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.map} : ${R.murs} boîtes examinées, ${R.triangles} triangles (${R.objets} objets posés)`);
    console.log(`fentes entre deux murs où l'on voit à travers : ${R.fentes.length} (${vf.length} visibles en jouant)`);
    const at = (o) => (o.vu ? `vu de ${o.vu}${o.vu >= 8 ? '+' : ''} point${o.vu > 1 ? 's' : ''}, ex. ${JSON.stringify(o.depuis)}` : 'caché');
    for (const f of R.fentes.slice(0, TOP)) console.log(`  FENTE (${f.x}, ${f.z}) ${f.ecart} cm, h ${f.h[0]} à ${f.h[1]}, rayons qui passent ${f.rayons}, ${f.mats}  ${at(f)}`);
    console.log(`passe-balles (le mur paraît plein, les balles et la vue des bots passent) : ${R.passe.length} (${vp.length} en vue d'un joueur)`);
    for (const f of R.passe.slice(0, TOP)) console.log(`  PASSE-BALLE (${f.x}, ${f.z}) ${f.ecart} cm, h ${f.h[0]} à ${f.h[1]}, ${f.mats}  ${at(f)}`);
    console.log(`trous dans un mur (on voit à travers un mur qu'on ne traverse pas) : ${R.trous.length} (${vt.length} visibles en jouant)`);
    for (const t of R.trous.slice(0, TOP)) console.log(`  TROU (${t.x}, ${t.z}) face ${t.face}, ${t.large} m de large, h ${t.h[0]} à ${t.h[1]} (${t.rayons} rayons, face couverte à ${t.couverture} %) ${t.mat} boîte ${JSON.stringify(t.boite)}  ${at(t)}`);
    console.log(`boîtes plus grosses que l'objet, au bord du réseau (marge de plus de 15 cm) : ${R.marges.length}`);
    for (const m of R.marges.slice(0, TOP)) console.log(`  MARGE ${m.marge} m${m.vide ? " (l'objet occupe moins de la moitié de sa boîte)" : ''} (${m.x}, ${m.z}) face ${m.face}, couverte à ${m.couverture} %, ${m.mat} boîte ${JSON.stringify(m.boite)}`);
  }
  await browser.close();
  process.exit(vf.length || vp.length || vt.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
