/* ==========================================================================
   CHOIX DE LA TENUE : écran Tenues du menu principal seulement (aperçu 3D qu'on fait tourner, tel que le voient les alliés),
   pas en partie ; la tenue choisie (Settings.skin) vaut quelle que soit l'arme de la classe : bras de la vue subjective, corps du
   joueur (ombre, killcam) et, en ligne, ce que voient les autres (champ sk de la présence, 09c-net.js). Les tenues elles-mêmes :
   06ga-tenues.js.
   L'aperçu est rendu par le moteur du jeu dans la scène de la vitrine (09o-vitrine.js, vwDraw : cible de rendu relue, jamais la
   toile du jeu), seulement quand il change (rotation, tenue, point de vue, classe) ; les vignettes passent par la file des vignettes
   d'armes (une par tâche).
   Le soldat d'aperçu se tient comme en partie : la pose vient de poseSoldier (06b-soldier.js), figée en posture de combat (sans les
   mouvements d'attente tirés au hasard), l'arme principale de la classe choisie en main (le modèle de l'armurerie, mêmes matières).
   Aperçu animé (skinLive), dès que le fond animé des menus est là (09w-fond.js) : le soldat marche sur place, arme en visée, de trois
   quarts (SK_POSE.a, l'angle de chaque arrivée sur l'écran) ; il ne tourne qu'au doigt (c'est lui qui tourne, pas la caméra : sa cape,
   simulée, suit le mouvement, avec l'air de sa marche et la brise d'un ventilateur de studio). Il est dessiné dans la toile du jeu,
   pendant la boucle d'images et juste après le fond (même cadence : celle de l'écran sur ordinateur, 60 images par seconde au plus au doigt, 09w-fond.js), dans le cadre de l'aperçu (viewport et
   scissor), sans cible de rendu ni relecture : un studio (fond en dégradé, sol éclairé avec les ombres de contact des pieds, lumière
   principale, d'appoint et de contour teintée de vert), aucune carte d'ombre ni texture de plus. Mouvement réduit : soldat immobile,
   qui ne tourne qu'au doigt. Sans fond animé (mode graphique économique, contexte perdu) : l'image fixe d'avant, rendue à part et
   recopiée (skinDraw).
   ========================================================================== */
const SKV = { host: null, cv: null, ctx: null, a: 0.6, drag: null, dirty: true, W: 0, H: 0, models: {}, mats: {}, guns: {}, pose: null, view: '', lmodels: {}, lguns: {},
  live: false, fail: false, acc: 0, ft: 0, lv: '', mine: '' };
/* Toutes les tenues de l'écran : celles de base, puis celles de défi (06gc-tenues-defi.js) ; SKV.view : celle de l'aperçu (la tenue portée, ou une
   tenue de défi verrouillée que l'on regarde avant de l'avoir). Une tenue unique (06gd-tenue-unique.js) ne s'y ajoute que pour son propriétaire
   (skinListed) : les autres n'en voient ni la carte ni la vignette */
const SKIN_ALL = SKIN_IDS.concat(SKIN_DEFI);
const skinOwned = () => SKIN_UNIQUE.filter(skinUnlocked);
const skinListed = () => SKIN_ALL.concat(skinOwned());
const SK_AIM = new V3(0, 0.93, 0);
/* Posture de l'aperçu : part de la visée (0 : arme basse, en travers du corps ; 1 : épaulée) et inclinaison du regard (rad) ; a : azimut de la caméra
   (trois quarts depuis la droite du soldat, l'arme se présente de côté) */
