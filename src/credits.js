import { randomUUID } from 'crypto';

const MAX_CONSUME_ATTEMPTS = 2;

export function getRemainingCredits(balance) {
  const monthlyRemaining = Math.max(0, balance.monthly_quota - balance.monthly_used);
  return monthlyRemaining + balance.pack_balance;
}

export function assertCanConsume(balance) {
  if (getRemainingCredits(balance) <= 0) {
    const err = new Error('Insufficient credits');
    err.status = 402;
    err.code = 'insufficient_credits';
    err.usage = { remaining: 0 };
    throw err;
  }
}

export function computeConsume(balance) {
  assertCanConsume(balance);

  if (balance.monthly_used < balance.monthly_quota) {
    return { ...balance, monthly_used: balance.monthly_used + 1 };
  }

  return { ...balance, pack_balance: balance.pack_balance - 1 };
}

function normalizeBalance(row = {}) {
  return {
    monthly_quota: Number(row.monthly_quota || 0),
    monthly_used: Number(row.monthly_used || 0),
    pack_balance: Number(row.pack_balance || 0),
  };
}

async function loadCreditBalance(db, userId) {
  const { rows } = await db.execute({
    sql: `SELECT monthly_quota, monthly_used, pack_balance
          FROM credit_balances
          WHERE user_id = ?
          LIMIT 1`,
    args: [userId],
  });

  return normalizeBalance(rows[0]);
}

function rowsAffected(result) {
  if (typeof result?.rowsAffected === 'bigint') {
    return Number(result.rowsAffected);
  }
  if (typeof result?.rowsAffected === 'number') {
    return result.rowsAffected;
  }
  return 0;
}

async function tryConsumeCredit(db, balance, options) {
  const nextBalance = computeConsume(balance);
  const usageId = options.id || randomUUID();
  const results = await db.batch([
    {
      sql: `UPDATE credit_balances
            SET monthly_used = ?, pack_balance = ?, updated_at = ?
            WHERE monthly_used = ?
              AND pack_balance = ?
              AND monthly_quota = ?
              AND user_id = ?`,
      args: [
        nextBalance.monthly_used,
        nextBalance.pack_balance,
        options.now,
        balance.monthly_used,
        balance.pack_balance,
        balance.monthly_quota,
        options.userId,
      ],
    },
    {
      sql: `INSERT INTO usage_events (id, user_id, key_id, endpoint, url_host, status, credits, latency_ms, created_at)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE changes() = 1`,
      args: [
        usageId,
        options.userId,
        options.keyId,
        options.endpoint,
        options.urlHost,
        options.status,
        options.credits,
        options.latencyMs,
        options.now,
      ],
    },
    {
      sql: `UPDATE api_keys
            SET last_used_at = ?
            WHERE id = ?
              AND changes() = 1`,
      args: [options.now, options.keyId],
    },
  ]);

  return rowsAffected(results[1]) === 1 ? nextBalance : null;
}

export async function consumeCreditAtomically(db, options) {
  for (let attempt = 0; attempt < MAX_CONSUME_ATTEMPTS; attempt += 1) {
    const balance = await loadCreditBalance(db, options.userId);
    const nextBalance = await tryConsumeCredit(db, balance, options);
    if (nextBalance) {
      return nextBalance;
    }
  }

  const latestBalance = await loadCreditBalance(db, options.userId);
  assertCanConsume(latestBalance);
  const err = new Error('Unable to consume credit');
  err.status = 402;
  err.code = 'insufficient_credits';
  err.usage = { remaining: getRemainingCredits(latestBalance) };
  throw err;
}
