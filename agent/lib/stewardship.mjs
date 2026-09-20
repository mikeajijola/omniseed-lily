const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

const CONTROL_OPERATIONS = Object.freeze({
  status: "inspect_stewardship",
  enable: "request_stewardship_enablement",
  pause: "request_stewardship_pause",
  disable: "request_stewardship_disablement",
});

export function stewardshipControlIntent(action, options = {}, now = new Date()) {
  if (!(action in CONTROL_OPERATIONS)) return { action: "invalid", code: "unsupported_stewardship_control" };
  if (action !== "enable") return { action, operation: CONTROL_OPERATIONS[action], input: {} };
  const amount = Number(options.amount);
  const unit = options.unit;
  if (!Number.isInteger(amount) || amount < 1 || !["hour", "day"].includes(unit)) {
    return { action: "invalid", code: "bounded_duration_required" };
  }
  const durationMs = amount * (unit === "day" ? DAY_MS : HOUR_MS);
  const requestedExpiry = new Date(now.getTime() + durationMs);
  if (!Number.isSafeInteger(durationMs) || !Number.isFinite(requestedExpiry.getTime())) {
    return { action: "invalid", code: "bounded_duration_required" };
  }
  return { action, operation: CONTROL_OPERATIONS[action], input: {
    durationSeconds: durationMs / 1_000,
    requestedExpiresAt: requestedExpiry.toISOString(),
  } };
}

export async function invokeStewardshipControl(client, intent) {
  if (!intent?.operation || intent.action === "invalid") return { status: "paused", code: intent?.code ?? "invalid_stewardship_control" };
  return client.invoke(intent.operation, intent.input);
}

const WORK_KIND_PRIORITY = Object.freeze({ failed_operation: 0, drift: 1, gap: 2, owner_objective: 3 });

export function prioritizeStewardshipWork(items = []) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftPriority = WORK_KIND_PRIORITY[left.item.kind] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = WORK_KIND_PRIORITY[right.item.kind] ?? Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority || (right.item.severity ?? 0) - (left.item.severity ?? 0) || left.index - right.index;
    })
    .map(({ item }) => item);
}

function pause(code, details) {
  return Object.freeze({ operation: null, code, ...(details === undefined ? {} : { details }) });
}

function concurrencyState(profile) {
  const limit = profile.limits?.concurrency ?? profile.limits?.maxConcurrentWork ?? profile.maxConcurrentWork;
  const active = profile.usage?.active ?? profile.usage?.concurrentWork ?? profile.activeWorkCount;
  if (!Number.isInteger(limit) || limit < 0 || !Number.isInteger(active) || active < 0 || active > limit) {
    return { boundary: pause("stewardship_concurrency_invalid", { active, limit }) };
  }
  return { active, limit };
}

function profileBoundary(profile, work, now) {
  if (!profile) return pause("stewardship_not_declared");
  if (profile.killSwitch === true || profile.state === "disabled") return pause("stewardship_disabled");
  if (profile.state === "paused") return pause("stewardship_paused");
  if (profile.state !== "enabled") return pause(`stewardship_${profile.state ?? "not_declared"}`);
  const expiry = Date.parse(profile.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) return pause("stewardship_expired", { expiresAt: profile.expiresAt });
  if (work.denial) return pause(work.denial.code ?? "stewardship_denied", work.denial.details);
  const protectedCategories = profile.protectedCategories ?? profile.limits?.protectedCategories ?? [];
  if (!Array.isArray(protectedCategories) || protectedCategories.some(category => typeof category !== "string" || !category)) {
    return pause("stewardship_protected_categories_invalid");
  }
  if (work.protectedChange === true || (typeof work.category === "string" && protectedCategories.includes(work.category))) {
    return pause("stewardship_protected_change", { category: work.category });
  }
  const concurrency = concurrencyState(profile);
  if (concurrency.boundary) return concurrency.boundary;
  if (!work.sessionId && !work.claimId && concurrency.active >= concurrency.limit) {
    return pause("stewardship_concurrency_exhausted", { active: concurrency.active, limit: concurrency.limit });
  }
  return null;
}

