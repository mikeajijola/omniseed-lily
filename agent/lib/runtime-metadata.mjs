const FULL_SHA = /^[0-9a-f]{40}$/;

export function loadDeploymentMetadata(env = process.env) {
  const companyRef = env.OMNISEED_COMPANY_REF;
  const agentIdentity = env.OMNISEED_AGENT_IDENTITY;
  const environment = env.OMNISEED_ENVIRONMENT;
  const repository = env.OMNISEED_SOURCE_REPOSITORY;
  const commitSha = env.OMNISEED_SOURCE_COMMIT_SHA;
  const missing = Object.entries({ companyRef, agentIdentity, environment, repository, commitSha }).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Lily deployment metadata is incomplete: ${missing.join(", ")}`);
  if (!FULL_SHA.test(commitSha)) throw new Error("Lily deployment source must be a full commit SHA");
  return Object.freeze({ companyRef, agentIdentity, environment, source: Object.freeze({ repository, commitSha }) });
}

export function runtimeHealth(env = process.env) {
  loadDeploymentMetadata(env);
  return { ok: true, status: "healthy" };
}

export function runtimeInfo(env = process.env) {
  return { ...loadDeploymentMetadata(env), agent: { framework: "eve" } };
}
