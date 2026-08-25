import test from "node:test";
import assert from "node:assert/strict";
import { inferenceConfiguration, resolveInferenceModel } from "../agent/lib/inference.mjs";

const configured = {
  LILY_INFERENCE_PROVIDER: "google",
  LILY_MODEL: "gemini-2.5-flash"
};

test("Lily resolves a direct external model from declared inference bootstrap", () => {
  assert.deepEqual(inferenceConfiguration(configured), {
    provider: "google",
    model: "gemini-2.5-flash"
  });
  const model = resolveInferenceModel(configured);
  assert.equal(model.provider, "google.generative-ai");
  assert.equal(model.modelId, "gemini-2.5-flash");
});

test("the immutable Google adapter has a deterministic build fallback", () => {
  assert.deepEqual(inferenceConfiguration({}), { provider: "google", model: "gemini-2.5-flash" });
});

test("inference bootstrap fails closed for undeclared Providers and models", () => {
  assert.throws(() => inferenceConfiguration({ ...configured, LILY_INFERENCE_PROVIDER: "eve" }), /supported inference Provider/);
  assert.throws(() => inferenceConfiguration({ ...configured, LILY_MODEL: "google\/gemini" }), /model identifier/);
});

test("inference configuration is separate from company identity and authority", () => {
  const serialized = JSON.stringify(inferenceConfiguration(configured));
  assert.doesNotMatch(serialized, /omniseed_ecosystem|company_change|authority|vercel|eve/i);
});
