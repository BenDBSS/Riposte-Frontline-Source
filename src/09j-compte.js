/* ==========================================================================
   COMPTES ET PROGRESSION
   Le serveur (api/, fonctions Vercel + base Postgres) tient les comptes : nom d'utilisateur unique (l'identifiant public, fixe),
   nom d'affichage modifiable, mot de passe et code de secours (hachés), niveau et statistiques. Aucune adresse e-mail ni autre donnée
   qui identifie la personne : le code de secours, montré une seule fois, est le seul moyen de retrouver un mot de passe oublié.
   Ce fichier est la partie du jeu :
   - connexion (nom d'utilisateur), création de compte (ouvert aussitôt), mot de passe oublié (nom, code de secours, nouveau mot de passe) ;
   - écran du code de secours (acctShowCode) : à l'inscription, à la première connexion d'un compte qui n'en avait pas, après une
     récupération et quand le joueur en demande un nouveau ; il passe avant tout le reste jusqu'à ce que le joueur dise l'avoir noté ;
   - écran Profil : niveau, statistiques, dernières parties, nom d'affichage, mot de passe, code de secours, export des données (RGPD),
     suppression du compte ; textes légaux dans 09k-legal.js ;
   - compte obligatoire pour le multijoueur (le Solo reste ouvert à tous) ; sans serveur de comptes (page ouverte depuis un
     fichier, serveur injoignable), rien n'est exigé ;
   - suivi des parties : un jeton à l'ouverture (match-start), un résumé à la fin (match-end) ; le serveur borne ce résumé par la
     durée réelle et calcule seul l'XP, le jeu n'annonce jamais de points.
   ========================================================================== */
const ACCT = {
  state: 'init', // init, ready (serveur joignable) ou off (comptes indisponibles : rien n'est exigé)
  user: null, level: null, stats: null, recent: [],
  view: 'login', err: '', note: '', busy: false, match: null, salon: '', ready: null, draft: {},
  code: '', codeNote: '', codeThen: null, // code de secours à montrer (voir acctShowCode), annonce au-dessus, suite une fois noté
};

/* Mémoire de l'appareil : le dernier compte connecté (nom, nom d'affichage, niveau, photo). Elle fait reconnaître le joueur aussitôt, avant la réponse du
   serveur ou si celui-ci tousse, et lui laisse son nom à la connexion ; on = false après une déconnexion voulue ou une session expirée. La session elle-même
   est un cookie du serveur, prolongé à chaque visite (api/_lib/handlers.js, renewSession). */
