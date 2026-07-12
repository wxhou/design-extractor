# Url2Design Paid API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有即时提取引擎产品化为 **Url2Design**：网页免费（IP 限流）+ Auth.js 登录 + API Key + Stripe 订阅 credit + `/api/v1/*` 付费提取。

**Architecture:** 保留 `POST /api/extract` 作为免费网页入口并加 IP 日限；新增 Auth.js 会话与 Dashboard；付费流量走 `Authorization: Bearer u2d_…` 的 `/api/v1/extract|cards|usage`；Turso 存 users / keys / subscriptions / credits / usage；Stripe Checkout + Webhook + Customer Portal 管理套餐。提取仍调用 `src/extractor-v2.js`，一期不加深提取。

**Tech Stack:** Next.js 16 App Router（现有）、Auth.js（`next-auth@5`）、Stripe、Turso/`@libsql/client`（现有 `src/db.js`）、Node `crypto`（API Key hash）、`node:test`（单元测试）

**Spec:** `docs/superpowers/specs/2026-07-11-paid-api-saas-design.md`

## Global Constraints

- 品牌对外：**Url2Design**；域名目标 `url2design.com`（人工注册，工程不阻塞）
- API Key 前缀：`u2d_`；只存 SHA-256 hash，明文仅创建时返回一次
- 扣费：仅 **成功** `extract` 扣 **1 credit**；我方超时/5xx 不扣
- 额度用尽：HTTP **402**，`error.code = "insufficient_credits"`
- 网页免费日限：默认 **5 次/IP/天**（常量 `FREE_DAILY_LIMIT = 5`）
- 套餐：Free 注册送 100；Starter $19/500；Pro $49/2000（Stripe Price ID 用环境变量）
- 一期不做：国内支付、MCP/CLI、提取质量增强、webhook 批量
- 不提交 `.env*` 密钥；不在文档中粘贴真实 token
- lint/type：项目为 JS；改完至少 `node --test` 相关测试通过

## File Map

| 文件 | 职责 |
|------|------|
| `src/schema-auth.sql` | users/api_keys/subscriptions/credit_balances/usage_events DDL |
| `scripts/migrate-auth-tables.mjs` | 对 Turso/本地执行 DDL |
| `src/api-keys.js` | 生成/校验/吊销 API Key |
| `src/credits.js` | 查余额、扣费、套餐配额 |
| `src/rate-limit.js` | 免费网页 IP 日限（Turso 表或内存+DB） |
| `src/api-response.js` | 统一 `{ success, data, error, usage }` |
| `auth.js`（根目录） | Auth.js 配置（GitHub/Google/Email） |
| `app/api/auth/[...nextauth]/route.js` | Auth 路由 |
| `app/api/v1/extract/route.js` | 付费提取 |
| `app/api/v1/cards/[id]/route.js` | 付费读卡 |
| `app/api/v1/usage/route.js` | 用量查询 |
| `app/api/stripe/checkout/route.js` | 创建 Checkout Session |
| `app/api/stripe/portal/route.js` | Customer Portal |
| `app/api/stripe/webhook/route.js` | 订阅生命周期 → credit_balances |
| `app/api/dashboard/keys/route.js` | 登录用户管理 Key |
| `app/dashboard/page.js` | Dashboard UI |
| `app/api/extract/route.js` | 加 IP 限流 + 转化文案字段 |
| `app/layout.js` / `app/page.js` | 品牌文案 Url2Design |
| `package.json` | 依赖 next-auth、stripe、nodemailer（magic link） |
| `tests/unit/*.test.js` | api-keys / credits / rate-limit / api-response |

---

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

### Task 2: api-keys + credits + api-response helpers

**Files:**
- Create: `src/api-keys.js`
- Create: `src/credits.js`
- Create: `src/api-response.js`
- Create: `tests/unit/api-keys.test.js`
- Create: `tests/unit/credits.test.js`

**Interfaces:**
- Produces:
  - `generateApiKey()` → `{ id, plaintext, keyHash, keyPrefix }` plaintext 形如 `u2d_` + 32 bytes hex
  - `hashApiKey(plaintext)` → hash string
  - `verifyAndLoadKey(db, bearerToken)` → `{ key, userId }` or null
  - `getRemainingCredits(balance)` → number
  - `assertCanConsume(balance)` → throws / returns
  - `computeConsume(balance)` → new balance fields after 1 credit（先扣 monthly 剩余，再扣 pack）
  - `jsonOk(data, usage)` / `jsonErr(status, code, message, usage?)`

