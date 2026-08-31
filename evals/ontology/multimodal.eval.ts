import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { explainsOmniSeedOperatingModel, operatingModelPrompt } from "./shared";

export default defineEval({
  description: "A multimodal model preserves the same ontology when a diagram accompanies the request.",
  tags: ["ontology", "multimodal"],
  async test(t) {
    await t.sendFile(operatingModelPrompt, "evals/ontology/operating-model.svg", "image/svg+xml");
    t.succeeded();
    t.check(t.reply, satisfies(explainsOmniSeedOperatingModel, "explains the complete OmniSeed operating model from multimodal input"));
  },
});
