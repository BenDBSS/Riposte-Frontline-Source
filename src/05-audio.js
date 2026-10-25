/* ==========================================================================
   AUDIO
   Bruitages enregistrés (paquets d'échantillons libres de droits, chargés au démarrage du son : 05a-sfx.js) et,
   en repli tant qu'un paquet n'est pas décodé ou s'il manque, la synthèse de ce fichier. Chaque fonction sonore
   essaie d'abord sa banque d'échantillons (sfxHas, sfxPlay), sinon synthétise.
   ========================================================================== */
const AU = { ctx: null, master: null, bus: null, verb: null, noise: null, ready: false, wind: null, heart: 0, gunBufs: {}, load: 0, lt: 0, shed: 0 };
/* Budget de voix sur téléphone (COARSE) : chaque son du monde coûte à peu près le nombre de nœuds qu'il crée, le budget se vide à AU_RATE par seconde ; au-delà, les sons
   lointains sont ignorés (les proches passent jusqu'à 1,6 fois plus haut, les sons du joueur ne sont jamais coupés). Un téléphone qui compte des dizaines de nœuds par
   tir de bot, plus les pas et les échos, laissait le fil audio en retard : le son sautait. Sur ordinateur, aucune limite. */
const AU_CAP = 70, AU_RATE = 60;
function auAfford(cost, d) {
  if (!COARSE || !AU.ctx) return true;
  const t = AU.ctx.currentTime; AU.load = Math.max(0, AU.load - (t - AU.lt) * AU_RATE); AU.lt = t;
  if (AU.load + cost > AU_CAP * (d < 20 ? 1.6 : 1)) { AU.shed++; return false; }
  AU.load += cost; return true;
}

function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
  // téléphone : tampon de sortie plus large (« playback ») : un fil audio en retard sur un téléphone chargé par le rendu fait craquer ou sauter le son
  let ctx; try { ctx = COARSE ? new Ctx({ latencyHint: 'playback' }) : new Ctx(); } catch (e) { ctx = new Ctx(); } AU.ctx = ctx;
  ctx.addEventListener('statechange', () => gpuLog('audio ' + ctx.state));
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 2.5; comp.knee.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  AU.master = ctx.createGain(); AU.master.gain.value = Settings.volume;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
  AU.master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
  // armes (tirs, explosions) : hors du compresseur du mix et du filtre qui assourdit le monde (tir du joueur, coup reçu, acouphène). Leurs crêtes arrivaient
  // 10 dB au-dessus du plafond : rattrapées par le limiteur (relâchement 120 ms), elles y perdaient le corps du son (retour du propriétaire : « sous-mixé,
  // étouffé »). Un écrêtage doux (tanh, poussé trois fois) arrondit la crête sans creuser ce qui suit : au banc, +5,5 à +6,5 dB de niveau efficace pour les
  // tirs, +3,5 à +5 dB pour les explosions, crêtes sous 0 dB ; un plateau d'aigus leur rend de la présence (+3 dB au-dessus de 3 kHz)
  const WM = 32, cv = new Float32Array(4096);
  for (let i = 0; i < cv.length; i++) cv[i] = Math.tanh((i / (cv.length - 1) * 2 - 1) * WM) * 0.89;
  AU.wpnVol = ctx.createGain(); AU.wpnVol.gain.value = Settings.volume; AU.wpnVol.connect(lim);
  const clip = ctx.createWaveShaper(); clip.curve = cv; clip.oversample = '2x'; clip.connect(AU.wpnVol);
  const drive = ctx.createGain(); drive.gain.value = 3 / WM; drive.connect(clip);
  AU.wpnG = ctx.createGain(); AU.wpnG.connect(drive);
  AU.wpn = ctx.createBiquadFilter(); AU.wpn.type = 'highshelf'; AU.wpn.frequency.value = 2800; AU.wpn.gain.value = 3; AU.wpn.connect(AU.wpnG);
  // sons de la partie (monde ; armes, échos et réverbération par AU.wpnG) : coupés net au retour aux menus (sfxGate), les sons d'interface passent à côté
  AU.world = ctx.createGain(); AU.world.connect(AU.master);
  AU.duck = ctx.createBiquadFilter(); AU.duck.type = 'lowpass'; AU.duck.frequency.value = 20000; AU.duck.Q.value = 0.5;
  AU.duckG = ctx.createGain(); AU.duck.connect(AU.duckG); AU.duckG.connect(AU.world);
  AU.bus = ctx.createGain(); AU.bus.connect(AU.duck);
  AU.gunBus = ctx.createGain(); AU.gunBus.connect(AU.master);
  AU.hud = ctx.createGain(); AU.hud.connect(AU.gunBus); // sons directs de la partie (touches, coups reçus, annonces, fin de partie) : coupés avec elle
  // tirs du joueur : bus à part, que les retours de touche creusent un instant pour qu'ils passent au travers des rafales
  AU.fpBus = ctx.createGain(); AU.fpBus.connect(AU.wpn);
  hitSampleBuild();
  // échos de rue (tirs seulement) : deux retards filtrés, le second réinjecté ; retour par le bus des armes, comme la réverbération (voir GUN_VERB)
  AU.echo = ctx.createGain();
  const d1 = ctx.createDelay(1.5), d2 = ctx.createDelay(1.5), l1 = ctx.createBiquadFilter(), l2 = ctx.createBiquadFilter(), g1 = ctx.createGain(), g2 = ctx.createGain(), fb = ctx.createGain();
  d1.delayTime.value = 0.19; d2.delayTime.value = 0.43; l1.type = l2.type = 'lowpass'; l1.frequency.value = 2200; l2.frequency.value = 1300;
  g1.gain.value = 0.42; g2.gain.value = 0.3; fb.gain.value = 0.32;
  AU.echo.connect(d1); d1.connect(l1); l1.connect(g1); g1.connect(AU.wpnG);
  AU.echo.connect(d2); d2.connect(l2); l2.connect(g2); g2.connect(AU.wpnG); l2.connect(fb); fb.connect(d2);
  // réverbération : réponse impulsionnelle générée, remplacée par une vraie (une rue, et une salle en béton sur ordinateur) dès que le paquet des armes est décodé (sfxVerbSetup)
  const len = Math.floor(ctx.sampleRate * (COARSE ? 1.5 : 2.4)), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.exp(-t * (COARSE ? 3.4 : 2.4)) * (t < 0.012 ? t / 0.012 : 1); }
  }
  const conv = ctx.createConvolver(); conv.buffer = ir; AU.conv = conv; AU.convIn = null; AU.verbReal = false;
  AU.verb = ctx.createGain(); AU.verb.gain.value = 0.5;
  AU.verbOutG = ctx.createGain(); AU.verbInG = ctx.createGain(); AU.verbInG.gain.value = 0;
  AU.verb.connect(AU.verbOutG); AU.verbOutG.connect(conv); conv.connect(AU.wpnG); AU.verb.connect(AU.verbInG);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  AU.noise = nb;
  // vent
  const w = ctx.createBufferSource(); w.buffer = nb; w.loop = true;
  const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
  const wg = ctx.createGain(); wg.gain.value = 0.05;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(wg.gain); lfo.start();
  // le vent passe par un gain coupé : il ne se fait entendre qu'en partie (setAmbience), pas dans les menus
  const wo = ctx.createGain(); wo.gain.value = 0; AU.windOut = wo;
  w.connect(wf); wf.connect(wg); wg.connect(wo); wo.connect(AU.bus); w.start();
  AU.windF = wf; AU.windG = wg;
  AU.ready = true;
  sfxBoot(); // paquets d'échantillons (05a-sfx.js) ; sans celui des armes, les tirs synthétisés sont calculés
  if (sfxReady('armes')) sfxVerbSetup(); // contexte recréé (banc audio) : les paquets sont déjà décodés
  else if (SFX.state.get('armes') && SFX.state.get('armes').s === 'failed') gunBuffersBuild(false);
  rankUpPrepare(); // fanfare de montée de niveau (05b-rankup-sound.js)
}
function setVolume(v) { if (AU.master) { AU.master.gain.value = v; AU.wpnVol.gain.value = v; } }
/* Ambiance de la carte (vent) : allumée au lancement d'une partie, éteinte au retour aux menus */
function setAmbience(on) {
  AU.ambience = on; if (!AU.windOut) return;
  // timbre et force du vent propres à la carte (voir son ambiance)
  if (on && CURMAP.def) { const [f, g] = CURMAP.def.atmo.wind; AU.windF.frequency.value = f; AU.windG.gain.value = g; }
  ambSet(on); // lit et ponctuels enregistrés de la carte (05c-ambiance.js) : le vent synthétisé s'efface dès que le lit joue
  AU.windOut.gain.setTargetAtTime(on && !AMB.bed ? 1 : 0, AU.ctx.currentTime, 0.5);
  if (CURMAP.def && CURMAP.def.ambience) CURMAP.def.ambience(on); // sons propres à la carte (cascades, oiseaux...)
  sfxGate(on);
}
/* Retour aux menus : les sons de la partie se coupent net (15 ms, juste de quoi éviter un claquement), sans fondu ni queue de réverbération ;
   le lancement d'une partie les rouvre */
function sfxGate(on) {
  const t = AU.ctx.currentTime;
  for (const p of [AU.world.gain, AU.wpnG.gain, AU.hud.gain]) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(on ? 1 : 0, t + 0.015); }
  if (!on) ANN.q.length = 0; // annonces en attente
}

/* Sortie spatialisée : renvoie un nœud d'entrée. L'air absorbe les aigus de plus en plus vite avec la distance
   (loi exponentielle : 5 kHz à 45 m, 1,4 kHz à 90 m) ; roll et ref règlent la portée (armes : plus lointaines) ; bus : AU.wpn pour les armes */
