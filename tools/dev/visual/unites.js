/* Unités de texture d'un téléphone : node tools/dev/visual/unites.js [dossier de captures]   (CARTE=sable pour une seule carte)
   Un Pixel (PowerVR via ANGLE) n'offre que 13 unités de texture par programme (MAX_TEXTURE_IMAGE_UNITS), les ordinateurs 16 ou plus. Un programme
   qui en demande davantage est refusé ou fait perdre le contexte pendant la compilation des shaders : le sol à mélange en voulait 16 sur chaque
   carte, aucune ne se chargeait. Ce contrôle émule la limite de 13 (SwiftShader n'en a pas) et vérifie, pour chaque carte :
   - le jeu s'adapte (TEX_LEAN) et la carte se charge, aucun programme refusé ou au-dessus de la limite ;
   - aucun programme ne demande plus de 12 unités (une de marge) ;
   - le sol s'affiche (capture de la vue aérienne, à regarder).
   Avec la limite de 16 (ordinateur), le sol complet est conservé : 16 unités. Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
const MAPS = process.env.CARTE ? [process.env.CARTE] : ['sable', 'givre', 'embruns', 'floreal', 'meltem', 'tephra', 'stratus', 'simoun', 'lotissement'];
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
const LIMIT = (n) => `(() => { const f = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { return p === 0x8872 ? ${n} : f.call(this, p); }; })();`;

async function load(id, limit) {
  const g = await openGame({ mobile: true, w: 987, h: 444, dpr: 1, settings: { quality: 'low', lang: 'fr', map: id, touch: 'on' }, noMap: true, noHdri: true, init: limit ? LIMIT(limit) : undefined });
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate((m) => { window.__job = mapEnsure(m).catch((e) => e); }, id);
  await page.waitForFunction('MAPL.state === "ready" || MAPL.fail', null, { timeout: 900000, polling: 1000 });
  const r = await page.evaluate(() => { const bad = gpuCheckPrograms(); return { state: MAPL.state, err: MAPL.fail && String((MAPL.fail.err && MAPL.fail.err.message) || MAPL.fail.err), lean: TEX_LEAN, max: TEXU.max, bad: bad.map((b) => b.name + ' ' + b.log), samp: GPUX.samp, progs: renderer.info.programs.length }; });
  return { g, r };
}

(async () => {
  for (const id of MAPS) {
    const { g, r } = await load(id, 13);
    ok(r.max === 13 && r.lean === true, `${id} : limite de 13 unités vue par le jeu, variante sobre du sol`);
    ok(r.state === 'ready', `${id} : carte chargée (${r.progs} programmes)${r.err ? ' : ' + r.err : ''}`);
    ok(r.bad.length === 0, `${id} : aucun programme refusé ou au-dessus de la limite${r.bad.length ? ' : ' + r.bad.join(' | ') : ''}`);
    ok(r.samp && r.samp.n <= 12, `${id} : au plus ${r.samp && r.samp.n} unités dans un programme (${r.samp && r.samp.name.slice(0, 90)})`);
    if (out) {
      // vue aérienne du choix de la classe : le sol est à l'image
      await g.page.evaluate((m) => { menuLaunch({ online: false, map: m, deploy() {} }); }, id);
      await g.page.waitForFunction("UI.screen==='deploy'", null, { timeout: 300000, polling: 1000 }).catch(() => {});
      await g.page.waitForTimeout(3000);
      await g.page.screenshot({ path: path.join(out, `unites-${id}.png`) });
    }
    await g.browser.close();
  }
  if (!process.env.CARTE || process.env.CARTE === 'sable') {
    const { g, r } = await load('sable', 0);
    ok(r.lean === false && r.state === 'ready' && r.bad.length === 0 && r.samp.n === 16, `ordinateur : sol complet conservé (${r.samp && r.samp.n} unités, limite ${r.max})`);
    await g.browser.close();
  }
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
