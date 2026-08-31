import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "inspect_company_change") ? defineTool({
  description: "Inspect governed Company Change proposals and their evidence-backed lifecycle state.",
  inputSchema: {
    type: "object", additionalProperties: false,
    properties: { proposalId: { type: "string", minLength: 1 } },
  },
  async execute(input) { return operationClient().invoke("inspect_company_change", input); },
  }) : null,
} });
