import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "request_stewardship_enablement") ? defineTool({
    description: "Request bounded stewardship enablement from the authenticated Engine. The Engine decides authority and the effective expiry.",
    inputSchema: { type: "object", additionalProperties: false, required: ["durationSeconds"], properties: { durationSeconds: { type: "integer", minimum: 1 } } },
    async execute(input) { return operationClient().invoke("request_stewardship_enablement", input); },
  }) : null,
} });
