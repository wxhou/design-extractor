## ADDED Requirements

### Requirement: 示例 DESIGN.md 输出预览

系统 SHALL 在 Hero 区域下方、卡片网格上方展示一个可折叠的示例 DESIGN.md 输出面板。

#### Scenario: 初始加载状态

- **WHEN** 用户首次访问首页
- **THEN** 示例面板默认折叠，显示标题 "示例输出" 和展开箭头

#### Scenario: 用户展开示例

- **WHEN** 用户点击示例面板标题或展开按钮
- **THEN** 面板展开显示 YAML frontmatter 和关键 token 预览

#### Scenario: 用户收起示例

- **WHEN** 用户再次点击已展开的面板标题
- **THEN** 面板折叠回初始状态

#### Scenario: 示例内容格式

- **WHEN** 示例面板展开时
- **THEN** 显示包含以下内容的格式：
  - YAML frontmatter (site, url, extracted)
  - colors section (3-5 个示例色值)
  - typography section (字体名称和字重)
  - spacing section (2-3 个示例间距值)
