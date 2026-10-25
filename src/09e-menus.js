/* ==========================================================================
   MENUS : menu principal, solo, multijoueur (salon), classes, options,
   chargement d'une partie, déploiement (choix de la classe) et menu pause.
   Les écrans sont des <section class="scr"> de #ui ; un seul est visible (UI.screen).
   Échap revient en arrière, les flèches déplacent le focus, Entrée valide.
   Le salon en ligne garde ses éléments et sa logique dans 09c-net.js (netRender).
   ========================================================================== */
const UI = { screen: 'main', stack: [], busy: false, flow: null, timer: 0, pm: 'home', lobbyBack: false };
/* Un changement de classe est appliqué tout de suite si le joueur vient d'apparaître (secondes) ; sinon à la réapparition */
const CLASS_GRACE = 5;
const DEPLOY_AUTO = 30; // en ligne, déploiement automatique au bout de ce délai (secondes)
const DIFF_HINT = [_t('Réactions lentes et tirs imprécis, pour prendre ses marques.'), _t('Un adversaire honnête, qui vise et réagit comme un joueur moyen.'), _t('Réactions vives et tirs précis. Ils sautent, glissent et contournent comme de vrais joueurs.')];
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uiWait = (ms) => new Promise((r) => setTimeout(r, ms));
const cls = (i) => CLASSES[i] || CLASSES[0];

/* ---------- Écrans ---------- */
function uiOpen(name = 'main', stack = []) {
  UI.stack = stack.slice(); UI.busy = false; UI.flow = null; UI.timer = 0;
  $('matchload').classList.add('hidden'); $('ui').classList.remove('hidden');
  uiGo(name, false, true);
}
function uiHide() { $('ui').classList.add('hidden'); }
function uiGo(name, push = true, fresh = push) {
  const toLobby = name === 'play' && netInLobby(); if (toLobby) name = 'multi'; // déjà dans un salon : Jouer y ramène
  // un salon ouvert sans passer par la liste des salons (Jouer, Entre amis, le groupe qui suit son chef) : le quitter ramène à l'écran d'avant
  if (name === 'multi' && UI.screen !== 'multi') UI.lobbyBack = toLobby;
  if (UI.screen === 'arsenal' && name !== 'arsenal') arsLeave(); // modèles des classes construits d'avance, essais libérés
  if (push && UI.screen !== name) UI.stack.push(UI.screen);
  UI.screen = name; $('ui').dataset.screen = name; gpuLog('screen ' + name);
  for (const s of $$('.scr')) s.classList.toggle('on', s.id === 'scr-' + name);
  uiRefresh(name, fresh);
  const root = $('scr-' + name);
  // arrivée sur l'écran : un élément reçoit le focus pour le clavier et la manette ; pas au doigt, où il s'afficherait en surbrillance pour rien
  // (la première flèche ou le premier appui de manette le posent alors : padNav retrouve l'élément choisi ou le premier élément)
  if (TOUCH.on && !PAD.drive) { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); return; }
  if (LM.scr[name]) return; // liste de menu : elle pose elle-même le focus (la rangée où l'on était)
  const first = root.querySelector('.mbtn') || root.querySelector('[data-focus]') || root.querySelector('.deploy:not(:disabled)') || root.querySelector('button:not(.back):not(:disabled)');
  if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
}
function uiBack() {
  if (UI.busy) return false;
  const L = LM.scr[UI.screen]; if (L && lmPop(L)) { sfxUi('back'); return true; } // un sous-menu d'abord
  if (UI.screen === 'multi' && netInLobby()) { netLeaveAsk(); return true; } // dans un salon, Retour est la seule sortie : « Quitter le salon ? » au milieu de l'écran
  if (UI.screen === 'profile' && ACCT.code) return false; // code de secours affiché : on ne le quitte qu'en cochant « J'ai noté » (Retour, Échap et B ne font rien)
  if (UI.screen === 'deploy') { if (UI.flow && !UI.flow.online) { menuCancelFlow(); return true; } return false; }
  const prev = UI.stack.pop(); if (!prev) return false;
  uiGo(prev, false); sfxUi('back'); return true;
}
function uiRefresh(name, fresh) {
  if (name === 'main') menuMainRefresh();
  else if (name === 'solo') { if (fresh) lmReset(LM.scr.solo); else lmRender(LM.scr.solo, { focus: true, restore: true }); }
  else if (name === 'multi') netRender({ focus: true, restore: true, fresh });
  else if (name === 'classes' || name === 'deploy') { if (name === 'classes') { CPV.view = -1; CPV.confirm = -1; classesHeader(); } PICKERS.forEach(renderPicker); if (name === 'deploy') renderDeploy(); }
  else if (name === 'options') syncOptions();
  else if (name === 'arsenal') renderArsenal();
  else if (name === 'skins') renderSkins(); // tenues (09u-tenues.js)
  else if (name === 'news') renderNews();
  else if (name === 'friends') amisFriendsScreen(); // amis (09ta-amis.js)
  else if (name === 'play') playRender();
  else if (name === 'profile') acctRefreshScreen();
  else if (name === 'ranking' || name === 'player' || name === 'notifs') socScreen(name); // vie sociale (09t-social.js)
  else if (name === 'moderation') modScreen(); // modération (09v-moderation.js)
  else if (name === 'community') commScreen(); // Communauté (09z-communaute.js)
  else if (name === 'legal') legalRender();
  amisInviteCard(); // invitation reçue : l'encart suit l'écran (caché sur l'écran Amis)
}
function menuMainRefresh() {
  deckCard(); // Steam Deck (09ra-deck.js)
  // Jouer : où l'on en est (salon ouvert), sinon les façons de jouer
  $('mmPlay').textContent = SRV.on ? (SRV.st && SRV.st.ps ? srvTitle() : _t('Salon public, {0}', srvTitle())) : NET.role !== 'off' ? _t('Salon {0}', NET.code) : _t('Seul, entre amis ou en ligne');
  newsBadge();
}
/* Appelé par netRender : le sous-titre du menu principal suit l'état du salon */
function menuNetChanged() { if (UI.screen === 'main') menuMainRefresh(); }

/* ---------- Composants ---------- */
/* Choix exclusif : items = [[valeur, libellé]] */
function seg(root, items, get, set) {
  root.innerHTML = '';
  for (const [v, label] of items) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = String(v); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(v === get()));
    b.addEventListener('click', () => { for (const x of root.children) x.setAttribute('aria-checked', String(x === b)); sfxUi('tab'); set(v); }); // set() peut reconstruire la rangée : on coche d'abord
    root.appendChild(b);
  }
}
/* Illustrations des cartes (choix de la carte, écran de chargement) : une vue du décor rendue par le jeu, publiée à
   côté de la page (dist/maps/, voir tools/dev/illustrations.js), visible avant tout chargement de la carte */
const MAP_ART = /*__MAP_ART__*/ {};
/* Illustration de la carte m dans l'image el (masquée si la carte n'en a pas) */
function setMapArt(el, m) {
  const src = m.ok && MAP_ART[m.id];
  el.classList.toggle('none', !src);
  if (src) { if (el.getAttribute('src') !== src) el.src = src; } else el.removeAttribute('src');
}

/* ---------- Sélecteur de classe (menu, déploiement, pause) ----------
   Quatre classes préconçues, puis cinq emplacements de classes personnalisées (06r-arsenal.js) : verrouillé (niveau du joueur
   insuffisant), libre (à créer) ou créé. Le menu Classes montre les neuf ; le déploiement et la pause, celles qu'on peut choisir. */
