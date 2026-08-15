## ADDED Requirements

### Requirement: 间距 token 数量扩展至 14 级

系统 SHALL 将间距聚类输出从当前最多 7 级（xs→3xl）扩展至最多 14 级，命名规则为 spacing-1 至 spacing-14。

#### Scenario: 高密度间距页面提取
- **WHEN** 提取具有 10+ 不同 padding/margin/gap 值的页面
- **THEN** 输出包含至少 10 个 spacing token，覆盖从最小值到最大值的完整范围

### Requirement: 间距 base grid 检测

系统 SHALL 计算间距值的最大公约数倾向，推断设计系统的基础网格单位（4px/5px/6px/8px 等）。

#### Scenario: 8px 网格页面
- **WHEN** 间距值均为 8px 的倍数（8, 16, 24, 32, 48 等）
- **THEN** 输出标注 `spacingBase: 8px`

### Requirement: 圆角 token 扩展至 6-7 级

系统 SHALL 将圆角聚类从当前最多 4 级扩展至最多 7 级，命名规则为 radius-none, radius-xs, radius-sm, radius-md, radius-lg, radius-xl, radius-full。

#### Scenario: 多级别圆角页面
- **WHEN** 提取使用 6 种不同 border-radius 值的页面
- **THEN** 输出包含 6 个 radius token，包含 role 标注（如 "Card corner", "Control corner"）

### Requirement: 阴影 token 扩展至 5-6 级

系统 SHALL 将阴影聚类从当前最多 4 级扩展至最多 6 级，并新增交互信号检测（hover 状态的 box-shadow、outline、backdrop-filter blur）。

#### Scenario: 多层次阴影页面
- **WHEN** 提取使用 5+ 种不同 box-shadow 的页面
- **THEN** 输出包含 5+ 个 shadow token，包含交互信号标注

### Requirement: CSS 变量检测

系统 SHALL 遍历 `document.styleSheets` 提取页面自定义 CSS 属性定义（`--*`），并记录每个已提取值的变量来源。

#### Scenario: 使用 CSS 变量的页面
- **WHEN** 提取使用 `var(--color-primary)` 的页面
- **THEN** 输出包含 CSS 变量映射关系，如 `color: #533afd/* var(--hds-color-core) */`

#### Scenario: CORS 限制
- **WHEN** 页面样式表来自跨域 CDN 且不支持 CORS
- **THEN** 系统静默跳过 CSS 变量检测，不影响主提取流程

### Requirement: 媒体查询断点检测

系统 SHALL 遍历 `document.styleSheets` 提取所有 `@media` 规则中的 min-width/max-width 值，聚类为响应式断点层级。

#### Scenario: 三断点页面
- **WHEN** 页面定义了 mobile (640px)、tablet (1024px)、desktop (1280px) 三个断点
- **THEN** 输出包含三个断点层级及对应的宽度值

### Requirement: 字体 fallback 链采集

系统 SHALL 提取元素的完整 font-family 值（不仅仅是第一个字体），输出完整 fallback 链。

#### Scenario: 复杂字体栈
- **WHEN** 页面设置 `font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **THEN** 输出 font stack 包含完整的 5 个字体名称