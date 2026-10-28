import { changeScene } from "@/lib/pipeline";
import { choose } from "@/lib/models";
import { fail, ok, readRefs } from "@/lib/http";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 1800;
/** POST {prompt, brief, codeSoFar, request, use?, refs?} → {code}: blocks that apply a chat change to the set. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.request !== "string" || !b.request.trim() || b.request.length > 2000 || typeof b.codeSoFar !== "string" || !b.codeSoFar.trim())
    return fail(new Error("Say what to change (1–2000 characters)."), 400);
  try {
    const use = choose("builder", b.use);
    const [code, cost] = await metered("change", use, () => changeScene(use, { prompt: String(b.prompt || ""), brief: String(b.brief || ""),
      codeSoFar: b.codeSoFar, request: b.request, refs: readRefs(b.refs) }));
    return ok({ code, cost });
  } catch (e) { return fail(e); }
}
