import test from "node:test";
import assert from "node:assert/strict";
import { invokeStewardshipControl, nextStewardshipOperation, prioritizeStewardshipWork, runGovernedStewardship, runStewardshipStep, stewardshipControlIntent } from "../agent/lib/stewardship.mjs";

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

test("runtime scheduler discovers authority and resumes durable state from the Engine on every tick", async () => {
  const durable = { id: "work-1", kind: "drift", proposalId: "p", sessionId: "durable-1" };
  const snapshots = [
    { profile, work: [{ ...durable }] },
    { profile, work: [{ ...durable, previewed: true }] },
    { profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" } }] },
    { profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true }] },
    { profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true, reconciliationRequested: true, reconciled: true }] },
    { profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true, reconciliationRequested: true, reconciled: true, observed: true, evidence: ["observed-1"] }] },
  ];
  const calls = [];
  const client = { invoke: async (operation, input) => {
    calls.push({ operation, input });
    if (operation === "get_stewardship_status") return snapshots.shift();
    return { accepted: true };
  } };

  const results = [];
  while (snapshots.length) results.push(await runGovernedStewardship({ client, now }));
  assert.deepEqual(results.map(result => result.scheduled[0].operation), [
    "preview_company_change",
    "request_company_change_submission",
    "request_company_change_merge",
    "request_reconciliation",
    "observe_company",
    null,
  ]);
  assert.equal(results[4].scheduled[0].sessionId, "durable-1");
  assert.equal(results[5].scheduled[0].code, "stewardship_completed");
  assert.equal(calls.filter(call => call.operation === "get_stewardship_status").length, 6);
});

test("runtime scheduler obeys Engine expiry, kill switch, owner pause, and concurrency", async () => {
  const proposalWork = [{ id: "new", kind: "gap", proposal }];
  for (const [governedProfile, code] of [
    [{ ...profile, expiresAt: now.toISOString() }, "stewardship_expired"],
    [{ ...profile, killSwitch: true }, "stewardship_disabled"],
    [{ ...profile, state: "paused" }, "stewardship_paused"],
    [{ ...profile, usage: { concurrentWork: 2 } }, "stewardship_concurrency_exhausted"],
  ]) {
    const calls = [];
    const client = { invoke: async (operation) => {
      calls.push(operation);
      if (operation === "get_stewardship_status") return { profile: governedProfile, work: proposalWork };
      assert.fail("scheduler crossed a governed boundary");
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.code, code);
    assert.deepEqual(calls, ["get_stewardship_status"]);
  }
});

test("runtime scheduler processes only declared independent concurrency", async () => {
  let running = 0, peak = 0;
  const work = Array.from({ length: 4 }, (_, index) => ({ id: `w${index}`, kind: "drift", proposal }));
  const calls = [];
  const client = { invoke: async (operation) => {
    if (operation === "get_stewardship_status") return { profile, work };
    calls.push(operation);
    running += 1;
    peak = Math.max(peak, running);
    await Promise.resolve();
    running -= 1;
    return { sessionId: `s${calls.length}` };
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.scheduled.length, 2);
  assert.equal(peak, 2);
  assert.deepEqual(calls, ["propose_company_change", "propose_company_change"]);
});

test("runtime review repair is Engine-provided and remains a replacement proposal", async () => {
  const repair = { ...proposal, reason: "Repair independent findings" };
  const reviewed = { id: "repair", kind: "failed_operation", proposalId: "p1", sessionId: "s1", previewed: true, submissionRequested: true, review: { status: "failed", findings: ["f1"] }, repair };
  const calls = [];
  const client = { invoke: async (operation, input) => {
    calls.push({ operation, input });
    if (operation === "get_stewardship_status") return { profile, work: [reviewed] };
    return { id: "p2", sessionId: "s1" };
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.scheduled[0].operation, "propose_company_change");
  assert.deepEqual(calls[1].input, { ...repair, supersedesProposalId: "p1" });
});
