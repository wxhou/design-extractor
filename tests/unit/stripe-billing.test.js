import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlanForPrice,
  getPlanEntitlement,
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
