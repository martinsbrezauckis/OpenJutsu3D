/**
 * pipeline.ts — the app's model stages (server only):
 *   director(prompt, answers?)  → brief + batches, or ≤3 easy questions         (DIRECTOR_PROMPT.md, shared with bench)
 *   buildBatch(...)             → new //@@ scene-code blocks for one batch       (BUILDER_PROMPT.md + batch rules)
 *   lookStill(lit, prompt)      → photoreal frame 0 for LTX ("add nothing")       (same rules as bench/look.py)
 * Prompts are read from public/scenekit (copied from spike/scenekit by scripts/sync-kit.mjs), so bench and app use
 * the identical text.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { complete, image, type Img } from "./llm";
import { builderCandidates } from "./library";
import type { Route } from "./models";

const kitFile = (f: string) => readFile(join(process.cwd(), "public", "scenekit", f), "utf8");
/** A validated {route, model} pair (lib/models.ts choose()). */
export type Use = { route: Route; model: string };
// Reference picture rule (moon A/B 10-18: the picture lifted style a lot but pulled the LAYOUT toward itself).
const REF_NOTE = "REFERENCE PICTURE (attached): take the style, mood, materials and the design of objects from it; take "
  + "positions, sizes and counts from the text. Do not copy the picture's layout.";

export type Question = { id: string; question: string; options: string[]; default: string };
export type DirectorResult =
  | { status: "ready"; brief: string; batches: string[]; assumptions: string[] }
  | { status: "ask"; questions: Question[]; assumptions: string[] };

/** First {...} JSON object in a model reply (models sometimes add a sentence or fences). Same rules as bench/director.py. */
export function parseDirector(text: string): DirectorResult {
  const m = text.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("director returned no JSON");
  const d = JSON.parse(m[0]);
  if (d.status === "ask") {
    const qs: Question[] = (d.questions ?? []).slice(0, 3).map((q: Question) => ({ ...q,
      default: q.options?.includes(q.default) ? q.default : q.options?.[0] ?? "" }));
    if (!qs.length) throw new Error("director asked without questions");
    return { status: "ask", questions: qs, assumptions: d.assumptions ?? [] };
  }
  if (d.status !== "ready" || !String(d.brief ?? "").trim()) throw new Error("director returned no brief");
  let batches: string[] = Array.isArray(d.batches) ? d.batches.filter((b: unknown) => typeof b === "string" && b.trim()) : [];
  if (batches.length < 2) batches = ["The whole set: ground, structures, props, lights and cameras."];
  return { status: "ready", brief: d.brief, batches: batches.slice(0, 6), assumptions: d.assumptions ?? [] };
}

/** How the director treats questions (Higgsfield-style modes): auto = only when the idea is unclear (DIRECTOR_PROMPT.md),
 *  ask = always ask 1–3 short questions first, go = never ask, decide and list assumptions. */
export type AskMode = "auto" | "ask" | "go";
const MODE_RULE: Record<AskMode, string> = { auto: "",
  ask: "\nMODE: ASK BEFORE GENERATING — unless answers are given below, return status \"ask\" with 1–3 questions that matter most for this place.\n",
  go: "\nMODE: GENERATE WITHOUT ASKING — never ask; always return status \"ready\" and list your choices as assumptions.\n" };

export async function director(use: Use, prompt: string, answers?: Record<string, string>, refs: Img[] = [], mode: AskMode = "auto"): Promise<DirectorResult> {
  let task = (await kitFile("DIRECTOR_PROMPT.md")) + MODE_RULE[mode] + "\nUSER PROMPT:\n" + prompt.trim() + "\n";
  if (refs.length) task += "\nThe user attached a reference picture: describe the place in its style, but keep the brief in words.\n";
  if (answers && Object.keys(answers).length)
    task += "\nANSWERS TO YOUR QUESTIONS (final — return status ready):\n" + JSON.stringify(answers) + "\n";
  return parseDirector(await complete(task, { ...use, effort: "high", maxOutputTokens: 8000, images: refs }));
}

// Same text as bench/batch_build.py BATCH_RULES (kept in sync by hand; the bench measured it, 10-28).
const BATCH_RULES = `
## Batched build — this call builds ONE batch of the set
The set is built in batches so the user watches it grow. The code already in the scene is shown below; it runs
BEFORE your code, in the same scope, so you may use any helper function or constant it defines.
Write ONLY the new //@@ blocks for THIS batch (same format as above, nothing else). Never repeat or redefine an
object that already exists (object names must stay unique); never redeclare an existing const/let/function name.
Keep the director's layout and coordinates. Only the LAST batch adds lights, atmosphere and cameras (the earlier
batches add none), unless the batch line says otherwise.
`;

/** The ready-made models this step may use (asset library, P9): real meshes read far better than primitives in the
 *  clay and the final video. Only listed ids exist; the model still builds everything else from primitives. */
function libraryNote(c: { id: string; name: string; height: number; category: string }[]) {
  if (!c.length) return "";
  return "\n## Ready-made 3D models you MAY place in this batch\n"
    + "kit.model('PRP_<name>', '<id>', { pos: [x, y, z], height: <m>, rotY: <deg> }) places one: pos = where its base stands "
    + "(on the floor/terrain/table top), height = its real height in metres (start from the listed one), rotY = facing. "
    + "Use one when it fits the place and its style better than primitives (props, furniture, vehicles, plants, statues); "
    + "the same id may be placed several times under different names. Never invent ids; anything not listed is built "
    + "from primitives as usual. Models are textured already: do not add() materials to them.\n"
    + c.map((m) => `- ${m.id}  ${m.name} (${m.category}, about ${m.height} m)`).join("\n") + "\n";
}

