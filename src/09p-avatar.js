/* ==========================================================================
   PHOTO DE PROFIL : choisir une image de n'importe quelle taille, la cadrer, la réduire et l'envoyer.
   Tout le traitement se fait ici, dans le navigateur : l'image d'origine (jusqu'à AV.maxFile, des dizaines de millions de pixels) n'est
   jamais envoyée. Elle est décodée (orientation EXIF respectée), ramenée à AV.work px de côté au plus, cadrée en carré par le joueur
   (glisser pour déplacer, molette ou curseur pour zoomer), puis réduite par moitiés successives (net, sans crénelage) à AV.sizes[0] px
   et encodée en WebP (JPEG si le navigateur ne sait pas écrire du WebP) en baissant la qualité, puis la taille, jusqu'à tenir sous
   AV.maxBytes. Ce qui part au serveur pèse donc quelques Ko, et le serveur refuse le reste (api/_lib/avatar.js, README « Photo de profil »).
   La photo se lit par /api/avatar?v=<version> (la sienne) ou ?u=<nom> (celle d'un autre joueur, dans le classement et sur son profil) ; les deux exigent une session.
   ========================================================================== */
const AV = {
  sizes: [192, 160, 128],              // côtés essayés, en pixels : le premier qui tient sous maxBytes est gardé
  qualities: [0.85, 0.72, 0.6, 0.48, 0.36],
  maxBytes: 24 * 1024,                 // poids visé de l'image envoyée (le serveur accepte jusqu'à 32 Ko)
  maxFile: 40 * 1024 * 1024,           // fichier d'origine accepté
  work: 1600,                          // côté maximal de l'image de travail (cadrage), en pixels
  view: 300,                           // côté de la fenêtre de cadrage, en pixels
  bg: '#20241c',                       // fond sous l'image (transparence)
  st: null, fmt: null, busy: false, timer: 0, seq: 0,
};
const avErr = (m) => { $('avErr').textContent = m || ''; };
const avSize = (b) => (b >= 1048576 ? _t('{0} Mo', fmtNum(b / 1048576, 1)) : _t('{0} Ko', fmtNum(Math.max(1, Math.round(b / 1024)))));

/* Le navigateur sait-il écrire du WebP ? (Safari renvoie du PNG : on passe alors au JPEG) */
function avFormat() {
  if (AV.fmt) return AV.fmt;
  const c = document.createElement('canvas'); c.width = c.height = 1;
  AV.fmt = new Promise((res) => c.toBlob((b) => res(b && b.type === 'image/webp' ? 'image/webp' : 'image/jpeg'), 'image/webp', 0.5));
  return AV.fmt;
}
const avBlob = (cv, type, q) => new Promise((res) => cv.toBlob(res, type, q));
const avUri = (blob) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => rej(f.error); f.readAsDataURL(blob); });

/* Décode un fichier image : createImageBitmap d'abord (orientation EXIF), un élément img sinon (SVG, anciens navigateurs) */
async function avDecode(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* format ou taille non pris en charge : on essaie l'élément img */ } }
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.decoding = 'async'; im.src = url;
    await im.decode();
    if (!im.naturalWidth || !im.naturalHeight) throw new Error('vide');
    return im;
  } finally { URL.revokeObjectURL(url); }
}
const avDims = (im) => [im.naturalWidth || im.width, im.naturalHeight || im.height];

/* Copie la zone carrée (sx, sy, côté s) de src dans un carré de côté out, par moitiés successives : une réduction d'un seul coup d'une
   photo de 4000 px à 192 px crénèle ; en divisant par deux à chaque passe, chaque pixel d'arrivée moyenne bien ses voisins. */
