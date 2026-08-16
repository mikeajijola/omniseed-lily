import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.LILY_MODEL ?? "google/gemini-3.6-flash",
  reasoning: "medium",
  limits: {
    maxOutputTokensPerSession: 12_000,
    sessionTimeoutMs: 24 * 60 * 60 * 1_000,
  },
});