function auOut(pos, verb = 0.3, gain = 1, roll = 1.1, ref = 4, bus = AU.bus) {
  const ctx = AU.ctx, g = ctx.createGain(); g.gain.value = gain;
  let last = g;
  if (pos) {
    const d = pos.distanceTo(camera.position);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 * Math.pow(1400 / 18000, clamp(d / 90, 0, 1));
    const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 400;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    g.connect(lp); lp.connect(p); last = p;
    verb = verb + clamp(d / 60, 0, 0.5);
  }
  last.connect(bus);
  if (verb > 0) { const s = ctx.createGain(); s.gain.value = verb; last.connect(s); s.connect(AU.verb); }
  return g;
}
/* Sortie directe, sans espace ni assourdissement du mix : retours de touche, coups reçus ; aux menus, sons d'interface (jamais coupés) */
function uiOut(gain = 1) {
  const g = AU.ctx.createGain(); g.gain.value = gain; g.connect(MATCH.state === 'menu' ? AU.gunBus : AU.hud); return g;
}
function nz(dest, t, dur, type, f0, f1, q, gain, attack = 0.001) {
  if (!(gain > 0.0002)) return;
  const ctx = AU.ctx, src = ctx.createBufferSource(); src.buffer = AU.noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tn(dest, t, dur, f0, f1, type, gain, attack = 0.002) {
  if (!(gain > 0.0002)) return;
  const ctx = AU.ctx, o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

/* ---------- Coups de feu ----------
   Chaque tir est une forme d'onde stéréo calculée une fois (gunBuffersBuild, au démarrage du son, 3 variantes par
   arme pour ne jamais répéter le même échantillon), puis jouée par une seule source : un tir coûte trois nœuds au
   lieu d'une douzaine, ce qui compte à 900 coups par minute et plusieurs tireurs. Couches, du plus sec au plus long :
   click : impulsion de l'attaque | crack : claquement de la balle (bruit passe-haut très bref)
   body : souffle de bouche (bruit passe-bas qui s'éteint vers le grave) | knock : « coup » médium, sinusoïde qui
   chute, le caractère de l'arme | thump : grave dans la poitrine | tail : queue de détonation | echoes : réflexions
   des façades (retard, niveau, filtre). Chaque couche est ramenée à son propre maximum puis dosée : les nombres sont
   des niveaux relatifs. La somme sèche est saturée (drive) pour la densité, la queue s'ajoute ensuite.
   Autour : gain en vue subjective (fp) et dans le monde (world), portée (maxD), part envoyée aux échos de rue (echo),
   assourdissement du mix (duck), bruit mécanique d'après-tir (mech), son de douille (brass), claquement du coup
   sec du chargeur pour la vue subjective. */
const GUNSND = {
  rifle: { fp: 0.66, world: 1.0, maxD: 230, echo: 0.42, duck: 0.12, brass: 1, mech: [3300, 0.022, 0.2, 0.03],
    dsp: { dur: 1.3, drive: 2.7, click: 1.0, crack: [2000, 0.012, 1.0], body: [3300, 260, 0.085, 1.15], knock: [270, 110, 0.06, 1.0], thump: [105, 42, 0.14, 1.25], tail: [1200, 200, 0.46, 0.38], echoes: [[0.1, 0.32, 2000], [0.22, 0.22, 1400], [0.4, 0.15, 1000], [0.62, 0.09, 800]] } },
  ak: { fp: 0.68, world: 1.05, maxD: 240, echo: 0.46, duck: 0.14, brass: 1, mech: [3000, 0.025, 0.22, 0.03],
    dsp: { dur: 1.4, drive: 3.0, click: 1.0, crack: [1700, 0.013, 1.05], body: [3000, 230, 0.1, 1.2], knock: [230, 95, 0.07, 1.1], thump: [95, 38, 0.16, 1.35], tail: [1100, 180, 0.5, 0.4], echoes: [[0.1, 0.34, 1900], [0.22, 0.24, 1300], [0.42, 0.16, 950], [0.64, 0.1, 750]] } },
  battle: { fp: 0.72, world: 1.1, maxD: 270, echo: 0.55, duck: 0.2, brass: 1, mech: [2800, 0.028, 0.22, 0.04],
    dsp: { dur: 1.6, drive: 3.1, click: 1.0, crack: [1500, 0.014, 1.1], body: [2700, 200, 0.12, 1.25], knock: [215, 85, 0.08, 1.15], thump: [85, 34, 0.2, 1.45], tail: [1000, 170, 0.6, 0.45], echoes: [[0.11, 0.36, 1800], [0.24, 0.26, 1250], [0.45, 0.18, 900], [0.7, 0.11, 700]] } },
  smg45: { fp: 1.05, world: 1.3, maxD: 200, echo: 0.3, duck: 0.09, brass: 1, mech: [4600, 0.014, 0.28, 0.014],
    dsp: { dur: 0.8, drive: 2.2, click: 1.0, crack: [3200, 0.0065, 1.0], body: [5000, 800, 0.034, 1.0], knock: [560, 250, 0.026, 0.8], thump: [180, 85, 0.05, 0.75], tail: [2200, 500, 0.15, 0.24], rattle: [0.008, 3200, 0.007, 0.5], echoes: [[0.06, 0.26, 2800], [0.14, 0.17, 2000]] } },
  dmr: { fp: 0.85, world: 1.15, maxD: 330, echo: 0.65, duck: 0.5, brass: 1, mech: [3000, 0.022, 0.25, 0.04],
    dsp: { dur: 2.2, drive: 3.3, click: 1.0, crack: [1900, 0.015, 1.1], body: [3400, 200, 0.12, 1.2], knock: [230, 90, 0.09, 0.95], thump: [90, 30, 0.22, 1.3], tail: [950, 160, 0.8, 0.5], echoes: [[0.14, 0.42, 1500], [0.3, 0.32, 1050], [0.55, 0.22, 820], [0.9, 0.14, 650]] } },
  sniper50: { fp: 1.0, world: 1.3, maxD: 450, echo: 0.9, duck: 0.95, mech: null,
    dsp: { dur: 3.4, drive: 3.6, click: 1.0, crack: [1500, 0.02, 1.15], body: [3000, 150, 0.2, 1.3], knock: [170, 60, 0.14, 0.95], thump: [70, 22, 0.34, 1.5], tail: [800, 130, 1.3, 0.6], echoes: [[0.18, 0.5, 1300], [0.38, 0.4, 950], [0.65, 0.3, 750], [1.0, 0.2, 600], [1.6, 0.12, 450]] } },
  shotgunauto: { fp: 0.88, world: 1.1, maxD: 280, echo: 0.55, duck: 0.4, brass: 1, mech: [2300, 0.05, 0.4, 0.16],
    dsp: { dur: 1.4, drive: 3.0, click: 1.0, crack: [1600, 0.012, 1.0], body: [3600, 190, 0.09, 1.2], knock: [220, 85, 0.07, 0.9], thump: [105, 36, 0.17, 1.15], tail: [850, 170, 0.45, 0.42], echoes: [[0.09, 0.34, 1600], [0.2, 0.24, 1100]] } },
  pistol45: { fp: 0.88, world: 1.18, maxD: 180, echo: 0.38, duck: 0.15, brass: 1, mech: [4000, 0.02, 0.26, 0.05],
    dsp: { dur: 0.95, drive: 3.0, click: 1.0, crack: [2400, 0.011, 1.0], body: [3500, 360, 0.065, 1.15], knock: [280, 115, 0.065, 1.3], thump: [140, 52, 0.12, 1.2], tail: [1400, 250, 0.32, 0.36], echoes: [[0.06, 0.34, 2200], [0.14, 0.2, 1500], [0.27, 0.12, 1050]] } },
  pistol50: { fp: 0.95, world: 1.3, maxD: 260, echo: 0.6, duck: 0.45, brass: 1, mech: [3800, 0.03, 0.3, 0.06],
    dsp: { dur: 1.5, drive: 3.3, click: 1.0, crack: [1900, 0.013, 1.1], body: [3300, 260, 0.1, 1.3], knock: [220, 85, 0.08, 1.35], thump: [100, 38, 0.2, 1.3], tail: [1100, 200, 0.55, 0.45], echoes: [[0.07, 0.38, 2000], [0.16, 0.26, 1400], [0.3, 0.18, 1000], [0.5, 0.1, 800]] } },
  smg: { fp: 1.1, world: 1.35, maxD: 190, echo: 0.26, duck: 0.08, brass: 1, mech: [5200, 0.012, 0.3, 0.012],
    dsp: { dur: 0.7, drive: 1.9, click: 1.0, crack: [3900, 0.0055, 1.0], body: [6200, 1000, 0.026, 0.85], knock: [720, 320, 0.02, 0.6], thump: [215, 100, 0.04, 0.55], tail: [2600, 600, 0.12, 0.2], rattle: [0.007, 3600, 0.006, 0.55], echoes: [[0.06, 0.24, 3000], [0.13, 0.15, 2200]] } },
  pistol: { fp: 0.85, world: 1.15, maxD: 170, echo: 0.36, duck: 0.14, brass: 1, mech: [4300, 0.02, 0.26, 0.05],
    dsp: { dur: 0.9, drive: 3.0, click: 1.0, crack: [2600, 0.011, 1.0], body: [3800, 380, 0.06, 1.15], knock: [300, 120, 0.06, 1.25], thump: [150, 55, 0.11, 1.15], tail: [1500, 260, 0.3, 0.34], echoes: [[0.06, 0.34, 2300], [0.14, 0.2, 1600], [0.27, 0.12, 1100]] } },
  sniper: { fp: 0.95, world: 1.2, maxD: 380, echo: 0.8, duck: 0.85, mech: null,
    dsp: { dur: 3.0, drive: 3.4, click: 1.0, crack: [1800, 0.017, 1.1], body: [3600, 190, 0.15, 1.2], knock: [210, 80, 0.1, 0.85], thump: [85, 26, 0.28, 1.35], tail: [900, 150, 1.1, 0.55], echoes: [[0.16, 0.45, 1400], [0.34, 0.35, 1000], [0.6, 0.26, 800], [0.95, 0.18, 650], [1.5, 0.1, 500]] } },
  shotgun: { fp: 0.95, world: 1.15, maxD: 300, echo: 0.7, duck: 0.75, shells: true, mech: [2300, 0.05, 0.4, 0.16],
    dsp: { dur: 2.0, drive: 3.1, click: 1.0, crack: [1500, 0.014, 1.0], body: [3800, 170, 0.12, 1.25], knock: [200, 78, 0.09, 0.9], thump: [100, 32, 0.22, 1.2], tail: [800, 160, 0.65, 0.5], echoes: [[0.11, 0.38, 1500], [0.25, 0.28, 1000], [0.5, 0.2, 800]] } },
};
/* Échantillons (paquet armes) : chaque profil a sa banque (g_<bank>_pov pour le joueur, g_<bank>_near pour un tireur à moins de
   GUN_NEAR m) et sa classe pour les tirs lointains (g_far_<cls>) ; un tir silencieux joue g_sup_pistol_pov ou g_sup_rifle_pov,
   g_sup_near, g_sup_far. Profils dérivés (alias) : même synthèse de repli que leur modèle, banque d'échantillons propre. */
const GUN_CLS = { rifle: 'rifle', ak: 'rifle', battle: 'rifle', famas: 'rifle', smg: 'smg', mp7: 'smg', smg45: 'smg', vector: 'smg', dmr: 'sniper', sniper: 'sniper', sniper50: 'sniper',
  shotgun: 'shotgun', shotgunauto: 'shotgun', pistol: 'pistol', glock: 'pistol', pistol45: 'pistol', pistol50: 'pistol' };
for (const [k, base] of [['famas', 'rifle'], ['mp7', 'smg'], ['vector', 'smg45'], ['glock', 'pistol']]) GUNSND[k] = Object.assign({}, GUNSND[base], { alias: base });
for (const k of Object.keys(GUNSND)) { GUNSND[k].bank = k === 'shotgunauto' ? 'aa12' : k; GUNSND[k].cls = GUN_CLS[k] || 'rifle'; }
const GUN_NEAR = 40;
/* Poids des armes lourdes (retour du propriétaire : « les pompes et les fusils de précision manquent de patate, trop timides ») : au banc, le L96
   avait moins de corps et de grave que le M4. En vue subjective et à moins de GUN_NEAR m : drive (montée avant l'écrêtage doux du bus des armes,
   donc plus dense sans dépasser le plafond), low (plateau sous 150 Hz, dB) et sub, coup grave synthétisé sous l'enregistrement [Hz de départ,
   Hz d'arrivée, durée s, gain relatif à la crête de l'enregistrement] ; verb multiplie les envois vers la réverbération et les échos (GUN_VERB),
   roll glisse sous le tir subjectif l'enregistrement lointain de sa classe (g_far_<classe>) [gain, retard s] : le grondement qui roule après
   la détonation (« le sniper, bien résonné et bien puissant », retour du propriétaire en 2.32.4) ; ring, gain du sifflement d'oreille (p_ring,
   le même qu'après une explosion proche) après un tir subjectif, comme la note pure de 3,9 kHz de la synthèse d'avant 2.32.0 (2.32.5). */
const GUN_HEAVY = {
  sniper: { drive: 3.2, low: 3, sub: [75, 30, 0.32, 0.08], verb: 3, roll: [0.6, 0.08], ring: 0.05 },
  sniper50: { drive: 2.4, low: 3, sub: [62, 26, 0.4, 0.08], verb: 3, roll: [0.6, 0.09], ring: 0.06 },
  dmr: { drive: 1.8, low: 2, sub: [85, 34, 0.24, 0.04], verb: 1.8, roll: [0.3, 0.06] },
  shotgun: { drive: 2.5, low: 2, sub: [90, 36, 0.26, 0.06] },
  shotgunauto: { drive: 1.8, low: 2, sub: [95, 40, 0.18, 0.04] },
  pistol50: { drive: 1.6, low: 2, sub: [100, 42, 0.18, 0.04] },
};
for (const [k, h] of Object.entries(GUN_HEAVY)) GUNSND[k].heavy = h;
/* Espace autour des tirs : envois vers la réverbération (vue subjective, monde) et vers les échos de rue (multiplie S.echo). Le navigateur
   normalise la réponse impulsionnelle très bas : à 0,12, la réverbération arrivait 26 dB sous la queue enregistrée du tir, inaudible (retour du
   propriétaire en 2.32.3 : « les armes manquent de réverbération, de présence »). Réverbération et échos reviennent par le bus des armes : l'écrêtage
   doux tient leur somme avec le coup sec, là où le limiteur du mix tassait les rafales. Les envois de la 2.32.3 (1,5, 1,2, 0,3 : queue +4 à +6 dB)
   étaient de trop ; ceux-ci donnent environ la moitié en décibels. Sous un toit, la salle en béton prend le relais avec son propre envoi
   (inside), plus bas : avec les envois du dehors, sa queue passait 10 dB au-dessus de celle de la rue. Les fusils de précision en reçoivent
   davantage (GUN_HEAVY, verb). */
const GUN_VERB = { pov: 0.8, world: 0.7, echo: 0.22, inside: 0.4 };
function dspRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* Ajoute une couche à sa propre crête (g) : les gains des profils sont des niveaux relatifs */
function dspMix(dst, src, g, len) {
  let m = 0; for (let i = 0; i < len; i++) m = Math.max(m, Math.abs(src[i]));
  if (m > 0) { const k = g / m; for (let i = 0; i < len; i++) dst[i] += src[i] * k; }
}
/* Sinusoïde dont la hauteur chute de f0 vers f1 (constante de temps tau * 0,5), enveloppe exponentielle (décroissances
   calculées par multiplication : un tir demande des centaines de milliers d'échantillons) */
function dspSine(sr, n, f0, f1, tau) {
  const len = Math.min(n, Math.ceil(tau * 7 * sr)), o = new Float32Array(len), dEnv = Math.exp(-1 / (tau * sr)), dF = Math.exp(-1 / (tau * 0.5 * sr)), dRise = Math.exp(-1 / (0.0004 * sr));
  let ph = 0, env = 1, q = 1, rise = 1;
  for (let i = 0; i < len; i++) { ph += TAU * (f1 + (f0 - f1) * q) / sr; o[i] = Math.sin(ph) * env * (1 - rise); env *= dEnv; q *= dF; rise *= dRise; }
  return o;
}
/* Bruit passe-bas à fréquence qui chute de f0 vers f1, enveloppe exponentielle ; hp : filtre passe-haut plutôt */
function dspNoise(sr, n, rnd, f0, f1, tau, hp, riseT = 0.0005) {
  const len = Math.min(n, Math.ceil(tau * 7 * sr)), o = new Float32Array(len), dEnv = Math.exp(-1 / (tau * sr)), dF = Math.exp(-1 / (tau * 0.5 * sr)), dRise = Math.exp(-1 / (riseT * sr)), k = TAU / sr;
  let l1 = 0, l2 = 0, env = 1, q = 1, rise = 1;
  for (let i = 0; i < len; i++) {
    const a = 1 - Math.exp(-k * (f1 + (f0 - f1) * q)), x = rnd() * 2 - 1;
    l1 += a * (x - l1); l2 += a * (l1 - l2);
    o[i] = (hp ? x - l2 : l2) * env * (1 - rise); env *= dEnv; q *= dF; rise *= dRise;
  }
  return o;
}
/* Un tir : deux canaux (même attaque, queues et réflexions décorrélées) */
function dspGun(sr, S, seed) {
  const n = Math.ceil(S.dur * sr), rnd = dspRng(seed), dry = new Float32Array(n), mix = (a, g) => dspMix(dry, a, g, a.length);
  dry[0] = S.click; dry[1] = -S.click * 0.6; dry[2] = S.click * 0.3;
  mix(dspNoise(sr, n, rnd, S.crack[0], S.crack[0], S.crack[1], true, 0.0002), S.crack[2]);
  mix(dspNoise(sr, n, rnd, S.body[0], S.body[1], S.body[2], false), S.body[3]);
  mix(dspSine(sr, n, S.knock[0], S.knock[1], S.knock[2]), S.knock[3]);
  mix(dspSine(sr, n, S.thump[0], S.thump[1], S.thump[2]), S.thump[3]);
  // rattle : cliquetis sec de la culasse juste derrière le claquement (le pistolet-mitrailleur « tape », le fusil « tonne »)
  if (S.rattle) { const r = dspNoise(sr, n, rnd, S.rattle[1], S.rattle[1], S.rattle[2], true, 0.0003), o0 = Math.round(S.rattle[0] * sr); let m = 0; for (let i = 0; i < r.length; i++) m = Math.max(m, Math.abs(r[i])); for (let i = 0; i < r.length && o0 + i < n; i++) dry[o0 + i] += r[i] / m * S.rattle[3]; }
  // saturation de la somme sèche : densité et agressivité
  const dr = S.drive, nrm = 1 / Math.tanh(dr);
  for (let i = 0; i < n; i++) dry[i] = Math.tanh(dry[i] * dr * 0.5) * nrm * 1.0;
  const head = Math.min(n, Math.ceil(0.18 * sr)), out = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const o = out[c]; o.set(dry);
    // queue : bruit propre à chaque canal, qui s'installe sous le coup puis s'éteint
    const tl = dspNoise(sr, n, rnd, S.tail[0], S.tail[1], S.tail[2], false, 0.012); dspMix(o, tl, S.tail[3], tl.length);
    // réflexions : le début du tir, filtré et en retard, plus fort d'un côté que de l'autre
    S.echoes.forEach(([dl, g, lp], k) => {
      const d0 = Math.round((dl + (c ? 0.003 : -0.002)) * sr), a = 1 - Math.exp(-TAU * lp / sr), pan = g * (1 + (c ? 1 : -1) * (k % 2 ? 0.4 : -0.4)); let l1 = 0, l2 = 0;
      for (let i = 0; i < head && d0 + i < n; i++) { l1 += a * (dry[i] - l1); l2 += a * (l1 - l2); o[d0 + i] += l2 * pan; }
    });
  }
  // normalisation commune aux deux canaux, fondu final
  let pk = 0; for (const o of out) for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(o[i]));
  const k = 0.97 / pk, fade = Math.floor(0.03 * sr);
  for (const o of out) for (let i = 0; i < n; i++) o[i] *= k * (i > n - fade ? (n - i) / fade : 1);
  return out;
}
/* Version silencieuse d'un profil (« rifle_s » pour « rifle ») : claquement et souffle amortis, queue courte, peu d'échos, portée
   réduite ; le cliquetis du mécanisme, lui, reste. Créée au premier besoin (gunSndOf), calculée à la demande (gunSoundPrepare). */
