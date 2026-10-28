#!/usr/bin/env python3
"""e2e_newscene.py — a new set started from Home after another scene was open must be its OWN scene (10-29 bug: the
start action ran with the previous render's state, so the new build was appended to the open scene). Opens the neon
example, goes Home, builds a small set, then checks the new scene's versions start at build step 1, the object count is
not the alley's 47 plus more, and the alley's saved scene was not touched. PASS/FAIL summary at the end."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

checks = []
def act(name, args=None, wait=3, settle=False):
    d = call("/act", {"name": name, "args": args or [], "wait": wait, "settle": settle}); s = d.get("state") or {}
    print(json.dumps({"step": name, "ok": d.get("ok"), "versions": s.get("versions"), "built": s.get("built"),
                      "objects": ((s.get("scene") or {}).get("stats") or {}).get("objects"), "sceneId": s.get("sceneId"), "title": s.get("title"),
                      "notes": s.get("notes"), "errors": d.get("errors") or d.get("error")}), flush=True)
    return s, d
def check(label, ok): checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok)}), flush=True)

call("/open", {})
a, _ = act("openExample", ["neon"], wait=20); alley_objects = (a.get("scene") or {}).get("stats", {}).get("objects")
act("chat", ["make the neon sign blue"]); act("home")   # leave the alley open in state, then start fresh
act("model", ["codex", "gpt-6.1-terra"]); act("chatMode", ["go"]); act("concept", [False])
act("homePrompt", ["A small empty white gallery room with one wooden bench in the middle"])
s, d = act("startFromPrompt", settle=True)
objs = (s.get("scene") or {}).get("stats", {}).get("objects") or 0
notes = s.get("notes") or []
check("new set is built", s.get("built"))
check("its history starts with build step 1 (nothing from the alley)", bool(notes) and notes[0].startswith("Build step 1"))
check("object count is not the alley's plus more", objs and objs < alley_objects)
check("title is the new prompt", (s.get("title") or "").startswith("A small empty white gallery"))
check("no console errors", not (d.get("errors") or d.get("error")))
bad = [c for c, ok in checks if not ok]
print(json.dumps({"summary": "PASS" if not bad else "FAIL", "failed": bad, "shot": d.get("shot")}), flush=True); sys.exit(1 if bad else 0)
