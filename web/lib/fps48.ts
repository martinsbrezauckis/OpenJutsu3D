/**
 * fps48.ts — when a shot gets a 48 fps copy (pure; client + server + bench).
 * A fast camera move judders at 24 fps; such shots are delivered at 48 fps. "Fast" is MEASURED on the shot's
 * own camera path (the viewer's planShot states, so path keyframes and wall avoidance count), not looked up by move
 * name: whip-pan over 15 s is slow, an arc over 1 s is fast.
 * Measure = image speed: probe points spread over the frame at three depths (half the subject distance, the subject,
 * 8× further) are projected through the camera at frame i and i+1; their mean on-screen travel in frame heights is
 * the motion of that frame. FAST_MOTION is the peak (3-frame mean) above which a shot is fast; calibrated over every
 * preset at 1–15 s (bench/fps48_test.mts prints the table).
 */
export type CamState = { pos: number[]; lookAt: number[]; fov: number; roll?: number; cut?: boolean };
export const FAST_MOTION = 0.011;   // frame heights per 24 fps frame: a 16:9 width crossed in < 6.7 s (the "7-second" pan-judder rule)

const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]), dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function basis(s: CamState) {
  const f = norm(sub(s.lookAt, s.pos)); let r = norm(cross(f, [0, 1, 0])); let u = cross(r, f);
  const c = Math.cos(s.roll ?? 0), n = Math.sin(s.roll ?? 0);
  [r, u] = [r.map((x, i) => x * c + u[i] * n), u.map((x, i) => u[i] * c - x * n)];
  return { f, r, u, t: Math.tan((s.fov * Math.PI) / 360) };
}
/** Per-frame image motion (frame heights) between consecutive states. A camera cut (states[i+1].cut) is not motion: 0. */
export function frameMotion(states: CamState[], aspect = 16 / 9): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < states.length; i++) {
    if (states[i + 1].cut) { out.push(0); continue; }
    const a = basis(states[i]), b = basis(states[i + 1]), d = Math.hypot(...sub(states[i].lookAt, states[i].pos)) || 1;
    let sum = 0, cnt = 0;
    for (const z of [0.5 * d, d, 8 * d]) for (const sx of [-0.8, 0, 0.8]) for (const sy of [-0.8, 0, 0.8]) {
      // the point seen at screen (sx, sy) of camera a at depth z, then where camera b sees it
      const p = states[i].pos.map((x, k) => x + z * (a.f[k] + sx * aspect * a.t * a.r[k] + sy * a.t * a.u[k]));
      const q = sub(p, states[i + 1].pos), zb = dot(q, b.f);
      if (zb <= 0.05 * d) { sum += 2; cnt++; continue; }   // went behind the camera: as far as it can move
      const bx = dot(q, b.r) / (zb * b.t * aspect), by = dot(q, b.u) / (zb * b.t);
      sum += Math.min(2, Math.hypot((bx - sx) * aspect, by - sy) / 2); cnt++;   // NDC/2 = frame heights
    }
    out.push(sum / cnt);
  }
  return out;
}
/** Peak of the 3-frame running mean (one odd frame does not make a shot fast). */
export function peakMotion(states: CamState[], aspect = 16 / 9): number {
  const m = frameMotion(states, aspect); let peak = 0;
  for (let i = 0; i < m.length; i++) { const w = m.slice(Math.max(0, i - 1), i + 2); peak = Math.max(peak, w.reduce((s, x) => s + x, 0) / w.length); }
  return peak;
}
export const isFast = (states: CamState[], aspect = 16 / 9) => peakMotion(states, aspect) > FAST_MOTION;
