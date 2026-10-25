/* ==========================================================================
   FIN DE PARTIE : ANNONCE « VICTOIRE » / « DÉFAITE » / « ÉGALITÉ »
   Quand la partie est décidée (limite d'éliminations ou de points atteinte, fin du temps), le jeu ne bascule plus d'un coup
   sur la killcam ou le tableau des scores : MATCH.state passe à 'finish' pendant FIN_LEN secondes. Le résultat s'affiche en
   surimpression (#fin : voiles, bandes de cinéma, mot qui s'abat, filet, score), le jeu continue derrière en ralenti, sans
   que les commandes ni les dégâts comptent (applyDamage et les commandes ne travaillent qu'en 'playing'), et le HUD s'efface.
   Ensuite : killcam finale si une dernière élimination a décidé la partie (solo, équipes ou chacun pour soi), sinon
   tableau des scores directement (domination, fin du temps, parties en ligne, qui n'ont pas de killcam).
   Le résultat est figé au début (MATCH.fin.out) : l'annonce, l'écran de résultats et le compte du joueur disent la même chose.
   Appelants : killEnt et netUpdate (via matchFinishSoon, avec un court délai après la dernière élimination), domUpdate (09i-modes.js), la boucle (temps écoulé) et le message 'end' (09c-net.js).
   ========================================================================== */
const FIN_LEN = 3.6;    // durée de l'annonce (secondes réelles)
const FIN_DELAY = 0;    // délai entre la dernière élimination et l'annonce (secondes de jeu) : aucun, l'annonce part à l'image suivante et la chute de la victime se voit au ralenti derrière elle (1,3 s jusqu'en 2.32, puis 0,45 s : le joueur avait encore le temps de changer d'arme, retours du propriétaire)
const FIN_SLOW = 0.18;  // vitesse du jeu derrière l'annonce, une fois le ralenti installé
const FIN_TEXT = { win: _t('Victoire'), loss: _t('Défaite'), draw: _t('Égalité') };
const FIN_CLS = { win: 'ally', loss: 'enemy', draw: 'draw' };
let finTimer = 0;

/* Résultat du match tel qu'il est à cet instant : result (win, loss ou draw), winner (équipe, -1 sans vainqueur d'équipe), sub (phrase de score) */
function matchOutcome() {
  const me = PL.ent, [a, b] = MATCH.score;
  if (MATCH.mode === 'ffa') { // le vainqueur est le premier du classement, personne d'autre ne gagne avec lui
    const top = ffaList().sort(ffaCmp)[0], win = top === me;
    return { result: win ? 'win' : 'loss', winner: -1, sub: win ? `${_t('Vous gagnez avec {0} éliminations', me.kills)}` : `${_t('{0} gagne avec {1} éliminations, vous finissez {2}', top.name, top.kills, ordinal(ffaRank()))}` };
  }
  const w = a > b ? 0 : b > a ? 1 : -1;
  return { result: w === -1 ? 'draw' : w === me.team ? 'win' : 'loss', winner: w, sub: _t('{0} {1} contre {2} {3}', TEAM_NAMES[0], a, b, TEAM_NAMES[1]) };
}
/* Ce qui a mis fin à la partie : la limite du mode, sinon le temps */
function finByLimit() {
  const ffaDone = MATCH.mode === 'ffa' && ffaList().some((e) => e.kills >= MATCH.limit);
  return ffaDone || (MATCH.mode !== 'ffa' && (MATCH.score[0] >= MATCH.limit || MATCH.score[1] >= MATCH.limit));
}
function finKicker() {
  if (!finByLimit()) return _t('Temps écoulé');
  return MATCH.mode === 'dom' ? _t('Score atteint') : _t('Limite d\u0027éliminations atteinte');
}

/* La limite d'éliminations vient d'être atteinte : l'annonce suit après FIN_DELAY, à l'image suivante (une seule échéance, remise à zéro par
   startMatch ; pas d'appel direct : killEnt est au milieu de l'image du joueur) */
function matchFinishSoon() {
  if (MATCH.fin || MATCH.finSoon) return;
  MATCH.finSoon = true;
  MATCH.events.push({ t: MATCH.time + FIN_DELAY, fn: matchFinish });
}
/* La partie est décidée : annonce, ralenti, commandes coupées. Sans effet si elle est déjà annoncée ou finie. */
function matchFinish() {
  if (MATCH.fin || (MATCH.state !== 'playing' && MATCH.state !== 'paused')) return;
  kcAbort(); // en ligne, une relecture de mort en cours cède la place à l'annonce
  // en ligne, la partie est décidée par l'hôte : la dernière élimination (si c'est elle qui a atteint la limite) a sa killcam finale, comme en solo
  const L = MATCH.lastKill;
  if (MATCH.online && !MATCH.finalPending && MATCH.mode !== 'dom' && L && MATCH.time - L.t < 4 && finByLimit()) MATCH.finalPending = L;
  const out = matchOutcome();
  MATCH.fin = { t: 0, t0: performance.now(), out, faded: false }; // t suit l'horloge réelle, comme les animations CSS de l'annonce
  MATCH.over = true;
  if (MATCH.online && NET.role === 'host') netBroadcast({ t: 'end' }); // les autres joueurs annoncent le résultat en même temps que l'hôte
  showLockPrompt(false); chatClose(); ksAbort(); hideDeathScreen(); showScoreboard(false); laneSuspend();
  $('pause').classList.remove('show');
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false; LOCK.escArmed = false;
  MATCH.state = 'finish';
  const el = $('fin');
  $('finKick').textContent = finKicker();
  $('finWord').textContent = FIN_TEXT[out.result];
  $('finSub').textContent = out.sub;
  clearTimeout(finTimer); el.className = 'fin show ' + out.result; // l'animation repart de zéro
  $('hud').classList.add('finish');
  sfxMatchEnd(out.result); sfxFinMuffle(true);
}
/* Image par image pendant l'annonce : renvoie la vitesse du jeu (1 normal, FIN_SLOW au ralenti). Le temps de l'annonce est le temps réel :
   une machine qui rame n'étire pas l'annonce par rapport à ses animations. */
function finTick() {
  const F = MATCH.fin; F.t = (performance.now() - F.t0) / 1000;
  if (!F.faded && F.t >= FIN_LEN - 0.35) { F.faded = true; $('fin').classList.add('out'); } // fondu au noir avant la suite
  const u = clamp(F.t / 0.5, 0, 1), s = u * u * (3 - 2 * u);
  return 1 - (1 - FIN_SLOW) * s;
}
/* Fin de l'annonce : killcam finale si une élimination a décidé la partie, sinon tableau des scores */
function finDone() {
  const F = MATCH.finalPending;
  finClear(true);
  MATCH.state = 'playing';
  if (F && !F.nocam && startKillcam({ killer: F.killer, victim: F.victim, tEnd: F.t, final: true, info: F.info })) return; // une chute dans le vide ne se rejoue pas
  endMatch();
}
/* Retire l'annonce. fade : un dernier fondu depuis le noir révèle la suite (killcam ou résultats), sinon coupure nette */
function finClear(fade) {
  const el = $('fin'); if (!el) return;
  $('hud').classList.remove('finish'); sfxFinMuffle(false);
  clearTimeout(finTimer);
  if (fade && el.classList.contains('show')) {
    el.className = 'fin show from ' + (MATCH.fin ? MATCH.fin.out.result : 'win');
    finTimer = setTimeout(() => { el.className = 'fin'; }, 520);
  } else el.className = 'fin';
}
