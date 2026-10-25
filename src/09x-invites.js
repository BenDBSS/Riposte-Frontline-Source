/* ==========================================================================
   INVITES DE TOUCHES : la touche ou le bouton qui commande une action, selon le mode d'entrée, en glyphe (kbd.key, shell.html).
   - clavier : la touche réellement liée (bindOf, keyLabel : 08a-binds.js), donc à jour après une réassignation et selon la disposition du clavier ;
   - manette : le bouton de la disposition choisie (PAD_LAYOUTS, Settings.padLay : 09qc-manette.js), nommé comme sur une manette Xbox
     (A vert, B rouge, X bleu, Y jaune, LB RB LT RT, croix directionnelle dessinée) ;
   - doigt : rien (les commandes sont à l'écran).
   Un texte qui accompagne une invite passe par _t avec un paramètre ({0} : le glyphe), jamais par une phrase recollée.
   ========================================================================== */
const PAD_GLYPH = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', '', 'Menu', 'L3', 'R3']; // 8 (Retour/Vue) et 12 à 15 (croix) : voir padGlyph
const PAD_FIXED = { fire: 7, ads: 6, board: 8, pause: 9, confirm: 0, back: 1 }; // boutons qui ne dépendent pas de la disposition
const KB_FIXED = { confirm: 'Enter', back: 'Escape', pause: 'Escape', fire: 'Mouse0', ads: 'Mouse2' };
/* Mode d'entrée qui a la main : 'pad' (manette), 'touch' (doigt) ou 'kb' (clavier et souris) */
function inputMode() { return PAD.drive ? 'pad' : TOUCH.on ? 'touch' : 'kb'; }
function keyGlyph(label, cls) { return `<kbd class="key${cls ? ' ' + cls : ''}">${esc(label)}</kbd>`; }
/* Bouton de manette par son indice au mappage standard */
function padGlyph(i) {
  if (i >= 12 && i <= 15) return `<kbd class="key dp d${i - 12}" aria-label="${esc(_t('Croix directionnelle'))}"></kbd>`; // haut, bas, gauche, droite
  if (i === 8) return keyGlyph(_t('Retour'), 'pad sys');
  if (i === 9) return keyGlyph('Menu', 'pad sys');
  return keyGlyph(PAD_GLYPH[i] || '?', i <= 3 ? 'pad b' + i : 'pad sh');
}
/* Glyphe d'une action du joueur (noms de BIND_DEFS, plus fire, ads, confirm, back, pause) dans le mode d'entrée courant ; '' au doigt */
function actGlyph(action) {
  const mode = inputMode();
  if (mode === 'touch') return '';
  if (mode === 'pad') {
    if (action in PAD_FIXED) return padGlyph(PAD_FIXED[action]);
    const lay = PAD_LAYOUTS[Settings.padLay] || PAD_LAYOUTS.default, want = action === 'use' ? 'reload' : action; // ramasser une arme : X maintenu, le bouton du rechargement (padReloadUse)
    for (const i in lay) if (lay[i] === want) return padGlyph(+i);
    return '';
  }
  if (!(action in KB_FIXED) && !BIND_DEFS.some((d) => d[0] === action)) return '';
  const code = KB_FIXED[action] || bindOf(action);
  if (code === 'Mouse0') return keyGlyph(_t('Clic gauche'), 'mouse');
  if (code === 'Mouse2') return keyGlyph(_t('Clic droit'), 'mouse');
  if (code === 'Enter') return keyGlyph(_t('Entrée'));
  if (code === 'Escape') return keyGlyph(_t('Échap'));
  return keyGlyph(keyLabel(code));
}
