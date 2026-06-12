# App Exploration Report

> Generated: 2026-06-12
> Mode: Full app exploration (`/opsx:e2e all`)

## Routes Discovered

| # | Route | Auth | Status | Notes |
|---|-------|------|--------|-------|
| 1 | `/` | none | ✅ 200 | Home page with URL extraction, search, category filters, card grid |
| 2 | `/style/[id]` | none | ✅ 200 | Style detail page: colors, typography, spacing, components, export tabs, Figma comparison |
| 3 | `/api/cards` | none | ✅ 200 | Cards list API (JSON) |
| 4 | `/api/card/[id]` | none | ✅ 200 | Card detail API (JSON) |
| 5 | `/api/card/[id]/theme` | none | ✅ 200 | Theme CSS API |
| 6 | `/api/card/[id]/tokens` | none | ✅ 200 | Design tokens JSON API |
| 7 | `/api/card/[id]/variables` | none | ✅ 200 | CSS variables API |
| 8 | `/api/card/[id]/style-dictionary` | none | ✅ 200 | Style Dictionary JSON API |
| 9 | `/api/extract` | none | ✅ 200 | POST: Extract design tokens from URL |
| 10 | `/api/comparison` | none | ✅ 200 | POST: Compare two designs |
| 11 | `/api/screenshots/[id]` | none | ✅ 200 | Screenshot serving endpoint |
| 12 | `/api/figma/extract` | none | ✅ 200 | POST: Extract from Figma file |
| 13 | `/api/admin/check-screenshots` | none | ✅ 200 | Screenshot health check API |

## Auth Status

**None required.** All routes are public/guest accessible.

## Page Objects Generated

| File | Route | Description |
|------|-------|-------------|
| `HomePage.ts` | `/` | URL input, search, category filters, card grid |
| `StyleDetailPage.ts` | `/style/[id]` | Color swatches, typography, spacing, export tabs, Figma compare |

## Interactive Elements by Route

### `/` (Home)

| Element | Type | Selector (stable) |
|---------|------|-------------------|
| URL Input | textbox | `getByPlaceholder('https://stripe.com')` |
| Search Input | textbox | `getByPlaceholder('Search sites...')` |
| Extract Button | button | `getByRole('button', { name: 'Extract Tokens' })` |
| Language EN | button | `getByRole('button', { name: 'EN' })` |
| Language 中文 | button | `getByRole('button', { name: '中文' })` |
| Category Filter | button | `getByRole('button', { name: /^All \(/ })` etc. |
| Card Item | button | `main button` filtered by dark/light pattern |

### `/style/[id]` (Detail)

| Element | Type | Selector (stable) |
|---------|------|-------------------|
| Back Link | link | `getByRole('link', { name: /Style Library/ })` |
| Page Title | heading h1 | `getByRole('heading', { level: 1 })` |
| Color Swatch | button | `getByRole('button', { name: /Midnight Oil|Ghost White|Steel Gray/ })` |
| DESIGN.md Tab | button | `getByRole('button', { name: 'DESIGN.md' })` |
| Tailwind v4 Tab | button | `getByRole('button', { name: 'Tailwind v4' })` |
| CSS Variables Tab | button | `getByRole('button', { name: 'CSS Variables' })` |
| Design Tokens Tab | button | `getByRole('button', { name: 'Design Tokens' })` |
| Style Dict Tab | button | `getByRole('button', { name: 'Style Dict' })` |
| Copy Button | button | `getByRole('button', { name: 'Copy', exact: true })` |
| Download Button | button | `getByRole('button', { name: 'Download', exact: true })` |
| Figma Input | textbox | `getByPlaceholder(/Paste Figma/)` |
| Compare Button | button | `getByRole('button', { name: 'Compare' })` |

## Special Elements Detected

None detected (no CAPTCHA, canvas, iframe, OTP, WebSocket, etc.)

## SPA Behavior

- **Framework**: Next.js App Router
- **Hydration**: Wait for `domcontentloaded` + 2s delay for data fetching
- **Routing**: Client-side navigation between cards
- **Data fetching**: Cards load from `/api/cards` on mount

## Language

Default language is **English**. Language toggle buttons (EN / 中文) are present.

## Smoke Tests

File: `tests/playwright/app-all.spec.ts`
- 8 tests, all passing (44.5s)
