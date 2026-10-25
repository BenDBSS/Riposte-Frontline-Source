/* ==========================================================================
   HÉLICOPTÈRE D'APPUI (série à 11 éliminations d'affilée)
   Il survole la carte en cercles, repère les soldats ennemis À DÉCOUVERT (ligne de vue dégagée depuis le ciel : un toit,
   un mur ou une caisse suffisent à être à l'abri) et les arrose en rafales. Il est puissant, mais pas invincible :
   - il arrive de l'horizon en HELI.arrive secondes (approche depuis le côté de son équipe, sans tirer), puis ne reste que HELI.life
     secondes au-dessus de la carte et repart ;
   - il met HELI.lock secondes à verrouiller une cible (le joueur visé est prévenu : il peut se mettre à couvert) ;
   - ses rafales sont imprécises (dispersion) et ses dégâts modestes : un soldat immobile à découvert tombe en quelques rafales,
     un soldat qui bouge ou se met à l'abri s'en sort ;
   - il se tire dessus : HELI.hp points de vie, avec n'importe quelle arme (le fusil de précision l'abat en quelques balles) ;
   - un seul par équipe à la fois, et ses éliminations ne comptent pas dans la série de celui qui l'a appelé.
   En ligne, le propriétaire (le joueur, ou l'hôte pour ses bots) calcule cibles et dégâts ; les autres reçoivent seulement
   de quoi l'afficher (apparition, rafales, destruction) et lui adressent les dégâts qu'ils lui infligent.
   ========================================================================== */
const HELI = {
  life: 34, arrive: 6.5, far: 200, hp: 300, range: 80, alt: 27,
  lock: 0.8, burst: 10, gap: 0.06, cd: 0.5, retarget: 1.0,
  dmg: 21, sigma: 0.005, sigmaD: 0.00018,
};
const _hlA = new V3(), _hlB = new V3(), _hlC = new V3();

function heliActive(team) { return KS.helis.some((h) => h.team === team && h.state !== 'crash'); }

/* ---------- Modèle ----------
   Hélicoptère d'attaque dans l'esprit du Cobra : fuselage étroit et haut, verrière en tandem (tireur devant, pilote surélevé derrière),
   capot moteur sur le dos, ailerons courts portant des paniers de roquettes et des tubes de missiles, tourelle sous le nez, patins,
   poutre de queue avec dérive et rotor anticouple, rotor principal bipale. Camouflage désert (sable, taches brunes) et dos vert.
   Repère : nez vers -z, haut vers +y, mât du rotor à l'origine. Les pièces sont réunies par matière (cinq appels de rendu, contre
   une vingtaine avant) ; la coque reçoit le camouflage par projection plane selon la normale (heliMerge) et le dos vert en couleurs
   de sommets. */
const HELI_ROTOR = { y: 2.02, r: 4.9, tail: [0.2, 1.85, 6.7] };
/* Points de la coque pour les tirs (rayHelis) : sphères [x, y, z, rayon] du nez à la dérive, dans le repère du modèle */
const HELI_HIT = [[0, 0.05, -3.1, 0.95], [0, 0.25, -1.6, 1.15], [0, 0.35, 0.1, 1.35], [0, 0.45, 2.4, 0.6], [0, 0.55, 4.1, 0.5], [0, 1.25, 6.4, 0.7]];
/* Camouflage désert raccordable (taches brunes et claires sur fond sable), dessiné une fois */
function heliCamo() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#b6a173'; g.fillRect(0, 0, N, N);
  let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const blob = (col, n, r0, r1) => {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = rnd() * N, y = rnd() * N, k = 3 + Math.floor(rnd() * 4), a0 = rnd() * TAU;
      for (let j = 0; j < k; j++) {
        const a = a0 + j * 1.9, d = rnd() * r1 * 0.7, r = r0 + rnd() * (r1 - r0), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.6;
        for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, r * 1.5, r * 0.8, a * 0.3, 0, TAU); g.fill(); }
      }
    }
  };
  blob('#8a7149', 9, 9, 20); blob('#cdbd92', 7, 7, 15); blob('#6f5a3a', 5, 5, 11);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