function avCrop(src, sx, sy, s, out) {
  let cur = src, x = sx, y = sy, w = s;
  while (w / 2 >= out) {
    const half = Math.max(out, Math.round(w / 2)), c = document.createElement('canvas'); c.width = c.height = half;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, x, y, w, w, 0, 0, half, half);
    cur = c; x = y = 0; w = half;
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = out;
  const g = cv.getContext('2d'); g.fillStyle = AV.bg; g.fillRect(0, 0, out, out);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(cur, x, y, w, w, 0, 0, out, out);
  return cv;
}
/* Image de travail : l'image d'origine ramenée à AV.work px de côté au plus (par moitiés), sur fond uni */
function avWorking(im, iw, ih) {
  const k = Math.min(1, AV.work / Math.max(iw, ih)), w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  let cur = im, cw = iw, ch = ih;
  while (cw / 2 >= w && ch / 2 >= h) {
    const c = document.createElement('canvas'); c.width = Math.max(w, Math.round(cw / 2)); c.height = Math.max(h, Math.round(ch / 2));
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, cw, ch, 0, 0, c.width, c.height);
    cur = c; cw = c.width; ch = c.height;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'); g.fillStyle = AV.bg; g.fillRect(0, 0, w, h); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, cw, ch, 0, 0, w, h);
  return out;
}

/* ---------- Cadrage : zoom z (1 = l'image couvre juste le carré), centre (cx, cy) en pixels de l'image de travail ---------- */
function avGeom() {
  const S = AV.st, base = Math.max(AV.view / S.w, AV.view / S.h), s = base * S.z, side = AV.view / s; // côté du carré visible, en pixels de travail
  S.cx = Math.min(S.w - side / 2, Math.max(side / 2, S.cx)); S.cy = Math.min(S.h - side / 2, Math.max(side / 2, S.cy));
  return { s, side, x: S.cx - side / 2, y: S.cy - side / 2 };
}
function avDraw() {
  const cv = $('avCanvas'), g = cv.getContext('2d'), S = AV.st;
  g.fillStyle = AV.bg; g.fillRect(0, 0, cv.width, cv.height);
  if (!S) { if (AV.cur) g.drawImage(AV.cur, 0, 0, cv.width, cv.height); return; }
  const G = avGeom();
  g.imageSmoothingQuality = 'high'; g.drawImage(S.src, G.x, G.y, G.side, G.side, 0, 0, cv.width, cv.height);
  const p = $('avPrev').getContext('2d'); p.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, 88, 88);
  avZoomFill(S.z);
}
/* Curseur du zoom : valeur et part remplie de la piste (shell.html, --p) */
function avZoomFill(z) { const r = $('avZoom'); r.value = z; r.style.setProperty('--p', ((z - 1) / 5) * 100 + '%'); }
function avChanged() {
  avDraw();
  clearTimeout(AV.timer); AV.timer = setTimeout(avEstimate, 350);
}
/* Poids de ce qui serait enregistré, affiché pour que le choix soit clair */
async function avEstimate() {
  const S = AV.st; if (!S) return;
  const seq = ++AV.seq, r = await avBuild();
  if (seq !== AV.seq || !AV.st) return;
  $('avInfo').textContent = r ? _t('Image d\u0027origine : {0} x {1} px, {2}. Version enregistrée : {3} x {3} px, {4}.', S.iw, S.ih, avSize(S.bytes), r.px, avSize(r.blob.size)) : '';
}
/* Encode le cadrage actuel : { blob, px } ou null si rien ne tient sous le poids visé */
async function avBuild() {
  const S = AV.st; if (!S) return null;
  const G = avGeom(), type = await avFormat();
  for (const px of AV.sizes) {
    const cv = avCrop(S.src, G.x, G.y, G.side, px);
    for (const q of AV.qualities) { const blob = await avBlob(cv, type, q); if (blob && blob.size <= AV.maxBytes) return { blob, px }; }
  }
  return null;
}

