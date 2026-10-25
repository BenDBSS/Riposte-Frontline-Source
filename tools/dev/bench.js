/* Banc de mesure du rendu (facultatif), pour vérifier qu'un changement ne coûte pas plus cher qu'avant.

   Charge une ou plusieurs versions construites du jeu dans Chromium sans interface, avec le rendu logiciel
   SwiftShader, lance une partie, la fige, place les soldats devant la caméra et chronomètre chaque passe du rendu
   (synchronisation GPU après chaque passe) depuis quatre points de vue fixes. SwiftShader calcule sur le processeur
   ce que ferait une carte graphique : les millisecondes n'ont rien à voir avec celles d'un vrai GPU, mais les
   proportions (nombre de pixels × coût des shaders, sommets) suivent celles d'une puce intégrée. On compare donc
   deux versions entre elles, dans les mêmes conditions, jamais des chiffres isolés.

   Installation (une fois) :  cd tools/dev && npm install
   Usage (depuis la racine) :  node tools/dev/bench.js [version.html ...] [--qualite medium] [--taille 1280x720]
                               [--images 4] [--vues rue,place,soleil,toit] [--carte sable] [--herbe 0]   (vue souk : sous les toiles du souk de Khamsin)
   --herbe 0 : réglage « Herbe en relief » coupé (coût des brins d'herbe : même version mesurée avec et sans).
   Sans fichier : dist/riposte-frontline.html. Avec deux fichiers, la seconde colonne donne l'écart en %. Pour comparer
   à la version publiée : git show HEAD:dist/riposte-frontline.html > /tmp/avant.html, puis
   node tools/dev/bench.js /tmp/avant.html dist/riposte-frontline.html.
   Chromium : celui de Playwright, ou le chemin donné par la variable d'environnement CHROME. */
const path = require('path'), fs = require('fs');
const DEV = __dirname, ROOT = path.join(DEV, '..', '..');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.error('playwright-core introuvable : cd tools/dev && npm install'); process.exit(1); }

const opt = { qualite: 'medium', taille: '1280x720', images: '4', vues: 'rue,place,soleil,toit', carte: 'sable', herbe: '1' }, files = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) opt[a.slice(2)] = process.argv[++i]; else files.push(path.resolve(a));
}
if (!files.length) files.push(path.join(ROOT, 'dist', 'riposte-frontline.html'));
const [W, H] = opt.taille.split('x').map(Number), N = Math.max(1, +opt.images);
const LABELS = { DepthPrepass: 'pré-passe', ScenePass: 'scène', RenderPass: 'arme', SSAOPass: 'occlusion', UnrealBloomPass: 'halo', RaysPass: 'rayons', ShaderPass: 'finale' };

