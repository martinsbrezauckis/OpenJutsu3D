import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fetchResult, jobState, shotDir } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** GET → job state; once succeeded, downloads render.mp4 into the shot folder and returns its URL. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const d = shotDir(id);
    const q = new URL(req.url).searchParams.get("seg"); const seg = q !== null && /^\d$/.test(q) ? Number(q) : undefined;   // long-shot segment
    const file = seg === undefined ? "render.mp4" : `render_s${seg}.mp4`;
    if (await stat(join(d, file)).then(() => true, () => false)) return ok({ status: "succeeded", video: `/api/shots/${id}/file/${file}` });
    const { jobId } = JSON.parse(await readFile(join(d, seg === undefined ? "job.json" : `job_s${seg}.json`), "utf8"));
    const s = await jobState(jobId);
    if (s.status === "succeeded") { await fetchResult(id, jobId, seg); return ok({ status: "succeeded", video: `/api/shots/${id}/file/${file}` }); }
    return ok({ status: s.status, error: s.error ?? null });
  } catch (e) { return fail(e); }
}
