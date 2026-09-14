const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

const CONTROL_OPERATIONS = Object.freeze({
  status: "get_stewardship_status",
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

function profileBoundary(profile, work, now) {
  if (!profile) return pause("stewardship_not_declared");
  if (profile.killSwitch === true || profile.state === "disabled") return pause("stewardship_disabled");
  if (profile.state === "paused") return pause("stewardship_paused");
  if (profile.state !== "enabled") return pause(`stewardship_${profile.state ?? "not_declared"}`);
  const expiry = Date.parse(profile.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) return pause("stewardship_expired", { expiresAt: profile.expiresAt });
  if (work.denial) return pause(work.denial.code ?? "stewardship_denied", work.denial.details);
  const limit = profile.limits?.maxConcurrentWork ?? profile.maxConcurrentWork;
  const active = profile.usage?.concurrentWork ?? profile.activeWorkCount ?? 0;
  if (!work.sessionId && Number.isInteger(limit) && active >= limit) return pause("stewardship_concurrency_exhausted", { active, limit });
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

export async function runStewardshipStep({ client, profile, work, repair, now = new Date() }) {
  const decision = nextStewardshipOperation({ profile, work, repair, now });
  if (!decision.operation) return { status: "paused", ...decision };
  const result = await client.invoke(decision.operation, decision.input);
  return { status: "scheduled", operation: decision.operation, sessionId: work?.sessionId ?? result?.sessionId, result };
}

function governedSnapshot(result) {
  const profile = result?.profile;
  const work = result?.work;
  if (!profile || !Array.isArray(work)) {
    throw new TypeError("get_stewardship_status must return an Engine-governed profile and work array");
  }
  return { profile, work };
}

/**
 * Run one durable scheduler tick.  The caller supplies no profile or work
 * state: both are fetched from the authenticated Engine on every tick, so a
 * resumed deployment cannot reuse stale authority or session state.
 */
export async function runGovernedStewardship({ client, now = new Date() }) {
  const snapshot = governedSnapshot(await client.invoke("get_stewardship_status", {}));
  const { profile } = snapshot;
  const boundary = profileBoundary(profile, {}, now);
  if (boundary && boundary.code !== "stewardship_concurrency_exhausted") {
    return { status: "paused", ...boundary, scheduled: [] };
  }

  const limit = profile.limits?.maxConcurrentWork ?? profile.maxConcurrentWork ?? 1;
  const active = profile.usage?.concurrentWork ?? profile.activeWorkCount ?? 0;
  const available = Number.isInteger(limit) ? Math.max(0, limit - active) : 0;
  let newWorkSlots = available;
  const selected = [];
  for (const work of prioritizeStewardshipWork(snapshot.work)) {
    if (selected.length >= limit) break;
    if (work.sessionId) selected.push(work);
    else if (newWorkSlots > 0) {
      selected.push(work);
      newWorkSlots -= 1;
    }
  }

  if (selected.length === 0) {
    const code = snapshot.work.length > 0 && available === 0
      ? "stewardship_concurrency_exhausted"
      : "stewardship_no_work";
    return { status: "paused", operation: null, code, scheduled: [] };
  }

  const scheduled = await Promise.all(selected.map(async (work) => {
    try {
      return { workId: work.id, ...(await runStewardshipStep({
        client,
        profile,
        work,
        repair: work.repair,
        now,
      })) };
    } catch (error) {
      return { workId: work.id, status: "failed", code: error?.code ?? "operation_failed" };
    }
  }));
  return {
    status: scheduled.some((item) => item.status === "scheduled") ? "scheduled" : "paused",
    scheduled,
  };
}
