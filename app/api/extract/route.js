import { extractDesignTokens, isValidDomain, normalizeUrl } from '../../../src/extractor-v2.js';
import initSqlJs from 'sql.js';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', '..', 'refero.db');

const locateFile = file =>
  path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', file);

let SQL;

async function getDb() {
  if (!SQL) SQL = await initSqlJs({ locateFile });
  const fileBuffer = fs.readFileSync(DB_PATH);
  return new SQL.Database(fileBuffer);
}

function saveDb(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function saveScreenshot(screenshotBuffer, cardId) {
  const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  const screenshotPath = path.join(screenshotsDir, `${cardId}.png`);
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  return `/screenshots/${cardId}.png`;
}

// Playwright 错误映射到友好消息
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

// 检查网站是否已提取过
async function findExistingCard(normalizedHost) {
  const db = await getDb();
  try {
    // 查询所有卡片，检查是否有匹配的 normalized URL
    const stmt = db.prepare('SELECT id, url, name FROM cards');
    while (stmt.step()) {
      const [id, url, name] = stmt.get();
      const normalized = normalizeUrl(url);
      if (normalized.normalized === normalizedHost) {
        stmt.free();
        return { id, url, name };
      }
    }
    stmt.free();
    return null;
  } finally {
    db.close();
  }
}

export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ success: false, error: '请输入网址' }, { status: 400 });
  }

  // URL 验证
  if (!isValidDomain(url)) {
    return Response.json({ success: false, error: '请输入有效的网址' }, { status: 400 });
  }

  // URL 规范化
  const normalized = normalizeUrl(url);
  if (!normalized.valid) {
    return Response.json({ success: false, error: '请输入有效的网址' }, { status: 400 });
  }

  let db;
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
        siteName: existing.name
      });
    }

    console.log('[extract] Extracting from:', normalized.full);

    // 提取（使用规范化后的 URL）
    const result = await extractDesignTokens(normalized.full, {
      useAI: true,
      captureScreenshot: true
    });

    if (!result.success) {
      const friendlyError = getFriendlyError(result.error);
      console.error('[extract] Extraction failed:', result.error);
      return Response.json({
        success: false,
        error: friendlyError
      }, { status: 500 });
    }

    // 生成 card ID
    cardId = randomUUID();

    // 保存截图
    if (result.screenshot) {
      screenshotPath = saveScreenshot(result.screenshot, cardId);
      console.log('[extract] Screenshot saved:', screenshotPath);
    }

    // 准备卡片数据
    const now = new Date().toISOString();
    const cardData = {
      id: cardId,
      name: result.siteName,
      url: normalized.full,
      preview: screenshotPath,
      screenshot: screenshotPath,
      colors: JSON.stringify(result.colors || []),
      fonts: JSON.stringify(result.fonts || []),
      north_star: result.northStar || null,
      color_scheme: result.colorScheme || 'light',
      category: result.category || 'minimal',
      typography: JSON.stringify(result.typography || {}),
      type_scale: JSON.stringify(result.typeScale || {}),
      gradient: JSON.stringify(result.gradient || []),
      raw_data: JSON.stringify({}),
      created_at: now
    };

    // 验证卡片数据
    if (!cardData.name || !cardData.id) {
      throw new Error('Invalid card data: missing required fields');
    }

    // 保存到数据库
    db = await getDb();
    try {
      db.run(`
        INSERT INTO cards (
          id, name, url, preview, screenshot, colors, fonts,
          north_star, color_scheme, category, typography,
          type_scale, gradient, raw_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cardData.id,
        cardData.name,
        cardData.url,
        cardData.preview,
        cardData.screenshot,
        cardData.colors,
        cardData.fonts,
        cardData.north_star,
        cardData.color_scheme,
        cardData.category,
        cardData.typography,
        cardData.type_scale,
        cardData.gradient,
        cardData.raw_data,
        cardData.created_at
      ]);
      saveDb(db);
    } finally {
      db.close();
    }

    console.log('[extract] Card saved:', cardId);

    return Response.json({
      success: true,
      cardId: cardId,
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
      version: 'v2'
    });
  } catch (error) {
    console.error('[extract] Error:', error.message);
    // 清理截图
    if (screenshotPath) {
      try {
        fs.unlinkSync(path.join(process.cwd(), 'public', screenshotPath));
      } catch {}
    }
    return Response.json(
      { success: false, error: getFriendlyError(error.message) },
      { status: 500 }
    );
  }
}
