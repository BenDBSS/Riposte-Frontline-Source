/* ==========================================================================
   CHEMIN DE FER : voie (ballast, traverses de bois, rails), matériel roulant et équipements de gare, réutilisables.
   Repère des véhicules : longueur le long de z, posés sur les rails (champignon du rail à y = RAIL.top), largeur
   de voie normale. Comme pour les véhicules routiers, les collisions sont décrites par la carte (boîtes simples).
   ========================================================================== */
const RAIL = { gauge: 1.435, top: 0.37, bed: 0.16 };

/* ---------- Voie ---------- */
/* Lit de ballast enneigé (boîte praticable, hauteur RAIL.bed) sur [x0, x1] x [z0, z1] : on marche dessus, les rails
   dépassent à peine des chevilles */
function trackBed(x0, x1, z0, z1) {
  const M = DECOR;
  M.save().color([0.62, 0.6, 0.58]).world(1);
  M.boxB('gravel', x0, x1, 0, RAIL.bed, z0, z1, { skip: 'zZ' });
  M.restore();
  WORLD.col({ x0, x1, y0: 0, y1: RAIL.bed, z0, z1 }, 'snow');
}
/* Voie le long de z, centrée en x : traverses de bois créosoté tous les 0,6 m, rails à patin (profil Vignole) */
function railTrack(x, z0, z1) {
  const M = DECOR, R = rngOf(Math.round(x * 31 + z0));
  M.save().local(1); M.cls = 1;
  for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.6) {
    M.color([R.range(0.32, 0.42), R.range(0.26, 0.32), R.range(0.2, 0.25)]);
    M.save().move(x + R.range(-0.03, 0.03), RAIL.bed - 0.06, z).rotY(R.range(-0.02, 0.02)); M.box('wood', 2.6, 0.17, 0.25, { bevel: 0.01 }); M.restore();
  }
  M.restore();
  // rail : patin, âme, champignon ; table de roulement polie
  const Pr = [[-0.075, 0], [0.075, 0], [0.075, 0.012], [0.012, 0.03], [0.009, 0.13], [0.034, 0.138], [0.034, 0.172], [-0.034, 0.172], [-0.034, 0.138], [-0.009, 0.13], [-0.012, 0.03], [-0.075, 0.012]];
  for (const s of [-1, 1]) {
    const rx = x + s * (RAIL.gauge / 2 + 0.036), y = RAIL.top - 0.172;
    M.save().color([0.7, 0.62, 0.55]).local(1).move(rx, y, z0).mul(basis([1, 0, 0], [0, 1, 0], [0, 0, 1]).clone());
    M.extrude('rust', Pr, z1 - z0, { sharp: 0.4 });
    M.color([0.85, 0.85, 0.86]); M.boxB('steel', -0.03, 0.03, 0.172, 0.18, 0, z1 - z0, { skip: 'y' }); // 8 mm au-dessus du champignon (3 mm scintillaient de loin)
    M.restore();
  }
}

