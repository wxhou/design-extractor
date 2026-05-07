## ADDED Requirements

### Requirement: DOM 元素遍历

系统 SHALL 使用 CSS 选择器遍历页面上的常见元素类型，提取其 computed style。

#### Scenario: 遍历按钮元素

- **WHEN** 系统需要提取按钮颜色
- **THEN** 使用选择器 `button:not(:disabled), [role="button"]` 获取所有按钮元素

#### Scenario: 遍历输入框元素

- **WHEN** 系统需要提取输入框样式
- **THEN** 使用选择器 `input:not([type="hidden"]), textarea` 获取所有输入元素

#### Scenario: 遍历卡片/容器元素

- **WHEN** 系统需要提取容器背景色
- **THEN** 使用选择器 `[class*="card"], [class*="container"], main > div` 获取容器元素

#### Scenario: 遍历导航元素

- **WHEN** 系统需要提取导航栏颜色
- **THEN** 使用选择器 `nav, header, [class*="nav"]` 获取导航元素

#### Scenario: 遍历背景元素

- **WHEN** 系统需要提取页面背景色
- **THEN** 使用选择器 `body, html, main, [class*="background"]` 获取背景元素

### Requirement: Computed Style 读取

系统 SHALL 从每个元素的 computed style 中提取以下属性：

- **WHEN** 提取按钮颜色
- **THEN** 读取 `window.getComputedStyle(element).backgroundColor`
- **AND** 读取 `window.getComputedStyle(element).color` (文字颜色)
- **AND** 读取 `window.getComputedStyle(element).borderColor`

#### Scenario: 解析 rgba 格式

- **WHEN** computed style 返回 `rgba(255, 255, 255, 1)`
- **THEN** 转换为十六进制格式 `#ffffff`

#### Scenario: 解析 rgb 格式

- **WHEN** computed style 返回 `rgb(99, 102, 241)`
- **THEN** 转换为十六进制格式 `#635bf1`

### Requirement: 元素采样限制

系统 SHALL 限制每种元素类型的采样数量，避免性能问题。

- **WHEN** 遍历元素时
- **THEN** 每种选择器最多采样 10 个元素
- **AND** 跳过不可见元素（`display: none`, `visibility: hidden`）