/* Réunit des pièces { geo, m } en une géométrie ; paint : coordonnées de texture par projection plane (axe dominant de la normale,
   0,2 répétition par mètre) et couleur de sommet (dos vert : faces tournées vers le haut, au-dessus de la ligne des patins) */
function heliMerge(parts, paint) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = paint ? new Float32Array(nv * 2) : null, col = paint ? new Float32Array(nv * 3) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), v = new V3(), n = new V3(), nm = new THREE.Matrix3(), G = [0.36, 0.68, 0.36];
  let vo = 0, io = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position, Nn = p.geo.attributes.normal, c = P.count;
    nm.getNormalMatrix(p.m);
    for (let k = 0; k < c; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(p.m); v.toArray(pos, (vo + k) * 3);
      n.fromBufferAttribute(Nn, k).applyMatrix3(nm).normalize(); n.toArray(nor, (vo + k) * 3);
      if (paint) {
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z), S = 0.2;
        const u = ax >= ay && ax >= az ? v.z : v.x, w = ay >= ax && ay >= az ? v.z : v.y;
        uv[(vo + k) * 2] = u * S; uv[(vo + k) * 2 + 1] = w * S;
        const top = p.top === false ? 0 : smoothstep(0.3, 0.7, n.y) * smoothstep(0.1, 0.5, v.y);
        for (let j = 0; j < 3; j++) col[(vo + k) * 3 + j] = 1 + (G[j] - 1) * top;
      }
    }
    if (p.geo.index) { const I = p.geo.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; io += I.length; }
    else { for (let k = 0; k < c; k++) idx[io + k] = vo + k; io += c; }
    vo += c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (paint) { geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  for (const p of parts) p.geo.dispose();
  return geo;
}
function heliGeometry() {
  if (KS.hgeo) return KS.hgeo;
  const body = csmMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, map: heliCamo(), vertexColors: true, roughness: 0.62, metalness: 0.18, envMapIntensity: 0.75 }));
  const dark = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2d2b, roughness: 0.55, metalness: 0.45 }));
  const glass = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x1a2630, roughness: 0.06, metalness: 0.9, envMapIntensity: 1.7 }));
  const blur = new THREE.MeshBasicMaterial({ color: 0x9aa39a, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false });
  const B = [], D = [], GL = [], R = [], T = [], e = new THREE.Euler(), q = new THREE.Quaternion();
  const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new V3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new V3(sx, sy, sz));
  const add = (L, geo, m, o) => { L.push(Object.assign({ geo, m }, o)); };
  const box = (L, w, h, d, ...a) => add(L, new THREE.BoxGeometry(w, h, d), M(...a));
  const rbox = (L, w, h, d, r, ...a) => add(L, new THREE.RoundedBoxGeometry(w, h, d, 2, r), M(...a));
  const cyl = (L, r0, r1, len, seg, ...a) => add(L, new THREE.CylinderGeometry(r0, r1, len, seg), M(...a));
  const sph = (L, x, y, z, sx, sy, sz, ws = 16, hs = 10) => add(L, new THREE.SphereGeometry(1, ws, hs), M(x, y, z, 0, 0, 0, sx, sy, sz));
  // tube entre deux points (patins, traverses, canons)
  const tube = (L, a, b, r, seg = 8) => {
    const A = new V3(...a), Bv = new V3(...b), d = Bv.clone().sub(A), len = d.length();
    const m = new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()), new V3(1, 1, 1));
    add(L, new THREE.CylinderGeometry(r, r, len, seg), m);
  };
  // fuselage : tour (profil le long de z) aplati sur les flancs, le nez effilé, le plus haut sous le capot moteur
  const prof = [[0.0, -4.45], [0.2, -4.38], [0.42, -4.12], [0.6, -3.7], [0.74, -3.1], [0.84, -2.2], [0.9, -1.2], [0.92, 0.0], [0.86, 0.9], [0.68, 1.55], [0.5, 2.0]];
  const fus = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 24); fus.rotateX(Math.PI / 2);
  add(B, fus, M(0, 0.05, 0, 0, 0, 0, 0.6, 0.95, 1));
  // verrière en tandem : tireur devant, pilote surélevé derrière ; cadre sombre entre les deux
  sph(GL, 0, 0.47, -2.95, 0.36, 0.4, 0.95); sph(GL, 0, 0.7, -1.75, 0.4, 0.46, 1.05);
  for (const [y, z, w] of [[0.78, -2.32, 0.7], [0.82, -3.35, 0.5], [1.05, -1.2, 0.62]]) box(D, w, 0.06, 0.08, 0, y, z);
  tube(D, [0, 0.86, -3.6], [0, 1.15, -1.0], 0.025, 6);
  // capot moteur, entrées d'air, tuyère relevée ; carénage du mât, mât, moyeu
  rbox(B, 0.98, 0.62, 2.7, 0.22, 0, 1.0, 0.25);
  for (const sx of [-1, 1]) { cyl(D, 0.2, 0.2, 0.08, 14, sx * 0.47, 1.0, -0.95, 0, 0, Math.PI / 2); rbox(B, 0.1, 0.36, 0.5, 0.04, sx * 0.47, 1.0, -0.72); }
  cyl(D, 0.22, 0.26, 0.55, 14, 0, 1.08, 1.6, -1.25, 0, 0);
  cyl(B, 0.2, 0.3, 0.5, 14, 0, 1.52, 0);
  cyl(D, 0.09, 0.1, 0.4, 10, 0, 1.85, 0);
  // poutre de queue effilée, qui remonte un peu ; plans horizontaux ; dérive en flèche
  const boom = new THREE.CylinderGeometry(0.2, 0.46, 5.0, 14); boom.rotateX(Math.PI / 2);
  add(B, boom, M(0, 0.48, 3.85, -0.05, 0, 0, 0.72, 1, 1));
  box(B, 2.0, 0.06, 0.48, 0, 0.6, 4.75);
  for (const sx of [-1, 1]) box(B, 0.06, 0.34, 0.5, sx * 1.0, 0.6, 4.78);
  const fin = new THREE.Shape(); fin.moveTo(-0.2, 0); fin.lineTo(0.85, 0); fin.lineTo(1.3, 1.95); fin.lineTo(0.72, 2.0); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: false }); fg.rotateY(-Math.PI / 2); fg.translate(0.06, 0, 0);
  add(B, fg, M(0, 0.55, 5.9));
  // ailerons courts (léger dièdre négatif), paniers de roquettes à l'intérieur, tubes de missiles au bout
  for (const sx of [-1, 1]) {
    rbox(B, 1.3, 0.12, 0.8, 0.04, sx * 1.05, -0.12, -0.35, 0, 0, sx * -0.08);
    box(D, 0.08, 0.22, 0.4, sx * 0.95, -0.27, -0.35);
    cyl(B, 0.25, 0.25, 1.35, 16, sx * 0.95, -0.55, -0.4, Math.PI / 2, 0, 0, 1, 1, 1);
    for (const z of [-1.08, 0.28]) cyl(D, 0.22, 0.22, 0.04, 16, sx * 0.95, -0.55, z, Math.PI / 2, 0, 0);
    for (const [ox, oy] of [[-0.1, -0.08], [0.1, -0.08], [-0.1, 0.12], [0.1, 0.12]]) cyl(D, 0.085, 0.085, 1.15, 10, sx * 1.6 + ox, -0.42 + oy, -0.45, Math.PI / 2, 0, 0);
  }
  // tourelle sous le nez et canon à trois tubes
  sph(D, 0, -0.6, -3.55, 0.3, 0.26, 0.3, 14, 10);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3; tube(D, [Math.cos(a) * 0.045, -0.66 + Math.sin(a) * 0.045, -3.7], [Math.cos(a) * 0.045, -0.66 + Math.sin(a) * 0.045, -4.65], 0.03, 6); }
  cyl(D, 0.08, 0.08, 0.3, 10, 0, -0.66, -3.85, Math.PI / 2, 0, 0);
  // patins : deux tubes relevés à l'avant, deux traverses arquées
  for (const sx of [-1, 1]) {
    tube(D, [sx * 0.85, -1.32, -2.0], [sx * 0.85, -1.32, 1.5], 0.06);
    tube(D, [sx * 0.85, -1.32, -2.0], [sx * 0.85, -1.1, -2.45], 0.06);
    for (const z of [-1.25, 0.75]) { tube(D, [sx * 0.85, -1.32, z], [sx * 0.62, -0.95, z], 0.05); tube(D, [sx * 0.62, -0.95, z], [sx * 0.3, -0.78, z], 0.05); }
  }
  // antennes et capteur
  box(D, 0.03, 0.35, 0.18, 0, 1.45, 1.05, -0.3, 0, 0); box(D, 0.03, 0.25, 0.14, 0, -0.85, 0.6);
  // rotor principal bipale (moyeu, pales en léger vrillage) et disque de flou ; rotor anticouple bipale, centré sur son moyeu
  rbox(R, 0.55, 0.14, 0.3, 0.05, 0, HELI_ROTOR.y, 0);
  for (const sx of [-1, 1]) box(R, HELI_ROTOR.r - 0.25, 0.035, 0.36, sx * (HELI_ROTOR.r / 2 + 0.12), HELI_ROTOR.y, 0, sx * 0.06, 0, sx * -0.015);
  const disc = new THREE.CircleGeometry(HELI_ROTOR.r, 28); disc.rotateX(-Math.PI / 2); disc.translate(0, HELI_ROTOR.y - 0.01, 0);
  box(T, 0.05, 1.7, 0.2, 0, 0, 0); cyl(T, 0.1, 0.1, 0.16, 10, 0, 0, 0, 0, 0, Math.PI / 2);
  KS.hgeo = { body, dark, glass, blur, gBody: heliMerge(B, true), gDark: heliMerge(D), gGlass: heliMerge(GL), gRotor: heliMerge(R), disc, gTail: heliMerge(T) };
  return KS.hgeo;
}
function makeHeliMesh() {
  const G = heliGeometry(), g = new THREE.Group(), add = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || g).add(m); return m; };
  add(G.gBody, G.body); add(G.gDark, G.dark); add(G.gGlass, G.glass);
  const rotor = new THREE.Group(); g.add(rotor);
  add(G.gRotor, G.dark, rotor);
  const disc = new THREE.Mesh(G.disc, G.blur); rotor.add(disc);
  // le rotor anticouple tourne autour de son moyeu, sur le flanc droit de la dérive
  const trot = new THREE.Group(); trot.position.set(...HELI_ROTOR.tail); g.add(trot);
  add(G.gTail, G.dark, trot);
  g.userData = { rotor, trot };
  scene.add(g); return g;
}

