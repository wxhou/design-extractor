import { NextResponse } from 'next/server';
import { getDb } from '@/src/db.js';
import { safeParse } from '@/src/utils.js';
import { compareTokens, generateComparisonMd } from '@/src/comparison.js';
import { extractFileKey, extractStylesFromFile } from '@/src/figma.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('cardId');
  const figmaUrl = searchParams.get('figmaUrl');
  const figmaFileKey = searchParams.get('figmaFileKey');

  try {
    // 获取网站 tokens
    let websiteTokens = {};
    if (cardId) {
      const db = await getDb();
      const result = await db.execute({
        sql: 'SELECT * FROM cards WHERE id = ?',
        args: [cardId],
      });

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Card not found',
        }, { status: 404 });
      }

      const card = result.rows[0];
      websiteTokens = {
        colors: safeParse(card.colors, []),
        fonts: safeParse(card.fonts, []),
        shadows: safeParse(card.border_radius, []),
      };
    }

    // 获取 Figma tokens
    let figmaTokens = {};
    let fileKey = figmaFileKey;
    if (!fileKey && figmaUrl) {
      fileKey = extractFileKey(figmaUrl);
    }

    if (fileKey) {
      figmaTokens = await extractStylesFromFile(fileKey);
    }

    // 执行对比
    const comparison = compareTokens(websiteTokens, figmaTokens);

    return NextResponse.json({
      success: true,
      comparison,
      comparisonMd: generateComparisonMd(comparison, 'Comparison'),
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e.message,
    }, {
      status: 500,
    });
  }
}