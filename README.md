# OpenJutsu3D

Describe a place. It gets planned, built as a real 3D set, filmed with a camera move you pick, and rendered as a
photoreal video shot that moves exactly like the 3D layout.

An open alternative to Higgsfield's 3D Jutsu: the *3D set → camera move → photoreal shot* workflow, built for the
Comfy **Open Source Higgsfield** challenge (#OpenSourceHiggsfield). An independent project, not affiliated with
Higgsfield, and separate from Comfy's own `comfy-openjutsu` starter app.

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

1. **Director** turns your prompt (and up to 5 optional reference pictures) into a build plan: layout, sizes,
   counts, light, cameras. It asks at most three short questions, and only when the idea is unclear.
2. **Concept picture** shows the plan as one image before anything is built.
3. **Builder** writes the set as JavaScript against the Scene Kit (`spike/scenekit/kit.js`): objects from primitives,
   textured PBR materials (CC0 Poly Haven), lights, readable text, terrain, water, cameras. It builds in steps, so you
   watch the set appear.
4. **You film it**: pick a camera, a move (dolly, crane, arc, orbit, dolly zoom, handheld …), chain moves, set the length
   and the frame format (16:9, 9:16, 1:1). Edit by chat ("make it darker, add a second cage") or by hand.
5. **Render**: the browser renders the move as a grey *clay* video and a colour frame; an image model makes frame 0
   photoreal (your reference pictures shape how people, things and the place look); **LTX-2.5 Layout-To-Render** renders the full shot so it keeps the clay's layout and camera exactly.

## Features

- Prompt or reference picture → planned, live-built 3D set; concept picture first (optional).
- Up to 5 reference pictures (pick or drop them, label what each shows): they guide the plan, the build and the
  photoreal first frame of every render. A concept picture, a look still or a take's frame can be reused as one.
- Chat modes: Auto, Ask first (every change to a built set waits for Apply / Cancel), Don't ask, Chat only (answers
  about the set without changing it).
- 33 camera moves plus your own camera path: scrub the timeline to a moment, frame the view and add a keyframe there
  (the camera passes through it at that time); chained moves, real-time preview, shots from 1 s up to 60 s (longer
  than 15 s renders in overlapping parts that are crossfaded).
