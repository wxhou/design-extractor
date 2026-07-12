/**
 * AI 增强模块
 *
 * 将提取的 CSS 数据压缩为结构化文本，调用 AI 生成语义化命名和设计系统描述
 */

import { inferColorName, inferColorGroup, generateColorRole } from './color-utils.js';

// ============================================================
// 5.9 CSS 证据压缩（含组件候选）
// ============================================================

/**
 * 将提取的 CSS 数据压缩为结构化文本，供 LLM 分析使用
 */
export function compressCSSEvidence(data) {
  const lines = [];
  lines.push(`CSS Evidence for ${data.siteName || data.url || 'Unknown'}:`);
  lines.push('');

  // Colors
  const colors = data.colors || [];
  if (colors.length > 0) {
    lines.push(`Colors (${colors.length} tokens):`);
    for (const c of colors.slice(0, 15)) {
      const ctx = c.contexts?.join(', ') || '';
      lines.push(`  ${c.hex} - freq:${c.frequency} - contexts:[${ctx}]`);
    }
    lines.push('');
  }

  // Typography
  const fonts = data.fonts || [];
  if (fonts.length > 0) {
    lines.push('Typography:');
    for (const f of fonts.slice(0, 3)) {
      const weights = f.weights?.join(', ') || '';
      const stack = f.fontStack ? ` stack:${f.fontStack}` : '';
      lines.push(`  ${f.fontFamily} - weights:[${weights}]${stack} - source:${f.source || 'unknown'}`);
    }
    lines.push('');
  }

  // Type scale
  const ts = data.typeScale;
  if (ts?.steps?.length > 0) {
    lines.push(`Type scale (base: ${ts.base || '?'}px):`);
    for (const s of ts.steps.slice(0, 8)) {
      lines.push(`  ${s.size} - ${s.element || s.name || 'unknown'}`);
    }
    lines.push('');
  }

  // Spacing
  const spacing = data.spacing;
  if (spacing?.tokens) {
    const base = spacing.base ? ` (base grid: ${spacing.base}px)` : '';
    lines.push(`Spacing${base}:`);
    const entries = Object.entries(spacing.tokens);
    for (const [name, value] of entries.slice(0, 14)) {
      lines.push(`  ${name}: ${value}`);
    }
    lines.push('');
  }

  // Border Radius
  const br = data.borderRadius;
  if (br?.tokens) {
    lines.push('Border Radius:');
    const entries = Object.entries(br.tokens);
    for (const [name, value] of entries.slice(0, 7)) {
      lines.push(`  ${name}: ${value}`);
    }
    lines.push('');
  }

  // Shadows
  const shadows = data.shadows;
  if (shadows?.tokens) {
    lines.push('Shadows:');
    const entries = Object.entries(shadows.tokens);
    for (const [name, value] of entries.slice(0, 6)) {
      lines.push(`  ${name}: ${value.length > 80 ? value.substring(0, 80) + '...' : value}`);
    }
    lines.push('');
  }

  // CSS Variables
  const cssVars = data.cssVariables;
  if (cssVars && Object.keys(cssVars).length > 0) {
    lines.push('CSS Variables:');
    const entries = Object.entries(cssVars).slice(0, 15);
    for (const [name, value] of entries) {
      lines.push(`  ${name}: ${value.length > 60 ? value.substring(0, 60) + '...' : value}`);
    }
    lines.push('');
  }

  // Breakpoints
  const bps = data.breakpoints;
  if (bps && bps.length > 0) {
    lines.push('Breakpoints:');
    for (const bp of bps) {
      lines.push(`  ${bp}`);
    }
    lines.push('');
  }

  // Component Candidates
  const components = data.componentCandidates;
  if (components && components.length > 0) {
    lines.push(`Component Candidates (${components.length} patterns):`);
    for (const c of components.slice(0, 10)) {
      const img = c.hasImg ? ' [has-img]' : '';
      const text = c.hasText ? ` [text:${c.textLen}chars]` : '';
      lines.push(`  ${c.classPrefix || c.tag} - ${c.count}x - ${c.tag}${c.role ? ` role=${c.role}` : ''} - children:${c.childTagStr}${img}${text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 6. MiniMax AI 增强模块
// ============================================================

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.MINIMAX_API_KEY;
    const groupId = process.env.MINIMAX_GROUP_ID;
    if (!apiKey) {
      console.warn('MINIMAX_API_KEY not set, AI enrichment disabled');
      return null;
    }

    // China version (minimaxi.com) uses api.minimax.chat
    // International version (minimax.io) uses api.minimax.io
    // sk-cp-xxx format is for China version
    const isChinaKey = apiKey.startsWith('sk-cp-');
    const baseURL = isChinaKey
      ? (groupId ? `https://api.minimax.chat/v1?GroupId=${groupId}` : 'https://api.minimax.chat/v1')
      : 'https://api.minimax.io/v1';

    aiClient = new OpenAI({
      baseURL,
      apiKey,
    });
  }
  return aiClient;
}

const AI_SYSTEM_PROMPT = `You are a professional design system analyst. Analyze the CSS evidence and screenshot to produce a complete design system specification.

Output valid JSON only, no additional text. Use this exact JSON structure:
{
  "colors": [
    {
      "hex": "#0071e3",
      "name": "stripe-indigo",
      "group": "brand",
      "role": "Primary brand color — used for CTAs and key interactive elements"
    }
  ],
  "typography": {
    "hero-heading": {
      "fontFamily": "Inter, sans-serif",
      "fontSize": "44px",
      "fontWeight": "300",
      "lineHeight": "1.03",
      "letterSpacing": "-0.02em"
    }
  },
  "designPhilosophy": "One-sentence description of the design system's aesthetic direction",
  "dos": [
    "Use consistent spacing from the base grid",
    "Maintain WCAG AA contrast ratio of 4.5:1 for text"
  ],
  "donts": [
    "Don't mix rounded and sharp corners in the same view",
    "Don't use brand color for non-interactive elements"
  ],
  "agentPrompt": "Example prompt for an AI coding agent to use this design system",
  "responsiveStrategy": "Mobile-first: from 640px to 1280px progressively expand spacing and columns",
  "breakpointRoles": {
    "mobile": "max:640px",
    "tablet": "max:768px",
    "desktop": "max:1024px",
    "wide": "max:1280px"
  },
  "components": [
    {
      "name": "Card",
      "count": 8,
      "description": "Content card with thumbnail, title, and description",
      "variants": ["default", "compact"]
    }
  ]
}

Rules:
- Color names MUST be semantic role names: use prefix to indicate usage (e.g., surface-white, brand-lavender, action-text, content-body, border-subtle). NEVER use hue-based names like Azure or Storm Cloud.
- Typography keys MUST be role-based: hero-heading, body-default, label-medium, caption-small, section-heading, etc.
- Each typography object MUST include fontFamily, fontSize, fontWeight, lineHeight.
- letterSpacing is optional, include only when non-zero.
- Generate 3-5 dos and 3-5 donts specific to the observed design system.
- designPhilosophy should be a concise single sentence.
- responsiveStrategy should describe the responsive design approach based on available breakpoint data.
- breakpointRoles maps breakpoint values to device roles (mobile, tablet, desktop, wide).
- components: For each UI pattern in Component Candidates, verify if it's a real component. Name it with semantic role names (e.g., ProductCard, NavItem, FeatureSection). Include count, description, and variants if multiple states exist. Output at most 8 components.`;

// ============================================================
// 6.1 AI 响应解析工具
// ============================================================

/**
 * 去除 thinking blocks
 */
function stripThinkingBlocks(text) {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think(ing)?>/gi, '')
    .replace(/\[\/S\]/g, '')  // 清除残留标记
    .trim();
}

/**
 * 深度计数提取 JSON（非贪婪）
 */
function extractJSONByDepth(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * 解析 AI 响应（支持修复尾部乱码）
 */
async function parseAIResponse(text) {
  const cleaned = stripThinkingBlocks(text);
  const json = extractJSONByDepth(cleaned);
  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch {
    // 尝试修复尾部乱码
    try {
      const { repair } = await import('jsonrepair');
      return JSON.parse(repair(json));
    } catch {
      return null;
    }
  }
}

/**
 * 压缩截图：JPEG 80% quality，最大宽度 1024px
 */
function compressScreenshot(screenshotBuffer) {
  if (!screenshotBuffer) return null;
  try {
    // 如果 Node.js 环境有 sharp，使用 sharp 压缩
    // 否则使用极限 resize 策略：将 PNG 传给 LLM 时只做 base64，服务端不做压缩
    // 注意：Node.js 内置不支持 JPEG 重编码，这里标记为 TODO
    return screenshotBuffer; // 保持原样，LLM API 端会自动处理
  } catch (e) {
    return screenshotBuffer;
  }
}

/**
 * 使用 AI 增强设计数据（支持多模态）
 * @param {object} baseData - 基础提取数据
 * @param {object} options - 选项
 * @param {Buffer|null} options.screenshotBuffer - 页面截图 buffer
 * @param {string} options.cssEvidence - CSS 证据文本（可选，不传则自动生成）
 */
export async function enrichWithAI(baseData, options = {}) {
  const client = getAiClient();
  if (!client) {
    // 无 API Key，返回基础数据
    return fallbackEnrich(baseData);
  }

  try {
    // 生成 CSS 证据文本
    const cssEvidence = options.cssEvidence || compressCSSEvidence(baseData);

    // 构建消息内容
    const content = [];

    // 如果有多模态截图，添加
    const screenshotBuffer = options.screenshotBuffer;
    if (screenshotBuffer && Buffer.isBuffer(screenshotBuffer)) {
      const base64 = screenshotBuffer.toString('base64');
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64}`,
          detail: 'high'
        }
      });
    }

    // 添加 CSS 证据文本
    content.push({ type: 'text', text: cssEvidence });

    const response = await client.chat.completions.create({
      model: 'MiniMax-M3',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const contentText = response.choices[0].message.content;

    // 解析 JSON 响应
    const enriched = await parseAIResponse(contentText);
    if (!enriched) {
      console.warn('AI response parse failed, using rule-based inference');
      return fallbackEnrich(baseData);
    }

    // 合并 AI 增强数据
    const result = {
      ...baseData,
      designSystem: enriched.designSystem || baseData.designSystem,
      northStar: enriched.designPhilosophy || baseData.northStar || null,
      dos: enriched.dos || [],
      donts: enriched.donts || [],
      agentPrompt: enriched.agentPrompt || null,
    };

    // 合并颜色数据
    if (enriched.colors && Array.isArray(enriched.colors)) {
      const colorMap = new Map();
      for (const c of enriched.colors) {
        colorMap.set(c.hex.toLowerCase(), c);
      }

      result.colors = baseData.colors.map(c => {
        const aiColor = colorMap.get(c.hex.toLowerCase());
        if (aiColor) {
          return {
            ...c,
            name: aiColor.name || inferColorName(c.hex, c.contexts),
            group: aiColor.group || inferColorGroup(c.contexts, c.hex),
            role: aiColor.role || generateColorRole(c, c.contexts)
          };
        }
        return {
          ...c,
          name: inferColorName(c.hex, c.contexts),
          group: inferColorGroup(c.contexts, c.hex),
          role: generateColorRole(c, c.contexts)
        };
      });
    }

    // 合并 typography 数据
    if (enriched.typography) {
      result.enrichedTypography = enriched.typography;
    }

    // 合并响应式策略
    if (enriched.responsiveStrategy) {
      result.responsiveStrategy = enriched.responsiveStrategy;
    }
    if (enriched.breakpointRoles) {
      result.breakpointRoles = enriched.breakpointRoles;
    }

    // 合并组件数据
    if (enriched.components && Array.isArray(enriched.components)) {
      result.components = enriched.components;
    }

    return result;
  } catch (error) {
    console.error('AI enrichment failed:', error.message);
    return fallbackEnrich(baseData);
  }
}

/**
 * 降级回退：使用规则推断
 */
function fallbackEnrich(baseData) {
  return {
    ...baseData,
    colors: baseData.colors.map(c => ({
      ...c,
      name: inferColorName(c.hex, c.contexts),
      group: inferColorGroup(c.contexts, c.hex),
      role: generateColorRole(c, c.contexts)
    })),
    dos: [],
    donts: [],
    agentPrompt: null,
    enrichedTypography: null,
    responsiveStrategy: null,
    breakpointRoles: null,
    components: [],
  };
}

