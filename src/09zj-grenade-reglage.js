/* ==========================================================================
   BANC DE RÉGLAGE DES GRENADES EN MAIN (outil de développement, README « Grenades »)
   Le jeu s'ouvre avec ?grenade=1 (https://playriposte-dev.vercel.app/?grenade=1) : un panneau à gauche règle en direct, sur la vraie vue subjective, chaque
   grenade et le couteau de lancer dans la main (place et angles : NADE_GRIP), les doigts et le pouce qui les tiennent (HAND_POSES.nfrag, nflash, nsmoke, nknife), le bras armé et la main
   gauche (NADE_POSE). On lance une partie solo, on choisit le type dans le panneau, et chaque curseur agit tout de suite.
   - Jeu : on joue normalement (G lance pour de bon). Tenue force le bras armé, grenade en main, même à l'arrêt ; Dégoupillage et Lancer figent le geste
     à un instant ou le rejouent en boucle.
   - Copier : toute la configuration en un texte, à coller dans la conversation ; Appliquer : l'inverse. Elle est gardée dans le navigateur
     (localStorage, dc_grenade) tant que le panneau est ouvert, « Tout remettre » revient à celle du code.
   - Même fonctionnement que le banc du couteau (09zk-couteau-reglage.js, dont il reprend kdbgMerge et les poses de départ du pouce) : la souris reste libre,
     le panneau arrête les évènements qu'il reçoit, « Verrouiller la vue » fige le regard.
   Le code ne fait rien sans ?grenade=1 : le panneau, ses évènements et le crochet NADE_DEBUG (06c-models.js, 08-player.js) n'existent pas pour un joueur.
   ========================================================================== */
const NDBG_ON = /[?&]grenade=1(&|$)/.test(location.search);
const NDBG = { type: 'frag', mode: 'tenue', t: 0.3, loop: true, clock: 0, god: true, bots: null, lookLock: false, def: null, el: null, rows: [], secs: [], ta: null, msg: null, tEl: null };