const SK_POSE = { aim: 0.5, pitch: -0.1, a: 0.6 };
/* Matière d'aperçu d'une tenue (sans volume d'éclairage : aucune carte n'est chargée aux menus) ; teinte et bandes posées à chaque rendu */
function skinPvMat(skin) { return SKV.mats[skin] || (SKV.mats[skin] = gearMaterial(skin, 'pv')); }
/* Soldat d'aperçu d'une tenue (modèle détaillé), avec les mêmes os que les soldats du jeu ; S.gun porte l'arme (posée par skinPvPlace) */
function skinPvModel(skin) { return SKV.models[skin] || (SKV.models[skin] = skinPvBuild(skin)); }
/* Soldat d'aperçu de l'aperçu animé (le sien : les vignettes posent l'autre, et remettent son tissu au repos), et son arme */
function skinLiveModel(skin) { return SKV.lmodels[skin] || (SKV.lmodels[skin] = skinPvBuild(skin)); }
function skinLiveGun(key) { return SKV.lguns[key] || (SKV.lguns[key] = buildGunModel(key).group); }
function skinPvBuild(skin) {
  const R = soldierRest(), root = new THREE.Group(), bones = [];
  for (let i = 0; i < SOLDIER_NB; i++) { const b = new THREE.Object3D(); b.position.setFromMatrixPosition(R.mats[i]); b.quaternion.copy(R.q[i]); root.add(b); bones.push(b); }
  const skel = new THREE.Skeleton(bones, R.mats.map((m) => m.clone().invert()));
  const mesh = new THREE.SkinnedMesh(soldierGeometry(skin, 'hi'), skinPvMat(skin)); mesh.bind(skel, _RIG_ID); mesh.frustumCulled = false; bones[SB.PEL].add(mesh);
  const gun = new THREE.Group(); root.add(gun);
  const M = { root, bones, skel, J: R.J.map((v) => v.clone()), lastN: R.lastN.map((v) => v.clone()), fp: [0, 0], fy: [0, 0], sink: 0, gun, grips: null, kind: 'rifle', key: '' };
  if (SKINS[skin].cloth) { M.cloth = clothAttach(M, skin, skinPvMat(skin), skel); M.cloth.mesh.frustumCulled = false; } // tissu simulé (06gb-tissu.js), retombé au repos à chaque pose
  return M;
}
/* Arme principale de la classe choisie (la dernière jouée) : celle que tient le soldat d'aperçu */
function skinPvGunKey() { classFix(); return classWeapons(Settings.loadout)[0].key; }
/* Arme de la vitrine (modèle de l'armurerie, dans le repère de l'arme des soldats : voir worldGunGeometry), une par arme montée */
function skinPvGun(key) { return SKV.guns[key] || (SKV.guns[key] = buildGunModel(key).group); }
/* Pose figée d'un soldat qui tient l'arme key : la pose procédurale du jeu, rejouée une seconde à l'arrêt (les ressorts se posent), en posture
   de combat (SK_POSE), sans transfert de poids, regard ni réajustement tirés au hasard ; calculée une fois par arme, la même pour toutes les tenues */
function skinPvPose(key) {
  if (SKV.pose && SKV.pose.key === key) return SKV.pose;
  const R = soldierRest(), G = worldGunGeometry(key);
  const P = { key, J: R.J.map((v) => v.clone()), Jp: R.J.map((v) => v.clone()), gun: new THREE.Object3D(), grips: G.grips, kind: G.kind };
  const e = { model: P, pos: new V3(), vel: new V3(), yaw: 0, pitch: SK_POSE.pitch, crouchAmt: 0, sprinting: false, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -1e9, lastSeenT: -1e9, recoil: 0, throwT: 0, arms: null };
  for (let i = 0; i < 30; i++) {
    Object.assign(P, { wtClk: 1e9, lkClk: 1e9, wtT: 0, lkT: 0, lkP: 0, gyL: 0, gyR: 0 }); // (le sol de l'aperçu est plat, à hauteur 0)
    if (P.cyc !== undefined) Object.assign(P, { aimW: SK_POSE.aim, aimWV: 0, cyc: 0, t: 1.2 });
    poseSoldier(e, 1 / 30);
  }
  return (SKV.pose = P);
}
/* Place le soldat d'aperçu S dans la pose de l'arme key et lui met l'arme en main */
function skinPvPlace(S, key) {
  const P = skinPvPose(key), g = skinPvGun(key);
  if (g.parent !== S.gun) { S.gun.clear(); S.gun.add(g); } // une seule arme en main (celle de la classe précédente part)
  if (S.key === key) return;
  for (let i = 0; i < 15; i++) S.J[i].copy(P.J[i]);
  S.fp = P.fp.slice(); S.fy = P.fy.slice(); S.headQ = P.headQ.clone(); S.grips = P.grips; S.kind = P.kind;
  S.gun.position.copy(P.gun.position); S.gun.quaternion.copy(P.gun.quaternion);
  layoutSoldier(S, true); if (S.cloth) clothSettle(S, S.cloth); S.root.updateMatrixWorld(true); S.key = key;
}
/* Os du soldat d'aperçu M recalculés pour le rendu qui suit : le moteur ne le fait qu'une fois par image de son compteur (renderer.info),
   qui n'avance qu'en partie (09-game.js), pas aux menus ; sans cela, le corps garderait sa première pose (l'arme, elle, suivrait).
   Le compteur avance aussi : le moteur ne renvoie les sommets modifiés au GPU qu'une fois par image de ce compteur, et le tissu simulé
   affiché restait celui de la première image (une cape figée, collée au bassin, que les bras traversaient) */
