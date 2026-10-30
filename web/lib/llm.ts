/**
 * llm.ts — text and image model calls for the app, behind one interface with two providers:
 *   router (default) — Comfy Router through @comfyorg/sdk: `comfy.models.run("openai/gpt-6-sol", <OpenAI Responses body>)`.
 *                      One key (COMFY_API_KEY) for director, builder and look still. Router does not stream and has a
 *                      10-minute server deadline per call, so the builder works in batches (lib/builder.ts).
 *   codex            — local dev route on a Codex CLI subscription (`codex exec`, read-only sandbox, stdin closed —
 *                      codex blocks on an open stdin). No Router credits used. Image edits use Codex's $imagegen.
 *   claude / agy     — Claude Code (`claude -p`, prompt on stdin, no tools except Read for attached pictures) and
 *                      Antigravity (`agy --print`, sandboxed) on the user's own subscriptions: text only.
 *   anthropic        — Anthropic Messages API with the user's ANTHROPIC_API_KEY (streamed; text only).
 *   google           — Gemini API with the user's GEMINI_API_KEY: text streamed, images from an image model's inline data.
 *   openai           — OpenAI API with the user's own OPENAI_API_KEY (OPENAI_BASE_URL overrides the endpoint).
 *                      Text runs in background mode and is polled: a long build would outlive fetch's 5-minute
 *                      header timeout as one blocking request.
 * Server-only (reads secrets from the environment; never import from a client component).
 */
import { comfy } from "@comfyorg/sdk";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, readdir, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { ANTHROPIC_KEY, ANTHROPIC_URL, GEMINI_KEY, GEMINI_URL, type Route } from "./models";
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

