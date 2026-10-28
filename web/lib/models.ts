/**
 * models.ts — which model routes this machine can use, and the models each offers (server only).
 *   router  Comfy Router (needs COMFY_API_KEY): one key for text + image models; ids from docs.comfy.org Router list.
 *   codex   Codex CLI on the user's ChatGPT subscription (needs `codex` on PATH and a login): no per-call cost.
 *   openai  OpenAI API directly with the user's own key (OPENAI_API_KEY): for models Router does not carry yet
 *           (gpt-6.1-terra, $1/$5 per 1M tokens — near Astra quality in our tests, 10-28).
 * The client picks {route, model} per stage; the server only accepts pairs listed here (allow-list), so a request can
 * never name an arbitrary model or provider. Benchmarks behind the defaults: research/builder_glm53.md (10-18/10-28).
 */
import { execFileSync } from "node:child_process";

export type Route = "router" | "codex" | "openai";
export type Stage = "director" | "builder" | "look";
export type ModelOption = { id: string; label: string; note?: string };

const TEXT: Record<Route, ModelOption[]> = {
  router: [
    { id: "openai/gpt-6-astra", label: "GPT 6 Astra", note: "best sets in our tests" },
    { id: "openai/gpt-6-sol", label: "GPT 6 Sol", note: "faster, cheaper" },
    { id: "openai/gpt-5.6-terra", label: "GPT 5.6 Terra", note: "cheapest GPT" },
    { id: "anthropic/claude-opus-5-5", label: "Claude Opus 5.5" },
    { id: "anthropic/claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "vertexai/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  ],
  openai: [
    { id: "gpt-6.1-terra", label: "GPT 6.1 Terra", note: "near Astra, ~15× cheaper" },
    { id: "gpt-6-astra", label: "GPT 6 Astra" },
    { id: "gpt-6.1-sol", label: "GPT 6.1 Sol" },
    { id: "gpt-6-luna", label: "GPT 6 Luna", note: "fastest; untested as a set builder" },
  ],
  codex: [
    { id: "gpt-6-astra", label: "GPT 6 Astra", note: "subscription" },
    { id: "gpt-6.1-terra", label: "GPT 6.1 Terra", note: "subscription, near Astra, 2× faster" },
    { id: "gpt-6.1-sol", label: "GPT 6.1 Sol", note: "subscription" },
  ],
};
const IMAGE: Record<Route, ModelOption[]> = {
  router: [{ id: "openai/gpt-image-2.5-sunburst", label: "GPT Image 2.5" }, { id: "openai/gpt-image-2", label: "GPT Image 2" }],
  openai: [{ id: "gpt-image-2.5-sunburst", label: "GPT Image 2.5" }, { id: "gpt-image-2", label: "GPT Image 2" }],
  codex: [{ id: "imagegen", label: "GPT Image (Codex)", note: "subscription" }],
};

let codexOk: boolean | null = null;
function hasCodex() {
  if (codexOk === null) { try { execFileSync("codex", ["--version"], { stdio: "ignore", timeout: 5000 }); codexOk = true; } catch { codexOk = false; } }
  return codexOk;
}
export function routes(): Route[] {
  const r: Route[] = [];
  if (process.env.COMFY_API_KEY?.trim()) r.push("router");
  if (hasCodex()) r.push("codex");
  if (process.env.OPENAI_API_KEY?.trim()) r.push("openai");
  return r;
}
export function options(stage: Stage, route: Route): ModelOption[] { return stage === "look" ? IMAGE[route] : TEXT[route]; }
export function defaults(): Record<Stage, { route: Route; model: string } | null> {
  const r = routes(); const pick = (stage: Stage) => {
    const want = process.env.LLM_PROVIDER as Route | undefined;
    const pref: Route | undefined = want && r.includes(want) ? want : r[0];
    if (!pref) return null;
    const envModel = stage === "director" ? process.env.DIRECTOR_MODEL : stage === "builder" ? process.env.BUILDER_MODEL : process.env.LOOK_MODEL;
    const list = options(stage, pref);
    const model = pref === "codex" ? (stage === "look" ? "imagegen" : process.env.CODEX_MODEL || "gpt-6.1-terra")
      : envModel && list.some((m) => m.id === envModel) ? envModel : stage === "director" && pref === "router" ? "openai/gpt-6-sol" : list[0].id;
    return { route: pref, model };
  };
  return { director: pick("director"), builder: pick("builder"), look: pick("look") };
}
/** Validate a client choice; falls back to the default for that stage. */
export function choose(stage: Stage, want?: { route?: string; model?: string } | null): { route: Route; model: string } {
  const r = routes();
  if (want?.route && r.includes(want.route as Route) && options(stage, want.route as Route).some((m) => m.id === want.model))
    return { route: want.route as Route, model: want.model as string };
  const d = defaults()[stage];
  if (!d) throw new Error("No model route is set up: add COMFY_API_KEY (Comfy Router) or log in to the Codex CLI.");
  return d;
}
