/** One authenticated read per non-empty turn, including resumed sessions. */
export async function currentCompanyTurnContext(client, companyRef) {
  let registry;
  try { registry = await client.invoke("inspect_company", {}); }
  catch { throw new Error("Current company context is unavailable; retry the turn after governed inspection recovers."); }
  if (registry?.company?.id !== companyRef || registry?.instance?.companyId !== companyRef || !Array.isArray(registry.capabilities)) {
    throw new Error("Current company context does not match the authenticated company.");
  }
  const instance = registry.instance;
  return {
    companyId: companyRef,
    generatedAt: registry.generatedAt ?? null,
    desiredRevision: instance.desiredRevision ?? null,
    observedRevision: instance.observedRevision ?? null,
    observedStateRevision: instance.observedStateRevision ?? null,
    capabilityCount: registry.capabilities.length,
    capabilityStates: registry.capabilities.map(({ id, state }) => ({ id, state })),
    stewardshipState: registry.stewardship?.capability?.state ?? null,
    autonomyState: registry.stewardship?.autonomy?.state ?? "not_declared",
  };
}
