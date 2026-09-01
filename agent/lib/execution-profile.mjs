export const GOVERNED_OPERATION_LIMIT = 8;
export const GOVERNED_OPERATIONS = Object.freeze([
  "apply_company_change", "apply_plan", "generate_plan", "get_capability", "get_plan",
  "inspect_company", "inspect_company_change", "inspect_provider_binding", "inspect_realisation",
  "list_activity", "merge_company_change", "observe_company", "preview_company_change",
  "propose_company_change",
]);

export const EXECUTION_PROFILES = Object.freeze({
  conversation: Object.freeze({ name: "conversation", governedToolLimit: 0, operations: Object.freeze([]) }),
  semantic_turn: Object.freeze({ name: "semantic_turn", governedToolLimit: GOVERNED_OPERATION_LIMIT, operations: GOVERNED_OPERATIONS }),
});

export function messageText(message) {
  if (typeof message === "string") return message;
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) return message.content.filter(part => part?.type === "text").map(part => part.text ?? "").join(" ");
  return "";
}

export function executionProfileFor(text = "") {
  return String(text).trim() ? EXECUTION_PROFILES.semantic_turn : EXECUTION_PROFILES.conversation;
}

export function turnGuard(messages = [], operationId) {
  const lastUser = messages.findLastIndex(message => message?.role === "user");
  const profile = lastUser < 0 ? EXECUTION_PROFILES.conversation : executionProfileFor(messageText(messages[lastUser]));
  const governedCalls = lastUser < 0 ? 0 : messages.slice(lastUser + 1).filter(message => message?.role === "tool").reduce((count, message) => count + (Array.isArray(message.content) ? Math.max(1, message.content.length) : 1), 0);
  const operationAllowed = profile.operations.includes(operationId);
  return Object.freeze({ profile: profile.name, limit: profile.governedToolLimit, governedCalls, remaining: Math.max(0, profile.governedToolLimit - governedCalls), allowed: operationAllowed && governedCalls < profile.governedToolLimit });
}

export function shouldExposeOperation(messages, operationId) {
  return turnGuard(messages, operationId).allowed;
}
