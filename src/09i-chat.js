/* ==========================================================================
   DISCUSSION EN LIGNE
   Un message écrit avec la touche T, au salon comme en partie. L'hôte reçoit les messages des invités, les nettoie
   (longueur, caractères de contrôle, cadence, mots refusés masqués par api/_lib/filtre.js) et les rediffuse à tout le monde avec
   l'identifiant, le pseudo et l'équipe de l'auteur ; chacun les nettoie encore à l'arrivée. Un joueur masqué dans l'onglet Joueurs du
   salon (NET.muted) n'apparaît plus dans la discussion de celui qui l'a masqué.
   En partie, les derniers messages s'affichent quelques secondes en bas à gauche ; au salon, tout l'historique se lit.
   ========================================================================== */
const CHAT = { log: [], open: false, keep: 60, show: 8, len: 120, gap: 400, unread: 0 };
/* Message reçu ou envoyé : caractères de contrôle ôtés, longueur bornée, mots refusés masqués (api/_lib/filtre.js), chez l'hôte comme chez chacun */
function chatClean(x) { return filtreTexte(String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT.len)); }
function chatMyTeam() { const me = NET.players.get(NET.me); return NET.on ? PL.ent.team : me ? me.t : 0; }
function chatLine(m, mine) {
  const el = document.createElement('div'); el.className = 'cm';
  const n = document.createElement('b'); n.className = m.t === mine ? 'ally' : 'enemy'; n.textContent = m.n;
  el.append(n, ' ' + m.x);
  return el;
}
/* Redessine les deux listes (salon et partie) ; les lignes de la partie s'estompent avec l'âge, sauf pendant la saisie */
function chatRender() {
  const mine = chatMyTeam(), lobby = $('netChatLog'), game = $('chatLog'), log = CHAT.log.filter((m) => !(m.id && NET.muted.has(m.id))); // masqué après coup : ses messages partent aussi
  if (lobby) {
    const end = lobby.scrollTop + lobby.clientHeight >= lobby.scrollHeight - 30;
    lobby.textContent = '';
    for (const m of log) lobby.appendChild(chatLine(m, mine));
    if (!log.length) { const e = document.createElement('div'); e.className = 'cm empty'; e.textContent = TOUCH.on || PAD.drive ? _t('Aucun message pour l\u0027instant.') : _t('Aucun message. Appuyez sur T pour écrire.'); lobby.appendChild(e); }
    if (end) lobby.scrollTop = lobby.scrollHeight;
  }
  if (game) { game.textContent = ''; for (const m of log.slice(-6)) { const el = chatLine(m, mine); el.dataset.at = m.at; game.appendChild(el); } chatFade(); }
}
function chatFade() {
  const game = $('chatLog'); if (!game) return;
  const now = performance.now();
  for (const el of game.children) el.classList.toggle('old', !CHAT.open && now - +el.dataset.at > CHAT.show * 1000);
}
function chatPush(m) {
  if (m.id && NET.muted.has(m.id)) return; // joueur masqué (salon, onglet Joueurs)
  CHAT.log.push({ id: m.id || '', n: m.n, t: m.t === 1 ? 1 : 0, x: m.x, at: performance.now() });
  if (CHAT.log.length > CHAT.keep) CHAT.log.splice(0, CHAT.log.length - CHAT.keep);
  if (netInLobby() && !netChatOpen()) { CHAT.unread = (CHAT.unread || 0) + 1; chatUnread(); } // salon : la discussion est un sous-menu du salon
  chatRender();
}
/* Messages non lus du salon, sur la rangée Discussion */
function chatUnread() { const L = LM.scr.multi; if (L && netInLobby() && UI.screen === 'multi') lmRender(L); }
function chatClear() { CHAT.log.length = 0; CHAT.unread = 0; chatUnread(); chatRender(); }

/* Envoi : l'hôte diffuse lui-même, l'invité passe par l'hôte (il voit son message quand l'hôte le lui renvoie) ; au salon public, hors
   partie, le message passe par le serveur de jeu (src/09cb-serveurs.js), qui le renvoie à tous */
function chatSend(text) {
  const x = chatClean(text); if (!x) return;
  if (SRV.on && !NET.on) { srvSend({ t: 'chat', x }); return; }
  if (NET.role === 'off' || !NET.joined) return;
  if (NET.role === 'host') chatHostRelay(NET.me, x); else netSend({ t: 'chat', x });
}
function chatHostRelay(id, text) {
  const pl = NET.players.get(id), x = chatClean(text), now = performance.now();
  if (!pl || !x || now - (pl.chatT || 0) < CHAT.gap) return;
  pl.chatT = now;
  const m = { t: 'chat', id, n: pl.n, tm: pl.t, x };
  netBroadcast(m);
  if (NET.muted.has(id)) return;
  chatPush({ id, n: m.n, t: m.tm, x });
  if (id !== NET.me) sfxUi('notify'); // message d'un autre joueur : petit signal
}
function chatIn(m) {
  const x = chatClean(m.x), id = typeof m.id === 'string' ? m.id : '';
  if (!x || (id && NET.muted.has(id))) return;
  chatPush({ id, n: netClean(m.n), t: m.tm === 1 ? 1 : 0, x });
  if (id ? id !== NET.me : netClean(m.n) !== netClean(NET.nick)) sfxUi('notify');
}

/* Saisie en partie : T ouvre, Entrée envoie, Échap annule. Les touches de jeu sont suspendues pendant la saisie. */
function chatOpen() {
  if (CHAT.open || !NET.on || KS.map.open) return;
  CHAT.open = true; $('chatBox').classList.add('open');
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false;
  const el = $('chatIn'); el.value = ''; el.focus({ preventScroll: true }); chatFade();
}
function chatClose() {
  if (!CHAT.open) return;
  CHAT.open = false; $('chatBox').classList.remove('open'); $('chatIn').blur(); chatFade();
}
function chatInit() {
  const bind = (el, onEnter) => el.addEventListener('keydown', (e) => {
    e.stopPropagation(); // ni les touches de jeu ni les raccourcis des menus ne doivent voir la frappe
    if (e.key === 'Enter') { e.preventDefault(); onEnter(el.value); el.value = ''; }
    else if (e.key === 'Escape') { el.blur(); chatClose(); }
  });
  bind($('chatIn'), (v) => { chatSend(v); chatClose(); });
  bind($('netChatIn'), (v) => chatSend(v));
  $('chatIn').addEventListener('keyup', (e) => e.stopPropagation());
  $('chatIn').addEventListener('blur', () => chatClose());
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA')) return;
    if (MATCH.state === 'menu') {
      if (UI.screen === 'multi' && netInLobby() && !UI.busy) { e.preventDefault(); const L = LM.scr.multi; if (!netChatOpen()) lmOpen(L, 'chat'); CHAT.unread = 0; $('netChatIn').focus({ preventScroll: true }); }
    } else if (NET.on && (MATCH.state === 'playing' || MATCH.state === 'killcam')) { e.preventDefault(); chatOpen(); }
  });
  setInterval(chatFade, 500);
  chatRender();
}
