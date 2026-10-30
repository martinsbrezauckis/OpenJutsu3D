/**
 * packs.ts — model PACKS for the asset library (server only). The app ships with one small built-in pack (Samples:
 * Poly Haven CC0 models in web/packs/samples); everything else is the user's choice:
 *   folder    a folder of .glb files on this machine (optionally with a catalog.json / library.json naming them)
 *   link      a .glb or a .zip downloaded from a URL (glTF/GLB files inside are packed to GLB and indexed)
 *   polyhaven the Poly Haven model library (CC0) via its public API; a model is fetched and packed on first use
 * Registry: DATA_DIR/packs/packs.json. Every pack records its licence + credit (shown in the library panel) and can be
 * switched off, or kept out of the builder's suggestions. Item ids are '<pack>.<item>' (scene code: kit.model(…,
 * 'lib:<pack>.<item>', …)). Files are read only from a pack's own folder — never from a client-supplied path.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";
import { DATA_DIR } from "./render";
import { gltfToGlb } from "./gltf-pack";
import { safeGet } from "./safe-fetch";

export type PackItem = { id: string; file: string; preview?: string; name: string; tags?: string[]; category?: string;
  height_m?: number; style?: string; bytes: number };
export type Pack = { id: string; name: string; kind: "samples" | "folder" | "link" | "polyhaven"; root: string; licence: string;
  credit: string; source?: string; enabled: boolean; builder: boolean; count: number; added: string };

const DIR = () => join(DATA_DIR, "packs");
const REG = () => join(DIR(), "packs.json");
const SAMPLES = () => join(process.cwd(), "packs", "samples");
const UA = { "User-Agent": "openjutsu3d (asset library)" };

/** Packs the user can add with one click (licence shown before adding). */
export const KNOWN = [
  { id: "polyhaven", name: "Poly Haven models", licence: "CC0", credit: "Poly Haven (polyhaven.com)", size: "~520 models, fetched one by one when used",
    how: "added directly" },
  { id: "scenario", name: "Scenario 3D Collection", licence: "CC BY 4.0", credit: "Scenario", size: "1,342 models, ~37 GB",
    how: "download it from huggingface.co/datasets/scenario-labs/3d-collection, then add its folder", url: "https://huggingface.co/datasets/scenario-labs/3d-collection" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "pack";
const itemId = (rel: string) => slug(rel.replace(/\.(glb|gltf)$/i, "")).slice(0, 40) + "_" + createHash("sha1").update(rel).digest("hex").slice(0, 6);
const nameOf = (rel: string) => rel.split("/").pop()!.replace(/\.(glb|gltf)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
const inside = (root: string, p: string) => { const r = resolve(root), q = resolve(root, p); if (q !== r && !q.startsWith(r + sep)) throw new Error("not found"); return q; };

// ---------------- registry ----------------
async function readReg(): Promise<Pack[]> { return JSON.parse(await readFile(REG(), "utf8").catch(() => "[]")); }
async function writeReg(p: Pack[]) { await mkdir(DIR(), { recursive: true }); await writeFile(REG(), JSON.stringify(p, null, 1)); }
const indexFile = (p: Pack) => (p.kind === "samples" ? join(SAMPLES(), "index.json") : join(DIR(), p.id, "index.json"));
let cache: { at: number; items: (PackItem & { pack: Pack })[] } | null = null;

export async function packs(): Promise<Pack[]> {
  const reg = await readReg();
  const samples = await readFile(join(SAMPLES(), "index.json"), "utf8").then((s) => JSON.parse(s) as PackItem[]).catch(() => null);
  const builtIn: Pack[] = samples ? [{ id: "samples", name: "Samples", kind: "samples", root: SAMPLES(), licence: "CC0", credit: "Poly Haven (polyhaven.com)",
    enabled: reg.find((p) => p.id === "samples")?.enabled ?? true, builder: reg.find((p) => p.id === "samples")?.builder ?? true, count: samples.length, added: "" }] : [];
  return [...builtIn, ...reg.filter((p) => p.id !== "samples")];
}
/** All items of the enabled packs (cached 30 s). */
export async function allItems() {
  if (cache && Date.now() - cache.at < 30_000) return cache.items;
  const out: (PackItem & { pack: Pack })[] = [];
  for (const p of (await packs()).filter((x) => x.enabled)) {
    const items = JSON.parse(await readFile(indexFile(p), "utf8").catch(() => "[]")) as PackItem[];
    for (const it of items) out.push({ ...it, pack: p });
  }
  cache = { at: Date.now(), items: out }; return out;
}
const invalidate = () => { cache = null; };

export async function setPack(id: string, patch: { enabled?: boolean; builder?: boolean }) {
  const reg = await readReg(); let p = reg.find((x) => x.id === id);
  if (!p && id === "samples") { p = { ...(await packs())[0] }; reg.push(p); }
  if (!p) throw new Error("no such pack");
  if (typeof patch.enabled === "boolean") p.enabled = patch.enabled;
  if (typeof patch.builder === "boolean") p.builder = patch.builder;
  await writeReg(reg); invalidate();
}
export async function removePack(id: string) {
  if (id === "samples") throw new Error("the built-in samples can be switched off, not removed");
  const reg = await readReg(); const p = reg.find((x) => x.id === id); if (!p) return;
  await writeReg(reg.filter((x) => x.id !== id));
  await rm(join(DIR(), p.id), { recursive: true, force: true });   // the pack's index + downloaded files; a folder pack's own folder is untouched
  invalidate();
}
async function register(p: Omit<Pack, "added" | "enabled" | "builder"> & { builder?: boolean }, items: PackItem[]) {
  await mkdir(join(DIR(), p.id), { recursive: true });
  await writeFile(join(DIR(), p.id, "index.json"), JSON.stringify(items));
  const reg = (await readReg()).filter((x) => x.id !== p.id);
  const full: Pack = { ...p, enabled: true, builder: p.builder ?? true, count: items.length, added: new Date().toISOString() };
  await writeReg([...reg, full]); invalidate(); return full;
}
async function freeId(base: string) { const ids = new Set((await packs()).map((p) => p.id)); let id = slug(base); for (let i = 2; ids.has(id); i++) id = `${slug(base)}_${i}`; return id; }

// ---------------- folder packs ----------------
async function walk(root: string, rel = "", out: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 6 || out.length > 5000) return out;
  for (const e of await readdir(join(root, rel), { withFileTypes: true }).catch(() => [])) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory() && !e.name.startsWith(".")) await walk(root, r, out, depth + 1);
    else if (/\.glb$/i.test(e.name)) out.push(r);
  }
  return out;
}
/** A folder on this machine. With a catalog (our bench/build_library.py + caption_library.py output, or any JSON list
 *  of {glb, preview?, name?, tags?, category?, height_m?}) names and sizes come from it; otherwise from file names. */
