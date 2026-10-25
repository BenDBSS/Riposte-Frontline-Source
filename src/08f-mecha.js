/* ==========================================================================
   MECHA « ARPENTEUR » (série à 13) : modèle et squelette
   D'après le concept du propriétaire (S-7 Strider) : bipède sans bras, torse anguleux à cockpit vitré en pointe, deux nacelles de
   mitrailleuses rotatives sur les flancs, antenne, moteur arrière à fente orange ; jambes armurées, genou vers l'avant, vérins,
   articulations rondes cerclées d'orange, pieds à deux orteils et talon. Le modèle est dessiné à 4 m et réduit en jeu (MECHA.k) : 2,6 m
   de coque, 3 m antenne comprise, 1,75 m de large (retour du propriétaire : plus grand qu'un soldat, mais il doit circuler dans la carte).
   Squelette pensé pour l'animation : racine (au sol, cap de la marche) > bassin (hauteur, roulis de la foulée) > pivot du torse
   (le torse vise comme une tourelle, indépendamment des jambes) > nacelles (tangage) > canons (rotation) ; bassin > hanche >
   cuisse > genou > tibia > cheville > pied. Les jambes ne plient que dans le plan avant-arrière (cinématique inverse à deux
   segments, mechaLeg) : le pied reste à plat, posé où on le veut.
   ========================================================================== */
/* Dimensions du modèle (m, avant réduction) : hanches (écart, hauteur debout), cuisse, tibia, hauteur de la cheville au-dessus du sol ;
   k : échelle en jeu (la racine est réduite d'autant ; les poses restent en mesures du modèle) */
const MECHA = { hipX: 0.62, thigh: 1.1, shin: 1.15, ankle: 0.3, stand: 2.2, k: 0.68 };
const MECHA_G = { geo: null };

/* Plaques de blindage : kaki militaire usé, joints de panneaux sombres, éraflures claires sur les arêtes, rivets ; dessinées une fois, répétées */
function mechaArmorTex() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  let sd = 29; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#5b5f48'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(40,42,30,${(0.05 + rnd() * 0.12).toFixed(2)})` : `rgba(120,124,98,${(0.04 + rnd() * 0.1).toFixed(2)})`; g.fillRect(rnd() * N, rnd() * N, 2 + rnd() * 18, 2 + rnd() * 18); }
  // joints de panneaux (grille irrégulière) et rivets aux coins
  g.strokeStyle = 'rgba(18,19,14,0.85)'; g.lineWidth = 2;
  for (const x of [0, 96, 170]) { g.beginPath(); g.moveTo(x + 1, 0); g.lineTo(x + 1, N); g.stroke(); }
  for (const y of [0, 70, 150, 210]) { g.beginPath(); g.moveTo(0, y + 1); g.lineTo(N, y + 1); g.stroke(); }
  g.fillStyle = 'rgba(25,26,20,0.9)'; for (const x of [8, 104, 178]) for (const y of [8, 78, 158, 218]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
  // éraflures : traits clairs courts près des joints
  g.strokeStyle = 'rgba(170,170,150,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const x = rnd() * N, y = rnd() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
/* Marquages (décalcomanies) : « 07 » en blanc cassé, chevron du camp ; un atlas de deux cases */
function mechaDecalTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(222,220,206,0.88)';
  g.font = '700 92px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('07', 64, 68);
  g.beginPath(); g.moveTo(150, 30); g.lineTo(196, 64); g.lineTo(150, 98); g.lineTo(166, 64); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(186, 30); g.lineTo(232, 64); g.lineTo(186, 98); g.lineTo(202, 64); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}

/* Surfaces photo du mecha (assets/tex/mecha, mechadark : python3 tools/build_mecha_tex.py, d'après des textures CC0 de Poly Haven et
   d'ambientCG) : le blindage (peinture kaki d'un métal de char, éclats et rayures qui découvrent l'acier, joints et rivets en relief) ; la
   mécanique sombre et l'acier (tôle rayée, teinte des matières). Chargées au lancement de la première carte, avant la compilation des
   shaders (mapBuild), puis gardées ; sans elles (réseau coupé), les plaques dessinées (mechaArmorTex). */
function mechaTexLoad() {
  if (!MECHA_G.texP) MECHA_G.texP = (() => { const T = {}; return loadAssetTextures(T, ['mecha', 'mechadark']).then(() => { MECHA_G.tex = T; mechaTexApply(); }); })();
  return MECHA_G.texP;
}
function mechaTexApply() {
  const T = MECHA_G.tex, G = MECHA_G.geo; if (!T || !G || G.photo) return;
  const A = T.mecha, D = T.mechadark;
  const set = (m, S, rep, o) => {
    for (const t of [S.map, S.normal, S.rough]) t.repeat.set(rep, rep);
    m.map = S.map; m.normalMap = S.normal; m.roughnessMap = S.rough; Object.assign(m, o); m.needsUpdate = true;
  };
  // (l'image de la mécanique est grise, autour de 190 en sRGB, 0,51 linéaire : la teinte de la matière en est relevée d'autant)
  if (A) set(G.mat.armor, A, 3, { metalnessMap: A.rough, metalness: 0.45, roughness: 1, color: new THREE.Color(0xffffff) }); // (bleu de la rugosité : l'acier découvert)
  if (D) {
    set(G.mat.dark, D, 6, { roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) }); G.mat.dark.color.multiplyScalar(1 / 0.51);
    set(G.mat.steel, D, 6, { roughness: 0.6, normalScale: new THREE.Vector2(0.5, 0.5) }); G.mat.steel.color.multiplyScalar(1 / 0.51);
  }
  G.photo = true;
  if (MECHA_P.cock) mechaCockpitTex(); // le cockpit (08g-mecha-pilote.js), construit avant
}
/* ---------- Modèle ----------
   Chaque segment du squelette a ses pièces réunies par matière : blindage (texture projetée), mécanique sombre, acier des vérins et des canons,
   verre du cockpit, lumières orange, marquages. */
