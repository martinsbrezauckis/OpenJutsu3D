import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { shotDir, submitL2R } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 300;
/** POST multipart: look (PNG at the clip's size, resized by the client), prompt → LTX L2R job via the Comfy SDK. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const d = shotDir(id);
    const form = await req.formData(); const look = form.get("look"); const prompt = String(form.get("prompt") || "");
    const s = Number(form.get("seg")); const seg = Number.isInteger(s) && s >= 0 && s < 100 && form.has("seg") ? s : undefined;
    if (!(look instanceof File) || look.size > 20_000_000 || !prompt.trim()) return fail(new Error("need look PNG and prompt"), 400);
    await writeFile(join(d, seg === undefined ? "look.png" : `look_s${seg}.png`), new Uint8Array(await look.arrayBuffer()));
    if (seg === 0) await writeFile(join(d, "look.png"), new Uint8Array(await look.arrayBuffer()));   // the take's thumbnail
    return ok(await submitL2R(id, prompt, seg), 202);
  } catch (e) { return fail(e); }
}
