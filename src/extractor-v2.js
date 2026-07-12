#!/usr/bin/env node
/**
 * design-extractor-v2
 *
 * 从渲染后的 DOM 提取设计 tokens，配合 MiniMax AI 生成语义化命名
 */

import { chromium } from 'playwright';
import OpenAI from 'openai';

// ============================================================
// 0. URL 验证和规范化
// ============================================================

const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

/**
 * 验证输入是否为有效域名格式
 */
export function isValidDomain(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  // 去除协议后检查
  const withoutProtocol = trimmed.replace(/^https?:\/\//, '').split('/')[0];
  return DOMAIN_REGEX.test(withoutProtocol);
}

/**
 * 规范化 URL
 * - 去除首尾空白
 * - 转换为小写
 * - 添加 https:// 前缀
 * - 去除 www. 前缀（用于匹配）
 * - 去除尾随斜杠
 */
export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    return { full: null, normalized: null, valid: false };
  }

  let url = input.trim().toLowerCase();

  // 添加协议
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // 解析 URL
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { full: input.trim(), normalized: null, valid: false };
  }

  // 规范化 host（去除 www.）
  const normalizedHost = parsed.hostname.replace(/^www\./, '');
  // 去除尾随斜杠
  const fullUrl = parsed.origin + parsed.pathname.replace(/\/$/, '');

  return {
    full: fullUrl,
    normalized: normalizedHost,
    valid: true
  };
}

// ============================================================
// 1. 基础工具函数
// ============================================================

/**
 * 解析各种格式的颜色值为 RGB 对象
 */
export function parseColor(colorStr) {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' ||
      colorStr === 'initial' || colorStr === 'currentColor') {
    return null;
  }

  // Hex 格式
  const hexMatch = colorStr.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 8) {
      const alpha = parseInt(hex.slice(0, 2), 16) / 255;
      if (alpha < 0.05) return null;
      if (alpha > 0.95) hex = hex.slice(2);
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, hex: `#${hex.toLowerCase()}` };
  }

  // rgb/rgba 格式
  const rgbMatch = colorStr.match(/rgba?\s*\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    // 检查 alpha
    const alpha = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    if (alpha < 0.05) return null;

    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    const hex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    return { r, g, b, hex: `#${hex}` };
  }

  // hsl/hsla 格式
  const hslMatch = colorStr.match(/hsla?\s*\(\s*([\d.]+),\s*([\d.]+)%?,\s*([\d.]+)%?/);
  if (hslMatch) {
    const rgb = hslToRgb(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]),
      parseFloat(hslMatch[3])
    );
    return rgb;
  }

  return null;
}

/**
 * HSL 转 RGB
 */
export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  const hex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return { r, g, b, hex: `#${hex}` };
}

/**
 * 计算两个颜色之间的 RGB 欧几里得距离
 */
