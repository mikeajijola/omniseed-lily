import { defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";

export default defineTool({
  description: "Apply only an exact persisted reconciliation plan carrying an independent OmniSeed approval. OmniSeed rejects stale, altered, or unapproved input.",
  inputSchema: { type: "object", additionalProperties: false, required: ["plan", "approval"], properties: { plan: { type: "object" }, approval: { type: "object" } } },
  async execute(input) { return operationClient().invoke("apply_plan", input); },
});
