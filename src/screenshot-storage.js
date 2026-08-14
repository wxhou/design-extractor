import { Readable } from 'stream';
import { put } from '@vercel/blob';
import sharp from 'sharp';

/**
 * 截图存储：PNG buffer → JPEG(q80) → Vercel Blob → 返回公开 URL。
 * 失败直接抛错（无 fallback）——调用方决定提取失败语义。
 *
 * 注意：body 传 ReadableStream 而非 Buffer——Vercel serverless runtime
 * 禁用了 SharedArrayBuffer，@vercel/blob 内部 undici 对 Buffer 的
 * webidl 检查会误抛 "SharedArrayBuffer is not allowed"（本地 Node 不复现）。
 */
export async function uploadScreenshot(pngBuffer, cardId) {
  const jpeg = await sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();
  const key = `extraction-${cardId}-${Date.now()}.jpg`;
  const stream = Readable.toWeb(Readable.from([jpeg]));
  const { url } = await put(key, stream, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/jpeg',
  });
  return url;
}

/**
 * 检测 blob URL 是否可访问（HTTP HEAD）。
 * 非 HTTP(S) URL（本地路径、data URI）视为不可检查。
 */
export async function checkImageUrl(url) {
  if (!url || !url.startsWith('http')) {
    return { ok: false, error: 'Invalid URL' };
  }
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok && response.status !== 301 && response.status !== 302) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const contentLength = response.headers.get('content-length');
    return {
      ok: true,
      size: contentLength ? parseInt(contentLength) : 0,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
