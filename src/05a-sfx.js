/* ==========================================================================
   SONS ENREGISTRÉS
   Les bruitages sont des enregistrements libres de droits (CC0 pour l'essentiel : armes de la Free Firearm Sound Library,
   impacts, pas, ambiances ; voir README « Crédits et licences » et assets/sfx/credits.json), préparés par
   tools/build_sfx.py et livrés en paquets à côté de la page (dist/sfx/<paquet>.<condensat>.js, chargés par une balise
   script : marche aussi en file://). Chaque fichier appelle sfxPack(clé, { rate, s: { id: [n, pk, MP3 en base64] } }).
   Paquets : l'interface (ui) au démarrage du son (sfxBoot) ; ceux de la partie (armes, foley, impacts, series, voix_<langue>)
   au lancement de la première partie (sfxBootGame, pendant le chargement de la carte) : les menus restent légers ; l'ambiance
   d'une carte (amb_<carte>) se charge au lancement de la carte et se libère avec elle (05c-ambiance.js).
   Mémoire : sur téléphone (COARSE), les sons se décodent à 32 kHz (24 kHz les ambiances et les voix), les réponses
   impulsionnelles à la fréquence du contexte (la convolution l'exige), et une banque garde au plus deux variantes.
   Tant qu'un son n'est pas décodé (ou si son paquet manque), la synthèse de 05-audio.js le remplace.
   Variantes : « id-1 », « id-2 »... forment la banque « id », dont on tire une prise sans répéter la précédente.
   ========================================================================== */
const SFX_PACKS = /*__SFX_PACKS__*/ {};
const SFX_GAME = ['armes', 'foley', 'impacts', 'series', 'fin', 'mecha'];
// bank : id → [{ b : AudioBuffer, o : début du son dans le tampon (s), d : durée (s), pk : instant de la crête (s) }]
// state : paquet → { s : 'loading' | 'ready' | 'failed', p : promesse } ; of : paquet → banques qu'il a remplies
const SFX = { bank: new Map(), last: new Map(), state: new Map(), cb: new Map(), of: new Map(), dec: new Map() };

