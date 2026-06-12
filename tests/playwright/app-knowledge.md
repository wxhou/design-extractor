# App Knowledge — design-extractor

Generated: 2026-06-12
Last updated: 2026-06-12

Cross-change E2E knowledge for the Design Extractor project.

## Routes

| Route | Auth | Page Object | Notes |
|-------|------|-------------|-------|
| `/` | guest | `HomePage.ts` | URL extraction, search, category filters, card grid (404 cards) |
| `/style/[id]` | guest | `StyleDetailPage.ts` | Colors, typography, spacing, components, export tabs, Figma comparison |
| `/api/cards` | none | — | Cards list API (JSON) |
| `/api/card/[id]` | none | — | Card detail API (JSON) |
| `/api/extract` | none | — | POST: Extract design tokens |
| `/api/comparison` | none | — | POST: Compare designs |
| `/api/screenshots/[id]` | none | — | Screenshot serving |
| `/api/figma/extract` | none | — | POST: Figma extraction |

## Credential Format

No auth required. All routes are public.

## Common Selector Patterns

Priority: `getByRole` > `getByPlaceholder` > `locator('[class*="..."]')`

### Home Page (`/`)

| Element | Selector | Notes |
|---------|----------|-------|
| URL input | `getByPlaceholder('https://stripe.com')` | Not "Enter website URL" |
| Search input | `getByPlaceholder('Search sites...')` | Not "Search websites..." |
| Extract button | `getByRole('button', { name: 'Extract Tokens' })` | Disabled until URL entered |
| Category filter | `getByRole('button', { name: /^All \(/ })` | Contains count: "All (404)" |
| Card button | `main button` filtered by `/dark\|light/` | Avoids form/header buttons |

### Style Detail Page (`/style/[id]`)

| Element | Selector | Notes |
|---------|----------|-------|
| Page title | `getByRole('heading', { level: 1 })` | Card name (e.g. "099") |
| Color section | `getByRole('heading', { name: 'COLOR PALETTE' })` | English interface |
| Export tabs | `getByRole('button', { name: 'DESIGN.md' })` etc. | 5 tabs |
| Copy button | `getByRole('button', { name: 'Copy', exact: true })` | Multiple "Copy" on page |
| Download button | `getByRole('button', { name: 'Download', exact: true })` | Must use exact |
| Figma input | `getByPlaceholder(/Paste Figma/)` | Fallback for both languages |

## Architecture

| Aspect | Value | Notes |
|--------|-------|-------|
| Framework | Next.js App Router | JavaScript (not TypeScript) |
| Database | Turso (libSQL) + sql.js fallback | Local SQLite in dev |
| Styling | CSS Modules + Tailwind CSS | |
| Browser | Playwright (Chromium) | For design token extraction |
| Hosting | Vercel + Cloudflare Worker proxy | |
| Backend | Embedded in Next.js | API routes in `app/api/` |
| Restart | `npx next dev -p 3000` | |

## SPA Routing

- Framework: Next.js App Router
- URL changes without page reload: yes
- History API: yes
- Hash routing: no

## Hydration Strategy

| Framework | Wait Strategy |
|-----------|---------------|
| Next.js App Router | `domcontentloaded` + `waitForTimeout(2000)` |
| Do NOT use | `networkidle` (background fetches keep it busy) |

Card grid data loads from `/api/cards` on mount. Category counts update after data fetch.

## Language

- Default: English
- Toggle: `EN` / `中文` buttons in header
- All selectors must use English text (default state)

## Dynamic Content Conventions

- Card count: "404 styles" — use regex `/styles/`
- Category buttons: contain counts like "All (404)"
- Color swatches: button text = "ColorName #hex Copy usage..."
- Card buttons: contain name + category + theme (dark/light)

## Known Issues

| Issue | Selector Impact |
|-------|----------------|
| Category buttons contain counts | Use `/^All \(/` not `/All/` to avoid matching card names |
| Multiple "Copy" buttons | Must use `exact: true` for export panel Copy/Download |
| Form buttons in main | `main button` first() may hit disabled extract button — filter by text |

## Project Conventions

| Convention | Value | Notes |
|------------|-------|-------|
| BASE_URL | `http://localhost:3000` | Override with env |
| Default port | 3000 | `npx next dev -p 3000` |
| Test card ID | `e4a7b5f3-f393-4f6d-b4a5-ecf874024bed` | "099" agency card |
| Auth | none | All routes public |

## Selector Fixes (Healer memory)

| Date | Route | Old Selector | New Selector | Reason |
|------|-------|-------------|-------------|--------|
| 2026-06-12 | `/` | `getByPlaceholder('Enter website URL')` | `getByPlaceholder('https://stripe.com')` | Actual placeholder text |
| 2026-06-12 | `/` | `getByPlaceholder('Search websites...')` | `getByPlaceholder('Search sites...')` | Actual placeholder text |
| 2026-06-12 | `/` | `getByRole('button', { name: /All/ })` | `getByRole('button', { name: /^All \(/ })` | Avoids matching card names |
| 2026-06-12 | `/style/[id]` | `getByRole('button', { name: 'Copy' })` | `getByRole('button', { name: 'Copy', exact: true })` | Multiple copy buttons |

## Assertion Fixes (Healer memory)

| Date | Test | Old Assertion | New Assertion | Reason |
|------|------|-------------|-------------|--------|
| 2026-06-12 | Home heading | `getByRole('heading', { name: /提取/ })` | `locator('h1')` | Default language is English |

## Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-06-12 | Initial exploration — 8 routes, 2 Page Objects | E2E all mode |
