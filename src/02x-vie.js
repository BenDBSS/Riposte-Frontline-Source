/* ==========================================================================
   LA VIE DU JARDIN de Hortus : papillons au-dessus des massifs, pétales de cerisiers qui tombent, pollen dans la lumière de la serre,
   carpes koï dans les bassins.
   Chaque essaim est un seul nuage de points dont le shader calcule tout (trajectoires, battement d'ailes, chute) à partir de
   l'horloge du vent (LIVE_U.uLvT, avancée par floraUpdate) : rien à mettre à jour par image côté JavaScript, un appel de rendu par essaim
   (les carpes, elles, sont de petits maillages que koiUpdate déplace).
   ========================================================================== */
const VIE = { mats: [], uScale: { value: 600 } };
/* Essaim : un point par position d'attache (x, y, z), quatre tirages par point (aRnd) et sa couleur (aCol, sRGB) */
function vieSwarm(anchors, colors, vert, frag, o = {}) {
  const n = anchors.length, R = rngOf(o.seed || 1), p = new Float32Array(n * 3), rn = new Float32Array(n * 4), col = new Float32Array(n * 3);
  anchors.forEach((a, i) => { p.set(a, i * 3); for (let k = 0; k < 4; k++) rn[i * 4 + k] = R(); col.set(colors[i % colors.length], i * 3); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 4)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({ uniforms: { uT: LIVE_U.uLvT, uScale: VIE.uScale }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; pts.userData.noPrepass = true; pts.userData.noAO = true;
  mapAdd(pts); VIE.mats.push(m); return pts;
}
const VIE_HEAD = 'uniform float uT, uScale; attribute vec4 aRnd; attribute vec3 aCol; varying vec3 vCol;';
/* Papillons : vol en boucles lentes autour de leur massif, battement d'ailes dans le shader (les ailes se resserrent vers le corps) */
const VIE_BF_VERT = `
${VIE_HEAD} varying float vFlap;
void main() {
  float t = uT + aRnd.x * 97.0, r = 1.4 + aRnd.y * 2.8; vec3 p = position;
  p.x += sin(t * (0.2 + aRnd.z * 0.16)) * r + sin(t * 0.73 + aRnd.w * 6.0) * 0.5;
  p.z += cos(t * (0.17 + aRnd.w * 0.18)) * r + cos(t * 0.81 + aRnd.z * 6.0) * 0.5;
  p.y += 0.8 + aRnd.y * 1.0 + sin(t * 1.1 + aRnd.z * 6.0) * 0.4 + sin(t * 2.3 + aRnd.w * 6.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.22 * uScale / max(-mv.z, 0.4), 2.5, 56.0);
  vCol = aCol; vFlap = 0.5 + 0.5 * sin(t * (14.0 + aRnd.z * 6.0));
}`;
const VIE_BF_FRAG = `
varying vec3 vCol; varying float vFlap;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0; float fl = mix(0.3, 1.0, vFlap); vec2 q = vec2(abs(p.x) / fl, p.y);
  float up = length((q - vec2(0.5, -0.2)) / vec2(0.5, 0.42)), lo = length((q - vec2(0.36, 0.42)) / vec2(0.34, 0.3));
  float wing = max(1.0 - smoothstep(0.82, 1.0, up), 1.0 - smoothstep(0.82, 1.0, lo));
  float body = (1.0 - smoothstep(0.05, 0.09, abs(p.x))) * (1.0 - smoothstep(0.5, 0.58, abs(p.y + 0.05)));
  float a = max(wing, body); if (a < 0.04) discard;
  vec3 c = mix(vCol, vCol * 0.35, smoothstep(0.55, 1.0, min(up, lo))); c = mix(c, vec3(0.06, 0.05, 0.04), body); c *= c;
  gl_FragColor = vec4(c * 1.15, a);
}`;
/* Pétales : chute de 7 m en une dizaine de secondes, dérive, rotation et retournement */
const VIE_PE_VERT = `
${VIE_HEAD} varying float vRot, vFlip, vA;
void main() {
  float f = fract(uT * (0.07 + aRnd.y * 0.05) + aRnd.x); vec3 p = position;
  p.y = 7.2 * (1.0 - f) + 0.02;
  p.x += sin(uT * 0.6 + aRnd.z * 6.0 + f * 5.0) * 0.9 + f * 2.2 + (aRnd.z - 0.5) * 6.0;
  p.z += cos(uT * 0.5 + aRnd.w * 6.0 + f * 4.0) * 0.9 + f * 0.8 + (aRnd.w - 0.5) * 6.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.1 * uScale / max(-mv.z, 0.4), 2.0, 30.0);
  vCol = aCol; vRot = uT * (1.2 + aRnd.y * 1.6) + aRnd.x * 6.28; vFlip = 0.3 + 0.7 * abs(sin(uT * (1.5 + aRnd.z) + aRnd.w * 6.0));
  vA = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.94, 1.0, f));
}`;
const VIE_PE_FRAG = `
varying vec3 vCol; varying float vRot, vFlip, vA;
void main() {
  vec2 q = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); q = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * 2.0; q.y /= vFlip;
  float a = (1.0 - smoothstep(0.7, 1.0, length(q * vec2(1.0, 0.62)))) * vA; if (a < 0.04) discard;
  vec3 col = vCol * vCol * (0.9 + 0.2 * q.x); gl_FragColor = vec4(col, a);
}`;
/* Pollen : grains qui dérivent et scintillent, visibles seulement de près */
const VIE_PO_VERT = `
${VIE_HEAD} varying float vA;
void main() {
  float t = uT + aRnd.x * 50.0; vec3 p = position;
  p.x += sin(t * 0.13 + aRnd.y * 6.0) * 2.0; p.y += sin(t * 0.21 + aRnd.z * 6.0) * 1.2; p.z += cos(t * 0.11 + aRnd.w * 6.0) * 2.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
  gl_PointSize = clamp(0.035 * uScale / max(d, 0.4), 1.6, 5.0);
  vA = (1.0 - smoothstep(12.0, 20.0, d)) * smoothstep(1.5, 3.0, d) * (0.45 + 0.55 * sin(t * 1.3 + aRnd.w * 20.0));
  vCol = aCol;
}`;
const VIE_PO_FRAG = `
varying vec3 vCol; varying float vA;
void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.1, 1.0, r)) * vA * 0.55; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a, a); }`;
/* Les essaims de Hortus : papillons autour des massifs, des prairies et des berges, pétales sous les cerisiers, pollen dans la nef */
function florealVie() {
  const R = rngOf(6161), M2 = (x, z, r, n) => [x, z, r, n];
  // [x, z, rayon d'éparpillement, nombre] côté Alpha (z > 0) ; le côté Bravo en est le miroir, le reste est unique
  const spots = [M2(-9, 33, 4, 3), M2(9, 33, 4, 3), M2(-9, 28.5, 3, 2), M2(9, 28.5, 3, 2), M2(-26.6, 31, 4, 3), M2(-22, 21, 4, 2), M2(30, 21, 4, 2), M2(27, 30, 3, 2), M2(0, 18, 3, 2), M2(-14, 6, 4, 2), M2(-6, 9, 3, 1), M2(-12, 40, 5, 2)];
  const once = [M2(-24, 8, 3, 2), M2(-24, -8, 3, 2), M2(23, 5, 3, 2), M2(23, -5, 3, 2), M2(33, 6, 3, 1), M2(33, -6, 3, 1)];
  const A = [];
  for (const [x, z, r, n] of spots) for (const sg of [1, -1]) for (let i = 0; i < n; i++) A.push([x + R.range(-r, r), 0, sg * z + R.range(-r, r)]);
  for (const [x, z, r, n] of once) for (let i = 0; i < n; i++) A.push([x + R.range(-r, r), 0, z + R.range(-r, r)]);
  vieSwarm(A, [[1, 0.55, 0.1], [1, 0.85, 0.2], [0.95, 0.95, 1], [0.55, 0.72, 1], [1, 0.45, 0.62], [0.9, 0.38, 0.18], [0.78, 0.5, 1]], VIE_BF_VERT, VIE_BF_FRAG, { seed: 11 });
  const P = [];
  for (const [x, z] of [[-20.8, -10.4], [-27.2, -12.6], [-33.4, -11.2], [-36, 7.5], [-23.8, 11], [-31, 12], [-20.8, 7.2], [-35.5, -10.5], [-33.8, 11.8], [-33, 19.5], [-27.5, 22], [35, 19.5], [-33, -19.5], [-27.5, -22], [35, -19.5]]) for (let i = 0; i < 9; i++) P.push([x + R.range(-1.5, 1.5), 0, z + R.range(-1.5, 1.5)]);
  vieSwarm(P, [[1, 0.78, 0.85], [1, 0.88, 0.92], [0.98, 0.7, 0.8], [1, 0.93, 0.95]], VIE_PE_VERT, VIE_PE_FRAG, { seed: 12 });
  const D = []; for (let i = 0; i < 180; i++) D.push([R.range(-18, 8), R.range(0.6, 9), R.range(-12, 12)]);
  vieSwarm(D, [[1.2, 1.0, 0.7]], VIE_PO_VERT, VIE_PO_FRAG, { seed: 13, add: true });
  // carpes : le grand bassin japonais (hors île et ponts) et l'étang de la serre
  const I = JAPON_ISLE;
  koiAdd(JAPON_POND, -0.3, 10, (x, z) => hyp(x - I.x, z - I.z) > I.r + 1.4 && !JAPON_WALK.some((r) => x > r[0] - 1.3 && x < r[1] + 1.3 && z > r[2] - 1.3 && z < r[3] + 1.3), 3);
  koiAdd(SERRE_POND, -0.3, 4, (x, z) => x < 9.0, 5);
  onResizeFx();
}

/* ---------- Carpes koï ---------- */
/* Poissons nageant sous la surface d'un bassin : un petit maillage chacun (fuseau à section elliptique, queue en éventail, robe blanche, orange ou noire
   tachetée par sommet), qui suit des points de passage tirés dans l'eau libre ; le corps ondule en lacet. Mis à jour par koiUpdate (hook de la carte). */
const KOI = { list: [], geos: [], mat: null };
function koiGeometry(seed) {
  const R = rngOf(seed * 53 + 7), N = 14, S = 8, pos = [], col = [], idx = [], ph = [R() * 6, R() * 6, R() * 6], kind = seed % 3; // 0 orange et blanc, 1 blanc taché, 2 or
  const lin = (r, g, b) => [sl(r), sl(g), sl(b)];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = (0.5 - u) * 0.8, rw = Math.sin(Math.pow(u, 0.75) * Math.PI) * 0.1 + 0.006;
    for (let k = 0; k < S; k++) {
      const a = (k / S) * TAU, sp = Math.sin(u * 8 + ph[0]) * Math.sin(a * 2 + ph[1]) + Math.sin(u * 15 + ph[2]) * 0.4;
      pos.push(x, Math.cos(a) * rw * 0.75, Math.sin(a) * rw);
      let c;
      if (kind === 2) c = lin(0.95, 0.68 - 0.1 * (u > 0.8 ? 1 : 0), 0.2);
      else if (sp > (kind === 0 ? 0.25 : 0.8) && Math.cos(a) > -0.2) c = lin(0.95, 0.38, 0.1);
      else if (u < 0.16 && kind === 1) c = lin(0.9, 0.3, 0.1);
      else c = lin(0.95, 0.93, 0.88);
      if (Math.cos(a) < -0.3) c = lin(0.9, 0.86, 0.8); // ventre
      col.push(...c);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < S; k++) { const a = i * S + k, b = i * S + (k + 1) % S; idx.push(a, b, a + S, b, b + S, a + S); }
  // queue : éventail plat de deux triangles, un peu plus sombre au bout
  const tx = -0.4, base = pos.length / 3; pos.push(tx, 0, 0, tx - 0.26, 0, 0.17, tx - 0.26, 0, -0.17, tx - 0.18, 0, 0); col.push(...lin(0.95, 0.5, 0.15), ...lin(0.95, 0.62, 0.3), ...lin(0.95, 0.62, 0.3), ...lin(0.95, 0.55, 0.2));
  idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base, base + 3, base + 1, base, base + 2, base + 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
/* n carpes dans le bassin poly, à la profondeur y ; libre(x, z) : l'eau où elles peuvent nager (hors île et ponts) */
function koiAdd(poly, y, n, libre, seed) {
  if (!KOI.mat) KOI.mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const R = rngOf(seed), ok = (x, z) => polyDist(poly, x, z) > 1.0 && libre(x, z);
  const spot = () => { for (let t = 0; t < 200; t++) { const p = poly[Math.floor(R() * poly.length)], q = poly[Math.floor(R() * poly.length)], u = R(), x = (p[0] + q[0]) / 2 + (R() - 0.5) * 4 * u, z = (p[1] + q[1]) / 2 + (R() - 0.5) * 4 * u; if (ok(x, z)) return [x, z]; } return poly[0].slice(); };
  for (let i = 0; i < n; i++) {
    const g = KOI.geos[(seed + i) % 6] || (KOI.geos[(seed + i) % 6] = koiGeometry((seed + i) % 6)), m = new THREE.Mesh(g, KOI.mat), s = R.range(0.65, 1.05);
    m.scale.setScalar(s); m.frustumCulled = true; m.userData.noPrepass = true; m.userData.noAO = true; m.renderOrder = 1;
    const [x, z] = spot(), w = spot(); m.position.set(x, y, z); mapAdd(m);
    KOI.list.push({ m, y, h: R() * TAU, w, v: R.range(0.45, 0.9), ph: R() * 6, ok, spot, poly });
  }
}
/* Nage : cap vers le point de passage (virage borné), nouveau point à l'arrivée ou près de la berge */
function koiUpdate(t, dt) {
  const cam = camera.position;
  for (const k of KOI.list) {
    const m = k.m; if (Math.abs(m.position.x - cam.x) > 55 || Math.abs(m.position.z - cam.z) > 55) continue;
    const dx = k.w[0] - m.position.x, dz = k.w[1] - m.position.z;
    if (dx * dx + dz * dz < 0.8 || !k.ok(m.position.x + Math.cos(k.h) * 0.9, m.position.z - Math.sin(k.h) * 0.9)) k.w = k.spot();
    let d = Math.atan2(-dz, dx) - k.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    k.h += clamp(d, -1.5 * dt, 1.5 * dt);
    const v = k.v * (0.75 + 0.25 * Math.sin(t * 0.7 + k.ph));
    m.position.x += Math.cos(k.h) * v * dt; m.position.z -= Math.sin(k.h) * v * dt;
    m.rotation.y = k.h + Math.sin(t * 7 * (v + 0.4) + k.ph) * 0.2;
  }
}
