## ADDED Requirements

### Requirement: Grid 容器检测

系统 SHALL 提取页面中的 CSS Grid 容器参数，包括 grid-template-columns、gap、列数。

#### Scenario: Grid 布局页面
- **WHEN** 页面使用 `display: grid` 容器
- **THEN** 输出包含 grid 列数、gap 值和列模板（如 `repeat(3, 1fr)`）

### Requirement: Flex 容器检测

系统 SHALL 提取页面中的 Flex 容器参数，包括 flex-direction、justify-content、align-items、gap。

#### Scenario: Flex 布局页面
- **WHEN** 页面使用 `display: flex` 容器
- **THEN** 输出包含 flex 方向、对齐方式和 gap 值

### Requirement: 容器宽度检测

系统 SHALL 检测页面主要容器的 max-width 和宽度值，推断布局约束。

#### Scenario: 固定宽度布局
- **WHEN** 页面 main 容器设置 `max-width: 1120px`
- **THEN** 输出包含布局最大宽度限制

### Requirement: Layout 信息集成

系统 SHALL 将 grid/flex/容器宽度信息集成到 DESIGN.md 的 Layout & Spacing section 中。当无 grid/flex 数据时，Layout section 照常输出但跳过对应子节。

#### Scenario: 完整 Layout 输出
- **WHEN** 提取到 grid/flex 布局信息
- **THEN** Layout section 包含 Grid 列数、Flex 方向、容器宽度等描述

#### Scenario: 无 grid/flex 布局
- **WHEN** 页面未使用 grid 或 flex 布局（如纯流式文档页）
- **THEN** Layout section 照常输出 spacing 和 breakpoints，跳过 grid/flex 子节