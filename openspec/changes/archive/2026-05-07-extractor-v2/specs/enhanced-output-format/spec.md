## ADDED Requirements

### Requirement: 结构化颜色输出

系统 SHALL 输出结构化的颜色数组，包含 name、hex、role、group。

#### Scenario: 完整颜色 token

- **WHEN** 生成颜色 token
- **THEN** 输出格式为：
  ```javascript
  {
    name: "Primary",
    hex: "#635BFF",
    role: "Primary brand color for buttons and CTAs",
    group: "primary"
  }
  ```

#### Scenario: 无语义角色

- **WHEN** 颜色无法推断语义角色
- **THEN** 输出格式为：
  ```javascript
  {
    name: "Color 1",
    hex: "#AABBCC",
    role: "",
    group: "neutral"
  }
  ```

### Requirement: 结构化字体输出

系统 SHALL 输出结构化的字体数组。

#### Scenario: 完整字体 token

- **WHEN** 提取字体信息
- **THEN** 输出格式为：
  ```javascript
  {
    fontFamily: "Inter",
    weights: [400, 500, 600],
    source: "google", // or "system" or "custom"
    desc: "Inter (400, 500, 600)"
  }
  ```

#### Scenario: 系统字体

- **WHEN** 字体为系统字体 (system-ui, -apple-system 等)
- **THEN** 设置 source 为 `system`

### Requirement: 渐变检测和输出

系统 SHALL 检测并输出 CSS 渐变。

#### Scenario: 检测 linear-gradient

- **WHEN** 元素的 background 为渐变
- **THEN** 提取渐变类型和颜色
- **AND** 输出格式为：
  ```javascript
  {
    type: "linear-gradient",
    value: "linear-gradient(90deg, #fff 0%, #f0f0f0 100%)",
    colors: ["#ffffff", "#f0f0f0"]
  }
  ```

### Requirement: 字号层级输出

系统 SHALL 输出结构化的字号层级。

#### Scenario: 字号层级 token

- **WHEN** 提取字号信息
- **THEN** 输出格式为：
  ```javascript
  {
    name: "Scale",
    base: 16,
    steps: [
      { name: "h1", size: "2.5rem", px: 40 },
      { name: "h2", size: "2rem", px: 32 },
      { name: "body", size: "1rem", px: 16 },
      { name: "caption", size: "0.75rem", px: 12 }
    ]
  }
  ```

### Requirement: 完整 API 响应格式

系统 SHALL 返回包含所有结构化数据的完整响应。

#### Scenario: 成功响应

- **WHEN** 提取成功
- **THEN** 返回：
  ```javascript
  {
    success: true,
    siteName: "Stripe",
    designMd: "...", // Markdown 格式
    colors: [...],   // AI 增强的语义命名和描述
    fonts: [...],
    typography: {...},
    gradient: [...],
    typeScale: {...},
    northStar: "Gallery wall at natural light...", // AI 生成
    cssSize: 12345
  }
  ```

#### Scenario: 失败响应

- **WHEN** 提取失败
- **THEN** 返回：
  ```javascript
  {
    success: false,
    error: "Failed to load page: timeout"
  }
  ```

### Requirement: north_star 设计哲学生成

系统 SHALL 使用 AI 生成一句话设计哲学描述。

#### Scenario: north_star 生成

- **WHEN** 调用 MiniMax API
- **THEN** 传入颜色上下文和字号层级
- **AND** 生成 30-50 字的设计哲学描述
- **AND** 格式如: "Gallery wall at natural light — color enters only as product"
