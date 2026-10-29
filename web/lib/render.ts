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
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
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
function overlapParts(a: number, n: number): [number, number][] {
  if (n <= SEG_MAX) return [[a, n]];
  // Balanced parts (a 30 s shot = 3 × ~10 s, not 15 + 15 + a 17-frame tail): K parts, step a multiple of 8 (so every part
  // stays 8k+1 frames), each part = step + overlap frames, the last one takes the rest (≤ step + overlap by construction).
  const K = Math.ceil((n - SEG_OVERLAP) / (SEG_MAX - SEG_OVERLAP)), step = 8 * Math.ceil((n - SEG_OVERLAP) / K / 8);
  return Array.from({ length: K }, (_, k): [number, number] => [a + k * step, k === K - 1 ? n - k * step : step + SEG_OVERLAP]);
}
/**
 * `cuts` = frames where the shot cuts to another camera (the first frame of the new camera). Every usable cut starts
 * a part of its own, in short shots too: each camera then gets its own look still (one look still for the first
 * camera left the later cameras' people as grey mannequins, 10-29), and no crossfade blends two cameras. The part
 * before a cut ends one frame after it (8k+1 frames needs it) and the next part starts at the cut — a 1-frame overlap,
 * joined in stitch() as a hard cut that drops that extra frame. Usable cuts are multiples of 8 (whole seconds at
 * 24 fps); other cuts stay inside a part. Parts longer than 361 frames overlap and crossfade as before; without usable
 * cuts the plan is exactly the old one.
 */
export function planSegments(n: number, cuts: number[] = []): [number, number][] {
  const hard = [...new Set(cuts)].filter((c) => Number.isInteger(c) && c > 0 && c < n - 1 && c % 8 === 0).sort((x, y) => x - y);
  const out: [number, number][] = []; let a = 0;
  for (const c of hard) { out.push(...overlapParts(a, c - a + 1)); a = c; }
  out.push(...overlapParts(a, n - a));
  return out;
}
/** Valid cut frames from a request body (the client sends the viewer plan's cut frames). */
export const cutFrames = (x: unknown, n: number) => (Array.isArray(x) ? x.slice(0, 200).filter((c) => Number.isInteger(c) && c > 0 && c < n) as number[] : []);
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
 * A 1-frame overlap is a boundary on a camera cut (planSegments): the earlier part's last frame is dropped and the
 * parts are joined as a hard cut, not colour-matched (the two sides show different views).
 */
