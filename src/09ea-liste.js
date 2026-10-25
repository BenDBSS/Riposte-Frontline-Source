/* ==========================================================================
   MENUS DE LANCEMENT (Solo, Multijoueur) : à la manière des anciens Call of Duty
   À gauche, le menu : quelques rangées (Carte, Paramètres de partie, Modifier la classe...), l'aperçu de la carte dessous, l'action
   principale en bas. À droite, la scène : ce qu'il y a à voir à ce niveau (les équipes, les joueurs du salon, les parties publiques).
   Un sous-menu s'ouvre dans un panneau qui glisse à droite du menu, par-dessus la scène ; le menu reste visible, assombri, sa rangée
   ouverte marquée. Haut et bas parcourent les rangées ; gauche et droite règlent une valeur, sinon passent d'une colonne à l'autre (au
   bord gauche d'un sous-menu, ils le referment) ; A ou Entrée ouvre ou valide ; B ou Échap referme le sous-menu, puis quitte l'écran.
   Une page est une fonction (params) => page :
     niveau 0 (le menu) : { title, sub, rows, stage(), preview } ; stage() rend la scène, { head, note (un élément), cols: [{ head, cls, rows }],
       foot (HTML ou élément) } ou un élément ; preview est le HTML de l'encart sous le menu (la carte et les paramètres de la partie) ;
     sous-menu (le panneau) : { head, rows, grid } ; grid : les rangées sont des vignettes en grille (les cartes).
   Une rangée :
     { k: 'seg', key, label, items: [[valeur, libellé]], get(), set(v), full, wide }   choix : ◂ valeur ▸, ou tous les choix visibles (full)
     { k: 'check', key, label, get(), set(bool) }                                  Désactivé / Activé
     { k: 'range', key, label, min, max, step, fmt(v), get(), set(v) }             curseur
     { k: 'link', key, label, value, page, params | open() }                       ouvre un sous-menu (ou un autre écran)
     { k: 'pick', key, label, value, art, on, pick() }                             un choix dans une liste (une partie publique...)
     { k: 'card', key, label, tag, art, badge, lock, on, pick() }                  vignette illustrée (une carte)
     { k: 'player', key, label, lv, tags, me, bot, page, params }                  un joueur (sans page : une simple ligne)
     { k: 'btn', key, label, run(), danger, primary }                              action (primary : bouton jaune, l'action de la page)
     { k: 'text', key, label, input, bare }                                        champ de saisie (l'élément existant est repris ; bare : sans libellé)
     { k: 'sep', label } { k: 'note', text } { k: 'info', label, value } { k: 'node', node }   titre, remarque, valeur, contenu libre
   Communs : disabled, hidden, sub (seconde ligne sous le libellé). Une rangée qu'on règle porte _adj(d) (gauche, droite) : la navigation de
   09qc-manette.js (padNav) s'en sert, le clavier aussi ; A et Entrée font un clic.
   ========================================================================== */
const LM = { all: [], scr: {} }; // scr : la liste de chaque écran (uiBack referme d'abord son sous-menu)
const LM_ITEM = '.lrow, .lcard'; // ce qui prend le focus dans une liste
const lmWantFocus = () => !(TOUCH.on && !PAD.drive); // au doigt, rien n'est en surbrillance à l'arrivée
/* root : l'écran ; o = { pages, home, col (le menu), stage (la scène), panel (le sous-menu), preview (l'encart sous le menu), preview2 (le même,
   en haut de la scène : au téléphone), title et sub (titre et sous-titre de l'écran), screen (nom de l'écran), bin (où ranger les éléments que
   les rangées reprennent, data-keep) } */
