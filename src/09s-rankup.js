/* ==========================================================================
   COULOIR DES ANNONCES ET MONTÉE DE NIVEAU EN PARTIE
   Le couloir (contrat de place du HUD, --lane-top sur #hud) est au centre haut, sous le score : il porte la montée de niveau du joueur (#rankUp,
   le « Rank Up » de Call of Duty, avec sa fanfare, 05b-rankup-sound.js) et les déblocages (#arsUp : arme qui monte, accessoire, défi, tenue ;
   arsShow, 09n-armurerie.js). Une seule annonce à la fois, dans une seule file : une montée de niveau passe devant les déblocages (celui qui était
   affiché reprend ensuite depuis le début) ; rien ne commence pendant une killcam, la pause ou l'annonce de fin, et ce qui était affiché quand
   elles arrivent revient après (laneSuspend, lanePump) : aucune annonce ne se perd.
   La montée de niveau : un bandeau compact (filets jaunes qui s'ouvrent depuis le centre), l'insigne hexagonal où le niveau roule de l'ancien au
   nouveau, « Niveau supérieur » en surtitre et le déblocage en sous-titre, une lueur douce et quelques étincelles. Ni éclair ni rayons : le centre,
   où l'on vise, reste dégagé. Tout est animé par CSS (transformations et opacité), sans prise sur les touches (pointer-events: none) ; en mouvement
   réduit, des fondus seulement. Plusieurs niveaux d'un coup se suivent.
   ========================================================================== */
const RU = { q: [], on: false, t: 0, el: null, cur: null, t0: 0 };
const RU_MS = 4600, RU_SPARKS = 6;
const LANE = { t: 0 }; // attente du couloir (killcam, pause, annonce de fin)

function rankUpBuild() {
  const el = $('rankUp'); if (!el || el.dataset.built) return el;
  el.dataset.built = '1';
  el.innerHTML = `<div class="ru-band"><i class="ru-edge t"></i><i class="ru-edge b"></i></div>
    <div class="ru-core"><div class="ru-badge"><i class="ru-glow"></i><svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="ru-hex0" points="50,3 93,26.5 93,73.5 50,97 7,73.5 7,26.5"/><polygon class="ru-hex1" points="50,12 85,31.5 85,68.5 50,88 15,68.5 15,31.5"/></svg>
        <div class="ru-roll"><b class="ru-old"></b><b class="ru-new"></b></div><div class="ru-sparks">${'<i></i>'.repeat(RU_SPARKS)}</div></div>
      <div class="ru-txt"><small class="ru-kick"></small><span class="ru-sub"></span></div></div>`;
  return el;
}
/* Le couloir attend : décompte du départ, killcam (relecture de mort, en ligne comme en solo), pause, annonce de fin ou résultats */
function laneHeld() { return playHold() || KC.active || MATCH.state === 'killcam' || MATCH.state === 'paused' || MATCH.state === 'finish' || MATCH.state === 'ended'; }
/* Annonce suivante : la montée de niveau d'abord, puis les déblocages ; le couloir retenu réessaie un peu plus tard */
function lanePump() {
  clearTimeout(LANE.t);
  if (RU.on || ARSQ.on || (!RU.q.length && !ARSQ.list.length)) return;
  if (laneHeld()) { LANE.t = setTimeout(lanePump, 400); return; }
  if (RU.q.length) rankUpNext(); else arsShowNext();
}
/* Killcam, pause, annonce de fin : l'annonce affichée s'interrompt et reprendra du début (une montée de niveau bien avancée est considérée vue) */
function laneSuspend() {
  if (ARSQ.on) arsShowStop(true);
  if (RU.on && RU.cur) {
    const seen = performance.now() - RU.t0 > RU_MS * 0.55;
    if (!seen) RU.q.unshift(RU.cur);
    rankUpStop();
  }
}
/* Annonce le niveau atteint : slot = indice de l'emplacement de classe personnalisée qu'il débloque (-1 : aucun) */
function rankUpShow(level, slot) {
  RU.q.push([level, slot]); if (RU.q.length > 3) RU.q.shift(); // plusieurs niveaux d'un coup : les trois derniers
  if (ARSQ.on) arsShowStop(true); // un déblocage affiché cède la place (il reprendra ensuite)
  if (!RU.on) lanePump();
}
function rankUpNext() {
  const el = rankUpBuild(), it = RU.q.shift();
  if (!el || !it) { RU.on = false; RU.cur = null; if (el) el.classList.remove('show'); lanePump(); return; }
  RU.on = true; RU.cur = it; RU.t0 = performance.now();
  const [level, slot] = it;
  el.querySelector('.ru-kick').textContent = _t('Niveau supérieur');
  el.querySelector('.ru-old').textContent = Math.max(1, level - 1); el.querySelector('.ru-new').textContent = level;
  el.querySelector('.ru-sub').textContent = slot >= 0 ? _t('Emplacement de classe personnalisée {0} débloqué', slot + 1) : _t('Votre niveau de joueur monte');
  el.querySelectorAll('.ru-sparks i').forEach((s, i, all) => { // étincelles : quelques-unes, en éventail autour de l'insigne, portée et durée variables
    const a = (i / all.length) * Math.PI * 2 + 0.35 + Math.random() * 0.5, d = 7 + Math.random() * 5;
    s.style.setProperty('--dx', (Math.cos(a) * d * 1.3).toFixed(1)); s.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1)); s.style.setProperty('--w', (0.8 + Math.random() * 0.5).toFixed(2) + 's');
  });
  el.setAttribute('aria-hidden', 'false'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  rankUpSound();
  clearTimeout(RU.t); RU.t = setTimeout(() => { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); RU.cur = null; RU.t = setTimeout(() => { RU.on = false; lanePump(); }, 250); }, RU_MS);
}
/* Interrompt la montée de niveau affichée (sans toucher à la file) */
function rankUpStop() {
  RU.on = false; RU.cur = null; clearTimeout(RU.t);
  const el = $('rankUp'); if (el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
}
/* Fin ou abandon de la partie : plus d'annonce en attente */
function rankUpClear() { RU.q.length = 0; rankUpStop(); clearTimeout(LANE.t); }
