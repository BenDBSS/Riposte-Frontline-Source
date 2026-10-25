/* Cuisson des clips d'animation (pack Mixamo dans /anim-source/, hors du dépôt) en données compactes pour le jeu.
   node tools/dev/anim/cuire.mjs  ->  assets/anim/clips.bin (Int16) et assets/anim/clips.json (index), intégrés à la page par build.py
   (src/06ab-anim.js les lit). Rejouable à volonté, et à refaire si les mensurations SD du soldat changent (l'échelle en dépend, lib.mjs).
   Déplacement retiré, boucles raccordées, phases alignées : lib.mjs, bakeClip. Une image : 31 valeurs Int16 (ordre et échelles : LAYOUT). */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, REPO, FPS, bakeClip, manifest } from './lib.mjs';

const STRIDE = 31, QP = 1e4, QQ = 32767;
const LAYOUT = 'bassin xyz (/1e4 m), bassin qxyzw (/32767), buste qxyzw, tête qxyzw, cheville gauche xyz (/1e4), cheville droite xyz, inclinaison g d (/1e4 rad), lacet g d (/1e4 rad), genou gauche xyz (/1e4, repère du bassin), genou droit xyz';
const out = [], index = [];
let total = 0;
for (const c of manifest().clips) {
  const b = await bakeClip(c), { N, Q } = b;
  const a = new Int16Array(N * STRIDE), r = (x, s) => Math.max(-32767, Math.min(32767, Math.round(x * s)));
  Q.forEach((q, i) => a.set([q.pel.x, q.pel.y, q.pel.z].map((x) => r(x, QP))
    .concat([q.qP, q.qT, q.qH].flatMap((z) => [z.x, z.y, z.z, z.w].map((x) => r(x, QQ))))
    .concat([...q.feet[0].toArray(), ...q.feet[1].toArray()].map((x) => r(x, QP)))
    .concat([q.pitch[0], q.pitch[1], q.yaw[0], q.yaw[1]].map((x) => r(x, QP)))
    .concat([...q.knee[0].toArray(), ...q.knee[1].toArray()].map((x) => r(x, QP))), i * STRIDE));
  const hy = Q.map((q) => q.head.y);
  // lacet moyen du buste (rad, positif vers la gauche) : le jeu remplace par le sien (profil de visée) celui que le clip tient
  const tf = Q.reduce((s, q) => s.add(new THREE.Vector3(0, 0, -1).applyQuaternion(q.qT)), new THREE.Vector3()), ty = Math.atan2(-tf.x, -tf.z);
  index.push({ id: b.id, n: N, o: total, loop: b.loop, dur: +b.dur.toFixed(4), v: +b.spd.toFixed(3), dir: b.dir, cyc: +(b.spd * b.dur).toFixed(3), k: +b.k.toFixed(4),
    ph: b.ph, ty: +ty.toFixed(4), head: [+Math.min(...hy).toFixed(3), +Math.max(...hy).toFixed(3)] });
  out.push(a); total += N;
  const md = c.direction_deg, bad = md !== null && md !== undefined && b.dir !== null && Math.abs(((b.dir - md + 540) % 360) - 180) > 5;
  console.log(b.id.padEnd(36), String(N).padStart(4), 'images', b.loop ? 'boucle  ' : 'une fois', 'v', b.spd.toFixed(2), 'dir', String(b.dir).padStart(4), bad ? `(manifeste ${md} !)` : '',
    'phase', String(b.ph).padStart(2), 'raccord', b.seam.toFixed(1) + '°', 'tête', Math.min(...hy).toFixed(2) + '-' + Math.max(...hy).toFixed(2));
}
const bin = new Int16Array(total * STRIDE); let o = 0; for (const a of out) { bin.set(a, o); o += a.length; }
const dir = path.join(REPO, 'assets/anim'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'clips.bin'), Buffer.from(bin.buffer));
fs.writeFileSync(path.join(dir, 'clips.json'), JSON.stringify({ fps: FPS, stride: STRIDE, layout: LAYOUT, clips: index }, null, 1) + '\n');
console.log(`${index.length} clips, ${total} images, ${(bin.byteLength / 1024).toFixed(1)} Ko`);
