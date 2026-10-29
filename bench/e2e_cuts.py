#!/usr/bin/env python3
"""e2e_cuts.py — camera cuts inside one shot (Debug API, tavern example: CAM_main, CAM_table, CAM_barrels).
A two-move shot on one camera stays a continuous chain (the old recipe, unchanged); then the moves get their own cameras
(moveCamera / addMove with a camera) → a 3-move shot over 3 cameras. Parked just before and after each cut the camera
is the other one, at that camera's own pose, and the picture jumps; inside a move it moves smoothly. The live preview
plays through the cuts; undo/redo and save + reopen keep the cameras; a chat line with "cut to the … camera" sets cuts.
PASS/FAIL summary at the end, exit 1 on FAIL."""
import json, math, sys, time, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402
from PIL import Image, ImageChops, ImageStat  # noqa: E402

checks, errs = [], []
def act(name, args=None, wait=3):
    d = call("/act", {"name": name, "args": [] if args is None else args, "wait": wait}); s = d.get("state") or {}
    o = {"recipe": s.get("recipe"), "recipeStr": s.get("recipeStr"), "cuts": s.get("cuts"), "pose": s.get("parkPose"), "park": s.get("park"),
         "cam": s.get("cam"), "head": s.get("head"), "versions": s.get("versions"), "sceneId": s.get("sceneId"), "cameras": (s.get("scene") or {}).get("cameras"),
         "msgs": s.get("msgs"), "shot": d.get("shot"), "errors": d.get("errors") or d.get("error")}
    if o["errors"]: errs.append((name, o["errors"]))
    print(json.dumps({"step": name, "args": args, **{k: v for k, v in o.items() if k != "msgs"}}), flush=True); return o
def check(label, ok, **info): checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok), **info}), flush=True)
def dist(a, b): return math.dist(a["pos"], b["pos"]) + math.dist(a["lookAt"], b["lookAt"])
def view_diff(a, b):
    A, B = Image.open(a).convert("L"), Image.open(b).convert("L"); w, h = A.size; box = (int(w * .3), int(h * .1), int(w * .95), int(h * .6))
    return ImageStat.Stat(ImageChops.difference(A.crop(box), B.crop(box))).mean[0]

call("/open", {}); s0 = act("openExample", ["tavern"], wait=25)
check("tavern has the 3 cameras", {"CAM_main", "CAM_table", "CAM_barrels"} <= set(s0["cameras"] or []), cameras=s0["cameras"])
act("camera", ["CAM_main"], wait=4)

# each camera's own pose: a lone static shot on it, parked at 0.5 s
poses = {}
act("move", [0, "static-shot"], wait=1); act("length", [0, 2], wait=1)
for c in ("CAM_main", "CAM_table", "CAM_barrels"):
    act("moveCamera", [0, None if c == "CAM_main" else c], wait=1); poses[c] = act("seek", [0.5], wait=2)["pose"]
check("three different camera poses", all(poses.values()) and dist(poses["CAM_main"], poses["CAM_table"]) > 0.5 and dist(poses["CAM_table"], poses["CAM_barrels"]) > 0.5)
act("moveCamera", [0, None], wait=1)

# 1. old single-camera recipe: two chained moves, no camera named → plain string, no cuts, continuous across the join
act("move", [0, "dolly-in"], wait=1); act("length", [0, 2], wait=1)
s1 = act("addMove", ["arc-left", 2, None], wait=2)
check("old recipe string unchanged", s1["recipeStr"] == "dolly-in:2+arc-left:2" and not any(s1["cuts"] or []), recipeStr=s1["recipeStr"])
a, b = act("seek", [1.96], wait=2)["pose"], act("seek", [2.04], wait=2)["pose"]
check("single camera: continuous across the move join", a["cam"] == b["cam"] == "CAM_main" and dist(a, b) < 0.3 and not b.get("cut"), step=round(dist(a, b), 3))

