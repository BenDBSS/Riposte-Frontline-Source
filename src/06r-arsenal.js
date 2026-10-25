/* ==========================================================================
   ARSENAL : progression par arme, déblocages, classes préconçues et personnalisées
   Chaque arme gagne de l'XP à chaque élimination (100, plus 50 à la tête) et monte de niveau (1 à WLEVEL_MAX). Le niveau
   d'une arme débloque, dans l'ordre : ses accessoires (ATT[id].lvl), ses camouflages (CAMOS[id].lvl, par paliers de niveau
   seulement), et d'autres armes (champ unlock des armes : { from : arme à monter, level }).
   Les armes de départ (sans unlock) sont disponibles tout de suite.
   Quatre classes préconçues (CLASSES, 06i-armes.js) ne se modifient pas ; jusqu'à cinq classes personnalisées (nom, arme
   principale et pistolet, accessoires, camouflages) se créent dans des emplacements que le niveau du joueur débloque
   (CUSTOM_UNLOCK). Le niveau du joueur est celui du compte, ou celui des parties jouées sans compte.
   L'état est gardé dans le navigateur (localStorage, clé ARS_KEY) : progression par arme (XP, éliminations, tirs à la
   tête), classes personnalisées et XP des parties sans compte. Connecté, le joueur en retrouve aussi une copie sur son
   compte (arsSync, route arsenal) : elle le suit d'un appareil à l'autre et survit à un stockage vidé.
   ========================================================================== */
/* Niveau maximal d'une arme : 30, celui du camouflage Holo, le dernier déblocage (50 de la 4.1.0 à la 4.4.0, quand le Holo le demandait ; 20 avant,
   WLEVEL_V3 : celui des sauvegardes de version 3 et moins). L'XP gagnée au-delà reste enregistrée, elle ne compte plus */
const ARS_KEY = 'cod_arsenal', WLEVEL_MAX = 30, WLEVEL_V3 = 20, ARS_XP = { kill: 100, head: 50 };
const ARS = { wxp: {}, k: {}, h: {}, px: 0, t0: 0, gain: null, sess: {}, saveT: 0, pushT: 0, synced: '', syncT: 0, ver: 4, cfg: {}, lt: 0, lvSeen: 1, lvT: 0, ch: {}, chMaps: [], chSess: {} };
/* cfg : dernière configuration (accessoires et camouflage) de chaque arme dans l'atelier ; elle revient d'elle-même quand on rechoisit l'arme ;
   lt : heure de la dernière retouche des classes personnalisées ou de cfg (arsLoadoutEdit), qui départage deux appareils (arsApply) ;
   ch, chMaps : avancement des défis (06s-defis.js) ; chSess : ce qu'ils ont gagné pendant la partie */

/* XP cumulée pour atteindre le niveau l avec une arme : les pistolets, moins utilisés, montent plus vite. Un niveau demande environ trois fois
   plus d'éliminations qu'avant la 2.20 (WXP_OLD, courbe d'avant, sert à convertir les sauvegardes sans que personne perde un niveau).
   Au-delà du niveau flat, la courbe continue à pas constant : chaque niveau coûte le passage de flat - 1 à flat (5 900 XP, de 40 à 60
   éliminations), si bien que les niveaux 21 à 30 avancent à un rythme régulier (niveau 30 : 126 000 XP, de 840 à 1 260 éliminations,
   environ deux fois le niveau 20 ; en prolongeant la courbe, 138 000 XP et jusqu'à 80 éliminations pour un seul des derniers niveaux) */
