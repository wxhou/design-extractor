## 1. 前端同步 (A)

- [x] 1.1 重写 `getDesignMd()` 与后端 `generateDesignMd()` 对齐，使用 8 个 canonical sections
- [x] 1.2 详情页展示 CSS 变量列表（在新增 section 中）
- [x] 1.3 详情页展示响应式断点（在新增 section 中）
- [x] 1.4 详情页展示 spacing base grid
- [x] 1.5 详情页展示 Do's & Don'ts（在专属 section 中）
- [x] 1.6 详情页展示 Agent Prompt Guide（在右面板显示）
- [ ] 1.7 验证：DESIGN.md 标签页内容与 API 响应一致

## 2. Layout 深度检测 (B1)

- [x] 2.1 实现 `extractLayout()` 函数：采集 grid 容器参数（grid-template-columns, gap, 列数）、flex 容器参数（direction, gap, align）、容器 max-width
- [x] 2.2 集成到 `extractDesignTokens` 主流程
- [x] 2.3 更新 `generateDesignMd` 的 Layout section 包含 grid/flex/宽度信息
- [ ] 2.4 验证：抽取 Tailwind/Linear 等网站，确认 Layout 信息正确（待联调或部署到浏览器环境测试）

## 3. 响应式策略 (B2)

- [x] 3.1 修改 LLM system prompt：增加响应式策略输出指令
- [x] 3.2 在 LLM 响应解析中提取 responsive strategy 字段
- [x] 3.3 更新 `generateDesignMd` 的 Overview 或 Layout section 包含响应式策略描述
- [ ] 3.4 验证：带 LLM 提取多断点网站，确认响应式策略描述合理

## 4. 组件检测 (B3)

- [x] 4.1 实现 `extractComponents()` — 采集阶段：遍历 DOM 按选择器频率聚类候选组件
- [x] 4.2 实现组件去重和相似度合并逻辑
- [x] 4.3 扩展 `compressCSSEvidence()` 包含组件候选数据，供 LLM 验证使用
- [x] 4.4 集成到 `extractDesignTokens` 主流程
- [x] 4.5 扩展 LLM system prompt：增加组件验证和命名指令
- [x] 4.6 在 LLM 响应解析中提取 components 字段
- [x] 4.7 更新 `generateDesignMd` 的 Components section 填充检测结果
- [ ] 4.8 验证：抽取常见组件库站点（如 shadcn/ui 示例页），确认组件识别正确

## 5. 集成与回归

- [ ] 5.1 端到端测试：提取 3 个不同风格网站，检查全部输出完整度
- [ ] 5.2 回归测试：确认现有功能不破坏
- [ ] 5.3 降级路径验证：--no-ai 模式下规则推断正常工作

## 验证任务

- [ ] 2.4 验证：抽取 Tailwind/Linear 等网站，确认 Layout 信息正确
- [ ] 3.4 验证：带 LLM 提取多断点网站，确认响应式策略描述合理
- [ ] 4.8 验证：抽取常见组件库站点（如 shadcn/ui 示例页），确认组件识别正确
- [ ] 1.7 验证：DESIGN.md 标签页内容与 API 响应一致