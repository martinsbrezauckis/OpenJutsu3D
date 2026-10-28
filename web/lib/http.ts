/** http.ts — small helpers shared by the API routes: JSON error replies with the right status. */
import { NextResponse } from "next/server";
export const fail = (e: unknown, status = 502) => {
  const msg = e instanceof Error ? e.message : String(e);
  const s = /COMFY_API_KEY|MissingCredentials/.test(msg) ? 503 : /insufficient_credits|402/.test(msg) ? 402 : status;
  return NextResponse.json({ error: msg.slice(0, 600) }, { status: s });
};
export const ok = (body: unknown, status = 200) => NextResponse.json(body, { status });

import type { Img } from "./llm";
/** Reference pictures sent by the client as data URLs: at most 2, PNG/JPEG/WebP, ≤ 8 MB each. */
export function readRefs(v: unknown): Img[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 2).map((s) => {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s));
    if (!m) throw new Error("reference must be a PNG, JPEG or WebP picture");
    const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
    if (bytes.length > 8_000_000) throw new Error("reference picture is larger than 8 MB");
    return { bytes, type: m[1] };
  });
}
