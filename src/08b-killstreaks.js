/* ==========================================================================
   SÉRIES D'ÉLIMINATIONS
   Tablette tactique en vue subjective, carte satellite rendue par three.js
   (caméra orthographique + render target), sélection de cible au curseur,
   chasseurs, bombes et drone modélisés avec les géométries de three.js.
   ========================================================================== */
const KS = { mode: null, stage: '', t: 0, st: 0, pressT: -1, map: { open: false, x: 0, z: 0, yaw: 0, t0: 0 }, rig: null, mats: null, sat: null, plan: null, jets: [], bombs: [], drones: [], helis: [], geo: null, hgeo: null, warm: null };
/* Éliminations d'affilée nécessaires (sans mourir) de chaque série (catalogue KSDEF, 06i-armes.js) */
const STREAK = {}; for (const id of KS_IDS) STREAK[id] = KSDEF[id].n;
/* Touches par défaut des emplacements 1 à 3 (actions ks1 à ks3, 08a-binds.js) */
const KS_KEYS = ['Digit4', 'Digit5', 'Digit6'];
/* Appelle la série de l'emplacement slot (0 à 2) de la classe du joueur */
function useKs(slot) {
  const id = PL.ksSel[slot]; if (!id) return;
  if (ksJammed(PL.ent.team) && PL.ks[id]) { hudMsg(_t('Séries brouillées par une IEM'), 'enemy', 1.8); return; }
  KSDEF[id].use();
}
/* Action (touche, bouton) qui appelle la série id, '' si elle n'est pas dans la classe */
function ksAct(id) { const i = PL.ksSel.indexOf(id); return i < 0 ? '' : 'ks' + (i + 1); }
/* UAV : un sonar, pas un suivi en direct. Toutes les UAV.pulse secondes, il relève la place de chaque soldat (uavPulse) ; sur la mini-carte, une onde
   part du joueur à UAV.speed m/s et chaque adversaire n'apparaît, à sa place relevée, qu'au passage de l'onde, reste UAV.hold s puis s'efface en
   UAV.fade s (uavBlip). Entre deux relevés, on ne sait pas où il est allé. La carte de la frappe et les bots de l'équipe lisent le même relevé. */
const UAV = { life: 30, pulse: 3, speed: 60, hold: 1, fade: 1.6 };
function uavStart(team) { MATCH.uav[team] = UAV.life; uavPulse(team); }
function uavPulse(team) {
  const pts = [];
  for (const o of entities) if (o.alive && !o.off) pts.push({ o, x: o.pos.x, z: o.pos.z });
  MATCH.uavPing[team] = { t: MATCH.time, pts };
  if (team === PL.ent.team && PL.ent.alive) sfxPing();
}
function uavTick(dt) {
  for (const team of [0, 1]) {
    MATCH.sat[team] = Math.max(0, MATCH.sat[team] - dt); MATCH.iem[team] = Math.max(0, MATCH.iem[team] - dt);
    if (MATCH.uav[team] <= 0) continue;
    MATCH.uav[team] = Math.max(0, MATCH.uav[team] - dt);
    const p = MATCH.uavPing[team];
    if (MATCH.uav[team] > 0 && (!p || MATCH.time - p.t >= UAV.pulse)) uavPulse(team);
  }
}
/* Satellite : les adversaires en direct, avec leur orientation, pendant SAT.life secondes (mini-carte, carte de la frappe, bots de l'équipe).
   IEM : l'équipe adverse est brouillée IEM.life secondes (MATCH.iem[équipe], ksJammed) : mini-carte sans repères, UAV et satellite coupés, séries
   bloquées (useKs, botStreak), hélicoptère sans tir IEM.stun secondes (heliBrain). Chaque appel passe par satFire et iemFire : joueur, bot ou
   événement reçu en ligne (netEventIn) ; netSat et netIem ne publient que l'appel d'un participant local. */
