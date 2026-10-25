/* Main d'appui (main gauche) posée sur l'arme : mesure, pour chaque arme et chaque poignée d'appui qui lui va, si la main traverse
   l'arme, si la paume la touche et si elle reste loin du chargeur, en vue subjective (hanche, visée) et pour un soldat vu de
   l'extérieur (pose de la vitrine des tenues, visée 0,5, et arme épaulée, visée 1). Avec --acc 1, aussi avec chaque accessoire sous le canon
   qui lui va (poignée verticale, poignée angulaire, bipied).
   - Vue subjective : sommets de la main gauche déformée par ses os (SkinnedMesh.boneTransform), ramenés dans le repère de l'arme.
   - Soldat : sommets de la main gauche cuite dans le corps (os de la main seul), posés par layoutSoldier.
   Un sommet est dans l'arme s'il est dans une de ses pièces fermées (parité de trois rayons, vote à deux sur trois) ; sa
   profondeur est la distance à la surface la plus proche (échantillons tous les 1,5 mm), de même pour la distance au chargeur (6 cm au
   plus). Le contact de la paume est la distance signée du sommet du dessous de la paume (os de la paume, côté paume) le plus proche
   de l'arme : négatif, la paume s'enfonce ; grand, elle flotte (centre : médiane du milieu de la paume, creuse, qui ne touche pas un
   garde-main rond).
   node mains.js [--armes m4,ak47|toutes] [--acc 1|0] [--vues fp,tp] [--images dossier] [--json fichier] [--essai fichier.js]
   --essai : script exécuté dans la page avant les mesures (essayer un réglage sans reconstruire le jeu).
   Sortie : une ligne par arme et par vue ; code 1 si un seuil (SEUILS) est dépassé. Sans carte ni rendu (sauf --images). */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const wanted = opt('armes', 'toutes'), withAcc = opt('acc', '1') !== '0', modes = opt('vues', 'fp,tp').split(','), imgDir = opt('images', ''), jsonOut = opt('json', ''), essai = opt('essai', '');
/* seuils (mm) : profondeur maximale par partie de la main, contact du centre de la paume [min, max], distance au chargeur ;
   la main du soldat est cuite dans une seule pose (ses doigts ne se referment pas sur l'arme) : un peu plus de tolérance */
const SEUILS = {
  fp: { paume: 3, doigts: 4, pouce: 4, contact: [-3, 4], chargeur: 5 },
  tp: { paume: 5, doigts: 7, pouce: 7, contact: [-5, 6], chargeur: 15 },
};

