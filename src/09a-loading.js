/* ==========================================================================
   CHARGEMENT DES CARTES
   Le démarrage ne prépare que le socle commun à toutes les cartes (rendu, effets, soldats, armes, vue subjective,
   menus) : on arrive vite au menu, quel que soit le nombre de cartes. Une carte n'est construite qu'au lancement
   d'une partie (solo ou en ligne, jamais dans un salon), avec une vraie progression : textures photo (fichiers à
   côté de la page), matières, décor et collisions, éclairage cuit (Web Workers), itinéraires des bots, relevé
   satellite, compilation des shaders. Une seule carte est en mémoire à la fois. Elle y reste tant qu'on peut y
   rejouer (partie, écran Solo, salon en ligne : une carte déjà chargée y reste, mais le salon n'en charge aucune), puis elle est libérée en entier après MAPL_KEEP secondes ailleurs dans
   les menus : géométries, textures, matières et leurs programmes de shaders, collisions, navigation, éclairage.
   ========================================================================== */
const MAPL = { id: null, state: 'none', root: null, job: null, jobId: null, p: 0, msg: '', subs: new Set(), idle: 0, fail: null, T: [], ms: 0 };
const MAPL_KEEP = 60;

/* Progression (0 à 1) : chaque abonné reçoit (p, message, id de la carte) */
function mapProg(msg, p) {
  MAPL.msg = msg; MAPL.p = p;
  for (const f of MAPL.subs) { try { f(p, msg, MAPL.id); } catch (e) { console.error(e); } }
}
function mapReady(id) { return MAPL.state === 'ready' && MAPL.id === mapById(id).id; }

/* Carte prête à jouer : la construit si besoin (après avoir libéré l'autre). Les demandes s'enchaînent, une
   construction à la fois ; une demande pour la carte déjà prête ou en cours renvoie la même promesse. */
function mapEnsure(id) {
  id = mapById(id).id;
  MAPL.idle = 0;
  if (MAPL.job && MAPL.jobId === id) return MAPL.job;
  const prev = MAPL.job;
  const job = (async () => {
    if (prev) { try { await prev; } catch (e) { /* échec de la précédente : sans effet sur celle-ci */ } }
    if (mapReady(id)) return;
    if (MAPL.id) mapUnload();
    await mapBuild(id);
  })();
  MAPL.job = job; MAPL.jobId = id;
  job.catch((e) => {
    console.error('chargement de la carte', id, e);
    if (e && e.gpuLost && gpuAutoRetry(UI.flow && !UI.flow.online ? id : null)) return; // la page se relance, la partie solo reprend ensuite (gpuResume)
    MAPL.fail = { id, t: performance.now(), err: e };
    if (MAPL.job === job) { MAPL.job = null; MAPL.jobId = null; }
  });
  return job;
}

