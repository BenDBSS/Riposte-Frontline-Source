/* ==========================================================================
   STEAM DECK (README « Steam Deck »)
   - En mode Bureau, dans le navigateur du Steam Deck (deckLooksLike, 01-core.js) : une carte du menu principal propose d'installer le
     jeu dans Steam. Elle télécharge « Installer Riposte.desktop », un raccourci qui lance dist/deck/installer.sh depuis l'adresse de la
     page (la préversion installe la préversion) : un double-clic dessus installe tout et ramène au mode Jeu.
   - Lancé depuis Steam (?deck=1, DECK) : pas de bouton Plein écran (le lanceur l'est déjà) ; tant qu'aucune manette n'a répondu, la
     carte dit quelle disposition choisir dans Steam (Chrome ne voit pas la manette sous une disposition clavier et souris) ; un champ de
     texte rappelle le clavier à l'écran de Steam (bouton Steam et X).
   ========================================================================== */
const DECK_UI = { t0: performance.now(), asked: false, force: '' }; // force : 'install' ou 'pad', la carte affichée quoi qu'il arrive (tools/dev/visual/menus.js)
const DECK_SITE = 'https://www.playriposte.com'; // adresse installée quand la page n'est pas servie en http(s) (fichier local)

/* Le raccourci téléchargé : un fichier .desktop que KDE exécute d'un double-clic (comme l'installeur de Decky Loader) ; Terminal : on
   voit l'installation avancer. Exec sans guillemet, dollar ni barre oblique inverse dans l'argument (spécification des fichiers .desktop). */
function deckInstallFile() {
  const site = /^https?:$/.test(location.protocol) ? location.origin : DECK_SITE;
  return '[Desktop Entry]\nType=Application\nName=' + _t('Installer Riposte') + '\nIcon=system-software-install\nTerminal=true\n'
    + `Exec=bash -c "curl -fsSL --create-dirs ${site}/deck/installer.sh -o ~/.cache/riposte-installer.sh && bash ~/.cache/riposte-installer.sh ${site}"\n`; // dans le dossier du joueur, pas dans /tmp (nom connu d'avance, partagé)
}
function deckDownload() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([deckInstallFile()], { type: 'application/x-desktop' }));
  a.download = _t('Installer Riposte') + '.desktop';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  DECK_UI.asked = true; deckCard();
}

/* Carte du menu principal : installation (navigateur du Deck), ou disposition des commandes (Deck en mode Jeu, aucune manette encore vue) */
function deckCard() {
  const card = $('deckCard'); if (!card) return;
  let txt = '', btn = '';
  const mode = DECK_UI.force || (deckLooksLike() ? 'install' : DECK && !PAD.id && performance.now() - DECK_UI.t0 > 5000 ? 'pad' : '');
  if (mode === 'install') {
    txt = DECK_UI.asked ? _t('Ouvrez le fichier téléchargé dans le dossier Téléchargements et confirmez. L\u0027installation se termine seule et revient au mode Jeu.')
      : _t('Installez le jeu dans Steam pour y jouer depuis le mode Jeu.');
    btn = DECK_UI.asked ? _t('Télécharger de nouveau') : _t('Installer sur Steam Deck');
  } else if (mode === 'pad') {
    txt = _t('Si la manette ne répond pas, choisissez dans Steam la disposition Manette avec trackpad souris.');
  }
  card.classList.toggle('hidden', !txt);
  if (!txt) return;
  $('pwaCard').classList.add('hidden'); // jamais les deux cartes ensemble (sur le Deck, celle des téléphones ne paraît pas : 09r-pwa.js)
  $('deckTxt').textContent = txt;
  $('deckGo').textContent = btn; $('deckGo').classList.toggle('hidden', !btn);
}

function deckInit() {
  $('deckGo').addEventListener('click', deckDownload);
  if (!DECK) { deckCard(); return; }
  $('fsBtn').classList.add('hidden');
  setTimeout(deckCard, 5200); // la carte de la manette, si rien n'a répondu entre-temps
  addEventListener('gamepadconnected', () => deckCard());
  // clavier à l'écran de Steam : Chrome ne l'ouvre pas tout seul dans un champ de texte
  const kb = document.createElement('div'); kb.id = 'deckKb'; kb.className = 'hidden'; kb.setAttribute('aria-hidden', 'true');
  kb.textContent = _t('Bouton Steam et X pour le clavier à l\u0027écran'); document.body.appendChild(kb);
  const isText = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|email|password|url|tel|)$/.test(el.type || '')));
  addEventListener('focusin', (e) => kb.classList.toggle('hidden', !isText(e.target)));
  addEventListener('focusout', () => kb.classList.add('hidden'));
}
deckInit();
