/* ==========================================================================
   VIE SOCIALE : CLASSEMENT DES JOUEURS, PROFILS, AMIS ET NOTIFICATIONS
   Le serveur (api/_lib/social.js) classe les joueurs par XP de toujours (le classement est permanent et commun à tous). Trois écrans,
   ouverts depuis les boutons en haut du menu principal :
   - « Joueurs » (ranking) : le classement, avec recherche par nom et filtre « Mes amis », 25 joueurs à la fois ;
   - le profil public d'un joueur (player) : niveau, rang et XP, statistiques, dernières parties, et le bouton d'ami qui convient à l'état de la relation ;
   - les notifications (notifs) : demandes d'ami (à accepter ou refuser sur place), réponses, niveaux gagnés, bienvenue.
   La photo de profil d'un joueur, s'il en a une, s'affiche dans le classement et sur son profil
   (/api/avatar?u=, réservé aux joueurs connectés), sinon une initiale et une teinte.
   Le serveur ne garde que le genre de la notification : le texte est fabriqué ici, dans la langue du joueur. Le nombre de notifications non
   lues s'affiche sur la cloche, relevé à la connexion, toutes les minutes au menu principal, et à chaque retour sur la page.
   ========================================================================== */
const SOC = {
  rank: { scope: 'all', q: '', players: [], more: false, me: null, busy: false, err: '' },
  player: { u: '', data: null, err: '', busy: false, rep: null }, // rep : signalement en cours de rédaction (raison, mot, envoyé)
  notifs: { items: [], unread: 0, loaded: false, busy: false, fresh: new Set() },
  timer: 0, busy: false,
};

/* Qui peut voir ces écrans : un compte connecté ; boutons du menu principal et cloche */
function socChanged() {
  const on = !!ACCT.user;
  for (const id of ['friendsBtn', 'rankBtn', 'commBtn', 'notifBtn']) { const b = $(id); if (b) b.classList.toggle('hidden', !on); }
  amisChanged(); // présence, invitations dans un salon (09ta-amis.js)
  if (!on) { SOC.notifs = { items: [], unread: 0, loaded: false, busy: false, fresh: new Set() }; SOC.rank.players = []; SOC.rank.me = null; socBadge(); clearInterval(SOC.timer); SOC.timer = 0; return; }
  if (!SOC.timer) {
    SOC.timer = setInterval(() => { if (!document.hidden && MATCH.state === 'menu' && UI.screen !== 'notifs') socNotifLoad(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ACCT.user && MATCH.state === 'menu') socNotifLoad(); });
  }
  if (!SOC.notifs.loaded && !SOC.notifs.busy) socNotifLoad();
}
function socBadge() {
  const n = SOC.notifs.unread, b = $('notifBadge'); if (!b) return;
  b.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('hidden', n < 1);
  const btn = $('notifBtn'); if (btn) btn.setAttribute('aria-label', n ? _tn(n, 'Notifications : {0} non lue', 'Notifications : {0} non lues') : _t('Notifications'));
}

/* Avatar d'un autre joueur : sa photo, sinon une teinte tirée de son nom et son initiale (photo illisible : on retombe sur l'initiale) */
const socAv = (username, name, avatar) => acctAvatar({ username, displayName: name || username, avatar, other: true }, 0);
function socAvFallback(root) {
  for (const im of root.querySelectorAll('.acct-av img')) im.addEventListener('error', () => { const box = im.parentElement, u = box.dataset.u; box.innerHTML = acctAvatar({ username: u, displayName: box.dataset.n, avatar: null }, 0); }, { once: true });
}
const socErr = (r) => (r.data && r.data.error) || AC_ERR[r.status] || _t('Une erreur est survenue.');
/* Âge d'une notification */
function socAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (!(s < 1e10)) return '';
  if (s < 90) return _t('à l\u0027instant');
  if (s < 5400) return _t('il y a {0} min', Math.round(s / 60));
  if (s < 129600) return _t('il y a {0} h', Math.round(s / 3600));
  return _t('il y a {0} j', Math.round(s / 86400));
}

