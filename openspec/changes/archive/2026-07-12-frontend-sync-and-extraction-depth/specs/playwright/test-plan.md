# Test Plan — frontend-sync-and-extraction-depth

Spec → Test case mapping for the change. Generated from specs in `specs/*/spec.md`.

## Route Coverage

| Route | Auth | Test Cases | Notes |
|-------|------|-----------|-------|
| `/` | guest | TC-1, TC-2 | Homepage card gallery |
| `/style/[id]` | guest | TC-3, TC-4, TC-5, TC-6, TC-7, TC-8 | Detail page |

Cards currently in DB (from `/api/cards`): 20 existing cards. We pick 1 with recent extraction as the E2E target.

## Test Cases

### TC-1: Homepage gallery loads
- **Source**: implicit smoke test for the gallery page
- **Assert**:
  - Page loads without JS errors (`expect(page).not.toHaveConsoleErrors`)
  - Card grid or list visible

### TC-2: Homepage → detail navigation
- **Source**: implicit smoke test
- **Assert**:
  - Click first card → URL changes to `/style/[id]`

### TC-3: Detail page — DESIGN.md 8 canonical sections
- **Source**: `frontend-sync/spec.md` Requirement: "前端 getDesignMd() 与后端同步"
- **Assert**:
  - `getDesignMd()` output contains all 8 section headers: `## Overview`, `## Colors`, `## Typography`, `## Layout & Spacing`, `## Elevation & Depth`, `## Shapes`, `## Components`, `## Do's and Don'ts`

### TC-4: Detail page — designMd API matches Markdown tab
- **Source**: `frontend-sync/spec.md` Scenario: "一致输出"
- **Assert**:
  - Fetch `/api/card/[id]` → `designMd` field contains 8 section headers
  - UI's `getDesignMd()` should be consistent with API's `designMd`

### TC-5: Detail page — Components section visible
- **Source**: `component-detection/spec.md` Requirement: "DOM 结构组件候选采集"
- **Assert**:
  - Detail page renders "Components" section when `components` exists
  - When components array is empty: section shows `(none detected)` placeholder

### TC-6: Detail page — Layout section grid/flex data
- **Source**: `layout-depth-detection/spec.md` Requirement: "Layout 信息集成"
- **Assert**:
  - For cards with grid/flex layout data:
    - Markdown contains `**Grid layout:**` and/or `**Flexbox layout:**`
    - For cards with no layout data: Layout section still rendered with spacing + breakpoints

### TC-7: Detail page — Do's & Don'ts visible
- **Source**: `frontend-sync/spec.md` "Details page shows Do's and Don'ts"
- **Assert**:
  - When `dos` or `donts` array is non-empty → section shows "Do's and Don'ts" with bullets

### TC-8: API response — new fields present
- **Source**: layout-depth, responsive-strategy, component-detection specs
- **Assert**:
  - `/api/cards` returns `cards` array
  - `/api/card/[id]` row has columns: `colors`, `fonts`, `north_star`, `dos`, `donts`, `spacing_base`, `breakpoints`, `css_variables`, `raw_data`

## State Boundaries

| Page → Page | Element Disappears | Element Appears |
|-------------|--------------------|-----------------|
| Homepage → Detail | Card grid items | Detail panel, breadcrumb |

## Test Strategy

- Use existing seed.spec.ts as a smoke baseline
- All UI assertions use Playwright UI selectors (`getByRole`, `getByText`)
- Backend data flow validated via `/api/card/[id]` `page.request`
- API assertion for `designMd` content consistency

## Auth

No authentication required. All routes are guest-accessible per `/` and `/style/[id]`.

## Tagged Test Runs

```
TC-1, TC-2: route-level smoke (no change-specific new feature asserted)
TC-3, TC-4: frontend-sync capability @frontend-sync
TC-5: component-detection capability @component-detection
TC-6: layout-depth-detection capability @layout-depth
TC-7: frontend-sync capability @frontend-sync
TC-8: API contract — cross-cutting
```
