# Security

## Reporting a problem

Please report security problems privately, not in a public issue:

- through GitHub's private vulnerability reporting on this repository (Security › Report a vulnerability), or
- by email to martins.brezauckis@gmail.com.

Say what you found and how to reproduce it. You will get an answer within a few days.

## What is in scope

OpenJutsu3D's own code in this repository: the web app (`web/`), the Scene Kit (`spike/scenekit/`) and the
automation scripts (`bench/`). Problems in ComfyUI, the Comfy SDK, Comfy Router, LTX or the model providers belong to
those projects.

## How OpenJutsu3D is built

- **A local tool.** The app listens on 127.0.0.1 only. It is not hardened for exposure to the internet; put your
  own authentication in front of it before you do that.
- **Keys stay on the server.** `COMFY_API_KEY` and `OPENAI_API_KEY` are read from the environment by the Next.js
  server and never sent to the browser.
- **Generated scene code runs in the browser only**, inside the 3D viewer, with the Scene Kit as its only input.
- **Downloads are checked.** Model packs are fetched only from public addresses (private,
  loopback and link-local addresses are refused), zip archives are size- and path-checked before unpacking, and
  uploaded frames are checked by their bytes, not their declared type.
- **The automation API is a development tool.** `bench/debug_api.py` listens on 127.0.0.1 and needs a token.
