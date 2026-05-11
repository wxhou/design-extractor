import { getDb } from '../../../src/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  const search = searchParams.get('search') || '';
  const page   = parseInt(searchParams.get('page')  || '1',  10);
  const limit  = parseInt(searchParams.get('limit') || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const db = getDb();

    // 构建 WHERE 条件
    const conditions = [];
    const args = [];
    if (category !== 'all') {
      const cat = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      conditions.push('category = ?');
      args.push(cat);
    }
    if (search) {
      conditions.push('(name LIKE ? OR url LIKE ?)');
      args.push(`%${search}%`, `%${search}%`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 总数
    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM cards ${whereClause}`,
      args,
    });
    const total = Number(countResult.rows[0].cnt);

    // 分类计数
    const categoryCounts = {};
    const catCountResult = await db.execute('SELECT category, COUNT(*) as cnt FROM cards GROUP BY category');
    for (const row of catCountResult.rows) {
      if (row.category) {
        categoryCounts[row.category.toLowerCase()] = Number(row.cnt);
      }
    }

    // 分类列表
    const catResult = await db.execute('SELECT slug, name_en, name_zh, sort_order FROM categories ORDER BY sort_order');
    const categories = catResult.rows.map(row => ({
      slug: row.slug,
      name_en: row.name_en,
      name_zh: row.name_zh,
      sort_order: row.sort_order,
      card_count: categoryCounts[row.slug] || 0,
    }));

    // 数据
    const dataArgs = [...args, limit, offset];
    const dataResult = await db.execute({
      sql: `SELECT id, name, url, preview, video_url, screenshot, north_star, color_scheme, category FROM cards ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
      args: dataArgs,
    });

    const cards = dataResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      url: row.url,
      preview: row.preview,
      video_url: row.video_url,
      screenshot: row.screenshot,
      north_star: row.north_star,
      color_scheme: row.color_scheme,
      category: row.category,
    }));

    return Response.json({
      cards,
      total,
      page,
      limit,
      hasMore: offset + cards.length < total,
      categories,
      search: search || null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
