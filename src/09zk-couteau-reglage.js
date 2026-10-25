/* ==========================================================================
   BANC DE RÉGLAGE DU COUTEAU EN MAIN (outil de développement, README « Couteau en main »)
   Le jeu s'ouvre avec ?couteau=1 (https://playriposte-dev.vercel.app/?couteau=1) : un panneau à gauche règle en direct, sur la vraie vue subjective, la pose du bras, du
   couteau dans la main, des doigts et de la course. On lance une partie solo, on sort le couteau (F maintenu ou le bouton du panneau), et chaque curseur agit tout de suite.
   - Jeu : on joue normalement (marcher, courir, frapper pour de bon). Repos, Course et Coup forcent la pose, même à l'arrêt : la foulée peut être figée ou jouée, le coup
     figé à un instant ou rejoué en boucle (à mains nues : le coup d'origine, sans la pose tenue).
   - Copier : toute la configuration en un texte (KNIFE_HELD, KNIFE_STAB et HAND_POSES.kgrip), à coller dans la conversation ; Appliquer : l'inverse. La configuration est gardée dans le
     navigateur (localStorage, dc_couteau) tant que le panneau est ouvert, « Tout remettre » revient à celle du code.
   - La souris reste libre (LOCK.fallback) : le panneau arrête les évènements qu'il reçoit, le jeu ne tourne ni ne tire quand on touche un curseur. « Verrouiller la vue » fige
     le regard hors du panneau.
   Le code ne fait rien sans ?couteau=1 : le panneau, ses évènements et le crochet KNIFE_DEBUG (06c-models.js, 08-player.js) n'existent pas pour un joueur.
   ========================================================================== */
const KDBG_ON = /[?&]couteau=1(&|$)/.test(location.search);
const KDBG = { mode: 'jeu', anim: true, ph: 0, t: 0.34, loop: true, bare: false, clock: 0, god: true, bots: null, lookLock: false, def: null, el: null, rows: [], ta: null, msg: null };

/* Les réglages : [chemin, libellé, min, max, pas] ; 'bool' à la place du min : une case. Chemin : H = KNIFE_HELD, G = HAND_POSES.kgrip, K = KNIFE_STAB, puis les clés (un nombre : l'indice d'un tableau) */
/* Les réglages d'une pose complète : P le chemin du bras (poignet, roulis, flexion, coude, épaule), GR celui de la prise du couteau, FG celui des doigts ; deux fois les mêmes, pour la pose
   tenue (H, H.grip, G) et pour le début et la fin du coup (K.start, K.start.grip, K.start.fingers...). Le dernier élément d'une section de pouce dit où poser les poses de départ. */
