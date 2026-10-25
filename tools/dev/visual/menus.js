/* Menus sur écran de téléphone : node tools/dev/visual/menus.js [dossier de captures]
   Pour plusieurs tailles de téléphone et de tablette (iPad, 4:3) en paysage (écrans allongés des Pixel récents, 16:9 plus anciens, fenêtre du navigateur avec sa barre
   d'adresse), ouvre chaque écran de menu et relève :
   - les débordements horizontaux ;
   - pour les écrans à panneau d'actions (Solo, salon, déploiement) : l'écran ne défile pas (seule la zone de choix défile), le panneau de
     droite montre tout son contenu et le bouton « Lancer la partie » / « Déployer » est entièrement à l'écran ;
   - les recouvrements : textes et boutons qui se chevauchent (hors de ce qui est rogné par une zone défilante) ;
   - la fenêtre « Quoi de neuf » d'une grande version : ouverte avec ses changements, titre et boutons entièrement à l'écran (la liste défile) ;
   - les résultats d'une partie : le titre, le minuteur et les boutons du pied entièrement à l'écran (le corps défile).
   TAILLES=1024x768,915x412 et ECRANS=tenues,pause-classe limitent le contrôle à ces tailles et à ces écrans ; TOUT=1 garde une capture de chaque écran (sinon, des seuls échecs). Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
const SIZES = [[997, 448], [997, 392], [952, 427], [952, 372], [915, 412], [844, 390], [800, 340], [740, 360], [667, 375], [1024, 768], [1133, 744], [1180, 820], [1366, 1024], [1280, 800]]; // iPad en paysage (1024x768 à 1366x1024), puis le Steam Deck (1280x800)
const DECK_ONLY = new Set(['principal-steam-deck', 'principal-deck-manette']); // cartes qui n'existent que sur Steam Deck (src/09ra-deck.js) : contrôlées à sa taille seulement (4:3, mini, Air)
/* Espace Communauté (src/09z-communaute.js) : messages simulés, vus par un compte de l'équipe (outils de l'équipe, onglet Signalés) ; à appeler après socMock() */
const COMM_MOCK = `function commMock() {
  const at = (h) => new Date(Date.now() - h * 3600e3).toISOString(), au = (u, n) => ({ username: u, displayName: n, avatar: null });
  const P = (o) => Object.assign({ edited: false, mine: false, votes: 0, voted: false, flagged: false, status: null, reply: null, hidden: false, reports: 0, rating: null }, o);
  const avis = [
    P({ id: 1, kind: 'avis', rating: 5, body: "Super jeu, les cartes sont magnifiques et ça tourne bien sur mon téléphone.", at: at(2), author: au('Corbeau_7', 'Corbeau 7'), reply: { text: 'Merci beaucoup !', at: at(1) } }),
    P({ id: 2, kind: 'avis', rating: 4, body: "Très bon. Il manque juste un mode capture de drapeau.", at: at(30), edited: true, author: au('Testeur_1', 'Testeur'), mine: true }),
    P({ id: 3, kind: 'avis', rating: 3, body: '', at: at(80), author: au('Lynx_Du_Nord', 'Lynx Du Nord'), flagged: true }),
  ];
  const idees = [
    P({ id: 11, kind: 'idee', body: "Un mode capture de drapeau sur les grandes cartes.\\nAvec des véhicules, ce serait encore mieux.", at: at(50), author: au('Lynx_Du_Nord', 'Lynx Du Nord'), votes: 42, voted: true, status: 'prevu', reply: { text: "C'est prévu pour une prochaine version.", at: at(4) } }),
    P({ id: 12, kind: 'idee', body: "Pouvoir choisir la couleur du réticule dans les options.", at: at(9), author: au('Testeur_1', 'Testeur'), mine: true, votes: 17 }),
    P({ id: 13, kind: 'idee', body: "Des tenues à acheter avec de vrais sous", at: at(3), author: au('Gros_Mot_9', 'Pseudo limite'), votes: 1, hidden: true, reports: 3 }),
  ];
  const bugs = [
    P({ id: 21, kind: 'bug', body: "Sur Meltem, je reste bloqué contre le puits quand je cours vers le moulin. Pixel 7, Chrome.", at: at(6), author: au('Soldat_Fantome', 'Soldat Fantome'), votes: 8, status: 'fait', reply: { text: 'Corrigé dans la version 3.6.0, merci !', at: at(1) } }),
  ];
  const prev = window.acctApi;
  window.acctApi = async (name, body) => {
    if (name.startsWith('community?')) {
      const q = new URLSearchParams(name.split('?')[1]), k = q.get('view') === 'reported' ? 'reported' : q.get('kind') || 'avis';
      const posts = k === 'avis' ? avis : k === 'idee' ? idees : k === 'bug' ? bugs : idees.filter((x) => x.hidden);
      return { ok: true, status: 200, data: { kind: k, sort: k === 'avis' ? 'new' : q.get('sort') || 'top', posts, more: false, summary: { count: 128, avg: 4.3 }, myReview: { id: 2, rating: 4, body: avis[1].body }, canReview: true, mod: true, reported: 1 } };
    }
    if (name.startsWith('community')) return { ok: true, status: 200, data: { ok: true } };
    return prev(name, body);
  };
}`;
/* Amis (src/09ta-amis.js) : liste d'amis avec leur présence, invitation reçue, simulées sans l'API ; à appeler après socMock(). o.inv : une
   invitation reçue dans le salon d'un ami */
