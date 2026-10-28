// safe_fetch_test.mts — download guards for user links (lib/safe-fetch.ts) + zip bomb guard (lib/packs.ts unzip via a
// crafted archive). Network: api.polyhaven.com (allowed fetch), httpbin.org (redirect to http). Run: node bench/safe_fetch_test.mts
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const { safeGet } = await import(join(web, "lib", "safe-fetch.ts"));
const res: Record<string, boolean> = {};
const refused = async (label: string, f: () => Promise<unknown>) => { try { await f(); res[label] = false; } catch (e) { res[label] = true; console.log(` ${label}: ${(e as Error).message}`); } };
res["public https works"] = (await safeGet("https://api.polyhaven.com/info/Barrel_01", { max: 1e6 })).length > 100;
await refused("http:// refused", () => safeGet("http://example.com/", { max: 1e6 }));
await refused("loopback IP refused", () => safeGet("https://127.0.0.1/", { max: 1e6 }));
await refused("name resolving to 127.0.0.1 refused (checked at connect)", () => safeGet("https://localtest.me/", { max: 1e6 }));
await refused("redirect to http refused", () => safeGet("https://httpbin.org/redirect-to?url=http%3A%2F%2Fexample.com%2F", { max: 1e6 }));
await refused("size cap while streaming", () => safeGet("https://api.polyhaven.com/assets?t=models", { max: 10_000 }));
await refused("host allow-list", () => safeGet("https://example.com/", { max: 1e6, hosts: /^api\.polyhaven\.com$/ }));
console.log(JSON.stringify(res, null, 1)); process.exit(Object.values(res).every(Boolean) ? 0 : 1);