function lmMount(root, o) {
  const L = { root, col: o.col, stage: o.stage || null, panel: o.panel || null, prev: o.preview || null, prev2: o.preview2 || null, pages: o.pages, home: o.home, bin: o.bin || null,
    h2: o.title || null, sub: o.sub || null, stack: [], def: null, def0: null, dirty: false, closeT: 0, pbody: null, phead: null };
  L.col.dataset.lm = LM_ITEM; L.col.setAttribute('role', 'group');
  if (L.panel) {
    L.panel.innerHTML = '<div class="lp-head"><h3 class="lbl"></h3></div><div class="lp-body"></div>';
    L.phead = L.panel.querySelector('.lp-head h3'); L.pbody = L.panel.querySelector('.lp-body'); L.pbody.dataset.lm = LM_ITEM;
  }
  // sous-menu ouvert : un clic hors de lui (menu assombri, fond, encart, pied, Retour) le referme, et rien d'autre (avant tout autre écouteur)
  root.addEventListener('click', (e) => { if (L.stack.length > 1 && L.panel && !L.panel.contains(e.target)) { e.preventDefault(); e.stopPropagation(); lmClose(L); sfxUi('back'); } }, true);
  root.addEventListener('click', (e) => lmClick(L, e));
  root.addEventListener('keydown', (e) => {
    const it = e.target.closest && e.target.closest(LM_ITEM);
    if (it && e.target === it && lmOwns(L, it) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); it.click(); }
  });
  // une seule surbrillance : la souris pose le focus sur la rangée survolée (pas pendant la navigation à la manette ou au clavier, où le survol est éteint)
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || document.body.classList.contains('padnav') || document.body.classList.contains('kbnav')) return;
    const it = e.target.closest && e.target.closest(LM_ITEM), a = document.activeElement;
    if (!it || it === a || it.tabIndex < 0 || !lmOwns(L, it) || (a && a.tagName === 'INPUT' && a.type !== 'range' && a.type !== 'checkbox')) return;
    it.focus({ preventScroll: true });
  });
  root.addEventListener('focusout', () => { if (L.dirty) setTimeout(() => { const a = document.activeElement; if (L.dirty && !(a && lmOwns(L, a) && a.tagName === 'INPUT')) lmRender(L); }, 0); }); // un affichage différé pendant la saisie
  root.addEventListener('focusin', (e) => { // la rangée où l'on est, par niveau : retrouvée au retour d'un sous-menu ou d'un autre écran
    const it = e.target.closest && e.target.closest(LM_ITEM); if (!it || !lmOwns(L, it)) return;
    const box = lmBox(L, it), top = L.stack[L.stack.length - 1];
    if (top && (box === 'panel') === (L.stack.length > 1)) { top.key = it.dataset.key; top.box = box; }
  });
  if (o.screen) LM.scr[o.screen] = L;
  LM.all.push(L);
  return L;
}
const lmOwns = (L, el) => !!el && (L.col.contains(el) || (!!L.stage && L.stage.contains(el)) || (!!L.pbody && L.pbody.contains(el)));
const lmBox = (L, el) => (L.pbody && L.pbody.contains(el) ? 'panel' : L.stage && L.stage.contains(el) ? 'stage' : 'col');
const lmItems = (box) => (box ? [...box.querySelectorAll(LM_ITEM)].filter((e) => e.tabIndex >= 0) : []);
const lmItemByKey = (box, key) => (box ? [...box.querySelectorAll(LM_ITEM)].find((e) => e.dataset.key === String(key)) : null);
const lmDepth = (L) => L.stack.length - 1;
/* Ouvre l'écran au menu (page d'accueil, ou la page id) */
function lmReset(L, id = L.home, params) {
  L.stack = [{ id, params, key: null, box: 'col' }];
  lmRender(L, { focus: true, anim: false });
}
/* Ouvre un sous-menu par-dessus le niveau affiché */
function lmPush(L, id, params) {
  L.stack.push({ id, params, key: null, box: 'panel' });
  lmRender(L, { focus: true, scroll0: true });
}
/* Ouvre un sous-menu à la place de celui qui est ouvert (raccourci : la discussion) */
function lmOpen(L, id, params) { L.stack.length = Math.min(L.stack.length, 1); lmPush(L, id, params); }
/* Remonte d'un niveau ; faux au menu (c'est alors à l'écran de revenir en arrière) */
function lmPop(L) {
  if (L.stack.length < 2) return false;
  L.stack.pop(); lmRender(L, { focus: true, restore: true });
  return true;
}
/* Referme tous les sous-menus */
function lmClose(L) {
  if (L.stack.length < 2) return false;
  L.stack.length = 1; lmRender(L, { focus: true, restore: true });
  return true;
}
/* Reconstruit l'écran : le menu et la scène (niveau 0), le sous-menu s'il est ouvert ; les valeurs relues, la rangée en surbrillance
   retrouvée par sa clé. o = { focus (donner le focus), restore (à la rangée mémorisée du niveau), scroll0 (sous-menu en haut), anim } */
