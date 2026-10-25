/* Contrôle du choix des tenues (src/09u-tenues.js) sur un téléphone en paysage : node tools/dev/visual/tenues-ui.js [dossier de captures]
   - écran Tenues : l'aperçu 3D se dessine (animé, dans la toile du jeu : pixels clairs du soldat ; fixe : pixels hors du fond), le tissu
     simulé affiché suit la simulation, choisir une carte change la tenue (Settings.skin), les bras de la vue
     subjective et le corps du joueur, et l'annonce en ligne (champ sk de la présence) ;
   - tenues de défi : une carte verrouillée passe dans l'aperçu et détaille ses défis sans se porter ; ses défis accomplis, elle se
     débloque, s'annonce et se porte (corps, killcam, bras, présence en ligne) ; une tenue de défi que rien ne montre est libérée ;
   - vignettes des neuf tenues construites par la file des vignettes ;
   - en partie : chaque bot porte la tenue de la famille de son arme, alliés en clair et ennemis en sombre (relation au joueur),
     tous en ennemis en match à mort ; la vue Tenue de la pause change la tenue tout de suite.
   Sort avec un code d'erreur au premier échec. */
const path = require('path');
const { openGame } = require('./common');
const out = process.argv[2];
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ECHEC :', m); } else console.log('ok    :', m); };
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ mobile: true, w: 915, h: 412, settings: { quality: 'low', lang: 'fr', skin: 'assault' }, page: process.env.PAGE }); // PAGE : une autre version construite
  // écran Tenues
  await page.evaluate(() => uiOpen('skins', ['main']));
  await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 3; k++) frame(t + k * 16); });
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => {
    const cards = document.querySelectorAll('#skList .sk-card').length;
    if (SKV.live) {
      // aperçu animé : dessiné dans la toile du jeu après le fond (09u-tenues.js), relu juste après l'image, avant que le navigateur ne la
      // compose ; le soldat : des pixels nettement plus clairs que le studio, sombre
      MBG.drawn = ''; MBG.acc = 1; frame(performance.now() + 100);
      const gl = renderer.getContext(), r = SKV.host.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), bs = renderer.getDrawingBufferSize(new THREE.Vector2());
      const sx = bs.x / cr.width, sy = bs.y / cr.height, x = Math.round((r.left - cr.left) * sx), y = Math.round((cr.bottom - r.bottom) * sy), w = Math.round(r.width * sx), h = Math.round(r.height * sy);
      const d = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d); let n = 0;
      for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 150) n++;
      return { live: true, w, h, frac: n / (d.length / 16), cards };
    }
    const c = SKV.cv, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - 0x18) + Math.abs(d[i + 1] - 0x1b) + Math.abs(d[i + 2] - 0x14) > 30) n++;
    return { live: false, w: c.width, h: c.height, frac: n / (d.length / 16), cards };
  });
  const nAll = await page.evaluate(() => SKIN_ALL.length);
  ok(v.cards === nAll && v.frac > (v.live ? 0.03 : 0.05), `écran Tenues : ${nAll} cartes, aperçu ${v.live ? 'animé' : 'fixe'} dessiné (${v.w}x${v.h}, ${(v.frac * 100).toFixed(1)} % de pixels ${v.live ? 'du soldat' : 'hors du fond'})`);
  if (out) await page.screenshot({ path: path.join(out, 'tenues-ecran.png') });
  // aperçu animé : le tissu simulé affiché est celui de la simulation. Le moteur ne renvoie les sommets modifiés au GPU qu'une fois par
  // image de son compteur, qui n'avance pas aux menus (skinSkel le fait avancer) : sans cela, la cape affichée restait celle de la
  // première image. Tissu déplacé de 60 cm sans pas de simulation : l'image de l'aperçu doit changer.
  if (v.live) {
    const c = await page.evaluate(() => {
      const prev = SKV.view; skinView('tempest');
      for (let i = 0; i < 20; i++) { SKV.acc = 1 / 30; skinLiveDraw(); }
      const gl = renderer.getContext(), r = SKV.host.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), bs = renderer.getDrawingBufferSize(new THREE.Vector2());
      const sx = bs.x / cr.width, sy = bs.y / cr.height, x = Math.round((r.left - cr.left) * sx), y = Math.round((cr.bottom - r.bottom) * sy), w = Math.round(r.width * sx), h = Math.round(r.height * sy);
      const shot = () => { SKV.acc = 0; skinLiveDraw(); const d = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d); return d; };
      const A = shot(), C = skinLiveModel('tempest').cloth, P = C.sim.p;
      for (let i = 0; i < C.sim.n; i++) P[i * 3] += 0.6;
      const B = shot(); let n = 0;
      for (let i = 0; i < A.length; i += 16) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 40) n++;
      C.sim.live = false; skinView(prev);
      return n / (A.length / 16);
    });
    ok(c > 0.02, `aperçu animé : le tissu simulé affiché suit la simulation (${(c * 100).toFixed(1)} % de l'image change quand la cape est déplacée)`);
  }
  // tenue de défi verrouillée : elle passe dans l'aperçu (sa carte est marquée, sans changer de taille) et ses défis s'affichent dans le bas de
  // l'aperçu (#skInfo), mais elle ne se porte pas
  await page.click('#skList .sk-card[data-skin="nomad"]');
  await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 2; k++) frame(t + k * 16); });
  await page.waitForTimeout(200);
  const L = await page.evaluate(() => { const o = document.querySelector('#skList .sk-card.viewing'), i = document.getElementById('skInfo'), c = document.querySelectorAll('#skList .sk-card'); return { s: Settings.skin, mine: skinMine(), view: SKV.view, open: o && o.dataset.skin, defis: i && !i.classList.contains('hidden') ? i.querySelectorAll('.sk-d').length : 0, inCard: document.querySelectorAll('#skList .sk-card .sk-d').length, sameH: o && Math.abs(o.getBoundingClientRect().height - c[c.length - 1].getBoundingClientRect().height) < 2, locked: document.querySelectorAll('#skList .sk-card.locked').length, nDefi: SKIN_DEFI.length }; });
  ok(L.s === 'assault' && L.mine === 'assault' && L.view === 'nomad' && L.open === 'nomad' && L.defis === 3 && L.inCard === 0 && L.sameH && L.locked === L.nDefi, `tenue de défi verrouillée : aperçu et défis sous l'aperçu, carte de même taille, sans la porter (${JSON.stringify(L)})`);
  if (out) await page.screenshot({ path: path.join(out, 'tenues-defi-verrou.png') });
  await page.click('#skList .sk-card[data-skin="sniper"]');
  await page.evaluate(() => { const t = performance.now(); frame(t + 16); });
  const p = await page.evaluate(() => ({ s: Settings.skin, vm: VM_LOOK.key, body: PL.ent.model.lod.skin, kc: KC.body.lod.skin, sk: netPresence(PL.ent, performance.now()).sk, sel: document.querySelector('#skList .sk-card[aria-selected="true"]').dataset.skin }));
  ok(p.s === 'sniper' && p.vm === 'sniper0' && p.body === 'sniper' && p.kc === 'sniper' && p.sk === 'sniper' && p.sel === 'sniper', `choix d'une carte : tenue, bras, corps, killcam, présence en ligne (${JSON.stringify(p)})`);
  if (out) await page.screenshot({ path: path.join(out, 'tenues-ecran-ghillie.png') });
  // ses trois défis accomplis : le Nomade se débloque, s'annonce et se porte
  const U = await page.evaluate(() => { for (const d of defisOf('nomad')) defiAdd(d.id, d.goal); return { un: skinUnlocked('nomad'), ann: ARSQ.list.length + (ARSQ.on ? 1 : 0) }; });
  ok(U.un && U.ann >= 2, `défis accomplis : tenue débloquée et annoncée (${JSON.stringify(U)})`);
  await page.click('#skList .sk-card[data-skin="nomad"]');
  await page.evaluate(() => { const t = performance.now(); frame(t + 16); });
  const N = await page.evaluate(() => ({ s: Settings.skin, vm: VM_LOOK.key, body: PL.ent.model.lod.skin, kc: KC.body.lod.skin, sk: netPresence(PL.ent, performance.now()).sk, cloth: !!KC.body.cloth, save: JSON.parse(localStorage.getItem('cod_arsenal') || '{}').ch ? 1 : 0 }));
  ok(N.s === 'nomad' && N.vm === 'nomad0' && N.body === 'nomad' && N.kc === 'nomad' && N.sk === 'nomad' && N.cloth, `tenue de défi portée : bras, corps, killcam (avec son tissu), présence en ligne (${JSON.stringify(N)})`);
  if (out) await page.screenshot({ path: path.join(out, 'tenues-defi-portee.png') });
  // vignettes (file des vignettes, aux menus)
  await page.evaluate(() => uiOpen('main'));
  await page.waitForFunction(() => SKIN_ALL.every((s) => VTHUMB.img['skin:' + s]), null, { timeout: 240000, polling: 500 }).catch(() => {});
  const th = await page.evaluate(() => SKIN_ALL.map((s) => (VTHUMB.img['skin:' + s] || '').length));
  ok(th.every((n) => n > 1000), `vignettes des ${th.length} tenues (${th.join(', ')} octets)`);
  await page.waitForTimeout(300);
  const fr = await page.evaluate(() => SKIN_DEFI.filter((s) => s !== skinMine()).filter((s) => SOLDIER_GEOS[s + 'hi'] || SOLDIER_GEOS[s + 'lo'] || GEAR.maps[s + 'tp'] || SKV.models[s]));
  ok(fr.length === 0, `tenues de défi que rien ne montre : libérées (${fr.join(', ') || 'toutes'})`);
  // en partie : tenues des bots selon leur arme, relation au joueur
  await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => entities.filter((e) => !e.isPlayer && !e.off).map((e) => ({ cat: e.weapon.cat, skin: e.skin, look: e.model.lod.skin, rel: e.model.lod.rel, team: e.team })));
  const want = { ar: 'assault', pistol: 'assault', smg: 'smg', sniper: 'sniper', shotgun: 'shotgun' };
  ok(b.length && b.every((e) => e.skin === want[e.cat] && e.look === e.skin), `bots : tenue de la famille de l'arme (${b.map((e) => e.cat + '>' + e.look).join(' ')})`);
  ok(b.every((e) => e.rel === (e.team === 0 ? 0 : 1)), `par équipe : alliés en clair (0), ennemis en sombre (1) (${b.map((e) => e.team + ':' + e.rel).join(' ')})`);
  // pause : pas de choix de la tenue en partie (seulement à l'écran Tenues du menu)
  await page.evaluate(() => pauseGame());
  ok(await page.evaluate(() => !document.querySelector('#pause [data-pm="skin"]') && !document.getElementById('pmSkin')), 'pause : pas de vue Tenue');
  // match à mort : tout le monde en ennemi
  await page.evaluate(() => { resumeGame(); Settings.mode = 'ffa'; startMatch({}); });
  await page.waitForTimeout(500);
  const f = await page.evaluate(() => entities.filter((e) => !e.isPlayer && !e.off).map((e) => e.model.lod.rel));
  ok(f.length && f.every((r) => r === 1), `match à mort : tous vus en ennemis (${f.join('')})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon/.test(l));
  ok(errs.length === 0, `aucune erreur de la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} échec(s)` : 'tout est bon');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
