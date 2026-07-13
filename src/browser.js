/**
 * Browser wrapper — lazy-loads playwright-core only when needed.
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