async function mapBuild(id) {
  const def = MAP_DEFS[id], info = mapById(id), t0 = performance.now();
  if (!def) throw new Error('carte inconnue : ' + id);
  MAPL.id = id; MAPL.state = 'loading'; MAPL.T = [];
  // chaque étape rend la main au navigateur (barre de progression, réseau) ; durées dans MAPL.T (console)
  let tStep = t0, last = '';
  const step = (msg, p) => {
    const t = performance.now(); if (last) MAPL.T.push([last, Math.round(t - tStep)]); tStep = t; last = msg; gpuLog('map ' + id + ': ' + msg);
    mapProg(msg, p); return new Promise((r) => setTimeout(r, 16));
  };
  try {
    mapSetup(id); // carte courante, bornes, apparitions, zones, ambiance (02z-load.js)
    ambLoad(def); // sons d'ambiance enregistrés de la carte : chargés pendant la construction, libérés avec elle (05c-ambiance.js)
    sfxBootGame(); // sons de la partie (armes, pas, impacts, séries, voix) : au premier lancement, puis gardés (05a-sfx.js)
    await step(_t('Chargement des textures'), 0.02);
    const T = {}, keys = def.textures || []; let n = 0;
    await loadAssetTextures(T, keys, () => { n++; mapProg(_t('Chargement des textures'), 0.02 + (0.16 * n) / keys.length); });
    T.usure = await usureLoad(); // couche d'usure scannée du décor (02b-texlab.js)
    await mechaTexLoad(); // surfaces photo du mecha, une fois pour toutes, avant la compilation des shaders (08f-mecha.js)
    await skyPhotoLoad(def.skyPhoto); // ciel photographié de la carte, s'il en a un (02z-load.js)
    await step(_t('Génération des matières'), 0.18);
    buildTextures(T); makeMaterials();
    await gpuBarrier('textures'); // sur téléphone : le GPU finit les textures générées avant l'étape suivante (01a-gpu.js)
    await step(_t('Construction de {0}', info.name), 0.3);
    MAPL.root = new THREE.Group(); MAPL.root.name = 'carte ' + id; MAPL.root.matrixAutoUpdate = false; scene.add(MAPL.root);
    def.build(); tissusBuild(); MAPL.rails = railingsSeal(); finalizeWorld(); propsFinalize(); buildHash(); reliefGroundTex(); // hauteurs du sable pour les shaders (02-relief.js)
    if (def.after) def.after();
    grassBuild(def.grass); // brins d'herbe des pelouses (02nb-gazon.js)
    mapDressing(); // chute de neige
    shadeMaterials();
    PREFABS.clear(); WORLD.dressing = null; // ne servent qu'à la construction
    await step(_t('Éclairage cuit de la carte'), 0.48);
    bakeLightStart();
    await step(_t('Calcul des itinéraires des bots'), 0.52);
    buildNav(); buildCovers(); mnavBuild(); // (le réseau du mecha, 08f-mecha.js, se tire de celui des bots)
    await step(_t('Éclairage cuit de la carte'), 0.62);
    await LIGHT.ready;
    // éclairage HDRI de la carte (sinon son ciel procédural), voir mapEnvironment
    await step(_t('Éclairage HDRI'), 0.7);
    await mapEnvironment();
    if (def.ready) def.ready(); // ce qui a besoin de l'éclairage de la carte (reflets de l'eau)
    await gpuBarrier('environment');
    // compilation des shaders PUIS relevé satellite : le relevé est le premier rendu d'ensemble de la scène, il ne doit pas aussi compiler tous ses programmes d'un bloc
    // (sur un Pixel, le pilote reprenait le contexte à ce moment-là, voir 01a-gpu.js)
    await step(_t('Compilation des shaders'), 0.74);
    const passes = RQ.q.lights > 0 ? 2 : 1;
    await mapCompile((pass, d, n) => mapProg(_t('Compilation des shaders : {0} %', Math.round(100 * (pass + (n ? d / n : 1)) / passes)), 0.74 + 0.2 * ((pass + (n ? d / n : 1)) / passes)));
    await step(_t('Prêt'), 1);
    MAPL.state = 'ready'; MAPL.ms = performance.now() - t0;
    mapProg(_t('Prêt'), 1);
  } catch (e) {
    mapUnload();
    throw e;
  }
}
/* Compile tous les programmes de la scène (deux variantes : avec et sans éclairs de tir, voir updateFlashLights) par petits groupes, la main
   rendue au navigateur entre deux (gpuCompileScene, 01a-gpu.js : progression, page vivante, pilote non saturé), puis relève la carte satellite
   (par tuiles, buildSatelliteMap) et rend une image complète pour ce que la compilation ne voit pas. Déjà compilés : ceux du socle, d'une carte à l'autre. prog(passe, faits, total) rend compte. */
async function mapCompile(prog) {
  // armes des bots de la première partie tirées maintenant (type de la carte connu) : construites et compilées avec elle
  botArmForMap(); botArmPrebuild(); BOT_ARM.map = MAPL.id;
  const vis = entities.map((e) => e.model.root.visible), dw = domWarm(); // dw : point de domination factice (09i-modes.js), compilé puis caché
  for (const e of entities) if (!e.isPlayer) e.model.root.visible = true;
  try {
    markPrepass(scene); propsWarm(true);
    GPUX.preOk = false; await gpuBarrier('before compile'); GPUX.preOk = true; // contexte sain jusqu'ici : un programme qui le fait perdre est bien en cause
    GPUX.culprits = []; gpuApplyFallbacks(scene); gpuApplyFallbacks(vmScene); // rendus refusés lors d'un chargement précédent : versions simples
    let pass = 0;
    if (RQ.q.lights > 0) { setFlashLightsVisible(true); await gpuCompileScene(scene, camera, (d, n) => prog(0, d, n)); pass = 1; }
    setFlashLightsVisible(false); await gpuCompileScene(scene, camera, (d, n) => prog(pass, d, n));
    await gpuCompileScene(vmScene, vmCamera);
    // programme de la matière du décor refusé par le pilote : le monde serait noir ou absent, mieux vaut le dire (rapport graphique)
    const bad = gpuCheckPrograms().filter((b) => b.name === 'MeshStandardMaterial');
    if (bad.length) throw new Error(_t('le pilote graphique a refusé {0} programmes de rendu', bad.length));
    // relevé satellite (premier rendu d'ensemble, par tuiles) : sans les soldats ni les objets réveillés pour la compilation
    propsWarm(false); if (dw) dw.visible = false; entities.forEach((e, i) => { e.model.root.visible = vis[i]; });
    gpuLog('map ' + MAPL.id + ': ' + _t('Relevé satellite de la carte')); mapProg(_t('Relevé satellite de la carte'), 0.95);
    await buildSatelliteMap(); buildMinimapStatic();
    await waterProbes(); // reflets du décor dans les petites eaux (02m-water.js), une barrière GPU par sonde
    propsWarm(true); if (dw) dw.visible = true; for (const e of entities) if (!e.isPlayer) e.model.root.visible = true;
    ripplePrime(); gpuRefPrep(); // champ d'ondes, étalon du rapport graphique : programmes et cibles prêts avant la partie
    if (!GPUX.lean.warm) { warmupRender(); await gpuBarrier('warmup'); } // sautée si une perte du contexte lui a été attribuée (01a-gpu.js)
    shadowWarm(); await gpuBarrier('shadows'); // programmes d'ombre de toutes les matières, avec et sans éclairs de tir (09-game.js)
  } finally {
    propsWarm(false); if (dw) dw.visible = false;
    entities.forEach((e, i) => { e.model.root.visible = vis[i]; });
  }
}

