/**
 * gltf-pack.ts — turn a multi-file glTF (JSON + .bin buffers + texture files) into ONE self-contained GLB, so every
 * model in a pack travels as a single file (the viewport receives GLB bytes; it never fetches anything itself).
 * All buffers are merged into the GLB's BIN chunk (bufferViews re-pointed), and image files become bufferViews too.
 * `resolve(uri)` returns the bytes of a file the glTF references (a download, a file next to it, …).
 */
type Json = Record<string, any>;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", ktx2: "image/ktx2" };
const pad4 = (n: number) => (n + 3) & ~3;

export async function gltfToGlb(gltf: Json, resolve: (uri: string) => Promise<Uint8Array>): Promise<Uint8Array> {
  const g: Json = structuredClone(gltf);
  const parts: Uint8Array[] = []; let size = 0;
  const append = (b: Uint8Array) => { const at = size; parts.push(b); size += b.length; const p = pad4(size) - size; if (p) { parts.push(new Uint8Array(p)); size += p; } return at; };
  const dataUri = (uri: string) => { const m = /^data:[^;]*;base64,(.*)$/.exec(uri); return m ? new Uint8Array(Buffer.from(m[1], "base64")) : null; };

  // 1. buffers → one: remember each old buffer's offset, then re-point every bufferView.
  const base: number[] = [];
  for (const b of g.buffers ?? []) {
    const bytes = b.uri ? (dataUri(b.uri) ?? await resolve(decodeURIComponent(b.uri))) : new Uint8Array(0);
    if (bytes.length < (b.byteLength ?? 0)) throw new Error(`buffer ${b.uri} is shorter than declared`);
    base.push(append(bytes.subarray(0, b.byteLength ?? bytes.length)));
  }
  for (const v of g.bufferViews ?? []) { v.byteOffset = (v.byteOffset ?? 0) + base[v.buffer ?? 0]; v.buffer = 0; }
  // 2. image files → bufferViews.
  for (const im of g.images ?? []) {
    if (!im.uri) continue;
    const bytes = dataUri(im.uri) ?? await resolve(decodeURIComponent(im.uri));
    const ext = (im.uri.split("?")[0].split(".").pop() ?? "").toLowerCase();
    g.bufferViews = g.bufferViews ?? [];
    g.bufferViews.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.length });
    im.bufferView = g.bufferViews.length - 1; im.mimeType = im.mimeType ?? MIME[ext] ?? "image/png"; delete im.uri;
  }
  g.buffers = [{ byteLength: size }];

  const bin = new Uint8Array(size); let o = 0; for (const p of parts) { bin.set(p, o); o += p.length; }
  let json = new TextEncoder().encode(JSON.stringify(g));
  if (json.length % 4) { const j = new Uint8Array(pad4(json.length)).fill(0x20); j.set(json); json = j; }
  const out = new Uint8Array(12 + 8 + json.length + 8 + bin.length), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, json.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(json, 20);
  dv.setUint32(20 + json.length, bin.length, true); dv.setUint32(24 + json.length, 0x004e4942, true); out.set(bin, 28 + json.length);
  return out;
}
