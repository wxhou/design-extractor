import { jsonErr, jsonOk } from '@/src/api-response.js';
import { getDb } from '@/src/db.js';
import { requireApiKey } from '@/src/v1-auth.js';

async function markApiKeyUsed(db, keyId) {
  await db.execute({
    sql: 'UPDATE api_keys SET last_used_at = ? WHERE id = ?',
    args: [new Date().toISOString(), keyId],
  });
}

export async function GET(request) {
  const db = await getDb();
  let auth;

  try {
    auth = await requireApiKey(request, { getDb: async () => db });
  } catch (error) {
    return jsonErr(error.status || 401, error.code || 'invalid_api_key', error.message, error.usage);
  }

  const result = await db.execute({
    sql: `SELECT
            COUNT(*) as request_count,
            COALESCE(SUM(credits), 0) as credits_used
          FROM usage_events
          WHERE user_id = ?`,
    args: [auth.userId],
  });
  await markApiKeyUsed(db, auth.keyId);

  const row = result.rows[0] || {};
  return jsonOk({
    remaining: auth.remaining,
    monthly_quota: auth.balance.monthly_quota,
    monthly_used: auth.balance.monthly_used,
    pack_balance: auth.balance.pack_balance,
    request_count: Number(row.request_count || 0),
    credits_used: Number(row.credits_used || 0),
  }, { remaining: auth.remaining });
}
