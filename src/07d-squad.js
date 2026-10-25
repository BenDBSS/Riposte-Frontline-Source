/* ==========================================================================
   PLAN D'ÉQUIPE EN DOMINATION
   Les bots ne choisissent plus un point au hasard : toutes les 1,5 s (et dès qu'un point change de main), chaque équipe refait son
   plan. Chaque point a un besoin (combien de soldats, et l'urgence) :
     - à l'adversaire : 3 soldats (attaque) ; neutre : 2 (attaque) ;
     - à nous et contesté : 2 (défense) ; à nous et calme : 1 sentinelle ; un adversaire repéré près d'un point à nous (appel à la
       radio d'un coéquipier, SQ.intel) en ajoute un ;
     - en retard au score, on pèse l'attaque ; en avance, la défense ; le joueur, sur un point, compte comme un soldat de l'équipe.
   L'affectation est gloutonne sur le meilleur couple soldat/point (urgence moins distance), avec de l'inertie : un bot qui garde déjà
   son point, ou qui est en train de le capturer ou de s'y battre, ne le quitte pas pour un gain marginal. Un point pris, ses
   attaquants ne s'y attardent pas : le besoin tombe à une sentinelle et les autres se font réaffecter (rotation) vers le point suivant.
   Les surnuméraires renforcent le point le plus urgent. Un bot qui a un plan n'est pas téléguidé : il se bat normalement dès qu'il
   voit un adversaire, et revient à son point ensuite (decideTactic limite la traque loin de lui).
   ========================================================================== */
const SQ = { at: [-99, -99], intel: [null, null], rev: 0 };
function squadDirty() { SQ.at[0] = SQ.at[1] = -99; }
/* Début de partie : le dernier signalement de la partie d'avant ne vaut plus (son heure, MATCH.time, passait pour récente : l'horloge repart de zéro) */
function squadReset() { SQ.intel[0] = SQ.intel[1] = null; squadDirty(); }
/* Un bot qui repère un adversaire le signale à son équipe : position et instant (sans suivi : le plan s'en sert pour renforcer) */
function squadIntel(b, foe, now) { SQ.intel[b.team] = { x: foe.pos.x, z: foe.pos.z, t: now }; }
function squadMaybe(t, now) { if (now < SQ.at[t] - 0.01 || now - SQ.at[t] >= 1.5) squadPlan(t, now); }

function squadPlan(t, now) {
  SQ.at[t] = now;
  const pts = DOM.pts; if (!pts.length) return;
  const bots = entities.filter((e) => e.alive && !e.off && !e.isPlayer && !e.isRemote && e.team === t);
  if (!bots.length) return;
  const foe = 1 - t, lead = MATCH.score[t] - MATCH.score[foe], I = SQ.intel[t] && now - SQ.intel[t].t < 8 ? SQ.intel[t] : null;
  const me = PL.ent.team === t && PL.ent.alive ? PL.ent : null;
  const need = pts.map((p, i) => {
    const hot = p.contest || p.n[foe] > 0;
    let n, pr, role = 'attack';
    if (p.owner === t) { role = 'defend'; n = hot ? 2 : 1; pr = hot ? 3 : 0.8 + (lead > 0 ? 0.3 : 0); if (I && hyp(I.x - p.x, I.z - p.z) < 20) { n++; pr += 1; } }
    else { n = p.owner === -1 ? 2 : 3; pr = (p.owner === -1 ? 2.2 : 2.5) + (lead < 0 ? 0.4 : 0); }
    if (me && hyp(me.pos.x - p.x, me.pos.z - p.z) < DOM.rad + 8 && Math.abs(me.pos.y - p.y) < DOM.dy + 2) n = Math.max(0, n - 1);
    return { i, n, pr, role, got: 0 };
  });
  const score = (b, nd) => {
    const p = pts[nd.i], d = hyp(p.x - b.pos.x, p.z - b.pos.z);
    let sc = nd.pr - d / 30;
    if (b.sq && b.sq.p === nd.i) sc += 0.8;                                        // inertie
    if (b.sq && b.sq.p === nd.i && d < DOM.rad && p.owner !== t) sc += 1.5;         // en pleine capture : il finit
    if (b.sq && b.sq.p === nd.i && b.visible) sc += 2;                               // en plein combat devant le point
    return sc;
  };
  const free = bots.slice(), pick = new Map();
  while (free.length) {
    let bb = null, bn = null, bs = -1e9;
    for (const b of free) for (const nd of need) if (nd.n > 0) { const sc = score(b, nd); if (sc > bs) { bs = sc; bb = b; bn = nd; } }
    if (!bb) { // tous les besoins sont couverts : les autres renforcent le point le plus urgent, sans l'encombrer
      for (const b of free) {
        let best = null, bw = -1e9;
        for (const nd of need) { const sc = score(b, nd) - nd.got * 0.7; if (sc > bw) { bw = sc; best = nd; } }
        pick.set(b, best); best.got++;
      }
      break;
    }
    pick.set(bb, bn); bn.n--; bn.got++; free.splice(free.indexOf(bb), 1);
  }
  for (const [b, nd] of pick) if (!b.sq || b.sq.p !== nd.i || b.sq.role !== nd.role) b.sq = { p: nd.i, role: nd.role, rev: ++SQ.rev };
}

/* Où aller : l'attaquant entre dans la zone et y reste quelques secondes (il en change à chaque fois, pour couvrir les angles) ;
   le défenseur prend un couvert qui tient la zone, face à l'arrivée adverse, et y reste plus longtemps */
function squadGoal(b, now) {
  if (!b.sq) squadPlan(b.team, now);
  const a = b.sq; if (!a) return null;
  const p = DOM.pts[a.p]; if (!p) return null;
  if (a.role === 'attack') { const g = domSpot(p, 0.5, 3.2); g.holdFor = rand(3, 6); return g; }
  const own = b.team === 0 ? 1 : -1, I = SQ.intel[b.team] && now - SQ.intel[b.team].t < 8 ? SQ.intel[b.team] : null;
  const list = coverNear(p.x, p.z, DOM.rad + 5, []).filter((c) => (!c.owner || !c.owner.alive || c.owner === b) && Math.abs(c.y - p.y) < 1.5
    && hyp(c.x - p.x, c.z - p.z) < DOM.rad + 4 && !entities.some((o) => o !== b && o.alive && allied(o, b) && hyp(o.pos.x - c.x, o.pos.z - c.z) < 2.5));
  const g = list.length && Math.random() < 0.75 ? (() => { const c = pick(list); const v = new V3(c.x, c.y, c.z); v.hold = true; v.dom = p.i; return v; })() : domSpot(p, 0.5, DOM.rad - 1.5);
  g.holdFor = rand(6, 10);
  g.look = I ? { x: I.x, z: I.z } : { x: p.x + rand(-8, 8), z: p.z - own * 20 };
  return g;
}