function mechaGeometry() {
  if (MECHA_G.geo) return MECHA_G.geo;
  const armorMap = mechaArmorTex(); armorMap.repeat.set(3, 3);
  const mat = {
    armor: csmMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, map: armorMap, roughness: 0.78, metalness: 0.18, envMapIntensity: 0.5 })),
    dark: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.55, metalness: 0.55, envMapIntensity: 0.6 })),
    steel: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x8a8f93, roughness: 0.32, metalness: 0.85, envMapIntensity: 0.8 })),
    glass: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.4 })),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.0, 0.62, 0.1) }),
    decal: new THREE.MeshBasicMaterial({ map: mechaDecalTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0x8c8a80 }),
  };
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new V3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new V3(1, 1, 1));
  /* Un segment : listes de pièces par matière ; build() les réunit (une géométrie par matière) */
  const seg = () => {
    const L = { armor: [], dark: [], steel: [], glass: [], glow: [], decal: [] };
    const S = {
      L,
      box: (m, w, h, d, ...a) => { L[m].push({ geo: new THREE.BoxGeometry(w, h, d), m: M(...a), top: false }); return S; },
      rbox: (m, w, h, d, r, ...a) => { L[m].push({ geo: new THREE.RoundedBoxGeometry(w, h, d, 2, r), m: M(...a), top: false }); return S; },
      cyl: (m, r0, r1, h, n, ...a) => { L[m].push({ geo: new THREE.CylinderGeometry(r0, r1, h, n), m: M(...a), top: false }); return S; },
      // cylindre couché sur l'axe x (articulations, moyeux)
      axle: (m, r, len, n, x, y, z) => S.cyl(m, r, r, len, n, x, y, z, 0, 0, Math.PI / 2),
      // tube entre deux points (vérins, câbles)
      tube: (m, A, B, r, n = 8) => {
        const a0 = new V3(...A), b0 = new V3(...B), d = b0.clone().sub(a0), len = d.length();
        L[m].push({ geo: new THREE.CylinderGeometry(r, r, len, n), m: new THREE.Matrix4().compose(a0.clone().add(b0).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()), new V3(1, 1, 1)), top: false });
        return S;
      },
      // prisme : profil [z, y] extrudé sur x (largeur w, centré), arêtes chanfreinées
      prism: (m, prof, w, x = 0, y = 0, z = 0, bev = 0.03) => {
        const sh = new THREE.Shape(); prof.forEach(([pz, py], i) => (i ? sh.lineTo(pz, py) : sh.moveTo(pz, py))); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: w - bev * 2, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 1 });
        g.rotateY(-Math.PI / 2); g.translate(w / 2 - bev, 0, 0); // profil (z, y) : x de la forme vers z, extrusion vers -x, centrée
        L[m].push({ geo: g, m: M(x, y, z), top: false });
        return S;
      },
      // marquage : case de l'atlas (0 : « 07 », 1 : chevron), plaqué sur une face (normale n : 'x+', 'x-', 'z-')
      decal: (cell, w, h, x, y, z, face) => {
        const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (cell + uv.getX(k)) / 2);
        const ry = face === 'x+' ? Math.PI / 2 : face === 'x-' ? -Math.PI / 2 : face === 'z-' ? Math.PI : 0;
        L.decal.push({ geo: g, m: M(x, y, z, 0, ry, 0), top: false });
        return S;
      },
      build: () => { const o = {}; for (const k in L) if (L[k].length) o[k] = k === 'decal' ? mechaMergeUv(L[k]) : heliMerge(L[k], k === 'armor' || k === 'dark' || k === 'steel'); return o; }, // (coordonnées de texture projetées : blindage, mécanique)
    };
    return S;
  };

  // --- bassin : bloc des hanches, pivot du torse, carters des hanches
  const pelvis = seg();
  pelvis.rbox('dark', 0.95, 0.42, 0.7, 0.06, 0, 0, 0.02);
  pelvis.cyl('dark', 0.36, 0.42, 0.22, 16, 0, 0.3, 0.02); // couronne du pivot
  for (const sx of [-1, 1]) {
    pelvis.axle('dark', 0.23, 0.28, 16, sx * 0.5, 0, 0);
    pelvis.prism('armor', [[-0.36, -0.18], [-0.38, 0.12], [-0.1, 0.24], [0.28, 0.2], [0.34, -0.1], [0.1, -0.24]], 0.12, sx * 0.47, 0, 0.02);
  }
  pelvis.prism('armor', [[-0.42, -0.2], [-0.4, 0.16], [-0.25, 0.22], [-0.25, -0.24]], 0.62, 0, 0, 0); // plastron du bassin

  // --- torse : coque anguleuse allongée vers l'avant, cockpit vitré en pointe, pont, antenne, moteur arrière
  const torso = seg();
  // coque : un long nez en pente (le cockpit), le dos plat, l'arrière droit ; la verrière couchée sur la pente
  torso.prism('armor', [[-1.4, 0.2], [-0.6, 0.86], [0.55, 0.9], [0.98, 0.74], [1.02, 0.05], [0.3, -0.06], [-1.05, -0.04]], 1.42, 0, 0, 0, 0.05);
  torso.prism('armor', [[-0.66, 0.82], [-0.42, 1.0], [0.2, 1.05], [0.45, 0.88]], 0.9, 0, 0, 0, 0.04); // dos du cockpit
  torso.prism('glass', [[-1.3, 0.27], [-0.8, 0.69], [-0.82, 0.73], [-1.32, 0.31]], 0.76, 0, 0.03, -0.03, 0.012); // verrière
  torso.prism('dark', [[-1.42, 0.2], [-1.36, 0.06], [-1.05, -0.02], [-1.08, 0.16]], 0.9, 0, 0, 0, 0.02); // menton
  for (const sx of [-1, 1]) {
    torso.box('glow', 0.09, 0.05, 0.05, sx * 0.5, 0.42, -1.15); torso.box('glow', 0.09, 0.05, 0.05, sx * 0.5, 0.32, -1.22);
    torso.prism('armor', [[-0.7, 0.1], [-0.55, 0.7], [0.75, 0.78], [0.9, 0.08]], 0.1, sx * 0.76, 0, 0, 0.025); // flancs
    torso.decal(0, 0.42, 0.34, sx * 0.815, 0.48, 0.05, sx > 0 ? 'x+' : 'x-');
    torso.axle('dark', 0.16, 0.22, 14, sx * 0.84, 0.36, -0.2); // tourillon de la nacelle
  }
  torso.rbox('dark', 0.5, 0.16, 0.6, 0.04, 0.12, 0.94, 0.3); torso.rbox('dark', 0.28, 0.12, 0.32, 0.03, -0.32, 0.92, 0.45); // pont
  torso.cyl('dark', 0.03, 0.03, 0.12, 8, -0.36, 1.03, 0.52); torso.cyl('steel', 0.012, 0.008, 0.75, 6, -0.36, 1.45, 0.52); // antenne
  torso.rbox('dark', 1.0, 0.62, 0.36, 0.05, 0, 0.38, 1.12); // moteur arrière
  torso.box('glow', 0.06, 0.42, 0.02, 0, 0.38, 1.305); // fente d'échappement
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) torso.box('steel', 0.24, 0.025, 0.02, sx * 0.3, 0.2 + k * 0.11, 1.3); // grilles
  torso.rbox('dark', 0.9, 0.22, 1.2, 0.05, 0, -0.02, -0.05); // ventre

  // --- nacelle (une, posée des deux côtés) : carter blindé, alimentation en munitions, manchon ; ses canons à part (ils tournent)
  const pod = seg();
  pod.rbox('armor', 0.44, 0.52, 1.25, 0.05, 0, 0, 0.05);
  pod.rbox('dark', 0.36, 0.2, 0.7, 0.03, 0, 0.33, 0.2); pod.box('glow', 0.3, 0.025, 0.02, 0, 0.33, -0.16); // bande d'alimentation, témoin orange
  pod.rbox('dark', 0.4, 0.42, 0.3, 0.04, 0, -0.02, -0.68); // manchon
  for (const z of [-0.3, 0.1, 0.45]) pod.box('dark', 0.46, 0.04, 0.03, 0, 0.27, z); // nervures
  const guns = seg(); // six canons autour de l'axe z, frettes
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6, x = Math.cos(a) * 0.1, y = Math.sin(a) * 0.1; const c = new THREE.CylinderGeometry(0.038, 0.038, 0.62, 10); c.rotateX(Math.PI / 2); guns.L.steel.push({ geo: c, m: M(x, y, -0.31), top: false }); }
  for (const z of [-0.1, -0.5]) { const r = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 18); r.rotateX(Math.PI / 2); guns.L.dark.push({ geo: r, m: M(0, 0, z), top: false }); }

  // --- cuisse : origine à la hanche, la jambe descend vers -y ; structure, grand blindage extérieur (chevron), vérin avant, genou cerclé d'orange
  const thigh = seg(), L1 = MECHA.thigh;
  thigh.rbox('dark', 0.3, L1, 0.32, 0.05, 0, -L1 / 2, 0);
  thigh.prism('armor', [[-0.3, -0.05], [-0.38, -0.55], [-0.22, -1.0], [0.24, -0.95], [0.32, -0.35], [0.2, 0.12]], 0.16, 0.22, 0, 0, 0.035); // côté extérieur (+x : on le retourne pour la jambe gauche)
  thigh.decal(1, 0.34, 0.24, 0.305, -0.45, -0.02, 'x+');
  thigh.prism('armor', [[-0.24, -0.1], [-0.28, -0.8], [-0.12, -0.86], [-0.1, -0.12]], 0.26, -0.02, 0, 0, 0.03); // devant
  thigh.tube('steel', [0, -0.15, 0.22], [0, -0.9, 0.2], 0.045); thigh.tube('dark', [0, -0.12, 0.22], [0, -0.5, 0.21], 0.07);
  thigh.axle('dark', 0.21, 0.42, 18, 0, -L1, 0);
  const ring = new THREE.TorusGeometry(0.15, 0.018, 6, 22); ring.rotateY(Math.PI / 2); thigh.L.glow.push({ geo: ring, m: M(0.215, -L1, 0), top: false });
  // --- tibia : protège-tibia à l'avant, vérins à l'arrière, cheville
  const shin = seg(), L2 = MECHA.shin;
  shin.rbox('dark', 0.26, L2, 0.28, 0.05, 0, -L2 / 2, 0);
  shin.prism('armor', [[-0.3, -0.12], [-0.36, -0.7], [-0.22, -1.02], [-0.06, -1.0], [-0.08, -0.08]], 0.44, 0, 0, 0, 0.04); // protège-tibia
  shin.prism('armor', [[0.12, -0.1], [0.3, -0.25], [0.28, -0.62], [0.12, -0.7]], 0.36, 0, 0, 0, 0.03); // mollet
  for (const sx of [-1, 1]) { shin.tube('steel', [sx * 0.09, -0.18, 0.2], [sx * 0.09, -0.95, 0.16], 0.03); shin.tube('dark', [sx * 0.09, -0.15, 0.2], [sx * 0.09, -0.55, 0.19], 0.05); }
  shin.axle('dark', 0.17, 0.36, 16, 0, -L2, 0);
  const ring2 = new THREE.TorusGeometry(0.11, 0.014, 6, 18); ring2.rotateY(Math.PI / 2); shin.L.glow.push({ geo: ring2, m: M(0.185, -L2, 0), top: false });
  // --- pied : origine à la cheville ; semelle, deux orteils blindés vers l'avant, talon, cales
  const foot = seg(), H = MECHA.ankle;
  foot.rbox('dark', 0.42, 0.22, 0.5, 0.04, 0, -H + 0.13, 0.02);
  for (const sx of [-1, 1]) foot.prism('armor', [[-0.78, -H], [-0.76, -H + 0.13], [-0.2, -H + 0.28], [-0.1, -H]], 0.21, sx * 0.12, 0, 0, 0.03);
  foot.prism('armor', [[0.14, -H], [0.16, -H + 0.22], [0.52, -H + 0.12], [0.56, -H]], 0.34, 0, 0, 0, 0.03);
  foot.box('dark', 0.5, 0.04, 1.2, 0, -H + 0.02, -0.12);
  MECHA_G.geo = { mat, photo: false, pelvis: pelvis.build(), torso: torso.build(), pod: pod.build(), guns: guns.build(), thigh: thigh.build(), shin: shin.build(), foot: foot.build() };
  mechaTexApply(); // surfaces photo déjà chargées (une carte précédente)
  return MECHA_G.geo;
}
/* Réunit des pièces { geo, m } en gardant leurs coordonnées de texture (marquages) */
function mechaMergeUv(parts) {
  const g = heliMerge(parts), uv = new Float32Array(g.attributes.position.count * 2);
  let o = 0;
  for (const p of parts) { const U = p.geo.attributes.uv; for (let k = 0; k < U.count; k++, o++) { uv[o * 2] = U.getX(k); uv[o * 2 + 1] = U.getY(k); } }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
/* Les meshes d'un segment (une par matière) dans un groupe ; flip : jambe gauche (miroir en x) */
function mechaPart(parts, flip) {
  const G = mechaGeometry(), g = new THREE.Group();
  for (const k in parts) { const m = new THREE.Mesh(parts[k], G.mat[k]); m.castShadow = k !== 'glow' && k !== 'decal'; m.receiveShadow = k !== 'glow' && k !== 'decal'; g.add(m); }
  if (flip) g.scale.x = -1; // (three.js retourne les faces d'un objet en miroir)
  return g;
}
/* Un mecha : le squelette et ses pièces. Retourne { root, pelvis, turret, torso, pods: [g, d], guns: [g, d], legs: [{ hip, knee, ankle }] } */
function mechaBuild() {
  const G = mechaGeometry(), root = new THREE.Group(), pelvis = new THREE.Group(), turret = new THREE.Group();
  root.add(pelvis); pelvis.add(mechaPart(G.pelvis)); pelvis.add(turret); turret.position.set(0, 0.42, 0.02);
  const torso = mechaPart(G.torso); turret.add(torso);
  const pods = [], guns = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 1.05, 0.36, -0.2); p.add(mechaPart(G.pod)); turret.add(p);
    const gn = new THREE.Group(); gn.position.set(0, -0.02, -0.82); gn.add(mechaPart(G.guns)); p.add(gn);
    pods.push(p); guns.push(gn);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
    hip.position.set(sx * MECHA.hipX, 0, 0); pelvis.add(hip); hip.add(mechaPart(G.thigh, sx < 0));
    knee.position.set(0, -MECHA.thigh, 0); hip.add(knee); knee.add(mechaPart(G.shin, sx < 0));
    ankle.position.set(0, -MECHA.shin, 0); knee.add(ankle); ankle.add(mechaPart(G.foot, sx < 0));
    legs.push({ hip, knee, ankle });
  }
  root.scale.setScalar(MECHA.k);
  const m = { root, pelvis, turret, torso, pods, guns, legs };
  mechaPose(m, { h: MECHA.stand, feet: [[0, 0.05], [0, 0.05]] });
  return m;
}
/* Jambe : la cheville vers (z, y) dans le repère de la hanche (y < 0), le pied à plat (pitch : son inclinaison). Le genou plie vers l'avant. */
function mechaLeg(L, z, y, pitch = 0, roll = 0) {
  const a = MECHA.thigh, b = MECHA.shin, d = clamp(hyp(z, y), 0.3, a + b - 1e-3);
  const phi = Math.atan2(-z, -y), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), be = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  L.hip.rotation.x = phi + al; L.knee.rotation.x = -(Math.PI - be); L.ankle.rotation.x = -(L.hip.rotation.x + L.knee.rotation.x) + pitch; L.ankle.rotation.z = roll;
}
/* Pose : h hauteur du bassin au-dessus du sol, feet [[z, lever], ...] (avance du pied et hauteur de la semelle), yaw du torse, tangage des nacelles,
   roll et pitch du bassin (foulée) */
function mechaPose(m, P) {
  m.pelvis.position.y = P.h; m.pelvis.rotation.set(P.pitch || 0, 0, P.roll || 0);
  m.turret.rotation.y = P.yaw || 0;
  for (const p of m.pods) p.rotation.x = P.aim || 0;
  P.feet.forEach(([z, lift, fp, fr], i) => mechaLeg(m.legs[i], z, -(P.h - MECHA.ankle - (lift || 0)), fp || 0, fr || 0));
}

/* ---------- Marche ----------
   Chaque pied est posé au sol (position du monde) ou en l'air (de A à B en arc, MECHA_W.swing secondes). Les pieds alternent : quand le pied d'appui
   a passé assez de temps au sol et qu'un pied est trop loin de sa place (derrière en marchant, de travers en tournant sur place), il repart vers la place
   qu'il aura quand il se posera (la vitesse anticipée). Le bassin descend quand le pied se pose (petit rebond d'impact, ressort amorti), monte au milieu
   du pas, roule vers la jambe d'appui. Un pied qui se pose : coup sourd, poussière, secousse de la vue pour un joueur proche.
   Tout est en mesures du monde ; mechaPose reçoit les pieds dans le repère du modèle (divisés par MECHA.k). */
/* speed (m/s), turn (rad/s), swing : durée d'un pas en l'air (s), rest : appui sur les deux pieds avant le pas suivant, lift : hauteur du pied, reach : avance
   du pied posé devant la hanche (le pied repart autant derrière : foulée centrée, la jambe ne se tend jamais), side : écart des pieds */
