import { randomUUID } from 'crypto';
import {
  generateThemeCss,
  generateTokensJson,
  generateVariablesCss,
  normalizeUrl,
} from './extractor-v2.js';
import { uploadScreenshot } from './screenshot-storage.js';

async function saveScreenshot(screenshotBuffer, cardId) {
  if (!screenshotBuffer) return null;

  const url = await uploadScreenshot(screenshotBuffer, cardId);
  console.log('[extract] Screenshot saved:', url);
  return url;
}

export async function findExistingCard(db, normalizedHost) {
  const result = await db.execute({
    sql: 'SELECT id, url, name FROM cards WHERE url LIKE ?',
    args: [`%${normalizedHost}%`],
  });

  for (const row of result.rows) {
    const normalized = normalizeUrl(row.url);
    if (normalized.normalized === normalizedHost) {
      return { id: row.id, url: row.url, name: row.name };
    }
  }

  return null;
}

export async function saveExtraction(db, normalized, result, options = {}) {
  const cardId = options.cardId || randomUUID();
  let screenshotPath = null;

  if (!result.siteName || !cardId) {
    throw new Error('Invalid card data: missing required fields');
  }

  if (result.screenshot) {
    screenshotPath = await saveScreenshot(result.screenshot, cardId);
    console.log('[extract] Screenshot saved:', screenshotPath);
  } else {
    console.log('[extract] No screenshot captured');
  }

  const tokensJson = generateTokensJson(result);
  const variablesCss = generateVariablesCss(result);
  const themeCss = generateThemeCss(result);
  const now = options.now || new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO cards (id, name, url, preview, screenshot, colors, fonts, north_star, color_scheme, category, typography, type_scale, gradient, spacing, shadows, border_radius, raw_data, created_at, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            url = excluded.url,
            preview = excluded.preview,
            screenshot = excluded.screenshot,
            colors = excluded.colors,
            fonts = excluded.fonts,
            north_star = excluded.north_star,
            color_scheme = excluded.color_scheme,
            category = excluded.category,
            typography = excluded.typography,
            type_scale = excluded.type_scale,
            gradient = excluded.gradient,
            spacing = excluded.spacing,
            shadows = excluded.shadows,
            border_radius = excluded.border_radius,
            raw_data = excluded.raw_data,
            created_at = excluded.created_at,
            user_id = excluded.user_id`,
    args: [
      cardId,
      result.siteName,
      normalized.full,
      screenshotPath,
      screenshotPath,
      JSON.stringify(result.colors || []),
      JSON.stringify(result.fonts || []),
      result.northStar || null,
      result.colorScheme || 'light',
      result.category || 'minimal',
      JSON.stringify(result.typography || {}),
      JSON.stringify(result.typeScale || {}),
      JSON.stringify(result.gradient || []),
      JSON.stringify(result.spacing || {}),
      JSON.stringify(result.shadows || {}),
      JSON.stringify(result.borderRadius || {}),
      JSON.stringify({ tokensJson, variablesCss, themeCss, animations: result.animations }),
      now,
      options.userId || null,
    ],
  });

  return {
    cardId,
    screenshot: screenshotPath,
    data: {      cardId,
      isDuplicate: false,
      designMd: result.designMd || result.raw_data?.designMd,
      siteName: result.siteName,
      colors: result.colors,
      fonts: result.fonts,
      typography: result.typography,
      gradient: result.gradient,
      typeScale: result.typeScale,
      spacing: result.spacing,
      shadows: result.shadows,
      borderRadius: result.borderRadius,
      animations: result.animations,
      northStar: result.northStar,
      colorScheme: result.colorScheme,
      category: result.category,
      screenshot: screenshotPath,
      cssSize: result.cssSize,
      version: 'v2',
    },
  };
}