const PICKERS = [];
/* Emplacement (ni choisi, ni disponible) affiché en détail dans le menu : emplacement verrouillé ou libre ; confirm : suppression à confirmer */
const CPV = { view: -1, confirm: -1 };
const cname = (i) => esc(cls(i).name);
function mountClassPicker(root, mode) {
  root.className = 'cp'; root.innerHTML = '<div class="cp-list" role="listbox" aria-label="Classes"></div><div class="cp-detail" aria-live="polite"></div>';
  const P = { root, mode, list: root.firstChild, detail: root.lastChild };
  P.list.dataset.lm = '.cls'; // navigation en liste (09ea-liste.js, padListNav)
  P.list.addEventListener('click', (e) => { const b = e.target.closest('.cls'); if (b) { pickClass(+b.dataset.i); sfxUi('click'); } });
  if (mode === 'deploy') P.list.addEventListener('dblclick', (e) => { const b = e.target.closest('.cls'); if (b && classAvail(+b.dataset.i)) menuDeploy(); });
  P.detail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const v = P.mode === 'menu' && CPV.view >= 0 ? CPV.view : Settings.loadout, act = b.dataset.act;
    if (act === 'edit') arsOpen(v);
    else if (act === 'create') { const i = classCreate(CLASSES[v].slot); if (i >= 0) { pickClass(i); arsOpen(i); } }
    else if (act === 'delete') { CPV.confirm = v; PICKERS.forEach(renderPicker); return; }
    else if (act === 'delete-yes') { classDelete(v); CPV.confirm = -1; CPV.view = -1; PICKERS.forEach(renderPicker); if (UI.screen === 'main') menuMainRefresh(); if (UI.screen === 'solo') renderSolo(); }
    else if (act === 'delete-no') { CPV.confirm = -1; PICKERS.forEach(renderPicker); return; }
    sfxUi('click');
  });
  PICKERS.push(P); renderPicker(P); return P;
}
function pickClass(i) {
  if (classAvail(i)) { Settings.loadout = i; saveSettings(); CPV.view = -1; } else CPV.view = i; // emplacement verrouillé ou libre : aperçu seul
  CPV.confirm = -1;
  PICKERS.forEach(renderPicker);
  if (UI.screen === 'main') menuMainRefresh();
  if (MATCH.state === 'paused') pmClassRefresh();
  if (UI.screen === 'solo') renderSolo();
  if (UI.screen === 'deploy') renderDeploy();
}
/* Sous-titre du menu Classes : niveau du joueur et prochain emplacement personnalisé */
function classesHeader() {
  const lvl = playerLevel(), next = CUSTOM_UNLOCK.find((v) => v > lvl), n = CUSTOM_UNLOCK.filter((v) => v <= lvl).length;
  $('clsSub').textContent = `${_tn(n, 'Niveau {1} : {0} emplacement de classe personnalisée sur {2}', 'Niveau {1} : {0} emplacements de classe personnalisée sur {2}', lvl, CUSTOM_MAX)}` + (next ? `${_t(', le suivant au niveau {0}.', next)}` : _t(', tous débloqués.'));
  if (ACCT.state === 'ready' && !ACCT.user) $('clsSub').textContent += ' ' + _t('Non connecté. Votre progression reste sur cet appareil.'); // la copie sur le compte (06r-arsenal.js) suppose d'être connecté
}
/* Aperçu en image d'une arme (vignette de 09o-vitrine.js, remplie dès qu'elle est prête) */
const thumbImg = (d) => `<img data-thumb="${d.key}"${VTHUMB.img[d.key] ? '' : ' data-pend'} alt="" src="${weaponThumbKey(d.key, d.id)}" decoding="async">`;
function renderPicker(P) {
  const sel = Settings.loadout, inMatch = MATCH.state === 'paused' || MATCH.state === 'playing', menu = P.mode === 'menu';
  const view = menu && CPV.view >= 0 ? CPV.view : sel, ids = menu ? CLASSES.map((c, i) => i) : classIds(), lvl = playerLevel();
  const act = document.activeElement, keep = act && act.dataset && act.dataset.i && P.list.contains(act) ? act.dataset.i : null;
  let html = '', group = '';
  const withGroups = menu || ids.some((i) => CLASSES[i].custom);
  for (const i of ids) {
    const c = CLASSES[i], g = c.custom ? _t('Personnalisées') : _t('Préconçues');
    if (withGroups && g !== group) html += `<div class="cls-h">${g}</div>`;
    group = g;
    const sl = c.custom ? `aria-selected="${i === view}"` : `aria-selected="${i === view}"`;
    if (c.custom && !c.made) {
      const lock = lvl < CUSTOM_UNLOCK[c.slot];
      html += `<button type="button" class="cls ${lock ? 'lock' : 'free'}" role="option" data-i="${i}" ${sl}><span class="cn">${lock ? _t('Verrouillée') : _t('+ Créer une classe')}</span><span class="cw">${lock ? _t('Niveau {0} requis', CUSTOM_UNLOCK[c.slot]) : _t('Emplacement {0}', c.slot + 1)}</span></button>`;
      continue;
    }
    const W = classWeapons(i);
    // en partie : « En cours » sur la classe équipée, « Suivante » sur celle qui l'est à la prochaine réapparition ; au menu, « Choisie » sur la classe de départ
    const badge = inMatch && i === PL.classIdx ? _t('<span class="cb">En cours</span>') : inMatch && i === sel ? `<span class="cb next">${_t('Suivante')}</span>` : menu && i === sel ? `<span class="cb next">${_t('Choisie')}</span>` : '';
    html += `<button type="button" class="cls" role="option" data-i="${i}" ${sl}><span class="cn">${esc(c.name)}</span><span class="cw">${_t('{0} et {1}', W[0].name, W[1].name)}</span>${badge}</button>`;
  }
  P.list.innerHTML = html;
  if (keep) { const el = P.list.querySelector(`[data-i="${keep}"]`); if (el) el.focus({ preventScroll: true }); }
  P.detail.innerHTML = classDetailHtml(P, view);
}
function classDetailHtml(P, v) {
  const c = CLASSES[v], lvl = playerLevel();
  if (c.custom && !c.made) {
    const n = c.slot, need = CUSTOM_UNLOCK[n];
    if (lvl < need) {
      const prev = n ? CUSTOM_UNLOCK[n - 1] : 1, pct = clamp((lvl - 1) / (need - 1), 0, 1);
      return `<div class="cp-lock"><p class="wtype">${_t('Emplacement personnalisé {0}', n + 1)}</p><b>${_t('Niveau {0} requis', need)}</b><p class="cdesc">${_t('Montez de niveau en jouant pour débloquer cet emplacement. Vous y composerez votre propre classe (armes, accessoires, camouflages) et vous pourrez la renommer.')}</p><div class="bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></div><p class="hint">${_t('Votre niveau : {0}{1}', lvl, ACCT.user ? '' : ' ' + _t('(sur cet appareil, connectez-vous pour suivre le niveau de votre compte)'))}</p></div>`;
    }
    return `<div class="cp-lock"><p class="wtype">${_t('Emplacement personnalisé {0}', n + 1)}</p><b>${_t('Emplacement libre')}</b><p class="cdesc">${_t('Composez votre classe. Arme principale, pistolet, accessoires posés sur un visuel 3D de l\u0027arme, camouflages. Vous pourrez la renommer.')}</p>${P.mode === 'pause' ? '' : _t('<div class="cp-btns"><button type="button" class="btn cp-edit" data-act="create">Créer cette classe</button></div>')}</div>`;
  }
  const [p, s] = classWeapons(v);
  // accessoires et camouflage d'une arme ; h : précédés du surtitre « Accessoires » (arme principale)
  const chips = (d, h) => `<div class="acs">${h ? `<span class="acs-h">${_t('Accessoires')}</span>` : ''}${d.att.map((a) => `<span class="ac">${esc(attName(a, d))}</span>`).join('')}${d.camo ? `<span class="ac camo">${CAMOS[d.camo].name}</span>` : ''}${d.att.length || d.camo ? '' : `<span class="hint">${h ? _t('Aucun') : _t('Sans accessoire')}</span>`}</div>`;
  // actions, toujours à la même place (sous la description) : modifier et supprimer une classe personnalisée, sinon ce qui en tient lieu
  let foot = '';
  if (P.mode === 'pause') foot = _t('<p class="hint">Composez vos classes personnalisées dans l\u0027atelier, depuis le menu principal (Classes) ou au déploiement.</p>');
  else if (c.custom) {
    foot = CPV.confirm === v
      ? `<div class="cp-btns"><span class="hint">${_t('Supprimer la classe {0} ?', esc(c.name))}</span><button type="button" class="btn danger" data-act="delete-yes">${_t('Supprimer')}</button><button type="button" class="btn" data-act="delete-no">${_t('Garder')}</button></div>`
      : `<div class="cp-btns"><button type="button" class="btn cp-edit" data-act="edit">${_t('Modifier la classe')}</button>${P.mode === 'menu' ? `<button type="button" class="btn danger" data-act="delete">${_t('Supprimer')}</button>` : ''}</div>`;
  } else foot = _t('<p class="hint">Classe préconçue : elle ne se modifie pas. Créez la vôtre dans un emplacement personnalisé (Classes).</p>');
  // deux blocs : l'arme (visuels, nom, description, actions toujours à cette place, accessoires) et ses chiffres (statistiques, équipement avec
  // le pistolet et ses accessoires) ; côte à côte quand le détail est large (menu Classes), l'un sous l'autre sinon
  return `<div class="cp-cols"><div class="cp-a">
    <div class="cp-img"><figure>${thumbImg(p)}<figcaption>${p.name}</figcaption></figure><figure class="sec">${thumbImg(s)}<figcaption>${s.name}</figcaption></figure></div>
    <p class="wtype">${p.type}</p>
    <h3 class="wname">${p.name}<span class="lvtag">${_t('niveau {0}', wLevel(p.id))}</span></h3>
    <p class="cdesc">${esc(c.desc)}</p>
    ${foot}
    ${chips(p, true)}
    </div><div class="cp-b">
    ${STAT_NAMES.map(([k, n]) => statBar(n, p.base.stats[k], p.stats[k])).join('')}
    <dl class="kit"><div><dt>${_t('Secondaire')}</dt><dd>${s.name}<span class="lvtag">${_t('niveau {0}', wLevel(s.id))}</span>${chips(s)}</dd></div><div><dt>${_t('Équipement')}</dt><dd>${nadeCount(c.nade, c.nades)}</dd></div><div><dt>${_t('Chargeur')}</dt><dd>${_t('{0} coups', p.mag)}</dd></div><div><dt>${_t('Séries')}</dt><dd>${classKs(v).map((id) => `${esc(KSDEF[id].short)} <span class="lvtag">${KSDEF[id].n}</span>`).join(' ')}</dd></div></dl>
    </div></div>`;
}

