import * as THREE from 'three';
import { readFileSync } from 'node:fs';
globalThis.self = globalThis;
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { SceneKit } = await import('./kit.js');
const buf = readFileSync(process.argv[2]); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
const kit = new SceneKit(new THREE.Scene(), { library: JSON.parse(readFileSync('./materials.json', 'utf8')), character: gltf });
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log(c ? 'PASS' : 'FAIL', m); };
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
const maxStep = (name, T) => { const a = kit.actors.find((x) => x.g.parent?.name === name); let prev = null, m = 0;
  for (let t = 0; t <= T; t += 1 / 24) { kit.animate(t); const y = a.g.rotation.y; if (prev !== null) m = Math.max(m, Math.abs(wrap(y - prev))); prev = y; } return { m, a }; };
kit.actor('CHAR_sq', { pos: [0, 0, 0], action: 'walk', path: [[0, 0], [4, 0], [4, 4], [0, 4]] });               // two 90° corners, natural pace
const sq = maxStep('CHAR_sq', 10); console.log('square path: max heading change per frame', sq.m.toFixed(3), 'rad');
ok(sq.m < 0.25, 'turns at corners are eased (no snap between frames)');
kit.actor('CHAR_loop', { pos: [10, 0, 0], action: 'walk', path: [[10, 0], [13, 0], [13, 3], [10, 3], [10, 0]], speed: 0.2 });   // slow closed loop
const lp = maxStep('CHAR_loop', 30); console.log('slow loop: max heading change per frame', lp.m.toFixed(3));
ok(lp.m < 0.25, 'looping walker turns smoothly, also across the loop seam');
kit.actor('CHAR_push', { pos: [20, 0, 0], action: 'push', path: [[20, 0], [30, 0]], speed: 1.3 });
const pu = kit.actors.find((x) => x.g.parent?.name === 'CHAR_push'); console.log('pusher speed', pu.speed.toFixed(2), 'rate', pu.rate.toFixed(2));
ok(pu.rate <= 1.25 + 1e-9 && Math.abs(pu.speed - 1.0) < 1e-6, 'a pusher asked for 1.3 m/s pushes at 1.0 m/s, clip ≤ 1.25×');
kit.actor('CHAR_norm', { pos: [0, 0, 20], action: 'walk', path: [[0, 20], [8, 20]] }); const n = kit.actors.find((x) => x.g.parent?.name === 'CHAR_norm');
kit.animate(2); ok(Math.abs(n.g.position.x - 2.6) < 1e-6 && n.rate === 1, 'natural walk unchanged'); kit.animate(3); ok(Math.abs(n.g.rotation.y - Math.PI / 2) < 1e-6, 'straight path faces straight');
kit.actor('CHAR_ring', { pos: [0, 0, 40], action: 'walk', path: [[0, 40], [4, 40], [4, 44], [0, 44], [0, 40]] });   // closed, natural pace
const ri = kit.actors.find((x) => x.g.parent?.name === 'CHAR_ring'), lap = ri.total / ri.speed; let still = 0, prevP = null;
for (let t = lap - 1; t <= 3 * lap; t += 0.5) { kit.animate(t); const q = ri.g.position.clone(); if (prevP && q.distanceTo(prevP) < 0.05) still++; prevP = q; }
ok(still === 0, `a closed path at natural pace keeps walking round (lap ${lap.toFixed(1)} s, 3 laps)`);
const sq2 = kit.actors.find((x) => x.g.parent?.name === 'CHAR_sq'); kit.animate(30); const e = sq2.g.position.clone(); kit.animate(31);
ok(e.distanceTo(sq2.g.position) < 1e-6 && Math.abs(e.x) < 1e-6 && Math.abs(e.z - 4) < 1e-6, 'an open path at natural pace ends standing at its last point');
process.exit(fails.length ? 1 : 0);
