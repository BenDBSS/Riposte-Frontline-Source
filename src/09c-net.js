/* ==========================================================================
   MULTIJOUEUR EN LIGNE
   Salons en pair à pair (WebRTC, bibliothèque PeerJS). L'hôte crée un salon
   identifié par un code court et partage le lien ; les autres s'y connectent.
   L'hôte est le centre du salon : il tient la liste des joueurs et leurs
   équipes, lance la partie, relaie l'état de chacun à tous les autres et
   simule les bots qui complètent les équipes.
   Lancement : chacun charge la carte (écran de chargement ; le salon ne charge rien) et
   annonce sa progression à l'hôte ; la partie ne commence, pour tous en même temps, que lorsque tout le monde a
   fini, ou au bout de NET_LOAD_WAIT secondes (un retardataire rejoint alors la partie dès qu'il a fini).
   Chaque participant (joueur ou bot) publie environ 15 fois par seconde un
   état : position, regard, arme, posture, vie, compteurs, et ses événements
   récents numérotés (touches adressées à quelqu'un, éliminations, grenades,
   séries). Modèle « le tireur décide » : celui qui tire calcule ses touches
   et les adresse à la victime, qui applique les dégâts et annonce sa mort.
   ========================================================================== */
const NET_PROTO = 10, NET_LOAD_WAIT = 45, NET_MAX = 8, NET_TEAM = 6, NET_PREFIX = 'cod-lc1-', NET_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NET_WSPECIAL = { nade: _t('Grenade'), tknife: _t('Couteau de lancer'), air: _t('Frappe aérienne'), knife: _t('Couteau'), heli: _t('Hélicoptère'), drone: _t('Drone kamikaze'), mecha: _t('Mecha'), fall: _t('Chute'), zone: _t('Désert') }; // fall : chute dans le vide (voidDeath) ; zone : resté hors de la zone ronde (zoneDeath, 02-relief.js)
const NET = {
  role: 'off', peer: null, hostConn: null, me: '', code: '', joined: false, t0: 0, hostSeen: 0, hbT: 0, lastSend: 0,
  relay: null, relayConn: null, relayTimer: 0, tx: { p2p: 'off', relay: 'off' }, // voies de connexion : pair à pair et relais (wait, idle, ok, fail, off)
  players: new Map(), phase: 'lobby', cfg: { bots: 1, diff: 2, limit: 30, time: 10, map: 'sable', mode: 'tdm' },
  on: false, team: 0, remotes: new Map(), seen: new Map(), seenT: new Map(), ak: new Map(), sent: [], held: [], hitQ: 0, rid: 0, lastPub: 0, shots: 0, nick: '', status: '',
  startT: 0, ldKey: '', ldT: 0, lobbyTimer: 0, // lancement : début de l'attente (hôte), dernière progression envoyée
  key: '', // clé de cette page, envoyée avec la présentation (voir netKey)
  muted: new Set(), // joueurs masqués par ce joueur (leurs messages ne s'affichent plus chez lui), le temps du salon
  goneK: [0, 0], hostId: '', // éliminations de ceux qui ont quitté la partie, par équipe ; joueur hôte du salon (un autre : la partie a été reprise)
  banned: new Set(), kickAsk: '', // hôte : clés des joueurs exclus (refusés s'ils reviennent), exclusion en attente de confirmation
};

/* ---------- Diagnostic de connexion ----------
   Chaque étape (serveur de mise en relation, recherche de chemins réseau, connexion) est consignée avec son
   heure. Quand une connexion échoue, le jeu affiche la cause probable et un rapport à copier (sans adresse IP). */
const NETD = { log: [], cand: {}, err: '', sig: '', t0: 0, role: '', code: '', rel: '', relCode: 0 };
function netdReset(role, code) { Object.assign(NETD, { log: [], cand: {}, err: '', sig: '', t0: performance.now(), role, code, rel: netrUrl() ? 'idle' : 'off', relCode: 0 }); netdShow(false); }
function netdLog(s) {
  NETD.log.push(((performance.now() - NETD.t0) / 1000).toFixed(1).padStart(5) + ' s  ' + s);
  if (NETD.log.length > 80) NETD.log.shift();
  console.info('[net] ' + s);
}
/* Suit la recherche de chemins d'une connexion PeerJS : types de chemins trouvés (direct, via STUN, via relais) */
function netdWatch(c, who) {
  const pc = c && c.peerConnection;
  if (!pc || pc.netdSeen) return;
  pc.netdSeen = true;
  pc.addEventListener('icecandidate', (e) => {
    const cd = e.candidate; if (!cd || !cd.candidate) return;
    const m = / typ (\w+)/.exec(cd.candidate);
    const k = (cd.type || (m && m[1]) || '?') + (/\.local /.test(cd.candidate) ? ' mDNS' : '') + '/' + String(cd.protocol || (/ (udp|tcp) /i.exec(cd.candidate) || [])[1] || '?').toLowerCase();
    NETD.cand[k] = (NETD.cand[k] || 0) + 1;
  });
  pc.addEventListener('icecandidateerror', (e) => netdLog(who + ' : serveur ' + (e.url || '?') + ' injoignable (code ' + e.errorCode + ')'));
  pc.addEventListener('icegatheringstatechange', () => netdLog(who + ' : recherche de chemins ' + pc.iceGatheringState));
  pc.addEventListener('iceconnectionstatechange', () => netdLog(who + ' : chemin ' + pc.iceConnectionState));
}
/* Chemin finalement retenu par une connexion établie */
async function netdPath(c, who) {
  const pc = c && c.peerConnection;
  if (!pc || !pc.getStats) return;
  try {
    const st = await pc.getStats(); let pair = null;
    st.forEach((x) => { if (x.type === 'transport' && x.selectedCandidatePairId) pair = st.get(x.selectedCandidatePairId) || pair; });
    const a = pair && st.get(pair.localCandidateId), b = pair && st.get(pair.remoteCandidateId);
    netdLog(who + ' : chemin retenu ' + (a ? a.candidateType + '/' + a.protocol : '?') + ' vers ' + (b ? b.candidateType : '?'));
  } catch (e) { /* statistiques indisponibles */ }
}
function netdCount(re) { let n = 0; for (const k in NETD.cand) if (re.test(k)) n += NETD.cand[k]; return n; }
/* Cause probable de l'échec, en clair */
function netdVerdict() {
  if (NET.joined && NET.role === 'client') return _t('Connecté au salon. Aucun problème de connexion.');
  if (netViaServer()) { // tout passe par le serveur de jeu : ni pair à pair ni serveur de mise en relation
    if (NET.role === 'host' && NET.joined) return _tn(NET.players.size, 'Salon ouvert sur le serveur de jeu : {0} joueur.', 'Salon ouvert sur le serveur de jeu : {0} joueurs.');
    if (NETD.relCode === 4004) return _t('Salon introuvable. Vérifiez le code, ou l\u0027hôte a fermé le salon.');
    if (NETD.relCode === 4002) return _t('Ce salon est complet.');
    if (NETD.relCode === 4029 || NETD.relCode === 4013) return _t('Le serveur de jeu est saturé. Réessayez dans un instant.');
    if (NETD.rel === 'fail') return _t('Le serveur de jeu est injoignable depuis ce poste. Connexion coupée, réseau très restrictif ou serveur en maintenance. Réessayez dans un instant.');
    return _t('Connexion au serveur de jeu en cours.');
  }
  if (NETD.rel === 'fail' && NETD.relCode === 4004 && NETD.sig === 'fail') return _t('Le relais ne connaît pas ce salon et le serveur de mise en relation (0.peerjs.com) est injoignable depuis ce poste. Vérifiez le code du salon.');
  if (NETD.rel === 'fail' && NETD.relCode === 4004 && NETD.err === 'peer-unavailable') return _t('Ni la connexion directe ni le relais ne trouvent ce salon. Le code est faux ou l\u0027hôte a fermé le salon.');
  if (NETD.rel === 'fail' && NETD.relCode !== 4004) return _t('La connexion directe est impossible depuis ce poste et le relais de secours (HTTPS, port 443) est injoignable aussi. Réseau très restrictif, relais hors service, ou quota du jour atteint (il revient à minuit UTC).');
  if (NETD.sig === 'fail') return _t('Le serveur de mise en relation (0.peerjs.com) est injoignable depuis ce poste. Sans doute bloqué par le proxy ou le pare-feu de l\u0027entreprise, ou momentanément hors service.');
  if (NETD.err === 'peer-unavailable') return _t('Le serveur ne connaît pas ce salon. L\u0027hôte n\u0027y est plus enregistré (onglet fermé, réseau coupé ou salon fermé). Demandez à l\u0027hôte de créer un nouveau salon.');
  const all = netdCount(/./), srflx = netdCount(/^srflx/), relay = netdCount(/^relay/), mdns = netdCount(/mDNS/);
  if (NETD.role === 'host') {
    if (NET.role !== 'host' || !NET.joined) return _t('Rapport de l\u0027hôte. Joignez-le à celui du joueur qui n\u0027arrive pas à se connecter.');
    let d = 0, r = 0;
    for (const p of NET.players.values()) if (p.id !== NET.me) { if (p.r) r++; else d++; }
    const st = { ok: _t('connecté'), fail: _t('injoignable'), try: _t('en cours'), off: _t('non configuré'), idle: _t('non sollicité') };
    return _t('Salon ouvert : {0} joueur(s) en direct, {1} par le relais. Serveur de mise en relation PeerJS : {2}. Relais de secours : {3}.', d, r, NET.tx.p2p === 'ok' ? _t('connecté') : NET.tx.p2p === 'off' ? _t('non utilisé') : _t('injoignable'), st[NETD.rel] || NETD.rel);
  }
  if (!all) return _t('Aucun chemin réseau n\u0027a été trouvé : WebRTC est probablement bloqué sur ce poste (réglage du navigateur, stratégie d\u0027entreprise, VPN ou extension).');
  if (!srflx && !relay) return _t('Aucun accès UDP vers Internet depuis ce poste. Seuls des chemins locaux existent et ils n\u0027ont pas abouti{0}. Les relais publics sont hors d\u0027atteinte.', mdns ? ' ' + _t('(le navigateur masque les adresses locales et le réseau semble bloquer leur résolution entre PC)') : '');
  if (!relay) return _t('La connexion directe avec l\u0027hôte a échoué et les relais publics de PeerJS sont injoignables (port UDP 3478 sans doute filtré par le pare-feu)') + (NETD.rel === 'off' ? _t(', et aucun relais de secours n\u0027est configuré pour ce jeu.') : '.');
  return _t('Un relais a été joint mais la connexion n\u0027a pas abouti. Relais saturé ou trafic bloqué.');
}
function netdReport() {
  const c = Object.keys(NETD.cand).map((k) => k + ' x' + NETD.cand[k]).join(', ') || 'aucun';
  return ['Rapport de connexion, Riposte: Frontline (protocole ' + NET_PROTO + ')', 'Rôle : ' + (NETD.role || '-') + ', salon ' + (NETD.code || '-') + ', page ' + location.host, 'Navigateur : ' + navigator.userAgent,
    'Chemins trouvés : ' + c, (netViaServer() ? 'Serveur de jeu : ' : 'Relais de secours : ') + (NETD.rel === 'off' ? 'non configuré' : NETD.rel), 'Diagnostic : ' + netdVerdict(), '', ...NETD.log].join('\n');
}
function netdShow(on) {
  const box = $('netDiag'); if (!box) return;
  box.classList.toggle('hidden', !on);
  if (on) { $('netDiagWhy').textContent = netdVerdict(); $('netDiagCopy').textContent = _t('Copier le rapport de connexion'); }
}
function netdCopy() {
  const txt = netdReport(), btn = $('netDiagCopy');
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* copie refusée */ }
    ta.remove(); btn.textContent = ok ? _t('Rapport copié') : _t('Copie impossible');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { btn.textContent = _t('Rapport copié'); }, fallback); else fallback();
}
/* Échec de connexion : retour au menu avec l'explication et le rapport */
function netFail(msg) { netdLog('échec : ' + msg); netReset(msg); netdShow(true); }

function netLib() { return typeof window.Peer === 'function'; }
function netCan() { return netLib() || !!netrUrl(); } // au moins une voie de connexion : pair à pair (PeerJS) ou relais
function netPeerOpts() { return Object.assign({ debug: 0 }, window.NET_PEER_OPTS || {}); }
/* Pseudo reçu ou affiché : caractères de contrôle et chevrons ôtés, 16 caractères ; un nom refusé par le filtre (api/_lib/filtre.js) devient « Soldat » */
function netClean(n) { const s = String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16); return s && !filtreNom(s) ? s : _t('Soldat'); }
function netNewCode() { const a = new Uint32Array(5); crypto.getRandomValues(a); let s = ''; for (const v of a) s += NET_ABC[v % NET_ABC.length]; return s; }
function netLink() { return location.origin + location.pathname + '?salon=' + netCodeNow(); }
/* Code du salon où l'on est : celui d'un salon créé sur le serveur (src/09cb-serveurs.js), sinon celui du salon de l'hôte */
function netCodeNow() { return SRV.on && SRV.st && SRV.st.ps ? SRV.st.i : NET.code; }
/* Code tapé ou reçu (invitation) : d'abord un salon du serveur de jeu ; s'il n'y est pas, le salon d'un hôte (srvLost) */
function netJoinCode(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length === 5 && netViaServer() && !netInLobby()) srvJoin(code, { code: true }); else netJoinLobby(raw);
}
/* Clé de cette page, jointe à la présentation (« hi ») : l'hôte reconnaît le même joueur arrivé par une seconde voie
   (relais après une connexion directe tombée avant sa réponse, nouvelle tentative après une coupure) et remplace son
   ancienne connexion au lieu de l'afficher deux fois. Elle vit autant que la page. */
function netKey() { if (!NET.key) NET.key = netNewCode() + netNewCode(); return NET.key; }
function netStatus(t) { NET.status = t; const el = $('netStatus'); if (el) el.textContent = t; }
/* Présentation à l'hôte (« hi ») ; mig : de nouveau, à l'hôte qui reprend la partie en cours (on y est déjà, avec son équipe) ; tm : l'équipe
   (choisie dans un salon créé, ou celle de la partie en cours) */
function netHi(mig) {
  const live = mig && NET.on, tm = live ? PL.ent.team : NET.srv && srvTeam() >= 0 ? srvTeam() : undefined;
  NET.lvSent = playerLevel();
  return { t: 'hi', n: NET.nick, lv: NET.lvSent, v: NET_PROTO, k: netKey(), tm, mig: live ? 1 : undefined };
}
/* Mon niveau a changé (fin de partie, compte) : l'invité l'annonce à l'hôte, l'hôte met sa propre ligne à jour ; sans cela, le salon gardait le
   niveau de l'arrivée d'une partie à l'autre. Les salons du serveur de jeu suivent par srvLevel. */
function netLevelSync() {
  const lv = playerLevel();
  if (NET.role === 'client' && NET.hostConn && NET.hostConn.open && NET.lvSent !== lv) { NET.lvSent = lv; netSend({ t: 'lv', lv }); }
  else if (NET.role === 'host') { const me = NET.players.get(NET.me); if (me && me.lv !== lv) { me.lv = lv; netLobbyChanged(); } }
  srvLevel();
}
function netNick() {
  const el = $('netName');
  let n = ACCT.user ? ACCT.user.displayName : ((el && el.value) || '').trim(); // connecté : le nom d'affichage du compte
  n = n ? netClean(n) : _t('Soldat') + '-' + (100 + Math.floor(Math.random() * 900));
  NET.nick = n; if (el) el.value = n;
  try { localStorage.setItem('cod_nick', n); } catch (e) { /* stockage indisponible */ }
  return n;
}
function netTeamCounts() { const c = [0, 0]; for (const p of NET.players.values()) c[p.t]++; return c; }