const MECHA_W = { speed: 6, acc: 4.5, turn: 1.1, swing: 0.16, rest: 0, lift: 0.4, reach: 0.7, side: 0.42, dip: 0.6, far: 0.95, bend: 0.9 }; // (6 m/s, retours du propriétaire : 2,1 puis 4,4, encore trop lent ; près d'un soldat, 4,4 au pas et 6,8 au sprint, mais en dessous ; pas vifs, corps ramassé en course ; acc : prise de vitesse du mecha piloté, mechaPhys ; far : un pied en l'air ne vise jamais plus loin de sa hanche, un arrêt net contre un mur ne le laisse pas partir devant ; bend : part de la longueur de jambe au plus, le bassin descend s'il le faut, mechaApply)
const MECHAS = [];
const _mwA = new V3(), _mwB = new V3(), _mwC = new V3();
function mechaSpawn(owner, pos, yaw) {
  const m = mechaBuild(); m.root.position.copy(pos); m.root.rotation.y = yaw; scene.add(m.root);
  const k = MECHA.k, me = { owner, team: owner ? owner.team : 0, m, pos: pos.clone(), yaw, vel: new V3(), want: new V3(), wantYaw: yaw, aimYaw: 0, aimPitch: 0, t: 0, bob: 0, bobV: 0, roll: 0, last: 1, feet: [] };
  for (const sx of [-1, 1]) {
    const p = mechaFootHome(me, sx, 0, _mwA);
    me.feet.push({ sx, p: p.clone(), a: p.clone(), b: p.clone(), s: 1, air: false, t: 0 });
  }
  me.state = 'fight'; me.local = true; me.heat = 0; me.ry = pos.y; MECHAS.push(me);
  return me;
}
/* Place de repos d'un pied (monde) : sous sa hanche, avancée de ahead mètres dans le sens de la marche */
function mechaFootHome(me, sx, ahead, out) {
  const s = Math.sin(me.yaw), c = Math.cos(me.yaw), x = sx * MECHA_W.side, z = -ahead; // repère du corps : -z vers l'avant
  out.set(me.pos.x + c * x + s * z, 0, me.pos.z - s * x + c * z);
  out.y = groundHeight(out.x, out.z, me.pos.y + 0.6);
  return out;
}
function mechaStep(me, dt) {
  me.t += dt;
  // corps : vitesse vers la vitesse voulue (accélération lente, il est lourd), cap vers le cap voulu
  const k = 1 - Math.exp(-2.2 * dt);
  me.vel.x += (me.want.x - me.vel.x) * k; me.vel.z += (me.want.z - me.vel.z) * k;
  me.yaw += clamp(angDiff(me.yaw, me.wantYaw), -MECHA_W.turn * dt, MECHA_W.turn * dt);
  const phys = me.pilot && me.local; // piloté : la physique du pilote l'a déjà déplacé (mechaPhys, 08g-mecha-pilote.js)
  if (!phys) { me.pos.x += me.vel.x * dt; me.pos.z += me.vel.z * dt; }
  // pieds : en l'air, ils suivent leur arc ; au sol, le pied le plus loin de sa place repart quand l'autre est posé depuis assez longtemps
  const sp = hyp(me.vel.x, me.vel.z);
  if (me.air) mechaAirFeet(me); // en l'air : les pieds repliés sous le corps, pas de pas
  else for (const f of me.feet) {
    if (!f.air) continue;
    f.t += dt; const u = clamp(f.t / MECHA_W.swing, 0, 1), e = u * u * (3 - 2 * u);
    const home = mechaFootHome(me, f.sx, 0, _mwC), bx = f.b.x - home.x, bz = f.b.z - home.z, bd = hyp(bx, bz);
    if (bd > MECHA_W.far) { f.b.x = home.x + bx * MECHA_W.far / bd; f.b.z = home.z + bz * MECHA_W.far / bd; f.b.y = groundHeight(f.b.x, f.b.z, me.pos.y + 0.6); } // (arrêt net : la place visée revient sous la hanche)
    f.p.lerpVectors(f.a, f.b, e); f.p.y += Math.sin(u * Math.PI) * MECHA_W.lift * (0.4 + 0.6 * Math.min(1, f.a.distanceTo(f.b) / 0.6));
    if (u >= 1) { f.air = false; f.p.copy(f.b); mechaLand(me, f); }
  }
  if (!me.air && !me.feet.some((f) => f.air)) {
    const other = me.feet[me.last], next = me.feet[1 - me.last];
    if (me.t - (other.landT || 0) > MECHA_W.rest) {
      // la place du pied quand il se posera : vitesse anticipée sur la durée du pas, et un peu en avant pour l'allonger
      // piloté, il accélère vite : le pas vise l'allure qu'il aura en se posant (ni l'allure voulue, le pied partirait trop loin devant, ni l'actuelle, il resterait sous le corps)
      const lv = me.pilot && me.local ? _mwC.copy(me.vel).lerp(me.want, 1 - Math.exp(-MECHA_W.acc * MECHA_W.swing * 1.5)) : me.vel, lsp = Math.max(sp, hyp(lv.x, lv.z));
      const fw = -(lv.x * Math.sin(me.yaw) + lv.z * Math.cos(me.yaw)); // allure vers l'avant du corps (négative à reculons, nulle de côté)
      const home = mechaFootHome(me, next.sx, lsp > 0.2 ? MECHA_W.reach * clamp(fw / MECHA_W.speed, -1, 1) : 0, _mwB);
      home.x += lv.x * MECHA_W.swing; home.z += lv.z * MECHA_W.swing; home.y = groundHeight(home.x, home.z, me.pos.y + 0.6);
      const far = hyp(next.p.x - home.x, next.p.z - home.z);
      if (far > (lsp > 0.2 ? 0.3 : 0.18)) { next.air = true; next.t = 0; next.a.copy(next.p); next.b.copy(home); me.last = 1 - me.last; sfxMechaServo(next.p, 0.32); } // le vérin de la jambe qui se lève
    }
  }
  // hauteur : le sol sous le corps (moyenne des pieds), le rebond, le pas (le corps monte au milieu du pas)
  const swing = me.feet.find((f) => f.air), su = swing ? clamp(swing.t / MECHA_W.swing, 0, 1) : 0;
  me.bobV += (-90 * me.bob - 11 * me.bobV) * dt; me.bob += me.bobV * dt;
  // (deux pieds posés à des hauteurs différentes, une marche, une dune : le corps se cale sur le plus bas, la jambe haute plie davantage ; jamais tendue)
  // (un pied en l'air compte par l'endroit où il va se poser)
  const fy = me.feet.map((f) => (f.air ? f.b.y : f.p.y)), y0 = Math.min(fy[0], fy[1]), y1 = Math.max(fy[0], fy[1]);
  if (!phys) me.pos.y = damp(me.pos.y, y0 + 0.2 * (y1 - y0), 8, dt);
  // hauteur affichée : une marche franchie se lisse ; au sol, pas plus haut que ce que permettent les pieds (sur une pente, le pied d'en bas)
  me.ry = phys ? damp(me.ry === undefined ? me.pos.y : me.ry, me.air ? me.pos.y : Math.min(me.pos.y, y0 + 0.2 * (y1 - y0)), me.air ? 40 : 14, dt) : me.pos.y;
  const stance = swing ? -swing.sx : 0;
  me.roll = damp(me.roll, stance * 0.035, 5, dt);
  // torse : vers le cap visé (aimYaw, monde), dans la limite de ce qu'il peut tourner
  const tr = me.pilot ? MECHA_P.turn : 1.6, rel = clamp(angDiff(me.yaw, me.aimYaw), -1.7, 1.7), dTur = clamp(rel - (me.turret || 0), -tr * dt, tr * dt); // (piloté : le torse suit le regard plus vite)
  me.turret = (me.turret || 0) + dTur;
  mechaApply(me, su);
  mechaSounds(me, dt, sp, Math.abs(dTur) / Math.max(dt, 1e-3));
}
/* Bruits de la machine (05-audio.js, paquet mecha) : vérin du torse qui pivote vite, grincement de la structure de temps en temps en marche,
   air relâché quand il s'arrête, ronronnement du moteur qui suit le mecha et monte un peu avec l'allure */
function mechaSounds(me, dt, sp, turn) {
  const top = me.m.root.position.y + 1.6;
  if (turn > 0.6 && me.t > (me.servoT || 0)) { me.servoT = me.t + 0.7; sfxMechaServo(_mwB.set(me.pos.x, top, me.pos.z), 0.8, 1.2); }
  if (me.creakT === undefined) me.creakT = me.t + rand(2, 5);
  if (sp > 0.5 && me.t > me.creakT) { me.creakT = me.t + rand(3, 7); sfxMechaCreak(_mwB.set(me.pos.x, top, me.pos.z)); }
  if (me.moving && sp < 0.15) { me.moving = false; if (me.t > (me.hissT || 0)) { me.hissT = me.t + 2; sfxMechaHiss(me.pos, 0.7); } } else if (sp > 1) me.moving = true;
  if (me.hum) { sfxEmitterMove(me.hum, _mwB.set(me.pos.x, top, me.pos.z)); me.hum.v.s.playbackRate.value = 1 + 0.12 * Math.min(1, sp / MECHA_W.speed); }
}
/* Pied posé : coup sourd, poussière, secousse pour le joueur proche, petit affaissement du corps */
function mechaLand(me, f) {
  f.landT = me.t; me.bobV -= 0.7;
  sfxMechaStep(f.p, me.pilot === PL.ent ? 1.3 : 1); // (à bord : on les entend de tout près)
  const c = CURMAP.def && CURMAP.def.atmo && CURMAP.def.atmo.snow ? [0.88, 0.91, 0.95] : [0.58, 0.53, 0.45];
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + rand(-0.3, 0.3); FX.smoke.spawn(f.p.x + Math.cos(a) * 0.3, f.p.y + 0.05, f.p.z + Math.sin(a) * 0.3, Math.cos(a) * rand(0.8, 1.6), rand(0.15, 0.5), Math.sin(a) * rand(0.8, 1.6), rand(0.6, 1.0), 0.15, 0.7, c[0], c[1], c[2], 0.3, 0, 0, 1.6, rand(-1, 1)); }
  const d = f.p.distanceTo(camera.position); if (d < 14) PL.shake = Math.max(PL.shake, (1 - d / 14) * 0.55);
  mechaPilotJolt(me, 0.55); // à bord, chaque pas secoue la vue
}
/* Pied sur le terrain : le sol sous la semelle (pointe, talon, bords et coins : MECHA_FOOT, en m) donne au pied son inclinaison (tangage
   et roulis, bornés, lus sur les axes de la semelle) ; ce qui dépasse encore du plan de la semelle (bosse, ride de dune,
   rocher) le relève d'autant, jusqu'à MECHA_FOOT.up : le pied ne s'enfonce plus dans une pente (retour du propriétaire). Sur une marche,
   au bord d'un vide ou contre un mur, le sol n'est pas un plan : le pied reste à plat et déborde.
   En l'air, le calcul se fait là où il va se poser. */
const MECHA_FOOT = { toe: 0.53, heel: 0.36, side: 0.15, pitch: 0.5, roll: 0.35, flat: 0.1, span: 0.3, up: 0.4, pad: 0.02 }; // flat : écart au plan au-delà duquel le sol n'est pas une pente ; span : relief qui relève le pied
const _mfF = { pitch: 0, roll: 0, dy: 0 }, _mfH = new Float32Array(9);
function mechaFootFit(me, f) {
  const P = f.air ? f.b : f.p, F = MECHA_FOOT, y = P.y + 0.6, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), rx = -fz, rz = fx, H = _mfH;
  // 3 x 3 points : avant (pointe), milieu, arrière (talon) ; gauche, axe, droite
  const U = [F.toe, 0, -F.heel], V = [-F.side, 0, F.side], u = (i, j) => U[i] * (j === 1 ? 1 : 0.85);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H[i * 3 + j] = i === 1 && j === 1 ? P.y : groundHeight(P.x + fx * u(i, j) + rx * V[j], P.z + fz * u(i, j) + rz * V[j], y);
  // l'inclinaison se lit sur les axes, et seulement si le sol sous la semelle est à peu près un plan (une pente) : sur une marche, au bord d'un
  // vide ou contre un rocher, le pied reste à plat et déborde
  const tp = Math.tan(F.pitch), tr = Math.tan(F.roll);
  let gp = clamp((H[1] - H[7]) / (F.toe + F.heel), -tp, tp), gr = clamp((H[5] - H[3]) / (2 * F.side), -tr, tr), res = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) res = Math.max(res, Math.abs(H[i * 3 + j] - (P.y + gp * u(i, j) + gr * V[j])));
  if (res > F.flat) gp = gr = 0;
  _mfF.pitch = Math.atan(gp); _mfF.roll = Math.atan(gr);
  // ce qui dépasse encore (bosse, ride, rocher bas) relève le pied, dans la limite de span autour du centre
  let dy = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dy = Math.max(dy, Math.min(H[i * 3 + j], P.y + F.span) - (P.y + gp * u(i, j) + gr * V[j]));
  _mfF.dy = Math.min(F.up, dy > 0.005 ? dy + F.pad : dy);
  return _mfF;
}
/* Le modèle suit l'état : racine (position, cap), bassin (hauteur, roulis, tangage), pieds (repère du modèle), torse, nacelles */
function mechaApply(me, su) {
  const m = me.m, k = MECHA.k, R = m.root, ry = me.ry === undefined ? me.pos.y : me.ry;
  R.position.set(me.pos.x, ry, me.pos.z); R.rotation.y = me.yaw;
  const s = Math.sin(me.yaw), c = Math.cos(me.yaw), sp = hyp(me.vel.x, me.vel.z) / MECHA_W.speed;
  let h = MECHA.stand - 0.05 - MECHA_W.dip * sp + 0.07 * Math.sin(su * Math.PI) * sp + me.bob * 0.6 - (me.kneel || 0); // (dip : il se ramasse en courant, la foulée s'allonge sans tendre la jambe) // (kneel : reçu de sa chute, il se relève)
  const feet = me.feet.map((f) => {
    const dx = f.p.x - me.pos.x, dz = f.p.z - me.pos.z, lz = (s * dx + c * dz) / k; // (avance du pied dans le repère du corps : -z devant)
    // la semelle épouse le terrain : posée, entière (inclinée, relevée sur une bosse) ; en l'air, elle s'incline en approchant du sol
    const F = mechaFootFit(me, f), w = f.air ? smoothstep(0.55, 1, clamp(f.t / MECHA_W.swing, 0, 1)) : 1;
    return [lz, (f.p.y - ry + F.dy * w) / k, F.pitch * w, F.roll * w];
  });
  // un pied loin devant ou derrière (pleine course, pente) : le bassin descend, la jambe reste pliée (bend)
  const L = (MECHA.thigh + MECHA.shin) * MECHA_W.bend;
  for (const [lz, lift] of feet) h = Math.min(h, Math.sqrt(Math.max(0.36, L * L - lz * lz)) + MECHA.ankle + lift);
  mechaPose(m, { h, feet, roll: me.roll, pitch: -0.05 * sp, yaw: me.turret || 0, aim: me.aimPitch || 0 });
}
function updateMechas(dt) {
  for (let i = MECHAS.length - 1; i >= 0; i--) {
    const me = MECHAS[i]; mechaTick(me, dt);
    if (me.gone) { mechaFree(me); MECHAS.splice(i, 1); }
  }
  if (MECHAS.length) mechaBotsShoot(dt);
  if (MECHA_P.me) mechaCockpitTick(dt); // vue du pilote (08g-mecha-pilote.js)
}
function mechaFree(me) { if (me.pilot) mechaExit(me); if (me.fallV && AU.ctx) sfxFadeOut(me.fallV, AU.ctx.currentTime, 0.05); scene.remove(me.m.root); mechaUnmark(me); heliGunStop(me); sfxEmitterStop(me.hum, 0.3); me.hum = null; }
function mechaClear() { for (const me of MECHAS) mechaFree(me); MECHAS.length = 0; }

