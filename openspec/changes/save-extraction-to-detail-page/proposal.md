## Why

用户在界面上输入网址提取设计 tokens 后，只能看到纯文本的 Markdown 代码块，无法像其他已有卡片那样跳转到精美的详情页。这导致用户体验割裂，提取结果也无法持久化保存和复用。

## What Changes

1. **提取结果保存到数据库** — 将 extractor-v2 的提取结果（colors, fonts, northStar 等）完整写入 `refero.db` 的 `cards` 表
2. **生成网站截图** — 利用 Playwright 截图功能，生成预览图存储到数据库
3. **推断分类和主题** — 根据颜色分布推断 `category`（minimal/saas/editorial 等）和 `color_scheme`（light/dark）
4. **提取完成后跳转详情页** — 修改前端逻辑，提取成功后 `router.push(/style/${id})` 跳转到详情页
5. **返回结果包含 card ID** — API 返回新创建的 card ID，前端据此跳转

## Capabilities

### New Capabilities

- `extraction-save`: 将提取结果保存到数据库并返回 card ID 的能力
- `extraction-screenshot`: 在提取过程中截图并存入数据库的能力
- `category-inference`: 根据颜色分布推断设计分类和主题的能力

### Modified Capabilities

- （无）

## Impact

- **前端**: `app/page.js` — 提取表单提交后跳转逻辑
- **API**: `app/api/extract/route.js` — 新增数据库写入和截图逻辑
- **Core**: `src/extractor-v2.js` — 新增截图生成、分类推断
- **数据库**: 依赖现有 `refero.db` 的 `cards` 表结构
