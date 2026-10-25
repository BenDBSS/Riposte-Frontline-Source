/* Détecteur de pièces flottantes : construit chaque modèle d'arme (nu, puis avec chaque accessoire qui lui va) et cherche les
   pièces qui ne touchent rien. Chaque face de chaque pièce est échantillonnée tous les ~1 mm dans le repère de l'arme ;
   deux pièces se touchent si deux échantillons sont à moins de la tolérance (ou si l'une est enfouie dans l'autre). Les
   pièces reliées forment un bloc ; tout bloc qui n'est pas le bloc principal est signalé, avec sa taille, sa matière, le
   jeu qui le sépare du bloc le plus proche et la ligne du jeu qui l'a posé.
   node flottants.js [--armes m4,ak47|toutes] [--acc 0|1] [--tol 0.0015] [--pas 0.0012]
   Sortie : une ligne par modèle (« ok » ou la liste des pièces flottantes). Aucun rendu : rapide, sans carte. */
const fs = require('fs'), path = require('path');
const { openGame, REPO } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const wanted = opt('armes', 'toutes'), withAcc = opt('acc', '1') !== '0', TOL = +opt('tol', 0.0015), STEP = +opt('pas', 0.0012);
const distLines = fs.readFileSync(path.join(REPO, 'dist/riposte-frontline.html'), 'utf8').split('\n');

