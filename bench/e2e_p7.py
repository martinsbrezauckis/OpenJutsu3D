#!/usr/bin/env python3
"""e2e_p7.py — scene properties + chat modes (P7) through the Debug API (bench/debug_api.py running; subscription route).
Scene settings apply live and record one coalesced version; undo restores; Chat only answers without changing the set;
director 'Don't ask' never asks (vague prompt), 'Ask first' asks (clear prompt). PASS/FAIL summary at the end."""
import json, sys, pathlib, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from e2e_ui import call  # noqa: E402

checks = []
def act(name, args=None, wait=2.5, settle=False):
    d = call("/act", {"name": name, "args": args or [], "wait": wait, "settle": settle}); s = d.get("state") or {}
    out = {"step": name, "ok": d.get("ok"), "versions": s.get("versions"), "head": s.get("head"), "edit": s.get("edit"),
           "view": s.get("view"), "msgs": s.get("msgs") or [], "built": s.get("built"), "shot": d.get("shot"), "errors": d.get("errors") or d.get("error")}
    print(json.dumps({k: v for k, v in out.items() if k != "msgs"} | {"last": (out["msgs"] or [{}])[-1]}), flush=True); return out
def check(label, ok): checks.append((label, bool(ok))); print(json.dumps({"check": label, "pass": bool(ok)}), flush=True)

call("/open", {})
s0 = act("openExample", ["neon"], wait=20); v0 = s0["versions"]
act("scenePanel", [True])
s1 = act("sceneSettings", [{"exposure": 1.6, "lights": 0.5}], wait=3)
s2 = act("sceneSettings", [{"background": "#203040"}], wait=3)
check("settings recorded as ONE version (coalesced)", s2["versions"] == v0 + 1 and s2["edit"]["note"] == "Scene settings")
check("panel state follows", s2["edit"]["props"] == {"exposure": 1.6, "lights": 0.5, "background": "#203040"})
s3 = act("undo", wait=8)
check("undo restores the defaults", s3["head"] == s0["head"] and s3["edit"]["props"] == {"exposure": 1, "lights": 1, "background": None})
s4 = act("redo", wait=8)
check("redo (full reload) brings the settings back", s4["edit"]["props"]["background"] == "#203040")
act("chatMode", ["chat"]); act("chat", ["Which light sources are in this scene? Answer in two sentences."])
n0 = len(s4["msgs"]); s5 = act("send", settle=True)
last = s5["msgs"][-1] if s5["msgs"] else {}
check("chat only answers in a note", last.get("kind") == "note" and len(last.get("text") or "") > 20)
check("chat only leaves the set unchanged", s5["versions"] == s4["versions"] and s5["head"] == s4["head"])
# director modes from the home composer
act("home"); act("chatMode", ["go"]); act("concept", [False]); act("homePrompt", ["a room"])
s6 = act("startFromPrompt", settle=True)
kinds = [m.get("kind") for m in s6["msgs"]]
check("Don't ask: a vague prompt still builds (no questions)", "questions" not in kinds and s6["built"])
act("home"); act("chatMode", ["ask"]); act("concept", [False]); act("homePrompt", ["A medieval blacksmith forge at night with an anvil, a glowing hearth and hanging tools"])
s7 = act("startFromPrompt", settle=True)
check("Ask first: a clear prompt still gets questions", (s7["msgs"] or [{}])[-1].get("kind") == "questions")
errs = [x for x in (s1, s2, s3, s4, s5, s6, s7) if x["errors"]]; check("no console errors", not errs)
bad = [c for c, ok in checks if not ok]
print(json.dumps({"summary": "PASS" if not bad else "FAIL", "failed": bad}), flush=True); sys.exit(1 if bad else 0)
