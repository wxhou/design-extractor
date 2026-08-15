# fix-screenshot-storage-blob

## Why

本系统新提取的卡片把整张 1440px PNG 截图以 base64 data URI 直接存进 Turso 的 `preview`/`screenshot` 两列（`src/smms.js` 的 `saveImageAsBase64` 策略）。现状实测：4 张 base64 卡让列表 API 从 ~15KB/页 膨胀到 731KB/页（3.7s），详情 API 达 1.68MB；`saveScreenshot` 的本地文件 fallback 在 Vercel serverless 上是死路径。数据库存字节而非引用，违背「DB 存引用、blob 存字节」的正交结构，且随每次新提取线性恶化。

## What Changes

- **截图上传 Vercel Blob**：新增 `@vercel/blob` 依赖，提取截图先转 JPEG（质量 ~80）再 `put()` 上传，数据库只存返回的 blob URL
- **删除 base64 直存路径**：移除 `src/smms.js` 的 `saveImageAsBase64`/`uploadToSMMS` 及 `src/save-extraction.js` 中本地文件 fallback（`public/screenshots/`、`/api/screenshots/` 路由引用）
- **存量迁移**：一次性脚本把库里 4 张 base64 卡（3dream.xyz、Wikipedia、baidu.com、ncase.me）的截图上传 blob、更新行为 URL
- **列表 API 瘦身**：`/api/cards` 不再返回 `screenshot` 列（前端列表只用 `preview`；`screenshot` 仅详情 API 使用）
- 需要新环境变量 `BLOB_READ_WRITE_TOKEN`（Vercel Blob）

## Capabilities

### New Capabilities

- `screenshot-blob-storage`: 截图二进制经压缩后上传 Vercel Blob，数据库仅存储 blob URL 引用；上传失败时提取流程的明确失败语义

### Modified Capabilities

- `extraction-screenshot`: 存储要求从「截图存入数据库」变更为「截图存入 Vercel Blob、DB 存 URL」（见 `openspec/specs/extraction-screenshot/spec.md`）

## Impact

- **代码**：
  - `src/smms.js` — 大幅缩减（删除 base64/图床逻辑）或整体删除
  - `src/save-extraction.js` — `saveScreenshot()` 改为 blob 上传；删除本地 fallback 与 `cleanupLocalScreenshot`
  - `app/api/extract/route.js` — 移除 `cleanupLocalScreenshot` 调用（v1 路由本就不引用，无改动）
  - `app/api/cards/route.js` — SELECT 与响应去掉 `screenshot` 字段
  - `app/api/admin/check-screenshots/route.js`、`src/check-screenshots.js` — 引用 `uploadToSMMS`/`checkImageUrl*`，需同步调整
  - `scripts/` — 新增存量迁移脚本 `migrate-base64-screenshots.mjs`
- **依赖**：新增 `@vercel/blob`
- **基础设施**：Vercel 项目开启 Blob store，配置 `BLOB_READ_WRITE_TOKEN`
- **数据**：4 张存量 base64 卡迁移为 blob URL（preview/screenshot 两列）
- **前端**：列表页不使用 screenshot 字段，无 UI 变化；详情页数据源不变
- **非目标**：不处理 refero 同步来的 403 张 blob URL 卡（它们本来就是 URL，无问题）；不做截图格式策略配置化
