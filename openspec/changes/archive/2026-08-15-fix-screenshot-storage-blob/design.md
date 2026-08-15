# fix-screenshot-storage-blob — Design

## Context

数据链路现状（2026-08-14 线上实测）：

- 库内 407 张卡，其中 403 张的 `preview` 是 refero.design 同步来的 blob URL（本系统从未上传过 blob——git 全历史无 `@vercel/blob` 代码）；4 张是本系统真实提取产出，`preview`/`screenshot` 两列各存一份 130–820KB 的 PNG base64 data URI。
- base64 污染路径：`save-extraction.js:14 saveScreenshot()` → `smms.js:77 uploadToSMMS`（实为 `saveImageAsBase64`，文件头注释写明是「优先 base64 存库」的有意决策）→ 成功返回 data URI → 原样写库。
- fallback 路径写 `public/screenshots/<id>.png` 并返回 `/api/screenshots/<id>.png`——Vercel serverless 无持久 FS，此路径必然失败或丢文件。
- 放大因素：截图为 1440px 全页 PNG（同画面 JPEG 约 1/5–1/10 体积）；base64 双写 `preview` + `screenshot` 两列（体积 ×2）；列表 API `app/api/cards/route.js` 无条件 SELECT 两列。
- 实测影响：含 1 张 base64 卡的列表页响应 731KB/3.7s；详情 API 1.68MB。

调用面（来自 codegraph）：
- `saveExtraction` 的调用方：`app/api/extract/route.js`、`app/api/v1/extract/route.js`（付费 API，IDOR 防护版）。
- `uploadToSMMS`/`checkImageUrl*` 的调用方：`src/save-extraction.js`、`app/api/admin/check-screenshots/route.js`、`src/check-screenshots.js`。
- `cleanupLocalScreenshot` 的调用方：两个 extract 路由（本地 fallback 清理，blob 化后无意义）。

## Goals / Non-Goals

**Goals:**
- 新提取的截图存 Vercel Blob，DB 只存 URL——数据模型回归「DB 存引用、blob 存字节」
- 截图体积可控（JPEG 压缩），列表 API 响应迁移后回归 <100KB/页
- 存量 4 张 base64 卡迁移为 blob URL
- 删除死代码：本地截图 fallback、假图床逻辑

**Non-Goals:**
- 不动 refero 同步来的 403 张卡（本来就是 URL，无问题）
- 不做截图尺寸/质量/格式策略配置化（固定 JPEG q80、宽 1440）
- 不做截图重生成或视频预览（video_url）能力
- 不改前端 UI

## Decisions

### D1：对象存储选 Vercel Blob（方案 A），否决 B/C

| 方案 | 结论 | 理由 |
|---|---|---|
| **A. `@vercel/blob` 自建桶** | ✅ 采用 | 与现有 Vercel 部署零摩擦（一个环境变量）；403 张 refero 卡已证明 blob URL 模式在前端代码全链路工作；官方维护、CDN 就近分发 |
| B. 压缩 + 列表瘦身（不引存储） | 否决 | DB 行仍存大字节，Turso 按行/存储计费；详情 API 依旧重；只是把问题从列表挪到详情 |
| C. 外接图床（imgchr） | 否决 | `smms.js` 里现成代码，但第三方免费图床可用性无 SLA，链接会烂；已验证过不可靠 |

**国内可达性限定**：D1 的「已证明」仅指前端代码路径。浏览器 `<img>` 将直连 `*.public.blob.vercel-storage.com`（Cloudflare Worker 只反代主站域名，不改写响应体内的 blob URL）。该域名与 403 张 refero 卡共用，非本 change 新引入的风险面；2026-08-14 本机实测直连可用（HTTP 200，0.56s）。但 4 张 base64 卡目前是唯一不依赖外部域名的兜底，迁移后归零——预案见风险节 R1。

### D2：截图上传前转 JPEG（q80），否决 PNG

截图实际为 **1440×900 视口截图**（`src/extractor-v2.js:261` `fullPage: false`，非全页）——实测 PNG 130–820KB 偏大主要来自全页场景与未压缩像素；视口 JPEG q80 预计 50–120KB。截图场景无透明通道需求，PNG 无收益。转换用 `sharp`（Next.js 生态标配，Vercel 原生支持）。

### D3：blob key 命名 `extraction-<cardId>-<ts>.jpg`，`put()` 显式 `addRandomSuffix: false`

`@vercel/blob` 的 `put()` 默认 `addRandomSuffix: true`，会把 key 变成 `…-<ts>-<rand>.jpg` 与本约定不符；key 已带时间戳防重提取覆盖（`saveExtraction` 的 UPSERT 复用 cardId，同 key 覆盖会导致 CDN 缓存旧图），随机后缀冗余，显式关闭。

### D4：blob 上传失败 = 提取失败（快速失败），否决静默降级——仅限「上传失败」这一种情形

明确区分两类失败，只有上传失败是新语义：

| 情形 | 现状 | 本 change 后 |
|---|---|---|
| **截图捕获失败**（Playwright screenshot 抛错，`src/extractor-v2.js:260-272` 静默吞掉继续） | 建卡 + screenshot 为 null，详情页 placeholder | **维持现状不变**（非目标：不收紧捕获失败的容错） |
| **blob 上传失败**（`put()` 网络/额度/ token 问题，此时 buffer 已在手） | 不存在此路径（现状是 base64 直存「永不错」） | 抛错；免费路由 500 + 友好文案（现状 catch 块语义）、v1 路由 502 `extraction_failed`；不落库 |

