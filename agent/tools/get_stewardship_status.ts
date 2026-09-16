import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "get_stewardship_status") ? defineTool({
    description: "Read the Engine-governed stewardship profile, limits, expiry, active durable work, and pause or kill-switch state.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    async execute() { return operationClient().invoke("get_stewardship_status", {}); },
  }) : null,
} });
