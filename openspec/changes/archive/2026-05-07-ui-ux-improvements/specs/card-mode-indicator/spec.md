## ADDED Requirements

### Requirement: 卡片模式色条指示器

系统 SHALL 在每个样式卡片顶部显示 4px 高度的颜色条，指示该样式的模式（light/dark/both）。

#### Scenario: Light 模式卡片

- **WHEN** 卡片代表 Light 模式的样式
- **THEN** 卡片顶部显示白色 (#FFFFFF) 色条

#### Scenario: Dark 模式卡片

- **WHEN** 卡片代表 Dark 模式的样式
- **THEN** 卡片顶部显示深色 (#1A1A1A) 色条

#### Scenario: Both 模式卡片

- **WHEN** 卡片代表同时支持 Light 和 Dark 的样式
- **THEN** 卡片顶部显示双色条（左侧白色，右侧深色）或渐变色条

#### Scenario: 色条与图片对齐

- **WHEN** 色条被添加到卡片顶部
- **THEN** 预览图片紧贴在色条下方，保持视觉连贯