理由：有 buffer 却传不上去说明是基础设施问题，静默丢图会在库里制造缺图坏数据；而捕获失败可能是目标站反爬等非己方因素，维持宽松语义。不保留任何静默 fallback（本地 FS fallback 已证明在 serverless 是死路）。附带已知问题（非本 change 引入，仅记录）：免费路由在提取前就 `incrementFreeIpUsage`（`app/api/extract/route.js:71`），上传失败时该 IP 的免费额度已被消耗。

### D5：列表 API 去掉 `screenshot` 字段

前端列表只渲染 `preview`（已核 `app/page.js` 用途）。`screenshot` 仅详情 API 返回。这是防御性瘦身：即使未来误存大对象，列表也不会再被拖垮。**BREAKING**（对外若有第三方消费 `/api/cards`——该端点无鉴权无文档，按内部端点处理）。

### D6：存量迁移一次性脚本 `scripts/migrate-base64-screenshots.mjs`

`SELECT WHERE preview LIKE 'data:%'` → 解码 base64 → 转 JPEG → `put()` → `UPDATE` 两列。幂等（跑两遍第二遍查无此行）。`preview` 与 `screenshot` 两列迁完后指向同一 URL（与 refero 卡一致：`preview` 有独立 poster、`screenshot` 原图——本系统两者本就是同一张图）。

### D7：`src/smms.js` 整体删除，否决瘦身保留

`checkImageUrl`/`checkImageUrlWithSize` 对 `data:` 前缀直接返回 true 的逻辑，在 base64 清除后无意义；`uploadToImageHost`（imgchr）从未被走通。调用方 `check-screenshots` 两个文件改为直接消费 blob URL 的 HTTP HEAD 检查（或一并简化）。按「过时的直接删」原则不留兼容层。

### D8：put() body 传 ReadableStream 而非 Buffer（实现期新增决策）

实现后发现：Vercel serverless runtime 禁用 SharedArrayBuffer，`@vercel/blob` 2.8.0 内部 undici 对 Buffer body 的 webidl 检查抛 `SharedArrayBuffer is not allowed`（本地 Node 不复现，仅线上）。传 `Readable.toWeb(Readable.from([jpeg]))` 绕过 ArrayBuffer 检查路径，线上实测通过。该 workaround 已在代码注释中说明；若未来 @vercel/blob 修复此兼容性可回归 Buffer。

## Risks / Trade-offs

- [R1｜国内反代路径下 blob URL 可达性] → 本机实测可用（2026-08-14）；403 张 refero 卡与 blob 域名共用同一风险面（非新增回归）。tasks 5.5 固化经 `design-extractor.wxhou.workers.dev` 的浏览器验证（断言 blob 图 `naturalWidth > 0`）。**预案**：若目标用户网络实测不可达，后续独立 change 在 Worker 增加 `/blob/<key>` 图片代理路径（Worker 拉取 blob 后回传，主站域名下无墙）；不在本 change 实施，避免 Worker 变更与本次数据迁移耦合
- [Vercel Blob 免费额度（1GB 存储/月）被提取量耗尽] → 单图视口 JPEG 预计 50–120KB，1GB ≈ 1 万次提取/月，当前量级（月均 <10 次）远够；超额时 Vercel 计费告警兜底
- [`sharp` 引入原生依赖，Vercel 构建兼容] → sharp 是 Vercel 官方支持的常用依赖（next/image 内置），无额外配置；本地开发需 `npm install` 一次
- [存量迁移脚本误写坏数据] → 脚本先 `--dry-run` 打印计划，实际执行前人工确认；UPDATE 按 id 精确匹配且逐列带 `LIKE 'data:%'` 条件（防止「preview 是 data: 而 screenshot 已是 URL」的行被误覆盖）
- [UPSERT 产生孤儿 blob（重复提取同 URL 覆盖 URL 引用，旧 blob 永不删除）] → 当前量级（月 <10 次提取）可忽略；如后续量级上升，加生命周期清理脚本
- [列表 API 去 screenshot 字段破坏未知第三方] → 该端点无鉴权、无对外文档，首页自用（全库 grep 仅 `app/page.js:241` 一处消费）；若有消费者属预期外依赖，回滚只需恢复 SELECT 一行
- [blob token 泄露风险] → 仅存 Vercel 环境变量与 `.env.local`（已在 .gitignore），不进代码库
- [免费额度消耗时序（非本 change 引入）] → 免费路由在提取前 `incrementFreeIpUsage`，上传失败时额度已被扣；D4 快速失败后该现象更可见，暂不处理（见 D4 备注）

## Migration Plan

1. Vercel 控制台创建 Blob store → 得到 `BLOB_READ_WRITE_TOKEN` → 配置到 Vercel env 与本地 `.env.local`
2. 合并代码并部署（新提取立即走 blob；存量 4 卡仍为 base64，列表在迁移前持续偏重——可接受，或部署后立即跑迁移）
3. 本地跑 `node scripts/migrate-base64-screenshots.mjs`（连生产 Turso）→ 验证 4 卡 preview 变 URL
4. 验证：列表 API <100KB、详情页截图正常渲染、`ncase.me` 重新提取走 blob
5. 回滚策略：代码 revert 即回到 base64 直存（数据无破坏性变更；迁移后的卡 preview 是 blob URL，旧代码读 URL 也能正常显示，无需回滚数据）

## Open Questions

（无——方案 A/B/C 已在 explore 阶段与用户对齐，A 获确认）