function gunProfileSuppressed(P) {
  const D = P.dsp;
  return Object.assign({}, P, { fp: P.fp * 0.7, world: P.world * 0.5, maxD: Math.round(P.maxD * 0.33), echo: P.echo * 0.2, duck: Math.min(P.duck, 0.04),
    dsp: Object.assign({}, D, { dur: Math.min(D.dur, 0.8), drive: 1.5, click: 0.45, crack: [D.crack[0] * 0.4, D.crack[1], 0.22], body: [D.body[0] * 0.3, D.body[1] * 0.5, D.body[2] * 0.7, D.body[3] * 0.5],
      knock: [D.knock[0], D.knock[1], D.knock[2], D.knock[3] * 0.7], thump: [D.thump[0], D.thump[1], D.thump[2] * 0.6, D.thump[3] * 0.45], tail: [D.tail[0] * 0.35, D.tail[1] * 0.5, D.tail[2] * 0.3, D.tail[3] * 0.35],
      rattle: D.rattle ? [D.rattle[0], D.rattle[1], D.rattle[2], D.rattle[3] * 0.8] : [0.006, 2600, 0.01, 0.35], echoes: D.echoes.slice(0, 2).map(([d, g, lp]) => [d, g * 0.3, lp * 0.6]) }) });
}
function gunSndOf(kind) {
  if (GUNSND[kind]) return GUNSND[kind];
  const base = kind.endsWith('_s') && GUNSND[kind.slice(0, -2)];
  return base ? (GUNSND[kind] = Object.assign(gunProfileSuppressed(base), { sup: true })) : null;
}
/* Prépare le son synthétisé d'un profil (repli : les versions silencieuses ne sont pas calculées au démarrage) */
function gunSoundPrepare(kind) {
  if (!gunSndOf(kind) || !AU.ctx || sfxHas('g_rifle_pov')) return;
  const k = gunDspKind(kind), B = AU.gunBufs && AU.gunBufs[k]; if (B && B.filter(Boolean).length >= 3) return;
  gunBuffersBuild(false, [k]);
}
/* Profil dont la synthèse sert à kind (un alias emprunte celle de son modèle, silencieux compris) */
function gunDspKind(kind) {
  const sup = kind.endsWith('_s'), b = sup ? kind.slice(0, -2) : kind, P = GUNSND[b];
  const k = P && P.alias ? P.alias : b;
  if (sup) gunSndOf(k + '_s');
  return sup ? k + '_s' : k;
}
/* Calcul des tirs : par petits morceaux (un tir à la fois, entre deux images) sauf demande contraire */
function gunBuffersBuild(all, kinds) {
  if (!AU.ctx) return;
  const jobs = []; for (const k of kinds || Object.keys(GUNSND).filter((k) => !GUNSND[k].alias && !k.endsWith('_s'))) for (let v = 0; v < 3; v++) jobs.push([k, v]);
  AU.gunBufs = AU.gunBufs || {};
  const one = () => {
    const j = jobs.shift(); if (!j || !AU.ctx) return false;
    const [k, v] = j, B = AU.gunBufs[k] || (AU.gunBufs[k] = []);
    if (!B[v]) {
      const sr = AU.ctx.sampleRate, ch = dspGun(sr, GUNSND[k].dsp, 7919 * (v + 1) + k.length * 131), buf = AU.ctx.createBuffer(2, ch[0].length, sr);
      buf.copyToChannel(ch[0], 0); buf.copyToChannel(ch[1], 1); B[v] = buf;
    }
    return true;
  };
  if (all) { while (one()); return; }
  const step = () => { if (one()) setTimeout(step, 0); };
  setTimeout(step, 0);
}
/* Assourdit le mix un instant (sniper, pompe : filtre et baisse) ; les autres armes ne font que dégager le mix du bruit de fond */
function duckMix(t, S) {
  const f = AU.duck.frequency, gg = AU.duckG.gain;
  if (S.duck >= 0.4) {
    f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(lerp(20000, 700, S.duck), t + 0.04); f.exponentialRampToValueAtTime(20000, t + 0.4 + S.duck * 0.7);
    gg.cancelScheduledValues(t); gg.setValueAtTime(gg.value, t); gg.linearRampToValueAtTime(1 - S.duck * 0.55, t + 0.04); gg.linearRampToValueAtTime(1, t + 0.4 + S.duck * 0.6);
  } else {
    gg.cancelScheduledValues(t); gg.setValueAtTime(gg.value, t); gg.linearRampToValueAtTime(1 - S.duck, t + 0.006); gg.linearRampToValueAtTime(1, t + 0.16);
  }
}
/* Un coup de feu. pos : bouche du canon (null : le joueur, vue subjective) ; who : le tireur (le coup suivant d'un même tireur
   étouffe la queue du précédent : on n'entend la queue entière qu'au dernier coup d'une rafale, et le mix ne s'empâte pas). */
const GUN_VOICE = new WeakMap(), GUN_ME = {};
function sfxGun(kind, pos, who) {
  if (!AU.ready) return;
  const S = gunSndOf(kind) || GUNSND.rifle, d = pos ? pos.distanceTo(camera.position) : 0;
  if (d > S.maxD) return;
  const id = S.sup ? (pos ? (d < GUN_NEAR ? 'g_sup_near' : 'g_sup_far') : (S.cls === 'pistol' || S.cls === 'smg' ? 'g_sup_pistol_pov' : 'g_sup_rifle_pov'))
    : pos ? (d < GUN_NEAR ? 'g_' + S.bank + '_near' : 'g_far_' + S.cls) : 'g_' + S.bank + '_pov';
  if (!sfxHas(id)) return sfxGunSynth(kind, pos, d);
  if (!auAfford(pos ? 5 : 7, pos ? d : 0)) return;
  const ctx = AU.ctx, t = ctx.currentTime + (pos ? Math.min(d / 343, 0.5) : 0), far = clamp(d / 80, 0, 1);
  // à l'intérieur (peu de ciel au-dessus du joueur) : la queue extérieure enregistrée s'éteint plus tôt et la salle prend le relais
  const inside = 1 - clamp(VM.sky === undefined ? 1 : VM.sky, 0, 1);
  const H = (!pos || d < GUN_NEAR) && !S.sup ? S.heavy : null; // poids des armes lourdes (GUN_HEAVY)
  const g0 = ctx.createGain(); g0.gain.value = (pos ? S.world * (d < GUN_NEAR ? GUN_SMP.near : GUN_SMP.far) : S.fp * GUN_SMP.pov) * (S.smp || 1) * (GUN_CLS_GAIN[S.cls] || 1) * (H ? H.drive : 1) * rand(0.93, 1.0);
  const v = sfxPlay(id, g0, t, { rate: rand(0.97, 1.03) * (S.rate || 1) }); if (!v) return;
  let out = g0;
  if (H) {
    out = ctx.createBiquadFilter(); out.type = 'lowshelf'; out.frequency.value = 150; out.gain.value = H.low; g0.connect(out);
    const [f0, f1, du, gs] = H.sub; tn(g0, t, du, f0 * rand(0.95, 1.05), f1, 'sine', gs, 0.003);
  }
  const vk = H && H.verb || 1;
  if (H && H.roll && !pos && sfxHas('g_far_' + S.cls)) sfxPlay('g_far_' + S.cls, g0, t + H.roll[1], { gain: H.roll[0], rate: rand(0.97, 1.03) });
  if (pos) out.connect(auOut(pos, lerp(GUN_VERB.world, GUN_VERB.inside, inside) * vk, 1, 0.8, 5, AU.wpn));
  else { out.connect(AU.fpBus); const vb = ctx.createGain(); vb.gain.value = lerp(GUN_VERB.pov, GUN_VERB.inside, inside) * vk; g0.connect(vb); vb.connect(AU.verb); }
  const e = ctx.createGain(); e.gain.value = S.echo * GUN_VERB.echo * vk * (pos ? 0.5 + far * 0.8 : 1) * (1 - inside * 0.7); g0.connect(e); e.connect(AU.echo);
  if (inside > 0.35) { v.g.gain.setValueAtTime(1, t + 0.16); v.g.gain.setTargetAtTime(0, t + 0.16, 0.06 + 0.2 * (1 - inside)); }
  // étouffe le coup précédent du même tireur
  const key = who || (pos ? null : GUN_ME);
  if (key) { const prev = GUN_VOICE.get(key); if (prev) sfxFadeOut(prev, t + 0.025, 0.04); GUN_VOICE.set(key, v); }
  if (!pos) {
    // fusils de précision : l'oreille siffle (un seul sifflement à la fois)
    if (H && H.ring && sfxHas('p_ring')) { sfxFadeOut(AU.ringV, t + 0.02, 0.12); AU.ringV = sfxPlay('p_ring', uiOut(H.ring), t + 0.06, { rate: rand(0.98, 1.02) }); }
    // vue subjective : douilles qui retombent (une fois sur deux en rafale), étuis du fusil à pompe, mix dégagé
    const sf = PL.ent && CURMAP.def ? surfaceAt(PL.ent.pos) : 'concrete', soft = sf === 'dirt' || sf === 'grass' || sf === 'snow'; // sans carte (menus, banc audio) : sol dur
    if (S.brass && sf !== 'water' && (AU.brassN = (AU.brassN || 0) + 1) % 2) sfxPlay(soft ? 'f_brass_soft' : 'f_brass', uiOut(soft ? 0.1 : 0.07), t + rand(0.3, 0.45), { rate: rand(0.9, 1.1) });
    if (S.shells) sfxPlay('f_shells', uiOut(0.12), t + 0.5 + rand(0, 0.08), { rate: rand(0.95, 1.05) });
    duckMix(t, S);
  }
}
/* Dosage des échantillons de tir (banc audio, README « Son et ressenti des armes ») : les enregistrements ont des crêtes bien plus
   marquées que la synthèse (17 dB entre crête et niveau efficace au lieu de 7) ; on les monte de 10 dB en vue subjective (6 dB
   sous la synthèse, le limiteur du mix n'écrase que le haut des crêtes) et de 15 dB dans le monde (même écart qu'avant entre son
   tir et celui d'un ennemi à 30 m). GUN_CLS_GAIN rétablit l'équilibre des classes : pistolet au niveau du fusil, pistolet-mitrailleur
   5 dB dessous (cadence), précision et pompe un peu au-dessus. S.smp affine un profil. */
