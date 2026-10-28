/**
 * viewer-core.js — the Scene Kit renderer shared by the bench viewer (viewer.html, headless Playwright) and the app
 * (web/, interactive). One renderer + post chain; load(code) (re)builds the set from builder code, so the app can feed
 * a growing scene batch by batch (Comfy Router does not stream, 10-28) and re-render the whole set each time.
 *
 * Modes: lit  = material library + CC0 textures, ACES, shadows, bloom, fog, SSR on water, physical sky outdoors.
 *        clay = one neutral grey material + headlight: the playblast format for LTX Layout-To-Render.
 * Every behaviour below was tuned on 10-18 against real renders (comments keep the reason next to each rule).
 *
 * API: createViewer({ container?, width, height, base }) → viewer
 *   viewer.load(code) → result {ok, error, skipped, stats, meta, cameras, order, materials, sky, ms}
 *   viewer.setMode('lit'|'clay'), viewer.shot(camName|'overview'), viewer.frame(cam, move, i, n, amount, fps) → state
 *   viewer.visible(cam, move, i, n) → [{name, category, labels, cover}], viewer.exportGLB('lit'|'clay') → base64,
 *   viewer.setSize(w, h), viewer.texturesSettled() → Promise, viewer.MOVES, viewer.canvas, viewer.renderer
 *   viewer.interactive(on) → orbit controls + render loop for the app's live viewport
 * Depends: three@0.186.1 (import map), kit.js, camera-moves.js, materials.json, assets/textures/manifest.json.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MAX_SKIPS = 6, HEADER = 4;  // stack line of code line 0: 'function anonymous(kit' + ') {' + '"use strict"' precede it

export async function createViewer({ container = document.body, width = 1280, height = 720, base = '', exposure = 1.0, fogScale = 1 } = {}) {
  const url = (p) => new URL(p, new URL(base || '.', location.href)).href;
  // Cache-busted so edits to kit.js always apply on reload (python http.server allows heuristic caching).
  const { SceneKit } = await import(url(`kit.js?t=${Date.now()}`));
  const { cameraAt, MOVES, pathStates } = await import(url(`camera-moves.js?t=${Date.now()}`));
  RectAreaLightUniformsLib.init();

  let W = width, H = height;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0f12);
  const uiLayer = new THREE.Group(); uiLayer.name = 'UI'; scene.add(uiLayer);
  // Ambient lift so unlit corners aren't pure black in lit mode; stronger studio fill in clay mode.
  const ambient = new THREE.HemisphereLight(0xbfd4ff, 0x2a2420, 0.25); ambient.name = 'viewport_ambient'; scene.add(ambient);
  const headlight = new THREE.DirectionalLight(0xffffff, 1.2); headlight.name = 'viewport_headlight'; scene.add(headlight, headlight.target);

  const fetchJSON = async (u) => { const r = await fetch(url(u), { credentials: 'omit' }); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
  const [library, manifest, fontJSON] = await Promise.all([fetchJSON('materials.json'), fetchJSON('assets/textures/manifest.json').catch(() => ({})),
    fetchJSON('assets/fonts/droid_sans_bold.typeface.json').catch(() => null)]);
  const font = fontJSON ? new FontLoader().parse(fontJSON) : null;   // kit.text() (signs); Apache-2.0, assets/fonts/NOTICE.txt
  const manager = new THREE.LoadingManager();
  let texturesPending = 0, settleWaiters = [];
  manager.onStart = () => { texturesPending++; };
  manager.onLoad = () => { texturesPending = 0; settleWaiters.splice(0).forEach(f => f()); };
  manager.onError = () => {};
  const texLoader = new THREE.TextureLoader(manager);
  const texBase = url('assets/textures/');

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, null); composer.addPass(renderPass);
  // Water/wet surfaces (materials flagged `surface` in materials.json) get screen-space reflections in lit mode, so
  // puddles mirror the neon/lamps in OUR render — the look-frame models then see real wet reflections instead of
  // flat dark discs ("pancakes"). SSRPass renders the scene itself; RenderPass is used in clay mode.
  const ssr = new SSRPass({ renderer, scene, camera: new THREE.PerspectiveCamera(), width: W, height: H, selects: [] });
  ssr.thickness = 0.03; ssr.maxDistance = 30; ssr.opacity = 0.9; ssr.infiniteThick = false; ssr.distanceAttenuation = true;
  ssr.fresnel = true;
  // SSRPass draws the whole beauty frame into a target with a 16-bit depth texture (three r186): with water in the
  // set, surfaces ~0.1 m apart z-fought at city distances (roof boards over plaster gables, batched city 10-28).
  ssr.beautyRenderTarget.depthTexture.type = THREE.UnsignedIntType;
  composer.addPass(ssr);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.45, 0.92); composer.addPass(bloom);
  // Soft studio environment for reflections only (metals are black without something to reflect).
  // Kept low so it never overrides the scene's own lighting plan.
  const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  composer.addPass(new OutputPass());

  const shotCam = new THREE.PerspectiveCamera(40, W / H, 0.05, 2000);
  const overview = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);
  const ray = new THREE.Raycaster();

  // Per-set state, rebuilt by load().
  let kit = null, log = [], box = new THREE.Box3(), setDiag = 10, fog = new THREE.FogExp2(0x15171a, 0.09);
  let surfaces = [], solids = [], skyMesh = null, skyEnv = null, skyInfo = { exterior: false, tod: 'day', vacuum: false };
  let mode = 'lit', result = null;
  const plans = new Map();
  // Library / imported models (kit.model): parsed once, kept across set reloads; the app hands over the GLB bytes.
  const models = new Map();
  async function addModel(id, glb, height) {
    if (models.has(id)) return;
    const g = await new GLTFLoader().parseAsync(glb, '');
    models.set(id, { scene: g.scene, height: Number(height) || undefined });
  }
  const newKit = () => new SceneKit(scene, { onCommit: (o, info) => log.push(info.name), library, font, models,
    textures: { base: texBase, manifest, loader: texLoader } });

  function clearSet() {
    if (kit) scene.remove(kit.root);
    if (skyMesh) { scene.remove(skyMesh); skyMesh = null; }
    skyEnv = null; plans.clear(); log = [];
  }

  /**
   * Build the set from builder code (replacing any previous set). Fault-tolerant (10-18: one bad extrude() call in
   * GLM's city killed all 57 blocks): on an error, the OUTERMOST frame inside the scene code gives the failing
   * top-level line; its //@@ block is dropped and the set rebuilt from a fresh kit — up to MAX_SKIPS blocks. Blocks
   * share one scope (helpers declared early are used later), so they cannot run in separate try/catch scopes.
   * NOTE: executes builder code in page scope — fine for a local app/bench; a hosted app needs a sandboxed worker.
   */
  function load(code) {
    const t0 = performance.now();
    select(null); clearSet(); kit = newKit();
    const skipped = [];
    let lines = String(code || '').split('\n');
    // [start, end) line range of the block holding 0-based line `ln`; blocks start at a //@@ marker line.
    const blockRange = (ln) => {
      const marks = []; lines.forEach((l, i) => { if (l.startsWith('//@@')) marks.push(i); });
      let start = 0, end = lines.length;
      for (const mk of marks) { if (mk <= ln) start = mk; else { end = mk; break; } }
      return [start, end];
    };
    try {
      for (;;) {
        try { new Function('kit', '"use strict";\n' + lines.join('\n'))(kit); break; }
        catch (e) {
          const frames = [...String(e && e.stack || '').matchAll(/<anonymous>:(\d+):\d+/g)];
          const m = frames.length ? frames[frames.length - 1] : null;
          if (!m || skipped.length >= MAX_SKIPS) throw e;
          const ln = Number(m[1]) - HEADER;
          if (ln < 0 || ln >= lines.length) throw e;
          const [a, b] = blockRange(ln);
          skipped.push({ line: ln + 1, dropped_lines: b - a, code: lines[ln].trim().slice(0, 120), error: String(e && e.message || e).slice(0, 200) });
          lines = lines.slice(0, a).concat(lines.slice(b));
          scene.remove(kit.root); log.length = 0; kit = newKit();
        }
      }
      result = { ok: true, skipped };
    } catch (e) {
      result = { ok: false, error: String(e && e.stack || e), skipped };
    }
    Object.assign(result, { stats: kit.stats, meta: kit.meta, cameras: kit.cameras.map(c => c.name), order: [...log],
      ms: Math.round(performance.now() - t0), materials: kit.materialReport() });

    // Atmosphere: light exponential fog in lit mode, scaled to the set size, so depth reads like a real space.
    box = new THREE.Box3().setFromObject(kit.root);
    setDiag = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();  // set diagonal (m)
    fog = new THREE.FogExp2(0x15171a, fogScale * 0.9 / setDiag);
    // Sun shadows must cover the set: kit gives directional lights a fixed ±20 m / 80 m shadow box, so a sun placed
    // 375 m out over a 450 m city cast no shadows at all (10-28). Refit those lights around the set, same direction.
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3()), radius = setDiag / 2;
      kit.root.traverse(l => {
        if (!l.isDirectionalLight || !l.castShadow) return;
        const dir = l.position.clone().sub(l.target.position).normalize();
        if (radius <= 20 && l.position.distanceTo(center) <= 60) return;   // default box already covers it
        l.target.position.copy(center); l.position.copy(center).addScaledVector(dir, radius * 2);
        const s = l.shadow.camera, size = radius > 60 ? 4096 : 2048;
        s.left = s.bottom = -radius; s.right = s.top = radius; s.near = 0.5; s.far = radius * 4; s.updateProjectionMatrix();
        l.shadow.mapSize.set(size, size); l.shadow.bias = -0.0001; l.shadow.normalBias = 2 * radius / size;
      });
    }
    surfaces = []; kit.root.traverse(o => { if (o.isMesh && o.userData.surface) surfaces.push(o); });
    ssr.selects = surfaces;
    // Only architecture (ENV_*) blocks the camera: passing near a thin prop is fine, crossing a wall is not.
    solids = []; kit.root.traverse(o => { if (o.isMesh && o.parent?.userData?.category === 'ENV') solids.push(o); });
    skyInfo = detectSky();
    buildSky();
    result.sky = skyInfo;
    { const c = box.getCenter(new THREE.Vector3());
      if (skyInfo.exterior || box.isEmpty()) {
        overview.position.set(c.x + setDiag * 0.55, c.y + setDiag * 0.45, c.z + setDiag * 0.55); overview.lookAt(c);
      } else {
        // Interiors: an outside overview shows only a closed box (app build view, 10-28) — stand in a high corner of
        // the room instead, looking across it to the far floor corner.
        // Candidates: the 4 high corners + the centre; keep the one whose view is most open (a ray grid in the view
        // direction measures the nearest hits — an arch rib or pillar right at the lens scores low).
        const s = box.getSize(new THREE.Vector3()), meshes = []; kit.root.traverse(o => { if (o.isMesh) meshes.push(o); });
        const floorY = box.min.y + s.y * 0.15, eyeY = box.min.y + s.y * 0.7, rc = new THREE.Raycaster();
        let best = null;
        for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 0.0001]]) {
          const pos = new THREE.Vector3(c.x + sx * s.x * 0.36, eyeY, c.z + sz * s.z * 0.36);
          const look = sx === 0 ? new THREE.Vector3(c.x, floorY, c.z - s.z * 0.3) : new THREE.Vector3(c.x - sx * s.x * 0.2, floorY, c.z - sz * s.z * 0.2);
          overview.position.copy(pos); overview.lookAt(look); overview.updateMatrixWorld();
          let score = 0;
          for (const [u, w] of [[0, 0], [-0.5, 0], [0.5, 0], [0, -0.4], [0, 0.4], [-0.4, -0.3], [0.4, 0.3]]) {
            rc.setFromCamera(new THREE.Vector2(u, w), overview);
            const h = rc.intersectObjects(meshes, false)[0];
            score += Math.min(h ? h.distance : setDiag, setDiag * 0.5);   // reward open views, cap far hits
          }
          if (!best || score > best.score) best = { score, pos, look };
        }
        overview.position.copy(best.pos); overview.lookAt(best.look);
      } }
    setMode(mode);
    return result;
  }

  // ---- Sky for exteriors (2026-10-18: outdoor sets showed a black void) ----
  // Exterior test: from the first camera (or the overview), cast 48 rays into the upper hemisphere; if most escape the
  // set, it is outdoors. Time of day from describe(). The sky also becomes the reflection environment outdoors.
  function detectSky() {
    const cam0 = kit.cameras[0] || (() => { const c = new THREE.PerspectiveCamera(); c.position.copy(box.getCenter(new THREE.Vector3())).add(new THREE.Vector3(0, 2, 0)); return c; })();
    const meshes = []; kit.root.traverse(o => { if (o.isMesh) meshes.push(o); });
    const rc = new THREE.Raycaster(); let escaped = 0; const N = 48;
    for (let i = 0; i < N; i++) {
      const az = (i / N) * Math.PI * 2 * 3.7, el = 0.25 + 0.65 * ((i * 0.618) % 1);   // spread over the upper hemisphere
      rc.set(cam0.position, new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)));
      rc.far = 2000; if (!rc.intersectObjects(meshes, false).length) escaped++;
    }
    // Time of day from the LIGHTING description first (other fields describe materials/palette: Gemini's
    // "dark weathered oak" once turned a golden-hour city into night, 10-18); whole meta only as a fallback.
    // A bare "dark" no longer means night. Golden/sunset is checked before night ("sunset, lanterns, moonrise").
    const meta = kit.meta || {};
    const todOf = (s) => /sunset|golden|dusk|evening|sundown/.test(s) ? 'sunset' : /dawn|sunrise|morning/.test(s) ? 'dawn'
              : /night|neon|moonlit|moonlight|midnight|starlit|starry/.test(s) ? 'night' : /noon|midday|daylight|sunny|overcast|day/.test(s) ? 'day' : null;
    const tod = todOf(String(meta.lighting || meta.time || '').toLowerCase())
              || todOf(Object.values(meta).join(' ').toLowerCase()) || 'day';
    // Airless worlds (moon, asteroid, open space): black sky, no atmospheric haze, hard sun — the day-sky + fog
    // path washed the 10-18 moon colony out to white. "moonlit"/"moonlight" do not match (\bmoon\b).
    const vacuum = /\b(moon|lunar|vacuum|airless|asteroid|outer space|deep space|in orbit)\b/.test(Object.values(meta).join(' ').toLowerCase());
    return { exterior: escaped / N > 0.4, escapedFraction: +(escaped / N).toFixed(2), tod, vacuum };
  }
  function buildSky() {
    if (!(skyInfo.exterior && skyInfo.tod !== 'night' && !skyInfo.vacuum)) return;
    skyMesh = new Sky(); skyMesh.name = 'viewport_sky';
    skyMesh.scale.setScalar(800);   // inside every camera's far plane (1000–2000 m)
    const u = skyMesh.material.uniforms;
    u.turbidity.value = skyInfo.tod === 'day' ? 4 : 8; u.rayleigh.value = skyInfo.tod === 'day' ? 1.5 : 2.5;
    u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    // Sun azimuth: from the scene's first directional light if any, else south-west.
    let az = 225; kit.root.traverse(o => { if (o.isDirectionalLight && az === 225) az = Math.atan2(o.position.x, o.position.z) * 180 / Math.PI; });
    const el = skyInfo.tod === 'day' ? 40 : 4;
    u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(skyInfo.tod === 'dawn' ? az + 180 : az));
    const skyScene = new THREE.Scene(); skyScene.add(skyMesh.clone());
    skyEnv = new THREE.PMREMGenerator(renderer).fromScene(skyScene).texture;
    scene.add(skyMesh);
    // Outdoor haze matches the horizon instead of the dark interior fog.
    fog.color.set(skyInfo.tod === 'day' ? 0xb9c6d3 : 0xd9a77a);
  }

  function setMode(m) {
    mode = m; if (!kit) return;
    kit.setMode(m);
    const clay = m === 'clay';
    scene.fog = clay || skyInfo.vacuum ? null : fog; bloom.enabled = !clay;
    // SSR replaces the plain render pass in lit mode (only when the set has water surfaces).
    ssr.enabled = !clay && surfaces.length > 0; renderPass.enabled = !ssr.enabled;
    scene.environment = clay ? null : (skyEnv || envMap); scene.environmentIntensity = skyEnv ? 0.45 : 0.35;   // 0.8 washed out the desert temple
    const props = kit.props || {}, bg = !clay && props.background ? props.background : null;   // kit.settings()
    if (skyMesh) skyMesh.visible = !clay && !bg;
    // Clay = neutral grey "viewport" look (LTX Layout-To-Render input): scene lights off, white ambient +
    // a headlight that follows the shot camera, so shapes read by form only — no mood colour, no glow.
    ambient.color.set(clay ? 0xffffff : 0xbfd4ff); ambient.groundColor.set(clay ? 0x808080 : 0x2a2420);
    ambient.intensity = clay ? 1.6 : 0.25; headlight.visible = clay;
    scene.background.set(bg ?? (clay ? 0x5a5d62 : skyInfo.vacuum ? 0x000000 : (skyInfo.exterior && skyInfo.tod === 'night' ? 0x101a2c : 0x0d0f12)));
    if (fog) fog.color.set(bg ?? 0x15171a);
    renderer.toneMappingExposure = exposure * (clay ? 1 : props.exposure ?? 1);
    const lightScale = clay ? 0 : props.lights ?? 1;
    kit.root.traverse(o => { if (o.isLight) { o.userData.baseIntensity ??= o.intensity; o.intensity = o.userData.baseIntensity * lightScale; } });
  }

  function aimHeadlight(cam) {
    cam.updateMatrixWorld();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    headlight.position.copy(cam.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(-0.5, 1, 0));
    headlight.target.position.copy(headlight.position).add(fwd.multiplyScalar(10));
  }
  // Editing helpers (gizmo, selection box) show only in the live orbit view — never in shot frames or stills.
  function renderWith(cam) { aimHeadlight(cam); uiLayer.visible = cam === overview && looping; renderPass.camera = cam; ssr.camera = cam; composer.render(); }

  function shot(camName) {
    const cam = camName === 'overview' ? overview : kit.cameras.find(c => c.name === camName) || kit.cameras[0] || overview;
    cam.aspect = W / H; cam.updateProjectionMatrix();
    renderWith(cam); return cam.name || 'overview';
  }

  /** Fraction (0..1] of the requested look-at→camera distance that is free of walls (spring-arm collision). */
  function freeFraction(st) {
    const target = new THREE.Vector3(...st.lookAt), dir = new THREE.Vector3(...st.pos).sub(target), dist = dir.length();
    if (dist < 1e-3) return 1;
    ray.set(target, dir.normalize()); ray.near = 0.2; ray.far = dist;
    const hit = ray.intersectObjects(solids, false)[0];
    return hit ? Math.max(0.3, hit.distance - 0.35) / dist : 1;
  }
  /**
   * Plan a whole shot: raw move states → wall fractions → smoothed (moving min, then moving average) so the camera
   * eases in front of walls instead of popping. Cached per (cam, move, n, amount, fps). fps matters only for recipe
   * smoothing (pathStates' window is in seconds): a 48 fps playblast equals the 24 fps one on every even frame.
   */
  function planShot(camName, move, n, amount, fps = 24) {
    const key = `${camName}|${move}|${n}|${amount}|${fps}`;
    if (plans.has(key)) return plans.get(key);
    const c0 = kit.cameras.find(c => c.name === camName) || kit.cameras[0];
    const start = { pos: c0.position.toArray(), lookAt: c0.userData.lookAt, fov: c0.fov };
    // A recipe ("dolly-in:4+arc-left:6:2.5") chains moves continuously; a single move keeps the old behaviour.
    const raw = move.includes(':') || move.includes('+')
      ? pathStates(move, start, n, fps)
      : Array.from({ length: n }, (_, i) => cameraAt(move, start, n > 1 ? i / (n - 1) : 0, { amount }));
    // Wall avoidance is an INTERIOR concept: outdoors the look-at target is often inside a building (a cathedral), so a
    // target→camera ray would drag the camera into it (city flyover, 10-18). Exteriors fly free, ≥ 1.5 m above floor.
    const f = skyInfo.exterior ? raw.map(() => 1) : raw.map(freeFraction), win = Math.max(1, Math.round(n / 12));
    if (skyInfo.exterior) for (const st of raw) st.pos[1] = Math.max(st.pos[1], box.min.y + 1.5);
    const mins = f.map((_, i) => Math.min(...f.slice(Math.max(0, i - win), i + win + 1)));
    const smooth = mins.map((_, i) => { const s = mins.slice(Math.max(0, i - win), i + win + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
    const plan = raw.map((st, i) => {
      const r = Math.min(1, smooth[i]);
      if (r < 0.999) st.pos = st.lookAt.map((t, k) => t + (st.pos[k] - t) * r);
      return { ...st, collided: r < 0.999, free: Number(r.toFixed(3)) };
    });
    plans.set(key, plan);
    return plan;
  }
  /** Render frame i of n for `move` from scene camera `camName`; returns the exact camera state used. */
  function frame(camName, move, i, n, amount = 1, fps = 24) {
    const st = planShot(camName, move, n, amount, fps)[i];
    shotCam.fov = st.fov; shotCam.position.set(...st.pos); shotCam.up.set(0, 1, 0); shotCam.lookAt(...st.lookAt);
    if (st.roll) shotCam.rotateZ(st.roll);
    shotCam.updateProjectionMatrix();
    renderWith(shotCam);
    return st;
  }
  /**
   * Objects visible in frame i of a shot, with approximate screen coverage — feeds the render-prompt compiler
   * (describe what the camera SEES, biggest first). Coverage = fraction of a coarse 96×54 ray grid hitting it first.
   */
  function visible(camName, move = 'static-shot', i = 0, n = 1) {
    frame(camName, move, i, n);
    const all = []; kit.root.traverse(o => { if (o.isMesh) all.push(o); });
    const hits = new Map(), GX = 96, GY = 54, rc = new THREE.Raycaster();
    for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
      rc.setFromCamera(new THREE.Vector2((x + 0.5) / GX * 2 - 1, 1 - (y + 0.5) / GY * 2), shotCam);
      const h = rc.intersectObjects(all, false)[0];
      if (!h) continue;
      const obj = h.object.parent;   // meshes are per-material children of the committed object group
      const e = hits.get(obj.name) || { name: obj.name, category: obj.userData.category, labels: new Set(), n: 0 };
      e.n++; e.labels.add(h.object.userData.label); hits.set(obj.name, e);
    }
    return [...hits.values()].map(e => ({ name: e.name, category: e.category, labels: [...e.labels], cover: +(e.n / (GX * GY)).toFixed(4) }))
      .sort((a, b) => b.cover - a.cover);
  }
  /**
   * The built set as GLB (base64). 'lit' (default) = the real materials with their textures embedded as JPEG
   * (≤ 2048 px), whatever mode the viewport is in; 'clay' = geometry with the grey clay material only.
   * Lights export as KHR_lights_punctual; area lights have no glTF equivalent and are skipped.
   */
  async function exportGLB(as = 'lit') {
    const prev = mode; if (as !== prev) setMode(as);
    if (as === 'lit') {
      await texturesSettled();
      kit.root.traverse(o => { if (!o.isMesh) return;
        for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'])
          if (m[k]) m[k].userData.mimeType = m[k].userData.mimeType === 'image/png' ? 'image/png' : 'image/jpeg'; });   // keep PNG alpha of imported models
    }
    try {
      const buf = await new GLTFExporter().parseAsync(kit.root, { binary: true, maxTextureSize: 2048 });
      const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    } finally { if (as !== prev) setMode(prev); }
  }
  /** Resize the render target (playblast needs e.g. 1920×1088 — LTX wants sides divisible by 64). */
  function setSize(w, h) {
    W = w; H = h; renderer.setSize(w, h); composer.setSize(w, h);
    shotCam.aspect = w / h; shotCam.updateProjectionMatrix(); overview.aspect = w / h; overview.updateProjectionMatrix();
  }
  /** Resolves once every texture requested so far has loaded (or after 20 s), so frames are final. */
  const texturesSettled = () => new Promise(res => { if (texturesPending === 0) return res(); settleWaiters.push(res); setTimeout(res, 20000); });

  // ---- Interactive viewport (app only): orbit around the set, continuous render. ----
  let controls = null, looping = false;
  function interactive(on) {
    if (on && !controls) {
      controls = new OrbitControls(overview, renderer.domElement); controls.enableDamping = true;
      controls.target.copy(box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3()));
    }
    looping = !!on;
    const tick = () => { if (!looping) return; controls.update(); renderWith(overview); requestAnimationFrame(tick); };
    if (looping) requestAnimationFrame(tick);
  }
  /** Point the orbit view at the current set (after a load) or at a scene camera. */
  function frameView(camName) {
    const c = kit?.cameras.find(x => x.name === camName);
    if (c) { overview.position.copy(c.position); overview.fov = c.fov; overview.updateProjectionMatrix();
      if (controls) controls.target.set(...c.userData.lookAt); else overview.lookAt(...c.userData.lookAt); }
    else if (controls) { const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(overview.quaternion);
      controls.target.copy(overview.position).add(dir.multiplyScalar(Math.max(2, setDiag * 0.3))); }
  }

  // ---- Hands-on editing (app): pick, gizmo, live code blocks. Edits are recorded by the app as kit.edit/clone/remove
  // lines, so the scene code stays the single source of truth (undo, save, chat changes all see them). ----
  let gizmo = null, proxy = null, selBox = null, selName = null, gizmoMode = null;
  const listeners = { pick: () => {}, edit: () => {} };
  const objectGroups = () => kit ? kit.root.children.filter(o => o.userData.kind === 'object') : [];
  function ensureGizmo() {
    if (gizmo) return;
    proxy = new THREE.Object3D(); uiLayer.add(proxy);
    gizmo = new TransformControls(overview, renderer.domElement); gizmo.setSize(0.8); uiLayer.add(gizmo.getHelper());
    gizmo.addEventListener('dragging-changed', (e) => {
      if (controls) controls.enabled = !e.value;
      if (!e.value && selName) { const o = kit.root.getObjectByName(selName); if (o?.userData.edit) listeners.edit({ name: selName, ...o.userData.edit }); }
    });
    gizmo.addEventListener('objectChange', () => {
      if (!selName) return;
      const r = new THREE.Euler().setFromQuaternion(proxy.quaternion, 'XYZ');
      const round = (v, k = 1000) => Math.round(v * k) / k;
      // Uniform scale only: take the axis the user dragged furthest (edit() keeps objects undistorted).
      const prev = kit.root.getObjectByName(selName).userData.edit?.scale ?? 1;
      const s = [proxy.scale.x, proxy.scale.y, proxy.scale.z].reduce((a, v) => Math.abs(v - prev) > Math.abs(a - prev) ? v : a, prev);
      proxy.scale.setScalar(s);
      kit.edit(selName, { pos: proxy.position.toArray().map(v => round(v)), rot: [r.x, r.y, r.z].map(v => round(v / DEG2, 10)),
        scale: round(Math.max(0.05, s), 100) });
      selBox?.update();
    });
  }
  const DEG2 = Math.PI / 180;
  /** Select an object by name (null = none): yellow box + gizmo in the current mode. Returns its info or null. */
  function select(name) {
    selName = null; if (selBox) { uiLayer.remove(selBox); selBox.dispose?.(); selBox = null; } gizmo?.detach();
    const o = name && kit?.root.getObjectByName(name);
    if (!o || o.userData.kind !== 'object') return null;
    selName = name; selBox = new THREE.BoxHelper(o, 0xf2ff59); uiLayer.add(selBox);
    ensureGizmo();
    const e = o.userData.edit || { pos: o.userData.pivot, rot: [0, 0, 0], scale: 1 };
    proxy.position.set(...e.pos); proxy.rotation.set(...e.rot.map(v => v * DEG2)); proxy.scale.setScalar(Array.isArray(e.scale) ? e.scale[0] : e.scale);
    if (gizmoMode) { gizmo.setMode(gizmoMode); gizmo.attach(proxy); }
    return { name, category: o.userData.category, ...e };
  }
  /** Gizmo mode: 'translate' | 'rotate' | 'scale' | null (orbit only). */
  function setGizmo(mode) {
    gizmoMode = mode; ensureGizmo();
    if (!mode) gizmo.detach(); else { gizmo.setMode(mode); if (selName) gizmo.attach(proxy); }
  }
  // Click (not drag) in the viewport picks the object under the cursor.
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || !looping || gizmo?.dragging) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), overview);
    ray.near = 0; ray.far = Infinity;
    const hit = kit ? ray.intersectObjects(objectGroups(), true)[0] : null;
    let o = hit?.object; while (o && o.parent !== kit.root) o = o.parent;
    listeners.pick(o ? select(o.name) : (select(null), null));
  });
  /** Run extra scene-code blocks against the LIVE set (adds, clones, removes) — no reload, the view stays put. */
  function exec(code) {
    try { new Function('kit', '"use strict";\n' + code)(kit); }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    if (selName && !kit.root.getObjectByName(selName)) select(null);
    box = new THREE.Box3().setFromObject(kit.root); setMode(mode);   // new lights + kit.settings() take effect
    return { ok: true, stats: { ...kit.stats }, cameras: kit.cameras.map(c => c.name) };
  }
  const objects = () => objectGroups().map(o => ({ name: o.name, category: o.userData.category, triangles: o.userData.triangles || 0 }));
  /** Current orbit view (for "add camera here" and placing new things in front of the user). */
  function viewState() {
    const target = controls ? controls.target.clone() : new THREE.Vector3(0, 0, -1).applyQuaternion(overview.quaternion).add(overview.position);
    return { pos: overview.position.toArray(), target: target.toArray(), fov: overview.fov, hit: supportPoint() };
  }
  /**
   * Where a new model / shape should STAND: a floor-like surface under the centre of the view. The first surface the
   * view ray meets is often a wall, bars or the side of another object — standing there leaves the model hanging in the
   * air or inside that object — so from just in front of such a hit we drop straight down to the first upward-facing
   * surface (floor, table top, terrain), else to the ground plane (y = 0). null when the view meets nothing.
   */
  function supportPoint() {
    if (!kit) return null;
    const up = (h) => h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.7;
    ray.setFromCamera(new THREE.Vector2(0, 0), overview); ray.near = 0; ray.far = Infinity;
    const h = ray.intersectObjects(objectGroups(), true)[0];
    if (!h) return null;
    if (up(h)) return h.point.toArray();
    const from = h.point.clone().addScaledVector(ray.ray.direction, -0.3); from.y += 0.02;   // 30 cm back toward the camera
    ray.set(from, new THREE.Vector3(0, -1, 0)); ray.far = 1e4;
    const g = ray.intersectObjects(objectGroups(), true).find(up);
    ray.far = Infinity;
    return g ? g.point.toArray() : [from.x, 0, from.z];
  }

  return { load, setMode, shot, frame, visible, exportGLB, setSize, texturesSettled, interactive, frameView,
    select, setGizmo, exec, objects, viewState, addModel, hasModel: (id) => models.has(id), on: (ev, f) => { listeners[ev] = f; },
    MOVES, get canvas() { return renderer.domElement; }, renderer, get result() { return result; },
    get cameras() { return kit ? kit.cameras.map(c => c.name) : []; } };
}
