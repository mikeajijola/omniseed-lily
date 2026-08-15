# Working on the OmniSeed EVE Provider

- This package implements only the canonical `agents` primitive-family boundary.
- EVE is a replaceable runtime provider. It is not Lily, Company Stewardship, or company state.
- Bootstrap inputs are company reference, organisational agent identity, and authenticated access to OmniSeed.
- Agent turns must use governed OmniSeed operations. Never add direct GitHub or deployment-provider mutation.
- Never print credentials or include them in observations/evidence.
- Requested, configured, connected, healthy, and semantically operational are separate facts.
- Stdout is reserved for JSON-RPC responses; diagnostics go to stderr.
- Run `npm test` before proposing a change.
