/* ==========================================================================
   COMMUNAUTÉ : avis sur le jeu, idées et problèmes (serveur : api/_lib/communaute.js ; README « Communauté »)
   Écran ouvert par le bouton Communauté en haut du menu principal (joueurs connectés). Trois onglets :
   - Avis : la note moyenne, puis les avis (étoiles et quelques mots). « Donner mon avis » après une partie jouée, un seul par joueur ;
     le redonner le modifie.
   - Idées et Problèmes : les plus appuyés d'abord (ou les plus récents). « Moi aussi » appuie un message, un second toucher le retire.
   Chaque message peut être signalé ; son auteur le modifie ou l'efface. Pas de discussion entre joueurs : sous un message, seule l'équipe
   (les comptes de la modération) répond. Elle donne aussi un état à une idée ou à un problème (prévu, fait), masque, rétablit ou efface
   un message, et voit à part les messages signalés (onglet Signalés). L'auteur est prévenu d'une réponse (notification comm_reply).
   ========================================================================== */
const COMM = { kind: 'avis', sort: 'top', posts: [], more: false, busy: false, seq: 0, loaded: false, err: '', summary: null, myReview: null, canReview: false, mod: false, reported: 0, edit: null, ans: null, ask: '' };
const COMM_MAX = 500;
const COMM_STAR = '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>';
// état donné par l'équipe : une idée est prévue puis ajoutée, un problème pris en compte puis corrigé
const commState = (kind, s) => (s === 'prevu' ? (kind === 'bug' ? _t('Pris en compte') : _t('Prévue')) : s === 'fait' ? (kind === 'bug' ? _t('Corrigé') : _t('Ajoutée au jeu')) : '');
function commStars(n, cls) {
  let h = ''; for (let i = 1; i <= 5; i++) h += `<svg viewBox="0 0 24 24" class="${i <= n ? 'on' : ''}" aria-hidden="true">${COMM_STAR}</svg>`;
  return `<span class="cm-stars${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(_tn(n, '{0} étoile sur 5', '{0} étoiles sur 5'))}">${h}</span>`;
}

function commLoad(reset) {
  const seq = ++COMM.seq; // un changement d'onglet pendant un chargement : seule la dernière réponse compte
  if (reset) { COMM.posts = []; COMM.more = false; COMM.ask = ''; COMM.ans = null; }
  COMM.busy = true; COMM.err = ''; commRender();
  const qs = new URLSearchParams(COMM.kind === 'reported' ? { view: 'reported' } : { kind: COMM.kind, sort: COMM.sort });
  qs.set('offset', String(reset ? 0 : COMM.posts.length));
  acctApi('community?' + qs).then((r) => {
    if (seq !== COMM.seq) return;
    COMM.busy = false;
    if (!r.ok || !r.data) COMM.err = socErr(r);
    else {
      const d = r.data;
      COMM.posts = reset ? d.posts : COMM.posts.concat(d.posts); COMM.more = d.more; COMM.summary = d.summary; COMM.myReview = d.myReview;
      COMM.canReview = d.canReview; COMM.mod = d.mod; COMM.reported = d.reported || 0; COMM.loaded = true;
      if (COMM.kind === 'reported' && !d.mod) COMM.kind = 'avis';
    }
    if (UI.screen === 'community') commRender();
  });
}

