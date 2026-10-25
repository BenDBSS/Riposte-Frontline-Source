/* ==========================================================================
   AMIS : écran Amis, présence, invitations dans un salon, écran Jouer
   L'écran Amis (friends) : ajouter un ami par son nom, les demandes reçues et envoyées, les amis en ligne avec ce qu'ils font (au menu,
   dans un salon, en partie) et ceux hors ligne. Tout passe par l'API (Vercel) : la liste (/api/friends), la présence (le jeu se signale
   par /api/presence toutes les 20 s aux menus, toutes les minutes en partie) et les invitations dans un salon (/api/salon-invite) : depuis
   son salon (Inviter des amis, ou l'écran Amis), on invite un ami connecté, qui reçoit l'invitation à son signal suivant, dans un encart en
   haut des menus, et entre dans le salon d'un toucher, sans taper le code. Un groupe tenu par le serveur de jeu (canal /groupe, 5.2.2) a
   été essayé puis retiré (retour du propriétaire).
   ========================================================================== */
const AMIS = {
  list: null, received: [], out: [], loading: false, err: '', note: '', at: 0, // liste de l'API, avec la présence des amis (relue au plus toutes les 20 s)
  inv: [], gone: new Set(), // invitations reçues encore valables (presence) ; celles répondues ou écartées (ids)
  sent: {}, // invitations envoyées : nom d'utilisateur (minuscules) -> code du salon
  tick: 0, last: 0, busy: false, // signal de présence (dernier envoi)
};

/* ---------- Présence et invitations reçues ---------- */
/* Compte connecté ou déconnecté (socChanged) : signal de présence, liste d'amis ; ou tout s'efface */
function amisChanged() {
  if (!ACCT.user) { Object.assign(AMIS, { list: null, received: [], out: [], err: '', note: '', inv: [], sent: {} }); amisInviteCard(); return; }
  if (!AMIS.tick) {
    AMIS.tick = setInterval(amisTick, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ACCT.user) amisPing(); });
  }
  amisPing(); if (!AMIS.list) amisLoad();
}
function amisState() { return MATCH.state !== 'menu' ? 'partie' : netInLobby() ? 'salon' : 'menu'; }
function amisInvitePageOpen() { const L = LM.scr.multi; return UI.screen === 'multi' && !!L && L.stack.length > 0 && L.stack[L.stack.length - 1].id === 'invite'; }
function amisTick() {
  if (!ACCT.user || document.hidden) return;
  amisInviteCard(); // (une partie finie, un salon quitté : l'encart revient)
  if (Date.now() - AMIS.last >= (MATCH.state === 'menu' ? 20000 : 60000)) amisPing();
  // listes ouvertes (écran Amis, invitation depuis le salon) : la présence des amis relue toutes les 20 s
  if ((UI.screen === 'friends' || amisInvitePageOpen()) && Date.now() - AMIS.at > 20000) amisLoad();
}
async function amisPing() {
  if (!ACCT.user || AMIS.busy) return;
  AMIS.busy = true; AMIS.last = Date.now();
  try {
    const r = await acctApi('presence', { s: amisState() });
    if (!r.ok || !r.data) return;
    if (Array.isArray(r.data.invites)) AMIS.inv = r.data.invites.filter((i) => !AMIS.gone.has(i.id) && i.from && /^[A-Z0-9]{5}$/.test(i.code));
    if (typeof r.data.unread === 'number' && r.data.unread !== SOC.notifs.unread) { SOC.notifs.unread = r.data.unread; socBadge(); }
    amisInviteCard();
  } finally { AMIS.busy = false; }
}
/* Invitation reçue : un encart à droite des menus (la plus récente), sauf dans le salon où elle mène */
function amisInviteCard() {
  const el = $('amiInvite'); if (!el) return;
  const i = AMIS.inv.find((x) => !AMIS.gone.has(x.id) && x.code !== netCodeNow());
  const show = !!i && !!ACCT.user && MATCH.state === 'menu' && UI.screen !== 'friends'; // (l'écran Amis la montre dans sa liste)
  el.classList.toggle('hidden', !show);
  if (!show || el.dataset.id === String(i.id)) return;
  el.dataset.id = String(i.id);
  el.innerHTML = `<p>${_t('{0} vous invite dans son salon.', `<b>${esc(i.from.displayName)}</b>`)}</p><div class="btns"><button class="btn primary" type="button" data-a="ok">${_t('Rejoindre')}</button><button class="btn" type="button" data-a="no">${_t('Refuser')}</button></div>`;
  el.querySelector('[data-a="ok"]').addEventListener('click', () => amisJoin(i));
  el.querySelector('[data-a="no"]').addEventListener('click', () => amisDecline(i));
}
function amisDone(i) { AMIS.gone.add(i.id); AMIS.inv = AMIS.inv.filter((x) => x.id !== i.id); $('amiInvite').dataset.id = ''; amisInviteCard(); acctApi('invite-answer', { id: i.id }); }
function amisDecline(i) { sfxUi('back'); amisDone(i); }
/* Rejoindre : le salon d'avant est quitté ; en quittant celui-ci, on revient à l'écran où l'on était (UI.lobbyBack) */
function amisJoin(i) {
  sfxUi('click'); amisDone(i);
  if (!acctGate(i.code)) return;
  const go = () => { const was = UI.screen; uiGo('multi'); netJoinCode(i.code); if (was !== 'multi') UI.lobbyBack = true; };
  if (netInLobby()) { netQuit(); setTimeout(go, 300); } else go();
}

