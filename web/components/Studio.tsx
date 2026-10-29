"use client";
/**
 * Studio.tsx — Open 3D Jutsu UI. Visual system = Comfy-Org/comfy-openjutsu; structure = Higgsfield 3D Jutsu.
 * Two views:
 *   Home   composer card (prompt + chips: reference picture, model, concept picture) → Build; My scenes (saved sets,
 *          "Create blank scene"); example sets that open instantly.
 *   Studio chat panel (questions, concept, live batched build, change requests, renders), the 3D viewer, the shot bar
 *          (camera, move, length), the move timeline with a playhead (Preview), takes; undo/redo over the set's
 *          versions; every build/change/render auto-saves to My scenes.
 * Models: GET /api/config lists the routes this machine has (Comfy Router and/or the Codex CLI subscription); the
 * chosen {route, model} is sent with each request and validated server-side (lib/models.ts).
 * All API calls go through lib/api-client.ts; the 3D viewport is a sandboxed iframe (lib/viewer-bridge.ts).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useEditTools, type RecordEdit } from "./EditTools";
import { ViewerBridge, type ViewerResult } from "@/lib/viewer-bridge";
import { joinCode } from "@/lib/scene-code";
import { shotIntent } from "@/lib/shot-intent";
import { FAST_MOTION, peakMotion } from "@/lib/fps48";

type Use = { route: string; model: string };
type Opt = { id: string; label: string; note?: string };
type Config = { routes: string[]; options: Record<string, Record<"director" | "builder" | "look", Opt[]>>; defaults: Record<"director" | "builder" | "look", Use | null> };
type Question = { id: string; question: string; options: string[]; default: string };
type Ready = { status: "ready"; brief: string; batches: string[]; assumptions: string[] };
type Director = Ready | { status: "ask"; questions: Question[]; assumptions: string[] };
type RStep = "clay" | "look" | "video";
type Msg =
  | { kind: "user"; text: string; ref?: string }
  | { kind: "note"; text: string; detail?: string[] }
  | { kind: "questions"; questions: Question[] }
  | { kind: "confirm"; request: string; answer?: "apply" | "cancel" }
  | { kind: "concept"; url: string }
  | { kind: "build"; batches: string[]; at: number; current: number; done: boolean }
  | { kind: "render"; label: string; steps: Record<RStep, "wait" | "now" | "done">; look?: string }
  | { kind: "error"; text: string };
type Take = { id: string; label: string; video: string; clay: string; thumb?: string; video48?: string; by48?: string };
type Version = { code: string; note: string; at: string };
type SceneCard = { id: string; title: string; updated: string };

const GROUPS: { name: string; moves: string[] }[] = [
  { name: "Push and pull", moves: ["dolly-in", "dolly-out", "tracking", "slow-zoom-in", "slow-zoom-out", "crush-zoom", "dolly-zoom"] },
  { name: "Sideways", moves: ["truck-left", "truck-right", "slider-left", "slider-right", "side-tracking"] },
  { name: "Up and down", moves: ["crane-up", "crane-down", "pedestal-up", "pedestal-down", "tilt-up", "tilt-down"] },
  { name: "Turn and circle", moves: ["arc-left", "arc-right", "drone-orbit", "bullet-time", "pan-left", "pan-right", "whip-pan"] },
  { name: "Big and special", moves: ["aerial-pullback", "helicopter-shot", "robot-arm", "handheld", "pov", "snorricam", "rack-focus", "static-shot"] },
  { name: "Your own", moves: ["path"] },
];
/** The keyframes of one camera's custom path: the last kit.cameraPath line for it in the scene code ([] when none). */
function pathKeys(code: string, cam: string | null): number[][] {
  if (!cam) return [];
  const all = [...code.matchAll(/kit\.cameraPath\('([A-Za-z0-9_]+)',\s*(\[[-0-9.,\s\[\]e]*\])\s*\);/g)].filter((m) => m[1] === cam);
  try { return all.length ? JSON.parse(all[all.length - 1][2]) : []; } catch { return []; }
}
const CHAT_MODES = { auto: "Auto", ask: "Ask first", go: "Don't ask", chat: "Chat only" } as const;
const CHAT_MODE_HELP: Record<keyof typeof CHAT_MODES, string> = { auto: "Auto: ask only when the idea is unclear",
  ask: "Ask first: questions before building, and every change waits for your OK", go: "Don't ask: decide and build", chat: "Chat only: answers, no changes" };
const ROUTE_LABEL: Record<string, string> = { router: "Comfy Router (credits)", codex: "Codex CLI (your subscription)", openai: "OpenAI API (your key)" };
const ROUTE_NOTE: Record<string, string> = { router: "Model calls are charged to your Comfy credits.", codex: "Runs on your Codex subscription.",
  openai: "Model calls are charged to your OpenAI API key." };
const EXAMPLES = [
  { id: "dungeon", title: "Steampunk dungeon", prompt: "An underground dungeon with medieval torture devices in steampunk style" },
  { id: "neon", title: "Neon alley in the rain", prompt: "A narrow rainy neon alley at night with a ramen stall" },
  { id: "city", title: "Medieval city", prompt: "A dense medieval walled city at golden hour with a cathedral, river and castle" },
  { id: "moon", title: "Moon base", prompt: "A moon colony with spaceships and space rockets parked there" },
  { id: "cafe", title: "Rainy night street caf\u00e9", prompt: "A rainy night street in an old European city with a small coffee cart under string lights" },
  { id: "tavern", title: "Tavern cellar", prompt: "A lantern-lit tavern cellar under an old inn, late evening, with patrons by the fire" },
  { id: "reading", title: "Reading room at golden hour", prompt: "A cozy reading room in an old townhouse at golden hour, a woman reading on the sofa" },
  { id: "temple", title: "Desert temple at dawn", prompt: "Ancient desert temple ruins at dawn with travellers climbing the stairway" },
];
const label = (m: string) => (m === "path" ? "Custom path" : m.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));
const camLabel = (c: string) => c.replace(/^CAM_/, "").replace(/_/g, " ");
// Shots up to 60 s (Higgsfield's range); > 15 s render as overlapping LTX segments (lib/render.ts planSegments).
const MAX_SECONDS = 60;
const frameCount = (seconds: number, fps: number) => Math.round((seconds * fps) / 8) * 8 + 1;   // LTX: 8k+1 frames
// Frame formats. Clip sides divisible by 64 (LTX); `look` = the image model's nearest size (cropped to the clip).
// LTX L2R scales the shorter side to 544 then ×2, and the long side must then be a multiple of 32: 4:3 = 1472×1088,
// 21:9 = 2560×1088 (2.35:1 scope). Every format renders natively (9:16 + 1:1 tested 10-28).
const ASPECTS = { "16:9": { w: 1920, h: 1088, look: "1536x1024", label: "16:9 landscape" }, "9:16": { w: 1088, h: 1920, look: "1024x1536", label: "9:16 vertical" },
  "1:1": { w: 1088, h: 1088, look: "1024x1024", label: "1:1 square" }, "4:3": { w: 1472, h: 1088, look: "1536x1024", label: "4:3 classic" },
  "3:4": { w: 1088, h: 1472, look: "1024x1536", label: "3:4 portrait" }, "21:9": { w: 2560, h: 1088, look: "1536x1024", label: "21:9 cinema" } } as const;
type Aspect = keyof typeof ASPECTS;
type Spend = { credits: number; usd: number; unreported: number };
const NO_SPEND: Spend = { credits: 0, usd: 0, unreported: 0 };
const CREDITS_PER_USD = 211;   // Comfy credits (research/comfy_platform_and_oss_stack.md: 211 credits = $1)
/** "812 credits (≈ $3.85)" / "$0.21" / "" — what the user paid (or will pay), plainly. */
function money(s: { credits: number; usd: number; unreported?: number }) {
  const parts = [];
  if (s.credits) parts.push(`${Math.round(s.credits).toLocaleString()} credits (≈ $${(s.credits / CREDITS_PER_USD).toFixed(2)})`);
  if (s.usd) parts.push(`$${s.usd.toFixed(2)} OpenAI`);
  if (s.unreported) parts.push(`${s.unreported} call${s.unreported > 1 ? "s" : ""} not priced`);
  return parts.join(" + ");
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const Icon = {
  plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>,
  model: <svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>,
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>,
  frame: <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" /></svg>,
  image: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></svg>,
  cube: <svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>,
  undo: <svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></svg>,
  redo: <svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 000 10h3" /></svg>,
};

async function fileToDataUrl(f: File, max = 1536): Promise<string> {
  const img = await createImageBitmap(f); const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.9);
}
const blobToDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });

