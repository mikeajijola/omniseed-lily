import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "get_capability") ? defineTool({
  description: "Inspect one real capability trace through requirements, realisation, primitives, Providers, observations, and evidence.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["capabilityId"],
    properties: { capabilityId: { type: "string", minLength: 1 } },
  },
  async execute(input) { return operationClient().invoke("get_capability", input); },
  }) : null,
} });
