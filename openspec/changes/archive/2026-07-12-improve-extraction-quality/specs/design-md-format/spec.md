## ADDED Requirements

### Requirement: YAML front matter 使用角色命名

系统 SHALL 在 DESIGN.md 的 YAML front matter 中使用语义角色命名而非色相命名。颜色名遵循 `role-modifier` 格式（如 `surface-white`、`brand-lavender`、`action-text`）。

#### Scenario: Stripe 风格输出
- **WHEN** 提取 Stripe 风格的页面
- **THEN** YAML front matter 包含 `stripe-indigo: "#533afd"`、`surface-white: "#ffffff"` 等角色命名，而非 `Azure`、`Storm Cloud` 等色相命名

### Requirement: 8 个 canonical sections

系统 SHALL 生成遵循以下 8 个 section 顺序的 DESIGN.md：

1. Overview（设计哲学描述）
2. Colors（按角色分组的颜色分析）
3. Typography（字体层级+完整 Typography 对象）
4. Layout（间距系统+响应式断点）
5. Elevation & Depth（阴影系统+交互信号）
6. Shapes（圆角体系+角色映射）
7. Components（组件清单，暂无则标注 "none detected"）
8. Do's and Don'ts（设计规范）

#### Scenario: 完整 section 输出
- **WHEN** 生成 DESIGN.md
- **THEN** markdown 正文严格按以上 8 个 section 顺序排列，空 section 保留标题并标注

### Requirement: Typography 使用完整对象格式

YAML front matter 中的 typography 字段 SHALL 使用包含 fontFamily、fontSize、fontWeight、lineHeight、letterSpacing 的完整对象格式。

#### Scenario: 多层字体输出
- **WHEN** 提取到字体层级
- **THEN** YAML 输出如下格式：
  ```yaml
  typography:
    hero-heading:
      fontFamily: "Inter, sans-serif"
      fontSize: "44px"
      fontWeight: "300"
      lineHeight: "1.03"
      letterSpacing: "-0.02em"
  ```

### Requirement: Components section 占位

当未检测到组件时，Components section SHALL 保留为 `(none detected)` 占位文本，与 design-extractor.com 保持一致。

#### Scenario: 无组件数据
- **WHEN** 提取结果中无组件信息
- **THEN** Components section 显示 "(none detected)"