/* ==========================================================================
   SALONS PUBLICS PERMANENTS (serveur de jeu, serveur/relais.js, « Salons permanents » de serveur/README.md)
   Le serveur de jeu tient ouverts plusieurs salons par mode, sans hôte : personne ne règle la partie. Les joueurs y entrent depuis la
   liste de l'écran Multijoueur, ou par « Rejoindre une partie », qui demande le mode puis place le joueur dans le salon de ce mode qui
   compte le plus de joueurs. Le serveur tient la liste des joueurs (pas les bots), le vote et le décompte : sous le seuil (la moitié
   des places), on attend ; au seuil, décompte, et deux cartes au vote, en bas à gauche ; peu avant la fin, la carte qui a le plus de
   voix est retenue. À la fin du décompte, le serveur choisit l'un des joueurs pour héberger la partie (un ordinateur de préférence) :
   son jeu ouvre un salon ordinaire avec le code que le serveur lui donne (netHost, src/09c-net.js), le serveur annonce ce code aux
   autres, qui le rejoignent (netJoinLobby) ; la partie se déroule comme dans un salon entre amis. Après la partie, chacun revient au
   salon public, où le décompte de la suivante a commencé, avec deux nouvelles cartes au vote.
   Le salon de la partie (NET.role 'host' ou 'client', NET.srv) vit à côté de la connexion au salon public (SRV.ws) ; il est refermé,
   sans toucher à la discussion du salon public, quand la partie est finie et que le joueur est revenu aux menus (srvSync).
   Salons créés par les joueurs (st.ps) : tenus aussi par le serveur, publics ou privés, tous dans la liste (un privé sans son code :
   on n'y entre qu'en le tapant). Leur chef (le créateur, puis le plus ancien s'il part) règle la partie (carte, mode, bots, limite,
   durée, public ou privé), déplace ou exclut un joueur et lance la partie ; chacun choisit son équipe. Pas de seuil ni de vote. La
   partie, elle, est hébergée comme dans un salon permanent par le joueur que choisit le serveur, avec les réglages du salon.
   Si l'hôte d'une partie s'en va, le serveur la confie à un autre joueur qui y est (SRV.jeu, envoyé au serveur), dont le jeu la reprend
   sans l'arrêter (netTakeOver, src/09c-net.js).
   Depuis la 5.2.2 (retour du propriétaire), la liste ne montre plus que les salons publics lancés par des joueurs, et seulement s'ils ont
   du monde : les salons permanents restent tenus par le serveur, mais le jeu ne les propose plus (ni dans la liste, ni par « Rejoindre une
   partie », retiré).
   Un serveur de jeu qui ne connaît pas encore les salons permanents (GET /salons sans « serveurs ») : SRV.list reste null et
   l'écran Multijoueur garde l'accueil d'avant (Jouer maintenant, salons ouverts par un hôte).
   ========================================================================== */
const SRV = {
  list: null, crees: [], // salons permanents de la dernière liste (null : le serveur n'en a pas), salons créés par les joueurs
  make: null, byCode: false, kickAsk: '', // réglages d'un salon à créer ; entrée par un code (repli : salon d'un hôte) ; exclusion à confirmer
  on: false, id: '', ws: null, st: null, at: 0, // dans un salon public : son identifiant, la connexion, son dernier état (reçu à at)
  me: '', key: '', fails: 0, timer: 0, up: false, // mon identifiant et ma clé dans ce salon (gardés d'une reconnexion à l'autre)
  hostCode: '', wait: null, opened: false, // partie que j'héberge : son code, qui attendre avant de la lancer ({ n, t }), annoncée au serveur
  tried: '', triedT: 0, tries: 0, // dernier salon de partie essayé (pas de nouvel essai du même avant 5 s) et nombre d'essais de ce salon
  jeu: -1, // dernier « en partie ou non » annoncé au serveur (seul un joueur en partie peut la reprendre si son hôte s'en va)
  voteKey: '', // contenu affiché du bloc de vote (reconstruit seulement quand il change)
};
const SRV_TRIES = 3; // essais d'entrée dans le salon d'une même partie avant d'y renoncer (hôte parti ou muet : sans cela, le jeu recommençait sans fin)
const SRV_WAIT = 6000; // l'hôte attend au plus 6 s que les joueurs du salon public soient entrés dans le salon de la partie avant de la lancer
const SRV_PHASES = ['attente', 'decompte', 'lancement', 'partie'];
/* Dans un salon, public ou entre amis (l'écran Multijoueur montre alors le salon, Retour demande de le quitter) */
function netInLobby() { return NET.role !== 'off' || SRV.on; }
/* Valeur d'hébergement envoyée au serveur : un ordinateur au premier plan d'abord, puis un téléphone, jamais un onglet caché */
function srvHostScore() { return document.hidden ? 0 : TOUCH.on ? 1 : 2; }
/* Salons de la liste reçue (GET /salons, netPubFetch) : bornés, ceux d'une autre version du jeu écartés (sauf vides) */
function srvRead(d) {
  SRV.list = srvParse(d);
  SRV.crees = !SRV.list || !Array.isArray(d.crees) ? [] : d.crees.filter((s) => s && (s.i === '' || /^[A-Z0-9]{5}$/.test(s.i)) && MODES[s.o] && MAPS.some((m) => m.id === s.m && m.ok) && SRV_PHASES.includes(s.p) && s.v === NET_PROTO)
    .map((s) => ({ i: s.i, o: s.o, m: s.m, j: clamp(s.j | 0, 0, 99), x: clamp(s.x | 0, 1, 99), p: s.p, n: netClean(s.n), pv: !!s.pv }));
}
function srvParse(d) {
  if (!d || !Array.isArray(d.serveurs)) return null;
  return d.serveurs.filter((s) => s && /^[a-z]{3}[0-9]{1,2}$/.test(s.i) && MODES[s.o] && MAPS.some((m) => m.id === s.m && m.ok) && SRV_PHASES.includes(s.p) && (s.v === NET_PROTO || !(s.j > 0)))
    .map((s) => ({ i: s.i, o: s.o, k: clamp(s.k | 0, 1, 99), m: s.m, j: clamp(s.j | 0, 0, 99), x: clamp(s.x | 0, 1, 99), p: s.p }));
}
function srvSend(m) { const ws = SRV.ws; if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); } catch (e) { /* connexion en cours de fermeture */ } } }