/* ---------- Envois ---------- */
function netSend(m) { const c = NET.hostConn; if (c && c.open) { try { c.send(m); NET.lastSend = performance.now(); } catch (e) { /* canal en cours de fermeture */ } } }
function netSendTo(pl, m) { if (pl.conn && pl.conn.open) { try { pl.conn.send(m); } catch (e) { /* canal en cours de fermeture */ } } }
function netBroadcast(m, onlyInGame, except) {
  let viaRelay = null;
  for (const pl of NET.players.values()) {
    if (pl.id === except || (onlyInGame && !pl.ig)) continue;
    if (pl.conn && pl.conn.relay && NET.relay) (viaRelay || (viaRelay = [])).push(pl.id); // un seul envoi pour tous les invités du relais
    else netSendTo(pl, m);
  }
  if (viaRelay) NET.relay.sendMany(viaRelay, m);
  NET.lastSend = performance.now();
}

/* ---------- Création, connexion, fermeture ---------- */
/* Création d'un salon. o.pub : salon public (listé par le serveur de jeu) ; o.quick : « Jouer maintenant » (public, avec des
   bots, lancé dès qu'il est ouvert : d'autres joueurs le rejoignent en cours de partie) ; o.srv : la partie d'un salon public
   permanent (src/09cb-serveurs.js), avec le code et les réglages (o.cfg) que donne le serveur */
function netHost(o) {
  if (NET.role !== 'off' || !netCan() || !acctGate()) return;
  o = o || {}; NET.hostOpts = o; NET.quick = !!o.quick;
  netNick();
  const code = o.code || netNewCode(), direct = netLib() && !netRelayOnly();
  Object.assign(NET, { role: 'host', peer: null, relay: null, relayConn: null, code, me: '', phase: 'lobby', joined: false, t0: performance.now(), tx: { p2p: direct ? 'wait' : 'off', relay: netrUrl() ? 'wait' : 'off' } });
  NET.players.clear();
  NET.cfg = netCfg(o.cfg || { bots: o.quick ? 1 : NET.cfg.bots, diff: Settings.difficulty, map: Settings.map, mode: Settings.mode, limit: Settings[(MODES[Settings.mode] || MODES.tdm).key], time: Settings.minutes, pub: o.pub && netViaServer() ? 1 : 0 });
  NET.pane = 'setup'; NET.srv = !!o.srv;
  netdReset('host', code); netdLog('salon ' + code + ' : ouverture');
  netStatus(_t('Création du salon...'));
  if (direct) netHostP2p(code);
  if (netrUrl()) netHostRelay(code);
  netRender();
}
/* Le salon existe dès qu'une voie s'ouvre : serveur de mise en relation de PeerJS, ou relais de secours */
function netHostUp(id) {
  if (NET.joined) return;
  NET.me = id; NET.joined = true;
  NET.players.set(id, { id, n: NET.nick, lv: playerLevel(), t: NET.srv ? Math.max(0, srvTeam()) : 0, conn: null, ig: false, seen: performance.now(), ld: 0 });
  if (NET.srv) srvRoomUp(); // la partie d'un salon public : le serveur l'annonce aux autres, elle se lance quand ils sont là (srvHostTick)
  else netStatus(NET.tx.p2p === 'ok' || netViaServer() ? _t('Salon ouvert : envoyez le lien à vos amis, puis lancez la partie.') : _t('Salon ouvert par le relais. Envoyez le lien à vos amis, puis lancez la partie.'));
  netLobbyChanged();
  const lobby = $('netLobby'); if (lobby) lobby.scrollIntoView({ block: 'nearest' });
  if (NET.quick) { NET.quick = false; setTimeout(() => netLaunch(), 300); } // « Jouer maintenant » : on joue tout de suite, avec des bots
}
/* Voie 1, pair à pair : les invités se connectent directement au navigateur de l'hôte */
function netHostP2p(code) {
  const peer = new Peer(NET_PREFIX + code, netPeerOpts());
  NET.peer = peer;
  peer.on('open', (id) => {
    if (NET.peer !== peer) return;
    NET.tx.p2p = 'ok'; NETD.sig = 'ok'; netdLog('serveur de mise en relation : connecté');
    if (NET.joined) { netStatus(_t('Salon ouvert : envoyez le lien à vos amis, puis lancez la partie.')); return; } // (re)connexion au serveur : le salon est intact
    netHostUp(id);
  });
  peer.on('connection', (c) => netHostAccept(c));
  peer.on('disconnected', () => { if (NET.peer === peer && !peer.destroyed) netdLog('serveur de mise en relation : connexion perdue, nouvel essai'); if (NET.peer === peer && !peer.destroyed) setTimeout(() => { if (NET.peer === peer && !peer.destroyed && peer.disconnected) { try { peer.reconnect(); } catch (e) { /* nouvel essai au prochain échec */ } } }, 2000); });
  peer.on('error', (err) => netPeerError(peer, err));
}
/* Voie 2, relais : le salon est aussi ouvert auprès du relais, pour les invités que le pair à pair ne peut pas joindre */
function netHostRelay(code, key) {
  NETD.rel = 'try'; netdLog('relais de secours : ouverture du salon');
  const rh = new RelayHost(code, (c) => netHostAccept(c), (st, why) => {
    if (NET.relay !== rh) return;
    netdLog('relais de secours : ' + st + (why ? ' (' + why + ')' : ''));
    NET.relayDown = st === 'down'; // (liaison de l'hôte au serveur coupée : netLinkBad)
    if (st === 'up') { NET.tx.relay = 'ok'; NETD.rel = 'ok'; netOldConnClose(); netMigDone(); if (NET.joined) netLobbyChanged(); else netHostUp(NET_PREFIX + code); } // (déjà dans le salon : partie reprise, ou retour après une coupure)
    else if (st === 'taken') { // code déjà pris : on en tire un autre (celui d'un salon du serveur vient du serveur) ; en partie, un autre joueur l'a reprise
      const o = NET.hostOpts, live = NET.on && !!o.srv;
      netReset(live ? _t('Connexion perdue. La partie continue chez un autre joueur.') : undefined);
      if (live) toMenu(); else if (!o.srv) netHost(o);
    } else if (st === 'fail') netTxFail('relay', netViaServer() ? _t('Le serveur de jeu est injoignable.') : _t('Le relais de secours est injoignable.'));
  }, key);
  NET.relay = rh; rh.start();
}
/* Une voie de connexion a échoué : on n'abandonne que lorsqu'il n'en reste aucune */
function netTxFail(kind, msg) {
  if (NET.role === 'off' || NET.joined) return;
  NET.tx[kind] = 'fail';
  if (kind === 'relay') NETD.rel = 'fail';
  if (NET.role === 'host') { if (NET.tx.p2p !== 'wait' && NET.tx.relay !== 'wait') netFail(msg); return; }
  if (kind === 'p2p' && NET.tx.relay === 'idle') { netJoinRelay(NET.code); return; } // le pair à pair a échoué : relais tout de suite
  if (NET.tx[kind === 'p2p' ? 'relay' : 'p2p'] === 'wait') return;
  netFail(msg);
}
function netJoinLobby(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length !== 5) { netStatus(_t('Le code d\u0027un salon compte 5 caractères.')); return; }
  if (NET.role !== 'off' || !netCan() || !acctGate(code)) return;
  netNick();
  const direct = netLib() && !netRelayOnly();
  Object.assign(NET, { role: 'client', peer: null, hostConn: null, relay: null, relayConn: null, code, me: '', phase: 'lobby', joined: false, t0: performance.now(), tx: { p2p: direct ? 'wait' : 'off', relay: netrUrl() ? 'idle' : 'off' } });
  NET.players.clear();
  netdReset('client', code); netdLog('recherche du salon ' + code);
  netStatus(_t('Connexion au salon {0}...', code));
  if (direct) netJoinP2p(code);
  if (netrUrl()) NET.relayTimer = setTimeout(() => netJoinRelay(code), direct ? NETR.after : 0); // le relais ne sert qu'après un court délai : le pair à pair reste le chemin préféré
  netRender();
}
/* Voie 1, pair à pair */
function netJoinP2p(code) {
  const peer = new Peer(netPeerOpts());
  NET.peer = peer;
  peer.on('open', (id) => {
    if (NET.peer !== peer) return;
    NET.me = id; NETD.sig = 'ok'; netdLog('serveur de mise en relation : connecté');
    const c = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' });
    NET.hostConn = c; netdWatch(c, 'vers l\u0027hôte'); netdLog('connexion directe à l\u0027hôte en cours');
    c.on('open', () => { if (NET.hostConn === c) { NET.hostSeen = performance.now(); netdLog('canal ouvert avec l\u0027hôte'); netdPath(c, 'vers l\u0027hôte'); netSend(netHi(false)); } });
    c.on('data', (m) => { if (NET.hostConn === c) netClientMsg(m); });
    c.on('close', () => netHostLink(c, _t('L\u0027hôte a fermé le salon ou la connexion est perdue.')));
    c.on('error', () => netHostLink(c, _t('La connexion avec l\u0027hôte a échoué.')));
  });
  peer.on('error', (err) => netPeerError(peer, err));
}
/* Voie 2, relais : la connexion passe par le relais si le pair à pair n'a pas abouti */
function netJoinRelay(code) {
  clearTimeout(NET.relayTimer);
  if (NET.role !== 'client' || NET.code !== code || NET.joined || NET.relayConn || (NET.hostConn && NET.hostConn.open)) return;
  NET.tx.relay = 'wait'; NETD.rel = 'try';
  netdLog(NET.tx.p2p === 'off' ? 'mode relais uniquement : aucune tentative de connexion directe' : 'connexion directe impossible ou lente : essai par le relais de secours');
  netStatus(netViaServer() ? _t('Connexion au salon {0}...', code) : _t('Connexion au salon {0} par le relais...', code));
  const id = 'g' + netrRandom(9), c = netrJoin(code, id);
  NET.relayConn = c;
  if (NET.srv) c.grace = NETR.srvGrace; // partie d'un salon du serveur : l'hôte parti, un autre joueur la reprend (netTakeOver)
  c.on('hostdown', () => { if (NET.hostConn === c) netMigSoon(); }); // l'hôte n'est plus là : écran « Migration de l'hôte » s'il ne revient pas vite
  c.on('rehost', () => { if (NET.hostConn === c && NET.role === 'client') { netMigDone(); netSend(netHi(true)); } }); // un hôte revient (le même, ou un autre)
  c.on('open', () => {
    if (NET.relayConn !== c || NET.role !== 'client') return;
    if (NET.hostConn && NET.hostConn.open) { c.close(); return; } // la connexion directe a fini par aboutir : on la garde
    netdLog('relais de secours : canal ouvert, la partie passera par le relais');
    NET.tx.relay = 'ok'; NETD.rel = 'ok'; NET.tx.p2p = 'fail'; // la voie directe est abandonnée : si le relais tombe avant l'entrée dans le salon, on échoue tout de suite
    const peer = NET.peer;
    NET.peer = null; NET.hostConn = c; NET.me = id; NET.hostSeen = performance.now();
    if (peer) { try { peer.destroy(); } catch (e) { /* déjà détruit */ } }
    netSend(netHi(false));
    if (!netRelayOnly()) netStatus(_t('Connecté par le relais. Pour éviter l\u0027attente, cochez "Passer directement par le relais".'));
  });
  c.on('data', (m) => { if (NET.hostConn === c) netClientMsg(m); });
  c.on('close', () => {
    if (NET.relayConn !== c) return;
    NET.relayConn = null; NETD.relCode = c.code;
    netdLog('relais de secours : fermé (code ' + c.code + ')');
    const msg = c.code === 4004 ? _t('Salon introuvable. Vérifiez le code, ou l\u0027hôte a fermé le salon.') : c.code === 4002 ? _t('Ce salon est complet.') : c.code === 4003 ? _t('L\u0027hôte vous a exclu du salon.')
      : c.code === 4029 || c.code === 4013 ? _t('Le serveur de jeu est saturé. Réessayez dans un instant.') : netViaServer() ? _t('Le serveur de jeu est injoignable.') : _t('Le relais de secours est injoignable.');
    if (NET.hostConn === c) { if (!netResumeStart(c)) netHostLink(c, _t('L\u0027hôte a fermé le salon ou la connexion est perdue.')); }
    else netTxFail('relay', msg);
  });
}
/* ---------- Reprise après une coupure, en pleine partie ----------
   Un invité coupé du serveur de jeu pendant une partie (réseau qui cale, téléphone en économie d'énergie, connexion fermée par le serveur)
   quittait la partie : retour au menu, puis nouvelle entrée sous un autre identifiant, éliminations, morts et score remis à zéro. Il se
   reconnecte maintenant au même salon avec le même identifiant et la même clé (le serveur ne le rend qu'à cette clé), sous l'écran
   « Reconnexion » qui fige sa partie (playHold : ni tir ni touche qui ne compterait pas) ; l'hôte garde son soldat et ses compteurs pendant
   ce temps (netHostAway), ses numéros d'événements continuent (NET.seen des autres reste juste). Au bout de NET_RESUME, départ comme avant. */
const NET_RESUME = 20000, NET_RESUME_WAIT = [300, 1000, 2000, 3000];
function netResumeStart(c) {
  const refus = [4001, 4002, 4003, 4004, 4005, 4010, 4011]; // salon refusé, complet, exclu, introuvable (hôte parti pour de bon), version, connexion remplacée
  if (NET.leaving || NET.role !== 'client' || !NET.joined || !NET.on || !c.relay || MATCH.fin || refus.includes(c.code) || !['playing', 'paused', 'killcam'].includes(MATCH.state)) return false;
  NET.hostConn = null;
  if (!NET.resume) { NET.resume = { t0: performance.now(), n: 0, timer: 0 }; netdLog('connexion perdue en partie (code ' + c.code + ') : reconnexion'); }
  netMigShow(_t('Connexion perdue. Retour dans la partie...'), _t('Reconnexion'));
  netResumeNext();
  return true;
}
function netResumeNext() {
  const R = NET.resume; if (!R) return;
  clearTimeout(R.timer);
  if (performance.now() - R.t0 > NET_RESUME) { netResumeEnd(); netLost(_t('La connexion au serveur de jeu est perdue.')); return; }
  R.timer = setTimeout(netResumeTry, NET_RESUME_WAIT[Math.min(R.n++, NET_RESUME_WAIT.length - 1)]);
}
function netResumeEnd(soft) { const R = NET.resume; if (R) clearTimeout(R.timer); NET.resume = null; netMigDone(!soft); } // soft : l'écran se retire en douceur (retour réussi)
/* Liaison douteuse : invité sans nouvelles de l'hôte depuis 1,2 s (l'hôte publie 15 fois par seconde) ou en reprise, hôte coupé du serveur.
   Une touche part quand même (elle peut arriver en retard), mais sans croix ni mort prédite chez le tireur : elles annonçaient une
   élimination qui ne venait pas (beaucoup de touches sans élimination sur un téléphone en économie d'énergie, retour du propriétaire). */