export function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * 计算相对亮度 (CSS relative luminance)
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getRelativeLuminance(hex) {
  const rgb = parseColor(hex);
  if (!rgb) return 0.5;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    const sRGB = v / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 计算颜色的亮度和饱和度
 */
export function getHslValues(hex) {
  const rgb = parseColor(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// ============================================================
// 1.5 间距、阴影、圆角提取辅助函数
// ============================================================

/**
 * 跟踪值及其上下文
 */
function trackValue(valuesMap, value, context) {
  if (!valuesMap.has(value)) {
    valuesMap.set(value, { count: 0, contexts: [] });
  }
  const entry = valuesMap.get(value);
  entry.count++;
  if (!entry.contexts.includes(context)) {
    entry.contexts.push(context);
  }
}

/**
 * 获取元素的语义上下文
 */
function getElementContext(el) {
  const tag = el.tagName?.toLowerCase() || '';
  const role = el.getAttribute('role') || '';
  const type = el.getAttribute('type') || '';
  const className = el.className || '';

  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'input') return type ? `input-${type}` : 'input';
  if (tag === 'img' || tag === 'svg') return 'image';
  if (tag === 'a') return 'link';
  if (tag.match(/^h[1-6]$/)) return 'heading';
  if (className.match(/card|modal|dropdown|menu|nav/i)) {
    return className.split(' ')[0];
  }
  return tag;
}

/**
 * 聚类间距值
 */
function clusterSpacingValues(rawValues) {
  const entries = Object.entries(rawValues);
  const sorted = entries.sort((a, b) => b[1].count - a[1].count);

  const tokens = {};
  const names = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];

  sorted.slice(0, 7).forEach(([value], i) => {
    const name = names[i] || `${i + 1}`;
    tokens[`spacing-${name}`] = value;
  });

  return { values: sorted, tokens };
}

/**
 * 聚类阴影值
 */
function clusterShadows(rawShadows) {
  const entries = Object.entries(rawShadows);
  const sorted = entries.sort((a, b) => b[1].count - a[1].count);

  const tokens = {};
  const names = ['sm', 'md', 'lg', 'xl'];

  sorted.slice(0, 4).forEach(([value], i) => {
    tokens[`shadow-${names[i]}`] = value;
  });

  return { values: sorted, tokens };
}

/**
 * 聚类圆角值
 */
function clusterRadiiValues(rawRadii) {
  const entries = Object.entries(rawRadii);
  const sorted = entries.sort((a, b) => b[1].count - a[1].count);

  const tokens = {};
  const names = ['sm', 'md', 'lg', 'full'];

  // 特殊处理 full (9999px)
  sorted.forEach(([value]) => {
    if (value.includes('9999') || value.includes('50%')) {
      tokens['radius-full'] = value;
    }
  });

  // 其他值
  sorted.slice(0, 3).forEach(([value], i) => {
    if (!tokens[`radius-${names[i]}`]) {
      tokens[`radius-${names[i]}`] = value;
    }
  });

  return { values: sorted, tokens };
}

/**
 * 根据颜色推断 color_scheme (light/dark)
 */
export function inferColorScheme(colors) {
  if (!colors || colors.length === 0) return 'light';

  // 1. 先找明显的浅色背景（l > 90 表示非常浅）
  const lightBg = colors.filter(c => {
    const hsl = getHslValues(c.hex);
    return hsl.l > 90;
  });
  if (lightBg.length > 0) return 'light';

  // 2. 通过 backgroundColor 属性找背景色
  const bgByProps = colors.filter(c =>
    c.properties?.includes('backgroundColor')
  );
  if (bgByProps.length > 0) {
    const luminance = getRelativeLuminance(bgByProps[0].hex);
    return luminance < 0.5 ? 'dark' : 'light';
  }

  // 3. 排除纯黑/纯白后判断
  const notExtreme = colors.filter(c => {
    const hsl = getHslValues(c.hex);
    return hsl.l > 10 && hsl.l < 95;
  });
  if (notExtreme.length > 0) {
    const luminance = getRelativeLuminance(notExtreme[0].hex);
    return luminance < 0.5 ? 'dark' : 'light';
  }

  return 'light';
}

/**
 * 根据颜色特征推断设计分类
 */
export function inferCategory(colors, colorScheme) {
  if (!colors || colors.length === 0) return 'minimal';

  // 计算暗色比例
  const darkCount = colors.filter(c => getRelativeLuminance(c.hex) < 0.3).length;
  const darkRatio = darkCount / colors.length;
  if (darkRatio > 0.6 || colorScheme === 'dark') {
    return 'dark';
  }

  // 找主色（最频繁的）
  const primary = colors[0];
  if (!primary) return 'minimal';

  const hsl = getHslValues(primary.hex);
  const luminance = getRelativeLuminance(primary.hex);

  // SaaS: 蓝/紫色调
  if (hsl.h >= 200 && hsl.h <= 280 && hsl.s > 50) {
    return 'saas';
  }

  // Playful: 高饱和度、高亮度
  if (hsl.s > 70 && hsl.l > 60) {
    return 'playful';
  }

  // Editorial: 暖色调、低饱和度
  if ((hsl.h < 60 || hsl.h > 300) && hsl.s < 50) {
    return 'editorial';
  }

  // Retro: 中等饱和度、暖色
  if (hsl.h >= 20 && hsl.h <= 50 && hsl.s >= 30 && hsl.s <= 70) {
    return 'retro';
  }

  // Minimal: 低饱和度
  if (hsl.s < 30) {
    return 'minimal';
  }

  return 'minimal';
}

// ============================================================
// 2. 颜色聚类模块
// ============================================================

const DISTANCE_THRESHOLD = 20;
const MAX_COLORS = 20;

/**
 * 合并相似颜色
 */
export function clusterColors(colors) {
  if (colors.length === 0) return [];

  // 按频率排序
  const sorted = [...colors].sort((a, b) => b.frequency - a.frequency);
  const clusters = [];

  for (const color of sorted) {
    if (clusters.length >= MAX_COLORS) break;

    const rgb = parseColor(color.hex);
    if (!rgb) continue;

    let found = false;
    for (const cluster of clusters) {
      const clusterRgb = parseColor(cluster.hex);
      if (clusterRgb && colorDistance(rgb, clusterRgb) < DISTANCE_THRESHOLD) {
        // 合并：保留频率更高的
        if (color.frequency > cluster.frequency) {
          cluster.hex = color.hex;
          cluster.name = color.name;
        }
        cluster.frequency += color.frequency;
        cluster.contexts = [...new Set([...cluster.contexts, ...color.contexts])];
        found = true;
        break;
      }
    }

    if (!found) {
      clusters.push({ ...color, contexts: [...color.contexts] });
    }
  }

  return clusters;
}

// ============================================================
// 3. 语义角色推断模块
// ============================================================

const CONTEXT_ALIASES = {
  buttons: 'button',
  headings: 'heading',
  links: 'link',
  cards: 'card',
  borders: 'border',
  backgrounds: 'background',
  inputs: 'input',
  badges: 'badge',
  heroes: 'hero',
};

/**
 * Normalize plural extractor contexts (buttons → button).
 */
export function normalizeContexts(contexts = []) {
  return [...new Set(
    contexts
      .filter(Boolean)
      .map((ctx) => CONTEXT_ALIASES[ctx] || ctx)
  )];
}

/**
 * Build collision-free YAML / CSS token keys.
 */
export function uniqueTokenKey(name, used) {
  const base = toCssName(name || 'token') || 'token';
  let key = base;
  let i = 2;
  while (used.has(key)) {
    key = `${base}-${i}`;
    i += 1;
  }
  used.add(key);
  return key;
}

/**
 * 根据上下文推断颜色分组
 */
export function inferColorGroup(contexts, hex) {
  const ctx = normalizeContexts(contexts);
  if (ctx.length === 0) return 'neutral';

  const hsl = getHslValues(hex);

  // 无彩色系
  if (hsl.s < 10) {
    return 'neutral';
  }

  // 按钮中出现
  if (ctx.includes('button')) {
    if (hsl.s > 35 && hsl.l > 20 && hsl.l < 75) {
      return 'brand';
    }
  }

  // CTA 按钮
  if (ctx.includes('nav') && ctx.includes('button') && hsl.s > 35) {
    return 'brand';
  }

  // 强调色
  if (hsl.s > 60 && hsl.l > 30 && hsl.l < 70) {
    return 'accent';
  }

  return 'neutral';
}

/**
 * 推断颜色名称（基础版本，AI 会增强）
 */
export function inferColorName(hex, contexts) {
  const hsl = getHslValues(hex);

  // 无彩色
  if (hsl.s < 10) {
    if (hsl.l < 15) return 'Obsidian';
    if (hsl.l < 30) return 'Charcoal';
    if (hsl.l < 50) return 'Graphite';
    if (hsl.l < 70) return 'Ash';
    if (hsl.l < 85) return 'Fog';
    if (hsl.l < 95) return 'Snow';
    return 'White';
  }

  // 色调命名
  const h = hsl.h;
  let baseName;
  if (h < 15) baseName = 'Crimson';
  else if (h < 45) baseName = 'Amber';
  else if (h < 75) baseName = 'Lime';
  else if (h < 150) baseName = 'Emerald';
  else if (h < 180) baseName = 'Teal';
  else if (h < 255) baseName = 'Azure';
  else if (h < 290) baseName = 'Violet';
  else if (h < 330) baseName = 'Magenta';
  else baseName = 'Rose';

  // 亮度和饱和度修饰
  if (hsl.l < 30) return `Deep ${baseName}`;
  if (hsl.l > 80) return `Pale ${baseName}`;
  if (hsl.s > 80) return `Vivid ${baseName}`;
  if (hsl.s < 40) return `Muted ${baseName}`;

  return baseName;
}

/**
 * 生成颜色描述
 */
export function generateColorRole(color, contexts) {
  const ctx = normalizeContexts(contexts);
  if (ctx.length === 0) return 'Color';

  const primaryContext = ctx[0] || 'element';

  if (ctx.includes('button') && ctx.includes('nav')) {
    return 'Primary action color — used for CTA buttons and navigation';
  }
  if (ctx.includes('button')) {
    return 'Button color — used for interactive elements';
  }
  if (ctx.includes('heading')) {
    return 'Heading color — used for titles and emphasis';
  }
  if (ctx.includes('body')) {
    return 'Body text color — used for paragraph content';
  }
  if (ctx.includes('link')) {
    return 'Link color — used for hyperlinks';
  }
  if (ctx.includes('card')) {
    return 'Card color — used for surface containers';
  }
  if (ctx.includes('border')) {
    return 'Border color — used for dividers and outlines';
  }
  if (ctx.includes('background')) {
    return 'Background color — used for page or section surfaces';
  }

  return `${primaryContext.charAt(0).toUpperCase() + primaryContext.slice(1)} color`;
}

/**
 * Attach agent-facing semantic roles (text / background / primary / …)
 * and unique semanticKey values for YAML front matter.
 */
export function assignColorSemantics(colors = []) {
  const ROLE_PRIORITY = {
    primary: 0,
    accent: 1,
    background: 2,
    surface: 3,
    text: 4,
    border: 5,
    neutral: 6,
  };

  const annotated = colors.map((color) => {
    const ctx = normalizeContexts(color.contexts);
    const props = color.properties || [];
    const hsl = getHslValues(color.hex) || { h: 0, s: 0, l: 50 };
    const isTextProp = props.includes('color');
    const isBgProp = props.includes('backgroundColor');
    const isBorderProp = props.some((p) => String(p).startsWith('border'));

    let semantic = 'neutral';
    const vivid = hsl.s >= 35 && hsl.l > 18 && hsl.l < 78;
    if (
      (color.group === 'brand' && vivid) ||
      (ctx.includes('button') && ctx.includes('nav') && vivid)
    ) {
      semantic = 'primary';
    } else if (
      (color.group === 'accent' && vivid) ||
      (vivid && hsl.s > 55 && ctx.includes('button'))
    ) {
      semantic = 'accent';
    } else if (isBgProp && (ctx.includes('background') || hsl.l <= 18 || hsl.l >= 92)) {
      semantic = 'background';
    } else if (isBgProp && (ctx.includes('card') || ctx.includes('input'))) {
      semantic = 'surface';
    } else if (isBorderProp && !isTextProp) {
      semantic = 'border';
    } else if (isTextProp || ctx.includes('heading') || ctx.includes('link') || ctx.includes('body')) {
      semantic = 'text';
    } else if (isBgProp) {
      semantic = 'surface';
    }

    return {
      ...color,
      contexts: ctx,
      semantic,
    };
  });

  const byRole = new Map();
  for (const color of annotated) {
    if (!byRole.has(color.semantic)) byRole.set(color.semantic, []);
    byRole.get(color.semantic).push(color);
  }

  const keyByHex = new Map();
  for (const [role, list] of byRole.entries()) {
    list.sort((a, b) => b.frequency - a.frequency);
    list.forEach((color, index) => {
      const key = index === 0 ? role : `${role}-${index + 1}`;
      keyByHex.set(color.hex.toLowerCase(), key);
    });
  }

  return annotated
    .slice()
    .sort((a, b) => {
      const pa = ROLE_PRIORITY[a.semantic] ?? 9;
      const pb = ROLE_PRIORITY[b.semantic] ?? 9;
      if (pa !== pb) return pa - pb;
      return b.frequency - a.frequency;
    })
    .map((color) => ({
      ...color,
      semanticKey: keyByHex.get(color.hex.toLowerCase()) || uniqueTokenKey(color.name || color.hex, new Set()),
    }));
}

// ============================================================
// 4. DOM 元素遍历模块
// ============================================================

const ELEMENT_SELECTORS = {
  buttons: 'button:not(:disabled), [role="button"], .btn, button[class*="primary"], button[class*="accent"]',
  inputs: 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable]',
  cards: '[class*="card"], [class*="container"], [class*="surface"], main > div, section > div',
  nav: 'nav, header, [class*="nav"], [class*="menu"], [class*="header"]',
  backgrounds: 'body, html, main, [class*="background"], [class*="bg-"]',
  borders: '[class*="border"], [style*="border"]',
  headings: 'h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"]',
  links: 'a, [class*="link"]',
  badges: '[class*="badge"], [class*="tag"], [class*="pill"]',
  heroes: '[class*="hero"], [class*="banner"], [class*="jumbotron"]',
};

const MAX_SAMPLES_PER_TYPE = 10;

/**
 * 检查元素是否可见
 */
async function isElementVisible(element) {
  try {
    const style = await element.evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        width: el.offsetWidth,
        height: el.offsetHeight
      };
    });
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           style.width > 0 &&
           style.height > 0;
  } catch {
    return false;
  }
}

