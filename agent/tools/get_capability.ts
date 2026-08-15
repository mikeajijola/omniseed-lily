import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Inspect one real capability trace through requirements, realisation, primitives, Providers, observations, and evidence.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["capabilityId"],
    properties: { capabilityId: { type: "string", minLength: 1 } },
  },
  async execute(input) { return operationClient().invoke("get_capability", input); },
});
