// Run: node bench/openai_route_mock_test.mts  (Node ≥ 23 strips the types; lib copied to web/.cost-test with .ts import
// extensions, as in bench/cost_mock_test.mjs; no network, no key)
// Mock OpenAI server: background Responses (queued → in_progress → completed), images generations + edits.
import http from "node:http";
const seen: any[] = []; let polls = 0;
const srv = http.createServer(async (req, res) => {
  let body = Buffer.alloc(0); for await (const c of req) body = Buffer.concat([body, c]);
  seen.push({ m: req.method, u: req.url, auth: req.headers.authorization, ct: req.headers["content-type"]?.split(";")[0], json: req.headers["content-type"]?.includes("json") ? JSON.parse(body.toString()) : body.length });
  const send = (o: any, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.url === "/v1/responses" && req.method === "POST") return send({ id: "resp_1", status: "queued" });
  if (req.url === "/v1/responses/resp_1") { polls++; return send(polls < 2 ? { id: "resp_1", status: "in_progress" } :
    { id: "resp_1", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "kit.object('ENV_x').commit();" }] }] }); }
  if (req.url === "/v1/images/generations" || req.url === "/v1/images/edits") return send({ data: [{ b64_json: Buffer.from("PNGDATA").toString("base64") }] });
  send({ error: { message: "nope" } }, 404);
});
await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(srv.address() as any).port}/v1`; process.env.OPENAI_API_KEY = "test-key";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web"), scratch = join(web, ".cost-test");
mkdirSync(scratch, { recursive: true });
for (const f of ["llm", "cost", "render", "models"])
  writeFileSync(join(scratch, `${f}.ts`), readFileSync(join(web, "lib", `${f}.ts`), "utf8").replace(/from "\.\/(llm|cost|render|models)"/g, 'from "./$1.ts"'));
const { complete, image } = await import(join(scratch, "llm.ts"));
const txt = await complete("build", { route: "openai", model: "gpt-6.1-terra", effort: "max", images: [{ bytes: new Uint8Array([1, 2]), type: "image/png" }] });
const gen = await image("a look", [], { route: "openai", model: "gpt-image-2.5-sunburst" });
const edit = await image("a look", [{ bytes: new Uint8Array([9, 9, 9]), type: "image/png" }], { route: "openai", model: "gpt-image-2.5-sunburst" });
const first = seen[0].json;
const checks = {
  text: txt === "kit.object('ENV_x').commit();", polled: polls >= 2, background: first.background === true && first.store === true,
  effort: first.reasoning?.effort === "xhigh", image_part: first.input?.[0]?.content?.[1]?.type === "input_image",
  auth: seen.every((s) => s.auth === "Bearer test-key"), gen: Buffer.from(gen.bytes).toString() === "PNGDATA",
  edits_multipart: seen.some((s) => s.u === "/v1/images/edits" && s.ct === "multipart/form-data"), edit: Buffer.from(edit.bytes).toString() === "PNGDATA",
};
console.log(JSON.stringify(checks)); srv.close(); process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
