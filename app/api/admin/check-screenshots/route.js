/**
 * 检测截图过期 API
 * POST /api/admin/check-screenshots
 *
 * 请求:
 *   POST /api/admin/check-screenshots
 *   Body: { "fix": true, "limit": 10 }
 *
 * 响应:
 *   {
 *     "success": true,
 *     "checked": 100,
 *     "ok": 95,
 *     "broken": 5,
 *     "skipped": 0,
 *     "fixed": 0,
 *     "failed": []
 *   }
 */

import { getDb } from '@/src/db.js';
import { checkImageUrlWithSize, uploadToSMMS } from '@/src/smms.js';

export async function POST(request) {
  try {
    const { fix = false, limit = 0 } = await request.json();

    console.log('[check-screenshots] Starting...', { fix, limit });

    const db = await getDb();

    // 获取需要检测的截图
    let sql = 'SELECT id, name, url, screenshot, preview FROM cards WHERE screenshot IS NOT NULL AND screenshot != ""';
    if (limit > 0) sql += ` LIMIT ${limit}`;

    const result = await db.execute(sql);
    const cards = result.rows;

    let ok = 0;
    let broken = 0;
    let skipped = 0;
    let fixed = 0;
    const failed = [];

    for (const card of cards) {
      const screenshotUrl = card.screenshot || card.preview;

      // 跳过本地路径或 base64
      if (!screenshotUrl || screenshotUrl.startsWith('/') || screenshotUrl.startsWith('data:')) {
        skipped++;
        continue;
      }

      // 只检测 SM.MS 链接
      if (!screenshotUrl.includes('sm.ms') && !screenshotUrl.includes('smMC')) {
        skipped++;
        continue;
      }

      const check = await checkImageUrlWithSize(screenshotUrl);

      if (check.ok) {
        ok++;
      } else {
        console.log(`[check-screenshots] Broken: ${card.name} - ${screenshotUrl}`);
        broken++;

        if (fix) {
          // 需要重新截图并上传
          // 目前需要重新提取，这个逻辑比较复杂
          failed.push({
            id: card.id,
            name: card.name,
            error: check.error,
          });
        }
      }
    }

    console.log(`[check-screenshots] Done: ok=${ok}, broken=${broken}, skipped=${skipped}`);

    return Response.json({
      success: true,
      checked: cards.length,
      ok,
      broken,
      skipped,
      fixed,
      failed,
      message: broken > 0 && !fix
        ? 'Run with fix=true to repair broken screenshots'
        : null,
    });
  } catch (error) {
    console.error('[check-screenshots] Error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * 获取截图状态统计
 * GET /api/admin/check-screenshots
 */
export async function GET(request) {
  try {
    const db = await getDb();

    const result = await db.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN screenshot IS NOT NULL AND screenshot != '' THEN 1 ELSE 0 END) as with_screenshot,
        SUM(CASE WHEN screenshot LIKE '%sm.ms%' THEN 1 ELSE 0 END) as smms_screenshots,
        SUM(CASE WHEN screenshot LIKE '%vercel%' THEN 1 ELSE 0 END) as vercel_screenshots,
        SUM(CASE WHEN screenshot LIKE '%blob.vercel%' THEN 1 ELSE 0 END) as vercel_blob_screenshots
      FROM cards
    `);

    return Response.json({
      success: true,
      stats: result.rows[0],
    });
  } catch (error) {
    console.error('[check-screenshots] Error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}