function netLinkBad() {
  if (!MATCH.online) return false;
  if (NET.role === 'client') return !!NET.resume || !NET.hostConn || performance.now() - NET.hostSeen > 1200;
  return NET.role === 'host' && !!NET.relayDown;
}
function netResumeTry() {
  const R = NET.resume; if (!R || NET.role !== 'client' || NET.relayConn) return;
  const c = netrJoin(NET.code, NET.me); NET.relayConn = c;
  if (NET.srv) c.grace = NETR.srvGrace;
  c.on('hostdown', () => { if (NET.hostConn === c) netMigSoon(); });
  c.on('rehost', () => { if (NET.hostConn === c && NET.role === 'client') { netMigDone(); netSend(netHi(true)); } });
  c.on('open', () => {
    if (NET.relayConn !== c || NET.resume !== R || NET.role !== 'client') return;
    netResumeEnd(true);
    NET.hostConn = c; NET.hostSeen = performance.now();
    netSend(netHi(true)); // (mig : déjà dans la partie, avec son équipe ; l'hôte rattache cette connexion à notre place)
    netdLog('reconnecté à la partie après ' + Math.round((performance.now() - R.t0) / 100) / 10 + ' s');
  });
  c.on('data', (m) => { if (NET.hostConn === c) netClientMsg(m); });
  c.on('close', () => {
    if (NET.relayConn !== c) return;
    NET.relayConn = null;
    if (NET.hostConn === c) { if (!netResumeStart(c)) netHostLink(c, _t('L\u0027hôte a fermé le salon ou la connexion est perdue.')); return; }
    if (NET.resume !== R) return;
    if ([4002, 4003, 4004, 4005].includes(c.code)) { netResumeEnd(); netLost(c.code === 4003 ? _t('L\u0027hôte vous a exclu du salon.') : _t('La connexion au serveur de jeu est perdue.')); return; }
    netResumeNext();
  });
}
/* Fin d'une connexion vers l'hôte : perte en cours de salon, ou échec de cette voie avant d'y être entré */
function netHostLink(c, msg) {
  if (NET.hostConn !== c) return;
  if (NET.joined) { netLost(msg); return; }
  NET.hostConn = null;
  netTxFail(c.relay ? 'relay' : 'p2p', c.relay && c.code === 4004 ? _t('Salon introuvable. Vérifiez le code, ou l\u0027hôte a fermé le salon.') : msg);
}
function netPeerError(peer, err) {
  if (NET.peer !== peer) return;
  const t = err && err.type;
  NETD.err = t || ''; netdLog('erreur du serveur de mise en relation : ' + (t || 'inconnue') + (err && err.message ? ' (' + String(err.message).slice(0, 80) + ')' : ''));
  if (t === 'unavailable-id' && NET.role === 'host' && !NET.joined) { const o = NET.hostOpts; netReset(); netHost(o); return; } // code déjà pris : on en tire un autre
  if (t === 'peer-unavailable') { netTxFail('p2p', _t('Salon introuvable. Vérifiez le code, ou l\u0027hôte a fermé le salon.')); return; }
  if (t === 'browser-incompatible') { netTxFail('p2p', _t('Ce navigateur ne permet pas le jeu en ligne.')); return; }
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'disconnected') {
    // une fois le salon établi, les connexions directes survivent à la perte du serveur de mise en relation
    if (!NET.joined) { if (NETD.sig !== 'ok') NETD.sig = 'fail'; netTxFail('p2p', _t('Serveur de mise en relation injoignable. Réessayez dans un instant.')); }
    return;
  }
  if (!NET.joined) netTxFail('p2p', _t('Connexion impossible ({0}).', t || _t('erreur inconnue')));
}
/* Ferme tout ce qui touche au salon ; msg : texte d'état à afficher ensuite. Dans un salon public (SRV.on), seul le salon de la
   partie se ferme : la discussion et les joueurs masqués du salon public restent */
function netReset(msg) {
  if (NET.on) netLeaveMatch(true);
  if (NET.srv && NET.role === 'host' && SRV.hostCode && SRV.hostCode === NET.code) srvRoomFailed(); // la partie que j'héberge se ferme avant sa fin
  const peer = NET.peer, relay = NET.relay, rc = NET.relayConn;
  clearTimeout(NET.relayTimer); clearTimeout(NET.lobbyTimer); netOldConnClose(); netResumeEnd(); netMigDone(true);
  Object.assign(NET, { role: 'off', peer: null, hostConn: null, relay: null, relayConn: null, relayTimer: 0, tx: { p2p: 'off', relay: 'off' }, me: '', code: '', joined: false, phase: 'lobby', ldKey: '', lobbyTimer: 0, quick: false, quickJoin: false, kickAsk: '', srv: false, hostId: '' });
  NET.players.clear(); NET.banned.clear();
  if (!SRV.on) { NET.muted.clear(); chatClear(); $('netLeave').classList.add('hidden'); } // (salon fermé par l'hôte pendant la question)
  if (peer) { try { peer.destroy(); } catch (e) { /* déjà détruit */ } }
  if (relay) relay.close();
  if (rc) rc.close();
  netRender();
  netStatus(msg || netHello());
}
function netQuit() { if (SRV.on) srvLeave(_t('Vous avez quitté le salon.')); else netReset(_t('Vous avez quitté le salon.')); }
/* Retour, dans un salon (uiBack) : « Quitter le salon ? » au milieu de l'écran (#netLeave) ; rester (en jaune, où arrive le focus : un appui
   réflexe ne fait pas quitter) ou quitter ; Échap, B ou un clic sur le fond font rester. L'hôte qui part ferme le salon pour tous. */