/* ---------- Liste d'amis ---------- */
function amisLoad() {
  if (!ACCT.user || AMIS.loading) return;
  AMIS.loading = true; AMIS.at = Date.now();
  acctApi('friends').then((r) => {
    AMIS.loading = false;
    if (!r.ok || !r.data) { AMIS.err = socErr(r); amisRender(); return; }
    AMIS.err = ''; AMIS.list = r.data.friends || []; AMIS.received = r.data.received || []; AMIS.out = r.data.sent || [];
    amisRender();
  });
}
function amisRender() { if (UI.screen === 'friends') amisFriendsRender(); if (amisInvitePageOpen()) netRender(); }
/* Action sur un ami (ajouter, accepter, refuser, retirer) : la même voie que les autres écrans, puis la liste relue */
async function amisFriendDo(act, u) {
  if (SOC.busy) return; SOC.busy = true;
  try {
    const r = await SOC_CALL[act](u);
    if (!r.ok) { AMIS.note = socErr(r); amisRender(); return; }
    sfxUi(act === 'decline' || act === 'remove' ? 'back' : 'click');
    AMIS.note = act === 'add' ? (r.data.relation === 'friend' ? _t('Vous êtes maintenant amis.') : _t('Demande d\u0027ami envoyée.')) : '';
    amisLoad(); socNotifLoad();
  } finally { SOC.busy = false; }
}
/* Ce que fait un ami (en ligne, d'après son dernier signal) */
function amisStatus(f) { return !f.online ? _t('Hors ligne') : { salon: _t('Dans un salon'), partie: _t('En partie') }[f.state] || _t('Au menu'); }
/* Inviter un ami dans son salon (le code du salon en cours) */
async function amisSend(u) {
  const code = netCodeNow(); if (!code || !netInLobby()) return;
  sfxUi('click');
  const r = await acctApi('salon-invite', { username: u, code });
  if (!r.ok) { amisToast(socErr(r)); return; }
  AMIS.sent[u.toLowerCase()] = code;
  const f = (AMIS.list || []).find((x) => x.username === u);
  amisToast(_t('Invitation envoyée à {0}.', f ? f.displayName : u)); amisRender();
}
const amisSentHere = (u) => AMIS.sent[u.toLowerCase()] === netCodeNow();
/* Message bref en bas des menus (invitation envoyée, refusée...) */
function amisToast(text) {
  const el = $('amiNote'); if (!el) return;
  el.textContent = text; el.classList.remove('hidden');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}
/* Le salon (menu Multijoueur, Inviter des amis) : ses amis, connectés d'abord, à inviter d'un toucher ; puis le code et le lien */
function amisInviteRows() {
  if (!ACCT.user) return [];
  if (Date.now() - AMIS.at > 20000) amisLoad();
  const rows = [{ k: 'sep', label: _t('Vos amis') }], list = (AMIS.list || []).slice().sort((a, b) => b.online - a.online);
  if (!AMIS.list) rows.push({ k: 'note', text: AMIS.err || _t('Chargement...') });
  else if (!list.length) rows.push({ k: 'note', text: _t('Ajoutez des amis dans le menu Amis pour les inviter ici.') });
  for (const f of list) {
    const sent = amisSentHere(f.username);
    rows.push({ k: 'pick', key: 'ami:' + f.username, label: f.displayName, sub: sent ? _t('Invitation envoyée') : amisStatus(f), value: f.online ? (sent ? _t('Renvoyer') : _t('Inviter')) : '', disabled: !f.online, pick: () => amisSend(f.username) });
  }
  rows.push({ k: 'sep', label: _t('Code et lien') });
  return rows;
}