function sfxPack(key, d) { const f = SFX.cb.get(key); if (f) f(d); }
/* Le fichier du paquet, par une balise script (comme les textures, voir fetchTexPack) */
function sfxFetch(key) {
  if (!SFX_PACKS[key]) return Promise.resolve(null);
  return new Promise((res) => {
    const s = document.createElement('script');
    const done = (d) => { if (!SFX.cb.has(key)) return; SFX.cb.delete(key); clearTimeout(timer); s.remove(); res(d); };
    const timer = setTimeout(() => done(null), 45000);
    SFX.cb.set(key, done);
    s.onerror = () => done(null);
    s.src = SFX_PACKS[key]; document.head.appendChild(s);
  });
}
/* MP3 en base64 → AudioBuffer (rappels et promesse : Safari ancien n'a que les rappels) ; null si le navigateur refuse */
function sfxDecode(ctx, b64) {
  return new Promise((res) => {
    let u;
    try { const bin = atob(b64); u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i); } catch (e) { res(null); return; }
    try { const p = ctx.decodeAudioData(u.buffer, res, () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (e) { res(null); }
  });
}
/* Contexte de décodage d'un son : celui du jeu sur ordinateur ; sur téléphone, un contexte hors ligne à fréquence réduite
   (le tampon garde sa fréquence, la lecture rééchantillonne), sauf pour une réponse impulsionnelle (ir_*) */
function sfxDecodeCtx(key, id) {
  if (!COARSE || /^ir_/.test(id)) return AU.ctx;
  const sr = Math.min(AU.ctx.sampleRate, /^(amb_|voix_|fin$)/.test(key) ? 24000 : 32000); // fin : musiques de fin de partie, 11 s stéréo
  if (sr >= AU.ctx.sampleRate) return AU.ctx;
  if (!SFX.dec.has(sr)) {
    let c = null;
    try { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; c = new O(1, 1, sr); } catch (e) { c = null; } // fréquence refusée (Safari ancien) : on décode à celle du jeu
    SFX.dec.set(sr, c);
  }
  return SFX.dec.get(sr) || AU.ctx;
}
/* Début réel du son dans le tampon décodé : certains décodeurs laissent en tête le délai de l'encodeur MP3 (576 ou 1105
   échantillons à la fréquence du fichier), d'autres l'enlèvent. On cherche la crête du son (pk, connue à 48 kHz) près de
   sa place attendue et on garde le délai candidat qui l'aligne le mieux. */
function sfxLead(b, n, pk, rate) {
  const r = b.sampleRate / 48000, k = b.sampleRate / rate, e = pk * r, d = b.getChannelData(0);
  const lo = Math.max(0, Math.floor(e - 200 * r)), hi = Math.min(d.length, Math.ceil(e + 1105 * k + 400 * r));
  let im = lo, m = -1;
  for (let i = lo; i < hi; i++) { const v = Math.abs(d[i]); if (v > m) { m = v; im = i; } }
  let best = 0, err = Infinity;
  for (const c of [0, 576 * k, 1105 * k]) { const x = Math.abs(im - (e + c)); if (x < err) { err = x; best = c; } }
  if (b.length < n * r + best - 64) best = 0; // tampon trop court pour contenir ce délai : le décodeur l'a déjà enlevé
  return best / b.sampleRate;
}
/* Charge et décode un paquet (une seule fois) ; renvoie une promesse vraie si le paquet est prêt */
function sfxLoad(key) {
  const cur = SFX.state.get(key); if (cur) return cur.p;
  const st = { s: 'loading', p: null }; SFX.state.set(key, st);
  st.p = (async () => {
    const d = await sfxFetch(key);
    if (!d || !d.s || !AU.ctx) { st.s = 'failed'; return false; }
    const ids = new Set(); SFX.of.set(key, ids);
    for (const id of Object.keys(d.s)) {
      if (SFX.state.get(key) !== st || !AU.ctx) return false; // paquet libéré pendant le décodage
      if (COARSE && +((id.match(/-(\d+)$/) || [])[1] || 0) > 2) continue; // téléphone : deux variantes par banque
      const v = d.s[id], b = await sfxDecode(sfxDecodeCtx(key, id), v[2]);
      if (!b || SFX.state.get(key) !== st) continue;
      const g = id.replace(/-\d+$/, '');
      let a = SFX.bank.get(g); if (!a) SFX.bank.set(g, a = []);
      a.push({ b, o: sfxLead(b, v[0], v[1], d.rate), d: v[0] / 48000, pk: v[1] / 48000 }); ids.add(g);
    }
    st.s = 'ready'; gpuLog('sfx ' + key + ': ' + ids.size + ' sons');
    return true;
  })();
  return st.p;
}
function sfxReady(key) { const st = SFX.state.get(key); return !!st && st.s === 'ready'; }
/* Libère un paquet (ambiance d'une carte quittée) */
function sfxUnload(key) {
  const ids = SFX.of.get(key);
  if (ids) for (const g of ids) { SFX.bank.delete(g); SFX.last.delete(g); }
  SFX.of.delete(key); SFX.state.delete(key);
}
/* Au démarrage du son : l'interface seulement (les menus) ; les paquets de la partie suivent si une partie a déjà été lancée */
function sfxBoot() {
  if (SFX.boot) return; SFX.boot = true;
  sfxLoad('ui');
  if (SFX.wantGame) sfxBootGame();
}
/* Paquets de la partie, l'un après l'autre (appelé au lancement d'une carte, une seule fois). Sans le paquet des armes, on
   revient aux tirs synthétisés (calculés seulement dans ce cas : ils pèsent une vingtaine de Mo en mémoire). */
function sfxBootGame() {
  if (SFX.game) return;
  if (!AU.ctx) { SFX.wantGame = true; return; } // le son n'a pas démarré (premier geste du joueur) : sfxBoot s'en chargera
  SFX.game = true;
  (async () => {
    for (const k of SFX_GAME.concat(['voix_' + (LANG === 'fr' ? 'fr' : 'en')])) {
      const ok = await sfxLoad(k);
      if (k === 'armes') { if (ok) sfxVerbSetup(); else gunBuffersBuild(false); }
    }
  })();
}
function sfxHas(id) { const a = SFX.bank.get(id); return !!(a && a.length); }
/* Une prise de la banque, jamais deux fois la même d'affilée */
function sfxPick(id) {
  const a = SFX.bank.get(id); if (!a || !a.length) return null;
  if (a.length === 1) return a[0];
  let i = Math.floor(Math.random() * a.length);
  if (i === SFX.last.get(id)) i = (i + 1) % a.length;
  SFX.last.set(id, i); return a[i];
}
/* Joue une prise de la banque id vers dest à l'instant t ; renvoie { s, g, e } (source, gain, prise) ou null si la banque n'est pas prête.
   o : rate (vitesse de lecture), gain, off (secondes sautées au début), loop (boucle à l'échantillon près), dur (arrêt au bout de dur s), e (prise imposée) */
function sfxPlay(id, dest, t, o) {
  o = o || {};
  const e = o.e || sfxPick(id); if (!e || !AU.ctx) return null;
  const ctx = AU.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = e.b; if (o.rate) s.playbackRate.value = o.rate;
  g.gain.value = o.gain === undefined ? 1 : o.gain;
  s.connect(g); g.connect(dest);
  if (o.loop) { s.loop = true; s.loopStart = e.o; s.loopEnd = e.o + e.d; s.start(t, e.o + ((o.off || 0) % e.d)); }
  else { s.start(t, e.o + Math.min(o.off || 0, e.d)); if (o.dur) s.stop(t + o.dur); }
  return { s, g, e };
}
/* Coupe une voix en fondu (constante de temps tau) à partir de t */
function sfxFadeOut(v, t, tau = 0.04) {
  if (!v) return;
  try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, tau); v.s.stop(t + tau * 8); } catch (e) { /* déjà arrêtée */ }
}

