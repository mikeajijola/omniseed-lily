import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "request_company_change_merge") ? defineTool({
    description: "Ask the governed Engine to evaluate merge of the independently approved exact proposal; Lily cannot merge or approve it.",
    inputSchema: { type: "object", additionalProperties: false, required: ["proposalId", "sessionId"], properties: { proposalId: { type: "string", minLength: 1 }, sessionId: { type: "string", minLength: 1 } } },
    async execute(input) { return operationClient().invoke("request_company_change_merge", input); },
  }) : null,
} });
