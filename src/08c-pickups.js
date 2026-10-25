/* ==========================================================================
   ARMES AU SOL
   À sa mort, un soldat lâche l'arme qu'il tenait, avec ses munitions restantes.
   - arme du même type qu'une des nôtres (fusil d'assaut, pistolet-mitrailleur, fusil de
     précision, fusil à pompe, pistolet : WEAPONS[].cat) : on récupère ses munitions en
     marchant dessus, une cartouche pour une cartouche, dans la limite de la réserve
     maximale de notre arme ; vidée, elle disparaît, sinon elle reste au sol ;
   - arme différente de celles qu'on porte (même du même type) : E l'échange contre
     l'arme en main (celle-ci tombe à son tour, avec ses munitions) ; à la manette, X maintenu.
   Les armes vivent bien plus longtemps que les corps (5,5 s) : DROP.life.
   Les armes lâchées sont locales à chaque joueur (rien n'est envoyé en ligne).
   ========================================================================== */
const DROP = { life: 90, fade: 2, max: 14, swapR: 1.7, ammoR: 1.1, shadowR: 14, farR: 45, list: [], models: {}, cur: null, txt: '', msgT: 0, msg: '', prog: 0 };
const _dpV = new V3(), _dpQ = new THREE.Quaternion(), _dpQ2 = new THREE.Quaternion(), _dpF = new V3();

/* Modèle de l'arme posée : le modèle des soldats, couché sur le flanc (quart de tour autour du canon) et posé à la
   bonne hauteur (lift : distance de l'origine au point le plus bas dans cette pose) */
function dropTemplate(key) {
  if (DROP.models[key]) return DROP.models[key];
  const g = buildWorldGun(key).group;
  const rest = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2);
  g.quaternion.copy(rest); g.updateMatrixWorld(true);
  const lift = -new THREE.Box3().setFromObject(g).min.y;
  g.quaternion.identity(); g.updateMatrixWorld(true);
  return (DROP.models[key] = { group: g, rest, lift });
}
function removeDrop(d) {
  scene.remove(d.obj);
  const i = DROP.list.indexOf(d); if (i >= 0) DROP.list.splice(i, 1);
  if (DROP.cur === d) DROP.cur = null;
}
function clearDrops() { for (const d of DROP.list.slice()) removeDrop(d); DROP.msgT = 0; }

/* Pose une arme au sol : pos et q (position et orientation de départ), vel (lancer). Renvoie l'objet ou null. */
function dropWeapon(def, mag, reserve, pos, q, vel) {
  if (mag + reserve <= 0) return null;
  const T = dropTemplate(def.key);
  const obj = T.group.clone(); obj.position.copy(pos); obj.quaternion.copy(q);
  scene.add(obj);
  const d = { def, mag, reserve, obj, tpl: T, vel: vel.clone(), spin: new V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), landed: false, landT: 0, q0: new THREE.Quaternion(), qR: new THREE.Quaternion(), age: 0 };
  DROP.list.push(d);
  while (DROP.list.length > DROP.max) removeDrop(DROP.list[0]);
  return d;
}

/* Arme lâchée par un soldat qui vient de mourir : elle quitte le corps (dont elle est retirée) et retombe */
function dropKilledWeapon(v, dir) {
  const A = v.arms, w = A && A.slots[A.cur]; if (!w) return;
  let mag = w.mag, reserve = w.reserve;
  // les bots ont une réserve quasi infinie : ils n'en laissent qu'une partie
  if (!v.isPlayer) reserve = Math.min(reserve, Math.round(w.def.reserve * rand(0.3, 1)));
  if (mag + reserve <= 0) mag = Math.ceil(w.def.mag / 3);
  const vel = _dpF.set(v.vel ? v.vel.x : 0, 0, v.vel ? v.vel.z : 0).multiplyScalar(0.6);
  if (dir) { vel.x += dir.x * 1.2; vel.z += dir.z * 1.2; }
  vel.y = rand(1.2, 2.2);
  const S = v.model;
  if (!v.isPlayer && S && S.gun) {
    S.gun.updateWorldMatrix(true, false);
    S.gun.getWorldPosition(_dpV); S.gun.getWorldQuaternion(_dpQ);
    S.gun.visible = false; // le corps n'a plus son arme (elle est rendue visible au retour à la vie, voir animSoldier)
  } else {
    _dpV.set(v.pos.x, v.pos.y + 1.1, v.pos.z); _dpQ.setFromAxisAngle(UP, v.yaw || 0);
  }
  dropWeapon(w.def, mag, reserve, _dpV, _dpQ, vel);
}

