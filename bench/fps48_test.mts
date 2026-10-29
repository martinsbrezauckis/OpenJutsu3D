// fps48_test.mts — 48 fps copies: which camera moves count as fast (lib/fps48.ts on the real camera-moves.js paths) +
// the server stage (render.ts make48) on a tiny synthetic clip: 2n−1 frames at 48 fps, same size, original kept.
// Run: node bench/fps48_test.mts [--table]   (offline; part of `npm test` in web/; --table prints the calibration)
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, existsSync, statSync, utimesSync } from "node:fs";
import { join, dirname } from "node:path"; import { tmpdir } from "node:os"; import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), web = join(here, "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
const cm = await import(join(here, "..", "spike", "scenekit", "camera-moves.js"));
const f = await import(join(web, "lib", "fps48.ts"));
const start = { pos: [0, 1.6, 6], lookAt: [0, 1.2, 0], fov: 45 };
const peak = (recipe: string, sec: number) => f.peakMotion(cm.pathStates(recipe, start, Math.round(sec * 24 / 8) * 8 + 1, 24));
if (process.argv.includes("--table")) for (const m of cm.MOVES.filter((m: string) => m !== "path"))
  console.log(m.padEnd(16), [1, 2, 4, 6, 10, 15].map((s) => peak(`${m}:${s}`, s).toFixed(4)).join("  "));
const ok: Record<string, boolean> = {};
for (const [r, s] of [["whip-pan:4", 4], ["crush-zoom:4", 4], ["robot-arm:4", 4], ["bullet-time:4", 4], ["drone-orbit:4", 4], ["arc-left:1", 1], ["dolly-in:2+whip-pan:1", 3]] as const)
  ok[`fast ${r} (${peak(r, s).toFixed(4)})`] = peak(r, s) > f.FAST_MOTION;
for (const [r, s] of [["dolly-in:4", 4], ["dolly-in:5", 5], ["arc-left:6", 6], ["slow-zoom-in:4", 4], ["pan-left:15", 15], ["static-shot:4", 4], ["crane-up:6", 6]] as const)
  ok[`slow ${r} (${peak(r, s).toFixed(4)})`] = peak(r, s) <= f.FAST_MOTION;

// server stage on a 25-frame 24 fps clip — offline: ComfyUI forced off first, then an endpoint that refuses connections
for (const x of ["llm", "cost", "render", "models"]) writeFileSync(join(scratch, `${x}.ts`), readFileSync(join(web, "lib", `${x}.ts`), "utf8").replace(/from "\.\/(llm|cost|render|models)"/g, 'from "./$1.ts"'));
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "o3j-fps48-")); process.env.O3J_INTERP = "ffmpeg";
const r = await import(join(scratch, "render.ts"));
// ComfyUI's answers to the probe graph (captured 10-29 through comfy-api-proxy): model listed / none / node missing
const listed = { details: { node_errors: { "1": { errors: [{ type: "custom_validation_failed", extra_info: { input_name: "file" } }] },
  "3": { errors: [{ type: "value_not_in_list", details: "model_name: '__o3j_probe__' not in ['film_net.pt', 'rife425.safetensors']",
    extra_info: { input_name: "model_name", input_config: ["COMBO", { options: ["film_net.pt", "rife425.safetensors"] }] } }] } } } };
