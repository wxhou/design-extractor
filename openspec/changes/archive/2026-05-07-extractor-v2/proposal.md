## Why

当前 `extractor.js` 只解析 CSS 变量 (`--token: value`)，无法从大多数没有设计系统的网站提取颜色等样式信息。百度的提取结果显示 `colors: {}`，用户体验很差。需要重构为基于 **Computed Style** 的提取方式，从渲染后的 DOM 元素读取实际样式，并根据元素类型推断语义角色。

## What Changes

- **重构 CSS 解析逻辑**：从解析 CSS 文件改为读取 DOM 元素的 computed styles
- **元素遍历策略**：遍历常见元素类型（button、input、card、nav 等），提取其实际颜色
- **语义推断引擎**：根据元素类型和样式推断颜色角色（如 `<button>` 的背景色 → primary）
- **颜色聚类算法**：对提取的颜色进行聚类和去重，保留最有代表性的
- **role 描述生成**：为每个颜色 token 生成描述性文字（role、group）
- **输出格式升级**：从纯 Markdown 改为结构化 JSON + Markdown，满足 refero 风格

## Capabilities

### New Capabilities

- `computed-style-extraction`: 从渲染后的 DOM 元素读取 computed style，提取实际使用的颜色、字体等
- `semantic-role-inference`: 根据元素类型和上下文推断颜色/字体的语义角色（primary、background、border 等）
- `color-clustering`: 对提取的颜色进行聚类分析，去重并合并相似颜色
- `enhanced-output-format`: 输出 refero 风格的结构化数据：colors、fonts、typography、gradient 等

### Modified Capabilities

- (none)

## Impact

- **核心模块**: `src/extractor.js` 完全重写
- **API**: `/api/extract` 返回数据结构变化，新增 `colors`、`fonts` 等字段
- **前端**: `app/page.js` 可能需要调整渲染逻辑以适配新数据格式
- **依赖**: 无新增依赖，使用现有 Playwright API
