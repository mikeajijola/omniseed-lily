import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "apply_plan") ? defineTool({
  description: "Apply only an exact persisted reconciliation plan carrying an independent OmniSeed approval. OmniSeed rejects stale, altered, or unapproved input.",
  inputSchema: { type: "object", additionalProperties: false, required: ["plan", "approval"], properties: { plan: { type: "object" }, approval: { type: "object" } } },
  async execute(input) { return operationClient().invoke("apply_plan", input); },
  }) : null,
} });