const GUN_SMP = { pov: 3.16, near: 5.9, far: 5.9 };
const GUN_CLS_GAIN = { rifle: 1.0, pistol: 0.88, smg: 0.42, sniper: 0.89, shotgun: 0.84 };
/* Repli synthétisé (paquet des armes absent ou pas encore décodé) */
function sfxGunSynth(kind, pos, d) {
  const S = gunSndOf(kind) || GUNSND.rifle, dk = gunDspKind(kind), B = AU.gunBufs && AU.gunBufs[gunSndOf(dk) ? dk : 'rifle'];
  if (!B || !B.some(Boolean)) {
    // paquet encore en décodage : seul ce profil est calculé ; paquet absent : tous (comme avant les échantillons)
    const st = SFX.state.get('armes');
    if ((st && st.s === 'loading') || (!st && SFX_PACKS.armes)) { if (!(AU.gunBufs && AU.gunBufs[dk])) gunBuffersBuild(false, [dk]); sfxBootGame(); } // pas encore chargé : ce profil seulement
    else if (!Object.keys(AU.gunBufs || {}).length) gunBuffersBuild(false); else gunSoundPrepare(kind);
    return;
  }
  const ctx = AU.ctx;
  if (!auAfford(pos ? 8 : 14, pos ? d : 0)) return;
  let v = Math.floor(Math.random() * 3); if (v === S.last) v = (v + 1) % 3; S.last = v;
  if (!B[v]) v = B.findIndex(Boolean); if (v < 0) return;
  // le son voyage : léger retard selon la distance
  const t = ctx.currentTime + (pos ? Math.min(d / 343, 0.5) : 0), far = clamp(d / 80, 0, 1);
  // à l'intérieur (peu de ciel au-dessus du joueur), les réflexions sont plus proches et plus fortes
  const inside = 1 - clamp(VM.sky === undefined ? 1 : VM.sky, 0, 1);
  const src = ctx.createBufferSource(); src.buffer = B[v]; src.playbackRate.value = rand(0.97, 1.03);
  const g0 = ctx.createGain(); g0.gain.value = (pos ? S.world : S.fp) * rand(0.93, 1.0);
  src.connect(g0);
  if (pos) g0.connect(auOut(pos, 0.2 + inside * 0.12, 1, 0.8, 5, AU.wpn));
  else { g0.connect(AU.fpBus); const vb = ctx.createGain(); vb.gain.value = 0.26 + inside * 0.2; g0.connect(vb); vb.connect(AU.verb); }
  const e = ctx.createGain(); e.gain.value = S.echo * (pos ? 0.6 + far * 0.8 : 1) * (1 - inside * 0.4); g0.connect(e); e.connect(AU.echo);
  src.start(t);
  if (!pos) {
    // vue subjective : chargeur et mécanisme, douilles qui rebondissent, sifflement dans l'oreille du sniper
    const o = ctx.createGain(); o.gain.value = 0.5; o.connect(AU.gunBus);
    if (S.mech) { clack(o, t + S.mech[3], S.mech[0] * 0.55, S.mech[2] * 1.1, S.mech[1] * 2); }
    // douilles qui retombent : petits chocs sourds, jamais de tintement
    if (S.brass) { const b0 = 0.22 + Math.random() * 0.12; for (let k = 0; k < 2; k++) clack(o, t + b0 + k * 0.08 * (1 + k * 0.5), rand(1000, 1400), 0.12 / (1 + k), 0.04); }
    if (S.shells) for (let k = 0; k < 3; k++) clack(o, t + 0.55 + k * 0.09 + Math.random() * 0.04, rand(1000, 1400), 0.16, 0.05);
    duckMix(t, S);
  }
}
function sfxClick(pos, freq = 3000, gain = 0.25, delay = 0) {
  if (!AU.ready) return; const t = AU.ctx.currentTime + delay; const o = auOut(pos, 0.05, 1);
  if (sfxHas('ui_tick')) { sfxPlay('ui_tick', o, t, { gain: gain * 1.6, rate: rand(0.85, 0.95) }); return; }
  freq = Math.min(freq, 900); // tic sourd, jamais aigu
  nz(o, t, 0.025, 'bandpass', freq, freq * 0.8, 2, gain); tn(o, t, 0.03, freq * 0.4, freq * 0.3, 'sine', gain * 0.3);
}
/* Sons des menus (paquet ui). Un seul son de clic, toujours le même (retour du propriétaire : « ils sont tous différents, garde un seul son pour
   le clic ») : tout geste (clic, onglet, retour, panneau, atelier, déploiement) joue la première prise de ui_click, sans variante ni écart de hauteur.
   Restent à part ce qui n'est pas un clic : cran d'un réglage qu'on glisse (tick), déplacement du focus à la manette (hover) et les retours qui
   arrivent après coup (validation, notification, erreur, déblocage). Un même geste déclenche parfois deux appels (le clic global sur les boutons et
   celui du bouton lui-même) : les appels d'un même instant sont regroupés, seul le plus important joue. [priorité, banque, gain] */
const UI_SND = { hover: [0, 'ui_hover', 0.3], tick: [1, 'ui_tick', 0.45], click: [2, 'ui_click', 0.55],
  confirm: [7, 'ui_confirm', 0.65], notify: [7, 'ui_notify', 0.55], error: [7, 'ui_error', 0.55], unlock: [8, 'ui_unlock', 0.75] };
for (const k of ['tab', 'open', 'close', 'back', 'equip', 'unequip', 'camo', 'locked', 'go']) UI_SND[k] = UI_SND.click;
function sfxUi(kind) {
  if (!AU.ready || !UI_SND[kind]) return;
  if (AU.uiQ) { if (UI_SND[kind][0] > UI_SND[AU.uiQ][0]) AU.uiQ = kind; return; }
  AU.uiQ = kind;
  setTimeout(() => { const k = AU.uiQ; AU.uiQ = null; if (AU.ready) sfxUiPlay(k); }, 0);
}
function sfxUiPlay(kind) {
  const t = AU.ctx.currentTime, [, id, g] = UI_SND[kind];
  if (kind === 'hover' || kind === 'tick') { if (t - (AU.hoverT || 0) < (kind === 'tick' ? 0.06 : 0.045)) return; AU.hoverT = t; } // survols et crans rapprochés
  if (sfxHas(id)) { sfxPlay(id, uiOut(g), t, id === 'ui_click' ? { e: SFX.bank.get(id)[0] } : { rate: rand(0.98, 1.02) }); return; }
  // repli synthétisé
  const o = auOut(null, 0, 0.7), k = { tick: 'hover', tab: 'click', open: 'click', close: 'back', equip: 'click', unequip: 'back', camo: 'click', locked: 'back', confirm: 'click', notify: 'click', error: 'back', unlock: 'go' }[kind] || kind;
  if (k === 'hover') tn(o, t, 0.03, 1900, 1500, 'square', 0.025);
  else if (k === 'click') { tn(o, t, 0.05, 700, 380, 'square', 0.07); nz(o, t, 0.03, 'bandpass', 2600, 1800, 2, 0.05); }
  else if (k === 'back') tn(o, t, 0.05, 420, 260, 'square', 0.06);
  else if (k === 'go') { tn(o, t, 0.16, 180, 70, 'sawtooth', 0.12); nz(o, t, 0.06, 'bandpass', 900, 500, 1.5, 0.12); tn(o, t + 0.07, 0.08, 520, 520, 'square', 0.05); }
}
/* Relevé du sonar de l'UAV de son équipe (uavPulse) : un « ping » discret et son écho, synthétisés */
function sfxPing() {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = uiOut(0.5);
  tn(o, t, 0.32, 1320, 1250, 'sine', 0.05, 0.004); tn(o, t + 0.16, 0.4, 1320, 1240, 'sine', 0.018, 0.01);
}
/* IEM (iemFire) : claquement électrique et grésillement qui retombe, synthétisés ; k : 1 pour l'équipe brouillée, moins fort pour celle qui l'a lancée */
function sfxIem(k = 1) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = uiOut(0.8 * k);
  tn(o, t, 0.9, 140, 38, 'sine', 0.4, 0.004); nz(o, t, 0.25, 'bandpass', 2400, 900, 1.2, 0.35);
  for (let i = 0; i < 6; i++) nz(o, t + 0.12 + i * 0.13, 0.08, 'bandpass', 3600 - i * 300, 2000, 3, 0.12 * (1 - i / 7));
  tn(o, t + 0.05, 1.4, 900, 60, 'sawtooth', 0.05, 0.01);
}
/* Drone kamikaze (08e-fpv.js) : bruit de ses quatre hélices, une boucle enregistrée (k_fpv, paquet series : vol de mouches, moteur électrique et
   battement de pales, tools/sfx/series.py) dont la hauteur suit la vitesse. Le pilote (la caméra est dans le drone) l'entend au centre, un
   peu moins fort ; les autres là où est le drone, de loin (retour du propriétaire : le drone ne faisait pas de bruit, la synthèse d'avant, à
   0,12 pour le pilote, se perdait sous l'ambiance). Sans le paquet, la synthèse d'avant : deux dents de scie désaccordées et une octave carrée. */
const FPV_SND = { pilot: 0.75, other: 1.8, ref: 4, roll: 1.1, max: 240, air: 140 };
function fpvSoundStart(d) {
  if (!AU.ready) return null;
  const pilot = d.owner === PL.ent && d.local;
  const E = sfxEmitter('k_fpv', d.pos, { loop: true, off: rand(0, 2), gain: pilot ? FPV_SND.pilot : FPV_SND.other, ref: FPV_SND.ref, roll: FPV_SND.roll, max: FPV_SND.max, air: pilot ? 0 : FPV_SND.air, verb: pilot ? 0 : 0.12, fade: 0.12 });
  if (E) return Object.assign(E, { smp: true });
  const ctx = AU.ctx, t = ctx.currentTime;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 1.5;
  const out = ctx.createGain(); out.gain.value = 0.0001; out.gain.setTargetAtTime(pilot ? 0.12 : 0.7, t, 0.15);
  let last = lp, pan = null;
  if (!pilot) { pan = ctx.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 5; pan.rolloffFactor = 1.3; pan.maxDistance = 220; lp.connect(pan); last = pan; }
  last.connect(out); out.connect(AU.bus);
  const mk = (type, f, g) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const k = ctx.createGain(); k.gain.value = g; o.connect(k); k.connect(lp); o.start(t); return o; };
  const o1 = mk('sawtooth', 180, 0.22), o2 = mk('sawtooth', 186.5, 0.18), o3 = mk('square', 361, 0.05);
  return { ctx, out, lp, pan, srcs: [o1, o2, o3], o1, o2, o3 };
}
function fpvSoundUpdate(S, d) {
  if (!S) return;
  if (S.smp) { sfxEmitterMove(S, d.pos); S.v.s.playbackRate.setTargetAtTime(0.85 + clamp(d.vel.length() / 30, 0, 1) * 0.5, AU.ctx.currentTime, 0.1); return; } // les moteurs montent avec la vitesse
  const t = S.ctx.currentTime, f = 170 + clamp(d.vel.length(), 0, 30) * 6;
  S.o1.frequency.setTargetAtTime(f, t, 0.08); S.o2.frequency.setTargetAtTime(f * 1.036, t, 0.08); S.o3.frequency.setTargetAtTime(f * 2.01, t, 0.08);
  if (S.pan) { const p = d.pos; if (S.pan.positionX) { S.pan.positionX.value = p.x; S.pan.positionY.value = p.y; S.pan.positionZ.value = p.z; } else S.pan.setPosition(p.x, p.y, p.z); }
}
function fpvSoundStop(S) {
  if (!S) return;
  if (S.smp) { sfxEmitterStop(S, 0.06); return; }
  const t = S.ctx.currentTime; S.out.gain.cancelScheduledValues(t); S.out.gain.setTargetAtTime(0.0001, t, 0.06);
  setTimeout(() => { for (const x of S.srcs) { try { x.stop(); } catch (e) { /* déjà arrêtée */ } } for (const x of [S.out, S.pan, S.lp]) if (x) x.disconnect(); }, 600);
}
/* Mecha (08f-mecha.js), paquet mecha (tools/sfx/mecha.py, enregistrements réels) ; tant qu'il manque, la synthèse d'origine.
   Pied posé : coup sourd du piétinement, plaque de métal et souffle de vérin, parfois un claquement de la jambe, et un sub-grave dans la
   poitrine de près. */
function sfxMechaStep(pos, k = 1) {
  if (!AU.ready) return;
  const d = pos.distanceTo(camera.position), near = clamp(1 - d / 30, 0, 1);
  if (sfxHas('m_step')) {
    sfxAt('m_step', pos, 2.1 * k, { ref: 12, roll: 0.85, verb: 0.3, rate: rand(0.94, 1.03) });
    if (Math.random() < 0.35) sfxAt('m_clank', pos, 0.3, { ref: 6, rate: rand(0.9, 1.1), delay: 0.04 });
    if (near > 0) tn(auOut(pos, 0, 1, 1, 10), AU.ctx.currentTime, 0.5, 58, 26, 'sine', 0.5 * near * k, 0.005); // le sub dans la poitrine, de près
    return;
  }
  const t = AU.ctx.currentTime, o = auOut(pos, 0.25, 1.4, 1.0, 8);
  tn(o, t, 0.35, 90, 38, 'sine', 0.55, 0.004); nz(o, t, 0.18, 'lowpass', 420, 160, 1, 0.4);
  nz(o, t + 0.02, 0.06, 'bandpass', 2400, 1600, 3, 0.12); nz(o, t + 0.06, 0.25, 'highpass', 3800, 2600, 0.7, 0.05, 0.03);
}
/* Vérin d'une articulation (jambe qui se lève, torse qui pivote) ; k : force, rate : hauteur */
function sfxMechaServo(pos, k = 1, rate = 1) { if (AU.ready) sfxAt('m_servo', pos, 0.55 * k, { ref: 5, roll: 1.1, rate: rate * rand(0.92, 1.08) }); }
/* Détente d'air comprimé (arrêt, extinction) */
function sfxMechaHiss(pos, k = 1) { if (AU.ready) sfxAt('m_hiss', pos, 0.5 * k, { ref: 5, rate: rand(0.9, 1.05) }); }
/* Grincement de la structure, de temps en temps pendant la marche */
function sfxMechaCreak(pos) { if (AU.ready) sfxAt('m_creak', pos, 0.3, { ref: 5, roll: 1.2, rate: rand(0.85, 1.05) }); }
/* Groupe moteur : boucle qui suit le mecha (sfxEmitterMove), null si le paquet n'est pas prêt */
function sfxMechaHum(pos) { return AU.ready ? sfxEmitter('m_hum', pos, { loop: true, off: rand(0, 6), gain: 0.45, ref: 5, roll: 1.3, max: 120, air: 60, verb: 0.1, fade: 0.8 }) : null; }
/* Chute du mecha : grondement d'air déchiré et de feu qui enfle et finit à l'impact, et le sifflement d'une bombe qui tombe (paquet
   series) ; entendus du point de chute. Sans le paquet : grondement synthétisé. */
