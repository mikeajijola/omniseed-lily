import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Submit an exact independently approved Company Change through OmniSeed's canonical Git repository boundary.",
  inputSchema: { type: "object", additionalProperties: false, required: ["proposalId"], properties: { proposalId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("apply_company_change", input); },
});
