#!/usr/bin/env python3
"""e2e_library.py — asset library (P9) through the Debug API: search, place a model where the view looks, it is a
normal object (select, move, duplicate), survives undo/redo (full reload), turns grey in clay mode. PASS/FAIL summary."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

checks = []
def act(name, args=None, wait=3):
    d = call("/act", {"name": name, "args": args or [], "wait": wait}); s = d.get("state") or {}
    out = {"step": name, "ok": d.get("ok"), "versions": s.get("versions"), "head": s.get("head"), "edit": s.get("edit"),
           "objects": ((s.get("scene") or {}).get("stats") or {}).get("objects"), "last": (s.get("msgs") or [{}])[-1], "shot": d.get("shot"),
           "errors": d.get("errors") or d.get("error")}
    print(json.dumps(out), flush=True); return out
def check(label, ok): checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok)}), flush=True)

q = sys.argv[1] if len(sys.argv) > 1 else "barrel"
call("/open", {}); s0 = act("openExample", ["dungeon"], wait=20); n0 = s0["objects"]
s1 = act("library", [q], wait=4)
check("library search returns models", (s1["edit"]["lib"] or {}).get("n", 0) > 0)
s2 = act("placeResult", [0], wait=25)
check("placed model is a new selected object", s2["objects"] == n0 + 1 and (s2["edit"]["sel"] or "").startswith("PRP_"))
s3 = act("editSelected", [{"rot": [0, 45, 0]}], wait=4)
check("model can be edited like any object", s3["ok"] and s3["edit"]["note"].startswith("Edit PRP_"))
s4 = act("duplicate", wait=6)
check("duplicate of a model", s4["objects"] == n0 + 2)
s5 = act("undo", wait=15); s6 = act("redo", wait=25)
check("redo (full reload, model bytes re-sent) keeps both models", s6["objects"] == n0 + 2)
s7 = act("mode", ["clay"], wait=5); act("mode", ["lit"], wait=3)
errs = [x for x in (s1, s2, s3, s4, s5, s6, s7) if x["errors"]]; check("no console errors", not errs)
bad = [c for c, ok in checks if not ok]
print(json.dumps({"summary": "PASS" if not bad else "FAIL", "failed": bad, "clay_shot": s7["shot"], "lit_shot": s4["shot"]}), flush=True)
sys.exit(1 if bad else 0)
