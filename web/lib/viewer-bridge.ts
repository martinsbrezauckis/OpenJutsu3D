/**
 * viewer-bridge.ts — promise wrapper around the sandboxed 3D viewport (public/scenekit/studio.html).
 * The iframe has an opaque origin (sandbox="allow-scripts", no allow-same-origin), so its messages arrive with
 * origin "null"; we accept only messages whose source is that iframe's window, and post to it with targetOrigin "*"
 * (an opaque origin cannot be named — the iframe itself refuses anyone but our origin, see studio.html).
 */
export type ViewerResult = { ok: boolean; error?: string; skipped: { line: number; error: string; code: string; dropped_lines: number }[];
  floating?: { name: string; parts: number; height: number; at: number[] }[];
  stats: { objects: number; meshes: number; triangles: number; lights: number; cameras: number };
  meta: Record<string, string>; cameras: string[]; size?: number[] | null; sky?: { exterior: boolean; tod: string; vacuum: boolean } };

export type ObjEdit = { name: string; pos: number[]; rot: number[]; scale: number | number[] };
/** A selection: one object / light / camera, or a group of objects (`names`, 2+; pos/rot/scale = the group gizmo). */
export type ObjInfo = ObjEdit & { category: string; names?: string[]; light?: { type: string; color: string; intensity: number; on: boolean } };

export class ViewerBridge {
  private seq = 0;
  private waiting = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  ready: Promise<string[]>;
  /** Called for every frame of a running play() (timeline playhead). */
  onTick?: (i: number, n: number) => void;
  /** Click in the viewport picked an object (null = clicked empty space). */
  onPicked?: (info: ObjInfo | null) => void;
  /** A gizmo drag finished: record it as kit.edit(name, {pos, rot, scale}). */
  onEdited?: (e: ObjEdit) => void;
  /** A group gizmo drag finished: every object's final state (recorded as ONE version) + the group gizmo's state. */
  onEditedMany?: (edits: ObjEdit[], group: { pos: number[]; rot: number[]; scale: number }) => void;
  /** A key pressed while the viewport has focus (only Escape is forwarded). */
  onKey?: (key: string) => void;
  private onReady!: (moves: string[]) => void;

  constructor(private frame: HTMLIFrameElement) {
    this.ready = new Promise((r) => (this.onReady = r));
    window.addEventListener("message", this.onMessage);
  }
  dispose() { window.removeEventListener("message", this.onMessage); }

  private onMessage = (ev: MessageEvent) => {
    if (ev.source !== this.frame.contentWindow) return;   // only our viewport
    const m = ev.data || {};
    if (m.type === "ready") return this.onReady(m.moves || []);
    if (m.type === "tick") return this.onTick?.(m.i, m.n);
    if (m.type === "picked") return this.onPicked?.(m.info ?? null);
    if (m.type === "key") return this.onKey?.(m.key);
    if (m.type === "edited" && Array.isArray(m.edits)) return this.onEditedMany?.(m.edits, m.group);
    if (m.type === "edited") return this.onEdited?.({ name: m.name, pos: m.pos, rot: m.rot, scale: m.scale });
    const w = this.waiting.get(m.id); if (!w) return;
    this.waiting.delete(m.id);
    m.error ? w.reject(new Error(m.error)) : w.resolve(m);
  };

