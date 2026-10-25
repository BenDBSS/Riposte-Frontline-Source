/* ==========================================================================
   VITRINE 3D DES ARMES : aperçus (vignettes) et visuel de l'atelier de classe
   L'arme est rendue par le moteur du jeu (même matières, même éclairage d'ambiance que la partie) dans un coin du canevas
   principal, que les menus ne dessinent pas ; le résultat est recopié aussitôt dans un canevas 2D de l'interface. Aucun
   deuxième contexte WebGL : rien à compiler de plus, et le rendu des matières (camouflages compris) est celui de la partie.
   - Vignettes : une image par arme (vue de côté), construites en tâche de fond après le démarrage, une arme à la fois.
   - Vignettes et visuel de départ : l'arme est centrée d'après ce qu'on en voit (vwScreenBox, vwFrame), pas d'après sa boîte, que la perspective
     et les accessoires décalent.
   - Visuel : l'arme de l'atelier, de côté et immobile, qu'on fait tourner (glisser), approcher (molette) ou remettre en place (double clic) ; des
     points « + » posés sur le modèle ouvrent la liste des accessoires de chaque emplacement (voir 09n-armurerie.js).
   ========================================================================== */
const VW_BG = 0x181b14, VW_FOV = 24;
const VWS = { scene: null, cam: null };
const _vwV2 = new THREE.Vector2(), _vwCol = new THREE.Color();

/* Scène d'éclairage commune aux vignettes et au visuel : ambiance de la carte, une lumière de face, une de contre-jour */
function vwScene() {
  if (VWS.scene) return VWS;
  const sc = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(-1.2, 2, 1.4); sc.add(key);
  const fill = new THREE.DirectionalLight(0x9db4d8, 0.9); fill.position.set(1.5, 0.6, -1); sc.add(fill);
  sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2418, 0.55));
  VWS.scene = sc; VWS.cam = new THREE.PerspectiveCamera(VW_FOV, 2, 0.02, 12);
  return VWS;
}
/* Distance d'une caméra de champ VW_FOV pour qu'une arme de taille sz tienne dans le cadre (vue de côté) */
function vwFit(sz, aspect, margin) {
  const vf = THREE.MathUtils.degToRad(VW_FOV), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  return Math.max(sz.z / 2 / Math.tan(hf / 2), sz.y / 2 / Math.tan(vf / 2)) * margin + sz.x / 2;
}
/* Rectangle (coordonnées d'image de -1 à 1) que couvrent, vus par la caméra, les sommets visibles du modèle : la perspective et les accessoires
   (silencieux, poignée, optique) décalent le centre de l'arme par rapport au centre de sa boîte, ce calcul-ci est exact */
