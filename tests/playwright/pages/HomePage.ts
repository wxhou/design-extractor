import { BasePage } from './BasePage';
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * HomePage — Home page Page Object
 * URL: /
 * Features: URL input, search, category filters, card grid
 */
export class HomePage extends BasePage {
  // ─── Inputs ─────────────────────────────────────────────────────────────────
  get urlInput() { return this.byPlaceholder('https://stripe.com'); }
  get searchInput() { return this.byPlaceholder('Search sites...'); }

  // ─── Buttons ────────────────────────────────────────────────────────────────
  get extractBtn() { return this.byRole('button', { name: 'Extract Tokens' }); }
  get languageToggle() { return this.byRole('button', { name: /EN|中文/ }); }

  // ─── Category Filters ───────────────────────────────────────────────────────
  categoryButton(name: string): Locator {
    return this.byRole('button', { name: new RegExp(name) });
  }

  // ─── Card Grid ──────────────────────────────────────────────────────────────
  get cardGrid() { return this.page.locator('main'); }

  constructor(page: Page) { super(page); }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async navigate() {
    await this.goto('/');
  }

  async enterUrl(url: string) {
    await this.fillAndVerify(this.urlInput, url);
  }

  async clickExtract() {
    await this.click(this.extractBtn);
  }

  async search(query: string) {
    await this.fill(this.searchInput, query);
  }

  async filterByCategory(category: string) {
    await this.click(this.categoryButton(category));
  }

  // ─── Assertions ─────────────────────────────────────────────────────────────

  async expectHeadingVisible() {
    await expect(this.byRole('heading', { name: /Turn any URL/ })).toBeVisible();
  }
}