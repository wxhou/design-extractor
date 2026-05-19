/**
 * Design Tokens 对比引擎
 * 比较网站 tokens 与 Figma tokens 的差异
 */

/**
 * 比较两种 tokens 并生成对比报告
 * @param {object} websiteTokens - 网站提取的 tokens
 * @param {object} figmaTokens - Figma 文件提取的 tokens
 * @returns {object} 对比结果
 */
export function compareTokens(websiteTokens, figmaTokens) {
  const result = {
    summary: {
      totalWebsite: 0,
      totalFigma: 0,
      matched: 0,
      missing: 0, // 网站有，Figma 无
      undefined: 0, // Figma 有，网站无
      matchRate: 0,
    },
    colors: {
      matched: [],
      missing: [],
      undefined: [],
    },
    typography: {
      matched: [],
      missing: [],
      undefined: [],
    },
    shadows: {
      matched: [],
      missing: [],
      undefined: [],
    },
  };

  // 比较颜色
  const colorResult = compareColorTokens(
    websiteTokens.colors || [],
    figmaTokens.colors || []
  );
  result.colors = colorResult.colors;
  result.summary.matched += colorResult.matched;
  result.summary.missing += colorResult.missing;
  result.summary.undefined += colorResult.undefined;
  result.summary.totalWebsite += (websiteTokens.colors || []).length;
  result.summary.totalFigma += (figmaTokens.colors || []).length;

  // 比较字体
  const fontResult = compareTypographyTokens(
    websiteTokens.fonts || [],
    figmaTokens.typography || []
  );
  result.typography = fontResult.typography;
  result.summary.matched += fontResult.matched;
  result.summary.missing += fontResult.missing;
  result.summary.undefined += fontResult.undefined;
  result.summary.totalWebsite += (websiteTokens.fonts || []).length;
  result.summary.totalFigma += (figmaTokens.typography || []).length;

  // 比较阴影
  const shadowResult = compareShadowTokens(
    websiteTokens.shadows || websiteTokens.borderRadius || [],
    figmaTokens.shadows || []
  );
  result.shadows = shadowResult.shadows;
  result.summary.matched += shadowResult.matched;
  result.summary.missing += shadowResult.missing;
  result.summary.undefined += shadowResult.undefined;
  result.summary.totalWebsite += (websiteTokens.shadows || []).length;
  result.summary.totalFigma += (figmaTokens.shadows || []).length;

  // 计算匹配率
  const total = result.summary.totalFigma;
  if (total > 0) {
    result.summary.matchRate = Math.round((result.summary.matched / total) * 100);
  }

  return result;
}

/**
 * 比较颜色 tokens
 */
function compareColorTokens(websiteColors, figmaColors) {
  const result = {
    colors: {
      matched: [],
      missing: [],
      undefined: [],
    },
    matched: 0,
    missing: 0,
    undefined: 0,
  };

  // 创建 Figma 颜色查找表
  const figmaColorMap = new Map();
  for (const color of figmaColors) {
    const key = normalizeColorKey(color);
    if (!figmaColorMap.has(key)) {
      figmaColorMap.set(key, []);
    }
    figmaColorMap.get(key).push(color);
  }

  // 检查网站颜色是否在 Figma 中
  for (const color of websiteColors) {
    const key = normalizeColorKey(color);
    if (figmaColorMap.has(key)) {
      result.colors.matched.push({
        website: color,
        figma: figmaColorMap.get(key)[0],
      });
      result.matched++;
    } else {
      result.colors.missing.push(color);
      result.missing++;
    }
  }

  // 检查 Figma 中是否有网站未使用的颜色
  const websiteColorKeys = new Set(websiteColors.map(normalizeColorKey));
  for (const color of figmaColors) {
    const key = normalizeColorKey(color);
    if (!websiteColorKeys.has(key)) {
      result.colors.undefined.push(color);
      result.undefined++;
    }
  }

  return result;
}

/**
 * 比较字体 tokens
 */
function compareTypographyTokens(websiteFonts, figmaTypography) {
  const result = {
    typography: {
      matched: [],
      missing: [],
      undefined: [],
    },
    matched: 0,
    missing: 0,
    undefined: 0,
  };

  // 创建 Figma 字体查找表
  const figmaFontMap = new Map();
  for (const font of figmaTypography) {
    const key = normalizeFontKey(font);
    figmaFontMap.set(key, font);
  }

  // 检查网站字体是否在 Figma 中
  for (const font of websiteFonts) {
    const key = normalizeFontKey(font);
    if (figmaFontMap.has(key)) {
      result.typography.matched.push({
        website: font,
        figma: figmaFontMap.get(key),
      });
      result.matched++;
    } else {
      result.typography.missing.push(font);
      result.missing++;
    }
  }

  // 检查 Figma 中是否有网站未使用的字体
  const websiteFontKeys = new Set(websiteFonts.map(normalizeFontKey));
  for (const font of figmaTypography) {
    const key = normalizeFontKey(font);
    if (!websiteFontKeys.has(key)) {
      result.typography.undefined.push(font);
      result.undefined++;
    }
  }

  return result;
}