/* ---------- Entrer, rester, sortir ---------- */
/* Entre dans un salon du serveur : un salon permanent (id 'tdm1'), un salon créé (son code), ou un salon à créer ('nouveau', o.make : ses
   réglages) ; o.code : code tapé par le joueur (s'il n'est pas sur le serveur, c'est peut-être le salon d'un hôte, rejoint ensuite) */
function srvJoin(id, o = {}) {
  if (netInLobby() || !netViaServer() || !acctGate(o.code ? id : undefined)) return;
  netNick();
  Object.assign(SRV, { on: true, jeu: -1, id, st: null, at: 0, me: 's' + netrRandom(10), key: netrRandom(24), fails: 0, up: false, hostCode: '', wait: null, tried: '', tries: 0, voteKey: '', make: o.make || null, byCode: !!o.code, kickAsk: '' });
  chatClear(); NET.muted.clear();
  netdReset('srv', id); netdLog('salon public ' + id + ' : connexion');
  netStatus(_t('Connexion au salon...'));
  srvConnect();
  netRender({ fresh: true });
}
function srvConnect() {
  if (!SRV.on) return;
  SRV.lv = playerLevel(); // niveau annoncé à l'entrée ; ses changements suivent (srvLevel)
  const q = new URLSearchParams({ id: SRV.me, key: SRV.key, v: String(NET_PROTO), n: NET.nick, lv: String(SRV.lv), h: String(srvHostScore()), ...(SRV.id === 'nouveau' ? SRV.make : {}) });
  let ws;
  try { ws = new WebSocket(netrUrl() + '/serveur/' + SRV.id + '?' + q); } catch (e) { srvLost(0); return; }
  SRV.ws = ws;
  ws.onopen = () => { if (SRV.ws === ws) { SRV.up = true; SRV.fails = 0; SRV.jeu = -1; NETD.rel = 'ok'; } }; // (« en partie » de nouveau annoncé après une reconnexion)
  ws.onmessage = (e) => {
    if (SRV.ws !== ws || typeof e.data !== 'string') return;
    if (e.data.charCodeAt(0) === 2) { const [cmd, a] = e.data.slice(1).split(NETR_SEP); if (cmd === 'refuse') ws.refused = Number(a) || 4001; return; }
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m && typeof m === 'object') srvMsg(m);
  };
  ws.onclose = (e) => { if (SRV.ws === ws) srvLost(ws.refused || e.code); };
  ws.onerror = () => { /* onclose suit toujours */ };
}
/* Connexion au salon public perdue : un refus fait sortir du salon, comme trois échecs avant d'y être entré ; une coupure fait réessayer sans
   fin (le serveur garde la place quelques secondes, et une partie en cours n'en dépend pas) */
