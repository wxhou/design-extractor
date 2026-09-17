import test from 'node:test';
import assert from 'node:assert/strict';
import { generateApiKey, hashApiKey, verifyAndLoadKey } from '../../src/api-keys.js';

test('generateApiKey uses u2d_ prefix and hashes stably', () => {
  const k = generateApiKey();
  assert.match(k.plaintext, /^u2d_[a-f0-9]{64}$/);
  assert.equal(hashApiKey(k.plaintext), k.keyHash);
  assert.notEqual(k.plaintext, k.keyHash);
});

test('verifyAndLoadKey returns key and userId for valid token', async () => {
  const k = generateApiKey();
  const row = {
    id: k.id,
    user_id: 'user-1',
    key_hash: k.keyHash,
    key_prefix: k.keyPrefix,
    revoked_at: null,
  };
  const db = {
    async execute({ sql, args }) {
      assert.match(sql, /key_hash/i);
      assert.equal(args[0], k.keyHash);
      return { rows: [row] };
    },
  };
  const result = await verifyAndLoadKey(db, k.plaintext);
  assert.deepEqual(result, { key: row, userId: 'user-1' });
});

test('verifyAndLoadKey returns null for invalid or revoked key', async () => {
  assert.equal(await verifyAndLoadKey({ async execute() { return { rows: [] }; } }, 'bad'), null);
  assert.equal(await verifyAndLoadKey({ async execute() { return { rows: [] }; } }, 'u2d_' + 'a'.repeat(64)), null);
});
