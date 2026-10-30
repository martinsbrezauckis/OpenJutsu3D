import * as THREE from 'three';
import { readFileSync } from 'node:fs';
globalThis.self = globalThis;
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { SceneKit } = await import('./kit.js');
const buf = readFileSync(process.argv[2]); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
const kit = new SceneKit(new THREE.Scene(), { library: JSON.parse(readFileSync('./materials.json', 'utf8')), character: gltf });
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log(c ? 'PASS' : 'FAIL', m); };
kit.actor('CHAR_astro', { pos: [0, 0, 0], action: 'walk', path: [[0, 0], [4, 0], [4, 4]] });
kit.actor('CHAR_plain', { pos: [3, 0, 3], action: 'idle' });
kit.dress('CHAR_astro', { top: '#e8dcc4', bottom: '#3050a0', shoes: '#202020', gloves: '#e07a2a', head: '#ffffff' });
let m = null; kit.root.getObjectByName('CHAR_astro').traverse((o) => { if (o.isSkinnedMesh) m = o; });
const col = m.geometry.attributes.color; ok(!!col && m.material.vertexColors, 'dressed figure has vertex colours');
const hex = new Set(); for (let i = 0; i < col.count; i++) hex.add(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
console.log('colours', [...hex]); ok(hex.size >= 5, 'five regions coloured');
let p = null; kit.root.getObjectByName('CHAR_plain').traverse((o) => { if (o.isSkinnedMesh) p = o; });
ok(!p.geometry.attributes.color && p.geometry !== m.geometry, 'other figure untouched (own geometry)');
// per-region check: vertices driven mostly by a foot bone are shoe colour
const bones = m.skeleton.bones, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; let footV = -1, handV = -1;
for (let i = 0; i < col.count && (footV < 0 || handV < 0); i++) { let b = 0, w = -1; for (let j = 0; j < 4; j++) if (sw.getComponent(i, j) > w) { w = sw.getComponent(i, j); b = si.getComponent(i, j); }
  const n = bones[b].name; if (footV < 0 && /foot/i.test(n)) footV = i; if (handV < 0 && /handL$/i.test(n)) handV = i; }
ok(new THREE.Color(col.getX(footV), col.getY(footV), col.getZ(footV)).getHexString() === new THREE.Color('#202020').getHexString(), 'foot vertices = shoes colour');
console.log('hand vertex', handV, bones.map(b=>b.name).filter(n=>/hand/i.test(n)));
ok(new THREE.Color(col.getX(handV), col.getY(handV), col.getZ(handV)).getHexString() === new THREE.Color('#e07a2a').getHexString(), 'hand vertices = gloves colour');
// helmet on the head bone follows the head while walking
kit.object('PRP_helmet').add(kit.sphere(0.16), 'metal').at(0, 1.62, 0).commit();
kit.object('PRP_pack').add(kit.box(0.3, 0.4, 0.15), 'plastic').at(0, 1.25, -0.15).commit();
kit.wear('CHAR_astro', 'PRP_helmet', { bone: 'head' }); kit.wear('CHAR_astro', 'PRP_pack', { bone: 'chest' });
const helm = kit.root.getObjectByName('PRP_helmet'); ok(helm.parent.isBone && /head/i.test(helm.parent.name), 'helmet rides the head bone');
const head = helm.parent, hw = new THREE.Vector3(), bw = new THREE.Vector3(), d = [];
for (const t of [0, 0.7, 1.9, 3.5]) { kit.animate(t); kit.root.updateMatrixWorld(true); helm.getWorldPosition(hw); head.getWorldPosition(bw); d.push(+hw.distanceTo(bw).toFixed(3)); }
console.log('helmet-head distances', d); ok(Math.max(...d) - Math.min(...d) < 0.01, 'helmet keeps its place on the head through the walk');
kit.animate(3.5); kit.root.updateMatrixWorld(true); helm.getWorldPosition(hw); console.log('helmet at t=3.5', hw.toArray().map(v => v.toFixed(2)));
ok(hw.x > 2, 'helmet travelled with the figure');

// kneeling figure: a helmet built at STANDING head height must end up on the posed head
for (const action of ['kneel_fix', 'push', 'crouch']) {
  const nm = 'CHAR_k_' + action; kit.actor(nm, { pos: [10, 0, 0], action, path: action === 'push' ? [[10, 0], [12, 0]] : null });
  kit.object('PRP_h_' + action).add(kit.sphere(0.15), 'metal').at(10, 1.60, 0).commit();
  kit.wear(nm, 'PRP_h_' + action, { bone: 'head' });
  const h = kit.root.getObjectByName('PRP_h_' + action), hb = h.parent, a1 = new THREE.Vector3(), b1 = new THREE.Vector3();
  kit.root.updateMatrixWorld(true); h.getWorldPosition(a1); hb.getWorldPosition(b1);
  const dist = a1.distanceTo(b1); console.log(action, 'helmet-to-head-bone', dist.toFixed(3), 'helmet y', a1.y.toFixed(2));
  ok(dist < 0.2, action + ': helmet sits on the posed head');
  kit.remove(nm);
}
try { kit.dress('PRP_pack', {}); ok(false, 'dress on a prop must throw'); } catch (e) { ok(/not an animated figure/.test(e.message), 'dress on a prop throws a clear error'); }
try { kit.wear('CHAR_astro', 'PRP_x', { bone: 'tail' }); ok(false, 'bad bone must throw'); } catch (e) { ok(/unknown bone/.test(e.message), 'unknown bone throws a clear error'); }
process.exit(fails.length ? 1 : 0);
