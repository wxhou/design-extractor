/**
 * Browser wrapper — lazy-loads playwright-core only when needed.
 * Sets PLAYWRIGHT_BROWSERS_PATH before importing to suppress browsers.json lookup.
 * This avoids the ESM hoisting problem where top-level imports are evaluated before
 * any code runs.
 */

let _chromium = null;

export async function getChromium() {
  if (!_chromium) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
    // Try playwright-core first, fall back to playwright (bundled differently on Vercel)
    try {
      const { chromium } = await import('playwright-core');
      _chromium = chromium;
    } catch (e) {
      console.error('[browser] playwright-core import failed:', e.message);
      try {
        const { chromium } = await import('playwright');
        _chromium = chromium;
      } catch (e2) {
        console.error('[browser] playwright fallback also failed:', e2.message);
        throw new Error(`无法加载浏览器引擎: ${e.message} / ${e2.message}`);
      }
    }
  }
  return _chromium;
}