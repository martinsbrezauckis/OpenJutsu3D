import type { NextConfig } from "next";

// The 3D viewer runs builder-written scene code, so the app shows it in a SANDBOXED iframe without
// allow-same-origin (opaque origin: no access to the app, its cookies or storage). An opaque-origin page loads its
// module scripts cross-origin, so /scenekit/* must answer with CORS headers.
const config: NextConfig = {
  devIndicators: false,
  // proxy.ts makes Next buffer request bodies, 10 MB by default (bodies beyond it arrive truncated): GLB imports go up
  // to 100 MB. The app listens on loopback only.
  experimental: { proxyClientMaxBodySize: "110mb" },
  async headers() {
    return [
      { source: "/scenekit/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
      // Only our own pages may frame the viewport (it executes scene code sent by postMessage).
      { source: "/scenekit/studio.html", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
    ];
  },
};
export default config;
