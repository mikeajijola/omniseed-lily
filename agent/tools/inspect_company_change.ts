import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Inspect governed Company Change proposals and their evidence-backed lifecycle state.",
  inputSchema: {
    type: "object", additionalProperties: false,
    properties: { proposalId: { type: "string", minLength: 1 } },
  },
  async execute(input) { return operationClient().invoke("inspect_company_change", input); },
});