const WXP = { k: 450, p: 1.7, flat: 20 }, WXP_OLD = { k: 120, p: 1.6 };
const wxpCurve = (c, id, l) => {
  const pw = (n) => (n <= 1 ? 0 : c.k * Math.pow(n - 1, c.p)), f = c.flat && l > c.flat ? l - c.flat : 0;
  return Math.round((pw(l - f) + f * (f ? pw(c.flat) - pw(c.flat - 1) : 0)) * (WEAPONS[id].cat === 'pistol' ? 0.6 : 1));
};
function wxpForLevel(id, l) { return wxpCurve(WXP, id, l); }
function wLevelInfo(id) {
  const xp = Math.max(0, Math.floor(ARS.wxp[id] || 0));
  let l = 1; while (l < WLEVEL_MAX && xp >= wxpForLevel(id, l + 1)) l++;
  const a = wxpForLevel(id, l), b = l >= WLEVEL_MAX ? a : wxpForLevel(id, l + 1);
  return { level: l, xp, into: xp - a, need: b - a, next: b };
}
/* XP d'une sauvegarde d'avant la nouvelle courbe : même niveau, même avancement dans le niveau (le niveau maximal était alors 20) */
function wxpMigrate(id, xp) {
  let l = 1; while (l < WLEVEL_V3 && xp >= wxpCurve(WXP_OLD, id, l + 1)) l++;
  const a = wxpCurve(WXP_OLD, id, l), b = l >= WLEVEL_V3 ? a : wxpCurve(WXP_OLD, id, l + 1), f = b > a ? (xp - a) / (b - a) : 0;
  return Math.round(wxpForLevel(id, l) + f * ((l >= WLEVEL_V3 ? 0 : wxpForLevel(id, l + 1) - wxpForLevel(id, l))));
}
const wLevel = (id) => wLevelInfo(id).level;

/* ---------- Déblocages ---------- */
/* Préversion (branche dev : playriposte-dev.vercel.app et ses adresses de branche) : quelques camouflages offerts pour les voir sans
   les mériter, à la demande du propriétaire (le Holo sur l'UMP-45, qui demande sinon le niveau 30), avec leur arme. Lu sur l'adresse
   de la page : la production (playriposte.com) n'est pas concernée, même une fois dev fusionnée dans main */
const PREVIEW_HOST = /^playriposte-dev\.|-git-dev-/.test(location.hostname), PREVIEW_CAMOS = { ump45: ['holo'] };
/* Raison pour laquelle une arme est verrouillée ('' si disponible ; sur la préversion, une arme qui y a un camouflage offert l'est) */
function weaponLock(id) {
  const u = WEAPONS[id].unlock; if (!u || (PREVIEW_HOST && PREVIEW_CAMOS[id])) return '';
  const lv = wLevel(u.from);
  return lv >= u.level ? '' : `${_t('Montez le {0} au niveau {1} (niveau {2})', WEAPONS[u.from].name, u.level, lv)}`;
}
function attLock(wid, aid) { const L = ATT[aid].lvl, lv = wLevel(wid); return lv >= L ? '' : `${_t('Niveau {0} de l\u0027arme (niveau {1})', L, lv)}`; }
function camoLock(wid, cid) {
  if (PREVIEW_HOST && (PREVIEW_CAMOS[wid] || []).includes(cid)) return '';
  const L = CAMOS[cid].lvl, lv = wLevel(wid);
  return lv >= L ? '' : `${_t('niveau {0} de l\u0027arme (niveau {1})', L, lv)}`;
}
/* Tout ce que l'arme wid a débloqué, pour détecter ce qu'un gain de niveau ou un exploit apporte de neuf */
function arsUnlocked(wid) {
  const out = new Set(), base = WEAPONS[wid];
  for (const a in ATT) if (attFits(base, a) && !attLock(wid, a)) out.add('att:' + a);
  for (const c in CAMOS) if (!camoLock(wid, c)) out.add('camo:' + c);
  for (const w in WEAPONS) if (WEAPONS[w].unlock && WEAPONS[w].unlock.from === wid && !weaponLock(w)) out.add('wpn:' + w);
  return out;
}
function arsUnlockName(k) {
  const [t, id] = k.split(':');
  return t === 'att' ? ATT[id].name : t === 'camo' ? _t('Camouflage {0}', CAMOS[id].name) : WEAPONS[id].name;
}

/* Prochain déblocage de l'arme wid : { level, name } ou null (tout est débloqué) */
function arsNextUnlock(wid) {
  const lv = wLevel(wid), base = WEAPONS[wid]; let best = null;
  const note = (level, name) => { if (level > lv && (!best || level < best.level)) best = { level, name }; };
  for (const a in ATT) if (attFits(base, a)) note(ATT[a].lvl, ATT[a].name);
  for (const c in CAMOS) note(CAMOS[c].lvl, _t('Camouflage {0}', CAMOS[c].name));
  for (const w in WEAPONS) if (WEAPONS[w].unlock && WEAPONS[w].unlock.from === wid) note(WEAPONS[w].unlock.level, WEAPONS[w].name);
  return best;
}
/* Arme (identifiant) qui porte ce nom dans les annonces d'élimination : '' pour le couteau, la grenade, l'hélicoptère... */
const WEAPON_ID_BY_NAME = {}; for (const id in WEAPONS) WEAPON_ID_BY_NAME[WEAPONS[id].name] = id;