export function nextStewardshipOperation({ profile, work = {}, repair, now = new Date() }) {
  const boundary = profileBoundary(profile, work, now);
  if (boundary) return boundary;
  if (!work.proposalId) {
    if (!work.proposal) return pause("stewardship_work_input_required");
    return { operation: "propose_company_change", input: work.proposal };
  }
  if (!work.previewed) return { operation: "preview_company_change", input: { proposalId: work.proposalId } };
  if (!work.sessionId) return pause("durable_session_required", { proposalId: work.proposalId });
  if (!work.submissionRequested) return { operation: "request_company_change_submission", input: { proposalId: work.proposalId, sessionId: work.sessionId } };
  if (work.review?.status === "failed") {
    if (!repair) return pause("stewardship_review_failed", { proposalId: work.proposalId, findings: work.review.findings });
    return { operation: "propose_company_change", input: { ...repair, supersedesProposalId: work.proposalId } };
  }
  if (work.review?.status !== "approved" || work.checks?.status !== "successful") return pause("waiting_for_independent_review", { proposalId: work.proposalId });
  if (!work.mergeRequested) return { operation: "request_company_change_merge", input: { proposalId: work.proposalId, sessionId: work.sessionId } };
  if (!work.merged) return pause("waiting_for_governed_merge", { proposalId: work.proposalId });
  if (!work.reconciliationRequested) return { operation: "request_reconciliation", input: { sessionId: work.sessionId, proposalId: work.proposalId } };
  if (!work.reconciled) return pause("waiting_for_reconciliation", { proposalId: work.proposalId });
  if (!work.observed) return { operation: "observe_company", input: {} };
  return pause("stewardship_completed", { proposalId: work.proposalId, evidence: work.evidence ?? [] });
}

export async function runStewardshipStep({ client, profile, work, repair, claim, revision, now = new Date() }) {
  const decision = nextStewardshipOperation({ profile, work, repair, now });
  if (!decision.operation) return { status: "paused", ...decision };
  const input = claim ? {
    ...decision.input,
    stewardshipClaim: {
      workId: work.id,
      claimId: claim.claimId,
      leaseExpiresAt: claim.leaseExpiresAt,
      revision,
    },
  } : decision.input;
  const result = await client.invoke(decision.operation, input);
  return { status: "scheduled", operation: decision.operation, sessionId: work?.sessionId ?? result?.sessionId, result };
}

function governedSnapshot(result) {
  const profile = result?.profile;
  const work = result?.work;
  if (!profile || !Array.isArray(work)) {
    throw new TypeError("inspect_stewardship must return an Engine-governed profile and work array");
  }
  if (typeof result.revision !== "string" || !result.revision) {
    throw new TypeError("inspect_stewardship must return a durable revision for atomic claims");
  }
  const concurrency = concurrencyState(profile);
  if (concurrency.boundary) return { profile, work, revision: result.revision, activeWork: [] };
  const workIds = work.map(item => item?.id);
  if (workIds.some(id => typeof id !== "string" || !id) || new Set(workIds).size !== workIds.length) {
    return {
      profile, work, revision: result.revision, activeWork: [],
      workBoundary: pause("stewardship_work_identity_invalid"),
    };
  }
  const activeWork = result.activeWork ?? [];
  if (!Array.isArray(activeWork) || activeWork.length !== concurrency.active ||
      new Set(activeWork.map(item => item?.id)).size !== activeWork.length ||
      activeWork.some(item => typeof item?.id !== "string" || !item.id)) {
    return {
      profile, work, revision: result.revision, activeWork: [],
      activeWorkBoundary: pause("stewardship_concurrency_evidence_required", { active: concurrency.active }),
    };
  }
  return { profile, work, revision: result.revision, activeWork };
}

function parallelEvidence(work, revision) {
  const evidence = work?.concurrency;
  if (!evidence || evidence.revision !== revision || evidence.independent !== true ||
      !Array.isArray(evidence.dependencies) || !Array.isArray(evidence.conflicts) ||
      !Array.isArray(evidence.independentOf)) return null;
  const fields = [evidence.dependencies, evidence.conflicts, evidence.independentOf];
  if (fields.some(values => values.some(value => typeof value !== "string" || !value)) ||
      new Set(fields.flat()).size !== fields.flat().length || fields.flat().includes(work.id)) return null;
  return evidence;
}

function mutuallyIndependent(left, right, revision) {
  const leftEvidence = parallelEvidence(left, revision);
  const rightEvidence = parallelEvidence(right, revision);
  return leftEvidence && rightEvidence &&
    leftEvidence.independentOf.includes(right.id) && rightEvidence.independentOf.includes(left.id) &&
    !leftEvidence.dependencies.includes(right.id) && !rightEvidence.dependencies.includes(left.id) &&
    !leftEvidence.conflicts.includes(right.id) && !rightEvidence.conflicts.includes(left.id);
}

