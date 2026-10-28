#!/usr/bin/env python3
"""build_library.py — catalog of a local 3D model collection for the app's asset library (P9).

Source: Scenario's "3D Collection" (huggingface.co/datasets/scenario-labs/3d-collection, CC BY 4.0, credit "Scenario"),
downloaded locally. Its parquet index names assets by their original paths, while a local copy may use other folder
names, so rows are matched to local folders by the SHA-256 of preview.jpg. Only entries with a GLB are kept.
Writes <out>/library.json: [{id, glb, preview, prompt, workflow, model, license}] (paths relative to the collection).
Names, tags and real-world sizes are added by bench/caption_library.py.

Usage: <python with pyarrow> bench/build_library.py <collection-dir> <out-dir>
"""
import ast, hashlib, json, pathlib, sys

import pyarrow.parquet as pq


def main():
    root, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    rows = pq.read_table(root / "data" / "train-00000-of-00001.parquet",
                         columns=["id", "workflow", "model", "prompt", "formats", "license", "preview_file"]).to_pylist()
    by_sha = {}
    for r in rows:
        pf = r["preview_file"] if isinstance(r["preview_file"], dict) else ast.literal_eval(r["preview_file"] or "{}")
        if pf.get("sha256"): by_sha[pf["sha256"]] = r
    items, unmatched = [], 0
    for d in sorted((root / "assets").iterdir()):
        prev, glbs = d / "preview.jpg", sorted(d.glob("*.glb"))
        if not prev.exists() or not glbs: continue
        r = by_sha.get(hashlib.sha256(prev.read_bytes()).hexdigest())
        if not r: unmatched += 1
        prompt = (r or {}).get("prompt")
        items.append({"id": d.name, "glb": str(glbs[0].relative_to(root)), "preview": str(prev.relative_to(root)),
                      "bytes": glbs[0].stat().st_size,
                      "prompt": None if prompt in (None, "None", "") else prompt, "workflow": (r or {}).get("workflow"),
                      "model": (r or {}).get("model"), "license": (r or {}).get("license") or "cc-by-4.0"})
    (out / "library.json").write_text(json.dumps(items, indent=0))
    print(json.dumps({"glb_items": len(items), "unmatched_previews": unmatched, "with_prompt": sum(1 for i in items if i["prompt"]),
                      "total_gb": round(sum(i["bytes"] for i in items) / 1e9, 1), "out": str(out / "library.json")}))


if __name__ == "__main__":
    main()