- Camera cuts inside one shot: give a move another camera ("Camera of this move", or "then cut to the close-up for
  3 s" in chat) and the shot cuts there, like a multi-shot preview. Each camera gets its own photoreal look still,
  and the cuts stay hard cuts in the final video.
- The shot from your words: a prompt or chat line such as "8 seconds, slow 360-degree orbit" or "dolly in for 5 s,
  then crane up" sets the shot; "film it" renders it.
- Frame formats 16:9, 9:16, 1:1, 4:3, 3:4 and 21:9 (2.35:1), all rendered natively by LTX.
- People: animated actors (walk a path — also up stairs and slopes —, stand, talk, sit, jog, dance …) that the
  builder stages from your words or that you add by hand; every frame of a shot shows the same pose, so the render
  follows them exactly. Walkers keep a natural pace (a long shot on a short path walks it round or back and forth, not
  in slow motion) and ease into turns. Clothes are painted onto the moving body, so sleeves and trousers move with the
  limbs; helmets, masks and backpacks ride the head or chest; crates and trays are held in both hands, cans and bags
  hang from one hand.
- Your own characters: import a rigged character as .glb or .fbx (e.g. downloaded from Mixamo); it plays its own
  motion, and a motion file imported with a person selected gives that person the motion (motions from one Mixamo
  character fit the others). We ship no Mixamo files — bring your own.
- Hands-on editing in the viewport: select (click or object list; Shift / Ctrl / Cmd-click selects several objects and
  moves, rotates, scales, duplicates or deletes them together as one step), move / rotate / scale gizmo for objects,
  lights and cameras, duplicate, delete, add a person, shapes, point / spot / sun lights and a camera at the current view; Esc
  returns to orbit. Lights and cameras show as icons in the view; a selected light has type (point, spot, sun, area),
  colour, brightness and on/off; a selected camera can jump to the current view. The Objects list is grouped by kind.
- Asset library with model packs: a small built-in Samples pack (Poly Haven, CC0); add more yourself — Poly Haven's
  library in one click, a pack from a link (.glb / .zip) or a folder on your computer, or single GLB files. Each pack
  keeps its licence and credit and can be kept out of the builder. Models are placed where you look, at real size; the
  builder also places matching models by itself.
- Scene properties: exposure, light strength, background colour.
- Undo / redo and full version history (editing an older version restores it as the newest — nothing is lost);
  every scene is saved in **My scenes**; Share saves a scene file that anyone can open in OpenJutsu3D.
- Self-repair: builder code that fails to run is sent back once with the exact error; anything still missing is said
  in the chat.
- 48 fps for fast camera moves: the shot bar's **48 fps** pill turns on by itself when the planned camera path moves
  fast (whip pan, bullet time, robot arm, quick orbits) and adds a 48 fps copy next to the 24 fps video; you can
  switch it on or off for any shot. The in-between frames come from ComfyUI's built-in frame interpolation (RIFE) when
  your ComfyUI has a model in `models/frame_interpolation` (seconds on a GPU), otherwise from ffmpeg's motion-compensated
  interpolation on the app server (no GPU, about a minute for a 5 s shot).
- Render shot first shows what will be made (model, size, fps, rough time and file size) to approve, or always allow.
- Takes with Final / Clay / Side-by-side view; downloads: video, still, GLB with materials and textures. A render
  that stops after its frames were made (e.g. the render server went away) continues from them when you press
  Render shot again.
- Cost shown per step and per scene (Router credits as priced per call), with an estimate from your recent runs.
- Automation API: every UI action can be driven from a script, with a screenshot after each step (`bench/debug_api.py`).

## Built with

- **Comfy Router** (through the **Comfy SDK**, `@comfyorg/sdk`): director, builder and image models — one key.
- **Comfy SDK workflow jobs**: the LTX-2.5 Layout-To-Render graph (`web/workflows/l2r.api.json`), on a Comfy deployment
  or your own ComfyUI behind `comfy-api-proxy`.
- **LTX-2.5** (Lightricks, open weights) with the Layout-To-Render IC-LoRA.
- **three.js** (Scene Kit, viewport, clay/lit renders, GLB export), **Next.js 16** + React 19.

Model routes, chosen with the model picker in the app (planning and the look still follow the picked route; a route
with no image model hands the look still to one that has):

| Route | What it uses | Cost |
|---|---|---|
| Comfy Router | `COMFY_API_KEY`; the OpenAI text and GPT Image models in Router's live catalog | Comfy credits per call |
| Codex CLI | your ChatGPT subscription through the `codex` CLI (local use); text + GPT Image | no per-call cost |
| Claude Code | your Claude subscription through the `claude` CLI (local use); Opus / Sonnet / Haiku, text only | no per-call cost |
| Antigravity CLI | your Google subscription through the `agy` CLI (local use); Gemini, Claude, GPT-OSS + Nano Banana images | no per-call cost |
| OpenAI API | `OPENAI_API_KEY`; the models your key lists | OpenAI per token |
| Anthropic API | `ANTHROPIC_API_KEY`; the Claude models your key lists (text only) | Anthropic per token |
| Google Gemini API | `GEMINI_API_KEY`; Gemini text models + Gemini image models (Nano Banana) | Google per token |
| Open model server | `LOCAL_LLM_BASE_URL` (+ `LOCAL_LLM_API_KEY`): any OpenAI-compatible server — your own Ollama, vLLM, LM Studio, llama.cpp, or a hosted open-weights provider (OpenRouter, Together, Fireworks, Groq, DeepInfra…); text | free on your own GPU / provider's price |

There is no fixed model list: each route reports the models it offers (Router its catalog, the CLIs their own lists,
OpenAI, Anthropic and Google their model lists) and the picker shows them all. The CLIs use their own login — OpenJutsu3D never signs in for you;
a CLI that is not installed or not logged in shows as "not available", as does a route without its key. Video is not a
free choice: the Layout-To-Render LoRA is what makes LTX follow the 3D layout frame by frame.

Run modes (the agent = text and image models; video = where LTX-2.5 runs, set by `COMFY_BASE_URL`):

| Agent | Video | Status |
|---|---|---|
| Codex CLI subscription | your own ComfyUI (local GPU or a LAN box) | tested end to end — every demo shot |
| Claude Code subscription (look still from another route) | your own ComfyUI | set built end to end in the app |
| Antigravity CLI subscription | your own ComfyUI | text and image calls tested; full build not yet run |
| Comfy Router (credits) | your own ComfyUI | plan, concept picture and set built end to end in the app (GPT 6 Astra + GPT Image; one set ≈ $5 of credits) |
| OpenAI API (own key) | your own ComfyUI | text tested live and against a mock server; image + full build not yet run |
| Anthropic API (own key) | your own ComfyUI | model list and a text call tested live, plus a mock server; full build not yet run |
| Google Gemini API (own key) | your own ComfyUI | model list tested live; text and image against a mock server (live calls hit Google's free-tier limit / high demand) |
| Open model server (e.g. Qwen 3.8 in llama.cpp on your GPU, Ollama) | your own ComfyUI | text call tested live (Ollama), model list live (llama.cpp Qwen), mock server; full build in progress |
| any of the above | Comfy Cloud / a Comfy deployment (`COMFY_BASE_URL` empty or a deployment URL) | not yet run: needs the LTX-2.5 22B model and the Layout-To-Render IC-LoRA there |

The open model server is how you run the agent on open weights (e.g. Qwen on your own GPU). Whether a model writes a
good set is up to the model: small models build simple or broken sets. The look still still needs an image model from
another route (not yet open-weights in this app). Not available yet: Claude/Gemini models through Router (they need
their own request format).

Example sets open instantly from the start page; the masquerade ball ships with its finished 28 s LTX render
([`web/public/examples/masquerade.mp4`](web/public/examples/masquerade.mp4)), made in this app from that set.

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
  1920×1088 in bf16). Only core ComfyUI nodes are used (no custom nodes; tested on ComfyUI of 2026-10-15). Files, as
  named in `web/workflows/l2r.api.json`, under `ComfyUI/models/`:
  `diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors`,
  `text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors`,
  `vae/ltx-2.5-video-vae-bf16.safetensors`, `vae/ltx-2.5-audio-vae-bf16.safetensors`,
  `latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors`,
  `loras/ltx-2.5-22b-ic-lora-layout-to-render-1.0.safetensors`.
- Optional: `LLM_PROVIDER=codex` (or `claude`, `agy`) to prefer a subscription CLI; `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `GEMINI_API_KEY` for the own-key routes.
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

Code: MIT (see `LICENSE`). Bundled: three.js (MIT), Droid Sans Bold font (Apache-2.0, `spike/scenekit/assets/fonts`),
the animated mannequin from Quaternius' Universal Animation Library (CC0, `spike/scenekit/assets/characters`).
Bundled: 16 sample models from Poly Haven (CC0, `web/packs/samples`). Downloaded on setup: Poly Haven textures (CC0).
Model packs you add keep their own licences; the app shows each pack's credit. Models (LTX-2.5, Router models) are used under their providers' terms.
