import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRemainingCredits,
  computeConsume,
  assertCanConsume,
  consumeCreditAtomically,
} from '../../src/credits.js';

test('consume prefers monthly quota then pack', () => {
  const b = { monthly_quota: 100, monthly_used: 99, pack_balance: 2 };
  assert.equal(getRemainingCredits(b), 3);
  const next = computeConsume(b);
  assert.equal(next.monthly_used, 100);
  assert.equal(next.pack_balance, 2);
  const next2 = computeConsume(next);
  assert.equal(next2.pack_balance, 1);
});

test('computeConsume throws when empty', () => {
  assert.throws(() => computeConsume({ monthly_quota: 10, monthly_used: 10, pack_balance: 0 }));
});

test('assertCanConsume throws insufficient_credits when empty', () => {
  assert.throws(
    () => assertCanConsume({ monthly_quota: 10, monthly_used: 10, pack_balance: 0 }),
    (err) => err.code === 'insufficient_credits',
  );
});

test('consumeCreditAtomically retries stale balance and records usage only after deducting', async () => {
  const balances = [
    { monthly_quota: 1, monthly_used: 0, pack_balance: 1 },
    { monthly_quota: 1, monthly_used: 1, pack_balance: 1 },
  ];
  const batches = [];
  const db = {
    async execute({ sql, args }) {
      assert.match(sql, /FROM credit_balances/i);
      assert.deepEqual(args, ['user-1']);
      return { rows: [balances.shift()] };
    },
    async batch(statements) {
      batches.push(statements);
      const update = statements[0];
      const expectedMonthlyUsed = update.args[3];
      const affected = expectedMonthlyUsed === 0 ? 0 : 1;
      return [
        { rowsAffected: affected },
        { rowsAffected: affected },
        { rowsAffected: 1 },
      ];
    },
  };

  const nextBalance = await consumeCreditAtomically(db, {
    userId: 'user-1',
    keyId: 'key-1',
    endpoint: '/api/v1/extract',
    urlHost: 'example.com',
    status: 'success',
    credits: 1,
    latencyMs: 42,
    now: '2026-07-11T00:00:00.000Z',
    id: 'usage-1',
  });

  assert.equal(batches.length, 2);
  assert.equal(nextBalance.monthly_used, 1);
  assert.equal(nextBalance.pack_balance, 0);
  assert.match(batches[1][1].sql, /WHERE changes\(\) = 1/i);
});

test('consumeCreditAtomically rejects without writing usage when refreshed balance is empty', async () => {
  let batchCalled = false;
  const db = {
    async execute() {
      return { rows: [{ monthly_quota: 1, monthly_used: 1, pack_balance: 0 }] };
    },
    async batch() {
      batchCalled = true;
    },
  };

  await assert.rejects(
    () => consumeCreditAtomically(db, {
      userId: 'user-1',
      keyId: 'key-1',
      endpoint: '/api/v1/extract',
      urlHost: 'example.com',
      status: 'success',
      credits: 1,
      latencyMs: 42,
      now: '2026-07-11T00:00:00.000Z',
      id: 'usage-2',
    }),
    (err) => err.status === 402 && err.code === 'insufficient_credits',
  );
  assert.equal(batchCalled, false);
});