const AMIS_MOCK = `function amisMock(o) {
  const f = (u, n, lv, on, st) => ({ username: u, displayName: n, avatar: null, level: lv, online: on, state: on ? st : null });
  const list = [f('Corbeau_7', 'Corbeau 7', 60, true, 'menu'), f('Soldat_Fantome', 'Soldat Fantome', 46, true, 'partie'), f('Tigre', 'Tigre', 39, true, 'salon'), f('Renard_Roux', 'Renard Roux Long', 32, false), f('Hibou', 'Hibou', 5, false), f('Marmotte_Des_Cimes', 'Marmotte Des Cimes', 18, false)];
  const received = [f('Lynx_Du_Nord', 'Lynx Du Nord', 53, false)], sent = [f('Gros_Mot_9', 'Pseudo limite', 12, false)];
  const prev = window.acctApi;
  window.acctApi = async (name, body) => name === 'friends' ? { ok: true, status: 200, data: { friends: list, received, sent } } : name === 'presence' || name === 'invite-answer' || name === 'salon-invite' ? { ok: true, status: 200, data: { unread: 2, invites: AMIS.inv } } : prev(name, body);
  Object.assign(AMIS, { list, received, out: sent, loading: false, err: '', note: '', at: Date.now(), last: Date.now(), sent: { corbeau_7: netCodeNow() }, gone: new Set(),
    inv: o.inv ? [{ id: 9, code: 'K7QX2', at: new Date().toISOString(), from: { username: 'Tigre', displayName: 'Tigre' } }] : [] });
  amisInviteCard();
}`;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };

const SOC_MOCK = "/* Compte connect\u00e9 et r\u00e9ponses du serveur simul\u00e9s pour les \u00e9crans sociaux (classement, profil d'un joueur, notifications) */\nfunction socMock() {\n  const names = ['Corbeau_7', 'Lynx_Du_Nord', 'Soldat_Fantome', 'Tigre', 'Renard_Roux', 'Hibou'];\n  const rel = ['friend', 'received', 'none', 'sent', 'none', 'none'];\n  const players = names.map((n, i) => ({ rank: i + 1, username: n, displayName: n.replace(/_/g, ' ').slice(0, 16), level: 60 - i * 7, xp: 90000 - i * 9000, wins: 120 - i * 15, matches: 200, kd: 2.4 - i * 0.3, points: 90000 - i * 9000, relation: rel[i] }));\n  players.splice(3, 0, { rank: 4, username: 'Testeur_1', displayName: 'Testeur', level: 22, xp: 20000, wins: 30, matches: 80, kd: 1.12, points: 20000, relation: 'me' });\n  const stats = { matches: 200, wins: 120, losses: 70, kills: 2400, deaths: 1000, assists: 300, headshots: 500, shots: 20000, hits: 8000, seconds: 90000, bestStreak: 17 };\n  const recent = [{ played_at: new Date().toISOString(), map: 'sable', mode: 'tdm', online: true, result: 'win', kills: 18, deaths: 6 }, { played_at: new Date().toISOString(), map: 'sable', mode: 'ffa', online: false, result: 'loss', kills: 9, deaths: 12 }];\n  const modAccounts = [\n    { username: 'Gros_Mot_9', displayName: 'Pseudo limite', createdAt: '2026-10-01T10:00:00Z', blockedAt: null, avatar: null, avatarHidden: true, level: 12, stats: { xp: 52000, matches: 40, kills: 900, deaths: 60 }, removed: false, reasons: { photo: 3, nom: 2, triche: 4 }, notes: [{ reason: 'triche', note: 'Il tue tout le monde \u00e0 travers les murs depuis le d\u00e9but de la partie.', at: new Date().toISOString(), by: 'Corbeau_7' }, { reason: 'nom', note: 'Pseudo insultant', at: new Date().toISOString(), by: 'Lynx_Du_Nord' }], last: new Date().toISOString() },\n    { username: 'Renard_Roux', displayName: 'Renard Roux', createdAt: '2026-09-12T10:00:00Z', blockedAt: null, avatar: null, avatarHidden: false, level: 32, stats: { xp: 41000, matches: 200, kills: 2400, deaths: 2000 }, removed: false, reasons: { comportement: 1 }, notes: [], last: new Date().toISOString() },\n  ];\n  const items = [\n    { id: 4, kind: 'friend_request', data: null, at: new Date().toISOString(), read: false, from: { username: 'Lynx_Du_Nord', displayName: 'Lynx Du Nord' }, pending: true },\n    { id: 3, kind: 'levelup', data: { level: 22 }, at: new Date(Date.now() - 3600e3).toISOString(), read: false, from: null, pending: false },\n    { id: 2, kind: 'friend_accepted', data: null, at: new Date(Date.now() - 86400e3).toISOString(), read: true, from: { username: 'Corbeau_7', displayName: 'Corbeau 7' }, pending: false },\n    { id: 1, kind: 'welcome', data: null, at: new Date(Date.now() - 5 * 86400e3).toISOString(), read: true, from: null, pending: false },\n  ];\n  ACCT.state = 'ready'; ACCT.user = { username: 'Testeur_1', displayName: 'Testeur', avatar: null, hasPassword: true, hasRecovery: true, moderator: true, modOpen: 2 }; ACCT.code = ''; ACCT.level = { level: 22, xp: 20000, into: 100, need: 1000, next: 21000 }; ACCT.stats = stats; ACCT.recent = [];\n  window.acctApi = async (name) => {\n    if (name.startsWith('leaderboard')) return { ok: true, status: 200, data: { players, more: true, me: { rank: 4, total: 1280 } } };\n    if (name.startsWith('player')) return { ok: true, status: 200, data: { user: { username: 'Corbeau_7', displayName: 'Corbeau 7', createdAt: '2026-08-01T10:00:00Z' }, level: { level: 60, xp: 90000, into: 400, need: 1000, next: 91000 }, rank: 1, stats, recent, relation: 'received' } };\n    if (name.startsWith('notifications')) return { ok: true, status: 200, data: { unread: 2, items } };\n    if (name === 'me') return { ok: true, status: 200, data: { user: ACCT.user, level: ACCT.level, stats, recent: [] } };\n    if (name.startsWith('mod-list')) return { ok: true, status: 200, data: { open: 2, accounts: name.includes('blocked') ? [] : modAccounts } };\n    if (name === 'report') return { ok: true, status: 200, data: { ok: true } };\n    return { ok: true, status: 200, data: {} };\n  };\n  SOC.notifs = { items: [], unread: 2, loaded: false, busy: false, fresh: new Set() }; socChanged(); socBadge();\n}\n";

