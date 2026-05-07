## ADDED Requirements

### Requirement: 按钮颜色角色推断

系统 SHALL 根据按钮元素的样式推断其语义角色。

#### Scenario: 推断 Primary 角色

- **WHEN** 按钮的 background-color 非白非灰
- **THEN** 将其归类为 `primary` 角色
- **AND** 设置 group 为 `primary`

#### Scenario: 推断 Secondary 角色

- **WHEN** 按钮的 background-color 为白色或浅灰
- **THEN** 将其归类为 `secondary` 角色
- **AND** 设置 group 为 `neutral`

#### Scenario: 推断 Ghost 角色

- **WHEN** 按钮的 background-color 为透明
- **THEN** 将其归类为 `ghost` 角色
- **AND** 设置 group 为 `transparent`

### Requirement: 背景颜色角色推断

系统 SHALL 根据元素的用途和样式推断背景颜色角色。

#### Scenario: 推断 Page Background

- **WHEN** 元素的 class 包含 `background`, `bg`, `canvas`
- **AND** 元素为 body/html/main
- **THEN** 将其归类为 `background` 角色

#### Scenario: 推断 Card Background

- **WHEN** 元素的 class 包含 `card`, `surface`, `panel`
- **THEN** 将其归类为 `card` 角色
- **AND** 设置 group 为 `surface`

### Requirement: 边框颜色角色推断

系统 SHALL 推断边框颜色角色。

#### Scenario: 推断 Border 角色

- **WHEN** 元素的 border 颜色非透明
- **THEN** 将其归类为 `border` 角色
- **AND** 设置 group 为 `neutral`

#### Scenario: 推断 Divider 角色

- **WHEN** 元素为 `<hr>` 或 class 包含 `divider`, `separator`
- **THEN** 将其归类为 `border` 角色

### Requirement: 颜色名称推断

系统 SHALL 根据颜色值推断语义名称。

#### Scenario: 深色推断

- **WHEN** 颜色的亮度 (L) < 20%
- **THEN** 推断名称为 `dark` 或 `black`

#### Scenario: 浅色推断

- **WHEN** 颜色的亮度 (L) > 90%
- **THEN** 推断名称为 `white` 或 `light`

#### Scenario: 主色推断

- **WHEN** 按钮中出现频率最高的非灰白色
- **THEN** 推断名称为 `primary`

### Requirement: Role 描述生成

系统 SHALL 为每个推断的颜色角色生成描述文字。

- **WHEN** 生成颜色 token
- **THEN** 根据 group 和名称生成描述
- **AND** 格式为 `<Role> for <usage>`，如 "Primary brand color for buttons"
