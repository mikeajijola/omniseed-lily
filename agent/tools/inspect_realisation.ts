import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "inspect_realisation") ? defineTool({
  description: "Inspect one realisation through primitive participants, Provider bindings, observed resources, and evidence.",
  inputSchema: { type: "object", additionalProperties: false, required: ["realisationId"], properties: { realisationId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("inspect_realisation", input); },
  }) : null,
} });
