/**
 * render.ts — clay/lit playblast encoding and the LTX-2.5 Layout-To-Render job (server only).
 *   encodeFrames(dir, fps) — the browser renders the camera move frame by frame (same viewer-core as the bench) and
 *     uploads JPEG frames; ffmpeg turns them into the H.264 clip L2R reads (fps + length come from the clip).
 *   submitL2R(...) — the official two-stage distilled L2R graph (workflows/l2r.api.json, Gemma-API branch removed),
 *     sent through the Comfy SDK: clay video → node 5001, look still → node 9009, prompt → node 5508.
 *     COMFY_BASE_URL = a Comfy deployment, or a local ComfyUI behind comfy-api-proxy (keyless, 127.0.0.1:8189).
 * Data lives under DATA_DIR (default ./data), one folder per shot.
 */
import { Comfy, type Job } from "@comfyorg/sdk";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
export const shotDir = (id: string) => {
  if (!/^[a-z0-9-]{8,64}$/.test(id)) throw new Error("bad shot id");   // ids are ours (uuid); never a path from the client
  return join(DATA_DIR, "shots", id);
};
export async function newShot() { const id = randomUUID(); await mkdir(join(shotDir(id), "clay"), { recursive: true });
  await mkdir(join(shotDir(id), "lit"), { recursive: true }); return id; }

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = ""; p.stderr.on("data", (b) => { err = (err + b).slice(-2000); });
    p.on("error", reject); p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err}`))));
  });
}
/** frames/<mode>/f%05d.jpg → <mode>.mp4 at `fps` (crf 12: the clay is a control signal, keep edges clean). */
export async function encodeFrames(id: string, mode: "clay" | "lit", fps: number) {
  const d = shotDir(id);
  await ffmpeg(["-framerate", String(fps), "-i", join(d, mode, "f%05d.jpg"), "-c:v", "libx264", "-crf", "12",
    "-pix_fmt", "yuv420p", join(d, `${mode}.mp4`)]);
  return join(d, `${mode}.mp4`);
}

/**
 * Long shots (> 15 s): LTX renders up to 361 frames in one piece (15 s at 24 fps; chaining short pieces loses detail,
 * measured 10-18), so a longer clip is cut into segments of ≤ 361 frames that OVERLAP by 9 frames; each gets its own
 * look still and LTX job, and the overlaps are crossfaded in stitch(). Frame counts stay 8k+1 (starts are multiples of 8).
 */
export const SEG_MAX = 361, SEG_OVERLAP = 9;
export function planSegments(n: number): [number, number][] {
  if (n <= SEG_MAX) return [[0, n]];
  // Balanced parts (a 30 s shot = 3 × ~10 s, not 15 + 15 + a 17-frame tail): K parts, step a multiple of 8 (so every part
  // stays 8k+1 frames), each part = step + overlap frames, the last one takes the rest (≤ step + overlap by construction).
  const K = Math.ceil((n - SEG_OVERLAP) / (SEG_MAX - SEG_OVERLAP)), step = 8 * Math.ceil((n - SEG_OVERLAP) / K / 8);
  return Array.from({ length: K }, (_, k): [number, number] => [k * step, k === K - 1 ? n - k * step : step + SEG_OVERLAP]);
}
/** Segment k's clay video from frames [start, start+len). */
export async function encodeSegment(id: string, k: number, start: number, len: number, fps: number) {
  const d = shotDir(id);
  await ffmpeg(["-framerate", String(fps), "-start_number", String(start), "-i", join(d, "clay", "f%05d.jpg"), "-frames:v", String(len),
    "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", join(d, `clay_s${k}.mp4`)]);
}
/** Per-channel mean / std (RGB) of frames [from, from+count) of a video, measured on small copies. */
function channelStats(file: string, from: number, count: number): Promise<{ mean: number[]; std: number[] }> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-v", "error", "-i", file, "-vf", `select=between(n\\,${from}\\,${from + count - 1}),scale=160:-2`, "-vsync", "0",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { stdio: ["ignore", "pipe", "pipe"] });
    const s = [0, 0, 0], q = [0, 0, 0]; let n = 0, rest = Buffer.alloc(0);
    p.stdout.on("data", (b: Buffer) => {
      const buf = Buffer.concat([rest, b]); const full = buf.length - (buf.length % 3);
      for (let i = 0; i < full; i += 3) for (let c = 0; c < 3; c++) { const v = buf[i + c]; s[c] += v; q[c] += v * v; }
      n += full / 3; rest = buf.subarray(full);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0 || !n) return reject(new Error("could not measure colours for stitching"));
      const mean = s.map((x) => x / n); resolve({ mean, std: q.map((x, c) => Math.sqrt(Math.max(1, x / n - mean[c] ** 2))) });
    });
  });
}
/**
 * Crossfade the segments' renders (overlap = SEG_OVERLAP frames) into render.mp4. Each segment is first colour-matched
 * to the previous one over their shared frames (per-channel level + contrast; the image model never matches a look
 * exactly — measured 10-29: part 2 of a 16 s shot came out cooler and ~15% darker), so the crossfade joins equal looks.
 */
export async function stitch(id: string, segs: [number, number][], fps: number) {
  const d = shotDir(id), ov = SEG_OVERLAP / fps;
  const files = [join(d, "render_s0.mp4")];
  for (let k = 1; k < segs.length; k++) {
    const prev = files[k - 1], cur = join(d, `render_s${k}.mp4`), out = join(d, `render_s${k}_matched.mp4`);
    const a = await channelStats(prev, segs[k - 1][1] - SEG_OVERLAP, SEG_OVERLAP), b = await channelStats(cur, 0, SEG_OVERLAP);
    const lut = ["r", "g", "b"].map((ch, c) => {
      const gain = Math.min(1.4, Math.max(0.7, a.std[c] / b.std[c])), off = a.mean[c] - gain * b.mean[c];
      return `${ch}='clip(val*${gain.toFixed(4)}+${off.toFixed(2)},0,255)'`;
    }).join(":");
    await ffmpeg(["-i", cur, "-vf", `lutrgb=${lut}`, "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", out]);
    files.push(out);
  }
  const inputs = files.flatMap((f) => ["-i", f]);
  let chain = "", prev = "[0:v]", t = segs[0][1] / fps;
  for (let k = 1; k < segs.length; k++) {
    const out = k === segs.length - 1 ? "[v]" : `[x${k}]`;
    chain += `${prev}[${k}:v]xfade=transition=fade:duration=${ov}:offset=${(t - ov).toFixed(4)}${out};`;
    prev = out; t += segs[k][1] / fps - ov;
  }
  await ffmpeg([...inputs, "-filter_complex", chain.replace(/;$/, ""), "-map", "[v]", "-r", String(fps), "-c:v", "libx264", "-crf", "16",
    "-pix_fmt", "yuv420p", join(d, "render.mp4")]);
}
/** One rendered frame of segment k (PNG bytes): the style reference for segment k+1's look still. */
export async function segmentFrame(id: string, k: number, frame: number): Promise<Uint8Array> {
  const d = shotDir(id), out = join(d, `style_s${k + 1}.png`);
  await ffmpeg(["-i", join(d, `render_s${k}.mp4`), "-vf", `select=eq(n\\,${frame})`, "-frames:v", "1", out]);
  return new Uint8Array(await readFile(out));
}

function client() {
  const apiKey = process.env.COMFY_API_KEY?.trim() || undefined;
  return new Comfy({ apiKey, clientInfo: "open-3d-jutsu" });   // baseUrl from COMFY_BASE_URL (SDK reads it)
}
type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;
export const NODE = { clay: "5001", look: "9009", prompt: "5508" } as const;

/** seg = segment index of a long shot (files clay_s<k>.mp4 / look_s<k>.png / job_s<k>.json); undefined = one-piece shot. */
export async function submitL2R(id: string, prompt: string, seg?: number): Promise<{ jobId: string; status: string }> {
  const api = client(), d = shotDir(id), sfx = seg === undefined ? "" : `_s${seg}`;
  const template = JSON.parse(await readFile(join(process.cwd(), "workflows", "l2r.api.json"), "utf8")) as Graph;
  const g: Graph = structuredClone(template);
  // Unique asset names per shot: a shared ComfyUI input folder overwrites by basename (found 10-18).
  g[NODE.clay].inputs.file = await api.assets.fromBytes(new Uint8Array(await readFile(join(d, `clay${sfx}.mp4`))),
    { filename: `${id}${sfx}_clay.mp4`, contentType: "video/mp4" });
  g[NODE.look].inputs.image = await api.assets.fromBytes(new Uint8Array(await readFile(join(d, `look${sfx}.png`))),
    { filename: `${id}${sfx}_look.png`, contentType: "image/png" });
  g[NODE.prompt].inputs.value = prompt;
  const job: Job = await api.submit(api.workflows.fromJson(g));
  await writeFile(join(d, `job${sfx}.json`), JSON.stringify({ jobId: job.id, prompt, submitted: new Date().toISOString() }));
  return { jobId: job.id, status: job.status };
}

export async function jobState(jobId: string) {
  const job = await client().jobs.get(jobId);
  return { id: job.id, status: job.status, error: job.error, outputs: job.outputs.map((o) => ({ id: o.id, name: o.name, type: o.type })) };
}
/** Download the finished video into the shot folder once, then serve it from disk. */
export async function fetchResult(id: string, jobId: string, seg?: number): Promise<string> {
  const out = join(shotDir(id), seg === undefined ? "render.mp4" : `render_s${seg}.mp4`);
  const job = await client().jobs.get(jobId);
  // ComfyUI also reports the LoadVideo node's preview of our INPUT clay as an output (node 5001, same filename as the
  // upload) — taking "the first video" returned the clay instead of the render (E2E 10-28). Take the SaveVideo
  // node's file: a video output that is not our uploaded clay.
  const videos = job.outputs.filter((x) => /video|mp4/i.test(`${x.type} ${x.name}`));
  const o = videos.find((x) => !(x.name.includes(id) && x.name.includes("_clay")));
  if (!o) throw new Error(`job has no render output (outputs: ${job.outputs.map((x) => x.name).join(", ")})`);
  const { url } = await o.getDownloadUrl();
  const res = await fetch(url); if (!res.ok) throw new Error(`download ${res.status}`);
  await writeFile(out, new Uint8Array(await res.arrayBuffer()));
  return out;
}
