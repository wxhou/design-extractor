import { generateApiKey } from './api-keys.js';
import { getRemainingCredits } from './credits.js';

const DEFAULT_KEY_NAME = 'default';
const MAX_KEY_NAME_LENGTH = 80;

function serializeKey(row) {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

function normalizeKeyName(name) {
  if (typeof name !== 'string') {
    return DEFAULT_KEY_NAME;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return DEFAULT_KEY_NAME;
  }

  return trimmed.slice(0, MAX_KEY_NAME_LENGTH);
}

function normalizeBalance(row) {
  return {
    monthly_quota: Number(row.monthly_quota || 0),
    monthly_used: Number(row.monthly_used || 0),
    pack_balance: Number(row.pack_balance || 0),
  };
}

export async function listDashboardApiKeys(db, userId) {
  const { rows } = await db.execute({
    sql: `SELECT id, name, key_prefix, created_at, last_used_at
          FROM api_keys
          WHERE user_id = ? AND revoked_at IS NULL
          ORDER BY created_at DESC`,
    args: [userId],
  });

  return rows.map(serializeKey);
}

export async function createDashboardApiKey(db, userId, options = {}) {
  const now = options.now || new Date().toISOString();
  const generated = (options.generateKey || generateApiKey)();
  const name = normalizeKeyName(options.name);

  await db.execute({
    sql: `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      generated.id,
      userId,
      generated.keyHash,
      generated.keyPrefix,
      name,
      now,
    ],
  });

  return {
    plaintext: generated.plaintext,
    key: {
      id: generated.id,
      name,
      key_prefix: generated.keyPrefix,
      created_at: now,
      last_used_at: null,
    },
  };
}

export async function revokeDashboardApiKey(db, userId, keyId, options = {}) {
  if (!keyId) {
    return null;
  }

  const now = options.now || new Date().toISOString();
  const { rows } = await db.execute({
    sql: `UPDATE api_keys
          SET revoked_at = ?
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL
          RETURNING id, name, key_prefix, created_at, last_used_at`,
    args: [now, keyId, userId],
  });

  return rows[0] ? serializeKey(rows[0]) : null;
}

export async function getDashboardCredits(db, userId) {
  const { rows } = await db.execute({
    sql: `SELECT monthly_quota, monthly_used, pack_balance
          FROM credit_balances
          WHERE user_id = ?
          LIMIT 1`,
    args: [userId],
  });

  if (!rows[0]) {
    return null;
  }

  return getRemainingCredits(normalizeBalance(rows[0]));
}