  private call<T = any>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.frame.contentWindow?.postMessage({ id, ...msg }, "*", transfer);
    });
  }
  private sentModels = new Set<string>();
  /** Hand the viewport every model that kit.model() lines in `code` use (library / imported GLBs), once each. The app
   *  fetches them: the sandboxed viewport never calls the app's API. A missing model just skips that code block. */
  async ensureModels(code: string) {
    // every asset id in the code: kit.model's model, its {motions: [...]} and kit.motion lines
    const ids = [...new Set(Array.from(code.matchAll(/'((?:lib|up):[A-Za-z0-9_.-]{4,120})'/g), (m) => m[1]))]
      .filter((id) => !this.sentModels.has(id));
    if (!ids.length) return;
    const got = (await Promise.all(ids.map(async (id) => {
      const r = await fetch(id.startsWith("lib:") ? `/api/library/${id.slice(4)}/model` : `/api/assets/${id.slice(3)}`).catch(() => null);
      return r?.ok ? { id, glb: await r.arrayBuffer() } : null;
    }))).filter((x): x is { id: string; glb: ArrayBuffer } => !!x);
    if (!got.length) return;
    await this.call({ type: "models", items: got }, got.map((g) => g.glb));
    got.forEach((g) => this.sentModels.add(g.id));
  }
  /** keepView: a reload of the same scene (edit, chat change, undo) keeps the user's current view. */
  async load(code: string, keepView = false) { await this.ensureModels(code); return this.call<{ result: ViewerResult }>({ type: "load", code, keepView }).then((r) => r.result); }
  mode(mode: "lit" | "clay") { return this.call({ type: "mode", mode }); }
  view(cam?: string) { return this.call({ type: "view", cam }); }
  interactive(on: boolean) { return this.call({ type: "interactive", on }); }
  /** Render prompt for frame `i` (default 0; long shots: each segment's first frame). */
  prompt(cam: string, move: string, n: number, i = 0) { return this.call<{ prompt: string }>({ type: "prompt", cam, move, n, i }).then((r) => r.prompt); }
  frames(a: { cam: string; move: string; n: number; fps: number; w: number; h: number; mode: "clay" | "lit"; start: number; count: number }) {
    return this.call<{ frames: ArrayBuffer[] }>({ type: "frames", quality: 0.93, ...a }).then((r) => r.frames);
  }
  /** The set as GLB bytes: "lit" = real materials + embedded JPEG textures, "clay" = geometry only. */
  glb(as: "lit" | "clay" = "lit") { return this.call<{ glb: ArrayBuffer }>({ type: "glb", as }).then((r) => r.glb); }
  play(cam: string, move: string, n: number, fps = 24) { return this.call({ type: "play", cam, move, n, fps }); }
  stop() { return this.call({ type: "stop" }); }
  /** Convert an FBX (Mixamo download) to GLB in the viewport: meshes = 0 with clips = a motion file. */
  fbx(data: ArrayBuffer) {
    return this.call<{ glb: ArrayBuffer; meshes: number; bones: number; dropped: number; clips: { name: string; seconds: number }[] }>({ type: "fbx", data }, [data]);
  }
  /** Park the timeline at frame i (people pose, live view = the shot camera then); seek(null) unparks. */
  seek(cam: string | null, move?: string, i?: number, n?: number, fps = 24) {
    return this.call<{ state: unknown }>(cam === null ? { type: "seek", i: null } : { type: "seek", cam, move, i, n, fps });
  }
  /** The shot camera's planned state at every frame (pos, lookAt, fov, roll): lib/fps48.ts measures its speed. */
  path(cam: string, move: string, n: number, fps = 24) {
    return this.call<{ states: { pos: number[]; lookAt: number[]; fov: number; roll: number; cam?: string; seg?: number; cut?: boolean }[] }>({ type: "path", cam, move, n, fps }).then((r) => r.states);
  }
  async exec(code: string) { await this.ensureModels(code); return this.call<{ ok: boolean; error?: string; stats: ViewerResult["stats"]; cameras: string[] }>({ type: "exec", code }); }
  /** add = Shift/Ctrl-click: toggle `name` in / out of a group selection. */
  select(name: string | null, add = false) { return this.call<{ info: ObjInfo | null }>({ type: "select", name, add }).then((r) => r.info); }
  selectMany(names: string[]) { return this.call<{ info: ObjInfo | null }>({ type: "selectMany", names }).then((r) => r.info); }
  /** Move / turn / scale the selected group as one gizmo drag (applied live; the caller records the edits). */
  editGroup(e: { pos?: number[]; rot?: number[]; scale?: number }) {
    return this.call<{ edits: ObjEdit[]; group: { pos: number[]; rot: number[]; scale: number } | null }>({ type: "editGroup", ...e });
  }
  /** Automation: page px where a click picks `name` / the gizmo handle of `axis` (null = not on screen). */
  async locate(name: string) { return this.toPage((await this.call<{ at: number[] | null }>({ type: "locate", name })).at); }
  async gizmoHandle(axis: "X" | "Y" | "Z") {
    const r = await this.call<{ at: number[] | null; from: number[] | null }>({ type: "gizmoHandle", axis });
    return r.at && r.from ? { at: this.toPage(r.at)!, from: this.toPage(r.from)! } : null;
  }
  private toPage(p: number[] | null) { if (!p) return null; const r = this.frame.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; }
  gizmo(mode: "translate" | "rotate" | "scale" | null) { return this.call({ type: "gizmo", mode }); }
  objects() { return this.call<{ objects: { name: string; category: string; triangles: number }[] }>({ type: "objects" }).then((r) => r.objects); }
  viewState() { return this.call<{ pos: number[]; target: number[]; fov: number; hit: number[] | null; ground: number[] | null }>({ type: "viewState" }); }
  thumb(cam: string) { return this.call<{ frame: ArrayBuffer }>({ type: "thumb", cam }).then((r) => r.frame); }
}
