# OmniSeed EVE Provider

This package is the narrow `agents` primitive-family adapter for an independently deployed EVE agent runtime. EVE supplies execution; a company definition supplies the organisational actor and its realisation. The Provider neither defines Lily nor contains company state.

The runtime is configured with only a canonical company reference, an organisational agent identity, and authenticated access to OmniSeed. Authenticated tools inside the EVE deployment must resolve context and invoke ordinary governed OmniSeed operations. This adapter deliberately has no GitHub or Vercel mutation path.

`provider.apply` binds an already deployed runtime; it does not pretend to deploy one. `provider.observe` checks EVE health and runtime identity. `provider.invoke` performs a real EVE session turn and returns the completed semantic response with evidence identifiers.

Production integration currently requires a deployed EVE Lily endpoint and a deployed authenticated OmniSeed operation API. The source-tree OmniSeed engine currently exposes only an in-process `invokeOperation` method, so end-to-end operation-tool invocation cannot yet be claimed.
