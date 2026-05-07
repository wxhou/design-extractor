/**
 * refero.design → SQLite 同步脚本
 *
 * 用法:
 *   node scripts/init-db.cjs          # 全量同步（仅插入新/变化的卡片）
 *   node scripts/init-db.cjs --force  # 强制全量删除重建
 *   node scripts/init-db.cjs --meta   # 仅查看同步状态
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const https = require('https');

const DB_PATH   = path.join(__dirname, '..', 'refero.db');
const FORCE_REBUILD = process.argv.includes('--force');
const SHOW_META     = process.argv.includes('--meta');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error on ${url}`)); }
      });
    }).on('error', reject);
  });
}

// ── 数据库初始化 ────────────────────────────────────────────────────────────
function openDB() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');   // 写入性能提升
  db.pragma('synchronous = NORMAL');  // 安全与性能平衡
  return db;
}

function initSchema(db) {
  db.exec(`
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
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 索引（幂等创建）
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_north_star   ON cards(north_star);',
    'CREATE INDEX IF NOT EXISTS idx_color_scheme ON cards(color_scheme);',
    'CREATE INDEX IF NOT EXISTS idx_name         ON cards(name);',
    'CREATE INDEX IF NOT EXISTS idx_category     ON cards(category);',
  ];
  indexes.forEach(sql => db.exec(sql));
}

// ── 同步核心 ────────────────────────────────────────────────────────────────
async function sync() {
  const db = openDB();
  initSchema(db);

  const upsert = db.prepare(`
    INSERT INTO cards (id, name, url, preview, video_url, screenshot, colors, fonts, north_star, color_scheme, category, created_at)
    VALUES (@id, @name, @url, @preview, @video_url, @screenshot, @colors, @fonts, @north_star, @color_scheme, @category, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      name         = excluded.name,
      url          = excluded.url,
      preview      = excluded.preview,
      video_url    = excluded.video_url,
      screenshot   = excluded.screenshot,
      colors       = excluded.colors,
      fonts        = excluded.fonts,
      north_star   = excluded.north_star,
      color_scheme = excluded.color_scheme,
      category     = excluded.category;
  `);

  function inferCategory(northStar) {
    if (!northStar) return 'SaaS';
    const t = northStar.toLowerCase();
    if (/\b(dark|terminal|obsidian|void|midnight|black|night)\b/.test(t)) return 'Dark';
    if (/\b(gradient|neon)\b/.test(t)) return 'Gradient';
    if (/\b(minimal|white|marble|blueprint|clean|canvas|pristine|architectural|stark)\b/.test(t)) return 'Minimal';
    if (/\b(editorial|typography|serif|parchment|journal|warm\s+(paper|parchment|vellum|stone))\b/.test(t)) return 'Editorial';
    if (/\b(retro|vintage)\b/.test(t)) return 'Retro';
    if (/\b(playful|whimsical|cartoon|pixar|illustrated)\b/.test(t)) return 'Playful';
    return 'SaaS';
  }

  const upsertMany = db.transaction((cards) => {
    for (const c of cards) {
      upsert.run({
        id:           c.id,
        name:         c.siteName,
        url:          c.url          || '',
        preview:      c.previewVideoPosterUrl || c.thumbnailUrl || '',
        video_url:    c.previewVideoUrl      || '',
        screenshot:   c.screenshotUrl || '',
        colors:       JSON.stringify(c.colors || []),
        fonts:        JSON.stringify(c.fonts || []),
        north_star:   c.northStar    || '',
        color_scheme: c.colorScheme  || '',
        category:     inferCategory(c.northStar),
        created_at:   c.createdAt    || '',
      });
    }
  });

  let allCards = [];
  for (let page = 1; page <= 20; page++) {          // 最多20页，API最多10页(200条)
    const data = await fetch(`https://styles.refero.design/api/styles?page=${page}`);
    if (!data.styles || data.styles.length === 0) break;
    allCards.push(...data.styles);
    process.stdout.write(`\r  Page ${page}: +${data.styles.length} cards ...`);
  }
  console.log(`\n  Fetched ${allCards.length} total cards`);

  const startTime = Date.now();
  upsertMany(allCards);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // 更新同步时间戳
  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)').run(
    'last_sync', new Date().toISOString()
  );
  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)').run(
    'total_cards', String(allCards.length)
  );

  const count = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
  console.log(`  Upserted ${allCards.length} cards in ${elapsed}s`);
  console.log(`  DB now holds ${count} rows`);

  db.close();
}

// ── 查看同步状态 ─────────────────────────────────────────────────────────────
function showMeta() {
  const db = openDB();
  initSchema(db);

  const rows = db.prepare('SELECT key, value FROM meta').all();
  const count = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
  db.close();

  if (rows.length === 0) {
    console.log('  No sync metadata — run without --meta to sync');
    return;
  }
  console.log(`  Total cards : ${count}`);
  rows.forEach(({ key, value }) => {
    const label = key === 'last_sync'
      ? `Last sync   : ${new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
      : key === 'total_cards'
      ? null
      : `  ${key} : ${value}`;
    if (label) console.log(label);
  });
}

// ── 入口 ─────────────────────────────────────────────────────────────────────
if (SHOW_META) {
  showMeta();
} else {
  sync().catch(err => {
    console.error('\n  Sync failed:', err.message);
    process.exit(1);
  });
}
