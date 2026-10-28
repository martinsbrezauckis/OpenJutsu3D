import { estimate } from "@/lib/cost";
import { choose } from "@/lib/models";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** GET ?stage=build|director|change|concept|look&route=&model= → {estimate: {credits, usd, runs} | null} (mean of the last 5 runs here). */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams; const stage = q.get("stage") || "build";
    const use = choose(stage === "look" || stage === "concept" ? "look" : stage === "director" ? "director" : "builder", { route: q.get("route") ?? undefined, model: q.get("model") ?? undefined });
    return ok({ stage, ...use, estimate: await estimate(stage, use.route, use.model) });
  } catch (e) { return fail(e); }
}
