/* ==========================================================================
   EFFETS : particules GPU, décals instanciés, traçantes, explosions
   ========================================================================== */
let FXT = null;

class Particles {
  constructor(max, tex, additive) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.col = new Float32Array(max * 4); this.a1 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.rot = new Float32Array(max); this.rs = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aR = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('aColor', this.aC); g.setAttribute('aSize', this.aS); g.setAttribute('aRot', this.aR);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 600 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; attribute float aRot; varying vec4 vC; varying float vR; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = aSize*uScale/max(-mv.z,0.05); vC = aColor; vR = aRot; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; varying float vR;
        void main(){ vec2 c = gl_PointCoord-0.5; float s=sin(vR), k=cos(vR); c = vec2(k*c.x-s*c.y, s*c.x+k*c.y)+0.5;
          vec4 t = texture2D(map, c); gl_FragColor = vec4(vC.rgb*t.rgb, vC.a*t.a); if(gl_FragColor.a<0.004) discard; }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, a1, grav = 0, drag = 0, rs = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a0; this.a1[i] = a1;
    this.grav[i] = grav; this.drag[i] = drag; this.rot[i] = Math.random() * TAU; this.rs[i] = rs;
  }
  update(dt) {
    let i = 0;
    const P = this.aP.array, C = this.aC.array, S = this.aS.array, R = this.aR.array;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(this.n - 1, i); this.n--; continue; }
      const k = i * 3, d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= d; this.v[k + 1] = this.v[k + 1] * d - this.grav[i] * dt; this.v[k + 2] *= d;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.grav[i] > 0 && this.p[k + 1] < (RELIEF.on ? reliefAt(this.p[k], this.p[k + 2]) : 0) + 0.02) { // sol implicite : le relief d'une carte en dunes
        // au-dessus de l'eau, la goutte poursuit sa chute et disparaît sous la surface ; ailleurs elle rebondit sur le sol ;
        // au-dessus du vide (îles flottantes), elle tombe jusqu'à la fin de sa vie, et rebondit sur le dessus d'une île ou un tablier
        const ws = waterSurfaceAt(this.p[k], this.p[k + 2]);
        if (ws !== null) { if (this.p[k + 1] < ws) this.life[i] = 0; }
        else if (VOID.on) {
          if (this.p[k + 1] > -1.5) { const g = groundHeight(this.p[k], this.p[k + 2], this.p[k + 1] + 0.3, 0); if (g > VOID.floor + 1 && this.p[k + 1] < g + 0.02) { this.p[k + 1] = g + 0.02; this.v[k + 1] *= -0.3; this.v[k] *= 0.6; this.v[k + 2] *= 0.6; } }
        } else { this.p[k + 1] = (RELIEF.on ? reliefAt(this.p[k], this.p[k + 2]) : 0) + 0.02; this.v[k + 1] *= -0.3; this.v[k] *= 0.6; this.v[k + 2] *= 0.6; }
      }
      this.rot[i] += this.rs[i] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      P[k] = this.p[k]; P[k + 1] = this.p[k + 1]; P[k + 2] = this.p[k + 2];
      C[i * 4] = this.col[i * 4]; C[i * 4 + 1] = this.col[i * 4 + 1]; C[i * 4 + 2] = this.col[i * 4 + 2];
      C[i * 4 + 3] = lerp(this.col[i * 4 + 3], this.a1[i], t) * Math.min(1, t * 12);
      S[i] = lerp(this.s0[i], this.s1[i], 1 - (1 - t) * (1 - t));
      R[i] = this.rot[i];
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aP.needsUpdate = this.aC.needsUpdate = this.aS.needsUpdate = this.aR.needsUpdate = true;
  }
  copy(from, to) {
    if (from === to) return;
    for (let c = 0; c < 3; c++) { this.p[to * 3 + c] = this.p[from * 3 + c]; this.v[to * 3 + c] = this.v[from * 3 + c]; }
    for (let c = 0; c < 4; c++) this.col[to * 4 + c] = this.col[from * 4 + c];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from];
    this.a1[to] = this.a1[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.rot[to] = this.rot[from]; this.rs[to] = this.rs[from];
  }
}

