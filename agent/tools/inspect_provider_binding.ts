import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "inspect_provider_binding") ? defineTool({
  description: "Inspect the supplying Provider organisation selected for a primitive family or primitive instance.",
  inputSchema: { type: "object", additionalProperties: false, required: ["primitiveFamily"], properties: { primitiveFamily: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("inspect_provider_binding", input); },
  }) : null,
} });
