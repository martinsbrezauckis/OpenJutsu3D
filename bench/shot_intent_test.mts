// shot_intent_test.mts — camera move + duration read from plain words (lib/shot-intent.ts): a typical user's example
// prompt ("8 seconds … 360-degree orbit") must pre-fill an 8 s orbit; chains keep their order; "film it" asks for a
// render. Run: node bench/shot_intent_test.mts (offline; part of `npm test` in web/)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
writeFileSync(join(scratch, "shot-intent.ts"), readFileSync(join(web, "lib", "shot-intent.ts"), "utf8"));
const { shotIntent } = await import(join(scratch, "shot-intent.ts"));
type R = { recipe: { move: string; seconds: number }[]; render: boolean } | null;
const cases: [string, string | null, boolean?][] = [
  ["A lighthouse on a cliff at dusk. 8 seconds, slow 360-degree orbit around the lighthouse.", "drone-orbit:8"],
  ["slow dolly in for 5 s, then crane up for 3 seconds", "dolly-in:5+crane-up:3"],
  ["Push in on the bar, then pull back to reveal the room, 10 seconds", "dolly-in:5+dolly-out:5"],
  ["make it darker and add a second cage", null],
  ["film it", "", true],
  ["shoot a 12 second aerial pullback", "aerial-pullback:12", true],
  ["arc left around the table for six seconds", "arc-left:6"],
  ["handheld shot following them down the street, half a minute", "handheld:15+tracking:15"],
  ["a 90 second helicopter flyover", "helicopter-shot:60"],
  // set words that look like camera words (10-29 hotel demo): not a camera move
  ["Lower the daylight a lot so the pink walls show strong colours", null],
  ["a brass birdcage lift on each side, a low view looking up the staircase to the chandelier", null],
  ["a woman descends the staircase", null],
  ["the camera slowly lowers to the desk for 4 s", "crane-down:4"],
  ["the camera rises above the rooftops, 6 seconds", "crane-up:6"],
];
let bad = 0;
for (const [text, want, render] of cases) {
  const r: R = shotIntent(text);
  const got = r === null ? null : r.recipe.map((x) => `${x.move}:${x.seconds}`).join("+");
  const pass = got === want && (render === undefined || r?.render === render);
  if (!pass) bad++;
  console.log(JSON.stringify({ text, want, got, render: r?.render, pass }));
}
console.log(bad ? `FAIL ${bad}/${cases.length}` : `PASS ${cases.length}/${cases.length}`); process.exit(bad ? 1 : 0);
