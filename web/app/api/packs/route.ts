import { KNOWN, addFolderPack, addLinkPack, addPolyHaven, packs, removePack, setPack } from "@/lib/packs";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 1800;
/** GET → {packs, known}. */
export async function GET() { try { return ok({ packs: await packs(), known: KNOWN }); } catch (e) { return fail(e); } }
/** POST {kind: 'known', id} | {kind: 'folder', path, name?, licence, credit, catalog?} | {kind: 'link', url, name?, licence, credit}
 *  → {pack}. A folder / link pack needs the licence and credit the user states for it (shown with its models). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  try {
    if (b.kind === "known") {
      if (b.id === "polyhaven") return ok({ pack: await addPolyHaven() });
      return fail(new Error("that pack is added from its folder after you download it"), 400);
    }
    const licence = text(b.licence, 80), credit = text(b.credit);
    if (!licence || !credit) return fail(new Error("say the pack's licence and who to credit"), 400);
    if (b.kind === "folder") return ok({ pack: await addFolderPack({ path: text(b.path, 1000), name: text(b.name, 60) || undefined, licence, credit,
      catalog: text(b.catalog, 1000) || undefined }) });
    if (b.kind === "link") return ok({ pack: await addLinkPack({ url: text(b.url, 2000), name: text(b.name, 60) || undefined, licence, credit }) });
    return fail(new Error("unknown pack kind"), 400);
  } catch (e) { return fail(e); }
}
/** PATCH {id, enabled?, builder?}; DELETE ?id= (removes the pack's index and downloads; a folder pack's folder stays). */
export async function PATCH(req: Request) {
  const b = await req.json().catch(() => ({}));
  try { await setPack(String(b.id), { enabled: b.enabled, builder: b.builder }); return ok({ packs: await packs() }); } catch (e) { return fail(e); }
}
export async function DELETE(req: Request) {
  try { await removePack(String(new URL(req.url).searchParams.get("id"))); return ok({ packs: await packs() }); } catch (e) { return fail(e); }
}
