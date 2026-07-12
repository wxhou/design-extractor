# Url2Design — 付费 API SaaS 设计

**日期**: 2026-07-11  
**状态**: 已定稿（品牌 Url2Design；实现计划已出）  
**方案**: 方案 1（精简自建：Auth.js + Turso + Stripe）  
**品牌**: **Url2Design**（域名目标：`url2design.com`；原仓库名 design-extractor，对外不再使用）

---

## 1. 产品决策摘要

| 决策 | 选择 |
|------|------|
| 品牌 | **Url2Design**（`url2design.com`，RDAP 显示可注册） |
| 定位 | **即时提取引擎**：任意 URL → design tokens / DESIGN.md（不是品牌合集目录） |
| 形态 | Web SaaS + 付费 API（不做桌面端/插件一期） |
| 用户 | 先服务独立开发者 / AI 写前端；兼顾设计师 |
| 变现 | **网页免费，API 收费** |
| MVP | 产品化现有提取能力（不先加深提取） |
| 市场 | 海外 Stripe 先；国内微信/支付宝二期 |
| 实现 | 现有 Next.js + Turso 上叠加 Auth / Key / 计费 |

**一句话**：Url2Design — 从任意 URL 即时生成 design tokens；网页试用，API 接入 agent / CI。

**主路径**：粘贴 URL / 调用 API → 即时提取。样式库只是提取结果沉淀，**不做 getdesign 式「先逛目录再下载」主产品**。

**否决品牌**：GetDesign.md（已被占用）、Tokenforge（.com/.io/.ai 及同赛道 uitokenforge 均已占用）。

---

## 2. 竞争定位

### 2.1 竞品地图

