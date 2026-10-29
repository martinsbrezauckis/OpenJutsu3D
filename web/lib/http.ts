/** http.ts — small helpers shared by the API routes: JSON error replies with the right status. */
import { NextResponse } from "next/server";
export const fail = (e: unknown, status = 502) => {
  const msg = e instanceof Error ? e.message : String(e);
  const s = /COMFY_API_KEY|MissingCredentials/.test(msg) ? 503 : /insufficient_credits|402/.test(msg) ? 402 : status;
  return NextResponse.json({ error: msg.slice(0, 600) }, { status: s });
};
export const ok = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Reference pictures (lib/refs.ts): up to 5 per request, checked by type, size and file bytes. */
export { readRefs } from "./refs";
