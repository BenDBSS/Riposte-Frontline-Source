/* ==========================================================================
   FOND ANIMÉ DES MENUS : l'illustration 21:9 (assets/menu-bg.webp, variable CSS --key-art de #menuBg posée par le socle de la page) et sa
   carte de profondeur (assets/menu-depth.webp, window.SOCLE.depth : voir build.py), dessinées par un seul triangle plein écran dans la toile du jeu, pendant la boucle d'images
   (frame, 09-game.js), tant qu'un écran de menu est affiché.
   - Parallaxe : la caméra fait une boucle de 24 s sur une courbe de Lissajous (et suit un peu la souris) autour du soldat, qui reste le plan
     fixe : seuls le ciel (de 0,6 % de la largeur au plus) et un peu les rochers de devant se décalent, selon leur profondeur (quatre lectures
     de la carte de profondeur, dilatée de 24 px puis floutée à la préparation : la transition tombe dans les nuages, autour de la silhouette,
     et le soldat ne se déchire pas), avec un travelling avant et arrière de 40 s (3,5 à 4,7 % d'agrandissement) qui garde toujours une marge
     sous les décalages.
   - Fumée : deux couches d'un bruit raccordable (texture de 128 px calculée au démarrage), qui défilent en sens contraires, plus dense en bas ;
     elle prend la couleur du halo de l'image (copie de 96 px de large, floue) : jaune devant la lumière, grise ailleurs.
   - Braises : trois couches de cellules tirées au hasard qui montent en dérivant, scintillent et naissent surtout près de la lumière.
   Coût : 8 lectures de texture et un peu de calcul par pixel, aucune cible de rendu, aucune carte d'ombre, 4 unités de texture ; 30 images par
   seconde au doigt et sur les sous-écrans (le mouvement est lent), rien pendant le chargement d'une carte (MAPL.state) ni à la vue aérienne.
   Repli : l'image fixe de #menuBg (CSS, cover) tant que le fond n'a pas été dessiné, si le contexte WebGL est perdu, en mode graphique
   économique. Mouvement réduit (prefers-reduced-motion) : image fixe dessinée une fois, sans fumée qui bouge ni braises.
   Le soldat est vers 72 % de la largeur de l'image : sur un écran moins large que 21:9, le cadrage le place à 70 % de la largeur de l'écran
   (MBG_FOCUS), les boutons gardent le ciel sombre de la gauche ; sur un écran plus large, l'image est rognée en haut et en bas.
   ========================================================================== */
