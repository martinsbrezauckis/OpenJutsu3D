#!/usr/bin/env python3
"""caption_library.py — short name, category, tags and real-world height for each model in library.json (P9).

Looks at each model's preview.jpg (plus its generation prompt when there is one) with a vision LLM on an
OpenAI-compatible endpoint (default: the local Qwen3.8-27B judge, see bench/judge.py) and appends one JSON line per
model to <dir>/captions.jsonl — resumable: models already captioned are skipped. merge() folds the captions into
library.json (name, category, tags, height_m) for the app's search and for placing models at a believable size.

Usage: python3 bench/caption_library.py <collection-dir> <library-dir> [--base-url URL] [--model NAME] [--merge-only]
"""
import argparse, base64, io, json, pathlib, sys, time, urllib.request

from PIL import Image

CATS = ["prop", "furniture", "building", "vehicle", "plant", "rock", "character", "creature", "food", "weapon", "other"]
ASK = ("You catalogue 3D models for a film set builder. Look at the preview of ONE 3D model{hint}. Answer ONLY with JSON: "
       '{"name": "2-4 plain words, e.g. wooden barrel", "category": one of ' + json.dumps(CATS) + ', '
       '"tags": [3-6 lowercase words for search: material, style, use], '
       '"height_m": its believable real-world height in metres as a number (a mug 0.1, a chair 0.9, a door 2.1, a car 1.5, a house 7), '
       '"style": "realistic" or "stylized"}')


def thumb(p: pathlib.Path) -> str:
    im = Image.open(p).convert("RGB"); im.thumbnail((448, 448))
    b = io.BytesIO(); im.save(b, "JPEG", quality=85); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def ask(base, model, item, root):
    hint = f' (it was generated from the prompt: "{item["prompt"][:300]}")' if item.get("prompt") else ""
    body = {"model": model, "max_tokens": 300, "temperature": 0, "chat_template_kwargs": {"enable_thinking": False},
            "messages": [{"role": "user", "content": [{"type": "text", "text": ASK.replace("{hint}", hint)},
                                                      {"type": "image_url", "image_url": {"url": thumb(root / item["preview"])}}]}]}
    req = urllib.request.Request(f"{base}/chat/completions", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    txt = json.load(urllib.request.urlopen(req, timeout=300))["choices"][0]["message"]["content"]
    j = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    h = float(j.get("height_m") or 1)
    return {"name": str(j.get("name", ""))[:60], "category": j.get("category") if j.get("category") in CATS else "other",
            "tags": [str(t)[:24] for t in (j.get("tags") or [])][:6], "height_m": round(min(60.0, max(0.02, h)), 2),
            "style": "stylized" if j.get("style") == "stylized" else "realistic"}


def merge(lib: pathlib.Path):
    items = json.loads((lib / "library.json").read_text())
    caps = {}
    for line in (lib / "captions.jsonl").read_text().splitlines() if (lib / "captions.jsonl").exists() else []:
        c = json.loads(line); caps[c["id"]] = c
    for it in items: it.update({k: v for k, v in caps.get(it["id"], {}).items() if k != "id"})
    (lib / "library.json").write_text(json.dumps(items, indent=0))
    return sum(1 for it in items if it.get("name"))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("root", type=pathlib.Path); ap.add_argument("lib", type=pathlib.Path)
    ap.add_argument("--base-url", default="http://127.0.0.1:18030/v1"); ap.add_argument("--model", default="qwen3.8-27b-nvfp4")
    ap.add_argument("--merge-only", action="store_true"); a = ap.parse_args()
    if not a.merge_only:
        items = json.loads((a.lib / "library.json").read_text())
        done = set()
        cap = a.lib / "captions.jsonl"
        if cap.exists(): done = {json.loads(l)["id"] for l in cap.read_text().splitlines() if l.strip()}
        t0, n = time.time(), 0
        with cap.open("a") as f:
            for it in items:
                if it["id"] in done: continue
                try: c = ask(a.base_url, a.model, it, a.root)
                except Exception as e: print(json.dumps({"id": it["id"], "error": str(e)[:200]}), flush=True); continue
                f.write(json.dumps({"id": it["id"], **c}) + "\n"); f.flush(); n += 1
                if n % 25 == 0: print(json.dumps({"captioned": len(done) + n, "of": len(items), "s_per_item": round((time.time() - t0) / n, 1)}), flush=True)
    print(json.dumps({"merged_named": merge(a.lib)}))


if __name__ == "__main__":
    main()
