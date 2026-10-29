#!/usr/bin/env python3
"""e2e_ui.py — full end-to-end run of the web app through the Debug API (bench/debug_api.py must be running).

prompt → director (answers any questions with their defaults) → concept picture (optional) → batched build →
camera + move → render (clay frames → look still → LTX L2R video). Every step prints one JSON line with the
state summary and the screenshot path; the run stops at the first failed step (exit 1).

  python3 bench/e2e_ui.py --prompt "..." [--concept] [--route codex --model gpt-6.1-terra] [--move drone-orbit]
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
# A second automation server (another port, own browser) runs a parallel job: O3J_API_PORT=3998 python3 bench/…
PORT = int(os.environ.get("O3J_API_PORT", "3999"))
API = f"http://127.0.0.1:{PORT}"
TOKEN = (ROOT / "bench" / "logs" / ("debug_api.token" if PORT == 3999 else f"debug_api.{PORT}.token")).read_text().strip()


def call(path: str, body: dict | None = None, timeout: float = 3700) -> dict:
    req = urllib.request.Request(API + path, method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Debug-Token": TOKEN, "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
    except urllib.error.HTTPError as e: return json.load(e)


def summary(d: dict) -> dict:
    s = d.get("state") or {}
    sc = s.get("scene") or {}
    last = (s.get("msgs") or [{}])[-1]
    return {"ok": d.get("ok"), "view": s.get("view"), "busy": s.get("busy"), "built": s.get("built"),
            "objects": (sc.get("stats") or {}).get("objects"), "cameras": sc.get("cameras"), "skipped": sc.get("skipped"),
            "takes": s.get("takes"), "last_msg": last.get("kind"), "last_text": (last.get("text") or "")[:240],
            "shot": d.get("shot"), "errors": d.get("errors") or d.get("error")}


def step(name: str, args: list | None = None, settle=False, wait=1.5) -> dict:
    t0 = time.time()
    d = call("/act", {"name": name, "args": args or [], "settle": settle, "wait": wait})
    out = {"step": name, "seconds": round(time.time() - t0, 1), **summary(d)}
    print(json.dumps(out), flush=True)
    if not d.get("ok") or out["last_msg"] == "error":
        sys.exit(1)
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--saved", help="skip building: open this saved scene id ('latest' = most recent) and shoot")
    ap.add_argument("--concept", action="store_true")
    ap.add_argument("--ref", type=pathlib.Path, help="reference picture (PNG/JPEG) attached to the first prompt")
    ap.add_argument("--route"); ap.add_argument("--model")
    ap.add_argument("--move", default="drone-orbit"); ap.add_argument("--seconds", type=int, default=4)
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--aspect", choices=["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"])
    ap.add_argument("--example", help="skip building: open this example set (dungeon|neon|city|moon) and shoot")
    a = ap.parse_args()

    print(json.dumps({"open": summary(call("/open", {}))}), flush=True)
    if a.route and a.model: step("model", [a.route, a.model])
    if a.aspect: step("aspect", [a.aspect])
    if a.example:
        return shoot(a, step("openExample", [a.example], wait=20))
    if a.saved:
        sid = a.saved
        if sid == "latest":
            sid = json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:3000/api/scenes")))["scenes"][0]["id"]
        d = step("openSaved", [sid], wait=15)
        return shoot(a, d)
    step("concept", [a.concept])
    if a.ref:
        import base64
        mime = "image/png" if a.ref.suffix.lower() == ".png" else "image/jpeg"
        step("ref", ["data:%s;base64,%s" % (mime, base64.b64encode(a.ref.read_bytes()).decode())])
    step("homePrompt", [a.prompt])
    d = step("startFromPrompt", settle=True)
    for _ in range(3):   # director may ask; answer with defaults (continueQuestions uses each question's default)
        if (d.get("state") or {}).get("msgs", [{}])[-1].get("kind") != "questions": break
        d = step("continueQuestions", settle=True)
    if (d.get("state") or {}).get("msgs", [{}])[-1].get("kind") == "concept":
        d = step("buildThis", settle=True)
    shoot(a, d)


def shoot(a, d):
    s = d.get("state") or {}
    if not s.get("built"): print(json.dumps({"fail": "set not built"})); sys.exit(1)
    cams = (s.get("scene") or {}).get("cameras") or []
    step("camera", [cams[0]], wait=3)
    step("move", [0, a.move]); step("length", [0, a.seconds])
    if a.no_render: return
    d = step("render", settle=True)
    s = d.get("state") or {}
    if not s.get("takes"): print(json.dumps({"fail": "no take after render"})); sys.exit(1)
    step("showTake", [len(s["takes"]) - 1, "side"], wait=4)
    print(json.dumps({"done": True}), flush=True)


if __name__ == "__main__":
    main()
