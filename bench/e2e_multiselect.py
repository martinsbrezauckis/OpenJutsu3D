#!/usr/bin/env python3
"""e2e_multiselect.py — multi-select in the set editor through the Debug API, with REAL mouse input: click one object,
Shift- and Ctrl-click two more (a Shift-click on a selected one takes it out again), drag the group's gizmo arrow twice
(one coalesced version, every object moved by the same offset), a programmatic group edit on top (same version),
undo restores every object, redo brings the move back, duplicate makes N copies in one version, delete removes them
in one version, a light stays single-select. PASS/FAIL at the end, exit 1 on FAIL.
Needs bench/debug_api.py running.   O3J_API_PORT=3997 python3 bench/e2e_multiselect.py [--url …] [--example neon]
"""
import argparse, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

checks: list[tuple[str, bool]] = []
errors: list[str] = []
shots: dict[str, str] = {}


def out(step, d, extra=None):
    s = d.get("state") or {}; e = s.get("edit") or {}
    o = {"step": step, "ok": d.get("ok", True) is not False and not d.get("error"), "versions": s.get("versions"), "head": s.get("head"),
         "sel": e.get("sel"), "names": e.get("names"), "pos": e.get("pos"), "note": e.get("note"), "mode": e.get("mode"),
         "objects": ((s.get("scene") or {}).get("stats") or {}).get("objects"), "shot": d.get("shot"),
         "errors": d.get("errors") or ([d["error"]] if d.get("error") else []), **(extra or {})}
    errors.extend(o["errors"]); print(json.dumps(o), flush=True); return o


def act(name, args=None, wait=2.5):
    return out(name, call("/act", {"name": name, "args": args or [], "wait": wait}))


def click(obj, mods=None):
    d = call("/click", {"object": obj, "mods": mods or [], "wait": 2.0})
    return out(f"click {'+'.join(mods or [])} {obj}", d, {"at": d.get("at")})


def check(label, ok):
    checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok)}), flush=True)