/* Libère tout ce qui appartient à la carte (retour à la mémoire du socle) */
function mapUnload() {
  for (const n of NADES) scene.remove(n.mesh);
  NADES.length = 0; SMOKES.length = 0; clearThrowKnives(); clearAircraft(); clearDrops(); ambUnload();
  for (const d of DEPTH_OWN.values()) d.dispose(); DEPTH_OWN.clear(); // matières de profondeur propres à chaque matière (shadowWarm, 09-game.js)
  if (FX) { FX.holes.clear(); FX.splats.clear(); FX.scorch.clear(); }
  if (MAPL.root) {
    scene.remove(MAPL.root);
    const lib = new Set(Object.values(MAT));
    MAPL.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !lib.has(o.material)) o.material.dispose(); if (o.isInstancedMesh) o.dispose(); });
    MAPL.root = null;
  }
  grassClear(); skyPhotoFree();
  mapTeardown(); freeMaterials(); lightUnload(); navUnload(); mnavUnload();
  COL.length = 0; RAILS.length = 0; RAMPS.length = 0; LINES.length = 0; BRIDGES.length = 0; PONDS.length = 0; OCC.length = 0; LAMPS.length = 0; HASH.clear(); BEAMS.length = 0; PREFABS.clear(); propsClear();
  WORLD.bufs.clear(); WORLD.meshes.length = 0; WORLD.fine.length = 0; WORLD.scatter.length = 0; WORLD.dressing = null; WORLD.force = null;
  COVERS.length = 0; COVER_GRID.clear();
  for (const e of entities) { e.cover = null; e.path = null; e.goal = null; }
  KS.sat = null; KS.plan = null; HUD.mmStatic = null;
  MAPL.id = null; MAPL.state = 'none';
  mapProg('', 0);
}
/* Déchargement hors d'une construction (carte plus demandée) */
function mapRelease() {
  if (MAPL.state !== 'ready') return;
  mapUnload(); MAPL.job = null; MAPL.jobId = null;
}

/* Carte dont on a besoin dans l'état actuel des menus : celle de la partie, du lancement en cours, du salon en ligne,
   ou celle choisie sur l'écran Solo ou dans le salon (gardée si elle est déjà chargée, jamais préchargée) */
function mapWanted() {
  if (MATCH.state !== 'menu' && MATCH.state !== 'loading') return MAPL.id;
  if (OUTIL && OZ.id) return OZ.id; // outil des zones (09zn-outil-zones.js) : la carte qu'on y retouche
  if (UI.flow) return mapById(UI.flow.map).id;
  if (NET.role !== 'off' && NET.joined) return NET.cfg.map;
  if (UI.screen === 'solo') return mapById(Settings.map).id;
  return null;
}
/* Une fois par seconde : libère la carte qui n'est plus demandée depuis MAPL_KEEP secondes. Rien n'est préchargé : un salon
   ne charge pas la carte choisie par l'hôte, chacun la charge au lancement de la partie (écran de chargement). */
function mapTick() {
  const want = mapWanted();
  if (MAPL.state === 'ready' && MAPL.id !== want && MAPL.jobId === MAPL.id) { if (++MAPL.idle >= MAPL_KEEP) mapRelease(); }
  else MAPL.idle = 0;
}
setInterval(mapTick, 1000);
