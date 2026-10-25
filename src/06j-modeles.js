/* ==========================================================================
   MODÈLES D'ARMES : registre, clé de construction, assemblage
   Un modèle d'arme (GUN_MODELS) est une fonction qui pose les pièces du corps dans un groupe et renseigne l'objet info
   (positions des mains, du chargeur, de la bouche, de la visée, points de montage des accessoires). Une arme montée
   est désignée par sa clé « modèle~accessoires~camouflage » (gunKey), par exemple « m4~red.sil~desert » : le même modèle
   peut donc exister avec plusieurs jeux d'accessoires, chacun construit une fois puis partagé (vue subjective, soldats,
   armes au sol).
   Points de montage (info.mount), dans le repère de l'arme (le canon pointe vers -z) :
     optic  { y : dessus du rail, z : centre, len, D : distance de l'œil au plan arrière des organes de visée }
     muzzle { y, z : bout du canon, r : rayon du canon } | under { y : dessous du garde-main, z } | side { x, y, z : flanc gauche }
   Un modèle sans visée optique propre construit ses organes de visée métalliques (info.irons) seulement si aucun
   accessoire n'occupe l'emplacement optic.
   ========================================================================== */
const GUN_MODELS = {};
function defineGun(id, fam, build) { GUN_MODELS[id] = { id, fam, build }; }

/* ---------- Clé de construction ---------- */
const _gunSpecs = {};
function gunKey(model, att, camo) {
  const a = (att || []).slice().sort((x, y) => ATT_SLOTS.indexOf(ATT[x].slot) - ATT_SLOTS.indexOf(ATT[y].slot));
  return model + (a.length || camo ? '~' + a.join('.') : '') + (camo ? '~' + camo : '');
}
function gunSpec(key) {
  let s = hasKey(_gunSpecs, key) ? _gunSpecs[key] : null; if (s) return s;
  const [model, a = '', camo = ''] = key.split('~');
  const att = a ? a.split('.').filter((id) => hasKey(ATT, id)) : [], A = {};
  for (const id of att) A[ATT[id].slot] = id;
  return (_gunSpecs[key] = { key, model, att, A, camo: camo && hasKey(CAMOS, camo) ? camo : null });
}
/* Famille d'animation d'un modèle (rifle, smg, sniper, shotgun, pistol) */
function gunFam(key) { return GUN_MODELS[gunSpec(key).model].fam; }

/* ---------- Assemblage ---------- */
function buildGunModel(key) {
  const spec = gunSpec(key), B = GUN_MODELS[spec.model], M = camoMaterials(spec.camo), g = new THREE.Group();
  const info = {
    group: g, muzzle: new THREE.Object3D(), eject: new THREE.Object3D(), mag: new THREE.Group(), magHome: new V3(), gripR: new V3(), gripL: new V3(),
    sightY: 0.1, adsZ: 0.26, bolt: null, kind: B.fam, model: spec.model, key, spec, keep: [], mount: {}, gripDef: null, trigDef: null,
    butt: null, magP: null, tubeFed: false, pump: null, laser: null, magExt: 1, lFrame: null,
  };
  g.add(info.muzzle, info.eject, info.mag);
  const A = spec.A;
  const c = { g, M, info, A, spec, bl: A.barrel === 'long' ? 0.07 : A.barrel === 'short' ? -0.07 : 0, stock: A.stock || null, optic: !!A.optic };
  B.build(c);
  attachAll(c); // accessoires (06p-accessoires.js) : optique, bouche, sous-canon, laser, chargeur
  if (info.buildMag) {
    const raw = info.buildMag, ext = info.magExt;
    info.buildMag = (parent) => raw(parent, ext);
    info.buildMag(info.mag);
  }
  info.mag.position.copy(info.magHome);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return info;
}

/* ---------- Prises des mains ----------
   Formes de prise (espace de l'arme) : ce que les doigts de chaque main touchent en se refermant (voir handGrasp).
   Boîtes arrondies { c, h : demi-côtés, r : arrondi, rx : inclinaison } ; la main d'appui du pistolet touche en plus les
   doigts de la main droite. gripDef { R, L } : formes des deux mains ; trigDef : détente de l'arme pour l'index (voir
   indexToTrigger) : at, point où vient l'axe du doigt au milieu de la dernière phalange (devant la face de la détente) ;
   xTip, limite du bout du doigt côté gauche ; guard, pièces que l'index contourne en plus des formes de la main droite
   (pontet, détente, puits de chargeur). */
