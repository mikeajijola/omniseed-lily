import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { EXECUTION_PROFILES, SEMANTIC_OPERATIONS, executionProfileFor, turnGuard } from "../agent/lib/execution-profile.mjs";

const user = content => ({ role: "user", content });
const tool = name => ({ role: "tool", content: [{ type: "tool-result", toolName: name, result: {} }] });

test("natural paraphrases receive the same bounded semantic tool surface", () => {
  const paraphrases = [
    "What is the company status?",
    "Could you see how things are shaping up around here?",
    "Please turn what we found into a sensible suggestion.",
    "I wonder whether our current setup still matches what we intended.",
  ];
  for (const message of paraphrases) {
    assert.equal(executionProfileFor(message), EXECUTION_PROFILES.semantic_turn, message);
    for (const operation of SEMANTIC_OPERATIONS) assert.equal(turnGuard([user(message)], operation).allowed, true, `${message}: ${operation}`);
  }
});

test("empty turns expose no tools", () => {
  for (const message of ["", "   \n\t", { type: "image" }]) {
    assert.deepEqual(turnGuard([user(message)], "inspect_company"), {
      profile: "empty_turn", limit: 0, governedCalls: 0, remaining: 0, allowed: false,
    });
  }
});

test("greetings can never access apply, merge, approval, Provider, or authority mutation", () => {
  for (const operation of ["apply_company_change", "apply_plan", "merge_company_change", "approve_company_change", "provider.mutate", "authority.mutate"]) {
    assert.equal(turnGuard([user("Hello there!")], operation).allowed, false, operation);
  }
  assert.equal(turnGuard([user("Hello there!")], "inspect_company").allowed, true);
});

test("multi-step inspection and proposal remains possible within the semantic bound", () => {
  const messages = [user("Could you understand the situation and suggest the evidenced correction?"), tool("inspect_company"), tool("get_capability"), tool("inspect_realisation"), tool("propose_company_change"), tool("preview_company_change")];
  assert.deepEqual(turnGuard(messages, "inspect_company_change"), {
    profile: "semantic_turn", limit: 8, governedCalls: 5, remaining: 3, allowed: true,
  });
  assert.equal(turnGuard(messages, "propose_company_change").allowed, true);
  assert.equal(turnGuard([...messages, tool("list_activity"), tool("get_plan"), tool("observe_company")], "inspect_company").allowed, false);
});

test("a later non-empty user turn gets a fresh semantic bound", () => {
  const messages = [user("Take a look."), ...Array.from({ length: 8 }, () => tool("inspect_company")), user("And what follows from that?")];
  assert.equal(turnGuard(messages, "inspect_provider_binding").governedCalls, 0);
  assert.equal(turnGuard(messages, "inspect_provider_binding").allowed, true);
});

test("routing contains no keyword or regular-expression classifier", async () => {
  const source = await readFile(new URL("../agent/lib/execution-profile.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /SOCIAL|DURABLE_WORK|company_query|company_work/);
  assert.doesNotMatch(source, /new RegExp|\.(?:test|match)\s*\(/);
  assert.match(source, /String\(text\)\.trim\(\)/);
});

test("Eve tool manifest contains only the safe semantic operation surface", async () => {
  const toolsUrl = new URL("../agent/tools/", import.meta.url);
  const files = (await readdir(toolsUrl)).filter(file => file.endsWith(".ts")).sort();
  assert.deepEqual(files, SEMANTIC_OPERATIONS.map(operation => `${operation}.ts`).sort());
  const event = { type: "step.started" };
  for (const file of files) {
    const definition = (await import(new URL(file, toolsUrl))).default;
    assert.equal(definition.kind, "eve:dynamic", file);
    const resolve = definition.events["step.started"];
    assert.equal(await resolve(event, { messages: [user("")] }), null, file);
    assert.equal(typeof (await resolve(event, { messages: [user("Good morning")] }))?.execute, "function", file);
  }
});

test("Eve owns explicit durable session timing and output bounds", async () => {
  const source = await readFile(new URL("../agent/agent.ts", import.meta.url), "utf8");
  assert.match(source, /maxOutputTokensPerSession:\s*12_000/);
  assert.match(source, /sessionTimeoutMs:\s*24 \* 60 \* 60 \* 1_000/);
});