def same(a, b, tol=0.011): return a is not None and b is not None and all(abs(x - y) <= tol for x, y in zip(a, b))
def sub(a, b): return [x - y for x, y in zip(a, b)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=None); ap.add_argument("--example", default="neon")   # no --url = the automation server's own app
    a = ap.parse_args()
    out("open", call("/open", {"url": a.url} if a.url else {}))
    s0 = act("openExample", [a.example], wait=25)
    v0, n0 = s0["versions"], s0["objects"]
    act("editMode", ["translate"])
    code = pathlib.Path(__file__).resolve().parents[1].joinpath("web/public/examples", f"{a.example}.js").read_text()
    cands = list(dict.fromkeys(re.findall(r"kit\.object\('((?:PRP|MACH)_[a-z0-9_]+)'\)", code)))

    # 1) Each candidate's centre before any edit (single selection), then REAL clicks: plain on the first object with a
    #    clickable spot in the opening view, Shift on the second, Ctrl on the third (no clickable spot = skipped).
    orig = {}
    for c in cands[:7]:
        p = act("selectObject", [c], wait=1.2)
        if p["sel"] == c: orig[c] = p["pos"]
    act("selectObject", [None], wait=1.0)
    picked, last = [], None
    for c in orig:
        if len(picked) == 3: break
        mods = [] if not picked else ["Shift"] if len(picked) == 1 else ["Control"]
        d = call("/click", {"object": c, "mods": mods, "wait": 2.0})
        if d.get("error"): print(json.dumps({"skip": c, "why": d["error"][:120]}), flush=True); continue
        r = out(f"click {'+'.join(mods)} {c}", d, {"at": d.get("at")})
        if r["sel"] == c: picked.append(c); last = r
    check("three objects picked by real clicks", len(picked) == 3)
    if len(picked) < 3: return finish()
    A, B, C = picked
    check("Shift + Ctrl clicks build a group of 3", last["names"] == [A, B, C])
    shots["group selected"] = last["shot"]
    r = click(B, ["Shift"]); check("Shift-click on a selected object takes it out", r["names"] == [A, C])
    r = click(B, ["Shift"]); check("Shift-click again adds it back", r["names"] == [A, C, B])
    group = [A, C, B]
    check("no version for selecting", r["versions"] == v0)
    c0 = r["pos"]

    # 2) Real gizmo drags of the X arrow: one version, coalesced across both drags.
    d1 = call("/drag", {"handle": "X", "by": 90, "wait": 3}); r1 = out("drag X", d1, {"at": d1.get("at")})
    shots["group dragged"] = r1["shot"]
    check("a group drag adds one version", r1["versions"] == v0 + 1 and r1["note"] == "Edit 3 objects")
    check("the group gizmo moved", r1["pos"] is not None and not same(r1["pos"], c0, 0.05))
    d2 = call("/drag", {"handle": "X", "by": 60, "wait": 3}); r2 = out("drag X again", d2, {"at": d2.get("at")})
    check("a second drag of the same group is the same version (coalesced)", r2["versions"] == v0 + 1)
    r3 = act("editSelected", [{"pos": [r2["pos"][0], r2["pos"][1] + 0.5, r2["pos"][2]]}], wait=3)
    check("programmatic group edit coalesces too", r3["versions"] == v0 + 1 and r3["note"] == "Edit 3 objects")
    check("the group centre is where it was sent", same(r3["pos"], [r2["pos"][0], r2["pos"][1] + 0.5, r2["pos"][2]]))
    moved = {}
    for n in group: moved[n] = act("selectObject", [n], wait=1.5)["pos"]
    offs = [sub(moved[n], orig[n]) for n in group]
    print(json.dumps({"offsets": offs}), flush=True)
    check("every selected object moved by the same offset", all(same(o, offs[0], 0.011) for o in offs))
    check("the offset is real (> 0.3 m, +0.5 m up)", sum(x * x for x in offs[0]) ** 0.5 > 0.3 and abs(offs[0][1] - 0.5) < 0.011)

    # 3) Undo restores all, redo (a full reload of the code) brings the group move back.
    act("selectObject", [None], wait=1); u = act("undo", wait=8)
    back = {n: act("selectObject", [n], wait=1.5)["pos"] for n in group}
    check("undo restores every object", u["head"] == v0 - 1 and all(same(back[n], orig[n]) for n in group))
    act("selectObject", [None], wait=1); act("redo", wait=8)
    again = {n: act("selectObject", [n], wait=1.5)["pos"] for n in group}
    check("redo (full reload) keeps the group move", all(same(again[n], moved[n]) for n in group))

    # 4) Duplicate N in one version, then delete the N copies in one version.
    g = act("selectMany", [group], wait=2)
    check("selectMany selects the group", g["names"] == group)
    dup = act("duplicate", wait=4)
    shots["duplicated"] = dup["shot"]
    copies = dup["names"] or []
    check("duplicate makes 3 copies in one version", dup["objects"] == n0 + 3 and dup["versions"] == v0 + 2 and dup["note"] == "Duplicate 3 objects")
    check("the copies become the selection", len(copies) == 3 and not set(copies) & set(group))
    dl = act("deleteSelected", wait=4)
    check("delete removes all 3 in one version", dl["objects"] == n0 and dl["versions"] == v0 + 3 and dl["note"] == "Delete 3 objects" and dl["sel"] is None)

    # 5) Lights stay single-select: Shift-adding a light replaces the object group with that light alone.
    act("selectMany", [group], wait=1.5)
    lights = re.findall(r"kit\.light\('(LGT_[a-z0-9_]+)'", code)
    if lights:
        l = act("selectObject", [lights[0], True], wait=1.5)
        check("a light is never part of a group (selected alone)", l["sel"] == lights[0] and l["names"] is None)
    x = act("selectObject", [None], wait=1.5)
    check("× / clear empties the selection", x["sel"] is None and x["names"] is None)
    return finish()


def finish():
    check("no console errors", not errors)
    bad = [c for c, ok in checks if not ok]
    print(json.dumps({"summary": "PASS" if not bad else "FAIL", "failed": bad, "shots": shots}), flush=True)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