/* ---------- Où le mecha peut aller ----------
   Sous-réseau de celui des bots (03-nav.js), bâti au chargement de la carte (mnavBuild) : un nœud y est s'il laisse un disque libre de MNAV_R mètres
   de h+0,35 à h+MNAV_H (le mecha, ses nacelles, sous une arche) ; deux nœuds voisins y sont reliés si le lien des bots est une marche (pas un saut),
   l'écart de hauteur d'au plus 0,5 m et le milieu aussi dégagé. Le réseau se découpe en quartiers d'un seul tenant (une ruelle trop étroite les
   sépare : sur Givre, aucun ne dépasse 15 % de la carte) ; un mecha ne se pose que dans un quartier d'au moins MNAV_MIN nœuds (de mètres carrés) :
   il y circule toujours, il n'en sort pas par où il ne passe pas ; le quartier doit toucher le sol (un toit n'en est que s'il y est relié par un
   passage assez large : jamais de mecha coincé sur un toit ; sur les îles flottantes, sans sol, tout quartier compte). Les zones de largage
   (mnavZones) se choisissent dans ces quartiers. */
const MNAV = { ok: null, comp: null, size: null, main: -1, zones: [], link: null };
const MNAV_MIN = 120, MNAV_R = 0.85, MNAV_H = 2.7; // (demi-largeur réelle 0,86 m nacelles comprises, coque à 2,5 m : l'antenne passe)
function mnavClear(x, z, h) {
  for (const c of queryBoxes(x - MNAV_R, z - MNAV_R, x + MNAV_R, z + MNAV_R)) {
    if (c.ray || c.y1 <= h + 0.35 || c.y0 >= h + MNAV_H) continue;
    const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 < MNAV_R * MNAV_R) return false;
  }
  for (const rp of RAMPS) {
    const cx = clamp(x, rp.x0, rp.x1), cz = clamp(z, rp.z0, rp.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 < MNAV_R * MNAV_R && rampHeight(rp, cx, cz) > h + 0.45) return false;
  }
  return true;
}
function mnavLink(i, j, k) {
  return NAV.adjKind[k] === 0 && MNAV.ok[j] && Math.abs(NAV.ny[i] - NAV.ny[j]) <= 0.5 && mnavClear((NAV.nx[i] + NAV.nx[j]) / 2, (NAV.nz[i] + NAV.nz[j]) / 2, Math.max(NAV.ny[i], NAV.ny[j]));
}
function mnavBuild() {
  const N = NAV.count, ok = new Uint8Array(N), comp = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) ok[i] = mnavClear(NAV.nx[i], NAV.nz[i], NAV.ny[i]) ? 1 : 0;
  MNAV.ok = ok;
  // liens praticables pour le mecha (le découpage en quartiers s'en sert)
  const link = new Uint8Array(NAV.adj.length);
  for (let i = 0; i < N; i++) if (ok[i]) for (let k = NAV.adjStart[i]; k < NAV.adjStart[i + 1]; k++) link[k] = mnavLink(i, NAV.adj[k], k) ? 1 : 0;
  MNAV.link = link;
  let c = 0, big = -1, bigN = 0; const st = [], size = [];
  for (let i = 0; i < N; i++) {
    if (!ok[i] || comp[i] >= 0) continue;
    let n = 0, low = 0; comp[i] = c; st.push(i);
    while (st.length) { const a = st.pop(); n++; if (!low && (VOID.on || NAV.ny[a] - gy0(NAV.nx[a], NAV.nz[a]) < 1.2)) low = 1; for (let k = NAV.adjStart[a]; k < NAV.adjStart[a + 1]; k++) { const b = NAV.adj[k]; if (comp[b] < 0 && link[k]) { comp[b] = c; st.push(b); } } }
    size.push(low ? n : 0); if (n > bigN) { bigN = n; big = c; } c++;
  }
  MNAV.comp = comp; MNAV.size = size; MNAV.main = big;
  MNAV.zones = mnavZones();
}
function mnavUnload() { MNAV.ok = null; MNAV.comp = null; MNAV.size = null; MNAV.main = -1; MNAV.zones = []; MNAV.link = null; }

/* ---------- Zones de largage ----------
   Trois ou quatre par carte, tirées du réseau du mecha au chargement : le calcul ne dépend que de la carte, elles sont les mêmes chez tous les joueurs.
   Candidats : un nœud sur deux en x et en z, dans un quartier où le mecha peut se poser, au sol, hors de l'eau, à plus de MZONE.spawn m des
   apparitions des deux camps ; sa place libre est le rayon (jusqu'à MZONE.open m) sur lequel chaque case a un nœud du même quartier à la même
   hauteur (une place, une rue large), et seuls les plus dégagés restent. La première zone est la plus dégagée, au plus près du centre ; chaque
   suivante, loin des zones déjà prises (au moins MZONE.gap m, puis la place et la proximité du centre départagent), avec une trajectoire de chute
   dégagée (mechaSlant). Les apparitions d'un camp sont le reflet de celles de l'autre (x, -z) : une zone appelle son reflet quand il y en a un
   candidat à moins de 6 m, pour qu'aucun camp n'ait ses zones plus près que l'autre. Choix à la tablette : la zone la plus proche du point visé
   (mnavZone). Une carte peut aussi les donner à la main (MAP_DEFS.<id>.mecha : [x, z] de chaque zone, réglées avec l'outil ?outil=zones) :
   chacune se cale alors sur le point valide le plus proche (mnavSnap). */
const MZONE = { n: 4, open: 5, spawn: 18, gap: 16 };
function mnavZones() {
  const conf = CURMAP.def && CURMAP.def.mecha; // placées à la main (outil ?outil=zones, 09zn-outil-zones.js)
  if (conf) return conf.map(([x, z]) => mnavSnap(x, z)).filter(Boolean);
  const W = NAV.W, H = NAV.H, sp = SPAWNS[0].concat(SPAWNS[1]), cand = [];
  for (let cz = 1; cz < H - 1; cz += 2) for (let cx = 1; cx < W - 1; cx += 2) {
    for (const id of NAV.cells[cz * W + cx]) {
      const c = MNAV.comp[id]; if (c < 0 || MNAV.size[c] < MNAV_MIN) continue;
      const x = NAV.nx[id], y = NAV.ny[id], z = NAV.nz[id];
      if ((!VOID.on && y - gy0(x, z) > 1.2) || waterSurfaceAt(x, z) !== null) continue;
      if (sp.some(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < MZONE.spawn ** 2)) continue;
      let r = 0;
      for (; r < MZONE.open; r++) { // l'anneau suivant (r, r + 1] : chaque case a son nœud du même quartier, à la même hauteur
        const R = r + 1; let full = true;
        for (let dz = -R; dz <= R && full; dz++) for (let dx = -R; dx <= R; dx++) {
          const d = hyp(dx, dz); if (d <= r || d > R) continue;
          const qx = cx + dx, qz = cz + dz;
          if (qx < 0 || qz < 0 || qx >= W || qz >= H || !NAV.cells[qz * W + qx].some((j) => MNAV.comp[j] === c && Math.abs(NAV.ny[j] - y) < 0.6)) { full = false; break; }
        }
        if (!full) break;
      }
      cand.push({ x, y, z, open: r, a: undefined });
    }
  }
  const mx = (MAP.x0 + MAP.x1) / 2, mz = (MAP.z0 + MAP.z1) / 2, zones = [];
  const fits = (c) => { if (c.a === undefined) c.a = mechaSlant(c); return c.a !== null; }; // trajectoire de chute dégagée (calculée à la demande)
  const far = (c) => zones.reduce((m, q) => Math.min(m, hyp(q.x - c.x, q.z - c.z)), 1e9);
  // d'abord les places d'au moins 3 m (7,7 m de large pour le mecha) ; s'il manque des zones, on descend d'un mètre à la fois
  for (let min = 3; min >= 1 && zones.length < MZONE.n; min--) {
    const pool = cand.filter((c) => c.open >= min);
    while (zones.length < MZONE.n) {
      let best = null, bs = -1e9;
      for (const c of pool) {
        if (c.out) continue;
        const d = far(c); if (d < MZONE.gap) continue;
        const s = zones.length ? Math.min(d, 2 * MZONE.gap) * (0.6 + 0.4 * c.open / MZONE.open) - 0.25 * hyp(c.x - mx, c.z - mz) : c.open * 1000 - hyp(c.x - mx, c.z - mz);
        if (s > bs) { bs = s; best = c; }
      }
      if (!best) break;
      best.out = true; if (!fits(best)) continue;
      // son reflet (l'autre camp) : le candidat le plus proche de (x, -z), à moins de 6 m
      let twin = null, td = 36;
      for (const c of cand) { const d = (c.x - best.x) ** 2 + (c.z + best.z) ** 2; if (d < td && c.open >= 1 && !c.out && far(c) >= MZONE.gap && hyp(c.x - best.x, c.z - best.z) >= MZONE.gap) { td = d; twin = c; } }
      if (twin && zones.length + 2 > MZONE.n) continue; // plus la place pour la paire : une zone seule ne déséquilibrerait pas les camps que si elle est au milieu
      if (twin && !fits(twin)) twin = null;
      for (const c of twin ? [best, twin] : [best]) { c.out = true; zones.push({ x: c.x, y: c.y, z: c.z, a: c.a, open: c.open }); }
    }
  }
  return zones;
}
/* Zone placée à la main (MAP_DEFS.<id>.mecha) : le nœud le plus proche à moins de r m où le mecha peut se poser (quartier assez grand qui touche le
   sol, hors de l'eau, chute dégagée : mechaSlant) ; null s'il n'y en a pas. L'outil des zones s'en sert pour montrer où il se posera vraiment. */
function mnavSnap(x, z, r = 6) {
  if (!MNAV.comp) return null;
  const cx0 = Math.floor(x - NAV.x0), cz0 = Math.floor(z - NAV.z0), near = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const qx = cx0 + dx, qz = cz0 + dz; if (qx < 0 || qz < 0 || qx >= NAV.W || qz >= NAV.H) continue;
    for (const id of NAV.cells[qz * NAV.W + qx]) { const d2 = (NAV.nx[id] - x) ** 2 + (NAV.nz[id] - z) ** 2; if (d2 <= r * r) near.push([d2, id]); }
  }
  near.sort((a, b) => a[0] - b[0]);
  for (const [, id] of near) {
    const c = MNAV.comp[id]; if (c < 0 || MNAV.size[c] < MNAV_MIN) continue;
    const q = { x: NAV.nx[id], y: NAV.ny[id], z: NAV.nz[id], a: null };
    if (waterSurfaceAt(q.x, q.z) !== null) continue;
    q.a = mechaSlant(q); if (q.a !== null) return q;
  }
  return null;
}
/* Zone la plus proche de (x, z), null si la carte n'en a aucune */
function mnavZone(x, z) {
  let best = null, bd = 1e18;
  for (const q of MNAV.zones) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; best = q; } }
  return best;
}
/* D'où vient la chute : cap (radians) du point de départ vu du point de chute, à MECHA_D.slant m de côté et MECHA_D.alt m de haut ; on essaie d'abord
   le côté du centre de la carte (la traînée passe au-dessus du terrain, tout le monde la voit), puis de huitième en huitième de tour ; null si
   rien n'est dégagé (sous un toit, contre une tour). Le même calcul chez tous. */