/* Yaw de l'orientation q (le canon pointe vers -Z) */
function quatYaw(q) { _dpF.set(0, 0, -1).applyQuaternion(q); return Math.atan2(-_dpF.x, -_dpF.z); }

function stepDrop(d, dt) {
  d.age += dt;
  const o = d.obj, T = d.tpl;
  if (!d.landed) {
    d.vel.y -= 9.8 * dt;
    o.position.addScaledVector(d.vel, dt);
    _dpQ.set(d.spin.x * dt * 0.5, d.spin.y * dt * 0.5, d.spin.z * dt * 0.5, 1).normalize();
    o.quaternion.premultiply(_dpQ);
    // les murs arrêtent l'arme (collision d'un petit cylindre), l'air la freine un peu
    _dpV.set(o.position.x, o.position.y - T.lift, o.position.z); collideCircle(_dpV, 0.12, 0.3);
    o.position.x = _dpV.x; o.position.z = _dpV.z;
    d.vel.x *= 1 - 0.8 * dt; d.vel.z *= 1 - 0.8 * dt;
    const g = groundHeight(o.position.x, o.position.z, o.position.y - T.lift, 0.15);
    if (d.vel.y <= 0 && o.position.y - T.lift <= g) {
      // pose : à plat sur le flanc, dans la direction du canon à l'impact
      o.position.y = g + T.lift; d.landed = true; d.landT = 0; d.q0.copy(o.quaternion);
      d.qR.setFromAxisAngle(UP, quatYaw(o.quaternion)).multiply(T.rest);
    } else if (o.position.y < -8) { d.dead = true; }
  } else if (d.landT < 1) {
    d.landT = Math.min(1, d.landT + dt / 0.3);
    o.quaternion.slerpQuaternions(d.q0, d.qR, smoothstep(0, 1, d.landT));
  }
  // fin de vie : l'arme rétrécit et s'enfonce dans le sol
  const left = DROP.life - d.age;
  if (left < DROP.fade) { const k = Math.max(0, left / DROP.fade); o.scale.setScalar(k); if (left <= 0) d.dead = true; }
}

