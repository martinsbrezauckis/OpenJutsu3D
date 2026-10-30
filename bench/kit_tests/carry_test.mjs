import * as THREE from 'three';
import { readFileSync } from 'node:fs';
globalThis.self = globalThis;
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { SceneKit } = await import('./kit.js');
const buf = readFileSync(process.argv[2]); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
const kit = new SceneKit(new THREE.Scene(), { library: JSON.parse(readFileSync('./materials.json', 'utf8')), character: gltf });
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log(c ? 'PASS' : 'FAIL', m); };
const W = (o) => o.getWorldPosition(new THREE.Vector3());
const actorOf = (n) => kit.actors.find((x) => x.g.parent?.name === n || x.g.name === n);
// --- slow path: back and forth at natural pace, never stops mid-shot
kit.actor('CHAR_slow', { pos: [0, 0, 0], action: 'walk', path: [[0, 0], [6, 0]], speed: 0.2 });
const s = actorOf('CHAR_slow'); const st = s.stroll;
ok(st && !st.loop && Math.abs(s.rate - 0.85) < 1e-6, 'slow open path → back-and-forth at natural rate');
const xs = []; for (let t = 0; t <= 30; t += 0.5) { kit.animate(t); xs.push(s.g.position.x); }
let still = 0, maxStill = 0; for (let i = 1; i < xs.length; i++) { if (Math.abs(xs[i] - xs[i - 1]) < 1e-6) { still += 0.5; maxStill = Math.max(maxStill, still); } else still = 0; }
console.log('longest standing stretch (s)', maxStill, 'x range', Math.min(...xs).toFixed(2), Math.max(...xs).toFixed(2));
ok(maxStill <= 1.0, 'never stands longer than a turn (≤ 1 s)');
ok(Math.min(...xs) >= -1e-6 && Math.max(...xs) <= 6 + 1e-6, 'stays on its path');
kit.animate(st.leg + st.turn * 0.5); const midTurn = s.g.rotation.y; kit.animate(st.leg + st.turn + 0.1); const backDir = s.g.rotation.y;
ok(Math.abs(Math.sin(backDir) + 1) < 0.05 || Math.abs(Math.sin(backDir - Math.PI) - 0) < 1 , 'faces back after the turn'); console.log('mid-turn', midTurn.toFixed(2), 'after', backDir.toFixed(2));
kit.actor('CHAR_loop', { pos: [0, 0, 8], action: 'walk', path: [[0, 8], [3, 8], [3, 11], [0, 11], [0, 8]], speed: 0.2 });
const l = actorOf('CHAR_loop'); ok(l.stroll?.loop, 'slow closed path → loops');
kit.actor('CHAR_norm', { pos: [0, 0, 5], action: 'walk', path: [[0, 5], [8, 5]] }); const n = actorOf('CHAR_norm');
kit.animate(2); ok(!n.stroll && Math.abs(n.g.position.x - 2.6) < 1e-6, 'natural walk unchanged'); kit.animate(20); ok(Math.abs(n.g.position.x - 8) < 1e-6 && n.idle.weight === 1, 'natural walk still ends idle at the path end');
// --- carry both: the crate stays between the hands while walking
kit.actor('CHAR_crate', { pos: [20, 0, 0], action: 'walk', path: [[20, 0], [26, 0]] });
kit.object('PRP_crate').add(kit.box(0.5, 0.3, 0.35), 'wood').at(20, 1.0, 0.5).commit();
kit.carry('CHAR_crate', 'PRP_crate', { hands: 'both' });
const crate = kit.root.getObjectByName('PRP_crate'), cA = actorOf('CHAR_crate');
const hl = kit._bone(cA, 'hand_l'), hr = kit._bone(cA, 'hand_r'); const dl = [], dr = [], cy = [];
for (const t of [0, 0.4, 1.1, 2.3, 3.7]) { kit.animate(t); kit.root.updateMatrixWorld(true); const c = new THREE.Box3().setFromObject(crate).getCenter(new THREE.Vector3());
  dl.push(W(hl).distanceTo(c)); dr.push(W(hr).distanceTo(c)); cy.push(c.y); }
