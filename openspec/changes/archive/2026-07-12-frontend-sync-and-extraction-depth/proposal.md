## Why

提取质量对齐后（improve-extraction-quality），前端详情页仍然使用旧版 `getDesignMd()` 生成 DESIGN.md，与后端新版 `generateDesignMd()` 不一致；CSS 变量、断点、base grid、Do's & Don'ts 等新字段在详情页未展示。同时，提取引擎在 Layout 深度和组件检测方面仍有提升空间，对齐竞品能力。

## What Changes

1. **前端同步**：同步详情页 `getDesignMd()` 与后端 `generateDesignMd()` 输出格式，展示新字段（CSS 变量、断点、base grid、Dos & Donts、Agent Prompt）
2. **Layout 深度检测**：识别 grid/flex 容器布局模式、检测容器 max-width/布局宽度
3. **响应式策略**：增强 LLM prompt，输出响应式设计策略描述
4. **组件检测**：通过 DOM tree 结构分析识别可复用 UI 组件模式，结合 LLM 验证和命名

## Capabilities

### New Capabilities

- `frontend-sync`: 前端详情页与后端输出一致，展示 CSS 变量、断点、base grid 等新字段
- `layout-depth-detection`: 从 DOM 中提取 grid/flex 容器参数、容器 max-width、列数等布局信息
- `responsive-strategy`: 增强 LLM 分析，基于断点数据输出响应式设计策略
- `component-detection`: 通过 DOM 结构分析识别可复用组件（按钮、卡片、导航等），结合 LLM 验证

### Modified Capabilities

*(无)*

## Impact

- **app/style/[id]/page.js**: 重写 `getDesignMd()`，展示新字段
- **src/extractor-v2.js**: 新增 grid/flex/布局采集函数、新增组件检测逻辑
- **src/extractor-v2.js**: 增强 LLM system prompt（响应式策略）
- **无需新依赖**：grid/flex 检测通过 computedStyle 获取