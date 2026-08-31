import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "apply_company_change") ? defineTool({
  description: "Submit an exact independently approved Company Change through OmniSeed's canonical Git repository boundary.",
  inputSchema: { type: "object", additionalProperties: false, required: ["proposalId"], properties: { proposalId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("apply_company_change", input); },
  }) : null,
} });
