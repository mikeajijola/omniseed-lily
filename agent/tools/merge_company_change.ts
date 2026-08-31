import { defineDynamic, defineTool } from "eve/tools";
import { operationClient } from "../lib/omniseed-client.mjs";
import { shouldExposeOperation } from "../lib/execution-profile.mjs";

export default defineDynamic({ events: { "step.started": (_event, ctx) =>
  shouldExposeOperation(ctx.messages, "merge_company_change") ? defineTool({
  description: "Request Provider-mediated merge of an unchanged Company Change PR. OmniSeed enforces exact head, independent approval, and required passing checks.",
  inputSchema: { type: "object", additionalProperties: false, required: ["proposalId"], properties: { proposalId: { type: "string", minLength: 1 } } },
  async execute(input) { return operationClient().invoke("merge_company_change", input); },
  }) : null,
} });