export default function Studio() {
  // ---------- shared ----------
  const [view, setView] = useState<"home" | "studio">("home");
  const [config, setConfig] = useState<Config | null>(null);
  const [builderUse, setBuilderUse] = useState<Use | null>(null);
  const [conceptOn, setConceptOn] = useState(true);
  // Chat mode (Higgsfield-style): auto = ask only when unclear, ask = ask before generating, go = never ask, chat = talk, no changes.
  const [chatMode, setChatMode] = useState<"auto" | "ask" | "go" | "chat">("auto");
  const [aspect, setAspect] = useState<Aspect>("16:9");   // chosen on the home composer, kept per scene
  // Model spend of this scene (lib/cost.ts): Router credits as priced per call, OpenAI USD; unreported = calls with no price.
  const [spend, setSpend] = useState<Spend>(NO_SPEND);
  const addSpend = (c?: Partial<Spend & { calls: number }> | null) => { if (c && (c.calls ?? 0) > 0) setSpend((s) => ({ credits: s.credits + (c.credits ?? 0),
    usd: s.usd + (c.usd ?? 0), unreported: s.unreported + (c.unreported ?? 0) })); };
  const [est, setEst] = useState<{ credits: number; usd: number; runs: number } | null>(null);
  const SIZE = ASPECTS[aspect];
  const [ref, setRef] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneCard[]>([]);
  // Camera strip order = order first seen: a change that redefines CAM_main must not move it to the end of the strip.
  const camOrder = useRef<string[]>([]);
  const camsInOrder = (cams: string[]) => {
    for (const c of cams) if (!camOrder.current.includes(c)) camOrder.current.push(c);
    return camOrder.current.filter((c) => cams.includes(c));
  };
  const [homePrompt, setHomePrompt] = useState("");

  // ---------- studio ----------
  const iframe = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<ViewerBridge | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  // What to do once the (new) viewport is ready. It runs after resetStudio() has re-rendered, so it must use THAT
  // render's functions: a closure made before the reset still sees the previous scene's code, versions and id — a new
  // build then landed on top of the scene that was open before (10-29). It receives `live.current` instead.
  type Live = { direct: typeof direct; commitVersion: typeof commitVersion; push: typeof push };
  const pending = useRef<null | ((a: Live) => void)>(null);
  const live = useRef<Live>(null!);
  const [viewerReady, setViewerReady] = useState(false);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled set");
  const [prompt, setPrompt] = useState("");
  const [brief, setBrief] = useState<Ready | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [head, setHead] = useState(-1);
  const [scene, setScene] = useState<ViewerResult | null>(null);
  const [built, setBuilt] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"lit" | "clay">("lit");
  const [cam, setCam] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [recipe, setRecipe] = useState<{ move: string; seconds: number }[]>([{ move: "dolly-in", seconds: 4 }]);
  // 48 fps copy: auto-on when the shot's camera moves fast (lib/fps48.ts measures the planned path); the user's
  // choice (fps48User) holds until the camera or the move changes.
  const [motion, setMotion] = useState<number | null>(null);
  const [fps48User, setFps48User] = useState<boolean | null>(null);
  const [renderSoon, setRenderSoon] = useState(false);   // "film it" in chat: render once the new shot is in state
  const [sel, setSel] = useState(0);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [showing, setShowing] = useState<{ take: Take; mode: "final" | "clay" | "side" } | null>(null);
  const [now, setNow] = useState(Date.now());

  const code = head >= 0 ? versions[head]?.code ?? "" : "";
  const [reloads, setReloads] = useState(0);   // full set reloads (load()), so hands-on edit selection resets
  const lastEdit = useRef<{ key: string; block: string } | null>(null);
  const seconds = recipe.reduce((s, r) => s + r.seconds, 0);
  const recipeStr = recipe.length === 1 && recipe[0].seconds === 4 ? recipe[0].move : recipe.map((r) => `${r.move}:${r.seconds}`).join("+");
  const fps48Auto = motion !== null && motion > FAST_MOTION, fps48On = fps48User ?? fps48Auto;
  const use = (stage: "director" | "builder" | "look"): Use | undefined => {
    if (!config) return undefined;
    if (stage === "builder") return builderUse ?? config.defaults.builder ?? undefined;
    const route = (builderUse ?? config.defaults.builder)?.route; const d = config.defaults[stage];
    if (route && d && d.route !== route) { const o = config.options[route]?.[stage]?.[0]; return o ? { route, model: o.id } : d; }
    return d ?? undefined;
  };
  const push = (m: Msg) => setMsgs((x) => [...x, m]);
  const patchLast = <K extends Msg["kind"]>(kind: K, f: (m: Extract<Msg, { kind: K }>) => Msg) =>
    setMsgs((x) => { const i = x.map((m) => m.kind).lastIndexOf(kind); return i < 0 ? x : [...x.slice(0, i), f(x[i] as Extract<Msg, { kind: K }>), ...x.slice(i + 1)]; });

  useEffect(() => { api<Config>("/api/config").then(setConfig).catch(() => {}); refreshScenes(); }, []);
  // The 1 s clock (build timer) runs only while something is timed — it re-renders the page.
  useEffect(() => { if (!busy) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [busy]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length]);
  // Viewport lifecycle: the iframe exists only in the studio view.
  useEffect(() => {
    if (view !== "studio" || !iframe.current) return;
    const b = new ViewerBridge(iframe.current); bridge.current = b; setViewerReady(false);
    b.onTick = (i, n) => setPlayhead(i / Math.max(1, n - 1));
    b.ready.then(async () => { setViewerReady(true); await b.interactive(true); const p = pending.current; pending.current = null; p?.(live.current); });
    return () => { b.dispose(); bridge.current = null; };
  }, [view]);
  // Camera thumbnails once the set is built.
  useEffect(() => {
    if (!built || !scene || !bridge.current) return;
    let live = true;
    (async () => { const out: Record<string, string> = {};
      for (const c of scene.cameras) { const [f] = await bridge.current!.frames({ cam: c, move: "static-shot", n: 1, fps: 24, w: 320, h: 180, mode: "lit", start: 0, count: 1 });
        out[c] = URL.createObjectURL(new Blob([f], { type: "image/jpeg" })); }
      if (live) setThumbs(out); })().catch(() => {});
    return () => { live = false; };
  }, [built, head, scene?.cameras.join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps -- cameras: undo/redo set head before the reload lands

  async function renameScene(id: string, title: string) { await api(`/api/scenes/${id}`, { method: "PATCH", json: { title } }); await refreshScenes(); }
  async function deleteScene(id: string) { await api(`/api/scenes/${id}`, { method: "DELETE" }); await refreshScenes(); }
  async function refreshScenes() { try { setScenes((await api<{ scenes: SceneCard[] }>("/api/scenes")).scenes); } catch { /* none yet */ } }
  function resetStudio() {
    setSceneId(null); setTitle("Untitled set"); setSpend(NO_SPEND); setPrompt(""); setInput(""); setBrief(null); setVersions([]); setHead(-1); setScene(null); setBuilt(false);
    setMsgs([]); setAnswers({}); setCam(null); setThumbs({}); setTakes([]); setShowing(null); setRecipe([{ move: "dolly-in", seconds: 4 }]); setSel(0);
  }
  function openStudio(then: (a: Live) => void) {
    resetStudio();
    // Already in the studio with a running viewport: it will not start again, so run after the reset has rendered.
    if (view === "studio" && viewerReady && bridge.current) setTimeout(() => then(live.current), 0);
    else { pending.current = then; setView("studio"); }
  }

  // ---------- versions: every build step / change is one version; undo/redo move the head ----------
  async function commitVersion(next: string, note: string, list = versions, at = head) {
    // Editing an older version never drops the later ones: that version is restored as the newest first (undo goes
    // back to it), then the edit follows it.
    const now = new Date().toISOString();
    const restored = at >= 0 && at < list.length - 1 ? [{ code: list[at].code, note: `Restored version ${at + 1}`, at: now }] : [];
    const v = [...(at < 0 ? [] : list), ...restored, { code: next, note, at: now }];
    setVersions(v); setHead(v.length - 1);
    setReloads((n) => n + 1); const r = await bridge.current!.load(next, true); setScene(r);
    return { r, v };
  }
  async function goto(h: number) {
    if (h < 0 || h >= versions.length || busy) return;
    setHead(h); setReloads((n) => n + 1); const r = await bridge.current!.load(versions[h].code, true); setScene(r);
    setCam((c) => (c && r.cameras.includes(c) ? c : r.cameras[0] ?? null)); setBuilt(r.cameras.length > 0 || built);
  }
  // save() runs inside long async chains (a build saves after each step) whose closures were made before the title,
  // prompt, brief or id were set — those were saved stale ("Untitled set", empty prompt, 10-29). Read them from here.
  const meta = useRef({ title, prompt, brief, sceneId, aspect, spend });
  meta.current = { title, prompt, brief, sceneId, aspect, spend };
  async function save(extra?: { v?: Version[]; h?: number; t?: Take[]; m?: Msg[]; cam?: string | null }) {
    const v = extra?.v ?? versions; if (!v.length) return;
    let thumb: string | undefined;
    // extra.cam: callers that just loaded a set pass its camera — `scene`/`cam` here are still the previous render's.
    try { const c = extra?.cam ?? scene?.cameras[0] ?? cam; if (c) thumb = await blobToDataUrl(new Blob([await bridge.current!.thumb(c)], { type: "image/jpeg" })); } catch { /* no thumb */ }
    const chat = (extra?.m ?? msgs).filter((m) => m.kind !== "concept" || m.url.startsWith("data:"));
    try {
      const { title, prompt, brief, sceneId, aspect, spend } = meta.current;
      const { id } = await api<{ id: string }>("/api/scenes", { json: { id: sceneId ?? undefined, title, prompt, brief, aspect, spend, versions: v,
        head: extra?.h ?? head, chat, takes: extra?.t ?? takes, thumb } });
      setSceneId(id); meta.current.sceneId = id; refreshScenes();
    } catch { /* saving is best effort; the set stays in the page */ }
  }

  live.current = { direct, commitVersion, push };

  // ---------- start points ----------
  function startFromPrompt() {
    const text = homePrompt.trim(); if (!text) return;
    const r = ref;
    openStudio((a) => { a.push({ kind: "user", text, ref: r ?? undefined }); setPrompt(text); setTitle(text.slice(0, 60)); a.direct(text, undefined, r); });
    setHomePrompt("");
  }
  function openExample(ex: (typeof EXAMPLES)[number]) {
    openStudio(async (a) => {
      const src = await (await fetch(`/examples/${ex.id}.js`)).text();
      setPrompt(ex.prompt); setTitle(ex.title); setBrief({ status: "ready", brief: ex.prompt, batches: [], assumptions: [] });
      const { r } = await a.commitVersion(src, "Example set", [], -1); setCam(r.cameras[0] ?? null); setBuilt(true);
      if (r.cameras[0]) await bridge.current?.view(r.cameras[0]);   // open looking through the set's main camera
      a.push({ kind: "note", text: `Opened the example set "${ex.title}": ${r.stats.objects} objects, ${r.cameras.length} cameras. Pick a camera and a move below, or tell me what to change.` });
    });
  }
  function openSaved(id: string) {
    openStudio(async () => {
      const s = await api<{ id: string; title: string; prompt: string; brief: Ready | null; versions: Version[]; head: number; chat: Msg[]; takes: Take[]; aspect?: Aspect; spend?: Spend }>(`/api/scenes/${id}`);
      setSceneId(s.id); setTitle(s.title); setAspect(s.aspect ?? "16:9"); setSpend(s.spend ?? NO_SPEND); setPrompt(s.prompt); setBrief(s.brief); setVersions(s.versions); setHead(s.head);
      const opened = "Scene opened. Carry on where you left off.";   // once, not once per reopen
      setMsgs([...((s.chat || []) as Msg[]).filter((m) => !(m.kind === "note" && "text" in m && m.text === opened)), { kind: "note", text: opened }]); setTakes(s.takes || []);
      setReloads((n) => n + 1); const r = await bridge.current!.load(s.versions[s.head]?.code ?? ""); setScene(r); setCam(r.cameras[0] ?? null); setBuilt(true);
      if (r.cameras[0]) await bridge.current?.view(r.cameras[0]);
    });
  }
  /** Share: the set as a file another Open 3D Jutsu can open (versions, plan, format — no videos, no chat). */
  function downloadSceneFile() {
    const { title, prompt, brief, aspect } = meta.current;
    const file = { format: "open-3d-jutsu-scene", version: 1, title, prompt, brief, aspect, versions, head };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
    a.download = `${(title || "set").replace(/[^\w .-]+/g, "").slice(0, 40) || "set"}.o3j.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    push({ kind: "note", text: `Saved ${a.download}: open it in Open 3D Jutsu with "Open scene file" on the start page. Models from your own packs travel only as names — the other side needs the same packs.` });
  }
  async function openSceneFile(f: File) {
    try {
      const s = JSON.parse(await f.text());
      if (s?.format !== "open-3d-jutsu-scene" || !Array.isArray(s.versions) || !s.versions.length || s.versions.some((v: Version) => typeof v?.code !== "string"))
        throw new Error("that is not an Open 3D Jutsu scene file");
      const { id } = await api<{ id: string }>("/api/scenes", { json: { title: String(s.title || f.name).slice(0, 120), prompt: String(s.prompt || ""),
        brief: s.brief ?? null, aspect: s.aspect, versions: s.versions.map((v: Version) => ({ code: v.code, note: String(v.note || ""), at: String(v.at || "") })),
        head: Math.min(Math.max(0, Number(s.head) || 0), s.versions.length - 1), chat: [], takes: [] } });
      openSaved(id);
    } catch (e) { alert(`Could not open the scene file: ${(e as Error).message}`); }
  }
  function openBlank() { openStudio((a) => a.push({ kind: "note", text: "Describe the place you want to film. I'll plan it, show a concept picture and build it as a 3D set." })); }

  // ---------- chat ----------
  async function send() {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); push({ kind: "user", text });
    if (chatMode === "chat") return ask(text);
    if (built && shotOnly(text)) return;
    // A built set always takes the text as a change — also when it has no saved plan (sets saved before 10-29 lost
    // theirs, and a saved example has none); only an empty studio starts a new set.
    if (built && chatMode === "ask") { push({ kind: "confirm", request: text }); return; }
    if (built) await change(text);
    else if (!brief) { setPrompt(text); setTitle(text.slice(0, 60)); await direct(text); }
    // Plan ready, set not built yet (concept step): the text revises the plan, then a new concept is shown.
    else { const p = `${prompt}\n${text}`; setPrompt(p); await direct(p); }
  }
  /**
   * A chat line that only talks about the shot ("slow dolly in for 5 s", "8 s orbit, then film it") sets the shot bar
   * and, when asked, renders — no builder call. Lines that also change the set go to the builder as before.
   */
  function shotOnly(text: string) {
    const si = shotIntent(text, MAX_SECONDS);
    const setWords = /\b(add|remove|delete|replace|change|put|place|paint|colou?r|bigger|smaller|darker|brighter|swap|build|create|more|less)\b|\bmake (it|them|the (?!video|clip|shot|film))/i;
    if (!si || setWords.test(text)) return false;
    if (si.recipe.length) { setRecipe(si.recipe); setSel(0); }
    const shot = si.recipe.map((r) => `${label(r.move)} ${r.seconds} s`).join(", then ");
    if (si.render) { push({ kind: "note", text: `${shot ? `Shot set: ${shot}. ` : ""}Rendering it now.` }); setRenderSoon(true); }
    else push({ kind: "note", text: `Shot set: ${shot}. Press Render shot or say "film it" when you're ready.` });
    return true;
  }
  useEffect(() => { if (renderSoon && !busy && cam) { setRenderSoon(false); renderShot(); } }, [renderSoon, recipeStr, busy, cam]);   // eslint-disable-line react-hooks/exhaustive-deps
  /** Ask mode: an answer about the set or the idea; nothing is built or changed. */
  async function ask(question: string) {
    setBusy("Thinking");
    try {
      const r = await api<{ answer: string; cost?: Spend & { calls: number } }>("/api/ask", { json: { question, prompt, brief: brief?.brief, code, use: use("director") } });
      addSpend(r.cost); push({ kind: "note", text: r.answer });
    } catch (e) { push({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  }
  async function direct(p: string, withAnswers?: Record<string, string>, refUrl: string | null = ref) {
    setBusy("Reading your idea");
    try {
      const refs = refUrl ? [refUrl] : undefined;
      const d = await api<Director & { cost?: Spend & { calls: number } }>("/api/director", { json: { prompt: p, answers: withAnswers, use: use("director"), refs, mode: chatMode === "chat" ? "auto" : chatMode } });
      addSpend(d.cost);
      if (d.status === "ask") { push({ kind: "questions", questions: d.questions }); return; }
      setBrief(d); push({ kind: "note", text: "Here's my plan for the set.", detail: d.assumptions.slice(0, 4) });
      if (conceptOn) {
        setBusy("Painting a concept picture");
        const blob = await api<Blob & { cost?: Spend & { calls: number } }>("/api/concept", { json: { brief: d.brief, use: use("look"), refs } });
        addSpend(blob.cost);
        push({ kind: "concept", url: await blobToDataUrl(blob) });
      } else await build(d, p);
    } catch (e) { push({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  }
  /** Blocks of the NEW code `add` that the viewer dropped because they failed, with the error of each. */
  function failedBlocks(add: string, r: ViewerResult) {
    const blocks = add.split(/\n(?=\/\/@@)/);
    return r.skipped.flatMap((s) => {
      const b = blocks.find((x) => x.split("\n").some((l) => l.trim().slice(0, 120) === s.code));
      return b ? [{ block: b, error: s.error }] : [];
    });
  }
  /** Blocks of the NEW code `add` that define an object the viewer found hanging in mid-air, with the gap. */
  function floatingBlocks(add: string, r: ViewerResult) {
    const blocks = add.split(/\n(?=\/\/@@)/);
    return (r.floating ?? []).flatMap((f) => {
      const b = blocks.find((x) => x.includes(`kit.object('${f.name}')`) || x.includes(`kit.object("${f.name}")`));
      return b ? [{ block: b, error: `${f.name}: ${f.parts} part${f.parts > 1 ? "s hang" : " hangs"} in mid-air, ${f.height} m above what is under ${f.parts > 1 ? "them" : "it"} at x ${f.at[0]}, z ${f.at[1]}, touching nothing that holds ${f.parts > 1 ? "them" : "it"} (often a missing .at() to the table / shelf / wall it belongs on)` }] : [];
    });
  }
  /**
   * One repair round for new code that partly failed or left props hanging in mid-air: those blocks are removed and
   * the builder rewrites exactly those, told the errors. Replaces the version just committed (no extra version).
   * Returns what is still failing (a prop still floating after the round is kept as it is, not reported as failed).
   */
  async function repairFailed(base: string, add: string, intent: string, note: string, v: Version[], r: ViewerResult) {
    const failed = failedBlocks(add, r), floating = floatingBlocks(add, r).filter((f) => !failed.some((b) => b.block === f.block));
    let bad = [...failed, ...floating];
    if (!bad.length) return { code: joinCode(base, add), r, v, left: [] as string[] };
    setBusy(failed.length ? "Fixing the parts that failed" : "Fixing things that float in mid-air");
    const kept = bad.reduce((s, b) => s.replace(b.block, ""), add);
    const request = `${intent}\n\nREPAIR: these blocks of the code just added ${failed.length ? "failed when run or " : ""}left things hanging in mid-air and were removed:\n`
      + bad.map((b) => `--- error: ${b.error}\n${b.block.trim()}`).join("\n")
      + "\nWrite corrected replacement blocks for exactly these, with the same intent and names: everything rests on, hangs from or is fixed to something. Do not repeat anything that already worked.";
    try {
      const { code: fix, cost } = await api<{ code: string; cost?: Spend & { calls: number } }>("/api/change", { json: { prompt, brief: brief?.brief, codeSoFar: joinCode(base, kept), request, use: use("builder") } });
      addSpend(cost);
      if (!failed.length && !fix.trim()) return { code: joinCode(base, add), r, v, left: [] as string[] };   // nothing came back: keep the props
      const full = joinCode(joinCode(base, kept), fix); const res = await commitVersion(full, note, v.slice(0, -1), v.length - 2);
      bad = failedBlocks(kept + fix, res.r);
      return { code: full, r: res.r, v: res.v, left: bad.map((b) => b.error) };
    } catch { return { code: joinCode(base, add), r, v, left: failed.map((b) => b.error) }; }
  }
  async function build(d: Ready = brief!, p: string = prompt) {
    setBusy("Building the set"); push({ kind: "build", batches: d.batches, at: Date.now(), current: 0, done: false });
    let so = code, v = versions, h = head, buildSpend = NO_SPEND; const failedParts: string[] = [];
    try {
      for (let i = 0; i < d.batches.length; i++) {
        patchLast("build", (m) => ({ ...m, current: i }));
        const { code: add, cost } = await api<{ code: string; cost?: Spend & { calls: number } }>("/api/build", { json: { prompt: p, brief: d.brief, batches: d.batches, index: i,
          codeSoFar: so, use: use("builder"), refs: ref ? [ref] : undefined } });
        addSpend(cost); buildSpend = { credits: buildSpend.credits + (cost?.credits ?? 0), usd: buildSpend.usd + (cost?.usd ?? 0), unreported: buildSpend.unreported + (cost?.unreported ?? 0) };
        const note = `Build step ${i + 1}: ${d.batches[i]}`; const res = await commitVersion(joinCode(so, add), note, v, h);
        const fixed = await repairFailed(so, add, `Build step: ${d.batches[i]}`, note, res.v, res.r);
        if (fixed.left.length) failedParts.push(...fixed.left);
        so = fixed.code; v = fixed.v; h = v.length - 1; setBusy("Building the set");
      }
      setReloads((n) => n + 1); const r = await bridge.current!.load(so); setScene(r); setCam(r.cameras[0] ?? null); setBuilt(true);
      if (r.cameras[0]) await bridge.current?.view(r.cameras[0]);
      patchLast("build", (m) => ({ ...m, done: true }));
      const si = shotIntent(p, MAX_SECONDS); if (si?.recipe.length) { setRecipe(si.recipe); setSel(0); }
      const done: Msg = { kind: "note", text: `The set is ready: ${r.stats.objects} objects, ${r.cameras.length} cameras.${failedParts.length ? ` ${failedParts.length} part${failedParts.length > 1 ? "s" : ""} could not be built and ${failedParts.length > 1 ? "were" : "was"} left out (${failedParts.slice(0, 2).join("; ").slice(0, 160)}).` : ""} ${shotIntent(p, MAX_SECONDS)?.recipe.length ? "The shot below is set from your prompt: press Render shot" : "Pick a camera and a move below"}, or tell me what to change.${money(buildSpend) ? ` Building cost ${money(buildSpend)}.` : ""}` };
      push(done); await save({ v, h, cam: r.cameras[0] ?? null });
    } catch (e) { push({ kind: "error", text: `Building stopped: ${(e as Error).message}` }); }
    finally { setBusy(null); }
  }
  /** Ask first: the user's answer on the last confirm card (Apply → the change runs; Cancel → nothing changes). */
  async function confirmChange(apply: boolean) {
    const i = msgs.map((m) => m.kind).lastIndexOf("confirm"); const m = msgs[i] as Extract<Msg, { kind: "confirm" }> | undefined;
    if (!m || m.answer || busy) return;
    setMsgs((x) => x.map((y, k) => (k === i ? { ...m, answer: apply ? "apply" : "cancel" } : y)));
    if (apply) await change(m.request); else push({ kind: "note", text: "Okay, nothing changed." });
  }
  async function change(request: string) {
    setBusy("Changing the set");
    try {
      const { code: add, cost } = await api<{ code: string; cost?: Spend & { calls: number } }>("/api/change", { json: { prompt, brief: brief?.brief, codeSoFar: code, request, use: use("builder") } });
      addSpend(cost);
      const note = `Change: ${request.slice(0, 80)}`; const first = await commitVersion(joinCode(code, add), note);
      const { r, v, left } = await repairFailed(code, add, request, note, first.v, first.r);
      const failed = left.length ? ` ${left.length} part${left.length > 1 ? "s" : ""} of the change could not be built and ${left.length > 1 ? "were" : "was"} left out (${left.slice(0, 2).join("; ").slice(0, 160)}) — try saying it differently.` : "";
      push({ kind: "note", text: `Done. The set now has ${r.stats.objects} objects.${failed}${money(cost ?? NO_SPEND) ? ` Cost ${money(cost!)}.` : ""} Undo is at the top if you prefer the previous version.` });
      await save({ v, h: v.length - 1 });
    } catch (e) { push({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  }

  // ---------- shot: preview + render ----------
  async function preview() {
    if (!cam || !bridge.current) return;
    if (playhead !== null) { await bridge.current.stop(); return; }
    setShowing(null); setPlayhead(0); setPark(null);
    try { await bridge.current.play(cam, recipeStr, frameCount(seconds, 24), 24); } finally { setPlayhead(null); }
  }
  // A render that failed AFTER its frames were captured (a lost connection to the render server) continues from those
  // frames when Render shot is pressed again for the same shot — a 30 s shot captures for about an hour (10-29).
  const failedRender = useRef<{ key: string; id: string } | null>(null);
  async function renderShot(resume?: string) {
    if (!cam || !bridge.current || busy) return;
    const b = bridge.current, fps = 24, n = frameCount(seconds, fps);
    const shotKey = `${sceneId}|${head}|${cam}|${recipeStr}|${aspect}`;
    const again = resume ?? (failedRender.current?.key === shotKey ? failedRender.current.id : null);
    let shotId: string | null = again, captured = !!again;
    const shotLabel = `${recipe.map((r) => label(r.move)).join(", then ")}, ${seconds} s, from ${camLabel(cam)}`;
    const steps = (s: Partial<Record<RStep, "wait" | "now" | "done">>) => patchLast("render", (m) => ({ ...m, steps: { ...m.steps, ...s } }));
    setBusy("Rendering"); setShowing(null);
    push({ kind: "render", label: shotLabel, steps: { clay: again ? "done" : "now", look: "wait", video: "wait" } });
    try {
      const id = shotId ?? (await api<{ id: string }>("/api/shots", { method: "POST" })).id; shotId = id;
      if (!again) await b.interactive(false);
      if (!again) for (const m of ["clay", "lit"] as const) for (let s = 0; s < n; s += 16) {
        const frames = await b.frames({ cam, move: recipeStr, n, fps, w: SIZE.w, h: SIZE.h, mode: m, start: s, count: 16 });
        // Upload in pieces of ≤ 6 MB: Next's proxy keeps only the first 10 MB of a body, and detailed lit frames
        // at 1280×720 reach ~0.8 MB each (16 of them broke the upload, 10-28).
        for (let k = 0; k < frames.length;) {
          const form = new FormData(); form.set("mode", m); form.set("start", String(s + k));
          let bytes = 0;
          do { bytes += frames[k].byteLength; form.append("f", new Blob([frames[k]], { type: "image/jpeg" }), `f${s + k}.jpg`); k++; }
          while (k < frames.length && bytes + frames[k].byteLength <= 6_000_000);
          await api(`/api/shots/${id}/frames`, { form });
        }
      }
      captured = true; await b.interactive(true);
      // One LTX job per ≤ 15 s segment (long shots overlap by 9 frames and are crossfaded, lib/render.ts planSegments).
      const enc = await api<{ segs: [number, number][] | null }>(`/api/shots/${id}/encode`, { json: { fps, n } });
      const segs = enc.segs ?? [[0, n]], long = segs.length > 1;
      let firstLook = "", video = "";
      for (const [k, [start]] of segs.entries()) {
        if (long) setBusy(`Rendering part ${k + 1} of ${segs.length}`);
        const p = await b.prompt(cam, recipeStr, n, start);
        steps({ clay: "done", look: "now" });
        const { raw, cost: lookCost } = await api<{ raw: string; cost?: Spend & { calls: number } }>(`/api/shots/${id}/look`,
          { json: { prompt: p, use: use("look"), size: SIZE.look, format: SIZE.label, ...(long ? { seg: k, start, prevStart: k ? segs[k - 1][0] : 0 } : {}) } });
        addSpend(lookCost); if (!k) { firstLook = raw; patchLast("render", (m) => ({ ...m, look: raw })); }
        const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = raw; });
        // Cover-fit (centre crop), never stretch: the image model's frame is close to, not exactly, the clip's.
        const c = document.createElement("canvas"); c.width = SIZE.w; c.height = SIZE.h;
        const sc = Math.max(SIZE.w / img.width, SIZE.h / img.height), dw = img.width * sc, dh = img.height * sc;
        c.getContext("2d")!.drawImage(img, (SIZE.w - dw) / 2, (SIZE.h - dh) / 2, dw, dh);
        const lookPng = await new Promise<Blob>((res) => c.toBlob((x) => res(x!), "image/png"));
        steps({ look: k === segs.length - 1 ? "done" : "now", video: "now" });
        const form = new FormData(); form.set("look", lookPng, "look.png"); form.set("prompt", p); if (long) form.set("seg", String(k));
        await api(`/api/shots/${id}/render`, { form });
        for (;;) {
          await new Promise((r) => setTimeout(r, 5000));
          const s = await api<{ status: string; video?: string }>(`/api/shots/${id}/status${long ? `?seg=${k}` : ""}`);
          if (s.status === "succeeded" && s.video) { video = s.video; break; }
          if (s.status === "failed" || s.status === "cancelled") throw new Error(`the video render${long ? ` (part ${k + 1})` : ""} ${s.status}`);
        }
      }
      if (long) { setBusy("Joining the parts"); video = (await api<{ video: string }>(`/api/shots/${id}/stitch`, { json: { n, fps } })).video; }
      const take: Take = { id, label: shotLabel, video, clay: `/api/shots/${id}/file/clay.mp4`, thumb: firstLook };
      if (fps48On) {   // a failed 48 fps copy never costs the take: the 24 fps video is already saved
        setBusy("Making the 48 fps version");
        try { const r = await api<{ video48: string; method: string; model?: string }>(`/api/shots/${id}/fps48`, { json: {} });
          take.video48 = r.video48; take.by48 = r.method === "comfy" ? `ComfyUI ${r.model ?? ""}`.trim() : r.method; }
        catch (e) { push({ kind: "error", text: `The 48 fps version failed (${(e as Error).message}); the 24 fps video is kept.` }); }
      }
      failedRender.current = null;
      steps({ look: "done", video: "done" }); const tk = [...takes, take]; setTakes(tk); setShowing({ take, mode: "final" }); await save({ t: tk });
    } catch (e) {
      if (captured && shotId) failedRender.current = { key: shotKey, id: shotId };
      push({ kind: "error", text: `Render stopped: ${(e as Error).message}.${captured ? " Press Render shot again to continue from the frames already made." : ""}` });
      await b.interactive(true);
    }
    finally { setBusy(null); }
  }
  // ---------- custom camera path: keyframes from the orbit view ----------
  const keys = pathKeys(code, cam);
  const segStart = (i: number) => recipe.slice(0, i).reduce((s, r) => s + r.seconds, 0);
  async function setKeys(next: number[][], note: string, own = false) {
    if (!cam || !bridge.current) return;
    const sorted = [...next].sort((a, b) => (a[7] ?? 0) - (b[7] ?? 0));
    const block = `kit.cameraPath('${cam}', ${JSON.stringify(sorted.map((k) => k.map((x) => Math.round(x * 100) / 100)))});`;
    const r = await bridge.current.exec(block);
    if (!r.ok) { push({ kind: "error", text: `Could not set the path: ${r.error}` }); return; }
    await recordEdit(block, note, { stats: r.stats, cameras: r.cameras }, own ? undefined : `path:${cam}`);   // Clear = its own version (undo brings the path back)
  }
  /** Key time (s from the start of the selected path move): the parked playhead when it is inside that move, else
   *  one second after the last key. Keys saved before timing get times spread over the move first. */
  async function addKey() {
    if (!cam || !bridge.current) return;
    const v = await bridge.current.viewState(), len = recipe[sel]?.seconds ?? 4, s0 = segStart(sel);
    const timed = keys.map((k, i) => (k.length >= 8 ? k : [...k.slice(0, 7), keys.length > 1 ? (i / (keys.length - 1)) * len : 0]));
    const at = park !== null && park >= s0 && park <= s0 + len ? park - s0 : Math.min(len, timed.length ? Math.max(...timed.map((k) => k[7])) + 1 : 0);
    const same = timed.findIndex((k) => Math.abs(k[7] - at) < 0.05);
    const key = [...v.pos, ...v.target, v.fov, at];
    await setKeys(same >= 0 ? timed.map((k, i) => (i === same ? key : k)) : [...timed, key],
      same >= 0 ? `Re-frame the ${at.toFixed(1)} s keyframe of ${camLabel(cam)}` : `Path keyframe at ${at.toFixed(1)} s for ${camLabel(cam)}`);
  }
  // ---------- timeline scrubbing: park the playhead at a time ----------
  const [park, setPark] = useState<number | null>(null);
  const seeking = useRef(false);
  async function scrubTo(sec: number | null) {
    if (!bridge.current || !cam) return;
    if (sec === null) { setPark(null); await bridge.current.seek(null); return; }
    const t = Math.max(0, Math.min(seconds, sec)); setPark(t);
    let i = 0, acc = 0; while (i < recipe.length - 1 && t >= acc + recipe[i].seconds) acc += recipe[i++].seconds;
    setSel(i);
    if (seeking.current) return; seeking.current = true;   // drop drag moves while one seek is in flight
    try { await bridge.current.seek(cam, recipeStr, Math.round(t * 24), frameCount(seconds, 24), 24); } finally { seeking.current = false; }
  }
  useEffect(() => { setPark(null); bridge.current?.seek(null); }, [cam, recipeStr]);   // a new shot unparks
  useEffect(() => { setFps48User(null); }, [cam, recipeStr]);
  useEffect(() => {   // the set (head) and the frame format change the path / the measure too
    let live = true; setMotion(null);
    if (cam && viewerReady && built) bridge.current?.path(cam, recipeStr, frameCount(seconds, 24), 24)
      .then((st) => { if (live) setMotion(peakMotion(st, SIZE.w / SIZE.h)); }).catch(() => {});
    return () => { live = false; };
  }, [cam, recipeStr, seconds, viewerReady, built, head, aspect]);   // eslint-disable-line react-hooks/exhaustive-deps
  async function downloadStill() {
    if (!cam || !bridge.current) return;
    const [f] = await bridge.current.frames({ cam, move: recipeStr, n: frameCount(seconds, 24), fps: 24, w: SIZE.w, h: SIZE.h, mode, start: 0, count: 1 });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f], { type: "image/jpeg" })); a.download = `${title.slice(0, 40)}-${camLabel(cam)}.jpg`; a.click();
  }
  async function downloadGLB(as: "lit" | "clay" = "lit") {
    const g = await bridge.current!.glb(as); const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([g], { type: "model/gltf-binary" }));
    a.download = `${title.slice(0, 40) || "set"}${as === "clay" ? "-clay" : ""}.glb`; a.click();
    const s = scene?.size, dims = s ? `, set ${s.map((x) => Math.round(x)).join(" × ")} m` : "";
    push({ kind: "note", text: `Saved ${a.download} (${(g.byteLength / 1e6).toFixed(1)} MB${dims}).` });
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }

  // ---------- model chip ----------
  const allBuilder = config ? config.routes.flatMap((r) => (config.options[r]?.builder ?? []).map((o) => ({ ...o, route: r }))) : [];
  const curBuilder = builderUse ?? config?.defaults.builder ?? null;
  const curLabel = allBuilder.find((o) => o.route === curBuilder?.route && o.id === curBuilder?.model)?.label ?? "No model";
  // Render helpers, NOT components: a component defined inside Studio is a new type on every render, so React
  // remounted the native <select> each second and an open dropdown closed by itself.
  const modelChip = () => (
    <label className="pill" title="Model that plans and builds the set">{Icon.model}{curLabel}{curBuilder?.route === "codex" ? " (subscription)" : ""}
      <select aria-label="Model" value={curBuilder ? `${curBuilder.route}|${curBuilder.model}` : ""} onChange={(e) => { const [route, model] = e.target.value.split("|"); setBuilderUse({ route, model }); }}>
        {config?.routes.map((r) => <optgroup key={r} label={ROUTE_LABEL[r] ?? r}>
          {(config.options[r]?.builder ?? []).map((o) => <option key={o.id} value={`${r}|${o.id}`}>{o.label}{o.note ? `, ${o.note}` : ""}</option>)}</optgroup>)}
      </select></label>);
  const aspectChip = (locked = false) => (
    <label className="pill" title={locked ? "Frame format (fixed once takes exist)" : "Frame format"}>{Icon.frame}{aspect}
      <select aria-label="Frame format" value={aspect} disabled={locked || !!busy} onChange={(e) => setAspect(e.target.value as Aspect)}>
        {(Object.keys(ASPECTS) as Aspect[]).map((a) => <option key={a} value={a}>{ASPECTS[a].label}</option>)}
      </select></label>);
  const modeChip = () => (
    <label className="pill" title="How I work with your messages">{CHAT_MODES[chatMode]}
      <select aria-label="Chat mode" value={chatMode} disabled={!!busy} onChange={(e) => setChatMode(e.target.value as typeof chatMode)}>
        {(Object.keys(CHAT_MODES) as (keyof typeof CHAT_MODES)[]).map((m) => <option key={m} value={m}>{CHAT_MODE_HELP[m]}</option>)}
      </select></label>);
  const refChip = (id: string) => ref ? (
    <span className="pill on"><img className="refthumb" src={ref} alt="Reference" style={{ height: 22, width: 34 }} />Reference
      <button className="x" style={{ background: "none", border: 0, padding: 0, color: "inherit" }} aria-label="Remove reference" onClick={() => setRef(null)}>×</button></span>
  ) : (
    <label className="pill" htmlFor={id} title="Attach a picture for the style">{Icon.image}Reference
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRef(await fileToDataUrl(f)); e.target.value = ""; }} /></label>);

  // ---------- cost preview (P6): mean of this machine's recent build steps with the chosen builder ----------
  const builderKey = `${use("builder")?.route}|${use("builder")?.model}`;
  useEffect(() => {
    const u = use("builder"); if (!u || u.route === "codex") { setEst(null); return; }
    api<{ estimate: { credits: number; usd: number; runs: number } | null }>(`/api/costs?stage=build&route=${u.route}&model=${encodeURIComponent(u.model)}`)
      .then((r) => setEst(r.estimate)).catch(() => setEst(null));
  }, [builderKey, spend.credits]);   // eslint-disable-line react-hooks/exhaustive-deps -- refresh after each priced call

  // ---------- hands-on editing (components/EditTools.tsx): each edit = one version of the scene code ----------
  // Dragging the same object again replaces its previous kit.edit block instead of stacking versions.
  const recordEdit: RecordEdit = async (block, note, live, coalesce) => {
    const prev = versions[head]?.code ?? ""; const last = lastEdit.current;
    let base = prev, list = versions, at = head;
    if (coalesce && last?.key === coalesce && head === versions.length - 1 && prev.endsWith(last.block)) {
      base = prev.slice(0, prev.length - last.block.length); list = versions.slice(0, head); at = head - 1;
    }
    const add = `\n//@@\n${block}\n`;
    const now = new Date().toISOString();   // hand edits on an older version restore it first, like commitVersion
    const restored = at < list.length - 1 ? [{ code: list[at].code, note: `Restored version ${at + 1}`, at: now }] : [];
    const v = [...list, ...restored, { code: base + add, note, at: now }];
    setVersions(v); setHead(v.length - 1); lastEdit.current = coalesce ? { key: coalesce, block: add } : null;
    if (live.stats) setScene((s) => (s ? { ...s, stats: live.stats, cameras: live.cameras } : s));
    await save({ v, h: v.length - 1 });
  };
  const edit = useEditTools(viewerReady ? bridge.current : null, { enabled: view === "studio" && built && !showing && !busy,
    record: recordEdit, onError: (text) => push({ kind: "error", text }), reloads, code });

  // ---------- debug API (?debug=1): every UI action callable from outside + state + action log ----------
  // Used by bench/debug_api.py (a browser kept open, screenshot after each action) for internal UI testing.
  const dbgLog = useRef<{ at: string; action: string; args: unknown[]; error?: string }[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !new URLSearchParams(location.search).has("debug")) return;
    const wrap = (name: string, f: (...a: any[]) => unknown) => async (...args: unknown[]) => {
      const e: { at: string; action: string; args: unknown[]; error?: string } = { at: new Date().toISOString(), action: name, args };
      dbgLog.current.push(e);
      try { return await f(...args); } catch (err) { e.error = String((err as Error)?.message || err); throw err; }
    };
    const acts: Record<string, (...a: any[]) => unknown> = {
      home: () => { setView("home"); refreshScenes(); },
      openExample: (id: string) => { const ex = EXAMPLES.find((x) => x.id === id); if (!ex) throw new Error(`no example ${id}`); openExample(ex); },
      openBlank, openSaved: (id: string) => openSaved(id), renameScene: (id: string, t: string) => renameScene(id, t), deleteScene: (id: string) => deleteScene(id), shareFile: downloadSceneFile, addKey: () => addKey(), clearKeys: () => setKeys([], "Clear the path", true), seek: (s: number | null) => scrubTo(s),
      viewFrom: (c: string) => bridge.current?.view(c),   // move only the orbit view (tests: frame keyframes from other cameras)
      openSceneText: (text: string, name = "scene.o3j.json") => openSceneFile(new File([text], name, { type: "application/json" })),
      homePrompt: (text: string) => setHomePrompt(text), startFromPrompt,
      ref: (dataUrl: string | null) => setRef(dataUrl),
      aspect: (a: Aspect) => { if (!(a in ASPECTS)) throw new Error(`no aspect ${a}`); setAspect(a); },   // reference picture as a data: URL (null = remove)
      chat: (text: string) => setInput(text), send,
      answer: (qid: string, option: string) => setAnswers((a) => ({ ...a, [qid]: option })),
      confirmChange: (apply: boolean) => confirmChange(apply),
      continueQuestions: () => { const q = [...msgs].reverse().find((m) => m.kind === "questions") as Extract<Msg, { kind: "questions" }> | undefined;
        if (!q) throw new Error("no questions"); return direct(prompt, Object.fromEntries(q.questions.map((x) => [x.id, answers[x.id] ?? x.default]))); },
      buildThis: () => build(), concept: (on: boolean) => setConceptOn(!!on),
      model: (route: string, model: string) => setBuilderUse({ route, model }),
      camera: (c: string) => { setCam(c); setShowing(null); return bridge.current?.view(c); },
      move: (i: number, m: string) => setRecipe((r) => r.map((x, k) => (k === i ? { ...x, move: m } : x))),
      length: (i: number, s: number) => setRecipe((r) => r.map((x, k) => (k === i ? { ...x, seconds: s } : x))),
      addMove: (m = "arc-left", s = 4) => { setRecipe((r) => [...r, { move: m, seconds: s }]); setSel(recipe.length); },
      select: (i: number) => setSel(i), preview, render: () => renderShot(), resumeRender: (id: string) => renderShot(id), undo: () => goto(head - 1), redo: () => goto(head + 1), version: (h: number) => goto(h),
      mode: (m: "lit" | "clay") => { setMode(m); return bridge.current?.mode(m); },
      showTake: (i: number, m: "final" | "clay" | "side" = "final") => { const tk = takes[i]; if (tk) setShowing({ take: tk, mode: m }); },
      editMode: (m: "translate" | "rotate" | "scale" | null) => edit.acts.setMode(m), selectObject: (n: string | null, add = false) => edit.acts.select(n, !!add),
      selectMany: (names: string[]) => edit.acts.selectMany(names),
      editSelected: (e: { pos?: number[]; rot?: number[]; scale?: number }) => edit.acts.editSelected(e),
      duplicate: () => edit.acts.duplicate(), deleteSelected: () => edit.acts.remove(), addThing: (k: string) => edit.acts.add(k),
      objectsPanel: () => edit.acts.toggleList(), scenePanel: (on: boolean) => edit.acts.scenePanel(on), setLight: (p: { color?: string; intensity?: number; on?: boolean }) => edit.acts.setLight(p),
      sceneSettings: (p: { exposure?: number; lights?: number; background?: string | null }) => edit.acts.changeProps({ ...edit.props, ...p }),
      chatMode: (m: "auto" | "ask" | "go" | "chat") => setChatMode(m),
      library: (q: string) => edit.acts.searchLib(q), placeResult: (i = 0) => edit.acts.placeResult(i),
      packs: () => edit.acts.openPacks(),
      highFps: (on: boolean | null) => setFps48User(on),   // the 48 fps pill; null = back to automatic
      backToSet: () => setShowing(null), still: downloadStill, glb: (as: "lit" | "clay" = "lit") => downloadGLB(as),
    };
    (window as any).__o3j = {
      act: Object.fromEntries(Object.entries(acts).map(([k, f]) => [k, wrap(k, f)])),
      state: () => ({ view, title, busy, scenes: scenes.map((s) => ({ id: s.id, title: s.title })), built, viewerReady, sceneId, head, versions: versions.length, notes: versions.map((v) => v.note), edit: { mode: edit.mode, sel: edit.sel?.name ?? null, names: edit.sel?.names ?? null, pos: edit.sel?.pos ?? null, rot: edit.sel?.rot ?? null, scale: edit.sel?.scale ?? null, light: edit.sel?.light ?? null, note: versions[head]?.note, props: edit.props, lib: edit.lib }, chatMode, thumbs: Object.keys(thumbs), scene: scene && { stats: scene.stats, cameras: scene.cameras, skipped: scene.skipped.length, floating: scene.floating ?? [] },
        cam, recipe, sel, playhead, park, keys: keys.length, keyTimes: keys.map((k) => k[7] ?? null), takes: takes.map((x) => x.label), takes48: takes.filter((x) => x.video48).map((x) => ({ id: x.id, by: x.by48 })), fps48: { on: fps48On, auto: fps48Auto, user: fps48User, motion }, showing: showing && { take: showing.take.label, mode: showing.mode },
        model: builderUse ?? config?.defaults.builder, routes: config?.routes, msgs: msgs.map((m) => ({ kind: m.kind, text: "text" in m ? m.text : undefined })) }),
      log: () => dbgLog.current.slice(-200),
      // bench/debug_api.py /click and /drag: page px of an object (a spot where a click picks it) / of a gizmo handle
      locate: (name: string) => bridge.current?.locate(name) ?? null,
      gizmoHandle: (axis: "X" | "Y" | "Z" = "X") => bridge.current?.gizmoHandle(axis) ?? null,
    };
  });

  // ======================== HOME ========================
  if (view === "home") return (
    <div>
      <header className="topbar">
        <span className="brand">Comfy</span><span className="divider" aria-hidden /><span className="title">Open 3D Jutsu</span><span className="badge">BETA</span>
        <a className="topbar-link" href="https://github.com/martinsbrezauckis/open-3d-jutsu" target="_blank" rel="noreferrer">Source on GitHub ↗</a>
      </header>
      <main className="home">
        <section className="hero">
          <h1>Prompt your 3D set</h1>
          <p>Describe a place. Film it with real camera moves. Get a photoreal shot.</p>
          <div className="composer-card">
            <textarea value={homePrompt} onChange={(e) => setHomePrompt(e.target.value)} placeholder="Describe the place you want to film…" rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); startFromPrompt(); } }} />
            <div className="chips">
              {refChip("ref-home")}
              {modeChip()}
              {modelChip()}
              <button className={`pill ${conceptOn ? "on" : ""}`} aria-pressed={conceptOn} onClick={() => setConceptOn(!conceptOn)} title="Show a concept picture before building">{Icon.image}Concept picture</button>
              {aspectChip()}
            </div>
            <button className="run go" disabled={!homePrompt.trim() || !config?.routes.length} onClick={startFromPrompt}>Build set</button>
          </div>
          {config && !config.routes.length && <p className="note">No model route is set up. Add COMFY_API_KEY for Comfy Router, or log in to the Codex CLI.</p>}
        </section>

        <section className="section">
          <h2>My scenes</h2>
          <div className="grid3">
            <button className="card" onClick={openBlank}><div className="pic"><span className="blank-icon">{Icon.cube}</span></div><div className="meta">Create blank scene</div></button>
            <label className="card" title="Open a scene someone shared with you (.o3j.json)"><div className="pic"><span className="blank-icon">{Icon.plus}</span></div>
              <div className="meta">Open scene file</div>
              <input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) openSceneFile(f); }} /></label>
            {scenes.map((s) => (
              <div key={s.id} className="card-wrap">
                <button className="card" onClick={() => openSaved(s.id)}>
                  <div className="pic"><img src={`/api/scenes/${s.id}?thumb=1`} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} /></div>
                  <div className="meta">{s.title}<small>{new Date(s.updated).toLocaleString()}</small></div></button>
                <span className="card-acts">
                  <button className="ghost" aria-label={`Rename ${s.title}`} onClick={() => { const t = window.prompt("New name", s.title); if (t && t.trim()) renameScene(s.id, t); }}>Rename</button>
                  <button className="ghost" aria-label={`Delete ${s.title}`} onClick={() => { if (window.confirm(`Delete "${s.title}"? It moves to the trash folder.`)) deleteScene(s.id); }}>Delete</button>
                </span></div>))}
          </div>
        </section>

        <section className="section">
          <h2>Start with an example</h2>
          <div className="grid4">{EXAMPLES.map((ex) => (
            <button key={ex.id} className="card" onClick={() => openExample(ex)}><div className="pic"><img src={`/examples/${ex.id}.jpg`} alt="" /></div>
              <div className="meta">{ex.title}<small>Opens instantly</small></div></button>))}</div>
        </section>
      </main>
    </div>
  );

  // ======================== STUDIO ========================
  // While busy, say what is actually happening (planning, drawing the concept, building, rendering), not always "Building".
  const placeholder = busy ? `${busy}…` : chatMode === "chat" ? "Ask about the set, e.g. what lights are in the scene?" : !brief ? "Describe the place you want to film"
    : built ? "Tell me what to change, e.g. make it darker, add a second cage" : "Build this set, or tell me what to change in the plan";
  const total = seconds;
  const track = Math.max(15, Math.ceil(total / 15) * 15);   // timeline scale: 15 / 30 / 45 / 60 s
  return (
    <div className="studio-app">
      <header className="topbar">
        <button className="brand" onClick={() => { setView("home"); refreshScenes(); }}>Comfy</button><span className="divider" aria-hidden />
        <button className="title" onClick={() => { setView("home"); refreshScenes(); }}>Open 3D Jutsu</button><span className="badge">BETA</span>
        <span className="setname">{title}</span>
        <span className="spacer" />
        <button className="pill" disabled={head <= 0 || !!busy} onClick={() => goto(head - 1)} title={versions[head - 1]?.note}>{Icon.undo}Undo</button>
        <button className="pill" disabled={head >= versions.length - 1 || !!busy} onClick={() => goto(head + 1)} title={versions[head + 1]?.note}>{Icon.redo}Redo</button>
        {versions.length > 0 && <label className="pill" title="Versions of this set">Version {head + 1} of {versions.length}
          <select aria-label="Versions" value={head} onChange={(e) => goto(Number(e.target.value))}>{versions.map((v, i) => <option key={i} value={i}>{i + 1}. {v.note}</option>)}</select></label>}
        <button className="pill" disabled={!versions.length || !!busy} onClick={downloadSceneFile} title="Download this set as a file to share">Share</button>
        {modelChip()}
      </header>

      <div className="layout">
        <aside className="panel" aria-label="Chat">
          <div className="msgs">
            {msgs.map((m, i) => {
              if (m.kind === "user") return <div key={i} className="msg user">{m.text}{m.ref && <img src={m.ref} alt="Reference" />}</div>;
              if (m.kind === "error") return <div key={i} className="msg bot error" role="alert">{m.text}</div>;
              if (m.kind === "note") return <div key={i} className="msg bot">{m.text}{m.detail && <ul>{m.detail.map((d) => <li key={d}>{d}</li>)}</ul>}</div>;
              if (m.kind === "questions") return (
                <div key={i} className="msg bot">{m.questions.map((q) => (
                  <div className="question" key={q.id}><p>{q.question}</p>
                    <div className="options">{q.options.map((o) => <button key={o} aria-pressed={(answers[q.id] ?? q.default) === o} onClick={() => setAnswers({ ...answers, [q.id]: o })}>{o}</button>)}</div></div>))}
                  <div className="row"><button className="action" disabled={!!busy} onClick={() => direct(prompt, Object.fromEntries(m.questions.map((q) => [q.id, answers[q.id] ?? q.default])))}>Continue</button></div>
                </div>);
              if (m.kind === "confirm") return (
                <div key={i} className="msg bot">Change the set: “{m.request}”?
                  {m.answer ? <span className="caption">{m.answer === "apply" ? "Applied." : "Cancelled."}</span>
                    : <div className="row"><button className="action" disabled={!!busy} onClick={() => confirmChange(true)}>Apply change</button>
                      <button className="ghost" disabled={!!busy} onClick={() => confirmChange(false)}>Cancel</button></div>}</div>);
              if (m.kind === "concept") return (
                <div key={i} className="msg bot"><img className="wide" src={m.url} alt="Concept picture" /><span className="caption">Concept picture. The built set will differ in details.</span>
                  {!built && !busy && i === msgs.length - 1 && <div className="row"><button className="action" onClick={() => build()}>Build this set</button>
                    <button className="ghost" onClick={() => direct(prompt)}>Try another</button></div>}</div>);
              if (m.kind === "build") return (
                <div key={i} className="msg bot"><div className="msghead">{m.done ? "Built" : "Building"} the set {!m.done && <span className="t">{mmss(Math.round((now - m.at) / 1000))}</span>}</div>
                  <div className="steps">{m.batches.map((b, k) => { const st = m.done || k < m.current ? "done" : k === m.current ? "now" : "";
                    return <div key={k} className={`s ${st}`}><span className="mark">{st === "done" ? "✓" : st === "now" ? "●" : "○"}</span><span>{b}</span></div>; })}</div></div>);
              if (m.kind === "render") return (
                <div key={i} className="msg bot"><div className="msghead">Shot: {m.label}</div>
                  <div className="steps">{([["clay", "Clay and lit passes"], ["look", "Photoreal first frame"], ["video", "Video, LTX-2.5 Layout-To-Render"]] as [RStep, string][]).map(([k, t]) => (
                    <div key={k} className={`s ${m.steps[k]}`}><span className="mark">{m.steps[k] === "done" ? "✓" : m.steps[k] === "now" ? "●" : "○"}</span><span>{t}</span></div>))}</div>
                  {m.look && <img className="wide" src={m.look} alt="Photoreal first frame" />}</div>);
              return null;
            })}
            {busy && <div className="msg bot typing">{busy}<span className="dots" /></div>}
            <div ref={chatEnd} />
          </div>
          <form className="chatbox" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
              disabled={!viewerReady || !!busy} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <div className="row">{refChip("ref-chat")}{modeChip()}
              {!brief && <button type="button" className={`pill ${conceptOn ? "on" : ""}`} aria-pressed={conceptOn} onClick={() => setConceptOn(!conceptOn)}>Concept picture</button>}</div>
            <button className="run" type="submit" disabled={!input.trim() || !!busy || !viewerReady}>{chatMode === "chat" ? "Ask" : !brief ? "Build set" : built ? "Apply change" : "Revise plan"}</button>
            <p className="note">{ROUTE_NOTE[use("builder")?.route ?? "router"]}
              {est && est.runs > 0 && ` One build step has cost about ${money(est)} here (last ${est.runs}); a set is usually 4–6 steps.`}
              {money(spend) && ` This scene so far: ${money(spend)}.`}</p>
          </form>
        </aside>

        <main className="stage">
          <div className="viewer">
            <div className="screen">
              {showing && showing.mode !== "side" && <video key={showing.mode + showing.take.id} src={showing.mode === "final" ? showing.take.video48 ?? showing.take.video : showing.take.clay} autoPlay loop muted playsInline controls />}
              <iframe ref={iframe} title="3D set" src="/scenekit/studio.html" sandbox="allow-scripts"
                style={{ visibility: showing && showing.mode !== "side" ? "hidden" : "visible", width: showing?.mode === "side" ? "50%" : "100%" }} />
              {showing?.mode === "side" && <video src={showing.take.video} autoPlay loop muted playsInline style={{ left: "50%", width: "50%" }} />}
              {!showing && aspect !== "16:9" && <div className="frame-guide" aria-hidden style={{ aspectRatio: `${SIZE.w} / ${SIZE.h}` }} />}
              {edit.ui}
              {!versions.length && <div className="screen-empty">{busy ? `${busy}…` : brief ? "Your 3D set appears here once it is built." : "Your 3D set appears here."}</div>}
              <div className="seg" role="group" aria-label="View">
                {showing ? <>{(["final", "clay", "side"] as const).map((v) => <button key={v} aria-pressed={showing.mode === v} onClick={() => setShowing({ ...showing, mode: v })}>{v === "side" ? "Side by side" : v === "final" ? "Final" : "Clay"}</button>)}
                  <button onClick={() => setShowing(null)}>Set</button></>
                  : <>{(["lit", "clay"] as const).map((v) => <button key={v} aria-pressed={mode === v} onClick={() => { setMode(v); bridge.current?.mode(v); }}>{v === "lit" ? "Lit" : "Clay"}</button>)}</>}
              </div>
              <div className="tags">{scene && <span>{scene.stats.objects} objects</span>}{cam && <span>{camLabel(cam)}</span>}
                {busy === "Building the set" && <span className="live">Building</span>}</div>
            </div>

            <div className="shotbar" aria-label="Shot">
              <div className="cams">{camsInOrder(scene?.cameras ?? []).map((c) => (
                <button key={c} className="cam" aria-pressed={cam === c} onClick={() => { setCam(c); setShowing(null); bridge.current?.view(c); }}>
                  {thumbs[c] ? <img src={thumbs[c]} alt="" /> : <div className="ph" />}<span>{camLabel(c)}</span></button>))}</div>
              <label className="pill" title="Camera move">{label(recipe[sel]?.move ?? "dolly-in")}
                <select aria-label="Camera move" value={recipe[sel]?.move} onChange={(e) => setRecipe(recipe.map((r, i) => (i === sel ? { ...r, move: e.target.value } : r)))}>
                  {GROUPS.map((g) => <optgroup key={g.name} label={g.name}>{g.moves.map((m) => <option key={m} value={m}>{label(m)}</option>)}</optgroup>)}</select></label>
              <label className="pill" title="Length of this move">{Icon.clock}{recipe[sel]?.seconds} s
                <select aria-label="Length" value={recipe[sel]?.seconds} onChange={(e) => setRecipe(recipe.map((r, i) => (i === sel ? { ...r, seconds: Number(e.target.value) } : r)))}>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((s) => <option key={s} value={s} disabled={total - (recipe[sel]?.seconds ?? 0) + s > MAX_SECONDS}>{s} s</option>)}</select></label>
              <button className="pill" disabled={total >= MAX_SECONDS} onClick={() => { setRecipe([...recipe, { move: "arc-left", seconds: Math.min(4, MAX_SECONDS - total) }]); setSel(recipe.length); }}>{Icon.plus}Add move</button>
              {aspectChip(takes.length > 0)}
              <button className={`pill ${fps48On ? "on" : ""}`} aria-pressed={fps48On} onClick={() => setFps48User(!fps48On)}
                title={`Also make a 48 fps copy (the 24 fps video is kept)${fps48Auto ? ": on by itself for this fast move" : ""}`}>48 fps</button>
              <span className="grow" />
              <button className="ghost" disabled={!cam} onClick={downloadStill}>Still</button>
              <button className="ghost" disabled={!scene} title="3D set with materials and textures (Blender, Unreal, Unity); Shift-click for geometry only" onClick={(e) => downloadGLB(e.shiftKey ? "clay" : "lit")}>GLB</button>
              {showing && <a className="ghost" href={showing.take.video} download>Video</a>}
              {showing?.take.video48 && <a className="ghost" href={showing.take.video48} download title={showing.take.by48 && `Made with ${showing.take.by48}`}>48 fps</a>}
              <button className="action" disabled={!built || !cam || total > MAX_SECONDS || !!busy} onClick={() => renderShot()} title={total > 15 ? "Longer than 15 s: rendered in parts and joined" : undefined}>Render shot</button>
            </div>

            <div className="timeline" aria-label="Timeline">
              <button className="play" disabled={!cam} onClick={preview} aria-label={playhead !== null ? "Stop preview" : "Preview the move"}>
                {playhead !== null ? <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg>}</button>
              <div className="track" title="Click or drag to look at a moment of the shot"
                onPointerDown={(e) => { if (playhead !== null || !cam) return; const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.setPointerCapture(e.pointerId); scrubTo(((e.clientX - r.left) / r.width) * track); }}
                onPointerMove={(e) => { if (!e.buttons || playhead !== null || !cam) return; const r = e.currentTarget.getBoundingClientRect(); scrubTo(((e.clientX - r.left) / r.width) * track); }}>
                {recipe.reduce<{ el: React.ReactNode[]; x: number }>((acc, r, i) => { const w = (r.seconds / track) * 100, x0 = acc.x;
                  acc.el.push(<button key={i} className="seg-move" aria-pressed={sel === i} style={{ left: `${x0}%`, width: `calc(${w}% - 4px)` }} onClick={(e) => { if (e.detail === 0) setSel(i); }}
                    title="Click or drag to look at a moment; this move is selected for changes">{label(r.move)} {r.seconds} s</button>);
                  if (r.move === "path") for (const k of keys) if (k.length >= 8 && k[7] <= r.seconds)
                    acc.el.push(<span key={`k${i}-${k[7]}`} className="key" style={{ left: `${x0 + (k[7] / track) * 100}%` }} title={`Keyframe at ${k[7].toFixed(1)} s`} />);
                  acc.x += w; return acc; }, { el: [], x: 0 }).el}
                {(playhead ?? (park !== null ? park / Math.max(1e-6, total) : null)) !== null && <span className="head" style={{ left: `${(playhead ?? park! / total) * (total / track) * 100}%` }} />}
              </div>
              {recipe[sel]?.move === "path" && <span className="pill keys" title="Click the timeline to pick a time, frame the view, then add it: the camera passes through this view at that time">
                {keys.length} keyframe{keys.length === 1 ? "" : "s"}{park !== null ? ` · at ${(park - segStart(sel)).toFixed(1)} s` : ""}
                <button className="ghost" disabled={!cam || !!busy} onClick={addKey}>{Icon.plus}Add from view</button>
                {keys.length > 0 && <button className="ghost" disabled={!!busy} onClick={() => setKeys([], `Clear the path of ${camLabel(cam!)}`, true)}>Clear</button>}</span>}
              <span className="time">{playhead !== null ? `${(playhead * total).toFixed(1)} s / ` : park !== null ? `${park.toFixed(1)} s / ` : ""}{total} s of {MAX_SECONDS}
                {recipe.length > 1 && <button className="x" style={{ background: "none", border: 0, color: "var(--muted)", marginLeft: 8 }} onClick={() => { setRecipe(recipe.filter((_, i) => i !== sel)); setSel(0); }}>Remove</button>}</span>
            </div>
          </div>

          {takes.length > 0 && <nav className="takes" aria-label="Takes">{takes.map((t, i) => (
            <button key={t.id} className="take" aria-current={showing?.take.id === t.id} onClick={() => setShowing({ take: t, mode: "final" })}>
              {t.thumb ? <img src={t.thumb} alt="" /> : null}<span><b>Take {i + 1}</b> {t.label}</span></button>))}</nav>}
        </main>
      </div>
    </div>
  );
}
