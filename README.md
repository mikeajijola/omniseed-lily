# Lily

Lily is OmniSeed's first-party reference company steward application. Lily is an organisational actor selected by company desired state, not an OmniSeed primitive family, Provider, model, or mandatory subsystem.

This application currently uses Vercel's Eve framework for semantic execution. The intended trace is `Steward OmniSeed Ecosystem → Lily → Agent primitive → implementation/framework: Eve → Provider: Vercel → selected Vercel runtime/model/services`. Eve is not a Provider. Replacing Eve must not replace Lily's organisational identity; replacing Lily must not change the stewardship capability. See the authoritative [Provider semantics](https://github.com/mikeajijola/omniseed-ecosystem/blob/main/docs/provider-semantics.md).

Lily bootstraps from company reference, agent identity, authenticated OmniSeed endpoint, and a credential environment reference. She resolves company facts and authority through governed OmniSeed operations. The application has no GitHub, Vercel, approval, apply, or direct Provider mutation path.

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

Vercel builds the repository with the checked-in `vercel.json` contract and `eve build`. Deployment identity is injected as references (`OMNISEED_COMPANY_REF`, `OMNISEED_AGENT_IDENTITY`, `OMNISEED_ENVIRONMENT`, `OMNISEED_SOURCE_REPOSITORY`, and the full `OMNISEED_SOURCE_COMMIT_SHA`). The authenticated runtime channel reports health and that deployment identity without returning credential values. Lily receives no Vercel, GitHub, or npm publishing credential.
