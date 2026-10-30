#!/usr/bin/env python3
"""e2e_walls.py — wall avoidance of moving cameras in the real viewer (fixture room, no builder call):
(1) a pull-back inside a closed room is stopped by the wall (collided, stays inside);
(2) a top-down camera looking at a pool centre and lowering on a pedestal is NOT dragged into the pool: what its start
pose already looks past (water surface, floor under the sunk look-at point) is not a wall (Mars dome bug, 10-30).
PASS/FAIL at the end."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

CODE = """kit.object('ENV_room').add([kit.box(12, 0.1, 12).at(0, -0.05, 0), kit.box(12, 6, 0.2).at(0, 3, -6), kit.box(12, 6, 0.2).at(0, 3, 6),
  kit.box(0.2, 6, 12).at(-6, 3, 0), kit.box(0.2, 6, 12).at(6, 3, 0), kit.box(12, 0.1, 12).at(0, 6.05, 0)], 'plaster').commit();
//@@
kit.object('ENV_pool').add([kit.cylinder(1.5, 1.5, 0.3, 48).at(0, 0.15, 0)], 'water').commit();
//@@
kit.camera('CAM_top', { pos: [0, 5, 0], lookAt: [0, 0, 0], fov: 70 });
//@@
kit.camera('CAM_room', { pos: [0, 1.6, 3], lookAt: [0, 1.4, 0], fov: 50 });
"""
checks = []
def check(label, ok): checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok)}), flush=True)
def act(name, args=None, wait=2):
    d = call("/act", {"name": name, "args": [] if args is None else args, "wait": wait}); s = d.get("state") or {}
    print(json.dumps({"step": name, "args": args, "park": s.get("parkPose"), "errors": d.get("errors"), "shot": d.get("shot")}), flush=True)
    return s
call("/open", {})
f = {"format": "openjutsu-scene", "version": 1, "title": "e2e walls", "prompt": "", "brief": None, "aspect": "16:9",
     "versions": [{"code": CODE, "note": "fixture", "at": ""}], "head": 0}
s = act("openSceneText", [json.dumps(f), "walls.o3j.json"], wait=20); sid = s.get("sceneId")
def park_end(cam, move):
    act("camera", [cam], wait=3); act("move", [0, move]); act("length", [0, 4], wait=2)
    p = act("seek", [3.95], wait=3).get("parkPose") or {}; act("seek", [None]); return p
p = park_end("CAM_room", "aerial-pullback")
check("pull-back in a closed room is stopped by the wall", p.get("collided") is True)
check("…and the camera stays inside the room", p.get("pos") and abs(p["pos"][2]) < 6 and p["pos"][1] < 6)
p = park_end("CAM_top", "pedestal-down")
check("top-down pedestal over the pool is not pulled in", p.get("collided") is False)
check("…and it lowers by the pedestal amount only (≈ 3.8 m high)", p.get("pos") and 3.6 < p["pos"][1] < 4.0)
if sid: call("/act", {"name": "deleteScene", "args": [sid], "wait": 3})
bad = [c for c, ok in checks if not ok]
print(json.dumps({"summary": "PASS" if not bad else "FAIL", "failed": bad}), flush=True); sys.exit(1 if bad else 0)
