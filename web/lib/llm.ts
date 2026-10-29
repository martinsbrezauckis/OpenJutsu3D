/**
 * llm.ts — text and image model calls for the app, behind one interface with two providers:
 *   router (default) — Comfy Router through @comfyorg/sdk: `comfy.models.run("openai/gpt-6-sol", <OpenAI Responses body>)`.
 *                      One key (COMFY_API_KEY) for director, builder and look still. Router does not stream and has a
 *                      10-minute server deadline per call, so the builder works in batches (lib/builder.ts).
 *   codex            — local dev route on a Codex CLI subscription (`codex exec`, read-only sandbox, stdin closed —
 *                      codex blocks on an open stdin). No Router credits used. Image edits use Codex's $imagegen.
 *   openai           — OpenAI API with the user's own OPENAI_API_KEY (OPENAI_BASE_URL overrides the endpoint).
 *                      Text runs in background mode and is polled: a long build would outlive fetch's 5-minute
 *                      header timeout as one blocking request.
 * Server-only (reads secrets from the environment; never import from a client component).
 */
import { comfy } from "@comfyorg/sdk";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Route } from "./models";
import { reportOpenAI, reportRouter } from "./cost";

/** Pull the text out of an OpenAI Responses-API document (Router forwards the provider's JSON unchanged). */
export function responseText(doc: unknown): string {
  const d = doc as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  if (typeof d?.output_text === "string") return d.output_text;
  return (d?.output ?? []).flatMap((o) => (o.type === "message" ? o.content ?? [] : []))
    .filter((c) => c.type === "output_text" && typeof c.text === "string").map((c) => c.text).join("");
}

function runCodex(args: string[], cwd: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...(process.env.CODEX_HOME ? { CODEX_HOME: process.env.CODEX_HOME } : {}) };
    const p = spawn("codex", args, { cwd, env, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (b) => { err = (err + b).slice(-4000); });
    const t = setTimeout(() => { p.kill("SIGTERM"); reject(new Error("codex timed out")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve(code) : reject(new Error(`codex exit ${code}: ${err.slice(-600)}`)); });
  });
}

/**
 * One text completion on `route` (router | codex) with `model` (validated by lib/models.ts choose()).
 * `images` = optional reference pictures (chat attachments): Router → OpenAI Responses input_image parts;
 * Codex → `-i <file>`. `effort` maps to reasoning effort on both routes.
 */