/* Les réglages : [chemin, libellé, min, max, pas]. Chemin : G = NADE_GRIP, H = HAND_POSES, N = NADE_POSE, puis les clés (un nombre : l'indice d'un tableau) */
function ndbgTypeSpec(id) {
  const n = NADE_TYPES[id].long, G = `G.${id}`, F = `H.n${id}`, f = (path, lab, mn, mx, st) => [path, lab, mn, mx, st];
  return [
    [`${n} : place dans la main (repère de la main : x petit doigt, y dos de la main, z coude)`, [
      f(`${G}.p.0`, 'centre x (vers le petit doigt)', -0.1, 0.1, 0.001), f(`${G}.p.1`, 'centre y (paume : négatif)', -0.12, 0.06, 0.001), f(`${G}.p.2`, 'centre z (doigts : négatif)', -0.14, 0.06, 0.001),
      f(`${G}.r.0`, 'angle autour de x (degrés)', -180, 180, 1), f(`${G}.r.1`, 'angle autour de y', -180, 180, 1), f(`${G}.r.2`, 'angle autour de z', -180, 180, 1),
    ], id],
    [`${n} : doigts (flexion en rad : base, milieu, bout ; 0 tendu)`, [
      ...[['i', 'index'], ['m', 'majeur'], ['r', 'annulaire'], ['p', 'auriculaire']].flatMap(([k, nm]) => [['base', 0], ['milieu', 1], ['bout', 2]].map(([b, j]) => f(`${F}.${k}.${j}`, `${nm} ${b}`, 0, 1.9, 0.01))),
      f(`${F}.spread`, 'écart des doigts', 0, 0.3, 0.005),
    ], id],
    [`${n} : pouce (rad ; la base pivote en huit sens, du plus naturel au plus libre)`, [
      f(`${F}.t.0`, 'milieu du pouce : flexion', -3, 3, 0.01), f(`${F}.t.1`, 'bout du pouce : flexion', -3, 3, 0.01),
      f(`${F}.t.2`, 'base : vers l\'auriculaire', -3, 3, 0.01), f(`${F}.t.3`, 'base : écart hors de la paume', -3, 3, 0.01), f(`${F}.t.4`, 'base : tour sur lui-même (l\'ongle)', -3, 3, 0.01),
      f(`${F}.t.5`, 'base : pivot sur x (en travers)', -3.2, 3.2, 0.02), f(`${F}.t.6`, 'base : pivot sur y (dos de la main)', -3.2, 3.2, 0.02), f(`${F}.t.7`, 'base : pivot sur z (avant-bras)', -3.2, 3.2, 0.02),
    ], id, F],
  ];
}
const NDBG_SPEC = () => [
  ...NADE_IDS.flatMap(ndbgTypeSpec),
  ['Bras armé (la tenue, commun aux trois ; le poignet en mètres, repère de la caméra)', [
    ['N.armed.0', 'poignet x (droite)', -0.4, 0.6, 0.005], ['N.armed.1', 'poignet y (haut)', -0.5, 0.4, 0.005], ['N.armed.2', 'poignet z (loin : négatif)', -0.8, -0.05, 0.005],
    ['N.rollArmed', 'roulis de l\'avant-bras', -3.2, 3.2, 0.02], ['N.pole.0', 'coude x', -2, 2, 0.05], ['N.pole.1', 'coude y (bas : négatif)', -2, 2, 0.05], ['N.pole.2', 'coude z', -2, 2, 0.05],
    ['N.shoulderUp', 'épaule levée', -0.2, 0.4, 0.005],
  ]],
  ['Main gauche pendant la tenue', [
    ['N.guide.0', 'poignet x', -0.6, 0.3, 0.005], ['N.guide.1', 'poignet y', -0.6, 0.3, 0.005], ['N.guide.2', 'poignet z', -0.9, -0.1, 0.005], ['N.rollL', 'roulis', -3.2, 3.2, 0.02],
  ]],
];
/* Ce que le texte copié reprend de NADE_POSE (les trajectoires du dégoupillage et du lancer restent dans le code) */
const NDBG_POSE_KEYS = ['armed', 'rollArmed', 'pole', 'shoulderUp', 'guide', 'rollL'];
function ndbgRoot(k) { return k === 'G' ? NADE_GRIP : k === 'H' ? HAND_POSES : NADE_POSE; }
function ndbgRef(path) { // 'G.frag.p.0' : [tableau ou objet, clé]
  const k = path.split('.'); let o = ndbgRoot(k[0]);
  for (let i = 1; i < k.length - 1; i++) o = o[k[i]];
  return [o, k[k.length - 1]];
}
function ndbgGet(path) { const [o, k] = ndbgRef(path); return o[k]; }
function ndbgSet(path, v) { const [o, k] = ndbgRef(path); o[k] = v; ndbgSave(); }
function ndbgSnap() {
  const hands = {}; for (const id of NADE_IDS) hands['n' + id] = HAND_POSES['n' + id];
  const pose = {}; for (const k of NDBG_POSE_KEYS) pose[k] = NADE_POSE[k];
  return JSON.parse(JSON.stringify({ NADE_GRIP, NADE_POSE: pose, mains: hands }));
}
/* le texte copié : une ligne par ensemble, nombres à quatre décimales */
function ndbgText() {
  const s = ndbgSnap(), f = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? +x.toFixed(4) : x));
  return `{\n"NADE_GRIP": ${f(s.NADE_GRIP)},\n"NADE_POSE": ${f(s.NADE_POSE)},\n"mains": ${f(s.mains)}\n}`;
}
function ndbgLoad(text) {
  const c = JSON.parse(text);
  kdbgMerge(NADE_GRIP, c.NADE_GRIP); // kdbgMerge ne reprend que les clés connues, de même type
  if (c.NADE_POSE && typeof c.NADE_POSE === 'object') { const P = {}; for (const k of NDBG_POSE_KEYS) if (k in c.NADE_POSE) P[k] = c.NADE_POSE[k]; kdbgMerge(NADE_POSE, P); } // pas les trajectoires
  if (c.mains) for (const id of NADE_IDS) kdbgMerge(HAND_POSES['n' + id], c.mains['n' + id]);
  ndbgRefresh(); ndbgSave();
}
function ndbgSave() { try { localStorage.setItem('dc_grenade', ndbgText()); } catch (e) { /* stockage refusé : la configuration ne survit pas au rechargement */ } }
function ndbgSay(t) { if (NDBG.msg) NDBG.msg.textContent = t; }
function ndbgDefault(path) { const k = path.split('.'), d = NDBG.def; let v = k[0] === 'G' ? d.NADE_GRIP : k[0] === 'H' ? d.mains : d.NADE_POSE; for (let i = 1; i < k.length; i++) v = v[k[i]]; return v; }

