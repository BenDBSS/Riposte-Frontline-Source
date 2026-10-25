/* ==========================================================================
   RELAIS WEBSOCKET (repli du pair à pair)
   Le jeu relie d'abord les joueurs directement (WebRTC, src/09c-net.js). Quand un réseau l'empêche (pare-feu
   qui bloque l'UDP, proxy d'entreprise, VPN, NAT strict), le joueur bascule sur le relais du dossier relay/ :
   une connexion WebSocket en HTTPS (port 443), que presque aucun réseau ne bloque. Le relais fait suivre les
   messages entre l'hôte et ses invités ; la logique du jeu ne change pas, car les connexions par relais
   imitent l'interface d'une connexion PeerJS (send, close, on('open' | 'data' | 'close'), open, peer).
   Protocole des trames : voir relay/src/worker.js.
   Adresse du relais : <meta name="cod-relay" content="wss://..."> de la page (rempli à la construction, voir
   README), ou window.NET_RELAY_URL. Vide : pas de relais, le jeu reste en pair à pair seul.
   Serveur de jeu (netViaServer) : quand le jeu a un relais, build.py ne charge plus PeerJS et tout passe par le relais,
   celui du serveur de jeu (serveur/relais.js, sur le VPS) : aucune connexion directe entre joueurs, aucun ne voit
   l'adresse IP d'un autre.
   ========================================================================== */
/* retry : délais de reconnexion de l'hôte (le premier court : passé 4 s, le serveur de jeu confie la partie à un autre joueur) */
const NETR = { after: 5000, openTimeout: 8000, hostGrace: 15000, srvGrace: 45000, retry: [300, 1000, 2000, 4000, 8000], maxBuffer: 512 * 1024, gkey: '' }; // srvGrace : partie d'un salon du serveur, le temps qu'un autre joueur la reprenne
const NETR_CTL = String.fromCharCode(2), NETR_SEP = String.fromCharCode(1);

function netrUrl() {
  const meta = document.querySelector('meta[name="cod-relay"]');
  const u = String(window.NET_RELAY_URL != null ? window.NET_RELAY_URL : (meta && meta.content) || '').trim().replace(/\/+$/, '');
  return /^wss?:\/\/[^\s/]+(\/\S*)?$/.test(u) ? u : '';
}
/* Tout passe par le serveur de jeu : un relais est configuré et la page n'a pas PeerJS (voir plus haut) */
function netViaServer() { return !!netrUrl() && !netLib(); }
/* Option « passer directement par le relais » : aucune tentative de connexion directe, donc aucun trafic UDP
   (STUN, TURN, WebRTC) sur le réseau. Cochée dans le menu (mémorisée dans le navigateur) ; window.NET_RELAY_ONLY pour les tests.
   Toujours vraie quand tout passe par le serveur de jeu. */
function netRelayOnly() {
  if (!netrUrl()) return false;
  if (netViaServer()) return true;
  if (window.NET_RELAY_ONLY != null) return !!window.NET_RELAY_ONLY;
  try { return localStorage.getItem('cod_relay_only') === '1'; } catch (e) { return false; }
}
function netrRandom(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); let s = ''; for (const v of a) s += NET_ABC[v % NET_ABC.length].toLowerCase(); return s; }

/* Connexion vue du jeu : même interface que la connexion de données de PeerJS */
class RelayConn {
  constructor(peer, tx, end) { this.peer = peer; this.open = false; this.relay = true; this.done = false; this.code = 0; this.ls = {}; this.tx = tx; this.end = end; }
  on(e, f) { (this.ls[e] || (this.ls[e] = [])).push(f); return this; }
  emit(e, a) { for (const f of this.ls[e] || []) { try { f(a); } catch (err) { console.error(err); } } }
  send(m) { if (this.open && !this.done) this.tx(JSON.stringify(m)); }
  close() { if (!this.done && this.end) this.end(); this.finish(); }
  finish() { this.open = false; if (this.done) return; this.done = true; this.emit('close'); }
}

