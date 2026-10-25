/* ==========================================================================
   MODÉRATION : écran réservé aux comptes de la variable MODERATION du serveur (api/_lib/moderation.js), ouvert depuis leur Profil.
   Deux listes : les comptes signalés (raisons comptées, mots des joueurs, statistiques pour juger d'une triche) et les comptes bloqués.
   Une photo signalée reste floutée jusqu'à ce qu'on la touche. Actions : ignorer (et rendre une photo masquée), retirer la photo,
   remettre le nom d'affichage au nom d'utilisateur, retirer du classement, bloquer le compte (en deux temps), débloquer.
   ========================================================================== */
const MOD = { view: 'open', items: [], open: 0, busy: false, loaded: false, err: '', ask: '', seen: new Set() };
const MOD_WHY = () => ({ nom: _t('Nom'), photo: _t('Photo'), triche: _t('Triche'), comportement: _t('Comportement') });

function modLoad() {
  if (MOD.busy) return;
  MOD.busy = true; MOD.err = ''; modRender();
  acctApi('mod-list' + (MOD.view === 'blocked' ? '?view=blocked' : '')).then((r) => {
    MOD.busy = false;
    if (r.ok && r.data) { MOD.items = r.data.accounts; MOD.open = r.data.open; MOD.loaded = true; if (ACCT.user) ACCT.user.modOpen = r.data.open; }
    else MOD.err = socErr(r);
    if (UI.screen === 'moderation') modRender();
  });
}
async function modDo(username, action) {
  if (MOD.busy) return;
  if (action === 'block' && MOD.ask !== username) { MOD.ask = username; sfxUi('click'); modRender(); return; } // bloquer : confirmé par un second toucher
  MOD.ask = ''; MOD.busy = true; modRender();
  const r = await acctApi('mod-action', { username, action });
  MOD.busy = false;
  if (!r.ok) { MOD.err = socErr(r); modRender(); return; }
  sfxUi(action === 'ignore' || action === 'unblock' ? 'click' : 'back');
  modLoad();
}
function modRender() {
  const body = $('mdBody'); if (!body) return;
  if (!ACCT.user || !ACCT.user.moderator) { body.innerHTML = `<p class="hint">${_t('Réservé à la modération.')}</p>`; return; }
  $('mdSub').textContent = MOD.view === 'blocked' ? _t('Comptes bloqués') : MOD.open ? _tn(MOD.open, '{0} compte signalé', '{0} comptes signalés') : _t('Aucun signalement en attente');
  const W = MOD_WHY(), when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : fmtDate(d, { day: 'numeric', month: 'short' }); };
  const cards = MOD.items.map((a) => {
    const flou = (a.avatarHidden || a.reasons.photo) && !MOD.seen.has(a.username), S = a.stats;
    const kd = (k, d) => (d ? k / d : k).toFixed(2);
    const why = Object.entries(a.reasons).map(([k, n]) => `<span class="md-why">${esc(W[k] || k)} × ${n}</span>`).join('');
    const notes = a.notes.map((x) => `<li><b>${esc(x.by || '?')}</b> <small>${esc(W[x.reason] || x.reason)} · ${esc(when(x.at))}</small><br>« ${esc(x.note)} »</li>`).join('');
    const b = (act, label, cls = '') => `<button class="btn ${cls}" type="button" data-md="${act}" data-u="${esc(a.username)}"${MOD.busy ? ' disabled' : ''}>${label}</button>`;
    const acts = a.blockedAt ? b('unblock', _t('Débloquer'))
      : b('ignore', a.avatarHidden ? _t('Ignorer et rendre la photo') : _t('Ignorer')) + (a.avatar ? b('photo', _t('Retirer la photo')) : '')
        + (a.displayName !== a.username ? b('name', _t('Remettre le nom')) : '') + (S.xp && !a.removed ? b('board', _t('Retirer du classement')) : '')
        + b('block', MOD.ask === a.username ? _t('Confirmer le blocage') : _t('Bloquer le compte'), MOD.ask === a.username ? 'warn' : '');
    return `<div class="card md-acc">
      <div class="md-top"><button class="md-av${flou ? ' flou' : ''}" type="button" data-see="${esc(a.username)}" aria-label="${esc(flou ? _t('Voir la photo') : _t('Photo de profil'))}"><span class="acct-av" data-u="${esc(a.username)}" data-n="${esc(a.displayName)}">${socAv(a.username, a.displayName, a.avatar)}</span>${flou ? `<em>${_t('Voir')}</em>` : ''}</button>
        <div class="md-id"><b>${esc(a.displayName)}</b><small>@${esc(a.username)} · ${_t('Niveau {0}', a.level)} · ${_t('Inscrit le {0}', esc(when(a.createdAt)))}${a.blockedAt ? ' · ' + _t('bloqué le {0}', esc(when(a.blockedAt))) : ''}</small>
          <small>${_t('{0} XP, {1} parties, ratio {2}', fmtNum(S.xp), S.matches, kd(S.kills, S.deaths))}${a.removed ? ' · ' + _t('retiré du classement') : ''}</small></div></div>
      ${why ? `<p class="md-whys">${why}${a.avatarHidden ? `<span class="md-why hid">${_t('photo masquée')}</span>` : ''}</p>` : ''}
      ${notes ? `<ul class="md-notes">${notes}</ul>` : ''}
      <div class="btns md-acts">${acts}</div></div>`;
  }).join('');
  const empty = MOD.loaded && !MOD.items.length && !MOD.busy ? `<div class="card"><p class="hint">${MOD.view === 'blocked' ? _t('Aucun compte bloqué.') : _t('Aucun signalement en attente.')}</p></div>` : '';
  body.innerHTML = `<div class="rk-bar"><div class="seg" id="mdView" role="radiogroup" aria-label="${esc(_t('Liste à afficher'))}"></div><button class="btn" type="button" id="mdReload">${_t('Actualiser')}</button></div>
    ${MOD.err ? `<p class="ac-err" role="alert">${esc(MOD.err)}</p>` : ''}${cards ? `<div class="md-list">${cards}</div>` : ''}${empty}${MOD.busy && !MOD.items.length ? `<p class="hint">${_t('Chargement...')}</p>` : ''}`;
  seg($('mdView'), [['open', _t('Signalés')], ['blocked', _t('Bloqués')]], () => MOD.view, (v) => { MOD.view = v; MOD.items = []; MOD.loaded = false; MOD.ask = ''; modLoad(); });
  $('mdReload').addEventListener('click', () => { sfxUi('click'); modLoad(); });
  socAvFallback(body);
}
function modBind() {
  const body = $('mdBody'); if (body._md) return; body._md = true;
  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-md]'); if (a && !a.disabled) { modDo(a.dataset.u, a.dataset.md); return; }
    const s = e.target.closest('[data-see]'); if (s) { const u = s.dataset.see; if (MOD.seen.has(u)) MOD.seen.delete(u); else MOD.seen.add(u); sfxUi('click'); modRender(); }
  });
}
function modScreen() { modBind(); MOD.ask = ''; MOD.err = ''; modLoad(); }