const GRIP_SHAPES = {};
function gripShapes(m) {
  if (!GRIP_SHAPES[m.key] && m.gripDef) {
    const D = m.gripDef, R = D.R.map(gripShape), T = m.trigDef;
    if (T) R.trig = { at: new V3(...T.at), xTip: T.xTip, shapes: R.concat(T.guard.map(gripShape)) };
    GRIP_SHAPES[m.key] = { R, L: D.L.map(gripShape) };
  }
  return GRIP_SHAPES[m.key];
}
/* Main d'appui sous le garde-main (repère q de la main, origine de la main sur la normale de la paume passant par le point de prise G) :
   distance de G à l'origine de la main pour que la paume se pose sur l'arme sans y entrer. Grille de cases de 2,5 mm dans le plan de la
   paume : chaque case retient la profondeur du dessous de la paume (faces de la paume du maillage de la main) et la hauteur de l'arme
   vers la main (faces des pièces) ; la paume descend jusqu'à la case la plus serrée. Le maillage de l'arme, et non ses
   formes de prise approchées : rails, lumières, bipied replié ou chargeur sous la paume comptent. La main peut rouler autour du
   garde-main (poseArmToHand) : une hauteur par roulis (n valeurs sur [-range, range], axe du canon dans le repère de la main),
   interpolée par liftAt. Une fois par arme montée (lHandFrame). */
const PG = { c: 0.0025, x0: -0.05, z0: -0.06, nx: 40, nz: 60, pad: 0.008, soft: 0.0025, softT: 0.0045 };
const PALM_GRIDS = {}; // par écrasement de la base des doigts
/* échantillonne le triangle (a, b, c) tous les step au plus, en proportion de son aire (rangées parallèles à l'arête la plus longue,
   de plus en plus courtes vers le sommet opposé) : f(point) pour chaque échantillon */
const _tsP = new V3(), _tsU = new V3(), _tsW = new V3();
function triSamples(a, b, c, step, f) {
  const lab = a.distanceToSquared(b), lbc = b.distanceToSquared(c), lca = c.distanceToSquared(a);
  let P = a, Q = b, R = c;
  if (lbc >= lab && lbc >= lca) { P = b; Q = c; R = a; } else if (lca >= lab && lca >= lbc) { P = c; Q = a; R = b; }
  const L = P.distanceTo(Q), h = L > 1e-9 ? _tsU.subVectors(Q, P).cross(_tsW.subVectors(R, P)).length() / L : 0;
  const nL = Math.max(1, Math.ceil(L / step)), nh = Math.max(1, Math.ceil(h / step));
  for (let j = 0; j <= nh; j++) {
    const t = j / nh, k = Math.max(1, Math.round(nL * (1 - t)));
    _tsU.lerpVectors(P, R, t); _tsW.lerpVectors(Q, R, t);
    for (let i = 0; i <= k; i++) f(_tsP.lerpVectors(_tsU, _tsW, i / k));
  }
}
const pgCell = (p) => { const ix = Math.floor((p.x - PG.x0) / PG.c), iz = Math.floor((p.z - PG.z0) / PG.c); return ix >= 0 && ix < PG.nx && iz >= 0 && iz < PG.nz ? iz * PG.nx + ix : -1; };
function palmGrid(soft = PG.soft) {
  if (PALM_GRIDS[soft]) return PALM_GRIDS[soft];
  const H = handBones(1), g = handGeometry(1, H.u, H.h), pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const D = new Float32Array(PG.nx * PG.nz).fill(1), T = [new V3(), new V3(), new V3()];
  const palm = (i) => { let w = 0; for (let j = 0; j < 4; j++) if (si.array[i * 4 + j] === 0) w += sw.array[i * 4 + j]; return w > 0.99 && pos.getY(i) < -0.004; };
  for (let t = 0; t < idx.count; t += 3) { // faces du dessous de la paume (os de la paume)
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    if (!palm(i0) || !palm(i1) || !palm(i2)) continue;
    T[0].fromBufferAttribute(pos, i0); T[1].fromBufferAttribute(pos, i1); T[2].fromBufferAttribute(pos, i2);
    triSamples(T[0], T[1], T[2], 0.0015, (p) => { const k = pgCell(p); if (k >= 0 && p.y < D[k]) D[k] = p.y; });
  }
  // base des doigts, doigts tendus : dessous de la phalange proximale, de l'articulation jusqu'à PG.pad (m) plus loin, pulpe écrasée de
  // soft (m). Une prise ne la fait pas remonter (les doigts se ferment vers l'arme) : si elle touche l'angle d'un garde-main à fond
  // plat (FAMAS), la main descend d'autant au lieu que la base de l'index entre dans l'arme. La main figée des soldats en tient moins
  // compte (PG.softT) : sans quoi sa paume flotte au-dessus d'un bipied replié, que ses doigts ne peuvent pas envelopper
  const p = new V3();
  for (const F of FINGERS) for (let s = 0; s <= PG.pad; s += 0.0015) for (let dx = -0.7 * F.r; dx <= 0.7 * F.r + 1e-6; dx += 0.0015) {
    p.set(F.x + dx, F.y - Math.sqrt(F.r * F.r - dx * dx) + soft, F.z - s); const k = pgCell(p); if (k >= 0 && p.y < D[k]) D[k] = p.y;
  }
  return (PALM_GRIDS[soft] = D);
}
function palmLift(group, G, q, oz, axis, range, n, soft = PG.soft) { return palmLifts(group, [G], q, oz, axis, range, n, soft)[0]; }
/* palmLift pour plusieurs points de prise Gs à la fois (le long d'un recul) : les faces de l'arme sont échantillonnées une fois et
   chaque échantillon tourné une fois par roulis, pour tous les points */
