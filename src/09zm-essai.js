/* ==========================================================================
   ESSAI D'UNE SÉRIE (outil de développement)
   Le jeu s'ouvre avec ?essai=<série> (https://playriposte-dev.vercel.app/?essai=drone) : une partie solo se charge tout de suite (la carte des réglages, ou
   &carte=<id>), on déploie, et la série essayée est dans le premier emplacement (touche 4, premier bouton au doigt), toujours prête : une seconde après
   chaque usage, elle revient. Le joueur ne prend aucun dégât, pour essayer en paix au milieu des bots (sauf la surchauffe du mecha s'il reste à bord). Séries : drone, uav, frappe, iem, satellite,
   helico, mecha (ou leur nom du catalogue, KSDEF). ?essai=marche : un mecha patrouille devant le joueur, aller et retour avec demi-tour sur place, le torse
   tourné vers lui (essaiMecha), pour juger la marche.
   ?essai=series : toutes les séries, comme en partie (09zm-essai.js, essaiSeries) : une partie solo ordinaire contre les bots (on prend des
   dégâts), et un petit panneau, « Séries », en haut à gauche : pour chacune des séries, Prête la met dans un emplacement, prête à appeler comme
   si on l'avait gagnée (annonce comprise), et Ennemi la fait appeler par un bot adverse (ses annonces, sa menace). À l'ordinateur, la souris
   reste à la vue : K ouvre et ferme le panneau, 1 à 7 rendent une série prête, Maj et 1 à 7 la font appeler par un ennemi (panneau ouvert,
   les chiffres ne vont qu'à lui) ; Échap (la pause) libère aussi la souris pour cliquer.
   Le code ne fait rien sans ?essai= : ESSAI est vide, ESSAI_MECHA et ESSAI_TOUT faux pour un joueur.
   ========================================================================== */
const ESSAI = (() => {
  const v = new URLSearchParams(location.search).get('essai'); if (!v) return '';
  const id = { drone: 'fpv', frappe: 'air', helico: 'heli', satellite: 'sat' }[v] || v;
  return KSDEF[id] ? id : '';
})();
const ESSAI_MECHA = new URLSearchParams(location.search).get('essai') === 'marche';
const ESSAI_TOUT = ['series', 'toutes'].includes(new URLSearchParams(location.search).get('essai'));
const ESSAI_S = { t: 0, me: null, a: null, b: null, go: 1, wait: 0 };
/* Séries du joueur pendant l'essai : celle qu'on essaie au premier emplacement (touche 4), quel que soit son seuil, puis deux autres */
function essaiKs() { return [ESSAI].concat(ksFill([ESSAI]).filter((k) => k !== ESSAI)); }
/* À chaque image de la partie : la série revient une seconde après avoir servi */
function essaiTick(dt) {
  if (ESSAI_MECHA) { essaiMecha(dt); return; }
  if (!PL.ent.alive || PL.ks[ESSAI] || KS.mode || PILOT.d) { ESSAI_S.t = 0; return; }
  ESSAI_S.t += dt; if (ESSAI_S.t < 1) return;
  ESSAI_S.t = 0; PL.ks[ESSAI] = true; updateStreakHud();
}
/* Patrouille du mecha : posé à 5 m du joueur dans la direction la plus dégagée (deux rayons à 0,9 m de part et d'autre, à hauteur de hanche),
   il va au bout, s'arrête, fait demi-tour sur place et revient ; son torse suit le joueur */
