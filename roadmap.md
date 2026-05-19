# Design Extractor Roadmap

## 1. 提取能力增强

| 状态 | 功能 | 描述 |
|-----|------|------|
| ✓ | 颜色 | 提取颜色值、上下文、频率 |
| ✓ | 字体 | 字体族、字重、来源 |
| ✓ | 字号 | 类型比例、基准大小 |
| ✓ | 渐变 | 线性渐变、颜色数组 |
| ✓ | 间距 | Spacing tokens (4px/8px/16px 体系) |
| ✓ | 阴影 | Elevation/Shadows (box-shadow, drop-shadow) |
| ✓ | 圆角 | Border radius tokens |
| ✓ | 动效 | Animation, transition timing |
| ○ | 动效 | Animation, transition timing |
| ○ | 图标 | Icon style, size tokens |
| ○ | 组件 | Component inventory |
| ○ | 布局 | Grid, flex patterns |
| ○ | 品牌色 | Primary, secondary, accent color derivation |

---

## 2. 卡片列表页优化

| 状态 | 功能 | 描述 |
|-----|------|------|
| ✓ | 搜索 | 前端搜索 |
| ○ | 服务端搜索 | API 级别搜索，减少传输 |
| ○ | 分页 | 大数据量分页加载 |
| ○ | 无限滚动 | Infinite scroll |
| ○ | 分类筛选 | Category filter |
| ○ | 排序 | 按时间、按名称排序 |

---

## 3. 详情页导出优化

| 状态 | 功能 | 描述 |
|-----|------|------|
| ✓ | DESIGN.md | Markdown 格式 |
| ✓ | Tailwind v4 | @theme 指令格式 |
| ✓ | CSS Variables | CSS 自定义属性 |
| ✓ | DTCG JSON | Design Tokens Community Group 标准 |
| ✓ | 剪贴板复制 | 一键复制代码 |
| ✓ | Style Dictionary | Style Dictionary 配置文件 |
| ○ | Figma 格式 | Figma 变量导出 |
| ○ | AI 设计建议 | 基于设计 tokens 的 AI 建议 |

---

## 4. Figma 集成

| 状态 | 功能 | 描述 |
|-----|------|------|
| ✓ | Figma URL 提取 | 输入 Figma 文件 URL |
| ✓ | Tokens 对比 | 网站 tokens vs Figma 设计系统 |
| ✓ | 差异展示 | 匹配率、缺失、未定义 tokens |
| ○ | Figma Variables | 支持明暗主题模式 |
| ○ | 自动同步 | 设计系统变更通知 |

---

## 5. 截图持久化

| 方案 | 状态 | 描述 |
|-----|------|------|
| ✓ | Base64 存入数据库 | 数据自包含，永不丢失 |
| ○ | JPEG 压缩 | 减少 60% 大小 |

---

## 6. 国际化

| 状态 | 语言 | 描述 |
|-----|------|------|
| ✓ | 中文 | 完整中文支持 |
| ✓ | English | 完整英文支持 |
| ○ | 日本語 | 日语支持 |
| ○ | 한국어 | 韩语支持 |
| ○ | 语言自动检测 | Browser locale detection |
| ○ | SEO 多语言 | hreflang 标签 |

---

## 7. 性能和体验

| 状态 | 功能 | 描述 |
|-----|------|------|
| ○ | 首屏加载优化 | Critical CSS, code splitting |
| ✓ | 骨架屏 | Loading states skeleton (详情页 + 列表页) |
| ✓ | 卡片懒加载 | Image lazy loading |
| ○ | 图片压缩 | Next.js Image optimization |
| ○ | 离线支持 | PWA manifest |
| ✓ | 移动端适配 | Responsive design |

---

## Legend

- ✓ Done
- ● In Progress
- ○ Planned

---

*Last updated: 2026-05-19*
