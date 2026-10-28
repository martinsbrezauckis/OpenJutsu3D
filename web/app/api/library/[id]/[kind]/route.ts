import { readFile } from "node:fs/promises";
import { itemFile } from "@/lib/library";
import { fail } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 300;
/** GET /api/library/<pack>.<item>/model | /preview → the model (GLB; Poly Haven models are fetched + packed on first use) or its picture. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string; kind: string }> }) {
  try {
    const { id, kind } = await ctx.params;
    if ((kind !== "model" && kind !== "preview") || !/^[a-z0-9_]{1,48}\.[A-Za-z0-9_-]{1,64}$/.test(id)) return fail(new Error("not found"), 404);
    const f = await itemFile(id, kind);
    if (f.url) return Response.redirect(f.url, 302);   // remote thumbnail (Poly Haven CDN)
    const type = kind === "model" ? "model/gltf-binary" : f.path!.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(await readFile(f.path!), { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });
  } catch (e) { return fail(e, 404); }
}