function netLeaveAsk() {
  $('nlMsg').textContent = srvChief() ? _t('Vous êtes le chef du salon. Un autre joueur prendra votre place.') : SRV.on && SRV.st && SRV.st.ps ? _t('Vous pourrez revenir avec le code {0}.', SRV.st.i) : SRV.on ? _t('Vous pourrez revenir dans ce salon depuis la liste des salons publics.') : NET.role === 'host' ? _t('Vous êtes l\u0027hôte. Le salon se fermera pour tous les joueurs.') : _t('Vous pourrez revenir avec le code {0}.', NET.code);
  const el = $('netLeave'); el._from = document.activeElement; el.classList.remove('hidden'); sfxUi('click');
  if (lmWantFocus()) $('nlStay').focus({ preventScroll: true });
}
function netLeaveClose(quit) {
  const el = $('netLeave'); if (el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  if (quit) { netQuit(); if (UI.lobbyBack && UI.screen === 'multi') { UI.lobbyBack = false; const prev = UI.stack.pop(); if (prev) uiGo(prev, false); } return; } // salon ouvert depuis Jouer ou le menu : on y revient
  sfxUi('back'); const f = el._from; el._from = null; if (f && f.isConnected && f.focus && lmWantFocus()) f.focus({ preventScroll: true });
}
/* Perte de l'hôte côté client : retour au menu si une partie était en cours */
function netLost(msg) {
  if (NET.role !== 'client') return;
  const wasPlaying = NET.on, launching = !!(UI.flow && UI.flow.online);
  netReset(msg);
  if (wasPlaying && MATCH.state !== 'menu' && !(SRV.on && MATCH.fin)) toMenu(); // salon public : une partie qui finit va à son terme (annonce, killcam finale, résultats)
  else if (launching) uiOpen('multi', ['main']); // chargement ou choix de la classe en cours
  netStatus(msg);
}

/* ---------- Salons publics et « Jouer maintenant » (serveur de jeu) ----------
   L'hôte d'un salon public l'annonce au serveur (RelayHost.pub) : son nom d'affichage, la carte, le mode, le nombre de
   joueurs et la phase. La liste vient de GET /salons, relue toutes les 5 s tant que l'écran Multijoueur est ouvert ; elle
   donne aussi le nombre de joueurs connectés au serveur. Un salon privé n'y figure jamais. */
const NETP = { list: [], joueurs: -1, at: 0, busy: false, err: false };
/* Texte d'accueil de l'écran Multijoueur, hors salon */
function netHello() { return SRV.list ? _t('Rejoignez une partie publique, ou créez un salon privé pour vos amis.') : netViaServer() ? _t('Jouez tout de suite, rejoignez une partie publique, ou créez un salon pour vos amis.') : _t('Créez un salon et envoyez le lien à vos amis, ou entrez le code d\u0027un salon.'); }
function netPubUrl() { const u = netrUrl(); return u && netViaServer() ? u.replace(/^ws/, 'http') + '/salons' : ''; }
function netPubSync() {
  if (NET.role !== 'host' || !NET.relay) return;
  NET.relay.pub(NET.cfg.pub ? { n: NET.nick, m: NET.cfg.map, o: NET.cfg.mode, j: NET.players.size, x: NET_MAX, p: NET.phase, v: NET_PROTO } : null);
}
async function netPubFetch() {
  const u = netPubUrl(); if (!u) return [];
  try {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    NETP.list = (Array.isArray(d.salons) ? d.salons : []).filter((s) => s && s.v === NET_PROTO && /^[A-Z0-9]{5}$/.test(s.c) && MAPS.some((m) => m.id === s.m && m.ok) && MODES[s.o]);
    const hello = netHello(); srvRead(d); // salons publics permanents et salons créés (SRV.list null : serveur de jeu d'avant, sans eux)
    if (NET.status === hello) netStatus(netHello()); // l'invite d'accueil suit (elle ne s'affiche pas comme un message)
    NETP.joueurs = Math.max(0, d.joueurs | 0); NETP.err = false;
  } catch (e) { NETP.err = true; }
  NETP.at = Date.now(); netPubRender();
  return NETP.list;
}
function netPubRender() { const L = LM.scr.multi; if (L && !netInLobby() && UI.screen === 'multi') lmRender(L); } // la liste est la scène de l'accueil du menu Multijoueur (NET_PAGES)
/* Liste relue toutes les 5 s, seulement écran Multijoueur ouvert, hors salon et page visible */
function netPubTick() {
  if (NETP.busy || !netPubUrl() || UI.screen !== 'multi' || netInLobby() || document.hidden || Date.now() - NETP.at < 5000) return;
  NETP.busy = true; netPubFetch().finally(() => { NETP.busy = false; });
}
/* « Jouer maintenant » : la partie publique la plus remplie qui a de la place, sinon un salon public avec des bots, lancé aussitôt */
async function netQuick() {
  if (NET.role !== 'off' || !netCan() || !acctGate()) return;
  netStatus(_t('Recherche d\u0027une partie publique...'));
  const list = await netPubFetch();
  if (NET.role !== 'off') return;
  const s = list.filter((x) => x.j < x.x).sort((a, b) => b.j - a.j)[0];
  if (s) { netJoinLobby(s.c); NET.quickJoin = NET.role === 'client'; return; }
  netHost({ pub: 1, quick: 1 });
}

/* ---------- Côté hôte ---------- */
function netHostAccept(c) {
  const who = 'connexion de ' + String(c.peer).slice(-4);
  netdLog(who + ' : arrivée' + (c.relay ? ' par le relais' : '')); netdWatch(c, who);
  c.on('open', () => { netdLog(who + ' : canal ouvert'); netdPath(c, who); });
  c.on('data', (m) => netHostMsg(c, m));
  c.on('close', () => netHostDrop(c.peer, c));
  c.on('error', () => netHostDrop(c.peer, c));
}
function netHostMsg(c, m) {
  if (NET.role !== 'host' || !m || typeof m !== 'object') return;
  const id = c.peer, now = performance.now();
  let pl = NET.players.get(id);
  // invité coupé en pleine partie qui revient (même identifiant, que le serveur ne rend qu'à sa clé) : sa place, son soldat et ses compteurs
  if (pl && pl.away && pl.conn !== c && m.t === 'hi') {
    Object.assign(pl, { conn: c, away: 0, seen: now, r: !!c.relay });
    netStatus(`${_t('{0} est de retour.', pl.n)}`); netLobbyChanged();
    return;
  }
  if (pl && pl.conn !== c) return;
  if (pl) pl.seen = now;
  if (m.t === 'hi') {
    if (pl) return;
    if (m.v !== NET_PROTO) { try { c.send({ t: 'deny', why: 'version' }); } catch (e) { /* ignoré */ } setTimeout(() => c.close(), 800); return; }
    // même joueur déjà là par une autre connexion (voie directe tombée sans que l'hôte le voie, puis relais) : la
    // nouvelle remplace l'ancienne, qui sinon resterait affichée en double jusqu'à son expiration (30 s sans nouvelles)
    const k = typeof m.k === 'string' ? m.k.slice(0, 32) : '';
    const prev = k ? [...NET.players.values()].find((p) => p.k === k && p.conn && p.conn !== c) : null;
    if (prev) netHostForget(prev);
    if (k && NET.banned.has(k)) { try { c.send({ t: 'deny', why: 'kick' }); } catch (e) { /* ignoré */ } setTimeout(() => c.close(), 800); return; } // exclu par l'hôte
    if (NET.players.size >= NET_MAX) { try { c.send({ t: 'deny', why: 'full' }); } catch (e) { /* ignoré */ } setTimeout(() => c.close(), 800); return; }
    const cnt = netTeamCounts(), want = NET.srv && (m.tm === 0 || m.tm === 1) && (m.mig || (SRV.st && SRV.st.ps)) ? m.tm : -1; // l'équipe choisie dans un salon créé, ou celle de la partie reprise
    pl = { id, k, n: netClean(m.n), lv: clamp(m.lv | 0, 0, 100), t: prev ? prev.t : want >= 0 ? want : cnt[1] < cnt[0] ? 1 : 0, conn: c, ig: !!m.mig && NET.on, seen: now, r: !!c.relay, ld: m.mig ? 100 : 0 }; // mig : déjà dans la partie que je viens de reprendre
    NET.players.set(id, pl);
    netStatus(prev ? `${_t('{0} a changé de connexion{1}.', pl.n, pl.r ? ' ' + _t('(relais)') : '')}` : `${_t('{0} a rejoint le salon.', pl.n)}`);
    netLobbyChanged();
    return;
  }
  if (!pl) return;
  // cadence par joueur : un client modifié ne fait pas rediffuser à tout le salon des centaines de messages par seconde (l'hôte
  // dépasserait la limite du relais et serait coupé) ; un état publié part environ 15 fois par seconde, plus à chaque touche
  const r = pl.rate || (pl.rate = { t: now, p: 0, o: 0 });
  if (now - r.t >= 1000) { r.t = now; r.p = 0; r.o = 0; }
  // (180 états : un invité qui rattrape d'un coup quelques secondes de réseau calé n'y perd pas ses derniers états, ceux des touches récentes)
  if (m.t === 'p' ? ++r.p > 180 : (m.t === 'nick' || m.t === 'team' || m.t === 'lv') && ++r.o > 3) return;
  switch (m.t) {
    case 'nick': pl.n = netClean(m.n); netLobbyChanged(); break;
    case 'lv': pl.lv = clamp(m.lv | 0, 0, 100); netLobbyChanged(); break; // niveau monté depuis l'arrivée (netLevelSync)
    case 'chat': chatHostRelay(id, m.x); break;
    case 'team': if (!pl.ig) { pl.t = 1 - pl.t; netLobbyChanged(); } break;
    case 'join': // arrivée en cours de partie (ou pendant le chargement : on ne l'attend pas)
      if (NET.phase !== 'lobby' && !pl.ig) {
        pl.ig = true; pl.late = NET.phase === 'loading'; netLobbyChanged();
        netSendTo(pl, { t: 'start', cfg: NET.cfg, team: pl.t, tl: NET.phase === 'playing' ? MATCH.timeLeft : NET.cfg.time * 60 }); netRebalanceBots();
      }
      break;
    case 'leave':
      if (pl.ig) { pl.ig = false; netRemoveById(id); netBroadcast({ t: 'gone', id }, true, id); netLobbyChanged(); netRebalanceBots(); netCheckGo(); }
      break;
    case 'ld': // progression du chargement de la carte (0 à 100)
      pl.ld = m.m === NET.cfg.map ? clamp(m.p | 0, 0, 100) : 0;
      netLobbySoon(); netCheckGo();
      break;
    case 'p':
      if (!pl.ig || !NET.on || !m.p || typeof m.p !== 'object') break;
      netApply(id, m.p);
      netBroadcast({ t: 'ps', l: [[id, m.p]] }, true, id);
      break;
  }
}
/* Joueur remplacé par une nouvelle connexion du même joueur (voir netKey) : retiré sans annonce de départ ; la
   fermeture de son ancienne connexion ne trouve alors plus personne à retirer */
function netHostForget(pl) {
  NET.players.delete(pl.id);
  if (pl.ig) { netRemoveById(pl.id); netBroadcast({ t: 'gone', id: pl.id }); }
  try { pl.conn.close(); } catch (e) { /* déjà fermée */ }
}
/* L'hôte exclut un joueur du salon : prévenu, déconnecté, et refusé s'il revient avec la même page (sa clé, voir netKey) */
function netKick(id) {
  const pl = NET.players.get(id); NET.kickAsk = '';
  if (NET.role !== 'host' || !pl || id === NET.me) return;
  if (pl.k) NET.banned.add(pl.k);
  const c = pl.conn; // (absent, coupé en pleine partie : pas de connexion)
  netSendTo(pl, { t: 'deny', why: 'kick' });
  if ((!c || c.relay) && NET.relay) setTimeout(() => NET.relay && NET.relay.ban(id), 300); // le serveur de jeu refuse ensuite son adresse dans ce salon
  if (c) setTimeout(() => { try { c.close(); } catch (e) { /* déjà fermée */ } }, 400);
  netHostDrop(id, c, true);
  netStatus(_t('{0} a été exclu du salon.', pl.n));
}
/* Invité parti. hard : pour de bon (exclu, muet depuis 30 s, absent depuis NET_AWAY) ; sinon, une connexion par le serveur de jeu fermée en
   pleine partie le laisse absent NET_AWAY (netResume) : sa place, son soldat et ses compteurs restent, les autres le cachent en attendant */
const NET_AWAY = 25000;
function netHostDrop(id, c, hard) {
  const pl = NET.players.get(id);
  if (NET.role !== 'host' || !pl || (c && pl.conn !== c)) return;
  if (!hard && c && c.relay && pl.ig && NET.on && !MATCH.fin) {
    pl.conn = null; pl.away = performance.now();
    netRemoteAway(id); netBroadcast({ t: 'away', id });
    netStatus(`${_t('{0} a perdu la connexion.', pl.n)}`); netLobbyChanged();
    return;
  }
  NET.players.delete(id);
  netRemoveById(id);
  netBroadcast({ t: 'gone', id });
  netStatus(`${_t('{0} a quitté le salon.', pl.n)}`);
  netLobbyChanged();
  netRebalanceBots();
  netCheckGo();
}
function netLobbyMsg() {
  const players = [...NET.players.values()].map((p) => ({ id: p.id, n: p.n, lv: p.lv | 0, t: p.t, h: p.id === NET.me ? 1 : 0, ig: p.ig ? 1 : 0, r: p.r ? 1 : 0, ld: p.ld | 0, la: p.late ? 1 : 0 }));
  return { t: 'lobby', code: NET.code, phase: NET.phase, cfg: NET.cfg, players };
}
function netLobbyChanged() {
  clearTimeout(NET.lobbyTimer); NET.lobbyTimer = 0;
  if (NET.role === 'host') { netBroadcast(netLobbyMsg()); netPubSync(); if (NET.srv) srvHostTick(); }
  netRender();
}
/* Les progressions de chargement arrivent souvent : un seul envoi de l'état du salon toutes les 0,4 s au plus */
function netLobbySoon() { if (!NET.lobbyTimer) NET.lobbyTimer = setTimeout(netLobbyChanged, 400); }
/* Lancement : tout le monde charge la carte, la partie part quand chacun a fini (netCheckGo) */
function netLaunch() {
  if (NET.role !== 'host' || !NET.joined || NET.phase !== 'lobby') return;
  NET.phase = 'loading'; NET.startT = performance.now();
  for (const pl of NET.players.values()) { pl.ig = true; pl.late = false; }
  netLobbyChanged();
  const tl = NET.cfg.time * 60;
  for (const pl of NET.players.values()) netSendTo(pl, { t: 'start', cfg: NET.cfg, team: pl.t, tl });
  netStartOnline({ cfg: NET.cfg, team: NET.players.get(NET.me).t, tl });
  netCheckGo();
}
/* Hôte : départ quand tous les joueurs lancés ont chargé la carte, ou au bout de NET_LOAD_WAIT secondes. Le passage en
   phase « playing » est le signal de départ (état du salon, et chaque battement pour ceux qui l'auraient manqué). */
function netCheckGo() {
  if (NET.role !== 'host' || NET.phase !== 'loading') return;
  if (performance.now() - NET.startT < NET_LOAD_WAIT * 1000) for (const pl of NET.players.values()) if (pl.ig && !pl.late && (pl.ld | 0) < 100) return;
  NET.phase = 'playing';
  netLobbyChanged();
}
function netGo() { return NET.role !== 'off' && NET.phase === 'playing'; }
/* Progression de mon chargement de la carte du salon : envoyée à l'hôte (au plus toutes les 0,6 s, sauf la fin) */
function netLoadReport(force) {
  if (NET.role === 'off' || !NET.joined) return;
  const map = NET.cfg.map, p = MAPL.id !== map ? 0 : MAPL.state === 'ready' ? 100 : Math.min(99, Math.round(MAPL.p * 100));
  const key = map + ':' + p, now = performance.now();
  if (!force && (key === NET.ldKey || (p < 100 && now - NET.ldT < 600))) return;
  NET.ldKey = key; NET.ldT = now;
  if (NET.role === 'client') { netSend({ t: 'ld', m: map, p }); return; }
  const me = NET.players.get(NET.me);
  if (me && me.ld !== p) { me.ld = p; netLobbySoon(); }
  netCheckGo();
}
/* Écran de chargement : qui charge encore */
function netWaitHtml() {
  const out = [];
  for (const p of NET.players.values()) if (p.ig && !p.late && (p.ld | 0) < 100) out.push(`<b>${esc(p.n)}</b> ${p.ld | 0}${PCT}`);
  if (!out.length) return '';
  const left = NET.role === 'host' ? Math.ceil(NET_LOAD_WAIT - (performance.now() - NET.startT) / 1000) : 0;
  return _t('Chargement en cours : {0}', out.join(', ')) + (left > 0 ? ` ${_t('(départ sans eux dans {0} s)', left)}` : '');
}
/* Mon chargement a échoué : je quitte la partie (l'hôte, lui, l'annule pour tout le monde) */
function netLoadFailed() {
  if (NET.role === 'client') netSend({ t: 'leave' });
  else if (NET.role === 'host') { netMatchEnded(); netStatus(_t('Partie annulée : la carte n\u0027a pas pu être chargée.')); }
}
/* Fin de partie décidée par l'hôte (limite atteinte, temps écoulé, ou l'hôte quitte) */
function netMatchEnded() {
  if (NET.role !== 'host' || NET.phase === 'lobby') return;
  if (NET.srv) srvRoomEnded(); // salon public : décompte de la partie suivante
  NET.phase = 'lobby';
  netBroadcast({ t: 'end' });
  for (const pl of NET.players.values()) { pl.ig = false; pl.late = false; }
  netLobbyChanged();
}

/* ---------- Bots simulés par l'hôte ---------- */
function netRebalanceBots() {
  if (NET.role !== 'host' || !NET.on) return;
  const hum = [0, 0];
  for (const pl of NET.players.values()) if (pl.ig) hum[pl.t]++;
  const ffa = NET.cfg.mode === 'ffa'; // chacun pour soi : un seul groupe, complété jusqu'à NET_MAX joueurs
  for (const t of ffa ? [-1] : [0, 1]) {
    const want = !NET.cfg.bots ? 0 : ffa ? Math.max(0, NET_MAX - hum[0] - hum[1]) : Math.max(0, NET_TEAM - hum[t]);
    const pool = entities.filter((e) => !e.isPlayer && !e.isRemote && (ffa || e.team === t));
    let active = pool.filter((b) => b.netBot);
    while (active.length > want) { const b = active.find((x) => !x.alive) || active[active.length - 1]; netBotOff(b); active = active.filter((x) => x !== b); }
    for (const b of pool) { if (active.length >= want) break; if (!b.netBot) { netBotOn(b); active.push(b); } }
  }
}
function netBotOn(b) {
  b.netBot = true; b.netId = NET.me + '~b' + b.id; b.netQ = { seq: 0, list: [] };
  b.kills = b.deaths = b.score = b.assists = b.streak = 0;
  spawnEntity(b);
}
function netBotOff(b) {
  NET.goneK[b.team] += b.kills | 0; // ses éliminations restent au score de son équipe
  b.netBot = false; b.alive = false; b.respawnT = Infinity; b.target = null; b.model.rag = null; b.model.root.visible = false;
  netBroadcast({ t: 'gone', id: b.netId }, true);
}
/* ---------- Reprise d'une partie dont l'hôte est parti (salon du serveur de jeu, src/09cb-serveurs.js) ----------
   Le serveur choisit un joueur de la partie (un ordinateur de préférence) et lui donne une nouvelle clé d'hôte du même salon. Son jeu
   passe d'invité à hôte sans quitter la partie : il reprend les bots de l'ancien hôte (mêmes identifiants, noms, éliminations, morts et
   score, à leur place s'ils sont en vie), retire le soldat de l'ancien hôte (ses éliminations restent au score de son équipe, NET.goneK),
   ouvre le salon comme hôte ; les invités, qui attendaient (NETR.srvGrace), se présentent de nouveau avec leur équipe (« hi », mig) et la
   partie continue : le temps, le score, et en domination les points, que chacun recevait de l'ancien hôte. */
function netTakeOver(code, key) {
  const c = NET.relayConn || NET.hostConn, old = [...NET.players.values()].find((p) => p.h), oldId = (old && old.id) || NET.hostId;
  // ma connexion d'invité reste ouverte jusqu'à ce que le salon soit à moi (sinon, seul invité, il se viderait) ; ses écouteurs ne la reconnaissent plus
  NET.relayConn = null; NET.hostConn = null; NET.oldConn = c; clearTimeout(NET.relayTimer);
  Object.assign(NET, { role: 'host', hostOpts: { srv: true, code }, tx: { p2p: 'off', relay: 'wait' }, phase: 'playing', hostId: NET.me });
  NET.players.clear();
  NET.players.set(NET.me, { id: NET.me, n: NET.nick, lv: playerLevel(), t: PL.ent.team, conn: null, ig: true, seen: performance.now(), ld: 100 });
  netAdoptBots();
  const oe = NET.remotes.get(oldId); if (oe) { netHeliDrop(oe); netRemoveById(oldId); }
  netdLog('partie ' + code + ' : reprise comme hôte');
  netMigShow(_t('Vous devenez l\u0027hôte de la partie.'));
  netHostRelay(code, key);
  hudMsg(_t('L\u0027hôte est parti. Vous hébergez maintenant la partie.'), 'xp', 3);
  // les invités se présentent de nouveau dans les secondes qui suivent ; ceux qui ne reviennent pas sont partis, et les bots complètent
  setTimeout(() => {
    if (NET.role !== 'host' || !NET.on) return;
    for (const [id, e] of [...NET.remotes]) if (!e.remoteBot && !NET.players.has(id)) { netRemoveById(id); netBroadcast({ t: 'gone', id }); }
    netRebalanceBots();
  }, 8000);
}
/* Écran « Migration de l'hôte », comme les anciens Call of Duty (#hostMig de shell.html) : l'hôte d'une partie d'un salon du serveur est
   parti, un autre joueur la reprend. Montré une seconde après la perte de l'hôte (une coupure plus brève passe inaperçue) ; la partie est
   figée tant qu'il est là (playHold : personne ne bouge ni ne tire, le chrono s'arrête) ; la barre avance vers sa fin sans l'atteindre,
   puis se remplit quand l'hôte est en place (le même revenu, ou le nouveau) et l'écran s'efface. */
const MIG = { on: false, t0: 0, timer: 0, tick: 0 };
function netMigSoon() {
  if (MIG.on || MIG.timer || !NET.on || !NET.srv || MATCH.fin) return;
  MIG.timer = setTimeout(() => {
    MIG.timer = 0;
    if (NET.on && NET.srv && !MATCH.fin && ['playing', 'paused', 'killcam'].includes(MATCH.state)) netMigShow(_t('Un autre joueur reprend la partie.'));
  }, 1000);
}
function netMigShow(sub, title) {
  $('hmSub').textContent = sub; $('hmTitle').textContent = title || _t('Migration de l\u0027hôte');
  if (MIG.on) return;
  MIG.on = true; MIG.t0 = performance.now();
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false; // (une touche tenue ne reprend pas toute seule)
  const el = $('hostMig'); el.classList.remove('hidden', 'out');
  clearInterval(MIG.tick); MIG.tick = setInterval(netMigBar, 100); netMigBar();
}
function netMigBar() { const t = (performance.now() - MIG.t0) / 1000; $('hmBar').style.transform = `scaleX(${(0.95 * (1 - Math.exp(-t / 3))).toFixed(3)})`; }
/* Hôte en place : la barre se remplit, l'écran s'efface ; now : tout de suite (partie quittée ou finie) */
function netMigDone(now) {
  clearTimeout(MIG.timer); MIG.timer = 0;
  if (!MIG.on) return;
  MIG.on = false; clearInterval(MIG.tick);
  const el = $('hostMig');
  if (now) { el.classList.add('hidden'); return; }
  $('hmBar').style.transform = 'scaleX(1)';
  setTimeout(() => { if (!MIG.on) el.classList.add('out'); }, 350);
  setTimeout(() => { if (!MIG.on) { el.classList.add('hidden'); el.classList.remove('out'); } }, 650);
}
/* Connexion d'invité d'une partie que j'ai reprise : fermée une fois le salon à moi (ou en le quittant) */
function netOldConnClose() { const c = NET.oldConn; NET.oldConn = null; if (c) { try { c.close(); } catch (e) { /* déjà fermée */ } } }
/* Les bots de l'ancien hôte (distants chez moi) deviennent les miens : un bot de ma réserve de la même équipe prend leur identifiant, leur
   nom, leurs compteurs et leur place ; la numérotation de leurs événements continue (les autres ignorent un numéro déjà vu) */
function netAdoptBots() {
  const pool = entities.filter((e) => !e.isPlayer && !e.isRemote && !e.netBot), ffa = MATCH.mode === 'ffa';
  for (const r of [...NET.remotes.values()].filter((e) => e.remoteBot)) {
    const b = pool.find((x) => ffa || x.team === r.team), id = r.peer, seq = NET.seen.get(id) || 0, was = { alive: r.alive, pos: r.pos.clone(), yaw: r.yaw };
    netHeliDrop(r); netRemoveById(id, true);
    if (!b) continue; // plus de bot libre dans cette équipe : il quitte la partie
    pool.splice(pool.indexOf(b), 1);
    netBotOn(b);
    Object.assign(b, { netId: id, name: r.name, kills: r.kills, deaths: r.deaths, score: r.score, assists: r.assists, netQ: { seq: seq + 50, list: [] } });
    if (was.alive) { b.pos.copy(was.pos); b.yaw = b.lookYaw = was.yaw; }
  }
}
/* Hélicoptère d'un soldat qui quitte ma partie (l'ancien hôte, ou un de ses bots repris) : il s'écrase */
function netHeliDrop(e) { for (const h of KS.helis) if (h.owner === e && h.state !== 'crash') { h.state = 'crash'; h.burst = null; h.vy = 0; h.spin = 0; } }
function netDisableBots() { for (const e of entities) if (e.netBot) { e.netBot = false; e.alive = false; e.respawnT = Infinity; e.model.rag = null; e.model.root.visible = false; } }

/* ---------- Côté client ---------- */
function netClientMsg(m) {
  if (NET.role !== 'client' || !m || typeof m !== 'object') return;
  NET.hostSeen = performance.now();
  switch (m.t) {
    case 'lobby': {
      if (!Array.isArray(m.players)) return;
      if (!NET.joined) { NET.joined = true; if (!NET.srv) netStatus(_t('Vous êtes dans le salon. En attente du lancement par l\u0027hôte.')); }
      NET.phase = netPhase(m.phase);
      NET.cfg = netCfg(m.cfg);
      const hp = m.players.find((p) => p && p.h), hid = hp && typeof hp.id === 'string' ? hp.id : '';
      if (hid && NET.hostId && hid !== NET.hostId && NET.on) { netRemoveById(NET.hostId); hudMsg(_t('La partie continue avec un nouvel hôte.'), 'neutral', 2.5); } // partie reprise par un autre joueur
      if (hid) NET.hostId = hid;
      NET.players.clear();
      for (const p of m.players) if (p && typeof p.id === 'string') NET.players.set(p.id, { id: p.id, n: netClean(p.n), lv: clamp(p.lv | 0, 0, 100), t: p.t === 1 ? 1 : 0, h: !!p.h, ig: !!p.ig, r: !!p.r, ld: clamp(p.ld | 0, 0, 100), late: !!p.la });
      netRender(); netLoadReport();
      if (NET.quickJoin && (NET.phase === 'playing' || (NET.srv && NET.phase === 'loading'))) { NET.quickJoin = false; netJoinRunning(); } // « Jouer maintenant », salon public : on entre dans la partie en cours
      else if (NET.quickJoin && NET.phase === 'lobby' && !NET.srv) NET.quickJoin = false; // salon en attente : l'hôte lance quand il veut (celui d'un salon public, dès que tous sont là)
      break;
    }
    case 'ping': if (m.ph) NET.phase = netPhase(m.ph); break;
    case 'chat': chatIn(m); break;
    case 'start': netStartOnline(m); break;
    case 'ps':
      if (!NET.on || !Array.isArray(m.l)) return;
      for (const it of m.l) if (Array.isArray(it) && typeof it[0] === 'string') netApply(it[0], it[1]);
      if (typeof m.tl === 'number' && isFinite(m.tl)) { MATCH.timeLeft = m.tl; cdNetIn(m.cd); } // (tl : l'envoi de l'hôte lui-même, pas un état relayé)
      if (m.dm && MATCH.mode === 'dom') domNetApply(m.dm);
      break;
    case 'gone': if (typeof m.id === 'string') netRemoveById(m.id); break;
    case 'away': if (typeof m.id === 'string') netRemoteAway(m.id); break;
    case 'end':
      if (NET.on && (MATCH.state === 'playing' || MATCH.state === 'paused')) matchFinish();
      else if (UI.flow && UI.flow.online && !NET.on) { NET.phase = 'lobby'; uiOpen('multi', ['main']); netStatus(_t('L\u0027hôte a annulé la partie.')); }
      break;
    case 'deny': netReset(m.why === 'full' ? _t('Ce salon est complet (8 joueurs).') : m.why === 'kick' ? _t('L\u0027hôte vous a exclu du salon.') : _t('Votre version du jeu diffère de celle de l\u0027hôte. Rechargez la page.')); break;
  }
}
function netPhase(ph) { return ph === 'playing' || ph === 'loading' ? ph : 'lobby'; }
function netCfg(c) {
  c = c || {};
  const map = mapById(c.map).id, mode = MODE_IDS.includes(c.mode) && (c.mode !== 'dom' || MAP_DEFS[map].dom) ? c.mode : 'tdm'; // la domination demande une carte à points
  const L = MODES[mode].limits, limit = L.includes(+c.limit) ? +c.limit : L[1];
  const time = [5, 10, 15].includes(+c.time) ? +c.time : 10;
  const diff = [0, 1, 2].includes(+c.diff) ? +c.diff : 2;
  return { bots: +c.bots ? 1 : 0, diff, limit, time, map, mode, pub: +c.pub ? 1 : 0 };
}

/* ---------- Entrée et sortie de partie ---------- */
/* Ordre de départ (hôte ou invité) : chargement de la carte, choix de la classe, puis netStartOnlineNow (voir 09e-menus.js) */
function netStartOnline(m) {
  NET.cfg = netCfg(m.cfg); NET.team = m.team === 1 ? 1 : 0; NET.quickJoin = false;
  menuLaunch({ online: true, map: NET.cfg.map, deploy: () => netStartOnlineNow(m) });
}
function netStartOnlineNow(m) {
  NET.cfg = netCfg(m.cfg); NET.team = m.team === 1 ? 1 : 0;
  for (const e of NET.remotes.values()) netRemoveRemote(e);
  NET.remotes.clear(); NET.seen.clear(); NET.seenT.clear(); NET.ak.clear(); NET.sent.length = 0; NET.held.length = 0;
  NET.on = true; NET.shots = 0; NET.lastPub = 0; PL.ent.netQ = { seq: 0, list: [] }; NET.goneK = [0, 0];
  if (MATCH.state === 'paused') $('pause').classList.remove('show');
  startMatch({ online: true });
  if (typeof m.tl === 'number' && isFinite(m.tl)) MATCH.timeLeft = m.tl;
  if (NET.role === 'host') netRebalanceBots();
  netRender();
}
function netJoinRunning() { if (NET.role === 'client' && NET.phase !== 'lobby' && !NET.on && !UI.flow) netSend({ t: 'join' }); }
/* Quitter la partie en cours sans quitter le salon ; silent : pas de message à l'hôte */
function netLeaveMatch(silent) {
  if (!NET.on) return;
  NET.on = false; netMigDone(true);
  for (const e of NET.remotes.values()) netRemoveRemote(e);
  NET.remotes.clear(); NET.seen.clear(); NET.seenT.clear(); NET.ak.clear(); NET.sent.length = 0; NET.held.length = 0;
  netDisableBots();
  if (!silent) { if (NET.role === 'client') netSend({ t: 'leave' }); else if (NET.role === 'host') netMatchEnded(); }
  netRender();
}
function netOnline() { return NET.on; }

/* ---------- Identités ---------- */
function netIsLocal(e) { return e === PL.ent || !!e.netBot; }
function netIdOf(e) { if (!e) return ''; if (e === PL.ent) return NET.me; if (e.isRemote) return e.peer; if (e.netBot) return e.netId; return ''; }
function netLocal(id) {
  if (id === NET.me) return PL.ent;
  if (NET.role === 'host' && typeof id === 'string' && id.includes('~b')) for (const e of entities) if (e.netBot && e.netId === id) return e; // (un bot repris d'un autre hôte garde son identifiant)
  return null;
}
function netEntity(id) { return netLocal(id) || NET.remotes.get(id) || null; }
function netWeaponKey(name) {
  for (const k in NET_WSPECIAL) if (NET_WSPECIAL[k] === name) return k;
  return Object.keys(WEAPONS).find((k) => WEAPONS[k].name === name) || '';
}
function netWeaponName(key, ent) { return hasKey(NET_WSPECIAL, key) ? NET_WSPECIAL[key] : hasKey(WEAPONS, key) ? WEAPONS[key].name : ent && ent.weapon ? ent.weapon.name : ''; }

/* ---------- Joueurs et bots distants ---------- */
/* Position publiée par un participant (s[0..2]), bornée autour de la carte : une valeur absurde ou infinie ne casse ni le rendu ni la physique */
function netPos(s, v) {
  const B = 300;
  return v.set(clamp(numOr(s[0]), MAP.x0 - B, MAP.x1 + B), clamp(numOr(s[1]), -B, 2 * B), clamp(numOr(s[2]), MAP.z0 - B, MAP.z1 + B));
}
function netMakeRemote(id, P) {
  const team = P.t === 1 ? 1 : 0, def = netWeaponDef(P), s = P.s;
  const e = {
    id: 1000 + (NET.rid++ % 1000), name: netClean(P.n), team, isPlayer: false, isRemote: true, remoteBot: !!P.b, bot: false, peer: id,
    pos: netPos(s, new V3()), vel: new V3(), yaw: 0, pitch: 0, lookYaw: 0, crouch: false, crouchAmt: 0,
    health: 100, alive: !!s[9], kills: 0, deaths: 0, assists: 0, score: 0, streak: 0, weapon: def, dmgBy: new Map(), lastForce: null,
    target: null, visible: false, lastSeenT: -99, lastShotT: -99, respawnT: 0, recoil: 0, net: { tgt: new V3(), tv: new V3(), at: 0, shots: P.f | 0, yaw: 0, pitch: 0, airT: -99 },
  };
  initCtl(e, [def], 1);
  e.skin = netSkin(P);
  e.model = makeSoldier(e.skin, skinRel(e), def.key);
  entities.push(e); NET.remotes.set(id, e); kcAssign(e);
  if (!e.remoteBot) { hudMsg(`${_t('{0} a rejoint la partie', e.name)}`, team === PL.ent.team ? 'ally' : 'enemy', 2.5); sfxUi('notify'); }
  return e;
}
/* Tenue annoncée par un participant (celle qu'il a choisie, ou celle de l'arme d'un bot de l'hôte) ; inconnue : Assaut.
   Vue en clair ou en sombre selon la relation au joueur de ce poste (skinRel) : en match à mort, tous en ennemis. */
function netSkin(P) { return skinId(typeof P.sk === 'string' ? P.sk : ''); }
function netRemoveRemote(e) {
  kcRelease(e);
  netDisposeModel(e.model); const i = entities.indexOf(e); if (i >= 0) entities.splice(i, 1);
  for (const o of entities) { if (o.target === e) o.target = null; if (o.dmgBy) o.dmgBy.delete(e); }
}
/* Les géométries d'un soldat (corps et armes fusionnés) lui sont propres : on les libère du GPU */
function netDisposeModel(M) {
  scene.remove(M.root);
  const free = (g) => g.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); // géométrie des corps : commune à l'équipe
  free(M.root);
  if (M.guns) for (const k in M.guns) if (M.guns[k].group !== M.gun) free(M.guns[k].group);
}
/* Changement d'arme d'un distant : chaque modèle d'arme n'est construit qu'une fois par soldat */
function netSetGun(e, key) {
  const M = e.model; M.guns = M.guns || {};
  if (M.gun) { M.guns[M.gunKey] = { group: M.gun, muzzle: M.muzzleLocal, kind: M.kind }; M.root.remove(M.gun); M.gun = null; }
  const c = M.guns[key];
  if (c) { M.root.add(c.group); M.gun = c.group; M.muzzleLocal = c.muzzle; M.gunKey = key; M.kind = c.kind; M.grips = gripsFor(key); }
  else setSoldierGun(M, key);
}
/* Arme annoncée par un participant : sa clé (modèle, accessoires, camouflage), à défaut son identifiant ; une valeur inconnue ou mal formée donne le M4A1 */
function netWeaponDef(P) {
  const k = typeof P.g === 'string' && /^[a-z0-9_]{2,16}(~[a-z.]{0,80}){0,2}$/.test(P.g) ? P.g : '';
  return (k && weaponDefByKey(k)) || (hasKey(WEAPONS, P.w) && weaponDef(P.w)) || WEAPONS.m4;
}
/* Un joueur ou un bot distant quitte la partie ; ses éliminations restent au score de son équipe (NET.goneK), sauf keep (un bot que je reprends) */
function netRemoveById(id, keep) {
  const e = NET.remotes.get(id); if (!e) return;
  if (!keep && NET.on) NET.goneK[e.team] += e.kills | 0;
  if (!e.remoteBot && !keep && MATCH.state !== 'menu') { hudMsg(`${_t('{0} a quitté la partie', e.name)}`, 'neutral', 2); sfxUi('notify'); }
  netRemoveRemote(e); NET.remotes.delete(id); NET.seen.delete(id); NET.seenT.delete(id); NET.ak.delete(id); netSentDrop(e); NET.held = NET.held.filter((h) => h.x !== e);
}
/* Applique l'état publié par un participant distant et traite ses nouveaux événements */
/* Joueur coupé (netHostDrop) : son soldat disparaît sans mort ni élimination, ses compteurs restent ; son premier état au retour le fait
   réapparaître (vivant, à sa place). Pas de cible figée sur laquelle on aurait des touches qui ne compteraient pas. */
