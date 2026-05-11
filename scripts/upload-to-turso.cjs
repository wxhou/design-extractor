#!/usr/bin/env node
/**
 * upload-to-turso.cjs
 *
 * 读取本地 refero.db，将 cards 和 categories 表数据上传到 Turso。
 *
 * 用法:
 *   node scripts/upload-to-turso.cjs
 */

const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'refero.db');

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('本地 refero.db 不存在，跳过上传。');
    return;
  }

  const local = new Database(DB_PATH, { readonly: true });
  const cardCount = local.prepare('SELECT COUNT(*) as c FROM cards').get().c;
  if (cardCount === 0) {
    console.log('本地 refero.db 为空，跳过上传。');
    local.close();
    return;
  }

  console.log(`本地数据库: ${cardCount} 条 cards`);

  const turso = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // 创建表结构
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      url          TEXT,
      preview      TEXT,
      video_url    TEXT,
      screenshot   TEXT,
      colors       TEXT,
      fonts        TEXT,
      north_star   TEXT,
      color_scheme TEXT,
      category     TEXT,
      created_at   TEXT
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      slug       TEXT PRIMARY KEY,
      name_en    TEXT NOT NULL,
      name_zh    TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // 上传 cards
  console.log('上传 cards...');
  const cards = local.prepare('SELECT * FROM cards').all();
  let uploaded = 0;

  for (const card of cards) {
    await turso.execute({
      sql: `INSERT OR REPLACE INTO cards (id, name, url, preview, video_url, screenshot, colors, fonts, north_star, color_scheme, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [card.id, card.name, card.url, card.preview, card.video_url, card.screenshot, card.colors, card.fonts, card.north_star, card.color_scheme, card.category, card.created_at],
    });
    uploaded++;
    if (uploaded % 50 === 0) process.stdout.write(`\r  ${uploaded}/${cards.length}`);
  }
  console.log(`\r  ✅ cards: ${uploaded}/${cards.length}`);

  // 上传 categories
  console.log('上传 categories...');
  const categories = local.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  for (const cat of categories) {
    await turso.execute({
      sql: 'INSERT OR REPLACE INTO categories (slug, name_en, name_zh, sort_order) VALUES (?, ?, ?, ?)',
      args: [cat.slug, cat.name_en, cat.name_zh, cat.sort_order],
    });
  }
  console.log(`  ✅ categories: ${categories.length}`);

  local.close();
  console.log('\n上传完成！');
}

main().catch(e => {
  console.error('上传失败:', e.message);
  process.exit(1);
});
