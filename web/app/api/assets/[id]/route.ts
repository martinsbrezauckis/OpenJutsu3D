import { readFile } from "node:fs/promises";
import { uploadFile } from "@/lib/library";
import { fail } from "@/lib/http";
export const runtime = "nodejs";
/** GET → an imported model's GLB. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const { id } = await ctx.params; return new Response(await readFile(uploadFile(id)), { headers: { "content-type": "model/gltf-binary" } }); }
  catch (e) { return fail(e, 404); }
}
