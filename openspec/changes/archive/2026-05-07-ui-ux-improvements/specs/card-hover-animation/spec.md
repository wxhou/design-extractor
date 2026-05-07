## ADDED Requirements

### Requirement: 卡片 Hover 动效

系统 SHALL 在用户鼠标悬停在样式卡片上时触发平滑的动效反馈。

#### Scenario: 卡片 Hover 进入

- **WHEN** 用户鼠标进入卡片区域
- **THEN** 卡片在 200ms 内向上平移 4px，同时阴影加深
- **AND** 过渡曲线为 ease-out

#### Scenario: 卡片 Hover 离开

- **WHEN** 用户鼠标离开卡片区域
- **THEN** 卡片在 200ms 内恢复原始位置和阴影
- **AND** 过渡曲线为 ease-out

#### Scenario: 尊重减少动画偏好

- **WHEN** 用户系统设置 `prefers-reduced-motion: reduce`
- **THEN** 卡片 hover 效果被禁用或简化为颜色变化

#### Scenario: 移动端触摸

- **WHEN** 用户在触摸设备上点击卡片
- **THEN** 动效不触发（hover 状态不适用于触摸设备）
