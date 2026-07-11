import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureHasCredits, requireApiKey } from '../../src/v1-auth.js';

function createRequest(authHeader) {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  };
}

test('requireApiKey verifies Bearer token and loads credit balance', async () => {
  const calls = [];
  const db = {
    async execute(query) {
      calls.push(query);
      if (/FROM credit_balances/i.test(query.sql)) {
        assert.deepEqual(query.args, ['user-1']);
        return {
          rows: [{
            monthly_quota: 100,
            monthly_used: 40,
            pack_balance: 5,
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${query.sql}`);
    },
  };

  const auth = await requireApiKey(createRequest('Bearer u2d_' + 'a'.repeat(64)), {
    getDb: async () => db,
    verifyAndLoadKey: async (client, token) => {
      assert.equal(client, db);
      assert.equal(token, 'u2d_' + 'a'.repeat(64));
      return { userId: 'user-1', key: { id: 'key-1' } };
    },
  });

  assert.deepEqual(auth, {
    userId: 'user-1',
    keyId: 'key-1',
    balance: {
      monthly_quota: 100,
      monthly_used: 40,
      pack_balance: 5,
    },
    remaining: 65,
  });
  assert.equal(calls.length, 1);
});

test('requireApiKey rejects missing or invalid API keys with 401', async () => {
  await assert.rejects(
    () => requireApiKey(createRequest(null), {
      getDb: async () => ({ async execute() { return { rows: [] }; } }),
      verifyAndLoadKey: async () => null,
    }),
    (err) => err.status === 401 && err.code === 'invalid_api_key',
  );

  await assert.rejects(
    () => requireApiKey(createRequest('Bearer bad'), {
      getDb: async () => ({ async execute() { return { rows: [] }; } }),
      verifyAndLoadKey: async () => null,
    }),
    (err) => err.status === 401 && err.code === 'invalid_api_key',
  );
});

test('ensureHasCredits rejects empty balances with 402', () => {
  assert.throws(
    () => ensureHasCredits({
      balance: { monthly_quota: 10, monthly_used: 10, pack_balance: 0 },
      remaining: 0,
    }),
    (err) => err.status === 402 && err.code === 'insufficient_credits',
  );
});
