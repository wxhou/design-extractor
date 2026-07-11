import test from 'node:test';
import assert from 'node:assert/strict';
import { getRemainingCredits, computeConsume, assertCanConsume } from '../../src/credits.js';

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