**[design-extractor.com](https://www.design-extractor.com/)**（直接竞品 · 同为即时提取）

- 同叙事：URL → DESIGN.md，面向 AI coding agents
- 同导出：DESIGN.md / Tailwind v4 / CSS Variables / DTCG
- **网页条款写明免费**；无公开 `/pricing`、无公开 API
- DESIGN.md 宣传更完整：Layout、Components、Do's and Don'ts
- Featured 画廊 + waitlist（准确性大更新预告）

**[getdesign.md](https://getdesign.md/)**（相邻品类 · **不是同一玩法**）

- 核心是 **DESIGN.md 品牌合集 / 目录**（`npx getdesign add …`）
- 付费偏「私人定制一份 DESIGN.md / Pass」
- **GetDesign.md 名称与域名已被占用，我方不可用**
- 我方差异：任意站**即时提取引擎 + 可计量 API**，不是又做一个合集站

**易混淆扩展**

- Chrome 扩展 [getwebdesign.top](https://getwebdesign.top/)：另一家；自带 Key 免费 / Pro·Max 订阅

### 2.2 差异化（锁定）

| 相对谁 | Url2Design 差异 |
|--------|-----------------|
| vs getdesign.md | 即时提取任意 URL，而非目录下载；API 给 agent/CI |
| vs design-extractor.com | **公开付费 API**；直白品牌（URL → design）；国内反代可达 |
| 名字 | Url2Design = 从 URL 得到 design；避开 Extractor / GetDesign / Tokenforge 红海 |

网页免费仍是入场券。楔子是 **API**；中期护城河是 **提取质量**（Layout / Components / rationale）。

### 2.3 竞争策略（写入一期）

- 官网/文案主打：**URL → design · Instant extract · API for agents**
- 网页：免费获客 + IP 限流 + 导向 API（不把「合集浏览」做成第一屏主 CTA）
- API：稳定、可计量、文档清晰
- 一期交付：**简短 API 文档 + curl 示例**；预留 MCP/CLI 二期接口形状
- 二期优先：
  1. DESIGN.md 完整度对齐 design-extractor.com（Layout / Components / Do's & Don'ts）
  2. MCP / CLI
  3. 国内支付
  4. 插件 / 桌面端

---

## 3. 整体架构

```
┌─────────────┐     免费      ┌──────────────────┐
│  网页 UI    │──────────────▶│ /api/extract     │──▶ extractor-v2
│ (无需登录)  │   IP 限流     │ (现有，保留)     │         │
└─────────────┘               └──────────────────┘         │
                                                           ▼
┌─────────────┐     Bearer    ┌──────────────────┐      Turso
│ 开发者/Agent│──────────────▶│ /api/v1/extract  │──▶ 存卡片+用量
│ + API Key   │               │ 校验 Key + 扣费  │
└─────────────┘               └────────┬─────────┘
                                       │
┌─────────────┐   GitHub/Google/Email  │
│ /dashboard  │◀── Auth.js ────────────┤
│ Key·用量·账单│                        │
└──────┬──────┘                        ▼
       └──────── Stripe Checkout / Customer Portal
                 (海外先；国内支付二期)
```

**原则**

- 网页路径保留，继续免费获客
- 付费只走 `/api/v1/*` + Dashboard
- 提取引擎复用 `src/extractor-v2.js`，一期不重写
- 部署仍为 Vercel + Cloudflare 国内反代

---

## 4. 免费网页边界

**保持免费**

- 输入网址 → 提取 → 详情 → 复制/下载现有导出格式
- 浏览公开样式库
- 不强制登录

**防滥用**

- 按 IP 限流：默认 **每天 5 次**提取（可配置）
- 保留 URL 校验 + 同站去重
- 超限文案引导开通 API（相对竞品的差异化入口）

**网页不做**

- 不发 API Key、不保证 SLA、不做批量/webhook/程序化调用

**转化**

- 详情页与超限页：「用 API 接入 agent / CI」→ Dashboard

---

## 5. API 与计费

### 5.1 认证

- Auth.js：GitHub / Google / Email magic link
- Dashboard：创建 / 轮换 / 删除 API Key（明文仅创建时展示一次）
- 请求头：`Authorization: Bearer u2d_xxxx`

### 5.2 付费 API（一期）

| 接口 | 作用 |
|------|------|
| `POST /api/v1/extract` | 提交 URL，返回 tokens + 元数据（可含 `cardId`） |
| `GET /api/v1/cards/:id` | 取已提取结果 / 导出字段 |
| `GET /api/v1/usage` | 本周期用量 |

网页 `/api/extract` 继续免 Key；`/api/v1/*` 必须带 Key。

### 5.3 定价（对标调研 + 竞品空白）

参考：Firecrawl / ScreenshotOne / code.to.design；竞品网页免费且无 API。

| 档位 | 价格与额度 |
|------|------------|
| 网页 | 免费，IP 日限 |
| API Free | 注册送 **100 credits**（试接入） |
| Starter | **$19/月 · 500 extracts**（约 $0.038/次） |
| Pro | **$49/月 · 2,000 extracts** |
| 加购包 | credit pack（具体包价实现时定） |
| 扣费规则 | **仅成功 extract 扣 1 credit**；失败（我方超时/5xx）不扣 |

年付可选 8 折。国内支付二期。

### 5.4 竞品定价对照（扩展参考）

| 产品 | 模式 | 锚点 |
|------|------|------|
| design-extractor.com | 网页免费 | 无 API 价 |
| code.to.design API | credit 包 | ~$0.03–0.08/次 |
| Firecrawl | 订阅 credit | Hobby $19/5k |
| ScreenshotOne | 订阅 + 超额 | $17/2k 起 |
| CSS Scan | 买断扩展 | $59–120 |

我们单次高于纯截图 API 合理（浏览器渲染 + tokens/AI）。

---

## 6. 数据模型与错误处理

### 6.1 新增表（Turso）

| 表 | 用途 |
|----|------|
| `users` | id, email, name, provider, stripe_customer_id, created_at |
| `api_keys` | id, user_id, key_hash, key_prefix, name, last_used_at, revoked_at |
| `subscriptions` | user_id, stripe_sub_id, plan(`free`/`starter`/`pro`), status, period_end |
| `credit_balances` | user_id, monthly_quota, monthly_used, pack_balance |
| `usage_events` | id, user_id, key_id, endpoint, url_host, status, credits, latency_ms, created_at |

- API Key 只存 hash；明文仅创建时展示一次
- 现有 `cards` 表继续使用

### 6.2 API 错误约定

| HTTP | 含义 |
|------|------|
| 401 | 无 Key / Key 无效 |
| 402 或 403 | 额度用尽 |
| 429 | 限流 |
| 400 | URL 非法 |
| 502 / 504 | 目标站不可达 / 超时（**不扣费**） |

统一响应：

```json
{
  "success": true,
  "data": {},
  "error": { "code": "...", "message": "..." },
  "usage": { "remaining": 123 }
}
```

（`error` 仅在失败时出现。）

---

## 7. Dashboard 与范围

### 7.1 Dashboard（需登录）

- API Key 管理
- 用量：本月已用 / 剩余 / 最近调用
- Stripe Checkout + Customer Portal
- 简短 API 文档（curl + 响应字段）— **作为相对竞品的程序化入口**

### 7.2 一期要做

- Auth.js（GitHub / Google / Email）
- `/api/v1/extract`、`/api/v1/cards/:id`、`/api/v1/usage`
- 网页 IP 限流 + API 转化引导
- Stripe 订阅 + credit 记账
- 复用 `extractor-v2`（不增强提取深度）
- 对外品牌与文案：**Url2Design** · URL → design · Paid API for agents
- 工程仓库可暂留 `design-extractor`；用户可见字符串逐步改为 Url2Design
- 域名：注册并指向现有 Vercel / Cloudflare 反代（`url2design.com`）

### 7.3 一期不做 / 二期顺序

1. DESIGN.md 质量对齐 design-extractor.com（Layout / Components / Do's & Don'ts）
2. MCP / CLI
3. 国内微信/支付宝
4. 批量提取、webhook、团队席位
5. 桌面端 / 浏览器插件
6. SLA / 企业合同
7. 全站品牌替换收尾与旧域名跳转

---

## 8. 成功标准（一期）

- 未登录用户可免费提取（受 IP 日限）
- 登录用户可创建 Key，用 Bearer 调用 `/api/v1/extract` 成功扣 1 credit
- 额度用尽返回明确错误与升级路径
- Stripe 可完成订阅与 Customer Portal 管理
- 失败提取不扣 credit
- Dashboard 能看到用量与最近调用

---

## 9. 风险与开放问题

| 风险 | 缓解 |
|------|------|
| 竞品免费网页分流 | 用 API/agent 工作流差异化；中期追质量 |
| 品牌迁移 | 对外用 Url2Design（url2design.com）；仓库/旧域名可渐进替换 |
| 浏览器/AI 成本 | 严格限流 + 成功才扣费 + 套餐上限 |
| 国内支付缺失 | 二期；反代保证国内能用免费网页 |

**开放问题（实现前可再定）**

- 额度用尽用 `402` 还是 `403`
- Free 注册送 100 credits 是否需邮箱验证防刷
- 加购 pack 具体档位数字

---

## 10. 变更记录

- 2026-07-11：初稿（方案 1 + 定价调研）
- 2026-07-11：并入竞品 design-extractor.com 分析；调整二期优先级与差异化叙事
- 2026-07-11：否决 GetDesign.md（已被占用）；暂定 Tokenforge；定位锁定为即时提取引擎
- 2026-07-11：否决 Tokenforge（域名与同赛道品牌冲突）；品牌定为 **Url2Design**（`url2design.com` 可注册）
