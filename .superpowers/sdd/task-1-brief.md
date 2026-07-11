### Task 1: Schema + migrate script

**Files:**
- Create: `src/schema-auth.sql`
- Create: `scripts/migrate-auth-tables.mjs`
- Test: `tests/unit/schema-auth.test.js`（断言 SQL 含必要表名）

**Interfaces:**
- Produces: Turso/本地可执行的 DDL；表名固定为下方列表

- [ ] **Step 1: 写 DDL**

`src/schema-auth.sql` 内容：

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  email_verified TEXT,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'default',
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  period_end TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_balances (
  user_id TEXT PRIMARY KEY,
  monthly_quota INTEGER NOT NULL DEFAULT 100,
  monthly_used INTEGER NOT NULL DEFAULT 0,
  pack_balance INTEGER NOT NULL DEFAULT 0,
  period_start TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_id TEXT,
  endpoint TEXT NOT NULL,
  url_host TEXT,
  status TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS free_ip_usage (
  ip TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, day)
);
```

- [ ] **Step 2: 写 migrate 脚本**

`scripts/migrate-auth-tables.mjs`：读 `TURSO_URL`/`TURSO_AUTH_TOKEN`（与 `src/db.js` 相同 https 转换），按 `;` 拆分执行；无 Turso 时打印提示并 exit 1（本地可用 turso CLI 或临时连远程）。

- [ ] **Step 3: 单元测试表名存在**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('schema-auth.sql defines required tables', () => {
  const sql = fs.readFileSync(new URL('../../src/schema-auth.sql', import.meta.url), 'utf8');
  for (const t of ['users', 'api_keys', 'subscriptions', 'credit_balances', 'usage_events', 'free_ip_usage']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
  }
});
```

- [ ] **Step 4: 运行测试**

Run: `node --test tests/unit/schema-auth.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/schema-auth.sql scripts/migrate-auth-tables.mjs tests/unit/schema-auth.test.js
git commit -m "$(cat <<'EOF'
feat: add auth and billing schema for Url2Design API

EOF
)"
```

---

