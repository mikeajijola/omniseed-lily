import test from "node:test";
import assert from "node:assert/strict";
import { invokeStewardshipControl, nextStewardshipOperation, prioritizeStewardshipWork, runGovernedStewardship, runStewardshipStep, stewardshipControlIntent } from "../agent/lib/stewardship.mjs";

const now = new Date("2026-09-01T00:00:00Z");
const revision = "status-revision-1";
const profile = { state: "enabled", expiresAt: "2026-09-02T00:00:00Z", limits: { maxConcurrentWork: 2 }, usage: { concurrentWork: 0 } };
const proposal = { reason: "Close evidenced drift", evidence: ["e1"], patch: [{ op: "replace", path: "/metadata/name", value: "Company" }] };
const claim = workIds => ({
  revision,
  profile: { ...profile, usage: { concurrentWork: workIds.length } },
  claims: workIds.map((workId, index) => ({ workId, claimId: `claim-${index}`, leaseExpiresAt: "2026-09-01T00:05:00Z" })),
});

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

test("protected changes pause before any governed operation", async () => {
  const protectedProfile = { ...profile, protectedCategories: ["authority", "credentials"] };
  for (const work of [
    { proposal, category: "authority" },
    { proposal, protectedChange: true },
  ]) {
    const calls = [];
    const result = await runStewardshipStep({ client: { invoke: async (...args) => calls.push(args) }, profile: protectedProfile, work, now });
    assert.equal(result.code, "stewardship_protected_change");
    assert.deepEqual(calls, []);
  }
});

