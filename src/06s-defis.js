/* ==========================================================================
   DÉFIS : ce qui débloque les tenues de défi (06gc-tenues-defi.js), trois défis par tenue. Ils poussent à essayer chaque
   famille d'armes, les modes de jeu, les séries et les cartes (le Gilet jaune : les cartes françaises) ; ni trop simples ni décourageants (de l'ordre de dix à quinze
   parties par tenue). Une tenue se débloque quand ses trois défis sont accomplis ; les compteurs partent de zéro (rien de ce
   qui a été joué avant les défis ne compte).
   Comptés pendant la partie, au moment où l'action a lieu (élimination du joueur : killEnt, defisKill ; drone UAV : useUAV ;
   point capturé : domChanged ; partie terminée : endMatch, defisMatchEnd), en solo comme en ligne ; un défi accompli et une
   tenue débloquée s'annoncent comme les déblocages d'armes (arsShow), l'écran de fin résume les progrès de la partie.
   Gardés avec la progression des armes (ARS.ch : compteurs, ARS.chMaps : cartes où une partie a été terminée ; 06r-arsenal.js,
   arsSnapshot et arsApply) : dans le navigateur et, connecté, sur le compte (le plus haut de chaque compteur l'emporte à la
   fusion). Comme la progression des armes, sans autorité du serveur : ce ne sont que des tenues.
   ========================================================================== */
/* id, tenue débloquée, objectif, intitulé (ce qu'on compte), aide (comment y arriver) */
const DEFIS = [
  { id: 'nPompe', skin: 'nomad', goal: 100, label: _t('Éliminations au fusil à pompe') },
  { id: 'nBrut', skin: 'nomad', goal: 20, label: _t('Éliminations au couteau ou à la grenade') },
  { id: 'nFfa', skin: 'nomad', goal: 5, label: _t('Parties de match à mort finies dans les trois premiers'), hint: _t('Mode Match à mort, en solo ou en ligne') },
  { id: 'tPrec', skin: 'tempest', goal: 100, label: _t('Éliminations au fusil de précision') },
  { id: 'tLoin', skin: 'tempest', goal: 15, label: _t('Éliminations à 50 m ou plus') },
  { id: 'tUav', skin: 'tempest', goal: 5, label: _t('Drones UAV appelés'), hint: _t('Le drone se gagne avec une série de 4 éliminations') },
  { id: 'fSil', skin: 'verdant', goal: 75, label: _t('Éliminations avec un silencieux'), hint: _t('Le silencieux se débloque au niveau 4 d\u0027une arme, dans l\u0027atelier de classe') },
  { id: 'fAcc', skin: 'verdant', goal: 40, label: _t('Éliminations accroupi') },
  { id: 'fCartes', skin: 'verdant', goal: MAPS.filter((m) => m.ok).length, label: _t('Cartes où vous avez terminé une partie') },
  { id: 'rPm', skin: 'raptor', goal: 150, label: _t('Éliminations au pistolet-mitrailleur') },
  { id: 'rMouv', skin: 'raptor', goal: 25, label: _t('Éliminations en glissade ou en plein saut') },
  { id: 'rDouble', skin: 'raptor', goal: 15, label: _t('Doubles éliminations'), hint: _t('Deux éliminations à moins de 4 secondes d\u0027écart') },
  { id: 'vFa', skin: 'void', goal: 200, label: _t('Éliminations au fusil d\u0027assaut') },
  { id: 'vPist', skin: 'void', goal: 50, label: _t('Éliminations au pistolet') },
  { id: 'vDom', skin: 'void', goal: 25, label: _t('Points capturés en Domination') },
  { id: 'gParties', skin: 'gilet', goal: 12, label: _t('Parties terminées sur une carte française'), hint: _t('Val-Blanc, Kervénec ou French Dream') },
  { id: 'gVict', skin: 'gilet', goal: 5, label: _t('Victoires sur une carte française'), hint: _t('Val-Blanc, Kervénec ou French Dream') },
  { id: 'gElim', skin: 'gilet', goal: 150, label: _t('Éliminations sur une carte française') },
];
/* Cartes françaises (défis du Gilet jaune) : la gare du col, le port breton, le lotissement */
const DEFI_FR = ['givre', 'embruns', 'lotissement'];
const DEFI_BY_ID = {}; for (const d of DEFIS) DEFI_BY_ID[d.id] = d;
/* Avancement d'un défi (plafonné à son objectif) */
function defiCount(id) {
  const D = DEFI_BY_ID[id]; if (!D) return 0;
  const n = id === 'fCartes' ? ARS.chMaps.filter((m) => MAPS.some((x) => x.id === m && x.ok)).length : ARS.ch[id] || 0;
  return Math.min(D.goal, n);
}
const defiDone = (id) => defiCount(id) >= DEFI_BY_ID[id].goal;
const defisOf = (skin) => DEFIS.filter((d) => d.skin === skin);
/* Une tenue est-elle à la disposition du joueur : celles de base toujours, celles de défi quand leurs défis sont accomplis, une tenue
   unique (06gd-tenue-unique.js) pour le seul compte connecté qui la possède (nom d'utilisateur vérifié par le serveur, me) */
