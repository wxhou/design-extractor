#!/usr/bin/env node
/**
 * sync-from-refero.js
 * 
 * 从 refero.design API 抓取设计样式数据，同步到本地 SQLite 数据库。
 * 
 * 用法:
 *   node src/sync-from-refero.js              # 增量同步（从远程列表获取最新 ID）
 *   node src/sync-from-refero.js --full       # 全量同步
 *   node src/sync-from-refero.js --id <uuid>  # 单条同步
 */

import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'refero.db');

// ── Database setup ──────────────────────────────────────────────

let db;
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// 扩展 cards 表：新增 raw_data 字段保存完整 refero 数据
function migrateDb() {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info(cards)").all().map(r => r.name);
  
  if (!cols.includes('raw_data')) {
    db.exec("ALTER TABLE cards ADD COLUMN raw_data TEXT");
    console.log('[migrate] added raw_data column');
  }
  if (!cols.includes('gradient')) {
    db.exec("ALTER TABLE cards ADD COLUMN gradient TEXT");
    console.log('[migrate] added gradient column');
  }
  if (!cols.includes('typography')) {
    db.exec("ALTER TABLE cards ADD COLUMN typography TEXT");
    console.log('[migrate] added typography column');
  }
  if (!cols.includes('type_scale')) {
    db.exec("ALTER TABLE cards ADD COLUMN type_scale TEXT");
    console.log('[migrate] added type_scale column');
  }
  if (!cols.includes('color_philosophy')) {
    db.exec("ALTER TABLE cards ADD COLUMN color_philosophy TEXT");
    console.log('[migrate] added color_philosophy column');
  }
  if (!cols.includes('elevation_philosophy')) {
    db.exec("ALTER TABLE cards ADD COLUMN elevation_philosophy TEXT");
    console.log('[migrate] added elevation_philosophy column');
  }
  if (!cols.includes('animation_duration')) {
    db.exec("ALTER TABLE cards ADD COLUMN animation_duration TEXT");
    console.log('[migrate] added animation_duration column');
  }
}

// ── API client ──────────────────────────────────────────────────

const BASE = 'https://styles.refero.design';

/**
 * 通过浏览器抓取 refero 列表页，解析出所有 style ID
 */
async function fetchAllStyleIds(page) {
  console.log('[fetch] navigating to refero.design...');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  
  // 等待卡片加载
  await page.waitForTimeout(3000);
  
  // 尝试从页面源码中提取所有 style ID（RSC payload）
  const html = await page.content();
  const ids = new Set();
  
  // 匹配风格详情的 URL pattern
  const urlMatches = html.matchAll(/styles\.refero\.design\/style\/([a-f0-9-]{36})/gi);
  for (const m of urlMatches) ids.add(m[1]);
  
  // 也尝试从 next.js 数据中提取
  const nextDataMatches = html.matchAll(/"id":"([a-f0-9-]{36})"/g);
  for (const m of nextDataMatches) ids.add(m[1]);
  
  console.log(`[fetch] found ${ids.size} unique style IDs`);
  return [...ids];
}

/**
 * 获取单条 style 完整数据
 */
async function fetchStyleData(styleId) {
  const url = `${BASE}/api/styles/${styleId}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${styleId}`);
  }
  
  const json = await res.json();
  return json.style;
}

// ── 数据转换 ─────────────────────────────────────────────────────

/**
 * 从 refero 完整 API 响应中提取字段存入 cards 表，
 * 同时将完整数据存为 JSON 字符串到 raw_data。
 */
