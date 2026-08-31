import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { executionProfileFor, turnGuard } from "../agent/lib/execution-profile.mjs";

const user = content => ({ role: "user", content });
const tool = name => ({ role: "tool", content: [{ type: "tool-result", toolName: name, result: {} }] });

test("conversation deterministically exposes no governed operations", () => {
  assert.equal(executionProfileFor("Hello!").name, "conversation");
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

test("every governed tool is guarded at Eve step resolution", async () => {
  const toolsUrl = new URL("../agent/tools/", import.meta.url);
  const files = (await readdir(toolsUrl)).filter(file => file.endsWith(".ts"));
  assert.equal(files.length, 14);
  for (const file of files) {
    const source = await readFile(new URL(file, toolsUrl), "utf8");
    assert.match(source, /defineDynamic/);
    assert.match(source, /"step\.started"/);
    assert.match(source, /shouldExposeOperation\(ctx\.messages/);
  }
});

test("Eve owns explicit durable session timing and output bounds", async () => {
  const source = await readFile(new URL("../agent/agent.ts", import.meta.url), "utf8");
  assert.match(source, /maxOutputTokensPerSession:\s*12_000/);
  assert.match(source, /sessionTimeoutMs:\s*24 \* 60 \* 60 \* 1_000/);
});
