/* ==========================================================================
   GPU : DURCISSEMENT ET RAPPORT GRAPHIQUE
   Sur certains téléphones (Pixel 10 Pro, puce PowerVR), le pilote interrompt le contexte WebGL pendant la compilation des shaders ou la
   génération des textures : three.js plante (« reading 'trim' », il lit le journal d'un programme que le pilote a repris) ou le jeu reprend
   avec des textures noires (celles qu'on génère sur le GPU ne survivent pas à la perte du contexte). Ce n'est pas reproductible hors de
   l'appareil : ce module prévient ce qu'il peut et sait dire ce qui s'est passé.
   - les journaux de programmes ne valent plus null (c'était ce qui plantait three.js) ; la compilation des shaders d'une carte se fait par
     petits groupes, la main rendue au navigateur entre deux, avec une progression (gpuCompileScene) ; un programme refusé par le pilote est
     relevé (gpuCheckPrograms), pas ignoré ;
   - contexte perdu pendant que le jeu est affiché : le jeu passe tout seul en mode graphique économique (Settings.gfxSafe, voir 01-core.js)
     et propose de se relancer (#gpuLost) ; perdu en arrière-plan : il propose seulement de se relancer ;
   - rapport graphique (gpuReport) : pilote, limites, extensions, essais de rendu, dernières erreurs (en anglais : technique, destiné à être
     transmis tel quel) ; accessible par ?diag, par les Options
     (Vidéo) et par l'écran d'échec d'un chargement de carte. Voir README, « Version mobile ».
   ========================================================================== */
const GPUX = { lost: 0, restored: 0, lostVisible: true, lostPhase: '', armed: false, bad: [], errs: [], slow: [], culprits: [], badKeys: new Set(), fallbacks: 0, scan: false, preOk: false, bar: [], stage: '', lean: { tex: 1, sat: 0, hdri: 0, warm: 0, probe: 0 }, booting: false, booted: false, wait: 0, barTag: '', info: null, reloading: false, halt: false };
/* Journal des interruptions, gardé d'une page à l'autre (le rechargement efface la mémoire de la page, pas le stockage) : dc_gpu_last décrit la dernière
   (étape du chargement, dernier programme demandé, mémoire), dc_gpu_bad liste les familles de programmes refusées par l\u0027appareil pour ce build */
const GPU_LAST = 'dc_gpu_last', GPU_BAD = 'dc_gpu_bad';
const gpuRead = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const gpuWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignoré */ } };
/* Journal chronologique (dc_gpu_tl, 70 événements), gardé d'une page à l'autre : ce que le jeu et le joueur ont fait jusqu'à l'interruption (fenêtre d'installation,
   démarrage, écrans ouverts, étapes du chargement, barrières, perte et reprise du contexte). L'état final d'un rapport ne dit pas ce qui a précédé : c'est
   l'enchaînement qui désigne l'étape en cause (un rapport pris au menu, sans carte chargée, montrait une perte survenue sans aucun chargement). */
const GPU_TL = "dc_gpu_tl", GPU_PAGE = Math.floor(Date.now() / 1000).toString(36).slice(-3);
const GPU_EV = (() => { const v = gpuRead(GPU_TL); return Array.isArray(v) ? v.slice(-70) : []; })();
function gpuLog(m) {
  m = String(m).slice(0, 90); const l = GPU_EV[GPU_EV.length - 1];
  if (l && l[1] === GPU_PAGE && l[2] === m) { l[0] = Date.now(); l[3] = (l[3] || 1) + 1; } // le même message répété (une erreur à chaque image) : une ligne, comptée
  else { GPU_EV.push([Date.now(), GPU_PAGE, m]); if (GPU_EV.length > 70) GPU_EV.shift(); }
  gpuWrite(GPU_TL, GPU_EV);
}
gpuLog(`page ${String(BUILD).slice(0, 7)} ${matchMedia("(display-mode: standalone)").matches ? "installed" : "browser"} ${innerWidth}x${innerHeight} ${document.visibilityState}`);
document.addEventListener("visibilitychange", () => gpuLog("page " + document.visibilityState));
addEventListener("pagehide", () => gpuLog("pagehide"));
document.addEventListener("fullscreenchange", () => gpuLog("fullscreen " + (document.fullscreenElement ? "on" : "off")));
try { screen.orientation.addEventListener("change", () => gpuLog("orientation " + screen.orientation.type)); } catch (e) { /* ignoré */ }
{ let rt = 0; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => gpuLog(`resize ${innerWidth}x${innerHeight}`), 400); }); }
{ const b = gpuRead(GPU_BAD); if (b && b.b === BUILD && Array.isArray(b.keys)) for (const k of b.keys) GPUX.badKeys.add(k); } // d\u0027un autre build : les shaders ont pu changer, on réessaie
const GPU_LEAN = 'dc_gpu_lean';
/* Adaptation apprise sur cet appareil : quand une perte du contexte est attribuée à une étape du chargement (voir gpuBarrier), l\u0027étape suivante est allégée
   (textures procédurales plus petites, relevé satellite en basse résolution, ciel procédural au lieu de l\u0027HDRI) ; gardée par build, relue au démarrage */
{ const l = gpuRead(GPU_LEAN); if (l && l.b === BUILD) Object.assign(GPUX.lean, { tex: l.tex || 1, sat: l.sat || 0, hdri: l.hdri || 0, warm: l.warm || 0, probe: l.probe || 0 }); }
function gpuJournal() {
  const m = performance.memory, L = typeof MAPL !== 'undefined' ? MAPL : {};
  gpuWrite(GPU_LAST, { b: BUILD, t: new Date().toISOString(), after: Math.round(performance.now()), visible: GPUX.lostVisible, map: L.id || '', step: L.msg || '', p: +(L.p || 0).toFixed(2), cur: GPUX.cur || '', safe: GFX_SAFE, tier: RQ.tier, heapMB: m ? Math.round(m.usedJSHeapSize / 1048576) : null, devMem: navigator.deviceMemory || null, culprits: GPUX.culprits.slice(0, 6) });
}
/* Unités de texture par programme : 16 sur ordinateur, 13 sur un Pixel (PowerVR via ANGLE, d'après son rapport graphique). Un programme qui en demande plus est
   refusé, ou fait perdre le contexte pendant sa compilation : le sol à mélange en voulait 16 sur toutes les cartes. TEX_LEAN : les matières qui en dépassent
   la limite passent en variante sobre (voir groundMat, 02c-materials.js ; il est contrôlé par tools/dev/visual/unites.js). */
