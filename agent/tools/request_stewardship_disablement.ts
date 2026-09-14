import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "request_stewardship_disablement") ? defineTool({
    description: "Request that the authenticated Engine disable stewardship and stop scheduling new work.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    async execute() { return operationClient().invoke("request_stewardship_disablement", {}); },
  }) : null,
} });
