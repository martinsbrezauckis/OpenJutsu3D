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
 *   viewer.load(code) → result {ok, error, skipped, floating, stats, meta, cameras, order, materials, sky, ms}
 *   viewer.setMode('lit'|'clay'), viewer.shot(camName|'overview'), viewer.frame(cam, move, i, n, amount, fps) → state
 *   viewer.visible(cam, move, i, n) → [{name, category, labels, cover}], viewer.exportGLB('lit'|'clay') → base64,
 *   viewer.setSize(w, h), viewer.texturesSettled() → Promise, viewer.MOVES, viewer.canvas, viewer.renderer
 *   viewer.interactive(on) → orbit controls + render loop for the app's live viewport
 * Depends: three@0.186.1 (import map), kit.js, camera-moves.js, materials.json, assets/textures/manifest.json.
 */
import * as THREE from 'three';
import { floaters } from './floaters.js';
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

/**
 * Convert an FBX file (Mixamo's download format) to GLB bytes with its animations, so an imported character goes
 * through the same library/GLB route as every other model. Embedded textures are waited for (FBXLoader decodes them
 * asynchronously) and capped at 2048 px. A "without skin" motion file converts to a skeleton + clip (no meshes):
 * use it as a motion of a character (kit.model {motions}). Returns { glb, meshes, bones, dropped (textures), clips: [{name, seconds}] }.
 */
