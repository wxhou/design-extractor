## Why

Design Extractor 当前功能可用，但 UI/UX 缺乏品牌个性和交互深度。用户进来后不清楚工具能力，分类筛选无计数，卡片视觉层次混乱，整体缺乏现代 web 应用的精致感。这些问题影响用户留存和第一印象。

## What Changes

- **分类筛选增强**：每个分类按钮显示当前计数，用户可快速了解分布
- **卡片视觉优化**：添加顶部色条指示 dark/light 模式，增强视觉识别
- **交互体验提升**：卡片 hover 添加动效反馈，提升触感
- **示例输出预览**：Hero 下方添加示例 DESIGN.md 输出，教育用户工具能力
- **输入引导优化**：Placeholder 改为更具体的示例格式
- **卡片 hover 动效**：微妙的升降和阴影变化

## Capabilities

### New Capabilities

- `design-tokens-disclosure`: 在 Hero 区域展示一个折叠的 DESIGN.md 示例输出，用户可展开查看具体格式
- `category-filter-counts`: 分类筛选按钮显示每个分类的样式数量统计
- `card-mode-indicator`: 卡片顶部添加 4px 色条，区分 light/dark/both 模式
- `card-hover-animation`: 卡片 hover 时添加 transform: translateY(-4px) 和阴影增强效果

### Modified Capabilities

- (none)

## Impact

- **前端**：`app/page.js` 添加状态和渲染逻辑，`app/globals.css` 添加新样式
- **API**：`/api/cards` 响应需返回分类计数（可选在现有响应中添加）
- **用户体验**：首次加载时立即看到分类分布和工具示例输出