(async () => {
  const { browser, page, logs } = await openGame({ w: 640, h: 360, settings: { quality: 'low', dynres: false }, noMap: true, noHdri: true });
  await page.evaluate(({ TOL, STEP }) => {
    // chaque pièce note les fonctions qui l'ont posée (pour retrouver sa ligne de code)
    const orig = part;
    part = function (...a) { const m = orig(...a); m.userData.stk = new Error().stack; return m; }; // eslint-disable-line no-global-assign
    const HELP = new Set(['part', 'bx', 'rb', 'cy', 'cz', 'Object.part']);
    window.__where = (m) => {
      const out = [];
      for (const l of (m.userData.stk || '').split('\n').slice(1)) {
        const mm = /at (?:(\S+) )?\(?.*:(\d+):(\d+)\)?$/.exec(l.trim()); if (!mm) continue;
        const fn = mm[1] || '';
        if (HELP.has(fn)) continue;
        out.push([fn, +mm[2], +mm[3]]); if (out.length >= 2) break;
      }
      return out;
    };
    const matName = (M, mat) => { for (const k in M) if (M[k] === mat) return k; return '?'; };
    const closed = (geo) => !(geo.parameters && geo.parameters.openEnded);
    function inside(mesh, p) { // point (repère de l'arme) dans une pièce fermée : parité d'un rayon vers +x dans le repère local
      const geo = mesh.geometry; if (!closed(geo) || geo.type === 'ConeGeometry') return false;
      const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert(), q = p.clone().applyMatrix4(inv);
      const pos = geo.attributes.position, idx = geo.index; let n = 0;
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), h = new THREE.Vector3(), s = new THREE.Vector3(), qv = new THREE.Vector3();
      const tri = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < tri; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i1); C.fromBufferAttribute(pos, i2);
        e1.subVectors(B, A); e2.subVectors(C, A);
        h.set(0, -e2.z, e2.y); // dir (1,0,0) croisé avec e2
        const a = e1.dot(h); if (Math.abs(a) < 1e-12) continue;
        const f = 1 / a; s.subVectors(q, A); const u = f * s.dot(h); if (u < 0 || u > 1) continue;
        qv.crossVectors(s, e1); const v = f * qv.x; if (v < 0 || u + v > 1) continue;
        if (f * e2.dot(qv) > 1e-9) n++;
      }
      return n % 2 === 1;
    }
    window.__flot = (key) => {
      const info = buildGunModel(key), g = info.group, M = camoMaterials(null); g.updateMatrixWorld(true);
      const meshes = []; g.traverse((o) => { if (o.isMesh) meshes.push(o); });
      const N = meshes.length, par = Array.from({ length: N }, (_, i) => i), find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      const pts = []; // échantillons : x, y, z, pièce
      const V = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const box = meshes.map(() => new THREE.Box3()), area = new Array(N).fill(0);
      meshes.forEach((m, mi) => {
        const pos = m.geometry.attributes.position, idx = m.geometry.index, tri = idx ? idx.count / 3 : pos.count / 3;
        for (let t = 0; t < tri; t++) {
          const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
          box[mi].expandByPoint(a).expandByPoint(b).expandByPoint(c);
          area[mi] += V.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
          // échantillonnage proportionnel à l'aire : on part de l'arête la plus longue, le sommet opposé donne la hauteur
          let P = a, Q = b, R = c; const lab = a.distanceTo(b), lbc = b.distanceTo(c), lca = c.distanceTo(a);
          if (lbc >= lab && lbc >= lca) { P = b; Q = c; R = a; } else if (lca >= lab && lca >= lbc) { P = c; Q = a; R = b; }
          const L = Math.max(lab, lbc, lca), hgt = 2 * (V.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2) / Math.max(L, 1e-9);
          const nL = Math.max(1, Math.ceil(L / STEP)), nh = Math.max(1, Math.ceil(hgt / STEP));
          for (let j = 0; j <= nh; j++) {
            const tt = j / nh, k = Math.max(1, Math.round(nL * (1 - tt)));
            for (let i = 0; i <= k; i++) {
              const u = i / k, x0 = P.x + (R.x - P.x) * tt, y0 = P.y + (R.y - P.y) * tt, z0 = P.z + (R.z - P.z) * tt, x1 = Q.x + (R.x - Q.x) * tt, y1 = Q.y + (R.y - Q.y) * tt, z1 = Q.z + (R.z - Q.z) * tt;
              pts.push(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z0 + (z1 - z0) * u, mi);
            }
          }
        }
      });
      // grille de hachage : cellule = tolérance
      const cell = TOL, H = new Map(), key3 = (x, y, z) => (x + 1024) * 4194304 + (y + 1024) * 2048 + (z + 1024);
      const np = pts.length / 4;
      for (let p = 0; p < np; p++) { const k = key3(Math.floor(pts[p * 4] / cell), Math.floor(pts[p * 4 + 1] / cell), Math.floor(pts[p * 4 + 2] / cell)); let l = H.get(k); if (!l) H.set(k, l = []); l.push(p); }
      const t2 = TOL * TOL;
      for (let p = 0; p < np; p++) {
        const x = pts[p * 4], y = pts[p * 4 + 1], z = pts[p * 4 + 2], mi = pts[p * 4 + 3], cx = Math.floor(x / cell), cy2 = Math.floor(y / cell), cz2 = Math.floor(z / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const l = H.get(key3(cx + dx, cy2 + dy, cz2 + dz)); if (!l) continue;
          for (const q of l) {
            const mj = pts[q * 4 + 3]; if (mj === mi || find(mi) === find(mj)) continue;
            const ex = pts[q * 4] - x, ey = pts[q * 4 + 1] - y, ez = pts[q * 4 + 2] - z;
            if (ex * ex + ey * ey + ez * ez <= t2) par[find(mi)] = find(mj);
          }
        }
      }
      // pièces enfouies dans une autre (aucune face en contact)
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i === j || find(i) === find(j) || !box[i].intersectsBox(box[j])) continue;
        const m = meshes[i], pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 8));
        for (let k = 0; k < pos.count; k += step) { V.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); if (inside(meshes[j], V)) { par[find(i)] = find(j); break; } }
      }
      // blocs
      const comp = new Map(); for (let i = 0; i < N; i++) { const r = find(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); }
      const blocks = [...comp.values()].map((ids) => ({ ids, area: ids.reduce((s, i) => s + area[i], 0), box: ids.reduce((bb, i) => bb.union(box[i]), new THREE.Box3()) }));
      blocks.sort((x, y) => y.area - x.area);
      const main = blocks[0], res = { key, meshes: N, blocks: blocks.length, float: [] };
      // jeu au bloc le plus proche (échantillons de moins de 1 cm, par une grille plus grosse)
      const blockOf = new Map(); blocks.forEach((bk, bi) => bk.ids.forEach((i) => blockOf.set(i, bi)));
      const cell2 = 0.01, H2 = new Map();
      for (let p = 0; p < np; p++) { const k = key3(Math.floor(pts[p * 4] / cell2), Math.floor(pts[p * 4 + 1] / cell2), Math.floor(pts[p * 4 + 2] / cell2)); let l = H2.get(k); if (!l) H2.set(k, l = []); l.push(p); }
      for (let bi = 1; bi < blocks.length; bi++) {
        const bk = blocks[bi]; let best = 1e9, near = -1, at = null;
        for (let p = 0; p < np; p++) {
          const mi = pts[p * 4 + 3]; if (blockOf.get(mi) !== bi) continue;
          const x = pts[p * 4], y = pts[p * 4 + 1], z = pts[p * 4 + 2], cx = Math.floor(x / cell2), cy2 = Math.floor(y / cell2), cz2 = Math.floor(z / cell2);
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            const l = H2.get(key3(cx + dx, cy2 + dy, cz2 + dz)); if (!l) continue;
            for (const q of l) {
              const mj = pts[q * 4 + 3]; if (blockOf.get(mj) === bi) continue;
              const ex = pts[q * 4] - x, ey = pts[q * 4 + 1] - y, ez = pts[q * 4 + 2] - z, d2 = ex * ex + ey * ey + ez * ez;
              if (d2 < best) { best = d2; near = mj; at = [ex, ey, ez]; }
            }
          }
        }
        const m0 = meshes[bk.ids[0]];
        res.float.push({
          n: bk.ids.length, area: +(bk.area * 1e4).toFixed(2), gap: best < 1e8 ? +(Math.sqrt(best) * 1000).toFixed(1) : null, d: at && at.map((v) => +(v * 1000).toFixed(1)),
          mat: [...new Set(bk.ids.map((i) => matName(M, meshes[i].material)))].join(','),
          min: bk.box.min.toArray().map((v) => +(v * 1000).toFixed(0)), max: bk.box.max.toArray().map((v) => +(v * 1000).toFixed(0)),
          near: near >= 0 ? matName(M, meshes[near].material) : null, where: window.__where(m0), isKeep: info.keep && info.keep.includes(m0),
        });
      }
      return res;
    };
  }, { TOL, STEP });
  const ids = await page.evaluate((wanted) => (wanted === 'toutes' ? Object.keys(WEAPONS) : wanted.split(',')), wanted);
  let total = 0;
  for (const id of ids) {
    const keys = await page.evaluate(([id, withAcc]) => {
      const base = WEAPONS[id], model = base.model, out = [gunKey(model, [], null)];
      if (withAcc) for (const a in ATT) if (attFits(base, a)) out.push(gunKey(model, [a], null));
      return out;
    }, [id, withAcc]);
    for (const key of keys) {
      const r = await page.evaluate((k) => window.__flot(k), key);
      const bad = r.float.filter((f) => !f.isKeep);
      if (!bad.length) { if (key.indexOf('~') < 0) console.log(`ok   ${key} (${r.meshes} pièces)`); continue; }
      total += bad.length;
      console.log(`FLOT ${key} : ${bad.length} bloc(s) sur ${r.blocks} (${r.meshes} pièces)`);
      for (const f of bad) {
        const w = f.where.map(([fn, ln, col]) => `${fn || 'modèle'}@${ln}:${col}: ${(distLines[ln - 1] || '').slice(col - 1, col + 99).trim()}`).join('  <=  '); // ligne et colonne : la page est réduite (build.py), une ligne peut porter plusieurs instructions
        console.log(`  ${f.n} pièce(s) ${f.mat} aire ${f.area} cm2, jeu ${f.gap} mm vers ${f.near} [${f.d}]  boîte ${f.min} .. ${f.max}\n     ${w}`);
      }
    }
  }
  console.log(`total de blocs flottants : ${total}`);
  if (logs.length) console.log(logs.slice(0, 5).join('\n'));
  await browser.close();
})();