/**
 * 从页面提取所有样式数据
 */
export async function extractStylesFromPage(page) {
  const styleData = {
    colors: [],
    fonts: [],
    gradients: [],
    typeScale: [],
  };

  const colorMap = new Map(); // hex -> { frequency, contexts, properties }

  for (const [context, selector] of Object.entries(ELEMENT_SELECTORS)) {
    try {
      const elements = await page.$$(selector);
      const samples = elements.slice(0, MAX_SAMPLES_PER_TYPE);

      for (const element of samples) {
        if (!await isElementVisible(element)) continue;

        const styles = await element.evaluate(el => {
          const s = window.getComputedStyle(el);
          return {
            backgroundColor: s.backgroundColor,
            color: s.color,
            borderColor: s.borderColor,
            borderTopColor: s.borderTopColor,
            borderBottomColor: s.borderBottomColor,
            borderLeftColor: s.borderLeftColor,
            borderRightColor: s.borderRightColor,
            fontFamily: s.fontFamily,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            backgroundImage: s.backgroundImage,
          };
        });

        // 提取颜色
        const colorProps = ['backgroundColor', 'color', 'borderColor',
                           'borderTopColor', 'borderBottomColor',
                           'borderLeftColor', 'borderRightColor'];

        for (const prop of colorProps) {
          const parsed = parseColor(styles[prop]);
          if (parsed) {
            const key = parsed.hex;
            if (!colorMap.has(key)) {
              colorMap.set(key, {
                hex: key,
                frequency: 0,
                contexts: new Set(),
                properties: new Set()
              });
            }
            const entry = colorMap.get(key);
            entry.frequency++;
            entry.contexts.add(context);
            entry.properties.add(prop);
          }
        }

        // 提取渐变
        if (styles.backgroundImage && styles.backgroundImage.includes('gradient')) {
          const gradientInfo = parseGradient(styles.backgroundImage);
          if (gradientInfo) {
            styleData.gradients.push(gradientInfo);
          }
        }

        // 提取字体
        if (styles.fontFamily && !styleData.fonts.includes(styles.fontFamily)) {
          const cleanFont = styles.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
          if (cleanFont && !['inherit', 'initial', 'serif', 'sans-serif', 'monospace'].includes(cleanFont.toLowerCase())) {
            styleData.fonts.push(cleanFont);
          }
        }
      }
    } catch (e) {
      // 忽略选择器错误
    }
  }

  // 转换为数组
  styleData.colors = Array.from(colorMap.values()).map(c => ({
    hex: c.hex,
    frequency: c.frequency,
    contexts: Array.from(c.contexts),
    properties: Array.from(c.properties)
  }));

  return styleData;
}

/**
 * 解析渐变
 */
export function parseGradient(gradientStr) {
  if (!gradientStr || !gradientStr.includes('gradient')) {
    return null;
  }

  const typeMatch = gradientStr.match(/(linear-gradient|radial-gradient|conic-gradient)/i);
  const type = typeMatch ? typeMatch[1].replace('-gradient', '') : 'linear';

  // 提取颜色
  const colorMatches = gradientStr.match(/rgba?\([^)]+\)|#[0-9a-fA-F]+|hsl[a]?\([^)]+\)/g) || [];
  const colors = colorMatches.map(c => {
    const parsed = parseColor(c);
    return parsed ? parsed.hex : null;
  }).filter(Boolean);

  if (colors.length === 0) return null;

  return {
    type,
    value: gradientStr,
    colors
  };
}

// ============================================================
// 5. 字体提取模块
// ============================================================

const GOOGLE_FONTS = [
  'inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins',
  'source sans', 'nunito', 'playfair', 'merriweather', 'ubuntu',
  'raleway', 'work sans', 'fira', 'noto', 'barlow', 'dm sans',
  'figtree', 'geist', 'sora', 'plus jakarta', 'space grotesk'
];

const SYSTEM_FONTS = [
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto',
  'helvetica neue', 'arial', 'system-ui', 'sans-serif'
];

/**
 * 检测字体来源
 */
export function detectFontSource(fontFamily) {
  const lower = fontFamily.toLowerCase();

  if (SYSTEM_FONTS.some(f => lower.includes(f))) {
    return 'system';
  }

  if (GOOGLE_FONTS.some(f => lower.includes(f))) {
    return 'google';
  }

  return 'custom';
}

/**
 * 从页面提取字体信息
 */
