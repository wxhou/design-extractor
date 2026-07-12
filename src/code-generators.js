/**
 * 多格式输出工具
 *
 * 生成 CSS变量、Design Tokens、Style Dictionary、DESIGN.md 等格式
 */

import { getRelativeLuminance } from './color-utils.js';

// ============================================================
// 7. 多格式输出工具
// ============================================================

/**
 * Convert a name to a valid CSS custom property segment (kebab-case, alphanumeric only)
 */
export function toCssName(name) {
  if (typeof name !== 'string') return 'unknown';
  return name
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * 统一字体格式：支持 string[] 和 {fontFamily: string, ...}[] 两种格式
 */
function normalizeFonts(fonts) {
  return (fonts || []).map(f => typeof f === 'string' ? { fontFamily: f } : f);
}

/**
 * Generate DTCG standard tokens.json
 * @see https://design-tokens.github.io/community-group/format/
 */
export function generateTokensJson(data) {
  const { colors = [], fonts: rawFonts = [], typeScale, gradients = [], northStar, siteName } = data;
  const fonts = normalizeFonts(rawFonts);

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
    spacingBase: data.spacing?.base || null,
    cssVariables: data.cssVariables ? Object.keys(data.cssVariables).length : undefined,
    breakpoints: data.breakpoints || undefined,
  };

  return JSON.stringify(tokens, null, 2);
}

/**
 * Generate Style Dictionary compatible JSON format
 * @see https://styledictionary.com/
 */
export function generateStyleDictionary(data) {
  const { colors = [], fonts: rawFonts = [], typeScale, gradients = [], spacing, shadows, borderRadius, northStar, siteName, url } = data;
  const fonts = normalizeFonts(rawFonts);

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
    spacingBase: data.spacing?.base || null,
    breakpoints: data.breakpoints || undefined,
  };

  return JSON.stringify(tokens, null, 2);
}

/**
 * Generate CSS custom properties (variables.css)
 */