export async function stitch(id: string, segs: [number, number][], fps: number) {
  const d = shotDir(id), ov = SEG_OVERLAP / fps;
  const files = [join(d, "render_s0.mp4")];
  const hardAt = (k: number) => segs[k - 1][0] + segs[k - 1][1] - segs[k][0] === 1;   // join k (before segment k) is a cut
  for (let k = 1; k < segs.length; k++) {
    const prev = files[k - 1], cur = join(d, `render_s${k}.mp4`), out = join(d, `render_s${k}_matched.mp4`);
    if (hardAt(k)) { files.push(cur); continue; }
    const a = await channelStats(prev, segs[k - 1][1] - SEG_OVERLAP, SEG_OVERLAP), b = await channelStats(cur, 0, SEG_OVERLAP);
    const lut = ["r", "g", "b"].map((ch, c) => {
      const gain = Math.min(1.4, Math.max(0.7, a.std[c] / b.std[c])), off = a.mean[c] - gain * b.mean[c];
      return `${ch}='clip(val*${gain.toFixed(4)}+${off.toFixed(2)},0,255)'`;
    }).join(":");
    await ffmpeg(["-i", cur, "-vf", `lutrgb=${lut}`, "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", out]);
    files.push(out);
  }
  const inputs = files.flatMap((f) => ["-i", f]);
  // a part before a hard join loses its last frame (the cut frame, rendered again as the next part's first)
  const len = segs.map(([, l], k) => (k + 1 < segs.length && hardAt(k + 1) ? l - 1 : l));
  let chain = segs.map((_, k) => `[${k}:v]trim=end_frame=${len[k]},setpts=PTS-STARTPTS[p${k}];`).join(""), prev = "[p0]", t = len[0] / fps;
  for (let k = 1; k < segs.length; k++) {
    const out = k === segs.length - 1 ? "[v]" : `[x${k}]`;
    chain += hardAt(k) ? `${prev}[p${k}]concat=n=2:v=1:a=0${out};` : `${prev}[p${k}]xfade=transition=fade:duration=${ov}:offset=${(t - ov).toFixed(4)}${out};`;
    prev = out; t += len[k] / fps - (hardAt(k) ? 0 : ov);
  }
  await ffmpeg([...inputs, "-filter_complex", chain.replace(/;$/, ""), "-map", "[v]", "-r", String(fps), "-c:v", "libx264", "-crf", "16",
    "-pix_fmt", "yuv420p", join(d, "render.mp4")]);
}
/** Frame count, rate and size of a video's first stream (packets counted: the mp4 header's nb_frames can be absent). */
export function probeVideo(file: string): Promise<{ w: number; h: number; n: number; fps: string; secs: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", ["-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries",
      "stream=width,height,r_frame_rate,nb_read_packets:format=duration", "-of", "json", file], { stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; p.stdout.on("data", (b) => { out += b; }); p.on("error", reject);
    p.on("close", (c) => {
      try { if (c !== 0) throw new Error(`ffprobe ${c}`); const j = JSON.parse(out), s = j.streams[0];
        resolve({ w: s.width, h: s.height, n: Number(s.nb_read_packets), fps: s.r_frame_rate, secs: Number(j.format.duration) }); }
      catch (e) { reject(e); }
    });
  });
}
/**
 * 48 fps copy of a finished render (render.mp4 → render48.mp4; the 24 fps original is kept), 2n−1 frames at 48/1:
 * frame i of the original = frame 2i of the copy (the timing of RIFE / LTX temporal x2). Two ways, best first:
 *  1. ComfyUI's core frame interpolation (FrameInterpolate, RIFE/FILM) on the connected ComfyUI, when it offers a model
 *     (seconds on a GPU). Availability is asked by a PROBE: interpGraph with a video and a model name that cannot exist
 *     is submitted; ComfyUI validates before queueing and answers 422 either "Node 'FrameInterpolate' not found" or
 *     "model_name not in [<the installed models>]" — the probe never runs, and the answer lists the models. (The v2
 *     API / comfy-api-proxy has no /object_info, so asking is the portable check.)
 *  2. ffmpeg minterpolate (mci) on the app server — no GPU, no model; within ~1.7 dB PSNR of RIFE 4.25 on real renders
 *     (10-29, every 2nd frame dropped and rebuilt), ~0.23 s per output frame at 1920×1088 on one core.
 * Any ComfyUI failure falls back to 2. render48.json records {method, model?, ms, why?, fixed?}. Written under a temp
 * name and renamed (a half-written copy is never served); one job per shot; a copy older than render.mp4 is made again.
 */
