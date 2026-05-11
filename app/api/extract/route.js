import { extractDesignTokens, isValidDomain, normalizeUrl } from '../../../src/extractor-v2.js';
import { getDb } from '../../../src/db.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'public', 'screenshots');

function saveScreenshot(screenshotBuffer, cardId) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${cardId}.png`);
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  return `/screenshots/${cardId}.png`;
}

function getFriendlyError(errorMessage) {
  if (!errorMessage) return '提取失败，请稍后重试';

  if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
      errorMessage.includes('ERR_NAME_RESOLUTION_FAILED') ||
      errorMessage.includes('net::ERR')) {
    return '无法访问该网站，请检查域名是否正确';
  }

  if (errorMessage.includes('ERR_CONNECTION_REFUSED')) {
    return '连接被拒绝，网站可能暂时不可用';
  }

  if (errorMessage.includes('ERR_TIMED_OUT') || errorMessage.includes('Timeout')) {
    return '访问超时，请稍后重试';
  }

  if (errorMessage.includes('Protocol error')) {
    return '无法访问该网站，请检查网址是否正确';
  }

  return '提取失败，请稍后重试';
}

async function findExistingCard(normalizedHost) {
  const db = getDb();
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

export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ success: false, error: '请输入网址' }, { status: 400 });
  }

  if (!isValidDomain(url)) {
    return Response.json({ success: false, error: '请输入有效的网址' }, { status: 400 });
  }

  const normalized = normalizeUrl(url);
  if (!normalized.valid) {
    return Response.json({ success: false, error: '请输入有效的网址' }, { status: 400 });
  }

  let cardId;
  let screenshotPath = null;

  try {
    // 检查重复
    const existing = await findExistingCard(normalized.normalized);
    if (existing) {
      console.log('[extract] Duplicate found:', existing.id);
      return Response.json({
        success: true,
        cardId: existing.id,
        isDuplicate: true,
        message: '该网站已提取过',
        siteName: existing.name,
      });
    }

    console.log('[extract] Extracting from:', normalized.full);

    const result = await extractDesignTokens(normalized.full, {
      useAI: true,
      captureScreenshot: true,
    });

    if (!result.success) {
      const friendlyError = getFriendlyError(result.error);
      console.error('[extract] Extraction failed:', result.error);
      return Response.json({
        success: false,
        error: friendlyError,
      }, { status: 500 });
    }

    cardId = randomUUID();

    if (result.screenshot) {
      screenshotPath = saveScreenshot(result.screenshot, cardId);
      console.log('[extract] Screenshot saved:', screenshotPath);
    }

    const now = new Date().toISOString();

    if (!result.siteName || !cardId) {
      throw new Error('Invalid card data: missing required fields');
    }

    // 写入 Turso
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO cards (id, name, url, preview, screenshot, colors, fonts, north_star, color_scheme, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        now,
      ],
    });

    console.log('[extract] Card saved:', cardId);

    return Response.json({
      success: true,
      cardId,
      isDuplicate: false,
      designMd: result.designMd,
      siteName: result.siteName,
      colors: result.colors,
      fonts: result.fonts,
      typography: result.typography,
      gradient: result.gradient,
      typeScale: result.typeScale,
      northStar: result.northStar,
      colorScheme: result.colorScheme,
      category: result.category,
      screenshot: screenshotPath,
      cssSize: result.cssSize,
      version: 'v2',
    });
  } catch (error) {
    console.error('[extract] Error:', error.message);
    if (screenshotPath) {
      try {
        fs.unlinkSync(path.join(process.cwd(), 'public', screenshotPath));
      } catch {}
    }
    return Response.json(
      { success: false, error: getFriendlyError(error.message) },
      { status: 500 },
    );
  }
}
