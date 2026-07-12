#!/usr/bin/env node
/**
 * design-extractor-v2
 *
 * 从渲染后的 DOM 提取设计 tokens，配合 MiniMax AI 生成语义化命名
 *
 * 子模块：
 *   - color-utils.js      — 颜色解析、分析、命名
 *   - extractor.js        — DOM 遍历、样式/字体/布局/组件提取
 *   - ai-enrich.js        — CSS 证据压缩 + AI 增强
 *   - code-generators.js  — 多格式输出（CSS变量/Design Tokens/DESIGN.md）
 *
 * 注意：playwright-core 和 openai 使用动态 import（懒加载），
 * 避免在仅使用代码生成器（tokens/variables/theme 等）的 Vercel 路由中加载失败。
 */

// ── 子模块导入（零外部依赖，安全地在任意环境加载）──
import { parseColor, clusterColors, inferColorScheme } from './color-utils.js';
import {
  extractStylesFromPage, extractFonts, extractTypeScale,
  collectCSSVariables, detectBreakpoints, extractLayout, extractComponents
} from './extractor.js';
import { compressCSSEvidence, enrichWithAI } from './ai-enrich.js';
import { generateDesignMd, generateTokensJson, generateVariablesCss, generateThemeCss } from './code-generators.js';

// ── 子模块 re-export（保持外部导入兼容）──
export * from './color-utils.js';
export * from './extractor.js';
export * from './ai-enrich.js';
export * from './code-generators.js';

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
    // 1. Start browser（懒加载 playwright-core，避免在 Vercel serverless 中加载失败）
    const { chromium } = await import('playwright-core');
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

    // 2. 规范化 URL
    let targetUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
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
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      targetUrl = url;
    }

    // 等待页面完全渲染
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      // 允许超时——网络可能持续活跃
    }

    // 3. 提取基础样式数据
    const styleData = await extractStylesFromPage(page);
    console.log(`[extractor-v2] Found ${styleData.colors.length} colors, ${styleData.fonts.length} fonts`);

    // 4. 聚类颜色
    const clusteredColors = clusterColors(styleData.colors);
    console.log(`[extractor-v2] Clustered to ${clusteredColors.length} color groups`);

    // 5. 提取字体详情
    const fonts = await extractFonts(page);
    console.log(`[extractor-v2] Found ${fonts.length} unique fonts`);

    // 6. 提取 Type Scale
    const typeScale = await extractTypeScale(page);
    console.log(`[extractor-v2] Type scale: ${typeScale?.steps?.length || 0} steps`);

    // 7. 提取渐变
    const gradients = styleData.gradients || [];

    // 8. 提取 CSS 变量
    const cssVariables = await collectCSSVariables(page);
    console.log(`[extractor-v2] Found ${Object.keys(cssVariables).length} CSS variables`);

    // 9. 检测断点
    const breakpoints = await detectBreakpoints(page);
    console.log(`[extractor-v2] Detected ${breakpoints.length} breakpoints`);

    // 10. 提取布局
    const layout = await extractLayout(page);
    console.log(`[extractor-v2] Layout: ${layout.grids?.length || 0} grid patterns, ${layout.flexes?.length || 0} flex patterns`);

    // 11. 提取组件候选
    const componentCandidates = await extractComponents(page);
    console.log(`[extractor-v2] Found ${componentCandidates.length} component candidates`);

    const baseData = {
      url: targetUrl,
      siteName: new URL(targetUrl).hostname.replace(/^www\./, ''),
      colors: clusteredColors,
      fonts,
      typeScale,
      gradients,
      cssVariables,
      breakpoints,
      layout,
      componentCandidates,
    };

    // 12. CSS 证据压缩
    const cssEvidence = compressCSSEvidence(baseData);

    // 13. AI 增强
    let enrichedData = { ...baseData };
    let screenshotPath = null;

    try {
      const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'png' });
      screenshotPath = `/tmp/screenshot-${Date.now()}.png`;
      const fs = await import('fs');
      fs.writeFileSync(screenshotPath, screenshotBuffer);

      enrichedData = await enrichWithAI(baseData, { screenshotBuffer, cssEvidence });
      console.log(`[extractor-v2] AI enrichment complete`);
    } catch (aiError) {
      console.error(`[extractor-v2] AI enrichment failed: ${aiError.message}`);
    }

    // 14. 生成最终输出
    const designMd = generateDesignMd(enrichedData);
    const colorScheme = inferColorScheme(enrichedData.colors);

    const duration = Date.now() - startTime;
    console.log(`[extractor-v2] Done in ${duration}ms`);

    return {
      success: true,
      url: targetUrl,
      colors: enrichedData.colors,
      fonts: enrichedData.fonts,
      typeScale: enrichedData.typeScale,
      gradients: enrichedData.gradients,
      spacing: enrichedData.spacing,
      shadows: enrichedData.shadows,
      borderRadius: enrichedData.borderRadius,
      northStar: enrichedData.northStar || '',
      colorScheme,
      raw_data: {
        designSystem: {
          layout: enrichedData.layout,
          spacing: enrichedData.spacing,
          components: enrichedData.components,
          responsiveStrategy: enrichedData.responsiveStrategy,
          breakpointRoles: enrichedData.breakpointRoles,
          fonts: enrichedData.fonts,
          typeScale: enrichedData.typeScale,
        },
        tokensJson: generateTokensJson(enrichedData),
        variablesCss: generateVariablesCss(enrichedData),
        themeCss: generateThemeCss(enrichedData),
        designMd,
      },
      extras: {},
      timing: duration,
    };

  } catch (error) {
    console.error(`[extractor-v2] Error: ${error.message}`);
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