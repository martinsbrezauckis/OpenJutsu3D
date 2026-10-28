"""browser_gl.py — Chromium flags for 3D (WebGL) in a headless browser, chosen by SCENEKIT_GL:
vulkan (ANGLE→Vulkan on an NVIDIA GPU) | gl-egl (ANGLE→GL ES on NVIDIA) | swiftshader (default: CPU software rendering,
works everywhere, ~10-50x slower)."""
import os


def chromium_args() -> list[str]:
    mode = os.environ.get("SCENEKIT_GL", "swiftshader")
    if mode == "vulkan":
        return ["--use-angle=vulkan", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan"]
    if mode == "gl-egl":
        return ["--use-gl=angle", "--use-angle=gl-egl", "--enable-gpu", "--ignore-gpu-blocklist"]
    return ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
