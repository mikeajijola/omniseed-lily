import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Generate and persist the deterministic OmniSeed reconciliation plan. This does not approve or apply it.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  async execute() { return operationClient().invoke("generate_plan", {}); },
});
