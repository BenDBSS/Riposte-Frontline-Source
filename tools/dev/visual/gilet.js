/* Contrôle du Gilet jaune (06gc-tenues-defi.js) : le gilet ne rentre jamais dans le corps. Un soldat en Gilet jaune passe par les poses du
   jeu (repos, marche, course, sprint, recul, pas chassés, accroupi, visée, saut, pistolet), tissu simulé ; à chaque image, chaque point du
   gilet (partie cousue, skinnée comme le fait le moteur, et particules du tissu) est mesuré :
   - torse : une particule du tissu ne passe pas sous sa cible de plus que l'écart du gilet à la veste (GJ.g) ; la partie cousue a les mêmes
     poids que la veste dessous ;
   - bras et cuisses : aucun point dans la manche ni dans la jambe de pantalon (leur profil, dans le repère de leur os, hors du raccord au
     tronc où les poids se mêlent : les 6 premiers centimètres du bras, 5 de la cuisse, où ce profil rigide surestime la manche). Un point
     n'est en défaut que si la veste juste dessous n'y est pas déjà, ni à moins de 3 mm (le bras repose alors sur la poitrine, tout vêtement le croise) : le corps de base fait entrer la racine du bras dans la poitrine (jusqu'à
     5 cm, bras tendu vers le garde-main), le gilet posé 14 mm au-dessus en hérite sans rien ajouter de visible ; ces points sont comptés à part.
   À 3 mm près : le membre est mesuré par une section ronde, à son rayon le plus grand, alors que la manche est un peu aplatie (4 % de moins,
   2 mm, côté intérieur).
   node tools/dev/visual/gilet.js ; DETAIL=1 liste les points cousus en défaut (hauteur, angle depuis l'avant) ; code d'erreur au premier échec. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low' }, noMap: true, noHdri: true });
  const r = await page.evaluate(() => {
    const R = soldierRest(), one = new V3(1, 1, 1);
    const POSES = [
      ['repos', {}], ['marche', { v: 2 }], ['course', { v: 4.2 }], ['sprint', { v: 6.5, sprint: true }], ['recul', { v: -2.5 }], ['chasse', { vx: 3 }],
      ['accroupi', { crouch: 1 }], ['accroupi-marche', { crouch: 1, v: 1.6 }], ['visee', { ads: 1 }], ['visee-marche', { ads: 1, v: 2 }], ['saut', { air: true, v: 3 }],
      ['pistolet', { gun: 'm9', v: 2 }],
    ];
    // profils de la manche et de la jambe de pantalon (soldierBase) : rayon le plus grand à la distance d de l'articulation
    const ARM = [[-0.085, 0.02], [-0.075, 0.04], [-0.06, 0.053], [-0.04, 0.061], [-0.01, 0.065], [0.04, 0.06], [0.09, 0.054], [0.14, 0.053], [0.2, 0.05], [0.25, 0.045], [SD.ua, 0.044]];
    const LEG = [[-0.09, 0.098], [-0.03, 0.1], [0.03, 0.1], [0.1, 0.092], [0.18, 0.084], [0.26, 0.075], [0.33, 0.066], [0.39, 0.06], [0.43, 0.063]];
    const prof = (P, d, k) => { if (d < P[0][0] || d > P[P.length - 1][0]) return 0; let i = 0; while (i < P.length - 2 && P[i + 1][0] < d) i++; return lerp(P[i][1], P[i + 1][1], (d - P[i][0]) / (P[i + 1][0] - P[i][0])) * k; };
    // partie cousue du gilet, seule (positions de repos, normales, poids)
    const B = new SkinBuilder(), U = []; GEAR_HI = true; gjVest(B, true, U); const nv = B.count; // (U : la veste sous chaque sommet)
    const out = { poses: {}, ou: {} };
    for (const [nm, o] of POSES) {
      const M = makeSoldier('gilet', 0, o.gun || 'm4');
      const e = { model: M, pos: new V3(0, 0, 0), vel: new V3(), yaw: Math.PI, pitch: 0, alive: true, crouchAmt: o.crouch || 0, onGround: !o.air, isPlayer: false, visible: false, target: null, lastShotT: -9, lastSeenT: -99, arms: { adsW: o.ads || 0 }, recoil: 0, sprinting: !!o.sprint, hp: 100, team: 0, throwT: 0 };
      setSoldierLod(M, true);
      const mats = [], inv = [], rinv = []; for (let i = 0; i < SOLDIER_NB; i++) { mats.push(new THREE.Matrix4()); inv.push(new THREE.Matrix4()); rinv.push(R.mats[i].clone().invert()); }
      const p = new V3(), q = new V3(), s = new V3(), jp = new V3(), lq = new V3(), sk = new V3(), stat = { n: 0, torse: 0, bras: 0, cuisse: 0, herite: 0, max: 0, ou: '' };
      // pénétration la plus forte de x dans un bras ou une cuisse
      const inLimb = (x, tol = 0.003) => {
        let best = null;
        for (const sx of [-1, 1]) {
          const b = SIDE_B(sx);
          for (const [bone, P, k, d0, d1, nmL] of [[b.ua, ARM, 1.02, 0.06, SD.ua, 'bras'], [b.th, LEG, 1, 0.05, SD.thigh, 'cuisse']]) {
            lq.copy(x).applyMatrix4(inv[bone]); const d = -lq.z; if (d < d0 || d > d1) continue;
            const pen = prof(P, d, k) - Math.hypot(lq.x, lq.y);
            if (pen > tol && (!best || pen > best.pen)) best = { pen, nmL, side: sx > 0 ? 'droit' : 'gauche', d };
          }
        }
        return best;
      };
      // x : point du gilet ; under : la veste juste dessous (même pose)
      const check = (x, under, part, key) => {
        const L = inLimb(x); if (!L) return;
        if (inLimb(under, -0.003)) { stat.herite++; return; } // (la veste dessous dans le membre, ou à moins de 3 mm : le bras y repose déjà)
        stat[L.nmL]++;
        if (key) out.ou[key] = (out.ou[key] || 0) + 1;
        if (L.pen > stat.max) { stat.max = L.pen; stat.ou = `${part} dans ${L.nmL} ${L.side} (d ${L.d.toFixed(2)}, ${(L.pen * 1000).toFixed(0)} mm)`; }
      };
      const skinned = (P0, v, o2) => { o2.set(0, 0, 0); for (let k = 0; k < 4; k++) { const w = B.sw[v * 4 + k]; if (w > 0) o2.addScaledVector(sk.copy(P0).applyMatrix4(mats[B.si[v * 4 + k]]), w); } return o2; };
      for (let f = 0; f < 90; f++) {
        e.vel.set(o.vx || 0, 0, o.v || 0); e.pos.x += (o.vx || 0) / 60; e.pos.z += (o.v || 0) / 60;
        animSoldier(e, 1 / 60);
        if (M.cloth) clothSimulate(M, M.cloth, 1 / 60);
        CLOTH.t += 1 / 60;
        if (f < 30 || f % 3) continue;
        for (let i = 0; i < SOLDIER_NB; i++) { const b = M.bones[i]; mats[i].compose(b.position, b.quaternion, one); inv[i].copy(mats[i]).invert(); mats[i].multiply(rinv[i]); } // (os courant x inverse du repos, comme clothBones)
        // partie cousue : skinnée comme le fait le moteur ; la veste dessous (gjVest), mêmes poids
        for (let v = 0; v < nv; v++) {
          const P0 = new V3(B.p[v * 3], B.p[v * 3 + 1], B.p[v * 3 + 2]);
          skinned(P0, v, p); skinned(U[v], v, jp);
          stat.n++; check(p, jp, 'gilet cousu', `${P0.y.toFixed(2)} ${(Math.atan2(P0.x, -P0.z) * 180 / Math.PI).toFixed(0)}`);
        }
        // tissu : sous sa cible (le torse), et dans les membres ; la veste dessous : la cible, GJ.g plus bas le long de sa normale
        const C = M.cloth; if (!C) continue;
        const sim = C.sim, T = sim.T, N = new Float32Array(T.n * 3); clothNormals(T, sim.tgt, N);
        for (let i = 0; i < T.n; i++) {
          if (T.pin[i] >= 1) continue;
          p.fromArray(sim.p, i * 3); q.fromArray(sim.tgt, i * 3); s.fromArray(N, i * 3);
          const pen = -p.clone().sub(q).dot(s) - (GJ.g - 0.002);
          stat.n++;
          if (pen > 0) { stat.torse++; if (pen > stat.max) { stat.max = pen; stat.ou = `tissu sous la veste (particule ${i}, ${(pen * 1000).toFixed(0)} mm)`; } }
          check(p, jp.copy(q).addScaledVector(s, -GJ.g), 'tissu', null);
        }
      }
      out.poses[nm] = stat;
      if (M.cloth) clothDetach(M);
      M.root.removeFromParent();
    }
    return out;
  });
  if (process.env.DETAIL) console.log('points cousus en défaut (y, angle depuis l\'avant en degrés : nombre) :', Object.entries(r.ou).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => k + ':' + n).join('  '));
  for (const [nm, s] of Object.entries(r.poses)) ok(s.torse + s.bras + s.cuisse === 0, `${nm} : ${s.n} points mesurés, torse ${s.torse}, bras ${s.bras}, cuisses ${s.cuisse}${s.ou ? ', pire : ' + s.ou : ''} (hérités du corps de base : ${s.herite})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon|HDRI/.test(l));
  ok(errs.length === 0, `aucune erreur de la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
