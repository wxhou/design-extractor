import { NextResponse } from 'next/server';
import { getDb } from '../../../../../src/db.js';
import { generateThemeCss } from '../../../../../src/extractor-v2.js';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM cards WHERE id = ?',
      args: [id],
    });

    if (result.rows.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const card = result.rows[0];
    let themeCss;

    // 优先使用预存的格式
    try {
      const rawData = JSON.parse(card.raw_data || '{}');
      themeCss = rawData.themeCss;
    } catch {}

    // 兜底：实时生成
    if (!themeCss) {
      const colors = JSON.parse(card.colors || '[]');
      const fonts = JSON.parse(card.fonts || '[]');
      const typeScale = JSON.parse(card.type_scale || '{}');
      const gradients = JSON.parse(card.gradient || '[]');
      themeCss = generateThemeCss({ colors, fonts, typeScale, gradients });
    }

    return new NextResponse(themeCss, {
      status: 200,
      headers: {
        'Content-Type': 'text/css',
        'Content-Disposition': `attachment; filename="${card.name || 'theme'}.css"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new NextResponse(e.message, { status: 500 });
  }
}