const TEXU = { max: renderer.capabilities.maxTextures || 16 };
const TEX_LEAN = TEXU.max < 16;
{
  // le journal d'un programme ou d'un shader vaut null quand le pilote a repris le contexte : three.js le lit avec .trim() et plantait (« reading 'trim' ») ;
  // vide, il lit « aucune erreur » et le chargement continue jusqu'au contrôle de gpuCompileScene (contexte perdu : échec clair)
  const gl = renderer.getContext();
  for (const k of ['getProgramInfoLog', 'getShaderInfoLog']) { const f = gl[k].bind(gl); gl[k] = (o) => f(o) || ''; }
  canvas.addEventListener('webglcontextlost', () => gpuLost(), false);
  canvas.addEventListener('webglcontextrestored', () => gpuRestoredEvent(), false);
  // dernières erreurs de la page, pour le rapport
  const keep = (m) => { GPUX.errs.push(String(m).slice(0, 220)); if (GPUX.errs.length > 6) GPUX.errs.shift(); gpuLog("error: " + m); };
  addEventListener('error', (e) => keep((e && e.message) || 'erreur'));
  addEventListener('unhandledrejection', (e) => keep('promesse : ' + ((e && e.reason && (e.reason.message || e.reason)) || '')));
}
const gpuLostNow = () => { try { return renderer.getContext().isContextLost(); } catch (e) { return false; } };
/* Caractéristiques du GPU, relevées une fois au chargement (le contexte est sain) : après une perte, le pilote ne répond plus et le rapport n'aurait que des « null » */
function gpuInfoLines() {
  const gl = renderer.getContext(), P = (n) => { try { return gl.getParameter(n); } catch (e) { return "?"; } };
  let ur = "?", uv = "?"; try { const x = gl.getExtension("WEBGL_debug_renderer_info"); if (x) { ur = P(x.UNMASKED_RENDERER_WEBGL); uv = P(x.UNMASKED_VENDOR_WEBGL); } } catch (e) { /* ignoré */ }
  const hp = (() => { try { const f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); return f ? f.rangeMax + "/" + f.precision : "?"; } catch (e) { return "?"; } })();
  const ext = (n) => { try { return gl.getExtension(n) ? "yes" : "no"; } catch (e) { return "?"; } };
  return [
    `WebGL ${renderer.capabilities.isWebGL2 ? 2 : 1} · ${P(gl.VENDOR)} · ${P(gl.RENDERER)}`,
    `driver: ${uv} · ${ur}`,
    `max texture ${P(gl.MAX_TEXTURE_SIZE)} · 3D ${renderer.capabilities.isWebGL2 ? P(gl.MAX_3D_TEXTURE_SIZE) : "-"} · units ${P(gl.MAX_TEXTURE_IMAGE_UNITS)} · fragment uniforms ${P(gl.MAX_FRAGMENT_UNIFORM_VECTORS)} · varyings ${P(gl.MAX_VARYING_VECTORS)} · samples ${renderer.capabilities.isWebGL2 ? P(gl.MAX_SAMPLES) : "-"} · highp ${hp}`,
    `extensions: float target ${ext("EXT_color_buffer_float")} · half-float target ${ext("EXT_color_buffer_half_float")} · float linear ${ext("OES_texture_float_linear")}`,
  ];
}
GPUX.info = gpuInfoLines();

/* Erreur d\u0027une perte du contexte (le chargement s\u0027arrête, la page peut se relancer d\u0027elle-même, voir gpuAutoRetry) */
const gpuError = () => Object.assign(new Error(_t('affichage 3D interrompu par l\u0027appareil')), { gpuLost: true });
const GPU_LEAN_OF = { textures: 'tex', satellite: 'sat', environment: 'hdri', 'before compile': 'hdri', warmup: 'warm', probes: 'probe' }; // étape du chargement (gpuBarrier) : ce qu'on allège
/* Perte du contexte attribuée à une étape : on l'allège pour le chargement suivant. Les textures rétrécissent (0,7 puis 0,5) ; le relevé satellite passe en
   basse résolution (1), puis n'est plus rendu sur le GPU (2) ; le ciel procédural remplace l'HDRI ; l'image d'échauffement (warmupRender) est sautée : le premier
   rendu de la partie compile alors ce qui restait ; les reflets du décor dans l'eau (waterProbes) ne sont plus rendus : l'eau reflète le ciel */
function gpuStageLost(tag) {
  GPUX.stage = tag; GPUX.culprits.push('(stage) ' + tag);
  const k = GPU_LEAN_OF[String(tag).split(' ')[0] === 'before' ? 'before compile' : String(tag).split(' ')[0]];
  if (k === 'tex') GPUX.lean.tex = Math.max(0.5, GPUX.lean.tex * 0.7); else if (k === 'sat') GPUX.lean.sat = Math.min(2, GPUX.lean.sat + 1); else if (k) GPUX.lean[k] = 1;
  { const v = gpuRead(GPU_OK); if (v && v.maps) gpuWrite(GPU_OK, { b: v.b, maps: v.maps.filter((m) => typeof MAPL === "undefined" || m !== MAPL.id) }); } // à re-balayer au prochain chargement
  gpuLog("lost at stage " + tag + " -> lean textures x" + GPUX.lean.tex.toFixed(2) + " satellite " + GPUX.lean.sat + " hdri " + GPUX.lean.hdri + " warm " + GPUX.lean.warm + " probe " + GPUX.lean.probe);
  gpuWrite(GPU_LEAN, Object.assign({ b: BUILD }, GPUX.lean)); gpuJournal();
}
/* Attend, sans bloquer la page, que le GPU ait fini tout ce qui lui a été demandé : une barrière (fenceSync) dont on interroge l'état toutes les 8 ms. gl.finish() ne
   convient pas : Chrome en fait un simple envoi de commandes, il n'attend pas le GPU (le rapport d'un Pixel donnait « 0 ms » pour une étape qui venait de générer
   toutes les textures). Rend la durée d'attente en ms ; la perte du contexte, annoncée par un message du processus graphique, arrive pendant ces pauses. */
