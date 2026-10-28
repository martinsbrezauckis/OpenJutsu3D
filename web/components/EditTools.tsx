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
  { id: "cube", label: "Cube" }, { id: "sphere", label: "Sphere" }, { id: "cylinder", label: "Cylinder" }, { id: "cone", label: "Cone" },
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
      uploads: (r?.uploads ?? []).map((u: { id: string; name: string; height: number | null }) => ({ id: u.id, name: u.name, category: "imported", height: u.height, mb: null, preview: null })) });
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
  async function placeModel(it: LibHit) {
    if (!bridge) return;
    const v = await bridge.viewState(); const p = v.hit ?? v.target; const names = await taken();
    const name = unique(`PRP_${slug(it.name)}`, names);
    const h = it.height ? `, height: ${r2(it.height)}` : "";   // no height = the model's own real-world size
    if (await run(`kit.model('${name}', '${it.id}', { pos: ${v3(p)}${h}, rotY: 0 });`, `Add ${it.name}`)) {
      setLib(null);   // show the placed model (the panel covers the view); Add › library opens it again
      await select(name); if (!mode) await setMode("translate");
    }
  }
  async function importGlb(f: File) {
    const form = new FormData(); form.set("file", f); form.set("name", f.name.replace(/\.glb$/i, ""));
    const r = await fetch("/api/assets", { method: "POST", headers: { "X-O3J": "1" }, body: form }).then((x) => x.json()).catch(() => null);
    if (!r?.id) { optsRef.current.onError(r?.error ?? "The import failed."); return; }
    await placeModel({ id: r.id, name: f.name.replace(/\.glb$/i, ""), category: "imported", height: null, mb: null, preview: null });
    await searchLib(lib?.q ?? "");
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
    // The gizmo already moved the object live; record the final state (one version per object while you keep dragging it).
    bridge.onEdited = (e) => { setSel((s) => (s && s.name === e.name ? { ...s, ...e } : s));
      optsRef.current.record(editLine(e), `Edit ${e.name}`, { stats: null, cameras: [] }, `edit:${e.name}`); };
    return () => { bridge.onPicked = undefined; bridge.onEdited = undefined; };
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
  const select = async (name: string | null) => setSel((await bridge?.select(name)) ?? null);
  const unique = (base: string, taken: Set<string>) => { let i = 1; while (taken.has(`${base}_${i}`)) i++; return `${base}_${i}`; };
  async function taken() { const o = (await bridge?.objects()) ?? []; return new Set(o.map((x) => x.name)); }

  async function duplicate() {
    if (!sel) return;
    const dst = unique(sel.name.replace(/_\d+$/, ""), await taken());
    if (await run(`kit.clone('${sel.name}', '${dst}', { move: [1, 0, 0] });`, `Duplicate ${sel.name}`)) await select(dst);
  }
  async function remove() {
    if (!sel) return;
    const name = sel.name;
    if (await run(`kit.remove('${name}');`, `Delete ${name}`)) setSel(null);
  }
  async function add(kind: string) {
    if (!bridge) return;
    // Shapes stand on the surface at the centre of the view (lifted by half their 1 m size); lights/cameras use the view.
    const v = await bridge.viewState(); const [x, y, z] = v.hit ? [v.hit[0], v.hit[1] + 0.5, v.hit[2]] : v.target;
    const names = await taken(); let block = "", sel2: string | null = null;
    // Numbered names (CAM_view_1, LGT_point_2 …) from every name in the scene code: a reused name would REPLACE.
    const lightNames = new Set([...names, ...Array.from(optsRef.current.code.matchAll(/'((?:LGT|CAM)_[a-z0-9_]+)'/g), (m) => m[1])]);
    const prim: Record<string, string> = { cube: "kit.box(1, 1, 1)", sphere: "kit.sphere(0.5, 32)", cylinder: "kit.cylinder(0.5, 0.5, 1, 32)", cone: "kit.cone(0.5, 1, 32)" };
    if (kind === "library") { setList(null); setScenePanel(false); await searchLib(""); return; }
    if (prim[kind]) { sel2 = unique(`PRP_${kind}`, names); block = `kit.object('${sel2}').add(${prim[kind]}.at(${r2(x)}, ${r2(y)}, ${r2(z)}), 'concrete').commit();`; }
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
    const next = { name: sel.name, pos: e.pos ?? sel.pos, rot: e.rot ?? sel.rot, scale: e.scale ?? sel.scale };
    if (await run(editLine(next), `Edit ${sel.name}`, `edit:${sel.name}`)) setSel({ ...sel, ...next });
  }

  const ui = !opts.enabled ? null : (
    <>
      <div className="edit-bar" role="toolbar" aria-label="Edit the set">
        <div className="seg">
          {([[null, "Orbit"], ["translate", "Move"], ["rotate", "Rotate"], ["scale", "Scale"]] as const).map(([m, l]) =>
            <button key={l} aria-pressed={mode === m} onClick={() => setMode(m)} title={m ? `${l} the selected object (click it in the view)` : "Look around"}>{l}</button>)}
        </div>
        <label className="pill">Add
          <select aria-label="Add to the set" value="" onChange={(e) => { const k = e.target.value; e.target.value = ""; if (k) add(k); }}>
            <option value="">Add…</option>{ADD.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select></label>
        <button className={`pill ${list ? "on" : ""}`} aria-pressed={!!list} onClick={toggleList}>Objects</button>
        <button className={`pill ${scenePanel ? "on" : ""}`} aria-pressed={scenePanel} onClick={() => setScenePanel(!scenePanel)}>Scene</button>
        {sel && <span className="sel-chip"><b>{sel.name}</b>
          <button className="pill" onClick={duplicate}>Duplicate</button><button className="pill" onClick={remove}>Delete</button>
          <button className="pill" aria-label="Clear selection" onClick={() => select(null)}>×</button></span>}
      </div>
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
          <label className="pill">Import GLB<input type="file" accept=".glb,model/gltf-binary" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importGlb(f); }} /></label>
          <button className="pill" aria-label="Close the library" onClick={() => setLib(null)}>×</button>
        </div>
        {packsView && <PacksPanel v={packsView} act={packAction} api={packsApi} />}
        {!packsView && !lib.on && <p className="note">No model pack is switched on. Open Packs to add one, or import your own GLB.</p>}
        {!packsView && <div className="lib-grid">
          {lib.uploads.map((u) => <button key={u.id} onClick={() => placeModel(u)} title={`${u.name} (imported)`}><span className="ph">GLB</span><b>{u.name}</b></button>)}
          {lib.items.map((it) => <button key={it.id} onClick={() => placeModel(it)} title={`${it.name}${it.height ? `, about ${it.height} m` : ""}${it.mb ? `, ${it.mb} MB` : ""}${it.pack ? ` (${it.pack})` : ""}`}>
            {it.preview ? <img src={it.preview} alt="" loading="lazy" /> : <span className="ph">GLB</span>}<b>{it.name}</b></button>)}
          {lib.busy && <p className="note">Searching…</p>}
          {!lib.busy && lib.on && !lib.items.length && <p className="note">Nothing found. Try another word.</p>}
        </div>}
        {lib.credit && <p className="note credit">{lib.credit}</p>}
      </div>}
      {list && <div className="obj-list" role="listbox" aria-label="Objects in the set">
        {list.map((o) => <button key={o.name} role="option" aria-selected={sel?.name === o.name} onClick={() => select(o.name)}>{o.name}</button>)}
      </div>}
    </>
  );
  return { ui, mode, sel, props, lib: lib && { q: lib.q, n: lib.items.length, first: lib.items[0]?.name ?? null, on: lib.on },
    acts: { setMode, select, duplicate, remove, add, toggleList, editSelected, changeProps, searchLib, openPacks: async () => { await searchLib(""); await openPacks(); },
    placeResult: async (i = 0) => { const it = lib?.items[i]; if (!it) throw new Error("no library result"); await placeModel(it); },
    scenePanel: (on: boolean) => setScenePanel(on) } };
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
