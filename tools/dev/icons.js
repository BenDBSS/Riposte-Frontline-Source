/* Icônes « maskable » et icône iPhone : node tools/dev/icons.js [dossier d'aperçus]
   Android découpe l'icône maskable selon le modèle du téléphone (rond, carré arrondi, goutte...) et ne garantit que le disque central
   (80 % de la largeur, rayon 40 %) : l'image doit donc remplir TOUT le carré, sans marge. L'ancienne version réduisait l'illustration sur
   un fond noir uni, d'où le liseré noir dans le rond d'un Pixel. Ici : l'illustration pleine page, descendue pour que le casque et le
   visage tiennent dans le disque sûr, son bord supérieur prolongé par un fondu flou, un fond fait de la même image très floue et l'image
   nette par-dessus, au bord fondu en disque (les équerres jaunes des coins, que le découpage couperait, n'y sont plus). Même composition
   pour l'icône iPhone (iOS arrondit lui-même les coins et refuse la transparence).
   Source : assets/icon/icon-512.png (l'icône « any », carrée, pleine page). Écrit assets/icon/maskable-512.png, maskable-192.png et
   apple-touch-icon.png ; build.py les empreint et les copie dans dist/icons/. Un aperçu avec plusieurs découpes (rond, carré arrondi,
   goutte, rond réduit d'Android) est écrit dans le dossier donné. Chromium : celui de Playwright, ou la variable CHROME. */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..', '..'), ICON = path.join(ROOT, 'assets', 'icon');
const CHROME = process.env.CHROME || process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = process.argv[2];