/* ---------- Réverbération : réponses impulsionnelles réelles ----------
   Une rue (claquement des façades) pour tout le jeu ; une salle en béton en plus sur ordinateur, que l'on entend à mesure qu'on
   entre sous un toit (VM.sky). Sur téléphone, une seule convolution, raccourcie. */
function sfxIR(id, max) {
  const e = sfxPick(id); if (!e) return null;
  const ctx = AU.ctx, sr = e.b.sampleRate, n = Math.min(Math.floor(e.d * sr), Math.floor(max * sr)), i0 = Math.floor(e.o * sr), fade = Math.floor(0.25 * sr);
  const ch = Math.min(2, e.b.numberOfChannels), out = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const src = e.b.getChannelData(Math.min(c, ch - 1)), d = out.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (src[i0 + i] || 0) * (i > n - fade ? (n - i) / fade : 1);
  }
  return out;
}
function sfxVerbSetup() {
  if (!AU.ctx || !AU.conv || AU.verbReal) return;
  if (AU.ctx.sampleRate !== (SFX.bank.get('ir_out') || [{ b: {} }])[0].b.sampleRate) return; // tampon décodé dans un autre contexte (banc audio)
  const out = sfxIR('ir_out', COARSE ? 1.2 : 1.8); if (!out) return;
  AU.conv.buffer = out; AU.verbReal = true;
  if (!COARSE && sfxHas('ir_in')) {
    const inb = sfxIR('ir_in', 1.6);
    if (inb) {
      const c = AU.ctx.createConvolver(); c.buffer = inb; AU.verbInG.connect(c); c.connect(AU.wpnG); AU.convIn = c;
    }
  }
}
/* Part de la réverbération d'intérieur (0 dehors, 1 sous un toit), lissée ; appelée à chaque image */
function sfxTick(dt) {
  if (!AU.ready) return;
  const inside = MATCH.state === 'playing' ? 1 - clamp(VM.sky === undefined ? 1 : VM.sky, 0, 1) : 0;
  AU.inside = (AU.inside || 0) + (inside - (AU.inside || 0)) * Math.min(1, dt * 4);
  // fondu des deux réverbérations (rue, salle) : une consigne seulement quand l'intérieur a changé d'au moins 2 %, et dix fois par seconde au plus
  // (setTargetAtTime à chaque image ajoutait 560 évènements par seconde aux deux lignes de temps à 280 images par seconde)
  if (AU.convIn && performance.now() - (AU.verbT || 0) > 100 && Math.abs(AU.inside - (AU.verbIn === undefined ? -1 : AU.verbIn)) > 0.02) {
    const t = AU.ctx.currentTime; AU.verbT = performance.now(); AU.verbIn = AU.inside;
    AU.verbOutG.gain.setTargetAtTime(1 - AU.inside * 0.7, t, 0.1); AU.verbInG.gain.setTargetAtTime(AU.inside * 1.1, t, 0.1);
  }
  annTick();
  ambTick(dt);
}

/* ---------- Annonces radio ----------
   Séries d'éliminations, objectifs : un court signal (stinger) et, si l'option « Annonces vocales » est
   cochée, une phrase radio (squelch, voix, fin de transmission) dans la langue du jeu. Une annonce à la fois : les autres
   attendent leur tour (au plus 4 s, sinon elles sont abandonnées). line à null : le signal seul (départ de la partie, 09y-decompte.js). */
const ANN = { q: [], until: 0, last: new Map() };
function sfxAnnounce(line, sting) {
  if (!AU.ready) return;
  const now = AU.ctx.currentTime;
  if (now - (ANN.last.get(line) || -9) < 2.5) return; // même annonce en double (deux événements pour la même série)
  ANN.last.set(line, now);
  let sg = null;
  if (sting && sfxHas(sting)) { sg = uiOut(0.8); sfxPlay(sting, sg, now + 0.02); }
  // après un signal musical, la voix attend que son attaque soit passée (sinon elle tombe dessus et on ne la comprend pas)
  if (line && Settings.voice !== false && sfxHas('v_' + line)) ANN.q.push({ line, t: now, at: now + (sg ? 0.45 : 0), sg });
}
function annTick() {
  if (!ANN.q.length) return;
  const now = AU.ctx.currentTime;
  if (now < ANN.until - 0.05 || now < ANN.q[0].at) return;
  const a = ANN.q.shift();
  if (now - a.t > 4) return;
  const o = uiOut(1.0), t = now + 0.03;
  // le signal s'efface sous la voix (-12 dB)
  if (a.sg) { const g = a.sg.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.2, t + 0.12); }
  sfxPlay('r_on', o, t, { gain: 0.55 });
  const v = sfxPlay('v_' + a.line, o, t + 0.12, { gain: 1.15 });
  const end = t + 0.12 + (v ? v.e.d : 0.8);
  sfxPlay('r_off', o, end + 0.04, { gain: 0.5 });
  ANN.until = end + 0.4;
}
