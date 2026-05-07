/**
 * sync-all-local.js
 * 增量同步：读取本地所有缺 raw_data 的卡片 ID，通过原生 fetch 获取 refero.design API 数据并保存。
 * 不依赖 playwright，用 Node 22 运行。
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'refero.db');
const BASE = 'https://styles.refero.design/api/styles';

const db = new Database(DB_PATH);

// ── fetch & parse ────────────────────────────────────────────────

async function fetchStyleData(styleId) {
  const url = `${BASE}/${styleId}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${styleId}`);
  return res.json();
}

function transformStyle(style) {
  const raw = style?.style?.fullResult?.raw || {};
  const ds  = style?.style?.fullResult?.designSystem || {};

  // Colors — from raw.groups
  const colors = (raw.colors?.groups || []).map(g => ({
    name: g.name,
    hex:  g.hex,
    role: g.role,
  }));

  // Fonts — from raw.typography.fonts (structured) or ds.typography (flat)
  let fonts = [];
  if (raw.typography?.fonts?.length) {
    fonts = raw.typography.fonts.map(f => ({
      fontFamily: f.family,
      weights:    f.weights || [],
      source:     f.source  || 'system',
      desc:       `${f.family} (${(f.weights || []).join(', ')})`,
    }));
  } else if (ds.typography?.length) {
    fonts = ds.typography.map(t => {
      const fw = t.family?.match(/([\d, ]+)$/)?.[0] || '';
      return { fontFamily: t.family?.replace(/\s*[\d, ]+$/, '') || t.family, weights: fw.trim().split(',').map(Number).filter(Boolean), desc: t.family };
    });
  }

  // Gradient — from raw.gradients
  const gradients = (raw.gradients || []).map(g => ({ type: g.type, value: g.value, colors: g.colors }));

  // Type Scale — from ds.typeScale or raw.typography.scale
  let typeScale = null;
  if (ds.typeScale?.steps?.length) {
    typeScale = { name: ds.typeScale.name, base: ds.typeScale.base, steps: ds.typeScale.steps };
  } else if (raw.typography?.scale) {
    const scale = raw.typography.scale;
    typeScale = {
      name:  scale.name || 'Custom Scale',
      base:  scale.base || 16,
      steps: raw.typography.steps || [],
    };
  }

  return {
    id:             style.styleId || style.id,
    name:           style.name,
    url:            style.url,
    category:       style.category,
    thumbnail:      style.thumbnail,
    preview:        style.preview,
    video_url:      style.video_url,
    colors:         JSON.stringify(colors),
    fonts:          JSON.stringify(fonts),
    gradient:       gradients.length ? JSON.stringify(gradients) : null,
    type_scale:     typeScale ? JSON.stringify(typeScale) : null,
    color_philosophy: raw.colorPhilosophy || null,
    raw_data:       JSON.stringify(style),
  };
}

function upsertCard(data) {
  db.prepare(`
    UPDATE cards SET
      colors         = ?,
      fonts          = ?,
      gradient       = ?,
      type_scale     = ?,
      color_philosophy = ?,
      raw_data       = ?
    WHERE id = ?
  `).run(
    data.colors,
    data.fonts,
    data.gradient,
    data.type_scale,
    data.color_philosophy,
    data.raw_data,
    data.id
  );
}

// ── main ─────────────────────────────────────────────────────────

async function main() {
  // 找出缺 raw_data 的卡片
  const toSync = db.prepare(
    'SELECT id, name FROM cards WHERE raw_data IS NULL ORDER BY name'
  ).all();

  if (toSync.length === 0) {
    console.log('[sync] 所有卡片已同步完毕');
    return;
  }

  console.log(`[sync] 共 ${toSync.length} 条待同步\n`);

  let success = 0, failed = 0;
  const start  = Date.now();

  for (let i = 0; i < toSync.length; i++) {
    const { id, name } = toSync[i];
    process.stdout.write(`\r[sync] ${i + 1}/${toSync.length} | ${success} ok | ${failed} fail | ${name}`);

    try {
      const styleData = await fetchStyleData(id);
      const data = transformStyle(styleData);
      upsertCard(data);
      success++;
    } catch (e) {
      failed++;
      process.stderr.write(`\n  [error] ${id} (${name}): ${e.message}\n`);
    }

    // 限速，避免触发 refero API 限流
    await new Promise(r => setTimeout(r, 250));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\n[sync] 完成！${success} 成功，${failed} 失败，耗时 ${elapsed}s`);
  db.close();
}

main().catch(e => { console.error('[fatal]', e); process.exit(1); });