/* ---------- Gains ---------- */
/* Une élimination avec l'arme wid : renvoie { weapon, level, up, gained, items } (up : niveaux gagnés, items : déblocages) */
function arsKill(wid, head) {
  const base = WEAPONS[wid]; if (!base) return null;
  const before = arsUnlocked(wid), l0 = wLevel(wid), gain = ARS_XP.kill + (head ? ARS_XP.head : 0);
  ARS.wxp[wid] = (ARS.wxp[wid] || 0) + gain; ARS.k[wid] = (ARS.k[wid] || 0) + 1; if (head) ARS.h[wid] = (ARS.h[wid] || 0) + 1;
  const S = ARS.sess[wid] || (ARS.sess[wid] = { xp: 0, k: 0, h: 0, l0 }); S.xp += gain; S.k++; if (head) S.h++;
  const l1 = wLevel(wid), items = [...arsUnlocked(wid)].filter((k) => !before.has(k));
  arsSaveSoon();
  return { weapon: wid, level: l1, up: l1 - l0, gained: gain, items };
}
/* Les gains d'une partie : remis à zéro à son ouverture, repris par l'écran de fin */
function arsSessionReset() { ARS.sess = {}; ARS.chSess = {}; ARS.t0 = MATCH.time; ARS.gain = null; ARS.lvSeen = playerLevel(); ARS.lvT = 0; }
function arsSessionHtml() {
  const rows = Object.keys(ARS.sess).filter((id) => ARS.sess[id].xp > 0).sort((a, b) => ARS.sess[b].xp - ARS.sess[a].xp).map((id) => {
    const S = ARS.sess[id], L = wLevelInfo(id), up = L.level - S.l0;
    return `<div class="ars-row"><b>${WEAPONS[id].name}</b><span>${_t('+{0} XP · {1} élim.', S.xp, S.k)}</span><i>${_t('niveau {0}{1}', L.level, up > 0 ? ` <em>+${up}</em>` : '')}</i></div>`;
  });
  return rows.join('');
}

/* ---------- Niveau du joueur ---------- */
/* XP cumulée pour atteindre un niveau : la même courbe que le serveur des comptes (api/_lib/progress.js) */
const pxpForLevel = (l) => (l <= 1 ? 0 : Math.round(250 * Math.pow(l - 1, 1.6)));
function levelOfXp(xp) { let l = 1; while (l < 100 && xp >= pxpForLevel(l + 1)) l++; return l; }
/* Niveau retenu pour les déblocages : celui du compte, ou celui des parties jouées sans compte, le plus grand des deux (un
   déblocage ne se perd pas en changeant de situation) */
function playerLevel() {
  const acct = typeof ACCT !== 'undefined' && ACCT.user && ACCT.level ? ACCT.level.level : 1;
  return Math.max(acct, levelOfXp(ARS.px));
}
/* XP d'une partie jouée sans compte, avec les règles du serveur (api/_lib/progress.js, matchXp) ; appelé à la fin de la partie */
function arsLocalXp(result) {
  ARS.gain = null;
  const me = PL.ent, dur = Math.max(0, Math.floor(MATCH.time - ARS.t0));
  if (dur < 30 || (typeof ACCT !== 'undefined' && ACCT.user)) return;
  const k = me.kills, h = Math.min(PL.hsKills || 0, k), l0 = playerLevel();
  let xp = k * 50 + h * 15 + me.assists * 20 + Math.floor(dur / 60) * 20 + 100 + (result === 'win' ? 150 : result === 'draw' ? 50 : 0);
  if (!MATCH.online) xp *= 0.5;
  xp = Math.min(2500, Math.round(xp)); ARS.px += xp; arsSaveSoon();
  const l1 = playerLevel();
  ARS.gain = { xp, level: l1, up: l1 - l0, slots: CUSTOM_UNLOCK.filter((v) => v > l0 && v <= l1).length };
}

/* XP de la partie en cours jusqu'ici, d'après les règles du serveur sans le bonus de fin de partie (la partie finie en donne au moins autant) :
   un niveau annoncé en partie sera donc bien acquis à la fin */
