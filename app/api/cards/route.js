import initSqlJs from 'sql.js';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', '..', 'refero.db');

const locateFile = file =>
  path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', file);

let SQL;

async function getSql() {
  if (!SQL) SQL = await initSqlJs({ locateFile });
  return SQL;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  const search = searchParams.get('search') || '';
  const page     = parseInt(searchParams.get('page')  || '1',  10);
  const limit    = parseInt(searchParams.get('limit') || '20', 10);
  const offset   = (page - 1) * limit;

  try {
    const sqljs   = await getSql();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db      = new sqljs.Database(fileBuffer);

    // 构建 WHERE 条件
    const conditions = [];
    if (category !== 'all') {
      const cat = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      conditions.push(`category = '${cat}'`);
    }
    if (search) {
      const escapedSearch = search.replace(/'/g, "''");
      conditions.push(`(name LIKE '%${escapedSearch}%' OR url LIKE '%${escapedSearch}%')`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 总数
    let total = 0;
    const countRows = db.exec(`SELECT COUNT(*) FROM cards ${whereClause}`)[0]?.values[0][0] || 0;
    total = countRows;

    // 分类计数
    const categoryCounts = {};
    const countByCategory = db.exec('SELECT category, COUNT(*) FROM cards GROUP BY category');
    if (countByCategory.length > 0) {
      countByCategory[0].values.forEach(([cat, count]) => {
        if (cat) {
          categoryCounts[cat.toLowerCase()] = count;
        }
      });
    }

    // 分类列表（从数据库读取）
    const categoriesStmt = db.prepare(`
      SELECT c.slug, c.name_en, c.name_zh, c.sort_order
      FROM categories c
      ORDER BY c.sort_order
    `);
    const categories = [];
    while (categoriesStmt.step()) {
      const row = categoriesStmt.get();
      const slug = row[0];
      const cardCount = categoryCounts[slug] || 0;
      categories.push({
        slug,
        name_en: row[1],
        name_zh: row[2],
        sort_order: row[3],
        card_count: cardCount,
      });
    }
    categoriesStmt.free();

    // 数据
    const stmt = db.prepare(
      `SELECT id, name, url, preview, video_url, screenshot, north_star, color_scheme, category FROM cards ${whereClause} ORDER BY name LIMIT ? OFFSET ?`
    );
    stmt.bind([String(limit), String(offset)]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.get());
    stmt.free();

    db.close();

    const cards = rows.map(([id, name, url, preview, video_url, screenshot, north_star, color_scheme, category]) => ({
      id, name, url, preview, video_url, screenshot, north_star, color_scheme, category
    }));

    return Response.json({
      cards,
      total,
      page,
      limit,
      hasMore: offset + cards.length < total,
      categories,
      search: search || null
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