function lmRender(L, o = {}) {
  const f0 = L.stack[0]; if (!f0) return;
  const a = document.activeElement, had = !!(a && a !== document.body && lmOwns(L, a));
  if (had && a.tagName === 'INPUT' && a.type !== 'range' && !o.focus) { L.dirty = true; return; } // pas de reconstruction pendant la saisie (le champ perdrait le focus)
  L.dirty = false;
  const open = L.stack.length > 1, top = L.stack[L.stack.length - 1], ai = had ? a.closest(LM_ITEM) : null, was = ai ? { box: lmBox(L, ai), key: ai.dataset.key } : null;
  if (L.bin) for (const n of L.root.querySelectorAll('[data-keep], input.li')) if (lmOwns(L, n)) L.bin.appendChild(n); // les éléments repris par une rangée retournent à l'abri avant la reconstruction
  const dt = open ? L.pages[top.id](top.params) || { rows: [] } : null, d0 = L.pages[f0.id](f0.params); if (!d0) return; // le sous-menu d'abord (la discussion ouverte remet à zéro les messages non lus que le menu affiche)
  L.def0 = d0;
  lmFill(L, L.col, d0.rows, open);
  if (open) { const op = lmItemByKey(L.col, f0.key); if (op && op._r && op._r.page === L.stack[1].id) op.classList.add('cur'); } // la rangée du menu dont le sous-menu est ouvert (aucune quand il vient d'ailleurs : Retour dans un salon, T pour la discussion)
  if (L.stage) lmStage(L, d0.stage ? d0.stage() : null, open);
  const ph = d0.preview || ''; // l'encart de la carte : sous le menu, et au téléphone en haut de la scène (le menu y manque de hauteur)
  for (const e of [L.prev, L.prev2]) if (e) { if (ph !== e._html) { e._html = ph; e.innerHTML = ph; } e.hidden = !ph; }
  if (open) lmPanel(L, dt, o); else lmPanelHide(L, o);
  L.def = dt || d0;
  L.root.classList.toggle('lm-open', open);
  for (const x of L.root.querySelectorAll('[data-lm-extra]')) x.tabIndex = open ? -1 : 0; // le pied (lancer, quitter) attend que le sous-menu se referme
  if (L.h2) L.h2.textContent = d0.title || '';
  if (L.sub) L.sub.textContent = d0.sub || '';
  if (!(had || o.focus) || !lmWantFocus()) return;
  const pool = open ? lmItems(L.pbody) : lmItems(L.col).concat(lmItems(L.stage));
  let t = null;
  if (was) t = pool.find((e) => e.dataset.key === was.key && lmBox(L, e) === was.box);
  if (!t && o.restore) { const f = open ? top : f0; t = pool.find((e) => e.dataset.key === f.key && lmBox(L, e) === (f.box || (open ? 'panel' : 'col'))); }
  if (!t && open) t = pool.find((e) => e.matches('.on, [aria-checked="true"]')) || pool[0];
  if (!t) t = lmItems(L.col).find((e) => e.classList.contains('on')) || lmItems(L.col)[0];
  if (t) { t.focus({ preventScroll: true }); lmScrollTo(t); }
}
function lmFill(L, box, rows, dim) {
  const st = box.scrollTop, nodes = [];
  for (const r of rows || []) {
    if (!r || r.hidden) continue;
    const n = lmRowEl(L, r); if (!n) continue;
    if (dim && n.tabIndex >= 0) n.tabIndex = -1; // menu assombri : seul le sous-menu se parcourt (un clic le referme)
    nodes.push(n);
  }
  box.replaceChildren(...nodes); box.scrollTop = st;
}
/* La scène : un titre, des colonnes de rangées (les équipes), une ligne de pied ; ou un élément fourni tel quel */
function lmStage(L, s, dim) {
  const S = L.stage, keep = [...S.querySelectorAll('.lb-list')].map((e) => e.scrollTop);
  if (!s) { S.replaceChildren(); return; }
  if (s.nodeType) { if (S.firstChild !== s || S.childNodes.length > 1) S.replaceChildren(s); return; }
  const out = [];
  if (s.head) { const h = document.createElement('div'); h.className = 'lb-head'; h.innerHTML = s.head; out.push(h); }
  if (s.note) out.push(s.note); // un élément repris (l'état du salon)
  const wrap = document.createElement('div'); wrap.className = 'lb-cols' + (s.cls ? ' ' + s.cls : '');
  (s.cols || []).forEach((c, i) => {
    const box = document.createElement('div'); box.className = 'lb-col' + (c.cls ? ' ' + c.cls : '');
    if (c.head) { const h = document.createElement('h3'); h.className = 'lb-h'; h.innerHTML = c.head; box.appendChild(h); }
    const list = document.createElement('div'); list.className = 'lb-list'; list.dataset.lm = LM_ITEM;
    lmFill(L, list, c.rows, dim); box.appendChild(list); wrap.appendChild(box);
  });
  out.push(wrap);
  if (s.foot) { const f = document.createElement(s.foot.nodeType ? 'div' : 'p'); f.className = 'lb-foot'; if (s.foot.nodeType) f.appendChild(s.foot); else f.innerHTML = s.foot; out.push(f); }
  S.replaceChildren(...out);
  const lists = S.querySelectorAll('.lb-list'); lists.forEach((e, i) => { e.scrollTop = keep[i] || 0; });
}
/* Le sous-menu : glisse depuis le menu à son ouverture (et à chaque nouvelle page), se retire en glissant */
function lmPanel(L, d, o) {
  const P = L.panel, B = L.pbody;
  L.phead.textContent = d.head || d.title || '';
  B.className = 'lp-body' + (d.grid ? ' maps' : '') + (d.cls ? ' ' + d.cls : '');
  if (d.grid) B.dataset.lmGrid = ''; else delete B.dataset.lmGrid;
  lmFill(L, B, d.rows, false);
  if (o.scroll0) B.scrollTop = 0;
  const fresh = P.hidden || P.classList.contains('out');
  clearTimeout(L.closeT); P.hidden = false; P.classList.remove('out');
  if ((fresh || o.scroll0) && o.anim !== false) { P.classList.remove('in'); void P.offsetWidth; P.classList.add('in'); }
}
function lmPanelHide(L, o) {
  const P = L.panel; if (!P || P.hidden) return;
  clearTimeout(L.closeT); P.classList.remove('in');
  for (const e of lmItems(L.pbody)) e.tabIndex = -1; // pendant qu'il se retire, plus rien ne s'y focalise
  if (o.anim === false) { P.hidden = true; P.classList.remove('out'); return; }
  P.classList.add('out'); L.closeT = setTimeout(() => { P.hidden = true; P.classList.remove('out'); }, 170);
}
/* Fait défiler le cadre de la rangée juste assez pour la montrer (sans toucher à l'écran) */
function lmScrollTo(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy !== 'auto' && oy !== 'scroll') continue;
    const r = el.getBoundingClientRect(), c = p.getBoundingClientRect();
    if (r.top < c.top + 4) p.scrollTop -= c.top + 8 - r.top; else if (r.bottom > c.bottom - 4) p.scrollTop += r.bottom - c.bottom + 8;
    return;
  }
}
/* Rafraîchit les valeurs sans toucher au focus (un réglage change ailleurs) */
function lmRefresh(L) { if (L.stack.length) lmRender(L); }