function arsLiveXp() {
  const me = PL.ent, dur = Math.floor(MATCH.time - ARS.t0); if (dur < 30) return 0;
  const k = me.kills, h = Math.min(PL.hsKills || 0, k);
  let xp = k * 50 + h * 15 + me.assists * 20 + Math.floor(dur / 60) * 20; if (!MATCH.online) xp *= 0.5;
  return Math.min(2500, Math.round(xp));
}
/* Niveau du joueur compte tenu de la partie en cours */
function playerLevelLive() {
  const live = arsLiveXp(), acct = typeof ACCT !== 'undefined' && ACCT.user && ACCT.level ? ACCT.level.xp : -1;
  return Math.max(playerLevel(), levelOfXp((acct >= 0 ? acct : ARS.px) + live));
}
/* Une fois par seconde en partie : annonce chaque niveau du joueur franchi (09n-armurerie.js, arsNotifyLevel) */
function arsLevelTick(dt) {
  if ((ARS.lvT -= dt) > 0) return;
  ARS.lvT = 1;
  const L = playerLevelLive();
  while (ARS.lvSeen < L) { ARS.lvSeen++; arsNotifyLevel(ARS.lvSeen); }
}

/* ---------- Classes ---------- */
const PRESETS = CLASSES.length, CUSTOM_MAX = 5, CUSTOM_UNLOCK = [3, 6, 10, 15, 20], CUSTOM_NAME_MAX = 16;
for (const c of CLASSES) { c.pa = []; c.sa = []; c.pc = null; c.sc = null; c.def = { primary: c.primary, secondary: c.secondary }; c.preset = true; c.ks = KS_DEFAULT.slice(); }
/* Les emplacements de classes personnalisées suivent les classes préconçues (indices PRESETS à PRESETS + CUSTOM_MAX - 1) */
for (let n = 0; n < CUSTOM_MAX; n++) {
  CLASSES.push({ name: _t('Classe {0}', n + 1), desc: _t('Une classe de votre composition, avec armes, accessoires et camouflages.'), primary: 'm4', secondary: 'm9', nades: NADE_COUNT, nade: 'frag',
    pa: [], sa: [], pc: null, sc: null, ks: KS_DEFAULT.slice(), def: { primary: 'm4', secondary: 'm9' }, custom: true, slot: n, made: false });
}
const customUnlocked = (n) => playerLevel() >= CUSTOM_UNLOCK[n];
/* Une classe se choisit si elle est préconçue, ou personnalisée, créée et débloquée */
const classAvail = (i) => { const c = CLASSES[i]; return !!c && (!c.custom || (c.made && customUnlocked(c.slot))); };
const classIds = () => CLASSES.map((c, i) => i).filter(classAvail);
/* La classe choisie existe toujours (supprimée, ou emplacement perdu) : sinon la première */
function classFix() { if (!classAvail(Settings.loadout)) { Settings.loadout = 0; if (typeof saveSettings === 'function') saveSettings(); } }
/* Arme principale et secondaire d'une classe, avec accessoires et camouflage */
function classWeapons(i) {
  const c = CLASSES[i];
  return [weaponDef(c.primary, c.pa, c.pc), weaponDef(c.secondary, c.sa, c.sc)];
}
/* Les trois séries d'une classe, rangées par seuil (une classe en cours de retouche peut n'en avoir que deux : complétée) */
function classKs(i) { const c = CLASSES[i]; return ksFill(c ? c.ks : null); }
/* Choisit ou retire une série dans une classe personnalisée ; renvoie '' ou la raison du refus. Une série au seuil d'une autre déjà choisie prend sa place */
function classToggleKs(i, id) {
  if (!classEditable(i)) return _t('Cette classe ne se modifie pas.');
  const c = CLASSES[i], K = KSDEF[id]; if (!K) return '';
  if (c.ks.includes(id)) { c.ks = c.ks.filter((x) => x !== id); arsLoadoutEdit(); return ''; }
  const same = c.ks.find((x) => KSDEF[x].n === K.n);
  if (!same && c.ks.length >= KS_SLOTS) return _t('Trois séries au plus. Retirez-en une avant d\u0027en choisir une autre.');
  c.ks = ksSort(c.ks.filter((x) => x !== same).concat(id)); arsLoadoutEdit(); return '';
}
/* Construit d'avance les modèles d'une arme montée (vue subjective et vue extérieure) : le menu, pas la partie, en paie le coût */
function gunPrebuild(def) { if (!VM.models[def.key]) VM.models[def.key] = vmGunModel(def.key); worldGunGeometry(def.key); }
function arsenalPrebuild() { for (const i of classIds()) for (const d of classWeapons(i)) gunPrebuild(d); }
/* Libère les modèles construits pour des essais d'accessoires dans l'Armurerie : on garde ceux des classes, des armes nues
   (bots, armes au sol) et tout ce qu'un soldat, une arme au sol ou la killcam porte encore */
