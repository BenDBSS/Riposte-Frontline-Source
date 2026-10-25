/* ==========================================================================
   RÉGLAGES PROPRES À CHAQUE CARTE : ambiance, apparitions, points d'intérêt des bots, zones nommées, chute de neige,
   éclairage HDRI. Appelés par le chargement des cartes (mapBuild et mapUnload, 09a-loading.js). En plus de ce que
   décrit 02-map.js, une définition (MAP_DEFS.id) porte :
     splat, far             carte de répartition du sol, distance de vue ;
     near                   { x, z } : au-delà, le décor est dans le tronçon lointain (CHUNK_NEAR, 02a-kit.js ; 50 et 66 m par défaut) ;
     winter                 surfaces, atlas et matières du kit d'hiver (02i-hiver.js), sinon ni générés ni chargés ;
     update(t, dt), unload()   animation par image, nettoyage propre à la carte (facultatifs) ;
     ready()                ce qui a besoin de l'éclairage de la carte en place (reflets de l'eau), juste avant la
                            compilation des shaders (facultatif) ;
     surfaces, kit(), materials(M)   surfaces procédurales facultatives à générer (kit portuaire, eau), atlas propres à
                            la carte (après les surfaces), matières propres à la carte (après la bibliothèque) ;
     dom                    [x, z] des trois points de la domination, A (côté Alpha), B (centre), C (côté Bravo), symétriques en z ;
     void                   { kill } : îles flottantes, pas de sol hors des boîtes de collision ; sous kill, on meurt (VOID, 02-map.js) ;
     spawns, poi, zones     apparitions de l'équipe Alpha (Bravo : miroir en z), points d'intérêt des bots, zones nommées ;
     lane(x), sniper, coverZ, heli, cam, surface(p)   route d'un point, poste du tireur d'élite, limite des couverts,
                            ellipse de l'hélicoptère, rayon de la vue aérienne, matière des pas au sol ;
     atmo                   ambiance (voir ATMO_DEFAULT dans 01-core.js).
   ========================================================================== */
/* Ciel photographié d'une carte (skyPhoto de sa définition : { key, rot, gain }) : moitié haute d'un panorama (assets/sky/, empaquetée
   dans dist/tex/ par build.py, version _lo en qualité Basse), chargée avec les textures de la carte et lue par le shader du ciel (SKY_PHOTO) ;
   absente ou injoignable : le ciel procédural reste. Libérée avec la carte. drift : les nuages dérivent, le ciel oscillant de ± drift degrés
   autour de son orientation en period secondes (skyPhotoUpdate : le soleil de la photo reste près de celui de la carte). Ni mipmaps (le ciel est agrandi à l'écran, et le raccord du
   tour ne fait pas de ligne) ni répétition en hauteur. */
const SKYP = { tex: null, P: null };
async function skyPhotoLoad(P) {
  skyPhotoFree();
  if (!P) return;
  const lo = 'sky_' + P.key + '_lo', key = RQ.q.lean && TEX_PACKS[lo] ? lo : 'sky_' + P.key;
  const d = await fetchTexPack(key);
  const t = d && (await new Promise((res) => new THREE.TextureLoader().load(d.map, res, undefined, () => res(null))));
  if (!t) return;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  SKYP.tex = t; SKYP.P = P; SkyShader.uniforms.tSky.value = t; SkyShader.uniforms.uSkyP.value.set(P.rot || 0, P.gain || 1, 0, 0);
  skyMat.defines.SKY_PHOTO = ''; skyMat.needsUpdate = true;
}
function skyPhotoUpdate(t) {
  const P = SKYP.P; if (!SKYP.tex || !P.drift) return;
  SkyShader.uniforms.uSkyP.value.x = (P.rot || 0) + (P.drift / 360) * Math.sin((t * Math.PI * 2) / (P.period || 1500));
}
function skyPhotoFree() {
  if (SKYP.tex) { SKYP.tex.dispose(); SKYP.tex = null; SKYP.P = null; SkyShader.uniforms.tSky.value = null; }
  if ('SKY_PHOTO' in skyMat.defines) { delete skyMat.defines.SKY_PHOTO; skyMat.needsUpdate = true; }
}
/* Ambiance : soleil, ciel, brouillard, lumières, étalonnage, neige. Les objets créés plus tard (ombres, composeur,
   effets) lisent aussi l'ambiance de la carte chargée à leur création. */
