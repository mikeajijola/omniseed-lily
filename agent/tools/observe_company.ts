import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Observe deployed primitive resources through their selected Providers and record evidence without changing desired state.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  async execute() { return operationClient().invoke("observe_company", {}); },
});
