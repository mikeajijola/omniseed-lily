export const SEMANTIC_OPERATIONS = Object.freeze([
  "inspect_company",
  "get_capability",
  "inspect_company_change",
  "preview_company_change",
  "inspect_realisation",
  "inspect_provider_binding",
  "list_activity",
  "generate_plan",
  "get_plan",
  "observe_company",
  "propose_company_change",
]);

export const EXECUTION_PROFILES = Object.freeze({
  empty_turn: Object.freeze({ name: "empty_turn", governedToolLimit: 0, operations: Object.freeze([]) }),
  semantic_turn: Object.freeze({ name: "semantic_turn", governedToolLimit: 8, operations: SEMANTIC_OPERATIONS }),
});

export function messageText(message) {
  if (typeof message === "string") return message;
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) return message.content.filter(part => part?.type === "text").map(part => part.text ?? "").join(" ");
  return "";
}

export function executionProfileFor(text = "") {
  return String(text).trim() ? EXECUTION_PROFILES.semantic_turn : EXECUTION_PROFILES.empty_turn;
}

export function turnGuard(messages = [], operationId) {
  const lastUser = messages.findLastIndex(message => message?.role === "user");
  const profile = lastUser < 0 ? EXECUTION_PROFILES.empty_turn : executionProfileFor(messageText(messages[lastUser]));
  const governedCalls = lastUser < 0 ? 0 : messages.slice(lastUser + 1).filter(message => message?.role === "tool").reduce((count, message) => count + (Array.isArray(message.content) ? Math.max(1, message.content.length) : 1), 0);
  const operationAllowed = profile.operations.includes(operationId);
  return Object.freeze({ profile: profile.name, limit: profile.governedToolLimit, governedCalls, remaining: Math.max(0, profile.governedToolLimit - governedCalls), allowed: operationAllowed && governedCalls < profile.governedToolLimit });
}

export function shouldExposeOperation(messages, operationId) {
  return turnGuard(messages, operationId).allowed;
}
