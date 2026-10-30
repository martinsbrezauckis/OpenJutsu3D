import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { lookPrompt, lookStill } from "@/lib/pipeline";
import { segmentFrame, shotDir } from "@/lib/render";
import { choose } from "@/lib/models";
import { fail, ok, readRefs } from "@/lib/http";
import type { Ref } from "@/lib/refs";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 1800;
/** POST {prompt, size?, refs?} → look.png from the lit frame 0 (sized to the clip by the client before L2R).
 *  refs = the user's appearance references (≤ 5, lib/refs.ts), sent to the same look route as the lit frame. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; const d = shotDir(id); const { prompt, use, size, format, seg, start, prevStart, cut, refs: rawRefs } = await req.json().catch(() => ({}));
    if (typeof prompt !== "string" || !prompt.trim()) return fail(new Error("no prompt"), 400);
    let refs: Ref[]; try { refs = readRefs(rawRefs); } catch (e) { return fail(e, 400); }
    // Long shots: segment `seg` starts at frame `start`; its style reference is the previous segment's render at that moment.
    const k = Number.isInteger(seg) && seg > 0 && seg < 100 ? seg : 0, f = k ? Math.max(0, Math.min(3000, Number(start) || 0)) : 0;
    const lit = new Uint8Array(await readFile(join(d, "lit", `f${String(f).padStart(5, "0")}.jpg`)));
    // After a camera cut the previous part's frame at `start` is already the new camera (1-frame overlap): take the
    // frame before it, the old camera's last moment, as the reference for people and look.
    const afterCut = Boolean(k && cut === true);
    const styleRef = k ? { bytes: await segmentFrame(id, k - 1, Math.max(0, f - (Number(prevStart) || 0) - (afterCut ? 1 : 0))), type: "image/png" } : undefined;
    // Identity anchor: every later part also gets part 0's look still as the first appearance reference, so people,
    // costumes and colours stay the same across cuts (one look per cut re-invented the person each time, 10-29 hotel).
    if (k) {
      const anchor = await readFile(join(d, "look_s0.png")).catch(() => null);
      if (anchor) refs = [{ bytes: new Uint8Array(anchor), type: "image/png", label: "the opening shot of this same scene" }, ...refs];
    }
    const u = await choose("look", use);
    const sz = ["1536x1024", "1024x1536", "1024x1024"].includes(size) ? size : "1536x1024";
    const fmt = /^[0-9]{1,2}:[0-9]{1,2} [a-z]{3,10}$/.test(String(format)) ? String(format) : undefined;
    const name = k ? `look_raw_s${k}` : "look_raw";
    // What the image model was given (pictures by hash, not bytes): which references shaped this take.
    const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").slice(0, 16);
    await writeFile(join(d, `${name}.json`), JSON.stringify({ at: new Date().toISOString(), route: u.route, model: u.model, prompt: lookPrompt(prompt, sz, styleRef, fmt, refs, afterCut),
      images: [{ role: "layout", type: "image/jpeg", bytes: lit.length, sha: sha(lit) }, ...(styleRef ? [{ role: afterCut ? "previous camera" : "previous segment", type: styleRef.type, bytes: styleRef.bytes.length, sha: sha(styleRef.bytes) }] : []),
        ...refs.map((r) => ({ role: "reference", label: r.label ?? null, type: r.type, bytes: r.bytes.length, sha: sha(r.bytes) }))] }, null, 1));
    const [img, cost] = await metered("look", u, () => lookStill(u, { bytes: lit, type: "image/jpeg" }, prompt, sz, styleRef, fmt, refs, afterCut));
    await writeFile(join(d, `${name}.png`), img.bytes);
    return ok({ raw: `/api/shots/${id}/file/${name}.png`, refs: refs.length, cost });
  } catch (e) { return fail(e); }
}
