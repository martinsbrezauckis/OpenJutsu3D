import { listScenes, saveScene, type Shot } from "@/lib/scenes";
import { fail, ok } from "@/lib/http";
import { sceneRefs } from "@/lib/refs";
export const runtime = "nodejs";
/** GET → saved scenes (newest first). POST {id?, title, prompt, brief, versions, head, chat, takes, refs?, shot?, thumb?: dataURL} → {id}. */
const CAM = /^CAM_[A-Za-z0-9_]{1,60}$/;
/** The shot bar as it was left: {cam, recipe: [{move, seconds, cam?}]} (moves are checked again where they are used). */
function cleanShot(x: unknown): Shot | undefined {
  const s = x as { cam?: unknown; recipe?: unknown } | null;
  if (!s || typeof s !== "object" || !Array.isArray(s.recipe) || !s.recipe.length || s.recipe.length > 60) return undefined;
  const recipe = (s.recipe as { move?: unknown; seconds?: unknown; cam?: unknown }[]).map((r) => ({ move: String(r?.move ?? ""), seconds: Number(r?.seconds),
    ...(typeof r?.cam === "string" && CAM.test(r.cam) ? { cam: r.cam } : {}) }));
  if (recipe.some((r) => !/^[a-z-]{2,30}$/.test(r.move) || !(r.seconds >= 1 && r.seconds <= 60))) return undefined;
  return { cam: typeof s.cam === "string" && CAM.test(s.cam) ? s.cam : null, recipe };
}
export async function GET() { try { return ok({ scenes: await listScenes() }); } catch (e) { return fail(e, 500); } }
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.title !== "string" || !Array.isArray(b.versions) || !b.versions.length || JSON.stringify(b).length > 20_000_000)
    return fail(new Error("bad scene"), 400);
  try {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.thumb || ""));
    let refs; try { refs = sceneRefs(b.refs); } catch (e) { return fail(e, 400); }
    const id = await saveScene({ id: b.id, title: b.title.slice(0, 120), prompt: String(b.prompt || ""), brief: b.brief ?? null,
      versions: b.versions, head: Number(b.head) || 0, chat: Array.isArray(b.chat) ? b.chat : [], takes: Array.isArray(b.takes) ? b.takes : [], refs,
      aspect: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].includes(b.aspect) ? b.aspect : "16:9",
      spend: b.spend && typeof b.spend === "object" ? { credits: Number(b.spend.credits) || 0, usd: Number(b.spend.usd) || 0, unreported: Number(b.spend.unreported) || 0 } : undefined,
      shot: cleanShot(b.shot) },
      m ? new Uint8Array(Buffer.from(m[1], "base64")) : undefined);
    return ok({ id });
  } catch (e) { return fail(e, 500); }
}