function srvLost(code) {
  SRV.ws = null; NETD.relCode = code; netdLog('salon public : fermé (code ' + code + ')');
  if (!SRV.on) return;
  if (SRV.byCode && !SRV.st && (code === 4004 || !SRV.up)) { const c = SRV.id; srvLeave(''); netJoinLobby(c); return; } // pas sur le serveur : le salon d'un hôte ?
  const why = { 4004: _t('Ce salon public n\u0027existe plus. Choisissez-en un autre.'), 4003: _t('Le chef du salon vous a exclu.'), 4002: _t('Ce salon public est complet.'), 4005: _t('Ce salon public accueille une autre version du jeu. Choisissez-en un autre.'),
    4011: _t('Vous êtes déjà dans ce salon depuis un autre onglet.'), 4029: _t('Le serveur de jeu est saturé. Réessayez dans un instant.'), 4013: _t('Le serveur de jeu est saturé. Réessayez dans un instant.') }[code];
  if (SRV.up) { SRV.up = false; SRV.fails = 0; } // coupure après une connexion réussie : les essais repartent de zéro
  SRV.fails++;
  if (why || (!SRV.st && SRV.fails >= 3)) { srvLeave(why || _t('Le serveur de jeu est injoignable.')); if (!why) { NETD.rel = 'fail'; netdShow(true); } return; }
  const wait = NETR.retry[Math.min(SRV.fails - 1, NETR.retry.length - 1)];
  clearTimeout(SRV.timer); SRV.timer = setTimeout(srvConnect, wait);
  netRender();
}
/* Quitte le salon public, et le salon de sa partie s'il y en a un ; msg : texte d'état de l'accueil */
function srvLeave(msg) {
  const ws = SRV.ws;
  clearTimeout(SRV.timer);
  Object.assign(SRV, { on: false, ws: null, st: null, hostCode: '', wait: null, voteKey: '' });
  if (ws) { try { ws.close(1000); } catch (e) { /* déjà fermée */ } } // 1000 : départ voulu, la place se libère tout de suite
  netReset(msg); // salon de la partie, discussion, état de l'écran
}

/* ---------- Messages du serveur ---------- */
function srvMsg(m) {
  if (m.t === 'etat') {
    if (!SRV_PHASES.includes(m.ph) || !Array.isArray(m.j)) return;
    const first = !SRV.st;
    if (SRV.id === 'nouveau' && /^[A-Z0-9]{5}$/.test(m.i)) SRV.id = m.i; // salon créé : son code, pour revenir après une coupure
    const c = m.cfg && typeof m.cfg === 'object' ? m.cfg : {};
    SRV.st = { o: MODES[m.o] ? m.o : 'tdm', k: clamp(m.k | 0, 0, 99), ph: m.ph, i: SRV.id, ps: !!m.ps, own: String(m.own || ''),
      cfg: { bots: c.b ? 1 : 0, diff: clamp(c.df | 0, 0, 2), limit: clamp(c.lim | 0, 1, 999), time: clamp(c.min | 0, 1, 99), pub: c.pub ? 1 : 0 }, m: mapById(m.m).id, c: Array.isArray(m.c) ? m.c.slice(0, 2).map((c) => mapById(c).id) : [], vt: Array.isArray(m.vt) ? [m.vt[0] | 0, m.vt[1] | 0] : [0, 0],
      mv: m.mv === 0 || m.mv === 1 ? m.mv : -1, vo: !!m.vo, r: clamp(+m.r || 0, 0, 600000), s: clamp(m.s | 0, 1, 99), x: clamp(m.x | 0, 1, 99), me: String(m.me || ''),
      code: /^[A-Z0-9]{5}$/.test(m.code) ? m.code : '', hote: String(m.hote || ''),
      j: m.j.filter((p) => Array.isArray(p) && typeof p[0] === 'string').slice(0, 99).map((p) => ({ id: p[0], n: netClean(p[1]), lv: clamp(p[2] | 0, 0, 999), t: p[3] === 1 ? 1 : 0 })) };
    SRV.at = performance.now();
    if (first) netStatus('');
    srvSync(); netRender();
  } else if (m.t === 'hote') srvHostMatch(m);
  else if (m.t === 'chat' && typeof m.id === 'string') {
    const x = chatClean(m.x); if (!x || NET.muted.has(m.id)) return;
    chatPush({ id: m.id, n: netClean(m.n), t: chatMyTeam(), x });
    if (m.id !== SRV.me) sfxUi('notify');
  }
}
/* Le salon de la partie suit l'état du salon public : rejoint quand une partie est ouverte, refermé quand elle ne l'est plus et que
   le joueur est revenu aux menus (résultats vus), quitté tout de suite si elle a été abandonnée (hôte parti) */