function skinSkel(M) { renderer.info.render.frame++; M.root.updateMatrixWorld(true); M.skel.update(); }
/* Rend la tenue skin vue par rel (0 allié, 1 ennemi), caméra à l'azimut a, dans ctx (dw x dh) ; la vitrine ne montre qu'elle */
function skinDraw(ctx, dw, dh, skin, rel, a) {
  const S = vwScene(), M = skinPvModel(skin), m = skinPvMat(skin), live = VW.model && VW.model.visible ? VW.model : null;
  skinPvPlace(M, skinPvGunKey());
  skinTone(skin, rel, m.color); skinRelColor(rel, m.userData.skU.tag.value);
  skinSkel(M);
  if (live) live.visible = false;
  S.scene.add(M.root);
  S.cam.aspect = dw / dh; S.cam.updateProjectionMatrix();
  const d = 1.08 / Math.tan(THREE.MathUtils.degToRad(VW_FOV) / 2) * Math.max(1, 0.62 / (dw / dh));
  vwCamPlace(S.cam, a + Math.PI / 2, 0.06, d, SK_AIM);
  try { vwDraw(ctx, dw, dh, dw, dh); } finally { S.scene.remove(M.root); if (live) live.visible = true; }
}
/* Vignette d'une tenue (vue de trois quarts depuis sa droite, par un allié), dans la file des vignettes d'armes (thumbsStep : clés « skin:... ») ; SKTH.gun : l'arme
   tenue sur les vignettes, qui sont refaites quand la classe choisie en change (skinThumbsCheck) */
const SKTH = { w: 200, h: 300, ctx: null, gun: '' };
function skinThumbRender(skin) {
  const key = 'skin:' + skin;
  try {
    if (!SKTH.ctx) { const cv = document.createElement('canvas'); cv.width = SKTH.w; cv.height = SKTH.h; SKTH.ctx = cv.getContext('2d'); }
    SKTH.gun = skinPvGunKey();
    skinDraw(SKTH.ctx, SKTH.w, SKTH.h, skin, 0, SK_POSE.a);
    VTHUMB.img[key] = SKTH.ctx.canvas.toDataURL('image/webp', 0.9);
  } catch (e) { VTHUMB.fails[key] = (VTHUMB.fails[key] || 0) + 1; delete VTHUMB.img[key]; gpuLog('skin thumbnail failed: ' + skin + ' (' + (e && e.message) + ')'); return ''; }
  skinRelease(skin); // une tenue de défi que rien d'autre ne montre ne reste pas en mémoire pour une vignette
  return VTHUMB.img[key];
}
const skinThumbImg = (s) => `<img data-thumb="skin:${s}"${VTHUMB.img['skin:' + s] ? '' : ' data-pend'} alt="" src="${VTHUMB.img['skin:' + s] || VBLANK}" decoding="async">`;

/* ---------- Choix ---------- */
/* Le joueur prend la tenue s : enregistrée, et appliquée tout de suite (bras, corps, en ligne). Une tenue de défi verrouillée ne se prend pas :
   elle passe seulement dans l'aperçu, avec le détail de ses défis dans le bas de l'aperçu (skinInfoHtml). */
function skinPick(s) {
  s = skinId(s); skinView(s);
  if (!skinUnlocked(s)) { skinRefresh(); return; }
  if (s === skinMine() && s === skinId(Settings.skin)) { skinRefresh(); return; }
  Settings.skin = s; saveSettings();
  if (VM_LOOK.hand) vmSetLook(s, 0);
  soldierLookAll();
  if (NET.on) NET.flush = true; // la présence suivante annonce la nouvelle tenue
  skinRefresh();
}
/* Le compte connecté a changé (connexion, déconnexion, autre compte) : une tenue unique se porte ou se quitte avec lui (skinMine) ; bras,
   corps, ce que voient les autres en ligne et l'écran Tenues suivent */
