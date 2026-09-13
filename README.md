# Lily

Lily is OmniSeed's first-party reference company steward application. Lily is an organisational actor selected by company desired state, not an OmniSeed primitive family, Provider, model, or mandatory subsystem.

This application uses Vercel's Eve framework for semantic execution and currently reaches the declared Google inference binding through Google's AI SDK implementation. Agent runtime and inference remain separate primitive concerns: `Steward OmniSeed Ecosystem → Lily → Agent primitive → framework/loop implementation` composes with `inference primitive → supplying Provider → model product and model ID`. Vercel may host Lily while Google independently supplies a Gemini inference Resource. Eve and LiteLLM are frameworks, not Providers. Replacing the framework, inference Provider, or model must not replace Lily's organisational identity; replacing Lily must not change the stewardship capability. See the authoritative [Provider semantics](https://github.com/mikeajijola/omniseed-ecosystem/blob/main/docs/provider-semantics.md).

Lily bootstraps from company reference, agent identity, authenticated OmniSeed endpoint, and a credential environment reference. She resolves company facts and authority through governed OmniSeed operations. The application has no GitHub, Vercel, approval, or direct Provider mutation path.

Before runtime identity instructions, [`agent/instructions.md`](agent/instructions.md) teaches the stable OmniSeed operating model explicitly: company and OmniSeed boundaries, desired versus observed state, drift, Capability, Requirement, Realisation, Primitive, Provider organisation, Actor, Interface, authority, evidence, and governed Company Change. Company-specific facts remain runtime-discovered. Eve evals under [`evals/ontology`](evals/ontology) exercise the same contract with text and multimodal inputs; run them against each approved inference model/runtime configuration with `npm run eval:ontology` before promoting that configuration.

Lily runs as Eve's durable semantic Agent loop rather than a stateless chatbot. OmniSeed OS preserves the Eve session and stream cursor in Engine-owned company work state, records a safe Activity projection, and resumes the same run after independent company approvals. Lily can inspect and propose, but cannot approve, apply, merge, mutate Providers, or expand authority. Those operations remain with humans and the governed Engine after explicit approval.

Requests for autonomous or time-bounded stewardship use that same contract. Lily discovers any active stewardship profile and its limits from governed company state, then may inspect, observe, plan, and submit exact proposals within her existing authority. Conversational labels such as “YOLO mode” do not grant authority or activate a profile. Enablement, pause, expiry, protected-change handling, independent approval, merge, apply, and concurrency remain Engine-governed; Lily stops when one of those boundaries requires another actor or when current evidence no longer establishes that the profile is active.

## Enforced execution bounds and timing

Eve assigns the same semantic-turn profile to every non-empty user turn. Natural model reasoning decides whether and how to use tools; no keyword or regular-expression intent router separates conversation, queries, and work. Structurally, the model can select only from the permanently bounded inspect/read/observe/plan-preview operations and `propose_company_change`, with at most eight governed calls per turn. Empty turns expose no tools. Apply, merge, approval, Provider mutation, and authority mutation operations are absent from both the tool manifest and Lily's operation client allowlist. Exhaustion removes the safe tools from the next model step; it does not grant authority, bypass Engine checks, end the session, or discard the continuation. The Agent also has Eve-owned limits of 12,000 provider-reported output tokens and a 24-hour absolute durable-session lifetime. Eve permits the call that crosses a token limit to settle and prompts for continuation before another model call; a session deadline lets an active turn settle and does not delete stored session data.

Representative regression traces (generated from the same pure guard used by the dynamic tools) are:

```text
"Hello"                                -> semantic_turn, 0/8 calls, safe surface only
"Could you see how things are shaping up?" -> semantic_turn, 0/8 calls, same safe surface
+ inspect_company + get_capability      -> semantic_turn, 2/8 calls, inspect/propose remains available
"Please turn that evidence into a suggestion" -> semantic_turn, 0/8 calls, same safe surface
""                                     -> empty_turn, 0/0 calls, no tools
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
