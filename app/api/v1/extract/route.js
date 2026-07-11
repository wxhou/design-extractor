import { randomUUID } from 'crypto';
import { jsonErr, jsonOk } from '@/src/api-response.js';
import { getDb } from '@/src/db.js';
import { consumeCreditAtomically, getRemainingCredits } from '@/src/credits.js';
import { extractDesignTokens, isValidDomain, normalizeUrl } from '@/src/extractor-v2.js';
import { requireApiKey, ensureHasCredits } from '@/src/v1-auth.js';
import { findExistingCard, saveExtraction } from '@/src/save-extraction.js';

const ENDPOINT = '/api/v1/extract';

function extractionStatus(errorMessage) {
  return errorMessage?.includes('Timeout') || errorMessage?.includes('ERR_TIMED_OUT') ? 504 : 502;
}

function urlHost(normalized) {
  return normalized?.normalized || null;
}

async function markApiKeyUsed(db, keyId, now) {
  await db.execute({
    sql: 'UPDATE api_keys SET last_used_at = ? WHERE id = ?',
    args: [now, keyId],
  });
}

async function recordUsage(db, auth, normalized, status, credits, latencyMs, now) {
  await db.execute({
    sql: `INSERT INTO usage_events (id, user_id, key_id, endpoint, url_host, status, credits, latency_ms, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      auth.userId,
      auth.keyId,
      ENDPOINT,
      urlHost(normalized),
      status,
      credits,
      latencyMs,
      now,
    ],
  });
}

async function consumeCredit(db, auth, now, normalized, latencyMs) {
  return consumeCreditAtomically(db, {
    userId: auth.userId,
    keyId: auth.keyId,
    endpoint: ENDPOINT,
    urlHost: urlHost(normalized),
    status: 'success',
    credits: 1,
    latencyMs,
    now,
  });
}

export async function POST(request) {
  const started = Date.now();
  const db = await getDb();
  let auth;

  try {
    auth = await requireApiKey(request, { getDb: async () => db });
  } catch (error) {
    return jsonErr(error.status || 401, error.code || 'invalid_api_key', error.message, error.usage);
  }

  try {
    ensureHasCredits(auth);
  } catch (error) {
    await markApiKeyUsed(db, auth.keyId, new Date().toISOString());
    return jsonErr(error.status, error.code, error.message, error.usage);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    await markApiKeyUsed(db, auth.keyId, new Date().toISOString());
    return jsonErr(400, 'invalid_request', 'Request body must be valid JSON');
  }

  const { url } = body || {};
  if (!url || !isValidDomain(url)) {
    await markApiKeyUsed(db, auth.keyId, new Date().toISOString());
    return jsonErr(400, 'invalid_url', 'URL is required and must be a valid domain', { remaining: auth.remaining });
  }

  const normalized = normalizeUrl(url);
  if (!normalized.valid) {
    await markApiKeyUsed(db, auth.keyId, new Date().toISOString());
    return jsonErr(400, 'invalid_url', 'URL is required and must be a valid domain', { remaining: auth.remaining });
  }

  try {
    const existing = await findExistingCard(db, normalized.normalized);
    const data = existing
      ? {
          cardId: existing.id,
          isDuplicate: true,
          message: 'This site has already been extracted',
          siteName: existing.name,
        }
      : await (async () => {
          const result = await extractDesignTokens(normalized.full, {
            useAI: true,
            captureScreenshot: true,
          });

          if (!result.success) {
            throw new Error(result.error || 'Extraction failed');
          }

          return (await saveExtraction(db, normalized, result)).data;
        })();

    const now = new Date().toISOString();
    const latencyMs = Date.now() - started;
    const nextBalance = await consumeCredit(db, auth, now, normalized, latencyMs);
    return jsonOk(data, { remaining: getRemainingCredits(nextBalance) });
  } catch (error) {
    const now = new Date().toISOString();
    const latencyMs = Date.now() - started;
    if (error.status === 402 && error.code === 'insufficient_credits') {
      await markApiKeyUsed(db, auth.keyId, now);
      return jsonErr(error.status, error.code, error.message, error.usage);
    }
    await recordUsage(db, auth, normalized, 'error', 0, latencyMs, now);
    await markApiKeyUsed(db, auth.keyId, now);
    return jsonErr(extractionStatus(error.message), 'extraction_failed', error.message, { remaining: auth.remaining });
  }
}
