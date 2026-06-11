#!/usr/bin/env node
/**
 * design-extractor-v2
 *
 * 从渲染后的 DOM 提取设计 tokens，配合 MiniMax AI 生成语义化命名
 */

import { chromium } from 'playwright-core';
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

/**
 * 根据上下文推断颜色分组
 */
export function inferColorGroup(contexts, hex) {
  if (!contexts || contexts.length === 0) return 'neutral';

  const hsl = getHslValues(hex);

  // 无彩色系
  if (hsl.s < 10) {
    return 'neutral';
  }

  // 按钮中出现
  if (contexts.includes('button')) {
    if (hsl.s > 20 && (hsl.l < 70 || hsl.l > 85)) {
      return 'brand';
    }
  }

  // CTA 按钮
  if (contexts.includes('nav') && contexts.includes('button')) {
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
  if (!contexts || contexts.length === 0) return 'Color';

  const primaryContext = contexts[0] || 'element';

  if (contexts.includes('button') && contexts.includes('nav')) {
    return `Primary action color — used for CTA buttons and navigation`;
  }
  if (contexts.includes('button')) {
    return `Button color — used for interactive elements`;
  }
  if (contexts.includes('heading')) {
    return `Heading color — used for titles and emphasis`;
  }
  if (contexts.includes('body')) {
    return `Body text color — used for paragraph content`;
  }
  if (contexts.includes('link')) {
    return `Link color — used for hyperlinks`;
  }
  if (contexts.includes('card')) {
    return `Card color — used for surface containers`;
  }
  if (contexts.includes('border')) {
    return `Border color — used for dividers and outlines`;
  }

  return `${primaryContext.charAt(0).toUpperCase() + primaryContext.slice(1)} color`;
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

    // 选择器：可能包含动效的元素
    const selectors = 'div, button, a, input, img, nav, header, footer, [class*="card"], [class*="modal"], [class*="dropdown"], [class*="menu"]';
    const elements = document.querySelectorAll(selectors);

    elements.forEach(el => {
      const style = window.getComputedStyle(el);

      // 提取 transition
      const transition = style.transition;
      if (transition && transition !== 'all 0s ease 0s' && transition !== 'none') {
        // 解析 transition 属性
        const parts = transition.split(/\s+/);
        let duration = '0s', delay = '0s', timing = 'ease', property = 'all';

        // 解析各个部分
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.endsWith('ms') || p.endsWith('s')) {
            if (!duration || duration === '0s') {
              duration = p;
            } else if (!delay || delay === '0s') {
              delay = p;
            }
          } else if (p.includes('ease') || p === 'linear' || p === 'step-start' || p === 'step-end' || p.includes('cubic-bezier') || p.includes('(')) {
            timing = p;
          } else if (p !== 'ease' && p !== 'linear' && p !== 'all' && !p.includes('ms') && !p.includes('s')) {
            property = p;
          }
        }

        if (duration !== '0s') {
          trackValue(transitions, duration, `duration:${property}`);
        }
        if (timing !== 'ease') {
          trackValue(easings, timing, 'timing-function');
        }
      }

      // 提取 animation
      const animation = style.animation;
      if (animation && animation !== 'none' && animation !== 'none 0s ease 0s') {
        const parts = animation.split(/\s+/);
        let name = '', duration = '0s', timing = 'ease', delay = '0s', count = '1', dir = 'normal', fill = 'none';

        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.endsWith('ms') || p.endsWith('s')) {
            if (!duration || duration === '0s') duration = p;
            else if (!delay || delay === '0s') delay = p;
          } else if (['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].includes(p)) {
            timing = p;
          } else if (['infinite', '1', '2', '3', '4', '5'].includes(p)) {
            count = p;
          } else if (['normal', 'reverse', 'alternate', 'alternate-reverse'].includes(p)) {
            dir = p;
          } else if (['none', 'forwards', 'backwards', 'both'].includes(p)) {
            fill = p;
          } else if (!['animation'].includes(p) && !p.includes('ms') && !p.includes('s') && !p.includes('(')) {
            name = p;
          }
        }

        if (name) {
          trackValue(animations, name, `duration:${duration}`);
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
 * 生成 DESIGN.md 格式的输出
 */
export function generateDesignMd(data) {
  const { siteName, colors, fonts, gradients, typeScale, northStar, url } = data;

  let md = `---
name: ${siteName}
description: Design tokens extracted from ${url}
north_star: "${northStar || ''}"
`;

  // Colors
  const brandColors = colors.filter(c => c.group === 'brand');
  const accentColors = colors.filter(c => c.group === 'accent');
  const neutralColors = colors.filter(c => c.group === 'neutral');

  md += `\ncolors:\n`;
  for (const c of colors.slice(0, 10)) {
    md += `  ${c.name}: "${c.hex}"\n`;
  }

  // Fonts
  md += `\ntypography:\n`;
  for (const f of fonts.slice(0, 3)) {
    md += `  - family: ${f.fontFamily}\n`;
    md += `    weights: [${f.weights.join(', ')}]\n`;
    md += `    source: ${f.source}\n`;
  }

  // Type scale
  if (typeScale && typeScale.steps) {
    md += `\ntype_scale:\n`;
    md += `  base: ${typeScale.base}\n`;
    for (const step of typeScale.steps.slice(0, 6)) {
      md += `  - ${step.name}: ${step.size}\n`;
    }
  }

  // Gradients
  if (gradients && gradients.length > 0) {
    md += `\ngradients:\n`;
    for (const g of gradients.slice(0, 5)) {
      md += `  - type: ${g.type}\n`;
      md += `    colors: [${g.colors.join(', ')}]\n`;
    }
  }

  // Spacing
  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    md += `\nspacing:\n`;
    for (const [name, value] of Object.entries(data.spacing.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  // Shadows
  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    md += `\nshadows:\n`;
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  // Border Radius
  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    md += `\nborder_radius:\n`;
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  // Animations
  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    md += `\nanimation_duration:\n`;
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    md += `\nanimation_easing:\n`;
    for (const [name] of Object.entries(data.animations.easings)) {
      md += `  ${toCssName(name)}: "${name}"\n`;
    }
  }

  // Prose
  md += `\n---\n\n`;
  md += `## ${siteName} Design System\n\n`;

  if (northStar) {
    md += `**Design Philosophy**: ${northStar}\n\n`;
  }

  if (brandColors.length > 0) {
    md += `### Brand Colors\n\n`;
    for (const c of brandColors) {
      md += `- **${c.name}** (${c.hex}): ${c.role}\n`;
    }
    md += `\n`;
  }

  if (accentColors.length > 0) {
    md += `### Accent Colors\n\n`;
    for (const c of accentColors) {
      md += `- **${c.name}** (${c.hex}): ${c.role}\n`;
    }
    md += `\n`;
  }

  md += `### Typography\n\n`;
  md += `Primary font: **${fonts[0]?.fontFamily || 'System'}**\n`;
  md += `Weights: ${fonts[0]?.weights.join(', ') || '400'}\n`;

  // Spacing Section
  if (data.spacing?.tokens && Object.keys(data.spacing.tokens).length > 0) {
    md += `\n### Spacing\n\n`;
    for (const [name, value] of Object.entries(data.spacing.tokens)) {
      md += `- **${name}** ${value}\n`;
    }
    md += `\n`;
  }

  // Shadows Section
  if (data.shadows?.tokens && Object.keys(data.shadows.tokens).length > 0) {
    md += `### Shadows\n\n`;
    for (const [name, value] of Object.entries(data.shadows.tokens)) {
      md += `- **${name}** ${value}\n`;
    }
    md += `\n`;
  }

  // Border Radius Section
  if (data.borderRadius?.tokens && Object.keys(data.borderRadius.tokens).length > 0) {
    md += `### Border Radius\n\n`;
    for (const [name, value] of Object.entries(data.borderRadius.tokens)) {
      md += `- **${name}** ${value}\n`;
    }
    md += `\n`;
  }

  // Animation Duration Section
  if (data.animations?.durationTokens?.tokens && Object.keys(data.animations.durationTokens.tokens).length > 0) {
    md += `### Animation Timing\n\n`;
    md += `| Token | Value | Description |\n|-------|-------|-------------|\n`;
    const nameDescMap = {
      'duration-fast': 'Quick feedback',
      'duration-base': 'Default transition',
      'duration-slow': 'Page transitions'
    };
    for (const [name, value] of Object.entries(data.animations.durationTokens.tokens)) {
      const desc = nameDescMap[name] || '';
      md += `| --${name} | ${value} | ${desc} |\n`;
    }
    md += `\n`;
  }

  // Animation Easing Section
  if (data.animations?.easings && Object.keys(data.animations.easings).length > 0) {
    md += `### Animation Easing\n\n`;
    for (const [easing] of Object.entries(data.animations.easings)) {
      md += `- **${easing}**\n`;
    }
    md += `\n`;
  }

  return md;
}

// ============================================================
// 8. 主提取器
// ============================================================

/**
 * 主提取函数
 */
export async function extractDesignTokens(url, options = {}) {
  const startTime = Date.now();

  let browser;
  let context;
  try {
    // 1. Start browser
    const browserlessToken = process.env.BROWSERLESS_TOKEN;
    if (browserlessToken) {
      console.log(`[extractor-v2] Getting Browserless WebSocket URL...`);
      const versionResp = await fetch(`https://chrome.browserless.io/json/version?token=${browserlessToken}`);
      const versionData = await versionResp.json();
      const wsEndpoint = versionData.webSocketDebuggerUrl + (versionData.webSocketDebuggerUrl.includes('?') ? '&' : '?') + `token=${browserlessToken}`;
      console.log(`[extractor-v2] Connecting to Browserless: ${wsEndpoint.replace(/\/\/[^@]+@/, '//***@')}`);
      browser = await chromium.connect(wsEndpoint);
    } else {
      const chromiumPath = process.env.CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
      browser = await chromium.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 2. 规范化 URL（补全协议前缀）
    let targetUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // 先尝试 HTTPS，失败则降级到 HTTP
      try {
        console.log(`[extractor-v2] Trying HTTPS first: ${url}`);
        await page.goto('https://' + url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        targetUrl = 'https://' + url;
      } catch (httpsErr) {
        console.log(`[extractor-v2] HTTPS failed, trying HTTP: ${url}`);
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
    console.log(`[extractor-v2] Extracting styles...`);
    const styleData = await extractStylesFromPage(page);

    // 4. 聚类颜色
    console.log(`[extractor-v2] Clustering colors...`);
    const clusteredColors = clusterColors(styleData.colors);

    // 5. 提取字体
    console.log(`[extractor-v2] Extracting fonts...`);
    const fonts = await extractFonts(page);

    // 6. 提取字号层级
    console.log(`[extractor-v2] Extracting type scale...`);
    const typeScale = await extractTypeScale(page);

    // 7. 提取间距
    console.log(`[extractor-v2] Extracting spacing...`);
    const spacing = await extractSpacing(page);

    // 8. 提取阴影
    console.log(`[extractor-v2] Extracting shadows...`);
    const shadows = await extractShadows(page);

    // 9. 提取圆角
    console.log(`[extractor-v2] Extracting border radius...`);
    const borderRadius = await extractBorderRadius(page);

    // 10. 提取动效
    console.log(`[extractor-v2] Extracting animations...`);
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
      console.log(`[extractor-v2] Enriching with AI...`);
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

    // 11. 生成 Markdown
    const designMd = generateDesignMd(enrichedData);

    // 12. 推断 color_scheme 和 category
    const colorScheme = inferColorScheme(enrichedData.colors);
    const category = inferCategory(enrichedData.colors, colorScheme);

    // 13. 截图（失败不影响主流程）
    let screenshotBuffer = null;
    if (options.captureScreenshot) {
      console.log(`[extractor-v2] Capturing screenshot...`);
      try {
        screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
        console.log(`[extractor-v2] Screenshot captured: ${screenshotBuffer?.length || 0} bytes`);
      } catch (screenshotErr) {
        console.error(`[extractor-v2] Screenshot failed (non-fatal): ${screenshotErr.message}`);
        // 降级：尝试截取可见区域
        try {
          screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
          console.log(`[extractor-v2] Fallback screenshot captured: ${screenshotBuffer?.length || 0} bytes`);
        } catch (fallbackErr) {
          console.error(`[extractor-v2] Fallback screenshot also failed: ${fallbackErr.message}`);
          screenshotBuffer = null;
        }
      }
    }

    // 14. 组装最终响应
    const duration = Date.now() - startTime;
    console.log(`[extractor-v2] Done in ${duration}ms`);

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
    await context?.close();
    await browser?.close();
    return {
      success: false,
      error: error.message
    };
  } finally {
    await context?.close();
    await browser?.close();
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
