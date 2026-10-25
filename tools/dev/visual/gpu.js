/* Durcissement graphique d'un téléphone : node tools/dev/visual/gpu.js [dossier de captures]
   Émule un Android en paysage et vérifie, dans un vrai navigateur :
   - le chargement d'une carte par petits groupes de shaders avec progression (« Compilation des shaders : N % ») et sans programme refusé ;
   - le rapport graphique (essais de rendu compris) ;
   - une perte du contexte WebGL pendant que le jeu est affiché : la fenêtre « Affichage 3D interrompu », le mode graphique économique
     retenu pour la suite, et la page relancée dans ce mode (profil Basse allégé, pas de pré-passe) ;
   - une perte pendant la compilation des shaders : le chargement échoue proprement (message, bouton de rapport) au lieu de planter ;
   - une perte à la fenêtre d'installation ou aux menus (sans rapport avec le rendu du jeu) : ni fenêtre d'alerte ni mode économique, le démarrage attend
     la reprise, la page se relance d'elle-même aux menus ; le rapport garde ses caractéristiques GPU et son journal chronologique ;
   - le relevé satellite par tuiles, après la compilation, et l'échelle d'allègement (basse résolution, puis relevé sans GPU).
   PAGE=chemin/vers/une/autre/version.html : vérifie une autre version (comparer à la version publiée).
   Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
// limite de 13 unités de texture par programme, celle d'un Pixel (voir unites.js) : le jeu se charge et se teste comme sur le téléphone
const LIMIT13 = '(() => { const f = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { return p === 0x8872 ? 13 : f.call(this, p); }; })();';
// le Pixel lui-même : 13 unités et le nom de son GPU (PowerVR : pas de carte d'ombre, voir NO_SHADOWS dans 01-core.js)
const PIXEL = "(() => { const f = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { if (p === 0x8872) return 13; if (p === 0x9246) return 'ANGLE (Imagination Technologies, PowerVR D-Series DXT-48-1536, OpenGL ES 3.2)'; return f.call(this, p); }; })();";
const OUT = process.argv[2] || '/dev/null';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
// attente expirée : l'état du chargement et le journal chronologique du jeu sont affichés (sinon une attente qui n'aboutit pas ne dit rien)
const until = (page, expr, ms = 900000) => page.waitForFunction(expr, null, { timeout: ms, polling: 500 }).catch(async (e) => { console.log('ATTENTE EXPIREE', expr.slice(0, 60), JSON.stringify(await page.evaluate(() => ({ st: MAPL.state, f: !!MAPL.fail, lost: GPUX.lost, rest: GPUX.restored, tl: GPU_EV.slice(-16).map((x) => x[2]) })).catch(() => 'page ?'))); throw e; });
(async () => {
  const { browser, page } = await openGame({ page: process.env.PAGE, mobile: true, w: 915, h: 412, dpr: 1, settings: { quality: 'low', lang: 'fr' }, noMap: true, noHdri: true, init: PIXEL });
  // openGame réécrit les réglages à chaque chargement de page : le mode économique retenu doit leur être ajouté pour survivre au rechargement
  // le rechargement automatique après une perte du contexte (gpuAutoRetry) est coupé, sauf à l'étape 10 qui le contrôle
  await page.addInitScript(() => { try { if (sessionStorage.getItem('dc_gpu_auto') === null) sessionStorage.setItem('dc_gpu_auto', '9'); } catch (e) { /* ignoré */ } });
  await page.addInitScript(() => { try { const m = sessionStorage.getItem('__safe'); if (m) { const s = JSON.parse(localStorage.getItem('dc_settings')); s.gfxSafe = true; s.gfxSafeAuto = m === '1' ? 'manual' : m; localStorage.setItem('dc_settings', JSON.stringify(s)); } } catch (e) { /* ignoré */ } });
  // la première page s'est ouverte avant le script d'initialisation ci-dessus : le compteur de rechargements automatiques est posé à la main (sinon une reprise du contexte relance la page)
  await page.evaluate(() => { try { sessionStorage.setItem('dc_gpu_auto', '9'); } catch (e) { /* ignoré */ } const b = document.getElementById('wnOk'); if (b) b.click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); });

  // 1. chargement avec progression
  await page.evaluate(() => { window.__msgs = []; MAPL.subs.add((p, m) => { if (!window.__msgs.length || window.__msgs[window.__msgs.length - 1] !== m) window.__msgs.push(m); }); window.__job = mapEnsure('sable').then(() => 'ok', (e) => 'ko ' + e.message); });
  await until(page, 'MAPL.state === "ready" || MAPL.fail');
  const r1 = await page.evaluate(() => ({ st: MAPL.state, msgs: window.__msgs, bad: gpuCheckPrograms().length, lean: TEX_LEAN, samp: GPUX.samp.n, progs: renderer.info.programs.length, safe: GFX_SAFE, pre: NO_PREPASS, lights: RQ.q.lights }));
  ok(r1.st === 'ready', `carte chargée (${r1.progs} programmes)`);
  ok(r1.msgs.some((m) => /Compilation des shaders : \d+ %/.test(m)), `progression de la compilation (${r1.msgs.filter((m) => /Compilation/.test(m)).slice(0, 3).join(' | ')} ...)`);
  ok(r1.bad === 0, 'aucun programme refusé');
  ok(r1.lean === true && r1.samp <= 12, `limite de 13 unités : variante sobre du sol, au plus ${r1.samp} unités par programme`);
  ok(r1.pre === true && r1.lights === 0, "téléphone : pas de pré-passe, pas d'éclairs de tir");
  const sh = await page.evaluate(() => { const gl = renderer.getContext(); let n = 0; for (const p of renderer.info.programs) for (let i = 0, k = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); i < k; i++) { const u = gl.getActiveUniform(p.program, i); if (u && /ShadowMap/.test(u.name)) { n++; break; } } return { no: NO_SHADOWS, why: SHADOWS.why, on: renderer.shadowMap.enabled, n, sun: LIGHT.tex && LIGHT.tex.image.data.some((v, i) => i % 4 === 3 && v < 128) }; });
  ok(sh.no && sh.why === 'PowerVR' && !sh.on && sh.n === 0, `PowerVR : pas de carte d'ombre, aucun programme ne lit d'ombre (${JSON.stringify(sh)})`);
  ok(sh.sun, "ombre du soleil cuite dans le volume (canal a)");
  const tl = await page.evaluate(() => GPU_EV.map((e) => e[2]));
  const iC = tl.findIndex((m) => /Compilation des shaders$/.test(m)), iS = tl.findIndex((m) => /Relevé satellite/.test(m)), iB = tl.findIndex((m) => /barrier satellite 1\/9/.test(m));
  const iD = tl.findIndex((m) => /draw scan: \d+ families, 0 refused/.test(m));
  ok(iC >= 0 && iS > iC && iD > iS && iB > iD, `journal : compilation des shaders, relevé satellite : balayage des dessins puis tuiles (${tl.filter((m) => /^map|barrier|draw/.test(m)).slice(-8).join(' > ')})`);
  ok(await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('dc_gpu_ok')); return !!v && v.b === BUILD && v.maps.includes('sable'); }), 'carte passée au balayage : gardée pour ce build (pas de nouveau balayage)');

  // 2. rapport graphique
  const rep = await page.evaluate(() => { gpuReport(); return { hidden: document.getElementById('gpuRep').classList.contains('hidden'), txt: document.getElementById('grTxt').textContent }; });
  ok(!rep.hidden, 'rapport graphique affiché');
  ok(/RGBA16F target: ok/.test(rep.txt) && /3D texture read: ok/.test(rep.txt), `essais de rendu (${(rep.txt.match(/probes: .*/) || [''])[0]})`);
  ok(/map: sable \(ready\)/.test(rep.txt) && /safe mode no/.test(rep.txt), 'rapport : carte et mode');
  ok(/timeline \(UTC/.test(rep.txt) && /barrier textures/.test(rep.txt) && /phase now menu/.test(rep.txt), 'rapport : journal chronologique et phase');
  await page.screenshot({ path: OUT + '/gpu-rapport.png' }).catch(() => {});
  await page.evaluate(() => document.getElementById('grClose').click());

  // 2b. vignettes d'armes : jamais pendant la vue aérienne (le GPU y dessine sans cesse ; rendues dans la toile puis recopiées, elles faisaient perdre le contexte d'un
  //     Pixel 0,6 s après l'ouverture du choix de la classe) ; rendues ensuite aux menus, dans une cible hors écran
  const r2b = await page.evaluate(async () => {
    const id = Object.keys(WEAPONS)[0]; delete VTHUMB.img[id];
    UI.flow = { online: false, map: 'sable', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']);
    thumbsStart(); await new Promise((r) => setTimeout(r, 2500));
    const during = VTHUMB.img[id] === undefined;
    uiOpen('main'); await new Promise((r) => setTimeout(r, 3000));
    return { during, after: !!VTHUMB.img[id] && VTHUMB.img[id].length > 1000 };
  });
  ok(r2b.during && r2b.after, `vignettes : suspendues pendant la vue aérienne, rendues ensuite aux menus (${JSON.stringify(r2b)})`);

  // 3. perte du contexte pendant que le jeu dessine (vue aérienne du choix de la classe)
  await page.evaluate(() => { UI.flow = { online: false, map: 'sable', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).loseContext(); });
  await until(page, '!document.getElementById("gpuLost").classList.contains("hidden")', 60000);
  const lostRep = await page.evaluate(() => gpuReportText(false));
  ok(/context: LOST/.test(lostRep) && /WebGL 2 · /.test(lostRep) && /units 13/.test(lostRep) && !/null/.test(lostRep.split('\n').slice(0, 9).join(' ')), 'rapport pris contexte perdu : caractéristiques du GPU gardées (pas de null)');
  ok(/context LOST \(aerial/.test(lostRep) && /phase aerial/.test(lostRep), 'rapport : perte datée dans le journal, phase aérienne');
  ok(/frame 1 \(\+\d+ ms\) calls \d+/.test(lostRep) && /context LOST \(aerial, visible, frame \d+\)/.test(lostRep), 'rapport : premières images du rendu et perte datée en images');
  const lost = await page.evaluate(() => ({ msg: document.getElementById('glMsg').textContent, safe: JSON.parse(localStorage.getItem('dc_settings')).gfxSafe, auto: JSON.parse(localStorage.getItem('dc_settings')).gfxSafeAuto === BUILD && BUILD !== '', armed: GPUX.armed }));
  await page.evaluate(() => sessionStorage.setItem('__safe', '1'));
  ok(lost.safe === true && lost.auto && lost.armed && /économique est activé/.test(lost.msg), `contexte perdu : mode économique retenu (« ${lost.msg.slice(0, 60)}... »)`);
  await page.screenshot({ path: OUT + '/gpu-perdu.png' }).catch(() => {});
  await page.evaluate(() => (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).restoreContext());

  // 4. relance : mode économique
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  const r4 = await page.evaluate(() => ({ safe: GFX_SAFE, sh: RQ.q.shadow, pr: RQ.q.pr, pre: NO_PREPASS, tier: RQ.tier }));
  ok(r4.safe && r4.sh === 512 && r4.pr === 0.6 && r4.pre && r4.tier === 'low', `relancé en mode économique (ombres ${r4.sh}, rendu ${r4.pr})`);
  const opt = await page.evaluate(() => { const o = OPT_TABS.find((t) => t[0] === 'Vidéo'); return o[1].some((r) => r[1] === 'gfxSafe') && o[1].some((r) => r[1] === 'Rapport graphique'); });
  ok(opt, 'Options, Vidéo : mode économique et rapport graphique');

  // 5. nouvelle perte alors que le mode économique est déjà actif : message différent, pas de boucle
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).loseContext(); });
  await until(page, '!document.getElementById("gpuLost").classList.contains("hidden")', 60000);
  ok(await page.evaluate(() => /encore été interrompu/.test(document.getElementById('glMsg').textContent)), 'déjà en mode économique : le message le dit');
  await page.evaluate(() => { (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).restoreContext(); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); });

  // 6. perte pendant la compilation : échec propre, écran de chargement avec ses boutons
  await page.evaluate(() => {
    Settings.gfxSafe = false; saveSettings();
    const c = renderer.compile.bind(renderer); let n = 0;
    renderer.compile = (s, k) => { c(s, k); if (++n === 4) (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).loseContext(); };
    window.__flow = { online: false, map: 'sable', deploy() {} }; menuLaunch(window.__flow);
  });
  await until(page, '!document.getElementById("mlBack").classList.contains("hidden")', 900000);
  const f = await page.evaluate(() => ({ msg: document.getElementById('mlMsg').textContent, rep: !document.getElementById('mlRep').classList.contains('hidden'), safeBtn: !document.getElementById('mlSafe').classList.contains('hidden'), lostBox: !document.getElementById('gpuLost').classList.contains('hidden') }));
  ok(/pendant le chargement/.test(f.msg) && !/trim/.test(f.msg), `perte pendant la compilation : message clair (« ${f.msg.slice(0, 90)}... »)`);
  ok(f.rep, "bouton « Rapport graphique » sur l'écran d'échec");
  ok(f.lostBox, 'fenêtre « Affichage 3D interrompu » par-dessus');
  await page.screenshot({ path: OUT + '/gpu-echec.png' }).catch(() => {});

  // 7. mode économique armé tout seul par un build plus ancien : levé au chargement (une seule fois) ; choisi par le joueur : conservé
  await page.evaluate(() => sessionStorage.setItem('__safe', 'build-ancien'));
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  const old7 = await page.evaluate(() => ({ safe: GFX_SAFE, st: JSON.parse(localStorage.getItem('dc_settings')) }));
  ok(old7.safe === false && !old7.st.gfxSafe, 'mode économique armé par un build plus ancien : levé, le jeu réessaie en profil normal');
  await page.evaluate(() => sessionStorage.setItem('__safe', '1'));
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  ok(await page.evaluate(() => GFX_SAFE === true), 'mode économique choisi dans les Options : conservé');

  // 8. un programme refusé par l'appareil (contexte perdu pendant sa compilation) : inventaire complet malgré la perte, journal gardé, fenêtre pour relancer
  await page.evaluate(() => { sessionStorage.removeItem('__safe'); localStorage.removeItem('dc_gpu_bad'); localStorage.removeItem('dc_gpu_last'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const lc = renderer.getContext().getExtension('WEBGL_lose_context'), c = renderer.compile.bind(renderer); let n = 0;
    renderer.compile = (s, k) => { c(s, k); if (++n === 4) { lc.loseContext(); setTimeout(() => lc.restoreContext(), 400); } };
    window.__p = mapEnsure('sable').then(() => 'ok', () => 'ko');
  });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r8 = await page.evaluate(() => ({ cul: GPUX.culprits.length, rest: GPUX.restored, bad: JSON.parse(localStorage.getItem('dc_gpu_bad')), last: JSON.parse(localStorage.getItem('dc_gpu_last')), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), msg: document.getElementById('glMsg').textContent, rep: gpuReportText(false) }));
  ok(r8.cul === 1 && r8.rest >= 1, `programme refusé : relevé après la reprise du contexte (${r8.cul} refusé, ${r8.rest} reprise)`);
  ok(r8.bad && r8.bad.keys.length === 1 && r8.last && /\d+\/\d+/.test(r8.last.cur), 'famille refusée et journal gardés dans le stockage');
  ok(r8.overlay && /refusé certains rendus/.test(r8.msg), `fenêtre pour relancer (« ${r8.msg.slice(0, 60)}... »)`);
  ok(/programs the device refused/.test(r8.rep) && /previous interruption/.test(r8.rep), 'rapport : programme refusé et dernière interruption');
  // chargement suivant : la famille refusée est remplacée par une version simple et la carte se charge
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__p = mapEnsure('sable').then(() => 'ok', (e) => 'ko ' + e.message); });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r9 = await page.evaluate(() => { let n = 0; scene.traverse((o) => { if (o.material && o.material.name === 'repli') n++; if (o.visible === false && o.userData.gpuFallback) n++; }); return { st: MAPL.state, fb: GPUX.fallbacks, n, cul: GPUX.culprits.length }; });
  ok(r9.st === 'ready' && r9.fb > 0 && r9.n > 0 && r9.cul === 0, `rechargé : ${r9.fb} objets en version simple, la carte se charge`);

  // 10. perte du contexte détectée par une barrière (étape « satellite ») : l'étape est allégée pour la suite, la page se relance d'elle-même, la partie solo
  //     reprend et se charge, relevé satellite en basse résolution
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); localStorage.removeItem('dc_gpu_lean'); localStorage.removeItem('dc_gpu_bad'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const gl = renderer.getContext(), lc = gl.getExtension('WEBGL_lose_context'), f = gl.fenceSync.bind(gl); let n = 0;
    gl.fenceSync = (c, fl) => { const r = f(c, fl); if (/^satellite/.test(GPUX.barTag) && ++n === 2) { lc.loseContext(); setTimeout(() => lc.restoreContext(), 300); } return r; }; // deuxième tuile du relevé satellite
    menuLaunch({ online: false, map: 'sable', deploy() {} });
  });
  let r10 = null; const t10 = Date.now();
  while (Date.now() - t10 < 1500000) { // la page se recharge : on interroge la nouvelle
    await new Promise((r) => setTimeout(r, 2500));
    r10 = await page.evaluate(() => (typeof MAPL !== 'undefined' && typeof GPUX !== 'undefined' && MAPL.state === 'ready' ? { lean: GPUX.lean, auto: sessionStorage.getItem('dc_gpu_auto'), ls: JSON.parse(localStorage.getItem('dc_gpu_lean')), sat: !!KS.sat, rep: gpuReportText(false) } : null)).catch(() => null);
    if (r10) break;
  }
  ok(!!r10 && r10.lean.sat === 1 && r10.ls && r10.ls.sat === 1, 'barrière « satellite » : étape allégée et retenue pour la suite');
  ok(!!r10 && r10.auto === '1', "la page s'est relancée d'elle-même (une fois)");
  ok(!!r10 && r10.sat && /satellite low-res/.test(r10.rep) && /barriers/.test(r10.rep), 'la partie reprend et se charge, relevé satellite en basse résolution, rapport complété');

  // 11. échelle d'allègement : une seconde perte au relevé satellite, déjà en basse résolution : plus de rendu GPU du relevé (dessiné sans lui), la carte se charge
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const gl = renderer.getContext(), lc = gl.getExtension('WEBGL_lose_context'), f = gl.fenceSync.bind(gl); let n = 0;
    gl.fenceSync = (c, fl) => { const r = f(c, fl); if (/^satellite/.test(GPUX.barTag) && ++n === 1) { lc.loseContext(); setTimeout(() => lc.restoreContext(), 300); } return r; };
    menuLaunch({ online: false, map: 'sable', deploy() {} });
  });
  let r11 = null; const t11 = Date.now();
  while (Date.now() - t11 < 1500000) {
    await new Promise((r) => setTimeout(r, 2500));
    r11 = await page.evaluate(() => (typeof MAPL !== 'undefined' && typeof GPUX !== 'undefined' && MAPL.state === 'ready' ? { sat: GPUX.lean.sat, ks: !!KS.sat, rep: gpuReportText(false) } : null)).catch(() => null);
    if (r11) break;
  }
  ok(!!r11 && r11.sat === 2 && r11.ks && /not rendered/.test(r11.rep), 'seconde perte au relevé : relevé dessiné sans le GPU, la carte se charge');

  // 14. balayage des dessins : une famille dont le dessin fait perdre le contexte est relevée (liste, stockage, fenêtre) ; au chargement suivant elle est remplacée par une
  //     version simple sans ombre portée et la carte se charge
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '9'); localStorage.removeItem('dc_gpu_lean'); localStorage.removeItem('dc_gpu_bad'); localStorage.removeItem('dc_gpu_ok'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const lc = renderer.getContext().getExtension('WEBGL_lose_context'), r = renderer.render.bind(renderer); let done = false;
    renderer.render = (s, c) => { r(s, c); if (!done && /^draw MeshStandardMaterial/.test(GPUX.cur || '')) { done = true; lc.loseContext(); setTimeout(() => lc.restoreContext(), 300); } };
    window.__p = mapEnsure('sable').then(() => 'ok', () => 'ko');
  });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r14 = await page.evaluate(() => ({ cul: GPUX.culprits.filter((c) => /^draw /.test(c)), bad: JSON.parse(localStorage.getItem('dc_gpu_bad')), ok: localStorage.getItem('dc_gpu_ok'), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), tl: GPU_EV.map((e) => e[2]).filter((m) => /draw scan/.test(m)) }));
  ok(r14.cul.length === 1 && r14.bad && r14.bad.keys.length === 1 && r14.overlay, `balayage : une famille refusée relevée et gardée (${r14.cul[0] && r14.cul[0].slice(0, 70)})`);
  ok(r14.ok === null && r14.tl.some((m) => /1 refused/.test(m)), 'balayage : la carte n\'est pas marquée sans incident');
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__p = mapEnsure('sable').then(() => 'ok', (e) => 'ko ' + e.message); });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r14b = await page.evaluate(() => { let n = 0, shadow = 0; scene.traverse((o) => { if (o.userData.gpuFallback) { n++; if (o.castShadow) shadow++; } }); return { st: MAPL.state, n, shadow, cul: GPUX.culprits.length, ok: JSON.parse(localStorage.getItem('dc_gpu_ok')) }; });
  ok(r14b.st === 'ready' && r14b.n > 0 && r14b.shadow === 0 && r14b.cul === 0 && r14b.ok && r14b.ok.maps.includes('sable'), `balayage : famille remplacée (${r14b.n} objets, sans ombre portée), la carte se charge et passe le balayage`);

  // 15. perte à la vue aérienne : pas de rechargement automatique (la perte y est attribuée à la page, Chrome peut la bloquer quelques minutes) ; la fenêtre reste avec son rapport
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); window.__l15 = GPUX.lost; UI.flow = { online: false, map: 'sable', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const lc = renderer.getContext().getExtension('WEBGL_lose_context'); lc.loseContext(); setTimeout(() => lc.restoreContext(), 400); });
  await page.waitForTimeout(6000);
  const r15 = await page.evaluate(async () => { const f0 = GPUF.last; await new Promise((r) => setTimeout(r, 600)); return { lost: GPUX.lost - window.__l15, auto: sessionStorage.getItem('dc_gpu_auto'), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), halt: GPUX.halt, still: GPUF.last === f0 }; });
  ok(r15.lost === 1 && r15.auto === '0' && r15.overlay, `perte à la vue aérienne : pas de rechargement automatique, la fenêtre reste (${JSON.stringify(r15)})`);
  ok(r15.halt && r15.still, 'perte à la vue aérienne : la boucle d\'images ne dessine plus');

  await browser.close();

  // 12. perte à la fenêtre d'installation (rien n'est construit) : ni fenêtre d'alerte ni mode économique ; le démarrage attend la reprise du contexte
  const G = await openGame({ page: process.env.PAGE, mobile: true, w: 444, h: 839, dpr: 2.4375, settings: { quality: 'auto', lang: 'fr' }, noMap: true, noHdri: true, init: LIMIT13, pwa: true, gate: true });
  const gp = G.page;
  await gp.waitForFunction("typeof PWA !== 'undefined' && PWA.gate === true", null, { timeout: 60000 });
  await gp.evaluate(() => { window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await gp.waitForTimeout(1500);
  const g12 = await gp.evaluate(() => ({ lost: GPUX.lost, phase: gpuPhase(), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), safe: JSON.parse(localStorage.getItem('dc_settings')).gfxSafe === true }));
  ok(g12.lost === 1 && g12.phase === 'gate' && !g12.overlay && !g12.safe, 'perte à la fenêtre d\'installation : pas de fenêtre « Affichage 3D interrompu », pas de mode économique');
  await gp.evaluate(() => { pwaBrowser(); setTimeout(() => window.__lc.restoreContext(), 1500); }); // le joueur passe l'installation pendant la perte : le démarrage attend
  await gp.waitForFunction("typeof MATCH !== 'undefined' && MATCH.state === 'menu'", null, { timeout: 600000, polling: 500 });
  const g12b = await gp.evaluate(() => ({ lost: gpuLostNow(), rest: GPUX.restored, tl: GPU_EV.map((e) => e[2]), rep: gpuReportText(false), url: location.href }));
  ok(!g12b.lost && g12b.rest === 1 && !/automatic reload/.test(g12b.tl.join('|')), 'démarrage attendu la reprise du contexte, aucun rechargement (rien n\'avait été construit)');
  ok(/install gate shown/.test(g12b.tl.join('|')) && /context LOST \(gate/.test(g12b.tl.join('|')) && /boot waits for the context/.test(g12b.tl.join('|')), 'journal : fenêtre d\'installation, perte, attente du contexte');

  // 13. perte aux menus puis reprise : la page se relance d'elle-même (les textures générées sur le GPU sont perdues), sans mode économique
  await gp.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); setTimeout(() => window.__lc.restoreContext(), 600); });
  let r13 = null, last13 = null; const t13 = Date.now();
  while (Date.now() - t13 < 600000) {
    await new Promise((r) => setTimeout(r, 2500));
    last13 = await gp.evaluate(() => { try { return { st: MATCH.state, auto: sessionStorage.getItem('dc_gpu_auto'), safe: GFX_SAFE, tl: GPU_EV.map((e) => e[2]).join('|') }; } catch (e) { return { err: String(e.message || e) }; } }).catch((e) => ({ nav: String(e.message || e).slice(0, 80) }));
    if (last13 && last13.st === 'menu' && last13.auto === '1') { r13 = last13; break; }
  }
  ok(!!r13 && !r13.safe && /context LOST \(menu/.test(r13.tl) && /automatic reload 1/.test(r13.tl), 'perte aux menus : la page se relance d\'elle-même, mode économique non armé' + (!r13 ? ' ' + JSON.stringify(last13).slice(-900) : '') + (r13 && !(!r13.safe && /context LOST \(menu/.test(r13.tl) && /automatic reload 1/.test(r13.tl)) ? ' ' + JSON.stringify(r13).slice(0, 700) : ''));

  // 16. téléphone qui n'est pas un PowerVR : une perte pendant que le jeu dessine coupe les ombres calculées pour les lancements suivants (appris, 30 jours)
  await gp.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__j = mapEnsure('sable'); });
  await gp.waitForFunction("(() => { try { return MAPL.state === 'ready' || !!MAPL.fail; } catch (e) { return false; } })()", null, { timeout: 900000, polling: 1000 });
  const r16a = await gp.evaluate(async () => {
    const before = NO_SHADOWS; UI.flow = { online: false, map: 'sable', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']);
    await new Promise((r) => setTimeout(r, 2000)); sessionStorage.setItem('dc_gpu_auto', '9');
    renderer.getContext().getExtension('WEBGL_lose_context').loseContext(); await new Promise((r) => setTimeout(r, 800));
    return { before, stored: !!localStorage.getItem('dc_gpu_noshadow') };
  });
  await gp.reload();
  await gp.waitForFunction("(() => { try { return MATCH.state === 'menu'; } catch (e) { return false; } })()", null, { timeout: 600000, polling: 500 });
  const r16b = await gp.evaluate(() => ({ no: NO_SHADOWS, why: SHADOWS.why, on: renderer.shadowMap.enabled }));
  ok(!r16a.before && r16a.stored && r16b.no && !r16b.on && /learned/.test(r16b.why), `perte à la vue aérienne (hors PowerVR) : ombres calculées coupées aux lancements suivants (${JSON.stringify([r16a, r16b])})`);
  await G.browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
