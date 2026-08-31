import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { executionProfileFor, turnGuard } from "../agent/lib/execution-profile.mjs";

const user = content => ({ role: "user", content });
const tool = name => ({ role: "tool", content: [{ type: "tool-result", toolName: name, result: {} }] });

test("conversation deterministically exposes no governed operations", () => {
  for (const message of ["Hello!", "Hi there", "hey, how's it going", "thank you so much", "no worries"]) {
    assert.equal(executionProfileFor(message).name, "conversation", message);
  }
  assert.deepEqual(turnGuard([user("Hello!")], "inspect_company"), {
    profile: "conversation", limit: 0, governedCalls: 0, remaining: 0, allowed: false,
  });
});

test("company queries are read-only and stop after two durable tool results", () => {
  const start = [user("What is the company status?")];
  assert.equal(turnGuard(start, "inspect_company").allowed, true);
  assert.equal(turnGuard(start, "propose_company_change").allowed, false);
  const bounded = [...start, tool("inspect_company"), tool("get_capability")];
  assert.deepEqual(turnGuard(bounded, "get_plan"), {
    profile: "company_query", limit: 2, governedCalls: 2, remaining: 0, allowed: false,
  });
});

test("company work retains governed durable operations within its bound", () => {
  const messages = [user("Propose the evidenced company change"), ...Array.from({ length: 7 }, () => tool("inspect_company"))];
  assert.equal(turnGuard(messages, "propose_company_change").allowed, true);
  assert.equal(turnGuard([...messages, tool("preview_company_change")], "apply_company_change").allowed, false);
});

test("a later user turn gets a fresh bound without discarding prior durable history", () => {
  const messages = [user("What is the status?"), tool("inspect_company"), tool("get_capability"), user("Which provider is bound?")];
  assert.equal(turnGuard(messages, "inspect_provider_binding").governedCalls, 0);
  assert.equal(turnGuard(messages, "inspect_provider_binding").allowed, true);
});

test("Eve step resolution removes every governed tool from social turns", async () => {
  const toolsUrl = new URL("../agent/tools/", import.meta.url);
  const files = (await readdir(toolsUrl)).filter(file => file.endsWith(".ts"));
  assert.equal(files.length, 14);
  for (const file of files) {
    const definition = (await import(new URL(file, toolsUrl))).default;
    assert.equal(definition.kind, "eve:dynamic", file);
    const resolve = definition.events["step.started"];
    assert.equal(typeof resolve, "function", file);
    assert.equal(await resolve({ type: "step.started" }, { messages: [user("Hi there")] }), null, file);
    assert.equal(typeof (await resolve({ type: "step.started" }, { messages: [user("Fix the evidenced company gap")] }))?.execute, "function", file);
  }
});

test("Eve step resolution exposes only profile operations and enforces call bounds", async () => {
  const inspectCompany = (await import("../agent/tools/inspect_company.ts")).default.events["step.started"];
  const proposeChange = (await import("../agent/tools/propose_company_change.ts")).default.events["step.started"];
  const event = { type: "step.started" };
  const query = [user("What is the company status?")];

  assert.equal(typeof (await inspectCompany(event, { messages: query })).execute, "function");
  assert.equal(await proposeChange(event, { messages: query }), null);
  assert.equal(await inspectCompany(event, { messages: [...query, tool("inspect_company"), tool("get_capability")] }), null);

  const work = [user("Propose the evidenced company change")];
  assert.equal(typeof (await proposeChange(event, { messages: work })).execute, "function");
});

test("Eve owns explicit durable session timing and output bounds", async () => {
  const source = await readFile(new URL("../agent/agent.ts", import.meta.url), "utf8");
  assert.match(source, /maxOutputTokensPerSession:\s*12_000/);
  assert.match(source, /sessionTimeoutMs:\s*24 \* 60 \* 60 \* 1_000/);
});
