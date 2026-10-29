"use client";
/**
 * EditTools — hands-on editing of the built set in the viewport (P5): pick objects (click, or the object list), move /
 * rotate / scale them with a gizmo, duplicate, delete, add primitives, lights and a camera at the current view.
 * Every action becomes a line of scene code (kit.edit / kit.clone / kit.remove / kit.object / kit.light / kit.camera),
 * run live in the viewport (no reload, the view stays put) and recorded as a version by the parent — so undo/redo,
 * saving and later chat changes all see the edits. The viewport itself is sandboxed (lib/viewer-bridge.ts).
 */
import { useEffect, useRef, useState } from "react";
import type { ObjEdit, ObjInfo, ViewerBridge } from "@/lib/viewer-bridge";

export type GizmoMode = "translate" | "rotate" | "scale" | null;
/** Parent records one edit: `block` is appended as a //@@ block; `coalesce` = replace the previous block if it had the same key. */
export type RecordEdit = (block: string, note: string, live: { stats: any; cameras: string[] }, coalesce?: string) => Promise<void>;

type LibHit = { id: string; name: string; category: string; height: number | null; mb: number | null; preview: string | null; pack?: string };
type PackRow = { id: string; name: string; kind: string; licence: string; credit: string; enabled: boolean; builder: boolean; count: number };
type KnownPack = { id: string; name: string; licence: string; credit: string; size: string; how: string; url?: string };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28) || "model";
const ADD: { id: string; label: string }[] = [{ id: "library", label: "Model from the library…" },
  { id: "person", label: "Person" },
  { id: "cube", label: "Cube" }, { id: "sphere", label: "Sphere" }, { id: "cylinder", label: "Cylinder" }, { id: "cone", label: "Cone" }, { id: "pyramid", label: "Pyramid" },
  { id: "point", label: "Point light" }, { id: "spot", label: "Spot light" }, { id: "sun", label: "Sun" }, { id: "camera", label: "Camera from this view" },
];
const r2 = (v: number) => Math.round(v * 100) / 100;
const v3 = (a: number[]) => `[${a.map(r2).join(", ")}]`;
export type SceneProps = { exposure: number; lights: number; background: string | null };
const DEFAULT_PROPS: SceneProps = { exposure: 1, lights: 1, background: null };
/** The scene's current properties = the last kit.settings(...) line in its code (kit.settings: later values win). */
export function parseSettings(code: string): SceneProps {
  const p = { ...DEFAULT_PROPS };
  for (const m of code.matchAll(/kit\.settings\(\{([^}]*)\}\)/g)) {
    const num = (k: string) => { const x = new RegExp(`${k}\\s*:\\s*([0-9.]+)`).exec(m[1]); return x ? Number(x[1]) : undefined; };
    const bg = /background\s*:\s*'([^']*)'/.exec(m[1]);
    p.exposure = num("exposure") ?? p.exposure; p.lights = num("lights") ?? p.lights;
    if (bg) p.background = bg[1] === "auto" ? null : bg[1];
  }
  return p;
}
const settingsLine = (p: SceneProps) => `kit.settings({ exposure: ${p.exposure.toFixed(2)}, lights: ${p.lights.toFixed(2)}, background: '${p.background ?? "auto"}' });`;
export const editLine = (e: ObjEdit) => `kit.edit('${e.name}', { pos: ${v3(e.pos)}, rot: ${v3(e.rot)}, scale: ${Array.isArray(e.scale) ? v3(e.scale) : r2(e.scale)} });`;
/** Several lines as ONE version, each its own //@@ block: if a later change drops one object, a reload skips only its
 *  line (the viewer skips a failing block), not the whole group's edit. */
export const groupBlock = (lines: string[]) => lines.join("\n//@@\n");
const groupKey = (names: string[]) => `edit:${names.join(",")}`;

