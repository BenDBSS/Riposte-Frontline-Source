/* Banc audio (facultatif) : rend hors ligne les sons du jeu (armes, touches, éliminations, impacts, bruitages de
   maniement, menus, explosions, séries, pas) avec le vrai code de la page, puis les mesure et les dessine. Les paquets
   d'échantillons (dist/sfx, voir tools/build_sfx.py) sont chargés et décodés d'abord ; --repli 1 mesure la synthèse
   de repli (sans paquets).

   Pour chaque son : fichier WAV 48 kHz stéréo, mesures (crête, niveau efficace sur les 100 premières ms, facteur de
   crête, centroïde spectral des 60 premières ms, durée jusqu'à -40 dB) et une planche PNG (forme d'onde et
   spectrogramme, 0 à 12 kHz) pour juger l'attaque, le corps et la queue sans écouter.

   Installation (une fois) :  cd tools/dev && npm install
   Usage (depuis la racine) :  node tools/dev/audio.js [version.html] [--sortie dossier] [--sons armes,touches,impacts,maniement,menus,explosions,series,pas] [--repli 1]
   Sans fichier : dist/riposte-frontline.html. Comparaison : l'ancienne page dans un dossier à côté des paquets de sons
   (mkdir -p /tmp/avant && git show HEAD:dist/riposte-frontline.html > /tmp/avant/avant.html && ln -sfn "$PWD/dist/sfx" /tmp/avant/sfx),
   puis lancer le banc sur chaque version avec une sortie différente ; un paquet introuvable est signalé (sa synthèse de repli
   serait mesurée à sa place). Chromium : celui de Playwright, ou la variable d'environnement CHROME. */
const path = require('path'), fs = require('fs');
const DEV = __dirname, ROOT = path.join(DEV, '..', '..');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.error('playwright-core introuvable : cd tools/dev && npm install'); process.exit(1); }

const opt = { sortie: path.join(ROOT, 'audio-out'), sons: 'armes,touches,impacts,maniement,menus,explosions,series,pas', repli: '' }, files = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) opt[a.slice(2)] = process.argv[++i]; else files.push(path.resolve(a));
}
if (!files.length) files.push(path.join(ROOT, 'dist', 'riposte-frontline.html'));
fs.mkdirSync(opt.sortie, { recursive: true });

