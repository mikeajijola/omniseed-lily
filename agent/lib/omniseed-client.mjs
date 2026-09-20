const OPERATION_IDS = new Set([
  "inspect_company",
  "get_capability",
  "propose_company_change",
  "inspect_company_change",
  "preview_company_change",
  "inspect_realisation",
  "inspect_provider_binding",
  "list_activity",
  "generate_plan",
  "get_plan",
  "observe_company",
  "inspect_stewardship",
  "claim_stewardship_work",
  "request_stewardship_enablement",
  "request_stewardship_pause",
  "request_stewardship_disablement",
  "request_company_change_submission",
  "request_company_change_merge",
  "request_reconciliation",
]);

const DISCOVERED_REQUESTS = new Set([
  "claim_stewardship_work", "request_stewardship_enablement", "request_stewardship_pause",
  "request_stewardship_disablement", "request_company_change_submission",
  "request_company_change_merge", "request_reconciliation",
]);

export class OmniSeedClientError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function loadBootstrap(env = process.env) {
  const companyRef = env.OMNISEED_COMPANY_REF;
  const identity = env.OMNISEED_AGENT_IDENTITY;
  const endpoint = env.OMNISEED_OPERATION_ENDPOINT;
  const credentialEnv = env.OMNISEED_OPERATION_CREDENTIAL_ENV;
  const missing = Object.entries({ companyRef, identity, endpoint, credentialEnv })
    .filter(([, value]) => !value)
    .map(([field]) => field);
  if (missing.length) throw new OmniSeedClientError("bootstrap_incomplete", "Lily runtime bootstrap is incomplete", { missing });
  if (!endpoint.startsWith("https://") && !endpoint.startsWith("http://127.0.0.1:") && !endpoint.startsWith("http://localhost:")) {
    throw new OmniSeedClientError("endpoint_insecure", "OmniSeed operation endpoint must use HTTPS outside local development");
  }
  const credential = env[credentialEnv];
  if (!credential) throw new OmniSeedClientError("credential_unavailable", "OmniSeed operation credential is unavailable");
  return Object.freeze({ companyRef, identity, endpoint: endpoint.replace(/\/$/, ""), credentialEnv, credential });
}

export function isSelfEscalation(input, identity) {
  const patches = Array.isArray(input?.patch) ? input.patch : [];
  return patches.some((patch) => {
    const serialized = JSON.stringify(patch).toLowerCase();
    const targetsAuthority = /authority|permission|governance|polic(?:y|ies)|approv|merge|self_escalate/.test(serialized);
    const targetsSelf = serialized.includes(String(identity).toLowerCase());
    return targetsAuthority && targetsSelf;
  });
}

export class OmniSeedOperationClient {
  constructor({ bootstrap = loadBootstrap(), fetchImpl = fetch } = {}) {
    this.bootstrap = bootstrap;
    this.fetchImpl = fetchImpl;
  }

  async invoke(operationId, input = {}) {
    if (!OPERATION_IDS.has(operationId)) {
      throw new OmniSeedClientError("operation_not_allowed", `Lily runtime cannot invoke operation: ${operationId}`);
    }
    if (operationId === "propose_company_change" && isSelfEscalation(input, this.bootstrap.identity)) {
      throw new OmniSeedClientError("self_escalation_denied", "Lily cannot propose a change that grants or expands her own authority");
    }
    if (DISCOVERED_REQUESTS.has(operationId)) {
      const company = await this.invoke("inspect_company", {});
      const operation = company.operations?.find(item => item.id === operationId);
      if (operation?.implemented !== true || operation?.currentAvailability !== "available") {
        throw new OmniSeedClientError("operation_unavailable", "The company has no available governed handler for this stewardship request", { operationId });
      }
    }
    const url = `${this.bootstrap.endpoint}/v1/companies/${encodeURIComponent(this.bootstrap.companyRef)}/operations/${encodeURIComponent(operationId)}:invoke`;
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.bootstrap.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ input, actor: { actorId: this.bootstrap.identity, actorType: "ai" } }),
    });
    let payload;
    try { payload = await response.json(); }
    catch { throw new OmniSeedClientError("invalid_response", "OmniSeed returned a non-JSON response"); }
    if (!response.ok || payload?.ok === false) {
      throw new OmniSeedClientError(payload?.code ?? "operation_failed", payload?.error ?? "OmniSeed operation failed", payload?.details);
    }
    return payload?.result ?? payload;
  }
}

export function operationClient() {
  return new OmniSeedOperationClient();
}
