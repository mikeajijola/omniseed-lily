import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "request_reconciliation") ? defineTool({
    description: "Ask the governed Engine to reconcile a merged proposal and resume its durable stewardship session.",
    inputSchema: { type: "object", additionalProperties: false, required: ["proposalId", "sessionId"], properties: { proposalId: { type: "string", minLength: 1 }, sessionId: { type: "string", minLength: 1 } } },
    async execute(input) { return operationClient().invoke("request_reconciliation", input); },
  }) : null,
} });
