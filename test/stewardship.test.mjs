import test from "node:test";
import assert from "node:assert/strict";
import { nextStewardshipOperation, parseStewardshipControl } from "../agent/lib/stewardship.mjs";

test("conversational controls remain bounded governed intents", () => {
  assert.deepEqual(parseStewardshipControl("yolo on for 24 hours", new Date("2026-09-01T00:00:00Z")), { action: "enable", expiresAt: "2026-09-02T00:00:00.000Z" });
  assert.deepEqual(parseStewardshipControl("status"), { action: "status" });
  assert.deepEqual(parseStewardshipControl("pause"), { action: "pause" });
  assert.deepEqual(parseStewardshipControl("off"), { action: "disable" });
  assert.equal(parseStewardshipControl("yolo on").code, "bounded_duration_required");
});
test("durable orchestration uses only governed OmniSeed lifecycle operations", () => {
  const profile = { state: "enabled" }, states = [
    [{}, "propose_company_change"], [{ proposalId: "p" }, "preview_company_change"],
    [{ proposalId: "p", previewed: true }, "apply_company_change"],
    [{ proposalId: "p", previewed: true, submitted: true }, null],
    [{ proposalId: "p", previewed: true, submitted: true, independentApproval: true, checksSuccessful: true }, "merge_company_change"],
    [{ proposalId: "p", previewed: true, submitted: true, independentApproval: true, checksSuccessful: true, merged: true }, "generate_plan"],
  ];
  for (const [work, operation] of states) assert.equal(nextStewardshipOperation({ profile, work }).operation, operation);
});
test("expiry, kill switch, protected pauses and concurrency denials remain Engine decisions", () => {
  assert.equal(nextStewardshipOperation({ profile: { state: "expired" }, work: {} }).code, "stewardship_expired");
  assert.equal(nextStewardshipOperation({ profile: { state: "disabled" }, work: {} }).code, "stewardship_disabled");
  assert.equal(nextStewardshipOperation({ profile: { state: "enabled" }, work: { denial: { code: "stewardship_owner_approval_required", details: { protectedCategories: ["authority"] } } } }).code, "stewardship_owner_approval_required");
});