const _atmoC = new THREE.Color();
function applyAtmosphere(A) {
  SUN_DIR.set(...A.sun).normalize();
  // allégé en altitude (fogH), le brouillard perd de sa densité au-dessus du sol : 30 % de plus à sa base gardent la profondeur des rues
  scene.fog.color.setRGB(...A.fog); scene.fog.density = A.fogD * (A.fogH && A.fogH[0] > 0 ? 1.3 : 1);
  hemi.color.setHex(A.hemi[0]); hemi.groundColor.setHex(A.hemi[1]); hemi.intensity = A.hemi[2];
  vmHemi.color.setHex(A.vmHemi[0]); vmHemi.groundColor.setHex(A.vmHemi[1]); vmSun.color.setHex(A.vmSun);
  const U = SkyShader.uniforms;
  for (const [k, u] of [['zen', 'uZen'], ['mid', 'uMid'], ['hor', 'uHor'], ['gnd', 'uGnd'], ['glow', 'uGlow'], ['halo', 'uHalo'], ['disk', 'uDisk'], ['cloudLo', 'uCloudLo'], ['cloudHi', 'uCloudHi'], ['cloud', 'uCloud'], ['ridge', 'uRidge'], ['ridgeSnow', 'uRidgeSnow'], ['ridgeRock', 'uRidgeRock'], ['volc', 'uVolc'], ['plume', 'uPlume'], ['erupt', 'uErupt'], ['sea', 'uSea']]) U[u].value.set(...(A.sky[k] || ATMO_DEFAULT.sky[k])); // (une clé absente : celle par défaut, éteinte)
  // le code du volcan n'est compilé dans le shader du ciel que pour une carte qui en a un (sinon il coûterait à toutes)
  const volc = !!(A.sky.volc && A.sky.volc[1] > 0);
  if (volc !== ('SKY_VOLC' in skyMat.defines)) { if (volc) skyMat.defines.SKY_VOLC = ''; else delete skyMat.defines.SKY_VOLC; skyMat.needsUpdate = true; }
  const sea = !!(A.sky.sea && A.sky.sea[3] > 0); // mer de nuages (îles flottantes) : même règle
  if (sea !== ('SKY_SEA' in skyMat.defines)) { if (sea) skyMat.defines.SKY_SEA = ''; else delete skyMat.defines.SKY_SEA; skyMat.needsUpdate = true; }
  const F = FinalShader.uniforms;
  F.uGradeLo.value.set(...A.grade.lo); F.uGradeHi.value.set(...A.grade.hi); F.uRayTint.value.set(...A.rays);
  const G = Object.assign({}, GRADE_DEF, A.grade); // étalonnage : ce que la carte ne précise pas vient de GRADE_DEF (01-core.js)
  F.uExposure.value = G.exp * G.gain; F.uSat.value = G.sat; F.uCon.value = G.con; F.uVig.value = G.vig; F.uLift.value = G.lift;
  // atmosphère : lueur du soleil dans la brume, brouillard allégé en altitude (FOG_U, 01-core.js)
  const sc = _atmoC.setHex(A.sunColor);
  FOG_U.fogSun.value.set([SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, A.fogSun || 0]); FOG_U.fogSunCol.value.set([sc.r, sc.g, sc.b]); FOG_U.fogHeight.value.set(A.fogH || [0, 0]);
  for (const u of raysPass ? [RaysShader.uniforms, raysPass.mat.uniforms] : [RaysShader.uniforms]) { u.uTint.value.set(...A.rays); u.uThr.value = A.raysThr; u.uCap.value = A.raysCap; }
  if (bloomPass) { bloomPass.strength = A.bloom[0]; bloomPass.radius = A.bloom[1]; bloomPass.threshold = A.bloom[2]; }
  WMU.uAOFloor.value = A.aoFloor; WMU.uVolOpen.value = A.volOpen ? 1 : 0;
  const IN = A.interior || [1, 1, 1]; WMU.uSkyC.value.set(IN[0], IN[1], 1, IN[2]); // contraste intérieur/extérieur (skyCurve, 02c-materials.js)
  WMU.uDustCol.value.setRGB(sl(A.dust[0]), sl(A.dust[1]), sl(A.dust[2]));
  const S = A.snow || A.coat; // dépôt sur le dessus du décor : neige (avec ses effets : impacts blancs, objets qui glissent) ou cendre (coat : le rendu seul)
  WMU.uSnow.value.set(S ? S.top : 0, S ? S.foot : 0, 0.3, 0.55);
  if (S) WMU.uSnowCol.value.setRGB(sl(S.color[0]), sl(S.color[1]), sl(S.color[2]));
  if (csm) {
    csm.lightDirection.copy(SUN_DIR).negate();
    for (const l of csm.lights) { l.color.setHex(A.sunColor); l.intensity = A.sunI; l.shadow.needsUpdate = true; }
  }
  applyAtmoFx();
}