/* Secondes restantes pendant lesquelles un changement de classe est appliqué immédiatement */
function classGraceLeft() {
  const e = PL.ent; if (!e.alive || (MATCH.state !== 'paused' && MATCH.state !== 'playing')) return 0;
  if (cdOn()) return CLASS_GRACE + (CD.wait ? cdLen() : MATCH.cd); // décompte du départ : le délai part du départ (09y-decompte.js)
  return Math.max(0, CLASS_GRACE - (MATCH.time - (e.spawnAt || 0)));
}
/* Pause : état du choix de classe (message et bouton) */
function pmClassRefresh() {
  const sel = Settings.loadout, act = PL.classIdx, left = classGraceLeft(), ok = $('pmClassOk'), n = cls(sel).name;
  let msg;
  ok.textContent = _t('Équiper maintenant');
  if (sel === act) { msg = `${_t('Classe en cours : {0}.', n)}`; ok.disabled = true; }
  else if (left > 0) { msg = `${_t('Vous venez d\u0027apparaître. La classe {0} peut être équipée tout de suite{1}.', n, MATCH.online ? ' ' + _t('(encore {0} s)', left.toFixed(1)) : '')}`; ok.disabled = false; }
  else { msg = `${_t('La classe {0} sera équipée à votre prochaine réapparition.', n)}`; ok.disabled = true; }
  ok.classList.toggle('hidden', ok.disabled);
  $('pmClassMsg').textContent = msg;
  $('pmClassHint').textContent = sel === act ? cls(act).name : _t('{0}, puis {1}', cls(act).name, n);
}
function commitClass() {
  if (classGraceLeft() <= 0 || Settings.loadout === PL.classIdx) return;
  giveLoadout(); pmClassRefresh(); PICKERS.forEach(renderPicker);
  hudMsg(`${_t('Classe {0} équipée', cls(PL.classIdx).name)}`, 'xp', 2.5);
}

/* Textes que le CSS affiche (shell.html : content: var(--t-...)) : la langue vient d'ici */
for (const [k, v] of [['sel', _t('Sélectionnée')], ['soon', _t('Bientôt')], ['slow', _t('ralenti')]]) document.documentElement.style.setProperty('--t-' + k, JSON.stringify(v));

/* ---------- Options ---------- */
const OPTS = [];
function toggleFullscreen() {
  const r = document.documentElement;
  if (!document.fullscreenElement && r.requestFullscreen) r.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen();
}
/* Changement de langue : la page se recharge (les textes se choisissent au chargement, voir src/00-i18n.js) ; hors partie seulement */
function langApply() {
  if (netInLobby() && !confirm(_t('Changer de langue recharge le jeu. Vous quittez le salon. Continuer ?'))) { Settings.lang = LANG_PREF; saveSettings(); syncOptions(true); return; }
  location.reload();
}
/* Mode graphique économique : lu au chargement, la page se recharge (comme la langue) ; hors partie seulement */
function gfxApply() {
  if (netInLobby() && !confirm(_t('Changer de mode graphique recharge le jeu. Vous quittez le salon. Continuer ?'))) { Settings.gfxSafe = GFX_SAFE; saveSettings(); syncOptions(true); return; }
  Settings.gfxSafeAuto = Settings.gfxSafe ? 'manual' : ''; saveSettings(); // choix du joueur : il reste d'un build à l'autre
  location.reload();
}
/* Qualité Minimale choisie ou quittée : ses ombres cuites et l'absence de pré-passe ne se changent qu'au lancement (ULTRA, 01-core.js). Depuis les menus,
   on propose de relancer ; en partie, le reste du profil s'applique tout de suite et les ombres suivront au prochain lancement. */
