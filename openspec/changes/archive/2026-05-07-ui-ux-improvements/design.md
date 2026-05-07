## Context

Design Extractor 是一个 Next.js 16 应用，用于从任意 URL 提取设计令牌。现有 UI 功能正常但交互体验粗糙，需要通过低成本改进提升用户体验。

**当前技术栈：**
- Next.js 16 + React 19
- SQLite (better-sqlite3)
- 全栈 CSS (globals.css)
- 卡片瀑布流 + 无限滚动

## Goals / Non-Goals

**Goals:**
- 提升首屏信息密度，让用户快速了解工具能力和数据分布
- 增强卡片视觉识别度，区分 dark/light/both 模式
- 改善交互反馈，通过动效提升触感
- 教育用户，降低工具使用门槛

**Non-Goals:**
- 不重构整体架构
- 不添加深色模式切换
- 不改变现有 API 契约（向后兼容）

## Decisions

### 1. 分类计数显示方式

**Decision:** 在筛选按钮内直接显示计数，使用 `(n)` 格式。

**Rationale:**
- 避免占用额外空间
- 计数与按钮紧密关联，视觉清晰
- 对比：侧边栏计数、悬浮提示、Badge 形式

**Alternative considered:** 筛选栏上方单独一行显示统计 — 排他，增加认知负担。

### 2. 卡片模式色条

**Decision:** 卡片顶部 4px 色条表示模式：
- Light 模式：白色 `#FFFFFF`
- Dark 模式：深色 `#1A1A1A`
- Both 模式：半黑半白渐变或双色条

**Rationale:**
- 最小侵入性的视觉标记
- 与现有深色主题协调
- 用户可快速扫描识别

### 3. 示例输出预览

**Decision:** 在 Hero 区域下方、卡片网格上方添加一个折叠面板，展示来自 Stripe 的示例输出。

**Rationale:**
- 零学习成本理解工具输出
- 使用真实 URL (Stripe) 增加可信度
- 折叠设计不干扰主要操作流程

**Implementation:** 使用 `<details>/<summary>` 或 React state 控制折叠。

### 4. 动效方案

**Decision:** 仅使用 CSS transition 实现卡片 hover 效果：
```css
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  transition: all 200ms ease-out;
}
```

**Rationale:**
- 无需 JavaScript 动画库
- 性能友好（仅 transform + opacity）
- 符合现代 web 动效最佳实践

### 5. API 扩展（可选）

**Decision:** `/api/cards` 响应保持不变，分类计数从已加载的卡片数据在前端聚合计算。

**Rationale:**
- 避免后端改动
- 前端已有完整数据（加载时获取）
- 性能损失可忽略（仅 400 条数据）

## Risks / Trade-offs

- [Risk] 示例输出硬编码可能导致过期 → **Mitigation:** 定期更新或使用静态生成内容
- [Risk] 动效可能对 `prefers-reduced-motion` 用户不友好 → **Mitigation:** 添加媒体查询 `@media (prefers-reduced-motion: reduce)`
- [Risk] 分类计数需要重新计算 → **Mitigation:** 前端聚合，缓存分组结果

## Migration Plan

1. **开发分支**: `ui-ux-improvements`
2. **部署**: 直接合并到 main，Next.js 静态页面自动生效
3. **回滚**: `git revert` 单次提交即可

## Open Questions

- 示例输出应该展示哪个网站？（Stripe, Linear, Notion？）
- 卡片色条设计是否需要考虑无障碍（颜色对比度）？
