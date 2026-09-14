import { defineChannel, GET, POST } from "eve/channels";
import { runtimeHealth, runtimeInfo } from "../lib/runtime-metadata.mjs";
import { operationClient } from "../lib/omniseed-client.mjs";
import { runGovernedStewardship } from "../lib/stewardship.mjs";

function authorised(request: Request) {
  const expected = process.env.LILY_RUNTIME_OBSERVATION_TOKEN;
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

function protectedJson(request: Request, body: () => object) {
  if (!authorised(request)) return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  try { return Response.json(body()); }
  catch { return Response.json({ ok: false, error: "runtime_not_configured" }, { status: 503 }); }
}

function authorisedStewardshipTrigger(request: Request, env = process.env) {
  const credentialReference = env.OMNISEED_STEWARDSHIP_TRIGGER_CREDENTIAL_ENV;
  const expected = credentialReference ? env[credentialReference] : undefined;
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function stewardshipTickResponse(
  request: Request,
  client: ReturnType<typeof operationClient> | undefined = undefined,
  now = new Date(),
) {
  if (!authorisedStewardshipTrigger(request)) {
    return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, result: await runGovernedStewardship({ client: client ?? operationClient(), now }) });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "stewardship_tick_failed";
    return Response.json({ ok: false, error: code }, { status: 503 });
  }
}

export default defineChannel({
  routes: [
    GET("/health", async (request) => protectedJson(request, () => runtimeHealth())),
    GET("/info", async (request) => protectedJson(request, () => runtimeInfo())),
    POST("/stewardship/tick", stewardshipTickResponse),
  ],
});