function essaiMecha(dt) {
  const S = ESSAI_S, e = PL.ent;
  if (!S.me) {
    let best = 0, dir = null;
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, v = new V3(-Math.sin(a), 0, -Math.cos(a)), side = new V3(-v.z, 0, v.x);
      let t = 40; for (const o of [-0.9, 0, 0.9]) { const p = e.pos.clone().addScaledVector(side, o); const h = rayWorld(p.x, p.y + 1.2, p.z, v.x, 0, v.z, 40, 1); t = Math.min(t, h ? h.t : 40); }
      if (t > best) { best = t; dir = v; }
    }
    const a0 = e.pos.clone().addScaledVector(dir, 5); a0.y = groundHeight(a0.x, a0.z, e.pos.y + 0.6);
    S.a = a0; S.b = e.pos.clone().addScaledVector(dir, Math.max(9, Math.min(best - 2.5, 22))); S.go = 1; S.wait = 0;
    S.me = mechaSpawn(null, a0, Math.atan2(-dir.x, -dir.z)); S.me.hum = sfxMechaHum(a0);
  }
  const me = S.me, to = S.go ? S.b : S.a, dx = to.x - me.pos.x, dz = to.z - me.pos.z, d = hyp(dx, dz);
  if (S.wait > 0) { S.wait -= dt; me.want.set(0, 0, 0); if (S.wait <= 0) S.go = 1 - S.go; }
  else if (d < 0.6) { S.wait = 1.6; me.want.set(0, 0, 0); }
  else {
    me.wantYaw = Math.atan2(-dx, -dz);
    const turned = Math.abs(angDiff(me.yaw, me.wantYaw)) < 0.5; // il se tourne d'abord sur place, puis avance
    me.want.set(dx / d, 0, dz / d).multiplyScalar(turned ? MECHA_W.speed * Math.min(1, d / 2) : 0);
  }
  const c = e.pos, ox = c.x - me.pos.x, oz = c.z - me.pos.z;
  me.aimYaw = Math.atan2(-ox, -oz); me.aimPitch = clamp(Math.atan2(c.y + 1.2 - (me.pos.y + 2.0), hyp(ox, oz)), -0.5, 0.4);
}
/* Une fois le jeu prêt (menu principal affiché) : chargement de la partie solo, puis l'écran de déploiement (un clic : la souris est prise) */
function essaiStart() {
  if (!GPUX.booted || MATCH.state !== 'menu' || UI.busy) { setTimeout(essaiStart, 300); return; }
  if (ESSAI_TOUT) essaiSeries();
  const carte = new URLSearchParams(location.search).get('carte');
  if (carte && MAPS.some((m) => m.id === carte)) Settings.map = carte;
  menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() });
}
/* ?essai=series : le panneau des séries (au-dessus de la pause, pour s'en servir à la souris) */
function essaiSeries() {
  if ($('esRoot')) return;
  const el = document.createElement('div'); el.id = 'esRoot';
  const ids = ksSort(KS_IDS);
  el.innerHTML = `<button id="esTog" class="btn" type="button">${esc(_t('Séries'))}<kbd>K</kbd></button><div id="esList"><p class="es-kb">${esc(_t('Touches 1 à 7 prête, Maj et 1 à 7 ennemi'))}</p>${ids.map((id, i) =>
    `<div class="es-row"><kbd>${i + 1}</kbd>${ksSvg(id)}<b>${esc(KSDEF[id].name)}</b><em>${KSDEF[id].n}</em><button class="btn" type="button" data-me="${id}">${esc(_t('Prête'))}</button><button class="btn" type="button" data-foe="${id}">${esc(_t('Ennemi'))}</button></div>`).join('')}</div>`;
  document.body.appendChild(el);
  $('esTog').addEventListener('click', () => el.classList.toggle('open'));
  // au clavier, la souris restant à la vue : K, puis 1 à 7 (Maj : ennemi) ; avant les touches du jeu (phase de capture)
  addEventListener('keydown', (e) => {
    if (MATCH.state !== 'playing' && MATCH.state !== 'paused') return;
    if (e.code === 'KeyK' && !e.repeat) { el.classList.toggle('open'); e.preventDefault(); e.stopImmediatePropagation(); return; }
    const m = /^Digit([1-7])$/.exec(e.code); if (!m || !el.classList.contains('open')) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return;
    const id = ids[+m[1] - 1]; if (e.shiftKey) essaiFoe(id); else essaiGrant(id);
  }, true);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || MATCH.state === 'menu') return;
    if (b.dataset.me) essaiGrant(b.dataset.me); else if (b.dataset.foe) essaiFoe(b.dataset.foe);
  });
}
/* La série prête, comme gagnée : dans un emplacement (à la place de celle du même seuil, ou de la plus ancienne prête s'ils le sont tous), son
   annonce, la touche qui l'appelle */
function essaiGrant(id) {
  if (!PL.ent.alive) return;
  const ready = PL.ksSel.filter((k) => PL.ks[k] && k !== id && KSDEF[k].n !== KSDEF[id].n); // celles déjà prêtes gardent leur place (trois emplacements)
  PL.ksSel = ksFill([id].concat(ready.slice(-2), PL.ksSel)); PL.ks[id] = true;
  const g = actGlyph(ksAct(id)), name = KSDEF[id].name;
  sfxAnnounce(id + '_ready', 'st_ready'); hudMsg(g ? _t('{0} disponible : {1}', name, g) : _t('{0} disponible', name), 'xp', 3, !!g);
  updateStreakHud();
}
/* Un bot adverse vivant l'appelle (au hasard) */
function essaiFoe(id) {
  const foes = entities.filter((e) => !e.isPlayer && !e.isRemote && e.alive && !e.off && !allied(e, PL.ent));
  if (foes.length) KSDEF[id].bot(pick(foes));
}
if (ESSAI || ESSAI_MECHA || ESSAI_TOUT) setTimeout(essaiStart, 500);
