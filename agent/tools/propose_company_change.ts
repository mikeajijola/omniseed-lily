import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "propose_company_change") ? defineTool({
  description: "Propose, but never approve or apply, a PR-governed desired-state change. Evidence references must already exist in OmniSeed.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["reason", "evidence", "patch"],
    properties: {
      reason: { type: "string", minLength: 1 },
      evidence: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
      patch: { type: "array", items: { type: "object" }, minItems: 1 },
      assumptions: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
    },
  },
  async execute(input) { return operationClient().invoke("propose_company_change", input); },
  }) : null,
} });