function transformStyle(style) {
  const full = style.fullResult || {};
  const raw = full.raw || {};
  const ds  = full.designSystem || {};

  // 简化颜色数组：优先取 designSystem.colors（含 role/group/description），
  // 回退到 raw.colors.tokens（仅 hex+frequency）
  let simpleColors = [];
  if (Array.isArray(ds.colors) && ds.colors.length) {
    simpleColors = ds.colors.map(c => ({
      name: c.name   || c.hex,
      hex:   c.hex,
      role:  c.role || null,       // e.g. "Primary text, headings…"
      group: c.group || null,       // e.g. "Brand" / "Neutrals" / "Semantic"
    }));
  } else if (Array.isArray(raw.colors?.tokens)) {
    simpleColors = raw.colors.tokens.map(c => ({
      name: c.hex,
      hex:   c.hex,
      role:  null,
      group: null,
    }));
  }

  // 渐变色
  const gradients = (raw.gradients || []).map(g => ({
    name:  g.name,
    hex:   g.hex,
    type:  g.type,
    value: g.value,
  }));

  // Type scale：优先 ds.typeScale（已含 steps），回退到 raw.typography.scale（含 name/base）
  let typeScale = null;
  if (Array.isArray(ds.typeScale) && ds.typeScale.length) {
    const name  = ds.typeScale.name || raw.typography?.scale?.name || null;
    const base  = ds.typeScale.base || raw.typography?.scale?.base || null;
    typeScale   = { name, base, steps: ds.typeScale };
  } else if (raw.typography?.scale) {
    typeScale = {
      name:  raw.typography.scale.name || null,
      base:  raw.typography.scale.base || null,
      steps: raw.typography.steps || [],
    };
  }

  // 字体列表：优先取 raw.typography.fonts（含 fontFamily/weights），
  // 回退到 ds.typography（含 family/role/sizes）
  let simpleFonts = [];
  if (Array.isArray(raw.typography?.fonts) && raw.typography.fonts.length) {
    simpleFonts = raw.typography.fonts.map(f => ({
      fontFamily: f.family || null,
      weights:   f.weights || null,
      source:    f.source || null,
      desc:      `${f.family} (${(f.weights||[]).join(', ')})`,
    }));
  } else if (Array.isArray(ds.typography) && ds.typography.length) {
    simpleFonts = ds.typography.map(f => ({
      fontFamily: f.family || null,
      weight:     f.weight || null,
      sizes:      f.sizes || null,
      desc:       f.role || `${f.family} ${f.weight||''}`.trim(),
    }));
  }

  return {
    id:                   style.id,
    name:                 style.siteName || ds.name || 'Untitled',
    url:                  style.url || null,
    preview:              style.thumbnailUrl || style.screenshotUrl || null,
    screenshot:           style.screenshotUrl || null,
    video_url:            style.previewVideoUrl || null,
    colors:               JSON.stringify(simpleColors),
    fonts:                JSON.stringify(simpleFonts),
    gradient:             gradients.length ? JSON.stringify(gradients) : null,
    type_scale:           typeScale        ? JSON.stringify(typeScale)  : null,
    color_philosophy:     ds.description   || null,
    elevation_philosophy: ds.elevationPhilosophy || null,
    animation_duration:   null,
    north_star:           ds.northStar     || style.northStar || null,
    color_scheme:         style.colorScheme || null,
    category:             style.industry   || null,
    raw_data:             JSON.stringify(full),
    created_at:           style.createdAt  || new Date().toISOString(),
  };
}

// ── Storage ──────────────────────────────────────────────────────

const UPSERT_CARD = `
  INSERT INTO cards (id, name, url, preview, screenshot, video_url, colors, fonts,
    gradient, type_scale, color_philosophy, elevation_philosophy,
    animation_duration, north_star, color_scheme, category, raw_data, created_at)
  VALUES (@id, @name, @url, @preview, @screenshot, @video_url, @colors, @fonts,
    @gradient, @type_scale, @color_philosophy, @elevation_philosophy,
    @animation_duration, @north_star, @color_scheme, @category, @raw_data, @created_at)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    url = excluded.url,
    preview = excluded.preview,
    screenshot = excluded.screenshot,
    video_url = excluded.video_url,
    colors = excluded.colors,
    fonts = excluded.fonts,
    gradient = excluded.gradient,
    type_scale = excluded.type_scale,
    color_philosophy = excluded.color_philosophy,
    elevation_philosophy = excluded.elevation_philosophy,
    animation_duration = excluded.animation_duration,
    north_star = excluded.north_star,
    color_scheme = excluded.color_scheme,
    category = excluded.category,
    raw_data = excluded.raw_data;
`;

