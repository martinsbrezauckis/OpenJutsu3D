/**
 * models.ts — which model routes this machine can use, and the models each offers (server only).
 *   router  Comfy Router (needs COMFY_API_KEY): one key for text + image models, from its live catalog.
 *   codex   Codex CLI on the user's ChatGPT subscription (needs `codex` on PATH and a login): no per-call cost.
 *   claude  Claude Code CLI on the user's Claude subscription (`claude` on PATH, logged in): text only.
 *   agy     Antigravity CLI on the user's Google subscription (`agy` on PATH, logged in): text, and the look still
 *           through its generate_image tool (Nano Banana).
 *   A subscription CLI is offered only when it is installed and logged in — with its own login, which the app never
 *   touches; otherwise the picker shows it as not available. Text-only routes take the look still from another route.
 *   anthropic  Anthropic API with the user's own key (ANTHROPIC_API_KEY): Claude models, text only.
 *   google     Google Gemini API with the user's own key (GEMINI_API_KEY or GOOGLE_API_KEY): text + image models.
 *   openai  OpenAI API directly with the user's own key (OPENAI_API_KEY): for models Router does not carry yet
 *           (gpt-6.1-terra, $1/$5 per 1M tokens — near Astra quality in our tests, 10-28).
 * The client picks {route, model} per stage; the server only accepts pairs the routes reported (allow-list), so a
 * request can never name an arbitrary model or provider. Benchmarks behind the defaults: research/builder_glm53.md (10-18/10-28).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { comfy } from "@comfyorg/sdk";

export type Route = "router" | "codex" | "openai" | "claude" | "agy" | "anthropic" | "google";
export const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY?.trim();
export const GEMINI_KEY = () => (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();
export const ANTHROPIC_URL = () => (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
export const GEMINI_URL = () => (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
/** Routes that run on the user's own CLI subscription: no per-call cost, nothing to meter. */
export const SUBSCRIPTION: Route[] = ["codex", "claude", "agy"];
export type Stage = "director" | "builder" | "look";
export type ModelOption = { id: string; label: string; note?: string };

// No fixed model list: every route reports what it offers right now (Codex its model cache, Antigravity `agy models`,
// Claude Code its version-free names, Router its live catalog, OpenAI /v1/models). These are hints only — a note for
// models we benchmarked and the order defaults are picked in; they never limit the list.
const NOTE: Record<string, string> = { "gpt-6-astra": "best sets in our tests", "gpt-6.1-terra": "near Astra, faster", "gpt-6-sol": "faster",
  "gpt-6-luna": "fastest; untested as a set builder" };
