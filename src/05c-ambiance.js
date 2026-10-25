/* ==========================================================================
   SONS DANS L'ESPACE : émetteurs qui suivent un objet (hélicoptère, avions, drone, eau), ambiance enregistrée des cartes
   et bruits des séries d'éliminations (terminal, tablette, avions, bombes, drone).
   ========================================================================== */

/* ---------- Émetteurs ----------
   Une banque d'échantillons jouée (en boucle ou non) à travers un passe-bas d'absorption de l'air, un panoramique 3D et un gain ;
   sfxEmitterMove la déplace (à chaque image pour un objet mobile). o : gain, loop, off, rate, t (départ), e (prise imposée), ref, roll,
   max (panoramique), air (distance en m sur laquelle les aigus s'éteignent, 0 : aucun filtre), verb (envoi à la réverbération),
   fade (montée du gain, s), dest (sortie : AU.bus par défaut). Renvoie null si la banque n'est pas prête. */
function sfxEmitter(id, pos, o) {
  if (!AU.ready || !sfxHas(id)) return null;
  o = o || {};
  const ctx = AU.ctx, lp = ctx.createBiquadFilter(), pan = ctx.createPanner(), out = ctx.createGain(), t = ctx.currentTime;
  lp.type = 'lowpass'; lp.frequency.value = 18000;
  pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = o.ref || 6; pan.rolloffFactor = o.roll || 1; pan.maxDistance = o.max || 500;
  const g = o.gain === undefined ? 1 : o.gain;
  if (o.fade) { out.gain.value = 0.0001; out.gain.setTargetAtTime(g, t, o.fade); } else out.gain.value = g;
  lp.connect(pan); pan.connect(out); out.connect(o.dest || AU.bus);
  let vs = null; if (o.verb) { vs = ctx.createGain(); vs.gain.value = o.verb; out.connect(vs); vs.connect(AU.verb); }
  const v = sfxPlay(id, lp, o.t || t, { loop: o.loop, off: o.off, rate: o.rate, e: o.e });
  if (!v) { out.disconnect(); return null; }
  const E = { v, lp, pan, out, vs, air: o.air === undefined ? 90 : o.air, p: new V3() };
  sfxEmitterMove(E, pos);
  return E;
}
function sfxEmitterMove(E, p) {
  if (!E) return;
  const P = E.pan; E.p.copy(p);
  if (P.positionX) { P.positionX.value = p.x; P.positionY.value = p.y; P.positionZ.value = p.z; } else P.setPosition(p.x, p.y, p.z);
  if (E.air) E.lp.frequency.value = 18000 * Math.pow(1400 / 18000, clamp(p.distanceTo(camera.position) / E.air, 0, 1));
}
function sfxEmitterStop(E, tau = 0.15) {
  if (!E || E.dead || !AU.ctx) return; E.dead = true;
  const t = AU.ctx.currentTime;
  E.out.gain.cancelScheduledValues(t); E.out.gain.setTargetAtTime(0.0001, t, tau);
  try { E.v.s.stop(t + tau * 8); } catch (e) { /* déjà arrêtée */ }
  setTimeout(() => { for (const n of [E.out, E.pan, E.lp, E.vs]) if (n) n.disconnect(); }, tau * 8000 + 200);
}
/* Un échantillon ponctuel dans le monde (retard de propagation compris) ; renvoie la voix, ou null si la banque n'est pas prête */
function sfxAt(id, pos, gain = 1, o) {
  if (!AU.ready || !sfxHas(id)) return null;
  o = o || {};
  const d = pos.distanceTo(camera.position), t = AU.ctx.currentTime + (o.delay || 0) + (o.prop === false ? 0 : Math.min(d / 343, 0.4));
  return sfxPlay(id, auOut(pos, o.verb === undefined ? 0.15 : o.verb, gain, o.roll || 1, o.ref || 5), t, { rate: o.rate || rand(0.95, 1.05), off: o.off, e: o.e });
}

/* ---------- Ambiance des cartes ----------
   MAP_DEFS.<id>.sound = {
     pack : paquet d'échantillons de la carte (chargé au lancement de la carte, libéré avec elle),
     bed : gain du lit stéréo bouclé (a_bed : vent, mer, jardin...), qui remplace le vent synthétisé,
     spots : ponctuels { id, every : [min, max] s entre deux, gain, dist : [min, max] m autour du joueur, y : [min, max] hauteur,
             at : fonction qui renvoie une position (sinon autour du joueur), ref, roll },
     loops : (fonction qui renvoie) des sources fixes en boucle { id, p : [x, y, z], gain, ref, roll, max },
     fountain : gain des fontaines (jets d'eau posés par pondAdd, banque a_fountain) }.
   Sous un toit (AU.inside), le lit s'étouffe et baisse, les ponctuels aussi. */
