import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "get_plan") ? defineTool({
  description: "Inspect an exact persisted reconciliation plan and any independent approval bound to it.",
  inputSchema: { type: "object", additionalProperties: false, required: ["planId"], properties: { planId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("get_plan", input); },
  }) : null,
} });