function qualityBootCheck() {
  if (ultraAtBoot(gfxSet('quality')) === ULTRA || MATCH.state !== 'menu' || netInLobby()) return;
  if (confirm(_t('Les ombres changent au prochain lancement du jeu. Relancer maintenant ?'))) location.reload();
}
/* Verrou d'une rangée d'image (septième élément d'une rangée select ou check) : sous l'économie d'énergie, la valeur imposée (gfxSet), sinon null */
const ecoLock = (k) => () => (Settings.eco ? gfxSet(k) : null);
const OPT_TABS = [
  [_t('Jeu'), [
    ['head', _t('Écran tactile')], // titre de groupe (mountOptions) : affiché seulement si l'une de ses rangées l'est
    ['select', 'touch', _t('Contrôles tactiles'), [['auto', _t('Automatique')], ['on', _t('Activés')], ['off', _t('Désactivés')]], () => touchDetect()],
    ['select', 'tcRun', _t('Course au doigt'), [['button', _t('Bouton Courir')], ['stick', _t('Joystick poussé au-delà du cercle')]], null, 'touch'],
    ['select', 'tcStick', _t('Joystick'), [['float', _t('Apparaît sous le doigt')], ['fixed', _t('Fixe à l\u0027écran')]], null, 'touch'],
    ['check', 'tcAuto', _t('Tir automatique (quand le réticule est sur un ennemi, la visée remplace le bouton de tir)'), null, null, 'touch'],
    ['check', 'tcDblAds', _t('Visée au double toucher (sans bouton Viser)'), null, null, 'touch'],
    ['check', 'tcQuick', _t('Tir au relâchement (fusils de précision, appuyer pour viser et relâcher pour tirer)'), null, null, 'touch'],
    ['check', 'tcVib', _t('Vibrations (touche, élimination, coup reçu)'), null, null, 'touch'],
    ['select', 'tcAlpha', _t('Opacité des boutons'), [['1', '100 %'], ['0.75', '75 %'], ['0.5', '50 %']], () => touchAlpha(), 'touch'],
    ['button', _t('Disposition des commandes tactiles'), () => touchEditOpen(), null, null, 'touch'],
    ['head', _t('Pavé tactile')], // la détection est dans 09qe-pavetactile.js ; les rangées « trackpad » n'apparaissent qu'avec le mode (body.trackpad)
    ['select', 'tpMode', _t('Contrôles au pavé tactile (tir automatique, visée au double clic)'), [['auto', _t('Automatique')], ['on', _t('Activés')], ['off', _t('Désactivés')]], () => trackpadSync(), 'desk'],
    ['check', 'tpAuto', _t('Tir automatique (quand le réticule est sur un ennemi, le clic ne tire plus)'), null, null, 'trackpad'],
    ['check', 'tpDblAds', _t('Visée au double clic ou au toucher à deux doigts (un autre range l\u0027arme)'), null, null, 'trackpad'],
    ['range', 'tpSens', _t('Sensibilité du pavé tactile'), 0.2, 3, 0.05, (v) => v.toFixed(2), null, 'trackpad'], // indépendante de la souris (Settings.sens) : voir 08-player.js
    ['head', _t('Visée')],
    ['range', 'sens', _t('Sensibilité'), 0.2, 3, 0.05, (v) => v.toFixed(2)],
    ['range', 'adsMul', _t('Visée au zoom (vitesse par rapport à la hanche)'), 0.2, 1.5, 0.05, (v) => Math.round(v * 100) + PCT],
    ['range', 'fov', _t('Champ de vision'), 50, 80, 1, (v) => Math.round(v) + '°', () => { if (MATCH.state === 'menu') { camera.fov = Settings.fov; camera.updateProjectionMatrix(); } }],
    ['check', 'invertY', _t('Inverser l\u0027axe vertical')],
    ['check', 'adsToggle', _t('Visée en bascule à la souris (un clic droit épaule, un autre range l\u0027arme)'), () => trackpadSync(), null, 'desk'],
    ['select', 'aimAssist', _t('Assistance à la visée (au doigt, à la manette, au pavé tactile)'), [['normal', _t('Normale')], ['off', _t('Désactivée')]], null, 'assist'],
    ['head', _t('Manette')],
    ['range', 'padSens', _t('Sensibilité de la manette'), 0.3, 2.5, 0.05, (v) => v.toFixed(2)],
    ['range', 'padAdsMul', _t('Visée au zoom (manette, vitesse par rapport à la hanche)'), 0.2, 1.5, 0.05, (v) => Math.round(v * 100) + PCT],
    ['range', 'padDead', _t('Zone morte des bâtons'), 0.05, 0.4, 0.01, (v) => Math.round(v * 100) + PCT],
    ['select', 'padCurve', _t('Réponse de la visée (manette)'), [['reactive', _t('Réactive')], ['classic', _t('Progressive')], ['linear', _t('Linéaire')]]],
    ['select', 'padAccel', _t('Accélération de la visée (manette, bâton à fond)'), [['off', _t('Aucune')], ['normal', _t('Normale')], ['strong', _t('Forte')]]],
    ['select', 'padLay', _t('Disposition de la manette'), [['default', _t('Par défaut')], ['southpaw', _t('Gaucher (bâtons échangés)')], ['bumper', _t('Bumper jumper (saut sur LB)')]]],
    ['select', 'padRun', _t('Course à la manette'), [['click', _t('Appui sur le bâton gauche (L3)')], ['auto', _t('Bâton poussé à fond')]]],
    ['check', 'padVib', _t('Vibrations de la manette')],
    ['head', _t('Interface')],
    ['select', 'lang', _t('Langue'), [['auto', _t('Automatique')], ['en', 'English'], ['fr', 'Français']], langApply, 'menu'],
    ['check', 'allyMarks', _t('Marqueurs d\u0027alliés (au-dessus de leur tête)')],
    ['check', 'nadeArc', _t('Trajectoire des grenades (en tenant une grenade)')],
    ['select', 'hudScale', _t('Taille de l\u0027interface en jeu'), [['0.85', '85' + PCT], ['1', '100' + PCT], ['1.15', '115' + PCT], ['1.3', '130' + PCT]], null, 'desk'], // --hud-k (updateHud) ; au doigt, le HUD suit la hauteur de l'écran
    ['check', 'fsGame', _t('Plein écran en partie (au lancement d\u0027une partie, Échap reprend sans clic)')],
  ]],
  [_t('Audio'), [
    ['range', 'volume', _t('Volume général'), 0, 1, 0.05, (v) => Math.round(v * 100) + PCT, () => setVolume(Settings.volume)],
    ['range', 'music', _t('Musique des menus'), 0, 1, 0.05, (v) => Math.round(v * 100) + PCT],
    ['check', 'voice', _t('Annonces vocales (séries, objectifs)')],
  ]],
  [_t('Vidéo'), [
    ['head', _t('Image')],
    // économie d'énergie : réglage maître, les rangées d'image dessous sont grisées et montrent ce que le jeu impose (ECO_GFX, CAP, 01-core.js)
    ['check', 'eco', _t('Économie d\u0027énergie (30 images par seconde, le jeu règle l\u0027image selon l\u0027appareil pour que la batterie dure plus longtemps)'), () => ecoApply()],
    ['select', 'quality', _t('Qualité'), [['auto', _t('Automatique')], ['high', _t('Haute')], ['medium', _t('Moyenne')], ['low', _t('Basse')], ['ultra', _t('Minimale')]], () => { qualityReset(); qualityBootCheck(); }, null, ecoLock('quality')],
    ['check', 'ao', _t('Occlusion ambiante'), () => applyQuality(), null, null, ecoLock('ao')],
    ['check', 'rays', _t('Rayons du soleil'), () => applyQuality(), null, null, ecoLock('rays')],
    ['check', 'grass', _t('Herbe en relief sur les pelouses'), null, null, null, ecoLock('grass')],
    ['check', 'dynres', _t('Résolution dynamique'), () => { if (!Settings.dynres) RQ.scale = 1; applyResolution(); }, null, null, ecoLock('dynres')],
    ['select', 'fpsMax', _t('Images par seconde au plus'), [['0', _t('Sans limite')], ['120', '120'], ['90', '90'], ['60', '60'], ['30', '30'], ['half', _t('Moitié de l\u0027écran')]], null, null, () => (Settings.eco ? '30' : null)], // limite de cadence (CAP)
    ['head', _t('Affichage et dépannage')],
    ['check', 'perf', _t('Afficher les performances'), () => { $('perf').classList.toggle('hidden', !Settings.perf); if (!Settings.perf) pfrStop(); else if (!PFR.on && ['playing', 'paused', 'finish', 'killcam'].includes(MATCH.state)) pfrStart(); }],
    ['button', _t('Rapport de performances'), () => pfrShow()], // chaque image de la dernière partie jouée avec les performances affichées (09zo-perfs.js)
    ['check', 'gfxSafe', _t('Mode graphique économique (si le jeu s\u0027interrompt ou affiche du noir, relance le jeu)'), () => gfxApply(), null, 'menu'],
    ['button', _t('Rapport graphique'), () => gpuReport(), null, null, 'menu'],
    ['button', _t('Plein écran'), toggleFullscreen],
  ]],
  [_t('Commandes'), null],
];
const KEYS_HELP = [ // ce qui ne se change pas : les touches des actions sont dans l'éditeur (08a-binds.js)
  [_t('Souris'), _t('Viser, clic gauche pour tirer, clic droit pour épauler')], [_t('Molette'), _t('Changer d\u0027arme')], [_t('Échap'), _t('Menu pause : classe, options, quitter')],
];
const TRACKPAD_HELP = [ // pavé tactile (09qe-pavetactile.js) : la souris, sans molette ni clic qui tire
  [_t('Pavé tactile'), _t('Glisser pour viser, double clic ou toucher à deux doigts pour épauler. Le tir part tout seul quand le réticule est sur un ennemi')], [_t('Échap'), _t('Menu pause : classe, options, quitter')],
];
const TOUCH_HELP = [
  [_t('Joystick (à gauche)'), _t('Se déplacer. Poussé au-delà du cercle, il fait sprinter (réglable avec le bouton Courir)')], [_t('Glisser (à droite)'), _t('Regarder autour de soi')],
  [_t('Boutons de tir'), _t('Tirer. Le doigt peut glisser pour regarder')], [_t('Viser'), _t('Un appui épaule, un autre range. Un appui long vise tant que le doigt reste posé')],
  [_t('Sauter, s\u0027accroupir'), _t('S\u0027accroupir en sprintant fait une glissade')], [_t('Recharger, changer d\u0027arme'), _t('Boutons à droite de l\u0027écran')],
  [_t('Grenade'), _t('Appuyer dégoupille, relâcher lance')], [_t('Couteau'), _t('Un appui donne un coup. Maintenu, il sort le couteau pour courir plus vite. Changer d\u0027arme le range')], [_t('Ramasser'), _t('Le bouton de ramassage apparaît près d\u0027une arme au sol')],
  [_t('Séries d\u0027éliminations'), _t('Boutons jaunes à gauche, quand elles sont prêtes')], [_t('Pause, scores, discussion'), _t('Boutons en haut à droite')], [_t('Disposition'), _t('Options, Jeu : déplacer, agrandir ou retirer chaque bouton')],
];
/* Aide de la manette (Options, Commandes) : les noms de boutons deviennent les glyphes des invites (09x-invites.js) */
const PAD_HELP_BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Menu: 9 };
function padHelpKey(k) {
  if (k === _t('Retour')) return padGlyph(8);
  if (k === _t('Croix directionnelle')) return padGlyph(12);
  const parts = k.split(' / ');
  return parts.every((p) => p in PAD_HELP_BTN) ? parts.map((p) => padGlyph(PAD_HELP_BTN[p])).join(' ') : k;
}
/* Options : onglets (Jeu, Audio, Vidéo, Commandes), une rangée par réglage (choix segmentés, curseurs, interrupteurs). À la manette et au
   clavier, la rangée est l'unité : haut et bas passent d'une rangée à l'autre (trait jaune), gauche et droite règlent, A bascule ou passe au
   choix suivant, LB et RB changent d'onglet. La souris et le doigt touchent directement les choix. */
/* Rangée maniée en entier : adj(d) la règle d'un cran (gauche, droite), act() répond à A, Entrée ou un clic sur la rangée elle-même ; les
   commandes qu'elle contient ne prennent plus le focus (la souris et le doigt les touchent toujours) */
