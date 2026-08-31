# Lily

Lily is OmniSeed's first-party reference company steward application. Lily is an organisational actor selected by company desired state, not an OmniSeed primitive family, Provider, model, or mandatory subsystem.

This application uses Vercel's Eve framework for semantic execution and currently reaches the declared Google inference binding through Google's AI SDK implementation. Agent runtime and inference remain separate primitive concerns: `Steward OmniSeed Ecosystem → Lily → Agent primitive → framework/loop implementation` composes with `inference primitive → supplying Provider → model product and model ID`. Vercel may host Lily while Google independently supplies a Gemini inference Resource. Eve and LiteLLM are frameworks, not Providers. Replacing the framework, inference Provider, or model must not replace Lily's organisational identity; replacing Lily must not change the stewardship capability. See the authoritative [Provider semantics](https://github.com/mikeajijola/omniseed-ecosystem/blob/main/docs/provider-semantics.md).

Lily bootstraps from company reference, agent identity, authenticated OmniSeed endpoint, and a credential environment reference. She resolves company facts and authority through governed OmniSeed operations. The application has no GitHub, Vercel, approval, or direct Provider mutation path.

Before runtime identity instructions, [`agent/instructions.md`](agent/instructions.md) teaches the stable OmniSeed operating model explicitly: company and OmniSeed boundaries, desired versus observed state, drift, Capability, Requirement, Realisation, Primitive, Provider organisation, Actor, Interface, authority, evidence, and governed Company Change. Company-specific facts remain runtime-discovered. Eve evals under [`evals/ontology`](evals/ontology) exercise the same contract with text and multimodal inputs; run them against each approved inference model/runtime configuration with `npm run eval:ontology` before promoting that configuration.

Lily runs as Eve's durable semantic Agent loop rather than a stateless chatbot. OmniSeed OS preserves the Eve session and stream cursor in Engine-owned company work state, records a safe Activity projection, and resumes the same run after independent company approvals. Lily may invoke an apply or Provider-mediated merge operation only when OmniSeed verifies the exact independently approved plan or proposal; she cannot approve or expand her own authority.

The engine transport contract is:

```text
POST /v1/companies/{companyRef}/operations/{operationId}:invoke
Authorization: Bearer <server credential>

{
  "input": { ... },
  "actor": { "actorId": "lily", "actorType": "ai" }
}
```

The server authenticates and binds the actor and derives authority from company state. The client never supplies permissions.

Vercel builds the repository with the checked-in `vercel.json` contract and `eve build`. Deployment identity is injected as references (`OMNISEED_COMPANY_REF`, `OMNISEED_AGENT_IDENTITY`, `OMNISEED_ENVIRONMENT`, `OMNISEED_SOURCE_REPOSITORY`, and the full `OMNISEED_SOURCE_COMMIT_SHA`). The company declaration also selects the Eve session credential reference, issuer, and audience; the Vercel Provider binds those references to the runtime without putting secret values in desired state. The authenticated runtime channel reports health and that deployment identity without returning credential values. Lily receives no Vercel, GitHub, or npm publishing credential.