export function useEditTools(bridge: ViewerBridge | null, opts: { enabled: boolean; record: RecordEdit; onError: (msg: string) => void; reloads: number; code: string }) {
  const [mode, setModeState] = useState<GizmoMode>(null);
  const [sel, setSel] = useState<ObjInfo | null>(null);
  const [list, setList] = useState<{ name: string; category: string }[] | null>(null);   // null = panel closed
  const optsRef = useRef(opts); optsRef.current = opts;
  const [props, setProps] = useState<SceneProps>(DEFAULT_PROPS);
  const [scenePanel, setScenePanel] = useState(false);
  const propsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Asset library (P9): search the local model collection + your imported GLBs; a pick is placed where you look.
  const [lib, setLib] = useState<{ q: string; items: LibHit[]; uploads: LibHit[]; credit: string | null; on: boolean; busy: boolean } | null>(null);
  async function searchLib(q: string) {
    setLib((l) => ({ ...(l ?? { items: [], uploads: [], credit: null, on: true }), q, busy: true }));
    const r = await fetch(`/api/library?q=${encodeURIComponent(q)}&limit=36`).then((x) => x.json()).catch(() => null);
    setLib({ q, busy: false, on: !!r?.on, credit: r?.credit ?? null, items: r?.items ?? [],
      uploads: (r?.uploads ?? []).map((u: { id: string; name: string; height: number | null; kind?: string }) => ({ id: u.id, name: u.name,
        category: u.kind === "motion" ? "motion" : u.kind === "character" ? "character" : "imported", height: u.height, mb: null, preview: null })) });
  }
  // Packs (user-chosen model sources): list, add (known / folder / link), switch on/off, remove.
  const [packsView, setPacksView] = useState<{ packs: PackRow[]; known: KnownPack[]; busy: string | null; err: string | null } | null>(null);
  const packsApi = async (method: string, body?: unknown, q = "") => {
    const r = await fetch(`/api/packs${q}`, { method, headers: { "X-O3J": "1", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? r.statusText); return j;
  };
  async function openPacks() { const j = await packsApi("GET"); setPacksView({ packs: j.packs, known: j.known, busy: null, err: null }); }
  async function packAction(label: string, f: () => Promise<unknown>) {
    setPacksView((v) => v && { ...v, busy: label, err: null });
    try { await f(); const j = await packsApi("GET"); setPacksView({ packs: j.packs, known: j.known, busy: null, err: null }); await searchLib(lib?.q ?? ""); }
    catch (e) { setPacksView((v) => v && { ...v, busy: null, err: (e as Error).message }); }
  }
  async function placeModel(it: LibHit & { as?: string }) {
    if (!bridge) return;
    const v = await bridge.viewState(); const p = v.hit ?? v.target; const names = await taken();
    const person = it.category === "character";
    const name = unique(`${person ? "CHAR" : "PRP"}_${slug(it.name)}`, names);
    const h = it.height ? `, height: ${r2(it.height)}` : "";   // no height = the model's own real-world size
    // a person stands on the ground under the aim point and faces the view (like Add › Person)
    const at = person && v.ground ? v.ground : p, face = person ? Math.round((Math.atan2(v.pos[0] - at[0], v.pos[2] - at[2]) * 180) / Math.PI) : 0;
    if (await run(`kit.model('${name}', '${it.id}', { pos: ${v3(at)}${h}, rotY: ${face}${it.as ? `, as: '${it.as}'` : ""} });`, `Add ${it.name}`)) {
      setLib(null);   // show the placed model (the panel covers the view); Add › library opens it again
      await select(name); if (!mode) await setMode("translate");
    }
  }
  const [importing, setImporting] = useState<string | null>(null);
  /** A motion card of the library: give the selected person that motion. */
  async function giveMotion(u: LibHit) {
    if (sel?.category !== "CHAR") { optsRef.current.onError("Select a person in the set first, then click the motion to give it to them."); return; }
    const w = motionWord(u.name);
    if (await run(`kit.motion('${sel.name}', '${u.id}'${w ? `, { as: '${w}' }` : ""});`, `${sel.name}: ${u.name}`)) setLib(null);
  }
  /** What a motion file is, from its name (Mixamo names: "Walking", "Sitting Idle", "Waving"…) — for the render prompt. */
  const motionWord = (n: string) => (/walk/i.test(n) ? "walk" : /run|sprint/i.test(n) ? "run" : /jog/i.test(n) ? "jog" : /sit/i.test(n) ? (/talk/i.test(n) ? "sit_talk" : "sit")
    : /talk|convers/i.test(n) ? "talk" : /wav/i.test(n) ? "wave" : /danc/i.test(n) ? "dance" : /jump/i.test(n) ? "jump" : /fight|punch|box/i.test(n) ? "fight" : /idle|stand/i.test(n) ? "idle" : null);
  /** Import a .glb or .fbx (e.g. a Mixamo character or motion). FBX files are converted in the viewport first. */
  async function importModel(f: File) {
    if (!bridge) return;
    // Mixamo file names carry export settings ("Remy_TPose_WithSkin", "Megan_Walking_InPlace_WithSkin"): drop them
    const base = f.name.replace(/\.(glb|fbx)$/i, "").replace(/[_ -](T-?Pose|With(?:out)?[_ ]?Skin|In[_ ]?Place)(?=[_ -]|$)/gi, "") || "model";
    let file: Blob = f, motionOnly = false, person = false;
    try {
      if (/\.fbx$/i.test(f.name)) {
        setImporting(`Converting ${f.name}…`);
        const c = await bridge.fbx(await f.arrayBuffer());
        file = new Blob([c.glb], { type: "model/gltf-binary" }); motionOnly = c.meshes === 0 && c.clips.length > 0; person = c.meshes > 0 && c.bones > 0;
        if (!c.meshes && !c.clips.length) throw new Error("That FBX file has neither a model nor a motion in it.");
      }
      const target = motionOnly && sel?.category === "CHAR" ? sel.name : null;
      if (motionOnly && !target) throw new Error("That file is a motion without a body: select a person in the set first, then import it to give them this motion.");
      setImporting(`Adding ${base}…`);
      const form = new FormData(); form.set("file", file, `${base}.glb`); form.set("name", base); form.set("kind", motionOnly ? "motion" : person ? "character" : "model");
      const r = await fetch("/api/assets", { method: "POST", headers: { "X-O3J": "1" }, body: form }).then((x) => x.json()).catch(() => null);
      if (!r?.id) throw new Error(r?.error ?? "The import failed.");
      const w = motionWord(base), as = w ? `, { as: '${w}' }` : "";
      if (target) { if (await run(`kit.motion('${target}', '${r.id}'${as});`, `${target}: ${base}`)) setLib(null); }
      else await placeModel({ id: r.id, name: base, category: person ? "character" : "imported", height: null, mb: null, preview: null, as: person && w ? w : undefined });
    } catch (e) { optsRef.current.onError((e as Error).message); }
    finally { setImporting(null); }
  }

  // ---------- light panel ----------
  const lightBase = useRef(new Map<string, number>());   // brightness slider spans 0–200 % of the light as first selected
  const lightMax = (s: ObjInfo) => { if (!lightBase.current.has(s.name)) lightBase.current.set(s.name, Math.max(0.5, s.light?.intensity ?? 1)); return lightBase.current.get(s.name)! * 2; };
  async function setLight(p: { color?: string; intensity?: number; on?: boolean }) {
    if (!sel?.light) return;
    const next = { ...sel.light, ...p }; setSel({ ...sel, light: next });
    const r2x = (x: number) => Math.round(x * 1000) / 1000;
    await run(`kit.lightProps('${sel.name}', { color: '${next.color}', intensity: ${r2x(next.intensity)}, on: ${next.on} });`, `Light ${sel.name}`, `light:${sel.name}`);
  }
  async function run(block: string, note: string, coalesce?: string) {
    if (!bridge) return false;
    const r = await bridge.exec(block);
    if (!r.ok) { optsRef.current.onError(`That edit did not apply: ${r.error}`); return false; }
    await optsRef.current.record(block, note, { stats: r.stats, cameras: r.cameras }, coalesce);
    if (list) setList(await bridge.objects());
    return true;
  }
  useEffect(() => {
    if (!bridge) return;
    bridge.onPicked = (info) => setSel(info);
    bridge.onKey = (k) => { if (k === "Escape") escape(); };
    // The gizmo already moved the object live; record the final state (one version per object while you keep dragging it).
    bridge.onEdited = (e) => { setSel((s) => (s && s.name === e.name ? { ...s, ...e } : s));
      optsRef.current.record(editLine(e), `Edit ${e.name}`, { stats: null, cameras: [] }, `edit:${e.name}`); };
    // A group drag: one version for the whole selection, coalesced while the same group keeps being dragged.
    bridge.onEditedMany = (edits, group) => { setSel((s) => (s?.names ? { ...s, ...group } : s));
      optsRef.current.record(groupBlock(edits.map(editLine)), `Edit ${edits.length} objects`, { stats: null, cameras: [] }, groupKey(edits.map((e) => e.name))); };
    const onKey = (e: KeyboardEvent) => {   // Esc outside text fields
      if (e.key !== "Escape" || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      escape();
    };
    window.addEventListener("keydown", onKey);
    return () => { bridge.onPicked = undefined; bridge.onEdited = undefined; bridge.onEditedMany = undefined; bridge.onKey = undefined; window.removeEventListener("keydown", onKey); };
  }, [bridge]);
  // A full reload (undo/redo, rebuild, chat change) replaces every object: drop the stale selection.
  useEffect(() => { setSel(null); setProps(parseSettings(optsRef.current.code)); }, [opts.reloads]);
  /** Scene properties: applied live on every change, recorded once the slider settles (one coalesced version). */
  async function changeProps(next: SceneProps) {
    setProps(next); const line = settingsLine(next);
    const r = await bridge?.exec(line); if (r && !r.ok) { optsRef.current.onError(`That setting did not apply: ${r.error}`); return; }
    if (propsTimer.current) clearTimeout(propsTimer.current);
    propsTimer.current = setTimeout(() => { optsRef.current.record(line, "Scene settings", { stats: null, cameras: [] }, "settings"); }, 600);
  }
  // Leaving edit conditions (render, take on screen) drops the gizmo; a reload clears the selection in the viewport.
  useEffect(() => { if (!opts.enabled && bridge) { bridge.gizmo(null); setModeState(null); } }, [opts.enabled, bridge]);

  const setMode = async (m: GizmoMode) => { setModeState(m); await bridge?.gizmo(m); };
  /** add = Shift / Ctrl / Cmd-click: toggle an object in or out of the selection. */
  const select = async (name: string | null, add = false) => setSel((await bridge?.select(name, add)) ?? null);
  const selectMany = async (names: string[]) => setSel((await bridge?.selectMany(names)) ?? null);
  /** Esc: drop the selection and go back to Orbit (Higgsfield: Esc leaves the current tool / camera). */
  const escapeRef = useRef(async () => {});
  escapeRef.current = async () => { await select(null); await setMode(null); setList(null); };
  const escape = () => { void escapeRef.current(); };
  const unique = (base: string, taken: Set<string>) => { let i = 1; while (taken.has(`${base}_${i}`)) i++; return `${base}_${i}`; };
  async function taken() { const o = (await bridge?.objects()) ?? []; return new Set(o.map((x) => x.name)); }

  /** Duplicate / delete act on the whole selection: one version each, the copies become the new selection. */
  async function duplicate() {
    if (!sel) return;
    const names = sel.names ?? [sel.name], have = await taken(), copies: string[] = [];
    for (const n of names) { const d = unique(n.replace(/_\d+$/, ""), have); have.add(d); copies.push(d); }
    const lines = names.map((n, i) => `kit.clone('${n}', '${copies[i]}', { move: [1, 0, 0] });`);
    if (await run(groupBlock(lines), names.length > 1 ? `Duplicate ${names.length} objects` : `Duplicate ${sel.name}`)) await selectMany(copies);
  }
  async function remove() {
    if (!sel) return;
    const names = sel.names ?? [sel.name];
    if (await run(groupBlock(names.map((n) => `kit.remove('${n}');`)), names.length > 1 ? `Delete ${names.length} objects` : `Delete ${sel.name}`)) setSel(null);
  }
  async function add(kind: string) {
    if (!bridge) return;
    // Shapes stand on the surface at the centre of the view (lifted by half their 1 m size); lights/cameras use the view.
    const v = await bridge.viewState(); const [x, y, z] = v.hit ? [v.hit[0], v.hit[1] + 0.5, v.hit[2]] : v.target;
    const names = await taken(); let block = "", sel2: string | null = null;
    // Numbered names (CAM_view_1, LGT_point_2 …) from every name in the scene code: a reused name would REPLACE.
    const lightNames = new Set([...names, ...Array.from(optsRef.current.code.matchAll(/'((?:LGT|CAM)_[a-z0-9_]+)'/g), (m) => m[1])]);
    const prim: Record<string, string> = { cube: "kit.box(1, 1, 1)", sphere: "kit.sphere(0.5, 32)", cylinder: "kit.cylinder(0.5, 0.5, 1, 32)", cone: "kit.cone(0.5, 1, 32)", pyramid: "kit.cone(0.7, 1, 4).rot(0, 45, 0)" };
    if (kind === "library") { setList(null); setScenePanel(false); await searchLib(""); return; }
    if (prim[kind]) { sel2 = unique(`PRP_${kind}`, names); block = `kit.object('${sel2}').add(${prim[kind]}.at(${r2(x)}, ${r2(y)}, ${r2(z)}), 'concrete').commit();`; }
    else if (kind === "person") {   // stands on the surface in the view, facing the camera
      const [hx, hy, hz] = v.ground ?? v.hit ?? [v.target[0], 0, v.target[2]];   // people stand on the ground, not on shelves
      const face = Math.round(Math.atan2(v.pos[0] - hx, v.pos[2] - hz) * 180 / Math.PI);   // actors face +Z at rotY 0
      sel2 = unique("CHAR_person", names);
      block = `kit.actor('${sel2}', { pos: ${v3([hx, hy, hz])}, rotY: ${face}, action: 'idle' });`;
    }
    else if (kind === "point") block = `kit.light('${unique("LGT_point", lightNames)}', { type: 'point', pos: ${v3([x, y + 2, z])}, color: '#ffe8c0', intensity: 12, distance: 20 });`;
    else if (kind === "spot") block = `kit.light('${unique("LGT_spot", lightNames)}', { type: 'spot', pos: ${v3(v.pos)}, target: ${v3(v.target)}, color: '#ffffff', intensity: 40, distance: 60, angleDeg: 30 });`;
    else if (kind === "sun") block = `kit.light('${unique("LGT_sun", lightNames)}', { type: 'directional', pos: ${v3([x - 40, y + 50, z + 30])}, target: ${v3(v.target)}, color: '#fff1d6', intensity: 2.5 });`;
    else if (kind === "camera") block = `kit.camera('${unique("CAM_view", lightNames)}', { pos: ${v3(v.pos)}, lookAt: ${v3(v.target)}, fov: ${r2(v.fov)} });`;
    if (!block) return;
    if (await run(block, `Add ${ADD.find((a) => a.id === kind)?.label.toLowerCase()}`) && sel2) { await select(sel2); if (!mode) await setMode("translate"); }
  }
  async function toggleList() { setList(list ? null : ((await bridge?.objects()) ?? [])); }
  /** Programmatic edit (debug API / tests): same path as a gizmo drag. */
  async function editSelected(e: Partial<ObjEdit>) {
    if (!sel) throw new Error("nothing selected");
    if (sel.names && bridge) {   // a group: pos = where its centre goes, rot / scale relative to the group as selected
      const r = await bridge.editGroup({ pos: e.pos, rot: e.rot, scale: typeof e.scale === "number" ? e.scale : undefined });
      if (!r.edits.length || !r.group) throw new Error("the group edit did not apply");
      await optsRef.current.record(groupBlock(r.edits.map(editLine)), `Edit ${r.edits.length} objects`, { stats: null, cameras: [] }, groupKey(r.edits.map((x) => x.name)));
      setSel({ ...sel, ...r.group }); return;
    }
    const next = { name: sel.name, pos: e.pos ?? sel.pos, rot: e.rot ?? sel.rot, scale: e.scale ?? sel.scale };
    if (await run(editLine(next), `Edit ${sel.name}`, `edit:${sel.name}`)) setSel({ ...sel, ...next });
  }

  const ui = !opts.enabled ? null : (
    <>
      <div className="edit-bar" role="toolbar" aria-label="Edit the set">
        <div className="seg">
          {([[null, "Orbit"], ["translate", "Move"], ["rotate", "Rotate"], ["scale", "Scale"]] as const).map(([m, l]) =>
            <button key={l} aria-pressed={mode === m} onClick={() => setMode(m)} title={m ? `${l} the selected object (click it in the view; Shift-click adds more)` : "Look around"}>{l}</button>)}
        </div>
        <label className="pill">Add
          <select aria-label="Add to the set" value="" onChange={(e) => { const k = e.target.value; e.target.value = ""; if (k) add(k); }}>
            <option value="">Add…</option>{ADD.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select></label>
        <button className={`pill ${list ? "on" : ""}`} aria-pressed={!!list} onClick={toggleList}>Objects</button>
        <button className={`pill ${scenePanel ? "on" : ""}`} aria-pressed={scenePanel} onClick={() => setScenePanel(!scenePanel)}>Scene</button>
        {sel && <span className="sel-chip"><b>{sel.names ? `${sel.names.length} objects` : sel.name}</b>
          {/* Lights and cameras move and turn with the handles; only objects can be duplicated. */}
          {!/^(LGT|CAM)_/.test(sel.name) && <button className="pill" onClick={duplicate}>Duplicate</button>}
          <button className="pill" onClick={remove}>Delete</button>
          <button className="pill" aria-label="Clear selection" onClick={() => select(null)}>×</button></span>}
      </div>
      {sel?.light && <div className="light-panel" role="group" aria-label="Light">
        <label>Colour <span className="swatch" style={{ background: sel.light.color }}>
          <input type="color" aria-label="Light colour" value={sel.light.color} onChange={(e) => setLight({ color: e.target.value })} /></span></label>
        <label>Brightness <span>{Math.round((sel.light.intensity / lightMax(sel)) * 200)}%</span>
          <input type="range" aria-label="Light brightness" min={0} max={lightMax(sel)} step={lightMax(sel) / 100} value={sel.light.intensity}
            onChange={(e) => setLight({ intensity: Number(e.target.value) })} /></label>
        <button className={`pill ${sel.light.on ? "on" : ""}`} aria-pressed={sel.light.on} onClick={() => setLight({ on: !sel.light!.on })}>{sel.light.on ? "On" : "Off"}</button>
        <span className="note">{sel.light.type} light</span>
      </div>}
      {scenePanel && <div className="scene-panel" role="group" aria-label="Scene properties">
        <label>Exposure <span>{props.exposure.toFixed(2)}×</span>
          <input type="range" min={0.3} max={2.5} step={0.05} value={props.exposure} onChange={(e) => changeProps({ ...props, exposure: Number(e.target.value) })} /></label>
        <label>Light strength <span>{props.lights.toFixed(2)}×</span>
          <input type="range" min={0} max={3} step={0.05} value={props.lights} onChange={(e) => changeProps({ ...props, lights: Number(e.target.value) })} /></label>
        <label className="row">Background
          <select value={props.background ? "colour" : "auto"} onChange={(e) => changeProps({ ...props, background: e.target.value === "auto" ? null : props.background ?? "#1b2433" })}>
            <option value="auto">Sky / set default</option><option value="colour">Flat colour</option></select>
          {props.background && <input type="color" aria-label="Background colour" value={props.background} onChange={(e) => changeProps({ ...props, background: e.target.value })} />}</label>
        <p className="note">Changes the lit look and the rendered shot. The clay pass stays neutral.</p>
        <button className="pill" onClick={() => changeProps(DEFAULT_PROPS)}>Reset</button>
      </div>}
      {lib && <div className="lib-panel" role="dialog" aria-label="Model library">
        <div className="lib-head">
          <input type="search" placeholder="Search models, e.g. barrel, lantern, car" defaultValue={lib.q} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") searchLib((e.target as HTMLInputElement).value); }} />
          <button className={`pill ${packsView ? "on" : ""}`} onClick={() => (packsView ? setPacksView(null) : openPacks())}>Packs</button>
          <label className="pill" title="Your own model or character: .glb, or .fbx as downloaded from Mixamo. A motion file (without skin) goes to the selected person.">Import GLB / FBX<input type="file" accept=".glb,.fbx,model/gltf-binary" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importModel(f); }} /></label>
          <button className="pill" aria-label="Close the library" onClick={() => setLib(null)}>×</button>
        </div>
        {importing && <p className="note">{importing}</p>}
        {packsView && <PacksPanel v={packsView} act={packAction} api={packsApi} />}
        {!packsView && !lib.on && <p className="note">No model pack is switched on. Open Packs to add one, or import your own GLB.</p>}
        {!packsView && <div className="lib-grid">
          {lib.uploads.map((u) => <button key={u.id} onClick={() => (u.category === "motion" ? giveMotion(u) : placeModel(u))}
            title={u.category === "motion" ? `${u.name}: a motion — select a person, then click it` : `${u.name} (imported)`}>
            <span className="ph">{u.category === "motion" ? "MOTION" : u.category === "character" ? "PERSON" : "GLB"}</span><b>{u.name}</b></button>)}
          {lib.items.map((it) => <button key={it.id} onClick={() => placeModel(it)} title={`${it.name}${it.height ? `, about ${it.height} m` : ""}${it.mb ? `, ${it.mb} MB` : ""}${it.pack ? ` (${it.pack})` : ""}`}>
            {it.preview ? <img src={it.preview} alt="" loading="lazy" /> : <span className="ph">GLB</span>}<b>{it.name}</b></button>)}
          {lib.busy && <p className="note">Searching…</p>}
          {!lib.busy && lib.on && !lib.items.length && <p className="note">Nothing found. Try another word.</p>}
        </div>}
        {lib.credit && <p className="note credit">{lib.credit}</p>}
      </div>}
      {list && <div className="obj-list" role="listbox" aria-multiselectable aria-label="Objects in the set">
        {list.map((o) => <button key={o.name} role="option" aria-selected={sel?.names ? sel.names.includes(o.name) : sel?.name === o.name}
          onClick={(e) => select(o.name, e.shiftKey || e.ctrlKey || e.metaKey)}>
          {o.category === "LGT" ? "Light: " : o.category === "CAM" ? "Camera: " : ""}{o.name}</button>)}
      </div>}
    </>
  );
  return { ui, mode, sel, props, lib: lib && { q: lib.q, n: lib.items.length, first: lib.items[0]?.name ?? null, on: lib.on },
    acts: { setMode, select, selectMany, duplicate, remove, add, toggleList, editSelected, changeProps, searchLib, openPacks: async () => { await searchLib(""); await openPacks(); },
    placeResult: async (i = 0) => { const it = lib?.items[i]; if (!it) throw new Error("no library result"); await placeModel(it); },
    scenePanel: (on: boolean) => setScenePanel(on), setLight: (p: { color?: string; intensity?: number; on?: boolean }) => setLight(p) } };
}

/** The Packs view inside the library panel: what is installed (licence, credit, on/off, builder use) and how to add more. */
function PacksPanel({ v, act, api }: { v: { packs: PackRow[]; known: KnownPack[]; busy: string | null; err: string | null };
  act: (label: string, f: () => Promise<unknown>) => Promise<void>; api: (m: string, b?: unknown, q?: string) => Promise<any> }) {
  const [form, setForm] = useState<{ kind: "link" | "folder"; src: string; name: string; licence: string; credit: string }>({ kind: "link", src: "", name: "", licence: "", credit: "" });
  const installed = new Set(v.packs.map((p) => p.id));
  const add = () => act("Adding the pack", () => api("POST", form.kind === "link"
    ? { kind: "link", url: form.src, name: form.name, licence: form.licence, credit: form.credit }
    : { kind: "folder", path: form.src, name: form.name, licence: form.licence, credit: form.credit }));
  return (
    <div className="packs">
      {v.packs.map((p) => <div key={p.id} className="pack-row">
        <div><b>{p.name}</b><small>{p.count} models, {p.licence}, credit: {p.credit}</small></div>
        <label title="Show these models in the library"><input type="checkbox" checked={p.enabled} onChange={(e) => act("Saving", () => api("PATCH", { id: p.id, enabled: e.target.checked }))} /> On</label>
        <label title="Let the builder place these models by itself"><input type="checkbox" checked={p.builder} onChange={(e) => act("Saving", () => api("PATCH", { id: p.id, builder: e.target.checked }))} /> Builder</label>
        {p.kind !== "samples" && <button className="pill" onClick={() => act("Removing", () => api("DELETE", undefined, `?id=${encodeURIComponent(p.id)}`))}>Remove</button>}
      </div>)}
      <h4>Well-known packs</h4>
      {v.known.map((k) => <div key={k.id} className="pack-row">
        <div><b>{k.name}</b><small>{k.licence}, {k.size}; {k.how}</small></div>
        {installed.has(k.id) ? <small>Added</small> : k.id === "polyhaven"
          ? <button className="pill" onClick={() => act(`Adding ${k.name}`, () => api("POST", { kind: "known", id: k.id }))}>Add</button>
          : k.url && <a className="pill" href={k.url} target="_blank" rel="noreferrer">Get it</a>}
      </div>)}
      <h4>Add your own pack</h4>
      <div className="pack-form">
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "link" | "folder" })}>
          <option value="link">From a link (.glb or .zip)</option><option value="folder">From a folder on this computer</option></select>
        <input placeholder={form.kind === "link" ? "https://…/models.zip" : "/path/to/models"} value={form.src} onChange={(e) => setForm({ ...form, src: e.target.value })} />
        <input placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Licence, e.g. CC0 or CC BY 4.0" value={form.licence} onChange={(e) => setForm({ ...form, licence: e.target.value })} />
        <input placeholder="Credit, e.g. the author or shop" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
        <button className="pill" disabled={!form.src || !form.licence || !form.credit || !!v.busy} onClick={add}>Add pack</button>
      </div>
      {v.busy && <p className="note">{v.busy}…</p>}
      {v.err && <p className="note error">{v.err}</p>}
    </div>
  );
}
