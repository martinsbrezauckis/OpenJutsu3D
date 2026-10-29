import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path"; import { tmpdir } from "node:os"; import { execFileSync } from "node:child_process";
// segments_test.mts — long-shot planning (8k+1 parts ≤ 361 frames, 9-frame overlaps) + crossfade stitch length (ffmpeg).
// Run: node bench/segments_test.mts   (offline; part of `npm test` in web/)
import { dirname } from "node:path"; import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
for (const f of ["llm", "cost", "render", "models"]) writeFileSync(join(scratch, `${f}.ts`), readFileSync(join(web, "lib", `${f}.ts`), "utf8").replace(/from "\.\/(llm|cost|render|models)"/g, 'from "./$1.ts"'));
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "o3j-seg-"));
const r = await import(join(scratch, "render.ts"));
const ok: Record<string, boolean> = {};
for (const sec of [4, 15, 16, 30, 45, 60]) {
  const n = Math.round(sec * 24 / 8) * 8 + 1, segs = r.planSegments(n);
  const valid = segs.every(([s, l]: number[], k: number) => l <= 361 && (l - 1) % 8 === 0 && s % 8 === 0 && (k === 0 ? s === 0 : s === segs[k - 1][0] + segs[k - 1][1] - 9))
    && segs.at(-1)[0] + segs.at(-1)[1] === n;
  ok[`${sec}s n=${n} ${JSON.stringify(segs)}`] = valid;
}
// stitch: 3 synthetic segments (frame-numbered colour clips) → total length n
const id = "00000000-0000-4000-8000-000000000001", d = r.shotDir(id); mkdirSync(d, { recursive: true });
const n = 30 * 24 + 1, segs = r.planSegments(n);
for (const [k, [, len]] of segs.entries())
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${["red", "green", "blue"][k]}:s=320x180:r=24`, "-frames:v", String(len), "-pix_fmt", "yuv420p", join(d, `render_s${k}.mp4`)]);
await r.stitch(id, segs, 24);
const frames = Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", join(d, "render.mp4")]).toString().trim());
ok[`stitch ${frames} frames == ${n}`] = frames === n;
// camera cuts: every usable cut (multiple of 8) starts a part (short shots too), 1-frame overlap; others ignored; no cuts = old plan
const valid = (segs: [number, number][], n: number) => segs.every(([s, l], k) => l <= 361 && (l - 1) % 8 === 0 && (k === 0 ? s === 0 : [1, 9].includes(segs[k - 1][0] + segs[k - 1][1] - s)))
  && segs.at(-1)![0] + segs.at(-1)![1] === n;
for (const [n, cuts, want] of [[385, [192], [[0, 193], [192, 193]]], [385, [100], r.planSegments(385)], [721, [], r.planSegments(721)],
  [721, [48, 96, 144, 192, 240, 288, 336, 384, 432, 480, 528, 576, 624, 672], Array.from({ length: 15 }, (_, k) => [48 * k, 49])],
  [145, [48, 96], [[0, 49], [48, 49], [96, 49]]], [145, [], [[0, 145]]], [145, [36], [[0, 145]]], [769, [24], [[0, 25], [24, 257], [272, 257], [520, 249]]]] as [number, number[], [number, number][]][]) {
  const got = r.planSegments(n, cuts);
  ok[`cuts ${n} [${cuts.slice(0, 3)}${cuts.length > 3 ? "…" : ""}] → ${JSON.stringify(got)}`] = JSON.stringify(got) === JSON.stringify(want) && valid(got, n);
}
// stitch with a hard join: 16 s, cut at frame 192 → red 193 + blue 193 → 385 frames, frame 191 red, frame 192 blue
const id2 = "00000000-0000-4000-8000-000000000002", d2 = r.shotDir(id2); mkdirSync(d2, { recursive: true });
const segs2 = r.planSegments(385, [192]);
for (const [k, [, len]] of segs2.entries())
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${["red", "blue"][k]}:s=320x180:r=24`, "-frames:v", String(len), "-pix_fmt", "yuv420p", join(d2, `render_s${k}.mp4`)]);
await r.stitch(id2, segs2, 24);
const out2 = join(d2, "render.mp4"), count2 = Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", out2]).toString().trim());
const px = (i: number) => [...execFileSync("ffmpeg", ["-v", "error", "-i", out2, "-vf", `select=eq(n\\,${i}),scale=1:1`, "-vsync", "0", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])];
const [a191, b192] = [px(191), px(192)];
ok[`hard join: ${count2} frames == 385, frame 191 red ${a191}, frame 192 blue ${b192}`] = count2 === 385 && a191[0] > 200 && a191[2] < 60 && b192[2] > 200 && b192[0] < 60;
console.log(JSON.stringify(ok, null, 1)); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