- [ ] **Step 1: 写失败测试（api-keys）**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateApiKey, hashApiKey } from '../../src/api-keys.js';

test('generateApiKey uses u2d_ prefix and hashes stably', () => {
  const k = generateApiKey();
  assert.match(k.plaintext, /^u2d_[a-f0-9]{64}$/);
  assert.equal(hashApiKey(k.plaintext), k.keyHash);
  assert.notEqual(k.plaintext, k.keyHash);
});
```

- [ ] **Step 2: 实现 `src/api-keys.js`**（`crypto.randomBytes` + `sha256`；可选 `API_KEY_PEPPER` env）

- [ ] **Step 3: 写 credits 测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getRemainingCredits, computeConsume } from '../../src/credits.js';

test('consume prefers monthly quota then pack', () => {
  const b = { monthly_quota: 100, monthly_used: 99, pack_balance: 2 };
  assert.equal(getRemainingCredits(b), 3);
  const next = computeConsume(b);
  assert.equal(next.monthly_used, 100);
  assert.equal(next.pack_balance, 2);
  const next2 = computeConsume(next);
  assert.equal(next2.pack_balance, 1);
});

test('computeConsume throws when empty', () => {
  assert.throws(() => computeConsume({ monthly_quota: 10, monthly_used: 10, pack_balance: 0 }));
});
```

- [ ] **Step 4: 实现 credits + api-response**

- [ ] **Step 5: `node --test tests/unit/api-keys.test.js tests/unit/credits.test.js` → PASS**

- [ ] **Step 6: Commit**

```bash
git add src/api-keys.js src/credits.js src/api-response.js tests/unit/
git commit -m "$(cat <<'EOF'
feat: add API key hashing and credit helpers

EOF
)"
```

---

### Task 3: IP rate limit for free extract

**Files:**
- Create: `src/rate-limit.js`
- Create: `tests/unit/rate-limit.test.js`
- Modify: `app/api/extract/route.js`

**Interfaces:**
- Produces: `async function checkFreeIpLimit(db, ip, { limit = 5, day = UTCDate } = {})` → `{ allowed, remaining, limit }`；超限不增加 count
- Produces: `async function incrementFreeIpUsage(db, ip, day)` 仅在提取**开始且通过检查后**或**成功后**调用——本计划定为：**通过检查后、开始提取前** increment（防并发刷；可接受略严）

- [ ] **Step 1: 单测**（可用内存假 db：传入 `{ execute }` mock）

```js
test('fifth allowed sixth denied', async () => {
  const store = new Map();
  const db = {
    async execute({ sql, args }) {
      if (sql.includes('SELECT')) {
        const key = args[0] + '|' + args[1];
        return { rows: store.has(key) ? [{ count: store.get(key) }] : [] };
      }
      if (sql.includes('INSERT')) {
        const key = args[0] + '|' + args[1];
        store.set(key, (store.get(key) || 0) + 1);
        return { rows: [] };
      }
    },
  };
  // 实现后按真实 SQL 调整 mock
});
```

- [ ] **Step 2: 实现 `src/rate-limit.js`**，常量 `FREE_DAILY_LIMIT = 5`

- [ ] **Step 3: 修改 `app/api/extract/route.js`**
  - 从 `x-forwarded-for` 首段或 `request.headers.get('x-real-ip')` 取 IP，缺省 `unknown`
  - 超限返回 429：`{ success:false, error:{ code:'free_limit_exceeded', message:'今日免费额度已用完，请开通 API' }, upgradeUrl:'/dashboard' }`
  - 通过后 increment，再走现有提取逻辑

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: rate-limit free web extracts by IP