function netRemoteAway(id) {
  const e = NET.remotes.get(id); if (!e) return;
  e.alive = false; e.pred = false; e.model.rag = null; e.model.root.visible = false; e.health = 100;
}
function netApply(id, P) {
  if (!NET.on || id === NET.me || !P || typeof P !== 'object' || netLocal(id)) return;
  const s = P.s;
  if (!Array.isArray(s) || s.length < 12) { netRemoveById(id); return; }
  let e = NET.remotes.get(id); if (!e) e = netMakeRemote(id, P);
  const team = P.t === 1 ? 1 : 0;
  const sk = netSkin(P);
  if (team !== e.team || sk !== e.skin) { e.team = team; e.skin = sk; soldierLook(e.model, sk, skinRel(e)); } // changement d'équipe ou de tenue : rien n'est reconstruit
  { const nd = netWeaponDef(P); if (nd.key !== e.weapon.key) { e.weapon = nd; e.arms = makeArms([nd], 1); netSetGun(e, nd.key); } }
  e.name = netClean(P.n);
  netPos(s, e.net.tgt); e.net.tv.set(clamp(numOr(s[5]), -60, 60), 0, clamp(numOr(s[6]), -60, 60)); e.net.at = MATCH.time;
  e.net.yaw = clamp(numOr(s[3]), -1e4, 1e4); e.net.pitch = clamp(numOr(s[4]), -1.5, 1.5);
  netTrack(e, P.ts, !!s[9]);
  e.crouch = !!s[7]; e.slide = s[7] === 2; e.sprinting = !!s[8]; e.arms.adsW = s[10] ? 1 : 0; // 2 : accroupi et en glissade
  const alive = !!s[9];
  e.health = clamp(numOr(s[11]), 0, 100);
  if (P.ak && typeof P.ak === 'object') NET.ak.set(id, P.ak); // événements appliqués par cet expéditeur, par expéditeur (netAckOf) : lu avant ses événements, qui le suivent dans le même état
  e.kills = P.k | 0; e.deaths = P.d | 0; e.assists = P.a | 0; e.score = P.sc | 0;
  if (P.dr) fpvNet(e, P.dr);
  if (P.mk) mechaNet(e, P.mk);
  if (alive && !e.alive) {
    if (e.pred && MATCH.time - e.predT < NET_PRED_HOLD) { /* mort prédite pas encore confirmée : cet état est parti avant la touche */ }
    else if (e.pred) { e.pred = false; e.alive = true; e.model.rag = null; e.lastForce = null; e.model.root.visible = true; netSentDrop(e); } // la victime a survécu : elle se relève
    else { e.alive = true; e.health = 100; e.model.rag = null; e.lastForce = null; e.pos.copy(e.net.tgt); e.model.root.visible = true; netSentDrop(e); e.killBy = null; spawnNote(e); } // (son apparition : l'endroit est évité ici aussi)
  }
  else if (!alive && e.alive) { e.alive = false; }
  // tirs : effets visuels et sonores seulement (les touches arrivent comme événements)
  const f = P.f | 0;
  if (f > e.net.shots && e.alive) {
    e.net.shots = f; e.lastShotT = MATCH.time;
    const muzzle = e.model.gun.localToWorld(e.model.muzzleLocal.clone());
    const cp = Math.cos(e.net.pitch), dir = new V3(-Math.sin(e.net.yaw) * cp, Math.sin(e.net.pitch), -Math.cos(e.net.yaw) * cp);
    muzzleWorldFx(muzzle, dir, e.weapon.silent, e.weapon.feel ? e.weapon.feel.flash : 1); if (!e.weapon.silent) flashLight(muzzle, 2.5, 7, 0.05); sfxGun(e.weapon.sound, muzzle, e);
    kcEvent('shot', { m: muzzle.clone(), d: dir.clone(), kind: e.weapon.sound, sid: e.kcI }); // pour la relecture des killcams
    if (!e.weapon.silent) {
      const hit = rayWorld(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z, 120), end = muzzle.clone().addScaledVector(dir, hit ? hit.t : 80);
      FX.tracers.add(muzzle, end); kcEvent('ray', { a: muzzle.clone(), b: end.clone(), tr: true, flesh: false, head: false, dir: dir.clone() });
    }
    e.recoil = 0.05;
    soundEvents.push({ pos: e.pos.clone(), team: e.team, t: MATCH.time, loud: !!e.weapon.loud, quiet: !!e.weapon.silent }); if (soundEvents.length > 60) soundEvents.shift();
  } else e.net.shots = f; // compteur remis à zéro à la réapparition d'un bot
  // événements numérotés (NET_EV_MAX au plus par état : un état gonflé de centaines de grenades ne fige pas la partie)
  const last = NET.seen.get(id) || 0; let mx = last;
  if (Array.isArray(P.ev)) for (const ev of P.ev.slice(-NET_EV_MAX)) {
    if (!ev || typeof ev.i !== 'number' || ev.i <= last) continue;
    mx = Math.max(mx, ev.i);
    netEventIn(e, ev);
  }
  if (mx > last) NET.seenT.set(id, performance.now());
  NET.seen.set(id, mx);
}
function netEventIn(e, ev) {
  if (!ev || typeof ev !== 'object') return;
  const dir = new V3(clamp(numOr(ev.x), -1e3, 1e3), 0, clamp(numOr(ev.z), -1e3, 1e3));
  if (ev.k === 'hit') {
    const tgt = netLocal(ev.to);
    if (!tgt || !tgt.alive) return;
    if (!tgt.isPlayer) tgt.lastForce = { dir: dir.lengthSq() > 1e-4 ? dir.clone().normalize() : new V3(0, 0, -1), mag: 5, lift: 2.2, part: ev.h ? 'head' : 'body' };
    const d = clamp(+ev.d || 0, 0, 250);
    if (d >= tgt.health && netTradeHold(tgt, e, ev, d, dir)) return; // touche mortelle tirée après la mienne, qu'il n'avait pas encore reçue : en attente
    NET.hitQ = ev.i; try { applyDamage(tgt, d, e, netWeaponName(ev.w, e), !!ev.h, dir); } finally { NET.hitQ = 0; }
  } else if (ev.k === 'kill') {
    const killer = netEntity(ev.by) || e, pred = e.pred, rag = e.model.rag, fall = ev.w === 'fall'; e.pred = false;
    { const h = typeof ev.q === 'number' ? NET.sent.find((m) => m.f === killer && m.v === e && m.i === ev.q) : null; e.killBy = killer; e.killS = h ? h.s : undefined; } // la touche qui l'a tué, et l'heure de son tir (netHeldCheck)
    // chute dans le vide (voidDeath chez la victime) : pas de corps, ni de croix chez l'adversaire crédité (il n'a pas tiré)
    if (fall) e.voidDead = true;
    // mort déjà prédite chez moi (netPredictKill) : la chute continue, la croix et le son ont déjà joué
    else if (!pred) e.lastForce = { dir: dir.lengthSq() > 1e-4 ? dir.clone().normalize() : new V3(0, 0, 1), mag: 6, lift: 2, part: ev.h ? 'head' : 'body' };
    if (killer === PL.ent && !pred && !fall && ev.w !== 'zone') hitFeedback(!!ev.h, true);
    killEnt(e, killer, netWeaponName(ev.w, killer), !!ev.h, dir);
    if (pred && rag) e.model.rag = rag;
  } else if (ev.k === 'nade') {
    if (!e.isPlayer) e.throwT = 0.7; // geste de lancer visible sur le soldat distant
    const w = e.net.nadeW || (e.net.nadeW = { t: -9, n: 0 }); // 4 grenades par seconde au plus (un état peut en porter plusieurs après un ralentissement)
    if (MATCH.time - w.t >= 1) { w.t = MATCH.time; w.n = 0; }
    if (++w.n > 4) return;
    const p = new V3(clamp(numOr(ev.px), MAP.x0 - 50, MAP.x1 + 50), clamp(numOr(ev.py), -50, 300), clamp(numOr(ev.pz), MAP.z0 - 50, MAP.z1 + 50)), v = new V3(clamp(numOr(ev.vx), -40, 40), clamp(numOr(ev.vy), -40, 40), clamp(numOr(ev.vz), -40, 40));
    if (ev.ty === 'knife') spawnThrowKnife(e, p, v); // couteau de lancer : son vol seulement, le lanceur compte la touche
    else spawnNade(e, p, v, clamp(numOr(ev.fu, 2), 0.1, 4), NADE_TYPES[ev.ty] ? ev.ty : 'frag');
  } else if (ev.k === 'air') {
    if (MATCH.time - e.net.airT < 15) return;
    e.net.airT = MATCH.time;
    airstrike(new V3(clamp(numOr(ev.x), MAP.x0, MAP.x1), 0, clamp(numOr(ev.z), MAP.z0, MAP.z1)), clamp(numOr(ev.y), -1e4, 1e4), e);
    const ally = e.team === PL.ent.team;
    hudMsg(ally ? `${_t('Frappe aérienne alliée ({0})', e.name)}` : _t('Frappe aérienne ennemie !'), ally ? 'ally' : 'enemy', 2.5);
  } else if (ev.k === 'heli') {
    // hélicoptère d'un joueur distant : on n'en affiche que le vol et les rafales, ses dégâts sont calculés chez lui
    const h = spawnHeli(e); if (h) heliMsg(h, 'spawn');
  } else if (ev.k === 'hf') {
    const h = KS.helis.find((x) => x.owner === e && x.state !== 'crash');
    if (h) {
      heliStartBurst(h, new V3(clamp(numOr(ev.x), MAP.x0 - 50, MAP.x1 + 50), clamp(numOr(ev.y), -50, 300), clamp(numOr(ev.z), MAP.z0 - 50, MAP.z1 + 50)), false);
      if (ev.to === NET.me && PL.ent.alive) { hudMsg(_t('Hélicoptère : vous êtes pris pour cible !'), 'enemy', 1.2); sfxKs('lock'); }
    }
  } else if (ev.k === 'hh') {
    const own = netLocal(ev.to); if (own) heliHitFrom(own, ev.d, e);
  } else if (ev.k === 'hx') {
    const h = KS.helis.find((x) => x.owner === e && x.state !== 'crash');
    if (h) { h.state = 'crash'; h.burst = null; h.vy = 0; h.spin = 0; heliMsg(h, 'down'); }
  } else if (ev.k === 'prop') {
    propNetHit(ev);
  } else if (ev.k === 'hang') {
    hangNetHit(ev);
  } else if (ev.k === 'uav') {
    uavStart(e.team); spawnDrone(e.team);
    const ally = e.team === PL.ent.team; sfxAnnounce(ksFriendly(e) ? 'uav_on' : 'uav_enemy');
    hudMsg(ally ? `${_t('UAV allié ({0})', e.name)}` : _t('UAV ennemi en ligne'), ally ? 'ally' : 'enemy', 2.5);
  } else if (ev.k === 'sat') {
    satFire(e);
  } else if (ev.k === 'iem') {
    iemFire(e);
  } else if (ev.k === 'mk') {
    if (!MECHAS.some((x) => x.owner === e)) mechaCall(e, new V3(numOr(ev.x), numOr(ev.y), numOr(ev.z)), numOr(ev.r));
  } else if (ev.k === 'dx') {
    fpvNetEnd(e, ev);
  } else if (ev.k === 'dh') {
    const own = netLocal(ev.to); if (own) fpvNetHit(own, ev.d);
  } else if (ev.k === 'mh') {
    const own = netLocal(ev.to); if (own) mechaNetHit(own, ev.d); // touche sur le mecha d'un participant local (08f-mecha.js)
  } else if (ev.k === 'mx') {
    mechaNetDead(e); // mecha détruit chez son propriétaire
  }
}
/* Trace d'un participant distant pour la killcam (kcNetView, 09b-killcam.js) : chaque état reçu, daté par l'horloge de son auteur (P.ts, en ms ; un
   relais ou une connexion irrégulière en livrent deux d'un coup puis aucun) ramenée à la nôtre. Le décalage des deux horloges est le plus petit écart
   vu (le trajet le plus court) ; il remonte doucement, ce qui suit une horloge qui dérive, et repart de zéro après un saut d'une seconde (onglet
   ralenti). Une version sans P.ts : l'heure d'arrivée. Quatorze secondes gardées : la relecture en lit cinq, pendant qu'en ligne la partie continue. */
