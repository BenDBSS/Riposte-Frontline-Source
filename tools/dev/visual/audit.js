/* Audit d'une ou de plusieurs cartes : node audit.js [carte...] [--par 3] [--sans fentes,zfight]   (sans carte : toutes)
   Lance sur chaque carte leveldesign.js, navigation.js, decor.js, fentes.js, accroches.js, zfight.js et traversee.js (MAP=...), confronte les mesures aux seuils de
   README, « Règles de conception d'une carte » (selon le type de la carte) et aux règles communes, puis :
   - écrit audits/<carte>.json, le relevé condensé (mesures, défauts, ce qui sort des seuils), versionné avec la carte : c'est la référence
     de la prochaine retouche ;
   - affiche, carte par carte, ce qui sort des seuils et l'écart avec la référence précédente (le audits/<carte>.json d'avant ce passage, ou
     celui du dossier AVANT=...).
   --par : cartes traitées en parallèle (2 par défaut ; chaque outil ouvre un Chromium à rendu logiciel). --sans : outils à sauter (leurs
   résultats sont repris du relevé précédent) ; --seul : les seuls outils à relancer, séparés par des virgules (de même).
   Compter de 5 à 10 minutes par carte. Code d'erreur si une carte a un défaut bloquant (décor, fente, passe-balle, trou, accroche, navigation,
   z-fighting, paire de points clés qu'on ne relie pas à la marche). */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const HERE = __dirname, OUT = path.join(HERE, 'audits'), AVANT = process.env.AVANT ? path.resolve(process.env.AVANT) : OUT;
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CARTES = ['sable', 'givre', 'embruns', 'floreal', 'meltem', 'tephra', 'stratus', 'simoun', 'lotissement'];
const NOMS = { sable: 'Khamsin', givre: 'Val-Blanc', embruns: 'Kervénec', floreal: 'Hortus', meltem: 'Meltem', tephra: 'Tephra', stratus: 'Stratus', simoun: 'Simoun', lotissement: 'French Dream' };
const OUTILS = ['leveldesign', 'navigation', 'decor', 'fentes', 'accroches', 'zfight', 'traversee'], seul = (opt('--seul', '') || '').split(',').filter(Boolean);
const skip = new Set(seul.length ? OUTILS.filter((t) => !seul.includes(t)) : (opt('--sans', '') || '').split(',').filter(Boolean)), par = +opt('--par', 2);
const cartes = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
// un identifiant inconnu : les outils prendraient la carte par défaut (Khamsin) et le relevé irait sous un faux nom
for (const c of cartes) if (!CARTES.includes(c)) { console.error(`carte inconnue : ${c} (identifiants : ${CARTES.map((k) => k + ' = ' + NOMS[k]).join(', ')})`); process.exit(2); }
// seuils par type (README, tableau « Seuils par type »)
const SEUIL = {
  vue: { close: [6, 9], mid: [9, 13], open: [12, 18] }, courte: { close: [20, 40], mid: [5, 20], open: [0, 8] }, loin: { close: [0, 5], mid: [0, 10], open: [15, 30] },
  place: { close: [15, 100], mid: [25, 45], open: [40, 100] }, haut: { close: [5, 10], mid: [3, 10], open: [5, 12] }, couverts: { close: 5, mid: 5, open: 6 },
};
// écarts acceptés par le propriétaire (README, valeurs mesurées en octobre 2026) : signalés, pas comptés
const ACCEPTE = { stratus: ['loin', 'place'], simoun: ['vue', 'loin', 'marche', 'haut'] };

function run(tool, map, json) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [path.join(HERE, tool + '.js')].concat(json ? ['--json'] : []), { env: Object.assign({}, process.env, { MAP: map, TOP: '400' }), cwd: HERE });
    let out = '', err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 30 * 60 * 1000);
    p.on('close', (code) => { clearTimeout(t); res({ code, out, err }); });
  });
}
const parse = (s) => { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } };
const r1 = (v) => Math.round(v * 10) / 10;

