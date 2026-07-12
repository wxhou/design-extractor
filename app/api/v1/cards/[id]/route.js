import { jsonErr, jsonOk } from '@/src/api-response.js';
import { getDb } from '@/src/db.js';
import { requireApiKey } from '@/src/v1-auth.js';

async function markApiKeyUsed(db, keyId) {
  await db.execute({
    sql: 'UPDATE api_keys SET last_used_at = ? WHERE id = ?',
    args: [new Date().toISOString(), keyId],
  });
}

export async function GET(request, { params }) {
  const db = await getDb();
  let auth;

  try {
    auth = await requireApiKey(request, { getDb: async () => db });
  } catch (error) {
    return jsonErr(error.status || 401, error.code || 'invalid_api_key', error.message, error.usage);
  }

  const { id } = await params;
  const result = await db.execute({
    sql: 'SELECT * FROM cards WHERE id = ? AND user_id = ?',
    args: [id, auth.userId],
  });
  await markApiKeyUsed(db, auth.keyId);

  if (!result.rows.length) {
    return jsonErr(404, 'not_found', 'Card not found', { remaining: auth.remaining });
  }

  return jsonOk(result.rows[0], { remaining: auth.remaining });
}