const ACCT_KEY = 'dc_acct';
function acctHint() { try { const h = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null'); return h && typeof h.u === 'string' && typeof h.n === 'string' ? h : null; } catch (e) { return null; } }
function acctHintSet(h) { try { if (h) localStorage.setItem(ACCT_KEY, JSON.stringify(h)); else localStorage.removeItem(ACCT_KEY); } catch (e) { /* ignoré */ } }

/* Appel de l'API : { ok, status, data } ; jamais d'exception (réseau coupé : status 0) */
async function acctApi(name, body, ms = 12000) {
  if (location.protocol === 'file:') return { ok: false, status: 0, data: null };
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('/api/' + name, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: ctl.signal,
      headers: body === undefined ? { 'X-Lang': LANG } : { 'Content-Type': 'application/json', 'X-Lang': LANG }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null; try { data = await r.json(); } catch (e) { /* réponse sans corps */ }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, status: 0, data: null }; } finally { clearTimeout(to); }
}
function acctApply(d) {
  ACCT.user = d.user || null; ACCT.level = d.level || null; ACCT.stats = d.stats || null; ACCT.recent = d.recent || [];
  if (ACCT.user) acctHintSet({ u: ACCT.user.username, n: ACCT.user.displayName, l: ACCT.level ? ACCT.level.level : 1, a: ACCT.user.avatar || 0, on: true });
  if (ACCT.user && ARS.synced !== ACCT.user.username) { ARS.synced = ACCT.user.username; arsSync(); } // progression des armes du compte, une fois par connexion
}
function acctForget() { ACCT.user = null; ACCT.level = null; ACCT.stats = null; ACCT.recent = []; ACCT.view = 'login'; }
async function acctLoad() {
  let r = await acctApi('me');
  // serveur qui se réveille, réseau qui tousse : on réessaie avant de déclarer les comptes indisponibles
  for (const wait of [1200, 3500]) { if (r.ok || (r.status > 0 && r.status < 500) || location.protocol === 'file:') break; await new Promise((x) => setTimeout(x, wait)); r = await acctApi('me'); }
  const h = acctHint();
  if (r.ok && r.data) {
    ACCT.state = 'ready'; acctApply(r.data);
    if (!ACCT.user && h) { // plus de session : on garde son nom sous la main, et on lui dit pourquoi
      if (h.on) { acctHintSet({ ...h, on: false }); if (!ACCT.note) ACCT.note = _t('Votre session a expiré. Reconnectez-vous.'); }
      if (!ACCT.draft.u) ACCT.draft = { ...ACCT.draft, u: h.u };
    }
  } else if (ACCT.state !== 'ready') { ACCT.state = 'off'; ACCT.user = null; } // (déjà connecté et serveur injoignable un instant : on garde ce que l'on sait)
  acctChanged();
  return r.ok;
}
/* Le nom d'affichage sert de pseudo en ligne ; le menu principal et l'écran qui est ouvert suivent */
function acctChanged() {
  acctChip(); socChanged();
  classFix(); if (UI.screen === 'classes') classesHeader(); PICKERS.forEach(renderPicker); // le niveau du compte débloque des classes personnalisées
  acctSyncMulti(); netLevelSync(); if (UI.screen === 'multi') netRender(); // (le niveau, monté après une partie, est annoncé au salon)
  if (UI.screen === 'profile') acctRender();
  skinAcct(); // une tenue unique ne se porte qu'avec son compte (09u-tenues.js)
}

/* Puce du menu principal, en haut à droite : « Se connecter » sans compte, sinon l'avatar, le nom d'affichage et le niveau (clic : Profil) */
const AC_SILHOUETTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Zm0 2.3c-4.2 0-8 2.2-8 5.4 0 .6.4 1.1 1 1.1h14c.6 0 1-.5 1-1.1 0-3.2-3.8-5.4-8-5.4Z"/></svg>';
/* Avatar : la photo de profil du joueur (voir 09p-avatar.js), sinon une teinte tirée de son nom d'utilisateur et son initiale */
function acctAvatar(user, level) {
  if (!user) return `<span>${AC_SILHOUETTE}</span>`;
  if (user.avatar) return `<img src="/api/avatar?${user.other ? `u=${encodeURIComponent(user.username)}&` : ''}v=${user.avatar}" alt="" draggable="false" loading="lazy">${level ? `<i>${level}</i>` : ''}`;
  let h = 0; for (const c of String(user.username)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `<span style="background:linear-gradient(145deg,hsl(${hue} 52% 62%),hsl(${(hue + 40) % 360} 46% 40%))">${esc(String(user.displayName || '').trim().charAt(0).toUpperCase() || '?')}</span>${level ? `<i>${level}</i>` : ''}`;
}
/* Photo illisible (réseau coupé, session expirée) : on retombe sur l'initiale */
function acctAvatarFallback(box, u, level) {
  const im = box.querySelector('img');
  if (im) im.addEventListener('error', () => { box.innerHTML = acctAvatar({ ...u, avatar: null }, level); }, { once: true });
}
function acctChip() {
  const chip = $('acctChip'); if (!chip) return;
  // pas encore de réponse du serveur (ou serveur injoignable) : le joueur déjà connecté sur cet appareil est reconnu d'après la mémoire de l'appareil
  const h = !ACCT.user && ACCT.state !== 'ready' ? acctHint() : null, known = h && h.on ? { username: h.u, displayName: h.n, avatar: h.a } : null;
  const u = ACCT.user || known, lv = ACCT.user ? (ACCT.level ? ACCT.level.level : 1) : known ? h.l : 0;
  chip.classList.toggle('out', !u);
  $('acctAv').innerHTML = acctAvatar(u, lv);
  acctAvatarFallback($('acctAv'), u, lv);
  $('acctName').textContent = u ? u.displayName : ACCT.state === 'off' ? _t('Profil') : _t('Se connecter');
  $('acctSub').textContent = ACCT.user ? (ACCT.user.hasRecovery === false ? _t('Niveau {0} · créez votre code de secours', lv) : _t('Niveau {0} · voir mon profil', lv)) : known ? (ACCT.state === 'off' ? _t('Compte injoignable pour le moment') : _t('Connexion en cours...')) : ACCT.state === 'off' ? _t('Comptes indisponibles ici') : _t('Niveau, statistiques et multijoueur');
  chip.setAttribute('aria-label', u ? `${_t('Profil de {0}, niveau {1}', u.displayName, lv)}` : _t('Se connecter'));
}

/* ---------- Multijoueur : compte obligatoire ---------- */
function acctOnlineOk() { return ACCT.state === 'off' || !!ACCT.user; }
/* Barre le salon à qui n'est pas connecté ; le pseudo en ligne est celui du compte */
function acctSyncMulti() {
  const nm = $('netName');
  if (nm) { nm.readOnly = !!ACCT.user; nm.title = ACCT.user ? _t('Votre nom d\u0027affichage (à changer dans Profil)') : ''; if (ACCT.user) nm.value = ACCT.user.displayName; }
}
/* Appelé avant de créer ou de rejoindre un salon : renvoie false (et ouvre le Profil) si la connexion manque */
function acctGate(code) {
  if (acctOnlineOk()) return true;
  if (code) ACCT.salon = code;
  ACCT.note = code ? `${_t('Connectez-vous pour rejoindre le salon {0}.', code)}` : _t('Connectez-vous pour jouer en ligne.');
  ACCT.view = 'login';
  if (MATCH.state === 'menu') uiGo('profile');
  return false;
}
/* Lien d'invitation : on attend de savoir si le joueur est connecté */
function acctWhenReady(fn) { (ACCT.ready || Promise.resolve()).then(fn); }

/* ---------- Écran Profil ---------- */
const AC_ERR = { 0: _t('Serveur injoignable : réessayez dans un instant.') };
function acctRefreshScreen() {
  if (ACCT.noteSeen) { ACCT.note = ''; ACCT.noteSeen = false; } // une annonce du profil ne reste affichée qu'une visite
  if (ACCT.state === 'ready' && !ACCT.busy) acctLoad();
  acctRender();
}
function acctRender() {
  const body = $('acBody'); if (!body) return;
  const sub = $('acSub');
  $('scr-profile').classList.toggle('ac-coding', !!ACCT.code); // écran du code : pas de bouton Retour (voir uiBack)
  if (ACCT.state === 'init') { sub.textContent = _t('Compte et progression'); body.innerHTML = _t('<p class="hint">Chargement du profil...</p>'); return; }
  if (ACCT.state === 'off') {
    sub.textContent = _t('Comptes indisponibles'); body.innerHTML = _t('<div class="card"><p class="hint">Les comptes ne sont pas joignables depuis cette page (page ouverte depuis un fichier, ou serveur injoignable). Vous pouvez jouer sans compte. La progression n\u0027est pas enregistrée.</p><button class="btn" id="acRetry" type="button">Réessayer</button></div>');
    $('acRetry').addEventListener('click', async () => { await acctLoad(); acctRender(); });
    return;
  }
  if (ACCT.code) return acctRenderCode(body, sub);
  if (!ACCT.user) return acctRenderAuth(body, sub);
  acctRenderProfile(body, sub);
}
/* Formulaire : envoi sans rechargement, bouton bloqué pendant l'appel */
function acctForm(form, onSubmit) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (ACCT.busy) return;
    ACCT.busy = true; ACCT.err = ''; const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try { await onSubmit(new FormData(form)); } finally { ACCT.busy = false; if (btn.isConnected) btn.disabled = false; }
  });
}
function acctFail(r, id = 'acErr') {
  ACCT.err = (r.data && r.data.error) || AC_ERR[r.status] || _t('Une erreur est survenue.');
  const el = $(id); if (el) el.textContent = ACCT.err;
  sfxUi('error');
}
function acctGo(view, extra = {}) { ACCT.view = view; ACCT.err = ''; Object.assign(ACCT, extra); acctRender(); sfxUi('click'); }
/* Case des conditions : les liens ouvrent les textes sans perdre la saisie */
function acctAcceptHtml(checked) {
  return `<label class="ac-check"><input type="checkbox" name="accept"${checked ? ' checked' : ''} required><span>${_t('J\u0027ai 15 ans au moins et j\u0027accepte les')} <button class="link" type="button" data-legal="terms">${_t('conditions d\u0027utilisation')}</button> ${_t('et la')} <button class="link" type="button" data-legal="privacy">${_t('politique de confidentialité')}</button>.</span></label>`;
}
function acctLegalLinks(body, form) {
  for (const b of body.querySelectorAll('[data-legal]')) b.addEventListener('click', () => {
    if (form) { const fd = new FormData(form); ACCT.draft = { u: fd.get('u') || '', a: !!fd.get('accept') }; }
    legalGo(b.dataset.legal);
  });
}
/* Après la connexion ou l'inscription : le salon qui l'attendait (lien d'invitation, menu Multijoueur) */
function acctSalonGo() { if (ACCT.salon) { const c = ACCT.salon; ACCT.salon = ''; uiGo('multi', false); netJoinCode(c); } }
function acctRenderAuth(body, sub) {
  const v = ACCT.view, d = ACCT.draft || {};
  const note = ACCT.note ? `<p class="ac-note" role="status">${esc(ACCT.note)}</p>` : '';
  const side = `<div class="card"><h3 class="lbl">${_t('Pourquoi un compte ?')}</h3>
      <p class="hint">${_t('Votre niveau, votre expérience et vos statistiques vous suivent d\u0027un appareil à l\u0027autre. Le multijoueur demande un compte. Le Solo se joue sans, mais rien n\u0027y est enregistré.')}</p>
      <p class="hint">${_t('Aucune adresse e-mail. Un nom d\u0027utilisateur et un mot de passe suffisent. Les autres joueurs connectés voient votre nom d\u0027utilisateur, votre nom d\u0027affichage, votre niveau, vos statistiques et votre photo. Évitez d\u0027y mettre votre vrai nom.')} <button class="link" type="button" data-legal="privacy">${_t('Politique de confidentialité')}</button></p></div>`;
  const tabs = _t('<div class="seg" id="acTabs" role="radiogroup" aria-label="Connexion ou création de compte"></div>');
  if (v === 'recover') {
    sub.textContent = _t('Mot de passe oublié');
    body.innerHTML = `<div class="ac-grid"><div class="card ac-form"><h3 class="lbl">${_t('Mot de passe oublié')}</h3>${note}
      <form><label class="ac-in"><span>${_t('Nom d\u0027utilisateur')}</span><input name="u" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(d.u || '')}" required></label>
        <label class="ac-in"><span>${_t('Code de secours')}</span><input class="ac-codein" name="c" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required></label>
        <label class="ac-in"><span>${_t('Nouveau mot de passe')}</span><input name="p" type="password" maxlength="128" autocomplete="new-password" required></label>
        <p class="hint">${_t('Le code de secours s\u0027affiche à la création du compte. Sans lui, un mot de passe oublié ne peut pas être retrouvé. Le jeu ne garde aucune adresse e-mail. Vos autres appareils seront déconnectés.')}</p>
        <p class="ac-err" id="acErr" role="alert">${esc(ACCT.err)}</p><button class="btn primary" type="submit">${_t('Changer le mot de passe')}</button></form>
      <div class="btns"><button class="btn" id="acBack" type="button">${_t('Retour')}</button></div></div>${side}</div>`;
    $('acBack').addEventListener('click', () => acctGo('login'));
    acctForm(body.querySelector('form'), async (fd) => {
      const r = await acctApi('password-recover', { username: String(fd.get('u')).trim(), code: String(fd.get('c')), password: String(fd.get('p')) });
      if (!r.ok) return acctFail(r);
      ACCT.draft = {}; ACCT.view = 'login'; acctApply(r.data); sfxUi('confirm');
      acctShowCode(r.data.recoveryCode, _t('Mot de passe changé. Votre ancien code de secours ne sert plus. Voici le nouveau.'), acctSalonGo);
    });
    acctLegalLinks(body, null); return;
  }
  const reg = v === 'register';
  sub.textContent = reg ? _t('Créer un compte') : _t('Connexion');
  body.innerHTML = `<div class="ac-grid">
    <div class="card ac-form">${tabs}${note}
      <form>
        <label class="ac-in"><span>${_t('Nom d\u0027utilisateur')}</span><input name="u" maxlength="${reg ? 16 : 64}" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(d.u || '')}" required></label>
        <label class="ac-in"><span>${_t('Mot de passe')}</span><input name="p" type="password" maxlength="128" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
        ${reg ? acctAcceptHtml(d.a) : ''}
        <p class="hint">${reg ? _t('Le nom d\u0027utilisateur est votre identifiant public : 3 à 16 caractères (lettres sans accent, chiffres, tiret bas), définitif. Votre nom d\u0027affichage sera le même, et vous pourrez le changer. Mot de passe : 8 caractères au moins. Aucune adresse e-mail n\u0027est demandée : un code de secours s\u0027affichera, à noter pour retrouver le compte si vous oubliez le mot de passe.') : _t('<button class="link" type="button" id="acForgot">Mot de passe oublié ?</button>')}</p>
        <p class="ac-err" id="acErr" role="alert">${esc(ACCT.err)}</p>
        <button class="btn primary" type="submit">${reg ? _t('Créer le compte') : _t('Se connecter')}</button>
      </form>
    </div>${side}</div>`;
  seg($('acTabs'), [['login', _t('Connexion')], ['register', _t('Créer un compte')]], () => ACCT.view, (x) => { ACCT.draft = {}; acctGo(x); });
  const form = body.querySelector('form'), fg = $('acForgot');
  if (fg) fg.addEventListener('click', () => { ACCT.draft = { u: String(new FormData(form).get('u') || '').trim() }; acctGo('recover'); });
  acctLegalLinks(body, form);
  acctForm(form, async (fd) => {
    const u = String(fd.get('u')).trim();
    if (reg) {
      const r = await acctApi('register', { username: u, password: String(fd.get('p')), accept: !!fd.get('accept') });
      if (!r.ok) return acctFail(r);
      ACCT.draft = {}; acctApply(r.data); sfxUi('confirm');
      acctShowCode(r.data.recoveryCode, _t('Compte créé : bienvenue !'), acctSalonGo);
      return;
    }
    const r = await acctApi('login', { login: u, password: String(fd.get('p')) });
    if (!r.ok) return acctFail(r);
    ACCT.note = ''; ACCT.draft = {}; acctApply(r.data); sfxUi('confirm');
    // compte créé avant les codes de secours : le serveur vient de lui en donner un
    if (r.data.recoveryCode) return acctShowCode(r.data.recoveryCode, _t('Votre compte n\u0027avait pas encore de code de secours. Le voici. Il remplace l\u0027adresse e-mail, que le jeu ne garde plus.'), acctSalonGo);
    acctChanged(); acctSalonGo();
  });
}
/* ---------- Code de secours ----------
   Reçu du serveur une seule fois (inscription, première connexion d'un ancien compte, récupération, nouveau code) : l'écran Profil le montre
   avant tout le reste, avec de quoi le copier ou l'enregistrer, jusqu'à ce que le joueur coche « J'ai noté mon code » ; le jeu le dit alors au
   serveur (recovery-ok), qui ne tient le compte pour pourvu d'un code (hasRecovery) qu'à ce moment. Il ne vit qu'en mémoire : une page
   rechargée avant, une réponse perdue ou un ancien jeu laissent le bandeau du Profil, qui en fait créer un nouveau. then : la suite. */
