import { newShot } from "@/lib/render";
import { fail, ok } from "@/lib/http";
export const runtime = "nodejs";
/** POST → {id}: a fresh shot folder for one camera move. */
export async function POST() { try { return ok({ id: await newShot() }); } catch (e) { return fail(e, 500); } }