/* ---------- Choix de l'image ---------- */
async function avLoad(file) {
  avErr('');
  if (!file) return;
  if (file.size > AV.maxFile) return avErr(_t('Fichier trop lourd ({0} Mo au plus).', Math.round(AV.maxFile / 1048576)));
  if (file.type && !file.type.startsWith('image/')) return avErr(_t('Ce fichier n\u0027est pas une image.'));
  $('avInfo').textContent = _t('Lecture de l\u0027image...');
  let im;
  try { im = await avDecode(file); } catch (e) { $('avInfo').textContent = ''; return avErr(_t('Cette image ne peut pas être lue par le navigateur (essayez un JPEG, un PNG ou un WebP).')); }
  const [iw, ih] = avDims(im);
  if (!iw || !ih) { $('avInfo').textContent = ''; return avErr(_t('Cette image ne peut pas être lue par le navigateur (essayez un JPEG, un PNG ou un WebP).')); }
  const src = avWorking(im, iw, ih);
  if (im.close) im.close();
  AV.st = { src, w: src.width, h: src.height, iw, ih, bytes: file.size, z: 1, cx: src.width / 2, cy: src.height / 2, drag: null };
  $('avEmpty').classList.add('hidden'); $('avStage').classList.add('has');
  $('avZoom').disabled = false; $('avSave').disabled = false;
  avChanged();
}
function avPick(files) { if (files && files[0]) avLoad(files[0]); }

/* ---------- Fenêtre ---------- */
function avOpen() {
  if (!ACCT.user) return;
  AV.st = null; AV.cur = null; AV.busy = false;
  const u = ACCT.user, cv = $('avCanvas');
  cv.width = cv.height = AV.view;
  avErr(''); $('avInfo').textContent = '';
  $('avEmpty').classList.remove('hidden'); $('avStage').classList.remove('has', 'drag');
  avZoomFill(1); $('avZoom').disabled = true; $('avSave').disabled = true; $('avSave').textContent = _t('Enregistrer');
  $('avRemove').classList.toggle('hidden', !u.avatar);
  $('avPrev').getContext('2d').clearRect(0, 0, 88, 88);
  // photo actuelle : montrée en attendant un nouveau choix
  if (u.avatar) { const im = new Image(); im.onload = () => { if (!AV.st) { AV.cur = im; avDraw(); } }; im.src = '/api/avatar?v=' + u.avatar; }
  avDraw();
  $('avEditor').classList.remove('hidden');
  requestAnimationFrame(() => $('avFileBtn').focus({ preventScroll: true }));
}
function avClose() { $('avEditor').classList.add('hidden'); AV.st = null; AV.cur = null; AV.seq++; clearTimeout(AV.timer); if (UI.screen === 'profile') { const b = $('acAvBtn'); if (b) b.focus({ preventScroll: true }); } }
const avIsOpen = () => !$('avEditor').classList.contains('hidden');

async function avSave() {
  if (AV.busy || !AV.st) return;
  AV.busy = true; avErr(''); $('avSave').disabled = true; $('avSave').textContent = _t('Enregistrement...');
  try {
    const r = await avBuild();
    if (!r) { avErr(_t('Cette image ne tient pas dans le poids autorisé, même réduite. Essayez-en une autre.')); return; }
    const res = await acctApi('avatar-set', { image: await avUri(r.blob) }, 40000); // la photo peut être vérifiée par IA avant d'être rangée (api/_lib/photo-ia.js)
    if (!res.ok) { avErr((res.data && res.data.error) || AC_ERR[res.status] || _t('Une erreur est survenue.')); return; }
    acctApply(res.data); ACCT.note = _t('Photo de profil enregistrée : {0} x {0} px, {1}.', r.px, avSize(r.blob.size)); acctChanged(); sfxUi('confirm');
    avClose();
  } finally { AV.busy = false; $('avSave').textContent = _t('Enregistrer'); $('avSave').disabled = !AV.st; }
}
async function avRemove() {
  if (AV.busy) return;
  AV.busy = true; avErr('');
  try {
    const res = await acctApi('avatar-delete', {});
    if (!res.ok) { avErr((res.data && res.data.error) || AC_ERR[res.status] || _t('Une erreur est survenue.')); return; }
    acctApply(res.data); ACCT.note = _t('Photo de profil retirée.'); acctChanged(); sfxUi('back');
    avClose();
  } finally { AV.busy = false; }
}