/** Run a CLI in `cwd` with stdin = `input` (or closed); resolves with stdout. */
function runCli(bin: string, args: string[], cwd: string, input: string | null, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd, env: process.env, stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout!.on("data", (b) => { out += b; });
    p.stderr!.on("data", (b) => { err = (err + b).slice(-4000); });
    const t = setTimeout(() => { p.kill("SIGTERM"); reject(new Error(`${bin} timed out`)); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`${bin} exit ${code}: ${(err || out).slice(-600)}`)); });
    if (input !== null) { p.stdin!.on("error", () => {}); p.stdin!.end(input); }
  });
}
// Linux caps one command-line argument at 128 KiB; agy takes its prompt only as an argument.
const ARG_MAX = 120_000;

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
  if (opts.route === "claude" || opts.route === "agy") {
    const dir = await mkdtemp(join(tmpdir(), `o3j-${opts.route}-`));
    try {
      const files: string[] = [];
      for (const [k, im] of (opts.images ?? []).entries()) { const f = join(dir, `ref${k}.${im.type.includes("png") ? "png" : "jpg"}`); await writeFile(f, im.bytes); files.push(f); }
      const ask = files.length ? `${prompt}\n\nReference pictures attached by the user (look at each): ${files.join(", ")}` : prompt;
      if (opts.route === "claude") {
        const out = await runCli("claude", ["-p", "--model", opts.model, "--output-format", "json", "--no-session-persistence",
          "--setting-sources", "", "--strict-mcp-config", "--tools", files.length ? "Read" : "", ...(opts.effort ? ["--effort", opts.effort] : [])], dir, ask, 3_600_000);
        const doc = JSON.parse(out); if (doc.is_error) throw new Error(`claude: ${String(doc.result).slice(0, 400)}`);
        return String(doc.result ?? "");
      }
      if (Buffer.byteLength(ask) > ARG_MAX) throw new Error("this request is too long for the Antigravity CLI; pick another model route");
      const out = await runCli("agy", ["--output-format", "json", "--sandbox", "--disable-slash-commands", "--add-dir", dir, "--model", opts.model,
        `--print=${ask}`], dir, null, 3_600_000);
      const doc = JSON.parse(out); if (doc.status && doc.status !== "SUCCESS") throw new Error(`agy: ${doc.status} ${String(doc.response ?? "").slice(0, 400)}`);
      return String(doc.response ?? "");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  if (opts.route === "openai") return openaiText(prompt, opts);
  if (opts.route === "anthropic") return anthropicText(prompt, opts);
  if (opts.route === "google") return geminiText(prompt, opts);
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

/** Read a server-sent-event stream, handing each `data:` JSON to `on`. */
async function sse(r: Response, on: (d: any) => void) {
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 400)}`);
  const dec = new TextDecoder(); let buf = "";
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    let k; while ((k = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
      if (line.startsWith("data:")) { const j = line.slice(5).trim(); if (j && j !== "[DONE]") on(JSON.parse(j)); } }
  }
}
const b64 = (i: Img) => Buffer.from(i.bytes).toString("base64");
// Long builds stream, so no single wait outlives fetch's header timeout.
async function anthropicText(prompt: string, opts: { model: string; maxOutputTokens?: number; images?: Img[]; signal?: AbortSignal }) {
  const content = [...(opts.images ?? []).map((i) => ({ type: "image", source: { type: "base64", media_type: i.type, data: b64(i) } })), { type: "text", text: prompt }];
  const r = await fetch(`${ANTHROPIC_URL()}/v1/messages`, { method: "POST", signal: opts.signal,
    headers: { "x-api-key": ANTHROPIC_KEY() ?? "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: opts.model, max_tokens: opts.maxOutputTokens ?? 64_000, stream: true, messages: [{ role: "user", content }] }) });
  let out = ""; await sse(r, (d) => { if (d.type === "content_block_delta" && d.delta?.type === "text_delta") out += d.delta.text;
    if (d.type === "error") throw new Error(`anthropic: ${d.error?.message ?? "error"}`); });
  return out;
}
const geminiParts = (prompt: string, images: Img[] = []) => [{ text: prompt }, ...images.map((i) => ({ inline_data: { mime_type: i.type, data: b64(i) } }))];
async function geminiText(prompt: string, opts: { model: string; maxOutputTokens?: number; images?: Img[]; signal?: AbortSignal }) {
  const r = await fetch(`${GEMINI_URL()}/v1beta/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`, { method: "POST", signal: opts.signal,
    headers: { "x-goog-api-key": GEMINI_KEY() ?? "", "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: geminiParts(prompt, opts.images) }], generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 64_000 } }) });
  let out = ""; await sse(r, (d) => { for (const p of d.candidates?.[0]?.content?.parts ?? []) if (typeof p.text === "string" && !p.thought) out += p.text; });
  return out;
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
  if (opts.route === "google") {
    const [w, h] = (opts.size ?? "1536x1024").split("x").map(Number);
    const aspectRatio = !w || !h ? undefined : w === h ? "1:1" : w > h ? (w / h > 1.6 ? "16:9" : "3:2") : (h / w > 1.6 ? "9:16" : "2:3");
    const r = await fetch(`${GEMINI_URL()}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`, { method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY() ?? "", "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: geminiParts(prompt, refs) }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}) } }) });
    const doc: any = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`${opts.model}: HTTP ${r.status} ${JSON.stringify(doc?.error ?? doc).slice(0, 300)}`);
    const part = (doc?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
    const d = part?.inlineData ?? part?.inline_data; if (!d) throw new Error(`${opts.model} returned no image`);
    return { bytes: new Uint8Array(Buffer.from(d.data, "base64")), type: d.mimeType ?? d.mime_type ?? "image/png" };
  }
  if (opts.route === "agy") {
    // Antigravity's generate_image tool keeps its picture in the conversation's own folder (it may not write files
    // elsewhere in its sandbox): read the newest image there.
    const dir = await mkdtemp(join(tmpdir(), "o3j-agyimg-"));
    try {
      const names: string[] = [];
      for (const [k, r] of refs.entries()) { const n = join(dir, `ref${k}.${r.type.includes("png") ? "png" : "jpg"}`); await writeFile(n, r.bytes); names.push(n); }
      const at = names.length > 1 ? names.map((n, k) => `picture ${k + 1} = ${n}`).join(", ") : names.join(", ");
      const req = `Use your generate_image tool once. ${names.length ? `Reference image(s): ${at}. ` : ""}${prompt} Do not run commands or write files; only generate the image.`;
      if (Buffer.byteLength(req) > ARG_MAX) throw new Error("this request is too long for the Antigravity CLI; pick another image route");
      const doc = JSON.parse(await runCli("agy", ["--output-format", "json", "--sandbox", "--disable-slash-commands", "--add-dir", dir, `--print=${req}`], dir, null, 1_800_000));
      const id = String(doc.conversation_id ?? "");
      if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(`agy: no conversation (${doc.status ?? "?"})`);
      const brain = join(homedir(), ".gemini", "antigravity-cli", "brain", id);
      const found = await Promise.all((await readdir(brain, { withFileTypes: true }).catch(() => []))
        .filter((f) => f.isFile() && /\.(png|jpe?g|webp)$/i.test(f.name)).map(async (f) => ({ f: join(brain, f.name), t: (await stat(join(brain, f.name))).mtimeMs })));
      const best = found.sort((a, b) => b.t - a.t)[0];
      if (!best) throw new Error(`image model produced no file: ${String(doc.response ?? "").slice(0, 300)}`);
      const ext = best.f.split(".").pop()!.toLowerCase();
      return { bytes: new Uint8Array(await readFile(best.f)), type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" };
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
