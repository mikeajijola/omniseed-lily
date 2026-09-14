import test from "node:test";
import assert from "node:assert/strict";
import { invokeStewardshipControl, nextStewardshipOperation, prioritizeStewardshipWork, runStewardshipStep, stewardshipControlIntent } from "../agent/lib/stewardship.mjs";

const now = new Date("2026-09-01T00:00:00Z");
const profile = { state: "enabled", expiresAt: "2026-09-02T00:00:00Z", limits: { maxConcurrentWork: 2 }, usage: { concurrentWork: 0 } };
const proposal = { reason: "Close evidenced drift", evidence: ["e1"], patch: [{ op: "replace", path: "/metadata/name", value: "Company" }] };

test("conversational meanings become authenticated governed control operations", async () => {
  assert.deepEqual(stewardshipControlIntent("enable", { amount: 24, unit: "hour" }, now), {
    action: "enable", operation: "request_stewardship_enablement", input: { durationSeconds: 86_400, requestedExpiresAt: "2026-09-02T00:00:00.000Z" },
  });
  assert.equal(stewardshipControlIntent("status").operation, "get_stewardship_status");
  assert.equal(stewardshipControlIntent("pause").operation, "request_stewardship_pause");
  assert.equal(stewardshipControlIntent("disable").operation, "request_stewardship_disablement");
  assert.equal(stewardshipControlIntent("enable", {}).code, "bounded_duration_required");
  const calls = [], client = { invoke: async (operation, input) => (calls.push({ operation, input }), { state: "paused" }) };
  assert.deepEqual(await invokeStewardshipControl(client, stewardshipControlIntent("pause")), { state: "paused" });
  assert.deepEqual(calls, [{ operation: "request_stewardship_pause", input: {} }]);
});

test("safe autonomous completion schedules one governed request per durable step", () => {
  const states = [
    [{ proposal }, "propose_company_change"],
    [{ proposalId: "p", sessionId: "s" }, "preview_company_change"],
    [{ proposalId: "p", sessionId: "s", previewed: true }, "request_company_change_submission"],
    [{ proposalId: "p", sessionId: "s", previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" } }, "request_company_change_merge"],
    [{ proposalId: "p", sessionId: "s", previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true }, "request_reconciliation"],
    [{ proposalId: "p", sessionId: "s", previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true, reconciliationRequested: true, reconciled: true }, "observe_company"],
  ];
  for (const [work, operation] of states) assert.equal(nextStewardshipOperation({ profile, work, now }).operation, operation);
  const complete = nextStewardshipOperation({ profile, work: { ...states.at(-1)[0], observed: true, evidence: ["e2"] }, now });
  assert.equal(complete.code, "stewardship_completed");
  for (const [, operation] of states) assert.doesNotMatch(operation, /^(?:apply|merge|approve)_/);
});

test("objectives, drift, gaps, and failures are prioritised deterministically", () => {
  const work = [
    { id: "objective", kind: "owner_objective", severity: 9 },
    { id: "gap", kind: "gap", severity: 2 },
    { id: "drift-low", kind: "drift", severity: 1 },
    { id: "failure", kind: "failed_operation", severity: 1 },
    { id: "drift-high", kind: "drift", severity: 5 },
  ];
  assert.deepEqual(prioritizeStewardshipWork(work).map(item => item.id), ["failure", "drift-high", "drift-low", "gap", "objective"]);
});

test("expiry, kill switch, owner pause, and concurrency are evaluated before scheduling", () => {
  assert.equal(nextStewardshipOperation({ profile, work: { proposal }, now: new Date("2026-09-02T00:00:00Z") }).code, "stewardship_expired");
  assert.equal(nextStewardshipOperation({ profile: { ...profile, killSwitch: true }, work: { proposal }, now }).code, "stewardship_disabled");
  assert.equal(nextStewardshipOperation({ profile: { ...profile, state: "paused" }, work: { proposal }, now }).code, "stewardship_paused");
  assert.equal(nextStewardshipOperation({ profile: { ...profile, usage: { concurrentWork: 2 } }, work: { proposal }, now }).code, "stewardship_concurrency_exhausted");
  assert.equal(nextStewardshipOperation({ profile, work: { proposal, denial: { code: "stewardship_owner_approval_required" } }, now }).code, "stewardship_owner_approval_required");
});

test("failed independent review pauses or produces an exact replacement proposal", () => {
  const work = { proposalId: "p1", sessionId: "s", previewed: true, submissionRequested: true, review: { status: "failed", findings: ["f1"] } };
  assert.equal(nextStewardshipOperation({ profile, work, now }).code, "stewardship_review_failed");
  const decision = nextStewardshipOperation({ profile, work, repair: proposal, now });
  assert.equal(decision.operation, "propose_company_change");
  assert.equal(decision.input.supersedesProposalId, "p1");
});

test("durable step resumes the same session and never performs more than one operation", async () => {
  const calls = [], client = { invoke: async (operation, input) => (calls.push({ operation, input }), { accepted: true }) };
  const result = await runStewardshipStep({ client, profile, work: { proposalId: "p", sessionId: "durable-1" }, now });
  assert.equal(result.sessionId, "durable-1");
  assert.equal(result.operation, "preview_company_change");
  assert.equal(calls.length, 1);
});
