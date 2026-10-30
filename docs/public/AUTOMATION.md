# Automation API

Everything you can do in the app's window can also be done by a script or an AI agent: build a set, change it, film
it, render shots, edit objects, manage model packs. The automation server keeps one real browser on the app and
exposes every UI action over HTTP; after each action it returns the app's state and a screenshot.

## Start it

```bash
cd web && npm run dev                       # the app, http://127.0.0.1:3000
python3 bench/debug_api.py                  # the automation server, http://127.0.0.1:3999
```

Needs Python 3 with Playwright (`pip install playwright && playwright install chromium`). The browser renders 3D on
the CPU by default; on a machine with an NVIDIA GPU use `SCENEKIT_GL=vulkan python3 bench/debug_api.py --gpu`.

## Security

- Listens on 127.0.0.1 only and accepts only `Host: 127.0.0.1` / `localhost`.
- Every request needs the token from `bench/logs/debug_api.token` (created at start, readable by your user only) in
  the `X-Debug-Token` header.
- Requests carrying an `Origin` header (anything sent by a web page) are refused, so a website you visit cannot drive
  it. POST bodies must be JSON.

## Endpoints

| Call | What it does |
|---|---|
| `POST /open {url?, width?, height?}` | Open or reload the app (default 1600×900). |
| `POST /act {name, args?, wait?, settle?}` | Run one action. `wait` = seconds to wait after it (default 1.5); `settle: true` waits until the app is no longer busy (builds, renders). Returns `{ok, state, shot, errors}`. |
| `POST /key {key, where?, wait?}` | A real key press, e.g. `Escape`; `where`: `page` (default) or `viewport` (inside the 3D view). |
| `POST /click {object? \| x?, y?, mods?, wait?}` | A real mouse click in the 3D view: on a spot where a click picks `object` (or at page pixels `x`, `y`). `mods`: `["Shift"]`, `["Control"]` or `["Meta"]` held during the click (adds to / removes from the selection). |
| `POST /drag {handle?, by?, wait?}` | A real mouse drag of the gizmo handle `X`, `Y` or `Z` (default `X`) by `by` pixels (default 80) outward along that axis as the screen shows it. Select something and set `editMode` first. |
| `POST /upload {path, wait?, target?}` | Give a file to the open Import input of the model library (open it first with `library`); waits until the import is done. `target: "ref"` gives pictures to the Reference chip instead (`paths: [...]` = several at once, like picking several files); waits until the chip changes. Files must lie under `bench/out`. |
| `GET /state` | The app's state: view, scene, versions, camera, recipe (`recipeStr` = its string form, `cuts[i]` = move i cuts to another camera), `parkPose` (the camera at the parked moment: `pos`, `lookAt`, `fov`, `cam`, `cut`), takes, chat, edit state (`edit.sel` = the last picked, `edit.names` = all selected when several, `edit.pos` / `rot` / `scale` = the selection's gizmo), `refs` (each reference picture's `label`, `from`, `type`, `bytes`), `refNote` (the chip's refusal message, if any), `looks` (look stills in the chat), `takeStill` (the shown take's photoreal still). |
| `GET /shot?name=x` | A screenshot now. |
| `GET /log` | The action log and browser console errors. |
| `GET /actions` | The names of all actions. |

Run several servers for parallel jobs, each with its own browser: `python3 bench/debug_api.py --port 3998` writes
`bench/logs/debug_api.3998.token`; scripts pick it with `O3J_API_PORT=3998`. Each server handles one request at a time; a long `settle` action (a build or a render) holds it until it finishes.

## Actions

**Start and scenes**

| Action | Arguments |
|---|---|
| `home` | — back to the start page |
| `openExample` | `id`: `dungeon`, `neon`, `city`, `moon`, `cafe`, `tavern`, `reading`, `temple` |
| `openBlank` | — an empty studio |
| `openSaved` | `id` of a saved scene |
| `openSceneText` | `text`, `name?` — open a shared scene file's JSON as a new scene |
| `shareFile` | — download the open scene as a scene file |
| `homePrompt` | `text` — type the first prompt on the start page |
| `ref` | `dataUrl` (PNG/JPEG/WebP data: URL) or `null` — replace all reference pictures with this one (`null` = none) |
| `addRef` | `dataUrl`, `label?` — add a reference picture (up to 5; a 6th is refused with "Up to 5 reference pictures…") |
| `removeRef` | `index` — remove one reference picture |
| `labelRef` | `index`, `text` — say what a picture shows, e.g. `the woman` (empty = no label) |
| `refFromTake` | `index`, `still` (default) or `frame` — use a take's photoreal look still, or the frame of its final video on screen (show the take first), as a reference |
| `refFromConcept` | — use the last concept picture as a reference |
| `refFromLook` | — use the last look still in the chat as a reference |
| `aspect` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` or `21:9` |
| `concept` | `true`/`false` — show a concept picture before building |
| `chatMode` | `auto`, `ask` (ask first), `go` (don't ask), `chat` (answers only, no changes) |
| `model` | `route`, `model` — the builder, e.g. `codex`, `gpt-6.1-terra` or `router`, `openai/gpt-6-astra` |
| `startFromPrompt` | — plan and build from `homePrompt` |

**Chat and building**

| Action | Arguments |
|---|---|
| `chat` | `text` — type into the chat box |
| `send` | — send it (a change, or a question in Chat only mode) |
| `answer` | `questionId`, `option` — answer one of the director's questions |
| `continueQuestions` | — continue with the answers (defaults for unanswered ones) |
| `startLength` | seconds — the home composer's shot length (the first move of a new set) |
| `escape` | — like pressing Esc (clears the selection, leaves a parked timeline) |
| `ownAnswer` | question id, text — your own answer on a question card |
| `requestRender` | — like pressing Render shot: opens the approve card (or renders when "always allow" is set) |
| `approveRender` | `true`/`false`, always? — answer the approve card (`render` itself renders without the card, for scripts) |
| `cameraToView` | — the selected camera moves to the current view (keeps its path keys) |
| `confirmChange` | `true` = apply, `false` = cancel the change waiting on the last confirm card (`ask` mode on a built set) |
| `buildThis` | — build the plan shown at the concept step |
| `undo`, `redo` | — step through versions |
| `version` | `index` — jump to a version |

**Filming and rendering**

| Action | Arguments |
|---|---|
| `camera` | camera name, e.g. `CAM_main` — the camera strip: a one-move shot follows it; with several moves the moves keep their cameras and the pick is what `addMove` uses |
| `move` | `index`, `move` — e.g. `0`, `drone-orbit` (33 moves, see `spike/scenekit/camera-moves.js`; `path` = your keyframes) |
| `seek` | `seconds` or `null` — park the timeline at that moment (people pose, the view shows the shot camera then) / unpark |
| `addKey`, `clearKeys` | — add the current view as a keyframe at the parked time (same time = re-frame it) / remove them |
| `viewFrom` | camera name — move only the orbit view to that camera (to frame a keyframe) |
| `length` | `index`, `seconds` |
| `addMove` | `move?`, `seconds?`, `camera?` — chain another move (shots up to 60 s) on `camera` (default: the strip's camera; `null` = the shot camera). A move on another camera than the move before is a hard **cut** to that camera |
| `moveCamera` | `index`, camera name or `null` — the camera of one move (`null` = the shot camera). Different from the move before = a cut there |
| `select` | `index` — select a move in the timeline |
| `preview` | — play the move in the viewport |
| `mode` | `lit` or `clay` |
| `highFps` | `true` / `false` / `null` — the 48 fps pill: also make a 48 fps copy of the render (`null` = automatic: on when the camera moves fast; `state().fps48` = `{on, auto, user, motion}`) |
| `render` | — render the shot (clay → look still → LTX video); the reference pictures go into the look still |
| `lookOnly` | — make only the shot's photoreal first frame (the same look call a render makes, with the reference pictures; no video). The request record is at `/api/shots/<id>/file/look_raw.json` |
| `resumeRender` | `shotId` — continue a render whose frames were already made |
| `showTake` | `index`, `final` / `clay` / `side` |
| `backToSet` | — leave the take view |
| `still` | — download a still of the current frame; while a take is shown, its photoreal first frame (PNG) |
| `glb` | `lit` or `clay` — download the set as GLB |

**Editing by hand**

| Action | Arguments |
|---|---|
| `editMode` | `translate`, `rotate`, `scale` or `null` (orbit) |
| `selectObject` | object name or `null`, `add?` — `add: true` = Shift-click: adds the object to the selection or takes it out again. Several selected = objects only: a light or camera is always selected alone |
| `selectMany` | `[names]` — select several objects at once (the gizmo sits at their centre) |
| `editSelected` | `{pos?: [x,y,z], rot?: [x,y,z] degrees, scale?: number}`; for several objects: `pos` = where the group's centre goes, `rot` / `scale` = the group gizmo's turn / size (one version for the whole group, like a gizmo drag) |
| `duplicate`, `deleteSelected` | — on every selected object, one version each |
| `addThing` | `person`, `cube`, `sphere`, `cylinder`, `cone`, `pyramid`, `point`, `spot`, `sun`, `camera`, `library` |
| `objectsPanel` | — show or hide the object list |
| `setLight` | `{type?, color?, intensity?, on?}` — change the selected light (one version per light; type point/spot/directional/area rebuilds it) |
| `scenePanel` | `true`/`false` |
| `sceneSettings` | `{exposure?, lights?, background?}` — e.g. `{exposure: 1.3, background: "#1b2433"}` |
| `library` | `query` — open / search the model library (then `POST /upload` imports a .glb / .fbx file) |
| `placeResult` | `index` — place a search result where the view looks |
| `packs` | — open the model packs view |

## Camera cuts

One shot can cut between cameras (a multi-shot preview). A shot is a chain of moves, written
`move:seconds[@CAM_x]+…`, e.g. `dolly-in:2+arc-left:2@CAM_table+pan-left:2@CAM_barrels`: two seconds of dolly on the shot
camera, then a cut to `CAM_table` arcing left, then a cut to `CAM_barrels` panning. Moves on the same camera chain
smoothly; a move on another camera starts at that camera's own pose. A move without `@` uses the shot camera, so shots
made before cuts are unchanged. The chat understands it too: "dolly in on the main camera for 4 s, then cut to the
close-up for 3 s". The render prompt describes the shots in order ("…; cut to a close-up of the bar as the camera arcs
left"). Every cut on a frame that is a multiple of 8 (whole seconds) starts a render part of its own, also in short
shots: each camera gets its own photoreal look still (people and the look carried over from the previous camera's last
frame), and the parts meet in a hard cut instead of a crossfade. Cuts on other frames stay inside a part. The 48 fps
copy never blends across a cut: the in-between frame at a cut is replaced by a neighbouring frame.

```bash
act '{"name":"openExample","args":["tavern"]}'
act '{"name":"move","args":[0,"dolly-in"]}'; act '{"name":"length","args":[0,2]}'
act '{"name":"addMove","args":["arc-left",2,"CAM_table"]}'
act '{"name":"addMove","args":["pan-left",2,"CAM_barrels"]}'
act '{"name":"seek","args":[2.0]}'                       # state.parkPose.cam == "CAM_table", parkPose.cut == true
```

## Examples

```bash
T=$(cat bench/logs/debug_api.token); A=127.0.0.1:3999
act() { curl -s -XPOST $A/act -H "X-Debug-Token: $T" -H 'content-type: application/json' -d "$1"; }

act '{"name":"homePrompt","args":["A foggy pier at dawn with fishing boats"]}'
act '{"name":"chatMode","args":["go"]}'
act '{"name":"startFromPrompt","settle":true}'          # plan + build; returns when the set is ready
act '{"name":"move","args":[0,"crane-up"]}'
act '{"name":"render","settle":true}'                   # returns when the video is done
```

Whole flows as scripts: `bench/e2e_ui.py` (prompt → build → shot, `--prompt`, `--ref`, `--aspect`, `--move`,
`--seconds`, `--no-render`), `bench/e2e_refs.py` (reference pictures), `bench/e2e_edit.py` (hand editing), `bench/e2e_cuts.py` (camera cuts inside one shot), `bench/e2e_library.py` (model library),
`bench/e2e_p7.py` (scene settings and chat modes), `bench/e2e_multiselect.py` (multi-select with real clicks and gizmo
drags).