function srvSync() {
  const st = SRV.st; if (!SRV.on || !st) return;
  const code = st.ph === 'partie' ? st.code : '', mine = NET.role === 'host' && NET.code === SRV.hostCode && (st.ph === 'lancement' || st.ph === 'partie');
  if (NET.role !== 'off' && NET.code !== code && !mine) {
    const live = NET.on && !MATCH.fin && (MATCH.state === 'playing' || MATCH.state === 'paused' || MATCH.state === 'killcam'); // (MATCH.fin : la partie finit, annonce, killcam finale et résultats vont à leur terme)
    if (live) { netReset(_t('La partie a été interrompue, son hôte est parti.')); toMenu(); return; }
    if (MATCH.state === 'menu' && !UI.flow) netReset('');
  }
  if (code && NET.role === 'off' && !UI.flow && (SRV.tried !== code || performance.now() - SRV.triedT > 5000)) srvJoinRoom(code);
}
/* Entre dans le salon de la partie : on y joue dès qu'elle charge ou se joue (NET.quickJoin, voir netClientMsg) */
function srvJoinRoom(code) {
  SRV.tries = SRV.tried === code ? SRV.tries + 1 : 1;
  if (SRV.tries > SRV_TRIES) { srvLeave(_t('Impossible de rejoindre cette partie, son hôte ne répond pas. Choisissez un autre salon ou réessayez dans un moment.')); netdShow(true); return; } // le rapport montre le dernier essai
  SRV.tried = code; SRV.triedT = performance.now();
  netJoinLobby(code);
  if (NET.role === 'client') { NET.srv = true; NET.quickJoin = true; }
}
/* Le serveur me confie la partie : j'ouvre son salon (le serveur choisit un autre joueur si je ne peux pas) */
function srvHostMatch(m) {
  const code = /^[A-Z0-9]{5}$/.test(m.code) ? m.code : '';
  if (!code || !SRV.on) return;
  if (m.migr) { // l'hôte de la partie où je suis est parti : je la reprends, dans le même salon, avec la clé que donne le serveur
    if (NET.role === 'client' && NET.srv && NET.code === code && NET.on && /^[A-Za-z0-9_-]{16,64}$/.test(m.key)) { Object.assign(SRV, { hostCode: code, opened: true, wait: null }); netTakeOver(code, m.key); }
    else srvSend({ t: 'echec', code });
    return;
  }
  if (NET.role !== 'off' && !NET.on && MATCH.state === 'menu' && !UI.flow) netReset(''); // salon de la partie d'avant, encore ouvert
  if (NET.role !== 'off' || UI.busy || UI.flow || MATCH.state !== 'menu') { srvSend({ t: 'echec', code }); return; }
  Object.assign(SRV, { hostCode: code, wait: { n: clamp(m.n | 0, 0, 16), t: 0 }, opened: false });
  netHost({ srv: true, code, cfg: { map: m.m, mode: m.o, bots: m.b, diff: m.df, limit: m.lim, time: m.min } }); // réglages du salon (standard pour un salon permanent)
  if (NET.role !== 'host') { SRV.hostCode = ''; srvSend({ t: 'echec', code }); }
}
/* Mon salon de partie est ouvert sur le serveur : le salon public l'annonce aux autres */
function srvRoomUp() { if (SRV.wait) SRV.wait.t = performance.now(); SRV.opened = true; srvSend({ t: 'ouvert', code: NET.code }); }
/* Le salon de la partie que j'héberge se ferme avant la fin : pas encore annoncé, le serveur choisit quelqu'un d'autre ; annoncé, la partie s'arrête */
function srvRoomFailed() { const code = SRV.hostCode; SRV.hostCode = ''; SRV.wait = null; if (code) srvSend({ t: SRV.opened ? 'fin' : 'echec', code }); }
/* La partie que j'héberge est finie (ou annulée) : le salon public repart pour un décompte */
function srvRoomEnded() { const code = SRV.hostCode; SRV.hostCode = ''; SRV.wait = null; if (code) srvSend({ t: 'fin', code }); }
/* Mon équipe dans un salon créé (-1 ailleurs : l'hôte de la partie équilibre les équipes) ; je la demande en entrant dans la partie */
function srvTeam() { const st = SRV.st, p = st && st.ps && st.j.find((x) => x.id === st.me); return p ? p.t : -1; }
const srvChief = () => !!SRV.st && SRV.st.ps && SRV.st.own === SRV.st.me;
/* Hôte : lancement quand les joueurs du salon public sont entrés, ou au bout de SRV_WAIT */
function srvHostTick() {
  const w = SRV.wait;
  if (!w || !w.t || NET.role !== 'host' || !NET.srv || !NET.joined || NET.phase !== 'lobby') return;
  if (NET.players.size - 1 >= w.n || performance.now() - w.t > SRV_WAIT) { SRV.wait = null; netLaunch(); }
}
/* Niveau monté depuis l'entrée au salon (fin de partie, XP du compte) : annoncé au serveur, qui met la liste à jour. Avant, le salon gardait
   le niveau de l'arrivée tant que la connexion durait, d'une partie à l'autre : un compte neuf restait au niveau 1 pour tout le monde. */
