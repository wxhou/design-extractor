// E2E tests for fix-security-and-stability
// Verifies: UUID validation, rate limiting, path traversal protection, safe parsing

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ─── Path Traversal Protection ──────────────────────────────────────────────

test.describe('Screenshot endpoint: path traversal protection', () => {
  test('rejects path traversal attempt', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/..%2F..%2Fetc%2Fpasswd.png`);
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID');
  });

  test('rejects non-UUID input', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/abc123`);
    expect(response.status()).toBe(400);
  });

  test('accepts valid UUID format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/550e8400-e29b-41d4-a716-446655440000.png`);
    // 200 (exists) or 404 (not found) are both valid — 400 means rejected
    expect([200, 404]).toContain(response.status());
  });
});

// ─── Card ID Validation ────────────────────────────────────────────────────

test.describe('Card routes: UUID validation', () => {
  test('card detail rejects invalid ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/card/not-a-uuid`);
    expect(response.status()).toBe(400);
  });

  test('card theme rejects invalid ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/card/xxx/theme`);
    expect(response.status()).toBe(400);
  });

  test('card variables rejects invalid ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/card/xxx/variables`);
    expect(response.status()).toBe(400);
  });

  test('card tokens rejects invalid ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/card/xxx/tokens`);
    expect(response.status()).toBe(400);
  });

  test('card style-dictionary rejects invalid ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/card/xxx/style-dictionary`);
    expect(response.status()).toBe(400);
  });
});

// ─── Rate Limiting on Extraction ───────────────────────────────────────────

test.describe('Extraction endpoint: rate limiting', () => {
  test('returns 429 after 5 requests within 60s', async ({ request }) => {
    // Make 6 rapid requests; the 6th should be rate-limited
    const responses = [];
    for (let i = 0; i < 6; i++) {
      const response = await request.post(`${BASE_URL}/api/extract`, {
        data: { url: 'https://example.com' },
      });
      responses.push(response.status());
    }
    // Last response should be 429 (rate limited)
    expect(responses[5]).toBe(429);
  });

  test('includes Retry-After header on 429', async ({ request }) => {
    // Consume 5 tokens first
    for (let i = 0; i < 5; i++) {
      await request.post(`${BASE_URL}/api/extract`, { data: { url: 'https://example.com' } });
    }
    // 6th request should include Retry-After
    const response = await request.post(`${BASE_URL}/api/extract`, {
      data: { url: 'https://example.com' },
    });
    if (response.status() === 429) {
      expect(response.headers()['retry-after']).toBeDefined();
    }
  });
});

// ─── Card List Functionality ────────────────────────────────────────────────

test.describe('Card list: regression', () => {
  test('list endpoint returns cards', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/cards?limit=3`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.cards.length).toBeGreaterThan(0);
  });

  test('category filter returns matching cards', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/cards?category=saas&limit=3`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.total).toBeGreaterThan(0);
  });
});