/* ==========================================================================
   ATELIER DE CLASSE : composition d'une classe personnalisée (nom, arme principale et pistolet, accessoires, camouflages),
   annonces de progression en partie
   L'écran (section #scr-arsenal) s'ouvre depuis le détail d'une classe personnalisée (menu Classes, choix de la classe au
   déploiement). À gauche, les armes par catégorie sous forme de cartes à aperçu (vignettes de 09o-vitrine.js), avec leur niveau
   ou ce qui les verrouille ; à droite, le visuel 3D de l'arme choisie, qu'on fait tourner, et où des points « + » posés sur le
   modèle ouvrent la liste des accessoires de l'emplacement (optique, bouche, canon, sous-canon, rail, chargeur, crosse,
   munitions), puis le niveau de l'arme, ses statistiques corrigées par les accessoires, les accessoires posés et les
   camouflages. Tout choix est enregistré aussitôt (06r-arsenal.js) ; en quittant l'écran, les modèles des classes sont
   construits d'avance et ceux des essais libérés.
   ========================================================================== */
const ARSUI = { cls: -1, tab: 'p', pop: '', msg: '', weapon: '', ksSee: '', nadeSee: '' }; // ksSee, nadeSee : série, grenade dont l'onglet montre le détail
const STAT_NAMES = [['dmg', _t('Dégâts')], ['acc', _t('Précision')], ['rng', _t('Portée')], ['rof', _t('Cadence')], ['mob', _t('Mobilité')]];

function arsOpen(i) {
  if (!classEditable(i)) return;
  ARSUI.cls = i; ARSUI.tab = 'p'; ARSUI.pop = ''; ARSUI.msg = ''; ARSUI.weapon = ''; ARSUI.ksSee = ''; ARSUI.nadeSee = ''; uiGo('arsenal');
}
/* Appelé en quittant l'écran : le visuel se ferme, les modèles des classes sont prêts avant la partie, ceux des essais sont libérés */
function arsLeave() { arsKsFill(); arsPopClose(); vwClose(); arsenalPrebuild(); gunTrim(); PICKERS.forEach(renderPicker); menuMainRefresh(); thumbsStart(); }
/* Échap : ferme d'abord la liste d'accessoires ouverte */
function arsEscape() { if (ARSUI.pop) { arsPopClose(); return true; } return false; }

/* Une statistique : libellé, barre (part gagnée en vert, perdue en rouge) et valeur sur 100, précédée de l'écart signé (la couleur n'est jamais seule) */
const statBar = (label, a, b) => {
  const lo = Math.min(a, b), hi = Math.max(a, b), d = Math.round(b * 100) - Math.round(a * 100);
  return `<div class="stat"><span>${label}</span><div class="track"><i style="width:${(lo * 100).toFixed(1)}%"></i>${hi > lo + 0.004 ? `<i class="${b > a ? 'up' : 'dn'}" style="left:${(lo * 100).toFixed(1)}%;width:${((hi - lo) * 100).toFixed(1)}%"></i>` : ''}</div><b>${d ? `<em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</em>` : ''}${Math.round(b * 100)}</b></div>`;
};
/* La classe, l'emplacement et l'arme en cours d'édition */
function arsCur() {
  const i = ARSUI.cls, c = CLASSES[i], sec = ARSUI.tab === 's', def = classWeapons(i)[sec ? 1 : 0];
  return { i, c, sec, which: sec ? 's' : 'p', def, base: WEAPONS[sec ? c.secondary : c.primary], eq: c[sec ? 'sa' : 'pa'], camo: c[sec ? 'sc' : 'pc'] };
}
/* Nom et niveau de l'arme, barre d'XP, prochain déblocage */
function arsLevelHtml(base) {
  const wid = base.id, L = wLevelInfo(wid), nx = arsNextUnlock(wid), k = ARS.k[wid] || 0, h = ARS.h[wid] || 0;
  return `<div class="ars-lv"><p class="wt">${base.type}</p><p class="wn">${base.name}<small>${_t('Niveau {0}', L.level)}</small></p>
    <div class="ac-bar"><i style="transform:scaleX(${L.need ? (L.into / L.need).toFixed(3) : 1})"></i></div>
    <span>${_tn(k, '{1} · {0} élimination, {2} à la tête', '{1} · {0} éliminations, {2} à la tête', L.need ? `${_t('{0} / {1} XP avant le niveau {2}', L.into, L.need, L.level + 1)}` : _t('Niveau maximal'), h)}</span>
    <span>${nx ? `${_t('Prochain déblocage au niveau {0} :', nx.level)} <em>${esc(nx.name)}</em>` : _t('Tout est débloqué pour cette arme')}</span></div>`;
}

