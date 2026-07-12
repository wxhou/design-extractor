/**
 * 导出格式工具
 */

export function toCssName(name) {
  return name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/**
 * 获取指定格式的代码
 */
export function getFormatCode(fmt, colors, gradients, fonts, typeScale, card, variablesCss, themeCss, tokensJson) {
  // 优先使用服务端预生成的格式
  if (fmt === 'CSS Variables' && variablesCss) return variablesCss;
  if (fmt === 'Tailwind v4' && themeCss) return themeCss;
  if (fmt === 'Design Tokens' && tokensJson) return tokensJson;

  // 兜底：客户端生成
  if (fmt === 'CSS Variables') {
    const lines = [':root {'];
    const brand = colors.filter(c => c.group === 'brand');
    const accent = colors.filter(c => c.group === 'accent');
    const neutral = colors.filter(c => c.group === 'neutral');
    if (brand.length > 0) { lines.push('  /* Brand Colors */'); brand.forEach(c => lines.push(`  --color-${toCssName(c.name||c.hex)}: ${c.hex};`)); lines.push(''); }
    if (accent.length > 0) { lines.push('  /* Accent Colors */'); accent.forEach(c => lines.push(`  --color-${toCssName(c.name||c.hex)}: ${c.hex};`)); lines.push(''); }
    if (neutral.length > 0) { lines.push('  /* Neutral Colors */'); neutral.forEach(c => lines.push(`  --color-${toCssName(c.name||c.hex)}: ${c.hex};`)); lines.push(''); }
    const other = colors.filter(c => !c.group);
    if (other.length > 0) { lines.push('  /* Other Colors */'); other.forEach(c => lines.push(`  --color-${toCssName(c.name||c.hex)}: ${c.hex};`)); lines.push(''); }
    if (gradients.length > 0) { lines.push('  /* Gradients */'); gradients.forEach((g,i) => lines.push(`  --gradient-${toCssName(g.type||`gradient-${i+1}`)}: ${g.value||g.css||g};`)); lines.push(''); }
    if (fonts.length > 0) { lines.push('  /* Font Families */'); fonts.forEach(f => lines.push(`  --font-family-${toCssName(f.fontFamily)}: "${f.fontFamily}", sans-serif;`)); lines.push(''); }
    if (typeScale?.steps?.length > 0) { lines.push('  /* Font Sizes */'); typeScale.steps.forEach(s => lines.push(`  --font-size-${toCssName(s.name||s.role||`step-${s.size}`)}: ${s.size}px;`)); if (typeScale.base) lines.push(`  --font-size-base: ${typeScale.base}px;`); lines.push(''); }
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    lines.push('}');
    return lines.join('\n');
  } else if (fmt === 'Tailwind v4') {
    const lines = ['@theme {'];
    if (colors.length > 0) { lines.push('  /* Colors */'); colors.forEach(c => lines.push(`  --color-${toCssName(c.name||c.hex)}: ${c.hex};`)); lines.push(''); }
    if (gradients.length > 0) { lines.push('  /* Gradients */'); gradients.forEach((g,i) => lines.push(`  --gradient-${toCssName(g.type||`gradient-${i+1}`)}: ${g.value||g.css||g};`)); lines.push(''); }
    if (fonts.length > 0) { lines.push('  /* Font Families */'); fonts.forEach(f => lines.push(`  --font-family-${toCssName(f.fontFamily)}: "${f.fontFamily}", sans-serif;`)); lines.push(''); }
    if (typeScale?.steps?.length > 0) { lines.push('  /* Font Sizes */'); typeScale.steps.forEach(s => lines.push(`  --font-size-${toCssName(s.name||s.role||`step-${s.size}`)}: ${s.size}px;`)); if (typeScale.base) lines.push(`  --font-size-base: ${typeScale.base}px;`); lines.push(''); }
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    lines.push('}');
    return lines.join('\n');
  } else {
    // DTCG standard Design Tokens JSON
    const tokens = { $schema: 'https://design-tokens.github.io/community-group/format/' };
    if (colors.length > 0) { tokens.colors = {}; colors.forEach(c => { tokens.colors[toCssName(c.name||c.hex)] = { $value: c.hex, $type: 'color', $description: c.role || `${c.name||c.hex} color` }; }); }
    if (gradients.length > 0) { tokens.gradients = {}; gradients.forEach((g,i) => { tokens.gradients[toCssName(g.type||`gradient-${i+1}`)] = { $value: g.value||g.css||'', $type: 'gradient' }; }); }
    if (fonts.length > 0 || typeScale?.steps?.length > 0) { tokens.typography = {}; if (fonts.length > 0) { tokens.typography.fontFamily = {}; fonts.forEach(f => { tokens.typography.fontFamily[toCssName(f.fontFamily)] = { $value: [f.fontFamily], $type: 'fontFamily' }; }); } if (typeScale?.steps?.length > 0) { tokens.typography.fontSize = {}; typeScale.steps.forEach(s => { tokens.typography.fontSize[toCssName(s.name||s.role||`step-${s.size}`)] = { $value: `${s.size}px`, $type: 'dimension' }; }); } }
    tokens.$metadata = { name: card?.name || 'Design Tokens' };
    return JSON.stringify(tokens, null, 2);
  }
}

/**
 * 获取 Style Dictionary 格式
 */
export function getStyleDictionary(colors, fonts, ds, raw, card) {
  // 从 ds.spacing 解析 tokens
  const spacingTokens = {};
  if (ds.spacing?.tokens) {
    Object.entries(ds.spacing.tokens).forEach(([k, v]) => { spacingTokens[k] = v; });
  } else if (ds.spacing && typeof ds.spacing === 'object') {
    Object.entries(ds.spacing).forEach(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        Object.entries(v).forEach(([sk, sv]) => { spacingTokens[`${k}-${sk}`] = sv; });
      } else {
        spacingTokens[k] = v;
      }
    });
  }

  // 从 raw.shapes 解析 shadows 和 borderRadius
  const shadowTokens = {};
  const radiusTokens = {};
  if (raw.shapes?.shadows) {
    raw.shapes.shadows.slice(0, 4).forEach((s, i) => {
      const names = ['sm', 'md', 'lg', 'xl'];
      shadowTokens[`shadow-${names[i]}`] = typeof s === 'string' ? s : (s.value || s.shadow);
    });
  }
  if (raw.shapes?.radii) {
    raw.shapes.radii.slice(0, 4).forEach((r, i) => {
      const names = ['sm', 'md', 'lg', 'full'];
      radiusTokens[`radius-${names[i]}`] = `${r.value}px`;
    });
  }

  const tokenSets = [];
  const sd = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
  };

  // Colors
  if (colors.length > 0) {
    sd.color = {};
    for (const c of colors) {
      const key = toCssName(c.name || c.hex);
      sd.color[key] = { $value: c.hex, $type: 'color' };
      if (c.role) sd.color[key].$description = c.role;
    }
    tokenSets.push('color');
  }

  // Typography
  if (fonts.length > 0) {
    sd.typography = { fontFamily: {} };
    for (const f of fonts) {
      sd.typography.fontFamily[toCssName(f.fontFamily)] = { $value: [f.fontFamily], $type: 'fontFamily' };
    }
    tokenSets.push('typography');
  }

  // Spacing
  if (Object.keys(spacingTokens).length > 0) {
    sd.spacing = {};
    for (const [name, value] of Object.entries(spacingTokens)) {
      const key = name.replace('spacing-', '');
      sd.spacing[toCssName(key)] = { $value: value, $type: 'dimension' };
    }
    tokenSets.push('spacing');
  }

  // Shadows
  if (Object.keys(shadowTokens).length > 0) {
    sd.shadow = {};
    for (const [name, value] of Object.entries(shadowTokens)) {
      const key = name.replace('shadow-', '');
      sd.shadow[toCssName(key)] = { $value: value, $type: 'shadow' };
    }
    tokenSets.push('shadow');
  }

  // Border Radius
  if (Object.keys(radiusTokens).length > 0) {
    sd.borderRadius = {};
    for (const [name, value] of Object.entries(radiusTokens)) {
      const key = name.replace('radius-', '');
      sd.borderRadius[toCssName(key)] = { $value: value, $type: 'dimension' };
    }
    tokenSets.push('borderRadius');
  }

  sd.$metadata = {
    name: card?.name || 'Design Tokens',
    source: card?.url || '',
    format: 'Style Dictionary',
    tokenSetOrder: tokenSets,
  };

  return JSON.stringify(sd, null, 2);
}

/**
 * 获取当前导出格式的代码
 */
export function getExportCode(exportFormat, colors, gradients, fonts, typeScale, card, variablesCss, themeCss, tokensJson, ds, raw) {
  // 如果格式是 "Style Dictionary"，调用专门的函数
  if (exportFormat === 'Style Dictionary') {
    return getStyleDictionary(colors, fonts, ds, raw, card);
  }
  return getFormatCode(exportFormat, colors, gradients, fonts, typeScale, card, variablesCss, themeCss, tokensJson);
}