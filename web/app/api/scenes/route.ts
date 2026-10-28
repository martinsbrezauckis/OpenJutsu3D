import { listScenes, saveScene } from "@/lib/scenes";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** GET → saved scenes (newest first). POST {id?, title, prompt, brief, versions, head, chat, takes, thumb?: dataURL} → {id}. */
export async function GET() { try { return ok({ scenes: await listScenes() }); } catch (e) { return fail(e, 500); } }
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.title !== "string" || !Array.isArray(b.versions) || !b.versions.length || JSON.stringify(b).length > 20_000_000)
    return fail(new Error("bad scene"), 400);
  try {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.thumb || ""));
    const id = await saveScene({ id: b.id, title: b.title.slice(0, 120), prompt: String(b.prompt || ""), brief: b.brief ?? null,
      versions: b.versions, head: Number(b.head) || 0, chat: Array.isArray(b.chat) ? b.chat : [], takes: Array.isArray(b.takes) ? b.takes : [],
      aspect: ["16:9", "9:16", "1:1"].includes(b.aspect) ? b.aspect : "16:9",
      spend: b.spend && typeof b.spend === "object" ? { credits: Number(b.spend.credits) || 0, usd: Number(b.spend.usd) || 0, unreported: Number(b.spend.unreported) || 0 } : undefined },
      m ? new Uint8Array(Buffer.from(m[1], "base64")) : undefined);
    return ok({ id });
  } catch (e) { return fail(e, 500); }
}
