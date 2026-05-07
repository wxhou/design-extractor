## ADDED Requirements

### Requirement: RGB 颜色解析

系统 SHALL 将各种格式的颜色值解析为 RGB 对象。

#### Scenario: 解析十六进制格式

- **WHEN** 输入 `#635BFF` 或 `#635bf1`
- **THEN** 解析为 `{ r: 99, g: 91, b: 255 }`

#### Scenario: 解析 rgb 格式

- **WHEN** 输入 `rgb(99, 91, 255)`
- **THEN** 解析为 `{ r: 99, g: 91, b: 255 }`

#### Scenario: 解析 rgba 格式

- **WHEN** 输入 `rgba(99, 91, 255, 1)`
- **THEN** 解析为 `{ r: 99, g: 91, b: 255 }`
- **AND** 忽略 alpha 通道

#### Scenario: 解析 hsl 格式

- **WHEN** 输入 `hsl(239, 84%, 68%)`
- **THEN** 转换为 RGB 后返回

### Requirement: 颜色距离计算

系统 SHALL 计算两个颜色之间的视觉距离。

#### Scenario: 计算欧几里得距离

- **WHEN** 比较两个 RGB 颜色
- **THEN** 使用公式 `sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)`

#### Scenario: 距离阈值为 20

- **WHEN** 两个颜色的距离 < 20
- **THEN** 视为相似颜色

### Requirement: 颜色聚类

系统 SHALL 对提取的颜色进行聚类，合并相似颜色。

#### Scenario: 合并相似颜色

- **WHEN** 两个颜色的距离 < 20
- **THEN** 保留饱和度/亮度更高的那个
- **AND** 从结果中移除较暗的颜色

#### Scenario: 保留差异颜色

- **WHEN** 两个颜色的距离 >= 20
- **THEN** 两者都保留在结果中

### Requirement: 颜色数量限制

系统 SHALL 限制最终输出的颜色数量。

- **WHEN** 聚类后的颜色数量 > 20
- **THEN** 保留以下优先级：
  1. 有语义角色推断的颜色 (primary, accent)
  2. 在多个元素中出现的颜色
  3. 饱和度高的颜色
- **AND** 其他颜色截断

### Requirement: 颜色分组

系统 SHALL 根据颜色的特征将其分组。

#### Scenario: 分组为 neutral

- **WHEN** 颜色的饱和度 < 10%
- **THEN** 分组为 `neutral`

#### Scenario: 分组为 primary

- **WHEN** 颜色被推断为 primary 角色
- **THEN** 分组为 `primary`

#### Scenario: 分组为 accent

- **WHEN** 颜色被推断为 accent 角色
- **THEN** 分组为 `accent`
