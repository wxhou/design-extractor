## ADDED Requirements

### Requirement: CSS 证据压缩

系统 SHALL 将提取的 CSS 数据（颜色、字体、间距、圆角、阴影、CSS 变量、断点）压缩为结构化的文本格式，作为 LLM 的输入。

#### Scenario: 完整 CSS 证据输出
- **WHEN** 完成 CSS 提取后
- **THEN** 生成包含以下信息的结构化文本：颜色（hex + frequency + contexts）、字体（family + fallback + weights）、字号层级（size + context）、间距（token + value）、圆角（value + role）、阴影（value + count）、CSS 变量（name + value）、断点（width + range）

### Requirement: 多模态 LLM 设计系统分析

系统 SHALL 将页面截图 + CSS 证据文本发送给多模态 LLM，进行完整的设计系统分析，不再局限于仅做颜色命名。

#### Scenario: 完整分析生成
- **WHEN** 多模态 LLM 调用成功
- **THEN** LLM 输出包含以下信息：
  - 语义角色颜色名（如 action-text, content-text, surface-primary, border-border）
  - typography 角色映射（hero-heading, body-default, label-medium 等）+ 完整 Typography 对象
  - 设计哲学描述（Overview section 内容）
  - Do's & Don'ts（3-5 条设计规范）
  - Agent Prompt 指南（示例提示词）

### Requirement: 降级回退

当多模态 LLM 调用失败或不可用时，系统 SHALL 回退到现有规则推断 + MiniMax 颜色命名路径，保证服务不中断。

#### Scenario: LLM 不可用
- **WHEN** MiniMax API 返回错误或超时
- **THEN** 输出使用纯规则推断的颜色命名、不包含 LLM 生成的角色映射和 Do's & Don'ts

### Requirement: 截图压缩

发送给 LLM 的截图 SHALL 被压缩为 JPEG 80% quality，最大宽度 1024px，以减少 token 消耗。

#### Scenario: 大页面截图
- **WHEN** 页面高度超过 3000px
- **THEN** 截图压缩为 JPEG 80% quality，最长边不超过 1024px