function renderArsenal(reset = true) {
  if (!classEditable(ARSUI.cls)) { uiGo('classes', false); return; }
  const { c } = arsCur(), ks = ARSUI.tab === 'k', gr = ARSUI.tab === 'g';
  $('arsSub').textContent = ks ? _t('Classe personnalisée {0} sur {1}. Choisissez trois séries, qui ne se débloquent pas au même nombre d\u0027éliminations', c.slot + 1, CUSTOM_MAX)
    : gr ? _t('Classe personnalisée {0} sur {1}. Choisissez une grenade ou le couteau de lancer, vous en avez deux à chaque vie', c.slot + 1, CUSTOM_MAX)
    : _t('Classe personnalisée {0} sur {1}. Choisissez vos armes. Les + posés sur l\u0027arme ouvrent ses accessoires', c.slot + 1, CUSTOM_MAX);
  const inp = $('arsName'); if (document.activeElement !== inp) inp.value = c.name;
  renderArsSlots();
  $('arsStage').classList.toggle('series', ks || gr); // séries, grenade : pas de visuel 3D (09-game.js ne le dessine plus), le détail prend la place
  if (ks) { renderArsKsList(); renderArsKsPanel(); return; }
  if (gr) { renderArsNadeList(); renderArsNadePanel(); return; }
  renderArsList(); arsStageSet(reset); renderArsPanel();
  const help = VW.host && VW.host.querySelector('.vw-help'); if (help) help.textContent = TOUCH.on ? _t('Glissez pour faire tourner l\u0027arme') : _t('Glissez pour faire tourner l\u0027arme, molette pour l\u0027approcher'); // (pas de molette au doigt)
}
/* Les quatre emplacements de la classe, en cartes qui montrent ce qu'on y a mis (retour du propriétaire : rendre l'atelier plus parlant, comme
   l'écran de création de classe de Call of Duty) ; une carte ouvre son emplacement */