EOF
)"
```

---

### Task 4: Auth.js (next-auth v5) + user bootstrap credits

**Files:**
- Create: `auth.js`
- Create: `app/api/auth/[...nextauth]/route.js`
- Modify: `package.json`（`next-auth@5`、`nodemailer`、`@auth/drizzle-adapter` **或** 自写 Turso adapter 最小实现）
- Prefer: 轻量 **Turso adapter** 在 `src/auth-adapter.js` 实现 Auth.js Adapter 接口（避免再引 ORM）

**Interfaces:**
- Produces: `auth` / `handlers` / `signIn` / `signOut` from `auth.js`
- On first user create: insert `subscriptions(plan=free)` + `credit_balances(monthly_quota=100, monthly_used=0, pack_balance=0)`

- [ ] **Step 1: `npm install next-auth@5 nodemailer`**

- [ ] **Step 2: 实现 `src/auth-adapter.js`** 覆盖 createUser/getUser/getUserByEmail/getUserByAccount/linkAccount/createSession/getSessionAndUser/updateSession/deleteSession/createVerificationToken/useVerificationToken

- [ ] **Step 3: `auth.js`**

```js
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Nodemailer from 'next-auth/providers/nodemailer';
import { TursoAdapter } from './src/auth-adapter.js';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: TursoAdapter(),
  providers: [
    GitHub,
    Google,
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: { strategy: 'database' },
  pages: { signIn: '/dashboard' },
});
```

- [ ] **Step 4: `app/api/auth/[...nextauth]/route.js`** → `export const { GET, POST } = handlers`

- [ ] **Step 5: 文档化 `.env.example` 键名**（无真实值）：`AUTH_SECRET`、`AUTH_GITHUB_ID/SECRET`、`AUTH_GOOGLE_ID/SECRET`、`EMAIL_SERVER`、`EMAIL_FROM`、`AUTH_URL`

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add Auth.js with Turso adapter and free credit bootstrap

EOF
)"
```

---

### Task 5: Dashboard API keys CRUD

**Files:**
- Create: `app/api/dashboard/keys/route.js`
- Create: `app/dashboard/page.js`（client 组件可拆）
- Modify: `app/layout.js` 增加 Dashboard 入口链接（登录态可选）

**Interfaces:**
- `GET /api/dashboard/keys` → 列表（id, name, key_prefix, created_at, last_used_at；无 hash/明文）
- `POST /api/dashboard/keys` body `{ name? }` → `{ plaintext, key }` **仅此一次**
- `DELETE /api/dashboard/keys?id=` → 设置 `revoked_at`

- [ ] **Step 1: 实现 keys route**，用 `auth()` 取 session；未登录 401

- [ ] **Step 2: Dashboard 页**
  - 未登录：GitHub/Google/Email 登录按钮
  - 已登录：Key 列表、创建、吊销；展示 remaining credits（调 `/api/v1/usage` 或 dashboard usage 内联查询）
  - 简短 curl 示例：

```bash
curl -X POST https://url2design.com/api/v1/extract \
  -H "Authorization: Bearer u2d_..." \
  -H "Content-Type: application/json" \
  -d '{"url":"https://stripe.com"}'
```

- [ ] **Step 3: 手动验证本地** `npm run dev` 登录流程（若缺 OAuth，至少 Email provider 或临时 Credentials 仅 dev——**禁止**把 Credentials 留到生产；无 Email 时用 GitHub）

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add dashboard API key management UI

EOF
)"
```

---

### Task 6: `/api/v1/extract` + `/api/v1/cards/:id` + `/api/v1/usage`

**Files:**
- Create: `app/api/v1/extract/route.js`
- Create: `app/api/v1/cards/[id]/route.js`
- Create: `app/api/v1/usage/route.js`
- Create: `src/v1-auth.js`（`requireApiKey(request)`）

**Interfaces:**
- `requireApiKey(request)` → `{ userId, keyId, balance }` 或抛出带 status 的错误
- `POST /api/v1/extract` body `{ url }`：校验 URL → 查额度 → 调现有 `extractDesignTokens` + 写 cards（复用 `app/api/extract/route.js` 内保存逻辑，**抽** `src/save-extraction.js` 避免复制）
- 成功：扣 1 credit、写 `usage_events`、返回 `jsonOk` + `usage.remaining`
- 失败（提取失败）：`usage_events` credits=0，**不扣费**，502/504

- [ ] **Step 1: 抽取 `src/save-extraction.js`**  
  从 `app/api/extract/route.js` 移出：截图保存、INSERT cards、生成 tokensJson 等；两边共用。

- [ ] **Step 2: 实现 v1-auth + 三路由**

- [ ] **Step 3: 用无效 Key 请求 → 401；无额度 mock → 402；合法路径在有 Browserless/本地 chromium 时手工测一次**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add paid /api/v1 extract cards and usage endpoints

EOF
)"
```