export const INTERP_NODE = { load: "1", parts: "2", model: "3", interp: "4", video: "5", save: "6" } as const;
export function interpGraph(file: unknown, model: string, prefix: string): Graph {
  const N = INTERP_NODE;
  return {
    [N.load]: { class_type: "LoadVideo", inputs: { file } },
    [N.parts]: { class_type: "GetVideoComponents", inputs: { video: [N.load, 0] } },
    [N.model]: { class_type: "FrameInterpolationModelLoader", inputs: { model_name: model } },
    [N.interp]: { class_type: "FrameInterpolate", inputs: { interp_model: [N.model, 0], images: [N.parts, 0], multiplier: 2 } },
    [N.video]: { class_type: "CreateVideo", inputs: { images: [N.interp, 0], fps: 48, audio: [N.parts, 1] } },   // source audio, if any
    [N.save]: { class_type: "SaveVideo", inputs: { video: [N.video, 0], filename_prefix: prefix, format: "auto", "format.codec": "auto" } },
  };
}
/** The models ComfyUI listed for the probe's model loader; null = no answer about it (node missing, other error). */
export function interpOptions(err: unknown): string[] | null {
  type E = { details?: string; extra_info?: { input_name?: string; input_config?: unknown[] } };
  const ne = (err as { details?: { node_errors?: Record<string, { errors?: E[] }> } } | null)?.details?.node_errors?.[INTERP_NODE.model];
  const e = ne?.errors?.find((x) => x.extra_info?.input_name === "model_name");
  if (!e) return null;
  const cfg = e.extra_info?.input_config, opts = Array.isArray(cfg?.[0]) ? cfg[0] : (cfg?.[1] as { options?: unknown } | undefined)?.options;
  if (Array.isArray(opts)) return opts.map(String);
  const m = /not in \[(.*)\]/.exec(e.details ?? ""); return m ? Array.from(m[1].matchAll(/'([^']*)'/g), (x) => x[1]) : null;
}
export const pickInterpModel = (opts: string[]) => opts.find((o) => /rife/i.test(o)) ?? opts[0] ?? null;
const PROBE = "__o3j_probe__";
let probed: { at: number; model: string | null; why: string } | null = null;
/** The ComfyUI frame-interpolation model to use, or null + why not. Definite answers are kept 10 min. */
export async function interpModel(): Promise<{ model: string | null; why: string }> {
  if (process.env.O3J_INTERP === "ffmpeg") return { model: null, why: "O3J_INTERP=ffmpeg" };
  if (probed && Date.now() - probed.at < 600_000) return probed;
  const api = client();
  try {
    const j = await api.submit(api.workflows.fromJson(interpGraph(`${PROBE}.mp4`, PROBE, `o3j48/${PROBE}`)));
    await j.cancel().catch(() => {});   // cannot validate (no such video or model); cancel if a surface queued it anyway
    return { model: null, why: "the ComfyUI probe was not rejected" };
  } catch (e) {
    const opts = interpOptions(e), msg = String((e as Error)?.message ?? e).slice(0, 200), model = opts && pickInterpModel(opts);
    const r = { model: model ?? null, why: model ? `ComfyUI model ${model}` : opts ? "ComfyUI has no frame interpolation model" : `ComfyUI: ${msg}` };
    if (opts || (e as { code?: string })?.code === "invalid_workflow") probed = { at: Date.now(), ...r };   // not a network hiccup
    return r;
  }
}
/** RIFE in ComfyUI → raw (downloaded) file. Only THIS job's SaveVideo output with this job's prefix counts. */
async function interpComfy(id: string, src: string, model: string, raw: string) {
  const api = client(), tag = `${id}_${randomUUID().slice(0, 8)}`;
  const file = await api.assets.fromBytes(new Uint8Array(await readFile(src)), { filename: `${id}_render.mp4`, contentType: "video/mp4" });
  const job = await api.submit(api.workflows.fromJson(interpGraph(file, model, `o3j48/${tag}`)));
  const waitMin = Number(process.env.O3J_INTERP_WAIT_MIN) || 40;   // the queue may hold a 25 min LTX render
  try { await job.wait(waitMin * 60_000); } catch (e) { await job.cancel().catch(() => {}); throw e; }
  if (job.status !== "succeeded") throw new Error(`ComfyUI job ${job.status}${job.error ? `: ${JSON.stringify(job.error).slice(0, 200)}` : ""}`);
  const o = job.getOutputs(INTERP_NODE.save).find((x) => x.name.includes(tag));
  if (!o) throw new Error(`ComfyUI job has no output named ${tag} (${job.outputs.map((x) => x.name).join(", ")})`);
  await o.toFile(raw);
}
export type Made48 = { file: string; method: "comfy" | "ffmpeg" | "unknown"; model?: string; ms?: number; why?: string; fixed?: string; cuts?: number };
const making48 = new Map<string, Promise<Made48>>();
/** `cuts` = camera-cut frames of the 24 fps render: the in-between frame at a cut (2c−1) would blend two cameras, so it
 *  is dropped and cfr refills the gap with a neighbour (the cut lands up to 1/48 s early; the count stays 2n−1). */
