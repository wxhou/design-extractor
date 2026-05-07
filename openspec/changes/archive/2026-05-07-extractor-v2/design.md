## Context

当前 `extractor.js` 的提取逻辑：
1. 用 Playwright 打开 URL
2. 下载 CSS 文件
3. 用正则匹配 `--token: value` 格式的 CSS 变量

**问题**：大多数网站没有使用 CSS 变量定义颜色，颜色直接写在 `style="background: #xxx"` 或 `<button class="bg-black">` 中。

**目标**：从渲染后的 DOM 读取元素的 computed style，提取实际使用的颜色和样式。

## Goals / Non-Goals

**Goals:**
- 从任意网站提取有意义的颜色（即使没有 CSS 变量）
- 为每个颜色推断语义角色（primary、background、border 等）
- 生成 refero 风格的结构化输出
- 保持提取速度 < 30 秒

**Non-Goals:**
- 不解析图片中的颜色（截图分析）
- 不保证 100% 准确（设计工具提取必有误差）

## Decisions

### 1. Computed Style vs CSS 文件

**Decision:** 读取 DOM 元素的 computed style，而非解析 CSS 文件

**Rationale:**
- CSS 文件可能几万行，但页面只用了几种颜色
- computed style 直接反映页面实际渲染的样式
- 元素类型（如 `<button>`）提供了语义上下文

**Alternative considered:** 解析 CSS + DOM → 更复杂且收益不大

### 2. 元素选择策略

**Decision:** 针对常见元素类型使用 CSS 选择器批量提取

**元素类型和选择器:**
```javascript
const ELEMENT_SELECTORS = {
  // 主色调按钮
  buttons: 'button:not(:disabled), [role="button"], .btn, button[class*="primary"]',
  // 输入框
  inputs: 'input:not([type="hidden"]), textarea, [contenteditable]',
  // 卡片/容器
  cards: '[class*="card"], [class*="container"], main > div, section > div',
  // 导航
  nav: 'nav, header, [class*="nav"], [class*="menu"]',
  // 背景
  backgrounds: 'body, html, main, [class*="background"]',
  // 边框
  borders: '[class*="border"], [style*="border"]',
};
```

**Rationale:** 选择器覆盖常见 UI 框架（Taliwind CSS、Bootstrap、Material 等）

### 3. 语义推断规则

**Decision:** 根据元素类型 + 样式特征推断颜色角色

```
颜色角色推断规则:
- <button> 的 background-color → primary (如果非白非灰)
- <input> 的 background-color → input
- border 颜色 → border
- 半透明背景 → overlay/overlay-light
- 深色背景 (#000, #1a1a1a) → dark
- 浅色背景 (#fff, #f5f5f5) → white/neutral
- 带 red/blue/green 等名字的 → 对应语义
```

### 4. 颜色聚类

**Decision:** 使用 RGB 距离进行聚类，合并相似颜色

```javascript
function colorDistance(c1, c2) {
  // RGB 欧几里得距离
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// 距离 < 20 的视为相似颜色，保留主色
```

### 5. 输出格式

**Decision:** 同时输出 Markdown（DESIGN.md）和结构化数据

```javascript
return {
  success: true,
  siteName: string,
  designMd: string,      // Markdown 格式（兼容现有）
  colors: [{             // 结构化颜色
    name: string,        // AI 生成: "Storm Cloud", "Azure"
    hex: string,        // "#635BFF"
    role: string,       // AI 生成: "Primary CTA button fill..."
    group: string,      // "brand" | "accent" | "neutral"
  }],
  fonts: [{              // 结构化字体
    fontFamily: string, // "Inter"
    weights: number[],  // [400, 500, 600]
    source: string,     // "google" | "system" | "custom"
  }],
  typography: {...},      // 字体层级
  gradient: [...],       // 渐变
  typeScale: {...},     // 字号层级
  northStar: string,    // AI 生成: 设计哲学
};
```

### 6. MiniMax AI 增强层

**Decision:** 使用 MiniMax M2.7 生成语义化命名和设计哲学

**Rationale:**
- 规则推断的命名（如 "Blue 45"）缺乏个性
- AI 可以生成 refero 级别的诗意命名（如 "Storm Cloud", "Azure"）
- north_star 设计哲学需要 AI 才能准确表达

**API 配置:**
```javascript
const minimaxClient = new OpenAI({
  baseURL: 'https://api.minimax.io/v1',
  apiKey: process.env.MINIMAX_API_KEY,
  model: 'MiniMax-M2.7',
});
```

**Prompt 设计:**

```javascript
const SYSTEM_PROMPT = `你是一个专业的设计系统专家。根据提取的颜色数据，
生成语义化的颜色命名和设计哲学描述。

要求：
- 颜色命名使用简洁优雅的英文词汇（如 Azure, Storm Cloud, Obsidian）
- 避免使用 "Primary", "Color 1" 等通用命名
- 描述要具体说明颜色的使用场景和视觉效果
- north_star 用一句话描述整体设计风格（30-50 字）

输出 JSON 格式:
{
  "colors": [
    {
      "hex": "#0071e3",
      "name": "Azure",
      "group": "brand",
      "role": "Primary CTA button fill — the sole permission-to-act color on the entire page"
    }
  ],
  "northStar": "Gallery wall at natural light — enormous type casts shadows on a white surface, color enters only as product"
}`;

const USER_PROMPT = `网站名称: {siteName}
网站 URL: {url}

提取的颜色（按使用频率排序）:
{colorsList}

元素上下文分布:
{contextsList}

字号层级:
{typeScale}

请生成语义化命名和设计哲学。`;
```

**成本估算:**
- 输入: ~500 tokens（提取的颜色数据）
- 输出: ~300 tokens（颜色命名 + north_star）
- 单次调用: ~$0.008（M2.7 价格约为 Claude 的 1/30）

## Risks / Trade-offs

- [Risk] 某些网站大量使用 CSS 类名如 `.bg-red-500`，颜色是间接的 → **Mitigation**: 选择器优先，同时读取 class 名
- [Risk] 提取的颜色太多（上百个） → **Mitigation**: 聚类后最多保留 20 个主色
- [Risk] 语义推断可能不准确 → **Mitigation**: 提供 role 为空的能力，UI 层可覆盖
- [Risk] 性能：遍历大量元素可能慢 → **Mitigation**: 限制每种元素最多 10 个样本

## Migration Plan

1. **开发**: `src/extractor-v2.js` 新文件实现新逻辑
2. **并行**: 保留 `extractor.js`，通过 feature flag 切换
3. **测试**: 用多个网站（Stripe、百度、GitHub）验证效果
4. **上线**: 切换 API 使用新实现
5. **回滚**: feature flag 切回旧实现

## Open Questions

- ~~是否需要支持暗色模式检测？~~ → 暂不支持
- ~~渐变颜色如何提取和表示？~~ → 提取 type + colors 数组
- ~~是否需要提取阴影（box-shadow）作为 token？~~ → 暂不支持
- ~~是否使用 AI 辅助推断？~~ → **已决定使用 MiniMax M2.7**
