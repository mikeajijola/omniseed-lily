const CONVERSATION = /^(?:hi|hello|hey|thanks|thank you|ok(?:ay)?|good (?:morning|afternoon|evening))[!.?\s]*$/i;
const WORK = /\b(?:generate|plan|apply|change|replace|create|delete|deploy|operate|set up|realise|realize|fix|reconcile|observe)\b/i;

export function semanticProfile(message = "") {
  const text = String(message).trim();
  if (CONVERSATION.test(text)) return Object.freeze({ executionClass: "conversation", reasoning: "minimal", maxToolCalls: 0 });
  if (!WORK.test(text) && (text.endsWith("?") || /\b(?:company|attention|missing|gap|provider|evidence|status)\b/i.test(text))) return Object.freeze({ executionClass: "company_query", reasoning: "concise", maxToolCalls: 2 });
  return Object.freeze({ executionClass: "company_work", reasoning: "full", maxToolCalls: 8 });
}

export function semanticTiming() {
  const acceptedAt = performance.now(), events = [];
  return Object.freeze({
    mark(name, attributes = {}) { events.push({ name, elapsedMs: Math.round((performance.now() - acceptedAt) * 100) / 100, ...attributes }); },
    snapshot() { return { events: structuredClone(events), totalMs: Math.round((performance.now() - acceptedAt) * 100) / 100 }; },
  });
}