/* ---------- Amis : une seule voie pour tous les écrans ---------- */
const SOC_CALL = {
  add: (u) => acctApi('friend-request', { username: u }),
  accept: (u) => acctApi('friend-respond', { username: u, accept: true }),
  decline: (u) => acctApi('friend-respond', { username: u, accept: false }),
  remove: (u) => acctApi('friend-remove', { username: u }),
};
/* Boutons d'ami d'un joueur selon la relation (none, sent, received, friend) */
function socFriendBtns(u, rel, big) {
  const b = (act, label, cls = '') => `<button class="btn ${cls}" type="button" data-act="${act}" data-u="${esc(u)}">${label}</button>`;
  if (rel === 'none') return b('add', _t('Ajouter en ami'), big ? 'primary' : '');
  if (rel === 'sent') return `<span class="soc-tag">${_t('Demande envoyée')}</span>${big ? b('remove', _t('Annuler la demande')) : ''}`;
  if (rel === 'received') return b('accept', _t('Accepter'), 'primary') + b('decline', _t('Refuser'));
  if (rel === 'friend') return `<span class="soc-tag ok">${_t('Ami')}</span>${big ? b('remove', _t('Retirer des amis')) : ''}`;
  return '';
}
async function socDo(act, u, errBox) {
  if (SOC.busy) return; SOC.busy = true;
  try {
    const r = await SOC_CALL[act](u);
    if (!r.ok) { if (errBox) errBox.textContent = socErr(r); if (r.status === 422) socReload(); return; }
    sfxUi(act === 'decline' || act === 'remove' ? 'back' : 'click');
    const rel = r.data.relation;
    for (const p of SOC.rank.players) if (p.username === u) p.relation = rel;
    if (SOC.player.data && SOC.player.u.toLowerCase() === u.toLowerCase()) SOC.player.data.relation = rel;
    SOC.notifs.items = SOC.notifs.items.filter((n) => !(n.kind === 'friend_request' && n.from && n.from.username === u));
    if (UI.screen === 'ranking') { if (SOC.rank.scope === 'friends' && (act === 'remove')) socRankLoad(true); else socRankRender(); }
    else if (UI.screen === 'player') socPlayerRender();
    else if (UI.screen === 'notifs') socNotifRender();
    socNotifLoad(); amisLoad();
  } finally { SOC.busy = false; }
}
function socReload() { if (UI.screen === 'ranking') socRankLoad(true); else if (UI.screen === 'player') socPlayerLoad(SOC.player.u); else if (UI.screen === 'notifs') socNotifLoad(); }
/* Un clic sur un bouton [data-act] ou une ligne [data-open] de la racine */
function socBind(root, errId) {
  if (root._soc) return; root._soc = true;
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && root.contains(a)) { e.stopPropagation(); if (a.dataset.act === 'more') { socRankLoad(false); return; } socDo(a.dataset.act, a.dataset.u, $(errId)); return; }
    const o = e.target.closest('[data-open]');
    if (o && root.contains(o)) socOpenPlayer(o.dataset.open);
    const c = e.target.closest('[data-comm]'); // notification d'une réponse de l'équipe : l'onglet du message
    if (c && root.contains(c)) commOpen(['avis', 'idee', 'bug'].includes(c.dataset.comm) ? c.dataset.comm : '');
  });
}
function socOpenPlayer(u) {
  if (ACCT.user && u.toLowerCase() === ACCT.user.username.toLowerCase()) { sfxUi('click'); uiGo('profile'); return; }
  SOC.player = { u, data: null, err: '', busy: false, rep: null };
  sfxUi('click'); uiGo('player');
}