function srvLevel() {
  if (!SRV.on || !SRV.ws || SRV.ws.readyState !== 1) return;
  const lv = playerLevel(); if (lv !== SRV.lv) { SRV.lv = lv; srvSend({ t: 'lv', lv }); }
}
function srvTick() {
  if (!SRV.on) return;
  const jeu = NET.on && NET.srv ? 1 : 0;
  if (jeu !== SRV.jeu && SRV.ws && SRV.ws.readyState === 1) { SRV.jeu = jeu; srvSend({ t: 'h', h: srvHostScore(), jeu }); }
  srvLevel();
  srvSync(); srvHostTick(); srvClock();
}
/* Mon vote (0 ou 1) : affiché tout de suite, compté par le serveur */
function srvVote(c) {
  const st = SRV.st; if (!st || !st.vo || st.mv === c) return;
  st.vt[c]++; if (st.mv >= 0) st.vt[st.mv]--; st.mv = c;
  srvSend({ t: 'vote', c }); sfxUi('click'); srvVoteRender();
}
/* Le bouton du pied : rejoindre la partie en cours (après l'avoir quittée, ou sans y être entré) */
function srvStartClick() {
  const st = SRV.st; if (st && st.ps && st.ph === 'attente' && srvChief()) { sfxUi('click'); srvSend({ t: 'lancer' }); return; } // le chef lance la partie
  if (!st || st.ph !== 'partie' || !st.code) return;
  if (NET.role === 'client' && NET.code === st.code) { NET.quickJoin = false; netJoinRunning(); }
  else if (NET.role === 'off') { SRV.tried = ''; srvJoinRoom(st.code); }
}
/* Crée un salon sur le serveur, public ou privé, avec ses réglages du Solo (mémoire commune) */
function srvCreate(pub) {
  const MD = MODES[Settings.mode] || MODES.tdm;
  NETP.vis = pub ? 1 : 0; try { localStorage.setItem('cod_salon_pub', String(NETP.vis)); } catch (e) { /* stockage indisponible */ }
  lmClose(LM.scr.multi);
  srvJoin('nouveau', { make: { m: Settings.map, o: Settings.mode, b: '1', df: String(Settings.difficulty), lim: String(Settings[MD.key]), min: String(Settings.minutes), pub: String(NETP.vis) } });
}
/* Réglage changé par le chef d'un salon créé (comme netSetupSet) : envoyé au serveur, affiché tout de suite, retrouvé en Solo */
function srvSetupSet(k, v) {
  const st = SRV.st; if (!srvChief() || st.ph !== 'attente') return;
  const c = { map: st.m, mode: st.o, ...st.cfg };
  if (k === 'bots') { c.bots = v === 'off' ? 0 : 1; if (v !== 'off') c.diff = v; }
  else if (k === 'mode') { c.mode = v; c.limit = Settings[MODES[v].key]; }
  else c[k] = v;
  const n = netCfg(c); // (mode et limite validés comme dans un salon)
  Object.assign(st, { m: n.map, o: n.mode }); Object.assign(st.cfg, { bots: n.bots, diff: n.diff, limit: n.limit, time: n.time, pub: c.pub ? 1 : 0 });
  Settings.map = n.map; Settings.mode = n.mode; Settings.minutes = n.time; Settings[MODES[n.mode].key] = n.limit; if (n.bots) Settings.difficulty = n.diff;
  if (k === 'pub') { NETP.vis = v ? 1 : 0; try { localStorage.setItem('cod_salon_pub', String(NETP.vis)); } catch (e) { /* stockage indisponible */ } }
  saveSettings(); sfxUi('click');
  srvSend({ t: 'cfg', m: n.map, o: n.mode, b: n.bots, df: n.diff, lim: n.limit, min: n.time, pub: st.cfg.pub });
  netRender();
}
/* Les réglages d'un salon créé, pour les rangées des paramètres de la partie (matchRows) et l'encart de la carte */
function srvMatchCfg() { const st = SRV.st; return { map: st.m, mode: st.o, ...st.cfg, pubOk: true, online: true, edit: srvChief() && st.ph === 'attente', set: srvSetupSet, note: _t('Réglés par le chef du salon') }; }
/* ---------- Affichage ---------- */
/* Secondes restantes du décompte, d'après l'état reçu */
function srvLeft() { const st = SRV.st; return st && st.ph === 'decompte' ? Math.max(0, Math.ceil((st.r - (performance.now() - SRV.at)) / 1000)) : 0; }
/* La phase d'un salon, en clair (liste et écran du salon) */
function srvPhase(p, perso) { return { attente: perso ? _t('Au salon') : _t('En attente de joueurs'), decompte: _t('Départ imminent'), lancement: _t('Lancement'), partie: _t('En partie') }[p] || ''; }
/* Ce qui se passe dans le salon, au-dessus des joueurs */
function srvNoteText() {
  const st = SRV.st;
  if (st && !SRV.up) return _t('Connexion perdue. Nouvel essai...');
  if (!st) return _t('Connexion au salon...');
  if (st.ps && st.ph === 'attente') return srvChief() ? _t('Réglez la partie, puis lancez-la quand vous voulez.') : _t('En attente du lancement par le chef du salon.');
  if (st.ph === 'attente') { const n = Math.max(1, st.s - st.j.length); return _tn(n, 'La partie se lance à {1} joueurs. Encore {0} joueur.', 'La partie se lance à {1} joueurs. Encore {0} joueurs.', st.s); }
  if (st.ph === 'decompte') return st.vo ? _t('La partie commence dans {0} s. Votez pour la carte.', srvLeft()) : _t('La partie commence dans {0} s sur {1}.', srvLeft(), mapById(st.m).name);
  if (st.ph === 'lancement') return _t('Ouverture de la partie sur {0}...', mapById(st.m).name);
  return _t('Partie en cours sur {0}.', mapById(st.m).name);
}
function srvTitle() { return !SRV.st ? _t('Salon public') : SRV.st.ps ? _t('Salon {0}', SRV.st.i) : MODES[SRV.st.o].name; }
/* Scène du salon public : les joueurs (sans bots ni équipes : elles se font à l'entrée dans la partie) */
function srvStage() {
  const st = SRV.st, note = $('srvNote');
  note.textContent = srvNoteText();
  const head = `<b>${esc(_t('Joueurs'))}</b><span>${st ? st.j.length + '/' + st.x : ''}</span>`;
  if (st && st.ps && st.o !== 'ffa') { const mine = Math.max(0, srvTeam()); return { head, note, cols: [mine, 1 - mine].map((t) => ({ cls: t === mine ? 'ally' : 'enemy', head: esc(TEAM_NAMES[t]), rows: srvPlayerRows(t) })) }; }
  return { head, note, cols: [{ rows: srvPlayerRows(-1) }] };
}
/* Les joueurs d'une équipe (t = -1 : tous) ; dans un salon créé, les places que prendront les bots ; on agit sur un joueur depuis ses actions */
function srvPlayerRows(t) {
  const st = SRV.st, rows = [];
  for (const p of st ? st.j : []) {
    if (t >= 0 && p.t !== t) continue;
    const me = p.id === st.me, tags = [];
    if (st.ps && p.id === st.own) tags.push(_t('chef')); if (p.id === st.hote) tags.push(_t('hôte')); if (NET.muted.has(p.id)) tags.push(_t('masqué'));
    const acts = !me || (st.ps && st.o !== 'ffa' && st.ph === 'attente'); // soi-même : changer d'équipe
    rows.push({ k: 'player', key: p.id, label: p.n, lv: p.lv, tags, me, page: acts ? 'srvp' : null, params: p.id });
  }
  const free = st && st.ps && st.cfg.bots ? (t < 0 ? NET_MAX : NET_TEAM) - rows.length : 0, diff = (DIFF[st ? st.cfg.diff : 1] || DIFF[1]).name;
  for (let i = 0; i < free; i++) rows.push({ k: 'player', key: 'bot' + t + '-' + i, label: diff, bot: true });
  if (!rows.length) rows.push({ k: 'note', text: _t('Personne') });
  return rows;
}
/* Le bloc de vote, en bas à gauche : deux cartes au vote (la mienne marquée, les voix de chacune), puis la carte retenue ou en cours */
function srvVoteRender() {
  const box = $('srvVote'), st = SRV.st, show = SRV.on && !!st && !st.ps && UI.screen === 'multi'; // (pas de vote dans un salon créé)
  box.hidden = !show; if (!show) { SRV.voteKey = ''; return; }
  const one = st.ph === 'lancement' || st.ph === 'partie' || !st.vo;
  const cards = one ? [st.m] : st.c, head = st.ph === 'partie' || st.ph === 'lancement' ? _t('Partie en cours') : st.vo ? _t('Votez pour la prochaine carte') : _t('Prochaine carte');
  const key = [head, cards.join(), st.vt.join(), st.mv, st.vo].join('|');
  if (key === SRV.voteKey) return;
  const had = box.contains(document.activeElement) ? document.activeElement.dataset.c : null;
  SRV.voteKey = key;
  const h = document.createElement('p'); h.className = 'sv-h'; h.textContent = head;
  const row = document.createElement('div'); row.className = 'sv-cards' + (one ? ' one' : '');
  cards.forEach((id, i) => {
    const m = mapById(id), b = document.createElement(one ? 'div' : 'button');
    b.className = 'sv-card mapcard' + (!one && st.mv === i ? ' on' : '');
    if (!one) { // comme le pied, hors d'atteinte pendant un sous-menu
      b.type = 'button'; b.dataset.c = String(i); b.dataset.lmExtra = ''; b.tabIndex = LM.scr.multi.stack.length > 1 ? -1 : 0;
      b.setAttribute('aria-pressed', String(st.mv === i)); b.addEventListener('click', () => srvVote(i));
    }
    const art = document.createElement(MAP_ART[m.id] ? 'img' : 'span'); art.className = 'mapart' + (MAP_ART[m.id] ? '' : ' none'); if (MAP_ART[m.id]) { art.alt = ''; art.decoding = 'async'; art.src = MAP_ART[m.id]; }
    const t = document.createElement('span'); t.className = 'mtx';
    t.appendChild(Object.assign(document.createElement('span'), { className: 'mt', textContent: m.name }));
    if (one) t.appendChild(Object.assign(document.createElement('span'), { className: 'mg', textContent: MODES[st.o].btn }));
    b.append(art, t);
    if (!one) { // les voix de la carte, en grand ; mon vote : le cadre et le nombre en jaune
      b.appendChild(Object.assign(document.createElement('b'), { className: 'sv-n', textContent: String(st.vt[i]) }));
      b.setAttribute('aria-label', m.name + ', ' + _tn(st.vt[i], '{0} vote', '{0} votes') + (st.mv === i ? ', ' + _t('mon vote') : ''));
    }
    row.appendChild(b);
  });
  box.replaceChildren(h, row);
  if (had != null && lmWantFocus()) { const f = row.querySelector(`[data-c="${had}"]`); if (f) f.focus({ preventScroll: true }); }
}
/* Ce qui change chaque seconde sans tout reconstruire : décompte de la note et du bouton du pied */
function srvClock() {
  if (!SRV.on || UI.screen !== 'multi') return;
  const n = $('srvNote'); if (n) n.textContent = srvNoteText();
  srvFoot();
}
function srvFoot() {
  const st = SRV.st, b = $('netStart'), joined = NET.role === 'client' && st && NET.code === st.code;
  let t = _t('Connexion au salon...'), on = false;
  if (st && st.ps && st.ph === 'attente') { t = srvChief() ? _t('Lancer la partie') : _t('En attente du chef'); on = srvChief(); }
  else if (st && st.ph === 'attente') t = _t('En attente de joueurs');
  else if (st && st.ph === 'decompte') t = _t('Début dans {0} s', srvLeft());
  else if (st && st.ph === 'lancement') t = _t('Lancement de la partie...');
  else if (st && st.ph === 'partie') {
    if (NET.on || UI.flow || NET.role === 'host') t = _t('Chargement de la partie...');
    else if (joined && !NET.joined) t = _t('Connexion à la partie...');
    else { t = _t('Rejoindre la partie'); on = NET.role === 'off' || (joined && NET.phase !== 'lobby'); }
  }
  if (b.textContent !== t) b.textContent = t;
  b.disabled = !on;
}
/* Accueil de l'écran Multijoueur : les salons publics lancés par des joueurs (retour du propriétaire : ni les salons permanents du serveur,
   ni les salons privés, ni les salons vides), avec leur carte, leur mode, leur phase, leur chef et leurs joueurs */