function netTrack(e, ts, alive) {
  const N = e.net, H = N.hist || (N.hist = []), now = MATCH.time;
  let t = now;
  if (Number.isFinite(ts)) {
    const d = now - ts / 1000;
    N.off = N.off === undefined || d < N.off || d - N.off > 1 ? d : N.off + (d - N.off) * 0.005;
    t = ts / 1000 + N.off;
  }
  if (H.length && t <= H[H.length - 1].t + 1e-3) return; // le même état relayé deux fois, ou arrivé après un plus récent
  H.push({ t, x: N.tgt.x, y: N.tgt.y, z: N.tgt.z, vx: N.tv.x, vz: N.tv.z, yaw: N.yaw, pitch: N.pitch, alive });
  while (H.length > 2 && (H[0].t < now - 14 || H.length > 400)) H.shift();
}
/* Un participant distant se déplace entre deux mises à jour : lissage et extrapolation courte */
function updateRemote(e, dt) {
  const N = e.net, age = clamp(MATCH.time - N.at, 0, 0.25);
  if (e.alive) {
    const tx = N.tgt.x + N.tv.x * age, tz = N.tgt.z + N.tv.z * age;
    const k = 1 - Math.exp(-14 * dt);
    const ox = e.pos.x, oz = e.pos.z;
    e.pos.x += (tx - e.pos.x) * k; e.pos.z += (tz - e.pos.z) * k; e.pos.y += (N.tgt.y - e.pos.y) * k;
    if (e.pos.distanceTo(N.tgt) > 6) e.pos.copy(N.tgt);
    e.vel.set((e.pos.x - ox) / Math.max(dt, 1e-3), 0, (e.pos.z - oz) / Math.max(dt, 1e-3));
    e.yaw += angDiff(e.yaw, N.yaw) * k; e.lookYaw = e.yaw; e.pitch += (N.pitch - e.pitch) * k;
    e.crouchAmt = damp(e.crouchAmt, e.crouch ? 1 : 0, 10, dt);
    e.slideAmt = damp(e.slideAmt || 0, e.slide ? 1 : 0, e.slide ? 12 : 7, dt); // comme ctlMove
    e.visible = true; e.target = null;
    // pas d'un joueur distant, comme ceux des bots (07b-tactics.js)
    const v = hyp(e.vel.x, e.vel.z), run = v > 6;
    e.stepAcc = (e.stepAcc || 0) + v * dt;
    if (v > 0.8 && e.stepAcc > (run ? 2.8 : 2.2)) { e.stepAcc = 0; sfxStep(e.pos, e.crouch ? 0.12 : run ? 0.34 : 0.26, surfaceAt(e.pos)); }
  }
  animSoldier(e, dt);
  if (!e.alive) e.model.root.visible = !e.voidDead && !!e.model.rag; // tombé dans le vide, ou déjà mort à notre arrivée (animSoldier) : pas de corps
}

/* ---------- Ce que je publie ---------- */
/* Latence des touches en ligne (retour du propriétaire : « en multi, un invité voit l'ennemi mourir une fraction de seconde après sa touche ») :
   - une touche ou une mort part à l'image suivante (NET.flush), sans attendre la publication suivante (66 ms) ; avec
     le relais immédiat de l'hôte, le trajet d'une touche d'invité à invité perd jusqu'à deux attentes de publication ;
   - chez le tireur, une touche mortelle d'après la dernière vie publiée par la victime fait tomber celle-ci aussitôt (netPredictKill : croix et son
     d'élimination, chute) ; l'annonce de sa mort arrive un aller-retour plus tard et ne rejoue rien ; sans elle en NET_PRED_HOLD s, la victime se relève. */
const NET_PRED_HOLD = 1.0;
/* Vie d'une victime distante vue par le tireur : la dernière vie qu'elle a publiée, moins mes touches qu'elle n'avait pas encore reçues.
   Sans cela, la balle qui tue partait pendant que le tireur croyait encore sa cible à pleine vie (sa vie publiée revient un aller-retour
   après chaque touche) : la mort n'était prédite qu'au premier coup, jamais au troisième ou au quatrième d'une rafale, et le joueur voyait
   la croix tout de suite puis l'élimination un aller-retour plus tard (deux passages par l'hôte entre deux invités). Chaque joueur publie
   avec son état le numéro du dernier événement reçu de chaque expéditeur récent (ak, netPresence) ; la vie publiée dans le même état tient
   compte de tous ces événements. Pour un bot, c'est l'hôte qui publie (identifiant avant ~b). Expéditeur d'une version sans accusé : vie
   publiée seule, comme avant. Une touche jamais accusée est oubliée après 2 s. */
function netPredHealth(e) {
  const ak = netAckOf(e, NET.me);
  if (ak === undefined) return e.health;
  let h = e.health;
  for (const m of NET.sent) if (m.f === PL.ent && m.v === e && m.i > ak && MATCH.time - m.t <= 2) h -= m.d;
  return h;
}
/* Numéro du dernier événement de l'expéditeur sid appliqué par celui qui publie l'état de e (lui-même, ou l'hôte pour un bot : identifiant
   avant ~b) ; undefined : rien d'appliqué récemment, ou version sans accusé */
function netAckOf(e, sid) {
  const a = NET.ak.get(String(netIdOf(e)).split('~b')[0]), v = a && a[sid];
  return typeof v === 'number' ? v : undefined;
}
/* Touches envoyées par un participant local (moi, ou un bot de l'hôte) : { f: tireur, v: victime, i: numéro, d: dégâts, s: heure du tir
   (netStamp), t: MATCH.time }, gardées 3 s. Servent à la vie prédite et à l'arbitrage des morts croisées. */
function netSentDrop(v) { NET.sent = NET.sent.filter((m) => m.v !== v); }
/* Heure d'un tir sur l'horloge de la partie, la même pour tous (temps restant, recalé par l'hôte à chaque envoi), en ms croissantes */
function netStamp() { return Math.round(-MATCH.timeLeft * 1000); }
/* Morts croisées (retour du propriétaire : « on peut se tuer en même temps en multi ») : A et B tirent chacun une balle mortelle avant d'avoir
   reçu celle de l'autre ; chaque tireur décidant de ses touches, les deux mouraient. Désormais, la victime d'une touche mortelle de X (tgt)
   regarde si elle avait elle-même touché X avant ce tir (heure du tir, netStamp) sans que X l'ait encore appliquée (accusé de X, lu dans
   l'état même qui porte la touche). Si oui, la touche attend (NET.held) l'état suivant de X : X annonce sa mort par une touche de tgt tirée
   avant la sienne, et la sienne ne compte pas (il était déjà mort) ; X a appliqué ces touches et vit encore, et la sienne s'applique ;
   0,8 s sans réponse, elle s'applique. Une touche en attente n'est pas accusée (ak plafonné, netPresence) : X la voit encore en route.
   Les deux côtés appliquent la même règle aux mêmes heures : un seul des deux meurt, celui qui a tiré le second. Une attente ne dépend
   que de tirs strictement plus anciens : pas d'attente croisée sans fin. Tir d'une version sans heure : appliqué, comme avant. */