/** Strip reasoning blocks and markdown fences; keep only scene code. */
export const cleanCode = (s: string) =>
  s.replace(/<think>[\s\S]*?<\/think>/g, "").split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim() + "\n";

export async function buildBatch(use: Use, a: { prompt: string; brief: string; batches: string[]; index: number; codeSoFar: string;
  refs?: Img[] }): Promise<string> {
  const k = a.index + 1, n = a.batches.length;
  const task = (await kitFile("BUILDER_PROMPT.md")) + "\n" + a.prompt + "\n\nDIRECTOR'S BUILD BRIEF (follow it closely):\n"
    + a.brief + "\n" + (a.refs?.length ? `\n${REF_NOTE}\n` : "") + BATCH_RULES
    + `\nBATCH ${k}/${n}: ${a.batches[a.index]}\n\nALL BATCHES (for orientation): ${a.batches.join(" | ")}\n`
    + libraryNote(await builderCandidates(a.batches[a.index], a.prompt))
    + (a.codeSoFar.trim() ? "\nCODE ALREADY IN THE SCENE:\n" + a.codeSoFar : "\n(The scene is empty; this is the first batch.)\n");
  return cleanCode(await complete(task, { ...use, effort: "high", maxOutputTokens: 64_000, images: a.refs }));
}

const CHANGE_RULES = `
## Change request — the set already exists (code below); the user asked for a change in the chat
Write ONLY new //@@ blocks that make the change (same format as above, nothing else):
- To CHANGE an object, light or camera: build it again under the SAME name — the new one replaces the old one.
- To ADD something: use a new unique name.
- To REMOVE something: kit.remove('PRP_name').
Keep everything the user did not mention exactly as it is. Reuse helpers already defined; never redeclare an existing
const/let/function name (pick new helper names).
`;

/** Chat edit: returns blocks appended to the scene (same-name rebuild replaces, kit.remove deletes). */
export async function changeScene(use: Use, a: { prompt: string; brief: string; codeSoFar: string; request: string; refs?: Img[] }): Promise<string> {
  const task = (await kitFile("BUILDER_PROMPT.md")) + "\n" + a.prompt + "\n\nDIRECTOR'S BUILD BRIEF:\n" + a.brief + "\n"
    + CHANGE_RULES + libraryNote(await builderCandidates(a.request, a.prompt, 12))
    + "\nTHE USER'S CHANGE REQUEST: " + a.request.trim() + "\n\nCODE ALREADY IN THE SCENE:\n" + a.codeSoFar;
  return cleanCode(await complete(task, { ...use, effort: "high", maxOutputTokens: 32_000, images: a.refs }));
}

// Same instruction as bench/look.py EDIT_RULES: keep the frame, change only materials and light (anything that
// exists only in the look still persists through the whole LTX video).
const FORMAT: Record<string, string> = { "1536x1024": "16:9 landscape", "1024x1536": "9:16 vertical", "1024x1024": "1:1 square" };
const editRules = (fmt: string) => `Turn this 3D previz render (${fmt}) into THE EXACT SAME FRAME as a photoreal live-action film still. `
  + "Keep every object, its position, size and silhouette, and the camera position, lens and framing EXACTLY as in the "
  + "reference. Do not add or remove any object, sign, text, person or prop — only replace the CG surfaces and lighting "
  + `with real materials and real cinematography. Natural film grain, ${fmt} frame.`;
// Long shots: each LTX segment gets a fresh look still; picture 2 = the previous segment's render at the same moment.
const STYLE_MATCH = " The SECOND picture is this same place already filmed a moment earlier in the same shot: match its "
  + "materials, colours, light and grade exactly, so the cut is invisible. Take layout and framing ONLY from the first picture.";

/** Ask mode: answer a question about the set (or the idea) in plain words, without changing anything. */
export async function askAbout(use: Use, a: { prompt: string; brief?: string; code?: string; question: string }): Promise<string> {
  const code = (a.code ?? "").slice(-60_000);   // the newest blocks matter most; the code is the set's ground truth
  const task = "You are the assistant of a 3D set-building app (sets are written as Scene Kit code, then filmed and rendered "
    + "to photoreal video). The user is in ASK mode: answer the question briefly (at most 6 short sentences), in plain words "
    + "a filmmaker understands — object names in plain language, no code, no markdown headings. You cannot change the set in this "
    + "mode; if the user wants a change, say they can switch the mode to build and ask for it.\n"
    + `\nORIGINAL PROMPT:\n${a.prompt}\n` + (a.brief ? `\nPLAN:\n${a.brief}\n` : "") + (code ? `\nSET CODE (latest part):\n${code}\n` : "\n(no set built yet)\n")
    + `\nQUESTION:\n${a.question}\n`;
  return (await complete(task, { ...use, effort: "low", maxOutputTokens: 2000 })).trim();
}

/** size = the image model's nearest frame to the clip (1536x1024 | 1024x1536 | 1024x1024); the client crops to the clip.
 *  styleRef = previous segment's rendered frame (long shots), so consecutive segments look the same. */
export async function lookStill(use: Use, lit: Img, prompt: string, size = "1536x1024", styleRef?: Img, format?: string): Promise<Img> {
  // format = the clip's own frame ("21:9 cinema"); the image model only has 3 sizes, the client crops to the clip.
  const rules = editRules(format ?? FORMAT[size] ?? "16:9 landscape") + (styleRef ? STYLE_MATCH : "");
  return image(`${rules} Scene description: ${prompt}`, styleRef ? [lit, styleRef] : [lit], { ...use, quality: "high", size });
}
