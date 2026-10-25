/* Comparaison des animations cuites (src/06ab-anim.js, tools/dev/anim/cuire.mjs) avec leur clip d'origine (pack Mixamo, /anim-source/).
   node tools/dev/visual/anim.js [dossier de captures] ; ANIMS=fusil/debout/marche-avant,actions/glissade pour quelques clips (par défaut, tous) ;
   CAPTURES=marche-avant,glissade (morceaux de noms) pour les captures, ou CAPTURES=tous ; PAGE=... pour une autre version.
   Pour chaque clip, rejoué avec le décodeur du jeu sur un soldat (bassin, buste, tête et chevilles du clip, jambes en IK avec les longueurs de
   SD, comme le fera poseSoldier) :
   - valeurs non finies ; écart des données décodées à la référence (quantification, interpolation) ;
   - glissement du pied d'appui : pendant chaque appui, le talon et la plante de la ranger (repère du monde, le corps avançant à la vitesse
     du clip) ne doivent pas bouger de plus de 2 cm (SEUIL_PIED) ;
   - genoux et tête du soldat contre ceux du clip mis à l'échelle (proportions : le soldat n'a pas tout à fait celles du X Bot) ;
   - hauteur de la tête (J_HEAD) ;
   puis le soldat du jeu en situation (06ac-loco.js) : déplacement debout, accroupi et au pistolet (glissement des pieds, au plus 3 cm avec
   les mélanges de directions et d'allures, hauteur de la tête), trois sauts (semelle sous le sol à la réception, au plus 3 cm), une
   glissade (tête vers 0,85 m), un lancer de grenade, un rechargement et quatre coups reçus ; LOCO=0 pour passer ; AVANT=page plus
   ancienne (par exemple d'avant les clips) pour les mêmes mesures en regard. Puis le coût de poseSoldier et layoutSoldier pour 12
   soldats, et des captures : le clip à gauche (squelette du X Bot, lignes) et le soldat à droite, au même instant, de face et de profil.
   Code 1 si un seuil est dépassé. */