/* Ce que le panneau force dans l'état de la main (appelé par updatePlayer, 08-player.js, juste avant updateRigs). Le vrai état du joueur ne change pas :
   la grenade du panneau ne part pas, ne se cuit pas et n'éclate pas */
function ndbgFilter(S, dt) {
  const K = NDBG;
  if (K.god) PL.ent.health = 100;
  if (K.lookLock) { mouseDX = 0; mouseDY = 0; }
  if (!PL.nadeState) PL.nadeType = K.type; // le type choisi dans le panneau, même après une réapparition (sinon celui de la classe)
  if (K.mode === 'jeu' || !PL.ent.alive || PL.nadeState) return;
  if (PL.knifeOut) knifeStow(PL.cur);
  S.knifeT = 0; S.knifeHold = 0; S.cookT = 0; VM.lowerTarget = 1;
  VM.bobAmt = 0; VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0);
  if (K.mode === 'tenue') { S.nadeState = 'cook'; S.nadeT = 1; return; }
  const dur = K.mode === 'pull' ? NADE_ANIM.pull : NADE_ANIM.throw;
  let t = K.t;
  if (K.loop) { K.clock = (K.clock + dt) % (dur + 0.6); t = Math.min(1, K.clock / dur); if (K.tEl) K.tEl.value = t; }
  S.nadeState = K.mode; S.nadeT = t * dur * (K.mode === 'pull' ? 0.999 : 1);
}

