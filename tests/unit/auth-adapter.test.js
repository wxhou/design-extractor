import test from 'node:test';
import assert from 'node:assert/strict';
import { TursoAdapter } from '../../src/auth-adapter.js';

test('createUser bootstraps free subscription and credits', async () => {
  const calls = [];
  const db = {
    async batch(statements, mode) {
      calls.push({ statements, mode });
      return statements.map(() => ({ rows: [] }));
    },
    async execute(query) {
      calls.push(query);
      return { rows: [] };
    },
  };
  const adapter = TursoAdapter({ db });
  const emailVerified = new Date('2026-07-11T00:00:00.000Z');

  const user = await adapter.createUser({
    email: 'new@example.com',
    name: 'New User',
    image: 'https://example.com/avatar.png',
    emailVerified,
  });

  assert.equal(user.email, 'new@example.com');
  assert.equal(user.name, 'New User');
  assert.equal(user.image, 'https://example.com/avatar.png');
  assert.equal(user.emailVerified, emailVerified);
  assert.match(user.id, /^[0-9a-f-]{36}$/);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'write');
  assert.equal(calls[0].statements.length, 3);
  assert.match(calls[0].statements[0].sql, /INSERT INTO users/i);
  assert.deepEqual(calls[0].statements[0].args, [
    user.id,
    'new@example.com',
    'New User',
    'https://example.com/avatar.png',
    emailVerified.toISOString(),
    calls[0].statements[0].args[5],
  ]);

  assert.match(calls[0].statements[1].sql, /INSERT INTO subscriptions/i);
  assert.equal(calls[0].statements[1].args[0], user.id);
  assert.equal(calls[0].statements[1].args[1], 'free');
  assert.equal(calls[0].statements[1].args[2], 'active');

  assert.match(calls[0].statements[2].sql, /INSERT INTO credit_balances/i);
  assert.deepEqual(calls[0].statements[2].args.slice(0, 4), [user.id, 100, 0, 0]);
});

test('createUser uses one write batch so bootstrap failures roll back atomically', async () => {
  const calls = [];
  const db = {
    async batch(statements, mode) {
      calls.push({ statements, mode });
      throw new Error('credit insert failed');
    },
    async execute(query) {
      calls.push(query);
      return { rows: [] };
    },
  };
  const adapter = TursoAdapter({ db });

  await assert.rejects(
    adapter.createUser({ email: 'rollback@example.com' }),
    /credit insert failed/,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'write');
  assert.equal(calls[0].statements.length, 3);
});

test('useVerificationToken atomically deletes and returns token', async () => {
  const expires = new Date('2026-07-11T00:00:00.000Z');
  const calls = [];
  const db = {
    async execute(query) {
      calls.push(query);
      return {
        rows: [{
          identifier: 'user@example.com',
          token: 'token-1',
          expires: expires.toISOString(),
        }],
      };
    },
  };
  const adapter = TursoAdapter({ db });

  const token = await adapter.useVerificationToken({
    identifier: 'user@example.com',
    token: 'token-1',
  });

  assert.deepEqual(token, {
    identifier: 'user@example.com',
    token: 'token-1',
    expires,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /DELETE FROM verification_tokens/i);
  assert.match(calls[0].sql, /RETURNING \*/i);
  assert.deepEqual(calls[0].args, ['user@example.com', 'token-1']);
});

test('useVerificationToken returns null when no token is consumed', async () => {
  const calls = [];
  const db = {
    async execute(query) {
      calls.push(query);
      return { rows: [] };
    },
  };
  const adapter = TursoAdapter({ db });

  const token = await adapter.useVerificationToken({
    identifier: 'missing@example.com',
    token: 'missing-token',
  });

  assert.equal(token, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /DELETE FROM verification_tokens/i);
  assert.match(calls[0].sql, /RETURNING \*/i);
});
