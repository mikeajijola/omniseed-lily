import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "request_stewardship_pause") ? defineTool({
    description: "Request that the authenticated Engine pause durable stewardship work.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    async execute() { return operationClient().invoke("request_stewardship_pause", {}); },
  }) : null,
} });