export async function extractFonts(page) {
  const fonts = new Map();

  try {
    const fontList = await page.evaluate(() => {
      if (document.fonts) {
        return Array.from(document.fonts).map(f => ({
          family: f.family,
          weight: f.weight,
          status: f.status
        }));
      }
      return [];
    });

    for (const font of fontList) {
      if (font.status !== 'loaded') continue;

      const cleanFamily = font.family.split(',')[0].trim().replace(/['"]/g, '');
      if (!fonts.has(cleanFamily)) {
        fonts.set(cleanFamily, {
          fontFamily: cleanFamily,
          weights: new Set(),
          source: detectFontSource(cleanFamily)
        });
      }
      fonts.get(cleanFamily).weights.add(font.weight);
    }
  } catch (e) {
    // 降级：从 computed style 提取
  }

  // 如果 document.fonts 不可用，从选择器提取
  if (fonts.size === 0) {
    const textElements = await page.$$('body, p, h1, h2, h3, button, a');
    for (const el of textElements.slice(0, 20)) {
      try {
        const style = await el.evaluate(elem => {
          const s = window.getComputedStyle(elem);
          return { fontFamily: s.fontFamily, fontWeight: s.fontWeight };
        });
        const cleanFamily = style.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
        if (cleanFamily && !['inherit', 'initial'].includes(cleanFamily.toLowerCase())) {
          if (!fonts.has(cleanFamily)) {
            fonts.set(cleanFamily, {
              fontFamily: cleanFamily,
              weights: new Set(),
              source: detectFontSource(cleanFamily)
            });
          }
          fonts.get(cleanFamily).weights.add(parseInt(style.fontWeight) || 400);
        }
      } catch {}
    }
  }

  return Array.from(fonts.values()).map(f => ({
    fontFamily: f.fontFamily,
    weights: Array.from(f.weights).sort((a, b) => a - b),
    source: f.source,
    desc: `${f.fontFamily} (${Array.from(f.weights).sort((a, b) => a - b).join(', ')})`
  }));
}

/**
 * 提取字号层级
 */
export async function extractTypeScale(page) {
  const sizes = new Map();

  try {
    // 从常见元素提取
    const elements = await page.$$('h1, h2, h3, h4, h5, h6, p, small, span, button, a');
    for (const el of elements.slice(0, 30)) {
      const style = await el.evaluate(elem => {
        const s = window.getComputedStyle(elem);
        return {
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          tagName: elem.tagName.toLowerCase()
        };
      });

      if (style.fontSize) {
        const px = parseFloat(style.fontSize);
        if (px > 0 && px < 200) {
          const key = `${px}-${style.tagName}`;
          if (!sizes.has(key)) {
            sizes.set(key, { size: style.fontSize, px, element: style.tagName });
          }
        }
      }
    }
  } catch {}

  // 计算 base
  const sizeValues = Array.from(sizes.values()).map(s => s.px);
  const base = sizeValues.length > 0
    ? Math.min(...sizeValues.filter(s => s >= 12 && s <= 20)) || 16
    : 16;

  // 按大小分组
  const steps = Array.from(sizes.values())
    .sort((a, b) => b.px - a.px)
    .slice(0, 8)
    .map(s => ({
      name: s.element,
      size: s.size,
      px: s.px
    }));

  return {
    name: 'Scale',
    base,
    steps
  };
}

/**
 * 提取间距 tokens
 */
async function extractSpacing(page) {
  const spacings = await page.evaluate(() => {
    const values = new Map();
    const trackValue = (valuesMap, value, context) => {
      if (!valuesMap.has(value)) {
        valuesMap.set(value, { count: 0, contexts: [] });
      }
      const entry = valuesMap.get(value);
      entry.count++;
      if (!entry.contexts.includes(context)) {
        entry.contexts.push(context);
      }
    };

    document.querySelectorAll('div, section, article, aside, header, footer, nav, main').forEach(el => {
      const style = window.getComputedStyle(el);
      const dirs = ['Top', 'Right', 'Bottom', 'Left'];

      dirs.forEach(dir => {
        const padding = style[`padding${dir}`];
        if (padding && padding !== '0px' && padding !== '0') {
          const val = parseInt(padding);
          if (val > 0 && val < 100) {
            trackValue(values, padding, `padding-${dir.toLowerCase()}`);
          }
        }

        const margin = style[`margin${dir}`];
        if (margin && margin !== '0px' && margin !== '0' && !margin.includes('-')) {
          const val = parseInt(margin);
          if (val > 0 && val < 100) {
            trackValue(values, margin, `margin-${dir.toLowerCase()}`);
          }
        }
      });

      // gap 属性
      if (style.gap && style.gap !== 'normal' && style.gap !== '0px') {
        const val = parseInt(style.gap);
        if (val > 0 && val < 100) {
          trackValue(values, style.gap, 'gap');
        }
      }
    });

    return Object.fromEntries(values);
  });

  return clusterSpacingValues(spacings);
}

/**
 * 提取阴影 tokens
 */
async function extractShadows(page) {
  const shadows = await page.evaluate(() => {
    const values = new Map();
    const trackValue = (valuesMap, value, context) => {
      if (!valuesMap.has(value)) {
        valuesMap.set(value, { count: 0, contexts: [] });
      }
      const entry = valuesMap.get(value);
      entry.count++;
      if (!entry.contexts.includes(context)) {
        entry.contexts.push(context);
      }
    };
    const getElementContext = (el) => {
      const tag = el.tagName?.toLowerCase() || '';
      const role = el.getAttribute('role') || '';
      const type = el.getAttribute('type') || '';
      const className = el.className || '';
      if (tag === 'button' || role === 'button') return 'button';
      if (tag === 'input') return type ? `input-${type}` : 'input';
      if (tag === 'img' || tag === 'svg') return 'image';
      if (tag === 'a') return 'link';
      if (tag.match(/^h[1-6]$/)) return 'heading';
      if (typeof className === 'string' && className.match(/card|modal|dropdown|menu|nav/i)) {
        return className.split(' ')[0];
      }
      return tag;
    };

    document.querySelectorAll('div, section, article, aside, button, input, img').forEach(el => {
      const style = window.getComputedStyle(el);
      const shadow = style.boxShadow;

      if (shadow && shadow !== 'none' && !shadow.includes('rgba(0, 0, 0, 0)') && shadow.length < 200) {
        const ctx = getElementContext(el);
        trackValue(values, shadow, ctx);
      }
    });

    return Object.fromEntries(values);
  });

  return clusterShadows(shadows);
}

/**
 * 聚类动效时间值
 */
function clusterAnimationDurations(rawValues) {
  const entries = Object.entries(rawValues);
  const sorted = entries.sort((a, b) => b[1].count - a[1].count);

  const tokens = {};
  const names = ['fast', 'base', 'slow'];

  sorted.slice(0, 3).forEach(([value], i) => {
    tokens[`duration-${names[i] || i + 1}`] = value;
  });

  return { values: sorted, tokens };
}

/**
 * 提取动效 tokens (transition, animation, transform)
 */
async function extractAnimations(page) {
  const result = await page.evaluate(() => {
    const transitions = new Map();
    const animations = new Map();
    const transforms = new Map();
    const easings = new Map();
    const trackValue = (valuesMap, value, context) => {
      if (!valuesMap.has(value)) {
        valuesMap.set(value, { count: 0, contexts: [] });
      }
      const entry = valuesMap.get(value);
      entry.count++;
      if (!entry.contexts.includes(context)) {
        entry.contexts.push(context);
      }
    };

    // 选择器：可能包含动效的元素
    const selectors = 'div, button, a, input, img, nav, header, footer, [class*="card"], [class*="modal"], [class*="dropdown"], [class*="menu"]';
    const elements = document.querySelectorAll(selectors);

    elements.forEach(el => {
      const style = window.getComputedStyle(el);

      // Prefer longhand so cubic-bezier(...) is not truncated by whitespace splits
      const transitionDuration = (style.transitionDuration || '').split(',')[0].trim();
      const transitionTiming = (style.transitionTimingFunction || '').split(',')[0].trim();
      const transitionProperty = (style.transitionProperty || '').split(',')[0].trim();

      if (transitionDuration && transitionDuration !== '0s' && transitionDuration !== '0ms') {
        trackValue(transitions, transitionDuration, `duration:${transitionProperty || 'all'}`);
      }
      if (
        transitionTiming &&
        transitionTiming !== 'ease' &&
        transitionTiming !== 'ease 0s' &&
        !/^ease(\s|$)/.test(transitionTiming)
      ) {
        trackValue(easings, transitionTiming, 'timing-function');
      }

      // 提取 animation
      const animation = style.animation;
      if (animation && animation !== 'none' && animation !== 'none 0s ease 0s') {
        const animDuration = (style.animationDuration || '').split(',')[0].trim();
        const animTiming = (style.animationTimingFunction || '').split(',')[0].trim();
        const animName = (style.animationName || '').split(',')[0].trim();

        if (animName && animName !== 'none') {
          trackValue(animations, animName, `duration:${animDuration || '0s'}`);
        }
        if (animTiming && animTiming !== 'ease') {
          trackValue(easings, animTiming, 'animation-timing');
        }
      }

      // 提取 transform
      const transform = style.transform;
      if (transform && transform !== 'none' && transform !== 'matrix(none)') {
        // 解析 transform 函数
        if (transform.includes('scale')) {
          const match = transform.match(/scale\(([^)]+)\)/);
          if (match) {
            trackValue(transforms, `scale(${match[1]})`, 'scale');
          }
        }
        if (transform.includes('translate')) {
          const match = transform.match(/translate\(([^)]+)\)/);
          if (match) {
            trackValue(transforms, `translate(${match[1]})`, 'translate');
          }
        }
        if (transform.includes('rotate')) {
          const match = transform.match(/rotate\(([^)]+)\)/);
          if (match) {
            trackValue(transforms, `rotate(${match[1]})`, 'rotate');
          }
        }
      }

      // 提取 will-change
      const willChange = style.willChange;
      if (willChange && willChange !== 'auto') {
        trackValue(transforms, willChange, 'will-change');
      }
    });

    return {
      transitions: Object.fromEntries(transitions),
      animations: Object.fromEntries(animations),
      transforms: Object.fromEntries(transforms),
      easings: Object.fromEntries(easings)
    };
  });

  // 聚类 duration 值
  result.durationTokens = clusterAnimationDurations(result.transitions);

  return result;
}

/**
 * 提取圆角 tokens
 */