function lmRowEl(L, r) {
  if (r.k === 'sep') { const h = document.createElement('h4'); h.className = 'lsep'; h.textContent = r.label || ''; return h; }
  if (r.k === 'note') { const p = document.createElement('p'); p.className = 'lnote' + (r.cls ? ' ' + r.cls : ''); if (r.html) p.innerHTML = r.text; else p.textContent = r.text; return p; }
  if (r.k === 'info') {
    const p = document.createElement('div'); p.className = 'linfo';
    p.append(Object.assign(document.createElement('span'), { textContent: r.label }), Object.assign(document.createElement('b'), { textContent: r.value }));
    return p;
  }
  if (r.k === 'node') return r.node;
  if (r.k === 'check') { const g = r.get, s = r.set; r = Object.assign({}, r, { k: 'seg', items: [[0, _t('Désactivé')], [1, _t('Activé')]], get: () => (g() ? 1 : 0), set: (v) => s(!!+v) }); }
  if (r.k === 'card') return lmCard(L, r);
  const el = document.createElement('div'), inert = r.k === 'player' && !r.page;
  el.className = 'lrow k-' + r.k + (r.full ? ' k-full' : '') + (r.wide ? ' wide' : '') + (r.danger ? ' danger' : '') + (r.primary ? ' primary' : '') + (r.bare ? ' bare' : '') + (r.on ? ' on' : '') + (r.me ? ' me' : '') + (r.bot ? ' bot' : '') + (r.art !== undefined ? ' k-art' : '');
  el.dataset.key = r.key == null ? '' : String(r.key); el._r = r;
  if (!inert) el.setAttribute('role', 'button');
  if (r.disabled || inert) { el.tabIndex = -1; if (r.disabled) el.setAttribute('aria-disabled', 'true'); } else el.tabIndex = 0;
  el._adj = (d) => lmStep(L, el, d, false);
  if (r.k === 'player') { // un joueur : niveau (ou « Bot »), nom, étiquettes (vous, hôte, carte prête...)
    const lv = document.createElement('b'); lv.className = 'plv'; lv.textContent = r.bot ? _t('Bot') : r.lv ? String(r.lv) : '';
    const n = document.createElement('span'); n.className = 'll'; n.textContent = r.label;
    const tg = document.createElement('div'); tg.className = 'lv';
    for (const t of r.tags || []) tg.appendChild(Object.assign(document.createElement('i'), { className: 'ptag', textContent: t }));
    el.append(lv, n, tg);
    return el;
  }
  if (r.art !== undefined) { // vignette de la carte (partie publique)
    const im = document.createElement(r.art ? 'img' : 'span'); im.className = 'lart' + (r.art ? '' : ' none'); if (r.art) { im.alt = ''; im.decoding = 'async'; im.src = r.art; }
    el.appendChild(im);
  }
  const lab = document.createElement('span'); lab.className = 'll'; lab.textContent = r.label;
  if (r.sub) { const s = document.createElement('small'); s.className = 'ls'; s.textContent = r.sub; lab.appendChild(s); }
  if (!r.bare) el.appendChild(lab); // bare : le champ seul, sur toute la largeur (son libellé passe dans aria-label)
  const v = document.createElement('div'); v.className = 'lv'; el.appendChild(v);
  const arrow = (d) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'la'; b.dataset.d = String(d); b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); return b; };
  if (r.k === 'seg' && r.full) { // tous les choix visibles (paramètres de la partie) : un clic choisit, gauche et droite passent au voisin
    const box = document.createElement('div'), cur = String(r.get()); box.className = 'seg'; box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', r.label);
    for (const [x, t] of r.items) {
      const b = document.createElement('button'); b.type = 'button'; b.tabIndex = -1; b.textContent = t; b.dataset.v = String(x); b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(String(x) === cur)); if (r.disabled) b.disabled = true; box.appendChild(b);
    }
    v.appendChild(box);
  } else if (r.k === 'seg') {
    const i = Math.max(0, r.items.findIndex(([x]) => String(x) === String(r.get())));
    const l = arrow(-1), n = arrow(1), t = document.createElement('span'); t.className = 'lt'; t.textContent = r.items[i] ? r.items[i][1] : '';
    l.classList.toggle('off', i <= 0); n.classList.toggle('off', i >= r.items.length - 1);
    v.append(l, t, n); el.setAttribute('aria-label', r.label + ' : ' + t.textContent);
  } else if (r.k === 'range') {
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = r.min; inp.max = r.max; inp.step = r.step; inp.tabIndex = -1; inp.setAttribute('aria-label', r.label);
    const out = document.createElement('output'), fill = () => inp.style.setProperty('--p', ((parseFloat(inp.value) - r.min) / (r.max - r.min)) * 100 + '%');
    inp.value = r.get(); out.textContent = r.fmt(r.get()); fill();
    inp.addEventListener('input', () => { const x = parseFloat(inp.value); r.set(x); out.textContent = r.fmt(x); fill(); sfxUi('tick'); });
    el._rg = { inp, out, fill }; v.append(inp, out);
  } else if (r.k === 'link') {
    const t = document.createElement('span'); t.className = 'lt'; t.textContent = r.value == null ? '' : r.value; v.append(t, Object.assign(arrow(1), { className: 'la go' }));
  } else if (r.k === 'pick') {
    v.append(Object.assign(document.createElement('span'), { className: 'lt', textContent: r.value || '' })); if (r.on) { const d = document.createElement('i'); d.className = 'dot'; v.appendChild(d); }
  } else if (r.k === 'text') {
    r.input.classList.add('li'); if (r.bare) r.input.setAttribute('aria-label', r.label); v.appendChild(r.input);
  }
  return el;
}
/* Vignette illustrée (une carte) : l'image, le nom, la légende ; une étiquette (choisie, bientôt) */
function lmCard(L, r) {
  const b = document.createElement('div');
  b.className = 'lcard mapcard' + (r.on ? ' on' : '') + (r.lock ? ' lock' : '');
  b.dataset.key = String(r.key); b._r = r; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(!!r.on));
  if (r.disabled) { b.tabIndex = -1; b.setAttribute('aria-disabled', 'true'); } else b.tabIndex = 0;
  const c = document.createElement(r.art ? 'img' : 'span'); c.className = 'mapart' + (r.art ? '' : ' none'); if (r.art) { c.alt = ''; c.decoding = 'async'; c.src = r.art; }
  const t = document.createElement('span'); t.className = 'mt'; t.textContent = r.label;
  const g = document.createElement('span'); g.className = 'mg'; g.textContent = r.tag || '';
  const tx = document.createElement('span'); tx.className = 'mtx'; tx.append(t, g);
  b.append(c, tx);
  if (r.badge) b.appendChild(Object.assign(document.createElement('i'), { className: 'mb', textContent: r.badge }));
  b._adj = () => false;
  return b;
}
/* Un clic (souris, doigt, A, Entrée) sur une rangée */
function lmClick(L, e) {
  const it = e.target.closest && e.target.closest(LM_ITEM); if (!it || !lmOwns(L, it)) return;
  if (it.getAttribute('aria-disabled') === 'true') return;
  const r = it._r; if (!r) return;
  if (r.k === 'seg') { const sb = e.target.closest('.seg button'), ar = e.target.closest('.la[data-d]'); if (sb && it.contains(sb)) lmSet(L, it, sb.dataset.v); else lmStep(L, it, ar ? +ar.dataset.d : 1, true); return; }
  if (r.k === 'text') { if (e.target !== r.input) r.input.focus(); return; }
  if (r.k === 'range') return;
  lmAct(L, it);
}
/* Règle la valeur d'une rangée d'un cran (d = ±1) : vrai si la direction est prise par la rangée (même au bout de sa plage) */
function lmStep(L, row, d, wrap) {
  const r = row._r; if (!r || row.getAttribute('aria-disabled') === 'true') return false;
  if (r.k === 'seg') {
    const n = r.items.length, i = Math.max(0, r.items.findIndex(([x]) => String(x) === String(r.get())));
    let j = i + d; if (wrap) j = (j + n) % n; else j = clamp(j, 0, n - 1);
    if (j !== i) { sfxUi('tab'); r.set(r.items[j][0]); lmRender(L); }
    return true;
  }
  if (r.k === 'range') {
    const g = row._rg, p = Math.max(0, (String(r.step).split('.')[1] || '').length), mult = lmStep.fast ? 4 : 1;
    const v = clamp(parseFloat((parseFloat(g.inp.value) + d * r.step * mult).toFixed(p)), r.min, r.max);
    if (v !== parseFloat(g.inp.value)) { g.inp.value = String(v); g.inp.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  }
  return false;
}
lmStep.fast = false;
/* Choisit une valeur d'un choix segmenté (clic sur l'un des choix) */
function lmSet(L, row, v) {
  const r = row._r, it = r.items.find(([x]) => String(x) === String(v));
  if (!it || String(r.get()) === String(v)) return;
  sfxUi('tab'); r.set(it[0]); lmRender(L);
}
/* A, Entrée ou un clic : ouvre le sous-menu, choisit, lance */
function lmAct(L, el) {
  const r = el._r; if (!r) return;
  if ((r.k === 'link' || r.k === 'player') && r.page) { const f = L.stack[L.stack.length - 1]; f.key = el.dataset.key; f.box = lmBox(L, el); lmPush(L, r.page, r.params); }
  else if (r.k === 'link') { if (r.open) r.open(); }
  else if (r.k === 'pick' || r.k === 'card') { if (r.pick) r.pick(); }
  else if (r.k === 'btn') { if (r.run) r.run(); }
}