const PREFER = ["gpt-6.1-terra", "gpt-6-astra", "gpt-6-sol", "opus", "gemini-4-argon-high", "gpt-image-2.5-sunburst", "imagegen", "nano-banana"];
const isImage = (id: string) => /(^|\/)gpt-image|image$|-image-/.test(id);
// Router text models are called with an OpenAI Responses body, so only OpenAI text models are offered there for now.
const routerText = (id: string) => /^openai\/(gpt-\d|o\d)/.test(id) && !/image|audio|realtime|transcribe|tts|search|codex|-pro$/.test(id);
const label = (id: string) => id.replace(/^[a-z-]+\//, "").replace(/^gpt-/, "GPT ").replace(/-(\w)/g, (_, c) => " " + c.toUpperCase())
  .replace(/^(\w)/, (c) => c.toUpperCase());
const opt = (id: string, extra?: string): ModelOption => { const bare = id.replace(/^[a-z-]+\//, ""), n = [NOTE[bare], extra].filter(Boolean).join(", ");
  return { id, label: label(id), ...(n ? { note: n } : {}) }; };
const rank = (id: string) => { const k = PREFER.indexOf(id.replace(/^[a-z-]+\//, "")); return k < 0 ? PREFER.length : k; };
const order = (l: ModelOption[]) => l.sort((a, b) => rank(a.id) - rank(b.id) || b.id.localeCompare(a.id));

const listed: Partial<Record<Route, { text: ModelOption[]; image: ModelOption[] }>> = {};
function codexModels() {
  try {
    const d = JSON.parse(readFileSync(join(process.env.CODEX_HOME || join(homedir(), ".codex"), "models_cache.json"), "utf8"));
    const ids = (Array.isArray(d) ? d : d.models ?? []).filter((m: any) => m.visibility !== "hide").map((m: any) => String(m.slug ?? m.id)).filter(Boolean);
    return { text: order(ids.map((i: string) => opt(i, "subscription"))), image: [{ id: "imagegen", label: "GPT Image (Codex)", note: "subscription" }] };
  } catch { return { text: [opt("gpt-6.1-terra", "subscription")], image: [{ id: "imagegen", label: "GPT Image (Codex)", note: "subscription" }] }; }
}
// Claude Code resolves these to the newest model of each family itself.
const claudeModels = () => ({ text: ["opus", "sonnet", "haiku"].map((i) => ({ id: i, label: `Claude ${label(i)} (newest)`, note: "subscription" })), image: [] });
function agyModels(out: string) {
  const text = out.split("\n").map((l) => l.split("\t")).filter((c) => c.length >= 2 && /^[a-z0-9.-]+$/.test(c[0].trim()))
    .map(([id, name]) => ({ id: id.trim(), label: name.trim(), note: "subscription" }));
  return { text: order(text), image: [{ id: "nano-banana", label: "Nano Banana (Antigravity)", note: "subscription" }] };
}
let remoteAt = 0;
/** Refresh the Router catalog and the OpenAI model list (at most every 10 minutes; failures keep the last list). */
export async function refreshModels(): Promise<void> {
  if (Date.now() - remoteAt < 600_000) return;
  remoteAt = Date.now();
  if (process.env.COMFY_API_KEY?.trim()) {
    try { const ids: string[] = []; for await (const m of comfy.models.list()) ids.push(m.id);
      listed.router = { text: order(ids.filter(routerText).map((i) => opt(i))), image: order(ids.filter((i) => /^openai\/gpt-image/.test(i)).map((i) => opt(i))) };
    } catch { /* keep what we had */ }
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    try { const r = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/models`,
        { headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}` }, signal: AbortSignal.timeout(20_000) });
      const ids: string[] = ((await r.json())?.data ?? []).map((m: any) => String(m.id));
      listed.openai = { text: order(ids.filter((i) => routerText(`openai/${i}`)).map((i) => opt(i))), image: order(ids.filter((i) => /^gpt-image/.test(i)).map((i) => opt(i))) };
    } catch { /* keep what we had */ }
  }
  const ak = ANTHROPIC_KEY();
  if (ak) {
    try { const r = await fetch(`${ANTHROPIC_URL()}/v1/models?limit=1000`, { headers: { "x-api-key": ak, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(20_000) });
      const ms: { id: string; display_name?: string }[] = (await r.json())?.data ?? [];
      listed.anthropic = { text: order(ms.map((m) => ({ id: m.id, label: m.display_name || label(m.id) }))), image: [] };
    } catch { /* keep what we had */ }
  }
  const gk = GEMINI_KEY();
  if (gk) {
    try { const r = await fetch(`${GEMINI_URL()}/v1beta/models?pageSize=1000`, { headers: { "x-goog-api-key": gk }, signal: AbortSignal.timeout(20_000) });
      const ms: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] = (await r.json())?.models ?? [];
      const gen = ms.filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName || label(m.name) }));
      listed.google = { text: order(gen.filter((m) => /^gemini/.test(m.id) && !/image|banana|tts|audio|live|embedding|robotics/.test(m.id))),
        image: order(gen.filter((m) => /image|banana/.test(m.id))) };
    } catch { /* keep what we had */ }
  }
}