const SAT = { life: 30 }, IEM = { life: 25, stun: 3 };
const ksJammed = (team) => MATCH.iem[team] > 0;
const satOn = (team) => MATCH.sat[team] > 0 && !ksJammed(team);
function satFire(owner) {
  const me = owner === PL.ent, ally = owner.team === PL.ent.team;
  MATCH.sat[owner.team] = SAT.life; netSat(owner);
  if (ally) sfxPing();
  sfxAnnounce(ksFriendly(owner) ? 'sat_on' : 'sat_enemy'); // annonce radio (05a-sfx.js)
  hudMsg(me ? _t('Satellite en ligne') : ally ? _t('Satellite allié ({0})', owner.name) : _t('Satellite ennemi en ligne'), ally ? 'ally' : 'enemy', 2.5);
}
function iemFire(owner) {
  const me = owner === PL.ent, ally = owner.team === PL.ent.team, foe = 1 - owner.team;
  MATCH.iem[foe] = IEM.life; MATCH.uav[foe] = 0; MATCH.sat[foe] = 0; MATCH.uavPing[foe] = null; // le drone de l'UAV s'en va avec (updateAircraft)
  for (const h of KS.helis) if (h.team === foe && h.state !== 'crash') { h.stunT = MATCH.time + IEM.stun; h.burst = null; }
  const hit = !me && PL.ent.team === foe; // le joueur est dans l'équipe brouillée : éclair à l'écran, appel en cours coupé (la série reste prête)
  netIem(owner); sfxIem(hit ? 1 : 0.5); sfxAnnounce(ksFriendly(owner) ? 'iem_on' : 'iem_enemy');
  if (hit) { if (KS.mode && KS.pressT < 0) ksAbort(); const fx = $('iemFx'); fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on'); }
  hudMsg(me ? _t('IEM déclenchée') : ally ? _t('IEM alliée ({0})', owner.name) : _t('IEM ennemie, vos appareils sont brouillés'), ally ? 'ally' : 'enemy', 2.5);
}
/* Séries appelées par le terminal (UAV, hélicoptère, satellite, IEM) */
const KS_PHONE = new Set(['uav', 'heli', 'sat', 'iem', 'fpv']);
function usePhoneKs(id) { if (PL.ks[id] && ksStart(id)) { PL.ks[id] = false; updateStreakHud(); } }
/* Repère d'un adversaire o dans le dernier relevé de l'équipe de me : { x, z, a } (a : opacité de 0 à 1), ou null. wave : il n'apparaît qu'au
   passage de l'onde partie de me (mini-carte) ; sinon dès le relevé (carte de la frappe, vue d'ensemble) */
function uavBlip(o, me, wave) {
  const p = MATCH.uavPing[me.team]; if (!p || ksJammed(me.team)) return null;
  const q = p.pts.find((r) => r.o === o); if (!q) return null;
  const seen = p.t + (wave ? hyp(q.x - me.pos.x, q.z - me.pos.z) / UAV.speed : 0), age = MATCH.time - seen;
  if (age < 0 || age > UAV.hold + UAV.fade) return null;
  return { x: q.x, z: q.z, a: age < UAV.hold ? 1 : 1 - (age - UAV.hold) / UAV.fade };
}

/* ---------- Carte satellite : rendu orthographique de la vraie scène ----------
   Plus affichée depuis le plan gris (KS.plan, 09ga-minicarte.js) : la carte de la frappe, la tablette et la mini-carte le dessinent à la place. Son rendu reste
   au chargement parce qu'il fait aussi le balayage des programmes sur téléphone (gpuDrawScan) ; KS.sat n'est plus lue que par les tests (gpu.js). */
/* Relevé sans le GPU (dernier recours d'un appareil dont le pilote n'a pas supporté le rendu d'ensemble, GPUX.lean.sat = 2) : sol uni et bâtiments */
function satelliteFlat(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = VOID.on ? VOID_SAT : '#4a4638'; g.fillRect(0, 0, W, H);
  satFlatDraw(g, TAC_S, MAP.x0, MAP.z0);
  return c;
}
/* Plan dessiné sans relevé, à S pixels par mètre depuis (X0, Z0) : sol uni (au-dessus du vide, seulement les îles et les ponts) et bâtiments */
function satFlatDraw(g, S, X0, Z0) {
  const box = (b, col) => { g.fillStyle = col; g.fillRect((b.x0 - X0) * S, (b.z0 - Z0) * S, (b.x1 - b.x0) * S, (b.z1 - b.z0) * S); };
  if (!VOID.on) box(MAP, '#4a4638');
  else for (const b of COL) if (!b.ray && !b.inv && b.y1 > -1 && b.y1 < 2.4) box(b, '#4a4638');
  for (const b of COL) if (!b.ray && !b.inv && b.y1 >= 2.4) box(b, '#8d8470');
}
/* Îles flottantes : sous les îles, la mer de nuages, que le ciel (masqué pour le relevé) ne dessine pas. VOID_SAT est la teinte voulue à l'écran ;
   le fond du rendu est cette teinte ramenée avant la finale du relevé (exposition satExp, ACES puis gamma : on remonte chaque étape) */
const VOID_SAT = '#9fb3c9';
function satVoidClear() {
  const e = CURMAP.def.atmo.satExp, h = parseInt(VOID_SAT.slice(1), 16);
  const lin = (v) => { const y = Math.min(Math.pow(v / 255, 2.2), 0.8), a = 2.43 * y - 2.51, b = 0.59 * y - 0.03; return (-b - Math.sqrt(b * b - 0.56 * y * a)) / (2 * a) / e; };
  return new THREE.Color().setRGB(lin(h >> 16 & 255), lin(h >> 8 & 255), lin(h & 255));
}
/* Le relevé est rendu par tuiles sur téléphone (GPUX.lean.sat : 0 définition entière, 1 au quart de la définition sans anticrénelage, 2 pas de rendu GPU) : chaque tuile est
   un rendu court, suivi d'une barrière (gpuBarrier) qui date une perte du contexte à la tuile près. Il vient après la compilation des programmes (mapCompile) : c'est le
   premier rendu d'ensemble de la scène, il ne doit pas aussi les compiler d'un bloc. */
async function buildSatelliteMap(tiles, scan) { // tiles : nombre de tuiles par côté, scan : balayage des dessins (vrai, faux), imposés par les tests (tools/dev/visual/gpu.js)
  const W = Math.round((MAP.x1 - MAP.x0) * TAC_S), H = Math.round((MAP.z1 - MAP.z0) * TAC_S);
  if (GPUX.lean.sat >= 2) { KS.sat = satelliteFlat(W, H); gpuLog('satellite drawn without the GPU'); return; }
  const lo = GPUX.lean.sat >= 1, RW = lo ? Math.max(64, W >> 2) : W, RH = lo ? Math.max(64, H >> 2) : H;
  const nt = tiles || (COARSE || GFX_SAFE ? (lo ? 2 : 3) : 1); // tuiles par côté
  const cam = new THREE.OrthographicCamera(MAP.x0, MAP.x1, -MAP.z0, -MAP.z1, 1, 120); cam.layers.enable(LAYER_NEAR);
  cam.up.set(0, 0, -1); cam.position.set(0, 60, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const saved = { p: camera.position.clone(), r: camera.rotation.clone(), fog: scene.fog.density, dust: FX.dust.visible, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha() };
  // les cascades d'ombre sont calées sur une caméra plongeante au-dessus de la carte
  camera.position.set(0, 50, 0); camera.rotation.set(-Math.PI / 2, 0, 0); updateShadows();
  scene.fog.density = 0; FX.dust.visible = false; sky.visible = false;
  const weather = MAPL.root ? MAPL.root.children.filter((o) => o.userData.weather && o.visible) : []; for (const o of weather) o.visible = false;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const quad = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, uExp: { value: CURMAP.def.atmo.satExp } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D t; uniform float uExp; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); } void main(){ vec3 c = aces(texture2D(t, vUv).rgb*uExp); gl_FragColor = vec4(pow(c, vec3(1.0/2.2)), 1.0); }',
    depthTest: false, depthWrite: false,
  }));
  try {
    // sur téléphone, un rendu minuscule par famille de programme avant le relevé : une famille que le pilote ne supporte pas est relevée ici (gpuDrawScan, 01a-gpu.js)
    if (scan === undefined ? (COARSE || GFX_SAFE) && !gpuScanDone(MAPL.id) : scan) {
      // le ciel, la poussière et la météo, masqués pour le relevé, sont dessinés en partie : leurs familles font partie du balayage
      FX.dust.visible = saved.dust; sky.visible = true; for (const o of weather) o.visible = true;
      try { await gpuDrawScan(scene, cam, MAPL.id); } finally { FX.dust.visible = false; sky.visible = false; for (const o of weather) o.visible = false; }
      if (csm) { updateShadows(); for (const l of csm.lights) l.shadow.needsUpdate = true; } // les caméras d'ombre ont maintenant leur orientation (voir le rendu préalable plus bas)
    }
    renderer.shadowMap.needsUpdate = true; // les ombres sont calculées au premier rendu, les tuiles suivantes les réutilisent (autoUpdate est coupé, voir 01-core.js)
    for (let ty = 0; ty < nt; ty++) for (let tx = 0; tx < nt; tx++) {
      const x0 = Math.floor(tx * RW / nt), x1 = Math.floor((tx + 1) * RW / nt), y0 = Math.floor(ty * RH / nt), y1 = Math.floor((ty + 1) * RH / nt), w = x1 - x0, h = y1 - y0;
      if (nt > 1) cam.setViewOffset(RW, RH, x0, y0, w, h);
      const rt = new THREE.WebGLRenderTarget(w, h, lo ? { type: THREE.HalfFloatType } : { type: THREE.HalfFloatType, samples: 4 });
      renderer.setRenderTarget(rt); renderer.setClearColor(VOID.on ? satVoidClear() : 0x2a2620, 1);
      // tout premier rendu (démarrage) : CSM place ses cascades d'après l'orientation des caméras d'ombre, qui n'existe
      // qu'après un premier rendu des ombres ; sans ce rendu préalable, le relevé sortait sans aucune ombre
      if (csm && csm.lights.some((l) => !l.shadow.map)) {
        renderer.clear(); renderer.render(scene, cam);
        updateShadows(); for (const l of csm.lights) l.shadow.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
      }
      renderer.clear(); renderer.render(scene, cam);
      const out = new THREE.WebGLRenderTarget(w, h);
      quad.material.uniforms.t.value = rt.texture;
      renderer.setRenderTarget(out); quad.render(renderer);
      const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
      renderer.setRenderTarget(null);
      rt.dispose(); out.dispose();
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      if (lo) { const s2 = document.createElement('canvas'); s2.width = w; s2.height = h; s2.getContext('2d').putImageData(img, 0, 0); g.imageSmoothingQuality = 'high'; const dx = Math.floor(x0 * W / RW), dy = Math.floor(y0 * H / RH); g.drawImage(s2, dx, dy, Math.ceil(x1 * W / RW) - dx, Math.ceil(y1 * H / RH) - dy); }
      else g.putImageData(img, x0, y0);
      if (nt > 1) await gpuBarrier('satellite ' + (ty * nt + tx + 1) + '/' + nt * nt);
    }
  } finally {
    renderer.setRenderTarget(null); renderer.setClearColor(saved.cc, saved.ca);
    // la géométrie d'un FullScreenQuad est partagée par toutes les passes de post-traitement : on ne libère que la matière
    // (quad.dispose() la libérerait, et pendant le chargement, sans nouvelle image, three.js ne la renverrait pas au GPU)
    quad.material.dispose(); cam.clearViewOffset();
    scene.fog.density = saved.fog; FX.dust.visible = saved.dust; sky.visible = true;
    for (const o of weather) o.visible = true;
    camera.position.copy(saved.p); camera.rotation.copy(saved.r); updateShadows();
  }
  KS.sat = c;
}
const TAC_S = 7.5; // pixels par mètre sur la carte tactique
const tacX = (x) => (x - MAP.x0) * TAC_S, tacY = (z) => (z - MAP.z0) * TAC_S;

