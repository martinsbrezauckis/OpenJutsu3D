/**
 * api-client.ts — the ONLY way client components call the app's API. Adds the `X-O3J: 1` header that proxy.ts
 * requires on every POST (a foreign page cannot send it without a CORS preflight the server never approves).
 */
export async function api<T = unknown>(path: string, init: { json?: unknown; form?: FormData; method?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-O3J": "1" };
  let body: BodyInit | undefined;
  if (init.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(init.json); }
  else if (init.form) body = init.form;
  const res = await fetch(path, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(ct.includes("json") ? (await res.json()).error ?? res.statusText : res.statusText);
  if (ct.includes("json")) return (await res.json()) as T;
  // Binary answers (pictures) carry their model cost in a header (lib/cost.ts); expose it as blob.cost.
  const blob = await res.blob(); const c = res.headers.get("x-o3j-cost");
  if (c) try { (blob as Blob & { cost?: unknown }).cost = JSON.parse(c); } catch { /* no cost */ }
  return blob as T;
}