const AMB = { def: null, pack: null, on: false, out: null, lp: null, bed: null, loops: [], next: [] };
const AMBW = []; // jets d'eau des fontaines de la carte (pondAdd) : { x, y, z }, vidés avec elle
function ambLoad(def) {
  ambUnload();
  const S = def && def.sound; if (!S || !SFX_PACKS[S.pack]) return;
  AMB.def = S; AMB.pack = S.pack;
  if (AU.ctx) sfxLoad(S.pack).then((ok) => { if (ok && AMB.on && AMB.pack === S.pack) ambStart(); });
}
function ambUnload() {
  ambStop(true);
  if (AMB.pack) sfxUnload(AMB.pack);
  AMB.pack = null; AMB.def = null; AMBW.length = 0;
}
/* Allumée au lancement d'une partie, éteinte au retour aux menus (setAmbience) */
function ambSet(on) {
  AMB.on = on;
  if (!on) { ambStop(false); return; }
  if (AMB.pack && AU.ctx) sfxLoad(AMB.pack).then((ok) => { if (ok && AMB.on && AMB.def) ambStart(); });
}
function ambStart() {
  if (AMB.out || !AMB.def || !AU.ready || !sfxReady(AMB.pack)) return;
  const S = AMB.def, ctx = AU.ctx, t = ctx.currentTime;
  AMB.out = ctx.createGain(); AMB.out.gain.value = 0.0001; AMB.out.gain.setTargetAtTime(1, t, 1.2); AMB.out.connect(AU.bus);
  AMB.lp = ctx.createBiquadFilter(); AMB.lp.type = 'lowpass'; AMB.lp.frequency.value = 18000; AMB.lp.connect(AMB.out);
  AMB.bed = sfxPlay('a_bed', AMB.lp, t, { loop: true, off: rand(0, 20), gain: S.bed || 0.5 });
  if (AMB.bed && AU.windOut) AU.windOut.gain.setTargetAtTime(0, t, 1.2);
  const L = typeof S.loops === 'function' ? S.loops() : (S.loops || []);
  for (const l of L) {
    const E = sfxEmitter(l.id, new V3(l.p[0], l.p[1], l.p[2]), { loop: true, off: rand(0, 4), rate: rand(0.96, 1.04), gain: l.gain || 0.5, ref: l.ref || 4, roll: l.roll || 1.4, max: l.max || 150, air: 60, dest: AMB.out, verb: 0.1 });
    if (E) AMB.loops.push(E);
  }
  if (S.fountain) {
    const seen = [];
    for (const w of AMBW) {
      if (seen.some((q) => hyp(q.x - w.x, q.z - w.z) < 2.5)) continue; seen.push(w);
      const E = sfxEmitter('a_fountain', new V3(w.x, w.y + 0.5, w.z), { loop: true, off: rand(0, 4), rate: rand(0.95, 1.05), gain: S.fountain, ref: 2.5, roll: 1.6, max: 60, air: 40, dest: AMB.out, verb: 0.1 });
      if (E) AMB.loops.push(E);
    }
  }
  AMB.next = (S.spots || []).map((sp) => rand(sp.every[0] * 0.2, sp.every[1] * 0.7));
}
function ambStop(now) {
  if (!AMB.out) return;
  const o = AMB.out, bed = AMB.bed, loops = AMB.loops, t = AU.ctx.currentTime, tau = now ? 0.04 : 0.6;
  o.gain.cancelScheduledValues(t); o.gain.setTargetAtTime(0.0001, t, tau);
  setTimeout(() => {
    try { if (bed) bed.s.stop(); } catch (e) { /* déjà arrêtée */ }
    for (const E of loops) { try { E.v.s.stop(); } catch (e) { /* idem */ } }
    o.disconnect();
  }, tau * 6000 + 100);
  AMB.out = null; AMB.lp = null; AMB.bed = null; AMB.loops = []; AMB.next = [];
}
/* À chaque image (sfxTick) : intérieur/extérieur, ponctuels */
function ambTick(dt) {
  if (!AMB.out) return;
  const S = AMB.def, ins = AU.inside || 0, t = AU.ctx.currentTime;
  // lit fait d'eau (S.water : distance de la caméra à l'eau, en m) : plein au bord, plus bas et plus sourd en s'éloignant (-4 dB à 18 m, -13 dB à 30 m)
  const far = S.water ? smoothstep(3, 35, S.water(camera.position.x, camera.position.z)) : 0;
  AMB.lp.frequency.setTargetAtTime(Math.min(lerp(18000, 1100, ins), lerp(18000, 2500, far)), t, 0.25);
  if (AMB.bed) AMB.bed.g.gain.setTargetAtTime((S.bed || 0.5) * (1 - 0.45 * ins) * (1 - 0.85 * far), t, 0.25);
  const spots = S.spots || [];
  for (let i = 0; i < spots.length; i++) {
    if ((AMB.next[i] -= dt) > 0) continue;
    const sp = spots[i]; AMB.next[i] = rand(sp.every[0], sp.every[1]);
    if (!sfxHas(sp.id) || MATCH.state !== 'playing') continue;
    let p;
    if (sp.at) p = sp.at();
    else { const a = rand(0, TAU), d = rand(sp.dist[0], sp.dist[1]), c = camera.position; p = new V3(c.x + Math.cos(a) * d, rand(sp.y[0], sp.y[1]), c.z + Math.sin(a) * d); }
    sfxEmitter(sp.id, p, { gain: sp.gain * (1 - 0.6 * ins), ref: sp.ref || 8, roll: sp.roll || 1, max: 400, air: 120, dest: AMB.out, verb: 0.25, rate: rand(0.94, 1.06) });
  }
}

