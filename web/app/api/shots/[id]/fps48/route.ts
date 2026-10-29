import { make48 } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 1800;
/** POST → 48 fps copy of the shot's finished render.mp4 (render48.mp4 next to the 24 fps original) + how it was made. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const { id } = await ctx.params; const { method, model, ms, why } = await make48(id);
    return ok({ video48: `/api/shots/${id}/file/render48.mp4`, method, model, ms, why }); }
  catch (e) { return fail(e, 500); }
}
