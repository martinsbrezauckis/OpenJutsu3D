/**
 * kit.js — Scene Kit v0 (P1 spike).
 *
 * Role: the ONLY API an LLM scene builder writes against. Scene code calls kit.* to create grey-box
 * ("blocking") geometry, semantic materials, lights, mannequins and cameras. Every finished object is
 * handed to `onCommit` immediately, so the viewport can show the set being built live.
 *
 * Depends on: three (ES module, importmap-provided), BufferGeometryUtils (merge per material).
 * Callers: viewer.html (spike). Later: a sandboxed Web Worker runner (P3) — in the spike, scene code
 * runs via `new Function` in the page, which is NOT a sandbox; only run code you have read or that
 * came from your own builder run.
 *
 * Conventions:
 *   object names are PREFIX_name with PREFIX in ENV|PRP|MACH|CHAR|LGT|CAM; units are metres, +Y up,
 *   the camera's default forward is -Z. Materials are semantic labels (MAT_<label>) — the label text
 *   later feeds the render prompt, colours are only viewport hints.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const DEG = Math.PI / 180;
const PREFIXES = ['ENV', 'PRP', 'MACH', 'CHAR', 'LGT', 'CAM'];

/**
 * A positioned primitive geometry. Transform helpers mutate and return `this` so calls chain:
 *   kit.box(1, 2, 1).at(0, 1, 0).rot(0, 45, 0)
 */
class Part {
  constructor(geometry) { this.geometry = geometry; this.m = new THREE.Matrix4(); }
  /** Translate by (x, y, z) metres (applied after previous transforms). */
  at(x = 0, y = 0, z = 0) { this.m.premultiply(new THREE.Matrix4().makeTranslation(x, y, z)); return this; }
  /**
   * Rotate IN PLACE by Euler degrees (XYZ order, world axes) around the part's CURRENT position, so
   * `.at(x,y,z).rot(…)` and `.rot(…).at(x,y,z)` give the same result. (Until 2026-10-18 rotation pivoted on the
   * world origin: a part placed at x=78 then rotated swung across the map — the medieval city's flying roofs.)
   */
  rot(x = 0, y = 0, z = 0) {
    this.m.premultiply(this._aboutCurrent(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG))));
    return this;
  }
  /** Scale uniformly (number) or per axis ([x, y, z]) IN PLACE around the part's current position. */
  scale(s) {
    const v = Array.isArray(s) ? s : [s, s, s];
    this.m.premultiply(this._aboutCurrent(new THREE.Matrix4().makeScale(v[0], v[1], v[2])));
    return this;
  }
  /** T(p) · M · T(−p) with p = the part's current translation: applies M around the part, not the world origin. */
  _aboutCurrent(M) {
    const p = new THREE.Vector3().setFromMatrixPosition(this.m);
    return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(M).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  }
  /** Return a transformed copy of the geometry (non-indexed; position, normal and box-projected uv). */
  baked() {
    let g = this.geometry.clone().applyMatrix4(this.m);
    if (g.index) g = g.toNonIndexed();
    // Merging requires identical attribute sets: keep position+normal, then replace any primitive UVs
    // with box-projected UVs in metres so textures tile at real-world size on every shape.
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    boxProjectUV(g);
    return g;
  }
}

/**
 * Box (tri-planar) UV projection in metres, per triangle: the face's dominant normal axis picks the
 * projection plane (X-facing faces use z/y, Y-facing use x/z, Z-facing use x/y). Seams appear only
 * where a surface turns ~45°, which reads fine on blocky previz geometry. Mutates `g` (non-indexed).
 */
function boxProjectUV(g) {
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    fn.subVectors(c, b).cross(b.clone().sub(a)); // face normal (orientation irrelevant, only magnitude per axis)
    const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c, o = (i + k) * 2;
      if (ax >= ay && ax >= az) { uv[o] = v.z; uv[o + 1] = v.y; }
      else if (ay >= az) { uv[o] = v.x; uv[o + 1] = v.z; }
      else { uv[o] = v.x; uv[o + 1] = v.y; }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * An object under construction: parts grouped by material label. On commit, parts with the same
 * material are merged into one mesh named `<object>_<label>` (one mesh per object and material).
 */
class Thing {
  constructor(kit, name) {
    this.kit = kit; this.name = name; this.byMat = new Map();
    this._at = new THREE.Matrix4(); this._local = new THREE.Matrix4();  // world placement × in-place rot/scale
  }
  /** Final object transform = placement (at) × in-place rotation/scale (rot/scale), independent of call order. */
  get place() { return this._at.clone().multiply(this._local); }
  /** Add one Part (or an array of Parts) with a semantic material label, e.g. 'iron'. */
  add(parts, material) {
    const label = this.kit._material(material);
    const list = Array.isArray(parts) ? parts : [parts];
    if (!this.byMat.has(label)) this.byMat.set(label, []);
    const preset = this.kit.resolved.get(label)?.preset;
    const surface = !!(preset && this.kit.library?.[preset]?.surface);
    for (const [i, p] of list.entries()) {
      if (!(p instanceof Part)) throw new Error(`${this.name}: add() expects kit parts, got ${typeof p}`);
      let g = p.baked();
      if (surface) {
        // Water drawn as a thin cylinder/box (a perfect ellipse) becomes an irregular flat puddle of the same
        // footprint: faithful image/video models keep a perfect ellipse as a "pancake".
        g.computeBoundingBox();
        const bb = g.boundingBox, size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
        if (size.y < 0.05 && size.x > 0.05 && size.z > 0.05) {
          let seed = 0; for (const ch of this.name) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
          g = this.kit.puddle(size.x, size.z, seed + i * 7.3).at(c.x, bb.min.y, c.z).baked();
        }
      }
      this.byMat.get(label).push(g);
    }
    return this;
  }
  /** Place the whole object in the world: position (m) and rotation about Y (degrees). */
  at(x = 0, y = 0, z = 0, rotYDeg = 0) {
    this._at = new THREE.Matrix4().makeRotationY(rotYDeg * DEG).setPosition(x, y, z);
    return this;
  }
  /** Rotate the whole object about its own origin (degrees, XYZ) — builders call this on objects as often as on parts
   *  (Qwen3.8-Flash-Next: 6 of 8 failed scenes, 10-18), so objects support it like Part.rot(). */
  rot(x = 0, y = 0, z = 0) {
    this._local.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG)));
    return this;
  }
  /** Scale the whole object about its own origin (s or [x, y, z]). */
  scale(s) {
    const v = Array.isArray(s) ? s : [s, s, s];
    this._local.premultiply(new THREE.Matrix4().makeScale(v[0], v[1], v[2]));
    return this;
  }
  /** Finish the object: build meshes, add to scene, notify the viewport. Returns the THREE.Group. */
  commit() { return this.kit._commitThing(this); }
}