/* Ouvre l'éditeur : son avis (prérempli), une nouvelle idée ou un nouveau problème, ou la modification de l'un d'eux (id) */
function commWrite(p) {
  const k = p ? p.kind : COMM.kind, my = k === 'avis' ? COMM.myReview : null;
  COMM.edit = { id: p && k !== 'avis' ? p.id : null, kind: k, rating: my ? my.rating : 0, body: p ? p.body : my ? my.body : '', err: '', busy: false };
  COMM.ans = null; COMM.ask = ''; sfxUi('click'); commRender();
  // au doigt, pas de focus d'office : le clavier de l'écran couvrirait tout (comme à l'arrivée sur un écran, uiGo)
  requestAnimationFrame(() => { const t = $('cmText'); if (!t) return; t.closest('.card').scrollIntoView({ block: 'nearest' }); if (!TOUCH.on || PAD.drive) t.focus({ preventScroll: true }); });
}
async function commSend() {
  const E = COMM.edit; if (!E || E.busy) return;
  if (E.kind === 'avis' && !E.rating) { E.err = _t('Choisissez une note de 1 à 5 étoiles.'); commRender(); return; }
  E.busy = true; E.err = ''; commRender();
  const r = await acctApi('community-post', { kind: E.kind, body: E.body, rating: E.rating || undefined, id: E.id || undefined });
  E.busy = false;
  if (!r.ok) { E.err = socErr(r); commRender(); return; }
  sfxUi('click'); COMM.edit = null;
  if (E.kind !== 'avis' && !E.id) COMM.sort = 'new'; // un nouveau message se retrouve en tête
  commLoad(true);
}
async function commAct(act, id) {
  const p = COMM.posts.find((x) => String(x.id) === String(id));
  if (act === 'write') { commWrite(null); return; }
  if (act === 'more') { commLoad(false); return; }
  if (act === 'cancel') { COMM.edit = null; sfxUi('back'); commRender(); return; }
  if (act === 'send') { commSend(); return; }
  if (!p) return;
  if (act === 'edit') { commWrite(p); return; }
  if (act === 'del' && COMM.ask !== 'del' + p.id) { COMM.ask = 'del' + p.id; sfxUi('click'); commRender(); return; } // effacer : confirmé par un second toucher
  if (act === 'answer') { COMM.ans = { id: p.id, kind: p.kind, status: p.status || '', reply: p.reply ? p.reply.text : '', err: '', busy: false }; COMM.edit = null; sfxUi('click'); commRender(); return; }
  if (act === 'ans-no') { COMM.ans = null; sfxUi('back'); commRender(); return; }
  COMM.ask = '';
  let r;
  if (act === 'vote') {
    r = await acctApi('community-vote', { id: p.id });
    if (r.ok) { p.voted = r.data.voted; p.votes = r.data.votes; sfxUi('click'); commRender(); return; }
  } else if (act === 'report') {
    r = await acctApi('community-report', { id: p.id });
    if (r.ok) { p.flagged = true; sfxUi('click'); commRender(); return; }
  } else if (act === 'del') {
    r = await acctApi('community-delete', { id: p.id });
    if (r.ok) { sfxUi('back'); if (p.kind === 'avis' && p.mine) COMM.myReview = null; commLoad(true); return; }
  } else if (act === 'ans-go') {
    const A = COMM.ans; if (!A || A.busy) return;
    A.busy = true; commRender();
    r = await acctApi('community-mod', { id: p.id, action: 'answer', status: A.status || null, reply: A.reply });
    A.busy = false;
    if (r.ok) { COMM.ans = null; sfxUi('click'); commLoad(true); return; }
    A.err = socErr(r); commRender(); return;
  } else if (act === 'hide' || act === 'show') {
    r = await acctApi('community-mod', { id: p.id, action: act });
    if (r.ok) { sfxUi('click'); commLoad(true); return; }
  } else return;
  COMM.err = socErr(r); commRender();
}