/* Exécuté dans la page : salon simulé (rôle, sous-menu ouvert : '', 'setup', 'map', 'chat', 'player', 'leave') */
function netMock(role, pane) {
  uiOpen('multi', ['main']);
  Object.assign(NET, { role, joined: true, code: 'AB12C', me: 'me', phase: 'lobby', pane, t0: performance.now(), hostSeen: performance.now() + 1e6 }); // le battement réseau ne doit pas déclarer l'hôte perdu pendant le relevé
  NET.players.clear();
  for (const [id, n, t, h, lv] of [['me', 'Soldat', 0, 1, 12], ['f', 'Fantôme', 0, 0, 34], ['c', 'Corbeau', 0, 0, 7], ['t', 'Tigre', 1, 0, 55], ['r', 'Renard', 1, 0, 100], ['l', 'Lynx', 1, 0, 3]]) NET.players.set(id, { id, n, t, h: !!h, lv, ig: id === 'c', ld: id === 'c' ? 40 : 0, r: id === 'r' });
  CHAT.log.length = 0; for (const x of ['Salut', 'On lance quand tout le monde est là ?', 'Oui, un instant']) CHAT.log.push({ n: 'Fantôme', t: 0, x, at: performance.now() });
  CHAT.unread = 2; netRender(); chatRender(); chatUnread();
  if (pane === 'player') lmPush(LM.scr.multi, 'player', 'f'); else if (pane === 'leave') netLeaveAsk(); else if (pane) lmPush(LM.scr.multi, pane); // un sous-menu du salon, ouvert à droite du menu
  document.getElementById('netLink').value = 'https://www.playriposte.com/?salon=AB12C';
}

/* Exécuté dans la page : salons du serveur simulés (src/09cb-serveurs.js) ; ph : phase du salon ('' : l'accueil avec leur liste), pane :
   sous-menu ouvert ('create', 'chat', 'srvp', 'srvsetup', 'srvmap', 'invite') ; perso : salon créé ('chef' : vu par son chef, 'membre' : par un autre
   joueur) ; la connexion au serveur et l'entrée dans la partie sont coupées */
function srvMock(ph, pane, perso) {
  NET.role = 'off'; NETP.err = false; NETP.joueurs = 23; NETP.at = Date.now() + 1e9;
  SRV.list = [['tdm1', 'tdm', 1, 'meltem', 6, 'partie'], ['tdm2', 'tdm', 2, 'sable', 3, 'decompte'], ['tdm3', 'tdm', 3, 'givre', 0, 'attente'], ['ffa1', 'ffa', 1, 'stratus', 2, 'attente'],
    ['ffa2', 'ffa', 2, 'tephra', 8, 'partie'], ['dom1', 'dom', 1, 'embruns', 4, 'decompte'], ['dom2', 'dom', 2, 'floreal', 0, 'attente']].map(([i, o, k, m, j, p]) => ({ i, o, k, m, j, x: 8, p }));
  SRV.crees = [['K7QX2', 'givre', 'tdm', 5, 'partie', 'Lynx Du Nord', false], ['', 'floreal', 'dom', 3, 'attente', 'Corbeau 7', true], ['P4RTY', 'sable', 'ffa', 1, 'attente', 'Renard_Roux_Long', false]].map(([i, m, o, j, p, n, pv]) => ({ i, m, o, j, x: 8, p, n, pv }));
  const id = perso ? 'AB12C' : 'tdm2';
  Object.assign(SRV, { on: !!ph, id, ws: null, up: true, at: performance.now(), tried: 'XY34Z', triedT: performance.now() + 1e9, voteKey: '', kickAsk: '' });
  SRV.st = ph ? { o: 'tdm', k: perso ? 0 : 2, i: id, ps: !!perso, own: perso === 'chef' ? 'me' : 'f', cfg: perso ? { bots: 1, diff: 1, limit: 50, time: 10, pub: 0 } : { bots: 1, diff: 1, limit: 75, time: 10, pub: 1 },
    ph, m: ph === 'partie' || perso ? 'sable' : 'meltem', c: perso ? null : ['meltem', 'stratus'], vt: [2, 1], mv: 0, vo: !perso && (ph === 'attente' || ph === 'decompte'), r: 25000, s: 4, x: 8, me: 'me', code: ph === 'partie' ? 'XY34Z' : '', hote: ph === 'partie' ? 'f' : '',
    j: [['me', 'Soldat', 12, 0], ['f', 'Fantôme', 34, 0], ['c', 'Corbeau', 7, 1], ['t', 'Tigre_Du_Bengale', 55, 1], ['r', 'Renard', 100, 0]].slice(0, ph === 'attente' && !perso ? 2 : 5).map(([pid, n, lv, t]) => ({ id: pid, n, lv, t })) } : null;
  CHAT.log.length = 0; if (ph) for (const x of ['Salut', 'Votez Meltem !']) CHAT.log.push({ n: 'Fantôme', t: 0, x, at: performance.now() });
  uiOpen('multi', ['main']); netRender({ fresh: true }); chatRender();
  if (pane === 'srvp') lmPush(LM.scr.multi, 'srvp', 'f'); else if (pane) lmPush(LM.scr.multi, pane);
  document.getElementById('netLink').value = 'https://www.playriposte.com/?salon=AB12C';
}

