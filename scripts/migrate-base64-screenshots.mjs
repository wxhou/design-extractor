#!/usr/bin/env node
/**
 * migrate-base64-screenshots.mjs
 *
 * 将 cards 表中 base64 data URI 的 preview/screenshot 迁移为 Vercel Blob URL。
 * 逐列独立判断（preview 是 data: 而 screenshot 已是 URL 的行不会被误覆盖）。
 *
 * 用法:
 *   node scripts/migrate-base64-screenshots.mjs            # dry-run，只打印计划
 *   node scripts/migrate-base64-screenshots.mjs --apply    # 实跑（连生产 Turso）
 *
 * 依赖环境变量: TURSO_URL, TURSO_AUTH_TOKEN, BLOB_READ_WRITE_TOKEN
 */

import { createClient } from '@libsql/client';
import { put } from '@vercel/blob';
import sharp from 'sharp';

const apply = process.argv.includes('--apply');

if (!process.env.TURSO_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('[migrate] 缺少 TURSO_URL / TURSO_AUTH_TOKEN');
  process.exit(1);
}
if (apply && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('[migrate] --apply 需要 BLOB_READ_WRITE_TOKEN');
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function decodeDataUri(uri) {
  const match = uri.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], 'base64');
}

async function uploadAsJpeg(pngBuffer, cardId) {
  const jpeg = await sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();
  const key = `extraction-${cardId}-${Date.now()}.jpg`;
  const { url } = await put(key, jpeg, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/jpeg',
  });
  return url;
}

async function main() {
  const { rows } = await db.execute(
    `SELECT id, name, preview, screenshot FROM cards WHERE preview LIKE 'data:%' OR screenshot LIKE 'data:%'`
  );

  console.log(`[migrate] ${apply ? '实跑' : 'dry-run'} | 待迁移 ${rows.length} 张卡\n`);

  let migrated = 0;
  for (const card of rows) {
    const updates = {};
    for (const col of ['preview', 'screenshot']) {
      const value = card[col];
      if (typeof value === 'string' && value.startsWith('data:')) {
        const buffer = decodeDataUri(value);
        if (!buffer) {
          console.log(`  ⚠️ [${card.name}] ${col} 无法解码，跳过`);
          continue;
        }
        updates[col] = await uploadAsJpeg(buffer, card.id);
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  ⏭️  [${card.name}] 无可迁移列`);
      continue;
    }

    console.log(`  → [${card.name}] ${Object.entries(updates).map(([c, u]) => `${c}: ${u.slice(0, 60)}…`).join(' | ')}`);

    if (apply) {
      const setClause = Object.keys(updates).map(c => `${c} = ?`).join(', ');
      await db.execute({
        sql: `UPDATE cards SET ${setClause} WHERE id = ?`,
        args: [...Object.values(updates), card.id],
      });
    }
    migrated++;
  }

  console.log(`\n[migrate] ${apply ? '完成' : 'dry-run 结束（加 --apply 实跑）'} | ${migrated}/${rows.length} 张卡处理`);
  process.exit(0);
}

main().catch(e => {
  console.error('[migrate] 失败:', e.message);
  process.exit(1);
});
