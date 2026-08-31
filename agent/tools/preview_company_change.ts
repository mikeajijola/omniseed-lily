import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "preview_company_change") ? defineTool({
  description: "Validate and inspect the impact of an exact persisted Company Change without mutating company state.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["proposalId"],
    properties: { proposalId: { type: "string", minLength: 1 } },
  },
  async execute(input) { return operationClient().invoke("preview_company_change", input); },
  }) : null,
} });