function palmLifts(group, Gs, q, oz, axis, range, n, soft = PG.soft) {
  // échantillons (tous les 3 mm) des faces de l'arme proches de la prise et tournées vers la paume (repère de l'arme, origine en G)
  const G = Gs[0], dG = Gs.map((g) => g.clone().sub(G)), M = new THREE.Matrix4(), gi = new THREE.Matrix4(), P = [], R0 = 0.12, down = new V3(0, 1, 0).applyQuaternion(q);
  const R = R0 + Math.max(...dG.map((d) => d.length()));
  let V = new Float32Array(0);
  group.updateMatrixWorld(true); gi.copy(group.matrixWorld).invert();
  // une face est retenue si sa boîte englobante passe à moins de R de G (une grande face, une boîte simple par exemple, a ses
  // sommets loin de la prise) et si elle n'est pas entièrement de l'autre côté de l'axe
  const A = new V3(), B = new V3(), C = new V3(), near = (a, b, c) => {
    let d2 = 0, side = -1e9;
    for (let k = 0; k < 3; k++) {
      const lo = Math.min(V[a + k], V[b + k], V[c + k]), hi = Math.max(V[a + k], V[b + k], V[c + k]), e = lo > 0 ? lo : hi < 0 ? hi : 0; d2 += e * e;
    }
    for (const i of [a, b, c]) side = Math.max(side, V[i] * down.x + V[i + 1] * down.y);
    return d2 < R * R && side > -0.03;
  };
  group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.material.transparent || !o.geometry.attributes.position) return;
    M.multiplyMatrices(gi, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, nv = pos.count, n3 = idx ? idx.count : nv;
    if (V.length < nv * 3) V = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { A.fromBufferAttribute(pos, i).applyMatrix4(M).sub(G); V[i * 3] = A.x; V[i * 3 + 1] = A.y; V[i * 3 + 2] = A.z; }
    for (let t = 0; t < n3; t += 3) {
      const a = (idx ? idx.getX(t) : t) * 3, b = (idx ? idx.getX(t + 1) : t + 1) * 3, c = (idx ? idx.getX(t + 2) : t + 2) * 3;
      if (!near(a, b, c)) continue;
      triSamples(A.fromArray(V, a), B.fromArray(V, b), C.fromArray(V, c), 0.003, (p) => { if (p.lengthSq() < R * R) P.push(p.x, p.y, p.z); });
    }
  });
  // pour chaque roulis de la main autour du garde-main (n valeurs de -range à range) et chaque point de prise : hauteur de la paume
  const D = palmGrid(soft), m = Gs.length, Hg = Gs.map(() => new Float32Array(D.length)), Q = new THREE.Quaternion(), r = new THREE.Quaternion();
  const p = new V3(), w = new V3(), o = dG.map(() => new V3()), out = Gs.map(() => new Float32Array(n));
  for (let k = 0; k < n; k++) {
    Q.copy(q).multiply(r.setFromAxisAngle(axis, n > 1 ? (k / (n - 1) * 2 - 1) * range : 0)).invert();
    for (let j = 0; j < m; j++) { Hg[j].fill(-1); o[j].copy(dG[j]).applyQuaternion(Q); }
    for (let i = 0; i < P.length; i += 3) {
      p.set(P[i], P[i + 1], P[i + 2]).applyQuaternion(Q); // repère de la main
      for (let j = 0; j < m; j++) {
        w.subVectors(p, o[j]); if (w.lengthSq() >= R0 * R0) continue;
        w.z -= oz; // origine sous la paume
        const c = pgCell(w); if (c >= 0 && w.y > Hg[j][c]) Hg[j][c] = w.y;
      }
    }
    for (let j = 0; j < m; j++) {
      let d = 0.02;
      for (let i = 0; i < D.length; i++) if (D[i] < 0 && Hg[j][i] > -1) d = Math.max(d, Hg[j][i] - D[i]);
      out[j][k] = d + 0.0005;
    }
  }
  return out;
}
/* hauteur de la paume pour un roulis psi (table de palmLift sur [-range, range]) */
function liftAt(L, psi) {
  const n = L.v.length, t = clamp((psi / L.range + 1) / 2 * (n - 1), 0, n - 1), i = Math.min(n - 2, Math.floor(t));
  return L.v[i] + (L.v[i + 1] - L.v[i]) * (t - i);
}
/* Positions de prise d'un soldat vu de l'extérieur, une fois par arme montée (rangées avec sa géométrie) : celles de la vue
   subjective (même repère de la main d'appui), sauf si le modèle donne à ses soldats un autre point de prise (info.gripLs : le bras du
   soldat n'atteint pas celui de la vue subjective). Le bras du soldat reste plus court que la distance de l'épaule au garde-main de
   certaines armes : poseSoldier avance alors l'épaule gauche (omoplate), puis fait reculer la main le long du garde-main, de slide au
   plus (soldierSlide) ; la paume suit la hauteur du garde-main sur ce recul (liftS : distance de la prise à l'origine de la main pour
   chaque roulis, au tiers, aux deux tiers et au bout du recul, car un bipied replié sous le garde-main s'arrête en chemin ;
   soldierLift). */