function gunTrim() {
  const keep = new Set(Object.keys(WEAPONS));
  for (const i of classIds()) for (const d of classWeapons(i)) keep.add(d.key);
  if (VM.curDef) keep.add(VM.curDef.key);
  for (const e of entities) { if (e.weapon) keep.add(e.weapon.key); if (e.model && e.model.gunKey) keep.add(e.model.gunKey); if (e.model && e.model.guns) for (const k in e.model.guns) keep.add(k); }
  if (KC.body && KC.body.gunKey) keep.add(KC.body.gunKey);
  for (const k in DROP.models) keep.add(k);
  const free = (grp) => grp.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  for (const k of Object.keys(VM.models)) if (!keep.has(k)) { free(VM.models[k].group); delete VM.models[k]; }
  for (const k of Object.keys(WORLD_GUN_GEO)) if (!keep.has(k)) { const G = WORLD_GUN_GEO[k]; for (const lv of ['hi', 'lo']) for (const m in G[lv]) if (G[lv][m]) G[lv][m].dispose(); delete WORLD_GUN_GEO[k]; delete GRIP_SHAPES[k]; }
}
/* Remet une configuration en règle : arme existante et débloquée (sinon celle d'origine), accessoires débloqués qui vont sur l'arme
   (au plus attMax, un par emplacement), camouflage débloqué */