function skinUnlocked(s) {
  const K = SKINS[s]; if (!K) return false;
  if (K.owner) return !!(ACCT.user && String(ACCT.user.username).toLowerCase() === K.owner);
  return !K.defi || defisOf(s).every((d) => defiDone(d.id));
}
/* La tenue du joueur : celle qu'il a choisie si elle est à sa disposition, sinon Assaut (choix d'un autre appareil, défis non accomplis ici) */
function skinMine() { const s = skinId(Settings.skin); return skinUnlocked(s) ? s : 'assault'; }

/* ---------- Avancement ---------- */
/* Ajoute n au défi id ; annonce le défi accompli, puis la tenue débloquée */
function defiAdd(id, n = 1) {
  const D = DEFI_BY_ID[id]; if (!D || defiDone(id)) return;
  const was = skinUnlocked(D.skin);
  if (id === 'fCartes') { if (ARS.chMaps.includes(n)) return; ARS.chMaps.push(n); n = 1; } // (n : la carte)
  else ARS.ch[id] = Math.min(D.goal, (ARS.ch[id] || 0) + n);
  ARS.chSess[id] = (ARS.chSess[id] || 0) + n;
  arsSaveSoon();
  if (!defiDone(id)) return;
  arsShow(`<b>${_t('Défi accompli')}</b><span>${esc(D.label)} : ${D.goal}</span>`);
  if (!was && skinUnlocked(D.skin)) {
    arsShow(`<b>${_t('Tenue débloquée : {0}', SKINS[D.skin].name)}</b><span>${_t('À porter depuis l\u0027écran Tenues')}</span>`);
    if (typeof skinRefresh === 'function') skinRefresh();
  }
}
/* Une élimination du joueur (killEnt) : arme ou moyen, distance, posture et mouvement au moment du coup */
function defisKill(a, v, weapon, head) {
  const wid = WEAPON_ID_BY_NAME[weapon], cat = wid ? WEAPONS[wid].cat : null;
  if (weapon === NET_WSPECIAL.knife || weapon === NET_WSPECIAL.nade) defiAdd('nBrut');
  if (a.comboN === 2) defiAdd('rDouble'); // une fois par enchaînement, à la deuxième élimination (quel que soit le moyen)
  if (DEFI_FR.includes(CURMAP.id)) defiAdd('gElim');
  if (!cat) return; // le reste ne vaut que pour une arme (pas la frappe aérienne, l'hélicoptère ou une chute)
  defiAdd({ shotgun: 'nPompe', sniper: 'tPrec', smg: 'rPm', ar: 'vFa', pistol: 'vPist' }[cat]);
  if (a.pos.distanceTo(v.pos) >= 50) defiAdd('tLoin');
  const W = curW(); if (W && W.def.id === wid && W.def.silent) defiAdd('fSil');
  if (a.crouch && !((a.slideT || 0) > 0)) defiAdd('fAcc');
  if ((a.slideT || 0) > 0 || !a.onGround) defiAdd('rMouv');
  void head;
}
/* Fin d'une partie menée à terme (endMatch) : rang en match à mort, carte jouée, victoire (result : 'win', 'loss' ou 'draw') */
function defisMatchEnd(result, rank) {
  if (MATCH.mode === 'ffa' && rank <= 3) defiAdd('nFfa');
  if (CURMAP.id) defiAdd('fCartes', CURMAP.id);
  if (DEFI_FR.includes(CURMAP.id)) { defiAdd('gParties'); if (result === 'win') defiAdd('gVict'); }
}
/* Écran de fin : les défis qui ont avancé pendant la partie */
function defisEndHtml() {
  return DEFIS.filter((d) => ARS.chSess[d.id] > 0).map((d) => {
    const n = defiCount(d.id), ok = n >= d.goal;
    return `<div class="ars-row${ok ? ' done' : ''}"><b>${esc(d.label)}</b><span>${ok ? _t('Accompli') : `+${ARS.chSess[d.id]}`}</span><i>${n} / ${d.goal}${ok ? '' : ` · ${SKINS[d.skin].name}`}</i></div>`;
  }).join('');
}
