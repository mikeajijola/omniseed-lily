import { defineAgent } from "eve";
import { resolveInferenceModel } from "./lib/inference.mjs";

export default defineAgent({
  model: resolveInferenceModel(),
  reasoning: "medium",
  limits: {
    maxOutputTokensPerSession: 12_000,
    sessionTimeoutMs: 24 * 60 * 60 * 1_000,
  },
});
