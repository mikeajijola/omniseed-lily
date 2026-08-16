import { defineChannel, GET } from "eve/channels";
import { runtimeHealth, runtimeInfo } from "../lib/runtime-metadata.mjs";

function authorised(request: Request) {
  const expected = process.env.LILY_RUNTIME_OBSERVATION_TOKEN;
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

function protectedJson(request: Request, body: () => object) {
  if (!authorised(request)) return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  try { return Response.json(body()); }
  catch { return Response.json({ ok: false, error: "runtime_not_configured" }, { status: 503 }); }
}

export default defineChannel({
  routes: [
    GET("/health", async (request) => protectedJson(request, () => runtimeHealth())),
    GET("/info", async (request) => protectedJson(request, () => runtimeInfo())),
  ],
});