async function measure(file) {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const pg = await b.newPage({ bypassCSP: true, viewport: { width: W, height: H } });
    await pg.addInitScript(`try{localStorage.setItem('dc_settings', JSON.stringify({quality:${JSON.stringify(opt.qualite)}, sv:2, dynres:false, grass:${opt.herbe !== '0'}}));localStorage.setItem('cod_seen_version','99')}catch(e){}window.MATCH_COUNTDOWN=0`); // (sans décompte du départ : la partie est figée tout de suite)
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
    // bibliothèques servies depuis tools/dev/node_modules (mêmes versions que jsDelivr), rien d'autre ne sort
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
      if (u.includes('@pmndrs/assets@1.7.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (u.includes('peerjs')) return r.fulfill({ body: 'window.Peer=function(){};', contentType: 'application/javascript' });
      if (u.startsWith('file:')) return r.continue();
      return r.abort();
    });
    const t0 = Date.now();
    await pg.goto('file://' + file);
    await pg.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 600000, polling: 500 });
    const load = (Date.now() - t0) / 1000;
    // la carte n'est construite qu'au lancement d'une partie (les versions plus anciennes la construisaient au démarrage)
    const tMap = Date.now();
    await pg.evaluate((id) => (typeof mapEnsure === 'function' ? mapEnsure(id) : null), opt.carte);
    const mapLoad = (Date.now() - tMap) / 1000;
    const res = await pg.evaluate(({ N, views }) => {
      const gl = renderer.getContext();
      // synchronisation réelle avec le GPU : barrière puis lecture d'un pixel d'une petite cible à part
      const fb = gl.createFramebuffer(), tex = gl.createTexture(), px = new Uint8Array(4);
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); renderer.state.reset();
      const sync = () => { const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev); };
      startMatch();
      // armes (et donc tenues) des bots fixées : le tirage de botArmForMap est aléatoire, et d'une version à l'autre la caméra verrait d'autres modèles
      const ARMS = ['m4', 'ak47', 'mp5', 'scarh', 'l96', 'ump45', 'famas', 'rem870', 'mp7', 'm4', 'svd'];
      entities.filter((e) => !e.isPlayer).forEach((b, i) => {
        const def = WEAPONS[ARMS[i % ARMS.length]]; if (!def) return;
        if (b.weapon !== def) { b.weapon = def; setSoldierGun(b.model, def.key); }
        if (typeof skinOfWeapon === 'function') { b.skin = skinOfWeapon(def); soldierLook(b.model, b.skin, skinRel(b)); }
      });
      // partie figée : la boucle d'animation ne rend plus rien (état « menu »), on pilote le rendu ici
      for (const e of entities) if (!e.isPlayer) e.respawnT = 1e9;
      MATCH.state = 'menu'; UI.screen = 'main';
      // point de vue « soleil » : premier endroit dégagé (tirage fixe) d'où l'on voit le soleil
      // carte en relief (dunes, versions qui en ont) : les hauteurs des points de vue et des soldats se comptent au-dessus du sable
      const g0 = (x, z) => (typeof gy0 === 'function' ? gy0(x, z) : 0), up = (p) => [p[0], p[1] + g0(p[0], p[2]), p[2]];
      const r = mulberry32(3); let sun = null;
      for (let i = 0; i < 4000 && !sun; i++) {
        const x = lerp(MAP.x0 + 3, MAP.x1 - 3, r()), z = lerp(MAP.z0 + 3, MAP.z1 - 3, r()), g = g0(x, z);
        if (Math.abs(groundHeight(x, z, g + 3, 0.2) - g) < 0.05 && !rayWorld(x, g + 1.7, z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 200)) sun = [x, z];
      }
      const ALL = {
        rue: [[0, 1.7, 20], [0, 1.6, -10]],
        place: [[-12, 1.7, 0], [15, 2, 5]],
        soleil: sun ? [[sun[0], 1.7, sun[1]], [sun[0] + SUN_DIR.x * 10 + 3, 1.7 + SUN_DIR.y * 10 - 0.6, sun[1] + SUN_DIR.z * 10]] : [[0, 1.7, 20], [0, 1.6, -10]],
        toit: [[5, 9, 12], [-10, 2, -10]],
        souk: [[7, 1.7, 3.6], [15, 2.6, -2.5]], // (Khamsin) sous les toiles tendues du souk : --vues souk
      };
      const T = {};
      const wrap = (obj, key, label) => { const f = obj[key].bind(obj); obj[key] = function (...a) { sync(); const t = performance.now(); const out = f(...a); sync(); T[label] = (T[label] || 0) + performance.now() - t; return out; }; };
      composer.passes.forEach((p) => wrap(p, 'render', p.constructor.name));
      wrap(renderer.shadowMap, 'render', 'ombres');
      const bots = entities.filter((e) => !e.isPlayer), out = [];
      for (const name of views) {
        const v0 = ALL[name]; if (!v0) continue;
        const v = v0.map(up);
        camera.position.set(...v[0]); camera.lookAt(...v[1]);
        const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
        // soldats répartis devant la caméra, de 6 à 41 m
        bots.forEach((e, i) => {
          const d = 6 + i * 3.5, s = (i % 2 ? 1 : -1) * (1 + i * 0.4);
          e.alive = true; e.model.root.visible = true; e.yaw = Math.atan2(f.x, f.z);
          const ex = v[0][0] + f.x * d - f.z * s, ez = v[0][2] + f.z * d + f.x * s;
          e.pos.set(ex, g0(ex, ez), ez);
          for (let k = 0; k < 10; k++) animSoldier(e, 0.03);
        });
        const times = []; let calls = 0, tris = 0;
        for (let i = 0; i < N + 2; i++) {
          if (i === 2) for (const k in T) delete T[k]; // deux images de chauffe (compilations, cartes d'ombre)
          renderer.info.reset(); updatePostFx(); sky.position.copy(camera.position); updateSoldierLods(); updateShadows();
          if (typeof grassUpdate === 'function') grassUpdate(i * 0.016); // brins d'herbe des pelouses (versions qui en ont)
          sync(); const t = performance.now(); composer.render(0.016); sync();
          if (i >= 2) times.push(performance.now() - t);
          calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
        }
        times.sort((a, b) => a - b);
        const per = {}; for (const k in T) per[k] = T[k] / N;
        out.push({ name, ms: times[times.length >> 1], calls, ktris: Math.round(tris / 1000), per });
      }
      return { out, tier: RQ.tier, rpr: renderPixelRatio(), programs: renderer.info.programs.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, build: (document.querySelector('meta[name="cod-build"]') || {}).content };
    }, { N, views: opt.vues.split(',') });
    return Object.assign(res, { load, mapLoad, errors, file });
  } finally { await b.close(); }
}