function mechaSlant(p) {
  const D = MECHA_D, a0 = Math.atan2((MAP.x0 + MAP.x1) / 2 - p.x, (MAP.z0 + MAP.z1) / 2 - p.z);
  for (let k = 0; k < 8; k++) {
    const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 4, dx = Math.sin(a) * D.slant, dz = Math.cos(a) * D.slant, L = hyp3(dx, D.alt, dz);
    if (!rayWorld(p.x, p.y + 1.5, p.z, dx / L, D.alt / L, dz / L, L, 2)) return a;
  }
  return null;
}

/* ---------- Largage ----------
   Le joueur choisit une zone à la tablette. Le point de chute est marqué au sol par un anneau rouge de la taille du souffle, visible de tous (on a le
   temps de s'écarter), et le mecha tombe du ciel en MECHA_D.fall s comme un météore : parti de MECHA_D.alt m de haut, en biais (mechaSlant),
   ramassé sur lui-même, dans une gaine de feu, avec une traînée de fumée et un grondement qui enfle. À l'impact : souffle de grenade aux ennemis
   proches (jusqu'à MECHA_D.dmg sur MECHA_D.blast m, ni le propriétaire ni ses alliés ; c'est le propriétaire qui compte, sans montée de la série),
   boule de feu, onde de poussière, la terre tremble alentour, de la fumée traîne ; il s'est reçu un genou presque à terre et se redresse en
   MECHA_D.land s. Le même déroulé chez tous les joueurs : l'événement mk donne le point et le cap. */
const MECHA_D = { alt: 135, slant: 45, fall: 2.4, land: 1.8, kneel: 0.75, blast: 6.5, dmg: 160 };
function mechaCall(owner, p, yaw) {
  const me = mechaSpawn(owner, p, yaw), D = MECHA_D, a = mechaSlant(p) ?? 0;
  me.local = !owner.isRemote; me.state = 'drop'; me.t = 0; me.ground = p.clone();
  me.from = new V3(p.x + Math.sin(a) * D.slant, p.y + D.alt, p.z + Math.cos(a) * D.slant); me.pos.copy(me.from); me.prev = me.from.clone(); me.m.root.position.copy(me.pos);
  me.mark = mechaMark(p); me.mark.position.copy(p); scene.add(me.mark);
  me.fallV = sfxMechaFall(p, D.fall); // (coupé à l'impact réel, mechaImpact)
  if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'mk', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), r: +yaw.toFixed(3) }, owner);
  const ally = owner.team === PL.ent.team && MATCH.mode !== 'ffa';
  sfxAnnounce(ksFriendly(owner) ? 'mecha_on' : 'mecha_enemy'); // annonce radio (05a-sfx.js)
  hudMsg(owner === PL.ent ? _t('Mecha en approche') : ally ? _t('Mecha allié en approche ({0})', owner.name) : _t('Mecha ennemi en approche !'), owner === PL.ent || ally ? 'ally' : 'enemy', 2.6);
  return me;
}
/* Marque du point de chute : un disque rouge pâle, son bord net à la taille du souffle et une onde qui se resserre ; posée sur le sol relevé autour du point
   (6 rayons x 64 caps : sur une dune, une marche, elle épouse le terrain au lieu de s'y enfoncer). Sans point : à plat (compilation, ksWarm). */
function mechaMark(p) {
  const R = MECHA_D.blast, A = 64, K = 6, H = new Float32Array((K + 1) * A);
  for (let k = 0; k <= K; k++) for (let i = 0; i < A; i++) { const r = R * k / K, t = i * TAU / A; H[k * A + i] = p ? groundHeight(p.x + Math.cos(t) * r, p.z + Math.sin(t) * r, p.y + 1.5) - p.y : 0; }
  const hAt = (r, i) => { const f = clamp(r / R, 0, 1) * K, k = Math.min(K - 1, Math.floor(f)); i %= A; return lerp(H[k * A + i], H[(k + 1) * A + i], f - k) + 0.07; };
  // une bande entre des cercles de rayons donnés, chaque sommet à la hauteur du sol ; set() la replace (l'onde change de rayon à chaque image)
  const grid = (radii) => {
    const n = radii.length, g = new THREE.BufferGeometry(), pos = new Float32Array((A + 1) * n * 3), idx = [];
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < A; i++) { const a = k * (A + 1) + i, b = a + A + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.userData.set = (rr) => { for (let k = 0; k < n; k++) for (let i = 0; i <= A; i++) { const t = i * TAU / A, o = (k * (A + 1) + i) * 3; pos[o] = Math.cos(t) * rr[k]; pos[o + 1] = hAt(rr[k], i); pos[o + 2] = Math.sin(t) * rr[k]; } g.attributes.position.needsUpdate = true; };
    g.userData.set(radii); return g;
  };
  const mat = (o) => new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: false });
  const g = new THREE.Group();
  for (const [geo, o] of [[grid([0, 1, 2, 3, 4, 5, 6].map((k) => R * k / K)), 0.14], [grid([R - 0.35, R]), 0.9], [grid([R - 0.25, R]), 0.7]]) { const m = new THREE.Mesh(geo, mat(o)); m.renderOrder = 3; m.frustumCulled = false; g.add(m); }
  return g;
}
function mechaUnmark(me) { if (!me.mark) return; scene.remove(me.mark); for (const o of me.mark.children) { o.material.dispose(); o.geometry.dispose(); } me.mark = null; }
function mechaDropStep(me, dt) {
  me.t += dt; const D = MECHA_D, u = clamp(me.t / D.fall, 0, 1), e = 0.65 * u + 0.35 * u * u, m = me.m; // (il accélère encore en tombant)
  me.prev.copy(me.pos); me.pos.lerpVectors(me.from, me.ground, e);
  // la marque : le bord clignote de plus en plus vite, l'onde se resserre vers le centre
  const [disk, ring, wave] = me.mark.children, w = (me.t * (1.2 + 1.6 * u)) % 1;
  ring.material.opacity = 0.5 + 0.45 * Math.abs(Math.sin(me.t * (5 + 9 * u))); disk.material.opacity = 0.12 + 0.12 * u;
  const wr = D.blast * (1 - 0.85 * w); wave.geometry.userData.set([Math.max(0, wr - 0.25), wr]); wave.material.opacity = 0.75 * w;
  // ramassé sur lui-même, jambes repliées, légèrement penché ; il tremble dans l'air
  m.root.position.copy(me.pos); m.root.rotation.set(0.12 + Math.sin(me.t * 31) * 0.02, me.yaw, Math.sin(me.t * 23) * 0.02);
  mechaPose(m, { h: MECHA.stand - 0.15, feet: [[0.4, 0.6, -0.4], [-0.25, 0.5, -0.4]], aim: -0.35 });
  mechaTrail(me, u);
  if (u >= 1) mechaImpact(me);
}
/* Traînée du météore : fumée sombre qui reste dans le ciel et braises le long du chemin parcouru depuis l'image précédente (une bouffée par 0,9 m),
   gaine de feu autour de la coque, lueur sur le décor dans la dernière seconde */
function mechaTrail(me, u) {
  const a = me.prev, b = me.pos, n = Math.ceil(a.distanceTo(b) / 0.9);
  for (let i = 0; i < n; i++) {
    const k = (i + Math.random()) / n, x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k) + 1.3, z = lerp(a.z, b.z, k);
    FX.smoke.spawn(x + rand(-0.4, 0.4), y, z + rand(-0.4, 0.4), rand(-0.5, 0.5), rand(0.2, 0.9), rand(-0.5, 0.5), rand(4, 6), rand(1.8, 2.6), rand(6, 9), 0.16, 0.15, 0.14, 0.8, 0, -0.15, 0.9, rand(-0.6, 0.6));
    FX.add.spawn(x, y, z, rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5), rand(0.35, 0.7), rand(2.6, 3.6), 0.8, 2.4, rand(0.7, 1.1), 0.2, 0.85, 0, 0, 2, rand(-2, 2));
  }
  FX.add.spawn(b.x, b.y + 1.3, b.z, 0, 0, 0, 0.07, 4.2, 5, 2.8, 1.4, 0.45, 0.9, 0, 0, 1, rand(-1, 1));
  FX.add.spawn(b.x, b.y + 1.3, b.z, 0, 0, 0, 0.05, 2.4, 2.8, 3.4, 2.8, 1.8, 1, 0, 0, 1, rand(-1, 1));
  for (let i = 0; i < 3; i++) FX.add.spawn(b.x + rand(-0.8, 0.8), b.y + rand(0.6, 2), b.z + rand(-0.8, 0.8), rand(-6, 6), rand(2, 9), rand(-6, 6), rand(0.5, 1), 0.07, 0.02, 4, 2, 0.6, 1, 0.4, 9, 0.35);
  if (u > 0.6 && (me.glowT = (me.glowT || 0) - 1) <= 0) { me.glowT = 6; flashLight(b.clone().setY(b.y + 1.5), 9, 26, 0.12, 0xff8a3a); }
}
/* Impact : souffle aux ennemis proches (le propriétaire compte), effets chez tous, puis le mecha se relève (état land) */
function mechaImpact(me) {
  const D = MECHA_D, p = me.ground;
  me.state = 'land'; me.t = 0; me.impT = 0; me.pos.copy(p); me.ry = p.y; me.m.root.rotation.set(0, me.yaw, 0); me.kneel = D.kneel; me.bob = -0.3; me.bobV = 0;
  for (const f of me.feet) { mechaFootHome(me, f.sx * 1.25, 0, f.p); f.air = false; } // reçu jambes écartées
  mechaUnmark(me);
  if (me.fallV) { sfxFadeOut(me.fallV, AU.ctx.currentTime, 0.04); me.fallV = null; }
  explosionFx(p, 0.75); sfxExplosion(p, 1.3); sfxMechaLand(p); kcEvent('boom', { p: p.clone() });
  me.hum = sfxMechaHum(p); // le moteur tourne dès qu'il est posé
  propBlast(p, D.blast, D.dmg); hangBlast(p, D.blast); toilesBlast(p, D.blast); // le souffle sur les props, les objets suspendus et les toiles : chez tous
  // l'onde de poussière, plus large que celle d'une grenade, et des gravats
  const c = CURMAP.def.atmo.snow ? [0.88, 0.91, 0.95] : CURMAP.def.atmo.impact;
  for (let i = 0; i < 40; i++) { const a = i * TAU / 40 + rand(-0.05, 0.05), s = rand(10, 17); FX.smoke.spawn(p.x + Math.cos(a), p.y + 0.2, p.z + Math.sin(a), Math.cos(a) * s, rand(0.2, 1.2), Math.sin(a) * s, rand(1.3, 2.2), 0.8, rand(3, 4.5), c[0], c[1], c[2], 0.6, 0, 0.2, 2.2, rand(-1, 1)); }
  for (let i = 0; i < 26; i++) FX.smoke.spawn(p.x + rand(-1, 1), p.y + 0.3, p.z + rand(-1, 1), rand(-11, 11), rand(5, 15), rand(-11, 11), rand(1, 2), rand(0.1, 0.2), 0.06, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 1, 0.9, 19, 0.3, rand(-6, 6));
  shockRing(p, 16, 0.55);
  const d = p.distanceTo(camera.position); PL.shake = Math.max(PL.shake, clamp(1 - d / 50, 0, 1) * 2.2); // la terre tremble
  soundEvents.push({ pos: p.clone(), team: me.team, who: me.owner, t: MATCH.time, loud: true }); while (soundEvents.length > 60) soundEvents.shift();
  if (!me.local) return;
  const o = new V3(p.x, p.y + 0.6, p.z);
  for (const e of entities) {
    if (!e.alive || e.off || allied(e, me.owner)) continue;
    const ch = entChest(e, new V3()), dd = ch.distanceTo(o); if (dd > D.blast) continue;
    if (!lineClear(o, ch) && !lineClear(o, entHead(e, new V3()))) continue;
    const k = 1 - dd / D.blast, rd = ch.clone().sub(o); rd.y = Math.max(rd.y, 0) + 0.8; rd.normalize();
    e.lastForce = { dir: rd, mag: 8 + 10 * k, lift: 8 + 9 * k, part: 'body', radial: true };
    applyDamage(e, D.dmg * Math.pow(k, 1.1) + 12, me.owner, NET_WSPECIAL.mecha, false, ch.clone().sub(o).normalize(), undefined, -1);
  }
}
/* Fumée qui traîne sur le point de chute pendant quelques secondes */
function mechaDust(me, dt) {
  me.impT += dt; if (me.impT > 5 || (me.dustT = (me.dustT || 0) - dt) > 0) return;
  me.dustT = 0.12; const p = me.ground, a = rand(0, TAU), r = rand(1.5, 5), k = 1 - me.impT / 5;
  FX.smoke.spawn(p.x + Math.cos(a) * r, p.y + rand(0.1, 0.6), p.z + Math.sin(a) * r, rand(-0.4, 0.4), rand(0.3, 0.9), rand(-0.4, 0.4), rand(2.5, 4), rand(1, 1.6), rand(3, 4.5), 0.3, 0.29, 0.27, 0.35 * k, 0, -0.1, 0.8, rand(-0.4, 0.4));
}