async function gpuFence(maxMs = 20000) {
  const gl = renderer.getContext(), t0 = performance.now(); let sync = null;
  try { sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { sync = null; }
  if (!sync) { try { gl.finish(); } catch (e) { /* ignoré */ } await new Promise((r) => setTimeout(r, 30)); return Math.round(performance.now() - t0); }
  while (performance.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, 8));
    if (gpuLostNow()) break;
    let st = null; try { st = gl.getSyncParameter(sync, gl.SYNC_STATUS); } catch (e) { break; }
    if (st === gl.SIGNALED) break;
  }
  const ms = Math.round(performance.now() - t0);
  try { gl.deleteSync(sync); } catch (e) { /* ignoré */ }
  await new Promise((r) => setTimeout(r, 24));
  return ms;
}
/* Barrière d'étape : le GPU a fini ce qui précède (gpuFence), la durée de l'étape est mesurée (rapport, journal), et une perte du contexte est attribuée à l'étape qui vient
   de finir, pas au premier programme compilé ensuite. Sur téléphone ou en mode économique seulement ; ordinateur : rien. */
async function gpuBarrier(tag) {
  if (!(COARSE || GFX_SAFE)) return;
  GPUX.barTag = tag;
  const ms = await gpuFence();
  GPUX.bar.push([tag, ms]); if (GPUX.bar.length > 14) GPUX.bar.shift();
  gpuLog(`barrier ${tag} ${ms} ms${gpuLostNow() ? " LOST" : ""}`);
  if (gpuLostNow()) { gpuStageLost(tag); throw gpuError(); }
}
/* Rechargement automatique après une perte du contexte pendant un chargement (les textures générées sur le GPU sont perdues, la page est à refaire) : au plus
   trois fois par session (chaque perte attribuée à la page peut la faire bloquer par Chrome quelques minutes : 00b-preflight.js), puis la fenêtre « Affichage 3D interrompu » reprend la main ; le lancement d\u0027une partie solo reprend ensuite tout seul */
function gpuAutoRetry(mapId) {
  if (GPUX.reloading) return true; // un rechargement est déjà prévu (la reprise du contexte arrive souvent entre l'échec du chargement et le rechargement) : un seul essai compté
  let n = 0; try { n = +sessionStorage.getItem('dc_gpu_auto') || 0; } catch (e) { n = 9; }
  if (n >= 3) { gpuLog("no more automatic reloads (" + n + ")"); return false; }
  try { sessionStorage.setItem('dc_gpu_auto', String(n + 1)); if (mapId) sessionStorage.setItem('dc_gpu_resume', JSON.stringify({ map: mapId, t: Date.now() })); } catch (e) { return false; }
  GPUX.reloading = true; gpuLog("automatic reload " + (n + 1) + " map " + (mapId || "-"));
  const m = document.getElementById('mlMsg'); if (m) m.textContent = _t('L\u0027affichage 3D a été interrompu. Le jeu s\u0027adapte à votre appareil et se relance...');
  setTimeout(() => { PAGE_LEAVE.ok = true; location.reload(); }, 1500);
  return true;
}
/* Au menu prêt : la partie solo interrompue par un rechargement automatique reprend (moins de dix minutes après : Chrome peut bloquer l\u0027affichage 3D quelques minutes, voir 00b-preflight.js) */
function gpuResume() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem('dc_gpu_resume') || 'null'); sessionStorage.removeItem('dc_gpu_resume'); } catch (e) { r = null; }
  if (!r || Date.now() - r.t > 600000 || !MAP_DEFS[r.map]) return;
  Settings.map = r.map; saveSettings();
  menuLaunch({ online: false, map: r.map, deploy: () => startMatch() });
}
/* Fenêtre « Affichage 3D interrompu » : message selon le cas */
function gpuShowOverlay() {
  const el = document.getElementById('gpuLost'); if (!el) return;
  document.getElementById('glMsg').textContent = !GPUX.lostVisible
    ? _t('L\u0027affichage 3D a été interrompu pendant que le jeu était en arrière-plan. Relancez le jeu pour le reprendre.')
    : GPUX.culprits.length ? _t('Votre appareil a refusé certains rendus du jeu. Relancez le jeu. Ils seront remplacés par des versions simples (voir le rapport graphique).')
      : GPUX.armed ? _t('Votre appareil a interrompu l\u0027affichage 3D du jeu (mémoire ou temps de calcul graphique). Le mode graphique économique est activé. Relancez le jeu.')
        : !GFX_SAFE ? _t("L'affichage 3D a été interrompu par l'appareil. Relancez le jeu pour le reprendre.")
          : _t('L\u0027affichage 3D a encore été interrompu, même en mode graphique économique. Relancez le jeu. Si cela se répète, ouvrez le rapport graphique.');
  el.classList.remove('hidden');
}
/* Premières images d'un rendu 3D continu (vue aérienne, partie) : un rapport d'un Pixel montrait le chargement d'une carte mené à son terme (barrières, balayage, relevé,
   image d'échauffement : tout sain) puis le contexte perdu 0,7 s après le début de la vue aérienne. Le journal garde donc le numéro de l'image, sa cadence, le travail demandé
   et, grâce à une barrière (gpuFence) non bloquante, le temps GPU réel de quelques images ; une perte est datée en images. GPUF.t0 : début du rendu en cours (une pause de 2,5
   secondes le remet à zéro) ; la résolution dynamique n'y touche pas pendant 5 s (updateDynRes, 01-core.js). */
const GPUF = { n: 0, last: -1e9, t0: -1e9, progs: 0, beat: 0 };
/* Programmes compilés depuis le rang from : à quels objets de la scène (ou de la vue subjective) ils servent. Seulement quand il y en a de nouveaux en partie
   (rare : la compilation elle-même fige déjà l'image) ; un programme d'ombre ou de profondeur, sans objet propre, donne son seul nom de shader. */
function gpuProgNames(from) {
  const P = (renderer.info.programs || []).slice(from), set = new Set(P), out = new Set();
  const look = (root) => root && root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (set.has(renderer.properties.get(m).currentProgram)) out.add(`${o.name || (o.parent && o.parent.name) || o.type}/${m.name || m.type}`);
  });
  look(scene); if (typeof vmScene !== 'undefined') look(vmScene);
  return out.size ? [...out].slice(0, 4).join(', ') : P.map((p) => p.name).join(', ');
}
/* Étalon du GPU : un calcul toujours identique (256 x 256 pixels d'un shader de boucles, hors de la toile du jeu), chronométré toutes les 15 s de partie. Il ne
   dépend ni de la carte ni de la scène : s'il prend de plus en plus de temps, c'est la puce qui ralentit (chauffe, limite de puissance d'un portable qui retombe
   après son élan des premières dizaines de secondes), pas le jeu qui lui en demande plus. Seulement avec les requêtes de chronométrage (jamais sur téléphone). */