function optNav(row, adj, act) {
  row.tabIndex = 0; row.classList.add('onav');
  if (adj) { row._adj = adj; row._adjK = true; }
  for (const c of row.querySelectorAll('button, input')) c.tabIndex = -1;
  if (act) row.addEventListener('click', (e) => { if (e.target === row || (e.target.parentNode === row && e.target.tagName === 'SPAN')) act(); });
  row.addEventListener('keydown', (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); } });
}
function mountOptions(root) {
  root.innerHTML = '<div class="tabs" role="tablist"></div><div class="orows"></div>';
  const tabs = root.firstChild, body = root.lastChild, O = { root, syncs: [] };
  body.dataset.lm = '.onav';
  // une seule surbrillance : la souris pose le focus sur la rangée survolée (pas pendant la navigation à la manette ou au clavier)
  body.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || document.body.classList.contains('padnav') || document.body.classList.contains('kbnav')) return;
    const row = e.target.closest && e.target.closest('.onav'), a = document.activeElement;
    if (!row || row.contains(a) || (a && a.tagName === 'INPUT' && a.type === 'text')) return;
    row.focus({ preventScroll: true });
  });
  let cur = 0;
  const show = (t) => {
    cur = t; O.syncs = []; body.innerHTML = '';
    [...tabs.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === t)));
    const rows = OPT_TABS[t][1];
    if (!rows) {
      if (!TOUCH.on) { const hb = document.createElement('h4'); hb.className = 'keys-h'; hb.textContent = _t('Touches du clavier'); body.appendChild(hb); bindEditor(body); } // touches du clavier modifiables (08a-binds.js)
      const hk = document.createElement('h4'); hk.className = 'keys-h'; hk.textContent = TOUCH.on ? _t('Écran tactile') : _t('Souris et touches fixes'); body.appendChild(hk);
      const dl = document.createElement('dl'); dl.className = 'keys'; dl.innerHTML = (TOUCH.on ? TOUCH_HELP : trackpadOn() ? TRACKPAD_HELP : KEYS_HELP).map(([k, d]) => `<dt>${k}</dt><dd>${d}</dd>`).join(''); body.appendChild(dl);
      if (!PAD.seen && !PAD.drive) return; // la manette n'apparaît qu'une fois qu'une manette s'est manifestée (09qc-manette.js)
      const h = document.createElement('h4'); h.className = 'keys-h'; h.textContent = _t('Manette (Xbox, PlayStation, 8BitDo...)'); body.appendChild(h);
      const dp = document.createElement('dl'); dp.className = 'keys'; dp.innerHTML = PAD_HELP.map(([k, d]) => `<dt>${padHelpKey(k)}</dt><dd>${d}</dd>`).join(''); body.appendChild(dp); return;
    }
    let head = null; // titre du groupe en attente : posé avant la première rangée affichée du groupe
    for (const r of rows) {
      if (r[0] === 'head') { head = r[1]; continue; }
      const cls = r[0] === 'range' ? r[8] : r[5]; // la classe de visibilité : après la rampe et son rappel pour une réglette, en sixième pour le reste
      if (cls === 'menu' && root.id !== 'optMenu') continue; // réglage hors partie : absent du menu pause
      if (PAD_KEYS.has(r[1]) && !PAD.seen) continue; // réglages de la manette : une fois qu'une manette s'est manifestée
      if (cls === 'touch' && !TOUCH.on) continue; // réglage des commandes tactiles : seulement avec les commandes tactiles
      if (cls === 'desk' && TOUCH.on) continue; // réglage du HUD de l'ordinateur et de la manette : inutile au doigt
      if (head) { const h = document.createElement('h4'); h.className = 'og'; h.textContent = head; body.appendChild(h); head = null; }
      const kind = r[0], row = document.createElement(kind === 'button' || kind === 'select' ? 'div' : 'label'); row.className = 'orow';
      if (cls === 'trackpad' || (cls === 'assist' && !TOUCH.on && !PAD.seen)) row.dataset.tp = '1'; // au pavé tactile seulement (shell.html) ; l'assistance à la visée : au doigt, à la manette ou au pavé, jamais à la souris
      if (kind === 'button') {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = r[1]; b.addEventListener('click', r[2]);
        row.append(document.createElement('span'), b); body.appendChild(row); optNav(row, null, () => b.click()); continue;
      }
      const [, key, label] = r, name = document.createElement('span'), part = /^(.*?) \((.*)\)$/.exec(label); // « Libellé (précision) » : la précision en petit dessous
      name.textContent = part ? part[1] : label; if (part) name.appendChild(Object.assign(document.createElement('small'), { className: 'oh', textContent: part[2] })); row.appendChild(name);
      if (kind === 'range') {
        const [, , , min, max, step, fmt, cb] = r;
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
        const out = document.createElement('output');
        const fill = () => inp.style.setProperty('--p', ((Settings[key] - min) / (max - min)) * 100 + '%'); // part remplie de la piste (shell.html, .orow input[type=range])
        const sync = () => { inp.value = Settings[key]; out.textContent = fmt(Settings[key]); fill(); };
        inp.addEventListener('input', () => { Settings[key] = parseFloat(inp.value); out.textContent = fmt(Settings[key]); fill(); saveSettings(); if (cb) cb(); syncOptions(); sfxUi('tick'); });
        row.append(inp, out); O.syncs.push(sync); sync();
        const dec = Math.max(0, (String(step).split('.')[1] || '').length);
        optNav(row, (d) => { // un cran (quatre en tenant la direction)
          const v = clamp(parseFloat((parseFloat(inp.value) + d * step * (lmStep.fast ? 4 : 1)).toFixed(dec)), min, max);
          if (v !== parseFloat(inp.value)) { inp.value = String(v); inp.dispatchEvent(new Event('input', { bubbles: true })); }
          return true;
        });
      } else if (kind === 'check') {
        const cb = r[3];
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.setAttribute('role', 'switch'); // dessiné en interrupteur (shell.html)
        const lock = r[6] || (() => null); // verrou : comme pour un choix segmenté, plus bas
        const sync = () => { const f = lock(); inp.checked = f === null ? !!Settings[key] : !!f; inp.disabled = f !== null; row.setAttribute('aria-disabled', String(f !== null)); };
        inp.addEventListener('change', () => { Settings[key] = inp.checked; saveSettings(); if (cb) cb(); syncOptions(); sfxUi('click'); });
        row.appendChild(inp); O.syncs.push(sync); sync();
        optNav(row, (d) => { if (lock() !== null) return true; const on = d > 0; if (inp.checked !== on) { inp.checked = on; inp.dispatchEvent(new Event('change', { bubbles: true })); } return true; }); // A : le clic sur l'étiquette bascule
      } else if (kind === 'select') { // choix segmenté, comme les paramètres de la partie
        // r[6] : verrou, rend la valeur imposée par un autre réglage (null : libre) ; la rangée la montre, grisée, sans rien changer au choix gardé
        const cb = r[4], lock = r[6] || (() => null), box = document.createElement('div'); box.className = 'seg'; box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', label);
        seg(box, r[3], () => String(Settings[key]), (v) => { Settings[key] = v; saveSettings(); if (cb) cb(); syncOptions(); }); // le son du geste est celui du choix segmenté (sfxUi('tab'))
        const sync = () => {
          const f = lock(), v = f === null ? String(Settings[key]) : f;
          for (const b of box.children) { b.setAttribute('aria-checked', String(b.dataset.v === v)); b.disabled = f !== null; }
          row.setAttribute('aria-disabled', String(f !== null));
        };
        row.appendChild(box); O.syncs.push(sync); sync();
        const at = () => [...box.children].findIndex((b) => b.getAttribute('aria-checked') === 'true');
        optNav(row, (d) => { if (lock() !== null) return true; const n = box.children.length, i = at(), j = clamp(i + d, 0, n - 1); if (j !== i && box.children[j]) box.children[j].click(); return true; },
          () => { if (lock() !== null) return; const n = box.children.length; box.children[(at() + 1) % n].click(); });
      }
      body.appendChild(row);
    }
  };
  OPT_TABS.forEach(([name], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = name;
    b.addEventListener('click', () => { show(i); sfxUi('tab'); }); tabs.appendChild(b);
  });
  O.rebuild = () => show(cur);
  show(0); OPTS.push(O); return O;
}
/* Met à jour les autres instances (menu et pause) après un changement */
function syncOptions() { for (const O of OPTS) for (const f of O.syncs) f(); }
function syncSettings() { syncOptions(); }

/* ---------- Solo ---------- */
/* Paramètres d'une partie, communs au Solo et au salon (sous-menu « Paramètres de partie ») : mode et son explication, joueurs, bots et leur
   niveau, limite, durée, et en ligne la visibilité du salon. Tous les choix sont visibles ; gauche et droite passent au voisin, un clic choisit.
   o = { map, mode, diff, bots (en ligne : 0 ou 1), limit, time, online, edit, pubOk, pub, set(clé, valeur) } ; edit faux : lecture seule (invité d'un salon). */
