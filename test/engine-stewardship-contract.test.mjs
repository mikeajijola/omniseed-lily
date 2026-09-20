import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStateStore, OmniSeed, ProviderRegistry } from "@omniseed/engine";
import { OmniSeedOperationClient } from "../agent/lib/omniseed-client.mjs";
import { nextStewardshipOperation, runGovernedStewardship } from "../agent/lib/stewardship.mjs";

const declaration = { metadata: { id: "test_company" }, spec: { stewardship: { autonomy: {
  mode: "autonomous_safe", stateReference: "control", triggers: ["owner_request"],
  limits: { concurrency: 1, dailyChanges: 2, repairRounds: 1, actions: 3 },
  gates: { validation: true, independentReview: true, unchangedHead: true, successfulChecks: true },
  protectedCategories: ["authority"], duties: [], afterMerge: { reconcile: true, observe: true },
} } } };

test("status uses the published Engine handler and returns its actual profile", async () => {
  const engine = new OmniSeed({ providers: new ProviderRegistry(), store: new MemoryStateStore() });
  assert.equal(engine.operations.has("inspect_stewardship"), true);
  assert.equal(engine.operations.has("get_stewardship_status"), false);
  const calls = [];
  const client = new OmniSeedOperationClient({
    bootstrap: { companyRef: "test_company", identity: "steward", endpoint: "https://engine.test", credential: "test-only" },
    fetchImpl: async (url, request) => {
      const operationId = url.match(/operations\/(.*):invoke$/)[1];
      calls.push(operationId);
      const result = await engine.operations.invoke({ id: operationId, permissions: ["stewardship.read"] }, JSON.parse(request.body).input, {
        engine, declaration, authorization: { actorId: "steward", permissions: ["stewardship.read"] },
      });
      return { ok: true, json: async () => ({ result }) };
    },
  });
  const status = await client.invoke("inspect_stewardship", {});
  assert.equal(status.state, "disabled");
  assert.equal(status.limits.concurrency, 1);
  assert.equal(status.usage.active, 0);
  assert.equal((await runGovernedStewardship({ client })).code, "stewardship_disabled");
  assert.deepEqual(calls, ["inspect_stewardship", "inspect_stewardship"]);
});

test("enabled Engine profile is not mistaken for a durable queue or atomic claims", async () => {
  const now = new Date("2026-09-20T00:00:00Z");
  const engine = new OmniSeed({ providers: new ProviderRegistry(), store: new MemoryStateStore() });
  const profile = { ...(await engine.inspectStewardship(declaration, { actorId: "steward", permissions: ["stewardship.read"] })),
    state: "enabled", expiresAt: "2026-09-21T00:00:00Z" };
  const calls = [];
  const result = await runGovernedStewardship({ client: { invoke: async id => { calls.push(id); return profile; } }, now });
  assert.equal(result.code, "stewardship_scheduler_unavailable");
  assert.deepEqual(result.scheduled, []);
  assert.deepEqual(calls, ["inspect_stewardship"]);
  const decision = nextStewardshipOperation({ profile: { ...profile, usage: { ...profile.usage, active: 1 } }, work: {}, now });
  assert.equal(decision.code, "stewardship_concurrency_exhausted");
});
