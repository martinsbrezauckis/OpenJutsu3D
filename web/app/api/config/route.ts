import { defaults, options, routes, type Route } from "@/lib/models";
import { ok } from "@/lib/http";
export const runtime = "nodejs";
/** GET → available routes, model options per stage and route, defaults (for the model chips). */
export async function GET() {
  const r = routes();
  const opts = Object.fromEntries(r.map((route: Route) => [route, { director: options("director", route), builder: options("builder", route), look: options("look", route) }]));
  return ok({ routes: r, options: opts, defaults: defaults(), video: process.env.COMFY_BASE_URL ? "custom" : "comfy-cloud" });
}