export async function convertFBX(buf) {
  const [{ FBXLoader }, { GLTFExporter: Exporter }] = await Promise.all([
    import('three/addons/loaders/FBXLoader.js'), import('three/addons/exporters/GLTFExporter.js')]);
  const obj = new FBXLoader().parse(buf, '');
  const slots = []; let meshes = 0, bones = 0;
  obj.traverse((o) => {
    if (o.isBone) bones++;
    if (!o.isMesh) return; meshes++;
    for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'specularMap', 'bumpMap'])
      if (m?.[k]) slots.push([m, k]);
  });
  // TextureLoader sets texture.image only once the (embedded, blob-URL) image has loaded: wait for it; a texture that
  // never decodes (a missing external file) is dropped rather than failing the whole import.
  const ok = (im) => im && (im.width > 0 || im.naturalWidth > 0 || im.data);
  const loaded = (tx) => new Promise((res) => { const t0 = Date.now(), poll = () => (ok(tx.image) || Date.now() - t0 > 20000 ? res() : setTimeout(poll, 50)); poll(); });
  await Promise.all([...new Set(slots.map(([m, k]) => m[k]))].map(loaded));
  let dropped = 0; for (const [m, k] of slots) if (!ok(m[k].image)) { m[k] = null; m.needsUpdate = true; dropped++; }
  obj.animations.forEach((c, i) => { if (!c.name || c.name === 'mixamo.com') c.name = i ? `motion_${i}` : 'motion'; });
  const glb = await new Exporter().parseAsync(obj, { binary: true, animations: obj.animations, maxTextureSize: 2048, onlyVisible: false });
  return { glb, meshes, bones, dropped, clips: obj.animations.map((c) => ({ name: c.name, seconds: Number(c.duration.toFixed(2)) })) };
}

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
  // Light and camera icons in the live view (never in shots or exports: uiLayer only draws in the orbit view). A click
  // on an icon selects that light/camera (they were only in the Objects list before).
  // Drawn in their own pass AFTER the effects (renderWith): inside the scene the wet-floor reflections (SSR) mirrored them.
  const markerScene = new THREE.Scene(), markers = new THREE.Group(); markers.name = 'markers'; markerScene.add(markers);
  const iconTex = new Map();
  function icon(kind, color) {
    const key = kind + color; if (iconTex.has(key)) return iconTex.get(key);
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,22,26,0.82)'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#f2ff59'; g.stroke();
    if (kind === 'light') {
      g.fillStyle = color; g.beginPath(); g.arc(32, 30, 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = color; g.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(32 + Math.cos(a) * 15, 30 + Math.sin(a) * 15); g.lineTo(32 + Math.cos(a) * 21, 30 + Math.sin(a) * 21); g.stroke(); }
    } else {
      g.fillStyle = '#ffffff'; g.fillRect(14, 22, 26, 20); g.beginPath(); g.moveTo(40, 32); g.lineTo(52, 23); g.lineTo(52, 41); g.closePath(); g.fill();
    }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; iconTex.set(key, tx); return tx;
  }
  function refreshMarkers() {
    for (const m of [...markers.children]) { markers.remove(m); m.material?.dispose?.(); m.geometry?.dispose?.(); }
    if (!kit) return;
    kit.root.traverse((o) => {
      const kind = o.userData?.kind; if (kind !== 'light' && kind !== 'camera') return;
      const col = kind === 'light' && o.color ? '#' + o.color.getHexString() : '#ffffff';
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(kind, col), depthTest: false, transparent: true, sizeAttenuation: false }));
      s.scale.setScalar(0.045); s.renderOrder = 999; s.userData.pick = o.name; markers.add(s);
    });
    placeMarkers();
  }
  const _mp = new THREE.Vector3();
  function placeMarkers() {
    for (const m of markers.children) { const o = kit?.root.getObjectByName(m.userData.pick); if (o) m.position.copy(o.getWorldPosition(_mp)); }
  }
  // Ambient lift so unlit corners aren't pure black in lit mode; stronger studio fill in clay mode.
  const ambient = new THREE.HemisphereLight(0xbfd4ff, 0x2a2420, 0.25); ambient.name = 'viewport_ambient'; scene.add(ambient);
  const headlight = new THREE.DirectionalLight(0xffffff, 1.2); headlight.name = 'viewport_headlight'; scene.add(headlight, headlight.target);

  const fetchJSON = async (u) => { const r = await fetch(url(u), { credentials: 'omit' }); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
  // The rigged mannequin for kit.actor() (CC0 Quaternius, assets/characters/NOTICE.txt): parsed once per viewer.
  const loadCharacter = () => fetch(url('assets/characters/mannequin.glb'), { credentials: 'omit' })
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then(b => new GLTFLoader().parseAsync(b, ''))
    .then(g => ({ scene: g.scene, animations: g.animations })).catch(() => null);
  const [library, manifest, fontJSON, character] = await Promise.all([fetchJSON('materials.json'), fetchJSON('assets/textures/manifest.json').catch(() => ({})),
    fetchJSON('assets/fonts/droid_sans_bold.typeface.json').catch(() => null), loadCharacter()]);
  const font = fontJSON ? new FontLoader().parse(fontJSON) : null;   // kit.text() (signs); Apache-2.0, assets/fonts/NOTICE.txt
  const manager = new THREE.LoadingManager();
  let texturesPending = 0, settleWaiters = [];
  manager.onStart = () => { texturesPending++; };
  manager.onLoad = () => { texturesPending = 0; settleWaiters.splice(0).forEach(f => f()); needsRender = true; };
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
  let needsRender = true, lastRender = 0;   // live view redraws on change (see interactive())
  let parkedT = null;   // timeline playhead parked at a time (seek): people hold that pose in the live view
  const plans = new Map();
  // Library / imported models (kit.model): parsed once, kept across set reloads; the app hands over the GLB bytes.
  const models = new Map();
  async function addModel(id, glb, height) {
    if (models.has(id)) return;
    const g = await new GLTFLoader().parseAsync(glb, '');
    models.set(id, { scene: g.scene, animations: g.animations || [], height: Number(height) || undefined });   // clips: animated imports
  }
  const newKit = () => new SceneKit(scene, { onCommit: (o, info) => log.push(info.name), library, font, models, character,
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
          if (e instanceof SyntaxError && skipped.length < MAX_SKIPS) {
            // A syntax error has no useful line: compile ever longer prefixes (parse only, nothing runs) and drop the
            // first block that breaks them — one bad block must not empty the whole set (10-29).
            const ends = []; lines.forEach((l, i) => { if (i && l.startsWith('//@@')) ends.push(i); }); ends.push(lines.length);
            let start = 0, bad = null;
            for (const end of ends) {
              try { new Function('kit', '"use strict";\n' + lines.slice(0, end).join('\n')); start = end; }
              catch { bad = [start, end]; break; }
            }
            if (bad) {
              const first = lines.slice(bad[0], bad[1]).find(l => l.trim() && !l.startsWith('//@@')) || '';
              skipped.push({ line: bad[0] + 1, dropped_lines: bad[1] - bad[0], code: first.trim().slice(0, 120), error: String(e.message).slice(0, 200) });
              lines = lines.slice(0, bad[0]).concat(lines.slice(bad[1]));
              scene.remove(kit.root); log.length = 0; kit = newKit();
              continue;
            }
          }
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
    // props hanging in mid-air (a missing .at() put the tavern's table things in the aisle, 10-29): the app sends
    // the ones its new code added back to the builder with the gap
    try { result.floating = floaters(kit.root); } catch { result.floating = []; }

    // Atmosphere: light exponential fog in lit mode, scaled to the set size, so depth reads like a real space.
    box = new THREE.Box3().setFromObject(kit.root);
    setDiag = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();  // set diagonal (m)
    result.size = box.isEmpty() ? null : box.getSize(new THREE.Vector3()).toArray().map(x => Math.round(x * 10) / 10);
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
    setMode(mode); refreshMarkers();
    return result;
  }

  // ---- Sky for exteriors (2026-10-18: outdoor sets showed a black void) ----
  // Exterior test: from every camera (or the overview), cast 48 rays into the upper hemisphere; if most escape the
  // set, it is outdoors. The MEDIAN over the cameras decides: one camera standing in an open doorway (the 10-29 hotel
  // lobby's entrance view, 42 % of its rays out through the door) made a closed room "outdoors" — day sky + white
  // haze washed the whole set out. Time of day from describe(). The sky also becomes the reflection environment outdoors.
  function detectSky() {
    const cams = kit.cameras.length ? kit.cameras : [(() => { const c = new THREE.PerspectiveCamera(); c.position.copy(box.getCenter(new THREE.Vector3())).add(new THREE.Vector3(0, 2, 0)); return c; })()];
    const meshes = []; kit.root.traverse(o => { if (o.isMesh) meshes.push(o); });
    const rc = new THREE.Raycaster(), N = 48;
    const out = (p) => {
      let n = 0;
      for (let i = 0; i < N; i++) {
        const az = (i / N) * Math.PI * 2 * 3.7, el = 0.25 + 0.65 * ((i * 0.618) % 1);   // spread over the upper hemisphere
        rc.set(p, new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)));
        rc.far = 2000; if (!rc.intersectObjects(meshes, false).length) n++;
      }
      return n / N;
    };
    const fr = cams.map((c) => out(c.position)).sort((a, b) => a - b), h = fr.length >> 1;
    const escaped = (fr.length % 2 ? fr[h] : (fr[h - 1] + fr[h]) / 2) * N;
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
  function renderWith(cam) {
    aimHeadlight(cam); uiLayer.visible = cam === overview && looping; renderPass.camera = cam; ssr.camera = cam; composer.render();
    if (cam === overview && looping && markers.children.length) { renderer.autoClear = false; renderer.render(markerScene, overview); renderer.autoClear = true; }
  }

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
    const c0 = kit.cameras.find(c => c.name === camName) || kit.cameras[0];
    const camState = (c) => ({ pos: c.position.toArray(), lookAt: c.userData.lookAt, fov: c.fov, keys: c.userData.keys });
    const start = camState(c0);
    // Cut targets ("move:s@CAM_x"): their poses + keyframes are part of the key as well.
    const others = [...new Set([...move.matchAll(/@(CAM_[A-Za-z0-9_]+)/g)].map(m => m[1]))].map(nm => kit.cameras.find(c => c.name === nm)).filter(Boolean);
    // The camera's current pose + keyframes are part of the key: a live edit (gizmo, new keyframes) re-plans the shot.
    const key = `${camName}|${move}|${n}|${amount}|${fps}|${JSON.stringify(start)}|${JSON.stringify(others.map(camState))}`;
    if (plans.has(key)) return plans.get(key);
    // A recipe ("dolly-in:4+arc-left:6:2.5@CAM_table") chains moves; a segment on another camera is a hard cut to it.
    const cams = { shot: c0.name, at: (nm) => { const c = others.find(o => o.name === nm); return c ? camState(c) : null; } };
    const raw = move.includes(':') || move.includes('+') || move.includes('@')
      ? pathStates(move, start, n, fps, 0.6, cams)
      : Array.from({ length: n }, (_, i) => ({ ...cameraAt(move, start, n > 1 ? i / (n - 1) : 0, { amount, seconds: (n - 1) / fps }), cam: c0.name, seg: 0, group: 0, cut: false, from: start.pos }));
    // Wall avoidance is an INTERIOR concept: outdoors the look-at target is often inside a building (a cathedral), so a
    // target→camera ray would drag the camera into it (city flyover, 10-18). Exteriors fly free, ≥ 1.5 m above floor.
    // a frame whose camera has not left the start pose (pans, tilts, zooms: only the look-at moves) keeps it — the
    // look-at point swinging into a wall must not drag the camera after it (tavern whip-pan jumped, 10-29). With cuts,
    // "start pose" = the start of that camera's run (st.from), and the smoothing windows stop at a cut.
    const still = (st) => Math.hypot(...st.pos.map((x, k) => x - st.from[k])) < 1e-3;
    const f = skyInfo.exterior ? raw.map(() => 1) : raw.map((st) => (still(st) ? 1 : freeFraction(st))), win = Math.max(1, Math.round(n / 12));
    if (skyInfo.exterior) for (const st of raw) st.pos[1] = Math.max(st.pos[1], box.min.y + 1.5);
    const near = (arr, i) => arr.slice(Math.max(0, i - win), i + win + 1).filter((_, j) => raw[Math.max(0, i - win) + j].group === raw[i].group);
    const mins = f.map((_, i) => Math.min(...near(f, i)));
    const smooth = mins.map((_, i) => { const s = near(mins, i); return s.reduce((a, b) => a + b, 0) / s.length; });
    const plan = raw.map((st, i) => {
      const r = Math.min(1, smooth[i]);
      if (r < 0.999) st.pos = st.lookAt.map((t, k) => t + (st.pos[k] - t) * r);
      return { ...st, collided: r < 0.999, free: Number(r.toFixed(3)) };
    });
    plans.set(key, plan);
    return plan;
  }
  /** Share of a 12×8 grid of canvas pixels that are exactly black (0,0,0): a frame that comes back mostly black while
   *  its neighbour was not is a failed capture (seen once on the CPU renderer, lit pass), not a dark scene. */
  function blackness() {
    const gl = renderer.getContext(), px = new Uint8Array(4); let k = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      gl.readPixels(Math.floor((x + 0.5) / 12 * gl.drawingBufferWidth), Math.floor((y + 0.5) / 8 * gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (px[0] === 0 && px[1] === 0 && px[2] === 0) k++;
    }
    return k / 96;
  }
  /** Render frame i of n for `move` from scene camera `camName`; returns the exact camera state used. */
  function frame(camName, move, i, n, amount = 1, fps = 24) {
    const st = planShot(camName, move, n, amount, fps)[i];
    kit?.animate(i / fps);   // people move with the shot clock: frame i always shows the same pose
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
      // People: the hit mesh sits deeper (actor → body group → rig); report the committed CHAR_ group and its motion.
      let top = obj; while (top.parent && top.parent !== kit.root && top.userData.kind !== 'object') top = top.parent;
      const o = top.userData.kind === 'object' ? top : obj;
      const e = hits.get(o.name) || { name: o.name, category: o.userData.category, action: o.userData.actor?.as ?? o.userData.actor?.action, labels: new Set(), n: 0 };
      e.n++; e.labels.add(h.object.userData.label); hits.set(o.name, e);
    }
    return [...hits.values()].map(e => ({ name: e.name, category: e.category, action: e.action, labels: [...e.labels], cover: +(e.n / (GX * GY)).toFixed(4) }))
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
  // Redraw on change, not every animation frame: an idle viewport rendering 60 fps on a CPU renderer took the cores a
  // shot capture needed (10-29). Anything that changes the picture calls invalidate(); orbiting, people animating and
  // a once-a-second heartbeat (late textures, anything missed) also redraw.
  const invalidate = () => { needsRender = true; };
  function interactive(on) {
    invalidate();
    if (on && !controls) {
      controls = new OrbitControls(overview, renderer.domElement); controls.enableDamping = true;
      controls.target.copy(box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3()));
    }
    looping = !!on;
    const tick = () => {
      if (!looping) return;
      const moved = controls.update(), now = performance.now(), people = !!kit?.actors.length;
      // people animate at 24 fps (film rate) — 60 fps on a CPU renderer was the same starvation as before
      if (moved || needsRender || (people && now - lastRender > 41) || gizmo?.dragging || now - lastRender > 1000) {
        if (people) kit.animate(parkedT ?? (now / 1000) % 600);   // people move in the live view too (or hold the parked time)
        placeMarkers();
        renderWith(overview); needsRender = false; lastRender = now;
      }
      requestAnimationFrame(tick);
    };
    if (looping) requestAnimationFrame(tick);
  }
  /**
   * Park the timeline at frame i of a shot (scrubbing): people take their pose at that time and the orbit view jumps
   * to where the shot camera is then, so a keyframe added from the view starts from the camera's own framing.
   * i = null unparks (people animate freely again). Returns the camera state at i.
   */
  function seek(camName, move, i, n, amount = 1, fps = 24) {
    if (i === null || i === undefined) { parkedT = null; needsRender = true; return null; }
    const st = planShot(camName, move, n, amount, fps)[Math.max(0, Math.min(n - 1, i | 0))];
    parkedT = i / fps; kit?.animate(parkedT);
    overview.position.set(...st.pos); overview.fov = st.fov; overview.updateProjectionMatrix();
    if (controls) controls.target.set(...st.lookAt); else overview.lookAt(...st.lookAt);
    needsRender = true; return st;
  }
  /** Put the orbit view back exactly (viewState() → setView()): a reload after an edit keeps where the user looks. */
  function setView(s) {
    if (!s?.pos || !s?.target) return;
    overview.position.set(...s.pos); if (s.fov) { overview.fov = s.fov; overview.updateProjectionMatrix(); }
    if (controls) controls.target.set(...s.target); else overview.lookAt(...s.target);
    needsRender = true;
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
  // Selection = selNames (selName = the last one picked). Several names = a group of OBJECTS only: lights and cameras
  // have no size and turn about their own position, so moving / turning / scaling them as part of a group has no clear
  // meaning. Picking a light or camera (with or without Shift) selects it alone; Shift-picking an object while a light
  // or camera is selected starts a new object selection.
  let gizmo = null, proxy = null, selBoxes = [], selNames = [], selName = null, gizmoMode = null, dragFrom = null;
  const listeners = { pick: () => {}, edit: () => {} };
  const objectGroups = () => kit ? kit.root.children.filter(o => o.userData.kind === 'object') : [];
  const round = (v, k = 1000) => Math.round(v * k) / k;
  const isGroup = () => selNames.length > 1;
  const editOf = (o) => o.userData.edit || { pos: o.userData.pivot, rot: [0, 0, 0], scale: 1 };
  const proxyState = () => {
    const r = new THREE.Euler().setFromQuaternion(proxy.quaternion, 'XYZ');
    return { pos: proxy.position.toArray().map(v => round(v)), rot: [r.x, r.y, r.z].map(v => round(v / DEG2, 10)), scale: round(proxy.scale.x, 100) };
  };
  // Uniform scale only: take the axis the user dragged furthest (edit() keeps objects undistorted).
  function uniformScale(prev) {
    const s = [proxy.scale.x, proxy.scale.y, proxy.scale.z].reduce((a, v) => Math.abs(v - prev) > Math.abs(a - prev) ? v : a, prev);
    proxy.scale.setScalar(s); return s;
  }
  /** Group drag start: the gizmo's proxy and every selected object's edit state as they are now. */
  function beginGroup() {
    proxy.updateMatrix();
    dragFrom = { m: proxy.matrix.clone(), q: proxy.quaternion.clone(), s: proxy.scale.x, moved: false,
      items: selNames.map(n => ({ name: n, ...editOf(kit.root.getObjectByName(n)) })) };
  }
  /** The proxy's change since beginGroup(), G = proxy now · (proxy at start)⁻¹, applied to every object: G moves each
   *  object's centre, the same turn adds to its rotation and the same factor multiplies its scale (uniform, so it
   *  commutes with the turn) — kit.edit's pos / rot / scale about the object's centre express that exactly. */
  function applyGroup() {
    proxy.updateMatrix();
    const G = proxy.matrix.clone().multiply(dragFrom.m.clone().invert());
    const dq = proxy.quaternion.clone().multiply(dragFrom.q.clone().invert()), k = proxy.scale.x / dragFrom.s;
    for (const it of dragFrom.items) {
      const p = new THREE.Vector3(...it.pos).applyMatrix4(G);
      const r = new THREE.Euler().setFromQuaternion(dq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.rot.map(v => v * DEG2)))), 'XYZ');
      const sc = (v) => round(Math.max(0.05, v * k), 100);
      kit.edit(it.name, { pos: p.toArray().map(v => round(v)), rot: [r.x, r.y, r.z].map(v => round(v / DEG2, 10)), scale: Array.isArray(it.scale) ? it.scale.map(sc) : sc(it.scale) });
    }
    dragFrom.moved = true;
    selBoxes.forEach(b => b.update?.());
  }
  const groupEdits = () => ({ edits: selNames.map(n => ({ name: n, ...editOf(kit.root.getObjectByName(n)) })), group: proxyState() });
  function ensureGizmo() {
    if (gizmo) return;
    proxy = new THREE.Object3D(); uiLayer.add(proxy);
    gizmo = new TransformControls(overview, renderer.domElement); gizmo.setSize(0.8); uiLayer.add(gizmo.getHelper());
    gizmo.addEventListener('change', () => { needsRender = true; });   // hover highlight, drags
    gizmo.addEventListener('dragging-changed', (e) => {
      if (controls) controls.enabled = !e.value;
      // A group drag = ONE edit event carrying every object's final state (the app records it as one version).
      if (isGroup()) { if (e.value) beginGroup(); else if (dragFrom) { const moved = dragFrom.moved; dragFrom = null; if (moved) listeners.edit(groupEdits()); } return; }
      if (!e.value && selName) { const o = kit.root.getObjectByName(selName); if (o?.userData.edit) listeners.edit({ name: selName, ...o.userData.edit }); }
    });
    gizmo.addEventListener('objectChange', () => {
      if (!selName) return;
      if (isGroup()) { if (dragFrom) { uniformScale(dragFrom.s); applyGroup(); } return; }
      const r = new THREE.Euler().setFromQuaternion(proxy.quaternion, 'XYZ');
      // Lights and cameras have no size: their scale stays 1.
      const sel = kit.root.getObjectByName(selName), aimOnly = sel.userData.kind !== 'object';
      if (aimOnly) proxy.scale.setScalar(1);
      const s = uniformScale(sel.userData.edit?.scale ?? 1);
      kit.edit(selName, { pos: proxy.position.toArray().map(v => round(v)), rot: [r.x, r.y, r.z].map(v => round(v / DEG2, 10)),
        scale: round(Math.max(0.05, s), 100) });
      selBoxes.forEach(b => b.update?.());
    });
  }
  const DEG2 = Math.PI / 180;
  /** The selection as the app sees it: one object / light / camera with its edit state, or a group (names, gizmo state). */
  function selInfo() {
    if (!selName) return null;
    if (isGroup()) return { name: selName, names: [...selNames], category: 'GROUP', ...proxyState() };
    const o = kit.root.getObjectByName(selName), e = editOf(o);
    const light = o.isLight ? { type: o.userData.type, color: '#' + o.color.getHexString(), intensity: o.intensity, on: o.visible } : undefined;
    return { name: selName, category: o.userData.category ?? (o.isLight ? 'LGT' : o.userData.kind === 'camera' ? 'CAM' : undefined), ...e, light };
  }
  /** Select an object by name (null = none): yellow box + gizmo in the current mode. add = Shift/Ctrl-click: toggle an
   *  object in or out of the selection (add with nothing under the cursor keeps the selection). Returns selInfo(). */
  function select(name, add = false) {
    const o = name && kit?.root.getObjectByName(name);
    const ok = o && ['object', 'light', 'camera'].includes(o.userData.kind);
    if (add && !ok) return selInfo();
    if (add && o.userData.kind === 'object' && selName && kit.root.getObjectByName(selName)?.userData.kind === 'object')
      return selectMany(selNames.includes(name) ? selNames.filter(n => n !== name) : [...selNames, name]);
    return selectMany(ok ? [name] : []);
  }
  /** Select several at once (one = a single selection; several = objects only, see above). The group's gizmo sits at
   *  the centre of their joint box, unturned, scale 1. */
  function selectMany(names) {
    needsRender = true;   // also reached from a click in the view, not only through the API
    for (const b of selBoxes) { uiLayer.remove(b); b.dispose?.(); } selBoxes = []; gizmo?.detach(); dragFrom = null;
    let objs = [...new Set((names || []).map(n => typeof n === 'string' && kit?.root.getObjectByName(n)))]
      .filter(o => o && ['object', 'light', 'camera'].includes(o.userData.kind));
    if (objs.length > 1) objs = objs.filter(o => o.userData.kind === 'object');
    selNames = objs.map(o => o.name); selName = selNames.at(-1) ?? null;
    if (!selName) return null;
    // Marker: objects get a box; a camera shows its view frustum; a light a small sphere that follows it.
    for (const o of objs) {
      let b;
      if (o.userData.kind === 'object') b = new THREE.BoxHelper(o, 0xf2ff59);
      else if (o.userData.kind === 'camera') b = new THREE.CameraHelper(o);
      else {
        b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf2ff59, wireframe: true }));
        b.update = () => b.position.copy(o.position); b.update();
      }
      uiLayer.add(b); selBoxes.push(b);
    }
    ensureGizmo();
    if (objs.length > 1) {
      const box = new THREE.Box3(); objs.forEach(o => box.expandByObject(o));
      proxy.position.copy(box.getCenter(new THREE.Vector3())); proxy.rotation.set(0, 0, 0); proxy.scale.setScalar(1);
    } else {
      const e = editOf(objs[0]);
      proxy.position.set(...e.pos); proxy.rotation.set(...e.rot.map(v => v * DEG2)); proxy.scale.setScalar(Array.isArray(e.scale) ? e.scale[0] : e.scale);
    }
    if (gizmoMode) { gizmo.setMode(gizmoMode); gizmo.attach(proxy); }
    return selInfo();
  }
  /** Move / turn / scale the selected group exactly as a gizmo drag would (automation, tests): pos = where the group's
   *  centre goes, rot (degrees) and scale = the gizmo's state relative to the group as selected. Returns the edits. */
  function editGroup({ pos, rot, scale } = {}) {
    if (!isGroup()) return null;
    beginGroup();
    if (pos) proxy.position.set(...pos);
    if (rot) proxy.rotation.set(...rot.map(v => v * DEG2));
    if (scale !== undefined) proxy.scale.setScalar(scale);
    applyGroup(); dragFrom = null; return groupEdits();
  }
  /** Gizmo mode: 'translate' | 'rotate' | 'scale' | null (orbit only). */
  function setGizmo(mode) {
    gizmoMode = mode; ensureGizmo();
    if (!mode) gizmo.detach(); else { gizmo.setMode(mode); if (selName) gizmo.attach(proxy); }
  }
  // Click (not drag) in the viewport picks the object under the cursor; Shift / Ctrl / Cmd-click adds or removes it.
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || !looping || gizmo?.dragging) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved > 4) return;
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), overview);
    ray.near = 0; ray.far = Infinity;
    markerScene.updateMatrixWorld();
    const icon = ray.intersectObjects(markers.children, false)[0];   // light / camera icons win over what is behind them
    if (icon) { listeners.pick(select(icon.object.userData.pick, add)); return; }
    const o = pickTop(ray.intersectObjects(objectGroups(), true)[0]);
    if (!o && add) return;
    listeners.pick(o ? select(o.name, add) : (select(null), null));
  });
  const pickTop = (hit) => { let o = kit ? hit?.object : null; while (o && o.parent !== kit.root) o = o.parent; return o || null; };
  /** Client px (in this document) of a world point, the inverse of the click mapping above. */
  function toClient(v) {
    const p = v.clone().project(overview), r = renderer.domElement.getBoundingClientRect();
    return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
  }
  /** Automation: a point in the view where a click picks `name` (nothing in front of it), or null. */
  function locate(name) {
    const o = kit?.root.getObjectByName(name); if (!o || o.userData.kind !== 'object') return null;
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    for (const [u, w] of [[0, 0], [-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25], [-0.25, -0.25], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25]]) {
      const pt = c.clone().add(new THREE.Vector3(u * s.x, w * s.y, u * s.z)), p = pt.clone().project(overview);
      if (Math.abs(p.x) > 0.9 || Math.abs(p.y) > 0.9 || p.z > 1) continue;
      ray.setFromCamera(new THREE.Vector2(p.x, p.y), overview); ray.near = 0; ray.far = Infinity;
      if (pickTop(ray.intersectObjects(objectGroups(), true)[0]) === o) return toClient(pt);
    }
    return null;
  }
  /** Automation: the gizmo handle for `axis` ('X', 'Y', 'Z') → {at: its client px, from: the gizmo centre's}. */
  function gizmoHandle(axis = 'X') {
    if (!gizmo?.object) return null;
    gizmo.getHelper().updateMatrixWorld(true);
    const pk = gizmo._gizmo?.picker?.[gizmo.mode]?.children.find(c => c.name === axis); if (!pk) return null;
    return { at: toClient(new THREE.Box3().setFromObject(pk).getCenter(new THREE.Vector3())), from: toClient(proxy.getWorldPosition(new THREE.Vector3())) };
  }
  /** Run extra scene-code blocks against the LIVE set (adds, clones, removes) — no reload, the view stays put. */
  function exec(code) {
    try { new Function('kit', '"use strict";\n' + code)(kit); }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    if (selNames.some(n => !kit.root.getObjectByName(n))) selectMany(selNames.filter(n => kit.root.getObjectByName(n)));
    else selBoxes.forEach(b => b.update?.());   // an edit line of a selected object: the box follows it
    box = new THREE.Box3().setFromObject(kit.root); setMode(mode);   // new lights + kit.settings() take effect
    refreshMarkers();   // added / removed lights and cameras get / lose their icon
    return { ok: true, stats: { ...kit.stats }, cameras: kit.cameras.map(c => c.name) };
  }
  const objects = () => [...objectGroups().map(o => ({ name: o.name, category: o.userData.category, triangles: o.userData.triangles || 0 })),
    ...(kit ? kit.root.children.filter(o => o.userData.kind === 'light' || o.userData.kind === 'camera')
      .map(o => ({ name: o.name, category: o.userData.kind === 'camera' ? 'CAM' : 'LGT', triangles: 0, kind: o.userData.kind })) : [])];
  /** Current orbit view (for "add camera here" and placing new things in front of the user). */
  function viewState() {
    const target = controls ? controls.target.clone() : new THREE.Vector3(0, 0, -1).applyQuaternion(overview.quaternion).add(overview.position);
    const hit = supportPoint(), c = overview.position;
    // a person stands at most ~4 m in front of the view: aimed down a long room, the hit was the far wall and an
    // imported character landed inside the tavern's hearth, out of sight (10-29)
    const d = hit && Math.hypot(hit[0] - c.x, hit[2] - c.z), k = d > 4.5 ? 4 / d : 1;
    const stand = hit && (k < 1 ? [c.x + (hit[0] - c.x) * k, c.y, c.z + (hit[2] - c.z) * k] : hit);
    return { pos: c.toArray(), target: target.toArray(), fov: overview.fov, hit, ground: stand && groundBelow(stand) };
  }
  /** The walkable ground under a point: the LOWEST upward-facing surface straight below it (a person added while the
   *  view looks at a shelf or a table stands on the floor under it, not on top of it); y = 0 when there is none. */
  function groundBelow(p) {
    const up = (h) => h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.7;
    ray.set(new THREE.Vector3(p[0], p[1] + 0.05, p[2]), new THREE.Vector3(0, -1, 0)); ray.near = 0; ray.far = 1e4;
    const hits = ray.intersectObjects(objectGroups(), true).filter(up);
    ray.far = Infinity;
    return hits.length ? hits[hits.length - 1].point.toArray() : [p[0], 0, p[2]];
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

  const dirty = (f) => (...a) => { const r = f(...a); needsRender = true; if (r && typeof r.then === 'function') r.finally(() => { needsRender = true; }); return r; };
  /** The planned camera states of a whole shot (read-only; the app measures the move's speed for 48 fps; cam/cut = which
   *  scene camera films each frame and where a cut to another camera lands). */
  const path = (camName, move, n, fps = 24) => planShot(camName, move, n, 1, fps).map(({ pos, lookAt, fov, roll, cam, seg, cut }) => ({ pos, lookAt, fov, roll, cam, seg, cut }));
  return { load: dirty(load), setMode: dirty(setMode), shot, frame, seek, path, setView, renderView: () => renderWith(overview), visible, exportGLB, setSize: dirty(setSize), texturesSettled, interactive, frameView: dirty(frameView),
    blackness, select: dirty(select), selectMany: dirty(selectMany), editGroup: dirty(editGroup), locate, gizmoHandle, setGizmo: dirty(setGizmo), exec: dirty(exec), objects, viewState, addModel: dirty(addModel), hasModel: (id) => models.has(id), on: (ev, f) => { listeners[ev] = f; },
    MOVES, get canvas() { return renderer.domElement; }, renderer, get result() { return result; },
    get cameras() { return kit ? kit.cameras.map(c => c.name) : []; } };
}
