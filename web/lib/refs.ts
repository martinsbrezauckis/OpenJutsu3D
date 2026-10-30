/**
 * refs.ts — reference pictures (your uploads or past generations): up to MAX_REFS per request, sent by
 * the client as PNG/JPEG/WebP data URLs (≤ 8 MB each, bytes must match the declared type), each with an optional
 * short label ("the woman", "her handbag"). They reach the director, concept, build and every render's look still.
 */
import type { Img } from "./llm";

export const MAX_REFS = 5;
export type Ref = Img & { label?: string };
const DATA = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
};
/** A label is prompt text: one short line, no control characters or quotes. */
export const refLabel = (s: unknown) => String(s ?? "").replace(/[\u0000-\u001f\u007f"`]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/** Each item is a data URL or {url, label?}; anything else, a 6th picture or a mislabelled file is refused. */
export function readRefs(v: unknown): Ref[] {
  if (!Array.isArray(v)) return [];
  if (v.length > MAX_REFS) throw new Error(`at most ${MAX_REFS} reference pictures`);
  return v.map((r) => {
    const o = (typeof r === "string" ? { url: r } : r ?? {}) as { url?: unknown; label?: unknown };
    const m = DATA.exec(String(o.url ?? ""));
    if (!m) throw new Error("reference must be a PNG, JPEG or WebP picture");
    const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
    if (bytes.length > 8_000_000) throw new Error("reference picture is larger than 8 MB");
    if (!MAGIC[m[1]](bytes)) throw new Error("reference picture is not the image type it claims to be");
    const label = refLabel(o.label);
    return label ? { bytes, type: m[1], label } : { bytes, type: m[1] };
  });
}
/** Saved with a scene: the same checks, kept as {url, label} (the scene file stays the client's own format). */
export function sceneRefs(v: unknown): { url: string; label?: string }[] {
  const ok = readRefs(v); if (!ok.length) return [];
  return (v as { url?: string; label?: string }[] | string[]).map((r, k) => {
    const url = typeof r === "string" ? r : String(r.url); return ok[k].label ? { url, label: ok[k].label } : { url };
  });
}

/** "picture 3 = the woman; picture 4" — which attached picture is which (`first` = number of the first reference). */
export const refList = (refs: { label?: string }[], first: number) =>
  refs.map((r, k) => `picture ${first + k}${r.label ? ` = ${r.label}` : ""}`).join("; ");

/** Look still: what the user's references change in the photoreal frame (appearance only, never the layout). */
export function lookRefsNote(refs: { label?: string }[], first: number): string {
  if (!refs.length) return "";
  return ` APPEARANCE REFERENCES (${refList(refs, first)}): the user's pictures of people, things or places that appear `
    + "in this frame. Where the first picture shows that person, object or place, give it the look of its reference: face, "
    + "hair, skin, clothing, colours, materials and design. They change appearance only: keep every position, size, pose, "
    + "silhouette and the framing from the first picture, and never add anything from a reference that the first picture "
    + "does not already show.";
}
