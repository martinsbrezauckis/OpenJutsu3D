import { askAbout } from "@/lib/pipeline";
import { choose } from "@/lib/models";
import { fail, ok } from "@/lib/http";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 600;
/** POST {question, prompt?, brief?, code?, use?} → {answer, cost}: Ask mode — talk about the set without changing it. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.question !== "string" || !b.question.trim() || b.question.length > 2000) return fail(new Error("Ask a question (1–2000 characters)."), 400);
  try {
    const use = await choose("director", b.use);
    const [answer, cost] = await metered("ask", use, () => askAbout(use, { prompt: String(b.prompt || ""), brief: typeof b.brief === "string" ? b.brief : undefined,
      code: typeof b.code === "string" ? b.code : undefined, question: b.question }));
    return ok({ answer, cost });
  } catch (e) { return fail(e); }
}
