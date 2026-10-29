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
| `POST /upload {path, wait?}` | Give a file to the open Import input of the model library (open it first with `library`); waits until the import is done. The file must lie under `bench/out`. |
| `GET /state` | The app's state: view, scene, versions, camera, recipe, takes, chat, edit state. |
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
| `openExample` | `id`: `dungeon`, `neon`, `city`, `moon` |
| `openBlank` | — an empty studio |
| `openSaved` | `id` of a saved scene |
| `openSceneText` | `text`, `name?` — open a shared scene file's JSON as a new scene |
| `shareFile` | — download the open scene as a scene file |
| `homePrompt` | `text` — type the first prompt on the start page |
| `ref` | `dataUrl` (PNG/JPEG data: URL) or `null` — reference picture for the style |
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
| `buildThis` | — build the plan shown at the concept step |
| `undo`, `redo` | — step through versions |
| `version` | `index` — jump to a version |

**Filming and rendering**

| Action | Arguments |
|---|---|
| `camera` | camera name, e.g. `CAM_main` |
| `move` | `index`, `move` — e.g. `0`, `drone-orbit` (33 moves, see `spike/scenekit/camera-moves.js`; `path` = your keyframes) |
| `seek` | `seconds` or `null` — park the timeline at that moment (people pose, the view shows the shot camera then) / unpark |
| `addKey`, `clearKeys` | — add the current view as a keyframe at the parked time (same time = re-frame it) / remove them |
| `viewFrom` | camera name — move only the orbit view to that camera (to frame a keyframe) |
| `length` | `index`, `seconds` |
| `addMove` | `move?`, `seconds?` — chain another move (shots up to 60 s) |
| `select` | `index` — select a move in the timeline |
| `preview` | — play the move in the viewport |
| `mode` | `lit` or `clay` |
| `render` | — render the shot (clay → look still → LTX video) |
| `resumeRender` | `shotId` — continue a render whose frames were already made |
| `showTake` | `index`, `final` / `clay` / `side` |
| `backToSet` | — leave the take view |
| `still` | — download a still of the current frame |
| `glb` | `lit` or `clay` — download the set as GLB |

**Editing by hand**

| Action | Arguments |
|---|---|
| `editMode` | `translate`, `rotate`, `scale` or `null` (orbit) |
| `selectObject` | object name or `null` |
| `editSelected` | `{pos?: [x,y,z], rot?: [x,y,z] degrees, scale?: number}` |
| `duplicate`, `deleteSelected` | — on the selected object |
| `addThing` | `person`, `cube`, `sphere`, `cylinder`, `cone`, `pyramid`, `point`, `spot`, `sun`, `camera`, `library` |
| `objectsPanel` | — show or hide the object list |
| `setLight` | `{color?, intensity?, on?}` — change the selected light (one version per light) |
| `scenePanel` | `true`/`false` |
| `sceneSettings` | `{exposure?, lights?, background?}` — e.g. `{exposure: 1.3, background: "#1b2433"}` |
| `library` | `query` — open / search the model library (then `POST /upload` imports a .glb / .fbx file) |
| `placeResult` | `index` — place a search result where the view looks |
| `packs` | — open the model packs view |

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
`--seconds`, `--no-render`), `bench/e2e_edit.py` (hand editing), `bench/e2e_library.py` (model library),
`bench/e2e_p7.py` (scene settings and chat modes).