(async () => {
  if (imgDir) fs.mkdirSync(imgDir, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 960, h: 540, settings: { quality: imgDir ? 'medium' : 'low', dynres: false }, noMap: true, noHdri: true });
  await page.evaluate(() => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (typeof sky !== 'undefined') sky.visible = false;
    scene.background = new THREE.Color(0x8a939c);
    const CELL = 0.005, STEP = 0.0015, k3 = (x, y, z) => `${x},${y},${z}`;
    /* pièces fermées de l'arme (repère de l'arme), échantillons de surface, boîte du chargeur */
    window.__gun = (key) => {
      const info = buildGunModel(key); info.group.updateMatrixWorld(true);
      const meshes = [];
      info.group.traverse((o) => { if (o.isMesh && o.visible && !o.material.transparent && !(o.geometry.parameters && o.geometry.parameters.openEnded)) meshes.push(o); });
      const H = new Map(), HM = new Map(), a = new V3(), b = new V3(), c = new V3(), p = new V3(), inMag = (o) => { for (; o; o = o.parent) if (o === info.mag) return true; return false; };
      const boxes = meshes.map((m) => new THREE.Box3().setFromObject(m)), inv = meshes.map((m) => new THREE.Matrix4().copy(m.matrixWorld).invert());
      for (const m of meshes) {
        const pos = m.geometry.attributes.position, idx = m.geometry.index, tri = idx ? idx.count / 3 : pos.count / 3, mag = inMag(m);
        for (let t = 0; t < tri; t++) {
          a.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(m.matrixWorld);
          b.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(m.matrixWorld);
          c.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(m.matrixWorld);
          const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / STEP));
          for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
            p.copy(a).multiplyScalar(1 - (i + j) / n).addScaledVector(b, i / n).addScaledVector(c, j / n);
            const k = k3(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
            for (const T of mag ? [H, HM] : [H]) { let l = T.get(k); if (!l) T.set(k, l = []); l.push(p.x, p.y, p.z); }
          }
        }
      }
      const q = new V3(), A = new V3(), B = new V3(), C = new V3(), e1 = new V3(), e2 = new V3(), h = new V3(), s = new V3(), qv = new V3();
      const DIRS = [[1, 0, 0], [0.0123, 1, 0.0071], [0.0089, 0.0131, 1]].map((d) => new V3(...d).normalize());
      const parity = (mi, P, d) => { // rayon P + t d (repère local de la pièce), nombre de faces traversées
        const geo = meshes[mi].geometry, pos = geo.attributes.position, idx = geo.index, tri = idx ? idx.count / 3 : pos.count / 3; let n = 0;
        for (let t = 0; t < tri; t++) {
          A.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3); B.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1); C.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2);
          e1.subVectors(B, A); e2.subVectors(C, A); h.crossVectors(d, e2);
          const det = e1.dot(h); if (Math.abs(det) < 1e-14) continue;
          const f = 1 / det; s.subVectors(P, A); const u = f * s.dot(h); if (u < 0 || u > 1) continue;
          qv.crossVectors(s, e1); const v = f * d.dot(qv); if (v < 0 || u + v > 1) continue;
          if (f * e2.dot(qv) > 1e-9) n++;
        }
        return n & 1;
      };
      const ld = new V3();
      const insideOne = (mi, P) => {
        q.copy(P).applyMatrix4(inv[mi]); let votes = 0;
        for (const d of DIRS) { ld.copy(d).transformDirection(inv[mi]); votes += parity(mi, q, ld); if (votes >= 2) return true; }
        return false;
      };
      const inside = (P) => { for (let i = 0; i < meshes.length; i++) if (boxes[i].containsPoint(P) && insideOne(i, P)) return true; return false; };
      const near = (P, R = 0.04, H0 = H) => { // distance à la surface la plus proche (R au plus)
        let best = R * R; const r = Math.ceil(R / CELL), cx = Math.floor(P.x / CELL), cy = Math.floor(P.y / CELL), cz = Math.floor(P.z / CELL);
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
          const l = H0.get(k3(cx + dx, cy + dy, cz + dz)); if (!l) continue;
          for (let i = 0; i < l.length; i += 3) { const ex = l[i] - P.x, ey = l[i + 1] - P.y, ez = l[i + 2] - P.z, d = ex * ex + ey * ey + ez * ez; if (d < best) best = d; }
        }
        return Math.sqrt(best);
      };
      return { info, inside, near, mag: HM.size > 0, magNear: (P) => near(P, 0.06, HM) };
    };
    /* sommets { p (repère de l'arme), part, f (doigt 0 à 4 ou -1), tip, palmar, center } : statistiques */
    window.__stats = (G, verts) => {
      const out = { paume: { n: 0, in: 0, max: 0 }, doigts: { n: 0, in: 0, max: 0 }, pouce: { n: 0, in: 0, max: 0 } }, palm = [], cen = [], tips = [1e9, 1e9, 1e9, 1e9, 1e9];
      let magD = 1e9;
      for (const v of verts) {
        const o = out[v.part]; o.n++;
        const d = G.near(v.p), isIn = d < 0.035 && G.inside(v.p), sd = isIn ? -d : d;
        if (isIn) { o.in++; o.max = Math.max(o.max, d); }
        if (v.palmar) { palm.push(sd); if (v.center) cen.push(sd); }
        if (v.tip) tips[v.f] = Math.min(tips[v.f], sd);
        if (G.mag && magD > 0) magD = Math.min(magD, G.magNear(v.p));
      }
      const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
      const mm = (x) => (x == null || x >= 1e8 ? null : +(x * 1000).toFixed(1));
      for (const k in out) { out[k].pct = out[k].n ? Math.round(100 * out[k].in / out[k].n) : 0; out[k].max = mm(out[k].max); }
      // contact : le sommet du dessous de la paume le plus proche de l'arme (sur un garde-main rond, la paume ne touche que le long d'une ligne)
      Object.assign(out, { contact: mm(palm.length ? Math.min(...palm) : null), centre: mm(med(cen)), tips: tips.map(mm), chargeur: mm(G.mag ? magD : null) });
      return out;
    };
    const PALM_COL = (col, i) => Math.abs(col.getX(i) - 0.58) < 0.03 && Math.abs(col.getZ(i) - 0.55) < 0.03; // teinte de la paume du gant
    const centerOf = (lh) => Math.abs(lh.x) < 0.02 && lh.z > -0.03 && lh.z < 0.02;
    /* vue subjective : arme équipée comme en partie, main gauche déformée */
    window.__fp = (id, att, ads) => {
      const def = weaponDef(id, att, null); vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null;
      const S = { ads, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
      camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0);
      for (let i = 0; i < 90; i++) updateViewmodel(1 / 30, S);
      VM.root.updateMatrixWorld(true);
      const hand = VM.arms.L.hand, mesh = hand.userData.mesh, gi = new THREE.Matrix4().copy(VM.cur.group.matrixWorld).invert(), hi = new THREE.Matrix4().copy(hand.matrixWorld).invert();
      const geo = mesh.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, col = geo.attributes.color, n = geo.attributes.position.count, verts = [], v = new V3();
      for (let i = 0; i < n; i++) {
        let bi = 0, bw = -1; for (let j = 0; j < 4; j++) if (sw.array[i * 4 + j] > bw) { bw = sw.array[i * 4 + j]; bi = si.array[i * 4 + j]; }
        v.fromBufferAttribute(geo.attributes.position, i); mesh.boneTransform(i, v); mesh.localToWorld(v);
        const lh = v.clone().applyMatrix4(hi), palmar = PALM_COL(col, i), f = bi === 0 ? -1 : bi >= 13 ? 4 : Math.floor((bi - 1) / 3);
        const under = f < 0 && lh.y < -0.004; // dessous de la paume (celui que pose palmLift)
        verts.push({ p: v.clone().applyMatrix4(gi), part: f < 0 ? 'paume' : f === 4 ? 'pouce' : 'doigts', f, tip: bi === 15 || (bi > 0 && bi < 13 && bi % 3 === 0), palmar: under, center: palmar && f < 0 && centerOf(lh) });
      }
      const r = __stats(__gun(def.key), verts);
      r.handY = +(-lHandFrame(VM.cur).off.y).toFixed(4); r.lFrame = VM.cur.lFrame || 'L'; r.turn = +(VM.arms.L.jt.turn || 0).toFixed(2); r.r = +(VM.arms.L.jt.r || 0).toFixed(2);
      return r;
    };
    /* soldat : pose de la vitrine (poseSoldier figée) à la visée aim, os posés par layoutSoldier, main gauche cuite */
    const TPH = {};
    // sommets de la main gauche du modèle détaillé (repère de la main) et parties d'après la main cuite ; grip : la forme qui tient une
    // poignée d'appui (os SB.HLG) ou celle qui tient un garde-main (SB.HLS) ; les versions plus anciennes n'ont que SB.HAL
    const tpBone = (grip) => (SB.HLS === undefined ? SB.HAL : grip ? SB.HLG : SB.HLS);
    const tpHand = (grip) => {
      if (TPH[grip]) return TPH[grip];
      const bone = tpBone(grip), geo = soldierGeometry(SKIN_IDS[0], 'hi'), R = soldierRest(), ri = new THREE.Matrix4().copy(R.mats[SB.HAL]).invert();
      const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, pos = geo.attributes.position;
      const Hb = handBones(1), hg = handGeometry(1, Hb.u, Hb.h, 'lo'), hsi = hg.attributes.skinIndex, hsw = hg.attributes.skinWeight;
      const pose = typeof SOLDIER_LPOSE === 'undefined' ? 'cclamp' : grip ? SOLDIER_LGRIP : SOLDIER_LPOSE;
      const hb = handBaked(1, pose, 'lo'), nb = hb.p.length / 3, bp = new V3();
      const out = [], v = new V3();
      for (let i = 0; i < pos.count; i++) {
        if (si.array[i * 4] !== bone || sw.array[i * 4] < 0.999) continue;
        v.fromBufferAttribute(pos, i).applyMatrix4(ri);
        if (v.z > 0.075) continue; // manchette
        let best = 1e9, bk = 0; for (let k = 0; k < nb; k++) { const d = bp.fromArray(hb.p, k * 3).distanceToSquared(v); if (d < best) { best = d; bk = k; } }
        let bi = 0, bw = -1; for (let j = 0; j < 4; j++) if (hsw.array[bk * 4 + j] > bw) { bw = hsw.array[bk * 4 + j]; bi = hsi.array[bk * 4 + j]; }
        const f = best > 1e-8 ? -2 : bi === 0 ? -1 : bi >= 13 ? 4 : Math.floor((bi - 1) / 3);
        if (f === -2) continue; // pas un sommet de la main
        const palmar = f < 0 && Math.abs(hb.c[bk * 3] - 0.58) < 0.03 && Math.abs(hb.c[bk * 3 + 2] - 0.55) < 0.03; // teinte de la paume de la main cuite
        out.push({ f, part: f < 0 ? 'paume' : f === 4 ? 'pouce' : 'doigts', tip: bi === 15 || (bi > 0 && bi < 13 && bi % 3 === 0), palmar: f < 0 && v.y < -0.004, center: palmar && centerOf(v), bind: v.clone() });
      }
      return (TPH[grip] = out);
    };
    window.__tp = (key, aim) => {
      SK_POSE.aim = aim; SKV.pose = null; const P = skinPvPose(key);
      const R = soldierRest(), bones = []; for (let i = 0; i < SOLDIER_NB; i++) { const b = new THREE.Object3D(); b.position.setFromMatrixPosition(R.mats[i]); b.quaternion.copy(R.q[i]); bones.push(b); }
      const S = { bones, J: P.J.map((x) => x.clone()), lastN: R.lastN.map((x) => x.clone()), fp: P.fp.slice(), fy: P.fy.slice(), sink: 0, gun: P.gun, grips: P.grips, kind: P.kind, headQ: P.headQ };
      layoutSoldier(S, true);
      const held = !!_lo.hq[0], grip = !!(P.grips.LF && P.grips.LF.pose === 'fgrip');
      const hb = bones[tpBone(grip)], gi = new THREE.Matrix4().compose(P.gun.position, P.gun.quaternion, new V3(1, 1, 1)).invert();
      const hm = new THREE.Matrix4().compose(hb.position, hb.quaternion, new V3(1, 1, 1));
      const verts = tpHand(grip).map((x) => ({ ...x, p: x.bind.clone().applyMatrix4(hm).applyMatrix4(gi) }));
      const r = __stats(__gun(key), verts);
      const sh = P.J[J_SHL], el = P.J[J_ELL], w = P.J[J_HAL];
      // pivot de la main sur sa prise (armToGrip) : écart entre l'orientation de la main et celle du repère de prise
      const qf = P.gun.quaternion.clone().multiply(P.grips.LF.q);
      r.pivot = Math.round(2 * Math.acos(Math.min(1, Math.abs(qf.dot(bones[SB.HAL].quaternion)))) * 180 / Math.PI);
      r.held = held; r.coude = Math.round(180 - new V3().subVectors(sh, el).angleTo(new V3().subVectors(w, el)) * 180 / Math.PI);
      r.portee = +(sh.distanceTo(w) * 100).toFixed(1);
      return r;
    };
    /* images : vue subjective de la main d'appui par-dessous et par la gauche (bras visibles) */
    window.__fpView = (dir) => {
      const hp = new V3().setFromMatrixPosition(VM.arms.L.hand.matrixWorld), gq = VM.cur.group.getWorldQuaternion(new THREE.Quaternion());
      const o = { dessous: [-0.06, -0.3, 0.06], gauche: [-0.32, -0.03, 0.04] }[dir];
      vmCamera.position.copy(hp).add(new V3(...o).applyQuaternion(gq)); vmCamera.up.set(0, 1, 0).applyQuaternion(gq); vmCamera.lookAt(hp);
      vmCamera.fov = 40; vmCamera.updateProjectionMatrix();
    };
    window.__fpViewEnd = () => { vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0); vmCamera.fov = 50; vmCamera.updateProjectionMatrix(); };
    /* images : soldat de la vitrine, gros plans de la main gauche (rendu de la vitrine, vwDraw) */
    window.__tpImages = (key) => {
      const skin = SKIN_IDS[0], M = skinPvModel(skin), m = skinPvMat(skin);
      SK_POSE.aim = 0.5; SKV.pose = null; M.key = '';
      skinPvPlace(M, key);
      skinTone(skin, 0, m.color); skinRelColor(0, m.userData.skU.tag.value);
      const S = vwScene(); S.scene.add(M.root); M.root.updateMatrixWorld(true);
      const h = new V3().setFromMatrixPosition(M.bones[SB.HAL].matrixWorld), gq = M.gun.quaternion, ax = (x, y, z) => new V3(x, y, z).applyQuaternion(gq);
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480; const ctx = cv.getContext('2d'), res = {};
      S.cam.fov = 40; S.cam.aspect = 640 / 480; S.cam.updateProjectionMatrix();
      for (const [n, o] of Object.entries({ gauche: [-0.5, 0.02, 0.02], dessous: [-0.03, -0.5, 0.03], avant: [-0.3, -0.25, -0.3] })) {
        S.cam.position.copy(h).add(ax(...o)); S.cam.up.copy(ax(0, 1, 0)); S.cam.lookAt(h);
        vwDraw(ctx, 640, 480, 640, 480); res[n] = cv.toDataURL('image/png');
      }
      S.cam.up.set(0, 1, 0); S.cam.fov = VW_FOV; S.cam.updateProjectionMatrix();
      vwCamPlace(S.cam, SK_POSE.a + Math.PI / 2, 0.06, 1.08 / Math.tan(THREE.MathUtils.degToRad(VW_FOV) / 2), SK_AIM);
      vwDraw(ctx, 640, 480, 640, 480); res.vitrine = cv.toDataURL('image/png');
      S.scene.remove(M.root);
      return res;
    };
  });
  if (essai) await page.addScriptTag({ content: fs.readFileSync(essai, 'utf8') });
  const ids = await page.evaluate((w) => (w === 'toutes' ? Object.keys(WEAPONS) : w.split(',')), wanted);
  const fails = [], all = [];
  const check = (mode, tag, r) => {
    const T = SEUILS[mode], bad = [];
    for (const k of ['paume', 'doigts', 'pouce']) if (r[k].max > T[k]) bad.push(`${k} ${r[k].max} mm`);
    if (r.contact != null && (r.contact < T.contact[0] || r.contact > T.contact[1])) bad.push(`contact ${r.contact} mm`);
    if (r.chargeur != null && r.chargeur < T.chargeur) bad.push(`chargeur ${r.chargeur} mm`);
    if (mode === 'tp' && !r.held) bad.push('main lâchée');
    if (bad.length) fails.push(`${tag} : ${bad.join(', ')}`);
    return bad.length ? '  <-- ' + bad.join(', ') : '';
  };
  const fmt = (r) => `paume ${r.paume.pct}% ${r.paume.max} | doigts ${r.doigts.pct}% ${r.doigts.max} | pouce ${r.pouce.pct}% ${r.pouce.max} | contact ${r.contact} centre ${r.centre} | bouts ${r.tips.join(' ')} | chargeur ${r.chargeur}`;
  for (const id of ids) {
    const pistol = await page.evaluate((id) => WEAPONS[id].type === 'pistol' || gunFam(weaponDef(id, [], null).key) === 'pistol', id);
    const atts = await page.evaluate(([id, acc]) => [[], ...(acc ? ['vgrip', 'agrip', 'bipod'].filter((a) => attFits(WEAPONS[id], a)).map((a) => [a]) : [])], [id, withAcc]);
    for (const att of atts) {
      const tag = id + (att.length ? '+' + att[0] : ''), key = await page.evaluate(([id, att]) => weaponDef(id, att, null).key, [id, att]);
      if (modes.includes('fp')) for (const ads of [false, true]) {
        const r = await page.evaluate(([id, att, ads]) => __fp(id, att, ads), [id, att, ads]);
        const t = `FP ${ads ? 'visée ' : 'hanche'} ${tag}`;
        console.log(`${t.padEnd(26)} ${r.lFrame.padEnd(3)} handY ${r.handY} | ${fmt(r)} | poignet ${r.r}${pistol ? '' : check('fp', t, r)}`);
        all.push({ vue: 'fp', ads, tag, ...r });
        if (imgDir && !ads) for (const v of ['dessous', 'gauche']) {
          await page.evaluate((v) => __fpView(v), v); await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(imgDir, `fp-${tag}-${v}.png`) });
          await page.evaluate(() => __fpViewEnd());
        }
      }
      if (modes.includes('tp')) {
        for (const aim of [0.5, 1]) {
          const r = await page.evaluate(([key, aim]) => __tp(key, aim), [key, aim]);
          const t = `TP visée ${aim} ${tag}`;
          console.log(`${t.padEnd(26)} ${r.held ? 'posée ' : 'LÂCHÉE'} pivot ${r.pivot}° coude ${r.coude}° portée ${r.portee} cm | ${fmt(r)}${pistol ? '' : check('tp', t, r)}`);
          all.push({ vue: 'tp', aim, tag, ...r });
        }
        if (imgDir) {
          const imgs = await page.evaluate((key) => __tpImages(key), key);
          for (const [n, u] of Object.entries(imgs)) fs.writeFileSync(path.join(imgDir, `tp-${tag}-${n}.png`), Buffer.from(u.split(',')[1], 'base64'));
        }
      }
    }
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  const bad = logs.filter((l) => !l.includes('HDRI'));
  if (bad.length) console.log(bad.slice(0, 10).join('\n'));
  console.log(fails.length ? `\n${fails.length} dépassement(s) :\n` + fails.join('\n') : '\nok : aucun seuil dépassé');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