function updateDrops(dt) {
  const L = DROP.list;
  for (let i = L.length - 1; i >= 0; i--) { stepDrop(L[i], dt); if (L[i].dead) removeDrop(L[i]); }
  // niveau de détail : même seuil de taille apparente que les soldats (updateSoldierLods). Au loin, une arme couchée ne fait plus que quelques
  // pixels : plus d'ombre au-delà de DROP.shadowR, plus rien au-delà de DROP.farR (14 armes au plus, visibles de toute la carte, ajoutaient
  // jusqu'à 80 appels de rendu par image, ombres comprises, au fil de la partie)
  const lk = 1.8 * VIEW.h / (2 * Math.tan(camera.fov * Math.PI / 360)), th = RQ.q.lodPx, zoom = Settings.fov / camera.fov;
  for (const d of L) {
    const dist = camera.position.distanceTo(d.obj.position) / zoom, hi = lk / (dist * zoom + 0.01) > th, sh = dist < DROP.shadowR, vis = dist < DROP.farR;
    if (d.hi !== hi) { d.hi = hi; setGunLod(d.obj, hi); }
    if (d.vis !== vis) { d.vis = vis; d.obj.visible = vis; }
    if (d.sh !== sh) { d.sh = sh; for (const m of d.obj.children) if (m.userData.gunLod === 'lo') m.castShadow = sh; }
  }
  DROP.msgT -= dt;
  const P = PL.ent, A = P.arms;
  let best = null, bd = 1e9;
  if (P.alive && MATCH.state === 'playing') {
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i]; if (!d.landed) continue;
      const dx = d.obj.position.x - P.pos.x, dz = d.obj.position.z - P.pos.z, dy = d.obj.position.y - P.pos.y;
      if (dy < -0.6 || dy > 1.4) continue;
      const dist = hyp(dx, dz);
      // arme du même type qu'une des nôtres (la même d'abord) : ses munitions se ramassent en marchant dessus
      const same = A.slots.find((s) => s.def.id === d.def.id), mine = same || A.slots.find((s) => s.def.cat === d.def.cat);
      if (mine && dist <= DROP.ammoR) {
        const take = Math.min(mine.def.reserve - mine.reserve, d.mag + d.reserve);
        if (take > 0) {
          mine.reserve += take;
          const fromRes = Math.min(take, d.reserve); d.reserve -= fromRes; d.mag -= take - fromRes;
          DROP.msg = _t('+{0} munitions ({1})', take, mine.def.name); DROP.msgT = 1.4; sfxMech('pickup');
          if (d.mag + d.reserve <= 0) { removeDrop(d); continue; }
        }
      }
      // une autre arme, même du même type, peut s'échanger contre celle qu'on tient
      if (!same && dist < DROP.swapR && dist < bd) { best = d; bd = dist; }
    }
  }
  DROP.cur = best && dropSwapAllowed() ? best : null;
  // invite sous le réticule : la touche ou le bouton du mode d'entrée (actGlyph, 09x-invites.js) ; au doigt, le bouton Ramasser est à l'écran
  // à la manette, le ramassage est X maintenu (padReloadUse) : l'invite le dit, et un filet se remplit pendant l'appui
  const g = DROP.cur ? actGlyph('use') : '', a = DROP.cur && esc(A.slots[A.cur].def.name), b = DROP.cur && esc(DROP.cur.def.name), hold = inputMode() === 'pad';
  const mp = mechaPrompt(); // à portée de son mecha, ou à bord : monter, descendre (08g-mecha-pilote.js)
  const txt = mp ? mp : DROP.cur ? `${g ? (hold ? _t('Maintenir {0} pour échanger {1} contre {2}', g, a, b) : _t('{0} Échanger {1} contre {2}', g, a, b)) : _t('Échanger {0} contre {1}', a, b)}<i>${DROP.cur.mag} / ${DROP.cur.reserve}</i>` : DROP.msgT > 0 ? esc(DROP.msg) : '';
  const el = $('pickup');
  if (txt !== DROP.txt) { DROP.txt = txt; el.innerHTML = txt; el.style.opacity = txt ? 1 : 0; }
  const prog = (DROP.cur || mp) && hold && PAD.useT > 0 && PAD.useT < PAD_HOLD ? PAD.useT / PAD_HOLD : 0;
  if (prog !== DROP.prog) { DROP.prog = prog; el.style.setProperty('--hold', prog.toFixed(3)); el.classList.toggle('hold', prog > 0); }
}
function dropSwapAllowed() { const P = PL.ent; return P.alive && P.arms.switching <= 0 && PL.knifeT <= 0 && !PL.nadeState && !KS.mode && !MECHA_P.me; }

/* E (bouton Ramasser au doigt, X maintenu à la manette : padReloadUse) : échange l'arme en main contre l'arme au sol visée */
function swapWithDrop() {
  const d = DROP.cur, P = PL.ent, A = P.arms;
  if (!d || !dropSwapAllowed() || MATCH.state !== 'playing') return;
  const old = A.slots[A.cur], yaw = P.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  PL.knifeOut = false; // le couteau se range : la nouvelle arme monte comme après un changement d'arme
  removeDrop(d);
  // l'arme rangée tombe devant nous, avec ce qu'il lui reste de munitions
  _dpV.set(P.pos.x + fx * 0.5, P.pos.y + 0.9, P.pos.z + fz * 0.5); _dpQ.setFromAxisAngle(UP, yaw);
  dropWeapon(old.def, old.mag, old.reserve, _dpV, _dpQ, _dpF.set(fx * 1.6, 1.3, fz * 1.6));
  A.slots[A.cur] = { def: d.def, mag: d.mag, reserve: d.reserve };
  // même animation qu'un changement d'arme : l'arme baisse, puis la nouvelle monte (vmEquip à mi-course, voir ctlWeapon)
  A.reload = null; A.boltT = 0; A.switching = 0.52; A.switchTo = A.cur; P.busy = false;
  VM.action = null; VM.lowerTarget = 1;
  kcEvent('vma', { sid: P.kcI, name: 'switch', dur: 0.52, data: { to: d.def.key, from: old.def.key } });
  sfxMech('pickup');
}