async function extractBorderRadius(page) {
  const radii = await page.evaluate(() => {
    const values = new Map();
    const trackValue = (valuesMap, value, context) => {
      if (!valuesMap.has(value)) {
        valuesMap.set(value, { count: 0, contexts: [] });
      }
      const entry = valuesMap.get(value);
      entry.count++;
      if (!entry.contexts.includes(context)) {
        entry.contexts.push(context);
      }
    };
    const getElementContext = (el) => {
      const tag = el.tagName?.toLowerCase() || '';
      const role = el.getAttribute('role') || '';
      const type = el.getAttribute('type') || '';
      const className = el.className || '';
      if (tag === 'button' || role === 'button') return 'button';
      if (tag === 'input') return type ? `input-${type}` : 'input';
      if (tag === 'img' || tag === 'svg') return 'image';
      if (tag === 'a') return 'link';
      if (tag.match(/^h[1-6]$/)) return 'heading';
      if (typeof className === 'string' && className.match(/card|modal|dropdown|menu|nav/i)) {
        return className.split(' ')[0];
      }
      return tag;
    };

    document.querySelectorAll('div, button, input, img, a, span, p').forEach(el => {
      const style = window.getComputedStyle(el);
      const radius = style.borderRadius;

      if (radius && radius !== '0px' && radius !== '0') {
        const ctx = getElementContext(el);
        trackValue(values, radius, ctx);
      }
    });

    return Object.fromEntries(values);
  });

  return clusterRadiiValues(radii);
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

const AI_SYSTEM_PROMPT = `You are a professional design system expert. Based on extracted color data, generate semantic color names and design philosophy descriptions.

Requirements:
- Color names use elegant English words (e.g., Azure, Storm Cloud, Obsidian, Graphite)
- Avoid generic names like "Primary", "Color 1", "Blue 1"
- Descriptions should specify the color's usage context and visual effect
- north_star should be a one-sentence design philosophy (30-50 characters in Chinese, or 50-80 chars in English)
- Output valid JSON only, no additional text

Output JSON format:
{"colors":[{"hex":"#0071e3","name":"Azure","group":"brand","role":"Primary CTA button fill — the sole permission-to-act color on the entire page"}],"northStar":"Gallery wall at natural light — enormous type casts shadows on a white surface"}`;

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
 * 使用 AI 增强颜色数据
 */
export async function enrichWithAI(baseData) {
  const client = getAiClient();
  if (!client) {
    // 无 API Key，返回基础数据
    return {
      ...baseData,
      colors: baseData.colors.map(c => ({
        ...c,
        name: inferColorName(c.hex, c.contexts),
        group: inferColorGroup(c.contexts, c.hex),
        role: generateColorRole(c, c.contexts)
      }))
    };
  }

  try {
    const colorsList = baseData.colors
      .slice(0, 15)
      .map(c => `- ${c.hex} (freq: ${c.frequency}, contexts: ${c.contexts.join(', ')})`)
      .join('\n');

    const contextsSummary = {};
    for (const color of baseData.colors) {
      for (const ctx of color.contexts) {
        contextsSummary[ctx] = (contextsSummary[ctx] || 0) + color.frequency;
      }
    }

    const userPrompt = `Site Name: ${baseData.siteName}
Site URL: ${baseData.url}

Extracted colors (by frequency):
${colorsList}

Context distribution:
${JSON.stringify(contextsSummary, null, 2)}

Font stack: ${baseData.fonts.slice(0, 3).map(f => f.fontFamily).join(', ')}

Generate semantic names and design philosophy.`;

    const response = await client.chat.completions.create({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;

    // Extract JSON from response (robust parsing with jsonrepair fallback)
    const enriched = await parseAIResponse(content);
    if (!enriched) {
      console.warn('AI response parse failed, using rule-based inference');
      return {
        ...baseData,
        colors: baseData.colors.map(c => ({
          ...c,
          name: inferColorName(c.hex, c.contexts),
          group: inferColorGroup(c.contexts, c.hex),
          role: generateColorRole(c, c.contexts)
        }))
      };
    }

    // 合并 AI 增强数据
    const colorMap = new Map();
    for (const c of enriched.colors || []) {
      colorMap.set(c.hex.toLowerCase(), c);
    }

    const finalColors = baseData.colors.map(c => {
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

    return {
      ...baseData,
      colors: finalColors,
      northStar: enriched.northStar || null
    };
  } catch (error) {
    console.error('AI enrichment failed:', error.message);
    // 降级：使用规则推断
    return {
      ...baseData,
      colors: baseData.colors.map(c => ({
        ...c,
        name: inferColorName(c.hex, c.contexts),
        group: inferColorGroup(c.contexts, c.hex),
        role: generateColorRole(c, c.contexts)
      }))
    };
  }
}

// ============================================================
// 7. 多格式输出工具
// ============================================================

/**
 * Convert a name to a valid CSS custom property segment (kebab-case, alphanumeric only)
 */
export function toCssName(name) {
  return name
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Generate DTCG standard tokens.json
 * @see https://design-tokens.github.io/community-group/format/
 */
export function generateTokensJson(data) {
  const { colors = [], fonts = [], typeScale, gradients = [], northStar, siteName } = data;

  const tokens = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
  };

  // Colors grouped by semantic role
  if (colors.length > 0) {
    tokens.colors = {};
    for (const c of colors) {
      const key = toCssName(c.name || c.hex);
      tokens.colors[key] = {
        $value: c.hex,
        $type: 'color',
        $description: c.role || `${c.name} color`,
      };
      if (c.group) tokens.colors[key].$extensions = { group: c.group };
    }
  }

  // Gradients
  if (gradients.length > 0) {
    tokens.gradients = {};
    for (let i = 0; i < gradients.length; i++) {
      const g = gradients[i];
      const key = toCssName(g.type || `gradient-${i + 1}`);
      tokens.gradients[key] = {
        $value: g.value || g.css || '',
        $type: 'gradient',
        $description: `${g.type || 'linear'} gradient`,
      };
    }
  }

  // Typography
  if (fonts.length > 0 || (typeScale && typeScale.steps && typeScale.steps.length > 0)) {
    tokens.typography = {};

    if (fonts.length > 0) {
      tokens.typography.fontFamily = {};
      for (const f of fonts) {
        const key = toCssName(f.fontFamily);
        tokens.typography.fontFamily[key] = {
          $value: [f.fontFamily],
          $type: 'fontFamily',
        };
      }
    }

    if (typeScale && typeScale.steps && typeScale.steps.length > 0) {
      tokens.typography.fontSize = {};
      for (const step of typeScale.steps) {
        const key = toCssName(step.name || step.role || `step-${step.size}`);
        tokens.typography.fontSize[key] = {
          $value: typeof step.size === 'number' ? `${step.size}px` : step.size,
          $type: 'dimension',
        };
      }
    }
  }

  // Spacing
  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    tokens.spacing = {};
    tokens.spacing.$type = 'dimension';
    for (const [name, value] of Object.entries(data.spacing.tokens)) {
      const key = name.replace('spacing-', '');
      tokens.spacing[toCssName(key)] = { $value: value };
    }
  }

  // Shadows
  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    tokens.shadows = {};
    tokens.shadows.$type = 'shadow';
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      const key = name.replace('shadow-', '');
      tokens.shadows[toCssName(key)] = { $value: value };
    }
  }

  // Border Radius
  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    tokens.borderRadius = {};
    tokens.borderRadius.$type = 'dimension';
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      const key = name.replace('radius-', '');
      tokens.borderRadius[toCssName(key)] = { $value: value };
    }
  }

  // Animations
  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    tokens.animation = {};
    tokens.animation.$type = 'animation';
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      const key = name.replace('duration-', '');
      tokens.animation[`duration${key.charAt(0).toUpperCase() + key.slice(1)}`] = { $value: value };
    }
  }

  // Easing
  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    tokens.easing = {};
    tokens.easing.$type = 'cubicBezier';
    for (const [name] of Object.entries(data.animations.easings)) {
      tokens.easing[toCssName(name)] = { $value: name };
    }
  }

  tokens.$metadata = {
    name: siteName || 'Design Tokens',
    northStar: northStar || '',
  };

  return JSON.stringify(tokens, null, 2);
}

/**
 * Generate Style Dictionary compatible JSON format
 * @see https://styledictionary.com/
 */
export function generateStyleDictionary(data) {
  const { colors = [], fonts = [], typeScale, gradients = [], spacing, shadows, borderRadius, northStar, siteName, url } = data;

  const tokens = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
  };

  const tokenSets = [];

  // Colors
  if (colors.length > 0) {
    tokens.color = {};
    const groups = { brand: [], accent: [], neutral: [], other: [] };
    for (const c of colors) {
      const key = toCssName(c.name || c.hex);
      const token = {
        $value: c.hex,
        $type: 'color',
      };
      if (c.role) token.$description = c.role;
      tokens.color[key] = token;
      const group = c.group || 'other';
      if (groups[group]) {
        groups[group].push(key);
      } else {
        groups.other.push(key);
      }
    }
    tokenSets.push('color');
  }

  // Gradients
  if (gradients.length > 0) {
    tokens.gradient = {};
    for (let i = 0; i < gradients.length; i++) {
      const g = gradients[i];
      const key = toCssName(g.type || `gradient-${i + 1}`);
      tokens.gradient[key] = {
        $value: g.value || g.css || '',
        $type: 'gradient',
        $description: `${g.type || 'linear'} gradient`,
      };
    }
    tokenSets.push('gradient');
  }

  // Typography
  if (fonts.length > 0 || (typeScale && typeScale.steps && typeScale.steps.length > 0)) {
    tokens.typography = {};

    if (fonts.length > 0) {
      tokens.typography.fontFamily = {};
      for (const f of fonts) {
        const key = toCssName(f.fontFamily);
        tokens.typography.fontFamily[key] = {
          $value: [f.fontFamily],
          $type: 'fontFamily',
        };
      }
    }

    if (typeScale && typeScale.steps && typeScale.steps.length > 0) {
      tokens.typography.fontSize = {};
      for (const step of typeScale.steps) {
        const key = toCssName(step.name || step.role || `step-${step.size}`);
        tokens.typography.fontSize[key] = {
          $value: typeof step.size === 'number' ? `${step.size}px` : step.size,
          $type: 'dimension',
        };
      }
    }
    tokenSets.push('typography');
  }

  // Spacing
  if (spacing?.tokens && Object.keys(spacing.tokens).length > 0) {
    tokens.spacing = {};
    for (const [name, value] of Object.entries(spacing.tokens)) {
      const key = name.replace('spacing-', '');
      tokens.spacing[toCssName(key)] = { $value: value, $type: 'dimension' };
    }
    tokenSets.push('spacing');
  }

  // Shadows
  if (shadows?.tokens && Object.keys(shadows.tokens).length > 0) {
    tokens.shadow = {};
    for (const [name, value] of Object.entries(shadows.tokens)) {
      const key = name.replace('shadow-', '');
      tokens.shadow[toCssName(key)] = { $value: value, $type: 'shadow' };
    }
    tokenSets.push('shadow');
  }

  // Border Radius
  if (borderRadius?.tokens && Object.keys(borderRadius.tokens).length > 0) {
    tokens.borderRadius = {};
    for (const [name, value] of Object.entries(borderRadius.tokens)) {
      const key = name.replace('radius-', '');
      tokens.borderRadius[toCssName(key)] = { $value: value, $type: 'dimension' };
    }
    tokenSets.push('borderRadius');
  }

  // Animations
  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    tokens.transition = {};
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      const key = name.replace('duration-', '');
      tokens.transition[`duration${key.charAt(0).toUpperCase() + key.slice(1)}`] = { $value: value, $type: 'duration' };
    }
    tokenSets.push('transition');
  }

  // Easing
  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    tokens.easing = tokens.easing || {};
    for (const [name] of Object.entries(data.animations.easings)) {
      tokens.easing[toCssName(name)] = { $value: name, $type: 'cubicBezier' };
    }
    if (!tokenSets.includes('easing')) tokenSets.push('easing');
  }

  // Style Dictionary specific metadata
  tokens.$metadata = {
    name: siteName || 'Design Tokens',
    source: url || '',
    format: 'Style Dictionary',
    tokenSetOrder: tokenSets,
  };

  return JSON.stringify(tokens, null, 2);
}