/* ---------- Matériel roulant ---------- */
/* Roue de wagon (boudin, voile, moyeu), axe le long de x, posée sur le rail */
function railWheel(M, x, z, r = 0.46) {
  M.save().move(x, RAIL.top - 0.005 + r, z).rotZ(Math.PI / 2);
  M.lathe('rust', [[0.08, -0.07], [r * 0.82, -0.07], [r, -0.065], [r, 0.04], [r + 0.03, 0.045], [r + 0.03, 0.07], [r * 0.82, 0.07], [0.14, 0.05], [0.14, 0.11], [0.06, 0.11]], 16, { sharp: 0.5 });
  M.restore();
}
/* Bogie à deux essieux centré en z : longerons, ressorts, boîtes d'essieu, traverse danseuse */
function railBogie(M, z, r = 0.46) {
  M.save().color([0.2, 0.19, 0.18]).local(1);
  const yc = RAIL.top + r;
  for (const dz of [-0.95, 0.95]) {
    for (const s of [-1, 1]) railWheel(M, s * RAIL.gauge / 2 * 1.04, z + dz, r);
    M.save().move(-0.78, yc, z + dz).rotZ(-Math.PI / 2); M.cyl('rust', 0.065, 1.56, 8); M.restore();
  }
  for (const s of [-1, 1]) {
    const x = s * 0.98;
    M.boxB('rust', x - 0.07, x + 0.07, yc - 0.1, yc + 0.16, z - 1.35, z + 1.35, { bevel: 0.02 });
    for (const dz of [-0.95, 0.95]) M.boxB('rust', x - 0.11, x + 0.11, yc - 0.18, yc + 0.12, z + dz - 0.14, z + dz + 0.14, { bevel: 0.02 });
    for (const dz of [-0.35, 0.35]) { M.save().move(x, yc + 0.16, z + dz); M.cyl('steel', 0.08, 0.25, 8); M.restore(); }
  }
  M.boxB('rust', -1.05, 1.05, yc + 0.16, yc + 0.34, z - 0.3, z + 0.3, { bevel: 0.02 });
  M.restore();
}
/* Châssis : longerons, traverses de tête, tampons et crochets d'attelage aux deux bouts (longueur entre têtes L) */
function railFrame(M, L, W, y0, y1) {
  const hl = L / 2;
  M.save().color([0.2, 0.19, 0.18]).local(1);
  for (const s of [-1, 1]) M.boxB('rust', s * (W / 2 - 0.12) - 0.1, s * (W / 2 - 0.12) + 0.1, y0, y1, -hl, hl, { bevel: 0.015 });
  for (let z = -hl + 1.4; z < hl - 1; z += 2.2) M.boxB('rust', -W / 2 + 0.2, W / 2 - 0.2, y0 + 0.06, y1 - 0.04, z - 0.08, z + 0.08);
  for (const s of [-1, 1]) {
    M.boxB('rust', -W / 2 + 0.05, W / 2 - 0.05, y0 - 0.06, y1 + 0.02, s * hl - 0.12, s * hl + 0.12, { bevel: 0.02 });
    for (const x of [-0.88, 0.88]) {
      M.save().move(x, (y0 + y1) / 2 - 0.02, s * hl).rotX(s * Math.PI / 2); M.cyl('steel', 0.085, 0.42, 8); M.move(0, 0.42, 0); M.cyl('steel', 0.21, 0.05, 14); M.restore();
    }
    M.boxB('rust', -0.06, 0.06, y0 + 0.02, y1 - 0.06, s * (hl + 0.1), s * (hl + 0.38));
    M.save().move(0, y0 - 0.02, s * (hl + 0.38)); M.tube('rust', 0.025, [[0, 0, 0], [0, -0.12, s * 0.12], [0, -0.32, s * 0.16]], 5); M.restore();
  }
  M.restore();
}
/* Wagon couvert (12,2 m entre têtes) : caisse en planches teintées et ossature en acier, toit cintré, portes coulissantes
   (côté +x fermée, côté -x entrouverte sur un intérieur sombre), échelle, volant de frein, inscriptions */