---

### Task 7: Stripe Checkout, Portal, Webhook

**Files:**
- Create: `app/api/stripe/checkout/route.js`
- Create: `app/api/stripe/portal/route.js`
- Create: `app/api/stripe/webhook/route.js`
- Modify: `app/dashboard/page.js`（Upgrade 按钮）
- Modify: `.env.example`：`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_STARTER`、`STRIPE_PRICE_PRO`、`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`（若需）

**Interfaces:**
- Checkout：登录用户 → 确保 `stripe_customer_id` → Session mode=subscription，metadata.user_id
- Webhook 处理：`checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`
  - Starter：`monthly_quota=500`，reset `monthly_used=0`
  - Pro：`monthly_quota=2000`
  - deleted/cancel → 回到 free `monthly_quota=100`（不清 pack_balance）
- Portal：Billing Portal session URL

- [ ] **Step 1: `npm install stripe`**

- [ ] **Step 2: 实现三路由**；webhook 必须用 raw body（App Router：`const buf = await request.text()` + `stripe.webhooks.constructEvent`）

- [ ] **Step 3: Dashboard 加 Starter/Pro 按钮与「管理账单」

- [ ] **Step 4: 用 Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook` 测一次（文档写入 `docs/superpowers/plans` 旁注或 README 片段——**仅** `.env.example` + Dashboard 帮助文案，不另写长文档）

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: integrate Stripe subscriptions for API credits

EOF
)"
```

---

### Task 8: Branding Url2Design + conversion CTAs

**Files:**
- Modify: `app/layout.js` metadata title/description → Url2Design
- Modify: `app/page.js` hero 文案：URL → design；链到 `/dashboard`「API for agents」
- Modify: `app/style/[id]/page.js` 详情页加 API 转化条（短链）
- Modify: `cloudflare-proxy/worker.js` 仅当生产域名切换时改 Host（**本任务可先改注释/常量占位** `URL2DESIGN_HOST`，真正切域名人肉做）

- [ ] **Step 1: 替换用户可见 “Design Extractor” 为 “Url2Design”**（grep 后改 layout/page；CLI 描述可改 `package.json` description）

- [ ] **Step 2: 超限与详情 CTA 指向 `/dashboard`

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: rebrand UI copy to Url2Design and add API CTAs

EOF
)"
```

---

### Task 9: Wire migrate into ops + smoke checklist

**Files:**
- Modify: `package.json` scripts：`"migrate:auth": "node scripts/migrate-auth-tables.mjs"`
- Modify: `Dockerfile` / `docker-compose.yml` 注释说明需跑 migrate（若存在）

- [ ] **Step 1: 对 Turso 执行 migrate（需网络与用户批准）**

- [ ] **Step 2: 跑全量 `node --test tests/unit/*.test.js`**

- [ ] **Step 3: Smoke 清单（人工勾选，写入 PR 描述即可）**
  1. 未登录提取 ≤5 次/天，第 6 次 429
  2. 登录创建 Key，v1 extract 成功 remaining-1
  3. 额度清零后 402
  4. 提取失败不减 credit
  5. Stripe test mode 升级后 quota 变为 500/2000

- [ ] **Step 4: Commit 脚本与收尾**

```bash
git commit -m "$(cat <<'EOF'
chore: add migrate:auth script and finish Url2Design API MVP wiring

EOF
)"
```

---

## Spec coverage check

| Spec 项 | Task |
|---------|------|
| 网页免费 + IP 限流 | 3 |
| Auth.js | 4 |
| API Key Dashboard | 5 |
| `/api/v1/extract|cards|usage` | 6 |
| Stripe 订阅 credit | 7 |
| 成功才扣费 / 402 | 2+6 |
| Url2Design 品牌 | 8 |
| Schema | 1 |
| 域名注册 | 人工（非代码） |
| 提取加深 / 国内支付 / MCP | 明确不做 |

## Open decisions locked for implementers

- 额度用尽：**402**
- Free 赠额：**100**（注册时写入）；防刷依赖 OAuth/Email，一期不加额外验证码
- 加购 pack：Webhook/Checkout 可二期；表字段 `pack_balance` 先留着
- Key 前缀：**u2d_**