/**
 * Generate CSS custom properties (variables.css)
 */
export function generateVariablesCss(data) {
  const { colors = [], fonts = [], typeScale, gradients = [] } = data;

  const lines = [':root {'];

  // Colors grouped by semantic category
  if (colors.length > 0) {
    const brand = colors.filter(c => c.group === 'brand');
    const accent = colors.filter(c => c.group === 'accent');
    const neutral = colors.filter(c => c.group === 'neutral');

    if (brand.length > 0) {
      lines.push('  /* Brand Colors */');
      for (const c of brand) lines.push(`  --color-${toCssName(c.name || c.hex)}: ${c.hex};`);
      lines.push('');
    }
    if (accent.length > 0) {
      lines.push('  /* Accent Colors */');
      for (const c of accent) lines.push(`  --color-${toCssName(c.name || c.hex)}: ${c.hex};`);
      lines.push('');
    }
    if (neutral.length > 0) {
      lines.push('  /* Neutral Colors */');
      for (const c of neutral) lines.push(`  --color-${toCssName(c.name || c.hex)}: ${c.hex};`);
      lines.push('');
    }
    // Ungrouped
    const ungrouped = colors.filter(c => !c.group);
    if (ungrouped.length > 0) {
      lines.push('  /* Other Colors */');
      for (const c of ungrouped) lines.push(`  --color-${toCssName(c.name || c.hex)}: ${c.hex};`);
      lines.push('');
    }
  }

  // Gradients
  if (gradients.length > 0) {
    lines.push('  /* Gradients */');
    for (let i = 0; i < gradients.length; i++) {
      const g = gradients[i];
      lines.push(`  --gradient-${toCssName(g.type || `gradient-${i + 1}`)}: ${g.value || g.css || ''};`);
    }
    lines.push('');
  }

  // Font families
  if (fonts.length > 0) {
    lines.push('  /* Font Families */');
    for (const f of fonts) {
      const fallback = f.source === 'google' ? ', sans-serif' : f.source === 'system' ? ', system-ui, sans-serif' : ', sans-serif';
      lines.push(`  --font-family-${toCssName(f.fontFamily)}: "${f.fontFamily}"${fallback};`);
    }
    lines.push('');
  }

  // Font sizes
  if (typeScale && typeScale.steps && typeScale.steps.length > 0) {
    lines.push('  /* Font Sizes */');
    for (const step of typeScale.steps) {
      lines.push(`  --font-size-${toCssName(step.name || step.role || `step-${step.size}`)}: ${step.size}px;`);
    }
    if (typeScale.base) lines.push(`  --font-size-base: ${typeScale.base}px;`);
    lines.push('');
  }

  // Spacing
  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    lines.push('  /* Spacing */');
    for (const [name, value] of Object.entries(data.spacing.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Shadows
  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    lines.push('  /* Shadows */');
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Border Radius
  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    lines.push('  /* Border Radius */');
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Animations
  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    lines.push('  /* Animation Duration */');
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Easing
  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    lines.push('  /* Animation Easing */');
    for (const [name] of Object.entries(data.animations.easings)) {
      lines.push(`  --easing-${toCssName(name)}: ${name};`);
    }
    lines.push('');
  }

  // Remove trailing blank line before closing
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate Tailwind v4 @theme directive (theme.css)
 */
export function generateThemeCss(data) {
  const { colors = [], fonts = [], typeScale, gradients = [] } = data;

  const lines = ['@theme {'];

  // Colors
  if (colors.length > 0) {
    lines.push('  /* Colors */');
    for (const c of colors) {
      lines.push(`  --color-${toCssName(c.name || c.hex)}: ${c.hex};`);
    }
    lines.push('');
  }

  // Gradients
  if (gradients.length > 0) {
    lines.push('  /* Gradients */');
    for (let i = 0; i < gradients.length; i++) {
      const g = gradients[i];
      lines.push(`  --gradient-${toCssName(g.type || `gradient-${i + 1}`)}: ${g.value || g.css || ''};`);
    }
    lines.push('');
  }

  // Font families
  if (fonts.length > 0) {
    lines.push('  /* Font Families */');
    for (const f of fonts) {
      lines.push(`  --font-family-${toCssName(f.fontFamily)}: "${f.fontFamily}", sans-serif;`);
    }
    lines.push('');
  }

  // Font sizes
  if (typeScale && typeScale.steps && typeScale.steps.length > 0) {
    lines.push('  /* Font Sizes */');
    for (const step of typeScale.steps) {
      lines.push(`  --font-size-${toCssName(step.name || step.role || `step-${step.size}`)}: ${step.size}px;`);
    }
    if (typeScale.base) lines.push(`  --font-size-base: ${typeScale.base}px;`);
    lines.push('');
  }

  // Spacing
  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    lines.push('  /* Spacing */');
    for (const [name, value] of Object.entries(data.spacing.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Shadows
  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    lines.push('  /* Shadows */');
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Border Radius
  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    lines.push('  /* Border Radius */');
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Animations
  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    lines.push('  /* Animation Duration */');
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      lines.push(`  --${toCssName(name)}: ${value};`);
    }
    lines.push('');
  }

  // Easing
  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    lines.push('  /* Animation Easing */');
    for (const [name] of Object.entries(data.animations.easings)) {
      lines.push(`  --easing-${toCssName(name)}: ${name};`);
    }
    lines.push('');
  }

  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  lines.push('}');
  return lines.join('\n');
}

// ============================================================
// 8. Markdown 生成
// ============================================================

/**
 * 生成 stitch 级 DESIGN.md（YAML tokens + agent 可读叙事）
 */
export function generateDesignMd(data) {
  const {
    siteName,
    fonts = [],
    typeScale,
    northStar,
    url,
    colorScheme = 'unknown',
  } = data;

  const colors = (data.colors || []).some((c) => c.semanticKey)
    ? data.colors
    : assignColorSemantics(data.colors || []);

  const escapeYaml = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const pxOf = (value) => {
    const n = parseFloat(String(value).replace(/px$/i, ''));
    return Number.isFinite(n) ? n : value;
  };

  let md = `---
version: "1.0"
name: "${escapeYaml(siteName)}"
description: "Design tokens extracted from ${escapeYaml(url)}"
north_star: "${escapeYaml(northStar || '')}"
color_scheme: "${escapeYaml(colorScheme)}"
`;

  md += `\ncolors:\n`;
  for (const c of colors.slice(0, 12)) {
    const key = c.semanticKey || uniqueTokenKey(c.name || c.hex, new Set());
    md += `  ${key}: "${c.hex}"\n`;
  }

  md += `\ntypography:\n`;
  const typeSteps = (typeScale?.steps || []).slice(0, 8);
  if (typeSteps.length > 0) {
    typeSteps.forEach((step, i) => {
      const font = fonts[i === 0 ? 0 : Math.min(1, fonts.length - 1)] || fonts[0];
      md += `  type-${i + 1}:\n`;
      md += `    fontFamily: "${escapeYaml(font?.fontFamily || 'System')}"\n`;
      md += `    fontSize: "${escapeYaml(step.size)}"\n`;
      if (step.fontWeight) md += `    fontWeight: "${escapeYaml(step.fontWeight)}"\n`;
      if (step.lineHeight) md += `    lineHeight: "${escapeYaml(step.lineHeight)}"\n`;
      if (step.letterSpacing) md += `    letterSpacing: "${escapeYaml(step.letterSpacing)}"\n`;
    });
  } else {
    fonts.slice(0, 3).forEach((f, i) => {
      md += `  type-${i + 1}:\n`;
      md += `    fontFamily: "${escapeYaml(f.fontFamily)}"\n`;
      md += `    fontWeight: "${escapeYaml((f.weights || ['400']).join(' '))}"\n`;
    });
  }

  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    md += `\nrounded:\n`;
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    md += `\nspacing:\n`;
    for (const [name, value] of Object.entries(data.spacing.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    md += `\nshadows:\n`;
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      md += `  ${name}: "${escapeYaml(value)}"\n`;
    }
  }

  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    md += `\nanimation_duration:\n`;
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    md += `\nanimation_easing:\n`;
    const used = new Set();
    for (const [easing] of Object.entries(data.animations.easings)) {
      const key = uniqueTokenKey(easing.startsWith('cubic-bezier') ? 'ease-custom' : easing, used);
      md += `  ${key}: "${escapeYaml(easing)}"\n`;
    }
  }

  const fontNames = fonts.map((f) => f.fontFamily).filter(Boolean);
  const primaryColors = colors.filter((c) => c.semantic === 'primary' || c.group === 'brand');
  const accentColors = colors.filter((c) => c.semantic === 'accent' || c.group === 'accent');
  const textColors = colors.filter((c) => c.semantic === 'text');
  const surfaceColors = colors.filter((c) => c.semantic === 'background' || c.semantic === 'surface');
  const borderColors = colors.filter((c) => c.semantic === 'border');

  const signature = [];
  if (fontNames.length) signature.push(`${fontNames.join(' + ')} typography`);
  if (primaryColors[0]) signature.push(`primary ${primaryColors[0].hex}`);
  if (data.borderRadius?.tokens) {
    const radii = Object.values(data.borderRadius.tokens).slice(0, 3).join('/');
    signature.push(`radius ${radii}`);
  }

  md += `\n---\n\n`;
  md += `## Overview\n\n`;
  md += northStar
    ? `${northStar}\n\n`
    : `Design tokens extracted from frequency analysis of the live rendered page at ${url}.\n\n`;
  md += `**Signature traits:**\n`;
  if (signature.length) {
    for (const trait of signature) md += `- ${trait}\n`;
  } else {
    md += `- Evidence was insufficient to extract distinctive signature traits for this system.\n`;
  }
  md += `\n`;

  md += `## Colors\n\n`;
  md += `The palette uses ${colors.length} validated color tokens`;
  md += colorScheme && colorScheme !== 'unknown' ? ` with a ${colorScheme} theme profile` : '';
  md += `. Semantic roles stay attached to observed usage so generation agents can choose accents without inventing new color meaning.\n\n`;

  const themeLabel = colorScheme === 'light' ? 'Light Theme' : colorScheme === 'dark' ? 'Dark Theme' : 'Observed Theme';
  md += `### ${themeLabel}\n\n`;

  if (primaryColors.length || accentColors.length) {
    md += `### Primary Brand\n`;
    for (const c of [...primaryColors, ...accentColors].slice(0, 6)) {
      md += `- **${c.semanticKey || c.name}** (${c.hex}): Frequency rank evidence (${c.frequency} hits). Role: ${c.semantic}. ${c.role || ''}\n`;
    }
    md += `\n`;
  }

  if (textColors.length) {
    md += `### Text Scale\n`;
    for (const c of textColors.slice(0, 10)) {
      md += `- **${c.semanticKey || c.name}** (${c.hex}): repeated text-role usage (${c.frequency} hits). Role: text. ${c.role || ''}\n`;
    }
    md += `\n`;
  }

  if (surfaceColors.length) {
    md += `### Surfaces\n`;
    for (const c of surfaceColors.slice(0, 8)) {
      md += `- **${c.semanticKey || c.name}** (${c.hex}): surface/background usage (${c.frequency} hits). Role: ${c.semantic}.\n`;
    }
    md += `\n`;
  }

  if (borderColors.length) {
    md += `### Borders\n`;
    for (const c of borderColors.slice(0, 6)) {
      md += `- **${c.semanticKey || c.name}** (${c.hex}): border usage (${c.frequency} hits).\n`;
    }
    md += `\n`;
  }

  md += `## Typography\n\n`;
  md += fontNames.length
    ? `Typography uses ${fontNames.join(', ')} across extracted hierarchy roles. Keep hierarchy mapped to these token rows before adding decorative type styles.\n\n`
    : `Typography tokens were sparse; prefer system UI fonts until stronger evidence appears.\n\n`;

  if (typeSteps.length) {
    const sizes = typeSteps.map((s) => s.px || pxOf(s.size)).filter((n) => typeof n === 'number');
    if (sizes.length >= 2) {
      md += `Sizes range from ${Math.min(...sizes)}px to ${Math.max(...sizes)}px.\n\n`;
    }
    md += `### Type Scale Evidence\n`;
    md += `| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |\n`;
    md += `|------|------|------|--------|-------------|----------------|-------|\n`;
    typeSteps.forEach((step, i) => {
      const font = fonts[Math.min(i, Math.max(fonts.length - 1, 0))] || fonts[0];
      md += `| ${step.name || `type-${i + 1}`} | ${font?.fontFamily || 'System'} | ${step.size} | ${step.fontWeight || '400'} | ${step.lineHeight || 'normal'} | ${step.letterSpacing || 'normal'} | Extracted token |\n`;
    });
    md += `\n`;
  }

  md += `## Layout\n\n`;
  md += `Layout rhythm is inferred from spacing tokens and observed component density.\n\n`;
  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    md += `### Spacing System\n`;
    md += `| Token | Value | Px | Notes |\n|------|-------|----|-------|\n`;
    const spacingEntries = Object.entries(data.spacing.tokens)
      .map(([name, value]) => [name, value, pxOf(value)])
      .sort((a, b) => (typeof a[2] === 'number' && typeof b[2] === 'number' ? a[2] - b[2] : 0));
    for (const [name, value, px] of spacingEntries) {
      md += `| ${name} | ${value} | ${px} | Extracted spacing token |\n`;
    }
    md += `\n`;
  }

  md += `## Elevation & Depth\n\n`;
  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    md += `Keep depth claims tied to validated shadow evidence below.\n\n`;
    md += `### Shadow Evidence\n`;
    md += `| Shadow Token | Details |\n|--------------|---------|\n`;
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      md += `| ${name} | ${value} |\n`;
    }
    md += `\n`;
  } else {
    md += `Keep depth flat unless validated shadow evidence appears. Do not invent shadows beyond this evidence boundary.\n\n`;
    md += `### Shadow Evidence\n`;
    md += `| Shadow Token | Layers | Details |\n|--------------|--------|---------|\n`;
    md += `| n/a | 0 | No validated shadow payload |\n\n`;
  }

  if (data.animations?.durationTokens?.tokens) {
    md += `### Motion Timing\n`;
    md += `| Token | Value | Description |\n|-------|-------|-------------|\n`;
    const nameDescMap = {
      'duration-fast': 'Quick feedback',
      'duration-base': 'Default transition',
      'duration-slow': 'Page transitions',
    };
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      md += `| --${name} | ${value} | ${nameDescMap[name] || 'Extracted duration'} |\n`;
    }
    md += `\n`;
  }

  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    md += `### Easing Evidence\n`;
    for (const [easing] of Object.entries(data.animations.easings)) {
      md += `- \`${easing}\`\n`;
    }
    md += `\n`;
  }

  md += `## Shapes\n\n`;
  md += `Shape language maps directly to rounded tokens. Keep component corners consistent before introducing bespoke geometry.\n\n`;
  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    md += `### Radius Roles\n`;
    md += `| Token | Value | Px | Role Mapping |\n|------|-------|----|--------------|\n`;
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      const px = pxOf(value);
      let role = 'Control corner';
      if (px >= 999) role = 'Pill / full round';
      else if (px <= 2) role = 'Hairline corner';
      else if (px <= 6) role = 'Subtle corner';
      else if (px >= 16) role = 'Large surface corner';
      md += `| ${name} | ${value} | ${px} | ${role} |\n`;
    }
    md += `\n`;
  }

  md += `## Components\n\n`;
  md += `(none detected — derive buttons, inputs, and cards from color + radius + type tokens above)\n\n`;

  md += `## Do's and Don'ts\n\n`;
  md += `Guardrails tie generation choices back to validated tokens and evidence-backed hierarchy.\n\n`;
  md += `| Do | Don't |\n|----|--------|\n`;
  md += `| Do maintain consistent spacing using the extracted scale | Don't invent colors outside the validated palette |\n`;
  md += `| Do keep primary accent usage scarce (one dominant action per view) | Don't mix unrelated radius roles in one component |\n`;
  md += `| Do verify contrast against background/surface tokens | Don't claim elevation without shadow evidence |\n`;
  md += `| Do map typography to the extracted type rows first | Don't add decorative typefaces without source evidence |\n\n`;

  md += `## Agent Prompt Guide\n\n`;
  md += `### Example Component Prompts\n`;
  md += `- Create button component using validated primary color role and spacing tokens.\n`;
  md += `- Create card component with mapped radius role and evidence-backed elevation.\n`;
  md += `- Create form input component using inferred typography hierarchy and border roles.\n\n`;
  md += `### Iteration Guide\n`;
  md += `1. Start with extracted palette and typography roles only.\n`;
  md += `2. Map spacing and radius directly from token tables before visual polish.\n`;
  md += `3. Apply component patterns one section at a time and compare against source intent.\n`;
  md += `4. Keep elevation claims tied to explicit evidence in output.\n`;
  md += `5. Iterate with smallest diffs and re-check section hierarchy after each change.\n`;

  return md;
}