const MECHA_SND = { peak: 2.8 }; // m_fall : instant de son plus fort grondement (tools/sfx/mecha.py, FALL_PEAK) ; tenu ensuite jusqu'à 4 s
function sfxMechaFall(pos, dur) {
  if (!AU.ready) return null;
  if (sfxHas('m_fall')) {
    // le plus fort tombe à l'impact prévu ; le grondement tenu couvre une chute affichée en retard (images lentes), il est coupé à l'impact réel
    // (mechaImpact) ; le sifflement de la bombe finit à l'impact prévu
    const e = sfxPick('m_fall'), P = MECHA_SND.peak, b = sfxPick('k_bomb');
    const v = sfxAt('m_fall', pos, 2.4, { e, off: Math.max(0, P - dur), delay: Math.max(0, dur - P), prop: false, ref: 30, roll: 0.6, verb: 0.25, rate: 1 });
    if (b) sfxAt('k_bomb', pos, 1.3, { e: b, off: Math.max(0, b.d - dur), delay: Math.max(0, dur - b.d), prop: false, verb: 0.15, ref: 12, roll: 0.8, rate: 1 });
    return v;
  }
  const t = AU.ctx.currentTime, o = auOut(pos, 0.35, 1.6, 0.7, 20);
  nz(o, t, dur, 'bandpass', 160, 900, 0.9, 0.7, dur * 0.95); nz(o, t, dur, 'lowpass', 120, 420, 0.7, 0.9, dur * 0.9);
  for (let i = 0; i < 10; i++) nz(o, t + dur * (0.4 + i * 0.055), 0.08, 'bandpass', rand(1200, 2600), 900, 1.4, 0.06 + i * 0.012);
  return null;
}
/* Impact au sol (l'explosion est jouée à part) puis, une demi-seconde après, le redressement sur ses vérins */
function sfxMechaLand(pos) {
  if (!AU.ready) return;
  sfxAt('m_land', pos, 2.2, { ref: 14, roll: 0.7, verb: 0.3, rate: 1, prop: false }); // (sans retard de propagation : en même temps que l'image)
  sfxAt('m_rise', pos, 1.1, { ref: 7, delay: 0.55, rate: 1 });
}
/* Maniement de l'arme du joueur (paquet foley) ; pos : un bruit de maniement dans le monde (lancer, rechargement d'un autre soldat,
   fam : famille de son arme). La banque dépend de la famille de l'arme (chargeur de fusil, de pistolet-mitrailleur ou de pistolet ;
   levier d'armement ou culasse de pistolet). */
const MECH_GAIN = { magout: 0.55, magin: 0.6, charge: 0.6, bolt: 0.62, pump: 0.66, shell: 0.5, empty: 0.5, slap: 0.42, draw: 0.42, stow: 0.38, ads: 0.24,
  knife: 0.5, pin: 0.5, spoon: 0.42, throw: 0.45, windup: 0.32, pickup: 0.5, magdrop: 0.35 };
function mechId(kind, fam) {
  if (!fam) { fam = 'rifle'; try { const w = PL.ent && PL.ent.arms ? armsW(PL.ent) : null; if (w && w.def) fam = w.def.fam; } catch (e) { /* pas encore d'arme */ } }
  const f3 = fam === 'pistol' ? 'pistol' : fam === 'smg' ? 'smg' : 'rifle';
  switch (kind) {
    case 'magout': case 'magin': return 'f_' + kind + '_' + f3;
    case 'charge': return fam === 'pistol' ? 'f_slide_pistol' : 'f_charge_rifle';
    case 'empty': return 'f_dry';
    case 'bolt': case 'pump': case 'shell': case 'slap': case 'draw': case 'stow': case 'ads': case 'knife': case 'pin': case 'spoon': case 'throw': case 'windup': case 'pickup': case 'magdrop': return 'f_' + kind;
  }
  return null;
}
function sfxMech(kind, delay = 0, pos = null, fam = null) {
  if (!AU.ready) return; const t = AU.ctx.currentTime + delay;
  const id = mechId(kind, fam);
  if (id && sfxHas(id)) {
    let rate = rand(0.96, 1.04);
    if (!pos && (kind === 'draw' || kind === 'stow')) { try { if (armsW(PL.ent).def.fam === 'pistol') rate *= 1.08; } catch (e) { /* idem */ } }
    sfxPlay(id, pos ? auOut(pos, 0.1, 1, 1.1, 3) : auOut(null, 0.05, 1), t, { gain: MECH_GAIN[kind] || 0.5, rate });
    return;
  }
  const o = pos ? auOut(pos, 0.08, 0.6) : auOut(null, 0.08, 0.35);
  if (kind === 'magout') { clack(o, t, 1700, 0.5, 0.05, 150); nz(o, t + 0.05, 0.12, 'lowpass', 600, 300, 1, 0.25); }
  else if (kind === 'magin' || kind === 'pickup') { tn(o, t, 0.08, 190, 70, 'sine', 0.55, 0.001); clack(o, t + 0.012, 2100, 0.6, 0.07, 120); nz(o, t + 0.06, 0.04, 'lowpass', 700, 300, 1, 0.3); }
  else if (kind === 'bolt') { clack(o, t, 2200, 0.45, 0.05, 140); nz(o, t + 0.12, 0.08, 'lowpass', 500, 900, 1, 0.3); clack(o, t + 0.22, 2800, 0.6, 0.06, 170); }
  else if (kind === 'charge') { clack(o, t, 1900, 0.5, 0.05, 130); clack(o, t + 0.1, 2800, 0.65, 0.06, 160); }
  else if (kind === 'shell') { clack(o, t, 1500, 0.4, 0.05, 110); tn(o, t + 0.04, 0.05, 300, 180, 'sine', 0.1); }
  else if (kind === 'pump') { clack(o, t, 1200, 0.55, 0.06, 120); clack(o, t + 0.12, 1700, 0.75, 0.07, 150); }
  else if (kind === 'slap') { nz(o, t, 0.05, 'lowpass', 1400, 400, 1, 0.7); tn(o, t, 0.1, 180, 80, 'sine', 0.5, 0.001); }
  else if (kind === 'stow') { nz(o, t, 0.16, 'lowpass', 500, 900, 1, 0.2, 0.03); clack(o, t + 0.12, 1500, 0.35, 0.05, 110); }
  else if (kind === 'draw') { nz(o, t, 0.12, 'lowpass', 900, 500, 1, 0.2, 0.02); clack(o, t + 0.1, 1700, 0.35, 0.05, 120); }
  else if (kind === 'ads') { nz(o, t, 0.08, 'bandpass', 900, 700, 1, 0.1); }
  else if (kind === 'knife') { nz(o, t, 0.16, 'bandpass', 500, 1700, 1.2, 0.4); }
  else if (kind === 'pin') { clack(o, t, 1200, 0.35, 0.04, 100); }
  else if (kind === 'throw') { nz(o, t, 0.26, 'bandpass', 380, 2600, 1.4, 0.45, 0.05); nz(o, t, 0.1, 'lowpass', 700, 180, 1, 0.22); }
  else if (kind === 'windup') { nz(o, t, 0.14, 'bandpass', 420, 900, 1, 0.16, 0.03); nz(o, t + 0.03, 0.09, 'bandpass', 1300, 800, 2, 0.08); }
  else if (kind === 'spoon') { clack(o, t, 1700, 0.4, 0.07, 120); tn(o, t + 0.01, 0.1, 500, 400, 'sine', 0.08); }
  else if (kind === 'empty') { clack(o, t, 2900, 0.6, 0.035, 90); }
}
function sfxStep(pos, gain = 0.3, surface = 'concrete') {
  if (!AU.ready) return; if (pos && pos.distanceTo(camera.position) > 28) return;
  if (!auAfford(pos ? 4 : 3, pos ? pos.distanceTo(camera.position) : 0)) return;
  const t = AU.ctx.currentTime, o = auOut(pos, 0.03, pos ? 1.3 : 1), id = 's_' + (STEP_SURF[surface] || 'concrete');
  if (sfxHas(id)) {
    // un pas enregistré par surface ; en course, le joueur entend aussi son équipement (sangles, chargeurs)
    sfxPlay(id, o, t, { gain: gain * STEP_K, rate: rand(0.94, 1.06) });
    if (!pos && PL.sprinting) sfxPlay('s_gear', o, t + 0.015, { gain: gain * STEP_K * 0.55, rate: rand(0.94, 1.06) });
    return;
  }
  if (surface === 'snow') {
    // neige : pas étouffé puis crissement des grains qui se tassent
    nz(o, t, 0.13, 'lowpass', 650 * rand(0.85, 1.15), 260, 1, gain * 0.85);
    for (let i = 0; i < 5; i++) nz(o, t + 0.012 + i * 0.019 + rand(0, 0.008), 0.018, 'bandpass', rand(1100, 2200), 1500, 2, gain * rand(0.2, 0.35));
    return;
  }
  if (surface === 'water') {
    // pas dans l'eau : claque de la plante du pied, gargouillis grave, quelques gouttes qui retombent
    nz(o, t, 0.14, 'bandpass', 1250 * rand(0.85, 1.15), 800, 1.1, gain * 1.5);
    nz(o, t + 0.015, 0.24, 'lowpass', 640 * rand(0.9, 1.1), 240, 1, gain * 0.9);
    for (let i = 0; i < 3; i++) nz(o, t + 0.05 + rand(0, 0.16), 0.03, 'bandpass', rand(2400, 4200), 2800, 2, gain * rand(0.1, 0.22));
    return;
  }
  if (surface === 'grass') {
    // pelouse : pas étouffé et froissement bref de brins
    nz(o, t, 0.1, 'lowpass', 420 * rand(0.85, 1.15), 200, 1, gain * 0.7);
    nz(o, t + 0.01, 0.07, 'bandpass', rand(2600, 3800), 1800, 1.2, gain * 0.16);
    return;
  }
  if (surface === 'gravel') {
    // gravier : le pas, puis une grêle de petits cailloux qui roulent
    nz(o, t, 0.08, 'lowpass', 700 * rand(0.85, 1.15), 300, 1, gain * 0.8);
    for (let i = 0; i < 6; i++) nz(o, t + 0.006 + i * 0.012 + rand(0, 0.006), 0.012, 'bandpass', rand(1800, 3600), 2200, 2, gain * rand(0.14, 0.26));
    return;
  }
  const f = surface === 'metal' ? 1400 : surface === 'dirt' ? 500 : 800;
  nz(o, t, 0.09, 'lowpass', f * rand(0.8, 1.2), f * 0.5, 1, gain);
  nz(o, t + 0.015, 0.05, 'bandpass', 1500, 1100, 1, gain * 0.25);
}
/* Surfaces des pas (surfaceAt, MAP_DEFS.<id>.surface) → banque s_<surface> ; dosage des pas enregistrés */
const STEP_SURF = { concrete: 'concrete', gravel: 'gravel', grass: 'grass', dirt: 'dirt', sand: 'dirt', snow: 'snow', metal: 'metal', wood: 'wood', water: 'water',
  paintwood: 'wood', boards: 'wood', hull: 'metal', rust: 'metal', grating: 'metal', crushedice: 'snow' };
const STEP_K = 1.0;
const softGround = (sf) => sf === 'dirt' || sf === 'grass' || sf === 'snow' || sf === 'sand' || sf === 'gravel';
/* Saut : impulsion du pied et équipement */
function sfxJump(surface) {
  if (!AU.ready) return;
  if (sfxHas('s_jump')) { const o = auOut(null, 0.04, 1), t = AU.ctx.currentTime; sfxPlay('s_jump', o, t, { gain: 0.5 * STEP_K, rate: rand(0.95, 1.05) }); sfxStep(null, 0.16, surface); return; }
  sfxStep(null, 0.2, surface);
}
/* « Clac » sourd : choc étouffé et corps grave, jamais d'aigus (la hauteur demandée est ramenée sous 900 Hz) */
function clack(o, t, f, gain, dur = 0.06, body = 0) {
  const fc = Math.min(f * 0.4, 900);
  nz(o, t, dur * 0.7, 'lowpass', fc * 2.2, fc * 0.7, 1, gain * 0.8, 0.0006);
  tn(o, t, dur, fc * 0.45, fc * 0.3, 'sine', gain * 0.7, 0.0006);
  nz(o, t, 0.012, 'bandpass', fc * 1.6, fc * 1.2, 1.2, gain * 0.25, 0.0004);
  if (body) tn(o, t, 0.06, body, body * 0.5, 'sine', gain * 0.8, 0.0008);
}
/* Échantillon de touche : un « bwop » très bref (47 ms), grave et saturé, qui se fait entendre au milieu des rafales.
   Enregistré à 48 kHz, 8 bits, mono (2,2 ko, voir README « Crédits et licences ») ; c'est la seule donnée sonore du jeu. */
