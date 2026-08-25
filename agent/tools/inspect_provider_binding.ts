import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Inspect the supplying Provider organisation selected for a primitive family or primitive instance.",
  inputSchema: { type: "object", additionalProperties: false, required: ["primitiveFamily"], properties: { primitiveFamily: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("inspect_provider_binding", input); },
});
