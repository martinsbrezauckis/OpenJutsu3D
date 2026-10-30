#!/usr/bin/env python3
"""debug_api.py — automation / debug API for the OpenJutsu3D web app: every UI action, with a screenshot after each.
Keeps ONE real browser open on the app (?debug=1) and exposes every UI action over HTTP; each action
is followed by a numbered screenshot, the app state and any console/page errors.

Endpoints (127.0.0.1 only):
  POST /open   {url?, width?, height?}        open/reload the app (default http://127.0.0.1:3000/?debug=1, 1600×900)
  POST /act    {name, args?, wait?, settle?}  run window.__o3j.act[name](...args); then wait `wait` s (default 1.5),
                                              or with settle=true until the app is not busy (max 3600 s; settle=<seconds> sets the cap — long shots); screenshot
  POST /upload {path, wait?, target?}        give a file to the open Import input (library panel; target "ref" = the
                                              Reference chip, `paths` = several pictures at once); path must lie under
                                              bench/out (e.g. bench/out/mixamo/*.fbx); waits until the import is done
  POST /click  {object? | x?, y?, mods?, wait?}  a real mouse click in the 3D view on a spot that picks `object` (or at
                                              page px x, y); mods: ["Shift"] / ["Control"] / ["Meta"] held during it
  POST /drag   {handle?, by?, wait?}          a real mouse drag of the gizmo handle "X" / "Y" / "Z" (default X) by
                                              `by` px (default 80) outward along that axis on screen
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
import math
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

    def key(self, key: str, where: str = "page", wait=1.0):
        """A real key press: in the app page, or inside the 3D viewport (its sandboxed iframe has its own focus)."""
        if not re.fullmatch(r"[A-Za-z0-9+]{1,20}", key or ""): raise ValueError("bad key")
        if where == "viewport":
            fr = next(f for f in self.page.frames if "studio.html" in f.url)
            fr.locator("body").press(key)
        else:
            self.page.locator("body").press(key)
        time.sleep(float(wait)); return self.reply(f"key-{key}")

    MODS = {"Shift", "Control", "Meta"}

    def click(self, obj=None, x=None, y=None, mods=None, wait=1.0):
        """A real mouse click in the page (the 3D view picks with it); modifier keys are held during the click."""
        mods = list(mods or [])
        if any(m not in self.MODS for m in mods): raise ValueError("mods: Shift, Control, Meta")
        if obj is not None:
            p = self.page.evaluate("async (n) => await window.__o3j.locate(n)", str(obj))
            if not p: raise ValueError(f"{obj} has no clickable spot in the view")
            x, y = p
        x, y = float(x), float(y)
        for m in mods: self.page.keyboard.down(m)
        try: self.page.mouse.click(x, y)
        finally:
            for m in reversed(mods): self.page.keyboard.up(m)
        time.sleep(float(wait)); r = self.reply(f"click-{obj or 'xy'}"); r["at"] = [x, y]; return r

    def drag(self, handle="X", by=80.0, wait=1.5):
        """A real mouse drag of a gizmo handle, outward along its axis as the screen shows it."""
        if handle not in ("X", "Y", "Z"): raise ValueError("handle: X, Y or Z")
        h = self.page.evaluate("async (a) => await window.__o3j.gizmoHandle(a)", handle)
        if not h: raise ValueError("no gizmo handle in the view (select something, editMode translate)")
        (hx, hy), (ox, oy) = h["at"], h["from"]; d = math.hypot(hx - ox, hy - oy) or 1.0
        tx, ty = hx + (hx - ox) / d * float(by), hy + (hy - oy) / d * float(by)
        self.page.mouse.move(hx, hy, steps=3); self.page.mouse.down(); time.sleep(0.3)
        self.page.mouse.move(tx, ty, steps=12); time.sleep(0.3); self.page.mouse.up()
        time.sleep(float(wait)); r = self.reply(f"drag-{handle}"); r["at"] = [[hx, hy], [tx, ty]]; return r

    def upload(self, path, wait=180.0, target="library"):
        if target == "ref":   # the Reference chip's file input (home or chat): one or several pictures at once
            before = self.page.evaluate("() => JSON.stringify([window.__o3j.state().refs, window.__o3j.state().refNote])")
            self.page.set_input_files('input[type=file][data-o3j=ref]', path)
            t0 = time.time()   # pictures are decoded and resized first: wait until the chip changes (or `wait` s)
            while time.time() - t0 < float(wait) and self.page.evaluate("() => JSON.stringify([window.__o3j.state().refs, window.__o3j.state().refNote])") == before:
                time.sleep(0.3)
            time.sleep(0.5); return self.reply("upload-ref")
        # The Import input of the library panel (Add › library); then wait while the panel says Converting/Adding.
        self.page.set_input_files('input[type=file][accept*=".fbx"]', path)
        t0 = time.time(); time.sleep(1.0)
        while time.time() - t0 < float(wait) and self.page.locator(".lib-panel .note", has_text=re.compile("Converting|Adding")).count():
            time.sleep(1.0)
        time.sleep(1.5)
        return self.reply("upload")

    def act(self, name: str, args=None, wait=1.5, settle=False):
        if not re.fullmatch(r"[A-Za-z]{2,40}", name or ""): raise ValueError("bad action name")
        self.page.evaluate("async ([n, a]) => { const f = window.__o3j.act[n]; if (!f) throw new Error('no action ' + n); await f(...a) }", [name, args or []])
        if settle:
            # Work can start late (startFromPrompt opens the studio first; the director runs once the viewport is
            # ready), so wait up to 30 s for busy to appear, then until it has been clear on two checks in a row.
            t0 = time.time()
            while not self.busy() and time.time() - t0 < 30: time.sleep(0.5)
            clear = 0
            cap = float(settle) if not isinstance(settle, bool) else 3600.0
            while clear < 2 and time.time() - t0 < cap:
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
    tok_file = ROOT / "bench" / "logs" / ("debug_api.token" if a.port == 3999 else f"debug_api.{a.port}.token")   # one per server; tok_file.parent.mkdir(parents=True, exist_ok=True)
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
                if self.path == "/click": return self.send(200, s.click(body.get("object"), body.get("x"), body.get("y"), body.get("mods"), body.get("wait", 1.0)))
                if self.path == "/drag": return self.send(200, s.drag(body.get("handle", "X"), body.get("by", 80), body.get("wait", 1.5)))
                if self.path == "/key": return self.send(200, s.key(body.get("key"), body.get("where", "page"), body.get("wait", 1.0)))
                if self.path == "/act": return self.send(200, s.act(body.get("name"), body.get("args"), body.get("wait", 1.5), body.get("settle", False)))
                if self.path == "/upload":
                    out, target = (ROOT / "bench" / "out").resolve(), body.get("target", "library")
                    if target not in ("library", "ref"): return self.send(400, {"ok": False, "error": "target: library or ref"})
                    raw = body.get("paths") if target == "ref" and isinstance(body.get("paths"), list) else [body.get("path", "")]
                    # Only files under bench/out: normalise first (symlinks, ..), then require the folder prefix.
                    base, paths = str(out) + os.sep, []
                    for x in raw:
                        q = os.path.normpath(os.path.realpath(os.path.join(str(out), str(x))))
                        if not q.startswith(base): return self.send(400, {"ok": False, "error": "path must be a file under bench/out"})
                        if not os.path.isfile(q): return self.send(400, {"ok": False, "error": "path must be a file under bench/out"})
                        paths.append(q)
                    if not paths: return self.send(400, {"ok": False, "error": "path must be a file under bench/out"})
                    return self.send(200, s.upload(paths if len(paths) > 1 else paths[0], body.get("wait", 15 if target == "ref" else 180), target))
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
