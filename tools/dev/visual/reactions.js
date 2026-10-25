/* Réactions des bots, trois mesures (README « IA des bots ») : node reactions.js [carte=sable] [secondes=150]   (PAGE=autre version, DIFF=0 à 2,
   N=essais de cachette, 24 par défaut ; TRACE=1 : un essai par ligne)
   - sauts : partie accélérée entre bots (le joueur, invulnérable, reste dans sa base), chaque saut rangé selon sa cause : lien de saut du
     chemin (`leap`), sortie de blocage (`unstick`), autre ; et leur nombre par minute et par bot vivant. Le saut-esquive en combat (`hop`, dont
     `hopLibre` : sans être sous le feu) a été retiré après la 4.15 : il ne se compte que sur une version d'avant (PAGE=) ;
   - retournement : un bot ennemi, seul en jeu, tourne le dos au joueur à 14 m (il marche, ou un essai sur deux il tient une position) et prend
     une balle ; médianes, en secondes après l'impact, du début de la rotation, du moment où il fait face (à 0,25 rad près), où il le repère et
     de son premier tir ;
   - cachette : le même bot voit le joueur, à découvert à côté d'un haut couvert, 1,5 s ; le joueur passe derrière le couvert et n'en bouge
     plus. Part des essais où le bot le retrouve en 10 s, en 20 s, délai médian, part des bots qui abandonnent avant (retour à la promenade).
   Les positions des essais sont tirées à part du jeu (graine fixe) : deux versions passent les mêmes essais. Le bot des essais n'a pas de fusil
   de précision (le tireur d'élite ne poursuit pas, voulu). Les résultats bougent d'une partie à l'autre : comparer sur plusieurs cartes. */
