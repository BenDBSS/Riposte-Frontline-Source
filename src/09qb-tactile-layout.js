/* ==========================================================================
   DISPOSITION DES COMMANDES TACTILES : le joueur déplace, agrandit, retire ses boutons (Options, Jeu, « Disposition des commandes »).
   Un bouton déplacé est rangé dans Settings.tcLay[id] = [x, y, taille, retiré] : x et y sont la place du centre en fraction de la largeur et de la hauteur de
   l'écran (la disposition suit donc la taille du téléphone), la taille un diamètre en « u » (1 % de la hauteur, comme --s). Un bouton sans entrée garde sa place par défaut
   (shell.html). Le mode d'édition affiche tous les boutons sur un fond assombri, y compris ceux qui n'apparaissent qu'en cas de besoin (séries, ramassage, discussion),
   et fonctionne depuis les menus comme depuis la pause. « Partager » donne la disposition en texte (à copier, à coller) : outil de mise au point, à retirer plus tard.
   Tir automatique (Settings.tcAuto, par défaut au doigt) : plus de bouton de tir, la visée prend la place et la taille du bouton de tir de droite. Sa place dans ce
   mode est rangée à part (entrée adsA) : celle du mode manuel ne bouge pas. Double toucher pour viser (Settings.tcDblAds, par défaut) : plus de bouton Viser.
   ========================================================================== */
function touchLayoutIds() { return TC_BTNS.map((x) => x[0]).filter((id) => id !== 'boom').concat('stick'); } // (le bouton du drone prend la place du tir : touchLayoutOne)
/* Élément qui porte la place d'un réglage : le bouton, ou pour le joystick son cercle */
function touchHit(id) { return id === 'stick' ? TC.el.stick.firstChild : TC.el[id]; }
/* Entrée de la disposition d'un bouton : la visée a la sienne en tir automatique (une fonction : touchInit, en bas de 09q-tactile.js, s'en sert au chargement) */
function touchLayKey(id) { return id === 'ads' && Settings.tcAuto ? 'adsA' : id; }
/* Modes du tir et de la visée (Options) : tir automatique (classe auto, shell.html : boutons de tir cachés, visée replacée) et double toucher pour viser
   (classe dbl : bouton Viser caché) */
function touchModeSync() {
  const a = !!Settings.tcAuto, d = !!Settings.tcDblAds; if (!TC.root || (TC.autoOn === a && TC.dblOn === d)) return;
  TC.dblOn = d; TC.root.classList.toggle('dbl', d);
  if (TC.autoOn !== a) { TC.autoOn = a; TC.root.classList.toggle('auto', a); touchLayoutOne('ads'); }
}

/* 2.23.1 : joystick fixe, course au doigt par défaut et disposition d'origine du joueur : les réglages tactiles des versions précédentes (jamais choisis, ceux par défaut)
   sont remis une fois */
function touchLayoutMigrate() { if (Settings.tcV === 2) return; Settings.tcV = 2; Settings.tcRun = 'stick'; Settings.tcLay = null; saveSettings(); }

/* Applique la disposition enregistrée (ou la remet par défaut) à tous les boutons */
function touchLayoutApply() {
  TC.lay = Settings.tcLay && typeof Settings.tcLay === 'object' ? Settings.tcLay : JSON.parse(JSON.stringify(TC_DEFAULT_LAY)); // sans disposition enregistrée : celle d'origine (copie)
  TC.autoOn = !!Settings.tcAuto; TC.dblOn = !!Settings.tcDblAds; if (TC.root) { TC.root.classList.toggle('auto', TC.autoOn); TC.root.classList.toggle('dbl', TC.dblOn); }
  for (const id of touchLayoutIds()) touchLayoutOne(id);
}
function touchLayoutOne(id) {
  const b = TC.el[id], F = TC.lay.fire; if (!b) return;
  let L = TC.lay[touchLayKey(id)];
  if (!L && id === 'ads' && Settings.tcAuto && F) L = [F[0], F[1], F[2], 0]; // tir automatique : à la place du bouton de tir (sans place réglée : celle de shell.html, .auto)
  if (id !== 'stick') { b.classList.toggle('ov', !!L); b.classList.toggle('off', !!(L && L[3])); }
  for (const k of ['--fx', '--fy', '--s']) b.style.removeProperty(k);
  if (L) { b.style.setProperty('--fx', L[0]); b.style.setProperty('--fy', L[1]); b.style.setProperty('--s', L[2]); }
  if (id === 'fire' && TC.el.boom) { const B = TC.el.boom; B.classList.toggle('ov', !!F); for (const k of ['--fx', '--fy', '--s']) B.style.removeProperty(k); if (F) { B.style.setProperty('--fx', F[0]); B.style.setProperty('--fy', F[1]); B.style.setProperty('--s', F[2]); } } // drone kamikaze : à la place du tir
}
/* Entrée d'un bouton, créée à partir de sa place actuelle s'il n'en a pas encore */
function touchLayoutGet(id) {
  const k = touchLayKey(id);
  if (TC.lay[k]) { Settings.tcLay = TC.lay; return TC.lay[k]; }
  const b = touchHit(id), r = b.getBoundingClientRect(), u = TOUCH.R / 12.5; // une unité « u » (voir touchSize)
  const L = [round4(touchFrac(r.left + r.width / 2, 'x')), round4(touchFrac(r.top + r.height / 2, 'y')), Math.round((r.height / u) * 10) / 10, 0];
  TC.lay[k] = L; Settings.tcLay = TC.lay; return L; // (la disposition est enregistrée en entier dès la première retouche)
}
function round4(v) { return Math.round(v * 1e4) / 1e4; }