/* Chaque son : nom, durée de rendu, code exécuté dans la page (le contexte audio de la page est remplacé par un contexte hors ligne) */
const SONS = {
  armes: [
    ...['rifle', 'smg', 'pistol', 'sniper', 'shotgun'].map((k) => [`tir-${k}-main`, 3.2, `sfxGun('${k}', null)`]),
    ...['rifle', 'smg', 'pistol', 'sniper', 'shotgun'].map((k) => [`tir-${k}-30m`, 3.2, `sfxGun('${k}', new V3(30, 1.6, 0))`]),
    ['tir-rifle-rafale', 3.0, `for (let i = 0; i < 8; i++) { T(i * 60 / 780); sfxGun('rifle', null); }`],
    ['tir-smg-rafale', 3.0, `for (let i = 0; i < 8; i++) { T(i * 60 / 900); sfxGun('smg', null); }`],
    ['tir-rifle-rafale-touches', 3.0, `for (let i = 0; i < 10; i++) { T(i * 60 / 780); sfxGun('rifle', null); if (i > 1 && i % 2) { sfxHit(false, false); } }`],
    ['tir-pistol-trois-coups', 3.0, `for (let i = 0; i < 3; i++) { T(i * 0.28); sfxGun('pistol', null); }`],
  ],
  touches: [
    ['touche', 0.6, 'sfxHit(false, false)'],
    ['touche-tete', 0.6, 'sfxHit(true, false)'],
    ['mort', 0.9, 'sfxHit(false, true)'],
    ['mort-tete', 0.9, 'sfxHit(true, true)'],
    ['mort-enchainee-2', 0.9, 'sfxHit(false, true, 2)'],
    ['mort-enchainee-3', 0.9, 'sfxHit(false, true, 3)'],
    ['mort-enchainee-5', 0.9, 'sfxHit(false, true, 5)'],
    ['subi', 0.9, 'sfxHurt(30)'],
    ['balle-frole', 0.6, 'sfxWhiz(new V3(1.2, 1.7, -3))'],
    ['bip-alerte', 0.8, 'sfxBeep(1800, 2)'],
    ['rebond-grenade', 0.6, 'sfxBounce(new V3(4, 0.5, 0))'],
    ['clic-grenade', 0.4, 'sfxClick(null, 2600, 0.15)'],
    ['pas-neige', 0.6, "sfxStep(null, 0.3, 'snow')"],
    ['pas-beton', 0.6, "sfxStep(null, 0.3, 'concrete')"],
  ],
  impacts: ['metal', 'concrete', 'wood', 'ground', 'snow', 'glass', 'flesh'].map((m) => [`impact-${m}`, 1.0, `sfxImpact(new V3(6, 1.5, 0), '${m}')`]),
  maniement: ['magout', 'magin', 'bolt', 'charge', 'pump', 'shell', 'empty', 'slap', 'pin', 'spoon', 'knife', 'throw', 'draw', 'stow', 'ads', 'pickup'].map((k) => [`mech-${k}`, 0.8, `sfxMech('${k}')`]),
  // sons d'interface : sfxUiPlay directement (sfxUi regroupe les appels d'un même instant et joue après un setTimeout)
  menus: ['hover', 'click', 'back', 'tab', 'tick', 'open', 'close', 'confirm', 'go', 'error', 'notify', 'equip', 'unequip', 'camo', 'locked', 'unlock'].map((k) => [`ui-${k}`, k === 'go' ? 2.2 : 1.0, `sfxUiPlay('${k}')`]),
  explosions: [
    ['explosion-6m', 3.5, 'sfxExplosion(new V3(6, 0.3, 0))'], ['explosion-25m', 3.5, 'sfxExplosion(new V3(25, 0.3, 0))'], ['explosion-70m', 4.0, 'sfxExplosion(new V3(70, 0.3, 0))'],
    ['plouf-grenade', 1.5, 'sfxPlunge(new V3(5, -0.5, 0), 0.4)'], ['explosion-eau', 3.0, 'sfxPlunge(new V3(8, -0.5, 0), 1)'], ['chute-corps', 1.0, 'sfxBodyFall(new V3(4, 0, 0))'],
  ],
  series: [
    ['fin-victoire', 4.6, "sfxMatchEnd('win')"], ['fin-defaite', 7.8, "sfxMatchEnd('loss')"], ['fin-egalite', 3.0, "sfxMatchEnd('draw')"], ['montee-niveau', 4.6, 'rankUpSound()'],
    ['annonce-uav', 3.0, "sfxAnnounce('uav_ready', 'st_ready'); annTick()"], ['annonce-frappe-ennemie', 3.0, "sfxAnnounce('air_enemy'); annTick()"],
    ['capture', 2.0, "sfxAnnounce('cap', 'st_capture')"], ['perte', 2.0, "sfxAnnounce('lost', 'st_lost')"], ['debut-partie', 2.5, "sfxAnnounce(null, 'st_start')"],
    ['terminal-appui', 1.0, "sfxKs('press')"], ['verrouillage', 1.0, "sfxKs('lock')"], ['bombe', 2.5, 'sfxBomb(new V3(10, 0, 0), 1.05)'],
  ],
  pas: ['concrete', 'gravel', 'grass', 'dirt', 'snow', 'metal', 'wood', 'water'].map((k) => [`pas-${k}`, 0.6, `sfxStep(null, 0.26, '${k}')`])
    .concat([['saut', 0.8, "sfxJump('concrete')"], ['reception', 0.8, "sfxLand('concrete', 1)"], ['glissade', 1.2, 'sfxSlide()'], ['subi-balle', 0.8, 'sfxHurt(30)'], ['coeur', 1.0, 'sfxHeart()']]),
};

