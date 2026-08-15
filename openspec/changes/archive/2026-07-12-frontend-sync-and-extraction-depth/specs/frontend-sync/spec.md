## ADDED Requirements

### Requirement: 前端 getDesignMd() 与后端同步

系统 SHALL 使详情页 `getDesignMd()` 的输出格式与后端 `generateDesignMd()` 一致，包含 8 个 canonical sections 和角色命名的 YAML front matter。

#### Scenario: 一致输出
- **WHEN** 用户打开任意卡片详情页
- **THEN** 页面展示的 DESIGN.md 与 API 返回的 `designMd` 字段内容一致

### Requirement: 展示新字段

详情页 SHALL 展示以下新字段：CSS 变量列表、响应式断点、spacing base grid、Do's & Don'ts、Agent Prompt Guide。

#### Scenario: CSS 变量展示
- **WHEN** 提取结果包含 CSS 变量
- **THEN** 详情页展示 CSS 变量列表，格式为 `--name: value`

#### Scenario: 断点展示
- **WHEN** 提取结果包含 breakpoints
- **THEN** 详情页展示响应式断点列表

#### Scenario: Dos & Donts 展示
- **WHEN** 提取结果包含 dos 和 donts
- **THEN** 详情页展示 Do's 和 Don'ts 列表

#### Scenario: 新字段为空
- **WHEN** 提取结果中 CSS 变量、断点等字段为空
- **THEN** 详情页对应位置静默隐藏或显示 "无数据"