/* Exécuté dans la page : relevé de l'écran visible */
function probe(args) {
  const [fit, rootSel, panelSel] = args;
  const scr = rootSel ? document.querySelector(rootSel) : [...document.querySelectorAll('.scr')].find((e) => getComputedStyle(e).display !== 'none');
  const W = innerWidth, H = innerHeight, res = { id: scr ? scr.id : '?', bad: [] };
  if (!scr) return res;
  const vis = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  /* barres collantes opaques d'une zone qui défile (pied de boutons, en-tête) : le contenu passe dessous, caché et non recouvert */
  const stickies = new Map();
  const stickyOf = (n) => {
    if (!stickies.has(n)) {
      const q = n.getBoundingClientRect(), list = [];
      for (const s of n.querySelectorAll('*')) {
        const ss = getComputedStyle(s); if (ss.position !== 'sticky' || /rgba\(0, 0, 0, 0\)|transparent/.test(ss.backgroundColor)) continue;
        const sr = s.getBoundingClientRect();
        if (sr.bottom >= q.bottom - 1) list.push({ s, bot: true, y: sr.top }); else if (sr.top <= q.top + 1) list.push({ s, bot: false, y: sr.bottom });
      }
      stickies.set(n, list);
    }
    return stickies.get(n);
  };
  /* rectangle visible : rogné par les ancêtres qui coupent ou défilent, et par leurs barres collantes */
  const clip = (r, e) => {
    let b = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let n = e.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const q = n.getBoundingClientRect(); b = { l: Math.max(b.l, q.left), t: Math.max(b.t, q.top), r: Math.min(b.r, q.right), b: Math.min(b.b, q.bottom) };
        for (const k of stickyOf(n)) if (!k.s.contains(e)) { if (k.bot) b.b = Math.min(b.b, k.y); else b.t = Math.max(b.t, k.y); }
      }
    }
    return b.r - b.l > 0.5 && b.b - b.t > 0.5 ? b : null;
  };
  const atoms = [];
  const isAtom = (e) => e.matches('button, input, select, textarea, a[href]');
  for (const e of scr.querySelectorAll('*')) {
    if (!vis(e)) continue;
    if (isAtom(e) && e.type !== 'hidden' && e.type !== 'checkbox' && e.type !== 'radio') { const b = clip(e.getBoundingClientRect(), e); if (b) atoms.push({ el: e, b, kind: 'ctl', name: (e.id || e.className || e.tagName) + ':' + (e.textContent || e.value || '').trim().slice(0, 18) }); }
    if (e.closest('select, textarea, input')) continue; // le texte d'un bouton compte : deux textes d'une même carte ne doivent pas se chevaucher
    for (const n of e.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) { if (r.width < 2 || r.height < 2) continue; const b = clip(r, e); if (b) atoms.push({ el: e, b, kind: 'txt', name: (e.id || e.className || e.tagName) + ':' + n.textContent.trim().slice(0, 18) }); }
    }
  }
  const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1.5;
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const a = atoms[i], b = atoms[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const av = a.el.closest('.acct-av'); if (av && av === b.el.closest('.acct-av')) continue; // pastille de niveau posée sur l'avatar : recouvrement voulu
    if (a.el.closest('.vw-hot') && b.el.closest('.vw-hot')) continue; // points « + » de l'atelier, projetés sur l'arme 3D : deux emplacements voisins ont des zones de toucher (44 px) qui se touchent
    // liste flottante opaque de l'atelier (.hotpop : accessoires, camouflages) : elle se déroule par-dessus le visuel et ce qui le suit ; ce
    // qu'elle cache ne compte pas (le point de recouvrement est bien à elle), ce qui reste visible par-dessus compte
    const pa = a.el.closest('.hotpop'), pb = b.el.closest('.hotpop');
    if (!pa !== !pb) {
      const x = (Math.max(a.b.l, b.b.l) + Math.min(a.b.r, b.b.r)) / 2, y = (Math.max(a.b.t, b.b.t) + Math.min(a.b.b, b.b.b)) / 2, top = document.elementFromPoint(x, y);
      if (top && top.closest('.hotpop') === (pa || pb)) continue;
    }
    if (hit(a.b, b.b)) res.bad.push(`${a.name} / ${b.name}`);
  }
  res.hscroll = scr.scrollWidth - scr.clientWidth;
  res.vscroll = scr.scrollHeight - scr.clientHeight;
  for (const a of atoms) if (a.b.r > W + 1 || a.b.b > H + 1 || a.b.l < -1 || a.b.t < -1) res.bad.push(`${a.name} hors de l'écran`);
  if (fit) {
    const go = scr.querySelector('.sfoot .deploy:not(.hidden), .lm-foot .deploy:not(.hidden)'), r = go && go.getBoundingClientRect();
    res.go = r ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null;
    const rp = scr.querySelector(panelSel || '.split-r:not(.hidden)'); res.panel = rp ? { sh: rp.scrollHeight, ch: rp.clientHeight, t: rp.getBoundingClientRect().top } : null;
  }
  // une ligne par libellé (téléphone) : un libellé de rangée, de choix ou le nom d'une carte coupé par des points de suspension ne se lit plus ;
  // une seconde ligne (résumé, explication) peut l'être
  res.cut = [...scr.querySelectorAll('.lrow .ll, .lrow .lt, .mapcard .mt, .orow > span:first-child')].filter((e) => vis(e) && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && !e.closest('.k-player')).map((e) => e.textContent.trim().slice(0, 24));
  // ... ni passer à la ligne (le texte propre du libellé, sans sa seconde ligne)
  for (const e of scr.querySelectorAll('.lrow .ll, .orow > span:first-child')) {
    const t = e.firstChild; if (!t || t.nodeType !== 3 || !vis(e)) continue;
    const rg = document.createRange(); rg.selectNodeContents(t); const tops = new Set([...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top)));
    if (tops.size > 1) res.cut.push(t.textContent.trim().slice(0, 24) + ' (deux lignes)');
  }
  res.W = W; res.H = H;
  return res;
}

