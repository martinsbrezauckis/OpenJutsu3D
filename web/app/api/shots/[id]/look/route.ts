import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { lookStill } from "@/lib/pipeline";
import { segmentFrame, shotDir } from "@/lib/render";
import { choose } from "@/lib/models";
import { fail, ok } from "@/lib/http";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 1800;
/** POST {prompt, size?} → look.png from the lit frame 0 (sized to the clip by the client before L2R). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const d = shotDir(id); const { prompt, use, size, format, seg, start, prevStart } = await req.json().catch(() => ({}));
    if (typeof prompt !== "string" || !prompt.trim()) return fail(new Error("no prompt"), 400);
    // Long shots: segment `seg` starts at frame `start`; its style reference is the previous segment's render at that moment.
    const k = Number.isInteger(seg) && seg > 0 && seg < 10 ? seg : 0, f = k ? Math.max(0, Math.min(3000, Number(start) || 0)) : 0;
    const lit = new Uint8Array(await readFile(join(d, "lit", `f${String(f).padStart(5, "0")}.jpg`)));
    const styleRef = k ? { bytes: await segmentFrame(id, k - 1, f - (Number(prevStart) || 0)), type: "image/png" } : undefined;
    const u = choose("look", use);
    const [img, cost] = await metered("look", u, () => lookStill(u, { bytes: lit, type: "image/jpeg" }, prompt,
      ["1536x1024", "1024x1536", "1024x1024"].includes(size) ? size : "1536x1024", styleRef,
      /^[0-9]{1,2}:[0-9]{1,2} [a-z]{3,10}$/.test(String(format)) ? String(format) : undefined));
    const name = k ? `look_raw_s${k}.png` : "look_raw.png";
    await writeFile(join(d, name), img.bytes);
    return ok({ raw: `/api/shots/${id}/file/${name}`, cost });
  } catch (e) { return fail(e); }
}