const { openGame } = require('./common');
(async () => {
  const map = process.argv[2] || 'sable', secs = +(process.argv[3] || 150);
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 480, h: 270, settings: { quality: 'low', difficulty: +(process.env.DIFF || 2), map, mode: 'tdm' }, noHdri: true });
  const r = await page.evaluate(([secs, nCache, trace]) => {
    LOCK.fallback = true; startMatch({});
    let seed = 12345; // tirage des essais, à part de celui du jeu
    const R = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const dt = 1 / 30, bots = entities.filter((e) => !e.isPlayer), lines = [];
    const step = (list) => { MATCH.time += dt; MATCH.timeLeft -= dt; PL.ent.health = 1e9; for (const e of list) { if (e.protT > 0) e.protT -= dt; updateBot(e, dt, MATCH.time); } updateNades(dt); };
    const med = (arr) => { const v = arr.filter((x) => x !== null).sort((p, q) => p - q); return v.length ? +v[Math.floor(v.length / 2)].toFixed(2) : null; };
    const pct = (k, n) => Math.round(k / (n || 1) * 100) + ' %';

    /* ---------- sauts ---------- */
    PL.ent.pos.set(SPAWNS[0][0][0], 0, VOID.on ? SPAWNS[0][0][1] + 4 : MAP.z1 - 0.5);
    const J = { hop: 0, hopLibre: 0, leap: 0, unstick: 0, autre: 0 }, ground = new Map(bots.map((e) => [e, true]));
    let alive = 0;
    for (let i = 0; i < secs * 30; i++) {
      MATCH.time += dt; MATCH.timeLeft -= dt; PL.ent.health = 1e9;
      for (const e of bots) if (e.protT > 0) e.protT -= dt;
      for (let k = MATCH.events.length - 1; k >= 0; k--) if (MATCH.events[k].t <= MATCH.time) { const ev = MATCH.events[k]; MATCH.events.splice(k, 1); ev.fn(); }
      for (const e of bots) {
        const lp = e.path && e.pathI < e.path.length ? e.path[e.pathI] : null, fire = MATCH.time - e.lastHitT < 1.5 || (e.suppr || 0) > 0.4;
        updateBot(e, dt, MATCH.time);
        if (!e.alive) { ground.set(e, true); continue; }
        alive += dt;
        if (ground.get(e) && !e.onGround && e.vy > 1) {
          if (e.tactic === 'fight' && MATCH.time - e.hopAt < 0.01) { J.hop++; if (!fire) J.hopLibre++; }
          else if (MATCH.time - e.unstickAt < 0.6) J.unstick++;
          else if ((lp && lp.jump) || (e.path && e.path[e.pathI] && e.path[e.pathI].jump)) J.leap++;
          else J.autre++;
        }
        ground.set(e, e.onGround);
      }
      updateNades(dt);
    }
    J.parMinuteParBot = +((J.hop + J.leap + J.unstick + J.autre) / (alive / 60)).toFixed(2);

    /* ---------- un seul bot ennemi en jeu pour les essais ---------- */
    const foe = bots.find((e) => e.team !== PL.ent.team && !e.weapon.ai.sniper);
    for (const e of bots) { e.off = e !== foe; if (e.off) e.alive = false; }
    NADES.length = 0; soundEvents.length = 0;
    const place = (p, yaw) => {
      if (!foe.alive) { foe.respawnT = 0; spawnEntity(foe); }
      foe.pos.copy(p); foe.vel.set(0, 0, 0); foe.yaw = foe.lookYaw = yaw; foe.pitch = 0; foe.yawV = 0; foe.pitchV = 0; foe.protT = 0; foe.health = 100;
      initTactics(foe); foe.aw.clear(); foe.target = null; foe.visible = false; foe.lastSeenT = -99; foe.path = null; foe.goal = null; foe.holdT = 0; foe.aimT = null; foe.lookAtT = 0;
      foe.nades = 0; foe.lastHitT = -9; foe.suppr = 0; foe.fear = 0; foe.revenge = null; foe.warnT = 0; foe.recT = foe.backT = foe.sideT = 0; foe.unstickN = 0; foe.lastPos.copy(foe.pos);
      SQ.intel[foe.team] = null;
    };
    const sees = (a, p) => lineClear(new V3(a.x, a.y + 1.62, a.z), new V3(p.x, p.y + 1.62, p.z)) || lineClear(new V3(a.x, a.y + 1.62, a.z), new V3(p.x, p.y + 1.2, p.z));
    const nodeAt = (x, y, z, tol) => { const id = navNode(x, y, z); if (id < 0 || NAV.comp[id] !== NAV.mainComp || Math.hypot(NAV.nx[id] - x, NAV.nz[id] - z) > tol || Math.abs(NAV.ny[id] - y) > 0.6) return null; return new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]); };
    const yawTo = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
    const putPlayer = (p) => { PL.ent.pos.copy(p); PL.ent.vel.set(0, 0, 0); PL.ent.crouch = false; };

    /* ---------- retournement ---------- */
    const turn = [];
    for (let tr = 0, tries = 0; tr < 20 && tries < 400; tries++) {
      const id = Math.floor(R() * NAV.count); if (NAV.comp[id] !== NAV.mainComp) continue;
      const bp = new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]), a = R() * Math.PI * 2, pp = nodeAt(bp.x + Math.cos(a) * 14, bp.y, bp.z + Math.sin(a) * 14, 1.5);
      if (!pp || !sees(bp, pp)) continue;
      const hold = tr % 2 === 1;
      putPlayer(pp); place(bp, yawTo(bp, pp) + Math.PI);
      if (hold) { foe.holdT = 30; foe.holdLookP = { x: 2 * bp.x - pp.x, z: 2 * bp.z - pp.z }; }
      else { const ahead = nodeAt(bp.x - (pp.x - bp.x) * 1.5, bp.y, bp.z - (pp.z - bp.z) * 1.5, 3); if (!ahead) continue; setPath(foe, ahead); if (!foe.path) continue; }
      for (let i = 0; i < 15; i++) step([foe]);
      const t0 = MATCH.time, shots0 = foe.arms.shots, y0 = foe.lookYaw;
      PL.ent.lastShotT = t0; applyDamage(foe, 12, PL.ent, 'M4A1', false, new V3(foe.pos.x - pp.x, 0, foe.pos.z - pp.z).normalize());
      const T = { start: null, face: null, see: null, shot: null };
      for (let i = 0; i < 6 * 30; i++) {
        step([foe]); const t = MATCH.time - t0;
        if (T.start === null && Math.abs(angDiff(y0, foe.lookYaw)) > 0.1) T.start = t;
        if (T.face === null && Math.abs(angDiff(foe.lookYaw, yawTo(foe.pos, PL.ent.pos))) < 0.25) T.face = t;
        if (T.see === null && foe.visible && foe.target === PL.ent) T.see = t;
        if (foe.arms.shots > shots0) { T.shot = t; break; }
      }
      turn.push(T); tr++;
      if (trace) lines.push('retournement ' + (hold ? 'posté ' : 'en marche ') + ['start', 'face', 'see', 'shot'].map((k) => T[k] === null ? '-' : T[k].toFixed(2)).join(' '));
    }
    const B = { essais: turn.length, debutRotation: med(turn.map((t) => t.start)), face: med(turn.map((t) => t.face)), repere: med(turn.map((t) => t.see)), premierTir: med(turn.map((t) => t.shot)) };

    /* ---------- cachette ---------- */
    const hid = [], highs = COVERS.filter((c) => !c.low);
    for (let tr = 0, tries = 0; tr < nCache && tries < 6000 && highs.length; tries++) {
      const c = highs[Math.floor(R() * highs.length)], D = 12 + R() * 8, bp = nodeAt(c.x + c.nx * D, c.y, c.z + c.nz * D, 2); if (!bp) continue;
      const hp = new V3(c.x, c.y, c.z); if (sees(bp, hp)) continue;
      let ep = null; // à découvert, à côté du couvert, en vue du bot
      for (const s of [2.5, -2.5, 3.5, -3.5]) { const q = nodeAt(c.x - c.nz * s, c.y, c.z + c.nx * s, 0.8); if (q && sees(bp, q)) { ep = q; break; } }
      if (!ep || !findPath(bp, hp, -1)) continue;
      putPlayer(ep); place(bp, yawTo(bp, ep));
      let ok = false;
      for (let i = 0; i < 4 * 30; i++) { step([foe]); if (foe.visible && foe.target === PL.ent) { ok = true; break; } }
      if (!ok) continue;
      for (let i = 0; i < 45; i++) step([foe]); // 1,5 s d'échange
      putPlayer(hp);
      const t0 = MATCH.time, steps = []; let found = null, quit = null, last = '';
      for (let i = 0; i < 25 * 30; i++) {
        step([foe]); const t = MATCH.time - t0;
        if (!foe.alive) break;
        if (trace && foe.tactic !== last) { last = foe.tactic; steps.push(last + '@' + t.toFixed(1) + ':' + foe.pos.distanceTo(hp).toFixed(1) + 'm'); }
        if (foe.visible && foe.target === PL.ent && t > 0.3) { found = t; break; }
        if (quit === null && foe.tactic === 'roam' && t > 0.5) quit = t;
      }
      hid.push({ found, quit }); tr++;
      if (trace) lines.push('cachette ' + (found === null ? 'non trouvé ' : 'trouvé en ' + found.toFixed(1) + ' s ') + steps.join(' '));
    }
    const C = { essais: hid.length, trouveEn10s: pct(hid.filter((h) => h.found !== null && h.found < 10).length, hid.length), trouveEn20s: pct(hid.filter((h) => h.found !== null && h.found < 20).length, hid.length),
      delaiMedian: med(hid.map((h) => h.found)), abandon: pct(hid.filter((h) => h.quit !== null && (h.found === null || h.quit < h.found)).length, hid.length) };
    return { carte: CURMAP.id, sauts: J, retournement: B, cachette: C, lines };
  }, [secs, +(process.env.N || 24), !!process.env.TRACE]);
  const lines = r.lines; delete r.lines;
  console.log(JSON.stringify(r));
  for (const l of lines) console.log(l);
  if (logs.length) console.log(logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND')).slice(0, 10).join('\n'));
  await browser.close();
})();