PF.boxcar = () => prefab('boxcar', (M, P) => {
  P.tintable = ['paintwood'];
  const L = 12.2, W = 2.85, hl = L / 2, hw = W / 2, y0 = 1.2, y1 = 3.72, rise = 0.32;
  M.local(1);
  railFrame(M, L, W, 0.95, y0);
  for (const z of [-4.5, 4.5]) railBogie(M, z);
  // parois latérales en planches (une ouverture de porte au milieu), ossature
  M.color([1, 1, 1]); M.uvS = 1;
  M.aoFn = (x, y) => lerp(0.7, 1, smoothstep(y0, y0 + 0.8, y));
  for (const s of [-1, 1]) {
    const x = s * hw;
    M.boxB('paintwood', x, x - s * 0.04, y0, y1, -hl, -1.3); M.boxB('paintwood', x, x - s * 0.04, y0, y1, 1.3, hl);
    if (s < 0) M.boxB('paintwood', x, x - s * 0.04, y0 + 2.3, y1, -1.3, 1.3);
  }
  for (const s of [-1, 1]) M.boxB('paintwood', -hw, hw, y0, y1, s * hl - 0.04, s * hl + 0.04);
  M.aoFn = null;
  // ossature : montants, diagonales, ceintures
  M.color([0.24, 0.17, 0.12]);
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.02);
    // à 1 cm des plans du bas et du haut des parois (z-fighting sur toute la longueur du wagon)
    for (const z of [-hl + 0.05, -3.9, -1.35, 1.35, 3.9, hl - 0.05]) M.boxB('paint', x - 0.04, x + 0.04, y0 + 0.01, y1 - 0.01, z - 0.07, z + 0.07);
    M.boxB('paint', x - 0.045, x + 0.045, y0 + 0.01, y0 + 0.14, -hl, hl); M.boxB('paint', x - 0.045, x + 0.045, y1 - 0.12, y1 - 0.01, -hl, hl);
    for (const [za, zb] of [[-hl + 0.1, -3.95], [3.95, hl - 0.1]]) {
      const zc = (za + zb) / 2, len = hyp(zb - za, y1 - y0 - 0.3), a = Math.atan2(y1 - y0 - 0.3, zb - za);
      M.save().move(x, (y0 + y1) / 2, zc).rotX(za < 0 ? -a : a).move(0, -0.05, 0); M.box('paint', 0.06, 0.1, len); M.restore();
    }
  }
  // portes coulissantes : rail haut, vantail (fermé à +x, ouvert à -x)
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.07), dz = s > 0 ? 0 : 2.45;
    M.color([0.2, 0.19, 0.18]); M.boxB('rust', x - 0.03, x + 0.03, y1 - 0.08, y1 + 0.02, -1.5, 3.9);
    M.color([1, 1, 1]); M.boxB('paintwood', x - 0.035, x + 0.035, y0 + 0.05, y1 - 0.1, -1.3 + dz, 1.3 + dz);
    M.color([0.24, 0.17, 0.12]);
    // tasseaux en retrait de 1 cm des bords du vantail (leurs faces tombaient dans celles du vantail)
    for (const z of [-1.2, 0, 1.2]) M.boxB('paint', x - 0.05, x + 0.05, y0 + 0.06, y1 - 0.11, z + dz - 0.05, z + dz + 0.05);
    M.boxB('paint', x - 0.05, x + 0.05, (y0 + y1) / 2 - 0.06, (y0 + y1) / 2 + 0.06, -1.29 + dz, 1.29 + dz);
  }
  // intérieur sombre derrière la porte ouverte, seuil de planches
  M.color([0.05, 0.05, 0.05]); M.boxB('dark', -hw + 0.06, hw - 0.06, y0 + 0.02, y1 - 0.02, -1.28, 1.28);
  M.color([0.4, 0.3, 0.22]); M.boxB('crate', -hw - 0.02, -hw + 0.3, y0 - 0.02, y0 + 0.02, -1.3, 1.3);
  // toit cintré (tôle), passerelle de toit
  const arc = []; for (let i = 0; i <= 10; i++) { const t = i / 10, x = lerp(-hw - 0.06, hw + 0.06, t); arc.push([x, y1 + Math.sin(t * Math.PI) * rise]); }
  arc.push([hw + 0.06, y1 - 0.05], [-hw - 0.06, y1 - 0.05]);
  M.color([0.5, 0.5, 0.5]); M.save().move(0, 0, -hl - 0.06); M.extrude('paint', arc, L + 0.12, { sharp: 0.6 }); M.restore();
  // échelle et volant de frein à une extrémité
  M.color([0.2, 0.19, 0.18]);
  for (const x of [-hw + 0.25, -hw + 0.6]) M.boxB('steel', x - 0.02, x + 0.02, y0 - 0.2, y1 + 0.1, hl + 0.06, hl + 0.1);
  for (let y = y0; y < y1; y += 0.35) M.boxB('steel', -hw + 0.25, -hw + 0.6, y, y + 0.03, hl + 0.07, hl + 0.09);
  M.save().move(hw - 0.5, y1 - 0.4, hl + 0.12).rotX(Math.PI / 2); M.lathe('steel', [[0.2, -0.02], [0.24, -0.02], [0.24, 0.02], [0.2, 0.02]], 14, { sharp: 0.3 }); M.cyl('steel', 0.025, 0.25, 6); M.restore();
  // inscriptions
  for (const s of [-1, 1]) {
    M.save().move(s * (hw + 0.012), 0, 0).rotY(s * Math.PI / 2);
    decal2Quad(M, DEC2.wagon, [s * 5.4, y0 + 0.4, 0], [s * 3.4, y0 + 0.4, 0], [s * 3.4, y0 + 2.4, 0], [s * 5.4, y0 + 2.4, 0], [0, 0, 1]);
    decal2Quad(M, DEC2.wagon2, [s * -3.3, y0 + 0.3, 0], [s * -5.1, y0 + 0.3, 0], [s * -5.1, y0 + 2.1, 0], [s * -3.3, y0 + 2.1, 0], [0, 0, 1]);
    M.restore();
  }
});
/* Wagon-citerne (10,2 m entre têtes) : citerne à fonds bombés sur berceaux, ceintures, dôme, passerelle et échelles,
   plaque orange de matière dangereuse ; teinte de la citerne */