# 2. three moves over three cameras
act("moveCamera", [1, "CAM_table"], wait=2)
s2 = act("addMove", ["pan-left", 2, "CAM_barrels"], wait=2)
want = "dolly-in:2+arc-left:2@CAM_table+pan-left:2@CAM_barrels"
check("3-move recipe with cameras", s2["recipeStr"] == want and s2["cuts"] == [False, True, True], recipeStr=s2["recipeStr"], cuts=s2["cuts"])
for T, before, after in ((2, "CAM_main", "CAM_table"), (4, "CAM_table", "CAM_barrels")):
    p0, p1, p2, p3 = (act("seek", [T + d], wait=2) for d in (-0.08, -0.04, 0, 0.04))
    A, B, C, D = (x["pose"] for x in (p0, p1, p2, p3))
    check(f"cut at {T} s: {before} until the cut, {after} from it", A["cam"] == B["cam"] == before and C["cam"] == D["cam"] == after and C.get("cut") is True,
          cams=[A["cam"], B["cam"], C["cam"], D["cam"]])
    check(f"cut at {T} s: the pose jumps, smooth on both sides", dist(B, C) > 1.0 and dist(A, B) < 0.2 and dist(C, D) < 0.2,
          jump=round(dist(B, C), 3), before=round(dist(A, B), 3), after=round(dist(C, D), 3))
    check(f"cut at {T} s: lands on {after}'s own pose", dist(C, poses[after]) < 0.05, off=round(dist(C, poses[after]), 4))
    dv_cut, dv_in = view_diff(p1["shot"], p2["shot"]), view_diff(p0["shot"], p1["shot"])
    check(f"cut at {T} s: the picture jumps (viewport diff {dv_cut:.1f} vs {dv_in:.1f} inside the move)", dv_cut > 3 * max(dv_in, 1.0))

# 3. preview plays through the cuts
s3 = act("preview", wait=9)
check("preview runs through the cuts (no errors, unparked)", s3["park"] is None and not s3["errors"])

# 4. undo / redo keep the shot; save + reopen restores it
s4 = act("sceneSettings", [{"exposure": 1.1}], wait=6)
sid, t0 = s4["sceneId"], time.time()
while not sid and time.time() - t0 < 60:   # the save (thumbnail + POST) lands a few seconds after the edit
    time.sleep(2); sid = (call("/state").get("state") or {}).get("sceneId")
check("an edit saves the scene", bool(sid))
u = act("undo", wait=8); r = act("redo", wait=8)
check("undo / redo keep the cameras", u["recipeStr"] == want and r["recipeStr"] == want)
s5 = act("moveCamera", [2, "CAM_main"], wait=5)   # changed after saving: saved by itself a moment later
want2 = "dolly-in:2+arc-left:2@CAM_table+pan-left:2@CAM_main"
check("segment camera changed", s5["recipeStr"] == want2 and s5["cuts"] == [False, True, True])
time.sleep(4)
act("home", wait=3); s6 = act("openSaved", [sid], wait=25)
check("reopened scene keeps the moves and their cameras", s6["recipeStr"] == want2 and s6["cuts"] == [False, True, True], recipeStr=s6["recipeStr"])
p = act("seek", [4.0], wait=3)["pose"]
check("reopened: the cut lands on the camera again", p["cam"] == "CAM_main" and p.get("cut") is True)

# 5. a strip pick with several moves never re-films the moves already set (the unnamed first move keeps CAM_main)
s8 = act("camera", ["CAM_barrels"], wait=3)
check("strip pick keeps the moves' cameras", s8["recipeStr"] == "dolly-in:2@CAM_main+arc-left:2@CAM_table+pan-left:2@CAM_main" and s8["cam"] == "CAM_barrels", recipeStr=s8["recipeStr"])

# 6. chat: "cut to the … camera" (shot words only, no builder call)
act("chat", ["dolly in on the barrels camera for 2 s, then cut to the table camera and arc right for 3 s"], wait=1)
s7 = act("send", wait=4)
check("chat sets a shot with a cut", s7["recipeStr"] == "dolly-in:2@CAM_barrels+arc-right:3@CAM_table" and s7["cuts"] == [False, True], recipeStr=s7["recipeStr"])

check("no console errors", not errs, errors=errs[:3])
bad = [c for c, ok in checks if not ok]
print(json.dumps({"summary": "PASS" if not bad else "FAIL", "passed": len(checks) - len(bad), "of": len(checks), "failed": bad}), flush=True)
sys.exit(1 if bad else 0)
