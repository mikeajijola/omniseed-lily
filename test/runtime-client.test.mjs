import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadBootstrap, OmniSeedOperationClient, OmniSeedClientError } from "../agent/lib/omniseed-client.mjs";
import { loadDeploymentMetadata, runtimeHealth, runtimeInfo } from "../agent/lib/runtime-metadata.mjs";
import { projectCompanyInspection } from "../agent/lib/company-projection.mjs";

const env = {
  OMNISEED_COMPANY_REF: "omniseed_ecosystem",
  OMNISEED_AGENT_IDENTITY: "lily",
  OMNISEED_OPERATION_ENDPOINT: "https://engine.example.test",
  OMNISEED_OPERATION_CREDENTIAL_ENV: "LILY_ENGINE_TOKEN",
  LILY_ENGINE_TOKEN: "secret-value",
};

test("bootstrap contains references and resolves the credential without serialising it", () => {
  const bootstrap = loadBootstrap(env);
  assert.equal(bootstrap.companyRef, "omniseed_ecosystem");
  assert.equal(bootstrap.identity, "lily");
  assert.equal(bootstrap.credentialEnv, "LILY_ENGINE_TOKEN");
  assert.equal(JSON.stringify({ companyRef: bootstrap.companyRef, identity: bootstrap.identity, endpoint: bootstrap.endpoint }), JSON.stringify({ companyRef: "omniseed_ecosystem", identity: "lily", endpoint: "https://engine.example.test" }));
});

test("bootstrap fails closed for missing credentials and insecure production transport", () => {
  assert.throws(() => loadBootstrap({ ...env, LILY_ENGINE_TOKEN: undefined }), (error) => error.code === "credential_unavailable");
  assert.throws(() => loadBootstrap({ ...env, OMNISEED_OPERATION_ENDPOINT: "http://engine.example.test" }), (error) => error.code === "endpoint_insecure");
});

test("client invokes an existing OmniSeed operation with server-derived authority inputs", async () => {
  let request;
  const client = new OmniSeedOperationClient({ bootstrap: loadBootstrap(env), fetchImpl: async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ ok: true, result: { company: { id: "omniseed_ecosystem" } } }) };
  }});
  const result = await client.invoke("inspect_company", {});
  assert.equal(result.company.id, "omniseed_ecosystem");
  assert.match(request.url, /\/v1\/companies\/omniseed_ecosystem\/operations\/inspect_company:invoke$/);
  assert.deepEqual(JSON.parse(request.init.body), { input: {}, actor: { actorId: "lily", actorType: "ai" } });
  assert.equal(JSON.parse(request.init.body).permissions, undefined);
  assert.equal(request.init.headers.authorization, "Bearer secret-value");
});

test("client cannot invoke approval, apply, or arbitrary Provider operations", async () => {
  const client = new OmniSeedOperationClient({ bootstrap: loadBootstrap(env), fetchImpl: async () => assert.fail("network must not be called") });
  for (const operation of ["approve_company_change", "apply_company_change", "github.api", "provider.mutate"]) {
    await assert.rejects(client.invoke(operation, {}), (error) => error.code === "operation_not_allowed");
  }
});

test("Lily self-escalation is denied before network access", async () => {
  const client = new OmniSeedOperationClient({ bootstrap: loadBootstrap(env), fetchImpl: async () => assert.fail("network must not be called") });
  const input = { reason: "Give me merge power", evidence: ["request"], patch: [{ op: "replace", path: "/spec/resources/policies/0/spec/allow", value: ["read", "propose", "approve"], actor: "lily" }] };
  await assert.rejects(client.invoke("propose_company_change", input), (error) => error instanceof OmniSeedClientError && error.code === "self_escalation_denied");
});

test("ordinary proposals remain governed OmniSeed operation calls", async () => {
  let calls = 0;
  const client = new OmniSeedOperationClient({ bootstrap: loadBootstrap(env), fetchImpl: async () => {
    calls += 1;
    return { ok: true, json: async () => ({ ok: true, result: { id: "change_1", status: "proposed" } }) };
  }});
  const result = await client.invoke("propose_company_change", { reason: "Clarify description", evidence: ["evidence_1"], patch: [{ op: "replace", path: "/metadata/name", value: "OmniSeed Ecosystem" }] });
  assert.equal(calls, 1);
  assert.deepEqual(result, { id: "change_1", status: "proposed" });
});

