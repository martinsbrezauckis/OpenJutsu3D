import { cutFrames, planSegments, stitch } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 600;
/** POST {n, fps, cuts?} → joins the shot's part renders into render.mp4 (same cuts as /encode = same plan): long shots
 *  and shots with camera cuts render in parts. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const { n, fps, cuts } = await req.json().catch(() => ({}));
    if (!Number.isInteger(n) || n < 2 || n > 60 * 48 + 1 || ![24, 48].includes(fps)) return fail(new Error("bad stitch request"), 400);
    const plan = planSegments(n, cutFrames(cuts, n));
    if (plan.length < 2) return fail(new Error("this shot renders in one piece: nothing to join"), 400);
    await stitch(id, plan, fps);
    return ok({ video: `/api/shots/${id}/file/render.mp4` });
  } catch (e) { return fail(e, 500); }
}