/* ---------- Combat ----------
   Posé et sans pilote, il reste sur place (retour du propriétaire : on monte dedans pour le déplacer, 08g-mecha-pilote.js) : il cherche l'ennemi visible le plus proche à portée, tourne le torse vers lui
   (les jambes se tournent sur place quand le torse ne suffit plus), fait tourner ses canons (MECHA_F.spin s, sifflement qui monte : un joueur visé
   est prévenu), puis tire des rafales des deux nacelles en alternance. Chaque balle : rayon avec dispersion, traceur, flamme, son de minigun ; le
   propriétaire applique les dégâts (comme l'hélicoptère). Ses éliminations ne font pas monter la série. Il finit par surchauffer et exploser (Surchauffe, plus bas). */
const MECHA_F = { range: 50, spin: 0.6, rate: 13, burst: 1.5, cd: 0.9, dmg: 13, sigma: 0.012, sigmaD: 0.0004, turn: 1.6 };
const _mfA = new V3(), _mfB = new V3(), _msC = new V3(), _msH = new V3(), _msP = new V3();
function mechaEye(me, out) { return out.set(me.pos.x, me.pos.y + 2.0, me.pos.z); }
function mechaPick(me) {
  const eye = mechaEye(me, _mfA); let best = null, bd = MECHA_F.range;
  for (const e of entities) {
    if (!e.alive || e.off || e.inMecha || allied(e, me.owner)) continue;
    const ch = entChest(e, _mfB), d = eye.distanceTo(ch); if (d >= bd) continue;
    if ((!lineClear(eye, ch) && !lineClear(eye, entHead(e, _mfB))) || smokeBlocks(eye, ch)) continue; // (ni à travers un fumigène)
    bd = d; best = e;
  }
  return best;
}
function mechaFight(me, dt) {
  const F = MECHA_F; me.life = (me.life || 0) + dt;
  me.scanT = (me.scanT || 0) - dt; if (me.scanT <= 0) { me.scanT = 0.3; const t = mechaPick(me); if (t !== me.tgt) { me.tgt = t; me.warned = false; } }
  const T = me.tgt && me.tgt.alive ? me.tgt : null;
  if (T) {
    const ch = entChest(T, _mfB), eye = mechaEye(me, _mfA), dx = ch.x - eye.x, dz = ch.z - eye.z;
    me.aimYaw = Math.atan2(-dx, -dz); me.aimPitch = damp(me.aimPitch || 0, clamp(Math.atan2(ch.y - eye.y, hyp(dx, dz)), -0.6, 0.5), 6, dt);
    if (Math.abs(angDiff(me.yaw, me.aimYaw)) > 1.3) me.wantYaw = me.aimYaw; // le torse ne suffit plus : les jambes se tournent
    me.spinWant = 1; me.idleT = 0;
    if (T === PL.ent && !me.warned && me.owner !== PL.ent) { me.warned = true; hudMsg(_t('Mecha : vous êtes ciblé !'), 'enemy', 1.2); sfxKs('lock'); }
  } else {
    me.idleT = (me.idleT || 0) + dt; if (me.idleT > 1.5) me.spinWant = 0;
    me.aimYaw = me.yaw + Math.sin(me.life * 0.45) * 0.9; me.aimPitch = damp(me.aimPitch || 0, 0, 3, dt); // il balaie lentement
  }
  // canons : montée en régime, rotation, sifflement ; rafales quand il est aligné et lancé
  me.spin = clamp((me.spin || 0) + (me.spinWant ? dt / F.spin : -dt / 1.4), 0, 1);
  for (const g of me.m.guns) g.rotation.z += me.spin * 38 * dt;
  me.cdT = (me.cdT || 0) - dt;
  const aligned = T && Math.abs(angDiff(me.yaw + (me.turret || 0), me.aimYaw)) < 0.09;
  if (aligned && me.spin > 0.9 && me.cdT <= 0) { me.burstT = F.burst; me.cdT = F.burst + F.cd; }
  me.firing = (me.burstT = (me.burstT || 0) - dt) > 0 && !!T;
  if (me.firing) { me.shotT = (me.shotT || 0) - dt; while (me.shotT <= 0) { me.shotT += 1 / F.rate; me.pod = 1 - (me.pod || 0); mechaShoot(me, me.pod, entChest(T, _mfB)); } }
  for (let i = 0; i < 2; i++) { me.kick = me.kick || [0, 0]; me.kick[i] = damp(me.kick[i], 0, 14, dt); me.m.pods[i].children[0].position.z = me.kick[i] * 0.09; }
}
/* Une balle d'une nacelle vers aim (avec dispersion) ; local : le propriétaire tire un vrai rayon et applique les dégâts, les autres ne voient que la trace */
function mechaShoot(me, i, aim, from0) {
  const F = MECHA_F, from = from0 || me.m.guns[i].localToWorld(_mfA.set(0, 0, -0.66)).clone(), dist = from.distanceTo(aim), s = (F.sigma + dist * F.sigmaD) * (from0 ? MECHA_P.spread : 1); // (piloté : plus groupé, MECHA_P.spread) // from0 : la bouche vue du cockpit (piloté)
  const dir = aim.clone().sub(from).normalize();
  dir.x += (Math.random() + Math.random() - 1) * s * 2; dir.y += (Math.random() + Math.random() - 1) * s * 2; dir.z += (Math.random() + Math.random() - 1) * s * 2; dir.normalize();
  const w = rayWorld(from.x, from.y, from.z, dir.x, dir.y, dir.z, F.range + 15, 1), wt = w ? w.t : F.range + 15;
  const eh = me.local ? rayEntities(from, dir, wt, me.owner) : null, end = from.clone().addScaledVector(dir, eh ? eh.t : wt);
  const fk = from0 ? 0.35 : 1; // (vue du cockpit : la bouche est à un mètre de l'œil, l'éclair plus petit)
  FX.tracers.add(from, end); FX.flash.spawn(from.x, from.y, from.z, 0, 0, 0, 0.04, 0.45 * fk, 0.3 * fk, 3, 2.2, 1.2, 1, 0);
  sfxHeliGun(from, me); me.kick[i] = 1; me.shotAt = MATCH.time; // (on l'entend tirer : mechaThreat)
  if (!me.local) return;
  const dmg = from0 ? MECHA_P.dmg : F.dmg; // piloté : obus plus lourds
  if (eh) {
    bloodFx(end, dir, eh.part === 'head');
    eh.ent.lastForce = { dir: dir.clone(), mag: 4, lift: 2, part: eh.part };
    applyDamage(eh.ent, dmg * (eh.part === 'head' ? 1.5 : eh.part === 'legs' ? 0.8 : 1), me.owner, NET_WSPECIAL.mecha, eh.part === 'head', dir, me.pos, -1);
    if (me.pilot === PL.ent) hitFeedback(eh.part === 'head', !eh.ent.alive); // piloté : la croix de touche comme avec une arme
  } else if (w && w.prop) propShot(w.prop, end, dir, dmg * 0.6);
  else if (w) impactFx(end, _mfB.set(w.nx, w.ny, w.nz), w.m, false);
  if (from0 && !eh && w) mechaSplash(me, end, w); // piloté : l'obus éclate à l'impact
}
/* Éclat d'un obus du mecha piloté (MECHA_P.splash) : un soldat ennemi à moins de r m de l'impact, sans mur entre eux, prend jusqu'à dmg (moins en
   s'éloignant) ; de quoi toucher celui qui dépasse d'un muret ou d'un coin de mur */
function mechaSplash(me, end, w) {
  const S = MECHA_P.splash, c = _mfB.set(end.x + w.nx * 0.15, end.y + w.ny * 0.15, end.z + w.nz * 0.15);
  for (const e of entities) {
    if (!e.alive || e.off || e.inMecha || allied(e, me.owner)) continue;
    if (Math.abs(e.pos.x - c.x) > 2.5 || Math.abs(e.pos.z - c.z) > 2.5) continue;
    const ch = entChest(e, _msC), d = Math.min(ch.distanceTo(c), entHead(e, _msH).distanceTo(c), _msP.set(e.pos.x, e.pos.y + 0.5, e.pos.z).distanceTo(c));
    if (d > S.r || !lineClear(c, ch)) continue;
    const dir = ch.clone().sub(c).normalize();
    applyDamage(e, S.dmg * (1 - 0.6 * d / S.r), me.owner, NET_WSPECIAL.mecha, false, dir, me.pos, -1);
    if (me.pilot === PL.ent) hitFeedback(false, !e.alive);
  }
}
/* ---------- Surchauffe ----------
   Retour du propriétaire : pas de points de vie, une jauge de surchauffe (me.heat, de 0 à 1). Elle monte toute seule (pleine en MECHA_HEAT.time s
   sans un coup reçu), et plus vite sous les tirs et les explosions : une touche compte pour MECHA_HEAT.bullet de ses dégâts, un souffle pour
   MECHA_HEAT.blast (une grenade bien placée en prend environ 12 %). Une balle le touche si elle passe par l'une de ses trois sphères (torse et
   nacelles, bassin, jambes : rayMechas, comme les drones et l'hélicoptère) ; les bots tirent sur un mecha ennemi qu'ils voient (mechaBotsShoot).
   Passé MECHA_HEAT.warn, il fume de plus en plus, une alarme sonne et le cockpit clignote en rouge : il faut sortir. Pleine, il explose
   (mechaOverheat) : une grosse explosion qui blesse tous les soldats autour, ses alliés compris, et tue le pilote resté à bord. C'est le
   propriétaire qui compte : un tireur distant lui envoie ses touches (événement mh), il publie l'explosion (mx). */
const MECHA_HEAT = { time: 90, hp: 1800, bullet: 0.4, blast: 1.5, warn: 0.8, r: 9, dmg: 260 }; // (50 s, balles à 0,6 et souffles à 2,5 d'abord : trop court pour être une vraie menace)
const MECHA_HIT = [[2.0, 0.85], [1.4, 0.5], [0.7, 0.5]]; // sphères : hauteur au-dessus des pieds, rayon (m)
const MECHA_AIM = [2.1, 1.4, 0.75]; // où les bots visent un mecha, du torse aux jambes (mechaBotsShoot)
function rayMechas(shooter, o, dir, maxT) {
  let best = null, bt = maxT;
  for (const me of MECHAS) {
    if ((me.state !== 'fight' && me.state !== 'land') || allied(shooter, me.owner)) continue;
    const y = me.ry === undefined ? me.pos.y : me.ry;
    for (const [h, r] of MECHA_HIT) {
      const cx = me.pos.x - o.x, cy = y + h - o.y, cz = me.pos.z - o.z, t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0 || t > bt) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t; if (d2 > r * r) continue;
      bt = t - Math.sqrt(r * r - d2); best = me;
    }
  }
  return best ? { me: best, t: bt } : null;
}
/* Touche (dégâts d'une arme, déjà pondérés balle ou souffle) : la chaleur monte d'autant */
function mechaDamage(me, dmg, shooter) {
  if (me.state === 'dead' || me.state === 'drop' || !shooter || shooter.isRemote) return;
  const h = dmg / MECHA_HEAT.hp;
  if (shooter.isPlayer) hitFeedback(false, me.local && me.heat + h >= 1);
  if (me.local) { me.heat += h; me.hurtT = MATCH.time; if (me.heat >= 1) mechaOverheat(me); }
  else if (MATCH.online && netIsLocal(shooter)) netEvent({ k: 'mh', to: netIdOf(me.owner), d: Math.round(dmg) }, shooter);
}
/* La chaleur, à chaque image : elle monte toute seule ; de la fumée de plus en plus noire et dense au-dessus de MECHA_HEAT.warn - 0,25, des
   étincelles et des flammes au-delà de MECHA_HEAT.warn (chez tous : la chaleur d'un mecha distant est publiée) */
