import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_DAILY_LIMIT,
  checkFreeIpLimit,
  getFreeExtractIp,
  incrementFreeIpUsage,
} from '../../src/rate-limit.js';

function createUsageDb() {
  const store = new Map();

  return {
    store,
    db: {
      async execute({ sql, args }) {
        if (/SELECT/i.test(sql)) {
          const key = `${args[0]}|${args[1]}`;
          return { rows: store.has(key) ? [{ count: store.get(key) }] : [] };
        }

        if (/INSERT/i.test(sql)) {
          const key = `${args[0]}|${args[1]}`;
          store.set(key, (store.get(key) || 0) + 1);
          return { rows: [] };
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
  };
}

test('checkFreeIpLimit allows five daily uses and denies the sixth without incrementing', async () => {
  const { db, store } = createUsageDb();
  const ip = '203.0.113.10';
  const day = '2026-07-11';

  for (let i = 0; i < FREE_DAILY_LIMIT; i += 1) {
    const result = await checkFreeIpLimit(db, ip, { day });
    assert.deepEqual(result, {
      allowed: true,
      remaining: FREE_DAILY_LIMIT - i,
      limit: FREE_DAILY_LIMIT,
    });
    await incrementFreeIpUsage(db, ip, day);
  }

  const denied = await checkFreeIpLimit(db, ip, { day });
  assert.deepEqual(denied, { allowed: false, remaining: 0, limit: FREE_DAILY_LIMIT });
  assert.equal(store.get(`${ip}|${day}`), FREE_DAILY_LIMIT);
});

test('checkFreeIpLimit uses UTC day by default', async () => {
  let selectedDay;
  const db = {
    async execute({ args }) {
      selectedDay = args[1];
      return { rows: [] };
    },
  };

  await checkFreeIpLimit(db, '198.51.100.20');
  assert.match(selectedDay, /^\d{4}-\d{2}-\d{2}$/);
});

test('getFreeExtractIp reads forwarded first hop, real ip, or unknown', () => {
  assert.equal(
    getFreeExtractIp(new Headers({ 'x-forwarded-for': '203.0.113.10, 198.51.100.20' })),
    '203.0.113.10',
  );
  assert.equal(getFreeExtractIp(new Headers({ 'x-real-ip': '198.51.100.20' })), '198.51.100.20');
  assert.equal(getFreeExtractIp(new Headers()), 'unknown');
});
