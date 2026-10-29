// cuts_test.mts — camera cuts inside one shot: recipe "move:seconds[@CAM_x]" parsing, the per-frame camera choice of
// pathStates (hard cut to the other camera's pose at the segment's first frame, continuous inside a camera's run, old
// recipes unchanged), the render prompt's "cut to …" sentence, 48 fps motion ignoring cuts, chat phrases with cameras.
// Run: node bench/cuts_test.mts   (offline; part of `npm test` in web/)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), web = join(here, "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
const cm = await import(join(here, "..", "spike", "scenekit", "camera-moves.js"));
const pc = await import(join(here, "..", "spike", "scenekit", "prompt-compiler.js"));
const f48 = await import(join(web, "lib", "fps48.ts"));
writeFileSync(join(scratch, "shot-intent.ts"), readFileSync(join(web, "lib", "shot-intent.ts"), "utf8"));
const { shotIntent } = await import(join(scratch, "shot-intent.ts"));
const ok: Record<string, boolean> = {};
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]));
const near = (a: number[], b: number[], e = 1e-6) => dist(a, b) < e;

// --- parsing ---
const segs = cm.parseRecipe("dolly-in:2@CAM_main+arc-left:2:1.5@CAM_table+static-shot:2");
ok["parse cams"] = JSON.stringify(segs) === JSON.stringify([{ move: "dolly-in", seconds: 2, amount: 1, cam: "CAM_main" },
  { move: "arc-left", seconds: 2, amount: 1.5, cam: "CAM_table" }, { move: "static-shot", seconds: 2, amount: 1 }]);
ok["segmentString round trip"] = segs.map(cm.segmentString).join("+") === "dolly-in:2@CAM_main+arc-left:2:1.5@CAM_table+static-shot:2";
let threw = false; try { cm.parseRecipe("dolly-in:2@main;alert(1)"); } catch { threw = true; }
ok["bad camera name refused"] = threw;
ok["old recipe parses as before (no cam key)"] = JSON.stringify(cm.parseRecipe("dolly-in:4+arc-left:6:2.5")) === JSON.stringify([{ move: "dolly-in", seconds: 4, amount: 1 }, { move: "arc-left", seconds: 6, amount: 2.5 }]);

// --- per-frame camera ---
const CAMS: Record<string, { pos: number[]; lookAt: number[]; fov: number }> = {
  CAM_main: { pos: [0, 1.6, 6], lookAt: [0, 1.2, 0], fov: 45 },
  CAM_table: { pos: [3, 1.2, 1], lookAt: [1, 0.8, -1], fov: 35 },
  CAM_barrels: { pos: [-4, 2, -2], lookAt: [-1, 0.5, -3], fov: 50 },
};
const cams = { shot: "CAM_main", at: (n: string) => CAMS[n] ?? null };
const fps = 24, n = 6 * fps + 1;   // 3 × 2 s
const p = cm.pathStates("dolly-in:2+static-shot:2@CAM_table+arc-left:2@CAM_barrels", CAMS.CAM_main, n, fps, 0.6, cams);
const cutsAt = p.map((s: any, i: number) => (s.cut ? i : -1)).filter((i: number) => i >= 0);
ok[`cuts land on frames 48 and 96 (${cutsAt})`] = JSON.stringify(cutsAt) === "[48,96]";
ok["frames 0-47 main, 48-95 table, 96-144 barrels"] = p.every((s: any, i: number) => s.cam === (i < 48 ? "CAM_main" : i < 96 ? "CAM_table" : "CAM_barrels"));
ok["cut frame = the new camera's own pose (static)"] = near(p[48].pos, CAMS.CAM_table.pos) && near(p[48].lookAt, CAMS.CAM_table.lookAt) && p[48].fov === 35;
ok["arc after cut starts at barrels pose"] = dist(p[96].pos, CAMS.CAM_barrels.pos) < 0.01;
const steps = p.slice(1).map((s: any, i: number) => (s.cut ? null : dist(s.pos, p[i].pos))).filter((x: number | null) => x !== null) as number[];
const jumps = [48, 96].map((i) => dist(p[i].pos, p[i - 1].pos));
ok[`continuous inside a camera (max step ${Math.max(...steps).toFixed(3)} m) vs cut jumps ${jumps.map((j) => j.toFixed(2))}`] = Math.max(...steps) < 0.1 && jumps.every((j) => j > 1);
// same camera named on consecutive moves = a chain, no cut
const q = cm.pathStates("dolly-in:2@CAM_main+arc-left:2", CAMS.CAM_main, 4 * fps + 1, fps, 0.6, cams);
ok["same camera named twice = continuous chain"] = !q.some((s: any) => s.cut);
// back to a camera already used: cuts to its own pose again
const r = cm.pathStates("dolly-in:2+static-shot:1@CAM_table+static-shot:1", CAMS.CAM_main, 4 * fps + 1, fps, 0.6, cams);
ok["A → B → A cuts back to A's pose"] = r[72].cut && near(r[72].pos, CAMS.CAM_main.pos) && r[72].cam === "CAM_main";
// unknown camera (deleted by an undo) = the shot camera, no cut
const u = cm.pathStates("dolly-in:2+arc-left:2@CAM_gone", CAMS.CAM_main, 4 * fps + 1, fps, 0.6, cams);
ok["unknown camera = shot camera, no cut"] = !u.some((s: any) => s.cut) && u.every((s: any) => s.cam === "CAM_main");
// old recipes: same states with or without the camera resolver (the INVARIANT)
for (const rec of ["dolly-in:4", "dolly-in:4+arc-left:6:2.5+crane-up:5", "whip-pan:2+pan-left:3"]) {
  const a = cm.pathStates(rec, CAMS.CAM_main, 241, fps), b = cm.pathStates(rec, CAMS.CAM_main, 241, fps, 0.6, cams);
  ok[`old recipe unchanged: ${rec}`] = a.every((s: any, i: number) => JSON.stringify([s.pos, s.lookAt, s.fov, s.roll]) === JSON.stringify([b[i].pos, b[i].lookAt, b[i].fov, b[i].roll])) && !b.some((s: any) => s.cut);
}

