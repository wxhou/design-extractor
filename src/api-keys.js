import { createHash, randomBytes, randomUUID } from 'node:crypto';

const KEY_PREFIX = 'u2d_';
const KEY_BYTES = 32;
const KEY_PATTERN = /^u2d_[a-f0-9]{64}$/;

function pepper() {
  return process.env.API_KEY_PEPPER || '';
}

export function hashApiKey(plaintext) {
  return createHash('sha256')
    .update(pepper() + plaintext)
    .digest('hex');
}

export function generateApiKey() {
  const plaintext = KEY_PREFIX + randomBytes(KEY_BYTES).toString('hex');
  return {
    id: randomUUID(),
    plaintext,
    keyHash: hashApiKey(plaintext),
    keyPrefix: plaintext.slice(0, 12),
  };
}

export async function verifyAndLoadKey(db, bearerToken) {
  if (!bearerToken || !KEY_PATTERN.test(bearerToken)) {
    return null;
  }

  const keyHash = hashApiKey(bearerToken);
  const { rows } = await db.execute({
    sql: `SELECT id, user_id, key_hash, key_prefix, name, last_used_at, revoked_at, created_at
          FROM api_keys
          WHERE key_hash = ? AND revoked_at IS NULL
          LIMIT 1`,
    args: [keyHash],
  });

  if (!rows.length) {
    return null;
  }

  const key = rows[0];
  return { key, userId: key.user_id };
}
