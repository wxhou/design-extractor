import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonOk, jsonErr } from '../../src/api-response.js';

test('jsonOk returns success envelope with data and usage', async () => {
  const res = jsonOk({ id: '1' }, { remaining: 99 });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { success: true, data: { id: '1' }, usage: { remaining: 99 } });
});

test('jsonErr returns error envelope with optional usage', async () => {
  const res = jsonErr(402, 'insufficient_credits', 'No credits left', { remaining: 0 });
  assert.equal(res.status, 402);
  const body = await res.json();
  assert.deepEqual(body, {
    success: false,
    error: { code: 'insufficient_credits', message: 'No credits left' },
    usage: { remaining: 0 },
  });
});
