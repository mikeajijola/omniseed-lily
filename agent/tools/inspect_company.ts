import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { projectCompanyInspection } from "../lib/company-projection.mjs";

export default defineTool({
  description: "Inspect the bound company's desired state, observed state, evidence, capabilities, realisations, Providers, authority, and activity.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  async execute() {
    return projectCompanyInspection(await operationClient().invoke("inspect_company", {}));
  },
});