function mechaHeat(me, dt) {
  if (me.local && me.state === 'fight') { me.heat += dt / MECHA_HEAT.time; if (me.heat >= 1) { mechaOverheat(me); return; } }
  const W = MECHA_HEAT.warn, k = clamp((me.heat - W + 0.25) / 0.45, 0, 1); if (k <= 0) return;
  if ((me.smokeT = (me.smokeT || 0) - dt) > 0) return;
  me.smokeT = lerp(0.3, 0.05, k);
  // le moteur, au dos du torse (vu du cockpit, la fumée part plus loin derrière et s'en va vers l'arrière : elle ne voile pas la vue du pilote)
  const own = MECHA_P.me === me, a = me.yaw + (me.turret || 0), bk = own ? 1.6 : 0.6, y = (me.ry === undefined ? me.pos.y : me.ry) + 2.0, x = me.pos.x + Math.sin(a) * bk, z = me.pos.z + Math.cos(a) * bk;
  const c = lerp(0.42, 0.1, k), vb = own ? 1.2 : 0;
  FX.smoke.spawn(x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2), Math.sin(a) * vb + rand(-0.3, 0.3), rand(1.2, 2.4), Math.cos(a) * vb + rand(-0.3, 0.3), rand(1.8, 3), 0.4, 2.2, c, c * 0.95, c * 0.9, 0.35 + 0.4 * k, 0, -0.4, 0.8, rand(-0.5, 0.5));
  if (me.heat >= W) {
    FX.add.spawn(x, y - 0.1, z, rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5), rand(0.2, 0.4), 0.5, 0.15, 2.6, 1.0, 0.25, 0.8, 0, -1.5, 1.5, rand(-1, 1));
    if (Math.random() < 0.4) FX.add.spawn(x, y, z, rand(-3, 3), rand(2, 5), rand(-3, 3), rand(0.4, 0.8), 0.05, 0.015, 4, 2, 0.6, 1, 0.4, 9, 0.35);
  }
}
/* Souffle d'une explosion (explode, 07-bots.js) sur les mechas ennemis du lanceur */
function mechaBlast(p, owner, radius, maxDmg) {
  for (const me of MECHAS) {
    if (allied(owner, me.owner)) continue;
    const d = Math.max(0, hyp3(me.pos.x - p.x, me.pos.y + 1.4 - p.y, me.pos.z - p.z) - 0.8);
    if (d < radius) mechaDamage(me, maxDmg * (1 - d / radius) * MECHA_HEAT.blast, owner);
  }
}
/* Les bots face à un mecha ennemi (retour du propriétaire : ils l'ignoraient ou venaient au contact ; puis, piloté, ils le fuyaient sans chercher à le
   détruire). Un mecha à moins de MECHA_BOT.near m, vu, entendu (moins de MECHA_BOT.hear m, il fait du bruit) ou qui tire (ses canons portent jusqu'à
   MECHA_BOT.loud m), passe avant tout le reste, sauf un soldat en vue tout près quand le mecha est loin. Le bot en forme l'attaque : il va à une
   place de tir d'où il le voit, à au moins MECHA_BOT.safe m et vers MECHA_BOT.ideal m, près d'un couvert si possible, et lui tire dessus
   (mechaBotsShoot) ; il en change quand le mecha sort de sa vue. Blessé (moins de MECHA_BOT.hurt de vie), ou face à un mecha qui surchauffe (son
   explosion porte à 9 m : MECHA_BOT.hot), il se met à l'abri, derrière un couvert qui le cache du torse, et en sort pour tirer. Tous lui lancent
   leurs grenades, l'arme qui le fait chauffer le plus. Décision : mechaBotDecide, au début de decideTactic ; mouvement : tactique 'mecha'
   d'updateBot (07b-tactics.js). */
const MECHA_BOT = { near: 45, hear: 18, loud: 42, safe: 12, hot: 18, far: 28, ideal: 18, nade: 24, keep: 6, hurt: 45 }; // (nade : au-delà, la grenade n'arrive pas ; un abri plus loin est moins bien noté ; loud : ses canons s'entendent jusque-là ; ideal : la distance d'attaque visée. D'abord near 34, hear 15, safe 16, hot 20, far 30, et toujours à l'abri : retour du propriétaire, les bots fuyaient le mecha piloté au lieu de chercher à le détruire)
const _mbA = new V3(), _mbB = new V3();
function mechaThreat(b) {
  let best = null, bd = MECHA_BOT.near;
  const eye = entEye(b, _mbA);
  for (const me of MECHAS) {
    if ((me.state !== 'fight' && me.state !== 'land') || allied(b, me.owner)) continue;
    const d = hyp(me.pos.x - b.pos.x, me.pos.z - b.pos.z); if (d > bd) continue;
    const loud = d < MECHA_BOT.loud && MATCH.time - (me.shotAt || -99) < 2.5; // ses canons tirent : on sait où il est sans le voir
    if (d > MECHA_BOT.hear && !loud && !lineClear(eye, _mbB.set(me.pos.x, (me.ry === undefined ? me.pos.y : me.ry) + 1.8, me.pos.z))) continue;
    best = me; bd = d;
  }
  return best;
}
/* Vrai si le bot s'occupe du mecha (tactique 'mecha'), faux s'il reprend sa partie */
function mechaBotDecide(b, now) {
  const M = MECHAS.length ? mechaThreat(b) : null;
  if (!M) { if (b.tactic === 'mecha') { releaseCover(b); b.tactic = 'roam'; b.goal = null; b.path = null; b.mk = null; b.mkFire = false; } return false; }
  const d = hyp(M.pos.x - b.pos.x, M.pos.z - b.pos.z), T = b.target;
  if (b.visible && T && T.alive && d > 22 && hyp(T.pos.x - b.pos.x, T.pos.z - b.pos.z) < 12) return false; // un soldat sur lui d'abord
  if (b.tactic !== 'mecha') b.nadeCd = Math.min(b.nadeCd, rand(3, 8)); // face à un mecha, la grenade sort vite
  const hot = M.heat >= MECHA_HEAT.warn - 0.1, safe = hot ? MECHA_BOT.hot : MECHA_BOT.safe, P = b.mkPt, hide = hot || b.health < MECHA_BOT.hurt;
  const my = M.ry === undefined ? M.pos.y : M.ry, torso = _mbB.set(M.pos.x, my + MECHA_AIM[0], M.pos.z);
  // grenade prête mais place hors de portée : on cherche plus près (une fois toutes les 10 s)
  const wantNade = b.nades > 0 && b.nadeCd <= 1 && now - (b.mkNadeT || -99) > 10;
  // la place choisie tient : une place de tir tant qu'on y voit le mecha (ou qu'on n'y est pas encore), un abri tant qu'il reste caché de lui ; assez loin dans les deux cas
  if (b.tactic === 'mecha' && b.mk === M && P) {
    const pm = hyp(P.x - M.pos.x, P.z - M.pos.z), young = now - b.mkT < MECHA_BOT.keep;
    if (b.mkFire) { if (!hide && pm >= safe && pm <= MECHA_BOT.far + 4 && (young || lineClear(torso, _mbA.set(P.x, P.y + 1.55, P.z)))) return true; }
    else if (pm >= safe && !(wantNade && pm > MECHA_BOT.nade) && (young || !b.mkC || !lineClear(torso, _mbA.set(P.x, P.y + 0.75, P.z)))) return true;
  }
  if (wantNade) b.mkNadeT = now;
  b.mk = M; b.mkT = now; b.mkC = null; b.mkFire = false; b.atCover = false; b.peeking = false; b.peekT = rand(0.5, 1);
  const eyeM = torso.clone();
  releaseCover(b);
  // en forme : une place de tir, un nœud du réseau d'où l'on voit son torse, entre safe et far de lui, vers ideal, pas loin du bot, près d'un couvert si possible
  const fire = () => {
    const cand = [[b.pos.clone(), 0]];
    for (const r of [4, 8, 13]) for (let k = 0; k < 10; k++) {
      const a = k * TAU / 10 + r, id = navNode(b.pos.x + Math.cos(a) * r, b.pos.y, b.pos.z + Math.sin(a) * r);
      if (id >= 0) cand.push([new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]), r]);
    }
    let best = null, bs = 1e9;
    for (const [q, r] of cand) {
      const qm = hyp(q.x - M.pos.x, q.z - M.pos.z); if (qm < safe || qm > MECHA_BOT.far || Math.abs(q.y - b.pos.y) > 3) continue;
      const sc = Math.abs(qm - MECHA_BOT.ideal) * 0.4 + r * 0.35 + (coverNear(q.x, q.z, 2.2, []).length ? -2.5 : 0) + Math.random() * 1.5;
      if (sc >= bs || !lineClear(_mbA.set(q.x, q.y + 1.55, q.z), eyeM)) continue;
      bs = sc; best = q;
    }
    if (!best) return false;
    b.mkPt = best; b.mkFire = true; b.tactic = 'mecha';
    if (hyp(best.x - b.pos.x, best.z - b.pos.z) < 0.8) { b.path = null; return true; }
    setPath(b, best); if (b.path) return true;
    b.mkFire = false; return false;
  };
  if (!hide && !(wantNade && d > MECHA_BOT.nade) && fire()) return true;
  // un couvert à moins de 16 m du bot, entre safe et far du mecha (à portée de grenade d'abord si elle est prête), tourné vers lui, qui cache un soldat accroupi
  const pick = (far) => {
    const cand = [];
    for (const c of coverNear(b.pos.x, b.pos.z, 16, [])) {
      if ((c.owner && c.owner !== b && c.owner.alive) || now - c.badT < 30 || Math.abs(c.y - b.pos.y) > 3) continue;
      const tx = M.pos.x - c.x, tz = M.pos.z - c.z, td = hyp(tx, tz); if (td < safe || td > far) continue;
      const facing = (c.nx * tx + c.nz * tz) / td; if (facing < 0.3) continue;
      cand.push([hyp(c.x - b.pos.x, c.z - b.pos.z) - facing * 3 + (c.low ? -1.5 : 0) + (td > MECHA_BOT.nade ? 4 : 0) + Math.abs(td - MECHA_BOT.ideal) * 0.35 + Math.random() * 2, c]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    for (let i = 0, n = 0; i < cand.length && n < 6; i++) {
      const c = cand[i][1];
      if (lineClear(eyeM, _mbA.set(c.x, c.y + 0.75, c.z))) continue;
      n++; b.mkPt = new V3(c.x, c.y, c.z); setPath(b, b.mkPt);
      if (!b.path) { c.badT = now; continue; }
      c.owner = b; b.cover = c; b.mkC = c; b.tactic = 'mecha'; return true;
    }
    return false;
  };
  if (wantNade && pick(MECHA_BOT.nade)) return true;
  // grenade prête, pas d'abri à portée : on s'approche à découvert ; puis un abri plus loin ; sinon, trop près, on s'écarte ; sinon on tient la place et on tire
  const go = (r, away) => { // le nœud du réseau le mieux placé parmi huit directions, à r m du bot
    const ax = b.pos.x - M.pos.x, az = b.pos.z - M.pos.z; let best = null, bs = -1e9;
    for (let k = 0; k < 8; k++) {
      const a = Math.atan2(az, ax) + (away ? 0 : Math.PI) + (k - 3.5) * 0.45, x = b.pos.x + Math.cos(a) * r, z = b.pos.z + Math.sin(a) * r, id = navNode(x, b.pos.y, z);
      if (id < 0) continue;
      const q = new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]), qm = hyp(q.x - M.pos.x, q.z - M.pos.z);
      if (!away && (qm < safe || qm > MECHA_BOT.nade)) continue;
      const sc = (away ? qm : -Math.abs(qm - (safe + MECHA_BOT.nade) / 2)) - hyp(q.x - b.pos.x, q.z - b.pos.z) * 0.3;
      if (sc > bs) { bs = sc; best = q; }
    }
    if (best) { b.mkPt = best; setPath(b, best); if (b.path) { b.tactic = 'mecha'; return true; } }
    return false;
  };
  if (wantNade && d > MECHA_BOT.nade && go(d - (safe + MECHA_BOT.nade) / 2, false)) return true;
  if (pick(MECHA_BOT.far)) return true;
  if (d < safe && go(safe + 4 - d, true)) return true;
  if (d > MECHA_BOT.ideal + 6 && go(Math.min(14, d - MECHA_BOT.ideal), false)) return true; // pas d'abri : on va le chercher à découvert
  b.mkPt = b.pos.clone(); b.path = null; b.tactic = 'mecha'; return true;
}
/* Les bots de cette partie tirent sur un mecha ennemi qu'ils voient à moins de 35 m : un temps de réaction, puis des rafales, deux balles sur cinq au but */
function mechaBotsShoot(dt) {
  for (const b of entities) {
    if (b.isPlayer || b.isRemote || !b.alive || b.off || !b.weapon || b.sprinting || MATCH.time < (b.blindT || 0)) continue; // (en courant vers un abri, aveuglé, on ne tire pas)
    let tgt = null, bd = 35 * 35;
    for (const me of MECHAS) { if (me.state !== 'fight' || allied(b, me.owner)) continue; const k = me.pos.distanceToSquared(b.pos); if (k < bd) { bd = k; tgt = me; } }
    if (!tgt) { b.mkSeeT = 0; continue; }
    const eye = _mfA.set(b.pos.x, b.pos.y + (b.crouch ? 1.1 : 1.55), b.pos.z), y0 = tgt.ry === undefined ? tgt.pos.y : tgt.ry;
    // le torse d'abord, sinon le bassin ou les jambes qui dépassent (les sphères de MECHA_HIT) : un muret ne le cache pas tout entier
    let aim = null; for (const h of MECHA_AIM) { const a = _mfB.set(tgt.pos.x, y0 + h, tgt.pos.z); if (lineClear(eye, a) && !smokeBlocks(eye, a)) { aim = a; break; } }
    if (!aim) { b.mkSeeT = Math.max(0, (b.mkSeeT || 0) - dt); continue; }
    b.mkSeeT = (b.mkSeeT || 0) + dt; botLookAt(b, aim, MATCH.time, 0.4);
    if (b.mkSeeT < 0.7) continue;
    b.mkShotT = (b.mkShotT || 0) - dt; if (b.mkShotT > 0) continue;
    b.mkShotT = 0.15 + Math.random() * 0.15;
    const hit = Math.random() < 0.4, end = aim.clone();
    if (!hit) end.add(new V3(rand(-1.4, 1.4), rand(-1, 1), rand(-1.4, 1.4)));
    sfxGun(b.weapon.sound, eye, b); FX.tracers.add(eye.clone(), end); b.lastShotT = MATCH.time;
    if (hit) { impactFx(end, end.clone().sub(eye).normalize().negate(), 'metal', false, true); mechaDamage(tgt, 14 * MECHA_HEAT.bullet, b); }
  }
}
/* Surchauffe : une grosse explosion au torse. Chez le propriétaire, elle blesse tous les soldats à MECHA_HEAT.r m (ennemis : élimination à son
   compte, sans montée de la série ; alliés et lui-même : comptés comme une mort sans tueur), les autres mechas ennemis, et tue le pilote
   resté à bord. L'épave s'effondre ensuite en brûlant (mechaWreck) ; la fin est publiée (mx). */
