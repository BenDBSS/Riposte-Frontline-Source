/* ==========================================================================
   ONDES : l'eau réagit. Un champ d'ondulations simulé sur la carte graphique, partagé par toutes les eaux d'une carte (la mer
   et les bassins des shaders de 02m-water.js).
   - Le champ est une fenêtre carrée de 32 m (256 x 256 points, 12,5 cm) qui suit la caméra par pas d'un point : hors de la
     fenêtre, l'eau est calme. Chaque point porte la hauteur de l'eau h, sa vitesse v et l'écume (canaux R, G, B).
   - Chaque image avance l'équation des ondes (v += c2 · laplacien(h), amortie, puis h += v ; une empreinte déplace h) : une empreinte creuse l'eau et
     des anneaux s'en vont, se croisent et s'éteignent sur les bords ; un soldat qui marche laisse un sillage en V.
   - Les empreintes (rippleAdd) viennent des pas des soldats dans un bassin, des balles qui touchent l'eau, des explosions et des
     grenades, du jet des fontaines et du pied des cascades. Rien ne bouge : aucune passe, aucun coût (le champ s'endort
     RIP.sleep secondes après la dernière empreinte).
   - Les shaders lisent le champ (ripple, dans RIP_GLSL) : pente pour les normales (reflets qui ondulent), écume sur les crêtes raides
     et au cœur des gerbes, courbure pour les caustiques.
   - Les ondes rebondissent sur les bords de l'eau : un masque de la carte (rippleMask, 4 points par mètre : les bassins, les fontaines,
     les ruisseaux, les flaques, la mer sans ses quais ni ses coques) dit où il y a de l'eau ; une cellule sèche reste à zéro et ses
     voisines la voient comme un miroir (la hauteur de l'eau se reflète sur la margelle, la berge, le quai).
   Tout appartient à la carte : cibles et matière libérées avec l'eau (rippleUnload).
   ========================================================================== */
const RIP = {
  N: 256, size: 32, sleep: 6, rt: null, cur: 0, cx: 0, cz: 0, pend: [], idle: 99, U: null, quad: null, mat: null, awake: false, jets: [],
  c: 1.8, damp: 0.9945, hDamp: 0.9995, foamDamp: 0.965, step: 1 / 60, acc: 0, gain: 6.5,
  maxSteps: () => (RQ.q.lean ? 1 : 3),
};
/* Fonctions GLSL communes aux shaders d'eau : pente de la surface (dans les unités d'une normale), hauteur, écume et courbure (laplacien,
   en 1 / m : négatif sur une bosse, qui concentre la lumière au fond comme une lentille) en (x, z) du monde */
const RIP_GLSL = `
uniform sampler2D tRip; uniform vec4 uRipB; uniform float uRipG; // x0, z0 de la fenêtre (m), 1 / taille (1 / m), 1 / N ; gain des normales
void ripple(vec2 xz, out vec2 slope, out float foam, out float height, out float lap) {
  vec2 uv = (xz - uRipB.xy) * uRipB.z;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  slope = vec2(0.0); foam = 0.0; height = 0.0; lap = 0.0;
  if (edge < 0.0) return;
  float k = smoothstep(0.0, 0.07, edge);
  vec4 c = texture2D(tRip, uv);
  float hl = texture2D(tRip, uv - vec2(uRipB.w, 0.0)).r, hr = texture2D(tRip, uv + vec2(uRipB.w, 0.0)).r;
  float hd = texture2D(tRip, uv - vec2(0.0, uRipB.w)).r, hu = texture2D(tRip, uv + vec2(0.0, uRipB.w)).r;
  float texel = uRipB.w / uRipB.z;
  slope = vec2(hl - hr, hd - hu) / (2.0 * texel) * k;
  height = c.r * k; lap = (hl + hr + hd + hu - 4.0 * c.r) / (texel * texel) * k;
  // écume : cœur des gerbes (canal B) et flancs raides et crêtes des anneaux (un trait blanc qui les dessine)
  foam = clamp(max(c.b, max(smoothstep(0.04, 0.16, length(slope)) * 0.6, smoothstep(0.012, 0.05, c.r) * 0.5)), 0.0, 1.0) * k;
}`;
/* Passe de simulation : un pas de l'équation des ondes, la fenêtre glissée de uShift (points entiers : la lecture tombe au centre des points,
   donc exacte), et les empreintes de l'image (jusqu'à 24) */
