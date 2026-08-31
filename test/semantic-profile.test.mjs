import test from "node:test";
import assert from "node:assert/strict";
import { semanticProfile, semanticTiming } from "../agent/lib/semantic-profile.mjs";

test("representative turns select bounded profiles", () => {
  assert.deepEqual(semanticProfile("hi"), { executionClass: "conversation", reasoning: "minimal", maxToolCalls: 0 });
  assert.deepEqual(semanticProfile("what company are you stewarding?"), { executionClass: "company_query", reasoning: "concise", maxToolCalls: 2 });
  assert.deepEqual(semanticProfile("what needs attention?"), { executionClass: "company_query", reasoning: "concise", maxToolCalls: 2 });
  assert.equal(semanticProfile("generate a plan").executionClass, "company_work");
  assert.equal(semanticProfile("change several governed resources").maxToolCalls, 8);
});

test("semantic timing exposes durations without prompts or secrets", () => {
  const timing = semanticTiming(); timing.mark("model_invocation_start"); timing.mark("model_invocation_end", { totalTokens: 12 });
  const trace = timing.snapshot();
  assert.equal(trace.events[1].totalTokens, 12);
  assert.equal(typeof trace.totalMs, "number");
  assert.doesNotMatch(JSON.stringify(trace), /prompt|credential|secret/i);
});