/* ---------- Écran Amis ---------- */
function amisFriendsScreen() {
  const body = $('frBody'); if (!body) return;
  if (!body._amis) {
    body._amis = true;
    body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-fa]'); if (!a || !body.contains(a)) { const o = e.target.closest('[data-open]'); if (o && body.contains(o)) socOpenPlayer(o.dataset.open); return; }
      e.stopPropagation();
      const k = a.dataset.fa, v = a.dataset.v;
      if (k === 'invite') amisSend(v); else if (k === 'join' || k === 'nojoin') { const i = AMIS.inv.find((x) => String(x.id) === v); if (i) (k === 'join' ? amisJoin : amisDecline)(i); }
      else amisFriendDo(k, v);
    });
    body.addEventListener('submit', (e) => {
      if (e.target.id !== 'frAdd') return;
      e.preventDefault();
      const u = String(new FormData(e.target).get('u') || '').trim().replace(/^@/, '');
      if (u) amisFriendDo('add', u);
    });
  }
  AMIS.note = ''; amisLoad(); amisFriendsRender();
}
function amisFriendsRender() {
  const body = $('frBody'); if (!body) return;
  if (!ACCT.user) { body.innerHTML = `<p class="hint">${_t('Connectez-vous pour retrouver vos amis.')}</p>`; return; }
  const on = AMIS.list ? AMIS.list.filter((f) => f.online) : [], off = AMIS.list ? AMIS.list.filter((f) => !f.online) : [], lobby = netInLobby();
  $('frSub').textContent = AMIS.list ? _tn(on.length, '{0} ami en ligne', '{0} amis en ligne') : '';
  const btn = (fa, v, label, cls = '') => `<button class="btn ${cls}" type="button" data-fa="${fa}" data-v="${esc(v)}">${label}</button>`;
  const row = (f, status, acts, cls = '') => `<div class="rk-row fr-row ${cls}" data-open="${esc(f.username)}" role="button" tabindex="0" aria-label="${esc(_t('Profil de {0}, niveau {1}', f.displayName, f.level))}">
      <span class="acct-av" data-u="${esc(f.username)}" data-n="${esc(f.displayName)}">${socAv(f.username, f.displayName, f.avatar)}</span>
      <span class="rk-id"><b>${esc(f.displayName)}</b><small>@${esc(f.username)} · ${_t('Niveau {0}', f.level)}</small></span>
      <span class="fr-st">${status}</span><span class="rk-act">${acts}</span></div>`;
  // dans un salon : inviter un ami connecté ; sinon rien à faire de plus qu'ouvrir son profil
  const onRows = on.map((f) => row(f, `<i class="fr-dot" aria-hidden="true"></i>${esc(amisStatus(f))}`, lobby ? btn('invite', f.username, amisSentHere(f.username) ? _t('Renvoyer l\u0027invitation') : _t('Inviter dans mon salon'), amisSentHere(f.username) ? '' : 'primary') : '', 'on')).join('');
  const offRows = off.map((f) => row(f, esc(_t('Hors ligne')), '', 'off')).join('');
  const recRows = AMIS.received.map((f) => row(f, esc(_t('Demande reçue')), btn('accept', f.username, _t('Accepter'), 'primary') + btn('decline', f.username, _t('Refuser')))).join('');
  const outRows = AMIS.out.map((f) => row(f, esc(_t('Demande envoyée')), btn('remove', f.username, _t('Annuler')))).join('');
  const invRows = AMIS.inv.filter((i) => !AMIS.gone.has(i.id)).map((i) => `<div class="card fr-inv"><p>${_t('{0} vous invite dans son salon.', `<b>${esc(i.from.displayName)}</b>`)}</p><div class="btns">${btn('join', String(i.id), _t('Rejoindre'), 'primary')}${btn('nojoin', String(i.id), _t('Refuser'))}</div></div>`).join('');
  const sec = (title, html) => (html ? `<h3 class="lbl">${title}</h3><div class="rk-list">${html}</div>` : '');
  body.innerHTML = `<div class="rk-bar"><form class="rk-find" id="frAdd"><input name="u" maxlength="32" placeholder="${esc(_t('Nom d\u0027utilisateur'))}" aria-label="${esc(_t('Nom d\u0027utilisateur de l\u0027ami à ajouter'))}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn primary" type="submit">${_t('Ajouter')}</button></form></div>
    <p class="ac-err" role="alert">${esc(AMIS.err || '')}</p>${AMIS.note ? `<p class="ac-note">${esc(AMIS.note)}</p>` : ''}
    ${invRows}
    ${sec(_t('Demandes reçues'), recRows)}
    ${sec(_t('En ligne ({0})', on.length), onRows)}
    ${sec(_t('Hors ligne ({0})', off.length), offRows)}
    ${sec(_t('Demandes envoyées'), outRows)}
    ${AMIS.list && !AMIS.list.length && !AMIS.received.length ? `<div class="card"><p class="hint">${_t('Vous n\u0027avez pas encore d\u0027ami. Ajoutez un joueur par son nom d\u0027utilisateur, ou depuis le classement (Joueurs).')}</p></div>` : ''}
    ${!AMIS.list && AMIS.loading ? `<p class="hint">${_t('Chargement...')}</p>` : ''}`;
  socAvFallback(body);
  for (const r of body.querySelectorAll('.rk-row')) r.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); socOpenPlayer(r.dataset.open); } });
}