/* ---------- Tablette en vue subjective ----------
   Tablette durcie tenue à deux mains par le bas des flancs : les pouces sur le cadre, les doigts derrière (cachés par la tablette),
   les avant-bras qui montent du bas de l'écran. Repère : x vers la droite, y vers le haut, z vers l'avant de l'écran. */
const TABLET = { w: 0.26, h: 0.172, d: 0.022, scr: [0.208, 0.13, 0.012] };
/* main droite (la gauche en miroir) : centre de la paume juste à l'extérieur du flanc et en arrière de la tablette, doigts vers le haut,
   l'intérieur et l'arrière (ils passent derrière), dos de la main vers l'extérieur ; le pouce, côté radial, vient sur le cadre */
const TABLET_GRIP = { p: [0.142, -0.03, -0.04], f: [-0.5, 0.8, -0.4], b: [1, 0, -0.6] };
function buildTabletRig() {
  const M = gunMaterials(), K = ksDevMats(), g = new THREE.Group(), T = TABLET; g.visible = false; VM.root.add(g);
  // coque olive, cadre sombre de l'écran, gros coins en caoutchouc, bandes de caoutchouc grenu sur les flancs (là où sont les mains)
  rb(g, K.shell, 0, 0, 0, T.w, T.h, T.d, 0.01);
  rb(g, K.face, 0, 0.002, T.d / 2 + 0.0004, 0.232, 0.154, 0.002, 0.005);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) rb(g, K.rubber, sx * (T.w / 2 - 0.011), sy * (T.h / 2 - 0.011), 0, 0.034, 0.034, T.d + 0.007, 0.01);
    rb(g, K.rubber, sx * (T.w / 2 - 0.0015), 0, 0, 0.007, T.h - 0.07, T.d + 0.003, 0.003);
    // vis de la coque et poignée de sangle au dos
    for (const sy of [-1, 1]) cy(g, K.metal, sx * 0.108, sy * 0.074, T.d / 2 + 0.0006, 0.0022, 0.0012);
    rb(g, K.rubber, sx * 0.07, 0, -T.d / 2 - 0.003, 0.03, 0.11, 0.006, 0.003);
  }
  // sous l'écran : trois touches et un témoin ; au-dessus : objectif ; antenne courte sur le coin supérieur droit
  for (let i = 0; i < 3; i++) rb(g, K.metal, -0.024 + i * 0.024, -0.065, T.d / 2 + 0.0012, 0.016, 0.006, 0.002, 0.0015);
  const led = new THREE.Mesh(G_CYL12, M.dot); led.scale.set(0.0018, 0.001, 0.0018); led.rotation.x = Math.PI / 2; led.position.set(0.09, -0.065, T.d / 2 + 0.0012); g.add(led);
  cy(g, M.glass, 0, 0.071, T.d / 2 + 0.0008, 0.0032, 0.0016);
  cy(g, K.metal, 0.1, T.h / 2 + 0.004, -0.003, 0.006, 0.01, 0);
  cy(g, K.rubber, 0.1, T.h / 2 + 0.024, -0.003, 0.0048, 0.032, 0);
  part(g, new THREE.SphereGeometry(1, 10, 8), K.rubber, 0.1, T.h / 2 + 0.04, -0.003, 0.0048, 0.0048, 0.0048);
  const sc = document.createElement('canvas'); sc.width = 320; sc.height = 200;
  const tex = new THREE.CanvasTexture(sc); tex.encoding = THREE.sRGBEncoding;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(T.scr[0], T.scr[1]), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(1.5, 1.5, 1.5) }));
  scr.position.set(0, T.scr[2], T.d / 2 + 0.0016); g.add(scr);
  const grips = {};
  for (const s of [-1, 1]) { const G = TABLET_GRIP; grips[s > 0 ? 'R' : 'L'] = devGrip(g, [s * G.p[0], G.p[1], G.p[2]], [s * G.f[0], G.f[1], G.f[2]], [s * G.b[0], G.b[1], G.b[2]]); }
  bakeRig(g);
  KS.rig = { g, tex, sc, grips, armR: makeArm(M, VM.root, -1), armL: makeArm(M, VM.root, 1) };
  setArmVisible(KS.rig.armR, false); setArmVisible(KS.rig.armL, false);
}
function drawTabletScreen() {
  const R = KS.rig, g = R.sc.getContext('2d'), W = R.sc.width, H = R.sc.height, t = MATCH.time;
  g.fillStyle = '#07120b'; g.fillRect(0, 0, W, H);
  if (KS.mode === 'uav') {
    const cx = W / 2, cy = H / 2 + 6;
    g.strokeStyle = 'rgba(120,230,140,0.45)'; g.lineWidth = 1.5;
    for (const r of [22, 44, 66, 86]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 90, cy); g.lineTo(cx + 90, cy); g.moveTo(cx, cy - 90); g.lineTo(cx, cy + 90); g.stroke();
    const a = t * 3.2;
    const grd = g.createConicGradient ? g.createConicGradient(a - 0.8, cx, cy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(120,230,140,0)'); grd.addColorStop(0.12, 'rgba(120,230,140,0.35)'); grd.addColorStop(0.13, 'rgba(120,230,140,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 86, 0, TAU); g.fill(); }
    g.strokeStyle = '#8fe89a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86); g.stroke();
    if (KS.pressT >= 0) for (const e of entities) if (e.alive && !allied(e, PL.ent)) { g.fillStyle = '#ff5a48'; g.beginPath(); g.arc(cx + e.pos.x * 1.1, cy + e.pos.z * 0.72, 3.5, 0, TAU); g.fill(); }
    g.fillStyle = '#b6f3bd'; g.font = '600 20px "Barlow Condensed", sans-serif';
    g.fillText(KS.pressT >= 0 ? _t('UAV en ligne') : _t('Liaison drone'), 12, 26);
  } else {
    const h = H - 20, w = h * ((MAP.x1 - MAP.x0) / (MAP.z1 - MAP.z0));
    if (KS.plan) g.drawImage(KS.plan, 12, 10, w, h);
    g.fillStyle = 'rgba(7,18,11,0.22)'; g.fillRect(12, 10, w, h); // (l'écran est éclairé : un voile pour que les bâtiments n'éblouissent pas)
    // la zone de frappe, à l'échelle du plan : disque rouge, contour qui clignote pendant le choix
    // mecha : les zones de largage, celle qui est choisie en vert plein
    const mk = KS.mode === 'mecha', sx = (x) => 12 + (x - MAP.x0) / (MAP.x1 - MAP.x0) * w, sz = (z) => 10 + (z - MAP.z0) / (MAP.z1 - MAP.z0) * h, sel = mk ? mnavZone(KS.map.x, KS.map.z) : null;
    const zr = (mk ? MECHA_D.blast : AIR.r) / (MAP.x1 - MAP.x0) * w, mx = sel ? sx(sel.x) : sx(KS.map.x), my = sel ? sz(sel.z) : sz(KS.map.z);
    if (mk) for (const q of MNAV.zones) if (q !== sel) { g.strokeStyle = 'rgba(143,209,106,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx(q.x), sz(q.z), Math.max(zr, 3), 0, TAU); g.stroke(); }
    if (!mk || sel) {
      g.fillStyle = mk ? 'rgba(143,209,106,0.4)' : 'rgba(228,71,59,0.35)'; g.beginPath(); g.arc(mx, my, Math.max(zr, 3), 0, TAU); g.fill();
      if (Math.floor(t * 4) % 2 === 0 || KS.stage === 'confirm') { g.strokeStyle = mk ? '#8fd16a' : '#ff5a48'; g.lineWidth = 2; g.stroke(); }
    }
    g.fillStyle = '#b6f3bd'; g.font = '600 20px "Barlow Condensed", sans-serif';
    g.fillText(mk ? _t('Largage du mecha') : _t('Appui aérien'), w + 24, 30);
    g.font = '500 16px "Barlow Condensed", sans-serif';
    g.fillText(KS.stage === 'confirm' ? _t('Cible confirmée') : KS.stage === 'cancel' ? _t('Annulé') : _t('Sélection de la cible'), w + 24, 54);
    const zp = mk && mnavZone(KS.map.x, KS.map.z) || KS.map; g.fillText(zoneName(zp.x, zp.z), w + 24, 76);
  }
  g.strokeStyle = 'rgba(180,240,190,0.25)'; g.strokeRect(2, 2, W - 4, H - 4);
  R.tex.needsUpdate = true;
}

/* ---------- Déclenchement ---------- */
function ksBusy() { return !!KS.mode; }
function ksStart(mode) {
  if (KS.mode || !PL.ent.alive || PL.knifeT > 0 || PL.nadeState || PL.switching > 0) return false;
  KS.mode = mode; KS.stage = 'raise'; KS.t = 0; KS.st = 0; KS.pressT = -1; KS.drawn = false;
  PL.reload = null; VM.action = null; PL.adsWant = false; PL.held = false;
  // l'arme part dans le dos, l'appareil sort ensuite
  sfxMech('stow'); if (mode === 'air' || mode === 'mecha') sfxKs('up');
  return true;
}
function useUAV() { if (PL.ks.uav && ksStart('uav')) { PL.ks.uav = false; updateStreakHud(); defiAdd('tUav'); } }
function useAirstrike() {
  if (!PL.ks.air || !ksStart('air')) return;
  const f = camFwd(new V3()), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 120);
  const p = h ? camera.position.clone().addScaledVector(f, h.t) : PL.ent.pos.clone().addScaledVector(new V3(f.x, 0, f.z).normalize(), 35);
  // la zone s'ouvre sur le point visé ; les avions arrivent dans le dos du joueur (cap du regard), rien à orienter
  KS.map.x = clamp(p.x, MAP.x0 + 2, MAP.x1 - 2); KS.map.z = clamp(p.z, MAP.z0 + 2, MAP.z1 - 2); KS.map.yaw = PL.yaw;
}
/* Mecha : la tablette s'ouvre sur la zone de largage la plus proche du point visé (mnavZone, 08f-mecha.js) ; on choisit l'une des zones de la carte */
function useMecha() {
  if (!PL.ks.mecha || !ksStart('mecha')) return;
  const f = camFwd(new V3()), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 60);
  const p = h ? camera.position.clone().addScaledVector(f, h.t) : PL.ent.pos.clone().addScaledVector(new V3(f.x, 0, f.z).normalize(), 20);
  const q = mnavZone(p.x, p.z) || p;
  KS.map.x = clamp(q.x, MAP.x0 + 2, MAP.x1 - 2); KS.map.z = clamp(q.z, MAP.z0 + 2, MAP.z1 - 2); KS.map.yaw = PL.yaw;
}
function ksOpenMap() {
  const mk = KS.mode === 'mecha'; hudText($('tacTitle'), mk ? _t('Largage du mecha') : _t('Frappe aérienne')); hudText($('tcMapHint'), mk ? _t('Touchez une zone de largage') : _t('Touchez la carte pour lancer la frappe'));
  KS.map.open = true; KS.map.t0 = MATCH.time; tacLegend(); $('tacmap').classList.add('show'); $('hud').classList.add('dim'); }
