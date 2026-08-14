/**
 * 检测并报告过期截图
 *
 * 使用方式:
 *   node src/check-screenshots.js           # 检测所有截图
 *   node src/check-screenshots.js --limit 10  # 只检测前10条
 */

import { getDb } from './db.js';
import { checkImageUrl } from './screenshot-storage.js';

const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

async function checkScreenshots() {
  console.log('🚀 开始检测截图...\n');
  if (limit > 0) console.log(`限制: 前 ${limit} 条\n`);

  const db = await getDb();

  // 获取需要检测的截图
  let sql = 'SELECT id, name, screenshot, preview FROM cards WHERE screenshot IS NOT NULL AND screenshot != ""';
  if (limit > 0) sql += ` LIMIT ${limit}`;

  const result = await db.execute(sql);
  const cards = result.rows;

  console.log(`待检测: ${cards.length} 张\n`);
  console.log('─'.repeat(60));

  let ok = 0;
  let broken = 0;
  let skipped = 0;

  for (const card of cards) {
    const screenshotUrl = card.screenshot || card.preview;

    // 跳过本地路径或 base64（迁移后不应存在，防御性保留）
    if (!screenshotUrl || screenshotUrl.startsWith('/') || screenshotUrl.startsWith('data:')) {
      skipped++;
      continue;
    }

    process.stdout.write(`\n[${card.name}] `);

    const check = await checkImageUrl(screenshotUrl);

    if (check.ok) {
      console.log(`✅ OK (${(check.size / 1024).toFixed(1)}KB)`);
      ok++;
    } else {
      console.log(`❌ 不可访问 (${check.error})`);
      broken++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 统计结果:`);
  console.log(`   ✅ 正常: ${ok}`);
  console.log(`   ❌ 不可访问: ${broken}`);
  console.log(`   ⏭️  跳过: ${skipped}`);
}

checkScreenshots().catch(e => {
  console.error('[fatal]', e);
  process.exit(1);
});
