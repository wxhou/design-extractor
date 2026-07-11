### Task 4 Report: Auth.js + User Bootstrap Credits

Status: completed.

Implemented:
- Installed Auth.js v5 via `next-auth@beta` (`5.0.0-beta.31`) and `nodemailer`.
- Added `src/auth-adapter.js` with a lightweight Turso-compatible Auth.js adapter.
- Added root `auth.js` exporting `handlers`, `auth`, `signIn`, and `signOut`.
- Added `app/api/auth/[...nextauth]/route.js`.
- Added `.env.example` with Auth.js/OAuth/email keys and no secrets.
- Added `tests/unit/auth-adapter.test.js` for `createUser` free plan bootstrap.

Validation:
- `node --test tests/unit/*.test.js` passed: 13/13.
- `npm run build` passed.

Notes:
- `npm install next-auth@5` is not a published npm tag; npm reports v5 under the `beta` dist-tag.
- Nodemailer provider is enabled only when `EMAIL_SERVER` and `EMAIL_FROM` are set, so secretless builds do not fail.
- `npm run build` emits the existing Next.js multiple-lockfile workspace-root warning.

### Task 4 Review Fixes

Implemented:
- Changed `createUser` bootstrap writes to one write batch so `users`, `subscriptions`, and `credit_balances` succeed or fail atomically while preserving `FREE_MONTHLY_QUOTA=100`.
- Added a minimal `getDb().batch()` wrapper: Turso delegates to `client.batch(..., 'write')`; local `sql.js` uses `BEGIN`/`COMMIT`/`ROLLBACK` and writes the database file only after commit.
- Changed `useVerificationToken` to consume tokens with one atomic `DELETE ... RETURNING *` statement.
- Added unit coverage for create-user batch failure behavior and atomic verification-token consumption.

Validation:
- `node --test tests/unit/auth-adapter.test.js` passed: 4/4.
- `node --test tests/unit/*.test.js` passed: 16/16.
- `npm run build` passed. Existing Next.js multiple-lockfile workspace-root warning still appears.
