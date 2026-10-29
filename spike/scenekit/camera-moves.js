/**
 * camera-moves.js — Cinema Studio's 33 camera-movement presets as exact 3D camera paths.
 *
 * Role: Higgsfield Cinema Studio 4.0 exposes `camera_movement` as 33 words that an LLM "director" writes into a
 * prompt (research/higgsfield_api_capabilities.md). In a real 3D set every move is a deterministic camera path
 * instead, so a Layout-To-Render playblast carries the move exactly.
 *
 * API: cameraAt(move, start, t, opts) -> { pos:[x,y,z], lookAt:[x,y,z], fov, roll }
 *   move   one of MOVES (kebab-case names identical to Higgsfield's enum)
 *   start  { pos, lookAt, fov }  — the shot camera at t = 0 (usually a scene CAM_*)
 *   t      0..1 normalised shot time (eased inside where a real rig would ease)
 *   opts   { amount = 1 }  scales the move's travel (1 = a natural, readable move for the subject distance)
 * Pure math, no three.js dependency, deterministic (handheld shake is a fixed sum of sines).
 * Callers: viewer.html (window.frame / playblast), later the app's shot editor and the ComfyUI node pack.
 *
 * Moves that need optics the clay pass cannot show (rack-focus) keep the camera static and are flagged
 * `opticalOnly` — the focus change belongs in the render prompt, not in the layout.
 */