console.log('hand-to-crate L', dl.map((x) => x.toFixed(3)).join(' '), ' R', dr.map((x) => x.toFixed(3)).join(' '), ' crate y', cy.map((x) => x.toFixed(2)).join(' '));
ok(Math.max(...dl) - Math.min(...dl) < 0.03 && Math.max(...dr) - Math.min(...dr) < 0.03, 'both hands stay on the crate through the walk');
ok(Math.min(...cy) > 0.6 && Math.max(...cy) < 1.6, 'crate held at a carrying height');
kit.animate(2); kit.root.updateMatrixWorld(true); ok(new THREE.Box3().setFromObject(crate).getCenter(new THREE.Vector3()).x > 21, 'crate travels with the figure');
// --- carry right: the can hangs from the right hand and follows it
kit.actor('CHAR_can', { pos: [30, 0, 0], action: 'walk', path: [[30, 0], [36, 0]] });
kit.object('PRP_can').add(kit.cylinder(0.12, 0.12, 0.3), 'metal').at(30.3, 0.7, 0).commit();
kit.carry('CHAR_can', 'PRP_can', { hands: 'right' });
const can = kit.root.getObjectByName('PRP_can'), hrC = kit._bone(actorOf('CHAR_can'), 'hand_r'); const dc = [];
for (const t of [0, 0.5, 1.2, 2.6]) { kit.animate(t); kit.root.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(can); dc.push(W(hrC).distanceTo(new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2))); }
console.log('hand-to-can-top', dc.map((x) => x.toFixed(3)).join(' '));
ok(Math.max(...dc) < 0.2, 'can top stays in the right hand as the arm swings');
// --- a prop already WORN on the body can be carried instead (a chat change of how it is held)
kit.actor('CHAR_re', { pos: [40, 0, 0], action: 'walk', path: [[40, 0], [46, 0]] });
kit.object('PRP_re').add(kit.box(0.5, 0.3, 0.35), 'wood').at(40, 1.0, 0.5).commit();
kit.wear('CHAR_re', 'PRP_re'); kit.carry('CHAR_re', 'PRP_re', { hands: 'both' });
const re = kit.root.getObjectByName('PRP_re'); ok(re.parent.isBone && /spine/i.test(re.parent.name), 'a worn prop can be carried instead');
kit.wear('CHAR_re', 'PRP_re', { bone: 'chest' }); ok(kit.root.getObjectByName('PRP_re').parent.isBone, 'and worn again');
// --- re-creating a figure (new path, as a chat change does) keeps its helmet and the crate in its hands
kit.actor('CHAR_rc', { pos: [50, 0, 0], action: 'walk', path: [[50, 0], [56, 0]] });
kit.object('PRP_rc_helmet').add(kit.sphere(0.15), 'metal').at(50, 1.60, 0).commit(); kit.wear('CHAR_rc', 'PRP_rc_helmet', { bone: 'head' });
kit.object('PRP_rc_crate').add(kit.box(0.5, 0.3, 0.35), 'wood').at(50, 1.0, 0.5).commit(); kit.carry('CHAR_rc', 'PRP_rc_crate', { hands: 'both' });
const before = kit.root.getObjectByName('PRP_rc_helmet').position.clone();
kit.actor('CHAR_rc', { pos: [60, 0, 3], action: 'walk', path: [[60, 3], [60, 9]], speed: 0.2 });   // re-created elsewhere, slow
const rcA = actorOf('CHAR_rc'), helm2 = kit.root.getObjectByName('PRP_rc_helmet'), crate2 = kit.root.getObjectByName('PRP_rc_crate');
ok(!!helm2 && helm2.parent.isBone && /head/i.test(helm2.parent.name) && helm2.position.distanceTo(before) < 1e-6, 're-created figure keeps its helmet on the head bone');
ok(!!crate2 && crate2.parent.isBone && !!rcA.hold, 're-created figure still holds the crate (arms holding)');
kit.animate(1.5); kit.root.updateMatrixWorld(true);
const cc = new THREE.Box3().setFromObject(crate2).getCenter(new THREE.Vector3());
ok(W(kit._bone(rcA, 'hand_l')).distanceTo(cc) < 0.25 && cc.z > 3, 'crate between the hands on the new path');
kit.wear('CHAR_rc', 'PRP_rc_helmet', { bone: 'head' }); ok(helm2.position.distanceTo(before) < 1e-6, 'wearing it again changes nothing');
kit.remove('CHAR_rc'); let gone = true; try { kit.object('PRP_probe').add(kit.box(1,1,1),'wood').at(0,0,0).commit(); kit.wear('CHAR_slow', 'PRP_rc_helmet'); gone = false; } catch { }
ok(gone && !kit.root.getObjectByName('PRP_rc_helmet'), 'removing a figure removes what it wore');
try { kit.carry('CHAR_can', 'PRP_nothing'); ok(false, 'missing prop must throw'); } catch (e) { ok(/no free object/.test(e.message), 'missing prop: clear error'); }
process.exit(fails.length ? 1 : 0);