/* Décalcomanies (impacts, sang, brûlures) : elles assombrissent la surface qu'elles recouvrent (mélange multiplicatif), qui garde son propre
   éclairage, ses ombres et son brouillard. Un shader d'une lecture de texture : avant, chacune était une matière PBR transparente complète
   (ombres en cascade, ambiance), dont la surface à ombrer grandissait au fil de la partie, jusqu'à 20 brûlures de 4 m et 60 taches de sang.
   k : force de la teinte (la couleur de la texture, sombre, est multipliée par k avant d'assombrir). life : durée de vie (s, temps de jeu,
   0 : pour toute la partie), les fade dernières secondes en s'effaçant (les brûlures : au-delà, une tache noire sans explosion visible
   passait pour un défaut du sol). */
const DECAL_VERT = 'attribute float aT; uniform float uNow, uLife, uFade; varying vec2 vUv; varying float vF; void main() { vUv = uv; vF = uLife > 0.0 ? clamp((uLife - (uNow - aT)) / uFade, 0.0, 1.0) : 1.0; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }';
const DECAL_FRAG = 'uniform sampler2D map; uniform float uK; varying vec2 vUv; varying float vF; void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(mix(vec3(1.0), min(t.rgb * uK, vec3(1.0)), t.a * vF), 1.0); }';
const DECAL_U = { uNow: { value: 0 } }; // horloge des décalcomanies : avance avec updateFx, à chaque image hors des menus
class Decals {
  constructor(max, tex, size, opts = {}) {
    this.max = max; this.i = 0; this.size = size; this.life = opts.life || 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uK: { value: opts.k || 1 }, uNow: DECAL_U.uNow, uLife: { value: this.life }, uFade: { value: opts.fade || 1 } }, vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    });
    const geo = new THREE.PlaneGeometry(1, 1); this.aT = new THREE.InstancedBufferAttribute(new Float32Array(max), 1); geo.setAttribute('aT', this.aT);
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    _m1.makeScale(0, 0, 0);
    for (let k = 0; k < max; k++) this.mesh.setMatrixAt(k, _m1);
    scene.add(this.mesh);
  }
  add(p, n, scale = 1) {
    _v1.set(n.x, n.y, n.z);
    _q1.setFromUnitVectors(new V3(0, 0, 1), _v1);
    const spin = new THREE.Quaternion().setFromAxisAngle(_v1, Math.random() * TAU);
    _q1.premultiply(spin);
    const s = this.size * scale * rand(0.8, 1.2);
    _m1.compose(_v2.copy(p).addScaledVector(_v1, 0.012), _q1, _v3.set(s, s, s));
    this.mesh.setMatrixAt(this.i, _m1); this.mesh.instanceMatrix.needsUpdate = true;
    this.aT.array[this.i] = DECAL_U.uNow.value; this.aT.needsUpdate = true;
    this.i = (this.i + 1) % this.max;
  }
  clear() { _m1.makeScale(0, 0, 0); for (let k = 0; k < this.max; k++) this.mesh.setMatrixAt(k, _m1); this.mesh.instanceMatrix.needsUpdate = true; }
}