type Cli = "codex" | "claude" | "agy";
export type CliState = "ok" | "not installed" | "not logged in";
// Each CLI's own status command (exit 0 = logged in; Claude answers JSON). `agy models` needs a login to list models.
const CLI: Record<Cli, { check: string[]; loggedIn: (out: string) => boolean }> = {
  codex: { check: ["login", "status"], loggedIn: () => true },
  claude: { check: ["auth", "status"], loggedIn: (o) => /"loggedIn":\s*true/.test(o) },
  agy: { check: ["models"], loggedIn: () => true },
};
const cliSeen = new Map<Cli, { at: number; state: CliState }>();
/** Is this subscription CLI installed and logged in? Checked at most every 5 minutes. */
export function cliState(cli: Cli): CliState {
  const c = cliSeen.get(cli); if (c && Date.now() - c.at < 300_000) return c.state;
  let state: CliState;
  try {
    const out = execFileSync(cli, CLI[cli].check, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 });
    state = CLI[cli].loggedIn(out) ? "ok" : "not logged in";
    if (state === "ok") listed[cli] = cli === "agy" ? agyModels(out) : cli === "codex" ? codexModels() : claudeModels();
  }
  catch (e) { state = (e as NodeJS.ErrnoException).code === "ENOENT" ? "not installed" : "not logged in"; }
  cliSeen.set(cli, { at: Date.now(), state });
  return state;
}
/** Routes that are not usable on this machine, with the reason (shown greyed out in the model picker). */
export function unavailable(): Partial<Record<Route, string>> {
  const u: Partial<Record<Route, string>> = {};
  if (!process.env.COMFY_API_KEY?.trim()) u.router = "no COMFY_API_KEY";
  if (!process.env.OPENAI_API_KEY?.trim()) u.openai = "no OPENAI_API_KEY";
  if (!ANTHROPIC_KEY()) u.anthropic = "no ANTHROPIC_API_KEY";
  if (!GEMINI_KEY()) u.google = "no GEMINI_API_KEY";
  for (const c of ["codex", "claude", "agy"] as const) { const s = cliState(c); if (s !== "ok") u[c] = s; }
  return u;
}
export function routes(): Route[] {
  const r: Route[] = [];
  if (process.env.COMFY_API_KEY?.trim() && listed.router?.text.length) r.push("router");
  if (cliState("codex") === "ok") r.push("codex");
  if (process.env.OPENAI_API_KEY?.trim() && listed.openai?.text.length) r.push("openai");
  if (cliState("claude") === "ok") r.push("claude");
  if (cliState("agy") === "ok") r.push("agy");
  if (ANTHROPIC_KEY() && listed.anthropic?.text.length) r.push("anthropic");
  if (GEMINI_KEY() && listed.google?.text.length) r.push("google");
  return r;
}
export function options(stage: Stage, route: Route): ModelOption[] { const l = listed[route]; return (stage === "look" ? l?.image : l?.text) ?? []; }
export function defaults(): Record<Stage, { route: Route; model: string } | null> {
  const r = routes(); const pick = (stage: Stage) => {
    const want = process.env.LLM_PROVIDER as Route | undefined;
    // the look still needs an image model: a text-only preferred route hands it to the first route that has one
    const usable = stage === "look" ? r.filter((x) => options("look", x).length) : r;
    const pref: Route | undefined = want && usable.includes(want) ? want : usable[0];
    if (!pref) return null;
    const envModel = stage === "director" ? process.env.DIRECTOR_MODEL : stage === "builder" ? process.env.BUILDER_MODEL : process.env.LOOK_MODEL;
    const list = options(stage, pref);
    if (!list.length) return null;
    const cx = pref === "codex" && stage !== "look" ? process.env.CODEX_MODEL : undefined;
    const model = [cx, envModel].find((m) => m && list.some((o) => o.id === m))
      ?? (stage === "director" && list.some((o) => o.id === "openai/gpt-6-sol") ? "openai/gpt-6-sol" : list[0].id);
    return { route: pref, model };
  };
  return { director: pick("director"), builder: pick("builder"), look: pick("look") };
}
/** Validate a client choice against the lists the routes reported; falls back to the default for that stage. */
export async function choose(stage: Stage, want?: { route?: string; model?: string } | null): Promise<{ route: Route; model: string }> {
  await refreshModels();
  const r = routes();
  if (want?.route && r.includes(want.route as Route) && options(stage, want.route as Route).some((m) => m.id === want.model))
    return { route: want.route as Route, model: want.model as string };
  const d = defaults()[stage];
  if (!d) throw new Error(stage === "look" ? "No image model route is set up for the look still: add COMFY_API_KEY or OPENAI_API_KEY, or log in to the Codex or Antigravity CLI."
    : "No model route is set up: add COMFY_API_KEY (Comfy Router), or log in to the Codex, Claude Code or Antigravity CLI.");
  return d;
}
