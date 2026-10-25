/* Contour d'une photo sur le modèle d'une arme : l'arme seule (sans mains) est rendue de profil, vue presque orthographique (champ de 3°),
   à l'échelle de la photo et sur sa grille de pixels ; le pourtour de la photo est tracé en rouge par-dessus. Pour refaire un modèle d'après
   une vraie arme et vérifier, à chaque retouche, qu'il en suit la silhouette.
   node contour.js --arme glock18 --photo profil.png --mmpx 0.13 --ancre 1406,560,0.012,-0.008 [--cote gauche|droite] [--acc red,sil]
                   [--tol 40] [--sortie contour-glock18.png]
   --photo  : vue de profil de l'arme (PNG, JPEG ou WebP) ; le fond est la transparence de l'image si elle en a, sinon la couleur de ses coins
              (--tol : écart de couleur toléré, 40 par défaut). La photo reste hors du dépôt.
   --mmpx   : échelle de la photo (mm par pixel), d'ordinaire calée sur une longueur connue de la vraie arme.
   --ancre  : px,py,z,y : le pixel (px, py) de la photo est le point (z, y) du repère de l'arme (z vers l'arrière, y vers le haut).
   --cote   : gauche (défaut, bouche à gauche de la photo) ou droite (bouche à droite).
   Sortie : <sortie> (rendu et contour rouge de la photo) et <sortie>-ecarts.png (en bleu, la photo que le modèle ne couvre pas ; en
   orange, le modèle qui dépasse de la photo) ; le recouvrement des deux silhouettes et les surfaces des écarts (mm²) sont affichés. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const id = opt('arme', ''), photo = opt('photo', ''), mmpx = +opt('mmpx', '0'), ancre = opt('ancre', '').split(',').map(Number);
const cote = opt('cote', 'gauche'), acc = opt('acc', ''), tol = +opt('tol', '40'), out = opt('sortie', `contour-${id}.png`);
if (!id || !photo || !(mmpx > 0) || ancre.length !== 4 || ancre.some((v) => !Number.isFinite(v))) {
  console.error('usage : node contour.js --arme <id> --photo <image> --mmpx <mm par pixel> --ancre px,py,z,y [--cote gauche|droite] [--acc a,b] [--tol 40] [--sortie f.png]');
  process.exit(2);
}
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(photo).toLowerCase()] || 'image/png';
const photoURL = `data:${mime};base64,${fs.readFileSync(photo).toString('base64')}`;
(async () => {
  // taille de la photo (la page du jeu sert aussi à la lire)
  let { browser, page } = await openGame({ w: 640, h: 360, settings: { quality: 'low', dynres: false }, noMap: true, noHdri: true, gate: true });
  const [W, H] = await page.evaluate(async (u) => { const im = new Image(); im.src = u; await im.decode(); return [im.naturalWidth, im.naturalHeight]; }, photoURL);
  await browser.close();
  ({ browser, page } = await openGame({ w: W, h: H, settings: { quality: 'medium', dynres: false }, noMap: true, noHdri: true }));
  const s = mmpx / 1000, [px, py, z0, y0] = ancre, side = cote === 'droite' ? -1 : 1;
  // repère : le pixel (u, v) de la photo est le point z = z0 + side (u - px) s, y = y0 - (v - py) s ; la caméra vise le centre de l'image
  const zc = z0 + side * (W / 2 - px) * s, yc = y0 - (H / 2 - py) * s;
  await page.evaluate(([id, acc, zc, yc, H, s, side]) => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (typeof sky !== 'undefined') sky.visible = false;
    scene.background = new THREE.Color(0xf2f2f2);
    const def = weaponDef(id, acc ? acc.split(',') : [], null); vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null;
    const S = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0);
    for (let i = 0; i < 70; i++) updateViewmodel(1 / 30, S);
    setArmVisible(VM.arms.R, false); setArmVisible(VM.arms.L, false); VM.flash.visible = false;
    VM.holder.position.set(0, 0, 0); VM.holder.rotation.set(0, 0, 0); VM.holder.updateMatrixWorld(true);
    const fov = 3, d = (H * s) / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    vmCamera.fov = fov; vmCamera.near = d - 1.5; vmCamera.far = d + 1.5; vmCamera.updateProjectionMatrix();
    vmCamera.position.set(-side * d, yc, zc); vmCamera.lookAt(0, yc, zc);
  }, [id, acc, zc, yc, H, s, side]);
  await page.waitForTimeout(300);
  const shot = await page.screenshot();
  // silhouette nette : l'arme en noir mat sur fond blanc (ni ombre ni reflet)
  await page.evaluate(() => {
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    VM.cur.group.traverse((o) => { if (o.isMesh) o.material = black; });
    scene.background = new THREE.Color(0xffffff);
  });
  await page.waitForTimeout(300);
  const mask = await page.screenshot();
  // la même arme en blanc : le voile et le vignetage du rendu touchent le fond pareil dans les deux passes, la silhouette est ce qui change
  // (comparer au fond seul ne suffit pas, le voile peut éclaircir le noir presque jusqu'au fond)
  await page.evaluate(() => {
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    VM.cur.group.traverse((o) => { if (o.isMesh) o.material = white; });
  });
  await page.waitForTimeout(300);
  const empty = await page.screenshot();
  const res = await page.evaluate(async ([shotU, maskU, emptyU, photoU, W, H, tol]) => {
    const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); return { c, x, d: x.getImageData(0, 0, W, H) }; };
    const R = await load(shotU), Mk = await load(maskU), Em = await load(emptyU), Ph = await load(photoU), n = W * H;
    // photo : transparence si elle en a, sinon écart à la couleur moyenne des coins
    const pd = Ph.d.data; let transp = 0;
    for (let i = 3; i < pd.length; i += 4) if (pd[i] < 128) transp++;
    const A = new Uint8Array(n), Bm = new Uint8Array(n);
    if (transp > n * 0.02) { for (let i = 0; i < n; i++) A[i] = pd[i * 4 + 3] >= 128 ? 1 : 0; }
    else {
      const bg = [0, 0, 0], k = 6; let m = 0;
      for (const [cx, cy] of [[0, 0], [W - k, 0], [0, H - k], [W - k, H - k]]) for (let y = cy; y < cy + k; y++) for (let x = cx; x < cx + k; x++) { const i = (y * W + x) * 4; bg[0] += pd[i]; bg[1] += pd[i + 1]; bg[2] += pd[i + 2]; m++; }
      for (let j = 0; j < 3; j++) bg[j] /= m;
      for (let i = 0; i < n; i++) A[i] = Math.hypot(pd[i * 4] - bg[0], pd[i * 4 + 1] - bg[1], pd[i * 4 + 2] - bg[2]) > tol ? 1 : 0;
    }
    const md = Mk.d.data, ed = Em.d.data;
    for (let i = 0; i < n; i++) Bm[i] = ed[i * 4] + ed[i * 4 + 1] + ed[i * 4 + 2] - md[i * 4] - md[i * 4 + 1] - md[i * 4 + 2] > 3 * 16 ? 1 : 0;
    // contour de la photo (pixel de la silhouette qui touche le fond), épaissi d'un pixel, en rouge sur le rendu
    const E = new Uint8Array(n);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (A[i] && (!A[i - 1] || !A[i + 1] || !A[i - W] || !A[i + W])) E[i] = 1; }
    const rd = R.d.data;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (E[i] || E[i - 1] || E[i + 1] || E[i - W] || E[i + W]) { rd[i * 4] = 230; rd[i * 4 + 1] = 20; rd[i * 4 + 2] = 20; } }
    R.x.putImageData(R.d, 0, 0);
    // écarts : photo seule (bleu), modèle seul (orange), commun (gris)
    const D = Mk.x.createImageData(W, H), dd = D.data; let inter = 0, onlyA = 0, onlyB = 0;
    for (let i = 0; i < n; i++) {
      const a = A[i], b = Bm[i], c = a && b ? [150, 150, 150] : a ? [40, 110, 230] : b ? [240, 140, 20] : [255, 255, 255];
      if (a && b) inter++; else if (a) onlyA++; else if (b) onlyB++;
      dd[i * 4] = c[0]; dd[i * 4 + 1] = c[1]; dd[i * 4 + 2] = c[2]; dd[i * 4 + 3] = 255;
    }
    Mk.x.putImageData(D, 0, 0);
    return { over: R.c.toDataURL('image/png'), diff: Mk.c.toDataURL('image/png'), inter, onlyA, onlyB, photoPx: inter + onlyA };
  }, ['data:image/png;base64,' + shot.toString('base64'), 'data:image/png;base64,' + mask.toString('base64'), 'data:image/png;base64,' + empty.toString('base64'), photoURL, W, H, tol]);
  fs.writeFileSync(out, Buffer.from(res.over.split(',')[1], 'base64'));
  const outD = out.replace(/\.png$/i, '') + '-ecarts.png';
  fs.writeFileSync(outD, Buffer.from(res.diff.split(',')[1], 'base64'));
  const mm2 = (n) => (n * mmpx * mmpx).toFixed(0);
  if (!res.photoPx) console.log('ATTENTION : aucune silhouette trouvée sur la photo (fond, --tol ?)');
  console.log(`${id} : recouvrement ${(100 * res.inter / Math.max(1, res.inter + res.onlyA + res.onlyB)).toFixed(1)} % ; photo non couverte ${mm2(res.onlyA)} mm², modèle hors de la photo ${mm2(res.onlyB)} mm²`);
  console.log(`  ${out}\n  ${outD}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
