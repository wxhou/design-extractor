## Context

当前 extractor-v2 可以从网站提取设计 tokens，但结果只返回纯 Markdown 文本。用户在界面上看到的是代码块式的输出，无法与其他已有卡片（refero.db 中存储的）那样拥有精美的详情页体验。

已有卡片的详情页 `/style/[id]` 支持：
- 颜色卡片展示（可点击复制）
- 字体预览
- Type Scale 展示
- 渐变、间距、表面色、圆角等丰富数据
- CSS Variables / Tailwind / Design Tokens 导出面板

## Goals / Non-Goals

**Goals:**
- 用户输入 URL → 提取 → 跳转到详情页，与其他卡片体验一致
- 提取结果持久化到数据库
- 生成网站截图作为预览图
- 推断设计分类（category）和主题（color_scheme）

**Non-Goals:**
- 不改变 extractor-v2 核心提取逻辑
- 不重新设计详情页 UI（已有的已经完善）
- 不支持批量提取

## Decisions

### 1. 在 extractor-v2 中生成截图

**决策**: 使用 Playwright 的 `page.screenshot()` 在提取完成后生成截图

**理由**:
- Playwright 已经启动并加载了页面，截图零额外网络开销
- 相比外部截图服务更快、更可靠

**备选方案**:
- 使用 puppeteer 等其他浏览器: 不采用，因为已有 Playwright
- 使用外部截图 API: 增加延迟和依赖，不必要

### 2. 分类推断基于颜色分析

**决策**: 根据主色调占比推断 category，根据背景色亮度推断 color_scheme

**理由**:
- 颜色分布是网站设计风格的最直接体现
- 无需额外 API 调用，提取时即可完成

**推断规则**:
```
color_scheme:
  - 背景色亮度 < 50% → "dark"
  - 否则 → "light"

category (简化版):
  - 暗色比例 > 60% → "dark"
  - 主色饱和度低、对比度低 → "minimal"
  - 主色饱和度高、亮度高 → "playful"
  - 主色为蓝/紫调 → "saas"
  - 其他 → "minimal"
```

### 3. 数据库写入在 API 层处理

**决策**: 在 `app/api/extract/route.js` 中处理数据库写入

**理由**:
- 保持 extractor-v2 职责单一（提取 + 截图）
- API 层更方便访问 refero.db
- 返回结构与现有接口一致

### 4. 前端跳转通过 router.push

**决策**: 提取完成后调用 `router.push('/style/' + cardId)`

**理由**:
- Next.js App Router 标准方式
- URL 可分享、可书签

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 截图可能暴露隐私内容 | 用户自愿输入，代表同意公开 |
| 截图存储增加磁盘占用 | 使用合理的压缩比 |
| 分类推断可能不准确 | 保持简单规则，可后续优化 |

## Open Questions

1. 截图存储位置：本地文件系统还是云存储？
   - **决策**: 先存本地 `public/screenshots/`，简化实现

2. 截图文件名命名规则？
   - **决策**: `{cardId}.png` 便于关联

3. 是否需要截图 URL 字段？
   - **决策**: 是，存 `screenshot` 字段，API 返回完整 URL 路径
