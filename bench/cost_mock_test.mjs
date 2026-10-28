// cost_mock_test.mjs — P6 metering without spending: Router credit headers (priced / unreported / replayed), OpenAI usage
// → USD for gpt-6.1-terra via a mock server, and estimate() from the costs log. No network, no key.
// Run: node bench/cost_mock_test.mjs   (copies web/lib/{llm,cost,render,models}.ts to a scratch dir with .ts import
// extensions so Node ≥ 23 can strip the types; scratch = web/.cost-test, gitignored).
import { cpSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import http from "node:http";

const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
// Inside web/ (packages resolve), not node_modules (Node will not strip types there); gitignored.
const scratch = join(web, ".cost-test"); mkdirSync(scratch, { recursive: true });
for (const f of ["llm", "cost", "render", "models"]) {
  const src = readFileSync(join(web, "lib", `${f}.ts`), "utf8").replace(/from "\.\/(llm|cost|render|models)"/g, 'from "./$1.ts"');
  writeFileSync(join(scratch, `${f}.ts`), src);
}
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "o3j-cost-"));

const srv = http.createServer(async (req, res) => {
  for await (const _ of req) { /* drain */ }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: "r1", status: "completed", usage: { input_tokens: 200_000, output_tokens: 40_000 },
    output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }] }));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
process.env.OPENAI_BASE_URL = `http://127.0.0.1:${srv.address().port}/v1`; process.env.OPENAI_API_KEY = "test";

const cost = await import(join(scratch, "cost.ts"));
const { complete } = await import(join(scratch, "llm.ts"));
const [, router] = await cost.metered("build", { route: "router", model: "openai/gpt-6-sol" }, async () => {
  cost.reportRouter("12.5"); cost.reportRouter(null); cost.reportRouter("99", true); cost.reportRouter("0");
});
const [txt, oa] = await cost.metered("build", { route: "openai", model: "gpt-6.1-terra" },
  () => complete("x", { route: "openai", model: "gpt-6.1-terra" }));
// estimate ignores runs with unreported calls, so log two clean Router runs
for (const c of ["100", "300"]) await cost.metered("build", { route: "router", model: "openai/gpt-6-sol" }, async () => cost.reportRouter(c));
const est = await cost.estimate("build", "router", "openai/gpt-6-sol");
const none = await cost.estimate("build", "router", "openai/gpt-6-astra");
const checks = {
  router_priced_sum: router.credits === 12.5, router_null_is_unreported_not_free: router.unreported === 1,
  router_replay_not_charged: router.calls === 4, router_zero_is_a_real_price: router.unreported === 1,
  openai_usd: Math.abs(oa.usd - (200_000 * 1 + 40_000 * 5) / 1e6) < 1e-9 && txt === "ok",
  estimate_mean_of_clean_runs: est && est.credits === 200 && est.runs === 2, no_history_is_null: none === null,
};
console.log(JSON.stringify(checks)); srv.close();
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