function renderArsSlots() {
  const c = CLASSES[ARSUI.cls], [p, s] = classWeapons(ARSUI.cls), root = $('arsTabs'), N = NADE_TYPES[c.nade] || NADE_TYPES.frag;
  const acc = (d) => (d.att.length ? _tn(d.att.length, '{0} accessoire', '{0} accessoires') : _t('D\u0027origine'));
  const items = [
    ['p', _t('Principale'), esc(p.name), acc(p)],
    ['s', _t('Pistolet'), esc(s.name), acc(s)],
    ['g', _t('Équipement'), nadeSvg(c.nade) + esc(N.name), _t('{0} par vie', NADE_COUNT)],
    ['k', _t('Séries'), `<span class="ics">${c.ks.map(ksSvg).join('')}</span>`, c.ks.map((id) => KSDEF[id].n).join(' · ')],
  ];
  root.innerHTML = items.map(([v, l, val, sub]) => `<button type="button" class="ars-slot" role="radio" data-v="${v}" aria-checked="${v === ARSUI.tab}"><span class="sl">${l}</span><span class="sv">${val}</span><span class="ss">${sub}</span></button>`).join('');
}
/* ---------- Onglet Grenade ---------- */
function renderArsNadeList() {
  const c = CLASSES[ARSUI.cls];
  $('arsList').innerHTML = `<h4>${_t('Un seul par classe')}</h4><div class="ars-grid">${NADE_IDS.map((id) => {
    const on = c.nade === id, N = NADE_TYPES[id];
    return `<button type="button" class="ars-card ars-ksc" data-nade="${id}" aria-selected="${on}"><span class="ic">${nadeSvg(id)}</span>${on ? `<span class="ars-on">${_t('Équipée')}</span>` : ''}<span class="n">${esc(N.name)}</span><span class="m">${esc(N.long)}</span></button>`;
  }).join('')}</div>`;
}
/* Détail de la grenade équipée (ou de la dernière touchée) : son effet et ses chiffres */
function renderArsNadePanel() {
  const c = CLASSES[ARSUI.cls], id = NADE_TYPES[ARSUI.nadeSee] ? ARSUI.nadeSee : c.nade, N = NADE_TYPES[id];
  const num = (v) => v.toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US');
  const facts = id === 'knife' ? [[_t('Par vie'), String(NADE_COUNT)], [_t('Effet'), _t('Élimine d\u0027un coup')], [_t('Vitesse'), _t('{0} m/s', THROW_KNIFE.speed)], [_t('Au sol'), _t('Se ramasse')]]
    : [[_t('Mèche'), _t('{0} s', num(N.fuse))], [_t('Par vie'), String(NADE_COUNT)]].concat(
    id === 'flash' ? [[_t('Effet'), _t('Aveugle jusqu\u0027à {0} s', num(FLASH.max))], [_t('Portée'), _t('{0} m', FLASH.r)]]
    : id === 'smoke' ? [[_t('Effet'), _t('Nuage de {0} s', SMOKE.life)], [_t('Largeur'), _t('{0} m', num(Math.round(SMOKE.r * 2)))]]
    : [[_t('Effet'), _t('Jusqu\u0027à {0} de dégâts', 150)], [_t('Rayon'), _t('{0} m', num(7.5))]]);
  $('arsPanel').innerHTML = `<div class="ars-cols"><div>
    <div class="ars-lv"><p class="wt">${esc(N.long)}</p><p class="wn">${esc(N.name)}${id === c.nade ? `<small>${_t('Équipée')}</small>` : ''}</p><span>${esc(N.desc)}</span></div>
    </div><div><dl class="ars-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div></div>`;
}
function arsNadePick(id) {
  const c = CLASSES[ARSUI.cls]; ARSUI.nadeSee = id;
  if (c.nade !== id) { classSetNade(ARSUI.cls, id); sfxUi('equip'); } else sfxUi('click');
  renderArsSlots(); renderArsNadeList(); renderArsNadePanel();
}
/* Cartes d'armes par catégorie */
function renderArsList() {
  const { sec, base } = arsCur();
  $('arsList').innerHTML = WEAPON_CATS.filter((k) => (sec ? k.id === 'pistol' : k.id !== 'pistol')).map((cat) => {
    const ids = Object.keys(WEAPONS).filter((id) => WEAPONS[id].cat === cat.id);
    return `<h4>${cat.name}</h4><div class="ars-grid">${ids.map((id) => {
      const w = WEAPONS[id], lock = weaponLock(id), u = w.unlock;
      const meta = lock ? _t('{0} niveau {1}', WEAPONS[u.from].name, u.level) : _t('Niveau {0}', wLevel(id));
      return `<button type="button" class="ars-card${lock ? ' lock' : ''}" data-w="${id}" aria-selected="${id === base.id}" ${lock ? `title="${esc(lock)}"` : ''}><img data-thumb="${id}" alt="" decoding="async" src="${weaponThumb(id)}">${id === base.id ? `<span class="ars-on">${_t('Équipée')}</span>` : ''}<span class="n">${w.name}</span><span class="m">${esc(meta)}</span></button>`;
    }).join('')}</div>`;
  }).join('');
}
/* ---------- Onglet Séries ---------- */
/* Une classe quittée avec moins de trois séries (une retirée, aucune choisie à sa place) est complétée */
function arsKsFill() { const c = CLASSES[ARSUI.cls]; if (classEditable(ARSUI.cls) && c.ks.length < KS_SLOTS) { c.ks = ksFill(c.ks); arsLoadoutEdit(); } }
const ksSvg = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${KSDEF[id].icon}</svg>`;
/* Séries par nombre d'éliminations : on en prend une par rangée au plus (choisir l'autre de la rangée la remplace) */
function renderArsKsList() {
  const c = CLASSES[ARSUI.cls], ns = [...new Set(KS_IDS.map((id) => KSDEF[id].n))].sort((a, b) => a - b);
  $('arsList').innerHTML = ns.map((n) => `<h4>${_tn(n, '{0} élimination d\u0027affilée', '{0} éliminations d\u0027affilée')}</h4><div class="ars-grid">${KS_IDS.filter((id) => KSDEF[id].n === n).map((id) => {
    const on = c.ks.includes(id);
    return `<button type="button" class="ars-card ars-ksc" data-ks="${id}" aria-selected="${on}"><span class="ic">${ksSvg(id)}</span>${on ? `<span class="ars-on">${_t('Choisie')}</span>` : ''}<span class="n">${esc(KSDEF[id].name)}</span><span class="m">${on ? esc(_t('Emplacement {0}', c.ks.indexOf(id) + 1)) : ''}</span></button>`;
  }).join('')}</div>`).join('');
}
/* Les séries de la classe dans leurs emplacements, puis le détail de la dernière touchée */
function renderArsKsPanel() {
  const c = CLASSES[ARSUI.cls], see = KSDEF[ARSUI.ksSee] ? ARSUI.ksSee : c.ks[0] || KS_DEFAULT[0], K = KSDEF[see], left = KS_SLOTS - c.ks.length;
  const rows = [0, 1, 2].map((i) => {
    const id = c.ks[i];
    return id ? `<li>${ksSvg(id)}<b>${esc(KSDEF[id].name)}</b><em>${_tn(KSDEF[id].n, '{0} élimination', '{0} éliminations')}</em></li>` : `<li class="empty"><b>${_t('Emplacement libre')}</b></li>`;
  }).join('');
  $('arsPanel').innerHTML = `<div class="ars-cols"><div>
    <h4 class="ars-h">${_t('Séries de la classe')} <small>${c.ks.length} / ${KS_SLOTS}</small></h4>
    <ol class="ars-kss">${rows}</ol>
    <p class="ars-msg" id="arsMsg" aria-live="polite">${esc(ARSUI.msg || (left ? _tn(left, 'Choisissez encore {0} série.', 'Choisissez encore {0} séries.') : ''))}</p>
    </div><div>
    <div class="ars-lv"><p class="wt">${_tn(K.n, '{0} élimination d\u0027affilée', '{0} éliminations d\u0027affilée')}</p><p class="wn">${esc(K.name)}</p><span>${esc(K.desc)}</span></div>
    </div></div>`;
}
function arsKsPick(id) {
  const r = classToggleKs(ARSUI.cls, id); ARSUI.ksSee = id;
  if (r) { ARSUI.msg = r; sfxUi('locked'); } else { ARSUI.msg = ''; sfxUi(CLASSES[ARSUI.cls].ks.includes(id) ? 'equip' : 'unequip'); }
  renderArsSlots(); renderArsKsList(); renderArsKsPanel();
}

/* Le visuel 3D montre l'arme montée de la classe ; reset : retour à la vue de départ (nouvelle arme) */
function arsStageSet(reset) {
  const { def, base } = arsCur();
  if (!VW.host) vwMount($('arsView'), { labelOf: arsHotLabel, onHot: arsHotClick, hotOff: () => ARSUI.pop === 'camo' });
  const fresh = reset && ARSUI.weapon !== base.id;
  ARSUI.weapon = base.id;
  vwSet(def.key, attGroupsOf(base), fresh);
}
/* Niveau, statistiques, accessoires posés, camouflages */
function renderArsPanel() {
  renderArsSlots(); // (le nombre d'accessoires de l'emplacement)
  const { c, sec, def, base, eq, camo } = arsCur(), max = attMax(base);
  const chips = eq.map((a) => `<span class="ars-chip"><em>${ATT_SLOT_NAMES[ATT[a].slot]}</em>${esc(attName(a, def))}<button type="button" data-rm="${a}" aria-label="${esc(_t('Retirer : {0}', attName(a, def)))}">×</button></span>`).join('');
  $('arsPanel').innerHTML = `<div class="ars-cols"><div>
    ${arsLevelHtml(base)}
    <h4 class="ars-h">${_t('Accessoires')} <small>${eq.length} / ${max}</small>${eq.length ? `<button type="button" class="btn" data-clear="1">${_t('Tout retirer')}</button>` : ''}</h4>
    <div class="ars-eq">${chips || _t('<span class="hint">Aucun accessoire : les + posés sur l\u0027arme en ajoutent.</span>')}</div>
    <p class="ars-msg" id="arsMsg" aria-live="polite">${esc(ARSUI.msg)}</p>
    </div><div>
    <div class="ars-stats">${STAT_NAMES.map(([k, n]) => statBar(n, base.stats[k], def.stats[k])).join('')}<p class="hint">${_t('Chargeur :')} <b>${def.mag}</b> ${_t('coups{0} · cadence {1} coups par minute', def.tube ? ' (tube magasin)' : '', Math.round(def.rpm))}</p></div>
    </div></div>`;
  renderArsCorner();
}
/* Dans le cadre du visuel : compteur d'accessoires (en haut à gauche) et rectangle du camouflage posé (en bas à droite), qui ouvre la liste des camouflages */
function renderArsCorner() {
  if (!VW.host) return;
  const { base, eq, camo } = arsCur(), max = attMax(base), cn = VW.host.querySelector('.vw-count'), cc = VW.host.querySelector('.vw-corner');
  cn.innerHTML = `${_t('Accessoires')} <b>${eq.length} / ${max}</b>`; cn.classList.toggle('full', eq.length >= max);
  const name = camo ? CAMOS[camo].name : _t('Standard');
  cc.innerHTML = `<button type="button" class="vw-camo${camo ? '' : ' none'}${ARSUI.pop === 'camo' ? ' open' : ''}" data-camo-open="1" aria-label="${esc(_t('Camouflage : {0}, changer', name))}" style="${camo ? `background-image:url(${camoSwatch(camo)})` : ''}"><span><small>${_t('Camouflage')}</small>${esc(name)}</span></button>`;
}
function arsMsg(t) { ARSUI.msg = t; const el = $('arsMsg'); if (el) el.textContent = t; }

/* ---------- Points « + » et liste d'accessoires ---------- */
function arsHotLabel(slot) {
  const { eq, def, base } = arsCur(), a = eq.find((x) => attGroup(x) === slot);
  return { on: !!a, open: ARSUI.pop === slot, full: eq.length >= attMax(base), text: a ? attName(a, def) : ATT_GROUP_NAMES[slot], slotName: ATT_GROUP_NAMES[slot] };
}
function arsHotClick(slot) { if (ARSUI.pop === slot) arsPopClose(); else arsPopOpen(slot); }
function arsPopOpen(slot) {
  const { eq, def, base } = arsCur(), pop = $('arsPop');
  const ids = Object.keys(ATT).filter((a) => attGroup(a) === slot && attFits(base, a)).sort((x, y) => ATT_SLOTS.indexOf(ATT[x].slot) - ATT_SLOTS.indexOf(ATT[y].slot) || ATT[x].lvl - ATT[y].lvl), cur = eq.find((a) => attGroup(a) === slot);
  const multi = new Set(ids.map((a) => ATT[a].slot)).size > 1; // un point qui réunit deux emplacements (bouche et canon, chargeur et munitions) : on précise lequel
  const full = !cur && eq.length >= attMax(base);
  pop.innerHTML = `<h5><span>${ATT_GROUP_NAMES[slot]}</span><button type="button" data-close="1" aria-label="${_t('Fermer')}">×</button></h5>`
    + (full ? `<p class="hp-full">${_t('Limite atteinte : {0} accessoires au plus. Retirez-en un pour poser celui-ci.', attMax(base))}</p>` : '')
    + (cur ? `<button type="button" class="hp-opt none" data-rm="${cur}"><span class="t">${_t('Retirer : {0}', esc(attName(cur, def)))}</span></button>` : '')
    + (ids.length ? ids.map((a) => {
      const lock = attLock(base.id, a), on = a === cur, fx = attEffects(a, def).slice(0, 4);
      return `<button type="button" class="hp-opt${on ? ' on' : ''}${lock ? ' lock' : ''}" data-att="${a}" title="${esc(ATT[a].desc)}"><span class="t">${esc(attName(a, def))}<i>${multi ? ATT_SLOT_NAMES[ATT[a].slot] + (lock ? ' · ' + _t('niveau {0}', ATT[a].lvl) : on ? ' · ' + _t('posé') : '') : lock ? _t('Niveau {0}', ATT[a].lvl) : on ? _t('Posé') : ''}</i></span><span class="f">${fx.map((f) => `<span class="${f.good ? 'g' : 'b'}">${esc(f.t)}</span>`).join('')}</span></button>`;
    }).join('') : _t('<p class="hint">Aucun accessoire pour cet emplacement.</p>'));
  ARSUI.pop = slot; pop.classList.remove('camo'); pop.hidden = false;
  const P = vwHotPos(slot), room = arsPopRoom(pop);
  if (P) { pop.style.left = clamp(P.x + 26, 8, Math.max(8, P.W - pop.offsetWidth - 8)).toFixed(0) + 'px'; pop.style.top = clamp(P.y - 22, 8, Math.max(8, Math.min(P.H - 90, room - pop.offsetHeight))).toFixed(0) + 'px'; }
  vwLabels();
  const first = pop.querySelector('.hp-opt'); if (first) first.focus({ preventScroll: true });
}
/* Liste des camouflages de l'arme (déroulée depuis le rectangle du visuel) : posé, disponible ou verrouillé avec ce qui le débloque */
function arsCamoOpen() {
  const { base, camo } = arsCur(), pop = $('arsPop');
  const items = `<button type="button" class="ars-camo none${camo ? '' : ' on'}" data-camo="" aria-pressed="${!camo}"><span>${_t('Standard')}</span></button>` + Object.keys(CAMOS).map((id) => {
    const lock = camoLock(base.id, id), on = camo === id;
    return `<button type="button" class="ars-camo${on ? ' on' : ''}${lock ? ' lock' : ''}" data-camo="${id}" aria-pressed="${on}" title="${lock ? esc(_t('Pour le débloquer : {0}', lock)) : ''}" style="background-image:url(${camoSwatch(id)})"><span>${CAMOS[id].name}</span>${lock ? _t('<i>Verrouillé</i>') : ''}</button>`;
  }).join('');
  pop.innerHTML = `<h5><span>${_t('Camouflage')}</span><button type="button" data-close="1" aria-label="${_t('Fermer')}">×</button></h5><div class="ars-camos">${items}</div><p class="hint" id="arsPopMsg">${_t('Les camouflages se débloquent avec le niveau de l\u0027arme.')}</p>`;
  ARSUI.pop = 'camo'; pop.classList.add('camo'); pop.hidden = false; vwLabels(); renderArsCorner();
  const room = arsPopRoom(pop);
  pop.style.left = clamp(VW.W - pop.offsetWidth - 10, 8, VW.W).toFixed(0) + 'px'; pop.style.top = Math.max(8, Math.min(VW.H - pop.offsetHeight - 66, room - pop.offsetHeight)).toFixed(0) + 'px';
  const first = pop.querySelector('.ars-camo.on') || pop.querySelector('.ars-camo'); if (first) first.focus({ preventScroll: true });
}
/* Place disponible pour la liste flottante, du haut du visuel au bas de l'écran (px) ; sa hauteur maximale en découle */
function arsPopRoom(pop) {
  const r = VW.host.getBoundingClientRect(), room = Math.max(140, (VIEW.h || innerHeight) - r.top - 12);
  pop.style.maxHeight = Math.min(420, room - 8) + 'px';
  return room;
}
function arsPopClose() { ARSUI.pop = ''; const pop = $('arsPop'); if (pop) pop.hidden = true; if (VW.model) { vwLabels(); renderArsCorner(); } }
/* Pose, remplace ou retire un accessoire (refus : message sous les camouflages) */
function arsApplyAtt(aid) {
  const { i, which } = arsCur(), r = classToggleAtt(i, which, aid);
  if (r) { arsMsg(r); sfxUi('locked'); return; }
  sfxUi(arsCur().eq.includes(aid) ? 'equip' : 'unequip'); // monté sur l'arme ou retiré
  ARSUI.msg = ''; arsPopClose(); arsStageSet(false); renderArsPanel();
}

function arsInit() {
  // emplacements de la classe (renderArsSlots) : on passe de l'un à l'autre
  $('arsTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.ars-slot'); if (!b || b.dataset.v === ARSUI.tab) return;
    sfxUi('tab'); if (ARSUI.tab === 'k') arsKsFill();
    ARSUI.tab = b.dataset.v; ARSUI.msg = ''; arsPopClose(); renderArsenal(true);
  });
  $('arsList').addEventListener('click', (e) => {
    const b = e.target.closest('.ars-card'); if (!b) return;
    if (b.dataset.ks) { arsKsPick(b.dataset.ks); return; }
    if (b.dataset.nade) { arsNadePick(b.dataset.nade); return; }
    const { i, which } = arsCur(), lock = weaponLock(b.dataset.w);
    if (lock) { arsMsg(`${_t('{0} verrouillé : {1}.', WEAPONS[b.dataset.w].name, lock)}`); sfxUi('locked'); return; }
    classSetWeapon(i, which, b.dataset.w); ARSUI.msg = ''; arsPopClose(); renderArsenal(true); sfxUi('click');
  });
  $('arsView').addEventListener('click', (e) => { if (e.target.closest('[data-camo-open]')) { if (ARSUI.pop === 'camo') arsPopClose(); else arsCamoOpen(); sfxUi('click'); } });
  $('arsPanel').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const { i, which, base } = arsCur();
    if (b.dataset.rm) arsApplyAtt(b.dataset.rm);
    else if (b.dataset.clear) { classClearWeapon(i, which); ARSUI.msg = ''; arsStageSet(false); renderArsPanel(); }
  });
  $('arsPop').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close) { arsPopClose(); sfxUi('close'); return; }
    if (b.dataset.camo !== undefined && b.classList.contains('ars-camo')) {
      const { i, which, base } = arsCur();
      if (!classSetCamo(i, which, b.dataset.camo)) { const m = $('arsPopMsg'); if (m) m.textContent = `${_t('Verrouillé : {0}.', camoLock(base.id, b.dataset.camo))}`; sfxUi('locked'); return; }
      ARSUI.msg = ''; arsPopClose(); arsStageSet(false); renderArsPanel(); sfxUi('camo');
    } else if (b.dataset.rm) arsApplyAtt(b.dataset.rm); else if (b.dataset.att) arsApplyAtt(b.dataset.att);
  });
  // la liste se ferme d'un clic ailleurs
  document.addEventListener('pointerdown', (e) => { if (ARSUI.pop && !e.target.closest('#arsPop') && !e.target.closest('.hot') && !e.target.closest('.vw-camo')) arsPopClose(); });
  // nom de la classe : enregistré à la validation (Entrée ou sortie du champ)
  const name = $('arsName');
  const commit = () => { if (!classEditable(ARSUI.cls)) return; classRename(ARSUI.cls, name.value); name.value = CLASSES[ARSUI.cls].name; PICKERS.forEach(renderPicker); };
  name.addEventListener('change', commit);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); name.blur(); } });
}

/* ---------- Annonces en partie ---------- */
let arsUpT = 0;
const ARSQ = { list: [], on: false, cur: null };
/* Déblocages (arme qui monte, accessoire, défi, tenue) : dans le couloir des annonces, la même file que la montée de niveau (09s-rankup.js) ;
   html : un titre <b> et une ligne <span> */
function arsShow(html) {
  if (ARSQ.list.length < 4) ARSQ.list.push(html);
  lanePump();
}
function arsShowNext() {
  const el = $('arsUp'), h = ARSQ.list.shift();
  if (!el || h === undefined) { ARSQ.on = false; return; }
  ARSQ.on = true; ARSQ.cur = h; el.innerHTML = `<i class="au-ic" aria-hidden="true"></i><div class="au-tx">${h}</div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(arsUpT); arsUpT = setTimeout(() => { el.classList.remove('show'); ARSQ.cur = null; arsUpT = setTimeout(() => { ARSQ.on = false; lanePump(); }, 350); }, 4200);
  sfxUi('unlock');
}
/* Interrompt le déblocage affiché ; again : il reprendra en tête de file */
function arsShowStop(again) {
  if (again && ARSQ.cur) ARSQ.list.unshift(ARSQ.cur);
  ARSQ.on = false; ARSQ.cur = null; clearTimeout(arsUpT);
  const el = $('arsUp'); if (el) el.classList.remove('show');
}
/* Fin ou abandon de la partie : plus d'annonce en attente */
function arsShowClear() { rankUpClear(); ARSQ.list.length = 0; arsShowStop(false); }
/* res : résultat de arsKill ; une annonce quand l'arme monte de niveau ou débloque quelque chose */
function arsNotify(res) {
  if (!res || (!res.up && !res.items.length)) return;
  arsShow(`<b>${WEAPONS[res.weapon].name}${res.up ? ` : ${_t('niveau {0}', res.level)}` : ''}</b>${res.items.length ? `<span>${_t('Débloqué : {0}', res.items.map((k) => esc(arsUnlockName(k))).join(' · '))}</span>` : ''}`);
}
/* Le joueur passe un niveau (arsLevelTick) : un nouvel emplacement de classe personnalisée est annoncé au passage */
function arsNotifyLevel(level) { rankUpShow(level, CUSTOM_UNLOCK.indexOf(level)); } // le rituel de montée de niveau, avec sa fanfare (09s-rankup.js)
/* Écran de fin : les armes qui ont gagné de l'XP pendant la partie */
function arsEndFill() {
  const el = $('endArs'); if (!el) return;
  const h = arsSessionHtml(), d = defisEndHtml(); // et les défis des tenues (06s-defis.js)
  el.innerHTML = (h ? `<h4>${_t('Progression des armes')}</h4>${h}` : '') + (d ? `<h4>${_t('Défis')}</h4>${d}` : ''); el.classList.toggle('hidden', !h && !d);
}