function upsertCard(data) {
  const db = getDb();
  db.prepare(UPSERT_CARD).run(data);
}

// ── CLI argument parsing ─────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
sync-from-refero.js — 从 refero.design 同步设计样式数据

用法:
  node src/sync-from-refero.js              # 增量同步
  node src/sync-from-refero.js --full       # 全量同步（遍历大量 ID）
  node src/sync-from-refero.js --id <uuid>  # 同步单条
  node src/sync-from-refero.js --list       # 仅列出远程所有 ID，不写入
  node src/sync-from-refero.js --stats      # 显示同步统计
  node src/sync-from-refero.js --help       # 显示帮助
`);
  process.exit(0);
}

async function main() {
  migrateDb();
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // --stats
    if (args.includes('--stats')) {
      const db = getDb();
      const total = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
      const withRaw = db.prepare('SELECT COUNT(*) as c FROM cards WHERE raw_data IS NOT NULL').get().c;
      const withVideo = db.prepare('SELECT COUNT(*) as c FROM cards WHERE video_url IS NOT NULL').get().c;
      console.log(`本地数据库: 共 ${total} 条, ${withRaw} 条含完整数据, ${withVideo} 条有视频`);
      return;
    }
    
    // --list
    if (args.includes('--list')) {
      const ids = await fetchAllStyleIds(page);
      ids.forEach(id => console.log(id));
      return;
    }
    
    // --id <uuid>
    const idIdx = args.indexOf('--id');
    if (idIdx !== -1 && args[idIdx + 1]) {
      const styleId = args[idIdx + 1];
      console.log(`[sync] fetching ${styleId}...`);
      const style = await fetchStyleData(styleId);
      const data = transformStyle(style);
      upsertCard(data);
      console.log(`[sync] saved: ${data.name} (${data.id})`);
      console.log(`  colors: ${simpleCount(data.colors)}`);
      console.log(`  fonts: ${simpleCount(data.fonts)}`);
      console.log(`  gradient: ${data.gradient ? 'yes' : 'no'}`);
      console.log(`  type_scale: ${data.type_scale ? 'yes' : 'no'}`);
      console.log(`  raw_data: ${data.raw_data ? 'yes' : 'no'}`);
      return;
    }
    
    // --full: 全量同步（通过 refero 首页获取所有 ID）
    if (args.includes('--full')) {
      const ids = await fetchAllStyleIds(page);
      console.log(`[sync] 开始全量同步 ${ids.length} 条...`);
      
      let success = 0, failed = 0;
      for (const id of ids) {
        try {
          const style = await fetchStyleData(id);
          const data = transformStyle(style);
          upsertCard(data);
          success++;
          process.stdout.write(`\r[sync] progress: ${success}/${ids.length} done, ${failed} failed`);
        } catch (e) {
          failed++;
          console.error(`\n[error] ${id}: ${e.message}`);
        }
        // 避免请求过快
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`\n[sync] done: ${success} success, ${failed} failed`);
      return;
    }
    
    // 默认：增量同步（只同步本地没有 raw_data 的卡片）
    const db = getDb();
    const localIds = db.prepare('SELECT id FROM cards WHERE raw_data IS NULL').all().map(r => r.id);
    
    if (localIds.length === 0) {
      console.log('[sync] 所有本地卡片已同步完整数据，无增量。');
      return;
    }
    
    console.log(`[sync] 增量同步 ${localIds.length} 条（本地有 ID 但无完整数据）...`);
    
    let success = 0, failed = 0;
    for (const id of localIds) {
      try {
        const style = await fetchStyleData(id);
        const data = transformStyle(style);
        upsertCard(data);
        success++;
        process.stdout.write(`\r[sync] progress: ${success}/${localIds.length} done, ${failed} failed`);
      } catch (e) {
        failed++;
        // 远程可能不存在这条数据
      }
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`\n[sync] done: ${success} success, ${failed} failed`);
    
  } finally {
    await browser.close();
  }
}

function simpleCount(jsonStr) {
  try { return JSON.parse(jsonStr).length; } catch { return 0; }
}

main().catch(e => {
  console.error('[fatal]', e);
  process.exit(1);
});