function ndbgRefresh() {
  for (const r of NDBG.rows) { const v = ndbgGet(r.path); r.input.value = v; r.num.value = +v.toFixed(4); }
}
/* le type choisi : celui que la main tient, ses réglages ouverts, ceux des autres refermés */
function ndbgType(id) {
  NDBG.type = id; if (!PL.nadeState) PL.nadeType = id;
  for (const s of NDBG.secs) if (s.type) s.d.open = s.type === id && (s.d.open || s.first);
  for (const b of NDBG.typeBtns) b.classList.toggle('on', b.dataset.ty === id);
}
function ndbgInit() {
  if (NDBG.el) return;
  NDBG.def = ndbgSnap();
  LOCK.fallback = true; showLockPrompt(false); // la souris reste libre : on touche des curseurs
  try { const s = localStorage.getItem('dc_grenade'); if (s) ndbgLoad(s); } catch (e) { /* configuration gardée illisible : celle du code */ }
  NADE_DEBUG = ndbgFilter;
  const css = document.createElement('style');
  css.textContent = `#ndbg{position:fixed;left:0;top:0;bottom:0;width:420px;z-index:100000;overflow:auto;background:rgba(8,10,8,.86);color:#e8e8e0;font:11px/1.35 monospace;padding:6px 8px;box-sizing:border-box}
#ndbg.right{left:auto;right:0}#ndbg.min{bottom:auto;overflow:hidden;width:230px}#ndbg.min .body{display:none}
#ndbg h1{font:700 12px monospace;margin:0 0 4px;cursor:pointer}#ndbg details{margin:5px 0;border-top:1px solid #444;padding-top:3px}#ndbg summary{cursor:pointer;font-weight:700;color:#ffd24a}
#ndbg .row{display:grid;grid-template-columns:208px 1fr 58px;gap:4px;align-items:center;margin:1px 0}#ndbg .row label{cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#ndbg .row input[type=range]{width:100%;margin:0}#ndbg .row input[type=number]{width:58px;background:#222;color:#eee;border:1px solid #555;font:11px monospace}
#ndbg button{background:#333;color:#eee;border:1px solid #666;margin:1px 2px 1px 0;padding:2px 6px;font:11px monospace;cursor:pointer}#ndbg button.on{background:#ffd24a;color:#111}
#ndbg textarea{width:100%;height:96px;background:#111;color:#cfc;border:1px solid #555;font:10px monospace;box-sizing:border-box}`;
  document.head.appendChild(css);
  const el = NDBG.el = document.createElement('div'); el.id = 'ndbg';
  // le jeu ne doit rien recevoir de ce qu'on fait dans le panneau
  for (const t of ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup', 'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation());
  const h = document.createElement('h1'); h.textContent = 'Banc de réglage des grenades et du couteau de lancer (clic : replier)'; h.onclick = () => el.classList.toggle('min'); el.appendChild(h);
  const body = document.createElement('div'); body.className = 'body'; el.appendChild(body);
  const mk = (tag, o = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, o); for (const k of kids) e.appendChild(k); return e; };
  const btn = (txt, fn, cls) => { const b = mk('button', { textContent: txt, onclick: fn }); if (cls) b.className = cls; return b; };
  const chk = (txt, key) => { const c = mk('input', { type: 'checkbox', checked: !!NDBG[key], onchange: () => { NDBG[key] = c.checked; } }), lb = mk('label', {}, [c, document.createTextNode(' ' + txt + ' ')]); lb.cb = c; return lb; };
  // type tenu
  const trow = mk('div', {}, [mk('span', { textContent: 'Équipement : ' })]);
  NDBG.typeBtns = NADE_IDS.map((id) => { const b = btn(NADE_TYPES[id].name, () => ndbgType(id)); b.dataset.ty = id; trow.appendChild(b); return b; });
  body.appendChild(trow);
  // modes
  const modes = [['jeu', 'Jeu'], ['tenue', 'Tenue'], ['pull', 'Dégoupillage'], ['throw', 'Lancer']], mb = {};
  const setMode = (m) => { NDBG.mode = m; for (const k in mb) mb[k].classList.toggle('on', k === m); };
  const mrow = mk('div');
  for (const [m, n] of modes) { mb[m] = btn(n, () => setMode(m)); mrow.appendChild(mb[m]); }
  body.appendChild(mrow); setMode(NDBG.mode);
  const l = chk('en boucle', 'loop');
  const tr = mk('input', { type: 'range', min: 0, max: 1, step: 0.01, value: NDBG.t, oninput: () => { NDBG.t = +tr.value; NDBG.loop = false; l.cb.checked = false; } }); NDBG.tEl = tr;
  body.append(mk('div', { textContent: 'Dégoupillage, lancer : instant (0 à 1)' }), tr, l);
  // outils
  const tools = mk('div', { style: 'margin-top:4px' });
  tools.append(
    btn('Figer les bots', function () { if (NDBG.bots) { botsTick = NDBG.bots; NDBG.bots = null; } else { NDBG.bots = botsTick; botsTick = () => {}; } this.classList.toggle('on', !!NDBG.bots); }),
    btn('Cacher l\'interface', function () { const hud = $('hud'); hud.style.display = hud.style.display === 'none' ? '' : 'none'; this.classList.toggle('on', hud.style.display === 'none'); }),
    btn('Verrouiller la vue', function () { NDBG.lookLock = !NDBG.lookLock; this.classList.toggle('on', NDBG.lookLock); }),
    btn('Regarder la main', () => { PL.pitch = -0.1; }), // la tenue est en haut à droite : un regard presque à plat la garde dans le champ
    btn('Panneau à droite / à gauche', () => el.classList.toggle('right')),
    btn('Rendre la main au jeu', () => { if (document.activeElement) document.activeElement.blur(); }),
    btn('Banc du couteau de corps à corps', () => { location.search = '?couteau=1'; }), // (?couteau=1, 09zk-couteau-reglage.js : la main qui tient le couteau du combat rapproché)
    chk('invincible', 'god'));
  body.appendChild(tools);
  // réglages
  for (const [title, list, type, thumbRoot] of NDBG_SPEC()) {
    const first = /dans la main|pouce/.test(title);
    const d = mk('details', { open: !type || (type === NDBG.type && first) }, [mk('summary', { textContent: title })]);
    NDBG.secs.push({ d, type, first });
    for (const [path, label, min, max, step] of list) {
      const def = ndbgGet(path), row = mk('div', { className: 'row' });
      const lab = mk('label', { textContent: label, title: label + ' (clic : valeur du code)' });
      const input = mk('input', { type: 'range', min, max, step, value: def }), num = mk('input', { type: 'number', min, max, step, value: +def.toFixed(4) });
      input.oninput = () => { ndbgSet(path, +input.value); num.value = +(+input.value).toFixed(4); };
      num.onchange = () => { if (!Number.isFinite(+num.value)) return; ndbgSet(path, +num.value); input.value = num.value; };
      lab.onclick = () => { ndbgSet(path, ndbgDefault(path)); ndbgRefresh(); };
      row.append(lab, input, num); NDBG.rows.push({ path, input, num });
      d.appendChild(row);
    }
    if (thumbRoot) { // poses de départ du pouce : celle des grenades, puis celles du couteau
      const pr = mk('div');
      for (const [n, t] of [['Pose de départ des grenades', [0.35, 0.3, 0.8, 0.8, 0, 0, 0, 0]], ...KDBG_THUMBS]) pr.appendChild(btn(n, () => { for (let j = 0; j < 8; j++) ndbgSet(`${thumbRoot}.t.${j}`, t[j]); ndbgRefresh(); }));
      d.insertBefore(pr, d.children[1]);
    }
    if (type && title.includes('dans la main')) { // recopier la prise et les doigts d'un autre type
      const cp = mk('div');
      for (const o of NADE_IDS) if (o !== type) cp.appendChild(btn(`Prendre la prise de : ${NADE_TYPES[o].name}`, () => {
        kdbgMerge(NADE_GRIP[type], JSON.parse(JSON.stringify(NADE_GRIP[o]))); kdbgMerge(HAND_POSES['n' + type], JSON.parse(JSON.stringify(HAND_POSES['n' + o]))); ndbgRefresh(); ndbgSave();
      }));
      d.insertBefore(cp, d.children[1]);
    }
    body.appendChild(d);
  }
  // configuration : copier, appliquer, tout remettre
  const cfg = mk('details', { open: true }, [mk('summary', { textContent: 'Configuration (à coller dans la conversation)' })]);
  const ta = NDBG.ta = mk('textarea', { spellcheck: false }); NDBG.msg = mk('div');
  cfg.append(ta, btn('Copier', async () => {
    const t = ndbgText(); ta.value = t; ta.select(); let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
    ndbgSay(ok ? 'Copié dans le presse-papiers.' : 'Texte sélectionné ci-dessus : Ctrl+C.');
  }), btn('Appliquer le texte', () => { try { ndbgLoad(ta.value); ndbgSay('Appliqué.'); } catch (e) { ndbgSay('Texte illisible : ' + e.message); } }),
  btn('Tout remettre', () => { ndbgLoad(JSON.stringify(NDBG.def)); ta.value = ''; ndbgSay('Configuration du code rétablie.'); }), NDBG.msg);
  body.appendChild(cfg);
  document.body.appendChild(el);
  ndbgRefresh(); ndbgType(NDBG.type);
  // vue verrouillée : le regard ne suit plus la souris, ce qui laisse la main libre de toucher le panneau sans quitter la scène des yeux
  addEventListener('mousemove', (e) => { if (NDBG.lookLock) e.stopImmediatePropagation(); }, true);
}
if (NDBG_ON) setTimeout(ndbgInit, 0);
