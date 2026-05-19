import { NextResponse } from 'next/server';
import { extractFileKey, extractStylesFromFile } from '../../../../src/figma.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const fileKey = searchParams.get('fileKey');

  try {
    // 支持直接传 fileKey 或 URL
    let key = fileKey;
    if (!key && url) {
      key = extractFileKey(url);
    }

    if (!key) {
      return new NextResponse(JSON.stringify({
        success: false,
        error: 'Invalid Figma URL or missing file key',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tokens = await extractStylesFromFile(key);

    return NextResponse.json({
      success: true,
      fileKey: key,
      tokens,
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