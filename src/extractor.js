/**
 * DOM 提取工具
 *
 * 从页面提取样式、字体、布局、组件等信息
 */

import { parseColor } from './color-utils.js';

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

  sorted.slice(0, 14).forEach(([value], i) => {
    tokens[`spacing-${i + 1}`] = value;
  });

  return { values: sorted, tokens };
}

/**
 * 推断间距基础网格单位
 * 通过分析间距值的公约数倾向，检测设计系统的基础单位（4px/8px 等）
 */
function inferSpacingBase(values) {
  if (!values || values.length === 0) return null;

  // 提取所有间距数值（px 单位）
  const nums = values
    .map(([v]) => {
      const m = v.match(/^(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    })
    .filter(v => v !== null && v > 0 && v < 200);

  if (nums.length < 2) return null;

  // 计算数值间的最大公约数倾向
  // 对常见网格单位（2/4/5/6/8/10/12）投票
  const candidates = [2, 4, 5, 6, 8, 10, 12];
  const scores = candidates.map(candidate => {
    const exact = nums.filter(n => Math.abs(n % candidate) < 0.5 || Math.abs(n % candidate - candidate) < 0.5);
    const near = nums.filter(n => {
      const rem = n % candidate;
      return rem < 1 || (candidate - rem) < 1;
    });
    return { base: candidate, score: exact.length * 2 + near.length, exactCount: exact.length };
  });

  scores.sort((a, b) => b.score - a.score);

  // 如果最高分明显领先且至少有 3 个数值匹配
  if (scores[0].score >= 3) {
    return scores[0].base;
  }

  // 回退：取最小非零间距作为 hint
  const minVal = Math.min(...nums);
  if (minVal <= 4) return 4;
  if (minVal <= 8) return 8;
  return null;
}

/**
 * 聚类阴影值
 */
function clusterShadows(rawShadows) {
  const entries = Object.entries(rawShadows);
  const sorted = entries.sort((a, b) => b[1].count - a[1].count);

  const tokens = {};
  const names = ['sm', 'md', 'lg', 'xl', '2xl', '3xl'];

  sorted.slice(0, 6).forEach(([value], i) => {
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
  const names = ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full'];

  // 特殊处理 full (9999px / 50% / 科学计数法大值)
  const fullVal = sorted.find(([value]) => {
    if (value.includes('9999') || value.includes('50%') || value.includes('e+')) return true;
    const px = parseFloat(value);
    return px > 1000;
  });
  if (fullVal) {
    tokens['radius-full'] = fullVal[0];
  }

  // 其他值（跳过 full 值）
  let nonFullIdx = 0;
  sorted.forEach(([value], i) => {
    if (value.includes('9999') || value.includes('50%') || value.includes('e+')) return;
    const px = parseFloat(value);
    if (px > 1000) return;
    if (nonFullIdx >= 6) return;
    if (!tokens[`radius-${names[nonFullIdx]}`]) {
      tokens[`radius-${names[nonFullIdx]}`] = value;
    }
    nonFullIdx++;
  });

  return { values: sorted, tokens };
}

/**
 * 根据颜色推断 color_scheme (light/dark)
 */

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

  // 收集完整 font-family fallback 链
  let fontStack = '';
  try {
    fontStack = await page.evaluate(() => {
      const body = document.body;
      if (body) {
        const style = window.getComputedStyle(body);
        // 取最常用的 font-family 值
        return style.fontFamily || '';
      }
      return '';
    });
  } catch (e) {
    // 静默失败
  }

  return Array.from(fonts.values()).map(f => ({
    fontFamily: f.fontFamily,
    weights: Array.from(f.weights).sort((a, b) => a - b),
    source: f.source,
    fontStack: fontStack || undefined,
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
/**
 * 提取间距 tokens 含 base grid 检测
 */
async function extractSpacing(page) {
  const spacings = await page.evaluate(() => {
    const trackValue = (vm, v, ctx) => {
      if (!vm.has(v)) vm.set(v, { count: 0, contexts: [] });
      const e = vm.get(v);
      e.count++;
      if (!e.contexts.includes(ctx)) e.contexts.push(ctx);
    };
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

  const result = clusterSpacingValues(spacings);
  result.base = inferSpacingBase(result.values);

  return result;
}

/**
 * 提取阴影 tokens
 */
async function extractShadows(page) {
  const shadows = await page.evaluate(() => {
    const trackValue = (vm, v, ctx) => {
      if (!vm.has(v)) vm.set(v, { count: 0, contexts: [] });
      const e = vm.get(v);
      e.count++;
      if (!e.contexts.includes(ctx)) e.contexts.push(ctx);
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
      if (className.match(/card|modal|dropdown|menu|nav/i)) return className.split(' ')[0];
      return tag;
    };
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
    const trackValue = (vm, v, ctx) => {
      if (!vm.has(v)) vm.set(v, { count: 0, contexts: [] });
      const e = vm.get(v);
      e.count++;
      if (!e.contexts.includes(ctx)) e.contexts.push(ctx);
    };
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
    const trackValue = (vm, v, ctx) => {
      if (!vm.has(v)) vm.set(v, { count: 0, contexts: [] });
      const e = vm.get(v);
      e.count++;
      if (!e.contexts.includes(ctx)) e.contexts.push(ctx);
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
      if (className.match(/card|modal|dropdown|menu|nav/i)) return className.split(' ')[0];
      return tag;
    };
    const values = new Map();

    document.querySelectorAll('div, button, input, img, a, span, p').forEach(el => {
      const style = window.getComputedStyle(el);
      const radius = style.borderRadius;

      if (radius && radius !== '0px' && radius !== '0') {
        // 跳过不合理的大值（避免科学计数法产生的假值）
        const pxVal = parseFloat(radius);
        if (pxVal > 0 && pxVal < 1000) {
          const ctx = getElementContext(el);
          trackValue(values, radius, ctx);
        }
      }
    });

    return Object.fromEntries(values);
  });

  return clusterRadiiValues(radii);
}

// ============================================================
// 5.5 CSS 变量与断点检测
// ============================================================

/**
 * 从页面提取 CSS 自定义属性定义
 * 遍历 document.styleSheets 收集所有 --* 变量
 */
export async function collectCSSVariables(page) {
  try {
    return await page.evaluate(() => {
      const variables = {};

      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;

          for (const rule of rules) {
            // 检查 style 规则中的 CSS 变量
            if (rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const name = rule.style[i];
                if (name.startsWith('--')) {
                  const value = rule.style.getPropertyValue(name).trim();
                  if (value && !variables[name]) {
                    variables[name] = value;
                  }
                }
              }
            }
            // 递归检查 @media 内的规则
            if (rule.cssRules) {
              for (const subRule of rule.cssRules) {
                if (subRule.style) {
                  for (let i = 0; i < subRule.style.length; i++) {
                    const name = subRule.style[i];
                    if (name.startsWith('--')) {
                      const value = subRule.style.getPropertyValue(name).trim();
                      if (value && !variables[name]) {
                        variables[name] = value;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // 跨域 stylesheet 会抛 SecurityError，静默跳过
        }
      }

      return variables;
    });
  } catch (e) {
    return {};
  }
}

/**
 * 从页面提取响应式断点
 * 遍历 document.styleSheets 收集 @media 规则
 */
export async function detectBreakpoints(page) {
  try {
    return await page.evaluate(() => {
      const breakpoints = new Set();

      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;

          for (const rule of rules) {
            if (rule.constructor.name === 'CSSMediaRule') {
              const mediaText = rule.conditionText || rule.media?.mediaText;
              if (!mediaText) continue;

              // 提取 min-width 和 max-width
              const minMatch = mediaText.match(/min-width\s*:\s*(\d+)px/i);
              const maxMatch = mediaText.match(/max-width\s*:\s*(\d+)px/i);

              if (minMatch || maxMatch) {
                const parts = [];
                if (minMatch) parts.push(`min:${minMatch[1]}px`);
                if (maxMatch) parts.push(`max:${maxMatch[1]}px`);
                breakpoints.add(parts.join(' → '));
              }
            }
          }
        } catch (e) {
          // 跨域 stylesheet，静默跳过
        }
      }

      return Array.from(breakpoints).sort();
    });
  } catch (e) {
    return [];
  }
}

// ============================================================
// 5.7 Layout 深度检测
// ============================================================

/**
 * 从页面提取布局信息（grid/flex/容器宽度）
 */
export async function extractLayout(page) {
  try {
    return await page.evaluate(() => {
      const result = { grids: [], flexes: [], containers: [] };
      const seenGrids = new Set();
      const seenFlexes = new Set();
      const seenContainers = new Set();

      // 收集 grid/flex 容器
      document.querySelectorAll('div, section, main, article, aside, nav, header, footer, ul, ol').forEach(el => {
        const style = window.getComputedStyle(el);
        const display = style.display;

        // Grid 容器
        if (display === 'grid' || display === 'inline-grid') {
          const cols = style.gridTemplateColumns;
          const gap = style.gap || style.columnGap || '0px';
          const key = `${cols}|${gap}`;
          if (!seenGrids.has(key)) {
            seenGrids.add(key);
            result.grids.push({
              columns: cols,
              gap: gap,
              count: 1
            });
          } else {
            const existing = result.grids.find(g => g.columns === cols && g.gap === gap);
            if (existing) existing.count++;
          }
        }

        // Flex 容器
        if (display === 'flex' || display === 'inline-flex') {
          const dir = style.flexDirection;
          const gap = style.gap || style.columnGap || '0px';
          const justify = style.justifyContent;
          const align = style.alignItems;
          const key = `${dir}|${gap}|${justify}|${align}`;
          if (!seenFlexes.has(key)) {
            seenFlexes.add(key);
            result.flexes.push({
              direction: dir,
              gap: gap,
              justifyContent: justify,
              alignItems: align,
              count: 1
            });
          } else {
            const existing = result.flexes.find(f =>
              f.direction === dir && f.gap === gap &&
              f.justifyContent === justify && f.alignItems === align
            );
            if (existing) existing.count++;
          }
        }

        // 容器宽度
        const maxWidth = style.maxWidth;
        const width = style.width;
        if (maxWidth && maxWidth !== 'none' && maxWidth !== '') {
          const key = `max:${maxWidth}`;
          if (!seenContainers.has(key)) {
            seenContainers.add(key);
            result.containers.push({ maxWidth, count: 1 });
          } else {
            const existing = result.containers.find(c => c.maxWidth === maxWidth);
            if (existing) existing.count++;
          }
        }
      });

      // 只保留重复 >= 3 次的模式（过滤噪音）
      result.grids = result.grids
        .filter(g => g.count >= 3 && g.columns !== 'none' && g.columns !== 'normal' && !g.columns.includes('0px'));
      result.flexes = result.flexes
        .filter(f => f.count >= 3 && f.direction !== 'none' && f.direction !== 'normal');
      result.containers = result.containers.filter(c => c.count >= 1);

      return result;
    });
  } catch (e) {
    return { grids: [], flexes: [], containers: [] };
  }
}

// ============================================================
// 5.8 组件检测
// ============================================================

/**
 * 计算元素的结构指纹，用于聚类相似组件
 * 指纹包含：tag、class 模式、子元素结构、role 属性
 */
function computeComponentFingerprint(el) {
  const tag = el.tagName?.toLowerCase() || '';
  const role = el.getAttribute('role') || '';
  const cls = (el.className || '');
  // 正则化 class 名称：去除非字母数字，排序
  const normalizedClasses = cls
    .split(/\s+/)
    .filter(c => c && c.length > 0)
    .map(c => c.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())
    .filter(c => c.length > 0)
    .sort()
    .join(' ');

  // 统计子元素类型
  const childCount = el.children?.length || 0;
  const childTags = {};
  if (el.children) {
    for (const child of el.children) {
      const ct = child.tagName?.toLowerCase() || 'unknown';
      childTags[ct] = (childTags[ct] || 0) + 1;
    }
  }
  const childTagStr = Object.entries(childTags)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, cnt]) => `${t}×${cnt}`)
    .join(',');

  // 检测是否有文本内容（非空）
  const textContent = (el.textContent || '').trim();
  const hasText = textContent.length > 0;
  const textLen = textContent.length;

  // 检测是否有图片
  const hasImg = el.querySelector('img, svg') !== null;

  // 计算最具体的 class 前缀（用于命名提示）
  let classPrefix = '';
  const classParts = cls.split(/\s+/).filter(c => c && c.length > 0);
  if (classParts.length > 0) {
    // 取最长且非唯一性的 class 作为前缀
    classPrefix = classParts.reduce((a, b) => b.length > a.length ? b : a);
  }

  return {
    tag,
    role,
    classPrefix,
    normalizedClasses,
    childCount,
    childTagStr,
    hasText,
    textLen,
    hasImg,
    // 简化的指纹字符串
    fingerprint: `${tag}|${role}|${normalizedClasses}|${childTagStr}|${hasImg ? 'img' : 'noimg'}`,
  };
}

/**
 * 从页面提取候选组件
 * 遍历 DOM，按结构指纹聚类候选组件
 */
export async function extractComponents(page) {
  try {
    return await page.evaluate(() => {
      const componentGroups = new Map(); // fingerprint -> { count, elements, representative }

      // 候选选择器：常见组件模式的元素
      const candidates = document.querySelectorAll(
        'div, section, article, nav, header, footer, aside, ' +
        'button, a, form, [role="dialog"], [role="tabpanel"], [role="listbox"], ' +
        '[class*="card"], [class*="item"], [class*="row"], [class*="col"], ' +
        '[class*="box"], [class*="panel"], [class*="widget"], [class*="component"], ' +
        'li, [class*="nav-"], [class*="menu-"], [class*="tab-"]'
      );

      candidates.forEach((el, index) => {
        // 跳过不可见元素
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' ||
            parseFloat(style.opacity) === 0 || el.offsetWidth === 0) {
          return;
        }

        // 跳过纯文本容器（只有文本，没有子元素）
        if (el.children.length === 0 && !el.textContent?.trim()) {
          return;
        }

        // 跳过 body 和 html
        const tag = el.tagName?.toLowerCase() || '';
        if (tag === 'body' || tag === 'html') {
          return;
        }

        // 计算指纹
        const cls = (el.className || '');
        const role = el.getAttribute('role') || '';
        const normalizedClasses = cls
          .split(/\s+/)
          .filter(c => c && c.length > 0)
          .map(c => c.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())
          .filter(c => c.length > 0)
          .sort()
          .join(' ');

        const childTags = {};
        for (const child of el.children) {
          const ct = child.tagName?.toLowerCase() || 'unknown';
          childTags[ct] = (childTags[ct] || 0) + 1;
        }
        const childTagStr = Object.entries(childTags)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([t, cnt]) => `${t}×${cnt}`)
          .join(',');

        const hasImg = el.querySelector('img, svg') !== null;

        const fingerprint = `${tag}|${role}|${normalizedClasses}|${childTagStr}|${hasImg ? 'img' : 'noimg'}`;

        if (!componentGroups.has(fingerprint)) {
          // 取第一个作为代表元素
          let classPrefix = '';
          const classParts = cls.split(/\s+/).filter(c => c && c.length > 0);
          if (classParts.length > 0) {
            classPrefix = classParts.reduce((a, b) => b.length > a.length ? b : a);
          }

          const textContent = (el.textContent || '').trim();
          const hasText = textContent.length > 0;
          const textLen = textContent.length;

          componentGroups.set(fingerprint, {
            count: 0,
            classPrefix,
            tag,
            role,
            childCount: el.children.length,
            childTagStr,
            hasImg,
            hasText,
            textLen,
            // 存储前 3 个元素的 selector 用于定位
            sampleSelectors: [],
          });
        }

        const group = componentGroups.get(fingerprint);
        group.count++;

        // 收集 sample selector（最多 3 个）
        if (group.sampleSelectors.length < 3) {
          if (el.id) {
            group.sampleSelectors.push(`#${el.id}`);
          } else if (el.className && typeof el.className === 'string') {
            const firstClass = el.className.split(/\s+/)[0].replace(/[^a-zA-Z0-9-]/g, '');
            if (firstClass) {
              group.sampleSelectors.push(`${tag}.${firstClass}[${index}]`);
            } else {
              group.sampleSelectors.push(`${tag}[${index}]`);
            }
          } else {
            group.sampleSelectors.push(`${tag}[${index}]`);
          }
        }
      });

      // 转换为数组，过滤低频模式
      const result = [];
      componentGroups.forEach((group, fingerprint) => {
        // 只保留 >= 3 次出现的模式
        if (group.count >= 3) {
          result.push({
            name: null, // LLM 将填充
            count: group.count,
            classPrefix: group.classPrefix,
            tag: group.tag,
            role: group.role,
            childCount: group.childCount,
            childTagStr: group.childTagStr,
            hasImg: group.hasImg,
            hasText: group.hasText,
            sampleSelectors: group.sampleSelectors,
            fingerprint,
          });
        }
      });

      // 按频率排序
      result.sort((a, b) => b.count - a.count);

      // 只返回前 15 个候选
      return result.slice(0, 15);
    });
  } catch (e) {
    return [];
  }
}

