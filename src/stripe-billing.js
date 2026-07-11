const PLAN_ENTITLEMENTS = {
  free: { monthlyQuota: 100 },
  starter: { monthlyQuota: 500 },
  pro: { monthlyQuota: 2000 },
};

export function getPlanForPrice(priceId, env = process.env) {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === env.STRIPE_PRICE_PRO) return 'pro';
  return null;
}

export function getPlanEntitlement(plan, options = {}) {
  const normalizedPlan = options.canceled ? 'free' : plan;
  const entitlement = PLAN_ENTITLEMENTS[normalizedPlan] || PLAN_ENTITLEMENTS.free;
  return {
    plan: PLAN_ENTITLEMENTS[normalizedPlan] ? normalizedPlan : 'free',
    monthlyQuota: entitlement.monthlyQuota,
    monthlyUsed: 0,
  };
}

export function getStripeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return typeof value.id === 'string' ? value.id : null;
}

export function getSubscriptionPriceId(subscription) {
  return subscription?.items?.data?.[0]?.price?.id || null;
}

export function getSubscriptionPeriodEnd(subscription) {
  if (!subscription?.current_period_end) return null;
  return new Date(subscription.current_period_end * 1000).toISOString();
}

export function getSubscriptionPeriodStart(subscription) {
  if (!subscription?.current_period_start) return null;
  return new Date(subscription.current_period_start * 1000).toISOString();
}

export async function findUserIdByStripeCustomer(db, customerId) {
  if (!customerId) return null;
  const { rows } = await db.execute({
    sql: `SELECT id
          FROM users
          WHERE stripe_customer_id = ?
          LIMIT 1`,
    args: [customerId],
  });
  return rows[0]?.id || null;
}

export async function getOrCreateStripeCustomer({ db, stripe, user }) {
  const { rows } = await db.execute({
    sql: `SELECT stripe_customer_id
          FROM users
          WHERE id = ?
          LIMIT 1`,
    args: [user.id],
  });
  const existingCustomerId = rows[0]?.stripe_customer_id;
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name || undefined,
    metadata: { user_id: user.id },
  });

  await db.execute({
    sql: `UPDATE users
          SET stripe_customer_id = ?
          WHERE id = ?`,
    args: [customer.id, user.id],
  });

  return customer.id;
}

async function loadEntitlementState(db, userId) {
  const { rows } = await db.execute({
    sql: `SELECT s.plan, cb.period_start
          FROM subscriptions s
          LEFT JOIN credit_balances cb ON cb.user_id = s.user_id
          WHERE s.user_id = ?
          LIMIT 1`,
    args: [userId],
  });
  return rows[0] || null;
}

function hasAdvancedPeriod(previousPeriodStart, nextPeriodStart) {
  if (!previousPeriodStart || !nextPeriodStart) return false;
  return new Date(nextPeriodStart).getTime() > new Date(previousPeriodStart).getTime();
}

function shouldResetMonthlyUsage(state, input, entitlement) {
  if (input.resetMonthlyUsed) return true;
  if (!state) return true;
  if (state.plan !== entitlement.plan) return true;
  return hasAdvancedPeriod(state.period_start, input.periodStart);
}

function buildCreditBalanceStatement({ input, entitlement, now, resetMonthlyUsed }) {
  const periodStart = input.periodStart || now;
  const updateMonthlyUsed = resetMonthlyUsed
    ? 'monthly_used = excluded.monthly_used'
    : 'monthly_used = credit_balances.monthly_used';

  return {
    sql: `INSERT INTO credit_balances (user_id, monthly_quota, monthly_used, pack_balance, period_start, updated_at)
          VALUES (?, ?, ?, 0, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            monthly_quota = excluded.monthly_quota,
            ${updateMonthlyUsed},
            period_start = COALESCE(excluded.period_start, credit_balances.period_start),
            updated_at = excluded.updated_at`,
    args: [
      input.userId,
      entitlement.monthlyQuota,
      entitlement.monthlyUsed,
      periodStart,
      now,
    ],
  };
}

export async function findBlockingCheckoutSubscription(db, userId) {
  const { rows } = await db.execute({
    sql: `SELECT stripe_subscription_id, status
          FROM subscriptions
          WHERE user_id = ?
            AND stripe_subscription_id IS NOT NULL
            AND stripe_subscription_id <> ''
            AND status IN ('active', 'trialing', 'past_due')
          LIMIT 1`,
    args: [userId],
  });
  return rows[0] || null;
}

export async function applySubscriptionEntitlement(db, input) {
  const now = input.now || new Date().toISOString();
  const entitlement = getPlanEntitlement(input.plan, { canceled: input.canceled });
  const status = input.canceled ? 'canceled' : input.status || 'active';
  const state = await loadEntitlementState(db, input.userId);
  const resetMonthlyUsed = shouldResetMonthlyUsage(state, input, entitlement);
  const statements = [];

  if (input.customerId) {
    statements.push({
      sql: `UPDATE users
            SET stripe_customer_id = ?
            WHERE id = ?`,
      args: [input.customerId, input.userId],
    });
  }

  statements.push(
    {
      sql: `INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, status, period_end, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              stripe_subscription_id = excluded.stripe_subscription_id,
              plan = excluded.plan,
              status = excluded.status,
              period_end = excluded.period_end,
              updated_at = excluded.updated_at`,
      args: [
        input.userId,
        input.subscriptionId,
        entitlement.plan,
        status,
        input.periodEnd || null,
        now,
      ],
    },
    buildCreditBalanceStatement({ input, entitlement, now, resetMonthlyUsed }),
  );

  await db.batch(statements, 'write');
  return entitlement;
}
