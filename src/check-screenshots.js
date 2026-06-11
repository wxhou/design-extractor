/**
 * 检测并重新上传过期截图
 *
 * 使用方式:
 *   node src/check-screenshots.js           # 检测所有截图
 *   node src/check-screenshots.js --fix     # 检测并修复
 *   node src/check-screenshots.js --limit 10  # 只检测前10条
 */

import { getDb } from './db.js';
import { checkImageUrlWithSize, uploadToSMMS } from './smms.js';

const args = process.argv.slice(2);
const dryRun = !args.includes('--fix');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

async function checkScreenshots() {
  console.log('🚀 开始检测截图...\n');
  console.log(`模式: ${dryRun ? '🔍 预览 (dry-run)' : '🔧 修复模式'}`);
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
  let fixed = 0;
  let skipped = 0;

  for (const card of cards) {
    const screenshotUrl = card.screenshot || card.preview;

    // 跳过本地路径或 base64
    if (!screenshotUrl || screenshotUrl.startsWith('/') || screenshotUrl.startsWith('data:')) {
      skipped++;
      continue;
    }

    // 跳过非 SM.MS 的外部 URL（如 Vercel Blob）
    if (!screenshotUrl.includes('sm.ms') && !screenshotUrl.includes('smMC')) {
      skipped++;
      continue;
    }

    process.stdout.write(`\n[${card.name}] `);

    const check = await checkImageUrlWithSize(screenshotUrl);

    if (check.ok) {
      console.log(`✅ OK (${(check.size / 1024).toFixed(1)}KB)`);
      ok++;
    } else {
      console.log(`❌ 过期 (${check.error})`);
      broken++;

      if (!dryRun) {
        // 由于 smms.js 使用 base64 存储，旧的 SM.MS URL 截图不支持重新上传
        // 需要重新提取该网站才能生成新的 base64 截图
        console.log('   ⚠️ 旧 URL 截图不支持自动修复，请重新提取该网站');
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 统计结果:`);
  console.log(`   ✅ 正常: ${ok}`);
  console.log(`   ❌ 过期: ${broken}`);
  console.log(`   ⏭️  跳过: ${skipped}`);

  if (!dryRun && broken > 0) {
    console.log(`\n🔧 已修复: ${fixed} 张`);
  }

  if (dryRun && broken > 0) {
    console.log(`\n💡 提示: 使用 --fix 参数修复过期截图`);
  }

  console.log('\n✨ 检测完成!');
}

// 运行
checkScreenshots().catch(console.error);