/* ---------- Séries d'éliminations ---------- */
/* Terminal (UAV, hélicoptère) et tablette (frappe aérienne) : appareil sorti, appui, cible validée, annulation ; alarme de verrouillage
   d'un hélicoptère ennemi ; transition de la killcam */
function sfxKs(kind) {
  if (!AU.ready) return;
  const t = AU.ctx.currentTime, o = uiOut(0.7);
  if (kind === 'up' && sfxHas('r_on')) { sfxPlay('r_on', o, t, { gain: 0.6 }); return; }
  if (kind === 'press' && sfxHas('r_chirp')) { sfxPlay('r_chirp', o, t, { gain: 0.6 }); return; }
  if (kind === 'confirm' && sfxHas('r_chirp')) { sfxPlay('r_chirp', o, t, { gain: 0.6 }); sfxPlay('r_beep', o, t + 0.22, { gain: 0.5 }); return; }
  if (kind === 'cancel' && sfxHas('r_off')) { sfxPlay('r_off', o, t, { gain: 0.6 }); return; }
  if (kind === 'lock' && sfxHas('st_lock')) { if (t - (AU.lockT || -9) > 0.42) { AU.lockT = t; sfxPlay('st_lock', o, t, { gain: 0.55 }); } return; }
  if (kind === 'killcam' && sfxHas('ui_open')) { sfxPlay('ui_open', o, t, { gain: 0.7, rate: 0.8 }); return; }
  // repli synthétisé
  if (kind === 'up') sfxBeep(1600, 1); else if (kind === 'press') { sfxClick(null, 2400, 0.25); sfxBeep(1500, 2); }
  else if (kind === 'confirm') sfxBeep(1300, 2); else if (kind === 'cancel') sfxBeep(500, 1); else if (kind === 'lock') sfxBeep(1800, 1); else if (kind === 'killcam') sfxBeep(700, 1);
}
/* Qui annonce : un appel du joueur ou d'un allié sonne « ami », celui d'un adversaire « ennemi » */
const ksFriendly = (ent) => !!ent && (ent === PL.ent || allied(ent, PL.ent));
/* Passage des chasseurs : l'enregistrement d'un passage complet voyage avec l'avion de tête, calé pour que sa crête (le
   rugissement) tombe quand l'avion passe au plus près du joueur. Faux si le paquet n'est pas prêt (synthèse : sfxJet). */
function sfxJetPass(j) {
  if (!AU.ready || !j || !sfxHas('k_jet')) return false;
  const e = sfxPick('k_jet'), rel = camera.position.clone().sub(j.pos), tca = Math.max(0, rel.dot(j.dir) / j.speed), start = tca - e.pk;
  j.snd = sfxEmitter('k_jet', j.pos, { e, t: AU.ctx.currentTime + Math.max(0, start), off: Math.max(0, -start), gain: 2.2, ref: 30, roll: 0.7, max: 1200, air: 260, verb: 0.2 });
  return !!j.snd;
}
/* Sifflement d'une bombe, qui finit à l'impact */
function sfxBomb(p, fall) {
  if (!AU.ready || !sfxHas('k_bomb')) return;
  const e = sfxPick('k_bomb');
  sfxAt('k_bomb', p, 1.3, { e, off: Math.max(0, e.d - fall), prop: false, verb: 0.15, ref: 12, roll: 0.8, rate: 1 });
}
/* Bourdonnement d'un drone UAV en altitude (boucle qui suit le drone) */
function sfxDrone(pos) { return sfxEmitter('k_uav', pos, { loop: true, off: rand(0, 3), gain: 0.9, ref: 30, roll: 0.6, max: 900, air: 300, fade: 2.5 }); }
