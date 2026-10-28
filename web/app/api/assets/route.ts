import { saveUpload } from "@/lib/library";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** POST multipart: file (.glb ≤ 100 MB), name?, height? → {id: 'up:<sha16>'} (import your own model). */
export async function POST(req: Request) {
  try {
    const form = await req.formData(); const f = form.get("file");
    if (!(f instanceof File) || f.size > 100_000_000) return fail(new Error("a .glb file up to 100 MB"), 400);
    const b = new Uint8Array(await f.arrayBuffer());
    if (String.fromCharCode(...b.slice(0, 4)) !== "glTF") return fail(new Error("that is not a binary glTF (.glb) file"), 400);
    const h = Number(form.get("height"));
    const id = await saveUpload(b, String(form.get("name") || f.name.replace(/\.glb$/i, "")), Number.isFinite(h) && h > 0 ? h : undefined);
    return ok({ id: `up:${id}` });
  } catch (e) { return fail(e); }
}