export function generateVariablesCss(data) {
  const { colors = [], fonts: rawFonts = [], typeScale, gradients = [] } = data;
  const fonts = normalizeFonts(rawFonts);

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
  const { colors = [], fonts: rawFonts = [], typeScale, gradients = [] } = data;
  const fonts = normalizeFonts(rawFonts);

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
 * 生成 DESIGN.md 格式的输出（对齐 DESIGN.md 规范 8 个 canonical sections）
 */
export function generateDesignMd(data) {
  const { siteName, colors, fonts, gradients, typeScale, northStar, url, spacing, shadows, borderRadius, animations, cssVariables, breakpoints, layout, dos, donts, agentPrompt, enrichedTypography, responsiveStrategy, breakpointRoles } = data;

  // ── YAML Front Matter ──
  let md = `---
version: alpha
name: "${siteName || 'Unknown'}"
description: "Design tokens extracted from ${url || siteName || 'a website'}"
`;

  // Colors
  if (colors && colors.length > 0) {
    md += `\ncolors:\n`;
    for (const c of colors.slice(0, 12)) {
      const name = toCssName(c.name || c.hex);
      md += `  ${name}: "${c.hex}"\n`;
    }
  }

  // Typography (full objects, from LLM enrichment if available)
  if (enrichedTypography && Object.keys(enrichedTypography).length > 0) {
    md += `\ntypography:\n`;
    for (const [role, obj] of Object.entries(enrichedTypography)) {
      md += `  ${role}:\n`;
      md += `    fontFamily: "${obj.fontFamily || fonts[0]?.fontFamily || 'sans-serif'}"\n`;
      md += `    fontSize: "${obj.fontSize || '16px'}"\n`;
      md += `    fontWeight: "${obj.fontWeight || '400'}"\n`;
      md += `    lineHeight: "${obj.lineHeight || '1.5'}"\n`;
      if (obj.letterSpacing) md += `    letterSpacing: "${obj.letterSpacing}"\n`;
    }
  }

  // Rounded
  if (borderRadius?.tokens && Object.keys(borderRadius.tokens).length > 0) {
    md += `\nrounded:\n`;
    for (const [name, value] of Object.entries(borderRadius.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  // Spacing
  if (spacing?.tokens && Object.keys(spacing.tokens).length > 0) {
    md += `\nspacing:\n`;
    for (const [name, value] of Object.entries(spacing.tokens)) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  // Spacing base
  if (spacing?.base) {
    md += `\nspacing_base: "${spacing.base}px"\n`;
  }

  // CSS Variables
  if (cssVariables && Object.keys(cssVariables).length > 0) {
    md += `\ncss_variables:\n`;
    const entries = Object.entries(cssVariables).slice(0, 20);
    for (const [name, value] of entries) {
      md += `  ${name}: "${value}"\n`;
    }
  }

  // Breakpoints
  if (breakpoints && breakpoints.length > 0) {
    md += `\nbreakpoints:\n`;
    for (const bp of breakpoints) {
      md += `  - "${bp}"\n`;
    }
  }

  md += `---\n\n`;

  // ── 1. Overview ──
  md += `## Overview\n\n`;
  if (northStar) {
    md += `${northStar}\n\n`;
  }
  if (fonts && fonts.length > 0) {
    const primaryFont = fonts[0];
    const stack = primaryFont.fontStack || primaryFont.fontFamily;
    md += `**Typography baseline:** ${stack} — ${primaryFont.weights?.join(', ') || '400'} weight range.\n\n`;
  }
  if (spacing?.base) {
    md += `**Spacing grid:** ${spacing.base}px base unit.\n\n`;
  }
  if (colors && colors.length > 0) {
    const scheme = colors.some(c => {
      const lum = getRelativeLuminance(c.hex);
      return lum < 0.3;
    }) ? 'dark' : 'light';
    md += `**Theme:** ${scheme === 'dark' ? 'Dark' : 'Light'}. ${colors.length} validated color tokens.\n\n`;
  }

  // ── 2. Colors ──
  if (colors && colors.length > 0) {
    md += `## Colors\n\n`;

    // Group by semantic role
    const brand = colors.filter(c => c.group === 'brand');
    const accent = colors.filter(c => c.group === 'accent');
    const neutral = colors.filter(c => c.group === 'neutral');
    const other = colors.filter(c => !c.group || c.group === 'other');

    if (brand.length > 0) {
      md += `### Brand Colors\n\n`;
      for (const c of brand) {
        md += `- **${c.name}** (${c.hex}): ${c.role || 'Brand color'}\n`;
      }
      md += `\n`;
    }

    if (accent.length > 0) {
      md += `### Accent Colors\n\n`;
      for (const c of accent) {
        md += `- **${c.name}** (${c.hex}): ${c.role || 'Accent color'}\n`;
      }
      md += `\n`;
    }

    if (neutral.length > 0) {
      md += `### Neutral Colors\n\n`;
      for (const c of neutral) {
        md += `- **${c.name}** (${c.hex}): ${c.role || 'Neutral color'}\n`;
      }
      md += `\n`;
    }

    // Text scale
    const textColors = colors.filter(c => c.properties?.includes('color'));
    if (textColors.length > 0) {
      md += `### Text Scale\n\n`;
      for (const c of textColors.slice(0, 5)) {
        md += `- **${c.name}** (${c.hex}): ${c.role || 'Text color'}\n`;
      }
      md += `\n`;
    }
  }

  // ── 3. Typography ──
  if (fonts && fonts.length > 0) {
    md += `## Typography\n\n`;
    for (const f of fonts.slice(0, 3)) {
      const stack = f.fontStack || f.fontFamily;
      md += `**${f.fontFamily}** — ${f.weights?.join(', ') || '400'} weights.\n`;
      md += `Font stack: ${stack}\n\n`;
    }

    // Type scale as table
    if (typeScale?.steps?.length > 0) {
      md += `| Role | Size | Weight | Line Height |\n`;
      md += `|------|------|--------|-------------|\n`;
      for (const step of typeScale.steps.slice(0, 8)) {
        const role = step.role || step.element || step.name || 'element';
        const weight = step.weight || fonts[0]?.weights?.[0] || '400';
        const lineHeight = step.lineHeight || '1.2';
        md += `| ${role} | ${step.px || parseFloat(step.size) || step.size}px | ${weight} | ${lineHeight} |\n`;
      }
      md += `\n`;
    }
  }

  // ── 4. Layout ──
  if (spacing?.tokens || breakpoints?.length > 0) {
    md += `## Layout & Spacing\n\n`;

    if (spacing?.base) {
      md += `**Base grid:** ${spacing.base}px.\n\n`;
    }

    if (spacing?.tokens && Object.keys(spacing.tokens).length > 0) {
      md += `Spacing tokens:\n\n`;
      const entries = Object.entries(spacing.tokens);
      // Show as comma-separated row
      md += `| Token | Value |\n|-------|-------|\n`;
      for (const [name, value] of entries) {
        md += `| ${name} | ${value} |\n`;
      }
      md += `\n`;
    }

    if (breakpoints && breakpoints.length > 0) {
      md += `**Responsive breakpoints:**\n\n`;
      for (const bp of breakpoints) {
        md += `- ${bp}\n`;
      }
      md += `\n`;

      // 响应式策略描述
      if (responsiveStrategy) {
        md += `**Responsive strategy:** ${responsiveStrategy}\n\n`;
      }
      // 断点角色映射
      if (breakpointRoles && Object.keys(breakpointRoles).length > 0) {
        md += `**Breakpoint roles:**\n\n`;
        for (const [role, value] of Object.entries(breakpointRoles)) {
          md += `- ${role}: ${value}\n`;
        }
        md += `\n`;
      }
    }

    // Layout depth (grid/flex)
    const lay = data.layout;
    if (lay) {
      if (lay.grids && lay.grids.length > 0) {
        md += `**Grid layout:**\n\n`;
        for (const g of lay.grids.slice(0, 3)) {
          const colCount = g.columns === 'none' || g.columns === 'normal' ? '?' : (g.columns.match(/(\d+)/)?.[1] || '?');
          const gap = g.gap === 'normal' ? '0px' : g.gap;
          md += `- ${colCount === '?' ? 'Variable' : colCount + '-column'} grid (gap: ${gap}, found ${g.count}x)\n`;
        }
        md += `\n`;
      }
      if (lay.flexes && lay.flexes.length > 0) {
        md += `**Flexbox layout:**\n\n`;
        for (const f of lay.flexes.slice(0, 3)) {
          const gap = f.gap === 'normal' ? '0px' : f.gap;
          md += `- ${f.direction} flex, justify:${f.justifyContent}, gap:${gap} (found ${f.count}x)\n`;
        }
        md += `\n`;
      }
      if (lay.containers && lay.containers.length > 0) {
        md += `**Container widths:**\n\n`;
        for (const c of lay.containers.slice(0, 3)) {
          md += `- max-width: ${c.maxWidth}\n`;
        }
        md += `\n`;
      }
    }
  }

  // ── 5. Elevation & Depth ──
  if (shadows?.tokens && Object.keys(shadows.tokens).length > 0) {
    md += `## Elevation & Depth\n\n`;
    for (const [name, value] of Object.entries(shadows.tokens)) {
      const truncated = value.length > 60 ? value.substring(0, 60) + '...' : value;
      md += `- **${name}**: ${truncated}\n`;
    }
    md += `\n`;
  }

  // ── 6. Shapes ──
  if (borderRadius?.tokens && Object.keys(borderRadius.tokens).length > 0) {
    md += `## Shapes\n\n`;
    md += `| Token | Value | Role |\n|-------|-------|------|\n`;
    const roleMap = {
      'radius-none': 'Hairline corner',
      'radius-xs': 'Subtle corner',
      'radius-sm': 'Control corner',
      'radius-md': 'Card corner',
      'radius-lg': 'Large surface corner',
      'radius-xl': 'Large surface corner',
      'radius-full': 'Pill / circle',
    };
    for (const [name, value] of Object.entries(borderRadius.tokens)) {
      const role = roleMap[name] || '';
      md += `| ${name} | ${value} | ${role} |\n`;
    }
    md += `\n`;
  }

  // ── 7. Components ──
  const components = data.components;
  if (components && components.length > 0) {
    md += `## Components\n\n`;
    for (const c of components) {
      const variants = c.variants && c.variants.length > 0 ? ` (${c.variants.join(', ')})` : '';
      const desc = c.description ? ` — ${c.description}` : '';
      md += `- **${c.name}**${variants}: ${c.count} instances${desc}\n`;
    }
    md += `\n`;
  } else {
    md += `## Components\n\n`;
    md += `(none detected)\n\n`;
  }

  // ── 8. Do's and Don'ts ──
  if ((dos && dos.length > 0) || (donts && donts.length > 0)) {
    md += `## Do's and Don'ts\n\n`;
    if (dos && dos.length > 0) {
      for (const d of dos) {
        md += `- **Do:** ${d}\n`;
      }
      md += `\n`;
    }
    if (donts && donts.length > 0) {
      for (const d of donts) {
        md += `- **Don't:** ${d}\n`;
      }
      md += `\n`;
    }
  } else {
    // Default design rules based on extracted data
    md += `## Do's and Don'ts\n\n`;
    if (spacing?.base) {
      md += `- **Do:** Use consistent spacing based on the ${spacing.base}px grid.\n`;
    }
    md += `- **Do:** Maintain WCAG AA contrast ratio (4.5:1) for all text.\n`;
    md += `- **Don't:** Mix rounded and sharp corners in the same view.\n\n`;
  }

  // Agent Prompt Guide
  if (agentPrompt) {
    md += `## Agent Prompt Guide\n\n`;
    md += `${agentPrompt}\n\n`;
  } else {
    md += `## Agent Prompt Guide\n\n`;
    md += `Use this DESIGN.md as a style reference for AI coding agents. `;
    md += `Point your agent to this file to maintain consistent design across the project.\n\n`;
    md += `Example prompt:\n\n`;
    md += `> "Use the design system defined in DESIGN.md. Follow the color palette, `;
    md += `typography scale, and spacing grid. Maintain the same visual language.\n\n`;
  }

  return md;
}

