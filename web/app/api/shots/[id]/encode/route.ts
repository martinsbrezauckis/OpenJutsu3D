import { cutFrames, encodeFrames, encodeSegment, planSegments } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** POST {fps, n?, cuts?} → encodes clay.mp4 and lit.mp4 from the uploaded frames; when the shot renders in parts
 *  (n > 361 frames, or camera cuts) also each part's clay (clay_s<k>.mp4) and returns the plan [[start, len], …]. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const { fps, n, cuts } = await req.json().catch(() => ({}));
    if (![24, 48].includes(fps)) return fail(new Error("fps must be 24 or 48"), 400);
    await encodeFrames(id, "clay", fps); await encodeFrames(id, "lit", fps);
    const plan = Number.isInteger(n) && n > 1 && n <= 60 * 48 + 1 ? planSegments(n, cutFrames(cuts, n)) : [];
    const segs = plan.length > 1 ? plan : null;
    if (segs) for (const [k, [s, len]] of segs.entries()) await encodeSegment(id, k, s, len, fps);
    return ok({ clay: `/api/shots/${id}/file/clay.mp4`, lit: `/api/shots/${id}/file/lit.mp4`, segs });
  } catch (e) { return fail(e, 500); }
}
