// Run: node bench/keys_route_mock_test.mts  (as bench/openai_route_mock_test.mts: lib copied to web/.cost-test; no network,
// no key). Mock Anthropic (streamed Messages, model list) and Gemini (streamed text, image, model list) servers.
import http from "node:http";
const seen: any[] = [];
const srv = http.createServer(async (req, res) => {
  let body = Buffer.alloc(0); for await (const c of req) body = Buffer.concat([body, c]);
  seen.push({ m: req.method, u: req.url, h: req.headers, json: body.length ? JSON.parse(body.toString()) : null });
  const send = (o: any, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  const stream = (events: any[]) => { res.writeHead(200, { "content-type": "text/event-stream" });
    for (const e of events) res.write(`data: ${JSON.stringify(e)}\n\n`); res.end(); };
  if (req.url?.startsWith("/a/v1/models")) return send({ data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5" }, { id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" }] });
  if (req.url === "/a/v1/messages") return stream([{ type: "message_start" }, { type: "content_block_delta", delta: { type: "text_delta", text: "kit.object('ENV_" } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "a').commit();" } }, { type: "message_stop" }]);
  if (req.url?.startsWith("/g/v1beta/models?")) return send({ models: [
    { name: "models/gemini-4-argon", displayName: "Gemini 4 Argon", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.1-flash-image", displayName: "Nano Banana", supportedGenerationMethods: ["generateContent"] },
    { name: "models/text-embedding-9", supportedGenerationMethods: ["embedContent"] }] });
  if (req.url === "/g/v1beta/models/gemini-4-argon:streamGenerateContent?alt=sse") return stream([
    { candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: "kit.object('ENV_" }] } }] },
    { candidates: [{ content: { parts: [{ text: "g').commit();" }] } }] }]);
  if (req.url === "/g/v1beta/models/gemini-3.1-flash-image:generateContent") return send({ candidates: [{ content: { parts: [{ text: "here" },
    { inlineData: { mimeType: "image/png", data: Buffer.from("PNGDATA").toString("base64") } }] } }] });
  send({ error: { message: "nope" } }, 404);
});
await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
const base = `http://127.0.0.1:${(srv.address() as any).port}`;
Object.assign(process.env, { ANTHROPIC_BASE_URL: `${base}/a`, ANTHROPIC_API_KEY: "a-key", GEMINI_BASE_URL: `${base}/g`, GEMINI_API_KEY: "g-key" });
delete process.env.COMFY_API_KEY; delete process.env.OPENAI_API_KEY;
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test");
mkdirSync(scratch, { recursive: true });
for (const f of ["llm", "cost", "render", "models"])
  writeFileSync(join(scratch, `${f}.ts`), readFileSync(join(web, "lib", `${f}.ts`), "utf8").replace(/from "\.\/(llm|cost|render|models)"/g, 'from "./$1.ts"'));
const { complete, image } = await import(join(scratch, "llm.ts"));
const { refreshModels, options, routes } = await import(join(scratch, "models.ts"));
await refreshModels();
const a = await complete("build", { route: "anthropic", model: "claude-opus-5-5", images: [{ bytes: new Uint8Array([1, 2]), type: "image/png" }] });
const g = await complete("build", { route: "google", model: "gemini-4-argon" });
const img = await image("a look", [{ bytes: new Uint8Array([9, 9]), type: "image/jpeg" }], { route: "google", model: "gemini-3.1-flash-image", size: "1536x1024" });
const msg = seen.find((s) => s.u === "/a/v1/messages"), gimg = seen.find((s) => s.u?.includes(":generateContent"));
const checks = {
  routes: routes().includes("anthropic") && routes().includes("google"),
  anthropic_models: options("builder", "anthropic").map((o: any) => o.id).join() === "claude-sonnet-5-5,claude-opus-5-5" || options("builder", "anthropic").length === 2,
  google_text_models: options("builder", "google").map((o: any) => o.id).join() === "gemini-4-argon",
  google_image_models: options("look", "google").map((o: any) => o.id).join() === "gemini-3.1-flash-image",
  anthropic_text: a === "kit.object('ENV_a').commit();", anthropic_key: msg?.h["x-api-key"] === "a-key" && msg?.json?.stream === true,
  anthropic_image_part: msg?.json?.messages?.[0]?.content?.[0]?.type === "image",
  google_text_skips_thoughts: g === "kit.object('ENV_g').commit();",
  google_image: Buffer.from(img.bytes).toString() === "PNGDATA" && img.type === "image/png",
  google_key_and_aspect: gimg?.h["x-goog-api-key"] === "g-key" && gimg?.json?.generationConfig?.imageConfig?.aspectRatio === "3:2",
  google_ref_part: !!gimg?.json?.contents?.[0]?.parts?.[1]?.inline_data,
};
console.log(JSON.stringify(checks)); srv.close(); process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
