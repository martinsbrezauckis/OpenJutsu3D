#!/usr/bin/env python3
"""e2e_refs.py — reference pictures (audit 2 gaps 2 + 11): up to 5 pictures through the Reference chip's real file input,
label, remove, a 6th refused plainly, the scene keeps them after a full page reload, "use as reference" from a take's look
still, a take's video frame and a concept picture, the take's photoreal still download, server-side refusals (6 pictures,
mislabelled bytes), and — unless --no-look — ONE look still made with references whose request record proves the look
route received them (labels + byte sizes). PASS/FAIL at the end, exit 1 on FAIL.

Needs: the Debug API on the app (O3J_API_PORT), a saved scene with a take (--scene) and a saved scene with a concept
picture (--concept-scene) in the app's DATA_DIR, test pictures in --pics (bench/out/refs-test: house.png, car.jpg,
handbag.webp, man.png, extra6.png, woman_red_hair.png).
  O3J_API_PORT=3996 python3 bench/e2e_refs.py --app http://127.0.0.1:3003 --scene <id> --concept-scene <id> [--no-look]
"""
import argparse, base64, json, pathlib, sys, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call, ROOT  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--app", default="http://127.0.0.1:3000"); ap.add_argument("--scene", required=True); ap.add_argument("--concept-scene", required=True)
ap.add_argument("--pics", default=str(ROOT / "bench" / "out" / "refs-test")); ap.add_argument("--camera", default="CAM_table")
ap.add_argument("--no-look", action="store_true", help="skip the one image-model call")
a = ap.parse_args(); P = pathlib.Path(a.pics)

checks, errs, harness = [], [], []
def check(label, ok, **info): checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok), **info}), flush=True)
def out(name, d):
    s = d.get("state") or {}; e = d.get("errors") or ([d["error"]] if d.get("error") else [])
    # App errors = browser console / page errors. A screenshot timeout while a take's video plays (CPU browser) is the
    # harness's, not the app's: reported, and the step's result is read again from /state.
    harness.extend(x for x in e if x.startswith("Page.screenshot")); errs.extend(x for x in e if "Up to 5" not in x and not x.startswith("Page.screenshot"))
    print(json.dumps({"step": name, "ok": d.get("ok"), "refs": s.get("refs"), "refNote": s.get("refNote"), "shot": d.get("shot"), "errors": e}), flush=True)
    return d
