import { getDb as defaultGetDb } from './db.js';
import { verifyAndLoadKey as defaultVerifyAndLoadKey } from './api-keys.js';
import { getRemainingCredits } from './credits.js';

function httpError(status, code, message, usage) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (usage !== undefined) {
    err.usage = usage;
  }
  return err;
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
}

function normalizeBalance(row) {
  return {
    monthly_quota: Number(row.monthly_quota || 0),
    monthly_used: Number(row.monthly_used || 0),
    pack_balance: Number(row.pack_balance || 0),
  };
}

async function loadBalance(db, userId) {
  const { rows } = await db.execute({
    sql: `SELECT monthly_quota, monthly_used, pack_balance
          FROM credit_balances
          WHERE user_id = ?
          LIMIT 1`,
    args: [userId],
  });

  return normalizeBalance(rows[0] || {});
}

export function ensureHasCredits(auth) {
  const remaining = auth.remaining ?? getRemainingCredits(auth.balance);
  if (remaining <= 0) {
    throw httpError(402, 'insufficient_credits', 'Insufficient credits', { remaining: 0 });
  }
}

export async function requireApiKey(request, options = {}) {
  const getDb = options.getDb || defaultGetDb;
  const verifyAndLoadKey = options.verifyAndLoadKey || defaultVerifyAndLoadKey;
  const token = getBearerToken(request);
  if (!token) {
    throw httpError(401, 'invalid_api_key', 'Invalid API key');
  }

  const db = await getDb();
  const verified = await verifyAndLoadKey(db, token);
  if (!verified) {
    throw httpError(401, 'invalid_api_key', 'Invalid API key');
  }

  const balance = await loadBalance(db, verified.userId);
  return {
    userId: verified.userId,
    keyId: verified.key.id,
    balance,
    remaining: getRemainingCredits(balance),
  };
}