PF.tankcar = () => prefab('tankcar', (M, P) => {
  P.tintable = ['paint'];
  const L = 10.2, W = 2.7, yc = 2.55, r = 1.32, hl = 4.65;
  M.local(1);
  railFrame(M, L, W, 0.95, 1.2);
  for (const z of [-3.6, 3.6]) railBogie(M, z);
  M.save().color([0.2, 0.19, 0.18]);
  for (const z of [-2.6, 2.6]) M.boxB('rust', -1.1, 1.1, 1.2, yc - r * 0.55, z - 0.25, z + 0.25, { bevel: 0.03 });
  M.restore();
  M.save().move(0, yc, 0).rotX(Math.PI / 2);
  M.lathe('paint', [[0, -hl - 0.42], [0.55, -hl - 0.36], [1.0, -hl - 0.2], [r, -hl], [r, hl], [1.0, hl + 0.2], [0.55, hl + 0.36], [0, hl + 0.42]], 22, { sharp: 0.9, uR: 0.8 });
  M.restore();
  M.save().color([0.16, 0.15, 0.14]);
  for (const z of [-2.6, 2.6]) { M.save().move(0, yc, z - 0.05).rotX(Math.PI / 2); M.cyl('rust', r + 0.025, 0.1, 22, { caps: '' }); M.restore(); }
  M.restore();
  M.save().move(0, yc + r - 0.05, 0); M.cyl('paint', 0.42, 0.42, 14); M.move(0, 0.42, 0); M.cyl('paint', 0.48, 0.06, 14); M.restore();
  // passerelle et garde-corps, échelles
  M.save().color([0.22, 0.21, 0.2]);
  for (const s of [-1, 1]) {
    M.boxB('steel', s * 0.9 - 0.25, s * 0.9 + 0.25, yc + r - 0.42, yc + r - 0.38, -1.4, 1.4);
    for (const z of [-1.3, 0, 1.3]) M.boxB('steel', s * 1.12 - 0.02, s * 1.12 + 0.02, yc + r - 0.4, yc + r + 0.55, z - 0.02, z + 0.02);
    M.boxB('steel', s * 1.12 - 0.025, s * 1.12 + 0.025, yc + r + 0.5, yc + r + 0.55, -1.4, 1.4);
    for (const x of [-0.25, 0.25]) M.boxB('steel', s * (W / 2 + 0.02) - 0.02, s * (W / 2 + 0.02) + 0.02, 0.9, yc + r - 0.4, x - 0.02, x + 0.02);
    for (let y = 1.0; y < yc + r - 0.4; y += 0.32) M.boxB('steel', s * (W / 2 + 0.02) - 0.02, s * (W / 2 + 0.02) + 0.02, y, y + 0.03, -0.25, 0.25);
  }
  M.restore();
  for (const s of [-1, 1]) {
    M.save().move(s * (r + 0.01), 0, 0).rotY(s * Math.PI / 2);
    decal2Quad(M, DEC2.hazard, [s * 1.6, yc - 0.55, 0], [s * 0.6, yc - 0.55, 0], [s * 0.6, yc + 0.45, 0], [s * 1.6, yc + 0.45, 0], [0, 0, 1]);
    decal2Quad(M, DEC2.wagon, [s * -0.6, yc - 0.85, 0], [s * -2.6, yc - 0.85, 0], [s * -2.6, yc + 0.75, 0], [s * -0.6, yc + 0.75, 0], [0, 0, 1]);
    M.restore();
  }
});
/* Wagon plat à ranchers chargé de grumes (12 m entre têtes) */
PF.flatcar = () => prefab('flatcar', (M) => {
  const L = 12, W = 2.7, hl = L / 2, y0 = 1.25, R = rngOf(77);
  M.local(1);
  railFrame(M, L, W, 0.95, 1.2);
  for (const z of [-4.3, 4.3]) railBogie(M, z);
  M.color([0.55, 0.42, 0.3]); M.boxB('crate', -W / 2, W / 2, 1.2, y0, -hl, hl);
  M.color([0.2, 0.19, 0.18]);
  for (const s of [-1, 1]) for (let z = -hl + 0.8; z < hl - 0.5; z += 2.1) M.boxB('rust', s * (W / 2 - 0.06) - 0.05, s * (W / 2 - 0.06) + 0.05, y0, y0 + 1.75, z - 0.05, z + 0.05);
  // grumes : trois rangs, écorce et bois de bout
  const rows = [[4, 0.32], [3, 0.3], [2, 0.28]];
  let y = y0;
  rows.forEach(([n, rr]) => {
    const yy = y + rr;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * rr * 2.05, r = rr * R.range(0.9, 1.06), len = L - 0.8 - R() * 0.6, dz = R.range(-0.2, 0.2);
      M.color([R.range(0.85, 1), R.range(0.85, 1), R.range(0.85, 1)]);
      M.save().move(x, yy, -len / 2 + dz).rotX(Math.PI / 2).rotY(R() * TAU); M.cyl('bark', r, len, 10, { caps: '' }); M.restore();
      for (const s of [-1, 1]) { M.save().move(x, yy, dz + s * len / 2).rotX(s * Math.PI / 2); M.cyl('logend', r, 0.0005, 10, { caps: 't', side: false }); M.restore(); }
    }
    y = yy + rr * 0.72;
  });
  // chaînes d'arrimage
  M.color([0.25, 0.24, 0.22]); M.cls = 2;
  for (const z of [-3, 0, 3]) M.tube('steel', 0.012, [[-W / 2 + 0.05, y0 + 0.1, z], [-0.9, y0 + 1.3, z], [0, y0 + 1.6, z], [0.9, y0 + 1.3, z], [W / 2 - 0.05, y0 + 0.1, z]], 4);
});
/* Chasse-neige rotatif (13 m) : caisse rouge à toit arrondi, cabines aux deux bouts, turbine frontale (tambour, pales,
   moyeu), goulotte d'éjection orientable, bandes jaunes et noires, neige tassée dans la turbine */
