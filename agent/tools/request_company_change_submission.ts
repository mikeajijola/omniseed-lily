import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "request_company_change_submission") ? defineTool({
    description: "Ask the governed Engine to submit an exact previewed proposal for independent review; this does not approve or merge it.",
    inputSchema: { type: "object", additionalProperties: false, required: ["proposalId", "sessionId"], properties: { proposalId: { type: "string", minLength: 1 }, sessionId: { type: "string", minLength: 1 } } },
    async execute(input) { return operationClient().invoke("request_company_change_submission", input); },
  }) : null,
} });