function skinAcct() {
  const m = skinMine(); if (m === SKV.mine) return;
  const was = SKV.mine; SKV.mine = m;
  if (VM_LOOK.hand) vmSetLook(m, 0);
  soldierLookAll();
  if (NET.on) NET.flush = true;
  if (SKV.host) { if (SKV.view === was) skinView(m); skinRefresh(); }
  if (was) setTimeout(() => skinRelease(was), 0);
}
/* Une tenue de défi n'occupe la mémoire que tant qu'on la montre : géométries, matières, textures et soldat d'aperçu sont libérés quand ni le
   joueur, ni l'aperçu, ni un soldat, ni la killcam ne la portent (elle est refaite à la demande : soldierGeometry, soldierMaterial) */
function skinRelease(s) {
  if (!SKINS[s] || !(SKINS[s].defi || SKINS[s].owner) || s === skinMine() || s === SKV.view) return;
  for (const e of entities) if (e.model && e.model.lod && e.model.lod.skin === s) return;
  if (KC.body && KC.body.lod && KC.body.lod.skin === s) return;
  const M = SKV.models[s]; if (M) { if (M.cloth) clothDetach(M); delete SKV.models[s]; }
  const L = SKV.lmodels[s]; if (L) { if (L.cloth) clothDetach(L); delete SKV.lmodels[s]; }
  if (SKV.mats[s]) { SKV.mats[s].dispose(); delete SKV.mats[s]; }
  for (const k of ['hi', 'lo']) if (SOLDIER_GEOS[s + k]) { SOLDIER_GEOS[s + k].dispose(); delete SOLDIER_GEOS[s + k]; delete SOLDIER_GEOS['stats' + s + k]; }
  for (const r of [0, 1]) { const m = SOLDIER_MATS[s + r]; if (m) { m.dispose(); if (csm && csm.shaders) csm.shaders.delete(m); delete SOLDIER_MATS[s + r]; } }
  for (const k of ['tp', 'fp']) { const T = GEAR.maps[s + k]; if (T) { T.map.dispose(); delete GEAR.maps[s + k]; } }
}
/* Début de partie : les tenues de défi que personne ne porte sont libérées */
function skinTrim() { for (const s of SKIN_DEFI.concat(SKIN_UNIQUE)) skinRelease(s); }
/* Tenue montrée par l'aperçu ; celle qu'on quitte est libérée si plus rien ne la montre */
function skinView(s) { const old = SKV.view; SKV.view = s; SKV.dirty = true; if (old && old !== s) setTimeout(() => skinRelease(old), 0); }
const SK_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
/* Barre d'avancement (0 à 1) */
const skinBar = (f) => `<span class="sk-pb"><i style="width:${Math.round(clamp(f, 0, 1) * 100)}%"></i></span>`;
/* Une carte : vignette, nom, rôle ; « Choisie » sur la tenue portée ; une tenue de défi verrouillée porte un cadenas et l'avancement de ses
   défis ; celle qui est dans l'aperçu est marquée d'un filet clair, et le détail de ses défis s'affiche dans le bas de l'aperçu (skinInfoHtml) :
   la carte garde sa taille, rien ne bouge dans la liste */
function skinCardHtml(s) {
  const K = SKINS[s], cur = skinMine(), lock = !skinUnlocked(s), viewing = lock && SKV.view === s, D = K.defi ? defisOf(s) : [], done = D.filter((d) => defiDone(d.id)).length;
  // verrouillée : le cadenas et l'avancement prennent la place du rôle (une carte de téléphone n'a que deux lignes)
  let tx = `<span class="cn">${K.name}</span>${!lock ? `<span class="cw">${K.role}</span>` : ''}`;
  if (s === cur) tx += `<span class="cb next">${_t('Choisie')}</span>`;
  else if (lock) tx += `<span class="sk-lk">${SK_LOCK}${_t('Défis {0} / {1}', done, D.length)}</span>${skinBar(D.reduce((a, d) => a + defiCount(d.id) / d.goal, 0) / D.length)}`;
  return `<button type="button" class="sk-card${lock ? ' locked' : ''}${viewing ? ' viewing' : ''}${K.defi ? ' defi' : ''}" role="option" data-skin="${s}" aria-selected="${s === cur}">${skinThumbImg(s)}<span class="sk-tx">${tx}</span></button>`;
}
/* Détail d'une tenue de défi verrouillée (nom, rôle, avancement, chaque défi avec sa barre) : dans le bas de l'aperçu de l'écran Tenues ;
   '' pour une tenue qu'on peut prendre */