/* ---------- Classement ---------- */
function socRankLoad(reset) {
  const R = SOC.rank; if (R.busy) return;
  if (reset) { R.players = []; R.more = false; }
  R.busy = true; R.err = ''; socRankRender();
  const qs = new URLSearchParams({ scope: R.scope, offset: String(reset ? 0 : R.players.length) }); if (R.q) qs.set('q', R.q);
  acctApi('leaderboard?' + qs).then((r) => {
    R.busy = false;
    if (!r.ok) R.err = socErr(r); else { R.players = reset ? r.data.players : R.players.concat(r.data.players); R.more = r.data.more; R.me = r.data.me; R.loaded = true; }
    if (UI.screen === 'ranking') socRankRender();
  });
}
function socRankRender() {
  const body = $('rkBody'); if (!body) return;
  const R = SOC.rank;
  if (!ACCT.user) { body.innerHTML = `<p class="hint">${_t('Connectez-vous pour voir le classement.')}</p>`; return; }
  $('rkSub').textContent = !R.loaded ? '' : (R.me && R.me.rank ? _t('Vous êtes {0} sur {1} joueurs', ordinal(R.me.rank), fmtNum(R.me.total)) : _t('Vous n\u0027êtes pas encore classé'));
  const rows = R.players.map((p) => `<div class="rk-row${p.relation === 'me' ? ' me' : ''}" data-open="${esc(p.username)}" role="button" tabindex="0" aria-label="${esc(_t('Profil de {0}, niveau {1}', p.displayName, p.level))}">
      <b class="rk-n">${p.rank || '-'}</b><span class="acct-av" data-u="${esc(p.username)}" data-n="${esc(p.displayName)}">${socAv(p.username, p.displayName, p.avatar)}</span>
      <span class="rk-id"><b>${esc(p.displayName)}</b><small>@${esc(p.username)} · ${_t('Niveau {0}', p.level)}</small></span>
      <span class="rk-st"><b>${fmtNum(p.xp)}</b><small>XP</small></span><span class="rk-st"><b>${fmtNum(p.kd, 2)}</b><small>${_t('Ratio É/M')}</small></span>
      <span class="rk-act">${p.relation === 'me' ? `<span class="soc-tag">${_t('Vous')}</span>` : socFriendBtns(p.username, p.relation, false)}</span></div>`).join('');
  const empty = !R.players.length && !R.busy ? `<p class="hint">${R.scope === 'friends' && !R.q ? _t('Vous n\u0027avez pas encore d\u0027ami. Trouvez des joueurs dans le classement général et ajoutez-les.') : R.q ? _t('Aucun joueur trouvé.') : _t('Personne n\u0027est encore classé.')}</p>` : '';
  const how = R.loaded && !R.err ? `<p class="hint rk-how">${_t('Les joueurs sont classés selon toute l\u0027XP gagnée depuis leur inscription. Le classement ne repart jamais de zéro.')}</p>` : '';
  body.innerHTML = `<div class="rk-bar"><div class="seg" id="rkScope" role="radiogroup" aria-label="${esc(_t('Joueurs à afficher'))}"></div>
      <form class="rk-find" id="rkFind"><input name="q" maxlength="32" value="${esc(R.q)}" placeholder="${esc(_t('Chercher un joueur'))}" aria-label="${esc(_t('Chercher un joueur'))}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn" type="submit">${_t('Chercher')}</button></form></div>
    <p class="ac-err" id="rkErr" role="alert">${esc(R.err)}</p>
    <div class="rk-list">${rows}</div>${empty}${R.busy ? `<p class="hint">${_t('Chargement...')}</p>` : ''}${R.more || R.busy ? '' : how}
    ${R.more && !R.busy ? `<div class="btns"><button class="btn" type="button" data-act="more">${_t('Voir plus')}</button></div>` : ''}`;
  seg($('rkScope'), [['all', _t('Tous les joueurs')], ['friends', _t('Mes amis')]], () => R.scope, (v) => { R.scope = v; socRankLoad(true); });
  $('rkFind').addEventListener('submit', (e) => { e.preventDefault(); R.q = String(new FormData(e.target).get('q')).trim(); socRankLoad(true); });
  socAvFallback(body);
  for (const r of body.querySelectorAll('.rk-row')) r.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); socOpenPlayer(r.dataset.open); } });
}