const pct = (a, b) => (a > 0 ? `${b >= a ? '+' : ''}${Math.round((b / a - 1) * 100)} %` : '');
(async () => {
  const R = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error('introuvable : ' + f); process.exit(1); }
    process.stdout.write(`mesure de ${path.relative(process.cwd(), f)}… `);
    const r = await measure(f); R.push(r);
    console.log(`démarrage ${r.load.toFixed(1)} s${r.mapLoad > 0.5 ? `, carte ${r.mapLoad.toFixed(1)} s` : ''}, profil ${r.tier}, rendu x${r.rpr}, ${r.programs} programmes, ${r.textures} textures, ${r.geometries} géométries`);
    if (r.errors.length) console.log('  erreurs :\n  ' + r.errors.slice(0, 5).join('\n  '));
  }
  console.log(`\nSwiftShader ${W}x${H}, qualité ${opt.qualite}, médiane de ${N} images (ms : proportions, pas des i/s réelles)`);
  const A = R[0], B = R[1];
  for (let i = 0; i < A.out.length; i++) {
    const a = A.out[i], b = B && B.out[i];
    const line = (o) => { const p = o.per, scene = (p.ScenePass || 0) - (p.ombres || 0); return [['image', o.ms], ['ombres', p.ombres], ['scène', scene], ...Object.keys(LABELS).filter((k) => k !== 'ScenePass' && p[k] !== undefined).map((k) => [LABELS[k], p[k]])]; };
    const la = line(a), lb = b ? line(b) : null;
    console.log(`\n${a.name.padEnd(8)} ${a.calls} appels, ${a.ktris} k triangles` + (b ? `  →  ${b.calls} appels, ${b.ktris} k triangles (${pct(a.ktris, b.ktris)})` : ''));
    la.forEach(([k, v], j) => console.log(`  ${k.padEnd(10)} ${v.toFixed(1).padStart(8)} ms` + (lb ? `  →  ${lb[j][1].toFixed(1).padStart(8)} ms  ${pct(v, lb[j][1]).padStart(6)}` : '')));
  }
})().catch((e) => { console.error(e); process.exit(1); });
