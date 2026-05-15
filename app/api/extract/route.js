import { extractDesignTokens, isValidDomain, normalizeUrl, generateTokensJson, generateVariablesCss, generateThemeCss } from '../../../src/extractor-v2.js';
import { getDb } from '../../../src/db.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// screenshots 目录：直接使用 public/screenshots
const SCREENSHOTS_DIR = path.join(process.cwd(), 'public', 'screenshots');

function saveScreenshot(screenshotBuffer, cardId) {
  if (!screenshotBuffer) return null;
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${cardId}.png`);
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  // 使用 API 端点来服务截图，这样无论 Docker 容器如何配置都能正常工作
  return `/api/screenshots/${cardId}.png`;
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
  const db = await getDb();
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

const extractionJobs = new Map();

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

  const jobId = randomUUID();
  extractionJobs.set(jobId, { status: 'starting', progress: 0 });

  try {
    // 检查重复
    extractionJobs.set(jobId, { status: 'checking_duplicate', progress: 10 });
    const existing = await findExistingCard(normalized.normalized);
    if (existing) {
      console.log('[extract] Duplicate found:', existing.id);
      extractionJobs.set(jobId, { status: 'done', progress: 100, cardId: existing.id, isDuplicate: true });
      return Response.json({
        success: true,
        cardId: existing.id,
        isDuplicate: true,
        message: '该网站已提取过',
        siteName: existing.name,
        jobId,
      });
    }

    extractionJobs.set(jobId, { status: 'extracting', progress: 20 });
    console.log('[extract] Extracting from:', normalized.full);

    const result = await extractDesignTokens(normalized.full, {
      useAI: true,
      captureScreenshot: true,
    });

    extractionJobs.set(jobId, { status: 'processing_result', progress: 80 });

    if (!result.success) {
      const friendlyError = getFriendlyError(result.error);
      console.error('[extract] Extraction failed:', result.error);
      extractionJobs.set(jobId, { status: 'error', progress: 100, error: friendlyError });
      return Response.json({
        success: false,
        error: friendlyError,
      }, { status: 500 });
    }

    cardId = randomUUID();
    extractionJobs.set(jobId, { status: 'saving', progress: 85 });

    // 保存截图（截图失败不影响主流程）
    if (result.screenshot) {
      screenshotPath = saveScreenshot(result.screenshot, cardId);
      console.log('[extract] Screenshot saved:', screenshotPath);
    } else {
      console.log('[extract] No screenshot captured');
    }

    const now = new Date().toISOString();

    if (!result.siteName || !cardId) {
      throw new Error('Invalid card data: missing required fields');
    }

    // 生成多格式输出
    const tokensJson = generateTokensJson(result);
    const variablesCss = generateVariablesCss(result);
    const themeCss = generateThemeCss(result);

    // 写入数据库（Turso 或本地 SQLite）- 使用 UPSERT 保证幂等
    extractionJobs.set(jobId, { status: 'saving_to_db', progress: 90 });
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO cards (id, name, url, preview, screenshot, colors, fonts, north_star, color_scheme, category, typography, type_scale, gradient, raw_data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              raw_data = excluded.raw_data,
              created_at = excluded.created_at`,
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
        JSON.stringify({ tokensJson, variablesCss, themeCss }),
        now,
      ],
    });

    console.log('[extract] Card saved:', cardId);
    extractionJobs.set(jobId, { status: 'done', progress: 100, cardId, siteName: result.siteName });

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
      jobId,
    });
  } catch (error) {
    console.error('[extract] Error:', error.message, error.stack);
    extractionJobs.set(jobId, { status: 'error', progress: 100, error: error.message });
    // 清理截图
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

// 获取任务状态（用于进度轮询）
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return Response.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const job = extractionJobs.get(jobId);
  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  // 清理已完成的任务（1小时后）
  if (job.status === 'done' || job.status === 'error') {
    setTimeout(() => extractionJobs.delete(jobId), 3600000);
  }

  return Response.json(job);
}