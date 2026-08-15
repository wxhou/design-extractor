## Context

当前设计提取引擎（`src/extractor-v2.js`）使用 Playwright 渲染页面后通过 CSS computedStyle 提取设计 tokens，再通过 MiniMax AI 做语义颜色命名。输出为 DESIGN.md + 多格式导出。

**当前状态**：
- 颜色提取：聚类（欧几里得距离）→ MiniMax 命名，但仅做颜色起名，无角色映射
- 间距：最多 7 个 token（xs→3xl）
- 圆角：最多 4 个 token（sm→lg→full）
- 阴影：最多 4 个 token（sm→xl）
- 字体：仅提取第一个字体，无 fallback 链
- 缺失：CSS 变量检测、媒体查询断点检测、布局分析、组件检测、Do's & Don'ts
- LLM 增强：仅 MiniMax，仅做颜色命名

**目标状态（对齐 design-extractor.com）**：
- 间距：14 级 token + base grid 检测
- 圆角：6-7 级 + 角色映射
- 阴影：5+ 级 + 交互信号
- 字体：完整 fallback 链
- 新增：CSS 变量检测、断点检测
- LLM：多模态（截图 + CSS 证据）→ 完整设计系统分析
- 输出：8 个 canonical sections 的 DESIGN.md 格式

## Goals / Non-Goals

**Goals:**
- CSS 提取深度对齐 design-extractor.com（间距/圆角/阴影数量、CSS 变量、断点）
- LLM 增强从仅颜色命名扩展为完整设计系统分析（角色映射、设计哲学、Do's & Don'ts、Agent Prompt）
- DESIGN.md 输出格式对齐规范（8 sections + YAML 标准结构）
- 保持向后兼容：现有字段不删除，现有 API 响应不破坏

**Non-Goals:**
- 不作组件 DOM 结构识别（非一期，需要 DOM tree walk + 截图联合分析）
- 不作图标风格检测
- 不引入新外部依赖（保持现有 MiniMax + OpenAI 兼容客户端）
- 不改动前端详情页展示（一期只改后端输出）

## Decisions

### Decision 1: 三步顺序执行，每步独立可验证

```
Step 1: CSS 证据采集增强
  ├── 间距：clusterSpacingValues 截取数 7→14，加 baseGrid 检测
  ├── 圆角：clusterRadiiValues 截取数 4→6-7
  ├── 阴影：clusterShadows 截取数 4→5-6
  ├── 新增：collectCSSVariables() 检测页面 var() 使用
  ├── 新增：detectBreakpoints() 从 CSSStyleSheet 提取媒体查询
  ├── 新增：extractFontStack() 采集完整 font-family fallback
  └── 验证：generateDesignMd() 输出包含更多 token

Step 2: 多模态 LLM 增强
  ├── CSS 证据压缩：将颜色/字体/间距/圆角/阴影压缩为结构化文本
  ├── 截图 + CSS 证据 → 多模态 LLM
  ├── 扩展 prompt：输出颜色角色命名 + typography 层级 + 设计哲学 + Do's & Don'ts + Agent Prompt
  └── 验证：generateDesignMd() 输出包含 8 sections

Step 3: 输出格式对齐
  ├── 修改 generateDesignMd() → 8 canonical sections
  ├── YAML front matter 使用角色命名
  ├── typography 使用完整对象（fontFamily/fontSize/fontWeight/lineHeight/letterSpacing）
  └── 验证：输出 Stripe/Airbnb 时可对比 design-extractor.com 的输出结构
```

**理由**：三步有自然的数据依赖关系——Step 1 采集的数据是 Step 2 的输入，Step 2 的输出决定 Step 3 的格式。独立可验证意味着每步结束可以检查增量效果。

### Decision 2: CSS 变量检测使用综合方式

不单独注入脚本，而是在当前 `extractStylesFromPage` 基础上补充两处检测：
- **CSSStyleSheet 规则遍历**：`document.styleSheets` → 提取 `var(--*)` 引用和自定义属性定义
- **ComputedStyle 值标注**：对已提取的值标注来源（`getPropertyValue('color')` 的返回值如果包含 `var()` 则记录变量名）

**理由**：不新增 Playwright evaluate 调用，复用已有的 page context。

### Decision 3: 断点检测直接从 CSSStyleSheet 提取

遍历 `document.styleSheets` 中所有 `@media` 规则，提取 min-width/max-width 值并聚类为断点层级。

**理由**：一行 evaluate 搞定，不需要额外渲染开销。

### Decision 4: LLM prompt 采用结构化的 CSS Evidence 格式

```
CSS Evidence for {{siteName}}:
Colors (by frequency): {{hex}} - {{frequency}} - contexts:[{{ctx}}]
Typography:
  Primary font: {{family}}
  Font stack: {{fallback}}
  Type scale: {{size}}px ({{role}})
Spacing base grid: {{base}}px
  Tokens: {{value}} ({{count}})
Radius: {{value}} ({{context}})
Shadows: {{value}} ({{count}})
CSS Variables detected: {{name}} = {{value}}
Breakpoints: {{width}}px
```

**理由**：结构化文本比 JSON 更利于 LLM 理解上下文关系。截图作为多模态输入提供视觉参考。

**替代方案考虑**：
- JSON 格式 → 太冗长，LLM 处理效率低
- 纯截图 → 精度不够，CSS 数值必须精确

### Decision 5: 保留现有 MiniMax 调用作为降级

当多模态 LLM 调用失败时，回退到现有的规则推断 + MiniMax 颜色命名路径，保证服务不降级。

### Decision 6: 选用 MiniMax-M3 作为多模态模型

确认 MiniMax-M3 支持图片输入（OpenAI 兼容的 `image_url` 格式），且计价与 M2.7 相同（2.10 元/百万 tokens 输入），无需更换 API Key 或 endpoint。

**切换方式**：
- 模型名从 `MiniMax-M2.7` 改为 `MiniMax-M3`
- 消息格式从纯文本改为 `content` 数组（text + image_url）
- 现有 OpenAI SDK 兼容代码无需更换

**风险**：M3 的 UI 截图分析质量未经公开基准验证。如效果不达标，备选方案为 GPT-4o（更贵但视觉更可靠）或 Claude。

## Risks / Trade-offs

- **[LLM 成本]** 多模态调用会增加 token 消耗 → 仅成功提取时调用，失败不调用；加截断保护（最长 4000 token 响应）
- **[截图尺寸]** 大页面截图可能很大 → 压缩为 JPEG 80% quality，最大 1024px 宽
- **[CSS 变量/断点兼容性]** 跨域 CSSStyleSheet 可能为空（CORS 限制）→ 空时静默跳过，不影响主流程
- **[输出格式变化]** 现有前端消费方可能依赖旧格式 → 只增不减，新 sections 是追加而非替换

## 已解决

- **多模态模型选择**：MiniMax-M3（支持 `image_url` 输入），已确认
- **Components section**：保留占位，显示 `(none detected)`，与 design-extractor.com 一致
- **数据库存储**：cards 表新增列（CSS 变量、断点、base grid、角色映射等）
- **前端同步**：三步全改完后统一做（详情页 `getDesignMd()` 同步）
- **多格式导出**：Step 1 完成后同步更新 `generateTokensJson`/`generateVariablesCss`/`generateThemeCss`