const MENU_DEPTH = (window.SOCLE || {}).depth || ''; // socle (build.py)
const MBG = { scene: null, cam: null, mat: null, ready: false, failed: false, t: 0, acc: 0, live: false, px: 0, py: 0, mx: 0, my: 0, drawn: '' };
const MBG_IMG_A = 1916 / 821; // proportions de l'illustration (21:9)
const MBG_FOCUS = { x: 0.72, at: 0.7 }; // soldat : 72 % de la largeur de l'image, placé à 70 % de la largeur de l'écran
const MBG_VS = `varying vec2 vS;
void main() { vS = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const MBG_FS = `uniform sampler2D tCol, tDep, tGlow, tNoise;
uniform vec4 uMap; // cadrage : échelle et décalage de l'écran (0..1) vers l'image
uniform vec2 uPar, uRes; uniform float uZoom, uT, uFx, uMove, uShade;
varying vec2 vS;
float h12(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// une couche de braises : cellules de taille 1/k (hauteur de l'écran), une sur huit allumée, qui monte à la vitesse v en dérivant
vec3 ember(vec2 q, float k, float v, float s) {
  vec2 p = q * k; p.y -= uT * v; p.x -= uT * v * 0.35 + sin(p.y * 0.7 + s) * 0.3;
  vec2 c = floor(p), f = fract(p); float h = h12(c + s);
  if (h < 0.875) return vec3(0.0);
  vec2 o = vec2(h12(c + s + 7.13), h12(c + s + 3.71)) * 0.6 + 0.2;
  float r = (0.05 + 0.06 * h12(c + 1.7)) * (8.0 / k), fl = 0.55 + 0.45 * sin(uT * (2.0 + h * 9.0) + h * 61.0);
  float life = smoothstep(0.0, 0.25, fract(h * 13.7 + uT * 0.05)) * smoothstep(1.0, 0.7, fract(h * 13.7 + uT * 0.05));
  return mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.88, 0.45), h12(c + 9.1)) * smoothstep(r, r * 0.2, length(f - o)) * fl * life;
}
void main() {
  vec2 uv = uMap.xy * vS + uMap.zw;
  uv = (uv - vec2(0.72, 0.45)) / uZoom + vec2(0.72, 0.45);
  // parallaxe : décalage proportionnel à l'écart de profondeur au plan de mise au point (0,65 : le soldat, qui ne bouge pas), cherché par
  // approximations successives (quatre lectures : la profondeur prise là où le pixel vient vraiment, sans déchirure au bord du soldat)
  vec2 u = uv;
  for (int i = 0; i < 4; i++) u = clamp(uv + uPar * (texture2D(tDep, u).r - 0.65), 0.002, 0.998);
  vec3 col = texture2D(tCol, u).rgb;
  vec3 glow = texture2D(tGlow, u).rgb;
  // fumée : deux couches de bruit, plus dense au sol, teintée par le halo de l'image
  float A = uRes.x / uRes.y; vec2 q = vS * vec2(A, 1.0);
  float n1 = texture2D(tNoise, q * 0.42 + vec2(uT * 0.016, -uT * 0.005)).r;
  float n2 = texture2D(tNoise, q * 1.05 + vec2(-uT * 0.024, uT * 0.008) + n1 * 0.35).g;
  float sm = smoothstep(0.38, 0.95, n1 * 0.62 + n2 * 0.5);
  float dens = sm * (0.22 + 0.78 * (1.0 - smoothstep(0.0, 0.6, vS.y))) * uFx;
  vec3 smoke = vec3(0.055, 0.05, 0.04) + glow * 1.35;
  col = mix(col, smoke, dens * 0.42) + glow * dens * 0.16;
  // braises : surtout près de la lumière
  float lum = dot(glow, vec3(0.3, 0.55, 0.15));
  vec3 e = ember(q, 7.0, 0.11, 1.0) + ember(q, 11.0, 0.075, 4.0) * 0.8 + ember(q, 17.0, 0.05, 9.0) * 0.55;
  col += e * uFx * uMove * (0.25 + 1.6 * lum);
  // vignette légère et grain contre les paliers des dégradés sombres
  vec2 v = (vS - 0.5) * vec2(1.0, 1.2);
  col *= 1.0 - 0.28 * smoothstep(0.35, 0.95, length(v));
  col += (texture2D(tNoise, gl_FragCoord.xy / 128.0).b - 0.5) / 160.0;
  // voile des sous-écrans (celui de .ui-shade, shell.html), posé ici quand l'aperçu de l'écran Tenues se dessine par-dessus le fond
  float sa = vS.x < 0.5 ? mix(0.9, 0.76, vS.x * 2.0) : mix(0.76, 0.6, vS.x * 2.0 - 1.0);
  col = mix(col, vec3(0.0157, 0.0196, 0.0157), sa * uShade);
  gl_FragColor = vec4(col, 1.0);
}`;
/* Bruit raccordable de 128 x 128 : R et G deux fbm de bruit de valeur (périodes 4 à 32 cases), B un bruit blanc (grain) */
function mbgNoise() {
  const N = 128, d = new Uint8Array(N * N * 4);
  const fbm = (seed) => {
    const out = new Float32Array(N * N);
    let amp = 0.5, tot = 0;
    for (const g of [4, 8, 16, 32]) {
      const lat = new Float32Array(g * g); for (let i = 0; i < lat.length; i++) lat[i] = mbgHash(i * 7.31 + seed * 131.7 + g * 17.9);
      const s = N / g;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
        const a = lat[y0 * g + x0], b = lat[y0 * g + x1], c = lat[y1 * g + x0], e = lat[y1 * g + x1];
        out[y * N + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy);
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  };
  const r = fbm(1), g = fbm(2);
  for (let i = 0; i < N * N; i++) { d[i * 4] = r[i] * 255; d[i * 4 + 1] = g[i] * 255; d[i * 4 + 2] = mbgHash(i * 3.17 + 0.5) * 255; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function mbgHash(x) { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
function mbgTex(src) { const t = new THREE.Texture(src); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; }
function mbgLoad(url) { return new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = url; }); }
/* Le mouvement : ni en mode économique, ni quand le système demande moins d'animations */
function mbgMotion() { return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); }
async function mbgInit() {
  if (MBG.scene || MBG.failed) return;
  if (Settings.gfxSafe || !MENU_DEPTH) { MBG.failed = true; return; }
  const m = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle($('menuBg')).backgroundImage || '');
  if (!m) { MBG.failed = true; return; }
  MBG.scene = new THREE.Scene(); // réservé tout de suite : un seul appel
  try {
    const [ci, di] = await Promise.all([mbgLoad(m[1]), mbgLoad(MENU_DEPTH)]);
    // halo : l'image réduite à 96 px de large (deux réductions successives, qui la floutent), lue en filtrage linéaire
    const c1 = document.createElement('canvas'); c1.width = 240; c1.height = Math.round(240 / MBG_IMG_A);
    c1.getContext('2d').drawImage(ci, 0, 0, c1.width, c1.height);
    const c2 = document.createElement('canvas'); c2.width = 48; c2.height = Math.round(48 / MBG_IMG_A);
    c2.getContext('2d').drawImage(c1, 0, 0, c2.width, c2.height);
    MBG.mat = new THREE.ShaderMaterial({
      uniforms: { tCol: { value: mbgTex(ci) }, tDep: { value: mbgTex(di) }, tGlow: { value: mbgTex(c2) }, tNoise: { value: mbgNoise() },
        uMap: { value: new THREE.Vector4(1, 1, 0, 0) }, uPar: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) },
        uZoom: { value: 1.02 }, uT: { value: 0 }, uFx: { value: 1 }, uMove: { value: 1 }, uShade: { value: 0 } },
      vertexShader: MBG_VS, fragmentShader: MBG_FS, depthTest: false, depthWrite: false,
    });
    // un triangle qui couvre l'écran (moins de travail aux bords que deux triangles)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new THREE.Mesh(g, MBG.mat); mesh.frustumCulled = false;
    MBG.scene.add(mesh); MBG.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    canvas.addEventListener('webglcontextlost', () => mbgFail(), false);
    if (!COARSE) addEventListener('pointermove', (e) => { MBG.mx = e.clientX / Math.max(1, innerWidth) - 0.5; MBG.my = e.clientY / Math.max(1, innerHeight) - 0.5; }, { passive: true });
    MBG.ready = true;
  } catch (e) { MBG.failed = true; }
}
function mbgFail() { MBG.failed = true; MBG.live = false; const el = $('menuBg'); if (el) el.classList.remove('gl'); }
/* Dessine le fond (appelée par frame tant qu'un menu est affiché) ; rend la main sans rien faire si le fond n'est pas prêt ou n'a pas lieu d'être */
const _mbgV = new THREE.Vector4(), _mbgS = new THREE.Vector2();
/* Dessine le fond (vrai s'il a été dessiné à cette image : l'aperçu de l'écran Tenues se dessine alors par-dessus, 09u-tenues.js) */
function mbgDraw(dt) {
  if (!MBG.ready || MBG.failed) return;
  if (MAPL.state === 'loading' || UI.busy || gpuLostNow()) return; // chargement d'une carte : le GPU est à elle (barrières, compilation)
  const main = UI.screen === 'main', U = MBG.mat.uniforms, move = mbgMotion();
  // cadence : celle de l'écran au menu principal sur ordinateur, 30 images par seconde au doigt et sur les sous-écrans ; l'écran Tenues,
  // dont le soldat animé est dessiné avec le fond (09u-tenues.js), celle de l'écran sur ordinateur et 60 au plus au doigt (à 30, sa marche
  // se voyait saccadée ; 1/72 : une image à chaque rafraîchissement à 60 Hz malgré l'irrégularité des horodatages, une sur deux à 120 Hz)
  MBG.acc += dt;
  const sk = UI.screen === 'skins' && SKV.live, step = (main || sk) && !TOUCH.on ? 0 : sk ? 1 / 72 : 1 / 31;
  renderer.getDrawingBufferSize(_mbgS);
  const key = _mbgS.x + 'x' + _mbgS.y;
  if (!move) { if (MBG.drawn === key) return; } // mouvement réduit : une image fixe, redessinée si la taille change
  else if (MBG.acc < step && MBG.drawn === key) return;
  const d = Math.min(MBG.acc, 0.1); MBG.acc = 0;
  if (move) MBG.t += d;
  // cadrage « cover » qui garde le soldat à MBG_FOCUS.at de la largeur de l'écran
  const A = _mbgS.x / Math.max(1, _mbgS.y);
  if (A < MBG_IMG_A) { const w = A / MBG_IMG_A, x0 = clamp(MBG_FOCUS.x - w * MBG_FOCUS.at, 0, 1 - w); U.uMap.value.set(w, 1, x0, 0); }
  else { const h = MBG_IMG_A / A; U.uMap.value.set(1, h, 0, (1 - h) / 2); }
  // dérive de la caméra (Lissajous lent) et un peu la souris, amortie ; moitié moins sur les sous-écrans
  // boucle de caméra de 24 s (Lissajous : aller-retour latéral, montée et descente plus lentes) ; le ciel (profondeur 0) se décale de
  // 0,009 x 0,65 = 0,6 % de la largeur de l'image au plus, le soldat pas du tout ; deux fois moins sur les sous-écrans
  const t = MBG.t, k = main ? 1 : 0.45, a = 0.009 * k, w = (Math.PI * 2) / 24;
  MBG.px = damp(MBG.px, MBG.mx, 1.5, d); MBG.py = damp(MBG.py, MBG.my, 1.5, d);
  U.uPar.value.set(a * (0.8 * Math.sin(t * w) + 0.2 * Math.sin(t * w * 2.5 + 1.1)) - MBG.px * 0.004 * k, a * 0.45 * Math.sin(t * w * 0.75 + 2.3) + MBG.py * 0.003 * k);
  // léger travelling avant et arrière (40 s), qui garde aussi une marge sous les décalages (au plus (0,009 + 0,004) x 0,65 = 0,0085)
  U.uZoom.value = 1.035 + 0.012 * (0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / 40 - 1.2)); // (3,5 % au moins : marge de 0,28 x 0,034 = 0,0095 au bord droit, le zoom est centré sur le soldat)
  U.uT.value = t; U.uRes.value.copy(_mbgS);
  U.uFx.value = main ? 1 : 0.7; U.uMove.value = move ? 1 : 0;
  U.uShade.value = UI.screen === 'skins' && SKV.live ? 1 : 0; // (le voile CSS est alors retiré : il assombrirait l'aperçu)
  renderer.getViewport(_mbgV);
  renderer.setRenderTarget(null); renderer.setViewport(0, 0, VIEW.w, VIEW.h);
  renderer.render(MBG.scene, MBG.cam);
  renderer.setViewport(_mbgV);
  MBG.drawn = key;
  if (!MBG.live) { MBG.live = true; $('menuBg').classList.add('gl'); }
  return true;
}
/* Retour aux menus (menuBgShow) : la toile montre encore la dernière image du jeu, le fond est à redessiner tout de suite */
function mbgShown() { MBG.drawn = ''; MBG.acc = 1; }