function vwScreenBox(group, cam) {
  group.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = _vwFV;
  group.traverseVisible((o) => {
    const p = o.isMesh && o.geometry && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(cam);
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
    }
  });
  return x1 > x0 && y1 > y0 ? { x0, x1, y0, y1 } : null;
}
/* Décale la projection pour que le rectangle soit au centre de l'image et, si fill > 0, l'agrandit pour qu'il en occupe la part fill (sans changer la perspective) */
function vwFrame(cam, box, fill) {
  if (!box) return;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, s = fill > 0 ? Math.min(2 * fill / (box.x1 - box.x0), 2 * fill / (box.y1 - box.y0)) : 1, e = cam.projectionMatrix.elements;
  e[0] *= s; e[5] *= s; e[8] = s * (e[8] + cx); e[9] = s * (e[9] + cy);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
const _vwFV = new V3();
/* Place la caméra : azimut a (0 : vue de la gauche de l'arme, la bouche à gauche de l'image), hauteur p, distance d */
function vwCamPlace(cam, a, p, d, aim) {
  cam.position.set(aim.x - Math.cos(a) * Math.cos(p) * d, aim.y + Math.sin(p) * d, aim.z - Math.sin(a) * Math.cos(p) * d);
  cam.lookAt(aim);
}
/* Rend la scène dans une cible de rendu hors écran (W x H pixels), la relit (readRenderTargetPixels) et la pose dans ctx (dw x dh) ; tout l'état du moteur modifié pour
   l'occasion est rétabli. Jamais dans le canevas principal : rendre dans le tampon de la toile puis la recopier (drawImage d'un canevas WebGL) pendant que la vue aérienne
   s'affiche faisait perdre le contexte WebGL d'un Pixel (PowerVR), 0,6 s après l'ouverture du choix de la classe, quand les vignettes reprenaient. La cible a l'encodage
   sRGB (conversion matérielle à l'écriture) : même image qu'avant, quand three.js convertissait vers le canevas. */
const VWT = { rt: null, px: null, img: null, tmp: null };
function vwDraw(ctx, dw, dh, W, H) {
  const r = renderer, w = Math.max(2, Math.min(2048, Math.floor(W))), h = Math.max(2, Math.min(2048, Math.floor(H)));
  if (!VWT.rt) { VWT.rt = new THREE.WebGLRenderTarget(w, h); VWT.rt.texture.encoding = THREE.sRGBEncoding; }
  else if (VWT.rt.width !== w || VWT.rt.height !== h) VWT.rt.setSize(w, h);
  if (!VWT.px || VWT.px.length !== w * h * 4) { VWT.px = new Uint8Array(w * h * 4); VWT.img = new ImageData(w, h); }
  const keep = { rt: r.getRenderTarget(), tm: r.toneMapping, ex: r.toneMappingExposure, ac: r.autoClear, cc: r.getClearColor(_vwCol).clone(), ca: r.getClearAlpha() };
  const S = vwScene(); S.scene.environment = envMap;
  r.setRenderTarget(VWT.rt); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.autoClear = true; r.setClearColor(VW_BG, 1);
  r.render(S.scene, S.cam);
  r.readRenderTargetPixels(VWT.rt, 0, 0, w, h, VWT.px);
  r.setRenderTarget(keep.rt); r.toneMapping = keep.tm; r.toneMappingExposure = keep.ex; r.autoClear = keep.ac; r.setClearColor(keep.cc, keep.ca);
  // rangées de bas en haut (WebGL) vers le canevas 2D (de haut en bas)
  const d = VWT.img.data, row = w * 4;
  for (let y = 0; y < h; y++) d.set(VWT.px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  if (dw === w && dh === h) ctx.putImageData(VWT.img, 0, 0);
  else {
    if (!VWT.tmp) VWT.tmp = document.createElement('canvas');
    if (VWT.tmp.width !== w || VWT.tmp.height !== h) { VWT.tmp.width = w; VWT.tmp.height = h; }
    VWT.tmp.getContext('2d').putImageData(VWT.img, 0, 0); ctx.drawImage(VWT.tmp, 0, 0, dw, dh);
  }
}
/* Arme construite pour la vitrine, centrée sur l'origine ; renvoie { info, size } */
function vwModel(key) {
  const info = buildGunModel(key), g = info.group;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new V3()), size = box.getSize(new V3());
  const anchors = vwAnchors(info); // dans le repère de l'arme, avant de la centrer
  g.position.sub(c); g.updateMatrixWorld(true);
  return { info, size, center: c, anchors };
}

/* ---------- Vignettes ---------- */
const VTHUMB = { w: 440, h: 176, img: {}, queue: [], busy: false, ctx: null, ready: false, fails: {} };
const VBLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // pixel transparent en attendant la vignette
const weaponThumb = (id) => VTHUMB.img[id] || VBLANK;
/* Dessine la vignette de l'arme montée key (vue de côté) et la garde ; renvoie son adresse ('' en cas d'échec : l'essai est noté, trois au plus,
   et dit dans le rapport graphique, au lieu de remplacer pour de bon la vignette par celle de l'arme nue) */
function thumbRender(key) {
  try {
    if (!VTHUMB.ctx) { const cv = document.createElement('canvas'); cv.width = VTHUMB.w; cv.height = VTHUMB.h; VTHUMB.ctx = cv.getContext('2d'); }
    const { info, size } = vwModel(key), S = vwScene(), live = VW.model && VW.model.visible ? VW.model : null; // l'arme du visuel, s'il est ouvert, ne doit pas figurer sur la vignette
    if (live) live.visible = false;
    S.scene.add(info.group);
    S.cam.aspect = VTHUMB.w / VTHUMB.h; S.cam.updateProjectionMatrix();
    vwCamPlace(S.cam, 0.3, 0.1, vwFit(size, VTHUMB.w / VTHUMB.h, 1.1), new V3());
    vwFrame(S.cam, vwScreenBox(info.group, S.cam), 0.92); // arme centrée et cadrée d'après ce qu'on voit, pas d'après sa boîte
    vwDraw(VTHUMB.ctx, VTHUMB.w, VTHUMB.h, VTHUMB.w, VTHUMB.h);
    S.scene.remove(info.group);
    if (live) live.visible = true;
    VTHUMB.img[key] = VTHUMB.ctx.canvas.toDataURL('image/webp', 0.9);
  } catch (e) { VTHUMB.fails[key] = (VTHUMB.fails[key] || 0) + 1; delete VTHUMB.img[key]; gpuLog('weapon thumbnail failed: ' + key + ' (' + VTHUMB.fails[key] + ') ' + (e && e.message)); return ''; }
  return VTHUMB.img[key];
}
/* Vignette d'une arme avec ses accessoires et son camouflage. Jamais dessinée à la demande : une classe se retrouve dans la file de dessin
   (thumbsWant), qui travaille aux menus et dans la pause, une vignette par tâche (une rafale de rendus fait perdre le contexte à certains
   téléphones). En attendant, l'arme nue : l'image est estompée (data-pend) pour qu'on ne la prenne pas pour la classe. */
function weaponThumbKey(key, id) {
  if (key === id || !VTHUMB.ready) return weaponThumb(id);
  if (!VTHUMB.img[key]) { thumbsWant(key); return weaponThumb(id); }
  return VTHUMB.img[key];
}
/* À dessiner dès que c'est permis, avant les armes nues (une classe équipée se voit tout de suite) */
function thumbsWant(key) {
  if (VTHUMB.img[key] || (VTHUMB.fails[key] || 0) >= 3 || VTHUMB.queue.includes(key)) return;
  VTHUMB.queue.unshift(key);
  if (!VTHUMB.busy) { VTHUMB.busy = true; setTimeout(thumbsStep, 60); }
}
/* Les vignettes ne se rendent qu'aux menus et dans la pause d'une partie (la partie y attend) : ni pendant qu'on joue ou qu'on charge. Au choix
   de la classe d'avant le déploiement (vue aérienne : le GPU y dessine sans cesse), sur ordinateur seulement, et seulement les armes, une par
   tiers de seconde : la page rechargée après une longue inactivité (onglet libéré par le navigateur), une partie lancée aussitôt n'avait pas
   encore ses vignettes et les cartes de classes restaient vides jusqu'au retour au menu. Sur téléphone, rien à la vue aérienne (voir la perte
   de contexte d'un Pixel au README) : les armes des classes passent en tête de file (thumbsStart), prêtes avant qu'on lance une partie */
// (UI.screen reste « deploy » pendant toute la partie : seul l'état de la partie dit si l'on est au choix de la classe d'avant le déploiement)
const thumbsDeploy = () => MATCH.state === 'menu' && UI.screen === 'deploy';
const thumbsAllowed = () => !UI.busy && MAPL.state !== 'loading' && (MATCH.state === 'paused' || (MATCH.state === 'menu' && (!thumbsDeploy() || !COARSE)));
/* Lance (ou reprend) la construction des vignettes manquantes, une par tâche, tant qu'aucune partie ne se prépare : les armes des classes
   d'abord (montées, puis nues : ce que montre le choix de la classe), les autres armes, puis les tenues (les plus longues à dessiner ;
   l'écran Tenues fait passer devant celles qu'il montre) */
function thumbsStart() {
  VTHUMB.ready = true;
  const mine = [], bare = []; for (const i of classIds()) for (const d of classWeapons(i)) {
    if (d.key !== d.id && !VTHUMB.img[d.key] && (VTHUMB.fails[d.key] || 0) < 3 && !mine.includes(d.key)) mine.push(d.key);
    if (!VTHUMB.img[d.id] && !bare.includes(d.id)) bare.push(d.id);
  }
  const sk = (l) => l.map((s) => 'skin:' + s).filter((k) => !VTHUMB.img[k]);
  VTHUMB.queue = [...mine, ...bare, ...Object.keys(WEAPONS).filter((id) => !VTHUMB.img[id] && !bare.includes(id)), ...sk(SKIN_IDS), ...sk(SKIN_DEFI), ...sk(skinOwned())];
  if (!VTHUMB.busy && VTHUMB.queue.length) { VTHUMB.busy = true; setTimeout(thumbsStep, 60); }
}
function thumbsStep() {
  if (!thumbsAllowed()) { setTimeout(thumbsStep, 600); return; } // pas pendant une partie ni un chargement
  if (!VTHUMB.queue.length) { VTHUMB.busy = false; gpuLog('weapon thumbnails done'); return; }
  const dep = thumbsDeploy(), at = dep ? VTHUMB.queue.findIndex((k) => !k.startsWith('skin:')) : 0;
  if (at < 0) { setTimeout(thumbsStep, 600); return; } // vue aérienne : les tenues attendent le retour aux menus
  const id = VTHUMB.queue.splice(at, 1)[0];
  const skin = id.startsWith('skin:');
  if (!WEAPONS[id] && !skin) { // arme montée : les essais de l'atelier qui ne sont plus une classe sont libérés (la mémoire reste bornée)
    const keep = new Set(); for (const i of classIds()) for (const d of classWeapons(i)) keep.add(d.key);
    const old = Object.keys(VTHUMB.img).filter((k) => !WEAPONS[k] && !keep.has(k) && !k.startsWith('skin:'));
    if (old.length > 30) for (const k of old.slice(0, 15)) delete VTHUMB.img[k];
  }
  const src = VTHUMB.img[id] || (skin ? skinThumbRender(id.slice(5)) : thumbRender(id));
  if (src) for (const el of document.querySelectorAll(`img[data-thumb="${id}"]`)) { el.src = src; el.removeAttribute('data-pend'); }
  setTimeout(thumbsStep, dep ? 330 : MATCH.state === 'paused' ? 260 : 40); // pause en partie, choix de la classe : une vignette par quart ou tiers de seconde
}

/* ---------- Visuel de l'atelier ---------- */
const VW = {
  host: null, cv: null, ctx: null, hotEl: null, info: null, size: new V3(1, 1, 1), model: null, key: '',
  a: 0.3, p: 0.1, d: 1, fit: 1, shift: null, needShift: true, drag: null, W: 0, H: 0, hot: {}, anchors: {}, labelOf: null, onHot: null, hotOff: null, still: false,
};
/* Points d'accroche des emplacements d'accessoires, dans le repère de l'arme (z vers la crosse) : posés sur le flanc gauche, à l'endroit
   où l'accessoire se monte, d'après les points de montage du modèle (info.mount) */
function vwAnchors(info) {
  const m = info.mount, A = {}, X = -0.034;
  if (m.optic) A.optic = [0, m.optic.y + (info.kind === 'pistol' ? 0.024 : 0.04), m.optic.z];
  if (m.muzzle) {
    A.muzzle = [X * 0.4, m.muzzle.y + 0.01, m.muzzle.z - 0.02];
    if (info.kind !== 'pistol') A.barrel = [X * 0.4, m.muzzle.y + 0.012, m.muzzle.z * (info.kind === 'sniper' ? 0.62 : 0.8)];
  }
  if (m.under) A.under = [0, m.under.y - 0.04, m.under.z];
  if (m.side) A.side = [m.side.x - 0.012, m.side.y, m.side.z];
  const mag = new THREE.Box3().setFromObject(info.mag);
  if (!info.tubeFed && mag.max.y > mag.min.y) { const c = mag.getCenter(new V3()); A.mag = [X, c.y, c.z]; }
  else if (info.tubeFed && m.side) A.mag = [X * 0.5, 0.008 - 0.03, m.side.z - 0.03];
  if (info.butt) A.stock = [X, info.butt[1] + 0.012, info.butt[2] - 0.08];
  A.ammo = info.kind === 'pistol' ? [X * 0.5, info.eject.position.y - 0.012, info.eject.position.z - 0.06] : [info.eject.position.x + 0.012, info.eject.position.y, info.eject.position.z + 0.1];
  // un point par groupe d'emplacements (ATT_GROUPS) : le premier emplacement du groupe qui a une position
  const G = {};
  for (const g of ATT_GROUPS) { const s = ATT_GROUP_SLOTS[g].find((x) => A[x]); if (s) G[g] = A[s]; }
  return G;
}
/* Monte la vitrine dans host (créé une fois par l'atelier) : canevas 2D, couche des points, entrées souris et toucher */
function vwMount(host, hooks) {
  VW.host = host; VW.labelOf = hooks.labelOf; VW.onHot = hooks.onHot; VW.hotOff = hooks.hotOff || null;
  host.innerHTML = _t('<canvas class="vw-cv" aria-hidden="true"></canvas><div class="vw-hot"></div><div class="vw-count"></div><div class="vw-corner"></div><div class="vw-help">Glissez pour faire tourner · molette pour approcher</div>');
  VW.cv = host.firstChild; VW.ctx = VW.cv.getContext('2d'); VW.hotEl = host.querySelector('.vw-hot');
  VW.hotEl.addEventListener('click', (e) => { const b = e.target.closest('.hot'); if (b) { VW.onHot(b.dataset.slot, b); sfxUi('click'); } });
  VW.cv.addEventListener('pointerdown', (e) => { VW.drag = { x: e.clientX, y: e.clientY, a: VW.a, p: VW.p }; VW.cv.setPointerCapture(e.pointerId); host.classList.add('drag'); });
  VW.cv.addEventListener('pointermove', (e) => {
    if (!VW.drag) return;
    VW.a = VW.drag.a - (e.clientX - VW.drag.x) * 0.009; VW.p = clamp(VW.drag.p + (e.clientY - VW.drag.y) * 0.006, -0.35, 1.05); VW.still = false;
  });
  const up = () => { VW.drag = null; host.classList.remove('drag'); };
  VW.cv.addEventListener('pointerup', up); VW.cv.addEventListener('pointercancel', up);
  VW.cv.addEventListener('wheel', (e) => { e.preventDefault(); VW.d = clamp(VW.d * Math.exp(e.deltaY * 0.0012), VW.fit * 0.45, VW.fit * 1.5); }, { passive: false });
  VW.cv.addEventListener('dblclick', () => vwReset());
  // clavier : flèches pour tourner quand le canevas a le focus
  VW.cv.tabIndex = 0; VW.cv.setAttribute('aria-label', _t('Arme en 3D, flèches pour la faire tourner'));
  VW.cv.addEventListener('keydown', (e) => {
    const k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    e.preventDefault();
    if (k === 'ArrowLeft') VW.a += 0.12; else if (k === 'ArrowRight') VW.a -= 0.12; else VW.p = clamp(VW.p + (k === 'ArrowDown' ? 0.08 : -0.08), -0.35, 1.05);
  });
}
/* Vue de départ : l'arme de côté, immobile (on la fait tourner en glissant) et centrée dans le cadre */
function vwReset() { VW.a = 0.3; VW.p = 0.1; VW.d = VW.fit; VW.shift = null; VW.needShift = true; }
/* L'arme affichée devient la clé donnée ; les points « + » suivent les points d'accroche de l'arme (groups : ATT_GROUPS) ; reset : retour à la vue de départ */
function vwSet(key, groups, reset) {
  const S = vwScene();
  if (VW.model) S.scene.remove(VW.model);
  const m = vwModel(key); VW.info = m.info; VW.model = m.info.group; VW.size = m.size; VW.key = key; S.scene.add(VW.model);
  VW.anchors = m.anchors;
  // les points : un bouton par emplacement que l'arme possède
  VW.hotEl.innerHTML = '';
  VW.hot = {};
  for (const slot of ATT_GROUPS) {
    if (!groups.includes(slot) || !VW.anchors[slot]) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hot'; b.dataset.slot = slot;
    VW.hotEl.appendChild(b); VW.hot[slot] = { el: b, p: new V3(...VW.anchors[slot]) };
  }
  vwLabels(); vwSize(true);
  if (reset) vwReset(); else { VW.d = clamp(VW.d, VW.fit * 0.45, VW.fit * 1.5); }
}
/* Libellés des points (« + » ou nom de l'accessoire posé), redemandés à l'atelier ; tous masqués quand l'atelier le demande (hotOff :
   la liste des camouflages, ouverte par-dessus, les recouvrait en partie) */
function vwLabels() {
  if (VW.hotEl) VW.hotEl.hidden = !!(VW.hotOff && VW.hotOff());
  for (const slot in VW.hot) {
    const L = VW.labelOf(slot), h = VW.hot[slot];
    h.el.className = 'hot' + (L.on ? ' on' : '') + (L.open ? ' open' : '') + (L.full && !L.on ? ' full' : '');
    h.el.innerHTML = `<i>${L.on ? '' : '+'}</i><span>${esc(L.text)}</span>`;
    h.el.setAttribute('aria-label', `${L.slotName} : ${L.on ? L.text : _t('ajouter un accessoire')}`);
  }
}
/* Dimensions du canevas d'après son cadre (une fois le cadre visible) ; refit : la distance de départ suit l'arme et le cadre */
function vwSize(refit) {
  const r = VW.host.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
  if (W < 20 || H < 20) return false;
  if (W !== VW.W || H !== VW.H || refit) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), bs = renderer.getDrawingBufferSize(_vwV2), k = Math.min(dpr, bs.x / W, bs.y / H);
    VW.W = W; VW.H = H; VW.cv.width = Math.max(2, Math.floor(W * k)); VW.cv.height = Math.max(2, Math.floor(H * k));
    const wasFit = VW.d === VW.fit; VW.fit = vwFit(VW.size, W / H, 1.22); if (wasFit || refit) VW.d = VW.fit;
  }
  return true;
}
/* Une image du visuel : appelée par la boucle principale tant que l'écran de l'atelier est affiché */
function vwTick(dt) {
  if (!VW.host || !VW.model || !vwSize(false)) return;
  const S = vwScene(); S.cam.aspect = VW.W / VW.H; S.cam.updateProjectionMatrix();
  vwCamPlace(S.cam, VW.a, VW.p, VW.d, _vwAim);
  // vue de départ : décalage qui centre l'arme dans le cadre, gardé ensuite tant qu'on tourne autour
  if (VW.needShift) { VW.needShift = false; const b = vwScreenBox(VW.model, S.cam); VW.shift = b ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] : null; }
  if (VW.shift) { const e = S.cam.projectionMatrix.elements; e[8] += VW.shift[0]; e[9] += VW.shift[1]; S.cam.projectionMatrixInverse.copy(S.cam.projectionMatrix).invert(); }
  vwDraw(VW.ctx, VW.cv.width, VW.cv.height, VW.cv.width, VW.cv.height);
  // points : projetés sur l'image ; celui du flanc gauche s'efface quand l'arme est vue de la droite
  const camSide = Math.cos(VW.a); // > 0 : caméra du côté gauche de l'arme
  for (const slot in VW.hot) {
    const h = VW.hot[slot]; _vwP.copy(h.p).applyMatrix4(VW.model.matrixWorld).project(S.cam);
    const x = (_vwP.x * 0.5 + 0.5) * VW.W, y = (-_vwP.y * 0.5 + 0.5) * VW.H, vis = _vwP.z < 1 && x > -20 && x < VW.W + 20 && y > -20 && y < VW.H + 20;
    h.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const fade = slot === 'side' ? clamp(camSide * 3 + 0.4, 0, 1) : 1;
    h.el.style.opacity = vis ? fade.toFixed(2) : '0'; h.el.style.pointerEvents = vis && fade > 0.3 ? 'auto' : 'none';
  }
}
const _vwAim = new V3(), _vwP = new V3();
/* Ferme la vitrine : l'arme quitte la scène (la scène d'éclairage, elle, reste) */
function vwClose() { if (VW.model && VWS.scene) VWS.scene.remove(VW.model); VW.model = null; VW.info = null; VW.hot = {}; if (VW.hotEl) VW.hotEl.innerHTML = ''; VW.drag = null; }
/* Position d'un point à l'écran (px dans le cadre), pour placer la liste d'accessoires à côté */
function vwHotPos(slot) { const h = VW.hot[slot]; if (!h) return null; const r = h.el.getBoundingClientRect(), b = VW.host.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, W: b.width, H: b.height }; }
