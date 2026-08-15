# OmniSeed EVE Provider

This package is the narrow `agents` primitive-family adapter for an independently deployed EVE agent runtime. EVE supplies execution; a company definition supplies the organisational actor and its realisation. The Provider neither defines Lily nor contains company state.

The runtime is configured with only a canonical company reference, an organisational agent identity, and authenticated access to OmniSeed. Authenticated tools inside the EVE deployment must resolve context and invoke ordinary governed OmniSeed operations. This adapter deliberately has no GitHub or Vercel mutation path.

`provider.apply` binds an already deployed runtime; it does not pretend to deploy one. `provider.observe` checks EVE health and runtime identity. `provider.invoke` performs a real EVE session turn and returns the completed semantic response with evidence identifiers.

Production integration currently requires a deployed EVE Lily endpoint and a deployed authenticated OmniSeed operation API. The source-tree OmniSeed engine currently exposes only an in-process `invokeOperation` method, so end-to-end operation-tool invocation cannot yet be claimed.

## Lily runtime

The included EVE runtime discovers its organisational context instead of containing company facts. Its bootstrap is supplied at runtime:

- `OMNISEED_COMPANY_REF`
- `OMNISEED_AGENT_IDENTITY`
- `OMNISEED_OPERATION_ENDPOINT`
- `OMNISEED_OPERATION_CREDENTIAL_ENV`, naming the environment variable containing the credential

The EVE channel requires a company-scoped HMAC JWT. `LILY_SESSION_JWT_SECRET` is server-only; issuer and audience default to `omniseed` and `omniseed-lily` and can be overridden. Anonymous and browser-asserted authority are not accepted.

The narrow engine transport contract is:

```text
POST /v1/companies/{companyRef}/operations/{operationId}:invoke
Authorization: Bearer <server credential>

{
  "input": { ... },
  "actor": { "actorId": "lily", "actorType": "ai" }
}
```

The server must authenticate the credential, bind it to the company and actor, derive permissions from company state, and then call the existing `invokeOperation`. It must ignore or reject client-supplied permissions. Only `inspect_company`, `get_capability`, `inspect_company_change`, and `propose_company_change` are exposed to this runtime. Approval and apply are absent by design.
