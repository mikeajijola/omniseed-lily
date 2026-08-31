import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { explainsOmniSeedOperatingModel, operatingModelPrompt } from "./shared";

export default defineEval({
  description: "A text-only model learns the stable OmniSeed ontology without CEO or platform-role hallucination.",
  tags: ["ontology", "text"],
  async test(t) {
    await t.send(operatingModelPrompt);
    t.succeeded();
    t.check(t.reply, satisfies(explainsOmniSeedOperatingModel, "explains the complete OmniSeed operating model"));
  },
});
