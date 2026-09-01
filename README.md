# Lily

Lily is OmniSeed's first-party reference company steward application. Lily is an organisational actor selected by company desired state, not an OmniSeed primitive family, Provider, model, or mandatory subsystem.

This application uses Vercel's Eve framework for semantic execution and currently reaches the declared Google inference binding through Google's AI SDK implementation. Agent runtime and inference remain separate primitive concerns: `Steward OmniSeed Ecosystem → Lily → Agent primitive → framework/loop implementation` composes with `inference primitive → supplying Provider → model product and model ID`. Vercel may host Lily while Google independently supplies a Gemini inference Resource. Eve and LiteLLM are frameworks, not Providers. Replacing the framework, inference Provider, or model must not replace Lily's organisational identity; replacing Lily must not change the stewardship capability. See the authoritative [Provider semantics](https://github.com/mikeajijola/omniseed-ecosystem/blob/main/docs/provider-semantics.md).

Lily bootstraps from company reference, agent identity, authenticated OmniSeed endpoint, and a credential environment reference. She resolves company facts and authority through governed OmniSeed operations. The application has no GitHub, Vercel, approval, or direct Provider mutation path.

Before runtime identity instructions, [`agent/instructions.md`](agent/instructions.md) teaches the stable OmniSeed operating model explicitly: company and OmniSeed boundaries, desired versus observed state, drift, Capability, Requirement, Realisation, Primitive, Provider organisation, Actor, Interface, authority, evidence, and governed Company Change. Company-specific facts remain runtime-discovered. Eve evals under [`evals/ontology`](evals/ontology) exercise the same contract with text and multimodal inputs; run them against each approved inference model/runtime configuration with `npm run eval:ontology` before promoting that configuration.

Lily runs as Eve's durable semantic Agent loop rather than a stateless chatbot. OmniSeed OS preserves the Eve session and stream cursor in Engine-owned company work state, records a safe Activity projection, and resumes the same run after independent company approvals. Lily may invoke an apply or Provider-mediated merge operation only when OmniSeed verifies the exact independently approved plan or proposal; she cannot approve or expand her own authority.

## Semantic conversation and enforced bounds

Eve and the selected model interpret intent from the durable conversation. No keyword classifier decides whether ordinary language is a question, correction, follow-up, or company work. Each non-empty user turn exposes the authored OmniSeed operation surface so the semantic loop can inspect before deciding, clarify material ambiguity, and follow references established in earlier turns.

That semantic freedom remains inside deterministic runtime and Engine boundaries. Dynamic tools expose only the 14 authored OmniSeed operations and stop after eight governed tool results in a turn, regardless of what the model requests. Exhaustion removes all tools from the next model step; it does not grant authority, bypass Engine checks, end the session, or discard the continuation. OmniSeed independently authenticates and authorises every call, denies self-approval and self-escalation, and verifies exact approvals and revisions. The Agent also has Eve-owned limits of 12,000 provider-reported output tokens and a 24-hour absolute durable-session lifetime.

Deterministic regression traces (generated from the same pure guard used by the dynamic tools) are:

```text
"Hello"                                  -> semantic_turn, 0/8 calls; model normally uses no tool
"Customers seem to wait too long"        -> semantic_turn, 0/8 calls; semantic loop may inspect
"Do the cheaper one" in the same session -> semantic_turn, 0/8 calls; prior context remains available
+ eight governed tool results             -> semantic_turn, 8/8 calls; no governed tools
missing or empty user input                -> conversation fallback, no governed tools
```

These are policy traces, not production latency measurements. This repository has no deployed Engine endpoint, inference credential, browser submission timestamp, or Provider telemetry, so it cannot honestly report end-to-end milliseconds or token savings. A deployed before/after measurement must keep browser-to-Engine, Eve/model, and OmniSeed-operation spans separate and must record only safe durations and aggregate usage—not prompts, credentials, raw tool payloads, or company facts. Static reasoning remains `medium`: Eve 0.29.5 configures reasoning at Agent scope, and lowering it globally would also change durable company work.

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