const HIT_SAMPLE = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAD//wAB//8AAf//AAAAAP//AAAAAQEA/wABAP8AAQAAAAD//wAAAAAAAAD/AAAA/wD//wACAf79AAIA/wEBAQIA/f3/AAEA/P0EA/r7BAP6/AD+/P37+v4BAwUA+v4FAv3+BAT9+v3+/P8C/v0A/vv7/fz69/n+/wAFAfX2Bgv89gUNAv3/9O33+PQBAO76C/brCRD28wQLDALs7w4WAPkJEAwK+9zgBxUGBgwD+vHo9QYCCiEeExsV//f4+gcIARsyDuDh9gMPEPvwDiwV7fELGR4O9QsuF/sQFQANGQD8EAXy9OrmCCIF4vUjJfvsBRMRFA79+wIFA/n2Av3q8QQAAA3+3uYKDu/oDykO5+L7GB8QB/7o7xEC0eAVEOjoBA8J++ztBhYJ8ubn9QcIAQkG7Njd9hIDy77r/OXf7vn14eIFC/DzA/YBLiLZvfElFObqCAD1Dhb87u3n+B4b588DPzcI6Njf7Mak2Qji5Cgi9hgn5dobHu3rAgUOHyAZFxchLCAG79LD6RkK5f08VS/54MultgAQAURtHO4K58sLD9UFQQTOypuN0+vdEEhJLNCBoB4q8QA9UjH94uvowKrZJ0s9EMKf80H1go/5Xn8skIGh+/nXC1T8gZsdFP416oGmf220rhkhHmdg2YGBkPtvWgAKNSlPf39tWBucolZ/MNQ7f10DNH93an9/TSJdf39zOD9/f03g8WN/Mc3hZn8WgYFLf0oaMz4Y5O0yL+sWf39UH4GB1VrapzNcQ39/QnVuk4E2f/WpBfyBgc48TBGPgfJ/f72BgYGxPH9/XbKBkT8hgYGBgYGqkoHGf2Cm839/Me3vJVBkf39/f39mf38R0Bjvof9/f3/+gZw+64GBh4GBsSUHgYFlf9CBgYG3c38rwwxg9YGfCZ+B/39/f38gR39Xkac6f39/J5qBgYGBgYGBqjB/f39/f39/f39/cWZ/N4GQ8oGMd0GBxH8KgYEXf38WTX8TgYGtgYGBgYGBgYWBgYGmgYGBgYGBgYGDgYGBgYGBlRx/fxsPf39/dH9/f39rzYGmVn9/KpaB339/1IGqW39/f39/f39/f39/f39/f39/f39/f39/f39ZmIHcf3+jgTF/f39/OIGBgY2BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYSvq6LC18O+4vzozNf2+vcDAv8VENrUChYKLUEYDTU7K1J/f39/f39/f2Fnf39FU39/f39/f39mVGtqQVB/f15kf39/f39/f39/b3F3d3Z8f393cn9/bCUhPyP2K392BszpCPXCqcjo2crsGykW/fbv1dDaoYG9V1P1CWBbGQs/en95XlFJR1dqa19UTUtGGcy5BUIVxLzs76iBoKqBgY2UgYGBgYGBgYGOgoGBgYGBgYGBgYGBirK2o4KBmesE3NH+E/bm8PLw9erZ5fj6/f7q4/sG9fUOGwrz7foOIysY/vv+9fUBBg0cGQHz9fwEA/Pn7P4QDwH8++7zFCQaGx0E7vH28/Px9QH+8PgLCQUQC/Tt+gsXE/vp7PcBCwr+9ff/++zzFBPs6AD06A8l+d/7CgEGDwgB++7q+QQHDBAI9/D5BAL37vH+BwcJCwH/Bvrk6QELCwkKExYICR4X+fYA9/UEDAb+9vb78eb2CP7q5u73AQkL/e3yAgH18/r69vf7+/n8/Pf7BQQCCAHu7fr+AwsA9QQSCwkMAvsCBQEECQYFCAb9+QEIBAADAv79+vb07+36B/3y+P706vEHEPzn7PsA/PHs/RAMAPz6+/rw6vP7/QQJBgQEChUVBf8EBQkJ9+3+CAIFDhETDgYVIQv6ChIFBgsB/QD9AhAK+wMQDAH7+AESFgoCBP7w7v4G/PT4AQP+9/kFEBAB8PD6+/n+Af79/v7//vwAAvr1+fv9BQYB/wH/AAD/AQH8+wH//goVEQP49v4GBv/8AAkI/foIExENDwz/9vwECQwH/P8KA/n+AwIJCwIECf79Dg36+QH//Pn19/rz9QMH//39/AME+/T1+Pr58vH08vT+Av//AAID/PHx+wIA+/f+Cgj68/oEBP8ABwT7+wIFBgYFBgYEAgQD//8DBgQCAQD9/QD+/QIC/v//9/cAAPr6+voABQIAAf35/P/+/f///f4AAP7/AQD/AQUE//v8/v8DBwT9/QMEBAUEBAUB/gEEAwQGAf4CAf7///z6+vr+AwIBAgIA/wD//v4BAgD/AAEBAP/+/v7/AgMCAwH+/wL//AAC/v0AAP4CBAD9/wEAAAEBAAAAAAAAAQD///8AAQEA/wAA//8BAP7/AAEBAQEBAQEAAAAA//8AAAAAAAAAAAAAAAAAAP//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
function hitSampleBuild() {
  const bin = atob(HIT_SAMPLE), n = bin.length, buf = AU.ctx.createBuffer(1, n, 48000), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) { const v = bin.charCodeAt(i); d[i] = (v > 127 ? v - 256 : v) / 127; }
  AU.hitBuf = buf;
}
function hitSample(o, t, rate, gain) {
  if (!AU.hitBuf) return; const s = AU.ctx.createBufferSource(), g = AU.ctx.createGain();
  s.buffer = AU.hitBuf; s.playbackRate.value = rate; g.gain.value = gain; s.connect(g); g.connect(o); s.start(t);
}
/* Retour de touche : l'échantillon, et pendant 90 ms les tirs du joueur s'écartent pour lui laisser la place.
   Touche : l'échantillon seul (variation de hauteur de 3 % pour ne jamais sonner en mitraillette). Tête : plus aigu. Élimination : le même échantillon en plus prononcé : trois couches (normale, plus
   grave et très lente, qui l'allongent et l'épaississent), un choc grave dessous et un creusement plus long des tirs. Chaque élimination enchaînée en moins
   de 4 s (jusqu'à trois) ajoute une frappe de l'échantillon, une marche plus haut à chaque fois. */
function sfxHit(head, kill, chain = 1) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = uiOut(kill ? 1.3 : 1.1);
  const fp = AU.fpBus.gain; fp.cancelScheduledValues(t); fp.setValueAtTime(fp.value, t); fp.linearRampToValueAtTime(kill ? 0.3 : 0.5, t + 0.003); fp.linearRampToValueAtTime(1, t + (kill ? 0.25 : 0.1));
  // tête : tintement de casque enregistré par-dessus ; élimination : « thunk » grave enregistré (sinon un coup de sinus)
  if (head && sfxHas('h_head')) sfxPlay('h_head', o, t, { gain: kill ? 0.45 : 0.55, rate: rand(0.97, 1.03) });
  if (!kill) {
    hitSample(o, t, head ? rand(1.24, 1.32) : rand(0.97, 1.03), 1);
    return;
  }
  const hits = Math.min(chain, 3);
  hitSample(o, t, 1, 1); hitSample(o, t, 0.74, 0.9); hitSample(o, t + 0.012, 0.55, 0.8);
  if (sfxHas('h_kill')) sfxPlay('h_kill', o, t, { gain: 0.85, rate: rand(0.98, 1.02) }); else tn(o, t, 0.3, 115, 38, 'sine', 1.1, 0.0006);
  if (head) hitSample(o, t, 1.28, 0.7);
  for (let i = 1; i < hits; i++) { hitSample(o, t + i * 0.085, Math.pow(1.122, i * 2), 1); tn(o, t + i * 0.085, 0.12, 130, 48, 'sine', 0.6, 0.0006); }
}
/* Mort du joueur : coup sourd seul, pour ne pas confondre avec la confirmation d'une élimination */
function sfxDown() {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = uiOut(1);
  if (sfxPlay('p_down', o, t, { gain: 0.9 })) return;
  tn(o, t, 0.3, 110, 32, 'sine', 1.0, 0.001); nz(o, t, 0.12, 'lowpass', 700, 150, 1, 0.7);
}
/* Impact de balle sur le décor, par matière : un claquement sec, un corps qui dit la matière, des éclats qui retombent */
/* Matière touchée → banque d'impacts enregistrés (i_<matière>) */
const IMPACT_SND = { metal: 'i_metal', wood: 'i_wood', paintwood: 'i_wood', glass: 'i_glass', leaf: 'i_leaf', ground: 'i_dirt', dirt: 'i_dirt', sand: 'i_dirt', grass: 'i_dirt', snow: 'i_snow', water: 'i_water',
  hull: 'i_metal', rust: 'i_metal', grating: 'i_metal', boards: 'i_wood' };
