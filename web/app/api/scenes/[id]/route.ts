import { readFile } from "node:fs/promises";
import { loadScene, thumbPath } from "@/lib/scenes";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** GET → the saved scene; GET ?thumb=1 → its thumbnail JPEG. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (new URL(req.url).searchParams.get("thumb")) return new Response(await readFile(await thumbPath(id)), { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
    return ok(await loadScene(id));
  } catch (e) { return fail(e, 404); }
}
