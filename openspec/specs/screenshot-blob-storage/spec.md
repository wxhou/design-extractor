# screenshot-blob-storage Specification

## Purpose

截图二进制经压缩后上传 Vercel Blob，数据库仅存储 blob URL 引用；上传失败时提取流程快速失败。

## Requirements
### Requirement: Screenshots shall be uploaded to Vercel Blob as compressed JPEG

The system SHALL convert captured screenshots (viewport capture, 1440px wide) to JPEG (quality ~80) before upload, and upload the binary to Vercel Blob via `@vercel/blob` `put()` with `addRandomSuffix: false`. The blob key SHALL follow the pattern `extraction-<cardId>-<timestamp>.jpg`.

#### Scenario: Successful upload during extraction
- **WHEN** a new extraction completes with a captured screenshot buffer
- **THEN** the system SHALL convert the PNG screenshot buffer to JPEG at quality 80
- **AND** upload it to Vercel Blob under key `extraction-<cardId>-<timestamp>.jpg` (no random suffix appended)
- **AND** store the returned blob URL in the database instead of image bytes

#### Scenario: Blob upload failure fails the extraction
- **WHEN** a screenshot buffer exists but the blob `put()` fails (network error, missing token, quota exceeded)
- **THEN** `saveScreenshot()` SHALL throw the error
- **AND** the free extract route SHALL return an error status (500 with friendly message) and the v1 API route SHALL return a 502 `extraction_failed`
- **AND** no card record SHALL be persisted for this extraction

#### Scenario: Screenshot capture failure keeps current behavior
- **WHEN** Playwright screenshot capture itself fails during extraction (existing behavior: `src/extractor-v2.js` swallows the error and continues without a buffer)
- **THEN** the card SHALL still be created with null screenshot fields (existing semantics unchanged)
- **AND** the detail page SHALL show a placeholder
- **AND** this requirement does NOT retroactively mandate failing extraction on capture failure

### Requirement: Database stores blob URL references only

The `cards` table SHALL store only HTTP(S) blob URLs in `preview` and `screenshot` columns for newly extracted cards that have a screenshot. Storing base64 data URIs or local file paths in these columns is prohibited.

#### Scenario: New card stores URL not bytes
- **WHEN** `saveExtraction()` persists a new card with a captured screenshot
- **THEN** both `preview` and `screenshot` fields SHALL contain the blob URL returned by `put()`
- **AND** neither field SHALL contain a `data:` URI or a local path

#### Scenario: Existing base64 cards are migrated
- **WHEN** the migration script `scripts/migrate-base64-screenshots.mjs` runs against the database
- **THEN** every card whose `preview` starts with `data:` SHALL have its decoded image converted to JPEG, uploaded to Vercel Blob, and both `preview` and `screenshot` columns updated to the blob URL only where they still contain `data:` URIs
- **AND** the script SHALL be idempotent (a second run finds no `data:` rows and performs no writes)

### Requirement: Cards list API shall not return screenshot field

The `/api/cards` endpoint SHALL NOT include the `screenshot` field in its response; it SHALL return `preview` only. The `screenshot` field SHALL remain available via the card detail API.

#### Scenario: List response is lightweight
- **WHEN** GET `/api/cards?page=1&limit=20` returns cards AND the base64 migration (4.x tasks) has completed
- **THEN** each card object SHALL contain `preview` but not `screenshot`
- **AND** every `preview` value SHALL be an HTTP(S) URL (no `data:` URIs remain in the database)
- **AND** the total response size SHALL be under 100KB