function sfxImpact(pos, m) {
  if (!AU.ready) return; const d = pos.distanceTo(camera.position); if (d > 60) return;
  if (m === 'flesh') return sfxFlesh(pos, false, false);
  const id = IMPACT_SND[m] || 'i_concrete';
  if (sfxHas(id)) {
    if (!auAfford(5, d)) return;
    const t = AU.ctx.currentTime + Math.min(d / 343, 0.4), o = auOut(pos, 0.12, 0.75, 0.9, 5);
    sfxPlay(id, o, t, { rate: rand(0.93, 1.07) });
    // de temps en temps, la balle ricoche sur une matière dure
    if ((id === 'i_concrete' || id === 'i_metal') && d < 30 && Math.random() < 0.1) sfxPlay('i_ric', o, t + rand(0.005, 0.02), { gain: 0.45, rate: rand(0.9, 1.1) });
    return;
  }
  const t = AU.ctx.currentTime + Math.min(d / 343, 0.4), o = auOut(pos, 0.12, 0.9, 0.9, 5);
  if (m === 'metal') {
    // tôle : même claquement et même corps sourd qu'un mur, avec un « tonk » très court, sans résonance qui sonne comme du verre
    nz(o, t, 0.01, 'highpass', 2200, 2200, 0.8, 0.6); nz(o, t, 0.05, 'bandpass', 1500, 800, 1.1, 0.6); tn(o, t, 0.07, 300, 130, 'sine', 0.6, 0.0008);
    tn(o, t, 0.045, 880, 800, 'sine', 0.14, 0.0005);
  } else if (m === 'wood' || m === 'paintwood') {
    nz(o, t, 0.06, 'bandpass', 900, 500, 1.1, 0.7); tn(o, t, 0.06, 380, 160, 'sine', 0.55, 0.0008); nz(o, t, 0.02, 'bandpass', 1600, 1200, 1.5, 0.4);
    if (Math.random() < 0.5) nz(o, t + rand(0.03, 0.1), 0.02, 'bandpass', rand(1200, 2000), 1200, 2, 0.15);
  } else if (m === 'glass') {
    nz(o, t, 0.01, 'highpass', 2200, 2200, 0.8, 0.5); nz(o, t, 0.05, 'bandpass', 1800, 900, 1.1, 0.5); tn(o, t, 0.06, 280, 130, 'sine', 0.45, 0.0008);
    for (let i = 0; i < 3; i++) nz(o, t + rand(0.02, 0.12), 0.012, 'bandpass', rand(1400, 2600), 1800, 2, 0.16);
  } else if (m === 'leaf') {
    // haie : froissement sec de feuilles, presque aucun corps
    nz(o, t, 0.12, 'bandpass', 3200, 1800, 1, 0.4); nz(o, t, 0.05, 'lowpass', 900, 400, 1, 0.3);
    for (let i = 0; i < 4; i++) nz(o, t + rand(0.01, 0.1), 0.02, 'bandpass', rand(2600, 4200), 2400, 2, 0.14);
  } else if (m === 'ground' || m === 'dirt') {
    nz(o, t, 0.1, 'lowpass', 500, 180, 1, 0.8); tn(o, t, 0.09, 130, 60, 'sine', 0.55, 0.001); nz(o, t, 0.03, 'bandpass', 2200, 1500, 1.5, 0.2);
  } else if (m === 'snow') {
    nz(o, t, 0.13, 'lowpass', 900, 300, 1, 0.7); nz(o, t, 0.06, 'bandpass', 3000, 2000, 1, 0.18);
  } else if (m === 'water') {
    // « ploc » : claque de la surface, bulle qui remonte, pluie de gouttes
    nz(o, t, 0.03, 'bandpass', 1300, 900, 1.2, 0.6); tn(o, t + 0.01, 0.09, 520, 1100, 'sine', 0.22, 0.003);
    nz(o, t + 0.02, 0.22, 'lowpass', 700, 250, 1, 0.4); nz(o, t + rand(0.12, 0.2), 0.15, 'bandpass', 2400, 1600, 1.5, 0.12);
  } else { // béton, brique, pierre
    nz(o, t, 0.01, 'highpass', 2200, 2200, 0.8, 0.7); nz(o, t, 0.05, 'bandpass', 1800, 900, 1.1, 0.6); tn(o, t, 0.07, 260, 120, 'sine', 0.55, 0.0008);
    for (let i = 0; i < 3; i++) nz(o, t + rand(0.03, 0.17), 0.012, 'bandpass', rand(1500, 3000), 1800, 2, 0.2);
  }
}
/* Balle dans un corps : claque mouillée et coup grave. mine : c'est le joueur qui touche, le son reste présent même loin */
function sfxFlesh(pos, head, mine) {
  if (!AU.ready) return; const d = pos.distanceTo(camera.position); if (d > 45 && !mine) return;
  const t = AU.ctx.currentTime + (mine ? 0 : Math.min(d / 343, 0.4)), o = mine ? uiOut(0.9 / (1 + d / 35)) : auOut(pos, 0.08, 1.5, 0.9, 5);
  if (sfxHas('i_flesh')) {
    sfxPlay('i_flesh', o, t, { gain: mine ? 0.55 : 0.7, rate: rand(0.94, 1.06) });
    if (head) sfxPlay('i_head', o, t, { gain: mine ? 0.45 : 0.6, rate: rand(0.95, 1.05) });
    return;
  }
  nz(o, t, 0.06, 'bandpass', 1100, 500, 1.1, 0.8); nz(o, t, 0.01, 'highpass', 3500, 3500, 0.8, 0.4); tn(o, t, 0.09, 170, 70, 'sine', 0.7, 0.001);
  if (head) { nz(o, t, 0.035, 'bandpass', 2600, 1400, 1.5, 0.5); tn(o, t, 0.03, 900, 500, 'triangle', 0.25, 0.001); }
}
/* Corps qui s'écrase : choc sourd et étouffé, sangles et équipement qui claquent en dessous de 1 kHz, rien d'aigu */
function sfxBodyFall(pos, k = 1) {
  if (!AU.ready) return; const d = pos.distanceTo(camera.position); if (d > 40) return;
  const t = AU.ctx.currentTime + Math.min(d / 343, 0.12), o = auOut(pos, 0.1, 1, 1.1, 5);
  if (sfxPlay('b_fall', o, t, { gain: 0.8 * clamp(k, 0.4, 1.2), rate: rand(0.94, 1.06) })) return;
  tn(o, t, 0.18, 88, 36, 'sine', 0.95 * k, 0.001); nz(o, t, 0.1, 'lowpass', 520, 130, 1, 0.8 * k);
  nz(o, t + 0.012, 0.08, 'bandpass', 700, 360, 0.9, 0.3 * k);
}
/* Balle reçue : choc sourd dans la poitrine, claquement tout proche, et le monde s'étouffe un instant */
function sfxHurt(dmg = 30) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, k = clamp(dmg / 40, 0.6, 1.5), o = uiOut(1.1);
  if (!sfxPlay('p_hurt', o, t, { gain: 0.75 * k, rate: rand(0.95, 1.05) })) {
    nz(o, t, 0.13, 'lowpass', 500, 150, 1, 0.9 * k); tn(o, t, 0.17, 100, 45, 'sine', 0.85 * k, 0.001);
    nz(o, t, 0.012, 'highpass', 3000, 3000, 0.8, 0.5); tn(o, t, 0.07, 260, 120, 'triangle', 0.4, 0.001);
  }
  const f = AU.duck.frequency; f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(1400, t + 0.015); f.exponentialRampToValueAtTime(20000, t + 0.45);
}
/* Balle qui passe près de l'oreille : claquement net puis sifflement qui s'éloigne */
function sfxWhiz(pos) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(pos, 0.05, 1.8);
  if (sfxPlay('i_whiz', o, t, { gain: 0.6, rate: rand(0.92, 1.08) })) return;
  nz(o, t, 0.012, 'bandpass', 1800, 1200, 1, 0.5);
  nz(o, t, 0.16, 'bandpass', 2800, 700, 2, 0.6, 0.012); tn(o, t, 0.13, 900, 300, 'sine', 0.2, 0.01);
}
function sfxExplosion(pos, k = 1) {
  if (!AU.ready) return;
  const d = pos.distanceTo(camera.position), near = clamp(1 - d / 40, 0, 1), t = AU.ctx.currentTime + Math.min(d / 450, 0.2), o = auOut(pos, 0.6, 2.4 * k, 1, 5, AU.wpn);
  if (sfxHas('x_near')) {
    // enregistrements : proche (claquement, souffle, grondement) ou lointain (grondement arrondi), gravats qui retombent ; de près, un
    // coup de sub-grave synthétisé dans la poitrine et, à moins de 8 m, un acouphène pendant que le monde s'étouffe
    if (d < 35) { sfxPlay('x_near', o, t, { gain: 0.95, rate: rand(0.95, 1.04) }); if (d < 28) sfxPlay('x_debris', o, t + rand(0.3, 0.45), { gain: 0.35 + 0.3 * near }); }
    else sfxPlay('x_far', o, t, { gain: 1.1, rate: rand(0.92, 1.04) });
    if (near > 0) tn(o, t, 0.8, 62, 24, 'sine', 0.9 * near, 0.004);
    if (d < 8) {
      const a = 1 - d / 8, f = AU.duck.frequency;
      sfxPlay('p_ring', uiOut(0.22 * a), t + 0.05);
      f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(lerp(4000, 700, a), t + 0.05); f.exponentialRampToValueAtTime(20000, t + 1.2 + a * 1.4);
    }
    return;
  }
  // claquement sec (surtout de près), coup grave, corps médium, grondement qui s'éteint
  nz(o, t, 0.14, 'highpass', 2800, 900, 0.8, 0.5 + 0.9 * near, 0.0006);
  tn(o, t, 0.9, 95, 26, 'sine', 1.5, 0.003); tn(o, t, 0.35, 160, 50, 'triangle', 0.5);
  nz(o, t, 0.55, 'lowpass', 3000, 220, 0.7, 1.3); nz(o, t, 2.8, 'lowpass', 520, 70, 0.5, 0.8, 0.03);
  // écho renvoyé par les façades, puis retombée de gravats
  nz(o, t + 0.16, 0.5, 'lowpass', 1600, 300, 0.6, 0.35 * (0.4 + near));
  for (let i = 0; i < 7; i++) nz(o, t + 0.45 + i * rand(0.07, 0.17), rand(0.05, 0.12), 'bandpass', rand(900, 2600), 700, 1.2, rand(0.04, 0.1) * (0.4 + near));
  // à moins de 8 m : sifflement dans les oreilles
  if (d < 8) { const a = 1 - d / 8; tn(o, t + 0.05, 2.2, 4200, 3900, 'sine', 0.05 * a, 0.05); }
}
/* Grenade qui plonge (k petit) ou explose sous l'eau (k = 1) : coup sourd étouffé, gerbe qui retombe en pluie */
function sfxPlunge(pos, k = 1) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(pos, 0.3 * k, 1.6 + k);
  if (sfxPlay(k > 0.8 ? 'x_water' : 'x_splash', o, t, { gain: k > 0.8 ? 0.6 : 0.4, rate: rand(0.95, 1.05) })) return;
  if (k > 0.8) { tn(o, t, 0.6, 55, 20, 'sine', 1.3); nz(o, t, 0.35, 'lowpass', 600, 120, 0.8, 1.0); }
  nz(o, t + 0.02, 0.18 * k + 0.05, 'bandpass', 900, 500, 1, 0.5 * k + 0.2); tn(o, t, 0.12, 300, 120, 'sine', 0.3);
  nz(o, t + 0.25 * k, 0.9 * k + 0.2, 'bandpass', 2200, 1500, 0.8, 0.25 * k + 0.05, 0.1);
}
function sfxJet() {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(null, 0.4, 1);
  nz(o, t, 3.6, 'bandpass', 300, 2200, 0.6, 0.9, 1.4); nz(o, t + 1.2, 2.2, 'lowpass', 900, 200, 0.5, 0.7, 0.6);
}
/* Annonce de fin de partie (09l-fin.js) : une montée, puis l'impact quand le mot s'abat (0,42 s), et une harmonie qui dit le résultat :
   accord majeur qui s'ouvre (victoire), accord mineur grave qui s'affaisse (défaite), quinte nue (égalité) */
/* Musique de fin de partie, au moment de l'annonce Victoire / Défaite (09l-fin.js) : les morceaux du propriétaire (paquet fin, chargé avec les sons
   de la partie). Victory_Riff (4 s, -13,8 LUFS) et Mourning_Defeat (7,2 s, -18,4 LUFS) sont ramenés à peu près au même niveau, montés de 6 dB en 3.1.0
   (« à rehausser », retour du propriétaire ; avant : 0,85 et 1,35), comme la fanfare de montée de niveau (rankUpSound) : au niveau de la synthèse
   d'égalité, voir README « Niveaux » ; le réglage Musique les baisse sous la moitié et les coupe à zéro. Elle passe par les sons directs de la partie :
   coupée net si l'on quitte pour les menus (sfxGate). Égalité, ou paquet absent : la synthèse d'origine. */
const END_MUSIC = { win: ['m_victory', 1.7], loss: ['m_defeat', 2.7] };
function sfxMatchEnd(result) {
  if (!AU.ready) return;
  const m = END_MUSIC[result];
  if (m && sfxHas(m[0])) { sfxPlay(m[0], uiOut(m[1] * Math.min(1, Settings.music * 2)), AU.ctx.currentTime + 0.03); return; }
  const t = AU.ctx.currentTime + 0.03, h = t + 0.42, o = uiOut(1.1);
  nz(o, t, 0.4, 'bandpass', 300, 2600, 1.4, 0.35, 0.3);
  tn(o, h, 1.3, 88, 27, 'sine', 1.5, 0.003); tn(o, h, 0.4, 150, 48, 'triangle', 0.5);
  nz(o, h, 0.5, 'lowpass', 2600, 200, 0.7, 1.0, 0.002); nz(o, h, 0.12, 'highpass', 3200, 1200, 0.8, 0.45, 0.0006);
  if (result === 'win') for (const [f, d] of [[196, 0], [294, 0.02], [392, 0.04], [494, 0.06], [588, 0.3]]) { tn(o, h + d, 2.2, f, f, 'sawtooth', 0.045, 0.05); tn(o, h + d, 2.2, f, f * 1.003, 'triangle', 0.07, 0.05); }
  else if (result === 'loss') { for (const f of [110, 131, 165]) tn(o, h + 0.05, 2.4, f, f * 0.84, 'sawtooth', 0.05, 0.12); tn(o, h, 2.6, 55, 36, 'sine', 0.5, 0.08); }
  else for (const f of [220, 330]) tn(o, h + 0.05, 1.8, f, f, 'triangle', 0.1, 0.05);
}
/* Le monde passe derrière une cloison pendant l'annonce (filtre des bruits de la scène) ; les sons d'interface restent nets */
function sfxFinMuffle(on) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, f = AU.duck.frequency;
  f.cancelScheduledValues(t); f.setValueAtTime(Math.max(f.value, 200), t); f.exponentialRampToValueAtTime(on ? 650 : 20000, t + (on ? 0.4 : 0.25));
}
function sfxBeep(f = 880, n = 2) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(null, 0, 0.6);
  f = Math.min(f * 0.55, 1000); // alertes graves et rondes : triangle sous 1 kHz, plus de carré strident
  for (let i = 0; i < n; i++) tn(o, t + i * 0.14, 0.09, f, f, 'triangle', 0.2);
}
function sfxHeart() {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(null, 0, 1);
  if (sfxPlay('p_heart', uiOut(0.5), t)) return;
  tn(o, t, 0.12, 60, 40, 'sine', 0.55); tn(o, t + 0.18, 0.12, 55, 38, 'sine', 0.4);
}
/* Réception d'un saut ou d'une chute (k : violence, 0,3 à 1,3) */
function sfxLand(surface = 'concrete', k = 1) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(null, 0.05, 1);
  const id = softGround(surface) || surface === 'water' ? 's_land_soft' : 's_land';
  if (sfxHas(id)) { sfxPlay(id, o, t, { gain: 0.42 * clamp(k, 0.5, 1.3) * STEP_K, rate: rand(0.95, 1.05) }); sfxStep(null, 0.2, surface); return; }
  nz(o, t, 0.14, 'lowpass', 600, 150, 1, 0.6); tn(o, t, 0.1, 110, 50, 'sine', 0.35);
}
function sfxSlide(pos) { // pos : la glissade d'un autre soldat, entendue de là où il est
  if (!AU.ready) return; if (pos && (pos.distanceTo(camera.position) > 30 || !auAfford(4, pos.distanceTo(camera.position)))) return; // budget de voix : un soldat distant ne prend pas la place d'un son proche
  const t = AU.ctx.currentTime, o = auOut(pos || null, 0.04, 1);
  // une seule glissade, celle sur terre, quelle que soit la surface (celle sur sol dur sonnait mal : retirée)
  if (sfxHas('s_slide_soft')) { sfxPlay('s_slide_soft', o, t, { gain: 0.5 * STEP_K, rate: rand(0.95, 1.05) }); return; }
  nz(o, t, 0.75, 'bandpass', 1100, 260, 0.9, 0.5, 0.06); nz(o, t, 0.5, 'lowpass', 500, 140, 1, 0.45, 0.03); tn(o, t, 0.16, 130, 55, 'sine', 0.3);
}
/* Hélicoptère : grondement continu, spatialisé, qui suit l'appareil (une boucle par hélicoptère, voir heliSoundStart).
   Battement des pales (≈ 13 Hz) sur un souffle de turbine et un ronflement grave, audible de loin : un ennemi qui survole
   doit se faire entendre avant de se faire voir. Un allié sonne un peu plus bas, un ennemi plus fort et plus mordant. */