PF.snowplow = () => prefab('snowplow', (M) => {
  const red = [0.66, 0.13, 0.1], hl = 6.3;
  M.local(1);
  railFrame(M, 11.6, 2.8, 0.95, 1.25);
  for (const z of [-2.6, 3.8]) railBogie(M, z, 0.5);
  // caisse : sections lissées (superellipse), plus haute à l'arrière (cabine)
  M.color(red);
  M.aoFn = (x, y) => lerp(0.65, 1, smoothstep(1.2, 2.2, y));
  M.loft('paint', [
    { z: -3.7, w: 1.45, yb: 1.25, yt: 3.75, n: 7 }, { z: 3.4, w: 1.45, yb: 1.25, yt: 3.75, n: 7 }, { z: 3.45, w: 1.45, yb: 1.25, yt: 4.05, n: 7 },
    { z: 5.6, w: 1.45, yb: 1.25, yt: 4.05, n: 7 }, { z: 5.8, w: 1.38, yb: 1.25, yt: 3.95, n: 7 },
  ], 22, { uL: 9, vL: 9.5 });
  M.aoFn = null;
  // bandes de signalisation, persiennes, vitres de cabine
  M.color([0.9, 0.72, 0.1]); M.boxB('paint', -1.47, 1.47, 1.3, 1.5, -3.7, 5.8);
  M.color([0.05, 0.05, 0.05]);
  for (const s of [-1, 1]) {
    for (let z = -2.6; z < 2.4; z += 0.14) M.boxB('dark', s * 1.45 - 0.01, s * 1.45 + 0.012, 2.3, 3.1, z, z + 0.06);
    M.quad('glass', [s * 1.452, 2.55, 4.0], [s * 1.452, 2.55, 5.3], [s * 1.452, 3.55, 5.3], [s * 1.452, 3.55, 4.0], [s, 0, 0]);
  }
  M.quad('glass', [-1.2, 2.55, 5.81], [1.2, 2.55, 5.81], [1.2, 3.6, 5.81], [-1.2, 3.6, 5.81], [0, 0, 1]);
  // turbine : tambour, rebord, pales, moyeu, fond sombre
  const yc = 2.05, rd = 1.55;
  M.color(red);
  M.save().move(0, yc, -hl).rotX(Math.PI / 2); M.cyl('paint', rd, 2.7, 24, { caps: '' }); M.restore();
  M.save().move(0, yc, -hl - 0.1).rotX(Math.PI / 2); M.lathe('paint', [[rd - 0.02, 0], [rd + 0.12, 0], [rd + 0.12, 0.16], [rd - 0.02, 0.16]], 24, { sharp: 0.3 }); M.restore();
  M.color([0.04, 0.04, 0.04]); M.save().move(0, yc, -hl + 1.1).rotX(Math.PI / 2); M.cyl('dark', rd - 0.02, 0.02, 24); M.restore();
  M.color([0.62, 0.62, 0.6]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    M.save().move(0, yc, -hl + 0.6).rotZ(a).rotY(0.45); M.boxB('steel', -0.03, 0.03, 0.18, rd - 0.08, -0.35, 0.35); M.restore();
  }
  M.color([0.3, 0.3, 0.3]); M.save().move(0, yc, -hl + 0.2).rotX(-Math.PI / 2); M.cyl('steel', 0.32, 0.5, 14, { r1: 0.05 }); M.restore();
  // capot et joues autour du tambour, soc au ras des rails
  M.color(red);
  for (const s of [-1, 1]) M.boxB('paint', s * (rd + 0.02) - 0.06, s * (rd + 0.02) + 0.06, 0.5, yc + 0.3, -hl, -hl + 2.6);
  M.color([0.18, 0.18, 0.18]); M.save().move(0, 0.42, -hl - 0.15).rotX(0.5); M.boxB('rust', -1.6, 1.6, 0, 0.08, 0, 0.9); M.restore();
  // goulotte d'éjection et cheminée d'échappement
  M.color(red); M.tube('paint', 0.4, [[0, yc + rd - 0.3, -hl + 1.2], [0, yc + rd + 0.6, -hl + 1.2], [0.25, yc + rd + 1.15, -hl + 1.05], [0.85, yc + rd + 1.45, -hl + 0.9]], 12);
  M.color([0.15, 0.15, 0.15]); M.save().move(0.5, 3.7, 1.4); M.cyl('rust', 0.12, 0.7, 8); M.restore();
  // bandes jaunes et noires sur le capot avant
  for (let i = 0; i < 7; i++) {
    M.color(i % 2 ? [0.06, 0.06, 0.06] : [0.92, 0.74, 0.1]);
    M.save().move(-1.6 + i * 0.47, 0.62, -hl - 0.02).rotZ(0.6); M.boxB('paint', -0.12, 0.12, -0.3, 0.3, -0.03, 0.0); M.restore();
  }
  // phares
  M.color([1, 1, 1]); M.cls = 1;
  for (const x of [-0.9, 0.9]) { M.save().move(x, 3.55, -3.72).rotX(Math.PI / 2); M.cyl('lampOff', 0.13, 0.05, 10); M.restore(); }
  M.cls = 0;
  // finitions de la face avant : anneaux et nervures dans la turbine, phares sur le rebord du tambour, main courante et marchepieds
  // sur les joues, plaque de numéro, flexibles de frein sous le tambour
  M.color([0.2, 0.2, 0.2]);
  for (const r of [0.55, 0.95, 1.3]) { M.save().move(0, yc, -hl + 1.06).rotX(Math.PI / 2); M.lathe('steel', [[r - 0.03, 0], [r + 0.03, 0], [r + 0.03, 0.05], [r - 0.03, 0.05]], 24, { sharp: 0.4 }); M.restore(); }
  for (let i = 0; i < 5; i++) { M.save().move(0, yc, -hl + 1.05).rotZ((i / 5) * Math.PI); M.boxB('steel', -rd + 0.06, rd - 0.06, -0.025, 0.025, -0.02, 0.03); M.restore(); }
  for (const s of [-1, 1]) {
    M.color([0.95, 0.9, 0.7]); M.cls = 1;
    M.save().move(s * 1.0, yc + 1.18, -hl - 0.14).rotX(Math.PI / 2); M.cyl('lamp', 0.15, 0.07, 12); M.restore();
    M.cls = 0; M.color([0.14, 0.14, 0.14]);
    M.save().move(s * 1.0, yc + 1.18, -hl - 0.1).rotX(Math.PI / 2); M.lathe('steel', [[0.15, 0], [0.19, 0], [0.19, 0.1], [0.15, 0.1]], 12, { sharp: 0.5 }); M.restore();
    M.color([0.9, 0.9, 0.88]); M.tube('steel', 0.022, [[s * (rd + 0.2), 0.75, -hl + 0.12], [s * (rd + 0.2), yc + 0.55, -hl + 0.12]], 5);
    M.tube('steel', 0.016, [[s * (rd + 0.1), 0.75, -hl + 0.12], [s * (rd + 0.2), 0.75, -hl + 0.12]], 4); M.tube('steel', 0.016, [[s * (rd + 0.1), yc + 0.55, -hl + 0.12], [s * (rd + 0.2), yc + 0.55, -hl + 0.12]], 4);
    M.color([0.25, 0.25, 0.24]);
    for (const y of [0.62, 1.05]) M.boxB('steel', s * (rd + 0.14) - 0.2, s * (rd + 0.14) + 0.2, y, y + 0.04, -hl - 0.12, -hl + 0.3);
  }
  M.color([0.92, 0.92, 0.9]); M.boxB('paint', -0.34, 0.34, yc - rd + 0.55, yc - rd + 0.8, -hl - 0.15, -hl - 0.12);
  M.color([0.1, 0.1, 0.1]); for (let i = 0; i < 4; i++) M.boxB('dark', -0.26 + i * 0.14, -0.26 + i * 0.14 + 0.08, yc - rd + 0.6, yc - rd + 0.75, -hl - 0.16, -hl - 0.15);
  M.color([0.12, 0.12, 0.12]); M.tube('rubber', 0.03, [[-0.5, 0.95, -hl + 0.1], [-0.55, 0.7, -hl - 0.2], [-0.4, 0.55, -hl - 0.45]], 5); M.tube('rubber', 0.03, [[0.5, 0.95, -hl + 0.1], [0.55, 0.7, -hl - 0.2], [0.4, 0.55, -hl - 0.45]], 5);
  // neige tassée dans la turbine et sur le soc
  M.save().move(0, 0.35, -hl - 0.3); M.put(PF.snowMound(3.4, 1.6, 0.85, 4), { cls: 1 }); M.restore();
  M.save().move(0.4, yc - 1.25, -hl + 0.3); M.put(PF.snowMound(2.0, 1.0, 0.5, 5), { cls: 1 }); M.restore();
});