export function make48(id: string, cuts: number[] = []): Promise<Made48> {
  const d = shotDir(id), out = join(d, "render48.mp4"), meta = join(d, "render48.json");
  if (making48.has(id)) return making48.get(id)!;   // one job per shot (a second call joins it)
  const job = (async (): Promise<Made48> => {
    const src = join(d, "render.mp4"), tmp = join(d, "render48.part.mp4"), raw = join(d, "render48.comfy.mp4");
    const mtime = (f: string) => stat(f).then((x) => x.mtimeMs, () => -1);
    const [ts, to] = await Promise.all([mtime(src), mtime(out)]);
    if (ts < 0) throw new Error("the shot has no finished render yet");
    if (to >= ts) return { method: "unknown", ...JSON.parse(await readFile(meta, "utf8").catch(() => "{}")), file: out };
    const { n, w, h } = await probeVideo(src); if (!(n >= 2)) throw new Error("the render has no frames to interpolate");
    const t0 = Date.now(); let r: Omit<Made48, "file" | "ms"> | null = null, why: string;
    // fp32 frames in ComfyUI's RAM: n in + 2n−1 out (+ the encode); long shots stay on ffmpeg
    const gb = ((3 * n - 1) * w * h * 12) / 1e9, maxGb = Number(process.env.O3J_INTERP_MAX_GB) || 16;
    const pick = gb > maxGb ? { model: null, why: `${gb.toFixed(0)} GB of frames > ${maxGb} GB for ComfyUI` } : await interpModel();
    why = pick.why;
    if (pick.model) try {
      await interpComfy(id, src, pick.model, raw);
      const p = await probeVideo(raw);
      if (p.w !== w || p.h !== h) throw new Error(`ComfyUI output is ${p.w}x${p.h}, not ${w}x${h}`);
      // exact 2n−1 frames at 48/1 (pad by cloning / cut); otherwise a stream copy just moves the index to the front
      const exact = p.n === 2 * n - 1 && p.fps === "48/1", fixed = exact ? undefined : `${p.n} f at ${p.fps} → ${2 * n - 1} f at 48/1`;
      await ffmpeg(exact ? ["-i", raw, "-map", "0", "-c", "copy", "-movflags", "+faststart", "-f", "mp4", tmp]
        : ["-i", raw, "-vf", "fps=48,tpad=stop_mode=clone:stop=2", "-frames:v", String(2 * n - 1), "-c:v", "libx264", "-crf", "16",
          "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-f", "mp4", tmp]);
      r = { method: "comfy", model: pick.model, ...(fixed ? { fixed } : {}) };
    } catch (e) { why = `ComfyUI failed, used ffmpeg: ${String((e as Error)?.message ?? e).slice(0, 300)}`; }
    finally { await rm(raw, { force: true }); }
    if (!r) {
      await ffmpeg(["-i", src, "-vf", "tpad=stop_mode=clone:stop=2,minterpolate=fps=48:mi_mode=mci", "-frames:v", String(2 * n - 1),
        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-f", "mp4", tmp]);
      r = { method: "ffmpeg", why };
    }
    const hard = cutFrames(cuts, n);
    if (hard.length) {
      const held = join(d, "render48.cut.mp4");
      await ffmpeg(["-i", tmp, "-vf", `select='not(${hard.map((c) => `eq(n\,${2 * c - 1})`).join("+")})'`, "-fps_mode", "cfr", "-r", "48",
        "-frames:v", String(2 * n - 1), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-f", "mp4", held]);
      await rename(held, tmp); r = { ...r, cuts: hard.length };
    }
    const made = { ...r, ms: Date.now() - t0 };
    await writeFile(meta, JSON.stringify(made)); await rename(tmp, out);   // meta first: render48.mp4 never shows stale meta
    return { ...made, file: out };
  })().finally(() => making48.delete(id));
  making48.set(id, job);
  return job;
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
  // node's file: a video output that is not an uploaded clay. Not only THIS shot's clay: an identical clay (same set,
  // camera and move) is de-duplicated to the earlier shot's file name, and that one came back as "the render" (10-29).
  const videos = job.outputs.filter((x) => /video|mp4/i.test(`${x.type} ${x.name}`));
  const o = videos.find((x) => /^output/i.test(x.name)) ?? videos.find((x) => !/_clay(_s\d+)?\.mp4$/i.test(x.name));
  if (!o) throw new Error(`job has no render output (outputs: ${job.outputs.map((x) => x.name).join(", ")})`);
  const { url } = await o.getDownloadUrl();
  const res = await fetch(url); if (!res.ok) throw new Error(`download ${res.status}`);
  await writeFile(out, new Uint8Array(await res.arrayBuffer()));
  return out;
}
