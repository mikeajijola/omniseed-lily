/**
 * Project the ordinary inspect_company result into bounded Agent context.
 * OmniSeed remains authoritative; this removes repeated plan/provider payloads
 * that are useful to the human UI but can exceed a semantic runtime's context.
 */
export function projectCompanyInspection(registry) {
  return {
    company: registry.company,
    instance: registry.instance,
    stewardship: {
      capability: compactCapability(registry.stewardship?.capability),
      realisation: compactRealisation(registry.stewardship?.realisation),
    },
    capabilities: (registry.capabilities ?? []).map(compactCapability),
    realisations: (registry.realisations ?? []).map(compactRealisation),
    providers: registry.providers ?? [],
    providerGaps: registry.providerGaps ?? [],
    operations: (registry.operations ?? []).map(operation => ({
      id: operation.id,
      capability: operation.capability,
      description: operation.description,
      mutation: operation.mutation,
      permissions: operation.permissions,
      interfaces: operation.interfaces,
      currentAvailability: operation.currentAvailability,
    })),
    observations: (registry.observations ?? []).map(compactEvidence),
    evidence: (registry.evidence ?? []).slice(-20).map(compactEvidence),
    proposals: (registry.proposals ?? []).map(proposal => ({
      id: proposal.id,
      hash: proposal.hash,
      status: proposal.status,
      reason: proposal.reason,
      proposedBy: proposal.proposedBy,
      createdAt: proposal.createdAt,
      submission: proposal.submission && {
        branch: proposal.submission.branch,
        commit: proposal.submission.commit,
        pullRequest: proposal.submission.pullRequest,
        baseRevision: proposal.submission.baseRevision,
      },
    })),
    activity: (registry.history ?? []).slice(-20),
    definitionHash: registry.definitionHash,
  };
}

function compactCapability(capability) {
  if (!capability) return null;
  return {
    id: capability.id,
    name: capability.name,
    description: capability.description,
    autonomy: capability.autonomy,
    state: capability.state,
    requirements: (capability.requirements ?? capability.requires ?? []).map(requirement => ({
      id: requirement.id,
      primitiveFamily: requirement.primitiveFamily,
      covered: requirement.covered,
      state: requirement.state,
      reason: requirement.reason,
    })),
    realisations: (capability.realisations ?? []).map(item => typeof item === "string" ? item : item?.id).filter(Boolean),
  };
}

function compactRealisation(realisation) {
  if (!realisation) return null;
  return {
    id: realisation.id,
    name: realisation.name,
    capability: realisation.capability,
    status: realisation.status,
    participants: (realisation.participants ?? []).map(participant => ({
      resource: participant.resource,
      role: participant.role,
      supplies: participant.supplies,
      family: participant.family,
      provider: participant.provider,
      desired: compactResource(participant.desired),
      observed: participant.observed && {
        status: participant.observed.status,
        checkedAt: participant.observed.checkedAt,
        providerResourceId: participant.observed.providerResourceId,
        evidence: (participant.observed.evidence ?? []).map(compactEvidence),
      },
    })),
    evidence: (realisation.evidence ?? []).slice(-10).map(compactEvidence),
  };
}

function compactResource(resource) {
  if (!resource) return null;
  return {
    id: resource.id,
    name: resource.name,
    family: resource.family,
    provider: resource.provider,
    offers: resource.offers,
    risk: resource.risk,
    spec: resource.spec,
  };
}

function compactEvidence(item) {
  if (!item) return item;
  return {
    id: item.id,
    type: item.type,
    source: item.source,
    status: item.status,
    state: item.state,
    observedAt: item.observedAt,
    checkedAt: item.checkedAt,
    resourceId: item.resourceId,
    providerResourceId: item.providerResourceId,
    matchesDesired: item.matchesDesired,
  };
}
