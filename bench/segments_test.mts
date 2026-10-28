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
console.log(JSON.stringify(ok, null, 1)); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