// --- render prompt ---
const vis = (name: string) => [{ name: "ENV_floor", category: "ENV", labels: ["oak"], cover: 0.5 }, { name, category: "PRP", labels: ["wood"], cover: 0.2 }];
const sentence = pc.moveSentence("dolly-in:2+static-shot:2@CAM_closeup+arc-left:2@CAM_barrels", { cuts: { 1: { cam: "CAM_closeup", visible: vis("PRP_table_01_mugs") }, 2: { cam: "CAM_barrels", visible: vis("PRP_barrel_stack") } } });
console.log(sentence);
ok["prompt reads the shots in order"] = sentence === "The camera dollies slowly in; cut to a close-up of the table mugs, a locked-off static shot; cut to a new angle on the barrel stack as the camera arcs slowly to the left.";
const far = [{ name: "PRP_barrel_stack", category: "PRP", labels: ["oak"], cover: 0.3 }, { name: "CHAR_patron", category: "CHAR", labels: ["person"], cover: 0.01 }];
const close = [{ name: "PRP_barrel_stack", category: "PRP", labels: ["oak"], cover: 0.3 }, { name: "CHAR_patron", category: "CHAR", labels: ["person"], cover: 0.12 }];
ok["cut subject: the dominant thing, a person when big enough"] = pc.moveSentence("static-shot:1+static-shot:1@CAM_b", { cuts: { 1: { cam: "CAM_b", visible: far } } }).includes("on the barrel stack")
  && pc.moveSentence("static-shot:1+static-shot:1@CAM_b", { cuts: { 1: { cam: "CAM_b", visible: close } } }).includes("on the patron");
ok["old prompt sentence unchanged"] = pc.moveSentence("dolly-in:4+arc-left:6:2.5") === "The camera dollies slowly in, then the camera arcs slowly to the left.";
ok["span: a long-shot part describes only its shots"] = pc.moveSentence("dolly-in:2+static-shot:2@CAM_wide", { span: [1, 1], cuts: { 1: { cam: "CAM_wide", visible: [] } } }) === "A locked-off static shot.";

// --- 48 fps: a cut is not camera motion ---
const slow = cm.pathStates("dolly-in:5+static-shot:4@CAM_table+slow-zoom-in:5@CAM_barrels", CAMS.CAM_main, 14 * fps + 1, fps, 0.6, cams);
const withCut = f48.peakMotion(slow), noFlag = f48.peakMotion(slow.map(({ cut: _c, ...x }: any) => x));
ok[`48 fps auto ignores cuts (peak ${withCut.toFixed(4)} ≤ ${f48.FAST_MOTION}; as motion it would be ${noFlag.toFixed(3)})`] = withCut <= f48.FAST_MOTION && noFlag > 0.1;

// --- chat ---
const names = ["CAM_main", "CAM_table", "CAM_barrels", "CAM_closeup"];
const said = (t: string) => shotIntent(t, 60, names)?.recipe.map((x: any) => `${x.move}:${x.seconds}${x.cam ? `@${x.cam}` : ""}`).join("+");
ok["chat: dolly on main, cut to close-up"] = said("dolly in on the main camera for 4 s, then cut to the close-up for 3 s") === "dolly-in:4@CAM_main+static-shot:3@CAM_closeup";
ok["chat: cut names the next move"] = said("push in for 2 s, then cut to the table camera and arc left for 2 s, then switch to the barrels and pan right for 2 s") === "dolly-in:2+arc-left:2@CAM_table+pan-right:2@CAM_barrels";
ok["chat: no cameras given = as before"] = JSON.stringify(shotIntent("dolly in for 4 s, then cut to the close-up for 3 s")?.recipe) === JSON.stringify([{ move: "dolly-in", seconds: 4 }]);
ok["chat: camera words without a cut phrase change nothing"] = said("slow dolly in towards the table for 5 s") === "dolly-in:5";

for (const [k, v] of Object.entries(ok)) console.log(v ? "PASS" : "FAIL", k);
const bad = Object.values(ok).filter((v) => !v).length;
console.log(bad ? `FAIL ${bad}/${Object.keys(ok).length}` : `PASS ${Object.keys(ok).length}/${Object.keys(ok).length}`); process.exit(bad ? 1 : 0);
