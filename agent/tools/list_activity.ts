import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "list_activity") ? defineTool({
  description: "Read the evidence-backed chronological activity recorded by OmniSeed for this company.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  async execute() { return operationClient().invoke("list_activity", {}); },
  }) : null,
} });