/**
 * 比较阴影 tokens
 */
function compareShadowTokens(websiteShadows, figmaShadows) {
  const result = {
    shadows: {
      matched: [],
      missing: [],
      undefined: [],
    },
    matched: 0,
    missing: 0,
    undefined: 0,
  };

  // 创建 Figma 阴影查找表
  const figmaShadowMap = new Map();
  for (const shadow of figmaShadows) {
    const key = normalizeShadowKey(shadow);
    figmaShadowMap.set(key, shadow);
  }

  // 检查网站阴影是否在 Figma 中
  for (const shadow of websiteShadows) {
    const key = normalizeShadowKey(shadow);
    if (figmaShadowMap.has(key)) {
      result.shadows.matched.push({
        website: shadow,
        figma: figmaShadowMap.get(key),
      });
      result.matched++;
    } else {
      result.shadows.missing.push(shadow);
      result.missing++;
    }
  }

  // 检查 Figma 中是否有网站未使用的阴影
  const websiteShadowKeys = new Set(websiteShadows.map(normalizeShadowKey));
  for (const shadow of figmaShadows) {
    const key = normalizeShadowKey(shadow);
    if (!websiteShadowKeys.has(key)) {
      result.shadows.undefined.push(shadow);
      result.undefined++;
    }
  }

  return result;
}

/**
 * 标准化颜色键值
 */
function normalizeColorKey(color) {
  if (typeof color === 'string') {
    return color.toLowerCase();
  }
  // 提取十六进制或 rgb 值
  if (color.hex) {
    return color.hex.toLowerCase();
  }
  if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
    return `rgb(${color.r},${color.g},${color.b})`.toLowerCase();
  }
  if (color.name) {
    return color.name.toLowerCase();
  }
  return JSON.stringify(color).toLowerCase();
}

/**
 * 标准化字体键值
 */
function normalizeFontKey(font) {
  if (typeof font === 'string') {
    return font.toLowerCase();
  }
  if (font.fontFamily) {
    return font.fontFamily.toLowerCase();
  }
  return JSON.stringify(font).toLowerCase();
}

/**
 * 标准化阴影键值
 */
function normalizeShadowKey(shadow) {
  if (typeof shadow === 'string') {
    return shadow.toLowerCase();
  }
  if (shadow.value) {
    return shadow.value.toLowerCase();
  }
  // 使用关键属性组合
  const parts = [
    shadow.offsetX || 0,
    shadow.offsetY || 0,
    shadow.radius || 0,
    shadow.color || '#000',
  ];
  return parts.join('-').toLowerCase();
}

/**
 * 生成对比结果 Markdown 报告
 * @param {object} comparison - 对比结果
 * @param {string} siteName - 网站名称
 * @returns {string} Markdown 格式报告
 */
export function generateComparisonMd(comparison, siteName) {
  let md = `# Design Tokens Comparison: ${siteName}\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Match Rate | ${comparison.summary.matchRate}% |\n`;
  md += `| Total Matched | ${comparison.summary.matched} |\n`;
  md += `| Missing (in website) | ${comparison.summary.missing} |\n`;
  md += `| Undefined (in Figma) | ${comparison.summary.undefined} |\n\n`;

  if (comparison.colors.matched.length > 0) {
    md += `## Matched Colors\n\n`;
    for (const item of comparison.colors.matched) {
      md += `- ${item.website.hex || item.website.name}\n`;
    }
    md += '\n';
  }

  if (comparison.colors.missing.length > 0) {
    md += `## Missing Colors (in website, not in Figma)\n\n`;
    for (const color of comparison.colors.missing) {
      md += `- ${color.hex || color.name}\n`;
    }
    md += '\n';
  }

  if (comparison.colors.undefined.length > 0) {
    md += `## Undefined Colors (in Figma, not in website)\n\n`;
    for (const color of comparison.colors.undefined) {
      md += `- ${color.name || color.hex}\n`;
    }
    md += '\n';
  }

  return md;
}