function kdbgPoseSpec(label, P, GR, FG, held) {
  const f = (path, lab, mn, mx, st) => [path, lab, mn, mx, st];
  return [
    [`${label}bras (le poignet est en mètres, repère de la caméra)`, [
      f(`${P}.pos.0`, 'poignet x (droite)', -0.6, 0.6, 0.005), f(`${P}.pos.1`, 'poignet y (haut)', -0.6, 0.4, 0.005), f(`${P}.pos.2`, 'poignet z (loin : négatif)', -0.9, -0.1, 0.005),
      f(`${P}.roll`, 'roulis avant-bras (-1,57 : pouce en haut)', -3.2, 3.2, 0.02), f(`${P}.flex`, 'flexion du poignet (rad)', -1.2, 1.2, 0.02),
      f(`${P}.pole.0`, 'coude x', -2, 2, 0.05), f(`${P}.pole.1`, 'coude y (bas : négatif)', -2, 2, 0.05), f(`${P}.pole.2`, 'coude z', -2, 2, 0.05),
      f(`${P}.S.0`, 'épaule x', -0.8, 0.8, 0.01), f(`${P}.S.1`, 'épaule y', -0.8, 0.4, 0.01), f(`${P}.S.2`, 'épaule z', -0.2, 0.8, 0.01),
    ]],
    [`${label}couteau dans la main (degrés ; repère de la main : x petit doigt, y dos de la main, z coude)`, [
      ...(held ? [[`${GR}.flip`, 'prise inversée (lame côté petit doigt)', 'bool']] : []), f(`${GR}.phi`, 'angle dans la paume (axe y)', -180, 180, 1),
      f(`${GR}.pitch`, 'bascule en travers du poing (axe x)', -180, 180, 1), f(`${GR}.tilt`, 'inclinaison autour de l\'avant-bras (z)', -180, 180, 1), f(`${GR}.roll`, 'tour sur le manche', -180, 180, 1),
      f(`${GR}.mid.0`, 'milieu du manche x', -0.08, 0.08, 0.001), f(`${GR}.mid.1`, 'milieu du manche y (paume : négatif)', -0.08, 0.08, 0.001), f(`${GR}.mid.2`, 'milieu du manche z (doigts : négatif)', -0.08, 0.08, 0.001),
    ]],
    [`${label}doigts (flexion en rad : base, milieu, bout ; 0 tendu)`, [
      ...[['i', 'index'], ['m', 'majeur'], ['r', 'annulaire'], ['p', 'auriculaire']].flatMap(([k, n]) => [['base', 0], ['milieu', 1], ['bout', 2]].map(([b, j]) => f(`${FG}.${k}.${j}`, `${n} ${b}`, 0, 1.9, 0.01))),
      f(`${FG}.spread`, 'écart des doigts', 0, 0.3, 0.005),
    ]],
    [`${label}pouce (rad ; la base pivote en huit sens, du plus naturel au plus libre)`, [
      f(`${FG}.t.0`, 'milieu du pouce : flexion', -3, 3, 0.01), f(`${FG}.t.1`, 'bout du pouce : flexion', -3, 3, 0.01),
      f(`${FG}.t.2`, 'base : vers l\'auriculaire', -3, 3, 0.01), f(`${FG}.t.3`, 'base : écart hors de la paume', -3, 3, 0.01), f(`${FG}.t.4`, 'base : tour sur lui-même (l\'ongle)', -3, 3, 0.01),
      f(`${FG}.t.5`, 'base : pivot sur x (en travers)', -3.2, 3.2, 0.02), f(`${FG}.t.6`, 'base : pivot sur y (dos de la main)', -3.2, 3.2, 0.02), f(`${FG}.t.7`, 'base : pivot sur z (avant-bras)', -3.2, 3.2, 0.02),
    ], FG],
  ];
}
const KDBG_SPEC = [
  ...kdbgPoseSpec('Pose tenue : ', 'H', 'H.grip', 'G', true),
  ['Coup : temps et trajectoire (de la pose tenue au début, du début à la fin, puis retour)', [
    ['K.tStart', 'début atteint à (0 à 1 de la durée du coup)', 0.02, 0.6, 0.01], ['K.tEnd', 'fin atteinte à', 0.1, 0.95, 0.01], ['K.ease', 'balayage : 0 constant, 1 doux au départ et à l\'arrivée', 0, 1, 0.05],
    ['K.arc.0', 'détour au milieu du balayage x', -0.3, 0.3, 0.005], ['K.arc.1', 'détour au milieu du balayage y', -0.3, 0.3, 0.005], ['K.arc.2', 'détour au milieu du balayage z', -0.3, 0.3, 0.005],
    ['K.low.0', 'sans couteau en main : la main monte d\'en bas, x', -0.6, 0.6, 0.01], ['K.low.1', 'monte d\'en bas, y', -0.8, 0.2, 0.01], ['K.low.2', 'monte d\'en bas, z', -0.6, 0.2, 0.01],
    ['K.rise.0', 'montée : début (0 à 1)', 0, 1, 0.01], ['K.rise.1', 'montée : fin', 0, 1, 0.01], ['K.fall.0', 'descente : début', 0, 1, 0.01], ['K.fall.1', 'descente : fin', 0, 1, 0.01],
  ]],
  ...kdbgPoseSpec('Début du coup : ', 'K.start', 'K.start.grip', 'K.start.fingers', false),
  ...kdbgPoseSpec('Fin du coup : ', 'K.end', 'K.end.grip', 'K.end.fingers', false),
  ['Course (écart à fond de sprint, puis amplitude des foulées)', [
    ['H.run.pos.0', 'décalage x', -0.3, 0.3, 0.005], ['H.run.pos.1', 'décalage y', -0.3, 0.3, 0.005], ['H.run.pos.2', 'décalage z', -0.3, 0.3, 0.005],
    ['H.run.roll', 'roulis', -1.5, 1.5, 0.02], ['H.run.flex', 'flexion', -1, 1, 0.02],
    ['H.run.amp.0', 'foulée : va-et-vient latéral', 0, 0.1, 0.002], ['H.run.amp.1', 'foulée : creux de chaque pas', 0, 0.1, 0.002], ['H.run.amp.2', 'foulée : le bras qui pompe', 0, 0.1, 0.002],
    ['H.run.rouler', 'foulée : roulis du poignet', 0, 0.5, 0.01], ['H.run.flexAmp', 'foulée : flexion du poignet', 0, 0.5, 0.01], ['H.run.phase', 'phase de la foulée (rad)', -3.2, 3.2, 0.05],
  ]],
];

