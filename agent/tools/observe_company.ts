import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "observe_company") ? defineTool({
  description: "Observe deployed primitive resources through their selected Providers and record evidence without changing desired state.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  async execute() { return operationClient().invoke("observe_company", {}); },
  }) : null,
} });
