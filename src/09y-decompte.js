/* ==========================================================================
   DÉCOMPTE DU DÉPART
   Au début de chaque partie (solo et en ligne, tous les modes, « Rejouer » compris), une fois le joueur déployé : « La partie commence
   dans 5 », comme dans Call of Duty (il durait 10 s, trop long selon un joueur). Pendant le décompte (MATCH.cd > 0, ou CD.wait : un invité
   qui attend l'instant fixé par l'hôte), cdOn() est vrai, et avec lui playHold() (vrai aussi pendant la migration de l'hôte en ligne,
   09c-net.js), que lisent le jeu et les bots :
   le chrono de la partie ne tourne pas, personne ne se déplace ni ne tire (joueur : updatePlayer ; bots : updateBot ;
   joueurs distants : chacun chez soi), ni couteau ni grenade, pas de capture ni de score (modeUpdate attend), le couloir des annonces
   attend ; on regarde autour de soi, on recharge, on change d'arme ou de classe (la classe choisie dans la pause s'équipe tout de suite).
   La réapparition après une mort n'a pas de décompte.
   Le temps : en solo, le décompte s'arrête avec la pause (le temps réel ne compte que hors pause) ; en ligne, la partie continue pendant la
   pause, le décompte aussi. L'hôte fixe l'instant du départ à son déploiement (c'est là que la partie commence vraiment chez lui : ses bots,
   le chrono) et le transmet avec chaque envoi « ps » (cd : secondes restantes, protocole 10) ; un invité déployé avant l'hôte attend
   (« En attente de l'hôte »), celui qui se déploie pendant le décompte reçoit le temps restant, celui qui rejoint une partie lancée n'en a pas.
   Habillage (#cd, shell.html) : au centre, à la place du réticule, le chiffre au pochoir qui claque à chaque seconde (il arrive gros, se tasse, puis un
   écho en contour s'élargit et s'efface) avec « La partie commence dans » en surtitre, sans barre ni rappel de l'objectif (il est déjà au score) ;
   les trois dernières secondes en jaune ; puis « En avant ! » (#cdGo) qui claque et s'efface, avec la ponctuation de
   départ. Sons : un tic par seconde, un bip pour 3, 2, 1 (paquets ui et series). Aucune voix : ni phrase radio au début, ni chiffres, ni
   « En avant ! » dit (le chiffre et le texte à l'écran suffisent). Tout en transformations et opacité, une écriture par seconde.
   Outils de test : window.MATCH_COUNTDOWN (secondes, 0 : pas de décompte), posé avant la page par tools/dev/visual/common.js.
   ========================================================================== */
const CD = { len: 5, wait: false, waitT: 0, done: true, shown: -2, last: 0, end: 0 };
const CD_HOT = 3, CD_WAIT_SHOW = 0.6;

/* Durée du décompte : 5 s, ou ce que demande un outil de test */
function cdLen() { const v = window.MATCH_COUNTDOWN; return v != null && v !== '' && isFinite(+v) ? clamp(+v, 0, 30) : CD.len; }
/* Le départ n'est pas encore donné : personne ne bouge ni ne tire */
function cdOn() { return !CD.done && (MATCH.cd > 0 || CD.wait); }
/* La partie est figée : décompte du départ, ou migration de l'hôte en ligne (MIG, 09c-net.js) ; mêmes effets (joueur, bots, chrono) */
function playHold() { return cdOn() || MIG.on; }

/* Début de partie (startMatch) : l'hôte et le solo comptent tout de suite ; un invité attend l'instant fixé par l'hôte (cdNet) */
function cdStart() {
  const len = cdLen(), el = $('cd');
  CD.done = false; CD.shown = -2; CD.last = performance.now(); CD.waitT = 0;
  CD.wait = MATCH.online && NET.role === 'client';
  MATCH.cd = CD.wait ? 0 : len; CD.end = CD.last + MATCH.cd * 1000;
  $('cdGo').classList.remove('show');
  el.className = 'cd';
  if (!cdOn()) { cdGo(true); trackpadHint(); return; } // pas de décompte (outil de test) : départ immédiat, comme avant
  $('hud').classList.add('counting'); trackpadHint();
}
/* À chaque image de la partie (frame) : le temps, l'affichage (une écriture par seconde) et les sons */
function cdTick() {
  if (CD.done) return;
  if (MATCH.state !== 'playing' && MATCH.state !== 'paused') { cdClear(); return; } // fin de partie annoncée pendant le décompte (l'hôte est parti)
  const now = performance.now(), rdt = Math.min(0.25, (now - CD.last) / 1000); CD.last = now; // (onglet en arrière-plan : on ne saute pas le décompte)
  hudStyle($('prot'), 'opacity', '0');
  if (CD.wait) { // invité : l'hôte n'a pas encore donné l'instant du départ
    CD.waitT += rdt;
    if (CD.waitT > CD_WAIT_SHOW && CD.shown !== -1) { CD.shown = -1; cdShowWait(); }
    return;
  }
  if (MATCH.online) MATCH.cd = Math.max(0, (CD.end - now) / 1000);
  else if (MATCH.state === 'playing') MATCH.cd = Math.max(0, MATCH.cd - rdt); // solo : la pause arrête le décompte
  if (MATCH.cd <= 0) { cdGo(false); return; }
  const n = Math.ceil(MATCH.cd);
  if (n !== CD.shown) { const first = CD.shown < 0; CD.shown = n; cdShow(n, first); cdSound(n); }
}
/* Seconde n (5 à 1) : chiffre posé de nouveau (deux noms d'animation qui alternent : elle repart sans relire la mise en page ; data-n nourrit son
   écho), trois dernières secondes en jaune */