function matchRows(o) {
  const MD = MODES[o.mode] || MODES.tdm, ffa = o.mode === 'ffa', diffs = DIFF.map((d, i) => [i, d.name]), set = (k) => (v) => o.set(k, v), dis = !o.edit;
  const teams = !o.online ? MD.teams : ffa ? (o.bots ? _t('Jusqu\u0027à 8 joueurs, complétés par des bots') : _t('Chacun pour soi, joueurs humains seulement'))
    : o.bots ? _t('6 contre 6, complétés par des bots') : _t('Deux équipes, joueurs humains seulement');
  const rows = [];
  if (dis) rows.push({ k: 'note', text: o.note || _t('Réglés par l\u0027hôte') });
  rows.push(
    { k: 'seg', full: true, wide: true, key: 'mode', label: _t('Mode'), items: MODE_IDS.filter((id) => id !== 'dom' || MAP_DEFS[o.map].dom).map((id) => [id, MODES[id].btn]), get: () => o.mode, set: set('mode'), disabled: dis },
    { k: 'note', cls: 'hint', text: MD.hint },
    { k: 'info', label: _t('Joueurs'), value: teams },
    { k: 'seg', full: true, wide: o.online, key: 'bots', label: o.online ? _t('Bots') : _t('Difficulté des bots'), items: o.online ? [['off', _t('Aucun')], ...diffs] : diffs, get: () => (o.online && !o.bots ? 'off' : o.diff), set: set('bots'), disabled: dis });
  if (!o.online || o.bots) rows.push({ k: 'note', cls: 'hint', text: DIFF_HINT[o.diff] });
  rows.push(
    { k: 'seg', full: true, key: 'limit', label: MD.lim, items: MD.limits.map((v) => [v, String(v)]), get: () => o.limit, set: set('limit'), disabled: dis },
    { k: 'seg', full: true, key: 'time', label: _t('Durée maximale'), items: [5, 10, 15].map((v) => [v, v + ' min']), get: () => o.time, set: set('time'), disabled: dis });
  if (o.pubOk) rows.push({ k: 'seg', full: true, key: 'pub', label: _t('Salon'), items: [[0, _t('Privé')], [1, _t('Public')]], get: () => (o.pub ? 1 : 0), set: set('pub'), disabled: dis }); // en ligne, avec le serveur de jeu : privé ou listé
  return rows;
}
/* Taille d'une carte : combat rapproché, moyenne à trois couloirs, grande et ouverte (README, « Règles de conception d'une carte ») */
const mapSize = (m) => (m.ok && MAP_DEFS[m.id] ? { close: _t('Petite'), mid: _t('Moyenne'), open: _t('Grande') }[MAP_DEFS[m.id].type] || '' : '');
/* Cartes à choisir (sous-menu Carte) : vignettes illustrées, la légende et la taille ; pick nul : affichage seul (invité d'un salon) */
function mapCards(selId, pick) {
  return MAPS.map((m) => ({
    k: 'card', key: m.id, label: m.name, tag: [m.tag, mapSize(m)].filter(Boolean).join(' · '), art: (m.ok && MAP_ART[m.id]) || '', on: m.id === selId, lock: !m.ok,
    badge: !m.ok ? _t('Bientôt') : m.id === selId ? _t('Sélectionnée') : '', disabled: !m.ok || !pick, pick: () => pick(m.id),
  }));
}
/* L'encart de la carte, sous le menu (comme les anciens Call of Duty) : son illustration, son nom, le mode, la limite et la durée de la partie.
   o : les paramètres de la partie (matchRows) */
function mapPreview(m, o) {
  const MD = MODES[o.mode] || MODES.tdm, art = m.ok && MAP_ART[m.id], mode = o.mode === 'ffa' ? MD.btn : MD.name;
  return (art ? `<img class="mapart" alt="" decoding="async" src="${art}">` : '<span class="mapart none"></span>')
    + `<div class="pv-t"><b>${esc(m.name)}</b><span class="pv-m">${esc(mode)}</span><span class="pv-i">${esc(o.limit + ' ' + MD.unit + ' · ' + o.time + ' min')}</span></div>`;
}
/* Le joueur, en tête de son équipe : son nom (celui du compte) et son niveau */
function lobbyMe(tags) {
  const n = ACCT.user ? ACCT.user.displayName : NET.nick;
  return { k: 'player', key: 'me', label: n || _t('Vous'), lv: playerLevel(), tags: n ? [_t('vous'), ...tags] : tags, me: true };
}
/* Scène du Solo : les deux équipes, vous et les bots, avec les noms qu'ils porteront (BOT_NAMES) ; chacun pour soi, les sept bots en jeu (modeRoster) */
function soloStage() {
  const ffa = Settings.mode === 'ffa', MD = MODES[Settings.mode] || MODES.tdm;
  const me = lobbyMe([]), bot = (n, i) => ({ k: 'player', key: 'b' + i, label: n, bot: true }); // (leur niveau est dans le résumé des paramètres)
  if (ffa) {
    const all = [...BOT_NAMES[0], ...BOT_NAMES[1]], idx = all.map((n, i) => i), cut = all.length - FFA_BOTS;
    const off = new Set(idx.filter((i) => i % 3 === 1).concat(idx.slice().reverse()).filter((e, i, a) => a.indexOf(e) === i).slice(0, cut));
    return { head: `<b>${esc(_t('Joueurs'))}</b><span>${esc(MD.teams)}</span>`, cols: [{ head: esc(_t('Chacun pour soi')), rows: [me, ...all.filter((n, i) => !off.has(i)).map(bot)] }] };
  }
  return { head: `<b>${esc(_t('Joueurs'))}</b><span>${esc(MD.teams)}</span>`, cols: [
    { cls: 'ally', head: esc(TEAM_NAMES[0]), rows: [me, ...BOT_NAMES[0].map(bot)] },
    { cls: 'enemy', head: esc(TEAM_NAMES[1]), rows: BOT_NAMES[1].map((n, i) => bot(n, 10 + i)) },
  ] };
}
function soloSet(k, v) {
  if (k === 'mode') Settings.mode = v; else if (k === 'bots') Settings.difficulty = v; else if (k === 'limit') Settings[MODES[Settings.mode].key] = v; else Settings.minutes = v;
  saveSettings();
}
function soloCfg() { const MD = MODES[Settings.mode] || MODES.tdm; return { map: Settings.map, mode: Settings.mode, diff: Settings.difficulty, limit: Settings[MD.key], time: Settings.minutes, online: false, edit: true, set: soloSet }; }
const SOLO_PAGES = {
  solo: () => {
    const m = mapById(Settings.map);
    if (!MODES[Settings.mode] || (Settings.mode === 'dom' && !MAP_DEFS[m.id].dom)) Settings.mode = 'tdm';
    const MD = MODES[Settings.mode];
    const rows = [ // la carte et les paramètres sont dans l'encart, sous le menu
      { k: 'link', key: 'map', label: _t('Carte'), page: 'map' },
      { k: 'link', key: 'setup', label: _t('Paramètres de partie'), page: 'setup' },
      { k: 'link', key: 'class', label: _t('Modifier la classe'), open: () => uiGo('classes') },
    ];
    if (netInLobby()) rows.push({ k: 'note', text: SRV.on ? _t('Vous êtes dans un salon public. Lancer une partie ici le quitte.') : _t('Vous êtes dans le salon {0}. Lancer une partie ici le quitte.', NET.code) });
    return { title: _t('Solo'), sub: MD.sub, rows, stage: soloStage, preview: mapPreview(m, soloCfg()) };
  },
  map: () => ({ head: _t('Carte'), grid: true, rows: mapCards(Settings.map, (id) => { Settings.map = id; saveSettings(); sfxUi('click'); lmPop(LM.scr.solo); }) }),
  setup: () => ({ head: _t('Paramètres de partie'), rows: matchRows(soloCfg()) }),
};
function renderSolo() { lmRender(LM.scr.solo); $('soloGo').title = netInLobby() ? _t('Lancer une partie solo vous fait quitter le salon') : ''; }

