/* ==========================================================================
   ASSISTANCE À LA VISÉE ET AIDES AU DOIGT (retour du propriétaire : « des contrôles mobiles encore plus faciles à jouer, en s'inspirant des
   standards du marché : PUBG, Call of Duty Mobile, Delta Force »). Au doigt, à la manette et au pavé tactile (09qe-pavetactile.js), jamais à la souris.
   - ralentissement : près d'un ennemi visible, le regard tourne moins vite (on ne dépasse plus la cible d'un coup de pouce) ;
   - accroche : en passant à l'épaule, la vue glisse vers l'ennemi le plus proche du réticule (environ 60 % du chemin, en 0,2 s) ;
   - suivi : tant que le réticule est sur un ennemi, la vue suit en partie son déplacement (et le vôtre, en pas chassés) ;
   - tir automatique (au doigt, activé par défaut, Options) : on tire seul tant que le réticule est sur un ennemi visible, à la cadence de l'arme (une arme
     semi-automatique tire coup sur coup) ; fusil de précision : seulement en visée (le Dragunov attend en plus que le réticule soit posé et espace ses tirs, def.autoTir). Le bouton de tir disparaît alors, celui de la visée prend sa place et sa taille
     (touchModeSync, 09qb-tactile-layout.js) ;
   - vibrations (option, au doigt, Android : l'iPhone n'en donne pas l'accès) à la touche, à l'élimination et au coup reçu.
   Le tir au relâcher des fusils de précision est dans touchFire (09q-tactile.js). Réglages : Options, Jeu. Assistance « Normale » ou « Désactivée » : la « Forte »
   (3.0.0) a été retirée, trop favorable.
   ========================================================================== */
const AIM = { fr: 1, tgt: null, tYaw: 0, tPitch: 0, adsPrev: 0, snapT: -9, autoT: -9, auto: false, onT: -1 };
const AIM_K = { off: 0, normal: 1 };
const _aimV = new V3(), _aimC = new V3();
/* Ennemi visible le plus proche du réticule, dans un cône de maxAng (rad) élargi de la largeur de son buste ; null sinon */
function aimTarget(maxAng) {
  const cp = Math.cos(PL.pitch), fx = -Math.sin(PL.yaw) * cp, fy = Math.sin(PL.pitch), fz = -Math.cos(PL.yaw) * cp, o = camera.position;
  let best = null, bs = Infinity;
  for (const e of entities) {
    if (!e.alive || e === PL.ent || allied(e, PL.ent)) continue;
    entChest(e, _aimC); _aimV.subVectors(_aimC, o);
    const d = _aimV.length(); if (d < 0.5 || d > 75) continue;
    const ang = Math.acos(clamp((_aimV.x * fx + _aimV.y * fy + _aimV.z * fz) / d, -1, 1)), rad = Math.atan2(0.42, d);
    if (ang > maxAng + rad) continue;
    const score = ang - rad; if (score >= bs) continue;
    if (rayWorld(o.x, o.y, o.z, _aimV.x / d, _aimV.y / d, _aimV.z / d, d - 0.4) || smokeBlocks(o, _aimC)) continue; // caché derrière un mur, dans un fumigène
    bs = score; best = { e, ang, rad, d, yaw: Math.atan2(-_aimV.x, -_aimV.z), pitch: Math.asin(clamp(_aimV.y / d, -1, 1)) };
  }
  return best;
}
/* Appelée par updatePlayer avant d'appliquer le regard : renvoie le facteur de ralentissement du regard (1 : aucun) ; accroche, suivi, tir automatique */
function aimAssist(dt) {
  AIM.fr = 1;
  const k = AIM_K[Settings.aimAssist] === undefined ? 1 : AIM_K[Settings.aimAssist];
  const usable = (TOUCH.on || PAD.drive || trackpadOn()) && PL.ent.alive && MATCH.state === 'playing' && !KS.map.open;
  const ads = VM.ads, rising = ads > 0.15 && AIM.adsPrev <= 0.15; AIM.adsPrev = ads;
  if (!usable) { aimAutoFire(null); AIM.tgt = null; return 1; }
  const T = aimTarget((k ? 0.07 + 0.05 * k : 0) + ((TOUCH.on ? Settings.tcAuto : trackpadOn() && Settings.tpAuto !== false) ? 0.02 : 0));
  if (k > 0 && T) {
    // ralentissement : jusqu'à moitié moins vite sur la cible
    const close = 1 - clamp((T.ang - T.rad * 0.5) / (T.rad + 0.04 * k), 0, 1);
    AIM.fr = 1 - close * Math.min(0.65, 0.5 * k);
    // accroche : 0,2 s après le passage à l'épaule, si l'ennemi est à moins de 7°
    if (rising) AIM.snapT = MATCH.time;
    if (MATCH.time - AIM.snapT < 0.2 && T.ang < 0.12 * k + T.rad) {
      const a = (1 - Math.exp(-dt * 14)) * 0.65 * Math.min(1, k);
      PL.yaw += angDiff(PL.yaw, T.yaw) * a; PL.pitch += (T.pitch - PL.pitch) * a;
    }
    // suivi : la même cible d'une image à l'autre, réticule dessus ou tout près
    if (AIM.tgt === T.e && T.ang < T.rad + 0.02) {
      const s = 0.35 * Math.min(1, k);
      PL.yaw += angDiff(AIM.tYaw, T.yaw) * s; PL.pitch += (T.pitch - AIM.tPitch) * s;
    }
  }
  if (T) { AIM.tgt = T.e; AIM.tYaw = T.yaw; AIM.tPitch = T.pitch; } else AIM.tgt = null;
  aimAutoFire(T);
  return AIM.fr;
}
/* Tir automatique (au doigt) : le rayon du réticule touche un ennemi (le même test que les balles, rayEntities, sur tout le corps) sans mur
   devant, à portée de l'arme ; fusil de précision : seulement en visée ; on relâche 0,12 s après l'avoir perdu. Une arme semi-automatique (pistolet, pompe,
   précision) redemande un tir à chaque image : il part dès qu'elle est prête (sans quoi elle ne tirait qu'une balle par ennemi accroché) */