/* ---------- Équipements de gare ---------- */
/* Banc de quai : pieds en fonte, lattes de bois, dossier */
PF.platformBench = () => prefab('platformBench', (M) => {
  M.local(1);
  M.color([0.12, 0.16, 0.13]);
  const leg = [[-0.22, 0], [-0.16, 0], [-0.1, 0.42], [0.2, 0.42], [0.2, 0.46], [-0.12, 0.47], [-0.2, 0.92], [-0.25, 0.9], [-0.17, 0.45]];
  for (const x of [-0.8, 0.8]) { M.save().move(x - 0.03, 0, 0).mul(basis([0, 0, 1], [0, 1, 0], [1, 0, 0]).clone()); M.extrude('steel', leg, 0.06, { sharp: 0.3 }); M.restore(); }
  M.color([0.62, 0.45, 0.3]);
  for (let i = 0; i < 4; i++) M.boxB('wood', -1.0, 1.0, 0.44, 0.48, -0.15 + i * 0.1 - 0.04, -0.15 + i * 0.1 + 0.04, { bevel: 0.008 });
  for (let i = 0; i < 3; i++) { M.save().move(0, 0.58 + i * 0.12, -0.18 - i * 0.025).rotX(0.2); M.boxB('wood', -1.0, 1.0, 0, 0.08, -0.02, 0.02, { bevel: 0.008 }); M.restore(); }
});
/* Horloge de quai à deux cadrans, sur potence (accrochée à un mur ou une colonne, repère de façade : mur en z = 0) */
PF.stationClock = () => prefab('stationClock', (M) => {
  M.local(1); M.color([0.12, 0.16, 0.13]);
  M.boxB('steel', -0.05, 0.05, -0.05, 0.05, 0, 0.7);
  M.tube('steel', 0.02, [[0, -0.35, 0], [0, -0.1, 0.35], [0, 0, 0.65]], 5);
  M.save().move(0.08, -0.45, 0.85).rotZ(Math.PI / 2); M.cyl('paint', 0.42, 0.16, 24); M.restore();
  M.save().move(0.09, -0.45, 0.85).rotZ(Math.PI / 2); M.lathe('steel', [[0.42, 0], [0.45, 0], [0.45, 0.18], [0.42, 0.18]], 24, { sharp: 0.3 }); M.restore();
  M.save().move(0, -0.45, 0.85);
  for (const s of [-1, 1]) decal2Quad(M, DEC2.clock, [s * 0.085, -0.38, s * 0.38], [s * 0.085, -0.38, -s * 0.38], [s * 0.085, 0.38, -s * 0.38], [s * 0.085, 0.38, s * 0.38], [s, 0, 0]);
  M.restore();
});
/* Chariot à bagages : plateau sur quatre roues, timon, malles, valises et sacs postaux */
PF.luggageCart = () => prefab('luggageCart', (M) => {
  const R = rngOf(31);
  M.local(1); M.color([0.5, 0.36, 0.24]);
  M.boxB('crate', -0.55, 0.55, 0.42, 0.5, -1.1, 1.1, { bevel: 0.01 });
  M.color([0.2, 0.2, 0.2]);
  for (const s of [-1, 1]) M.boxB('steel', -0.6, 0.6, 0.38, 0.42, s * 1.05 - 0.03, s * 1.05 + 0.03);
  for (const [x, z] of [[-0.48, -0.75], [0.48, -0.75], [-0.48, 0.75], [0.48, 0.75]]) { M.save().move(x, 0.2, z).rotZ(Math.PI / 2).move(0, -0.04, 0); M.cyl('rubber', 0.2, 0.08, 12); M.restore(); }
  M.tube('steel', 0.02, [[0, 0.45, -1.1], [0, 0.6, -1.55], [-0.25, 0.62, -1.6], [0.25, 0.62, -1.6]], 4);
  // malles et valises
  const L = [[-0.25, -0.6, 0.5, 0.45, 0.8], [0.27, -0.55, 0.45, 0.35, 0.65], [-0.2, 0.25, 0.55, 0.32, 0.6], [0.25, 0.4, 0.45, 0.28, 0.5], [0, -0.55, 0.42, 0.25, 0.55]];
  L.forEach(([x, z, w, h, d], i) => {
    const y = i === 4 ? 0.96 : 0.505; // 5 mm au-dessus du plateau (la toile, vue des deux faces, scintillait au ras du bois), le sac du dessus sur la malle
    M.color(R.pick([[0.42, 0.24, 0.14], [0.2, 0.3, 0.42], [0.55, 0.45, 0.3], [0.3, 0.3, 0.28]]));
    M.save().move(x, y, z).rotY(R.range(-0.15, 0.15)); M.boxB(i < 2 ? 'paintwood' : 'canvas', -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.025 }); M.restore();
  });
  M.pcol(-0.55, 0.55, 0.42, 0.5, -1.1, 1.1); // le plateau du chariot porte les sacs, qui sont des corps physiques
  for (const [x, z] of [[0.1, 0.9], [-0.25, 0.85]]) { M.save().move(x, 0.5, z).rotY(R() * 2); M.dyn('sandbagLow', 0, 0, 0, 0, { tint: [0.75, 0.72, 0.62] }); M.restore(); }
});
/* Signal ferroviaire : mât, cible ronde, feux (le rouge allumé), échelle */
PF.railSignal = () => prefab('railSignal', (M) => {
  M.local(1); M.color([0.75, 0.76, 0.74]);
  M.boxB('concrete', -0.35, 0.35, 0, 0.3, -0.35, 0.35, { bevel: 0.02 });
  M.color([0.82, 0.82, 0.8]); M.cyl('steel', 0.08, 4.6, 10);
  M.color([0.1, 0.1, 0.1]); M.boxB('paint', -0.32, 0.32, 3.6, 4.7, 0.05, 0.25, { bevel: 0.04 });
  M.color([0.9, 0.9, 0.88]); M.save().move(0, 4.15, 0.26).rotX(Math.PI / 2); M.cyl('paint', 0.5, 0.03, 20); M.restore();
  M.save().color([0.06, 0.06, 0.06]); M.save().move(0, 4.15, 0.29).rotX(Math.PI / 2); M.cyl('dark', 0.36, 0.01, 18); M.restore(); M.restore();
  M.cls = 1;
  M.color([2.2, 0.2, 0.1]); M.save().move(0, 4.35, 0.3).rotX(Math.PI / 2); M.cyl('bulb', 0.1, 0.02, 12); M.restore();
  M.color([0.05, 0.25, 0.08]); M.save().move(0, 3.95, 0.3).rotX(Math.PI / 2); M.cyl('paint', 0.1, 0.02, 12); M.restore();
  M.color([0.2, 0.2, 0.2]);
  for (const x of [-0.18, 0.18]) M.boxB('steel', x - 0.015, x + 0.015, 0.3, 3.6, -0.15, -0.12);
  for (let y = 0.5; y < 3.6; y += 0.3) M.boxB('steel', -0.18, 0.18, y, y + 0.02, -0.15, -0.12);
  M.cls = 0;
  M.col(-0.35, 0.35, 0, 0.3, -0.35, 0.35, 'concrete'); M.col(-0.09, 0.09, 0, 4.6, -0.09, 0.09, 'metal');
});
/* Armoire de signalisation (relais) sur pieds, avec petit toit */
PF.relayCabinet = () => prefab('relayCabinet', (M) => {
  M.local(1); M.color([0.62, 0.65, 0.62]);
  M.boxB('paint', -0.6, 0.6, 0.15, 1.75, -0.32, 0.32, { bevel: 0.015 });
  M.boxB('paint', -0.68, 0.68, 1.75, 1.82, -0.4, 0.4, { bevel: 0.01 });
  M.color([0.25, 0.25, 0.25]);
  for (const x of [-0.5, 0.5]) M.boxB('steel', x - 0.04, x + 0.04, 0, 0.15, -0.25, 0.25);
  M.boxB('dark', -0.005, 0.005, 0.25, 1.65, 0.32, 0.325); M.boxB('steel', 0.08, 0.12, 0.85, 1.05, 0.32, 0.345);
  M.col(-0.6, 0.6, 0, 1.82, -0.32, 0.32, 'metal');
});
/* Pile de traverses neuves : nw traverses par lit, nh lits, cales entre les lits */
PF.sleeperStack = (nw = 6, nh = 10) => prefab(`sleepers${nw}_${nh}`, (M) => {
  const R = rngOf(nw * 17 + nh);
  M.local(1);
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const x = (i - (nw - 1) / 2) * 0.27;
    M.color([R.range(0.26, 0.34), R.range(0.21, 0.26), R.range(0.17, 0.2)]);
    M.save().move(x + R.range(-0.02, 0.02), j * 0.165, R.range(-0.05, 0.05)); M.box('wood', 0.25, 0.15, 2.6, { bevel: 0.01 }); M.restore();
  }
  M.col(-nw * 0.135, nw * 0.135, 0, nh * 0.165, -1.3, 1.3, 'wood');
});
/* Colonne de marquise en fonte : base, fût cannelé, chapiteau, consoles ajourées vers +z et -z */
PF.castColumn = (h = 3.6) => prefab('castColumn' + h, (M) => {
  M.local(1); M.color([0.14, 0.2, 0.17]);
  M.lathe('steel', [[0, 0], [0.18, 0], [0.18, 0.08], [0.13, 0.14], [0.1, 0.3], [0.075, 0.36], [0.075, h - 0.4], [0.1, h - 0.3], [0.16, h - 0.2], [0.16, h - 0.12], [0.2, h - 0.08], [0.2, h], [0, h]], 12, { sharp: 0.6 });
  for (const s of [-1, 1]) M.tube('steel', 0.025, [[0, h - 0.9, 0], [0, h - 0.5, s * 0.35], [0, h - 0.12, s * 0.9]], 6);
  for (const s of [-1, 1]) { M.save().move(0, h - 0.45, s * 0.42).rotX(Math.PI / 2); M.lathe('steel', [[0.1, -0.012], [0.13, -0.012], [0.13, 0.012], [0.1, 0.012]], 10, { sharp: 0.3 }); M.restore(); }
  M.col(-0.1, 0.1, 0, h, -0.1, 0.1, 'metal');
});