function mechaOverheat(me, send = me.local) {
  if (me.state === 'dead') return;
  const pilot = me.pilot;
  if (pilot) mechaExit(me);
  me.state = 'dead'; me.deadT = 0; me.firing = false; me.spinWant = 0; me.heat = 1; heliGunStop(me); sfxEmitterStop(me.hum, 0.3); me.hum = null;
  const H = MECHA_HEAT, p = new V3(me.pos.x, (me.ry === undefined ? me.pos.y : me.ry) + 1.8, me.pos.z);
  explosionFx(p, 1.9); explosionFx(p.clone().add(new V3(0, -1.2, 0)), 1.2); sfxExplosion(p, 2); sfxMechaLand(me.pos); kcEvent('boom', { p: p.clone() });
  shockRing(p, 22, 0.7); flashLight(p, 40, 40, 0.3, 0xffd7a0);
  const dc = p.distanceTo(camera.position); PL.shake = Math.max(PL.shake, clamp(1 - dc / 60, 0, 1) * 2.4);
  if (dc < 18) FinalShader.uniforms.uFlash.value = Math.max(FinalShader.uniforms.uFlash.value, (1 - dc / 18) * 0.6);
  propBlast(p, H.r, H.dmg); hangBlast(p, H.r); toilesBlast(p, H.r);
  if (send && MATCH.online && netIsLocal(me.owner)) netEvent({ k: 'mx' }, me.owner);
  const mine = me.owner === PL.ent, ally = !mine && allied(me.owner, PL.ent);
  hudMsg(mine ? _t('Votre mecha a explosé') : ally ? _t('Mecha allié détruit') : _t('Mecha ennemi détruit'), mine || ally ? 'enemy' : 'ally', 2.4);
  if (!me.local) return;
  const o = me.owner;
  if (pilot && pilot.alive) { pilot.health = Math.min(pilot.health, 1); pilot.protT = 0; applyDamage(pilot, 999, pilot, NET_WSPECIAL.mecha, false, new V3(0, 1, 0), me.pos); } // resté à bord
  for (const e of entities) {
    if (!e.alive || e.off || e === pilot) continue;
    const ch = entChest(e, new V3()), d = ch.distanceTo(p); if (d > H.r) continue;
    if (!lineClear(p, ch) && !lineClear(p, entHead(e, new V3()))) continue;
    const k = 1 - d / H.r, rd = ch.clone().sub(p); rd.y = Math.max(rd.y, 0) + 0.8; rd.normalize();
    e.lastForce = { dir: rd, mag: 9 + 12 * k, lift: 9 + 10 * k, part: 'body', radial: true };
    applyDamage(e, H.dmg * Math.pow(k, 1.1) + 20, allied(e, o) ? e : o, NET_WSPECIAL.mecha, false, rd, me.pos, -1); // (un allié : sans tueur, comme une chute)
  }
  mechaBlast(p, o, H.r, H.dmg);
}
/* Épave : elle s'affaisse sur un genou et bascule, fumée noire et flammes, puis disparaît après 6 s */
function mechaWreck(me, dt) {
  me.deadT += dt; const k = smoothstep(0, 0.9, me.deadT), m = me.m;
  mechaPose(m, { h: lerp(MECHA.stand, 1.15, k), feet: [[0.4, 0, 0.3], [-0.5, 0, -0.2]], roll: 0.18 * k, pitch: 0.22 * k, yaw: me.turret || 0, aim: lerp(me.aimPitch || 0, -0.5, k) });
  if ((me.fireT = (me.fireT || 0) - dt) <= 0) {
    me.fireT = 0.09; const x = me.pos.x + rand(-0.5, 0.5), y = me.pos.y + 1.3 + rand(0, 0.5), z = me.pos.z + rand(-0.5, 0.5);
    FX.smoke.spawn(x, y, z, rand(-0.3, 0.3), rand(1.2, 2.2), rand(-0.3, 0.3), rand(2.5, 4), 0.8, 3.2, 0.12, 0.11, 0.1, 0.7, 0, -0.4, 0.8, rand(-0.5, 0.5));
    FX.add.spawn(x, y - 0.2, z, rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4), rand(0.3, 0.6), 0.6, 0.2, 2.4, 1.0, 0.25, 0.8, 0, -1.5, 1.5, rand(-1, 1));
  }
  if (me.deadT > 6) me.gone = true;
}

/* ---------- En ligne ----------
   Le propriétaire publie l'état de son mecha (p.mk, mechaPub) ; chez les autres, la marche suit cette position (les pieds se posent comme chez lui),
   le torse et les nacelles visent comme publié, et les rafales sont rejouées (traces seulement). */
function mechaPub(e) {
  const me = MECHAS.find((x) => x.owner === e && x.local && x.state === 'fight'); if (!me) return null;
  const r = (v) => Math.round(v * 100) / 100;
  return [r(me.pos.x), r(me.pos.z), r(me.yaw), r(me.aimYaw), r(me.aimPitch || 0), me.firing ? 1 : 0, me.tgt && me.tgt.alive || me.spinWant ? 1 : 0, me.pilot ? 1 : 0, r(me.pos.y), me.air ? 1 : 0, r(me.heat)];
}
function mechaNet(e, a) {
  if (!Array.isArray(a) || a.length < 7) return;
  const me = MECHAS.find((x) => x.owner === e && !x.local); if (!me || me.state !== 'fight') return;
  const v = a.map((x) => numOr(x));
  me.net = { x: v[0], z: v[1], yaw: v[2], aimYaw: v[3], aimPitch: clamp(v[4], -0.7, 0.6), fire: !!v[5], spin: !!v[6], y: a.length > 8 ? v[8] : null, air: !!v[9] }; me.seen = MATCH.time;
  if (a.length > 10) me.heat = clamp(v[10], 0, 1); // (sa fumée)
  mechaSeat(e, v[7] ? me : null); // son propriétaire est à bord : son soldat disparaît (08g-mecha-pilote.js)
}
/* Touche reçue d'un tireur distant sur le mecha d'un participant local, et fin publiée par le propriétaire */
function mechaNetHit(owner, dmg) {
  const me = MECHAS.find((x) => x.owner === owner && x.local && x.state !== 'dead');
  if (me) { me.heat += clamp(+dmg || 0, 0, 1000) / MECHA_HEAT.hp; me.hurtT = MATCH.time; if (me.heat >= 1) mechaOverheat(me); }
}
function mechaNetDead(owner) { const me = MECHAS.find((x) => x.owner === owner && !x.local && x.state !== 'dead'); if (me) { mechaSeat(owner, null); mechaOverheat(me, false); } }
function mechaRemote(me, dt) {
  const N = me.net; if (!N) return;
  const dx = N.x - me.pos.x, dz = N.z - me.pos.z, d = hyp(dx, dz);
  me.want.set(dx, 0, dz).multiplyScalar(d > 0.05 ? Math.min(MECHA_W.speed, d * 2) / d : 0); me.wantYaw = N.yaw;
  me.air = N.air; if (N.air && N.y !== null) me.pos.y = damp(me.pos.y, N.y, 14, dt); // un saut : la hauteur publiée (sinon les pieds la donnent)
  me.aimYaw = N.aimYaw; me.aimPitch = damp(me.aimPitch || 0, N.aimPitch, 6, dt); me.spinWant = N.spin || N.fire ? 1 : 0;
  me.spin = clamp((me.spin || 0) + (me.spinWant ? dt / MECHA_F.spin : -dt / 1.4), 0, 1);
  for (const g of me.m.guns) g.rotation.z += me.spin * 38 * dt;
  if (N.fire && me.spin > 0.8) {
    me.shotT = (me.shotT || 0) - dt;
    const a = me.yaw + (me.turret || 0), cp = Math.cos(me.aimPitch || 0), aim = mechaEye(me, _mfB).add(new V3(-Math.sin(a) * cp * 30, Math.sin(me.aimPitch || 0) * 30, -Math.cos(a) * cp * 30));
    while (me.shotT <= 0) { me.shotT += 1 / MECHA_F.rate; me.pod = 1 - (me.pod || 0); mechaShoot(me, me.pod, aim); }
  }
  me.kick = me.kick || [0, 0]; for (let i = 0; i < 2; i++) { me.kick[i] = damp(me.kick[i], 0, 14, dt); me.m.pods[i].children[0].position.z = me.kick[i] * 0.09; }
  if (MATCH.time - (me.seen || 0) > 3) { me.gone = true; mechaSeat(me.owner, null); } // plus publié : le propriétaire est parti
}

/* ---------- Boucle ---------- */
function mechaTick(me, dt) {
  if (me.state === 'drop') { mechaDropStep(me, dt); return; }
  if (me.impT !== undefined) mechaDust(me, dt);
  if (me.state === 'land') {
    me.want.set(0, 0, 0); me.kneel = MECHA_D.kneel * (1 - smoothstep(0.45, MECHA_D.land, me.impT)); mechaStep(me, dt); // (me.t : l'horloge de la marche)
    if (me.impT > MECHA_D.land) { me.state = 'fight'; me.kneel = 0; }
  } else if (me.state === 'fight') {
    if (!me.owner) { mechaStep(me, dt); return; } // patrouille d'essai (09zm-essai.js) : elle mène la marche elle-même
    if (me.pilot && me.local) { mechaPilotStep(me, dt); mechaPhys(me, dt); } // piloté par le joueur (08g-mecha-pilote.js)
    else if (me.local) { mechaFight(me, dt); me.want.set(0, 0, 0); } else mechaRemote(me, dt);
    mechaStep(me, dt);
    mechaHeat(me, dt);
  } else if (me.state === 'dead') mechaWreck(me, dt);
  if (me.gun) heliGunTick(me);
}
