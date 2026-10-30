import { image } from "@/lib/llm";
import { choose } from "@/lib/models";
import { fail, readRefs } from "@/lib/http";
import { refList } from "@/lib/refs";
import { metered } from "@/lib/cost";
export const runtime = "nodejs";
export const maxDuration = 900;
const STYLE = "Wide 16:9 cinematic concept frame of this set, photoreal film still, establishing view that shows the whole place clearly — its layout, scale, density, hero element, materials, light and mood. No text, no captions, no labels, no UI, no watermark. Set description: ";
/** POST {brief, use?, refs?} → PNG concept picture ("is this close to your idea?"; same wording as bench/concept.py). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.brief !== "string" || !b.brief.trim()) return fail(new Error("no brief"), 400);
  try {
    const refs = readRefs(b.refs);
    const use = await choose("look", b.use);
    const [img, cost] = await metered("concept", use, () => image(STYLE + b.brief + (refs.length === 1 && !refs[0].label ? " Match the style of the reference picture."
      : refs.length ? ` Match the style of the reference pictures, and give the people, things and places they show their look (${refList(refs, 1)}).` : ""), refs,
      { ...use, quality: "medium", size: "1536x1024" }));
    // The body is the picture, so its cost travels in a header.
    return new Response(Buffer.from(img.bytes), { headers: { "content-type": img.type, "x-o3j-cost": JSON.stringify(cost) } });
  } catch (e) { return fail(e); }
}