function classClean(c, wkey, akey, ckey, want, defId) {
  let id = WEAPONS[want] && !weaponLock(want) && (wkey === 'primary' ? WEAPONS[want].cat !== 'pistol' : WEAPONS[want].cat === 'pistol') ? want : defId;
  const base = WEAPONS[id];
  c[wkey] = id;
  c[akey] = attNormalize(base, (c[akey] || []).filter((a) => ATT[a] && !attLock(id, a)));
  c[ckey] = c[ckey] && CAMOS[c[ckey]] && !camoLock(id, c[ckey]) ? c[ckey] : null;
}
function classCleanAll(c) {
  classClean(c, 'primary', 'pa', 'pc', c.primary, c.def.primary);
  classClean(c, 'secondary', 'sa', 'sc', c.secondary, c.def.secondary);
  c.ks = ksFill(c.ks);
  if (!NADE_TYPES[c.nade]) c.nade = 'frag';
}
/* Type de grenade d'une classe personnalisée (un seul, NADE_COUNT à chaque vie) */
function classSetNade(i, id) {
  if (!classEditable(i) || !NADE_TYPES[id] || CLASSES[i].nade === id) return;
  CLASSES[i].nade = id; arsLoadoutEdit();
}
/* Une classe personnalisée créée se modifie ; les préconçues et les emplacements vides, jamais */
const classEditable = (i) => { const c = CLASSES[i]; return !!c && c.custom && c.made; };
/* Crée la classe de l'emplacement n (nom par défaut, armes de départ) ; renvoie son indice, ou -1 si l'emplacement est verrouillé ou pris */
function classCreate(n) {
  const c = CLASSES[PRESETS + n]; if (!c || c.made || !customUnlocked(n)) return -1;
  const mp = arsRecall(c.def.primary), ms = arsRecall(c.def.secondary);
  Object.assign(c, { made: true, name: _t('Classe {0}', n + 1), primary: c.def.primary, secondary: c.def.secondary, pa: mp.a, sa: ms.a, pc: mp.c, sc: ms.c, ks: KS_DEFAULT.slice(), nade: 'frag' });
  arsLoadoutEdit(); return PRESETS + n;
}
function classRename(i, name) {
  if (!classEditable(i)) return;
  const c = CLASSES[i], t = String(name == null ? '' : name).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX);
  c.name = t || _t('Classe {0}', c.slot + 1); arsLoadoutEdit();
}
function classDelete(i) {
  if (!classEditable(i)) return;
  const c = CLASSES[i]; c.made = false; c.name = _t('Classe {0}', c.slot + 1); c.primary = c.def.primary; c.secondary = c.def.secondary; c.pa = []; c.sa = []; c.pc = c.sc = null; c.ks = KS_DEFAULT.slice(); c.nade = 'frag';
  classFix(); arsLoadoutEdit();
}
/* Retient la configuration d'une arme, et la rend remise en règle (accessoires et camouflage encore valables) */
const arsRemember = (id, att, camo) => { if (WEAPONS[id]) ARS.cfg[id] = { a: att.slice(), c: camo || null }; };
function arsRecall(id) {
  const m = ARS.cfg[id], base = WEAPONS[id]; if (!m) return { a: [], c: null };
  return { a: attNormalize(base, (m.a || []).filter((x) => ATT[x] && attFits(base, x) && !attLock(id, x))), c: m.c && CAMOS[m.c] && !camoLock(id, m.c) ? m.c : null };
}
function classSetWeapon(i, which, id) {
  if (!classEditable(i)) return false;
  const c = CLASSES[i], k = which === 's';
  if (!WEAPONS[id] || weaponLock(id)) return false;
  if (k ? WEAPONS[id].cat !== 'pistol' : WEAPONS[id].cat === 'pistol') return false;
  if (c[k ? 'secondary' : 'primary'] === id) return true;
  // l'arme quittée garde ses accessoires et son camouflage pour la prochaine fois, la nouvelle reprend les siens
  arsRemember(c[k ? 'secondary' : 'primary'], c[k ? 'sa' : 'pa'], c[k ? 'sc' : 'pc']);
  const m = arsRecall(id); c[k ? 'secondary' : 'primary'] = id; c[k ? 'sa' : 'pa'] = m.a; c[k ? 'sc' : 'pc'] = m.c;
  arsLoadoutEdit(); return true;
}
/* Pose ou retire un accessoire ; renvoie '' ou la raison du refus */
function classToggleAtt(i, which, aid) {
  if (!classEditable(i)) return _t('Cette classe ne se modifie pas.');
  const c = CLASSES[i], k = which === 's', id = c[k ? 'secondary' : 'primary'], base = WEAPONS[id], key = k ? 'sa' : 'pa';
  if (c[key].includes(aid)) { c[key] = c[key].filter((x) => x !== aid); arsRemember(id, c[key], c[k ? 'sc' : 'pc']); arsLoadoutEdit(); return ''; }
  if (!attFits(base, aid)) return _t('Cet accessoire ne va pas sur cette arme.');
  const lock = attLock(id, aid); if (lock) return `${_t('Accessoire verrouillé : {0}.', lock)}`;
  // un accessoire de plus au même point d'accroche remplace l'ancien ; sinon la limite s'applique
  const same = c[key].find((x) => attGroup(x) === attGroup(aid));
  const next = c[key].filter((x) => x !== same);
  if (next.length >= attMax(base)) return `${_t('Une arme porte {0} accessoires au plus. Retirez-en un.', attMax(base))}`;
  c[key] = attNormalize(base, next.concat(aid)); arsRemember(id, c[key], c[k ? 'sc' : 'pc']); arsLoadoutEdit(); return '';
}
function classSetCamo(i, which, cid) {
  if (!classEditable(i)) return false;
  const c = CLASSES[i], k = which === 's', id = c[k ? 'secondary' : 'primary'];
  if (cid && (!CAMOS[cid] || camoLock(id, cid))) return false;
  c[k ? 'sc' : 'pc'] = cid || null; arsRemember(id, c[k ? 'sa' : 'pa'], c[k ? 'sc' : 'pc']); arsLoadoutEdit(); return true;
}
/* Retire les accessoires et le camouflage de l'arme choisie */
function classClearWeapon(i, which) {
  if (!classEditable(i)) return;
  const c = CLASSES[i], k = which === 's'; c[k ? 'sa' : 'pa'] = []; c[k ? 'sc' : 'pc'] = null; arsRemember(c[k ? 'secondary' : 'primary'], [], null); arsLoadoutEdit();
}