function touchEditBuild(root) {
  const ed = document.createElement('div'); ed.id = 'tcEd'; ed.className = 'hidden';
  ed.innerHTML = `<div class="ed-row"><b id="tcEdName"></b><button type="button" data-ed="minus">-</button><button type="button" data-ed="plus">+</button><button type="button" data-ed="toggle"></button></div>
    <div class="ed-row"><button type="button" class="pri" data-ed="done">${esc(_t('Terminé'))}</button><button type="button" data-ed="reset">${esc(_t('Réinitialiser'))}</button><button type="button" data-ed="share">${esc(_t('Partager'))}</button></div>
    <div class="ed-share hidden"><textarea rows="3" spellcheck="false" aria-label="${esc(_t('Disposition en texte'))}"></textarea><div class="ed-row"><button type="button" data-ed="copy">${esc(_t('Copier'))}</button><button type="button" data-ed="apply">${esc(_t('Appliquer'))}</button></div><p></p></div>`;
  root.appendChild(ed); TC.el.ed = ed;
  const ring = TC.el.stick.firstChild; // en édition, le cercle du joystick se saisit comme un bouton
  ring.addEventListener('pointerdown', (e) => { if (!TC.edit) return; e.preventDefault(); e.stopPropagation(); touchEditDown('stick', e); });
  ring.addEventListener('pointermove', touchEditMove); ring.addEventListener('pointerup', touchEditUp); ring.addEventListener('pointercancel', touchEditUp); ring.addEventListener('lostpointercapture', touchEditUp);
  ed.addEventListener('pointerdown', (e) => e.stopPropagation());
  ed.addEventListener('click', (e) => { const a = e.target.closest('[data-ed]'); if (a) touchEditAct(a.dataset.ed); });
}
/* Ouvre l'édition : depuis les menus (le fond est assombri) ou depuis la pause (le menu pause s'efface le temps de l'édition) */
function touchEditOpen() {
  if (!TOUCH.on || TC.edit) return;
  TC.edit = true; TC.sel = null; touchReset(); touchModeSync();
  TC.fromPause = MATCH.state === 'paused'; if (TC.fromPause) $('pause').classList.remove('show');
  TC.root.classList.remove('hidden', 'dead', 'map'); TC.root.classList.add('edit'); TC.el.ed.classList.remove('hidden'); TC.el.help.classList.add('hidden');
  for (const [id] of TC_BTNS) TC.el[id].classList.remove('gone');
  TC.el.stick.classList.add('on'); TC.root.classList.toggle('float', Settings.tcStick !== 'fixed'); touchEditSelect(null); sfxUi('click');
}
function touchEditClose() {
  TC.edit = false; TC.drag = null; saveSettings();
  TC.el.stick.classList.remove('on'); TC.root.classList.remove('edit'); TC.el.ed.classList.add('hidden'); TC.el.ed.querySelector('.ed-share').classList.add('hidden');
  for (const b of TC.root.querySelectorAll('.sel')) b.classList.remove('sel');
  TC.root.classList.toggle('hidden', !TC.show); // en menu ou en pause : les commandes se recachent
  if (TC.fromPause && MATCH.state === 'paused') $('pause').classList.add('show');
  TC.fromPause = false; sfxUi('back');
}
function touchEditSelect(id) {
  TC.sel = id;
  for (const k of touchLayoutIds()) touchHit(k).classList.toggle('sel', k === id);
  const ed = TC.el.ed, def = id === 'stick' ? [0, 0, 0, Settings.tcStick === 'fixed' ? _t('Joystick') : _t('Joystick (sa taille, il apparaît sous le doigt)')] : id && TC_BTNS.find((x) => x[0] === id);
  ed.querySelector('#tcEdName').textContent = def ? def[3] : _t('Touchez un bouton, puis glissez-le');
  for (const a of ed.querySelectorAll('[data-ed=minus],[data-ed=plus],[data-ed=toggle]')) a.disabled = !def;
  ed.querySelector('[data-ed=toggle]').disabled = !def || id === 'stick'; // le joystick ne se retire pas
  const L = id && TC.lay[touchLayKey(id)], off = !!(L && L[3]);
  ed.querySelector('[data-ed=toggle]').textContent = off ? _t('Remettre') : _t('Retirer');
}
function touchEditDown(id, e) {
  touchEditSelect(id);
  if (id === 'stick' && Settings.tcStick !== 'fixed') return; // flottant : sa place est celle du doigt, seule sa taille se règle
  const b = touchHit(id), r = b.getBoundingClientRect();
  TC.drag = { id, pid: e.pointerId, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
  try { b.setPointerCapture(e.pointerId); } catch (er) { /* ignoré */ }
}
function touchEditMove(e) {
  const D = TC.drag; if (!TC.edit || !D || e.pointerId !== D.pid) return;
  const L = touchLayoutGet(D.id);
  L[0] = round4(clamp(touchFrac(e.clientX - D.dx, 'x'), 0.03, 0.97)); L[1] = round4(clamp(touchFrac(e.clientY - D.dy, 'y'), 0.05, 0.95));
  touchLayoutOne(D.id);
}
function touchEditUp(e) { if (TC.drag && e.pointerId === TC.drag.pid) { TC.drag = null; saveSettings(); } }

function touchEditAct(a) {
  const ed = TC.el.ed, share = ed.querySelector('.ed-share'), ta = share.querySelector('textarea'), msg = share.querySelector('p');
  if (a === 'done') return touchEditClose();
  if (a === 'minus' || a === 'plus') { if (!TC.sel) return; const L = touchLayoutGet(TC.sel); L[2] = Math.round(clamp(L[2] + (a === 'plus' ? 1 : -1), TC.sel === 'stick' ? 16 : TC_MINU, TC.sel === 'stick' ? 40 : TC_MAXU) * 10) / 10; touchLayoutOne(TC.sel); saveSettings(); return; }
  if (a === 'toggle') { if (!TC.sel) return; const L = touchLayoutGet(TC.sel); L[3] = L[3] ? 0 : 1; touchLayoutOne(TC.sel); touchEditSelect(TC.sel); saveSettings(); return; }
  if (a === 'reset') { Settings.tcLay = null; touchLayoutApply(); touchEditSelect(null); saveSettings(); sfxUi('back'); return; }
  if (a === 'share') { share.classList.toggle('hidden'); if (!share.classList.contains('hidden')) { ta.value = touchLayoutExport(); msg.textContent = ''; } return; }
  if (a === 'copy') {
    ta.value = touchLayoutExport(); ta.select();
    const ok = () => { msg.textContent = _t('Copié.'); }, no = () => { msg.textContent = _t('Sélectionnez le texte et copiez-le.'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, no); else no(); } catch (e) { no(); }
    return;
  }
  if (a === 'apply') { msg.textContent = touchLayoutImport(ta.value) ? _t('Disposition appliquée.') : _t('Texte non reconnu.'); touchEditSelect(null); }
}
/* Disposition en texte : {"v":1,"run":"button","b":{"fire":[0.88,0.78,20,0],...}} (seuls les boutons déplacés y figurent ; adsA : la visée en tir automatique) */
function touchLayoutExport() { return JSON.stringify({ v: 1, run: Settings.tcRun, b: TC.lay }); }
function touchLayoutImport(txt) {
  let o; try { o = JSON.parse(txt); } catch (e) { return false; }
  if (!o || o.v !== 1 || !o.b || typeof o.b !== 'object') return false;
  const lay = {}, ids = new Set(touchLayoutIds().concat('adsA'));
  for (const id in o.b) {
    const v = o.b[id]; if (!ids.has(id) || !Array.isArray(v) || v.length < 3 || !v.slice(0, 3).every((n) => typeof n === 'number' && isFinite(n))) return false;
    lay[id] = [clamp(v[0], 0.03, 0.97), clamp(v[1], 0.05, 0.95), clamp(v[2], id === 'stick' ? 16 : TC_MINU, id === 'stick' ? 40 : TC_MAXU), id !== 'stick' && v[3] ? 1 : 0];
  }
  if (o.run === 'button' || o.run === 'stick') Settings.tcRun = o.run;
  Settings.tcLay = Object.keys(lay).length ? lay : null; saveSettings(); touchLayoutApply(); syncOptions(); return true; // (texte sans bouton : disposition d'origine)
}