async function main() {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const pg = await b.newPage({ bypassCSP: true, viewport: { width: 640, height: 360 } });
    await pg.addInitScript(`try{localStorage.setItem('dc_settings', JSON.stringify({quality:'low', sv:2, dynres:false}));localStorage.setItem('cod_seen_version','99')}catch(e){}`);
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
      if (u.includes('@pmndrs/assets@1.7.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (u.includes('peerjs')) return r.fulfill({ body: 'window.Peer=function(){};', contentType: 'application/javascript' });
      if (u.startsWith('file:')) return r.continue();
      return r.abort();
    });
    if (opt.repli) await pg.addInitScript('window.__repli = true');
    await pg.goto('file://' + files[0]);
    await pg.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 600000, polling: 500 });

    // outils du rendu dans la page : contexte hors ligne, mesures, planche
    await pg.evaluate(() => {
      window.__render = async (code, dur) => {
        const sr = 48000, off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
        const RealCtx = window.AudioContext;
        window.AudioContext = function () { return off; };
        AU.ctx = null; AU.ready = false; AU.gunBufs = {};
        if (window.__repli) for (const k of Object.keys(SFX_PACKS)) delete SFX_PACKS[k]; // synthèse de repli seule
        try { initAudio(); } finally { window.AudioContext = RealCtx; }
        // fanfare de montée de niveau : décodée par initAudio (rankUpPrepare), attendue avant de jouer (une seule fois, le tampon sert ensuite à chaque rendu)
        if (typeof rankUpPrepare === 'function') for (let k = 0; AU.rankBuf === null && AU.rankPending && k < 250; k++) await new Promise((r) => setTimeout(r, 20));
        // paquets d'échantillons : décodés une fois (les tampons servent d'un contexte à l'autre) ; réverbération réelle remise en place
        if (typeof SFX_GAME !== 'undefined') { for (const k of ['ui'].concat(SFX_GAME, ['voix_fr'])) await sfxLoad(k); sfxVerbSetup(); }
        if (typeof gunBuffersBuild === 'function' && !(typeof sfxReady === 'function' && sfxReady('armes'))) gunBuffersBuild(true);
        if (typeof ANN !== 'undefined') { ANN.q.length = 0; ANN.until = 0; ANN.last.clear(); } AU.hoverT = AU.lockT = -9; // horloges des sons à intervalle minimal
        camera.position.set(0, 1.6, 0); camera.updateMatrixWorld(true);
        AU.master.gain.value = 1; if (AU.wpnVol) AU.wpnVol.gain.value = 1; // armes : bus à part (05-audio.js)
        // T(s) décale l'horloge du contexte : les appels suivants démarrent s secondes plus tard (rafales)
        // (un son lancé exactement à t = 0 perd son attaque dans un contexte hors ligne : tout démarre à 50 ms)
        let shift = 0.05; Object.defineProperty(off, 'currentTime', { get: () => shift });
        const T = (s) => { shift = 0.05 + s; };
        new Function('T', 'V3', code)(T, V3); // les fonctions du jeu sont globales
        const buf = await off.startRendering();
        return { L: Array.from(buf.getChannelData(0)), R: Array.from(buf.getChannelData(1)), sr };
      };
    });

    const out = [];
    for (const cat of opt.sons.split(',')) {
      for (const [name, dur, code] of SONS[cat] || []) {
        const r = await pg.evaluate(async ([code, dur, name_]) => {
          const { L, R, sr } = await window.__render(code, dur);
          const n = L.length, mono = new Float32Array(n);
          for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) * 0.5;
          let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
          const rms = (a, b) => { let s = 0; const i0 = Math.floor(a * sr), i1 = Math.min(n, Math.floor(b * sr)); for (let i = i0; i < i1; i++) s += mono[i] * mono[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
          const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
          // premier instant sonore : début de la mesure (les tirs partent à t = 0, les retards sont inclus)
          // FFT radix 2
          const fft = (re, im) => { const N = re.length; for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
            for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, c = i + k + len / 2, tr = re[c] * cr - im[c] * ci, ti = re[c] * ci + im[c] * cr; re[c] = re[a] - tr; im[c] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } };
          const NF = 1024, hop = 256, win = new Float32Array(NF); for (let i = 0; i < NF; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (NF - 1));
          const frames = []; for (let s = 0; s + NF <= n; s += hop) { const re = new Float32Array(NF), im = new Float32Array(NF); for (let i = 0; i < NF; i++) re[i] = mono[s + i] * win[i]; fft(re, im); const m = new Float32Array(NF / 2); for (let k = 0; k < NF / 2; k++) m[k] = Math.hypot(re[k], im[k]); frames.push(m); }
          // centroïde sur les 60 premières ms après le premier son
          let t0 = 0; while (t0 < n && Math.abs(mono[t0]) < 0.01 * pk) t0++;
          let num = 0, den = 0; for (let f = Math.floor(t0 / hop); f < Math.min(frames.length, Math.floor((t0 + 0.06 * sr) / hop) + 1); f++) for (let k = 1; k < NF / 2; k++) { num += k * (sr / NF) * frames[f][k]; den += frames[f][k]; }
          // part de l'énergie spectrale au-dessus de 3 kHz (les « petits sons aigus »)
          let eHi = 0, eAll = 0; for (const f of frames) for (let k = 1; k < NF / 2; k++) { const e = f[k] * f[k]; eAll += e; if (k * sr / NF > 3000) eHi += e; }
          // durée jusqu'à -40 dB sous la crête
          let tEnd = 0; for (let i = n - 1; i >= 0; i--) if (Math.abs(mono[i]) > pk * 0.01) { tEnd = i; break; }
          // planche : forme d'onde et spectrogramme
          const W = 640, H = 170, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
          g.fillStyle = '#10141a'; g.fillRect(0, 0, W, H);
          const wv = 50; g.fillStyle = '#7fd1ff';
          for (let x = 0; x < W; x++) { const a = Math.floor(x / W * n), b = Math.floor((x + 1) / W * n); let lo = 0, hi = 0; for (let i = a; i < b; i++) { lo = Math.min(lo, mono[i]); hi = Math.max(hi, mono[i]); } g.fillRect(x, wv / 2 - hi * wv / 2 * 0.95, 1, Math.max(1, (hi - lo) * wv / 2 * 0.95)); }
          const img = g.createImageData(W, H - wv - 2), kmax = Math.floor(12000 / (sr / NF));
          let mx = 0; for (const f of frames) for (let k = 0; k < kmax; k++) mx = Math.max(mx, f[k]);
          for (let y = 0; y < img.height; y++) for (let x = 0; x < W; x++) {
            const f = frames[Math.min(frames.length - 1, Math.floor(x / W * frames.length))], k = Math.floor((1 - y / img.height) * kmax);
            const v = Math.max(0, Math.min(1, (20 * Math.log10(f[k] / mx + 1e-6) + 70) / 70)), o = (y * W + x) * 4;
            img.data[o] = 255 * Math.min(1, v * 2.2); img.data[o + 1] = 255 * Math.max(0, Math.min(1, v * 2.2 - 0.7)); img.data[o + 2] = 255 * (v < 0.5 ? v * 1.6 : 1 - (v - 0.5) * 1.2); img.data[o + 3] = 255;
          }
          g.putImageData(img, 0, wv + 2);
          g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(name_ + '  ' + n / sr + ' s', 4, 12);
          const i16 = new Int16Array(n * 2); for (let i = 0; i < n; i++) { i16[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
          let bin = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
          return { peak: db(pk), rms100: db(rms(t0 / sr, t0 / sr + 0.1)), rms500: db(rms(t0 / sr, t0 / sr + 0.5)), crest: db(pk) - db(rms(t0 / sr, t0 / sr + 0.1)), centroid: Math.round(num / Math.max(den, 1e-9)), hf: Math.round(100 * eHi / Math.max(eAll, 1e-12)), t40: +(tEnd / sr).toFixed(2), png: cv.toDataURL('image/png'), wav: btoa(bin), sr, n };
        }, [code, dur, name]).catch((e) => ({ error: String(e) }));
        if (r.error) { console.error(name, r.error); continue; }
        // WAV 16 bits
        const pcm = Buffer.from(r.wav, 'base64'), hdr = Buffer.alloc(44);
        hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
        hdr.writeUInt32LE(r.sr, 24); hdr.writeUInt32LE(r.sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
        fs.writeFileSync(path.join(opt.sortie, name + '.wav'), Buffer.concat([hdr, pcm]));
        fs.writeFileSync(path.join(opt.sortie, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
        out.push({ name, peak: +r.peak.toFixed(1), rms100: +r.rms100.toFixed(1), crest: +r.crest.toFixed(1), centroid: r.centroid, hf: r.hf, t40: r.t40 });
      }
    }
    const absents = await pg.evaluate(() => (typeof SFX === 'undefined' ? [] : [...SFX.state].filter(([, st]) => st.s === 'failed').map(([k]) => k)));
    if (absents.length && !opt.repli) console.error(`Paquets de sons introuvables (${absents.join(', ')}) : leur synthèse de repli est mesurée à leur place. La page doit être à côté de dist/sfx (voir l'en-tête).`);
    console.log('son'.padEnd(26) + 'crête dB'.padStart(9) + 'eff.100ms'.padStart(10) + 'crête/eff'.padStart(10) + 'centroïde Hz'.padStart(13) + '> 3 kHz %'.padStart(11) + 'durée s'.padStart(9));
    for (const o of out) console.log(o.name.padEnd(26) + String(o.peak).padStart(9) + String(o.rms100).padStart(10) + String(o.crest).padStart(10) + String(o.centroid).padStart(13) + String(o.hf).padStart(11) + String(o.t40).padStart(9));
    fs.writeFileSync(path.join(opt.sortie, 'mesures.json'), JSON.stringify(out, null, 1));
    if (errors.length) console.error('Erreurs de la page :\n' + errors.join('\n'));
  } finally { await b.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