// ============================================================
// 8. 主提取器
// ============================================================

/**
 * Connect to Browserless managed Chromium (required on Vercel).
 */
async function connectBrowserless(token) {
  const explicit = process.env.BROWSERLESS_WS_ENDPOINT;
  if (explicit) {
    const ws = explicit.includes('token=')
      ? explicit
      : `${explicit}${explicit.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    console.error('[extractor-v2] Connecting to Browserless via BROWSERLESS_WS_ENDPOINT...');
    return chromium.connect(ws);
  }

  const base = (process.env.BROWSERLESS_URL || 'wss://production-sfo.browserless.io').replace(/\/$/, '');
  const wsEndpoint = `${base}/chromium/playwright?token=${encodeURIComponent(token)}`;
  console.error('[extractor-v2] Connecting to Browserless Playwright endpoint...');
  try {
    return await chromium.connect(wsEndpoint);
  } catch (err) {
    // Legacy BaaS endpoint fallback
    console.error('[extractor-v2] Playwright endpoint failed, trying legacy CDP version endpoint...');
    const versionResp = await fetch(`https://chrome.browserless.io/json/version?token=${encodeURIComponent(token)}`);
    if (!versionResp.ok) {
      throw new Error(`Browserless connection failed (${versionResp.status}). Check BROWSERLESS_TOKEN.`);
    }
    const versionData = await versionResp.json();
    const legacyWs = versionData.webSocketDebuggerUrl
      + (versionData.webSocketDebuggerUrl.includes('?') ? '&' : '?')
      + `token=${encodeURIComponent(token)}`;
    return chromium.connect(legacyWs);
  }
}