// Mannequin motions (kit.actor action → clip of the CC0 character) and their natural travel speeds (m/s).
const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', walk_formal: 'Walk_Formal_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop',
  talk: 'Idle_Talking_Loop', sit: 'Sitting_Idle_Loop', sit_talk: 'Sitting_Talking_Loop', dance: 'Dance_Loop', crouch: 'Crouch_Idle_Loop',
  crouch_walk: 'Crouch_Fwd_Loop', push: 'Push_Loop', torch: 'Idle_Torch_Loop', kneel_fix: 'Fixing_Kneeling', swim: 'Swim_Fwd_Loop' };
const SPEED = { walk: 1.3, walk_formal: 1.2, jog: 3, sprint: 5.5, crouch_walk: 0.8, push: 0.8, swim: 1 };
// ---- animated imports (Mixamo and other rigged files) ----
/** Clips that actually move: FBX files carry an empty "Take 001" and a one-frame T-pose clip next to the motion. */
const moving = (clips = []) => clips.filter((c) => c.tracks.length && c.duration >= 0.1);
/** Bone name without the rig prefix: Mixamo characters differ ("mixamorig:Hips", "mixamorig1:Hips"; GLTFLoader drops ':'). */
const boneKey = (n) => String(n).replace(/^mixamorig\d*[:_]?/i, '').toLowerCase();
/**
 * A motion clip from another file (same kind of skeleton) made to drive `target`: tracks renamed to the target's bone
 * names by their prefix-free key, tracks of bones the target lacks dropped, and the root (hips) position scaled by the
 * ratio of the two skeletons' rest hip heights (files come in different units and body sizes: 175 vs 378 units).
 */
