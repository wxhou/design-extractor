import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDashboardApiKey,
  getDashboardCredits,
  listDashboardApiKeys,
  revokeDashboardApiKey,
} from '../../src/dashboard-keys.js';

test('listDashboardApiKeys returns active keys without hash or plaintext', async () => {
  const db = {
    async execute({ sql, args }) {
      assert.match(sql, /FROM api_keys/i);
      assert.match(sql, /revoked_at IS NULL/i);
      assert.equal(args[0], 'user-1');
      return {
        rows: [{
          id: 'key-1',
          name: 'Production',
          key_prefix: 'u2d_abcdef12',
          created_at: '2026-07-11T00:00:00.000Z',
          last_used_at: null,
          key_hash: 'secret-hash',
        }],
      };
    },
  };

  const keys = await listDashboardApiKeys(db, 'user-1');

  assert.deepEqual(keys, [{
    id: 'key-1',
    name: 'Production',
    key_prefix: 'u2d_abcdef12',
    created_at: '2026-07-11T00:00:00.000Z',
    last_used_at: null,
  }]);
});

test('createDashboardApiKey stores only hash and returns plaintext once', async () => {
  const calls = [];
  const generated = {
    id: 'key-2',
    plaintext: 'u2d_' + 'a'.repeat(64),
    keyHash: 'hash-2',
    keyPrefix: 'u2d_aaaaaaaa',
  };
  const db = {
    async execute(query) {
      calls.push(query);
      return { rows: [] };
    },
  };

  const result = await createDashboardApiKey(db, 'user-1', {
    name: '  Production  ',
    now: '2026-07-11T00:00:00.000Z',
    generateKey: () => generated,
  });

  assert.equal(result.plaintext, generated.plaintext);
  assert.deepEqual(result.key, {
    id: 'key-2',
    name: 'Production',
    key_prefix: 'u2d_aaaaaaaa',
    created_at: '2026-07-11T00:00:00.000Z',
    last_used_at: null,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO api_keys/i);
  assert.deepEqual(calls[0].args, [
    'key-2',
    'user-1',
    'hash-2',
    'u2d_aaaaaaaa',
    'Production',
    '2026-07-11T00:00:00.000Z',
  ]);
  assert.equal(calls[0].args.includes(generated.plaintext), false);
});

test('revokeDashboardApiKey only revokes keys owned by the user', async () => {
  const db = {
    async execute({ sql, args }) {
      assert.match(sql, /UPDATE api_keys/i);
      assert.match(sql, /user_id = \?/i);
      assert.deepEqual(args, ['2026-07-11T00:00:00.000Z', 'key-3', 'user-1']);
      return {
        rows: [{
          id: 'key-3',
          name: 'Old key',
          key_prefix: 'u2d_oldkey12',
          created_at: '2026-07-10T00:00:00.000Z',
          last_used_at: null,
        }],
      };
    },
  };

  const key = await revokeDashboardApiKey(db, 'user-1', 'key-3', {
    now: '2026-07-11T00:00:00.000Z',
  });

  assert.equal(key.id, 'key-3');
});

test('revokeDashboardApiKey returns null for missing keys', async () => {
  const db = {
    async execute() {
      return { rows: [] };
    },
  };

  assert.equal(await revokeDashboardApiKey(db, 'user-1', 'missing'), null);
});

test('getDashboardCredits calculates remaining credits from balance row', async () => {
  const db = {
    async execute({ sql, args }) {
      assert.match(sql, /FROM credit_balances/i);
      assert.deepEqual(args, ['user-1']);
      return {
        rows: [{
          monthly_quota: 100,
          monthly_used: 40,
          pack_balance: 5,
        }],
      };
    },
  };

  assert.equal(await getDashboardCredits(db, 'user-1'), 65);
});
