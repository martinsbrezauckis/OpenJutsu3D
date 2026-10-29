import { readFile } from "node:fs/promises";
import { deleteScene, loadScene, renameScene, thumbPath } from "@/lib/scenes";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
const BLANK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#2a2633"/></svg>';
/** DELETE → the scene moves to the trash folder (recoverable). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await deleteScene((await ctx.params).id); return ok({ deleted: true }); } catch (e) { return fail(e, 404); }
}
/** PATCH {title} → rename. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const { title } = await req.json().catch(() => ({})); await renameScene((await ctx.params).id, String(title ?? "")); return ok({ renamed: true }); }
  catch (e) { return fail(e, 400); }
}
/** GET → the saved scene; GET ?thumb=1 → its thumbnail JPEG. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (new URL(req.url).searchParams.get("thumb")) {
      // A scene saved before its first picture (an opened file, an early save) shows a plain card, not a broken image.
      const jpg = await thumbPath(id).then((p) => readFile(p)).catch(() => null);
      if (!jpg) return new Response(BLANK, { headers: { "content-type": "image/svg+xml", "cache-control": "no-store" } });
      return new Response(jpg, { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
    }
    return ok(await loadScene(id));
  } catch (e) { return fail(e, 404); }
}