/* Matières des appareils (chasseurs, bombes, drone, hélicoptère) créées au démarrage et posées, cachées, dans la scène : leurs programmes
   sont compilés avec la carte (gpuCompileScene), pas à la première série d'éliminations, en pleine partie */
function ksWarm() {
  if (KS.warm) return;
  const A = aircraftGeometry(), H = heliGeometry(), F = fpvGeometry(), g = new THREE.Group();
  g.name = 'appareils (compilation)'; g.visible = false;
  for (const [geo, m] of [[A.fus, A.hull], [A.nozzle, A.dark], [A.canopy, A.glass], [A.flame, A.glow], [H.gBody, H.body], [H.gDark, H.dark], [H.gGlass, H.glass], [H.disc, H.blur],
    [F.gB, F.body], [F.gW, F.wrap], [F.gG, F.glass], [F.gP, F.prop], [F.gD, F.blur], [F.gL, F.led]]) {
    const o = new THREE.Mesh(geo, m); o.castShadow = !m.transparent; g.add(o);
  }
  for (const m of [F.haloF, F.haloR]) { const sp = new THREE.Sprite(m); g.add(sp); } // halos des diodes du drone
  g.add(new THREE.Mesh(F.gS, F.ledW));
  g.add(mechaBuild().root, mechaMark()); // mecha (08f-mecha.js) et la marque de son point de chute : leurs matières compilées d'avance
  mechaCockpit(); // son cockpit, caché dans la scène de la vue subjective (08g-mecha-pilote.js)
  scene.add(g); KS.warm = g;
}

