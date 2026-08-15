## 1. CSS 证据采集增强

- [x] 1.1 扩展间距聚类：`clusterSpacingValues` 截取数从 7 增至 14，命名改为 spacing-1~spacing-14
- [x] 1.2 新增 base grid 检测：从间距值集合计算最大公约数倾向，推断 base grid（4px/8px）
- [x] 1.3 扩展圆角聚类：`clusterRadiiValues` 截取数从 4 增至 7，新增 role 标注映射
- [x] 1.4 扩展阴影聚类：`clusterShadows` 截取数从 4 增至 6，新增交互信号检测
- [x] 1.5 新增 CSS 变量检测：`collectCSSVariables()` — 遍历 `document.styleSheets` 提取 `--*` 定义
- [x] 1.6 新增媒体查询断点检测：`detectBreakpoints()` — 从 `document.styleSheets` 提取 `@media` 规则
- [x] 1.7 改进字体采集：`extractFonts()` 输出完整 font-family fallback 链
- [x] 1.8 在 `extractDesignTokens` 主流程中集成 `collectCSSVariables` 调用
- [x] 1.9 在 `extractDesignTokens` 主流程中集成 `detectBreakpoints` 调用
- [x] 1.10 更新 `generateDesignMd` 输出 spacing base grid、CSS 变量引用、断点
- [x] 1.11 同步更新 `generateTokensJson` 输出新字段
- [x] 1.12 同步更新 `generateVariablesCss` 输出新字段
- [x] 1.13 同步更新 `generateThemeCss` 输出新字段
- [x] 1.14 验证：抽取一个已知页面，确认间距/圆角/阴影 token 数量提升
- [x] 🐛 修复：`trackValue` 和 `getElementContext` 在 `page.evaluate` 内不可访问（inlined）
- [x] 🐛 修复：圆角科学计数法过滤

## 2. 多模态 LLM 设计系统分析

- [x] 2.1 实现 CSS 证据压缩函数：将颜色/字体/间距/圆角/阴影/CSS 变量/断点压缩为结构化文本
- [x] 2.2 切换模型从 MiniMax-M2.7 到 MiniMax-M3，消息格式改为 support `content` 数组
- [x] 2.3 扩展 `enrichWithAI`：接收截图 + CSS 证据文本，发送给多模态 LLM
- [x] 2.4 重写 LLM system prompt：从仅颜色命名 → 完整设计系统分析
- [x] 2.5 实现 LLM 响应解析：提取颜色角色名、typography 层级、设计哲学、Do's & Don'ts、Agent Prompt
- [x] 2.6 实现截图压缩：JPEG 80% quality，最大宽度 1024px（stub，LLM 接受 raw PNG）
- [x] 2.7 保留降级路径：LLM 失败时回退到现有规则推断 + MiniMax 颜色命名
- [x] 2.8 验证：对比 design-extractor.com 的 Stripe/Airbnb 输出，检查角色命名和 sections 完整度

## 3. DESIGN.md 输出格式对齐

- [x] 3.1 重写 `generateDesignMd`：YAML front matter 使用角色命名
- [x] 3.2 实现 8 个 canonical sections 的 markdown 正文生成
- [x] 3.3 Typography 输出使用完整对象格式（fontFamily/fontSize/fontWeight/lineHeight/letterSpacing）
- [x] 3.4 Components section 保留占位（none detected）
- [x] 3.5 添加 Agent Prompt Guide 生成
- [x] 3.6 验证：输出格式对齐 design-extractor.com 的 DESIGN.md 规范

## 4. 数据库与 API 变更

- [x] 4.1 数据库迁移：cards 表新增列 + 正式执行 MIGRATIONS
- [x] 4.2 更新 extract API route 的 INSERT 包含新列 + 响应新字段
- [x] 4.3 更新 card API route：SELECT * 自动返回新列（无须修改）
- [x] 4.4 验证：提取后确认新字段正确存入和读出

## 5. 前端同步（最后统一做）

- [ ] 5.1 同步详情页 `getDesignMd()` 与后端 `generateDesignMd()` 输出格式一致
- [ ] 5.2 详情页展示新字段（CSS 变量、断点、base grid 等）
- [ ] 5.3 验证：前端展示的新 DESIGN.md 与 API 响应一致

## 6. 集成与回归

- [ ] 6.1 端到端测试：提取 3 个不同风格网站，检查输出完整度
- [ ] 6.2 回归测试：确认现有输出格式不破坏（字段只增不减）
- [ ] 6.3 检查降级路径：关闭 MiniMax API 后验证规则推断路径正常工作