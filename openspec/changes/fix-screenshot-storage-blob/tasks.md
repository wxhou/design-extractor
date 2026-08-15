## 1. 依赖与基础设施

- [x] 1.1 安装依赖 `@vercel/blob` 与 `sharp`（npm i）
- [x] 1.2 在 Vercel 控制台创建 Blob store，将 `BLOB_READ_WRITE_TOKEN` 写入 Vercel 环境变量与本地 `.env.local`（不入版本控制）

## 2. 核心改造：blob 上传链路

- [x] 2.1 新增 `src/screenshot-storage.js`：`uploadScreenshot(pngBuffer, cardId)` — sharp 转 JPEG(q80) → `put({ addRandomSuffix: false })` 上传 key `extraction-<cardId>-<Date.now()>.jpg` → 返回 blob URL；失败抛错（无 fallback）
- [x] 2.2 改造 `src/save-extraction.js` 的 `saveScreenshot()`：调用 `uploadScreenshot()`；保留「截图捕获失败 → 建卡 + screenshot null + 详情页 placeholder」的现状语义；删除 base64 分支与本地文件 fallback（`SCREENSHOTS_DIR`、`fs.writeFileSync`、`/api/screenshots/` 返回路径）
- [x] 2.3 删除 `src/save-extraction.js` 的 `cleanupLocalScreenshot()`，并移除 `app/api/extract/route.js` 中对它的唯一调用（v1 路由无此调用，勿动）
- [x] 2.4 删除 `src/extractor-v2.js` AI 增强路径的死写盘 `fs.writeFileSync('/tmp/screenshot-*.png')`（`enrichWithAI` 只需 buffer 不需路径）
- [x] 2.5 删除 `src/smms.js`（`uploadToSMMS`/`saveImageAsBase64`/`uploadToImageHost`/`checkImageUrl*`），同步修正引用方 `app/api/admin/check-screenshots/route.js` 与 `src/check-screenshots.js`：图片校验改为对 blob URL 的 HTTP HEAD 检查，并清理迁移后恒为 0 的 `sm.ms` 统计分支
- [x] 2.6 删除 `app/api/screenshots/[id]/route.js`（本地 FS 读取路由，serverless 下恒 404 的死代码）

## 3. 列表 API 瘦身

- [x] 3.1 `app/api/cards/route.js`：SELECT 与响应对象移除 `screenshot` 字段（保留 `preview`）；确认前端 `app/page.js` 无 `screenshot` 引用（全库仅 `app/page.js:241` 消费 `/api/cards`）

## 4. 存量迁移

- [x] 4.1 编写 `scripts/migrate-base64-screenshots.mjs`：查 `preview LIKE 'data:%'` → 解码 → sharp 转 JPEG → `put()` → UPDATE `preview`/`screenshot` 两列，**每列单独带 `LIKE 'data:%'` 条件**（防止「preview 是 data: 而 screenshot 已是 URL」的行被误覆盖）；支持 `--dry-run` 打印计划；幂等
- [x] 4.2 本地 `--dry-run` 验证输出覆盖预期 4 张卡（3dream.xyz、Wikipedia、baidu.com、ncase.me）
- [x] 4.3 实跑迁移（连生产 Turso），验证库中不再有 `data:` 前缀行

## 5. 验证（线上）

- [x] 5.1 部署后提取一个全新 URL：截图为 blob URL（`*.public.blob.vercel-storage.com`）、DB 两列为 URL、卡片在首页/详情页渲染正常
- [x] 5.2 在 4.3 迁移完成后验证：`/api/cards?page=1&limit=20` 响应 < 100KB（与 4.3 前的 731KB 对比）且响应中无 `screenshot` 字段、无 `data:` 前缀 preview；详情 API 响应体积回归正常
- [x] 5.3 固化 Playwright 测试（`tests/playwright/`）：新增/更新断言——列表响应 cards 不含 `screenshot` 字段；打开详情页断言 `img.detail-media`（或详情页实际截图选择器）加载成功（`naturalWidth > 0`）
- [x] 5.4 浏览器验证 1 张**已迁移**的存量卡（如 ncase.me）详情页：截图正常渲染、控制台无 error、无失败图片请求
- [x] 5.5 浏览器验证**国内反代路径**：通过 `design-extractor.wxhou.workers.dev` 打开首页与详情页，断言 blob 图片 `naturalWidth > 0`、无失败图片请求（验证 R1 风险；实测不可达则记录并走 R1 预案）
- [x] 5.6 lint（ESLint）与 typecheck（如适用）通过