/**
 * Launch a local Chromium via Playwright.
 * Prefer Playwright-managed browser; fall back to env path / system Chrome.
 */
async function launchLocalBrowser() {
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ];

  const explicitPath = process.env.CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicitPath) {
    console.error(`[extractor-v2] Launching Chromium from ${explicitPath}`);
    return chromium.launch({
      headless: true,
      executablePath: explicitPath,
      args: launchArgs,
    });
  }

  try {
    console.error('[extractor-v2] Launching Playwright Chromium...');
    return await chromium.launch({
      headless: true,
      args: launchArgs,
    });
  } catch (err) {
    const message = err?.message || String(err);
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const linuxChromium = '/usr/bin/chromium';
    const fallbacks = process.platform === 'darwin'
      ? [macChrome, linuxChromium]
      : [linuxChromium, macChrome];

    for (const candidate of fallbacks) {
      try {
        console.error(`[extractor-v2] Playwright browser missing, trying ${candidate}`);
        return await chromium.launch({
          headless: true,
          executablePath: candidate,
          args: launchArgs,
        });
      } catch {
        // try next candidate
      }
    }

    throw new Error(
      `Failed to launch Chromium. Run \`npx playwright install chromium\` or set CHROMIUM_PATH. Last error: ${message}`
    );
  }
}

/**
 * 主提取函数
 */
export async function extractDesignTokens(url, options = {}) {
  const startTime = Date.now();

  let browser;
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  if (browserlessToken) {
    browser = await connectBrowserless(browserlessToken);
  } else if (process.env.VERCEL) {
    throw new Error('BROWSERLESS_TOKEN is required on Vercel. Add it in Vercel project env settings.');
  } else {
    browser = await launchLocalBrowser();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. 规范化 URL（补全协议前缀）
    let targetUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // 先尝试 HTTPS，失败则降级到 HTTP
      try {
        console.error(`[extractor-v2] Trying HTTPS first: ${url}`);
        await page.goto('https://' + url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        targetUrl = 'https://' + url;
      } catch (httpsErr) {
        console.error(`[extractor-v2] HTTPS failed, trying HTTP: ${url}`);
        await page.goto('http://' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        targetUrl = 'http://' + url;
      }
    } else {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(1000); // 等待渲染

    // 2. 获取站点名称
    let siteName = '';
    try {
      siteName = await page.title();
    } catch {}
    // page.title() 可能返回空字符串而非异常，fallback 到 URL 域名
    if (!siteName) {
      const match = targetUrl.match(/https?:\/\/([^\/]+)/);
      siteName = match ? match[1].replace('www.', '') : 'Unknown';
    }

    // 3. 提取样式数据
    console.error(`[extractor-v2] Extracting styles...`);
    const styleData = await extractStylesFromPage(page);

    // 4. 聚类颜色
    console.error(`[extractor-v2] Clustering colors...`);
    const clusteredColors = clusterColors(styleData.colors);

    // 5. 提取字体
    console.error(`[extractor-v2] Extracting fonts...`);
    const fonts = await extractFonts(page);

    // 6. 提取字号层级
    console.error(`[extractor-v2] Extracting type scale...`);
    const typeScale = await extractTypeScale(page);

    // 7. 提取间距
    console.error(`[extractor-v2] Extracting spacing...`);
    const spacing = await extractSpacing(page);

    // 8. 提取阴影
    console.error(`[extractor-v2] Extracting shadows...`);
    const shadows = await extractShadows(page);

    // 9. 提取圆角
    console.error(`[extractor-v2] Extracting border radius...`);
    const borderRadius = await extractBorderRadius(page);

    // 10. 提取动效
    console.error(`[extractor-v2] Extracting animations...`);
    const animations = await extractAnimations(page);

    // 11. 组装基础数据
    const baseData = {
      url: targetUrl,
      siteName,
      colors: clusteredColors,
      fonts,
      gradients: styleData.gradients,
      typeScale,
      spacing,
      shadows,
      borderRadius,
      animations
    };

    // 12. AI 增强（可选）
    let enrichedData = baseData;
    if (options.useAI !== false) {
      console.error(`[extractor-v2] Enriching with AI...`);
      enrichedData = await enrichWithAI(baseData);
    } else {
      // 使用规则推断
      enrichedData.colors = baseData.colors.map(c => ({
        ...c,
        name: inferColorName(c.hex, c.contexts),
        group: inferColorGroup(c.contexts, c.hex),
        role: generateColorRole(c, c.contexts)
      }));
    }

    enrichedData.colors = assignColorSemantics(enrichedData.colors);

    // 13. 推断 color_scheme 和 category
    const colorScheme = inferColorScheme(enrichedData.colors);
    const category = inferCategory(enrichedData.colors, colorScheme);

    // 14. 生成 Markdown
    const designMd = generateDesignMd({ ...enrichedData, colorScheme });

    // 15. 截图（失败不影响主流程）
    let screenshotBuffer = null;
    if (options.captureScreenshot) {
      console.error(`[extractor-v2] Capturing screenshot...`);
      try {
        screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
        console.error(`[extractor-v2] Screenshot captured: ${screenshotBuffer?.length || 0} bytes`);
      } catch (screenshotErr) {
        console.error(`[extractor-v2] Screenshot failed (non-fatal): ${screenshotErr.message}`);
        // 降级：尝试截取可见区域
        try {
          screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
          console.error(`[extractor-v2] Fallback screenshot captured: ${screenshotBuffer?.length || 0} bytes`);
        } catch (fallbackErr) {
          console.error(`[extractor-v2] Fallback screenshot also failed: ${fallbackErr.message}`);
          screenshotBuffer = null;
        }
      }
    }

    // 14. 组装最终响应
    const duration = Date.now() - startTime;
    console.error(`[extractor-v2] Done in ${duration}ms`);

    await browser.close();

    return {
      success: true,
      siteName: enrichedData.siteName,
      designMd,
      colors: enrichedData.colors,
      fonts: enrichedData.fonts,
      typography: { scale: enrichedData.typeScale },
      gradient: enrichedData.gradients,
      typeScale: enrichedData.typeScale,
      spacing: enrichedData.spacing,
      shadows: enrichedData.shadows,
      borderRadius: enrichedData.borderRadius,
      animations: enrichedData.animations,
      northStar: enrichedData.northStar || null,
      colorScheme,
      category,
      screenshot: screenshotBuffer,
      cssSize: 0
    };

  } catch (error) {
    await browser.close();
    return {
      success: false,
      error: error.message
    };
  }
}

// CLI 接口
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node extractor-v2.js <url>');
    process.exit(1);
  }

  extractDesignTokens(url).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