/* ---------- Cycle de vie ---------- */
function spawnHeli(owner) {
  if (heliActive(owner.team)) return null;
  const local = !owner.isRemote;
  const h = { owner, team: owner.team, local, t: 0, hp: HELI.hp, state: 'fly', mesh: makeHeliMesh(), pos: new V3(0, 40, 0), yaw: 0, bank: 0,
    phase: owner.team ? Math.PI : 0.5, tgt: null, mode: 'search', modeT: 0.8, burst: null, sTick: 0, warnT: 0, lastAtt: null, spin: 0, vy: 0 };
  heliPose(h, 0); h.snd = heliSoundStart(h);
  KS.helis.push(h);
  return h;
}
/* Trajectoire commune à tous les joueurs (elle ne dépend que du temps h.t) : approche depuis l'horizon, ellipse autour de la carte,
   départ en spirale. Circuit : point et direction de vol au temps T du circuit (0 : fin de l'approche) */
const _hlE = new V3(), _hlF = new V3(), _hlV = new V3();
function heliCircuit(h, T, out) {
  const a = h.phase + T * 0.2, [rx, rz] = CURMAP.def.heli, outK = smoothstep(HELI.life - 3.2, HELI.life, T), k = 1 + outK * 0.9;
  out.set(Math.cos(a) * rx * k, HELI.alt + outK * 30 + Math.sin(T * 0.9) * 0.8, Math.sin(a) * rz * k);
  return Math.atan2(Math.sin(a) * rx, -Math.cos(a) * rz); // cap : la tangente de l'ellipse
}
function heliPose(h, dt) {
  const A = HELI.arrive, y0 = h.yaw;
  if (h.t >= A) { h.yaw = heliCircuit(h, h.t - A, h.pos); h.nose = damp(h.nose === undefined ? 0.07 : h.nose, 0.07, 2, dt); }
  else {
    // approche : courbe d'Hermite du point de l'horizon (HELI.far du centre, du côté de l'entrée du circuit, un peu en arrière sur sa
    // tangente, 12 m plus haut) au point d'entrée, où elle prend la vitesse du circuit ; vol rapide, nez baissé, qui ralentit en arrivant
    heliCircuit(h, 0, _hlE); heliCircuit(h, 0.05, _hlV); _hlV.sub(_hlE).multiplyScalar(A / 0.05);
    const r = hyp(_hlE.x, _hlE.z) || 1, tx = _hlV.x, tz = _hlV.z, tl = hyp(tx, tz) || 1;
    _hlF.set(_hlE.x / r * HELI.far - tx / tl * 60, HELI.alt + 12, _hlE.z / r * HELI.far - tz / tl * 60);
    const s = h.t / A, s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = 3 * s2 - 2 * s3, h11 = s3 - s2;
    const m0x = (_hlE.x - _hlF.x) * 1.3, m0y = (_hlE.y - _hlF.y) * 1.3, m0z = (_hlE.z - _hlF.z) * 1.3;
    h.pos.set(h00 * _hlF.x + h10 * m0x + h01 * _hlE.x + h11 * _hlV.x, h00 * _hlF.y + h10 * m0y + h01 * _hlE.y + h11 * _hlV.y, h00 * _hlF.z + h10 * m0z + h01 * _hlE.z + h11 * _hlV.z);
    const d10 = 3 * s2 - 4 * s + 1, d01 = 6 * s - 6 * s2, d11 = 3 * s2 - 2 * s, d00 = -d01;
    const vx = d00 * _hlF.x + d10 * m0x + d01 * _hlE.x + d11 * _hlV.x, vz = d00 * _hlF.z + d10 * m0z + d01 * _hlE.z + d11 * _hlV.z;
    h.yaw = Math.atan2(-vx, -vz); h.nose = 0.07 + 0.2 * clamp(hyp(vx, vz) / A / 30, 0, 1);
  }
  // inclinaison vers l'intérieur des virages, selon la vitesse de lacet (au circuit, environ 0,16 rad, comme avant)
  const yr = dt > 0 && y0 !== undefined ? angDiff(y0, h.yaw) / dt : 0;
  h.bank = damp(h.bank, clamp(yr * 0.55, -0.45, 0.45), 3, dt);
}
function heliApplyMesh(h, dt) {
  const m = h.mesh, U = m.userData;
  m.position.copy(h.pos);
  m.rotation.set((h.nose === undefined ? 0.07 : h.nose) + (h.state === 'crash' ? Math.sin(h.spin * 0.7) * 0.3 : 0), h.yaw + (h.state === 'crash' ? h.spin : 0), h.bank + (h.state === 'crash' ? 0.5 : 0), 'YXZ');
  const spd = h.state === 'crash' ? 12 : 32;
  U.rotor.rotation.y += dt * spd; U.trot.rotation.x += dt * 45;
}
function heliMuzzle(h, out) { return out.set(0, -0.66, -4.7).applyEuler(h.mesh.rotation).add(h.pos); }