const v = { add: (a, b) => a.map((x, i) => x + b[i]), sub: (a, b) => a.map((x, i) => x - b[i]),
  mul: (a, s) => a.map(x => x * s), len: a => Math.hypot(...a), norm: a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
const ease = t => t * t * (3 - 2 * t);              // smoothstep: rigs accelerate and settle
const easeIn = t => t * t * t;                       // crush/whip style snaps
const UP = [0, 1, 0];

/** Rotate point p around a vertical axis through c by angle a (radians). */
function orbitY(p, c, a) {
  const d = v.sub(p, c), cs = Math.cos(a), sn = Math.sin(a);
  return v.add(c, [d[0] * cs + d[2] * sn, d[1], -d[0] * sn + d[2] * cs]);
}
/** Rotate the look direction around the camera's own vertical (pan) or right axis (tilt). */
function turn(pos, look, yaw, pitch) {
  let d = v.sub(look, pos);
  const dist = v.len(d);
  d = orbitY(d, [0, 0, 0], yaw);
  const right = v.norm(v.cross(d, UP));
  const cs = Math.cos(pitch), sn = Math.sin(pitch), dn = v.norm(d);
  const up2 = v.cross(right, dn);
  const nd = v.add(v.mul(dn, cs), v.mul(up2, sn));
  return v.add(pos, v.mul(nd, dist));
}

/** Each entry: (s, t, k) -> partial camera; s = start frame, k = { d: subject distance, fwd, right, amount }. */
// Custom path (the user's keyframes, kit.cameraPath): centripetal Catmull-Rom through every key's position and look-at
// point, fov linear, eased at both ends. Keys come with the start state (start.keys = [[x,y,z, lx,ly,lz, fov, s?], …]).
// Timed keys (every key has s = seconds from the start of the move, set from the timeline playhead) are passed AT
// their time: the camera holds the first view before the first key and the last view after the last key, eases in on
// the first span and out on the last. Untimed keys are spread evenly over the move (scenes saved before timing).
function alongKeys(keys, t, seconds) {
  const timed = seconds > 0 && keys.every(k => k.length >= 8 && Number.isFinite(k[7]));
  const K = timed ? [...keys].sort((a, b) => a[7] - b[7]) : keys;
  const P = K.map(k => ({ pos: k.slice(0, 3), look: k.slice(3, 6), fov: k[6] }));
  if (P.length === 1) return { pos: P[0].pos, lookAt: P[0].look, fov: P[0].fov };
  let i, u;
  if (timed) {
    const s = t * seconds, T = K.map(k => k[7]);
    if (s <= T[0]) { i = 0; u = 0; } else if (s >= T[T.length - 1]) { i = P.length - 2; u = 1; }
    else {
      i = 0; while (i < T.length - 2 && s > T[i + 1]) i++;
      u = (s - T[i]) / Math.max(1e-6, T[i + 1] - T[i]);
      const first = i === 0, last = i === P.length - 2;
      u = first && last ? u * u * (3 - 2 * u) : first ? u * u * (2 - u) : last ? u + u * u - u * u * u : u;
    }
  } else {
    const e = t * t * (3 - 2 * t), f = e * (P.length - 1); i = Math.min(P.length - 2, Math.floor(f)); u = f - i;
  }
  const at = (j) => P[Math.max(0, Math.min(P.length - 1, j))];
  const cr = (key) => {   // centripetal Catmull-Rom (alpha 0.5): no loops or overshoot between close keys
    const p0 = at(i - 1)[key], p1 = at(i)[key], p2 = at(i + 1)[key], p3 = at(i + 2)[key];
    const tj = (a, b) => Math.pow(Math.hypot(...a.map((x, q) => x - b[q])) || 1e-4, 0.5);
    const t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3), s = t1 + u * (t2 - t1);
    const lerp = (a, b, ta, tb) => a.map((x, q) => (tb - s) / (tb - ta) * x + (s - ta) / (tb - ta) * b[q]);
    const A1 = lerp(p0, p1, 0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
    const B1 = lerp(A1, A2, 0, t2), B2 = lerp(A2, A3, t1, t3);
    return lerp(B1, B2, t1, t2);
  };
  const fa = at(i).fov, fb = at(i + 1).fov;
  return { pos: cr('pos'), lookAt: cr('look'), fov: fa && fb ? fa + (fb - fa) * u : undefined };
}

const DEFS = {
  'static-shot':     () => ({}),
  'path':            (s, t, o) => (s.keys && s.keys.length ? alongKeys(s.keys, t, o.seconds) : {}),
  'dolly-in':        (s, t, k) => ({ pos: v.add(s.pos, v.mul(k.fwd, ease(t) * k.d * 0.45 * k.amount)) }),
  'dolly-out':       (s, t, k) => ({ pos: v.add(s.pos, v.mul(k.fwd, -ease(t) * k.d * 0.6 * k.amount)) }),
  'slow-zoom-in':    (s, t, k) => ({ fov: s.fov / (1 + 0.35 * k.amount * t) }),
  'slow-zoom-out':   (s, t, k) => ({ fov: s.fov * (1 + 0.35 * k.amount * t) }),
  'crush-zoom':      (s, t, k) => ({ fov: s.fov / (1 + 1.6 * k.amount * easeIn(t)) }),
  'dolly-zoom':      (s, t, k) => {  // vertigo: dolly in while widening FOV so the subject keeps its size
    const travel = ease(t) * k.d * 0.5 * k.amount, d1 = k.d - travel;
    const half = Math.atan(Math.tan((s.fov * Math.PI / 180) / 2) * k.d / d1);
    return { pos: v.add(s.pos, v.mul(k.fwd, travel)), fov: Math.min(120, 2 * half * 180 / Math.PI) };
  },
  'truck-left':      (s, t, k) => slide(s, k, -ease(t) * k.d * 0.35 * k.amount),
  'truck-right':     (s, t, k) => slide(s, k, ease(t) * k.d * 0.35 * k.amount),
  'slider-left':     (s, t, k) => slide(s, k, -ease(t) * Math.min(1.2, k.d * 0.2) * k.amount),
  'slider-right':    (s, t, k) => slide(s, k, ease(t) * Math.min(1.2, k.d * 0.2) * k.amount),
  'side-tracking':   (s, t, k) => slide(s, k, ease(t) * k.d * 0.6 * k.amount),
  'tracking':        (s, t, k) => { const m = v.mul(k.fwd, ease(t) * k.d * 0.5 * k.amount); return { pos: v.add(s.pos, m), lookAt: v.add(s.lookAt, m) }; },
  'pedestal-up':     (s, t, k) => lift(s, ease(t) * Math.min(2, k.d * 0.3) * k.amount),
  'pedestal-down':   (s, t, k) => lift(s, -ease(t) * Math.min(1.2, (s.pos[1] - 0.3) * 0.8) * k.amount),
  'crane-up':        (s, t, k) => ({ pos: v.add(s.pos, [0, ease(t) * Math.min(k.d * 0.6, 8) * k.amount, 0]) }),  // rises ≤ 8 m (a real crane), keeps looking at subject
  'crane-down':      (s, t, k) => ({ pos: v.add(s.pos, [0, -ease(t) * Math.min(k.d * 0.5, s.pos[1] - 0.3) * k.amount, 0]) }),
  'tilt-up':         (s, t, k) => ({ lookAt: turn(s.pos, s.lookAt, 0, ease(t) * 0.45 * k.amount) }),
  'tilt-down':       (s, t, k) => ({ lookAt: turn(s.pos, s.lookAt, 0, -ease(t) * 0.45 * k.amount) }),
  'pan-left':        (s, t, k) => ({ lookAt: turn(s.pos, s.lookAt, ease(t) * 0.6 * k.amount, 0) }),
  'pan-right':       (s, t, k) => ({ lookAt: turn(s.pos, s.lookAt, -ease(t) * 0.6 * k.amount, 0) }),
  'whip-pan':        (s, t, k) => ({ lookAt: turn(s.pos, s.lookAt, -easeIn(t) * 1.6 * k.amount, 0) }),
  'arc-left':        (s, t, k) => ({ pos: orbitY(s.pos, s.lookAt, ease(t) * 0.7 * k.amount) }),
  'arc-right':       (s, t, k) => ({ pos: orbitY(s.pos, s.lookAt, -ease(t) * 0.7 * k.amount) }),
  'drone-orbit':     (s, t, k) => ({ pos: v.add(orbitY(s.pos, s.lookAt, -t * 1.6 * k.amount), [0, k.d * 0.25, 0]) }),
  'bullet-time':     (s, t, k) => ({ pos: orbitY(s.pos, s.lookAt, -ease(t) * Math.PI * 0.9 * k.amount) }),
  'robot-arm':       (s, t, k) => {  // fast precise combined move: arc + rise + push
    const p = orbitY(s.pos, s.lookAt, -ease(t) * 0.9 * k.amount);
    return { pos: v.add(v.add(p, [0, ease(t) * k.d * 0.3, 0]), v.mul(k.fwd, ease(t) * k.d * 0.2)) };
  },
  'aerial-pullback': (s, t, k) => ({ pos: v.add(v.add(s.pos, v.mul(k.fwd, -ease(t) * k.d * 1.5 * k.amount)), [0, ease(t) * k.d * 1.2 * k.amount, 0]) }),
  'helicopter-shot': (s, t, k) => ({ pos: v.add(orbitY(s.pos, s.lookAt, -t * 0.8 * k.amount), [0, k.d * (0.8 + 0.4 * t), 0]) }),
  'handheld':        (s, t, k) => shake(s, t, 0.035 * k.amount),
  'pov':             (s, t, k) => { const m = v.mul(k.fwd, t * k.d * 0.3 * k.amount); const b = shake(s, t, 0.02);  // walking eye-height drift
                                    return { pos: v.add(b.pos, v.add(m, [0, 0.03 * Math.sin(t * 18), 0])), lookAt: v.add(b.lookAt, m) }; },
  'snorricam':       (s, t, k) => { const m = v.mul(k.fwd, t * k.d * 0.25 * k.amount); return { pos: v.add(s.pos, m), lookAt: v.add(s.lookAt, m), roll: 0.03 * Math.sin(t * 9) }; },
  'rack-focus':      () => ({ opticalOnly: true }),
};
function slide(s, k, x) { const m = v.mul(k.right, x); return { pos: v.add(s.pos, m), lookAt: v.add(s.lookAt, m) }; }
function lift(s, y) { return { pos: v.add(s.pos, [0, y, 0]), lookAt: v.add(s.lookAt, [0, y, 0]) }; }
function shake(s, t, a) {
  const n = (f, p) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.3 + Math.sin(t * f * 5.13 + p * 0.3) * 0.1;
  const o = [n(11, 0.3) * a, n(13, 1.1) * a, n(7, 2.2) * a];
  return { pos: v.add(s.pos, o), lookAt: v.add(s.lookAt, v.mul(o, 0.4)), roll: n(9, 0.7) * a * 0.5 };
}

export const MOVES = Object.keys(DEFS);

/**
 * Parse a shot recipe "move:seconds[:amount][@CAM_x]+…" (e.g. "dolly-in:4+arc-left:6:2.5@CAM_table+crane-up:5").
 * A plain move name ("arc-left") is a one-segment recipe. `@CAM_x` names the segment's camera (camera cuts inside one
 * shot); without it the segment uses the shot's camera. Returns [{move, seconds, amount, cam?}].
 */
export function parseRecipe(recipe, defaultSeconds = 4) {
  return String(recipe).split('+').map(s => {
    const [body, cam] = s.split('@'), [move, sec, amt] = body.split(':');
    if (!DEFS[move]) throw new Error(`unknown camera move '${move}' in recipe '${recipe}'`);
    if (cam !== undefined && !/^CAM_[A-Za-z0-9_]{1,60}$/.test(cam)) throw new Error(`bad camera '${cam}' in recipe '${recipe}'`);
    return { move, seconds: sec ? Number(sec) : defaultSeconds, amount: amt ? Number(amt) : 1, ...(cam ? { cam } : {}) };
  });
}
/** One recipe segment back to its string form (the inverse of parseRecipe for one segment). */
export const segmentString = (s) => `${s.move}:${s.seconds}${s.amount != null && s.amount !== 1 ? `:${s.amount}` : ''}${s.cam ? `@${s.cam}` : ''}`;

/**
 * Camera states for a whole multi-move shot. Segments on the same camera chain continuously: segment i starts exactly
 * where segment i-1 ended, then the per-frame sequence is smoothed with a centred moving average (window ≈
 * `smoothSeconds`) so the per-move ease-in/ease-out does not make the camera stop between segments.
 * Camera cuts: `cams = { shot, at(name) }` (shot = the shot camera's name, at = a scene camera's start state or null).
 * A segment whose camera differs from the previous segment's is a HARD CUT: it starts at that camera's own pose, and
 * the smoothing never reaches across a cut. INVARIANT: a segment without `@CAM` (every recipe written before cuts, and
 * every caller without `cams`) is the shot camera, so such recipes plan exactly as before.
 * The frame on a cut's exact time already shows the new camera (shot k = frames [round(T_k·(n-1)/total), …)).
 * Returns n states [{pos, lookAt, fov, roll, cam, seg, group, cut, from}] — cam = the camera of that frame ('' = the
 * shot camera when `cams` is not given), seg = recipe segment, group = continuous run of segments on one camera,
 * cut = first frame of a new camera (never frame 0), from = that run's starting camera position.
 */
export function pathStates(recipe, start, n, fps = 24, smoothSeconds = 0.6, cams = null) {
  const segs = parseRecipe(recipe);
  const total = segs.reduce((s, x) => s + x.seconds, 0), shot = cams?.shot ?? '';
  const camOf = (s) => (s.cam && s.cam !== shot && cams?.at(s.cam) ? s.cam : shot);   // unknown camera = the shot camera
  const starts = [], group = [], base = []; let cur = null, g = -1;
  segs.forEach((s, k) => {
    if (k === 0 || camOf(s) !== camOf(segs[k - 1])) { g++; cur = camOf(s) === shot ? { ...start } : { ...cams.at(camOf(s)) }; base[g] = cur; }
    starts.push(cur); group.push(g);
    const e = cameraAt(s.move, cur, 1, { amount: s.amount, seconds: s.seconds });
    cur = { pos: e.pos, lookAt: e.lookAt, fov: e.fov, keys: base[g].keys };
  });
  const raw = [], gof = [];
  for (let i = 0; i < n; i++) {
    let t = (n > 1 ? i / (n - 1) : 0) * total, k = 0;
    // a cut's own time belongs to the new camera (1e-9: float sums of the seconds)
    while (k < segs.length - 1 && (t > segs[k].seconds || (group[k + 1] !== group[k] && t >= segs[k].seconds - 1e-9))) { t -= segs[k].seconds; k++; }
    const st = cameraAt(segs[k].move, starts[k], Math.min(1, t / segs[k].seconds), { amount: segs[k].amount, seconds: segs[k].seconds });
    raw.push({ ...st, cam: camOf(segs[k]), seg: k, group: group[k], cut: i > 0 && group[k] !== gof[i - 1], from: base[group[k]].pos });
    gof.push(group[k]);
  }
  // smoothing only inside a run of several chained segments (one move alone keeps its exact ease, as before)
  const runs = group.map((x) => group.filter((y) => y === x).length);
  const w = Math.max(1, Math.round(smoothSeconds * fps / 2));
  const avg = (key, i) => { let acc = null, c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      if (gof[j] !== gof[i]) continue;
      const v0 = raw[j][key]; acc = acc ? (Array.isArray(v0) ? acc.map((a, q) => a + v0[q]) : acc + v0) : (Array.isArray(v0) ? [...v0] : v0); c++; }
    return Array.isArray(acc) ? acc.map(a => a / c) : acc / c; };
  return raw.map((s, i) => (runs[s.seg] < 2 ? s : { ...s, pos: avg('pos', i), lookAt: avg('lookAt', i), fov: avg('fov', i), roll: avg('roll', i) }));
}

export function cameraAt(move, start, t, opts = {}) {
  const def = DEFS[move];
  if (!def) throw new Error(`unknown camera move '${move}' (have: ${MOVES.join(', ')})`);
  const d = v.len(v.sub(start.lookAt, start.pos)) || 1;
  const fwd = v.norm(v.sub(start.lookAt, start.pos));
  const right = v.norm(v.cross(fwd, UP));
  const out = def(start, Math.min(1, Math.max(0, t)), { d, fwd, right, amount: opts.amount ?? 1, seconds: opts.seconds });
  return { pos: out.pos || start.pos, lookAt: out.lookAt || start.lookAt, fov: out.fov || start.fov, roll: out.roll || 0, opticalOnly: !!out.opticalOnly };
}