/* Envoie une trame si la connexion est ouverte et pas engorgée (l'état du jeu est renvoyé sans cesse : perdre une trame ne coûte rien) */
function netrPush(ws, text) { if (ws && ws.readyState === 1 && ws.bufferedAmount < NETR.maxBuffer) { try { ws.send(text); } catch (e) { /* connexion en cours de fermeture */ } } }

/* Invité : se connecte au salon par le relais. La connexion est « ouverte » quand le relais annonce l'hôte présent. */
function netrJoin(code, id) {
  let ws = null, grace = 0, guard = 0;
  const c = new RelayConn(NET_PREFIX + code, (t) => netrPush(ws, t), () => { try { ws.close(1000); } catch (e) { /* déjà fermée */ } });
  c.up = false; // la connexion WebSocket a-t-elle abouti ?
  // clé d'invité, la même pour toute la page : le serveur de jeu ne laisse reprendre l'identifiant (diffusé aux autres joueurs) qu'à qui l'a
  const gk = NETR.gkey || (NETR.gkey = netrRandom(24));
  try { ws = new WebSocket(netrUrl() + '/room/' + code + '?role=guest&id=' + encodeURIComponent(id) + '&key=' + gk); } catch (e) { setTimeout(() => c.finish(), 0); return c; }
  const stop = () => { clearTimeout(grace); clearTimeout(guard); };
  guard = setTimeout(() => { if (!c.up) { c.code = 1006; try { ws.close(); } catch (e) { /* ignoré */ } c.finish(); } }, NETR.openTimeout);
  ws.onopen = () => { c.up = true; clearTimeout(guard); };
  ws.onmessage = (e) => {
    const d = e.data;
    if (typeof d !== 'string') return;
    if (d.charCodeAt(0) === 2) {
      const [cmd, a, b] = d.slice(1).split(NETR_SEP);
      if (cmd === 'host') {
        clearTimeout(grace);
        if (a === '1') { if (!c.open && !c.done) { c.open = true; c.emit('open'); } else if (c.down) c.emit('rehost'); c.down = false; } // rehost : un hôte (le même, ou celui qui reprend la partie) est de retour
        else if (c.open) { c.down = true; c.emit('hostdown'); grace = setTimeout(() => { c.code = 4004; try { ws.close(); } catch (err) { /* ignoré */ } c.finish(); }, c.grace || NETR.hostGrace); } // l'hôte a peut-être seulement changé de connexion
      } else if (cmd === 'refuse') { c.code = Number(a) || 4001; c.reason = b || ''; stop(); try { ws.close(); } catch (err) { /* ignoré */ } c.finish(); }
      return;
    }
    let m; try { m = JSON.parse(d); } catch (err) { return; } // trame illisible : ignorée
    c.emit('data', m);
  };
  ws.onclose = (e) => { stop(); if (!c.code) c.code = e.code || 1006; c.finish(); };
  ws.onerror = () => { /* onclose suit toujours */ };
  return c;
}

/* Hôte : tient le salon ouvert auprès du relais et présente chaque invité comme une connexion.
   onConn(conn) est appelé pour chaque nouvel invité ; onState('up' | 'down' | 'fail' | 'taken', détail) suit la liaison. */