/* ---------- Stockage ---------- */
function arsSaveSoon() { if (ARS.saveT) return; ARS.saveT = setTimeout(arsSave, 700); }
/* Une classe personnalisée ou la configuration d'une arme vient de changer : notée, elle passera devant celle des autres appareils */
function arsLoadoutEdit() { ARS.lt = Math.max(Date.now(), ARS.lt + 1); arsSaveSoon(); }
/* Instantané enregistrable : stockage local et copie du compte (api/_lib/handlers.js, arsenal) */
function arsSnapshot() {
  const custom = CLASSES.slice(PRESETS).map((c) => (c.made ? { n: c.name, p: c.primary, pa: c.pa, pc: c.pc, s: c.secondary, sa: c.sa, sc: c.sc, k: c.ks, g: c.nade } : null));
  return { v: ARS.ver, wxp: ARS.wxp, k: ARS.k, h: ARS.h, px: Math.floor(ARS.px), cfg: ARS.cfg, lt: ARS.lt, custom, ch: ARS.ch, cm: ARS.chMaps };
}
function arsSave() {
  ARS.saveT = 0;
  try { localStorage.setItem(ARS_KEY, JSON.stringify(arsSnapshot())); } catch (e) { /* stockage indisponible : la progression reste valable pour la session */ }
  arsPushSoon();
}
/* Copie sur le compte : la progression des armes suit le joueur d'un appareil à l'autre. Les enregistrements se regroupent
   (une seule requête toutes les 5 s au plus) ; sans compte, rien n'est envoyé. */
function arsPushSoon() {
  if (!ACCT.user || ARS.pushT) return;
  ARS.pushT = setTimeout(() => { ARS.pushT = 0; if (ACCT.user) acctApi('arsenal', { data: arsSnapshot() }); }, 5000);
}
/* À la connexion : fusionne la copie du compte et celle de l'appareil (le plus haut niveau de chaque arme l'emporte ; pour les classes
   personnalisées et la configuration des armes, la copie retouchée le plus récemment, voir arsApply), puis renvoie le résultat au compte. */
async function arsSync() {
  if (!ACCT.user) return;
  const r = await acctApi('arsenal', {});
  if (!r.ok || !r.data) return;
  if (r.data.data) { arsApply(r.data.data, true); for (const c of CLASSES) classCleanAll(c); classFix(); }
  ARS.syncT = Date.now();
  arsSave(); // enregistre la fusion sur l'appareil et la renvoie au compte
  PICKERS.forEach(renderPicker); if (UI.screen === 'classes') classesHeader(); // les écrans déjà dessinés montrent la progression fusionnée
}
/* Une application de téléphone reste ouverte des jours sans se recharger : la copie du compte n'était lue qu'au chargement de la page, la progression gagnée ailleurs
   n'arrivait donc jamais. Au retour au premier plan (hors partie, au plus une fois par minute) elle est relue et fusionnée ; à la mise en arrière-plan, ce qui attend
   d'être envoyé part tout de suite (keepalive : la requête survit à la page), sans quoi le délai de 5 s laissait la progression sur l'appareil. */