function skinInfoHtml(s) {
  const K = SKINS[s]; if (!K || !K.defi || skinUnlocked(s)) return '';
  const D = defisOf(s), done = D.filter((d) => defiDone(d.id)).length;
  return `<div class="sk-info-h"><b>${K.name}</b><span class="sk-lk">${SK_LOCK}${_t('Défis {0} / {1}', done, D.length)}</span></div><span class="cw">${K.role}</span>`
    + `<span class="sk-dl">${D.map((d) => { const n = defiCount(d.id), ok = n >= d.goal; return `<span class="sk-d${ok ? ' ok' : ''}"><span class="sk-dt"><b>${esc(d.label)}</b><em>${ok ? _t('Accompli') : `${n} / ${d.goal}`}</em></span>${skinBar(n / d.goal)}${d.hint && !ok ? `<small>${esc(d.hint)}</small>` : ''}</span>`; }).join('')}</span>`;
}
/* Liste des tenues (cartes) : celles de base, puis celles de défi sous leur titre */
function skinCardsHtml() {
  const own = skinOwned();
  return SKIN_IDS.map(skinCardHtml).join('')
    + (own.length ? `<p class="sk-h">${_t('Tenue unique')}<span>${_t('Faite pour vous, personne d\u0027autre ne peut la porter')}</span></p>` + own.map(skinCardHtml).join('') : '')
    + `<p class="sk-h">${_t('Tenues de défi')}<span>${_t('Relevez leurs défis pour les débloquer')}</span></p>` + SKIN_DEFI.map(skinCardHtml).join('');
}
/* La classe choisie a changé d'arme depuis les vignettes : elles repassent dans la file (en tête), l'arme nouvelle en main */
function skinThumbsCheck() {
  if (!SKTH.gun || SKTH.gun === skinPvGunKey()) return;
  for (const s of skinListed()) { delete VTHUMB.img['skin:' + s]; thumbsWant('skin:' + s); }
}
/* Rafraîchit l'écran Tenues (la tenue ne se change qu'au menu, pas en partie) */
function skinRefresh() {
  skinThumbsCheck();
  const a = document.activeElement, k = a && a.classList && a.classList.contains('sk-card') ? a.dataset.skin : null, el = $('skList');
  const had = k && el.contains(a);
  el.innerHTML = skinCardsHtml();
  if (had) { const f = el.querySelector(`[data-skin="${k}"]`); if (f) f.focus({ preventScroll: true }); } // la manette et le clavier gardent leur place
  // détail des défis de la tenue verrouillée qu'on regarde : dans le bas de l'aperçu
  const info = skinInfoHtml(SKV.view);
  const si = $('skInfo'); if (si) { if (si.__h !== info) { si.__h = info; si.innerHTML = info; } si.classList.toggle('hidden', !info); SKV.host.classList.toggle('has-info', !!info); }
  SKV.dirty = true;
}

/* ---------- Écran Tenues : aperçu ---------- */
function skinScreenInit() {
  const host = $('skView'); if (!host) return;
  SKV.host = host;
  host.innerHTML = _t('<canvas class="vw-cv" aria-hidden="true"></canvas><div class="vw-help">Glissez pour faire tourner</div>');
  SKV.cv = host.firstChild; SKV.ctx = SKV.cv.getContext('2d');
  const info = document.createElement('div'); info.id = 'skInfo'; info.className = 'sk-info hidden'; info.setAttribute('aria-live', 'polite'); host.appendChild(info);
  SKV.cv.addEventListener('pointerdown', (e) => { SKV.drag = { x: e.clientX, a: SKV.a }; SKV.cv.setPointerCapture(e.pointerId); host.classList.add('drag'); });
  SKV.cv.addEventListener('pointermove', (e) => { if (!SKV.drag) return; SKV.a = SKV.drag.a - (e.clientX - SKV.drag.x) * 0.01; SKV.dirty = true; });
  const up = () => { SKV.drag = null; host.classList.remove('drag'); };
  SKV.cv.addEventListener('pointerup', up); SKV.cv.addEventListener('pointercancel', up);
  SKV.cv.addEventListener('dblclick', () => { SKV.a = SK_POSE.a; SKV.dirty = true; });
  SKV.cv.tabIndex = 0; SKV.cv.setAttribute('aria-label', _t('Tenue en 3D, flèches pour la faire tourner'));
  SKV.cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); SKV.a += e.key === 'ArrowLeft' ? 0.15 : -0.15; SKV.dirty = true; } });
  $('skList').addEventListener('click', (e) => { const b = e.target.closest('.sk-card'); if (b) { sfxUi('click'); skinPick(b.dataset.skin); } });
}
/* Arrivée sur l'écran Tenues */
function renderSkins() {
  skinView(skinMine()); skinRefresh(); SKV.W = 0; SKV.a = SK_POSE.a; SKV.lv = ''; SKV.dirty = true; // de trois quarts à chaque arrivée
  // vignettes des tenues : en tête de file (elles attendaient en fin de file, thumbsStart)
  if (!VTHUMB.ready) return;
  const want = skinListed().map((s) => 'skin:' + s).filter((k) => !VTHUMB.img[k]);
  VTHUMB.queue = VTHUMB.queue.filter((k) => !want.includes(k));
  for (const k of want.reverse()) thumbsWant(k);
}
/* Une image de l'aperçu : appelée par la boucle principale tant que l'écran Tenues est affiché, avant le fond ; aperçu animé : demande au
   fond de se redessiner si l'aperçu a changé (mouvement réduit : le fond ne se redessine pas de lui-même) ; image fixe : ne rend que si
   quelque chose a changé */
