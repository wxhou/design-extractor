import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  // 获取路由参数
  const url = new URL(request.url);
  const idWithExt = url.pathname.split('/api/screenshots/')[1];
  const id = idWithExt ? idWithExt.replace('.png', '') : null;

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  // Validate UUID format to prevent path traversal
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const cwd = process.cwd();
  const isStandalone = fs.existsSync(path.join(cwd, '.next', 'standalone'));

  // 尝试多个可能的位置
  const possiblePaths = isStandalone
    ? [
        path.join(cwd, '.next', 'standalone', 'screenshots', `${id}.png`),
        path.join(cwd, '.next', 'standalone', 'public', 'screenshots', `${id}.png`),
        path.join(cwd, 'screenshots', `${id}.png`),
      ]
    : [
        path.join(cwd, 'public', 'screenshots', `${id}.png`),
      ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
}