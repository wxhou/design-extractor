## Why

当前设计提取能力在输出质量上与 design-extractor.com 存在明显差距：颜色命名仅基于色相、间距/圆角/阴影 token 数量偏少、缺少布局/组件/Do's & Don'ts 等关键维度、输出格式不遵循 DESIGN.md 规范。这导致用户获得的设计系统描述不够完整和语义化。

## What Changes

1. **CSS 证据采集增强**：扩展间距/圆角/阴影的聚类数量、新增 CSS 变量检测、新增媒体查询断点检测、增加 font fallback 链采集
2. **多模态 LLM 设计系统分析**：将截图 + CSS 证据压缩后发给 LLM，从仅做颜色命名扩展为完整设计系统分析（颜色角色命名、typography 层级映射、设计哲学、Do's & Don'ts、Agent Prompt 指南）
3. **DESIGN.md 输出格式对齐**：采用 8 个 canonical section 的 DESIGN.md 规范格式，YAML front matter 使用角色命名，typography 使用完整对象格式

## Capabilities

### New Capabilities

- `css-evidence-collection`: 增强 CSS 提取的深度和广度，包括更多 token 级别、CSS 变量和断点检测
- `multimodal-design-analysis`: 使用多模态 LLM 进行完整的设计系统分析，生成角色命名、设计哲学和规范指南
- `design-md-format`: 对齐 DESIGN.md 规范格式，包含 8 个 canonical sections 和标准 YAML 结构

### Modified Capabilities

*(无)*

## Impact

- **src/extractor-v2.js**: 修改聚类函数（spacing/radius/shadow 数量扩展）、新增 CSS 变量检测、新增断点检测
- **src/extractor-v2.js**: 重写 `enrichWithAI` 函数，扩展 prompt 为多模态完整分析
- **src/extractor-v2.js**: 修改 `generateDesignMd` 以对齐 DESIGN.md 规范格式
- 可能需要新增依赖：多模态 LLM 的 base64 截图传输已经在当前代码中支持
- 前端展示（app/style/[id]/page.js）可能需要调整以展示新字段