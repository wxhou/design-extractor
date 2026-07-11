### Task 6 Report

Implemented paid v1 API endpoints:
- `POST /api/v1/extract`
- `GET /api/v1/cards/:id`
- `GET /api/v1/usage`

Created shared extraction persistence in `src/save-extraction.js` and updated the free `/api/extract` route to reuse it.

Credit behavior:
- Invalid or missing Bearer token returns 401.
- Empty credit balance returns 402 with `error.code = insufficient_credits`.
- Successful extraction deducts 1 credit, writes `usage_events.credits = 1`, and returns `usage.remaining`.
- Extraction failure writes `usage_events.credits = 0`, does not deduct credits, and returns 502/504.
- Valid API key usage updates `api_keys.last_used_at`.

Verification:
- `node --test tests/unit/*.test.js` passed.
- `npm run build` passed.

Notes:
- Browserless/local chromium manual success-path test was not run in this environment.
- Context7 docs lookup was unavailable because the monthly quota was exceeded.