/* ---------- Lancement d'une partie : chargement, choix de la classe, déploiement ---------- */
/* F = { online, map, deploy } : deploy() démarre réellement la partie une fois la classe choisie */
function menuLaunch(F) {
  if (UI.busy) return;
  if (!F.online && netInLobby()) netQuit(); // une partie solo quitte le salon (menu principal : « Salon XXXX » disparaît)
  UI.busy = true; UI.flow = F;
  uiHide(); if (UI.screen === 'deploy') UI.screen = UI.stack.pop() || 'main';
  menuLoading(F).then((ok) => {
    if (!ok || UI.flow !== F) return;
    UI.busy = false;
    $('matchload').classList.add('hidden'); $('ui').classList.remove('hidden');
    $('depSub').textContent = `${mapById(F.map || Settings.map).name} · ${F.online ? _t('Match en ligne') : _t('Solo')}`;
    $('depBack').classList.toggle('hidden', !!F.online);
    UI.timer = F.online ? DEPLOY_AUTO : 0;
    uiGo('deploy');
  });
}
/* Écran de chargement : vraie progression de la carte (09a-loading.js) ; en ligne, attente des autres joueurs */
async function menuLoading(F) {
  const m = mapById(F.map || Settings.map), bar = $('mlBar'), msg = $('mlMsg');
  $('mlName').textContent = m.name; $('mlDesc').textContent = m.desc; $('mlMode').textContent = (F.online ? MODES[NET.cfg.mode] || MODES.tdm : MODES[Settings.mode] || MODES.tdm).name + ' · ' + (F.online ? _t('en ligne') : _t('solo'));
  // illustration en fond, avec un lent travelling avant relancé à chaque chargement
  const art = $('mlMap'); setMapArt(art, m); art.style.animation = 'none'; void art.offsetWidth; art.style.animation = '';
  $('mlWait').classList.add('hidden'); $('mlBack').classList.add('hidden'); $('mlRep').classList.add('hidden'); $('mlSafe').classList.add('hidden');
  const show = (p, t, id) => { if (id === m.id && UI.flow === F) { bar.style.transform = `scaleX(${p})`; if (t) msg.textContent = t; } };
  bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)'; msg.textContent = _t('Chargement de la carte');
  if (MAPL.id === m.id) show(MAPL.p, MAPL.msg, m.id); // carte déjà chargée, ou en cours (salon)
  void bar.offsetWidth; bar.style.transition = '';
  $('matchload').classList.remove('hidden');
  const t0 = performance.now();
  MAPL.subs.add(show);
  // la construction de la carte occupe le fil principal plusieurs secondes : on laisse d'abord peindre l'écran de chargement (sinon le clic « bloque » l'interface)
  if (MAPL.id !== m.id) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  try { await mapEnsure(m.id); } catch (e) {
    if (UI.flow !== F) return false;
    msg.textContent = GPUX.culprits.length ? _t('Votre appareil a refusé certains rendus du jeu pendant le chargement. Relancez le jeu. Ils seront remplacés par des versions simples (voir le rapport graphique).') : GPUX.lost || gpuLostNow() ? _t('L\u0027affichage 3D a été interrompu par l\u0027appareil pendant le chargement ({0}). Relancez le jeu. Le mode graphique économique est activé.', (e && e.message) || e)
      : _t('Le chargement de la carte a échoué ({0}). Rechargez la page ou passez la qualité en Basse.', (e && e.message) || e);
    $('mlBack').classList.remove('hidden'); $('mlRep').classList.remove('hidden'); $('mlSafe').classList.toggle('hidden', GFX_SAFE || !!Settings.gfxSafe); $('mlBack').focus();
    if (F.online) netLoadFailed();
    return false;
  } finally { MAPL.subs.delete(show); }
  if (UI.flow !== F) return false;
  bar.style.transform = 'scaleX(1)'; msg.textContent = _t('Prêt à déployer');
  // carte déjà prête (Rejouer, salon préchargé) : l'écran reste un instant, le temps de lire la carte
  const left = 900 - (performance.now() - t0); if (left > 0) await uiWait(left);
  if (F.online) return menuWaitPlayers(F);
  return UI.flow === F;
}
/* En ligne : la partie ne commence que lorsque tous les joueurs ont chargé la carte (ou au bout de NET_LOAD_WAIT s) */
async function menuWaitPlayers(F) {
  netLoadReport(true);
  while (UI.flow === F && !netGo()) {
    $('mlMsg').textContent = _t('En attente des autres joueurs');
    const w = $('mlWait'); w.innerHTML = netWaitHtml(); w.classList.toggle('hidden', !w.innerHTML);
    await uiWait(250);
  }
  $('mlWait').classList.add('hidden');
  return UI.flow === F;
}
/* Échec du chargement : retour au salon ou au menu */
function menuLoadBack() {
  if (!UI.flow) return;
  UI.flow = null; UI.busy = false;
  uiOpen(netInLobby() ? 'multi' : 'solo', ['main']);
}
function menuCancelFlow() {
  UI.flow = null; UI.busy = false; UI.timer = 0;
  uiGo(UI.stack.pop() || 'main', false); sfxUi('back');
}
function renderDeploy() {
  const c = cls(Settings.loadout);
  $('depGo').textContent = _t('Déployer');
  $('depTimer').innerHTML = UI.timer > 0 ? `${_t('Déploiement automatique dans')} <b>${Math.ceil(UI.timer)} s</b>` : `${_t('Classe :')} <b>${esc(c.name)}</b>`;
}
function menuDeploy() {
  const F = UI.flow; if (!F || UI.screen !== 'deploy' || UI.busy) return;
  UI.flow = null; UI.timer = 0; uiHide(); sfxUi('go');
  enterGameFullscreen(); // dans le geste du joueur : le plein écran permet la reprise sans clic (voir 09-game.js)
  F.deploy();
}
setInterval(() => {
  if (MATCH.state === 'menu' && UI.screen === 'deploy' && UI.flow && UI.timer > 0) {
    UI.timer -= 0.25; if (UI.timer <= 0) menuDeploy(); else renderDeploy();
  }
  if (MATCH.state === 'paused' && UI.pm === 'class') pmClassRefresh();
  if (MATCH.state === 'paused' && UI.pm === 'home') pmSummaryTick();
}, 250);

/* ---------- Menu pause ---------- */
function pmView(name) {
  UI.pm = name;
  for (const v of ['home', 'class', 'options']) $('pm' + v[0].toUpperCase() + v.slice(1)).classList.toggle('on', v === name);
  if (name === 'class') { PICKERS.forEach(renderPicker); pmClassRefresh(); }
  if (name === 'home') pmSummary();
  if (name === 'options') syncOptions();
}
/* Accueil de la pause : la carte (son illustration), le mode et la limite, puis des tuiles : score des deux camps (mon camp d'abord, barres vers
   la limite), temps restant, mes éliminations et mes morts, ma classe ; la partie continue derrière, les chiffres suivent (pmSummaryTick) */
function pmSummary() {
  const m = mapById(MATCH.online ? NET.cfg.map : Settings.map), ffa = MATCH.mode === 'ffa', art = m.ok && MAP_ART[m.id];
  const lim = MATCH.mode === 'dom' ? _t('{0} · premier à {1} points', modeDef().name, `<b>${MATCH.limit}</b>`) : _t('{0} · premier à {1}', modeDef().name, `<b>${MATCH.limit}</b>`);
  const side = (k, name, you) => `<div class="ps-t ${k}"><span><span>${name}</span>${you ? ` <em>${_t('Vous')}</em>` : ''}</span><b data-ps="s${k}"></b><i class="ps-bar"><i data-ps="b${k}"></i></i></div>`;
  const mine = ffa ? 0 : PL.ent.team;
  $('pmSummary').innerHTML = `<div class="ps-map">${art ? `<img class="mapart" alt="" decoding="async" src="${art}">` : ''}<div class="ps-mt"><b>${esc(m.name)}</b><span>${lim}</span><span>${MATCH.online ? _t('Match en ligne') : _t('Solo')}</span></div></div>
    <div class="ps-card ps-score"><p class="lbl">${_t('Score')}</p><div class="ps-teams">${ffa ? side('a', _t('Vous'), false) + side('b', _t('Meilleur adversaire'), false) : side('a', TEAM_NAMES[mine], true) + side('b', TEAM_NAMES[1 - mine], false)}</div>${ffa ? `<p class="ps-rank" data-ps="rank"></p>` : ''}</div>
    <div class="ps-card ps-time"><p class="lbl">${_t('Temps restant')}</p><b class="ps-big" data-ps="time"></b></div>
    <div class="ps-card ps-me"><p class="lbl">${_t('Votre partie')}</p><div class="ps-kd"><div><b data-ps="k"></b><span>${_t('Éliminations')}</span></div><div><b data-ps="d"></b><span>${_t('Morts')}</span></div><div><b data-ps="sc"></b><span>${_t('Score')}</span></div></div></div>
    <div class="ps-card ps-cls"><p class="lbl">${_t('Classe')}</p><b data-ps="cls"></b><span data-ps="next"></span></div>`;
  PMSUM.el = {}; for (const e of $('pmSummary').querySelectorAll('[data-ps]')) PMSUM.el[e.dataset.ps] = e;
  pmSummaryTick();
  $('pmClassHint').textContent = Settings.loadout === PL.classIdx ? cls(PL.classIdx).name : _t('{0}, puis {1}', cls(PL.classIdx).name, cls(Settings.loadout).name);
  $('pmSub').textContent = MATCH.online ? _t('La partie continue pendant la pause') : _t('Partie en pause');
}
const PMSUM = { el: {} };
/* Chiffres de l'accueil de la pause (quatre fois par seconde : la partie continue) ; écrits seulement s'ils changent */
function pmSummaryTick() {
  const E = PMSUM.el; if (!E.time) return;
  const ffa = MATCH.mode === 'ffa', me = PL.ent, mine = ffa ? 0 : me.team, a = MATCH.score[mine], b = MATCH.score[1 - mine];
  hudText(E.sa, a); hudText(E.sb, b);
  hudStyle(E.ba, 'transform', `scaleX(${clamp(a / MATCH.limit, 0, 1)})`); hudStyle(E.bb, 'transform', `scaleX(${clamp(b / MATCH.limit, 0, 1)})`);
  if (E.rank) hudText(E.rank, _t('Vous êtes {0}', ordinal(ffaRank())));
  hudText(E.time, fmtTime(MATCH.timeLeft)); hudText(E.k, me.kills); hudText(E.d, me.deaths); hudText(E.sc, me.score);
  hudText(E.cls, cls(PL.classIdx).name); hudText(E.next, Settings.loadout !== PL.classIdx ? _t('Puis {0} à la prochaine réapparition', cls(Settings.loadout).name) : '');
}
function pmOpen() { pmView('home'); if (!(TOUCH.on && !PAD.drive)) requestAnimationFrame(() => $('resumeBtn').focus({ preventScroll: true })); } // au doigt, pas de surbrillance d'arrivée
/* Échap dans la pause : revient à l'accueil de la pause, puis reprend la partie */
function pmEscape() { if (UI.pm !== 'home') { pmView('home'); sfxUi('back'); } else resumeGame(); }

