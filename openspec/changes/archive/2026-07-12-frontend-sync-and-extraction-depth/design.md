## Context

在 improve-extraction-quality 后，后端提取能力和输出格式已对齐 design-extractor.com。但前端详情页（`app/style/[id]/page.js`）的 `getDesignMd()` 仍然是旧格式，不调用后端的 `generateDesignMd()`。新字段（CSS 变量、断点、base grid、Dos & Donts、Agent Prompt）在 API 响应中存在，但前端未展示。

同时，Layout 深度和组件检测是提取能力的自然延伸——当前 Layout section 只有 spacing table + breakpoints，缺少 grid/flex 分析和响应式策略描述。组件检测是设计系统提取的"最后一公里"。

## Goals / Non-Goals

**Goals:**
- 前端 `getDesignMd()` 输出与后端 `generateDesignMd()` 一致
- 详情页展示 CSS 变量、断点、base grid、Dos & Donts、Agent Prompt
- 提取引擎新增 grid/flex/布局信息采集
- LLM prompt 增强输出响应式策略
- 实现 DOM 结构级组件检测

**Non-Goals:**
- 不改动首页（`app/page.js`）的展示逻辑
- 不做 Figma 变量导出等已规划但不同的能力
- 不改动数据库 schema（现有列已够）

## Decisions

### Decision 1: 组件检测——DOM 结构分析优先，LLM 验证辅助

```
DOM tree 遍历                     LLM 验证（可选）
────────────                     ────────────────
找重复出现的 UI 模式              从截图验证 + 命名
├── class 名模式                  ├── "这是卡片组件，3 个变体"
├── role 属性                    ├── "按钮在 2 个尺寸出现"
├── 子元素结构（h3+p）            └── 输出: 组件清单 + 截图
└── 标识选择器频率

输出: 候选组件（位置 + HTML 结构）
```

**理由**：纯规则引擎可以做 80% 的去重和模式识别工作，LLM 只用来做最后的验证和命名，成本低、结果可解释。

### Decision 2: Layout 检测——从 computedStyle 提取

与 CSS 变量/断点检测同样的模式：一次 `page.evaluate` 采集所有 grid/flex 容器的参数。

```js
// 采集的数据结构
{
  grid: [{ columns: 'repeat(3, 1fr)', gap: '24px', count: 5 }],
  flex: [{ direction: 'row', gap: '16px', count: 12 }],
  containers: [{ maxWidth: '1120px', count: 1 }],
  columns: [{ count: 3, selector: '.col-3' }],
}
```

### Decision 3: 组件检测——分两步执行

1. **采集阶段**：`page.evaluate` 遍历所有元素，按选择器频率和结构相似度聚类候选组件
2. **分析阶段**：在 Node.js 侧做聚类去重，发 LLM（可选）做验证和命名

避免在 `page.evaluate` 内部做复杂计算——只做数据采集，聚类在 Node 侧完成。

**关键依赖顺序**：组件候选数据必须作为 CSS Evidence 的一部分传给 LLM，因此 `compressCSSEvidence()` 需要扩展以包含组件候选信息。任务执行顺序：3（响应式策略 prompt）→ 4.1-4.3（组件检测）→ 4.4（扩展 prompt 含组件验证）→ 4.5（解析组件字段）。

## Risks / Trade-offs

- **[组件检测精度]** DOM 结构相似不等于视觉组件 → 只输出置信度高的候选，存疑的不输出
- **[Layout 噪音]** 随机 flex 容器（如单元素 wrapper）会被误认为布局模式 → 只统计重复出现 3 次以上的模式
- **[前端同步工作量]** 详情页代码 1500+ 行，`getDesignMd()` 50 行 → 改动量小，但需要小心保持其他展示功能正常