function skinTick() {
  if (!SKV.host) return;
  const live = MBG.live && !MBG.failed && !SKV.fail;
  if (live !== SKV.live) { SKV.live = live; SKV.host.classList.toggle('live', live); document.body.classList.toggle('sk-live', live); if (live && SKV.ctx) SKV.ctx.clearRect(0, 0, SKV.cv.width, SKV.cv.height); SKV.dirty = true; }
  if (live) { if (SKV.dirty) mbgShown(); return; }
  const r = SKV.host.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
  if (W < 20 || H < 20) return;
  if (W !== SKV.W || H !== SKV.H) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), bs = renderer.getDrawingBufferSize(_vwV2), k = Math.min(dpr, bs.x / W, bs.y / H);
    SKV.W = W; SKV.H = H; SKV.cv.width = Math.max(2, Math.floor(W * k)); SKV.cv.height = Math.max(2, Math.floor(H * k)); SKV.dirty = true;
  }
  if (!SKV.dirty) return;
  SKV.dirty = false;
  try { skinDraw(SKV.ctx, SKV.cv.width, SKV.cv.height, SKINS[SKV.view] ? SKV.view : skinMine(), 0, SKV.a); } catch (e) { gpuLog('skin view failed: ' + (e && e.message)); }
}

/* ---------- Écran Tenues : aperçu animé (studio) ---------- */
/* Entité de pose du soldat d'aperçu M (une par tenue) : marche sur place, arme key en visée, au sol plat de l'aperçu */
function skinLiveEnt(M, key) {
  if (!M.ent) {
    M.Jp = M.J.map((v) => v.clone());
    M.ent = { model: M, pos: new V3(), vel: new V3(), yaw: SKV.a, pitch: -0.05, crouchAmt: 0, sprinting: false, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -1e9, lastSeenT: -1e9, recoil: 0, throwT: 0, arms: { adsW: 1 } };
  }
  if (M.liveKey !== key) { const G = worldGunGeometry(key); M.grips = G.grips; M.kind = G.kind; M.liveKey = key; }
  // une arme par arme montée, propre à l'aperçu animé (passée d'une tenue à l'autre)
  const g = skinLiveGun(key); if (g.parent !== M.gun) { M.gun.clear(); M.gun.add(g); }
  return M.ent;
}
/* Air autour du soldat d'aperçu (monde, m/s) : brise du ventilateur de studio (de face, qui ondule) et air de sa marche sur place (il
   avance à vel sans bouger : l'air vient vers lui à -vel, la cape vole derrière lui) ; tissu simulé de l'aperçu (06gb-tissu.js), le même
   qu'en partie : tourné au doigt, le soldat entraîne sa cape, qui prend du retard, s'écarte avec l'élan et continue sur sa lancée.
   L'air de la marche suit la direction du soldat avec retard (SK_WL, 1/s : un marcheur qui tourne ne change de direction que peu à
   peu) ; collé à elle, il replaquait la cape dans son dos au moment même où le soldat tourne */
