import { NextResponse } from 'next/server';
import { getDb } from '@/src/db.js';
import { generateTokensJson } from '@/src/extractor-v2.js';
import { isValidUUID, safeParse } from '@/src/utils.js';

export async function GET(request, { params }) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return new NextResponse('Invalid card ID', { status: 400 });
  }
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
    let tokensJson;

    // 优先使用预存的格式
    try {
      const rawData = safeParse(card.raw_data, {});
      tokensJson = rawData.tokensJson;
    } catch {}

    // 兜底：实时生成
    if (!tokensJson) {
      const colors = safeParse(card.colors, []);
      const fonts = safeParse(card.fonts, []);
      const typeScale = safeParse(card.type_scale, {});
      const gradients = safeParse(card.gradient, []);
      tokensJson = generateTokensJson({
        colors,
        fonts,
        typeScale,
        gradients,
        northStar: card.north_star,
        siteName: card.name,
      });
    }

    return new NextResponse(tokensJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${card.name || 'design-tokens'}.json"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new NextResponse(e.message, { status: 500 });
  }
}