export async function addFolderPack(a: { path: string; name?: string; licence: string; credit: string; catalog?: string }) {
  const root = resolve(a.path);
  if (!(await stat(root).catch(() => null))?.isDirectory()) throw new Error("that folder does not exist on this machine");
  let items: PackItem[];
  const cat = a.catalog ? resolve(a.catalog) : null;
  if (cat) {
    const rows = JSON.parse(await readFile(cat, "utf8")) as Record<string, any>[];
    items = rows.filter((r) => typeof r.glb === "string").map((r) => ({ id: slug(String(r.id ?? r.glb)).slice(0, 48), file: r.glb, preview: r.preview,
      name: r.name ?? nameOf(r.glb), tags: r.tags, category: r.category, height_m: r.height_m, style: r.style, bytes: r.bytes ?? 0 }));
  } else {
    items = await Promise.all((await walk(root)).map(async (rel) => {
      const base = rel.replace(/\.glb$/i, ""), prev = ["preview.jpg", `${base}.jpg`, `${base}.png`].map((x) => (x.includes("/") ? x : `${dirname(rel)}/${x}`.replace(/^\.\//, "")));
      let preview: string | undefined; for (const p of prev) if (await stat(join(root, p)).catch(() => null)) { preview = p; break; }
      return { id: itemId(rel), file: rel, preview, name: nameOf(rel), bytes: (await stat(join(root, rel))).size };
    }));
  }
  if (!items.length) throw new Error("no .glb files found in that folder");
  return register({ id: await freeId(a.name || root.split(sep).pop() || "folder"), name: a.name || root.split(sep).pop() || "Folder", kind: "folder", root,
    licence: a.licence, credit: a.credit, source: root, count: 0 }, items);
}

// ---------------- link packs (.glb or .zip) ----------------
const MAX_DOWNLOAD = 600_000_000;
// User links go through safeGet (https on every hop, no private/loopback addresses, streamed size cap).
const download = (url: string) => safeGet(url, { max: MAX_DOWNLOAD, headers: UA });
// Poly Haven files: only its own hosts, even though the URLs come from its API.
const PH_HOSTS = /^(api|dl|cdn)\.polyhaven\.(com|org)$/;
const phGet = (url: string, max = 200_000_000) => safeGet(url, { max, hosts: PH_HOSTS, headers: UA });
/** Minimal ZIP reader (stored + deflate; central directory), enough for model packs; no external dependency. */
const ZIP_TOTAL = 2_000_000_000;   // cumulative cap on everything extracted from one archive
export function unzip(z: Uint8Array): Map<string, () => Uint8Array> {
  let extracted = 0;
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength); let eocd = -1;
  for (let i = z.length - 22; i >= Math.max(0, z.length - 66_000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = new Map<string, () => Uint8Array>();
  if (n > 20_000) throw new Error("zip has too many files");
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("broken zip directory");
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(z.subarray(p + 46, p + 46 + nl)).replace(/\\/g, "/"); p += 46 + nl + xl + cl;
    if (name.endsWith("/") || name.split("/").includes("..") || name.startsWith("/") || usize > 400_000_000) continue;
    out.set(name, () => {
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), data = z.subarray(off + 30 + lnl + lxl, off + 30 + lnl + lxl + csize);
      if (extracted + usize > ZIP_TOTAL) throw new Error("the archive unpacks to more than 2 GB");
      // Decompression bombs: inflate at most the declared size and insist on exactly that size.
      const outBytes = method === 0 ? data : method === 8 ? new Uint8Array(inflateRawSync(data, { maxOutputLength: Math.max(1, usize) })) : null;
      if (!outBytes) throw new Error(`unsupported zip method ${method}`);
      if (outBytes.length !== usize) throw new Error("a file in the archive is not the size it claims");
      extracted += outBytes.length; return outBytes;
    });
  }
  return out;
}
export async function addLinkPack(a: { url: string; name?: string; licence: string; credit: string }) {
  const bytes = await download(a.url); const id = await freeId(a.name || a.url.split("/").pop()!.replace(/\?.*$/, "").replace(/\.(zip|glb)$/i, ""));
  const files = join(DIR(), id, "files"); await mkdir(files, { recursive: true });
  const items: PackItem[] = [];
  const save = async (rel: string, glb: Uint8Array, preview?: Uint8Array) => {
    const iid = itemId(rel); await writeFile(join(files, `${iid}.glb`), glb);
    if (preview) await writeFile(join(files, `${iid}.jpg`), preview);
    items.push({ id: iid, file: `files/${iid}.glb`, preview: preview ? `files/${iid}.jpg` : undefined, name: nameOf(rel), bytes: glb.length });
  };
  if (String.fromCharCode(...bytes.subarray(0, 4)) === "glTF") await save(a.url.split("/").pop()!.replace(/\?.*$/, "") || "model.glb", bytes);
  else {
    const z = unzip(bytes);
    for (const [name, read] of z) {
      if (items.length >= 2000) break;
      const img = [name.replace(/\.(glb|gltf)$/i, ".png"), name.replace(/\.(glb|gltf)$/i, ".jpg")].find((x) => z.has(x));
      if (/\.glb$/i.test(name)) await save(name, read(), img ? z.get(img)!() : undefined);
      else if (/\.gltf$/i.test(name)) {
        const dir = name.includes("/") ? name.slice(0, name.lastIndexOf("/") + 1) : "";
        const glb = await gltfToGlb(JSON.parse(new TextDecoder().decode(read())), async (uri) => {
          const f = z.get((dir + uri).replace(/\/\.\//g, "/")); if (!f) throw new Error(`missing ${uri}`); return f();
        }).catch(() => null);
        if (glb) await save(name, glb, img ? z.get(img)!() : undefined);
      }
    }
  }
  if (!items.length) { await rm(join(DIR(), id), { recursive: true, force: true }); throw new Error("no .glb / .gltf models found at that link"); }
  return register({ id, name: a.name || id, kind: "link", root: join(DIR(), id), licence: a.licence, credit: a.credit, source: a.url, count: 0 }, items);
}

// ---------------- Poly Haven (CC0) ----------------
export async function addPolyHaven() {
  const list = JSON.parse(new TextDecoder().decode(await phGet("https://api.polyhaven.com/assets?t=models", 20_000_000))) as
    Record<string, { name: string; categories?: string[]; tags?: string[]; dimensions?: number[] }>;
  const items: PackItem[] = Object.entries(list).map(([id, a]) => ({ id: slug(id).slice(0, 48), file: `models/${id}.glb`, preview: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
    name: a.name, tags: a.tags?.slice(0, 8), category: a.categories?.[0],
    // Blender-style [x, y, z] in mm, z up → height; the files themselves are real-world metres.
    height_m: a.dimensions?.length === 3 ? Math.round(a.dimensions[2] / 10) / 100 : undefined, style: "realistic", bytes: 0 }));
  return register({ id: "polyhaven", name: "Poly Haven models", kind: "polyhaven", root: join(DIR(), "polyhaven"), licence: "CC0",
    credit: "Poly Haven (polyhaven.com)", source: "https://polyhaven.com/models", count: 0 }, items);
}
/** Fetch one Poly Haven model (1k textures) and pack it to GLB, once. */
async function polyhavenModel(p: Pack, it: PackItem): Promise<string> {
  const out = inside(p.root, it.file); if (await stat(out).catch(() => null)) return out;
  const src = it.file.replace(/^models\//, "").replace(/\.glb$/, "");
  const dec = (b: Uint8Array) => JSON.parse(new TextDecoder().decode(b));
  const files = dec(await phGet(`https://api.polyhaven.com/files/${encodeURIComponent(src)}`, 5_000_000)) as Record<string, any>;
  const g = files?.gltf?.["1k"]?.gltf; if (!g?.url) throw new Error("this model has no glTF download");
  const json = dec(await phGet(g.url, 50_000_000));
  const glb = await gltfToGlb(json, async (uri) => {
    const inc = g.include?.[uri]; if (!inc?.url) throw new Error(`missing ${uri}`);
    return phGet(inc.url);
  });
  await mkdir(dirname(out), { recursive: true }); await writeFile(out, glb); return out;
}

// ---------------- lookup + search ----------------
export async function find(fullId: string) {
  const [pid, iid] = fullId.split(".", 2); if (!pid || !iid) throw new Error("not found");
  const it = (await allItems()).find((x) => x.pack.id === pid && x.id === iid); if (!it) throw new Error("not found");
  return it;
}
/** Absolute path of an item's GLB (fetched first for Poly Haven), or of its preview; or a remote preview URL. */
export async function itemFile(fullId: string, kind: "model" | "preview"): Promise<{ path?: string; url?: string }> {
  const it = await find(fullId);
  if (kind === "preview") {
    if (!it.preview) throw new Error("no preview");
    return /^https:\/\//.test(it.preview) ? { url: it.preview } : { path: inside(it.pack.root, it.preview) };
  }
  if (it.pack.kind === "polyhaven") return { path: await polyhavenModel(it.pack, it) };
  return { path: inside(it.pack.root, it.file) };
}
export async function search(q: string, limit = 40, maxMB = 20, opts: { builderOnly?: boolean } = {}) {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  // Whole words only ("car" must not find "cartoon"), singular/plural alike.
  const toks = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => w.replace(/(?<=..)e?s$/, "")));
  const stem = (w: string) => w.replace(/(?<=..)e?s$/, "");
  const scored = (await allItems()).filter((i) => (!i.bytes || i.bytes <= maxMB * 1e6) && (!opts.builderOnly || i.pack.builder)).map((i) => {
    const name = toks(i.name), tags = toks((i.tags ?? []).join(" "));
    const score = words.length ? words.reduce((s, w) => s + (name.has(stem(w)) ? 3 : 0) + (tags.has(stem(w)) ? 2 : 0) + (i.category === w ? 2 : 0), 0) : 1;
    return { i, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || (a.i.bytes || 5e6) - (b.i.bytes || 5e6)).slice(0, limit);
  return scored.map(({ i }) => ({ id: `lib:${i.pack.id}.${i.id}`, name: i.name, category: i.category ?? "other", tags: i.tags ?? [],
    height: i.height_m ?? null, mb: i.bytes ? Math.round(i.bytes / 1e5) / 10 : null, style: i.style ?? "realistic", pack: i.pack.name,
    preview: i.preview ? `/api/library/${i.pack.id}.${i.id}/preview` : null }));
}