test("engine denial is preserved and never converted into success", async () => {
  const client = new OmniSeedOperationClient({ bootstrap: loadBootstrap(env), fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false, code: "authorization_denied", error: "Missing permission" }) }) });
  await assert.rejects(client.invoke("inspect_company", {}), (error) => error.code === "authorization_denied");
});

test("production EVE channel has no anonymous or local-development authenticator", async () => {
  const source = await readFile(new URL("../agent/channels/eve.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bnone\s*\(/);
  assert.doesNotMatch(source, /\blocalDev\s*\(/);
  assert.match(source, /verifyJwtHmac/);
  assert.match(source, /company_ref/);
  assert.match(source, /OMNISEED_SESSION_CREDENTIAL_ENV/);
  assert.doesNotMatch(source, /process\.env\.LILY_SESSION_JWT_SECRET/);
});

test("agent instructions contain no static ecosystem identity or repository facts", async () => {
  const instructions = await readFile(new URL("../agent/instructions.md", import.meta.url), "utf8");
  assert.doesNotMatch(instructions, /omniseed_ecosystem|mikeajijola\/omniseed-ecosystem-company|Lily is/);
  assert.match(instructions, /inspect the company first/);
});

test("deployment metadata reports immutable runtime identity without credentials or embedded company facts", () => {
  const deployment = { ...env, OMNISEED_ENVIRONMENT: "production", OMNISEED_SOURCE_REPOSITORY: "example/lily", OMNISEED_SOURCE_COMMIT_SHA: "a".repeat(40), LILY_RUNTIME_OBSERVATION_TOKEN: "observation-secret" };
  assert.deepEqual(runtimeHealth(deployment), { ok: true, status: "healthy" });
  assert.deepEqual(runtimeInfo(deployment), { companyRef: "omniseed_ecosystem", agentIdentity: "lily", environment: "production", source: { repository: "example/lily", commitSha: "a".repeat(40) }, agent: { framework: "eve" } });
  assert.doesNotMatch(JSON.stringify(runtimeInfo(deployment)), /secret-value|observation-secret/);
  assert.throws(() => loadDeploymentMetadata({ ...deployment, OMNISEED_SOURCE_COMMIT_SHA: "main" }), /full commit SHA/);
});

test("Vercel build contract is deterministic and contains no credential values", async () => {
  const contract = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(contract.buildCommand, "npm run build:runtime");
  assert.equal(contract.outputDirectory, ".output");
  assert.doesNotMatch(JSON.stringify(contract), /TOKEN|SECRET|omniseed_ecosystem/);
});

test("Agent company inspection is a bounded projection of ordinary OmniSeed state", () => {
  const largePlan = { id: "plan_1", payload: "x".repeat(100_000) };
  const registry = {
    company: { id: "company_1", name: "Company One" },
    instance: { desiredRevision: "a".repeat(40), observedStateRevision: 7 },
    stewardship: { capability: { id: "steward", name: "Steward", state: "realised", realisations: [{ id: "primary" }] }, realisation: { id: "primary", participants: [{ resource: "lily", family: "agents", provider: "vercel", desired: { id: "lily", spec: { implementation: { framework: "eve" } } }, deployed: largePlan, observed: { status: "healthy", evidence: [{ id: "e1", type: "runtime_health", snapshot: largePlan }] } }] } },
    capabilities: [{ id: "operate", name: "Operate", state: "partial", requirements: [{ id: "interface", primitiveFamily: "connectors", covered: false }], realisations: [{ id: "os" }], resolution: largePlan }],
    realisations: [{ id: "os", capability: "operate", participants: [{ resource: "os", family: "connectors", provider: "vercel", deployed: largePlan }] }],
    providers: [{ family: "connectors", providerId: "vercel", state: "connected" }],
    providerGaps: [], operations: [{ id: "inspect_company", description: "Inspect", currentAvailability: "available", handler: largePlan }],
    evidence: Array.from({ length: 30 }, (_, index) => ({ id: `e${index}`, type: "observation", snapshot: largePlan })),
    history: Array.from({ length: 30 }, (_, index) => ({ type: "observed", at: index })),
    plans: [largePlan], definitionHash: "hash",
  };
  const projection = projectCompanyInspection(registry);
  assert.equal(projection.capabilities[0].state, "partial");
  assert.equal(projection.realisations[0].participants[0].provider, "vercel");
  assert.equal(projection.evidence.length, 20);
  assert.equal(projection.activity.length, 20);
  assert.equal("plans" in projection, false);
  assert.equal("deployed" in projection.realisations[0].participants[0], false);
  assert.ok(JSON.stringify(projection).length < 20_000);
});