/* Légende de la carte de frappe : les touches ou les boutons du mode d'entrée (au doigt, les boutons de #tcMapBar la remplacent) */
function tacLegend() {
  KS.map.lm = inputMode(); const pad = KS.map.lm === 'pad';
  const L = pad
    ? [[keyGlyph('LS', 'pad sh') + keyGlyph('RS', 'pad sh'), _t('Viser')], [padGlyph(0) + padGlyph(7), _t('Confirmer')], [padGlyph(1), _t('Annuler')]]
    : [[keyGlyph(_t('Souris'), 'mouse'), _t('Viser')], [actGlyph('fire'), _t('Confirmer')], [actGlyph('ads'), _t('Annuler')]];
  hudHtml($('tacKeys'), L.map(([g, t]) => `<span>${g}<b>${esc(t)}</b></span>`).join(''));
}
function ksCloseMap() { KS.map.open = false; $('tacmap').classList.remove('show'); $('hud').classList.remove('dim'); }
function ksConfirm() {
  if (!KS.map.open || MATCH.time - KS.map.t0 < KS_MAP_GRACE) return; // un bouton déjà pressé à l'ouverture de la carte (saut, tir) ne lance pas la frappe
  if (KS.mode === 'mecha') {
    const q = mnavZone(KS.map.x, KS.map.z);
    if (!q) { hudMsg(_t('Aucune zone de largage sur cette carte'), 'none', 1.6); sfxUi('locked'); return; }
    const p = new V3(q.x, q.y, q.z);
    ksCloseMap(); KS.stage = 'confirm'; KS.st = 0; KS.pressT = 0; PL.ks.mecha = false; updateStreakHud(); sfxKs('confirm');
    mechaCall(PL.ent, p, Math.atan2(-(p.x - PL.ent.pos.x), -(p.z - PL.ent.pos.z)) + Math.PI); // il se pose tourné à l'opposé du joueur, vers le front
    return;
  }
  ksCloseMap(); KS.stage = 'confirm'; KS.st = 0; KS.pressT = 0; PL.ks.air = false; updateStreakHud();
  sfxKs('confirm');
  netAirstrike(new V3(KS.map.x, 0, KS.map.z), KS.map.yaw, PL.ent);
  hudMsg(_t('Frappe aérienne en approche'), 'ally', 2.5);
}
function ksCancel() {
  if (KS.mode !== 'air' && KS.mode !== 'mecha') return;
  ksCloseMap(); KS.stage = 'cancel'; KS.st = 0; sfxKs('cancel');
}
function ksAbort() {
  // appel coupé avant le bouton (mort pendant le geste) : la série n'a pas servi, elle reste prête (la frappe, elle, ne se dépense qu'à la confirmation)
  if (KS_PHONE.has(KS.mode) && KS.pressT < 0) { PL.ks[KS.mode] = true; updateStreakHud(); }
  if (KS.map.open) ksCloseMap(); KS.mode = null; VM.sling = 0;
  if (KS.rig) { KS.rig.g.visible = false; setArmVisible(KS.rig.armR, false); setArmVisible(KS.rig.armL, false); }
  if (KS.phone) { KS.phone.g.visible = false; setArmVisible(KS.phone.arm, false); }
}
/* Déplacement du point visé, en mètres */
function ksMapMove(dx, dz) {
  const m = KS.map;
  m.x = clamp(m.x + dx, MAP.x0 + 1, MAP.x1 - 1); m.z = clamp(m.z + dz, MAP.z0 + 1, MAP.z1 - 1);
}
/* Souris capturée : le point suit la souris comme un curseur, 1 pixel de souris pour 1 pixel de la carte affichée (avant, 0,07 m par pixel : un peu plus de la
   moitié de la vitesse d'un curseur). La manette passe par padMapMove (09qc-manette.js). */
