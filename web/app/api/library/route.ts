import { credits, libraryOn, search, uploads } from "@/lib/library";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** GET ?q=&limit= → {on, items: [{id, name, category, tags, height, mb, pack, preview}], uploads, credit} (enabled packs). */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const limit = Math.min(80, Math.max(1, Number(q.get("limit")) || 40));
    return ok({ on: await libraryOn(), items: await search(q.get("q") ?? "", limit), uploads: await uploads(), credit: await credits() });
  } catch (e) { return fail(e); }
}
