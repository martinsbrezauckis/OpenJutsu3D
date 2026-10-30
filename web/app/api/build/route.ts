import { buildBatch } from "@/lib/pipeline";
import { choose } from "@/lib/models";
import { fail, ok, readRefs } from "@/lib/http";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 1800;
/** POST {prompt, brief, batches[], index, codeSoFar, use?, refs?} → {code} (new //@@ blocks for batch `index`). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.prompt !== "string" || typeof b.brief !== "string" || !Array.isArray(b.batches) || !Number.isInteger(b.index)
      || b.index < 0 || b.index >= b.batches.length || typeof (b.codeSoFar ?? "") !== "string") return fail(new Error("bad build request"), 400);
  try {
    const use = await choose("builder", b.use);
    const [code, cost] = await metered("build", use, () => buildBatch(use, { prompt: b.prompt, brief: b.brief, batches: b.batches.map(String),
      index: b.index, codeSoFar: b.codeSoFar ?? "", refs: readRefs(b.refs) }));
    return ok({ code, cost });
  } catch (e) { return fail(e); }
}
