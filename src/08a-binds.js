/* ==========================================================================
   TOUCHES DU CLAVIER
   Chaque action du joueur a une touche par défaut (BIND_DEFS) ; Options, Commandes permet d'en choisir une autre (Settings.binds :
   action => code de touche, seulement les écarts). Le reste du jeu continue de lire les touches par défaut (KEYS.KeyW, 'KeyR'...) : onKey
   passe chaque touche par keyCanon, qui renvoie la touche par défaut de l'action à laquelle elle est liée (ou '' pour une touche par défaut
   libérée, qui ne commande plus rien). Les commandes tactiles et la manette, qui écrivent directement KEYS.Space, ne sont pas concernées.
   Touches réservées (non liables) : Échap, P (pause), T (discussion), Entrée (passer la killcam), touches de fonction.
   Hors plein écran, le navigateur garde certains raccourcis (Ctrl+W, Ctrl+N, Ctrl+T) : ils ne s'écartent que par le verrouillage du
   clavier (syncKeyboardLock, 09-game.js), qui porte sur Échap et sur toutes les touches liées ; le reste est refusé par bindGuard.
   ========================================================================== */
const BIND_DEFS = [
  ['fwd', 'KeyW', _t('Avancer')], ['back', 'KeyS', _t('Reculer')], ['left', 'KeyA', _t('Aller à gauche')], ['right', 'KeyD', _t('Aller à droite')],
  ['jump', 'Space', _t('Sauter')], ['sprint', 'ShiftLeft', _t('Sprinter, retenir son souffle en lunette')],
  ['crouch', 'ControlLeft', _t('S\u0027accroupir (maintenu), glisser en sprintant')], ['crouchT', 'KeyC', _t('S\u0027accroupir (bascule), glisser en sprintant')],
  ['reload', 'KeyR', _t('Recharger')], ['w1', 'Digit1', _t('Arme principale')], ['w2', 'Digit2', _t('Arme secondaire')], ['swap', 'KeyQ', _t('Changer d\u0027arme')],
  ['knife', 'KeyF', _t('Couteau (maintenir pour le garder en main)')], ['nade', 'KeyG', _t('Grenade (maintenir pour la garder en main)')], ['use', 'KeyE', _t('Ramasser l\u0027arme au sol')], ['inspect', 'KeyI', _t('Inspecter l\u0027arme')],
  ['ks1', 'Digit4', _t('Première série')], ['ks2', 'Digit5', _t('Deuxième série')], ['ks3', 'Digit6', _t('Troisième série')], ['board', 'Tab', _t('Tableau des scores')],
];
const BIND_RESERVED = new Set(['Escape', 'KeyP', 'KeyT', 'Enter', 'NumpadEnter', 'MetaLeft', 'MetaRight', 'ContextMenu', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const BIND = { rev: new Map(), dead: new Set(), layout: null, capture: null };
const bindDefault = (a) => BIND_DEFS.find((d) => d[0] === a)[1];
const bindValid = (c) => typeof c === 'string' && /^[A-Za-z0-9]{1,20}$/.test(c) && !BIND_RESERVED.has(c) && !/^F\d{1,2}$/.test(c);
function bindOf(a) { const o = Settings.binds && Settings.binds[a]; return bindValid(o) ? o : bindDefault(a); }
function bindRebuild() {
  BIND.rev = new Map(); BIND.dead = new Set();
  for (const [a, def] of BIND_DEFS) { const c = bindOf(a); if (!BIND.rev.has(c)) BIND.rev.set(c, def); } // deux actions sur la même touche : la première l'emporte
  for (const [a, def] of BIND_DEFS) if (!BIND.rev.has(def)) BIND.dead.add(def);                         // touche par défaut libérée : elle ne fait plus rien
}
function keyCanon(code) { if (BIND.rev.has(code)) return BIND.rev.get(code); return BIND.dead.has(code) ? '' : code; }
/* Touches à garder pour le jeu quand le clavier est verrouillé (plein écran) */
function bindCodes() { return ['Escape', ...BIND_DEFS.map((d) => bindOf(d[0])), 'ShiftLeft', 'ControlLeft']; }
/* Nom lisible : celui de la disposition du clavier quand le navigateur la donne (AZERTY, QWERTZ...), sinon d'après le code */
function keyLabel(code) {
  const L = BIND.layout && BIND.layout.get(code);
  if (L && L.length === 1) return L.toUpperCase();
  const m = /^(Key|Digit)(.)$/.exec(code); if (m) return m[2];
  const names = { Space: _t('Espace'), ShiftLeft: _t('Maj gauche'), ShiftRight: _t('Maj droite'), ControlLeft: _t('Ctrl gauche'), ControlRight: _t('Ctrl droite'), AltLeft: _t('Alt gauche'), AltRight: _t('Alt droite'), Tab: _t('Tab'), CapsLock: _t('Verr. maj'), Backquote: '²', Backspace: _t('Retour arrière') };
  return names[code] || (/^Numpad/.test(code) ? _t('Pavé {0}', code.slice(6)) : code);
}
/* Lie une action à une touche : si une autre action l'avait, elle prend l'ancienne touche de celle-ci (échange) */
function bindSet(a, code) {
  if (!bindValid(code)) return false;
  Settings.binds = Settings.binds || {};
  const old = bindOf(a), other = BIND_DEFS.find((d) => d[0] !== a && bindOf(d[0]) === code);
  if (other) Settings.binds[other[0]] = old;
  Settings.binds[a] = code;
  for (const k of Object.keys(Settings.binds)) if (Settings.binds[k] === bindDefault(k)) delete Settings.binds[k]; // seulement les écarts
  saveSettings(); bindRebuild(); for (const k in KEYS) KEYS[k] = false; syncKeyboardLock();
  return true;
}
function bindReset() { Settings.binds = {}; saveSettings(); bindRebuild(); for (const k in KEYS) KEYS[k] = false; syncKeyboardLock(); }
if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { BIND.layout = m; }).catch(() => { /* disposition inconnue */ });
bindRebuild();

/* Raccourcis du navigateur pendant la partie (Ctrl+Maj+lettre ouvre une fenêtre, une recherche d'onglets ou fait sortir la souris du jeu) :
   tant que la souris est captée, toute combinaison avec Ctrl ou Alt est retenue par le jeu. Les raccourcis réservés au navigateur (Ctrl+W, Ctrl+N,
   Ctrl+T) ne s'écartent que clavier verrouillé, en plein écran. */
function bindGuard(e) {
  if (!(e.ctrlKey || e.altKey) || MATCH.state === 'menu' || !pointerActive() || CHAT.open) return;
  if (e.code === 'F12' || e.code === 'F11') return; // outils de développement et plein écran restent à l'utilisateur
  e.preventDefault();
}
addEventListener('keydown', bindGuard, true);
addEventListener('keyup', bindGuard, true);

/* Éditeur des touches (Options, Commandes) : une ligne par action, un clic puis la touche voulue ; Échap annule, Retour arrière remet celle par défaut */
function bindEditor(root) {
  const h = document.createElement('dl'); h.className = 'keys binds'; const note = document.createElement('p');
  const draw = () => {
    h.innerHTML = '';
    for (const [a, , label] of BIND_DEFS) {
      const kp = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'), b = document.createElement('button'); kp.className = 'kp'; // une paire action-touche (deux colonnes sur écran large)
      dt.textContent = label; b.type = 'button'; b.className = 'kb' + (bindOf(a) !== bindDefault(a) ? ' changed' : '');
      b.textContent = BIND.capture === a ? _t('Appuyez sur une touche...') : keyLabel(bindOf(a));
      if (BIND.capture === a) b.classList.add('wait');
      b.addEventListener('click', () => { BIND.capture = a; draw(); b.focus(); });
      dd.appendChild(b); kp.append(dt, dd); h.appendChild(kp);
    }
  };
  const onKeyCap = (e) => {
    if (!BIND.capture) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'keyup') return;
    const a = BIND.capture;
    if (e.code === 'Escape') { BIND.capture = null; draw(); return; }
    if (e.code === 'Backspace' || e.code === 'Delete') { bindSet(a, bindDefault(a)); BIND.capture = null; draw(); return; }
    if (!bindValid(e.code)) { note.textContent = _t('Cette touche est réservée (Échap, P, T, Entrée, flèches et touches de fonction).'); return; }
    bindSet(a, e.code); BIND.capture = null; draw();
  };
  addEventListener('keydown', onKeyCap, true); addEventListener('keyup', onKeyCap, true);
  draw(); root.appendChild(h);
  const row = document.createElement('div'); row.className = 'orow';
  const r = document.createElement('button'); r.type = 'button'; r.className = 'btn'; r.textContent = _t('Rétablir les touches par défaut');
  r.addEventListener('click', () => { bindReset(); BIND.capture = null; draw(); sfxUi('click'); });
  row.append(document.createElement('span'), r); root.appendChild(row);
  note.className = 'hint'; note.textContent = _t('Clic sur une touche puis la nouvelle touche (Retour arrière : remettre celle par défaut). Hors plein écran, Ctrl+Maj avec une lettre peut déclencher un raccourci du navigateur. Préférez d\u0027autres touches ou jouez en plein écran.');
  root.appendChild(note);
  return draw;
}