const RIP_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const RIP_FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D tPrev, tMask; uniform vec2 uShift, uOrigin; uniform vec4 uMaskB; uniform float uTexel, uSize, uC2, uDamp, uHDamp, uFoamDamp, uMaskOut; uniform int uNS; uniform vec4 uS[24], uQ[24];
vec4 at(vec2 uv) { return (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(tPrev, uv); }
// de l'eau en ce point du monde ? (masque de la carte ; au-delà, uMaskOut : la mer au large, sinon la terre)
float wet(vec2 wp) { vec2 m = (wp - uMaskB.xy) * uMaskB.zw; return (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) ? uMaskOut : step(0.5, texture2D(tMask, m).r); }
void main() {
  vec2 uv = vUv + uShift; vec4 c = at(uv), wp = vec4(uOrigin + vUv * uSize, uTexel * uSize, 0.0);
  if (wet(wp.xy) < 0.5) { gl_FragColor = vec4(0.0); return; } // terre : pas d'onde
  // voisins : une cellule sèche renvoie la hauteur de celle-ci (l'onde s'y réfléchit comme sur un mur)
  float hl = at(uv - vec2(uTexel, 0.0)).r, hr = at(uv + vec2(uTexel, 0.0)).r, hd = at(uv - vec2(0.0, uTexel)).r, hu = at(uv + vec2(0.0, uTexel)).r;
  hl = mix(c.r, hl, wet(wp.xy - vec2(wp.z, 0.0))); hr = mix(c.r, hr, wet(wp.xy + vec2(wp.z, 0.0))); hd = mix(c.r, hd, wet(wp.xy - vec2(0.0, wp.z))); hu = mix(c.r, hu, wet(wp.xy + vec2(0.0, wp.z)));
  float v = (c.g + uC2 * (hl + hr + hd + hu - 4.0 * c.r)) * uDamp, h = (c.r + v) * uHDamp, foam = c.b * uFoamDamp;
  // bords : l'onde s'y éteint (pas de réflexion qui reviendrait vers le joueur)
  vec2 e = min(vUv, 1.0 - vUv) / (8.0 * uTexel); float ab = clamp(min(e.x, e.y), 0.0, 1.0); ab = ab * ab * (3.0 - 2.0 * ab);
  v *= mix(0.55, 1.0, ab); h *= mix(0.9, 1.0, ab);
  for (int i = 0; i < 24; i++) {
    if (i >= uNS) break;
    vec2 d = wp.xy - uS[i].xy; float r = uS[i].z, q = dot(d, d) / (r * r), w = exp(-q);
    h += uS[i].w * (2.0 * w - exp(-0.5 * q)); foam += uQ[i].x * w; // creux entouré d'un bourrelet : sans volume, l'eau ne s'enfonce pas
  }
  gl_FragColor = vec4(h, v, clamp(foam, 0.0, 1.0), 0.0);
}`;
/* Crée le champ (une fois par carte qui a de l'eau) : à appeler par pondAdd et waterBuild avant le premier rendu des matières */
function rippleEnsure() {
  if (RIP.U) return RIP.U;
  const mk = () => new THREE.WebGLRenderTarget(RIP.N, RIP.N, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false });
  RIP.rt = [mk(), mk()]; RIP.cur = 0;
  RIP.U = { tRip: { value: RIP.rt[0].texture }, uRipB: { value: new THREE.Vector4(-1e5, -1e5, 1 / RIP.size, 1 / RIP.N) }, uRipG: { value: RIP.gain } };
  if (!RIP.one) { RIP.one = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); RIP.one.needsUpdate = true; } // masque par défaut : de l'eau partout
  const sn = RIP.size / RIP.N, dx = RIP.c * RIP.step / sn;
  RIP.mat = new THREE.ShaderMaterial({
    uniforms: {
      tPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uOrigin: { value: new THREE.Vector2() }, uTexel: { value: 1 / RIP.N }, uSize: { value: RIP.size },
      uC2: { value: dx * dx }, uDamp: { value: RIP.damp }, uHDamp: { value: RIP.hDamp }, uFoamDamp: { value: RIP.foamDamp }, uNS: { value: 0 },
      uS: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uQ: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) },
      tMask: { value: RIP.one }, uMaskB: { value: new THREE.Vector4(0, 0, 1, 1) }, uMaskOut: { value: 1 },
    },
    vertexShader: RIP_VERT, fragmentShader: RIP_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  RIP.quad = new THREE.FullScreenQuad(RIP.mat);
  RIP.cx = camera.position.x; RIP.cz = camera.position.z; RIP.idle = 99; RIP.awake = false; RIP.acc = 0;
  return RIP.U;
}
function rippleUnload() {
  if (RIP.rt) for (const r of RIP.rt) r.dispose();
  if (RIP.mat) RIP.mat.dispose();
  if (RIP.mask) { RIP.mask.dispose(); RIP.mask = null; }
  Object.assign(RIP, { rt: null, U: null, quad: null, mat: null, pend: [], jets: [], awake: false });
}
/* Empreinte sur l'eau en (x, z) : r (m, rayon), amp (creux en m : négatif creuse l'eau, positif la soulève), foam (écume, 0 à 1) */
function rippleAdd(x, z, r, amp, foam = 0, wake = true) {
  if (!RIP.U || RIP.pend.length >= 24) return;
  const h = RIP.size / 2 - 1;
  if (Math.abs(x - camera.position.x) > h || Math.abs(z - camera.position.z) > h) return; // hors de la fenêtre : rien à voir
  RIP.pend.push([x, z, r, amp, foam]); if (wake) RIP.idle = 0;
}
/* Vide les deux cibles (champ à zéro : la couleur d'effacement du moteur peut valoir autre chose) */
function rippleClear() {
  const prevT = renderer.getRenderTarget(), cc = renderer.getClearColor(_ripC), ca = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  for (const r of RIP.rt) { renderer.setRenderTarget(r); renderer.clear(); }
  renderer.setClearColor(cc, ca); renderer.setRenderTarget(prevT);
  RIP.cur = 0; RIP.U.tRip.value = RIP.rt[0].texture;
}
const _ripC = new THREE.Color();
/* Masque de l'eau de la carte (4 points par mètre sur ses bornes, 2 m de marge) : les triangles de chaque petite eau (PONDS), puis la mer
   (waterAt) privée de ses obstacles (quais, coques, digue, pieux : WATER.obs). Calculé une fois au chargement (ripplePrime) */
function rippleMask() {
  const ppm = 4, x0 = MAP.x0 - 2, z0 = MAP.z0 - 2, w = Math.ceil((MAP.x1 - MAP.x0 + 4) * ppm), h = Math.ceil((MAP.z1 - MAP.z0 + 4) * ppm), M = new Uint8Array(w * h);
  // petites eaux : chaque triangle de leur maillage, rempli
  const a = new V3(), b = new V3(), c = new V3();
  for (const q of PONDS) {
    const g = q.mesh.geometry, P = g.attributes.position, I = g.index, mm = q.mesh.matrix;
    for (let t = 0; t < I.count; t += 3) {
      a.fromBufferAttribute(P, I.getX(t)).applyMatrix4(mm); b.fromBufferAttribute(P, I.getX(t + 1)).applyMatrix4(mm); c.fromBufferAttribute(P, I.getX(t + 2)).applyMatrix4(mm);
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - x0) * ppm)), i1 = Math.min(w - 1, Math.ceil((Math.max(a.x, b.x, c.x) - x0) * ppm));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - z0) * ppm)), j1 = Math.min(h - 1, Math.ceil((Math.max(a.z, b.z, c.z) - z0) * ppm));
      const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) / ppm, z = z0 + (j + 0.5) / ppm, l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
        if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) M[j * w + i] = 255;
      }
    }
  }
  // la mer, sans ses obstacles
  if (WATER.on) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = x0 + (i + 0.5) / ppm, z = z0 + (j + 0.5) / ppm; if (waterAt(x, z)) M[j * w + i] = 255; }
    for (const o of WATER.obs) {
      const Q = o.poly; let qx0 = 1e9, qx1 = -1e9, qz0 = 1e9, qz1 = -1e9;
      for (const [x, z] of Q) { qx0 = Math.min(qx0, x); qx1 = Math.max(qx1, x); qz0 = Math.min(qz0, z); qz1 = Math.max(qz1, z); }
      for (let j = Math.max(0, Math.floor((qz0 - z0) * ppm)); j <= Math.min(h - 1, Math.ceil((qz1 - z0) * ppm)); j++) for (let i = Math.max(0, Math.floor((qx0 - x0) * ppm)); i <= Math.min(w - 1, Math.ceil((qx1 - x0) * ppm)); i++) {
        const x = x0 + (i + 0.5) / ppm, z = z0 + (j + 0.5) / ppm; let n = false;
        for (let p = 0, q = Q.length - 1; p < Q.length; q = p++) if ((Q[p][1] > z) !== (Q[q][1] > z) && x < ((Q[q][0] - Q[p][0]) * (z - Q[p][1])) / (Q[q][1] - Q[p][1]) + Q[p][0]) n = !n;
        if (n) M[j * w + i] = 0;
      }
    }
  }
  if (RIP.mask) RIP.mask.dispose();
  const tex = new THREE.DataTexture(M, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
  RIP.mask = tex;
  const U = RIP.mat.uniforms; U.tMask.value = tex; U.uMaskB.value.set(x0, z0, 1 / (w / ppm), 1 / (h / ppm)); U.uMaskOut.value = WATER.on ? 1 : 0;
}
/* Au chargement de la carte (mapCompile, après la compilation des shaders) : un pas à vide compile le programme de la passe et alloue
   les deux cibles, au lieu du premier réveil du champ, en pleine partie (une saccade : compilation, deux textures) */
function ripplePrime() {
  if (!RIP.U) return;
  rippleMask();
  rippleClear();
  const M = RIP.mat.uniforms, prevT = renderer.getRenderTarget(), ac = renderer.autoClear;
  M.uNS.value = 0; M.uShift.value.set(0, 0); M.tPrev.value = RIP.rt[0].texture;
  renderer.autoClear = false; renderer.setRenderTarget(RIP.rt[1]); RIP.quad.render(renderer);
  renderer.autoClear = ac; renderer.setRenderTarget(prevT);
}
/* Avance le champ d'une image (appelée par mapUpdate) : empreintes des soldats et des jets, fenêtre recentrée sur la caméra, pas de simulation */
function rippleUpdate(dt) {
  if (!RIP.U) return;
  const sn = RIP.size / RIP.N, cx = Math.round(camera.position.x / sn) * sn, cz = Math.round(camera.position.z / sn) * sn, U = RIP.U.uRipB.value;
  rippleSources(dt);
  RIP.idle += dt;
  if (RIP.idle > RIP.sleep) { // champ calme : la fenêtre suit la caméra sans calcul, tout y est à zéro
    if (RIP.awake) { RIP.awake = false; rippleClear(); }
    RIP.cx = cx; RIP.cz = cz; U.set(cx - RIP.size / 2, cz - RIP.size / 2, 1 / RIP.size, 1 / RIP.N);
    return;
  }
  RIP.awake = true;
  RIP.acc = Math.min(RIP.acc + dt, RIP.maxSteps() * RIP.step); // au profil bas, une passe par image : une image lente n'en demande pas davantage
  const steps = Math.floor(RIP.acc / RIP.step); RIP.acc -= steps * RIP.step;
  if (!steps) return; // image plus courte qu'un pas : les empreintes attendent, la fenêtre aussi
  const shiftX = Math.round((cx - RIP.cx) / sn), shiftZ = Math.round((cz - RIP.cz) / sn);
  const M = RIP.mat.uniforms, prevT = renderer.getRenderTarget(), ac = renderer.autoClear;
  M.uOrigin.value.set(cx - RIP.size / 2, cz - RIP.size / 2);
  renderer.autoClear = false;
  for (let s = 0; s < steps; s++) {
    // empreintes et décalage de la fenêtre à la première passe seulement
    const n = s === 0 ? Math.min(24, RIP.pend.length) : 0;
    for (let i = 0; i < n; i++) { const p = RIP.pend[i]; M.uS.value[i].set(p[0], p[1], Math.max(0.14, p[2]), p[3]); M.uQ.value[i].set(p[4], 0, 0, 0); }
    M.uNS.value = n; if (s === 0) RIP.pend.splice(0, n);
    M.uShift.value.set(s === 0 ? shiftX / RIP.N : 0, s === 0 ? shiftZ / RIP.N : 0);
    M.tPrev.value = RIP.rt[RIP.cur].texture;
    renderer.setRenderTarget(RIP.rt[1 - RIP.cur]); RIP.quad.render(renderer);
    RIP.cur = 1 - RIP.cur;
  }
  renderer.autoClear = ac; renderer.setRenderTarget(prevT);
  RIP.cx = cx; RIP.cz = cz; U.set(cx - RIP.size / 2, cz - RIP.size / 2, 1 / RIP.size, 1 / RIP.N);
  RIP.U.tRip.value = RIP.rt[RIP.cur].texture;
}

/* ---------- Sources : soldats qui pataugent, jets des fontaines ---------- */
const _rpV = new V3();
function rippleSources(dt) {
  const cam = camera.position, h = RIP.size / 2 - 1;
  for (const e of entities) {
    if (!e.alive || e.off || !e.vel) continue;
    if (Math.abs(e.pos.x - cam.x) > h || Math.abs(e.pos.z - cam.z) > h) continue;
    const surf = waterSurfaceAt(e.pos.x, e.pos.z); if (surf === null || e.pos.y > surf + 0.12) continue;
    const sp = hyp(e.vel.x, e.vel.z); if (sp < 0.15) continue;
    // sillage : une empreinte par image sous les pieds, plus large et plus creuse à mesure qu'on court (le mouvement du soldat fait le V)
    // (devant les pieds : la proue du soldat pousse l'eau sous les yeux du joueur, au lieu que le sillage reste derrière lui)
    rippleAdd(e.pos.x + e.vel.x / sp * 0.8, e.pos.z + e.vel.z / sp * 0.8, 0.26 + Math.min(sp, 6.5) * 0.045, -0.0055 * (0.5 + Math.min(sp, 6.5) / 2.2) * Math.min(dt * 60, 2), Math.min(0.035, sp * 0.006) * Math.min(dt * 60, 2));
  }
  // jets : ils ne réveillent le champ que devant le joueur (ou tout près) ; derrière lui, ils n'impriment que si le champ est déjà éveillé
  // (un pas, un tir) : un bassin dans le dos ne fait plus tourner la simulation sans fin
  camera.getWorldDirection(_rpV);
  const awake = RIP.idle <= RIP.sleep;
  for (const j of RIP.jets) {
    j.t -= dt; if (j.t > 0) continue;
    j.t = j.every;
    const dx = j.x - cam.x, dz = j.z - cam.z, d2 = dx * dx + dz * dz, fw = dx * _rpV.x + dz * _rpV.z, seen = d2 < 16 || fw > 0.3 * Math.sqrt(d2);
    if (seen || awake) rippleAdd(j.x, j.z, j.r, j.amp, j.foam, seen);
  }
}
/* Source continue : un jet de fontaine ou le pied d'une cascade (une empreinte toutes les `every` s, en un point fixe) */
function rippleSource(x, z, r, amp, every, foam = 0) { if (RIP.U) RIP.jets.push({ x, z, r, amp, every, foam, t: Math.random() * every }); }

/* Éclaboussure d'un pas dans l'eau : quelques gouttes, une empreinte plus nette ; sp : vitesse du soldat, vel : sa vitesse (l'éclaboussure part devant le pied) */
function stepSplashFx(pos, sp, vel) {
  const surf = waterSurfaceAt(pos.x, pos.z); if (surf === null) return;
  const k = clamp(sp / 5, 0.4, 1.3), vl = vel ? hyp(vel.x, vel.z) : 0, ox = vl > 0.1 ? vel.x / vl * 0.6 : 0, oz = vl > 0.1 ? vel.z / vl * 0.6 : 0;
  rippleAdd(pos.x + ox, pos.z + oz, 0.26 + 0.1 * k, -0.17 * k, 0.2 * k);
  for (let i = 0; i < 4 + Math.floor(3 * k); i++) FX.smoke.spawn(pos.x + ox + rand(-0.15, 0.15), surf + 0.04, pos.z + oz + rand(-0.15, 0.15), rand(-0.6, 0.6) * k, rand(1.2, 2.6) * k, rand(-0.6, 0.6) * k, rand(0.3, 0.55), 0.035 * k, 0.025, 0.84, 0.89, 0.92, 0.9, 0.3, 9.8, 0.4);
}