/* Poses de départ du pouce (les huit angles de HAND_POSES.kgrip.t) : à choisir puis à affiner avec les curseurs */
const KDBG_THUMBS = [
  ['Caché derrière le manche', [0.8, 0.9, 0.5, -0.2, -1.2, 0, 0, 0]], ['Posé sur le manche, vers la garde', [0.2, 0.3, 0.2, 0.5, 0, 0, 0, 0]],
  ['Par-dessus le poing', [0.35, 0.5, 0.9, 0.55, -0.9, 0, 0, 0.8]], ['Pouce du fusil (en travers)', [0.35, 0.5, 0.9, 0.55, -0.9, 0, 0, 0]],
];
/* La pose tenue sous la forme d'une pose du coup (pour recopier la pose tenue dans le début ou la fin) */
function kdbgHeldPose() {
  const H = JSON.parse(JSON.stringify(KNIFE_HELD)), G = JSON.parse(JSON.stringify(HAND_POSES.kgrip));
  return { pos: H.pos, roll: H.roll, flex: H.flex, pole: H.pole, S: H.S, grip: { phi: H.grip.phi, tilt: H.grip.tilt, pitch: H.grip.pitch, roll: H.grip.roll, mid: H.grip.mid }, fingers: G };
}
function kdbgRef(path) { // 'H.pos.0' : [tableau ou objet, clé]
  const k = path.split('.'); let o = k[0] === 'H' ? KNIFE_HELD : k[0] === 'K' ? KNIFE_STAB : HAND_POSES.kgrip;
  for (let i = 1; i < k.length - 1; i++) o = o[k[i]];
  return [o, k[k.length - 1]];
}
function kdbgGet(path) { const [o, k] = kdbgRef(path); return o[k]; }
function kdbgSet(path, v) { const [o, k] = kdbgRef(path); o[k] = v; if (path.startsWith('H.grip')) knifeGripSet(); kdbgSave(); }
const kdbgSnap = () => JSON.parse(JSON.stringify({ KNIFE_HELD, KNIFE_STAB, kgrip: HAND_POSES.kgrip }));
/* le texte copié : une ligne par ensemble, nombres à quatre décimales */
function kdbgText() {
  const s = kdbgSnap(), f = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? +x.toFixed(4) : x));
  return `{\n"KNIFE_HELD": ${f(s.KNIFE_HELD)},\n"KNIFE_STAB": ${f(s.KNIFE_STAB)},\n"kgrip": ${f(s.kgrip)}\n}`;
}
/* reprend dans dst les valeurs de src pour les clés que dst connaît, de même type (rien d'autre n'entre) */
function kdbgMerge(dst, src) {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(dst)) {
    if (!(k in src)) continue;
    const a = dst[k], b = src[k];
    if (Array.isArray(a)) { if (Array.isArray(b)) for (let i = 0; i < a.length; i++) { if (Array.isArray(a[i])) { if (Array.isArray(b[i])) for (let j = 0; j < a[i].length; j++) if (Number.isFinite(b[i][j])) a[i][j] = b[i][j]; } else if (Number.isFinite(b[i])) a[i] = b[i]; } }
    else if (a && typeof a === 'object') kdbgMerge(a, b);
    else if (typeof a === 'number') { if (Number.isFinite(b)) dst[k] = b; }
    else if (typeof a === 'boolean') dst[k] = !!b;
  }
}
function kdbgLoad(text) {
  const c = JSON.parse(text);
  kdbgMerge(KNIFE_HELD, c.KNIFE_HELD); kdbgMerge(KNIFE_STAB, c.KNIFE_STAB); kdbgMerge(HAND_POSES.kgrip, c.kgrip); knifeGripSet(); kdbgRefresh(); kdbgSave();
}
function kdbgSave() { try { localStorage.setItem('dc_couteau', kdbgText()); } catch (e) { /* stockage refusé : la configuration ne survit pas au rechargement */ } }
function kdbgSay(t) { if (KDBG.msg) KDBG.msg.textContent = t; }