/* ---------- Écran Jouer ----------
   Trois façons de jouer, en cartes à icône (retour du propriétaire : pas d'illustration de carte) : Solo (contre des bots, sans connexion),
   Entre amis (un salon privé du serveur de jeu, contre des bots : on y invite ses amis connectés) et Parties publiques (le navigateur des
   salons publics que des joueurs ont lancés, et la création d'un salon). */
const PLAY_ICON = {
  solo: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z',
  prive: 'M9 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm7.5 0a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM1.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5v.5h-15V20Zm16.4.5c.07-.33.1-.66.1-1 0-2.2-1-4.2-2.6-5.5.5-.1 1-.2 1.6-.2 3.3 0 6 2.4 6 5.5v1.2h-5.1Z',
  public: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4ZM4.3 14a8 8 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8ZM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6Zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8 8 0 0 1 0 4h-3.4Z',
};
function playRender() {
  const el = $('playGrid'); if (!el) return;
  const cards = [
    ['solo', _t('Solo'), _t('Vous contre des bots, sans connexion. Pour s\u0027entraîner.')],
    ['prive', _t('Entre amis'), _t('Un salon privé contre des bots. Invitez vos amis connectés depuis le salon.')],
    ['public', _t('Parties publiques'), _t('Les salons publics lancés par des joueurs. Vous pouvez aussi y créer votre salon.')],
  ];
  el.innerHTML = cards.map(([k, b, s]) => `<button class="play-card" type="button" data-play="${k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLAY_ICON[k]}"/></svg><b>${b}</b><span>${s}</span></button>`).join('');
}
/* Entre amis : le salon privé se crée et s'ouvre (Inviter des amis y est à portée, sans s'ouvrir tout seul, retour du propriétaire) ; en le
   quittant, on revient ici (UI.lobbyBack, netLeaveClose) */
function playPick(k) {
  sfxUi('click');
  if (k === 'solo') { uiGo('solo'); return; }
  if (!acctGate()) return;
  if (netInLobby()) { uiGo('multi'); UI.lobbyBack = true; return; }
  if (k === 'prive') { srvCreate(false); uiGo('multi'); UI.lobbyBack = true; return; }
  uiGo('multi');
}
function playInit() {
  const el = $('playGrid'); if (!el || el._play) return;
  el._play = true;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-play]'); if (b && !b.disabled) playPick(b.dataset.play); });
  // le salon : ses amis à inviter avant le code et le lien (NET_PAGES.invite, 09c-net.js)
  const base = NET_PAGES.invite;
  NET_PAGES.invite = () => { const p = base(); p.rows = amisInviteRows().concat(p.rows); return p; };
}