function srvListStage() {
  const rows = [], pub = SRV.crees.filter((s) => !s.pv && s.i && s.j > 0);
  for (const s of pub) {
    const m = mapById(s.m);
    rows.push({ k: 'pick', key: s.i, label: m.name, sub: [MODES[s.o].btn, srvPhase(s.p, true), _t('Chef : {0}', s.n)].join(' · '), value: s.j + '/' + s.x, art: MAP_ART[m.id] || '',
      disabled: s.j >= s.x || netInLobby(), pick: () => { sfxUi('click'); srvJoin(s.i, { code: true }); } });
  }
  if (!rows.length) rows.push({ k: 'note', text: NETP.err ? _t('Liste des salons publics indisponible pour le moment.') : SRV.list ? _t('Aucun salon public pour le moment. Créez le vôtre, il apparaîtra ici.') : _t('Chargement...') });
  const online = NETP.joueurs < 0 ? '' : `<span>${esc(_tn(NETP.joueurs, '{0} joueur en ligne en ce moment', '{0} joueurs en ligne en ce moment'))}</span>`;
  return { head: `<b>${esc(_t('Salons publics'))}</b>${online}`, cols: [{ rows }] };
}
/* Pages du menu Multijoueur propres aux salons publics (avec NET_PAGES, src/09c-net.js) */
const SRV_PAGES = {
  // créer un salon : public (dans la liste, ouvert à tous) ou privé (dans la liste, on n'y entre qu'avec son code)
  create: () => ({
    head: _t('Créer un salon'),
    rows: [
      { k: 'note', text: _t('Vous réglez la partie et la lancez quand vous voulez. Le salon reste ouvert tant qu\u0027il y a quelqu\u0027un.') },
      { k: 'btn', key: 'pub', label: _t('Salon public'), sub: _t('Dans la liste des salons, ouvert à tous'), run: () => srvCreate(1), disabled: !netCan() },
      { k: 'btn', key: 'priv', label: _t('Salon privé'), sub: _t('Dans la liste des salons, on n\u0027y entre qu\u0027avec son code'), run: () => srvCreate(0), disabled: !netCan() },
    ],
  }),
  // le salon : la classe, la discussion ; salon permanent, le vote en bas à gauche (srvVote) ; salon créé, la carte, les réglages, l'invitation et l'encart de la carte
  srv: () => {
    const st = SRV.st, rows = [];
    if (st && st.ps) {
      const edit = srvChief() && st.ph === 'attente';
      rows.push({ k: 'link', key: 'map', label: _t('Carte'), page: 'srvmap', disabled: !edit }, { k: 'link', key: 'setup', label: _t('Paramètres de partie'), page: 'srvsetup' });
    }
    rows.push({ k: 'link', key: 'class', label: _t('Modifier la classe'), open: () => uiGo('classes') });
    if (st && st.ps) rows.push({ k: 'link', key: 'invite', label: _t('Inviter des amis'), page: 'invite' });
    rows.push({ k: 'link', key: 'chat', label: _t('Discussion'), value: CHAT.unread ? String(CHAT.unread) : '', page: 'chat' });
    const MD = MODES[st ? st.o : 'tdm'], rules = st ? st.cfg.limit + ' ' + MD.unit + ' · ' + st.cfg.time + ' min' : '';
    const sub = !st ? '' : st.ps ? [MD.name, st.cfg.pub ? _t('Public') : _t('Privé')].join(' · ') : [_t('Salon public {0}', st.k), rules].join(' · ');
    return { title: srvTitle(), sub, rows, stage: srvStage, preview: st && st.ps ? mapPreview(mapById(st.m), srvMatchCfg()) : '' };
  },
  srvmap: () => ({ head: _t('Carte'), grid: true, rows: mapCards(SRV.st ? SRV.st.m : '', srvChief() && SRV.st.ph === 'attente' ? (id) => { lmPop(LM.scr.multi); srvSetupSet('map', id); } : null) }),
  srvsetup: () => ({ head: _t('Paramètres de partie'), rows: SRV.st ? matchRows(srvMatchCfg()) : [] }),
  // un joueur : changer d'équipe (soi-même, ou le chef pour un autre), masquer ses messages (chez soi), l'exclure (le chef, en deux temps)
  srvp: (id) => {
    const st = SRV.st, p = st && st.j.find((x) => x.id === id), rows = []; if (!p) return { head: '', rows };
    const other = id !== st.me, chief = srvChief(), lobby = st.ph === 'attente';
    if (st.ps && st.o !== 'ffa' && lobby && (!other || chief)) rows.push({ k: 'btn', key: 'swap', label: _t('Changer d\u0027équipe'), sub: _t('Déplacer ce joueur dans l\u0027autre équipe'), run: () => { srvSend(other ? { t: 'equipe', id } : { t: 'equipe' }); sfxUi('click'); lmPop(LM.scr.multi); } });
    if (other) {
      const muted = NET.muted.has(id);
      rows.push({ k: 'btn', key: 'mute', label: muted ? _t('Afficher') : _t('Masquer'), sub: muted ? _t('Afficher de nouveau les messages de ce joueur') : _t('Ne plus voir les messages de ce joueur'), run: () => { if (muted) NET.muted.delete(id); else NET.muted.add(id); sfxUi('click'); chatRender(); netRender(); } });
      if (st.ps && chief && lobby) {
        const ask = SRV.kickAsk === id;
        rows.push({ k: 'btn', key: 'kick', danger: true, label: ask ? _t('Confirmer l\u0027exclusion') : _t('Exclure'), sub: _t('Retirer ce joueur du salon (il ne peut pas revenir)'), run: () => {
          if (SRV.kickAsk === id) { SRV.kickAsk = ''; srvSend({ t: 'exclure', id }); lmPop(LM.scr.multi); } else { SRV.kickAsk = id; setTimeout(() => { if (SRV.kickAsk === id) { SRV.kickAsk = ''; netRender(); } }, 4000); }
          sfxUi('click'); netRender();
        } });
      }
    }
    return { head: p.n, rows };
  },
};
function srvInit() {
  Object.assign(NET_PAGES, SRV_PAGES);
  setInterval(srvTick, 1000);
  document.addEventListener('visibilitychange', () => { if (SRV.on) srvSend({ t: 'h', h: srvHostScore(), jeu: NET.on && NET.srv ? 1 : 0 }); });
  addEventListener('pagehide', () => { if (SRV.ws) { try { SRV.ws.close(1000); } catch (e) { /* déjà fermée */ } } });
}
