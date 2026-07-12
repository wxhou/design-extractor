/**
 * 生成 DESIGN.md 内容
 *
 * @param {object} card - 卡片数据
 * @param {Array} colors - 颜色数组
 * @param {Array} fonts - 字体数组
 * @param {object|null} typeScale - 字号阶梯
 * @param {Array} breakpoints - 断点
 * @param {string|null} spacingBase - 间距基础单位
 * @param {Array} dos - 建议
 * @param {Array} donts - 不建议
 * @param {object} ds - rawData.designSystem (含 layout, components, responsiveStrategy 等)
 * @returns {string} Markdown 文本
 */
export function getDesignMd(card, colors, fonts, typeScale, breakpoints, spacingBase, dos, donts, ds) {
  const name = card?.name || '';
  const northStar = card?.north_star || '';
  const url = card?.url || '';
  let md = `---
version: alpha
name: "${name}"
description: "Design tokens extracted from ${url || name}"
`;

  // Colors
  if (colors.length > 0) {
    md += `\ncolors:\n`;
    for (const c of colors.slice(0, 12)) {
      const key = (c.name || c.hex).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      md += `  ${key}: "${c.hex}"\n`;
    }
  }

  // Typography
  if (fonts.length > 0) {
    md += `\ntypography:\n`;
    for (const f of fonts.slice(0, 5)) {
      const key = f.fontFamily?.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'font';
      md += `  ${key}:\n`;
      md += `    fontFamily: "${f.fontStack || f.fontFamily || 'sans-serif'}"\n`;
      md += `    fontSize: "16px"\n`;
      md += `    fontWeight: "${f.weights?.[0] || 400}"\n`;
      md += `    lineHeight: "1.5"\n`;
    }
  }

  // Rounded
  if (card.border_radius) {
    try {
      const br = JSON.parse(card.border_radius);
      if (br.tokens && Object.keys(br.tokens).length > 0) {
        md += `\nrounded:\n`;
        for (const [name, value] of Object.entries(br.tokens)) {
          md += `  ${name}: "${value}"\n`;
        }
      }
    } catch {}
  }

  // Spacing
  if (card.spacing) {
    try {
      const sp = JSON.parse(card.spacing);
      if (sp.tokens && Object.keys(sp.tokens).length > 0) {
        md += `\nspacing:\n`;
        for (const [name, value] of Object.entries(sp.tokens)) {
          md += `  ${name}: "${value}"\n`;
        }
      }
    } catch {}
  }

  if (spacingBase) {
    md += `\nspacing_base: "${spacingBase}"\n`;
  }

  // Breakpoints
  if (breakpoints.length > 0) {
    md += `\nbreakpoints:\n`;
    for (const bp of breakpoints) {
      md += `  - "${bp}"\n`;
    }
  }

  md += `---\n\n`;

  // 1. Overview
  md += `## Overview\n\n`;
  if (northStar) md += `${northStar}\n\n`;
  if (fonts[0]) {
    md += `**Typography baseline:** ${fonts[0].fontStack || fonts[0].fontFamily || 'system'} — ${fonts[0].weights?.join(', ') || '400'} weight range.\n\n`;
  }
  if (spacingBase) md += `**Spacing grid:** ${spacingBase}.\n\n`;
  md += `**Theme:** ${card?.color_scheme || 'light'}. ${colors.length} validated color tokens.\n\n`;

  // 2. Colors
  if (colors.length > 0) {
    md += `## Colors\n\n`;
    for (const c of colors.slice(0, 8)) {
      md += `- **${c.name || c.hex}** (${c.hex}): ${c.role || `${c.name || ''} color`}\n`;
    }
    md += '\n';
  }

  // 3. Typography
  if (fonts.length > 0) {
    md += `## Typography\n\n`;
    for (const f of fonts.slice(0, 3)) {
      md += `**${f.fontFamily}** — ${f.weights?.join(', ') || '400'} weights.\n`;
      md += `Font stack: ${f.fontStack || f.fontFamily}\n\n`;
    }
    if (typeScale?.steps?.length > 0) {
      md += `| Role | Size |\n|------|------|\n`;
      for (const s of typeScale.steps.slice(0, 8)) {
        md += `| ${s.role || s.element || s.name || 'element'} | ${s.px || parseFloat(s.size) || s.size}px |\n`;
      }
      md += '\n';
    }
  }

  // 4. Layout & Spacing
  if (card.spacing || breakpoints.length > 0) {
    md += `## Layout & Spacing\n\n`;
    if (spacingBase) md += `**Base grid:** ${spacingBase}.\n\n`;
    if (card.spacing) {
      try {
        const sp = JSON.parse(card.spacing);
        if (sp.tokens && Object.keys(sp.tokens).length > 0) {
          md += `| Token | Value |\n|-------|-------|\n`;
          for (const [name, value] of Object.entries(sp.tokens)) {
            md += `| ${name} | ${value} |\n`;
          }
          md += '\n';
        }
      } catch {}
    }
    if (breakpoints.length > 0) {
      md += `**Responsive breakpoints:**\n\n`;
      for (const bp of breakpoints) {
        md += `- ${bp}\n`;
      }
      md += '\n';

      // Responsive strategy (new)
      if (ds.responsiveStrategy) {
        md += `**Responsive strategy:** ${ds.responsiveStrategy}\n\n`;
      }
      if (ds.breakpointRoles && typeof ds.breakpointRoles === 'object' && Object.keys(ds.breakpointRoles).length > 0) {
        md += `**Breakpoint roles:**\n\n`;
        for (const [role, value] of Object.entries(ds.breakpointRoles)) {
          md += `- ${role}: ${value}\n`;
        }
        md += `\n`;
      }
    }

    // Layout depth (grids/flex/containers from raw_data.designSystem.layout)
    const layout = ds.layout;
    if (layout) {
      if (layout.grids && layout.grids.length > 0) {
        md += `**Grid layout:**\n\n`;
        for (const g of layout.grids.slice(0, 3)) {
          const colCount = g.columns === 'none' || g.columns === 'normal' ? '?' : (g.columns.match(/(\d+)/)?.[1] || '?');
          const gap = g.gap === 'normal' ? '0px' : g.gap;
          md += `- ${colCount === '?' ? 'Variable' : colCount + '-column'} grid (gap: ${gap}, found ${g.count}x)\n`;
        }
        md += `\n`;
      }
      if (layout.flexes && layout.flexes.length > 0) {
        md += `**Flexbox layout:**\n\n`;
        for (const f of layout.flexes.slice(0, 3)) {
          const gap = f.gap === 'normal' ? '0px' : f.gap;
          md += `- ${f.direction} flex, justify:${f.justifyContent}, gap:${gap} (found ${f.count}x)\n`;
        }
        md += `\n`;
      }
      if (layout.containers && layout.containers.length > 0) {
        md += `**Container widths:**\n\n`;
        for (const c of layout.containers.slice(0, 3)) {
          md += `- max-width: ${c.maxWidth}\n`;
        }
        md += `\n`;
      }
    }
  }

  // 5. Elevation & Depth
  if (card.shadows) {
    try {
      const sh = JSON.parse(card.shadows);
      if (sh.tokens && Object.keys(sh.tokens).length > 0) {
        md += `## Elevation & Depth\n\n`;
        for (const [name, value] of Object.entries(sh.tokens)) {
          const v = value.length > 60 ? value.substring(0, 60) + '...' : value;
          md += `- **${name}**: ${v}\n`;
        }
        md += '\n';
      }
    } catch {}
  }

  // 6. Shapes
  if (card.border_radius) {
    try {
      const br = JSON.parse(card.border_radius);
      if (br.tokens && Object.keys(br.tokens).length > 0) {
        md += `## Shapes\n\n`;
        md += `| Token | Value |\n|-------|-------|\n`;
        for (const [name, value] of Object.entries(br.tokens)) {
          md += `| ${name} | ${value} |\n`;
        }
        md += '\n';
      }
    } catch {}
  }

  // 7. Components
  md += `## Components\n\n`;
  if (ds.components?.length > 0) {
    ds.components.slice(0, 10).forEach(c => { md += `- ${c.name || c}\n`; });
  } else {
    md += `(none detected)\n\n`;
  }

  // 8. Do's and Don'ts
  if (dos.length > 0 || donts.length > 0) {
    md += `## Do's and Don'ts\n\n`;
    for (const d of dos) md += `- **Do:** ${d}\n`;
    for (const d of donts) md += `- **Don't:** ${d}\n`;
    md += '\n';
  } else if (spacingBase) {
    md += `## Do's and Don'ts\n\n`;
    md += `- **Do:** Use consistent spacing based on the ${spacingBase} grid.\n`;
    md += `- **Do:** Maintain WCAG AA contrast ratio (4.5:1) for all text.\n`;
    md += `- **Don't:** Mix rounded and sharp corners in the same view.\n\n`;
  }

  // Agent Prompt Guide
  md += `## Agent Prompt Guide\n\n`;
  md += `Use this DESIGN.md as a style reference for AI coding agents. `;
  md += `Point your agent to this file to maintain consistent design across the project.\n\n`;

  return md;
}