function cdShow(n, first) {
  const el = $('cd');
  const num = $('cdNum'); num.textContent = num.dataset.n = String(n);
  $('cdDial').className = 'cd-dial ' + (n % 2 ? 'a' : 'b');
  $('cdKick').textContent = _t('La partie commence dans');
  el.className = 'cd show' + (n <= CD_HOT ? ' last' : '') + (first ? ' in' : '');
}
/* Invité déployé avant l'hôte : le surtitre respire, sans chiffre */
function cdShowWait() {
  const el = $('cd');
  $('cdNum').textContent = $('cdNum').dataset.n = ''; $('cdDial').className = 'cd-dial';
  $('cdKick').textContent = _t('En attente de l\u0027hôte');
  el.className = 'cd show wait in';
}
/* Sons : un tic par seconde, puis le bip de liaison radio pour 3, 2, 1 (sans voix) */
function cdSound(n) {
  if (!AU.ready) return;
  const t = AU.ctx.currentTime;
  if (n > CD_HOT) { sfxPlay('ui_tick', uiOut(0.62), t, { rate: 0.82 }) || sfxClick(null, 900, 0.22); return; }
  const B = SFX.bank.get('r_beep');
  if (!(B && B.length && sfxPlay('r_beep', uiOut(0.42), t, { e: B[0] }))) sfxBeep(1500, 1); // toujours la même prise (la seconde est un double bip)
}

/* Départ : la partie commence (chrono, bots, commandes). late : sans décompte (outil de test, ou invité arrivé dans une partie lancée) :
   le rappel de l'objectif passe alors par un message, comme avant le décompte */
function cdGo(late) {
  if (CD.done) return;
  CD.done = true; CD.wait = false; MATCH.cd = 0; OPEN.on = false; // fin du départ : les apparitions suivent les règles du mode (chooseSpawn)
  MATCH.startAt = MATCH.time; // les bots se ruent vers l'avant les premières secondes (07-bots.js) : à partir du départ
  for (const e of entities) if (e.alive) e.spawnAt = MATCH.time; // délai de changement de classe et protection : comptés depuis le départ
  $('hud').classList.remove('counting');
  const el = $('cd'); if (el.classList.contains('show')) el.className = 'cd out';
  sfxAnnounce(null, 'st_start'); // la ponctuation seule, sans voix
  if (late) { const MD = modeDef(); hudMsg(`${MD.name} : ${MATCH.limit} ${MD.unit}`, 'xp', 3); return; }
  const go = $('cdGo'); go.textContent = _t('En avant !'); go.classList.remove('show'); void go.offsetWidth; go.classList.add('show');
  lanePump(); // une annonce retenue pendant le décompte passe maintenant
}
/* Fin de partie ou retour aux menus pendant le décompte */
function cdClear() {
  CD.done = true; CD.wait = false; MATCH.cd = 0; OPEN.on = false;
  $('hud').classList.remove('counting'); $('cd').className = 'cd'; $('cdGo').classList.remove('show');
}
/* En ligne : l'hôte joint les secondes restantes à chaque envoi « ps » (rien une fois la partie lancée) */
function cdNetOut() { return !CD.done && MATCH.cd > 0 ? Math.round(MATCH.cd * 100) / 100 : undefined; }
/* Invité : envoi « ps » de l'hôte (le sien, celui qui porte tl). cd : secondes restantes, absent une fois la partie lancée. Un écart de plus
   de 0,15 s recale le décompte (la latence n'est pas compensée : l'invité part au plus un aller simple après l'hôte) */
function cdNetIn(cd) {
  if (CD.done || !MATCH.online || NET.role !== 'client') return;
  const now = performance.now();
  if (!(typeof cd === 'number' && isFinite(cd) && cd > 0)) { cdGo(CD.wait); return; } // partie déjà lancée chez l'hôte : départ (sans décompte si on attendait)
  cd = Math.min(cd, CD.len);
  if (CD.wait) { CD.wait = false; CD.end = now + cd * 1000; MATCH.cd = cd; CD.shown = -2; return; }
  if (Math.abs((CD.end - now) / 1000 - cd) > 0.15) CD.end = now + cd * 1000;
}
$('cdGo').addEventListener('animationend', (e) => { if (e.target.id === 'cdGo') e.target.classList.remove('show'); });