/* Avant la construction : carte courante, bornes, apparitions, points d'intérêt, zones, ambiance (le soleil oriente
   l'éclairage cuit, la neige et la génération des matières en dépendent) */
function mapSetup(id) {
  const info = mapById(id), D = MAP_DEFS[info.id];
  CURMAP.id = info.id; CURMAP.info = info; CURMAP.def = D;
  Object.assign(MAP, D.bounds); Object.assign(SPLAT, D.splat); Object.assign(CHUNK_NEAR, D.near || { x: 50, z: 66 }); // tronçons du décor (02a-kit.js) : la zone de jeu d'une grande carte
  VOID.on = !!D.void; VOID.kill = D.void ? D.void.kill : -1e9; // îles flottantes : pas de sol hors des îles (02-map.js)
  reliefBuild(D); // sol en relief et zone ronde (02-relief.js), avant le décor qui s'y pose
  SPAWNS[0] = D.spawns.map(([x, z]) => [x, z]); SPAWNS[1] = D.spawns.map(([x, z]) => [x, -z]);
  POI.length = 0; POI.push(...D.poi);
  ZONES.length = 0; ZONES.push(...D.zones);
  applyAtmosphere(D.atmo);
  camera.far = D.far || 260; camera.updateProjectionMatrix();
}
/* Après le décor (racine de la carte prête) : chute de neige */
function mapDressing() {
  const S = CURMAP.def.atmo.snowfall;
  if (S) makeSnowfall(S);
}
/* Éclairage d'ambiance de la carte : son HDRI si elle est déjà convertie ; sinon son ciel procédural, en attendant
   l'HDRI au plus 6 s après le début de son téléchargement (arrivée plus tard, elle remplace le ciel à la première pause ou à la fin de la partie) */
async function mapEnvironment() {
  const name = CURMAP.def.atmo.hdri;
  if (ENV_CACHE.has(name)) { setEnvMap(ENV_CACHE.get(name)); return; }
  buildEnvironment();
  if (!name || GPUX.lean.hdri) return; // carte sans HDRI, ou adaptation apprise sur cet appareil : ciel procédural, l'HDRI n'est pas converti (01a-gpu.js)
  const j = hdriFetch(name);
  await Promise.race([j.ready, new Promise((r) => setTimeout(r, Math.max(0, 6000 - (performance.now() - j.t0))))]);
}
/* Déchargement : nettoyage propre à la carte (ses objets 3D partent avec sa racine, MAPL.root) */
function mapTeardown() {
  const D = CURMAP.def; if (!D) return;
  if (D.unload) D.unload();
  hangsClear(); toilesClear(); HOLES.length = 0;
  SNOWFALL.obj = SNOWFALL.mat = null;
  waterUnload();
  VOID.on = false; VOID.kill = -1e9; reliefFree();
  CURMAP.id = null; CURMAP.info = null; CURMAP.def = null;
}
/* Animation propre à la carte, à chaque image */
function mapUpdate(t, dt) {
  const D = CURMAP.def; if (!D) return;
  if (D.update) D.update(t, dt);
  updateHangs(dt, t); toilesUpdate(dt);
  updateSnowfall(dt, t); waterUpdate(t); pondUpdate(t); rippleUpdate(dt);
}