class RelayHost {
  constructor(code, onConn, onState, key) {
    this.code = code; this.id = NET_PREFIX + code; this.key = key || netrRandom(24); this.onConn = onConn; this.onState = onState; // key : clé donnée par le serveur de jeu à qui reprend une partie
    this.conns = new Map(); this.ws = null; this.everUp = false; this.closed = false; this.fails = 0; this.timer = 0; this.guard = 0;
    this.meta = ''; // annonce du salon public (vide : salon privé), renvoyée à chaque (re)connexion
  }
  start() { this.connect(); }
  connect() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(netrUrl() + '/room/' + this.code + '?role=host&id=' + encodeURIComponent(this.id) + '&key=' + this.key); } catch (e) { this.lost(); return; }
    this.ws = ws; let up = false;
    this.guard = setTimeout(() => { if (!up) { try { ws.close(); } catch (e) { /* ignoré */ } } }, NETR.openTimeout);
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      const d = e.data;
      if (typeof d !== 'string') return;
      if (d.charCodeAt(0) === 2) {
        const [cmd, a, b] = d.slice(1).split(NETR_SEP);
        if (cmd === 'sync') {
          if (!up) { up = true; this.everUp = true; this.fails = 0; clearTimeout(this.guard); if (this.meta) netrPush(ws, NETR_CTL + 'pub' + NETR_SEP + this.meta); this.onState('up'); }
          const ids = new Set(a ? a.split(',') : []);
          for (const id of ids) this.join(id);
          for (const id of [...this.conns.keys()]) if (!ids.has(id)) this.leave(id);
        } else if (cmd === 'join') this.join(a);
        else if (cmd === 'leave') this.leave(a);
        else if (cmd === 'refuse') { this.refused = Number(a) || 0; this.why = b || ''; }
        return;
      }
      const cut = d.indexOf(NETR_SEP);
      if (cut < 1) return;
      const c = this.conns.get(d.slice(0, cut));
      if (!c) return;
      let m; try { m = JSON.parse(d.slice(cut + 1)); } catch (err) { return; }
      c.emit('data', m);
    };
    ws.onclose = () => {
      clearTimeout(this.guard);
      if (this.ws !== ws || this.closed) return;
      if (this.refused === 4011) { this.closed = true; this.onState('taken'); return; }
      this.lost();
    };
    ws.onerror = () => { /* onclose suit toujours */ };
  }
  /* Liaison perdue : nouvel essai avec délai croissant, sans limite (le salon peut revenir tant que l'onglet vit) */
  lost() {
    if (this.closed) return;
    this.fails++;
    if (this.everUp) this.onState('down'); else if (this.fails === 3) this.onState('fail', _t('relais injoignable'));
    const wait = NETR.retry[Math.min(this.fails - 1, NETR.retry.length - 1)];
    this.timer = setTimeout(() => this.connect(), wait);
  }
  join(id) {
    if (!id || this.conns.has(id)) return;
    const c = new RelayConn(id, (t) => this.sendTo(id, t), () => this.kick(id));
    c.open = true; this.conns.set(id, c);
    this.onConn(c);
    c.emit('open');
  }
  leave(id) { const c = this.conns.get(id); if (c) { this.conns.delete(id); c.finish(); } }
  /* Salon public : annonce au serveur de jeu (nom de l'hôte, carte, mode, joueurs, phase), seulement quand elle change ; null : salon privé */
  pub(meta) {
    const s = meta ? JSON.stringify(meta) : '';
    if (s === this.meta) return;
    this.meta = s; netrPush(this.ws, NETR_CTL + 'pub' + NETR_SEP + s);
  }
  kick(id) { this.conns.delete(id); netrPush(this.ws, NETR_CTL + 'kick' + NETR_SEP + id); }
  /* Exclusion par l'hôte : le serveur de jeu refuse ensuite l'adresse de ce joueur dans ce salon (un rechargement de page ne suffit pas) */
  ban(id) { netrPush(this.ws, NETR_CTL + 'ban' + NETR_SEP + id); }
  sendTo(id, text) { netrPush(this.ws, id + NETR_SEP + text); }
  /* Un seul envoi pour plusieurs invités : le relais fait la distribution, et ses messages sortants ne sont pas comptés */
  sendMany(ids, m) {
    const ok = ids.filter((id) => { const c = this.conns.get(id); return c && c.open; });
    if (!ok.length) return;
    const text = JSON.stringify(m);
    for (let i = 0; i < ok.length; i += 16) netrPush(this.ws, ok.slice(i, i + 16).join(',') + NETR_SEP + text);
  }
  close() {
    this.closed = true; clearTimeout(this.timer); clearTimeout(this.guard);
    try { this.ws.close(1000); } catch (e) { /* déjà fermée */ }
    for (const c of [...this.conns.values()]) c.finish();
    this.conns.clear();
  }
}
