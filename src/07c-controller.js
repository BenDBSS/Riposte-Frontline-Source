/* ==========================================================================
   CONTRÔLEUR DE SOLDAT COMMUN
   Un seul code pour le joueur humain, les bots et, plus tard, les joueurs en
   réseau. Chacun remplit la même structure d'entrées (déplacement, regard,
   gâchette, visée, sprint, accroupi, saut, rechargement, changement d'arme) ;
   le contrôleur applique exactement les mêmes règles : vitesses, visée et
   son temps d'épaulement, dispersion, recul, cadence, rechargements, culasse.
   Les bots ne font qu'imiter un joueur : ils « appuient sur les touches ».
   ========================================================================== */
function makeInput() {
  return { mx: 0, mz: 0, sprint: false, crouch: false, slide: false, jump: false, fire: false, firePressed: false, ads: false, reload: false, switchTo: -1 };
}
/* ids : identifiants d'armes nues ou armes (dérivées, avec accessoires) */
function makeArms(ids, reserveMul = 1) {
  return {
    slots: ids.map((w) => { const def = typeof w === 'string' ? WEAPONS[w] : w; return { def, mag: def.mag, reserve: Math.round(def.reserve * reserveMul) }; }),
    cur: 0, fireCd: 0.3, reload: null, boltT: 0, switching: 0, switchTo: -1, adsW: 0, sprintW: 0, bloom: 0, burstN: 0, lastShotAt: -9, autoReload: 0, shots: 0,
    knife: false, // couteau en main (joueur seulement, voir knifeDraw) : plus de tir, de visée ni de rechargement, mais on court plus vite (KNIFE_MOVE)
  };
}
function armsW(ent) { return ent.arms.slots[ent.arms.cur]; }
function initCtl(ent, ids, reserveMul) {
  ent.input = makeInput(); ent.arms = makeArms(ids, reserveMul);
  ent.onGround = true; ent.vy = 0; ent.eyeH = 1.62; ent.airVy = 0; ent.slideT = 0; ent.slideCd = 0; ent.slideBuf = 0; ent.slideAmt = 0; ent.sprinting = false; ent.jumpHeld = false; ent.busy = false; ent.blockSprint = false; ent.adsActive = false;
}

/* Glissade : accroupi pendant un sprint. L'élan de la course est conservé (un peu accéléré) puis retombe ; on glisse en ligne
   caméra basse, en pouvant tirer et viser. Le joueur garde la main : les touches de direction infléchissent la trajectoire (turn,
   en rad/s), une demande un peu trop tôt est retenue quelques instants (buffer) au lieu d'être perdue, les glissades s'enchaînent
   après une très courte attente (cd), et sauter l'interrompt en gardant l'élan. Un mur de face l'arrête sans pénalité (cdWall).
   Le déclenchement est une entrée ponctuelle (I.slide) : seul le joueur la produit pour l'instant. */
/* vitesse de course de base (m/s), multipliée par la mobilité de l'arme (d.move) : 5,3 avant la 3.6.0, ralentie avec les animations
   capturées (le jeu paraissait trop nerveux) ; sprint, visée et accroupi en sont des parts. MOVE_ACC : accélérations au sol (course,
   sprint), 15 et 12 avant la 3.6.0, 12,8 et 10,2 jusqu'à la 4.18 (départs et arrêts trop mous). Les vitesses de la glissade ont suivi
   (7,6, 11,5 et 3,4 avant). Rythme relevé à la 5.1 (retour du propriétaire : « plus nerveux, sans être un Call of Duty récent ») : 4,4 et
   14,5 / 12 avant ; SPRINT_MUL, la part du sprint (joueur, bots, atteinte.js). */
const MOVE_SPEED = 4.75, MOVE_ACC = [16.5, 13.5], SPRINT_MUL = 1.55;
/* Couteau en main : le multiplicateur de vitesse remplace celui de l'arme (d.move, de 0,74 à 1,09). Le sprint, l'accroupi et la glissade s'y appliquent
   comme d'habitude. 1,15 : plus vite que le pistolet-mitrailleur le plus léger, comme le couteau de Counter-Strike. */
