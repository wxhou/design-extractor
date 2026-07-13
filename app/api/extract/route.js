import { extractDesignTokens, isUrlSafe, isValidDomain, normalizeUrl } from '@/src/extractor-v2.js';
import { getDb } from '@/src/db.js';
import { checkFreeIpLimit, getFreeExtractIp, getUtcDay, incrementFreeIpUsage } from '@/src/rate-limit.js';
import { cleanupLocalScreenshot, findExistingCard, saveExtraction } from '@/src/save-extraction.js';
import { randomUUID } from 'crypto';

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

  if (errorMessage.includes('BROWSERLESS_TOKEN') || errorMessage.includes('browserless')) {
    return '线上提取需要配置 BROWSERLESS_TOKEN，本地提取请使用 CLI: npx design-extractor <url>';
  }

  if (errorMessage.includes('playwright-core') || errorMessage.includes('browsers.json')) {
    return '环境缺少浏览器运行库，已配 BROWSERLESS_TOKEN 请确认格式正确';
  }

  return errorMessage;
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

  if (!isUrlSafe(normalized.full)) {
    return Response.json({ success: false, error: '不允许访问内网地址' }, { status: 403 });
  }

  const db = await getDb();
  const ip = getFreeExtractIp(request.headers);
  const day = getUtcDay();
  const freeLimit = await checkFreeIpLimit(db, ip, { day });
  if (!freeLimit.allowed) {
    return Response.json({
      success: false,
      error: {
        code: 'free_limit_exceeded',
        message: '今日免费额度已用完，请开通 API',
      },
      upgradeUrl: '/dashboard',
    }, { status: 429 });
  }
  await incrementFreeIpUsage(db, ip, day);

  let cardId;
  let screenshotPath = null;

  const jobId = randomUUID();
  extractionJobs.set(jobId, { status: 'starting', progress: 0 });

  try {
    // 检查重复
    extractionJobs.set(jobId, { status: 'checking_duplicate', progress: 10 });
    const existing = await findExistingCard(db, normalized.normalized);
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

    extractionJobs.set(jobId, { status: 'saving', progress: 85 });

    // 写入数据库（Turso 或本地 SQLite）- 使用 UPSERT 保证幂等
    extractionJobs.set(jobId, { status: 'saving_to_db', progress: 90 });
    const saved = await saveExtraction(db, normalized, result);
    cardId = saved.cardId;
    screenshotPath = saved.screenshot;

    console.log('[extract] Card saved:', cardId);
    extractionJobs.set(jobId, { status: 'done', progress: 100, cardId, siteName: result.siteName });

    return Response.json({
      success: true,
      ...saved.data,
      jobId,
    });
  } catch (error) {
    console.error('[extract] Error:', error.message, error.stack);
    extractionJobs.set(jobId, { status: 'error', progress: 100, error: error.message });
    // 清理截图
    cleanupLocalScreenshot(screenshotPath);
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