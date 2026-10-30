/**
 * cost.ts — what each model call cost, and what the next one will probably cost (P6, server only).
 *   Router   X-Comfy-Credits-Used per call (SDK `creditsUsed`): a PRICE, not a settled ledger entry; null = "not
 *            reported" (counted separately, never as 0); a replayed call is not charged twice (SDK docs, 0.5.0).
 *   OpenAI   usage tokens × the published price where we know it (USD).
 *   Codex    subscription: no per-call cost.
 * A route wraps its work in metered(stage, use, fn); llm.ts reports into the active meter (AsyncLocalStorage), so
 * pipeline functions need no extra parameter. Each finished call is appended to DATA_DIR/costs.jsonl; estimate() is
 * the mean of the last 5 runs of that stage + model on this machine (a preview, labelled as such in the UI).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./render";
import { SUBSCRIPTION, type Route } from "./models";

export type Spend = { credits: number; unreported: number; usd: number; inTokens: number; outTokens: number; calls: number };
const empty = (): Spend => ({ credits: 0, unreported: 0, usd: 0, inTokens: 0, outTokens: 0, calls: 0 });
const store = new AsyncLocalStorage<Spend>();

/** USD per 1M tokens [input, output] for direct-API models with a known published price. */
const OPENAI_PRICE: Record<string, [number, number]> = { "gpt-6.1-terra": [1, 5] };

export function reportRouter(creditsUsed: string | null | undefined, replayed?: boolean) {
  const s = store.getStore(); if (!s) return;
  s.calls++;
  if (replayed) return;                                   // already charged by the original call
  if (creditsUsed == null) { s.unreported++; return; }    // unknown, NOT free
  const n = Number(creditsUsed); if (Number.isFinite(n)) s.credits += n; else s.unreported++;
}
export function reportOpenAI(model: string, usage?: { input_tokens?: number; output_tokens?: number }) {
  const s = store.getStore(); if (!s) return;
  s.calls++;
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0; s.inTokens += i; s.outTokens += o;
  const p = OPENAI_PRICE[model];
  if (p && usage) s.usd += (i * p[0] + o * p[1]) / 1e6; else s.unreported++;
}

const LOG = () => join(DATA_DIR, "costs.jsonl");
/** Run fn with a fresh meter; returns its result and what it cost. Router/OpenAI runs are logged for estimates. */
export async function metered<T>(stage: string, use: { route: Route; model: string }, fn: () => Promise<T>): Promise<[T, Spend & { route: Route; model: string }]> {
  const s = empty();
  const out = await store.run(s, fn);
  if (!SUBSCRIPTION.includes(use.route) && s.calls) {
    await mkdir(DATA_DIR, { recursive: true }).catch(() => {});
    await appendFile(LOG(), JSON.stringify({ at: new Date().toISOString(), stage, ...use, ...s }) + "\n").catch(() => {});
  }
  // The route + model that actually ran: choose() falls back to the default route when the requested one is not set
  // up (e.g. no COMFY_API_KEY), so callers and automation scripts must not assume they got what they asked for.
  return [out, { ...s, route: use.route, model: use.model }];
}
/** Mean credits / USD of the last 5 logged runs of stage + model (null when there is no history yet). */
export async function estimate(stage: string, route: Route, model: string): Promise<{ credits: number; usd: number; runs: number } | null> {
  if (SUBSCRIPTION.includes(route)) return { credits: 0, usd: 0, runs: 0 };
  const rows = (await readFile(LOG(), "utf8").catch(() => "")).split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && r.stage === stage && r.route === route && r.model === model && !r.unreported).slice(-5);
  if (!rows.length) return null;
  const mean = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) / rows.length;
  return { credits: Math.round(mean("credits")), usd: Math.round(mean("usd") * 1000) / 1000, runs: rows.length };
}