/* Traçantes : quads étirés orientés vers la caméra */
class Tracers {
  constructor(max) {
    this.max = max; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 6 * 3); this.uvs = new Float32Array(max * 6 * 2); this.alp = new Float32Array(max * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    g.setAttribute('aA', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < max; i++) {
      const u = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
      for (let k = 0; k < 12; k++) this.uvs[i * 12 + k] = u[k];
    }
    this.mat = new THREE.ShaderMaterial({
      vertexShader: `attribute float aA; varying vec2 vUv; varying float vA; void main(){ vUv=uv; vA=aA; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying float vA; void main(){ float e = 1.0-abs(vUv.y-0.5)*2.0; float l = smoothstep(0.0,0.35,vUv.x)*smoothstep(1.0,0.9,vUv.x);
        gl_FragColor = vec4(vec3(4.0,2.6,1.2)*e*l*vA, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }
  add(a, b, speed = 380) {
    const d = a.distanceTo(b); if (d < 1.5) return;
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ a: a.clone(), dir: _v1.subVectors(b, a).normalize().clone(), d, t: 0, speed, len: Math.min(6, d * 0.4) });
  }
  update(dt) {
    const cam = camera.position; let k = 0;
    this.list = this.list.filter((tr) => { tr.t += dt * tr.speed; return tr.t - tr.len < tr.d; });
    for (const tr of this.list) {
      const h = Math.min(tr.t, tr.d), tl = Math.max(0, tr.t - tr.len);
      const A = _v1.copy(tr.a).addScaledVector(tr.dir, tl), Bp = _v2.copy(tr.a).addScaledVector(tr.dir, h);
      const mid = _v3.addVectors(A, Bp).multiplyScalar(0.5);
      const view = _v4.subVectors(cam, mid).normalize();
      const side = new V3().crossVectors(tr.dir, view).normalize().multiplyScalar(0.018 + mid.distanceTo(cam) * 0.0012);
      const quad = [A.clone().sub(side), Bp.clone().sub(side), Bp.clone().add(side), A.clone().sub(side), Bp.clone().add(side), A.clone().add(side)];
      for (let q = 0; q < 6; q++) { this.pos[k * 18 + q * 3] = quad[q].x; this.pos[k * 18 + q * 3 + 1] = quad[q].y; this.pos[k * 18 + q * 3 + 2] = quad[q].z; this.alp[k * 6 + q] = 0.9; }
      k++;
    }
    for (let q = k * 18; q < this.max * 18; q++) this.pos[q] = 0;
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.aA.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, k * 6);
  }
}

let FX = null;
function initFx() {
  FX = {
    add: new Particles(1400, FXT.glow, true),
    flash: new Particles(120, FXT.star, true),
    muzzle: new Particles(48, FXT.flashP, true), // rosaces des tirs vus de loin (01-core.js, flashTex)
    smoke: new Particles(900, FXT.smoke, false),
    blood: new Particles(300, FXT.smoke, false),
    holes: new Decals(220, FXT.hole, 0.13),
    splats: new Decals(60, FXT.blood, 0.6, { k: 3.2 }), // le sang : rouge sombre, éclairci pour rester rouge une fois multiplié
    scorch: new Decals(20, FXT.scorch, 4.2, { life: 40, fade: 12 }), // une brûlure s'efface en douze secondes, une demi-minute après l'explosion
    tracers: new Tracers(48),
    dust: null, rings: [],
  };
  const rt = canvasTex(128, (g, sz) => { const r = g.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.72, 'rgba(255,255,255,0)'); r.addColorStop(0.88, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, sz, sz); }, false);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt, color: 0xffd9a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); FX.rings.push({ mesh: m, on: false, t: 0, dur: 1, r: 1 });
  }
  // poussière en suspension dans la lumière
  // poussière : uniquement autour de la caméra et assez grosse pour ne jamais tomber sous le pixel (sinon elle scintille)
  const n = 160, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = rand(-9, 9); p[i * 3 + 1] = rand(0.3, 4); p[i * 3 + 2] = rand(-9, 9); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  // grains ronds et flous, jamais à moins de 2,5 m de l'œil : près de l'arme, ils passaient pour des pièces du modèle
  FX.dust = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color().setRGB(1.3, 1.05, 0.78) }, uScale: { value: 540 } },
    vertexShader: `uniform float uScale; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        vA = smoothstep(2.5, 4.5, d) * (1.0 - smoothstep(7.0, 9.0, d));
        gl_PointSize = clamp(0.03 * uScale / max(d, 0.1), 1.5, 5.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.2, 1.0, r)) * vA * 0.14;
        if (a < 0.003) discard; gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  FX.dust.frustumCulled = false; scene.add(FX.dust);
  applyAtmoFx();
  onResizeFx();
}
/* Grains en suspension aux couleurs de la carte chargée (aucun sur une carte d'hiver : les flocons les remplacent) */
function applyAtmoFx() {
  if (!FX) return;
  const m = CURMAP.def ? CURMAP.def.atmo.motes : ATMO_DEFAULT.motes;
  FX.dust.visible = !!m; if (m) FX.dust.material.uniforms.uColor.value.setRGB(...m);
}
/* Pixels par unité d'angle des points (gl_PointSize), comptés dans l'image 3D rendue (RS.h, plus petite que la toile quand le profil ou la
   résolution dynamique la réduisent) : compter les pixels de la toile grossissait les particules d'autant (2,7 fois sur téléphone en Basse) */
function pointScale() {
  const h = RS.h > 1 ? RS.h : VIEW.h * renderPixelRatio();
  return h / (2 * Math.tan((camera.fov * Math.PI) / 360));
}
function onResizeFx() {
  if (!FX) return;
  const s = pointScale();
  for (const k of ['add', 'flash', 'muzzle', 'smoke', 'blood']) FX[k].mat.uniforms.uScale.value = s;
  if (FX.dust) FX.dust.material.uniforms.uScale.value = s;
  if (SNOWFALL.mat) SNOWFALL.mat.uniforms.uScale.value = s;
  VIE.uScale.value = s; // essaims de la carte de jardin (02x-vie.js)
}
function updateFx(dt) {
  DECAL_U.uNow.value += dt;
  FX.add.update(dt); FX.flash.update(dt); FX.muzzle.update(dt); FX.smoke.update(dt); FX.blood.update(dt); FX.tracers.update(dt); updateRings(dt);
  const p = FX.dust.geometry.attributes.position.array, t = performance.now() * 0.0003, c = camera.position;
  for (let i = 0; i < p.length; i += 3) {
    p[i] += Math.sin(t + i) * 0.002; p[i + 1] += Math.cos(t * 1.3 + i) * 0.0015;
    if (p[i] - c.x > 9) p[i] -= 18; else if (p[i] - c.x < -9) p[i] += 18;
    if (p[i + 2] - c.z > 9) p[i + 2] -= 18; else if (p[i + 2] - c.z < -9) p[i + 2] += 18;
    if (p[i + 1] - c.y > 3) p[i + 1] -= 4; else if (p[i + 1] - c.y < -1.5) p[i + 1] += 4;
  }
  FX.dust.geometry.attributes.position.needsUpdate = true;
}

/* Impact de balle sur la géométrie (noHole : sans trou de balle, pour un objet qui bouge) */
function impactFx(p, n, m, big, noHole) {
  if (m === 'water') { waterSplashFx(p, big); return; } // gerbe, ni trou ni poussière (02m-water.js)
  if (n.y > 0.5 && PONDAREAS.length) { const sy = pondHitAt(p); if (sy !== null) { waterSplashFx({ x: p.x, y: sy, z: p.z }, big); return; } } // tir dans l'eau d'une fontaine
  const nx = n.x, ny = n.y, nz = n.z;
  if (p.y < 2.4) bendBlast(p.x, p.z, big ? 1.8 : 1.1, big ? 4 : 2.2); // le souffle d'un impact couche les herbes alentour (02n-flore.js)
  if (m !== 'glass' && m !== 'leaf' && !noHole) FX.holes.add(p, n, big ? 1.8 : 1); // pas de trou sur un prop (il bouge) ni sur une haie
  if (m === 'metal') {
    for (let i = 0; i < 8; i++) FX.add.spawn(p.x, p.y, p.z, nx * rand(2, 6) + rand(-3, 3), ny * rand(2, 6) + rand(-1, 4), nz * rand(2, 6) + rand(-3, 3), rand(0.15, 0.35), 0.03, 0.01, 4, 2.4, 1.0, 1, 0.2, 14, 1);
    FX.flash.spawn(p.x + nx * 0.03, p.y + ny * 0.03, p.z + nz * 0.03, 0, 0, 0, 0.05, 0.25, 0.35, 3, 2.2, 1.2, 1, 0);
    FX.smoke.spawn(p.x, p.y, p.z, nx * 0.6, ny * 0.6 + 0.3, nz * 0.6, 0.6, 0.15, 0.6, 0.55, 0.53, 0.5, 0.35, 0, 0, 1.5);
  } else if (m === 'wood') {
    for (let i = 0; i < 6; i++) FX.smoke.spawn(p.x, p.y, p.z, nx * rand(1, 4) + rand(-1.5, 1.5), ny * rand(1, 3) + rand(0, 3), nz * rand(1, 4) + rand(-1.5, 1.5), rand(0.4, 0.8), 0.05, 0.03, 0.28, 0.18, 0.09, 1, 0.8, 12, 1);
    FX.smoke.spawn(p.x, p.y, p.z, nx * 0.5, ny * 0.5 + 0.2, nz * 0.5, 0.9, 0.2, 0.7, 0.45, 0.38, 0.28, 0.4, 0, 0, 1.5);
  } else if (m === 'glass') {
    // vitrage blindé de la serre : éclats blancs qui rebondissent et petit voile, pas de trou
    for (let i = 0; i < 7; i++) FX.add.spawn(p.x, p.y, p.z, nx * rand(1.5, 4) + rand(-2, 2), ny * rand(1.5, 4) + rand(-1, 3), nz * rand(1.5, 4) + rand(-2, 2), rand(0.12, 0.3), 0.025, 0.01, 1.6, 2.0, 2.4, 1, 0.2, 12, 1);
    FX.smoke.spawn(p.x, p.y, p.z, nx * 0.5, ny * 0.5 + 0.2, nz * 0.5, 0.5, 0.12, 0.45, 0.82, 0.9, 0.9, 0.2, 0, 0, 1.5);
  } else if (m === 'leaf') {
    // haie ou feuillage : éclats de feuilles vertes projetés, léger nuage de pollen
    for (let i = 0; i < 9; i++) FX.smoke.spawn(p.x, p.y, p.z, nx * rand(1, 4) + rand(-1.5, 1.5), ny * rand(1, 3) + rand(0, 3), nz * rand(1, 4) + rand(-1.5, 1.5), rand(0.5, 1.0), 0.05, 0.03, rand(0.15, 0.3), rand(0.4, 0.62), 0.1, 1, 0.8, 9, 1);
    FX.smoke.spawn(p.x, p.y, p.z, nx * 0.5, ny * 0.5 + 0.2, nz * 0.5, 0.9, 0.2, 0.7, 0.72, 0.8, 0.42, 0.3, 0, 0, 1.5);
  } else if (m === 'snow' || (m === 'ground' && CURMAP.def.atmo.snow)) {
    // neige : panache de poudre blanche qui retombe lentement, quelques mottes
    FX.smoke.spawn(p.x, p.y, p.z, nx * 1.4, ny * 1.4 + 0.6, nz * 1.4, 1.1, 0.2, 1.1, 0.9, 0.93, 0.97, 0.6, 0, 0.25, 1.4, rand(-1, 1));
    FX.smoke.spawn(p.x, p.y, p.z, nx * 0.5, ny * 0.5 + 0.3, nz * 0.5, 1.8, 0.3, 1.6, 0.88, 0.91, 0.95, 0.32, 0, 0.1, 0.9, rand(-1, 1));
    for (let i = 0; i < 8; i++) FX.smoke.spawn(p.x, p.y, p.z, nx * rand(1, 4) + rand(-1.5, 1.5), ny * rand(1, 4) + rand(0.5, 3), nz * rand(1, 4) + rand(-1.5, 1.5), rand(0.4, 0.9), 0.035, 0.02, 0.95, 0.97, 1.0, 1, 0.8, 9, 0.8);
  } else {
    const dust = m === 'ground' ? CURMAP.def.atmo.impact : m === 'dirt' ? [0.5, 0.4, 0.28] : [0.62, 0.58, 0.52];
    FX.smoke.spawn(p.x, p.y, p.z, nx * 1.2, ny * 1.2 + 0.4, nz * 1.2, 1.0, 0.18, 0.9, dust[0], dust[1], dust[2], 0.55, 0, 0, 1.6, rand(-1, 1));
    FX.smoke.spawn(p.x, p.y, p.z, nx * 0.4, ny * 0.4 + 0.2, nz * 0.4, 1.6, 0.25, 1.4, dust[0], dust[1], dust[2], 0.3, 0, 0, 1, rand(-1, 1));
    for (let i = 0; i < 6; i++) FX.smoke.spawn(p.x, p.y, p.z, nx * rand(1, 5) + rand(-2, 2), ny * rand(1, 4) + rand(0, 3), nz * rand(1, 5) + rand(-2, 2), rand(0.3, 0.7), 0.04, 0.02, dust[0] * 0.6, dust[1] * 0.6, dust[2] * 0.6, 1, 0.8, 14, 0.5);
    // éclats de matière chauds et bref éclair de l'impact sur le béton, la brique et la pierre
    if (m === 'concrete' || m === 'brick' || m === 'stone') {
      for (let i = 0; i < (big ? 8 : 4); i++) FX.add.spawn(p.x, p.y, p.z, nx * rand(2, 7) + rand(-3, 3), ny * rand(2, 6) + rand(0, 3), nz * rand(2, 7) + rand(-3, 3), rand(0.12, 0.28), 0.03, 0.01, 3.2, 2.2, 1.0, 1, 0, 12, 0.5);
      if (Math.random() < 0.6) FX.flash.spawn(p.x + nx * 0.03, p.y + ny * 0.03, p.z + nz * 0.03, 0, 0, 0, 0.04, 0.16, 0.26, 3, 2.2, 1.3, 1, 0);
    } else if (Math.random() < 0.4) for (let i = 0; i < 3; i++) FX.add.spawn(p.x, p.y, p.z, nx * 3 + rand(-2, 2), ny * 3 + rand(0, 3), nz * 3 + rand(-2, 2), 0.15, 0.025, 0.01, 3, 2, 0.8, 1, 0, 12, 0);
  }
}
/* Corps qui s'écrase : nuage de poussière (ou de poudreuse) à ras du sol, proportionné au choc */
function bodyDustFx(p, k) {
  const dust = CURMAP.def.atmo.impact, a = 0.38 * k, y = VOID.on ? p.y : gy0(p.x, p.z) + 0.05; // îles flottantes : à la hauteur du choc (pas de sol à 0) ; dunes : sur le sable
  FX.smoke.spawn(p.x, y, p.z, 0, 0.35, 0, 1.1, 0.25, 1.1, dust[0], dust[1], dust[2], a, 0, 0, 1.6, rand(-1, 1));
  for (let i = 0; i < 3; i++) { const t = rand(0, TAU); FX.smoke.spawn(p.x, y, p.z, Math.cos(t) * rand(0.6, 1.6) * k, rand(0.1, 0.5), Math.sin(t) * rand(0.6, 1.6) * k, rand(0.7, 1.2), 0.15, 0.7, dust[0], dust[1], dust[2], a * 0.7, 0, 0, 1.2, rand(-1, 1)); }
}
function bloodFx(p, dir, head) {
  const n = head ? 22 : 12;
  for (let i = 0; i < n; i++) FX.blood.spawn(p.x, p.y, p.z, dir.x * rand(1, 4) + rand(-1.4, 1.4), rand(-0.5, 2.4), dir.z * rand(1, 4) + rand(-1.4, 1.4), rand(0.3, 0.7), 0.07, 0.03, 0.26, 0.01, 0.01, 1, 0.8, 9, 1);
  // brume rouge qui s'ouvre derrière l'impact, gouttes plus lourdes qui retombent
  FX.blood.spawn(p.x, p.y, p.z, dir.x * 0.8, 0.2, dir.z * 0.8, 0.5, 0.25, head ? 1.1 : 0.75, 0.3, 0.02, 0.02, 0.85, 0, 0, 2);
  FX.blood.spawn(p.x, p.y, p.z, dir.x * 1.8, 0.4, dir.z * 1.8, 0.35, 0.12, head ? 0.7 : 0.45, 0.28, 0.02, 0.02, 0.7, 0, 0, 2.5);
  for (let i = 0; i < (head ? 4 : 2); i++) FX.blood.spawn(p.x, p.y, p.z, dir.x * rand(2, 5) + rand(-1, 1), rand(0.5, 2.5), dir.z * rand(2, 5) + rand(-1, 1), rand(0.5, 0.9), 0.09, 0.05, 0.2, 0.0, 0.0, 1, 0.9, 12, 0.5);
  // éclaboussure sur le mur derrière
  const h = rayWorld(p.x, p.y, p.z, dir.x, dir.y, dir.z, 3);
  if (h) FX.splats.add(_v3.set(p.x + dir.x * h.t, p.y + dir.y * h.t, p.z + dir.z * h.t), new V3(h.nx, h.ny, h.nz), head ? 1.2 : 0.8);
}
/* mute : arme silencieuse, ni flash ni étincelles, un simple filet de fumée ; f : force du flash de l'arme (FEEL.flash, 1 par défaut).
   Une rosace face à la caméra, puis trois lueurs de plus en plus petites le long du tir : vue de côté, une langue de flamme. */
function muzzleWorldFx(p, dir, mute, f = 1) {
  if (mute) { FX.smoke.spawn(p.x, p.y, p.z, dir.x * 0.6 + rand(-0.15, 0.15), 0.3, dir.z * 0.6 + rand(-0.15, 0.15), 0.5, 0.07, 0.4, 0.62, 0.6, 0.58, 0.07, 0, 0, 1.2); return; }
  const k = clamp(0.65 + 0.35 * f, 0.8, 1.6);
  FX.muzzle.spawn(p.x, p.y, p.z, 0, 0, 0, 0.05, 0.62 * k, 0.85 * k, 3.4, 2.8, 2.2, 1, 0.1);
  for (let i = 1; i <= 3; i++) { const d = 0.12 * i * k; FX.add.spawn(p.x + dir.x * d, p.y + dir.y * d, p.z + dir.z * d, dir.x * 2.5, dir.y * 2.5, dir.z * 2.5, 0.05, (0.34 - 0.07 * i) * k, (0.26 - 0.06 * i) * k, 4, 2.6 - 0.35 * i, 1 - 0.25 * i, 0.9, 0); }
  for (let i = 0; i < 2; i++) FX.add.spawn(p.x, p.y, p.z, dir.x * rand(4, 10) + rand(-2, 2), dir.y * rand(4, 10) + rand(-1, 2), dir.z * rand(4, 10) + rand(-2, 2), rand(0.05, 0.12), 0.025, 0.008, 4, 2.4, 1.0, 1, 0, 2, 2);
  FX.smoke.spawn(p.x, p.y, p.z, dir.x * 1.2 + rand(-0.2, 0.2), 0.5, dir.z * 1.2 + rand(-0.2, 0.2), 0.8, 0.1, 0.6, 0.6, 0.58, 0.55, 0.18, 0, 0, 1.2);
}
/* Onde de choc au sol : anneau lumineux qui s'élargit vite en s'éteignant (réserve de 4, la plus ancienne est recyclée) */
function shockRing(p, r, dur) {
  if (!FX || !FX.rings) return;
  const R = FX.rings; let best = R[0];
  for (const q of R) { if (!q.on) { best = q; break; } if (q.t > best.t) best = q; }
  best.on = true; best.t = 0; best.dur = dur; best.r = r; best.mesh.position.set(p.x, groundHeight(p.x, p.z, p.y + 0.5) + 0.06, p.z); best.mesh.visible = true;
}
function updateRings(dt) {
  for (const q of FX.rings) {
    if (!q.on) continue;
    q.t += dt; const u = q.t / q.dur;
    if (u >= 1) { q.on = false; q.mesh.visible = false; continue; }
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    q.mesh.scale.setScalar(Math.max(0.2, q.r * 2 * e)); q.mesh.material.opacity = 0.7 * Math.pow(1 - u, 1.6);
  }
}
/* Explosion : éclair, boule de feu, étincelles et braises, anneau de poussière et onde de choc, débris, colonne de fumée
   noire puis nuage qui s'étale, tache de brûlé, lumière qui s'éteint en deux temps. k = ampleur (1 : grenade) ; replay : rejouée par la
   killcam (sa brûlure est déjà au sol : sans en poser une seconde) */
function explosionFx(p, k = 1, replay = false) {
  const surf = waterSurfaceAt(p.x, p.z);
  if (surf !== null && p.y < surf + 0.3) { waterBlastFx(p, 1); flashLight(new V3(p.x, surf + 0.5, p.z), 4, 10, 0.2, 0xb0d0ff); return; } // sous l'eau : gerbe
  // de l'eau tout près (un bassin, la mer au pied du quai) : le souffle la creuse, des anneaux en partent (02mb-ondes.js ; le masque de l'eau
  // garde les seules cellules mouillées)
  if (surf !== null || [0, 1, 2, 3, 4, 5, 6, 7].some((i) => waterSurfaceAt(p.x + Math.cos(i * 0.785) * 3.5 * k, p.z + Math.sin(i * 0.785) * 3.5 * k) !== null)) rippleAdd(p.x, p.z, 3.2 * k, -0.06 * k, 0.12);
  bendBlast(p.x, p.z, 8 * k, 9); // l'onde de choc couche les plantes (02n-flore.js)
  const gy = groundHeight(p.x, p.z, p.y + 0.5), dust = CURMAP.def.atmo.impact, snow = !!CURMAP.def.atmo.snow, low = Math.max(0, p.y - gy) < 1.2;
  // 1. éclair
  FX.flash.spawn(p.x, p.y + 0.4, p.z, 0, 0, 0, 0.08, 3 * k, 6 * k, 6, 4.5, 2.4, 1, 0);
  FX.flash.spawn(p.x, p.y + 0.5, p.z, 0, 0, 0, 0.24, 2 * k, 6 * k, 6, 3, 1.2, 0.9, 0);
  // 2. boule de feu : lueurs qui gonflent, montent (flottabilité) et rougissent
  for (let i = 0; i < 34; i++) {
    const a = rand(0, TAU), c = rand(-0.4, 1), sp = rand(1.5, 7) * k, h = Math.sqrt(1 - c * c);
    FX.add.spawn(p.x, p.y + 0.5, p.z, Math.cos(a) * h * sp, c * sp + 1.2, Math.sin(a) * h * sp, rand(0.25, 0.65), rand(0.9, 1.5) * k, rand(2.2, 3.8) * k, 1.7, rand(0.5, 0.95), 0.14, 0.5, 0, -2.5, 3.2, rand(-2, 2));
  }
  for (let i = 0; i < 6; i++) FX.add.spawn(p.x + rand(-0.3, 0.3), p.y + 0.5 + rand(0, 0.5), p.z + rand(-0.3, 0.3), rand(-1, 1), rand(0.5, 2), rand(-1, 1), rand(0.12, 0.22), 1.2 * k, 2.4 * k, 2.4, 1.6, 0.6, 0.6, 0, 0, 2);
  // 3. étincelles (rapides, retombent) et braises (lentes, vacillent en tombant)
  for (let i = 0; i < 46; i++) FX.add.spawn(p.x, p.y + 0.3, p.z, rand(-18, 18) * k, rand(2, 16), rand(-18, 18) * k, rand(0.4, 1.1), 0.045, 0.015, 4, 2, 0.6, 1, 0.4, 17, 0.35);
  for (let i = 0; i < 18; i++) FX.add.spawn(p.x, p.y + 0.4, p.z, rand(-6, 6) * k, rand(3, 9), rand(-6, 6) * k, rand(1.4, 2.8), 0.07, 0.02, 3.2, 1.2, 0.3, 1, 0, 3.5, 0.9);
  // 4. anneau de poussière à ras du sol et onde de choc
  if (low) {
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + rand(-0.1, 0.1), sp = rand(7, 12) * k; FX.smoke.spawn(p.x, gy + 0.15, p.z, Math.cos(a) * sp, rand(0.3, 1.4), Math.sin(a) * sp, rand(0.9, 1.6), 0.5 * k, rand(1.8, 2.8) * k, dust[0] * 1.1, dust[1] * 1.1, dust[2] * 1.1, 0.55, 0, 0.3, 3.4, rand(-1, 1)); }
    shockRing(p, 9 * k, 0.32);
  }
  // 5. débris : mottes de sol et éclats qui retombent en tournoyant
  const dc = snow ? [0.9, 0.93, 0.97] : [dust[0] * 0.55, dust[1] * 0.55, dust[2] * 0.55];
  for (let i = 0; i < 22; i++) FX.smoke.spawn(p.x + rand(-0.4, 0.4), p.y + 0.2, p.z + rand(-0.4, 0.4), rand(-9, 9) * k, rand(4, 13), rand(-9, 9) * k, rand(0.8, 1.7), rand(0.08, 0.16), 0.05, dc[0], dc[1], dc[2], 1, 0.9, 19, 0.3, rand(-6, 6));
  // 6. colonne de fumée noire qui monte, puis nuage gris qui s'étale
  for (let i = 0; i < 14; i++) FX.smoke.spawn(p.x + rand(-0.8, 0.8) * k, p.y + rand(0, 1.2), p.z + rand(-0.8, 0.8) * k, rand(-1.2, 1.2), rand(2, 5.5), rand(-1.2, 1.2), rand(2.6, 4.6), rand(1.0, 1.6) * k, rand(3.4, 5.2) * k, 0.13, 0.12, 0.11, 0.78, 0, -1.2, 0.9, rand(-0.5, 0.5));
  for (let i = 0; i < 10; i++) { const a = rand(0, TAU); FX.smoke.spawn(p.x, p.y + rand(1, 2.5), p.z, Math.cos(a) * rand(1.5, 4), rand(1.5, 3.5), Math.sin(a) * rand(1.5, 4), rand(3.2, 5.2), rand(1.2, 2) * k, rand(4.5, 7) * k, 0.34, 0.32, 0.3, 0.5, 0, -0.5, 1.1, rand(-0.4, 0.4)); }
  for (let i = 0; i < 12; i++) FX.smoke.spawn(p.x + rand(-1, 1), p.y + rand(0, 1), p.z + rand(-1, 1), rand(-3, 3), rand(1, 5), rand(-3, 3), rand(2, 4), rand(1.2, 2), rand(4, 7), 0.18, 0.16, 0.14, 0.75, 0, -0.3, 1.2, rand(-0.5, 0.5));
  // 7. tache de brûlé (grande, puis une petite décentrée) et lumière : coup blanc très bref, puis braise qui s'éteint
  if (low && !replay) { const sp = new V3(p.x, gy + 0.01, p.z); FX.scorch.add(sp, new V3(0, 1, 0), 1.15 * k); FX.scorch.add(new V3(p.x + rand(-0.8, 0.8), gy + 0.012, p.z + rand(-0.8, 0.8)), new V3(0, 1, 0), 0.6 * k); }
  flashLight(new V3(p.x, p.y + 1, p.z), 24 * k, 28, 0.12, 0xffe6b0);
  flashLight(new V3(p.x, p.y + 1.3, p.z), 11 * k, 20, 0.8, 0xff7a2a);
}
