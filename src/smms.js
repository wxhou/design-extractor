/**
 * 图片服务
 * 优先使用 base64 存入数据库（永久存储）
 * 备用：路过图床（如果可访问）
 */

const IMGCHR_API = 'https://imgchr.com/api/v1/upload';

/**
 * 保存图片 - 返回 base64 字符串
 * @param {Buffer} imageData - 图片数据
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function saveImageAsBase64(imageData) {
  if (!imageData || imageData.length === 0) {
    return { success: false, error: 'No image data' };
  }

  try {
    // 转换为 base64
    const base64 = imageData.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      success: true,
      url: dataUrl,
      size: imageData.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 上传图片到路过图床（备用）
 * @param {Buffer} imageData - 图片数据
 * @param {string} filename - 文件名
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadToImageHost(imageData, filename = 'screenshot.png') {
  try {
    const formData = new FormData();
    const blob = new Blob([imageData], { type: 'image/png' });
    formData.append('image', blob, filename);

    const response = await fetch(IMGCHR_API, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success || data.url) {
      return {
        success: true,
        url: data.url || data.links?.full || data.data?.url,
        size: imageData.length,
      };
    }

    return {
      success: false,
      error: data.error || data.message || 'Upload failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// 兼容旧名称
export const uploadToSMMS = saveImageAsBase64;

/**
 * 检测图片 URL 是否有效
 * @param {string} url - 图片 URL
 * @returns {Promise<boolean>}
 */
export async function checkImageUrl(url) {
  if (!url || url.startsWith('/')) {
    return false;
  }

  // base64 格式永远有效
  if (url.startsWith('data:')) {
    return true;
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok || response.status === 301 || response.status === 302;
  } catch {
    return false;
  }
}

/**
 * 检测图片 URL（完整请求，检测文件大小）
 * @param {string} url - 图片 URL
 * @returns {Promise<{ok: boolean, size?: number, error?: string}>}
 */
export async function checkImageUrlWithSize(url) {
  if (!url || url.startsWith('/')) {
    return { ok: false, error: 'Invalid URL' };
  }

  // base64 格式
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    const size = Math.floor(base64.length * 0.75);
    return { ok: true, size };
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