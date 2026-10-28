/**
 * proxy.ts — request guard (Next 16 renamed middleware → proxy) for /api/* (security review 10-28). The API spends Comfy credits and runs local
 * tools, so it must only answer the app itself:
 *  - Host must be on the allow-list (loopback by default; APP_HOSTS=host:port,… for a deployment). This blocks DNS
 *    rebinding: a foreign site pointing its own name at 127.0.0.1 sends Host=<its name>.
 *  - A browser request carrying Origin must come from that same host (blocks cross-site form/fetch posts).
 *  - Origin "null" (sandboxed iframes, data: URLs) is refused: the app's own sandboxed viewport never calls the API.
 *  - Every POST must carry the custom header `X-O3J: 1` (the app's fetch wrapper adds it). A foreign page cannot send a
 *    custom header without a CORS preflight, which this server never approves — so no cross-site "simple request"
 *    (form post, multipart, no-cors fetch) can reach a state-changing route.
 *  - JSON routes must send Content-Type: application/json.
 * Requests without Origin (curl/scripts on this machine) are allowed if they send X-O3J: the server binds to 127.0.0.1.
 */
import { NextResponse, type NextRequest } from "next/server";

const allowed = () => new Set((process.env.APP_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean));
const isLoopback = (host: string) => /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host);

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (!isLoopback(host) && !allowed().has(host)) return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  const origin = req.headers.get("origin");
  if (origin === "null" || req.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "cross-origin request refused" }, { status: 403 });
  if (origin) {
    let oh = ""; try { oh = new URL(origin).host; } catch { /* malformed */ }
    if (oh !== host) return NextResponse.json({ error: "cross-origin request refused" }, { status: 403 });
  }
  // Every state-changing method (POST, PATCH, DELETE, …) needs the app's header, not only POST.
  if (req.method !== "GET" && req.headers.get("x-o3j") !== "1") return NextResponse.json({ error: "missing X-O3J header" }, { status: 403 });
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    const multipart = /\/frames$|\/render$|^\/api\/assets$/.test(req.nextUrl.pathname);
    if (!multipart && !ct.startsWith("application/json") && !/\/api\/shots$/.test(req.nextUrl.pathname))
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
