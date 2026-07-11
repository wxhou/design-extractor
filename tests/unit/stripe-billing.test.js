import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlanForPrice,
  getPlanEntitlement,
  applySubscriptionEntitlement,
} from '../../src/stripe-billing.js';

test('getPlanForPrice maps configured Stripe prices to plans', () => {
  const env = {
    STRIPE_PRICE_STARTER: 'price_starter',
    STRIPE_PRICE_PRO: 'price_pro',
  };

  assert.equal(getPlanForPrice('price_starter', env), 'starter');
  assert.equal(getPlanForPrice('price_pro', env), 'pro');
  assert.equal(getPlanForPrice('price_unknown', env), null);
});

test('getPlanEntitlement maps plans to quota and resets monthly usage', () => {
  assert.deepEqual(getPlanEntitlement('starter'), {
    plan: 'starter',
    monthlyQuota: 500,
    monthlyUsed: 0,
  });
  assert.deepEqual(getPlanEntitlement('pro'), {
    plan: 'pro',
    monthlyQuota: 2000,
    monthlyUsed: 0,
  });
});

test('getPlanEntitlement maps canceled subscriptions to free without pack changes', () => {
  assert.deepEqual(getPlanEntitlement('starter', { canceled: true }), {
    plan: 'free',
    monthlyQuota: 100,
    monthlyUsed: 0,
  });
});

test('applySubscriptionEntitlement ON CONFLICT does not overwrite pack_balance', async () => {
  const batches = [];
  const db = {
    async batch(statements) {
      batches.push(statements);
    },
  };

  const entitlement = await applySubscriptionEntitlement(db, {
    userId: 'user-1',
    subscriptionId: 'sub_1',
    plan: 'starter',
    status: 'active',
    periodEnd: '2026-08-11T00:00:00.000Z',
    now: '2026-07-11T00:00:00.000Z',
  });

  assert.deepEqual(entitlement, {
    plan: 'starter',
    monthlyQuota: 500,
    monthlyUsed: 0,
  });
  assert.equal(batches.length, 1);

  const creditStmt = batches[0].find((statement) => /credit_balances/i.test(statement.sql));
  assert.ok(creditStmt, 'expected credit_balances statement');
  assert.match(creditStmt.sql, /ON CONFLICT\(user_id\) DO UPDATE SET/i);
  assert.doesNotMatch(creditStmt.sql, /pack_balance\s*=\s*excluded\.pack_balance/i);
  assert.match(creditStmt.sql, /monthly_quota\s*=\s*excluded\.monthly_quota/i);
  assert.match(creditStmt.sql, /monthly_used\s*=\s*excluded\.monthly_used/i);
  assert.deepEqual(creditStmt.args, ['user-1', 500, 0, '2026-07-11T00:00:00.000Z', '2026-07-11T00:00:00.000Z']);
});
