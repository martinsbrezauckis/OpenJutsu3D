#!/usr/bin/env python3
"""e2e_edit.py — hands-on editing (P5) through the Debug API: select, move twice (one version), duplicate, delete, add a
cube and a camera, undo, and the edits surviving a full reload. Prints one JSON line per step and a PASS/FAIL summary.
Needs bench/debug_api.py running.   python3 bench/e2e_edit.py [--example dungeon]
"""
import argparse, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

checks: list[tuple[str, bool]] = []


def act(name, args=None, wait=2.5):
    d = call("/act", {"name": name, "args": args or [], "wait": wait})
    s = d.get("state") or {}
    out = {"step": name, "ok": d.get("ok"), "versions": s.get("versions"), "head": s.get("head"), "edit": s.get("edit"),
           "objects": ((s.get("scene") or {}).get("stats") or {}).get("objects"),
           "lights": ((s.get("scene") or {}).get("stats") or {}).get("lights"), "thumbs": s.get("thumbs"), "cameras": (s.get("scene") or {}).get("cameras"),
           "last": (s.get("msgs") or [{}])[-1], "shot": d.get("shot"), "errors": d.get("errors") or d.get("error")}
    print(json.dumps(out), flush=True)
    return out


def check(label, ok):
    checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok)}), flush=True)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--example", default="dungeon"); a = ap.parse_args()
    call("/open", {})
    s0 = act("openExample", [a.example], wait=20)
    v0, n0 = s0["versions"], s0["objects"]
    act("objectsPanel")
    act("editMode", ["translate"])
    # A known object of the example set, from its scene code.
    code = pathlib.Path(__file__).resolve().parents[1].joinpath("web/public/examples", f"{a.example}.js").read_text()
    import re
    target = next(m for m in re.findall(r"kit\.object\('((?:PRP|MACH)_[a-z0-9_]+)'\)", code))
    s = act("selectObject", [target])
    check("select shows the object", s["edit"] and s["edit"]["sel"] == target)
    s1 = act("editSelected", [{"pos": [0, 3, 0]}])
    s2 = act("editSelected", [{"pos": [0, 4, 0], "rot": [0, 30, 0]}])
    check("first edit adds one version", s1["versions"] == v0 + 1)
    check("second edit of the same object replaces it (coalesced)", s2["versions"] == v0 + 1 and s2["edit"]["note"] == f"Edit {target}")
    s3 = act("duplicate")
    check("duplicate adds an object + selects the copy", s3["objects"] == n0 + 1 and s3["edit"]["sel"] not in (None, target))
    s4 = act("deleteSelected")
    check("delete removes it", s4["objects"] == n0 and s4["edit"]["sel"] is None)
    s5 = act("addThing", ["cube"])
    check("add cube", s5["objects"] == n0 + 1 and (s5["edit"]["sel"] or "").startswith("PRP_cube_"))
    s6 = act("addThing", ["camera"])
    check("add camera from view", any(c.startswith("CAM_view_") for c in (s6["cameras"] or [])))
    s7 = act("undo", wait=8)
    check("undo removes the camera", not any(c.startswith("CAM_view_") for c in (s7["cameras"] or [])) and s7["head"] == s6["head"] - 1)
    s8 = act("redo", wait=8)
    check("redo brings it back (full reload keeps every edit)", any(c.startswith("CAM_view_") for c in (s8["cameras"] or [])) and s8["objects"] == n0 + 1)
    cam = next(c for c in s8["cameras"] if c.startswith("CAM_view_"))
    check("new camera is named CAM_view_<n> (numbered)", re.fullmatch(r"CAM_view_\d{1,3}", cam))
    s9 = act("camera", [cam], wait=3)
    import time
    for _ in range(15):   # thumbnails render one by one after a reload (software WebGL: seconds)
        if cam in ((call("/state").get("state") or {}).get("thumbs") or []): break
        time.sleep(2)
    check("new camera gets a thumbnail after undo/redo", cam in ((call("/state").get("state") or {}).get("thumbs") or []))
    l0 = s9["lights"]
    act("addThing", ["point"]); s10 = act("addThing", ["point"])
    check("two added point lights both stay (unique names)", s10["lights"] == (l0 or 0) + 2)
    act("editMode", ["rotate"])
    errs = [x for x in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10) if x["errors"]]
    check("no console errors", not errs)
    bad = [c for c, ok in checks if not ok]
    print(json.dumps({"summary": "PASS" if not bad else "FAIL", "failed": bad}), flush=True)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