/* Exécuté dans la page : compose l'icône à 512 px, puis la réduit aux tailles demandées */
function compose({ src, sizes, preview }) {
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  return load(src).then((img) => {
    const N = 512, c = mk(N, N), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    // 1. illustration pleine page, descendue de DY pour que le casque et le visage tiennent dans le disque sûr (rayon 40 %) ; la bande laissée en
    //    haut prolonge le bord supérieur de l'illustration (flou, fondu avec elle)
    const DY = 50, comp = mk(N, N), cg = comp.getContext('2d');
    cg.imageSmoothingQuality = 'high';
    const band = mk(N, DY + 40), bg = band.getContext('2d');
    bg.filter = 'blur(16px)'; bg.drawImage(img, 0, 0, N, 3, -40, -40, N + 80, DY + 80); // bord haut étiré vers le haut, débordant pour ne pas laisser de bord flou transparent
    cg.drawImage(band, 0, 0);
    const top = mk(N, N), tg = top.getContext('2d'); tg.drawImage(img, 0, DY, N, N);
    tg.globalCompositeOperation = 'destination-in';
    const fade = tg.createLinearGradient(0, DY, 0, DY + 36); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    tg.fillStyle = fade; tg.fillRect(0, 0, N, N); // fondu sur les 36 premiers px de l'illustration
    cg.drawImage(top, 0, 0);
    // 2. fond : la même composition, très floue (aucun noir uni, couleurs identiques à celles de l'image nette) ; au-dessus, l'image nette dont le
    //    bord est fondu en disque : les équerres jaunes des coins (qu'un découpage couperait) n'y sont plus, il n'en reste qu'une lueur floue
    g.fillStyle = '#15130b'; g.fillRect(0, 0, N, N); // base opaque : aucun pixel transparent, même au bord
    g.save(); g.filter = 'blur(28px)'; g.drawImage(comp, -N * 0.08, -N * 0.08, N * 1.16, N * 1.16); g.restore();
    const fg = mk(N, N), fx = fg.getContext('2d'); fx.drawImage(comp, 0, 0);
    fx.globalCompositeOperation = 'destination-in';
    const gr = fx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.5);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.74, 'rgba(0,0,0,1)'); gr.addColorStop(0.97, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = gr; fx.fillRect(0, 0, N, N);
    g.drawImage(fg, 0, 0);
    // 3. vignette douce : la lumière reste au centre, les bords s'assombrissent un peu sans devenir noirs
    const v = g.createRadialGradient(N / 2, N / 2, N * 0.34, N / 2, N / 2, N * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = v; g.fillRect(0, 0, N, N);
    // réduction par moitiés (netteté) puis ajustement final
    const shrink = (t) => { let cur = c; while (cur.width / 2 >= t) { const n = mk(cur.width / 2, cur.width / 2), q = n.getContext('2d'); q.imageSmoothingQuality = 'high'; q.drawImage(cur, 0, 0, n.width, n.height); cur = n; } if (cur.width !== t) { const n = mk(t, t), q = n.getContext('2d'); q.imageSmoothingQuality = 'high'; q.drawImage(cur, 0, 0, t, t); cur = n; } return cur; };
    const res = {}; for (const t of sizes) res[t] = shrink(t).toDataURL('image/png');
    if (!preview) return { res };
    // aperçu : plusieurs découpes sur un fond neutre, la zone sûre (80 %) en pointillé
    const P = 300, pv = mk(P * 4 + 50, P + 20), p = pv.getContext('2d'); p.fillStyle = '#6b7280'; p.fillRect(0, 0, pv.width, pv.height);
    const shapes = [
      (q, x, y, d) => { q.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); },                                         // rond
      (q, x, y, d) => { const r = d * 0.3; q.roundRect(x, y, d, d, r); },                                               // carré arrondi
      (q, x, y, d) => { const r = d * 0.5; q.roundRect(x, y, d, d, [r, r, r, d * 0.12]); },                             // goutte
      (q, x, y, d) => { const k = d * 0.833; q.arc(x + d / 2, y + d / 2, k / 2, 0, Math.PI * 2); },                     // rond réduit (fenêtre de 72/108 d'Android)
    ];
    shapes.forEach((sh, i) => {
      const x = 10 + i * (P + 10), y = 10; p.save(); p.beginPath(); sh(p, x, y, P); p.clip(); p.drawImage(c, x, y, P, P); p.restore();
      p.save(); p.setLineDash([5, 5]); p.strokeStyle = 'rgba(255,255,255,.55)'; p.beginPath(); p.arc(x + P / 2, y + P / 2, P * 0.4, 0, Math.PI * 2); p.stroke(); p.restore();
    });
    // part de pixels noirs unis (somme des canaux sous 15) sur l'anneau extérieur du rond : l'ancienne icône en avait 100 %, un fond noir uni ; ici le noir est celui de la fumée de l'illustration
    const d = g.getImageData(0, 0, N, N).data; let dark = 0, n = 0, minA = 255; for (let i = 3; i < d.length; i += 4) if (d[i] < minA) minA = d[i];
    for (let a = 0; a < 360; a += 3) for (let r = 0.9; r <= 0.985; r += 0.01) {
      const x = Math.round(N / 2 + Math.cos(a * Math.PI / 180) * r * N / 2), y = Math.round(N / 2 + Math.sin(a * Math.PI / 180) * r * N / 2), i = (y * N + x) * 4;
      if (d[i] + d[i + 1] + d[i + 2] < 15) dark++; n++;
    }
    return { res, view: pv.toDataURL('image/png'), darkRing: dark / n, minA };
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage();
  await pg.setContent('<!doctype html><html><body></body></html>');
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ICON, 'icon-512.png')).toString('base64');
  const r = await pg.evaluate(compose, { src, sizes: [512, 192, 180], preview: true });
  const put = (name, url) => fs.writeFileSync(path.join(ICON, name), Buffer.from(url.split(',')[1], 'base64'));
  put('maskable-512.png', r.res[512]); put('maskable-192.png', r.res[192]); put('apple-touch-icon.png', r.res[180]);
  console.log('icônes écrites : maskable-512, maskable-192, apple-touch-icon');
  console.log(`part de pixels noirs unis sur l'anneau extérieur du rond : ${(r.darkRing * 100).toFixed(1)} %`);
  console.log(`opacité minimale de l'icône : ${r.minA} sur 255 (255 : aucun pixel transparent)`);
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'icones-apercu.png'), Buffer.from(r.view.split(',')[1], 'base64')); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