const GREF = { rt: null, sc: null, cam: null, q: null, ms: 0, first: 0 };
/* Cible, scène et programme de l'étalon, préparés et dessinés une fois au chargement de la carte (mapCompile) : pas de compilation en pleine partie */
function gpuRefPrep() {
  if (!GPUT || GREF.rt) return;
  GREF.rt = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: false });
  GREF.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const m = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'void main() { vec2 p = gl_FragCoord.xy / 256.0; float a = p.x + p.y; for (int i = 0; i < 96; i++) { a = sin(a * 1.31 + p.x) * cos(a * 0.73 + p.y) + fract(a * 3.17); } gl_FragColor = vec4(a, 0.0, 0.0, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false;
  GREF.sc = new THREE.Scene(); GREF.sc.add(q);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(GREF.rt); renderer.render(GREF.sc, GREF.cam); renderer.setRenderTarget(prev);
}
function gpuRefRun() {
  if (!GPUT || GREF.q) return;
  gpuRefPrep();
  const gl = GPUT.gl, prev = renderer.getRenderTarget();
  GREF.q = gl.createQuery(); gl.beginQuery(GPUT.ext.TIME_ELAPSED_EXT, GREF.q);
  renderer.setRenderTarget(GREF.rt); renderer.render(GREF.sc, GREF.cam); renderer.setRenderTarget(prev);
  gl.endQuery(GPUT.ext.TIME_ELAPSED_EXT);
}
/* Résultat de la mesure précédente (disponible quelques images plus tard) ; GREF.first : la première de la page, la référence */
function gpuRefPoll() {
  if (!GREF.q) return;
  const gl = GPUT.gl; if (!gl.getQueryParameter(GREF.q, gl.QUERY_RESULT_AVAILABLE)) return;
  if (!gl.getParameter(GPUT.ext.GPU_DISJOINT_EXT)) { GREF.ms = gl.getQueryParameter(GREF.q, gl.QUERY_RESULT) / 1e6; if (!GREF.first) GREF.first = GREF.ms; }
  gl.deleteQuery(GREF.q); GREF.q = null;
}
function gpuFrame(now) {
  if (now - GPUF.last > 2500) { GPUF.n = 0; GPUF.t0 = now; }
  const gap = now - GPUF.last; GPUF.last = now; const n = ++GPUF.n;
  // partie : un état toutes les 15 s (cadence, travail, mémoire), une image anormalement longue, et tout programme compilé en cours de partie (sur iPhone, une compilation
  // prend près d'une seconde et bloque l'image) : le journal montre ce qui précède une interruption
  const np = (renderer.info.programs || []).length;
  if (MATCH.state === 'playing') {
    if (np > GPUF.progs && GPUF.progs) gpuLog(`match: ${np - GPUF.progs} new program(s) compiled (total ${np}): ${gpuProgNames(GPUF.progs)}`);
    if (gap > 250 && gap < 2500 && n > 1) gpuLog(`match: long frame ${Math.round(gap)} ms`);
    if (now - GPUF.beat > 15000) {
      GPUF.beat = now; const i = renderer.info.render, m = renderer.info.memory, h = performance.memory;
      gpuLog(`match ${Math.round(MATCH.time)} s: ${Math.round(DYN.stat.fps)} fps, calls ${i.calls}, tris ${Math.round(i.triangles / 1000)}k, tex ${m.textures}, geo ${m.geometries}, prog ${np}${h ? ', heap ' + Math.round(h.usedJSHeapSize / 1048576) + ' MB' : ''}`);
      if (GPUT) gpuRefPoll();
      gpuLog(`  cpu ${DYN.cpu.toFixed(1)} ms${DYN.gpu ? ', gpu ' + DYN.gpu.toFixed(1) + ' ms' : ''}${GREF.ms ? ', gpu ref ' + GREF.ms.toFixed(2) + ' ms (x' + (GREF.ms / GREF.first).toFixed(2) + ')' : ''}, ${RQ.tier} ${RQ.scale.toFixed(2)}${LAG.on || LAG.n ? ', short queue ' + (LAG.on ? 'on' : 'off') + ' (' + LAG.n + ' skipped)' : ''}`); LAG.n = 0;
      if (GPUT) gpuRefRun(); // étalon : mesuré maintenant, lu au prochain état
      { const c = typeof AU !== 'undefined' && AU.ctx, ps = c && c.playbackStats; if (c) gpuLog(`audio ${c.state}: ${ps ? 'underruns ' + ps.underrunEvents + ' (' + Math.round(ps.underrunDuration * 1000) + ' ms), ' : ''}shed ${AU.shed}`); }
    }
  }
  GPUF.progs = np;
  if (n === 1 || n === 2 || n === 5 || n === 10 || n === 20 || n === 40 || n === 80) {
    const i = renderer.info.render;
    gpuLog(`frame ${n} (+${Math.round(now - GPUF.t0)} ms) calls ${i.calls} tris ${Math.round(i.triangles / 1000)}k scale ${RQ.scale.toFixed(2)}`);
    if (n === 1 || n === 10 || n === 40) gpuFence(4000).then((ms) => gpuLog(`frame ${n} done by the GPU after ${ms} ms`));
  }
}
/* Où en est le jeu : fenêtre d'installation (rien n'est encore construit), démarrage, menus, vue aérienne du choix de la classe, chargement d'une carte, partie */
function gpuPhase() {
  if (!GPUX.booted) return GPUX.booting ? "boot" : "gate";
  if (MAPL.state === "loading") return "loading";
  if (MATCH.state === "menu") return UI.screen === "deploy" ? "aerial" : "menu";
  return "match";
}
/* Le pilote a repris le contexte. Seule une perte pendant que le jeu dessine (chargement d'une carte, vue aérienne, partie) dit que l'appareil est dépassé : mode
   économique pour la suite si le jeu était affiché. À la fenêtre d'installation, au démarrage, dans les menus ou en arrière-plan, le pilote peut reprendre le
   contexte sans rapport avec le jeu (un rapport en montrait une à l'installation, 137 s après l'ouverture, sans qu'aucun rendu n'ait eu lieu) : pas de mode
   économique, et la fenêtre « Affichage 3D interrompu » attend la reprise (gpuRestoredEvent) au lieu de s'imposer. */