function heliSoundStart(h) {
  if (!AU.ready) return null;
  const enemy = h.team !== PL.ent.team;
  // enregistrement : boucle de rotor et de turbine qui suit l'appareil (sfxEmitter, 05c-ambiance.js)
  const E = sfxEmitter('k_heli', h.pos, { loop: true, off: rand(0, 3), gain: enemy ? 2.4 : 1.5, ref: 16, roll: 0.8, max: 600, air: 200, verb: 0.15, fade: 0.6 });
  if (E) return Object.assign(E, { smp: true, enemy });
  const ctx = AU.ctx, S = { enemy, nodes: [] };
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
  const pan = ctx.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 16; pan.rolloffFactor = 0.8; pan.maxDistance = 600;
  const out = ctx.createGain(); out.gain.value = 0.0001; out.gain.setTargetAtTime(enemy ? 2.6 : 1.5, ctx.currentTime, 0.6);
  const mod = ctx.createGain(); mod.gain.value = 0.55; // battement : le gain oscille autour de 0,55
  mod.connect(lp); lp.connect(pan); pan.connect(out); out.connect(AU.bus);
  const vs = ctx.createGain(); vs.gain.value = 0.18; pan.connect(vs); vs.connect(AU.verb);
  const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = enemy ? 13.5 : 12;
  const lg = ctx.createGain(); lg.gain.value = 0.42; lfo.connect(lg); lg.connect(mod.gain);
  // souffle de turbine (bruit filtré), claquement des pales, ronflement du moteur
  const n = ctx.createBufferSource(); n.buffer = AU.noise; n.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 420; nf.Q.value = 0.7; const ng = ctx.createGain(); ng.gain.value = 0.7;
  n.connect(nf); nf.connect(ng); ng.connect(mod);
  const slap = ctx.createBufferSource(); slap.buffer = AU.noise; slap.loop = true;
  const sf = ctx.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 1500; const sg = ctx.createGain(); sg.gain.value = 0.16;
  slap.connect(sf); sf.connect(sg); sg.connect(mod);
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52; const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 38;
  const og = ctx.createGain(); og.gain.value = 0.16; const og2 = ctx.createGain(); og2.gain.value = 0.7;
  const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 260;
  o1.connect(of); of.connect(og); og.connect(mod); o2.connect(og2); og2.connect(mod);
  for (const x of [lfo, n, slap, o1, o2]) x.start();
  Object.assign(S, { ctx, lp, pan, out, lfo, o1, o2, srcs: [lfo, n, slap, o1, o2], vs });
  return S;
}
function heliSoundUpdate(h) {
  heliGunTick(h);
  const S = h.snd; if (!S) return;
  if (S.smp) {
    // en perdition, le rotor ralentit et le son descend
    sfxEmitterMove(S, h.pos); S.v.s.playbackRate.setTargetAtTime(h.state === 'crash' ? 0.7 : 1, AU.ctx.currentTime, h.state === 'crash' ? 0.9 : 0.3);
    return;
  }
  const t = S.ctx.currentTime, p = h.pos, d = p.distanceTo(camera.position);
  if (S.pan.positionX) { S.pan.positionX.value = p.x; S.pan.positionY.value = p.y; S.pan.positionZ.value = p.z; } else S.pan.setPosition(p.x, p.y, p.z);
  // l'air absorbe les aigus avec la distance, mais le grondement grave porte loin
  S.lp.frequency.setTargetAtTime(Math.max(380, 3600 * Math.pow(0.09, clamp(d / 200, 0, 1))), t, 0.1);
  // en perdition : le rotor ralentit, le moteur s'étrangle
  const crash = h.state === 'crash';
  S.lfo.frequency.setTargetAtTime(crash ? 6 : S.enemy ? 13.5 : 12, t, 0.5); S.o1.frequency.setTargetAtTime(crash ? 30 : 52, t, 0.8);
}
function heliSoundStop(h) {
  heliGunStop(h);
  const S = h.snd; if (!S) return; h.snd = null;
  if (S.smp) { sfxEmitterStop(S, 0.15); return; }
  const t = S.ctx.currentTime; S.out.gain.cancelScheduledValues(t); S.out.gain.setTargetAtTime(0.0001, t, 0.15);
  setTimeout(() => { for (const x of S.srcs) { try { x.stop(); } catch (e) { /* déjà arrêtée */ } } for (const x of [S.out, S.pan, S.lp, S.vs]) x.disconnect(); }, 900);
}
/* Mitrailleuse de l'hélicoptère : une boucle de rafale enregistrée, entretenue tant que les balles partent (heliGunTick l'arrête
   et joue la fin de rafale) ; en repli, un coup synthétisé par balle */
function sfxHeliGun(pos, h) {
  if (!AU.ready || pos.distanceTo(camera.position) > 200) return;
  if (h && sfxHas('k_minigun')) {
    if (!h.gun) h.gun = sfxEmitter('k_minigun', pos, { loop: true, gain: 1.5, ref: 12, roll: 0.8, max: 400, air: 150, verb: 0.25 });
    else sfxEmitterMove(h.gun, pos);
    if (h.gun) h.gun.until = AU.ctx.currentTime + 0.12;
    return;
  }
  if (pos.distanceTo(camera.position) > 160) return;
  const t = AU.ctx.currentTime, o = auOut(pos, 0.25, 1.5);
  nz(o, t, 0.06, 'bandpass', 1100, 500, 1.2, 0.7); tn(o, t, 0.07, 190, 90, 'sawtooth', 0.28);
}
function heliGunTick(h) {
  const G = h.gun; if (!G || AU.ctx.currentTime < G.until) return;
  h.gun = null; sfxEmitterStop(G, 0.015); sfxAt('k_minigun_end', G.p, 1.5, { prop: false, ref: 12, roll: 0.8, verb: 0.25, rate: 1 });
}
function heliGunStop(h) { if (h.gun) { sfxEmitterStop(h.gun, 0.02); h.gun = null; } }
function sfxMelee() {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(null, 0.05, 1);
  if (sfxPlay('f_knife_hit', o, t, { gain: 0.8, rate: rand(0.95, 1.05) })) return;
  nz(o, t, 0.1, 'lowpass', 700, 200, 1, 0.9); tn(o, t, 0.12, 120, 45, 'sine', 0.7);
}
/* Choc de la grenade (fonte) : k = violence, soft = sol meuble (terre, herbe, neige : un « pof » sourd, sans tintement) */
/* Grenade incapacitante (flashBang) : détonation sèche et claquement aigu ; deaf (0 à 1) : le joueur assourdi, le monde passe sous un passe-bas
   et l'oreille siffle pendant dur secondes */
function sfxFlashBang(pos, deaf = 0, dur = 0) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(pos, 0.5, 1.4);
  sfxExplosion(pos, 0.4); nz(o, t, 0.14, 'highpass', 3200, 2200, 0.7, 0.9); tn(o, t, 0.25, 900, 200, 'square', 0.12, 0.002);
  if (deaf <= 0) return;
  const f = AU.duck.frequency, gg = AU.duckG.gain;
  f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(lerp(4000, 260, deaf), t + 0.03); f.setValueAtTime(lerp(4000, 260, deaf), t + dur * 0.6); f.exponentialRampToValueAtTime(20000, t + dur);
  gg.cancelScheduledValues(t); gg.setValueAtTime(gg.value, t); gg.linearRampToValueAtTime(1 - 0.6 * deaf, t + 0.03); gg.linearRampToValueAtTime(1, t + dur);
  tn(uiOut(0.5), t + 0.04, dur, 3900, 3700, 'sine', 0.07 * deaf, 0.03);
}
/* Fumigène qui s'ouvre (smokeStart) : petit claquement puis long chuintement */
function sfxSmokePop(pos) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(pos, 0.3, 1);
  nz(o, t, 0.08, 'lowpass', 900, 300, 1, 0.45); nz(o, t + 0.04, 2.6, 'bandpass', 3200, 1400, 0.8, 0.22, 0.2);
}
function sfxBounce(pos, k = 1, soft = false) {
  if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(pos, 0.1, 1.2);
  if (sfxPlay(soft ? 'n_bounce_soft' : 'n_bounce', o, t, { gain: 0.55 * clamp(k, 0.3, 1.2), rate: rand(0.92, 1.08) })) return;
  if (soft) { tn(o, t, 0.09, rand(110, 160), 60, 'sine', 0.45 * k); nz(o, t, 0.07, 'lowpass', 500, 200, 1, 0.35 * k); return; }
  tn(o, t, 0.07, rand(260, 380), 140, 'sine', 0.4 * k); nz(o, t, 0.04, 'lowpass', 900, 400, 1, 0.3 * k);
  tn(o, t, 0.16, rand(1500, 2100), 1200, 'sine', 0.07 * k, 0.0006); nz(o, t, 0.03, 'bandpass', 2600, 1800, 1.4, 0.12 * k); // fonte qui tinte
}

/* Choc d'un petit objet qui retombe ou se cogne, selon sa matière, k = violence */
const PROP_SND = { fruit: 'o_fruit', metal: 'o_metal', wood: 'o_wood', plastic: 'o_plastic', clay: 'o_clay', snow: 'o_snow', soft: 'o_soft' };
function sfxProp(pos, kind, k = 1) {
  if (!AU.ready) return; const d = pos.distanceTo(camera.position); if (d > 35) return;
  const t = AU.ctx.currentTime + Math.min(d / 343, 0.1), o = auOut(pos, 0.08, 1, 1, 5);
  if (sfxPlay(PROP_SND[kind] || 'o_wood', o, t, { gain: 0.6 * clamp(k, 0.25, 1.2), rate: rand(0.92, 1.08) })) return;
  if (kind === 'fruit') { tn(o, t, 0.06, rand(140, 200), 80, 'sine', 0.4 * k, 0.001); nz(o, t, 0.04, 'lowpass', 700, 250, 1, 0.25 * k); }
  else if (kind === 'metal') { nz(o, t, 0.05, 'bandpass', 1300, 700, 1.2, 0.3 * k); tn(o, t, 0.09, rand(250, 340), 140, 'sine', 0.45 * k, 0.0008); tn(o, t, 0.12, rand(520, 640), 500, 'sine', 0.1 * k, 0.0006); }
  else if (kind === 'wood') { nz(o, t, 0.06, 'bandpass', 800, 450, 1.1, 0.45 * k); tn(o, t, 0.08, rand(170, 240), 90, 'sine', 0.5 * k, 0.001); }
  else if (kind === 'plastic') { nz(o, t, 0.04, 'bandpass', 1100, 600, 1.2, 0.35 * k); tn(o, t, 0.06, rand(200, 280), 110, 'triangle', 0.3 * k, 0.001); }
  else if (kind === 'clay') { nz(o, t, 0.05, 'bandpass', 1000, 500, 1.3, 0.4 * k); tn(o, t, 0.07, rand(220, 300), 120, 'sine', 0.4 * k, 0.001); }
  else if (kind === 'snow') { nz(o, t, 0.12, 'lowpass', 600, 200, 1, 0.5 * k); tn(o, t, 0.1, 90, 50, 'sine', 0.4 * k, 0.002); }
  else if (kind === 'soft') { nz(o, t, 0.09, 'lowpass', 500, 160, 1, 0.45 * k); tn(o, t, 0.08, 100, 55, 'sine', 0.3 * k, 0.002); }
  else { nz(o, t, 0.05, 'bandpass', 900, 500, 1.1, 0.4 * k); tn(o, t, 0.08, 200, 100, 'sine', 0.4 * k, 0.001); }
}
/* Un objet qui éclate (pot de terre, bonhomme de neige) */
function sfxPropBreak(pos, kind) {
  if (!AU.ready) return; const d = pos.distanceTo(camera.position); if (d > 55) return;
  const t = AU.ctx.currentTime + Math.min(d / 343, 0.2), o = auOut(pos, 0.15, 1.2, 1, 5);
  if (sfxPlay(kind === 'snow' ? 'o_break_snow' : kind === 'glass' ? 'o_break_glass' : 'o_break_clay', o, t, { gain: 0.7, rate: rand(0.94, 1.06) })) return;
  if (kind === 'snow') { nz(o, t, 0.25, 'lowpass', 800, 150, 1, 0.8); tn(o, t, 0.2, 90, 40, 'sine', 0.7, 0.001); nz(o, t + 0.04, 0.2, 'bandpass', 1500, 600, 1, 0.25); }
  else if (kind === 'glass') {
    nz(o, t, 0.01, 'highpass', 3000, 3000, 0.8, 0.45); nz(o, t, 0.08, 'bandpass', 3200, 1200, 1.2, 0.4);
    for (let i = 0; i < 4; i++) tn(o, t + rand(0.01, 0.16), 0.05, rand(2400, 4200), 2000, 'sine', 0.07, 0.0005);
  }
  else {
    nz(o, t, 0.012, 'highpass', 2200, 2200, 0.8, 0.5); nz(o, t, 0.1, 'bandpass', 1800, 700, 1.1, 0.6); tn(o, t, 0.1, 240, 100, 'sine', 0.5, 0.001);
    for (let i = 0; i < 5; i++) nz(o, t + rand(0.03, 0.22), 0.015, 'bandpass', rand(1300, 2600), 1500, 2, 0.18);
  }
}

/* Position et orientation de l'écouteur : jamais plus de 60 fois par seconde, et seulement si elles ont bougé. Chaque écriture d'un AudioParam
   (`.value`) ajoute un évènement à sa ligne de temps, sous un verrou que le fil audio prend à chaque tranche de 2,7 ms : 9 écritures par image
   à 280 images par seconde, c'était 2 500 évènements et autant de rencontres avec ce verrou par seconde, sur le fil de l'image. */
const LST = { t: -1e9, v: new Float32Array(6) };
function updateListener() {
  if (!AU.ready) return;
  const now = performance.now(); if (now - LST.t < 16) return;
  const L = AU.ctx.listener, p = camera.position, v = LST.v;
  camera.getWorldDirection(_v1);
  if (Math.abs(v[0] - p.x) + Math.abs(v[1] - p.y) + Math.abs(v[2] - p.z) + Math.abs(v[3] - _v1.x) + Math.abs(v[4] - _v1.y) + Math.abs(v[5] - _v1.z) < 0.002) return;
  LST.t = now; v[0] = p.x; v[1] = p.y; v[2] = p.z; v[3] = _v1.x; v[4] = _v1.y; v[5] = _v1.z;
  if (L.positionX) {
    L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
    L.forwardX.value = _v1.x; L.forwardY.value = _v1.y; L.forwardZ.value = _v1.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(_v1.x, _v1.y, _v1.z, 0, 1, 0); }
}
