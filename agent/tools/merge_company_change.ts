import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Request Provider-mediated merge of an unchanged Company Change PR. OmniSeed enforces exact head, independent approval, and required passing checks.",
  inputSchema: { type: "object", additionalProperties: false, required: ["proposalId"], properties: { proposalId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("merge_company_change", input); },
});