function acctShowCode(code, note, then) {
  if (!code) { ACCT.note = note || ''; acctChanged(); if (then) then(); return; }
  ACCT.code = code; ACCT.codeNote = note || ''; ACCT.codeThen = then || null; ACCT.note = '';
  if (UI.screen !== 'profile' && MATCH.state === 'menu') uiGo('profile');
  acctChanged();
}
function acctRenderCode(body, sub) {
  sub.textContent = _t('Code de secours');
  body.innerHTML = `<div class="card ac-form ac-codebox">${ACCT.codeNote ? `<p class="ac-note">${esc(ACCT.codeNote)}</p>` : ''}
      <h3 class="lbl">${_t('Votre code de secours')}</h3>
      <p class="hint">${_t('Notez-le et gardez-le en lieu sûr. C\u0027est le seul moyen de retrouver votre compte si vous oubliez votre mot de passe. Il ne sera plus affiché.')}</p>
      <p class="ac-code" id="acCode">${esc(ACCT.code)}</p>
      <div class="row"><button class="btn" id="acCodeCopy" type="button">${_t('Copier')}</button><button class="btn" id="acCodeSave" type="button">${_t('Enregistrer dans un fichier')}</button></div>
      <p class="ac-err ok" id="acCodeMsg" role="status"></p>
      <form><label class="ac-check"><input type="checkbox" name="k" required><span>${_t('J\u0027ai noté mon code de secours')}</span></label>
        <button class="btn primary" type="submit">${_t('Continuer')}</button></form></div>`;
  const msg = (t) => { const m = $('acCodeMsg'); if (m) m.textContent = t; };
  $('acCodeCopy').addEventListener('click', async () => {
    sfxUi('click');
    try { await navigator.clipboard.writeText(ACCT.code); msg(_t('Code copié.')); return; } catch (e) { /* presse-papiers refusé : sélection à la main */ }
    const r = document.createRange(); r.selectNodeContents($('acCode')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    let done = false; try { done = document.execCommand('copy'); } catch (e) { /* ignoré */ }
    msg(done ? _t('Code copié.') : _t('Copie impossible ici. Le code est sélectionné, notez-le à la main.'));
  });
  $('acCodeSave').addEventListener('click', () => {
    sfxUi('click');
    const u = ACCT.user ? ACCT.user.username : '';
    const txt = ['Riposte: Frontline', _t('Nom d\u0027utilisateur : {0}', u), _t('Code de secours : {0}', ACCT.code), _t('Donné le {0}', fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })), '',
      _t('Il sert à choisir un nouveau mot de passe si vous oubliez le vôtre (Connexion, "Mot de passe oublié ?"). Il ne sert qu\u0027une fois. Un nouveau code vous est alors donné.')].join('\n');
    const url = URL.createObjectURL(new Blob([txt + '\n'], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = _t('riposte-frontline-code-de-secours.txt'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    msg(_t('Téléchargement demandé : vérifiez que le fichier est bien enregistré, sinon copiez le code ou notez-le à la main.'));
  });
  body.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const then = ACCT.codeThen, shown = ACCT.code; ACCT.code = ''; ACCT.codeNote = ''; ACCT.codeThen = null;
    sfxUi('confirm'); acctChanged(); if (then) then();
    // code noté : le serveur le retient (sinon le bandeau du Profil le redemandera) ; remplacé entre-temps ailleurs : on le dit
    acctApi('recovery-ok', { code: shown }).then((r) => {
      if (r.ok && r.data && r.data.user) { acctApply(r.data); acctChanged(); }
      else if (r.status === 422) { ACCT.note = (r.data && r.data.error) || ''; acctLoad(); }
    });
  });
}
const AC_HM = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : _t('{0} min', m); };
const AC_PCT = (a, b) => (b ? Math.round((a / b) * 100) + PCT : '0' + PCT);
/* Statistiques d'un joueur (son Profil, le profil d'un autre) : quatre chiffres clés en grand (ratio, taux de victoire, éliminations, parties), le reste en
   liste compacte ; time : le temps de jeu (le sien seulement, le serveur ne le donne pas pour un autre joueur) */
