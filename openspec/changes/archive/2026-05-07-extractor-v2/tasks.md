## 1. 基础工具函数

- [x] 1.1 实现 RGB 颜色解析函数 (支持 hex、rgb、rgba、hsl 格式)
- [x] 1.2 实现颜色距离计算函数 (RGB 欧几里得距离)
- [x] 1.3 实现 HSL 转 RGB 函数
- [x] 1.4 实现颜色亮度/饱和度计算函数

## 2. 颜色聚类模块

- [x] 2.1 实现颜色聚类函数 (合并距离 < 20 的相似颜色)
- [x] 2.2 实现聚类优先级逻辑 (语义角色 > 出现频率 > 饱和度)
- [x] 2.3 实现颜色数量限制 (最多保留 20 个)
- [x] 2.4 实现颜色分组函数 (neutral/primary/accent/surface)

## 3. 语义角色推断模块

- [x] 3.1 实现按钮颜色角色推断 (primary/secondary/ghost)
- [x] 3.2 实现背景颜色角色推断 (background/card)
- [x] 3.3 实现边框颜色角色推断 (border/divider)
- [x] 3.4 实现颜色名称推断 (dark/white/primary)
- [x] 3.5 实现 Role 描述生成函数

## 4. DOM 元素遍历模块

- [x] 4.1 定义元素选择器配置 (buttons/inputs/cards/nav/backgrounds/borders)
- [x] 4.2 实现元素遍历函数 (限制每种最多 10 个样本)
- [x] 4.3 实现可见性过滤 (跳过 display:none/visibility:hidden)
- [x] 4.4 实现 computed style 读取函数

## 5. 渐变检测模块

- [x] 5.1 实现渐变类型检测 (linear-gradient/radial-gradient)
- [x] 5.2 实现渐变颜色提取函数
- [x] 5.3 实现渐变输出格式化

## 6. 字体提取模块

- [x] 6.1 实现字体族名提取函数
- [x] 6.2 实现字体来源检测 (google/system/custom)
- [x] 6.3 实现字体权重提取函数
- [x] 6.4 实现字号层级提取函数

## 7. 主提取器整合

- [x] 7.1 创建 extractor-v2.js 主文件
- [x] 7.2 实现主提取流程编排
- [x] 7.3 实现 Markdown 生成函数
- [x] 7.4 实现完整 API 响应格式组装

## 7.5 MiniMax AI 增强模块

- [x] 7.5.1 创建 ai-enricher.js 模块 (集成到 extractor-v2.js)
- [x] 7.5.2 实现 MiniMax API 客户端封装 (OpenAI 兼容)
- [x] 7.5.3 实现颜色命名 Prompt 生成函数
- [x] 7.5.4 实现 north_star Prompt 生成函数
- [x] 7.5.5 实现 AI 响应解析和错误处理
- [x] 7.5.6 集成 AI 增强到主提取流程

## 8. API 路由更新

- [x] 8.1 更新 analyze 路由使用 extractor-v2
- [x] 8.2 添加 feature flag 切换 (extractor-v1/v2)
- [x] 8.3 测试并验证输出格式

## 9. 测试验证

- [x] 9.1 用 Stripe 官网验证提取效果
- [x] 9.2 用百度验证提取效果 (无AI，纯规则)
- [x] 9.3 用 GitHub 验证提取效果
- [x] 9.4 对比 v1 和 v2 输出差异 (v2 显著更好)
- [x] 9.5 验证 AI 生成的命名质量 (语义化程度)
- [x] 9.6 验证 north_star 生成效果