/* Ce que le panneau force dans l'état de la main (appelé par updatePlayer, 08-player.js, juste avant updateRigs) */
function kdbgFilter(S, dt) {
  const K = KDBG;
  if (K.god) PL.ent.health = 100;
  if (K.lookLock) { mouseDX = 0; mouseDY = 0; }
  if (K.mode === 'jeu' || !PL.ent.alive) return;
  if (!PL.knifeOut) knifeDraw();
  S.nadeState = null; S.knifeHold = K.bare && K.mode === 'coup' ? 0 : 1; S.knifeNew = true; VM.lowerTarget = 1; // le coup réglé est celui du couteau en main
  const still = () => { VM.bobAmt = 0; VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0); };
  if (K.mode === 'repos') { S.knifeT = 0; S.sprint = 0; still(); }
  else if (K.mode === 'course') {
    S.knifeT = 0; S.sprint = 1; VM.bobAmt = 1.2;
    if (K.anim) K.ph = (K.ph + dt * 9) % TAU; else { VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0); }
    VM.bobT = K.ph;
    if (K.phEl) K.phEl.value = K.ph;
  } else if (K.mode === 'coup') {
    S.sprint = 0; still();
    let t = K.t;
    if (K.loop) { K.clock = (K.clock + dt) % (KNIFE_DUR + 0.7); t = K.clock / KNIFE_DUR; if (K.tEl) K.tEl.value = Math.min(1, t); }
    S.knifeT = t >= 0 && t <= 1 ? Math.max(0.0001, KNIFE_DUR * (1 - t)) : 0;
  }
}

