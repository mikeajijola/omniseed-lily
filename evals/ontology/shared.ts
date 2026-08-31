const requiredConcepts = [
  ["company boundary", /company.{0,80}(durable|identity)|durable.{0,80}company/is],
  ["OmniSeed boundary", /OmniSeed.{0,100}(govern|control system|manage|reconcil)/is],
  ["desired state", /desired state/is],
  ["observed state", /observed state/is],
  ["drift", /drift|gap between.{0,50}desired.{0,50}observed/is],
  ["capability independence", /capabilit.{0,120}(independent|what.{0,40}(company|organisation).{0,30}(must|need)|not.{0,30}(implementation|provider|actor))/is],
  ["realisation composition", /realis.{0,120}(assembl|compos|actor|primitive)/is],
  ["Provider organisation", /provider.{0,120}(suppl.{0,30}organi[sz]ation|organi[sz]ation.{0,30}boundar)/is],
  ["authority", /authority.{0,120}(explicit|permission|govern)/is],
  ["evidence", /evidence.{0,120}(proof|observ|inspect)/is],
  ["Company Change", /company change.{0,160}(proposal|desired state|approval|merge)/is],
  ["replaceable actor", /(Lily|agent).{0,120}(replaceable|one.{0,30}actor|not.{0,30}(CEO|company|OmniSeed))/is],
] as const;

const prohibitedClaims = [
  /Lily is (the |your )?(CEO|founder|company|OmniSeed)/i,
  /Lily (has|possesses) (inherent|unrestricted|unlimited) authority/i,
  /OmniSeed is (a |the )?(chatbot|hosting platform|user interface)/i,
  /Eve Provider/i,
  /GitHub Actions Provider/i,
];

export function explainsOmniSeedOperatingModel(value: unknown): boolean {
  const text = String(value ?? "");
  return requiredConcepts.every(([, pattern]) => pattern.test(text))
    && prohibitedClaims.every((pattern) => !pattern.test(text));
}

export const operatingModelPrompt = `Explain the stable OmniSeed operating model to a new company actor. Distinguish the company, OmniSeed, Lily, Capability, Requirement, Realisation, Primitive, Provider, Actor, Interface, authority, desired state, observed state, drift, evidence, and Company Change. Explain the order used to reason about company work. Do not invent facts about a particular company and do not treat Lily as a CEO.`;