function retarget(clip, from, target) {
  const bones = new Map(); target.traverse((o) => { if (o.isBone) bones.set(boneKey(o.name), o); });
  const restY = (root) => { let y = null; root.traverse((o) => { if (y === null && /hips$/i.test(o.name)) y = Math.abs(o.position.y); }); return y; };
  const rFrom = restY(from), rTo = restY(target), k = rFrom && rTo ? rTo / rFrom : 1;
  const tracks = [];
  for (const tr of clip.tracks) {
    const p = THREE.PropertyBinding.parseTrackName(tr.name), b = bones.get(boneKey(p.nodeName));
    if (!b) continue;
    const c = tr.clone(); c.name = `${b.name}.${p.propertyName}`;
    if (p.propertyName === 'position') { if (!/hips$/i.test(b.name)) continue; c.values = c.values.map((v) => v * k); }
    tracks.push(c);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export class SceneKit {
  /**
   * @param {THREE.Scene} scene  target scene (objects are added under a 'Scene' group)
   * @param {object} [opts]
   * @param {(obj: THREE.Object3D, info: object) => void} [opts.onCommit]  called once per committed object
   * @param {object} [opts.library]   parsed materials.json (presets, aliases, _modifiers); omit = all grey
   * @param {object} [opts.textures]  { base: 'assets/textures/', manifest: {...}, loader: THREE.TextureLoader }
   */
  constructor(scene, opts = {}) {
    this.root = new THREE.Group(); this.root.name = 'Scene'; scene.add(this.root);
    this.onCommit = opts.onCommit || (() => {});
    this.library = opts.library || null;
    this.font = opts.font || null;   // three Font for text(); preloaded by the viewer
    this.props = {};                 // scene properties from settings() (applied by the viewer in lit mode)
    this.models = opts.models || new Map();   // asset id -> {scene, height} preloaded by the viewer (model())
    this.character = opts.character || null; // {scene, animations} rigged mannequin for actor() (CC0, assets/characters)
    this.actors = [];                         // animated people: posed by animate(t) from the shot time
    // mesh -> its own material for imported models. NOT in userData: clone() JSON-copies userData and the GLB exporter
    // writes it into extras, both of which would mangle a material object.
    this._lit = new WeakMap();
    this.textures = opts.textures || {};
    this.mode = 'lit';
    this.clay = new THREE.MeshStandardMaterial({ color: 0xb4b4b4, roughness: 0.9, metalness: 0, name: 'MAT_clay' });
    this._pointShadows = 0;       // count of point lights given shadow maps (capped in light())
    this._defined = new Map();    // label -> explicit params from define()
    this.resolved = new Map();    // label -> resolution report (metrics)
    this.materials = new Map();   // label -> THREE.Material
    this.names = new Set();
    this.cameras = [];
    this.meta = {};
    this.stats = { objects: 0, meshes: 0, triangles: 0, lights: 0, cameras: 0 };
  }

  // ---------- primitives (all return Part, metres, centred on origin unless noted) ----------
  box(w = 1, h = 1, d = 1) { return new Part(new THREE.BoxGeometry(w, h, d)); }
  /** Cylinder along Y, centred. rTop/rBottom radii, h height. */
  cylinder(rTop = 0.5, rBottom = 0.5, h = 1, segments = 24) { return new Part(new THREE.CylinderGeometry(rTop, rBottom, h, segments)); }
  cone(r = 0.5, h = 1, segments = 24) { return new Part(new THREE.ConeGeometry(r, h, segments)); }
  sphere(r = 0.5, segments = 24) { return new Part(new THREE.SphereGeometry(r, segments, Math.max(8, segments >> 1))); }
  /** Torus in the XY plane: ring radius r, tube radius t, optional arc in degrees (partial ring). */
  torus(r = 0.5, t = 0.1, arcDeg = 360, segments = 32) { return new Part(new THREE.TorusGeometry(r, t, 12, segments, arcDeg * DEG)); }
  /** Flat rectangle in the XY plane (facing +Z). */
  plane(w = 1, h = 1) { return new Part(new THREE.PlaneGeometry(w, h)); }
  /** Surface of revolution around Y from a profile of [radius, y] points (vases, columns, barrels). */
  lathe(profile, segments = 32, { open = false } = {}) {
    // Closed by default: a profile that does not start/end on the axis left both ends as open tubes, and their inside
    // rendered as black holes (tavern barrels 10-29). { open: true } keeps a cup or pipe open.
    const pts = profile.map(([r, y]) => [r, y]);
    if (!open && pts.length) {
      if (pts[0][0] > 1e-4) pts.unshift([0, pts[0][1]]);
      if (pts[pts.length - 1][0] > 1e-4) pts.push([0, pts[pts.length - 1][1]]);
    }
    return new Part(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments));
  }
  /** 2D outline [[x, y], ...] in XY extruded along +Z by depth; optional holes (array of outlines). */
  extrude(outline, depth = 0.1, holes = []) {
    // Forgiving input (10-18: GLM passed flat [x0, y0, x1, y1, …] lists and one hole instead of a list of holes):
    // flat number lists become [x, y] pairs; a single outline given as `holes` becomes [outline].
    const pts = (a) => typeof a[0] === 'number' ? Array.from({ length: a.length >> 1 }, (_, i) => [a[2 * i], a[2 * i + 1]]) : a;
    if (holes.length && (typeof holes[0] === 'number' || typeof holes[0][0] === 'number')) holes = [holes];
    const shape = new THREE.Shape(pts(outline).map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(pts(h).map(([x, y]) => new THREE.Vector2(x, y))));
    return new Part(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }));
  }
  /**
   * Real lettering (signs, neon, labels): text in XY facing +Z, baseline at y = 0, front face at z = depth.
   * align 'center' (default) | 'left' | 'right' on x = 0. Builders drew letters from tubes before (10-28): unreadable.
   */
  text(str, { size = 0.3, depth = 0.03, align = 'center' } = {}) {
    if (!this.font) throw new Error('kit.text: no font loaded');
    const g = new TextGeometry(String(str), { font: this.font, size, depth, curveSegments: 4, bevelEnabled: false });
    g.computeBoundingBox(); const b = g.boundingBox;
    g.translate(align === 'left' ? -b.min.x : align === 'right' ? -b.max.x : -(b.min.x + b.max.x) / 2, 0, 0);
    return new Part(g);
  }
  /** Round tube following a smooth path through [[x, y, z], ...] points (pipes, cables, chains' paths). */
  tube(points, radius = 0.05, segments = 64, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), closed);
    return new Part(new THREE.TubeGeometry(curve, segments, radius, 10, closed));
  }
  /** Repeat: calls fn(i) for i in [0, n) and returns the flat array of Parts it produced. */
  repeat(n, fn) { const out = []; for (let i = 0; i < n; i++) { const r = fn(i); if (r) out.push(...(Array.isArray(r) ? r : [r])); } return out; }

  // ---------- objects ----------
  /** Start a named object, e.g. kit.object('PRP_barrel_01'). Name must start with ENV_/PRP_/MACH_/CHAR_. */
  object(name) { this._checkName(name, ['ENV', 'PRP', 'MACH', 'CHAR']); return new Thing(this, name); }

  /**
   * Stand-in person (mannequin): jointed figure (head, neck, torso, pelvis, arms, legs, hands, feet), ~height metres
   * tall, facing -Z before rotY degrees. pose: 'stand' | 'walk' | 'sit' (on a ≈0.45 m seat at x, z) | 'wave'.
   * Proportions follow an adult figure so the video model reads it as a person, not a post. Returns the committed group.
   */
  person(name, { x = 0, z = 0, y = 0, rotY = 0, height = 1.75, pose = 'stand' } = {}) {
    const H = height, t = this.object(name), V = (a, b, c) => new THREE.Vector3(a * H, b * H, c * H);
    const hip = pose === 'sit' ? 0.3 : pose === 'walk' ? 0.52 : 0.53;   // sit: pelvis rests on a ≈0.45 m seat
    // Joint positions in units of height: [left, right] for limbs (person's right = +X when facing -Z).
    const J = {
      stand: { knee: [[-0.06, 0.28, 0], [0.06, 0.28, 0]], ankle: [[-0.065, 0.04, 0], [0.065, 0.04, 0]],
        elbow: [[-0.15, hip + 0.1, 0.01], [0.15, hip + 0.1, 0.01]], wrist: [[-0.16, hip - 0.06, -0.01], [0.16, hip - 0.06, -0.01]] },
      walk: { knee: [[-0.06, 0.28, -0.07], [0.06, 0.27, 0.04]], ankle: [[-0.065, 0.04, -0.13], [0.065, 0.07, 0.12]],
        elbow: [[-0.14, hip + 0.1, 0.06], [0.14, hip + 0.1, -0.06]], wrist: [[-0.15, hip - 0.05, 0.1], [0.15, hip - 0.04, -0.11]] },
      sit: { knee: [[-0.06, 0.28, -0.24], [0.06, 0.28, -0.24]], ankle: [[-0.065, 0.04, -0.26], [0.065, 0.04, -0.26]],
        elbow: [[-0.14, hip + 0.1, -0.04], [0.14, hip + 0.1, -0.04]], wrist: [[-0.12, hip + 0.03, -0.18], [0.12, hip + 0.03, -0.18]] },
    };
    const j = J[pose] || J.stand;
    if (pose === 'wave') { j.elbow = [J.stand.elbow[0], [0.21, hip + 0.33, 0]]; j.wrist = [J.stand.wrist[0], [0.23, hip + 0.47, -0.02]]; }
    const parts = [];
    const ball = (c, r, s = [1, 1, 1]) => parts.push(this.sphere(r * H, 16).scale(s).at(c.x, c.y, c.z));
    const limb = (a, b, rA, rB) => {   // tapered cylinder from joint a to joint b
      const d = a.clone().sub(b), part = new Part(new THREE.CylinderGeometry(rA * H, rB * H, d.length(), 14));
      part.m.compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
      parts.push(part);
    };
    const pelvis = V(0, hip, 0), chest = V(0, hip + 0.2, 0), neck = V(0, hip + 0.29, 0), head = V(0, hip + 0.395, -0.005);
    parts.push(this.cylinder(0.105 * H, 0.085 * H, chest.y - pelvis.y + 0.07 * H, 20).scale([1, 1, 0.55]).at(0, (pelvis.y + chest.y) / 2 + 0.035 * H, 0));
    ball(pelvis, 0.09, [1, 0.6, 0.62]);
    limb(neck.clone().add(V(0, 0.01, 0)), V(0, hip + 0.345, 0), 0.026, 0.028);
    ball(head, 0.06, [0.88, 1.18, 1]);
    for (const s of [0, 1]) {
      const sx = s ? 1 : -1, hipJ = V(0.055 * sx, hip, 0), sh = V(0.12 * sx, hip + 0.27, 0);
      const [knee, ankle, elbow, wrist] = ['knee', 'ankle', 'elbow', 'wrist'].map(k => V(...j[k][s]));
      ball(sh, 0.036); limb(sh, elbow, 0.031, 0.026); ball(elbow, 0.026); limb(elbow, wrist, 0.025, 0.02);
      ball(wrist.clone().add(wrist.clone().sub(elbow).setLength(0.03 * H)), 0.026, [0.8, 1.2, 0.8]);   // hand
      ball(hipJ, 0.05); limb(hipJ, knee, 0.05, 0.036); ball(knee, 0.036); limb(knee, ankle, 0.034, 0.024);
      parts.push(this.box(0.055 * H, 0.035 * H, 0.14 * H).at(ankle.x, 0.018 * H, ankle.z - 0.035 * H));   // foot
    }
    t.add(parts, 'person');
    return t.at(x, y, z, rotY).commit();
  }

  /**
   * Animated person (rigged mannequin, CC0): plays a motion clip and can walk a path; posed from the SHOT time, so
   * every frame of a shot (clay, lit, preview) shows the same pose. Facing: rotY degrees (0 = towards +Z).
   *   kit.actor('CHAR_waiter_walking', { pos: [x, y, z], rotY: 90, action: 'walk', path: [[x, z], [x, z], …] })
   * action: idle | walk | walk_formal | jog | sprint | talk | sit | sit_talk | dance | crouch | crouch_walk |
   *         push | torch | kneel_fix | swim. With a path, the actor starts at path[0], walks it at a natural speed
   *         (or `speed` m/s), faces the way it moves and stands idle at the end. height in metres (default 1.75).
   */
  actor(name, { pos = [0, 0, 0], rotY = 0, height = 1.75, action = 'idle', path = null, speed, offset = 0 } = {}) {
    if (!this.character) throw new Error('actor: the character model is not loaded');
    this._checkName(name, ['CHAR']);
    const clipName = CLIPS[action] || action;
    const anims = this.character.animations, find = (n) => anims.find(a => a.name === n) || anims.find(a => a.name.toLowerCase().includes(String(n).toLowerCase()));
    const clip = find(clipName); if (!clip) throw new Error(`actor: no motion '${action}'`);
    const m = cloneSkinned(this.character.scene);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    const s = height / Math.max(size.y, 1e-6); m.scale.multiplyScalar(s); m.position.y = -box.min.y * s;
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9c2b8, roughness: 0.7, name: 'MAT_person' });   // neutral, not the pack's orange
    return this._stage(name, m, clip, path ? find('Idle_Loop') : null, { pos, rotY, path, speed: speed ?? SPEED[action] ?? 1.3, natural: SPEED[action], offset },
      { skin, label: 'person', category: 'CHAR', actor: { pos, rotY, height, action, path, speed, offset } });
  }
  /**
   * Shared staging of an animated figure (kit.actor and animated kit.model): plays `clip` posed from the SHOT time,
   * optionally walks `path` ([x,z] or [x,y,z] points) at `speed` m/s and switches to `idleClip` at the end. A walking
   * figure moves an INNER group along its path; the outer group stays free for hand edits (gizmo), which then
   * move/turn the whole walk. natural = the clip's own travel speed (m/s): steps follow the travel speed (no foot
   * sliding), the clip plays at speed / natural within 0.5–1.6×. skin = material for every mesh (null keeps the
   * model's own materials). Returns the committed group.
   */
  _stage(name, m, clip, idleClip, { pos = [0, 0, 0], rotY = 0, path = null, speed = 1.3, natural, offset = 0 }, { skin = null, label = 'person', category = 'CHAR', ...data }) {
    const walks = Array.isArray(path) && path.length >= 2;
    const g = new THREE.Group(); g.name = name;
    const body = walks ? new THREE.Group() : g; if (walks) g.add(body);
    body.add(m); if (!walks) { g.rotation.y = rotY * DEG; g.position.set(...pos); }
    let meshes = 0, tris = 0;
    m.traverse(o => {
      if (!o.isMesh) return;
      meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.userData.label = label;
      if (skin) o.material = skin; this._lit.set(o, o.material); if (this.mode === 'clay') o.material = this.clay;
    });
    const mixer = new THREE.AnimationMixer(m), act = mixer.clipAction(clip); act.play();
    const idle = walks && idleClip ? mixer.clipAction(idleClip) : null; if (idle) { idle.play(); idle.weight = 0; }
    let pts = null, lens = null, total = 0;
    if (walks) {
      // [x,z] points walk at pos's height; [x,y,z] points set the height too (stairs, ramps, hills)
      pts = path.map((p) => (p.length >= 3 ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3(p[0], pos[1], p[1]))); lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(total += pts[i].distanceTo(pts[i - 1]));
    }
    const rate = walks && natural ? Math.min(1.6, Math.max(0.5, speed / natural)) : 1;
    const a = { g: body, mixer, act, idle, pts, lens, total, speed, rate, offset };
    g.userData = { kind: 'object', category, meshes, triangles: Math.round(tris), ...data };
    this.actors.push(a); this._pose(a, 0);
    this.root.add(g); this.stats.objects++; this.stats.meshes += meshes; this.stats.triangles += Math.round(tris);
    this._markBase(g); this.onCommit(g, { name, kind: 'object' });
    return g;
  }
  /**
   * Costume or carried things that move with an animated figure: each committed prop, placed where the figure stands
   * at the start of its walk, rides on the figure from then on (follows the path, turns with it).
   *   kit.wear('CHAR_violet_guest', 'PRP_violet_cape_and_mask')
   * A rigid costume over the mannequin hides its limbs: costumed figures read as moving only when they travel a path.
   * Worn things leave the top-level object list: selecting one selects the figure, and the figure's box includes them.
   */
  wear(name, ...props) {
    const o = this.root.getObjectByName(name), a = o && this.actors.find((x) => x.g === o || x.g.parent === o);
    if (!a) throw new Error(`wear: '${name}' is not an animated figure`);
    this._pose(a, -a.offset); this.root.updateMatrixWorld(true);   // the walk's start, whatever the stagger
    for (const p of props.flat()) {
      const w = this.root.getObjectByName(p);
      if (!w || w.userData.kind !== 'object' || w === o || w.parent !== this.root) throw new Error(`wear: no free object '${p}'`);
      a.g.attach(w); w.userData.wornBy = name;
    }
    this._pose(a, 0);
    return o;
  }
  /** Pose every actor at time t seconds (deterministic: same t → same pose). The viewer calls it per shot frame. */
  animate(t) { for (const a of this.actors) this._pose(a, t); }
  _pose(a, t0) {
    const t = Math.max(0, t0 + a.offset);
    let moving = true;
    if (a.pts) {
      let d = a.speed * t; if (d >= a.total) { d = a.total; moving = false; }
      let i = 1; while (i < a.lens.length - 1 && a.lens[i] < d) i++;
      const p0 = a.pts[i - 1], p1 = a.pts[i], f = (d - a.lens[i - 1]) / Math.max(1e-6, a.lens[i] - a.lens[i - 1]);
      a.g.position.lerpVectors(p0, p1, Math.min(1, f));
      a.g.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    }
    const tEnd = a.pts ? a.total / a.speed : Infinity;
    a.act.time = ((moving ? t : tEnd) * a.rate) % a.act.getClip().duration;
    a.act.weight = moving || !a.idle ? 1 : 0;
    if (a.idle) { a.idle.weight = moving ? 0 : 1; a.idle.time = moving ? 0 : (t - tEnd) % a.idle.getClip().duration; }
    a.mixer.update(0);
  }

  /** Light. type: 'point' | 'spot' | 'directional' | 'area'. color as '#rrggbb' or 0xrrggbb; intensity in three units. */
  light(name, { type = 'point', pos = [0, 3, 0], target = [0, 0, 0], color = '#ffffff', intensity = 1, distance = 0, angleDeg = 35, width = 1, height = 1 } = {}) {
    this._checkName(name, ['LGT']);
    let l;
    if (type === 'spot') { l = new THREE.SpotLight(color, intensity, distance, angleDeg * DEG, 0.4); }
    else if (type === 'directional') { l = new THREE.DirectionalLight(color, intensity); }
    else if (type === 'area') { l = new THREE.RectAreaLight(color, intensity, width, height); }
    else { l = new THREE.PointLight(color, intensity, distance); }
    l.name = name; l.position.set(...pos);
    if (l.target) { l.target.position.set(...target); this.root.add(l.target); }
    // Shadows: every spot/directional light; only the first 4 point lights (each costs a 6-face cubemap).
    if (type === 'spot' || type === 'directional' || (type === 'point' && this._pointShadows++ < 4)) {
      l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02;
      if (type === 'directional') { const s = l.shadow.camera; s.left = s.bottom = -20; s.right = s.top = 20; s.far = 80; }
    }
    if (type === 'area') l.lookAt(...target);
    l.userData = { kind: 'light', type, basePos: [...pos], baseTarget: [...target], pivot: [...pos] };   // base = as built (edit())
    this.root.add(l); this.stats.lights++;
    this.onCommit(l, { name, kind: 'light' });
    return l;
  }

  /** Camera: position, look-at point, vertical FOV (degrees), aspect (default 16:9). */
  camera(name, { pos = [0, 1.6, 5], lookAt = [0, 1.2, 0], fov = 40, aspect = 16 / 9 } = {}) {
    this._checkName(name, ['CAM']);
    const c = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    c.name = name; c.position.set(...pos); c.lookAt(...lookAt);
    c.userData = { kind: 'camera', lookAt, basePos: [...pos], baseLook: [...lookAt], pivot: [...pos] };   // base = as built (edit())
    this.root.add(c); this.cameras.push(c); this.stats.cameras++;
    this.onCommit(c, { name, kind: 'camera' });
    return c;
  }

  /**
   * Custom camera path (the app's "Add keyframe from this view"): keys = [[x, y, z, lookX, lookY, lookZ, fov], …] in
   * shot order; the 'path' move flies a smooth curve through them. A later call for the same camera replaces its keys.
   */
  /** Move an existing camera to a view (the app's "Set to view"), keeping its path keys: kit.cameraView('CAM_main', { pos, lookAt, fov }). */
  cameraView(name, { pos, lookAt, fov } = {}) {
    const c = this.cameras.find(x => x.name === name);
    if (!c) throw new Error(`cameraView: no camera '${name}'`);
    if (pos) { c.position.set(...pos); c.userData.basePos = [...pos]; c.userData.pivot = [...pos]; }
    if (lookAt) { c.userData.lookAt = lookAt; c.userData.baseLook = [...lookAt]; }
    c.lookAt(...c.userData.lookAt);
    if (fov) { c.fov = fov; c.updateProjectionMatrix(); }
    return c;
  }
  cameraPath(name, keys) {
    const c = this.cameras.find(x => x.name === name);
    if (!c) throw new Error(`cameraPath: no camera '${name}'`);
    if (!Array.isArray(keys) || !keys.every(k => Array.isArray(k) && k.length >= 6 && k.every(Number.isFinite)))
      throw new Error('cameraPath: keys must be [[x, y, z, lookX, lookY, lookZ, fov?], …]');
    c.userData.keys = keys.map(k => [...k.slice(0, 6), k[6] ?? c.fov]);
    return c;
  }

  /**
   * Scene description for the render prompt (not geometry): setting, style, lighting mood, palette.
   * e.g. kit.describe({ setting: 'underground dungeon', style: 'steampunk, brass and iron', lighting: 'firelight' })
   */
  describe(meta) { Object.assign(this.meta, meta); }

  /** Optional viewport colour hint for a material label (does not affect the final render). */
  tint(label, color) { this.materials.get(this._material(label)).color.set(color); }

  /** Emissive material (lamps, embers, screens): glows in the viewport; label still goes to the prompt. */
  glow(label, color = '#ffaa55', strength = 4) {
    const m = this.materials.get(this._material(label)); m.emissive = new THREE.Color(color); m.emissiveIntensity = strength; return label;
  }

  /**
   * Define or override a material label explicitly, e.g.
   *   kit.define('verdigris_copper', { base: 'copper', color: '#4f8a78', roughness: 0.7 })
   * base: optional library preset to start from; any of color/roughness/metalness/transmission/ior override it.
   * Must be called before the label is first used. Returns the label.
   */
  define(label, params = {}) {
    this._defined.set(label, params);
    const old = this.materials.get(label);
    if (old) {   // already used (a chat change "make the plaster warmer"): rebuild it and swap it on every mesh using it
      const m = this._buildMaterial(label); m.name = `MAT_${label}`; this.materials.set(label, m);
      this.root.traverse(o => { if (o.isMesh && o.material === old) o.material = m; });
      old.dispose();
    }
    return this._material(label);
  }

  /**
   * Switch every mesh between the look-dev materials ('lit') and one neutral grey ('clay').
   * 'clay' is the input format for LTX Layout-To-Render playblasts; emissive parts stay grey there too.
   */
  setMode(mode) {
    this.mode = mode;
    this.root.traverse(o => {
      if (!o.isMesh || !o.userData.label) return;
      o.material = mode === 'clay' ? this.clay : (this._lit.get(o) ?? this.materials.get(o.userData.label));   // imported models keep their own
      // Surface effects (water/puddles) have no shape of their own: in the clay layout they would read as raised
      // discs that L2R faithfully renders as "pancakes", so they exist only in the lit pass.
      if (o.userData.surface) o.visible = mode !== 'clay';
    });
  }

  /**
   * Natural terrain (hills, valleys, landscapes): a w × d heightfield centred on the origin, top at y ∈ [0, height],
   * deterministic multi-octave noise from `seed`. `flat` = radius (m) of a level area at the centre (for a city, plaza
   * or building site) blended smoothly into the hills; `edge` lowers the rim to 0 so it meets the ground plane.
   * Use instead of spheres/boxes for hills — faithful video models reproduce sphere-hills as smooth "dough" (10-18).
   */
  terrain(w = 200, d = 200, height = 20, { seed = 1, flat = 0, detail = 96, roughness = 0.5, edge = true } = {}) {
    const g = new THREE.PlaneGeometry(w, d, detail, detail);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    // Value-noise-free deterministic fBm from rotated sines (no RNG, so the set rebuilds identically).
    const fbm = (x, z) => {
      let a = 0, amp = 1, f = 1 / Math.max(w, d) * 3, tot = 0;
      for (let o = 0; o < 5; o++) {
        const r = o * 1.37 + seed * 0.91, cr = Math.cos(r), sr = Math.sin(r);
        const u = (x * cr - z * sr) * f, v = (x * sr + z * cr) * f;
        a += amp * (Math.sin(u * 6.283 + seed) * Math.cos(v * 6.283 * 0.87 + seed * 1.3) * 0.5 + 0.5);
        tot += amp; amp *= roughness; f *= 2.03;
      }
      return a / tot;
    };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let h = fbm(x, z) * height;
      const rc = Math.hypot(x, z);
      if (flat > 0) h *= THREE.MathUtils.smoothstep(rc, flat, flat * 1.6);           // level centre, rising outward
      if (edge) { const e = Math.min(1, (Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z))) / (0.12 * Math.min(w, d)));
                  h *= THREE.MathUtils.smoothstep(e, 0, 1); }                          // rim meets y = 0
      p.setY(i, h);
    }
    g.computeVertexNormals();
    return new Part(g);
  }

  /**
   * Natural puddle: a flat, irregular water patch lying on the ground (no thickness), w × d metres, deterministic
   * outline from `seed`. Place with .at(x, groundY, z); it sits 3 mm above the given height to avoid z-fighting.
   * Use material label 'water' (or any *_puddle / wet_* water label) — it becomes a surface effect automatically.
   */
  puddle(w = 1, d = 0.6, seed = 1) {
    const pts = [], n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // Sum of low-frequency sines = blobby, organic edge (no perfect ellipse).
      const r = 1 + 0.18 * Math.sin(3 * a + seed * 1.7) + 0.1 * Math.sin(5 * a + seed * 2.3) + 0.06 * Math.sin(9 * a + seed * 0.9);
      pts.push(new THREE.Vector2(Math.cos(a) * r * w / 2, Math.sin(a) * r * d / 2));
    }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
    g.rotateX(-Math.PI / 2); g.translate(0, 0.003, 0);   // XY outline → lying flat in XZ, normal +Y
    return new Part(g);
  }

  /** Per-label resolution report for metrics: { label: { preset, modifiers, textured, fallback } }. */
  materialReport() { return Object.fromEntries(this.resolved); }

  // ---------- internals ----------
  _material(label) {
    if (typeof label !== 'string' || !/^[a-z][a-z0-9_]*$/.test(label)) throw new Error(`material label must be snake_case text, got ${label}`);
    if (!this.materials.has(label)) { const m = this._buildMaterial(label); m.name = `MAT_${label}`; this.materials.set(label, m); }
    return label;
  }

  /**
   * Resolve a semantic label to a library preset + modifiers. Tokens are split on '_'; modifier words
   * (aged, wet, dark…) are pulled out; the remaining tokens are matched against preset keys and aliases,
   * longest contiguous run first, ties broken toward the END of the label (English head noun is last:
   * 'aged_brass_valve' → 'brass'… then 'valve' alias also brass). Unmatched → neutral 'paint' fallback.
   */
  _resolve(label) {
    const lib = this.library, mods = lib._modifiers || {};
    const tokens = label.split('_'), modifiers = tokens.filter(t => mods[t]), rest = tokens.filter(t => !mods[t]);
    // Two indexes: material words (keys + aliases) win over object words ('pipe' implies copper only
    // when the label names no material: 'iron_pipe_supports' → iron, 'pipe_run' → copper).
    const [materialIx, objectIx] = this._aliasIndex || (this._aliasIndex = (() => {
      const mi = new Map(), oi = new Map();
      for (const [key, v] of Object.entries(lib)) {
        if (key.startsWith('_')) continue;
        mi.set(key, key);
        for (const a of v.aliases || []) if (!mi.has(a)) mi.set(a, key);
        for (const o of v.objects || []) if (!oi.has(o)) oi.set(o, key);
      }
      return [mi, oi];
    })());
    for (const ix of [materialIx, objectIx]) {
      for (let len = rest.length; len > 0; len--) {
        for (let start = rest.length - len; start >= 0; start--) {
          const hit = ix.get(rest.slice(start, start + len).join('_'));
          if (hit) return { preset: hit, modifiers, via: ix === objectIx ? 'object' : 'material' };
        }
      }
    }
    return { preset: lib.paint ? 'paint' : null, modifiers, fallback: true };
  }

  _buildMaterial(label) {
    const defined = this._defined.get(label);
    const r = defined?.base ? { preset: defined.base, modifiers: [] } : (this.library ? this._resolve(label) : { preset: null, modifiers: [], fallback: true });
    const preset = (r.preset && this.library?.[r.preset]) || {};
    const p = { color: preset.color || '#bdbdbd', roughness: preset.roughness ?? 0.85, metalness: preset.metalness ?? 0,
                transmission: preset.transmission ?? 0, ior: preset.ior ?? 1.5, emissive: preset.emissive,
                emissiveIntensity: preset.emissiveIntensity, ...(defined || {}) };
    let darken = 0;
    for (const m of r.modifiers) { const mod = this.library._modifiers[m]; p.roughness += mod.roughness || 0; darken += mod.darken || 0; }
    p.roughness = Math.min(1, Math.max(0.02, p.roughness));
    const Mat = p.transmission > 0 ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Mat({ color: p.color, roughness: p.roughness, metalness: p.metalness });
    if (p.transmission > 0) { m.transmission = p.transmission; m.ior = p.ior; m.thickness = 0.02; }
    if (p.emissive) { m.emissive = new THREE.Color(p.emissive); m.emissiveIntensity = p.emissiveIntensity ?? 2; }
    const tex = preset.tex && !defined?.color && this.textures.manifest?.[preset.tex];
    if (tex) {
      // Textured preset: maps tile once per real-world asset size because UVs are in metres.
      const load = (name, srgb) => {
        const t = this.textures.loader.load(`${this.textures.base}${preset.tex}/${name}.jpg`);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tex.size_m[0], 1 / tex.size_m[1]);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
      };
      m.color.set('#ffffff'); m.map = load('diff', true); m.normalMap = load('nor_gl', false);
      if (tex.maps.includes('rough')) { m.roughnessMap = load('rough', false); m.roughness = 1 + Math.max(-0.5, Math.min(0.5, p.roughness - (preset.roughness ?? 0.85))); }
      if (tex.maps.includes('metal')) { m.metalnessMap = load('metal', false); m.metalness = 1; }
    }
    if (darken) m.color.multiplyScalar(Math.max(0.15, 1 - darken));
    this.resolved.set(label, { preset: r.preset, via: r.via || null, modifiers: r.modifiers, textured: !!tex, fallback: !!r.fallback, defined: !!defined });
    return m;
  }
  _checkName(name, allowed) {
    const prefix = String(name).split('_')[0];
    if (!allowed.includes(prefix) || !/^[A-Z]+_[a-z0-9_]+$/.test(name)) throw new Error(`bad name '${name}': use ${allowed.join('|')}_snake_case`);
    // A name used again REPLACES the earlier object/light/camera (chat edits redefine objects by name, 10-28);
    // earlier this threw "duplicate name" and the whole block was skipped.
    if (this.names.has(name)) this._drop(name);
    this.names.add(name);
  }
  /**
   * Scene properties (the app's Scene panel writes this line; a later call overrides earlier values):
   * kit.settings({ exposure: 1.2, lights: 0.8, background: '#1b2433' })
   * exposure = multiplier on the camera exposure, lights = multiplier on every scene light, background = a flat
   * colour instead of the sky / dark backdrop ('auto' = back to the default). Lit look only — clay stays neutral.
   */
  settings({ exposure, lights, background } = {}) {
    const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
    const p = { exposure: num(exposure, 0.1, 4), lights: num(lights, 0, 5),
      background: background === 'auto' ? null : (typeof background === 'string' && /^#[0-9a-f]{6}$/i.test(background) ? background : undefined) };
    for (const [k, v] of Object.entries(p)) if (v !== undefined) this.props[k] = v;
    return this.props;
  }
  /**
   * A ready-made 3D model from the asset library or an imported GLB:
   * kit.model('PRP_old_barrel', 'lib:011b2d2d9a98b575', { pos: [x, y, z], height: 1.2, rotY: 30 })
   * pos = where its base centre stands (m); height = its real height in metres (default: the library's estimate, or
   * the model's own size when it has none — glTF units are metres);
   * rotY = turn about the vertical axis (degrees). It keeps its own materials (clay mode turns it grey like the rest).
   */
  model(name, asset, { pos = [0, 0, 0], height, rotY = 0, action, motions = [], path = null, speed, offset = 0, as } = {}) {
    const src = this.models.get(asset);
    if (!src) throw new Error(`model: asset '${asset}' is not available`);
    this._checkName(name, ['ENV', 'PRP', 'MACH', 'CHAR']);
    // Animated models (an imported character with its motion, e.g. from Mixamo): the model's own clips plus the clips
    // of `motions` (other imported files of the same skeleton, named '<asset id>' or '<asset id>:<clip>').
    let skinned = false; src.scene.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
    const m = skinned ? cloneSkinned(src.scene) : src.scene.clone(true);
    const extra = motions.flatMap((id) => { const mm = this.models.get(id); if (!mm) throw new Error(`model: motion '${id}' is not available`);
      return moving(mm.animations).map((c, i) => { const k = retarget(c, mm.scene, m); k.name = i ? `${id}:${c.name}` : id; return k; }); });
    const anims = [...moving(src.animations), ...extra];
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    // A character without a known height stands 1.75 m (Mixamo files come in centimetres: 180 "metres" tall).
    const want = height ?? src.height ?? (name.startsWith('CHAR') ? 1.75 : undefined), s = want ? want / Math.max(size.y, 1e-6) : 1;
    m.scale.multiplyScalar(s); m.position.set(-c.x * s, -box.min.y * s, -c.z * s);   // base centre at the group origin
    if (anims.length || skinned) {   // a rigged character without a motion yet holds its rest pose (kit.motion adds one)
      const find = (n) => anims.find(x => x.name === n) || anims.find(x => x.name.toLowerCase().includes(String(n).toLowerCase()));
      const clip = (action && find(action)) || anims[0] || new THREE.AnimationClip('rest', 1, []);
      const idleClip = find('idle') || null;
      return this._stage(name, m, clip, idleClip !== clip ? idleClip : null, { pos, rotY, path, speed: speed ?? 1.3, natural: /walk/i.test(clip.name + ' ' + (action || '')) ? 1.3 : undefined, offset },
        { skin: null, label: 'model', category: name.split('_')[0], asset, actor: { pos, rotY, height, action: clip.name, as, path, speed, offset, motions } });
    }
    const g = new THREE.Group(); g.name = name; g.add(m); g.rotation.y = rotY * DEG; g.position.set(...pos);
    let meshes = 0, tris = 0;
    m.traverse(o => {
      if (!o.isMesh) return;
      meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      o.castShadow = o.receiveShadow = true; o.userData.label = 'model'; this._lit.set(o, o.material);
      if (this.mode === 'clay') o.material = this.clay;
    });
    g.userData = { kind: 'object', category: name.split('_')[0], meshes, triangles: Math.round(tris), asset };
    this.root.add(g); this.stats.objects++; this.stats.meshes += meshes; this.stats.triangles += Math.round(tris);
    this._markBase(g); this.onCommit(g, { name, kind: 'object' });
    return g;
  }
  /**
   * Change the motion of an animated figure IN PLACE (hand edits and its walk path stay):
   *   kit.motion('CHAR_anna', 'up:3f…')   an imported motion file (e.g. a Mixamo "without skin" download)
   *   kit.motion('CHAR_anna', 'wave')     a clip by name: the figure's own clips, or a kit.actor action for mannequins
   * as = what the motion is, for the render prompt ('walk', 'talk', 'sit', 'wave', …): imported clips have no such name.
   */
  motion(name, motion, { as } = {}) {
    const o = this.root.getObjectByName(name), A = o?.userData.actor;
    const a = A && this.actors.find((x) => x.g === o || x.g.parent === o);
    if (!a) throw new Error(`motion: '${name}' is not an animated figure`);
    const root = a.mixer.getRoot(), own = o.userData.asset ? moving(this.models.get(o.userData.asset)?.animations) : this.character?.animations || [];
    const find = (n) => own.find((c) => c.name === n) || own.find((c) => c.name.toLowerCase().includes(String(n).toLowerCase()));
    let clip;
    if (this.models.has(motion)) {
      const mm = this.models.get(motion), c = moving(mm.animations)[0];
      if (!c) throw new Error(`motion: '${motion}' has no motion in it`);
      clip = o.userData.asset ? retarget(c, mm.scene, root) : c; clip.name = motion;
    } else clip = find(o.userData.asset ? motion : CLIPS[motion] || motion);
    if (!clip) throw new Error(`motion: no motion '${motion}' for '${name}'`);
    a.act.stop(); a.act = a.mixer.clipAction(clip); a.act.play();
    const nat = o.userData.asset ? (/walk/i.test(String(motion)) ? 1.3 : undefined) : SPEED[motion];
    a.rate = a.pts && nat ? Math.min(1.6, Math.max(0.5, a.speed / nat)) : 1;
    // remembered so a duplicate (kit.clone → kit.model) gets the same motion
    const motions = this.models.has(motion) ? [...new Set([...(A.motions || []), motion])] : A.motions;
    o.userData.actor = { ...A, motions, action: o.userData.asset ? clip.name : motion, as: as ?? (o.userData.asset ? undefined : motion) };
    this._pose(a, 0);
    return o;
  }
  /**
   * Change a light IN PLACE (the app's light panel writes these lines; a later line for the same light replaces it):
   *   kit.lightProps('LGT_key', { color: '#ffd09a', intensity: 4, on: true })
   */
  lightProps(name, { type, color, intensity, on } = {}) {
    let l = this.root.getObjectByName(name);
    if (!l?.isLight) throw new Error(`lightProps: no light '${name}'`);
    // another kind of light (point / spot / sun / area): rebuilt under the same name where it stands now, aimed at the
    // same target, same colour and brightness — then the remaining props apply as usual
    if (type && type !== l.userData.type) {
      const pos = l.position.toArray(), target = l.target ? l.target.position.toArray() : l.userData.baseTarget ?? [0, 0, 0];
      l = this.light(name, { type, pos, target, color: '#' + l.color.getHexString(), intensity: l.intensity, distance: l.distance || 0,
        angleDeg: l.angle ? l.angle / DEG : 35, width: l.width || 1, height: l.height || 1 });
    }
    if (color !== undefined) l.color.set(color);
    if (intensity !== undefined) l.intensity = Math.max(0, Number(intensity) || 0);
    if (on !== undefined) l.visible = !!on;
    return l;
  }
  /** Remember an object's built placement and its world bounding-box centre (the pivot for edit()). */
  _markBase(g) {
    g.updateMatrixWorld(true);
    g.userData.base = g.matrix.clone();
    g.userData.pivot = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).toArray();
  }
  /**
   * Hands-on edit of a committed object (the app's move/rotate/scale gizmo writes these lines):
   * kit.edit('PRP_crate_01', { pos: [x, y, z], rot: [rx, ry, rz], scale: s })
   * pos = where the object's centre goes (world m); rot (degrees, XYZ) and scale (number or [x, y, z]) apply about
   * that centre. Always measured from the object as built, so a later edit of the same object replaces an earlier one.
   */
  edit(name, { pos, rot = [0, 0, 0], scale = 1 } = {}) {
    const o = this.root.getObjectByName(name);
    if (o && (o.userData.kind === 'light' || o.userData.kind === 'camera')) return this._editAim(o, pos, rot);
    if (!o || o.userData.kind !== 'object') throw new Error(`edit: no object '${name}'`);
    const c = new THREE.Vector3(...o.userData.pivot), p = pos ? new THREE.Vector3(...pos) : c.clone();
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG)))
      .multiply(new THREE.Matrix4().makeScale(s[0], s[1], s[2]))
      .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z))
      .multiply(o.userData.base);
    m.decompose(o.position, o.quaternion, o.scale);
    o.userData.edit = { pos: p.toArray(), rot: [...rot], scale };
    return o;
  }
  /**
   * Lights and cameras: pos = where it goes; rot (degrees, XYZ) turns its aim (a camera's look direction, a spot /
   * sun light's target) about its own position. Moving keeps the aim direction (the look-at / target point moves along);
   * scale has no meaning here. Measured from the light / camera as built, like objects.
   */
  _editAim(o, pos, rot) {
    const u = o.userData, cam = u.kind === 'camera';
    const p = new THREE.Vector3(...(pos ?? u.basePos));
    const dir = new THREE.Vector3(...(cam ? u.baseLook : u.baseTarget)).sub(new THREE.Vector3(...u.basePos))
      .applyEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG));
    const aim = p.clone().add(dir);
    o.position.copy(p);
    if (cam) { o.lookAt(aim); u.lookAt = aim.toArray(); }
    else if (o.target) { o.target.position.copy(aim); o.target.updateMatrixWorld(); }
    else if (o.isRectAreaLight) o.lookAt(aim);
    u.edit = { pos: p.toArray(), rot: [...rot], scale: 1 };
    return o;
  }
  /** Duplicate a committed object under a new name, offset by `move` metres: kit.clone('PRP_barrel_01', 'PRP_barrel_02', { move: [1, 0, 0] }). */
  clone(src, dst, { move = [0, 0, 0] } = {}) {
    const o = this.root.getObjectByName(src);
    if (!o || o.userData.kind !== 'object') throw new Error(`clone: no object '${src}'`);
    this._checkName(dst, ['ENV', 'PRP', 'MACH', 'CHAR']);
    if (o.userData.actor) {   // a rigged actor cannot be copied mesh by mesh (shared skeleton): build a new one, moved
      const A = o.userData.actor, [dx, dy, dz] = move;
      const opts = { ...A, pos: [A.pos[0] + dx, A.pos[1] + dy, A.pos[2] + dz], path: A.path && A.path.map((p) => (p.length >= 3 ? [p[0] + dx, p[1] + dy, p[2] + dz] : [p[0] + dx, p[1] + dz])) };
      return o.userData.asset ? this.model(dst, o.userData.asset, opts) : this.actor(dst, opts);   // animated import or mannequin
    }
    const g = o.clone(true); g.name = dst;
    const src2 = [], dst2 = []; o.traverse(x => src2.push(x)); g.traverse(x => dst2.push(x));
    src2.forEach((x, i) => { const m = this._lit.get(x); if (m) this._lit.set(dst2[i], m); });
    g.traverse(m => { if (m.isMesh && m.name.startsWith(src)) m.name = dst + m.name.slice(src.length); });
    g.position.add(new THREE.Vector3(...move));
    g.userData = { ...o.userData, edit: undefined };
    this.root.add(g); this.stats.objects++; this.stats.meshes += g.userData.meshes || 0; this.stats.triangles += g.userData.triangles || 0;
    this._markBase(g);
    return g;
  }
  /** Remove a committed object, light or camera by name (chat edits: "remove the second cage"). No-op if absent. */
  remove(name) { if (this.names.has(name)) this._drop(name); }
  _drop(name) {
    const o = this.root.getObjectByName(name);
    if (o) {
      if (o.userData.kind === 'object') { this.stats.objects--; this.stats.meshes -= o.userData.meshes || 0; this.stats.triangles -= o.userData.triangles || 0; }
      else if (o.userData.kind === 'light') { this.stats.lights--; if (o.target) this.root.remove(o.target); }
      o.removeFromParent();
      this.actors = this.actors.filter(a => a.g !== o && a.g.parent !== o);
      o.traverse((c) => { if (c !== o && c.userData.wornBy) this.names.delete(c.name); });   // its costume goes with it
    }
    const ci = this.cameras.findIndex(c => c.name === name);
    if (ci >= 0) { this.cameras.splice(ci, 1); this.stats.cameras--; }
    this.names.delete(name);
  }
  _commitThing(thing) {
    const g = new THREE.Group(); g.name = thing.name; g.applyMatrix4(thing.place);
    const parts = [];   // each part's box (object space) before the merge: the floating check (floaters.js) works per part
    for (const [label, geoms] of thing.byMat) {
      for (const pg of geoms) { pg.computeBoundingBox(); const { min: a, max: z } = pg.boundingBox; parts.push([a.x, a.y, a.z, z.x, z.y, z.z].map((v) => +v.toFixed(3))); }
      const merged = mergeGeometries(geoms, false);
      if (!merged) throw new Error(`${thing.name}: could not merge parts for material ${label}`);
      const mesh = new THREE.Mesh(merged, this.materials.get(label));
      mesh.name = `${thing.name}_${label}`; mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.label = label;
      const preset = this.resolved.get(label)?.preset;
      if (preset && this.library?.[preset]?.surface) { mesh.userData.surface = true; mesh.castShadow = false; }
      // see-through materials (window glass, water) let light through: a glass pane casting a full shadow kept every
      // sun beam out of rooms (reading room, 10-29)
      const mat = mesh.material; if (mat && (mat.transmission > 0.3 || (mat.transparent && mat.opacity < 0.6))) mesh.castShadow = false;
      if (this.mode === 'clay') mesh.material = this.clay;
      g.add(mesh); this.stats.meshes++; this.stats.triangles += merged.attributes.position.count / 3;
    }
    const meshes = g.children.length, tris = g.children.reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0);
    g.userData = { kind: 'object', category: thing.name.split('_')[0], meshes, triangles: tris, parts };
    this.root.add(g); this.stats.objects++;
    this._markBase(g);
    this.onCommit(g, { name: thing.name, kind: 'object' });
    return g;
  }
}

export { PREFIXES };
