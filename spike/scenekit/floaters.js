// floaters.js — finds parts of the set that hang in mid-air: not on the ground and not touching anything that is
// (directly or through other parts: a cup on a plate on a table, a lamp on a chain on a beam, a picture on a wall).
// Typical cause is a builder slip such as a missing .at(): the tavern's table things placed at the room origin (10-29)
// floated in the aisle at table height, and the render showed mugs and a candle hanging in mid-air.
// Works on the per-part boxes the kit records at commit (userData.parts); imported models count as one part.
// Only props and machines (PRP_/MACH_) are checked: the environment (ENV_: rooms, terrain, buildings, distant
// backdrops) counts as held as a whole — backdrops float or sink by design (a sky wall from -11 m, roofs beyond a
// window lower than the floor) and would otherwise move the ground level.
// Box contact is generous on purpose (rotated parts have loose boxes): it can miss a near-miss, but it must not
// flag a scene that is fine, because a flagged part goes back to the builder. Pure three.js: runs under node too.
import * as THREE from 'three';

const SKIP = /^(LGT|CAM)_/;        // lights and cameras are meant to hang
const CHECKED = /^(PRP|MACH)_/;    // people (CHAR_) and imported models hold things (an umbrella in a hand) but are not checked
const SEEN = 0.1;                  // a floating part closer than this to something held is a near miss nobody sees (m)
// things that float on purpose (or are volumes / backdrops)
const AIRBORNE = /(cloud|sky|bird|smoke|haze|fog|mist|steam|vapou?r|rain|snow|dust|ember|spark|beam|god_?ray|glow|sun|moon|star|firefl|bubble|halo|flare|backdrop|horizon|plane_flying|aircraft|drone|balloon|kite|banner_string|bunting)/i;
const REACH = 0.4;                // a book in a reader's hands, an umbrella over a passer-by (m)
const TOUCH = 0.03;                // boxes closer than this touch (m)

/**
 * @param {THREE.Object3D} root  the kit root (committed objects are its direct children)
 * @returns {{name: string, parts: number, height: number, at: number[]}[]}  objects with floating parts; height = gap
 *   between the floating parts and the highest thing under them, at = x,z of their centre
 */
export function floaters(root) {
  root.updateMatrixWorld(true);
  const P = [];   // { name, b: Box3 (world) }
  const box = new THREE.Box3();
  for (const o of root.children) {
    if (!/^[A-Z]+_/.test(o.name) || SKIP.test(o.name) || AIRBORNE.test(o.name) || o.userData.kind === 'light' || o.userData.kind === 'camera') continue;
    const parts = o.userData.parts;
    if (Array.isArray(parts) && parts.length) {
      for (const p of parts) P.push({ name: o.name, own: true, b: box.set(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(p[3], p[4], p[5])).clone().applyMatrix4(o.matrixWorld) });
    } else {
      const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) continue;
      // a person's box is the rest pose (not sitting, arms down): what they hold is within arm's reach of it
      if (o.name.startsWith('CHAR_')) b.expandByVector(new THREE.Vector3(REACH, 0, REACH));
      P.push({ name: o.name, b });
    }
  }
  if (!P.some((p) => CHECKED.test(p.name))) return [];
  const floor = 0;   // the kit's ground level
  // Contact graph by a sweep along x (parts sorted by min x), then flood from everything standing on the lowest level.
  const order = P.map((_, i) => i).sort((i, j) => P[i].b.min.x - P[j].b.min.x);
  const nb = P.map(() => []);
  for (let a = 0; a < order.length; a++) {
    const A = P[order[a]].b;
    for (let c = a + 1; c < order.length && P[order[c]].b.min.x <= A.max.x + TOUCH; c++) {
      const B = P[order[c]].b;
      if (B.min.y <= A.max.y + TOUCH && A.min.y <= B.max.y + TOUCH && B.min.z <= A.max.z + TOUCH && A.min.z <= B.max.z + TOUCH) {
        nb[order[a]].push(order[c]); nb[order[c]].push(order[a]);
      }
    }
  }
  const held = new Uint8Array(P.length); const queue = [];
  P.forEach((p, i) => { if (!CHECKED.test(p.name) || !p.own || p.b.min.y <= floor + TOUCH) { held[i] = 1; queue.push(i); } });
  while (queue.length) for (const j of nb[queue.pop()]) if (!held[j]) { held[j] = 1; queue.push(j); }
  const gap = (A, B) => Math.hypot(Math.max(0, A.min.x - B.max.x, B.min.x - A.max.x), Math.max(0, A.min.y - B.max.y, B.min.y - A.max.y), Math.max(0, A.min.z - B.max.z, B.min.z - A.max.z));
  const heldIdx = P.map((_, i) => i).filter((i) => held[i]);
  const byName = new Map();
  P.forEach((p, i) => {
    if (held[i]) return;
    // tucked under a held part of the same object (a stretcher bar under a table top): hidden, not worth a rebuild
    if (heldIdx.some((j) => P[j].name === p.name && P[j].b.min.y >= p.b.max.y && P[j].b.min.x <= p.b.min.x && p.b.max.x <= P[j].b.max.x && P[j].b.min.z <= p.b.min.z && p.b.max.z <= P[j].b.max.z)) return;
    if (heldIdx.some((j) => gap(p.b, P[j].b) < SEEN)) return;
    (byName.get(p.name) ?? byName.set(p.name, []).get(p.name)).push(p.b);
  });
  return [...byName].map(([name, bs]) => {
    const u = bs.reduce((s, b) => s.union(b), new THREE.Box3()); const c = u.getCenter(new THREE.Vector3());
    // highest held thing under the floating parts' footprint (the floor, a bench seat …)
    let under = floor;
    P.forEach((p, i) => { if (held[i] && p.b.max.y <= u.min.y && p.b.min.x <= u.max.x && u.min.x <= p.b.max.x && p.b.min.z <= u.max.z && u.min.z <= p.b.max.z) under = Math.max(under, p.b.max.y); });
    return { name, parts: bs.length, height: +(u.min.y - under).toFixed(2), at: [+c.x.toFixed(2), +c.z.toFixed(2)] };
  });
}