function gpuLost() {
  GPUX.lost++; GPUX.lostVisible = document.visibilityState !== "hidden";
  const ph = GPUX.lostPhase = gpuPhase();
  gpuLog(`context LOST (${ph}, ${GPUX.lostVisible ? "visible" : "background"}${GPUF.n && performance.now() - GPUF.last < 5000 ? ", frame " + GPUF.n : ""})`);
  if (GPUX.lostVisible && !Settings.gfxSafe && (ph === "loading" || ph === "aerial" || ph === "match")) { Settings.gfxSafe = true; Settings.gfxSafeAuto = BUILD; saveSettings(); GPUX.armed = true; }
  // téléphone : une perte pendant que le jeu dessine coupe aussi les ombres calculées pour 30 jours (les cartes d'ombre sont ce que le pilote d'un Pixel ne supporte pas,
  // voir NO_SHADOWS dans 01-core.js) ; chaque perte faisant bloquer le site par Chrome jusqu'à son redémarrage, on ne réessaie pas à chaque chargement
  if (COARSE && !NO_SHADOWS && GPUX.lostVisible && (ph === "loading" || ph === "aerial" || ph === "match")) { gpuWrite("dc_gpu_noshadow", { t: Date.now(), b: BUILD }); gpuLog("real-time shadows off for the next launches"); }
  // en partie ou à la vue aérienne : la boucle d'images cesse de dessiner (ce que le jeu avait généré sur le GPU est perdu ; three.js levait une erreur à chaque image, un
  // iPhone en a noyé son journal) ; la fenêtre « Affichage 3D interrompu » propose de relancer
  if (ph === "match" || ph === "aerial") GPUX.halt = true;
  gpuJournal();
  if (ph === "gate" || ph === "boot" || ph === "menu") { clearTimeout(GPUX.wait); GPUX.wait = setTimeout(() => { if (gpuLostNow()) gpuShowOverlay(); }, 8000); return; } // le navigateur rend le contexte de lui-même
  if (!GPUX.scan) gpuShowOverlay(); // pendant l'inventaire des programmes (gpuCompileScene), la fenêtre attend la fin
}
/* Contexte repris : à la fenêtre d'installation, rien n'avait été construit, il n'y a rien à refaire ; au démarrage ou aux menus, ce que le jeu
   avait généré sur le GPU (textures procédurales, éclairage) est perdu : la page se relance d'elle-même (gpuAutoRetry, au plus trois fois par session) */
function gpuRestoredEvent() {
  GPUX.restored++; clearTimeout(GPUX.wait);
  const ph = gpuPhase(); gpuLog(`context restored (${ph})`);
  // la vue aérienne n'est pas relancée d'elle-même : la perte y est attribuée à la page (Chrome peut alors la bloquer quelques minutes), la fenêtre « Affichage 3D interrompu » reste, avec le rapport
  if (ph === "boot" || ph === "menu") { if (!gpuAutoRetry(null)) gpuShowOverlay(); }
}
/* Attend la reprise du contexte (le navigateur le rend de lui-même, three.js a alors tout réinitialisé) */
async function gpuRestored(ms) {
  const r0 = GPUX.restored;
  for (let t = 0; t < ms; t += 100) { if (GPUX.restored > r0) return true; await new Promise((r) => setTimeout(r, 100)); }
  return GPUX.restored > r0;
}
/* Famille d\u0027un programme : type de matière, définitions, textures, peau et instances ; stable d\u0027un chargement à l\u0027autre (sert à retrouver les rendus refusés) */
function gpuProgKey(o, m) {
  const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'envMap', 'alphaMap', 'emissiveMap', 'bumpMap'].filter((k) => m[k]).join('+');
  const wm = m.userData && m.userData.wmU ? Object.keys(m.userData.wmU).filter((k) => /^t[A-Z]/.test(k)).sort().join('+') : '';
  return [m.type, Object.keys(m.defines || {}).sort().join(','), maps, wm, o.isSkinnedMesh ? 'S' : '', o.isInstancedMesh ? 'I' : '', m.isShaderMaterial ? m.name || '' : ''].join('|');
}
/* Remplace, dans root, les rendus que l\u0027appareil a refusés lors d\u0027un chargement précédent de ce build : matière standard par une matière simple sans
   éclairage (texture et teinte, assombries), autre matière : objet masqué. Le jeu reste jouable, moins beau. */
function gpuApplyFallbacks(root) {
  if (!GPUX.badKeys.size) return 0;
  let n = 0; const cache = new Map();
  root.traverse((o) => {
    const m = o.material; if (!m || Array.isArray(m) || o.userData.gpuFallback) return;
    if (!GPUX.badKeys.has(gpuProgKey(o, m))) return;
    if (!cache.has(m)) {
      const f = m.isMeshStandardMaterial ? new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color ? m.color.clone().multiplyScalar(0.6) : 0x999999, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, vertexColors: m.vertexColors }) : null;
      if (f) f.name = 'repli';
      cache.set(m, f);
    }
    const f = cache.get(m); if (f) o.material = f; else o.visible = false;
    o.castShadow = false; o.userData.gpuFallback = 1; n++;
  });
  GPUX.fallbacks += n; return n;
}

/* Compile les programmes d'une scène par petits groupes, en rendant la main au navigateur entre deux (page vivante, progression visible, pilote
   non saturé) ; renderer.compile(scene) d'un bloc occupait le fil principal pendant toute la compilation, des dizaines de secondes sur un
   téléphone, et c'est là que le pilote reprenait le contexte. three.js r147 attend la liaison de chaque programme (getUniforms) : la
   compilation parallèle du navigateur n'y change rien. Un objet par matière et par jeu d'attributs suffit (le programme est partagé) ;
   les compilations lentes sont relevées pour le rapport. onProg(faits, total). */
