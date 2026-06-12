import { BasePage } from './BasePage';
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * StyleDetailPage — Style detail page Page Object
 * URL: /style/[id]
 * Features: Color swatches, typography, spacing, export tabs
 */
export class StyleDetailPage extends BasePage {
  // ─── Navigation ─────────────────────────────────────────────────────────────
  get backLink() { return this.byRole('link', { name: /Style Library|样式库/ }); }

  // ─── Hero Section ─────────────────────────────────────────────────────────────
  get title() { return this.byRole('heading', { level: 1 }); }
  get categoryTag() { return this.page.locator('[class*="tag"], [class*="category"]').first(); }
  get previewImage() { return this.page.locator('img[class*="preview"]').first(); }

  // ─── Sections ─────────────────────────────────────────────────────────────────
  get colorsSection() { return this.byRole('heading', { name: 'COLOR PALETTE' }); }
  get fontsSection() { return this.byRole('heading', { name: 'TYPOGRAPHY' }); }
  get spacingSection() { return this.byRole('heading', { name: 'SPACING' }); }
  get radiusSection() { return this.byRole('heading', { name: 'SHAPES' }); }
  get componentsSection() { return this.byRole('heading', { name: 'COMPONENTS' }); }
  get figmaSection() { return this.byRole('heading', { name: 'FIGMA COMPARISON' }); }

  // ─── Color Swatches ───────────────────────────────────────────────────────────
  colorSwatch(name: string): Locator {
    return this.byRole('button', { name: new RegExp(name) });
  }

  // ─── Export Tabs ──────────────────────────────────────────────────────────────
  get designDocTab() { return this.byRole('button', { name: 'DESIGN.md' }); }
  get tailwindTab() { return this.byRole('button', { name: 'Tailwind v4' }); }
  get cssVarsTab() { return this.byRole('button', { name: 'CSS Variables' }); }
  get tokensTab() { return this.byRole('button', { name: 'Design Tokens' }); }
  get styleDictTab() { return this.byRole('button', { name: 'Style Dict' }); }

  // ─── Export Actions ───────────────────────────────────────────────────────────
  get copyBtn() { return this.byRole('button', { name: 'Copy', exact: true }); }
  get downloadBtn() { return this.byRole('button', { name: 'Download', exact: true }); }

  // ─── Figma Compare ────────────────────────────────────────────────────────────
  get figmaInput() { return this.byPlaceholder(/Paste Figma file URL|粘贴 Figma/); }
  get compareBtn() { return this.byRole('button', { name: 'Compare' }); }

  constructor(page: Page) { super(page); }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async navigate(cardId: string) {
    await this.goto(`/style/${cardId}`);
  }

  async goBack() {
    await this.click(this.backLink);
  }

  async clickColorSwatch(name: string) {
    await this.click(this.colorSwatch(name));
  }

  async switchExportTab(tabName: 'DESIGN.md' | 'Tailwind v4' | 'CSS Variables' | 'Design Tokens' | 'Style Dict') {
    const tabMap: Record<string, Locator> = {
      'DESIGN.md': this.designDocTab,
      'Tailwind v4': this.tailwindTab,
      'CSS Variables': this.cssVarsTab,
      'Design Tokens': this.tokensTab,
      'Style Dict': this.styleDictTab,
    };
    await this.click(tabMap[tabName]);
  }

  async copyExport() {
    await this.click(this.copyBtn);
  }

  async downloadExport() {
    await this.click(this.downloadBtn);
  }

  async enterFigmaUrl(url: string) {
    await this.fill(this.figmaInput, url);
  }

  async clickCompare() {
    await this.click(this.compareBtn);
  }

  // ─── Assertions ─────────────────────────────────────────────────────────────

  async expectTitleVisible() {
    await expect(this.title).toBeVisible();
  }

  async expectSectionVisible(sectionName: string) {
    await expect(this.byRole('heading', { name: sectionName })).toBeVisible();
  }
}