function ksMapMouse(dx, dy) {
  const r = $('tacCanvas').getBoundingClientRect(), k = r.height > 0 ? (MAP.z1 - MAP.z0) / r.height : 0.12;
  ksMapMove(dx * k, dy * k);
}
function ksMapKey(code) {
  if (code === 'Enter' || code === 'Space') ksConfirm();
  else if (code === KS_KEYS[PL.ksSel.indexOf(KS.mode)] || code === 'KeyX' || code === 'Backspace') ksCancel(); // la touche de la série l'annule
}

/* Déroulé commun des séries : l'arme passe dans le dos par-dessus l'épaule (0,26 s), l'appareil
   sort de derrière, on s'en sert, on le range, puis l'arme revient de l'épaule avec un petit
   rebond. On garde la liberté de mouvement tout du long (sauf sur la carte de ciblage). */
const KS_T = { stow: 0.26, draw: 0.36 };
/* Terminal : instant de la pression du bouton, début du retour à la hanche (secondes depuis l'appel) */
const KS_PH = { press: 0.48, down: 0.74 };
/* Poses des appareils dans l'espace de la caméra, sorti (up) et rangé (down) : position x, y, z puis rotation x, y, z */
const PHONE_POSE = { up: [0.072, -0.058, -0.295, -0.3, -0.22, 0.12], down: [0.3, -0.46, -0.16, -1.2, -0.9, 0.9] };
const TABLET_POSE = { up: [0, -0.055, -0.36, -0.3, 0, 0], down: [0.06, -0.62, -0.3, -1.35, 0.25, 0.3] };
/* l'appareil et ses bras ne sont visibles que quand l'arme est assez loin dans le dos (bras d'arme masqués, voir updateViewmodel) */
const KS_GATE = 0.55;
function ksSling(dt, stowing) {
  // rangement : courbe douce ; sortie : arrivée rapide puis léger dépassement qui se rattrape
  if (stowing) VM.sling = Math.min(1, VM.sling + dt / KS_T.stow);
  else {
    if (!KS.drawn) { KS.drawn = true; KS.drawT = 0; sfxMech('draw'); }
    KS.drawT += dt; const u = clamp(KS.drawT / KS_T.draw, 0, 1);
    VM.sling = (1 - smoothstep(0, 1, u)) - Math.sin(u * Math.PI) * 0.06 * u;
  }
  return !stowing && KS.drawT >= KS_T.draw;
}
function updateKillstreak(dt) {
  const R = KS.rig; if (!R) return;
  if (!KS.mode) { if (R.g.visible || (KS.phone && KS.phone.g.visible)) ksAbort(); return; }
  if (!PL.ent.alive) { ksAbort(); return; }
  KS.t += dt; KS.st += dt;
  const B = VM.bobO, BR = VM.bobR, run = VM.sprint;
  if (KS_PHONE.has(KS.mode)) {
    const P = KS.phone, t = KS.t;
    // le terminal sort de derrière la hanche droite une fois l'arme dans le dos, le pouce presse le bouton d'appel, on garde un
    // instant le terminal sous les yeux (l'écran confirme l'appel), puis il retourne à la hanche
    const up = smoothstep(0.16, 0.38, t) * (1 - smoothstep(KS_PH.down, KS_PH.down + 0.16, t));
    if (KS.pressT < 0 && t > KS_PH.press) {
      KS.pressT = 0; sfxKs('press');
      // hélicoptère refusé (un allié en a appelé un pendant le geste) : la série reste prête
      if (KS.mode === 'heli') { if (!callHeli(PL.ent)) { PL.ks.heli = true; updateStreakHud(); hudMsg(_t('Un hélicoptère est déjà en vol'), 'none', 1.8); } }
      else if (KS.mode === 'sat') satFire(PL.ent);
      else if (KS.mode === 'iem') iemFire(PL.ent);
      else if (KS.mode === 'fpv') fpvLaunch(PL.ent);
      else {
        uavStart(PL.ent.team); spawnDrone(PL.ent.team); netUav(PL.ent); sfxAnnounce('uav_on');
        hudMsg(_t('UAV en ligne'), 'ally', 2);
      }
    }
    if (KS.pressT >= 0) KS.pressT += dt;
    P.g.visible = up > 0.01 && VM.sling > KS_GATE;
    const U = PHONE_POSE.up, D = PHONE_POSE.down, pk = KS.pressT >= 0 ? Math.sin(clamp(KS.pressT / 0.22, 0, 1) * Math.PI) : 0;
    // la pression du pouce fait plonger le terminal de quelques millimètres
    P.g.position.set(lerp(D[0], U[0], up) + B.x - run * 0.02, lerp(D[1], U[1], up) + B.y - run * 0.03 + Math.sin(MATCH.time * 2) * 0.002 - pk * 0.004, lerp(D[2], U[2], up) - pk * 0.004);
    P.g.rotation.set(lerp(D[3], U[3], up) + BR.x - run * 0.12 - pk * 0.06, lerp(D[4], U[4], up) + BR.y, lerp(D[5], U[5], up) + BR.z);
    P.press(pk);
    if (P.g.visible) drawPhoneScreen(KS.pressT >= 0);
    armOnDevice(P.arm, P.grip, 'P', 'hold', pk, P.g.visible, 0.35);
    if (P.g.visible) attachToHand(P.g, P.grip, P.arm.hand);
    if (ksSling(dt, t < KS_PH.down + 0.12)) { KS.mode = null; P.g.visible = false; setArmVisible(P.arm, false); VM.sling = 0; }
    return;
  }
  let raise = 0, stowing = true;
  if (KS.stage === 'raise') { raise = smoothstep(0.14, 0.45, KS.t); if (KS.t > 0.5) { KS.stage = 'select'; ksOpenMap(); } }
  else if (KS.stage === 'select') raise = 1;
  else {
    const hold = KS.stage === 'confirm' ? 0.55 : 0.1;
    raise = 1 - smoothstep(hold, hold + 0.26, KS.st);
    // l'arme ne revient qu'une fois la tablette presque rentrée : jamais les deux à l'écran
    stowing = raise > 0.4;
  }
  if (KS.pressT >= 0) KS.pressT += dt;
  if (ksSling(dt, stowing)) { KS.mode = null; VM.sling = 0; }
  // pose de la tablette, tenue à deux mains ; le pouce droit touche l'écran pour confirmer
  const g = R.g; g.visible = raise > 0.01 && KS.mode !== null && VM.sling > KS_GATE;
  const b = Math.sin(MATCH.time * 1.7) * 0.004, U = TABLET_POSE.up, D = TABLET_POSE.down;
  g.position.set(lerp(D[0], U[0], raise) + B.x, lerp(D[1], U[1], raise) + b + B.y, lerp(D[2], U[2], raise));
  g.rotation.set(lerp(D[3], U[3], raise) + BR.x, lerp(D[4], U[4], raise) + BR.y, lerp(D[5], U[5], raise) + BR.z);
  const pk = KS.pressT >= 0 ? Math.sin(clamp(KS.pressT / 0.32, 0, 1) * Math.PI) : 0;
  armOnDevice(R.armR, R.grips.R, 'R', 'tablet', pk, g.visible);
  armOnDevice(R.armL, R.grips.L, 'L', 'tablet', 0, g.visible);
  if (g.visible) drawTabletScreen();
}