const NET_HOLD = 0.8;
function netTradeHold(tgt, x, ev, d, dir) {
  const s = ev.s;
  if (typeof s !== 'number' || !Number.isFinite(s)) return false;
  if (!netTradeOpen(tgt, x, s)) return false;
  NET.held.push({ tgt, x, ev, d, dir: dir.clone(), s, until: MATCH.time + NET_HOLD });
  return true;
}
/* tgt a-t-il touché x avant l'heure s sans que x l'ait encore appliqué ? */
function netTradeOpen(tgt, x, s) {
  const ak = netAckOf(x, netIdOf(tgt));
  return NET.sent.some((m) => m.f === tgt && m.v === x && m.s < s && !(ak >= m.i));
}
function netHeldCheck() {
  if (!NET.held.length) return;
  NET.held = NET.held.filter((h) => {
    if (!h.tgt.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return false; // mort entre-temps, ou partie finie
    if (h.x.killBy === h.tgt && typeof h.x.killS === 'number' && h.x.killS < h.s) return false; // X tué d'abord par ma touche : son tir ne compte pas
    if (MATCH.time < h.until && netTradeOpen(h.tgt, h.x, h.s)) return true;
    NET.hitQ = h.ev.i; try { applyDamage(h.tgt, h.d, h.x, netWeaponName(h.ev.w, h.x), !!h.ev.h, h.dir); } finally { NET.hitQ = 0; }
    return false;
  });
}
function netPredictKill(e, head, dir) {
  e.pred = true; e.predT = MATCH.time; e.alive = false;
  const d = dir && dir.lengthSq() > 1e-4 ? new V3(dir.x, 0, dir.z) : new V3(0, 0, 1);
  e.lastForce = { dir: d.lengthSq() > 1e-6 ? d.normalize() : new V3(0, 0, 1), mag: 6, lift: 2, part: head ? 'head' : 'body' };
}
const NET_EV_MAX = 24; // événements gardés et renvoyés par état publié (netEvent), et lus au plus dans un état reçu (netApply)
function netEvent(ev, ent) {
  ent = ent || PL.ent;
  const Q = ent.netQ || (ent.netQ = { seq: 0, list: [] });
  ev.i = ++Q.seq; Q.list.push({ ev, at: performance.now(), sent: 0 }); if (Q.list.length > NET_EV_MAX) Q.list.shift();
  if (ev.k === 'hit' || ev.k === 'kill') NET.flush = true;
}
/* Chaque événement part dans plusieurs envois successifs (au moins 3, et pendant 0,7 s), même à bas débit d'images */
function netEvList(ent, now) {
  const Q = ent.netQ; if (!Q) return [];
  while (Q.list.length && Q.list[0].sent >= 3 && now - Q.list[0].at > 700) Q.list.shift();
  for (const x of Q.list) x.sent++;
  return Q.list.map((x) => x.ev);
}
function netSendHit(victim, dmg, weapon, head, dir, attacker) {
  const ev = { k: 'hit', to: victim.peer, d: Math.round(dmg * 10) / 10, h: head ? 1 : 0, w: netWeaponKey(weapon), x: +(dir ? dir.x : 0).toFixed(2), z: +(dir ? dir.z : 0).toFixed(2), s: netStamp() };
  netEvent(ev, attacker);
  while (NET.sent.length && (MATCH.time - NET.sent[0].t > 3 || NET.sent.length > 200)) NET.sent.shift();
  NET.sent.push({ f: attacker, v: victim, i: ev.i, d: ev.d, s: ev.s, t: MATCH.time }); // touche en route (netPredHealth, netTradeOpen)
}
function netAirstrike(target, yaw, owner) {
  if (owner === PL.ent) PL.actT = MATCH.time;
  // arrondis du message : le motif des bombes (airPattern) est le même chez le propriétaire et chez les autres joueurs
  target = new V3(Math.round(target.x * 10) / 10, target.y, Math.round(target.z * 10) / 10); yaw = Math.round(yaw * 1000) / 1000;
  airstrike(target, yaw, owner);
  if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'air', x: +target.x.toFixed(1), z: +target.z.toFixed(1), y: +yaw.toFixed(3) }, owner);
}
function netHeliCall(owner) { if (owner === PL.ent) PL.actT = MATCH.time; if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'heli' }, owner); }
function netHeliFire(h, aim, target) { if (MATCH.online && netIsLocal(h.owner)) netEvent({ k: 'hf', x: +aim.x.toFixed(1), y: +aim.y.toFixed(1), z: +aim.z.toFixed(1), to: netIdOf(target) }, h.owner); }
function netHeliHit(h, dmg, shooter) { if (MATCH.online && netIsLocal(shooter)) netEvent({ k: 'hh', to: netIdOf(h.owner), d: Math.round(dmg) }, shooter); }
function netHeliDown(h) { if (MATCH.online && netIsLocal(h.owner)) netEvent({ k: 'hx' }, h.owner); }
function netUav(owner) { if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'uav' }, owner); }
function netSat(owner) { if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'sat' }, owner); }
function netIem(owner) { if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'iem' }, owner); }
function netPresence(e, now) {
  const r = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n, me = e === PL.ent;
  const s = [r(e.pos.x), r(e.pos.y), r(e.pos.z), r(me ? (PILOT.d ? PILOT.yaw : PL.yaw) : e.yaw, 3), r(me ? (PILOT.d ? PILOT.pitch : PL.pitch) : e.pitch, 3), r(e.vel.x, 1), r(e.vel.z, 1),
    e.crouch ? ((e.slideT || 0) > 0 ? 2 : 1) : 0, e.sprinting ? 1 : 0, e.alive ? 1 : 0, (me ? VM.ads : e.arms.adsW) > 0.5 ? 1 : 0, Math.max(0, Math.round(e.health))];
  const p = { ts: Math.round(now), n: me ? NET.nick : e.name, t: e.team, w: me ? curW().def.id : armsW(e).def.id, g: me ? curW().def.key : armsW(e).def.key, s, f: me ? NET.shots : e.arms.shots, k: e.kills, d: e.deaths, a: e.assists, sc: e.score, sk: skinOf(e), ev: netEvList(e, now) };
  const dr = fpvPub(e); if (dr) p.dr = dr; // drone kamikaze en vol (08e-fpv.js)
  const mk = mechaPub(e); if (mk) p.mk = mk; // mecha posé (08f-mecha.js)
  if (!me) p.b = 1;
  else { // accusé (netPredHealth, netTradeOpen) : dernier événement appliqué de chaque expéditeur des 3 dernières secondes, avant une touche en attente
    let ak = null;
    for (const [id, t] of NET.seenT) { if (now - t > 3000) { NET.seenT.delete(id); continue; } (ak || (ak = {}))[id] = NET.seen.get(id) || 0; }
    for (const h of NET.held) { const id = netIdOf(h.x); if (ak && id in ak) ak[id] = Math.min(ak[id], h.ev.i - 1); }
    if (ak) p.ak = ak;
  }
  return p;
}
function netUpdate(dt) {
  if (!NET.on) return;
  for (const e of NET.remotes.values()) updateRemote(e, dt);
  netHeldCheck(); // morts croisées en attente
  const now = performance.now();
  if (NET.flush || now - NET.lastPub > 66) {
    NET.lastPub = now; NET.flush = false;
    if (NET.role === 'host') {
      const l = [[NET.me, netPresence(PL.ent, now)]];
      for (const b of entities) if (b.netBot) l.push([b.netId, netPresence(b, now)]);
      netBroadcast({ t: 'ps', l, tl: Math.round(MATCH.timeLeft * 100) / 100, cd: cdNetOut(), dm: MATCH.mode === 'dom' ? domNetState() : undefined }, true); // cd : décompte du départ (09y-decompte.js)
    } else netSend({ t: 'p', p: netPresence(PL.ent, now) });
  }
  const live = MATCH.state === 'playing' || MATCH.state === 'paused';
  if (MATCH.mode === 'ffa') { // chacun pour soi : le score est celui de modeUpdate (moi et le meilleur adversaire), le premier à la limite gagne
    if (NET.role === 'host' && live && ffaList().some((e) => e.kills >= MATCH.limit)) matchFinishSoon();
    return;
  }
  if (MATCH.mode === 'dom') return; // domination : points tenus par l'hôte (domUpdate, domNetApply), qui annonce la fin
  // score d'équipe : somme des éliminations déclarées par chacun
  const sc = [0, 0];
  for (const e of entities) if (e === PL.ent || e.isRemote || e.netBot) sc[e.team] += e.kills;
  sc[0] += NET.goneK[0]; sc[1] += NET.goneK[1]; // ceux qui sont partis
  if (!MATCH.fin) MATCH.score = sc; // le score annoncé ne bouge plus pendant l'annonce du résultat
  if (NET.role === 'host' && live && (sc[0] >= MATCH.limit || sc[1] >= MATCH.limit)) matchFinishSoon();
}
/* Battement : maintient les canaux ouverts et détecte les participants disparus */
function netHeartbeat() {
  if (NET.role === 'off') { NET.hbT = 0; return; }
  const now = performance.now();
  /* Un onglet bloqué (la carte se construit) ou ralenti par le navigateur (arrière-plan) saute plusieurs battements : les messages reçus
     entre-temps attendent derrière le minuteur et l'autre côté semblerait muet depuis des dizaines de secondes. Après un trou de plus de
     4 s, personne n'est jugé muet : les délais repartent de maintenant (un hôte vraiment disparu le restera 30 s de plus, pas davantage). */
  if (NET.hbT && now - NET.hbT > 4000) { NET.hostSeen = now; for (const pl of NET.players.values()) pl.seen = now; }
  NET.hbT = now;
  if (!NET.joined && now - NET.t0 > 25000) {
    if (netViaServer()) netFail(NET.me ? _t('L\u0027hôte ne répond pas. Réessayez, ou demandez-lui de créer un nouveau salon.') : _t('Le serveur de jeu est injoignable.'));
    else if (!NET.me) { NETD.sig = 'fail'; netFail(_t('Serveur de mise en relation injoignable. Réessayez dans un instant.')); }
    else netFail(_t('Impossible de joindre l\u0027hôte. La connexion directe semble bloquée par le réseau.'));
    return;
  }
  if (NET.role === 'client') {
    if (!NET.joined) return;
    if (NET.resume) return; // reconnexion en cours (netResume) : elle a son propre délai
    if (now - NET.hostSeen > 30000) { netLost(_t('L\u0027hôte ne répond plus.')); return; }
    if (now - NET.lastSend > 2000) netSend({ t: 'ping' });
    netLoadReport();
  } else if (NET.joined) {
    for (const pl of [...NET.players.values()]) {
      if (pl.conn && now - pl.seen > 30000) { const c = pl.conn; try { c.close(); } catch (e) { /* déjà fermé */ } netHostDrop(pl.id, c, true); }
      else if (pl.away && (now - pl.away > NET_AWAY || !NET.on)) netHostDrop(pl.id, null, true); // pas revenu à temps, ou partie finie
    }
    // tout le monde, y compris ceux restés au menu pendant une partie ; la phase rattrape un état du salon perdu
    if (now - (NET.lastPing || 0) > 2000) { NET.lastPing = now; netBroadcast({ t: 'ping', ph: NET.phase }); }
    netLoadReport(); netCheckGo();
  }
}

/* ---------- Interface du salon : le menu Multijoueur (09ea-liste.js), à la manière des anciens Call of Duty ----------
   Accueil : à gauche Jouer maintenant, Créer un salon, Rejoindre un salon ; à droite les parties publiques. Salon : à gauche Carte, Paramètres
   de partie, Modifier la classe, Inviter des amis, Discussion, l'aperçu de la carte dessous ; à droite les joueurs du salon par équipe, avec
   les places que prendront les bots ; un joueur ouvre ses actions (changer d'équipe, masquer, exclure). */
/* Réglage changé par l'hôte dans le salon : il vaut pour tout le salon, et l'hôte le retrouve en Solo (mémoire commune) */
function netSetupSet(k, v) {
  if (NET.role !== 'host' || NET.phase !== 'lobby') return;
  const c = Object.assign({}, NET.cfg);
  if (k === 'bots') { c.bots = v === 'off' ? 0 : 1; if (v !== 'off') c.diff = v; }
  else if (k === 'mode') { c.mode = v; c.limit = Settings[MODES[v].key]; }
  else c[k] = v;
  if (k === 'pub') { NETP.vis = v ? 1 : 0; try { localStorage.setItem('cod_salon_pub', String(NETP.vis)); } catch (e) { /* stockage indisponible */ } } // le prochain salon créé le sera de même
  NET.cfg = netCfg(c);
  Settings.mode = NET.cfg.mode; Settings.minutes = NET.cfg.time; Settings[MODES[NET.cfg.mode].key] = NET.cfg.limit; if (NET.cfg.bots) Settings.difficulty = NET.cfg.diff;
  saveSettings(); sfxUi('click'); netLobbyChanged();
}
/* La discussion du salon est-elle ouverte ? (les messages arrivent alors lus) */
function netChatOpen() { const L = LM.scr.multi, f = L && L.stack[L.stack.length - 1]; return !!f && f.id === 'chat' && UI.screen === 'multi'; }
/* Les réglages du salon, pour les rangées des paramètres de la partie (matchRows) */
function netMatchCfg() { return { map: NET.cfg.map, mode: NET.cfg.mode, diff: NET.cfg.diff, bots: NET.cfg.bots, limit: NET.cfg.limit, time: NET.cfg.time, pub: NET.cfg.pub, pubOk: netViaServer() && !SRV.list, online: true, edit: NET.role === 'host' && NET.phase === 'lobby', set: netSetupSet }; }
/* Les joueurs d'une équipe (ou tous, chacun pour soi) : niveau, nom, étiquettes ; un joueur sur lequel on peut agir ouvre ses actions.
   Puis les places libres que les bots prendront (6 par équipe, 8 en tout chacun pour soi). */