test("runtime scheduler preserves the governed protected-category boundary", async () => {
  const protectedProfile = { ...profile, protectedCategories: ["credentials"] };
  const calls = [];
  const client = { invoke: async (operation, input) => {
    calls.push(operation);
    if (operation === "get_stewardship_status") {
      return { revision, profile: protectedProfile, work: [{ id: "secret", kind: "gap", category: "credentials", proposal }] };
    }
    if (operation === "claim_stewardship_work") return {
      ...claim(input.workIds),
      profile: { ...protectedProfile, usage: { concurrentWork: input.workIds.length } },
    };
    assert.fail("protected work reached a change operation");
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.status, "paused");
  assert.equal(result.scheduled[0].code, "stewardship_protected_change");
  assert.deepEqual(calls, ["get_stewardship_status", "claim_stewardship_work"]);
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
    { revision, profile, work: [{ ...durable }] },
    { revision, profile, work: [{ ...durable, previewed: true }] },
    { revision, profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" } }] },
    { revision, profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true }] },
    { revision, profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true, reconciliationRequested: true, reconciled: true }] },
    { revision, profile, work: [{ ...durable, previewed: true, submissionRequested: true, review: { status: "approved" }, checks: { status: "successful" }, mergeRequested: true, merged: true, reconciliationRequested: true, reconciled: true, observed: true, evidence: ["observed-1"] }] },
  ];
  const calls = [];
  const client = { invoke: async (operation, input) => {
    calls.push({ operation, input });
    if (operation === "get_stewardship_status") return snapshots.shift();
    if (operation === "claim_stewardship_work") return claim(input.workIds);
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
  for (const [governedProfile, code, activeWork = []] of [
    [{ ...profile, expiresAt: now.toISOString() }, "stewardship_expired"],
    [{ ...profile, killSwitch: true }, "stewardship_disabled"],
    [{ ...profile, state: "paused" }, "stewardship_paused"],
    [{ ...profile, usage: { concurrentWork: 2 } }, "stewardship_concurrency_exhausted", [{ id: "active-1" }, { id: "active-2" }]],
  ]) {
    const calls = [];
    const client = { invoke: async (operation) => {
      calls.push(operation);
      if (operation === "get_stewardship_status") return { revision, profile: governedProfile, activeWork, work: proposalWork };
      assert.fail("scheduler crossed a governed boundary");
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.code, code);
    assert.deepEqual(calls, ["get_stewardship_status"]);
  }
});

test("runtime scheduler fails closed without valid Engine concurrency authority", async () => {
  const proposalWork = [{ id: "new", kind: "gap", proposal }];
  const invalidConcurrencyProfiles = [
    { ...profile, limits: {}, usage: { concurrentWork: 0 } },
    { ...profile, limits: { maxConcurrentWork: "2" }, usage: { concurrentWork: 0 } },
    { ...profile, limits: { maxConcurrentWork: -1 }, usage: { concurrentWork: 0 } },
    { ...profile, limits: { maxConcurrentWork: 2 }, usage: {} },
    { ...profile, limits: { maxConcurrentWork: 2 }, usage: { concurrentWork: 0.5 } },
    { ...profile, limits: { maxConcurrentWork: 2 }, usage: { concurrentWork: -1 } },
    { ...profile, limits: { maxConcurrentWork: 1 }, usage: { concurrentWork: 2 } },
  ];
  for (const governedProfile of invalidConcurrencyProfiles) {
    const calls = [];
    const client = { invoke: async (operation) => {
      calls.push(operation);
      if (operation === "get_stewardship_status") return { revision, profile: governedProfile, work: proposalWork };
      assert.fail("scheduler ran work without valid concurrency authority");
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.code, "stewardship_concurrency_invalid");
    assert.deepEqual(result.scheduled, []);
    assert.deepEqual(calls, ["get_stewardship_status"]);
  }
});

test("runtime scheduler processes only mutually declared, current independent concurrency", async () => {
  let running = 0, peak = 0;
  const work = Array.from({ length: 4 }, (_, index) => ({ id: `w${index}`, kind: "drift", proposal,
    concurrency: { revision, independent: true, dependencies: [], conflicts: [], independentOf: Array.from({ length: 4 }, (_, other) => `w${other}`).filter(id => id !== `w${index}`) },
  }));
  const calls = [];
  const client = { invoke: async (operation, input) => {
    if (operation === "get_stewardship_status") return { revision, profile, work };
    if (operation === "claim_stewardship_work") return claim(input.workIds);
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

test("active work requires current mutual independence evidence before new work is claimed", async () => {
  const activeProfile = { ...profile, usage: { concurrentWork: 1 } };
  const active = { id: "active", kind: "drift" };
  for (const candidate of [
    { id: "new", kind: "gap", proposal },
    { id: "new", kind: "gap", proposal, concurrency: {
      revision, independent: true, dependencies: [], conflicts: [], independentOf: ["active"],
    } },
  ]) {
    const calls = [];
    const client = { invoke: async (operation) => {
      calls.push(operation);
      if (operation === "get_stewardship_status") return { revision, profile: activeProfile, activeWork: [active], work: [candidate] };
      assert.fail("work without mutual active-work evidence was claimed");
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.code, "stewardship_concurrency_evidence_required");
    assert.deepEqual(calls, ["get_stewardship_status"]);
  }
});

test("an active count without governed active-work identities pauses before claiming", async () => {
  let claimed = false;
  const client = { invoke: async (operation) => {
    if (operation === "get_stewardship_status") return {
      revision, profile: { ...profile, usage: { concurrentWork: 1 } }, work: [{ id: "new", kind: "gap", proposal }],
    };
    claimed = true;
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.code, "stewardship_concurrency_evidence_required");
  assert.deepEqual(result.scheduled, []);
  assert.equal(claimed, false);
});

test("missing or duplicate governed work identities pause before claiming", async () => {
  for (const work of [
    [{ kind: "gap", proposal }],
    [{ id: "duplicate", kind: "gap", proposal }, { id: "duplicate", kind: "drift", proposal }],
  ]) {
    const calls = [];
    const client = { invoke: async (operation) => {
      calls.push(operation);
      if (operation === "get_stewardship_status") return { revision, profile, work };
      assert.fail("work without a unique durable identity was claimed");
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.code, "stewardship_work_identity_invalid");
    assert.deepEqual(result.scheduled, []);
    assert.deepEqual(calls, ["get_stewardship_status"]);
  }
});

test("new work with current mutual evidence may run alongside identified active work", async () => {
  const evidence = independentOf => ({ revision, independent: true, dependencies: [], conflicts: [], independentOf });
  const activeProfile = { ...profile, usage: { concurrentWork: 1 } };
  const activeWork = [{ id: "active", kind: "drift", concurrency: evidence(["new"]) }];
  const work = [{ id: "new", kind: "gap", proposal, concurrency: evidence(["active"]) }];
  const claimed = [];
  const client = { invoke: async (operation, input) => {
    if (operation === "get_stewardship_status") return { revision, profile: activeProfile, activeWork, work };
    if (operation === "claim_stewardship_work") {
      claimed.push(...input.workIds);
      return { ...claim(input.workIds), profile: { ...profile, usage: { concurrentWork: 2 } } };
    }
    return { accepted: true };
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.status, "scheduled");
  assert.deepEqual(claimed, ["new"]);
});

test("runtime review repair is Engine-provided and remains a replacement proposal", async () => {
  const repair = { ...proposal, reason: "Repair independent findings" };
  const reviewed = { id: "repair", kind: "failed_operation", proposalId: "p1", sessionId: "s1", previewed: true, submissionRequested: true, review: { status: "failed", findings: ["f1"] }, repair };
  const calls = [];
  const client = { invoke: async (operation, input) => {
    calls.push({ operation, input });
    if (operation === "get_stewardship_status") return { revision, profile, work: [reviewed] };
    if (operation === "claim_stewardship_work") return claim(input.workIds);
    return { id: "p2", sessionId: "s1" };
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.scheduled[0].operation, "propose_company_change");
  assert.deepEqual(calls[2].input, {
    ...repair,
    supersedesProposalId: "p1",
    stewardshipClaim: { workId: "repair", claimId: "claim-0", leaseExpiresAt: "2026-09-01T00:05:00Z", revision },
  });
});

test("every scheduled operation carries the Engine claim, lease, work, and snapshot revision", async () => {
  const invocations = [];
  const work = [{ id: "bound", kind: "gap", proposal }];
  const client = { invoke: async (operation, input) => {
    if (operation === "get_stewardship_status") return { revision, profile, work };
    if (operation === "claim_stewardship_work") return claim(input.workIds);
    invocations.push({ operation, input });
    return { accepted: true };
  } };
  await runGovernedStewardship({ client, now });
  assert.deepEqual(invocations, [{ operation: "propose_company_change", input: {
    ...proposal,
    stewardshipClaim: { workId: "bound", claimId: "claim-0", leaseExpiresAt: "2026-09-01T00:05:00Z", revision },
  } }]);
});

test("simultaneous ticks use atomic Engine claims to suppress duplicates", async () => {
  const work = [{ id: "same", kind: "gap", proposal }];
  let owner;
  let scheduled = 0;
  const client = { invoke: async (operation, input) => {
    if (operation === "get_stewardship_status") return { revision, profile, work };
    if (operation === "claim_stewardship_work") {
      if (owner) return { revision, profile: { ...profile, usage: { concurrentWork: 1 } }, claims: [] };
      owner = input.workIds[0];
      await Promise.resolve();
      return claim(input.workIds);
    }
    scheduled += 1;
    return { accepted: true };
  } };
  const results = await Promise.all([
    runGovernedStewardship({ client, now }),
    runGovernedStewardship({ client, now }),
  ]);
  assert.equal(scheduled, 1);
  assert.deepEqual(results.map(result => result.status).sort(), ["paused", "scheduled"]);
  assert.equal(results.find(result => result.status === "paused").code, "stewardship_claim_unavailable");
});

test("claim denial or malformed and expired leases fail closed", async () => {
  const work = [{ id: "w", kind: "gap", proposal }];
  for (const claimResponse of [
    Object.assign(new Error("denied"), { code: "claim_denied" }),
    { revision, profile: { ...profile, usage: { concurrentWork: 1 } }, claims: [{ claimId: "c", leaseExpiresAt: "2026-09-01T00:05:00Z" }] },
    { profile, claims: [{ workId: "w", claimId: "c", leaseExpiresAt: now.toISOString() }] },
    { profile, claims: [{ workId: "other", claimId: "c", leaseExpiresAt: "2026-09-01T00:05:00Z" }] },
  ]) {
    let scheduled = false;
    const client = { invoke: async (operation) => {
      if (operation === "get_stewardship_status") return { revision, profile, work };
      if (operation === "claim_stewardship_work") {
        if (claimResponse instanceof Error) throw claimResponse;
        return claimResponse;
      }
      scheduled = true;
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.status, "paused");
    assert.equal(scheduled, false);
  }
});

test("claim-time revision or concurrency changes fail closed before scheduling", async () => {
  const work = ["a", "b"].map((id, index, all) => ({
    id, kind: "gap", proposal,
    concurrency: { revision, independent: true, dependencies: [], conflicts: [], independentOf: all.filter(other => other !== id) },
  }));
  const invalidClaims = [
    { ...claim(["a", "b"]), revision: "new-revision" },
    { ...claim(["a", "b"]), profile: { ...profile, limits: { maxConcurrentWork: 1 }, usage: { concurrentWork: 1 } } },
    { ...claim(["a", "b"]), profile: { ...profile, usage: { concurrentWork: 1 } } },
  ];
  for (const claimResponse of invalidClaims) {
    let scheduled = false;
    const client = { invoke: async (operation) => {
      if (operation === "get_stewardship_status") return { revision, profile, work };
      if (operation === "claim_stewardship_work") return claimResponse;
      scheduled = true;
    } };
    const result = await runGovernedStewardship({ client, now });
    assert.equal(result.code, "stewardship_claim_invalid");
    assert.deepEqual(result.scheduled, []);
    assert.equal(scheduled, false);
  }
});

test("missing, stale, dependent, conflicting, or asymmetric evidence is never parallelized", async () => {
  const evidence = (independentOf, extras = {}) => ({ revision, independent: true, dependencies: [], conflicts: [], independentOf, ...extras });
  const cases = [
    [{}, {}],
    [{ concurrency: evidence(["b"], { revision: "stale" }) }, { concurrency: evidence(["a"], { revision: "stale" }) }],
    [{ concurrency: evidence(["b"], { dependencies: ["b"], independentOf: [] }) }, { concurrency: evidence(["a"]) }],
    [{ concurrency: evidence([], { conflicts: ["b"] }) }, { concurrency: evidence(["a"]) }],
    [{ concurrency: evidence(["b"]) }, { concurrency: evidence([]) }],
  ];
  for (const [left, right] of cases) {
    const claimedIds = [];
    const client = { invoke: async (operation, input) => {
      if (operation === "get_stewardship_status") return { revision, profile, work: [
        { id: "a", kind: "gap", proposal, ...left }, { id: "b", kind: "gap", proposal, ...right },
      ] };
      if (operation === "claim_stewardship_work") {
        claimedIds.push(...input.workIds);
        return claim(input.workIds);
      }
      return { accepted: true };
    } };
    await runGovernedStewardship({ client, now });
    assert.equal(claimedIds.length, 1);
  }
});

test("disable race returned by atomic claim prevents every scheduled operation", async () => {
  let scheduled = false;
  const disabled = { ...profile, state: "disabled", killSwitch: true };
  const client = { invoke: async (operation) => {
    if (operation === "get_stewardship_status") return { revision, profile, work: [{ id: "w", kind: "gap", proposal }] };
    if (operation === "claim_stewardship_work") return { profile: disabled, claims: [] };
    scheduled = true;
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.equal(result.code, "stewardship_disabled");
  assert.equal(scheduled, false);
});

test("disablement after a successful claim is enforced by the bound governed operation", async () => {
  let operationInput;
  const client = { invoke: async (operation, input) => {
    if (operation === "get_stewardship_status") return { revision, profile, work: [{ id: "w", kind: "gap", proposal }] };
    if (operation === "claim_stewardship_work") return claim(input.workIds);
    operationInput = input;
    throw Object.assign(new Error("disabled after claim"), { code: "stewardship_disabled" });
  } };
  const result = await runGovernedStewardship({ client, now });
  assert.deepEqual(operationInput.stewardshipClaim, {
    workId: "w", claimId: "claim-0", leaseExpiresAt: "2026-09-01T00:05:00Z", revision,
  });
  assert.equal(result.status, "paused");
  assert.equal(result.scheduled[0].status, "paused");
  assert.equal(result.scheduled[0].code, "stewardship_disabled");
});
