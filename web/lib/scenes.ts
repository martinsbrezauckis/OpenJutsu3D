/**
 * scenes.ts — "My scenes": saved sets on this machine (DATA_DIR/scenes/<id>/scene.json + thumb.jpg). A scene keeps
 * everything needed to reopen and keep working: the prompt, the director's brief, the scene code (= the set), the
 * version history (every build/change step, for undo and restore), the chat and the reference pictures. Server only.
 */
import { mkdir, readdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "./render";

export type Version = { code: string; note: string; at: string };
export type SavedScene = { id: string; title: string; prompt: string; brief: unknown; versions: Version[]; head: number;
  chat: unknown[]; takes: unknown[]; refs?: { url: string; label?: string }[]; aspect?: Aspect; spend?: { credits: number; usd: number; unreported: number }; shot?: Shot; updated: string };
/** The shot bar: the strip's camera + the moves, each with its own camera when it cuts to another one (Studio.tsx Seg). */
export type Shot = { cam: string | null; recipe: { move: string; seconds: number; cam?: string }[] };
export type Aspect = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
const dir = (id: string) => { if (!/^[a-z0-9-]{8,64}$/.test(id)) throw new Error("bad scene id"); return join(DATA_DIR, "scenes", id); };

export async function saveScene(s: Omit<SavedScene, "id" | "updated"> & { id?: string }, thumb?: Uint8Array): Promise<string> {
  const id = s.id && /^[a-z0-9-]{8,64}$/.test(s.id) ? s.id : randomUUID();
  await mkdir(dir(id), { recursive: true });
  const rec: SavedScene = { ...s, id, updated: new Date().toISOString() };
  await writeFile(join(dir(id), "scene.json"), JSON.stringify(rec));
  if (thumb?.length) await writeFile(join(dir(id), "thumb.jpg"), thumb);
  return id;
}
export async function loadScene(id: string): Promise<SavedScene> { return JSON.parse(await readFile(join(dir(id), "scene.json"), "utf8")); }
export async function listScenes(): Promise<{ id: string; title: string; updated: string; objects?: number }[]> {
  const root = join(DATA_DIR, "scenes");
  const ids = await readdir(root).catch(() => [] as string[]);
  const out = [];
  for (const id of ids) {
    try { const s = await loadScene(id); out.push({ id, title: s.title, updated: s.updated }); } catch { /* skip broken */ }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}
/** Delete = move to DATA_DIR/scenes-trash/<id>-<time> (recoverable by moving it back). */
export async function deleteScene(id: string) {
  const from = dir(id); await stat(join(from, "scene.json"));
  await mkdir(join(DATA_DIR, "scenes-trash"), { recursive: true });
  await rename(from, join(DATA_DIR, "scenes-trash", `${id}-${Date.now()}`));
}
export async function renameScene(id: string, title: string) {
  const s = await loadScene(id), t = String(title).replace(/\s+/g, " ").trim().slice(0, 120);
  if (!t) throw new Error("a title is needed");
  await writeFile(join(dir(id), "scene.json"), JSON.stringify({ ...s, title: t }));   // keeps `updated`: no jump in the list
}
export async function thumbPath(id: string) { const p = join(dir(id), "thumb.jpg"); await stat(p); return p; }