const _aimO = new V3(), _aimD = new V3();
function aimAutoFire(T) {
  let ok = false;
  if ((TOUCH.on ? Settings.tcAuto : trackpadOn() && Settings.tpAuto !== false) && !TC.qs && T && PL.ent.alive && performance.now() >= PL.noFireT) {
    const w = curW(), cp = Math.cos(PL.pitch), kn = PL.knifeOut, range = kn ? 2.4 : w.def.range[1] * 1.6; // couteau en main : le coup part sur un ennemi à portée de lame
    _aimO.copy(camera.position); _aimD.set(-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp);
    const h = kn || (w.mag > 0 && (!w.def.scope || VM.ads > 0.85)) ? rayEntities(_aimO, _aimD, range, PL.ent) : null;
    ok = !!h && !rayWorld(_aimO.x, _aimO.y, _aimO.z, _aimD.x, _aimD.y, _aimD.z, h.t - 0.05);
  }
  if (!ok) AIM.onT = -1; else if (AIM.onT < 0) AIM.onT = MATCH.time;
  // Dragunov (def.autoTir) : retour du propriétaire, au doigt il tirait coup sur coup dès que le réticule touchait, deux balles au buste en 0,35 s, bien plus
  // vite qu'à la souris où il faut viser puis reprendre le recul. Le tir attend que le réticule soit posé sur l'ennemi (vise) et l'écart entre deux tirs (entre)
  const at = ok && !PL.knifeOut ? curW().def.autoTir : null;
  if (at && (MATCH.time - AIM.onT < at.vise || MATCH.time - PL.ent.arms.lastShotAt < at.entre)) {
    AIM.autoT = MATCH.time; AIM.auto = true; if (!TC.fire.size) PL.held = PL.queued = false; return;
  }
  if (ok) { AIM.autoT = MATCH.time; if (!AIM.auto || !curW().def.auto) PL.queued = true; AIM.auto = true; PL.held = true; return; }
  if (AIM.auto && MATCH.time - AIM.autoT > 0.12) { AIM.auto = false; if (!TC.fire.size) PL.held = PL.queued = false; }
}
/* Vibration courte au doigt (Android ; ms), seulement si l'écran a été touché il y a peu (pas avec une manette ou un clavier) */
function touchBuzz(ms) {
  if (!TOUCH.on || Settings.tcVib === false || !navigator.vibrate || performance.now() - TOUCH.lastT > 15000) return;
  try { navigator.vibrate(Math.round(ms)); } catch (e) { /* refusé : sans conséquence */ }
}
/* Opacité des boutons au doigt (Options) */
function touchAlpha() { if (TC.root) TC.root.style.setProperty('--tca', String(clamp(+Settings.tcAlpha || 1, 0.3, 1))); }
