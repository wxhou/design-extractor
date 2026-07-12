import { NextResponse } from 'next/server';
import { getDb } from '@/src/db.js';
import { isValidUUID } from '@/src/utils.js';

// 显式列出所有列，确保 schema 迁移后的字段对历史数据也可见
const ALL_COLUMNS = `id, name, url, preview, video_url, screenshot, colors, fonts,
  north_star, color_scheme, category, created_at, spacing, shadows, border_radius,
  css_variables, breakpoints, spacing_base, design_system, dos, donts, raw_data`;

export async function GET(request, { params }) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
  }
  try {
    const db = await getDb();
    // Use SELECT col1, col2, ... instead of SELECT * so schema columns appear
    // in every row (Turso libsql returns null as missing key for legacy rows).
    const result = await db.execute({
      sql: `SELECT ${ALL_COLUMNS} FROM cards WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
