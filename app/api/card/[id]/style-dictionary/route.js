import { NextResponse } from 'next/server';
import { getDb } from '@/src/db.js';
import { generateStyleDictionary } from '@/src/extractor-v2.js';

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

    // 构建数据对象
    const colors = JSON.parse(card.colors || '[]');
    const fonts = JSON.parse(card.fonts || '[]');
    const typeScale = JSON.parse(card.type_scale || '{}');
    const gradients = JSON.parse(card.gradient || '[]');
    const spacing = JSON.parse(card.spacing || '{}');
    const shadows = JSON.parse(card.shadows || '{}');
    const borderRadius = JSON.parse(card.border_radius || '{}');

    const styleDictJson = generateStyleDictionary({
      colors,
      fonts,
      typeScale,
      gradients,
      spacing,
      shadows,
      borderRadius,
      northStar: card.north_star,
      siteName: card.name,
      url: card.url,
    });

    return new NextResponse(styleDictJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${card.name || 'design-tokens'}.style-dictionary.json"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new NextResponse(e.message, { status: 500 });
  }
}