/* ---------- Ciblage ---------- */
function heliCanSee(h, e, from) {
  const ch = entChest(e, _hlA);
  if (from.distanceTo(ch) > HELI.range || smokeBlocks(from, ch)) return false; // (un fumigène le cache)
  if (lineClear(from, ch)) return true;
  return lineClear(from, entHead(e, _hlB));
}
function heliPick(h, from) {
  let best = null, bd = 1e9;
  for (const e of entities) {
    if (!e.alive || e.inMecha || allied(e, h.owner)) continue;
    if (!heliCanSee(h, e, from)) continue;
    const d = from.distanceTo(entChest(e, _hlC));
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function heliStartBurst(h, aim, local) {
  h.burst = { left: HELI.burst, t: 0, aim: aim.clone(), local };
}
/* Une balle : le propriétaire tire un vrai rayon (avec dispersion) et applique les dégâts, les autres n'affichent que la trace */
function heliShoot(h, b) {
  const from = heliMuzzle(h, _hlA.set(0, 0, 0)).clone(), tgt = b.aim.clone();
  const dist = from.distanceTo(tgt), s = HELI.sigma + dist * HELI.sigmaD;
  const dir = tgt.sub(from).normalize();
  dir.x += (Math.random() + Math.random() - 1) * s * 2; dir.y += (Math.random() + Math.random() - 1) * s * 2; dir.z += (Math.random() + Math.random() - 1) * s * 2; dir.normalize();
  const w = rayWorld(from.x, from.y, from.z, dir.x, dir.y, dir.z, HELI.range + 20, 1);
  const wt = w ? w.t : HELI.range + 20;
  const eh = b.local ? rayEntities(from, dir, wt, h.owner) : null;
  const endT = eh ? eh.t : wt, end = from.clone().addScaledVector(dir, endT);
  FX.tracers.add(from, end);
  FX.flash.spawn(from.x, from.y, from.z, 0, 0, 0, 0.04, 0.5, 0.3, 3, 2.2, 1.2, 1, 0);
  sfxHeliGun(from, h);
  if (eh) {
    bloodFx(end, dir, eh.part === 'head');
    const dmg = HELI.dmg * (eh.part === 'head' ? 1.6 : eh.part === 'legs' ? 0.8 : 1);
    eh.ent.lastForce = { dir: dir.clone(), mag: 4, lift: 2, part: eh.part };
    applyDamage(eh.ent, dmg, h.owner, _t('Hélicoptère'), eh.part === 'head', dir, h.pos);
  } else if (w && w.prop) { propShot(w.prop, end, dir, HELI.dmg * 0.6); }
  else if (w) { impactFx(end, new V3(w.nx, w.ny, w.nz), w.m, false); }
}

/* ---------- Boucle ---------- */
function updateHelis(dt) {
  for (let i = KS.helis.length - 1; i >= 0; i--) {
    const h = KS.helis[i];
    if (h.state === 'crash') { heliCrash(h, dt); heliSoundUpdate(h); if (h.dead) { heliSoundStop(h); scene.remove(h.mesh); KS.helis.splice(i, 1); } continue; }
    h.t += dt; heliPose(h, dt);
    if (h.t >= HELI.arrive + HELI.life) { h.state = 'gone'; heliSoundStop(h); scene.remove(h.mesh); KS.helis.splice(i, 1); heliMsg(h, 'leave'); continue; }
    heliApplyMesh(h, dt);
    heliSoundUpdate(h);
    if (h.burst) heliBurstStep(h, dt);
    if (h.local) heliBrain(h, dt);
  }
}
function heliBurstStep(h, dt) {
  const b = h.burst; b.t -= dt;
  while (b.t <= 0 && b.left > 0) { b.t += HELI.gap; b.left--; heliShoot(h, b); }
  if (b.left <= 0) h.burst = null;
}
/* Décisions du propriétaire : chercher, verrouiller, tirer, se reposer */
function heliBrain(h, dt) {
  const from = heliMuzzle(h, _hlC.set(0, 0, 0)).clone();
  if (h.t < HELI.arrive + 1 || h.t > HELI.arrive + HELI.life - 2.5) { h.tgt = null; return; } // approche et départ : pas de tir
  if (MATCH.time < (h.stunT || 0)) { h.tgt = null; h.mode = 'search'; h.modeT = 0.4; return; } // sonné par une IEM (iemFire)
  h.modeT -= dt;
  const ok = h.tgt && h.tgt.alive && heliCanSee(h, h.tgt, from);
  if (h.mode === 'search') {
    if (h.modeT > 0) return;
    h.modeT = 0.3;
    const t = heliPick(h, from);
    if (t) { h.tgt = t; h.mode = 'lock'; h.modeT = HELI.lock; h.warnT = 0; heliWarn(h, true); }
  } else if (h.mode === 'lock') {
    if (!ok) { h.tgt = null; h.mode = 'search'; h.modeT = 0.4; return; }
    heliWarn(h, false, dt);
    if (h.modeT <= 0) heliFire(h);
  } else if (h.mode === 'fire') {
    if (h.burst) return;
    h.mode = 'rest'; h.modeT = HELI.cd;
  } else if (h.mode === 'rest') {
    if (h.modeT > 0) return;
    if (!h.tgt || !h.tgt.alive) { h.tgt = null; h.mode = 'search'; h.modeT = HELI.retarget; return; }
    if (!ok) { h.tgt = null; h.mode = 'search'; h.modeT = 0.4; return; }
    heliFire(h);
  }
}
function heliFire(h) {
  const t = h.tgt, aim = entChest(t, new V3());
  heliStartBurst(h, aim, true); h.mode = 'fire';
  netHeliFire(h, aim, t);
}
/* Le joueur visé est prévenu pendant le verrouillage (il a le temps de se mettre à couvert) */
function heliWarn(h, first, dt) {
  if (h.tgt !== PL.ent) return;
  if (first) { hudMsg(_t('Hélicoptère : vous êtes ciblé !'), 'enemy', HELI.lock); sfxKs('lock'); h.warnT = 0.3; return; }
  h.warnT -= dt; if (h.warnT <= 0) { h.warnT = 0.22; sfxKs('lock'); }
}

/* ---------- Dégâts subis, destruction ---------- */
function rayHelis(shooter, o, d, maxT) {
  if (!KS.helis.length) return null;
  let best = null, bt = maxT;
  for (const h of KS.helis) {
    if (h.state === 'crash' || allied(shooter, h.owner)) continue;
    // d'abord la sphère qui englobe l'appareil, puis les sphères de la coque (HELI_HIT), du nez à la dérive
    const px = h.pos.x - o.x, py = h.pos.y - o.y, pz = h.pos.z - o.z, tp = px * d.x + py * d.y + pz * d.z;
    if (tp < -8 || px * px + py * py + pz * pz - tp * tp > 64) continue;
    for (const [x, y, z, r] of HELI_HIT) {
      _hlA.set(x, y, z).applyEuler(h.mesh.rotation).add(h.pos);
      const cx = _hlA.x - o.x, cy = _hlA.y - o.y, cz = _hlA.z - o.z, t = cx * d.x + cy * d.y + cz * d.z;
      if (t < 0) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t; if (d2 > r * r) continue;
      const th = t - Math.sqrt(r * r - d2);
      if (th < bt) { bt = th; best = h; }
    }
  }
  return best ? { heli: best, t: bt } : null;
}
function heliDamage(h, dmg, shooter) {
  if (h.state === 'crash' || !shooter || shooter.isRemote) return;
  if (shooter.isPlayer) hitFeedback(false, false);
  if (h.local) { h.hp -= dmg; h.lastAtt = shooter; if (h.hp <= 0) heliDown(h); }
  else netHeliHit(h, dmg, shooter);
}
/* Dégâts reçus d'un joueur distant : c'est le propriétaire qui les applique */
function heliHitFrom(ownerEnt, dmg, from) {
  const h = KS.helis.find((x) => x.owner === ownerEnt && x.local && x.state !== 'crash');
  if (!h) return;
  h.hp -= clamp(+dmg || 0, 0, 250); h.lastAtt = from;
  if (h.hp <= 0) heliDown(h);
}
function heliDown(h) {
  if (h.state === 'crash') return;
  h.state = 'crash'; h.burst = null; h.vy = 0; h.spin = 0;
  const att = h.lastAtt;
  if (att && !att.isRemote && !allied(att, h.owner)) {
    att.score += 100;
    if (att.isPlayer) xpPopup('+100', _t('Hélicoptère abattu'));
  }
  heliMsg(h, 'down');
  netHeliDown(h);
}
function heliCrash(h, dt) {
  h.vy -= 14 * dt; h.pos.y += h.vy * dt; h.spin += dt * 4; h.pos.x += Math.cos(h.yaw) * dt * 2;
  heliApplyMesh(h, dt);
  h.smokeT = (h.smokeT || 0) - dt;
  if (h.smokeT <= 0) { h.smokeT = 0.04; FX.smoke.spawn(h.pos.x, h.pos.y, h.pos.z, rand(-0.6, 0.6), rand(0.2, 1), rand(-0.6, 0.6), 1.6, 0.8, 3, 0.15, 0.14, 0.13, 0.6, 0, 0, 0.5); FX.add.spawn(h.pos.x, h.pos.y, h.pos.z, 0, 0.4, 0, 0.1, 1.4, 0.6, 5, 2.4, 0.9, 0.8, 0); }
  const g = groundHeight(h.pos.x, h.pos.z, h.pos.y, 0.5);
  if (h.pos.y <= g + 1.2 || h.pos.y < 0) {
    h.dead = true; const p = new V3(h.pos.x, Math.max(g, 0), h.pos.z);
    explosionFx(p); sfxExplosion(p); kcEvent('boom', { p: p.clone() });
    const dc = p.distanceTo(camera.position); PL.shake = Math.max(PL.shake, clamp(1 - dc / 40, 0, 1) * 1.5);
  }
}
function heliMsg(h, what) {
  const ally = h.team === PL.ent.team, mine = h.owner === PL.ent;
  if (what === 'spawn') {
    sfxAnnounce(ksFriendly(h.owner) ? 'heli_on' : 'heli_enemy');
    hudMsg(ally ? (mine ? _t('Hélicoptère en approche') : `${_t('Hélicoptère allié ({0})', h.owner.name)}`) : _t('Hélicoptère ennemi en approche ! Mettez-vous à couvert'), ally ? 'ally' : 'enemy', 3);
  } else if (what === 'down') {
    sfxAt('k_heli_crash', h.pos, 2.2, { prop: false, ref: 14, roll: 0.8, verb: 0.3 });
    hudMsg(ally ? _t('Votre hélicoptère est abattu') : _t('Hélicoptère ennemi abattu'), ally ? 'enemy' : 'ally', 2.5);
  } else if (what === 'leave') {
    hudMsg(ally ? _t('Hélicoptère allié parti') : _t('Hélicoptère ennemi parti'), ally ? 'ally' : 'none', 2);
  }
}
function clearHelis() { for (const h of KS.helis) { heliSoundStop(h); scene.remove(h.mesh); } KS.helis.length = 0; }

/* ---------- Appel par le joueur ou par un bot ---------- */
function callHeli(owner) {
  const h = spawnHeli(owner);
  if (!h) return false;
  heliMsg(h, 'spawn'); netHeliCall(owner);
  return true;
}
function useHeli() {
  if (!PL.ks.heli) return;
  if (heliActive(PL.ent.team)) { hudMsg(_t('Un hélicoptère est déjà en vol'), 'none', 1.8); return; }
  if (ksStart('heli')) { PL.ks.heli = false; updateStreakHud(); }
}