function safelyConcurrentWork(work, activeWork, revision, limit) {
  const ordered = prioritizeStewardshipWork(work);
  if (limit === 0) return [];
  const selected = [];
  for (const candidate of ordered) {
    // A durable continuation may be the active work itself. Every other item
    // needs current, mutual Engine evidence against both already-active work
    // and work selected by this tick.
    const concurrentWith = [
      ...activeWork.filter(active => active.id !== candidate.id),
      ...selected,
    ];
    const compatible = concurrentWith.length === 0 ||
      concurrentWith.every(other => mutuallyIndependent(candidate, other, revision));
    if (compatible) selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

function governedClaims(result, requestedIds, expectedRevision, now) {
  if (!result || !Array.isArray(result.claims)) throw new TypeError("claim_stewardship_work must return governed claims");
  if (typeof result.revision !== "string" || result.revision !== expectedRevision) {
    throw new TypeError("claim_stewardship_work returned claims for a different revision");
  }
  const concurrency = concurrencyState(result.profile);
  if (concurrency.boundary || result.claims.length > concurrency.limit || result.claims.length > concurrency.active) {
    throw new TypeError("claim_stewardship_work returned claims outside current concurrency capacity");
  }
  if (requestedIds.some(id => typeof id !== "string" || !id) || new Set(requestedIds).size !== requestedIds.length) {
    throw new TypeError("claim_stewardship_work requires unique non-empty work identities");
  }
  const requested = new Set(requestedIds);
  const seen = new Set();
  const claims = new Map();
  for (const claim of result.claims) {
    const expiry = Date.parse(claim?.leaseExpiresAt);
    if (typeof claim?.workId !== "string" || !claim.workId || !requested.has(claim.workId) || seen.has(claim.workId) ||
        typeof claim.claimId !== "string" || !claim.claimId ||
        !Number.isFinite(expiry) || expiry <= now.getTime()) {
      throw new TypeError("claim_stewardship_work returned an invalid claim");
    }
    seen.add(claim.workId);
    claims.set(claim.workId, claim);
  }
  return claims;
}

/**
 * Run one durable scheduler tick.  The caller supplies no profile or work
 * state: both are fetched from the authenticated Engine on every tick, so a
 * resumed deployment cannot reuse stale authority or session state.
 */
export async function runGovernedStewardship({ client, now = new Date() }) {
  const status = await client.invoke("inspect_stewardship", {});
  // The published Engine returns its effective profile, not a durable queue.
  // Never synthesize work, claims, or a revision from that read-only profile.
  if (!status?.profile || !Array.isArray(status.work) || !status.revision) {
    const boundary = profileBoundary(status, {}, now);
    return { status: "paused", ...(boundary ?? pause("stewardship_scheduler_unavailable")), scheduled: [] };
  }
  const snapshot = governedSnapshot(status);
  const { profile } = snapshot;
  const boundary = profileBoundary(profile, {}, now);
  if (boundary && boundary.code !== "stewardship_concurrency_exhausted") {
    return { status: "paused", ...boundary, scheduled: [] };
  }
  if (snapshot.activeWorkBoundary) {
    return { status: "paused", ...snapshot.activeWorkBoundary, scheduled: [] };
  }
  if (snapshot.workBoundary) {
    return { status: "paused", ...snapshot.workBoundary, scheduled: [] };
  }

  const { limit, active } = concurrencyState(profile);
  const available = limit - active;
  let newWorkSlots = available;
  const candidates = [];
  for (const work of prioritizeStewardshipWork(snapshot.work)) {
    if (work.sessionId) candidates.push(work);
    else if (newWorkSlots > 0) {
      candidates.push(work);
      newWorkSlots -= 1;
    }
  }

  const selected = safelyConcurrentWork(candidates, snapshot.activeWork, snapshot.revision, limit);

  if (selected.length === 0) {
    const code = snapshot.work.length > 0
      ? (available === 0 ? "stewardship_concurrency_exhausted" : "stewardship_concurrency_evidence_required")
      : "stewardship_no_work";
    return { status: "paused", operation: null, code, scheduled: [] };
  }

  let claimResult;
  try {
    claimResult = await client.invoke("claim_stewardship_work", {
      revision: snapshot.revision,
      workIds: selected.map(work => work.id),
    });
  } catch (error) {
    return { status: "paused", operation: null, code: error?.code ?? "stewardship_claim_failed", scheduled: [] };
  }
  const claimedProfile = claimResult?.profile;
  // The atomic claim may itself consume the last available slot. Re-check all
  // state boundaries, but do not reject the capacity that this claim owns.
  const claimBoundary = profileBoundary(claimedProfile, { claimId: "governed" }, now);
  if (claimBoundary) return { status: "paused", ...claimBoundary, scheduled: [] };
  let claims;
  try { claims = governedClaims(claimResult, selected.map(work => work.id), snapshot.revision, now); }
  catch { return { status: "paused", operation: null, code: "stewardship_claim_invalid", scheduled: [] }; }
  const claimed = selected.filter(work => claims.has(work.id));
  if (claimed.length === 0) return { status: "paused", operation: null, code: "stewardship_claim_unavailable", scheduled: [] };

  const scheduled = await Promise.all(claimed.map(async (work) => {
    try {
      return { workId: work.id, ...(await runStewardshipStep({
        client,
        profile: claimedProfile,
        work: { ...work, claimId: claims.get(work.id).claimId },
        claim: claims.get(work.id),
        revision: snapshot.revision,
        repair: work.repair,
        now,
      })), claimId: claims.get(work.id).claimId };
    } catch (error) {
      const code = error?.code ?? "operation_failed";
      return { workId: work.id, status: code.startsWith("stewardship_") ? "paused" : "failed", code };
    }
  }));
  return {
    status: scheduled.some((item) => item.status === "scheduled") ? "scheduled" : "paused",
    scheduled,
  };
}
