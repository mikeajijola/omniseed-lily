import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Inspect one realisation through primitive participants, Provider bindings, observed resources, and evidence.",
  inputSchema: { type: "object", additionalProperties: false, required: ["realisationId"], properties: { realisationId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("inspect_realisation", input); },
});
