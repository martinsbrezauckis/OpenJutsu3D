#!/usr/bin/env python3
"""debug_api.py — automation / debug API for the Open 3D Jutsu web app: every UI action, with a screenshot after each.
Keeps ONE real browser open on the app (?debug=1) and exposes every UI action over HTTP; each action
is followed by a numbered screenshot, the app state and any console/page errors.

Endpoints (127.0.0.1 only):
  POST /open   {url?, width?, height?}        open/reload the app (default http://127.0.0.1:3000/?debug=1, 1600×900)
  POST /act    {name, args?, wait?, settle?}  run window.__o3j.act[name](...args); then wait `wait` s (default 1.5),
                                              or with settle=true until the app is not busy (max 3600 s); screenshot
  GET  /state                                 window.__o3j.state()
  GET  /shot?name=x                           screenshot now
  GET  /log                                   action log (app) + console errors (browser)
  GET  /actions                               list of action names the app exposes
Every response: {ok, state, shot: <png path>, errors: [...]} (errors = new console/page errors since the last call).
Screenshots: $DEBUG_SHOTS/<session>/NNN_<name>.png (default bench/out/debug/…).

Run:  python3 bench/debug_api.py [--port 3999] [--gpu]    (--gpu: Chromium with SCENEKIT_GL flags from evaluate.py;
      without a GPU the headless browser renders 3D on the CPU (~2 fps); for real-time 3D run this script on a GPU
      machine with SCENEKIT_GL=vulkan --gpu, reaching the app through an SSH tunnel)
Security (review 10-28): every request needs header X-Debug-Token (random per run, printed at start and written to
bench/logs/debug_api.token, mode 600); Host must be 127.0.0.1/localhost:<port>; any request carrying an Origin header
(i.e. sent by a web page) is refused; POST needs Content-Type: application/json; /open only accepts the app's origin.
Example: T=$(cat bench/logs/debug_api.token); curl -s -XPOST 127.0.0.1:3999/act -H "X-Debug-Token: $T" \
           -H 'content-type: application/json' -d '{"name":"openExample","args":["dungeon"],"wait":20}'
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.server
import json
import os
import pathlib
import re
import secrets
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_gl import chromium_args  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get("DEBUG_SHOTS", ROOT / "bench" / "out" / "debug")) / dt.datetime.now().strftime("%Y%m%d-%H%M%S")


class Session:
    def __init__(self, gpu: bool):
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(args=chromium_args() if gpu else [])
        self.page = None; self.n = 0; self.errors: list[str] = []
        OUT.mkdir(parents=True, exist_ok=True)

    def open(self, url="http://127.0.0.1:3000/?debug=1", width=1600, height=900):
        if self.page: self.page.close()
        self.page = self.browser.new_page(viewport={"width": int(width), "height": int(height)})
        self.page.on("console", lambda m: self.errors.append(f"console.{m.type}: {m.text[:300]}") if m.type == "error" else None)
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {str(e)[:300]}"))
        self.page.goto(url); self.page.wait_for_function("() => !!window.__o3j", timeout=60_000)
        return self.reply("open")

    def shot(self, name: str) -> str:
        self.n += 1
        p = OUT / f"{self.n:03d}_{re.sub(r'[^A-Za-z0-9_-]+', '-', name)[:40]}.png"
        # Generous timeout + frozen animations: with result videos playing, CPU-rendered (SwiftShader) pages took >30 s.
        self.page.screenshot(path=str(p), timeout=120_000, animations="disabled"); return str(p)

    def state(self):
        return self.page.evaluate("() => window.__o3j.state()")

    def busy(self) -> bool:
        # Wait one animation frame first: React commits (and refreshes window.__o3j) with the next frame.
        return self.page.evaluate("() => new Promise(r => requestAnimationFrame(() => r(!!window.__o3j.state().busy)))")

    def reply(self, name: str):
        # Screenshot FIRST: headless Chromium only produces a frame when asked, and React commits its update (and the
        # window.__o3j refresh) with that frame — reading state first returned the previous render (10-28).
        shot = self.shot(name); time.sleep(0.2)
        errs, self.errors = self.errors, []
        return {"ok": True, "state": self.state(), "shot": shot, "errors": errs}

    def act(self, name: str, args=None, wait=1.5, settle=False):
        if not re.fullmatch(r"[A-Za-z]{2,40}", name or ""): raise ValueError("bad action name")
        self.page.evaluate("async ([n, a]) => { const f = window.__o3j.act[n]; if (!f) throw new Error('no action ' + n); await f(...a) }", [name, args or []])
        if settle:
            # Work can start late (startFromPrompt opens the studio first; the director runs once the viewport is
            # ready), so wait up to 30 s for busy to appear, then until it has been clear on two checks in a row.
            t0 = time.time()
            while not self.busy() and time.time() - t0 < 30: time.sleep(0.5)
            clear = 0
            while clear < 2 and time.time() - t0 < 3600:
                time.sleep(2); clear = 0 if self.busy() else clear + 1
        else:
            time.sleep(float(wait))
        return self.reply(name)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=3999); ap.add_argument("--gpu", action="store_true")
    ap.add_argument("--url", default="http://127.0.0.1:3000/?debug=1")
    a = ap.parse_args()
    s = Session(a.gpu); s.open(a.url)

    token = secrets.token_urlsafe(24)
    tok_file = ROOT / "bench" / "logs" / "debug_api.token"; tok_file.parent.mkdir(parents=True, exist_ok=True)
    tok_file.write_text(token); os.chmod(tok_file, 0o600)
    app_origin = "{0.scheme}://{0.netloc}".format(urlparse(a.url))

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *x): pass
        def guard(self, post: bool) -> bool:
            host = self.headers.get("host", "")
            if not re.fullmatch(rf"(127\.0\.0\.1|localhost):{a.port}", host): self.send(403, {"ok": False, "error": "host not allowed"}); return False
            if self.headers.get("origin") is not None: self.send(403, {"ok": False, "error": "browser requests refused"}); return False
            if not secrets.compare_digest(self.headers.get("x-debug-token", ""), token): self.send(401, {"ok": False, "error": "bad token"}); return False
            if post and not (self.headers.get("content-type", "").startswith("application/json")): self.send(415, {"ok": False, "error": "JSON only"}); return False
            return True
        def send(self, code, body):
            b = json.dumps(body).encode(); self.send_response(code); self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            if not self.guard(False): return
            try:
                path = self.path.split("?")[0]
                if path == "/state": return self.send(200, {"ok": True, "state": s.state()})
                if path == "/shot": return self.send(200, {"ok": True, "shot": s.shot(self.path.split("name=")[-1] if "name=" in self.path else "shot")})
                if path == "/log": return self.send(200, {"ok": True, "app": s.page.evaluate("() => window.__o3j.log()"), "browser": s.errors})
                if path == "/actions": return self.send(200, {"ok": True, "actions": s.page.evaluate("() => Object.keys(window.__o3j.act)")})
                self.send(404, {"ok": False, "error": "unknown path"})
            except Exception as e: self.send(500, {"ok": False, "error": str(e)[:600]})
        def do_POST(self):
            if not self.guard(True): return
            try:
                n = int(self.headers.get("content-length") or 0); body = json.loads(self.rfile.read(n) or b"{}")
                if self.path == "/open":
                    url = body.get("url", a.url)
                    if "{0.scheme}://{0.netloc}".format(urlparse(url)) != app_origin: return self.send(400, {"ok": False, "error": "only the app's origin"})
                    return self.send(200, s.open(url, body.get("width", 1600), body.get("height", 900)))
                if self.path == "/act": return self.send(200, s.act(body.get("name"), body.get("args"), body.get("wait", 1.5), body.get("settle", False)))
                self.send(404, {"ok": False, "error": "unknown path"})
            except Exception as e:
                try: shot = s.shot("error")
                except Exception: shot = None
                self.send(500, {"ok": False, "error": str(e)[:600], "shot": shot, "errors": s.errors})

    srv = http.server.HTTPServer(("127.0.0.1", a.port), H)   # loopback only; single-threaded = actions run in order
    print(json.dumps({"debug_api": f"http://127.0.0.1:{a.port}", "screenshots": str(OUT), "token_file": str(tok_file)}), flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
