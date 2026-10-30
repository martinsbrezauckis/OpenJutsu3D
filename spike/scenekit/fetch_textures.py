#!/usr/bin/env python3
"""fetch_textures.py — download the CC0 Poly Haven textures referenced by materials.json.

For every preset with a "tex" id, fetches the asset's real-world dimensions (so textures tile at true
scale) and its 1k JPG maps: diffuse, OpenGL normal, roughness (+ metal when present).
Writes:  assets/textures/<id>/{diff,nor_gl,rough[,metal]}.jpg
         assets/textures/manifest.json   {id: {"size_m": [w, h], "maps": [...], "license": "CC0", "source": url}}
Usage:   python3 -I fetch_textures.py [--res 1k|2k]
Network: api.polyhaven.com + dl.polyhaven.org only. Idempotent: existing files are skipped.
Callers: run once per machine before opening viewer.html with textures enabled.
"""
import json
import pathlib
import sys
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "assets" / "textures"
RES = sys.argv[sys.argv.index("--res") + 1] if "--res" in sys.argv else "1k"
# Poly Haven map keys -> our file names. 'Rough' and 'Metal' may be absent for some assets.
MAPS = {"Diffuse": "diff", "nor_gl": "nor_gl", "Rough": "rough", "Metal": "metal"}
UA = {"User-Agent": "openjutsu-scenekit/0.1"}


def get_json(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def main() -> int:
    lib = json.loads((HERE / "materials.json").read_text())
    ids = sorted({v["tex"] for k, v in lib.items() if isinstance(v, dict) and "tex" in v})
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    failed = []
    for tid in ids:
        try:
            info = get_json(f"https://api.polyhaven.com/info/{tid}")
            files = get_json(f"https://api.polyhaven.com/files/{tid}")
            # dimensions are in millimetres [w, h]; default 2 m if the asset has none.
            dims = info.get("dimensions") or [2000, 2000]
            size_m = [round(dims[0] / 1000, 3), round(dims[1] / 1000, 3)]
            got = []
            for key, name in MAPS.items():
                entry = files.get(key, {}).get(RES, {}).get("jpg")
                if not entry:
                    continue
                dest = OUT / tid / f"{name}.jpg"
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    with urllib.request.urlopen(urllib.request.Request(entry["url"], headers=UA), timeout=120) as r:
                        dest.write_bytes(r.read())
                got.append(name)
            if "diff" not in got:
                raise RuntimeError(f"no diffuse map at {RES}")
            manifest[tid] = {"size_m": size_m, "maps": got, "license": "CC0",
                             "source": f"https://polyhaven.com/a/{tid}"}
            print(f"ok   {tid:28s} {size_m} {got}")
        except Exception as e:  # report and continue: one bad asset must not block the library
            failed.append(tid)
            print(f"FAIL {tid}: {e}")
    manifest_path.write_text(json.dumps(manifest, indent=1))
    print(f"{len(ids) - len(failed)}/{len(ids)} textures ready in {OUT}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
