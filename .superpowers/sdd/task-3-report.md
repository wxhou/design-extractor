Status: implemented Task 3 IP rate limit for free extract.

Changes:
- Added `src/rate-limit.js` with `FREE_DAILY_LIMIT = 5`, UTC-day checks, IP extraction, and usage increment.
- Wired `app/api/extract/route.js` to return 429 `free_limit_exceeded` after five uses per IP per UTC day.
- Added `tests/unit/rate-limit.test.js` covering fifth allowed, sixth denied, UTC day, and IP header precedence.

Verification:
- `node --test "tests/unit/rate-limit.test.js"` passed.
- `node --test "tests/unit/rate-limit.test.js" "tests/unit/api-keys.test.js" "tests/unit/api-response.test.js" "tests/unit/credits.test.js" "tests/unit/schema-auth.test.js"` passed.
- `npm run build` exited 0; output included existing environment warnings for multiple lockfiles, `jsonrepair`, and missing local `sql-wasm.wasm`.