/* ---------- Branchements (une seule fois) ---------- */
function avInit() {
  const stage = $('avStage'), cv = $('avCanvas');
  $('avFile').addEventListener('change', (e) => { avPick(e.target.files); e.target.value = ''; });
  $('avFileBtn').addEventListener('click', () => $('avFile').click());
  $('avSave').addEventListener('click', avSave);
  $('avRemove').addEventListener('click', avRemove);
  $('avCancel').addEventListener('click', () => { avClose(); sfxUi('back'); });
  $('avEditor').addEventListener('pointerdown', (e) => { if (e.target === $('avEditor')) avClose(); });
  $('avZoom').addEventListener('input', () => { if (AV.st) { AV.st.z = +$('avZoom').value; avChanged(); } });
  // déplacer le cadrage : glisser (un pixel d'écran = 1 / s pixels de l'image de travail) ; zoomer : molette
  cv.addEventListener('pointerdown', (e) => { if (!AV.st) return; AV.st.drag = { x: e.clientX, y: e.clientY, cx: AV.st.cx, cy: AV.st.cy }; cv.setPointerCapture(e.pointerId); stage.classList.add('grab'); });
  cv.addEventListener('pointermove', (e) => {
    const d = AV.st && AV.st.drag; if (!d) return;
    const k = AV.view / cv.getBoundingClientRect().width / avGeom().s;
    AV.st.cx = d.cx - (e.clientX - d.x) * k; AV.st.cy = d.cy - (e.clientY - d.y) * k; avChanged();
  });
  const end = () => { if (AV.st) AV.st.drag = null; stage.classList.remove('grab'); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => { if (!AV.st) return; e.preventDefault(); AV.st.z = Math.min(6, Math.max(1, AV.st.z * Math.exp(-e.deltaY * 0.0015))); avChanged(); }, { passive: false });
  // au doigt, pas de molette : deux doigts pincent pour zoomer (le glisser à un doigt reste au-dessus)
  const pts = new Map(); let pinch = null;
  const span = () => { const [a, b] = [...pts.values()]; return hyp(a[0] - b[0], a[1] - b[1]) || 1; };
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && AV.st) { pinch = { d: span(), z: AV.st.z }; AV.st.drag = null; } });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2 && AV.st) { AV.st.z = Math.min(6, Math.max(1, (pinch.z * span()) / pinch.d)); avChanged(); }
  });
  const lift = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
  cv.addEventListener('keydown', (e) => {
    if (!AV.st) return;
    const G = avGeom(), step = G.side * 0.05, m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (m) { AV.st.cx += m[0]; AV.st.cy += m[1]; e.preventDefault(); avChanged(); }
    else if (e.key === '+' || e.key === '=') { AV.st.z = Math.min(6, AV.st.z * 1.1); e.preventDefault(); avChanged(); }
    else if (e.key === '-') { AV.st.z = Math.max(1, AV.st.z / 1.1); e.preventDefault(); avChanged(); }
  });
  // glisser-déposer et coller une image
  for (const t of ['dragenter', 'dragover']) $('avEditor').addEventListener(t, (e) => { e.preventDefault(); stage.classList.add('drag'); });
  for (const t of ['dragleave', 'drop']) $('avEditor').addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || e.target === $('avEditor')) stage.classList.remove('drag'); });
  $('avEditor').addEventListener('drop', (e) => avPick(e.dataTransfer && e.dataTransfer.files));
  addEventListener('paste', (e) => { if (!avIsOpen()) return; const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => x.type.startsWith('image/')); if (f) avLoad(f); });
  // la fenêtre garde le clavier : Échap la ferme sans mettre le jeu en pause, les flèches ne déplacent pas le menu en dessous
  addEventListener('keydown', (e) => {
    if (!avIsOpen()) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); avClose(); }
    else if (e.code.startsWith('Arrow') && e.target !== cv) e.stopImmediatePropagation();
    else if (e.code === 'Tab') { // le focus reste dans la fenêtre
      const f = [...$('avEditor').querySelectorAll('button, input[type=range], canvas[tabindex]')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement), n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[n].focus();
    }
  }, true);
}
avInit();