async function gpuCompileScene(sc, cam, onProg) {
  // compilation en parallèle (ordinateur, KHR_parallel_shader_compile) : three.js ne lit plus l'état de chaque programme juste après son édition
  // de liens (checkShaderErrors, qui obligeait le pilote à les compiler un par un) ; on attend ensuite qu'ils soient tous prêts (gpuProgramsReady),
  // puis gpuCheckPrograms les vérifie. Sur téléphone, la compilation reste une par une : elle désigne le programme qui ferait perdre le contexte
  const par = !COARSE && renderer.extensions.has('KHR_parallel_shader_compile');
  if (par) renderer.debug.checkShaderErrors = false;
  const seen = new Map();
  sc.traverse((o) => {
    const m = o.material; if (!m) return;
    const g = o.geometry && o.geometry.attributes ? Object.keys(o.geometry.attributes).join() : '';
    for (const mm of Array.isArray(m) ? m : [m]) {
      const k = mm.uuid + '|' + o.type + (o.isInstancedMesh ? (o.instanceColor ? 'ic' : 'i') : '') + (o.isSkinnedMesh ? 's' : '') + '|' + g;
      if (!seen.has(k)) seen.set(k, o);
    }
  });
  const objs = [...seen.values()], total = objs.length; let n = 0, t = performance.now();
  GPUX.scan = true;
  try {
    for (const o of objs) {
      sc.traverse = (f) => f(o); // renderer.compile ne visite que cet objet (les lumières, elles, viennent de traverseVisible)
      const mt = Array.isArray(o.material) ? o.material[0] : o.material, key = gpuProgKey(o, mt);
      GPUX.cur = `${key} ${mt.name || o.name || o.type} ${n + 1}/${total}`; // dernier programme demandé : celui qui a fait perdre le contexte, le cas échéant
      const t1 = performance.now(); renderer.compile(sc, cam); const ms = performance.now() - t1;
      if (gpuLostNow()) {
        // le pilote a repris le contexte pendant ce programme : on le note (page et stockage), on attend la reprise et on continue, pour dresser en un seul
        // chargement la liste complète des programmes refusés ; le chargement échouera quand même (les textures générées sur le GPU sont perdues)
        GPUX.culprits.push(GPUX.cur); if (GPUX.preOk) { GPUX.badKeys.add(key); gpuWrite(GPU_BAD, { b: BUILD, keys: [...GPUX.badKeys] }); } gpuJournal(); // famille retenue seulement si le contexte était sain avant ce programme
        if (GPUX.culprits.length > 12 || !(await gpuRestored(8000))) break;
        n++; continue;
      }
      if (ms > 200) { GPUX.slow.push([(o.material && (o.material.type || '')) + ' ' + (o.name || o.type), Math.round(ms)]); GPUX.slow.sort((a, b) => b[1] - a[1]); GPUX.slow.length = Math.min(GPUX.slow.length, 4); }
      n++;
      if (performance.now() - t > 120) {
        if (onProg) onProg(n, total);
        await new Promise((r) => setTimeout(r, 0)); t = performance.now();
        if (gpuLostNow()) { GPUX.culprits.push('(between programs) ' + GPUX.cur); gpuJournal(); break; }
      }
    }
  } finally { delete sc.traverse; GPUX.scan = false; if (par) renderer.debug.checkShaderErrors = true; }
  if (par) await gpuProgramsReady();
  if (GPUX.culprits.length || gpuLostNow()) { gpuShowOverlay(); throw gpuError(); }
  if (onProg) onProg(total, total);
}
/* Attend que le pilote ait fini de compiler tous les programmes lancés en parallèle (COMPLETION_STATUS_KHR), la main rendue au navigateur entre
   deux relevés ; au plus 60 s (au-delà, le premier usage d'un programme attendra de lui-même) */
async function gpuProgramsReady() {
  const gl = renderer.getContext(), ext = renderer.extensions.get('KHR_parallel_shader_compile'), t0 = performance.now();
  if (!ext) return;
  for (;;) {
    let wait = false;
    for (const p of renderer.info.programs || []) if (!gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) { wait = true; break; }
    if (!wait || gpuLostNow() || performance.now() - t0 > 60000) return;
    await new Promise((r) => setTimeout(r, 8));
  }
}
/* Balayage des dessins : un rendu minuscule par famille de programme, de ses objets seuls (ombres comprises), avec une barrière après chacun. Le rapport d'un Pixel
   montrait le contexte perdu au premier rendu d'ensemble de la scène (le relevé satellite), même en basse définition et sans anticrénelage, après une douzaine de
   programmes : ce n'est pas la taille de l'image, c'est un dessin précis. gpuCompileScene ne le voit pas (compiler n'est pas dessiner). Le premier essai est un rendu
   à vide (cible, ombres : le socle) ; une perte à celui-là n'incrimine aucune famille. Une famille qui fait perdre le contexte est notée comme par gpuCompileScene
   (dc_gpu_bad, remplacée ensuite par gpuApplyFallbacks), on attend la reprise et on continue : la liste complète en un seul chargement. cam : la caméra du relevé,
   dans l'état qu'elle demande (buildSatelliteMap). Les cartes passées sans incident sont gardées par build (dc_gpu_ok) : pas de nouveau balayage. */
const GPU_OK = "dc_gpu_ok";
const gpuScanDone = (id) => { const v = gpuRead(GPU_OK); return !!(v && v.b === BUILD && v.maps && v.maps.includes(id)); };
async function gpuDrawScan(sc, cam, id) {
  const all = [], reps = new Map();
  sc.traverse((o) => {
    const m = o.material; if (!m || !(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    all.push([o, o.visible]);
    if (!o.visible) return;
    const mt = Array.isArray(m) ? m[0] : m, key = gpuProgKey(o, mt);
    if (!reps.has(key)) reps.set(key, o);
  });
  const keys = [null, ...reps.keys()], bad = []; let empty = false; const t0 = performance.now();
  const rt = new THREE.WebGLRenderTarget(96, 96, { type: THREE.HalfFloatType }), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  GPUX.scan = true; GPUX.barTag = "draw";
  try {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], rep = key === null ? null : reps.get(key);
      for (const [o] of all) o.visible = o === rep;
      GPUX.cur = `draw ${key === null ? "(empty)" : key} ${i}/${keys.length - 1}`;
      renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x2a2620, 1); renderer.clear(); renderer.render(sc, cam); renderer.setRenderTarget(null);
      await gpuFence();
      if (gpuLostNow()) {
        gpuLog("draw scan LOST at " + GPUX.cur);
        if (key === null) { empty = true; break; }
        GPUX.culprits.push(GPUX.cur); GPUX.badKeys.add(key); bad.push(key); gpuJournal();
        if (bad.length >= 3 || !(await gpuRestored(8000))) break; // pas plus de trois : chaque perte attribuée à la page peut la faire bloquer par Chrome
      }
    }
  } finally {
    for (const [o, v] of all) o.visible = v;
    renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); try { rt.dispose(); } catch (e) { /* ignoré */ }
    GPUX.scan = false;
  }
  gpuLog(`draw scan: ${keys.length - 1} families, ${bad.length} refused, ${Math.round(performance.now() - t0)} ms`);
  if (empty) { gpuStageLost("satellite (empty render)"); throw gpuError(); }
  if (bad.length) { gpuWrite(GPU_BAD, { b: BUILD, keys: [...GPUX.badKeys] }); gpuShowOverlay(); throw gpuError(); }
  const v = gpuRead(GPU_OK); gpuWrite(GPU_OK, { b: BUILD, maps: [...new Set([...(v && v.b === BUILD && v.maps || []), id])] });
}
/* Programmes refusés par le pilote (liaison échouée) ou qui demandent plus d'unités de texture que la limite ; GPUX.samp : le plus gourmand */
function gpuCheckPrograms() {
  const gl = renderer.getContext(), bad = [];
  const SAMP = new Set([0x8B5E, 0x8B5F, 0x8B60, 0x8B62, 0x8DC1, 0x8DC2, 0x8DC3, 0x8DC4, 0x8DCA, 0x8DCB, 0x8DCC, 0x8DCF, 0x8DD1, 0x8DD2, 0x8DD3, 0x8DD4, 0x8DD5]);
  GPUX.samp = { n: 0, name: '' };
  for (const p of renderer.info.programs || []) {
    if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
      let log = ''; try { log = String(gl.getProgramInfoLog(p.program) || '').replace(/\s+/g, ' ').slice(0, 240); } catch (e) { /* ignoré */ }
      bad.push({ name: p.name, log }); continue;
    }
    let n = 0; const names = [];
    for (let i = 0, k = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); i < k; i++) { const u = gl.getActiveUniform(p.program, i); if (u && SAMP.has(u.type)) { n += u.size; names.push(u.name.replace(/\[0\]$/, '')); } }
    if (n > GPUX.samp.n) GPUX.samp = { n, name: p.name + ' ' + names.join(' ') };
    if (n > TEXU.max) bad.push({ name: p.name, log: `${n} unités de texture pour ${TEXU.max} : ${names.join(' ')}`.slice(0, 240) });
  }
  GPUX.bad = bad; return bad;
}

