// refs_test.mts — reference pictures (lib/refs.ts): up to 5 per request, PNG/JPEG/WebP data URLs whose bytes match the
// declared type, ≤ 8 MB, optional one-line labels; the look-still note numbers the pictures after the layout frame.
// Run: node bench/refs_test.mts (offline; part of `npm test` in web/)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
writeFileSync(join(scratch, "refs.ts"), readFileSync(join(web, "lib", "refs.ts"), "utf8"));
const { readRefs, sceneRefs, refList, lookRefsNote, refLabel, MAX_REFS } = await import(join(scratch, "refs.ts"));

const url = (type: string, head: number[], n = 64) => `data:${type};base64,${Buffer.concat([Buffer.from(head), Buffer.alloc(n)]).toString("base64")}`;
const PNG = url("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), JPG = url("image/jpeg", [0xff, 0xd8, 0xff, 0xe0]);
const WEBP = url("image/webp", [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const throws = (f: () => unknown, re: RegExp) => { try { f(); return false; } catch (e) { return re.test((e as Error).message); } };
let bad = 0; const check = (name: string, pass: boolean) => { if (!pass) bad++; console.log(JSON.stringify({ check: name, pass })); };

check("not a list = no references", readRefs(undefined).length === 0 && readRefs("x").length === 0);
check("PNG, JPEG, WebP accepted, old string form too", readRefs([PNG, { url: JPG }, { url: WEBP, label: "the car" }]).map((r: { type: string }) => r.type).join() === "image/png,image/jpeg,image/webp");
check("five accepted", readRefs([PNG, PNG, PNG, PNG, PNG]).length === 5 && MAX_REFS === 5);
check("a sixth is refused plainly", throws(() => readRefs([PNG, PNG, PNG, PNG, PNG, PNG]), /at most 5 reference pictures/));
check("bytes must match the type (PNG labelled JPEG)", throws(() => readRefs([PNG.replace("image/png", "image/jpeg")]), /not the image type/));
check("other types refused (GIF, SVG, a path)", throws(() => readRefs(["data:image/gif;base64,R0lGOD"]), /PNG, JPEG or WebP/)
  && throws(() => readRefs(["data:image/svg+xml;base64,PHN2Zz4="]), /PNG, JPEG or WebP/) && throws(() => readRefs([{ url: "/etc/passwd" }]), /PNG, JPEG or WebP/));
check("larger than 8 MB refused", throws(() => readRefs([url("image/png", [0x89, 0x50, 0x4e, 0x47], 8_000_001)]), /larger than 8 MB/));
check("labels: one short line, no quotes or control characters", refLabel(' the "red"\n  woman\t ') === "the red woman" && refLabel("x".repeat(99)).length === 60
  && readRefs([{ url: PNG, label: "  " }])[0].label === undefined);
check("scene refs keep url + label only", JSON.stringify(sceneRefs([{ url: PNG, label: "her bag", from: "take 1" }, JPG])) === JSON.stringify([{ url: PNG, label: "her bag" }, { url: JPG }]));
check("scene refs: none = []", sceneRefs(undefined).length === 0);
check("picture numbers follow the layout frame", refList([{ label: "the woman" }, {}], 2) === "picture 2 = the woman; picture 3");
const note = lookRefsNote([{ label: "the woman" }], 3);
check("look note: appearance only, no additions, numbered", /picture 3 = the woman/.test(note) && /appearance only/.test(note) && /never add anything/.test(note));
check("look note: none without references", lookRefsNote([], 2) === "");
console.log(bad ? `FAIL ${bad}` : "PASS"); process.exit(bad ? 1 : 0);