function netPlayerRows(t, ffa) {
  const host = NET.role === 'host', lobby = NET.phase === 'lobby', rows = [];
  for (const p of NET.players.values()) {
    if (!ffa && p.t !== t) continue;
    const other = p.id !== NET.me, tags = []; // le joueur lui-même : son niveau en jaune et le trait jaune suffisent
    if (p.h || (host && !other)) tags.push(_t('hôte')); if (NET.muted.has(p.id)) tags.push(_t('masqué'));
    if (NET.phase === 'playing' && p.ig) tags.push(_t('en partie'));
    else if (p.ig) tags.push((p.ld | 0) >= 100 ? _t('carte prête') : (p.ld | 0) > 0 ? (p.ld | 0) + PCT : _t('chargement'));
    if (p.r && !netViaServer()) tags.push(_t('via le relais'));
    const acts = other || (!ffa && lobby); // masquer, exclure ; soi-même : changer d'équipe
    rows.push({ k: 'player', key: p.id, label: p.n, lv: p.lv | 0, tags, me: !other, page: acts ? 'player' : null, params: p.id });
  }
  const free = (ffa ? NET_MAX : NET_TEAM) - rows.length, diff = (DIFF[NET.cfg.diff] || DIFF[1]).name;
  if (NET.cfg.bots) for (let i = 0; i < free; i++) rows.push({ k: 'player', key: 'bot' + t + '-' + i, label: diff, bot: true });
  if (!rows.length) rows.push({ k: 'note', text: _t('Personne') });
  return rows;
}
/* Scène du salon : les joueurs par équipe, la sienne d'abord */
function netStage() {
  const ffa = NET.cfg.mode === 'ffa', me = NET.players.get(NET.me), mine = me ? me.t : 0;
  const head = `<b>${esc(_t('Joueurs'))}</b><span>${NET.players.size}/${NET_MAX}</span>`;
  const foot = $('netDiagBtn'), note = NET.status && NET.status !== netHello() ? $('netStatus') : null; // l'état du salon (lien copié, connexion...) au-dessus des joueurs ; le rapport de connexion dessous
  if (ffa) return { head, note, foot, cols: [{ head: esc(_t('Chacun pour soi')), rows: netPlayerRows(0, true) }] };
  return { head, note, foot, cols: [mine, 1 - mine].map((t) => ({ cls: t === mine ? 'ally' : 'enemy', head: esc(TEAM_NAMES[t]), rows: netPlayerRows(t, false) })) };
}
/* Scène de l'accueil : les parties publiques (serveur de jeu), une rangée par partie ; sans serveur de jeu, comment jouer entre amis */
function netPubStage() {
  if (!netViaServer()) return { head: `<b>${esc(_t('Entre amis'))}</b>`, cols: [{ rows: [{ k: 'note', text: _t('Créez un salon et envoyez le lien à vos amis, ou entrez le code d\u0027un salon.') }] }] };
  const rows = [];
  if (!NETP.list.length) rows.push({ k: 'note', text: NETP.err ? _t('Liste des parties publiques indisponible pour le moment.') : NETP.at ? _t('Aucune partie publique pour le moment. Lancez-en une avec "Jouer maintenant".') : _t('Chargement...') });
  for (const s of NETP.list) {
    const m = mapById(s.m), sub = [MODES[s.o] ? MODES[s.o].btn : '', s.p === 'lobby' ? _t('Salon') : _t('En partie'), _t('Hôte : {0}', netClean(s.n))].filter(Boolean).join(' · ');
    rows.push({ k: 'pick', key: s.c, label: m.name, sub, value: s.j + '/' + s.x, art: (m.ok && MAP_ART[m.id]) || '', disabled: s.j >= s.x || NET.role !== 'off', pick: () => { sfxUi('click'); netJoinLobby(s.c); } });
  }
  const online = NETP.joueurs < 0 ? '' : `<span>${esc(_tn(NETP.joueurs, '{0} joueur en ligne en ce moment', '{0} joueurs en ligne en ce moment'))}</span>`;
  return { head: `<b>${esc(_t('Parties publiques'))}</b>${online}`, cols: [{ rows }] };
}
function netTeamSwap(id) {
  if (id === NET.me) {
    if (NET.role === 'client') netSend({ t: 'team' });
    else if (NET.role === 'host') { const me = NET.players.get(NET.me); if (me && !me.ig) { me.t = 1 - me.t; netLobbyChanged(); } }
  } else { const q = NET.players.get(id); if (q && !q.ig && NET.role === 'host') { q.t = 1 - q.t; netLobbyChanged(); } }
}
const NET_PAGES = {
  home: () => {
    const rows = [], via = netViaServer(), can = netCan(), title = _t('Multijoueur'), sub = _t('Parties en ligne, publiques ou entre amis, jusqu\u0027à 8 joueurs');
    if (NET.status && NET.status !== netHello()) rows.push({ k: 'node', node: $('netStatus') }); // un message (connexion, salon introuvable...), pas l'invite d'accueil
    if (!acctOnlineOk()) { // le multijoueur demande un compte
      rows.push({ k: 'note', text: _t('Le multijoueur demande un compte. Votre nom et votre progression vous suivent d\u0027une partie à l\u0027autre. Le mode Solo reste ouvert à tous.') });
      rows.push({ k: 'btn', key: 'login', label: _t('Se connecter ou créer un compte'), run: () => { ACCT.note = _t('Connectez-vous pour jouer en ligne.'); uiGo('profile'); } });
      return { title, sub, rows };
    }
    if (SRV.list) { // salons du serveur : ceux des joueurs, dans la liste ; un salon créé est public ou privé (les salons permanents ne sont plus proposés)
      rows.push({ k: 'link', key: 'create', label: _t('Créer un salon'), sub: _t('Public ou privé, vous réglez la partie'), page: 'create', disabled: !can });
    } else {
      if (via) rows.push({ k: 'btn', key: 'quick', label: _t('Jouer maintenant'), sub: _t('Rejoindre ou lancer une partie publique'), run: () => netQuick(), disabled: !can });
      rows.push({ k: 'btn', key: 'create', label: _t('Créer un salon'), sub: _t('Vous réglez la partie et invitez vos amis'), run: () => netHost({ pub: NETP.vis }), disabled: !can });
    }
    rows.push({ k: 'link', key: 'join', label: _t('Rejoindre un salon'), sub: SRV.list ? _t('Avec son code ou son lien d\u0027invitation') : _t('Avec le code ou le lien de l\u0027hôte'), page: 'join' });
    if (!ACCT.user) rows.push({ k: 'text', key: 'name', label: _t('Votre pseudo'), input: $('netName') }); // connecté : le nom d'affichage du compte sert de pseudo
    rows.push({ k: 'node', node: $('netDiag') });
    return { title, sub, rows, stage: SRV.list ? srvListStage : netPubStage };
  },
  join: (o) => {
    const rows = [
      { k: 'note', text: o && o.prive ? _t('Ce salon est privé. Entrez le code que vous a donné son chef.') : _t('Entrez le code de 5 caractères donné par l\u0027hôte, ou ouvrez son lien d\u0027invitation.') },
      { k: 'text', key: 'code', label: _t('Code du salon'), input: $('netCodeIn'), bare: true }, // le champ seul : son texte d'attente dit déjà « Code »
      { k: 'btn', key: 'go', label: _t('Rejoindre'), primary: true, run: () => netJoinCode($('netCodeIn').value), disabled: !netCan() },
    ];
    if (netrUrl() && !netViaServer()) rows.push({ k: 'check', key: 'relay', label: _t('Passer directement par le relais'), sub: _t('(réseau d\u0027entreprise : aucune connexion directe entre postes, aucun trafic UDP)'), get: () => netRelayOnly(), set: (v) => { try { if (v) localStorage.setItem('cod_relay_only', '1'); else localStorage.removeItem('cod_relay_only'); } catch (e) { /* stockage indisponible */ } } });
    return { head: _t('Rejoindre un salon'), rows };
  },
  lobby: () => {
    const setup = NET.role === 'host' && NET.phase === 'lobby', m = mapById(NET.cfg.map), MD = MODES[NET.cfg.mode] || MODES.tdm, rows = [];
    rows.push( // la carte et les paramètres sont dans l'encart, sous le menu ; l'état du salon, au-dessus des joueurs
      { k: 'link', key: 'map', label: _t('Carte'), page: 'map', disabled: !setup },
      { k: 'link', key: 'setup', label: _t('Paramètres de partie'), page: 'setup' }, // l'invité y voit les règles, sans les changer
      { k: 'link', key: 'class', label: _t('Modifier la classe'), open: () => uiGo('classes') },
      { k: 'link', key: 'invite', label: _t('Inviter des amis'), page: 'invite' }, // le code en grand, à copier ou partager
      { k: 'link', key: 'chat', label: _t('Discussion'), value: CHAT.unread ? String(CHAT.unread) : '', page: 'chat' }); // (pas de rangée pour quitter le salon : c'est Retour, netLeaveAsk)
    return { title: _t('Salon {0}', NET.code), sub: MD.name, rows, stage: netStage, preview: mapPreview(m, netMatchCfg()) };
  },
  map: () => ({
    head: _t('Carte'), grid: true,
    rows: mapCards(NET.cfg.map, NET.role === 'host' && NET.phase === 'lobby' ? (id) => {
      NET.cfg = netCfg(Object.assign({}, NET.cfg, { map: id })); Settings.map = NET.cfg.map; saveSettings();
      for (const q of NET.players.values()) q.ld = 0; // chacun annonce de nouveau où il en est pour cette carte
      sfxUi('click'); lmPop(LM.scr.multi); netLobbyChanged();
    } : null),
  }),
  setup: () => ({ head: _t('Paramètres de partie'), rows: matchRows(netMatchCfg()) }),
  player: (id) => {
    const p = NET.players.get(id), host = NET.role === 'host', ffa = NET.cfg.mode === 'ffa', rows = [];
    if (!p) return { head: '', rows };
    const other = id !== NET.me, lobbyOk = NET.phase === 'lobby';
    if (!ffa && lobbyOk && (!other || host)) rows.push({ k: 'btn', key: 'swap', label: _t('Changer d\u0027équipe'), sub: _t('Déplacer ce joueur dans l\u0027autre équipe'), run: () => { netTeamSwap(id); lmPop(LM.scr.multi); }, disabled: !NET.joined || !!p.ig || NET.on });
    if (other) { // masquer ses messages (chez soi seulement) ; l'hôte peut l'exclure, en deux temps
      const muted = NET.muted.has(id);
      rows.push({ k: 'btn', key: 'mute', label: muted ? _t('Afficher') : _t('Masquer'), sub: muted ? _t('Afficher de nouveau les messages de ce joueur') : _t('Ne plus voir les messages de ce joueur'), run: () => { if (muted) NET.muted.delete(id); else NET.muted.add(id); sfxUi('click'); chatRender(); netRender(); } });
      if (host) {
        const ask = NET.kickAsk === id;
        rows.push({ k: 'btn', key: 'kick', danger: true, label: ask ? _t('Confirmer l\u0027exclusion') : _t('Exclure'), sub: _t('Retirer ce joueur du salon (il ne peut pas revenir)'), run: () => { if (NET.kickAsk === id) { netKick(id); lmPop(LM.scr.multi); } else { NET.kickAsk = id; setTimeout(() => { if (NET.kickAsk === id) { NET.kickAsk = ''; netRender(); } }, 4000); } sfxUi('click'); netRender(); } });
      }
    }
    return { head: p.n, rows };
  },
  diag: () => { netdShow(true); return { head: _t('Rapport de connexion'), rows: [{ k: 'node', node: $('netDiag') }] }; },
  // inviter : le code en grand (à dicter ou recopier), le lien ; les copier, ou les partager (téléphone) ; le bouton touché dit que c'est fait
  invite: () => {
    const done = (w, t) => (NET.copied === w ? t : null), code = Object.assign(document.createElement('p'), { className: 'lcode', textContent: netCodeNow() });
    const rows = [
      { k: 'note', text: _t('Vos amis tapent ce code dans Rejoindre un salon, ou ouvrent le lien.') },
      { k: 'node', node: code }, { k: 'node', node: $('netLink') },
      { k: 'btn', key: 'code', primary: true, label: done('code', _t('Code copié')) || done('code!', _t('Copie impossible')) || _t('Copier le code'), run: () => netCopy('code') },
      { k: 'btn', key: 'link', label: done('link', _t('Lien copié')) || done('link!', _t('Copiez-le à la main')) || _t('Copier le lien'), run: () => netCopy('link') },
    ];
    if (navigator.share) rows.push({ k: 'btn', key: 'share', label: _t('Partager'), run: () => navigator.share({ title: 'Riposte: Frontline', text: _t('Rejoignez mon salon {0}', netCodeNow()), url: netLink() }).catch(() => {}) });
    return { head: _t('Inviter des amis'), rows };
  },
  chat: () => { CHAT.unread = 0; return { head: _t('Discussion'), cls: 'chat', rows: [{ k: 'node', node: $('netChatLog') }, { k: 'text', key: 'msg', label: _t('Message'), input: $('netChatIn') }] }; }, // ouverte : tout est lu
};
/* Copie le code ou le lien du salon (w : 'code' ou 'link') ; NET.copied fait dire au bouton que c'est fait (ou impossible : le lien est alors
   sélectionné pour une copie à la main), pendant 2,5 s */
function netCopy(w) {
  const txt = w === 'code' ? netCodeNow() : netLink(), say = (k) => { NET.copied = k; clearTimeout(NET.copiedT); NET.copiedT = setTimeout(() => { NET.copied = ''; netRender(); }, 2500); netRender(); };
  const fail = () => { say(w + '!'); if (w === 'link') { const i = $('netLink'); if (i.isConnected) { i.focus(); i.select(); } } };
  $('netLink').value = netLink();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => say(w), fail); else fail();
}
function netRender(o = {}) {
  const L = LM.scr.multi; if (!L) return;
  const inLobby = netInLobby(), want = SRV.on ? 'srv' : inLobby ? 'lobby' : 'home', host = NET.role === 'host';
  $('scr-multi').classList.toggle('lobby', inLobby); // salon : le pied (lancer la partie) est affiché
  $('scr-multi').classList.toggle('srv', SRV.on); // salon public : le vote au-dessus du pied
  menuNetChanged(); acctSyncMulti();
  if (inLobby) $('netLink').value = netLink();
  const top = L.stack[L.stack.length - 1];
  if (!top || L.stack[0].id !== want || o.fresh) lmReset(L, want);
  else {
    if ((top.id === 'player' && !NET.players.has(top.params)) || (top.id === 'srvp' && !(SRV.st && SRV.st.j.some((p) => p.id === top.params))) || (top.id === 'map' && !(host && NET.phase === 'lobby'))) lmPop(L); // le joueur est parti ; la partie est lancée
    if (UI.screen === 'multi' || !L.def) lmRender(L, o);
  }
  srvVoteRender();
  if (!inLobby) return;
  if (SRV.on) { srvFoot(); return; }
  const start = $('netStart');
  if (host) { start.textContent = NET.phase === 'loading' ? _t('Chargement de la partie...') : _t('Lancer la partie'); start.disabled = !NET.joined || NET.phase !== 'lobby'; }
  else { start.textContent = NET.phase !== 'lobby' ? _t('Rejoindre la partie') : _t('En attente de l\u0027hôte'); start.disabled = NET.phase === 'lobby' || NET.on || !NET.joined || !!UI.flow; }
}
function netInit() {
  try { NET.nick = netClean(localStorage.getItem('cod_nick') || '').replace(/^Soldat$/, ''); } catch (e) { NET.nick = ''; }
  $('netName').value = NET.nick;
  try { NETP.vis = localStorage.getItem('cod_salon_pub') === '1' ? 1 : 0; } catch (e) { NETP.vis = 0; }
  lmMount($('scr-multi'), { pages: NET_PAGES, home: 'home', col: $('netList'), stage: $('netStage'), panel: $('netPanel'), preview: $('netPrev'), preview2: $('netPrev2'), title: $('scr-multi').querySelector('h2'), sub: $('scr-multi').querySelector('.shead p'), screen: 'multi', bin: $('netBin') });
  setInterval(netPubTick, 1000); srvInit();
  $('nlStay').addEventListener('click', () => netLeaveClose(false)); $('nlQuit').addEventListener('click', () => netLeaveClose(true));
  $('netLeave').addEventListener('click', (e) => { if (e.target === e.currentTarget) netLeaveClose(false); }); // un clic sur le fond : on reste
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('netLeave').classList.contains('hidden')) { e.preventDefault(); e.stopImmediatePropagation(); netLeaveClose(false); } }, true);
  $('netCodeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') netJoinCode($('netCodeIn').value); });
  $('netName').addEventListener('change', () => {
    netNick();
    if (NET.role === 'client') netSend({ t: 'nick', n: NET.nick });
    else if (NET.role === 'host') { const me = NET.players.get(NET.me); if (me) { me.n = NET.nick; netLobbyChanged(); } }
  });
  $('netStart').addEventListener('click', () => { if (SRV.on) srvStartClick(); else if (NET.role === 'host') netLaunch(); else netJoinRunning(); });
  MAPL.subs.add(() => netLoadReport()); // progression du chargement de la carte du salon
  chatInit();
  $('netDiagCopy').addEventListener('click', () => netdCopy());
  $('netDiagBtn').addEventListener('click', () => lmPush(LM.scr.multi, 'diag'));
  setInterval(netHeartbeat, 1000);
  addEventListener('pageshow', () => { NET.leaving = false; });
  addEventListener('pagehide', () => { NET.leaving = true; if (NET.peer) { try { NET.peer.destroy(); } catch (e) { /* déjà détruit */ } } if (NET.relay) NET.relay.close(); if (NET.relayConn) NET.relayConn.close(); });
  netRender();
  if (!netCan()) {
    netStatus(_t('Mode en ligne indisponible. La bibliothèque réseau n\u0027a pas pu être chargée. Rechargez la page.'));
    return;
  }
  const code = new URLSearchParams(location.search).get('salon');
  if (code) { $('netCodeIn').value = code.toUpperCase().slice(0, 5); netStatus(_t('Invitation au salon {0}. Connexion dès la fin du chargement.', $('netCodeIn').value)); }
  else netStatus(netHello());
}
/* Lien d'invitation : on rejoint le salon une fois le jeu chargé (le chargement bloque la page par moments) */
function netAutoJoin() {
  const code = new URLSearchParams(location.search).get('salon') || pwaSalon(); // ou l'invitation reçue dans le navigateur, ouverte ici dans l'application (09r-pwa.js)
  if (code && netCan() && NET.role === 'off') acctWhenReady(() => { if (NET.role === 'off') { netJoinCode(code); if (acctOnlineOk()) uiGo('multi'); } });
}
