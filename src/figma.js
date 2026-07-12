/**
 * Figma API 封装
 * 用于从 Figma 文件提取设计 tokens
 */

const FIGMA_API_BASE = 'https://api.figma.com/v1';

/**
 * 从 Figma 文件 URL 提取 file key
 * @param {string} url - Figma 文件 URL
 * @returns {string|null} file key 或 null
 */
export function extractFileKey(url) {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * 获取 Figma API token
 * @returns {string|null} API token
 */
function getApiToken() {
  return process.env.FIGMA_API_TOKEN || null;
}

/**
 * 发送 Figma API 请求
 * @param {string} endpoint - API 端点
 * @param {object} options - fetch 选项
 * @returns {Promise<object>} API 响应
 */
async function figmaRequest(endpoint, options = {}) {
  const token = getApiToken();
  if (!token) {
    throw new Error('FIGMA_API_TOKEN is not configured');
  }

  const url = `${FIGMA_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 403) {
    throw new Error('Unauthorized: Invalid or expired Figma API token');
  }
  if (response.status === 404) {
    throw new Error('File not found: Check the URL and your access permissions');
  }
  if (response.status === 429) {
    throw new Error('Rate limit exceeded: Please try again later');
  }
  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status}`);
  }

  return response.json();
}

/**
 * 获取文件中的样式
 * @param {string} fileKey - Figma 文件 key
 * @returns {Promise<object>} 文件数据
 */
export async function getFileStyles(fileKey) {
  return figmaRequest(`/files/${fileKey}?depth=1`);
}

/**
 * 从 Figma 文件提取设计 tokens
 * @param {string} fileKey - Figma 文件 key
 * @returns {Promise<object>} 提取的 tokens
 */
export async function extractStylesFromFile(fileKey) {
  const fileData = await getFileStyles(fileKey);

  const tokens = {
    colors: [],
    typography: [],
    shadows: [],
  };

  // 遍历组件和样式
  const styles = fileData.styles || {};
  const components = fileData.components || {};

  // 从 styles 中提取颜色和效果
  for (const [styleId, styleData] of Object.entries(styles)) {
    if (styleData.style_type === 'FILL') {
      // 需要获取填充详情
      tokens.colors.push({
        id: styleId,
        name: styleData.name,
      });
    } else if (styleData.style_type === 'EFFECT') {
      tokens.shadows.push({
        id: styleId,
        name: styleData.name,
      });
    } else if (styleData.style_type === 'TEXT') {
      tokens.typography.push({
        id: styleId,
        name: styleData.name,
      });
    }
  }

  // 从文档节点中提取实际的样式值
  const document = fileData.document;
  if (document && document.children) {
    for (const page of document.children) {
      if (page.children) {
        extractNodeStyles(page, tokens);
      }
    }
  }

  // 进一步处理，获取实际的颜色值和效果值
  const enrichedTokens = await enrichTokens(fileKey, tokens);

  return enrichedTokens;
}

/**
 * 从节点中递归提取样式
 * @param {object} node - Figma 节点
 * @param {object} tokens - tokens 对象
 */
function extractNodeStyles(node, tokens) {
  // 提取填充颜色
  if (node.fills && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color) {
        const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        if (fill.opacity !== undefined && fill.opacity < 1) {
          tokens.colors.push({
            name: `Color from ${node.name}`,
            hex,
            opacity: fill.opacity,
          });
        } else {
          tokens.colors.push({
            name: `Color from ${node.name}`,
            hex,
          });
        }
      }
    }
  }

  // 提取效果（阴影）
  if (node.effects && Array.isArray(node.effects)) {
    for (const effect of node.effects) {
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        tokens.shadows.push({
          name: `Shadow from ${node.name}`,
          type: effect.type,
          color: effect.color ? rgbToHex(effect.color.r, effect.color.g, effect.color.b) : '#000',
          offsetX: effect.offset?.x || 0,
          offsetY: effect.offset?.y || 0,
          radius: effect.radius || 0,
          spread: effect.spread || 0,
        });
      }
    }
  }

  // 递归遍历子节点
  if (node.children) {
    for (const child of node.children) {
      extractNodeStyles(child, tokens);
    }
  }
}

/**
 * 补充 tokens 的详细信息
 * @param {string} fileKey - 文件 key
 * @param {object} tokens - 基础 tokens
 * @returns {Promise<object>} 补充后的 tokens
 */
async function enrichTokens(fileKey, tokens) {
  // 获取组件样式详细信息
  try {
    const componentsData = await figmaRequest(`/files/${fileKey}/components`);
    if (componentsData.components) {
      for (const [componentKey, component] of Object.entries(componentsData.components)) {
        // 组件信息可能包含样式引用
        if (component.description) {
          // 可以存储组件描述作为额外信息
        }
      }
    }
  } catch (e) {
    // 组件详细信息获取失败不影响主流程
    console.error('Failed to enrich tokens:', e.message);
  }

  // 去除重复的颜色
  const uniqueColors = [];
  const seenColors = new Set();
  for (const color of tokens.colors) {
    const key = color.hex || color.name;
    if (!seenColors.has(key)) {
      seenColors.add(key);
      uniqueColors.push(color);
    }
  }
  tokens.colors = uniqueColors;

  // 去除重复的阴影
  const uniqueShadows = [];
  const seenShadows = new Set();
  for (const shadow of tokens.shadows) {
    const key = `${shadow.offsetX}-${shadow.offsetY}-${shadow.radius}`;
    if (!seenShadows.has(key)) {
      seenShadows.add(key);
      uniqueShadows.push(shadow);
    }
  }
  tokens.shadows = uniqueShadows;

  return tokens;
}

/**
 * 将 RGB 值转换为十六进制颜色
 * @param {number} r - 红色分量 (0-1)
 * @param {number} g - 绿色分量 (0-1)
 * @param {number} b - 蓝色分量 (0-1)
 * @returns {string} 十六进制颜色字符串
 */
function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
