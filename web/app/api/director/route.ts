import { director } from "@/lib/pipeline";
import { choose } from "@/lib/models";
import { fail, ok, readRefs } from "@/lib/http";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 900;
/** POST {prompt, answers?, use?: {route, model}, refs?: [dataURL], mode?: auto|ask|go} → brief + batches, or ≤3 questions. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.prompt !== "string" || !b.prompt.trim() || b.prompt.length > 4000) return fail(new Error("Describe the place (1–4000 characters)."), 400);
  try {
    const use = await choose("director", b.use);
    const [d, cost] = await metered("director", use, () => director(use, b.prompt, b.answers && typeof b.answers === "object" ? b.answers : undefined, readRefs(b.refs),
      ["ask", "go"].includes(b.mode) ? b.mode : "auto"));
    return ok({ ...d, cost });
  } catch (e) { return fail(e); }
}
