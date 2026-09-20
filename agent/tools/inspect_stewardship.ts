import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "inspect_stewardship") ? defineTool({
    description: "Read the Engine-governed stewardship profile, limits, expiry, usage, and pause or disabled state.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    async execute() { return operationClient().invoke("inspect_stewardship", {}); },
  }) : null,
} });