/* ---------- Profil d'un joueur ---------- */
function socPlayerLoad(u) {
  const P = SOC.player; P.busy = true; P.err = ''; socPlayerRender();
  acctApi('player?u=' + encodeURIComponent(u)).then((r) => {
    if (SOC.player !== P) return;
    P.busy = false; if (r.ok) P.data = r.data; else P.err = socErr(r);
    if (UI.screen === 'player') socPlayerRender();
  });
}
function socPlayerRender() {
  const body = $('plBody'); if (!body) return;
  const P = SOC.player, d = P.data;
  $('plSub').textContent = d ? `@${d.user.username}` : P.u ? `@${P.u}` : '';
  if (!d) { body.innerHTML = P.err ? `<div class="card"><p class="ac-err" role="alert">${esc(P.err)}</p><div class="btns"><button class="btn" type="button" id="plRetry">${_t('Réessayer')}</button></div></div>` : `<p class="hint">${_t('Chargement...')}</p>`; if ($('plRetry')) $('plRetry').addEventListener('click', () => socPlayerLoad(P.u)); return; }
  const L = d.level;
  const rows = acctGamesHtml(d.recent, false); // pas d'XP ni de temps de jeu : le serveur ne les donne pas pour un autre joueur
  const since = new Date(d.user.createdAt), sinceTxt = isNaN(since) ? '' : ` · ${_t('Inscrit le {0}', fmtDate(since, { day: 'numeric', month: 'long', year: 'numeric' }))}`;
  // signaler (nom, photo, triche, comportement) : un formulaire sous l'en-tête du profil, envoyé à la modération (api/_lib/moderation.js)
  const rep = P.rep, mine = d.relation === 'me';
  const repBtn = mine ? '' : rep && rep.sent ? `<span class="soc-tag">${_t('Signalé')}</span>` : `<button class="btn" type="button" id="plRep" aria-expanded="${rep ? 'true' : 'false'}">${_t('Signaler')}</button>`;
  const repCard = rep && !rep.sent ? `<div class="card pl-rep"><h3 class="lbl">${_t('Signaler {0}', esc(d.user.displayName))}</h3>
      <p class="hint">${_t('La modération regarde chaque signalement. Pour quelle raison ?')}</p>
      <div class="seg" id="plRepWhy" role="radiogroup" aria-label="${esc(_t('Raison du signalement'))}"></div>
      <input id="plRepNote" maxlength="200" value="${esc(rep.note)}" placeholder="${esc(_t('Précisez si besoin (facultatif)'))}" aria-label="${esc(_t('Précisez si besoin (facultatif)'))}" autocomplete="off">
      <p class="ac-err" id="plRepErr" role="alert">${esc(rep.err)}</p>
      <div class="btns"><button class="btn primary" type="button" id="plRepGo"${rep.why && !rep.busy ? '' : ' disabled'}>${_t('Envoyer le signalement')}</button><button class="btn" type="button" id="plRepNo">${_t('Annuler')}</button></div></div>` : '';
  body.innerHTML = `${rep && rep.sent ? `<p class="ac-note">${_t('Merci : la modération va regarder ce signalement.')}</p>` : ''}<div class="card ac-top"><span class="acct-av pl-av" data-u="${esc(d.user.username)}" data-n="${esc(d.user.displayName)}">${socAv(d.user.username, d.user.displayName, d.user.avatar)}</span>
      <div class="ac-id"><h3>${esc(d.user.displayName)}</h3><p>@${esc(d.user.username)} · ${_t('Niveau {0}', L.level)}${d.rank ? ' · ' + _t('{0} au classement', ordinal(d.rank)) : ''}${esc(sinceTxt)}</p>
        <div class="ac-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}"><i style="transform:scaleX(${L.need ? L.into / L.need : 1})"></i></div>
        <div class="soc-acts">${mine ? `<button class="btn" type="button" id="plMine">${_t('Mon profil')}</button>` : socFriendBtns(d.user.username, d.relation, true)}${repBtn}</div>
        <p class="ac-err" id="plErr" role="alert"></p></div></div>${repCard}
    <div class="ac-cols pl-cols">
      <div class="card pl-rank"><h3 class="lbl">${_t('Classement')}</h3>${d.rank ? acctKpis([[ordinal(d.rank), _t('Rang')], [fmtNum(L.xp), 'XP']]) : `<p class="hint">${_t('Pas encore classé.')}</p>`}</div>
      <div class="card ac-games"><h3 class="lbl">${_t('Dernières parties')}</h3>${rows || `<p class="hint">${_t('Aucune partie enregistrée.')}</p>`}</div></div>
    ${acctStatsHtml(d.stats, false)}`;
  socAvFallback(body);
  if ($('plMine')) $('plMine').addEventListener('click', () => { sfxUi('click'); uiGo('profile'); });
  if ($('plRep')) $('plRep').addEventListener('click', () => { sfxUi('click'); P.rep = P.rep ? null : { why: '', note: '', err: '', busy: false, sent: false }; socPlayerRender(); });
  if (rep && !rep.sent) {
    const why = [['nom', _t('Nom')], ...(d.user.avatar ? [['photo', _t('Photo')]] : []), ['triche', _t('Triche')], ['comportement', _t('Comportement')]];
    seg($('plRepWhy'), why, () => rep.why, (v) => { rep.why = v; $('plRepGo').disabled = false; });
    $('plRepNote').addEventListener('input', (e) => { rep.note = e.target.value; });
    $('plRepNo').addEventListener('click', () => { sfxUi('back'); P.rep = null; socPlayerRender(); });
    $('plRepGo').addEventListener('click', async () => {
      if (!rep.why || rep.busy) return;
      rep.busy = true; rep.err = ''; $('plRepGo').disabled = true;
      const r = await acctApi('report', { username: d.user.username, reason: rep.why, note: rep.note });
      rep.busy = false;
      if (SOC.player !== P || P.rep !== rep) return;
      if (r.ok) { rep.sent = true; sfxUi('click'); } else rep.err = socErr(r);
      if (UI.screen === 'player') socPlayerRender();
    });
  }
}