def act(name, args=None, wait=2.0, settle=False): return out(name, call("/act", {"name": name, "args": args or [], "wait": wait, "settle": settle}))
def upload(*names): return out("upload " + ",".join(names), call("/upload", {"target": "ref", "paths": [str(P / n) for n in names], "wait": 15}))
def refs(d): return (d.get("state") or {}).get("refs") or []
def http(path, body=None):
    req = urllib.request.Request(a.app + path, method="POST" if body is not None else "GET", data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-O3J": "1", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, r.headers.get("content-type", ""), r.read()
    except urllib.error.HTTPError as e: return e.code, e.headers.get("content-type", ""), e.read()
data_url = lambda f: f"data:image/png;base64,{base64.b64encode((P / f).read_bytes()).decode()}"

out("open", call("/open", {"url": f"{a.app}/?debug=1"}))
d = act("openSaved", [a.scene], wait=25); take = ((d.get("state") or {}).get("takes") or [None])[0]
for _ in refs(d): d = act("removeRef", [0], wait=1)   # a previous run's references (removing saves the scene)
check("scene with a take opens, references cleared", take and refs(d) == [], take=take)

d = upload("house.png", "car.jpg", "handbag.webp")
check("3 pictures added through the file input (PNG, JPEG, WebP → JPEG)", len(refs(d)) == 3 and all(r["type"] == "image/jpeg" for r in refs(d)))
d = act("labelRef", [1, "the car"]); check("a label is kept", [r["label"] for r in refs(d)] == [None, "the car", None])
d = act("removeRef", [0]); check("remove one: 2 left, the right ones", [r["label"] for r in refs(d)] == ["the car", None])
d = upload("man.png", "extra6.png"); check("4 after two more", len(refs(d)) == 4)
d = act("refFromTake", [0, "still"], wait=3)
check("a take's look still becomes the 5th reference", len(refs(d)) == 5 and refs(d)[-1]["from"] == "take 1")
d = upload("house.png"); five = refs(d)
check("the 6th (file input) is refused plainly", len(five) == 5 and "Up to 5 reference pictures" in (d["state"].get("refNote") or ""), note=d["state"].get("refNote"))
d6 = call("/act", {"name": "addRef", "args": [data_url("house.png")], "wait": 2}); out("addRef 6th", d6)
check("the 6th (action) is refused with the same words", "Up to 5 reference pictures" in json.dumps(d6) and len(refs(call("/state"))) == 5)

# A full page reload: the scene's saved references come back (labels, sizes, order).
out("reload", call("/open", {"url": f"{a.app}/?debug=1"})); d = act("openSaved", [a.scene], wait=25)
key = lambda rs: [(r["label"], r["bytes"]) for r in rs]
check("reload keeps all 5 references", key(refs(d)) == key(five), before=key(five), after=key(refs(d)))

# The take's photoreal still (gap 11) and a frame of its video as a reference.
act("removeRef", [4]); d = act("showTake", [0, "final"], wait=6); still = d["state"].get("takeStill")
st, ct, body = http(still) if still else (0, "", b"")
w, h = (int.from_bytes(body[16:20], "big"), int.from_bytes(body[20:24], "big")) if body[:4] == b"\x89PNG" else (0, 0)
check("Still on a take = its photoreal look still (PNG)", st == 200 and ct == "image/png" and w > 0, url=still, size=[w, h])
act("refFromTake", [0, "frame"], wait=3); d = call("/state")
check("a frame of the take's video becomes a reference", len(refs(d)) == 5 and (refs(d)[-1]["from"] or "").startswith("frame of"), last=refs(d)[-1:])
act("backToSet")

# Server side: a 6th picture and a mislabelled picture are refused before any model call.
six = [{"url": data_url("house.png")}] * 6
tid = (still or "").split("/")[3] if still else "x"
st6, _, b6 = http(f"/api/shots/{tid}/look", {"prompt": "x", "refs": six})
check("look route refuses 6 pictures (400)", st6 == 400 and b"at most 5" in b6, body=b6[:120].decode(errors="replace"))
fake = "data:image/jpeg;base64," + base64.b64encode((P / "house.png").read_bytes()).decode()
stf, _, bf = http(f"/api/shots/{tid}/look", {"prompt": "x", "refs": [fake]})
check("look route refuses a PNG labelled JPEG (400)", stf == 400 and b"not the image type" in bf, body=bf[:120].decode(errors="replace"))
sts, _, bs = http("/api/scenes", {"title": "t", "versions": [{"code": "", "note": "", "at": ""}], "refs": six})
check("scene save refuses 6 pictures (400)", sts == 400, body=bs[:120].decode(errors="replace"))

if not a.no_look:
    # ONE image-model call: the woman (labelled only by where she sits, not by her looks) + an unrelated car.
    act("ref", [None]); act("addRef", [data_url("woman_red_hair.png"), "the patron facing the camera"]); act("addRef", [data_url("car.jpg"), "the car"])
    d = act("camera", [a.camera], wait=4); sent = refs(d)
    d = act("lookOnly", settle=1800); looks = d["state"].get("looks") or []
    raw = looks[-1] if looks else ""
    check("look still made", raw.endswith("look_raw.png"), raw=raw)
    st, _, rec = http(raw.replace(".png", ".json")) if raw else (0, "", b"{}")
    r = json.loads(rec or b"{}"); got = [(i.get("label"), i.get("bytes")) for i in r.get("images", []) if i.get("role") == "reference"]
    check("the look route received the references (labels + exact sizes)", st == 200 and got == key(sent), sent=key(sent), received=got,
          prompt_has_note="picture 2 = the patron facing the camera; picture 3 = the car" in r.get("prompt", ""), route=r.get("route"), model=r.get("model"))
    d = act("refFromLook", wait=3); check("a look still becomes a reference", len(refs(d)) == 3 and refs(d)[-1]["from"] == "look still")
    print(json.dumps({"look_still": raw, "record": r.get("images")}), flush=True)

d = act("openSaved", [a.concept_scene], wait=25); d = act("refFromConcept", wait=3)
check("a concept picture becomes a reference", len(refs(d)) == 1 and refs(d)[0]["from"] == "concept picture")
act("removeRef", [0], wait=3)   # leave the concept scene as it was
check("no console errors", not errs, errors=errs[:5])
bad = [c for c, ok in checks if not ok]
print(json.dumps({"summary": "PASS" if not bad else "FAIL", "passed": len(checks) - len(bad), "failed": bad, "harness_timeouts": len(harness)}), flush=True); sys.exit(1 if bad else 0)
