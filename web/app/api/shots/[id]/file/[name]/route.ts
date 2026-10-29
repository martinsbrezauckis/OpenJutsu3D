import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shotDir } from "@/lib/render";
import { fail } from "@/lib/http";
export const runtime = "nodejs";
const TYPES: Record<string, string> = { "clay.mp4": "video/mp4", "lit.mp4": "video/mp4", "render.mp4": "video/mp4", "render48.mp4": "video/mp4",
  "look.png": "image/png", "look_raw.png": "image/png" };
/** GET one shot file — fixed allow-list of names, never a client path. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  try {
    const { id, name } = await ctx.params;
    // Long-shot segment files: one digit, fixed shapes only.
    const type = TYPES[name] ?? (/^(render|clay)_s\d\.mp4$/.test(name) ? "video/mp4" : /^look_raw_s\d\.png$/.test(name) ? "image/png" : undefined);
    if (!type) return fail(new Error("not found"), 404);
    return new Response(await readFile(join(shotDir(id), name)), { headers: { "content-type": type, "cache-control": "no-store" } });
  } catch (e) { return fail(e, 404); }
}
