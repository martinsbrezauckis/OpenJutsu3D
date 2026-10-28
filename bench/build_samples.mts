// build_samples.mts — the app's built-in "Samples" pack: a few Poly Haven models (CC0, polyhaven.com) packed to GLB
// (1k textures) with thumbnails and an index (names, tags, real heights). Output: web/packs/samples/.
// Run: node bench/build_samples.mts [ids…]    (network: api.polyhaven.com, dl.polyhaven.org, cdn.polyhaven.com)
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, "..", "web", "packs", "samples");
const { gltfToGlb } = await import(join(here, "..", "web", "lib", "gltf-pack.ts"));
const UA = { "User-Agent": "open-3d-jutsu (samples pack build)" };
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ["Barrel_01", "wooden_crate_02", "wooden_lantern_01", "Lantern_01",
  "street_lamp_02", "painted_wooden_chair_01", "WoodenTable_01", "Sofa_01", "Shelf_01", "planter_pot_clay",
  "anthurium_botany_01", "fern_02", "Television_01", "industrial_wall_lamp", "CoffeeCart_01", "wine_barrel_01"];
const get = async (u: string) => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r; };
mkdirSync(out, { recursive: true });
const list = await (await get("https://api.polyhaven.com/assets?t=models")).json();
const index = [];
for (const id of IDS) {
  const a = list[id]; if (!a) { console.log("missing", id); continue; }
  const g = (await (await get(`https://api.polyhaven.com/files/${id}`)).json())?.gltf?.["1k"]?.gltf;
  const glb: Uint8Array = await gltfToGlb(await (await get(g.url)).json(), async (uri: string) => new Uint8Array(await (await get(g.include[uri].url)).arrayBuffer()));
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  writeFileSync(join(out, `${slug}.glb`), glb);
  writeFileSync(join(out, `${slug}.png`), new Uint8Array(await (await get(`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`)).arrayBuffer()));
  index.push({ id: slug, file: `${slug}.glb`, preview: `${slug}.png`, name: a.name.replace(/_/g, " ").replace(/\s+0?(\d+)$/, " $1"), tags: (a.tags ?? []).slice(0, 8),
    category: a.categories?.[0], height_m: a.dimensions ? Math.round(a.dimensions[2] / 10) / 100 : undefined, style: "realistic", bytes: glb.length, source: `https://polyhaven.com/a/${id}` });
  console.log(slug, (glb.length / 1e6).toFixed(1), "MB");
}
writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 1));
writeFileSync(join(out, "LICENSE.txt"), "Models in this folder: Poly Haven (https://polyhaven.com), CC0 1.0 Universal (public domain).\nEach entry's source page is listed in index.json.\n");
console.log(index.length, "models,", (index.reduce((s, x) => s + x.bytes, 0) / 1e6).toFixed(1), "MB total");