const none = { details: { node_errors: { "3": { errors: [{ details: "model_name: 'x' not in []", extra_info: { input_name: "model_name", input_config: ["COMBO", { options: [] }] } }] } } } };
const textOnly = { details: { node_errors: { "3": { errors: [{ details: "model_name: 'x' not in ['a.pth', 'RIFE49.pth']", extra_info: { input_name: "model_name" } }] } } } };
const missing = { code: "invalid_workflow", message: "Node 'FrameInterpolate' not found. The custom node may not be installed.", details: { node_errors: {} } };
ok["probe answer → models, RIFE preferred"] = r.pickInterpModel(r.interpOptions(listed)) === "rife425.safetensors" && r.pickInterpModel(r.interpOptions(textOnly)) === "RIFE49.pth";
ok["probe answer → no model / node missing → ffmpeg"] = r.pickInterpModel(r.interpOptions(none)) === null && r.interpOptions(missing) === null && r.interpOptions(new Error("fetch failed")) === null;
ok["first model when none is RIFE"] = r.pickInterpModel(["film_net.pt", "x.pt"]) === "film_net.pt";
const g = r.interpGraph("in.mp4", "m.safetensors", "o3j48/t"), N = r.INTERP_NODE;
ok["graph: LoadVideo → components → RIFE x2 → 48 fps video (+ audio) → SaveVideo"] = g[N.load].class_type === "LoadVideo"
  && g[N.interp].inputs.multiplier === 2 && JSON.stringify(g[N.interp].inputs.images) === JSON.stringify([N.parts, 0])
  && g[N.video].inputs.fps === 48 && JSON.stringify(g[N.video].inputs.audio) === JSON.stringify([N.parts, 1])
  && g[N.save].class_type === "SaveVideo" && g[N.save].inputs.filename_prefix === "o3j48/t" && g[N.model].inputs.model_name === "m.safetensors";

const id = "00000000-0000-4000-8000-000000000048", d = r.shotDir(id); mkdirSync(d, { recursive: true });
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=192x108:rate=24", "-frames:v", "25", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(d, "render.mp4")]);
const [a, b] = await Promise.all([r.make48(id), r.make48(id)]);   // a second call joins the running job
const p = await r.probeVideo(a.file), src = await r.probeVideo(join(d, "render.mp4"));
ok[`make48 → 49 frames @48, 192x108, ${p.secs.toFixed(3)} s (${p.n} f, ${p.fps})`] = p.n === 49 && p.fps === "48/1" && p.w === 192 && p.h === 108 && Math.abs(p.secs - src.secs) < 0.05;
ok["one job for two calls, original kept, no temp left"] = a === b && existsSync(join(d, "render.mp4")) && !existsSync(join(d, "render48.part.mp4"));
const meta = JSON.parse(readFileSync(join(d, "render48.json"), "utf8"));
ok[`method recorded: ${JSON.stringify(meta)}`] = a.method === "ffmpeg" && meta.method === "ffmpeg" && meta.why === "O3J_INTERP=ffmpeg" && meta.ms >= 0;
const m0 = statSync(a.file).mtimeMs, again = await r.make48(id); const kept = statSync(a.file).mtimeMs === m0 && again.method === "ffmpeg";
const later = new Date(Date.now() + 5000); utimesSync(join(d, "render.mp4"), later, later); await r.make48(id);
ok["kept while current (method read back), made again after render.mp4 changed"] = kept && statSync(a.file).mtimeMs > m0;
ok["no render → clear error"] = await r.make48("00000000-0000-4000-8000-000000000049").then(() => false, (e: Error) => /no finished render/.test(e.message));
// a shot too big for ComfyUI's RAM stays on ffmpeg without asking ComfyUI
delete process.env.O3J_INTERP; process.env.O3J_INTERP_MAX_GB = "0.0001"; utimesSync(join(d, "render.mp4"), new Date(Date.now() + 7000), new Date(Date.now() + 7000));
const big = await r.make48(id); delete process.env.O3J_INTERP_MAX_GB;
ok[`too big for ComfyUI → ffmpeg (${big.why})`] = big.method === "ffmpeg" && /GB of frames/.test(big.why ?? "");
// ComfyUI unreachable → ffmpeg, and the reason is recorded
delete process.env.O3J_INTERP; process.env.COMFY_BASE_URL = "http://127.0.0.1:9"; utimesSync(join(d, "render.mp4"), new Date(Date.now() + 9000), new Date(Date.now() + 9000));
const t0 = Date.now(), down = await r.make48(id);
ok[`ComfyUI unreachable → ffmpeg in ${((Date.now() - t0) / 1000).toFixed(1)} s (${down.why})`] = down.method === "ffmpeg" && /^ComfyUI/.test(down.why ?? "");

let bad = 0; for (const [k, v] of Object.entries(ok)) { console.log(v ? "PASS" : "FAIL", k); if (!v) bad++; }
console.log(bad ? `fps48_test: ${bad} FAILED` : "fps48_test: all passed"); process.exit(bad ? 1 : 0);
