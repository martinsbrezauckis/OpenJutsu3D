import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { shotDir } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** POST multipart: mode=clay|lit, start=<first frame index>, files f (JPEG, in order) → saved as <mode>/f%05d.jpg. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const d = shotDir(id);
    const form = await req.formData(); const mode = String(form.get("mode")); const start = Number(form.get("start"));
    if (!["clay", "lit"].includes(mode) || !Number.isInteger(start) || start < 0 || start > 2000) return fail(new Error("bad frames request"), 400);
    const files = form.getAll("f").filter((f): f is File => f instanceof File);
    if (!files.length || files.length > 64) return fail(new Error("1–64 frames per request"), 400);
    for (const [k, f] of files.entries()) {
      const b = new Uint8Array(await f.arrayBuffer());
      // Check the bytes, not the declared type: PNGs labelled image/jpeg got through once and broke ffmpeg (10-28).
      if (f.size > 4_000_000 || b[0] !== 0xff || b[1] !== 0xd8) return fail(new Error("frames must be JPEG ≤ 4 MB"), 400);
      await writeFile(join(d, mode, `f${String(start + k).padStart(5, "0")}.jpg`), b);
    }
    return ok({ saved: files.length });
  } catch (e) { return fail(e, 500); }
}
