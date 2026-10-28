// sync-kit.mjs — copy the Scene Kit (viewer-core, kit, camera moves, materials, prompts, textures) from
// ../spike/scenekit into public/scenekit so the app serves the exact renderer the bench tests.
// Runs before `dev` and `build`. Textures are fetched separately (see README: scripts/fetch-textures).
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "..", "spike", "scenekit"), dst = join(root, "public", "scenekit");
mkdirSync(dst, { recursive: true });
for (const f of ["viewer-core.js", "kit.js", "camera-moves.js", "prompt-compiler.js", "studio.html", "materials.json", "BUILDER_PROMPT.md", "DIRECTOR_PROMPT.md"])
  cpSync(join(src, f), join(dst, f));
if (existsSync(join(src, "assets", "textures"))) cpSync(join(src, "assets", "textures"), join(dst, "assets", "textures"), { recursive: true });
if (existsSync(join(src, "assets", "fonts"))) cpSync(join(src, "assets", "fonts"), join(dst, "assets", "fonts"), { recursive: true });
console.log("scene kit synced →", dst);
