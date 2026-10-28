import { encodeFrames, encodeSegment, planSegments } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** POST {fps, n?} → encodes clay.mp4 and lit.mp4 from the uploaded frames; with n > 361 frames also the clay of each
 *  long-shot segment (clay_s<k>.mp4) and returns the segment plan [[start, len], …]. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const { fps, n } = await req.json().catch(() => ({}));
    if (![24, 48].includes(fps)) return fail(new Error("fps must be 24 or 48"), 400);
    await encodeFrames(id, "clay", fps); await encodeFrames(id, "lit", fps);
    const segs = Number.isInteger(n) && n > 361 && n <= 60 * 48 + 1 ? planSegments(n) : null;
    if (segs) for (const [k, [s, len]] of segs.entries()) await encodeSegment(id, k, s, len, fps);
    return ok({ clay: `/api/shots/${id}/file/clay.mp4`, lit: `/api/shots/${id}/file/lit.mp4`, segs });
  } catch (e) { return fail(e, 500); }
}
