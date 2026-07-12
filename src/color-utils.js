/**
 * 颜色工具函数
 *
 * 从渲染后的 DOM 提取设计 tokens 中的颜色处理工具
 */

// ============================================================
// 基础颜色函数
// ============================================================// ============================================================
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