const GUN_BUTT = { rifle: [0, 0.02, 0.3], smg: [0, 0.012, 0.25], sniper: [0, -0.02, 0.38], shotgun: [0, -0.012, 0.325], pistol: [0, 0.02, 0.3] };
const GUN_MAGP = { rifle: [0, -0.12, -0.122], smg: [0, -0.1, -0.13], sniper: [0, -0.075, -0.1], shotgun: [0, -0.02, -0.06], pistol: [0, -0.115, 0.03] };
function gunGrips(info) {
  const fam = info.kind, G = info.gripLs || info.gripL, LF = lHandFrame(info, G, info.gripLs ? '~s' : '', PG.softT), slide = soldierSlide(info, LF, G);
  const liftS = slide ? palmLifts(info.group, [1 / 3, 2 / 3, 1].map((t) => G.clone().setZ(G.z + slide * t)), LF.q, -LF.off.z, LF.axis, LF.range, 7, PG.softT).map((v) => ({ v, range: LF.range })) : null;
  return { R: info.gripR.clone(), L: G.clone(), LF, slide, liftS, butt: info.butt || GUN_BUTT[fam], magP: info.magP || GUN_MAGP[fam] };
}
/* Recul permis de la main d'appui d'un soldat le long du garde-main (vers le boîtier, +z) à partir du point de prise G : la main reste
   sur la partie du garde-main qui porte G (forme de prise, 3 cm avant son bout arrière) et à 15 mm au moins du chargeur ; aucun recul
   autour d'une poignée verticale ni au pistolet */
function soldierSlide(info, F, G) {
  if (info.kind === 'pistol' || F.pose !== 'support' || !info.gripDef) return 0;
  let end = -1e9;
  for (const S of info.gripDef.L) if (Math.abs(S.c[0]) < 0.01 && !S.rx && Math.abs(G.z - S.c[2]) <= S.h[2] + S.r) end = Math.max(end, S.c[2] + S.h[2]);
  const max = Math.min(0.1, end - 0.03 - G.z);
  if (max <= 0) return 0;
  const mag = info.tubeFed || !info.mag.children.length ? null : new THREE.Box3().setFromObject(info.mag);
  if (!mag) return max;
  const hb = handBaked(1, SOLDIER_LPOSE, 'lo'), v = new V3(), H = new V3();
  for (let d = max; d > 0; d -= 0.005) {
    H.copy(G).z += d; H.sub(v.copy(F.off).applyQuaternion(F.q));
    let m = 1; for (let k = 0; k < hb.p.length && m >= 0.015; k += 3) m = Math.min(m, mag.distanceToPoint(v.fromArray(hb.p, k).applyQuaternion(F.q).add(H)));
    if (m >= 0.015) return d;
  }
  return 0;
}
/* Distance de la prise à l'origine de la main d'appui d'un soldat dont la main a reculé de s le long du garde-main et roulé de phi
   autour de lui : hauteurs mesurées au point de prise et le long du recul (liftS), mêlées selon le recul */
function soldierLift(grips, s, phi = 0) {
  const a = grips.LF.lift ? liftAt(grips.LF.lift, phi) : -grips.LF.off.y, L = grips.liftS;
  if (!L) return a;
  const u = clamp(s / grips.slide, 0, 1) * L.length, i = Math.min(L.length - 1, Math.floor(u)), b = i ? liftAt(L[i - 1], phi) : a;
  return b + (liftAt(L[i], phi) - b) * (u - i);
}
function gripsFor(key) { return worldGunGeometry(key).grips; }