function arsFlush() {
  if (!ACCT.user || location.protocol === 'file:' || !(ARS.saveT || ARS.pushT)) return;
  if (ARS.saveT) { clearTimeout(ARS.saveT); ARS.saveT = 0; try { localStorage.setItem(ARS_KEY, JSON.stringify(arsSnapshot())); } catch (e) { /* ignoré */ } }
  clearTimeout(ARS.pushT); ARS.pushT = 0;
  try { fetch('/api/arsenal', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Lang': LANG }, body: JSON.stringify({ data: arsSnapshot() }) }).catch(() => {}); } catch (e) { /* ignoré */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) arsFlush();
  else if (ACCT.user && MATCH.state === 'menu' && Date.now() - ARS.syncT > 60000) { ARS.syncT = Date.now(); arsSync(); }
});
addEventListener('pagehide', arsFlush);
function arsApply(s, merge) {
  if (!s || !(s.v >= 1 && s.v <= 4)) return;
  const num = (o) => { const r = {}; if (o && typeof o === 'object') for (const k in o) if (WEAPONS[k] && Number.isFinite(+o[k]) && +o[k] > 0) r[k] = Math.min(1e7, Math.floor(+o[k])); return r; };
  const join = (a, b) => { const r = { ...a }; for (const k in b) r[k] = Math.max(r[k] || 0, b[k]); return r; };
  let wxp = num(s.wxp);
  if (s.v < 3) { for (const id in wxp) wxp[id] = wxpMigrate(id, wxp[id]); arsSaveSoon(); } // courbe plus longue : les niveaux déjà atteints sont gardés
  // niveau maximal passé de 20 à 50 (version 4) : l'XP gagnée au-delà du niveau 20 ne comptait pour rien, elle ne fait pas monter d'un coup ;
  // chacun repart du début du niveau 20. Toute copie d'avant (appareil, compte) est ramenée ainsi à la lecture : la fusion garde le plus
  // haut de chaque arme, une ancienne copie rendrait sinon l'XP retirée
  if (s.v < 4) { for (const id in wxp) wxp[id] = Math.min(wxp[id], wxpForLevel(id, WLEVEL_V3)); arsSaveSoon(); }
  const px = Number.isFinite(+s.px) && +s.px > 0 ? Math.min(1e8, Math.floor(+s.px)) : 0;
  // défis (06s-defis.js ; leur liste n'existe pas encore au chargement : on garde tout compteur bien formé) et cartes où une partie a été terminée
  const ch = {}; if (s.ch && typeof s.ch === 'object') for (const k in s.ch) if (/^[a-zA-Z]{2,16}$/.test(k) && Number.isFinite(+s.ch[k]) && +s.ch[k] > 0) ch[k] = Math.min(1e6, Math.floor(+s.ch[k]));
  const cm = Array.isArray(s.cm) ? s.cm.map(String).filter((m, i, a) => MAPS.some((x) => x.id === m) && a.indexOf(m) === i) : [];
  if (merge) { ARS.wxp = join(ARS.wxp, wxp); ARS.k = join(ARS.k, num(s.k)); ARS.h = join(ARS.h, num(s.h)); ARS.px = Math.max(ARS.px, px); ARS.ch = join(ARS.ch, ch); for (const m of cm) if (!ARS.chMaps.includes(m)) ARS.chMaps.push(m); }
  else { ARS.wxp = wxp; ARS.k = num(s.k); ARS.h = num(s.h); ARS.px = px; ARS.ch = ch; ARS.chMaps = cm; }
  /* Classes personnalisées et configuration des armes : la copie retouchée le plus récemment (lt) l'emporte, entière, classes supprimées comprises.
     Avant, celle de l'appareil gardait toujours ses classes : retouchées sur l'ordinateur, elles ne changeaient jamais sur le téléphone, et une
     classe supprimée revenait de l'autre appareil. Sans date des deux côtés (copies d'avant), les emplacements vides se remplissent seulement */
  const lt = Number.isFinite(+s.lt) && +s.lt > 0 ? Math.floor(+s.lt) : 0, take = !merge || lt > ARS.lt, fill = merge && !lt && !ARS.lt;
  if (take) ARS.lt = lt;
  if (s.cfg && typeof s.cfg === 'object') for (const k in s.cfg) { const m = s.cfg[k]; if (WEAPONS[k] && m && typeof m === 'object' && (take || (fill && !ARS.cfg[k]))) ARS.cfg[k] = { a: Array.isArray(m.a) ? m.a.map(String).slice(0, 8) : [], c: m.c ? String(m.c) : null }; }
  if (s.v >= 2 && Array.isArray(s.custom) && (take || fill)) for (let n = 0; n < CUSTOM_MAX; n++) {
    const c = CLASSES[PRESETS + n], x = s.custom[n];
    if (!x || typeof x !== 'object') { if (merge && take && c.made) Object.assign(c, { made: false, name: _t('Classe {0}', n + 1), primary: c.def.primary, secondary: c.def.secondary, pa: [], sa: [], pc: null, sc: null, ks: KS_DEFAULT.slice() }); continue; }
    if (!take && c.made) continue;
    c.made = true; c.name = String(x.n == null ? '' : x.n).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, CUSTOM_NAME_MAX).replace(/^(?:Classe|Class) (\d)$/, (m, d) => _t('Classe {0}', d)) || _t('Classe {0}', n + 1);
    c.primary = String(x.p); c.secondary = String(x.s); c.pa = Array.isArray(x.pa) ? x.pa.map(String) : []; c.sa = Array.isArray(x.sa) ? x.sa.map(String) : [];
    c.pc = x.pc ? String(x.pc) : null; c.sc = x.sc ? String(x.sc) : null;
    c.ks = ksFill(Array.isArray(x.k) ? x.k.map(String) : null); // séries (absentes des copies d'avant : celles d'origine)
    c.nade = NADE_TYPES[x.g] ? x.g : 'frag'; // type de grenade (absent des copies d'avant : la frag)
  }
}
function arsLoad() {
  let s = null; try { s = JSON.parse(localStorage.getItem(ARS_KEY) || 'null'); } catch (e) { /* ignoré */ }
  arsApply(s, false);
  for (const c of CLASSES) classCleanAll(c);
}
arsLoad();
