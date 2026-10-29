/**
 * library.ts — the asset library seen by the app and the builder (server only). Models come from PACKS the user chose
 * (lib/packs.ts: built-in Samples, own folders, links, Poly Haven …) plus single GLBs the user imported (uploads).
 * Ids in scene code: 'lib:<pack>.<item>' and 'up:<sha prefix>' (kit.model).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./render";
import { allItems, itemFile, packs, search as packSearch } from "./packs";

export { itemFile };
export const libraryOn = async () => (await packs()).some((p) => p.enabled);
export const search = packSearch;
/** Credits of the enabled packs, for the library panel ("3D models: Poly Haven (CC0), Scenario (CC BY 4.0)"). */
export async function credits() {
  const on = (await packs()).filter((p) => p.enabled);
  const lines = [...new Set(on.map((p) => `${p.credit} (${p.licence})`))];   // Samples + Poly Haven share one credit
  return lines.length ? "3D models: " + lines.join(", ") : null;
}

/**
 * Library models the builder may place for one build step: search each meaningful word of the step, keep models
 * ≤ 10 MB from packs that allow builder use, at most `max`. Stylized models are left out unless the prompt asks for a
 * stylized / cartoon look. Returns [] when no pack is enabled.
 */
const STOP = new Set(["with", "and", "the", "from", "into", "onto", "along", "around", "near", "over", "under", "each", "every",
  "some", "many", "more", "most", "small", "large", "big", "tall", "long", "wide", "light", "lights", "camera", "cameras",
  "ground", "floor", "wall", "walls", "batch", "set", "scene", "details", "detail", "main", "area", "side", "front", "back"]);
export async function builderCandidates(step: string, prompt: string, max = 24) {
  if (!(await allItems()).length) return [];
  const stylized = /cartoon|stylized|stylised|toy|low.?poly|cute|chibi/i.test(prompt);
  const words = [...new Set(step.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((w) => !STOP.has(w)).slice(0, 16);
  const seen = new Map<string, Awaited<ReturnType<typeof packSearch>>[number]>();
  for (const w of words) for (const it of await packSearch(w.replace(/s$/, ""), 3, 10, { builderOnly: true })) {
    if (!stylized && it.style === "stylized") continue;
    if (!seen.has(it.id)) seen.set(it.id, it);
  }
  return [...seen.values()].slice(0, max).map((m) => ({ ...m, height: m.height ?? 1 }));
}

// ---- imported models (uploads): DATA_DIR/assets/<sha16>.glb + .json {name, height} ----
const UP = () => join(DATA_DIR, "assets");
export type UploadKind = "model" | "character" | "motion";
export async function saveUpload(bytes: Uint8Array, name: string, height?: number, kind: UploadKind = "model"): Promise<string> {
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  await mkdir(UP(), { recursive: true });
  await writeFile(join(UP(), `${id}.glb`), bytes);
  await writeFile(join(UP(), `${id}.json`), JSON.stringify({ name: name.slice(0, 80), height: height ?? null, kind, at: new Date().toISOString() }));
  return id;
}
export const uploadFile = (id: string) => { if (!/^[0-9a-f]{16}$/.test(id)) throw new Error("not found"); return join(UP(), `${id}.glb`); };
export async function uploads() {
  const files = (await readdir(UP()).catch(() => [] as string[])).filter((f) => f.endsWith(".json"));
  return Promise.all(files.map(async (f) => ({ id: `up:${f.slice(0, 16)}`, ...JSON.parse(await readFile(join(UP(), f), "utf8")) })));
}