const SK_FAN = new V3(), SK_WL = 1.2;
function skinCloth(M, C, d) {
  const sim = C.sim, e = M.ent;
  clothBones(M, C); if (!clothTargets(M, C)) return;
  if (!sim.live || sim.fresh) { sim.reset(); sim.normals(); sim.live = true; sim.acc = 0; C.wy = e.yaw; }
  SKV.ft += d; const t = SKV.ft, k = 0.8 + 0.35 * Math.sin(t * 0.7) + 0.25 * Math.sin(t * 1.9 + 1.3);
  C.wy += angDiff(C.wy, e.yaw) * (1 - Math.exp(-SK_WL * d)); const v = e.vel.length();
  SK_FAN.set(0.35 * k + Math.sin(C.wy) * v, 0, 1.1 * k + Math.cos(C.wy) * v);
  sim.acc = Math.min(sim.acc + d, CLOTH_H * 4);
  while (sim.acc >= CLOTH_H) { sim.step(CLOTH_H, SK_FAN, 4); sim.normals(); sim.acc -= CLOTH_H; }
  clothWrite(M, C);
}
/* Pose de l'image : marche sur place à 2 m/s (clips de 06ac-loco.js), arme en visée, sans regard ni transfert de poids tirés au hasard ;
   immobile si le mouvement est réduit */
function skinLivePose(M, key, d, move) {
  const e = skinLiveEnt(M, key), v = move ? 2 : 0;
  e.yaw = SKV.a; e.vel.set(-Math.sin(e.yaw) * v, 0, -Math.cos(e.yaw) * v);
  M.gyL = 0; M.gyR = 0; M.wtClk = 1e9; M.lkClk = 1e9; M.wtT = 0; M.lkT = 0; M.lkP = 0;
  poseSoldier(e, d); layoutSoldier(M, true);
  if (M.cloth) skinCloth(M, M.cloth, d);
}
/* Studio : fond en dégradé (dessiné à part, en coordonnées d'image), sol éclairé et ombres de contact, trois lumières et le ciel */
const SKS = { scene: null, cam: null, bg: null, bgCam: null, floor: null, rim: null };
const SK_BG_FS = `uniform vec2 uRes; uniform vec3 uTint; varying vec2 vS;
void main() {
  vec2 p = vS - vec2(0.5, 0.6); p.x *= uRes.x / uRes.y;
  float d = length(p);
  vec3 col = mix(vec3(0.13, 0.14, 0.11), vec3(0.03, 0.034, 0.028), smoothstep(0.0, 0.9, d));
  col += uTint * 0.07 * smoothstep(0.75, 0.0, d);
  vec2 q = vS - 0.5; col *= 1.0 - 0.9 * dot(q, q);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
const SK_FLOOR_VS = `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SK_FLOOR_FS = `uniform vec4 uFeet; uniform vec2 uPel; uniform vec3 uTint; varying vec3 vW;
void main() {
  float r = length(vW.xz);
  float pool = smoothstep(1.7, 0.0, r);
  float ring = smoothstep(0.014, 0.0, abs(r - 0.92));
  float sh = 0.5 * smoothstep(0.5, 0.0, length((vW.xz - uPel) * vec2(1.0, 1.3)))
    + 0.45 * smoothstep(0.17, 0.02, length(vW.xz - uFeet.xy)) + 0.45 * smoothstep(0.17, 0.02, length(vW.xz - uFeet.zw));
  vec3 col = vec3(0.15, 0.16, 0.13) * (0.3 + 0.95 * pool) + uTint * 0.22 * ring * pool;
  col *= 1.0 - clamp(sh, 0.0, 0.8);
  gl_FragColor = vec4(col, smoothstep(2.3, 1.1, r));
}`;
function skinStudio() {
  if (SKS.scene) return SKS;
  const sc = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff0dc, 2.5); key.position.set(-1.6, 2.6, -2.3); sc.add(key);
  const fill = new THREE.DirectionalLight(0xb4c6e6, 0.65); fill.position.set(2.3, 1.0, -1.3); sc.add(fill);
  SKS.rim = new THREE.DirectionalLight(0xffffff, 2.4); SKS.rim.position.set(0.9, 2.1, 2.7); sc.add(SKS.rim);
  sc.add(new THREE.HemisphereLight(0xdfe6f0, 0x1a1712, 0.35));
  const fm = new THREE.ShaderMaterial({ vertexShader: SK_FLOOR_VS, fragmentShader: SK_FLOOR_FS, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uFeet: { value: new THREE.Vector4() }, uPel: { value: new THREE.Vector2() }, uTint: { value: new THREE.Color() } } });
  SKS.floor = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), fm); SKS.floor.rotation.x = -Math.PI / 2; SKS.floor.position.y = 0.002; SKS.floor.renderOrder = -1; sc.add(SKS.floor);
  SKS.scene = sc; SKS.cam = new THREE.PerspectiveCamera(VW_FOV, 1, 0.05, 30);
  const bm = new THREE.ShaderMaterial({ vertexShader: MBG_VS, fragmentShader: SK_BG_FS, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uRes: { value: new THREE.Vector2() }, uTint: { value: new THREE.Color() } } });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bg = new THREE.Mesh(tri, bm); bg.frustumCulled = false;
  SKS.bg = new THREE.Scene(); SKS.bg.add(bg); SKS.bgCam = new THREE.Camera();
  return SKS;
}
/* teinte du studio : le vert des bandes alliées (l'aperçu montre la tenue telle que la voient les alliés, la vue ennemie ne sert qu'en partie) */
const SK_TINT = new THREE.Color(0x8fe0a2);
const _skR = new THREE.Vector4(), _skS = new THREE.Vector4(), _skC = new THREE.Color();
/* Appelée par la boucle d'images juste après le fond des menus (drew : le fond vient d'être dessiné, la toile est donc à jour ailleurs) :
   pose du soldat pour le temps écoulé depuis son image précédente, puis rendu dans le cadre de l'aperçu */
