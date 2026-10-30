#!/usr/bin/env python3
"""ui_walk.py — screenshot every main view of the app at common screen sizes, for a UI/UX review (no changes made
to scenes beyond opening panels). Uses a running bench/debug_api.py (O3J_API_PORT picks it).
  python3 bench/ui_walk.py [--sizes 1366x768,1600x900,1920x1080] [--example cafe] [--scene <saved scene id with a take>]
Prints one JSON line per screenshot: {size, view, shot, errors}."""
import argparse, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--sizes", default="1366x768,1600x900,1920x1080"); ap.add_argument("--example", default="cafe")
ap.add_argument("--scene", help="saved scene with at least one take (take views)")
a = ap.parse_args()


def act(view, name, args=None, wait=2.5, settle=False):
    d = call("/act", {"name": name, "args": [] if args is None else args, "wait": wait, "settle": settle})
    print(json.dumps({"size": size, "view": view, "shot": d.get("shot"), "errors": d.get("errors") or d.get("error")}), flush=True)
    return d.get("state") or {}


for size in a.sizes.split(","):
    w, h = (int(x) for x in size.split("x"))
    call("/open", {"width": w, "height": h})
    act("home", "home", wait=3)
    act("example", "openExample", [a.example], wait=25)
    s = act("objects", "objectsPanel")
    act("objects-off", "objectsPanel", wait=1)
    act("scene-panel", "scenePanel", [True])
    act("scene-panel-off", "scenePanel", [False], wait=1)
    act("library", "library", ["chair"], wait=6)
    act("packs", "packs", wait=3)
    act("escape", "escape", wait=1)
    act("clay", "mode", ["clay"])
    act("lit", "mode", ["lit"])
    act("move-edit", "editMode", ["translate"])
    act("move-edit-off", "editMode", [None], wait=1)
    act("chat-ask", "chatMode", ["ask"], wait=1)
    act("chat-auto", "chatMode", ["auto"], wait=1)
    if a.scene:
        call("/open", {"width": w, "height": h}); act("saved", "openSaved", [a.scene], wait=30)
        st = call("/act", {"name": "select", "args": [0], "wait": 1}).get("state") or {}
        n = len(st.get("takes") or [])
        if n:
            act("take-final", "showTake", [n - 1, "final"], wait=4)
            act("take-side", "showTake", [n - 1, "side"], wait=4)
            act("take-back", "backToSet")