/* ---------- Clavier, souris, sons ---------- */
addEventListener('keyup', (e) => {
  if (e.code === 'Escape' && LOCK.escArmed && MATCH.state === 'paused') { LOCK.escArmed = false; e.preventDefault(); pmEscape(); }
});
addEventListener('keydown', (e) => {
  const st = MATCH.state;
  // sans capture de la souris, Échap ne déclenche pas la pause de lui-même
  // plein écran avec verrou du clavier : Échap arrive à la page, qui rend elle-même la capture (reprise sans clic)
  if (st === 'playing' && e.code === 'Escape' && LOCK.kbLock && document.pointerLockElement && !e.repeat) { e.preventDefault(); pauseGame(); LOCK.scriptExit = true; document.exitPointerLock(); return; }
  // (pas sur une répétition de touche, ni juste après une reprise : le même appui ne doit pas rouvrir la pause)
  if (st === 'playing' && e.code === 'Escape' && (LOCK.fallback || LOCK.quiet || $('lockPrompt').classList.contains('show'))) { if (!e.repeat && performance.now() - LOCK.resumeT > 600) pauseGame(); return; }
  if (e.code === 'Escape' && e.repeat && (st === 'paused' || st === 'playing')) return;
  if (st !== 'menu' && st !== 'paused') return;
  const a = document.activeElement, typing = a && (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type !== 'checkbox' && a.type !== 'range'));
  if (e.code === 'Escape' && !$('matchload').classList.contains('hidden') && !$('mlBack').classList.contains('hidden')) { e.preventDefault(); $('mlBack').click(); return; } // échec du chargement : Échap (et B) reviennent au menu
  if (e.code === 'Escape') {
    // la reprise se fait au relâchement : demander la capture de la souris pendant l'appui laisse le navigateur la défaire aussitôt (Échap)
    if (st === 'paused') { e.preventDefault(); LOCK.escArmed = true; return; }
    if (UI.screen === 'arsenal' && arsEscape()) { e.preventDefault(); return; } // la liste d'accessoires se ferme d'abord
    if (UI.screen === 'deploy') { e.preventDefault(); return; } // choix de la classe au lancement : Échap n'annule pas la partie (le bouton Annuler le fait)
    if (!UI.busy && uiBack()) e.preventDefault();
    return;
  }
  if (st === 'menu' && UI.screen === 'deploy' && !UI.busy) {
    // Entrée sans élément focalisé déploie ; sur un bouton (« Annuler », une classe), c'est ce bouton qui agit
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !(a && a.matches && a.matches('button, input'))) { e.preventDefault(); menuDeploy(); return; }
    const n = parseInt(e.key, 10), ids = classIds(); if (n >= 1 && n <= ids.length) { pickClass(ids[n - 1]); sfxUi('click'); return; }
  }
  if (typing) return;
  // flèches : la même navigation que la manette (09qc-manette.js : portée, voisin le plus proche dans la direction, mémoire de l'écran) ;
  // naviguer ne change jamais un réglage, sauf un curseur, que gauche et droite règlent (le navigateur s'en charge)
  const dir = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[e.code];
  if (!dir || e.defaultPrevented) return;
  if (dir[0] && a && a.type === 'range') return;
  const scope = padScope(); if (!scope) return;
  e.preventDefault(); document.body.classList.add('kbnav');
  padNav(scope, dir[0], dir[1]);
});
// la souris qui bouge ou un toucher rendent le survol (body.kbnav l'éteint pendant la navigation au clavier)
addEventListener('pointermove', (e) => { if (e.isTrusted && (e.movementX || e.movementY)) document.body.classList.remove('kbnav'); }, true);
addEventListener('pointerdown', () => document.body.classList.remove('kbnav'), true);
// sons : le contexte audio ne peut démarrer que sur un geste de l'utilisateur
/* Le contexte audio se crée ou se relance au premier geste ; Safari sur iPhone ne le débloque qu'à la fin du toucher (touchend, clic), d'où les écouteurs en plus
   et la relance tant qu'il n'est pas en marche */
const uiAudio = () => { if ((!AU.ctx || AU.ctx.state !== 'running') && (MATCH.state === 'menu' || MATCH.state === 'paused')) initAudio(); };
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, uiAudio, true);
/* Un son au clic seulement, jamais au survol (demande du propriétaire). Tout ce qui se clique dans les menus sonne : boutons, icônes (classement,
   notifications), onglets, cartes, lignes du classement ; quand le bouton joue son propre son (retour, onglet, validation), sfxUi ne garde que le plus
   important des sons d'un même geste. La manette garde son petit cran au déplacement du focus (09qc-manette.js). */
const UI_CLICK = 'button, [role="button"], a[href], [data-go], [data-open], .mbtn, .cls, .lcard, .btn, .back, .link, .ars-card, .hp-opt';
document.addEventListener('click', (e) => {
  const h = e.target.closest && e.target.closest(UI_CLICK); if (h && !h.disabled && (MATCH.state === 'menu' || MATCH.state === 'paused')) sfxUi('click');
});

/* Fond des menus : visible tant qu'on est dans les menus (la boucle de jeu l'appelle à chaque image) */
let menuBgOn = false;
function menuBgShow(on) { if (on !== menuBgOn) { menuBgOn = on; $('menuBg').style.display = on ? 'block' : 'none'; document.body.classList.toggle('mbg', on); if (on) mbgShown(); } } // fond animé : 09w-fond.js

/* ---------- Initialisation ---------- */
function menuInit() {
  // navigation par data-go / data-back
  for (const b of $$('[data-go]')) b.addEventListener('click', () => uiGo(b.dataset.go));
  playInit(); // écran Jouer (09ta-groupe.js)
  for (const b of $$('.back[data-back]')) b.addEventListener('click', () => uiBack());
  $('depBack').addEventListener('click', () => { if (UI.flow && !UI.flow.online) menuCancelFlow(); });
  $('depGo').addEventListener('click', menuDeploy);
  $('mlBack').addEventListener('click', menuLoadBack);
  $('mlRep').addEventListener('click', gpuReport);
  $('mlSafe').addEventListener('click', () => { Settings.gfxSafe = true; Settings.gfxSafeAuto = BUILD; saveSettings(); location.reload(); });
  lmMount($('scr-solo'), { pages: SOLO_PAGES, home: 'solo', col: $('soloList'), stage: $('soloStage'), panel: $('soloPanel'), preview: $('soloPrev'), preview2: $('soloPrev2'), title: $('scr-solo').querySelector('h2'), sub: $('soloSub'), screen: 'solo' });
  $('soloGo').addEventListener('click', () => menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }));
  $('fsBtn').addEventListener('click', toggleFullscreen);
  // code source public (licence MIT, README « Code source public ») : un bouton plutôt qu'un lien, pour que la manette l'atteigne
  $('srcBtn').addEventListener('click', () => window.open('https://github.com/BenDBSS/Riposte-Frontline-Source', '_blank', 'noopener'));
  mountClassPicker($('cpMenu'), 'menu'); mountClassPicker($('cpDeploy'), 'deploy'); mountClassPicker($('cpPause'), 'pause');
  mountOptions($('optMenu')); mountOptions($('optPause'));
  arsInit(); skinScreenInit(); skinRefresh();
  // pause
  $('resumeBtn').addEventListener('click', resumeGame);
  $('quitBtn').addEventListener('click', () => toMenu());
  for (const b of $$('[data-pm]')) b.addEventListener('click', () => pmView(b.dataset.pm));
  $('pmClassOk').addEventListener('click', commitClass);
  // fin de partie
  $('againBtn').addEventListener('click', () => {
    if (MATCH.online) { toMenu(); return; }
    toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() });
  });
  $('menuBtn').addEventListener('click', () => toMenu());
  $('perf').classList.toggle('hidden', !Settings.perf);
  newsInit();
  musicInit();
  mbgInit(); // fond animé des menus (09w-fond.js)
  netInit();
  acctInit(); socInit();
}
