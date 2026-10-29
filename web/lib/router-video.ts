/**
 * router-video.ts — render a shot with a hosted video model through Comfy Router (server only), as an alternative to
 * the local LTX-2.5 Layout-To-Render graph (lib/render.ts).
 *   seedance-2.5  byteplus/dreamina-seedance-2-5-260628 — the model Higgsfield 3D Jutsu exports to
 *   minimax-h3    minimax/minimax-h3
 * Both take the shot's grey layout video as a `reference_video` and the look still as a `reference_image`. They follow
 * the layout and camera LOOSELY (a reference, not frame-exact conditioning like L2R) — the UI says so.
 * Media go by URL: the clay video and look still are uploaded as Comfy Cloud assets and handed over as short-lived
 * signed URLs (Seedance takes video only by URL; H3 would take a data URI, but the 100 MiB body cap makes URLs safer).
 */
import { Comfy, comfy } from "@comfyorg/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { reportRouter } from "./cost";

export type RouterVideoModel = "seedance-2.5" | "minimax-h3";
export const ROUTER_VIDEO: Record<RouterVideoModel, { id: string; label: string; min: number; max: number; ratios: string[] }> = {
  "seedance-2.5": { id: "byteplus/dreamina-seedance-2-5-260628", label: "Seedance 2.5 (Comfy Router)", min: 4, max: 30,
    ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"] },
  "minimax-h3": { id: "minimax/minimax-h3", label: "MiniMax H3 (Comfy Router)", min: 4, max: 15,
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] },
};

/** A Comfy CLOUD client even when COMFY_BASE_URL points the render client at a local ComfyUI: the SDK reads that
 *  variable only at construction, so it is hidden for that one synchronous call. */
function cloudClient(): Comfy {
  const saved = process.env.COMFY_BASE_URL;
  delete process.env.COMFY_BASE_URL;
  try { return new Comfy({ apiKey: process.env.COMFY_API_KEY?.trim() || undefined, clientInfo: "open-3d-jutsu" }); }
  finally { if (saved !== undefined) process.env.COMFY_BASE_URL = saved; }
}

const FOLLOW = "The reference video is a grey 3D previz of this exact shot: follow its camera motion, timing and the position "
  + "of every object and person in it exactly. The reference image shows how the first frame must look. Photoreal "
  + "live-action footage, no text overlays.";

/** Render with a Router video model; writes the MP4 to `out`. Credits are reported to the active cost meter. */
export async function renderRouterVideo(model: RouterVideoModel, a: { clay: string; look: string; prompt: string; seconds: number; ratio: string; out: string; quality?: "draft" | "final" }) {
  const m = ROUTER_VIDEO[model];
  const c = cloudClient();
  const [clay, look] = await Promise.all([
    c.assets.fromBytes(new Uint8Array(await readFile(a.clay)), { filename: "clay.mp4", contentType: "video/mp4" }).getDownloadUrl(),
    c.assets.fromBytes(new Uint8Array(await readFile(a.look)), { filename: "look.png", contentType: "image/png" }).getDownloadUrl(),
  ]);
  const content = [
    { type: "text", text: `${a.prompt} ${FOLLOW}` },
    { type: "image_url", image_url: { url: look.url }, role: "reference_image" },
    { type: "video_url", video_url: { url: clay.url }, role: "reference_video" },
  ];
  const duration = Math.max(m.min, Math.min(m.max, Math.round(a.seconds)));
  const ratio = m.ratios.includes(a.ratio) ? a.ratio : "16:9";
  const body: Record<string, unknown> = model === "seedance-2.5"
    ? { content, duration, ratio, resolution: a.quality === "draft" ? "480p" : "1080p", generate_audio: true, watermark: false }
    : { content, duration, ratio, resolution: a.quality === "draft" ? "768P" : "2K", aigc_watermark: false };
  const r = await comfy.models.run(m.id, body, { timeoutMs: 20 * 60_000 });
  reportRouter(r.creditsUsed, r.replayed);
  if (r.kind === "binary") { await writeFile(a.out, r.data as Uint8Array); return { out: a.out, duration, ratio }; }
  const d = r.data as { content?: { video_url?: string }; task?: { content?: { url?: string }; error?: unknown; status?: string }; error?: unknown; status?: string } | null;
  const url = d?.content?.video_url ?? d?.task?.content?.url;
  if (!url) throw new Error(`${m.label}: no video in the answer (${JSON.stringify(d?.error ?? d?.task?.error ?? d?.status ?? d?.task?.status ?? "").slice(0, 200)})`);
  // The result link is Comfy-signed and expires (12–24 h): download it now.
  const res = await fetch(url); if (!res.ok) throw new Error(`${m.label}: download failed (${res.status})`);
  await writeFile(a.out, new Uint8Array(await res.arrayBuffer()));
  return { out: a.out, duration, ratio };
}