/* ---------- Notifications ---------- */
function socNotifLoad() {
  const N = SOC.notifs; if (N.busy || !ACCT.user) return;
  N.busy = true;
  acctApi('notifications').then((r) => {
    N.busy = false; if (!r.ok || !r.data) return;
    if (N.loaded && r.data.unread > N.unread) sfxUi('notify'); // nouvelle notification depuis le dernier relevé
    N.loaded = true; N.unread = r.data.unread; N.items = r.data.items; socBadge();
    if (UI.screen === 'notifs') socNotifRender();
  });
}
/* Texte d'une notification (le serveur n'envoie que le genre) */
function socNotifText(n) {
  const who = n.from ? `<b>${esc(n.from.displayName)}</b>` : '';
  if (n.kind === 'friend_request') return _t('{0} vous a envoyé une demande d\u0027ami.', who);
  if (n.kind === 'friend_accepted') return _t('{0} a accepté votre demande d\u0027ami.', who);
  if (n.kind === 'salon_invite') return _t('{0} vous a invité dans son salon {1}.', who, esc(String(n.data && n.data.code || '')));
  if (n.kind === 'levelup') return _t('Vous avez atteint le niveau {0} !', esc(String(n.data && n.data.level || '')));
  if (n.kind === 'welcome') return _t('Bienvenue dans Riposte: Frontline ! Retrouvez les autres joueurs dans le classement et ajoutez-les en ami.');
  if (n.kind === 'mod_photo') return _t('La modération a retiré votre photo de profil. Elle ne respectait pas les règles du jeu.');
  if (n.kind === 'mod_name') return _t('La modération a remis votre nom d\u0027affichage à votre nom d\u0027utilisateur. L\u0027ancien ne respectait pas les règles du jeu.');
  if (n.kind === 'mod_board') return _t('La modération vous a retiré du classement (triche ou abus).');
  if (n.kind === 'comm_reply') return _t('L\u0027équipe a répondu à votre message dans Communauté.');
  if (n.kind === 'recovery') return _t('Un nouveau code de secours a été créé pour votre compte. Si ce n\u0027est pas vous, changez votre mot de passe dans Profil. Cela remplace aussi le code.');
  return '';
}
/* Pictogramme d'une notification selon son genre : la forme le dit (ajout, accord, niveau, bienvenue, code de secours, modération), la couleur l'appuie */
const NF_IC = {
  friend_request: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6"/>',
  friend_accepted: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M15.5 11l2.2 2.2 4-4.4"/>',
  salon_invite: '<path d="M3.5 6.5h17v11h-17z"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  levelup: '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/>',
  welcome: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  recovery: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M15.5 7.5l3 3M13.5 9.5l2 2"/>',
  mod: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8v5M12 16.5v.2"/>',
  comm_reply: '<path d="M4 4.5h16v11H9.5L5 19.5v-4H4z"/><path d="M8 9h8M8 12h5"/>',
};
function socNotifRender() {
  const body = $('nfBody'); if (!body) return;
  const N = SOC.notifs;
  if (!ACCT.user) { body.innerHTML = `<p class="hint">${_t('Connectez-vous pour voir vos notifications.')}</p>`; return; }
  const items = N.items.filter((n) => socNotifText(n));
  for (const n of N.items) if (!n.read) N.fresh.add(n.id); // ce qui est nouveau reste en relief le temps de la visite
  const li = items.map((n) => `<li class="nf${N.fresh.has(n.id) ? ' new' : ''}"><span class="nf-ic nf-${esc(n.kind)}" aria-hidden="true"><svg viewBox="0 0 24 24">${NF_IC[n.kind] || NF_IC[n.kind.startsWith('mod_') ? 'mod' : 'welcome']}</svg></span>
      <div class="nf-tx"><p>${socNotifText(n)}</p><small>${N.fresh.has(n.id) ? `<span class="nf-tag">${_t('Nouveau')}</span>` : ''}${esc(socAgo(n.at))}</small>
        ${n.from && n.kind !== 'levelup' ? `<div class="nf-acts">${n.pending ? socFriendBtns(n.from.username, 'received', false) : ''}<button class="btn" type="button" data-open="${esc(n.from.username)}">${_t('Voir le profil')}</button></div>` : ''}${n.kind === 'comm_reply' ? `<div class="nf-acts"><button class="btn" type="button" data-comm="${esc(n.data && n.data.k || '')}">${_t('Voir la réponse')}</button></div>` : ''}</div></li>`).join('');
  body.innerHTML = `<p class="ac-err" id="nfErr" role="alert"></p>
    ${li ? `<ul class="nf-list">${li}</ul><div class="btns"><button class="btn" type="button" id="nfClear">${_t('Effacer les notifications lues')}</button></div>` : `<div class="card"><p class="hint">${N.loaded ? _t('Aucune notification pour le moment.') : _t('Chargement...')}</p></div>`}`;
  const c = $('nfClear'); if (c) c.addEventListener('click', async () => { const r = await acctApi('notifications-read', { clear: true }); if (r.ok) { sfxUi('back'); N.fresh.clear(); socNotifLoad(); } });
  // écran ouvert : tout est lu côté serveur
  if (N.unread) { N.unread = 0; for (const n of N.items) n.read = true; socBadge(); acctApi('notifications-read', {}); }
}

/* ---------- Écrans ---------- */
function socScreen(name) {
  if (name === 'ranking') { socBind($('rkBody'), 'rkErr'); SOC.rank.me = null; socRankLoad(true); }
  else if (name === 'player') { socBind($('plBody'), 'plErr'); socPlayerLoad(SOC.player.u); }
  else if (name === 'notifs') { socBind($('nfBody'), 'nfErr'); SOC.notifs.fresh.clear(); socNotifRender(); socNotifLoad(); }
}
function socInit() { socChanged(); }