function skinLive(drew, dt) {
  SKV.acc += dt;
  if (!SKV.live || !drew || !SKV.host) return;
  try { skinLiveDraw(); } catch (e) { SKV.fail = true; gpuLog('skin live view failed: ' + (e && e.message)); } // l'image fixe reprend (skinTick)
}
function skinLiveDraw() {
  const d = Math.min(SKV.acc, 0.1); SKV.acc = 0;
  const r = SKV.host.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect();
  if (r.width < 20 || r.height < 20 || cr.width < 20 || r.bottom <= cr.top || r.top >= cr.bottom) return;
  const k = VIEW.w / cr.width, x = (r.left - cr.left + 1) * k, y = (cr.bottom - r.bottom + 1) * k, w = (r.width - 2) * k, h = (r.height - 2) * k; // (dans la bordure)
  const move = mbgMotion(), skin = SKINS[SKV.view] ? SKV.view : skinMine(), M = skinLiveModel(skin), m = skinPvMat(skin), key = skinPvGunKey();
  // autre tenue, ou retour sur l'écran (soldat remis de trois quarts d'un coup) : son tissu repart du repos, sans prendre le saut pour un élan
  if (SKV.lv !== skin) { SKV.lv = skin; if (M.cloth) M.cloth.sim.live = false; }
  skinLivePose(M, key, d, move);
  skinTone(skin, 0, m.color); skinRelColor(0, m.userData.skU.tag.value);
  const S = skinStudio(), tint = SK_TINT, U = S.floor.material.uniforms, J = M.J;
  U.uFeet.value.set(J[J_FTL].x, J[J_FTL].z, J[J_FTR].x, J[J_FTR].z); U.uPel.value.set(J[J_PEL].x, J[J_PEL].z); U.uTint.value.copy(tint);
  S.bg.children[0].material.uniforms.uRes.value.set(w, h); S.bg.children[0].material.uniforms.uTint.value.copy(tint);
  S.rim.color.copy(_skC.setRGB(1, 1, 1).lerp(tint, 0.35));
  S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
  const dist = 1.08 / Math.tan(THREE.MathUtils.degToRad(VW_FOV) / 2) * Math.max(1, 0.62 / (w / h));
  vwCamPlace(S.cam, Math.PI / 2, 0.05, dist, SK_AIM);
  const R = renderer, keep = { tm: R.toneMapping, ex: R.toneMappingExposure, oe: R.outputEncoding, ac: R.autoClear, st: R.getScissorTest() };
  R.getViewport(_skR); R.getScissor(_skS);
  S.scene.environment = envMap; S.scene.add(M.root); skinSkel(M);
  try {
    R.setRenderTarget(null); R.setViewport(x, y, w, h); R.setScissor(x, y, w, h); R.setScissorTest(true);
    R.autoClear = false; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1; R.outputEncoding = THREE.sRGBEncoding;
    R.render(S.bg, S.bgCam); R.clearDepth(); R.render(S.scene, S.cam);
  } finally {
    S.scene.remove(M.root);
    R.toneMapping = keep.tm; R.toneMappingExposure = keep.ex; R.outputEncoding = keep.oe; R.autoClear = keep.ac;
    R.setScissorTest(keep.st); R.setScissor(_skS); R.setViewport(_skR);
  }
  SKV.dirty = false;
}
