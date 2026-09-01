const CONTROL = /^\s*(?:yolo\s+)?(status|pause|off|on)(?:\s+for\s+(\d+)\s*(hours?|days?))?\s*$/i;

export function parseStewardshipControl(text, now = new Date()) {
  const match = CONTROL.exec(String(text ?? ""));
  if (!match) return null;
  const action = match[1].toLowerCase();
  if (action === "on") {
    const amount = Number(match[2]), unit = match[3]?.toLowerCase();
    if (!Number.isInteger(amount) || amount < 1) return { action: "invalid", code: "bounded_duration_required" };
    const milliseconds = amount * (unit.startsWith("day") ? 86_400_000 : 3_600_000);
    return { action: "enable", expiresAt: new Date(now.getTime() + milliseconds).toISOString() };
  }
  return { action: action === "off" ? "disable" : action };
}

export function nextStewardshipOperation({ profile, work }) {
  if (!profile || profile.state !== "enabled") return { operation: null, code: `stewardship_${profile?.state ?? "not_declared"}` };
  if (work.denial) return { operation: null, code: work.denial.code, details: work.denial.details };
  if (!work.proposalId) return { operation: "propose_company_change" };
  if (!work.previewed) return { operation: "preview_company_change" };
  if (!work.submitted) return { operation: "apply_company_change" };
  if (!work.independentApproval || !work.checksSuccessful) return { operation: null, code: "waiting_for_independent_review" };
  if (!work.merged) return { operation: "merge_company_change" };
  if (!work.reconciled) return { operation: "generate_plan" };
  if (!work.applied) return { operation: "apply_plan" };
  if (!work.observed) return { operation: "observe_company" };
  return { operation: null, code: "stewardship_completed" };
}