/* ---------- Rapport graphique ---------- */
/* Essais de rendu : cible HalfFloat complète, lecture d'une texture 3D (éclairage cuit), écriture dans une cible 8 bits */
function gpuProbes() {
  const out = [];
  try {
    const gl = renderer.getContext(), prev = renderer.getRenderTarget();
    const half = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, format: THREE.RGBAFormat });
    renderer.setRenderTarget(half); out.push('RGBA16F target: ' + (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? 'ok' : 'INCOMPLETE'));
    half.dispose();
    const d = new Uint8Array(4 * 4 * 4 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = 200; d[i + 1] = 100; d[i + 2] = 50; d[i + 3] = 255; }
    const t3 = new THREE.Data3DTexture(d, 4, 4, 4); t3.format = THREE.RGBAFormat; t3.type = THREE.UnsignedByteType; t3.minFilter = t3.magFilter = THREE.LinearFilter; t3.unpackAlignment = 1; t3.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: t3 } }, depthTest: false,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform highp sampler3D t; void main() { gl_FragColor = texture(t, vec3(0.5)); }',
    });
    const rt = new THREE.WebGLRenderTarget(4, 4), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene(); quad.frustumCulled = false; sc.add(quad);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, new THREE.Camera());
    const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    out.push('3D texture read: ' + (Math.abs(px[0] - 200) < 4 && Math.abs(px[1] - 100) < 4 ? 'ok' : 'FAILED (' + px.join(',') + ')'));
    rt.dispose(); t3.dispose(); mat.dispose(); quad.geometry.dispose();
    renderer.setRenderTarget(prev);
  } catch (e) { out.push('probe aborted: ' + ((e && e.message) || e)); }
  return out;
}
/* Son : état du contexte audio, latences, et coupures de lecture comptées par Chrome (playbackStats : durée et nombre de sous-alimentations du tampon de sortie, c'est
   ce qui fait sauter le son) ; shed : sons ignorés par le budget de voix du téléphone (auAfford, 05-audio.js) */