/* ---------- Carte tactique en surimpression ---------- */
function drawTacMap() {
  if (!KS.map.open) return;
  const cv = $('tacCanvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, t = MATCH.time, me = PL.ent;
  if (KS.plan) g.drawImage(KS.plan, 0, 0); else { g.fillStyle = MMPAL.bg; g.fillRect(0, 0, W, H); }
  // quadrillage militaire
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1; g.font = '600 14px "Barlow Condensed", sans-serif'; g.fillStyle = 'rgba(230,234,236,0.75)';
  const MW = MAP.x1 - MAP.x0, MH = MAP.z1 - MAP.z0;
  for (let i = 0; i <= MW; i += 12) { g.beginPath(); g.moveTo(i * TAC_S, 0); g.lineTo(i * TAC_S, H); g.stroke(); if (i < MW) g.fillText(String.fromCharCode(65 + i / 12), i * TAC_S + 4, 14); }
  for (let j = 0; j <= MH; j += 12) { g.beginPath(); g.moveTo(0, j * TAC_S); g.lineTo(W, j * TAC_S); g.stroke(); if (j < MH) g.fillText(String(j / 12 + 1), 4, j * TAC_S + 28); }
  // noms de zones
  g.font = '600 15px "Barlow Condensed", sans-serif'; g.textAlign = 'center';
  const done = new Set();
  for (const z of ZONES) {
    const key = z[0] + Math.sign(z[3] + z[4]); if (done.has(key) || z[0] === _t('Base Alpha') || z[0] === _t('Base Bravo')) continue; done.add(key);
    const x = tacX((z[1] + z[2]) / 2), y = tacY((z[3] + z[4]) / 2);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(z[0], x + 1, y + 1); g.fillStyle = 'rgba(236,229,211,0.85)'; g.fillText(z[0], x, y);
  }
  g.textAlign = 'left';
  // zone de la frappe : un disque rouge de AIR.r mètres et une onde qui s'en échappe, sous les unités ; mecha : les zones de largage
  const m = KS.map, cx = tacX(m.x), cy = tacY(m.z), R = AIR.r * TAC_S, w = (t * 0.8) % 1, mk = KS.mode === 'mecha';
  if (mk) tacDrop(g, m, t);
  else {
  g.fillStyle = 'rgba(228,71,59,0.24)'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(239,85,67,0.95)'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = `rgba(239,85,67,${(0.6 * (1 - w)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * (1 + w * 0.35), 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(239,85,67,0.6)'; g.lineWidth = 1.5; g.setLineDash([8, 7]); g.beginPath(); g.arc(cx, cy, R * 0.55, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  // unités
  for (const o of entities) {
    if (!o.alive) continue;
    const x = tacX(o.pos.x), y = tacY(o.pos.z);
    if (o === me) {
      g.save(); g.translate(x, y); g.rotate(-o.yaw); g.fillStyle = '#F4BE3A'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    } else if (allied(o, me)) {
      g.save(); g.translate(x, y); g.rotate(-o.yaw); g.fillStyle = '#8FD16A'; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    } else {
      const shot = t - o.lastShotT < 1.5 || satOn(me.team), b = shot ? null : uavBlip(o, me, false); // tir ou satellite : à sa place ; sinon le dernier relevé de l'UAV
      if (!shot && !b) continue;
      g.globalAlpha = shot ? 1 : b.a;
      g.fillStyle = '#E4473B'; g.beginPath(); g.arc(shot ? x : tacX(b.x), shot ? y : tacY(b.z), 5.5, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
      g.globalAlpha = 1;
    }
  }
  // mire au centre de la zone
  const pr = 14;
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, pr, 0, TAU); g.moveTo(cx - pr - 10, cy); g.lineTo(cx - pr + 6, cy); g.moveTo(cx + pr - 6, cy); g.lineTo(cx + pr + 10, cy);
  g.moveTo(cx, cy - pr - 10); g.lineTo(cx, cy - pr + 6); g.moveTo(cx, cy + pr - 6); g.lineTo(cx, cy + pr + 10); g.stroke();
  const zp = mk && mnavZone(m.x, m.z) || m; hudText($('tacZone'), zoneName(zp.x, zp.z)); if (KS.map.lm !== inputMode()) tacLegend(); // (la main passe de la souris à la manette : la légende suit)
  const near = !mk && hyp(me.pos.x - m.x, me.pos.z - m.z) < AIR.r + 2;
  hudStyle($('tacWarn'), 'opacity', near ? '1' : '0');
}

/* Zones de largage du mecha sur la carte (MNAV.zones) : chacune à la taille du souffle de sa chute, un losange au centre ; celle qui est choisie (la
   plus proche du curseur ou du doigt) en vert plein, avec une onde, reliée au curseur s'il est ailleurs */
function tacDrop(g, m, t) {
  const sel = mnavZone(m.x, m.z), cx = tacX(m.x), cy = tacY(m.z), R = MECHA_D.blast * TAC_S, d = 1.4 * TAC_S, w = (t * 0.8) % 1;
  for (const q of MNAV.zones) {
    const x = tacX(q.x), y = tacY(q.z), on = q === sel;
    g.fillStyle = on ? 'rgba(143,209,106,0.3)' : 'rgba(143,209,106,0.1)'; g.strokeStyle = on ? '#8fd16a' : 'rgba(143,209,106,0.6)'; g.lineWidth = on ? 3 : 2;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = on ? '#8fd16a' : 'rgba(143,209,106,0.6)'; g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath(); g.fill();
    if (!on) continue;
    g.strokeStyle = `rgba(143,209,106,${(0.6 * (1 - w)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, R * (1 + w * 0.35), 0, TAU); g.stroke();
    if (hyp(x - cx, y - cy) > R) { g.strokeStyle = 'rgba(143,209,106,0.7)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); g.setLineDash([]); }
  }
}
/* ---------- Appareils : chasseurs, bombes, drone ---------- */
function aircraftGeometry() {
  if (KS.geo) return KS.geo;
  const hull = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x80888f, roughness: 0.42, metalness: 0.55, envMapIntensity: 1 }));
  const dark = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.5, metalness: 0.5 }));
  const glass = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.6 }));
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(6, 3.2, 1.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const prof = [[0.0, -6.3], [0.5, -6.2], [0.62, -5.3], [0.82, -2], [0.86, 1.5], [0.7, 3.6], [0.44, 5.2], [0.16, 6.4], [0, 6.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 16); fus.rotateX(-Math.PI / 2);
  const wing = new THREE.Shape(); wing.moveTo(0, 2.6); wing.lineTo(4.7, -1.7); wing.lineTo(4.7, -2.5); wing.lineTo(0, -2.9); wing.lineTo(-4.7, -2.5); wing.lineTo(-4.7, -1.7); wing.closePath();
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }); wg.rotateX(-Math.PI / 2); wg.translate(0, -0.1, 0.6);
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(2.3, 0); fin.lineTo(3.3, 2.5); fin.lineTo(2.4, 2.5); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false }); fg.rotateY(-Math.PI / 2); fg.translate(0.05, 0.45, 2.9);
  const tail = new THREE.Shape(); tail.moveTo(0, 1); tail.lineTo(2.1, -0.4); tail.lineTo(2.1, -0.9); tail.lineTo(0, -1); tail.lineTo(-2.1, -0.9); tail.lineTo(-2.1, -0.4); tail.closePath();
  const tg = new THREE.ExtrudeGeometry(tail, { depth: 0.08, bevelEnabled: false }); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, 5.1);
  const canopy = new THREE.SphereGeometry(1, 16, 10); canopy.scale(0.46, 0.42, 1.5); canopy.translate(0, 0.55, -3.3);
  const nozzle = new THREE.CylinderGeometry(0.5, 0.58, 0.8, 16, 1, true); nozzle.rotateX(Math.PI / 2); nozzle.translate(0, 0, 6.5);
  const flame = new THREE.ConeGeometry(0.42, 2.6, 12, 1, true); flame.rotateX(-Math.PI / 2); flame.translate(0, 0, 8.1);
  // drone : fuselage fin, grande envergure, empennage en V
  const dprof = [[0, -2.2], [0.25, -2.1], [0.3, -1.2], [0.32, 0.8], [0.22, 1.8], [0, 2.3]].map(([r, y]) => new THREE.Vector2(r, y));
  const dfus = new THREE.LatheGeometry(dprof, 12); dfus.rotateX(-Math.PI / 2);
  const dwing = new THREE.BoxGeometry(11, 0.07, 0.55); dwing.translate(0, 0.1, -0.2);
  const dv1 = new THREE.BoxGeometry(1.6, 0.05, 0.4); dv1.rotateZ(0.6); dv1.translate(0.6, 0.45, 1.9);
  const dv2 = new THREE.BoxGeometry(1.6, 0.05, 0.4); dv2.rotateZ(-0.6); dv2.translate(-0.6, 0.45, 1.9);
  const bomb = new THREE.CylinderGeometry(0.16, 0.16, 1.3, 10); bomb.rotateX(Math.PI / 2);
  // lampe du drone (verte vue d'un allié, rouge d'un ennemi) : partagée par tous les drones
  const lamp = new THREE.SphereGeometry(0.12, 8, 6), lampMat = [0, 1].map((en) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(en ? 6 : 0.5, en ? 0.4 : 6, 0.4) }));
  KS.geo = { hull, dark, glass, glow, fus, wg, fg, tg, canopy, nozzle, flame, dfus, dwing, dv1, dv2, bomb, lamp, lampMat };
  return KS.geo;
}
function makeJet() {
  const G = aircraftGeometry(), g = new THREE.Group();
  for (const [geo, mat] of [[G.fus, G.hull], [G.wg, G.hull], [G.fg, G.hull], [G.tg, G.hull], [G.canopy, G.glass], [G.nozzle, G.dark]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  const f = new THREE.Mesh(G.flame, G.glow); g.add(f); g.userData.flame = f;
  scene.add(g); return g;
}
/* Frappe aérienne : une zone ronde de AIR.r mètres, sans axe à régler. AIR.n bombes tombent dans le disque, leurs centres à AIR.spread mètres au
   plus du milieu, en tournesol (angle d'or) tourné du cap des avions : le motif ne dépend que de la cible et du cap, transmis en ligne (arrondis
   comme dans le message, netAirstrike), si bien que chaque joueur voit tomber les bombes là où le propriétaire calcule les dégâts. Avec un souffle de
   AIR.blast mètres, tout le disque est mortel jusqu'à 10 m du centre et à peu près aux trois cinquièmes au bord (11 m), mesuré dans le moteur (frappe.js) :
   AIR.r est le rayon affiché, celui où la zone reste mortelle pour la plupart. Dix bombes sur 8,5 m couvrent 430 m² à découvert (351 m² avec huit bombes
   sur 7,2 m, 337 m² pour l'ancienne bande de six) et 23 m de long dans une rue de 12 m (21 m, 30 m).
   Abri : une bombe éclate sur la première surface qu'elle rencontre en tombant (airImpact : un toit, même de ceux où l'on ne marche pas, qui ne
   sont que des boîtes de tir ; le verre d'une verrière ne l'arrête pas). Le souffle d'une bombe tombée à ciel ouvert ne fait que AIR.roof de ses dégâts
   à qui se tient sous un toit (explode, roofK) : dans une maison, on survit le plus souvent à une frappe, sauf à se tenir sur le seuil ou contre une
   fenêtre où plusieurs bombes tombent ; sous un auvent ouvert, les bombes voisines restent mortelles. Frappe centrée sur la cible, sur les huit cartes :
   au fond d'un bâtiment, 16 % de morts (30 % sans l'abri), sous un auvent 76 % (86 %), à découvert 98 % (inchangé). Contrôle : frappe.js, partie 4. */
const AIR = { r: 11, n: 10, spread: 8.5, blast: 8.5, dmg: 180, roof: 0.5 };
/* Toit au-dessus d'un point (jusqu'à h mètres) : une boîte qui arrête les tirs, le verre mis à part */
function roofAbove(x, y, z, h) {
  for (let k = 0; k < 4; k++) {
    const r = rayWorld(x, y, z, 0, 1, 0, h, 2);
    if (!r) return false;
    if (r.m !== 'glass') return true;
    y += r.t + 0.3; h -= r.t + 0.3; if (h <= 0) return false;
  }
  return false;
}
/* Point d'impact d'une bombe : la première surface touchée en tombant à la verticale (sans les props, qui bougent : le même calcul chez tous les joueurs),
   le verre traversé. groundHeight, lui, ne voit que ce qui se marche. */
function airImpact(x, z) {
  let y = 60;
  for (let k = 0; k < 4; k++) {
    const r = rayWorld(x, y, z, 0, -1, 0, y + 260, 2);
    if (!r) return groundHeight(x, z, 12); // au-dessus du vide (îles flottantes) : voir airstrike
    if (r.m !== 'glass') return y - r.t;
    y -= r.t + 0.3;
  }
  return groundHeight(x, z, 12);
}
const KS_MAP_GRACE = 0.2; // secondes après l'ouverture de la carte pendant lesquelles on ne peut pas confirmer
function airPattern(target, yaw) {
  const pts = [], dir = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (let i = 0; i < AIR.n; i++) {
    const r = AIR.spread * Math.sqrt((i + 0.5) / AIR.n), a = yaw + i * 2.39996;
    pts.push(new V3(clamp(target.x + Math.cos(a) * r, MAP.x0 + 1, MAP.x1 - 1), 0, clamp(target.z + Math.sin(a) * r, MAP.z0 + 1, MAP.z1 - 1)));
  }
  // dans l'ordre du passage des avions : les premières bombes tombent à l'entrée de la zone
  return pts.sort((p, q) => (p.x - q.x) * dir.x + (p.z - q.z) * dir.z);
}
function airstrike(target, yaw, owner) {
  const dir = new V3(-Math.sin(yaw), 0, -Math.cos(yaw)), side = new V3(-dir.z, 0, dir.x);
  const T0 = MATCH.time, speed = 115, lead = 2.4, alt = 44, life = owner.spawnAt; // life : la frappe ne compte dans la série que dans la vie où elle a été appelée
  for (let j = 0; j < 2; j++) {
    const start = target.clone().addScaledVector(dir, -speed * lead).addScaledVector(side, j ? 7 : -7); start.y = alt + j * 4;
    const mesh = makeJet(); mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), dir);
    KS.jets.push({ mesh, pos: start, dir: dir.clone(), speed, t: 0, life: 5.5, bank: j ? 0.15 : -0.15, puff: 0 });
  }
  // passage des avions (enregistré, il suit l'avion de tête ; sinon synthétisé) et annonce radio
  if (!sfxJetPass(KS.jets[KS.jets.length - 2])) MATCH.events.push({ t: T0 + 0.9, fn: () => sfxJet() });
  sfxAnnounce(ksFriendly(owner) ? 'air_on' : 'air_enemy');
  airPattern(target, yaw).forEach((p, i) => {
    p.y = airImpact(p.x, p.z);
    if (VOID.on && p.y <= VOID.floor + 1) p.y = target.y; // au-dessus du vide : la bombe éclate en l'air, au niveau visé
    const tr = T0 + 1.35 + i * 0.11, fall = 1.05;
    MATCH.events.push({ t: tr, fn: () => {
      const rel = target.clone().addScaledVector(dir, speed * ((tr - T0) - lead)).addScaledVector(side, i % 2 ? 7 : -7); rel.y = alt - 1;
      const G = aircraftGeometry(), m = new THREE.Mesh(G.bomb, G.dark); m.castShadow = true; scene.add(m);
      KS.bombs.push({ mesh: m, a: rel, b: p.clone(), t: 0, dur: fall });
      if (i % 2 === 0) sfxBomb(p, fall);
    } });
    MATCH.events.push({ t: tr + fall, fn: () => explode(p, owner, _t('Frappe aérienne'), AIR.blast, AIR.dmg, life, AIR.roof) });
  });
}
function spawnDrone(team) {
  if (KS.drones.some((d) => d.team === team)) return;
  const G = aircraftGeometry(), g = new THREE.Group();
  for (const geo of [G.dfus, G.dwing, G.dv1, G.dv2]) { const m = new THREE.Mesh(geo, G.hull); m.castShadow = true; g.add(m); }
  const lamp = new THREE.Mesh(G.lamp, G.lampMat[team === PL.ent.team ? 0 : 1]);
  lamp.position.set(0, -0.3, 0); g.add(lamp);
  scene.add(g);
  KS.drones.push({ mesh: g, team, a: team ? Math.PI : 0, lamp, snd: sfxDrone(new V3(0, 72, 0)) });
}
function updateAircraft(dt) {
  updateHelis(dt); updateDrones(dt); updateMechas(dt);
  for (let i = KS.jets.length - 1; i >= 0; i--) {
    const j = KS.jets[i]; j.t += dt;
    j.pos.addScaledVector(j.dir, j.speed * dt); j.pos.y += Math.sin(j.t * 0.7) * 0.05;
    j.mesh.position.copy(j.pos); sfxEmitterMove(j.snd, j.pos);
    j.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), j.dir); j.mesh.rotateZ(j.bank + Math.sin(j.t * 1.3) * 0.05);
    j.mesh.userData.flame.scale.set(1, 1, 0.8 + Math.random() * 0.5);
    j.puff += dt;
    if (j.puff > 0.03) {
      j.puff = 0;
      const back = j.pos.clone().addScaledVector(j.dir, 7.5);
      FX.smoke.spawn(back.x, back.y, back.z, rand(-0.5, 0.5), rand(-0.2, 0.3), rand(-0.5, 0.5), 2.2, 0.8, 3.2, 0.75, 0.72, 0.7, 0.22, 0, 0, 0.4);
      FX.add.spawn(back.x, back.y, back.z, 0, 0, 0, 0.06, 1.6, 0.6, 5, 2.6, 1, 0.8, 0);
    }
    if (j.t > j.life) { scene.remove(j.mesh); KS.jets.splice(i, 1); }
  }
  for (let i = KS.bombs.length - 1; i >= 0; i--) {
    const b = KS.bombs[i]; b.t += dt; const u = clamp(b.t / b.dur, 0, 1);
    const x = lerp(b.a.x, b.b.x, u), z = lerp(b.a.z, b.b.z, u), y = lerp(b.a.y, b.b.y, u * u);
    const prev = b.mesh.position.clone(); b.mesh.position.set(x, y, z);
    const v = b.mesh.position.clone().sub(prev); if (v.lengthSq() > 1e-6) b.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), v.normalize());
    if (u >= 1) { scene.remove(b.mesh); KS.bombs.splice(i, 1); }
  }
  for (let i = KS.drones.length - 1; i >= 0; i--) {
    const d = KS.drones[i];
    if (MATCH.uav[d.team] <= 0) { scene.remove(d.mesh); sfxEmitterStop(d.snd, 1.5); KS.drones.splice(i, 1); continue; }
    d.a += dt * 0.16;
    const x = Math.cos(d.a) * 55, z = Math.sin(d.a) * 78, y = 72 + d.team * 6;
    const nx = Math.cos(d.a + 0.01) * 55, nz = Math.sin(d.a + 0.01) * 78;
    d.mesh.position.set(x, y, z);
    d.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), new V3(nx - x, 0, nz - z).normalize()); d.mesh.rotateZ(-0.25);
    d.lamp.visible = Math.floor(MATCH.time * 2) % 2 === 0;
    sfxEmitterMove(d.snd, d.mesh.position);
  }
}
function clearAircraft() {
  for (const a of [...KS.jets, ...KS.bombs, ...KS.drones]) { scene.remove(a.mesh); sfxEmitterStop(a.snd, 0.05); }
  KS.jets.length = 0; KS.bombs.length = 0; KS.drones.length = 0; clearHelis(); fpvClear(); mechaClear(); ksAbort();
}
