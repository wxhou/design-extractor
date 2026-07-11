import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('schema-auth.sql defines required tables', () => {
  const sql = fs.readFileSync(new URL('../../src/schema-auth.sql', import.meta.url), 'utf8');
  for (const t of ['users', 'api_keys', 'subscriptions', 'credit_balances', 'usage_events', 'free_ip_usage']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
  }
});