const KNIFE_MOVE = 1.15;
const SLIDE = { dur: 0.75, cd: 0.26, cdWall: 0.12, boost: 1.4, floor: 6.8, max: 10.3, min: 3.0, end: 3.1, turn: 2.0, buffer: 0.3 }; // (6,4, 9,7, 2,9 et 0,8 s avant la 5.1)
/* Changement d'arme (s) : l'arme baissée est remplacée quand il reste SWITCH.swap (0,52 et 0,28 avant la 5.1) */
const SWITCH = { dur: 0.44, swap: 0.24 };

/* Déplacement : renvoie la vitesse verticale d'atterrissage (0 si pas d'atterrissage) */
function ctlMove(ent, dt) {
  const I = ent.input, A = ent.arms, d = armsW(ent).def;
  let sprint = I.sprint && I.mz > 0.3 && !I.ads && !ent.blockSprint && A.boltT <= 0 && (!ent.busy || ent.sprintBusyOk);
  // glissade : démarrage, puis la course n'est plus « un sprint » (on peut tirer et viser)
  ent.slideCd = Math.max(0, (ent.slideCd || 0) - dt);
  let slid = false, sliding = (ent.slideT || 0) > 0;
  if (I.slide) { ent.slideBuf = SLIDE.buffer; I.slide = false; }
  if (ent.slideBuf > 0) {
    // la demande attend la fin de la glissade en cours et de l'attente, puis reste valable un instant ; en l'air elle est gardée
    // jusqu'à la réception : appuyer pendant un saut déclenche la glissade dès qu'on retombe
    if (!sliding && ent.slideCd <= 0 && ent.onGround) ent.slideBuf -= dt;
    const v0 = hyp(ent.vel.x, ent.vel.z);
    if (!sliding && sprint && ent.onGround && ent.slideCd <= 0 && v0 > SLIDE.min) {
      // depuis une vitesse faible (enchaînement), la glissade part quand même à une vitesse de course
      ent.slideT = SLIDE.dur; ent.slideSpd = Math.min(SLIDE.max, Math.max(SLIDE.floor, v0 * SLIDE.boost)); ent.slideDx = ent.vel.x / v0; ent.slideDz = ent.vel.z / v0;
      sliding = slid = true; ent.slideBuf = 0;
    }
  }
  if (sliding) sprint = false;
  if (sliding) ent.crouch = true;
  else if (I.crouch && !sprint) ent.crouch = true;
  else if (ent.crouch && ceilingAbove(ent.pos.x, ent.pos.z, ent.pos.y + 1.0, 0.3) > ent.pos.y + 1.8) ent.crouch = false;
  ent.crouchAmt = damp(ent.crouchAmt, ent.crouch ? 1 : 0, 10, dt);
  ent.adsActive = I.ads && !sprint && !A.reload && !ent.busy && !A.knife && A.switching <= 0 && (A.boltT <= 0.2 || !!d.bolt || !!d.pump);
  A.adsW = damp(A.adsW, ent.adsActive ? 1 : 0, (1 / Math.max(0.05, d.adsTime)) * 2.2, dt);
  let spd = MOVE_SPEED * (A.knife ? KNIFE_MOVE : d.move);
  if (sprint) spd *= SPRINT_MUL; else if (A.adsW > 0.5) spd *= d.scope ? 0.4 : 0.58;
  if (ent.crouch) spd *= 0.6;
  const fx = -Math.sin(ent.yaw), fz = -Math.cos(ent.yaw), rx = Math.cos(ent.yaw), rz = -Math.sin(ent.yaw);
  let wx = fx * I.mz + rx * I.mx, wz = fz * I.mz + rz * I.mx; const wl = hyp(wx, wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const acc = ent.onGround ? MOVE_ACC[sprint ? 1 : 0] : 2.2;
  let slideV = 0;
  if (sliding) {
    // vitesse : de l'élan de départ vers une petite vitesse de fin, plus vite au début
    const k = 1 - ent.slideT / SLIDE.dur; slideV = SLIDE.end + (ent.slideSpd - SLIDE.end) * Math.pow(1 - k, 1.35);
    // trajectoire : on peut l'infléchir vers la direction voulue (touches ou souris), sans jamais faire demi-tour d'un coup
    if (wl > 0.15) {
      const dl = Math.atan2(ent.slideDx * wz - ent.slideDz * wx, ent.slideDx * wx + ent.slideDz * wz);
      if (Math.abs(dl) < 2.6) {
        const a = clamp(dl * 6, -SLIDE.turn, SLIDE.turn) * dt, ca = Math.cos(a), sa = Math.sin(a), dx = ent.slideDx, dz = ent.slideDz;
        ent.slideDx = dx * ca - dz * sa; ent.slideDz = dx * sa + dz * ca;
      }
    }
    ent.vel.x = ent.slideDx * slideV; ent.vel.z = ent.slideDz * slideV;
    ent.slideT -= dt;
    if (ent.slideT <= 0) { ent.slideT = 0; ent.slideCd = SLIDE.cd; }
  } else { ent.vel.x = damp(ent.vel.x, wx * spd, acc, dt); ent.vel.z = damp(ent.vel.z, wz * spd, acc, dt); }
  let jumped = false;
  if (I.jump && ent.onGround && !ent.jumpHeld) { // on saute même en lançant une grenade ou en changeant d'arme
    if (sliding) { ent.slideT = 0; ent.slideCd = SLIDE.cd; ent.crouch = false; sliding = false; ent.vy = 6.3; ent.onGround = false; jumped = true; } // saut de glissade : l'élan est gardé
    else if (ent.crouch) ent.crouch = false; else { ent.vy = 6.3; ent.onGround = false; jumped = true; }
  }
  ent.jumpHeld = !!I.jump;
  const px0 = ent.pos.x, pz0 = ent.pos.z;
  ent.pos.x += ent.vel.x * dt; ent.pos.z += ent.vel.z * dt;
  // plafond trop bas pour se tenir debout là où l'on pose les pieds (monté sur un canapé ou une table sous un plafond de 2,4 m : la marche
  // automatique hisse le soldat sur le meuble, sa tête entre dans la dalle) : il s'accroupit. Debout, collideCircle prendrait la dalle pour
  // un mur et le repousserait jusqu'à son bord, à l'autre bout de la pièce
  if (!ent.crouch && ent.onGround && ceilingAbove(ent.pos.x, ent.pos.z, ent.pos.y + 0.3, 0.3) < ent.pos.y + 1.77) ent.crouch = true;
  const height = ent.crouch ? 1.2 : 1.75;
  if (MATCH.time - (ent.spawnAt || -99) < 3) spawnPush(ent, dt);
  collideCircle(ent.pos, ent.isPlayer ? 0.36 : 0.34, height);
  // bot au bord du vide (îles flottantes) : un pas sans appui, ou qui en manquera un quart de mètre plus loin, est refusé, axe par axe
  // pour longer le bord. Toutes ses manœuvres finissent ici (chemin, pas chassés, couverts, fuite d'une grenade, séparation) ; seul
  // le vide compte : une descente sur une autre partie de l'île reste permise, comme sur les autres cartes
  if (VOID.on && !ent.isPlayer && ent.onGround && (ent.pos.x !== px0 || ent.pos.z !== pz0)) {
    const y = ent.pos.y, hole = (x, z) => {
      const dx = x - px0, dz = z - pz0, l = hyp(dx, dz) || 1;
      return groundHeight(x, z, y, 0.3) <= VOID.floor + 1 || groundHeight(x + dx / l * 0.25, z + dz / l * 0.25, y, 0.3) <= VOID.floor + 1;
    };
    if (hole(ent.pos.x, ent.pos.z)) {
      if (ent.pos.z !== pz0 && !hole(ent.pos.x, pz0)) { ent.pos.z = pz0; ent.vel.z = 0; }
      else if (ent.pos.x !== px0 && !hole(px0, ent.pos.z)) { ent.pos.x = px0; ent.vel.x = 0; }
      else { ent.pos.x = px0; ent.pos.z = pz0; ent.vel.x = ent.vel.z = 0; }
      ent.edgeT = MATCH.time;
    }
  }
  // un mur (ou le vide) met fin à la glissade
  if (sliding && ent.slideT > 0 && hyp(ent.pos.x - px0, ent.pos.z - pz0) < slideV * dt * 0.35) { ent.slideT = 0; ent.slideCd = SLIDE.cdWall; sliding = false; }
  ent.vy -= 19 * dt; ent.pos.y += ent.vy * dt;
  const g = groundHeight(ent.pos.x, ent.pos.z, Math.max(ent.pos.y, ent.pos.y - ent.vy * dt), 0.3);
  if (ent.vy > 0) { const c = ceilingAbove(ent.pos.x, ent.pos.z, ent.pos.y + 0.3, 0.3); if (c < ent.pos.y + height + 0.05) ent.vy = 0; }
  let landed = 0;
  if (ent.pos.y <= g) { if (!ent.onGround && ent.airVy < -6) landed = ent.airVy; ent.pos.y = g; ent.vy = 0; ent.onGround = true; }
  else if (ent.onGround && ent.vy <= 0 && ent.pos.y - g < STEP + 0.05) { ent.pos.y = g; ent.vy = 0; }
  else ent.onGround = false;
  ent.airVy = ent.vy;
  if (sliding && !ent.onGround) { ent.slideT = 0; ent.slideCd = SLIDE.cd; sliding = false; } // plus de sol : fin de la glissade
  ent.slideAmt = damp(ent.slideAmt || 0, sliding ? 1 : 0, sliding ? 12 : 7, dt);
  ent.eyeH = damp(ent.eyeH, sliding ? 0.85 : ent.crouch ? 1.1 : 1.62, sliding ? 22 : 12, dt);
  ent.sprinting = sprint && hyp(ent.vel.x, ent.vel.z) > 3;
  A.sprintW = damp(A.sprintW, ent.sprinting ? 1 : 0, 11, dt); // (9 avant la 5.1 : on tire plus tôt en sortant du sprint)
  return { landed, jumped, slid };
}

/* Pendant ses 3 premières secondes, un soldat qui se trouve dans un autre (deux alliés apparus au même endroit) s'en écarte, même à l'arrêt,
   avant la collision avec le décor ; ensuite les soldats se traversent comme avant. Deux soldats exactement superposés partent chacun dans
   une direction tirée de leur emplacement de killcam (kcI), donc différente. */
function spawnPush(ent, dt) {
  for (const o of entities) {
    if (o === ent || !o.alive || Math.abs(o.pos.y - ent.pos.y) > 1.2) continue;
    let dx = ent.pos.x - o.pos.x, dz = ent.pos.z - o.pos.z; const d = hyp(dx, dz);
    if (d >= 0.8) continue;
    if (d < 1e-3) { const a = (ent.kcI || 0) * 2.39996; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= d; dz /= d; }
    const step = Math.min(0.8 - d, 2.5 * dt);
    ent.pos.x += dx * step; ent.pos.z += dz * step;
  }
}

/* Actions d'arme visibles (rechargement, culasse) : jouées en vue subjective pour le joueur,
   enregistrées pour la killcam de tout le monde */
function ctlAction(ent, name, dur, data) {
  if (ent.isPlayer) vmStartAction(name, dur, data);
  kcEvent('vma', { sid: ent.kcI, name, dur, data: data ? { ...data } : {} });
}
function ctlStartReload(ent) {
  const A = ent.arms, w = armsW(ent), d = w.def;
  if (A.reload || ent.busy || A.knife || w.mag >= d.mag || w.reserve <= 0 || A.boltT > 0 || A.switching > 0) return false;
  if (d.tube) { A.reload = { tube: true, phase: 'start', t: 0, empty: w.mag === 0, stop: false }; ctlAction(ent, 'shellStart', 0.32); }
  else { const empty = w.mag === 0, dur = empty ? d.reloadEmpty : d.reload; A.reload = { t: 0, dur, empty, filled: false }; ctlAction(ent, 'reload', dur, { empty }); }
  // un adversaire qui recharge tout près s'entend (le chargeur qui sort, puis celui qui entre) : un repère pour le joueur
  if (!ent.isPlayer && ent.alive && !d.tube && ent.pos.distanceTo(camera.position) < 16) { const p = ent.pos.clone(); p.y += 1.1; sfxMech('magout', 0.15, p, d.fam); sfxMech('magin', Math.min(1.4, (A.reload.dur || 2) * 0.55), p, d.fam); }
  return true;
}
/* again : l'arme visée est celle qu'on a déjà (le couteau en main range le couteau et ressort l'arme d'avant) */
function ctlSwitch(ent, i, again) {
  const A = ent.arms;
  if ((i === A.cur && !again) || i < 0 || i >= A.slots.length || A.switching > 0 || ent.busy) return false;
  A.reload = null; A.boltT = 0; A.switching = SWITCH.dur; A.switchTo = i;
  if (ent.isPlayer) { VM.action = null; VM.lowerTarget = 1; }
  kcEvent('vma', { sid: ent.kcI, name: 'switch', dur: SWITCH.dur, data: { to: A.slots[i].def.key, from: A.slots[A.cur].def.key } }); // from : l'arme du début d'une relecture (kcStartWeapon)
  return true;
}

/* Arme : cadence, culasse, changement, rechargement, gâchette */
function ctlWeapon(ent, dt, now) {
  const I = ent.input, A = ent.arms;
  let w = armsW(ent), d = w.def;
  A.fireCd -= dt; A.bloom = Math.max(0, A.bloom - dt * 0.05);
  if (A.boltT > 0) A.boltT -= dt;
  if (A.switching > 0) {
    const before = A.switching; A.switching -= dt;
    if (before > SWITCH.swap && A.switching <= SWITCH.swap) { A.cur = A.switchTo; w = armsW(ent); d = w.def; if (ent.isPlayer) { vmEquip(d); VM.lowerTarget = 0; sfxMech('draw'); VM.rec.vy += 0.5; VM.rec.vrx -= 0.9; VM.rec.vz += 0.15; } }
  }
  if (I.switchTo >= 0) { ctlSwitch(ent, I.switchTo); I.switchTo = -1; }
  if (I.reload) { ctlStartReload(ent); I.reload = false; }
  if (A.autoReload > 0) { A.autoReload -= dt; if (A.autoReload <= 0) ctlStartReload(ent); }
  if (A.reload) {
    const R = A.reload; R.t += dt;
    if (R.tube) {
      if (R.phase === 'start' && R.t >= 0.32) { R.phase = 'shell'; R.t = 0; ctlAction(ent, 'shell', d.shellTime); }
      else if (R.phase === 'shell' && R.t >= d.shellTime) {
        w.mag++; w.reserve--; R.t = 0;
        if (w.mag >= d.mag || w.reserve <= 0 || R.stop) { R.phase = 'end'; ctlAction(ent, 'shellEnd', 0.3, { empty: R.empty });  }
        else ctlAction(ent, 'shell', d.shellTime);
      } else if (R.phase === 'end' && R.t >= 0.3) A.reload = null;
      if (I.fire && w.mag > 0 && R.phase === 'shell') R.stop = true;
    } else {
      if (!R.filled && R.t >= R.dur * 0.6) { const take = Math.min(d.mag - w.mag, w.reserve); w.mag += take; w.reserve -= take; R.filled = true; }
      if (R.t >= R.dur) A.reload = null;
    }
  }
  const canFire = !ent.busy && !A.reload && !A.knife && A.boltT <= 0 && A.switching <= 0 && A.sprintW < 0.3 && !ent.sprinting;
  const pressed = I.firePressed; I.firePressed = false;
  if ((I.fire || pressed) && canFire && A.fireCd <= 0) {
    if (w.mag > 0 && (d.auto ? I.fire : pressed)) return ctlShoot(ent, now);
    if (w.mag <= 0 && pressed) { if (ent.isPlayer) sfxMech('empty'); if (w.reserve > 0) ctlStartReload(ent); }
  }
  return null;
}

/* Tir : même dispersion, même recul et même cadence pour tout le monde */
function ctlShoot(ent, now) {
  const A = ent.arms, w = armsW(ent), d = w.def;
  w.mag--; A.shots++;
  const ads = A.adsW, spd = hyp(ent.vel.x, ent.vel.z);
  let spread = lerp(d.spread[0], d.spread[1], ads * ads);
  spread += d.moveSpread * clamp(spd / MOVE_SPEED, 0, 1.5) * (1 - ads * 0.7) + A.bloom * (1 - ads * 0.6);
  if (!ent.onGround) spread += 0.05;
  if (ent.crouch) spread *= 0.8;
  if (d.bipod && ent.crouch && spd < 0.4) spread *= 0.6; // bipied posé
  if (d.scope && ads < 0.95) spread = Math.max(spread, 0.06);
  let origin, f, muzzle;
  if (ent.isPlayer) {
    origin = camera.position.clone(); f = camFwd(new V3());
    const right = new V3().crossVectors(f, UP).normalize();
    muzzle = origin.clone().addScaledVector(f, 0.7).addScaledVector(right, 0.12 * (1 - ads)).add(new V3(0, -0.09 * (1 - ads), 0));
  } else {
    origin = entEye(ent, new V3());
    const cp = Math.cos(ent.pitch); f = new V3(-Math.sin(ent.yaw) * cp, Math.sin(ent.pitch), -Math.cos(ent.yaw) * cp);
    muzzle = ent.model.gun.localToWorld(ent.model.muzzleLocal.clone());
  }
  const pellets = d.pellets || 1;
  let hitAny = false;
  for (let i = 0; i < pellets; i++) {
    const dir = coneDir(f, d.pellets ? lerp(d.spread[0], d.spread[1], ads) : spread);
    const r = fireRay(ent, origin, dir, d, muzzle, !d.silent && (ent.isPlayer ? pellets === 1 && Math.random() < 0.25 : i === 0 && Math.random() < 0.6), ent.dmgMul || 1);
    if (r) hitAny = true;
  }
  // recul : le joueur a le sien (recoilShot, 07ca-recul.js : plus marqué, avec un retour de la visée quand il lâche) ; les bots gardent l'ancien, motif propre aux
  // armes automatiques (montée puis dérive), aléatoire sinon
  A.burstN = now - A.lastShotAt < 0.3 ? A.burstN + 1 : 0; A.lastShotAt = now;
  const n = A.burstN;
  let kv, kh;
  if (ent.isPlayer) { const rc = recoilShot(ent, d, n, ads, spd); kv = rc.kv; kh = rc.kh; A.recPend = (A.recPend || 0) + kv; }
  else {
    kv = d.recoil.v * (1 - ads * 0.3) * rand(0.9, 1.1) * (ent.crouch ? 0.85 : 1);
    const pod = d.bipod && ent.crouch && spd < 0.4 ? 0.5 : 1; // bipied posé (accroupi et immobile) : le recul est presque annulé
    kv *= pod;
    if (d.pattern === 'climb') { kv *= 1 + Math.min(n, 10) * 0.035; kh = (Math.sin(n * 0.55 + 0.6) * 1.2 + (Math.random() - 0.5) * 0.6) * d.recoil.h; }
    else if (d.pattern === 'smg') { kv *= 0.92; kh = (Math.random() - 0.5) * 2.6 * d.recoil.h; }
    else kh = (Math.random() - 0.5) * 2 * d.recoil.h;
    kh *= pod;
  }
  ent.pitch = clamp(ent.pitch + kv, -1.5, 1.5); ent.yaw += kh;
  if (d.auto) A.bloom = Math.min(0.03, A.bloom + 0.003);
  A.fireCd = 60 / d.rpm;
  if (d.pump && w.mag > 0) { A.boltT = 0.6; ctlAction(ent, 'pump', 0.55); } // pompe : le garde-main recule et revient avant le coup suivant
  if (d.bolt && w.mag > 0) { A.boltT = 1.05; MATCH.events.push({ t: now + 0.12, fn: () => { if (ent.alive && armsW(ent).def === d) ctlAction(ent, 'bolt', 0.93); } }); }
  if (w.mag === 0 && w.reserve > 0) A.autoReload = 0.3;
  soundEvents.push({ pos: ent.pos.clone(), team: ent.team, who: ent, t: now, loud: !!d.loud, quiet: !!d.silent }); if (soundEvents.length > 60) soundEvents.shift();
  ent.lastShotT = now;
  kcEvent('shot', { m: muzzle.clone(), d: f.clone(), kind: d.sound, sid: ent.kcI });
  if (ent.isPlayer) playerShotFx(d, ads, f, muzzle, kv, kh, hitAny);
  else { muzzleWorldFx(muzzle, f, d.silent, d.feel ? d.feel.flash : 1); if (!d.silent) flashLight(muzzle, 2.5, 7, 0.05); sfxGun(d.sound, muzzle, ent); ent.recoil = 0.05; }
  return { hitAny };
}