function acctStatsHtml(S, time) {
  const key = [[fmtNum(S.deaths ? S.kills / S.deaths : S.kills, 2), _t('Ratio É/M')], [AC_PCT(S.wins, S.matches), _t('Taux de victoire')], [fmtNum(S.kills), _t('Éliminations')], [fmtNum(S.matches), _t('Parties')]];
  const more = [[fmtNum(S.wins), _t('Victoires')], [fmtNum(S.deaths), _t('Morts')], [fmtNum(S.assists), _t('Aides')], [AC_PCT(S.hits, S.shots), _t('Précision')], [AC_PCT(S.headshots, S.kills), _t('À la tête')], [fmtNum(S.bestStreak), _t('Meilleure série')], ...(time ? [[AC_HM(S.seconds), _t('Temps de jeu')]] : [])];
  return `<div class="ac-stats">${acctKpis(key)}<dl class="ac-more">${more.map(([v, l]) => `<div><dt>${l}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl></div>`;
}
const acctKpis = (list) => `<div class="ac-kpis">${list.map(([v, l]) => `<div class="ac-stat"><b>${esc(String(v))}</b><span>${l}</span></div>`).join('')}</div>`;
/* Dernières parties : carte, mode, résultat (le mot, en couleur), éliminations et morts, XP (les siennes), date */
function acctGamesHtml(list, xp) {
  const RES = { win: [_t('Victoire'), 'w'], loss: [_t('Défaite'), 'l'], draw: [_t('Égalité'), ''], quit: [_t('Abandon'), ''] };
  const rows = list.map((m) => {
    const info = hasKey(MAP_DEFS, m.map) ? mapById(m.map).name : m.map, md = hasKey(MODES, m.mode) ? MODES[m.mode].btn : m.mode, [rl, rc] = hasKey(RES, m.result) ? RES[m.result] : [m.result, ''];
    const d = new Date(m.played_at), ds = isNaN(d) ? '' : fmtDate(d, { day: 'numeric', month: 'short' });
    return `<tr><td>${esc(info)}</td><td>${esc(md)} <small>${m.online ? _t('en ligne') : _t('solo')}</small></td><td class="${rc}">${esc(rl)}</td><td>${m.kills} / ${m.deaths}</td>${xp ? `<td>+${m.xp} XP</td>` : ''}<td>${esc(ds)}</td></tr>`;
  }).join('');
  return rows ? `<table class="ac-recent"><thead><tr><th>${_t('Carte')}</th><th>${_t('Mode')}</th><th>${_t('Résultat')}</th><th>${_t('É / M')}</th>${xp ? '<th>XP</th>' : ''}<th>${_t('Date')}</th></tr></thead><tbody>${rows}</tbody></table>` : '';
}
/* Champ de formulaire du Profil : le libellé au-dessus du champ (plus d'indication seulement dans le « placeholder ») */
const acctIn = (label, attrs) => `<label class="ac-in"><span>${label}</span><input ${attrs}></label>`;
function acctRenderProfile(body, sub) {
  const u = ACCT.user, L = ACCT.level, S = ACCT.stats;
  sub.textContent = _t('Compte et progression');
  ACCT.noteSeen = !!ACCT.note;
  const games = acctGamesHtml(ACCT.recent, true);
  const pwIn = u.hasPassword ? acctIn(_t('Mot de passe'), 'name="p" type="password" maxlength="128" autocomplete="current-password" required') : '';
  const warn = u.hasRecovery ? '' : `<div class="card ac-warn"><p>${_t('Créez votre code de secours. Sans lui, un mot de passe oublié ne peut pas être retrouvé (le jeu ne garde aucune adresse e-mail).')}</p>
    <form id="acRec0" class="row">${pwIn}<button class="btn primary" type="submit">${_t('Créer mon code de secours')}</button></form><p class="ac-err" id="acRec0Err" role="alert"></p></div>`; // mot de passe redemandé (voir recoveryNew) : une session laissée ouverte ne suffit pas
  // modération (comptes de la variable MODERATION du serveur) : accès à l'écran des signalements (09v-moderation.js)
  const mod = u.moderator ? `<div class="card ac-mod${u.modOpen ? ' on' : ''}"><p>${u.modOpen ? _tn(u.modOpen, 'Modération : {0} compte signalé attend votre décision.', 'Modération : {0} comptes signalés attendent votre décision.') : _t('Modération : aucun signalement en attente.')}</p>
    <button class="btn${u.modOpen ? ' primary' : ''}" id="acMod" type="button">${_t('Ouvrir la modération')}</button></div>` : '';
  // deux colonnes sur écran large : progression (identité, chiffres, dernières parties) à gauche, gestion du compte à droite
  body.innerHTML = `
    ${ACCT.note ? `<p class="ac-note" role="status">${esc(ACCT.note)}</p>` : ''}
    ${warn}${mod}
    <div class="ac-cols">
      <div class="ac-main">
        <div class="card ac-top">
          <button class="ac-avbtn" id="acAvBtn" type="button" title="${esc(_t('Changer la photo de profil'))}" aria-label="${esc(_t('Changer la photo de profil'))}"><span class="acct-av" id="acAvBig">${acctAvatar(u, L.level)}</span><em>${_t('Modifier')}</em></button>
          <div class="ac-id"><h3>${esc(u.displayName)}</h3><p>@${esc(u.username)} · ${_t('Niveau {0}', L.level)}</p>
            <div class="ac-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}"><i style="transform:scaleX(${L.need ? L.into / L.need : 1})"></i></div>
            <div class="ac-xp">${_t('{0} · {1} XP en tout', L.need ? `${_t('{0} / {1} XP avant le niveau {2}', L.into, L.need, L.level + 1)}` : _t('Niveau maximal'), L.xp)}</div></div>
        </div>
        ${acctStatsHtml(S, true)}
        <div class="card ac-games"><h3 class="lbl">${_t('Dernières parties')}</h3>${games || _t('<p class="hint">Aucune partie enregistrée. Jouez une partie pour gagner de l\u0027XP.</p>')}</div>
      </div>
      <div class="card ac-side"><h3 class="lbl">${_t('Compte')}</h3>
        <div class="ac-field"><span>${_t('Photo de profil')}</span>
          <div class="row"><button class="btn" id="acAvEdit" type="button">${_t('Changer la photo')}</button>${u.avatar ? `<button class="btn" id="acAvDel" type="button">${_t('Retirer')}</button>` : ''}</div>
          ${u.avatar && u.avatarHidden ? `<p class="hint ac-hid">${_t('Votre photo a été signalée par plusieurs joueurs. Elle est masquée aux autres en attendant la modération.')}</p>` : ''}</div>
        <form id="acName" class="ac-field"><label for="acNameIn">${_t('Nom d\u0027affichage (16 caractères au plus)')}</label>
          <div class="row"><input id="acNameIn" name="n" maxlength="16" value="${esc(u.displayName)}" autocomplete="off" spellcheck="false" required><button class="btn" type="submit">${_t('Enregistrer')}</button></div>
          <p class="ac-err" id="acErr" role="alert">${esc(ACCT.err)}</p></form>
        <p class="hint">${_t('Identifiant :')} <b>${esc(u.username)}</b> ${_t('(définitif, visible dans le classement). Les autres joueurs voient aussi votre nom d\u0027affichage.')}</p>
        <div class="btns"><button class="btn" id="acOut" type="button">${_t('Se déconnecter')}</button></div>
        <details class="ac-fold"><summary>${_t('Mot de passe et code de secours')}</summary>
          <form id="acPass"><span class="hint">${u.hasPassword ? _t('Changer le mot de passe (un nouveau code de secours vous sera donné)') : _t('Ajouter un mot de passe')}</span>
            ${u.hasPassword ? acctIn(_t('Mot de passe actuel'), 'name="c" type="password" maxlength="128" autocomplete="current-password" required') : ''}
            ${acctIn(_t('Nouveau mot de passe (8 caractères au moins)'), 'name="n" type="password" maxlength="128" autocomplete="new-password" required')}
            <p class="ac-err" id="acPassErr" role="alert"></p><button class="btn" type="submit">${_t('Enregistrer')}</button></form>
          ${u.hasRecovery ? `<form id="acRec"><span class="hint">${_t('Nouveau code de secours (code perdu). L\u0027ancien ne servira plus.')}</span>${pwIn}
            <p class="ac-err" id="acRecErr" role="alert"></p><button class="btn" type="submit">${_t('Créer un nouveau code')}</button></form>` : ''}
        </details>
        <details class="ac-fold ac-danger"><summary>${_t('Mes données et suppression du compte')}</summary>
          <p class="hint">${_t('Vous pouvez récupérer toutes vos données dans un fichier, ou supprimer le compte.')} <button class="link" type="button" data-legal="privacy">${_t('Politique de confidentialité')}</button></p>
          <div class="btns"><button class="btn" id="acExport" type="button">${_t('Télécharger mes données')}</button></div>
          <form id="acDel"><p class="hint">${_t('Supprimer efface le compte, la progression et l\u0027historique, définitivement. Tapez votre nom d\u0027utilisateur{0} pour confirmer.', u.hasPassword ? ' ' + _t('et votre mot de passe') : '')}</p>
            ${acctIn(_t('Nom d\u0027utilisateur'), `name="c" placeholder="${esc(u.username)}" autocomplete="off" autocapitalize="off" spellcheck="false" required`)}${u.hasPassword ? acctIn(_t('Mot de passe'), 'name="p" type="password" autocomplete="current-password" required') : ''}
            <p class="ac-err" id="acDelErr" role="alert"></p><button class="btn danger" type="submit">${_t('Supprimer définitivement')}</button></form></details>
      </div>
    </div>`;
  acctLegalLinks(body, null);
  acctAvatarFallback($('acAvBig'), u, L.level);
  for (const id of ['acAvBtn', 'acAvEdit']) $(id).addEventListener('click', () => { sfxUi('click'); avOpen(); });
  if ($('acAvDel')) $('acAvDel').addEventListener('click', () => { avRemove(); });
  if ($('acMod')) $('acMod').addEventListener('click', () => { sfxUi('click'); uiGo('moderation'); });
  acctForm($('acName'), async (fd) => {
    const r = await acctApi('profile', { displayName: String(fd.get('n')) });
    if (!r.ok) return acctFail(r);
    acctApply(r.data); acctChanged(); sfxUi('click');
  });
  // formulaires secondaires du profil : même mécanique, l'erreur s'affiche sous le formulaire
  const wire = (id, errId, call, done) => $(id).addEventListener('submit', async (e) => {
    e.preventDefault(); if (ACCT.busy) return;
    const f = $(id), btn = f.querySelector('[type=submit]'); ACCT.busy = true; btn.disabled = true; $(errId).textContent = '';
    try { const r = await call(new FormData(f)); if (!r.ok) $(errId).textContent = (r.data && r.data.error) || AC_ERR[r.status] || _t('Erreur.'); else done(r); }
    finally { ACCT.busy = false; btn.disabled = false; }
  });
  wire('acPass', 'acPassErr', (fd) => acctApi('password-change', { current: String(fd.get('c') || ''), next: String(fd.get('n')) }), (r) => { acctApply(r.data); sfxUi('confirm'); acctShowCode(r.data.recoveryCode, _t('Mot de passe changé. Votre ancien code de secours ne sert plus. Voici le nouveau.')); });
  // code de secours : le premier (bandeau) ou un nouveau à la place d'un code perdu ; le serveur redemande le mot de passe
  const recNew = (fd) => acctApi('recovery-new', { password: String(fd.get('p') || '') });
  if ($('acRec0')) wire('acRec0', 'acRec0Err', recNew, (r) => { acctApply(r.data); sfxUi('confirm'); acctShowCode(r.data.recoveryCode, _t('Votre code de secours est prêt.')); });
  if ($('acRec')) wire('acRec', 'acRecErr', recNew, (r) => { acctApply(r.data); sfxUi('confirm'); acctShowCode(r.data.recoveryCode, _t('Nouveau code de secours. L\u0027ancien ne sert plus.')); });
  $('acOut').addEventListener('click', async () => { await acctApi('logout', {}); const h = acctHint(); if (h) acctHintSet({ ...h, on: false }); acctForget(); acctChanged(); sfxUi('back'); });
  $('acExport').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/account-export', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = 'riposte-frontline-mes-donnees.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { ACCT.err = _t('Export impossible : réessayez.'); $('acErr').textContent = ACCT.err; }
  });
  $('acDel').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData($('acDel')), r = await acctApi('account-delete', { confirm: String(fd.get('c')), password: String(fd.get('p') || '') });
    if (!r.ok) { $('acDelErr').textContent = (r.data && r.data.error) || AC_ERR[r.status] || _t('Erreur.'); return; }
    acctHintSet(null); acctForget(); ACCT.note = _t('Compte supprimé.'); acctChanged();
  });
}

/* ---------- Suivi des parties ---------- */
/* Ouverture : le serveur remet un jeton daté (il fixe la durée maximale que le résumé pourra annoncer) */
function acctMatchStart() {
  ACCT.match = null;
  if (!ACCT.user) return;
  const m = { t0: MATCH.time, token: null, online: !!MATCH.online, map: CURMAP.id, mode: MATCH.mode };
  ACCT.match = m;
  acctApi('match-start', {}).then((r) => { if (r.ok && r.data && ACCT.match === m) m.token = r.data.token; });
}
/* Fin (result : win, loss, draw ou quit) : envoie le résumé ; l'écran de fin affiche l'XP gagnée */
async function acctMatchEnd(result, show) {
  const m = ACCT.match; ACCT.match = null;
  const box = $('endXp');
  if (box) box.classList.add('hidden');
  if (!m) { // sans compte : l'XP de la partie gardée sur cet appareil (arsLocalXp), et l'invitation à se connecter
    if (show && box && !ACCT.user) {
      const g = ARS.gain, a = g ? pxpForLevel(g.level) : 0, b = g && g.level < 100 ? pxpForLevel(g.level + 1) : 0;
      const slots = g && g.slots ? `<b>${_tn(g.slots, '{0} classe personnalisée débloquée', '{0} classes personnalisées débloquées')}</b>` : '';
      box.innerHTML = (g ? endXpHtml({ xp: g.xp, level: g.level, into: ARS.px - a, need: b ? b - a : 0, up: g.up, notes: [_t('Progression gardée sur cet appareil'), slots] }) : '')
        + (ACCT.state === 'ready' ? `<p class="ex-note">${_t('Partie non enregistrée. <b>Connectez-vous</b> (Profil) pour gagner de l\u0027XP du compte.')}</p>` : '');
      box.classList.toggle('hidden', !box.innerHTML);
    }
    return;
  }
  for (let i = 0; i < 20 && !m.token && ACCT.state === 'ready'; i++) await new Promise((r) => setTimeout(r, 250)); // jeton encore en route
  if (!m.token) return;
  const me = PL.ent, dur = Math.max(0, Math.floor(MATCH.time - m.t0));
  const r = await acctApi('match-end', { token: m.token, summary: {
    map: m.map, mode: m.mode || 'tdm', result, online: m.online, duration: dur, kills: me.kills, deaths: me.deaths, assists: me.assists,
    headshots: Math.min(PL.hsKills || 0, me.kills), shots: PL.shots, hits: Math.min(PL.hits, PL.shots), score: Math.max(0, me.score | 0), streak: Math.min(PL.bestStreak || 0, me.kills),
  } });
  if (!r.ok || !r.data) return;
  ACCT.level = r.data.level; ACCT.stats = r.data.stats; ACCT.recent = r.data.recent; acctChanged();
  if (show && box && MATCH.state === 'ended') {
    const L = r.data.level;
    box.innerHTML = endXpHtml({ xp: r.data.gained, level: L.level, into: L.into, need: L.need, up: r.data.levelUp, notes: [m.online ? '' : _t('Partie solo : XP réduite de moitié')] });
    box.classList.remove('hidden');
  }
}
/* Retour aux menus en pleine partie : abandon (compté s'il a duré au moins 30 s) */
function acctMatchAbandon() { if (ACCT.match) acctMatchEnd('quit', false); }

/* ---------- Démarrage ---------- */
/* Appelé par menuInit : l'état du compte se charge pendant que le jeu finit de démarrer ; la navigation qui en découle attend
   la fin du démarrage (acctArrive, appelé après l'ouverture du menu principal par boot, 09-game.js) */
function acctInit() {
  // liens reçus par e-mail avant la version 3.5 (confirmation d'adresse ?verif, mot de passe oublié ?mdp) : ils ne servent plus, le Profil le dit
  const qs = new URLSearchParams(location.search);
  ACCT.oldLink = qs.has('verif') || qs.has('mdp');
  if (ACCT.oldLink) { qs.delete('verif'); qs.delete('mdp'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '')); }
  ACCT.ready = acctLoad();
}
function acctArrive() {
  const old = ACCT.oldLink; ACCT.oldLink = false;
  ACCT.ready.then(() => {
    if (ACCT.state !== 'ready') return;
    if (old) {
      ACCT.note = _t('Ce lien reçu par e-mail ne sert plus. Le jeu ne garde plus d\u0027adresse e-mail. Connectez-vous avec votre nom d\u0027utilisateur. En cas d\u0027oubli du mot de passe, utilisez votre code de secours.');
      acctChanged(); uiOpen('profile', ['main']); return;
    }
    // compte resté connecté sans code de secours noté (créé avant les codes, ou code jamais confirmé) : le Profil, et son bandeau qui le
    // fait créer, s'ouvre au lancement tant qu'il n'y en a pas (sauf lien d'invitation, qui mène au salon)
    if (ACCT.user && !ACCT.user.hasRecovery && !ACCT.code && UI.screen === 'main' && MATCH.state === 'menu' && !new URLSearchParams(location.search).has('salon')) uiOpen('profile', ['main']);
  });
}