export async function complete(prompt: string, opts: { route: Route; model: string; effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxOutputTokens?: number; images?: Img[]; signal?: AbortSignal }): Promise<string> {
  if (opts.route === "codex") {
    const dir = await mkdtemp(join(tmpdir(), "o3j-codex-"));
    try {
      const out = join(dir, "last.txt"); const imgArgs: string[] = [];
      for (const [k, im] of (opts.images ?? []).entries()) { const f = join(dir, `ref${k}.${im.type.includes("png") ? "png" : "jpg"}`); await writeFile(f, im.bytes); imgArgs.push("-i", f); }
      await runCodex(["exec", "--ephemeral", "--skip-git-repo-check", "-s", "read-only", "-C", dir, "-m", opts.model,
        ...(opts.effort ? ["-c", `model_reasoning_effort=${opts.effort}`] : []), ...imgArgs, "-o", out, "--", prompt], dir, 3_600_000);
      return await readFile(out, "utf8");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  if (opts.route === "openai") return openaiText(prompt, opts);
  const input = opts.images?.length
    ? [{ role: "user", content: [{ type: "input_text", text: prompt }, ...opts.images.map((i) => ({ type: "input_image", image_url: dataUrl(i) }))] }]
    : prompt;
  const body: Record<string, unknown> = { input, max_output_tokens: opts.maxOutputTokens ?? 64_000 };
  if (opts.effort && opts.model.startsWith("openai/")) body.reasoning = { effort: opts.effort === "max" ? "xhigh" : opts.effort };
  const r = await comfy.models.run(opts.model, body, { timeoutMs: 20 * 60_000, signal: opts.signal });
  reportRouter(r.creditsUsed, r.replayed);
  if (r.kind !== "json") throw new Error(`unexpected ${r.kind} answer from ${opts.model}`);
  return responseText(r.data);
}

const OPENAI = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
async function openaiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const key = process.env.OPENAI_API_KEY?.trim(); if (!key) throw new Error("OPENAI_API_KEY is not set");
  const r = await fetch(OPENAI() + path, { ...init, headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) } });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${body?.error?.message ?? "request failed"}`);
  return body;
}
async function openaiText(prompt: string, opts: { model: string; effort?: string; maxOutputTokens?: number; images?: Img[]; signal?: AbortSignal }) {
  const input = opts.images?.length
    ? [{ role: "user", content: [{ type: "input_text", text: prompt }, ...opts.images.map((i) => ({ type: "input_image", image_url: dataUrl(i) }))] }]
    : prompt;
  const body: Record<string, unknown> = { model: opts.model, input, max_output_tokens: opts.maxOutputTokens ?? 64_000, background: true, store: true };
  if (opts.effort) body.reasoning = { effort: opts.effort === "max" ? "xhigh" : opts.effort };
  let doc = await openaiFetch("/responses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: opts.signal });
  const t0 = Date.now();
  while (doc.status === "queued" || doc.status === "in_progress") {
    if (Date.now() - t0 > 3_600_000) throw new Error("OpenAI response took over an hour");
    if (opts.signal?.aborted) { await openaiFetch(`/responses/${doc.id}/cancel`, { method: "POST" }).catch(() => {}); throw new Error("cancelled"); }
    await new Promise((r) => setTimeout(r, 4000));
    doc = await openaiFetch(`/responses/${doc.id}`, { signal: opts.signal });
  }
  reportOpenAI(opts.model, doc.usage);
  if (doc.status !== "completed") throw new Error(`OpenAI response ${doc.status}: ${doc.error?.message ?? doc.incomplete_details?.reason ?? ""}`);
  return responseText(doc);
}

export type Img = { bytes: Uint8Array; type: string };
export const dataUrl = (i: Img) => `data:${i.type};base64,${Buffer.from(i.bytes).toString("base64")}`;

/**
 * Image generation / edit. refs = reference images (look still: the lit viewport frame). Router: gpt-image-2.5
 * (body as in Comfy-Org/comfy-openjutsu lib/anchor.ts). Codex: $imagegen in a scratch dir, reference copied in.
 */
export async function image(prompt: string, refs: Img[], opts: { route: Route; model: string; quality?: "low" | "medium" | "high";
  size?: string }): Promise<Img> {
  if (opts.route === "codex") {
    const dir = await mkdtemp(join(tmpdir(), "o3j-img-"));
    try {
      const names: string[] = [];
      for (const [k, r] of refs.entries()) { const n = join(dir, `ref${k}.png`); await writeFile(n, r.bytes); names.push(n); }
      const dst = join(dir, "out.png");
      // Prompts number the pictures ("the first picture", "picture 3"): say which file is which when there are several.
      const at = names.length > 1 ? names.map((n, k) => `picture ${k + 1} = ${n}`).join(", ") : names.join(", ");
      const req = `$imagegen ${names.length ? `Using the reference image(s) at ${at} — ` : "Generate a new image (no reference). "}${prompt} Save the result as ${dst}`;
      await runCodex(["exec", "-s", "workspace-write", "--skip-git-repo-check", "-C", dir, "--", req], dir, 1_800_000);
      const files = await readdir(dir);
      if (!files.includes("out.png")) throw new Error("image model produced no file");
      return { bytes: new Uint8Array(await readFile(dst)), type: "image/png" };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  if (opts.route === "openai") {
    // generations (JSON) without references; edits (multipart, image[] files) with them.
    const doc = refs.length
      ? await openaiFetch("/images/edits", { method: "POST", body: (() => { const f = new FormData();
          f.set("model", opts.model); f.set("prompt", prompt); f.set("quality", opts.quality ?? "high"); f.set("size", opts.size ?? "auto");
          refs.forEach((r, k) => f.append("image[]", new Blob([new Uint8Array(r.bytes)], { type: r.type }), `ref${k}.${r.type.includes("png") ? "png" : "jpg"}`)); return f; })() })
      : await openaiFetch("/images/generations", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: opts.model, prompt, quality: opts.quality ?? "high", size: opts.size ?? "auto", n: 1 }) });
    reportOpenAI(opts.model, doc?.usage);
    const b64 = doc?.data?.[0]?.b64_json; if (!b64) throw new Error(`${opts.model} returned no image`);
    return { bytes: new Uint8Array(Buffer.from(b64, "base64")), type: "image/png" };
  }
  const body: Record<string, unknown> = { prompt, quality: opts.quality ?? "high", size: opts.size ?? "auto", n: 1, moderation: "auto" };
  if (refs.length) body.image = refs.map(dataUrl);
  const r = await comfy.models.run(opts.model, body, { timeoutMs: 10 * 60_000 });
  reportRouter(r.creditsUsed, r.replayed);
  if (r.kind === "binary") return { bytes: r.data as Uint8Array, type: (r as { contentType?: string }).contentType || "image/png" };
  const first = (r.data as { data?: { b64_json?: string; url?: string }[] } | null)?.data?.[0];
  if (first?.b64_json) return { bytes: new Uint8Array(Buffer.from(first.b64_json, "base64")), type: "image/png" };
  if (first?.url) { const res = await fetch(first.url); if (!res.ok) throw new Error(`image download ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") || "image/png" }; }
  throw new Error(`${opts.model} returned no image`);
}
