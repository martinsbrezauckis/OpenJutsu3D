# Open 3D Jutsu

Describe a place. It gets planned, built as a real 3D set, filmed with a camera move you pick, and rendered as a
photoreal video shot that moves exactly like the 3D layout.

An open rebuild of the *3D set → camera move → photoreal shot* workflow, made for the Comfy
**Open Source Higgsfield** hackathon (#OpenSourceHiggsfield).

## How it works

```
prompt ─▶ director ─▶ concept picture ─▶ builder writes the set ─▶ you pick camera + move
          (plan, or     (is this your        (Scene Kit code,          (33 moves, chain them,
           ≤3 questions)  idea?)              built live in 3D)          up to 15 s)
                                                                              │
photoreal shot ◀── LTX-2.5 Layout-To-Render ◀── look still ◀── clay + lit frames rendered in your browser
                   (follows the clay video         (frame 0 made photoreal,
                    frame by frame)                 nothing added)
```

1. **Director** turns your prompt (and an optional reference picture for style) into a build plan: layout, sizes,
   counts, light, cameras. It asks at most three short questions, and only when the idea is unclear.
2. **Concept picture** shows the plan as one image before anything is built.
3. **Builder** writes the set as JavaScript against the Scene Kit (`spike/scenekit/kit.js`): objects from primitives,
   textured PBR materials (CC0 Poly Haven), lights, readable text, terrain, water, cameras. It builds in steps, so you
   watch the set appear.
4. **You film it**: pick a camera, a move (dolly, crane, arc, orbit, dolly zoom, handheld …), chain moves, set the length
   and the frame format (16:9, 9:16, 1:1). Edit by chat ("make it darker, add a second cage") or by hand.
5. **Render**: the browser renders the move as a grey *clay* video and a colour frame; an image model makes frame 0
   photoreal; **LTX-2.5 Layout-To-Render** renders the full shot so it keeps the clay's layout and camera exactly.

## Features

- Prompt or reference picture → planned, live-built 3D set; concept picture first (optional).
- Chat modes: Auto, Ask first, Don't ask, Chat only (answers about the set without changing it).
- 33 camera moves, chained moves, timeline with playhead and real-time preview, shots up to 60 s (longer than 15 s
  renders in overlapping parts that are crossfaded).
- Frame formats 16:9, 9:16 and 1:1 (rendered natively by LTX).
- Hands-on editing in the viewport: select (click or object list), move / rotate / scale gizmo, duplicate, delete, add
  shapes, point / spot / sun lights and a camera at the current view.
- Asset library with model packs: a small built-in Samples pack (Poly Haven, CC0); add more yourself — Poly Haven's
  library in one click, a pack from a link (.glb / .zip) or a folder on your computer, or single GLB files. Each pack
  keeps its licence and credit and can be kept out of the builder. Models are placed where you look, at real size; the
  builder also places matching models by itself.
- Scene properties: exposure, light strength, background colour.
- Undo / redo and full version history; every scene is saved in **My scenes**.
- Takes with Final / Clay / Side-by-side view; downloads: video, still, GLB with materials and textures.
- Cost shown per step and per scene (Router credits as priced per call), with an estimate from your recent runs.
- Automation API: every UI action can be driven from a script, with a screenshot after each step (`bench/debug_api.py`).

## Built with

- **Comfy Router** (through the **Comfy SDK**, `@comfyorg/sdk`): director, builder and image models — one key.
- **Comfy SDK workflow jobs**: the LTX-2.5 Layout-To-Render graph (`web/workflows/l2r.api.json`), on a Comfy deployment
  or your own ComfyUI behind `comfy-api-proxy`.
- **LTX-2.5** (Lightricks, open weights) with the Layout-To-Render IC-LoRA.
- **three.js** (Scene Kit, viewport, clay/lit renders, GLB export), **Next.js 16** + React 19.

Model routes, chosen per stage in the app:

| Route | What it uses | Cost |
|---|---|---|
| Comfy Router (default) | `COMFY_API_KEY`; GPT 6 Sol / Astra, Claude, Gemini, GPT Image 2.5 … | Comfy credits per call |
| Codex CLI | your ChatGPT subscription through the `codex` CLI (local use) | no per-call cost |
| OpenAI API | `OPENAI_API_KEY`, for models Router does not carry yet (e.g. GPT 6.1 Terra) | OpenAI per token |

## Setup

Needs Node ≥ 22.6, Python 3 (texture download), ffmpeg on `PATH`, and somewhere to run the LTX workflow.

```bash
git clone <this repo> && cd <repo>
python3 -I spike/scenekit/fetch_textures.py        # CC0 textures from Poly Haven (~50 MB, once)
cd web && npm install
cp .env.example .env.local                          # then fill in the keys below
npm run dev                                         # http://127.0.0.1:3000
```

`.env.local`:

- `COMFY_API_KEY` — from <https://platform.comfy.org/profile/api-keys> (Router + workflow jobs).
- `COMFY_BASE_URL` — where the LTX workflow runs: a Comfy deployment URL, or a local ComfyUI behind
  [`comfy-api-proxy`](https://github.com/Comfy-Org/comfy-api-proxy) (e.g. `http://127.0.0.1:8189`). The local ComfyUI
  needs the LTX-2.5 22B distilled model, its spatial upscaler and the Layout-To-Render IC-LoRA (about 85 GB of VRAM at
  1920×1088 in bf16).
- Optional: `LLM_PROVIDER=codex` with `CODEX_HOME` to use a Codex subscription; `OPENAI_API_KEY` for the OpenAI route.
- Model packs are added in the app (Add › Model from the library › Packs). For a large local collection, e.g.
  [Scenario's 3D Collection](https://huggingface.co/datasets/scenario-labs/3d-collection) (CC BY 4.0, ~37 GB), add its
  folder; `bench/build_library.py` + `bench/caption_library.py` can first give its models names and real sizes
  (any OpenAI-compatible vision model).

`npm test` (in `web/`) runs the type check and the offline tests (cost metering, OpenAI route against a mock server).

The app listens on 127.0.0.1 only and refuses cross-site requests; builder-written scene code runs in a sandboxed
iframe with no access to the app.

## Automation API

Every action in the app can be driven by a script or an AI agent over a local, token-protected HTTP API, with the
app's state and a screenshot after each step: build sets, edit them, film and render shots, manage model packs.
Start it with `python3 bench/debug_api.py`; the full action list and examples are in
[docs/public/AUTOMATION.md](docs/public/AUTOMATION.md). `bench/e2e_ui.py` runs a whole shot
(`--prompt "…" [--ref picture.jpg] [--aspect 9:16]`).

## Licence

Code: MIT (see `LICENSE`). Bundled: three.js (MIT), Droid Sans Bold font (Apache-2.0, `spike/scenekit/assets/fonts`).
Bundled: 16 sample models from Poly Haven (CC0, `web/packs/samples`). Downloaded on setup: Poly Haven textures (CC0).
Model packs you add keep their own licences; the app shows each pack's credit. Models (LTX-2.5, Router models) are used under their providers' terms.
