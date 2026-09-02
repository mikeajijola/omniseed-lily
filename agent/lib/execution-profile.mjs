const SOCIAL = /^(?:(?:hi|hello|hey)(?:\s+there)?(?:,?\s+how(?:'s| is) it going|,?\s+how are you)?|(?:thanks|thank you)(?:\s+(?:so|very)\s+much)?|ok(?:ay)?|no worries|you(?:'re| are) welcome|good (?:morning|afternoon|evening)|(?:good)?bye)[!.?,\s]*$/i;
const DURABLE_WORK = /\b(?:generate|plan|apply|change|replace|create|delete|deploy|operate|set up|realise|realize|fix|reconcile|observe|propose|merge)\b/i;

export const EXECUTION_PROFILES = Object.freeze({
  conversation: Object.freeze({ name: "conversation", governedToolLimit: 0, operations: Object.freeze([]) }),
  company_query: Object.freeze({
    name: "company_query",
    governedToolLimit: 2,
    operations: Object.freeze(["inspect_company", "get_capability", "inspect_company_change", "preview_company_change", "inspect_realisation", "inspect_provider_binding", "list_activity", "get_plan"]),
  }),
  company_work: Object.freeze({ name: "company_work", governedToolLimit: 8, operations: Object.freeze(["*"]) }),
});

export function messageText(message) {
  if (typeof message === "string") return message;
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) return message.content.filter(part => part?.type === "text").map(part => part.text ?? "").join(" ");
  return "";
}

export function executionProfileFor(text = "") {
  const value = String(text).trim();
  if (SOCIAL.test(value)) return EXECUTION_PROFILES.conversation;
  if (!DURABLE_WORK.test(value) && (value.endsWith("?") || /\b(?:company|attention|missing|gap|provider|evidence|status|capability|proposal)\b/i.test(value))) {
    return EXECUTION_PROFILES.company_query;
  }
  return EXECUTION_PROFILES.company_work;
}

export function turnGuard(messages = [], operationId) {
  const lastUser = messages.findLastIndex(message => message?.role === "user");
  const profile = lastUser < 0 ? EXECUTION_PROFILES.conversation : executionProfileFor(messageText(messages[lastUser]));
  const governedCalls = lastUser < 0 ? 0 : messages.slice(lastUser + 1).filter(message => message?.role === "tool").reduce((count, message) => count + (Array.isArray(message.content) ? Math.max(1, message.content.length) : 1), 0);
  const operationAllowed = profile.operations.includes("*") || profile.operations.includes(operationId);
  return Object.freeze({ profile: profile.name, limit: profile.governedToolLimit, governedCalls, remaining: Math.max(0, profile.governedToolLimit - governedCalls), allowed: operationAllowed && governedCalls < profile.governedToolLimit });
}

export function shouldExposeOperation(messages, operationId) {
  return turnGuard(messages, operationId).allowed;
}
