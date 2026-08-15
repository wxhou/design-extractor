## ADDED Requirements

### Requirement: DOM 结构组件候选采集

系统 SHALL 遍历页面 DOM，通过标签名、class 名、role 属性和子元素结构识别候选组件模式。

#### Scenario: 按钮组件检测
- **WHEN** 页面包含 5 个以上的 `button` 或 `[role="button"]`
- **THEN** 输出按钮组件候选，包含出现次数和典型 HTML 结构

#### Scenario: 卡片组件检测
- **WHEN** 页面包含 3 个以上的 `class*="card"` 模式
- **THEN** 输出卡片组件候选，包含选择器和出现次数

### Requirement: 组件聚类去重

系统 SHALL 将相似的 DOM 结构聚类，避免重复输出相同组件。

#### Scenario: 同组件多实例
- **WHEN** 同一组件出现 5 次，结构相同仅内容不同
- **THEN** 只输出 1 个组件条目，标注出现 5 次

### Requirement: LLM 组件验证

当 LLM 启用时，系统 SHALL 将组件候选发送给 LLM 做验证和命名。当无组件候选时，Components section 维持 `(none detected)` 占位。

#### Scenario: LLM 验证
- **WHEN** LLM 可用且检测到组件候选
- **THEN** LLM 输出验证后的组件清单，包含名称、变体和描述

#### Scenario: 无组件可检测
- **WHEN** 页面无重复 UI 模式（如纯文章页）
- **THEN** Components section 保持 `(none detected)` 占位