async function audit(map, B) {
  const t0 = Date.now(), A = { carte: map, nom: NOMS[map] || map, date: new Date().toISOString().slice(0, 10), mesures: {}, defauts: {}, hors: [], acceptes: [] };
  // un outil sauté garde ses résultats du relevé précédent (et, pour leveldesign, ce qui sortait des seuils)
  if (B) { if (skip.has('leveldesign')) { A.mesures = B.mesures || {}; A.hors = B.hors || []; A.acceptes = B.acceptes || []; } for (const t of OUTILS) if (skip.has(t) && B.defauts && B.defauts[t]) A.defauts[t] = B.defauts[t]; }
  const hors = (cle, txt) => ((ACCEPTE[map] || []).includes(cle) ? A.acceptes : A.hors).push(txt);
  if (!skip.has('leveldesign')) {
    const L = parse((await run('leveldesign', map, true)).out);
    if (!L) A.hors.push('leveldesign.js sans résultat');
    else {
      const t = L.type || 'mid', li = L.lisibilite, sp = L.spawns, m = A.mesures;
      Object.assign(m, { type: t, vueMoyenne: li.vueMoyenne, solVueCourte: li.partVueMoyenneSous6m, vuesPlus60m: r1((100 * L.los.plusDe60m) / L.los.noeudsAuSol), partPlace: li.partPlace, partEnHauteur: L.vertical.partEnHauteur,
        marche: [sp.walkAlphaToBravoMin, sp.walkAlphaToBravoMax], routes: L.routes.distinctesSousUnTiersEtDemi, impasses: li.impasses, detour90: li.detour90, carrefours: li.carrefoursRoutePlusCourte,
        repere: li.auMoinsUnRepere === undefined ? null : li.auMoinsUnRepere, goulot: L.goulot ? { front: L.goulot.front, passages: L.goulot.passages, detail: L.goulot.detail.slice(0, 8) } : null,
        viragesSerres: L.virages ? L.virages.reduce((s, v) => s + v.serres, 0) : null, viragesOu: L.virages ? [].concat(...L.virages.map((v) => v.ou)).slice(0, 12) : [],
        points: L.dom.map((d, i) => ({ nom: 'ABC'[i], point: d.point, entrees: d.entrees, praticable: d.praticable, couverts9m: d.couverts9m, marche: [d.marcheMoyenneAlpha, d.marcheMoyenneBravo], vuDesApparitions: [d.apparitionsAlphaQuiVoient, d.apparitionsBravoQuiVoient] })) });
      const chk = (cle, nom, v, [lo, hi]) => { if (v < lo || v > hi) hors(cle, `${nom} ${v} (${lo} à ${hi})`); };
      chk('vue', 'vue moyenne (m)', m.vueMoyenne, SEUIL.vue[t]); chk('courte', 'sol à vue courte (%)', m.solVueCourte, SEUIL.courte[t]); chk('loin', 'vues de plus de 60 m (%)', m.vuesPlus60m, SEUIL.loin[t]);
      chk('place', 'part de place (%)', m.partPlace, SEUIL.place[t]); chk('haut', 'réseau en hauteur (%)', m.partEnHauteur, SEUIL.haut[t]);
      if (sp.seenByEnemySpawnAlpha || sp.seenByEnemySpawnBravo) hors('apparitions', `apparitions vues du camp adverse : ${sp.seenByEnemySpawnAlpha} et ${sp.seenByEnemySpawnBravo}`);
      if (sp.minGap < 2.2) hors('apparitions', `apparitions à ${sp.minGap} m l'une de l'autre (2,2 au moins)`);
      if (m.marche[0] < 90 || m.marche[1] > 105) hors('marche', `marche d'un camp à l'autre ${m.marche[0]} à ${m.marche[1]} m (90 à 105)`);
      if (m.routes < 4) hors('routes', `routes distinctes ${m.routes} (4 au moins)`);
      if (m.impasses > 2) hors('impasses', `impasses ${m.impasses} (2 au plus)`);
      if (m.detour90 > 1.5) hors('detour', `détour au 90e centile ${m.detour90} (1,5 au plus)`);
      if (m.carrefours > 8) hors('carrefours', `carrefours sur la route la plus courte ${m.carrefours} (8 au plus)`);
      if (m.repere === null) hors('repere', 'aucun repère déclaré (MAP_DEFS.<id>.landmarks)'); else if (m.repere < 60) hors('repere', `repère vu de ${m.repere} % du sol (60 au moins)`);
      if (m.goulot && m.goulot.passages < 3) hors('goulot', `${m.goulot.passages} passage${m.goulot.passages > 1 ? 's' : ''} au plus étroit du milieu (3 au moins : pas de goulot absolu)`);
      if (m.viragesSerres) hors('virages', `${m.viragesSerres} virage${m.viragesSerres > 1 ? 's' : ''} de plus de 90° sur les routes`);
      const nA = (L.spawns.alpha || 1) / 3;
      m.points.forEach((p) => {
        if (p.praticable < 70) hors('points', `${p.nom} praticable à ${p.praticable} % (70 au moins)`);
        if (typeof p.entrees === 'number' && (p.entrees < 2 || p.entrees > 4)) hors('entrees', `${p.nom} : ${p.entrees} entrée${p.entrees > 1 ? 's' : ''} (2 à 4, ou ouvert)`);
        if (p.nom !== 'B') {
          const base = p.nom === 'A' ? p.marche[0] : p.marche[1];
          if (base < 20 || base > 30) hors('points', `${p.nom} à ${base} m de marche de sa base (20 à 30)`);
          if (p.couverts9m < SEUIL.couverts[t]) hors('points', `${p.nom} : ${p.couverts9m} couverts à 9 m (${SEUIL.couverts[t]} au moins)`);
          if ((p.nom === 'A' ? p.vuDesApparitions[0] : p.vuDesApparitions[1]) > nA) hors('points', `${p.nom} vu de plus d'un tiers des apparitions de son camp`);
        } else {
          if (Math.abs(p.marche[0] - p.marche[1]) > 5) hors('points', `B pas à égalité de marche (${p.marche[0]} et ${p.marche[1]} m)`);
          if (p.vuDesApparitions[0] || p.vuDesApparitions[1]) hors('points', 'B vu depuis une apparition');
        }
      });
    }
  }
  if (!skip.has('navigation')) {
    const r = await run('navigation', map, false), t = r.out + '\n' + r.err, i = t.indexOf('ÉCHEC'), l = i >= 0 ? t.slice(i).split('\n').slice(1).filter((x) => /^(apparition|point)/.test(x)) : []; // ÉCHEC part sur la sortie d'erreur
    A.defauts.navigation = l;
  }
  if (!skip.has('decor')) {
    const D = parse((await run('decor', map, true)).out);
    if (D) A.defauts.decor = { portes: D.doorBlocked.length, pots: D.potsBad.filter((p) => p.defauts.some((d) => /enfoncé|en l'air/.test(d))).length, affiches: D.decalsBad.length, velos: D.bikesBad.length, ponts: D.headsBlocked.length, sable: D.sand.length, recouvrements: D.overlaps.length, liste: [].concat(D.doorBlocked.map((d) => 'porte ' + (d.porte || d.door || JSON.stringify(d)).toString().slice(0, 160)), D.overlaps.map((o) => 'recouvrement ' + o.objets)).slice(0, 40) };
  }
  if (!skip.has('fentes')) {
    const F = parse((await run('fentes', map, true)).out);
    if (F) A.defauts.fentes = { fentes: F.fentes.filter((f) => f.vu).length, passeBalles: F.passe.filter((f) => f.vu).length, trous: F.trous.filter((f) => f.vu).length, marges: F.marges.length, margesPlus30cm: F.marges.filter((m) => m.marge > 0.3).length, liste: [].concat(F.fentes.map((f) => `fente (${f.x}, ${f.z}) ${f.ecart} cm`), F.passe.map((f) => `passe-balle (${f.x}, ${f.z}) ${f.ecart} cm`), F.trous.map((t) => `trou (${t.x}, ${t.z}) ${t.large} m`), F.marges.slice(0, 20).map((m) => `marge ${m.marge} m (${m.x}, ${m.z}) ${m.mat}`)) };
  }
  if (!skip.has('accroches')) {
    const K = parse((await run('accroches', map, true)).out);
    if (K) A.defauts.accroches = { nombre: K.accroches.length, chemins: K.chemins, liste: K.accroches.slice(0, 30).map((a) => `(${a.x}, ${a.y}, ${a.z}) ${a.zone}, montée ${a.montee} m, ${a.fois} fois`) };
  }
  if (!skip.has('zfight')) {
    const Z = parse((await run('zfight', map, true)).out);
    if (Z) A.defauts.zfight = { visibles: Z.list.filter((h) => h.vu > 0).length, bloquants: Z.bad, liste: Z.list.filter((h) => !h.same && h.area > 0.1 && h.vu > 0).slice(0, 20).map((h) => `(${h.x}, ${h.y}, ${h.z}) ${h.area} m² ${h.mats}`) };
  }
  if (!skip.has('traversee')) {
    // la carte se traverse-t-elle à pied (retour du propriétaire, octobre 2026) : paires de points clés sans chemin à la marche, ou plus longues de 25 %
    const T = parse((await run('traversee', map, true)).out);
    if (T) A.defauts.traversee = { paires: T.mauvaises.length, sur: T.paires, liste: T.mauvaises.slice(0, 20).map((p) => `${p.de} > ${p.vers} : ${p.avec} m avec sauts, ${p.marche === null ? 'aucun chemin' : p.marche + ' m'} à la marche`), sauts: T.sauts.slice(0, 10).map((e) => `(${e.x}, ${e.z}) ${e.kind} de ${e.y0} à ${e.y1} m : ${e.n}`) };
  }
  const d = A.defauts;
  A.bloquants = (d.navigation ? d.navigation.length : 0) + (d.decor ? d.decor.portes + d.decor.pots + d.decor.affiches + d.decor.velos + d.decor.ponts + d.decor.sable + d.decor.recouvrements : 0) + (d.fentes ? d.fentes.fentes + d.fentes.passeBalles + d.fentes.trous : 0) + (d.accroches ? d.accroches.nombre : 0) + (d.zfight ? d.zfight.bloquants : 0) + (d.traversee ? d.traversee.paires : 0);
  A.minutes = r1((Date.now() - t0) / 60000);
  return A;
}

function show(A, B) {
  const m = A.mesures, d = A.defauts, delta = (k, v) => { const o = B && B.mesures ? B.mesures[k] : undefined; return o === undefined || o === v || typeof v !== 'number' ? '' : ` (avant ${o})`; };
  console.log(`\n${A.nom} (${A.carte}, ${m.type || '?'}) : ${A.hors.length} hors seuil, ${A.bloquants} défaut${A.bloquants > 1 ? 's' : ''} bloquant${A.bloquants > 1 ? 's' : ''}${B ? ` (avant : ${B.hors.length} et ${B.bloquants})` : ''} ; ${A.minutes} min`);
  if (m.vueMoyenne !== undefined) console.log(`  vue ${m.vueMoyenne} m${delta('vueMoyenne', m.vueMoyenne)}, sol à vue courte ${m.solVueCourte} %, vues > 60 m ${m.vuesPlus60m} %${delta('vuesPlus60m', m.vuesPlus60m)}, place ${m.partPlace} %, en hauteur ${m.partEnHauteur} %${delta('partEnHauteur', m.partEnHauteur)}, routes ${m.routes}, impasses ${m.impasses}${delta('impasses', m.impasses)}, carrefours ${m.carrefours}, goulot ${m.goulot ? m.goulot.front + ' m en ' + m.goulot.passages + ' passages' : '?'}, points ${m.points.map((p) => p.nom + ' ' + p.entrees).join(', ')}`);
  if (d.decor) console.log(`  décor : portes ${d.decor.portes}, pots ${d.decor.pots}, affiches ${d.decor.affiches}, vélos ${d.decor.velos}, ponts ${d.decor.ponts}, sable ${d.decor.sable}, recouvrements ${d.decor.recouvrements}`);
  if (d.fentes) console.log(`  rendu et collisions : fentes ${d.fentes.fentes}, passe-balles ${d.fentes.passeBalles}, trous ${d.fentes.trous}, marges ${d.fentes.marges} (dont ${d.fentes.margesPlus30cm} de plus de 30 cm)`);
  if (d.accroches) console.log(`  accroches (on reste coincé en marchant, ${d.accroches.chemins} chemins) : ${d.accroches.nombre}`);
  if (d.zfight) console.log(`  z-fighting : ${d.zfight.visibles} endroits visibles, ${d.zfight.bloquants} de plus de 0,1 m² entre deux matières`);
  if (d.traversee) console.log(`  traversée à pied : ${d.traversee.paires} paire${d.traversee.paires > 1 ? 's' : ''} sur ${d.traversee.sur} sans chemin à la marche ou plus longue de 25 %`);
  if (d.navigation) console.log(`  navigation : ${d.navigation.length} point${d.navigation.length > 1 ? 's' : ''} hors du réseau`);
  for (const h of A.hors) console.log('  HORS SEUIL : ' + h);
  for (const h of A.acceptes) console.log('  accepté : ' + h);
}

(async () => {
  const list = cartes.length ? cartes : CARTES;
  fs.mkdirSync(OUT, { recursive: true });
  const res = [], todo = list.slice();
  await Promise.all(Array.from({ length: Math.max(1, par) }, async () => {
    while (todo.length) {
      const map = todo.shift(), file = path.join(OUT, map + '.json'), ref = path.join(AVANT, map + '.json');
      const B = fs.existsSync(ref) ? JSON.parse(fs.readFileSync(ref, 'utf8')) : null, A = await audit(map, B);
      fs.writeFileSync(file, JSON.stringify(A, null, 1) + '\n');
      show(A, B); res.push(A);
    }
  }));
  console.log(`\n${res.length} carte${res.length > 1 ? 's' : ''} : ${res.reduce((s, a) => s + a.hors.length, 0)} mesures hors seuil, ${res.reduce((s, a) => s + a.bloquants, 0)} défauts bloquants ; relevés dans ${path.relative(process.cwd(), OUT) || OUT}`);
  process.exit(res.some((a) => a.bloquants) ? 1 : 0);
})();
