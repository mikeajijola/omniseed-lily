import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Read the evidence-backed chronological activity recorded by OmniSeed for this company.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  async execute() { return operationClient().invoke("list_activity", {}); },
});