(async () => {
  const g = await openGame({ mobile: true, w: 997, h: 392, dpr: 1, settings: { quality: 'low', lang: 'fr', map: 'sable', touch: 'on' }, noMap: true, noHdri: true });
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.addScriptTag({ content: SOC_MOCK });
  await page.addScriptTag({ content: COMM_MOCK });
  await page.addScriptTag({ content: AMIS_MOCK });
  await page.evaluate(() => {
    // pause : état de partie simulé ; chargement : textes d'exemple (le plus long : une description de carte et un message d'échec)
    window.pause = (v) => { document.getElementById('matchload').classList.add('hidden'); MATCH.state = 'paused'; MATCH.online = false; MATCH.timeLeft = 400; PL.classIdx = 0; document.getElementById('ui').classList.add('hidden'); document.getElementById('pause').classList.add('show'); pmOpen(); pmView(v); };
    // compte connecté simulé pour les écrans du Profil (rec : a un code de secours ; null : déconnecté) ; « me » renvoie ce compte
    window.acctMockUser = (rec) => {
      const user = rec === null ? null : { username: 'Testeur_1', displayName: 'Testeur', avatar: null, hasPassword: true, hasRecovery: !!rec };
      const level = { level: 22, xp: 20000, into: 100, need: 1000, next: 21000 }, stats = { matches: 200, wins: 120, losses: 70, kills: 2400, deaths: 1000, assists: 300, headshots: 500, shots: 20000, hits: 8000, seconds: 90000, bestStreak: 17 };
      Object.assign(ACCT, { state: 'ready', user, level, stats, recent: [], code: '', codeNote: '', codeThen: null, err: '', note: '', view: 'login', draft: {} });
      window.acctApi0 = window.acctApi0 || window.acctApi;
      window.acctApi = async (name, body) => (name === 'me' ? { ok: true, status: 200, data: { user, level, stats, recent: [] } } : window.acctApi0(name, body));
    };
    window.loading = (fail) => {
      const $ = (i) => document.getElementById(i), m = mapById('simoun');
      document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; $('ui').classList.add('hidden');
      $('mlName').textContent = m.name; $('mlDesc').textContent = m.desc; $('mlMode').textContent = 'Match à mort par équipe · solo';
      $('mlMsg').textContent = fail ? "L'affichage 3D a été interrompu par l'appareil pendant le chargement (affichage 3D interrompu par l'appareil). Relancez le jeu : le mode graphique économique est activé." : 'Compilation des shaders : 42 %';
      for (const i of ['mlBack', 'mlRep', 'mlSafe']) $(i).classList.toggle('hidden', !fail);
      $('matchload').classList.remove('hidden');
    };
  });
  const SCREENS = [
    ['main', true, () => uiOpen('main')],
    // Steam Deck (src/09ra-deck.js) : la carte d'installation (navigateur du Deck en mode Bureau) et celle de la disposition des commandes (mode Deck)
    ['principal-steam-deck', true, () => { DECK_UI.force = 'install'; uiOpen('main'); }],
    ['principal-deck-manette', true, () => { DECK_UI.force = 'pad'; uiOpen('main'); }],
    // amis (09ta-amis.js) : une invitation reçue (encart à droite, au menu principal et sur un autre écran), l'écran Jouer, l'écran Amis (hors
    // d'un salon, puis dans un salon : inviter un ami connecté), l'invitation des amis depuis un salon créé
    ['principal-invitation', true, () => { socMock(); amisMock({ inv: true }); uiOpen('main'); amisInviteCard(); }],
    ['jouer', true, () => { socMock(); amisMock({}); uiOpen('play', ['main']); }],
    ['jouer-invitation', true, () => { socMock(); amisMock({ inv: true }); uiOpen('play', ['main']); amisInviteCard(); }],
    ['amis', false, () => { socMock(); amisMock({ inv: true }); uiOpen('friends', ['main']); }],
    ['amis-salon', false, `socMock(); amisMock({}); (${srvMock})('attente', '', 'chef'); uiOpen('friends', ['main', 'multi'])`],
    ['salon-cree-inviter-amis', true, `socMock(); amisMock({}); (${srvMock})('attente', 'invite', 'chef')`],
    ['solo', true, () => uiOpen('solo', ['main'])],
    // sous-menus du Solo (ils glissent à droite du menu, par-dessus les équipes)
    ['solo-carte', true, () => { uiOpen('solo', ['main']); lmPush(LM.scr.solo, 'map'); }],
    ['solo-parametres', true, () => { uiOpen('solo', ['main']); lmPush(LM.scr.solo, 'setup'); }],
    ['solo-chacun', true, () => { Settings.mode = 'ffa'; uiOpen('solo', ['main']); Settings.mode = 'tdm'; }],
    ['multi', false, () => { NET.role = 'off'; uiOpen('multi', ['main']); netRender(); }],
    // salons publics permanents (src/09cb-serveurs.js) : l'accueil et leur liste par mode, « Rejoindre une partie » (le mode), puis un salon public
    // en attente, en décompte (le vote en bas à gauche), en partie (la carte en cours), sa discussion et un joueur
    ['multi-serveurs', false, `(${srvMock})('', '')`],
    ['multi-creer', false, `(${srvMock})('', 'create')`],
    // salon créé par un joueur (tenu par le serveur) : vu par son chef (réglages, carte, joueur à exclure, invitation), puis par un autre joueur
    ...[['salon-cree', ''], ['salon-cree-parametres', 'srvsetup'], ['salon-cree-carte', 'srvmap'], ['salon-cree-joueur', 'srvp'], ['salon-cree-inviter', 'invite']].map(([n, pane]) => [n, true, `(${srvMock})('attente', '${pane}', 'chef')`]),
    ['salon-cree-membre', true, `(${srvMock})('attente', '', 'membre')`],
    // migration de l'hôte en pleine partie (src/09c-net.js) : voile, titre, phrase et barre, entièrement à l'écran
    ['migration-hote', false, () => { MATCH.state = 'menu'; document.getElementById('ui').classList.add('hidden'); netMigShow(_t('Un autre joueur reprend la partie.')); MIG.t0 = performance.now() - 3000; netMigBar(); }, '#hostMig'],
    // coupure d'un invité en pleine partie (netResumeStart) : le même écran, titre « Reconnexion »
    ['reconnexion', false, () => { MATCH.state = 'menu'; document.getElementById('ui').classList.add('hidden'); netMigShow(_t('Connexion perdue. Retour dans la partie...'), _t('Reconnexion')); MIG.t0 = performance.now() - 3000; netMigBar(); }, '#hostMig'],
    ['salon-cree-membre-parametres', true, `(${srvMock})('attente', 'srvsetup', 'membre')`],
    ...[['salon-public-attente', 'attente', ''], ['salon-public', 'decompte', ''], ['salon-public-partie', 'partie', ''], ['salon-public-discussion', 'decompte', 'chat'], ['salon-public-joueur', 'decompte', 'srvp']]
      .map(([n, ph, pane]) => [n, true, `(${srvMock})('${ph}', '${pane}')`]),
    ['multi-rejoindre', false, () => { NET.role = 'off'; ACCT.state = 'ready'; ACCT.user = ACCT.user || { username: 'Testeur_1', displayName: 'Testeur' }; uiOpen('multi', ['main']); netRender(); lmPush(LM.scr.multi, 'join'); }], // le champ du code seul, Rejoindre en jaune
    // parties publiques (serveur de jeu) : liste simulée, relecture coupée
    ['multi-publiques', false, () => {
      NET.role = 'off'; NETP.err = false; NETP.joueurs = 23; NETP.at = Date.now() + 1e9;
      NETP.list = [['KX7PQ', 'Corbeau 7', 'sable', 'tdm', 7, 'playing'], ['M4RTE', 'Lynx Du Nord', 'meltem', 'dom', 5, 'lobby'], ['ZZ8AB', 'Soldat Fantome', 'stratus', 'ffa', 4, 'playing'], ['QW3RT', 'Tigre', 'givre', 'tdm', 8, 'playing'], ['HJ5KL', 'Renard_Roux_Long', 'tephra', 'tdm', 2, 'lobby'], ['PL9MN', 'Hibou', 'embruns', 'ffa', 1, 'loading']]
        .map(([c, n, m, o, j, p]) => ({ c, n, m, o, j, x: 8, p, v: NET_PROTO }));
      uiOpen('multi', ['main']); netRender(); netPubRender();
    }],
    // salon : état simulé (hôte ou invité, joueurs, discussion), rendu par le vrai netRender ; les joueurs à droite, puis chaque sous-menu
    ...[['salon', ''], ['salon-parametres', 'setup'], ['salon-carte', 'map'], ['salon-discussion', 'chat'], ['salon-joueur', 'player'], ['salon-inviter', 'invite']].map(([n, pane]) => [n, true, `(${netMock})('host', '${pane}')`]),
    ['salon-invite', true, `(${netMock})('client', '')`],
    ['salon-invite-parametres', true, `(${netMock})('client', 'setup')`],
    // Retour dans un salon : « Quitter le salon ? » au milieu de l'écran (hôte, invité)
    ['salon-quitter', false, `(${netMock})('host', 'leave')`, '#netLeave'],
    ['salon-invite-quitter', false, `(${netMock})('client', 'leave')`, '#netLeave'],
    ['classes', true, () => uiOpen('classes', ['main'])],
    ['tenues', true, () => uiOpen('skins', ['main'])],
    // atelier de classe (src/09n-armurerie.js) : le premier emplacement personnalisé, créé le temps d'ouvrir l'écran (rien d'autre ne change) ; l'écran ne défile pas
    ['atelier', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); c.made = made; }, null, '.ars-top'],
    // sa fenêtre des camouflages (dix, dont le Holo) : tous à l'écran ou dans sa zone qui défile
    ['atelier-camos', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); arsCamoOpen(); c.made = made; }, null, '.ars-top'],
    // son onglet Séries : les séries par nombre d'éliminations à gauche, les emplacements de la classe et le détail à droite
    ['atelier-series', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); ARSUI.tab = 'k'; renderArsenal(); c.made = made; }, null, '.ars-top'],
    // son onglet Grenade : les trois types à gauche, le détail du type choisi à droite
    ['atelier-grenade', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); ARSUI.tab = 'g'; renderArsenal(); c.made = made; }, null, '.ars-top'],
    ['options', true, () => uiOpen('options', ['main'])],
    // onglet Vidéo : « Afficher les performances », « Rapport de performances », « Rapport graphique » (la liste défile, l'onglet reste à l'écran)
    ['options-video', true, () => { uiOpen('options', ['main']); const t = [...document.querySelectorAll('#optMenu [role=tab]')].find((b) => /Vid/.test(b.textContent)); if (t) t.click(); }],
    ['profil', false, () => uiOpen('profile', ['main'])],
    // compte (src/09j-compte.js) : code de secours montré une fois, mot de passe oublié, profil d'un compte qui n'a pas encore de code
    ['profil-code', false, () => { acctMockUser(true); ACCT.code = 'K7QX2-MP9WD-ABCDE-FGHJK'; ACCT.codeNote = 'Compte créé : bienvenue !'; uiOpen('profile', ['main']); acctRender(); }],
    ['profil-oubli', false, () => { acctMockUser(null); ACCT.view = 'recover'; uiOpen('profile', ['main']); acctRender(); }],
    ['profil-inscription', false, () => { acctMockUser(null); ACCT.view = 'register'; uiOpen('profile', ['main']); acctRender(); }],
    ['profil-sans-code', false, () => { acctMockUser(false); uiOpen('profile', ['main']); acctRender(); }],
    // vie sociale (src/09t-social.js) : compte et réponses du serveur simulés
    ['classement', false, () => { socMock(); uiOpen('ranking', ['main']); }],
    ['joueur', false, () => { socMock(); SOC.player = { u: 'Corbeau_7', data: null, err: '', busy: false }; uiOpen('player', ['main']); }],
    ['joueur-signaler', false, () => { socMock(); SOC.player = { u: 'Corbeau_7', data: null, err: '', busy: false, rep: { why: 'triche', note: '', err: '', busy: false, sent: false } }; uiOpen('player', ['main']); }],
    ['moderation', false, () => { socMock(); MOD.view = 'open'; uiOpen('moderation', ['main']); }],
    ['profil-moderateur', false, () => { socMock(); uiOpen('profile', ['main']); acctRender(); }],
    ['notifications', false, () => { socMock(); uiOpen('notifs', ['main']); }],
    // Communauté (src/09z-communaute.js) : avis, idées vues par l'équipe (réponse en cours), éditeur d'avis ouvert ; menu principal connecté (trois boutons en haut)
    ['communaute', false, () => { socMock(); commMock(); COMM.kind = 'avis'; uiOpen('community', ['main']); }],
    ['communaute-idees', false, () => { socMock(); commMock(); COMM.kind = 'idee'; COMM.sort = 'top'; uiOpen('community', ['main']); COMM.ans = { id: 12, kind: 'idee', status: 'prevu', reply: "Bonne idée, on la garde pour la prochaine mise à jour.", err: '', busy: false }; }],
    ['communaute-avis-ecrire', false, () => { socMock(); commMock(); COMM.kind = 'avis'; uiOpen('community', ['main']); COMM.myReview = { id: 2, rating: 4, body: "Très bon. Il manque juste un mode capture de drapeau." }; commWrite(null); }],
    ['communaute-probleme-ecrire', false, () => { socMock(); commMock(); COMM.kind = 'bug'; uiOpen('community', ['main']); commWrite(null); }],
    ['principal-connecte', true, () => { socMock(); uiOpen('main'); }],
    ['nouveautes', false, () => uiOpen('news', ['main'])],
    ['mentions', false, () => uiOpen('legal', ['main'])],
    ['pause', true, () => pause('home'), '#pause', '.pm-panel'],
    ['pause-classe', true, () => pause('class'), '#pause', '.pm-panel'],
    ['pause-options', true, () => pause('options'), '#pause', '.pm-panel'],
    // résultats d'une partie (fillEnd, acctMatchEnd, arsEndFill) : tableaux, statistiques, XP et déblocages simulés ; le corps défile, le pied (minuteur, boutons) reste à l'écran
    ['resultats', false, () => {
      document.getElementById('pause').classList.remove('show'); MATCH.state = 'playing'; MATCH.online = false; MATCH.mode = 'tdm'; MATCH.limit = 75; MATCH.score = [75, 63]; MATCH.fin = null; MATCH.time = 0;
      entities.forEach((x, i) => { x.kills = 9 - (i % 9); x.deaths = i % 4; x.score = x.kills * 100 + i * 15; x.assists = i % 3; });
      endMatch(); END.t = 60; arsShowClear();
      ARS.gain = { xp: 640, level: 13, up: 1, slots: 1 }; ARS.px = pxpForLevel(13) + 420; ACCT.state = 'ready'; acctMatchEnd('win', true);
      ARS.sess = { m4: { xp: 820, k: 9, l0: 3 }, ak47: { xp: 160, k: 2, l0: 5 } }; arsEndFill();
    }, '#end'],
    ['chargement', true, () => loading(false), '#matchload', '.ml-inner'],
    ['chargement-echec', true, () => loading(true), '#matchload', '.ml-inner'],
    ['edition-commandes', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; touchEditOpen(); touchEditSelect('fire'); }, '#touch', '#tcEd'],
    ['edition-partage', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; touchEditOpen(); touchEditSelect('knife'); TC.el.ed.querySelector('[data-ed=share]').click(); }, '#touch', '#tcEd'],
    ['montee-niveau', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; document.getElementById('ui').classList.remove('hidden'); rankUpShow(10, 2); clearTimeout(RU.t); for (const a of document.getAnimations()) if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#rankUp')) { a.pause(); a.currentTime = 2300; } }, '#rankUp'],
    // hors de la zone ronde d'une carte (src/02-relief.js, ringHud) : l'écran s'assombrit, le message et le compte à rebours
    ['hors-zone', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; document.getElementById('hud').classList.remove('hidden'); window.__hudOn = true; const el = document.getElementById('ringOut'); el.style.setProperty('--k', '0.8'); document.getElementById('ringN').textContent = '7'; el.classList.add('show'); }, '#ringOut'],
    ['deploy', true, () => { UI.flow = { online: false, map: 'sable', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']); document.getElementById('depSub').textContent = 'Khamsin · Solo'; }],
    // fenêtre « Quoi de neuf » d'une grande version (src/09f-news.js), pour un joueur qui a connu une version plus ancienne : la liste défile, ses boutons restent à l'écran
    ['quoi-de-neuf', false, () => { uiOpen('main'); localStorage.setItem('cod_seen_version', '2.29.0'); newsPopup(); }, '#whatsnew'],
    // économie d'énergie, la question du premier lancement au doigt (src/09zl-economie.js) : ses deux boutons à l'écran
    // rapport de performances d'une partie (src/09zo-perfs.js) : un long rapport simulé, son texte défile, ses boutons restent à l'écran
    ['rapport-performances', false, () => { uiOpen('main'); PFR.last = Array.from({ length: 220 }, (_, i) => i + ' 280 3.57 4.1 3.40 9.2 2.10 | 0.30 0.41 0.05 0.16 0.11 0.01 2.66 | 290 1650 0 270 high 1.00 2 0 | 0 0 0 0(0)').join('\n'); pfrShow(); }, '#gpuRep'],
    ['economie', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; uiOpen('main'); Settings.ecoAsk = true; ecoAsk(); }, '#ecoAsk'], // (la question attend le menu : la pause d'un écran précédent est refermée)
  ];
  const only = (env, k) => !process.env[env] || process.env[env].split(',').includes(k);
  for (const [w, h] of SIZES.filter(([w, h]) => only('TAILLES', w + 'x' + h))) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    for (const [name, fit, open, rootSel, panelSel] of SCREENS.filter((x) => only('ECRANS', x[0]) && (!DECK_ONLY.has(x[0]) || (w === 1280 && h === 800)))) {
      await page.evaluate(() => { if (TC.edit) touchEditClose(); rankUpClear(); if (typeof SRV !== 'undefined') { SRV.on = false; SRV.st = null; SRV.list = null; } if (typeof netMigDone === 'function') netMigDone(true); /* salon public, migration simulés par un écran : pas dans le suivant */ if (typeof DECK_UI !== 'undefined' && DECK_UI.force) { DECK_UI.force = ''; deckCard(); } if (!window.__acct0) window.__acct0 = Object.assign({}, ACCT); else Object.assign(ACCT, window.__acct0); /* chaque écran part du compte du démarrage : un compte simulé par un écran (multi-rejoindre) ne fuit plus dans le suivant (profil) */ document.getElementById('ui').classList.add('hidden'); document.getElementById('whatsnew').classList.add('hidden'); document.getElementById('netLeave').classList.add('hidden'); document.getElementById('ecoAsk').classList.add('hidden'); Settings.ecoAsk = false; document.getElementById('gpuRep').classList.add('hidden'); document.getElementById('end').classList.remove('show'); if (window.__hudOn) { document.getElementById('hud').classList.add('hidden'); document.getElementById('ringOut').classList.remove('show'); window.__hudOn = false; } /* le HUD montré par hors-zone */ });
      await page.evaluate(open);
      await page.waitForTimeout(450);
      const r = await page.evaluate(probe, [fit, rootSel || null, panelSel || null]);
      const why = [];
      const clipped = name.startsWith('chargement') || name.startsWith('pause'); // fond animé qui déborde en silence (overflow caché) ; la pause est un calque, pas un écran défilant
      if (!clipped && r.hscroll > 1) why.push(`défilement horizontal de ${r.hscroll}px`);
      if (fit && !clipped && r.vscroll > 1) why.push(`l'écran défile (${r.vscroll}px)`);
      if (fit && r.panel && r.panel.sh > r.panel.ch + 1) why.push(`panneau de droite rogné (${r.panel.sh} > ${r.panel.ch})`);
      if (fit && r.panel && r.panel.t < -0.5) why.push(`contenu coupé en haut (${Math.round(r.panel.t)}px)`);
      if (fit && r.go && (r.go.b > r.H + 0.5 || r.go.r > r.W + 0.5 || r.go.t < 0)) why.push("bouton d'action hors de l'écran");
      // la liste des réglages ne doit jamais avoir une hauteur nulle (elle l'avait dans la pause, sur téléphone)
      if (name === 'options' || name === 'pause-options') { const hh = await page.evaluate((id) => document.querySelector(id + ' .orows').getBoundingClientRect().height, name === 'options' ? '#optMenu' : '#optPause'); if (hh < 80) why.push(`liste des réglages écrasée (${Math.round(hh)} px)`); }
      if (name.startsWith('edition')) { const pb = await page.evaluate(() => { const r = document.getElementById('tcEd').getBoundingClientRect(); return { b: r.bottom, l: r.left, r: r.right, H: innerHeight, W: innerWidth }; }); if (pb.b > pb.H + 0.5 || pb.l < 0 || pb.r > pb.W + 0.5) why.push(`panneau d'édition hors de l'écran (bas ${Math.round(pb.b)} sur ${pb.H})`); }
      if (name === 'quoi-de-neuf') {
        const q = await page.evaluate(() => ({ open: !document.getElementById('whatsnew').classList.contains('hidden'), n: document.querySelectorAll('#wnList li').length, out: ['wnTitle', 'wnOk', 'wnMore'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }) }));
        if (!q.open || !q.n) why.push(`fenêtre non ouverte ou vide (${q.n} changements)`);
        if (q.out.length) why.push(`hors de l'écran : ${q.out.join(', ')}`);
      }
      if (name === 'economie') {
        const q = await page.evaluate(() => ({ open: !document.getElementById('ecoAsk').classList.contains('hidden'), out: ['ecTitle', 'ecoOn', 'ecoOff'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }) }));
        if (!q.open) why.push('fenêtre non ouverte');
        if (q.out.length) why.push(`hors de l'écran : ${q.out.join(', ')}`);
      }
      if (name === 'rapport-performances') {
        const q = await page.evaluate(() => ({ open: !document.getElementById('gpuRep').classList.contains('hidden'), n: document.getElementById('grTxt').textContent.split('\n').length, out: ['grTitle', 'grCopy', 'grClose'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }) }));
        if (!q.open || q.n < 200) why.push(`fenêtre non ouverte ou rapport absent (${q.n} lignes)`);
        if (q.out.length) why.push(`hors de l'écran : ${q.out.join(', ')}`);
      }
      if (name === 'resultats') {
        const q = await page.evaluate(() => ['againBtn', 'menuBtn', 'endTimer', 'endTitle'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }));
        if (q.length) why.push(`hors de l'écran : ${q.join(', ')}`);
      }
      if (r.cut && r.cut.length) why.push('texte coupé : ' + r.cut.slice(0, 4).join(' ; '));
      if (r.bad.length) why.push('recouvrements : ' + [...new Set(r.bad)].slice(0, 4).join(' ; '));
      ok(why.length === 0, `${w}x${h} ${name}${why.length ? ' : ' + why.join(' | ') : ''}`);
      if (out && (why.length || process.env.TOUT)) await page.screenshot({ path: path.join(out, `menu-${w}x${h}-${name}.png`) });
    }
  }
  await g.browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
