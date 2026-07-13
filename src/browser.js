/**
 * Browser wrapper — lazy-loads playwright-core for Browserless connections.
 * Forces @vercel/nft to include the full playwright-core package.
 */

let _chromium = null;

export async function getChromium() {
  if (!_chromium) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
    const { chromium } = await import('playwright-core');
    _chromium = chromium;
  }
  return _chromium;
}

// ── @vercel/nft 追踪锚点 ──
// 以下静态引用强制 nft 在构建时包含 playwright-core 的所有文件，
// 包括 coreBundle.js 中动态 require() 的 browsers.json。
import { createRequire } from 'module';
const _nf = createRequire(import.meta.url);
_nf.resolve('playwright-core/browsers.json');