function kdbgRefresh() {
  for (const r of KDBG.rows) { const v = kdbgGet(r.path); if (r.bool) r.input.checked = !!v; else { r.input.value = v; r.num.value = +v.toFixed(4); } }
}
function kdbgInit() {
  if (KDBG.el) return;
  KDBG.def = kdbgSnap();
  LOCK.fallback = true; showLockPrompt(false); // la souris reste libre : on touche des curseurs
  try { const s = localStorage.getItem('dc_couteau'); if (s) kdbgLoad(s); } catch (e) { /* configuration gardée illisible : celle du code */ }
  KNIFE_DEBUG = kdbgFilter;
  const css = document.createElement('style');
  css.textContent = `#kdbg{position:fixed;left:0;top:0;bottom:0;width:420px;z-index:100000;overflow:auto;background:rgba(8,10,8,.86);color:#e8e8e0;font:11px/1.35 monospace;padding:6px 8px;box-sizing:border-box}
#kdbg.right{left:auto;right:0}#kdbg.min{bottom:auto;overflow:hidden;width:230px}#kdbg.min .body{display:none}
#kdbg h1{font:700 12px monospace;margin:0 0 4px;cursor:pointer}#kdbg details{margin:5px 0;border-top:1px solid #444;padding-top:3px}#kdbg summary{cursor:pointer;font-weight:700;color:#ffd24a}
#kdbg .row{display:grid;grid-template-columns:208px 1fr 58px;gap:4px;align-items:center;margin:1px 0}#kdbg .row label{cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#kdbg .row input[type=range]{width:100%;margin:0}#kdbg .row input[type=number]{width:58px;background:#222;color:#eee;border:1px solid #555;font:11px monospace}
#kdbg button{background:#333;color:#eee;border:1px solid #666;margin:1px 2px 1px 0;padding:2px 6px;font:11px monospace;cursor:pointer}#kdbg button.on{background:#ffd24a;color:#111}
#kdbg textarea{width:100%;height:96px;background:#111;color:#cfc;border:1px solid #555;font:10px monospace;box-sizing:border-box}`;
  document.head.appendChild(css);
  const el = KDBG.el = document.createElement('div'); el.id = 'kdbg';
  // le jeu ne doit rien recevoir de ce qu'on fait dans le panneau
  for (const t of ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup', 'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation());
  const h = document.createElement('h1'); h.textContent = 'Banc de réglage du couteau (clic : replier)'; h.onclick = () => el.classList.toggle('min'); el.appendChild(h);
  const body = document.createElement('div'); body.className = 'body'; el.appendChild(body);
  const mk = (tag, o = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, o); for (const k of kids) e.appendChild(k); return e; };
  const btn = (txt, fn, cls) => { const b = mk('button', { textContent: txt, onclick: fn }); if (cls) b.className = cls; return b; };
  // modes
  const modes = [['jeu', 'Jeu'], ['repos', 'Repos'], ['course', 'Course'], ['coup', 'Coup']], mb = {};
  const setMode = (m) => { KDBG.mode = m; for (const k in mb) mb[k].classList.toggle('on', k === m); };
  const mrow = mk('div');
  for (const [m, n] of modes) { mb[m] = btn(n, () => setMode(m)); mrow.appendChild(mb[m]); }
  body.appendChild(mrow); setMode('jeu');
  const chk = (txt, key, fn) => { const c = mk('input', { type: 'checkbox', checked: !!KDBG[key], onchange: () => { KDBG[key] = c.checked; if (fn) fn(); } }), lb = mk('label', {}, [c, document.createTextNode(' ' + txt + ' ')]); lb.cb = c; return lb; };
  const rng = (txt, key, max, step, ref) => { const r = mk('input', { type: 'range', min: 0, max, step, value: KDBG[key], oninput: () => { KDBG[key] = +r.value; if (key === 'ph') { KDBG.anim = false; a.cb.checked = false; } if (key === 't') { KDBG.loop = false; l.cb.checked = false; } } }); KDBG[ref] = r; return [mk('div', { textContent: txt }), r]; };
  const a = chk('animée', 'anim'), l = chk('en boucle', 'loop');
  const [t1, r1] = rng('Course : foulée (rad)', 'ph', 6.3, 0.05, 'phEl'), [t2, r2] = rng('Coup : instant (0 armé, 1 retour)', 't', 1, 0.01, 'tEl');
  const keyRow = mk('div'), see = (txt, get) => btn(txt, () => { setMode('coup'); KDBG.loop = false; l.cb.checked = false; KDBG.t = get(); r2.value = KDBG.t; });
  keyRow.append(see('Voir le début', () => KNIFE_STAB.tStart), see('Voir le contact', () => KNIFE_HIT), see('Voir la fin', () => KNIFE_STAB.tEnd));
  body.append(t1, r1, a, t2, r2, l, chk('à mains nues (la main monte d\'en bas)', 'bare'), keyRow);
  // outils
  const tools = mk('div', { style: 'margin-top:4px' });
  tools.append(
    btn('Sortir / ranger le couteau', () => { if (PL.knifeOut) knifeStow(PL.cur); else knifeDraw(); }),
    btn('Figer les bots', function () { if (KDBG.bots) { botsTick = KDBG.bots; KDBG.bots = null; } else { KDBG.bots = botsTick; botsTick = () => {}; } this.classList.toggle('on', !!KDBG.bots); }),
    btn('Cacher l\'interface', function () { const hud = $('hud'); hud.style.display = hud.style.display === 'none' ? '' : 'none'; this.classList.toggle('on', hud.style.display === 'none'); }),
    btn('Verrouiller la vue', function () { KDBG.lookLock = !KDBG.lookLock; this.classList.toggle('on', KDBG.lookLock); }),
    btn('Panneau à droite / à gauche', () => el.classList.toggle('right')), // le début du coup se joue à gauche, sa fin à droite : le panneau se met de l'autre côté
    btn('Rendre la main au jeu', () => { if (document.activeElement) document.activeElement.blur(); }),
    btn('Banc des grenades et du couteau de lancer', () => { location.search = '?grenade=1'; }), // (?grenade=1, 09zj-grenade-reglage.js)
    chk('invincible', 'god'));
  body.appendChild(tools);
  // réglages
  for (const [title, list, thumbRoot] of KDBG_SPEC) {
    const d = mk('details', { open: /^Pose tenue : (bras|couteau|pouce)|^Coup : temps/.test(title) }, [mk('summary', { textContent: title })]);
    for (const [path, label, min, max, step] of list) {
      const def = kdbgGet(path), row = mk('div', { className: 'row' });
      const lab = mk('label', { textContent: label, title: label + ' (clic : valeur du code)' });
      if (min === 'bool') {
        const input = mk('input', { type: 'checkbox', checked: !!def, onchange: () => kdbgSet(path, input.checked) });
        lab.onclick = () => { kdbgSet(path, !!kdbgDefault(path)); kdbgRefresh(); };
        row.append(lab, input, mk('span')); KDBG.rows.push({ path, input, bool: true });
      } else {
        const input = mk('input', { type: 'range', min, max, step, value: def }), num = mk('input', { type: 'number', min, max, step, value: +def.toFixed(4) });
        input.oninput = () => { kdbgSet(path, +input.value); num.value = +(+input.value).toFixed(4); };
        num.onchange = () => { if (!Number.isFinite(+num.value)) return; kdbgSet(path, +num.value); input.value = num.value; };
        lab.onclick = () => { kdbgSet(path, kdbgDefault(path)); kdbgRefresh(); };
        row.append(lab, input, num); KDBG.rows.push({ path, input, num });
      }
      d.appendChild(row);
    }
    if (thumbRoot) {
      const pr = mk('div');
      for (const [n, t] of KDBG_THUMBS) pr.appendChild(btn(n, () => { for (let j = 0; j < 8; j++) kdbgSet(`${thumbRoot}.t.${j}`, t[j]); kdbgRefresh(); }));
      d.insertBefore(pr, d.children[1]);
    }
    if (title.startsWith('Coup : temps')) { // recopier une pose dans une autre : partir de la pose tenue, ou de l'autre bout du coup
      const cp = mk('div'), put = (to, from) => () => { kdbgMerge(KNIFE_STAB[to], from()); kdbgRefresh(); kdbgSave(); };
      cp.append(btn('Début : prendre la pose tenue', put('start', kdbgHeldPose)), btn('Fin : prendre la pose tenue', put('end', kdbgHeldPose)),
        btn('Fin : prendre le début', put('end', () => JSON.parse(JSON.stringify(KNIFE_STAB.start)))), btn('Début : prendre la fin', put('start', () => JSON.parse(JSON.stringify(KNIFE_STAB.end)))));
      d.insertBefore(cp, d.children[1]);
    }
    body.appendChild(d);
  }
  // configuration : copier, appliquer, tout remettre
  const cfg = mk('details', { open: true }, [mk('summary', { textContent: 'Configuration (à coller dans la conversation)' })]);
  const ta = KDBG.ta = mk('textarea', { spellcheck: false }); KDBG.msg = mk('div');
  cfg.append(ta, btn('Copier', async () => {
    const t = kdbgText(); ta.value = t; ta.select(); let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
    kdbgSay(ok ? 'Copié dans le presse-papiers.' : 'Texte sélectionné ci-dessus : Ctrl+C.');
  }), btn('Appliquer le texte', () => { try { kdbgLoad(ta.value); kdbgSay('Appliqué.'); } catch (e) { kdbgSay('Texte illisible : ' + e.message); } }),
  btn('Tout remettre', () => { kdbgLoad(JSON.stringify(KDBG.def)); ta.value = ''; kdbgSay('Configuration du code rétablie.'); }), KDBG.msg);
  body.appendChild(cfg);
  document.body.appendChild(el);
  kdbgRefresh();
  // vue verrouillée : le regard ne suit plus la souris, ce qui laisse la main libre de toucher le panneau sans quitter la scène des yeux
  addEventListener('mousemove', (e) => { if (KDBG.lookLock) e.stopImmediatePropagation(); }, true);
}
function kdbgDefault(path) { let v = KDBG.def; const k = path.split('.'); v = k[0] === 'H' ? v.KNIFE_HELD : k[0] === 'K' ? v.KNIFE_STAB : v.kgrip; for (let i = 1; i < k.length; i++) v = v[k[i]]; return v; }
if (KDBG_ON) setTimeout(kdbgInit, 0);
