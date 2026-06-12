import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { StyleDetailPage } from './pages/StyleDetailPage';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// First card ID from database (099 agency)
const TEST_CARD_ID = 'e4a7b5f3-f393-4f6d-b4a5-ecf874024bed';

test.describe('App Smoke Tests', () => {
  test('Home page loads with heading and search', async ({ page }) => {
    const home = new HomePage(page);
    await home.navigate();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('h1')).toBeVisible();
    await expect(home.urlInput).toBeVisible();
    await expect(home.searchInput).toBeVisible();
  });

  test('Home page shows category filters', async ({ page }) => {
    const home = new HomePage(page);
    await home.navigate();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await expect(page.getByRole('button', { name: /^All \(/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Design \(/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^AI \(/ })).toBeVisible();
  });

  test('Home page shows card grid with data', async ({ page }) => {
    const home = new HomePage(page);
    await home.navigate();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // The page should show card count (e.g. "404 styles")
    await expect(page.getByText(/styles/)).toBeVisible();

    // Find card buttons by looking for text patterns like "099" or "agency" or "dark/light"
    const cards = page.locator('main button').filter({
      hasText: /dark|light|agency|design|saas|fintech|ecommerce|productivity/,
    });
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('Style detail page loads with title and colors', async ({ page }) => {
    const detail = new StyleDetailPage(page);
    await detail.navigate(TEST_CARD_ID);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(new RegExp(`/style/${TEST_CARD_ID}`));
    await expect(detail.title).toBeVisible();
    await expect(detail.colorsSection).toBeVisible();
  });

  test('Style detail page has export tabs', async ({ page }) => {
    const detail = new StyleDetailPage(page);
    await detail.navigate(TEST_CARD_ID);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await expect(detail.designDocTab).toBeVisible();
    await expect(detail.tailwindTab).toBeVisible();
    await expect(detail.cssVarsTab).toBeVisible();
  });

  test('Style detail page has color swatches and copy button', async ({ page }) => {
    const detail = new StyleDetailPage(page);
    await detail.navigate(TEST_CARD_ID);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Color section should have swatch buttons with "Copy" text
    const colorButtons = page.locator('button').filter({ hasText: /Copy/ });
    await expect(colorButtons.first()).toBeVisible();

    // Scroll to bottom to find export panel copy/download buttons
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await expect(detail.copyBtn).toBeVisible();
    await expect(detail.downloadBtn).toBeVisible();
  });

  test('Navigation: click first card navigates to detail', async ({ page }) => {
    const home = new HomePage(page);
    await home.navigate();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find card buttons: they contain text like "099 agency dark"
    // We need to find buttons that are NOT in the form/header area
    const cardButton = page.locator('main button').filter({
      hasText: /dark|light/,
    }).first();
    await expect(cardButton).toBeVisible({ timeout: 10000 });

    await cardButton.click();

    // Should navigate to a style detail page
    await page.waitForURL(/\/style\//, { timeout: 10000 });
    await expect(page).toHaveURL(/\/style\//);

    // Detail page should have a heading
    await expect(page.locator('h1')).toBeVisible();
  });

  test('API endpoints respond correctly', async ({ request }) => {
    // Cards list API
    const cardsRes = await request.get(`${BASE_URL}/api/cards?limit=3`);
    expect(cardsRes.status()).toBe(200);
    const cardsBody = await cardsRes.json();
    expect(Array.isArray(cardsBody.cards)).toBe(true);
    expect(cardsBody.cards.length).toBeGreaterThan(0);

    // Card detail API
    const cardRes = await request.get(`${BASE_URL}/api/card/${TEST_CARD_ID}`);
    expect(cardRes.status()).toBe(200);
    const cardBody = await cardRes.json();
    expect(cardBody.id).toBe(TEST_CARD_ID);
  });
});