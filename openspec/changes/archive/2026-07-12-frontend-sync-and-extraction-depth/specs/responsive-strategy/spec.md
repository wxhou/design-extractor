## ADDED Requirements

### Requirement: 响应式策略 LLM 输出

系统 SHALL 在 LLM system prompt 中增加响应式策略输出指令，基于断点数据生成响应式设计策略描述。LLM 输出 JSON 中新增以下字段：

```json
{
  "responsiveStrategy": "Mobile-first: 从 640px 到 1280px 逐步增加间距和列数",
  "breakpointRoles": {
    "mobile": "max:640px",
    "tablet": "max:768px",
    "desktop": "max:1024px",
    "wide": "max:1280px"
  }
}
```

#### Scenario: 多断点页面
- **WHEN** LLM 分析时收到 4 个及以上断点数据
- **THEN** 输出包含 `responsiveStrategy` 和 `breakpointRoles` 字段

### Requirement: 断点角色标注

系统 SHALL 在 LLM 输出中对断点标注角色名称（mobile / tablet / desktop / wide）。

#### Scenario: 断点角色输出
- **WHEN** LLM 分析断点数据
- **THEN** 输出将断点映射为角色，如 "mobile: max:640px, tablet: max:768px, desktop: max:1024px, wide: max:1280px"