const path = require('path'), fs = require('fs');
const { openGame } = require('./common');
const out = process.argv[2];
const SEUIL_PIED = 0.02;
(async () => {
  const lib = await import('../anim/lib.mjs');
  const only = process.env.ANIMS ? process.env.ANIMS.split(',') : null;
  const clips = lib.manifest().clips.filter((c) => !only || only.includes(c.fichier.replace(/\.glb$/, '')));
  const ref = [];
  for (const c of clips) {
    const b = await lib.bakeClip(c);
    ref.push({ id: b.id, gv: b.gv.toArray(), Q: b.Q.map((q) => ({ pel: q.pel.toArray(), ft: [q.feet[0].toArray(), q.feet[1].toArray()], head: q.head.toArray() })), R: b.R.map((r) => r.map((v) => v.toArray())) });
  }
  const B = lib.DRAW_BONES, bi = (n) => B.indexOf(n);
  const SEG = [['Hips', 'Spine2'], ['Spine2', 'Neck'], ['Neck', 'Head'], ['Head', 'HeadTop_End'], ['Neck', 'LeftArm'], ['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'], ['Neck', 'RightArm'], ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand'],
    ['Hips', 'LeftUpLeg'], ['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'], ['LeftFoot', 'LeftToeBase'], ['Hips', 'RightUpLeg'], ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot'], ['RightFoot', 'RightToeBase']].map(([a, b]) => [bi(a), bi(b)]);
  const cap = process.env.CAPTURES ? process.env.CAPTURES.split(',') : [];
  const g = await openGame({ w: 960, h: 600, settings: { quality: out && cap.length ? 'medium' : 'low', map: 'sable' }, page: process.env.PAGE, noMap: !(out && cap.length), noHdri: true });
  const { page } = g;
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; for (const e of entities) if (e.model) e.model.root.visible = false; });
  // soldier posé d'après une pose cuite : comme le fera poseSoldier (hanches par le bassin, cou et épaules par le buste, tête, jambes en IK
  // vers les chevilles, genou vers la pointe du pied) ; bras le long du corps (ils restent pilotés par l'arme dans le jeu)
  await page.evaluate(() => {
    window.__pose = (S, m, pos) => {
      const L = []; for (let i = 0; i < 15; i++) L.push(new V3());
      const q = new THREE.Quaternion(), up = new V3(0, 1, 0);
      L[J_PEL].copy(m.pel);
      L[J_CHE].set(0, SD.trunk, 0).applyQuaternion(m.qT).add(m.pel);
      const shc = new V3(0, SD.shY, 0).applyQuaternion(m.qT).add(L[J_CHE]);
      L[J_SHL].set(-SD.shX, 0, SD.shZ).applyQuaternion(m.qT).add(shc); L[J_SHR].set(SD.shX, 0, SD.shZ).applyQuaternion(m.qT).add(shc);
      L[J_HEAD].set(...SD.head).applyQuaternion(m.qH).add(L[J_CHE]);
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, hip = L[i ? J_HIR : J_HIL], kn = L[i ? J_KNR : J_KNL], ft = L[i ? J_FTR : J_FTL];
        hip.set(side * SD.hipX, SD.hipY, 0).applyQuaternion(m.qP).add(m.pel);
        ik2(hip, m.ft[i], SD.thigh, SD.shin, new V3().copy(m.kn[i]).applyQuaternion(m.qP).add(hip), kn, ft);
        const sh = L[i ? J_SHR : J_SHL], hd = new V3(side * 0.12, -0.52, -0.08).applyQuaternion(m.qT).add(sh);
        ik2(sh, hd, SD.ua, SD.fa, new V3(side * 0.3, -0.2, 0.4).applyQuaternion(m.qT).add(sh), L[i ? J_ELR : J_ELL], L[i ? J_HAR : J_HAL]);
      }
      for (let i = 0; i < 15; i++) S.J[i].copy(L[i]).add(pos);
      S.fp = [m.fp[0], m.fp[1]]; S.fy = [m.fy[0], m.fy[1]];
      S.headQ = (S.headQ || new THREE.Quaternion()).copy(m.qH).multiply(soldierRest().q[SB.HEA]);
      if (S.gun) S.gun.visible = false;
      layoutSoldier(S, true);
      return L;
    };
  });
  let fails = 0;
  // version de référence (AVANT=chemin d'une page construite plus ancienne, par exemple d'avant les clips) : mêmes mesures, pour comparer
  const avant = async (fn) => {
    if (!process.env.AVANT) return null;
    const g = await openGame({ w: 400, h: 300, settings: { quality: 'low', map: 'sable' }, page: path.resolve(process.env.AVANT), noMap: true, noHdri: true });
    const r = await fn(g.page); await g.browser.close(); return r;
  };
  const lines = [];
  for (const r of ref) {
    const res = await page.evaluate(([r, SEUIL]) => {
      const c = animClip(r.id); if (!c) return { err: 'clip absent des données cuites' };
      const m = animSmp(), o = { nan: 0, dec: 0, slip: [0, 0], steps: [0, 0], knee: 0, head: [9, -9], dhead: 0 };
      // décodage : chaque image contre la référence
      for (let f = 0; f < c.n; f++) {
        animRead(c, f, m); const q = r.Q[f];
        for (const v of [m.pel.x, m.pel.y, m.pel.z, m.qP.w, m.qT.w, m.qH.w, m.ft[0].y, m.ft[1].y, m.fp[0], m.fy[0]]) if (!Number.isFinite(v)) o.nan++;
        o.dec = Math.max(o.dec, m.pel.distanceTo(new V3(...q.pel)), m.ft[0].distanceTo(new V3(...q.ft[0])), m.ft[1].distanceTo(new V3(...q.ft[1])));
      }
      // glissement du pied d'appui : le soldat, posé d'après le clip, avance à la vitesse du clip (deux cycles à 120 images par seconde) ;
      // on suit le talon et la plante de chaque ranger (sous l'os des orteils, qui se replie au déroulé) tant qu'ils touchent le sol
      // (à moins de 8 mm du plus bas de la semelle) ; la cheville, elle, roule sur le talon puis la plante
      const S = window.__S || (window.__S = makeSoldier('assault', 0, 'm4'));
      if (c.loop && c.v > 0.3) {
        const gv = new V3(...r.gv), dt = 1 / 120, T = c.dur * 2, ft = [SB.FTL, SB.FTR], to = [SB.TOL, SB.TOR], track = [[[], []], [[], []]];
        const HEEL = new V3(0, -0.075, 0.07), PAD = new V3(0, -0.023, -0.03);
        for (let t = 0; t <= T; t += dt) {
          animSample(c, t, m); window.__pose(S, m, new V3().copy(gv).multiplyScalar(t));
          for (let k = 0; k < 2; k++) {
            const a = S.bones[ft[k]], b = S.bones[to[k]];
            track[k][0].push(HEEL.clone().applyQuaternion(a.quaternion).add(a.position));
            track[k][1].push(PAD.clone().applyQuaternion(b.quaternion).add(b.position));
          }
        }
        for (let k = 0; k < 2; k++) {
          const lo = Math.min(...track[k].flat().map((p) => p.y));
          for (const tr of track[k]) {
            let run = null;
            for (const w of tr) {
              if (w.y < lo + 0.008) { if (!run) run = { p0: w.clone(), d: 0 }; else run.d = Math.max(run.d, Math.hypot(w.x - run.p0.x, w.z - run.p0.z)); }
              else if (run) { o.slip[k] = Math.max(o.slip[k], run.d); o.steps[k]++; run = null; }
            }
          }
        }
      }
      // soldat posé : genoux et tête contre le clip
      for (let f = 0; f < c.n; f++) {
        animRead(c, f, m); window.__pose(S, m, new V3());
        const R = r.R[f], kl = new V3(...R[12]), kr = new V3(...R[16]);
        o.knee = Math.max(o.knee, S.J[J_KNL].distanceTo(kl), S.J[J_KNR].distanceTo(kr));
        const hy = S.J[J_HEAD].y; o.head[0] = Math.min(o.head[0], hy); o.head[1] = Math.max(o.head[1], hy);
        o.dhead = Math.max(o.dhead, Math.abs(hy - r.Q[f].head[1]));
      }
      return o;
    }, [r, SEUIL_PIED]);
    if (res.err) { fails++; lines.push(`ECHEC : ${r.id} : ${res.err}`); continue; }
    const bad = [];
    if (res.nan) bad.push(`${res.nan} valeurs non finies`);
    if (res.dec > 0.002) bad.push(`décodage à ${(res.dec * 1000).toFixed(1)} mm`);
    if (Math.max(...res.slip) > SEUIL_PIED) bad.push(`pied d'appui qui glisse de ${(Math.max(...res.slip) * 100).toFixed(1)} cm`);
    if (bad.length) fails++;
    const slip = res.steps[0] + res.steps[1] ? `glissement g ${(res.slip[0] * 100).toFixed(1)} d ${(res.slip[1] * 100).toFixed(1)} cm` : 'glissement -';
    lines.push(`${bad.length ? 'ECHEC' : 'ok   '} : ${r.id.padEnd(34)} ${slip.padEnd(30)} genoux ${(res.knee * 100).toFixed(1)} cm  tête ${res.head[0].toFixed(2)}-${res.head[1].toFixed(2)} m (écart ${(res.dhead * 100).toFixed(1)} cm)${bad.length ? '  ' + bad.join(', ') : ''}`);
    console.log(lines[lines.length - 1]);
  }
  // déplacement des bots (06ac-loco.js) : un bot avance dans 8 directions à plusieurs allures, visée ou non, à 60 images par seconde ;
  // glissement de ses pieds au sol (talon et plante de la ranger, comme plus haut), hauteur de la tête, valeurs non finies ; puis la même
  // hauteur avec une version plus ancienne (AVANT) pour comparer. LOCO=0 pour passer.
  if (process.env.LOCO !== '0') {
    const CASES = [];
    for (const [v, sp] of [[1.6, 0], [2.6, 0], [3.3, 0], [5, 0], [5.8, 1]]) for (let d = 0; d < 8; d++) if (!sp || d <= 1 || d === 7) for (const aim of sp ? [0] : [0, 1]) CASES.push({ v, sp, d, aim, c: 0 });
    for (const [v, aim] of [[1.5, 0], [2.2, 1]]) for (let d = 0; d < 8; d++) CASES.push({ v, sp: 0, d, aim, c: 1 });
    for (const c of [0, 1]) for (const aim of [0, 1]) CASES.push({ v: 0, sp: 0, d: 0, aim, c });
    for (const v of [2.4, 4.5]) for (let d = 0; d < 8; d++) CASES.push({ v, sp: 0, d, aim: 1, c: 0, w: 'm9' });
    const run = (pg) => pg.evaluate(([CASES, SEUIL]) => {
      const out = [], HEEL = new V3(0, -0.075, 0.07), PAD = new V3(0, -0.023, -0.03), dt = 1 / 60;
      for (const k of CASES) {
        const th = (k.d * Math.PI) / 4, M = makeSoldier('assault', 1, k.w || 'm4');
        const e = { model: M, pos: new V3(0, 0, 0), vel: new V3(-Math.sin(th) * k.v, 0, -Math.cos(th) * k.v), yaw: 0, pitch: 0, alive: true, crouchAmt: k.c, onGround: true, isPlayer: false, sprinting: !!k.sp, visible: false, target: null, lastShotT: -99, lastSeenT: -99, arms: { adsW: k.aim }, recoil: 0 };
        const tr = [[[], []], [[], []]], hy = []; let nan = 0;
        for (let f = 0; f < 270; f++) {
          e.pos.addScaledVector(e.vel, dt); animSoldier(e, dt);
          if (f < 90) continue;
          for (const j of M.J) if (!Number.isFinite(j.x + j.y + j.z)) nan++;
          hy.push(M.J[J_HEAD].y - e.pos.y);
          for (let i = 0; i < 2; i++) {
            const a = M.bones[i ? SB.FTR : SB.FTL], b = M.bones[i ? SB.TOR : SB.TOL];
            tr[i][0].push(HEEL.clone().applyQuaternion(a.quaternion).add(a.position)); tr[i][1].push(PAD.clone().applyQuaternion(b.quaternion).add(b.position));
          }
        }
        let slip = 0;
        for (let i = 0; i < 2; i++) {
          const lo = Math.min(...tr[i].flat().map((p) => p.y));
          for (const t of tr[i]) { let r = null; for (const w of t) { if (w.y < lo + 0.008) { if (!r) r = { p: w, d: 0 }; else r.d = Math.max(r.d, Math.hypot(w.x - r.p.x, w.z - r.p.z)); } else if (r) { slip = Math.max(slip, r.d); r = null; } } }
        }
        out.push({ slip, nan, h: [Math.min(...hy), hy.reduce((a, b) => a + b, 0) / hy.length, Math.max(...hy)], on: typeof locoInit === 'function' && !!locoInit() });
      }
      return out;
    }, [CASES, SEUIL_PIED]);
    const R1 = await run(page);
    const R0 = await avant(run);
    const DN = ['avant', 'avant-gauche', 'gauche', 'arriere-gauche', 'arriere', 'arriere-droite', 'droite', 'avant-droite'];
    const SEUIL_LOCO = 0.03;
    CASES.forEach((k, i) => {
      const a = R1[i], b = R0 && R0[i], bad = a.nan || a.slip > SEUIL_LOCO;
      if (bad) fails++;
      console.log(`${bad ? 'ECHEC' : 'ok   '} : bot ${k.w ? 'pistolet ' : ''}${k.c ? 'accroupi ' : ''}${String(k.v).padStart(3)} m/s${k.sp ? ' sprint' : k.aim ? ' visée ' : '       '} ${(k.v ? DN[k.d] : 'arrêt').padEnd(15)} glissement ${(a.slip * 100).toFixed(1).padStart(4)} cm  tête ${a.h.map((x) => x.toFixed(2)).join('/')} ${b ? `(avant ${b.h.map((x) => x.toFixed(2)).join('/')})` : ''}${a.nan ? '  valeurs non finies' : ''}${a.on ? '' : '  (clips inactifs)'}`);
    });
  }
  // saut (06ac-loco.js) : sur place, en courant, chute de 3 m ; valeurs non finies, semelle sous le sol après la réception (au plus 3 cm),
  // hauteur de la tête au plus bas de la réception
  if (process.env.LOCO !== '0') {
    const JUMPS = [{ n: 'saut sur place', vy: 6.3, v: 0, y0: 0 }, { n: 'saut en courant', vy: 6.3, v: 5, y0: 0 }, { n: 'chute de 3 m', vy: 0, v: 0, y0: 3 }];
    const jrun = (pg) => pg.evaluate((JUMPS) => JUMPS.map((k) => {
      const M = makeSoldier('assault', 1, 'm4'), dt = 1 / 60, HEEL = new V3(0, -0.075, 0.07), PAD = new V3(0, -0.023, -0.03);
      const e = { model: M, pos: new V3(0, 0, 0), vel: new V3(0, 0, -k.v), yaw: 0, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, sprinting: false, visible: false, target: null, lastShotT: -99, lastSeenT: -99, arms: { adsW: 0 }, recoil: 0, vy: 0 };
      let nan = 0, sink = 0, hMin = 9, tLand = -1, tuck = 0;
      for (let f = 0; f < 150; f++) {
        if (f === 60) { e.vy = k.vy; e.pos.y = k.y0; e.onGround = false; }
        if (!e.onGround) { e.vy -= 19 * dt; e.pos.y += e.vy * dt; if (e.pos.y <= 0) { e.pos.y = 0; e.vy = 0; e.onGround = true; tLand = f; } }
        e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
        animSoldier(e, dt);
        for (const j of M.J) if (!Number.isFinite(j.x + j.y + j.z)) nan++;
        if (!e.onGround) tuck = Math.max(tuck, Math.min(M.J[J_FTL].y, M.J[J_FTR].y) - e.pos.y);
        if (tLand >= 0 && f - tLand < 40) {
          hMin = Math.min(hMin, M.J[J_HEAD].y);
          for (let i = 0; i < 2; i++) {
            const a = M.bones[i ? SB.FTR : SB.FTL], b = M.bones[i ? SB.TOR : SB.TOL];
            sink = Math.max(sink, -HEEL.clone().applyQuaternion(a.quaternion).add(a.position).y, -PAD.clone().applyQuaternion(b.quaternion).add(b.position).y);
          }
        }
      }
      return { nan, sink, hMin, tuck };
    }), JUMPS);
    const J1 = await jrun(page);
    const J0 = await avant(jrun);
    JUMPS.forEach((k, i) => {
      const a = J1[i], b = J0 && J0[i], bad = a.nan || a.sink > 0.03;
      if (bad) fails++;
      console.log(`${bad ? 'ECHEC' : 'ok   '} : ${k.n.padEnd(16)} semelle sous le sol ${(a.sink * 100).toFixed(1)} cm, pieds repliés jusqu'à ${a.tuck.toFixed(2)} m, tête au plus bas ${a.hMin.toFixed(2)} m ${b ? `(avant ${(b.sink * 100).toFixed(1)} cm, ${b.tuck.toFixed(2)} m, ${b.hMin.toFixed(2)} m)` : ''}${a.nan ? '  valeurs non finies' : ''}`);
    });
  }
  // glissade (06ac-loco.js) : 0,8 s de 8 à 3,4 m/s, accroupi ; hauteur de la tête au cœur de la glissade (vers 0,85 m, la caméra du joueur),
  // semelle sous le sol (au plus 3 cm), valeurs non finies
  if (process.env.LOCO !== '0') {
    const srun = (pg) => pg.evaluate(() => {
      const M = makeSoldier('assault', 1, 'm4'), dt = 1 / 60, HEEL = new V3(0, -0.075, 0.07), PAD = new V3(0, -0.023, -0.03);
      const e = { model: M, pos: new V3(), vel: new V3(0, 0, -6), yaw: 0, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, sprinting: true, visible: false, target: null, lastShotT: -99, lastSeenT: -99, arms: { adsW: 0 }, recoil: 0, slideT: 0, slideAmt: 0 };
      for (let f = 0; f < 60; f++) { e.pos.addScaledVector(e.vel, dt); animSoldier(e, dt); }
      e.slideT = 0.8; e.sprinting = false; let nan = 0, sink = 0; const hy = [];
      for (let f = 0; f < 90; f++) {
        const sl = e.slideT > 0; e.slideT = Math.max(0, e.slideT - dt);
        e.slideAmt = damp(e.slideAmt, sl ? 1 : 0, sl ? 12 : 7, dt); e.crouchAmt = damp(e.crouchAmt, 1, 10, dt);
        e.vel.z = -(sl ? lerp(3.4, 8, e.slideT / 0.8) : 1.5); e.pos.addScaledVector(e.vel, dt); animSoldier(e, dt);
        for (const j of M.J) if (!Number.isFinite(j.x + j.y + j.z)) nan++;
        if (f >= 12 && f <= 42) hy.push(M.J[J_HEAD].y);
        for (let i = 0; i < 2; i++) { const a = M.bones[i ? SB.FTR : SB.FTL], b = M.bones[i ? SB.TOR : SB.TOL]; sink = Math.max(sink, -HEEL.clone().applyQuaternion(a.quaternion).add(a.position).y, -PAD.clone().applyQuaternion(b.quaternion).add(b.position).y); }
      }
      return { nan, sink, h: [Math.min(...hy), hy.reduce((a, b) => a + b, 0) / hy.length, Math.max(...hy)] };
    });
    const a = await srun(page);
    const b = await avant(srun);
    const bad = a.nan || a.sink > 0.03; if (bad) fails++;
    console.log(`${bad ? 'ECHEC' : 'ok   '} : glissade         tête ${a.h.map((x) => x.toFixed(2)).join('/')} m, semelle sous le sol ${(a.sink * 100).toFixed(1)} cm ${b ? `(avant : tête ${b.h.map((x) => x.toFixed(2)).join('/')} m)` : ''}${a.nan ? '  valeurs non finies' : ''}`);
  }
  // gestes (06ac-loco.js) : lancer de grenade et rechargement ; valeurs non finies, plus grande rotation du buste (degrés)
  if (process.env.LOCO !== '0') {
    const grun = (pg) => pg.evaluate(() => ['lancer', 'rechargement'].map((g) => {
      const M = makeSoldier('assault', 1, 'm4'), dt = 1 / 60;
      const e = { model: M, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, sprinting: false, visible: false, target: null, lastShotT: -99, lastSeenT: -99, arms: { adsW: 0 }, recoil: 0 };
      for (let f = 0; f < 90; f++) animSoldier(e, dt);
      const u0 = M.J[J_CHE].clone().sub(M.J[J_PEL]).normalize(), s0 = M.J[J_SHR].clone().sub(M.J[J_SHL]).normalize(); let nan = 0, rot = 0;
      if (g === 'lancer') e.throwT = 0.7; else e.arms.reload = { t: 0, dur: 2.4, tube: false, phase: 'mag' };
      for (let f = 0; f < 150; f++) {
        if (e.arms.reload) { e.arms.reload.t += dt; if (e.arms.reload.t > e.arms.reload.dur) e.arms.reload = null; }
        animSoldier(e, dt);
        for (const j of M.J) if (!Number.isFinite(j.x + j.y + j.z)) nan++;
        const u = M.J[J_CHE].clone().sub(M.J[J_PEL]).normalize(), sh = M.J[J_SHR].clone().sub(M.J[J_SHL]).normalize();
        rot = Math.max(rot, Math.acos(clamp(u.dot(u0), -1, 1)), Math.acos(clamp(sh.dot(s0), -1, 1)));
      }
      return { nan, rot: (rot * 180) / Math.PI };
    }));
    const G1 = await grun(page);
    const G0 = await avant(grun);
    ['lancer de grenade', 'rechargement'].forEach((n, i) => {
      const a = G1[i], b = G0 && G0[i]; if (a.nan) fails++;
      console.log(`${a.nan ? 'ECHEC' : 'ok   '} : ${n.padEnd(18)} buste tourné jusqu'à ${a.rot.toFixed(0)} degrés ${b ? `(avant ${b.rot.toFixed(0)})` : ''}${a.nan ? '  valeurs non finies' : ''}`);
    });
  }
  // coup reçu (06ac-loco.js) : de face, de côté, de dos, à la tête ; valeurs non finies et plus grand déplacement de la tête et du cou
  // pendant 0,6 s
  if (process.env.LOCO !== '0') {
    const HITS = [{ n: 'de face', x: 0, z: 1 }, { n: 'de côté', x: 1, z: 0 }, { n: 'de dos', x: 0, z: -1 }, { n: 'à la tête', x: 0, z: 1, h: 1 }];
    const hrun = (pg) => pg.evaluate((HITS) => HITS.map((k) => {
      const M = makeSoldier('assault', 1, 'm4'), dt = 1 / 60;
      const e = { model: M, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, sprinting: false, visible: false, target: null, lastShotT: -99, lastSeenT: -99, arms: { adsW: 1 }, recoil: 0 };
      for (let f = 0; f < 120; f++) animSoldier(e, dt);
      const h0 = M.J[J_HEAD].clone(), c0 = M.J[J_CHE].clone(); let nan = 0, dh = 0, dc = 0;
      M.hitKick = k.h ? 1.4 : 1; M.hitHead = !!k.h; M.hitDir = new V3(k.x, 0, k.z);
      for (let f = 0; f < 36; f++) {
        animSoldier(e, dt);
        for (const j of M.J) if (!Number.isFinite(j.x + j.y + j.z)) nan++;
        dh = Math.max(dh, M.J[J_HEAD].distanceTo(h0)); dc = Math.max(dc, M.J[J_CHE].distanceTo(c0));
      }
      return { nan, dh, dc };
    }), HITS);
    const H1 = await hrun(page);
    const H0 = await avant(hrun);
    HITS.forEach((k, i) => {
      const a = H1[i], b = H0 && H0[i];
      if (a.nan) fails++;
      console.log(`${a.nan ? 'ECHEC' : 'ok   '} : coup reçu ${k.n.padEnd(10)} tête déplacée de ${(a.dh * 100).toFixed(1)} cm, cou de ${(a.dc * 100).toFixed(1)} cm ${b ? `(avant ${(b.dh * 100).toFixed(1)} et ${(b.dc * 100).toFixed(1)} cm)` : ''}${a.nan ? '  valeurs non finies' : ''}`);
    });
  }
  // coût de la pose : 12 soldats en déplacement
  const cost = await page.evaluate(() => {
    const E = []; for (let i = 0; i < 12; i++) { const M = makeSoldier('assault', 1, 'm4'); E.push({ model: M, pos: new V3(i * 2, 0, 0), vel: new V3(Math.sin(i) * 3, 0, Math.cos(i) * 3), yaw: i, pitch: 0, alive: true, crouchAmt: i % 3 === 0 ? 1 : 0, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -99, lastSeenT: -99, arms: { adsW: i % 2 }, recoil: 0 }); }
    for (let k = 0; k < 60; k++) for (const e of E) animSoldier(e, 1 / 60);
    // minimum de sept séries (le ramasse-miettes et la machine faussent une mesure unique)
    let best = 1e9;
    for (let rep = 0; rep < 7; rep++) { const t0 = performance.now(); for (let k = 0; k < 100; k++) for (const e of E) animSoldier(e, 1 / 60); best = Math.min(best, (performance.now() - t0) / 100); }
    return best;
  });
  console.log(`coût de la pose : ${cost.toFixed(3)} ms par image pour 12 soldats (poseSoldier et layoutSoldier)`);
  // captures : le clip (lignes) à gauche, le soldat à droite, de face puis de profil, au tiers du clip
  if (out && cap.length) {
    fs.mkdirSync(out, { recursive: true });
    for (const r of ref.filter((r) => cap.includes('tous') || cap.some((k) => r.id.includes(k)))) {
      for (const view of ['face', 'profil']) {
        await page.evaluate(([r, SEG, view]) => {
          const c = animClip(r.id), m = animSmp(), f = Math.floor(c.n / 3), x0 = 0, z0 = 30, y0 = groundHeight(x0, z0, 3, 0.3);
          animRead(c, f, m);
          const S = window.__S2 || (window.__S2 = makeSoldier('assault', 0, 'm4')); setSoldierLod(S, true);
          window.__pose(S, m, new V3(x0 + 0.5, y0, z0));
          if (window.__L) scene.remove(window.__L);
          const pts = []; for (const [a, b] of SEG) { const A = r.R[f][a], B = r.R[f][b]; pts.push(x0 - 0.5 + A[0], y0 + A[1], z0 + A[2], x0 - 0.5 + B[0], y0 + B[1], z0 + B[2]); }
          const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
          window.__L = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x2a6fdb, depthTest: false })); scene.add(window.__L);
          if (view === 'face') { camera.position.set(x0, y0 + 1.0, z0 - 3.4); } else { camera.position.set(x0 + 3.6, y0 + 1.0, z0); }
          camera.lookAt(x0, y0 + 0.9, z0); camera.fov = 40; camera.updateProjectionMatrix();
          for (const l of csm.lights) l.shadow.needsUpdate = true;
          const t = performance.now(); for (let k = 0; k < 2; k++) frame(t + k * 16);
        }, [r, SEG, view]);
        await page.screenshot({ path: path.join(out, `${r.id.replace(/\//g, '_')}-${view}.png`), timeout: 240000 });
      }
    }
  }
  await g.browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