function commPostHtml(p) {
  const A = COMM.ans && String(COMM.ans.id) === String(p.id) ? COMM.ans : null, state = commState(p.kind, p.status), mod = COMM.mod;
  const b = (act, label, cls = '', dis = false) => `<button class="btn${cls ? ' ' + cls : ''}" type="button" data-cm="${act}" data-id="${p.id}"${dis ? ' disabled' : ''}>${label}</button>`;
  let acts = '';
  if (p.kind !== 'avis') acts += p.mine ? `<span class="soc-tag">${esc(_tn(p.votes, '{0} appui', '{0} appuis'))}</span>`
    : `<button class="btn cm-vote${p.voted ? ' on' : ''}" type="button" data-cm="vote" data-id="${p.id}" aria-pressed="${p.voted}"${p.hidden && !mod ? ' disabled' : ''}>${_t('Moi aussi')}<b>${p.votes}</b></button>`;
  if (p.mine) acts += b('edit', _t('Modifier'));
  else acts += p.flagged ? `<span class="soc-tag">${_t('Signalé')}</span>` : b('report', _t('Signaler'));
  if (mod) acts += b('answer', p.reply || p.status ? _t('Modifier la réponse') : _t('Répondre')) + (p.hidden ? b('show', _t('Rétablir')) : b('hide', _t('Masquer')));
  if (p.mine || mod) acts += COMM.ask === 'del' + p.id ? b('del', _t('Confirmer'), 'warn') : b('del', _t('Effacer'));
  const tags = (state ? `<span class="soc-tag ok">${esc(state)}</span>` : '') + (p.hidden ? `<span class="soc-tag">${_t('Masqué')}</span>` : '')
    + (mod && p.reports ? `<span class="soc-tag">${esc(_tn(p.reports, '{0} signalement', '{0} signalements'))}</span>` : '') + (COMM.kind === 'reported' ? `<span class="soc-tag">${esc({ avis: _t('Avis'), idee: _t('Idée'), bug: _t('Problème') }[p.kind] || '')}</span>` : '');
  const ans = A ? `<div class="cm-ans">${p.kind !== 'avis' ? '<div class="seg" id="cmAnsState" role="radiogroup"></div>' : ''}
      <textarea id="cmAnsText" maxlength="${COMM_MAX}" rows="3" placeholder="${esc(_t('Réponse de l\u0027équipe (facultative)'))}" aria-label="${esc(_t('Réponse de l\u0027équipe'))}">${esc(A.reply)}</textarea>
      <p class="ac-err" role="alert">${esc(A.err)}</p>
      <div class="btns"><button class="btn primary" type="button" data-cm="ans-go" data-id="${p.id}"${A.busy ? ' disabled' : ''}>${_t('Enregistrer')}</button><button class="btn" type="button" data-cm="ans-no" data-id="${p.id}">${_t('Annuler')}</button></div></div>` : '';
  return `<article class="card cm-post${p.hidden ? ' hid' : ''}${p.mine ? ' me' : ''}">
    <div class="cm-head"><button class="cm-who" type="button" data-open="${esc(p.author.username)}" aria-label="${esc(_t('Profil de {0}', p.author.displayName))}"><span class="acct-av" data-u="${esc(p.author.username)}" data-n="${esc(p.author.displayName)}">${socAv(p.author.username, p.author.displayName, p.author.avatar)}</span>
      <span class="cm-id"><b>${esc(p.author.displayName)}</b><small>${esc(socAgo(p.at))}${p.edited ? ' · ' + _t('modifié') : ''}</small></span></button>
      ${p.kind === 'avis' && p.rating ? commStars(p.rating) : ''}${tags ? `<span class="cm-tags">${tags}</span>` : ''}</div>
    ${p.body ? `<p class="cm-body">${esc(p.body)}</p>` : ''}
    ${p.reply ? `<div class="cm-reply"><b>${_t('Réponse de l\u0027équipe')}</b><p>${esc(p.reply.text)}</p></div>` : ''}
    <div class="cm-acts">${acts}</div>${ans}</article>`;
}
function commEditHtml() {
  const E = COMM.edit, k = E.kind;
  const title = k === 'avis' ? (COMM.myReview ? _t('Modifier mon avis') : _t('Donner mon avis')) : E.id ? _t('Modifier le message') : k === 'idee' ? _t('Proposer une idée') : _t('Signaler un problème');
  const hint = k === 'avis' ? _t('Votre note et quelques mots sur le jeu. Les joueurs connectés les verront avec votre nom.')
    : k === 'idee' ? _t('Une idée par message. Les autres joueurs pourront l\u0027appuyer.') : _t('Dites ce qui se passe, sur quelle carte et sur quel appareil.');
  const ph = k === 'avis' ? _t('Ce que vous en pensez (facultatif)') : k === 'idee' ? _t('Votre idée') : _t('Le problème rencontré');
  let stars = '';
  if (k === 'avis') for (let n = 1; n <= 5; n++) stars += `<button class="cm-star${n <= E.rating ? ' on' : ''}" type="button" data-star="${n}" role="radio" aria-checked="${n === E.rating}" aria-label="${esc(_tn(n, '{0} étoile', '{0} étoiles'))}"><svg viewBox="0 0 24 24" aria-hidden="true">${COMM_STAR}</svg></button>`;
  return `<div class="card cm-edit"><h3 class="lbl">${title}</h3>${stars ? `<div class="cm-pick" role="radiogroup" aria-label="${esc(_t('Note'))}">${stars}</div>` : ''}
    <p class="hint">${hint}</p>
    <textarea id="cmText" maxlength="${COMM_MAX}" rows="4" placeholder="${esc(ph)}" aria-label="${esc(title)}">${esc(E.body)}</textarea>
    <p class="cm-count" id="cmCount">${E.body.length} / ${COMM_MAX}</p>
    <p class="ac-err" role="alert">${esc(E.err)}</p>
    <div class="btns"><button class="btn primary" type="button" data-cm="send"${E.busy ? ' disabled' : ''}>${_t('Publier')}</button><button class="btn" type="button" data-cm="cancel">${_t('Annuler')}</button></div></div>`;
}
function commRender() {
  const body = $('cmBody'); if (!body) return;
  if (!ACCT.user) { body.innerHTML = `<div class="card"><p class="hint">${_t('Connectez-vous pour lire les avis des joueurs et donner le vôtre.')}</p></div>`; return; }
  const k = COMM.kind, S = COMM.summary;
  let write = '';
  if (k === 'avis') write = COMM.canReview ? `<button class="btn primary" type="button" data-cm="write">${COMM.myReview ? _t('Modifier mon avis') : _t('Donner mon avis')}</button>` : COMM.loaded ? `<p class="hint">${_t('Jouez une partie pour donner votre avis.')}</p>` : '';
  else if (k !== 'reported') write = `<button class="btn primary" type="button" data-cm="write">${k === 'idee' ? _t('Proposer une idée') : _t('Signaler un problème')}</button>`;
  if (COMM.edit) write = '';
  const sum = k === 'avis' && S && S.count ? `<div class="card cm-sum"><b class="cm-avg">${fmtNum(S.avg, 1)}</b><div>${commStars(Math.round(S.avg), 'big')}<small>${esc(_tn(S.count, 'Un avis', '{0} avis'))}</small></div></div>` : '';
  const empty = { avis: _t('Aucun avis pour le moment.'), idee: _t('Aucune idée pour le moment.'), bug: _t('Aucun problème signalé pour le moment.'), reported: _t('Aucun message signalé.') }[k];
  const list = COMM.posts.map(commPostHtml).join('');
  body.innerHTML = `<div class="rk-bar"><div class="seg" id="cmTabs" role="radiogroup" aria-label="${esc(_t('Messages à afficher'))}"></div>${k === 'idee' || k === 'bug' ? `<div class="seg" id="cmSort" role="radiogroup" aria-label="${esc(_t('Ordre'))}"></div>` : ''}${write}</div>
    ${COMM.edit ? commEditHtml() : ''}<p class="ac-err" role="alert">${esc(COMM.err)}</p>${sum}
    ${list ? `<div class="cm-list">${list}</div>` : COMM.loaded && !COMM.busy ? `<div class="card"><p class="hint">${empty}</p></div>` : ''}
    ${COMM.busy ? `<p class="hint">${_t('Chargement...')}</p>` : ''}${COMM.more && !COMM.busy ? `<div class="btns"><button class="btn" type="button" data-cm="more">${_t('Voir plus')}</button></div>` : ''}
    ${COMM.loaded && !COMM.more ? `<p class="hint cm-rules">${_t('Restez courtois. Les liens et la publicité ne sont pas acceptés. Un message signalé par plusieurs joueurs est masqué en attendant l\u0027équipe.')}</p>` : ''}`;
  const tabs = [['avis', _t('Avis')], ['idee', _t('Idées')], ['bug', _t('Problèmes')]];
  if (COMM.mod) tabs.push(['reported', COMM.reported ? _t('Signalés ({0})', COMM.reported) : _t('Signalés')]);
  seg($('cmTabs'), tabs, () => COMM.kind, (v) => { COMM.kind = v; COMM.edit = null; commLoad(true); });
  if ($('cmSort')) seg($('cmSort'), [['top', _t('Populaires')], ['new', _t('Récents')]], () => COMM.sort, (v) => { COMM.sort = v; commLoad(true); });
  if ($('cmAnsState') && COMM.ans) { const A = COMM.ans; seg($('cmAnsState'), [['', _t('Sans état')], ['prevu', commState(A.kind, 'prevu')], ['fait', commState(A.kind, 'fait')]], () => A.status, (v) => { A.status = v; }); }
  socAvFallback(body);
}
function commBind() {
  const body = $('cmBody'); if (body._cm) return; body._cm = true;
  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cm]'); if (a && !a.disabled) { commAct(a.dataset.cm, a.dataset.id); return; }
    const s = e.target.closest('[data-star]'); if (s && COMM.edit) { COMM.edit.rating = +s.dataset.star; COMM.edit.err = ''; sfxUi('click'); commRender(); requestAnimationFrame(() => { const b = body.querySelector(`[data-star="${COMM.edit && COMM.edit.rating}"]`); if (b) b.focus({ preventScroll: true }); }); return; }
    const o = e.target.closest('[data-open]'); if (o) socOpenPlayer(o.dataset.open);
  });
  body.addEventListener('input', (e) => {
    if (e.target.id === 'cmText' && COMM.edit) { COMM.edit.body = e.target.value; $('cmCount').textContent = `${e.target.value.length} / ${COMM_MAX}`; }
    else if (e.target.id === 'cmAnsText' && COMM.ans) COMM.ans.reply = e.target.value;
  });
}
/* Ouvre l'écran sur un onglet (la notification d'une réponse de l'équipe ouvre celui du message) */
function commOpen(kind) { if (kind) COMM.kind = kind; sfxUi('click'); uiGo('community'); }
function commScreen() { commBind(); COMM.edit = null; COMM.ans = null; COMM.ask = ''; commLoad(true); }
