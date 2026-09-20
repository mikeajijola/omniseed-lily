import test from 'node:test';
import assert from 'node:assert/strict';
import { currentCompanyTurnContext } from '../agent/lib/turn-context.mjs';
import { turnGuard } from '../agent/lib/execution-profile.mjs';

test('resumed turns read current revisions instead of reusing prior conversation context', async () => {
  let revision = 'old', calls = 0;
  const client = { async invoke(operation, input) {
    assert.equal(operation, 'inspect_company'); assert.deepEqual(input, {}); calls++;
    return { company: { id: 'company' }, instance: { companyId: 'company', desiredRevision: revision, observedRevision: revision, credential: 'must-not-project' }, capabilities: [{ id: 'steward', state: 'partial' }], secrets: 'must-not-project' };
  } };
  const before = await currentCompanyTurnContext(client, 'company');
  revision = 'new';
  const after = await currentCompanyTurnContext(client, 'company');
  assert.equal(before.desiredRevision, 'old'); assert.equal(after.desiredRevision, 'new');
  assert.equal(after.observedRevision, 'new'); assert.equal(after.capabilityCount, 1);
  assert.equal(after.autonomyState, 'not_declared'); assert.equal(calls, 2);
  assert(!JSON.stringify(after).includes('must-not-project'));
});

test('unavailable and cross-company inspection cannot fall back to historical state', async () => {
  await assert.rejects(currentCompanyTurnContext({ invoke: async () => { throw Error('sensitive upstream diagnostic'); } }, 'company'), e => !e.message.includes('sensitive') && e.message.includes('unavailable'));
  await assert.rejects(currentCompanyTurnContext({ invoke: async () => ({ company: { id: 'other' }, instance: { companyId: 'other' }, capabilities: [] }) }, 'company'), /authenticated company/);
});

test('the mandatory read and model tools share the same eight-call boundary', () => {
  const user = { role: 'user', content: 'Inspect the company' };
  const tool = { role: 'tool', content: 'result' };
  assert.equal(turnGuard([user], 'inspect_company').remaining, 7);
  assert.equal(turnGuard([user, ...Array(6).fill(tool)], 'inspect_company').allowed, true);
  assert.equal(turnGuard([user, ...Array(7).fill(tool)], 'inspect_company').allowed, false);
});
