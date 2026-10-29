// scene_code_test.mts — builder code is always appended as its own block (lib/scene-code.ts joinCode): a scene that
// ends in "//@@" without a newline (saved example sets) once swallowed the first new line into the marker comment and
// the syntax error emptied the whole set. Run: node bench/scene_code_test.mts (offline; part of `npm test` in web/)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
writeFileSync(join(scratch, "scene-code.ts"), readFileSync(join(web, "lib", "scene-code.ts"), "utf8"));
const { joinCode } = await import(join(scratch, "scene-code.ts"));
const want = "x();\n//@@\ny();\n";
const cases: [string, string, string][] = [
  ["x();\n//@@", "y();", want], ["x();\n//@@\n", "//@@\ny();\n", want], ["x();", "y();", want], ["x();\n", "\n//@@\ny();", want],
  ["x();\n//@@", "  \n", "x();\n//@@"],
];
let bad = 0;
for (const [b, a, w] of cases) {
  const got = joinCode(b, a), compiles = (() => { try { new Function("kit", got); return true; } catch { return false; } })();
  const pass = got === w && compiles; if (!pass) bad++;
  console.log(JSON.stringify({ base: b, add: a, got, pass }));
}
console.log(bad ? `FAIL ${bad}` : `PASS ${cases.length}/${cases.length}`); process.exit(bad ? 1 : 0);