function gpuAudioLine() {
  const c = typeof AU !== 'undefined' && AU.ctx; if (!c) return 'audio: not started';
  let st = ''; try { const p = c.playbackStats; if (p) st = ` · underruns ${p.underrunEvents} (${Math.round(p.underrunDuration * 1000)} ms of ${Math.round(p.totalDuration)} s) · avg latency ${Math.round(p.averageLatency * 1000)} ms`; } catch (e) { /* absent */ }
  return `audio: ${c.state} ${c.sampleRate} Hz · base latency ${Math.round(c.baseLatency * 1000)} ms · output ${Math.round((c.outputLatency || 0) * 1000)} ms${st} · voices shed ${AU.shed}`;
}
function gpuReportText(withProbes) {
  const bm = document.querySelector('meta[name="cod-build"]'), m = renderer.info.memory;
  const L = [
    'Riposte: Frontline ' + (bm ? bm.content : '?') + ' · ' + new Date().toISOString(),
    navigator.userAgent,
    `screen ${screen.width}x${screen.height} · window ${innerWidth}x${innerHeight} · DPR ${devicePixelRatio} · touch ${COARSE ? 'yes' : 'no'} · installed ${typeof PWA !== 'undefined' && PWA.standalone ? 'yes' : 'no'}`,
    ...(gpuLostNow() || !GPUX.info ? GPUX.info || [] : gpuInfoLines()), // perdu : les valeurs relevées au chargement, le pilote ne répond plus
    `quality ${Settings.quality}${Settings.eco ? ` (power saving: ${gfxSet('quality')}, ${Math.round(1000 / capMs())} fps)` : ''} (tier ${RQ.tier}, scale ${RQ.scale.toFixed(2)}) · safe mode ${GFX_SAFE ? (Settings.gfxSafeAuto === 'manual' ? 'yes (chosen)' : 'yes (automatic)') : 'no'}${Settings.gfxSafe && !GFX_SAFE ? ' (next launch)' : ''} · minimum profile at launch ${ULTRA ? 'yes' + (GPU_WEAK ? ' (weak GPU)' : GPU_SOFT ? ' (software)' : '') : 'no'} · no prepass ${NO_PREPASS ? 'yes' : 'no'} · GPU class ${GPU.tier}`,
    gpuAudioLine(),
    `performance: ${dynStat().fps.toFixed(0)} fps · ${DYN.stat.ms.toFixed(1)} ms per frame (worst of the last 256: ${DYN.stat.worst.toFixed(1)} ms of which ${DYN.stat.worstC.toFixed(1)} ms of our own work, slowest 1 %: ${DYN.stat.low1.toFixed(1)} ms) · JS ${DYN.cpu.toFixed(1)} ms · GPU ${DYN.gpu ? DYN.gpu.toFixed(1) + ' ms' : 'not measured'} · short frame queue ${LAG.ban ? 'disabled (late fences)' : LAG.on ? 'on' : 'off'}, ${LAG.n} frames skipped · ${renderer.info.render.calls} draw calls · ${Math.round(renderer.info.render.triangles / 1000)} k triangles`,
    `real-time shadows ${NO_SHADOWS ? 'off (' + SHADOWS.why + ')' : 'on'} · frame timer queries ${typeof GPUT !== 'undefined' && GPUT ? 'on' : 'off'} · frames since the render started ${GPUF.n}`,
    `context: ${gpuLostNow() ? 'LOST' : 'active'} · losses ${GPUX.lost} · restores ${GPUX.restored}${GPUX.lost ? ` (${GPUX.lostVisible ? 'game visible' : 'in background'}, phase ${GPUX.lostPhase})` : ''} · phase now ${gpuPhase()}`,
    `memory: ${m.textures} textures · ${m.geometries} geometries · ${(renderer.info.programs || []).length} programs · rejected ${GPUX.bad.length}${GPUX.bad.length ? ' : ' + GPUX.bad.slice(0, 3).map((b) => b.name + ' ' + b.log).join(' | ') : ''}`,
    `map: ${MAPL.id || '-'} (${MAPL.state}) ${MAPL.fail ? ' · failed: ' + ((MAPL.fail.err && MAPL.fail.err.message) || MAPL.fail.err) : ''}${MAPL.T && MAPL.T.length ? ' · steps ms ' + MAPL.T.map((s) => s[1]).join('/') : ''}`,
  ];
  L.push(`texture units: limit ${TEXU.max} · lean ground ${TEX_LEAN ? 'yes' : 'no'}${GPUX.samp ? ' · most samplers in one program: ' + GPUX.samp.n + ' (' + GPUX.samp.name.slice(0, 120) + ')' : ''}`);
  if (GPUX.cur) L.push('last program requested: ' + GPUX.cur);
  L.push(`barriers (ms): ${GPUX.bar.length ? GPUX.bar.map((b) => b[0] + ' ' + b[1]).join(' · ') : '-'} · lost at stage: ${GPUX.stage || '-'} · lean: textures x${GPUX.lean.tex}, satellite ${['full', 'low-res', 'not rendered'][GPUX.lean.sat] || GPUX.lean.sat}, HDRI ${GPUX.lean.hdri ? 'off' : 'on'}, warmup render ${GPUX.lean.warm ? 'skipped' : 'on'}`);
  if (GPUX.culprits.length) L.push('programs the device refused (context lost while compiling): ' + GPUX.culprits.join(' || '));
  if (GPUX.badKeys.size) L.push(`known refused families for this build: ${GPUX.badKeys.size} · replaced by simple materials: ${GPUX.fallbacks}`);
  { const j = gpuRead(GPU_LAST); if (j) L.push(`previous interruption: ${j.t} build ${j.b} map ${j.map || '-'} step "${j.step}" ${j.p} after ${j.after} ms · visible ${j.visible} · safe ${j.safe} · tier ${j.tier} · heap ${j.heapMB} MB · memory ${j.devMem} GB · last program ${j.cur || '-'}${j.culprits && j.culprits.length ? ' · refused: ' + j.culprits.join(' || ') : ''}`); }
  if (GPUX.slow.length) L.push('slow compiles (ms): ' + GPUX.slow.map((x) => x[0] + ' ' + x[1]).join(' | '));
  if (GPUX.errs.length) L.push('errors: ' + GPUX.errs.join(' | '));
  if (GPU_EV.length) L.push("timeline (UTC, page id, event):\n" + GPU_EV.slice(-45).map((e) => `${new Date(e[0]).toISOString().slice(11, 21)} ${e[1]} ${e[2]}${e[3] ? ' (x' + e[3] + ')' : ''}`).join("\n"));
  if (withProbes) L.push('probes: ' + gpuProbes().join(' · '));
  return L.join('\n');
}
function gpuReport() {
  repShow(_t('Rapport graphique'), _t('Il décrit l\u0027appareil et le rendu. Copiez-le ou partagez-le pour comprendre un affichage noir ou un chargement qui échoue.'), gpuReportText(!gpuLostNow()));
}
/* Fenêtre de rapport (#gpuRep de shell.html), partagée par le rapport graphique et le rapport de performances (09zo-perfs.js) : titre, phrase
   d'explication, texte à copier ou partager */
function repShow(title, lead, txt) {
  const el = document.getElementById('gpuRep'); if (!el) return;
  document.getElementById('grTitle').textContent = title; el.querySelector('.gr-lead').textContent = lead;
  document.getElementById('grTxt').textContent = txt;
  if (el.classList.contains('hidden')) el._from = document.activeElement; // à la fermeture, le focus revient à ce qui l'a ouvert (Options, chargement, fenêtre 3D)
  document.getElementById('grCopy').textContent = _t('Copier');
  el.classList.remove('hidden'); document.getElementById('grCopy').focus({ preventScroll: true });
}
{ // boutons des deux fenêtres de shell.html (le script est en fin de page : les éléments existent déjà)
  const $$ = (id) => document.getElementById(id), on = (id, f) => { const e = $$(id); if (e) e.addEventListener('click', f); };
  on('glGo', () => { PAGE_LEAVE.ok = true; location.reload(); });
  on('glRep', () => gpuReport());
  const close = () => { const el = $$('gpuRep'), f = el._from; el.classList.add('hidden'); el._from = null; if (f && f.isConnected && f.focus) f.focus({ preventScroll: true }); };
  on('grClose', close);
  // Échap (et B de la manette, qui passe par Échap) ferme le rapport sans rien déclencher dessous (retour, pause)
  addEventListener('keydown', (e) => { const el = $$('gpuRep'); if (e.code !== 'Escape' || !el || el.classList.contains('hidden')) return; e.preventDefault(); e.stopImmediatePropagation(); close(); }, true);
  on('grCopy', () => {
    const t = $$('grTxt').textContent, done = () => { $$('grCopy').textContent = _t('Copié'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => { const r = document.createRange(); r.selectNodeContents($$('grTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    else { const r = document.createRange(); r.selectNodeContents($$('grTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  });
  on('grShare', () => { if (navigator.share) navigator.share({ title: 'Riposte: Frontline', text: $$('grTxt').textContent }).catch(() => { /* annulé */ }); });
  if (!navigator.share) { const b = $$('grShare'); if (b) b.classList.add('hidden'); }
}
