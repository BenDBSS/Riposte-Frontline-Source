/* Touches en ligne chez le tireur et chez la victime (src/09c-net.js) : node tools/dev/visual/prediction.js ; PAGE=autre.html.
   Partie en ligne simulée dans une seule page (rôle d'invité, rien n'est envoyé). Mort prédite (netPredHealth, netPredictKill, accusé ak) :
   - quatre balles de 26 en rafale (104, au-dessus de la marge de 2), sans état de la victime entre elles : la quatrième fait tomber la cible tout de suite (avant : la vie
     publiée restait à 100, rien n'était prédit et l'élimination attendait l'aller-retour) ;
   - un état de la victime qui accuse les deux premières balles (vie 50) : il reste deux balles en route (52), la vie prédite vaut -2 ;
   - une victime d'une version sans accusé : vie publiée seule, la quatrième balle ne prédit rien (comportement d'avant) ;
   - une touche jamais accusée est oubliée après 2 s ;
   - des touches reçues d'un joueur et d'un bot de l'hôte : mon état publié porte leurs numéros (ak).
   Morts croisées (netTradeHold, netHeldCheck) :
   - j'ai tiré le premier, sa balle mortelle part après la mienne qu'il n'avait pas reçue : elle attend, mon accusé ne la compte pas ; il annonce
     sa mort par ma touche : sa balle ne compte pas, je suis vivant ;
   - il a tiré le premier : sa balle s'applique tout de suite, je meurs ;
   - il avait déjà appliqué ma touche (non mortelle) et vit encore : sa balle s'applique tout de suite ;
   - pas de nouvelles de lui en 0,8 s : sa balle s'applique ;
   - une balle sans heure (version précédente) : appliquée tout de suite, comme avant.
   Sort avec un code d'erreur au premier échec. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, noHdri: true, settings: { quality: 'low', map: 'sable', lang: 'fr' } });
  try {
    const r = await page.evaluate(() => {
      LOCK.fallback = true; startMatch({}); NET.on = true; NET.role = 'client'; NET.me = 'moi'; NET.joined = true; NET.t0 = performance.now();
      NET.hostConn = { open: true, send() {} }; MATCH.online = true; MATCH.state = 'playing'; PL.ent.protT = 1e9;
      const live = () => { NET.hostSeen = performance.now(); };
      const P = (team, health, ak, alive = 1) => ({ n: 'Cible', t: team, w: 'm4', g: 'm4', s: [3, 0.2, 3, 0, 0, 0, 0, 0, 0, alive, 0, health], f: 0, k: 0, d: 0, a: 0, sc: 0, sk: 'assault', ev: [], ...(ak !== undefined ? { ak: { moi: ak } } : {}) });
      const foe = 1 - PL.ent.team, out = {};
      const shoot = (e, n, d = 26) => { const r = []; for (let i = 0; i < n; i++) { live(); applyDamage(e, d, PL.ent, curW().def.name, false, new V3(0, 0, -1)); r.push(!!e.pred); } return r; };
      const mine = (e) => NET.sent.filter((m) => m.f === PL.ent && m.v === e);
      // victime d'une version à jour (accuse 0 au départ)
      live(); netApply('gA', P(foe, 100, 0)); const a = NET.remotes.get('gA');
      out.rafale = shoot(a, 4);
      out.pendA = mine(a).map((x) => x.i);
      // état qui accuse les deux premières balles : vie 50, deux balles en route
      a.pred = false; a.alive = true;
      live(); netApply('gA', P(foe, 50, out.pendA[1])); out.predApres = netPredHealth(a);
      // victime d'une version sans accusé
      live(); netApply('gB', P(foe, 100)); const b = NET.remotes.get('gB');
      out.ancien = shoot(b, 4); out.ancienPred = netPredHealth(b);
      // oubli après 2 s
      live(); netApply('gC', P(foe, 100, 0)); const c = NET.remotes.get('gC');
      shoot(c, 1); MATCH.time += 2.5; out.oubli = netPredHealth(c);
      // accusé publié : une touche reçue de gD (joueur) et une d'un bot de l'hôte
      live(); netApply('gD', { ...P(foe, 100), ev: [{ k: 'hit', i: 7, to: 'moi', d: 1, h: 0, w: 'm4', x: 0, z: 0 }] });
      live(); netApply('hote~b3', { ...P(foe, 100), b: 1, ev: [{ k: 'hit', i: 4, to: 'moi', d: 1, h: 0, w: 'm4', x: 0, z: 0 }] });
      out.ak = netPresence(PL.ent, performance.now()).ak;

      // morts croisées : je suis vulnérable, chaque cas repart vivant à 100
      const reset = () => { PL.ent.protT = 0; PL.ent.alive = true; PL.ent.health = 100; NET.held.length = 0; };
      const hit = (i, s, d = 150) => ({ k: 'hit', i, to: 'moi', d, h: 0, w: 'm4', x: 0, z: 0, s });
      // 1. j'ai tiré le premier
      reset(); live(); netApply('gT', P(foe, 100, 0)); const t = NET.remotes.get('gT');
      MATCH.timeLeft = 300; shoot(t, 1, 150); const sA = mine(t)[0];
      MATCH.timeLeft = 299.95; // sa balle part 50 ms après la mienne, avant qu'il ne l'ait reçue (accuse 0)
      live(); netApply('gT', { ...P(foe, 100, 0), ev: [hit(1, netStamp())] });
      out.t1Hold = { vivant: PL.ent.alive, attente: NET.held.length, ak: netPresence(PL.ent, performance.now()).ak.gT };
      live(); netApply('gT', { ...P(foe, 0, sA.i, 0), ev: [hit(1, netStamp()), { k: 'kill', i: 2, by: 'moi', h: 0, w: 'm4', x: 0, z: 1, q: sA.i }] });
      netHeldCheck(); out.t1 = { vivant: PL.ent.alive, vie: PL.ent.health, attente: NET.held.length };
      // 2. il a tiré le premier
      reset(); live(); netApply('gU', P(foe, 100, 0)); const u = NET.remotes.get('gU');
      MATCH.timeLeft = 290; const sU = netStamp(); MATCH.timeLeft = 289.95; shoot(u, 1, 150);
      live(); netApply('gU', { ...P(foe, 100, 0), ev: [hit(1, sU)] });
      out.t2 = { vivant: PL.ent.alive, attente: NET.held.length };
      // 3. il avait déjà appliqué ma touche (non mortelle) et vit encore
      reset(); live(); netApply('gV', P(foe, 100, 0)); const v = NET.remotes.get('gV');
      MATCH.timeLeft = 280; shoot(v, 1, 20); const sV = mine(v)[0]; MATCH.timeLeft = 279.95;
      live(); netApply('gV', { ...P(foe, 80, sV.i), ev: [hit(1, netStamp())] });
      out.t3 = { vivant: PL.ent.alive, attente: NET.held.length };
      // 4. sans nouvelles en 0,8 s
      reset(); live(); netApply('gW', P(foe, 100, 0)); const w = NET.remotes.get('gW');
      MATCH.timeLeft = 270; shoot(w, 1, 150); MATCH.timeLeft = 269.95;
      live(); netApply('gW', { ...P(foe, 100, 0), ev: [hit(1, netStamp())] });
      const held4 = NET.held.length; MATCH.time += 0.9; netHeldCheck();
      out.t4 = { attente: held4, vivant: PL.ent.alive, apres: NET.held.length };
      // 5. balle sans heure (version précédente)
      reset(); live(); netApply('gX', P(foe, 100, 0)); const x = NET.remotes.get('gX');
      MATCH.timeLeft = 260; shoot(x, 1, 150);
      live(); netApply('gX', { ...P(foe, 100, 0), ev: [{ ...hit(1), s: undefined }] });
      out.t5 = { vivant: PL.ent.alive, attente: NET.held.length };
      return out;
    });
    ok(r.rafale.join() === 'false,false,false,true', 'rafale de quatre balles : la quatrième fait tomber la cible tout de suite', r.rafale);
    ok(r.pendA.length === 4, 'quatre touches en route gardées', r.pendA);
    ok(r.predApres === -2, 'état qui accuse deux balles (vie 50) : vie prédite -2', r.predApres);
    ok(r.ancien.every((x) => !x) && r.ancienPred === 100, 'victime sans accusé : rien de prédit, vie publiée seule (comme avant)', [r.ancien, r.ancienPred]);
    ok(r.oubli === 100, 'touche jamais accusée oubliée après 2 s', r.oubli);
    ok(r.ak && r.ak.gD === 7 && r.ak['hote~b3'] === 4, 'accusé publié pour le joueur et pour le bot', r.ak);
    ok(r.t1Hold.vivant && r.t1Hold.attente === 1 && r.t1Hold.ak === 0, 'morts croisées, j\'ai tiré le premier : sa balle attend, mon accusé ne la compte pas', r.t1Hold);
    ok(r.t1.vivant && r.t1.vie === 100 && r.t1.attente === 0, 'il annonce sa mort par ma touche : sa balle ne compte pas, je vis', r.t1);
    ok(!r.t2.vivant && r.t2.attente === 0, 'il a tiré le premier : je meurs tout de suite', r.t2);
    ok(!r.t3.vivant && r.t3.attente === 0, 'ma touche déjà appliquée et il vit : sa balle s\'applique tout de suite', r.t3);
    ok(r.t4.attente === 1 && !r.t4.vivant && r.t4.apres === 0, 'sans nouvelles en 0,8 s : sa balle s\'applique', r.t4);
    ok(!r.t5.vivant && r.t5.attente === 0, 'balle sans heure (version précédente) : appliquée tout de suite', r.t5);
    const pe = logs.filter((l) => l.startsWith('[pageerror]'));
    ok(!pe.length, 'aucune erreur de page', pe.slice(0, 3));
  } finally { await browser.close(); }
  if (fails.length) { console.log(`${fails.length} échec(s)`); process.exit(1); }
  console.log('tout est bon');
})();
